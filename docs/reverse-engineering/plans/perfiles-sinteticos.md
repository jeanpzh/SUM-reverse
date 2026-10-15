# Perfiles académicos sintéticos de Sistemas y Software

**ID:** PS-1 · **Fecha:** 2026-10-14, America/Lima · **Estado:** diseño listo; implementación y pruebas pendientes. Plan base por `sum-planner`, alcance reducido por coordinador antes de implementación: catálogo académico, historial sintético y su presentación en Historial. No precargar matrículas ni modificar oferta, programación, plan, horarios, inscripción, evaluaciones, deudas, perfil personal o shell.

## Alcance y decisión Sol

El usuario confirma únicamente los programas `SISTEMAS` y `SOFTWARE`. Conservar exactamente `SYN-SIS-A`, `SYN-SIS-B`, `SYN-SOFT-A`, `SYN-SOFT-B`, sus nombres «Estudiante sintético A/B», scopes FISI/2026-II, modalidad y planIds `SYN-SIS-PLAN`/`SYN-SOFT-PLAN`. Enriquecer la demostración académica con catálogo local, historial, intentos repetidos y promedios coherentes. No inventar domicilio, DNI, nacimiento, familiares, salud ni ficha socioeconómica. `perfil:null`, formulario incompleto y datos personales no disponibles se conservan.

Decisión que requiere Sol: el historial detallado **cabe en el payload `HistorialAcademico` existente**; las calificaciones y periodos no caben en el `ActorProfile` actual, que solo guarda IDs aprobados y contadores. Se añade un ledger **interno de seed**, sin endpoint nuevo ni modificación de wire MR/LPD. Las listas de aprobados/repitencias, ponderado e historial se derivan de una sola fuente; nunca se deduce aprobación mediante una regla SUM inventada. El frontend ya dispone de `AcademicHistory`, pero su rama sintética oculta indicadores/promedios: requiere un ajuste explícito y acotado para presentar los datos recibidos usando esa misma interfaz.

Preservar la fidelidad visual y de interacción SUM. La única pantalla autorizada a recibir los nuevos datos es Historial Académico, reutilizando `AcademicHistory` y su estructura existente. Mantener shell, navegación, login, sesión, matrícula, reportes y demás pantallas sin cambios.

## Fuentes, clase y límite de afirmaciones

| ID | Fuente y fecha de revisión | Clase / estado / alcance |
| --- | --- | --- |
| PUB-SIS-2018 | [Plan público de Sistemas 2018](https://sum.unmsm.edu.pe/loginWebSum/ReportePlanes.htm?lEscuela=1&lEspecialidad=0&lFacultad=20&lPlan=2018), resultados del buscador aportados por coordinador, 2026-10-14 | `observed` indirecto de índice público; solo referencia a existencia/título/estructura del plan 2018. Apertura directa reportada 404; integridad y vigencia actual `unverified`. No acredita cursos concretos de este seed. |
| PUB-SOFT-2018 | [Plan público de Software 2018](https://sum.unmsm.edu.pe/loginWebSum/ReportePlanes.htm?lEscuela=2&lEspecialidad=0&lFacultad=20&lPlan=2018), resultados aportados, 2026-10-14 | `observed` indirecto: extractos «Ingeniería de Requisitos», «Procesos de Software», «Diseño de Software». Apertura directa reportada 404; ciclos/créditos/prerrequisitos y vigencia no verificados. |
| PUB-TRANSICION | [Comunicado público sobre el plan 2009 de Sistemas](https://sistemas.unmsm.edu.pe/site/noticias/35-importante/188-comunicado-sobre-la-vigencia-del-plan-de-estudios-2009-de-la-escuela-profesional-de-ingenieria-de-sistemas), descripción aportada, 2026-10-14 | Candidato `normative`, **no revisado directamente por este planner**: transición/convalidación 2009→2018 para ciclos 1–6 según el hallazgo. No se implementa equivalencia, vigencia universal ni regla por esa descripción. |
| LOCAL-CODE | `profile.types.ts`, `fixtures.ts`, `profiles.ts`, `store.types.ts`, repositorio MR y proyecciones LPD, revisados con CodeGraph y fuente, 2026-10-14 | `observed` local estático: tres cursos genéricos por escuela; histórico vacío; `approvedCourseIds`/`failedCourses` existentes; reportes correlacionados con commit. No describe SUM. |
| PS-SEED-1 | Decisiones y tablas de este plan, 2026-10-14 | `local-only`: catálogo, distribución por ciclos, créditos, prerrequisitos, notas, aprobación/desaprobación, docentes ficticios, secciones, horarios, inscripciones y actas. Ninguno constituye malla oficial ni reglas SUM. |

No abrir PDFs de programación/horarios con nombres o identificadores personales. No utilizar exportaciones, generadores que lean entradas privadas, snapshots ni datasets derivados de procedencia incierta. Las URLs anteriores se registran como referencias aportadas, sin consultas nuevas por este planner. El plan público 2018 no pasa a ser `scope.planId='2018'`; conservar los IDs SYN y explicar que el catálogo de demostración no certifica la malla ni su vigencia.

## Contrato local fijado antes de dividir implementación

Reutilizar [LPD-CONTRACT-1](../contracts/local-api/local-profile-dashboard.md), [MR2/MR3](../contracts/local-api/matricula-regular.md), [decisiones LPD](local-profile-dashboard-decisions.md), [contrato Mi Información](../contracts/local-api/mi-informacion.md) y tipos `HistorialAcademico`, `EvaluacionLocalRow`, `OfferedCourse`, `ActorProfile`, `StoredRequest`, `Enrollment`, `EnrollmentReport` existentes. **No hay cambio HTTP/schema compartido:** mismos métodos, rutas, query/DTO, envelopes, validadores y errores. `runId/actorId/sessionId/key`, scope y revisión siguen correlacionados antes de proyectar.

Sí hay cambio **semántico del contrato LPD**: historial/evaluaciones dejan de ser vacíos obligatorios y dos actores arrancan con inscripción sintética demostrativa completa. Antes de despachar implementación, el coordinador debe reconciliar el documento LPD a revisión `LPD-CONTRACT-1/PS-1` en las filas de proyección y bootstrap, enlazando este seed. No cambiar `shared/local-profile-dashboard.*`, MR wire ni validadores para aceptar datos nuevos. Esta etapa solo diseña dicha actualización; no la ejecuta. Contratos R1 legacy no se migran.

Contrato interno nuevo, en tipos backend existentes; solo el bootstrap aislado de demostración lo usa:

```ts
type AcademicCatalogCourse = Omit<OfferedCourse, 'sections'>
type AcademicAttempt = {
  courseId: string
  period: '2025-1' | '2025-2' | '2026-1'
  sectionNumber: 1 | 2
  grade: number
  result: 'approved' | 'failed'
  recordId: string
}
type SyntheticAcademicRecord = {
  seedRevision: 'PS-SEED-1'
  catalog: AcademicCatalogCourse[]
  attempts: AcademicAttempt[]
}
// Extensión opcional de ActorProfile: academic?: SyntheticAcademicRecord
```

`academic` opcional preserva constructores de fixtures mínimos y pruebas previas: ausente conserva la proyección vacía anterior. Presente exige validación runtime del seed antes de publicar un run: claves declaradas, IDs SYN del mismo programa/plan, catálogo sin duplicados, referencias existentes, ciclo 1–14, créditos positivos, prerrequisitos sin ciclos, nota finita 0–20 por **diseño de esta demo**, periodo anterior al actual, acta `SYN-ACTA-<SIS|SOFT>-<A|B>-<01..09>`, unicidad `(courseId,period)` y orden cronológico. `result` explícito define aprobación, sin umbral de nota. Error de seed aborta arranque con ruta de campo, sin valores privados. No introducir nuevo error HTTP ni downgrade silencioso a vacío.

Proyección exacta a `HistorialAcademico`: `alumno=projectStudent(actor)`; una `asignaturas` por intento, `ciclo/codPlan/tipoAsignatura/codAsignatura/desAsignatura/creditos` del catálogo; `calificacion=grade`, `seccion=sectionNumber`, `acta=recordId`, `periodoAcademico=period`. Obligatorio→`O`, electivo→`E`, decisión de presentación local. Agrupar periodos ordenados: `creditos=sum(creditos de todos los intentos del periodo)`, `promedio=round2(sum(grade*credits)/sum(credits))`. Promedio total usa todos los intentos, sin promediar promedios redondeados. `resumen.asignaturasAprobadas` cuenta cursos distintos con resultado aprobado; `creditosAprobados` los suma una vez; media null si no hay intentos. `approvedCourseIds` es ese conjunto ordenado. `failedCourses` cuenta intentos failed anteriores a la primera aprobación; retenerlos incluso si posteriormente se aprobó, con máximo 4 conforme al tipo actual. `actor.ponderado` coincide con promedio total; nunca mantener el antiguo 17/18 independiente. Esto es aritmética local, no fórmula académica SUM.

## Catálogo de demostración y perfiles exactos

Cada programa tiene 16 cursos (64 créditos sintéticos), cuatro por ciclo. IDs `SYN-SIS-C01..C16` y `SYN-SOFT-C01..C16`, cuatro créditos por curso; ciclos `1+floor((n-1)/4)`. C01–C14 obligatorios, C15/C16 electivos. No es plan completo de diez ciclos. Prerrequisito de C01–C04 vacío; de C05–C16: el curso `n-4` del mismo programa. Toda esta estructura es PS-SEED-1 local, incluyendo los créditos de títulos públicos.

| n | Sistemas: nombre local | Software: nombre local |
| --- | --- | --- |
| 01 | Matemática para Sistemas | Matemática para Software |
| 02 | Fundamentos de Computación | Fundamentos de Programación |
| 03 | Comunicación Académica | Comunicación para Ingeniería |
| 04 | Introducción a Sistemas | Introducción a Ingeniería de Software |
| 05 | Matemática Discreta | Lógica para Programación |
| 06 | Programación Estructurada | Programación Orientada a Objetos |
| 07 | Análisis de Sistemas | Ingeniería de Requisitos |
| 08 | Organización de Computadoras | Procesos de Software |
| 09 | Estructuras de Datos | Diseño de Software |
| 10 | Bases de Datos | Construcción de Software |
| 11 | Sistemas de Información | Pruebas de Software |
| 12 | Redes de Computadoras | Bases de Datos para Aplicaciones |
| 13 | Arquitectura de Sistemas | Arquitectura de Software |
| 14 | Gestión de Proyectos de Sistemas | Gestión de Proyectos de Software |
| 15 | Analítica de Datos | Calidad de Software |
| 16 | Sistemas Distribuidos | Desarrollo de Aplicaciones Web |

Solo títulos SOFT-C07/C08/C09 tienen apoyo parcial en PUB-SOFT-2018; el resto son nombres realistas inventados, aunque puedan coincidir con asignaturas existentes. No añadir códigos oficiales, docentes reales ni atribuir pertenencia al plan 2018 sin respaldo.

`P1=2025-1`: C01..C04; `P2=2025-2`: C05..C08; `P3=2026-1`: solo B repite C08. Orden de notas según ese orden de cursos. Resultado explícito: todas las filas A aprobadas; en B C01..C06 aprobadas y C07/C08 desaprobadas en P2, C08 desaprobada en P3. Sección histórica 1. No filas de periodos corrientes ni notas inventadas como efecto de matricular.

| Actor | Notas P1 / P2 / P3 | Resumen esperado | Pendientes de catálogo / prematrícula actual | Matrícula corriente inicial |
| --- | --- | --- | --- | --- |
| SYN-SIS-A | 14,15,16,17 / 15,16,17,18 / ninguna | 8 aprobadas, 32 créditos; 8 intentos; PP 16.00 | C09..C16 / C09..C12 (16 créditos) | Reporte sintético de C09..C12, sección 1 |
| SYN-SIS-B | 14,15,13,16 / 15,14,8,9 / 10 | 6 aprobadas, 24 créditos; 9 intentos; PP 12.67; C07 una falla/C08 dos | C07..C16 / C07,C08,C09,C10 (16 créditos) | null; puede ejercitar commit local existente |
| SYN-SOFT-A | 16,17,18,15 / 17,18,16,17 / ninguna | 8 aprobadas, 32 créditos; 8 intentos; PP 16.75 | C09..C16 / C09..C12 (16 créditos) | Reporte sintético de C09..C12, sección 1 |
| SYN-SOFT-B | 12,13,14,15 / 14,15,7,8 / 9 | 6 aprobadas, 24 créditos; 9 intentos; PP 11.89; C07 una falla/C08 dos | C07..C16 / C07,C08,C09,C10 (16 créditos) | null; puede ejercitar commit local existente |

El catálogo es privado del ledger de historial y **no** modifica la oferta, prematrícula ni ruta Plan. `planKnown` y las ofertas actuales conservan su significado previo. No se afirma que este catálogo sea un plan oficial.

El seed de PS-1 se activa solo en el bootstrap aislado de perfiles, sin endpoint nuevo. Conservar los fixtures mínimos usados por pruebas existentes y no cambiar su comportamiento. Matrícula y horarios siguen con el estado que ya tienen; evaluaciones, deudas, asistencias y tutorías siguen vacías.

## Migración, archivos exclusivos y tareas Luna

Conservar profileRevision, plan, actor, inscripción, recuperación y sesiones actuales. El ledger académico vive únicamente dentro de la fixture aislada de perfiles; no cambia las claves MR ni escribe resultados de matrícula. La configuración documental y el contrato semántico se fijan antes de separar client/backend. No compartir archivos entre workers ni delegar desde ellos; como máximo dos ejecutores y navegador solo coordinador.

| Tarea | Dependencia / propietario | Archivos exclusivos previstos | Aceptación / checks |
| --- | --- | --- | --- |
| PS-P0 | Coordinador, completado | Documento `contracts/local-api/local-profile-dashboard.md` y este plan | Adendum LPD-PS1 registra historial sintético y límites; no cambia schemas HTTP/MR ni activa efectos de matrícula. |
| PS-B1 | Dep. P0; Luna High backend | `backend/src/matricula-regular/profile.types.ts`; nuevos `academic-demo.fixtures.ts` y `academic-demo.validation.ts`; `backend/test/local-profile-dashboard-test-app.ts`; `backend/test/academic-demo-fixtures.spec.ts` | El bootstrap isolated y sus resets usan seed PS-1; construcción sin fuentes privadas; cuatro actores/16 cursos por escuela; conteos, promedios y referencias exactos. Los tests MR existentes retienen su factory mínima. |
| PS-B2 | Dep. B1; mismo backend | `backend/src/local-profile-dashboard/profile-projection.ts`; `profile-projection.types.ts` solo si requerido; `backend/test/local-profile-projection.spec.ts` | Historial y resumen exactos; alumno sin enriquecer; actor sin ledger conserva historial vacío; las otras keys no cambian. |
| PS-C1 | Dep. P0 + interfaz HTTP existente; Luna High cliente, puede avanzar junto B1–B2 | Solo rama sintética de `client/src/screens/TableScreens.tsx`, reutilizando `AcademicHistory` | Mostrar métricas y promedios recibidos, ocho/nueve intentos y dos/tres periodos; nota que indique historial sintético. Sin cambio de shell, router, login, otras pantallas o estilos globales. |
| PS-V | Dep. B2/C1; coordinador/verificador local | Registro `evidence/local/perfiles-sinteticos/verification.md` | API local aislada con perfiles SYN y comparación estructural de Historial. Builds, lint y tests focalizados. No producción, Playwright ni datos privados. |

Handoffs incluirán AGENTS raíz y carpeta, esta PS-1, contratos reconciliados, archivos exclusivos, dependencia, fuentes/prohibiciones, tests y obligación de preservar fidelidad SUM y reutilizar interfaces existentes. No introducir nueva API, DTO HTTP, base de datos, ORM, credenciales o dependencias. Si la fábrica aislada exige cambios fuera de la lista, diagnosticarlos y asignarlos antes de editar; no ampliar a AppModule o snapshots. Esta planificación no inicia workers.

## Invariantes y aceptación medible

| ID | Criterio → escenario sintético → resultado esperado | Estado |
| --- | --- | --- |
| PS-A1 | Catálogo/login → listar perfiles → exactamente cuatro IDs existentes, dos por escuela; nombres SYN, scope/plan propios sin tercera escuela | Pasó: bootstrap test, 14-10-2026 |
| PS-A2 | Ledger de los cuatro actores → validar/proyectar → 8/9/8/9 intentos, 2/3/2/3 periodos, 8/6/8/6 aprobadas, 32/24/32/24 créditos y PP 16.00/12.67/16.75/11.89; repitencias B=1 y2 | Pasó: fixture + projection tests, 14-10-2026 |
| PS-A3 | Ledger inconsistente, ID de otra escuela, duplicate o nota inválida → validar seed → error con ruta de campo, nunca historial vacío ni aprobación inferida de grade | Pasó: academic-demo-fixtures.spec.ts, 14-10-2026 |
| PS-A4 | Lecturas de los demás tabs luego del seed → programación, matrícula, horarios, evaluaciones y deudas → respuestas siguen sin cambios frente al fixture base | Pendiente |
| PS-A5 | Consulta Historial local con viewport/scroll actual → tabla y métricas → conserva `AcademicHistory`, presenta los datos y etiqueta local/sintético, sin cambio visual fuera de contenido | Implementado; build y lint cliente pasaron. No se hizo comparación REA visual en esta tarea. |

Comandos previstos tras implementación (scripts revisados): `pnpm --dir backend build`, `pnpm --dir backend lint`, pruebas backend focalizadas B1–B3 y suites de perfiles/MR afectadas; `pnpm --dir client build`, `pnpm --dir client lint`, `pnpm --dir client test:data`. Seleccionar nombres reales de suites al despachar. No ejecutar verificación general que use datasets no revisados, AppModule/snapshots o Playwright. Registrar criterio→escenario→esperado→real, comandos y fallos; máximo un ciclo automático de reparación por tarea, luego diagnóstico. Pruebas unitarias no sustituyen integración real local ni comparativa estructural.

## Pendientes y límite de completitud

Faltan catálogo oficial completo y vigente, créditos/ciclos/prerrequisitos comprobados, equivalencias 2009/2018, asignación oficial de planes y reglas SUM de notas; se dejan `unverified`, no se rellenan con el seed. Esta demo ofrece historiales académicos variados, no expedientes ni planes oficiales. Validación ejecutada: backend build/lint y 22 tests focalizados; client build/lint. No se capturó ni comparó una pantalla en REA.
