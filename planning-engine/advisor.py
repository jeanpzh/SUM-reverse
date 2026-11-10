from __future__ import annotations

import json
import re
from collections import defaultdict

from models import (
    AcademicAdvisorResponse,
    AdvisorAnalyzeRequest,
    AdvisorBottleneck,
    AdvisorRecommendation,
    AdvisorSource,
    ChangeDeliveryModePatch,
    EnablePlanningWindowPatch,
    IncorporateReferenceResourcePatch,
    IncreaseTeacherLoadPatch,
    TeacherLoadAdjustment,
)
from solver import is_eligible_for_course

MAX_WEEKLY_MINUTES = 2400


class AdvisorPrivacyCodec:
    """Symmetric pseudonymizer so teacher personal names never leave the machine."""

    def __init__(self, teacher_names: dict[str, str]) -> None:
        self._id_to_name: dict[str, str] = {}
        self._id_to_alias: dict[str, str] = {}
        self._alias_to_name: dict[str, str] = {}
        self._name_to_alias: dict[str, str] = {}

        for idx, (t_id, name) in enumerate(sorted(teacher_names.items()), start=1):
            clean = (name or t_id).strip()
            alias = f"DOCENTE_{idx:03d}"
            self._id_to_name[t_id] = clean
            self._id_to_alias[t_id] = alias
            self._alias_to_name[alias] = clean
            if clean:
                self._name_to_alias[clean] = alias

    def alias_for_id(self, teacher_id: str) -> str:
        return self._id_to_alias.get(teacher_id, "DOCENTE_000")

    def sanitize_text(self, text: str) -> str:
        replacements = {**self._id_to_alias, **self._name_to_alias}
        if not replacements:
            return text
        pattern = re.compile(r'(?<![\w])(?:' + '|'.join(re.escape(x) for x in sorted(replacements, key=len, reverse=True)) + r')(?![\w])', re.IGNORECASE)
        aliases = {k.casefold(): v for k, v in replacements.items()}
        result = pattern.sub(lambda match: aliases[match.group().casefold()], text)
        return result

    def rehydrate_text(self, text: str) -> str:
        result = text
        for alias, real_name in sorted(
            self._alias_to_name.items(), key=lambda item: len(item[0]), reverse=True
        ):
            result = result.replace(alias, real_name)
        return result


def build_deterministic_analysis(
    req: AdvisorAnalyzeRequest,
) -> tuple[str, list[AdvisorBottleneck], list[AdvisorRecommendation], AdvisorPrivacyCodec]:
    courses_by_id = {c.courseId: c for c in req.courses}
    teachers_by_id = {t.id: t for t in req.teachers}
    has_policy = req.planningPolicy is not None

    teacher_names: dict[str, str] = {
        t.id: (t.name or t.id) for t in req.teachers
    }
    for rt in req.referenceTeachers:
        teacher_names.setdefault(rt.id, rt.name or rt.id)
    codec = AdvisorPrivacyCodec(teacher_names)

    pending_by_course: dict[str, list] = defaultdict(list)
    for p in req.pending:
        pending_by_course[p.courseId].append(p)

    pending_sections = {p.sectionId for p in req.pending}
    bottlenecks: list[AdvisorBottleneck] = []
    recommendations: list[AdvisorRecommendation] = []

    # 1. Analyze teacher load shortfall across courses with pending sessions
    teacher_required_extra: dict[str, int] = defaultdict(int)
    teacher_unlocked_sections: dict[str, set[str]] = defaultdict(set)
    load_affected_sessions = 0
    load_course_names: list[str] = []

    assigned_minutes_by_teacher: dict[str, int] = defaultdict(int)
    for a in req.assignments:
        assigned_minutes_by_teacher[a.teacherId] += (
            a.interval.endMinute - a.interval.startMinute
        )

    reserved_minutes: dict[str, int] = defaultdict(int)
    for course_id, p_items in sorted(pending_by_course.items()):
        course = courses_by_id.get(course_id)
        if not course:
            continue
        eligible = [
            t
            for t in req.teachers
            if is_eligible_for_course(t, course_id, has_policy)
        ]
        if not eligible:
            continue
        pending_mins = sum(item.durationMinutes for item in p_items)
        spare_mins = sum(
            max(0, t.maxWeeklyMinutes + teacher_required_extra[t.id] - assigned_minutes_by_teacher[t.id] - reserved_minutes[t.id])
            for t in eligible
        )
        if spare_mins < pending_mins:
            deficit = pending_mins - spare_mins
            load_affected_sessions += len(p_items)
            load_course_names.append(course.name or course_id)
            # Distribute deficit across eligible teachers that still have room under 2400
            expandable = [
                t
                for t in eligible
                if t.maxWeeklyMinutes + teacher_required_extra[t.id]
                < MAX_WEEKLY_MINUTES
            ]
            if expandable:
                share = ((deficit + len(expandable) - 1) // len(expandable))
                # Round up to 60-minute increments
                share_rounded = ((share + 59) // 60) * 60 + 60
                for t in expandable:
                    room_left = MAX_WEEKLY_MINUTES - (
                        t.maxWeeklyMinutes + teacher_required_extra[t.id]
                    )
                    add = min(room_left, max(60, share_rounded))
                    if add > 0:
                        teacher_required_extra[t.id] += add
                        for item in p_items:
                            teacher_unlocked_sections[t.id].add(item.sectionId)

        # Reserve the same teacher pool cumulatively across all pending courses.
        remaining = pending_mins
        for t in eligible:
            spare = max(0, t.maxWeeklyMinutes + teacher_required_extra[t.id] - assigned_minutes_by_teacher[t.id] - reserved_minutes[t.id])
            take = min(remaining, spare)
            reserved_minutes[t.id] += take
            remaining -= take

    if teacher_required_extra:
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

        if adjustments:
            sample_courses = ", ".join(load_course_names[:4])
            more_courses = (
                f" y {len(load_course_names) - 4} más"
                if len(load_course_names) > 4
                else ""
            )
            bottlenecks.append(
                AdvisorBottleneck(
                    category="teacher_load",
                    title=f"Tope semanal docente insuficiente en {len(load_course_names)} curso(s)",
                    detail=(
                        f"Los docentes habilitados agotan su tope actual (p. ej. 600 min/semana) frente a la demanda de {sample_courses}{more_courses}."
                    ),
                    affectedSessionCount=load_affected_sessions,
                )
            )
            sample_teachers = ", ".join(teacher_labels[:4])
            more_teachers = (
                f" (+{len(teacher_labels) - 4} docentes)"
                if len(teacher_labels) > 4
                else ""
            )
            recommendations.append(
                AdvisorRecommendation(
                    id="rec-increase-teacher-load",
                    title=f"Ampliar carga máxima semanal de {len(adjustments)} docente(s) habilitados",
                    rationale=(
                        f"Escenario sintético sujeto a autorización externa; no acredita límite reglamentario ({MAX_WEEKLY_MINUTES} min del simulador) para cubrir las secciones pendientes: {sample_teachers}{more_teachers}."
                    ),
                    impactSummary=f"Destraba hasta {len(unlocked_secs)} sección(es) en {len(load_course_names)} curso(s)",
                    recommendedByDefault=False,
                    patch=IncreaseTeacherLoadPatch(adjustments=adjustments),
                )
            )

    # 2. Check senior courses (cycle >= 7) or window congestion -> suggest afternoon / saturday
    senior_pending = [
        p
        for p in req.pending
        if (courses_by_id.get(p.courseId) and (courses_by_id[p.courseId].cycle or 0) >= 7)
    ]
    if req.planningPolicy and (
        not req.planningPolicy.allowAfternoon or not req.planningPolicy.allowSaturday
    ):
        need_afternoon = not req.planningPolicy.allowAfternoon and len(senior_pending) > 0
        need_saturday = not req.planningPolicy.allowSaturday and len(req.pending) > 6
        if need_afternoon or need_saturday:
            win_sessions = len(senior_pending) if need_afternoon else len(req.pending)
            bottlenecks.append(
                AdvisorBottleneck(
                    category="planning_window",
                    title="Restricción de franja horaria en ciclos superiores / semana",
                    detail=(
                        f"Los cursos de ciclo VII–X están restringidos a 18:00–22:00 ({len(senior_pending)} componentes pendientes) y el sábado permanece cerrado."
                    ),
                    affectedSessionCount=win_sessions,
                )
            )
            recommendations.append(
                AdvisorRecommendation(
                    id="rec-enable-planning-window",
                    title="Habilitar excepción de turno tarde (14:00–22:00) y sábado (08:00–13:00)",
                    rationale=(
                        "Permite ubicar secciones de ciclos VII–X desde las 14:00 y abre la mañana del sábado para absorber colisiones de cohorte y aula."
                    ),
                    impactSummary=f"Amplía ventanas para {len(pending_sections)} sección(es) pendientes",
                    recommendedByDefault=True,
                    patch=EnablePlanningWindowPatch(
                        allowAfternoon=True if not req.planningPolicy.allowAfternoon else None,
                        allowSaturday=True if not req.planningPolicy.allowSaturday else None,
                    ),
                )
            )

    # 3. Missing qualified teachers or laboratory rooms in workspace that exist in reference catalog
    workspace_teacher_ids = {t.id for t in req.teachers}
    missing_teacher_ids: list[str] = []
    missing_teacher_names: list[str] = []
    unqualified_sessions = 0

    for course_id, p_items in pending_by_course.items():
        eligible = [
            t
            for t in req.teachers
            if is_eligible_for_course(t, course_id, has_policy)
        ]
        if not eligible:
            unqualified_sessions += len(p_items)
            for rt in req.referenceTeachers:
                if (
                    rt.id not in workspace_teacher_ids
                    and course_id in rt.courseIds
                    and rt.id not in missing_teacher_ids
                ):
                    missing_teacher_ids.append(rt.id)
                    missing_teacher_names.append(rt.name)

    workspace_room_ids = {r.id for r in req.rooms}
    has_room_diag = any(
        d.code in ("NO_COMPATIBLE_ROOM", "ROOM_CAPACITY") for d in req.diagnostics
    )
    missing_room_ids: list[str] = []
    if has_room_diag:
        for rr in req.referenceRooms:
            if rr.id not in workspace_room_ids and rr.id not in missing_room_ids:
                missing_room_ids.append(rr.id)

    if missing_teacher_ids or missing_room_ids:
        bottlenecks.append(
            AdvisorBottleneck(
                category="missing_resource",
                title="Recursos del catálogo de referencia excluidos del workspace",
                detail=(
                    f"Existen {len(missing_teacher_ids)} docente(s) y {len(missing_room_ids)} ambiente(s) en el catálogo de referencia que cubren cursos pendientes."
                ),
                affectedSessionCount=max(unqualified_sessions, 1),
            )
        )
        recommendations.append(
            AdvisorRecommendation(
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
        )

    # 4. Long continuous courses that still have pending components -> suggest split mode
    long_continuous_courses: list[str] = []
    long_course_sessions = 0
    for course_id, p_items in pending_by_course.items():
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
            long_course_sessions += len(p_items)

    if long_continuous_courses:
        bottlenecks.append(
            AdvisorBottleneck(
                category="delivery_mode",
                title=f"{len(long_continuous_courses)} curso(s) con bloques continuos largos (≥ 4 h)",
                detail=(
                    "Exigir que teoría, práctica y laboratorio ocurran pegados el mismo día con el mismo docente reduce las combinaciones factibles."
                ),
                affectedSessionCount=long_course_sessions,
            )
        )
        recommendations.append(
            AdvisorRecommendation(
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
        )

    scheduled_count = len(req.assignments)
    total_count = len(req.requirements)
    summary = (
        f"La propuesta cubre {scheduled_count}/{total_count} componentes requeridos y deja {len(req.pending)} componentes pendientes en {len(pending_sections)} sección(es). "
        f"Se identificaron {len(bottlenecks)} cuello(s) de botella principales y {len(recommendations)} recomendación(es) aplicables sobre el workspace antes de regenerar con el solver CP-SAT."
    )
    return summary, bottlenecks, recommendations, codec




def _extract_json_object(raw_text: str) -> dict:
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end >= start:
        cleaned = cleaned[start : end + 1]
    parsed = json.loads(cleaned)
    if not isinstance(parsed, dict):
        raise ValueError("LLM response is not a JSON object")
    return parsed


def _apply_validated_llm_output(
    parsed: dict,
    provider_label: str,
    summary: str,
    recommendations: list[AdvisorRecommendation],
    codec: AdvisorPrivacyCodec,
) -> tuple[AdvisorSource, str, list[AdvisorRecommendation]]:
    if not isinstance(parsed.get("summary"), str) or not parsed["summary"].strip() or len(parsed["summary"]) > 2048:
        return (
            AdvisorSource(
                mode="deterministic-fallback",
                providerLabel=None,
                fallbackReason="invalid_llm_output",
            ),
            summary,
            recommendations,
        )
    allowed_ids = {r.id for r in recommendations}
    prioritized_ids = parsed.get("prioritizedIds")
    if not isinstance(prioritized_ids, list) or any(
        not isinstance(x, str) or x not in allowed_ids for x in prioritized_ids
    ):
        return (
            AdvisorSource(
                mode="deterministic-fallback",
                providerLabel=None,
                fallbackReason="invalid_llm_output",
            ),
            summary,
            recommendations,
        )

    rationales = parsed.get("rationalesById") or {}
    rec_map = {r.id: r.model_copy(deep=True) for r in recommendations}
    ordered_recs: list[AdvisorRecommendation] = []
    seen: set[str] = set()
    for r_id in prioritized_ids:
        if r_id in rec_map and r_id not in seen:
            seen.add(r_id)
            item = rec_map[r_id]
            if item.patch.kind != "increase_teacher_load" and isinstance(rationales, dict) and isinstance(
                rationales.get(r_id), str
            ):
                item.rationale = codec.rehydrate_text(rationales[r_id].strip())
            ordered_recs.append(item)
    for r in recommendations:
        if r.id not in seen:
            ordered_recs.append(rec_map[r.id])

    rehydrated_summary = codec.rehydrate_text(parsed["summary"].strip())
    return (
        AdvisorSource(
            mode="llm-assisted",
            providerLabel=provider_label,
        ),
        rehydrated_summary,
        ordered_recs,
    )


async def analyze_proposal_with_advisor(req: AdvisorAnalyzeRequest, env=None, transport=None, model_factory=None) -> AcademicAdvisorResponse:
    from advisor_agent import run_advisor_agent
    from normative import NormativeRequest, default_retriever
    from datetime import date
    period = req.planningPolicy.period if req.planningPolicy else f'{date.today().year}-II'
    normative = default_retriever().query(NormativeRequest(question='carga lectiva máximo hora académica excepciones autorización', facultyId='FISI', academicPeriod=period, asOf=date.today().isoformat(), teacherType='unknown'))
    if not req.planningPolicy:
        normative.gaps.append('Periodo de contexto local inferido del año actual; no confirma periodo académico.')
    summary, bottlenecks, recommendations, codec = build_deterministic_analysis(req)
    source, final_summary, final_recommendations, impact, steps = await run_advisor_agent(
        req, summary, bottlenecks, recommendations, codec, env=env, model_factory=model_factory, normative_context=normative.model_dump()
    )
    return AcademicAdvisorResponse(proposalId=req.proposalId, editVersion=req.editVersion,
        source=source, summary=final_summary, bottlenecks=bottlenecks,
        recommendations=final_recommendations, verifiedImpact=impact, reasoningSteps=steps, normativeContext=normative)
