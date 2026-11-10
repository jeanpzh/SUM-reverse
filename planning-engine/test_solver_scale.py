"""Pure synthetic catalog scale regression. No servers, snapshots or provider calls."""
import json
from pathlib import Path
import subprocess
import time

import pytest
from models import SolveScheduleRequest
from solver import solve_academic_schedule


@pytest.fixture(scope='module')
def scale_request():
    # Resolve only explicit pure TypeScript imports; no app/bootstrap or configuration.
    root = Path(__file__).resolve().parents[1]
    script = r'''
      import { registerHooks } from 'node:module'
      registerHooks({ resolve(specifier, context, next) {
        if (specifier.startsWith('.') && specifier.endsWith('.js')) {
          return next(specifier.slice(0, -3) + '.ts', context)
        }
        return next(specifier, context)
      } })
      const { createDemoCatalog } = await import('./backend/src/programacion-academica/demo-catalog.ts')
      console.log(JSON.stringify(createDemoCatalog()))
    '''
    catalog = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', script], cwd=root, text=True))
    windows = catalog['windows']
    courses, sections, requirements = [], [], []
    for course in catalog['courses']:
        # Reproduce the full synthetic historical section demand, preserving its size.
        demand = 180 if course['cycle'] % 2 else 90
        courses.append({**course, 'estimatedDemand': demand, 'targetCapacity': 45})
        for ordinal in range(1, (demand + 44) // 45 + 1):
            sid = f"{course['courseId']}:{ordinal}"
            sections.append(dict(id=sid, courseId=course['courseId'], capacity=45, cycle=course['cycle'], ordinal=ordinal))
            for order, session in enumerate(course['weeklySessions']):
                requirements.append(dict(id=f'{sid}:{order}', sectionId=sid, courseId=course['courseId'], order=order,
                                         durationMinutes=session['durationMinutes'], type=session['type']))
    return SolveScheduleRequest.model_validate(dict(
        courses=courses, sections=sections, requirements=requirements, windows=windows,
        teachers=[dict(**t, maxWeeklyMinutes=600, availability=windows, facultyId='FISI', qualificationSource='synthetic') for t in catalog['referenceTeachers']],
        rooms=[dict(**r, availability=windows) for r in catalog['referenceRooms']],
        planningPolicy=dict(period='2027-I'), maxTimeSeconds=0.8))


def test_scale_useful_within_advisor_budget(scale_request):
    started = time.monotonic()
    result = solve_academic_schedule(scale_request)
    elapsed = time.monotonic() - started
    print(f'initial: {len(scale_request.courses)} courses/{len(scale_request.teachers)} teachers/{len(scale_request.rooms)} rooms/{len(scale_request.sections)} sections/{len(scale_request.requirements)} sessions; {elapsed:.3f}s, {len(result.assignments)} assigned, {result.status}')
    assert_hard_constraints(scale_request, result)
    assert (len(scale_request.courses), len(scale_request.teachers), len(scale_request.rooms), len(scale_request.sections), len(scale_request.requirements)) == (56, 91, 49, 166, 332)
    assert elapsed < 1.0
    assert len(result.assignments) >= 100


def patched_request(req, initial, split):
    from advisor import build_deterministic_analysis
    from models import AdvisorAnalyzeRequest
    assigned = {a.id for a in initial.assignments}
    analysis = AdvisorAnalyzeRequest(**{k: v for k, v in req.model_dump().items() if k in AdvisorAnalyzeRequest.model_fields},
        proposalId='synthetic-scale', editVersion=0, assignments=initial.assignments, diagnostics=initial.diagnostics,
        pending=[dict(sessionId=r.id, sectionId=r.sectionId, courseId=r.courseId, durationMinutes=r.durationMinutes)
                 for r in req.requirements if r.id not in assigned])
    copy = req.model_copy(deep=True)
    for rec in build_deterministic_analysis(analysis)[2]:
        patch = rec.patch
        if patch.kind == 'increase_teacher_load':
            for adj in patch.adjustments:
                next(t for t in copy.teachers if t.id == adj.teacherId).maxWeeklyMinutes = adj.nextMaxWeeklyMinutes
        elif patch.kind == 'enable_planning_window':
            copy.planningPolicy.allowAfternoon = bool(patch.allowAfternoon)
            copy.planningPolicy.allowSaturday = bool(patch.allowSaturday)
        elif split and patch.kind == 'change_delivery_mode':
            for c in copy.courses:
                if c.courseId in patch.courseIds:
                    c.deliveryMode = 'split'
    return copy


def test_scale_patches(scale_request):
    initial_request = scale_request.model_copy(update={'maxTimeSeconds': 2.5})
    initial = solve_academic_schedule(initial_request)
    for split, budget in [(False, 0.8), (True, 0.8), (True, 2.5)]:
        req = patched_request(scale_request, initial, split)
        req.maxTimeSeconds = budget
        started = time.monotonic()
        result = solve_academic_schedule(req)
        elapsed = time.monotonic() - started
        print(f'patches split={split} budget={budget}: {elapsed:.3f}s, {len(result.assignments)}/{len(req.requirements)} sessions {len({a.sectionId for a in result.assignments})}/{len(req.sections)} sections, {result.status}')
        assert_hard_constraints(req, result)
        assert elapsed < budget + 0.2
        assert len(result.assignments) >= (300 if split else 280)


def assert_hard_constraints(req, result):
    from collections import Counter, defaultdict
    from solver import availability_covers, is_eligible_for_course, planning_time_rank
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
        assert a.id not in seen
        seen.add(a.id)
        r, s, t, room, w = requirements[a.id], sections[a.sectionId], teachers[a.teacherId], rooms[a.roomId], a.interval
        assert r.sectionId == s.id and r.courseId == s.courseId
        assert w.endMinute - w.startMinute == r.durationMinutes
        assert a.sessionType == r.type
        assert is_eligible_for_course(t, s.courseId, req.planningPolicy is not None)
        assert room.capacity >= s.capacity
        assert not req.planningPolicy or r.type != 'L' or room.kind == 'laboratory'
        assert availability_covers(t.availability, w.day, w.startMinute, w.endMinute)
        assert availability_covers(room.availability, w.day, w.startMinute, w.endMinute)
        assert any(x.day == w.day and x.startMinute <= w.startMinute and w.endMinute <= x.endMinute for x in req.windows)
        grouped[s.id].append(a)
        loads[t.id] += r.durationMinutes
        taught[t.id, s.courseId].add(s.id)
    for tid, load in loads.items():
        assert load <= teachers[tid].maxWeeklyMinutes
        for limit in teachers[tid].sectionLimits or []:
            assert len(taught[tid, limit.courseId]) <= limit.maxSections
    for sid, placed in grouped.items():
        assert {a.id for a in placed} == {r.id for r in req.requirements if r.sectionId == sid}
        assert len({a.teacherId for a in placed}) == 1
        course = courses[sections[sid].courseId]
        ordered = sorted(placed, key=lambda a: requirements[a.id].order)
        blocks = [[a] for a in ordered] if course.deliveryMode == 'split' else [ordered]
        for block in blocks:
            w = block[0].interval
            duration = sum(requirements[a.id].durationMinutes for a in block)
            assert planning_time_rank(course.cycle, w.startMinute, w.day, duration, req.planningPolicy) is not None
            assert any(x.day == w.day and (w.startMinute - x.startMinute) % req.startStepMinutes == 0 for x in req.windows)
            for a, b in zip(block, block[1:]):
                assert a.interval.day == b.interval.day and a.interval.endMinute == b.interval.startMinute
    for i, a in enumerate(result.assignments):
        for b in result.assignments[i + 1:]:
            sa, sb = sections[a.sectionId], sections[b.sectionId]
            shared = a.teacherId == b.teacherId or a.roomId == b.roomId or (
                req.planningPolicy and sa.cycle is not None and sa.ordinal is not None and (sa.cycle, sa.ordinal) == (sb.cycle, sb.ordinal))
            if shared:
                assert a.interval.day != b.interval.day or a.interval.endMinute <= b.interval.startMinute or b.interval.endMinute <= a.interval.startMinute


def test_deadline_during_construction_preserves_valid_incumbent(scale_request, monkeypatch):
    import solver
    now = [0.0]
    monkeypatch.setattr(solver.time, 'monotonic', lambda: now[0])
    original = solver.cp_model.CpModel.new_bool_var
    def expire_after_first_candidate(self, name):
        var = original(self, name)
        now[0] = 1.0
        return var
    monkeypatch.setattr(solver.cp_model.CpModel, 'new_bool_var', expire_after_first_candidate)
    monkeypatch.setattr(solver.cp_model.CpSolver, 'solve', lambda *args: pytest.fail('Search must not start after deadline'))
    result = solve_academic_schedule(scale_request)
    assert result.status == 'search-limit' and result.limitReason == 'time'
    assert result.assignments
    assert_hard_constraints(scale_request, result)


def test_split_honors_fifteen_minute_start_step():
    from test_advisor_agent import sample
    req = sample()
    req.courses[0].deliveryMode = 'split'
    windows = [dict(day=1, startMinute=480, endMinute=510)]
    data = {k: v for k, v in req.model_dump().items() if k in SolveScheduleRequest.model_fields}
    data['windows'] = windows
    data['startStepMinutes'] = 15
    for c in data['courses']:
        for session in c['weeklySessions']:
            session['durationMinutes'] = 15
    for r in data['requirements']:
        r['durationMinutes'] = 15
    for resource in data['teachers'] + data['rooms']:
        resource['availability'] = windows
    solve = SolveScheduleRequest.model_validate(data)
    result = solve_academic_schedule(solve)
    assert result.status == 'complete'
    assert {a.interval.startMinute for a in result.assignments} == {480, 495}
    assert_hard_constraints(solve, result)


def test_restricted_candidates_never_claim_impossible():
    from test_advisor_agent import sample
    req = sample()
    req.courses[0].deliveryMode = 'split'
    req.teachers[0].maxWeeklyMinutes = 600
    # Every day/start/room combination is otherwise valid, but the shared
    # teacher cannot cover both components. Multiple rooms trigger sampling.
    req.windows = req.windows[:1]
    req.teachers[0].availability = req.windows
    req.rooms[0].availability = req.windows
    req.rooms.append(req.rooms[0].model_copy(update={'id': 'R2'}))
    solve = SolveScheduleRequest(**{k: v for k, v in req.model_dump().items() if k in SolveScheduleRequest.model_fields})
    result = solve_academic_schedule(solve)
    assert result.status == 'search-limit'
    assert result.limitReason == 'explorations'
    assert not result.assignments
