"""Baseline parity snapshot tests for build_deterministic_analysis and run_cpsat_dry_run."""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from advisor import build_deterministic_analysis
from advisor_agent import run_cpsat_dry_run
from models import (
    AssignmentOutput,
    DiagnosticOutput,
    PlanningPolicyInput,
    ReferenceRoomInput,
    ReferenceTeacherInput,
    TimeInterval,
)
from test_advisor_agent import sample

SNAPSHOT_PATH = Path(__file__).with_name("test_advisor_parity_snapshots.json")
SNAPSHOTS = json.loads(SNAPSHOT_PATH.read_text(encoding="utf-8"))


def _make_cumulative_slack():
    req = sample()
    req.teachers[0].maxWeeklyMinutes = 300
    course = req.courses[0].model_copy(deep=True)
    course.courseId = "C2"
    req.courses.append(course)
    req.teachers[0].courseIds.append("C2")
    for item in list(req.pending):
        req.pending.append(
            item.model_copy(
                update={
                    "courseId": "C2",
                    "sectionId": "S2",
                    "sessionId": item.sessionId + "2",
                }
            )
        )
    return req


def _make_window_case(afternoon: bool, saturday: bool):
    req = sample()
    req.courses[0].cycle = 7
    req.planningPolicy = PlanningPolicyInput(
        period="2027-I", allowAfternoon=afternoon, allowSaturday=saturday
    )
    req.pending = [
        req.pending[0].model_copy(update={"sessionId": f"pending-{i}"})
        for i in range(7)
    ]
    return req


def _make_all_four_kinds():
    req = sample()
    wide = [TimeInterval(day=d, startMinute=480, endMinute=1320) for d in (1, 2)]
    req.windows = wide
    req.teachers[0].availability = wide
    req.rooms[0].availability = wide
    req.courses[0].cycle = 7
    req.planningPolicy = PlanningPolicyInput(
        period="2027-I", allowAfternoon=False, allowSaturday=False
    )
    req.pending = [
        req.pending[0].model_copy(update={"sessionId": f"pending-{i}"})
        for i in range(7)
    ]
    c2 = req.courses[0].model_copy(
        update={"courseId": "C2", "name": "Missing Teacher Course", "cycle": 3}
    )
    req.courses.append(c2)
    req.sections.append(req.sections[0].model_copy(update={"id": "S2", "courseId": "C2"}))
    req.requirements.extend(
        [
            r.model_copy(update={"id": r.id + "2", "sectionId": "S2", "courseId": "C2"})
            for r in list(req.requirements)
        ]
    )
    req.pending.extend(
        [
            req.pending[0].model_copy(
                update={
                    "sessionId": "T2",
                    "sectionId": "S2",
                    "courseId": "C2",
                    "durationMinutes": 120,
                }
            ),
            req.pending[0].model_copy(
                update={
                    "sessionId": "P2",
                    "sectionId": "S2",
                    "courseId": "C2",
                    "durationMinutes": 120,
                }
            ),
        ]
    )
    req.referenceTeachers = [
        ReferenceTeacherInput(id="ref-t1", name="Ref Teacher 1", courseIds=["C2"]),
    ]
    req.referenceRooms = [
        ReferenceRoomInput(
            id=f"ref-r{i}", name=f"Ref Room {i}", capacity=30, kind="laboratory"
        )
        for i in range(1, 8)
    ]
    req.diagnostics = [
        DiagnosticOutput(
            code="NO_COMPATIBLE_ROOM", message="No compatible room", sessionIds=["T2"]
        )
    ]
    return req


def _make_zero_pending():
    req = sample()
    req.pending = []
    req.assignments = [
        AssignmentOutput(
            id="T",
            sectionId="S1",
            teacherId="synthetic-teacher-id",
            roomId="R1",
            interval=TimeInterval(day=1, startMinute=480, endMinute=600),
        ),
        AssignmentOutput(
            id="P",
            sectionId="S1",
            teacherId="synthetic-teacher-id",
            roomId="R1",
            interval=TimeInterval(day=2, startMinute=480, endMinute=600),
        ),
    ]
    return req


CASES = {
    "sample": sample,
    "cumulative_slack": _make_cumulative_slack,
    "window_afternoon_only": lambda: _make_window_case(False, True),
    "window_saturday_only": lambda: _make_window_case(True, False),
    "all_four_kinds": _make_all_four_kinds,
    "zero_pending": _make_zero_pending,
}


@pytest.mark.parametrize("case_name", list(CASES.keys()))
def test_deterministic_analysis_byte_parity(case_name: str) -> None:
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
    expected = SNAPSHOTS[case_name]
    assert actual_json == expected["analysis_json"]

    ids = [r.id for r in recs]
    assert run_cpsat_dry_run(req, recs, ids).model_dump() == expected["impact_all"]
    assert run_cpsat_dry_run(req, recs, []).model_dump() == expected["impact_empty"]
