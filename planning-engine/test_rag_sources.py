"""Public seed only; S3 is a fake exact-object seam, never a live service."""
import copy
import hashlib
import io
import json

import pytest

from rag_sources import load_corpus, corpus_fingerprint


def test_local_bundle_is_stable_and_retains_public_provenance():
    bundle = load_corpus({})
    assert len(bundle['chunks']) > 8
    assert corpus_fingerprint(bundle) == corpus_fingerprint(json.loads(json.dumps(bundle, sort_keys=True)))
    changed = copy.deepcopy(bundle)
    changed['coverage'] = 'changed'
    assert corpus_fingerprint(bundle) != corpus_fingerprint(changed)


def test_exact_s3_version_bounded_read_and_hash():
    bundle = load_corpus({})
    data = json.dumps(bundle).encode()
    class S3:
        def get_object(self, **kwargs):
            assert kwargs == {'Bucket': 'synthetic-public-seed', 'Key': 'reviewed.json', 'VersionId': 'v1'}
            self.body = io.BytesIO(data)
            return {'Body': self.body, 'ContentLength': len(data)}
    s3 = S3()
    env = {'SUM_RAG_SOURCE': 's3', 'SUM_RAG_S3_BUCKET': 'synthetic-public-seed', 'SUM_RAG_S3_KEY': 'reviewed.json', 'SUM_RAG_S3_VERSION_ID': 'v1', 'SUM_RAG_S3_SHA256': hashlib.sha256(data).hexdigest()}
    assert load_corpus(env, s3_client=s3) == bundle
    assert s3.body.closed
    with pytest.raises(ValueError, match='hash'):
        load_corpus({**env, 'SUM_RAG_S3_SHA256': '0' * 64}, s3_client=s3)
    with pytest.raises(ValueError, match='size'):
        load_corpus({**env, 'SUM_RAG_MAX_CORPUS_BYTES': '10'}, s3_client=s3)


def test_rejects_corrupt_excerpt_unknown_source_and_private_path(tmp_path):
    bundle = load_corpus({})
    for field, value in [('excerpt', 'tampered'), ('url', 'https://example.com/private.pdf'), ('page', 0)]:
        bad = copy.deepcopy(bundle)
        bad['chunks'][0][field] = value
        path = tmp_path / 'reviewed.json'
        path.write_text(json.dumps(bad))
        with pytest.raises(ValueError):
            load_corpus({'SUM_RAG_CORPUS_PATH': str(path)})
    with pytest.raises(ValueError, match='denied'):
        load_corpus({'SUM_RAG_CORPUS_PATH': '/datos-reales/not-opened.json'})


def test_cli_snapshot_matches_fingerprint_and_never_overwrites(tmp_path, capsys):
    from rag_ingest import main
    path = tmp_path / 'snapshot.json'
    assert main(['--snapshot', str(path)], env={}) == 0
    assert corpus_fingerprint(load_corpus({'SUM_RAG_CORPUS_PATH': str(path)})) == corpus_fingerprint(load_corpus({}))
    assert main(['--snapshot', str(path)], env={}) == 1
    assert main(['--snapshot', '/datos-reales/denied.json'], env={}) == 1
    assert 'denied.json' not in capsys.readouterr().err


def test_missing_applicability_metadata_is_rejected(tmp_path):
    bundle = load_corpus({})
    del bundle['chunks'][0]['periods']
    path = tmp_path / 'missing-periods.json'
    path.write_text(json.dumps(bundle))
    with pytest.raises(ValueError, match='applicability'):
        load_corpus({'SUM_RAG_CORPUS_PATH': str(path)})
