"""Deterministic table tests for advisor_diagnosis and advisor_catalog."""
from __future__ import annotations

import pytest

from advisor_catalog import CATALOG_BY_KIND, RECOMMENDATION_CATALOG
from advisor_diagnosis import BlockerDiagnosis, diagnose
from models import (
    AdvisorAnalyzeRequest,
    AssignmentOutput,
    CourseInput,
    DiagnosticOutput,
    IncreaseTeacherLoadPatch,
    PendingSessionItem,
    PlanningPolicyInput,
    RoomInput,
    SectionInput,
    TeacherInput,
    TeacherLoadAdjustment,
    TimeInterval,
    WeeklySessionInput,
)


def _full_week_windows(days: range | tuple[int, ...] = range(1, 7)) -> list[TimeInterval]:
    return [TimeInterval(day=d, startMinute=480, endMinute=1320) for d in days]


def _cell(diagnosis: BlockerDiagnosis, day: int, band: str, room_kind: str):
    return next(
        c
        for c in diagnosis.occupancy
        if c.day == day and c.band == band and c.roomKind == room_kind
    )


@pytest.mark.parametrize(
    "allow_afternoon,allow_saturday,expected_tarde_d1,expected_sat_manana,expected_sat_tarde",
    [
        (False, False, 0, 0, 0),
        (False, True, 0, 300, 0),
        (True, False, 240, 0, 0),
        (True, True, 240, 300, 0),
    ],
)
def test_diagnosis_occupancy_policy_table(
    allow_afternoon: bool,
    allow_saturday: bool,
    expected_tarde_d1: int,
    expected_sat_manana: int,
    expected_sat_tarde: int,
) -> None:
    full_week = _full_week_windows()
    req = AdvisorAnalyzeRequest(
        proposalId="prop-policy",
        editVersion=1,
        courses=[
            CourseInput(
                courseId="C1",
                name="Course 1",
                estimatedDemand=30,
                targetCapacity=30,
                weeklySessions=[WeeklySessionInput(id="T", durationMinutes=120)],
                cycle=7,
            )
        ],
        teachers=[
            TeacherInput(
                id="T1",
                name="Teacher 1",
                courseIds=["C1"],
                maxWeeklyMinutes=600,
                availability=full_week,
            )
        ],
        rooms=[
            RoomInput(
                id="R1",
                capacity=40,
                availability=full_week,
                kind="classroom",
            )
        ],
        sections=[SectionInput(id="S1", courseId="C1", capacity=30, cycle=7)],
        requirements=[],
        assignments=[
            AssignmentOutput(
                id="A1",
                sectionId="S1",
                teacherId="T1",
                roomId="R1",
                interval=TimeInterval(day=1, startMinute=480, endMinute=600),
            )
        ],
        pending=[],
        diagnostics=[],
        planningPolicy=PlanningPolicyInput(
            period="2027-I",
            allowAfternoon=allow_afternoon,
            allowSaturday=allow_saturday,
        ),
        windows=full_week,
    )

    diag = diagnose(req)

    # Monday classroom bands
    d1_manana = _cell(diag, 1, "mañana", "classroom")
    assert (d1_manana.usedMinutes, d1_manana.availableMinutes) == (120, 300)
    d1_tarde = _cell(diag, 1, "tarde", "classroom")
    assert (d1_tarde.usedMinutes, d1_tarde.availableMinutes) == (0, expected_tarde_d1)
    d1_noche = _cell(diag, 1, "noche", "classroom")
    assert (d1_noche.usedMinutes, d1_noche.availableMinutes) == (0, 240)

    # Saturday classroom bands
    sat_manana = _cell(diag, 6, "mañana", "classroom")
    assert (sat_manana.usedMinutes, sat_manana.availableMinutes) == (0, expected_sat_manana)
    sat_tarde = _cell(diag, 6, "tarde", "classroom")
    assert (sat_tarde.usedMinutes, sat_tarde.availableMinutes) == (0, expected_sat_tarde)
    sat_noche = _cell(diag, 6, "noche", "classroom")
    assert (sat_noche.usedMinutes, sat_noche.availableMinutes) == (0, 0)

    # No laboratories exist
    assert all(
        c.usedMinutes == 0 and c.availableMinutes == 0
        for c in diag.occupancy
        if c.roomKind == "laboratory"
    )

    # Empty/low-occupancy ordering: empty mañana (300 free) before empty noche/tarde (240 free),
    # followed by partially occupied day 1 mañana (120/300 = 0.4).
    slot_keys = [(s.day, s.band, s.roomKind, s.usedMinutes, s.availableMinutes) for s in diag.emptyOrLowOccupancySlots]
    assert slot_keys[-1] == (1, "mañana", "classroom", 120, 300)
    assert slot_keys[0] == (2, "mañana", "classroom", 0, 300)
    assert all(s.availableMinutes > 0 for s in diag.emptyOrLowOccupancySlots)


def test_diagnosis_laboratory_only_shortage_and_diagnostic_causes() -> None:
    days_1_2 = _full_week_windows((1, 2))
    req = AdvisorAnalyzeRequest(
        proposalId="prop-lab",
        editVersion=0,
        courses=[
            CourseInput(
                courseId="C1",
                estimatedDemand=30,
                targetCapacity=30,
                weeklySessions=[WeeklySessionInput(id="L", durationMinutes=120, type="L")],
                cycle=5,
            )
        ],
        teachers=[
            TeacherInput(
                id="T1",
                courseIds=["C1"],
                maxWeeklyMinutes=600,
                availability=days_1_2,
            )
        ],
        rooms=[
            RoomInput(id="C-R1", capacity=40, availability=days_1_2, kind="classroom"),
            RoomInput(id="C-R2", capacity=40, availability=days_1_2, kind="classroom"),
            RoomInput(
                id="L-R1",
                capacity=30,
                availability=[TimeInterval(day=1, startMinute=480, endMinute=600)],
                kind="laboratory",
            ),
        ],
        sections=[SectionInput(id="S1", courseId="C1", capacity=30, cycle=5)],
        requirements=[],
        assignments=[
            AssignmentOutput(
                id="A-LAB",
                sectionId="S1",
                teacherId="T1",
                roomId="L-R1",
                interval=TimeInterval(day=1, startMinute=480, endMinute=600),
            )
        ],
        pending=[
            PendingSessionItem(sessionId="P-LAB", sectionId="S2", courseId="C1", durationMinutes=120),
            PendingSessionItem(sessionId="P-UNK", sectionId="S3", courseId="C1", durationMinutes=120),
        ],
        diagnostics=[
            DiagnosticOutput(code="PARTIAL_PROPOSAL", message="Partial", sessionIds=["P-LAB", "P-UNK"]),
            DiagnosticOutput(code="NO_COMPATIBLE_ROOM", message="No lab", sessionIds=["P-LAB"]),
        ],
        planningPolicy=PlanningPolicyInput(period="2027-I", allowAfternoon=True, allowSaturday=False),
        windows=days_1_2,
    )

    diag = diagnose(req)

    lab_d1_m = _cell(diag, 1, "mañana", "laboratory")
    assert (lab_d1_m.usedMinutes, lab_d1_m.availableMinutes) == (120, 120)
    assert lab_d1_m.freeMinutes == 0
    assert lab_d1_m.occupancyRatio == 1.0
    # Laboratory is saturated and has no other available slots
    assert not any(s.roomKind == "laboratory" for s in diag.emptyOrLowOccupancySlots)

    # Classrooms remain empty (2 rooms * 300 = 600 available in mañana)
    cls_d1_m = _cell(diag, 1, "mañana", "classroom")
    assert (cls_d1_m.usedMinutes, cls_d1_m.availableMinutes) == (0, 600)

    # Causes derived strictly from diagnostics (PARTIAL_PROPOSAL does not fabricate a cause)
    assert diag.causesBySession == {"P-LAB": ["NO_COMPATIBLE_ROOM"], "P-UNK": []}
    assert diag.unknownCauseSessionIds == ["P-UNK"]


def test_diagnosis_zero_assignments_teacher_slack_and_pending_by_cycle() -> None:
    windows = _full_week_windows((1,))
    req = AdvisorAnalyzeRequest(
        proposalId="prop-zero",
        editVersion=0,
        courses=[
            CourseInput(
                courseId="C3",
                estimatedDemand=20,
                targetCapacity=20,
                weeklySessions=[WeeklySessionInput(id="T", durationMinutes=120)],
                cycle=3,
            ),
            CourseInput(
                courseId="20118081",
                estimatedDemand=20,
                targetCapacity=20,
                weeklySessions=[WeeklySessionInput(id="T", durationMinutes=180)],
                cycle=8,
            ),
            CourseInput(
                courseId="C-NONE",
                estimatedDemand=20,
                targetCapacity=20,
                weeklySessions=[WeeklySessionInput(id="T", durationMinutes=60)],
                cycle=None,
            ),
        ],
        teachers=[
            TeacherInput(
                id="T-QUAL",
                courseIds=["C3", "20118081"],
                maxWeeklyMinutes=600,
                availability=windows,
                facultyId="FISI",
                qualificationSource="synthetic",
            ),
            TeacherInput(
                id="T-UNQUAL-THESIS",
                courseIds=["C3", "20118081"],
                maxWeeklyMinutes=480,
                availability=windows,
            ),
        ],
        rooms=[
            RoomInput(id="R1", capacity=30, availability=windows, kind=None),
        ],
        sections=[],
        requirements=[],
        assignments=[],
        pending=[
            PendingSessionItem(sessionId="P1", sectionId="S1", courseId="C3", durationMinutes=120),
            PendingSessionItem(sessionId="P2", sectionId="S2", courseId="20118081", durationMinutes=180),
            PendingSessionItem(sessionId="P3", sectionId="S3", courseId="C-NONE", durationMinutes=60),
        ],
        diagnostics=[],
        planningPolicy=PlanningPolicyInput(period="2027-I", allowAfternoon=False, allowSaturday=False),
        windows=windows,
    )

    diag = diagnose(req)

    # Zero assignments -> all occupancy usedMinutes == 0; room kind=None defaults to classroom
    assert all(c.usedMinutes == 0 for c in diag.occupancy)
    assert _cell(diag, 1, "mañana", "classroom").availableMinutes == 300
    assert _cell(diag, 1, "tarde", "classroom").availableMinutes == 0
    assert _cell(diag, 1, "noche", "classroom").availableMinutes == 240

    # Teacher slack + thesis eligibility check via is_eligible_for_course
    assert [(ts.teacherId, ts.assignedMinutes, ts.slackMinutes, ts.eligibleCourseIds) for ts in diag.teacherSlack] == [
        ("T-QUAL", 0, 600, ["C3", "20118081"]),
        ("T-UNQUAL-THESIS", 0, 480, ["C3"]),
    ]

    # Pending grouped by course and by cycle
    assert diag.pendingByCourse["C3"].totalMinutes == 120
    assert diag.pendingByCourse["20118081"].cycle == 8
    assert diag.pendingByCycle[3].sessionCount == 1
    assert diag.pendingByCycle[8].totalMinutes == 180
    assert diag.pendingByCycle[None].sectionIds == ["S3"]
    assert diag.totalPendingCount == 3
    assert diag.unknownCauseSessionIds == ["P1", "P2", "P3"]


def test_diagnosis_partial_overlap_and_saturation_threshold() -> None:
    windows = _full_week_windows((1,))
    req = AdvisorAnalyzeRequest(
        proposalId="prop-overlap",
        editVersion=0,
        courses=[],
        teachers=[
            TeacherInput(id="T1", courseIds=[], maxWeeklyMinutes=120, availability=windows),
        ],
        rooms=[
            RoomInput(id="R1", capacity=30, availability=windows, kind="classroom"),
        ],
        sections=[],
        requirements=[],
        assignments=[
            # 12:00-15:00 overlaps mañana (480-780) by 60 min and tarde (840-1080) by 60 min
            AssignmentOutput(
                id="A1",
                sectionId="S1",
                teacherId="T1",
                roomId="R1",
                interval=TimeInterval(day=1, startMinute=720, endMinute=900),
            ),
            # 18:00-21:00 uses 180 of 240 noche min (75% -> not low-occupancy)
            AssignmentOutput(
                id="A2",
                sectionId="S1",
                teacherId="T1",
                roomId="R1",
                interval=TimeInterval(day=1, startMinute=1080, endMinute=1260),
            ),
        ],
        pending=[],
        diagnostics=[],
        planningPolicy=None,
        windows=windows,
    )

    diag = diagnose(req)
    assert _cell(diag, 1, "mañana", "classroom").usedMinutes == 60
    assert _cell(diag, 1, "tarde", "classroom").usedMinutes == 60
    assert _cell(diag, 1, "noche", "classroom").usedMinutes == 180

    # Teacher over-assigned (360 assigned vs 120 max) -> negative slack -240
    assert diag.teacherSlack[0].assignedMinutes == 360
    assert diag.teacherSlack[0].slackMinutes == -240

    # Only mañana (60/300=20%) and tarde (60/240=25%) are <= 50%; noche (180/240=75%) is excluded
    assert [(s.band, s.usedMinutes, s.availableMinutes) for s in diag.emptyOrLowOccupancySlots] == [
        ("mañana", 60, 300),
        ("tarde", 60, 240),
    ]


def test_catalog_order_and_stale_teacher_load_guard() -> None:
    assert [h.kind for h in RECOMMENDATION_CATALOG] == [
        "increase_teacher_load",
        "enable_planning_window",
        "incorporate_reference_resource",
        "change_delivery_mode",
    ]

    windows = _full_week_windows((1,))
    req = AdvisorAnalyzeRequest(
        proposalId="prop-stale",
        editVersion=0,
        courses=[],
        teachers=[TeacherInput(id="T1", courseIds=[], maxWeeklyMinutes=300, availability=windows)],
        rooms=[],
        sections=[],
        requirements=[],
        assignments=[],
        pending=[],
        diagnostics=[],
        windows=windows,
    )
    stale_patch = IncreaseTeacherLoadPatch(
        adjustments=[
            TeacherLoadAdjustment(
                teacherId="T1",
                previousMaxWeeklyMinutes=120,
                nextMaxWeeklyMinutes=300,
            )
        ]
    )
    with pytest.raises(ValueError, match="Stale teacher load"):
        CATALOG_BY_KIND["increase_teacher_load"].apply(req, stale_patch)
