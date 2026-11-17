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


def test_tp_grouped_l_independent_allows_separate_lab_teacher_while_keeping_tp_same_teacher() -> None:
    from solver import solve_academic_schedule
    windows = _sample_windows()
    req = SolveScheduleRequest(
        courses=[
            CourseInput(
                courseId="ANON_SYS",
                name="Sistemas Anonimo",
                estimatedDemand=45,
                targetCapacity=45,
                weeklySessions=[
                    WeeklySessionInput(id="T", durationMinutes=120, type="T"),
                    WeeklySessionInput(id="P", durationMinutes=120, type="P"),
                    WeeklySessionInput(id="L", durationMinutes=120, type="L"),
                ],
                deliveryMode="continuous",
                teacherAssignmentMode="tp-grouped-l-independent",
                cycle=5,
            )
        ],
        teachers=[
            TeacherInput(
                id="DOCENTE_A",
                name="Docente A",
                courseIds=["ANON_SYS"],
                maxWeeklyMinutes=240,
                availability=[TimeInterval(day=5, startMinute=480, endMinute=720)],
            ),
            TeacherInput(
                id="DOCENTE_B",
                name="Docente B",
                courseIds=["ANON_SYS"],
                maxWeeklyMinutes=120,
                availability=[TimeInterval(day=4, startMinute=600, endMinute=720)],
            ),
        ],
        rooms=[
            RoomInput(id="A1", name="Aula 1", capacity=50, availability=windows, kind="classroom"),
            RoomInput(id="LAB1", name="Lab 1", capacity=50, availability=windows, kind="laboratory"),
        ],
        sections=[SectionInput(id="SEC_1", courseId="ANON_SYS", capacity=45, cycle=5, ordinal=1)],
        requirements=[
            RequiredSessionInput(id="SEC_1:T", sectionId="SEC_1", courseId="ANON_SYS", durationMinutes=120, type="T", order=0),
            RequiredSessionInput(id="SEC_1:P", sectionId="SEC_1", courseId="ANON_SYS", durationMinutes=120, type="P", order=1),
            RequiredSessionInput(id="SEC_1:L", sectionId="SEC_1", courseId="ANON_SYS", durationMinutes=120, type="L", order=2),
        ],
        windows=windows,
        planningPolicy=PlanningPolicyInput(period="2027-I"),
    )
    res = solve_academic_schedule(req)
    assert res.status == "complete"
    by_id = {a.id: a for a in res.assignments}
    assert by_id["SEC_1:T"].teacherId == "DOCENTE_A"
    assert by_id["SEC_1:P"].teacherId == "DOCENTE_A"
    assert by_id["SEC_1:T"].interval.day == 5
    assert by_id["SEC_1:P"].interval.startMinute == by_id["SEC_1:T"].interval.endMinute
    assert by_id["SEC_1:L"].teacherId == "DOCENTE_B"
    assert by_id["SEC_1:L"].interval.day == 4


def test_saturday_exceptions_and_unknown_faculty_rejection() -> None:
    import pytest
    from pydantic import ValidationError
    from solver import get_effective_planning_windows, solve_academic_schedule

    with pytest.raises(ValidationError):
        PlanningPolicyInput(period="2027-I", facultyId="UNKNOWN_FAC")

    sat_14_18 = [TimeInterval(day=6, startMinute=840, endMinute=1080)]
    policy = PlanningPolicyInput(
        period="2027-I",
        facultyId="FISI",
        allowAfternoon=True,
        allowSaturday=True,
        source="explicit-config",
        exceptions={"saturdayStartMinute": 840, "saturdayEndMinute": 1080},
    )
    req = SolveScheduleRequest(
        courses=[
            CourseInput(
                courseId="ANON_SAT",
                name="Curso Sabado",
                estimatedDemand=45,
                targetCapacity=45,
                weeklySessions=[WeeklySessionInput(id="T", durationMinutes=180, type="T")],
                deliveryMode="continuous",
                cycle=8,
            )
        ],
        teachers=[
            TeacherInput(id="TA", name="Docente Sat", courseIds=["ANON_SAT"], maxWeeklyMinutes=600, availability=sat_14_18)
        ],
        rooms=[RoomInput(id="R1", name="Aula 1", capacity=50, availability=sat_14_18, kind="classroom")],
        sections=[SectionInput(id="S1", courseId="ANON_SAT", capacity=45, cycle=8, ordinal=1)],
        requirements=[RequiredSessionInput(id="S1:T", sectionId="S1", courseId="ANON_SAT", durationMinutes=180, type="T", order=0)],
        windows=get_effective_planning_windows(_sample_windows(), policy),
        planningPolicy=policy,
    )
    res = solve_academic_schedule(req)
    assert res.status == "complete"
    assert res.assignments[0].interval.day == 6
    assert res.assignments[0].interval.startMinute >= 840
    assert res.assignments[0].interval.endMinute <= 1080


def test_allocation_policy_produces_verifiably_distinct_schedules() -> None:
    from solver import solve_academic_schedule
    windows = _sample_windows()
    pref_day1 = [TimeInterval(day=1, startMinute=480, endMinute=600)]
    req = SolveScheduleRequest(
        courses=[
            CourseInput(
                courseId="ANON_POL",
                name="Curso Politica",
                estimatedDemand=90,
                targetCapacity=45,
                weeklySessions=[WeeklySessionInput(id="T", durationMinutes=120, type="T")],
                deliveryMode="continuous",
                cycle=3,
            )
        ],
        teachers=[
            TeacherInput(
                id="T_PREF",
                name="Docente Pref",
                courseIds=["ANON_POL"],
                maxWeeklyMinutes=600,
                availability=windows,
                preferences=pref_day1,
            ),
            TeacherInput(
                id="T_OTHER",
                name="Docente Other",
                courseIds=["ANON_POL"],
                maxWeeklyMinutes=600,
                availability=windows,
                preferences=[TimeInterval(day=5, startMinute=480, endMinute=600)],
            ),
        ],
        rooms=[
            RoomInput(id="R1", name="Aula 1", capacity=50, availability=windows, kind="classroom"),
            RoomInput(id="R2", name="Aula 2", capacity=50, availability=windows, kind="classroom"),
        ],
        sections=[
            SectionInput(id="S1", courseId="ANON_POL", capacity=45, cycle=3, ordinal=1),
            SectionInput(id="S2", courseId="ANON_POL", capacity=45, cycle=3, ordinal=2),
        ],
        requirements=[
            RequiredSessionInput(id="S1:T", sectionId="S1", courseId="ANON_POL", durationMinutes=120, type="T", order=0),
            RequiredSessionInput(id="S2:T", sectionId="S2", courseId="ANON_POL", durationMinutes=120, type="T", order=0),
        ],
        windows=windows,
        planningPolicy=PlanningPolicyInput(period="2027-I"),
    )
    pref_res = solve_academic_schedule(req.model_copy(update={"allocationPolicy": "preferences"}))
    bal_res = solve_academic_schedule(req.model_copy(update={"allocationPolicy": "balanced"}))
    assert pref_res.status == "complete" and bal_res.status == "complete"
    # Under 'preferences', T_PREF gets S1 on day 1; under 'balanced', loads are even (1 section each, max_load=120)
    bal_teachers = [a.teacherId for a in bal_res.assignments]
    assert set(bal_teachers) == {"T_PREF", "T_OTHER"}
    assert any(a.teacherId == "T_PREF" and a.interval.day == 1 for a in pref_res.assignments)
