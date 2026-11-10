"""Independent synthetic scenarios plus bounded public-corpus checks (no private inputs)."""
import pytest
from normative import NormativeRequest, NormativeRetriever


def request(**kw):
    return NormativeRequest(question='máximo carga lectiva ordinario', facultyId='FISI', academicPeriod='2026-II', asOf='2026-11-08', teacherType='ordinario', **kw)


def test_public_limit_with_related_exception():
    result = NormativeRetriever().query(request())
    assert result.retrievalMode == 'lexical-only'
    assert any(c.article == 'Artículo 7' for c in result.citations)
    assert any(c.article == 'Final TERCERA' for c in result.citations)
    assert 'autorización' in result.answer.lower()


def synthetic_chunk(id='synthetic', **changes):
    from normative import URLS
    row = dict(id=id, documentId='synthetic-doc', title='Independent synthetic rule', article='Synthetic article', page=1,
               url=sorted(URLS)[0], excerpt='carga lectiva máximo diez horas', sourceClass='normative', scope='UNMSM',
               facultyIds=['FISI'], periods=['2026-II'], teacherTypes=['ordinario'], reviewedAt='2026-11-08',
               publishedAt='2026-01-01', effectiveFrom='2026-01-01', effectiveTo=None, related=[])
    return row | changes


def test_scope_period_regime_dates_prefilter_both_paths():
    seen = []
    def embeddings(texts):
        seen.extend(texts)
        return [[1., 0.] for _ in texts]
    excluded = [synthetic_chunk('other-faculty', facultyIds=['MEDICINA']),
                synthetic_chunk('other-period', periods=['2027-I']),
                synthetic_chunk('contractor', teacherTypes=['contratado']),
                synthetic_chunk('future', effectiveFrom='2027-01-01'),
                synthetic_chunk('expired', effectiveTo='2026-01-02')]
    result = NormativeRetriever([synthetic_chunk()] + excluded, embeddings).query(request())
    assert [c.id for c in result.citations] == ['synthetic']
    assert len(seen) == 2  # query plus the only applicable public/synthetic text
    assert result.retrievalMode == 'hybrid'
    assert result.status == 'supported'


def test_unknown_and_contractor_never_receive_ordinary_limits():
    for regime in ['contratado', 'unknown']:
        req = request().model_copy(update={'teacherType': regime})
        result = NormativeRetriever().query(req)
        assert all(c.article != 'Artículo 7' for c in result.citations)
        assert result.status == 'not-determined'
        assert any('ordinarios' in g for g in result.gaps)


def test_future_review_and_faculty_hour_gaps():
    req = request().model_copy(update={'asOf': '2027-03-01', 'academicPeriod': '2027-I', 'question': 'duración hora académica'})
    result = NormativeRetriever().query(req)
    assert result.status == 'not-determined'
    assert any(c.article == 'Artículo 8' for c in result.citations)
    assert any('vigencia futura no confirmada' in g for g in result.gaps)
    assert any('FISI' in g for g in result.gaps)


def test_historical_excluded_today_but_available_at_historical_date():
    retriever = NormativeRetriever([synthetic_chunk(effectiveTo='2026-06-01')])
    assert retriever.query(request()).citations == []
    historical = retriever.query(request().model_copy(update={'asOf': '2026-02-01'}))
    assert len(historical.citations) == 1


def test_conflict_is_exposed_without_ranking_precedence():
    result = NormativeRetriever([synthetic_chunk('one', conflictsWith=['two']), synthetic_chunk('two', excerpt='carga lectiva máximo veinte horas')]).query(request())
    assert result.status == 'conflict'
    assert len(result.citations) == 2
    assert any('prevalencia' in gap for gap in result.gaps)


@pytest.mark.parametrize('reverse', [False, True])
def test_conflict_survives_related_citation_saturation_and_reverse_metadata(reverse):
    seeds = [synthetic_chunk(f'ranked-{i}') for i in range(4)]
    seeds[0]['related'] = [f'related-{i}' for i in range(5)]
    related = [synthetic_chunk(f'related-{i}', excerpt='contenido complementario') for i in range(5)]
    counterpart = synthetic_chunk('counterpart', excerpt='disposición incompatible')
    if reverse:
        counterpart['conflictsWith'] = ['ranked-0']
    else:
        seeds[0]['conflictsWith'] = ['counterpart']
    result = NormativeRetriever(seeds + related + [counterpart]).query(request())
    assert result.status == 'conflict'
    assert len(result.citations) == 8
    assert {'ranked-0', 'counterpart'} <= {c.id for c in result.citations}


def test_conflict_outside_applicable_dates_does_not_block_current_rule():
    result = NormativeRetriever([
        synthetic_chunk('current', conflictsWith=['expired']),
        synthetic_chunk('expired', effectiveTo='2026-06-01'),
    ]).query(request())
    assert result.status == 'supported'
    assert [c.id for c in result.citations] == ['current']


def test_more_conflicts_than_citation_capacity_still_reports_conflict_and_truncation():
    targets = [f'conflict-{i}' for i in range(9)]
    result = NormativeRetriever([synthetic_chunk('rule', conflictsWith=targets)] + [
        synthetic_chunk(target, excerpt='disposición incompatible') for target in targets
    ]).query(request())
    assert result.status == 'conflict'
    assert len(result.citations) == 8
    assert any('ocho citas' in gap for gap in result.gaps)


def test_semantic_paraphrase_without_lexical_overlap_and_failure_fallback():
    req = request().model_copy(update={'question': 'teaching workload'})
    assert NormativeRetriever([synthetic_chunk()]).query(req).citations == []
    result = NormativeRetriever([synthetic_chunk()], lambda texts: [[1., 0.], [1., 0.]]).query(req)
    assert result.retrievalMode == 'hybrid'
    assert len(result.citations) == 1
    def failed(_):
        raise RuntimeError('Synthetic model failure')
    fallback = NormativeRetriever([synthetic_chunk()], failed).query(request())
    assert fallback.retrievalMode == 'lexical-only'
    assert len(fallback.citations) == 1


def test_empty_query_no_scope_bypass_and_unavailable():
    assert NormativeRetriever().query(request().model_copy(update={'question': 'UNMSM FISI'})).citations == []
    result = NormativeRetriever([]).query(request())
    assert result.retrievalMode == 'unavailable'
    assert result.status == 'not-determined'
    assert result.citations == []


def test_no_applicable_documents_do_not_claim_the_embedding_model_is_missing():
    def embeddings(_texts):
        raise AssertionError('Filtered-out documents must not reach embeddings')
    retriever = NormativeRetriever([synthetic_chunk('future', effectiveFrom='2027-01-01')], embeddings)
    result = retriever.query(request())
    assert result.citations == []
    assert result.status == 'not-determined'
    assert any('No hay fragmentos aplicables' in gap for gap in result.gaps)
    assert not any('Modelo semántico no preparado' in gap for gap in result.gaps)


@pytest.mark.parametrize('changes', [{'question': '  '}, {'question': 'x'*1001}, {'asOf': '2026-02-30'}, {'asOf': '2026-2-01'}, {'facultyId': 'OTHER'}, {'file': '/tmp/x'}, {'academicPeriod': '2027-III'}])
def test_strict_request(changes):
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        NormativeRequest.model_validate(request().model_dump() | changes)


def test_http_independent_query_and_invalid_input():
    from fastapi.testclient import TestClient
    from main import app
    with TestClient(app) as client:
        response = client.post('/v1/normative/query', json=request().model_dump())
        assert response.status_code == 200
        assert response.json()['revision'] == 'PA-NORMATIVE-1'
        assert client.post('/v1/normative/query', json=request().model_dump() | {'url': 'https://invalid'}).status_code == 422


def test_mandatory_context_before_model_and_no_external_identities():
    import asyncio, json
    from langchain_core.messages import AIMessage
    from test_advisor_agent import sample
    from advisor import analyze_proposal_with_advisor
    class Model:
        def bind_tools(self, _):
            return self
        async def ainvoke(self, messages):
            text = json.dumps(messages)
            assert 'normativeContext' in text
            assert 'PA-NORMATIVE-1' in text
            assert 'synthetic-teacher-id' not in text
            assert 'Synthetic Teacher Name' not in text
            return AIMessage(content=json.dumps({'summary':'Resumen sintético', 'prioritizedIds':[]}))
    result = asyncio.run(analyze_proposal_with_advisor(sample(), env={}, model_factory=lambda _: (Model(), 'synthetic')))
    assert result.normativeContext is not None
    assert result.source.mode == 'llm-assisted'
    assert all(not r.recommendedByDefault for r in result.recommendations if r.patch.kind == 'increase_teacher_load')


def test_no_preparation_marker_silently_enables_memory_backend():
    result = NormativeRetriever(env={'SUM_RAG_GENERATION_MODE': 'extractive'}).query(request())
    assert result.retrievalMode == 'lexical-only'
    assert any('Repositorio vectorial' in gap for gap in result.gaps)


def test_ranking_fusion_uses_both_rankings():
    # Lexical order A,B,C; semantic order B,C,A. Fusion must rank B first.
    chunks = [synthetic_chunk('A', excerpt='carga lectiva máximo máximo máximo'),
              synthetic_chunk('B', excerpt='carga lectiva máximo'),
              synthetic_chunk('C', excerpt='carga lectiva')]
    vectors = lambda texts: [[1.,0.], [.4,.9165], [1.,0.], [.9,.4359]]
    result = NormativeRetriever(chunks, vectors).query(request())
    assert result.retrievalMode == 'hybrid'
    assert result.citations[0].id == 'B'
