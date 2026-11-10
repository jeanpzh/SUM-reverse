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
    req.selectedRecommendationIds = []
    ids = [r.id for r in build_deterministic_analysis(req)[2]]
    model = FakeModel([call('inspect_bottlenecks'), call('simulate_patches_cpsat', {'recommendation_ids': ids}, 'call2'), AIMessage(content=json.dumps({'summary': 'Revisar DOCENTE_001', 'prioritizedIds': ids}))])
    result = run(req, model)
    assert result.source.mode == 'llm-assisted'
    assert len(model.histories) == 3
    payload = json.dumps(model.histories)
    assert 'Synthetic Teacher Name' not in payload
    assert 'synthetic-teacher-id' not in payload
    assert 'DOCENTE_001' in payload
    assert result.summary == 'Revisar Synthetic Teacher Name'
    assert result.verifiedImpact.recommendationIds == []
    assert result.verifiedImpact.projectedCompleteSections == 0
    assert [s.toolName for s in result.reasoningSteps] == ['simulate_patches_cpsat', 'inspect_bottlenecks', 'simulate_patches_cpsat']


@pytest.mark.parametrize('error,reason', [(TimeoutError(), 'timeout'), (RuntimeError('secret upstream response'), 'upstream_error')])
def test_provider_failure_fallback_only_executed_steps(error, reason):
    result = run(sample(), FakeModel([error]))
    assert result.source.mode == 'deterministic-fallback'
    assert result.source.fallbackReason == reason
    assert len(result.reasoningSteps) == 1
    assert result.reasoningSteps[0].toolName == 'simulate_patches_cpsat'
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
    assert result.json()['verifiedImpact']['solverStatus'] in ('complete', 'impossible', 'search-limit')


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
    assert body['verifiedImpact']['solverStatus'] in ('complete', 'impossible', 'search-limit')
