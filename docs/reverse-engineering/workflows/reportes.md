# Reportes: ejecución React y NestJS

Fecha: 2026-10-08. Modo: ejecutar. Encargo: realizar los cinco reportes del menú proporcionado usando `sum-workflow`, incluyendo backend propio y comportamiento local.

## Alcance y fuentes

- Rutas existentes: `reportes/prematricula`, `matricula`, `horarios`, `evaluaciones` y `deudas` bajo `/alumnoWebSum/v2/`.
- Evidencia proporcionada: `evidence/sum/reportes-menu/reference.png` y `provenance.md`. Confirma menú, orden y selección, sin viewport/ruta/scroll suficientes para comparación visual exacta.
- Evidencia histórica reutilizada: cinco especificaciones `screens/reportes-*.md` y notas `evidence/sum/reportes-*/`. Confirman títulos/columnas y descargas visibles en prematrícula/matrícula; no resultado de descarga ni contratos completos.
- Contratos candidatos: `contracts/observed-api.md`, `raw-types/` y capa de datos actual. No se elevan a contratos SUM verificados.
- Fuente clasificada: artefactos proporcionados y aplicación local sintética. No se invocó producción. Falta de observación de producción solo limita fidelidad de referencia.

## Decisiones y clasificación

Complejidad alta (cinco pantallas + nueva integración), incertidumbre media (evaluaciones/deudas sin forma de fila suministrada), impacto medio (consultas propias sin escrituras académicas). Planificar frontera cliente/backend con `sum-planner` Sol High; implementación delimitada con `sum-implementer` Luna Medium. El principal conserva el modelo actual de su sesión.

Reutilizar el scaffold NestJS 12 suministrado en `backend/`; es la ubicación efectiva para esta tarea en lugar de crear `server/`. No renombrar ni sobrescribir trabajo ajeno. Sin acceso a bases SUM, proxy SUM, credenciales, matrícula mutadora, pagos ni reglas académicas privadas.

Backend: fixtures sintéticos de lectura, transiciones y contratos locales explícitos. No se requiere una base de datos para un catálogo determinista de solo lectura. Clientes mock y local se distinguen; integración solo se acepta contra el proceso NestJS real.

## Etapas

| Etapa | Decisión y gate | Resultado |
| --- | --- | --- |
| Investigación | Reutilizar screenshot, notas, specs y código; gaps de referencia registrados | Completa para diseñar alcance local; fidelidad SUM limitada |
| Especificación | Planner fija contrato y tareas en `plans/reportes.md` y `contracts/local-api/reportes.md`; principal enlaza alcance local en cinco specs | Lista, `reportes-api-v1` |
| Implementación backend | Contrato listo; `reports_backend`, rol sum-implementer Luna Medium; propiedad `backend/` | Implementada; build/lint aprobados |
| Implementación frontend | Contrato listo; `reports_client`, rol sum-implementer Luna Medium; propiedad `client/` | Implementada; build/lint aprobados |
| Verificación | Build/lint y escenarios HTTP/browser/REA locales de éxito, vacío, error/reintento y recarga | Ocho escenarios aprobados, dos comprobaciones de frontera y captura REA completa |

Fidelidad visual exacta y comportamiento SUM completo no son criterios acreditables con el recorte. La aceptación pedida será funcional local con jerarquía/navegación de referencia y contratos propios documentados.

Reparación automática backend: 1 (primer build: decorador y asignación del fixture vacío; build/lint posteriores aprobados). Frontend: 0; se conservó la opción `baseUrl` del modo mock tras revisión estática.

Diagnóstico adicional del principal: una consulta con `Content-Type: text/plain` y cuerpo no vacío devolvía 200 porque Express no lo parseaba y el pipe interpretaba `body === undefined` como ausencia de cuerpo. Decisión explícita: rechazar cuerpos transportados pero no parseados usando `Content-Length`/`Transfer-Encoding`, sin introducir parser/dependencias ni repetir reparaciones ciegas. Caso afectado, build y lint comprobados: aprobados.

## Aceptación local

Los ocho escenarios R-HTTP, R-INVALID, R-UI, R-GUARD, R-RETRY, R-REPEAT, R-EMPTY y R-CSV pasaron con NestJS real. También se comprobó loading con respuesta real demorada y rechazo accesible de respuesta malformada inyectada. [Informe](../../../evidence/local/reportes/verification.md), [comportamiento](../../../evidence/local/reportes/behavior.md), [resultados](../../../evidence/local/reportes/check-results.json).

Build y lint de ambos proyectos aprobaron. No se añadieron ni ejecutaron suites de tests. Captura REA local completa: `ev_b263eb04170e45dae905e2db44cec20f3f69a222b65d9146d5a4ea7561d47b36`, navegación Deudas → Pre-Matrícula → Evaluaciones, snapshots accesibles y transacciones HTTP 200; no producción ni cuerpos/headers sensibles.

Actualización posterior de política: implementadores Luna High, instrucciones y skills propias por carpeta. Los nombres Medium anteriores describen la configuración histórica del handoff; no acreditan esfuerzo efectivo del hilo ni se reinterpretan retroactivamente. Ambos perfiles High se comprobaron en hilos nuevos: [routing](../agent-routing/luna-high-runtime-validation.json).

Estado: aceptado para alcance funcional local sintético. Fidelidad visual exacta y reglas privadas SUM permanecen sin verificar. La revisión adicional de código con las nuevas instrucciones se registra separadamente; cambios posteriores requieren comprobaciones afectadas antes de reutilizar esta aceptación.

## Refactor posterior con skills (2026-10-08)

[Registro](backend-skills-refactor.md): validación compartida, respuestas tipadas y shutdown hooks; build/lint aprobados y comparación nueva de9respuestas HTTP pobladas idénticas. La verificación completa anterior conserva su revisión/hashes históricos; no se afirma nueva ejecución de escenarios UI/empty/error en el refactor.
