# Orquestación por carpeta

Actualización: 2026-10-08, solicitud explícita del usuario.

- Raíz: `AGENTS.md`, workflow, evidencia, escenarios, contrato compartido, delegación e integración.
- Frontend real: `client/AGENTS.md` y `client/.agents/skills/sum-react-{implement,verify}/SKILL.md`.
- Backend: `backend/AGENTS.md` y `backend/.agents/skills/sum-nestjs-{implement,verify}/SKILL.md`.
- Los subagentes `frontend_instructions` y `backend_instructions` crearon las instrucciones y skills respectivas, con archivos disjuntos. No se creó una carpeta frontend duplicada.
- `sum-implementer` y `sum-executor`: `gpt-6-luna`, esfuerzo `high`. La selección genérica/principal no cambia por esta petición.
- El validador de routing abrió hilos nuevos y comprobó ambos perfiles: [resultado real](luna-high-runtime-validation.json). Un cambio TOML no cambia retroactivamente hilos existentes.
- Seguimiento solicitado: `backend_rules_update` revisa código backend con su AGENTS y skill local; conserva contrato y cambios de otros trabajadores.

Seguimiento completado: `backend_rules_update` (`sum-implementer`, Luna High) no encontró brecha y no modificó código. Diagnóstico en `backend/docs/reportes-rules-update.md`; no reejecutó verificaciones ni reclamó nuevos resultados funcionales.

## Planificación previa explícita (2026-10-08)

El usuario solicita especificaciones exactas de Sol High antes de implementar con Luna High. RootAGENTS, sum-workflow, model-routing y roles implementadores exigen ese handoff para nuevas funcionalidades/ampliaciones; planes suficientes previos se reutilizan. Validación actual [Sol/Luna](sol-plan-luna-runtime-validation.json). Primer despacho bajo esta preferencia: `matricula_info_plan`, rol nativo `sum-planner`; contrato/plan Información de Matrícula antes de trabajadores backend/cliente.
