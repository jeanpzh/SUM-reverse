"""Bounded live embedding check. Never print exception strings or credential paths."""
import json
import re
from rag_models import create_embeddings

try:
    vectors = create_embeddings().embed_query('Consulta sintética: carga lectiva docente')
    print(json.dumps({'embeddings': 'ok', 'dimensions': len(vectors)}))
except Exception as error:
    code = 'provider_error'
    from bedrock_credentials import BedrockCredentialError
    if isinstance(error, BedrockCredentialError):
        code = {
            'Bedrock API key file could not be read': 'credential_file_unreadable',
            'Bedrock API key file is empty': 'credential_file_empty',
            'Bedrock API key is invalid': 'credential_invalid',
            'Bedrock embedding client could not be configured': 'client_configuration_failed',
        }.get(str(error), 'credential_configuration_failed')
    current = error
    while current:
        response = getattr(current, 'response', None)
        candidate = response.get('Error', {}).get('Code') if isinstance(response, dict) else None
        if candidate in {'AccessDeniedException', 'ExpiredTokenException', 'ValidationException', 'ThrottlingException', 'UnrecognizedClientException', 'ResourceNotFoundException', 'ServiceUnavailableException'}:
            code = candidate
            break
        current = current.__cause__ or current.__context__
    if code == 'provider_error':
        for candidate in ['AccessDeniedException', 'ExpiredTokenException', 'ValidationException', 'ForbiddenException', 'UnrecognizedClientException', 'InvalidSignatureException', 'EndpointConnectionError', 'NoCredentialsError']:
            if candidate in str(error) or candidate == type(error).__name__:
                code = candidate
                break
    print(json.dumps({'embeddings': 'failed', 'reason': code, 'errorType': type(error).__name__}))
    raise SystemExit(1)
