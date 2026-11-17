from __future__ import annotations

import json
import logging
import re

from advisor_catalog import (
    DryRunFn,
    MAX_WEEKLY_MINUTES,
    RECOMMENDATION_CATALOG,
    attach_normative_contrasts,
    build_management_actions,
    rank_recommendations,
    resolve_catalog_variants,
)
from advisor_capacity import describe_free_slots
from advisor_diagnosis import BlockerDiagnosis, diagnose
from models import (
    AcademicAdvisorResponse,
    AdvisorAnalyzeRequest,
    AdvisorBottleneck,
    AdvisorNormativeContrast,
    AdvisorRecommendation,
    AdvisorSource,
    AdvisorVerifiedImpact,
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


def _free_slot_finding(diag: BlockerDiagnosis) -> AdvisorBottleneck | None:
    if diag.totalPendingCount == 0:
        return None
    screen = diag.freeSlots
    window_fits = sum(1 for fit in screen.fits if fit.windowLevers and not fit.needsTeacherLoad)
    load_fits = sum(1 for fit in screen.fits if fit.needsTeacherLoad)
    if not screen.fits:
        category = "other"
    elif window_fits >= load_fits and window_fits:
        category = "planning_window"
    elif load_fits:
        category = "teacher_load"
    else:
        category = "other"
    return AdvisorBottleneck(
        category=category,
        title="Huecos libres sin mover lo asignado",
        detail=describe_free_slots(screen, len(diag.pendingSectionIds)),
        affectedSessionCount=screen.fitSessionCount,
    )


def build_deterministic_analysis(
    req: AdvisorAnalyzeRequest,
    *,
    dry_run: DryRunFn | None = None,
    dry_run_cache: dict[tuple[str, ...], AdvisorVerifiedImpact] | None = None,
    diagnosis: object | None = None,
    normative_cache: dict[str, AdvisorNormativeContrast] | None = None,
    retriever: object | None = None,
) -> tuple[str, list[AdvisorBottleneck], list[AdvisorRecommendation], AdvisorPrivacyCodec]:
    from advisor_agent import measured_dry_run, request_fingerprint, run_cpsat_dry_run

    teacher_names: dict[str, str] = {
        t.id: (t.name or t.id) for t in req.teachers
    }
    for rt in req.referenceTeachers:
        teacher_names.setdefault(rt.id, rt.name or rt.id)
    codec = AdvisorPrivacyCodec(teacher_names)

    diag = diagnosis if diagnosis is not None else diagnose(req)
    bottlenecks: list[AdvisorBottleneck] = []
    recommendations: list[AdvisorRecommendation] = []

    for handler in RECOMMENDATION_CATALOG:
        if not handler.applies(req, diag):
            continue
        bottleneck = handler.bottleneck(req, diag)
        if bottleneck is not None:
            bottlenecks.append(bottleneck)
        recommendations.extend(handler.variants(req, diag))

    base_dry_run = dry_run or run_cpsat_dry_run
    if dry_run_cache is not None and dry_run is None:
        fingerprint = request_fingerprint(req)

        def _measured(r, recs, rec_ids):
            return measured_dry_run(r, recs, rec_ids, dry_run_cache, fingerprint)
        effective_dry_run: DryRunFn = _measured
    elif dry_run_cache is not None:
        def _cached_dry_run(
            r: AdvisorAnalyzeRequest,
            recs: list[AdvisorRecommendation],
            rec_ids: list[str],
        ) -> AdvisorVerifiedImpact:
            key = tuple(rec_ids)
            if key in dry_run_cache:
                return dry_run_cache[key]
            impact = base_dry_run(r, recs, rec_ids)
            dry_run_cache[key] = impact
            return impact
        effective_dry_run = _cached_dry_run
    else:
        effective_dry_run = base_dry_run

    recommendations = rank_recommendations(
        req, recommendations, effective_dry_run
    )
    attach_normative_contrasts(
        req, recommendations, cache=normative_cache, retriever=retriever
    )

    scheduled_count = len(req.assignments)
    total_count = len(req.requirements)
    summary = (
        f"La propuesta cubre {scheduled_count}/{total_count} componentes requeridos y deja {diag.totalPendingCount} componentes pendientes en {len(diag.pendingSectionIds)} sección(es). "
        f"Se identificaron {len(bottlenecks)} cuello(s) de botella principales y {len(recommendations)} recomendación(es) aplicables sobre el workspace antes de regenerar con el solver CP-SAT."
    )
    # A finding, not a bottleneck: appended after the summary counts the bottlenecks.
    free_slot_finding = _free_slot_finding(diag)
    if free_slot_finding is not None:
        bottlenecks.append(free_slot_finding)
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


# Prose must not say a lever needs no authorization when its options require it.
_NO_AUTHORIZATION = re.compile(
    r"\b(?:no\s+(?:requiere|necesita)\w*|sin\s+(?:necesidad\s+de\s+)?)\s*(?:una\s+|ninguna\s+)?autorizaci",
    re.IGNORECASE,
)
_CAUSAL = re.compile(r"\b(?:porque|ya que|pues|dado que|puesto que)\b", re.IGNORECASE)
_LEVER_WORDS = re.compile(
    r"\b(?P<increase_teacher_load>carga)\b"
    r"|\b(?P<enable_planning_window>tarde|s[aá]bado|franja\w*|turno\w*|ventana\w*)\b"
    r"|\b(?P<change_delivery_mode>divid\w*|divisi[oó]n|modalidad)\b"
    r"|\b(?P<incorporate_reference_resource>ambiente\w*|laboratorio\w*|aula\w*|referencia)\b",
    re.IGNORECASE,
)


def _authorization_kinds(recommendations: list[AdvisorRecommendation]) -> set[str]:
    return {"increase_teacher_load"} | {r.patch.kind for r in recommendations if _requires_authorization(r)}


def _claims_no_authorization(text: str, authorized_kinds: set[str]) -> bool:
    """True when a clause says a lever in `authorized_kinds` needs no authorization.

    The subject is the lever the claim grammatically hangs on: the one named in the same
    clause before the claim, or, when a causal connector ("ya que", "porque") introduces
    the claim, the first lever named in the main clause before that connector.
    """
    for clause in re.split(r"[.;:]", text):
        for match in _NO_AUTHORIZATION.finditer(clause):
            before = clause[: match.start()]
            causal = list(_CAUSAL.finditer(before))
            scope = before[: causal[-1].start()] if causal else before.split(",")[-1]
            levers = list(_LEVER_WORDS.finditer(scope))
            if not levers:
                continue
            subject = levers[0] if causal else levers[-1]
            if subject.lastgroup in authorized_kinds:
                return True
    return False


def _replace_ids_with_titles(text: str, recommendations: list[AdvisorRecommendation]) -> str:
    for rec in sorted(recommendations, key=lambda r: len(r.id), reverse=True):
        text = text.replace(f"'{rec.id}'", f"«{rec.title}»").replace(rec.id, f"«{rec.title}»")
    return text


def _reject(
    code: str, summary: str, recommendations: list[AdvisorRecommendation]
) -> tuple[AdvisorSource, str, list[AdvisorRecommendation]]:
    # Only the rule code is logged, never the model text.
    logging.getLogger("planning.advisor").warning("advisor_llm_output_rejected rule=%s", code)
    return (
        AdvisorSource(mode="deterministic-fallback", providerLabel=None, fallbackReason="invalid_llm_output"),
        summary,
        recommendations,
    )


def _requires_authorization(rec: AdvisorRecommendation) -> bool:
    if rec.patch.kind == "increase_teacher_load":
        return True
    return bool(rec.normativeContrast and rec.normativeContrast.requiresExternalAuthorization)


_SCOPED_TITLE = re.compile(r"solo (?:para|en) (.+?)(?:\s*\(|$)")
_LEVER_CUE = {"increase_teacher_load": "carga", "change_delivery_mode": "divid"}


def _first_mentioned(text: str, recommendations: list[AdvisorRecommendation]) -> AdvisorRecommendation | None:
    """The option the prose names first: by full title, or for a course-scoped variant by
    its course name preceded closely by the lever's cue word (e.g. "carga ... CÁLCULO I")."""
    found: list[tuple[int, AdvisorRecommendation]] = []
    upper = text.upper()
    for rec in recommendations:
        if rec.title and rec.title in text:
            found.append((text.find(rec.title), rec))
            continue
        scoped, cue = _SCOPED_TITLE.search(rec.title or ""), _LEVER_CUE.get(rec.patch.kind)
        if scoped and cue:
            position = upper.find(scoped.group(1).strip().upper())
            if position >= 0 and cue in text[max(0, position - 80):position].lower():
                found.append((position, rec))
    return min(found, key=lambda item: item[0])[1] if found else None


# What the model is told when one of its answers breaks a rule, for its single repair turn.
LLM_OUTPUT_RULE_HINTS = {
    "not_json": "Esa respuesta no es JSON.",
    "summary_shape": "Esa respuesta no trae un summary de texto (máximo 2048 caracteres).",
    "unknown_prioritized_id": "prioritizedIds solo puede contener IDs de candidateRecommendations o de variantes medidas.",
    "authorization_claim": (
        "Afirmaste que una palanca no requiere autorización, pero sus opciones tienen "
        "requiresExternalAuthorization=true. Indica que sí la requieren."
    ),
    "zero_impact_option_first": "No empieces por una opción que no destrabó componentes cuando otra sí destrabó.",
    "dominated_option_first": (
        "Empieza por la opción con más componentes destrabados, salvo que otra destrabe lo mismo "
        "y requiera menos autorización."
    ),
}


def llm_output_issue(
    parsed: dict | None,
    recommendations: list[AdvisorRecommendation],
    *,
    unlocked_by_id: dict[str, int] | None = None,
    allowed_ids: set[str] | None = None,
) -> str | None:
    """The first rule the model's final answer breaks, as a key of LLM_OUTPUT_RULE_HINTS."""
    if parsed is None:
        return "not_json"
    if not isinstance(parsed.get("summary"), str) or not parsed["summary"].strip() or len(parsed["summary"]) > 2048:
        return "summary_shape"
    valid_ids = allowed_ids if allowed_ids is not None else {r.id for r in recommendations}
    prioritized_ids = parsed.get("prioritizedIds")
    if not isinstance(prioritized_ids, list) or any(
        not isinstance(x, str) or x not in valid_ids for x in prioritized_ids
    ):
        return "unknown_prioritized_id"
    rationales = parsed.get("rationalesById") or {}
    prose = [parsed["summary"], *(v for v in rationales.values() if isinstance(v, str))] if isinstance(rationales, dict) else [parsed["summary"]]
    authorized_kinds = _authorization_kinds(recommendations)
    if any(_claims_no_authorization(text, authorized_kinds) for text in prose):
        return "authorization_claim"
    # The summary must not lead with an option measured at zero when another one unlocks
    # components, nor with one another option dominates: at least the same measured impact,
    # no stricter authorization, and strictly better on one of the two.
    lead = _first_mentioned(parsed["summary"], recommendations)
    if lead is not None and unlocked_by_id and lead.id in unlocked_by_id:
        lead_impact, lead_auth = unlocked_by_id[lead.id], _requires_authorization(lead)
        if lead_impact == 0 and max(unlocked_by_id.values()) > 0:
            return "zero_impact_option_first"
        for other in recommendations:
            if other.id == lead.id or other.id not in unlocked_by_id:
                continue
            impact, auth = unlocked_by_id[other.id], _requires_authorization(other)
            if impact >= lead_impact and auth <= lead_auth and (impact > lead_impact or auth < lead_auth):
                return "dominated_option_first"
    return None


def _apply_validated_llm_output(
    parsed: dict,
    provider_label: str,
    summary: str,
    recommendations: list[AdvisorRecommendation],
    codec: AdvisorPrivacyCodec,
    *,
    unlocked_by_id: dict[str, int] | None = None,
    allowed_ids: set[str] | None = None,
) -> tuple[AdvisorSource, str, list[AdvisorRecommendation]]:
    issue = llm_output_issue(parsed, recommendations, unlocked_by_id=unlocked_by_id, allowed_ids=allowed_ids)
    if issue is not None:
        return _reject(issue, summary, recommendations)
    prioritized_ids = parsed["prioritizedIds"]
    rationales = parsed.get("rationalesById") or {}
    rec_map = {r.id: r.model_copy(deep=True) for r in recommendations}
    llm_pos: dict[str, int] = {}
    for r_id in prioritized_ids:
        if r_id not in llm_pos:
            llm_pos[r_id] = len(llm_pos)

    tiered_items: list[tuple[tuple[int, int], tuple[int, int], AdvisorRecommendation]] = []
    for orig_idx, rec in enumerate(recommendations):
        item = rec_map[rec.id]
        if (
            item.patch.kind != "increase_teacher_load"
            and isinstance(rationales, dict)
            and isinstance(rationales.get(item.id), str)
        ):
            item.rationale = _replace_ids_with_titles(
                codec.rehydrate_text(rationales[item.id].strip()), recommendations
            )
        if unlocked_by_id is not None and item.id in unlocked_by_id:
            tier = (0, -unlocked_by_id[item.id])
        elif unlocked_by_id is not None:
            tier = (1, 0)
        else:
            tier = (0, 0)
        tie_break = (llm_pos.get(item.id, len(prioritized_ids) + orig_idx), orig_idx)
        tiered_items.append((tier, tie_break, item))

    tiered_items.sort(key=lambda entry: (entry[0], entry[1]))
    ordered_recs = [entry[2] for entry in tiered_items]

    rehydrated_summary = _replace_ids_with_titles(
        codec.rehydrate_text(parsed["summary"].strip()), recommendations
    )
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
    diagnosis = diagnose(req)
    dry_run_cache: dict[tuple[str, ...], AdvisorVerifiedImpact] = {}
    normative_cache: dict[str, AdvisorNormativeContrast] = {}
    summary, bottlenecks, recommendations, codec = build_deterministic_analysis(
        req, dry_run_cache=dry_run_cache, diagnosis=diagnosis, normative_cache=normative_cache
    )
    known_ids = {r.id for r in recommendations}
    missing_selected = [i for i in (req.selectedRecommendationIds or []) if i not in known_ids]
    if missing_selected:
        recommendations = recommendations + resolve_catalog_variants(req, diagnosis, missing_selected)
    source, final_summary, final_recommendations, impact, steps = await run_advisor_agent(
        req,
        summary,
        bottlenecks,
        recommendations,
        codec,
        env=env,
        model_factory=model_factory,
        normative_context=normative.model_dump(),
        diagnosis=diagnosis,
        dry_run_cache=dry_run_cache,
        normative_cache=normative_cache,
    )
    attach_normative_contrasts(req, final_recommendations, cache=normative_cache)
    management_actions = build_management_actions(
        req, diagnosis, contrast_cache=normative_cache
    )
    return AcademicAdvisorResponse(proposalId=req.proposalId, editVersion=req.editVersion,
        source=source, summary=final_summary, bottlenecks=bottlenecks,
        recommendations=final_recommendations, managementActions=management_actions,
        verifiedImpact=impact, reasoningSteps=steps, normativeContext=normative)
