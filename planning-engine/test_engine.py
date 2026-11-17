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


def test_tp_grouped_l_independent_split_enforces_shared_tp_and_lab_room() -> None:
    from solver import solve_academic_schedule

    windows = _sample_windows()
    base_course = CourseInput(
        courseId="ANON_SPLIT_TPL",
        name="Curso Split TPL",
        estimatedDemand=45,
        targetCapacity=45,
        weeklySessions=[
            WeeklySessionInput(id="T", durationMinutes=120, type="T"),
            WeeklySessionInput(id="P", durationMinutes=120, type="P"),
            WeeklySessionInput(id="L", durationMinutes=120, type="L"),
        ],
        deliveryMode="split",
        teacherAssignmentMode="tp-grouped-l-independent",
        cycle=4,
    )
    rooms = [
        RoomInput(id="A1", name="Aula 1", capacity=50, availability=windows, kind="classroom"),
        RoomInput(id="LAB1", name="Lab 1", capacity=50, availability=windows, kind="laboratory"),
    ]
    sections = [SectionInput(id="S1", courseId="ANON_SPLIT_TPL", capacity=45, cycle=4, ordinal=1)]
    reqs = [
        RequiredSessionInput(id="S1:T", sectionId="S1", courseId="ANON_SPLIT_TPL", durationMinutes=120, type="T", order=0),
        RequiredSessionInput(id="S1:P", sectionId="S1", courseId="ANON_SPLIT_TPL", durationMinutes=120, type="P", order=1),
        RequiredSessionInput(id="S1:L", sectionId="S1", courseId="ANON_SPLIT_TPL", durationMinutes=120, type="L", order=2),
    ]

    # Case A: DOC_TP teaches T (day 1) and P (day 3) split across days; DOC_L teaches L (day 2) in laboratory.
    res_ok = solve_academic_schedule(
        SolveScheduleRequest(
            courses=[base_course],
            teachers=[
                TeacherInput(
                    id="DOC_TP",
                    courseIds=["ANON_SPLIT_TPL"],
                    maxWeeklyMinutes=240,
                    availability=[
                        TimeInterval(day=1, startMinute=480, endMinute=600),
                        TimeInterval(day=3, startMinute=480, endMinute=600),
                    ],
                ),
                TeacherInput(
                    id="DOC_L",
                    courseIds=["ANON_SPLIT_TPL"],
                    maxWeeklyMinutes=120,
                    availability=[TimeInterval(day=2, startMinute=480, endMinute=600)],
                ),
            ],
            rooms=rooms,
            sections=sections,
            requirements=reqs,
            windows=windows,
            planningPolicy=PlanningPolicyInput(period="2027-I"),
        )
    )
    assert res_ok.status == "complete"
    by_id = {a.id: a for a in res_ok.assignments}
    assert by_id["S1:T"].teacherId == "DOC_TP"
    assert by_id["S1:P"].teacherId == "DOC_TP"
    assert by_id["S1:T"].interval.day != by_id["S1:P"].interval.day
    assert by_id["S1:L"].teacherId == "DOC_L"
    assert by_id["S1:L"].roomId == "LAB1"

    # Case B: Even in deliveryMode='split', T+P still require 1 common teacher; two 120-min teachers cannot split T and P.
    res_tp_blocked = solve_academic_schedule(
        SolveScheduleRequest(
            courses=[base_course],
            teachers=[
                TeacherInput(
                    id="DOC_T_ONLY",
                    courseIds=["ANON_SPLIT_TPL"],
                    maxWeeklyMinutes=120,
                    availability=[TimeInterval(day=1, startMinute=480, endMinute=600)],
                ),
                TeacherInput(
                    id="DOC_P_ONLY",
                    courseIds=["ANON_SPLIT_TPL"],
                    maxWeeklyMinutes=120,
                    availability=[TimeInterval(day=3, startMinute=480, endMinute=600)],
                ),
                TeacherInput(
                    id="DOC_L_ONLY",
                    courseIds=["ANON_SPLIT_TPL"],
                    maxWeeklyMinutes=120,
                    availability=[TimeInterval(day=2, startMinute=480, endMinute=600)],
                ),
            ],
            rooms=[RoomInput(id="LAB1", name="Lab 1", capacity=50, availability=windows, kind="laboratory")],
            sections=sections,
            requirements=reqs,
            windows=windows,
            planningPolicy=PlanningPolicyInput(period="2027-I"),
        )
    )
    assert res_tp_blocked.status == "impossible"
    assert {a.id for a in res_tp_blocked.assignments} == {"S1:L"}


def test_per_session_assigns_distinct_teachers_without_section_overlap() -> None:
    from solver import solve_academic_schedule

    windows = _sample_windows()
    course = CourseInput(
        courseId="ANON_PERSESS",
        name="Curso Per Session",
        estimatedDemand=45,
        targetCapacity=45,
        weeklySessions=[
            WeeklySessionInput(id="T", durationMinutes=120, type="T"),
            WeeklySessionInput(id="P", durationMinutes=120, type="P"),
            WeeklySessionInput(id="L", durationMinutes=120, type="L"),
        ],
        deliveryMode="continuous",
        teacherAssignmentMode="per-session",
        cycle=4,
    )
    rooms = [
        RoomInput(id="A1", capacity=50, availability=windows, kind="classroom"),
        RoomInput(id="LAB1", capacity=50, availability=windows, kind="laboratory"),
    ]
    sections = [SectionInput(id="S1", courseId="ANON_PERSESS", capacity=45, cycle=4, ordinal=1)]
    reqs = [
        RequiredSessionInput(id="S1:T", sectionId="S1", courseId="ANON_PERSESS", durationMinutes=120, type="T", order=0),
        RequiredSessionInput(id="S1:P", sectionId="S1", courseId="ANON_PERSESS", durationMinutes=120, type="P", order=1),
        RequiredSessionInput(id="S1:L", sectionId="S1", courseId="ANON_PERSESS", durationMinutes=120, type="L", order=2),
    ]

    # Each teacher only has 120 min; T/P/L share Day 1 overlap window for P/L, forcing non-overlapping section slots.
    res = solve_academic_schedule(
        SolveScheduleRequest(
            courses=[course],
            teachers=[
                TeacherInput(
                    id="DOC_T",
                    courseIds=["ANON_PERSESS"],
                    maxWeeklyMinutes=120,
                    availability=[TimeInterval(day=1, startMinute=480, endMinute=600)],
                ),
                TeacherInput(
                    id="DOC_P",
                    courseIds=["ANON_PERSESS"],
                    maxWeeklyMinutes=120,
                    availability=[TimeInterval(day=1, startMinute=480, endMinute=720)],
                ),
                TeacherInput(
                    id="DOC_L",
                    courseIds=["ANON_PERSESS"],
                    maxWeeklyMinutes=120,
                    availability=[
                        TimeInterval(day=1, startMinute=480, endMinute=600),
                        TimeInterval(day=2, startMinute=480, endMinute=600),
                    ],
                ),
            ],
            rooms=rooms,
            sections=sections,
            requirements=reqs,
            windows=windows,
            planningPolicy=PlanningPolicyInput(period="2027-I"),
        )
    )
    assert res.status == "complete"
    by_id = {a.id: a for a in res.assignments}
    assert by_id["S1:T"].teacherId == "DOC_T"
    assert by_id["S1:P"].teacherId == "DOC_P"
    assert by_id["S1:L"].teacherId == "DOC_L"
    assert by_id["S1:L"].roomId == "LAB1"
    # Verify no internal section time overlap across T, P, L
    assigned = list(res.assignments)
    for i, a in enumerate(assigned):
        for b in assigned[i + 1 :]:
            assert (
                a.interval.day != b.interval.day
                or a.interval.endMinute <= b.interval.startMinute
                or b.interval.endMinute <= a.interval.startMinute
            )

    # Explicit SECTION_CONFLICT prevention: if two teachers only have identical slot, at most 1 group can be scheduled.
    res_conflict = solve_academic_schedule(
        SolveScheduleRequest(
            courses=[
                course.model_copy(
                    update={
                        "weeklySessions": [
                            WeeklySessionInput(id="T", durationMinutes=120, type="T"),
                            WeeklySessionInput(id="P", durationMinutes=120, type="P"),
                        ]
                    }
                )
            ],
            teachers=[
                TeacherInput(
                    id="DOC_1",
                    courseIds=["ANON_PERSESS"],
                    maxWeeklyMinutes=120,
                    availability=[TimeInterval(day=1, startMinute=480, endMinute=600)],
                ),
                TeacherInput(
                    id="DOC_2",
                    courseIds=["ANON_PERSESS"],
                    maxWeeklyMinutes=120,
                    availability=[TimeInterval(day=1, startMinute=480, endMinute=600)],
                ),
            ],
            rooms=[
                RoomInput(id="A1", capacity=50, availability=windows, kind="classroom"),
                RoomInput(id="A2", capacity=50, availability=windows, kind="classroom"),
            ],
            sections=sections,
            requirements=reqs[:2],
            windows=[TimeInterval(day=1, startMinute=480, endMinute=600)],
            planningPolicy=PlanningPolicyInput(period="2027-I"),
        )
    )
    assert len(res_conflict.assignments) == 1
    assert res_conflict.status == "search-limit"


def test_section_limits_counts_unique_sections_in_grouped_and_per_session_modes() -> None:
    from models import SectionLimit
    from solver import solve_academic_schedule

    windows = _sample_windows()
    for mode in ("tp-grouped-l-independent", "per-session"):
        req = SolveScheduleRequest(
            courses=[
                CourseInput(
                    courseId="ANON_LIM",
                    name="Curso Limite",
                    estimatedDemand=90,
                    targetCapacity=45,
                    weeklySessions=[
                        WeeklySessionInput(id="T", durationMinutes=120, type="T"),
                        WeeklySessionInput(id="P", durationMinutes=120, type="P"),
                        WeeklySessionInput(id="L", durationMinutes=120, type="L"),
                    ],
                    deliveryMode="split",
                    teacherAssignmentMode=mode,
                    cycle=4,
                )
            ],
            teachers=[
                TeacherInput(
                    id="DOC_1",
                    courseIds=["ANON_LIM"],
                    maxWeeklyMinutes=720,
                    availability=windows,
                    sectionLimits=[SectionLimit(courseId="ANON_LIM", maxSections=1)],
                ),
                TeacherInput(
                    id="DOC_2",
                    courseIds=["ANON_LIM"],
                    maxWeeklyMinutes=720,
                    availability=windows,
                    sectionLimits=[SectionLimit(courseId="ANON_LIM", maxSections=1)],
                ),
            ],
            rooms=[
                RoomInput(id="A1", capacity=50, availability=windows, kind="classroom"),
                RoomInput(id="LAB1", capacity=50, availability=windows, kind="laboratory"),
            ],
            sections=[
                SectionInput(id="S1", courseId="ANON_LIM", capacity=45, cycle=4, ordinal=1),
                SectionInput(id="S2", courseId="ANON_LIM", capacity=45, cycle=4, ordinal=2),
            ],
            requirements=[
                RequiredSessionInput(id="S1:T", sectionId="S1", courseId="ANON_LIM", durationMinutes=120, type="T", order=0),
                RequiredSessionInput(id="S1:P", sectionId="S1", courseId="ANON_LIM", durationMinutes=120, type="P", order=1),
                RequiredSessionInput(id="S1:L", sectionId="S1", courseId="ANON_LIM", durationMinutes=120, type="L", order=2),
                RequiredSessionInput(id="S2:T", sectionId="S2", courseId="ANON_LIM", durationMinutes=120, type="T", order=0),
                RequiredSessionInput(id="S2:P", sectionId="S2", courseId="ANON_LIM", durationMinutes=120, type="P", order=1),
                RequiredSessionInput(id="S2:L", sectionId="S2", courseId="ANON_LIM", durationMinutes=120, type="L", order=2),
            ],
            windows=windows,
            planningPolicy=PlanningPolicyInput(period="2027-I"),
        )
        res = solve_academic_schedule(req)
        assert res.status == "complete"
        assert len(res.assignments) == 6
        for tid in ("DOC_1", "DOC_2"):
            assert len({a.sectionId for a in res.assignments if a.teacherId == tid}) == 1

        # With only DOC_1 (maxSections=1), DOC_1 can cover all groups of 1 section (360 min), never the 2nd section.
        single_teacher_req = req.model_copy(update={"teachers": [req.teachers[0]]})
        res_one = solve_academic_schedule(single_teacher_req)
        assert res_one.status != "complete"
        assert len(res_one.assignments) == 3
        assert len({a.sectionId for a in res_one.assignments}) == 1
        assert any(d.code == "TEACHER_CAPACITY_SHORTFALL" for d in res_one.diagnostics)


def test_saturday_default_bounds_validation_and_non_invention_of_availability() -> None:
    import pytest
    from pydantic import ValidationError
    from solver import get_effective_planning_windows, solve_academic_schedule

    # Invalid exceptions without allowSaturday or reversed bounds must fail validation.
    with pytest.raises(ValidationError):
        PlanningPolicyInput(period="2027-I", allowSaturday=False, exceptions={"saturdayEndMinute": 840})
    with pytest.raises(ValidationError):
        PlanningPolicyInput(period="2027-I", allowSaturday=True, exceptions={"saturdayStartMinute": 900, "saturdayEndMinute": 780})

    # Default allowSaturday=True caps Saturday at 780 (13:00), rejecting 780..900.
    default_sat_policy = PlanningPolicyInput(period="2027-I", allowSaturday=True)
    sat_afternoon = [TimeInterval(day=6, startMinute=780, endMinute=900)]
    res_capped = solve_academic_schedule(
        SolveScheduleRequest(
            courses=[
                CourseInput(
                    courseId="ANON_SAT_DEF",
                    estimatedDemand=45,
                    targetCapacity=45,
                    weeklySessions=[WeeklySessionInput(id="T", durationMinutes=120, type="T")],
                    cycle=3,
                )
            ],
            teachers=[TeacherInput(id="T1", courseIds=["ANON_SAT_DEF"], maxWeeklyMinutes=600, availability=sat_afternoon)],
            rooms=[RoomInput(id="R1", capacity=50, availability=sat_afternoon, kind="classroom")],
            sections=[SectionInput(id="S1", courseId="ANON_SAT_DEF", capacity=45, cycle=3, ordinal=1)],
            requirements=[RequiredSessionInput(id="S1:T", sectionId="S1", courseId="ANON_SAT_DEF", durationMinutes=120, type="T", order=0)],
            windows=get_effective_planning_windows(_sample_windows(), default_sat_policy),
            planningPolicy=default_sat_policy,
        )
    )
    assert res_capped.assignments == []
    assert res_capped.status == "impossible"

    # Enabling allowSaturday never invents Saturday availability on weekday-only teachers/rooms.
    weekday_only = _sample_windows()
    sat_policy = PlanningPolicyInput(period="2027-I", allowAfternoon=False, allowSaturday=True)
    res_no_invent = solve_academic_schedule(
        SolveScheduleRequest(
            courses=[
                CourseInput(
                    courseId="ANON_NO_INVENT",
                    estimatedDemand=90,
                    targetCapacity=45,
                    weeklySessions=[WeeklySessionInput(id="T", durationMinutes=240, type="T")],
                    cycle=8,
                )
            ],
            teachers=[TeacherInput(id="T1", courseIds=["ANON_NO_INVENT"], maxWeeklyMinutes=600, availability=weekday_only)],
            rooms=[RoomInput(id="R1", capacity=50, availability=weekday_only, kind="classroom")],
            sections=[SectionInput(id="S1", courseId="ANON_NO_INVENT", capacity=45, cycle=8, ordinal=1)],
            requirements=[RequiredSessionInput(id="S1:T", sectionId="S1", courseId="ANON_NO_INVENT", durationMinutes=240, type="T", order=0)],
            windows=get_effective_planning_windows(weekday_only, sat_policy),
            planningPolicy=sat_policy,
        )
    )
    assert res_no_invent.status == "complete"
    assert all(a.interval.day != 6 for a in res_no_invent.assignments)


def test_legacy_omitted_fields_preserve_strict_single_teacher_behavior() -> None:
    from solver import resolve_planning_time_profile, solve_academic_schedule

    windows = _sample_windows()
    legacy_policy = PlanningPolicyInput(period="2027-I")
    profile = resolve_planning_time_profile(legacy_policy)
    assert profile["facultyId"] == "FISI"
    assert profile["source"] == "synthetic-local-default"
    assert profile["saturdayEndMinute"] == 780

    # Omitting teacherAssignmentMode defaults strictly to 'single-teacher-section'.
    legacy_course = CourseInput(
        courseId="ANON_LEG",
        estimatedDemand=45,
        targetCapacity=45,
        weeklySessions=[
            WeeklySessionInput(id="T", durationMinutes=120, type="T"),
            WeeklySessionInput(id="L", durationMinutes=120, type="L"),
        ],
        cycle=4,
    )
    assert legacy_course.teacherAssignmentMode == "single-teacher-section"

    req = SolveScheduleRequest(
        courses=[legacy_course],
        teachers=[
            TeacherInput(id="T1", courseIds=["ANON_LEG"], maxWeeklyMinutes=120, availability=windows),
            TeacherInput(id="T2", courseIds=["ANON_LEG"], maxWeeklyMinutes=120, availability=windows),
        ],
        rooms=[
            RoomInput(id="A1", capacity=50, availability=windows, kind="classroom"),
            RoomInput(id="LAB1", capacity=50, availability=windows, kind="laboratory"),
        ],
        sections=[SectionInput(id="S1", courseId="ANON_LEG", capacity=45, cycle=4, ordinal=1)],
        requirements=[
            RequiredSessionInput(id="S1:T", sectionId="S1", courseId="ANON_LEG", durationMinutes=120, type="T", order=0),
            RequiredSessionInput(id="S1:L", sectionId="S1", courseId="ANON_LEG", durationMinutes=120, type="L", order=1),
        ],
        windows=windows,
        planningPolicy=legacy_policy,
    )
    assert req.allocationPolicy == "preferences"
    res = solve_academic_schedule(req)
    assert res.status == "impossible"
    assert res.assignments == []
    assert any(d.code == "TEACHER_CAPACITY_SHORTFALL" for d in res.diagnostics)


def test_allocation_policy_three_way_differentiation() -> None:
    from solver import solve_academic_schedule

    # Single-day narrow window (08:00-14:00) forces preferences vs balanced vs first-feasible comparison:
    # T_PREF prefers BOTH 08:00-10:00 and 10:00-12:00 on Day 1 (+20 each); T_PLAIN has NO preferences (+5/+1).
    day1 = [TimeInterval(day=1, startMinute=480, endMinute=840)]
    req = SolveScheduleRequest(
        courses=[
            CourseInput(
                courseId="ANON_3POL",
                estimatedDemand=90,
                targetCapacity=45,
                weeklySessions=[WeeklySessionInput(id="T", durationMinutes=120, type="T")],
                cycle=3,
            )
        ],
        teachers=[
            TeacherInput(
                id="T_PLAIN",
                courseIds=["ANON_3POL"],
                maxWeeklyMinutes=600,
                availability=day1,
                preferences=[],
            ),
            TeacherInput(
                id="T_PREF",
                courseIds=["ANON_3POL"],
                maxWeeklyMinutes=600,
                availability=day1,
                preferences=[TimeInterval(day=1, startMinute=480, endMinute=720)],
            ),
        ],
        rooms=[
            RoomInput(id="R1", capacity=50, availability=day1, kind="classroom"),
            RoomInput(id="R2", capacity=50, availability=day1, kind="classroom"),
        ],
        sections=[
            SectionInput(id="S1", courseId="ANON_3POL", capacity=45, cycle=3, ordinal=1),
            SectionInput(id="S2", courseId="ANON_3POL", capacity=45, cycle=3, ordinal=2),
        ],
        requirements=[
            RequiredSessionInput(id="S1:T", sectionId="S1", courseId="ANON_3POL", durationMinutes=120, type="T", order=0),
            RequiredSessionInput(id="S2:T", sectionId="S2", courseId="ANON_3POL", durationMinutes=120, type="T", order=0),
        ],
        windows=day1,
        planningPolicy=PlanningPolicyInput(period="2027-I"),
    )

    pref_res = solve_academic_schedule(req.model_copy(update={"allocationPolicy": "preferences"}))
    bal_res = solve_academic_schedule(req.model_copy(update={"allocationPolicy": "balanced"}))
    ff_res = solve_academic_schedule(req.model_copy(update={"allocationPolicy": "first-feasible"}))

    assert pref_res.status == "complete"
    assert bal_res.status == "complete"
    assert ff_res.status == "complete"

    # 'preferences' concentrates both sections on T_PREF (2 preference hits -> max_load = 240).
    assert [a.teacherId for a in pref_res.assignments] == ["T_PREF", "T_PREF"]
    # 'balanced' splits evenly between T_PLAIN and T_PREF (max_load = 120) while still honoring T_PREF's slot.
    assert {a.teacherId for a in bal_res.assignments} == {"T_PLAIN", "T_PREF"}
    # 'first-feasible' ignores preferences/load penalties while reaching complete coverage cleanly.
    assert len(ff_res.assignments) == 2

