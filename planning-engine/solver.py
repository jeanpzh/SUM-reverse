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


def solve_academic_schedule(req: SolveScheduleRequest) -> SolveScheduleResponse:
    deadline = time.monotonic() + req.maxTimeSeconds
    incumbent = []
    incumbent_visits = 0
    def generation_timeout():
        complete = len(incumbent) == len(req.requirements)
        return SolveScheduleResponse(status='complete' if complete else 'search-limit', assignments=incumbent, exploredCandidates=0,
            candidateVisits=incumbent_visits, backtracks=0, limitReason=None if complete else 'time', diagnostics=[DiagnosticOutput(
                code='COMPLETE' if complete else 'SEARCH_LIMIT', message='Construcción factible completa' if complete else 'Se agotó el presupuesto durante la preparación CP-SAT; se conserva el mejor horario factible',
                sessionIds=[r.id for r in req.requirements if r.id not in {a.id for a in incumbent}])])
    courses_by_id: dict[str, CourseInput] = {c.courseId: c for c in req.courses}
    sections_by_id: dict[str, SectionInput] = {s.id: s for s in req.sections}
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
            blocks = (
                [r.durationMinutes for r in s_reqs]
                if course.deliveryMode == "split"
                else [minutes]
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

    # Request-local caches: availability and policy are immutable during one solve.
    teachers_by_id = {t.id: t for t in req.teachers}

    availability_keys = {}
    for kind, resources in [('teacher', req.teachers), ('room', req.rooms)]:
        for resource in resources:
            # Normalize once; identical calendars share cached interval queries.
            merged = []
            for w in sorted(resource.availability, key=lambda w: (w.day, w.startMinute)):
                if merged and merged[-1][0] == w.day and merged[-1][2] >= w.startMinute:
                    d, start, end = merged[-1]
                    merged[-1] = (d, start, max(end, w.endMinute))
                else:
                    merged.append((w.day, w.startMinute, w.endMinute))
            availability_keys[kind, resource.id] = tuple(merged)

    @lru_cache(maxsize=None)
    def covers_calendar(calendar, day, start, end):
        return any(d == day and begin <= start and end <= finish for d, begin, finish in calendar)

    def covers(kind, resource_id, day, start, end):
        return covers_calendar(availability_keys[kind, resource_id], day, start, end)

    @lru_cache(maxsize=None)
    def rooms_for(capacity, session_type, day, start, end):
        return tuple(r for r in req.rooms if r.capacity >= capacity
            and (not has_policy or session_type != 'L' or r.kind == 'laboratory')
            and covers('room', r.id, day, start, end))

    @lru_cache(maxsize=None)
    def slots_for(cycle, duration):
        slots = set()
        for w in req.windows:
            for start in range(w.startMinute, w.endMinute - duration + 1, req.startStepMinutes):
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
    if len(req.sections) >= 32:
        occupied = defaultdict(int)
        loads = defaultdict(int)
        counts = defaultdict(int)
        construction_deadline = min(deadline, time.monotonic() + req.maxTimeSeconds * 0.2)
        ordered = sorted(req.sections, key=lambda sec: (
            len(teachers_by_course.get(sec.courseId, [])),
            -sum(r.durationMinutes for r in reqs_by_section[sec.id]),
            -(sec.cycle or 0), sec.ordinal or 0, sec.id))
        for sec in ordered:
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
                    loads[teacher.id] += duration
                    counts[teacher.id, sec.courseId] += 1
                    for key, mask in local.items():
                        occupied[key] |= mask
                    break

    model = cp_model.CpModel()

    bucket_minutes = math.gcd(30, req.startStepMinutes)
    for w in req.windows:
        bucket_minutes = math.gcd(bucket_minutes, w.startMinute)
    for r in req.requirements:
        bucket_minutes = math.gcd(bucket_minutes, r.durationMinutes)

    # Candidate options per section
    # Spread candidate slots across days and rotate compatible rooms by section index so sections
    # don't all collide on the first room (101AP) or Monday 08:00.
    MAX_PLACEMENTS_PER_TEACHER_SECTION = 24

    section_options: dict[str, list[tuple]] = defaultdict(list)
    teacher_options: dict[str, list[tuple[cp_model.IntVar, int, str, str]]] = defaultdict(list)
    room_slot_vars: dict[tuple[str, int, int], list[cp_model.IntVar]] = defaultdict(list)
    teacher_slot_vars: dict[tuple[str, int, int], list[cp_model.IntVar]] = defaultdict(list)
    cohort_slot_vars: dict[tuple[int, int, int, int], list[cp_model.IntVar]] = defaultdict(list)

    split_components: list[tuple] = []
    candidates_truncated = False
    candidate_visits = 0

    # Include the constructed placements in the CP model, so later search can
    # improve them rather than losing them to diversified room sampling.
    incumbent_by_section = defaultdict(list)
    for assignment in incumbent:
        incumbent_by_section[assignment.sectionId].append(assignment)
    for sid, placed in incumbent_by_section.items():
        if time.monotonic() >= deadline:
            return generation_timeout()
        sec = sections_by_id[sid]
        tid = placed[0].teacherId
        duration = sum(r.durationMinutes for r in reqs_by_section[sid])
        var = model.new_bool_var(f'incumbent_{sid}')
        placements = [(a.id, a.interval.day, a.interval.startMinute, a.interval.endMinute, a.roomId, a.sessionType) for a in placed]
        section_options[sid].append((var, sid, tid, placements, 3, duration))
        teacher_options[tid].append((var, duration, sec.courseId, sid))
        model.add_hint(var, 1)
        for a in placed:
            w = a.interval
            for bucket in range(w.startMinute // bucket_minutes, w.endMinute // bucket_minutes):
                teacher_slot_vars[tid, w.day, bucket].append(var)
                room_slot_vars[a.roomId, w.day, bucket].append(var)
                if has_policy and sec.cycle is not None and sec.ordinal is not None:
                    cohort_slot_vars[sec.cycle, sec.ordinal, w.day, bucket].append(var)

    for sec_idx, sec in enumerate(req.sections):
        if time.monotonic() >= deadline:
            return generation_timeout()
        if sec.id in excluded_sections:
            continue
        course = courses_by_id[sec.courseId]
        s_reqs = reqs_by_section[sec.id]
        if not s_reqs:
            continue
        block_duration = sum(r.durationMinutes for r in s_reqs)
        eligible_teachers = teachers_by_course.get(sec.courseId, [])
        is_split = course.deliveryMode == "split" and len(s_reqs) > 1

        interleaved_slots = list(slots_for(course.cycle, block_duration))
        if interleaved_slots:
            rot = sec_idx % len(interleaved_slots)
            interleaved_slots = interleaved_slots[rot:] + interleaved_slots[:rot]
        split_slots_by_req = {r.id: slots_for(course.cycle, r.durationMinutes) for r in s_reqs} if is_split else {}

        for t_idx, teacher in enumerate(eligible_teachers):
            if teacher.maxWeeklyMinutes < block_duration:
                continue
            placed_for_teacher = 0

            if is_split:
                teacher_sec = model.new_bool_var(f'teacher_{sec.id}_{teacher.id}')
                section_options[sec.id].append((teacher_sec, sec.id, teacher.id, [], 3, block_duration))
                teacher_options[teacher.id].append((teacher_sec, block_duration, sec.courseId, sec.id))
                for r_idx, r in enumerate(s_reqs):
                    component_vars = []
                    component_count = 0
                    # Each component chooses independently; all share teacher_sec.
                    component_slots = split_slots_by_req[r.id]
                    rot = (sec_idx + r_idx * 7 + t_idx) % max(1, len(component_slots))
                    component_slots = component_slots[rot:] + component_slots[:rot]
                    for rank, day, start in component_slots:
                        if component_count >= MAX_PLACEMENTS_PER_TEACHER_SECTION:
                            candidates_truncated = True
                            break
                        if time.monotonic() >= deadline:
                            return generation_timeout()
                        end = start + r.durationMinutes
                        if not covers('teacher', teacher.id, day, start, end):
                            continue
                        compatible = rooms_for(sec.capacity, r.type, day, start, end)
                        candidate_visits += 1
                        # Keep room diversity across sections/times without a Cartesian product.
                        if len(compatible) > 1:
                            candidates_truncated = True
                        if compatible:
                            room = compatible[(sec_idx + t_idx + r_idx + component_count) % len(compatible)]
                            component_count += 1
                            var = model.new_bool_var(f'component_{sec.id}_{teacher.id}_{r.id}_{day}_{start}_{room.id}')
                            component_vars.append(var)
                            placement = (r.id, day, start, end, room.id, r.type)
                            split_components.append((var, sec.id, teacher.id, placement))
                            for bucket in range(start // bucket_minutes, end // bucket_minutes):
                                teacher_slot_vars[(teacher.id, day, bucket)].append(var)
                                room_slot_vars[(room.id, day, bucket)].append(var)
                                if has_policy and sec.cycle is not None and sec.ordinal is not None:
                                    cohort_slot_vars[(sec.cycle, sec.ordinal, day, bucket)].append(var)
                    model.add(sum(component_vars) == teacher_sec)
                continue

            # 1. Contiguous block candidates
            for rank, day, start in interleaved_slots:
                if time.monotonic() >= deadline:
                    return generation_timeout()
                if placed_for_teacher >= MAX_PLACEMENTS_PER_TEACHER_SECTION:
                    candidates_truncated = True
                    break
                candidate_visits += 1
                if not covers('teacher', teacher.id, day, start, start + block_duration):
                    continue

                comp_placements: list[tuple[str, int, int, int, str, str | None]] = []
                cur = start
                possible = True
                for r_idx, r in enumerate(s_reqs):
                    c_start, c_end = cur, cur + r.durationMinutes
                    cur = c_end
                    compat_rooms = rooms_for(sec.capacity, r.type, day, c_start, c_end)
                    if len(compat_rooms) > 1:
                        candidates_truncated = True
                    if not compat_rooms:
                        possible = False
                        break
                    chosen_room = compat_rooms[
                        (sec_idx + placed_for_teacher + t_idx + r_idx)
                        % len(compat_rooms)
                    ]
                    comp_placements.append(
                        (r.id, day, c_start, c_end, chosen_room.id, r.type)
                    )
                if not possible:
                    continue

                in_pref = bool(
                    teacher.preferences
                    and availability_covers(
                        teacher.preferences, day, start, start + block_duration
                    )
                )
                pref_bonus = 20 if in_pref else (5 if rank == 0 else 1)

                var = model.new_bool_var(
                    f"opt_{sec.id}_{teacher.id}_{day}_{start}_{placed_for_teacher}"
                )
                opt_tuple = (
                    var,
                    sec.id,
                    teacher.id,
                    comp_placements,
                    pref_bonus,
                    block_duration,
                )
                section_options[sec.id].append(opt_tuple)
                teacher_options[teacher.id].append(
                    (var, block_duration, sec.courseId, sec.id)
                )

                for _req_id, c_day, c_start, c_end, rm_id, _stype in comp_placements:
                    for bucket in range(c_start // bucket_minutes, c_end // bucket_minutes):
                        teacher_slot_vars[(teacher.id, c_day, bucket)].append(var)
                        room_slot_vars[(rm_id, c_day, bucket)].append(var)
                        if has_policy and sec.cycle is not None and sec.ordinal is not None:
                            cohort_slot_vars[
                                (sec.cycle, sec.ordinal, c_day, bucket)
                            ].append(var)

                placed_for_teacher += 1

    # 1. At most 1 option per section
    for sec_id, opts in section_options.items():
        if time.monotonic() >= deadline:
            return generation_timeout()
        model.add_at_most_one(o[0] for o in opts)

    # 2. Exact common-grid occupancy for teacher, room and cohort. The grid divides
    # every requested start and duration, including sub-30-minute intervals.
    for vars_in_bucket in teacher_slot_vars.values():
        if time.monotonic() >= deadline:
            return generation_timeout()
        if len(vars_in_bucket) > 1:
            model.add_at_most_one(list({v.index: v for v in vars_in_bucket}.values()))

    for vars_in_bucket in room_slot_vars.values():
        if time.monotonic() >= deadline:
            return generation_timeout()
        if len(vars_in_bucket) > 1:
            model.add_at_most_one(list({v.index: v for v in vars_in_bucket}.values()))

    for vars_in_bucket in cohort_slot_vars.values():
        if time.monotonic() >= deadline:
            return generation_timeout()
        if len(vars_in_bucket) > 1:
            model.add_at_most_one(list({v.index: v for v in vars_in_bucket}.values()))

    # 3. Teacher weekly minute limit & per-course section limit
    for t_id, t_opts in teacher_options.items():
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

    # Objective: lexicographically prioritize total scheduled sessions (weight 1000 per session)
    # + preference/policy rank bonus
    objective_terms = []
    for sec_id, opts in section_options.items():
        num_sessions = len(reqs_by_section[sec_id])
        for var, _sid, _tid, _placements, pref_bonus, _dur in opts:
            objective_terms.append(var * (num_sessions * 1000 + pref_bonus))

    if objective_terms:
        model.maximize(sum(objective_terms))

    solver = cp_model.CpSolver()
    if time.monotonic() >= deadline:
        return generation_timeout()
    # Reserve serialization/CP shutdown time inside the caller's end-to-end budget.
    solver.parameters.max_time_in_seconds = max(0.001, deadline - time.monotonic() - min(0.05, req.maxTimeSeconds * 0.1))
    solver.parameters.num_search_workers = 4
    status_code = solver.solve(model)

    if status_code == cp_model.MODEL_INVALID:
        raise ValueError("Invalid CP-SAT model")

    assignments: list[AssignmentOutput] = []
    if status_code in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        for sec_id, opts in section_options.items():
            for var, _sid, t_id, placements, _pref, _dur in opts:
                if solver.value(var) == 1:
                    for req_id, c_day, c_start, c_end, rm_id, stype in placements:
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
        for var, sec_id, t_id, placement in split_components:
            if solver.value(var):
                req_id, day, start, end, room_id, stype = placement
                assignments.append(AssignmentOutput(id=req_id, sectionId=sec_id, teacherId=t_id, roomId=room_id,
                    interval=TimeInterval(day=day, startMinute=start, endMinute=end), sessionType=stype))

    used_incumbent = len(incumbent) > len(assignments)
    if used_incumbent:
        assignments = incumbent
        # Construction is a feasible witness, never a proof of infeasibility/optimality.
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
                message="Todas las sesiones requeridas están programadas (construcción factible)" if used_incumbent else "Todas las sesiones requeridas están programadas y validadas (OR-Tools CP-SAT)",
                sessionIds=[],
            )
        )
    else:
        status_str = "search-limit" if status_code in (cp_model.UNKNOWN, cp_model.FEASIBLE) or candidates_truncated else "impossible"
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
        limitReason="time" if not complete and status_code in (cp_model.UNKNOWN, cp_model.FEASIBLE) else "explorations" if not complete and candidates_truncated else None,
        diagnostics=diagnostics,
    )
