# Ejecución E1: revisión docente local

Fecha2026-11-04, rama schedule-pt1. Principal autor de diseño y contrato. Requisito
explícito del usuario: extender revisión dentro de E1, no aprobación institucional.
Plan: ../plans/programacion-academica-teacher-review.md.
Contrato: ../contracts/local-api/programacion-academica-demo.md y shared runtime.
Guía: ../programacion-academica-teacher-review.md.

Reutilizados: persistencia schema1/JSON/CAS/volumen, propuestas confiables del servidor,
editor manual y bloques/calendario existentes. No investigación de producción ni PDF.
Fuente académica explícitamente sintética; no datos-reales ni servicios del operador.
Solo pantalla administrativa local autorizada; fidelidad de pantallas SUM y navegación
del estudiante conservada, sin rediseño ni reglas nuevas de matrícula.

Skills aplicadas: sum-workflow, sum-nestjs-implement, sum-react-implement,
sum-fullstack-verify y sum-react-verify; apoyos backend existentes para Nest/lint/pruebas.
Principal no delegó planificación. Tras fijar plan y shared se asignaron implementaciones
disjuntas a review_backend y review_frontend, gpt-6-luna/high con fork none reales;
TOML de perfiles no disponible, fallback explícito. Sin subdelegación. CodeGraph no
inicializado con configuración sin salvaguardas suficientes para dependencias/symlinks;
no se indexó privado. Principal conserva contratos, documentos y navegador secuencial.

Verificación integrada: usar solo proyecto propio sum-academic-acceptance en5280 con
Compose --env-file NUL y fixtures incorporados sintéticos. Nunca tocar/inspeccionar
servidor operador5180. Builds/lint/tipos/pruebas por capa antes de escenarios reales
React→NestJS→archivo. Criterios y resultados reales se registrarán en
evidence/local/programacion-academica-teacher-review/fullstack-verification.md desde raíz.

No instalar dependencias, migrar, cambiar generador, matrícula, Docker, rama, commit
o push. La simulación de rol es interfaz de demostración, no sistema de permisos.

## Resultado real

Aceptación local completada:336 backend,200 cliente,17 shared,203 Node core (casos
reutilizados en Vitest),2 configuración; builds/lints/tipos pasaron,4 avisos previos
del backend. Docker recompilado con fuentes finales; fases save/resume en Chrome
separadas por cierre de navegador/reinicio backend pasaron, igual que revisión
manual ERP180 y flujo de matrícula idempotente. Sin tráfico externo en escenarios.
Solo instancia propia5280; no intervención del servidor5180 del operador.

Auditoría principal corrigió mediante worker un caso aislado A→B→A que no debía
impedir guardar un horario válido pero requería nueva conformidad. Se añadió prueba
de regresión;6 casos nuevos pasan. Frontend reparó un fixture incompleto tras una
pasada fallida de test:data; corrida final200/200. Scripts browser finales pasaron
al primer intento. Principal añadió comprobación de observación visible en Escuela
y captura al recuperar. No refactorización del generador o matrícula.

Resultado y lista exacta de archivos en el informe de evidencia indicado arriba.
Límites: roles simulados, una instancia, historial200 eventos, sin copia de seguridad
o auditoría institucional inmutable. Aprobación/publicación requieren etapa autorizada
y decisiones institucionales, no se implementaron.
