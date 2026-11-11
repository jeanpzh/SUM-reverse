"""T8: independently invented synthetic scheduling counterexamples, no external data."""
import pytest

from models import SolveScheduleRequest
from solver import SearchHooks, solve_academic_schedule
from test_solver_scale import assert_hard_constraints


def fixture(mode='continuous', rooms=False, priority=False):
    durations = [30, 30] if mode == 'split' or rooms else [30]
    finish = 540 if rooms else 1200 + sum(durations)
    windows = [dict(day=1, startMinute=480, endMinute=finish)]
    fixed = [dict(day=1, startMinute=480, endMinute=540 if rooms else 1200)]
    courses = [dict(courseId=c, estimatedDemand=10, targetCapacity=10,
        deliveryMode=mode if c == 'X' else 'continuous',
        weeklySessions=[dict(id=str(i), durationMinutes=d) for i, d in enumerate(durations if c == 'X' else [fixed[0]['endMinute'] - 480])]) for c in ['X', 'Y']]
    sections = [dict(id=c, courseId=c, capacity=10 if c == 'X' else 20) for c in ['X', 'Y']]
    requirements = [dict(id=c['courseId'] + w['id'], sectionId=c['courseId'], courseId=c['courseId'],
        durationMinutes=w['durationMinutes'], order=i) for c in courses for i, w in enumerate(c['weeklySessions'])]
    teachers = [dict(id='A', courseIds=['X'] if rooms else ['X', 'Y'], availability=windows, maxWeeklyMinutes=1000,
        appointmentTier=0, categoryRank=1)]
    if rooms:
        teachers.append(dict(id='Y', courseIds=['Y'], availability=fixed, maxWeeklyMinutes=1000, appointmentTier=0, categoryRank=1))
    if priority:
        teachers.append(dict(id='C', courseIds=['X'], availability=windows, maxWeeklyMinutes=1000, appointmentTier=2, categoryRank=1))
    return SolveScheduleRequest.model_validate(dict(courses=courses, sections=sections, requirements=requirements,
        teachers=teachers, rooms=([dict(id='R0', capacity=20, availability=windows), dict(id='R1', capacity=10, availability=windows)] if rooms else
            [dict(id='R0', capacity=10, availability=windows), dict(id='RY', capacity=20, availability=fixed)]),
        windows=windows, startStepMinutes=30, maxTimeSeconds=2))


@pytest.mark.parametrize('mode', ['continuous', 'split'])
@pytest.mark.parametrize('priority', [False, True])
def test_late_positions_restore_coverage_and_best_teacher(mode, priority):
    req = fixture(mode, priority=priority)
    result = solve_academic_schedule(req)
    assert_hard_constraints(req, result)
    assert result.coverageProof == 'complete'
    assert {a.teacherId for a in result.assignments} == {'A'}
    assert all(level.proven for level in result.prelation.levels)


@pytest.mark.parametrize('mode', ['continuous', 'split'])
def test_every_compatible_room_is_available(mode):
    req = fixture(mode, rooms=True)
    result = solve_academic_schedule(req)
    assert_hard_constraints(req, result)
    assert result.coverageProof == 'complete'
    assert {a.roomId for a in result.assignments if a.sectionId == 'X'} == {'R1'}
    assert all(level.proven for level in result.prelation.levels)


def oracle(req):
    """Independent enumeration of whole sections for these tiny, policy-free fixtures.

    No solver helpers or CP-SAT: build all times/rooms/teachers, then reject conflicts.
    Preferences are absent here; compare coverage and the three prelation values.
    """
    from itertools import product
    def covers(resource, day, start, end):
        return any(w.day == day and w.startMinute <= start and end <= w.endMinute for w in resource.availability)
    options = []
    for sec in req.sections:
        course = next(c for c in req.courses if c.courseId == sec.courseId)
        items = sorted((r for r in req.requirements if r.sectionId == sec.id), key=lambda r: r.order)
        candidates = [()]
        for teacher in req.teachers:
            if sec.courseId not in teacher.courseIds:
                continue
            blocks = [[r] for r in items] if course.deliveryMode == 'split' else [items]
            block_options = []
            for block in blocks:
                choices = []
                duration = sum(r.durationMinutes for r in block)
                for w in req.windows:
                    for start in range(w.startMinute, w.endMinute - duration + 1, req.startStepMinutes):
                        if not covers(teacher, w.day, start, start + duration):
                            continue
                        room_lists, cur = [], start
                        for r in block:
                            room_lists.append([(r.id, sec.id, teacher.id, room.id, w.day, cur, cur + r.durationMinutes)
                                for room in req.rooms if room.capacity >= sec.capacity and covers(room, w.day, cur, cur + r.durationMinutes)])
                            cur += r.durationMinutes
                        choices.extend(product(*room_lists))
                block_options.append(choices)
            candidates.extend(tuple(a for block in blocks for a in block) for blocks in product(*block_options))
        options.append(candidates)
    teachers = {t.id: t for t in req.teachers}
    best = (0, 0, 0, 0)
    for combination in product(*options):
        rows = [a for section in combination for a in section]
        if any(sum(a[6] - a[5] for a in rows if a[2] == tid) > teacher.maxWeeklyMinutes for tid, teacher in teachers.items()):
            continue
        if any(a[4] == b[4] and a[5] < b[6] and b[5] < a[6] and (a[2] == b[2] or a[3] == b[3])
               for i, a in enumerate(rows) for b in rows[i + 1:]):
            continue
        pairs = {(a[1], a[2]) for a in rows}
        key = (len(rows), -sum(teachers[t].appointmentTier == 2 for _, t in pairs),
            -sum(teachers[t].appointmentTier == 1 for _, t in pairs), -sum(teachers[t].categoryRank for _, t in pairs))
        best = max(best, key)
    return best


@pytest.mark.parametrize('mode', ['continuous', 'split'])
@pytest.mark.parametrize('rooms,priority', [(True, False), (False, False), (False, True)])
def test_matches_independent_exhaustive_oracle(mode, rooms, priority):
    req = fixture(mode, rooms=rooms, priority=priority)
    result = solve_academic_schedule(req)
    assert (len(result.assignments), *(-x.value for x in result.prelation.levels)) == oracle(req)


@pytest.mark.parametrize('mode,marker', [('continuous', 'opt_'), ('continuous', 'room_'), ('split', 'start_'), ('split', 'room_')])
@pytest.mark.parametrize('complete', [False, True])
@pytest.mark.parametrize('reason', ['time', 'cancelled'])
def test_generation_interrupt_preserves_witness_without_prelating_proof(monkeypatch, complete, reason, mode, marker):
    import solver
    req = fixture(mode, rooms=not complete)
    now, cancel = [0.0], [False]
    monkeypatch.setattr(solver.time, 'monotonic', lambda: now[0])
    original = solver.cp_model.CpModel.new_bool_var
    def interrupt(self, name):
        var = original(self, name)
        if name.startswith(marker):
            if reason == 'time':
                now[0] = req.maxTimeSeconds
            else:
                cancel[0] = True
        return var
    monkeypatch.setattr(solver.cp_model.CpModel, 'new_bool_var', interrupt)
    result = solve_academic_schedule(req, SearchHooks(should_cancel=lambda: cancel[0]))
    assert result.assignments
    assert_hard_constraints(req, result)
    assert result.coverageProof == ('complete' if complete else 'inconclusive')
    assert result.limitReason == (None if complete else reason)
    assert all(not x.proven for x in result.prelation.levels)


def test_first_witness_published_before_capacity_or_model():
    phases, witnesses = [], []
    result = solve_academic_schedule(fixture(), SearchHooks(on_phase=phases.append,
        on_improvement=lambda rows: witnesses.append((list(phases), list(rows)))))
    assert witnesses[0][0] == ['preparing']
    assert witnesses[0][1]
    assert len(result.assignments) == len(fixture().requirements)


def test_cancel_before_generation_has_no_false_proofs():
    result = solve_academic_schedule(fixture(), SearchHooks(should_cancel=lambda: True))
    assert result.coverageProof == 'inconclusive'
    assert result.limitReason == 'cancelled'
    assert not result.assignments
    assert all(not x.proven for x in result.prelation.levels)
