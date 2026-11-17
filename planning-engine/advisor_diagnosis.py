"""Pure deterministic blocker diagnosis over a schedule proposal and workspace."""
from __future__ import annotations

from collections import defaultdict
from fractions import Fraction
from typing import Iterable, Literal

from pydantic import BaseModel, Field

from models import (
    AdvisorAnalyzeRequest,
    PendingSessionItem,
    PlanningPolicyInput,
)
from solver import is_eligible_for_course
from advisor_capacity import FreeSlotScreen, screen_free_slots

BandName = Literal["mañana", "tarde", "noche"]
RoomKind = Literal["classroom", "laboratory"]

TIME_BANDS: tuple[tuple[BandName, int, int], ...] = (
    ("mañana", 480, 780),   # 08:00-13:00
    ("tarde", 840, 1080),   # 14:00-18:00
    ("noche", 1080, 1320),  # 18:00-22:00
)
DAYS: tuple[int, ...] = (1, 2, 3, 4, 5, 6)
ROOM_KINDS: tuple[RoomKind, ...] = ("classroom", "laboratory")
BAND_ORDER: dict[BandName, int] = {"mañana": 0, "tarde": 1, "noche": 2}
NON_CAUSE_DIAGNOSTIC_CODES = frozenset({"COMPLETE", "PARTIAL_PROPOSAL"})


class BandOccupancy(BaseModel):
    day: int
    band: BandName
    roomKind: RoomKind
    usedMinutes: int = Field(ge=0)
    availableMinutes: int = Field(ge=0)

    @property
    def freeMinutes(self) -> int:
        return max(0, self.availableMinutes - self.usedMinutes)

    @property
    def occupancyRatio(self) -> float | None:
        if self.availableMinutes <= 0:
            return None
        return self.usedMinutes / self.availableMinutes


class TeacherSlack(BaseModel):
    teacherId: str
    maxWeeklyMinutes: int
    assignedMinutes: int
    slackMinutes: int
    eligibleCourseIds: list[str]


class PendingGroup(BaseModel):
    items: list[PendingSessionItem]
    sessionCount: int
    totalMinutes: int
    sectionIds: list[str]
    cycle: int | None = None


class BlockerDiagnosis(BaseModel):
    occupancy: list[BandOccupancy]
    emptyOrLowOccupancySlots: list[BandOccupancy]
    teacherSlack: list[TeacherSlack]
    pendingByCourse: dict[str, PendingGroup]
    pendingByCycle: dict[int | None, PendingGroup]
    totalPendingCount: int
    pendingSectionIds: list[str]
    diagnosticCodes: list[str]
    causesBySession: dict[str, list[str]]
    unknownCauseSessionIds: list[str]
    potentialAfternoonFreeMinutes: int = 0
    weekdayAvailableMinutes: int = 0
    weekdayUsedMinutes: int = 0
    freeSlots: FreeSlotScreen = Field(default_factory=lambda: FreeSlotScreen(fits=[], unfitSectionIds=[]))

    @property
    def weekdaySaturationRatio(self) -> float | None:
        if self.weekdayAvailableMinutes <= 0:
            return None
        return self.weekdayUsedMinutes / self.weekdayAvailableMinutes


def _merge_intervals(intervals: Iterable[tuple[int, int]]) -> list[tuple[int, int]]:
    valid = sorted((s, e) for s, e in intervals if e > s)
    if not valid:
        return []
    merged: list[tuple[int, int]] = [valid[0]]
    for start, end in valid[1:]:
        prev_start, prev_end = merged[-1]
        if start <= prev_end:
            merged[-1] = (prev_start, max(prev_end, end))
        else:
            merged.append((start, end))
    return merged


def _intersect_intervals(
    first: list[tuple[int, int]], second: list[tuple[int, int]]
) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    i = 0
    j = 0
    while i < len(first) and j < len(second):
        a_start, a_end = first[i]
        b_start, b_end = second[j]
        start = max(a_start, b_start)
        end = min(a_end, b_end)
        if end > start:
            out.append((start, end))
        if a_end <= b_end:
            i += 1
        else:
            j += 1
    return out


def _policy_intervals_for_band(
    day: int,
    band: BandName,
    band_start: int,
    band_end: int,
    policy: PlanningPolicyInput | None,
) -> list[tuple[int, int]]:
    if policy is None:
        return [(band_start, band_end)]
    if day == 6:
        if not policy.allowSaturday or band != "mañana":
            return []
        return [(band_start, band_end)]
    if band == "tarde" and not policy.allowAfternoon:
        return []
    return [(band_start, band_end)]


def _build_pending_group(
    items: list[PendingSessionItem], cycle: int | None
) -> PendingGroup:
    section_ids = list(dict.fromkeys(item.sectionId for item in items))
    return PendingGroup(
        items=items,
        sessionCount=len(items),
        totalMinutes=sum(item.durationMinutes for item in items),
        sectionIds=section_ids,
        cycle=cycle,
    )


def diagnose(req: AdvisorAnalyzeRequest) -> BlockerDiagnosis:
    courses_by_id = {c.courseId: c for c in req.courses}
    rooms_by_id = {r.id: r for r in req.rooms}
    has_policy = req.planningPolicy is not None

    windows_by_day: dict[int, list[tuple[int, int]]] = {}
    for day in DAYS:
        windows_by_day[day] = _merge_intervals(
            (w.startMinute, w.endMinute) for w in req.windows if w.day == day
        )

    room_avail_by_kind_and_day: dict[
        tuple[RoomKind, int], list[list[tuple[int, int]]]
    ] = defaultdict(list)
    for room in req.rooms:
        room_kind: RoomKind = "laboratory" if room.kind == "laboratory" else "classroom"
        for day in DAYS:
            merged_room = _merge_intervals(
                (iv.startMinute, iv.endMinute)
                for iv in room.availability
                if iv.day == day
            )
            if merged_room:
                room_avail_by_kind_and_day[(room_kind, day)].append(merged_room)

    used_by_cell: dict[tuple[int, BandName, RoomKind], int] = defaultdict(int)
    for assignment in req.assignments:
        day = assignment.interval.day
        if day not in DAYS:
            continue
        room = rooms_by_id.get(assignment.roomId)
        room_kind: RoomKind = (
            "laboratory" if room and room.kind == "laboratory" else "classroom"
        )
        for band, band_start, band_end in TIME_BANDS:
            overlap = min(assignment.interval.endMinute, band_end) - max(
                assignment.interval.startMinute, band_start
            )
            if overlap > 0:
                used_by_cell[(day, band, room_kind)] += overlap

    occupancy: list[BandOccupancy] = []
    potential_afternoon_available = 0
    afternoon_used = 0
    for day in DAYS:
        day_windows = windows_by_day[day]
        for band, band_start, band_end in TIME_BANDS:
            policy_ivs = _policy_intervals_for_band(
                day, band, band_start, band_end, req.planningPolicy
            )
            effective_window_ivs = (
                _intersect_intervals(day_windows, policy_ivs) if policy_ivs else []
            )
            raw_afternoon_ivs = (
                _intersect_intervals(day_windows, [(band_start, band_end)])
                if 1 <= day <= 5 and band == "tarde"
                else []
            )
            for room_kind in ROOM_KINDS:
                available_minutes = 0
                if effective_window_ivs:
                    for room_ivs in room_avail_by_kind_and_day[(room_kind, day)]:
                        covered = _intersect_intervals(effective_window_ivs, room_ivs)
                        available_minutes += sum(e - s for s, e in covered)
                if raw_afternoon_ivs:
                    for room_ivs in room_avail_by_kind_and_day[(room_kind, day)]:
                        covered = _intersect_intervals(raw_afternoon_ivs, room_ivs)
                        potential_afternoon_available += sum(e - s for s, e in covered)
                    afternoon_used += used_by_cell[(day, band, room_kind)]
                occupancy.append(
                    BandOccupancy(
                        day=day,
                        band=band,
                        roomKind=room_kind,
                        usedMinutes=used_by_cell[(day, band, room_kind)],
                        availableMinutes=available_minutes,
                    )
                )

    weekday_available = sum(
        cell.availableMinutes for cell in occupancy if 1 <= cell.day <= 5
    )
    weekday_used = sum(
        cell.usedMinutes for cell in occupancy if 1 <= cell.day <= 5
    )

    low_occupancy_slots = [
        cell
        for cell in occupancy
        if cell.availableMinutes > 0 and cell.usedMinutes * 2 <= cell.availableMinutes
    ]
    low_occupancy_slots.sort(
        key=lambda cell: (
            Fraction(cell.usedMinutes, cell.availableMinutes),
            -(cell.availableMinutes - cell.usedMinutes),
            cell.day,
            BAND_ORDER[cell.band],
            cell.roomKind,
        )
    )

    assigned_minutes_by_teacher: dict[str, int] = defaultdict(int)
    for assignment in req.assignments:
        assigned_minutes_by_teacher[assignment.teacherId] += (
            assignment.interval.endMinute - assignment.interval.startMinute
        )

    teacher_slack: list[TeacherSlack] = []
    for teacher in req.teachers:
        assigned = assigned_minutes_by_teacher[teacher.id]
        eligible_courses = list(
            dict.fromkeys(
                cid
                for cid in teacher.courseIds
                if is_eligible_for_course(teacher, cid, has_policy)
            )
        )
        teacher_slack.append(
            TeacherSlack(
                teacherId=teacher.id,
                maxWeeklyMinutes=teacher.maxWeeklyMinutes,
                assignedMinutes=assigned,
                slackMinutes=teacher.maxWeeklyMinutes - assigned,
                eligibleCourseIds=eligible_courses,
            )
        )

    pending_items_by_course: dict[str, list[PendingSessionItem]] = defaultdict(list)
    pending_items_by_cycle: dict[int | None, list[PendingSessionItem]] = defaultdict(
        list
    )
    for item in req.pending:
        pending_items_by_course[item.courseId].append(item)
        course = courses_by_id.get(item.courseId)
        cycle = course.cycle if course is not None else None
        pending_items_by_cycle[cycle].append(item)

    pending_by_course = {
        course_id: _build_pending_group(
            items,
            courses_by_id[course_id].cycle if course_id in courses_by_id else None,
        )
        for course_id, items in pending_items_by_course.items()
    }
    pending_by_cycle = {
        cycle: _build_pending_group(items, cycle)
        for cycle, items in pending_items_by_cycle.items()
    }
    pending_section_ids = list(dict.fromkeys(item.sectionId for item in req.pending))

    diagnostic_codes = list(dict.fromkeys(d.code for d in req.diagnostics))
    diags_by_session: dict[str, list[str]] = defaultdict(list)
    for diag in req.diagnostics:
        if diag.code in NON_CAUSE_DIAGNOSTIC_CODES:
            continue
        for session_id in diag.sessionIds:
            if diag.code not in diags_by_session[session_id]:
                diags_by_session[session_id].append(diag.code)

    causes_by_session: dict[str, list[str]] = {}
    unknown_cause_session_ids: list[str] = []
    for item in req.pending:
        codes = list(diags_by_session.get(item.sessionId, ()))
        causes_by_session[item.sessionId] = codes
        if not codes:
            unknown_cause_session_ids.append(item.sessionId)

    return BlockerDiagnosis(
        occupancy=occupancy,
        emptyOrLowOccupancySlots=low_occupancy_slots,
        teacherSlack=teacher_slack,
        pendingByCourse=pending_by_course,
        pendingByCycle=pending_by_cycle,
        totalPendingCount=len(req.pending),
        pendingSectionIds=pending_section_ids,
        diagnosticCodes=diagnostic_codes,
        causesBySession=causes_by_session,
        unknownCauseSessionIds=unknown_cause_session_ids,
        potentialAfternoonFreeMinutes=max(0, potential_afternoon_available - afternoon_used),
        weekdayAvailableMinutes=weekday_available,
        weekdayUsedMinutes=weekday_used,
        freeSlots=screen_free_slots(req),
    )
