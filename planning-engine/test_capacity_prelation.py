"""PA-ENGINE-2 public-interface tests; independently invented synthetic fixtures."""
from collections import Counter

from models import SolveScheduleRequest
from solver import solve_academic_schedule


def request(courses=None, teachers=None, count=4, duration=360):
    courses = courses or ['X']
    windows = [dict(day=d, startMinute=480, endMinute=1200) for d in range(1, 6)]
    sections = [dict(id=f'{c}-{i}', courseId=c, capacity=10) for c in courses for i in range(count)]
    return SolveScheduleRequest.model_validate(dict(
        courses=[dict(courseId=c, estimatedDemand=10 * count, targetCapacity=10,
                      weeklySessions=[dict(id='T', durationMinutes=duration)]) for c in courses],
        sections=sections,
        requirements=[dict(id=s['id'] + '-T', sectionId=s['id'], courseId=s['courseId'],
                           durationMinutes=duration, order=0) for s in sections],
        teachers=[dict(availability=windows, **t) for t in (teachers or [dict(id='A', courseIds=courses, maxWeeklyMinutes=600)])],
        rooms=[dict(id='R', capacity=10, availability=windows)], windows=windows, maxTimeSeconds=2.5))


def solve(req):
    result = solve_academic_schedule(req)
    loads = Counter()
    for a in result.assignments:
        loads[a.teacherId] += a.interval.endMinute - a.interval.startMinute
    assert all(loads[t.id] <= t.maxWeeklyMinutes for t in req.teachers)
    return result


def test_authorized_capacity_shortfall_is_proven():
    result = solve(request())
    assert len(result.assignments) == 1
    assert result.status == 'impossible'
    assert result.coverageProof == 'shortfall-proven'
    assert result.capacityCertificate.model_dump() == dict(proven=True, requiredSectionsTotal=4,
        coverableSectionsTotal=1, courses=[dict(courseId='X', requiredSections=4, coverableSections=1, requiredMinutes=1440)])
    assert any(d.code == 'TEACHER_CAPACITY_SHORTFALL' for d in result.diagnostics)


def test_shared_teacher_capacity_is_joint():
    result = solve(request(courses=['X', 'Y'], count=2, teachers=[
        dict(id='A', courseIds=['X', 'Y'], maxWeeklyMinutes=600),
        dict(id='B', courseIds=['X', 'Y'], maxWeeklyMinutes=600)]))
    assert result.capacityCertificate.proven
    assert result.capacityCertificate.coverableSectionsTotal == 2
    assert sum(c.requiredSections - c.coverableSections for c in result.capacityCertificate.courses) == 2
    assert result.coverageProof == 'shortfall-proven'


def test_exception_decision_and_remaining_teacher_gap():
    req = request(teachers=[dict(id='A', courseIds=['X'], maxWeeklyMinutes=600,
        exceptionMaxWeeklyMinutes=1000, exceptionKind='voluntary-declaration')])
    result = solve(req)
    assert len(result.assignments) == 1
    assert [d.model_dump() for d in result.decisions] == [
        dict(id='teacher-load-exception:A', kind='teacher-load-exception', teacherId='A', courseIds=['X'],
             exceptionKind='voluntary-declaration', additionalMinutes=120, sectionsUnlocked=1, basis='capacity-relaxation'),
        dict(id='additional-teacher:X', kind='additional-teacher', teacherId=None, courseIds=['X'],
             exceptionKind=None, additionalMinutes=720, sectionsUnlocked=2, basis='capacity-relaxation')]


def test_faculty_precedes_contract_preference():
    req = request(count=1, duration=60, teachers=[
        dict(id='C', courseIds=['X'], maxWeeklyMinutes=600, appointmentTier=2, categoryRank=1),
        dict(id='A', courseIds=['X'], maxWeeklyMinutes=600, appointmentTier=0, categoryRank=9)])
    req.teachers[0].preferences = req.windows
    result = solve(req)
    assert {a.teacherId for a in result.assignments} == {'A'}
    assert result.prelation.levels[0].value == 0


def test_prelating_does_not_freeze_assignments_before_coverage():
    req = request(courses=['X', 'Y'], count=1, duration=60, teachers=[
        dict(id='A', courseIds=['X', 'Y'], maxWeeklyMinutes=60, appointmentTier=0, categoryRank=1),
        dict(id='C', courseIds=['X'], maxWeeklyMinutes=60, appointmentTier=2, categoryRank=1)])
    result = solve(req)
    assert result.coverageProof == 'complete'
    assert {(a.sectionId, a.teacherId) for a in result.assignments} == {('Y-0', 'A'), ('X-0', 'C')}
    assert result.prelation.levels[0].value == 1


def test_interfaculty_precedes_contract():
    result = solve(request(count=1, duration=60, teachers=[
        dict(id='C', courseIds=['X'], maxWeeklyMinutes=60, appointmentTier=2, categoryRank=1),
        dict(id='I', courseIds=['X'], maxWeeklyMinutes=60, appointmentTier=1, categoryRank=9)]))
    assert {a.teacherId for a in result.assignments} == {'I'}
    assert [x.value for x in result.prelation.levels] == [0, 1, 9]


def test_lower_category_rank_precedes_preferences():
    req = request(count=1, duration=60, teachers=[
        dict(id='A', courseIds=['X'], maxWeeklyMinutes=60, appointmentTier=0, categoryRank=9),
        dict(id='B', courseIds=['X'], maxWeeklyMinutes=60, appointmentTier=0, categoryRank=1)])
    req.teachers[0].preferences = req.windows
    # Exhaustive candidate set: optimality claims can be checked as well.
    req.windows = req.windows[:1]
    req.windows[0].endMinute = 540
    result = solve(req)
    assert {a.teacherId for a in result.assignments} == {'B'}
    assert [(x.value, x.proven) for x in result.prelation.levels] == [(0, True), (0, True), (1, True)]


def test_missing_priority_data_disables_prelation():
    req = request(count=1, duration=60, teachers=[dict(id='A', courseIds=['X'], maxWeeklyMinutes=60, categoryRank=1)])
    result = solve(req)
    assert result.prelation is None
    assert any(d.code == 'PRELATION_DATA_MISSING' for d in result.diagnostics)


def test_section_limits_restrict_exceptions_too():
    req = request(teachers=[dict(id='A', courseIds=['X'], maxWeeklyMinutes=600,
        exceptionMaxWeeklyMinutes=2000, exceptionKind='vrap-authorization',
        sectionLimits=[dict(courseId='X', maxSections=1)])])
    result = solve(req)
    assert result.capacityCertificate.coverableSectionsTotal == 1
    assert [(d.kind, d.sectionsUnlocked, d.additionalMinutes) for d in result.decisions] == [('additional-teacher', 3, 1080)]


def test_fewest_exception_teachers_precedes_fewest_extra_minutes():
    req = request(count=2, duration=60, teachers=[
        dict(id='A', courseIds=['X'], maxWeeklyMinutes=0, exceptionMaxWeeklyMinutes=120, exceptionKind='voluntary-declaration'),
        dict(id='B', courseIds=['X'], maxWeeklyMinutes=50, exceptionMaxWeeklyMinutes=60, exceptionKind='vrap-authorization')])
    result = solve(req)
    assert [(d.teacherId, d.additionalMinutes, d.sectionsUnlocked) for d in result.decisions] == [('A', 120, 2)]
    assert not result.assignments


def test_extra_minutes_are_minimal_after_exception_count():
    req = request(count=1, duration=60, teachers=[
        dict(id='A', courseIds=['X'], maxWeeklyMinutes=0, exceptionMaxWeeklyMinutes=120, exceptionKind='voluntary-declaration'),
        dict(id='B', courseIds=['X'], maxWeeklyMinutes=50, exceptionMaxWeeklyMinutes=60, exceptionKind='vrap-authorization')])
    result = solve(req)
    assert [(d.teacherId, d.additionalMinutes) for d in result.decisions] == [('B', 10)]


def test_capacity_and_proven_precheck_gaps_can_be_combined():
    req = request(courses=['X', 'Y'], count=2, teachers=[
        dict(id='A', courseIds=['X'], maxWeeklyMinutes=600),
        dict(id='B', courseIds=['Y'], maxWeeklyMinutes=1000)])
    for section in req.sections:
        if section.courseId == 'Y':
            section.capacity = 20
    result = solve(req)
    assert len(result.assignments) == 1
    assert result.coverageProof == 'shortfall-proven'
    assert result.status == 'impossible'
    assert result.limitReason is None


def test_truncated_time_search_cannot_prove_a_capacity_feasible_gap():
    req = request(count=2, duration=60, teachers=[dict(id='A', courseIds=['X'], maxWeeklyMinutes=600)])
    req.windows = [req.windows[0].model_copy(update={'endMinute': 540})]
    req.rooms.append(req.rooms[0].model_copy(update={'id': 'R2'}))
    result = solve(req)
    assert result.capacityCertificate.proven
    assert result.capacityCertificate.coverableSectionsTotal == 2
    assert len(result.assignments) == 1
    assert result.coverageProof == 'inconclusive'
    assert result.status == 'search-limit'
    assert result.limitReason == 'explorations'


def test_new_wire_defaults_and_time_limit_validation():
    import pytest
    from pydantic import ValidationError
    from models import SolveScheduleResponse, TeacherInput
    response = SolveScheduleResponse(status='search-limit', assignments=[], exploredCandidates=0,
        candidateVisits=0, backtracks=0, diagnostics=[]).model_dump()
    assert {k: response[k] for k in ('coverageProof', 'capacityCertificate', 'decisions', 'prelation')} == dict(
        coverageProof='inconclusive', capacityCertificate=None, decisions=[], prelation=None)
    req = request(count=1, duration=60)
    assert SolveScheduleRequest.model_validate({**req.model_dump(), 'maxTimeSeconds': 120}).maxTimeSeconds == 120
    with pytest.raises(ValidationError):
        SolveScheduleRequest.model_validate({**req.model_dump(), 'maxTimeSeconds': 121})
    teacher = req.teachers[0].model_dump()
    with pytest.raises(ValidationError):
        TeacherInput.model_validate({**teacher, 'exceptionMaxWeeklyMinutes': 600})
    with pytest.raises(ValidationError):
        TeacherInput.model_validate({**teacher, 'categoryRank': 10})


def test_missing_rank_also_disables_prelation():
    result = solve(request(count=1, duration=60, teachers=[
        dict(id='A', courseIds=['X'], maxWeeklyMinutes=60, appointmentTier=0)]))
    assert result.prelation is None
    assert any(d.code == 'PRELATION_DATA_MISSING' for d in result.diagnostics)


def test_sampled_candidates_do_not_claim_prelating_optimality():
    result = solve(request(count=1, duration=60, teachers=[
        dict(id='A', courseIds=['X'], maxWeeklyMinutes=60, appointmentTier=0, categoryRank=1)]))
    assert result.status == 'complete'
    assert result.coverageProof == 'complete'
    assert all(not level.proven for level in result.prelation.levels)


def test_decision_ids_and_order_are_deterministic():
    req = request(courses=['Y', 'X'], count=1, duration=60, teachers=[
        dict(id='B', courseIds=['Y'], maxWeeklyMinutes=0),
        dict(id='A', courseIds=['X'], maxWeeklyMinutes=0, exceptionMaxWeeklyMinutes=60,
             exceptionKind='vrap-authorization')])
    first = solve(req)
    second = solve(req)
    assert [d.model_dump() for d in first.decisions] == [d.model_dump() for d in second.decisions]
    assert [d.id for d in first.decisions] == ['teacher-load-exception:A', 'additional-teacher:Y']
