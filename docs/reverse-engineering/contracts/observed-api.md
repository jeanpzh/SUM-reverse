# Contratos de comunicación declarados

## Estado de la evidencia

El inventario original no encontró HAR ni respuesta cruda. `raw-types/README.md` declara tipos extraídos de DevTools/fetch/XHR. El 2026-10-08, tras la declaración explícita de autorización del solicitante, REA observó sólo metadatos de seis consultas de lectura en SUM. [Evidencia nueva](../../../evidence/sum/matricula-compatibility/behavior.md) y [metadatos](../../../evidence/sum/matricula-compatibility/rea-network.json): formulario, Información de Matrícula, Programación y reportes de prematrícula/matrícula/horarios utilizan **GET**, con respuestas HTTP 200 en esa cuenta. No se capturaron cuerpos, cabeceras ni sesiones; las formas raw continúan sin cotejo contra snapshots reales.

Los tipos describen formas esperadas; no prueban el contenido completo de las respuestas, obligatoriedad, reglas ni versión del servidor. No contienen ejemplos reproducibles sanitizados. Los campos de identidad/contacto existen en tipos de referencia, pero sus nombres y valores no se copian aquí.

## Catálogo candidato

Raíz relativa declarada: `/alumnoWebSum/v2`. La columna Método indica exactamente qué declara el README.

| Pantalla/consulta | Ruta relativa | Acción declarada | Método declarado | Tipo asociado | Nivel |
| --- | --- | --- | --- | --- | --- |
| Perfil | `/informacion/perfil` | `obtenerInformacionAlumno` | POST | `MiPerfil` | Parcial: README y tipo, sin HAR. |
| Formulario matrícula/datos | `/informacion/formularioDatos` | `obtenerFormularioDatosMatricula` | POST | `MatriculaFormularioDatos` | Parcial; el README también llama a este recurso “Mi matrícula”, por lo que el alcance exacto del endpoint no es claro. |
| Información de matrícula | `/matricula/informacion` | `obtenerInformacion` | POST | `MatriculaInformacion` de `matricula-info.ts` | Parcial. |
| Programación | `/matricula/programacion` | `obtenerProgramacionAsignaturas` | POST | `MatriculaInformacion` de `programacion-asignaturas.ts` | Parcial; tipo con nombre exportado duplicado en archivo distinto. |
| Prematrícula | `/reportes/prematricula` | `obtenerAlumnoPrematricula` | No especificado | `ReportePreMatricula` | Parcial/inferido. |
| Matrícula | `/reportes/matricula` | `obtenerAlumnoMatricula` | No especificado | `ReporteMatricula` | Parcial/inferido. |
| Horarios | `/reportes/horarios` | `obtenerHorariosAsignatura` | No especificado | `ReporteHorario` | Parcial/inferido. |
| Evaluaciones | `/reportes/evaluaciones` | `recuperarEvaluacionesCalificaciones` | No especificado | `ReporteEvaluaciones`, `data: unknown[]` | Parcial; la forma de elementos no es conocida. |
| Deudas | `/reportes/deudas` | `obtenerAlumnoDeuda` | No especificado | Archivo de tipo no presente | Débil; respuesta desconocida. |
| Asistencias | `/asistencia` | `obtenerResumenAsistencia` | No especificado | `Asistencias` | Parcial/inferido. |
| Tutorías | `/tutoria` | `obtenerListaAsignaturaTutoria` | No especificado | `Tutoria`, `data: unknown[]` | Parcial; elemento no tipado. |
| Plan | `/planEstudios` | `obtenerPlanEstudios` | No especificado | `PlanEstudios` | Parcial/inferido. |

La tabla anterior conserva la declaración histórica del README. Para las seis consultas de lectura verificadas, GET observado prevalece sobre POST declarado o inferido. La API NestJS propia mantiene su contrato POST separado del método legacy. El cliente ya separa esos métodos según [MC-CONTRACT-1](local-api/matricula-compatibility.md); sus cinco schemas raw completos comparten validación con el backend y aceptan snapshots offline. [Resultados sintéticos](../../../evidence/local/matricula-compatibility/fullstack-verification.md). Los restantes métodos siguen pendientes de observación; no extrapolar GET o POST a acciones nuevas.

## Envelope y calidad de tipos

Los módulos tipados repiten `message`, `codError`, `data`; varios fijan los dos primeros a `null`. Es una forma declarada por los archivos, no validación de valores posibles. Casos incompletos:

- `reporte-deudas.ts` no existe en el inventario; la capa local conserva `unknown` deliberadamente.
- Evaluaciones y Tutorías declaran listas `unknown[]`; no se conocen las propiedades de cada elemento.
- Historial, Inicio, Ficha Socioeconómica y Manuales no aparecen en este catálogo; no afirmar que no tengan llamadas, solo que no hay contrato en los artefactos auditados.
- Tipos `Date` en declaraciones no demuestran instancias `Date` en JSON; el plan local los transforma en cadenas al tratar el transporte.
- No hay contrato observado para login, roles, CORS, expiración, errores, reintentos, paginación, cargas de PDF o acciones que escriban estado.

## Trazabilidad permitida para la réplica

El inventario inicial solo podía vincular los siguientes fragmentos. La nueva revisión añade las seis consultas GET/200, apertura visible del modal Horarios y scripts públicos de esas pantallas; [behavior.md](../../../evidence/sum/matricula-compatibility/behavior.md) distingue qué se observó en runtime, qué existe sólo en el código frontend y qué sigue sin verificarse.

1. **Acción/estado:** navegación a pantallas fue descrita por Playwright; controles mutadores permanecieron inactivos.
2. **Solicitud:** README ofrece rutas/acciones y tipos, pero no hay registro de solicitud por pantalla ni correlación temporal.
3. **Procesamiento frontend local:** `client/src/routes/*` usa loaders, `client/src/data/client.ts` selecciona mock/API y `transport.ts` valida un subconjunto de formas; esto es implementación local, no prueba del SUM.
4. **Resultado visible:** evidencia por pantalla describe tablas, artículos, formularios y dos estados visuales sanitizados; no hay enlace demostrado entre respuesta de red y contenido visible.

Usar el catálogo candidato como entrada de diseño, no como contrato SUM confirmado. Para la réplica NestJS, definir una API propia en `contracts/local-api/<slug>.md` con decisiones `local-only` y adaptar la capa de datos existente. Esto no requiere integrar la API SUM ni conocer su implementación privada.

Para corroborar contratos de referencia, preferir documentación o trazas proporcionadas ya sanitizadas. Una nueva observación de producción requiere la declaración explícita de entorno/cuenta, pantallas y acciones autorizadas según `AGENTS.md`, incluyendo red cuando corresponda; no requiere un documento institucional adicional. Mantener lectura solamente, sin auth/cookies/tokens, datos personales ni cuerpos sensibles. Si faltan observaciones, conservar el gap y continuar el backend propio con su contrato explícito.

