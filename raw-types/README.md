Son los tipos reales del SUM, extraídos del network/fetch/XHR del devtools
- Mi Perfil tab:
 ```text
 URL: https://sum.unmsm.edu.pe/alumnoWebSum/v2/informacion/perfil -> POST: https://sum.unmsm.edu.pe/alumnoWebSum/v2/informacion/perfil?accion=obtenerInformacionAlumno
 ```
 - Matricula tab:
 ```text
 Mi matricula -> POST:
 https://sum.unmsm.edu.pe/alumnoWebSum/v2/informacion/formularioDatos?accion=obtenerFormularioDatosMatricula
 -> matricula-formulario-datos.ts
 ```
 ```text
 POST: https://sum.unmsm.edu.pe/alumnoWebSum/v2/matricula/informacion?accion=obtenerInformacion -> matricula-info.ts
```
- Programación de asignaturas:
```text
POST:
https://sum.unmsm.edu.pe/alumnoWebSum/v2/matricula/programacion?accion=obtenerProgramacionAsignaturas
-> programacion-asignaturas.ts
```
- Reporte pre matricula
```text
https://sum.unmsm.edu.pe/alumnoWebSum/v2/reportes/prematricula?accion=obtenerAlumnoPrematricula
-> reporte-pre-matricula.ts
```
- Reporte matricula
```text
https://sum.unmsm.edu.pe/alumnoWebSum/v2/reportes/matricula?accion=obtenerAlumnoMatricula
-> reporte-matricula.ts
```
- Reporte Horario
```
https://sum.unmsm.edu.pe/alumnoWebSum/v2/reportes/horarios?accion=obtenerHorariosAsignatura
-> reporte-horario.ts
```
- Reporte evaluaciones
```
https://sum.unmsm.edu.pe/alumnoWebSum/v2/reportes/evaluaciones?accion=recuperarEvaluacionesCalificaciones
-> reporte-evaluaciones.ts
```
- Reporte deudas
```
https://sum.unmsm.edu.pe/alumnoWebSum/v2/reportes/deudas?accion=obtenerAlumnoDeuda
```
- Mis asistencias
```
https://sum.unmsm.edu.pe/alumnoWebSum/v2/asistencia?accion=obtenerResumenAsistencia
```
- Tutoria
```
https://sum.unmsm.edu.pe/alumnoWebSum/v2/tutoria?accion=obtenerListaAsignaturaTutoria
```
- Plan estudios
```
https://sum.unmsm.edu.pe/alumnoWebSum/v2/planEstudios?accion=obtenerPlanEstudios
```