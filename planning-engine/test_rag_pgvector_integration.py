"""Opt-in: own loopback Docker only, independent synthetic data/public seed."""
import os
from uuid import uuid4

import pytest
from langchain_core.documents import Document
from langchain_core.embeddings import DeterministicFakeEmbedding

from rag_sources import load_corpus, corpus_fingerprint
from rag_storage import PGVectorRepository, VectorRepositoryError, create_vector_repository

DSN = 'postgresql+psycopg://rag_test:rag_test_only@127.0.0.1:55432/rag_test'
pytestmark = pytest.mark.skipif(os.environ.get('SUM_RAG_RUN_OWN_PGVECTOR') != '1', reason='requires own synthetic Docker container')


def test_persistence_idempotency_sql_prefilter_and_profile_isolation():
    prefix = 'btest_' + uuid4().hex[:10]
    profile = {'provider': 'synthetic', 'model': 'langchain-deterministic-test', 'dimensions': 3}
    embeddings = DeterministicFakeEmbedding(size=3)
    def repo(p=profile, fingerprint='a' * 64):
        return PGVectorRepository(embeddings, DSN, prefix, p, fingerprint)
    first = repo()
    with pytest.raises(VectorRepositoryError, match='not initialized'):
        first.search('same query', ['eligible'])
    # Ten identical nearest out-of-scope records must not displace eligible top-1.
    documents = [Document(page_content='same query', metadata={'id': f'excluded-{i}'}) for i in range(10)]
    documents.append(Document(page_content='different applicable text', metadata={'id': 'eligible'}))
    assert first.index(documents) == 11
    assert first.index(documents) == 11
    recreated = repo()
    assert [d.metadata['id'] for d in recreated.search('same query', ['eligible'], k=1)] == ['eligible']
    assert len(recreated.search('same query', [d.metadata['id'] for d in documents], k=30)) == 11
    assert recreated.search('same query', [], k=1) == []
    for changed in [repo({**profile, 'model': 'other-same-dim'}), repo({**profile, 'dimensions': 4}), repo(fingerprint='b' * 64)]:
        assert changed.namespace != first.namespace
        with pytest.raises(VectorRepositoryError, match='not initialized'):
            changed.search('query', ['eligible'])
    wrong_vectors = PGVectorRepository(DeterministicFakeEmbedding(size=2), DSN, prefix, profile, 'a' * 64)
    with pytest.raises(VectorRepositoryError, match='profile invalid'):
        wrong_vectors.search('query', ['eligible'])
    with pytest.raises(VectorRepositoryError, match='profile'):
        wrong_vectors.index([documents[-1]])
    # Existing tables with wrong identity/dimension must be rejected, never overwritten.
    forged = repo()
    forged.namespace = first.namespace
    forged.identity = 'different-profile'
    with pytest.raises(VectorRepositoryError, match='mismatch'):
        forged.search('query', ['eligible'])
    with pytest.raises(VectorRepositoryError, match='mismatch'):
        forged.index([documents[-1]])


def test_public_seed_with_real_local_langchain_embeddings_and_readonly_query():
    from rag_models import create_embeddings
    env = {'SUM_RAG_DATABASE_URL': DSN, 'SUM_RAG_COLLECTION': 'bpublic_' + uuid4().hex[:8], 'SUM_RAG_EMBEDDING_PROVIDER': 'fastembed'}
    bundle = load_corpus({})
    fingerprint = corpus_fingerprint(bundle)
    documents = [Document(id=c['id'], page_content=c['excerpt'], metadata=c) for c in bundle['chunks']]
    first = create_vector_repository(create_embeddings(env), env, corpus_fingerprint=fingerprint)
    assert first.index(documents) == len(documents)
    assert first.index(documents) == len(documents)
    # Run all retrieval under a DB-enforced read-only transaction default.
    readonly = {**env, 'SUM_RAG_DATABASE_URL': DSN + '?options=-c%20default_transaction_read_only%3Don'}
    second = create_vector_repository(create_embeddings(env), readonly, corpus_fingerprint=fingerprint)
    result = second.search('máximo horas lectivas', ['art-7'], k=1)
    assert result[0].metadata['id'] == 'art-7'
    assert result[0].page_content == next(c['excerpt'] for c in bundle['chunks'] if c['id'] == 'art-7')
    assert result[0].metadata['documentSha256']
