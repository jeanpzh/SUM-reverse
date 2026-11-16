"""Ordered catalog of recommendation-kind modules and simulation-based ranker."""
from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any, Callable, Protocol

from advisor_diagnosis import BlockerDiagnosis
from models import (
    AcademicAdvisorPatch,
    AdvisorAnalyzeRequest,
    AdvisorBottleneck,
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

MAX_WEEKLY_MINUTES = 2400
MAX_NARROW_LOAD_VARIANTS = 3
MAX_DELIVERY_COURSE_VARIANTS = 5
MAX_DRY_RUN_SIMULATIONS = 12
MAX_RECOMMENDATIONS = 8
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

        ordered_courses = sorted(
            long_continuous_courses,
            key=lambda cid: (-diagnosis.pendingByCourse[cid].totalMinutes, cid),
        )

        variants: list[AdvisorRecommendation] = []
        for course_id in ordered_courses[:MAX_DELIVERY_COURSE_VARIANTS]:
            course = courses_by_id[course_id]
            course_name = course.name or course_id
            course_sessions = diagnosis.pendingByCourse[course_id].sessionCount
            variants.append(
                AdvisorRecommendation(
                    id=f"rec-change-delivery-mode-{course_id}",
                    title=f"Permitir sesiones divididas solo en {course_name}",
                    rationale=(
                        "Conserva al mismo docente responsable por sección, pero permite ubicar teoría y práctica/laboratorio en días u horas separadas."
                    ),
                    impactSummary=f"Flexibiliza {course_name} ({course_sessions} componentes)",
                    recommendedByDefault=False,
                    patch=ChangeDeliveryModePatch(
                        courseIds=[course_id],
                        deliveryMode="split",
                    ),
                )
            )

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
) -> list[AdvisorRecommendation]:
    if not recommendations:
        return []

    baseline_impact = dry_run(req, recommendations, [])
    baseline_sessions = baseline_impact.projectedScheduledSessions

    broad_recs = [
        rec for rec in recommendations if is_broad_variant(rec, recommendations)
    ]
    narrow_recs = [
        rec for rec in recommendations if not is_broad_variant(rec, recommendations)
    ]
    sim_queue = broad_recs + narrow_recs

    variant_budget = max(0, max_simulations - 1)
    to_simulate = sim_queue[:variant_budget]
    unsimulated_ids = {rec.id for rec in sim_queue[variant_budget:]}
    unsimulated = [rec for rec in recommendations if rec.id in unsimulated_ids]

    unlocked_by_id: dict[str, int] = {}
    for rec in to_simulate:
        impact = dry_run(req, recommendations, [rec.id])
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
