from __future__ import annotations

import math
import os
import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Callable

from collections import defaultdict
from ortools.sat.python import cp_model

from capacity import analyze_capacity

from models import (
    AssignmentOutput,
    CapacityDecision,
    CourseInput,
    DiagnosticOutput,
    PlanningPolicyInput,
    PrelationOutput,
    PrelationLevel,
    RequiredSessionInput,
    RoomInput,
    SectionInput,
    SolveScheduleRequest,
    SolveScheduleResponse,
    TeacherInput,
    TimeInterval,
)

def search_workers() -> int:
    """CP-SAT search workers for the timetable solve: at most 4, never above the usable cores."""
    try:
        cores = len(os.sched_getaffinity(0))
    except AttributeError:
        cores = os.cpu_count() or 1
    try:  # A container CPU quota can be lower than the visible core count.
        quota, period = open('/sys/fs/cgroup/cpu.max').read().split()[:2]
        if quota != 'max':
            cores = min(cores, max(1, int(int(quota) / int(period))))
    except (OSError, ValueError):
        pass
    return max(1, min(4, cores))


@dataclass
class SearchHooks:
    """Optional observers for a running search; all are called from the solving thread.

    `on_phase(name)` follows the solver's stages (`preparing`, `capacity`, `coverage`,
    `prelation`, `preferences`). `on_improvement(assignments)` receives each strictly
    better valid schedule: more scheduled sessions, or equal sessions with a
    lexicographically better (contract, interfaculty, category) prelation value.
    `should_cancel()` is polled between stages and on every solution; hard stopping of a
    search that has no solution to report is the caller's job (the job manager kills its
    worker process).
    """
    on_phase: Callable[[str], None] | None = None
    on_improvement: Callable[[list[AssignmentOutput]], None] | None = None
    should_cancel: Callable[[], bool] | None = None


class _GenerationLimit(Exception):
    def __init__(self, result):
        self.result = result


class _SolutionCallback(cp_model.CpSolverSolutionCallback):
    def __init__(self, on_solution, should_cancel):
        super().__init__()
        self._on_solution = on_solution
        self._should_cancel = should_cancel

    def on_solution_callback(self):
        self._on_solution(self.boolean_value)
        if self._should_cancel is not None and self._should_cancel():
            self.stop_search()


THESIS_COURSE_IDS = {
    "20118081",
    "20118091",
    "20118101",
}


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
    senior = (cycle or 0) >= 7
    if day == 7:
        return None
    if day == 6:
        if policy.allowSaturday and start >= 8 * 60 and start + duration <= 13 * 60:
            return 2 if senior else 1
        return None
    if day < 1 or day > 5 or start + duration > 22 * 60:
        return None
    if senior:
        if start >= 18 * 60 and start < 22 * 60:
            return 0
        if policy.allowAfternoon and start >= 14 * 60 and start < 22 * 60:
            return 1
        return None
    return 0 if (start >= 8 * 60 and start < 22 * 60) else None


def intervals_overlap(
    day_a: int, start_a: int, end_a: int, day_b: int, start_b: int, end_b: int
) -> bool:
    return day_a == day_b and start_a < end_b and start_b < end_a


def solve_academic_schedule(req: SolveScheduleRequest, hooks: SearchHooks | None = None) -> SolveScheduleResponse:
    deadline = time.monotonic() + req.maxTimeSeconds
    try:
        result = _solve_academic_schedule(req, deadline, hooks or SearchHooks())
    except _GenerationLimit as stopped:
        result = stopped.result
    # Explain the existing precheck only after scheduling. Counterfactual options
    # never enter capacity optimization, the incumbent, or the timetable model.
    excluded_ids = {sid for d in result.diagnostics if d.code == 'NO_SCHEDULING_WINDOW'
        for sid in d.sessionIds}
    if not excluded_ids or (hooks is not None and hooks.should_cancel is not None and hooks.should_cancel()):
        return result
    try:
        decisions, diagnostics = _window_options(req, excluded_ids, deadline)
    except TimeoutError:
        result.diagnostics.append(DiagnosticOutput(code='WINDOW_ANALYSIS_LIMIT',
            message='Sin presupuesto para completar el análisis de alternativas de franja',
            sessionIds=sorted(excluded_ids)))
    else:
        result.decisions.extend(decisions)
        result.diagnostics.extend(diagnostics)
    return result


def _window_options(
    req: SolveScheduleRequest, excluded_ids: set[str], deadline: float,
) -> tuple[list[CapacityDecision], list[DiagnosticOutput]]:
    courses = {c.courseId: c for c in req.courses}
    excluded_sections = {r.sectionId for r in req.requirements if r.id in excluded_ids}
    by_section = defaultdict(list)
    for r in req.requirements:
        if r.sectionId in excluded_sections:
            by_section[r.sectionId].append(r)
    policy = req.planningPolicy
    flags = {key: True for key in ('allowAfternoon', 'allowSaturday')
        if policy is not None and not getattr(policy, key)}
    options = [('planning-window:afternoon', {'allowAfternoon': True}, False),
        ('planning-window:saturday', {'allowSaturday': True}, False),
        ('delivery-mode-split', {}, True),
        ('planning-window:combined', flags, False),
        ('planning-window:combined-split', flags, True)]
    unlocked = defaultdict(set)
    insufficient = []

    @lru_cache(maxsize=8192)
    def fits(cycle, blocks, afternoon, saturday):
        changed_policy = policy.model_copy(update=dict(allowAfternoon=afternoon, allowSaturday=saturday)) if policy else None
        for duration in blocks:
            found = False
            for window in req.windows:
                if time.monotonic() >= deadline:
                    raise TimeoutError
                for start in range(window.startMinute, window.endMinute - duration + 1, req.startStepMinutes):
                    if time.monotonic() >= deadline:
                        raise TimeoutError
                    if planning_time_rank(cycle, start, window.day, duration, changed_policy) is not None:
                        found = True
                        break
                if found:
                    break
            if not found:
                return False
        return True

    for sid, items in sorted(by_section.items()):
        if time.monotonic() >= deadline:
            raise TimeoutError
        course = courses[items[0].courseId]
        single_unlocked = False
        for key, changes, split in options:
            if key.startswith('planning-window:combined'):
                if single_unlocked:
                    break
            elif changes and not all(flag in flags for flag in changes):
                continue
            elif split and course.deliveryMode == 'split':
                continue
            blocks = tuple(r.durationMinutes for r in items) if split or course.deliveryMode == 'split' else (
                sum(w.durationMinutes for w in course.weeklySessions),)
            if fits(course.cycle, blocks,
                    changes.get('allowAfternoon', policy.allowAfternoon if policy else False),
                    changes.get('allowSaturday', policy.allowSaturday if policy else False)):
                unlocked[key].add(sid)
                single_unlocked = True
            elif key == 'planning-window:combined-split':
                insufficient.extend(r.id for r in items)

    decisions = [CapacityDecision(id=key,
        kind='delivery-mode-split' if key == 'delivery-mode-split' else 'planning-window',
        courseIds=sorted({by_section[sid][0].courseId for sid in unlocked[key]}),
        additionalMinutes=0, sectionsUnlocked=len(unlocked[key]), basis='window-precheck',
        policyChange=changes or None,
        requiresSplit=True if key == 'planning-window:combined-split' else None) for key, changes, _ in options if unlocked[key]]
    diagnostics = [DiagnosticOutput(code='WINDOW_RELAXATION_INSUFFICIENT',
        message='Ni tarde, sábado y componentes separados dan franja a estas sesiones',
        sessionIds=sorted(insufficient))] if insufficient else []
    return decisions, diagnostics


def _solve_academic_schedule(req: SolveScheduleRequest, deadline: float, hooks: SearchHooks) -> SolveScheduleResponse:
    def phase(name: str) -> None:
        if hooks.on_phase is not None:
            hooks.on_phase(name)

    def cancelled() -> bool:
        return hooks.should_cancel is not None and hooks.should_cancel()

    phase('preparing')
    capacity_certificate = None
    decisions = []
    incumbent = []
    incumbent_visits = 0
    candidate_visits = 0
    prelation_proofs = [False, False, False]
    def generation_timeout():
        complete = len(incumbent) == len(req.requirements)
        return SolveScheduleResponse(status='complete' if complete else 'search-limit', assignments=incumbent, exploredCandidates=0,
            coverageProof='complete' if complete else 'inconclusive', capacityCertificate=capacity_certificate, decisions=decisions,
            prelation=prelation_for(incumbent),
            candidateVisits=incumbent_visits + candidate_visits, backtracks=0, limitReason=None if complete else 'cancelled' if cancelled() else 'time', diagnostics=[DiagnosticOutput(
                code='COMPLETE' if complete else 'SEARCH_LIMIT', message='Construcción factible completa' if complete else 'Preparación CP-SAT interrumpida; se conserva el mejor horario factible',
                sessionIds=[r.id for r in req.requirements if r.id not in {a.id for a in incumbent}])] + prelation_diagnostics)
    courses_by_id: dict[str, CourseInput] = {c.courseId: c for c in req.courses}
    reqs_by_section: dict[str, list[RequiredSessionInput]] = defaultdict(list)
    for r in req.requirements:
        reqs_by_section[r.sectionId].append(r)
    for s_reqs in reqs_by_section.values():
        s_reqs.sort(key=lambda r: r.order)

    has_policy = req.planningPolicy is not None
    teachers_by_course: dict[str, list[TeacherInput]] = {
        c.courseId: [
            t
            for t in req.teachers
            if is_eligible_for_course(t, c.courseId, has_policy)
        ]
        for c in req.courses
    }

    eligible_ids = {t.id for sec in req.sections for t in teachers_by_course.get(sec.courseId, [])}
    prelation_enabled = all(t.appointmentTier is not None and t.categoryRank is not None
        for t in req.teachers if t.id in eligible_ids)
    prelation_diagnostics = [] if prelation_enabled else [DiagnosticOutput(code='PRELATION_DATA_MISSING',
        message='Faltan appointmentTier o categoryRank en docentes habilitados; no se aplica prelación', sessionIds=[])]

    def prelation_for(assignments):
        if not prelation_enabled:
            return None
        assigned = {(a.sectionId, a.teacherId) for a in assignments}
        teachers = {t.id: t for t in req.teachers}
        values = [sum(teachers[tid].appointmentTier == 2 for _, tid in assigned),
            sum(teachers[tid].appointmentTier == 1 for _, tid in assigned),
            sum(teachers[tid].categoryRank for _, tid in assigned)]
        return PrelationOutput(levels=[PrelationLevel(id=key, value=value, proven=proof)
            for key, value, proof in zip(['contract-sections', 'interfaculty-sections', 'category-rank'], values, prelation_proofs)])

    # Generation owns Python/CP objects that must also be released within the
    # request's wall budget. Reserve its final tenth for teardown/search handoff;
    # reaching this deadline discards the partial model, never proves exhaustion.
    preparation_deadline = deadline - req.maxTimeSeconds * 0.1

    def checkpoint():
        if time.monotonic() >= preparation_deadline or cancelled():
            raise _GenerationLimit(generation_timeout())

    best_key: tuple | None = None
    best_assignments = []

    def publish(sessions: int, pairs: set[tuple[str, str]], build) -> None:
        # Report only strictly better schedules; the key never lowers scheduled sessions.
        nonlocal best_key, best_assignments
        key: tuple = (sessions,)
        if prelation_enabled:
            tiers = {t.id: t for t in req.teachers}
            key += (-sum(tiers[tid].appointmentTier == 2 for _, tid in pairs),
                    -sum(tiers[tid].appointmentTier == 1 for _, tid in pairs),
                    -sum(tiers[tid].categoryRank for _, tid in pairs))
        if best_key is None or key > best_key:
            best_key = key
            best_assignments = build()
            if hooks.on_improvement is not None:
                hooks.on_improvement(best_assignments)

    precheck_diagnostics: list[DiagnosticOutput] = []
    excluded_sections: set[str] = set()

    def admissible_start(course, window, duration, start):
        checkpoint()
        return planning_time_rank(course.cycle, start, window.day, duration, req.planningPolicy) is not None

    for course in req.courses:
        if time.monotonic() >= deadline or cancelled():
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

        for sec in c_sections:
            checkpoint()
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
            blocks = (
                [r.durationMinutes for r in s_reqs]
                if course.deliveryMode == "split"
                else [minutes]
            )
            has_window = all(
                any(
                    any(
                        admissible_start(course, w, dur, start)
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

    # Request-local caches: availability and policy are immutable during one solve.
    teachers_by_id = {t.id: t for t in req.teachers}

    availability_keys = {}
    for kind, resources in [('teacher', req.teachers), ('room', req.rooms)]:
        for resource in resources:
            checkpoint()
            # Normalize once; identical calendars share cached interval queries.
            merged = []
            for w in sorted(resource.availability, key=lambda w: (w.day, w.startMinute)):
                if merged and merged[-1][0] == w.day and merged[-1][2] >= w.startMinute:
                    d, start, end = merged[-1]
                    merged[-1] = (d, start, max(end, w.endMinute))
                else:
                    merged.append((w.day, w.startMinute, w.endMinute))
            availability_keys[kind, resource.id] = tuple(merged)

    @lru_cache(maxsize=8192)
    def covers_calendar(calendar, day, start, end):
        return any(d == day and begin <= start and end <= finish for d, begin, finish in calendar)

    def covers(kind, resource_id, day, start, end):
        return covers_calendar(availability_keys[kind, resource_id], day, start, end)

    @lru_cache(maxsize=8192)
    def rooms_for(capacity, session_type, day, start, end):
        compatible = []
        for room in req.rooms:
            checkpoint()
            if room.capacity >= capacity and (not has_policy or session_type != 'L' or room.kind == 'laboratory') and covers('room', room.id, day, start, end):
                compatible.append(room)
        return tuple(compatible)

    @lru_cache(maxsize=8192)
    def slots_for(cycle, duration):
        slots = set()
        for w in req.windows:
            for start in range(w.startMinute, w.endMinute - duration + 1, req.startStepMinutes):
                checkpoint()
                rank = planning_time_rank(cycle, start, w.day, duration, req.planningPolicy)
                if rank is not None:
                    slots.add((rank, w.day, start))
        # Round robin days, then starts. No minute-grid coarsening.
        by_day = defaultdict(list)
        for slot in sorted(slots):
            by_day[slot[1]].append(slot)
        return tuple(slot for i in range(max(map(len, by_day.values()), default=0))
                     for day in sorted(by_day) if i < len(by_day[day])
                     for slot in [by_day[day][i]])

    # Find a cheap feasible incumbent before allocating the CP model. Whole sections
    # are committed atomically; split components still use one responsible teacher.
    # Exact minute masks avoid rounding conflicts for non-30-minute starts/durations.
    if req.sections:
        occupied = defaultdict(int)
        loads = defaultdict(int)
        counts = defaultdict(int)
        construction_deadline = min(deadline, time.monotonic() + req.maxTimeSeconds * 0.2)
        ordered = sorted(req.sections, key=lambda sec: (
            len(teachers_by_course.get(sec.courseId, [])),
            -sum(r.durationMinutes for r in reqs_by_section[sec.id]),
            -(sec.cycle or 0), sec.ordinal or 0, sec.id))
        for sec in ordered:
            checkpoint()
            if time.monotonic() >= construction_deadline:
                break
            if sec.id in excluded_sections:
                continue
            course = courses_by_id[sec.courseId]
            items = reqs_by_section[sec.id]
            duration = sum(r.durationMinutes for r in items)
            cohort = (sec.cycle, sec.ordinal) if has_policy and sec.cycle is not None and sec.ordinal is not None else None
            for teacher in sorted(teachers_by_course[sec.courseId], key=lambda t: (loads[t.id], t.id)):
                if loads[teacher.id] + duration > teacher.maxWeeklyMinutes:
                    continue
                limit = next((lim.maxSections for lim in teacher.sectionLimits or [] if lim.courseId == sec.courseId), None)
                if limit is not None and counts[teacher.id, sec.courseId] >= limit:
                    continue
                local = defaultdict(int)
                placements = []
                blocks = [[r] for r in items] if course.deliveryMode == 'split' else [items]
                for block in blocks:
                    block_duration = sum(r.durationMinutes for r in block)
                    found = False
                    for rank, day, start in slots_for(course.cycle, block_duration):
                        incumbent_visits += 1
                        checkpoint()
                        if time.monotonic() >= construction_deadline:
                            break
                        mask = ((1 << block_duration) - 1) << start
                        keys = [('teacher', teacher.id, day)]
                        if cohort is not None:
                            keys.append(('cohort', cohort, day))
                        if any((occupied[k] | local[k]) & mask for k in keys):
                            continue
                        if not covers('teacher', teacher.id, day, start, start + block_duration):
                            continue
                        chosen = []
                        cur = start
                        for r in block:
                            end = cur + r.durationMinutes
                            rmask = ((1 << r.durationMinutes) - 1) << cur
                            room = next((room for room in rooms_for(sec.capacity, r.type, day, cur, end)
                                         if not (occupied['room', room.id, day] | local['room', room.id, day]) & rmask), None)
                            if room is None:
                                break
                            chosen.append((r, cur, end, room.id, rmask))
                            cur = end
                        if len(chosen) != len(block):
                            continue
                        for key in keys:
                            local[key] |= mask
                        for r, begin, end, room_id, rmask in chosen:
                            local['room', room_id, day] |= rmask
                            placements.append(AssignmentOutput(id=r.id, sectionId=sec.id, teacherId=teacher.id,
                                roomId=room_id, interval=TimeInterval(day=day, startMinute=begin, endMinute=end), sessionType=r.type))
                        found = True
                        break
                    if not found:
                        break
                if len(placements) == len(items) and items:
                    incumbent.extend(placements)
                    publish(len(incumbent), {(a.sectionId, a.teacherId) for a in incumbent}, lambda: list(incumbent))
                    loads[teacher.id] += duration
                    counts[teacher.id, sec.courseId] += 1
                    for key, mask in local.items():
                        occupied[key] |= mask
                    break

    if incumbent:
        publish(len(incumbent), {(a.sectionId, a.teacherId) for a in incumbent}, lambda: list(incumbent))
    phase('capacity')
    capacity_certificate, decisions, decisions_proven, capacity_upper_bound = analyze_capacity(req, teachers_by_course,
        min(deadline, time.monotonic() + min(1.0, req.maxTimeSeconds * 0.2)), excluded_sections)
    if not decisions_proven:
        precheck_diagnostics.append(DiagnosticOutput(code='CAPACITY_ANALYSIS_LIMIT',
            message='Análisis de capacidad o concesiones sin prueba óptima dentro del presupuesto', sessionIds=[]))
    for shortfall in capacity_certificate.courses:
        if not capacity_certificate.proven or not teachers_by_course.get(shortfall.courseId):
            continue
        precheck_diagnostics.append(DiagnosticOutput(code='TEACHER_CAPACITY_SHORTFALL',
            message=f'{shortfall.courseId} requiere {shortfall.requiredSections} secciones de '
                f'{sum(w.durationMinutes for w in courses_by_id[shortfall.courseId].weeklySessions)} min; '
                f'los docentes habilitados cubren {shortfall.coverableSections} '
                f'({sum(t.maxWeeklyMinutes for t in teachers_by_course[shortfall.courseId])} min disponibles)',
            sessionIds=[r.id for r in req.requirements if r.courseId == shortfall.courseId]))

    model = cp_model.CpModel()

    bucket_minutes = math.gcd(30, req.startStepMinutes)
    for w in req.windows:
        bucket_minutes = math.gcd(bucket_minutes, w.startMinute)
    for r in req.requirements:
        bucket_minutes = math.gcd(bucket_minutes, r.durationMinutes)

    # Exhaustive factored choices: block start/teacher, then each component room.
    section_options: dict[str, list[tuple]] = defaultdict(list)
    teacher_options: dict[str, list[tuple[cp_model.IntVar, int, str, str]]] = defaultdict(list)
    room_slot_vars: dict[tuple[str, int, int], list[cp_model.IntVar]] = defaultdict(list)
    teacher_slot_vars: dict[tuple[str, int, int], list[cp_model.IntVar]] = defaultdict(list)
    cohort_slot_vars: dict[tuple[int, int, int, int], list[cp_model.IntVar]] = defaultdict(list)

    split_components: list[tuple] = []
    candidates_truncated = False
    candidate_visits = 0

    def occupy(var, teacher_id, sec, day, start, end, room_id=None):
        for bucket in range(start // bucket_minutes, end // bucket_minutes):
            checkpoint()
            if room_id is None:
                teacher_slot_vars[teacher_id, day, bucket].append(var)
                if has_policy and sec.cycle is not None and sec.ordinal is not None:
                    cohort_slot_vars[sec.cycle, sec.ordinal, day, bucket].append(var)
            else:
                room_slot_vars[room_id, day, bucket].append(var)

    # Room selection is shared by all teachers at the same section/component/start.
    # At most one teacher owns a section, so sum(parents) is Boolean. This exact
    # factorization avoids both room Cartesian products and teacher/room products.
    room_groups = {}

    def defer_rooms(parent, sec, r, day, start, compatible):
        key = (sec.id, r.id, day, start)
        if key not in room_groups:
            room_groups[key] = ([], sec, r, compatible)
        room_groups[key][0].append(parent)

    for sec in req.sections:
        checkpoint()
        if sec.id in excluded_sections:
            continue
        course = courses_by_id[sec.courseId]
        s_reqs = reqs_by_section[sec.id]
        if not s_reqs:
            continue
        block_duration = sum(r.durationMinutes for r in s_reqs)
        is_split = course.deliveryMode == 'split' and len(s_reqs) > 1
        for teacher in teachers_by_course.get(sec.courseId, []):
            checkpoint()
            if teacher.maxWeeklyMinutes < block_duration:
                continue
            if is_split:
                teacher_sec = model.new_bool_var(f'teacher_{sec.id}_{teacher.id}')
                section_options[sec.id].append((teacher_sec, sec.id, teacher.id, [], 3, block_duration))
                teacher_options[teacher.id].append((teacher_sec, block_duration, sec.courseId, sec.id))
                for r in s_reqs:
                    component_vars = []
                    for rank, day, start in slots_for(course.cycle, r.durationMinutes):
                        checkpoint()
                        candidate_visits += 1
                        end = start + r.durationMinutes
                        if covers('teacher', teacher.id, day, start, end):
                            compatible = rooms_for(sec.capacity, r.type, day, start, end)
                            if compatible:
                                var = model.new_bool_var(f'start_{sec.id}_{teacher.id}_{r.id}_{day}_{start}')
                                component_vars.append(var)
                                occupy(var, teacher.id, sec, day, start, end)
                                defer_rooms(var, sec, r, day, start, compatible)
                    model.add(sum(component_vars) == teacher_sec)
                continue

            for rank, day, start in slots_for(course.cycle, block_duration):
                checkpoint()
                candidate_visits += 1
                if not covers('teacher', teacher.id, day, start, start + block_duration):
                    continue
                components = []
                cur = start
                for r in s_reqs:
                    compatible = rooms_for(sec.capacity, r.type, day, cur, cur + r.durationMinutes)
                    if not compatible:
                        break
                    components.append((r, cur, compatible))
                    cur += r.durationMinutes
                if len(components) != len(s_reqs):
                    continue
                in_pref = bool(teacher.preferences and availability_covers(
                    teacher.preferences, day, start, start + block_duration))
                bonus = 20 if in_pref else (5 if rank == 0 else 1)
                var = model.new_bool_var(f'opt_{sec.id}_{teacher.id}_{day}_{start}')
                section_options[sec.id].append((var, sec.id, teacher.id, [], bonus, block_duration))
                teacher_options[teacher.id].append((var, block_duration, sec.courseId, sec.id))
                occupy(var, teacher.id, sec, day, start, start + block_duration)
                for r, begin, compatible in components:
                    defer_rooms(var, sec, r, day, begin, compatible)

    for (sid, rid, day, start), (parents, sec, r, compatible) in room_groups.items():
        checkpoint()
        end = start + r.durationMinutes
        choices = []
        for room in compatible:
            checkpoint()
            var = model.new_bool_var(f'room_{sid}_{rid}_{day}_{start}_{room.id}')
            choices.append(var)
            split_components.append((var, sid, None, (rid, day, start, end, room.id, r.type)))
            occupy(var, None, sec, day, start, end, room.id)
        model.add(sum(choices) == sum(parents))
    room_groups.clear()

    # 1. At most 1 option per section
    for sec_id, opts in section_options.items():
        if time.monotonic() >= deadline or cancelled():
            return generation_timeout()
        model.add_at_most_one(o[0] for o in opts)

    # 2. Exact common-grid occupancy for teacher, room and cohort. The grid divides
    # every requested start and duration, including sub-30-minute intervals.
    for vars_in_bucket in teacher_slot_vars.values():
        if time.monotonic() >= deadline or cancelled():
            return generation_timeout()
        if len(vars_in_bucket) > 1:
            model.add_at_most_one(list({v.index: v for v in vars_in_bucket}.values()))

    for vars_in_bucket in room_slot_vars.values():
        if time.monotonic() >= deadline or cancelled():
            return generation_timeout()
        if len(vars_in_bucket) > 1:
            model.add_at_most_one(list({v.index: v for v in vars_in_bucket}.values()))

    for vars_in_bucket in cohort_slot_vars.values():
        if time.monotonic() >= deadline or cancelled():
            return generation_timeout()
        if len(vars_in_bucket) > 1:
            model.add_at_most_one(list({v.index: v for v in vars_in_bucket}.values()))

    # 3. Teacher weekly minute limit & per-course section limit
    for t_id, t_opts in teacher_options.items():
        checkpoint()
        teacher = teachers_by_id[t_id]
        model.add(
            sum(var * dur for var, dur, _cid, _sid in t_opts)
            <= teacher.maxWeeklyMinutes
        )
        for lim in teacher.sectionLimits or []:
            c_vars = [
                var for var, _dur, cid, _sid in t_opts if cid == lim.courseId
            ]
            if c_vars:
                model.add(sum(c_vars) <= lim.maxSections)

    coverage = sum(var * len(reqs_by_section[sid]) for sid, opts in section_options.items()
        for var, *_ in opts)
    preference = sum(var * bonus for opts in section_options.values()
        for var, _sid, _tid, _placements, bonus, _dur in opts)
    # Legacy requests retain their preference behavior; complete priority data
    # activates PA-ENGINE-2's strict sequence, never freezing teacher assignments.
    # One additional covered session must outweigh every possible preference gain.
    # At most one option per section is selected, with a bonus no greater than 20.
    coverage_weight = 20 * len(section_options) + 1
    model.maximize(coverage if prelation_enabled else coverage * coverage_weight + preference)
    def extract(value) -> list[AssignmentOutput]:
        found: list[AssignmentOutput] = []
        selected_teachers = {}
        for sec_id, opts in section_options.items():
            for var, _sid, t_id, placements, _pref, _dur in opts:
                if value(var) == 1:
                    selected_teachers[sec_id] = t_id
                    for req_id, c_day, c_start, c_end, rm_id, stype in placements:
                        found.append(
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
        for var, sec_id, t_id, placement in split_components:
            if value(var):
                req_id, day, start, end, room_id, stype = placement
                found.append(AssignmentOutput(id=req_id, sectionId=sec_id, teacherId=selected_teachers[sec_id], roomId=room_id,
                    interval=TimeInterval(day=day, startMinute=start, endMinute=end), sessionType=stype))
        return found

    option_rows = [(var, sid, tid, len(reqs_by_section[sid]))
        for sid, opts in section_options.items() for var, _s, tid, *_ in opts]

    def on_solution(value) -> None:
        # Option variables are all-or-nothing per section, so sessions come from the
        # selected options; extraction only runs when the schedule is strictly better.
        selected = [(sid, tid, count) for var, sid, tid, count in option_rows if value(var)]
        publish(sum(count for _, _, count in selected), {(sid, tid) for sid, tid, _ in selected}, lambda: extract(value))

    def search(cp_solver):
        # Keep the best lexicographic witness even if a later, unproven stage
        # returns another equal-coverage solution with worse lower-priority values.
        return cp_solver.solve(model, _SolutionCallback(on_solution, hooks.should_cancel))

    solver = cp_model.CpSolver()
    if time.monotonic() >= deadline or cancelled():
        return generation_timeout()
    reserve = min(0.05, req.maxTimeSeconds * 0.1)
    solver.parameters.max_time_in_seconds = max(0.001, deadline - time.monotonic() - reserve)
    solver.parameters.num_search_workers = search_workers()
    phase('coverage')
    status_code = search(solver)
    if status_code == cp_model.MODEL_INVALID:
        raise ValueError('Invalid CP-SAT model')

    if prelation_enabled and status_code == cp_model.OPTIMAL:
        model.add(coverage == int(solver.value(coverage)))
        objectives = [
            sum(var for tid, opts in teacher_options.items() if teachers_by_id[tid].appointmentTier == 2 for var, *_ in opts),
            sum(var for tid, opts in teacher_options.items() if teachers_by_id[tid].appointmentTier == 1 for var, *_ in opts),
            sum(var * teachers_by_id[tid].categoryRank for tid, opts in teacher_options.items() for var, *_ in opts),
            -preference,
        ]
        for index, objective in enumerate(objectives):
            remaining = deadline - time.monotonic() - reserve
            if remaining <= 0 or cancelled():
                break
            phase('prelation' if index < 3 else 'preferences')
            model.minimize(objective)
            next_solver = cp_model.CpSolver()
            next_solver.parameters.max_time_in_seconds = remaining
            next_solver.parameters.num_search_workers = 1
            next_status = search(next_solver)
            if next_status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                break  # Keep the preceding feasible solution.
            solver = next_solver
            if index < 3:
                prelation_proofs[index] = next_status == cp_model.OPTIMAL and not candidates_truncated
            if next_status != cp_model.OPTIMAL:
                break
            model.add(objective == int(solver.value(objective)))

    assignments: list[AssignmentOutput] = []
    if status_code in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        assignments = extract(solver.value)

    def quality(rows):
        levels = prelation_for(rows)
        return (len(rows), *(-level.value for level in levels.levels)) if levels else (len(rows),)

    used_incumbent = quality(best_assignments) > quality(assignments)
    if used_incumbent:
        assignments = best_assignments
        # Construction is a feasible witness, never a proof of infeasibility/optimality.
        candidates_truncated = True
        prelation_proofs = [False, False, False]

    assigned_ids = {a.id for a in assignments}
    missing_ids = [r.id for r in req.requirements if r.id not in assigned_ids]
    complete = len(missing_ids) == 0

    scheduled_sections = {a.sectionId for a in assignments}
    missing_sections = {r.sectionId for r in req.requirements if r.id in missing_ids}
    capacity_saturated = (capacity_certificate.proven and
        capacity_upper_bound is not None and len(scheduled_sections) == capacity_upper_bound)
    # An exhaustive optimal schedule proves coverage independently of the capacity
    # relaxation. Truncated candidates or an incumbent never provide that proof.
    exhaustive_coverage = status_code == cp_model.OPTIMAL and not candidates_truncated
    shortfall_proven = exhaustive_coverage or (capacity_certificate.proven and
        (capacity_saturated or missing_sections <= excluded_sections))
    coverage_proof = 'complete' if complete else 'shortfall-proven' if shortfall_proven else 'inconclusive'
    diagnostics: list[DiagnosticOutput] = []
    if complete:
        status_str = "complete"
        diagnostics.append(
            DiagnosticOutput(
                code="COMPLETE",
                message="Todas las sesiones requeridas están programadas (construcción factible)" if used_incumbent else "Todas las sesiones requeridas están programadas y validadas (OR-Tools CP-SAT)",
                sessionIds=[],
            )
        )
    else:
        status_str = "impossible" if shortfall_proven else "search-limit"
        diagnostics.append(
            DiagnosticOutput(
                code="PARTIAL_PROPOSAL",
                message="Quedan sesiones sin programar en esta ejecución CP-SAT; consultar el estado y límite de búsqueda antes de concluir imposibilidad.",
                sessionIds=missing_ids,
            )
        )
    diagnostics.extend(precheck_diagnostics)
    diagnostics.extend(prelation_diagnostics)

    return SolveScheduleResponse(
        status=status_str,  # type: ignore[arg-type]
        assignments=assignments,
        exploredCandidates=int(solver.num_booleans),
        candidateVisits=max(candidate_visits, int(solver.num_branches)),
        backtracks=int(solver.num_conflicts),
        limitReason="cancelled" if cancelled() and coverage_proof == 'inconclusive' else "time" if coverage_proof == 'inconclusive' and status_code in (cp_model.UNKNOWN, cp_model.FEASIBLE) else "explorations" if coverage_proof == 'inconclusive' and candidates_truncated else None,
        diagnostics=diagnostics,
        coverageProof=coverage_proof, capacityCertificate=capacity_certificate, decisions=decisions,
        prelation=prelation_for(assignments),
    )
