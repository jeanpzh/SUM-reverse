# API local: Reportes

- **ID/revisión:** `reportes-api-v1`, 2026-10-08; estado **lista para implementación local**, sin certificación SUM.
- **Alcance:** cinco lecturas de Reportes y lectura del resumen compartido requerido por el loader raíz. Implementación en el scaffold existente `backend/`; no crear ni renombrar a `server/`. Esta excepción de ruta es una decisión de la sesión.
- **Fuentes:** cinco especificaciones `screens/reportes-*.md`, notas `evidence/sum/reportes-*/structure.md`, candidatos `raw-types/reporte-{pre-matricula,matricula,horario}.ts`, endpoints y fixtures existentes en `client/src/data/`. Todo transporte, datos y reglas definidos abajo son `local-only`.
- **Observado:** rótulos, columnas, resumen, cuadrícula semanal y controles de descarga en prematrícula/matrícula. **Hipótesis previas:** métodos POST, formas candidatas y `numDia`; no corroboradas por una traza SUM. **Sin verificar:** filas, resultado/formato de descarga, validaciones, vacíos, errores, reglas académicas y persistencia SUM. `unknown[]` no demuestra la forma de evaluaciones; no existe tipo de deudas utilizable.

## Transporte y DTO de consulta

Prefijo común `/alumnoWebSum/v2`; las rutas son compatibles con el adaptador actual y se sirven exclusivamente en nuestra API. POST significa consulta, sin escritura. Todas devuelven **HTTP 200**, no el 201 predeterminado para POST. `Content-Type: application/json`.

| Clave cliente | Ruta POST tras el prefijo | `accion` obligatorio, literal exacto | `data` en éxito |
| --- | --- | --- | --- |
| `formulario` | `/informacion/formularioDatos` | `obtenerFormularioDatosMatricula` | Objeto Formulario definido abajo |
| `prematricula` | `/reportes/prematricula` | `obtenerAlumnoPrematricula` | `PrematriculaRow[]` |
| `matricula` | `/reportes/matricula` | `obtenerAlumnoMatricula` | Objeto Matrícula definido abajo |
| `horarios` | `/reportes/horarios` | `obtenerHorariosAsignatura` | `HorarioRow[]` |
| `evaluaciones` | `/reportes/evaluaciones` | `recuperarEvaluacionesCalificaciones` | `EvaluacionLocalRow[]` |
| `deudas` | `/reportes/deudas` | `obtenerAlumnoDeuda` | `DeudaLocalRow[]` |

`ReportQueryDto` representa exactamente `{ accion: string }`. Una validación runtime en el límite HTTP comprueba que es un único string igual al literal de la ruta. Ausencia, repetición, valor vacío o distinto: HTTP 400, `{ "message": "Acción de consulta inválida.", "codError": "INVALID_ACTION", "data": null }`. Query extra: 400 con `message: "Parámetro de consulta no admitido."`, `codError: "INVALID_QUERY"`, `data: null`. Body ausente o `{}` admitidos; cualquier otro body: 400 con `message: "La consulta no admite cuerpo de datos."`, `codError: "INVALID_BODY"`, `data: null`. Prioridad de validación: acción → query extra → body. No aceptar parámetros de alumno, periodo, escenario ni token. Usar validación propia pequeña sin añadir dependencias de validación.

Éxito: `{ "message": null, "codError": null, "data": <forma correspondiente> }`. Ningún campo descrito es opcional. Las únicas nulabilidades son las listadas expresamente. Las rutas inexistentes/métodos distintos conservan HTTP 404 de NestJS; no forman parte del envelope de consulta. El cliente presenta un error ante HTTP no exitoso, JSON/envelope/filas inválidos o `codError` no nulo, y utiliza `RouteError`/`Intentar de nuevo` existentes. Sin fallback silencioso a mocks para una clave HTTP.

## Formas y serialización exactas

Prematrícula y matrícula conservan los campos de los candidatos para reutilizar sus tipos/adaptadores. Adoptar esa forma es una elección propia, no un contrato SUM verificado. Fechas JSON son strings, nunca objetos `Date`.

**PrematriculaRow:** strings `codPlan`, `codAsignatura`, `desAsignatura`, `ind_etapa`; números `codFacultad`, `codEscuela`, `codEspecialidad`, `num_ciclo_ano_asig`, `num_creditaje`, `num_rep_plan_act`, `num_mat_equiv`, `num_rep_total`, `totales_creditos`, `codSeccion`; campos exactamente null `codArea`, `gs_cod_orient`, `gs_tip_asig`, `lisSeccion`. Todos los números son finitos; códigos, ciclo, sección y contadores enteros no negativos, ciclo/sección positivos; créditos no negativos.

**Matrícula:** `data` contiene exactamente `matricula: MatriculaRow[]`, `datosMatricula: { fechaMatricula: string, codOrientacion: string, tipoMatricula: string }`, `indMatHabilitadaLabPra: boolean`, `codFacultad: number`. `fechaMatricula` usa `YYYY-MM-DD`.

**MatriculaRow:** strings `desFacultad`, `desEscuela`, `codAsignatura`, `desAsignatura`, `codPlan`, `desPlan`, `nomDocente`, `codAula`, `sexo`, `apePatDocente`, `apeMatDocente`; números `codFacultad`, `codEscuela`, `codEspecialidad`, `codSeccion`, `creditoAsignatura`, `numRepitencias`, `numRepitenciasEquiv`, `creditosMatriculados`, `cicloEstudio`, `horario`; campos exactamente null `codSemestre`, `codAlumno`, `nomAlumno`, `apePatAlumno`, `apeMatAlumno`, `codTurno`, `tipoHorario`, `anioIngreso`, `correoIntitucional`, `etapa`, `usuarioMatricula`, `fechaMatricula`. Números finitos no negativos, ciclo/sección positivos enteros. No usar las banderas como permiso de matricular: este flujo solo consulta.

**HorarioRow:** strings `codAsignatura`, `desAsignatura`, `horaInicio`, `horaFin`, `dia`, `codTipoHoraAsignatura`, `desTipoHoraAsignatura`; números `codFacultad`, `codEscuela`, `codEspecialidad`, `codSeccion`, `color`, `numDia`; campos exactamente null `codSemestre`, `desFacultad`, `desEscuela`, `codPlan`, `desPlan`. Horas `HH:mm`, 00:00–23:59 e inicio menor que fin. `numDia` entero 1–7 = lunes–domingo, `dia` correspondiente en mayúsculas (`LUNES`, `MARTES`, `MIERCOLES`, `JUEVES`, `VIERNES`, `SABADO`, `DOMINGO`). Esta asociación y la distribución de eventos son locales. No calcular conflictos, cupos ni reglas de matrícula.

**EvaluacionLocalRow** (tipo nuevo propio, no editar `raw-types/reporte-evaluaciones.ts`):

```ts
type EvaluacionLocalRow = {
  ciclo: number
  codAsignatura: string
  desAsignatura: string
  tipoEvaluacion: string
  calificacion: number
  formula: string
}
```

`ciclo` positivo entero, `calificacion` finita; strings no vacíos. No imponer escala o cálculo de nota SUM. Tabla: ciclo, descripción, tipo, calificación con dos decimales, fórmula literal. `codAsignatura` sirve de identidad técnica y no agrega una columna.

**DeudaLocalRow** (tipo nuevo propio):

```ts
type DeudaLocalRow = {
  fechaRegistro: string
  periodoAcademico: string
  concepto: string
  montoInicial: string
  montoFinal: string
  observacion: string
}
```

`fechaRegistro`: fecha válida `YYYY-MM-DD` sin conversión de zona horaria; `periodoAcademico` y `concepto` no vacíos; importes decimales no negativos en strings que cumplen `^\d+\.\d{2}$`; `observacion` puede ser `''`. Mostrar fecha `DD/MM/YYYY`, importes `S/ ` más el string. Strings decimales evitan redondeo binario; soles es una elección de presentación local. No operaciones de cobro, pagos ni cálculo de saldo. Tabla en el mismo orden de campos declarado.

**Formulario** (solo soporte al resumen, no funcionalidad nueva): retornar una copia JSON equivalente al fixture actual `mockResponses.formulario` de `client/src/data/mocks/responses.ts` y su `mockStudent` de `mocks/student.ts`, snapshot 2026-10-08 registrado en el plan. Forma obligatoria: `data.alumno` con **todos** los campos y subobjetos de ese fixture, `data.formulario: {}`, `data.politicaPrivacidad: null`, `data.llenar: false`, y las nueve banderas booleanas `datosPersonalesCompletado`, `colegioCompletado`, `actividadProfesionalCompletado`, `dependenciaEconomicaCompletado`, `recursosEstudioCompletado`, `transporteCompletado`, `saludCompletado`, `interesAcademicoCompletado`, `contactoCompletado` en true. Campos leídos por resumen: `codAlumno`, `apePaterno`, `apeMaterno`, `nomAlumno`, `periodo`, `desFacultad`, `desEscuela`, `desEspecialidad`, `codPlan`, `desPlan`, todos strings. Mantener el tipo completo existente y no sustituirlo por un alumno parcial. Copiar el fixture sintético dentro de `backend/src/reportes/`, sin imports runtime de `client/` ni compartir estado mutable.

Cliente: definir `LocalReportEnvelope<T> = { message: null; codError: null; data: T }`, sustituir solo las entradas `ApiResponseMap.evaluaciones` y `.deudas` por envelopes locales tipados. Mantener los tipos actuales de las otras entradas y **los mocks existentes de evaluaciones/deudas vacíos**, para preservar suites actuales. Runtime valida campos consumidos por la UI en modo local, incluso arrays vacíos; filas locales malformadas no se convierten en "sin registros". Si se conserva el comportamiento opaco de `api` legacy, aislarlo del contrato local y no convertir filas desconocidas mediante una assertion silenciosa.

## Fixtures, persistencia e invariantes

Repositorio NestJS inyectable de fixtures de solo lectura, servicio de consultas y controlador/DTO/validación HTTP separados. Seed en arranque, sin base de datos, ORM, autenticación ni almacenamiento navegador. No sesión SUM ni clientes de red. Eliminar/desactivar `ObserveModule`/`ObserveInstrument` de plantilla y no configurar sus credenciales. Bootstrap sin telemetría saliente.

`REPORTES_FIXTURE` es configuración **de proceso**: ausente o `populated` = catálogo completo; `empty` = arrays de los cinco reportes vacíos; otro valor aborta arranque con diagnóstico. Formulario y metadatos de Matrícula se conservan en modo vacío. Sin endpoint reset ni selector de escenarios en producto. Reiniciar sin cambiar la configuración reproduce JSON equivalente; recargar/repetir/paralelizar lecturas no cambia el catálogo. Retornar copias para impedir mutaciones de consumidores.

- Prematrícula, matrícula y horarios poblados: reutilizar exactamente los fixtures existentes en `mockResponses` del snapshot; tres asignaturas `DEMO-001..003` (4 créditos cada una), ciclo/sección 1, docente de demostración, periodo del alumno `2026-2`, seis horarios. No importar módulos React.
- Evaluaciones pobladas: una fila `{ ciclo: 1, codAsignatura: 'DEMO-001', desAsignatura: 'Matemática I', tipoEvaluacion: 'Evaluación de demostración', calificacion: 16, formula: 'Calificación sintética, sin cálculo académico' }`.
- Deudas pobladas: una fila `{ fechaRegistro: '2026-08-10', periodoAcademico: '2026-2', concepto: 'Concepto de demostración', montoInicial: '100.00', montoFinal: '100.00', observacion: 'Registro sintético, sin pagos reales' }`.
- Integridad: alumno común `DEMO-001`, periodos consistentes, horarios y evaluación referencian asignaturas del catálogo. No inferir equivalencia entre cuotas, créditos, evaluación y reglas académicas.

Descargas existentes de prematrícula/matrícula generan CSV en el cliente con los headers/filas visibles recibidas; conservar `downloadCsv`, incluso CSV con solo headers en vacío. No endpoint de archivos. CSV es `local-only`; resultado SUM/PDF permanece sin verificar. Horarios, evaluaciones y deudas no agregan descargas.

Vacíos visibles locales: prematrícula/matrícula `No hay registros`, horarios `No hay horarios registrados.` manteniendo la rejilla, evaluaciones `No hay evaluaciones registradas.`, deudas `No hay deudas registradas.`. Un vacío real HTTP 200 no es error ni "datos no verificables".

## Integración local

Añadir modo explícito `local` a la configuración existente. En ese modo solo las seis claves de la tabla usan HTTP; el resto usa los mocks actuales. No reimplementar otras áreas para satisfacer el loader. Modos `mock` y `api` existentes mantienen comportamiento compatible; este flujo se verifica con `local`, y el modo `api` no autoriza producción.

`VITE_SUM_DATA_MODE=local`, `VITE_SUM_API_BASE_URL=/api`; aceptar base relativa local, rechazar URLs absolutas en este nuevo modo. Proxy Vite fijo `/api` → `http://127.0.0.1:3000`, quitando exclusivamente el prefijo `/api`. Configurar desarrollo y preview local con ese proxy. Backend liga `127.0.0.1`, puerto `PORT` o 3000; pruebas usan 3000. No CORS necesario por proxy mismo origen. Fetch de modo `local` usa `credentials: 'omit'` y conserva `AbortSignal`; no cookies ni headers de autenticación. No modificar el transporte de `api` por esta tarea.

Conservar `mock` como valor predeterminado de `readDataConfig` y `.env.example`, así como scripts `verify` actuales. Añadir `client/package.json` script `dev:local` que inicia Vite con ambas variables anteriores; un launcher Node pequeño o prefijo env compatible con este workspace basta. Ejecución reproducible en dos terminales: `pnpm --dir backend start:dev` y `pnpm --dir client dev:local`; documentarla en `backend/README.md`. Node/pnpm ya disponibles; no añadir dependencias ni instalar herramientas.

## Escenarios obligatorios de aceptación

Todos son `local-only`; actor sintético `DEMO-001`, sin efectos de escritura. Registrar comandos y resultados reales después de implementación, no en esta etapa documental.

| ID | Precondición/acción/espera | Resultado y lectura posterior |
| --- | --- | --- |
| R-HTTP | Backend populated; ejecutar las seis consultas con la acción correcta y esperar JSON. | HTTP 200/envelope/tipos exactos; reportes 3/3/6/1/1 filas; formulario completo; periodo 2026-2. |
| R-INVALID | Acción ausente, errónea y duplicada; query extra; body no vacío. | HTTP 400/código previsto por prioridad; consulta válida posterior conserva catálogo. |
| R-UI | Cliente modo local y proxy; abrir directamente y navegar a las cinco rutas. Esperar loader. | Resumen del backend y tablas 8/5/5/6 columnas o rejilla 7 días; cada fila muestra datos HTTP; evaluations/debts dejan de descartar filas. Requests reales de los cinco reportes y formulario, sin mock/interceptor de respuestas para acreditar integración. |
| R-EMPTY | Reiniciar backend con REPORTES_FIXTURE=empty y recargar cliente. | HTTP 200 arrays vacíos; resumen y metadatos presentes; cinco mensajes correctos; sin controles de escenario. |
| R-RETRY | Detener backend; abrir ruta sin caché y esperar error. Restaurar mismo proceso/configuración y pulsar Intentar de nuevo. | Error visible accesible, ningún dato inventado; retry vuelve a HTTP y muestra registros. Se puede demorar respuesta desde infraestructura de prueba para comprobar pending; no agregar demora al producto. |
| R-REPEAT | Dos consultas iguales, consultas concurrentes, recarga y reinicio populated. | JSON semánticamente equivalente; ningún cambio de matrícula, pagos ni fixtures. |
| R-CSV | Descargas de prematrícula y matrícula después de cargar populated y empty. | CSV local con headers exactos y filas visibles (solo headers si vacío); lectura posterior del backend idéntica. |
| R-GUARD | Navegar otra área en modo local y observar requests. | Claves ajenas permanecen en mocks; ningún contacto a SUM; sin llamadas de telemetría. |

Fidelidad visual integral sigue sin verificar: no hay referencia SUM sanitizada comparable de estas cinco pantallas. Las notas sustentan estructura/rótulos; las capturas locales futuras documentan la réplica.

## Extensión compatible Mi Información (2026-10-08)

`mi-informacion-api-v1` añade `data.secciones` al Formulario de Datos para sus ocho secciones. Se conservan todos los campos/valores previos, incluido formulario={} y flags. El handler pasa al módulo MiInformacion; ruta, acción, método y envelope no cambian ni se duplican. Esta extensión es local-only y no altera filas de los cinco reportes. Resultados de Reportes anteriores son históricos; el workflow Mi Información comprueba nuevamente compatibilidad HTTP.
