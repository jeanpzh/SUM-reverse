"""Public query seam, real LangChain retrieval/runnables; only remote edges doubled."""
import pytest
from langchain_core.documents import Document
from langchain_core.runnables import RunnableLambda
from normative import NormativeRequest, NormativeRetriever
from test_normative import synthetic_chunk, request


class Model:
    def __init__(self, output):
        self.output = output
        self.calls = 0

    def with_structured_output(self, schema):
        def reply(messages):
            self.calls += 1
            assert 'synthetic' in messages[1]['content']
            return schema.model_validate(self.output)
        return RunnableLambda(reply)


def test_structured_generation_keeps_canonical_citations_and_status():
    model = Model({'answer': 'Diez horas [synthetic]', 'citationIds': ['synthetic']})
    result = NormativeRetriever([synthetic_chunk()], env={}, model_factory=lambda _: (model, 'synthetic model')).query(request())
    assert result.generation.mode == 'llm-assisted'
    assert result.citations[0].excerpt == 'carga lectiva máximo diez horas'
    assert result.status == 'supported'
    assert model.calls == 1


@pytest.mark.parametrize('output', [
    {'answer': 'Inventado [unknown]', 'citationIds': ['unknown']},
    {'answer': 'Vea https://example.com [synthetic]', 'citationIds': ['synthetic']},
    {'answer': '<b>Texto</b> [synthetic]', 'citationIds': ['synthetic']},
    {'answer': 'Sin referencias', 'citationIds': ['synthetic']},
    {'answer': 'Texto [synthetic]', 'citationIds': ['synthetic'], 'url': 'invented'},
])
def test_invalid_model_output_is_honest_extractive_fallback(output):
    result = NormativeRetriever([synthetic_chunk()], env={}, model_factory=lambda _: (Model(output), 'synthetic')).query(request())
    assert result.generation.fallbackReason == 'invalid_llm_output'
    assert 'Respuesta extractiva' in result.answer


def test_conflicts_and_abstention_never_call_generation():
    def forbidden(_):
        raise AssertionError('Must abstain before provider')
    for chunks in ([], [synthetic_chunk(effectiveFrom=None)],
                   [synthetic_chunk(conflictsWith=['other']), synthetic_chunk('other')]):
        result = NormativeRetriever(chunks, env={}, model_factory=forbidden).query(request())
        assert result.generation.fallbackReason == 'insufficient_evidence'


def test_repository_gets_only_eligible_ids_and_cannot_replace_canonical_sources():
    class Repository:
        def search(self, query, eligible_ids, k=8):
            assert eligible_ids == ['synthetic']
            return [
                Document(page_content='invented', metadata={'id': 'synthetic', 'excerptSha256': 'wrong'}),
                Document(page_content='private', metadata={'id': 'excluded'}),
            ]
        def index(self, _):
            raise AssertionError('Queries never write')
    result = NormativeRetriever([
        synthetic_chunk(), synthetic_chunk('excluded', facultyIds=['OTHER']),
    ], repository=Repository(), env={'SUM_RAG_GENERATION_MODE': 'extractive'}).query(request())
    assert [c.id for c in result.citations] == ['synthetic']
    assert 'invented' not in result.answer and 'private' not in result.answer
    assert result.retrievalMode == 'hybrid'


def test_low_similarity_vector_neighbours_do_not_become_evidence():
    """An off-topic question must abstain even though a vector search always returns nearest rows."""
    import hashlib
    chunk = synthetic_chunk()
    class Repository:
        def __init__(self, score):
            self.score = score
        def search(self, query, eligible_ids, k=8):
            return [Document(page_content=chunk['excerpt'], metadata={
                'id': 'synthetic', 'excerptSha256': hashlib.sha256(chunk['excerpt'].encode()).hexdigest(),
                '_rag_similarity': self.score})]
    def ask(score):
        return NormativeRetriever([chunk], repository=Repository(score), env={'SUM_RAG_GENERATION_MODE': 'extractive'}).query(
            NormativeRequest(question='reparar el motor de un automovil', facultyId='FISI', academicPeriod='2026-II',
                             asOf='2026-11-08', teacherType='ordinario'))
    assert ask(0.05).citations == []
    assert ask(0.05).status == 'not-determined'
    assert [c.id for c in ask(0.9).citations] == ['synthetic']


def test_timeout_and_upstream_failure():
    import asyncio
    class Slow:
        def with_structured_output(self, _):
            async def wait(_):
                await asyncio.sleep(.5)
            return RunnableLambda(wait)
    result = NormativeRetriever([synthetic_chunk()], env={'SUM_LLM_TIMEOUT_MS': '100'},
                               model_factory=lambda _: (Slow(), 'synthetic')).query(request())
    assert result.generation.fallbackReason == 'timeout'
    def failed(_):
        raise ValueError('Synthetic provider initialization error')
    result = NormativeRetriever([synthetic_chunk()], env={}, model_factory=failed).query(request())
    assert result.generation.fallbackReason == 'upstream_error'


def test_serving_uses_validated_local_source_even_when_ingestion_is_configured_for_s3(monkeypatch):
    import rag_sources
    original = rag_sources.load_corpus
    seen = []
    def local_only(env):
        seen.append(env['SUM_RAG_SOURCE'])
        assert env['SUM_RAG_SOURCE'] == 'local'
        return original(env)
    monkeypatch.setattr(rag_sources, 'load_corpus', local_only)
    retriever = NormativeRetriever(repository=object(), env={'SUM_RAG_SOURCE': 's3'})
    assert seen == ['local']
    assert retriever.chunks


def test_serving_rejects_private_corpus_path_before_opening():
    with pytest.raises(ValueError, match='Private corpus path denied'):
        NormativeRetriever(env={'SUM_RAG_CORPUS_PATH': '/tmp/datos-reales/corpus.json'})
