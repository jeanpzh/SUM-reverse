"""Ordered catalog of recommendation-kind modules and simulation-based ranker."""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import date
from typing import Any, Callable, Literal, Protocol

from advisor_diagnosis import BlockerDiagnosis
from models import (
    AcademicAdvisorPatch,
    AdvisorAnalyzeRequest,
    AdvisorBottleneck,
    AdvisorManagementAction,
    AdvisorNormativeContrast,
    AdvisorRecommendation,
    AdvisorVerifiedImpact,
    ChangeDeliveryModePatch,
    EnablePlanningWindowPatch,
    IncorporateReferenceResourcePatch,
    IncreaseTeacherLoadPatch,
    RoomInput,
    TeacherInput,
    TeacherLoadAdjustment,
    TimeInterval,
)
from normative import NormativeCitation, NormativeRequest, NormativeResponse, default_retriever

MAX_WEEKLY_MINUTES = 2400
MAX_NARROW_LOAD_VARIANTS = 3
MAX_DELIVERY_COURSE_VARIANTS = 5
MAX_DRY_RUN_SIMULATIONS = 12
MAX_RECOMMENDATIONS = 8
MAX_MANAGEMENT_ACTIONS = 5
BROAD_RECOMMENDATION_IDS = frozenset(
    {
        "rec-increase-teacher-load-all",
        "rec-enable-planning-window-both",
        "rec-incorporate-reference-resource",
        "rec-change-delivery-mode-all",
    }
)


class RecommendationKind(Protocol):
    kind: str
    normative_topic: Literal["teacher_load", "planning_window", "delivery_mode", "reference_resource"]
    normative_question: str
    # LOCAL design decision (not a verified SUM/UNMSM rule).
    requires_external_authorization: bool
    authorization_note: str | None

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

    def valid_scopes(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> set[str]:
        ...

    def variants_for_scope(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis, scope: str
    ) -> list[AdvisorRecommendation]:
        ...

    def apply(
        self,
        request_copy: AdvisorAnalyzeRequest,
        patch: Any,
        *,
        original_req: AdvisorAnalyzeRequest | None = None,
    ) -> None:
        ...


def _compute_teacher_adjustments_for_courses(
    course_ids: list[str],
    courses_by_id: dict[str, Any],
    teachers_by_id: dict[str, TeacherInput],
    diagnosis: BlockerDiagnosis,
    assigned_minutes_by_teacher: dict[str, int],
) -> tuple[list[TeacherLoadAdjustment], list[str], set[str], int, list[str]]:
    teacher_required_extra: dict[str, int] = defaultdict(int)
    teacher_unlocked_sections: dict[str, set[str]] = defaultdict(set)
    load_affected_sessions = 0
    load_course_names: list[str] = []
    reserved_minutes: dict[str, int] = defaultdict(int)

    for course_id in course_ids:
        group = diagnosis.pendingByCourse.get(course_id)
        course = courses_by_id.get(course_id)
        if not group or not course:
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
        return [], [], set(), load_affected_sessions, load_course_names

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

    return (
        adjustments,
        teacher_labels,
        unlocked_secs,
        load_affected_sessions,
        load_course_names,
    )


class IncreaseTeacherLoadKind:
    kind = "increase_teacher_load"
    normative_topic: Literal["teacher_load", "planning_window", "delivery_mode", "reference_resource"] = "teacher_load"
    normative_question = (
        "¿Cuál es el límite máximo de carga lectiva semanal y qué excepciones requieren autorización?"
    )
    # LOCAL design decision (not a verified SUM/UNMSM rule):
    # increase_teacher_load and enable_planning_window set requiresExternalAuthorization=True;
    # change_delivery_mode and incorporate_reference_resource set requiresExternalAuthorization=False.
    requires_external_authorization = True
    authorization_note = (
        "Escenario sujeto a autorización externa del departamento o facultad; el contraste documental no concede esta excepción."
    )

    def _evaluate(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> tuple[AdvisorBottleneck, list[AdvisorRecommendation]] | None:
        courses_by_id = {c.courseId: c for c in req.courses}
        teachers_by_id = {t.id: t for t in req.teachers}
        assigned_minutes_by_teacher = {
            ts.teacherId: ts.assignedMinutes for ts in diagnosis.teacherSlack
        }

        all_course_ids = sorted(diagnosis.pendingByCourse.keys())
        (
            all_adjustments,
            all_labels,
            all_unlocked_secs,
            load_affected_sessions,
            load_course_names,
        ) = _compute_teacher_adjustments_for_courses(
            all_course_ids,
            courses_by_id,
            teachers_by_id,
            diagnosis,
            assigned_minutes_by_teacher,
        )

        if not all_adjustments:
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

        all_signature = tuple(
            (a.teacherId, a.previousMaxWeeklyMinutes, a.nextMaxWeeklyMinutes)
            for a in all_adjustments
        )

        def _build_rec(
            rec_id: str,
            title: str,
            impact_summary: str,
            adjustments: list[TeacherLoadAdjustment],
            labels: list[str],
        ) -> AdvisorRecommendation:
            sample_teachers = ", ".join(labels[:4])
            more_teachers = (
                f" (+{len(labels) - 4} docentes)" if len(labels) > 4 else ""
            )
            return AdvisorRecommendation(
                id=rec_id,
                title=title,
                rationale=(
                    f"Escenario sintético sujeto a autorización externa; no acredita límite reglamentario ({MAX_WEEKLY_MINUTES} min del simulador) para cubrir las secciones pendientes: {sample_teachers}{more_teachers}."
                ),
                impactSummary=impact_summary,
                recommendedByDefault=False,
                patch=IncreaseTeacherLoadPatch(adjustments=adjustments),
            )

        candidates: list[AdvisorRecommendation] = [
            _build_rec(
                "rec-increase-teacher-load-all",
                f"Ampliar carga máxima semanal de {len(all_adjustments)} docente(s) habilitados",
                f"Destraba hasta {len(all_unlocked_secs)} sección(es) en {len(load_course_names)} curso(s)",
                all_adjustments,
                all_labels,
            )
        ]

        ordered_courses = sorted(
            diagnosis.pendingByCourse.items(),
            key=lambda item: (-item[1].totalMinutes, item[0]),
        )
        narrow_count = 0
        for course_id, group in ordered_courses:
            if narrow_count >= MAX_NARROW_LOAD_VARIANTS:
                break
            (
                c_adjustments,
                c_labels,
                c_unlocked_secs,
                _,
                c_names,
            ) = _compute_teacher_adjustments_for_courses(
                [course_id],
                courses_by_id,
                teachers_by_id,
                diagnosis,
                assigned_minutes_by_teacher,
            )
            if not c_adjustments:
                continue
            c_signature = tuple(
                (a.teacherId, a.previousMaxWeeklyMinutes, a.nextMaxWeeklyMinutes)
                for a in c_adjustments
            )
            if c_signature == all_signature:
                continue
            course_label = c_names[0] if c_names else course_id
            candidates.append(
                _build_rec(
                    f"rec-increase-teacher-load-{course_id}",
                    f"Ampliar carga docente solo para {course_label} ({len(c_adjustments)} docente(s))",
                    f"Destraba hasta {len(c_unlocked_secs)} sección(es) en {course_label}",
                    c_adjustments,
                    c_labels,
                )
            )
            narrow_count += 1

        teacher_variant_counts: Counter[str] = Counter()
        for rec in candidates:
            for adj in rec.patch.adjustments:  # type: ignore[union-attr]
                teacher_variant_counts[adj.teacherId] += 1

        for rec in candidates:
            if any(
                teacher_variant_counts[adj.teacherId] > 1
                for adj in rec.patch.adjustments  # type: ignore[union-attr]
            ):
                rec.rationale = (
                    f"{rec.rationale} Alternativa excluyente frente a otras variantes que ajustan al mismo docente."
                )

        return bottleneck, candidates

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

    def valid_scopes(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> set[str]:
        courses_by_id = {c.courseId for c in req.courses}
        pending_courses = set(diagnosis.pendingByCourse.keys()) & courses_by_id
        if not pending_courses:
            return set()
        return pending_courses | {"all"}

    def variants_for_scope(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis, scope: str
    ) -> list[AdvisorRecommendation]:
        if scope not in self.valid_scopes(req, diagnosis):
            raise ValueError(f"Invalid scope '{scope}' for {self.kind}")
        courses_by_id = {c.courseId: c for c in req.courses}
        teachers_by_id = {t.id: t for t in req.teachers}
        assigned_minutes_by_teacher = {
            ts.teacherId: ts.assignedMinutes for ts in diagnosis.teacherSlack
        }
        target_courses = (
            sorted(diagnosis.pendingByCourse.keys()) if scope == "all" else [scope]
        )
        adjustments, labels, unlocked_secs, _, course_names = (
            _compute_teacher_adjustments_for_courses(
                target_courses,
                courses_by_id,
                teachers_by_id,
                diagnosis,
                assigned_minutes_by_teacher,
            )
        )
        if not adjustments:
            return []
        sample_teachers = ", ".join(labels[:4])
        more_teachers = (
            f" (+{len(labels) - 4} docentes)" if len(labels) > 4 else ""
        )
        rationale = (
            f"Escenario sintético sujeto a autorización externa; no acredita límite reglamentario ({MAX_WEEKLY_MINUTES} min del simulador) para cubrir las secciones pendientes: {sample_teachers}{more_teachers}."
        )
        adjusted_ids = {adj.teacherId for adj in adjustments}
        if any(
            len(set(ts.eligibleCourseIds) & set(diagnosis.pendingByCourse.keys())) > 1
            for ts in diagnosis.teacherSlack
            if ts.teacherId in adjusted_ids
        ):
            rationale = (
                f"{rationale} Alternativa excluyente frente a otras variantes que ajustan al mismo docente."
            )
        if scope == "all":
            return [
                AdvisorRecommendation(
                    id="rec-increase-teacher-load-all",
                    title=f"Ampliar carga máxima semanal de {len(adjustments)} docente(s) habilitados",
                    rationale=rationale,
                    impactSummary=f"Destraba hasta {len(unlocked_secs)} sección(es) en {len(course_names)} curso(s)",
                    recommendedByDefault=False,
                    patch=IncreaseTeacherLoadPatch(adjustments=adjustments),
                )
            ]
        course_label = course_names[0] if course_names else scope
        return [
            AdvisorRecommendation(
                id=f"rec-increase-teacher-load-{scope}",
                title=f"Ampliar carga docente solo para {course_label} ({len(adjustments)} docente(s))",
                rationale=rationale,
                impactSummary=f"Destraba hasta {len(unlocked_secs)} sección(es) en {course_label}",
                recommendedByDefault=False,
                patch=IncreaseTeacherLoadPatch(adjustments=adjustments),
            )
        ]

    def apply(
        self,
        request_copy: AdvisorAnalyzeRequest,
        patch: IncreaseTeacherLoadPatch,
        *,
        original_req: AdvisorAnalyzeRequest | None = None,
    ) -> None:
        ref_teachers = (
            original_req.teachers
            if original_req is not None
            else request_copy.teachers
        )
        orig_by_id = {t.id: t for t in ref_teachers}
        for adjustment in patch.adjustments:
            orig_teacher = orig_by_id.get(adjustment.teacherId)
            if orig_teacher is None:
                orig_teacher = next(
                    t for t in request_copy.teachers if t.id == adjustment.teacherId
                )
            if orig_teacher.maxWeeklyMinutes != adjustment.previousMaxWeeklyMinutes:
                raise ValueError("Stale teacher load")
            teacher = next(
                t for t in request_copy.teachers if t.id == adjustment.teacherId
            )
            teacher.maxWeeklyMinutes = max(
                teacher.maxWeeklyMinutes, adjustment.nextMaxWeeklyMinutes
            )


class EnablePlanningWindowKind:
    kind = "enable_planning_window"
    normative_topic: Literal["teacher_load", "planning_window", "delivery_mode", "reference_resource"] = "planning_window"
    normative_question = (
        "¿Qué normas regulan la coordinación de horarios, franjas y turnos de la actividad lectiva?"
    )
    # LOCAL design decision (not a verified SUM/UNMSM rule).
    requires_external_authorization = True
    authorization_note = (
        "Requiere autorización externa o acuerdo académico para habilitar excepciones de franja horaria; la consulta documental no concede autorización."
    )

    def _evaluate(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> tuple[AdvisorBottleneck, list[AdvisorRecommendation]] | None:
        if not req.planningPolicy or (
            req.planningPolicy.allowAfternoon and req.planningPolicy.allowSaturday
        ):
            return None
        if diagnosis.totalPendingCount == 0:
            return None

        senior_pending_count = sum(
            group.sessionCount
            for cycle, group in diagnosis.pendingByCycle.items()
            if (cycle or 0) >= 7
        )
        weekday_saturated = (
            diagnosis.weekdayAvailableMinutes > 0
            and diagnosis.weekdayUsedMinutes * 4 >= diagnosis.weekdayAvailableMinutes * 3
        )
        need_afternoon_legacy = (
            not req.planningPolicy.allowAfternoon and senior_pending_count > 0
        )
        need_saturday_legacy = (
            not req.planningPolicy.allowSaturday and diagnosis.totalPendingCount > 6
        )

        emit_afternoon = not req.planningPolicy.allowAfternoon and (
            senior_pending_count > 0 or diagnosis.potentialAfternoonFreeMinutes > 0
        )
        emit_saturday = not req.planningPolicy.allowSaturday and (
            diagnosis.totalPendingCount > 6 or weekday_saturated
        )
        both_closed = (
            not req.planningPolicy.allowAfternoon and not req.planningPolicy.allowSaturday
        )
        emit_both = both_closed and (need_afternoon_legacy or need_saturday_legacy)

        if not (emit_afternoon or emit_saturday or emit_both):
            return None

        win_sessions = (
            senior_pending_count
            if need_afternoon_legacy
            else diagnosis.totalPendingCount
        )
        bottleneck = AdvisorBottleneck(
            category="planning_window",
            title="Restricción de franja horaria en ciclos superiores / semana",
            detail=(
                f"Los cursos de ciclo VII–X están restringidos a 18:00–22:00 ({senior_pending_count} componentes pendientes) y el sábado permanece cerrado."
            ),
            affectedSessionCount=win_sessions,
        )

        variants: list[AdvisorRecommendation] = []
        pending_sec_count = len(diagnosis.pendingSectionIds)

        if emit_afternoon:
            variants.append(
                AdvisorRecommendation(
                    id="rec-enable-planning-window-afternoon",
                    title="Habilitar excepción solo de turno tarde (14:00–22:00)",
                    rationale=(
                        "Alternativa de franja horaria: permite ubicar secciones de ciclos VII–X desde las 14:00 manteniendo el sábado cerrado."
                    ),
                    impactSummary=f"Amplía turno tarde para {pending_sec_count} sección(es) pendientes",
                    recommendedByDefault=not emit_both,
                    patch=EnablePlanningWindowPatch(allowAfternoon=True),
                )
            )
        if emit_saturday:
            variants.append(
                AdvisorRecommendation(
                    id="rec-enable-planning-window-saturday",
                    title="Habilitar excepción solo de sábado (08:00–13:00)",
                    rationale=(
                        "Alternativa de franja horaria: abre la mañana del sábado para absorber colisiones de cohorte y aula sin abrir turno tarde."
                    ),
                    impactSummary=f"Amplía mañana del sábado para {pending_sec_count} sección(es) pendientes",
                    recommendedByDefault=not emit_both and not emit_afternoon,
                    patch=EnablePlanningWindowPatch(allowSaturday=True),
                )
            )
        if emit_both:
            variants.append(
                AdvisorRecommendation(
                    id="rec-enable-planning-window-both",
                    title="Habilitar excepción de turno tarde (14:00–22:00) y sábado (08:00–13:00)",
                    rationale=(
                        "Permite ubicar secciones de ciclos VII–X desde las 14:00 y abre la mañana del sábado para absorber colisiones de cohorte y aula."
                    ),
                    impactSummary=f"Amplía ventanas para {pending_sec_count} sección(es) pendientes",
                    recommendedByDefault=True,
                    patch=EnablePlanningWindowPatch(
                        allowAfternoon=True, allowSaturday=True
                    ),
                )
            )

        if len(variants) > 1:
            for rec in variants:
                rec.rationale = (
                    f"{rec.rationale} Alternativa excluyente entre variantes de franja horaria."
                )

        return bottleneck, variants

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

    def valid_scopes(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> set[str]:
        return {"afternoon", "saturday", "both"}

    def variants_for_scope(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis, scope: str
    ) -> list[AdvisorRecommendation]:
        if scope not in self.valid_scopes(req, diagnosis):
            raise ValueError(f"Invalid scope '{scope}' for {self.kind}")
        if not req.planningPolicy or diagnosis.totalPendingCount == 0:
            return []
        pending_sec_count = len(diagnosis.pendingSectionIds)
        if scope == "afternoon":
            if req.planningPolicy.allowAfternoon:
                return []
            return [
                AdvisorRecommendation(
                    id="rec-enable-planning-window-afternoon",
                    title="Habilitar excepción solo de turno tarde (14:00–22:00)",
                    rationale=(
                        "Alternativa de franja horaria: permite ubicar secciones de ciclos VII–X desde las 14:00 manteniendo el sábado cerrado. Alternativa excluyente entre variantes de franja horaria."
                    ),
                    impactSummary=f"Amplía turno tarde para {pending_sec_count} sección(es) pendientes",
                    recommendedByDefault=False,
                    patch=EnablePlanningWindowPatch(allowAfternoon=True),
                )
            ]
        if scope == "saturday":
            if req.planningPolicy.allowSaturday:
                return []
            return [
                AdvisorRecommendation(
                    id="rec-enable-planning-window-saturday",
                    title="Habilitar excepción solo de sábado (08:00–13:00)",
                    rationale=(
                        "Alternativa de franja horaria: abre la mañana del sábado para absorber colisiones de cohorte y aula sin abrir turno tarde. Alternativa excluyente entre variantes de franja horaria."
                    ),
                    impactSummary=f"Amplía mañana del sábado para {pending_sec_count} sección(es) pendientes",
                    recommendedByDefault=False,
                    patch=EnablePlanningWindowPatch(allowSaturday=True),
                )
            ]
        if req.planningPolicy.allowAfternoon or req.planningPolicy.allowSaturday:
            return []
        return [
            AdvisorRecommendation(
                id="rec-enable-planning-window-both",
                title="Habilitar excepción de turno tarde (14:00–22:00) y sábado (08:00–13:00)",
                rationale=(
                    "Permite ubicar secciones de ciclos VII–X desde las 14:00 y abre la mañana del sábado para absorber colisiones de cohorte y aula. Alternativa excluyente entre variantes de franja horaria."
                ),
                impactSummary=f"Amplía ventanas para {pending_sec_count} sección(es) pendientes",
                recommendedByDefault=True,
                patch=EnablePlanningWindowPatch(
                    allowAfternoon=True, allowSaturday=True
                ),
            )
        ]

    def apply(
        self,
        request_copy: AdvisorAnalyzeRequest,
        patch: EnablePlanningWindowPatch,
        *,
        original_req: AdvisorAnalyzeRequest | None = None,
    ) -> None:
        if request_copy.planningPolicy:
            if patch.allowAfternoon:
                request_copy.planningPolicy.allowAfternoon = True
            if patch.allowSaturday:
                request_copy.planningPolicy.allowSaturday = True


class IncorporateReferenceResourceKind:
    kind = "incorporate_reference_resource"
    normative_topic: Literal["teacher_load", "planning_window", "delivery_mode", "reference_resource"] = "reference_resource"
    normative_question = (
        "¿Qué requisitos normativos aplican al registro y habilitación de docentes y recursos en el departamento académico?"
    )
    # LOCAL design decision (not a verified SUM/UNMSM rule).
    requires_external_authorization = False
    authorization_note = None

    def _find_missing_resources(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> tuple[list[str], list[str], int]:
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

        return missing_teacher_ids, missing_room_ids, unqualified_sessions

    def _evaluate(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> tuple[AdvisorBottleneck, list[AdvisorRecommendation]] | None:
        missing_teacher_ids, missing_room_ids, unqualified_sessions = (
            self._find_missing_resources(req, diagnosis)
        )

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

    def valid_scopes(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> set[str]:
        return {"all", "teachers", "rooms"}

    def variants_for_scope(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis, scope: str
    ) -> list[AdvisorRecommendation]:
        if scope not in self.valid_scopes(req, diagnosis):
            raise ValueError(f"Invalid scope '{scope}' for {self.kind}")
        missing_teacher_ids, missing_room_ids, _ = self._find_missing_resources(
            req, diagnosis
        )
        if scope == "teachers":
            if not missing_teacher_ids:
                return []
            return [
                AdvisorRecommendation(
                    id="rec-incorporate-reference-resource-teachers",
                    title="Incorporar solo docentes habilitados del catálogo de referencia",
                    rationale=(
                        "Agrega al workspace únicamente docentes de referencia con habilitación oficial para asignaturas sin cobertura."
                    ),
                    impactSummary=f"Incorpora {len(missing_teacher_ids)} docente(s)",
                    recommendedByDefault=False,
                    patch=IncorporateReferenceResourcePatch(
                        teacherIds=missing_teacher_ids,
                        roomIds=[],
                    ),
                )
            ]
        if scope == "rooms":
            if not missing_room_ids:
                return []
            return [
                AdvisorRecommendation(
                    id="rec-incorporate-reference-resource-rooms",
                    title="Incorporar solo ambientes del catálogo de referencia",
                    rationale=(
                        "Agrega al workspace ambientes de referencia compatibles para cubrir el déficit de capacidad o tipo de aula."
                    ),
                    impactSummary=f"Incorpora {len(missing_room_ids[:6])} ambiente(s)",
                    recommendedByDefault=False,
                    patch=IncorporateReferenceResourcePatch(
                        teacherIds=[],
                        roomIds=missing_room_ids[:6],
                    ),
                )
            ]
        return self.variants(req, diagnosis)

    def apply(
        self,
        request_copy: AdvisorAnalyzeRequest,
        patch: IncorporateReferenceResourcePatch,
        *,
        original_req: AdvisorAnalyzeRequest | None = None,
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
    normative_topic: Literal["teacher_load", "planning_window", "delivery_mode", "reference_resource"] = "delivery_mode"
    normative_question = (
        "¿Cómo se asigna la actividad lectiva según la naturaleza de la asignatura, teoría, práctica y laboratorio?"
    )
    # LOCAL design decision (not a verified SUM/UNMSM rule).
    requires_external_authorization = False
    authorization_note = None

    def _is_long_continuous(self, course: Any) -> bool:
        total_dur = sum(ws.durationMinutes for ws in course.weeklySessions)
        return (
            course.deliveryMode == "continuous"
            and len(course.weeklySessions) > 1
            and total_dur >= 240
        )

    def _build_course_variant(
        self, course: Any, session_count: int
    ) -> AdvisorRecommendation:
        course_name = course.name or course.courseId
        return AdvisorRecommendation(
            id=f"rec-change-delivery-mode-{course.courseId}",
            title=f"Permitir sesiones divididas solo en {course_name}",
            rationale=(
                "Conserva al mismo docente responsable por sección, pero permite ubicar teoría y práctica/laboratorio en días u horas separadas."
            ),
            impactSummary=f"Flexibiliza {course_name} ({session_count} componentes)",
            recommendedByDefault=False,
            patch=ChangeDeliveryModePatch(
                courseIds=[course.courseId],
                deliveryMode="split",
            ),
        )

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
            if self._is_long_continuous(course):
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

        ordered_courses = sorted(
            long_continuous_courses,
            key=lambda cid: (-diagnosis.pendingByCourse[cid].totalMinutes, cid),
        )

        variants: list[AdvisorRecommendation] = [
            self._build_course_variant(
                courses_by_id[course_id],
                diagnosis.pendingByCourse[course_id].sessionCount,
            )
            for course_id in ordered_courses[:MAX_DELIVERY_COURSE_VARIANTS]
        ]

        if len(long_continuous_courses) > 1:
            variants.append(
                AdvisorRecommendation(
                    id="rec-change-delivery-mode-all",
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
            )

        return bottleneck, variants

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

    def valid_scopes(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis
    ) -> set[str]:
        courses_by_id = {c.courseId for c in req.courses}
        pending_courses = set(diagnosis.pendingByCourse.keys()) & courses_by_id
        if not pending_courses:
            return set()
        return pending_courses | {"all"}

    def variants_for_scope(
        self, req: AdvisorAnalyzeRequest, diagnosis: BlockerDiagnosis, scope: str
    ) -> list[AdvisorRecommendation]:
        if scope not in self.valid_scopes(req, diagnosis):
            raise ValueError(f"Invalid scope '{scope}' for {self.kind}")
        courses_by_id = {c.courseId: c for c in req.courses}
        if scope == "all":
            long_courses = sorted(
                cid
                for cid in diagnosis.pendingByCourse
                if cid in courses_by_id and self._is_long_continuous(courses_by_id[cid])
            )
            if not long_courses:
                return []
            if len(long_courses) == 1:
                cid = long_courses[0]
                return [
                    self._build_course_variant(
                        courses_by_id[cid],
                        diagnosis.pendingByCourse[cid].sessionCount,
                    )
                ]
            long_sessions = sum(
                diagnosis.pendingByCourse[cid].sessionCount for cid in long_courses
            )
            return [
                AdvisorRecommendation(
                    id="rec-change-delivery-mode-all",
                    title=f"Permitir sesiones divididas en {len(long_courses)} curso(s) de alta duración",
                    rationale=(
                        "Conserva al mismo docente responsable por sección, pero permite ubicar teoría y práctica/laboratorio en días u horas separadas."
                    ),
                    impactSummary=f"Flexibiliza {len(long_courses)} curso(s) ({long_sessions} componentes)",
                    recommendedByDefault=False,
                    patch=ChangeDeliveryModePatch(
                        courseIds=long_courses,
                        deliveryMode="split",
                    ),
                )
            ]
        course = courses_by_id[scope]
        if not self._is_long_continuous(course):
            return []
        return [
            self._build_course_variant(
                course, diagnosis.pendingByCourse[scope].sessionCount
            )
        ]

    def apply(
        self,
        request_copy: AdvisorAnalyzeRequest,
        patch: ChangeDeliveryModePatch,
        *,
        original_req: AdvisorAnalyzeRequest | None = None,
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


def request_variants_for_scope(
    req: AdvisorAnalyzeRequest,
    diagnosis: BlockerDiagnosis,
    kind: str,
    scope: str,
) -> list[AdvisorRecommendation]:
    handler = CATALOG_BY_KIND.get(kind)
    if handler is None:
        raise ValueError(f"Unknown recommendation kind: {kind}")
    return handler.variants_for_scope(req, diagnosis, scope)


def patch_change_size(patch: AcademicAdvisorPatch) -> int:
    if patch.kind == "increase_teacher_load":
        return len(patch.adjustments)
    if patch.kind == "enable_planning_window":
        return (1 if patch.allowAfternoon else 0) + (1 if patch.allowSaturday else 0)
    if patch.kind == "incorporate_reference_resource":
        return len(patch.teacherIds) + len(patch.roomIds)
    if patch.kind == "change_delivery_mode":
        return len(patch.courseIds)
    return 0


def is_broad_variant(
    rec: AdvisorRecommendation, recommendations: list[AdvisorRecommendation]
) -> bool:
    if rec.id in BROAD_RECOMMENDATION_IDS:
        return True
    return sum(1 for item in recommendations if item.patch.kind == rec.patch.kind) == 1


DryRunFn = Callable[
    [AdvisorAnalyzeRequest, list[AdvisorRecommendation], list[str]],
    AdvisorVerifiedImpact,
]


def rank_recommendations(
    req: AdvisorAnalyzeRequest,
    recommendations: list[AdvisorRecommendation],
    dry_run: DryRunFn,
    *,
    max_simulations: int = MAX_DRY_RUN_SIMULATIONS,
    max_recommendations: int = MAX_RECOMMENDATIONS,
    premeasured_impacts: dict[str, AdvisorVerifiedImpact] | None = None,
    baseline_impact: AdvisorVerifiedImpact | None = None,
) -> list[AdvisorRecommendation]:
    if not recommendations:
        return []

    baseline = (
        baseline_impact
        if baseline_impact is not None
        else dry_run(req, recommendations, [])
    )
    baseline_sessions = baseline.projectedScheduledSessions

    broad_recs = [
        rec for rec in recommendations if is_broad_variant(rec, recommendations)
    ]
    narrow_recs = [
        rec for rec in recommendations if not is_broad_variant(rec, recommendations)
    ]
    sim_queue = broad_recs + narrow_recs

    variant_budget = max(0, max_simulations - 1)
    if premeasured_impacts is not None:
        premeasured_recs = [
            rec for rec in sim_queue if rec.id in premeasured_impacts
        ]
        unmeasured_queue = [
            rec for rec in sim_queue if rec.id not in premeasured_impacts
        ]
        remaining_budget = max(0, variant_budget - len(premeasured_recs))
        to_simulate = premeasured_recs + unmeasured_queue[:remaining_budget]
        unsimulated_ids = {rec.id for rec in unmeasured_queue[remaining_budget:]}
    else:
        to_simulate = sim_queue[:variant_budget]
        unsimulated_ids = {rec.id for rec in sim_queue[variant_budget:]}
    unsimulated = [rec for rec in recommendations if rec.id in unsimulated_ids]

    unlocked_by_id: dict[str, int] = {}
    for rec in to_simulate:
        impact = (
            premeasured_impacts[rec.id]
            if (premeasured_impacts is not None and rec.id in premeasured_impacts)
            else dry_run(req, recommendations, [rec.id])
        )
        unlocked = max(0, impact.projectedScheduledSessions - baseline_sessions)
        unlocked_by_id[rec.id] = unlocked
        if unlocked > 0:
            unit = "componente" if unlocked == 1 else "componentes"
            rec.impactSummary = f"Destraba {unlocked} {unit} en simulación"
        else:
            rec.impactSummary = "No destrabó componentes en simulación"

    for rec in unsimulated:
        if "impacto no simulado" not in rec.impactSummary:
            rec.impactSummary = f"{rec.impactSummary} (impacto no simulado)"

    kept_simulated = [
        rec
        for rec in to_simulate
        if is_broad_variant(rec, recommendations) or unlocked_by_id[rec.id] > 0
    ]

    ranked_simulated = sorted(
        kept_simulated,
        key=lambda rec: (
            -unlocked_by_id[rec.id],
            patch_change_size(rec.patch),
            rec.id,
        ),
    )

    combined = ranked_simulated + unsimulated

    window_recs = [
        rec for rec in combined if rec.patch.kind == "enable_planning_window"
    ]
    if window_recs:
        simulated_windows = [
            rec
            for rec in ranked_simulated
            if rec.patch.kind == "enable_planning_window"
        ]
        if simulated_windows:
            best_unlocked = max(unlocked_by_id[rec.id] for rec in simulated_windows)
            tied_best = [
                rec
                for rec in simulated_windows
                if unlocked_by_id[rec.id] == best_unlocked
            ]
            combined_win = next(
                (
                    rec
                    for rec in tied_best
                    if rec.id == "rec-enable-planning-window-both"
                ),
                None,
            )
            winner = (
                combined_win
                if (len(tied_best) > 1 and combined_win is not None)
                else tied_best[0]
            )
        else:
            winner = next(
                (
                    rec
                    for rec in window_recs
                    if rec.id == "rec-enable-planning-window-both"
                ),
                window_recs[0],
            )
        for rec in window_recs:
            rec.recommendedByDefault = rec.id == winner.id

    return combined[:max_recommendations]


def infer_normative_teacher_type(
    req: AdvisorAnalyzeRequest,
) -> Literal["ordinario", "unknown"]:
    if req.teachers and all(
        t.category in ("principal", "asociado", "auxiliar") for t in req.teachers
    ):
        return "ordinario"
    return "unknown"


def _bounded_normative_gaps(gaps: list[str], *, limit: int = 4) -> list[str]:
    deduped = list(dict.fromkeys(gaps))
    if len(deduped) <= limit:
        return deduped
    # Keep corpus/regime/vigencia gaps ahead of lexical-only infrastructure notices when truncating.
    prioritized = [g for g in deduped if not g.startswith("Repositorio vectorial ")]
    infra = [g for g in deduped if g.startswith("Repositorio vectorial ")]
    return (prioritized + infra)[:limit]


def query_kind_normative_contrast(
    req: AdvisorAnalyzeRequest,
    kind: str,
    *,
    cache: dict[str, AdvisorNormativeContrast] | None = None,
    retriever: Any | None = None,
) -> AdvisorNormativeContrast:
    if cache is not None and kind in cache:
        return cache[kind]
    handler = CATALOG_BY_KIND.get(kind)
    if handler is None:
        raise ValueError(f"Unknown recommendation kind: {kind}")

    active_retriever = retriever if retriever is not None else default_retriever()
    period = req.planningPolicy.period if req.planningPolicy else f"{date.today().year}-II"
    teacher_type = infer_normative_teacher_type(req)
    response: NormativeResponse = active_retriever.query(
        NormativeRequest(
            question=handler.normative_question,
            facultyId="FISI",
            academicPeriod=period,
            asOf=date.today().isoformat(),
            teacherType=teacher_type,
        )
    )
    gaps = list(response.gaps)
    if not req.planningPolicy:
        gaps.insert(
            0,
            "Periodo de contexto local inferido del año actual; no confirma periodo académico.",
        )
    contrast = AdvisorNormativeContrast(
        topic=handler.normative_topic,
        status=response.status,
        citations=response.citations[:3],
        gaps=_bounded_normative_gaps(gaps, limit=4),
        requiresExternalAuthorization=handler.requires_external_authorization,
        authorizationNote=(
            handler.authorization_note if handler.requires_external_authorization else None
        ),
    )
    if cache is not None:
        cache[kind] = contrast
    return contrast


def attach_normative_contrasts(
    req: AdvisorAnalyzeRequest,
    recommendations: list[AdvisorRecommendation],
    *,
    cache: dict[str, AdvisorNormativeContrast] | None = None,
    retriever: Any | None = None,
) -> dict[str, AdvisorNormativeContrast]:
    normative_cache = cache if cache is not None else {}
    for rec in recommendations:
        contrast = query_kind_normative_contrast(
            req,
            rec.patch.kind,
            cache=normative_cache,
            retriever=retriever,
        )
        rec.normativeContrast = contrast.model_copy(deep=True)
    return normative_cache


def build_management_actions(
    req: AdvisorAnalyzeRequest,
    diagnosis: BlockerDiagnosis,
    *,
    contrast_cache: dict[str, AdvisorNormativeContrast] | None = None,
    retriever: Any | None = None,
) -> list[AdvisorManagementAction]:
    if diagnosis.totalPendingCount == 0 and not diagnosis.diagnosticCodes:
        return []

    cache = contrast_cache if contrast_cache is not None else {}
    courses_by_id = {c.courseId: c for c in req.courses}
    teachers_by_id = {t.id: t for t in req.teachers}
    req_by_id = {r.id: r for r in req.requirements}
    pending_course_ids = set(diagnosis.pendingByCourse.keys())

    def _citations_for(kind: str) -> list[NormativeCitation]:
        contrast = query_kind_normative_contrast(
            req, kind, cache=cache, retriever=retriever
        )
        return [c.model_copy(deep=True) for c in contrast.citations[:2]]

    actions: list[AdvisorManagementAction] = []

    # 1. Teachers at top of load / slack deficit with pending -> process_load_authorization / negotiate_teacher_availability
    eligible_course_ids_with_teachers: set[str] = set()
    for ts in diagnosis.teacherSlack:
        eligible_course_ids_with_teachers.update(
            cid for cid in ts.eligibleCourseIds if cid in pending_course_ids
        )

    at_top_teachers = [
        ts
        for ts in diagnosis.teacherSlack
        if ts.slackMinutes <= 0 and (set(ts.eligibleCourseIds) & pending_course_ids)
    ]
    load_deficit_courses = [
        cid
        for cid in sorted(pending_course_ids)
        if cid in eligible_course_ids_with_teachers
        and sum(
            max(0, ts.slackMinutes)
            for ts in diagnosis.teacherSlack
            if cid in ts.eligibleCourseIds
        )
        < diagnosis.pendingByCourse[cid].totalMinutes
    ]

    if load_deficit_courses or at_top_teachers:
        affected_courses = set(load_deficit_courses)
        for ts in at_top_teachers:
            affected_courses.update(set(ts.eligibleCourseIds) & pending_course_ids)
        load_sessions = sum(
            diagnosis.pendingByCourse[cid].sessionCount for cid in affected_courses
        )
        course_labels = [
            courses_by_id[cid].name or cid
            if cid in courses_by_id
            else cid
            for cid in sorted(affected_courses)[:3]
        ]
        more_label = (
            f" y {len(affected_courses) - 3} más"
            if len(affected_courses) > 3
            else ""
        )
        actions.append(
            AdvisorManagementAction(
                id="mgmt-process-load-authorization",
                kind="process_load_authorization",
                title="Gestionar autorización externa de carga lectiva",
                detail=(
                    f"{load_sessions} componente(s) pendiente(s) en {', '.join(course_labels)}{more_label} "
                    "exceden el saldo semanal actual de los docentes habilitados. "
                    "Cualquier ampliación de tope requiere trámite administrativo externo fuera del motor."
                ),
                relatedCategory="teacher_load",
                affectedSessionCount=load_sessions,
                citations=_citations_for("increase_teacher_load"),
                executable=False,
            )
        )

    restricted_availability = any(
        len({iv.day for iv in teachers_by_id[ts.teacherId].availability}) < 5
        for ts in diagnosis.teacherSlack
        if ts.teacherId in teachers_by_id and (set(ts.eligibleCourseIds) & pending_course_ids)
    )
    slack_positive_pending = any(
        ts.slackMinutes > 0 and (set(ts.eligibleCourseIds) & pending_course_ids)
        for ts in diagnosis.teacherSlack
    )
    if eligible_course_ids_with_teachers and (
        at_top_teachers or load_deficit_courses or slack_positive_pending or restricted_availability
    ):
        avail_sessions = sum(
            diagnosis.pendingByCourse[cid].sessionCount
            for cid in eligible_course_ids_with_teachers
        )
        actions.append(
            AdvisorManagementAction(
                id="mgmt-negotiate-teacher-availability",
                kind="negotiate_teacher_availability",
                title="Coordinar disponibilidad horaria o reasignación docente",
                detail=(
                    f"{avail_sessions} componente(s) pendiente(s) en {len(eligible_course_ids_with_teachers)} curso(s) "
                    "dependen de disponibilidad semanal o redistribución entre docentes habilitados antes de regenerar el horario."
                ),
                relatedCategory="teacher_load",
                affectedSessionCount=avail_sessions,
                citations=_citations_for("increase_teacher_load"),
                executable=False,
            )
        )

    # 2. Laboratory saturation or NO_COMPATIBLE_ROOM / ROOM_CAPACITY -> request_external_room / review_room_requirement
    lab_cells = [
        cell
        for cell in diagnosis.occupancy
        if cell.roomKind == "laboratory" and cell.availableMinutes > 0
    ]
    total_lab_avail = sum(cell.availableMinutes for cell in lab_cells)
    total_lab_used = sum(cell.usedMinutes for cell in lab_cells)
    lab_saturated = any(
        cell.usedMinutes * 4 >= cell.availableMinutes * 3 for cell in lab_cells
    ) or (total_lab_avail > 0 and total_lab_used * 4 >= total_lab_avail * 3)
    room_diag_sessions = {
        sid
        for sid, codes in diagnosis.causesBySession.items()
        if any(code in ("NO_COMPATIBLE_ROOM", "ROOM_CAPACITY") for code in codes)
    }
    has_room_diag = any(
        code in ("NO_COMPATIBLE_ROOM", "ROOM_CAPACITY")
        for code in diagnosis.diagnosticCodes
    )
    pending_lab_sessions = {
        item.sessionId
        for item in req.pending
        if (req_by_id.get(item.sessionId) and req_by_id[item.sessionId].type == "L")
    }
    if (lab_saturated and diagnosis.totalPendingCount > 0) or has_room_diag:
        room_affected = (
            len(room_diag_sessions | pending_lab_sessions) or diagnosis.totalPendingCount
        )
        actions.append(
            AdvisorManagementAction(
                id="mgmt-request-external-room",
                kind="request_external_room",
                title="Solicitar ambientes o laboratorios externos en préstamo",
                detail=(
                    f"Se detectan restricciones de compatibilidad, aforo o saturación de laboratorio que afectan a "
                    f"{room_affected} componente(s). Gestionar asignación temporal de ambientes fuera del catálogo actual."
                ),
                relatedCategory="missing_resource",
                affectedSessionCount=room_affected,
                citations=_citations_for("incorporate_reference_resource"),
                executable=False,
            )
        )
        actions.append(
            AdvisorManagementAction(
                id="mgmt-review-room-requirement",
                kind="review_room_requirement",
                title="Revisar requerimiento de tipo de ambiente y capacidad por sección",
                detail=(
                    f"Evaluar con coordinación académica si {room_affected} componente(s) requieren laboratorio exclusivo "
                    "o pueden ajustar aforo y modalidad de ambiente antes de reintentar."
                ),
                relatedCategory="missing_resource",
                affectedSessionCount=room_affected,
                citations=_citations_for("incorporate_reference_resource"),
                executable=False,
            )
        )

    # 3. Large pending in one course -> review_section_demand
    large_pending_courses = sorted(
        (
            (cid, group)
            for cid, group in diagnosis.pendingByCourse.items()
            if group.sessionCount >= 3
            or group.totalMinutes >= 360
            or len(group.sectionIds) >= 2
        ),
        key=lambda item: (-item[1].sessionCount, -item[1].totalMinutes, item[0]),
    )
    if large_pending_courses:
        top_cid, top_group = large_pending_courses[0]
        top_name = (
            courses_by_id[top_cid].name or top_cid
            if top_cid in courses_by_id
            else top_cid
        )
        actions.append(
            AdvisorManagementAction(
                id="mgmt-review-section-demand",
                kind="review_section_demand",
                title=f"Revisar demanda y partición de secciones en {top_name}",
                detail=(
                    f"{top_name} concentra {top_group.sessionCount} componente(s) pendiente(s) "
                    f"({top_group.totalMinutes} min en {len(top_group.sectionIds)} sección(es)). "
                    "Evaluar desdoblamiento, fusión de secciones o ajuste de demanda en Preparación."
                ),
                relatedCategory="other",
                affectedSessionCount=top_group.sessionCount,
                citations=_citations_for("change_delivery_mode"),
                executable=False,
            )
        )

    actions.sort(key=lambda action: (-action.affectedSessionCount, action.id))
    return actions[:MAX_MANAGEMENT_ACTIONS]
