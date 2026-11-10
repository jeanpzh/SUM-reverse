"""PA-NORMATIVE-1. Offline, bounded documentary retrieval; never authorization."""
from __future__ import annotations

from datetime import date
from functools import lru_cache
import hashlib
import json
import os
import asyncio
from pathlib import Path
import re
import unicodedata
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from langchain_core.documents import Document
from rag_chain import HybridRetriever, generate_answer
from normative_relevance import contextual_question, retrieval_question, facets, focus_documents, ambiguous_followup
from normative_answer import documentary_answer, query_next_step

REVISION = 'PA-NORMATIVE-1'
MODEL = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
CACHE = Path('/tmp/pa-normative-model')
URL_BASE = 'https://medicina.unmsm.edu.pe/wp-content/uploads/2026/03/'
URLS = {URL_BASE + 'RESOLUCION-RECTORAL-001380-2026-R' + suffix + '.pdf' for suffix in ['', '-ANEXO']}


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)


class NormativeRequest(StrictModel):
    question: str = Field(min_length=1, max_length=1000)
    facultyId: Literal['FISI']
    academicPeriod: str = Field(pattern=r'^20\d{2}-(I|II)$')
    asOf: str
    teacherType: Literal['ordinario', 'contratado', 'unknown']
    previousQuestion: str | None = Field(default=None, min_length=1, max_length=1000, exclude_if=lambda value: value is None)

    @field_validator('question', 'previousQuestion', mode='before')
    @classmethod
    def trim_question(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator('previousQuestion', mode='before')
    @classmethod
    def previous_is_text(cls, value):
        if value is None:
            raise ValueError('Previous question must be a bounded nonblank string')
        return value

    @field_validator('asOf')
    @classmethod
    def real_date(cls, value):
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
            raise ValueError('Expected YYYY-MM-DD')
        date.fromisoformat(value)
        return value


class NormativeCitation(StrictModel):
    id: str
    documentId: str
    title: str
    article: str
    page: int = Field(ge=1)
    url: str
    excerpt: str
    sourceClass: Literal['normative']
    scope: Literal['UNMSM', 'FISI']
    reviewedAt: str
    effectiveFrom: str | None
    effectiveTo: str | None

    @field_validator('url')
    @classmethod
    def official_url(cls, value):
        if value not in URLS:
            raise ValueError('Source outside reviewed allowlist')
        return value


class NormativeContext(StrictModel):
    facultyId: Literal['FISI']
    academicPeriod: str = Field(pattern=r'^20\d{2}-(I|II)$')
    asOf: str
    teacherType: Literal['ordinario', 'contratado', 'unknown']


class NormativeGeneration(StrictModel):
    mode: Literal['llm-assisted', 'extractive']
    providerLabel: str | None
    fallbackReason: Literal['not_configured', 'timeout', 'upstream_error', 'invalid_llm_output', 'insufficient_evidence', 'disabled'] | None = Field(default=None, exclude_if=lambda value: value is None)


class NormativeResponse(StrictModel):
    revision: Literal['PA-NORMATIVE-1'] = REVISION
    question: str
    context: NormativeContext
    status: Literal['supported', 'not-determined', 'conflict']
    answer: str = Field(min_length=1, max_length=6000)
    retrievalMode: Literal['hybrid', 'lexical-only', 'unavailable']
    citations: list[NormativeCitation] = Field(max_length=8)
    gaps: list[str]
    generation: NormativeGeneration | None = Field(default=None, exclude_if=lambda value: value is None)
    nextStep: str | None = Field(default=None, min_length=1, max_length=500, exclude_if=lambda value: value is None)


def tokens(text):
    text = ''.join(c for c in unicodedata.normalize('NFKD', text.lower()) if not unicodedata.combining(c))
    stop = {'de', 'la', 'el', 'los', 'las', 'en', 'y', 'un', 'una', 'por', 'para', 'que', 'del', 'se', 'es', 'al', 'con', 'cual', 'cuanto', 'como', 'unmsm', 'fisi'}
    return [w for w in re.findall(r'\w+', text) if w not in stop and len(w) > 1]


class NormativeRetriever:
    def __init__(self, chunks=None, embedder=None, *, repository=None, env=None, model_factory=None):
        self.env = dict(os.environ) if env is None else dict(env)
        self.repository = repository
        self.repository_failure_reason = 'not_configured'
        self.model_factory = model_factory
        if chunks is None:
            # Queries read only the canonical local bundle, never a remote source.
            from rag_sources import load_corpus
            bundle = load_corpus(self.env | {'SUM_RAG_SOURCE': 'local'})
            chunks = bundle['chunks']
            if repository is None and embedder is None:
                try:
                    if not self.env.get('SUM_RAG_DATABASE_URL') and self.env.get('SUM_RAG_VECTOR_BACKEND', 'pgvector') == 'pgvector':
                        raise ValueError('Database not configured')
                    from rag_sources import corpus_fingerprint
                    from rag_models import create_embeddings
                    from rag_storage import create_vector_repository
                    self.repository = create_vector_repository(create_embeddings(self.env), self.env,
                                                               corpus_fingerprint=corpus_fingerprint(bundle))
                except Exception:
                    self.repository = None
                    self.repository_failure_reason = 'configuration_failed' if self.env.get('SUM_RAG_DATABASE_URL') else 'not_configured'
        self.chunks = chunks
        self.embedder = embedder
        ids = set()
        for c in self.chunks:
            if c['id'] in ids:
                raise ValueError('Duplicate canonical article ID')
            ids.add(c['id'])
            if c['url'] not in URLS:
                raise ValueError('Unreviewed source URL')
            if 'excerptSha256' in c and hashlib.sha256(c['excerpt'].encode()).hexdigest() != c['excerptSha256']:
                raise ValueError('Corrupt corpus excerpt')

    def query(self, req: NormativeRequest) -> NormativeResponse:
        # Apply explicit applicability BEFORE either ranking path, including expansion.
        eligible = [c for c in self.chunks if c['scope'] in ['UNMSM', req.facultyId]
                    and req.facultyId in c['facultyIds']
                    and (not c['periods'] or req.academicPeriod in c['periods'])
                    and req.teacherType in c['teacherTypes']
                    and c.get('publishedAt', '0001-01-01') <= req.asOf
                    and (not c['effectiveFrom'] or c['effectiveFrom'] <= req.asOf)
                    and (not c['effectiveTo'] or req.asOf <= c['effectiveTo'])]
        documents = [Document(page_content=c['excerpt'], metadata=c | {
            'excerptSha256': hashlib.sha256(c['excerpt'].encode()).hexdigest(),
        }) for c in eligible]
        retriever = HybridRetriever(documents=documents, tokenize=tokens,
                                    repository=self.repository, callable_embedder=self.embedder,
                                    repository_failure_reason=self.repository_failure_reason)
        subject, _ = contextual_question(req.question, req.previousQuestion)
        facet = facets(subject)
        ranked = retriever.invoke(retrieval_question(subject))
        unresolved = ambiguous_followup(req.question) and not req.previousQuestion
        selected_docs = [] if unresolved else focus_documents(ranked, facet, subject)
        primary_ids = {d.metadata['id'] for d in selected_docs}
        selected = [d.metadata for d in selected_docs]
        mode = 'hybrid' if retriever.semantic_used and not retriever.degraded else 'lexical-only'
        gaps = ['Corpus parcial: no acredita autorización, carga individual ni aprobación del horario.',
                'Falta acuerdo FISI sobre duración de hora académica y disponibilidad/autorizaciones del periodo.',
                'Mínimos generales no autorizan completar carga ni invalidan una asignación parcial de esta escuela.']
        if not eligible:
            gaps.append('No hay fragmentos aplicables a los filtros y fecha de la consulta.')
        elif retriever.degraded:
            from rag_diagnostics import RETRIEVAL_GAPS, retrieval_failure
            gaps.append(RETRIEVAL_GAPS[retrieval_failure(retriever.failure_reason)])
        ids = {c['id'] for c in selected}
        by_id = {c['id']: c for c in eligible}
        for c in list(selected):
            for related in c.get('related', []):
                match = by_id.get(related)
                if match and related not in ids:
                    selected.append(match)
                    ids.add(related)
        # Detect applicable conflicts before the citation cap, including reverse links.
        pairs = [(c['id'], target) for c in eligible for target in c.get('conflictsWith', [])
                 if target in by_id and (c['id'] in ids or target in ids)]
        conflicts = bool(pairs)
        conflict_ids = list(dict.fromkeys(item for pair in pairs for item in pair))
        priority_ids = list(dict.fromkeys(conflict_ids + [c['id'] for c in selected]))
        selected = [by_id[item] for item in priority_ids[:8]]
        if len(conflict_ids) > 8:
            gaps.append('Hay más referencias en conflicto que las ocho citas mostradas; se requiere revisión documental adicional.')
        future = any(req.asOf > c['reviewedAt'] for c in selected)
        if future:
            gaps.append('Fecha posterior a revisión del corpus: vigencia futura no confirmada; comprobar modificaciones oficiales.')
        unknown_effective = any(c['effectiveFrom'] is None for c in selected)
        if unknown_effective:
            gaps.append('Entrada en vigencia exacta no determinada por los extractos revisados; fecha de resolución no equivale a vigencia.')
        if req.teacherType != 'ordinario':
            gaps.append('Régimen contratado o desconocido: no aplicar límites de docentes ordinarios.')
        if conflicts:
            gaps.append('Conflicto documental explícito; la puntuación de recuperación no determina prevalencia normativa.')
        status = 'conflict' if conflicts else 'not-determined' if not selected or future or unknown_effective or req.teacherType != 'ordinario' else 'supported'
        citations = [NormativeCitation(**{key: c[key] for key in NormativeCitation.model_fields}) for c in selected]
        answer = documentary_answer(citations, primary_ids, facet, req.teacherType, conflicts)
        next_step = query_next_step(facet, req.teacherType, bool(citations), conflicts)
        if unresolved:
            answer = 'Falta el antecedente para saber a qué autorización te refieres; no se puede determinar una autoridad sin identificar el caso.'
            next_step = 'Indica si preguntas por la duración de la hora, un exceso de carga u otra decisión concreta.'
        result = NormativeResponse(question=req.question, context=req.model_dump(exclude={'question', 'previousQuestion'}), status=status,
                                   answer=answer[:6000], retrievalMode=mode if self.chunks else 'unavailable', citations=citations, gaps=gaps,
                                   nextStep=next_step)
        # Synchronous public query also supports callers already in an event loop.
        def generate():
            return asyncio.run(generate_answer(result, self.env, self.model_factory))
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return generate()
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=1) as executor:
            return executor.submit(generate).result()



@lru_cache(maxsize=1)
def default_retriever():
    return NormativeRetriever()
