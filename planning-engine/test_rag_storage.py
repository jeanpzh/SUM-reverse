import pytest
from langchain_core.embeddings import DeterministicFakeEmbedding
from rag_storage import create_vector_repository


def test_pgvector_requires_database_and_never_falls_back():
    with pytest.raises(ValueError, match='SUM_RAG_DATABASE_URL'):
        create_vector_repository(DeterministicFakeEmbedding(size=3), {}, corpus_fingerprint='a' * 64)


def test_collection_and_fingerprint_fail_before_network():
    for updates, fingerprint in [({'SUM_RAG_COLLECTION': 'x; DROP TABLE x'}, 'a' * 64), ({}, 'invalid')]:
        with pytest.raises(ValueError):
            create_vector_repository(DeterministicFakeEmbedding(size=3), {'SUM_RAG_DATABASE_URL': 'postgresql://unused', **updates}, corpus_fingerprint=fingerprint)
