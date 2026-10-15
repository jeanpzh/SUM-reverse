# REA para comportamientos web

Fuentes consultadas el 2026-10-08: [REA](https://github.com/morluto/rea), [observación CDP](https://github.com/morluto/rea/blob/main/docs/browser-observation.md), [escenarios](https://github.com/morluto/rea/blob/main/docs/browser-scenario-contract.md) y [capturas históricas](https://github.com/morluto/rea/blob/main/docs/web-network-captures.md). Confirmar nombres y esquemas en el catálogo conectado antes de llamar; las versiones difieren.

| Pregunta | Herramienta disponible | Límite que conservar |
| --- | --- | --- |
| ¿Qué página/DOM/scripts/listeners existen? | `list_browser_targets`, `inspect_web_page`, `inspect_web_event_listeners` | Seleccionar target explícito y origen autorizado; un listener no prueba su efecto |
| ¿Qué rutas, llamadas y datos sugiere el JS suministrado? | `analyze_web_bundle` o `analyze_javascript_application`; luego `trace_application_feature` y `trace_javascript_semantics` sobre Evidence compatible | Análisis estático, semántica dinámica puede quedar desconocida; no ejecución demostrada |
| ¿Qué ocurre durante una acción externa? | `observe_web_session` | Ventana acotada y pasiva; no clicks/navegación ni eventos anteriores al attach |
| ¿Qué código se ejecutó y qué inició una petición? | `observe_web_execution` | Cobertura instrumentada con scripts/hashes y asociación de iniciadores; resetea contadores y afecta optimización, no prueba causalidad UI ni cubre workers |
| ¿Cómo reproducir una transición local y su resultado? | `capture_browser_scenario` | Ejecuta acciones, puede mutar; usar entorno sintético aislado y esperar estado específico, no solo URL o un sleep |
| ¿Qué contiene una traza proporcionada? | `inspect_web_network_capture` | Offline; nunca reconsulta URLs y no prueba despliegue actual ni atribución runtime |
| ¿Cómo vincular fuente y runtime? | `reconcile_javascript_runtime` | Requiere Evidence estática y pasiva compatible; usar hashes, conservar ambigüedad |
| ¿La réplica cumple los escenarios declarados? | `compare_web_captures`, `verify_reconstruction` cuando los contratos Evidence sean compatibles | Pasos y condiciones alineados; lo ausente/truncado es desconocido, no igualdad global |

Los escenarios capturan URL final por defecto: eso no demuestra que una tabla, validación o respuesta haya cambiado. Seleccionar DOM/accesibilidad por paso y eventos `network` cuando respondan la pregunta. `capture.network.request_body`, `response_body` y `header_values` se solicitan independientemente, solo para datos sintéticos o evidencia proporcionada sanitizada. Evitar storage y cookies salvo necesidad local explícita; nunca trasladar sesiones reales al fixture.

REA no contiene automáticamente el tráfico del navegador. Un origen CDP filtrado delimita observación, no bloquea solicitudes externas. Para escenarios locales revisar la aplicación, controlar fixtures y bloquear egress con Playwright/interceptores o aislamiento efectivo antes de ejecutar. No afirmar que `capture_browser_scenario` incluye un interceptor de red.

Context7 puede devolver documentación de releases antiguos que exige grants o flags `--approved`. La documentación actual y el esquema MCP conectado mandan. No ejecutar setup, reinstalar la skill global ni agregar grants preventivos si las herramientas ya están disponibles.
