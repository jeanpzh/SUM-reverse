# Matrícula regular con interfaz SUM — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alinear el recorrido local de matrícula regular del perfil sintético (Información de Matrícula → registro → secciones → confirmación → éxito/error → reporte) con las pantallas SUM aportadas el 2026-10-14 y con el testimonio de esa fecha, sin presentar decisiones locales como comportamiento SUM.

**Architecture:** Se amplía el contrato MR-CONTRACT-2 con campos de presentación **opcionales** (MR-CONTRACT-3), y el backend sintético los completa. En el cliente se agregan módulos de datos puros (formato, tabla y reporte) con pruebas, más componentes presentacionales con estilo SUM. Estos reemplazan la vista genérica de `/local/matricula-regular`, la vista local de Información de Matrícula y el reporte posterior, y conservan intactos el flujo de envío, recuperación (L-04) y reglas en servidor. El store de sesión del perfil pasa a guardar la identidad por pestaña y a renovarla al recargar o al volver a la pestaña (L-07).

**Tech Stack:** React 19, TanStack Router, TypeScript 6, Vite 8 (`client/`); NestJS + Vitest (`backend/`); validadores compartidos ESM (`shared/matricula-regular.mjs`); pruebas de datos con `node --test`; Playwright 1.63 headless solo en la verificación integrada.

**Spec:** [spec 001](../../../specs/001-matricula-regular-fisi/spec.md), [spec 002](../../../specs/002-local-profile-dashboard/spec.md), evidencia nueva [structure.md](../../../evidence/sum/matricula-regular/structure.md) y [behavior.md](../../../evidence/sum/matricula-regular/behavior.md) (creadas en la Task 1).

**Roles:** plan redactado por el agente principal (Claude Code, Opus 5.5) el 2026-10-14. El perfil `sum-planner` (GPT-6.1 Sol High) que pide `AGENTS.md` §5 no está disponible en Claude Code, así que no se simula esa delegación. La implementación la ejecuta el método que elija el usuario (subagentes o nativo).

---

## Evidencia y decisiones nuevas

| ID | Fuente | Clase | Alcance y límites |
| --- | --- | --- | --- |
| O-UI-01 | Imagen #30: interfaz SUM propia del usuario, ya matriculado, 2026-10-14 | observed | Información de Matrícula fuera del periodo con matrícula registrada; periodo 2026-2; sin identificadores visibles. |
| V-01…V-08 | Imágenes #31–#38: fotogramas de una grabación de terceros | observed | Ciencias Administrativas, plan 2018, periodo 2023-1. Los originales contienen nombres de estudiante y docentes y **no se copian**. No acreditan FISI 2026-II. |
| T-01 | Testimonio del usuario, 2026-10-14 | testimony | Error al ejecutar → alerta con la causa (cruce de horarios, sin cupo en sección X) y regreso a matrícula. Cambiar de pestaña o recargar → temporizador a 15 min. |

Correspondencia de imágenes: #31→V-01, #32→V-02, #33→V-03, #34→V-04, #35→V-05, #36→V-06, #37→V-07, #38→V-08.

| Decisión | Definición local (`local-only`) | Base |
| --- | --- | --- |
| L-07 | La pestaña guarda solo `{runId, actorId, sessionId}` en `sessionStorage` (`lp:session`). La sesión se renueva (a) al recargar, antes de enrutar; (b) al volver la pestaña a `visible`; (c) en la redirección tras éxito. La navegación del router, los GET y el reloj no renuevan. Se elimina el botón «Renovar sesión». Una identidad ausente, inválida, vencida o de otra ejecución se borra y se muestra el selector. | T-01; V-07→V-08 (00:13:17 → 00:14:48). Sustituye LP-A04/LP-A05. «Pestaña» se interpreta como pestaña del navegador (hueco). |
| L-08 | El rechazo se muestra como alerta «Aviso» con icono de error, la lista de todas las causas (L-01) y un botón «ACEPTAR». Al cerrarla, la elección queda vacía y el contexto se vuelve a leer (L-06). | T-01; inferencia autorizada en spec 001 (M-01). Sin literal SUM. |
| L-09 | El botón verde «Horarios» del modal despliega una fila con el horario de la sección. | V-04 muestra el botón; no se observó su efecto. |
| L-10 | El aviso de éxito redirige solo al reporte a los 2000 ms. | V-07; duración no medida. |
| L-11 | Si la matrícula está habilitada y ya existe matrícula registrada, se muestra el mensaje «Usted registra matrícula…» y no el botón «Iniciar Matrícula». | Combinación no observada. |
| L-12 | «Búsqueda» filtra filas por subcadena, sin distinguir mayúsculas ni tildes. | V-02/V-08 muestran el campo; su semántica no se observó. |
| L-13 | Ciclo, tipo, número de sección, docente y aula de los fixtures son sintéticos. SYN-SOFT-B tiene una desaprobación en SYN-SOFT-C1, para que se vea la fila obligatoria. | Datos de demostración. |

**Pantallas cuyo cambio se autoriza en este plan** (requiere la aprobación del usuario al revisar el plan):

- `/alumnoWebSum/v2/matricula/informacion`, solo con el perfil sintético activo.
- `/local/matricula-regular`.
- `/local/matricula-regular/reporte/$enrollmentId`.
- Cabecera del Shell con el perfil sintético activo: reloj, nombre y Salir, sin botón «Renovar sesión».

**No se autorizan:** `EnrollmentInfo` en modo legado o de snapshots, `/alumnoWebSum/v2/reportes/matricula`, el login ni las demás pantallas. Su alineación queda como trabajo posterior.

## Global Constraints

- No leer, listar, indexar ni usar `datos-reales/`. No arrancar el backend con `MATRICULA_SNAPSHOT_DIR`. No inspeccionar SUM en producción ni conectarse al navegador CDP `127.0.0.1:9222`.
- Datos: solo fixtures sintéticos (`SYN-*`). No copiar nombres, códigos ni capturas originales de V-01…V-08 al repositorio; usar `STUDENT_NAME`, `TEACHER_NAME` y `COURSE_CODE`.
- Fidelidad: reutilizar Shell, `PageTitle`, `StudentSummary`, `DataTable`, `DownloadButton` y las clases `course-schedule-dialog*`. No rediseñar pantallas no autorizadas. Las decisiones L-07…L-13 se rotulan `local-only` en código y documentos.
- Estilo: dos espacios, comillas simples, sin punto y coma; TypeScript estricto; componentes en PascalCase; sin dependencias nuevas.
- Contrato: los campos MR-CONTRACT-3 son **opcionales**; un productor MR-CONTRACT-2 sigue siendo válido y la UI muestra `--`.
- Formatos de fecha observados: «Fecha del Sistema» `AAAA-MM-DD HH:mm:ss`; inicio, fin y «Fecha y Hora» `DD/MM/AAAA HH:mm:ss`; zona `America/Lima`; periodo `AAAA-N` (`2026-II` → `2026-2`).
- Literales observados (copiar exactos): ver las Tasks 5–8; provienen de O-UI-01 y V-01…V-08.
- **No hacer commits:** el árbol de trabajo contiene trabajo del usuario sin confirmar (`backend/src/matricula-regular/`, `client/src/screens/RegularEnrollment.tsx`, etc. están sin seguimiento). Cada task termina con un punto de control sin commit.
- Comandos de comprobación: `pnpm --dir client build`, `pnpm --dir client lint`, `pnpm --dir client test:data`, `pnpm --dir backend build`, `pnpm --dir backend lint`, `pnpm --dir backend test`.
- Node 24 y pnpm, desde la raíz del worktree.

## Review Focus

1. **Recarga con una sesión que ya venció en el servidor:** debe mostrar el selector y borrar `lp:session`, sin pantalla activa rota ni sesión nueva creada. Prueba `resume_expired_or_invalid` (Task 4).
2. **Sección llena (`occupied === capacity`):** sigue siendo seleccionable, y el rechazo SECTION_FULL llega al ejecutar (testimonio B-03 de spec 001). Prueba `full sections stay selectable` (Task 6).
3. **Búsqueda con tildes o mayúsculas** («ingles», «INGLÉS»): debe encontrar «Inglés». Prueba `search ignores case and accents` (Task 6).
4. **Medianoche en Lima:** debe formatearse `00:00:00`, nunca `24:00:00`. Prueba `midnight in Lima` (Task 5).
5. **Payload MR-CONTRACT-2 sin campos nuevos** (otros productores o pruebas existentes): debe validarse y mostrar `--`, el `sectionId` y `-- --, --`. Pruebas en las Tasks 2, 6 y 8.

---

### Task 1: Registrar evidencia, testimonio y revisiones de contrato

**Files:**
- Create: `evidence/sum/matricula-regular/structure.md`
- Create: `evidence/sum/matricula-regular/behavior.md`
- Modify: `specs/001-matricula-regular-fisi/spec.md` (sección Clarifications)
- Modify: `specs/002-local-profile-dashboard/spec.md` (filas LP-A04 y LP-A05)
- Modify: `docs/reverse-engineering/contracts/local-api/local-profile-dashboard.md` (sección añadida al final)
- Modify: `docs/reverse-engineering/contracts/local-api/matricula-regular.md` (sección añadida al final)

**Interfaces:**
- Consumes: nada.
- Produces: IDs O-UI-01, V-01…V-08, T-01 y L-07…L-13, citados por el código y las pruebas de las Tasks 2–9.

- [ ] **Step 1: Crear `evidence/sum/matricula-regular/structure.md`**

```markdown
# Matrícula regular — estructura observada (#30–#38)

Registro: 2026-10-14. Fuente: imágenes aportadas por el usuario en la conversación. Las imágenes
no se copiaron al repositorio; aquí solo hay descripciones textuales sanitizadas.

## Procedencia

| ID | Imagen | Origen declarado | Facultad / periodo visibles | Clase | Límites |
| --- | --- | --- | --- | --- | --- |
| O-UI-01 | #30 | Interfaz SUM propia del usuario, ya matriculado | Periodo 2026-2; facultad no visible (FISI según el usuario) | observed | Un estado: matrícula registrada fuera del periodo. Sin identificadores. |
| V-01–V-08 | #31–#38 | Fotogramas de una grabación de terceros (marcas de grabador y de editor de video) | Ciencias Administrativas, plan 2018, periodo 2023-1, fecha del sistema 2024-01-23 | observed | Otra facultad y periodo. Los originales contienen nombres de estudiante y docentes (no copiados). No acredita FISI 2026-II. |
| T-01 | — | Testimonio del usuario | FISI (declarado) | testimony | Sin captura del error ni del temporizador. |

## O-UI-01 — Información de Matrícula con matrícula registrada (#30)

Ruta SUM: `/alumnoWebSum/v2/matricula/informacion`.

- Título centrado «Información de Matrícula».
- Tarjeta izquierda: «Información importante acerca del módulo de Matrícula Vía Web» y cinco apartados:
  1. «Control de Cronograma de Matrícula»: «Verificación de Fechas de Inicio y Fin de Matrícula del Período Vigente y de Acceso al Módulo de Matrícula.»
  2. «Control de Acceso de Facultad»: «Verificación de la Programación Interna establecida por la Oficina de Matrícula de su Facultad.»
  3. «Control de Pre-Matrícula»: «Verificación del Registro de Pre-Matrícula el cual debe haber sido procesado por la Oficina de Matrícula de su Facultad. De no existir debe acercarse a la Oficina de Matricula personalmente.»
  4. «Control de Deudas Registradas»: «Verificación de registros de deudas de dinero o de material bibliográfico. Esta información nos la remite la Oficina de Matrícula de su facultad. De registrar deudas pendientes debe acercarse personalmente a la Oficina de Matrícula de su Facultad.»
  5. «Interfaz de Matrícula»: «Presentación de Asignaturas de Pre-Matrícula y secciones abiertas. **Efectuar Matrícula** registrará su matrícula. Si la Matrícula se efectúa **satisfactoriamente**, se mostrará automáticamente el Reporte de Matrícula vigente, de lo contrario mostrará un error.»
- Tarjeta derecha:
  - Franja roja «MATRICULA INTERNET INHABILITADA».
  - Cuatro recuadros lila en dos columnas: «Periodo Académico» (`2026-2`), «Fecha del Sistema» (`AAAA-MM-DD HH:mm:ss`), «Inicio de Matrícula» (`10/08/2026 06:00:00`) y «Fin de Matrícula» (`14/08/2026 23:55:00`).
  - Recuadro celeste «Usted registra matrícula en el presente semestre» seguido del enlace «Ver Matrícula».

## V-01 — Información de Matrícula habilitada (#31)

Misma estructura. La franja es verde, «MATRICULA INTERNET HABILITADA», y en lugar del recuadro celeste aparece el botón azul «Iniciar Matrícula».

## V-02 — Registro tras «Iniciar Matrícula» (#32)

- Cabecera: temporizador `HH:MM:SS` descendente, `STUDENT_NAME` con desplegable y «Salir».
- Recuadros del estudiante: Especialidad y Plan de Estudios. Periodo, Facultad y Programa se ven en V-08.
- Aviso gris con icono de información: «Nota Importante: Después de efectuar su matrícula, debe acercarse a la Oficina de Matrícula de su facultad para recoger su Reporte Oficial de Matrícula y entregar toda la documentación que haya sido especificada por su facultad (constancias, comprobantes de pagos, etc.); de lo contrario, su matrícula será observada.»
- Aviso amarillo: «(*) Asignatura Obligatoria por presentar una o más repitencias, Art. 18 Reglamento General de Matrícula.»
- Campo «Búsqueda:» a la derecha.
- Columnas de la tabla:
  - Ciclo (insignia gris).
  - tipo («O - Obligatorio»).
  - Asignatura («`COURSE_CODE` - NOMBRE», con « (*)» si es obligatoria por repitencia).
  - Créditos.
  - Sección Elegida («--» sin elección).
  - Elegir Sección (botón amarillo con icono de mano).
- Las filas obligatorias tienen fondo rojo claro. Orden: ciclo ascendente; dentro de un ciclo no es alfabético por código.

## V-03 — Tooltip (#33)

Al pasar sobre una fila roja aparece «Matrícula obligatoria».

## V-04 — «Secciones disponibles» (#34)

- Modal con barra de título «Secciones disponibles» y botón de cierre.
- Recuadro «Asignatura» con «`COURSE_CODE` - NOMBRE».
- Columnas de la tabla: Horarios (botón verde «+»), Sección (insignia), Aula («-»), Docente (`TEACHER_NAME`), Matriculados / Vacantes («0 / 1») y Seleccione (radio).
- Botones «✓ Aceptar» (verde) y «✕ Cancelar» (rojo).
- No se observó qué despliega el botón «Horarios».

## V-05 — Selección hecha (#35)

- «Sección Elegida» muestra el número de sección en una insignia lila; aparece un botón rojo con papelera junto al botón amarillo.
- Recuadros celestes: «Tope de créditos: 26», «Créditos matriculados: 9», «Asignaturas matriculadas: 3».
- Botón verde «Ejecutar Matrícula».

## V-06 — Confirmación (#36)

Icono de advertencia, título «Aviso», texto «Revise cuidadosamente las asignaturas seleccionadas. ¿Está seguro de ejecutar la matrícula?», botones «EJECUTAR» (verde) y «CANCELAR» (gris).

## V-07 — Éxito (#37)

Icono de pulgar arriba, título «Aviso», texto «La Matrícula se registró exitosamente. Lo estamos redireccionando a su reporte de matrícula.» y botón deshabilitado «REDIRECCIONANDO...». Coincide con M-01 (spec 001).

## V-08 — Reporte tras la redirección (#38)

- Recuadros del estudiante: Periodo Académico, Facultad, Programa, Especialidad y Plan de Estudios.
- Tarjeta «ASIGNATURAS MATRICULADAS».
- Recuadro celeste: «Fecha y Hora : DD/MM/AAAA HH:mm:ss» y «Tipo : Matrícula Vía Web».
- Botón rojo «Descargar» y campo «Búsqueda:».
- Columnas de la tabla: Ciclo, Asignatura («`COURSE_CODE` - NOMBRE»), Créditos, Sección y Docente Asignado (sin docente: «-- --, --»).
- «Mostrando 1 - 3 de 3 registros».
- Recuadro «Créditos matriculados : 9» y «Asignaturas matriculadas : 3».

## Huecos

- Alerta de error o rechazo: solo testimonio T-01.
- Qué despliega el botón «Horarios» del modal.
- Demora antes de la redirección del aviso de éxito.
- Semántica de «Búsqueda».
- Estado habilitado con matrícula ya registrada.
- Si el aviso amarillo aparece cuando no hay cursos obligatorios.
- Medidas, colores y tipografía exactos: la réplica usa aproximaciones.
```

- [ ] **Step 2: Crear `evidence/sum/matricula-regular/behavior.md`**

```markdown
# Matrícula regular — comportamiento observado y testimoniado

Registro: 2026-10-14. Fuentes descritas en [structure.md](structure.md).

| ID | Acción | Resultado visible | Fuente | Clase |
| --- | --- | --- | --- | --- |
| B-01 | Abrir Información de Matrícula fuera del periodo, con matrícula registrada | Franja INHABILITADA, cronograma y enlace «Ver Matrícula» | O-UI-01 | observed |
| B-02 | Abrir Información de Matrícula dentro del periodo | Franja HABILITADA y botón «Iniciar Matrícula» | V-01 | observed (otra facultad y periodo) |
| B-03 | «Iniciar Matrícula» | Pantalla de registro con tabla de asignaturas | V-01→V-02 | observed; secuencia inferida de fotogramas |
| B-04 | Botón amarillo de una fila | Modal «Secciones disponibles» | V-04 | observed |
| B-05 | Aceptar una sección | Sección elegida, botón de quitar y totales actualizados | V-05 | observed |
| B-06 | «Ejecutar Matrícula» | Modal de confirmación | V-06 | observed |
| B-07 | «EJECUTAR» con resultado correcto | Aviso de éxito y redirección al reporte | V-07→V-08 | observed |
| B-08 | «EJECUTAR» con error | Alerta cuyo mensaje es la causa (p. ej. cruce de horarios, sin cupos en una sección) y regreso a matrícula | T-01 | testimony |
| B-09 | Cambiar de pestaña o recargar | El temporizador vuelve a 15 minutos | T-01 | testimony |
| B-10 | Redirección tras éxito | Temporizador de 00:13:17 (V-07) a 00:14:48 (V-08) | V-07→V-08 | observed; compatible con B-09 |
| B-11 | Elegir secciones en la misma página | El temporizador desciende de 00:14:54 a 00:13:17 | V-02→V-07 | observed |

## Huecos

- Literal y apariencia de la alerta de error (B-08). La réplica aplica la inferencia autorizada L-08.
- Si «pestaña» en B-09 es la pestaña del navegador o una página del menú SUM. La réplica asume la pestaña del navegador (L-07).
- Duración de la redirección de B-07 (L-10) y efecto del botón «Horarios» (L-09).
- Nada de esto acredita FISI 2026-II para V-01…V-08 ni cierra N3 (B-01–B-06 de spec 001).
```

- [ ] **Step 3: Añadir la sesión de aclaraciones a `specs/001-matricula-regular-fisi/spec.md`**

Insertar el bloque siguiente inmediatamente antes de la línea `## User Scenarios & Testing *(mandatory)*`:

```markdown
### Session 2026-10-14

El usuario aportó la captura O-UI-01 de su propia interfaz SUM (matrícula registrada) y los
fotogramas V-01–V-08 de una grabación de otra facultad (2023-1). Están descritos sin datos personales
en [structure.md](../../evidence/sum/matricula-regular/structure.md) y
[behavior.md](../../evidence/sum/matricula-regular/behavior.md). Testimonio T-01:

- Q: ¿Qué ocurre ante un error al ejecutar la matrícula? → A: Aparece una alerta cuyo mensaje es la
  causa (por ejemplo, cruce de horarios o falta de cupos en una sección) y se redirige otra vez a
  matrícula. Precisa FR-012/FR-023 y es compatible con L-06; el literal sigue sin captura.
- Q: ¿Cuándo vuelve el temporizador a 15 minutos? → A: Al cambiar de pestaña o recargar. Precisa
  FR-025. En la réplica sustituye la renovación por botón explícito de LP-A04/LP-A05 mediante L-07.
  V-07→V-08 muestra además el reinicio tras la redirección.

Las decisiones locales L-07–L-13 y el contrato MR-CONTRACT-3 están en
[el plan](../../docs/reverse-engineering/plans/matricula-regular-sum-ui.md). Ninguna convierte
V-01–V-08 en evidencia FISI 2026-II; N3 conserva los bloqueos B-01–B-06.
```

- [ ] **Step 4: Actualizar LP-A04 y LP-A05 en `specs/002-local-profile-dashboard/spec.md`**

Sustituir completas las filas de la tabla que empiezan por `| LP-A04 |` y `| LP-A05 |` por:

```markdown
| LP-A04 | Renewal (rev. 2026-10-14, L-07) | Renewal keeps ID/startedAt, expiry=serverNow+900000. Triggers: full reload (resume), return to a visible tab and the post-success redirect to the report. GET, router navigation and timer ticks do not renew. Expired renewal 409. No explicit renew button. |
| LP-A05 | Reload and direct protected URL (rev. 2026-10-14, L-07) | The tab's sessionStorage keeps only {runId, actorId, sessionId} under `lp:session`; reload renews it before routing. A missing, invalid, expired or other-run identity clears the key and shows login. A new tab has no identity and shows login. |
```

- [ ] **Step 5: Añadir la revisión al final de `docs/reverse-engineering/contracts/local-api/local-profile-dashboard.md`**

```markdown
## Revisión LPD-CONTRACT-2 (2026-10-14, L-07)

Fuente: testimonio T-01 y V-07→V-08 ([behavior.md](../../../../evidence/sum/matricula-regular/behavior.md)).
Sustituye estas cláusulas anteriores: «Explicit button only» de la fila `renovar`; «It is display only;
no GET, focus, hover, navigation or timer creates/renews a session»; «No session/login identity is
persisted…»; y «Actual browser reload starts anonymous and shows chooser».

- La pestaña guarda en `sessionStorage['lp:session']` solo `{runId, actorId, sessionId}`, validado con
  `validateDashboardIdentity`. Lo escribe `enter()`; lo borran logout, expiración, cambio de ejecución
  y cualquier fallo de `resume()`. No hay cookie ni `localStorage`.
- `resume()` se ejecuta una vez al cargar la aplicación, antes del guard raíz: renueva la sesión
  guardada (MR2 renovar) y lee `formulario`. Si tiene éxito, la sesión queda activa con un plazo de
  900000 ms desde la respuesta; si falla, se borra la clave y queda `anonymous` (`notice: 'reset'`
  solo ante `RUN_CHANGED`). Nunca crea una sesión.
- Renuevan también la vuelta de la pestaña a `visible` y la redirección automática tras una matrícula
  aceptada. La navegación del router, los GET y el reloj no renuevan.
- La cabecera muestra el reloj, el nombre y «Salir». Se elimina el botón «Renovar sesión».
- Es una decisión `local-only`: no describe el mecanismo de sesión de SUM.
```

- [ ] **Step 6: Añadir MR-CONTRACT-3 al final de `docs/reverse-engineering/contracts/local-api/matricula-regular.md`**

```markdown
## MR-CONTRACT-3 (2026-10-14): campos de presentación opcionales

Fuente: V-02, V-04, V-05 y V-08 ([structure.md](../../../../evidence/sum/matricula-regular/structure.md)).
Revisión aditiva: todos los campos son **opcionales**. Si no están, el productor no los aporta y la UI
muestra `--`, el `sectionId` o `-- --, --`. Los validadores rechazan valores malformados y siguen
rechazando claves no declaradas.

| Objeto | Campo | Tipo | Regla |
| --- | --- | --- | --- |
| Section | `label` | string no vacío | Número de sección mostrado («1»). |
| Section | `teacher` | string no vacío \| null | `APELLIDOS, NOMBRES`; null = sin docente asignado. |
| Section | `room` | string no vacío \| null | null se muestra «-». |
| OfferedCourse | `cycle` | entero 1–14 \| null | Ciclo del plan. |
| OfferedCourse | `courseType` | `'mandatory'` \| `'elective'` \| null | «O - Obligatorio» / «E - Electivo» (la segunda etiqueta es inferida). |
| Context | `retakeCourseIds` | IDs SYN ordenados y únicos, presentes en `offer` | Asignaturas ofertadas con una o más desaprobaciones (fila «(*)»). |
| Context | `creditCap` | entero 1–60 \| null | «Tope de créditos»; FISI 2026-II = 26 (F1 art. 13.p, RN-01). |
| ReportRow | `cycle`, `label`, `teacher` | como arriba | Copiados de la oferta al aceptar. |

El backend los rellena con datos sintéticos (L-13). Un `historyKnown` falso produce `retakeCourseIds: []`.
```

- [ ] **Step 7: Comprobación documental**

Run: `grep -nE "[A-ZÁÉÍÓÚÑ]{3,} [A-ZÁÉÍÓÚÑ]{3,}, [A-ZÁÉÍÓÚÑ]{3,}" evidence/sum/matricula-regular/*.md`
Expected: sin salida (no hay nombres con formato `APELLIDO APELLIDO, NOMBRE`).

Run: `grep -c "L-07" specs/002-local-profile-dashboard/spec.md docs/reverse-engineering/contracts/local-api/local-profile-dashboard.md`
Expected: ambos recuentos ≥ 1.

- [ ] **Step 8: Punto de control (sin commit)**

Run: `git status --short evidence/sum/matricula-regular specs docs/reverse-engineering`
Expected: los dos archivos nuevos y los cuatro modificados; ningún otro.

---

### Task 2: Contrato MR-CONTRACT-3 en los validadores compartidos

**Files:**
- Modify: `shared/matricula-regular.mjs` (funciones `exact`, `section`, `offeredCourse`, `context`, `reportRow`)
- Modify: `shared/matricula-regular.d.mts`
- Modify: `client/tests/fixtures/matriculaRegularKit.ts` (añadir `syntheticContext`)
- Test: `client/src/data/matriculaRegularContractV3.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - Tipos: `MatriculaRegularSection.label?: string`, `.teacher?: string | null`, `.room?: string | null`; `MatriculaRegularOfferedCourse.cycle?: number | null`, `.courseType?: MatriculaRegularCourseType | null`; `MatriculaRegularContext.retakeCourseIds?: MatriculaRegularId[]`, `.creditCap?: number | null`; `MatriculaRegularReportRow.cycle?`, `.label?`, `.teacher?`.
  - `export type MatriculaRegularCourseType = 'mandatory' | 'elective'`.
  - Fixture: `syntheticContext(overrides?: Partial<MatriculaRegularContext>): MatriculaRegularContext`.

- [ ] **Step 1: Añadir `syntheticContext` al kit de fixtures**

En `client/tests/fixtures/matriculaRegularKit.ts`, añadir `MatriculaRegularContext,` a la lista del primer `import type { … } from '../../../shared/matricula-regular.mjs'`, y al final del archivo:

```ts
/** MR-CONTRACT-2 context for SYN-SIS-A with two offered courses; MR-CONTRACT-3 fields come only from overrides. */
export function syntheticContext(overrides: Partial<MatriculaRegularContext> = {}): MatriculaRegularContext {
  const planId = 'SYN-SIS-PLAN'
  return {
    actorId: actorSis,
    scope: { facultyId: 'FISI', schoolId: 'SISTEMAS', period: '2026-II', planId, modality: 'regular-virtual' },
    profileRevision: revisionSis,
    serverNow: '2026-08-11T14:00:00.000Z',
    preEnrollmentEnabled: true,
    preEnrollmentComplete: true,
    preEnrollment: [
      { courseId: 'SYN-SIS-C1', planId, name: 'Asignatura sintética 1', credits: 4 },
      { courseId: 'SYN-SIS-C2', planId, name: 'Asignatura sintética 2', credits: 3 },
    ],
    offerKnown: true,
    offer: [
      { courseId: 'SYN-SIS-C1', planId, name: 'Asignatura sintética 1', credits: 4, prerequisiteIds: [],
        sections: [{ sectionId: 'SYN-SIS-S1', capacity: 1, occupied: 0, schedule: [{ day: 1, startMinute: 480, endMinute: 540 }] }] },
      { courseId: 'SYN-SIS-C2', planId, name: 'Asignatura sintética 2', credits: 3, prerequisiteIds: [],
        sections: [{ sectionId: 'SYN-SIS-S2', capacity: 2, occupied: 2, schedule: null }] },
    ],
    calendar: { publishedRows: [], effectiveWindows: [], unknownDates: [] },
    eligibility: { state: 'eligible', windowId: null, windowOrigin: null, causes: [], gaps: [] },
    sources: [],
    ...overrides,
  }
}
```

- [ ] **Step 2: Escribir la prueba que falla**

Create `client/src/data/matriculaRegularContractV3.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateContext, validateEnrollmentReport } from '../../../shared/matricula-regular.mjs'
import { enrollmentReport, syntheticContext } from '../../tests/fixtures/matriculaRegularKit.ts'

const v3Offer = () => syntheticContext().offer.map((course, index) => ({
  ...course,
  cycle: index + 1,
  courseType: 'mandatory' as const,
  sections: course.sections.map((section) => ({ ...section, label: String(index + 1), teacher: 'SINTÉTICO, DOCENTE UNO', room: null })),
}))

test('MR3: an MR-CONTRACT-2 context without the optional fields stays valid', () => {
  assert.doesNotThrow(() => validateContext(syntheticContext()))
})

test('MR3: cycle, courseType, label, teacher, room, retakeCourseIds and creditCap are accepted', () => {
  assert.doesNotThrow(() => validateContext(syntheticContext({ offer: v3Offer(), retakeCourseIds: ['SYN-SIS-C1'], creditCap: 26 })))
  assert.doesNotThrow(() => validateContext(syntheticContext({ retakeCourseIds: [], creditCap: null })))
})

test('MR3: malformed optional fields and undeclared keys are rejected', () => {
  const cases: Array<[string, unknown]> = [
    ['cycle 0', syntheticContext({ offer: v3Offer().map((course) => ({ ...course, cycle: 0 })) })],
    ['courseType O', { ...syntheticContext(), offer: v3Offer().map((course) => ({ ...course, courseType: 'O' })) }],
    ['empty teacher', syntheticContext({ offer: v3Offer().map((course) => ({ ...course,
      sections: course.sections.map((section) => ({ ...section, teacher: '' })) })) })],
    ['empty label', syntheticContext({ offer: v3Offer().map((course) => ({ ...course,
      sections: course.sections.map((section) => ({ ...section, label: '' })) })) })],
    ['unsorted retake', syntheticContext({ retakeCourseIds: ['SYN-SIS-C2', 'SYN-SIS-C1'] })],
    ['retake not offered', syntheticContext({ retakeCourseIds: ['SYN-SIS-C9'] })],
    ['creditCap 0', syntheticContext({ creditCap: 0 })],
    ['undeclared key', { ...syntheticContext(), extra: true }],
  ]
  for (const [name, value] of cases) assert.throws(() => validateContext(value), TypeError, name)
})

test('MR3: report rows accept cycle, label and teacher; an empty teacher is rejected', () => {
  const report = enrollmentReport()
  const rows = report.rows.map((row, index) => ({
    ...row, cycle: index + 1, label: String(index + 1), teacher: index === 0 ? null : 'SINTÉTICO, DOCENTE DOS',
  }))
  assert.doesNotThrow(() => validateEnrollmentReport({ ...report, rows }))
  assert.throws(() => validateEnrollmentReport({ ...report, rows: rows.map((row) => ({ ...row, teacher: '' })) }), TypeError)
})
```

- [ ] **Step 3: Ejecutar para ver el fallo**

Run: `pnpm --dir client test:data`
Expected: FAIL. `tsc` informa que `cycle`/`courseType`/`retakeCourseIds`/`creditCap` no existen en los tipos, o bien las pruebas `MR3: cycle…` y `MR3: report rows…` fallan con `TypeError: …: se esperaba clave permitida`.

- [ ] **Step 4: Implementar los validadores**

En `shared/matricula-regular.mjs`, sustituir la función `exact` completa por:

```js
function exact(value, shape, path, optionalShape = {}) {
  const item = record(value, path)
  for (const key of Object.keys(shape)) {
    if (!Object.hasOwn(item, key)) fail(`${path}.${key}`, 'campo presente')
    shape[key](item[key], `${path}.${key}`)
  }
  for (const key of Object.keys(optionalShape)) {
    if (Object.hasOwn(item, key)) optionalShape[key](item[key], `${path}.${key}`)
  }
  for (const key of Object.keys(item)) {
    if (!Object.hasOwn(shape, key) && !Object.hasOwn(optionalShape, key)) fail(`${path}.${key}`, 'clave permitida')
  }
  return item
}
```

Inmediatamente después de la función `nullable`, añadir:

```js
// MR-CONTRACT-3: optional display fields observed in SUM (V-02, V-04, V-05, V-08). Absent = not provided by this producer.
const courseTypes = Object.freeze(['mandatory', 'elective'])

function cycleValue(value, path) {
  integer(value, path, 1, 14)
}

function courseTypeValue(value, path) {
  enumValue(courseTypes, value, path)
}
```

Sustituir la función `section` completa por:

```js
function section(value, path) {
  exact(value, {
    sectionId: id,
    capacity: (item, itemPath) => integer(item, itemPath),
    occupied: (item, itemPath) => integer(item, itemPath),
    schedule: nullable((item, itemPath) => array(item, itemPath, meeting)),
  }, path, {
    label: nonEmpty,
    teacher: nullable(nonEmpty),
    room: nullable(nonEmpty),
  })
  if (value.occupied > value.capacity) fail(`${path}.occupied`, 'ocupación menor o igual a capacidad')
}
```

En `offeredCourse`, sustituir el cierre `  }, path)\n}` del `exact` por:

```js
  }, path, {
    cycle: nullable(cycleValue),
    courseType: nullable(courseTypeValue),
  })
}
```

En `context`, sustituir:

```js
    sources: (items, itemPath) => { array(items, itemPath, source); unique(items, itemPath, (item) => item.id) },
  }, path)
```

por:

```js
    sources: (items, itemPath) => { array(items, itemPath, source); unique(items, itemPath, (item) => item.id) },
  }, path, {
    retakeCourseIds: (items, itemPath) => sortedUniqueStrings(items, itemPath, id),
    creditCap: nullable((item, itemPath) => integer(item, itemPath, 1, 60)),
  })
  if (Object.hasOwn(value, 'retakeCourseIds')) {
    const offered = new Set(value.offer.map((course) => course.courseId))
    value.retakeCourseIds.forEach((courseId, index) => {
      if (!offered.has(courseId)) fail(`${path}.retakeCourseIds[${index}]`, 'asignatura presente en offer')
    })
  }
```

En `reportRow`, sustituir el cierre `  }, path)\n}` del `exact` por:

```js
  }, path, {
    cycle: nullable(cycleValue),
    label: nonEmpty,
    teacher: nullable(nonEmpty),
  })
}
```

- [ ] **Step 5: Actualizar los tipos en `shared/matricula-regular.d.mts`**

Añadir después de `export type MatriculaRegularOutcomeState = …`:

```ts
export type MatriculaRegularCourseType = 'mandatory' | 'elective'
```

Sustituir las interfaces `MatriculaRegularSection` y `MatriculaRegularOfferedCourse` por:

```ts
export interface MatriculaRegularSection {
  sectionId: MatriculaRegularId
  capacity: number
  occupied: number
  schedule: MatriculaRegularMeeting[] | null
  /** MR-CONTRACT-3 (optional): displayed section number. */
  label?: string
  /** MR-CONTRACT-3 (optional): `APELLIDOS, NOMBRES`; null = no teacher assigned. */
  teacher?: string | null
  /** MR-CONTRACT-3 (optional): null is displayed as «-». */
  room?: string | null
}

export interface MatriculaRegularOfferedCourse {
  courseId: MatriculaRegularId
  planId: MatriculaRegularId
  name: string
  credits: number
  prerequisiteIds: MatriculaRegularId[]
  sections: MatriculaRegularSection[]
  /** MR-CONTRACT-3 (optional): plan cycle 1-14. */
  cycle?: number | null
  /** MR-CONTRACT-3 (optional). */
  courseType?: MatriculaRegularCourseType | null
}
```

En `MatriculaRegularContext`, añadir después de `sources: MatriculaRegularSource[]`:

```ts
  /** MR-CONTRACT-3 (optional): offered courses with one or more failures, sorted and unique. */
  retakeCourseIds?: MatriculaRegularId[]
  /** MR-CONTRACT-3 (optional): «Tope de créditos». */
  creditCap?: number | null
```

En `MatriculaRegularReportRow`, añadir después de `schedule: MatriculaRegularMeeting[]`:

```ts
  /** MR-CONTRACT-3 (optional). */
  cycle?: number | null
  label?: string
  teacher?: string | null
```

- [ ] **Step 6: Ejecutar las pruebas**

Run: `pnpm --dir client test:data`
Expected: PASS en todas las pruebas, incluidas las cuatro `MR3:` y las suites existentes (`matriculaRegular*.test.ts`, `localProfile*.test.ts`).

- [ ] **Step 7: Comprobar que el backend compila con los validadores nuevos**

Run: `pnpm --dir backend build`
Expected: termina sin errores.

- [ ] **Step 8: Punto de control (sin commit)**

Run: `git diff --stat -- shared client/tests client/src/data/matriculaRegularContractV3.test.ts`

---

### Task 3: Backend — datos sintéticos de presentación y proyección

**Files:**
- Modify: `backend/src/matricula-regular/profile.types.ts` (tipos `Section`, `OfferedCourse`)
- Modify: `backend/src/matricula-regular/fixtures.ts` (`createActor`, `createOffer`)
- Modify: `backend/src/matricula-regular/rules.ts` (constante `REGULAR_CREDIT_LOAD`)
- Modify: `backend/src/matricula-regular/context.service.ts` (`projectContext`)
- Modify: `backend/src/matricula-regular/matricula-regular.service.ts` (filas del reporte)
- Test: `backend/test/matricula-regular-sum-ui.spec.ts`

**Interfaces:**
- Consumes: MR-CONTRACT-3 (Task 2).
- Produces:
  - `export const REGULAR_CREDIT_LOAD: Readonly<{ min: 12; max: 26 }>` en `rules.ts`.
  - El contexto incluye `retakeCourseIds` y `creditCap`.
  - La oferta incluye `cycle` (1, 3, 5), `courseType: 'mandatory'` y secciones con `label: '1'`, `teacher` (null en la primera asignatura) y `room: null`.
  - SYN-SOFT-B tiene una desaprobación en SYN-SOFT-C1.
  - Las filas del reporte incluyen `cycle`, `label` y `teacher`.

- [ ] **Step 1: Escribir la prueba que falla**

Create `backend/test/matricula-regular-sum-ui.spec.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import supertest from 'supertest'
import { projectContext } from '../src/matricula-regular/context.service.js'
import { createSyntheticFixture } from '../src/matricula-regular/fixtures.js'
import { MatriculaRegularRepository } from '../src/matricula-regular/matricula-regular.repository.js'
import { REGULAR_CREDIT_LOAD } from '../src/matricula-regular/rules.js'
import type { ServerClock } from '../src/matricula-regular/clock.js'
import { createMatriculaRegularTestApp, type MatriculaRegularTestApp } from './matricula-regular-test-app.js'

const BASE_PATH = '/local/matricula-regular/v1'
const NOW = new Date('2026-08-11T14:00:00.000Z')
const REQUEST_ID = '00000000-0000-4000-8000-000000000071'

describe('MR-CONTRACT-3 synthetic display fields (L-13)', () => {
  it('offers cycle, course type, section label, teacher and room for every synthetic course', () => {
    for (const school of ['SISTEMAS', 'SOFTWARE'] as const) {
      const { offer } = createSyntheticFixture(school)
      expect(offer.map((course) => course.cycle)).toEqual([1, 3, 5])
      expect(offer.every((course) => course.courseType === 'mandatory')).toBe(true)
      expect(offer.map((course) => course.sections[0]!.label)).toEqual(['1', '1', '1'])
      expect(offer[0]!.sections[0]!.teacher).toBeNull()
      expect(offer[1]!.sections[0]!.teacher).toMatch(/^SINTÉTICO /)
      expect(offer.every((course) => course.sections[0]!.room === null)).toBe(true)
    }
  })

  it('projects retakeCourseIds from failed offered courses and the regular credit cap', () => {
    const snapshot = new MatriculaRegularRepository().readSnapshot()
    expect(projectContext(snapshot, 'SYN-SOFT-B', NOW).data.retakeCourseIds).toEqual(['SYN-SOFT-C1'])
    expect(projectContext(snapshot, 'SYN-SIS-A', NOW).data.retakeCourseIds).toEqual([])
    expect(projectContext(snapshot, 'SYN-SIS-A', NOW).data.creditCap).toBe(REGULAR_CREDIT_LOAD.max)
  })

  it('ignores failures outside the offer and returns no retake courses when history is unknown', () => {
    const snapshot = new MatriculaRegularRepository().readSnapshot()
    const actor = snapshot.actors.find((candidate) => candidate.actorId === 'SYN-SIS-A')!
    actor.failedCourses = [{ courseId: 'SYN-SIS-C9', failures: 2 }, { courseId: 'SYN-SIS-C2', failures: 1 }]
    expect(projectContext(snapshot, 'SYN-SIS-A', NOW).data.retakeCourseIds).toEqual(['SYN-SIS-C2'])
    actor.historyKnown = false
    expect(projectContext(snapshot, 'SYN-SIS-A', NOW).data.retakeCourseIds).toEqual([])
  })
})

describe('MR-CONTRACT-3 report rows', () => {
  const clock: ServerClock = { now: () => new Date('2026-08-11T15:00:00.000Z') }
  let testApp: MatriculaRegularTestApp

  beforeAll(async () => {
    testApp = await createMatriculaRegularTestApp(clock)
  })

  afterAll(async () => {
    await testApp.close()
  })

  it('copies cycle, section label and teacher into the accepted report', async () => {
    testApp.reset()
    const server = testApp.app.getHttpServer()
    const runId = testApp.repository.runId
    const created = await supertest(server).post(`${BASE_PATH}/sesiones`).send({ runId, actorId: 'SYN-SIS-A' })
    expect(created.status).toBe(200)
    const state = testApp.repository.readSnapshot()
    const actor = state.actors.find((item) => item.actorId === 'SYN-SIS-A')!
    const offer = state.offer.filter((item) => item.planId === actor.scope.planId)
    const submitted = await supertest(server).post(`${BASE_PATH}/solicitudes`).send({
      runId,
      actorId: 'SYN-SIS-A',
      sessionId: created.body.data.sessionId,
      requestId: REQUEST_ID,
      profileRevision: actor.profileRevision,
      selection: offer.map((course) => ({ courseId: course.courseId, sectionId: course.sections[0]!.sectionId })),
    })
    expect(submitted.body.data.state).toBe('accepted')
    const report = await supertest(server)
      .get(`${BASE_PATH}/reportes/${submitted.body.data.enrollmentId}?runId=${runId}&actorId=SYN-SIS-A`)
    expect(report.status).toBe(200)
    expect(report.body.data.rows.map((row: { cycle: number; label: string; teacher: string | null }) =>
      [row.cycle, row.label, row.teacher])).toEqual([
      [1, '1', null],
      [3, '1', 'SINTÉTICO SIS, DOCENTE 2'],
      [5, '1', 'SINTÉTICO SIS, DOCENTE 3'],
    ])
  })
})
```

- [ ] **Step 2: Ejecutar para ver el fallo**

Run: `pnpm --dir backend test -- matricula-regular-sum-ui`
Expected: FAIL. `REGULAR_CREDIT_LOAD` no exportado, `cycle` es `undefined` y `retakeCourseIds` es `undefined`.

- [ ] **Step 3: Ampliar los tipos de perfil**

En `backend/src/matricula-regular/profile.types.ts`, sustituir `Section` y `OfferedCourse` por:

```ts
export type Section = {
  sectionId: string
  capacity: number
  occupied: number
  schedule: Meeting[] | null
  label?: string
  teacher?: string | null
  room?: string | null
}

export type OfferedCourse = CourseDocument & {
  prerequisiteIds: string[]
  sections: Section[]
  cycle?: number | null
  courseType?: 'mandatory' | 'elective' | null
}
```

- [ ] **Step 4: Completar los fixtures (L-13)**

En `backend/src/matricula-regular/fixtures.ts`, dentro de `createActor`, sustituir `    failedCourses: [],` por:

```ts
    // L-13: SYN-SOFT-B failed SYN-SOFT-C1 once so the mandatory «(*)» row is visible in the demo.
    failedCourses: school === 'SOFTWARE' && suffix === 'B' ? [{ courseId: 'SYN-SOFT-C1', failures: 1 }] : [],
```

Sustituir la función `createOffer` completa por:

```ts
function createOffer(school: School, documents: CourseDocument[]): OfferedCourse[] {
  const { prefix, sectionIds } = idsFor(school)
  const meetingDays = [1, 2, 3] as const

  return documents.map((document, index) => ({
    ...clone(document),
    prerequisiteIds: [],
    // L-13: synthetic display data for MR-CONTRACT-3; not SUM values.
    cycle: index * 2 + 1,
    courseType: 'mandatory' as const,
    sections: [
      {
        sectionId: sectionIds[index]!,
        capacity: index === 0 ? 1 : 2,
        occupied: 0,
        schedule: [
          {
            day: meetingDays[index]!,
            startMinute: 8 * 60,
            endMinute: 9 * 60,
          },
        ],
        label: '1',
        // The first course has no assigned teacher to exercise the observed «-- --, --» (V-08).
        teacher: index === 0 ? null : `SINTÉTICO ${prefix}, DOCENTE ${index + 1}`,
        room: null,
      },
    ],
  }))
}
```

- [ ] **Step 5: Nombrar el tope de créditos**

En `backend/src/matricula-regular/rules.ts`, insertar justo después del último `import`:

```ts
/** FISI 2026-II regular load (F1 art. 13.p, RN-01); also exposed as the context «Tope de créditos». */
export const REGULAR_CREDIT_LOAD = Object.freeze({ min: 12, max: 26 } as const)
```

y sustituir `&& !hasKnownFourthBranch && credits < 12 && !exceptionApplies && !exceptionUnknown) {` por `&& !hasKnownFourthBranch && credits < REGULAR_CREDIT_LOAD.min && !exceptionApplies && !exceptionUnknown) {`, y `if (canEvaluateRule(actor, 'CREDIT-LOAD', profileApplicable) && credits > 26) {` por `if (canEvaluateRule(actor, 'CREDIT-LOAD', profileApplicable) && credits > REGULAR_CREDIT_LOAD.max) {`.

- [ ] **Step 6: Proyectar `retakeCourseIds` y `creditCap`**

En `backend/src/matricula-regular/context.service.ts`:

- sustituir `import type { ActorProfile, EnrollmentProfile } from './profile.types.js'` por `import type { ActorProfile, EnrollmentProfile, OfferedCourse } from './profile.types.js'`;
- añadir `import { REGULAR_CREDIT_LOAD } from './rules.js'` debajo de esa línea;
- añadir esta función después de `matchesScope`:

```ts
/** MR-CONTRACT-3: offered courses of the plan with one or more failures; unknown history yields none. */
function retakeCourseIdsFor(actor: ActorProfile, offer: OfferedCourse[], planId: string): string[] {
  if (!actor.historyKnown) return []
  const offered = new Set(offer.filter((course) => course.planId === planId).map((course) => course.courseId))
  return [...new Set(actor.failedCourses
    .filter((item) => item.failures >= 1 && offered.has(item.courseId))
    .map((item) => item.courseId))]
    .sort()
}
```

- en `projectContext`, sustituir `    sources: profile?.sources ?? [],\n  })` por:

```ts
    sources: profile?.sources ?? [],
    retakeCourseIds: profile === undefined ? [] : retakeCourseIdsFor(actor, snapshot.offer, profile.scope.planId),
    creditCap: profile === undefined ? null : REGULAR_CREDIT_LOAD.max,
  })
```

- [ ] **Step 7: Copiar los campos al reporte**

En `backend/src/matricula-regular/matricula-regular.service.ts`, sustituir:

```ts
          schedule: structuredClone(section.schedule ?? []),
          choice,
```

por:

```ts
          schedule: structuredClone(section.schedule ?? []),
          ...(course.cycle === undefined ? {} : { cycle: course.cycle }),
          ...(section.label === undefined ? {} : { label: section.label }),
          ...(section.teacher === undefined ? {} : { teacher: section.teacher }),
          choice,
```

- [ ] **Step 8: Ejecutar las pruebas del backend**

Run: `pnpm --dir backend test`
Expected: PASS en toda la suite, incluido `matricula-regular-sum-ui.spec.ts`. Si falla una prueba existente que dependa de que SYN-SOFT-B no tenga desaprobaciones, revisar su aserción: el único cambio de reglas es RETAKE_PRIORITY cuando SOFT-B no elige SYN-SOFT-C1.

- [ ] **Step 9: Build y lint**

Run: `pnpm --dir backend build && pnpm --dir backend lint`
Expected: ambos sin errores. El build regenera `backend/dist`, que usa el lanzador del dashboard.

- [ ] **Step 10: Punto de control (sin commit)**

Run: `git status --short backend`

---

### Task 4: Sesión por pestaña, renovación al recargar o volver y cabecera SUM (L-07)

**Files:**
- Modify: `client/src/data/localProfileSession.ts`
- Modify: `client/src/data/client.ts`
- Modify: `client/src/routes/__root.tsx`
- Modify: `client/src/components/LocalSessionControls.tsx` (reemplazo completo)
- Delete: `client/src/components/LocalSessionControls.css`
- Modify: `client/src/components/Shell.tsx`
- Test: `client/src/data/localProfileSession.test.ts`

**Interfaces:**
- Consumes: `validateDashboardIdentity` de `shared/local-profile-dashboard.mjs`.
- Produces:
  - `LOCAL_PROFILE_IDENTITY_KEY = 'lp:session'`.
  - `interface IdentityStorage { getItem; setItem; removeItem }`.
  - Opción `identityStorage?: IdentityStorage | null` de `createLocalProfileSessionStore`.
  - Método `store.resume(): Promise<void>`.
  - `interface VisibilitySource`; `bindVisibilityRenewal(doc: VisibilitySource, renew: () => Promise<void>): () => void`.
  - `localProfileReady: Promise<void>` (client.ts).
  - Componentes `LocalSessionClock` y `LocalSignOutButton`.

- [ ] **Step 1: Escribir las pruebas que fallan**

En `client/src/data/localProfileSession.test.ts`:

- ampliar el import de `./localProfileSession.ts` con `bindVisibilityRenewal,` y `LOCAL_PROFILE_IDENTITY_KEY,`, y añadir `import type { IdentityStorage } from './localProfileSession.ts'`;
- sustituir `function harness() {` por `function harness(options: { identityStorage?: IdentityStorage | null } = {}) {`;
- sustituir `  const store = createLocalProfileSessionStore({ dashboardApi, enrollmentApi, monotonicNow: () => clock.t, scheduler })` por `  const store = createLocalProfileSessionStore({ dashboardApi, enrollmentApi, monotonicNow: () => clock.t, scheduler, identityStorage: options.identityStorage ?? null })`;
- añadir al final del archivo:

```ts
function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
    removeItem: (key: string) => { data.delete(key) },
  }
}

const storedIdentity = (sessionNumber: number) =>
  JSON.stringify({ runId, actorId: 'SYN-SIS-A', sessionId: sessionIdFor(sessionNumber) })

test('resume_persists_identity: entering stores only run/actor/session for the tab; logout removes it', async () => {
  const storage = memoryStorage()
  const h = harness({ identityStorage: storage })
  await h.store.enter('SYN-SIS-A')
  const active = asActive(h.store.getSnapshot())
  assert.deepEqual(JSON.parse(storage.data.get(LOCAL_PROFILE_IDENTITY_KEY)!),
    { runId, actorId: 'SYN-SIS-A', sessionId: active.sessionId })
  assert.equal(storage.data.size, 1)
  h.store.logout()
  assert.equal(storage.data.has(LOCAL_PROFILE_IDENTITY_KEY), false)
})

test('resume_renews_on_reload: a new store renews the stored session to 15 minutes without creating one', async () => {
  const storage = memoryStorage()
  const first = harness({ identityStorage: storage })
  await first.store.enter('SYN-SIS-A')
  const before = asActive(first.store.getSnapshot())
  const reloaded = harness({ identityStorage: storage })
  reloaded.clock.t = 300_000
  reloaded.hooks.renew = async (sessionId, request) => ({ runId: request.runId, actorId: request.actorId, sessionId,
    startedAt: before.startedAt, expiresAt: iso(BASE + 300_000 + SESSION_DURATION_MS) })
  await reloaded.store.resume()
  const resumed = asActive(reloaded.store.getSnapshot())
  assert.equal(resumed.status, 'active')
  assert.equal(resumed.sessionId, before.sessionId)
  assert.equal(resumed.deadlineMono, 300_000 + SESSION_DURATION_MS)
  assert.equal(reloaded.counts.create, 0)
  assert.equal(reloaded.counts.renew, 1)
  assert.deepEqual(reloaded.identityEvents, ['enter'])
})

test('resume_expired_or_invalid: failures clear the stored identity and leave the chooser without creating sessions', async () => {
  const expiredStorage = memoryStorage({ [LOCAL_PROFILE_IDENTITY_KEY]: storedIdentity(9) })
  const expired = harness({ identityStorage: expiredStorage })
  expired.hooks.renew = async () => { throw new MatriculaRegularApiError({ kind: 'http', operation: 'renew', status: 409, code: 'SESSION_EXPIRED', message: 'x' }) }
  await expired.store.resume()
  assert.equal(expired.store.getSnapshot().status, 'anonymous')
  assert.equal(expiredStorage.data.has(LOCAL_PROFILE_IDENTITY_KEY), false)
  assert.equal(expired.counts.create, 0)

  const runChangedStorage = memoryStorage({ [LOCAL_PROFILE_IDENTITY_KEY]: storedIdentity(9) })
  const runChanged = harness({ identityStorage: runChangedStorage })
  runChanged.hooks.renew = async () => { throw new MatriculaRegularApiError({ kind: 'http', operation: 'renew', status: 409, code: 'RUN_CHANGED', message: 'x' }) }
  await runChanged.store.resume()
  const reset = runChanged.store.getSnapshot()
  assert.ok(reset.status === 'anonymous' && reset.notice === 'reset')
  assert.equal(runChangedStorage.data.has(LOCAL_PROFILE_IDENTITY_KEY), false)

  for (const raw of ['not-json', JSON.stringify({ runId, actorId: 'real-student', sessionId: sessionIdFor(9) })]) {
    const storage = memoryStorage({ [LOCAL_PROFILE_IDENTITY_KEY]: raw })
    const h = harness({ identityStorage: storage })
    await h.store.resume()
    assert.equal(h.store.getSnapshot().status, 'anonymous')
    assert.equal(h.counts.renew + h.counts.read + h.counts.create, 0)
    assert.equal(storage.data.has(LOCAL_PROFILE_IDENTITY_KEY), false)
  }

  const empty = harness({ identityStorage: memoryStorage() })
  await empty.store.resume()
  assert.equal(empty.counts.renew, 0)
  assert.equal(empty.store.getSnapshot().status, 'anonymous')
})

test('expiry_clears_identity: an expired session is never resumed after a reload', async () => {
  const storage = memoryStorage()
  const h = harness({ identityStorage: storage })
  await h.store.enter('SYN-SIS-A')
  h.store.markExpired()
  assert.equal(storage.data.has(LOCAL_PROFILE_IDENTITY_KEY), false)
})

test('visibility_renewal: only a return to a visible tab renews; disposal removes the listener', () => {
  const listeners = new Set<() => void>()
  const doc = {
    visibilityState: 'hidden',
    addEventListener: (_type: 'visibilitychange', listener: () => void) => { listeners.add(listener) },
    removeEventListener: (_type: 'visibilitychange', listener: () => void) => { listeners.delete(listener) },
  }
  let renewals = 0
  const dispose = bindVisibilityRenewal(doc, async () => { renewals += 1 })
  for (const listener of listeners) listener()
  assert.equal(renewals, 0)
  doc.visibilityState = 'visible'
  for (const listener of listeners) listener()
  assert.equal(renewals, 1)
  dispose()
  assert.equal(listeners.size, 0)
})
```

- [ ] **Step 2: Ejecutar para ver el fallo**

Run: `pnpm --dir client test:data`
Expected: FAIL; `tsc` informa que `LOCAL_PROFILE_IDENTITY_KEY`, `bindVisibilityRenewal`, `IdentityStorage`, `identityStorage` y `resume` no existen.

- [ ] **Step 3: Implementar la persistencia y `resume()`**

En `client/src/data/localProfileSession.ts`:

- debajo de `import type { DashboardKey, Identity } from '../../../shared/local-profile-dashboard.mjs'`, añadir `import { validateDashboardIdentity } from '../../../shared/local-profile-dashboard.mjs'`;
- debajo de `export const remainingSeconds = …`, añadir:

```ts
/** L-07: per-tab identity of the synthetic profile session (sessionStorage); never a credential. */
export const LOCAL_PROFILE_IDENTITY_KEY = 'lp:session'

export interface IdentityStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface VisibilitySource {
  readonly visibilityState: string
  addEventListener(type: 'visibilitychange', listener: () => void): void
  removeEventListener(type: 'visibilitychange', listener: () => void): void
}

/** L-07 (T-01): returning to a visible tab renews the session. Returns the disposer. */
export function bindVisibilityRenewal(doc: VisibilitySource, renew: () => Promise<void>): () => void {
  const onChange = () => {
    if (doc.visibilityState === 'visible') void renew()
  }
  doc.addEventListener('visibilitychange', onChange)
  return () => doc.removeEventListener('visibilitychange', onChange)
}
```

- en el tipo de opciones de `createLocalProfileSessionStore`, sustituir `  scheduler?: TimerScheduler\n}) {` por:

```ts
  scheduler?: TimerScheduler
  identityStorage?: IdentityStorage | null
}) {
```

- antes de `  function identityChanged(kind: 'enter' | 'logout' | 'run-changed') {`, insertar:

```ts
  function storeIdentity(identity: Identity | null) {
    const storage = options.identityStorage
    if (!storage) return
    try {
      if (identity) storage.setItem(LOCAL_PROFILE_IDENTITY_KEY, JSON.stringify(identity))
      else storage.removeItem(LOCAL_PROFILE_IDENTITY_KEY)
    } catch { /* storage unavailable: a reload falls back to the profile chooser */ }
  }
  function readStoredIdentity(): Identity | null {
    const storage = options.identityStorage
    if (!storage) return null
    try {
      const raw = storage.getItem(LOCAL_PROFILE_IDENTITY_KEY)
      if (raw === null) return null
      const parsed: unknown = JSON.parse(raw)
      validateDashboardIdentity(parsed)
      return parsed
    } catch {
      storeIdentity(null)
      return null
    }
  }
```

- en `clearActive`, sustituir `    cancelTimer()\n    identityChanged(kind)` por `    cancelTimer()\n    storeIdentity(null)\n    identityChanged(kind)`;
- en `markExpired`, sustituir `    if (snapshot.status !== 'active') return\n    cancelTimer()\n    publish({ ...snapshot, status: 'expired'` por `    if (snapshot.status !== 'active') return\n    cancelTimer()\n    storeIdentity(null)\n    publish({ ...snapshot, status: 'expired'`;
- en `enter`, sustituir `generation: enteredGeneration })\n        scheduleExpiry()` por `generation: enteredGeneration })\n        scheduleExpiry()\n        storeIdentity(identity)`;
- en `logout`, sustituir `  function logout() {\n    clearActive('logout')` por `  function logout() {\n    clearActive('logout')\n    storeIdentity(null)`;
- antes de `  async function renew() {`, insertar:

```ts
  /** L-07: on reload, renew the tab's stored session before routing; any failure clears it. Never creates a session. */
  async function resume(): Promise<void> {
    if (snapshot.status !== 'anonymous' || entryPromise) return
    const stored = readStoredIdentity()
    if (!stored) return
    const entryRevision = requestRevision
    publish({ status: 'entering', generation })
    const work = (async () => {
      try {
        const session = await options.enrollmentApi.renewSession(stored.sessionId, { runId: stored.runId, actorId: stored.actorId })
        if (requestRevision !== entryRevision) return
        if (session.runId !== stored.runId || session.actorId !== stored.actorId || session.sessionId !== stored.sessionId) {
          throw new LocalProfileApiError({ kind: 'protocol', operation: 'catalog', message: 'La sesión renovada no corresponde a la identidad guardada.' })
        }
        const formResponse = await options.dashboardApi.read('formulario', stored)
        if (requestRevision !== entryRevision) return
        if (formResponse.runId !== stored.runId || formResponse.data.actorId !== stored.actorId
          || formResponse.data.sessionId !== stored.sessionId || formResponse.data.payload.data.alumno.codAlumno !== stored.actorId) {
          throw new LocalProfileApiError({ kind: 'protocol', operation: 'read', message: 'El formulario no corresponde a la identidad guardada.' })
        }
        const deadlineMono = now() + SESSION_DURATION_MS
        identityChanged('enter')
        publish({ status: 'active', runId: session.runId, actorId: stored.actorId, sessionId: session.sessionId,
          startedAt: session.startedAt, expiresAt: session.expiresAt, deadlineMono,
          formulario: formResponse.data.payload, renewing: false, renewError: null, generation })
        scheduleExpiry()
      } catch (error) {
        storeIdentity(null)
        if (requestRevision !== entryRevision) return
        const runChanged = error instanceof Error && 'code' in error && error.code === 'RUN_CHANGED'
        publish({ status: 'anonymous', notice: runChanged ? 'reset' : null, generation })
      }
    })()
    const wrapped = work.finally(() => { if (entryPromise === wrapped) entryPromise = null })
    entryPromise = wrapped
    await wrapped
  }
```

- sustituir la línea `return { getSnapshot, … read }` por:

```ts
  return { getSnapshot, subscribe, onIdentityChange, enter, resume, renew, logout, observe, markExpired, markRunChanged, read }
```

- [ ] **Step 4: Ejecutar las pruebas del store**

Run: `pnpm --dir client test:data`
Expected: PASS, incluidas las cinco pruebas nuevas y `reload_new_store_anonymous` (sin almacenamiento inyectado no se escribe nada).

- [ ] **Step 5: Conectar el store a `sessionStorage` y resolver la sesión antes del guard**

En `client/src/data/client.ts`, sustituir:

```ts
export const localProfileSessionStore = createLocalProfileSessionStore({
  dashboardApi: localProfileDashboardApi,
  enrollmentApi: createMatriculaRegularApi({ mode: 'local' }),
})
```

por:

```ts
function tabSessionStorage() {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

export const localProfileSessionStore = createLocalProfileSessionStore({
  dashboardApi: localProfileDashboardApi,
  enrollmentApi: createMatriculaRegularApi({ mode: 'local' }),
  identityStorage: tabSessionStorage(),
})

/** L-07: resolves once the tab's stored profile session was renewed or discarded; the root guard waits for it. */
export const localProfileReady: Promise<void> = (() => {
  try {
    return getLocalProfileActivation() === 'synthetic-actors' ? localProfileSessionStore.resume() : Promise.resolve()
  } catch {
    return Promise.resolve()
  }
})()
```

En `client/src/routes/__root.tsx`, sustituir `import { getLocalProfileActivation, localProfileSessionStore, sumApi } from '../data/client'` por `import { getLocalProfileActivation, localProfileReady, localProfileSessionStore, sumApi } from '../data/client'`, y sustituir:

```tsx
  beforeLoad: ({ location, cause }) => {
    if (getLocalProfileActivation() === 'legacy') return
    const guard
```

por:

```tsx
  beforeLoad: async ({ location, cause }) => {
    if (getLocalProfileActivation() === 'legacy') return
    await localProfileReady
    const guard
```

- [ ] **Step 6: Cabecera SUM y renovación al volver a la pestaña**

Reemplazar el contenido completo de `client/src/components/LocalSessionControls.tsx` por:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useLocation, useRouter } from '@tanstack/react-router'
import { localProfileSessionStore } from '../data/client'
import { bindVisibilityRenewal, expiryNavigationTarget, remainingSeconds, SESSION_DURATION_MS } from '../data/localProfileSession'
import type { VisibilitySource } from '../data/localProfileSession'
import { useLocalProfileSession } from '../data/useLocalProfileSession'

export function LocalProfileRouterBridge() {
  const router = useRouter()
  const pathname = useLocation({ select: (location) => location.pathname })
  const snapshot = useLocalProfileSession()
  const previousStatus = useRef(snapshot.status)

  useEffect(() => localProfileSessionStore.onIdentityChange((kind) => {
    router.clearCache()
    void router.invalidate()
    if (kind === 'logout' || kind === 'run-changed') void router.navigate({ to: '/local/login' })
  }), [router])

  // L-07 (T-01): returning to the tab resets the 15-minute timer.
  useEffect(() => bindVisibilityRenewal(document as VisibilitySource, () => localProfileSessionStore.renew()), [])

  useEffect(() => {
    const expiredNow = previousStatus.current === 'active' && snapshot.status === 'expired'
    previousStatus.current = snapshot.status
    if (expiredNow) {
      const target = expiryNavigationTarget(pathname)
      if (target) void router.navigate({ to: target })
    }
  }, [pathname, router, snapshot.status, previousStatus])
  return null
}

/** V-02 header: descending HH:MM:SS timer. Renewal is automatic (L-07); there is no renew button. */
export function LocalSessionClock() {
  const snapshot = useLocalProfileSession()
  const [clock, setClock] = useState<{ deadline: number; now: number } | null>(null)
  const activeDeadline = snapshot.status === 'active' ? snapshot.deadlineMono : null
  useEffect(() => {
    if (activeDeadline === null) return
    const initial = globalThis.setTimeout(() => setClock({ deadline: activeDeadline, now: performance.now() }), 0)
    const interval = globalThis.setInterval(() => setClock({ deadline: activeDeadline, now: performance.now() }), 1000)
    return () => {
      globalThis.clearTimeout(initial)
      globalThis.clearInterval(interval)
    }
  }, [activeDeadline])

  if (snapshot.status !== 'active' && snapshot.status !== 'expired') return <span className="session-clock">00:00:00</span>
  const seconds = snapshot.status === 'expired' ? 0
    : remainingSeconds(snapshot.deadlineMono, clock?.deadline === snapshot.deadlineMono
      ? clock.now : snapshot.deadlineMono - SESSION_DURATION_MS)
  const time = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map((part) => String(part).padStart(2, '0')).join(':')
  return (
    <>
      <span className="session-clock" aria-label={`Tiempo de sesión restante ${time}`}>{time}</span>
      {snapshot.status === 'active' && snapshot.renewError && <span role="status">{snapshot.renewError}</span>}
      {snapshot.status === 'expired' && <span role="status">La sesión local venció.</span>}
    </>
  )
}

/** V-02 header «Salir»: client-only logout of the synthetic profile. */
export function LocalSignOutButton() {
  return (
    <button className="sign-out" type="button" onClick={() => localProfileSessionStore.logout()}>
      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2v10M6 5a9 9 0 1 0 12 0" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>{' '}Salir
    </button>
  )
}
```

Delete: `client/src/components/LocalSessionControls.css`. Solo tenía estilos de `.local-session-controls` y `.session-renew`, que ya no existen.

En `client/src/components/Shell.tsx`:

- sustituir `import { LocalSessionControls } from './LocalSessionControls'` por `import { LocalSessionClock, LocalSignOutButton } from './LocalSessionControls'`;
- sustituir `            ? <LocalSessionControls />` por `            ? <LocalSessionClock />`;
- sustituir `          {getLocalProfileActivation() !== 'synthetic-actors' && (` (la línea que abre el botón «Salir» deshabilitado) por `          {getLocalProfileActivation() === 'synthetic-actors' ? <LocalSignOutButton /> : (`.

- [ ] **Step 7: Build, lint y pruebas**

Run: `pnpm --dir client build && pnpm --dir client lint && pnpm --dir client test:data`
Expected: los tres sin errores.

- [ ] **Step 8: Punto de control (sin commit)**

Run: `git status --short client/src/data/localProfileSession.ts client/src/data/client.ts client/src/routes/__root.tsx client/src/components`

---

### Task 5: Información de Matrícula con estructura SUM (O-UI-01, V-01)

**Files:**
- Create: `client/src/data/sumEnrollmentFormat.ts`
- Create: `client/src/screens/MatriculaInfoSum.tsx`
- Create: `client/src/screens/MatriculaInfoSum.css`
- Modify: `client/src/routes/alumnoWebSum.v2.matricula.informacion.tsx` (reemplazo completo)
- Test: `client/src/data/sumEnrollmentFormat.test.ts`

**Interfaces:**
- Consumes: `syntheticContext`, `enrollmentReport` (kit); `readLocalProfileRoute('matriculaInfo' | 'matricula')`.
- Produces:
  - `formatLimaDateTime(iso: string, style: 'system' | 'schedule'): string`.
  - `formatSumPeriod(period: string): string`.
  - `SUM_ENROLLMENT_INFO`.
  - `interface EnrollmentStatusView { enabled; banner; period; systemDate; start; end; enrolled; canStart }`.
  - `buildEnrollmentStatus(context, report): EnrollmentStatusView`.
  - Componente `MatriculaInfoSum({ context, report })`.

- [ ] **Step 1: Escribir la prueba que falla**

Create `client/src/data/sumEnrollmentFormat.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { MatriculaRegularWindow } from '../../../shared/matricula-regular.mjs'
import { enrollmentReport, syntheticContext } from '../../tests/fixtures/matriculaRegularKit.ts'
import { buildEnrollmentStatus, formatLimaDateTime, formatSumPeriod, SUM_ENROLLMENT_INFO } from './sumEnrollmentFormat.ts'

const windows: MatriculaRegularWindow[] = [
  { id: 'SYN-WINDOW-1', startsAt: '2026-08-11T14:00:00.000Z', endsAt: '2026-08-11T16:00:00.000Z', minPp: 0, origin: 'synthetic', sourceIds: ['L-02'] },
  { id: 'SYN-WINDOW-2', startsAt: '2026-08-10T11:00:00.000Z', endsAt: '2026-08-15T04:55:00.000Z', minPp: 0, origin: 'synthetic', sourceIds: ['L-02'] },
]
const calendar = { publishedRows: [], effectiveWindows: windows, unknownDates: [] }

test('O-UI-01: system date and schedule formats in America/Lima', () => {
  assert.equal(formatLimaDateTime('2026-08-11T14:00:00.000Z', 'system'), '2026-08-11 09:00:00')
  assert.equal(formatLimaDateTime('2026-08-11T14:00:00.000Z', 'schedule'), '11/08/2026 09:00:00')
})

test('midnight in Lima is 00:00:00, never 24:00:00', () => {
  assert.equal(formatLimaDateTime('2026-08-11T05:00:00.000Z', 'system'), '2026-08-11 00:00:00')
})

test('O-UI-01: periods are shown as YYYY-N', () => {
  assert.equal(formatSumPeriod('2026-II'), '2026-2')
  assert.equal(formatSumPeriod('2026-I'), '2026-1')
  assert.equal(formatSumPeriod('2026'), '2026')
})

test('V-01: an eligible actor without enrollment sees the enabled banner, the window span and can start', () => {
  const status = buildEnrollmentStatus(syntheticContext({ calendar }), null)
  assert.deepEqual(status, {
    enabled: true,
    banner: 'MATRICULA INTERNET HABILITADA',
    period: '2026-2',
    systemDate: '2026-08-11 09:00:00',
    start: '10/08/2026 06:00:00',
    end: '14/08/2026 23:55:00',
    enrolled: false,
    canStart: true,
  })
})

test('O-UI-01: an ineligible actor with a committed report sees the disabled banner and the enrollment message', () => {
  const status = buildEnrollmentStatus(syntheticContext({ calendar, eligibility: {
    state: 'ineligible', windowId: null, windowOrigin: null,
    causes: [{ code: 'OUTSIDE_WINDOW', courseIds: [], sectionIds: [], sourceIds: ['L-02'] }], gaps: [],
  } }), enrollmentReport())
  assert.equal(status.banner, 'MATRICULA INTERNET INHABILITADA')
  assert.equal(status.enrolled, true)
  assert.equal(status.canStart, false)
})

test('L-11: an eligible actor that already enrolled cannot start again; missing windows show --', () => {
  const status = buildEnrollmentStatus(syntheticContext(), enrollmentReport())
  assert.equal(status.enabled, true)
  assert.equal(status.canStart, false)
  assert.equal(status.start, '--')
  assert.equal(status.end, '--')
})

test('O-UI-01: the five information sections keep the observed titles', () => {
  assert.equal(SUM_ENROLLMENT_INFO.introduccion, 'Información importante acerca del módulo de Matrícula Vía Web')
  assert.deepEqual(SUM_ENROLLMENT_INFO.secciones.map((section) => section.titulo), [
    'Control de Cronograma de Matrícula', 'Control de Acceso de Facultad', 'Control de Pre-Matrícula',
    'Control de Deudas Registradas', 'Interfaz de Matrícula',
  ])
})
```

- [ ] **Step 2: Ejecutar para ver el fallo**

Run: `pnpm --dir client test:data`
Expected: FAIL; no se encuentra el módulo `./sumEnrollmentFormat.ts`.

- [ ] **Step 3: Implementar `client/src/data/sumEnrollmentFormat.ts`**

```ts
import type { MatriculaRegularContext, MatriculaRegularEnrollmentReport } from '../../../shared/matricula-regular.mjs'

const LIMA = 'America/Lima'
const UNKNOWN = '--'

function limaParts(iso: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LIMA, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '00'
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') }
}

/** O-UI-01: «Fecha del Sistema» = YYYY-MM-DD HH:mm:ss; schedule dates and «Fecha y Hora» = DD/MM/YYYY HH:mm:ss. */
export function formatLimaDateTime(iso: string, style: 'system' | 'schedule'): string {
  const p = limaParts(iso)
  return style === 'system'
    ? `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`
    : `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`
}

/** O-UI-01 shows «2026-2» for the local period «2026-II». */
export function formatSumPeriod(period: string): string {
  const match = /^(\d{4})-(I{1,2})$/.exec(period)
  return match ? `${match[1]}-${match[2]!.length}` : period
}

export interface InfoSection {
  titulo: string
  parts: Array<{ text: string; strong?: boolean }>
}

/** Literal text of O-UI-01 (#30). */
export const SUM_ENROLLMENT_INFO: { introduccion: string; secciones: InfoSection[] } = {
  introduccion: 'Información importante acerca del módulo de Matrícula Vía Web',
  secciones: [
    { titulo: 'Control de Cronograma de Matrícula', parts: [
      { text: 'Verificación de Fechas de Inicio y Fin de Matrícula del Período Vigente y de Acceso al Módulo de Matrícula.' },
    ] },
    { titulo: 'Control de Acceso de Facultad', parts: [
      { text: 'Verificación de la Programación Interna establecida por la Oficina de Matrícula de su Facultad.' },
    ] },
    { titulo: 'Control de Pre-Matrícula', parts: [
      { text: 'Verificación del Registro de Pre-Matrícula el cual debe haber sido procesado por la Oficina de Matrícula de su Facultad. De no existir debe acercarse a la Oficina de Matricula personalmente.' },
    ] },
    { titulo: 'Control de Deudas Registradas', parts: [
      { text: 'Verificación de registros de deudas de dinero o de material bibliográfico. Esta información nos la remite la Oficina de Matrícula de su facultad. De registrar deudas pendientes debe acercarse personalmente a la Oficina de Matrícula de su Facultad.' },
    ] },
    { titulo: 'Interfaz de Matrícula', parts: [
      { text: 'Presentación de Asignaturas de Pre-Matrícula y secciones abiertas. ' },
      { text: 'Efectuar Matrícula', strong: true },
      { text: ' registrará su matrícula. Si la Matrícula se efectúa ' },
      { text: 'satisfactoriamente', strong: true },
      { text: ', se mostrará automáticamente el Reporte de Matrícula vigente, de lo contrario mostrará un error.' },
    ] },
  ],
}

export interface EnrollmentStatusView {
  enabled: boolean
  banner: 'MATRICULA INTERNET HABILITADA' | 'MATRICULA INTERNET INHABILITADA'
  period: string
  systemDate: string
  start: string
  end: string
  enrolled: boolean
  canStart: boolean
}

/**
 * Right card of O-UI-01/V-01. Enabled = eligible synthetic context. Start/end span every effective window
 * (local-only: SUM shows the faculty period). Enrolled = a committed report exists (L-11 hides «Iniciar»).
 */
export function buildEnrollmentStatus(
  context: MatriculaRegularContext,
  report: MatriculaRegularEnrollmentReport | null,
): EnrollmentStatusView {
  const enabled = context.eligibility.state === 'eligible'
  const starts = context.calendar.effectiveWindows.map((window) => window.startsAt).sort()
  const ends = context.calendar.effectiveWindows.map((window) => window.endsAt).sort()
  const enrolled = report !== null
  return {
    enabled,
    banner: enabled ? 'MATRICULA INTERNET HABILITADA' : 'MATRICULA INTERNET INHABILITADA',
    period: formatSumPeriod(context.scope.period),
    systemDate: formatLimaDateTime(context.serverNow, 'system'),
    start: starts.length ? formatLimaDateTime(starts[0]!, 'schedule') : UNKNOWN,
    end: ends.length ? formatLimaDateTime(ends[ends.length - 1]!, 'schedule') : UNKNOWN,
    enrolled,
    canStart: enabled && !enrolled,
  }
}
```

- [ ] **Step 4: Ejecutar las pruebas**

Run: `pnpm --dir client test:data`
Expected: PASS en las siete pruebas nuevas y en las existentes.

- [ ] **Step 5: Crear la pantalla `client/src/screens/MatriculaInfoSum.tsx`**

```tsx
import { Link } from '@tanstack/react-router'
import { AcademicRequirementsPanel } from '../components/AcademicRequirementsPanel'
import { PageTitle } from '../components/Common'
import { EnrollmentCalendarPanel } from '../components/EnrollmentCalendarPanel'
import { PreEnrollmentPanel } from '../components/PreEnrollmentPanel'
import { buildEnrollmentStatus, SUM_ENROLLMENT_INFO } from '../data/sumEnrollmentFormat'
import type { MatriculaRegularContext, MatriculaRegularEnrollmentReport } from '../../../shared/matricula-regular.mjs'
import './MatriculaInfoSum.css'

/** O-UI-01 (#30) / V-01 (#31) for the synthetic profile. Local verification panels stay collapsed below. */
export function MatriculaInfoSum({ context, report }: {
  context: MatriculaRegularContext
  report: MatriculaRegularEnrollmentReport | null
}) {
  const status = buildEnrollmentStatus(context, report)
  return (
    <div className="matricula-info-sum">
      <PageTitle>Información de Matrícula</PageTitle>
      <div className="matricula-info-sum__grid">
        <section className="matricula-info-sum__card" aria-labelledby="matricula-info-sum-intro">
          <h3 id="matricula-info-sum-intro" className="matricula-info-sum__intro">{SUM_ENROLLMENT_INFO.introduccion}</h3>
          <ol className="matricula-info-sum__sections">
            {SUM_ENROLLMENT_INFO.secciones.map((section, index) => (
              <li key={section.titulo}>
                <h4>{index + 1}. {section.titulo}</h4>
                <p>{section.parts.map((part, partIndex) => part.strong
                  ? <strong key={partIndex}>{part.text}</strong>
                  : <span key={partIndex}>{part.text}</span>)}</p>
              </li>
            ))}
          </ol>
        </section>
        <section className="matricula-info-sum__card" aria-label="Estado de matrícula">
          <p className={`matricula-info-sum__banner matricula-info-sum__banner--${status.enabled ? 'enabled' : 'disabled'}`}
            role="status">{status.banner}</p>
          <dl className="matricula-info-sum__tiles">
            <div><dt>Periodo Académico</dt><dd>{status.period}</dd></div>
            <div><dt>Fecha del Sistema</dt><dd>{status.systemDate}</dd></div>
            <div><dt>Inicio de Matrícula</dt><dd>{status.start}</dd></div>
            <div><dt>Fin de Matrícula</dt><dd>{status.end}</dd></div>
          </dl>
          {status.enrolled && (
            <p className="matricula-info-sum__registered">
              Usted registra matrícula en el presente semestre{' '}
              <Link to="/alumnoWebSum/v2/reportes/matricula">Ver Matrícula</Link>
            </p>
          )}
          {status.canStart && (
            <Link className="matricula-info-sum__start" to="/local/matricula-regular">Iniciar Matrícula</Link>
          )}
        </section>
      </div>
      <details className="matricula-info-sum__local">
        <summary>Detalle local de verificación (no forma parte de la interfaz SUM)</summary>
        <PreEnrollmentPanel context={context} />
        <EnrollmentCalendarPanel calendar={context.calendar} eligibility={context.eligibility}
          sources={context.sources} serverNow={context.serverNow} />
        <AcademicRequirementsPanel context={context} />
      </details>
    </div>
  )
}
```

- [ ] **Step 6: Crear `client/src/screens/MatriculaInfoSum.css`**

```css
/* O-UI-01 (#30) and V-01 (#31): colors approximated from the screenshots, not pixel-measured. */
.matricula-info-sum__grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 1.75rem; align-items: start; }
.matricula-info-sum__card { padding: 1.25rem 1.25rem 1.5rem; border-radius: 0.75rem; background: var(--color-sum-surface); }
.matricula-info-sum__intro { margin: 0 0 1.25rem; font-size: 1.1rem; font-weight: 400; color: var(--color-sum-heading); }
.matricula-info-sum__sections { margin: 0; padding: 0; list-style: none; }
.matricula-info-sum__sections li + li { margin-top: 1.4rem; }
.matricula-info-sum__sections h4 { margin: 0 0 0.4rem; font-size: 0.9rem; color: var(--color-sum-heading); }
.matricula-info-sum__sections p { margin: 0; color: var(--color-sum-accent); font-size: 0.82rem; line-height: 1.6; }
.matricula-info-sum__banner { margin: 0 0 1.25rem; padding: 0.9rem; border: 1px solid; border-radius: 0.35rem; text-align: center; font-size: 0.8rem; font-weight: 700; }
.matricula-info-sum__banner--disabled { border-color: #f5c6cb; background: #f8d7da; color: #721c24; }
.matricula-info-sum__banner--enabled { border-color: #c3e6cb; background: #d4edda; color: #155724; }
.matricula-info-sum__tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem 1.75rem; margin: 0; }
.matricula-info-sum__tiles div { padding: 0.6rem 0.9rem; border-radius: 0.35rem; background: #e6e3fa; }
.matricula-info-sum__tiles dt { font-size: 0.8rem; font-weight: 600; color: var(--color-sum-heading); }
.matricula-info-sum__tiles dd { margin: 0.2rem 0 0; font-size: 0.8rem; font-weight: 600; color: var(--color-sum-accent); }
.matricula-info-sum__registered { margin: 1.5rem 0 0; padding: 0.9rem; border: 1px solid #bee5eb; border-radius: 0.35rem; background: #d1ecf1; color: #0c5460; text-align: center; font-size: 0.8rem; font-weight: 600; }
.matricula-info-sum__registered a { color: #007bff; }
.matricula-info-sum__start { display: block; width: fit-content; margin: 1.5rem auto 0; padding: 0.55rem 1rem; border-radius: 0.3rem; background: #3d42d6; color: #fff; font-size: 0.8rem; font-weight: 600; text-decoration: none; }
.matricula-info-sum__local { margin-top: 1.5rem; }
@media (max-width: 900px) { .matricula-info-sum__grid { grid-template-columns: 1fr; } }
```

- [ ] **Step 7: Usar la pantalla en la ruta del perfil sintético**

Reemplazar el contenido completo de `client/src/routes/alumnoWebSum.v2.matricula.informacion.tsx` por:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { RouteError, RoutePending } from '../components/RouteStatus'
import { getLocalProfileActivation, readLocalProfileRoute, sumApi } from '../data/client'
import { EnrollmentInfo } from '../screens/EnrollmentInfo'
import { MatriculaInfoSum } from '../screens/MatriculaInfoSum'

export const Route = createFileRoute('/alumnoWebSum/v2/matricula/informacion')({
  loader: async ({ abortController }) => {
    if (getLocalProfileActivation() !== 'synthetic-actors') {
      return { mode: 'legacy' as const, response: await sumApi.get('matriculaInfo', { signal: abortController.signal }) }
    }
    const [info, enrollment] = await Promise.all([
      readLocalProfileRoute('matriculaInfo', undefined, { signal: abortController.signal }),
      readLocalProfileRoute('matricula', undefined, { signal: abortController.signal }),
    ])
    return { mode: 'synthetic-actors' as const, context: info.data.payload, report: enrollment.data.payload }
  },
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: function RouteComponent() {
    const loaded = Route.useLoaderData()
    return loaded.mode === 'synthetic-actors'
      ? <MatriculaInfoSum context={loaded.context} report={loaded.report} />
      : <EnrollmentInfo response={loaded.response} />
  },
})
```

- [ ] **Step 8: Build y lint**

Run: `pnpm --dir client build && pnpm --dir client lint`
Expected: sin errores.

- [ ] **Step 9: Punto de control (sin commit)**

Run: `git status --short client/src`

---

### Task 6: Tabla de registro, búsqueda y modal de secciones (V-02 a V-05)

**Files:**
- Create: `client/src/data/sumEnrollmentTable.ts`
- Create: `client/src/components/SumEnrollmentTable.tsx`
- Create: `client/src/components/SectionPickerDialog.tsx`
- Create: `client/src/components/SumEnrollment.css`
- Test: `client/src/data/sumEnrollmentTable.test.ts`

**Interfaces:**
- Consumes: `computeSelectableCourses`, `calculateSelectionTotalCredits`, `formatMeetingSchedule` (`selectionPanel.ts`); campos MR-CONTRACT-3.
- Produces:
  - Constantes `COURSE_TYPE_LABELS` y `UNKNOWN_CELL`.
  - Tipos `SumEnrollmentRow`, `SectionOption` y `SelectionSummary`.
  - Funciones `sectionLabel(section)`, `selectableCourses(context)`, `buildEnrollmentRows(context, choices)`, `normalizeSearch(text)`, `matchesSearch(fields, query)`, `filterEnrollmentRows(rows, query)`, `buildSectionOptions(course)`, `chooseSection(choices, courseId, sectionId)`, `removeChoice(choices, courseId)` y `summarizeSelection(context, choices)`.
  - Componentes `SumEnrollmentNotices({ showMandatoryNotice })`, `SumEnrollmentTable(props)` y `SectionPickerDialog(props)`.

- [ ] **Step 1: Escribir la prueba que falla**

Create `client/src/data/sumEnrollmentTable.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { MatriculaRegularOfferedCourse } from '../../../shared/matricula-regular.mjs'
import { syntheticContext } from '../../tests/fixtures/matriculaRegularKit.ts'
import {
  buildEnrollmentRows, buildSectionOptions, chooseSection, filterEnrollmentRows, removeChoice, summarizeSelection,
} from './sumEnrollmentTable.ts'

function withDisplay() {
  const base = syntheticContext()
  const offer: MatriculaRegularOfferedCourse[] = [
    { ...base.offer[0]!, cycle: 3, courseType: 'mandatory',
      sections: [{ ...base.offer[0]!.sections[0]!, label: '1', teacher: 'SINTÉTICO, DOCENTE UNO', room: null }] },
    { ...base.offer[1]!, name: 'Inglés técnico', cycle: 1, courseType: 'elective' },
  ]
  return syntheticContext({ offer, retakeCourseIds: ['SYN-SIS-C1'], creditCap: 26 })
}

test('V-02: rows are ordered by cycle and show type, code - name and the (*) of mandatory retakes', () => {
  const rows = buildEnrollmentRows(withDisplay(), [])
  assert.deepEqual(rows.map((row) => [row.cycle, row.type, row.subject, row.credits, row.mandatory, row.chosenSection]), [
    ['1', 'E - Electivo', 'SYN-SIS-C2 - Inglés técnico', 3, false, null],
    ['3', 'O - Obligatorio', 'SYN-SIS-C1 - Asignatura sintética 1 (*)', 4, true, null],
  ])
})

test('MR2 contexts without display fields render -- and keep the offer order', () => {
  const rows = buildEnrollmentRows(syntheticContext(), [{ courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' }])
  assert.deepEqual(rows.map((row) => [row.courseId, row.cycle, row.type, row.chosenSection]), [
    ['SYN-SIS-C1', '--', '--', 'SYN-SIS-S1'],
    ['SYN-SIS-C2', '--', '--', null],
  ])
})

test('V-05: the chosen section shows its label', () => {
  const rows = buildEnrollmentRows(withDisplay(), [{ courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' }])
  assert.equal(rows.find((row) => row.courseId === 'SYN-SIS-C1')!.chosenSection, '1')
})

test('incomplete pre-enrollment or offer yields no selectable rows', () => {
  assert.deepEqual(buildEnrollmentRows(syntheticContext({ preEnrollmentComplete: false }), []), [])
  assert.deepEqual(buildEnrollmentRows(syntheticContext({ offerKnown: false }), []), [])
})

test('search ignores case and accents (L-12)', () => {
  const rows = buildEnrollmentRows(withDisplay(), [])
  assert.deepEqual(filterEnrollmentRows(rows, 'ingles').map((row) => row.courseId), ['SYN-SIS-C2'])
  assert.deepEqual(filterEnrollmentRows(rows, 'INGLÉS').map((row) => row.courseId), ['SYN-SIS-C2'])
  assert.equal(filterEnrollmentRows(rows, '   ').length, 2)
  assert.equal(filterEnrollmentRows(rows, 'zzz').length, 0)
})

test('V-04: section options show label, room, teacher, occupancy and schedule', () => {
  const context = withDisplay()
  assert.deepEqual(buildSectionOptions(context.offer[0]!), [{
    sectionId: 'SYN-SIS-S1', label: '1', room: '-', teacher: 'SINTÉTICO, DOCENTE UNO', occupancy: '0 / 1', schedule: 'Lun 08:00-09:00',
  }])
})

test('full sections stay selectable: the vacancy rejection only arrives on execute', () => {
  const [option] = buildSectionOptions(syntheticContext().offer[1]!)
  assert.equal(option!.occupancy, '2 / 2')
  assert.equal(option!.label, 'SYN-SIS-S2')
  assert.equal(option!.teacher, '-')
  assert.equal(option!.room, '-')
  assert.equal('disabled' in option!, false)
})

test('choose replaces the course section, remove drops it and the totals follow (V-05)', () => {
  const chosen = chooseSection([{ courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' }], 'SYN-SIS-C1', 'SYN-SIS-S9')
  assert.deepEqual(chosen, [{ courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S9' }])
  const both = chooseSection([{ courseId: 'SYN-SIS-C1', sectionId: 'SYN-SIS-S1' }], 'SYN-SIS-C2', 'SYN-SIS-S2')
  assert.deepEqual(summarizeSelection(withDisplay(), both), { creditCap: '26', credits: 7, courses: 2 })
  assert.deepEqual(removeChoice(both, 'SYN-SIS-C1'), [{ courseId: 'SYN-SIS-C2', sectionId: 'SYN-SIS-S2' }])
  assert.equal(summarizeSelection(syntheticContext(), []).creditCap, '--')
})
```

- [ ] **Step 2: Ejecutar para ver el fallo**

Run: `pnpm --dir client test:data`
Expected: FAIL; no se encuentra el módulo `./sumEnrollmentTable.ts`.

- [ ] **Step 3: Implementar `client/src/data/sumEnrollmentTable.ts`**

```ts
import type {
  MatriculaRegularChoice,
  MatriculaRegularContext,
  MatriculaRegularId,
  MatriculaRegularOfferedCourse,
  MatriculaRegularSection,
} from '../../../shared/matricula-regular.mjs'
import { calculateSelectionTotalCredits, computeSelectableCourses, formatMeetingSchedule } from './selectionPanel.ts'

/** V-02 shows «O - Obligatorio»; «E - Electivo» is an inferred label. */
export const COURSE_TYPE_LABELS = { mandatory: 'O - Obligatorio', elective: 'E - Electivo' } as const
export const UNKNOWN_CELL = '--'

export interface SumEnrollmentRow {
  courseId: MatriculaRegularId
  cycle: string
  type: string
  subject: string
  credits: number
  mandatory: boolean
  chosenSection: string | null
}

export interface SectionOption {
  sectionId: MatriculaRegularId
  label: string
  room: string
  teacher: string
  occupancy: string
  schedule: string
}

export interface SelectionSummary {
  creditCap: string
  credits: number
  courses: number
}

export function sectionLabel(section: MatriculaRegularSection): string {
  return section.label ?? section.sectionId
}

/** L-05 intersection of complete pre-enrollment and applicable offer; incomplete data selects nothing. */
export function selectableCourses(context: MatriculaRegularContext): MatriculaRegularOfferedCourse[] {
  const result = computeSelectableCourses({
    preEnrollmentComplete: context.preEnrollmentComplete,
    offerKnown: context.offerKnown,
    planId: context.scope.planId,
    preEnrollment: context.preEnrollment,
    offer: context.offer,
  })
  return result.isComplete ? result.courses : []
}

/** V-02: rows ordered by cycle (unknown last); within a cycle the offer order is kept (stable sort). */
export function buildEnrollmentRows(
  context: MatriculaRegularContext,
  choices: readonly MatriculaRegularChoice[],
): SumEnrollmentRow[] {
  const retake = new Set(context.retakeCourseIds ?? [])
  const cycleOrder = (course: MatriculaRegularOfferedCourse) => course.cycle ?? Number.MAX_SAFE_INTEGER
  return [...selectableCourses(context)]
    .sort((left, right) => cycleOrder(left) - cycleOrder(right))
    .map((course) => {
      const choice = choices.find((item) => item.courseId === course.courseId)
      const section = choice ? course.sections.find((item) => item.sectionId === choice.sectionId) : undefined
      const mandatory = retake.has(course.courseId)
      const cycle = course.cycle ?? null
      const courseType = course.courseType ?? null
      return {
        courseId: course.courseId,
        cycle: cycle === null ? UNKNOWN_CELL : String(cycle),
        type: courseType === null ? UNKNOWN_CELL : COURSE_TYPE_LABELS[courseType],
        subject: `${course.courseId} - ${course.name}${mandatory ? ' (*)' : ''}`,
        credits: course.credits,
        mandatory,
        chosenSection: section ? sectionLabel(section) : (choice ? choice.sectionId : null),
      }
    })
}

export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()
}

/** L-12: case- and accent-insensitive substring search; an empty query matches everything. */
export function matchesSearch(fields: readonly string[], query: string): boolean {
  const needle = normalizeSearch(query)
  return needle === '' || normalizeSearch(fields.join(' ')).includes(needle)
}

export function filterEnrollmentRows(rows: readonly SumEnrollmentRow[], query: string): SumEnrollmentRow[] {
  return rows.filter((row) => matchesSearch([row.cycle, row.type, row.subject, String(row.credits)], query))
}

/** V-04: one row per section; full sections stay selectable (the server rejects SECTION_FULL on execute). */
export function buildSectionOptions(course: MatriculaRegularOfferedCourse): SectionOption[] {
  return course.sections.map((section) => ({
    sectionId: section.sectionId,
    label: sectionLabel(section),
    room: section.room ?? '-',
    teacher: section.teacher ?? '-',
    occupancy: `${section.occupied} / ${section.capacity}`,
    schedule: formatMeetingSchedule(section.schedule),
  }))
}

export function chooseSection(
  choices: readonly MatriculaRegularChoice[],
  courseId: MatriculaRegularId,
  sectionId: MatriculaRegularId,
): MatriculaRegularChoice[] {
  return [...choices.filter((item) => item.courseId !== courseId), { courseId, sectionId }]
}

export function removeChoice(choices: readonly MatriculaRegularChoice[], courseId: MatriculaRegularId): MatriculaRegularChoice[] {
  return choices.filter((item) => item.courseId !== courseId)
}

/** V-05 totals: «Tope de créditos», «Créditos matriculados», «Asignaturas matriculadas». */
export function summarizeSelection(
  context: MatriculaRegularContext,
  choices: readonly MatriculaRegularChoice[],
): SelectionSummary {
  const creditCap = context.creditCap ?? null
  return {
    creditCap: creditCap === null ? UNKNOWN_CELL : String(creditCap),
    credits: calculateSelectionTotalCredits(choices, context.offer),
    courses: choices.length,
  }
}
```

- [ ] **Step 4: Ejecutar las pruebas**

Run: `pnpm --dir client test:data`
Expected: PASS en las ocho pruebas nuevas.

- [ ] **Step 5: Crear `client/src/components/SumEnrollment.css`**

```css
/* V-02..V-07 (screen recording, other faculty/period): colors approximated, not pixel-measured. */
.sum-enrollment__note { margin: 1rem 0 0; padding: 0.85rem 1rem; border: 1px solid #c6c8ca; border-radius: 0.35rem; background: #d6d8d9; color: #1b1e21; font-size: 0.8rem; }
.sum-enrollment__mandatory-note { margin: 0.75rem 0 0; padding: 0.85rem 1rem; border: 1px solid #ffeeba; border-radius: 0.35rem; background: #fff3cd; color: #856404; font-size: 0.8rem; font-weight: 600; }
.sum-enrollment__blocked { margin: 0.75rem 0 0; padding: 0.75rem 1rem; border-radius: 0.35rem; background: #f8d7da; color: #721c24; font-size: 0.8rem; }
.sum-enrollment__table-card { margin-top: 1rem; padding: 1rem; border-radius: 0.75rem; background: var(--color-sum-surface); }
.sum-enrollment__search { display: flex; justify-content: flex-end; margin-bottom: 0.5rem; font-size: 0.75rem; }
.sum-enrollment__search input { margin-left: 0.35rem; padding: 0.25rem 0.4rem; border: 1px solid var(--color-sum-border); border-radius: 0.2rem; }
.sum-enrollment__table { width: 100%; border-collapse: collapse; font-size: 0.72rem; }
.sum-enrollment__table th, .sum-enrollment__table td { padding: 0.45rem 0.6rem; border: 1px solid var(--color-sum-border); text-align: center; }
.sum-enrollment__table td:nth-child(3) { text-align: left; }
.sum-enrollment__row--mandatory td { background: #f8d7da; }
.sum-enrollment__cycle { display: inline-block; min-width: 1.2rem; padding: 0.05rem 0.3rem; border: 1px solid #c6c8ca; border-radius: 0.2rem; background: #e2e3e5; color: #383d41; font-weight: 600; }
.sum-enrollment__section-badge { display: inline-block; min-width: 1.2rem; padding: 0.05rem 0.3rem; border-radius: 0.2rem; background: #d6d2f7; color: var(--color-sum-accent); font-weight: 600; }
.sum-enrollment__actions { white-space: nowrap; }
.sum-enrollment__pick, .sum-enrollment__remove { display: inline-flex; align-items: center; justify-content: center; width: 1.6rem; height: 1.6rem; margin: 0 0.1rem; border: 0; border-radius: 0.2rem; }
.sum-enrollment__pick { background: #f6b500; color: #5a4100; }
.sum-enrollment__remove { background: #dc3545; color: #fff; }
.sum-enrollment__pick:disabled, .sum-enrollment__remove:disabled { opacity: 0.55; }
.sum-enrollment__totals { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.5rem; margin: 1rem 0 0; }
.sum-enrollment__totals div { display: flex; gap: 0.3rem; padding: 0.75rem 1rem; border: 1px solid #b8daff; border-radius: 0.35rem; background: #cce5ff; color: #004085; font-size: 0.75rem; font-weight: 600; }
.sum-enrollment__totals dd { margin: 0; }
.sum-enrollment__execute { display: flex; justify-content: center; margin-top: 1rem; }
.sum-enrollment__execute-button { padding: 0.6rem 1.2rem; border: 0; border-radius: 0.25rem; background: #28c76f; color: #fff; font-weight: 600; }
.sum-enrollment__execute-button:disabled { opacity: 0.55; }
.sum-button { padding: 0.45rem 0.9rem; border: 0; border-radius: 0.25rem; font-weight: 600; }
.sum-button--success { background: #28c76f; color: #fff; }
.sum-button--danger { background: #ea5455; color: #fff; }
.sum-button--light { background: #f1f1f1; color: #4b4b4b; }
.sum-button:disabled { opacity: 0.8; }
.sum-section-dialog__course { display: grid; gap: 0.15rem; margin: 0 0 1rem; padding: 0.75rem 1rem; border-radius: 0.35rem; background: var(--color-sum-accent-soft); font-size: 0.75rem; }
.sum-section-dialog__course strong { color: var(--color-sum-accent); }
.sum-section-dialog__schedule-toggle { width: 1.2rem; height: 1.2rem; border: 0; border-radius: 50%; background: #28c76f; color: #fff; line-height: 1; }
.sum-section-dialog__actions { display: flex; justify-content: center; gap: 0.5rem; padding: 1rem; border-top: 1px solid var(--color-sum-border); }
.sum-alert { width: min(22rem, calc(100vw - 2rem)); padding: 1.5rem; border: 0; border-radius: 0.5rem; text-align: center; box-shadow: 0 0.5rem 2rem rgb(0 0 0 / 0.25); }
.sum-alert::backdrop { background: rgb(0 0 0 / 0.4); }
.sum-alert__icon { color: #6c757d; }
.sum-alert--success .sum-alert__icon { color: #28c76f; }
.sum-alert--error .sum-alert__icon { color: #ea5455; }
.sum-alert__title { margin: 0.5rem 0; font-size: 1.25rem; color: var(--color-sum-heading); }
.sum-alert__body { font-size: 0.8rem; }
.sum-alert__causes { margin: 0; padding-left: 1rem; text-align: left; }
.sum-alert__actions { display: flex; justify-content: center; gap: 0.75rem; margin-top: 1.25rem; }
.regular-enrollment__local-details { margin-top: 1.5rem; }
@media (max-width: 720px) { .sum-enrollment__totals { grid-template-columns: 1fr; gap: 0.5rem; } }
```

- [ ] **Step 6: Crear `client/src/components/SumEnrollmentTable.tsx`**

```tsx
import { useState } from 'react'
import type { Ref } from 'react'
import type { MatriculaRegularChoice, MatriculaRegularContext, MatriculaRegularId } from '../../../shared/matricula-regular.mjs'
import { buildEnrollmentRows, filterEnrollmentRows, summarizeSelection } from '../data/sumEnrollmentTable'
import './SumEnrollment.css'

function HandIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 24 28" aria-hidden="true">
      <path d="M9 2a2 2 0 0 1 4 0v9l1-.2a2 2 0 0 1 2 1.3l.2.4.6-.2a2 2 0 0 1 2.5 1.4l.1.4a2 2 0 0 1 2.6 1.6V20a8 8 0 0 1-8 8h-1a7 7 0 0 1-6-3.4L3 19a2 2 0 0 1 3.2-2.4L9 19V2z" fill="currentColor" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="12" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 3h6l1 2h4v2H4V5h4l1-2zM6 9h12l-1 12H7L6 9z" fill="currentColor" />
    </svg>
  )
}

/** V-02 notices. The yellow notice is shown only when a mandatory retake exists (gap: unobserved otherwise). */
export function SumEnrollmentNotices({ showMandatoryNotice }: { showMandatoryNotice: boolean }) {
  return (
    <>
      <p className="sum-enrollment__note">
        <span aria-hidden="true">ℹ </span><strong>Nota Importante:</strong> Después de efectuar su matrícula, debe acercarse a la
        Oficina de Matrícula de su facultad para recoger su Reporte Oficial de Matrícula y entregar toda la documentación que haya
        sido especificada por su facultad (constancias, comprobantes de pagos, etc.); de lo contrario, su matrícula será observada.
      </p>
      {showMandatoryNotice && (
        <p className="sum-enrollment__mandatory-note">
          (*) Asignatura Obligatoria por presentar una o más repitencias, Art. 18 Reglamento General de Matrícula.
        </p>
      )}
    </>
  )
}

export interface SumEnrollmentTableProps {
  context: MatriculaRegularContext
  choices: readonly MatriculaRegularChoice[]
  disabled: boolean
  executeDisabled: boolean
  onPick: (courseId: MatriculaRegularId) => void
  onRemove: (courseId: MatriculaRegularId) => void
  onExecute: () => void
  executeRef?: Ref<HTMLButtonElement>
  headingRef?: Ref<HTMLHeadingElement>
}

/** V-02/V-03/V-05: course table, search, totals and «Ejecutar Matrícula». Rules are evaluated by the server on submit. */
export function SumEnrollmentTable({
  context, choices, disabled, executeDisabled, onPick, onRemove, onExecute, executeRef, headingRef,
}: SumEnrollmentTableProps) {
  const [query, setQuery] = useState('')
  const rows = filterEnrollmentRows(buildEnrollmentRows(context, choices), query)
  const summary = summarizeSelection(context, choices)
  return (
    <section className="sum-enrollment__table-card" aria-labelledby="sum-enrollment-heading">
      <h3 id="sum-enrollment-heading" ref={headingRef} tabIndex={-1} className="sr-only">Registro de matrícula</h3>
      <div className="sum-enrollment__search">
        <label>Búsqueda:<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      </div>
      <div className="table-overflow">
        <table className="sum-enrollment__table">
          <thead>
            <tr><th>Ciclo</th><th>tipo</th><th>Asignatura</th><th>Créditos</th><th>Sección Elegida</th><th>Elegir Sección</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.courseId} className={row.mandatory ? 'sum-enrollment__row--mandatory' : undefined}
                title={row.mandatory ? 'Matrícula obligatoria' : undefined}>
                <td><span className="sum-enrollment__cycle">{row.cycle}</span></td>
                <td>{row.type}</td>
                <td>{row.subject}</td>
                <td>{row.credits}</td>
                <td>{row.chosenSection ? <span className="sum-enrollment__section-badge">{row.chosenSection}</span> : '--'}</td>
                <td className="sum-enrollment__actions">
                  <button type="button" className="sum-enrollment__pick" disabled={disabled}
                    aria-label={`Elegir sección de ${row.subject}`} onClick={() => onPick(row.courseId)}>
                    <HandIcon />
                  </button>
                  {row.chosenSection && (
                    <button type="button" className="sum-enrollment__remove" disabled={disabled}
                      aria-label={`Quitar sección de ${row.subject}`} onClick={() => onRemove(row.courseId)}>
                      <TrashIcon />
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td className="empty-cell" colSpan={6}>No hay asignaturas disponibles para matrícula.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <dl className="sum-enrollment__totals">
        <div><dt>Tope de créditos:</dt><dd>{summary.creditCap}</dd></div>
        <div><dt>Créditos matriculados:</dt><dd>{summary.credits}</dd></div>
        <div><dt>Asignaturas matriculadas:</dt><dd>{summary.courses}</dd></div>
      </dl>
      <div className="sum-enrollment__execute">
        <button ref={executeRef} type="button" className="sum-enrollment__execute-button" disabled={executeDisabled} onClick={onExecute}>
          Ejecutar Matrícula
        </button>
      </div>
    </section>
  )
}
```

- [ ] **Step 7: Crear `client/src/components/SectionPickerDialog.tsx`**

```tsx
import { Fragment, useEffect, useRef, useState } from 'react'
import type { MatriculaRegularId, MatriculaRegularOfferedCourse } from '../../../shared/matricula-regular.mjs'
import { buildSectionOptions } from '../data/sumEnrollmentTable'
import './SumEnrollment.css'

export interface SectionPickerDialogProps {
  course: MatriculaRegularOfferedCourse
  currentSectionId: MatriculaRegularId | null
  onAccept: (sectionId: MatriculaRegularId) => void
  onCancel: () => void
}

/** V-04 «Secciones disponibles». Mount with `key={course.courseId}` while open. «Horarios» expands a row (L-09). */
export function SectionPickerDialog({ course, currentSectionId, onAccept, onCancel }: SectionPickerDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [selected, setSelected] = useState<MatriculaRegularId | null>(currentSectionId)
  const [expanded, setExpanded] = useState<MatriculaRegularId | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])

  const options = buildSectionOptions(course)
  return (
    <dialog ref={dialogRef} className="course-schedule-dialog" aria-labelledby="sum-section-dialog-title"
      onCancel={(event) => { event.preventDefault(); onCancel() }}>
      <header className="course-schedule-dialog__header">
        <h2 id="sum-section-dialog-title">Secciones disponibles</h2>
        <button type="button" className="course-schedule-dialog__close" onClick={onCancel} aria-label="Cerrar secciones disponibles">×</button>
      </header>
      <div className="course-schedule-dialog__body">
        <p className="sum-section-dialog__course"><span>Asignatura</span><strong>{course.courseId} - {course.name}</strong></p>
        <table>
          <thead>
            <tr><th>Horarios</th><th>Sección</th><th>Aula</th><th>Docente</th><th>Matriculados / Vacantes</th><th>Seleccione</th></tr>
          </thead>
          <tbody>
            {options.map((option) => (
              <Fragment key={option.sectionId}>
                <tr>
                  <td>
                    <button type="button" className="sum-section-dialog__schedule-toggle"
                      aria-expanded={expanded === option.sectionId} aria-label={`Ver horarios de la sección ${option.label}`}
                      onClick={() => setExpanded((current) => current === option.sectionId ? null : option.sectionId)}>
                      {expanded === option.sectionId ? '−' : '+'}
                    </button>
                  </td>
                  <td><span className="sum-enrollment__section-badge">{option.label}</span></td>
                  <td>{option.room}</td>
                  <td>{option.teacher}</td>
                  <td>{option.occupancy}</td>
                  <td>
                    <input type="radio" name="sum-section" value={option.sectionId} checked={selected === option.sectionId}
                      aria-label={`Seleccionar sección ${option.label}`} onChange={() => setSelected(option.sectionId)} />
                  </td>
                </tr>
                {expanded === option.sectionId && (
                  <tr><td colSpan={6}>{option.schedule}</td></tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <footer className="sum-section-dialog__actions">
        <button type="button" className="sum-button sum-button--success" disabled={selected === null}
          onClick={() => { if (selected !== null) onAccept(selected) }}>✓ Aceptar</button>
        <button type="button" className="sum-button sum-button--danger" onClick={onCancel}>✕ Cancelar</button>
      </footer>
    </dialog>
  )
}
```

- [ ] **Step 8: Build y lint**

Run: `pnpm --dir client build && pnpm --dir client lint`
Expected: sin errores. Los componentes aún no se usan; Vite los compila igual por el chequeo de tipos de `tsc -b`.

- [ ] **Step 9: Punto de control (sin commit)**

Run: `git status --short client/src`

---

### Task 7: Confirmación, éxito con redirección, rechazo e integración en la pantalla (V-06, V-07, T-01)

**Files:**
- Create: `client/src/components/SumAlertDialog.tsx`
- Modify: `client/src/screens/RegularEnrollment.tsx` (imports, `SubmissionPanel`, y reemplazo de `LocalProfileEnrollmentScreen`)

**Interfaces:**
- Consumes:
  - De la Task 6: `SumEnrollmentNotices`, `SumEnrollmentTable`, `SectionPickerDialog`, `chooseSection` y `removeChoice`.
  - `formatOutcomeCauses` (`enrollmentResultDialog.ts`).
  - `reportLinkFromOutcome` y `REPORT_ROUTE_PATH`.
  - `localProfileSessionStore.renew()` (Task 4).
- Produces:
  - `SumAlertDialog({ kind, children, actions, onDismiss? })`.
  - `SubmissionRecoveryNotice(props)`, exportado desde `RegularEnrollment.tsx`.
  - `SUCCESS_REDIRECT_MS = 2000`.

- [ ] **Step 1: Crear `client/src/components/SumAlertDialog.tsx`**

```tsx
import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import './SumEnrollment.css'

export type SumAlertKind = 'warning' | 'success' | 'error'

const ALERT_ICONS: Record<SumAlertKind, ReactNode> = {
  warning: (
    <svg width="56" height="56" viewBox="0 0 24 24"><path d="M12 2 1 21h22L12 2zm-1 7h2v6h-2V9zm0 8h2v2h-2v-2z" fill="currentColor" /></svg>
  ),
  success: (
    <svg width="56" height="56" viewBox="0 0 24 24">
      <path d="M2 21h4V9H2v12zm20-11a2 2 0 0 0-2-2h-6.3l1-4.6V3a1.5 1.5 0 0 0-.4-1L13.2 1 6.6 7.6A2 2 0 0 0 6 9v10a2 2 0 0 0 2 2h9a2 2 0 0 0 1.8-1.2l3-7.1c.1-.2.2-.5.2-.7v-2z" fill="currentColor" />
    </svg>
  ),
  error: (
    <svg width="56" height="56" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="2" />
    </svg>
  ),
}

export interface SumAlertDialogProps {
  kind: SumAlertKind
  children: ReactNode
  actions: ReactNode
  /** Escape handler; omit it for alerts that cannot be dismissed (the success redirect). */
  onDismiss?: () => void
}

/** «Aviso» alert of V-06/V-07; the error variant is the authorized local inference L-08. Mount it only while open. */
export function SumAlertDialog({ kind, children, actions, onDismiss }: SumAlertDialogProps) {
  const titleId = useId()
  const bodyId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    return () => { if (dialog?.open) dialog.close() }
  }, [])
  return (
    <dialog ref={dialogRef} className={`sum-alert sum-alert--${kind}`} aria-labelledby={titleId} aria-describedby={bodyId}
      onCancel={(event) => { event.preventDefault(); onDismiss?.() }}>
      <div className="sum-alert__icon" aria-hidden="true">{ALERT_ICONS[kind]}</div>
      <h2 id={titleId} className="sum-alert__title">Aviso</h2>
      <div id={bodyId} className="sum-alert__body">{children}</div>
      <div className="sum-alert__actions">{actions}</div>
    </dialog>
  )
}
```

- [ ] **Step 2: Extraer `SubmissionRecoveryNotice` en `RegularEnrollment.tsx`**

En `SubmissionPanel`, sustituir el bloque desde `      <p className="regular-enrollment__live" role="status" aria-live="polite">` hasta el cierre de `{notice && ( … )}` (inclusive) por:

```tsx
      <SubmissionRecoveryNotice phase={phase} uncertain={uncertain} storageNotice={storageNotice} notice={notice}
        hasSession={hasSession} lookupBusy={lookupBusy} onConsult={onConsult} onReplay={onReplay} />
```

y añadir al final del archivo:

```tsx
export interface SubmissionRecoveryNoticeProps {
  phase: SubmissionPhase
  uncertain: SubmissionPanelProps['uncertain']
  storageNotice: boolean
  notice: Notice | null
  hasSession: boolean
  lookupBusy?: boolean
  onConsult: () => void
  onReplay: () => void
}

/** Local-only recovery (L-04): sending status, uncertain result with manual consult/replay, and notices. Not part of SUM. */
export function SubmissionRecoveryNotice({
  phase, uncertain, storageNotice, notice, hasSession, lookupBusy = false, onConsult, onReplay,
}: SubmissionRecoveryNoticeProps) {
  const submitting = phase === 'submitting'
  return (
    <>
      <p className="regular-enrollment__live" role="status" aria-live="polite">
        {submitting ? 'Enviando solicitud… espere el resultado; la lectura del contexto sigue disponible.' : ''}
      </p>
      {uncertain && (
        <div className="regular-enrollment__uncertain" role="status" aria-live="polite">
          <h4>Resultado no confirmado</h4>
          <p>{UNCERTAIN_MESSAGES[uncertain.reason]} No se muestra éxito ni rechazo: esto no equivale a un rechazo académico.</p>
          {uncertain.lookup !== 'none' && <p>{LOOKUP_MESSAGES[uncertain.lookup]}</p>}
          {storageNotice && (
            <p>
              No se pudo guardar la identidad de esta solicitud en el navegador: se conserva solo en memoria y,
              si recarga la página, no podrá consultarla ni repetirla.
            </p>
          )}
          <p>Consulte el resultado; si aún no existe, puede repetir manualmente el mismo envío con una sesión local vigente.</p>
          <div className="regular-enrollment__uncertain-actions">
            <button type="button" disabled={lookupBusy || submitting} onClick={onConsult}>Consultar resultado</button>
            <button type="button" disabled={!hasSession || lookupBusy || submitting} onClick={onReplay}>Repetir el mismo envío</button>
          </div>
          {!hasSession && <p>Inicie una sesión local para poder repetir el envío.</p>}
        </div>
      )}
      {notice && (
        <p className={`regular-enrollment__notice regular-enrollment__notice--${notice.tone}`} role="status" aria-live="polite">
          {notice.message}
        </p>
      )}
    </>
  )
}
```

Después del reemplazo, en `SubmissionPanel` la variable local `submitting` sigue usándose en `aria-busy`.

- [ ] **Step 3: Actualizar los imports de `RegularEnrollment.tsx`**

- Sustituir `import { getDialogKind } from '../data/enrollmentResultDialog'` por `import { formatOutcomeCauses, getDialogKind } from '../data/enrollmentResultDialog'`.
- Añadir debajo de `import { PreEnrollmentPanel } from '../components/PreEnrollmentPanel'`:

```tsx
import { SectionPickerDialog } from '../components/SectionPickerDialog'
import { SumAlertDialog } from '../components/SumAlertDialog'
import { SumEnrollmentNotices, SumEnrollmentTable } from '../components/SumEnrollmentTable'
import { chooseSection, removeChoice } from '../data/sumEnrollmentTable'
```

- [ ] **Step 4: Reemplazar `LocalProfileEnrollmentScreen`**

Sustituir completo el bloque que va desde `function LocalProfileEnrollmentScreen() {` hasta la línea anterior a `export function RegularEnrollmentScreen() {` por:

```tsx
/** L-10: delay of the success alert before the automatic redirect (observed redirect, unmeasured delay). */
const SUCCESS_REDIRECT_MS = 2000

function LocalProfileEnrollmentScreen() {
  const snapshot = useSyncExternalStore(localProfileSessionStore.subscribe,
    localProfileSessionStore.getSnapshot, localProfileSessionStore.getSnapshot)
  const localStatus = snapshot.status
  const profileRunId = snapshot.status === 'active' ? snapshot.runId : null
  const profileActorId = snapshot.status === 'active' ? snapshot.actorId : null
  const profileSessionId = snapshot.status === 'active' ? snapshot.sessionId : null
  const profileGeneration = snapshot.generation
  const [contextEnvelope, setContextEnvelope] = useState<MatriculaRegularEnvelope<MatriculaRegularContext> | null>(null)
  const [contextRevision, setContextRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedChoices, setSelectedChoices] = useState<MatriculaRegularChoice[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [lookupBusy, setLookupBusy] = useState(false)
  const [uncertain, setUncertain] = useState<UncertainState | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [resultOutcome, setResultOutcome] = useState<MatriculaRegularOutcome | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pickerCourseId, setPickerCourseId] = useState<MatriculaRegularId | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [storage] = useState(browserStorage)
  const [flow] = useState(() => createSubmissionFlow({ api: createMatriculaRegularApi({ mode: 'local' }), storage }))
  const navigate = useNavigate()
  const submitControllerRef = useRef<AbortController | null>(null)
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const uncertainRef = useRef<UncertainState | null>(null)
  const registerHeadingRef = useRef<HTMLHeadingElement>(null)
  const submitButtonRef = useRef<HTMLButtonElement>(null)
  const updateUncertain = useCallback((value: UncertainState | null) => {
    uncertainRef.current = value
    setUncertain(value)
  }, [])

  useEffect(() => localProfileSessionStore.subscribe(() => {
    if (localProfileSessionStore.getSnapshot().status === 'expired') setSelectedChoices([])
  }), [])

  useEffect(() => {
    if (localStatus !== 'active' || !profileRunId || !profileActorId || !profileSessionId) {
      return
    }
    const identity = { runId: profileRunId, actorId: profileActorId, sessionId: profileSessionId }
    const controller = new AbortController()
    localProfileSessionStore.read('matriculaInfo', { signal: controller.signal })
      .then(({ data }) => {
        if (controller.signal.aborted) return
        const context = data.payload
        if (context.actorId !== profileActorId) {
          throw new Error('El contexto no corresponde al perfil activo.')
        }
        const envelope = { runId: profileRunId, data: context }
        if (context.eligibility.state !== 'eligible' || !context.preEnrollmentComplete || !context.offerKnown) setSelectedChoices([])
        if (!flow.isBusy()) {
          const restored = restoreIntent(storage, { runId: identity.runId, actorId: identity.actorId })
          if (restored.kind === 'restored' && uncertainRef.current?.intent.requestId !== restored.intent.requestId) {
            updateUncertain({ intent: restored.intent, reason: 'restored', lookup: 'none', persisted: true })
          } else if (restored.kind === 'reset') {
            updateUncertain(null)
            setSelectedChoices([])
            setNotice({ tone: 'warning', message: RUN_RESET_MESSAGE })
          }
        }
        setContextEnvelope(envelope)
        setError(null)
        setLoading(false)
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return
        setLoading(false)
        setError(failure instanceof Error ? failure.message : 'No se pudo cargar el contexto local.')
      })
    return () => controller.abort()
  }, [localStatus, profileRunId, profileActorId, profileSessionId, profileGeneration, contextRevision, flow, storage, updateUncertain])

  useEffect(() => () => {
    submitControllerRef.current?.abort()
    if (redirectTimerRef.current !== null) clearTimeout(redirectTimerRef.current)
  }, [])

  const session: MatriculaRegularSession | null = snapshot.status === 'active' || snapshot.status === 'expired'
    ? { runId: snapshot.runId, actorId: snapshot.actorId, sessionId: snapshot.sessionId,
      startedAt: snapshot.startedAt, expiresAt: snapshot.expiresAt }
    : null

  /** V-07: success alert + automatic redirect; rejection opens the error alert (L-08); pending keeps a notice. */
  const showOutcome = (outcome: MatriculaRegularOutcome) => {
    setResultOutcome(outcome)
    if (outcome.state === 'configuration-pending') {
      setNotice({ tone: 'warning', message: 'La solicitud requiere configuración local y no se presenta como matrícula.' })
      return
    }
    const current = localProfileSessionStore.getSnapshot()
    if (outcome.state === 'accepted' && current.status !== 'active') {
      setNotice({ tone: 'info', message: 'La solicitud fue aceptada. Inicie sesión de nuevo para consultar su reporte de matrícula.' })
      return
    }
    setDialogOpen(true)
    if (outcome.state !== 'accepted' || current.status !== 'active') return
    const link = reportLinkFromOutcome(outcome, current.runId)
    redirectTimerRef.current = setTimeout(() => {
      redirectTimerRef.current = null
      setDialogOpen(false)
      if (!link) {
        setNotice({ tone: 'warning', message: 'No se pudo construir un enlace local válido al reporte.' })
        return
      }
      // L-07: in SUM the redirect is a new page and resets the 15-minute timer (V-07 → V-08).
      void localProfileSessionStore.renew()
      void navigate({ to: REPORT_ROUTE_PATH, params: { enrollmentId: link.enrollmentId }, search: link.search })
    }, SUCCESS_REDIRECT_MS)
  }

  const handleSubmit = async () => {
    if (snapshot.status !== 'active' || !contextEnvelope || submitting || flow.isBusy() || uncertainRef.current) return
    if (!selectedChoices.length || contextEnvelope.data.eligibility.state !== 'eligible') return
    const generation = snapshot.generation
    const controller = new AbortController()
    submitControllerRef.current = controller
    setNotice(null)
    setSubmitting(true)
    const attemptPromise = flow.submit({ runId: snapshot.runId, actorId: snapshot.actorId, sessionId: snapshot.sessionId,
      profileRevision: contextEnvelope.data.profileRevision, selection: selectedChoices, signal: controller.signal })
    const intentKey = `${INTENT_KEY_PREFIX}${snapshot.runId}:${snapshot.actorId}`
    const serializedIntent = storage?.getItem(intentKey) ?? null
    const attempt = await attemptPromise
    if (localProfileSessionStore.getSnapshot().generation !== generation) {
      preserveLateIntent(storage, intentKey, serializedIntent)
      return
    }
    if (controller.signal.aborted) return
    setSubmitting(false)
    if (attempt.result.kind === 'outcome') {
      updateUncertain(null)
      showOutcome(attempt.result.outcome)
    } else if (attempt.result.kind === 'run-changed') {
      localProfileSessionStore.markRunChanged()
    } else if (attempt.result.kind === 'definitive') {
      updateUncertain(null)
      setNotice({ tone: 'warning', message: DEFINITIVE_HANDLING[attempt.result.code]?.message ?? `La API local respondió ${attempt.result.code}.` })
      if (attempt.result.code === 'SESSION_EXPIRED') localProfileSessionStore.markExpired()
    } else {
      updateUncertain({ intent: attempt.intent, reason: attempt.result.kind === 'conflict' ? 'conflict' : attempt.result.reason,
        lookup: 'none', persisted: attempt.persisted })
    }
  }

  const handleConsult = async () => {
    const pending = uncertainRef.current
    if (!pending || lookupBusy || submitting) return
    const controller = new AbortController()
    submitControllerRef.current = controller
    setLookupBusy(true)
    const generation = localProfileSessionStore.getSnapshot().generation
    const result = await flow.consult({ intent: pending.intent, signal: controller.signal })
    if (controller.signal.aborted || localProfileSessionStore.getSnapshot().generation !== generation) return
    setLookupBusy(false)
    if (result.kind === 'known') {
      updateUncertain(null)
      showOutcome(result.outcome)
    } else if (result.kind === 'run-changed') localProfileSessionStore.markRunChanged()
    else updateUncertain({ ...pending, lookup: result.kind === 'unknown' ? 'unknown' : 'error' })
  }

  const handleReplay = async () => {
    if (snapshot.status !== 'active') return
    const pending = uncertainRef.current
    if (!pending || submitting || lookupBusy || flow.isBusy()) return
    const controller = new AbortController()
    submitControllerRef.current = controller
    setSubmitting(true)
    const generation = snapshot.generation
    const intentKey = `${INTENT_KEY_PREFIX}${pending.intent.runId}:${pending.intent.actorId}`
    const serializedIntent = storage?.getItem(intentKey) ?? null
    const attempt = await flow.replay({ intent: pending.intent, sessionId: snapshot.sessionId, signal: controller.signal })
    if (localProfileSessionStore.getSnapshot().generation !== generation) {
      preserveLateIntent(storage, intentKey, serializedIntent)
      return
    }
    if (controller.signal.aborted) return
    setSubmitting(false)
    if (attempt.result.kind === 'outcome') {
      updateUncertain(null)
      showOutcome(attempt.result.outcome)
    } else if (attempt.result.kind === 'run-changed') localProfileSessionStore.markRunChanged()
    else if (attempt.result.kind === 'uncertain' || attempt.result.kind === 'conflict') {
      updateUncertain({ intent: attempt.intent, reason: attempt.result.kind === 'conflict' ? 'conflict' : attempt.result.reason,
        lookup: 'none', persisted: attempt.persisted })
    }
  }

  // L-06/L-08 (T-01): closing the rejection returns to the registration with an empty selection and fresh vacancies.
  const closeRejected = () => {
    setDialogOpen(false)
    setSelectedChoices([])
    setResultOutcome(null)
    setContextRevision((value) => value + 1)
    setTimeout(() => registerHeadingRef.current?.focus(), 0)
  }

  const phase: SubmissionPhase = submitting ? 'submitting' : uncertain ? 'uncertain' : 'idle'
  const acceptedOutcome = resultOutcome?.state === 'accepted' ? resultOutcome : null
  const rejectedOutcome = dialogOpen && resultOutcome?.state === 'rejected' ? resultOutcome : null
  const context = contextEnvelope?.data
  const expired = snapshot.status === 'expired'
  const choices = uncertain?.intent.selection ?? selectedChoices
  const selectionDisabled = snapshot.status !== 'active' || submitting || uncertain !== null
    || acceptedOutcome !== null || context?.eligibility.state !== 'eligible'
  const pickerCourse = context && pickerCourseId
    ? context.offer.find((course) => course.courseId === pickerCourseId) ?? null
    : null

  return (
    <div className="regular-enrollment">
      <header className="regular-enrollment__header">
        <PageTitle>Matrícula Regular (Prototipo Local)</PageTitle>
        <p className="regular-enrollment__subtitle">Entorno de evaluación y verificación sintética independiente.</p>
      </header>
      {loading && <section className="route-status" role="status">Consultando el contexto del perfil activo…</section>}
      {error && !loading && (
        <section className="route-status" role="alert">
          <h2>No se pudo cargar la información</h2>
          <p>{error}</p>
          <button type="button" onClick={() => setContextRevision((value) => value + 1)}>Intentar de nuevo</button>
        </section>
      )}
      {expired && <p role="status">La sesión local venció. La selección y los envíos están deshabilitados; se permite consultar manualmente un resultado pendiente.</p>}
      {context && session && (
        <>
          <StudentSummary />
          <SumEnrollmentNotices showMandatoryNotice={(context.retakeCourseIds ?? []).length > 0} />
          {context.eligibility.state !== 'eligible' && (
            <p className="sum-enrollment__blocked" role="status">La matrícula no está habilitada para este perfil sintético en este momento.</p>
          )}
          <SumEnrollmentTable context={context} choices={choices} disabled={selectionDisabled}
            executeDisabled={selectionDisabled || choices.length === 0 || phase !== 'idle'}
            onPick={setPickerCourseId}
            onRemove={(courseId) => setSelectedChoices((current) => removeChoice(current, courseId))}
            onExecute={() => setConfirmOpen(true)}
            executeRef={submitButtonRef} headingRef={registerHeadingRef} />
          <SubmissionRecoveryNotice phase={phase} uncertain={uncertain ? { reason: uncertain.reason, lookup: uncertain.lookup } : null}
            storageNotice={uncertain !== null && !uncertain.persisted} notice={notice} hasSession={snapshot.status === 'active'}
            lookupBusy={lookupBusy} onConsult={() => void handleConsult()} onReplay={() => void handleReplay()} />
          <details className="regular-enrollment__local-details">
            <summary>Detalle local de verificación (no forma parte de la interfaz SUM)</summary>
            <PreEnrollmentPanel context={context} />
            <EnrollmentCalendarPanel calendar={context.calendar} eligibility={context.eligibility}
              sources={context.sources} serverNow={context.serverNow} />
            <AcademicRequirementsPanel context={context} outcome={resultOutcome} />
          </details>
        </>
      )}
      {pickerCourse && (
        <SectionPickerDialog key={pickerCourse.courseId} course={pickerCourse}
          currentSectionId={choices.find((item) => item.courseId === pickerCourse.courseId)?.sectionId ?? null}
          onAccept={(sectionId) => {
            setSelectedChoices((current) => chooseSection(current, pickerCourse.courseId, sectionId))
            setPickerCourseId(null)
          }}
          onCancel={() => setPickerCourseId(null)} />
      )}
      {confirmOpen && (
        <SumAlertDialog kind="warning" onDismiss={() => setConfirmOpen(false)} actions={<>
          <button type="button" className="sum-button sum-button--success"
            onClick={() => { setConfirmOpen(false); void handleSubmit() }}>EJECUTAR</button>
          <button type="button" className="sum-button sum-button--light" onClick={() => setConfirmOpen(false)}>CANCELAR</button>
        </>}>
          <p>Revise cuidadosamente las asignaturas seleccionadas. ¿Está seguro de ejecutar la matrícula?</p>
        </SumAlertDialog>
      )}
      {dialogOpen && acceptedOutcome && (
        <SumAlertDialog kind="success"
          actions={<button type="button" className="sum-button sum-button--light" disabled>REDIRECCIONANDO...</button>}>
          <p><strong>La Matrícula se registró exitosamente. Lo estamos redireccionando a su reporte de matrícula.</strong></p>
        </SumAlertDialog>
      )}
      {rejectedOutcome && (
        <SumAlertDialog kind="error" onDismiss={closeRejected}
          actions={<button type="button" className="sum-button sum-button--light" onClick={closeRejected}>ACEPTAR</button>}>
          <ul className="sum-alert__causes">
            {formatOutcomeCauses(rejectedOutcome.causes).map((cause, index) => (
              <li key={`${cause.code}-${index}`}>
                <strong>{cause.title}</strong>{cause.coursesSummary ? ` — ${cause.coursesSummary}` : ''}
                <br />{cause.description}
              </li>
            ))}
          </ul>
        </SumAlertDialog>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Build, lint y pruebas de datos**

Run: `pnpm --dir client build && pnpm --dir client lint && pnpm --dir client test:data`
Expected: los tres sin errores. Las pruebas `matriculaRegularRecovery*` y `matriculaRegularUs*` siguen pasando porque solo cambia la presentación.

- [ ] **Step 6: Punto de control (sin commit)**

Run: `git status --short client/src`

---

### Task 8: Reporte posterior a la matrícula con estructura SUM (V-08)

**Files:**
- Modify: `client/src/data/regularEnrollmentReport.ts` (añadir `buildSumReportView` y `formatRecordRange`)
- Modify: `client/src/screens/RegularEnrollmentReport.tsx` (reemplazo completo)
- Modify: `client/src/screens/RegularEnrollmentReport.css` (reemplazo completo)
- Modify: `client/src/routes/local.matricula-regular.reporte.$enrollmentId.tsx` (reemplazo completo)
- Test: `client/src/data/sumEnrollmentReport.test.ts`

**Interfaces:**
- Consumes: `formatLimaDateTime` (Task 5); `matchesSearch` (Task 6); `enrollmentReport` (kit).
- Produces:
  - `SUM_REPORT_HEADERS` y `NO_TEACHER = '-- --, --'`.
  - `interface SumReportView`.
  - `buildSumReportView(report): SumReportView`.
  - `formatRecordRange(count: number): string`.
  - `RegularEnrollmentReportView({ report })`, sin `backLink`.

- [ ] **Step 1: Escribir la prueba que falla**

Create `client/src/data/sumEnrollmentReport.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { enrollmentReport } from '../../tests/fixtures/matriculaRegularKit.ts'
import { buildSumReportView, formatRecordRange } from './regularEnrollmentReport.ts'

test('V-08: rows show cycle, code - name, credits, section label and teacher, ordered by cycle', () => {
  const base = enrollmentReport()
  const view = buildSumReportView(enrollmentReport({ rows: base.rows.map((row, index) => ({
    ...row, cycle: index === 0 ? 7 : 1, label: String(index + 1), teacher: index === 0 ? null : 'SINTÉTICO, DOCENTE DOS',
  })) }))
  assert.deepEqual(view.headers, ['Ciclo', 'Asignatura', 'Créditos', 'Sección', 'Docente Asignado'])
  assert.deepEqual(view.rows, [
    ['1', 'SYN-SIS-C2 - Curso, "sintético" 2', '3', '2', 'SINTÉTICO, DOCENTE DOS'],
    ['7', 'SYN-SIS-C1 - Curso sintético 1', '4', '1', '-- --, --'],
  ])
  assert.equal(view.acceptedAt, '11/08/2026 10:00:00')
  assert.equal(view.enrollmentType, 'Matrícula Vía Web')
  assert.equal(view.totalCredits, 7)
  assert.equal(view.courseCount, 2)
})

test('MR2 reports without display fields fall back to --, the sectionId and the observed empty teacher', () => {
  const view = buildSumReportView(enrollmentReport())
  assert.deepEqual(view.rows[0], ['--', 'SYN-SIS-C1 - Curso sintético 1', '4', 'SYN-SIS-S1', '-- --, --'])
})

test('V-08: record range text', () => {
  assert.equal(formatRecordRange(3), 'Mostrando 1 - 3 de 3 registros')
  assert.equal(formatRecordRange(0), 'Mostrando 0 - 0 de 0 registros')
})

test('the CSV mirrors the table and keeps a single-extension base name', () => {
  const view = buildSumReportView(enrollmentReport())
  assert.deepEqual(view.csv.headers, view.headers)
  assert.deepEqual(view.csv.rows, view.rows)
  assert.equal(view.csv.name, 'reporte-matricula-SYN-SIS-A')
})
```

- [ ] **Step 2: Ejecutar para ver el fallo**

Run: `pnpm --dir client test:data`
Expected: FAIL; `buildSumReportView` y `formatRecordRange` no se exportan.

- [ ] **Step 3: Implementar el modelo del reporte**

En `client/src/data/regularEnrollmentReport.ts`, añadir debajo de `import { formatMeetingSchedule } from './selectionPanel.ts'`:

```ts
import { formatLimaDateTime } from './sumEnrollmentFormat.ts'
```

y al final del archivo:

```ts
/** V-08 (#38) columns and the observed placeholder for a section without teacher. */
export const SUM_REPORT_HEADERS = ['Ciclo', 'Asignatura', 'Créditos', 'Sección', 'Docente Asignado']
export const NO_TEACHER = '-- --, --'

export interface SumReportView {
  headers: string[]
  rows: string[][]
  acceptedAt: string
  enrollmentType: string
  totalCredits: number
  courseCount: number
  csv: { name: string; headers: string[]; rows: string[][] }
}

/** Projection of the accepted enrollment for the SUM-style report; rows ordered by cycle (unknown last, stable). */
export function buildSumReportView(report: MatriculaRegularEnrollmentReport): SumReportView {
  const cycleOrder = (cycle: number | null | undefined) => cycle ?? Number.MAX_SAFE_INTEGER
  const rows = [...report.rows]
    .sort((left, right) => cycleOrder(left.cycle) - cycleOrder(right.cycle))
    .map((row) => {
      const cycle = row.cycle ?? null
      return [
        cycle === null ? '--' : String(cycle),
        `${row.courseId} - ${row.name}`,
        String(row.credits),
        row.label ?? row.sectionId,
        row.teacher ?? NO_TEACHER,
      ]
    })
  return {
    headers: SUM_REPORT_HEADERS,
    rows,
    acceptedAt: formatLimaDateTime(report.acceptedAt, 'schedule'),
    enrollmentType: 'Matrícula Vía Web',
    totalCredits: report.totalCredits,
    courseCount: report.rows.length,
    // The base name carries no extension: the shared DownloadButton appends exactly one «.csv».
    csv: { name: `reporte-matricula-${report.actorId}`, headers: SUM_REPORT_HEADERS, rows },
  }
}

/** V-08: «Mostrando 1 - N de N registros». */
export function formatRecordRange(count: number): string {
  return count === 0 ? 'Mostrando 0 - 0 de 0 registros' : `Mostrando 1 - ${count} de ${count} registros`
}
```

- [ ] **Step 4: Ejecutar las pruebas**

Run: `pnpm --dir client test:data`
Expected: PASS, incluidas las cuatro pruebas nuevas y las existentes `T044`/`T045`, porque `buildReportView` no cambia.

- [ ] **Step 5: Reemplazar `client/src/screens/RegularEnrollmentReport.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { DataTable, DownloadButton, StudentSummary } from '../components/Common'
import type { MatriculaRegularEnrollmentReport } from '../data/matriculaRegular'
import { buildReportView, buildSumReportView, formatRecordRange, REPORT_HEADING_ID } from '../data/regularEnrollmentReport'
import { matchesSearch } from '../data/sumEnrollmentTable'
import './RegularEnrollmentReport.css'

export interface RegularEnrollmentReportViewProps {
  report: MatriculaRegularEnrollmentReport
}

/** V-08 (#38): report shown after an accepted enrollment. Focus lands on the heading when the route is shown. */
export function RegularEnrollmentReportView({ report }: RegularEnrollmentReportViewProps) {
  const view = buildSumReportView(report)
  const [query, setQuery] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus() }, [])
  const rows = view.rows.filter((row) => matchesSearch(row, query))

  return (
    <div className="regular-enrollment-report">
      <StudentSummary />
      <section className="regular-enrollment-report__card" aria-labelledby={REPORT_HEADING_ID}>
        <h3 id={REPORT_HEADING_ID} ref={headingRef} tabIndex={-1} className="regular-enrollment-report__heading">
          ASIGNATURAS MATRICULADAS
        </h3>
        <div className="regular-enrollment-report__meta">
          <p>Fecha y Hora : {view.acceptedAt}</p>
          <p>Tipo : {view.enrollmentType}</p>
        </div>
        <div className="regular-enrollment-report__toolbar">
          <DownloadButton name={view.csv.name} headers={view.csv.headers} rows={view.csv.rows} />
          <label>Búsqueda:<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        </div>
        <DataTable headers={view.headers} rows={rows} footer={false} empty="No hay registros" />
        <p className="regular-enrollment-report__range">{formatRecordRange(rows.length)}</p>
        <div className="regular-enrollment-report__totals">
          <p>Créditos matriculados : {view.totalCredits}</p>
          <p>Asignaturas matriculadas : {view.courseCount}</p>
        </div>
      </section>
      <details className="regular-enrollment-report__local">
        <summary>Detalle local</summary>
        <p>
          Reporte de la réplica local generado al aceptar la solicitud; no es un documento oficial ni equivale a un visado.
          {' '}{buildReportView(report).windowOriginLabel}.
        </p>
      </details>
    </div>
  )
}
```

- [ ] **Step 6: Reemplazar `client/src/screens/RegularEnrollmentReport.css`**

```css
/* V-08 (#38): colors approximated from the screenshot, not pixel-measured. */
.regular-enrollment-report__card { margin-top: 1.25rem; padding: 1.25rem; border-radius: 0.75rem; background: var(--color-sum-surface); }
.regular-enrollment-report__heading { margin: 0 0 1rem; text-align: center; font-size: 1rem; font-weight: 400; color: var(--color-sum-heading); }
.regular-enrollment-report__meta { width: fit-content; margin: 0 0 1rem auto; padding: 0.6rem 1rem; border: 1px solid #bee5eb; border-radius: 0.35rem; background: #d1ecf1; color: #0c5460; font-size: 0.75rem; }
.regular-enrollment-report__meta p, .regular-enrollment-report__totals p { margin: 0.1rem 0; }
.regular-enrollment-report__toolbar { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 0.5rem; font-size: 0.75rem; }
.regular-enrollment-report__toolbar input { margin-left: 0.35rem; padding: 0.25rem 0.4rem; border: 1px solid var(--color-sum-border); border-radius: 0.2rem; }
.regular-enrollment-report__range { margin: 0.5rem 0 0; font-size: 0.72rem; }
.regular-enrollment-report__totals { width: fit-content; margin: 0.75rem 0 0 auto; padding: 0.6rem 1rem; border: 1px solid #bee5eb; border-radius: 0.35rem; background: #d1ecf1; color: #0c5460; font-size: 0.75rem; }
.regular-enrollment-report__local { margin-top: 1rem; font-size: 0.75rem; }
```

- [ ] **Step 7: Reemplazar `client/src/routes/local.matricula-regular.reporte.$enrollmentId.tsx`**

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { RouteError, RoutePending } from '../components/RouteStatus'
import { createMatriculaRegularApi } from '../data/matriculaRegular'
import { parseReportSearch } from '../data/regularEnrollmentReport'
import { RegularEnrollmentReportView } from '../screens/RegularEnrollmentReport'
import { getLocalProfileActivation } from '../data/client'
import { activeProfileIdentity } from '../data/localProfileSession'
import { localProfileSessionStore } from '../data/client'

export const Route = createFileRoute('/local/matricula-regular/reporte/$enrollmentId')({
  validateSearch: parseReportSearch,
  loaderDeps: ({ search }) => ({ runId: search.runId, actorId: search.actorId }),
  // Read-only GET against the own local API; RouteError.invalidate reloads this GET and never submits.
  loader: async ({ params, deps, abortController }) => {
    if (getLocalProfileActivation() !== 'synthetic-actors') return { mode: 'unavailable' as const }
    const identity = activeProfileIdentity(localProfileSessionStore.getSnapshot())
    if (!identity || identity.runId !== deps.runId || identity.actorId !== deps.actorId) {
      throw redirect({ to: '/alumnoWebSum/v2/reportes/matricula' })
    }
    return { mode: 'synthetic-actors' as const, report: await createMatriculaRegularApi({ mode: 'local' })
      .getReport({ ...deps, enrollmentId: params.enrollmentId }, { signal: abortController.signal }) }
  },
  pendingComponent: RoutePending,
  errorComponent: RouteError,
  component: function RegularEnrollmentReportRoute() {
    const loaded = Route.useLoaderData()
    if (loaded.mode === 'unavailable') return <section className="route-status" role="status">
      <h2>Matrícula regular local no disponible</h2>
      <p>Esta demostración solo está disponible con el perfil sintético local activado.</p>
    </section>
    return <RegularEnrollmentReportView report={loaded.report} />
  },
})
```

- [ ] **Step 8: Build, lint y pruebas**

Run: `pnpm --dir client build && pnpm --dir client lint && pnpm --dir client test:data`
Expected: los tres sin errores.

- [ ] **Step 9: Punto de control (sin commit)**

Run: `git status --short client/src`

---

### Task 9: Verificación integrada sintética (raíz, `sum-fullstack-verify`)

**Files:**
- Create: `client/scripts/verify-matricula-sum-ui.mjs`
- Create: `evidence/local/matricula-regular-sum-ui/verification.md`
- Create (generadas por el script): `evidence/local/matricula-regular-sum-ui/*.png`

**Interfaces:**
- Consumes: el dashboard sintético aislado (`scripts/start-local-profile-dashboard.mjs`), que compone `LocalProfileDashboardModule` con fixtures sintéticos, y todas las tasks anteriores.
- Produces: el registro criterio → escenario → esperado → obtenido.

- [ ] **Step 1: Crear `client/scripts/verify-matricula-sum-ui.mjs`**

```js
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// Root acceptance for plan matricula-regular-sum-ui (Task 9). Target: the isolated synthetic dashboard started by
// `node scripts/start-local-profile-dashboard.mjs`. Only loopback origins are accepted; no production SUM,
// private snapshot or CDP browser is ever used.
const origin = process.env.SUM_LOCAL_PROFILE_ORIGIN ?? 'http://127.0.0.1:5743'
if (!/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(origin)) throw new Error('SUM_LOCAL_PROFILE_ORIGIN debe ser http://127.0.0.1:<puerto>')
const outDir = fileURLToPath(new URL('../../evidence/local/matricula-regular-sum-ui/', import.meta.url))

async function login(page, actorId) {
  await page.goto(`${origin}/local/login`)
  await page.locator(`input[value="${actorId}"]`).check()
  await page.getByRole('button', { name: 'Ingresar' }).click()
  await page.waitForURL(/\/alumnoWebSum\/v2\/inicio/)
}

async function chooseFirstSection(page, index) {
  await page.getByRole('button', { name: /^Elegir sección de / }).nth(index).click()
  const dialog = page.getByRole('dialog', { name: 'Secciones disponibles' })
  await dialog.getByRole('radio').first().check()
  return dialog
}

const browser = await chromium.launch({ headless: true })
try {
  await mkdir(outDir, { recursive: true })
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } })
  const page = await context.newPage()

  // AC-SUM-10 (L-07): a reload keeps the tab session and renews it to 15 minutes.
  await login(page, 'SYN-SIS-A')
  await page.reload()
  await page.waitForURL(/\/alumnoWebSum\/v2\/inicio/)
  const clock = await page.locator('.session-clock').first().textContent()
  assert.match(clock ?? '', /^00:1[45]:\d\d$/, `reloj tras recarga: ${clock}`)
  assert.equal(await page.getByRole('button', { name: 'Renovar sesión' }).count(), 0)

  // AC-SUM-01 (V-01): enabled information screen.
  await page.goto(`${origin}/alumnoWebSum/v2/matricula/informacion`)
  await page.getByText('MATRICULA INTERNET HABILITADA').waitFor()
  await page.screenshot({ path: `${outDir}01-informacion-habilitada.png`, fullPage: true })
  await page.getByRole('link', { name: 'Iniciar Matrícula' }).click()
  await page.waitForURL(/\/local\/matricula-regular$/)

  // AC-SUM-03..05 (V-02, V-04, V-05): choose a section of every course.
  const count = await page.getByRole('button', { name: /^Elegir sección de / }).count()
  assert.ok(count >= 3, `asignaturas visibles: ${count}`)
  await page.screenshot({ path: `${outDir}02-registro.png`, fullPage: true })
  for (let index = 0; index < count; index += 1) {
    const dialog = await chooseFirstSection(page, index)
    if (index === 0) await page.screenshot({ path: `${outDir}03-secciones.png` })
    await dialog.getByRole('button', { name: /Aceptar/ }).click()
    await dialog.waitFor({ state: 'detached' })
  }
  assert.equal(await page.getByRole('button', { name: /^Quitar sección de / }).count(), count)
  await page.screenshot({ path: `${outDir}04-seleccion.png`, fullPage: true })

  // AC-SUM-06/07/09 (V-06, V-07, V-08): confirm, success alert and automatic redirect to the report.
  await page.getByRole('button', { name: 'Ejecutar Matrícula' }).click()
  await page.getByText('¿Está seguro de ejecutar la matrícula?').waitFor()
  await page.screenshot({ path: `${outDir}05-confirmacion.png` })
  await page.getByRole('button', { name: 'EJECUTAR' }).click()
  await page.getByText('La Matrícula se registró exitosamente.', { exact: false }).waitFor()
  await page.screenshot({ path: `${outDir}06-exito.png` })
  await page.waitForURL(/\/local\/matricula-regular\/reporte\//, { timeout: 10_000 })
  await page.getByRole('heading', { name: 'ASIGNATURAS MATRICULADAS' }).waitFor()
  assert.equal((await page.locator('.regular-enrollment-report__range').textContent())?.trim(), `Mostrando 1 - ${count} de ${count} registros`)
  await page.screenshot({ path: `${outDir}07-reporte.png`, fullPage: true })

  // AC-SUM-02 (O-UI-01): after enrolling, the information screen shows the registered-enrollment message.
  await page.goto(`${origin}/alumnoWebSum/v2/matricula/informacion`)
  await page.getByText('Usted registra matrícula en el presente semestre').waitFor()
  assert.equal(await page.getByRole('link', { name: 'Iniciar Matrícula' }).count(), 0)
  await page.screenshot({ path: `${outDir}08-informacion-registrada.png`, fullPage: true })

  // AC-SUM-08 (T-01, L-06, L-08): a rejected request lists its causes and returns to an empty selection.
  const second = await context.newPage()
  await login(second, 'SYN-SIS-B')
  await second.goto(`${origin}/local/matricula-regular`)
  const dialogB = await chooseFirstSection(second, 0)
  await dialogB.getByRole('button', { name: /Aceptar/ }).click()
  await second.getByRole('button', { name: 'Ejecutar Matrícula' }).click()
  await second.getByRole('button', { name: 'EJECUTAR' }).click()
  await second.getByText('Carga de créditos fuera de rango').waitFor()
  await second.screenshot({ path: `${outDir}09-rechazo.png` })
  await second.getByRole('button', { name: 'ACEPTAR' }).click()
  await second.getByText('Asignaturas matriculadas:').waitFor()
  assert.equal(await second.getByRole('button', { name: /^Quitar sección de / }).count(), 0)

  console.log(`OK: escenarios sintéticos verificados; capturas en ${outDir}`)
} finally {
  await browser.close()
}
```

- [ ] **Step 2: Comprobaciones estáticas y de unidad completas**

Run: `pnpm --dir client build && pnpm --dir client lint && pnpm --dir client test:data`
Expected: sin errores.

Run: `pnpm --dir backend build && pnpm --dir backend lint && pnpm --dir backend test`
Expected: sin errores.

- [ ] **Step 3: Reiniciar el dashboard sintético con una ejecución nueva**

Detener la instancia anterior del dashboard, si existe (en esta sesión: la tarea en segundo plano `ba1625td7`), y arrancar una nueva en segundo plano:

Run: `node scripts/start-local-profile-dashboard.mjs --backend-port=3100 --frontend-port=5743`
Expected: imprime `Backend aislado : http://127.0.0.1:3100` y `Frontend (Vite) : http://127.0.0.1:5743`. Una ejecución nueva deja SYN-SIS-A sin matrícula y el reloj sintético dentro de SYN-WINDOW-1 (2 h).

- [ ] **Step 4: Ejecutar el escenario integrado**

Run: `pnpm --dir client exec playwright install chromium` (solo si falta el navegador de Playwright)
Run: `node client/scripts/verify-matricula-sum-ui.mjs`
Expected: `OK: escenarios sintéticos verificados; capturas en …/evidence/local/matricula-regular-sum-ui/` y nueve PNG nuevos. Ante un fallo, se permite un único ciclo de reparación (`AGENTS.md` §5). Después se diagnostica y se registra.

- [ ] **Step 5: Registrar la verificación en `evidence/local/matricula-regular-sum-ui/verification.md`**

Completar esta tabla con los resultados **reales** del Step 4 y de los comandos del Step 2. No marcar un criterio como «Pasa» si su paso no se ejecutó.

```markdown
# Verificación local — matrícula regular con interfaz SUM

Fecha: <AAAA-MM-DD>. Entorno: dashboard sintético aislado (`scripts/start-local-profile-dashboard.mjs`), backend `127.0.0.1:3100`,
Vite `127.0.0.1:5743`, Chromium headless 1366×900. Datos: fixtures SYN; sin `datos-reales/`, sin SUM de producción.

| Criterio | Fuente | Escenario / comprobación | Esperado | Obtenido |
| --- | --- | --- | --- | --- |
| AC-SUM-01 Información habilitada | V-01 | Script, paso «enabled information screen»; `sumEnrollmentFormat.test.ts` | Franja HABILITADA, 4 recuadros, «Iniciar Matrícula» | |
| AC-SUM-02 Información con matrícula registrada | O-UI-01, L-11 | Script, paso posterior al reporte; pruebas `O-UI-01`/`L-11` | Mensaje «Usted registra matrícula…» + «Ver Matrícula», sin «Iniciar» | |
| AC-SUM-03 Tabla de registro | V-02, V-03 | Script `02-registro.png`; `sumEnrollmentTable.test.ts` | Columnas, orden por ciclo, «(*)» y fila roja con tooltip (SYN-SOFT-B) | |
| AC-SUM-04 Modal de secciones | V-04 | Script `03-secciones.png`; prueba `V-04` | Columnas, radio, Aceptar/Cancelar; sección llena seleccionable | |
| AC-SUM-05 Selección y totales | V-05 | Script `04-seleccion.png`; prueba `choose replaces…` | Sección elegida, papelera, totales, «Ejecutar Matrícula» | |
| AC-SUM-06 Confirmación | V-06 | Script `05-confirmacion.png` | Texto literal, EJECUTAR/CANCELAR | |
| AC-SUM-07 Éxito y redirección | V-07, L-10 | Script `06-exito.png` → URL del reporte | Aviso literal y redirección automática | |
| AC-SUM-08 Rechazo | T-01, L-06, L-08 | Script `09-rechazo.png` (SYN-SIS-B, 4 créditos y sección llena) | Todas las causas; ACEPTAR deja la selección vacía | |
| AC-SUM-09 Reporte | V-08 | Script `07-reporte.png`; `sumEnrollmentReport.test.ts` | Estructura V-08, «Mostrando 1 - N de N registros» | |
| AC-SUM-10 Sesión | T-01, L-07 | Script (recarga → 00:14/00:15); `localProfileSession.test.ts` | Recarga y vuelta renuevan; vencida o inválida → selector | |
| AC-SUM-11 Cabecera | V-02 | Script (sin «Renovar sesión») | Reloj, nombre, Salir | |
| AC-SUM-12 Contrato | MR-CONTRACT-3 | `matriculaRegularContractV3.test.ts`, `matricula-regular-sum-ui.spec.ts` | MR2 válido; campos MR3 validados | |

## Comandos y resultados

<pegar los comandos del Step 2 y del Step 4 con su resultado real>

## Límites

- Fidelidad visual aproximada: V-01…V-08 son de otra facultad y periodo, y los colores no se midieron. Las capturas locales
  no son comparables píxel a píxel.
- La renovación al cambiar de página del menú SUM (otra lectura de «pestaña») no está implementada ni verificada.
- La alerta de error y su literal son inferencia local (L-08), no comportamiento SUM observado.
```

- [ ] **Step 6: Revisar privacidad de las capturas generadas**

Abrir cada PNG de `evidence/local/matricula-regular-sum-ui/` y confirmar que solo contienen datos `SYN-*` y «Estudiante sintético …».
Expected: ninguna captura muestra datos reales; todas proceden del dashboard sintético.

- [ ] **Step 7: Punto de control final (sin commit)**

Run: `git status --short`
Expected: solo los archivos de este plan además del trabajo previo del usuario. Informar al usuario de los archivos cambiados, la evidencia usada, las decisiones `local-only` y los resultados reales, y que no se hizo commit.

---

## Fuera de alcance (seguimiento)

- Alinear `EnrollmentInfo` (modo legado y de snapshots) y `/alumnoWebSum/v2/reportes/matricula` del perfil sintético con O-UI-01 y V-08. Requiere autorización expresa de esas pantallas.
- Renovar la sesión al navegar entre páginas del menú, si el usuario aclara que «pestaña» significa eso.
- Literal SUM de la alerta de error: necesita una captura sanitizada.
