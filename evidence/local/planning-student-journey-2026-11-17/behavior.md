# E2E y auditoría UX: planificación → alumno

Fecha: 2026-11-17. Fuente `observed`, exclusivamente réplica local con datos sintéticos. Navegador: T3 Browser nativo. Código `6899e268efa3353447553240d544afb9663a4024`, árbol equivalente al merge de main `ba08183`. No se modificó código de aplicación ni se accedió al SUM de producción.

## Veredicto

**Recorrido principal completado, aceptación global pendiente.** Se generó, simuló con LLM real, regeneró, guardó, revisó, aprobó, publicó y activó una oferta de Sistemas 2027-I. El alumno `SYN-SIS-A` se matriculó mediante la UI en cuatro cursos, 12 créditos; su reporte y calendario personal muestran las ocho sesiones seleccionadas. La pantalla independiente «Programación de Asignaturas» falla con `LOCAL_FAILURE` y la proyección del horario personal pierde aulas.

No confundir este resultado con aprobación normativa: las ampliaciones de carga y ventanas son hipótesis explícitas de la simulación local; las conformidades y aprobación se registraron usando los roles simulados del prototipo.

## Entorno y procedencia

- Frontend propio 5966 → NestJS propio 3966 → Python propio 3967. Entorno mínimo explícito, sin cargar `.env` del repositorio ni variables snapshot. Almacenamiento temporal nuevo y exclusivo.
- `createDemoCatalog()` y escenarios construidos en `buildBuiltInEnrollmentScenarioBundles()`. `backend/src/matricula-regular/scenario-reference.seed.ts` declara confirmación del operador de datos enteramente sintéticos. Esta procedencia permite usar sus filas académicas; no convierte sus reglas en normativa oficial.
- LLM real: `bedrock_converse / us.amazon.nova-lite-v1:0`, tanto consulta como simulación respondieron `llm-assisted`. Se utilizó la credencial externa ya configurada; no se copió su contenido a evidencia.
- Escritorio 1280 × 800 CSS; móvil 390 × 844 CSS. PNG con escala de dispositivo 2. Capturas de diferentes posiciones de scroll, identificadas por paso; no son comparaciones de fidelidad con producción.
- Hubo dos interrupciones del proceso temporal de pruebas, sin causa demostrada. Se reinició con el mismo directorio sintético. Publicación, oferta y matrícula reaparecieron; fue necesario iniciar una nueva sesión del alumno. Se reprodujo el error de programación después del reinicio, independientemente de esas interrupciones.

## Criterios → comprobación → resultado

| Criterio | Comprobación real | Resultado |
| --- | --- | --- |
| Consulta sin ejecutar simulación | Respuesta de primera consulta sin `verifiedImpact`; UI «Impacto no simulado» | Cumple |
| Simulación explícita antes de aplicar | Cuatro casillas, «Simular selección», respuesta con impacto; después «Aplicar 4 seleccionadas y regenerar» | Cumple |
| Cobertura completa y sin cruces | 211 asignadas + 121 pendientes → 332 asignadas + 0 pendientes; comparación por pares de docente, ambiente y sección | Cumple, 0 cruces |
| Revisión y congelación explícitas | Guardar v1 → enviar ronda 1 → 82 conformidades individuales → `ready-for-approval` → aprobar v84 → publicar versión aprobada v85 | Cumple; borrador publicado v86, publicación 1 |
| Oferta procede de publicación | Activación desde publicación seleccionada; respuesta 56 cursos / 166 secciones con publicación y run vinculados | Cumple |
| Alumno recibe la oferta y puede matricularse | Acceso desde enlace de oferta, SYN-SIS-A, cuatro secciones 1, ejecutar y confirmar en UI | Cumple, 12 créditos |
| Horario personal corresponde a matrícula | Comparación de IDs y todos los días/minutos del reporte con las secciones seleccionadas | Cumple, 8 sesiones exactas |
| Programación consultable por alumno | Abrir Programación de Asignaturas, reintentar, repetir tras reinicio | **Falla: LOCAL_FAILURE** |
| Metadatos completos para asistir | Calendario personal frente a oferta con aulas | **Falla: aula «—»** |
| Persistencia al reiniciar | Reingreso a la oferta y consulta del reporte normal / matrícula publicada | Cumple para esta ejecución local |
| Móvil y teclado | 390 px sin desbordamiento global, menú cerrable; Tab en «Acciones» del planner con `:focus-visible` y outline 2 px | Parcial: calendario requiere scroll horizontal; no prueba WCAG completa |

Evidencia estructurada mínima: [acceptance.json](acceptance.json). No contiene claves, cabeceras de autenticación ni identificadores de sesión. `overallPassed: false` conserva el fallo global aunque el recorrido principal llegue al alumno.

## Pasos y pantallas capturadas

Cada enlace es una captura de esta ejecución. Las pantallas complementarias se verificaron por carga/estado visible, sin probar exhaustivamente todas sus acciones.

| Paso | Pantalla / acción | Salud / nota UX | Captura |
| --- | --- | --- | --- |
| 01 | Oferta: seleccionar 56 cursos | Advertencia: horas T/P/L en cero con datos «Completo» | [01](01-courses.png) |
| 02 | Docentes | Carga y disponibilidad visibles; 91 incorporados | [02](02-teachers.png) |
| 03 | Ambientes | 49 incorporados; capacidad y tipo visibles | [03](03-rooms.png) |
| 04 | Tabla de horario inicial | Correcto: búsqueda inconclusa, pendientes y cero cruces separados | [04](04-schedule-pending.png) |
| 05 | Consejero y selección | Cuatro opciones; autorización externa visible e impacto inicialmente sin simular | [05](05-advisor-selection.png) |
| 06 | Semana tras aplicar | Correcto: 166/166 secciones; mapa agregado con métrica y explicación | [06](06-week-complete.png) |
| 07 | Inspector de sección | Correcto: T, P y L con docente/aula/día/hora | [07](07-section-inspector.png) |
| 08 | Revisión antes de enviar | Fricción: primaria «Volver a Horario», aunque enviar ya es posible | [08](08-review-ready.png) |
| 09 | Revisión docente | Funciona; panel lateral y tabla requieren scroll para datos largos | [09](09-review-pending.png) |
| 10 | Condiciones de aprobación | 82/82 conformidades, cobertura completa; encabezado confunde versión con ronda | [10](10-approval-ready.png) |
| 11 | Publicación | Correcto: versión inmutable; publicación distinta de aprobación | [11](11-published.png) |
| 12 | Vista previa y oferta operativa | Funciona; activación queda muy abajo al desplegar tabla extensa | [12](12-publication-preview.png) |
| 13 | Acceso a oferta | Correcto: solo estudiantes de la oferta, datos/reloj sintéticos explícitos | [13](13-student-login.png) |
| 14 | Inicio del alumno | Correcto: SYN-SIS-A, plan y periodo de oferta | [14](14-student-home.png) |
| 15 | Programación de Asignaturas | **Falla funcional reproducible** | [15](15-student-programming-error.png) |
| 16 | Información de matrícula | Correcto: habilitada según reloj sintético; acceso a matrícula | [16](16-enrollment-info.png) |
| 17 | Selección de matrícula | Funciona: ocho cursos habilitados; secciones de publicación | [17](17-enrollment-courses.png) |
| 18 | Rechazo por solo 2 créditos | Regla explica mínimo 12/máximo 26; al cerrar se borra selección | [18](18-credit-validation.png) |
| 19 | Matrícula aceptada | Correcto: cuatro cursos / 12 créditos | [19](19-student-enrolled.png) |
| 20 | Horario personal | Ocho sesiones correctas; falta aula en todos los bloques | [20](20-student-personal-schedule.png) |
| 21 | Perfil | Carga sintética correcta; comprobación de lectura | [21](21-profile.png) |
| 22 | Historial | Carga sintética correcta, 64 asignaturas, 183 créditos aprobados | [22](22-history.png) |
| 23 | Formulario de datos | Estado vacío explícito; no permite verificar edición | [23](23-personal-form.png) |
| 24 | Ficha socioeconómica | Carga de datos sintéticos por sección; edición no probada | [24](24-socioeconomic.png) |
| 25 | Prematrícula | Documento sintético disponible; intención no ejercitada en este recorrido | [25](25-prematricula.png) |
| 26 | Evaluaciones | Vacío explícito, no equivale a fallo | [26](26-evaluations.png) |
| 27 | Deudas | Vacío explícito, no afirma deuda pagada | [27](27-debts.png) |
| 28 | Asistencias | Vacío explícito; calendario no implementado, limitación declarada | [28](28-attendance.png) |
| 29 | Tutoría | Vacío explícito; no certifica requisito cumplido | [29](29-tutoring.png) |
| 30 | Plan de estudios | Tabla carga; descarga no ejercitada | [30](30-study-plan.png) |
| 31 | Manuales | Listado carga; videos externos no abiertos | [31](31-manuals.png) |
| 32 | Reporte de matrícula tras reiniciar | Cuatro cursos / 12 créditos conservados | [32](32-student-report-persisted.png) |
| 33 | Alumno en ancho móvil, menú abierto | Menú superpuesto; puede cerrarse | [33](33-student-mobile.png) |
| 34 | Planner oscuro y móvil | Estado vacío legible; barra inferior y acciones disponibles | [34](34-planning-dark-mobile.png) |
| 35 | Publicación recuperada en planner | Solo lectura; sigue mostrando horas incorrectas y `r86` | [35](35-planning-restored-dark.png) |
| 36 | Calendario móvil, menú cerrado | Sin overflow de página; calendario horizontal, nombres truncados | [36](36-student-mobile-menu-closed.png) |

## Hallazgos priorizados y cómo corregirlos

### P1 · Programación del alumno falla con la oferta nueva

Pasos 15 y reproducción posterior al reinicio. `projectScenarioProgramming()` en `backend/src/local-profile-dashboard/scenario-reference-projection.ts` clona `actor.scenarioData.programming`, busca cada fila contra la oferta actual y lanza `Sección de programación sin oferta equivalente` cuando no existe. La publicación nueva tiene 166 secciones, pero quedan **67 filas de referencia sin correspondencia**, por ejemplo INE013 secciones 5/6 e INO201 secciones 3/4/5. El dashboard oculta la causa tras `LOCAL_FAILURE`.

Corrección propuesta: cuando el contexto es una oferta operativa, proyectar filas desde `snapshot.offer` y su procedencia de publicación, no desde el número de secciones de la referencia. Mantener el contrato y la pantalla SUM existentes. No silenciar el error saltando filas: eso podría mostrar horarios de referencia obsoletos. Aceptación: 56 cursos/166 secciones consultables, días y minutos iguales a publicación y vacantes actualizadas tras matrícula.

### P1 · La proyección pierde detalle de docente y aula

Pasos 07, 17 y 20. El reporte aceptado conserva `courseId`, `sectionId`, `schedule`, `teacher`, pero no aula por sesión; el calendario muestra «Sección 1 · —». Además `mapOffer()` en `operational-offer.factory.ts` asigna `teacher: first.teacherName` a toda la sección. La publicación de esta prueba contiene **15 secciones con más de un docente**: ese campo escalar no puede describirlas fielmente. La pérdida de multiplicidad está verificada en el adaptador, no se afirma que el alumno elegido haya cursado una de esas 15 secciones.

Corrección propuesta: conservar componente, docente, ambiente y referencia de sesión en la proyección operativa y en la instantánea aceptada. Mantener compatibilidad de campos actuales, extender contratos con validación y mostrar detalle por componente en las interfaces existentes. Aceptación: laboratorio con docente distinto llega al alumno con ambos docentes y aulas correctas; el reporte ya aceptado no cambia al publicar otra versión.

### P2 · Horas T/P/L incorrectas

Pasos 01 y 35. `AcademicPreparationCourses.tsx:190` busca prefijos `teor`, `pr`, `lab`, mientras las sesiones tipadas usan `T`, `P`, `L`. Por eso muestra ceros. Usar las clases canónicas del contrato compartido; distinguir dato ausente de cero real. Aceptación: suma por componente igual a duraciones del patrón seleccionado, incluyendo patrón alternativo y dato desconocido.

### P2 · Versión y ronda confundidas

Pasos 09–11 y 35. `planningSession.ts:661` forma `r${draft.version}`. Al registrar 82 respuestas, el encabezado pasa a `r84` y termina `r86`, aunque `review.round` sigue siendo 1. Mostrar «v86 · Publicada» y, si corresponde, «Revisión: ronda 1» en un campo separado. Aceptación: varias respuestas incrementan versión sin inventar nuevas rondas.

### P2 · Siguiente acción poco clara

Pasos 08 y 11–12. Revisión lista para enviar tiene «Volver a Horario» como primaria. Después de aprobar, «Publicar» queda deshabilitado hasta actualizar publicaciones manualmente. Tras publicar, el selector mantiene «Propuesta actual» y exige elegir la publicación para activar; desplegar su tabla empuja la activación detrás de cientos de filas.

Propuesta: priorizar «Enviar a revisión» cuando cumple, cargar automáticamente el historial requerido tras aprobar, seleccionar la publicación recién creada y acercar «Activar oferta» al estado de publicación. Conservar confirmaciones separadas y control de concurrencia. Deshabilitación debe mostrar el requisito pendiente y permitir reintento.

### P2 · Rechazo de matrícula borra trabajo

Paso 18. Cerrar el error por carga fuera de rango dejó todos los cursos sin sección y contador 0. Conservar selección tras rechazos recuperables; marcar cursos o condición que debe corregirse. Mostrar mínimo/máximo antes del envío. Aceptación: fallo de créditos o cruce conserva selección, no reserva cupos y permite corregir sin rearmar todo.

### P3 · Legibilidad y relojes en la demostración

Pasos 09, 20 y 36. Tabla lateral de revisión y calendario estrecho requieren desplazamientos y truncan nombres. Priorizar resumen de cada bloque y detalle expandible; en móvil ofrecer agenda por día como alternativa, conservando la vista SUM aprobada salvo autorización de cambio. El calendario usa `new Date()` en `WeeklySchedule.tsx`, mientras matrícula usa reloj sintético marzo de 2027: etiquetar o unificar el reloj del contexto para no mezclar «Hoy» real y fecha simulada.

## Reproducir con T3 Browser

1. Requisitos: dependencias del repo y `.venv` del engine instaladas, backend compilado con `pnpm --dir backend build`, puertos 3966/3967/5966 libres. Credencial Bedrock externa legible, nunca dentro del repo. El launcher usa la región/modelo de esta prueba.
2. Ejecutar desde raíz en una terminal persistente:

   ```sh
   SUM_E2E_BEDROCK_KEY_FILE=/ruta/externa/bedrock.key node evidence/local/planning-student-journey-2026-11-17/start-stack.mjs
   ```

   Ese archivo contiene el bearer Bedrock; la variable solo contiene su ruta. El launcher crea un directorio temporal nuevo, no carga `.env` del operador y no habilita snapshots. La línea `ready` indica la ruta de almacenamiento y PID para detener el proceso propio. Este comando prepara servicios; no automatiza por sí solo el navegador.
3. T3 Browser: `preview_status`, `preview_open` a puerto 5966 `/local/programacion-academica`. Seleccionar los 56 cursos. Recorrer Docentes y Ambientes. Generar.
4. Consultar consejero, seleccionar cuatro opciones, simular y aplicar. Esperar respuestas reales, sin usar temporizadores ficticios. Si una corrida no completa, registrar su resultado; no reducir demanda ni ampliar cargas fuera de las opciones medidas para forzar éxito.
5. Guardar, abrir Revisión docente, enviar. Cambiar rol simulado a Docente y registrar conformidad individual de los docentes participantes. Volver a Escuela. Abrir Aprobación. Aprobar, actualizar publicaciones y publicar con su confirmación independiente.
6. Elegir la publicación vigente, esperar vista previa y activar. Seguir «Abrir matrícula 2027-I», seleccionar SYN-SIS-A e ingresar. No activar otro escenario: crearía otro contexto.
7. Abrir Programación de Asignaturas y registrar el fallo actual. Abrir Información de Matrícula → Iniciar Matrícula.
8. Elegir sección 1 de SYN-SIS-C09, C10, C11 y C12. Total esperado 12 créditos. En esta ejecución no se cruzan; los horarios pueden variar entre regeneraciones. Confirmar días/minutos antes de ejecutar. Ejecutar matrícula y confirmar. El servidor debe aceptar o explicar el rechazo, nunca omitir reglas para terminar la prueba.
9. Abrir Reporte de Matrícula y Reporte de Horarios. Comparar cursos, secciones y todos los horarios contra la oferta seleccionada, no solo el texto «éxito». Capturar las rutas complementarias de la tabla. Probar 390 px, menú cerrable y Tab con foco visible.
10. Para repetición limpia detener con Ctrl+C y volver a lanzar: se crea otro directorio. Para prueba de recuperación, reutilizar únicamente el directorio sintético creado por este launcher mediante un arranque controlado equivalente; las sesiones se crean nuevamente. Nunca apuntar a un directorio de snapshots u operador.

## Límites y trabajo pendiente

- Se recorrieron las cinco áreas de planificación y las 16 rutas de alumno, además de acceso, matrícula y reporte local. Esto no cubre todos los subestados o acciones de cada pantalla: edición manual, CRUD de recursos, cada filtro, descarga, edición de perfil, intención de prematrícula, rechazo docente, segunda publicación y concurrencia entre alumnos quedan fuera de esta ejecución.
- Teclado y reflow son comprobaciones puntuales; no se ejecutó lector de pantalla ni auditoría WCAG completa, ni todas las combinaciones de tema/viewport por pantalla.
- Se identificaron mejoras y causas; no se implementaron correcciones ni se volvió a ejecutar la batería CI porque no se cambió código de aplicación. Los checks de esta entrega son integridad de artefactos, sintaxis del launcher y evidencia del recorrido real.
- La simulación propuso ampliar la carga de **24 docentes en esta corrida**. El número puede cambiar según la propuesta inicial; no es una autorización ni una recomendación institucional de cargas.
- La siguiente implementación debe preservar `docs/design-direction.md` en el planner, fidelidad visual y de interacción de las pantallas del alumno y reutilización de contratos/componentes existentes. Orden: proyección de programación → metadatos de sesión → horas/ronda → conservación de selección → acciones de publicación. Repetir este E2E con ambos estudiantes después de corregir.
