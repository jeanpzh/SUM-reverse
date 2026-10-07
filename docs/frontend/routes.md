# Student Route Inventory

Routes and labels were read from links visible on the student home screen. The student session later returned and these observed destinations loaded successfully:

| Area | Label | Observed destination |
| --- | --- | --- |
| Home | Inicio | `/alumnoWebSum/v2/inicio` |
| Information | Mi Información | `#` (group link in initial state) |
| Information | Mi Perfil | `/alumnoWebSum/v2/informacion/perfil` |
| Information | Historial Académico | `/alumnoWebSum/v2/informacion/historial` |
| Information | Formulario de Datos | `/alumnoWebSum/v2/informacion/formularioDatos` |
| Information | Ficha Socioeconomica | `/alumnoWebSum/v2/informacion/fichaSocioeconomica` |
| Enrollment | Matrícula | `#` (group link in initial state) |
| Enrollment | Información de Matrícula | `/alumnoWebSum/v2/matricula/informacion` |
| Enrollment | Programación de Asignaturas | `/alumnoWebSum/v2/matricula/programacion` |
| Reports | Reportes | `#` (group link in initial state) |
| Reports | Reporte Pre-Matrícula | `/alumnoWebSum/v2/reportes/prematricula` |
| Reports | Reporte Matrícula | `/alumnoWebSum/v2/reportes/matricula` |
| Reports | Horario de Asignaturas Matriculadas | `/alumnoWebSum/v2/reportes/horarios` |
| Reports | Reporte Evaluaciones | `/alumnoWebSum/v2/reportes/evaluaciones` |
| Reports | Reporte Deudas | `/alumnoWebSum/v2/reportes/deudas` |
| Attendance | Mis Asistencias | `/alumnoWebSum/v2/asistencia` |
| Tutoring | Mi Tutoría | `/alumnoWebSum/v2/tutoria` |
| Curriculum | Plan de Estudios | `/alumnoWebSum/v2/planEstudios` |
| Help | Manuales y Tutoriales | `/alumnoWebSum/v2/manuales` |

Attendance, tutoring, study plan, manuals, the four Information routes, two Enrollment routes, and all five Reportes routes were inspected. Report page structure and visible table headers are documented without retaining student-specific row values.

The home page also offers eight “Ver más...” shortcuts; their destinations were not captured. Do not infer routes from labels.
