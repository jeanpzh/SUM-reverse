# E1 — aprobación/publicación: implementación y aceptación

Fecha local2026-11-04, schedule-pt1. Clase observed/local-only. Principal autor de
aceptación; requisitos explícitos del usuario, no normativa o comportamiento SUM
oficial. Plan: docs/reverse-engineering/plans/programacion-academica-publication.md.

## Recuperación de la ejecución interrumpida

Se conservaron todos los cambios existentes. Antes de la interrupción estaban
implementados backend, contratos y pantalla; backend10 casos nuevos/build/lint y
frontend201/build/lint pasaron. Faltaban Docker, navegador, recuperación real y cierre
de documentación. Al retomar se confirmó rama/status/diff y los resultados finales
de los workers existentes; no se crearon componentes, servicios o stores duplicados.
No había archivos truncados ni errores de sintaxis/tipos detectados. La continuación
no necesitó cambiar lógica de aplicación: completó aceptación y documentación.

Se conservaron los siete archivos rastreados previamente modificados; la mayor parte
de E1 sigue sin rastrear por etapas anteriores. «Nuevo» en git status no significa
que se haya creado en esta entrega. .pnpm-store se conservó. Sin commit/push/cambio
de rama, instalaciones, migraciones o cambios a Docker en esta etapa.

## Arquitectura implementada

Un mismo registro JSON/checksum/cola/CAS/volumen, schema1 compatible con anteriores.
Approval congela contenido exacto y registra sourceVersion/approvedVersion/fecha/huella.
Publicar añade número consecutivo y fecha en UNA escritura atómica. No hay otro
repositorio ni índice mutable: vigente se deriva del mayor número de publicación.
CAS de versión de archivo y currentId evita sustituciones desde pestañas antiguas.
Los endpoints save/review rechazan registros congelados. Crear nuevo borrador desde
approved/published genera otro UUID/sesión, conserva origin, borra conformidades y
metadatos de aprobación/publicación y nunca escribe el origen.

Contrato PA-PUBLICATION-1: GET publicaciones, publicaciones/vigente y publicaciones/:id,
con catálogo mínimo (código/nombre/ciclo/créditos), secciones/capacidad y asignaciones
con docente/ambiente/día/horas/componentes. No alumnos, observaciones o recursos internos.
No se crea E2 ni se conecta a matrícula. Vista previa e historial comparten una tabla
en el panel compacto; documentos congelados son consultables en modo lectura.

## Entorno y evidencia

Solo proyecto propio sum-academic-acceptance en http://127.0.0.1:5280, Compose con
--env-file NUL y SUM_PORT=5280, fixtures incorporados expresamente sintéticos.
No se inspeccionó/interrumpió el servidor operador5180, datos-reales, documentos PDF,
sesiones privadas o producción. Frontend real React→proxy→NestJS→JSON/volumen, sin
mocks/interceptores; Chrome headless1440×1000, ruta /local/programacion-academica.
Las capturas son evidencia local, no comparación de fidelidad con producción.

## Criterio → escenario → resultado

| Criterio | Escenario | Resultado real |
| --- | --- | --- |
| Rechazo de incompletos | Configuración sin resultado; preview/approve/publish |422 sin mutación |
| Conformidad vigente obligatoria | Completo con pending/changes-requested/outdated | Aprobación rechazada; nota opcional sobre conformity no bloquea |
| Aprobación exacta | Propuesta lista tras conformidades → preview → aprobar | approved, fuente v3 y archivo v4 en primera propuesta |
| Publicación diferenciada | Nueva preview del approved → publicar | published, archivo v5, publicación1 |
| Inmutabilidad | Fork y edición independiente, guardar, revisión y segunda publicación | DTO de primera publicación exactamente igual antes/después |
| Historial/vigente | Publicaciones1 y2 con IDs distintos | Ambas consultables; currentId=segunda, anterior conserva contenido |
| Recuperación real | Cerrar proceso/browser, restart backend, nuevo Chrome | Dos versiones y fechas recuperadas; lectura vigente y anterior correctas |
| Nuevo borrador después de reinicio | Consultar published y crear copia | Otro UUID/origin, sin aprobación/conformidades; origen intacto |
| Coherencia de datos | Comparar publicado con preview de approved y validar runtime | Código/nombre/ciclo/sección/docente/ambiente/componentes/capacidad coinciden |
| Concurrencia y corrupción | Dos publicaciones con mismo expectedCurrentId; resealed checksum con metadatos/snapshot cambiados | Solo una válida; conflictos/corrupción explícitos |
| Fallo de almacenamiento | Fallo simulado de renombrado atómico | Fuente aprobada/archivo previo intactos, no publicación parcial |
| Matrícula aislada | Comparar oferta antes/después de publicación/fork/recuperación | Idéntica |
| Regresión funcional | ERP180/45 y matrícula aceptada/replay | Pasó:4 secciones, editor/calendario y matrícula idempotente |

La demostración de publicación usa PROGRAMACIÓN Y COMPUTACIÓN, ciclo1, una sección
de30, componentes T60min+P120min en bloque continuo3h. La regresión separada ERP180/45
verifica cuatro secciones de4h. Son datos sintéticos, no programación institucional.
Checkpoint synthetic-publications.json contiene IDs/versiones/título y números de
publicación, sin estudiantes. Capturas: phase-save-publication-panel.png,
phase-resume-publication-1.png y phase-resume-publication-2.png.

## Comandos y resultados finales

- `pnpm --dir backend test programacion-academica test/matricula-regular-regression.spec.ts test/enrollment-scenarios.spec.ts`:19 archivos,346/346 (10 nuevos de publicación y51 de matrícula incluidos).
- `pnpm --dir backend build`: pasó, repetido también dentro de Docker.
- `pnpm --dir backend exec tsc -p tsconfig.build.json --noEmit --incremental false`: pasó.
- `pnpm --dir backend lint`: exit0;4 avisos preexistentes unbound-method, local-profile-session.spec.ts:52,68,89,135. Ninguno nuevo del módulo.
- `pnpm --dir client build`: pasó, incluye tipos y se repitió dentro de Docker.
- `pnpm --dir client lint`: pasó.
- `pnpm --dir client test:data`:201/201.
- `node --test shared/programacion-academica-api.test.mjs shared/programacion-academica-demand.test.mjs shared/programacion-academica-persistence.test.mjs shared/programacion-academica-teacher-review.test.mjs shared/programacion-academica-publication.test.mjs`:21/21.
- `node --experimental-strip-types --test backend/test/programacion-academica-section-sizing.test.mjs backend/test/programacion-academica-schedule.test.mjs backend/test/programacion-academica-generator.test.mjs`:203/203; casos reutilizados por Vitest, no sumarlos como cobertura independiente.
- `node --test scripts/academic-compose-config.test.mjs`:2/2, módulo local y simulador público aislados.
- `SUM_PORT=5280 docker compose --env-file NUL -f compose.local.yaml -p sum-academic-acceptance up --build --detach --wait`: pasó, dos contenedores saludables.
- `SUM_ACADEMIC_PUBLICATION_SYNTHETIC=1 node client/scripts/verify-academic-publication.mjs --phase=save`: pasó, dos publicaciones y copia independiente.
- Mismo proyecto Compose `restart backend`: pasó; memoria descartada, volumen conservado.
- Mismo verificador `--phase=resume`: pasó en otro proceso/browser.
- `SUM_ACADEMIC_COMPOSE_SYNTHETIC=1 node client/scripts/verify-academic-manual.mjs`: pasó, ERP180/45.
- Mismo entorno `node client/scripts/verify-academic-compose.mjs`: pasó, navegación estudiante y matrícula aceptada/idempotente.
- SHA256 de10 archivos de cálculo/validador/generador: idénticos al comienzo.
- `git diff --check`: pasó; aviso LF/CRLF previo de routeTree.gen.ts.

## Fallos observados y diagnóstico

Antes de aceptación se corrigieron en auditoría la condición que bloqueaba publicar
un estado approved y una comprobación que confundía comentario opcional de conformidad
con observación pendiente. Se reforzaron carreras de preview y bloqueo de edición.
El worker frontend reportó dos ejecuciones previas de test:data fallidas por expectativas
demasiado estrictas en el test nuevo; corrigió aserciones y201/201 pasaron.

Al retomar, una corrida backend con Docker y compilaciones/lints simultáneos terminó
345/346 por timeout5000ms en prueba de CAS/publicación. No hubo aserción de datos fallida.
Se repitió la suite completa sin esas compilaciones concurrentes:346/346 en33.89s,
sin cambios de código, exclusiones, configuración o límites de prueba. Docker/browser
pasaron al primer intento integrado. La incidencia es compatible con contención de
recursos del entorno; no se presenta la corrida fallida como aprobación.

## Límites y preparación para E2

Roles/decisiones simulados, sin autenticación, autoría verificable o firma institucional.
Una instancia backend,50 registros/2MiB compartidos por borradores/publicaciones.
No respaldo, revocación, eliminación o migración automática. Si un archivo inválido
impide determinar la vigente, la consulta falla explícitamente; no oculta corrupción.
El catálogo/formato debe seguir compatible; cambios requieren migración futura.
La inmutabilidad se aplica a rutas de la aplicación, no a operadores con acceso físico
al volumen. Checksum no es firma digital.

Si falla escribir un fork después de crear su sesión temporal, esa sesión puede
quedar en RAM hasta15min (límite previo20); no hay clon persistido y origen intacto.
No se modificó el servicio de generación para añadir limpieza nueva.

E2 sintético puede partir del contrato de lectura, fijando publicación ID+número y
sectionId. Antes de implementarlo deben acordarse población/identidad, registro de
solicitudes, reglas de cupos/prioridades y persistencia propias, sin confundir capacidad
planificada con vacantes reales. Autorización/aprobación/publicación institucionales
requieren decisiones y controles reales fuera de esta demostración. E2/E3 no iniciados.

## Archivos

Nuevos: backend/src/programacion-academica/academic-release.ts;
backend/test/programacion-academica-publication.spec.ts;
client/src/screens/AcademicPublicationPanel.tsx y .css;
client/scripts/verify-academic-publication.mjs;
shared/programacion-academica-publication.test.mjs;
docs/reverse-engineering/plans/programacion-academica-publication.md;
docs/reverse-engineering/programacion-academica-publication.md;
docs/reverse-engineering/workflows/programacion-academica-publication.md y esta evidencia.

Extendidos: backend/src/programacion-academica/saved-draft.service.ts y demo.controller.ts;
client/src/screens/AcademicScheduling.tsx y .css; client/src/data/academicScheduling.ts
y .test.ts; shared/programacion-academica-api.mjs y .d.mts;
docs/reverse-engineering/contracts/local-api/programacion-academica-demo.md.

Sin cambios de esta etapa en Docker, dependencias/lockfiles, núcleo del generador,
reglas/oferta/escenarios/pantallas de matrícula. Todos los cambios previos conservados.
