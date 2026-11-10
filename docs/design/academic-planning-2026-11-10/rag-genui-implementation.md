# RAG normativo y respuestas adaptativas

Estado: implementación local autorizada al retomar el trabajo el 2026-11-10.
Ámbito visual: chat normativo y consejero en `/local/programacion-academica`.
Se preservan `docs/design-direction.md`, el workspace existente, las pantallas SUM,
los contratos PA-NORMATIVE-1/PA-ADVISOR-2, validadores, guardado y aprobación.

Decisiones locales: conservar régimen desconocido y política de abstención;
mostrar evidencia localizada sin presentarla como vigencia/autorización confirmada.
Reutilizar pgvector existente, sin índice en memoria implícito. Composición
shadcn/AI Elements con JSON validado; no se necesita streaming para los componentes.
No ejecutar JSX generado por modelo ni cambiar el renderizador seguro de markdown.

Paquetes y propiedad de archivos:

- Credenciales (worker): fábrica Python, helper y tests propios. Clave directa o
  archivo montado llegan a chat y embeddings sin mutar el entorno global ni registrar secretos.
- Presentación (worker): componentes ai-elements, contenido del consejero/chat y
  tests SSR. Mantener el contrato; fuentes/limitaciones técnicas desplegables,
  recomendaciones e impacto con componentes existentes. Sin servidores del worker.
- Integración (raíz): diagnósticos de recuperación, Compose opcional pgvector y
  guía de ingesta explícita; contratos y pruebas integradas, navegador exclusivo.
  Ambos workers usan Codex en el checkout compartido con archivos disjuntos.

| Criterio | Escenario sintético/local | Esperado |
| --- | --- | --- |
| Clave montada para embeddings | archivo ficticio + SDK/adaptador interceptado | bearer correcto; sin red ni mutación global |
| Configuración e IAM | clave directa, archivo vacío/fallido, sin bearer | precedencia definida; error sanitizado; IAM conservado |
| Recuperación semántica real | pgvector aislado + embeddings deterministas de prueba | paráfrasis recuperada, persistencia e identidad del índice |
| Degradación explícita | DB ausente, índice sin ingesta, fallo de búsqueda | modo léxico y motivo accionable; sin secretos |
| No inventar sustento | filtros, fecha, conflicto, corpus parcial | mismo status/citas y reglas previas |
| Fallback conciso | vacío/parcial/conflicto/modelo/legacy | una conclusión inicial; detalles y fuentes accesibles |
| Consejero | impacto simulado y selección/versiones | counters reales, sin afirmar ejecución de cambios |
| Integración UI | stack propio sintético + prueba secuencial | chat y consejero reutilizan componentes, keyboard/móvil sin overflow |
| Regresión | build/lint/test:data y pytest relevante | sin fallos; no nubes ni snapshots privados |

Fuentes: `rag-genui-research.md` (documentación primaria revisada), código actual
(`observed`, local-only) y petición UX del usuario. No se acredita comportamiento
SUM ni permisos reales de la API key. No se accede a la clave real ni se realizan
llamadas a Bedrock durante las pruebas; solo corpus público revisado y fixtures
independientes. La mejora de precisión de un modelo real requiere medición separada.

## Decisiones de integración y revisión

Se añadieron códigos operativos internos acotados (no campos de contrato) para
configuración ausente/fallida, índice ausente/incompatible y fallo de búsqueda.
Los detalles humanos siguen en `gaps`; los logs solo contienen el código. No se
imprimen excepciones de drivers, preguntas, DSNs o claves.

La revisión independiente detectó que un documento vectorial corrupto podía
activar `semantic_used` antes de fallar su validación. La integración exige
además `not degraded` para declarar `hybrid`, con un caso específico de regresión.
También se evita declarar semántica cuando no hubo una consulta útil que clasificar.

Corrección aislada de raíz: se retiró el icono explícito del disclosure nuevo
porque la primitiva compartida ya dibuja su chevron por CSS. No se modifica esa
primitiva ni el resto del dashboard.

La variante Docker vectorial es opt-in: la ingesta cuesta cuota del proveedor y
bloquea el arranque semántico si falla. El modo básico permanece disponible sin
DB vectorial. Las consultas nunca indexan. No se modifican vigencias del corpus,
régimen por defecto, reglas de sustento ni límites de aprobación.
