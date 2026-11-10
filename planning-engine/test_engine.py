from __future__ import annotations

import json
import httpx
from fastapi.testclient import TestClient

from advisor import analyze_proposal_with_advisor
from main import app
from models import (
    AdvisorAnalyzeRequest,
    CourseInput,
    PendingSessionItem,
    PlanningPolicyInput,
    RequiredSessionInput,
    RoomInput,
    SectionInput,
    SolveScheduleRequest,
    TeacherInput,
    TimeInterval,
    WeeklySessionInput,
)

client = TestClient(app)


def _sample_windows() -> list[TimeInterval]:
    return [
        TimeInterval(day=d, startMinute=480, endMinute=1320)
        for d in range(1, 6)
    ]


def test_cpsat_solver_places_feasible_sections() -> None:
    windows = _sample_windows()
    req = SolveScheduleRequest(
        courses=[
            CourseInput(
                courseId="20118031",
                name="ALGORITMICA I",
                estimatedDemand=90,
                targetCapacity=45,
                weeklySessions=[
                    WeeklySessionInput(id="T", durationMinutes=120, type="T"),
                    WeeklySessionInput(id="P", durationMinutes=120, type="P"),
                ],
                deliveryMode="continuous",
                cycle=3,
            )
        ],
        teachers=[
            TeacherInput(
                id="T01",
                name="GARCIA PEREZ JUAN",
                courseIds=["20118031"],
                maxWeeklyMinutes=600,
                availability=windows,
            )
        ],
        rooms=[
            RoomInput(
                id="101AP",
                name="Aula 101 AP",
                capacity=50,
                availability=windows,
                kind="classroom",
            )
        ],
        sections=[
            SectionInput(
                id='section:["20118031",1]',
                courseId="20118031",
                capacity=45,
                cycle=3,
                ordinal=1,
            ),
            SectionInput(
                id='section:["20118031",2]',
                courseId="20118031",
                capacity=45,
                cycle=3,
                ordinal=2,
            ),
        ],
        requirements=[
            RequiredSessionInput(
                id='session:["section:[\\"20118031\\",1]","T"]',
                sectionId='section:["20118031",1]',
                courseId="20118031",
                durationMinutes=120,
                type="T",
                order=0,
            ),
            RequiredSessionInput(
                id='session:["section:[\\"20118031\\",1]","P"]',
                sectionId='section:["20118031",1]',
                courseId="20118031",
                durationMinutes=120,
                type="P",
                order=1,
            ),
            RequiredSessionInput(
                id='session:["section:[\\"20118031",2]","T"]',
                sectionId='section:["20118031",2]',
                courseId="20118031",
                durationMinutes=120,
                type="T",
                order=0,
            ),
            RequiredSessionInput(
                id='session:["section:[\\"20118031",2]","P"]',
                sectionId='section:["20118031",2]',
                courseId="20118031",
                durationMinutes=120,
                type="P",
                order=1,
            ),
        ],
        windows=windows,
        planningPolicy=PlanningPolicyInput(
            period="2027-I", allowAfternoon=False, allowSaturday=False
        ),
    )
    resp = client.post("/v1/solve", json=req.model_dump())
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "complete"
    assert len(body["assignments"]) == 4
