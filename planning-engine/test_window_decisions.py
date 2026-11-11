"""T6a public response tests with independently invented, tiny synthetic data."""
import pytest

from models import CapacityDecision, SolveScheduleRequest
from solver import solve_academic_schedule


def request(durations=(180, 120), windows=None, **policy):
    windows = windows or [dict(day=1, startMinute=840, endMinute=1320)]
    return SolveScheduleRequest.model_validate(dict(
        courses=[dict(courseId='X', cycle=7, estimatedDemand=10, targetCapacity=10,
            weeklySessions=[dict(id=str(i), durationMinutes=d) for i, d in enumerate(durations)])],
        sections=[dict(id='X-1', courseId='X', capacity=10)],
        requirements=[dict(id=f'X-1-{i}', sectionId='X-1', courseId='X',
            durationMinutes=d, order=i) for i, d in enumerate(durations)],
        teachers=[dict(id='A', courseIds=['X'], maxWeeklyMinutes=3000, availability=windows)],
        rooms=[dict(id='R', capacity=10, availability=windows)], windows=windows,
        planningPolicy=dict(period='synthetic', **policy), maxTimeSeconds=0.5))


def window_decisions(result):
    return [d.model_dump() for d in result.decisions if d.basis == 'window-precheck']


def test_afternoon_option_does_not_schedule_afternoon():
    req = request(durations=(300,))
    before = req.model_dump()
    result = solve_academic_schedule(req)
    assert window_decisions(result) == [dict(id='planning-window:afternoon', kind='planning-window',
        teacherId=None, exceptionKind=None, courseIds=['X'], additionalMinutes=0,
        sectionsUnlocked=1, basis='window-precheck', policyChange=dict(allowAfternoon=True))]
    assert result.assignments == []
    assert result.status == 'impossible' and result.coverageProof == 'shortfall-proven'
    assert req.model_dump() == before


def test_saturday_option_does_not_schedule_saturday():
    result = solve_academic_schedule(request(durations=(60,),
        windows=[dict(day=6, startMinute=480, endMinute=780)]))
    assert [(d['id'], d['sectionsUnlocked'], d['courseIds'], d['policyChange'])
        for d in window_decisions(result)] == [
        ('planning-window:saturday', 1, ['X'], dict(allowSaturday=True))]
    assert result.assignments == []


def test_split_option_does_not_change_continuous_delivery():
    req = request(windows=[dict(day=1, startMinute=1080, endMinute=1320)])
    result = solve_academic_schedule(req)
    assert [(d['id'], d['sectionsUnlocked'], d['courseIds']) for d in window_decisions(result)] == [
        ('delivery-mode-split', 1, ['X'])]
    assert 'policyChange' not in window_decisions(result)[0]
    assert result.assignments == []
    assert req.courses[0].deliveryMode == 'continuous'


def test_single_options_count_the_same_section_independently():
    result = solve_academic_schedule(request(durations=(300,), windows=[
        dict(day=1, startMinute=840, endMinute=1320),
        dict(day=6, startMinute=480, endMinute=780)]))
    assert [(d['id'], d['sectionsUnlocked']) for d in window_decisions(result)] == [
        ('planning-window:afternoon', 1), ('planning-window:saturday', 1)]


def test_combination_and_insufficient_options_report_only_their_sections():
    req = request(durations=(180, 180), windows=[dict(day=6, startMinute=480, endMinute=780)])
    # Y is a separately invented course with one component too long even for Saturday.
    req.courses.append(req.courses[0].model_copy(update={'courseId': 'Y',
        'weeklySessions': [req.courses[0].weeklySessions[0].model_copy(update={'durationMinutes': 360})]}))
    req.sections.append(req.sections[0].model_copy(update={'id': 'Y-1', 'courseId': 'Y'}))
    req.requirements.append(req.requirements[0].model_copy(update={
        'id': 'Y-1-0', 'sectionId': 'Y-1', 'courseId': 'Y', 'durationMinutes': 360}))
    req.teachers[0].courseIds.append('Y')
    result = solve_academic_schedule(req)
    assert window_decisions(result) == [dict(id='planning-window:combined-split', kind='planning-window',
        teacherId=None, exceptionKind=None, courseIds=['X'], additionalMinutes=0,
        sectionsUnlocked=1, basis='window-precheck',
        policyChange=dict(allowAfternoon=True, allowSaturday=True), requiresSplit=True)]
    assert [d.sessionIds for d in result.diagnostics if d.code == 'WINDOW_RELAXATION_INSUFFICIENT'] == [['Y-1-0']]
    assert result.assignments == []


def test_already_allowed_afternoon_is_not_offered():
    result = solve_academic_schedule(request(allowAfternoon=True,
        windows=[dict(day=6, startMinute=480, endMinute=780)]))
    assert [d['id'] for d in window_decisions(result)] == ['planning-window:saturday']


def test_already_split_course_is_not_offered_split_again():
    req = request(durations=(300,), windows=[dict(day=1, startMinute=840, endMinute=1320)])
    req.courses[0].deliveryMode = 'split'
    result = solve_academic_schedule(req)
    assert [d['id'] for d in window_decisions(result)] == ['planning-window:afternoon']


@pytest.mark.parametrize('policy', [dict(allowAfternoon=True), dict(allowSaturday=True)])
def test_no_exclusions_emit_no_window_information(policy):
    result = solve_academic_schedule(request(durations=(60,), **policy))
    assert result.status == 'complete'
    assert len(result.assignments) == 1
    assert window_decisions(result) == []
    assert not any(d.code.startswith('WINDOW_') for d in result.diagnostics)


def test_decisions_count_sections_and_sort_courses_after_capacity_decisions():
    req = request(durations=(300,))
    req.courses.append(req.courses[0].model_copy(update={'courseId': 'A'}))
    for cid, sid in [('X', 'X-2'), ('A', 'A-1')]:
        req.sections.append(req.sections[0].model_copy(update={'id': sid, 'courseId': cid}))
        req.requirements.append(req.requirements[0].model_copy(update={
            'id': sid + '-0', 'sectionId': sid, 'courseId': cid}))
    req.teachers[0].courseIds.append('A')
    req.teachers[0].maxWeeklyMinutes = 300
    result = solve_academic_schedule(req)
    assert [(d['courseIds'], d['sectionsUnlocked']) for d in window_decisions(result)] == [(['A', 'X'], 3)]
    assert result.decisions[-1].id == 'planning-window:afternoon'
    assert all(d.basis == 'capacity-relaxation' for d in result.decisions[:-1])
    assert result.capacityCertificate.coverableSectionsTotal == 1
    assert result.coverageProof == 'shortfall-proven'


def test_policy_change_omission_preserves_old_wire_shape():
    decision = CapacityDecision(id='additional-teacher:X', kind='additional-teacher',
        courseIds=['X'], additionalMinutes=60, sectionsUnlocked=1)
    assert decision.model_dump() == dict(id='additional-teacher:X', kind='additional-teacher',
        teacherId=None, courseIds=['X'], exceptionKind=None, additionalMinutes=60,
        sectionsUnlocked=1, basis='capacity-relaxation')
    decision = CapacityDecision(id='planning-window:afternoon', kind='planning-window',
        courseIds=['X'], additionalMinutes=0, sectionsUnlocked=1, basis='window-precheck',
        policyChange=dict(allowAfternoon=True, allowSaturday=None))
    assert decision.model_dump()['policyChange'] == dict(allowAfternoon=True)
    assert 'allowSaturday' not in decision.model_dump_json()


@pytest.mark.parametrize('windows, step, cycle', [
    ([dict(day=1, startMinute=465, endMinute=550)], 60, 1),
    ([dict(day=7, startMinute=480, endMinute=1320)], 15, 7),
])
def test_relaxation_preserves_start_grid_and_sunday_rules(windows, step, cycle):
    req = request(durations=(60,), windows=windows)
    req.startStepMinutes = step
    req.courses[0].cycle = cycle
    result = solve_academic_schedule(req)
    assert window_decisions(result) == []
    assert [d.sessionIds for d in result.diagnostics if d.code == 'WINDOW_RELAXATION_INSUFFICIENT'] == [['X-1-0']]


def test_expired_budget_keeps_schedule_and_does_not_claim_options(monkeypatch):
    import solver
    now = [0.0]
    monkeypatch.setattr(solver.time, 'monotonic', lambda: now[0])
    # The timetable solve is the only one with several workers; pin the count so the
    # marker does not depend on this machine's cores (capacity and stages use one).
    monkeypatch.setattr(solver, 'search_workers', lambda: 4)
    real_solve = solver.cp_model.CpSolver.solve

    def expire_after_timetable(self, *args):
        result = real_solve(self, *args)
        if self.parameters.num_search_workers == 4:
            now[0] = 0.5
        return result

    monkeypatch.setattr(solver.cp_model.CpSolver, 'solve', expire_after_timetable)
    result = solve_academic_schedule(request(durations=(300,)))
    assert result.status == 'impossible' and result.coverageProof == 'shortfall-proven'
    assert result.assignments == []
    assert result.capacityCertificate.proven
    assert window_decisions(result) == []
    assert [d.sessionIds for d in result.diagnostics if d.code == 'WINDOW_ANALYSIS_LIMIT'] == [['X-1-0']]
    assert not any(d.code == 'WINDOW_RELAXATION_INSUFFICIENT' for d in result.diagnostics)


def test_combined_decision_applies_both_requirements_and_resolves_section():
    # Two days provide actual non-overlapping resource capacity after relaxation.
    req = request(durations=(180, 180), windows=[dict(day=6, startMinute=480, endMinute=780),
        dict(day=1, startMinute=840, endMinute=1020)])
    decision = window_decisions(solve_academic_schedule(req))[0]
    assert decision['requiresSplit'] is True
    req.planningPolicy = req.planningPolicy.model_copy(update=decision['policyChange'])
    assert solve_academic_schedule(req).assignments == []
    req.courses[0].deliveryMode = 'split'
    result = solve_academic_schedule(req)
    assert result.status == 'complete'
    assert len(result.assignments) == 2


def test_combined_windows_without_split_do_not_require_split_in_mixed_result(monkeypatch):
    import solver
    # Isolate the combined-only branch: a synthetic policy requiring both flags.
    monkeypatch.setattr(solver, 'planning_time_rank', lambda cycle, start, day, duration, policy:
        0 if policy.allowAfternoon and policy.allowSaturday else None)
    req = request(durations=(180, 180), windows=[dict(day=6, startMinute=480, endMinute=780)])
    # X requires split, Z fits continuously only after both window flags change.
    req.courses.append(req.courses[0].model_copy(update={'courseId': 'Z',
        'weeklySessions': [req.courses[0].weeklySessions[0].model_copy(update={'durationMinutes': 60})]}))
    req.sections.append(req.sections[0].model_copy(update={'id': 'Z-1', 'courseId': 'Z'}))
    req.requirements.append(req.requirements[0].model_copy(update={
        'id': 'Z-1-0', 'sectionId': 'Z-1', 'courseId': 'Z', 'durationMinutes': 60}))
    import time
    decisions = [d.model_dump() for d in solver._window_options(req,
        {r.id for r in req.requirements}, time.monotonic() + 1)[0]]
    assert [(d['courseIds'], d.get('requiresSplit')) for d in decisions] == [(['Z'], None), (['X'], True)]
