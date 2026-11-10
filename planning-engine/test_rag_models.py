"""Factory seams: independent synthetic configuration, no SDK/network invocation."""
import pytest
from langchain_core.embeddings import Embeddings
from rag_models import create_chat_model, create_embeddings, embedding_profile, CallableEmbeddings


def test_default_and_independent_profiles(monkeypatch):
    import langchain.chat_models
    captured = {}
    def factory(model, **kwargs):
        captured.update(model=model, **kwargs)
        return object()
    monkeypatch.setattr(langchain.chat_models, 'init_chat_model', factory)
    model, label = create_chat_model({})
    assert model is not None
    assert captured['model_provider'] == 'bedrock_converse'
    assert 'nova-lite' in label
    assert embedding_profile({}) == dict(provider='bedrock', model='amazon.titan-embed-text-v2:0', dimensions=1024)
    assert embedding_profile({'SUM_LLM_PROVIDER': 'ollama'}) == embedding_profile({})
    assert create_chat_model({'SUM_LLM_PROVIDER': 'disabled'}) == (None, None)


def test_embedding_adapter_and_identity_validation():
    adapter = CallableEmbeddings(lambda texts: [[1., 0.] for _ in texts])
    assert isinstance(adapter, Embeddings)
    assert adapter.embed_query('synthetic') == [1., 0.]
    for dims in ('0', '384', 'invalid'):
        with pytest.raises(ValueError):
            embedding_profile({'SUM_RAG_EMBEDDING_DIMENSIONS': dims})
    with pytest.raises(ValueError):
        create_embeddings({'SUM_RAG_EMBEDDING_PROVIDER': 'unknown'})


def test_official_embedding_integrations_receive_independent_profile(monkeypatch):
    import langchain_aws
    import langchain_ollama
    import langchain_openai
    calls = []
    for module, name in [(langchain_aws, 'BedrockEmbeddings'), (langchain_ollama, 'OllamaEmbeddings'),
                         (langchain_openai, 'OpenAIEmbeddings')]:
        monkeypatch.setattr(module, name, lambda **kw: calls.append(kw) or CallableEmbeddings(lambda texts: [[1.] for _ in texts]))
    assert isinstance(create_embeddings({}), Embeddings)
    assert calls[-1]['model_id'] == 'amazon.titan-embed-text-v2:0'
    assert calls[-1]['model_kwargs']['dimensions'] == 1024
    create_embeddings({'SUM_RAG_EMBEDDING_PROVIDER': 'ollama', 'SUM_LLM_PROVIDER': 'openai'})
    assert calls[-1]['model'] == 'nomic-embed-text'
    assert calls[-1]['dimensions'] == 768
    create_embeddings({'SUM_RAG_EMBEDDING_PROVIDER': 'openai', 'SUM_RAG_EMBEDDING_DIMENSIONS': '512'})
    assert calls[-1]['dimensions'] == 512


def test_fastembed_factory_enforces_offline_construction(monkeypatch):
    from pathlib import Path
    import fastembed
    captured = {}
    class Local:
        def __init__(self, **kwargs):
            captured.update(kwargs)
        def embed(self, texts):
            import numpy as np
            return [np.array([1., 0.]) for _ in texts]
    # No actual cache or downloaded artifact is read by this synthetic test.
    monkeypatch.setattr(Path, 'is_file', lambda _: True)
    monkeypatch.setattr(fastembed, 'TextEmbedding', Local)
    adapter = create_embeddings({'SUM_RAG_EMBEDDING_PROVIDER': 'fastembed'})
    assert isinstance(adapter, Embeddings)
    assert captured['local_files_only'] is True
    assert adapter.embed_query('synthetic') == [1., 0.]
