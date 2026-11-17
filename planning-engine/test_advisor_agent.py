"""Independently constructed synthetic fixtures; never connect to live providers."""
import asyncio
import json

import pytest
from langchain_core.messages import AIMessage

from advisor import analyze_proposal_with_advisor, build_deterministic_analysis
from advisor_agent import create_chat_model, run_cpsat_dry_run
from models import AdvisorAnalyzeRequest, SolveScheduleRequest
from solver import solve_academic_schedule
from main import app
from fastapi.testclient import TestClient


def sample():
    windows = [{'day': d, 'startMinute': 480, 'endMinute': 600} for d in (1, 2)]
    return AdvisorAnalyzeRequest.model_validate({
        'proposalId': 'synthetic-proposal', 'editVersion': 2,
        'courses': [{'courseId': 'C1', 'name': 'Synthetic course', 'estimatedDemand': 10, 'targetCapacity': 10,
                     'weeklySessions': [{'id': 'T', 'durationMinutes': 120}, {'id': 'P', 'durationMinutes': 120}],
                     'deliveryMode': 'continuous', 'cycle': 1}],
        'teachers': [{'id': 'synthetic-teacher-id', 'name': 'Synthetic Teacher Name', 'courseIds': ['C1'],
                      'availability': windows, 'maxWeeklyMinutes': 120}],
        'rooms': [{'id': 'R1', 'capacity': 20, 'availability': windows}],
        'sections': [{'id': 'S1', 'courseId': 'C1', 'capacity': 10, 'cycle': 1, 'ordinal': 1}],
        'requirements': [{'id': x, 'sectionId': 'S1', 'courseId': 'C1', 'durationMinutes': 120, 'order': i} for i, x in enumerate(('T', 'P'))],
        'pending': [{'sessionId': x, 'sectionId': 'S1', 'courseId': 'C1', 'durationMinutes': 120} for x in ('T', 'P')],
        'assignments': [], 'diagnostics': [], 'windows': windows,
    })


def test_dry_run_closed_patches_deep_copy_and_empty_selection():
    req = sample()
    before = req.model_dump()
    recs = build_deterministic_analysis(req)[2]
    ids = [r.id for r in recs]
    impact = run_cpsat_dry_run(req, recs, ids)
    assert impact.projectedCompleteSections == 1
    assert impact.projectedScheduledSessions == 2
    assert impact.solverStatus == 'complete'
    assert req.model_dump() == before
    empty = run_cpsat_dry_run(req, recs, [])
    assert empty.recommendationIds == []
    assert empty.projectedScheduledSessions == 0
    with pytest.raises(ValueError):
        run_cpsat_dry_run(req, recs, ['invented'])
    with pytest.raises(ValueError):
        run_cpsat_dry_run(req, recs, [ids[0], ids[0]])


class FakeModel:
    def __init__(self, replies):
        self.replies = iter(replies)
        self.histories = []

    def bind_tools(self, tools):
        self.tools = tools
        return self

    async def ainvoke(self, messages):
        self.histories.append([m.model_dump() if hasattr(m, 'model_dump') else m for m in messages])
        answer = next(self.replies)
        if isinstance(answer, Exception):
            raise answer
        return answer


def call(name, args=None, id='call'):
    return AIMessage(content='', tool_calls=[{'name': name, 'args': args or {}, 'id': id}])


def run(req, model, env=None):
    return asyncio.run(analyze_proposal_with_advisor(req, env=env or {}, model_factory=lambda _: (model, 'mock adapter')))


def test_two_round_tool_loop_sanitizes_all_envelopes_and_preserves_selection():
    req = sample()
    ids = [r.id for r in build_deterministic_analysis(req)[2]]
    req.selectedRecommendationIds = ids
    model = FakeModel([call('inspect_bottlenecks'), AIMessage(content=json.dumps({'summary': 'Revisar DOCENTE_001', 'prioritizedIds': ids}))])
    result = run(req, model)
    assert result.source.mode == 'llm-assisted'
    assert len(model.histories) == 2
    payload = json.dumps(model.histories)
    assert 'Synthetic Teacher Name' not in payload
    assert 'synthetic-teacher-id' not in payload
    assert 'DOCENTE_001' in payload
    assert result.summary == 'Revisar Synthetic Teacher Name'
    assert result.verifiedImpact.recommendationIds == ids
    assert result.verifiedImpact.projectedCompleteSections == 1
    assert [s.toolName for s in result.reasoningSteps] == ['simulate_patches_cpsat', 'inspect_bottlenecks']


@pytest.mark.parametrize('error,reason', [(TimeoutError(), 'timeout'), (RuntimeError('secret upstream response'), 'upstream_error')])
def test_provider_failure_fallback_only_executed_steps(error, reason):
    result = run(sample(), FakeModel([error]))
    assert result.source.mode == 'deterministic-fallback'
    assert result.source.fallbackReason == reason
    assert result.reasoningSteps == []
    assert result.verifiedImpact is None
    assert 'secret' not in result.model_dump_json()


def test_round_and_call_limits_and_unknown_tools():
    for replies in ([call('inspect_bottlenecks')] * 3, [call('invented')], [AIMessage(content='', tool_calls=[{'name': 'inspect_bottlenecks', 'args': {}, 'id': str(i)} for i in range(5)])]):
        model = FakeModel(replies)
        result = run(sample(), model)
        assert result.source.mode == 'deterministic-fallback'
        assert len(model.histories) <= 3
        assert len(result.reasoningSteps) <= 5


def test_unknown_ids_http_rejected_without_provider(monkeypatch):
    monkeypatch.setenv('SUM_LLM_PROVIDER', '')
    req = sample()
    req.selectedRecommendationIds = ['invented']
    with TestClient(app) as client:
        assert client.post('/v1/advisor', json=req.model_dump()).status_code == 422


def test_not_configured_and_empty_selection():
    req = sample()
    req.selectedRecommendationIds = []
    result = asyncio.run(analyze_proposal_with_advisor(req, env={'SUM_LLM_PROVIDER': 'disabled'}))
    assert result.source.fallbackReason == 'not_configured'
    assert result.verifiedImpact.recommendationIds == []


def test_cumulative_teacher_slack_across_courses():
    req = sample()
    req.teachers[0].maxWeeklyMinutes = 300
    course = req.courses[0].model_copy(deep=True)
    course.courseId = 'C2'
    req.courses.append(course)
    req.teachers[0].courseIds.append('C2')
    for item in list(req.pending):
        req.pending.append(item.model_copy(update={'courseId': 'C2', 'sectionId': 'S2', 'sessionId': item.sessionId + '2'}))
    recs = build_deterministic_analysis(req)[2]
    patch = next(r.patch for r in recs if r.patch.kind == 'increase_teacher_load')
    assert patch.adjustments[0].nextMaxWeeklyMinutes >= 480


def test_split_independent_components_same_teacher_and_no_conflicts():
    req = sample()
    req.courses[0].deliveryMode = 'split'
    req.teachers[0].maxWeeklyMinutes = 600
    solve = SolveScheduleRequest(**{k: v for k, v in req.model_dump().items() if k in SolveScheduleRequest.model_fields})
    result = solve_academic_schedule(solve)
    assert result.status == 'complete'
    assert len(result.assignments) == 2
    assert len({a.teacherId for a in result.assignments}) == 1
    assert len({a.interval.day for a in result.assignments}) == 2


def test_provider_configuration_without_live_calls(monkeypatch):
    import langchain.chat_models
    captured = []
    monkeypatch.setattr(langchain.chat_models, 'init_chat_model', lambda *a, **kw: captured.append((a, kw)) or object())
    for provider in ('bedrock_converse', 'ollama', 'openai'):
        model, label = create_chat_model({'SUM_LLM_PROVIDER': provider, 'SUM_LLM_API_KEY': 'synthetic-placeholder'})
        assert model is not None and provider in label
        assert captured[-1][1]['model_provider'] == provider
    assert create_chat_model({'SUM_LLM_PROVIDER': 'disabled'}) == (None, None)


def test_total_timeout():
    class Slow(FakeModel):
        async def ainvoke(self, messages):
            await asyncio.sleep(1)
    result = run(sample(), Slow([]), {'SUM_LLM_TIMEOUT_MS': '100'})
    assert result.source.fallbackReason == 'timeout'


@pytest.mark.parametrize("status", ["UNKNOWN", "FEASIBLE"])
def test_solver_timeout_is_search_limit(monkeypatch, status):
    from types import SimpleNamespace
    import solver
    class TimedOut:
        parameters = SimpleNamespace()
        num_booleans = 0
        num_branches = 0
        num_conflicts = 0
        def solve(self, model):
            return getattr(solver.cp_model, status)
        def value(self, var):
            return 0
    monkeypatch.setattr(solver.cp_model, 'CpSolver', TimedOut)
    req = sample()
    result = solve_academic_schedule(SolveScheduleRequest(**{k: v for k, v in req.model_dump().items() if k in SolveScheduleRequest.model_fields}))
    assert result.status == 'search-limit'
    assert result.limitReason == 'time'
    assert not result.assignments


def test_sanitizer_handles_quoted_names_and_short_ids():
    req = sample()
    req.teachers[0].id = 'X'
    req.teachers[0].name = 'Synthetic "Quoted" Teacher'
    model = FakeModel([call('inspect_bottlenecks'), AIMessage(content=json.dumps({'summary': 'Listo', 'prioritizedIds': []}))])
    result = run(req, model)
    payload = json.dumps(model.histories)
    assert 'Quoted' not in payload
    assert result.source.mode == 'llm-assisted'


def test_http_fallback_keeps_null_provider_label(monkeypatch):
    # No credentials or inherited provider configuration can trigger a real call.
    import main
    original = analyze_proposal_with_advisor
    async def synthetic(request):
        return await original(request, env={})
    monkeypatch.setattr(main, 'analyze_proposal_with_advisor', synthetic)
    with TestClient(app) as client:
        result = client.post('/v1/advisor', json=sample().model_dump())
    assert result.status_code == 200
    assert result.json()['source']['providerLabel'] is None
    assert result.json().get('verifiedImpact') is None


def test_split_preserves_cohort_constraints_across_courses():
    from models import PlanningPolicyInput
    req = sample()
    req.courses[0].deliveryMode = 'split'
    req.teachers[0].maxWeeklyMinutes = 600
    req.planningPolicy = PlanningPolicyInput(period='2027-I')
    req.courses.append(req.courses[0].model_copy(update={'courseId': 'C2'}))
    req.teachers.append(req.teachers[0].model_copy(update={'id': 'second-synthetic-teacher', 'courseIds': ['C2']}))
    req.rooms.append(req.rooms[0].model_copy(update={'id': 'R2'}))
    req.sections.append(req.sections[0].model_copy(update={'id': 'S2', 'courseId': 'C2'}))
    req.requirements.extend([r.model_copy(update={'id': r.id + '2', 'courseId': 'C2', 'sectionId': 'S2'}) for r in list(req.requirements)])
    solve = SolveScheduleRequest(**{k: v for k, v in req.model_dump().items() if k in SolveScheduleRequest.model_fields})
    result = solve_academic_schedule(solve)
    assert result.status != 'complete'
    assert len(result.assignments) == 2
    for i, a in enumerate(result.assignments):
        for b in result.assignments[i + 1:]:
            assert a.interval.day != b.interval.day or a.interval.endMinute <= b.interval.startMinute or b.interval.endMinute <= a.interval.startMinute


@pytest.mark.parametrize('afternoon,saturday,expected', [(False, True, {'allowAfternoon': True}), (True, False, {'allowSaturday': True})])
def test_http_partial_window_patch_omits_absent_flags_but_keeps_provider_null(monkeypatch, afternoon, saturday, expected):
    import main
    from models import PlanningPolicyInput
    req = sample()
    req.courses[0].cycle = 7
    req.planningPolicy = PlanningPolicyInput(period='2027-I', allowAfternoon=afternoon, allowSaturday=saturday)
    # Seven independently synthetic pending records activate the Saturday recommendation.
    req.pending = [req.pending[0].model_copy(update={'sessionId': f'pending-{i}'}) for i in range(7)]
    async def synthetic(request):
        return await analyze_proposal_with_advisor(request, env={})
    monkeypatch.setattr(main, 'analyze_proposal_with_advisor', synthetic)
    with TestClient(app) as client:
        response = client.post('/v1/advisor', json=req.model_dump())
    assert response.status_code == 200
    body = response.json()
    patch = next(r['patch'] for r in body['recommendations'] if r['patch']['kind'] == 'enable_planning_window')
    assert patch == {'kind': 'enable_planning_window', **expected}
    assert body['source']['providerLabel'] is None
    assert body.get('verifiedImpact') is None


def test_initial_consultation_never_runs_solver_even_on_model_tool_request(monkeypatch):
    import advisor_agent
    def forbidden(*args, **kwargs):
        raise AssertionError('Consultation must not run CP-SAT')
    monkeypatch.setattr(advisor_agent, 'run_cpsat_dry_run', forbidden)
    req = sample()
    for model in [None, FakeModel([call('simulate_patches_cpsat', {'recommendation_ids': []})])]:
        result = run(req, model)
        assert result.verifiedImpact is None
        assert not any(s.toolName == 'simulate_patches_cpsat' for s in result.reasoningSteps)


def test_narrative_preserves_deterministic_order():
    req = sample()
    ids = [r.id for r in build_deterministic_analysis(req)[2]]
    result = run(req, FakeModel([AIMessage(content=json.dumps({'summary': 'Texto sintético', 'prioritizedIds': list(reversed(ids))}))]))
    assert [r.id for r in result.recommendations] == ids


def test_advisor_emits_and_simulates_change_teacher_assignment_mode():
    windows = [{'day': d, 'startMinute': 480, 'endMinute': 720} for d in (1, 2)]
    req = AdvisorAnalyzeRequest.model_validate({
        'proposalId': 'synthetic-tpl', 'editVersion': 0,
        'courses': [{
            'courseId': 'C_TPL', 'name': 'Curso Mixto', 'estimatedDemand': 45, 'targetCapacity': 45,
            'weeklySessions': [
                {'id': 'T', 'durationMinutes': 120, 'type': 'T'},
                {'id': 'P', 'durationMinutes': 120, 'type': 'P'},
                {'id': 'L', 'durationMinutes': 120, 'type': 'L'},
            ],
            'deliveryMode': 'split', 'teacherAssignmentMode': 'single-teacher-section', 'cycle': 4,
        }],
        'teachers': [
            {'id': 'DOC_A', 'name': 'Docente A', 'courseIds': ['C_TPL'], 'availability': windows, 'maxWeeklyMinutes': 240},
            {'id': 'DOC_B', 'name': 'Docente B', 'courseIds': ['C_TPL'], 'availability': windows, 'maxWeeklyMinutes': 120},
        ],
        'rooms': [
            {'id': 'R1', 'capacity': 50, 'kind': 'classroom', 'availability': windows},
            {'id': 'LAB1', 'capacity': 50, 'kind': 'laboratory', 'availability': windows},
        ],
        'sections': [{'id': 'S1', 'courseId': 'C_TPL', 'capacity': 45, 'cycle': 4, 'ordinal': 1}],
        'requirements': [
            {'id': 'S1:T', 'sectionId': 'S1', 'courseId': 'C_TPL', 'durationMinutes': 120, 'type': 'T', 'order': 0},
            {'id': 'S1:P', 'sectionId': 'S1', 'courseId': 'C_TPL', 'durationMinutes': 120, 'type': 'P', 'order': 1},
            {'id': 'S1:L', 'sectionId': 'S1', 'courseId': 'C_TPL', 'durationMinutes': 120, 'type': 'L', 'order': 2},
        ],
        'pending': [
            {'sessionId': 'S1:T', 'sectionId': 'S1', 'courseId': 'C_TPL', 'durationMinutes': 120},
            {'sessionId': 'S1:P', 'sectionId': 'S1', 'courseId': 'C_TPL', 'durationMinutes': 120},
            {'sessionId': 'S1:L', 'sectionId': 'S1', 'courseId': 'C_TPL', 'durationMinutes': 120},
        ],
        'assignments': [], 'diagnostics': [], 'windows': windows,
        'planningPolicy': {'period': '2027-I', 'facultyId': 'FISI'},
    })
    recs = build_deterministic_analysis(req)[2]
    tpl_rec = next(r for r in recs if r.patch.kind == 'change_teacher_assignment_mode')
    assert tpl_rec.recommendedByDefault is False
    assert tpl_rec.patch.teacherAssignmentMode == 'tp-grouped-l-independent'
    impact = run_cpsat_dry_run(req, recs, [tpl_rec.id])
    assert impact.projectedScheduledSessions == 3
    assert impact.projectedCompleteSections == 1
    assert impact.solverStatus == 'complete'


def _five_class_request():
    windows = [{'day': d, 'startMinute': 480, 'endMinute': 1320} for d in range(1, 6)]
    return AdvisorAnalyzeRequest.model_validate({
        'proposalId': 'synthetic-five-classes',
        'editVersion': 0,
        'courses': [
            {
                'courseId': 'C_TPL',
                'name': 'Curso Mixto Ciclo 7',
                'estimatedDemand': 45,
                'targetCapacity': 45,
                'weeklySessions': [
                    {'id': 'T', 'durationMinutes': 120, 'type': 'T'},
                    {'id': 'P', 'durationMinutes': 120, 'type': 'P'},
                    {'id': 'L', 'durationMinutes': 120, 'type': 'L'},
                ],
                'deliveryMode': 'continuous',
                'teacherAssignmentMode': 'single-teacher-section',
                'cycle': 7,
            },
            {
                'courseId': 'C_REF',
                'name': 'Curso Sin Docente Local',
                'estimatedDemand': 45,
                'targetCapacity': 45,
                'weeklySessions': [
                    {'id': 'T', 'durationMinutes': 120, 'type': 'T'},
                ],
                'deliveryMode': 'continuous',
                'teacherAssignmentMode': 'single-teacher-section',
                'cycle': 4,
            },
        ],
        'teachers': [
            {'id': 'DOC_A', 'name': 'Docente Alfa', 'courseIds': ['C_TPL'], 'availability': windows, 'maxWeeklyMinutes': 240},
            {'id': 'DOC_B', 'name': 'Docente Beta', 'courseIds': ['C_TPL'], 'availability': windows, 'maxWeeklyMinutes': 120},
        ],
        'referenceTeachers': [
            {'id': 'DOC_REF', 'name': 'Docente Ref', 'courseIds': ['C_REF']},
        ],
        'rooms': [
            {'id': 'A1', 'capacity': 50, 'kind': 'classroom', 'availability': windows},
            {'id': 'LAB1', 'capacity': 50, 'kind': 'laboratory', 'availability': windows},
        ],
        'referenceRooms': [
            {'id': 'A_REF', 'name': 'Aula Ref', 'capacity': 50, 'kind': 'classroom'},
        ],
        'sections': [
            {'id': 'S1', 'courseId': 'C_TPL', 'capacity': 45, 'cycle': 7, 'ordinal': 1},
            {'id': 'S2', 'courseId': 'C_REF', 'capacity': 45, 'cycle': 4, 'ordinal': 1},
        ],
        'requirements': [
            {'id': 'S1:T', 'sectionId': 'S1', 'courseId': 'C_TPL', 'durationMinutes': 120, 'type': 'T', 'order': 0},
            {'id': 'S1:P', 'sectionId': 'S1', 'courseId': 'C_TPL', 'durationMinutes': 120, 'type': 'P', 'order': 1},
            {'id': 'S1:L', 'sectionId': 'S1', 'courseId': 'C_TPL', 'durationMinutes': 120, 'type': 'L', 'order': 2},
            {'id': 'S2:T', 'sectionId': 'S2', 'courseId': 'C_REF', 'durationMinutes': 120, 'type': 'T', 'order': 0},
        ],
        'pending': [
            {'sessionId': 'S1:T', 'sectionId': 'S1', 'courseId': 'C_TPL', 'durationMinutes': 120},
            {'sessionId': 'S1:P', 'sectionId': 'S1', 'courseId': 'C_TPL', 'durationMinutes': 120},
            {'sessionId': 'S1:L', 'sectionId': 'S1', 'courseId': 'C_TPL', 'durationMinutes': 120},
            {'sessionId': 'S2:T', 'sectionId': 'S2', 'courseId': 'C_REF', 'durationMinutes': 120},
            # Additional synthetic pending items to trigger Saturday window recommendation cleanly (>6)
            {'sessionId': 'S1:T2', 'sectionId': 'S1', 'courseId': 'C_TPL', 'durationMinutes': 60},
            {'sessionId': 'S1:P2', 'sectionId': 'S1', 'courseId': 'C_TPL', 'durationMinutes': 60},
            {'sessionId': 'S1:L2', 'sectionId': 'S1', 'courseId': 'C_TPL', 'durationMinutes': 60},
        ],
        'assignments': [],
        'diagnostics': [{'code': 'NO_COMPATIBLE_ROOM', 'message': 'Sin aula ref', 'sessionIds': ['S2:T']}],
        'windows': windows,
        'planningPolicy': {'period': '2027-I', 'facultyId': 'FISI', 'allowAfternoon': False, 'allowSaturday': False},
    })


def test_advisor_fifth_class_preserves_deterministic_order_exact_selection_and_no_consultation_sim(monkeypatch):
    import advisor_agent

    req = _five_class_request()
    recs = build_deterministic_analysis(req)[2]
    expected_ids = [
        'rec-increase-teacher-load',
        'rec-enable-planning-window',
        'rec-incorporate-reference-resource',
        'rec-change-delivery-mode',
        'rec-change-teacher-assignment-mode',
    ]
    assert [r.id for r in recs] == expected_ids

    # Consultation mode (selectedRecommendationIds is None) must never execute CP-SAT even if model asks.
    monkeypatch.setattr(advisor_agent, 'run_cpsat_dry_run', lambda *a, **kw: (_ for _ in ()).throw(AssertionError('Consultation must not simulate')))
    consult_res = run(req, FakeModel([call('simulate_patches_cpsat', {'recommendation_ids': expected_ids})]))
    assert consult_res.verifiedImpact is None
    assert [r.id for r in consult_res.recommendations] == expected_ids


def test_advisor_fifth_class_keeps_deterministic_order_under_llm_reorder_and_exact_selection():
    req = _five_class_request()
    recs = build_deterministic_analysis(req)[2]
    expected_ids = [r.id for r in recs]

    selected = ['rec-change-teacher-assignment-mode', 'rec-incorporate-reference-resource', 'rec-enable-planning-window']
    req.selectedRecommendationIds = selected
    reordered = list(reversed(expected_ids))
    result = run(req, FakeModel([AIMessage(content=json.dumps({'summary': 'Resumen sintético', 'prioritizedIds': reordered}))]))

    assert result.source.mode == 'llm-assisted'
    assert [r.id for r in result.recommendations] == expected_ids
    assert result.verifiedImpact is not None
    assert result.verifiedImpact.recommendationIds == selected
    assert result.verifiedImpact.projectedScheduledSessions == 4
    assert result.verifiedImpact.projectedCompleteSections == 2
    assert result.verifiedImpact.solverStatus == 'complete'


def test_simulation_vs_regeneration_parity_with_assignment_mode_and_saturday_non_invention():
    from models import PendingSessionItem, RoomInput, TeacherInput, TimeInterval
    from solver import get_effective_planning_windows

    req = _five_class_request()
    # Match pending strictly to actual requirements for exact regeneration parity.
    req.pending = [
        PendingSessionItem(sessionId=r.id, sectionId=r.sectionId, courseId=r.courseId, durationMinutes=r.durationMinutes)
        for r in req.requirements
    ]
    # Add extra pending items only after verifying 4 requirements or force afternoon + assignment mode:
    # Here senior cycle=7 + allowAfternoon=False -> rec-enable-planning-window triggers (allowAfternoon=True).
    recs = build_deterministic_analysis(req)[2]
    selected = ['rec-enable-planning-window', 'rec-incorporate-reference-resource', 'rec-change-delivery-mode', 'rec-change-teacher-assignment-mode']
    impact = run_cpsat_dry_run(req, recs, selected)

    # Regenerate identically through /v1/solve with maxTimeSeconds=2.5.
    regen = req.model_copy(deep=True)
    ref_windows = [TimeInterval(day=d, startMinute=480, endMinute=1320) for d in range(1, 6)]
    rec_map = {r.id: r.patch for r in recs}
    for rec_id in selected:
        patch = rec_map[rec_id]
        if patch.kind == 'enable_planning_window':
            if patch.allowAfternoon:
                regen.planningPolicy.allowAfternoon = True
            if patch.allowSaturday:
                regen.planningPolicy.allowSaturday = True
        elif patch.kind == 'change_delivery_mode':
            for c in regen.courses:
                if c.courseId in patch.courseIds:
                    c.deliveryMode = 'split'
        elif patch.kind == 'change_teacher_assignment_mode':
            for c in regen.courses:
                if c.courseId in patch.courseIds:
                    c.teacherAssignmentMode = patch.teacherAssignmentMode
        elif patch.kind == 'incorporate_reference_resource':
            for rt in regen.referenceTeachers:
                if rt.id in patch.teacherIds:
                    regen.teachers.append(TeacherInput(id=rt.id, name=rt.name, courseIds=rt.courseIds, maxWeeklyMinutes=600, availability=ref_windows, facultyId='FISI', qualificationSource='synthetic'))
            for rr in regen.referenceRooms:
                if rr.id in patch.roomIds:
                    regen.rooms.append(RoomInput(**rr.model_dump(), availability=ref_windows))

    regen.windows = get_effective_planning_windows(regen.windows, regen.planningPolicy)
    solve_payload = SolveScheduleRequest(
        courses=regen.courses,
        teachers=regen.teachers,
        rooms=regen.rooms,
        sections=regen.sections,
        requirements=regen.requirements,
        windows=regen.windows,
        startStepMinutes=regen.startStepMinutes,
        allocationPolicy=regen.allocationPolicy,
        planningPolicy=regen.planningPolicy,
        maxTimeSeconds=2.5,
    )
    with TestClient(app) as client:
        resp = client.post('/v1/solve', json=solve_payload.model_dump())
    assert resp.status_code == 200
    body = resp.json()
    assert len(body['assignments']) == impact.projectedScheduledSessions == 4
    assert body['status'] == impact.solverStatus == 'complete'
    assert all(a['interval']['day'] != 6 for a in body['assignments'])

