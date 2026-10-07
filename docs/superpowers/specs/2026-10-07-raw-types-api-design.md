# Integración de raw-types, mocks y consultas API

## Objetivo y alcance aprobado

El cliente utilizará los contratos existentes de `raw-types/`, datos ficticios coherentes y una capa de consultas que reproduzca las rutas y acciones de `raw-types/README.md`. Las pantallas con contrato documentado consumirán esta capa. Los mocks serán el modo predeterminado; el modo API se activará mediante configuración explícita.

Se conserva el diseño actual, incluido el bento grid de Inicio. No se implementan autenticación, modificaciones de datos, matrícula, subida de archivos ni endpoints no documentados. Durante el desarrollo no se consulta SUM real.

## Contratos y representación de datos

- Importar los tipos directamente de los módulos de `raw-types/`; no duplicarlos ni modificar los archivos de referencia.
- Utilizar alias al importar tipos que comparten nombres, especialmente `MatriculaInformacion` de matrícula y programación.
- Los mocks se comprobarán con TypeScript contra los contratos; no utilizar conversiones forzadas para rellenar campos faltantes.
- Los campos `Date` de `InfoSemestre` se representarán como cadenas ISO en el transporte mediante un tipo mapeado que transforme recursivamente `Date` en `string`. Este tipo también se utilizará para los mocks. Los adaptadores de pantalla formatearán fechas sin afirmar que JSON devuelve instancias de `Date`.
- La capa de transporte preserva los nombres originales y el envelope `message`, `codError`, `data`; los adaptadores convierten únicamente los datos necesarios para la presentación.
- `reporte-deudas.ts` está vacío: su respuesta se mantendrá como `unknown`, con un mock vacío compatible con el envelope observado en los otros módulos, claramente documentado como supuesto. No se inventarán campos de deuda ni se afirmará disponer de un contrato real.
- Tutorías y evaluaciones declaran `unknown[]`: sus mocks serán listas vacías. No se accederá a propiedades de sus elementos sin un contrato posterior.

## Endpoints

Base relativa común: `/alumnoWebSum/v2`. La tabla fija ruta, acción y contrato de respuesta.

| Consulta | Ruta relativa | `accion` | Contrato |
| --- | --- | --- | --- |
| Perfil | `/informacion/perfil` | `obtenerInformacionAlumno` | `MiPerfil` |
| Formulario | `/informacion/formularioDatos` | `obtenerFormularioDatosMatricula` | `MatriculaFormularioDatos` |
| Información de matrícula | `/matricula/informacion` | `obtenerInformacion` | `MatriculaInformacion` de `matricula-info.ts` |
| Programación | `/matricula/programacion` | `obtenerProgramacionAsignaturas` | `MatriculaInformacion` de `programacion-asignaturas.ts` |
| Prematrícula | `/reportes/prematricula` | `obtenerAlumnoPrematricula` | `ReportePreMatricula` |
| Matrícula | `/reportes/matricula` | `obtenerAlumnoMatricula` | `ReporteMatricula` |
| Horarios | `/reportes/horarios` | `obtenerHorariosAsignatura` | `ReporteHorario` |
| Evaluaciones | `/reportes/evaluaciones` | `recuperarEvaluacionesCalificaciones` | `ReporteEvaluaciones` |
| Deudas | `/reportes/deudas` | `obtenerAlumnoDeuda` | `unknown` |
| Asistencias | `/asistencia` | `obtenerResumenAsistencia` | `Asistencias` |
| Tutorías | `/tutoria` | `obtenerListaAsignaturaTutoria` | `Tutoria` |
| Plan | `/planEstudios` | `obtenerPlanEstudios` | `PlanEstudios` |

El README especifica POST para las primeras cuatro consultas y omite el método en las restantes. Se implementará POST para las doce como supuesto explícito, coherente con el patrón documentado; el registro central de endpoints permitirá corregir el método si se aporta evidencia adicional. `accion` irá en la query. No se inventarán cuerpos ni parámetros de sesión.

## Capa de datos y configuración

- Módulos dentro de `client/src/data/`: contratos de transporte, registro de endpoints, transporte HTTP, API pública, fixtures de mocks y adaptadores de presentación. Separar los fixtures por dominio para evitar un archivo monolítico.
- `VITE_SUM_DATA_MODE=mock|api`; ausencia de configuración equivale a `mock`. Un valor no permitido provoca un error de configuración claro.
- `VITE_SUM_API_BASE_URL` es obligatorio en modo `api`. Debe ser una URL HTTP/HTTPS o un prefijo relativo para un proxy configurado por el operador. No usar el host de SUM como valor predeterminado.
- En modo `mock` se devuelven respuestas asincrónicas sin efectuar `fetch`, incluso si se proporciona una URL base.
- En modo `api`, utilizar `fetch` con el método registrado, `Accept: application/json`, `credentials: 'include'` y señal de cancelación cuando esté disponible. CORS, cookies y autenticación dependen del servidor/proxy del operador y se documentarán como requisitos de integración.
- Detectar estado HTTP fallido, HTML en lugar de JSON, JSON inválido, envelope ausente, `codError` no nulo y estructuras mínimas inválidas antes de entregar los datos a las pantallas.
- No convertir errores de API en mocks silenciosamente. La pantalla debe mostrar el fallo y permitir reintentar la carga.
- Los tipos estáticos no constituyen validación de datos externos; las comprobaciones de respuesta se documentarán como validación de estructura mínima, sin prometer validación exhaustiva de todos los campos.

## Mocks coherentes

- Un estudiante ficticio común, una facultad, programa, especialidad, plan `2018  ` y periodo académico compartidos.
- Cursos identificados por códigos estables, con créditos y ciclos compatibles entre plan, programación, prematrícula y matrícula.
- Matrícula con tres cursos; horarios y asistencias referidos a esos mismos cursos y secciones.
- Asistencias con presentes, tardanzas y faltas cuya suma coincide con el número de clases y porcentajes calculados a partir de esos recuentos.
- Programación con docentes ficticios, cupos y matriculados que no exceden el cupo; horarios con inicio anterior al fin y valores pertenecientes a las uniones literales de los contratos.
- Fechas, situación académica y controles de matrícula consistentes entre el formulario y la información de matrícula.
- `formulario` conserva el mapa numérico del contrato; no se asignarán claves inventadas a las etiquetas representativas actuales. Los controles de formulario utilizarán únicamente campos cuyo significado sea conocido.
- Evaluaciones, tutorías y deudas muestran estado vacío o datos no disponibles; eliminar las filas artificiales actuales que aparentan contratos conocidos.
- No generar cientos de filas únicamente para reproducir la altura observada: el volumen seguirá los datos ficticios coherentes.

## Integración de pantallas

- Usar loaders de TanStack Router para obtener datos por ruta y sus estados de carga/error. No añadir una nueva dependencia de caché o estado global.
- La ruta raíz obtiene el formulario para disponer del `alumno` compartido. Shell, Inicio y StudentSummary consumirán un modelo derivado de ese alumno, en lugar del objeto estático de `routes.ts`.
- La pantalla de formulario reutiliza la respuesta raíz y sus indicadores de completitud. Los campos de identidad y perfil con correspondencia conocida se muestran con los datos correspondientes; no se inventa la semántica del mapa `formulario`.
- Perfil consume `MiPerfil`; las listas personales y el CSV se derivan de su respuesta y la identidad compartida.
- Información de matrícula conserva las explicaciones existentes y presenta los datos documentados de cronograma, habilitación y perfil.
- Plan, programación, prematrícula, matrícula y asistencias transforman las respuestas tipadas en las filas actuales. Recuentos y descargas CSV se derivan de esas mismas filas.
- Horarios presenta eventos de la respuesta mediante una representación semanal dentro del componente actual; no añadir una biblioteca de calendario.
- Tutorías y evaluaciones representan su lista vacía documentada. Una respuesta no vacía de estructura desconocida muestra un mensaje de datos no interpretables sin inventar columnas.
- Deudas usa una presentación neutral mientras su contrato esté ausente; no transformar una respuesta desconocida en una declaración de que el estudiante no tiene deudas.
- Historial académico, ficha socioeconómica y manuales no tienen endpoints en este README. Sus contenidos siguen siendo fixtures de interfaz identificados como tales; cualquier identidad compartida procede del alumno cargado.
- Mantener independientes la configuración de navegación y los datos académicos. Actualizar nombres de funciones de descarga y documentación para que no describan todos los datos como fixtures cuando se active API.

## Validación y criterios de aceptación

1. `pnpm --dir client build` y `pnpm --dir client lint` pasan.
2. Los mocks compilados satisfacen los contratos importados sin duplicar interfaces.
3. Pruebas de la capa de datos verifican las doce rutas/acciones/métodos, ausencia de red en modo mock, construcción de URL base, errores HTTP/JSON/envelope, cancelación y tratamiento de fechas JSON.
4. Pruebas de coherencia comprueban cursos/secciones compartidos, recuentos y porcentajes de asistencia, y límites de cupos.
5. La verificación local existente comprueba rutas, navegación y CSV en modo mock sin solicitudes externas. Si el sandbox impide iniciar servidor/navegador, solicitar la autorización específica para esa ejecución y reportar su resultado real.
6. README del cliente y `.env.example` explican modos, base URL, supuesto POST, contratos incompletos y requisitos de proxy/CORS. No incluir credenciales ni datos reales.
7. Los datos visibles y CSV proceden de la misma respuesta cargada; las pantallas documentadas no siguen generando filas académicas independientes.

## Secuencia de trabajo

Primero contratos y mocks; después transporte y funciones API; luego loaders e identidad compartida; finalmente integración de pantallas, documentación y validación. La implementación será en la sesión actual, siguiendo un plan escrito tras la revisión de esta especificación.
