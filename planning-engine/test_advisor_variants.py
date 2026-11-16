"""Snapshot, variant-gating table, and ranking tests for diagnosis-driven advisor variants."""
from __future__ import annotations

import json
import time
from pathlib import Path

import pytest

from advisor import build_deterministic_analysis
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
    IncreaseTeacherLoadPatch,
    PendingSessionItem,
    PlanningPolicyInput,
    RequiredSessionInput,
    RoomInput,
    SectionInput,
    TeacherInput,
    TeacherLoadAdjustment,
    TimeInterval,
    WeeklySessionInput,
)
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


def test_ranking_tie_break_window_default_and_12_run_cap() -> None:
    windows = [TimeInterval(day=1, startMinute=480, endMinute=1320)]
    req = AdvisorAnalyzeRequest(
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
        windows=windows,
    )

    # 14 variants -> only first 12 simulated; remaining 2 stay in catalog order after simulated ones.
    recs = [
        # Window variants: afternoon and both tie at unlocked=4 (saturday=2) -> both gets recommendedByDefault=True,
        # while afternoon sorts ahead of both due to smaller change size (1 < 2).
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
        # Tie-break test at unlocked=6: 1-course vs 2-course, and two 1-course patches sorted by id
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
        AdvisorRecommendation(
            id="rec-change-delivery-mode-all",
            title="All",
            rationale="r",
            impactSummary="x",
            recommendedByDefault=False,
            patch=ChangeDeliveryModePatch(courseIds=["CA", "CZ"]),
        ),
    ]
    for i in range(6, 14):
        recs.append(
            AdvisorRecommendation(
                id=f"rec-extra-{i:02d}",
                title=f"Extra {i}",
                rationale="r",
                impactSummary=f"Base {i}",
                recommendedByDefault=False,
                patch=IncreaseTeacherLoadPatch(
                    adjustments=[
                        TeacherLoadAdjustment(
                            teacherId=f"T{i}",
                            previousMaxWeeklyMinutes=100,
                            nextMaxWeeklyMinutes=200,
                        )
                    ]
                ),
            )
        )

    projected_map = {
        "rec-enable-planning-window-afternoon": 4,
        "rec-enable-planning-window-saturday": 2,
        "rec-enable-planning-window-both": 4,
        "rec-change-delivery-mode-Z": 6,
        "rec-change-delivery-mode-A": 6,
        "rec-change-delivery-mode-all": 6,
        "rec-extra-06": 1,
        "rec-extra-07": 0,
        "rec-extra-08": 3,
        "rec-extra-09": 0,
        "rec-extra-10": 0,
        "rec-extra-11": 0,
        "rec-extra-12": 99,  # past cap -> must NOT be simulated
        "rec-extra-13": 99,  # past cap -> must NOT be simulated
    }
    calls: list[list[str]] = []

    def stub_dry_run(r, _catalog, rec_ids):
        calls.append(list(rec_ids))
        return _stub_impact(r, projected_map[rec_ids[0]], rec_ids)

    ranked = rank_recommendations(req, recs, stub_dry_run)

    assert len(calls) == 12
    assert [c[0] for c in calls] == [r.id for r in recs[:12]]

    assert [r.id for r in ranked] == [
        # unlocked=6, size=1, sorted by id (A before Z), then size=2 (all)
        "rec-change-delivery-mode-A",
        "rec-change-delivery-mode-Z",
        "rec-change-delivery-mode-all",
        # unlocked=4, size=1 (afternoon) before size=2 (both)
        "rec-enable-planning-window-afternoon",
        "rec-enable-planning-window-both",
        # unlocked=3
        "rec-extra-08",
        # unlocked=2
        "rec-enable-planning-window-saturday",
        # unlocked=1
        "rec-extra-06",
        # unlocked=0, size=1, sorted by id
        "rec-extra-07",
        "rec-extra-09",
        "rec-extra-10",
        "rec-extra-11",
        # Unsimulated tail keeps catalog order after simulated ones
        "rec-extra-12",
        "rec-extra-13",
    ]

    by_id = {r.id: r for r in ranked}
    # Tied best window impact (4 vs 4) picks combined as recommendedByDefault=True
    assert by_id["rec-enable-planning-window-both"].recommendedByDefault is True
    assert by_id["rec-enable-planning-window-afternoon"].recommendedByDefault is False
    assert by_id["rec-enable-planning-window-saturday"].recommendedByDefault is False

    assert by_id["rec-extra-06"].impactSummary == "Destraba 1 componente en simulación"
    assert by_id["rec-change-delivery-mode-A"].impactSummary == "Destraba 6 componentes en simulación"
    assert by_id["rec-extra-12"].impactSummary == "Base 12 (impacto no simulado)"
    assert by_id["rec-extra-13"].impactSummary == "Base 13 (impacto no simulado)"


def test_real_cpsat_ranking_fast_unlock() -> None:
    # Small real CP-SAT scenario (<3s): senior course with afternoon-only windows (14:00-16:00).
    # Afternoon and combined variants unlock 2 sessions while Saturday unlocks 0;
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
        "rec-enable-planning-window-saturday",
    ]
    assert recs[0].impactSummary == "Destraba 2 componentes en simulación"
    assert recs[1].impactSummary == "Destraba 2 componentes en simulación"
    assert recs[2].impactSummary == "Destraba 0 componentes en simulación"
    assert recs[1].recommendedByDefault is True
    assert recs[0].recommendedByDefault is False
