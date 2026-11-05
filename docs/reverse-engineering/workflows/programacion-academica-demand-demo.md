# E1 · estimación de demanda potencial

2026-11-02. schedule-pt1. Estado: implementado y verificado localmente.
Complejidad/impacto medios; incertidumbre delimitada por perfil sintético explícito.
Principal revisó hallazgos, definió plan/contrato/criterios y presentó diseño antes
de implementar. No se delegó planificación ni decisiones institucionales.

Plan: docs/reverse-engineering/plans/programacion-academica-demand-demo.md.
Contrato: shared/programacion-academica-api.mjs/.d.mts y contrato local E1.
Backend worker demand_backend y React worker demand_frontend, ambos gpt-6-luna/high
reales mediante fallback del harness (sin TOML local disponible), con archivos
disjuntos y sin delegación posterior. Principal: shared, documentación, revisión,
corrección CSS aislada y aceptación integrada. Skills: sum-workflow, implementaciones
propias NestJS/React, sum-react-verify y sum-fullstack-verify. Conservar fidelidad
visual/interacción SUM y cambios solo en módulo local administrativo.

Se reutilizan datos/plan, tipos académicos, cálculo de secciones, generador, API de
propuestas y editor compacto. Nuevo adaptador/proyección de demanda necesario porque
validador de historial original está ligado a IDs A/B; se documenta incompatibilidad
sin modificarlo. Equivalencias demo declaradas y fuentes independientes/versionadas,
sin conexión al repositorio mutable de matrícula ni fuentes privadas.

319 Vitest backend/regresión,198 datos cliente,10 shared, build/tipos/lint aprobados;
cuatro advertencias backend previas. Tres flujos reales en Docker sintético propio5280
aprobados (demanda, ajustes, matrícula). Evidencia completa, incidencias y límites:
evidence/local/programacion-academica-demand/fullstack-verification.md.
Guía/fórmula: docs/reverse-engineering/programacion-academica-demand-demo.md.

No E2/E3, aprobación, persistencia, publicación, bibliotecas nuevas, cambios Docker,
migraciones, commits o push. CodeGraph omitido sin garantías acreditadas para su
inicialización. Verificado local no significa oficial ni predicción institucional.
