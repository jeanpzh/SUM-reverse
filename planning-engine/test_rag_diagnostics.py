"""Independent failures at remote seams; no real configuration, credentials or network."""
import logging
import pytest
from normative import NormativeRetriever
from rag_storage import VectorRepositoryError
from test_normative import request, synthetic_chunk


@pytest.mark.parametrize(('code', 'message'), [
    ('index_missing', 'Ejecutar la ingesta explícita'),
    ('index_mismatch', 'Reindexar en un namespace nuevo'),
    ('search_failed', 'Revisar base de datos'),
])
def test_search_failure_keeps_lexical_evidence_and_safe_action(code, message, caplog):
    class Repository:
        def search(self, *args, **kwargs):
            raise VectorRepositoryError('synthetic-driver-secret-do-not-log', code=code)
    with caplog.at_level(logging.WARNING, logger='planning.rag'):
        result = NormativeRetriever([synthetic_chunk()], repository=Repository(),
                                    env={'SUM_RAG_GENERATION_MODE': 'extractive'}).query(request())
    assert result.retrievalMode == 'lexical-only'
    assert [c.id for c in result.citations] == ['synthetic']
    assert any(message in gap for gap in result.gaps)
    assert f'reason={code}' in caplog.text
    assert 'synthetic-driver-secret' not in caplog.text
    assert 'synthetic-driver-secret' not in str(result.model_dump())


def test_configuration_missing_is_distinct_from_search_failure(caplog):
    with caplog.at_level(logging.WARNING, logger='planning.rag'):
        result = NormativeRetriever(env={'SUM_RAG_GENERATION_MODE': 'extractive'}).query(request())
    assert result.retrievalMode == 'lexical-only'
    assert 'reason=not_configured' in caplog.text
    assert any('no configurado' in gap for gap in result.gaps)


def test_unexpected_dependency_error_cannot_inject_a_log_code(caplog):
    class Failure(RuntimeError):
        code = 'unsafe-secret\nFAKE LOG'
    class Repository:
        def search(self, *args, **kwargs):
            raise Failure('unsafe-query-body')
    with caplog.at_level(logging.WARNING, logger='planning.rag'):
        result = NormativeRetriever([synthetic_chunk()], repository=Repository(),
                                    env={'SUM_RAG_GENERATION_MODE': 'extractive'}).query(request())
    assert result.retrievalMode == 'lexical-only'
    assert 'reason=search_failed' in caplog.text
    assert 'unsafe' not in caplog.text
    assert 'FAKE LOG' not in caplog.text


def test_configuration_failure_does_not_leak_provider_exception(monkeypatch, caplog):
    import rag_models
    def fail(_):
        raise ValueError('synthetic-provider-secret')
    monkeypatch.setattr(rag_models, 'create_embeddings', fail)
    with caplog.at_level(logging.WARNING, logger='planning.rag'):
        result = NormativeRetriever(env={'SUM_RAG_DATABASE_URL': 'synthetic-not-connected',
                                        'SUM_RAG_GENERATION_MODE': 'extractive'}).query(request())
    assert result.retrievalMode == 'lexical-only'
    assert 'reason=configuration_failed' in caplog.text
    assert 'synthetic-provider-secret' not in caplog.text
    assert 'synthetic-not-connected' not in str(result.model_dump())


def test_no_ranking_does_not_claim_semantic_retrieval():
    class Repository:
        def search(self, *args, **kwargs):
            pytest.fail('No meaningful query tokens: no semantic request expected')
    result = NormativeRetriever([synthetic_chunk()], repository=Repository(),
                                env={'SUM_RAG_GENERATION_MODE': 'extractive'}).query(
        request().model_copy(update={'question': 'UNMSM FISI'}))
    assert result.citations == []
    assert result.retrievalMode == 'lexical-only'


def test_malformed_vector_document_cannot_claim_successful_semantic_retrieval():
    from langchain_core.documents import Document
    class Repository:
        def search(self, *args, **kwargs):
            return [Document(page_content='synthetic', metadata={'id': ['invalid-unhashable']})]
    result = NormativeRetriever([synthetic_chunk()], repository=Repository(),
                                env={'SUM_RAG_GENERATION_MODE': 'extractive'}).query(request())
    assert result.retrievalMode == 'lexical-only'
    assert [citation.id for citation in result.citations] == ['synthetic']
    assert any('léxica solamente' in gap for gap in result.gaps)
