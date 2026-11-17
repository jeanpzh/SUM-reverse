from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field, model_validator
from normative import NormativeResponse


class TimeInterval(BaseModel):
    day: int = Field(ge=1, le=7)
    startMinute: int = Field(ge=0, le=1439)
    endMinute: int = Field(ge=1, le=1440)


class SectionLimit(BaseModel):
    courseId: str
    maxSections: int = Field(ge=0, le=128)


class TeacherInput(BaseModel):
    id: str
    name: str | None = None
    courseIds: list[str]
    maxWeeklyMinutes: int = Field(ge=0)
    availability: list[TimeInterval]
    preferences: list[TimeInterval] | None = None
    sectionLimits: list[SectionLimit] | None = None
    facultyId: str | None = None
    category: Literal["principal", "asociado", "auxiliar"] | None = None
    qualificationSource: Literal["synthetic"] | None = None


class RoomInput(BaseModel):
    id: str
    name: str | None = None
    capacity: int = Field(ge=1)
    availability: list[TimeInterval]
    kind: Literal["classroom", "laboratory"] | None = None


class WeeklySessionInput(BaseModel):
    id: str
    durationMinutes: int = Field(ge=1, le=1440)
    type: str | None = None


class SectionCapacityOverride(BaseModel):
    ordinal: int = Field(ge=1)
    capacity: int = Field(ge=1)


TeacherAssignmentMode = Literal[
    "single-teacher-section",
    "tp-grouped-l-independent",
    "per-session",
]


class CourseInput(BaseModel):
    courseId: str
    name: str | None = None
    estimatedDemand: int = Field(ge=0)
    targetCapacity: int = Field(ge=1)
    weeklySessions: list[WeeklySessionInput]
    deliveryMode: Literal["continuous", "split"] = "continuous"
    teacherAssignmentMode: TeacherAssignmentMode = "single-teacher-section"
    cycle: int | None = None
    sectionCapacities: list[SectionCapacityOverride] | None = None


class PlanningPolicyExceptionsInput(BaseModel):
    saturdayStartMinute: int | None = Field(default=None, ge=0, le=1439, exclude_if=lambda v: v is None)
    saturdayEndMinute: int | None = Field(default=None, ge=1, le=1440, exclude_if=lambda v: v is None)

    @model_validator(mode="after")
    def _validate_range(self) -> PlanningPolicyExceptionsInput:
        start = self.saturdayStartMinute if self.saturdayStartMinute is not None else 480
        end = self.saturdayEndMinute if self.saturdayEndMinute is not None else 780
        if start >= end:
            raise ValueError("Rango horario de excepción de sábado inválido")
        return self


class PlanningPolicyInput(BaseModel):
    revision: str = "FISI-PLANNING-1"
    period: str = Field(pattern=r"^20\d{2}-(I|II)$")
    allowAfternoon: bool = False
    allowSaturday: bool = False
    facultyId: str | None = Field(default=None, exclude_if=lambda v: v is None)
    source: str | None = Field(default=None, exclude_if=lambda v: v is None)
    exceptions: PlanningPolicyExceptionsInput | None = Field(default=None, exclude_if=lambda v: v is None)

    @model_validator(mode="after")
    def _validate_profile(self) -> PlanningPolicyInput:
        if self.facultyId is not None and self.facultyId != "FISI":
            raise ValueError(f"Facultad de política local no admitida o desconocida: {self.facultyId}")
        if self.source is not None and (not self.source.strip() or len(self.source) > 120):
            raise ValueError("Procedencia de política local inválida")
        if self.exceptions is not None:
            has_sat = (
                self.exceptions.saturdayStartMinute is not None
                or self.exceptions.saturdayEndMinute is not None
            )
            if has_sat and not self.allowSaturday:
                raise ValueError("La excepción de franja de sábado requiere allowSaturday activo")
        return self


class SectionInput(BaseModel):
    id: str
    courseId: str
    capacity: int
    cycle: int | None = None
    ordinal: int | None = None


class RequiredSessionInput(BaseModel):
    id: str
    sectionId: str
    courseId: str
    durationMinutes: int
    type: str | None = None
    order: int


class AssignmentOutput(BaseModel):
    id: str
    sectionId: str
    teacherId: str
    roomId: str
    interval: TimeInterval
    sessionType: str | None = None


class DiagnosticOutput(BaseModel):
    code: str
    message: str
    sessionIds: list[str]


class SolveScheduleRequest(BaseModel):
    courses: list[CourseInput]
    teachers: list[TeacherInput]
    rooms: list[RoomInput]
    sections: list[SectionInput]
    requirements: list[RequiredSessionInput]
    windows: list[TimeInterval]
    startStepMinutes: int = 60
    allocationPolicy: Literal["preferences", "balanced", "first-feasible"] = "preferences"
    planningPolicy: PlanningPolicyInput | None = None
    maxTimeSeconds: float = Field(default=3.0, gt=0.1, le=10.0)


class SolveScheduleResponse(BaseModel):
    status: Literal["complete", "impossible", "search-limit"]
    assignments: list[AssignmentOutput]
    exploredCandidates: int
    candidateVisits: int
    backtracks: int
    limitReason: Literal["explorations", "work", "time"] | None = None
    diagnostics: list[DiagnosticOutput]


class ReferenceTeacherInput(BaseModel):
    id: str
    name: str
    courseIds: list[str]


class ReferenceRoomInput(BaseModel):
    id: str
    name: str
    capacity: int
    kind: Literal["classroom", "laboratory"]


class TeacherLoadAdjustment(BaseModel):
    teacherId: str
    previousMaxWeeklyMinutes: int
    nextMaxWeeklyMinutes: int


class IncreaseTeacherLoadPatch(BaseModel):
    kind: Literal["increase_teacher_load"] = "increase_teacher_load"
    adjustments: list[TeacherLoadAdjustment]


class EnablePlanningWindowPatch(BaseModel):
    kind: Literal["enable_planning_window"] = "enable_planning_window"
    allowAfternoon: Literal[True] | None = Field(default=None, exclude_if=lambda value: value is None)
    allowSaturday: Literal[True] | None = Field(default=None, exclude_if=lambda value: value is None)


class ChangeDeliveryModePatch(BaseModel):
    kind: Literal["change_delivery_mode"] = "change_delivery_mode"
    courseIds: list[str]
    deliveryMode: Literal["split"] | None = Field(default=None, exclude_if=lambda value: value is None)
    teacherAssignmentMode: Literal["tp-grouped-l-independent", "per-session"] | None = Field(default=None, exclude_if=lambda value: value is None)

    @model_validator(mode="after")
    def _require_change(self) -> ChangeDeliveryModePatch:
        if self.deliveryMode is None and self.teacherAssignmentMode is None:
            raise ValueError("Modalidad requiere cambio de distribución o asignación docente")
        return self


class IncorporateReferenceResourcePatch(BaseModel):
    kind: Literal["incorporate_reference_resource"] = "incorporate_reference_resource"
    teacherIds: list[str]
    roomIds: list[str]


AcademicAdvisorPatch = (
    IncreaseTeacherLoadPatch
    | EnablePlanningWindowPatch
    | ChangeDeliveryModePatch
    | IncorporateReferenceResourcePatch
)


class AdvisorBottleneck(BaseModel):
    category: Literal[
        "teacher_load",
        "planning_window",
        "missing_resource",
        "delivery_mode",
        "other",
    ]
    title: str
    detail: str
    affectedSessionCount: int = Field(ge=0)


class AdvisorRecommendation(BaseModel):
    id: str
    title: str
    rationale: str
    impactSummary: str
    recommendedByDefault: bool
    patch: (
        IncreaseTeacherLoadPatch
        | EnablePlanningWindowPatch
        | ChangeDeliveryModePatch
        | IncorporateReferenceResourcePatch
    )


class AdvisorSource(BaseModel):
    mode: Literal["llm-assisted", "deterministic-fallback"]
    providerLabel: str | None
    fallbackReason: (
        Literal[
            "not_configured",
            "timeout",
            "rate_limited",
            "upstream_error",
            "invalid_llm_output",
        ]
        | None
    ) = Field(default=None, exclude_if=lambda value: value is None)


class PendingSessionItem(BaseModel):
    sessionId: str
    sectionId: str
    courseId: str
    durationMinutes: int


class AdvisorAnalyzeRequest(BaseModel):
    proposalId: str
    editVersion: int = Field(ge=0)
    courses: list[CourseInput]
    teachers: list[TeacherInput]
    rooms: list[RoomInput]
    sections: list[SectionInput]
    requirements: list[RequiredSessionInput]
    assignments: list[AssignmentOutput]
    pending: list[PendingSessionItem]
    diagnostics: list[DiagnosticOutput]
    planningPolicy: PlanningPolicyInput | None = None
    allocationPolicy: Literal["preferences", "balanced", "first-feasible"] = "preferences"
    windows: list[TimeInterval] = Field(default_factory=lambda: [TimeInterval(day=d, startMinute=480, endMinute=1320) for d in range(1, 7)])
    startStepMinutes: int = Field(default=60, ge=1)
    selectedRecommendationIds: list[str] | None = None
    referenceTeachers: list[ReferenceTeacherInput] = Field(default_factory=list)
    referenceRooms: list[ReferenceRoomInput] = Field(default_factory=list)


class AdvisorVerifiedImpact(BaseModel):
    currentScheduledSessions: int = Field(ge=0)
    projectedScheduledSessions: int = Field(ge=0)
    requiredSessions: int = Field(ge=0)
    currentCompleteSections: int = Field(ge=0)
    projectedCompleteSections: int = Field(ge=0)
    totalSections: int = Field(ge=0)
    recommendationIds: list[str]
    solverStatus: Literal["complete", "impossible", "search-limit"]


class AdvisorReasoningStep(BaseModel):
    toolName: str
    inputSummary: str
    outputSummary: str


class AcademicAdvisorResponse(BaseModel):
    normativeContext: NormativeResponse | None = Field(default=None, exclude_if=lambda value: value is None)
    proposalId: str
    editVersion: int
    source: AdvisorSource
    summary: str
    bottlenecks: list[AdvisorBottleneck]
    recommendations: list[AdvisorRecommendation]

    verifiedImpact: AdvisorVerifiedImpact | None = Field(default=None, exclude_if=lambda value: value is None)
    reasoningSteps: list[AdvisorReasoningStep] = Field(default_factory=list)
