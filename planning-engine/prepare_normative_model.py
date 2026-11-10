"""Explicit one-time public download. Run with a clean environment (README)."""
import json
from fastembed import TextEmbedding
from normative import CACHE, MODEL

if (CACHE / 'prepared.json').exists():
    raise SystemExit('Already prepared; no download attempted')
model = TextEmbedding(model_name=MODEL, cache_dir=str(CACHE), threads=2)
vectors = list(model.embed(['carga lectiva', 'teaching workload']))
assert all(len(v) == 384 for v in vectors)
(CACHE / 'prepared.json').write_text(json.dumps({'model': MODEL, 'dimensions': 384}))
print('Prepared public multilingual model; 384 dimensions; no identities or operator configuration.')
