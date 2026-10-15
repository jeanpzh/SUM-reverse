# Auditoría REA, comportamiento y backend propio

Fecha: 2026-10-08. Alcance solicitado: analizar uso de REA y actualizar skills/subagentes para reconstrucción de comportamientos y futuro backend NestJS. Fuentes: código/documentación local, skill REA instalada v33, catálogo MCP disponible, Context7 y documentación primaria pública. No se inspeccionó SUM, navegador, red de sesión ni backend privado. No se implementó `server/` en esta tarea de instrucciones.

## Hallazgos del repositorio

| Hallazgo observado localmente | Evidencia | Consecuencia |
| --- | --- | --- |
| El alcance y flujo anteriores terminaban en React y verificación visual | `AGENTS.md`, versiones previas de `sum-workflow` y `sum-frontend-discovery` | La adquisición y aceptación no exigían reconstrucción de una cadena funcional completa |
| La investigación REA registrada identificó sesión/página y una captura de Inicio | `existing-evidence.md`, sección Evidencia nueva de REA | No acredita handlers, ejecución, requests ni reglas |
| Hay 12 contratos candidatos sin HAR/trazas conservadas; solo 4 métodos declarados | `contracts/observed-api.md`, `raw-types/README.md`, `client/src/data/endpoints.ts` | Los otros 8 POST son una elección local; no convertirlos en hechos ni reglas SUM |
| Existe capa de datos con loaders, transporte HTTP y validación parcial | `client/src/data/{api,transport,config}.ts`, rutas del cliente | Reutilizar adaptadores para la API propia, revisar método/query/body/envelope al fijar contrato |
| El modo predeterminado es mock, con fixtures sintéticos | `client/src/data/config.ts`, `client/src/data/mocks/responses.ts` | Demuestra interfaz local; no demuestra integración NestJS ni persistencia |
| El explorer exigía autorización institucional y el planner excluía backend ambiguamente | `.codex/agents/sum-explorer.toml`, `sum-planner.toml` previos | Alinear con declaración explícita del solicitante y permitir arquitectura del servidor propio |

La conclusión es que el proceso aprovechaba una parte de REA. No hay evidencia suficiente para atribuirle incapacidad de investigar comportamientos: las capacidades existen en el catálogo, pero no fueron utilizadas en los registros revisados. No afirmar que cualquier pantalla ya es funcionalmente equivalente a SUM.

## Qué aporta REA

[REA](https://github.com/morluto/rea) combina investigación de artefactos y runtime con evidencia y límites. Para este objetivo interesan JavaScript estático, observaciones web y escenarios; los motores de descompilación nativa no son necesarios para analizar JS.

[La observación CDP](https://github.com/morluto/rea/blob/main/docs/browser-observation.md) permite estudiar página/scripts y actividad durante ventanas externas sin navegar ni clicar. El catálogo conectado ofrece además `observe_web_execution`: cobertura instrumentada y asociaciones de iniciadores, con límites documentales/workers/causalidad. `trace_application_feature` y `trace_javascript_semantics` aportan alcance y flujo estático, manteniendo semántica dinámica desconocida. Una función alcanzable no queda acreditada como ejecutada.

[Los escenarios controlados](https://github.com/morluto/rea/blob/main/docs/browser-scenario-contract.md) permiten acciones y captura por paso. URL final es insuficiente para resultados que se renderizan sin navegación: pedir DOM/accesibilidad y esperar un estado específico. Los cuerpos HTTP son selecciones separadas; solo usarlos con datos sintéticos o artefactos sanitizados en este flujo. El escenario no proporciona aislamiento automático de solicitudes externas.

[Las capturas históricas](https://github.com/morluto/rea/blob/main/docs/web-network-captures.md) se inspeccionan offline, sin refetch. No prueban ejecución actual. Comparaciones y `verify_reconstruction` pueden acreditar reclamaciones finitas con Evidence comparable; no recuperan ni certifican globalmente el backend privado.

Context7 resolvió `/morluto/rea` y `/nestjs/docs.nestjs.com`. Algunas respuestas REA de Context7 describían grants/flags anteriores; se contrastaron con la documentación actual y esquemas MCP. No se instalaron/upgradearon herramientas ni se cambió registro MCP. Disponibilidad en catálogo no significa ejecución o validación de un target real.

## Cambios aplicados

- `sum-behavior-discovery`: preguntas por escenario, estados, handlers, requests/respuestas/resultados, persistencia, cobertura y procedencia por afirmación; referencia de selección de herramientas REA.
- `sum-evidence-to-spec`: escenarios y contrato API propio en `contracts/local-api/`, separado del inventario candidato SUM; decisiones locales explícitas permiten implementación propia sin certificar fidelidad SUM.
- `sum-backend-implement`: futuro `server/` NestJS con módulos/controllers/providers, DTOs runtime, servicios/repositorios, errores y persistencia requerida. Sin elección automática de base de datos/ORM/autenticación.
- `sum-fullstack-verify`: distinguir mock de API propia; verificar HTTP, resultado UI y efectos/reinicio cuando exigidos. Visual, comportamiento de referencia, contrato propio e integración tienen dictámenes distintos.
- `sum-workflow`, skills frontend actuales/legacy y `AGENTS.md`: etapas y alcance React + NestJS; asignaciones de archivos y gates independientes.
- Seis perfiles TOML existentes: implementación/ejecución de ambas capas, planner para arquitectura propia, verifier para integración, explorer para gaps funcionales y reviewer para invariantes. Se mantienen modelos/esfuerzos; no se añade un rol duplicado.

NestJS fue contrastado mediante Context7 con su documentación de [providers](https://docs.nestjs.com/providers), [módulos](https://docs.nestjs.com/modules) y [validación](https://docs.nestjs.com/techniques/validation). Controllers delegan lógica en providers registrados en módulos; DTOs y validación runtime verifican entradas. Las opciones concretas de `ValidationPipe` se fijarán contra el contrato local y versión elegida, no como reglas SUM observadas.

## Aplicación y límites

Los roles modificados se cargan en nuevas instancias; no se afirma que un agente ya activo haya cambiado sus instrucciones. Las nuevas skills se guardaron en `.agents/skills/` para descubrimiento en nuevas sesiones y uso explícito por ruta. El principal actual conserva su modelo; solo se usó el perfil configurado `sum-explorer` para auditoría local y revisión de escenarios, sin navegador.

No hay implementación backend nueva ni aceptación funcional SUM en este cambio. El siguiente trabajo de código debe escoger un flujo, fijar contrato propio y criterios y asignar `server/` y `client/`. Los gaps de referencia actuales siguen en `unknowns.md` y `observed-api.md`; no se requieren observaciones privadas para empezar un contrato local explícito.

## Validación de esta actualización

- Validador oficial `skill-creator/scripts/quick_validate.py` aplicado a 9 skills: todas válidas, salida 0. Python del entorno no tenía PyYAML; se ejecutó con `uv run --no-project --with pyyaml`, sin añadir dependencias al proyecto.
- Parseo con `tomllib`: 6 perfiles y configuración del proyecto válidos. Comprobación de enlaces Markdown locales de las skills y referencias: sin enlaces rotos.
- `python .agents/skills/sum-workflow/scripts/validate_routing.py --output /tmp/sum-backend-routing-validation.json`: salida 0, catálogo y esfuerzos disponibles, configuración efectiva y 6 hilos efímeros con valores TOML. Informe conservado en `agent-routing/backend-runtime-validation.json`. No ejecuta inferencias ni demuestra despacho nativo de un rol modificado en este harness.
- `git diff --check`: salida 0. El árbol ya contenía cambios y archivos sin seguimiento; se preservaron los cambios de aplicación/evidencia ajenos. Las modificaciones nuevas se limitan a instrucciones, skills, perfiles y documentación.
- Revisión independiente con `sum-explorer`: guardado propio tras reinicio requiere almacenamiento durable y contrato local; falta de acceso SUM no bloquea ese desarrollo. Cliente mock + backend compilado no certifican integración. Se aclaró que una solicitud de verificación autoriza comprobar los escenarios obligatorios locales.
- No se ejecutaron build/lint ni pruebas de aplicación: no hubo cambios `client/` y no existe backend nuevo. No se acreditó comportamiento SUM ni integración real en esta actualización.
