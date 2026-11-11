# Escenarios completos de matrícula

Semillas sintéticas incorporadas: 97 filas del plan (85 cursos), 165 filas de programación y 64/65 intentos académicos en nueve periodos por perfil. Los originales de datos-sinteticos/ no se modifican.

```sh
docker compose -f compose.local.yaml up --build
```

Abre http://localhost:5180 y selecciona escenario y estudiante. Cada inicio reinicia la prueba local. No es necesario generar ni montar estos JSON.

Sistemas conserva el plan completo. Software usa la misma base con escuela adaptada como decisión local, no como plan oficial verificado. Solo las primeras secciones de ocho cursos tienen ajustes controlados de horario/cupo para reproducir los escenarios.

| Perfil | Historial | Aprobadas | Ponderado |
| --- | ---: | ---: | ---: |
| SYN-SIS-A | 64 | 60 | 15.72 |
| SYN-SIS-B | 65 | 58 | 13.55 |
| SYN-SOFT-A | 64 | 60 | 15.73 |
| SYN-SOFT-B | 65 | 58 | 13.53 |

La prematrícula se deriva del historial y los prerrequisitos del plan. C13 depende de C09 y no se puede elegir en la interfaz. El caso HTTP negativo lo envía deliberadamente fuera del documento. Las secciones recomendadas se indican en selection de cada caso.

| Escenario | Actor | Selección | Resultado esperado | Causas / gaps esperados |
| --- | --- | --- | --- | --- |
| regular | SYN-SIS-A | C09, C10, C11, C12 | accepted | —; gaps: — |
| regular | SYN-SIS-B | C07, C08, C09, C10 | accepted | —; gaps: — |
| regular | SYN-SOFT-A | C09, C10, C11, C12 | accepted | —; gaps: — |
| regular | SYN-SOFT-B | C07, C08, C09, C10 | accepted | —; gaps: — |
| repitencia | SYN-SIS-A | C09, C10, C11, C12 | accepted | —; gaps: — |
| repitencia | SYN-SIS-B | C07, C08, C09, C10 | accepted | —; gaps: — |
| repitencia | SYN-SOFT-A | C09, C10, C11, C12 | accepted | —; gaps: — |
| repitencia | SYN-SOFT-B | C07, C08, C09, C10 | accepted | —; gaps: — |
| tutoria | SYN-SIS-A | C09, C10, C11, C12 | accepted | —; gaps: — |
| tutoria | SYN-SIS-B | C07, C08, C09, C10 | rejected | TUTORSHIP_REQUIREMENT_UNMET (C08); gaps: — |
| tutoria | SYN-SOFT-A | C09, C10, C11, C12 | accepted | —; gaps: — |
| tutoria | SYN-SOFT-B | C07, C08, C09, C10 | rejected | TUTORSHIP_REQUIREMENT_UNMET (C08); gaps: — |
| prerrequisito | SYN-SIS-A | C10, C11, C12, C13 | rejected | COURSE_NOT_IN_PRE_ENROLLMENT (C13); PREREQUISITE_UNMET (C09,C13); gaps: — |
| prerrequisito | SYN-SIS-B | C07, C08, C09, C10 | accepted | —; gaps: — |
| prerrequisito | SYN-SOFT-A | C10, C11, C12, C13 | rejected | COURSE_NOT_IN_PRE_ENROLLMENT (C13); PREREQUISITE_UNMET (C09,C13); gaps: — |
| prerrequisito | SYN-SOFT-B | C07, C08, C09, C10 | accepted | —; gaps: — |
| cruce | SYN-SIS-A | C09, C10, C11, C12 | rejected | SCHEDULE_CONFLICT (C09,C10); gaps: — |
| cruce | SYN-SIS-B | C07, C08, C09, C10 | rejected | SCHEDULE_CONFLICT (C09,C10); gaps: — |
| cruce | SYN-SOFT-A | C09, C10, C11, C12 | rejected | SCHEDULE_CONFLICT (C09,C10); gaps: — |
| cruce | SYN-SOFT-B | C07, C08, C09, C10 | rejected | SCHEDULE_CONFLICT (C09,C10); gaps: — |
| cupo | SYN-SIS-A | C09, C10, C11, C12 | rejected | SECTION_FULL (C09); gaps: — |
| cupo | SYN-SIS-B | C07, C08, C09, C10 | rejected | SECTION_FULL (C09); gaps: — |
| cupo | SYN-SOFT-A | C09, C10, C11, C12 | rejected | SECTION_FULL (C09); gaps: — |
| cupo | SYN-SOFT-B | C07, C08, C09, C10 | rejected | SECTION_FULL (C09); gaps: — |
| deuda | SYN-SIS-A | C09, C10, C11, C12 | accepted | —; gaps: — |
| deuda | SYN-SIS-B | C07, C08, C09, C10 | rejected | DEBT_REQUIREMENT_UNMET; gaps: — |
| deuda | SYN-SOFT-A | C09, C10, C11, C12 | accepted | —; gaps: — |
| deuda | SYN-SOFT-B | C07, C08, C09, C10 | rejected | DEBT_REQUIREMENT_UNMET; gaps: — |
| docente-no-asignado | SYN-SIS-A | C09, C10, C11, C12 | accepted | —; gaps: — |
| docente-no-asignado | SYN-SIS-B | C07, C08, C09, C10 | accepted | —; gaps: — |
| docente-no-asignado | SYN-SOFT-A | C09, C10, C11, C12 | accepted | —; gaps: — |
| docente-no-asignado | SYN-SOFT-B | C07, C08, C09, C10 | accepted | —; gaps: — |
| prioridad | SYN-SIS-A | C09, C10, C11, C12 | accepted | —; gaps: — |
| prioridad | SYN-SIS-B | C08, C09, C10, C14 | rejected | RETAKE_PRIORITY (C07); gaps: — |
| prioridad | SYN-SOFT-A | C09, C10, C11, C12 | accepted | —; gaps: — |
| prioridad | SYN-SOFT-B | C08, C09, C10, C14 | rejected | RETAKE_PRIORITY (C07); gaps: — |

Revisión: PEM ampliado. source.referenceFiles conserva los hashes de los dos JSON académicos sintéticos utilizados.
