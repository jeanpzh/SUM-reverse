# T047: decisión sobre las superficies de tres brechas del harness

**Tarea:** `task_ef3dda94a56b` / dispatch `ctx_bdb24d45950e`. Autor: Claude Opus (análisis/decisión), 2026-10-13.
**Etapa:** solo lectura de código, contratos y especificaciones. Este documento es el único archivo escrito.
**Entradas fijas (sin modificar):** MR-PLAN-1r4, MR-CONTRACT-2
(`docs/reverse-engineering/contracts/local-api/matricula-regular.md`), MR-MODEL-2
(`specs/001-matricula-regular-fisi/data-model.md`), MR-ACCEPTANCE-1 (`acceptance-catalog.md`), spec.
**Revisado:** `t047-stage1-review-input.md` (relevo Sonnet: dry run 242/242 en proceso, 0 checks de UI) y el harness
en el WT `sum-mr-regression` (lectura, sin cambios): `backend/test/matricula-regular-matrix-scenarios.ts`.
**No se hizo:** tests, navegador, servidores, puertos, REA, ni lectura de `datos-reales/`, de snapshots o de credenciales.
Nada de esto es un PASS, una observación del SUM ni una evidencia N3. CodeGraph estaba configurado e indexado
(`codegraph.json` excluye `datos-reales/`, dependencias y `.git`), así que no se ejecutó `init`.

Abreviaturas: CAT = acceptance-catalog.md, CON = contrato MR-CONTRACT-2, DM = data-model.md, SPEC = spec.md,
FE = `client/src/screens/RegularEnrollment.tsx`, RU = `backend/src/matricula-regular/rules.ts`,
WI = `backend/src/matricula-regular/windows.ts`, SV = `backend/src/matricula-regular/matricula-regular.service.ts`,
SS = `backend/src/matricula-regular/session.service.ts`, SC = `scenarios.ts` del harness (WT `sum-mr-regression`).

## Recuento: tres brechas, doce instancias

| Brecha | Instancias | Conjunto SC |
| --- | --- | --- |
| 1. Superficie Context u Outcome | MAT-04-V18, MAT-06-V09, MAT-06-V10 y MAT-06-V11, ×SIS/SOFT = **8** (las «ocho controvertidas») | Las 8 están en el denominador «known» de SC-002 (CAT:225) |
| 2. Equivalencia conocida | MAT-04-V04 ×2 = **2** | SC-002 «known» (CAT:225) |
| 3. Recarga y renovación | MAT-07-V11 ×2 = **2** | Solo SC-006/SC-007 (universo de 242) |

En total hay **12 de las 242** instancias afectadas. Las brechas 1 y 2 tocan 10 de las 50 instancias «known» de SC-002.

## Separación entre norma y diseño local

- **Normativo** (`[Verificado-norma]`, F1). Deuda y salud: art. 24.b–c, RN-05/RN-06 (SPEC:606). Suspensión,
  separación y cuatro desaprobaciones: arts. 10/13.c/20, RN-07/RN-17 (SPEC:607). Equivalencias válidas: art. 16,
  RN-04 (SPEC:605). Estas fuentes establecen que **el requisito existe**. No prueban que el SUM lo controle ni cómo lo hace.
- **Testimonio:** sesión de 15 minutos, «renovación al recargar la página» y reingreso al expirar (SPEC:69-75,
  B-05 en SPEC:166). FR-025 aclara que la duración no fija el inicio ni la renovación (SPEC:526).
- **Diseño local (`local-only`):** la causa contextual en Context (CON:127-131, DM:46-51), el bloqueo de entrada
  en el cliente, el reset L-06 (SPEC:108, CON:253-258), MR-RENEW y el disparador «recarga» (CON:80, CON:215-219),
  y la representación sintética de las equivalencias (DM:68, DM:85-86). Ninguna decisión de este documento
  convierte un diseño local en comportamiento del SUM.

---

## Brecha 1: superficie Context u Outcome (8 instancias)

### Hechos con su fuente

| Afirmación | Fuente (archivo:línea) |
| --- | --- |
| Un requisito contextual incumplido y conocido produce una **causa contextual** en Context. `eligible` significa «entrada habilitada» | CON:127-131, DM:46-51 |
| Outcome evalúa la elección real y conserva todas sus causas. L-01 evalúa todas las causas conocidas | CON:131-132, CON:181-182 |
| El servidor incluye en Outcome las causas de Context y además las reglas institucionales | SV:107-121, RU:129-131, RU:176-189 |
| Context, para deuda, salud o elegibilidad `unmet`, devuelve `DEBT_/HEALTH_REQUIREMENT_UNMET` o `ACADEMIC_INELIGIBILITY` con `courseIds: []` | WI:184-200, WI:218-230, WI:250-264 |
| Context **ignora `failedCourses`**. La rama de cuatro desaprobaciones solo existe en Outcome, con una causa ligada al curso | WI:232-272 frente a RU:269-277 |
| Cuatro desaprobaciones con `institutional.eligibility` `met` o `unknown` dan pending, no rechazo | RU:273-277, DM:91-93 |
| El cliente: Context no `eligible` vacía la elección. «Iniciar sesión» y «Enviar» quedan deshabilitados si no es `eligible` | FE:138, FE:330, FE:547, FE:651 |
| MR-SESSION no tiene ningún error de elegibilidad en la tabla cerrada de errores. `SessionService.create` solo valida run y actor | CON:79, CON:233-243, SS:21-50 |
| La revisión del perfil es **inmutable por actor y run** | DM:12 |
| Texto del CAT: V09 y V10 dicen «…; reset; …». V11 dice «ACADEMIC_INELIGIBILITY, no inscripción». V18 dice «ACADEMIC_INELIGIBILITY; no cuarta matrícula ni creación de resolución» y cita AC-13 | CAT:93, CAT:124-126 |
| AC-13 exige **distinguir** la separación tras la cuarta desaprobación | SPEC:347-350 |
| En CAT, «reset» siempre acompaña a un rechazo con Outcome: es la transición L-06 | CAT:63-66, CAT:76, CAT:116, CAT:202 |
| El harness actual: `contextRow` con `ui.submitBlocked` para las cuatro filas, que quedan `held` | SC:554-561, SC:673-683, SC:1366-1367 |

### Mecanismos que propone el brief, evaluados

- **`Control.mutate` entre leer Context y enviar** (para que la UI real reciba un Outcome rechazado): **rechazado**.
  Cambiar un hecho del actor sin cambiar la revisión viola DM:12. Fabrica un estado que el modelo declara
  imposible y no es evidencia del requisito. Si se cambia también la revisión, el resultado es `409 PROFILE_CHANGED`
  (CON:239), que es MAT-09-V09 y no esta fila. `Control.mutate` solo es válido para **preparar el fixture
  antes** de la primera lectura.
- **Inyectar en sessionStorage un intento ajeno** para que «Consultar resultado» muestre el rechazo: **rechazado**.
  Simula estado del cliente que ningún usuario puede producir y prueba L-04, no esta fila.
- **Comprobación HTTP directa** (MR-SESSION seguido de MR-SUBMIT): **admisible solo como `http-contract`**.
  El contrato fija su resultado. La sesión no puede negarse por elegibilidad (CON:233-243) y el envío evalúa
  todas las causas conocidas (CON:181, SV:107-121). Por tanto el resultado es `rejected` con la causa y cero
  escrituras. **No es UI ni sustituye a la UI**, y no debe llamarse «nueva UI» ni «flujo de usuario».

### Decisión por variante

| Variante (×2) | ¿Basta Context? | Decisión |
| --- | --- | --- |
| **MAT-06-V11** suspensión | **Sí.** El texto pide el código y «no inscripción». Context más la entrada bloqueada lo satisfacen | Se puede ejecutar ya. La comprobación `http-contract` se recomienda (protección del servidor), pero la fila no la exige |
| **MAT-04-V18** separación | **No.** El Context de V18 es **idéntico** al de V11 (WI no lee `failedCourses`), así que no distingue la rama de cuatro desaprobaciones que exige AC-13 | Se exige además `http-contract`. El Outcome rechazado debe traer `ACADEMIC_INELIGIBILITY` con `courseIds` que incluya el curso de cuatro desaprobaciones. Control negativo: el mismo actor sin esa entrada (equivale a V11) no produce la causa ligada al curso. Se puede ejecutar ya: está documentado en DM:71/91-93 y RU:269-277 y no es comportamiento nuevo |
| **MAT-06-V09** deuda y **MAT-06-V10** salud | **Parcial.** El código, «sin pagos» y «sin información médica» se cumplen en Context. El **«reset»** (la transición L-06 tras un Outcome rechazado) no se puede alcanzar en la UI documentada: la entrada nunca se inicia | Ejecutar ya Context más `http-contract`. El reset queda **`blocked-interpretation`** hasta la Q1. Ninguna de las 4 instancias puede ser PASS antes de esa respuesta |

**Q1 (necesita interpretación humana).** En MAT-06-V09 y V10, ¿«reset» exige la transición L-06 en la UI tras un
Outcome rechazado, o se cumple con «ninguna inscripción y elección vacía» cuando Context bloquea la entrada?

| Opción | Impacto |
| --- | --- |
| **A (recomendada).** «reset» se cumple con el estado final: Context `ineligible`, elección vacía (FE:138), entrada bloqueada y cero escrituras. Más `http-contract` con Outcome rechazado y cero escrituras. El reset L-06 en UI se registra como «no aplicable: no hubo entrada» | Las 4 instancias se pueden ejecutar ya. La UI no recibe un Outcome de deuda o salud, y la evidencia debe decirlo así. El catálogo no cambia, pero la lectura queda registrada como decisión del usuario |
| B. Exigir la transición L-06 en UI | Las 4 instancias siguen bloqueadas: ningún camino documentado lleva ese Outcome a la UI. Desbloquearlas exige una revisión aprobada del catálogo (por ejemplo, reescribir la fila como MAT-01-V02, «sin inicio/write») o un cambio de contrato o cliente que permita la entrada con causas contextuales. Lo segundo choca con CON:127-131 |
| C. Autorizar mutar el actor a mitad del run | **No se recomienda.** Viola DM:12 y no prueba el requisito |

---

## Brecha 2: MAT-04-V04, equivalencia conocida (2 instancias)

| Afirmación | Fuente | Decisión o gap |
| --- | --- | --- |
| Esperado: «Respeta equivalencia **del perfil** sin inventar tabla real» | CAT:79 | Hace falta una equivalencia sintética declarada en el perfil o fixture |
| El prerrequisito debe constar **en aprobados o en equivalencia sintética conocida**: son dos vías distintas | DM:85-86. Contrato: «prerrequisitos aprobados/equivalencias conocidas» en CON:191 | El modelo trata la equivalencia como una vía separada de la aprobación directa |
| Campos internos: `equivalencesKnown: boolean` (solo indica si se conoce) y `approvedCourseIds` | DM:68-69, `profile.types.ts:102-104` | **No hay ningún campo de correspondencia** (curso X satisface el prerrequisito Y) |
| El evaluador solo comprueba `prerequisiteIds ⊆ approvedCourseIds` | RU:233-241 | La lógica de equivalencias no existe. `equivalencesKnown=false` solo produce un gap (RU:227-232) |
| Fixture del harness V04: `prerequisiteIds=[PREREQ]`, `approvedCourseIds=[PREREQ]`, `equivalencesKnown=true` | SC:500-503 | Es **idéntico a V02** (SC:498), porque `equivalencesKnown` ya vale `true` por defecto (`fixtures.ts:56`). Esto **finge** una equivalencia con una aprobación directa |
| Tablas reales de equivalencia: pendientes | Q-29, `docs/domain/fisi/2026-II/open-questions.md:45`. SPEC:605 | No deben inventarse. Una equivalencia sintética debe llevar `origin: local-decision` |

**Decisión.** Con MR-MODEL-2 **no existe un fixture compatible** que pruebe V04. No hay ninguna representación
local aprobada en la que «aprobado» signifique «convalidado por equivalencia», y DM:85-86 separa expresamente las
dos vías. Las 2 instancias quedan **`blocked-gap`**. Ejecutar el escenario actual y contarlo como V04 sería una
promoción indebida.

**Q2 (necesita aprobación funcional y arquitectónica).**

| Opción | Impacto y comprobación |
| --- | --- |
| **A (recomendada).** Revisar el modelo a MR-MODEL-3: añadir al actor un campo interno `equivalences: {courseId, satisfiesCourseId, sourceIds}[]` (sin cambio de wire, porque CON:191 ya lo admite) y hacer que RU acepte `approved ∪ equivalentes de aprobados` | Necesita el planner, la revisión de DM/plan/tareas y un cambio en el backend con sus tests. Fixture: C1 con `prerequisiteIds=[SYN-PREREQ-A]`, `approvedCourseIds=[SYN-EQ-A]` y la equivalencia `SYN-EQ-A→SYN-PREREQ-A` con fuente `local-decision`. Esperado: `accepted` sin `PREREQUISITE_UNMET`. Control negativo: sin la equivalencia, `rejected PREREQUISITE_UNMET [C1, SYN-PREREQ-A]` |
| B. Registrar como decisión local que la equivalencia llega ya resuelta dentro de `approvedCourseIds` | No exige código, pero V04 queda igual que V02 y **no mide** el respeto a la equivalencia. Contradice DM:85-86. Si se adopta, la evidencia debe decir «equivalencia pre-resuelta; el evaluador de equivalencias no se probó». No se recomienda contarla como V04 |
| C. Dejar las 2 instancias bloqueadas | SC-002 «known» queda como máximo en 48/50. No se mueven al conjunto pending sin revisar el catálogo |

---

## Brecha 3: MAT-07-V11, recarga y renovación de 15 minutos (2 instancias)

| Afirmación | Fuente | Estado de implementación |
| --- | --- | --- |
| CAT: «Recarga vigente renew explícito · Renovación15min propia; consultas ordinarias no renuevan» | CAT:145 | — |
| MR-RENEW devuelve el mismo Session con `expiresAt=now+15min`, solo si la sesión está vigente | CON:80 | Implementado: SS:52-92 (mismo `sessionId` y `startedAt`, `SESSION_EXPIRED` si `now>=expiresAt`) |
| «Solo la renovación explícita **al recargar una página activa** renueva otros 15 minutos. Ninguna actividad ordinaria renueva» | CON:215-216. También DM:16, plan:32 («reload renueva vigente expresamente») y research:113 | **El disparador «recarga» no está implementado** |
| Consultar no renueva la sesión | CON:155 | Implementado: MR-RESULT y MR-REPORT no tocan sesiones |
| Origen: testimonio «renovación al recargar la página». Inicio y renovación son decisión local | SPEC:69-71, CON:219, FR-025 en SPEC:526 | — |
| El cliente guarda la sesión **solo en memoria** (estado de React y ref) | FE:102, FE:115, FE:122-123 | Al recargar el navegador se pierde `sessionId` |
| sessionStorage guarda **solo** identidad, revisión y elección. Se prohibió guardar `sessionId` | CON:170-171, `opus-decisions-us4-us6.md:88` | Por contrato, una página recargada no puede llamar a MR-RENEW |
| Hay un botón real «Renovar sesión local» que llama a MR-RENEW. Texto visible: «La lectura del contexto no renueva la sesión. La renovación requiere una acción explícita.» | FE:245-271, FE:545-550 | Implementado. Es una acción explícita en una página activa, **no una recarga** |
| «Actualizar contexto» solo vuelve a leer Context, sin renovar | FE:274-276, FE:438-441 | Implementado: es una consulta ordinaria |
| El harness llama «recarga» a `ui.refresh` y luego usa el botón `ui.renew` | SC:846-863. Informe Sonnet, brecha 3 | **No se debe** llamar «recarga» a ninguno de los dos. `ui.refresh` es una consulta ordinaria y `ui.renew` es la renovación explícita con botón |

**Decisión.** Lo documentado y comprobable ya es: (a) MR-RENEW (mismo `sessionId`, `expiresAt=now+15min`,
`startedAt` intacto); (b) las consultas ordinarias (MR-CTX, MR-RESULT, MR-REPORT y «Actualizar contexto») no
cambian `expiresAt`; (c) el botón explícito de la UI renueva y muestra el nuevo vencimiento. Lo que **falta** es el
disparador «al recargar una página activa». Una recarga real del navegador destruye la sesión en memoria, no envía
MR-RENEW y obliga a «Iniciar sesión local», que crea una sesión **nueva** (una nueva entrada, no una renovación).
Esa recarga real debe ejecutarse como **observación del gap**, no como PASS.

**Q3 (necesita aprobación funcional o arquitectónica).**

| Opción | Impacto |
| --- | --- |
| **A (recomendada si se acepta la divergencia).** Ratificar como decisión local que, en la réplica, «recarga explícita» es la acción «Renovar sesión local» en una página activa. Registrar que la recarga del navegador no renueva porque la sesión vive en memoria | Las 2 instancias se pueden ejecutar ya con (a)–(c) más la recarga del navegador como observación. La evidencia debe declarar la diferencia de disparador frente al testimonio. No cambia código ni contrato. La ratificación tiene que hacerla el usuario, no este informe |
| B. Implementar la renovación al recargar | Hay que persistir `sessionId`, lo que contradice CON:170-171 y la decisión de `opus-decisions-us4-us6.md:88`. Exige MR-CONTRACT-3, un cambio en el cliente y tests. Check: tras `page.reload()` con la sesión vigente se envía exactamente un MR-RENEW, con el mismo `sessionId` y `expiresAt=now+15min`, y ninguna lectura lo dispara |
| C. Dejar las 2 instancias bloqueadas hasta decidir A o B | MAT-07-V11 ×2 no cuenta |

---

## Grupo 4: medidas mínimas de aceptación por caso

Convenciones de efectos: `S`/`R`/`E`/`P` son el número de sesiones, requests, enrollments y reports. `occ` es la
ocupación. Todo se compara con un snapshot del repositorio en el mismo run. En cada instancia, el resto del fixture
sigue siendo conocido y válido (CAT:13-14): seed C1–C3 de 12 créditos, ventana vigente y revisión del actor intacta.

| Caso (×SIS/SOFT) | HTTP | UI | Estado y efectos | ¿Se puede ejecutar ya? |
| --- | --- | --- | --- | --- |
| MAT-06-V11 | MR-CTX 200: `eligibility={state:'ineligible', causes ⊇ ACADEMIC_INELIGIBILITY, gaps:[]}` y ningún otro código | Etiqueta «No habilitado (ineligible)» con la causa visible. «Iniciar sesión local», «Enviar» y la selección deshabilitados. Elección vacía | `S=R=E=P=0` y `occ` sin cambio | **Sí** |
| MAT-04-V18 | Lo mismo en MR-CTX, **más** `http-contract`: MR-SESSION 200 y MR-SUBMIT C1–C3 dan `rejected`, `gaps:[]`, `enrollmentId:null`, `reportPath:null`, causas = {ACADEMIC_INELIGIBILITY…} con una causa cuyo `courseIds` incluye el curso de 4 desaprobaciones. Control negativo sin esa entrada | Igual que V11 (solo en la fase Context) | Fase Context con `S=R=E=P=0`. Tras `http-contract`: `R=1` (solo Outcome), `E=P=0`, `occ` sin cambio y ningún artefacto de «resolución» | **Sí** (con la decisión de este documento) |
| MAT-06-V09 / V10 | MR-CTX con `DEBT_` o `HEALTH_REQUIREMENT_UNMET`, más `http-contract` con `rejected` y esa causa | Igual que V11. La transición L-06 en UI depende de la **Q1** | Como en V18. Cero datos monetarios o médicos en el wire y en la UI | Context y HTTP **sí**. El reset espera la **Q1** |
| MAT-04-V04 | No hay fixture compatible | — | — | **No.** Depende de la **Q2** |
| MAT-07-V11 | MR-SESSION, luego +10 min, luego MR-CTX, MR-RESULT y MR-REPORT sin cambio en `expiresAt`. MR-RENEW con el mismo `sessionId`, `startedAt` intacto y `expiresAt=now+15min` | El botón «Renovar sesión local» envía exactamente un MR-RENEW y muestra el nuevo vencimiento. «Actualizar contexto» no envía MR-RENEW. Recarga del navegador: cero MR-RENEW y sesión ausente en la UI (observación del gap) | `S=1` tras la renovación. Sin requests ni enrollments | (a)–(c) **sí**. La conformidad de «recarga» espera la **Q3** |

**Necesita aprobación humana:** Q1 (interpretación funcional, 4 instancias), Q2 (funcional y del modelo,
2 instancias), Q3 (funcional y de contrato, 2 instancias). **No necesita aprobación:** V11 ×2 y V18 ×2 con las
medidas de arriba, más la parte Context/HTTP de V09 y V10. Una fila con un componente pendiente se reporta
`blocked`, nunca PASS parcial. Este documento no cambia el contrato, el catálogo ni el código. N3, ACC170 y la
paridad con el SUM siguen fuera de alcance.
