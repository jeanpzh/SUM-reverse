from __future__ import annotations

import json
import re

from advisor_catalog import MAX_WEEKLY_MINUTES, RECOMMENDATION_CATALOG
from advisor_diagnosis import diagnose
from models import (
    AcademicAdvisorResponse,
    AdvisorAnalyzeRequest,
    AdvisorBottleneck,
    AdvisorRecommendation,
    AdvisorSource,
)


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
    teacher_names: dict[str, str] = {
        t.id: (t.name or t.id) for t in req.teachers
    }
    for rt in req.referenceTeachers:
        teacher_names.setdefault(rt.id, rt.name or rt.id)
    codec = AdvisorPrivacyCodec(teacher_names)

    diagnosis = diagnose(req)
    bottlenecks: list[AdvisorBottleneck] = []
    recommendations: list[AdvisorRecommendation] = []

    for handler in RECOMMENDATION_CATALOG:
        if not handler.applies(req, diagnosis):
            continue
        bottleneck = handler.bottleneck(req, diagnosis)
        if bottleneck is not None:
            bottlenecks.append(bottleneck)
        recommendations.extend(handler.variants(req, diagnosis))

    scheduled_count = len(req.assignments)
    total_count = len(req.requirements)
    summary = (
        f"La propuesta cubre {scheduled_count}/{total_count} componentes requeridos y deja {diagnosis.totalPendingCount} componentes pendientes en {len(diagnosis.pendingSectionIds)} sección(es). "
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
