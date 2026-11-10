"""Central runtime factories. Never load dotenv or discover services."""
import os
import math
from langchain_core.embeddings import Embeddings

def create_chat_model(env=None):
    """Use operator process configuration only; never load dotenv or discover services."""
    from langchain.chat_models import init_chat_model
    env = os.environ if env is None else env
    provider = env.get('SUM_LLM_PROVIDER', 'bedrock_converse').strip().lower()
    provider = {'bedrock': 'bedrock_converse'}.get(provider, provider)
    if provider in ('', 'disabled'):
        return None, None
    if provider not in ('bedrock_converse', 'ollama', 'openai'):
        raise ValueError('Unsupported chat provider')
    defaults = {'bedrock_converse': 'us.amazon.nova-lite-v1:0', 'ollama': 'llama3.1:8b', 'openai': 'llama-3.3-70b-versatile'}
    model = env.get('SUM_LLM_MODEL') or env.get('SUM_BEDROCK_MODEL') or defaults[provider]
    kwargs = {'temperature': 0.1}
    if provider == 'bedrock_converse':
        # boto SDK consumes operator-provided bearer/IAM configuration in the service process.
        from botocore.config import Config
        kwargs.update(region_name=env.get('AWS_REGION', 'us-east-1'), max_tokens=1024,
                      config=Config(connect_timeout=2, read_timeout=8, retries={'max_attempts': 0}))
        bearer = env.get('AWS_BEARER_TOKEN_BEDROCK')
        if not bearer and env.get('AWS_BEARER_TOKEN_BEDROCK_FILE'):
            # Runtime-only operator configuration; never loaded by tests or at import time.
            from pathlib import Path
            bearer = Path(env['AWS_BEARER_TOKEN_BEDROCK_FILE']).read_text().strip()
        if bearer:
            kwargs['api_key'] = bearer
        for key in ('AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN'):
            if env.get(key):
                kwargs[key.lower()] = env[key]
    elif provider == 'ollama':
        kwargs.update(base_url=env.get('SUM_LLM_BASE_URL', 'http://127.0.0.1:11434'), num_predict=1024)
    else:
        if not env.get('SUM_LLM_API_KEY'):
            return None, None
        kwargs.update(api_key=env['SUM_LLM_API_KEY'], max_tokens=1024, max_retries=0, timeout=8)
        if env.get('SUM_LLM_BASE_URL'):
            kwargs['base_url'] = env['SUM_LLM_BASE_URL']
    return init_chat_model(model, model_provider=provider, **kwargs), f'{provider} / {model}'


FASTEMBED_MODEL = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
FASTEMBED_CACHE = '/tmp/pa-normative-model'


def embedding_profile(env=None):
    env = os.environ if env is None else env
    provider = env.get('SUM_RAG_EMBEDDING_PROVIDER', 'bedrock').strip().lower()
    provider = {'bedrock_converse': 'bedrock'}.get(provider, provider)
    defaults = {
        'bedrock': ('amazon.titan-embed-text-v2:0', 1024),
        'ollama': ('nomic-embed-text', 768),
        'openai': ('text-embedding-3-small', 1536),
        'fastembed': (FASTEMBED_MODEL, 384),
    }
    if provider not in defaults:
        raise ValueError('Unsupported embedding provider')
    model, dimensions = defaults[provider]
    model = env.get('SUM_RAG_EMBEDDING_MODEL', model).strip()
    dimensions = int(env.get('SUM_RAG_EMBEDDING_DIMENSIONS', dimensions))
    if not model or not 1 <= dimensions <= 65536:
        raise ValueError('Invalid embedding identity')
    if provider == 'bedrock' and model == 'amazon.titan-embed-text-v2:0' and dimensions not in (256, 512, 1024):
        raise ValueError('Unsupported Titan V2 dimensions')
    if provider == 'fastembed' and (model != FASTEMBED_MODEL or dimensions != 384):
        raise ValueError('Only explicitly prepared FastEmbed profile supported')
    return dict(provider=provider, model=model, dimensions=dimensions)


class CallableEmbeddings(Embeddings):
    """Compatibility adapter for the existing callable test seam."""
    def __init__(self, embedder):
        self.embedder = embedder

    def _embed(self, texts):
        vectors = [list(map(float, row)) for row in self.embedder(texts)]
        if len(vectors) != len(texts) or not vectors or not vectors[0]:
            raise ValueError('Incomplete embeddings')
        if any(len(row) != len(vectors[0]) or not all(math.isfinite(x) for x in row) for row in vectors):
            raise ValueError('Invalid embeddings')
        return vectors

    def embed_documents(self, texts):
        return self._embed(texts)

    def embed_query(self, text):
        return self._embed([text])[0]


def create_embeddings(env=None):
    env = os.environ if env is None else env
    profile = embedding_profile(env)
    provider, model, dimensions = (profile[k] for k in ('provider', 'model', 'dimensions'))
    if provider == 'bedrock':
        from langchain_aws import BedrockEmbeddings
        from botocore.config import Config
        return BedrockEmbeddings(
            model_id=model, region_name=env.get('AWS_REGION', 'us-east-1'),
            model_kwargs={'dimensions': dimensions, 'normalize': True},
            config=Config(connect_timeout=2, read_timeout=8, retries={'max_attempts': 0}),
        )
    if provider == 'ollama':
        from langchain_ollama import OllamaEmbeddings
        return OllamaEmbeddings(model=model, base_url=env.get('SUM_RAG_EMBEDDING_BASE_URL', 'http://127.0.0.1:11434'),
                                dimensions=dimensions, client_kwargs={'timeout': 8})
    if provider == 'openai':
        from langchain_openai import OpenAIEmbeddings
        kwargs = dict(model=model, dimensions=dimensions, max_retries=0, request_timeout=8)
        if env.get('SUM_RAG_EMBEDDING_API_KEY'):
            kwargs['api_key'] = env['SUM_RAG_EMBEDDING_API_KEY']
        if env.get('SUM_RAG_EMBEDDING_BASE_URL'):
            kwargs['base_url'] = env['SUM_RAG_EMBEDDING_BASE_URL']
        return OpenAIEmbeddings(**kwargs)
    from pathlib import Path
    if not (Path(FASTEMBED_CACHE) / 'prepared.json').is_file():
        raise ValueError('FastEmbed model not explicitly prepared')
    # Community FastEmbedEmbeddings 0.4.2 drops local_files_only. Use the
    # actual LangChain Embeddings adapter with FastEmbed's enforced offline flag.
    from fastembed import TextEmbedding
    local = TextEmbedding(model_name=model, cache_dir=FASTEMBED_CACHE,
                          local_files_only=True, threads=2)
    return CallableEmbeddings(lambda texts: [v.tolist() for v in local.embed(texts)])
