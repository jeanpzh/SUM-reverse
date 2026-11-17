from __future__ import annotations

import time
import math
from functools import lru_cache

from collections import defaultdict
from ortools.sat.python import cp_model

from models import (
    AssignmentOutput,
    CourseInput,
    DiagnosticOutput,
    PlanningPolicyInput,
    RequiredSessionInput,
    RoomInput,
    SectionInput,
    SolveScheduleRequest,
    SolveScheduleResponse,
    TeacherInput,
    TimeInterval,
)

THESIS_COURSE_IDS = {
    "20118081",
    "20118091",
    "20118101",
}

KNOWN_FACULTY_IDS = ("FISI",)
FACULTY_PLANNING_PROFILES = {
    "FISI": {
        "facultyId": "FISI",
        "weekdayStartMinute": 8 * 60,
        "weekdayEndMinute": 22 * 60,
        "seniorCycleThreshold": 7,
        "seniorDefaultStartMinute": 18 * 60,
        "seniorAfternoonStartMinute": 14 * 60,
        "saturdayStartMinute": 8 * 60,
        "saturdayDefaultEndMinute": 13 * 60,
    }
}


def resolve_planning_time_profile(policy: PlanningPolicyInput | None) -> dict:
    if policy is None:
        return {
            "facultyId": None,
            "period": None,
            "source": "unconstrained",
            "weekdayStartMinute": 0,
            "weekdayEndMinute": 1440,
            "seniorCycleThreshold": None,
            "seniorStartMinute": 0,
            "seniorDefaultStartMinute": 0,
            "saturdayAllowed": True,
            "saturdayStartMinute": 0,
            "saturdayEndMinute": 1440,
        }
    faculty_id = policy.facultyId or "FISI"
    if faculty_id not in KNOWN_FACULTY_IDS:
        raise ValueError(f"Facultad de política local no admitida o desconocida: {faculty_id}")
    base = FACULTY_PLANNING_PROFILES[faculty_id]
    exc = policy.exceptions
    sat_start = exc.saturdayStartMinute if exc and exc.saturdayStartMinute is not None else base["saturdayStartMinute"]
    sat_end = exc.saturdayEndMinute if exc and exc.saturdayEndMinute is not None else base["saturdayDefaultEndMinute"]
    if sat_start >= sat_end:
        raise ValueError("Rango horario de excepción de sábado inválido")
    if (exc and (exc.saturdayStartMinute is not None or exc.saturdayEndMinute is not None)) and not policy.allowSaturday:
        raise ValueError("La excepción de franja de sábado requiere allowSaturday activo")
    return {
        "facultyId": faculty_id,
        "period": policy.period,
        "source": policy.source or "synthetic-local-default",
        "weekdayStartMinute": base["weekdayStartMinute"],
        "weekdayEndMinute": base["weekdayEndMinute"],
        "seniorCycleThreshold": base["seniorCycleThreshold"],
        "seniorStartMinute": base["seniorAfternoonStartMinute"] if policy.allowAfternoon else base["seniorDefaultStartMinute"],
        "seniorDefaultStartMinute": base["seniorDefaultStartMinute"],
        "saturdayAllowed": policy.allowSaturday,
        "saturdayStartMinute": sat_start,
        "saturdayEndMinute": sat_end,
    }


def get_effective_planning_windows(
    base_windows: list[TimeInterval], policy: PlanningPolicyInput | None
) -> list[TimeInterval]:
    if policy is None:
        return [w.model_copy(deep=True) for w in base_windows]
    profile = resolve_planning_time_profile(policy)
    result = [w.model_copy(deep=True) for w in base_windows if w.day != 6]
    if profile["saturdayAllowed"]:
        result.append(
            TimeInterval(
                day=6,
                startMinute=profile["saturdayStartMinute"],
                endMinute=profile["saturdayEndMinute"],
            )
        )
    return result


def get_section_component_groups(
    items: list[RequiredSessionInput],
    teacher_assignment_mode: str = "single-teacher-section",
) -> list[list[RequiredSessionInput]]:
    if not items:
        return []
    if teacher_assignment_mode == "per-session":
        return [[item] for item in items]
    if teacher_assignment_mode == "tp-grouped-l-independent":
        non_lab = [item for item in items if item.type != "L"]
        labs = [item for item in items if item.type == "L"]
        groups: list[list[RequiredSessionInput]] = []
        if non_lab:
            groups.append(non_lab)
        for lab in labs:
            groups.append([lab])
        return groups
    return [items]


def availability_covers(
    availability: list[TimeInterval], day: int, start: int, end: int
) -> bool:
    covered = start
    day_windows = sorted(
        (w for w in availability if w.day == day), key=lambda w: w.startMinute
    )
    for w in day_windows:
        if w.endMinute <= covered:
            continue
        if w.startMinute > covered:
            return False
        covered = max(covered, w.endMinute)
        if covered >= end:
            return True
    return False


def is_eligible_for_course(
    teacher: TeacherInput, course_id: str, has_planning_policy: bool
) -> bool:
    if course_id not in teacher.courseIds:
        return False
    if course_id not in THESIS_COURSE_IDS or not has_planning_policy:
        return True
    return (
        teacher.facultyId == "FISI"
        and teacher.qualificationSource == "synthetic"
    )


def planning_time_rank(
    cycle: int | None,
    start: int,
    day: int,
    duration: int,
    policy: PlanningPolicyInput | None,
) -> int | None:
    if policy is None:
        return 0
    profile = resolve_planning_time_profile(policy)
    senior = (cycle or 0) >= profile["seniorCycleThreshold"]
    if day == 7:
        return None
    if day == 6:
        if (
            profile["saturdayAllowed"]
            and start >= profile["saturdayStartMinute"]
            and start + duration <= profile["saturdayEndMinute"]
        ):
            return 2 if senior else 1
        return None
    if day < 1 or day > 5 or start + duration > profile["weekdayEndMinute"]:
        return None
    if senior:
        if start >= profile["seniorDefaultStartMinute"]:
            return 0
        if policy.allowAfternoon and start >= profile["seniorStartMinute"]:
            return 1
        return None
    return 0 if start >= profile["weekdayStartMinute"] else None


def intervals_overlap(
    day_a: int, start_a: int, end_a: int, day_b: int, start_b: int, end_b: int
) -> bool:
    return day_a == day_b and start_a < end_b and start_b < end_a


def solve_academic_schedule(req: SolveScheduleRequest) -> SolveScheduleResponse:
    deadline = time.monotonic() + req.maxTimeSeconds
    incumbent: list[AssignmentOutput] = []
    incumbent_visits = 0

    def generation_timeout():
        complete = len(incumbent) == len(req.requirements)
        return SolveScheduleResponse(
            status="complete" if complete else "search-limit",
            assignments=incumbent,
            exploredCandidates=0,
            candidateVisits=incumbent_visits,
            backtracks=0,
            limitReason=None if complete else "time",
            diagnostics=[
                DiagnosticOutput(
                    code="COMPLETE" if complete else "SEARCH_LIMIT",
                    message=(
                        "Construcción factible completa"
                        if complete
                        else "Se agotó el presupuesto durante la preparación CP-SAT; se conserva el mejor horario factible"
                    ),
                    sessionIds=[
                        r.id
                        for r in req.requirements
                        if r.id not in {a.id for a in incumbent}
                    ],
                )
            ],
        )

    courses_by_id: dict[str, CourseInput] = {c.courseId: c for c in req.courses}
    sections_by_id: dict[str, SectionInput] = {s.id: s for s in req.sections}
    reqs_by_section: dict[str, list[RequiredSessionInput]] = defaultdict(list)
    for r in req.requirements:
        reqs_by_section[r.sectionId].append(r)
    for s_reqs in reqs_by_section.values():
        s_reqs.sort(key=lambda r: r.order)

    # Validate profile upfront if present
    resolve_planning_time_profile(req.planningPolicy)

    has_policy = req.planningPolicy is not None
    teachers_by_course: dict[str, list[TeacherInput]] = {
        c.courseId: [
            t
            for t in req.teachers
            if is_eligible_for_course(t, c.courseId, has_policy)
        ]
        for c in req.courses
    }

    precheck_diagnostics: list[DiagnosticOutput] = []
    excluded_sections: set[str] = set()

    for course in req.courses:
        if time.monotonic() >= deadline:
            return generation_timeout()
        c_sections = [
            s for s in req.sections if s.courseId == course.courseId
        ]
        if not c_sections:
            continue
        c_reqs = [
            r for r in req.requirements if r.courseId == course.courseId
        ]
        eligible_teachers = teachers_by_course.get(course.courseId, [])
        minutes = sum(ws.durationMinutes for ws in course.weeklySessions)

        def exclude_secs(sec_ids: list[str], code: str, message: str) -> None:
            if not sec_ids:
                return
            excluded_sections.update(sec_ids)
            s_set = set(sec_ids)
            precheck_diagnostics.append(
                DiagnosticOutput(
                    code=code,
                    message=message,
                    sessionIds=[r.id for r in c_reqs if r.sectionId in s_set],
                )
            )

        if not eligible_teachers:
            exclude_secs(
                [s.id for s in c_sections],
                "NO_QUALIFIED_TEACHER",
                f"{course.courseId} requiere {len(c_sections)} secciones de {minutes} min; hay 0 docentes habilitados",
            )
            continue

        if course.teacherAssignmentMode == "single-teacher-section":
            total_cap = 0
            for t in eligible_teachers:
                cap_limit = next(
                    (
                        lim.maxSections
                        for lim in (t.sectionLimits or [])
                        if lim.courseId == course.courseId
                    ),
                    None,
                )
                by_mins = t.maxWeeklyMinutes // minutes if minutes > 0 else len(c_sections)
                total_cap += (
                    min(by_mins, cap_limit)
                    if cap_limit is not None
                    else min(by_mins, len(c_sections))
                )

            if total_cap < len(c_sections):
                avail_sum = sum(t.maxWeeklyMinutes for t in eligible_teachers)
                exclude_secs(
                    [s.id for s in c_sections[total_cap:]],
                    "TEACHER_CAPACITY_SHORTFALL",
                    f"{course.courseId} requiere {len(c_sections)} secciones de {minutes} min; los docentes habilitados cubren {total_cap} ({avail_sum} min disponibles)",
                )
        else:
            sample_groups = get_section_component_groups(
                reqs_by_section[c_sections[0].id], course.teacherAssignmentMode
            )
            min_group_dur = min(
                (sum(r.durationMinutes for r in grp) for grp in sample_groups),
                default=0,
            )
            usable_minutes = 0
            for t in eligible_teachers:
                if t.maxWeeklyMinutes < min_group_dur:
                    continue
                cap_limit = next(
                    (
                        lim.maxSections
                        for lim in (t.sectionLimits or [])
                        if lim.courseId == course.courseId
                    ),
                    None,
                )
                usable_minutes += (
                    min(t.maxWeeklyMinutes, cap_limit * minutes)
                    if cap_limit is not None
                    else t.maxWeeklyMinutes
                )
            coverable_partial = (
                math.ceil(usable_minutes / minutes)
                if minutes > 0
                else len(c_sections)
            )
            if coverable_partial < len(c_sections):
                avail_sum = sum(t.maxWeeklyMinutes for t in eligible_teachers)
                exclude_secs(
                    [s.id for s in c_sections[coverable_partial:]],
                    "TEACHER_CAPACITY_SHORTFALL",
                    f"{course.courseId} requiere {len(c_sections)} secciones de {minutes} min; la capacidad combinada por componente alcanza hasta {coverable_partial} ({avail_sum} min disponibles)",
                )

        for sec in c_sections:
            if sec.id in excluded_sections:
                continue
            s_reqs = reqs_by_section[sec.id]
            has_rooms = all(
                any(
                    rm.capacity >= sec.capacity
                    and (
                        not has_policy
                        or r.type != "L"
                        or rm.kind == "laboratory"
                    )
                    for rm in req.rooms
                )
                for r in s_reqs
            )
            if not has_rooms:
                exclude_secs(
                    [sec.id],
                    "NO_COMPATIBLE_ROOM",
                    f"{course.courseId}, sección {sec.id}: 0 ambientes compatibles para {sec.capacity} plazas y los tipos requeridos",
                )
                continue
            groups = get_section_component_groups(
                s_reqs, course.teacherAssignmentMode
            )
            blocks = (
                [r.durationMinutes for r in s_reqs]
                if course.deliveryMode == "split"
                else [sum(r.durationMinutes for r in grp) for grp in groups]
            )
            has_window = all(
                any(
                    any(
                        planning_time_rank(
                            course.cycle,
                            start,
                            w.day,
                            dur,
                            req.planningPolicy,
                        )
                        is not None
                        for start in range(
                            w.startMinute,
                            w.endMinute - dur + 1,
                            req.startStepMinutes,
                        )
                    )
                    for w in req.windows
                )
                for dur in blocks
            )
            if not has_window:
                b_str = "/".join(str(b) for b in blocks)
                exclude_secs(
                    [sec.id],
                    "NO_SCHEDULING_WINDOW",
                    f"{course.courseId}, sección {sec.id}: 0 franjas para bloques de {b_str} min",
                )

    teachers_by_id = {t.id: t for t in req.teachers}

    availability_keys = {}
    for kind, resources in [("teacher", req.teachers), ("room", req.rooms)]:
        for resource in resources:
            merged = []
            for w in sorted(
                resource.availability, key=lambda w: (w.day, w.startMinute)
            ):
                if (
                    merged
                    and merged[-1][0] == w.day
                    and merged[-1][2] >= w.startMinute
                ):
                    d, start, end = merged[-1]
                    merged[-1] = (d, start, max(end, w.endMinute))
                else:
                    merged.append((w.day, w.startMinute, w.endMinute))
            availability_keys[kind, resource.id] = tuple(merged)

    @lru_cache(maxsize=None)
    def covers_calendar(calendar, day, start, end):
        return any(
            d == day and begin <= start and end <= finish
            for d, begin, finish in calendar
        )

    def covers(kind, resource_id, day, start, end):
        return covers_calendar(
            availability_keys[kind, resource_id], day, start, end
        )

    @lru_cache(maxsize=None)
    def rooms_for(capacity, session_type, day, start, end):
        return tuple(
            r
            for r in req.rooms
            if r.capacity >= capacity
            and (not has_policy or session_type != "L" or r.kind == "laboratory")
            and covers("room", r.id, day, start, end)
        )

    @lru_cache(maxsize=None)
    def slots_for(cycle, duration):
        slots = set()
        for w in req.windows:
            for start in range(
                w.startMinute, w.endMinute - duration + 1, req.startStepMinutes
            ):
                rank = planning_time_rank(
                    cycle, start, w.day, duration, req.planningPolicy
                )
                if rank is not None:
                    slots.add((rank, w.day, start))
        by_day = defaultdict(list)
        for slot in sorted(slots):
            by_day[slot[1]].append(slot)
        return tuple(
            slot
            for i in range(max(map(len, by_day.values()), default=0))
            for day in sorted(by_day)
            if i < len(by_day[day])
            for slot in [by_day[day][i]]
        )

    def option_bonus(
        teacher: TeacherInput, day: int, start: int, end: int, rank: int
    ) -> int:
        if req.allocationPolicy == "first-feasible":
            return 1
        in_pref = bool(
            teacher.preferences
            and availability_covers(teacher.preferences, day, start, end)
        )
        if req.allocationPolicy == "balanced":
            return 4 if in_pref else (2 if rank == 0 else 1)
        return 20 if in_pref else (5 if rank == 0 else 1)

    # Track incumbent placements keyed by (sectionId, groupIndex) so CP-SAT can repair individual groups.
    incumbent_group_records: list[tuple[str, int, str, list[AssignmentOutput]]] = []

    if len(req.sections) >= 32:
        occupied = defaultdict(int)
        loads = defaultdict(int)
        counts = defaultdict(int)
        teacher_section_group_count: dict[tuple[str, str], int] = defaultdict(int)
        construction_deadline = min(
            deadline, time.monotonic() + req.maxTimeSeconds * 0.2
        )

        def record_masks(
            sec: SectionInput, tid: str, placements: list[AssignmentOutput]
        ) -> list[tuple[tuple, int]]:
            cohort = (
                (sec.cycle, sec.ordinal)
                if has_policy and sec.cycle is not None and sec.ordinal is not None
                else None
            )
            entries: list[tuple[tuple, int]] = []
            for a in placements:
                dur = a.interval.endMinute - a.interval.startMinute
                mask = ((1 << dur) - 1) << a.interval.startMinute
                day = a.interval.day
                entries.append((("teacher", tid, day), mask))
                entries.append((("section", sec.id, day), mask))
                entries.append((("room", a.roomId, day), mask))
                if cohort is not None:
                    entries.append((("cohort", cohort, day), mask))
            return entries

        def commit_record(
            sec: SectionInput,
            g_idx: int,
            tid: str,
            placements: list[AssignmentOutput],
            local: dict[tuple, int],
        ) -> None:
            incumbent_group_records.append((sec.id, g_idx, tid, placements))
            loads[tid] += sum(
                a.interval.endMinute - a.interval.startMinute for a in placements
            )
            if teacher_section_group_count[tid, sec.id] == 0:
                counts[tid, sec.courseId] += 1
            teacher_section_group_count[tid, sec.id] += 1
            for key, mask in local.items():
                occupied[key] |= mask

        def remove_record(
            idx: int,
        ) -> tuple[SectionInput, int, str, list[AssignmentOutput], dict[tuple, int]]:
            sid, g_idx, tid, placements = incumbent_group_records.pop(idx)
            sec = sections_by_id[sid]
            loads[tid] -= sum(
                a.interval.endMinute - a.interval.startMinute for a in placements
            )
            teacher_section_group_count[tid, sid] -= 1
            if teacher_section_group_count[tid, sid] == 0:
                counts[tid, sec.courseId] -= 1
            local: dict[tuple, int] = defaultdict(int)
            for key, mask in record_masks(sec, tid, placements):
                occupied[key] &= ~mask
                local[key] |= mask
            return sec, g_idx, tid, placements, local

        def try_place_group(
            sec: SectionInput,
            group_reqs: list[RequiredSession],
            teacher: TeacherInput,
        ) -> tuple[list[AssignmentOutput], dict[tuple, int]] | None:
            course = courses_by_id[sec.courseId]
            group_duration = sum(r.durationMinutes for r in group_reqs)
            if loads[teacher.id] + group_duration > teacher.maxWeeklyMinutes:
                return None
            already_in_sec = teacher_section_group_count[teacher.id, sec.id] > 0
            limit = next(
                (
                    lim.maxSections
                    for lim in (teacher.sectionLimits or [])
                    if lim.courseId == sec.courseId
                ),
                None,
            )
            if (
                not already_in_sec
                and limit is not None
                and counts[teacher.id, sec.courseId] >= limit
            ):
                return None
            cohort = (
                (sec.cycle, sec.ordinal)
                if has_policy and sec.cycle is not None and sec.ordinal is not None
                else None
            )
            blocks = (
                [[r] for r in group_reqs]
                if (course.deliveryMode == "split" and len(group_reqs) > 1)
                else [group_reqs]
            )
            local: dict[tuple, int] = defaultdict(int)
            placements: list[AssignmentOutput] = []
            nonlocal incumbent_visits
            for block in blocks:
                block_duration = sum(r.durationMinutes for r in block)
                found = False
                for _rank, day, start in slots_for(course.cycle, block_duration):
                    incumbent_visits += 1
                    if time.monotonic() >= construction_deadline:
                        break
                    mask = ((1 << block_duration) - 1) << start
                    keys = [
                        ("teacher", teacher.id, day),
                        ("section", sec.id, day),
                    ]
                    if cohort is not None:
                        keys.append(("cohort", cohort, day))
                    if any((occupied[k] | local[k]) & mask for k in keys):
                        continue
                    if not covers(
                        "teacher", teacher.id, day, start, start + block_duration
                    ):
                        continue
                    chosen = []
                    cur = start
                    for r in block:
                        end = cur + r.durationMinutes
                        rmask = ((1 << r.durationMinutes) - 1) << cur
                        room = next(
                            (
                                room
                                for room in rooms_for(
                                    sec.capacity, r.type, day, cur, end
                                )
                                if not (
                                    occupied["room", room.id, day]
                                    | local["room", room.id, day]
                                )
                                & rmask
                            ),
                            None,
                        )
                        if room is None:
                            break
                        chosen.append((r, cur, end, room.id, rmask))
                        cur = end
                    if len(chosen) != len(block):
                        continue
                    for key in keys:
                        local[key] |= mask
                    for r, begin, end, room_id, rmask in chosen:
                        local["room", room_id, day] |= rmask
                        placements.append(
                            AssignmentOutput(
                                id=r.id,
                                sectionId=sec.id,
                                teacherId=teacher.id,
                                roomId=room_id,
                                interval=TimeInterval(
                                    day=day, startMinute=begin, endMinute=end
                                ),
                                sessionType=r.type,
                            )
                        )
                    found = True
                    break
                if not found:
                    return None
            return (
                (placements, local)
                if len(placements) == len(group_reqs) and group_reqs
                else None
            )

        ordered = sorted(
            req.sections,
            key=lambda sec: (
                len(teachers_by_course.get(sec.courseId, [])),
                -sum(r.durationMinutes for r in reqs_by_section[sec.id]),
                -(sec.cycle or 0),
                sec.ordinal or 0,
                sec.id,
            ),
        )
        missing_groups: list[tuple[SectionInput, int, list[RequiredSession]]] = []
        for sec in ordered:
            if time.monotonic() >= construction_deadline:
                break
            if sec.id in excluded_sections:
                continue
            course = courses_by_id[sec.courseId]
            items = reqs_by_section[sec.id]
            groups = get_section_component_groups(
                items, course.teacherAssignmentMode
            )
            for g_idx, group_reqs in enumerate(groups):
                placed = False
                for teacher in sorted(
                    teachers_by_course[sec.courseId],
                    key=lambda t: (loads[t.id], t.id),
                ):
                    attempt = try_place_group(sec, group_reqs, teacher)
                    if attempt is not None:
                        placements, local = attempt
                        commit_record(sec, g_idx, teacher.id, placements, local)
                        placed = True
                        break
                if not placed and group_reqs:
                    missing_groups.append((sec, g_idx, group_reqs))

        # Bounded 1-ejection repair pass for any leftover component groups
        for sec, g_idx, group_reqs in missing_groups:
            if time.monotonic() >= construction_deadline:
                break
            repaired = False
            pool_ids = {t.id for t in teachers_by_course[sec.courseId]}
            for teacher in sorted(
                teachers_by_course[sec.courseId],
                key=lambda t: (loads[t.id], t.id),
            ):
                attempt = try_place_group(sec, group_reqs, teacher)
                if attempt is not None:
                    placements, local = attempt
                    commit_record(sec, g_idx, teacher.id, placements, local)
                    repaired = True
                    break
            if repaired:
                continue
            for idx in range(len(incumbent_group_records)):
                if time.monotonic() >= construction_deadline:
                    break
                other_sid, _og, other_tid, _op = incumbent_group_records[idx]
                if other_tid not in pool_ids and other_sid != sec.id:
                    continue
                other_sec, other_g_idx, old_tid, old_placements, old_local = (
                    remove_record(idx)
                )
                other_course = courses_by_id[other_sec.courseId]
                other_groups = get_section_component_groups(
                    reqs_by_section[other_sec.id],
                    other_course.teacherAssignmentMode,
                )
                other_reqs = other_groups[other_g_idx]
                placed_target = False
                for teacher in sorted(
                    teachers_by_course[sec.courseId],
                    key=lambda t: (loads[t.id], t.id),
                ):
                    attempt = try_place_group(sec, group_reqs, teacher)
                    if attempt is None:
                        continue
                    t_placements, t_local = attempt
                    commit_record(sec, g_idx, teacher.id, t_placements, t_local)
                    placed_other = False
                    for other_t in sorted(
                        teachers_by_course[other_sec.courseId],
                        key=lambda t: (t.id == old_tid, loads[t.id], t.id),
                    ):
                        other_attempt = try_place_group(
                            other_sec, other_reqs, other_t
                        )
                        if other_attempt is not None:
                            o_placements, o_local = other_attempt
                            commit_record(
                                other_sec,
                                other_g_idx,
                                other_t.id,
                                o_placements,
                                o_local,
                            )
                            placed_other = True
                            break
                    if placed_other:
                        placed_target = True
                        break
                    remove_record(len(incumbent_group_records) - 1)
                if placed_target:
                    repaired = True
                    break
                commit_record(
                    other_sec, other_g_idx, old_tid, old_placements, old_local
                )
                incumbent_group_records.insert(idx, incumbent_group_records.pop())

        for _sid, _g_idx, _tid, placed in incumbent_group_records:
            incumbent.extend(placed)

    model = cp_model.CpModel()

    bucket_minutes = max(1, req.startStepMinutes)
    for w in req.windows:
        bucket_minutes = math.gcd(bucket_minutes, w.startMinute)
    for r in req.requirements:
        bucket_minutes = math.gcd(bucket_minutes, r.durationMinutes)

    MAX_PLACEMENTS_PER_TEACHER_SECTION = 32

    # Keyed by (section_id, group_idx)
    group_options: dict[tuple[str, int], list[tuple]] = defaultdict(list)
    teacher_options: dict[
        str, list[tuple[cp_model.IntVar, int, str, str]]
    ] = defaultdict(list)
    room_slot_vars: dict[tuple[str, int, int], list[cp_model.IntVar]] = (
        defaultdict(list)
    )
    teacher_slot_vars: dict[tuple[str, int, int], list[cp_model.IntVar]] = (
        defaultdict(list)
    )
    section_slot_vars: dict[tuple[str, int, int], list[cp_model.IntVar]] = (
        defaultdict(list)
    )
    cohort_slot_vars: dict[
        tuple[int, int, int, int], list[cp_model.IntVar]
    ] = defaultdict(list)

    split_components: list[tuple] = []
    candidates_truncated = False
    candidate_visits = 0
    has_incumbent = bool(incumbent_group_records)
    incumbent_loads: dict[str, int] = defaultdict(int)
    incumbent_teacher_sections: set[tuple[str, str]] = set()

    for sid, g_idx, tid, placed in incumbent_group_records:
        if time.monotonic() >= deadline:
            return generation_timeout()
        sec = sections_by_id[sid]
        teacher = teachers_by_id[tid]
        duration = sum(
            a.interval.endMinute - a.interval.startMinute for a in placed
        )
        var = model.new_bool_var(f"incumbent_{sid}_{g_idx}")
        placements = [
            (
                a.id,
                a.interval.day,
                a.interval.startMinute,
                a.interval.endMinute,
                a.roomId,
                a.sessionType,
            )
            for a in placed
        ]
        group_options[sid, g_idx].append(
            (var, sid, tid, placements, 1, duration, len(placed))
        )
        teacher_options[tid].append((var, duration, sec.courseId, sid))
        incumbent_loads[tid] += duration
        incumbent_teacher_sections.add((tid, sid))
        model.add_hint(var, 1)
        for a in placed:
            w = a.interval
            for bucket in range(
                w.startMinute // bucket_minutes, w.endMinute // bucket_minutes
            ):
                teacher_slot_vars[tid, w.day, bucket].append(var)
                room_slot_vars[a.roomId, w.day, bucket].append(var)
                section_slot_vars[sid, w.day, bucket].append(var)
                if (
                    has_policy
                    and sec.cycle is not None
                    and sec.ordinal is not None
                ):
                    cohort_slot_vars[
                        sec.cycle, sec.ordinal, w.day, bucket
                    ].append(var)

    for sec_idx, sec in enumerate(req.sections):
        if time.monotonic() >= deadline:
            return generation_timeout()
        if sec.id in excluded_sections:
            continue
        course = courses_by_id[sec.courseId]
        s_reqs = reqs_by_section[sec.id]
        if not s_reqs:
            continue
        eligible_teachers = teachers_by_course.get(sec.courseId, [])
        groups = get_section_component_groups(
            s_reqs, course.teacherAssignmentMode
        )

        for g_idx, group_reqs in enumerate(groups):
            group_duration = sum(r.durationMinutes for r in group_reqs)
            is_split_group = course.deliveryMode == "split" and len(group_reqs) > 1

            base_interleaved_slots = list(slots_for(course.cycle, group_duration))
            split_slots_by_req = (
                {
                    r.id: slots_for(course.cycle, r.durationMinutes)
                    for r in group_reqs
                }
                if is_split_group
                else {}
            )

            for t_idx, teacher in enumerate(eligible_teachers):
                if teacher.maxWeeklyMinutes < group_duration:
                    continue
                placed_for_teacher = 0
                if base_interleaved_slots:
                    rot = (sec_idx + g_idx * 5 + t_idx * 11) % len(
                        base_interleaved_slots
                    )
                    interleaved_slots = (
                        base_interleaved_slots[rot:]
                        + base_interleaved_slots[:rot]
                    )
                else:
                    interleaved_slots = []

                if is_split_group:
                    teacher_grp = model.new_bool_var(
                        f"teacher_{sec.id}_{g_idx}_{teacher.id}"
                    )
                    if has_incumbent:
                        model.add_hint(teacher_grp, 0)
                    group_options[sec.id, g_idx].append(
                        (
                            teacher_grp,
                            sec.id,
                            teacher.id,
                            [],
                            0,
                            group_duration,
                            len(group_reqs),
                        )
                    )
                    teacher_options[teacher.id].append(
                        (teacher_grp, group_duration, sec.courseId, sec.id)
                    )
                    for r_idx, r in enumerate(group_reqs):
                        component_vars = []
                        component_count = 0
                        component_slots = split_slots_by_req[r.id]
                        rot = (sec_idx + g_idx * 3 + r_idx * 7 + t_idx) % max(
                            1, len(component_slots)
                        )
                        component_slots = (
                            component_slots[rot:] + component_slots[:rot]
                        )
                        for rank, day, start in component_slots:
                            if (
                                component_count
                                >= MAX_PLACEMENTS_PER_TEACHER_SECTION
                            ):
                                candidates_truncated = True
                                break
                            if time.monotonic() >= deadline:
                                return generation_timeout()
                            end = start + r.durationMinutes
                            if not covers("teacher", teacher.id, day, start, end):
                                continue
                            compatible = rooms_for(
                                sec.capacity, r.type, day, start, end
                            )
                            candidate_visits += 1
                            if len(compatible) > 1:
                                candidates_truncated = True
                            if compatible:
                                room = compatible[
                                    (
                                        sec_idx
                                        + g_idx
                                        + t_idx
                                        + r_idx
                                        + component_count
                                    )
                                    % len(compatible)
                                ]
                                component_count += 1
                                var = model.new_bool_var(
                                    f"component_{sec.id}_{g_idx}_{teacher.id}_{r.id}_{day}_{start}_{room.id}"
                                )
                                if has_incumbent:
                                    model.add_hint(var, 0)
                                component_vars.append(var)
                                placement = (
                                    r.id,
                                    day,
                                    start,
                                    end,
                                    room.id,
                                    r.type,
                                )
                                bonus = option_bonus(
                                    teacher, day, start, end, rank
                                )
                                split_components.append(
                                    (var, sec.id, teacher.id, placement, bonus)
                                )
                                for bucket in range(
                                    start // bucket_minutes,
                                    end // bucket_minutes,
                                ):
                                    teacher_slot_vars[
                                        (teacher.id, day, bucket)
                                    ].append(var)
                                    room_slot_vars[(room.id, day, bucket)].append(
                                        var
                                    )
                                    section_slot_vars[
                                        (sec.id, day, bucket)
                                    ].append(var)
                                    if (
                                        has_policy
                                        and sec.cycle is not None
                                        and sec.ordinal is not None
                                    ):
                                        cohort_slot_vars[
                                            (sec.cycle, sec.ordinal, day, bucket)
                                        ].append(var)
                        model.add(sum(component_vars) == teacher_grp)
                    continue

                for rank, day, start in interleaved_slots:
                    if time.monotonic() >= deadline:
                        return generation_timeout()
                    if placed_for_teacher >= MAX_PLACEMENTS_PER_TEACHER_SECTION:
                        candidates_truncated = True
                        break
                    candidate_visits += 1
                    if not covers(
                        "teacher",
                        teacher.id,
                        day,
                        start,
                        start + group_duration,
                    ):
                        continue

                    comp_placements: list[
                        tuple[str, int, int, int, str, str | None]
                    ] = []
                    cur = start
                    possible = True
                    for r_idx, r in enumerate(group_reqs):
                        c_start, c_end = cur, cur + r.durationMinutes
                        cur = c_end
                        compat_rooms = rooms_for(
                            sec.capacity, r.type, day, c_start, c_end
                        )
                        if len(compat_rooms) > 1:
                            candidates_truncated = True
                        if not compat_rooms:
                            possible = False
                            break
                        chosen_room = compat_rooms[
                            (
                                sec_idx
                                + g_idx
                                + placed_for_teacher
                                + t_idx
                                + r_idx
                            )
                            % len(compat_rooms)
                        ]
                        comp_placements.append(
                            (
                                r.id,
                                day,
                                c_start,
                                c_end,
                                chosen_room.id,
                                r.type,
                            )
                        )
                    if not possible:
                        continue

                    pref_bonus = option_bonus(
                        teacher, day, start, start + group_duration, rank
                    )

                    var = model.new_bool_var(
                        f"opt_{sec.id}_{g_idx}_{teacher.id}_{day}_{start}_{placed_for_teacher}"
                    )
                    if has_incumbent:
                        model.add_hint(var, 0)
                    opt_tuple = (
                        var,
                        sec.id,
                        teacher.id,
                        comp_placements,
                        pref_bonus,
                        group_duration,
                        len(group_reqs),
                    )
                    group_options[sec.id, g_idx].append(opt_tuple)
                    teacher_options[teacher.id].append(
                        (var, group_duration, sec.courseId, sec.id)
                    )

                    for (
                        _req_id,
                        c_day,
                        c_start,
                        c_end,
                        rm_id,
                        _stype,
                    ) in comp_placements:
                        for bucket in range(
                            c_start // bucket_minutes, c_end // bucket_minutes
                        ):
                            teacher_slot_vars[(teacher.id, c_day, bucket)].append(
                                var
                            )
                            room_slot_vars[(rm_id, c_day, bucket)].append(var)
                            section_slot_vars[(sec.id, c_day, bucket)].append(
                                var
                            )
                            if (
                                has_policy
                                and sec.cycle is not None
                                and sec.ordinal is not None
                            ):
                                cohort_slot_vars[
                                    (sec.cycle, sec.ordinal, c_day, bucket)
                                ].append(var)

                    placed_for_teacher += 1

    # 1. At most 1 option per component group
    for opts in group_options.values():
        if time.monotonic() >= deadline:
            return generation_timeout()
        model.add_at_most_one(o[0] for o in opts)

    # 2. Exact common-grid occupancy for teacher, room, section and cohort
    for slot_map in (
        teacher_slot_vars,
        room_slot_vars,
        section_slot_vars,
        cohort_slot_vars,
    ):
        for vars_in_bucket in slot_map.values():
            if time.monotonic() >= deadline:
                return generation_timeout()
            if len(vars_in_bucket) > 1:
                model.add_at_most_one(
                    list({v.index: v for v in vars_in_bucket}.values())
                )

    # 3. Teacher weekly minute limit & exact unique-section course limit
    teacher_load_vars: list[cp_model.IntVar] = []
    max_teacher_cap = 0
    for t_id, t_opts in teacher_options.items():
        teacher = teachers_by_id[t_id]
        load_expr = sum(var * dur for var, dur, _cid, _sid in t_opts)
        model.add(load_expr <= teacher.maxWeeklyMinutes)
        if req.allocationPolicy == "balanced" and t_opts:
            max_teacher_cap = max(max_teacher_cap, teacher.maxWeeklyMinutes)
            t_load = model.new_int_var(
                0, teacher.maxWeeklyMinutes, f"load_{t_id}"
            )
            model.add(t_load == load_expr)
            if has_incumbent:
                model.add_hint(t_load, incumbent_loads[t_id])
            teacher_load_vars.append(t_load)

        for lim in teacher.sectionLimits or []:
            by_sec: dict[str, list[cp_model.IntVar]] = defaultdict(list)
            for var, _dur, cid, sid in t_opts:
                if cid == lim.courseId:
                    by_sec[sid].append(var)
            if by_sec:
                sec_indicators: list[cp_model.IntVar] = []
                for sid, s_vars in by_sec.items():
                    sec = sections_by_id[sid]
                    course = courses_by_id[sec.courseId]
                    if course.teacherAssignmentMode == "single-teacher-section":
                        sec_indicators.extend(s_vars)
                    else:
                        used_sec = model.new_bool_var(
                            f"tsec_{t_id}_{lim.courseId}_{sid}"
                        )
                        if has_incumbent:
                            model.add_hint(
                                used_sec,
                                1 if (t_id, sid) in incumbent_teacher_sections else 0,
                            )
                        for v in s_vars:
                            model.add(used_sec >= v)
                        sec_indicators.append(used_sec)
                model.add(sum(sec_indicators) <= lim.maxSections)

    # Objective: lexicographically prioritize total scheduled sessions (weight 100000 per session)
    # + policy-specific preference / load-balance term.
    SESSION_WEIGHT = 100_000
    objective_terms = []
    for opts in group_options.values():
        for (
            var,
            _sid,
            _tid,
            _placements,
            pref_bonus,
            _dur,
            num_sessions,
        ) in opts:
            objective_terms.append(
                var * (num_sessions * SESSION_WEIGHT + pref_bonus)
            )
    if req.allocationPolicy != "first-feasible":
        for var, _sid, _tid, _placement, bonus in split_components:
            objective_terms.append(var * bonus)
    if req.allocationPolicy == "balanced" and teacher_load_vars and max_teacher_cap > 0:
        max_load = model.new_int_var(0, max_teacher_cap, "max_teacher_load")
        if has_incumbent:
            model.add_hint(max_load, max(incumbent_loads.values(), default=0))
        for t_load in teacher_load_vars:
            model.add(max_load >= t_load)
        objective_terms.append(-5 * max_load)

    if objective_terms:
        model.maximize(sum(objective_terms))

    solver = cp_model.CpSolver()
    if time.monotonic() >= deadline:
        return generation_timeout()
    solver.parameters.max_time_in_seconds = max(
        0.001, deadline - time.monotonic() - min(0.05, req.maxTimeSeconds * 0.1)
    )
    solver.parameters.num_search_workers = 4
    status_code = solver.solve(model)

    if status_code == cp_model.MODEL_INVALID:
        raise ValueError("Invalid CP-SAT model")

    assignments: list[AssignmentOutput] = []
    if status_code in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for opts in group_options.values():
            for (
                var,
                sec_id,
                t_id,
                placements,
                _pref,
                _dur,
                _ns,
            ) in opts:
                if solver.value(var) == 1:
                    for (
                        req_id,
                        c_day,
                        c_start,
                        c_end,
                        rm_id,
                        stype,
                    ) in placements:
                        assignments.append(
                            AssignmentOutput(
                                id=req_id,
                                sectionId=sec_id,
                                teacherId=t_id,
                                roomId=rm_id,
                                interval=TimeInterval(
                                    day=c_day,
                                    startMinute=c_start,
                                    endMinute=c_end,
                                ),
                                sessionType=stype,
                            )
                        )
                    break

    if status_code in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for var, sec_id, t_id, placement, _bonus in split_components:
            if solver.value(var):
                req_id, day, start, end, room_id, stype = placement
                assignments.append(
                    AssignmentOutput(
                        id=req_id,
                        sectionId=sec_id,
                        teacherId=t_id,
                        roomId=room_id,
                        interval=TimeInterval(
                            day=day, startMinute=start, endMinute=end
                        ),
                        sessionType=stype,
                    )
                )

    used_incumbent = len(incumbent) > len(assignments)
    if used_incumbent:
        assignments = incumbent
        candidates_truncated = True

    assigned_ids = {a.id for a in assignments}
    missing_ids = [r.id for r in req.requirements if r.id not in assigned_ids]
    complete = len(missing_ids) == 0

    diagnostics: list[DiagnosticOutput] = []
    if complete:
        status_str = "complete"
        diagnostics.append(
            DiagnosticOutput(
                code="COMPLETE",
                message=(
                    "Todas las sesiones requeridas están programadas (construcción factible)"
                    if used_incumbent
                    else "Todas las sesiones requeridas están programadas y validadas (OR-Tools CP-SAT)"
                ),
                sessionIds=[],
            )
        )
    else:
        status_str = (
            "search-limit"
            if status_code in (cp_model.UNKNOWN, cp_model.FEASIBLE)
            or candidates_truncated
            else "impossible"
        )
        diagnostics.append(
            DiagnosticOutput(
                code="PARTIAL_PROPOSAL",
                message="Quedan sesiones sin programar en esta ejecución CP-SAT; consultar el estado y límite de búsqueda antes de concluir imposibilidad.",
                sessionIds=missing_ids,
            )
        )
    diagnostics.extend(precheck_diagnostics)

    return SolveScheduleResponse(
        status=status_str,  # type: ignore[arg-type]
        assignments=assignments,
        exploredCandidates=int(solver.num_booleans),
        candidateVisits=max(candidate_visits, int(solver.num_branches)),
        backtracks=int(solver.num_conflicts),
        limitReason=(
            "time"
            if not complete
            and status_code in (cp_model.UNKNOWN, cp_model.FEASIBLE)
            else "explorations"
            if not complete and candidates_truncated
            else None
        ),
        diagnostics=diagnostics,
    )
