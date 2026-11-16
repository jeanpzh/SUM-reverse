"""Tests for bounded agentic advisor exploration, tool registry, privacy, and #44 ranking authority."""
from __future__ import annotations

import asyncio
import json
import os
import time
from pathlib import Path

import pytest
from langchain_core.messages import AIMessage

import advisor_agent
from advisor import analyze_proposal_with_advisor, build_deterministic_analysis
from advisor_agent import (
    MAX_AGENT_SIMULATIONS,
    MAX_TOOL_CALLS,
    MAX_TOOL_ROUNDS,
    RegisteredTool,
    build_advisor_tools,
)
from advisor_diagnosis import diagnose
from models import (
    AdvisorAnalyzeRequest,
    AssignmentOutput,
    CourseInput,
    PendingSessionItem,
    PlanningPolicyInput,
    ReferenceTeacherInput,
    RequiredSessionInput,
    RoomInput,
    SectionInput,
    TeacherInput,
    TimeInterval,
    WeeklySessionInput,
)
from solver import solve_academic_schedule
from test_advisor_agent import FakeModel, call
from test_advisor_parity import CASES
from test_advisor_variants import VARIANT_SNAPSHOTS, _build_scale_solve_request


def _make_exploration_request() -> AdvisorAnalyzeRequest:
    # 5 pending courses so C4/C5 sit outside IncreaseTeacherLoadKind's top-3 initial variants.
    # C_DONE has 0 pending items and must be rejected as an invalid scope.
    windows = [TimeInterval(day=d, startMinute=480, endMinute=1080) for d in range(1, 6)]
    courses = [
        CourseInput(
            courseId=f"C{i}",
            name=f"Course {i}",
            estimatedDemand=30,
            targetCapacity=30,
            weeklySessions=[
                WeeklySessionInput(id="T", durationMinutes=120),
                WeeklySessionInput(id="P", durationMinutes=120),
            ],
            deliveryMode="split" if i != 4 else "continuous",
            cycle=3,
        )
        for i in range(1, 6)
    ] + [
        CourseInput(
            courseId="C_DONE",
            name="Already Scheduled Course",
            estimatedDemand=30,
            targetCapacity=30,
            weeklySessions=[WeeklySessionInput(id="T", durationMinutes=120)],
            deliveryMode="continuous",
            cycle=3,
        )
    ]
    teachers = [
        TeacherInput(
            id="T-ALFA",
            name="María Elena Quispe",
            courseIds=["C1", "C2", "C3"],
            maxWeeklyMinutes=120,
            availability=windows,
        ),
        TeacherInput(
            id="T-BETA",
            name="Carlos Alberto Mendoza",
            courseIds=["C4", "C5", "C_DONE"],
            maxWeeklyMinutes=240,
            availability=windows,
        ),
    ]
    rooms = [
        RoomInput(id="R1", capacity=40, availability=windows, kind="classroom"),
        RoomInput(id="R2", capacity=40, availability=windows, kind="classroom"),
    ]
    sections = [
        SectionInput(id=f"S{i}", courseId=f"C{i}", capacity=30, cycle=3, ordinal=i)
        for i in range(1, 6)
    ] + [
        SectionInput(id="S_DONE", courseId="C_DONE", capacity=30, cycle=3, ordinal=6)
    ]
    requirements = []
    for i in range(1, 6):
        requirements.append(
            RequiredSessionInput(id=f"S{i}:T", sectionId=f"S{i}", courseId=f"C{i}", durationMinutes=120, order=0)
        )
        requirements.append(
            RequiredSessionInput(id=f"S{i}:P", sectionId=f"S{i}", courseId=f"C{i}", durationMinutes=120, order=1)
        )
    requirements.append(
        RequiredSessionInput(id="S_DONE:T", sectionId="S_DONE", courseId="C_DONE", durationMinutes=120, order=0)
    )
    # Assign S_DONE:T and C1/C2/C3/C5 pending with decreasing duration; C4 pending with 240 min (4th+ course).
    assignments = [
        AssignmentOutput(
            id="S_DONE:T",
            sectionId="S_DONE",
            teacherId="T-BETA",
            roomId="R1",
            interval=TimeInterval(day=1, startMinute=480, endMinute=600),
        )
    ]
    pending_durations = {"C1": 360, "C2": 300, "C3": 240, "C4": 180, "C5": 120}
    pending = []
    for i in range(1, 6):
        cid = f"C{i}"
        half = pending_durations[cid] // 2
        pending.append(PendingSessionItem(sessionId=f"S{i}:T", sectionId=f"S{i}", courseId=cid, durationMinutes=half))
        pending.append(PendingSessionItem(sessionId=f"S{i}:P", sectionId=f"S{i}", courseId=cid, durationMinutes=half))

    return AdvisorAnalyzeRequest(
        proposalId="prop-explore",
        editVersion=1,
        courses=courses,
        teachers=teachers,
        rooms=rooms,
        sections=sections,
        requirements=requirements,
        assignments=assignments,
        pending=pending,
        diagnostics=[],
        planningPolicy=PlanningPolicyInput(period="2027-I", allowAfternoon=False, allowSaturday=False),
        windows=windows,
        referenceTeachers=[
            ReferenceTeacherInput(id="T-REF-Z", name="Lucía Fernanda Paredes", courseIds=["C1"]),
        ],
    )


def _run_with_model(req: AdvisorAnalyzeRequest, model, env=None):
    return asyncio.run(
        analyze_proposal_with_advisor(
            req,
            env=env or {},
            model_factory=lambda _env: (model, "scripted-mock"),
        )
    )


def test_valid_exploration_path_integrates_variant_and_respects_measured_impact_order() -> None:
    req = _make_exploration_request()
    _, _, initial_recs, _ = build_deterministic_analysis(req)
    initial_ids = [r.id for r in initial_recs]
    assert "rec-increase-teacher-load-C4" not in initial_ids

    # Round 0: inspect diagnosis + request out-of-top-3 load variant for C4
    # Round 1: simulate C4 load variant + combined C4 & afternoon window
    # Round 2: LLM tries to demote load-all and override load rationale; rank authority & fixed load rationale must win.
    script = [
        AIMessage(
            content="",
            tool_calls=[
                {"name": "inspect_diagnosis", "args": {}, "id": "call-diag"},
                {
                    "name": "request_variants",
                    "args": {"kind": "increase_teacher_load", "scope": "C4"},
                    "id": "call-var",
                },
            ],
        ),
        AIMessage(
            content="",
            tool_calls=[
                {
                    "name": "simulate_patches_cpsat",
                    "args": {"recommendation_ids": ["rec-increase-teacher-load-C4"]},
                    "id": "call-sim-1",
                },
                {
                    "name": "simulate_patches_cpsat",
                    "args": {
                        "recommendation_ids": [
                            "rec-increase-teacher-load-C4",
                            "rec-enable-planning-window-both",
                        ]
                    },
                    "id": "call-sim-2",
                },
            ],
        ),
        AIMessage(
            content=json.dumps(
                {
                    "summary": "Priorizar variantes verificadas para DOCENTE_001 y DOCENTE_002.",
                    "prioritizedIds": [
                        "rec-enable-planning-window-both",
                        "rec-increase-teacher-load-C4",
                        "rec-increase-teacher-load-all",
                    ],
                    "rationalesById": {
                        "rec-increase-teacher-load-C4": "INTENTO DE CAMBIAR RACIONAL DOCENTE",
                        "rec-enable-planning-window-both": "Permite cubrir ciclos superiores junto con DOCENTE_002.",
                    },
                }
            )
        ),
    ]
    model = FakeModel(script)
    result = _run_with_model(req, model)

    assert result.source.mode == "llm-assisted"
    assert [s.toolName for s in result.reasoningSteps] == [
        "simulate_patches_cpsat",
        "inspect_diagnosis",
        "request_variants",
        "simulate_patches_cpsat",
        "simulate_patches_cpsat",
    ]
    assert len(result.recommendations) <= 8

    by_id = {r.id: r for r in result.recommendations}
    assert "rec-increase-teacher-load-C4" in by_id
    # Load rationale stays fixed (never replaced by LLM); window rationale uses rehydrated teacher name.
    assert "INTENTO DE CAMBIAR RACIONAL DOCENTE" not in by_id["rec-increase-teacher-load-C4"].rationale
    assert "Carlos Alberto Mendoza" in by_id["rec-enable-planning-window-both"].rationale
    assert "María Elena Quispe" in result.summary
    assert "Carlos Alberto Mendoza" in result.summary

    # Measured-impact authority: recs with strictly higher unlocked components stay ahead of lower ones
    # regardless of LLM prioritizedIds placing -both first.
    rec_ids = [r.id for r in result.recommendations]
    assert rec_ids.index("rec-increase-teacher-load-all") < rec_ids.index("rec-increase-teacher-load-C4")
    assert all(
        not r.recommendedByDefault
        for r in result.recommendations
        if r.patch.kind == "increase_teacher_load"
    )
    window_defaults = [
        r for r in result.recommendations if r.patch.kind == "enable_planning_window" and r.recommendedByDefault
    ]
    assert len(window_defaults) == 1


def test_requested_variant_pruned_at_zero_and_llm_can_reorder_within_ties() -> None:
    req = _make_exploration_request()
    # Add a 6th long continuous course C6 (lowest pending minutes -> outside top-5 initial delivery variants)
    # while C4 and C6 make -all present, so C6 is genuinely a narrow variant that unlocks 0 on its own and gets dropped.
    req.courses.append(
        CourseInput(
            courseId="C6",
            name="Course 6",
            estimatedDemand=30,
            targetCapacity=30,
            weeklySessions=[
                WeeklySessionInput(id="T", durationMinutes=120),
                WeeklySessionInput(id="P", durationMinutes=120),
            ],
            deliveryMode="continuous",
            cycle=3,
        )
    )
    req.sections.append(SectionInput(id="S6", courseId="C6", capacity=30, cycle=3, ordinal=7))
    req.requirements.extend([
        RequiredSessionInput(id="S6:T", sectionId="S6", courseId="C6", durationMinutes=120, order=0),
        RequiredSessionInput(id="S6:P", sectionId="S6", courseId="C6", durationMinutes=120, order=1),
    ])
    req.pending.extend([
        PendingSessionItem(sessionId="S6:T", sectionId="S6", courseId="C6", durationMinutes=60),
        PendingSessionItem(sessionId="S6:P", sectionId="S6", courseId="C6", durationMinutes=60),
    ])
    req.teachers[1].courseIds.append("C6")
    # Also make C5 continuous so ChangeDeliveryModeKind generates rec-change-delivery-mode-all.
    req.courses[4].deliveryMode = "continuous"

    script = [
        call("request_variants", {"kind": "change_delivery_mode", "scope": "C6"}, "c1"),
        call("simulate_patches_cpsat", {"recommendation_ids": ["rec-change-delivery-mode-C6"]}, "c2"),
        AIMessage(
            content=json.dumps(
                {
                    "summary": "Orden ajustado en empates.",
                    "prioritizedIds": [
                        "rec-increase-teacher-load-C2",
                        "rec-increase-teacher-load-C1",
                        "rec-change-delivery-mode-C6",
                    ],
                }
            )
        ),
    ]
    result = _run_with_model(req, FakeModel(script))
    assert result.source.mode == "llm-assisted"
    ids = [r.id for r in result.recommendations]
    # Narrow zero-impact requested variant rec-change-delivery-mode-C6 must be dropped by #44 rule!
    assert "rec-change-delivery-mode-C6" not in ids
    assert "rec-change-delivery-mode-all" in ids
    # Tied load variants C2 and C1 follow LLM prioritizedIds tie-break (C2 before C1),
    # while load-all (higher unlocked) remains ahead of both.
    assert ids.index("rec-increase-teacher-load-all") < ids.index("rec-increase-teacher-load-C2")
    assert ids.index("rec-increase-teacher-load-C2") < ids.index("rec-increase-teacher-load-C1")


@pytest.mark.parametrize(
    "tool_name,args",
    [
        ("request_variants", {"kind": "invented_kind", "scope": "all"}),
        ("request_variants", {"kind": "enable_planning_window", "scope": "morning"}),
        ("request_variants", {"kind": "enable_planning_window", "scope": "abrir todo"}),
        ("request_variants", {"kind": "increase_teacher_load", "scope": "UNKNOWN_COURSE"}),
        ("request_variants", {"kind": "increase_teacher_load", "scope": "C_DONE"}),
        ("request_variants", {"kind": "change_delivery_mode", "scope": "UNKNOWN_COURSE"}),
        ("request_variants", {"kind": "change_delivery_mode", "scope": "C_DONE"}),
        ("request_variants", {"kind": "incorporate_reference_resource", "scope": "students"}),
        ("request_variants", {"kind": "enable_planning_window"}),
        ("request_variants", {"kind": 123, "scope": "both"}),
        ("simulate_patches_cpsat", {"recommendation_ids": ["rec-does-not-exist"]}),
        ("inspect_diagnosis", {"extra": "arg"}),
    ],
)
def test_invalid_kind_scope_or_id_is_rejected_and_model_can_recover(tool_name: str, args: dict) -> None:
    req = _make_exploration_request()
    final = AIMessage(content=json.dumps({"summary": "Resumen tras corregir.", "prioritizedIds": []}))
    model = FakeModel([call(tool_name, args, "bad-call"), final])
    result = _run_with_model(req, model)
    # Nothing ran for the rejected call; the model saw the error and answered within budget.
    assert result.source.mode == "llm-assisted"
    assert [s.toolName for s in result.reasoningSteps] == ["simulate_patches_cpsat"]
    rejection = model.histories[1][-1]
    assert rejection["tool_call_id"] == "bad-call"
    assert '"error"' in rejection["content"]


def test_invalid_scope_error_lists_valid_scopes_and_context_exposes_them() -> None:
    req = _make_exploration_request()
    final = AIMessage(content=json.dumps({"summary": "ok", "prioritizedIds": []}))
    model = FakeModel([
        call("request_variants", {"kind": "increase_teacher_load", "scope": "teacher"}, "bad"),
        final,
    ])
    _run_with_model(req, model)
    context = json.loads(model.histories[0][1]["content"])
    assert context["variantScopes"]["enable_planning_window"] == ["afternoon", "both", "saturday"]
    assert "all" in context["variantScopes"]["increase_teacher_load"]
    assert "all" in model.histories[1][-1]["content"]


def test_only_invalid_calls_still_exhaust_the_round_budget() -> None:
    req = _make_exploration_request()
    bad = [call("request_variants", {"kind": "x", "scope": "y"}, f"b{i}") for i in range(MAX_TOOL_ROUNDS + 2)]
    result = _run_with_model(req, FakeModel(bad))
    assert result.source.mode == "deterministic-fallback"
    assert result.source.fallbackReason == "invalid_llm_output"


def test_exceeding_calls_rounds_and_simulation_budget_falls_back() -> None:
    req = _make_exploration_request()

    # 1. Exceeding MAX_TOOL_CALLS in a single round (5 calls > 4)
    five_calls = AIMessage(
        content="",
        tool_calls=[
            {"name": "inspect_diagnosis", "args": {}, "id": f"c{i}"}
            for i in range(MAX_TOOL_CALLS + 1)
        ],
    )
    res_calls = _run_with_model(req, FakeModel([five_calls, call("inspect_diagnosis", {}, "again")]))
    assert res_calls.source.mode == "deterministic-fallback"
    assert res_calls.source.fallbackReason == "invalid_llm_output"

    # 2. Exceeding MAX_TOOL_ROUNDS (attempting a 3rd tool round past MAX_TOOL_ROUNDS=2)
    # The model ignores the final-answer turn and keeps calling tools.
    too_many_rounds = [call("inspect_diagnosis", {}, f"r{i}") for i in range(MAX_TOOL_ROUNDS + 2)]
    res_rounds = _run_with_model(req, FakeModel(too_many_rounds))
    assert res_rounds.source.mode == "deterministic-fallback"
    assert res_rounds.source.fallbackReason == "invalid_llm_output"

    # 3. Direct registry verification: attempting > MAX_AGENT_SIMULATIONS fails validation cleanly
    _, _, recs, codec = build_deterministic_analysis(req)
    known = {r.id: r for r in recs}
    registry = build_advisor_tools(
        req,
        diagnose(req),
        [],
        known,
        [],
        {},
        lambda v: json.dumps(v),
    )
    sim_tool: RegisteredTool = registry["simulate_patches_cpsat"]
    for _ in range(MAX_AGENT_SIMULATIONS):
        valid = sim_tool.validate_args({"recommendation_ids": []})
        sim_tool.handler(valid)
    with pytest.raises(ValueError, match="budget exceeded"):
        sim_tool.validate_args({"recommendation_ids": []})


def test_exploration_timeout_fallback_preserves_executed_steps() -> None:
    req = _make_exploration_request()

    class MidExplorationTimeout(FakeModel):
        async def ainvoke(self, messages):
            self.histories.append(messages)
            reply = next(self.replies)
            if isinstance(reply, str) and reply == "SLEEP":
                await asyncio.sleep(0.5)
            return reply

    model = MidExplorationTimeout([call("inspect_diagnosis", {}, "c1"), "SLEEP"])
    result = _run_with_model(req, model, env={"SUM_LLM_TIMEOUT_MS": "200"})
    assert result.source.mode == "deterministic-fallback"
    assert result.source.fallbackReason == "timeout"
    assert [s.toolName for s in result.reasoningSteps] == [
        "simulate_patches_cpsat",
        "inspect_diagnosis",
    ]


def test_privacy_every_tool_sanitizes_all_teacher_names_and_ids() -> None:
    req = _make_exploration_request()
    _, _, recs, _ = build_deterministic_analysis(req)
    first_id = recs[0].id

    script = [
        AIMessage(
            content="",
            tool_calls=[
                {"name": "inspect_diagnosis", "args": {}, "id": "t1"},
                {"name": "inspect_bottlenecks", "args": {}, "id": "t2"},
                {
                    "name": "request_variants",
                    "args": {"kind": "increase_teacher_load", "scope": "C4"},
                    "id": "t3",
                },
                {
                    "name": "simulate_patches_cpsat",
                    "args": {"recommendation_ids": [first_id]},
                    "id": "t4",
                },
            ],
        ),
        AIMessage(
            content=json.dumps(
                {
                    "summary": "Revisar disponibilidad de DOCENTE_001, DOCENTE_002 y DOCENTE_003.",
                    "prioritizedIds": [r.id for r in recs],
                }
            )
        ),
    ]
    model = FakeModel(script)
    result = _run_with_model(req, model)

    assert result.source.mode == "llm-assisted"
    sent_payload = json.dumps(model.histories, ensure_ascii=False)
    for forbidden in (
        "María Elena Quispe",
        "Carlos Alberto Mendoza",
        "Lucía Fernanda Paredes",
        "Quispe",
        "Mendoza",
        "Paredes",
        "T-ALFA",
        "T-BETA",
        "T-REF-Z",
    ):
        assert forbidden not in sent_payload
    assert "DOCENTE_" in sent_payload
    # Final response rehydrates teacher names for local UI display.
    assert "María Elena Quispe" in result.summary
    assert "Carlos Alberto Mendoza" in result.summary


@pytest.mark.parametrize("case_name", list(CASES.keys()))
def test_not_configured_response_matches_v44_snapshots_byte_for_byte(case_name: str) -> None:
    req = CASES[case_name]()
    result = asyncio.run(
        analyze_proposal_with_advisor(req, env={"SUM_LLM_PROVIDER": "disabled"})
    )
    assert result.source.mode == "deterministic-fallback"
    assert result.source.fallbackReason == "not_configured"
    actual_json = json.dumps(
        {
            "summary": result.summary,
            "bottlenecks": [b.model_dump() for b in result.bottlenecks],
            "recommendations": [r.model_dump() for r in result.recommendations],
        },
        ensure_ascii=False,
        indent=2,
    )
    assert actual_json == VARIANT_SNAPSHOTS[case_name]


@pytest.mark.skipif(
    os.environ.get("SUM_ADVISOR_SCALE") != "1",
    reason="Opt-in agentic scale check (set SUM_ADVISOR_SCALE=1)",
)
def test_agentic_exploration_scale_timing_under_25s() -> None:
    solve_req = _build_scale_solve_request()
    initial = solve_academic_schedule(solve_req)
    assigned = {a.id for a in initial.assignments}
    req = AdvisorAnalyzeRequest(
        **{k: v for k, v in solve_req.model_dump().items() if k in AdvisorAnalyzeRequest.model_fields},
        proposalId="synthetic-scale-agentic",
        editVersion=0,
        assignments=initial.assignments,
        diagnostics=initial.diagnostics,
        pending=[
            PendingSessionItem(
                sessionId=r.id,
                sectionId=r.sectionId,
                courseId=r.courseId,
                durationMinutes=r.durationMinutes,
            )
            for r in solve_req.requirements
            if r.id not in assigned
        ],
    )

    # Pick a long continuous pending course outside ChangeDeliveryModeKind's initial top-5.
    diag = diagnose(req)
    courses_by_id = {c.courseId: c for c in req.courses}
    long_pending = sorted(
        (
            cid
            for cid in diag.pendingByCourse
            if cid in courses_by_id
            and courses_by_id[cid].deliveryMode == "continuous"
            and len(courses_by_id[cid].weeklySessions) > 1
            and sum(ws.durationMinutes for ws in courses_by_id[cid].weeklySessions) >= 240
        ),
        key=lambda cid: (-diag.pendingByCourse[cid].totalMinutes, cid),
    )
    target_course = long_pending[-1]

    # Script uses maximum tool calls (4 total across 2 rounds):
    # inspect_diagnosis + request_variants + 2 simulate_patches_cpsat calls.
    script = [
        AIMessage(
            content="",
            tool_calls=[
                {"name": "inspect_diagnosis", "args": {}, "id": "s-diag"},
                {
                    "name": "request_variants",
                    "args": {"kind": "change_delivery_mode", "scope": target_course},
                    "id": "s-var",
                },
            ],
        ),
        AIMessage(
            content="",
            tool_calls=[
                {
                    "name": "simulate_patches_cpsat",
                    "args": {"recommendation_ids": [f"rec-change-delivery-mode-{target_course}"]},
                    "id": "s-sim1",
                },
                {
                    "name": "simulate_patches_cpsat",
                    "args": {
                        "recommendation_ids": [
                            "rec-increase-teacher-load-all",
                            "rec-enable-planning-window-both",
                        ]
                    },
                    "id": "s-sim2",
                },
            ],
        ),
        AIMessage(
            content=json.dumps(
                {
                    "summary": "Análisis agéntico acotado completado en escenario de escala.",
                    "prioritizedIds": [
                        "rec-increase-teacher-load-all",
                        "rec-enable-planning-window-both",
                    ],
                }
            )
        ),
    ]

    started = time.monotonic()
    result = _run_with_model(req, FakeModel(script))
    elapsed = time.monotonic() - started

    assert elapsed < 25.0
    assert result.source.mode == "llm-assisted"
    assert len(result.recommendations) <= 8
    assert len(result.reasoningSteps) == 5  # initial selected + 4 agent calls


def test_exhausted_tool_budget_gets_one_final_answer_turn() -> None:
    req = _make_exploration_request()
    rounds = [call("inspect_diagnosis", {}, f"r{i}") for i in range(MAX_TOOL_ROUNDS + 1)]
    final = AIMessage(content=json.dumps({"summary": "Respuesta final.", "prioritizedIds": []}))
    model = FakeModel([*rounds, final])
    result = _run_with_model(req, model)
    assert result.source.mode == "llm-assisted"
    assert result.summary == "Respuesta final."
    # Only the in-budget rounds executed tools; the over-budget call was dropped.
    assert [s.toolName for s in result.reasoningSteps].count("inspect_diagnosis") == MAX_TOOL_ROUNDS
    assert "Presupuesto de herramientas agotado" in model.histories[-1][-1]["content"]
