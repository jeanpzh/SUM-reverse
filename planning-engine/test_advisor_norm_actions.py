"""Tests for per-Recomendacion normative contrast and non-executable management actions."""
from __future__ import annotations

import asyncio

from langchain_core.messages import AIMessage

import advisor_catalog
from advisor import analyze_proposal_with_advisor, build_deterministic_analysis
from advisor_catalog import (
    CATALOG_BY_KIND,
    MAX_MANAGEMENT_ACTIONS,
    attach_normative_contrasts,
    build_management_actions,
    infer_normative_teacher_type,
    query_kind_normative_contrast,
)
from advisor_diagnosis import diagnose
from models import (
    AdvisorAnalyzeRequest,
    DiagnosticOutput,
    PendingSessionItem,
    PlanningPolicyInput,
    RequiredSessionInput,
    RoomInput,
    SectionInput,
    TeacherInput,
    TimeInterval,
    WeeklySessionInput,
)
from normative import NormativeCitation, NormativeRequest, NormativeResponse, default_retriever
from test_advisor_agent import FakeModel
from test_advisor_parity import CASES


class _SpyRetriever:
    def __init__(self, delegate=None) -> None:
        self._delegate = delegate or default_retriever()
        self.calls: list[NormativeRequest] = []

    def query(self, request: NormativeRequest) -> NormativeResponse:
        self.calls.append(request)
        return self._delegate.query(request)


def test_per_kind_normative_metadata_and_local_authorization_policy() -> None:
    expected_topics = {
        "increase_teacher_load": ("teacher_load", True),
        "enable_planning_window": ("planning_window", True),
        "change_delivery_mode": ("delivery_mode", False),
        "incorporate_reference_resource": ("reference_resource", False),
    }
    questions: set[str] = set()
    for kind, (topic, requires_auth) in expected_topics.items():
        handler = CATALOG_BY_KIND[kind]
        assert handler.normative_topic == topic
        assert handler.requires_external_authorization is requires_auth
        if requires_auth:
            assert handler.authorization_note
        else:
            assert handler.authorization_note is None
        assert handler.normative_question.strip()
        questions.add(handler.normative_question)
    assert len(questions) == 4


def test_normative_contrast_caching_queries_at_most_once_per_kind_and_respects_bounds() -> None:
    req = CASES["all_four_kinds"]()

    class _ExpandedRetriever(_SpyRetriever):
        def query(self, request: NormativeRequest) -> NormativeResponse:
            resp = super().query(request)
            fake_cits = [
                NormativeCitation(
                    id=f"c-{i}",
                    documentId="doc-1",
                    title="Doc",
                    article=f"Art. {i}",
                    page=i,
                    url="https://medicina.unmsm.edu.pe/wp-content/uploads/2026/03/RESOLUCION-RECTORAL-001380-2026-R.pdf",
                    excerpt="Extracto sintético.",
                    sourceClass="normative",
                    scope="UNMSM",
                    reviewedAt="2026-06-01",
                    effectiveFrom="2026-01-01",
                    effectiveTo=None,
                )
                for i in range(1, 6)
            ]
            return resp.model_copy(
                update={
                    "citations": fake_cits,
                    "gaps": [f"Brecha {i}" for i in range(1, 7)],
                }
            )

    expanded_spy = _ExpandedRetriever()
    _, _, recs, _ = build_deterministic_analysis(req)
    assert len(recs) == 4
    # Append an extra variant of an existing kind to prove caching queries per kind, not per variant.
    recs_with_extra_variant = list(recs) + [
        recs[0].model_copy(update={"id": "rec-extra-variant", "normativeContrast": None})
    ]
    assert len(recs_with_extra_variant) > len({r.patch.kind for r in recs_with_extra_variant})

    cache: dict = {}
    attach_normative_contrasts(req, recs_with_extra_variant, cache=cache, retriever=expanded_spy)
    attach_normative_contrasts(req, recs_with_extra_variant, cache=cache, retriever=expanded_spy)

    # At most 4 queries (one per unique kind), even with 5 recommendations and repeated attachment.
    distinct_kinds = {r.patch.kind for r in recs_with_extra_variant}
    assert len(expanded_spy.calls) == len(distinct_kinds) <= 4
    for r in recs_with_extra_variant:
        assert r.normativeContrast is not None
        assert len(r.normativeContrast.citations) <= 3
        assert len(r.normativeContrast.gaps) <= 4


def test_teacher_regime_inference_for_ordinario_vs_unknown_and_missing_policy() -> None:
    req_unknown = CASES["sample"]()
    assert infer_normative_teacher_type(req_unknown) == "unknown"

    req_ordinario = req_unknown.model_copy(deep=True)
    for t in req_ordinario.teachers:
        t.category = "principal"
    assert infer_normative_teacher_type(req_ordinario) == "ordinario"

    # Mixed regimes must fall back safely to unknown instead of overclaiming ordinario.
    req_mixed = req_ordinario.model_copy(deep=True)
    extra_teacher = req_mixed.teachers[0].model_copy(update={"id": "T-CONTR", "category": "contratado"})
    req_mixed.teachers.append(extra_teacher)
    assert infer_normative_teacher_type(req_mixed) == "unknown"

    # Missing planningPolicy adds a local-period inference gap on normativeContrast.
    req_no_policy = req_ordinario.model_copy(update={"planningPolicy": None})
    contrast_no_policy = query_kind_normative_contrast(req_no_policy, "increase_teacher_load")
    assert any("Periodo de contexto local inferido" in g for g in contrast_no_policy.gaps)

    contrast_ordinario = query_kind_normative_contrast(req_ordinario, "increase_teacher_load")
    contrast_unknown = query_kind_normative_contrast(req_unknown, "increase_teacher_load")
    assert contrast_ordinario.requiresExternalAuthorization is True
    assert contrast_unknown.status == "not-determined"
    assert contrast_ordinario.citations  # Real local corpus hits articles for ordinario load


def test_build_management_actions_rules_ordering_cap_and_non_executable() -> None:
    windows = [TimeInterval(day=1, startMinute=480, endMinute=720)]
    req = AdvisorAnalyzeRequest(
        proposalId="prop-mgmt",
        editVersion=0,
        courses=[
            {
                "courseId": "C1",
                "name": "Algoritmos",
                "estimatedDemand": 30,
                "targetCapacity": 30,
                "weeklySessions": [{"id": "L", "durationMinutes": 120, "type": "L"}],
                "cycle": 3,
            },
            {
                "courseId": "C2",
                "name": "Redes",
                "estimatedDemand": 30,
                "targetCapacity": 30,
                "weeklySessions": [{"id": "T", "durationMinutes": 120, "type": "T"}],
                "cycle": 5,
            },
        ],
        teachers=[
            TeacherInput(id="T1", name="Doc 1", courseIds=["C1", "C2"], maxWeeklyMinutes=0, availability=windows),
        ],
        rooms=[RoomInput(id="R1", capacity=10, availability=windows, kind="laboratory")],
        sections=[
            SectionInput(id="S1", courseId="C1", capacity=30, cycle=3),
            SectionInput(id="S2", courseId="C1", capacity=30, cycle=3),
            SectionInput(id="S3", courseId="C2", capacity=30, cycle=5),
        ],
        requirements=[
            RequiredSessionInput(id="S1:L", sectionId="S1", courseId="C1", durationMinutes=120, order=0, type="L"),
            RequiredSessionInput(id="S2:L", sectionId="S2", courseId="C1", durationMinutes=120, order=0, type="L"),
            RequiredSessionInput(id="S3:T", sectionId="S3", courseId="C2", durationMinutes=120, order=0, type="T"),
        ],
        assignments=[],
        pending=[
            PendingSessionItem(sessionId="S1:L", sectionId="S1", courseId="C1", durationMinutes=120),
            PendingSessionItem(sessionId="S2:L", sectionId="S2", courseId="C1", durationMinutes=120),
            PendingSessionItem(sessionId="S3:T", sectionId="S3", courseId="C2", durationMinutes=120),
        ],
        diagnostics=[
            DiagnosticOutput(code="NO_COMPATIBLE_ROOM", message="Sin laboratorio compatible", sessionIds=["S1:L", "S2:L"]),
        ],
        planningPolicy=PlanningPolicyInput(period="2027-I", allowAfternoon=False, allowSaturday=False),
        windows=windows,
    )
    diag = diagnose(req)
    actions = build_management_actions(req, diag)

    assert 1 <= len(actions) <= MAX_MANAGEMENT_ACTIONS
    assert len({a.id for a in actions}) == len(actions)
    assert all(a.executable is False for a in actions)
    assert all(len(a.citations) <= 2 for a in actions)
    assert actions == sorted(actions, key=lambda a: (-a.affectedSessionCount, a.id))
    assert {a.kind for a in actions} == {
        "process_load_authorization",
        "negotiate_teacher_availability",
        "request_external_room",
        "review_room_requirement",
        "review_section_demand",
    }

    zero_req = CASES["zero_pending"]()
    assert build_management_actions(zero_req, diagnose(zero_req)) == []


def test_end_to_end_advisor_attaches_contrast_and_management_actions_and_keeps_normative_context(
    monkeypatch,
) -> None:
    req = CASES["all_four_kinds"]()
    spy = _SpyRetriever()
    monkeypatch.setattr(advisor_catalog, "default_retriever", lambda: spy)

    response = asyncio.run(
        analyze_proposal_with_advisor(
            req,
            env={},
            model_factory=lambda _env: (None, None),
        )
    )
    assert response.normativeContext is not None
    assert response.recommendations
    assert response.managementActions is not None and len(response.managementActions) >= 1
    for rec in response.recommendations:
        assert rec.normativeContrast is not None
        if rec.patch.kind in ("increase_teacher_load", "enable_planning_window"):
            assert rec.normativeContrast.requiresExternalAuthorization is True
            assert rec.normativeContrast.authorizationNote
        else:
            assert rec.normativeContrast.requiresExternalAuthorization is False
            assert rec.normativeContrast.authorizationNote is None
    assert all(action.executable is False for action in response.managementActions)
    assert all(len(action.citations) <= 2 for action in response.managementActions)
    # 1 query per recommendation kind present in response/management actions (<=4)
    assert len(spy.calls) <= 4

    # Also verify LLM exploration path requesting extra variants preserves contrast & respects query budget.
    spy_llm = _SpyRetriever()
    monkeypatch.setattr(advisor_catalog, "default_retriever", lambda: spy_llm)
    script = [
        AIMessage(
            content="",
            tool_calls=[
                {
                    "name": "request_variants",
                    "args": {"kind": "incorporate_reference_resource", "scope": "rooms"},
                    "id": "call-rooms",
                }
            ],
        ),
        AIMessage(
            content='{"summary": "Resumen sintético.", "prioritizedIds": [], "rationalesById": {}}'
        ),
    ]
    llm_response = asyncio.run(
        analyze_proposal_with_advisor(
            req,
            env={},
            model_factory=lambda _env: (FakeModel(script), "scripted-mock"),
        )
    )
    assert llm_response.source.mode == "llm-assisted"
    assert all(r.normativeContrast is not None for r in llm_response.recommendations)
    assert len(spy_llm.calls) <= 4
