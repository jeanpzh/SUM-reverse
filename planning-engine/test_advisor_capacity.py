"""Free-slot screen over synthetic fixtures: each fit names the lever that opens it."""
from __future__ import annotations

from advisor import build_deterministic_analysis
from advisor_capacity import screen_free_slots
from models import (
    AdvisorAnalyzeRequest,
    AssignmentOutput,
    CourseInput,
    PendingSessionItem,
    PlanningPolicyInput,
    RequiredSessionInput,
    RoomInput,
    SectionInput,
    TeacherInput,
    TimeInterval,
    WeeklySessionInput,
)

WEEK = [TimeInterval(day=d, startMinute=480, endMinute=1320) for d in range(1, 7)]


def build(
    *,
    cycle: int = 1,
    session_type: str | None = None,
    delivery: str = "continuous",
    durations: tuple[int, ...] = (120,),
    teacher_availability: list[TimeInterval] | None = None,
    teacher_max: int = 600,
    room_kind: str = "classroom",
    allow_afternoon: bool = False,
    allow_saturday: bool = False,
    assignments: list[AssignmentOutput] | None = None,
) -> AdvisorAnalyzeRequest:
    sessions = [WeeklySessionInput(id=f"K{i}", durationMinutes=d, type=session_type) for i, d in enumerate(durations)]
    reqs = [
        RequiredSessionInput(id=f"S1-K{i}", sectionId="S1", courseId="C1", durationMinutes=d, type=session_type, order=i)
        for i, d in enumerate(durations)
    ]
    return AdvisorAnalyzeRequest(
        proposalId="p",
        editVersion=0,
        courses=[CourseInput(courseId="C1", name="Curso sintético", estimatedDemand=10, targetCapacity=10,
                             weeklySessions=sessions, deliveryMode=delivery, cycle=cycle)],
        teachers=[TeacherInput(id="T1", courseIds=["C1"], maxWeeklyMinutes=teacher_max,
                               availability=teacher_availability if teacher_availability is not None else WEEK)],
        rooms=[RoomInput(id="R1", capacity=20, availability=WEEK, kind=room_kind)],
        sections=[SectionInput(id="S1", courseId="C1", capacity=10, cycle=cycle, ordinal=1)],
        requirements=reqs,
        assignments=assignments or [],
        pending=[PendingSessionItem(sessionId=r.id, sectionId="S1", courseId="C1", durationMinutes=r.durationMinutes) for r in reqs],
        diagnostics=[],
        planningPolicy=PlanningPolicyInput(period="2027-I", allowAfternoon=allow_afternoon, allowSaturday=allow_saturday),
        windows=WEEK,
    )


def only_fit(req: AdvisorAnalyzeRequest):
    screen = screen_free_slots(req)
    assert len(screen.fits) == 1, screen
    return screen.fits[0]


def test_free_gap_today_needs_no_lever():
    fit = only_fit(build())
    assert fit.windowLevers == [] and not fit.needsTeacherLoad
    assert {slot.day for slot in fit.slots} == {1, 2, 3, 4, 5}


def test_senior_course_outside_evening_fits_only_by_opening_afternoon():
    afternoon_only = [TimeInterval(day=d, startMinute=840, endMinute=1080) for d in range(1, 6)]
    fit = only_fit(build(cycle=8, teacher_availability=afternoon_only))
    assert fit.windowLevers == ["afternoon"]
    assert {slot.band for slot in fit.slots} == {"tarde"}


def test_saturday_gap_opens_only_with_saturday_lever_and_only_in_the_morning():
    saturday = [TimeInterval(day=6, startMinute=480, endMinute=1320)]
    fit = only_fit(build(teacher_availability=saturday))
    assert fit.windowLevers == ["saturday"]
    assert {(slot.day, slot.band) for slot in fit.slots} == {(6, "mañana")}


def test_enabled_saturday_is_not_reported_as_a_lever():
    saturday = [TimeInterval(day=6, startMinute=480, endMinute=780)]
    fit = only_fit(build(teacher_availability=saturday, allow_saturday=True))
    assert fit.windowLevers == []


def test_laboratory_session_never_fits_a_classroom():
    screen = screen_free_slots(build(session_type="L", room_kind="classroom"))
    assert screen.fits == [] and screen.unfitSectionIds == ["S1"]
    fit = only_fit(build(session_type="L", room_kind="laboratory"))
    assert {slot.roomKind for slot in fit.slots} == {"laboratory"}


def test_teacher_at_top_load_yields_the_load_lever():
    fit = only_fit(build(teacher_max=60))
    assert fit.needsTeacherLoad and fit.windowLevers == []


def test_continuous_section_without_contiguous_gap_is_unfit_but_split_fits():
    two_hours_per_day = [TimeInterval(day=d, startMinute=480, endMinute=600) for d in range(1, 6)]
    continuous = build(durations=(120, 120), teacher_availability=two_hours_per_day)
    assert screen_free_slots(continuous).unfitSectionIds == ["S1"]
    split = build(durations=(120, 120), teacher_availability=two_hours_per_day, delivery="split")
    assert only_fit(split).windowLevers == []


def test_existing_assignments_block_their_slots():
    monday_only = [TimeInterval(day=1, startMinute=480, endMinute=600)]
    busy = AssignmentOutput(id="other", sectionId="OTHER", teacherId="T1", roomId="R9",
                            interval=TimeInterval(day=1, startMinute=480, endMinute=600))
    assert screen_free_slots(build(teacher_availability=monday_only, assignments=[busy])).fits == []


def test_finding_is_reported_without_inflating_the_bottleneck_count():
    summary, bottlenecks, _, _ = build_deterministic_analysis(build(teacher_max=60))
    finding = next(b for b in bottlenecks if b.title == "Huecos libres sin mover lo asignado")
    assert finding.category == "teacher_load"
    assert "ampliar carga (requiere autorización)" in finding.detail
    assert "no el impacto medido" in finding.detail
    assert f"{len(bottlenecks) - 1} cuello(s)" in summary
    assert "T1" not in finding.detail
