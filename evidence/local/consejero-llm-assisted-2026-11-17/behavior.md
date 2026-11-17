# E2E del consejero con LLM real · 2026-11-17

Fuente `observed`, exclusivamente local: navegador Playwright headless → Vite → NestJS propio → Python propio → Amazon Bedrock Converse, Nova Lite. Catálogo y directorio de borradores independientes y sintéticos, corpus normativo público revisado, ninguna captura de SUM ni dato privado. No se usó un modelo simulado ni una respuesta interceptada. La elección y funcionamiento de las pantallas actuales se conservan; esta prueba no cambia su diseño.

## Ejecución reproducible

Desde la raíz, con una configuración explícita válida del operador:

```sh
SUM_REDESIGN_LIVE_LLM=1 SUM_PLANNING_ENV_FILE=/ruta/operator.env pnpm --dir client verify:planning-llm
```

El opt-in es obligatorio. El runner estándar conserva el LLM deshabilitado para los demás escenarios y no comparte servicios ni borradores con la aplicación del operador. Las credenciales solo se entregan al proceso del motor; los fallos del stack real no imprimen sus logs. El proceso de prueba recibe solo URL local, procedencia y destino de evidencia.

## Resultados

Los ocho criterios de `acceptance.json` pasaron:

1. Montar la UI no envía consultas.
2. La consulta inicial devolvió `source.mode=llm-assisted`, proveedor Bedrock Nova Lite.
3. La consulta no devolvió impacto ni ejecutó la herramienta de simulación.
4. La narrativa del modelo aparece en la UI, sin el estado degradado.
5. Aplicar estaba deshabilitado antes de simular.
6. La simulación devolvió `llm-assisted` y un impacto CP-SAT para exactamente los IDs seleccionados.
7. Aplicar produjo una sola regeneración y no guardó borradores.
8. No hubo excepciones JavaScript en el navegador.

La consulta inicial tardó 3467 ms en esta ejecución; no es un SLA. La simulación encontró 243/332 sesiones frente a 211/332 y terminó en `search-limit`: no demuestra imposibilidad ni optimalidad. Son resultados de este conjunto sintético y selección, no reglas universales ni resultados de producción.

Capturas: `llm-assisted-analysis.png`, `llm-assisted-simulated.png`, `llm-assisted-regenerated.png`; viewport 1440×1000, DPR 1. La aceptación recoge modos, contadores y criterios, sin credenciales, cabeceras de autenticación ni cuerpos de solicitudes al proveedor.

Esta ejecución corresponde al runner headless. El usuario pidió después repetir usando MCP Playwright con T3 Browser; esa conexión se valida por separado y no se afirma que este resultado provenga de T3 Browser. No acredita generación normativa en preguntas sin evidencia suficiente: la abstención sigue siendo obligatoria.


## Repetición en T3 Browser directo

Tras la elección explícita del usuario, se ejecutó el recorrido con las herramientas nativas de T3 Browser en la pestaña propia de `localhost:5636`, la misma UI expuesta por Tailscale. El MCP de Playwright disponible usaba un Chromium headless independiente, por lo que no se atribuye esta repetición a ese MCP.

`t3-browser.json` registra la consulta inicial y dos simulaciones con `llm-assisted` real. Se observaron las respuestas de fetch sin alterar solicitudes ni respuestas, sin capturar cabeceras ni credenciales. La consulta inicial no tenía impacto, la simulación correspondía exactamente al ID marcado y habilitaba Aplicar. Marcar y desmarcar la misma opción invalidó el impacto y deshabilitó Aplicar; se volvió a simular antes de aplicar. La aplicación produjo dos generaciones en total (inicial y regeneración), un ID de propuesta nuevo, resultado visible, cierre del rail y ningún borrador nuevo: el conteo existente permaneció en 1. No se observaron excepciones de página.

Esta repetición usa el stack sintético persistente cuyo lanzador se revisó previamente; no se adjuntó a snapshots privados. Se conservan solo modos, contadores y estados técnicos, sin listas de personas ni cuerpos normativos completos. La observación no acredita paridad SUM ni disponibilidad permanente del proveedor.
