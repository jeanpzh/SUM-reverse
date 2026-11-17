"""Reproducible synthetic checkpoint measurement for the CP-SAT completion solver.

Constructs input strictly from backend's synthetic `createDemoCatalog()`,
`planningDefaults(cycle, '2027-I')`, and `syntheticTeachingMetadata(index)`.
Never reads private snapshots/datos-reales/diagnostics, never starts servers,
never prints teacher names (aliases `DOCENTE_001`..`DOCENTE_091` only), and
never fabricates Saturday availability on weekday-only resources.
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

ENGINE_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = ENGINE_DIR.parent
if str(ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(ENGINE_DIR))

from advisor import AdvisorPrivacyCodec, build_deterministic_analysis  # noqa: E402
from advisor_agent import run_cpsat_dry_run  # noqa: E402
from models import (  # noqa: E402
    AdvisorAnalyzeRequest,
    SolveScheduleRequest,
    SolveScheduleResponse,
)
from solver import (  # noqa: E402
    availability_covers,
    get_effective_planning_windows,
    get_section_component_groups,
    is_eligible_for_course,
    planning_time_rank,
    solve_academic_schedule,
)


def load_synthetic_2027_1_catalog() -> dict:
    node_script = r"""
      import { registerHooks } from 'node:module'
      registerHooks({ resolve(specifier, context, next) {
        if (specifier.startsWith('.') && specifier.endsWith('.js')) {
          return next(specifier.slice(0, -3) + '.ts', context)
        }
        return next(specifier, context)
      } })
      const { createDemoCatalog } = await import('./backend/src/programacion-academica/demo-catalog.ts')
      const { planningDefaults, syntheticTeachingMetadata } = await import('./shared/academic-planning-policy.mjs')
      const catalog = createDemoCatalog()
      const courses = catalog.courses.map((course) => ({
        ...course,
        ...planningDefaults(course.cycle, '2027-I'),
      }))
      const teachers = catalog.referenceTeachers.map((teacher, index) => ({
        ...teacher,
        ...syntheticTeachingMetadata(index),
      }))
      console.log(JSON.stringify({
        windows: catalog.windows,
        courses,
        teachers,
        rooms: catalog.referenceRooms,
      }))
    """
    raw = subprocess.check_output(
        ["node", "--input-type=module", "-e", node_script],
        cwd=REPO_ROOT,
        text=True,
    )
    return json.loads(raw)


def build_base_request(catalog: dict, max_time_seconds: float = 2.5) -> SolveScheduleRequest:
    windows = catalog["windows"]
    courses = list(catalog["courses"])
    sections = []
    requirements = []
    for course in courses:
        cap = course["targetCapacity"]
        n_sections = (course["estimatedDemand"] + cap - 1) // cap
        for ordinal in range(1, n_sections + 1):
            sid = f"{course['courseId']}:{ordinal}"
            sections.append(
                {
                    "id": sid,
                    "courseId": course["courseId"],
                    "capacity": cap,
                    "cycle": course["cycle"],
                    "ordinal": ordinal,
                }
            )
            for order, ws in enumerate(course["weeklySessions"]):
                requirements.append(
                    {
                        "id": f"{sid}:{order}",
                        "sectionId": sid,
                        "courseId": course["courseId"],
                        "order": order,
                        "durationMinutes": ws["durationMinutes"],
                        "type": ws.get("type"),
                    }
                )
    teachers = [
        {
            **t,
            "maxWeeklyMinutes": 600,
            "availability": windows,
        }
        for t in catalog["teachers"]
    ]
    rooms = [{**r, "availability": windows} for r in catalog["rooms"]]
    return SolveScheduleRequest.model_validate(
        {
            "courses": courses,
            "sections": sections,
            "requirements": requirements,
            "windows": windows,
            "teachers": teachers,
            "rooms": rooms,
            "planningPolicy": {
                "revision": "FISI-PLANNING-1",
                "period": "2027-I",
                "facultyId": "FISI",
                "allowAfternoon": False,
                "allowSaturday": False,
            },
            "allocationPolicy": "preferences",
            "maxTimeSeconds": max_time_seconds,
        }
    )


def verify_hard_constraints(req: SolveScheduleRequest, result: SolveScheduleResponse) -> None:
    requirements = {r.id: r for r in req.requirements}
    sections = {s.id: s for s in req.sections}
    courses = {c.courseId: c for c in req.courses}
    teachers = {t.id: t for t in req.teachers}
    rooms = {r.id: r for r in req.rooms}
    grouped = defaultdict(list)
    loads = Counter()
    taught = defaultdict(set)
    seen = set()
    for a in result.assignments:
        assert a.id not in seen, f"Duplicate requirement assignment: {a.id}"
        seen.add(a.id)
        r = requirements[a.id]
        s = sections[a.sectionId]
        t = teachers[a.teacherId]
        room = rooms[a.roomId]
        w = a.interval
        assert r.sectionId == s.id and r.courseId == s.courseId
        assert w.endMinute - w.startMinute == r.durationMinutes
        assert a.sessionType == r.type
        assert is_eligible_for_course(t, s.courseId, req.planningPolicy is not None)
        assert room.capacity >= s.capacity
        assert not req.planningPolicy or r.type != "L" or room.kind == "laboratory"
        assert availability_covers(t.availability, w.day, w.startMinute, w.endMinute)
        assert availability_covers(room.availability, w.day, w.startMinute, w.endMinute)
        assert any(
            x.day == w.day and x.startMinute <= w.startMinute and w.endMinute <= x.endMinute
            for x in req.windows
        )
        grouped[s.id].append(a)
        loads[t.id] += r.durationMinutes
        taught[t.id, s.courseId].add(s.id)
    for tid, load in loads.items():
        assert load <= teachers[tid].maxWeeklyMinutes
        for limit in teachers[tid].sectionLimits or []:
            assert len(taught[tid, limit.courseId]) <= limit.maxSections
    for sid, placed in grouped.items():
        sec_reqs = sorted(
            [r for r in req.requirements if r.sectionId == sid],
            key=lambda r: r.order,
        )
        course = courses[sections[sid].courseId]
        by_id = {a.id: a for a in placed}
        groups = get_section_component_groups(sec_reqs, course.teacherAssignmentMode)
        blocks = []
        for grp in groups:
            grp_placed = [by_id[r.id] for r in grp if r.id in by_id]
            assert len(grp_placed) in (0, len(grp))
            if not grp_placed:
                continue
            assert len({a.teacherId for a in grp_placed}) == 1
            if course.deliveryMode == "split":
                blocks.extend([[a] for a in grp_placed])
            else:
                blocks.append(grp_placed)
        for block in blocks:
            w = block[0].interval
            duration = sum(requirements[a.id].durationMinutes for a in block)
            assert (
                planning_time_rank(
                    course.cycle, w.startMinute, w.day, duration, req.planningPolicy
                )
                is not None
            )
            for a, b in zip(block, block[1:]):
                assert a.interval.day == b.interval.day and a.interval.endMinute == b.interval.startMinute
    for i, a in enumerate(result.assignments):
        for b in result.assignments[i + 1 :]:
            sa, sb = sections[a.sectionId], sections[b.sectionId]
            shared = (
                a.sectionId == b.sectionId
                or a.teacherId == b.teacherId
                or a.roomId == b.roomId
                or (
                    req.planningPolicy
                    and sa.cycle is not None
                    and sa.ordinal is not None
                    and (sa.cycle, sa.ordinal) == (sb.cycle, sb.ordinal)
                )
            )
            if shared:
                assert (
                    a.interval.day != b.interval.day
                    or a.interval.endMinute <= b.interval.startMinute
                    or b.interval.endMinute <= a.interval.startMinute
                )


def complete_sections_count(req: SolveScheduleRequest, result: SolveScheduleResponse) -> int:
    assigned_ids = {a.id for a in result.assignments}
    reqs_by_sec: dict[str, list[str]] = defaultdict(list)
    for r in req.requirements:
        reqs_by_sec[r.sectionId].append(r.id)
    return sum(
        bool(s_reqs) and all(rid in assigned_ids for rid in s_reqs)
        for s_reqs in reqs_by_sec.values()
    )


def summarize_run(label: str, req: SolveScheduleRequest, res: SolveScheduleResponse, elapsed: float) -> dict:
    verify_hard_constraints(req, res)
    courses_by_id = {c.courseId: c for c in req.courses}
    sections_by_id = {s.id: s for s in req.sections}
    loads = Counter()
    for a in res.assignments:
        loads[a.teacherId] += a.interval.endMinute - a.interval.startMinute
    sat_assignments = sum(1 for a in res.assignments if a.interval.day == 6)
    senior_afternoon = sum(
        1
        for a in res.assignments
        if (courses_by_id[sections_by_id[a.sectionId].courseId].cycle or 0) >= 7
        and a.interval.startMinute < 18 * 60
    )
    return {
        "scenario": label,
        "budgetSeconds": req.maxTimeSeconds,
        "elapsedSeconds": round(elapsed, 3),
        "status": res.status,
        "limitReason": res.limitReason,
        "scheduledSessions": len(res.assignments),
        "requiredSessions": len(req.requirements),
        "completeSections": complete_sections_count(req, res),
        "totalSections": len(req.sections),
        "saturdayAssignments": sat_assignments,
        "seniorAfternoonAssignments": senior_afternoon,
        "maxTeacherLoadMinutes": max(loads.values(), default=0),
        "activeTeachers": len(loads),
    }


def apply_patches(
    base_req: SolveScheduleRequest, recs: list, selected_ids: list[str], budget: float
) -> SolveScheduleRequest:
    copy = base_req.model_copy(deep=True)
    rec_map = {r.id: r.patch for r in recs}
    for rec_id in selected_ids:
        patch = rec_map[rec_id]
        if patch.kind == "increase_teacher_load":
            for adj in patch.adjustments:
                t = next(item for item in copy.teachers if item.id == adj.teacherId)
                t.maxWeeklyMinutes = adj.nextMaxWeeklyMinutes
        elif patch.kind == "enable_planning_window" and copy.planningPolicy:
            if patch.allowAfternoon:
                copy.planningPolicy.allowAfternoon = True
            if patch.allowSaturday:
                copy.planningPolicy.allowSaturday = True
        elif patch.kind == "change_delivery_mode":
            for c in copy.courses:
                if c.courseId in patch.courseIds:
                    c.deliveryMode = "split"
        elif patch.kind == "change_teacher_assignment_mode":
            for c in copy.courses:
                if c.courseId in patch.courseIds:
                    c.teacherAssignmentMode = patch.teacherAssignmentMode
    copy.windows = get_effective_planning_windows(copy.windows, copy.planningPolicy)
    copy.maxTimeSeconds = budget
    return copy


def main() -> None:
    catalog = load_synthetic_2027_1_catalog()
    base = build_base_request(catalog, max_time_seconds=2.5)
    codec = AdvisorPrivacyCodec({t.id: (t.name or t.id) for t in base.teachers})

    # Verify Saturday availability in base catalog resources
    teachers_with_sat = sum(1 for t in base.teachers if any(w.day == 6 for w in t.availability))
    rooms_with_sat = sum(1 for r in base.rooms if any(w.day == 6 for w in r.availability))

    # Structural course-level lower-bound check at 600 min/teacher
    course_shortfalls = []
    for c in base.courses:
        sec_count = sum(1 for s in base.sections if s.courseId == c.courseId)
        sec_mins = sum(ws.durationMinutes for ws in c.weeklySessions)
        demand_mins = sec_count * sec_mins
        eligible = [t for t in base.teachers if is_eligible_for_course(t, c.courseId, True)]
        max_pool_mins = sum(t.maxWeeklyMinutes for t in eligible)
        if demand_mins > max_pool_mins:
            course_shortfalls.append(
                {
                    "courseId": c.courseId,
                    "cycle": c.cycle,
                    "sections": sec_count,
                    "sectionMinutes": sec_mins,
                    "demandMinutes": demand_mins,
                    "eligibleTeacherCount": len(eligible),
                    "poolMinutesAt600": max_pool_mins,
                    "deficitMinutes": demand_mins - max_pool_mins,
                }
            )

    # 1. Baseline
    t0 = time.monotonic()
    baseline_res = solve_academic_schedule(base)
    baseline_elapsed = time.monotonic() - t0
    rows = [summarize_run("baseline (LV 8-22, senior 18-22, continuous, single-teacher, 600m)", base, baseline_res, baseline_elapsed)]

    # 2. Build advisor analysis from baseline
    assigned_ids = {a.id for a in baseline_res.assignments}
    advisor_req = AdvisorAnalyzeRequest.model_validate(
        {
            **{k: v for k, v in base.model_dump().items() if k in AdvisorAnalyzeRequest.model_fields},
            "proposalId": "synthetic-checkpoint-2027-I",
            "editVersion": 0,
            "assignments": [a.model_dump() for a in baseline_res.assignments],
            "diagnostics": [d.model_dump() for d in baseline_res.diagnostics],
            "pending": [
                {
                    "sessionId": r.id,
                    "sectionId": r.sectionId,
                    "courseId": r.courseId,
                    "durationMinutes": r.durationMinutes,
                }
                for r in base.requirements
                if r.id not in assigned_ids
            ],
        }
    )
    _summary, bottlenecks, recs, _codec = build_deterministic_analysis(advisor_req)

    # Anonymized teacher load adjustments from advisor
    load_rec = next((r for r in recs if r.patch.kind == "increase_teacher_load"), None)
    anonymized_load_adjustments = []
    if load_rec:
        for adj in load_rec.patch.adjustments:
            anonymized_load_adjustments.append(
                {
                    "teacherAlias": codec.alias_for_id(adj.teacherId),
                    "previousMaxWeeklyMinutes": adj.previousMaxWeeklyMinutes,
                    "nextMaxWeeklyMinutes": adj.nextMaxWeeklyMinutes,
                }
            )

    # 3. Same-load (600 min) variants
    same_load_configs = [
        ("same-load + enable_planning_window (afternoon+sat)", True, "continuous", "single-teacher-section", 2.5),
        ("same-load + window + split all", True, "split", "single-teacher-section", 2.5),
        ("same-load + window + split all + tp-grouped-l-independent", True, "split", "tp-grouped-l-independent", 2.5),
        ("same-load + window + split all + tp-grouped-l-independent (10s)", True, "split", "tp-grouped-l-independent", 10.0),
        ("same-load + window + split all + per-session", True, "split", "per-session", 2.5),
        ("same-load + window + split all + per-session (10s)", True, "split", "per-session", 10.0),
    ]
    for label, open_win, deliv, tmode, budget in same_load_configs:
        var = base.model_copy(deep=True)
        var.maxTimeSeconds = budget
        if open_win and var.planningPolicy:
            var.planningPolicy.allowAfternoon = True
            var.planningPolicy.allowSaturday = True
            var.windows = get_effective_planning_windows(var.windows, var.planningPolicy)
        for c in var.courses:
            c.deliveryMode = deliv
            c.teacherAssignmentMode = tmode
        ts = time.monotonic()
        vres = solve_academic_schedule(var)
        rows.append(summarize_run(label, var, vres, time.monotonic() - ts))

    # 4. Advisor combinations (dry-run vs direct regeneration parity)
    combos = [
        ("advisor: window only", ["rec-enable-planning-window"]),
        ("advisor: window + delivery_mode", ["rec-enable-planning-window", "rec-change-delivery-mode"]),
        ("advisor: window + delivery_mode + tp-grouped-l-independent (same 600m)", ["rec-enable-planning-window", "rec-change-delivery-mode", "rec-change-teacher-assignment-mode"]),
        ("advisor: legacy 3 recs (load + window + delivery_mode)", ["rec-increase-teacher-load", "rec-enable-planning-window", "rec-change-delivery-mode"]),
        ("advisor: all 4 recs (load + window + delivery_mode + tp-grouped-l-independent)", ["rec-increase-teacher-load", "rec-enable-planning-window", "rec-change-delivery-mode", "rec-change-teacher-assignment-mode"]),
    ]
    parity_checks = []
    for label, sel_ids in combos:
        t_dry = time.monotonic()
        dry = run_cpsat_dry_run(advisor_req, recs, sel_ids)
        dry_elapsed = time.monotonic() - t_dry

        regen_req = apply_patches(base, recs, sel_ids, budget=2.5)
        t_reg = time.monotonic()
        regen_res = solve_academic_schedule(regen_req)
        reg_elapsed = time.monotonic() - t_reg
        row = summarize_run(f"{label} [regen 2.5s]", regen_req, regen_res, reg_elapsed)
        rows.append(row)
        parity_checks.append(
            {
                "label": label,
                "selectedIds": sel_ids,
                "dryRunSessions": dry.projectedScheduledSessions,
                "regenSessions": row["scheduledSessions"],
                "dryRunCompleteSections": dry.projectedCompleteSections,
                "regenCompleteSections": row["completeSections"],
                "dryRunStatus": dry.solverStatus,
                "regenStatus": row["status"],
                "dryRunElapsedSeconds": round(dry_elapsed, 3),
                "regenElapsedSeconds": row["elapsedSeconds"],
                "parityExact": (
                    dry.projectedScheduledSessions == row["scheduledSessions"]
                    and dry.projectedCompleteSections == row["completeSections"]
                    and dry.solverStatus == row["status"]
                ),
            }
        )

    # 5. allocationPolicy comparison on full 56-course 4-rec case (with 5.0s budget)
    all_4_ids = [
        "rec-increase-teacher-load",
        "rec-enable-planning-window",
        "rec-change-delivery-mode",
        "rec-change-teacher-assignment-mode",
    ]
    for policy_name in ("preferences", "balanced", "first-feasible"):
        pol_req = apply_patches(base, recs, all_4_ids, budget=5.0)
        pol_req.allocationPolicy = policy_name  # type: ignore[assignment]
        ts = time.monotonic()
        pol_res = solve_academic_schedule(pol_req)
        rows.append(summarize_run(f"all-4 recs allocationPolicy={policy_name}", pol_req, pol_res, time.monotonic() - ts))

    output = {
        "catalogSummary": {
            "period": "2027-I",
            "courses": len(base.courses),
            "teachers": len(base.teachers),
            "rooms": len(base.rooms),
            "classrooms": sum(1 for r in base.rooms if r.kind == "classroom"),
            "laboratories": sum(1 for r in base.rooms if r.kind == "laboratory"),
            "sections": len(base.sections),
            "requirements": len(base.requirements),
            "totalDemandMinutes": sum(r.durationMinutes for r in base.requirements),
            "nominalTeacherCapacityAt600": sum(t.maxWeeklyMinutes for t in base.teachers),
            "teachersWithSaturdayAvailability": teachers_with_sat,
            "roomsWithSaturdayAvailability": rooms_with_sat,
            "coursesWithSingleTeacherShortfallAt600": len(course_shortfalls),
        },
        "courseShortfallsAt600": course_shortfalls,
        "advisorRecommendationOrder": [r.id for r in recs],
        "advisorBottleneckCount": len(bottlenecks),
        "anonymizedLoadAdjustmentsCount": len(anonymized_load_adjustments),
        "anonymizedLoadAdjustments": anonymized_load_adjustments,
        "runs": rows,
        "simulationVsRegenerationParity": parity_checks,
    }
    print(json.dumps(output, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
