"""Independently synthetic keys only; SDK signing stops before network I/O."""
import os
import io
import json

import pytest

from bedrock_credentials import BedrockCredentialError, resolve_bedrock_bearer
from rag_models import create_chat_model, create_embeddings


def test_explicit_token_precedes_file_and_never_mutates_environment(tmp_path):
    env = {'AWS_BEARER_TOKEN_BEDROCK': '  synthetic-direct-token  ',
           'AWS_BEARER_TOKEN_BEDROCK_FILE': str(tmp_path / 'not-read')}
    before = dict(os.environ)
    assert resolve_bedrock_bearer(env) == 'synthetic-direct-token'
    assert env['AWS_BEARER_TOKEN_BEDROCK'] == '  synthetic-direct-token  '
    assert dict(os.environ) == before
    assert resolve_bedrock_bearer({}) is None


@pytest.mark.parametrize('contents', ['', ' \n ', 'synthetic\nheader', '\u0000', 'x' * 16385])
def test_invalid_file_has_safe_error(tmp_path, contents):
    secret = tmp_path / 'synthetic-secret-file'
    secret.write_text(contents)
    with pytest.raises(BedrockCredentialError) as caught:
        resolve_bedrock_bearer({'AWS_BEARER_TOKEN_BEDROCK_FILE': str(secret)})
    assert str(secret) not in str(caught.value)
    if contents.strip():
        assert contents not in str(caught.value)


def test_unreadable_file_has_safe_error(tmp_path):
    path = tmp_path / 'nonexistent-synthetic-key'
    with pytest.raises(BedrockCredentialError, match='file could not be read') as caught:
        resolve_bedrock_bearer({'AWS_BEARER_TOKEN_BEDROCK_FILE': str(path)})
    assert str(path) not in str(caught.value)
    assert caught.value.__suppress_context__ is True


def test_chat_uses_same_trimmed_secret_file(monkeypatch, tmp_path):
    import langchain.chat_models
    secret = tmp_path / 'synthetic-key'
    secret.write_text('  synthetic-chat-token\n')
    captured = {}
    monkeypatch.setattr(langchain.chat_models, 'init_chat_model',
                        lambda model, **kwargs: captured.update(kwargs) or object())
    before = dict(os.environ)
    create_chat_model({'AWS_BEARER_TOKEN_BEDROCK_FILE': str(secret)})
    assert captured['api_key'] == 'synthetic-chat-token'
    assert captured['config'].read_timeout == 8
    assert captured['max_tokens'] == 1024
    assert dict(os.environ) == before


def test_iam_embedding_path_keeps_default_credential_resolution(monkeypatch):
    import langchain_aws
    import rag_models
    captured = {}
    monkeypatch.setattr(langchain_aws, 'BedrockEmbeddings', lambda **kwargs: captured.update(kwargs))
    monkeypatch.setattr(rag_models, 'create_bearer_embedding_client',
                        lambda *args, **kwargs: pytest.fail('Bearer client constructed on IAM path'))
    create_embeddings({})
    assert 'client' not in captured
    assert captured['region_name'] == 'us-east-1'
    assert captured['model_kwargs'] == {'dimensions': 1024, 'normalize': True}
    assert captured['config'].retries == {'max_attempts': 0}


@pytest.mark.parametrize('source', ['file', 'direct'])
def test_synthetic_token_reaches_real_invoke_model_bearer_signer(monkeypatch, tmp_path, source):
    import botocore.session
    import botocore.endpoint
    from botocore.awsrequest import AWSResponse

    # Isolate SDK configuration/credential discovery, not the real signer.
    monkeypatch.setenv('AWS_CONFIG_FILE', str(tmp_path / 'absent-config'))
    monkeypatch.setenv('AWS_SHARED_CREDENTIALS_FILE', str(tmp_path / 'absent-credentials'))
    monkeypatch.setenv('AWS_EC2_METADATA_DISABLED', 'true')
    monkeypatch.setenv('AWS_IGNORE_CONFIGURED_ENDPOINT_URLS', 'true')
    monkeypatch.setenv('AWS_BEARER_TOKEN_BEDROCK', 'synthetic-ambient-must-not-win')
    monkeypatch.delenv('AWS_PROFILE', raising=False)
    monkeypatch.delenv('AWS_DEFAULT_PROFILE', raising=False)
    monkeypatch.setattr(botocore.session.Session, 'get_credentials', lambda self: None)
    monkeypatch.setattr(botocore.endpoint.Endpoint, '_send',
                        lambda *args, **kwargs: pytest.fail('Network I/O attempted'))

    secret = tmp_path / 'synthetic-bearer'
    secret.write_text('  synthetic-file-token\n')
    env = {'AWS_REGION': 'us-east-1', 'AWS_BEARER_TOKEN_BEDROCK_FILE': str(secret)}
    expected = 'synthetic-file-token'
    if source == 'direct':
        env['AWS_BEARER_TOKEN_BEDROCK'] = 'synthetic-explicit-token'
        expected = 'synthetic-explicit-token'
    before = dict(os.environ)
    embeddings = create_embeddings(env)
    captured = {}

    class SyntheticResponse(io.BytesIO):
        def stream(self, amt=None, decode_content=False):
            yield self.read()

    def before_send(request, **kwargs):
        captured['authorization'] = request.headers['Authorization']
        body = json.dumps({'embedding': [1.] + [0.] * 1023, 'inputTextTokenCount': 5}).encode()
        return AWSResponse(request.url, 200, {'content-type': 'application/json'}, SyntheticResponse(body))

    embeddings.client.meta.events.register('before-send.bedrock-runtime.InvokeModel', before_send)
    vector = embeddings.embed_query('Independently synthetic test question')
    assert vector == [1.] + [0.] * 1023
    assert captured['authorization'] == f'Bearer {expected}'.encode()
    assert dict(os.environ) == before


def test_client_construction_failure_never_exposes_upstream_secret(monkeypatch):
    import langchain_aws.utils
    from bedrock_credentials import create_bearer_embedding_client
    from botocore.config import Config

    def fail(**kwargs):
        raise RuntimeError('synthetic-secret-value /synthetic/private/key')

    monkeypatch.setattr(langchain_aws.utils, 'create_aws_client', fail)
    with pytest.raises(BedrockCredentialError) as caught:
        create_bearer_embedding_client('synthetic-secret-value', region_name='us-east-1', config=Config())
    assert 'synthetic-secret-value' not in str(caught.value)
    assert '/synthetic/private/key' not in str(caught.value)
    assert caught.value.__suppress_context__ is True
