"""Reviewed public manifests. Only the explicit ingestion CLI may select S3."""
from __future__ import annotations

from datetime import date
import hashlib
import json
import os
from pathlib import Path
import re

SEED = Path(__file__).parent / 'normative-corpus/v1.json'
MAX_BYTES = 4 * 1024 * 1024


def safe_corpus_path(value):
    path = Path(value)
    # Reject both lexical and resolved private paths, before opening anything.
    if 'datos-reales' in path.parts or 'datos-reales' in path.resolve().parts:
        raise ValueError('Private corpus path denied')
    return path


def _bounded(body, maximum):
    try:
        data = body.read(maximum + 1)
        if len(data) > maximum:
            raise ValueError('Corpus size limit exceeded')
        return data
    finally:
        body.close()


def _validate(bundle):
    # Trust is anchored in the reviewed public seed, not in claims inside S3.
    seed = json.loads(SEED.read_text())
    approved = {(c['url'], c['documentSha256']) for c in seed['chunks']}
    approved.update((d['url'], d['sha256']) for d in seed['documents'])
    if not isinstance(bundle, dict) or bundle.get('revision') != 'PA-NORMATIVE-1' or bundle.get('coverage') != 'partial':
        raise ValueError('Unsupported reviewed corpus manifest')
    if not isinstance(bundle.get('documents'), list) or not isinstance(bundle.get('chunks'), list):
        raise ValueError('Invalid corpus lists')
    ids = set()
    for d in bundle['documents']:
        if not isinstance(d, dict) or (d.get('url'), d.get('sha256')) not in approved:
            raise ValueError('Unreviewed document provenance')
        date.fromisoformat(d['reviewedAt'])
    for c in bundle['chunks']:
        if not isinstance(c, dict) or not isinstance(c.get('id'), str) or not c['id'] or c['id'] in ids:
            raise ValueError('Invalid or duplicate article id')
        ids.add(c['id'])
        if (c.get('url'), c.get('documentSha256')) not in approved:
            raise ValueError('Unreviewed public source URL/hash')
        for key in ['documentId', 'title', 'article', 'excerpt']:
            if not isinstance(c.get(key), str) or not c[key]:
                raise ValueError('Invalid article metadata')
        if hashlib.sha256(c['excerpt'].encode()).hexdigest() != c.get('excerptSha256'):
            raise ValueError('Corrupt corpus excerpt hash')
        if type(c.get('page')) is not int or c['page'] < 1 or c.get('sourceClass') != 'normative' or c.get('scope') not in ['UNMSM', 'FISI']:
            raise ValueError('Invalid citation metadata')
        if not all(key in c for key in ['facultyIds', 'periods', 'teacherTypes', 'effectiveFrom', 'effectiveTo']):
            raise ValueError('Missing applicability metadata')
        for key in ['facultyIds', 'periods', 'teacherTypes', 'related', 'conflictsWith']:
            value = c.get(key, [])
            if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
                raise ValueError('Invalid applicability metadata')
        for key in ['reviewedAt', 'publishedAt', 'effectiveFrom', 'effectiveTo']:
            value = c.get(key)
            if value is not None:
                if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
                    raise ValueError('Invalid corpus date')
                date.fromisoformat(value)
        if not c.get('reviewedAt') or not c.get('facultyIds') or not c.get('teacherTypes'):
            raise ValueError('Missing review/applicability metadata')
    return bundle


def load_corpus(env=None, *, s3_client=None):
    env = os.environ if env is None else env
    maximum = int(env.get('SUM_RAG_MAX_CORPUS_BYTES', MAX_BYTES))
    if not 0 < maximum <= MAX_BYTES:
        raise ValueError('Invalid corpus size limit')
    source = env.get('SUM_RAG_SOURCE', 'local')
    if source == 'local':
        path = safe_corpus_path(env.get('SUM_RAG_CORPUS_PATH', SEED))
        data = _bounded(path.open('rb'), maximum)
    elif source == 's3':
        bucket, key = env.get('SUM_RAG_S3_BUCKET'), env.get('SUM_RAG_S3_KEY')
        if not bucket or not key:
            raise ValueError('S3 requires explicit bucket and key')
        if s3_client is None:
            import boto3
            from botocore.config import Config
            s3_client = boto3.client('s3', config=Config(connect_timeout=5, read_timeout=10, retries={'total_max_attempts': 2, 'mode': 'standard'}))
        args = {'Bucket': bucket, 'Key': key}
        if env.get('SUM_RAG_S3_VERSION_ID'):
            args['VersionId'] = env['SUM_RAG_S3_VERSION_ID']
        response = s3_client.get_object(**args)
        data = _bounded(response['Body'], maximum)
        expected = env.get('SUM_RAG_S3_SHA256')
        if expected and hashlib.sha256(data).hexdigest() != expected:
            raise ValueError('S3 manifest hash mismatch')
    else:
        raise ValueError('Unsupported corpus source')
    return _validate(json.loads(data))


def corpus_fingerprint(bundle: dict) -> str:
    return hashlib.sha256(json.dumps(bundle, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False).encode()).hexdigest()
