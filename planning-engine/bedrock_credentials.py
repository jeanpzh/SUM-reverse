"""Runtime-only Bedrock credentials; never mutate the process environment."""
from pathlib import Path
import re


class BedrockCredentialError(ValueError):
    """Safe configuration error without credential values or file paths."""


def resolve_bedrock_bearer(env):
    """An explicit bearer takes precedence over the operator's secret file."""
    token = env.get('AWS_BEARER_TOKEN_BEDROCK')
    if not token and env.get('AWS_BEARER_TOKEN_BEDROCK_FILE'):
        try:
            with Path(env['AWS_BEARER_TOKEN_BEDROCK_FILE']).open(encoding='utf-8') as source:
                token = source.read(16385)
        except (OSError, UnicodeError, ValueError):
            raise BedrockCredentialError('Bedrock API key file could not be read') from None
        if not token:
            raise BedrockCredentialError('Bedrock API key file is empty')
    if token is None or token == '':
        return None
    token = token.strip()
    if not token or len(token) > 16384 or not re.fullmatch(r'[A-Za-z0-9._~+/-]+=*', token):
        raise BedrockCredentialError('Bedrock API key is invalid')
    return token


def create_bearer_embedding_client(token, *, region_name, config):
    """Use LangChain's per-client SDK token provider, also used by Converse."""
    from langchain_aws.utils import create_aws_client
    from pydantic import SecretStr
    try:
        return create_aws_client(service_name='bedrock-runtime', region_name=region_name,
                                 config=config, api_key=SecretStr(token))
    except Exception:
        # SDK/driver errors may include credentials, request bodies or local paths.
        raise BedrockCredentialError('Bedrock embedding client could not be configured') from None
