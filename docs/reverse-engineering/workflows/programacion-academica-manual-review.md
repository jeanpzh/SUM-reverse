# Ejecución E1 · revisión manual

2026-11-02, schedule-pt1. Complejidad media, incertidumbre acotada, impacto medio
(integridad de propuesta local en memoria). Fuente: solicitud del usuario local-only;
se reutilizaron contrato PA-DEMO-1, generador/validador/autoridad y componentes SUM.
Plan/contrato/criterios e inspección a cargo del principal, sin delegar planificación.

Plan: `docs/reverse-engineering/plans/programacion-academica-manual-review.md`.
Contratos: `shared/programacion-academica-api.*` y contrato local de la demo.
Implementación con dos workers reales gpt-6-luna/high mediante fallback disponible,
manual_backend y manual_frontend, sin subdelegación y con archivos disjuntos.
No existían los TOML del proyecto citados en el routing; no se simuló usar esos perfiles.
Principal: shared/documentación, revisión, correcciones aisladas de scripts de
aceptación y navegador secuencial. Skills: sum-workflow, entradas propias React/NestJS
y sum-fullstack-verify, conservando pantallas/estilos/interacción estudiantil SUM.

Implementación y aceptación integradas completadas. Reutilización del generador sin
modificaciones: auditoría y regresión confirman prioridad de preferencias, no óptimo
global. Endpoint atómico autorizado por entrada original, revisión con versión,
interfaz por bloque y tablas simplificadas. Sin E2/E3 ni cambios de matrícula.

Verificación real y decisiones sobre incidencias:
`evidence/local/programacion-academica-manual/fullstack-verification.md`.
253 Vitest académicas,203 Node núcleo (solapan Vitest),196 datos cliente,6 contrato,
51 regresiones matrícula y2 Compose; build/tipos/lint y tres escenarios browser Docker
aprobados. Las cuatro advertencias backend anteriores permanecen. No hubo nuevas
dependencias, cambios Docker, migraciones, commits o push. Estado: verificado local;
sin verificación SUM oficial. No acceder a datos-reales ni documentos privados.
