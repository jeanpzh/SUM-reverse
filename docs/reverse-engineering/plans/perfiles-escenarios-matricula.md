# Perfiles y escenarios sintéticos de matrícula

**PEM-1 / aclaraciones PEM-1a y PEM-1b · 2026-10-16, America/Lima · Implementado y verificado localmente.** Planificador: `sum-planner`, GPT-6.1 Sol High, override efectivo permitido porque los TOML locales están eliminados; no se restauran. Implementador efectivo inicial: `sum-implementer`, GPT-6 Luna High, sin subdelegación. Corrección aislada PEM-1b: principal. Resultados en la sección final y evidencia enlazada. Un ciclo de reparación del harness del coordinador; motor sin cambios.

## Alcance autorizado y fuentes revisadas

Petición: generar perfiles y escenarios verosímiles de matrícula usando `datos-sinteticos/`. El usuario confirmó en esta sesión que la carpeta es íntegramente sintética, sin datos privados. Se revisaron sus nueve nombres JSON sin seguir symlinks y se inspeccionaron acotadamente los campos académicos del plan y programación. No se accedió a datos privados, servicios existentes ni producción. No ejecutar `scripts/generate-synthetic.mjs`: sus entradas no pertenecen al alcance permitido.

Se generan **nueve paquetes**, cada uno con exactamente los cuatro actores existentes, sus historiales, oferta, prematrícula y casos recomendados. Se podrán abrir con el launcher local existente y exportar como JSON. No se amplía la unión de actores ni la API. Los perfiles no están basados en expedientes reales y sus resultados son simulaciones del motor local, no comportamientos SUM comprobados.

Preservar fidelidad visual y de interacción SUM: **ninguna pantalla tiene cambios autorizados**. Reutilizar login, shell, Historial, matrícula, contratos, proyecciones y componentes actuales. Solo cambia el contenido de una variante sintética activada explícitamente. El arranque sin argumentos conserva exactamente PS-1 y sus pruebas; no corregirlo incidentalmente.

| ID / revisión 2026-10-15–16 | Fuente reutilizada | Clase y límite |
| --- | --- | --- |
| SRC-USER | Confirmación de procedencia íntegramente sintética en esta sesión | `testimony`: habilita estos archivos; no certifica normativa ni fidelidad de SUM. |
| SRC-PLAN | `datos-sinteticos/plan-estudios.json`: 97 filas, 85 cursos distintos según inventario del coordinador | `observed` local estático. Se reutilizan solo cuatro cursos y campos enumerados abajo; filas repetidas pueden representar varios prerrequisitos. No afirmar que son una malla oficial. |
| SRC-PROG | `datos-sinteticos/programacion-asignaturas.json`: 165 filas de sección, 56 cursos según coordinador | `observed` local estático: hay cupos y horarios. No se importan identidades docentes, alumno, horarios ni cupos; escenarios los controlan expresamente. |
| SRC-INVALID | `datos-sinteticos/formulario-datos-matricula.json` | JSON inválido, diagnóstico línea 20 columna 27. No se necesita, no se repara ni importa. |
| PS-1 | [Perfiles académicos](perfiles-sinteticos.md), `academic-demo.fixtures.ts`, `academic-demo.validation.ts` | `local-only`: ledger de 8/9 intentos, 16 cursos por escuela. La implementación actual solo agrega ledger, conserva estado MR base; PEM deriva coherencia únicamente en la variante nueva. |
| MR-LOCAL | `profile.types.ts`, `fixtures.ts`, `profiles.ts`, `rules.ts`, `selection.rules.ts`, `matricula-regular.service.ts` | `observed` local estático: contratos y ramas del motor; no se ejecutó runtime en esta planificación. |
| MATRIX | `backend/test/matricula-regular-matrix-scenarios.ts`, `matricula-regular-matrix.integration.spec.ts` | Oráculos reutilizables para causas, gaps y efectos. No se lanza matriz general ni modo live. |
| BOOT | `backend/test/local-profile-dashboard-test-app.ts`, `scripts/start-local-profile-dashboard.mjs`, bootstrap spec | Composición aislada existente, loopback y reloj sintético; no AppModule ni snapshots. |
| PEM-LOCAL-1 | Decisiones de este documento | `local-only`: selecciones, horarios, cupos, tutorías, requisitos y transformaciones. No añade normativa. |

CodeGraph: existen `.codegraph/` y `codegraph.json`; se validaron exclusiones explícitas de privados, credenciales y dependencias y se ejecutó `codegraph explore` antes de localizar código. No fue necesario inicializar ni reindexar. Cada worker repetirá esa comprobación; solo si falta índice/config ejecutará `codegraph init` tras validar también symlinks ajenos. Esta obligación no autoriza indexar privados.

## Contratos reutilizados y variante de datos

Sin cambio de wire en [MR](../contracts/local-api/matricula-regular.md), [LPD](../contracts/local-api/local-profile-dashboard.md), `shared/matricula-regular.*` ni `shared/local-profile-dashboard.*`. Mismos DTO, rutas, validadores, errores, `runId/actorId/sessionId`, revisión y scope. No crear contrato paralelo, API, base de datos, dependencia, credenciales ni endpoint de reset.

El coordinador registrará un adendum semántico LPD/PEM-1: la variante permite oferta/prematrícula e indicadores de requisitos diferentes, con historial coherente y sin matrículas precargadas. No altera la variante por defecto. `deudas` y `tutoria` siguen proyectando los envelopes vacíos existentes: esto **no** demuestra deuda pagada ni tutoría satisfecha. El gate académico usa `actor.institutional`/`actor.tutorship`. No inventar filas financieras para justificar el gate.

Formato de dominio **existente** de cada `fixtures` del paquete: `SyntheticFixture[]` de `backend/src/matricula-regular/profile.types.ts`; cada elemento contiene exactamente `profile: EnrollmentProfile`, `actors: ActorProfile[]`, `offer: OfferedCourse[]`. Usar esos tipos mediante import de tipo; no copiar sus schemas. Orden fijo SISTEMAS, SOFTWARE; actores A/B en cada una. Se mantienen:

- `SYN-SIS-A`, `SYN-SIS-B`, `SYN-SOFT-A`, `SYN-SOFT-B`; nombres actuales y `FISI/2026-II/regular-virtual`.
- `SYN-SIS-PLAN`, `SYN-SOFT-PLAN`; revisiones `MR-SYN-SIS-1` y `MR-SYN-SOFT-1`, necesarias para el evaluador actual.
- Ledger `PS-SEED-1`: 16 cursos `C01..C16`, 4 créditos cada uno; periodos e intentos PS-1, actas 01..09. Validar con el validador existente, sin ampliar su límite de nueve intentos.
- A: 8 aprobadas, 32 créditos; ponderado SIS 16.00/SOFT 16.75. B: 6 aprobadas, 24 créditos; ponderado SIS 12.67/SOFT 11.89; C07 una falla y C08 dos fallas.

**Derivación nueva y exclusiva de PEM**: partir de `createSyntheticAcademicDemoFixture`, clonar y derivar `approvedCourseIds`, `failedCourses` y `ponderado` de sus intentos explícitos. No inferir aprobación por nota. Contar cursos aprobados distintos; fallas anteriores a aprobación, regla PS-1; promedio ponderado de todos los intentos, redondeado dos decimales. Al no cambiar los intentos, se obtienen exactamente los valores anteriores.

Solo para **Sistemas** reemplazar los cuatro títulos/créditos/ciclos/tipos siguientes en el catálogo nuevo. Leer el plan mediante allowlist y requerir coincidencia de campos si una clave aparece repetida. Mantener IDs SYN y plan SYN; los códigos de origen solo están en la procedencia del paquete:

| Curso local | `codAsignatura` del archivo | Título tras trim | Créditos / ciclo / tipo |
| --- | --- | --- | --- |
| SYN-SIS-C09 | 20118041 | ALGORÍTMICA Y PROGRAMACIÓN ORIENTADA A OBJETOS | 4 / 4 / O |
| SYN-SIS-C10 | 20118051 | BASE DE DATOS | 4 / 5 / O |
| SYN-SIS-C11 | 20118066 | REDES, TRANSMISIÓN Y AUTOMATIZACIÓN Y CONTROL | 4 / 6 / O |
| SYN-SIS-C12 | 20118084 | INGENIERIA DE LA INFORMACIÓN | 4 / 8 / O |

La tabla fija solo estos campos, no importa sus prerrequisitos. Conservar grafo PS-1 `Cn -> C(n-4)` desde C05: es una simplificación local identificada, no una equivalencia con el plan del archivo. El resto del vocabulario y todo Software permanecen PS-1 inventado. Esta importación no mueve datos personales, escuela/plan oficiales ni grafo completo. Si falta/cambia un campo requerido, abortar con archivo/ruta de campo, sin fallback silencioso y sin volcar datos. La fuente existe; no se necesita fallback para esta implementación.

## Construcción exacta y casos por paquete

Oferta por escuela: C07..C13 del catálogo; `sectionId = courseId + '-S1'`, label `1`, docente sintético local, aula null. Todos los cursos tienen 4 créditos. Capacidad 10, ocupados 2; una reunión por curso: C07 lunes, C08 martes, …, C13 domingo (`day=1..7`), 08:00–09:00 (`startMinute=480,endMinute=540`). Horarios y cupos son inventados y controlados, nunca copiados de docentes o secciones del archivo.

Prematrícula A: C09,C10,C11,C12,C13; B: C07,C08,C09,C10,C11,C12,C13, con documentos exactamente coincidentes con oferta. Selección recomendada **A0=C09,C10,C11 (12 créditos)**; **B0=C07,C08,C09,C10 (16 créditos)**. Cada caso enumera `courseId/sectionId`, no índices visuales. A puede seleccionar sus prerrequisitos aprobados; B incluye ambos cursos desaprobados y satisface tutoría de C08 en la base.

Base: `preEnrollmentEnabled=true`, complete/plan/offer/history/equivalences conocidos; equivalencias vacías; requisitos institucionales `met`; `creditException={kind:'none',applicability:'not-applicable',sourceIds:['PEM-LOCAL-1']}`. B lleva `tutorship=[{courseId:C08,condition:'met'}]`; A tutorías vacías. No cuarta matrícula ni inscripción inicial. Usar reloj fijo en tests `2026-08-11T14:00:00.000Z`; launcher usa reloj existente que avanza desde esa base. Ventanas y sus fuentes existentes siguen intactas.

Añadir a cada `profile.sources` fuente `PEM-LOCAL-1` con `origin:'local-decision', class:null, reference` a este plan, `date:'2026-10-16', status:'local-only'`. Las reglas de actor que describen este seed usan esa fuente; completar entradas conocidas `EQUIVALENCES`, `CREDIT-LOAD`, `SCHEDULE`, `SECTION-CAPACITY`. Mantener IDs de reglas actuales para habilitar motor. No atribuir horarios inventados a testimonio P04-P05 ni mover fuentes normativas existentes. Cada paquete contiene cuatro casos, uno por actor; los cambios se aplican simétricamente por programa.

| `scenarioId` | Cambio respecto de base | Caso A en cada escuela | Caso B en cada escuela |
| --- | --- | --- | --- |
| regular | Ninguno | A0 → accepted | B0 → accepted |
| repitencia | Ninguno; documentar selección obligatoria y tutoría de dos fallos | A0 → accepted | B0 → accepted; C07/C08 incluidos, sin gap |
| tutoria | Solo B: tutoría C08 `unmet` | A0 → accepted | B0 → rejected, solo TUTORSHIP_REQUIREMENT_UNMET(C08) |
| prerrequisito | Ninguno; A elige siguiente curso aún no habilitado | C10,C11,C13 → rejected, solo PREREQUISITE_UNMET(C09,C13) | B0 → accepted |
| cruce | Horario de C10 igual al de C09, ambos 08:00–09:00 miércoles | A0 → rejected, solo SCHEDULE_CONFLICT(C09,C10) | B0 → mismo rechazo |
| cupo | C09 occupied=capacity=10 | A0 → rejected, solo SECTION_FULL(C09, sección C09-S1) | B0 → mismo rechazo |
| deuda | Solo B: institutional.debt=`unmet` | A0 → accepted | B0 → rejected, solo DEBT_REQUIREMENT_UNMET, IDs vacíos |
| docente-no-asignado | C09 con horario y teacher=null (testimonio 2026-10-22: se publica el horario antes que el docente) | A0 → accepted | B0 → accepted |
| prioridad | Ninguno; B omite ambas repitencias y elige C11 sin aprobar C07 | A0 → accepted | C09,C10,C11 → rejected, RETAKE_PRIORITY(C07), RETAKE_PRIORITY(C08) y PREREQUISITE_UNMET(C07,C11), tres causas |

`regular` y `repitencia` comparten estado deliberadamente: la segunda guía enseña el significado de B, no fabrica otro perfil. Cada actor tiene un caso explícito. Códigos y conjuntos indicados son exactos; `sourceIds=['PEM-LOCAL-1']` para estas causas/gaps. IDs de cursos completos y arrays ordenados/deduplicados según wire. Causa de cruce/prerrequisito/tutoría/prioridad no tiene sectionIds; SECTION_FULL sí. Ausencia de gaps y causas se verifica como `[]`. Nunca convertir pending en rechazo. Resultados definidos sobre corrida recién creada: los casos se ejecutan con reset por actor, evitando que un accepted anterior produzca ALREADY_ENROLLED.

**Aclaración PEM-1a del coordinador, 2026-10-16:** la ejecución HTTP detectó una contradicción del oráculo inicial de prioridad B: C11 requiere C07, aún desaprobado. Se agrega `PREREQUISITE_UNMET(C07,C11)` a las dos causas de prioridad, con el orden canónico existente. Se conservan selección, ledger, prerrequisitos y motor. Es un caso con bloqueos simultáneos; no se inventa aprobación para aislarlo. Diagnóstico comunicado por Luna y decisión explícita del coordinador, sin cambiar wire ni normativa.

## Generación y uso

Crear builder **puro**, sin FS/env/servicios, para construir paquetes a partir de los cuatro campos académicos seleccionados. El generador y launcher leen exclusivamente `datos-sinteticos/plan-estudios.json`, con ruta fija relativa al repo, `lstat` para rechazar symlink del archivo/carpeta y validación runtime de filas seleccionadas. No enumerar fuentes adicionales ni aceptar un directorio arbitrario. Nunca leer alumno, perfil, formulario, historial ni la programación para construir actores.

Formato de exportación exacto, local y ajeno al wire HTTP:

```ts
type EnrollmentScenarioBundle = {
  seedRevision: 'PEM-SEED-1'
  scenarioId: 'regular' | 'repitencia' | 'tutoria' | 'prerrequisito' |
    'cruce' | 'cupo' | 'deuda' | 'docente-no-asignado' | 'prioridad'
  clockBase: '2026-08-11T14:00:00.000Z'
  source: {
    path: 'datos-sinteticos/plan-estudios.json'
    sha256: string // archivo realmente leído, 64 hex
    selectedCourseCodes: ['20118041','20118051','20118066','20118084']
    status: 'local-only'
  }
  fixtures: SyntheticFixture[]
  cases: Array<{
    actorId: ActorProfile['actorId']
    selection: MatriculaRegularChoice[]
    expected: {
      state: 'accepted' | 'rejected' | 'configuration-pending'
      causes: MatriculaRegularCause[]
      gaps: MatriculaRegularGap[]
    }
  }>
}
```

Reutilizar tipos MR existentes para selection/causes/gaps; no declarar nuevos enums de motor. Orden determinista de casos SIS-A,SIS-B,SOFT-A,SOFT-B. No UUID, timestamp de ejecución, run ni session en bundle: se obtienen del backend al usarlo. No tratar `expected` como evidencia ejecutada.

Comandos a implementar:

```sh
pnpm --dir backend build
node scripts/generate-enrollment-scenarios.mjs
node scripts/start-local-profile-dashboard.mjs --scenario=tutoria
```

Generador escribe **realmente los nueve JSON** en `evidence/local/perfiles-escenarios-matricula/generated/<scenarioId>.json` y un `README.md` con perfiles, selecciones y resultados esperados, procedencia y límites. Mismas entradas producen bytes idénticos. No usar rutas arbitrarias de salida ni sobrescribir otras carpetas. Launcher `--scenario=<enum>` construye la misma variante con el loader compartido; sin flag conserva fábrica PS-1. Enum inválido aborta antes de build, sockets y lectura de fuente. Mostrar escenario y guía local en consola. La fábrica aislada añade únicamente `fixtures?: readonly SyntheticFixture[]` por import de tipo y clona el seed en cada reset; no añade lectura de archivos al grafo compilado ni registra providers extras. El loader de scripts queda fuera de ese grafo. Los JSON exportados usan directamente el formato existente que acepta esa opción; no añadir importación HTTP de bundles.

## Tareas, propiedad y aceptación

Un solo worker Luna High evita conflicto entre builder, scripts y pruebas. Handoff incluye este plan, AGENTS raíz/backend, `backend/.agents/skills/sum-nestjs-implement/SKILL.md`, revisión MR/LPD actual y adendum PEM del coordinador; no subdelegar. Se autoriza expresamente al worker los scripts y artefactos raíz enumerados, excepción acotada a la propiedad de carpeta backend. Cambios preexistentes del usuario deben conservarse.

| Tarea | Dependencia / archivos exclusivos | Criterio y comprobación |
| --- | --- | --- |
| PEM-P0, coordinador | Este plan y adendum `contracts/local-api/local-profile-dashboard.md` | Registrar variante opt-in sin cambios wire, UI ni PS-1 default. |
| PEM-B1, Luna High | P0; nuevos `backend/src/matricula-regular/enrollment-scenarios.ts`, `backend/test/enrollment-scenarios.spec.ts` | Nueve paquetes, cuatro actores cada uno; coherencia académica, source local, tabla exacta, clonación; fuente seleccionada validada y fixtures sin contaminación cruzada. |
| PEM-B2, mismo worker | B1; `backend/test/local-profile-dashboard-test-app.ts`, nuevo `backend/test/enrollment-scenarios-http.spec.ts` | Opción fixtures/reset fiel; reales GET catálogo, POST sesión, POST solicitud, GET resultado/reporte en servidor propio ephemeral. Todos los 36 casos, sin mocks, reset por actor. |
| PEM-S1, mismo worker | B1; nuevos `scripts/enrollment-scenarios.mjs`, `scripts/generate-enrollment-scenarios.mjs`; editar `scripts/start-local-profile-dashboard.mjs`; generated/ y README arriba | Generación real, determinista, solo plan permitido; CLI opt-in y error enum sin arranque. Sin flag conserva comportamiento. |
| PEM-V, coordinador | B2/S1; `evidence/local/perfiles-escenarios-matricula/verification.md`, registro workflow | Resultados reales criterio→escenario→esperado→actual; distinguir generación, HTTP e integración UI. No afirmar matrícula SUM real ni paridad visual. |

No editar `academic-demo.fixtures.ts`, `fixtures.ts`, motor, perfiles normativos, proyecciones LPD, shared, cliente, `.codex`, datos de origen, package/deps ni otros tests existentes. Si se necesita otro archivo, diagnosticar y devolver al coordinador antes de ampliar propiedad. No restaurar eliminaciones del usuario.

Aceptación obligatoria:

1. **PEM-A1:** existen nueve JSON y README; parsean, nombres corresponden enum, cada uno tiene cuatro actores únicos y dos scopes aislados; dos generaciones son idénticas. No archivos privados ni datos personales importados.
2. **PEM-A2:** cada actor deriva ledger, aprobados/fallas/promedio correctos; ninguna fila corriente inventada; fuente seleccionada aplicada solo a SIS C09..C12 y no a Software; otros campos idénticos al diseño.
3. **PEM-A3:** 36 casos por HTTP real producen exactamente estado/causas/gaps de tabla. Accepted: inscripción+reporte publicados y cada sección elegida incrementa 1. Rejected/pending: cero inscripción/reporte y ocupación intacta. Repetir requestId mismo payload devuelve mismo outcome y no añade ocupación; usar lookup correlacionado y reporte existente. No confundir respuesta HTTP200 con matrícula aceptada.
4. **PEM-A4:** reset retorna al seed de la variante, elimina sesiones/requests/reportes y genera run nuevo; cambio de actor/escuela no comparte historial ni picks. Paquetes y función no mutan entradas ni resultado previo.
5. **PEM-A5:** faltante/cambio estructural de fila seleccionada, créditos no finitos, duplicados contradictorios y symlink fallan con ruta/campo. No imprimir contenido de archivo. Probar loader usando temporales independientes creados por el test, sin editar datos-sinteticos.
6. **PEM-A6:** build/lint y bootstrap/PS-1 existentes siguen pasando; closure del módulo mantiene exclusión de FS/env/operator. `--scenario` inválido falla sin sockets. Ningún cambio en cliente o UI; se revisa diff.

Comandos previstos, con ambiente allowlist (`env -i` preservando solo PATH/HOME y herramientas de ejecución necesarias), sin heredar variables SNAPSHOT/PRIVATE/DATABASE/AUTH. Revisar scripts actuales antes de ejecutar:

```sh
pnpm --dir backend build
pnpm --dir backend lint
pnpm --dir backend exec vitest run test/enrollment-scenarios.spec.ts test/enrollment-scenarios-http.spec.ts test/local-profile-dashboard-bootstrap.spec.ts test/academic-demo-fixtures.spec.ts test/local-profile-projection.spec.ts
node --check scripts/enrollment-scenarios.mjs
node --check scripts/generate-enrollment-scenarios.mjs
node --check scripts/start-local-profile-dashboard.mjs
node scripts/generate-enrollment-scenarios.mjs
```

No ejecutar backend suite completa, snapshots spec, AppModule, exportadores ni matriz live. No adjuntarse a un localhost existente. La implementación no cambia cliente: build/lint cliente y browser son opcionales salvo que se reclame integración UI; para esa afirmación el coordinador debe verificar al menos accepted, rejected y pending sobre su propio launcher sintético y conservar mismos componentes. No atribuir checks unitarios ni HTTP a integración React/NestJS.

## Estado y límites

### Corrección PEM-1b: prematrícula validada antes de seleccionar

El usuario precisó en esta sesión que la matrícula toma los cursos del reporte de prematrícula y que este ya valida prerrequisitos. Fuente `testimony` del usuario, adoptada como requisito de coherencia de la simulación; no nueva observación de producción. Diagnóstico estático: la tabla cliente ya usa la intersección de prematrícula y oferta; el seed introducía C13 mediante una lista fija sin validar el historial. Corrección aislada asignada al principal, sin una funcionalidad nueva ni cambios visuales; reutilizar tipos, motor y componentes existentes.

Esta aclaración sustituye las listas de prematrícula y casos afectados anteriores: derivar de la oferta del plan los cursos aún no aprobados cuyos prerrequisitos consten aprobados en el historial sintético conocido. Los cuatro perfiles quedan con cuatro cursos cada uno: A=C09,C10,C11,C12; B=C07,C08,C09,C10. C13 no aparece en el reporte de prematrícula ni en la selección normal de matrícula. La oferta general puede conservarlo para otros perfiles; no equivale a habilitación individual.

El escenario `prerrequisito` mantiene su envío deliberadamente inválido de C13 como prueba negativa exclusivamente HTTP, ajena a los controles normales. El rechazo debe incluir COURSE_NOT_IN_PRE_ENROLLMENT(C13, sección C13-S1, fuente L-05) y PREREQUISITE_UNMET(C09,C13, fuente PEM-LOCAL-1). La guía debe advertir que C13 no es seleccionable desde la pantalla. El escenario `prioridad` B usa C08,C09,C10 (12 créditos), omite solo C07 y recibe únicamente RETAKE_PRIORITY(C07), manteniendo todos los prerrequisitos cumplidos y la tutoría base satisfecha. Sustituye PEM-1a para el caso de prioridad.

Aprobación medible: para ambas escuelas y los nueve paquetes, cada fila de prematrícula pertenece a la oferta, no está aprobada y cumple sus prerrequisitos; las consultas HTTP de `prematricula` y `matriculaInfo` entregan la misma prematrícula. A/B tienen las listas anteriores y C13 ausente. Los 36 casos HTTP, efectos, idempotencia y reset siguen pasando con los oráculos corregidos. Regenerar nueve JSON/README y comprobar reproducibilidad; build/lint y suites focalizadas. No cambiar cliente, motor, schemas, datos de origen ni PS-1 por defecto. La validación final del servidor permanece.

Resultado PEM-1b: build y lint backend pasan (cero errores, cuatro warnings en test ajeno); 27 pruebas focalizadas pasan, incluidos 36 casos HTTP y consultas correlacionadas de ambos reportes. La regresión falló primero con longitudes `[5,7,5,7]` frente a `[4,4,4,4]`, y pasó tras derivar la prematrícula. Los adaptadores cliente existentes de prematrícula y matrícula se ejecutaron con Context reales del motor para los 36 perfiles/escenarios y entregaron las mismas cuatro asignaturas, sin C13. Nueve JSON y README regenerados, con bytes idénticos en una segunda generación. No navegador, captura nueva ni afirmación de integración React completa. Sin ciclo de reparación adicional tras la verificación; ver [evidencia](../../../evidence/local/perfiles-escenarios-matricula/prematricula-coherence.json).

Planificación, PEM-P0/B1/B2/S1/V: **completadas**. Generados nueve JSON y README; 36 casos HTTP verificados (16 accepted, 16 rejected, cuatro configuration-pending), con idempotencia, efectos y reset. Build/lint backend, 27 pruebas focalizadas y dos Node pasan; regeneración byte por byte confirmada. El launcher regular pasó un smoke de documento/proxy HTTP, sin navegador ni ejecución React. Ver [resultados y límites](../../../evidence/local/perfiles-escenarios-matricula/verification.md) y [guía de uso](../../../evidence/local/perfiles-escenarios-matricula/generated/README.md). Sin cambios de pantallas, wire, motor ni archivos de origen.

El JSON de formulario inválido no bloqueó el alcance y permanece sin modificar. La procedencia del contenido es la confirmación del usuario, no una auditoría de su generador. Dependencias, cupos, selección, estados institucionales y tutoría son decisiones controladas locales; no se reconstruye ni verifica normativa, malla vigente, deuda real ni comportamiento SUM. Conservar esos límites al informar resultados.
