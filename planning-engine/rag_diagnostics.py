"""Bounded operational diagnostics: never log exception text, DSNs or query content."""
import logging

RETRIEVAL_GAPS = {
    'not_configured': 'Repositorio vectorial no configurado; recuperación léxica solamente. Configurar el almacén e indexar el corpus revisado.',
    'configuration_failed': 'Repositorio vectorial no inicializado; recuperación léxica solamente. Revisar configuración y acceso a embeddings.',
    'index_missing': 'Repositorio vectorial sin índice para este corpus y modelo; recuperación léxica solamente. Ejecutar la ingesta explícita.',
    'index_mismatch': 'Repositorio vectorial incompatible con este corpus o dimensión; recuperación léxica solamente. Reindexar en un namespace nuevo.',
    'search_failed': 'Repositorio vectorial no disponible; recuperación léxica solamente. Revisar base de datos, credenciales y permisos del modelo.',
}


def retrieval_failure(code):
    """Return an allowlisted code even if a dependency supplies an unsafe value."""
    return code if isinstance(code, str) and code in RETRIEVAL_GAPS else 'search_failed'


def log_retrieval_failure(code):
    logging.getLogger('planning.rag').warning('semantic_retrieval_degraded reason=%s', retrieval_failure(code))
