# Validación de Skills SUM

Fecha: 2026-10-08. Autoría guiada por `skill-creator` instalado en `/home/jeanpzh/.codex/skills/.system/skill-creator/SKILL.md`. Archivos nuevos de Skills bajo `.agents/skills/`; no se editaron Skills previas ni `AGENTS.md`.

## Descubrimiento previo y configuración

El inventario real de **Codex CLI 0.162.0** se consultó mediante el método `skills/list` del app-server local, sin crear threads, ejecutar turns de modelo ni conectar MCP a un objetivo. Antes: **45 Skills, cero errores**. Después: **49 Skills, cero errores**, exactamente cuatro incorporaciones y ninguna eliminación. El [snapshot de descubrimiento](skill-discovery.json) conserva nombres, ubicaciones, scope y habilitación; no contiene credenciales ni datos estudiantiles.

Ubicaciones previas relevantes:

- `.codex/skills/`: Skills SUM existentes `sum-frontend-discovery`, `sum-frontend-implementation` y `sum-visual-verification`, además de Skills de router. Se conservaron; el nuevo orquestador enlaza explícitamente las nuevas etapas.
- `/home/jeanpzh/.agents/skills/reverse-engineer-anything/SKILL.md`: habilitada, scope `user`, metadata versión **33**, 139 herramientas declaradas. No se copió ni reinstaló.
- `/home/jeanpzh/.codex/skills/.system/skill-creator/SKILL.md`: habilitada, scope `system`.

La configuración local de `mcp_servers.rea` indica servidor habilitado con `npx -y rea-agents@6.0.0 mcp`; esta sesión anuncia 139 herramientas REA. Esto acredita configuración y disponibilidad anunciada, no ejecución ni salud comprobada de cada herramienta. No se llamó ninguna.

Para comprender el descubrimiento se consultó Context7, primero `resolve-library-id` y después `query-docs` sobre `/openai/codex`; los parámetros efectivos se contrastaron con el JSON Schema generado por la versión instalada. La implementación oficial describe el [descubrimiento de Skills](https://github.com/openai/codex/blob/main/codex-rs/ext/skills/src/loader/discovery.rs). La prueba con el binario local es la evidencia de este entorno.

Protocolo utilizado, a través de stdin/stdout de `codex app-server --stdio`:

```json
{"id":1,"method":"initialize","params":{"clientInfo":{"name":"sum-skills-validation","version":"1.0.0"}}}
{"method":"initialized"}
{"id":2,"method":"skills/list","params":{"cwds":["/home/jeanpzh/orca/workspaces/SUM-reverse/REA"],"forceReload":true}}
```

Se aguardó la respuesta de inicialización antes de notificar `initialized` y consultar el listado; el proceso temporal se cerró al acabar. No fue necesaria una adición a `AGENTS.md`: Codex descubrió `.agents/skills/` automáticamente. El catálogo de una sesión ya abierta puede requerir recarga; el test utilizó un proceso nuevo y `forceReload`.

## Invocación y estructura

| Skill | Cuándo invocarla | Límite principal | Validación |
| --- | --- | --- | --- |
| [sum-evidence-to-spec](../../.agents/skills/sum-evidence-to-spec/SKILL.md) | Falta especificación implementable, criterios o trazabilidad desde evidencia existente | No adquiere evidencia ni cambia código | `quick_validate.py`: aprobada; 7 enlaces locales válidos |
| [sum-frontend-implement](../../.agents/skills/sum-frontend-implement/SKILL.md) | Especificación lista y diferencias de código por resolver | No define nuevos requisitos ni declara aceptación | Aprobada; 2 enlaces locales válidos |
| [sum-frontend-verify](../../.agents/skills/sum-frontend-verify/SKILL.md) | Se requiere comprobar implementación y emitir aceptación/discrepancias | No corrige frontend ni investiga producción | Aprobada; 2 enlaces locales válidos |
| [sum-workflow](../../.agents/skills/sum-workflow/SKILL.md) | Se recibe una funcionalidad y deben elegirse etapas, o simular el flujo | Coordina gates y registros; no adquiere evidencia | Aprobada; 9 enlaces locales válidos |

Las cuatro tienen frontmatter YAML con `name` y `description`, nombre coincidente con carpeta, entradas/salidas, activación/exclusión y criterios de éxito/parada. Codex las devolvió `enabled: true`, scope `repo`, con las rutas exactas `.agents/skills/<nombre>/SKILL.md`. Se mantiene selección implícita por defecto; no se añadió política de invocación explícita exclusiva.

Progressive disclosure: nombre/descripción para selección; procedimiento breve en `SKILL.md`; contrato de especificación y contrato de registro en dos referencias que se leen solo cuando hacen falta. Las especificaciones por pantalla siguen siendo fuentes externas y no se copiaron dentro de las Skills.

El validador oficial requirió PyYAML, ausente en el Python inicial. Se ejecutó mediante `uv run --no-project --with PyYAML python` en un entorno temporal, sin modificar dependencias del proyecto. Además se comprobaron nombres, enlaces y correspondencia de descubrimiento. Los cuatro validadores concluyeron `Skill is valid!`. La comprobación final conjunta de Skills y registros encontró **42 enlaces locales válidos**, huellas de Skills coincidentes con el snapshot y ausencia de espacios al final de línea.

## Comportamiento del orquestador

Leer cobertura/evidencias → evaluar requisitos del alcance → reutilizar artefactos vigentes → completar especificación si falta → diagnosticar/implementar diferencias si corresponde → verificar → registrar estado. Cada etapa consume el gate aprobado anterior. Ante evidencia obligatoria ausente o insegura, detener las etapas dependientes y registrar la condición de desbloqueo.

No se regeneran artefactos por el mero hecho de ejecutar el flujo. Resultados sin correspondencia de huellas/condiciones se conservan como históricos. Aceptación funcional y visual se dictaminan por separado. El modo simulación solo registra transiciones propuestas y termina `simulado` con disposición prevista.

## Simulaciones y revisión independiente

- [Tutoría](workflows/tutoria.md): suficiente para especificar e implementar el estado vacío; completar criterios incrementales, diagnosticar/reutilizar código y proponer verificación vigente. Sin aceptación actual ni certificación de filas/acciones/regiones enmascaradas.
- [Inicio](workflows/inicio.md): objetivo visual bloqueado por referencia sanitizada ausente e inspección nueva bloqueada. Detener las etapas dependientes, conservar las notas y solicitar evidencia segura; no invocar REA ni usar un candidato local como referencia SUM.

Un único evaluador independiente aplicó el orquestador en modo solo lectura a ambos casos. Se utilizó la evaluación prevista por `skill-creator` para comprobar selección de etapas con contexto fresco; su trabajo fue independiente de la validación estructural, sin archivos compartidos para escritura y sin agentes adicionales. No se paralelizaron etapas de ingeniería ni se creó un framework multiagente.

Su revisión y repetición motivaron precisiones acotadas: slug documental frente al slug de evidencia, diagnóstico estático separado de aceptación, vigencia de resultados en árbol con cambios, correspondencia de recortes/scroll y obligación de definir el objetivo funcional/visual antes del handoff. La segunda evaluación confirmó los recorridos y señaló que Tutoría permite especificación/implementación, aunque aceptación visual integral queda bloqueada por scroll no documentado si ese requisito es obligatorio. La revisión del gate final confirmó que no quedaban discrepancias materiales identificadas. La validación estructural y de descubrimiento final se ejecutó después de esas precisiones.

## Integridad y límites

Se compararon SHA-256 de **183 archivos protegidos**: archivos Git/no ignorados de `client/`, `AGENTS.md` y `reverse-engineer-anything/SKILL.md`; ninguno cambió y no aparecieron archivos nuevos no ignorados en `client/`. Los cambios preexistentes del usuario se preservaron. El snapshot registra también huellas de las cuatro Skills finales.

No se ejecutaron build/lint/tests/Playwright del cliente: el encargo requería crear Skills y simular rutas sin modificar frontend. No se hicieron nuevas observaciones SUM, llamadas REA ni pruebas de carga. El resultado valida estructura, descubrimiento y las dos decisiones simuladas; no certifica la implementación frontend actual ni todos los posibles casos futuros.
