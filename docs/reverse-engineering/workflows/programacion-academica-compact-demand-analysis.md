# E1 · editor compacto y análisis de demanda

2026-11-02. Rama schedule-pt1. Estado: UI verificada localmente; análisis entregado;
cálculo automático de demanda no iniciado. Fuente: instrucción explícita del usuario
y código/fixtures sintéticos existentes, sin PDFs privados ni producción.

Plan del principal:
docs/reverse-engineering/plans/programacion-academica-compact-demand-analysis.md.
Contrato PA-DEMO-1 y endpoint ajustes reutilizados sin cambios. Complejidad media,
incertidumbre baja para UI/media para demanda; impacto bajo en UI. Preservar
fidelidad visual/interacción SUM, con cambios solo administrativos locales.

Principal: inspección, plan, análisis de demanda y aceptación integrada; sin delegar
planificación. Worker real compact_section_editor, gpt-6-luna/high mediante fallback
disponible por ausencia de TOML local, implementó exclusivamente AcademicScheduling
TSX/CSS y script verify-academic-manual. Sin subdelegación. Skills: sum-workflow,
sum-react-implement, sum-react-verify y sum-fullstack-verify. No se inicializó
CodeGraph sin acreditar exclusiones de dependencias/symlinks privados.

Revisión preventiva mantuvo edición de bloques asignados de secciones parciales;
pruebas obligan dos bloques split en días distintos. UI conserva componentes,
reglas/controles/API originales. No hay fallos finales ni reparaciones posteriores
a comprobaciones fallidas en esta entrega.

Evidencia: evidence/local/programacion-academica-manual/compact-verification.md.
304 backend/regresión,196 datos cliente y6 shared aprobados; build/tipos cliente,
lint, Docker y navegador real aprobados; matrícula sintética intacta/idempotente.
No se repitió toda la suite global ni se atribuyó comportamiento oficial al SUM.

Análisis: docs/reverse-engineering/plans/programacion-academica-demand-findings.md.
Población limitada y escenarios alternativos impiden usar conteos como demanda
institucional. Propuesta de potencial académico deduplicado con override manual;
población/corte/definición y reglas desconocidas pendientes de decisiones del equipo.
No se crearon contratos, adaptadores, endpoints ni estimador de demanda. No E2/E3,
cambios matrícula/Docker/dependencias, migraciones, commits o push.
