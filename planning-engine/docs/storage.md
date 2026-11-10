# Almacenamiento documental local

Implementación B del plan `plans/academic-rag-langchain-migration.md` (2026-11-08).
La interfaz pequeña es `create_vector_repository(embeddings, env=None, *, corpus_fingerprint)`;
`search(query, eligible_ids, k=8)` devuelve Documents LangChain y `index(documents)`
devuelve el número de artículos recibidos. Cada artículo requiere `metadata.id` estable.
Se utiliza PGEngine/PGVectorStore oficial, no una búsqueda vectorial SQL propia.

## Configuración y ciclo de vida

`SUM_RAG_VECTOR_BACKEND=pgvector` es predeterminado y exige `SUM_RAG_DATABASE_URL`.
Usar URL SQLAlchemy `postgresql+psycopg://...` o `postgresql+asyncpg://...`;
no imprimirla en logs. No existe fallback implícito en memoria. El consumidor A
expone la degradación léxica cuando la búsqueda no está disponible.

`SUM_RAG_COLLECTION` es un prefijo `[a-z][a-z0-9_]{0,21}` (default `sum_rag`).
El nombre de tabla contiene una huella SHA256 truncada a 40 hex del perfil completo
A (`provider`, `model`, `dimensions`) y de `corpus_fingerprint(bundle)`.
Un comentario persistido contiene identidad completa; también se comprueba la
dimensión PostgreSQL. Mismo tamaño con otro modelo, corpus o proveedor produce otra
tabla. Una tabla ya existente con identidad/dimensión incorrecta falla explícitamente.
No se borra ni sobrescribe ninguna tabla. El propietario puede revisar y retirar
índices obsoletos en un procedimiento separado; la CLI no incluye borrado.

Solo `index` crea extensión `vector` (si tiene permisos) y tabla mediante PGEngine.
Usa un bloqueo asesor durante inicialización/ingesta, UUID5 estable por namespace y
artículo, y upsert oficial. Repetir un lote no duplica artículos. Un fallo parcial puede
reintentarse; no se promete atomicidad del lote, pues PGVectorStore confirma por fila.
No se borran artículos omitidos: cambiar el corpus canónico crea otro namespace.
`search` solo inspecciona identidad y consulta; nunca inicializa, descarga modelos ni
escribe. El filtro `metadata.id IN eligible_ids` se compila en SQL antes de LIMIT.
Lista vacía devuelve `[]` sin conectar. k admite 1–1000 (default 8).
Errores operativos son mensajes seguros sin DSN ni excepciones originales.

## Corpus canónico e ingesta

`load_corpus(env=None)` usa por defecto `normative-corpus/v1.json`.
`SUM_RAG_CORPUS_PATH` permite un manifiesto local revisado explícito. Se conserva
íntegro el bundle y su hash canónico: incluye citas, texto, fechas, ámbito, relaciones,
hash de extractos y procedencia PDF. Los pares URL pública/hash PDF se anclan en el
seed revisado; no se descargan PDFs. Una hash PDF en metadatos no acredita haber
recalculado el PDF remotamente. Ampliar fuentes públicas requiere revisión del seed,
fuera del alcance B. El manifiesto necesita revisión humana; hashes no acreditan
veracidad jurídica ni revisión. Las rutas `datos-reales/` también se rechazan antes
de abrir archivos. Nunca configurar snapshots privados.

Desde `planning-engine/`, con dependencias instaladas por A:

```sh
# DB propia y configuración IAM/proveedor solo del operador autorizado.
# SUM_RAG_DATABASE_URL se entrega al proceso; no cargar .env.
SUM_RAG_EMBEDDING_PROVIDER=fastembed .venv/bin/python rag_ingest.py
```

FastEmbed requiere preparación pública explícita previa según A; la ingesta no
inventa dimensiones ni selecciona un modelo alternativo. Los otros perfiles usan
`SUM_RAG_EMBEDDING_PROVIDER`, `SUM_RAG_EMBEDDING_MODEL` y
`SUM_RAG_EMBEDDING_DIMENSIONS` de A. Default Bedrock no equivale a ejecución cloud.
Para reindexar, cambiar el modelo/perfil o corpus revisado y ejecutar la misma CLI:
se crea un namespace nuevo. Reiniciar el consumidor con idéntico perfil, corpus y
prefijo. Ante mismatch comprobar esas tres identidades; no renombrar tablas ni
alterar dimensión para forzar reutilización.

## S3 opcional, exclusivamente ingesta

`SUM_RAG_SOURCE=s3` requiere `SUM_RAG_S3_BUCKET` y `SUM_RAG_S3_KEY` exactos;
`SUM_RAG_S3_VERSION_ID` agrega VersionId a GetObject y `SUM_RAG_S3_SHA256` permite
fijar hash del JSON recibido. `SUM_RAG_MAX_CORPUS_BYTES` limita lectura (default y
máximo 4 MiB). El cuerpo se cierra incluso ante error. No hay List/Put, crawling,
URLs prefirmadas, descarga PDF, endpoint personalizado ni acceso cloud en pruebas.

```sh
# Solo en runtime autorizado con un objeto público revisado y configuración propia.
SUM_RAG_SOURCE=s3 .venv/bin/python rag_ingest.py --snapshot /ruta/revisada/corpus.json
# Después servir y/o indexar exclusivamente el snapshot local:
SUM_RAG_SOURCE=local SUM_RAG_CORPUS_PATH=/ruta/revisada/corpus.json \
  .venv/bin/python rag_ingest.py
```

`--snapshot` crea exclusivamente un archivo nuevo, valida antes y no carga modelos
ni conecta a DB. El servicio A debe forzar carga local aun cuando el proceso tenga
`SUM_RAG_SOURCE=s3`; no llamar al loader S3 desde una consulta. Cambiar bucket/key
no cambia automáticamente el corpus servido. S3 es una fuente opcional, no una base
vectorial. No se creó infraestructura AWS, bucket ni política IAM. GetObject fue
verificado con fake de objeto exacto, no contra AWS; credenciales y modelos cloud
reales quedan fuera de la verificación B.

## Prueba aislada y entrega a raíz

Contenedor propio `sum-rag-b-pgvector`, imagen pública `pgvector/pgvector:pg16`.
Puerto `127.0.0.1:55432`, verificado libre antes de crearlo. Credenciales ficticias
exclusivas de la fixture; DSN para raíz:

```text
postgresql+psycopg://rag_test:rag_test_only@127.0.0.1:55432/rag_test
```

Desde raíz:

```sh
bash planning-engine/scripts/rag-pgvector-test.sh start  # solo si no existe ya
bash planning-engine/scripts/rag-pgvector-test.sh ready
planning-engine/.venv/bin/python -m pytest planning-engine/test_rag_sources.py planning-engine/test_rag_storage.py -q
SUM_RAG_RUN_OWN_PGVECTOR=1 AWS_EC2_METADATA_DISABLED=true \
  planning-engine/.venv/bin/python -m pytest planning-engine/test_rag_pgvector_integration.py -q
# Después de que raíz termine la integración:
bash planning-engine/scripts/rag-pgvector-test.sh stop
bash planning-engine/scripts/rag-pgvector-test.sh remove
```

No volumen host ni datos privados. Las tablas de prueba tienen prefijos únicos;
sobreviven a recrear objetos y reiniciar este contenedor, hasta eliminarlo.
El script no descubre ni inspecciona otros contenedores. Si Docker/pull falla, reportar
el error y no sustituir la prueba por una base ajena. Se deja este contenedor activo
para raíz. Las pruebas de integración son opt-in y se omiten sin la variable explícita.

Criterios → escenario → resultado esperado:

| Criterio | Prueba pública/sintética | Esperado |
| --- | --- | --- |
| Fuente íntegra y estable | carga seed, JSON con claves reordenadas | misma huella, metadatos conservados |
| Fuente inválida | texto alterado, URL ajena, página cero, ruta privada | rechazo antes de consumo |
| S3 exacto y acotado | fake Bucket/Key/VersionId, SHA incorrecto, tamaño excesivo | sin discovery; hash/tamaño rechazados; body cerrado |
| Snapshot seguro | CLI escribe y repite destino | bundle equivalente; no sobrescritura |
| Fallo de configuración | sin DSN, prefijo inseguro, fingerprint inválido | fallo antes de red |
| Persistencia e idempotencia | ingesta doble, nuevo objeto | 11 artículos sintéticos, sin duplicados |
| Filtro previo | diez vecinos excluidos, un artículo aplicable, k=1 | artículo aplicable presente |
| Aislamiento | modelo misma dimensión, dimensión/corpus distintos | nuevo namespace; sin índice, falla explícita |
| Perfil incompatible | vector 2D en índice 3D, identidad alterada | rechazo, sin reutilización |
| Componentes reales | FastEmbed LangChain + corpus público + PGVectorStore | citas y hash preservados tras recreación |
| Consulta sin escritura | PostgreSQL default_transaction_read_only=on | búsqueda pública funciona |

La integración React → NestJS → Python, revisión visual A/B/C y auditoría general
pertenecen a raíz. B no modifica pantallas SUM, UI interna, contratos compartidos ni
reglas normativas. No se afirma paridad con SUM ni vigencia normativa futura.

Resultados B ejecutados (2026-11-08): `test_rag_sources.py`: 5 passed;
`test_rag_storage.py`: 2 passed; integración opt-in: 2 passed en 15.07 s.
Primera integración detectó conversión incorrecta de espacios en opciones de URL
psycopg; se corrigió pasando parámetros decodificados y la única repetición completa
pasó. Aviso upstream de deprecación de `langchain-community` en la fábrica A de
FastEmbed; no afecta el resultado ejecutado. AST de los seis archivos Python y
`bash -n` del script pasaron. `git diff --check` no reportó errores (los archivos B
son nuevos/no rastreados y por ello ese comando no valida su contenido nuevo).
La ingesta real vía `rag_ingest.ingest` con perfil A FastEmbed 384D indexó 17 artículos
en `b_cli_public_475a0d1f90abc72a766cdaf8ba76905765e802d1`.
Fingerprint canónico público utilizado:
`eb0ab81839d80f2e454868d58d30c2db55e5e1bdef377a436e097ad6db37ed39`.
Ninguna comprobación cloud real ni prueba de navegador fue ejecutada por B.
