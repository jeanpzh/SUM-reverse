"""Snapshot, variant-gating table, and ranking tests for diagnosis-driven advisor variants."""
from __future__ import annotations

import asyncio
import json
import os
import subprocess
import time
from pathlib import Path

import pytest

import advisor_agent
import solver as solver_module
from advisor import AdvisorPrivacyCodec, build_deterministic_analysis
from advisor_agent import run_advisor_agent, run_cpsat_dry_run
from advisor_catalog import (
    ChangeDeliveryModeKind,
    EnablePlanningWindowKind,
    IncreaseTeacherLoadKind,
    rank_recommendations,
)
from advisor_diagnosis import diagnose
from models import (
    AdvisorAnalyzeRequest,
    AdvisorRecommendation,
    AdvisorVerifiedImpact,
    AssignmentOutput,
    ChangeDeliveryModePatch,
    CourseInput,
    EnablePlanningWindowPatch,
    IncorporateReferenceResourcePatch,
    IncreaseTeacherLoadPatch,
    PendingSessionItem,
    PlanningPolicyInput,
    RequiredSessionInput,
    RoomInput,
    SectionInput,
    SolveScheduleRequest,
    TeacherInput,
    TeacherLoadAdjustment,
    TimeInterval,
    WeeklySessionInput,
)
from solver import solve_academic_schedule
from test_advisor_parity import CASES

VARIANT_SNAPSHOT_PATH = Path(__file__).with_name("test_advisor_variants_snapshots.json")
VARIANT_SNAPSHOTS = json.loads(VARIANT_SNAPSHOT_PATH.read_text(encoding="utf-8"))


@pytest.mark.parametrize("case_name", list(CASES.keys()))
def test_variant_analysis_snapshot_parity(case_name: str) -> None:
    req = CASES[case_name]()
    summary, bottlenecks, recs, _ = build_deterministic_analysis(req)
    actual_json = json.dumps(
        {
            "summary": summary,
            "bottlenecks": [b.model_dump() for b in bottlenecks],
            "recommendations": [r.model_dump() for r in recs],
        },
        ensure_ascii=False,
        indent=2,
    )
    assert actual_json == VARIANT_SNAPSHOTS[case_name]


@pytest.mark.parametrize(
    "allow_afternoon,allow_saturday,cycle,pending_count,window_end,assigned_mins,expected_ids",
    [
        # Both closed, senior pending + >6 pending -> all 3 variants
        (False, False, 7, 7, 1320, 0, [
            "rec-enable-planning-window-afternoon",
            "rec-enable-planning-window-saturday",
            "rec-enable-planning-window-both",
        ]),
        # Both closed, senior pending, <=6 pending, no afternoon window, low saturation -> afternoon + both
        (False, False, 7, 2, 780, 0, [
            "rec-enable-planning-window-afternoon",
            "rec-enable-planning-window-both",
        ]),
        # Both closed, non-senior, <=6 pending, afternoon window has free capacity -> afternoon only (no combined)
        (False, False, 3, 2, 1080, 0, [
            "rec-enable-planning-window-afternoon",
        ]),
        # Both closed, non-senior, <=6 pending, morning-only window >=75% saturated -> saturday only (no combined)
        (False, False, 3, 2, 780, 240, [
            "rec-enable-planning-window-saturday",
        ]),
        # One already open (Saturday open) -> afternoon only
        (False, True, 7, 7, 1320, 0, [
            "rec-enable-planning-window-afternoon",
        ]),
        # One already open (Afternoon open) -> saturday only
        (True, False, 7, 7, 1320, 0, [
            "rec-enable-planning-window-saturday",
        ]),
        # Both already open -> none
        (True, True, 7, 7, 1320, 0, []),
    ],
)
def test_enable_planning_window_gating_table(
    allow_afternoon: bool,
    allow_saturday: bool,
    cycle: int,
    pending_count: int,
    window_end: int,
    assigned_mins: int,
    expected_ids: list[str],
) -> None:
    windows = [TimeInterval(day=1, startMinute=480, endMinute=window_end)]
    assignments = (
        [
            AssignmentOutput(
                id="A0",
                sectionId="S0",
                teacherId="T1",
                roomId="R1",
                interval=TimeInterval(day=1, startMinute=480, endMinute=480 + assigned_mins),
            )
        ]
        if assigned_mins > 0
        else []
    )
    req = AdvisorAnalyzeRequest(
        proposalId="prop-win-gate",
        editVersion=0,
        courses=[
            CourseInput(
                courseId="C1",
                name="Course 1",
                estimatedDemand=30,
                targetCapacity=30,
                weeklySessions=[WeeklySessionInput(id="T", durationMinutes=120)],
                cycle=cycle,
            )
        ],
        teachers=[
            TeacherInput(id="T1", courseIds=["C1"], maxWeeklyMinutes=600, availability=windows)
        ],
        rooms=[RoomInput(id="R1", capacity=40, availability=windows, kind="classroom")],
        sections=[SectionInput(id="S1", courseId="C1", capacity=30, cycle=cycle)],
        requirements=[],
        assignments=assignments,
        pending=[
            PendingSessionItem(sessionId=f"P{i}", sectionId="S1", courseId="C1", durationMinutes=120)
            for i in range(pending_count)
        ],
        diagnostics=[],
        planningPolicy=PlanningPolicyInput(
            period="2027-I",
            allowAfternoon=allow_afternoon,
            allowSaturday=allow_saturday,
        ),
        windows=windows,
    )

    diag = diagnose(req)
    variants = EnablePlanningWindowKind().variants(req, diag)
    assert [v.id for v in variants] == expected_ids
    if variants:
        assert sum(1 for v in variants if v.recommendedByDefault) == 1
    if len(variants) > 1:
        assert all("Alternativa excluyente" in v.rationale for v in variants)


@pytest.mark.parametrize(
    "course_minutes,expected_ids",
    [
        # Single long continuous course -> only per-course variant (no duplicate -all)
        ([("C1", 240)], ["rec-change-delivery-mode-C1"]),
        # Two long continuous courses -> ordered by pending minutes descending + -all
        ([("C1", 240), ("C2", 360)], [
            "rec-change-delivery-mode-C2",
            "rec-change-delivery-mode-C1",
            "rec-change-delivery-mode-all",
        ]),
        # Seven long continuous courses -> top 5 by pending minutes + -all
        (
            [("C1", 120), ("C2", 420), ("C3", 180), ("C4", 360), ("C5", 300), ("C6", 240), ("C7", 480)],
            [
                "rec-change-delivery-mode-C7",
                "rec-change-delivery-mode-C2",
                "rec-change-delivery-mode-C4",
                "rec-change-delivery-mode-C5",
                "rec-change-delivery-mode-C6",
                "rec-change-delivery-mode-all",
            ],
        ),
    ],
)
def test_change_delivery_mode_gating_table(
    course_minutes: list[tuple[str, int]], expected_ids: list[str]
) -> None:
    windows = [TimeInterval(day=1, startMinute=480, endMinute=1320)]
    courses = [
        CourseInput(
            courseId=cid,
            name=f"Course {cid}",
            estimatedDemand=30,
            targetCapacity=30,
            weeklySessions=[
                WeeklySessionInput(id="T", durationMinutes=120),
                WeeklySessionInput(id="P", durationMinutes=120),
            ],
            deliveryMode="continuous",
            cycle=3,
        )
        for cid, _ in course_minutes
    ]
    pending = [
        PendingSessionItem(sessionId=f"P-{cid}", sectionId=f"S-{cid}", courseId=cid, durationMinutes=mins)
        for cid, mins in course_minutes
    ]
    req = AdvisorAnalyzeRequest(
        proposalId="prop-delivery-gate",
        editVersion=0,
        courses=courses,
        teachers=[],
        rooms=[],
        sections=[],
        requirements=[],
        assignments=[],
        pending=pending,
        diagnostics=[],
        windows=windows,
    )
    variants = ChangeDeliveryModeKind().variants(req, diagnose(req))
    assert [v.id for v in variants] == expected_ids
    assert all(not v.recommendedByDefault for v in variants)


def test_increase_teacher_load_shared_teacher_and_cap() -> None:
    windows = [TimeInterval(day=1, startMinute=480, endMinute=1320)]
    # T-SHARED teaches C1 (240m) and C2 (360m); T3 teaches C3 (300m); T4 teaches C4 (180m); T5 teaches C5 (120m).
    courses = [
        CourseInput(
            courseId=cid,
            name=f"Course {cid}",
            estimatedDemand=30,
            targetCapacity=30,
            weeklySessions=[WeeklySessionInput(id="T", durationMinutes=120)],
            cycle=3,
        )
        for cid in ("C1", "C2", "C3", "C4", "C5")
    ]
    teachers = [
        TeacherInput(id="T-SHARED", name="Shared Teacher", courseIds=["C1", "C2"], maxWeeklyMinutes=120, availability=windows),
        TeacherInput(id="T3", name="Teacher 3", courseIds=["C3"], maxWeeklyMinutes=120, availability=windows),
        TeacherInput(id="T4", name="Teacher 4", courseIds=["C4"], maxWeeklyMinutes=120, availability=windows),
        TeacherInput(id="T5", name="Teacher 5", courseIds=["C5"], maxWeeklyMinutes=60, availability=windows),
    ]
    pending = [
        PendingSessionItem(sessionId="P1", sectionId="S1", courseId="C1", durationMinutes=240),
        PendingSessionItem(sessionId="P2", sectionId="S2", courseId="C2", durationMinutes=360),
        PendingSessionItem(sessionId="P3", sectionId="S3", courseId="C3", durationMinutes=300),
        PendingSessionItem(sessionId="P4", sectionId="S4", courseId="C4", durationMinutes=180),
        PendingSessionItem(sessionId="P5", sectionId="S5", courseId="C5", durationMinutes=120),
    ]
    req = AdvisorAnalyzeRequest(
        proposalId="prop-load-shared",
        editVersion=0,
        courses=courses,
        teachers=teachers,
        rooms=[],
        sections=[],
        requirements=[],
        assignments=[],
        pending=pending,
        diagnostics=[],
        windows=windows,
    )
    variants = IncreaseTeacherLoadKind().variants(req, diagnose(req))
    # Full shortfall + top N=3 courses by pending minutes (C2=360, C3=300, C1=240)
    assert [v.id for v in variants] == [
        "rec-increase-teacher-load-all",
        "rec-increase-teacher-load-C2",
        "rec-increase-teacher-load-C3",
        "rec-increase-teacher-load-C1",
    ]
    assert all(not v.recommendedByDefault for v in variants)
    # Real current maxWeeklyMinutes preserved on every variant touching T-SHARED
    for v in variants:
        for adj in v.patch.adjustments:
            if adj.teacherId == "T-SHARED":
                assert adj.previousMaxWeeklyMinutes == 120
        assert "Alternativa excluyente" in v.rationale
    # Separate single-course patches touch only their own course's teacher
    assert [a.teacherId for a in variants[1].patch.adjustments] == ["T-SHARED"]
    assert [a.teacherId for a in variants[2].patch.adjustments] == ["T3"]
    assert [a.teacherId for a in variants[3].patch.adjustments] == ["T-SHARED"]


def _stub_impact(req: AdvisorAnalyzeRequest, projected: int, rec_ids: list[str]) -> AdvisorVerifiedImpact:
    return AdvisorVerifiedImpact(
        currentScheduledSessions=len(req.assignments),
        projectedScheduledSessions=projected,
        requiredSessions=max(projected, len(req.requirements), 1),
        currentCompleteSections=0,
        projectedCompleteSections=0,
        totalSections=max(len(req.sections), 1),
        recommendationIds=rec_ids,
        solverStatus="complete",
    )


def _empty_advisor_req() -> AdvisorAnalyzeRequest:
    return AdvisorAnalyzeRequest(
        proposalId="prop-rank",
        editVersion=0,
        courses=[],
        teachers=[],
        rooms=[],
        sections=[],
        requirements=[],
        assignments=[],
        pending=[],
        diagnostics=[],
        windows=[TimeInterval(day=1, startMinute=480, endMinute=1320)],
    )


def test_ranking_tie_break_window_default_broad_first_baseline_and_cap() -> None:
    req = _empty_advisor_req()

    # 14 variants (3 broad + 11 narrow) -> 1 baseline + 11 variant runs = 12 calls total.
    # Broad variants must be simulated BEFORE narrow variants, even when they appear later in catalog order.
    recs = [
        AdvisorRecommendation(
            id="rec-increase-teacher-load-all",
            title="Load All",
            rationale="r",
            impactSummary="x",
            recommendedByDefault=False,
            patch=IncreaseTeacherLoadPatch(
                adjustments=[
                    TeacherLoadAdjustment(teacherId="T0", previousMaxWeeklyMinutes=100, nextMaxWeeklyMinutes=200),
                    TeacherLoadAdjustment(teacherId="T1", previousMaxWeeklyMinutes=100, nextMaxWeeklyMinutes=200),
                ]
            ),
        ),
        AdvisorRecommendation(
            id="rec-enable-planning-window-afternoon",
            title="Afternoon",
            rationale="r",
            impactSummary="x",
            recommendedByDefault=False,
            patch=EnablePlanningWindowPatch(allowAfternoon=True),
        ),
        AdvisorRecommendation(
            id="rec-enable-planning-window-saturday",
            title="Saturday",
            rationale="r",
            impactSummary="x",
            recommendedByDefault=False,
            patch=EnablePlanningWindowPatch(allowSaturday=True),
        ),
        AdvisorRecommendation(
            id="rec-enable-planning-window-both",
            title="Both",
            rationale="r",
            impactSummary="x",
            recommendedByDefault=False,
            patch=EnablePlanningWindowPatch(allowAfternoon=True, allowSaturday=True),
        ),
        AdvisorRecommendation(
            id="rec-incorporate-reference-resource",
            title="Ref",
            rationale="r",
            impactSummary="x",
            recommendedByDefault=True,
            patch=IncorporateReferenceResourcePatch(teacherIds=["RT1"], roomIds=[]),
        ),
        AdvisorRecommendation(
            id="rec-change-delivery-mode-Z",
            title="Z",
            rationale="r",
            impactSummary="x",
            recommendedByDefault=False,
            patch=ChangeDeliveryModePatch(courseIds=["CZ"]),
        ),
        AdvisorRecommendation(
            id="rec-change-delivery-mode-A",
            title="A",
            rationale="r",
            impactSummary="x",
            recommendedByDefault=False,
            patch=ChangeDeliveryModePatch(courseIds=["CA"]),
        ),
    ]
    for i in range(7, 13):
        recs.append(
            AdvisorRecommendation(
                id=f"rec-extra-{i:02d}",
                title=f"Extra {i}",
                rationale="r",
                impactSummary=f"Base {i}",
                recommendedByDefault=False,
                patch=ChangeDeliveryModePatch(courseIds=[f"C{i}"]),
            )
        )
    # Place -all LAST in catalog order to prove broad-first simulation promotes it into the 12-run budget.
    recs.append(
        AdvisorRecommendation(
            id="rec-change-delivery-mode-all",
            title="Delivery All",
            rationale="r",
            impactSummary="x",
            recommendedByDefault=False,
            patch=ChangeDeliveryModePatch(courseIds=["CA", "CZ", "C7"]),
        )
    )

    # Baseline dry run returns 10 sessions (higher than req.assignments=0).
    # One variant returns 9 (< baseline) -> unlocked must floor at 0.
    baseline_projected = 10
    projected_map = {
        "rec-increase-teacher-load-all": 10,     # broad, unlocked=0 -> KEPT with "No destrabó"
        "rec-enable-planning-window-both": 14,   # broad, unlocked=4 (ties afternoon -> default=True)
        "rec-incorporate-reference-resource": 11, # broad, unlocked=1
        "rec-change-delivery-mode-all": 16,      # broad (was last!), unlocked=6
        "rec-enable-planning-window-afternoon": 14, # narrow, unlocked=4
        "rec-enable-planning-window-saturday": 12,  # narrow, unlocked=2
        "rec-change-delivery-mode-Z": 16,        # narrow, unlocked=6
        "rec-change-delivery-mode-A": 16,        # narrow, unlocked=6
        "rec-extra-07": 9,                       # narrow, 9-10 -> floored at 0 -> DROPPED
        "rec-extra-08": 13,                      # narrow, unlocked=3
        "rec-extra-09": 10,                      # narrow, unlocked=0 -> DROPPED
        "rec-extra-10": 99,                      # past 11-variant budget -> NOT simulated
        "rec-extra-11": 99,                      # past 11-variant budget -> NOT simulated
        "rec-extra-12": 99,                      # past 11-variant budget -> NOT simulated
    }
    calls: list[list[str]] = []

    def stub_dry_run(r, _catalog, rec_ids):
        calls.append(list(rec_ids))
        proj = baseline_projected if not rec_ids else projected_map[rec_ids[0]]
        return _stub_impact(r, proj, rec_ids)

    ranked = rank_recommendations(req, recs, stub_dry_run)

    # 12 runs total: first [] baseline, then 4 broad in catalog order, then first 7 narrow.
    assert len(calls) == 12
    assert calls[0] == []
    assert [c[0] for c in calls[1:]] == [
        "rec-increase-teacher-load-all",
        "rec-enable-planning-window-both",
        "rec-incorporate-reference-resource",
        "rec-change-delivery-mode-all",
        "rec-enable-planning-window-afternoon",
        "rec-enable-planning-window-saturday",
        "rec-change-delivery-mode-Z",
        "rec-change-delivery-mode-A",
        "rec-extra-07",
        "rec-extra-08",
        "rec-extra-09",
    ]

    # Kept simulated: 9 items (7 non-zero + rec-increase-teacher-load-all at 0) -> capped at 8!
    # rec-extra-07 (floored to 0) and rec-extra-09 (0) were dropped; rec-increase-teacher-load-all was 9th so sliced by [:8].
    assert len(ranked) == 8
    assert [r.id for r in ranked] == [
        "rec-change-delivery-mode-A",
        "rec-change-delivery-mode-Z",
        "rec-change-delivery-mode-all",
        "rec-enable-planning-window-afternoon",
        "rec-enable-planning-window-both",
        "rec-extra-08",
        "rec-enable-planning-window-saturday",
        "rec-incorporate-reference-resource",
    ]

    by_id = {r.id: r for r in ranked}
    assert by_id["rec-enable-planning-window-both"].recommendedByDefault is True
    assert by_id["rec-enable-planning-window-afternoon"].recommendedByDefault is False
    assert by_id["rec-enable-planning-window-saturday"].recommendedByDefault is False
    assert by_id["rec-incorporate-reference-resource"].impactSummary == "Destraba 1 componente en simulación"
    assert by_id["rec-change-delivery-mode-all"].impactSummary == "Destraba 6 componentes en simulación"


def test_ranking_keeps_zero_unlocked_broad_and_drops_zero_unlocked_narrow() -> None:
    req = _empty_advisor_req()
    recs = [
        AdvisorRecommendation(
            id="rec-increase-teacher-load-all",
            title="Load All",
            rationale="r",
            impactSummary="old",
            recommendedByDefault=False,
            patch=IncreaseTeacherLoadPatch(
                adjustments=[
                    TeacherLoadAdjustment(teacherId="T0", previousMaxWeeklyMinutes=100, nextMaxWeeklyMinutes=200),
                    TeacherLoadAdjustment(teacherId="T1", previousMaxWeeklyMinutes=100, nextMaxWeeklyMinutes=200),
                ]
            ),
        ),
        AdvisorRecommendation(
            id="rec-increase-teacher-load-C1",
            title="Load C1",
            rationale="r",
            impactSummary="old",
            recommendedByDefault=False,
            patch=IncreaseTeacherLoadPatch(
                adjustments=[
                    TeacherLoadAdjustment(teacherId="T0", previousMaxWeeklyMinutes=100, nextMaxWeeklyMinutes=200),
                ]
            ),
        ),
        AdvisorRecommendation(
            id="rec-change-delivery-mode-C2",
            title="Delivery C2",
            rationale="r",
            impactSummary="old",
            recommendedByDefault=False,
            patch=ChangeDeliveryModePatch(courseIds=["C2"]),
        ),
        AdvisorRecommendation(
            id="rec-change-delivery-mode-all",
            title="Delivery All",
            rationale="r",
            impactSummary="old",
            recommendedByDefault=False,
            patch=ChangeDeliveryModePatch(courseIds=["C1", "C2"]),
        ),
    ]

    def stub_dry_run(r, _catalog, rec_ids):
        # Baseline=5; load-all=3 (floored 0), load-C1=5 (0), delivery-C2=5 (0), delivery-all=7 (+2)
        proj = 5 if not rec_ids else (3 if rec_ids[0] == "rec-increase-teacher-load-all" else 7 if rec_ids[0] == "rec-change-delivery-mode-all" else 5)
        return _stub_impact(r, proj, rec_ids)

    ranked = rank_recommendations(req, recs, stub_dry_run)
    assert [r.id for r in ranked] == [
        "rec-change-delivery-mode-all",
        "rec-increase-teacher-load-all",
    ]
    assert ranked[0].impactSummary == "Destraba 2 componentes en simulación"
    assert ranked[1].impactSummary == "No destrabó componentes en simulación"


def test_real_cpsat_ranking_fast_unlock() -> None:
    # Small real CP-SAT scenario (<3s): senior course with afternoon-only windows (14:00-16:00).
    # Afternoon and combined variants unlock 2 sessions while Saturday unlocks 0 (and is dropped as narrow);
    # afternoon ranks first (smaller change size 1 < 2), and combined keeps recommendedByDefault=True on tie.
    windows = [TimeInterval(day=d, startMinute=840, endMinute=960) for d in (1, 2)]
    req = AdvisorAnalyzeRequest(
        proposalId="prop-real-cpsat",
        editVersion=0,
        courses=[
            CourseInput(
                courseId="C1",
                name="Course 1",
                estimatedDemand=20,
                targetCapacity=20,
                weeklySessions=[
                    WeeklySessionInput(id="T", durationMinutes=120),
                    WeeklySessionInput(id="P", durationMinutes=120),
                ],
                deliveryMode="split",
                cycle=7,
            )
        ],
        teachers=[
            TeacherInput(id="T1", courseIds=["C1"], maxWeeklyMinutes=1200, availability=windows)
        ],
        rooms=[RoomInput(id="R1", capacity=30, availability=windows, kind="classroom")],
        sections=[SectionInput(id="S1", courseId="C1", capacity=20, cycle=7)],
        requirements=[
            RequiredSessionInput(id="T", sectionId="S1", courseId="C1", durationMinutes=120, order=0),
            RequiredSessionInput(id="P", sectionId="S1", courseId="C1", durationMinutes=120, order=1),
        ],
        assignments=[],
        pending=[
            PendingSessionItem(sessionId=f"P{i}", sectionId="S1", courseId="C1", durationMinutes=120)
            for i in range(7)
        ],
        diagnostics=[],
        planningPolicy=PlanningPolicyInput(period="2027-I", allowAfternoon=False, allowSaturday=False),
        windows=windows,
    )
    started = time.monotonic()
    _, _, recs, _ = build_deterministic_analysis(req)
    elapsed = time.monotonic() - started
    assert elapsed < 3.0
    assert [r.id for r in recs] == [
        "rec-enable-planning-window-afternoon",
        "rec-enable-planning-window-both",
    ]
    assert recs[0].impactSummary == "Destraba 2 componentes en simulación"
    assert recs[1].impactSummary == "Destraba 2 componentes en simulación"
    assert recs[1].recommendedByDefault is True
    assert recs[0].recommendedByDefault is False


def test_overlapping_increase_teacher_load_selection_and_staleness() -> None:
    windows = [TimeInterval(day=1, startMinute=480, endMinute=1320)]
    courses = [
        CourseInput(
            courseId="C1",
            name="Course 1",
            estimatedDemand=30,
            targetCapacity=30,
            weeklySessions=[WeeklySessionInput(id="T", durationMinutes=240)],
            cycle=3,
        ),
        CourseInput(
            courseId="C2",
            name="Course 2",
            estimatedDemand=30,
            targetCapacity=30,
            weeklySessions=[WeeklySessionInput(id="T", durationMinutes=360)],
            cycle=3,
        ),
    ]
    teachers = [
        TeacherInput(
            id="T-SHARED",
            name="Shared Teacher",
            courseIds=["C1", "C2"],
            maxWeeklyMinutes=120,
            availability=windows,
        )
    ]
    sections = [
        SectionInput(id="S1", courseId="C1", capacity=30, cycle=3),
        SectionInput(id="S2", courseId="C2", capacity=30, cycle=3),
    ]
    rooms = [RoomInput(id="R1", capacity=40, availability=windows, kind="classroom")]
    requirements = [
        RequiredSessionInput(id="S1:0", sectionId="S1", courseId="C1", durationMinutes=240, order=0),
        RequiredSessionInput(id="S2:0", sectionId="S2", courseId="C2", durationMinutes=360, order=0),
    ]
    req = AdvisorAnalyzeRequest(
        proposalId="prop-overlap-load",
        editVersion=0,
        courses=courses,
        teachers=teachers,
        rooms=rooms,
        sections=sections,
        requirements=requirements,
        assignments=[],
        pending=[
            PendingSessionItem(sessionId="S1:0", sectionId="S1", courseId="C1", durationMinutes=240),
            PendingSessionItem(sessionId="S2:0", sectionId="S2", courseId="C2", durationMinutes=360),
        ],
        diagnostics=[],
        selectedRecommendationIds=["rec-increase-teacher-load-all", "rec-increase-teacher-load-C2"],
        windows=windows,
    )
    variants = IncreaseTeacherLoadKind().variants(req, diagnose(req))
    assert {v.id for v in variants} >= {
        "rec-increase-teacher-load-all",
        "rec-increase-teacher-load-C2",
    }

    # Both orderings must succeed without raising ValueError('Stale teacher load') and yield full unlock.
    impact_forward = run_cpsat_dry_run(
        req, variants, ["rec-increase-teacher-load-all", "rec-increase-teacher-load-C2"]
    )
    impact_reverse = run_cpsat_dry_run(
        req, variants, ["rec-increase-teacher-load-C2", "rec-increase-teacher-load-all"]
    )
    assert impact_forward.projectedScheduledSessions == 2
    assert impact_reverse.projectedScheduledSessions == 2

    # End-to-end advisor agent selection must succeed too.
    codec = AdvisorPrivacyCodec({"T-SHARED": "Shared Teacher"})
    source, _, _, agent_impact, _ = asyncio.run(
        run_advisor_agent(
            req,
            "summary",
            [],
            variants,
            codec,
            env={},
            model_factory=lambda _env: (None, None),
        )
    )
    assert source.fallbackReason == "not_configured"
    assert agent_impact.projectedScheduledSessions == 2
    assert agent_impact.recommendationIds == [
        "rec-increase-teacher-load-all",
        "rec-increase-teacher-load-C2",
    ]

    # Genuine staleness against the original teacher value must still fail.
    stale_req = req.model_copy(deep=True)
    stale_req.teachers[0].maxWeeklyMinutes = 240
    with pytest.raises(ValueError, match="Stale teacher load"):
        run_cpsat_dry_run(stale_req, variants, ["rec-increase-teacher-load-all"])


def test_dry_run_deterministic_solver_params_and_optional_defaults(monkeypatch: pytest.MonkeyPatch) -> None:
    windows = [TimeInterval(day=1, startMinute=480, endMinute=720)]
    base_solve = SolveScheduleRequest(
        courses=[],
        teachers=[],
        rooms=[],
        sections=[],
        requirements=[],
        windows=windows,
    )
    assert base_solve.numSearchWorkers is None
    assert base_solve.randomSeed is None

    captured_requests: list[SolveScheduleRequest] = []
    original_solve = solve_academic_schedule

    def spy_solve(solve_req: SolveScheduleRequest):
        captured_requests.append(solve_req)
        return original_solve(solve_req)

    monkeypatch.setattr(advisor_agent, "solve_academic_schedule", spy_solve)
    req = AdvisorAnalyzeRequest(
        proposalId="prop-det-params",
        editVersion=0,
        courses=[],
        teachers=[],
        rooms=[],
        sections=[],
        requirements=[],
        assignments=[],
        pending=[],
        diagnostics=[],
        windows=windows,
    )
    run_cpsat_dry_run(req, [], [])
    assert len(captured_requests) == 1
    assert captured_requests[0].numSearchWorkers == 1
    assert captured_requests[0].randomSeed == 42

    # Verify solver.py applies explicit parameters only when set and keeps default 4 otherwise.
    orig_solver_cls = solver_module.cp_model.CpSolver
    default_seed = orig_solver_cls().parameters.random_seed
    worker_settings: list[int] = []
    seed_settings: list[int] = []

    class SpyCpSolver(orig_solver_cls):
        def solve(self, model, *args, **kwargs):
            worker_settings.append(self.parameters.num_search_workers)
            seed_settings.append(self.parameters.random_seed)
            return super().solve(model, *args, **kwargs)

    monkeypatch.setattr(solver_module.cp_model, "CpSolver", SpyCpSolver)
    solve_academic_schedule(base_solve)
    solve_academic_schedule(base_solve.model_copy(update={"numSearchWorkers": 1, "randomSeed": 42}))
    assert worker_settings == [4, 1]
    assert seed_settings == [default_seed, 42]


def _build_scale_solve_request() -> SolveScheduleRequest:
    root = Path(__file__).resolve().parents[1]
    script = r"""
      import { registerHooks } from 'node:module'
      registerHooks({ resolve(specifier, context, next) {
        if (specifier.startsWith('.') && specifier.endsWith('.js')) {
          return next(specifier.slice(0, -3) + '.ts', context)
        }
        return next(specifier, context)
      } })
      const { createDemoCatalog } = await import('./backend/src/programacion-academica/demo-catalog.ts')
      console.log(JSON.stringify(createDemoCatalog()))
    """
    catalog = json.loads(
        subprocess.check_output(["node", "--input-type=module", "-e", script], cwd=root, text=True)
    )
    windows = catalog["windows"]
    courses, sections, requirements = [], [], []
    for course in catalog["courses"]:
        demand = 180 if course["cycle"] % 2 else 90
        courses.append({**course, "estimatedDemand": demand, "targetCapacity": 45})
        for ordinal in range(1, (demand + 44) // 45 + 1):
            sid = f"{course['courseId']}:{ordinal}"
            sections.append(
                dict(id=sid, courseId=course["courseId"], capacity=45, cycle=course["cycle"], ordinal=ordinal)
            )
            for order, session in enumerate(course["weeklySessions"]):
                requirements.append(
                    dict(
                        id=f"{sid}:{order}",
                        sectionId=sid,
                        courseId=course["courseId"],
                        order=order,
                        durationMinutes=session["durationMinutes"],
                        type=session["type"],
                    )
                )
    return SolveScheduleRequest.model_validate(
        dict(
            courses=courses,
            sections=sections,
            requirements=requirements,
            windows=windows,
            teachers=[
                dict(**t, maxWeeklyMinutes=600, availability=windows, facultyId="FISI", qualificationSource="synthetic")
                for t in catalog["referenceTeachers"]
            ],
            rooms=[dict(**r, availability=windows) for r in catalog["referenceRooms"]],
            planningPolicy=dict(period="2027-I", allowAfternoon=False, allowSaturday=False),
            maxTimeSeconds=0.8,
        )
    )


@pytest.mark.skipif(
    os.environ.get("SUM_ADVISOR_SCALE") != "1",
    reason="Opt-in scale timing check (set SUM_ADVISOR_SCALE=1)",
)
def test_advisor_scale_timing_under_15s() -> None:
    solve_req = _build_scale_solve_request()
    initial = solve_academic_schedule(solve_req)
    assigned = {a.id for a in initial.assignments}
    analysis_req = AdvisorAnalyzeRequest(
        **{k: v for k, v in solve_req.model_dump().items() if k in AdvisorAnalyzeRequest.model_fields},
        proposalId="synthetic-scale",
        editVersion=0,
        assignments=initial.assignments,
        diagnostics=initial.diagnostics,
        pending=[
            dict(sessionId=r.id, sectionId=r.sectionId, courseId=r.courseId, durationMinutes=r.durationMinutes)
            for r in solve_req.requirements
            if r.id not in assigned
        ],
    )
    started = time.monotonic()
    _, _, recs, _ = build_deterministic_analysis(analysis_req)
    elapsed = time.monotonic() - started
    assert elapsed < 15.0
    assert 1 <= len(recs) <= 8
    # Broad variants must always have been simulated (never tagged as "impacto no simulado").
    broad_ids = {
        "rec-increase-teacher-load-all",
        "rec-enable-planning-window-both",
        "rec-incorporate-reference-resource",
        "rec-change-delivery-mode-all",
    }
    for rec in recs:
        if rec.id in broad_ids:
            assert "impacto no simulado" not in rec.impactSummary

