"""Explicit public corpus ingestion. Not called from a request or startup hook."""
from __future__ import annotations

import argparse
import json
import os
import sys

from rag_sources import load_corpus, corpus_fingerprint, safe_corpus_path


def ingest(env=None):
    from langchain_core.documents import Document
    from rag_models import create_embeddings, embedding_profile
    from rag_storage import create_vector_repository
    env = os.environ if env is None else env
    bundle = load_corpus(env)
    fingerprint = corpus_fingerprint(bundle)
    profile = embedding_profile(env)
    documents = [Document(id=c['id'], page_content=c['excerpt'], metadata=c) for c in bundle['chunks']]
    repository = create_vector_repository(create_embeddings(env), env, corpus_fingerprint=fingerprint)
    count = repository.index(documents)
    return {'profile': profile, 'namespace': repository.namespace, 'corpusFingerprint': fingerprint, 'count': count}


def main(argv=None, *, env=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', help='Validate and exclusively create a local canonical snapshot, without embeddings/DB')
    args = parser.parse_args(argv)
    env = dict(os.environ if env is None else env)
    try:
        if args.snapshot:
            bundle = load_corpus(env)
            path = safe_corpus_path(args.snapshot)
            with path.open('x', encoding='utf-8') as output:
                json.dump(bundle, output, ensure_ascii=False, indent=2)
                output.write('\n')
            result = {'corpusFingerprint': corpus_fingerprint(bundle), 'count': len(bundle['chunks']), 'snapshotCreated': True}
        else:
            result = ingest(env)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception:
        # Driver/provider errors can contain DSNs, keys or request bodies.
        print('Corpus operation failed; verify reviewed source, profile, database grants and explicit configuration.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
