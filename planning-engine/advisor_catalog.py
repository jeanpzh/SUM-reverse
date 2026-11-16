"""Ordered catalog of recommendation-kind modules for the deterministic advisor."""
from __future__ import annotations

from collections import defaultdict
from typing import Any, Protocol

from advisor_diagnosis import BlockerDiagnosis
from models import (
    AdvisorAnalyzeRequest,
    AdvisorBottleneck,
    AdvisorRecommendation,
    ChangeDeliveryModePatch,
    EnablePlanningWindowPatch,
    IncorporateReferenceResourcePatch,
    IncreaseTeacherLoadPatch,
    RoomInput,
    TeacherInput,
    TeacherLoadAdjustment,
    TimeInterval,
)

MAX_WEEKLY_MINUTES = 2400


class RecommendationKind(Protocol):
    kind: str

    def applies(self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis) -> bool:
        ...

    def bottleneck(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> AdvisorBottleneck | None:
        ...

    def variants(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> list[AdvisorRecommendation]:
        ...

    def apply(self, request_copy: AdvisorAnalyzeRequest, patch: Any) -> None:
        ...


class IncreaseTeacherLoadKind:
    kind = "increase_teacher_load"

    def _evaluate(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> tuple[AdvisorBottleneck, list[AdvisorRecommendation]] | None:
        courses_by_id = {c.courseId: c for c in req.courses}
        teachers_by_id = {t.id: t for t in req.teachers}
        assigned_minutes_by_teacher = {
            ts.teacherId: ts.assignedMinutes for ts in diagnosis.teacherSlack
        }

        teacher_required_extra: dict[str, int] = defaultdict(int)
        teacher_unlocked_sections: dict[str, set[str]] = defaultdict(set)
        load_affected_sessions = 0
        load_course_names: list[str] = []
        reserved_minutes: dict[str, int] = defaultdict(int)

        for course_id, group in sorted(diagnosis.pendingByCourse.items()):
            course = courses_by_id.get(course_id)
            if not course:
                continue
            eligible = [
                teachers_by_id[ts.teacherId]
                for ts in diagnosis.teacherSlack
                if course_id in ts.eligibleCourseIds
            ]
            if not eligible:
                continue
            pending_mins = group.totalMinutes
            spare_mins = sum(
                max(
                    0,
                    t.maxWeeklyMinutes
                    + teacher_required_extra[t.id]
                    - assigned_minutes_by_teacher[t.id]
                    - reserved_minutes[t.id],
                )
                for t in eligible
            )
            if spare_mins < pending_mins:
                deficit = pending_mins - spare_mins
                load_affected_sessions += group.sessionCount
                load_course_names.append(course.name or course_id)
                expandable = [
                    t
                    for t in eligible
                    if t.maxWeeklyMinutes + teacher_required_extra[t.id]
                    < MAX_WEEKLY_MINUTES
                ]
                if expandable:
                    share = (deficit + len(expandable) - 1) // len(expandable)
                    share_rounded = ((share + 59) // 60) * 60 + 60
                    for t in expandable:
                        room_left = MAX_WEEKLY_MINUTES - (
                            t.maxWeeklyMinutes + teacher_required_extra[t.id]
                        )
                        add = min(room_left, max(60, share_rounded))
                        if add > 0:
                            teacher_required_extra[t.id] += add
                            for item in group.items:
                                teacher_unlocked_sections[t.id].add(item.sectionId)

            remaining = pending_mins
            for t in eligible:
                spare = max(
                    0,
                    t.maxWeeklyMinutes
                    + teacher_required_extra[t.id]
                    - assigned_minutes_by_teacher[t.id]
                    - reserved_minutes[t.id],
                )
                take = min(remaining, spare)
                reserved_minutes[t.id] += take
                remaining -= take

        if not teacher_required_extra:
            return None

        adjustments: list[TeacherLoadAdjustment] = []
        teacher_labels: list[str] = []
        unlocked_secs: set[str] = set()
        for t_id, extra in sorted(teacher_required_extra.items()):
            t = teachers_by_id[t_id]
            next_max = min(MAX_WEEKLY_MINUTES, t.maxWeeklyMinutes + extra)
            if next_max > t.maxWeeklyMinutes:
                adjustments.append(
                    TeacherLoadAdjustment(
                        teacherId=t_id,
                        previousMaxWeeklyMinutes=t.maxWeeklyMinutes,
                        nextMaxWeeklyMinutes=next_max,
                    )
                )
                t_name = t.name or t_id
                teacher_labels.append(
                    f"{t_name} ({t.maxWeeklyMinutes} → {next_max} min)"
                )
                unlocked_secs.update(teacher_unlocked_sections[t_id])

        if not adjustments:
            return None

        sample_courses = ", ".join(load_course_names[:4])
        more_courses = (
            f" y {len(load_course_names) - 4} más"
            if len(load_course_names) > 4
            else ""
        )
        bottleneck = AdvisorBottleneck(
            category="teacher_load",
            title=f"Tope semanal docente insuficiente en {len(load_course_names)} curso(s)",
            detail=(
                f"Los docentes habilitados agotan su tope actual (p. ej. 600 min/semana) frente a la demanda de {sample_courses}{more_courses}."
            ),
            affectedSessionCount=load_affected_sessions,
        )
        sample_teachers = ", ".join(teacher_labels[:4])
        more_teachers = (
            f" (+{len(teacher_labels) - 4} docentes)"
            if len(teacher_labels) > 4
            else ""
        )
        recommendation = AdvisorRecommendation(
            id="rec-increase-teacher-load",
            title=f"Ampliar carga máxima semanal de {len(adjustments)} docente(s) habilitados",
            rationale=(
                f"Escenario sintético sujeto a autorización externa; no acredita límite reglamentario ({MAX_WEEKLY_MINUTES} min del simulador) para cubrir las secciones pendientes: {sample_teachers}{more_teachers}."
            ),
            impactSummary=f"Destraba hasta {len(unlocked_secs)} sección(es) en {len(load_course_names)} curso(s)",
            recommendedByDefault=False,
            patch=IncreaseTeacherLoadPatch(adjustments=adjustments),
        )
        return bottleneck, [recommendation]

    def applies(self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis) -> bool:
        return self._evaluate(req, diagnosis) is not None

    def bottleneck(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> AdvisorBottleneck | None:
        result = self._evaluate(req, diagnosis)
        return result[0] if result is not None else None

    def variants(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> list[AdvisorRecommendation]:
        result = self._evaluate(req, diagnosis)
        return result[1] if result is not None else []

    def apply(
        self, request_copy: AdvisorAnalyzeRequest, patch: IncreaseTeacherLoadPatch
    ) -> None:
        for adjustment in patch.adjustments:
            teacher = next(
                t for t in request_copy.teachers if t.id == adjustment.teacherId
            )
            if teacher.maxWeeklyMinutes != adjustment.previousMaxWeeklyMinutes:
                raise ValueError("Stale teacher load")
            teacher.maxWeeklyMinutes = adjustment.nextMaxWeeklyMinutes


class EnablePlanningWindowKind:
    kind = "enable_planning_window"

    def _evaluate(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> tuple[AdvisorBottleneck, list[AdvisorRecommendation]] | None:
        if not req.planningPolicy or (
            req.planningPolicy.allowAfternoon and req.planningPolicy.allowSaturday
        ):
            return None
        senior_pending_count = sum(
            group.sessionCount
            for cycle, group in diagnosis.pendingByCycle.items()
            if (cycle or 0) >= 7
        )
        need_afternoon = (
            not req.planningPolicy.allowAfternoon and senior_pending_count > 0
        )
        need_saturday = (
            not req.planningPolicy.allowSaturday and diagnosis.totalPendingCount > 6
        )
        if not (need_afternoon or need_saturday):
            return None

        win_sessions = (
            senior_pending_count if need_afternoon else diagnosis.totalPendingCount
        )
        bottleneck = AdvisorBottleneck(
            category="planning_window",
            title="Restricción de franja horaria en ciclos superiores / semana",
            detail=(
                f"Los cursos de ciclo VII–X están restringidos a 18:00–22:00 ({senior_pending_count} componentes pendientes) y el sábado permanece cerrado."
            ),
            affectedSessionCount=win_sessions,
        )
        recommendation = AdvisorRecommendation(
            id="rec-enable-planning-window",
            title="Habilitar excepción de turno tarde (14:00–22:00) y sábado (08:00–13:00)",
            rationale=(
                "Permite ubicar secciones de ciclos VII–X desde las 14:00 y abre la mañana del sábado para absorber colisiones de cohorte y aula."
            ),
            impactSummary=f"Amplía ventanas para {len(diagnosis.pendingSectionIds)} sección(es) pendientes",
            recommendedByDefault=True,
            patch=EnablePlanningWindowPatch(
                allowAfternoon=True if not req.planningPolicy.allowAfternoon else None,
                allowSaturday=True if not req.planningPolicy.allowSaturday else None,
            ),
        )
        return bottleneck, [recommendation]

    def applies(self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis) -> bool:
        return self._evaluate(req, diagnosis) is not None

    def bottleneck(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> AdvisorBottleneck | None:
        result = self._evaluate(req, diagnosis)
        return result[0] if result is not None else None

    def variants(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> list[AdvisorRecommendation]:
        result = self._evaluate(req, diagnosis)
        return result[1] if result is not None else []

    def apply(
        self, request_copy: AdvisorAnalyzeRequest, patch: EnablePlanningWindowPatch
    ) -> None:
        if request_copy.planningPolicy:
            if patch.allowAfternoon:
                request_copy.planningPolicy.allowAfternoon = True
            if patch.allowSaturday:
                request_copy.planningPolicy.allowSaturday = True


class IncorporateReferenceResourceKind:
    kind = "incorporate_reference_resource"

    def _evaluate(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> tuple[AdvisorBottleneck, list[AdvisorRecommendation]] | None:
        workspace_teacher_ids = {t.id for t in req.teachers}
        missing_teacher_ids: list[str] = []
        unqualified_sessions = 0

        for course_id, group in diagnosis.pendingByCourse.items():
            has_eligible = any(
                course_id in ts.eligibleCourseIds for ts in diagnosis.teacherSlack
            )
            if not has_eligible:
                unqualified_sessions += group.sessionCount
                for rt in req.referenceTeachers:
                    if (
                        rt.id not in workspace_teacher_ids
                        and course_id in rt.courseIds
                        and rt.id not in missing_teacher_ids
                    ):
                        missing_teacher_ids.append(rt.id)

        workspace_room_ids = {r.id for r in req.rooms}
        has_room_diag = any(
            code in ("NO_COMPATIBLE_ROOM", "ROOM_CAPACITY")
            for code in diagnosis.diagnosticCodes
        )
        missing_room_ids: list[str] = []
        if has_room_diag:
            for rr in req.referenceRooms:
                if rr.id not in workspace_room_ids and rr.id not in missing_room_ids:
                    missing_room_ids.append(rr.id)

        if not (missing_teacher_ids or missing_room_ids):
            return None

        bottleneck = AdvisorBottleneck(
            category="missing_resource",
            title="Recursos del catálogo de referencia excluidos del workspace",
            detail=(
                f"Existen {len(missing_teacher_ids)} docente(s) y {len(missing_room_ids)} ambiente(s) en el catálogo de referencia que cubren cursos pendientes."
            ),
            affectedSessionCount=max(unqualified_sessions, 1),
        )
        recommendation = AdvisorRecommendation(
            id="rec-incorporate-reference-resource",
            title="Incorporar docentes/ambientes habilitados del catálogo de referencia",
            rationale=(
                "Agrega al workspace únicamente los recursos de referencia con habilitación oficial para las asignaturas sin cobertura."
            ),
            impactSummary=f"Incorpora {len(missing_teacher_ids)} docente(s) y {len(missing_room_ids)} ambiente(s)",
            recommendedByDefault=True,
            patch=IncorporateReferenceResourcePatch(
                teacherIds=missing_teacher_ids,
                roomIds=missing_room_ids[:6],
            ),
        )
        return bottleneck, [recommendation]

    def applies(self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis) -> bool:
        return self._evaluate(req, diagnosis) is not None

    def bottleneck(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> AdvisorBottleneck | None:
        result = self._evaluate(req, diagnosis)
        return result[0] if result is not None else None

    def variants(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> list[AdvisorRecommendation]:
        result = self._evaluate(req, diagnosis)
        return result[1] if result is not None else []

    def apply(
        self,
        request_copy: AdvisorAnalyzeRequest,
        patch: IncorporateReferenceResourcePatch,
    ) -> None:
        reference_windows = [
            TimeInterval(day=d, startMinute=480, endMinute=1320) for d in range(1, 6)
        ]
        for teacher in request_copy.referenceTeachers:
            if teacher.id in patch.teacherIds and not any(
                t.id == teacher.id for t in request_copy.teachers
            ):
                request_copy.teachers.append(
                    TeacherInput(
                        id=teacher.id,
                        name=teacher.name,
                        courseIds=teacher.courseIds,
                        maxWeeklyMinutes=600,
                        availability=reference_windows,
                        facultyId="FISI",
                        qualificationSource="synthetic",
                    )
                )
        for room in request_copy.referenceRooms:
            if room.id in patch.roomIds and not any(
                r.id == room.id for r in request_copy.rooms
            ):
                request_copy.rooms.append(
                    RoomInput(**room.model_dump(), availability=reference_windows)
                )


class ChangeDeliveryModeKind:
    kind = "change_delivery_mode"

    def _evaluate(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> tuple[AdvisorBottleneck, list[AdvisorRecommendation]] | None:
        courses_by_id = {c.courseId: c for c in req.courses}
        long_continuous_courses: list[str] = []
        long_course_sessions = 0
        for course_id, group in diagnosis.pendingByCourse.items():
            course = courses_by_id.get(course_id)
            if not course:
                continue
            total_dur = sum(ws.durationMinutes for ws in course.weeklySessions)
            if (
                course.deliveryMode == "continuous"
                and len(course.weeklySessions) > 1
                and total_dur >= 240
            ):
                long_continuous_courses.append(course_id)
                long_course_sessions += group.sessionCount

        if not long_continuous_courses:
            return None

        bottleneck = AdvisorBottleneck(
            category="delivery_mode",
            title=f"{len(long_continuous_courses)} curso(s) con bloques continuos largos (≥ 4 h)",
            detail=(
                "Exigir que teoría, práctica y laboratorio ocurran pegados el mismo día con el mismo docente reduce las combinaciones factibles."
            ),
            affectedSessionCount=long_course_sessions,
        )
        recommendation = AdvisorRecommendation(
            id="rec-change-delivery-mode",
            title=f"Permitir sesiones divididas en {len(long_continuous_courses)} curso(s) de alta duración",
            rationale=(
                "Conserva al mismo docente responsable por sección, pero permite ubicar teoría y práctica/laboratorio en días u horas separadas."
            ),
            impactSummary=f"Flexibiliza {len(long_continuous_courses)} curso(s) ({long_course_sessions} componentes)",
            recommendedByDefault=False,
            patch=ChangeDeliveryModePatch(
                courseIds=sorted(long_continuous_courses),
                deliveryMode="split",
            ),
        )
        return bottleneck, [recommendation]

    def applies(self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis) -> bool:
        return self._evaluate(req, diagnosis) is not None

    def bottleneck(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> AdvisorBottleneck | None:
        result = self._evaluate(req, diagnosis)
        return result[0] if result is not None else None

    def variants(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> list[AdvisorRecommendation]:
        result = self._evaluate(req, diagnosis)
        return result[1] if result is not None else []

    def apply(
        self, request_copy: AdvisorAnalyzeRequest, patch: ChangeDeliveryModePatch
    ) -> None:
        for course in request_copy.courses:
            if course.courseId in patch.courseIds:
                course.deliveryMode = "split"


RECOMMENDATION_CATALOG: tuple[RecommendationKind, ...] = (
    IncreaseTeacherLoadKind(),
    EnablePlanningWindowKind(),
    IncorporateReferenceResourceKind(),
    ChangeDeliveryModeKind(),
)

CATALOG_BY_KIND: dict[str, RecommendationKind] = {
    handler.kind: handler for handler in RECOMMENDATION_CATALOG
}
