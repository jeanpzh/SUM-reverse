# RAG y presentación normativa — verificación local

Fecha: 2026-11-10. Clase `observed`, únicamente local. No acredita SUM ni calidad
semántica/permisos reales de Bedrock. Las fuentes normativas mantienen la clase
`normative` y su alcance/fecha; los tests no las convierten en observación SUM.

## Entorno y procedencia

Stack propio iniciado por `verify-planning-redesign-stack.mjs`: React/Vite 5746,
NestJS 3746, Python 3747, directorio temporal de borradores nuevo en cada corrida,
fixtures incorporadas explícitamente sintéticas. LLM desactivado, corpus público
revisado y sin DSN vectorial para estas comprobaciones UI. No se inspeccionaron
servidores del operador, producción, claves reales ni snapshots privados.

Rutas: `/local/programacion-academica` (Resumen y Horario), chat y consejero.
Viewports: 1440×1000, 390×844 y 720×500 (reflujo equivalente a reducir el viewport
útil a la mitad). Capturas a scroll inicial del panel y en el estado del nombre
de archivo; no son comparación de paridad con SUM ni medición de rendimiento.

## Criterio → escenario → esperado → resultado

| Criterio / escenario | Resultado esperado | Real |
| --- | --- | --- |
| Montaje/apertura | Ninguna consulta normativa automática | PASS |
| Régimen desconocido + pregunta de carga | Una conclusión; sin repetir párrafo extractivo ni lista vacía de fuentes; respuesta original accesible | PASS |
| Régimen ordinario + misma pregunta | Citas recuperadas, estado not-determined conservado; fuentes por teclado con artículo, página PDF y vigencia desconocida | PASS |
| Detalles y limitaciones | Modo real Solo léxica y diagnóstico de repositorio ausente accesibles al desplegar | PASS |
| Transporte abortado, reintento, cancelación | Error explícito, pregunta retenida y consulta cancelada; ninguna respuesta inventada | PASS |
| Cerrar/reabrir y viewport estrecho | Historial retenido y sin overflow del documento | PASS |
| Generar propuesta y consultar consejero | Impacto Actual/Simulada medido, recomendaciones y aplicación explícita | PASS |

Ejecutado mediante `verify-planning-normative.mjs`: 6/6 escenarios, cero pageerrors.
El primer intento tenía un presupuesto de navegación insuficiente para Vite frío;
el segundo cerraba el panel que ya está abierto por defecto en escritorio. Se
corrigieron esas precondiciones del verificador. La corrida completa final pasó.

## Otras comprobaciones ejecutadas

- Build/lint de cliente: PASS; 302 tests de datos, 12 casos SSR y contraste: PASS.
- Python sin pruebas temporales de escala: 85 PASS, 3 skipped; posterior caso de
  documento vectorial corrupto incluido en recheck de diagnósticos: 8/8 PASS.
- Escala del solver, corrida aislada: 5/5 PASS. Una corrida anterior concurrente
  con arranque de navegador excedió por 23 ms un umbral de tiempo; no se cambió
  solver ni se relajó la prueba.
- PostgreSQL/pgvector real en contenedor propio `sum-rag-ux-acceptance` con datos
  independientes: 2/2 tests PASS (persistencia/identidad/filtro y paráfrasis sin
  solapamiento léxico con vectores de prueba). Contenedor retirado al terminar.
- Credenciales: 16 checks iniciales del worker; incluidos en la suite posterior.
  Signer real de boto3/InvokeModel interceptado antes de red con claves ficticias;
  la clave montada gana al token ambiental ajeno; sin mutación global.
- Compose: 4/4 checks de configuración PASS; el overlay semántico espera ingesta,
  no expone PostgreSQL y comparte secreto solo con Python/ingesta.
- Revisión independiente: se corrigió un diagnóstico hybrid incorrecto ante
  metadata vectorial corrupta; no otros hallazgos accionables. Diff check: PASS.

## Límites

La ingesta Docker con Bedrock real está preparada, pero no fue ejecutada con una
clave real. El test pgvector usa un doble de embeddings, por lo que no mide la
precisión Titan. La variante básica mantiene búsqueda léxica. El corpus sigue
siendo parcial y con vigencias sin confirmar; se conserva la abstención y el
régimen por defecto. No se introdujo streaming ni ejecución de JSX del modelo.
Avisos existentes: chunks cliente >500 kB y deprecación de langchain-community.
