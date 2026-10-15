# SUM-ROUTING-2026-10-08

Extender el workflow instalado con selección efectiva de modelos y esfuerzos,
preservando MCP, skills, hooks y cambios ajenos. Alcance: configuración/documentación;
sin cambios de frontend ni inspección de SUM.

Complejidad media, incertidumbre media (formato y aplicación efectiva de roles según
versión), impacto medio (afecta asignación y coste). Se reutiliza `sum-workflow` y sus
gates; la política del encargo especifica el diseño, por lo que no necesita otro planner.
El principal de esta sesión conserva su selección previa; Luna Medium es el valor
comprobado para nuevas sesiones del proyecto, no un cambio retrospectivo.

| ID / tarea | Dependencias | Complejidad / incertidumbre / impacto | Agente y modelo | Archivos exclusivos | Aceptación | Estado | Verificación |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1: verificar instalación y formato | Ninguna | media/media/medio | Principal, sesión existente | Solo lectura y temporales `/tmp/sum-*` | Catálogo anuncia las cuatro combinaciones; formato soportado por CLI | verificada | CLI 0.162.0, `model/list`, esquema y documentación oficial/Context7 |
| R2: configurar roles y límite | R1 | media/baja/medio | Principal, sesión existente; sin delegación de edición | `.codex/config.toml`, `.codex/agents/*.toml` | Modelos/esfuerzos como claves reales; límite 2; herencia MCP intacta | verificada | `config/read`, threads efímeros, informe runtime |
| R3: ajustar orquestador | R1 | media/baja/medio | Principal, sesión existente | `.agents/skills/sum-workflow/` | Reutilización, clasificación, máximo una reparación, propiedad de archivos, escalamiento justificado, bloqueo producción | verificada | Validador de skill y revisión de escenarios A–E |
| R4: validar y simular | R2, R3 | media/baja/medio | Principal, sesión existente; smoke nativo secuencial con roles configurados | `docs/reverse-engineering/agent-routing/` y temporales | A–E documentados honestamente; metadata efectiva; client intacto | verificada | Informes runtime, smoke y simulación; huellas client |

Reparaciones de tareas SUM simuladas: 0. No se implementó ninguna de ellas.
Escalamientos de esta configuración: ninguno; Sol High se usa solo como smoke
de aplicación del rol, no como revisión universal ni planificación del frontend.
Los resultados detallados y límites están en `validation.md` y `simulation.md`.
