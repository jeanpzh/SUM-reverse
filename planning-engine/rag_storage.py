"""Official LangChain pgvector adapter; search is read-only, index is explicit."""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
from uuid import NAMESPACE_URL, uuid5


class VectorRepositoryError(RuntimeError):
    """Safe operational failure; never includes a DSN or driver exception."""

    def __init__(self, message, *, code='search_failed'):
        super().__init__(message)
        self.code = code if code in {'index_missing', 'index_mismatch', 'search_failed', 'ingestion_failed'} else 'search_failed'



def create_vector_repository(embeddings, env=None, *, corpus_fingerprint: str):
    env = os.environ if env is None else env
    if env.get('SUM_RAG_VECTOR_BACKEND', 'pgvector') != 'pgvector':
        raise ValueError('Unsupported vector backend; inject a repository for tests')
    if not env.get('SUM_RAG_DATABASE_URL'):
        raise ValueError('SUM_RAG_DATABASE_URL is required for pgvector')
    prefix = env.get('SUM_RAG_COLLECTION', 'sum_rag')
    if not re.fullmatch(r'[a-z][a-z0-9_]{0,21}', prefix):
        raise ValueError('SUM_RAG_COLLECTION must be a safe lowercase prefix (max 22)')
    if not re.fullmatch(r'[0-9a-f]{64}', corpus_fingerprint):
        raise ValueError('Invalid corpus fingerprint')
    from rag_models import embedding_profile
    profile = embedding_profile(env)
    return PGVectorRepository(embeddings, env['SUM_RAG_DATABASE_URL'], prefix, profile, corpus_fingerprint)


class PGVectorRepository:
    def __init__(self, embeddings, url, prefix, profile, fingerprint):
        if set(profile) != {'provider', 'model', 'dimensions'} or not all(isinstance(profile[k], str) and profile[k] for k in ['provider', 'model']) or type(profile['dimensions']) is not int or profile['dimensions'] < 1:
            raise ValueError('Invalid embedding profile')
        self.profile = dict(profile)
        self.identity = json.dumps({'profile': self.profile, 'corpus': fingerprint}, sort_keys=True, separators=(',', ':'))
        self.namespace = prefix + '_' + hashlib.sha256(self.identity.encode()).hexdigest()[:40]
        self._url = url
        self._embeddings = embeddings
        self._engine = None
        self._store = None

    def _connection(self):
        import psycopg
        from sqlalchemy.engine import make_url
        url = make_url(self._url).set(drivername='postgresql')
        return psycopg.connect(dbname=url.database, user=url.username, password=url.password,
                               host=url.host, port=url.port, **dict(url.query), connect_timeout=5)

    def _existing(self, conn):
        row = conn.execute('SELECT obj_description(c.oid), a.atttypmod FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = %s WHERE n.nspname = %s AND c.relname = %s', ('embedding', 'public', self.namespace)).fetchone()
        if row is None:
            return False
        if row != (self.identity, self.profile['dimensions']):
            raise VectorRepositoryError('Index identity/dimension mismatch; explicit reindex to a new namespace required', code='index_mismatch')
        return True

    def _vectorstore(self):
        if self._store is None:
            from langchain_postgres import PGEngine, PGVectorStore
            from langchain_core.embeddings import Embeddings
            owner = self
            class CheckedEmbeddings(Embeddings):
                def embed_documents(self, texts):
                    vectors = owner._embeddings.embed_documents(texts)
                    if len(vectors) != len(texts):
                        raise ValueError('Incomplete embeddings')
                    return [self.check(v) for v in vectors]

                def embed_query(self, text):
                    return self.check(owner._embeddings.embed_query(text))

                def check(self, vector):
                    if len(vector) != owner.profile['dimensions'] or not all(math.isfinite(float(v)) for v in vector):
                        raise ValueError('Embedding dimension/profile mismatch or nonfinite vector')
                    return vector
            if self._engine is None:
                self._engine = PGEngine.from_connection_string(url=self._url)
            self._store = PGVectorStore.create_sync(engine=self._engine, table_name=self.namespace, embedding_service=CheckedEmbeddings())
        return self._store

    def search(self, query, eligible_ids, k=8):
        if type(k) is not int or k < 1 or k > 1000:
            raise ValueError('Invalid search k')
        if not eligible_ids:
            return []
        if not all(isinstance(v, str) and v for v in eligible_ids):
            raise ValueError('Invalid eligible article ids')
        try:
            with self._connection() as conn:
                if not self._existing(conn):
                    raise VectorRepositoryError('Index not initialized; run explicit ingestion', code='index_missing')
            # PGVectorStore compiles this into SQL WHERE before ORDER BY/LIMIT.
            rows = self._vectorstore().similarity_search_with_relevance_scores(query, k=k, filter={'id': {'$in': eligible_ids}})
            return [doc.model_copy(update={'metadata': doc.metadata | {'_rag_similarity': score}})
                    for doc, score in rows]
        except VectorRepositoryError:
            raise
        except Exception:
            raise VectorRepositoryError('Vector search unavailable or embedding profile invalid') from None

    def index(self, documents):
        ids = [d.metadata.get('id') for d in documents]
        if not all(isinstance(v, str) and v for v in ids) or len(ids) != len(set(ids)):
            raise ValueError('Index requires unique stable metadata.id')
        if not documents:
            return 0
        try:
            import psycopg.sql as sql
            from langchain_postgres import PGEngine
            # Session lock serializes explicit initializations; no drop/overwrite.
            with self._connection() as conn:
                lock = int.from_bytes(hashlib.sha256(self.namespace.encode()).digest()[:8], 'big', signed=True)
                conn.execute('SELECT pg_advisory_lock(%s)', (lock,))
                try:
                    if not self._existing(conn):
                        if self._engine is None:
                            self._engine = PGEngine.from_connection_string(url=self._url)
                        self._engine.init_vectorstore_table(table_name=self.namespace, vector_size=self.profile['dimensions'], overwrite_existing=False)
                        conn.execute(sql.SQL('COMMENT ON TABLE {} IS {}').format(sql.Identifier(self.namespace), sql.Literal(self.identity)))
                        conn.commit()
                    self._vectorstore().add_documents(documents, ids=[str(uuid5(NAMESPACE_URL, self.namespace + '/' + v)) for v in ids])
                finally:
                    conn.execute('SELECT pg_advisory_unlock(%s)', (lock,))
            return len(documents)
        except VectorRepositoryError:
            raise
        except Exception:
            raise VectorRepositoryError('Vector ingestion failed; check database grants and embedding profile', code='ingestion_failed') from None
