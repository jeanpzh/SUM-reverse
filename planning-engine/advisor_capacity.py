"""Free-slot screen: which pending sections fit in today's gaps without moving anything.

Each pending section is checked on its own against the current assignments, using the
solver's placement rules (time ranks, availability, eligibility, cohorts, room kind and
capacity, section limits, one responsible teacher per section). The result names the
lever each fit needs. It is a screen of candidate gaps, not an impact measure: CP-SAT
regenerates the whole schedule and remains the only source of measured impact.
"""
from __future__ import annotations

from collections import defaultdict
from itertools import groupby
from typing import Literal

from pydantic import BaseModel

from models import AdvisorAnalyzeRequest, PlanningPolicyInput
from solver import availability_covers, is_eligible_for_course, planning_time_rank

WindowLever = Literal["afternoon", "saturday"]
SlotBand = Literal["mañana", "tarde", "noche"]
SlotRoomKind = Literal["classroom", "laboratory"]

DAY_NAMES = {1: "lunes", 2: "martes", 3: "miércoles", 4: "jueves", 5: "viernes", 6: "sábado", 7: "domingo"}
BAND_NAMES = {"mañana": "mañana", "tarde": "tarde", "noche": "noche"}
ROOM_KIND_NAMES = {"classroom": "aula", "laboratory": "laboratorio"}
WINDOW_LEVER_NAMES = {"afternoon": "la tarde", "saturday": "el sábado"}
_LEVER_SETS: tuple[frozenset[str], ...] = (
    frozenset(),
    frozenset({"afternoon"}),
    frozenset({"saturday"}),
    frozenset({"afternoon", "saturday"}),
)


class FreeSlot(BaseModel):
    day: int
    band: SlotBand
    roomKind: SlotRoomKind


class SectionFreeSlotFit(BaseModel):
    sectionId: str
    courseId: str
    sessionCount: int
    totalMinutes: int
    windowLevers: list[WindowLever]
    needsTeacherLoad: bool
    slots: list[FreeSlot]


class FreeSlotScreen(BaseModel):
    fits: list[SectionFreeSlotFit]
    unfitSectionIds: list[str]

    @property
    def fitSessionCount(self) -> int:
        return sum(fit.sessionCount for fit in self.fits)


def _band(start: int) -> SlotBand:
    if start < 780:
        return "mañana"
    if start < 1080:
        return "tarde"
    return "noche"


def _overlaps(busy: list[tuple[int, int]], start: int, end: int) -> bool:
    return any(begin < end and start < finish for begin, finish in busy)


def _window_lever(
    policy: PlanningPolicyInput | None, cycle: int | None, day: int, start: int, duration: int
) -> WindowLever | None | Literal[False]:
    """None when the slot is allowed today, the lever that opens it, or False if none does."""
    if planning_time_rank(cycle, start, day, duration, policy) is not None:
        return None
    if policy is None:
        return False
    if not policy.allowAfternoon and planning_time_rank(
        cycle, start, day, duration, policy.model_copy(update={"allowAfternoon": True})
    ) is not None:
        return "afternoon"
    if not policy.allowSaturday and planning_time_rank(
        cycle, start, day, duration, policy.model_copy(update={"allowSaturday": True})
    ) is not None:
        return "saturday"
    return False


def screen_free_slots(req: AdvisorAnalyzeRequest) -> FreeSlotScreen:
    if not req.pending:
        return FreeSlotScreen(fits=[], unfitSectionIds=[])

    has_policy = req.planningPolicy is not None
    sections_by_id = {s.id: s for s in req.sections}
    courses_by_id = {c.courseId: c for c in req.courses}
    reqs_by_id = {r.id: r for r in req.requirements}

    teacher_busy: dict[tuple[str, int], list[tuple[int, int]]] = defaultdict(list)
    room_busy: dict[tuple[str, int], list[tuple[int, int]]] = defaultdict(list)
    cohort_busy: dict[tuple[int, int, int], list[tuple[int, int]]] = defaultdict(list)
    section_busy: dict[tuple[str, int], list[tuple[int, int]]] = defaultdict(list)
    teacher_load: dict[str, int] = defaultdict(int)
    teacher_sections: dict[tuple[str, str], set[str]] = defaultdict(set)
    for a in req.assignments:
        iv = (a.interval.startMinute, a.interval.endMinute)
        teacher_busy[a.teacherId, a.interval.day].append(iv)
        room_busy[a.roomId, a.interval.day].append(iv)
        section_busy[a.sectionId, a.interval.day].append(iv)
        teacher_load[a.teacherId] += iv[1] - iv[0]
        sec = sections_by_id.get(a.sectionId)
        if sec is not None:
            teacher_sections[a.teacherId, sec.courseId].add(sec.id)
            if has_policy and sec.cycle is not None and sec.ordinal is not None:
                cohort_busy[sec.cycle, sec.ordinal, a.interval.day].append(iv)

    pending_sorted = sorted(req.pending, key=lambda item: item.sectionId)
    fits: list[SectionFreeSlotFit] = []
    unfit: list[str] = []
    for section_id, items_iter in groupby(pending_sorted, key=lambda item: item.sectionId):
        items = list(items_iter)
        sec = sections_by_id.get(section_id)
        course = courses_by_id.get(items[0].courseId)
        if sec is None or course is None:
            unfit.append(section_id)
            continue
        ordered = sorted(items, key=lambda item: reqs_by_id[item.sessionId].order if item.sessionId in reqs_by_id else 0)
        blocks = [[item] for item in ordered] if course.deliveryMode == "split" else [ordered]
        total = sum(item.durationMinutes for item in ordered)
        cohort = (sec.cycle, sec.ordinal) if has_policy and sec.cycle is not None and sec.ordinal is not None else None

        best: tuple[tuple[int, int], SectionFreeSlotFit] | None = None
        for teacher in sorted(req.teachers, key=lambda t: t.id):
            if not is_eligible_for_course(teacher, course.courseId, has_policy):
                continue
            limit = next((lim.maxSections for lim in teacher.sectionLimits or [] if lim.courseId == course.courseId), None)
            if limit is not None and len(teacher_sections[teacher.id, course.courseId]) >= limit:
                continue
            needs_load = teacher_load[teacher.id] + total > teacher.maxWeeklyMinutes
            options_per_block: list[list[tuple[WindowLever | None, FreeSlot]]] = []
            for block in blocks:
                duration = sum(item.durationMinutes for item in block)
                options: list[tuple[WindowLever | None, FreeSlot]] = []
                for window in req.windows:
                    day = window.day
                    for start in range(window.startMinute, window.endMinute - duration + 1, req.startStepMinutes):
                        end = start + duration
                        lever = _window_lever(req.planningPolicy, course.cycle, day, start, duration)
                        if lever is False:
                            continue
                        if _overlaps(section_busy[section_id, day], start, end):
                            continue
                        if cohort is not None and _overlaps(cohort_busy[cohort[0], cohort[1], day], start, end):
                            continue
                        if _overlaps(teacher_busy[teacher.id, day], start, end):
                            continue
                        if not availability_covers(teacher.availability, day, start, end):
                            continue
                        cursor, placed, needs_lab = start, True, False
                        for item in block:
                            stop = cursor + item.durationMinutes
                            session_type = reqs_by_id[item.sessionId].type if item.sessionId in reqs_by_id else None
                            lab_only = has_policy and session_type == "L"
                            needs_lab = needs_lab or lab_only
                            if not any(
                                room.capacity >= sec.capacity
                                and (not lab_only or room.kind == "laboratory")
                                and availability_covers(room.availability, day, cursor, stop)
                                and not _overlaps(room_busy[room.id, day], cursor, stop)
                                for room in req.rooms
                            ):
                                placed = False
                                break
                            cursor = stop
                        if placed:
                            options.append((lever, FreeSlot(
                                day=day, band=_band(start),
                                roomKind="laboratory" if needs_lab else "classroom",
                            )))
                options_per_block.append(options)

            for lever_set in _LEVER_SETS:
                allowed = [
                    [slot for lever, slot in options if lever is None or lever in lever_set]
                    for options in options_per_block
                ]
                if all(allowed):
                    cost = (int(needs_load), len(lever_set))
                    if best is None or cost < best[0]:
                        slots = list({(s.day, s.band, s.roomKind): s for block in allowed for s in block}.values())
                        slots.sort(key=lambda s: (s.day, s.band != "mañana", s.band == "noche", s.roomKind))
                        best = (cost, SectionFreeSlotFit(
                            sectionId=section_id, courseId=course.courseId,
                            sessionCount=len(ordered), totalMinutes=total,
                            windowLevers=sorted(lever_set),  # type: ignore[arg-type]
                            needsTeacherLoad=needs_load, slots=slots,
                        ))
                    break
        if best is None:
            unfit.append(section_id)
        else:
            fits.append(best[1])

    fits.sort(key=lambda fit: (fit.needsTeacherLoad, len(fit.windowLevers), fit.sectionId))
    return FreeSlotScreen(fits=fits, unfitSectionIds=sorted(unfit))


def lever_label(fit: SectionFreeSlotFit) -> str:
    parts = [f"habilitar {WINDOW_LEVER_NAMES[lever]}" for lever in fit.windowLevers]
    if fit.needsTeacherLoad:
        parts.append("ampliar carga (requiere autorización)")
    return " + ".join(parts) if parts else "sin cambiar reglas"


def top_free_slots(screen: FreeSlotScreen, limit: int = 3) -> list[tuple[FreeSlot, int]]:
    """Slots ranked by how many fitting sections can use them."""
    counts: dict[tuple[int, str, str], int] = defaultdict(int)
    refs: dict[tuple[int, str, str], FreeSlot] = {}
    for fit in screen.fits:
        for slot in fit.slots:
            key = (slot.day, slot.band, slot.roomKind)
            counts[key] += 1
            refs[key] = slot
    ranked = sorted(counts, key=lambda key: (-counts[key], key))
    return [(refs[key], counts[key]) for key in ranked[:limit]]


def describe_free_slots(screen: FreeSlotScreen, pending_section_count: int) -> str:
    if not screen.fits:
        return (
            f"Ninguna de las {pending_section_count} sección(es) pendiente(s) cabe en los huecos libres "
            "sin mover lo ya asignado; destrabarlas exige regenerar el horario o gestionar recursos."
        )
    by_label: dict[str, int] = defaultdict(int)
    for fit in screen.fits:
        by_label[lever_label(fit)] += 1
    levers = ", ".join(f"{count} {label}" for label, count in by_label.items())
    slots = ", ".join(
        f"{DAY_NAMES[slot.day]} {BAND_NAMES[slot.band]} ({ROOM_KIND_NAMES[slot.roomKind]}, {count} sección(es))"
        for slot, count in top_free_slots(screen)
    )
    return (
        f"Sin mover lo ya asignado, {len(screen.fits)} de {pending_section_count} sección(es) pendiente(s) "
        f"caben en huecos libres: {levers}. Huecos más útiles: {slots}. "
        "Cada sección se evaluó por separado: es una guía de dónde mirar, no el impacto medido por CP-SAT."
    )
