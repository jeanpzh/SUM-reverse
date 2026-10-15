# Dynamic Agent & Model Routing — validación

Fecha: 2026-10-08. Instalación: **Codex CLI 0.162.0**.

## Resultado

Configuración aplicada en el proyecto: principal Luna Medium para sesiones nuevas,
subagentes Luna Medium por defecto y máximo **dos subagentes** concurrentes.
Seis roles independientes fijan `model` y `model_reasoning_effort` en TOML.
La skill conserva los gates de evidencia/especificación/verificación, añade clasificación
y planes persistentes, limita la reparación automática a una por tarea y exige razón
de escalamiento. `AGENTS.md` activa este enrutamiento para solicitudes SUM.

Las sesiones abiertas y los overrides explícitos pueden conservar otra selección;
iniciar una sesión nueva del proyecto para recibir el valor predeterminado Luna Medium.
No se cambió la configuración global del usuario.

## Archivos creados

- [Configuración del proyecto](../../../.codex/config.toml).
- Roles TOML: [explorer](../../../.codex/agents/sum-explorer.toml),
  [implementer](../../../.codex/agents/sum-implementer.toml),
  [executor](../../../.codex/agents/sum-executor.toml),
  [verifier](../../../.codex/agents/sum-verifier.toml),
  [planner](../../../.codex/agents/sum-planner.toml),
  [reviewer](../../../.codex/agents/sum-reviewer.toml).
- [Matriz y reglas de despacho](../../../.agents/skills/sum-workflow/references/model-routing.md).
- [Validador reproducible](../../../.agents/skills/sum-workflow/scripts/validate_routing.py).
- [Plan de esta configuración](plan.md), [simulación A–E](simulation.md), este informe,
  [validación runtime](runtime-validation.json) y [smoke nativo](native-smoke.json).

Archivos ajustados: [AGENTS.md](../../../AGENTS.md), [.gitignore](../../../.gitignore)
(permite versionar la configuración compartida, sin secretos),
[skill del orquestador](../../../.agents/skills/sum-workflow/SKILL.md) y
[contrato del registro](../../../.agents/skills/sum-workflow/references/run-record.md).

## Matriz efectiva

| Uso | Rol | Modelo | Esfuerzo |
| --- | --- | --- | --- |
| Orquestación y trabajo trivial | Principal | `gpt-6-luna` | `medium` |
| Exploración simple | `sum-explorer` | `gpt-6-luna` | `low` |
| Implementación delimitada | `sum-implementer` | `gpt-6-luna` | `medium` |
| Ejecución compleja bien definida | `sum-executor` | `gpt-6-luna` | `high` |
| Verificación rutinaria | `sum-verifier` | `gpt-6-luna` | `low` |
| Arquitectura/planificación compleja | `sum-planner` | `gpt-6.1-sol` | `high` |
| Revisión crítica de alto impacto | `sum-reviewer` | `gpt-6.1-sol` | `high` |

La clasificación puede separar decisiones Sol de ejecución Luna dentro del mismo
plan. No requiere un planner nuevo para especificaciones suficientes ni Sol como
verificador universal. Los checks directos no necesitan crear un subagente.

## Comprobaciones realizadas

1. `model/list` del app-server instalado confirmó Luna Low/Medium/High y Sol High
   antes de configurar. El catálogo también anuncia otros esfuerzos; no se seleccionan.
2. `config/read` confirmó valores efectivos y límite 2. Se compararon las claves
   MCP/hooks/skills/plugins heredadas con la configuración del usuario, admitiendo
   campos predeterminados añadidos por Codex. Se preservaron sus valores sin publicar
   encabezados de autenticación ni copiar configuraciones globales.
3. Se crearon y cerraron hilos efímeros con las claves reales de cada TOML;
   `thread/start` devolvió los modelos/esfuerzos esperados para los seis roles.
   Esta comprobación no realiza inferencia ni prueba por sí sola el despacho nativo.
4. Smoke **nativo con inferencia real**, mediante `codex exec --strict-config --json`:
   el principal Luna Medium lanzó secuencialmente `sum-explorer`, `sum-implementer`,
   `sum-executor` y `sum-planner` usando sus roles, sin overrides de modelo/esfuerzo.
   Los cuatro completaron con `OK`. La metadata del almacén local y los `turn_context`
   confirmaron respectivamente Luna Low/Medium/High y Sol High. Los hijos no llamaron
   herramientas ni escribieron archivos. El informe conserva solo campos sanitizados.
   `sum-verifier` y `sum-reviewer` comparten combinaciones ya probadas; se comprobó su
   configuración runtime sin otra inferencia redundante.
5. Skill: `quick_validate.py` aprobado. El Python base no tenía PyYAML; se ejecutó
   el validador con `uv run --with pyyaml`, sin añadir dependencias al repositorio.
6. Simulación A–E: decisiones y gates documentados; ninguna tarea SUM se implementó.
7. **181 archivos del cliente con huellas idénticas antes/después** (excluidos
   dependencias y artefactos de build). Cambios previos del usuario conservados.
   No se ejecutó build/lint del frontend: no hubo cambios y el encargo pide simulación.
   Cero inspecciones REA/Playwright y cero acceso al SUM de producción.

Repetir validación de catálogo/configuración, sin inferencia:

```sh
python .agents/skills/sum-workflow/scripts/validate_routing.py
```

El script comprueba disponibilidad anunciada y selección efectiva; la inferencia real
se acredita por separado en el smoke. No valida capacidades semánticas de los modelos
ni garantías de concurrencia de un sistema SUM inexistente en esta réplica.

## Fuentes de configuración

Se contrastó el formato con el esquema generado por el CLI instalado y la
[documentación oficial de subagentes](https://learn.chatgpt.com/docs/agent-configuration/subagents),
que documenta agentes TOML independientes, overrides efectivos y el límite de hilos.
Context7 resolvió `/openai/codex` y consultó la aplicación de modelos/esfuerzos por rol;
ante formatos históricos diferentes se priorizó la instalación y la documentación
oficial vigente. La disponibilidad de esta cuenta proviene del catálogo local,
no de una lista genérica de modelos publicada.
