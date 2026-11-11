# Programación académica: motor con perfil normativo y decisiones mínimas

Fecha: 2026-11-10. Producto interno (no réplica SUM); la UI sigue `docs/design-direction.md`.
Decisión registrada en `docs/adr/0003-regulated-load-exceptions-and-lexicographic-prelation.md`.

## Objetivo

Agilizar el trabajo manual de la comisión: el motor programa todo lo factible dentro de la
norma y convierte cada pendiente en una decisión concreta y mínima, distinguiendo una falta
de recursos comprobada de una búsqueda inconclusa.

## Fuentes

| ID | Fuente | Uso | Estado |
| --- | --- | --- | --- |
| OF-02 | R.R. 001380-2026-R/UNMSM (06-02-2026), Reglamento General para la Actividad Académica Docente; arts. 1, 5, 7, 8, 9; disposiciones complementarias 1.ª, 2.ª, 5.ª; disposición final 3.ª | Topes de carga, hora lectiva, excepciones | `normative`, texto leído el 2026-11-10 |
| RR-5348 | R.R. 005348-2026-R/UNMSM (17-04-2026), modifica el art. 9 | Orden de categoría y régimen | `normative`, PDF aportado por el operador el 2026-11-10 |
| — | Turnos de ciclos 7–10, cursos de tesis, 180/90 alumnos, 45 por sección | Parámetros configurables | `testimony`, sin norma localizada |
| — | Duración de la hora lectiva en FISI (45, 50 o 60 min, art. 8) | Parámetro obligatorio del perfil | `unverified` |

Lecturas propias pendientes de confirmar por el usuario (`inferred`): la procedencia
(nombrado de la facultad → interfacultativo → contrato) ordena por encima de categoría y
régimen; «prelación» se modela como quién recibe carga primero.

## Módulos

1. **Perfil normativo** (`shared/academic-normative-profile.mjs`). Interfaz: resolver el
   perfil vigente, límites de carga de un docente, prelación de un docente y bloqueos de
   autorización. Único lugar que conoce el reglamento.
2. **Motor** (`planning-engine/`). No conoce el reglamento: recibe topes y niveles ya
   resueltos. Añade certificado de capacidad, decisiones mínimas, prelación lexicográfica y
   prueba de cobertura.
3. **Backend** (`backend/src/programacion-academica/`). Une ambos, expone el resultado en
   la Propuesta y bloquea la publicación cuando falta una autorización obligatoria.
4. **Interfaz** (`client/`). Cola de decisiones y registro de evidencias.

## Contrato del motor (revisión `PA-ENGINE-2`, campos opcionales)

Entrada, por docente:

- `maxWeeklyMinutes`: tope autorizado hoy; restricción dura (sin cambio de nombre).
- `exceptionMaxWeeklyMinutes`, `exceptionKind` (`voluntary-declaration` | `vrap-authorization`):
  tope alcanzable con una excepción reglada aún no registrada. El horario nunca lo usa.
- `appointmentTier` (0 nombrado de la facultad, 1 interfacultativo, 2 contrato) y
  `categoryRank` (1–9, art. 9 vigente).

Salida:

- `coverageProof`: `complete` | `shortfall-proven` | `inconclusive`.
- `capacityCertificate`: secciones cubribles por curso con los topes autorizados, resuelto
  sin horarios; indica si quedó probado.
- `decisions`: conjunto mínimo de excepciones de carga o docentes adicionales, calculado
  sobre la relajación de capacidad (condición necesaria, no suficiente).
- `prelation.levels`: valor y prueba de cada nivel (`contract-sections`,
  `interfaculty-sections`, `category-rank`).

Orden lexicográfico del horario: cobertura → mínimo de secciones por contrato → mínimo por
interfacultativos → puesto de categoría y régimen → preferencias. Se fija el valor óptimo
de cada nivel, no las asignaciones.

## Tickets

| # | Ticket | Depende de | Agente | Estado |
| --- | --- | --- | --- | --- |
| T1 | Perfil normativo, campos reglamentarios del docente en el contrato y registro en el dossier | — | Claude Sonnet 5.5 | verificado 2026-11-10 en la rama `t3/academic-normative-profile` (`9267ac0`), sin integrar |
| T2 | Motor: certificado de capacidad, tramos de carga, decisiones mínimas, prelación lexicográfica, prueba de cobertura | — | Codex GPT-6.1 Sol | verificado 2026-11-10 (`333a50f`); integrado con T1 en la rama `feat/planning-normative-engine` (`79b3da3`) |
| T3 | Backend: perfil → entrada del motor, resultado en la Propuesta, datos sintéticos con régimen y procedencia, retiro del tope de demo de 10 h, bloqueo de publicación, unificación con los perfiles sintéticos del chat normativo | T1, T2 | Codex GPT-6.1 Sol | verificado e integrado 2026-11-11 (rama `feat/planning-normative-engine`) |
| T4a | Motor: búsqueda en segundo plano como trabajo en memoria (`PA-ENGINE-JOBS-1`: iniciar, consultar, cancelar; progreso real) | T2 | Claude Sonnet 5.5 (Codex sin cuota) | verificado e integrado 2026-11-11 (`7a4e183`) |
| T4b | Backend e interfaz consumen los trabajos del motor: primer horario rápido, progreso y cancelación | T4a, T5 | Codex GPT-6.1 Sol | implementado y reparado tras auditoría; correlación, incertidumbre y retención verificadas sintéticamente, sin aceptación DOM/visual |
| T5 | Interfaz: estado de cobertura, cola de decisiones, vacíos normativos, datos reglamentarios del docente con registro de autorizaciones, bloqueos en la publicación | T3 | Claude Sonnet 5.5 (Codex sin cuota) | verificado e integrado 2026-11-11 |
| T6a | Motor: decisiones de franja y de modalidad para las secciones sin franja (`planning-window`, `delivery-mode-split`, base `window-precheck`) | T2 | Codex GPT-6.1 Sol | verificado e integrado 2026-11-10 (`1ca4df2`) |
| T6b | El consejero consume las decisiones del motor en lugar de proponer y simular; recursos de referencia | T3, T6a | Codex GPT-6.1 Sol | implementado y auditado; dos P2 corregidos por el principal; aceptación DOM 6/6 |
| T8 | Motor: generar candidatos sin recorte (o con recorte demostrablemente inocuo) para que la prelación y la cobertura puedan quedar probadas | T4a | Codex GPT-6.1 Sol | implementado y revisado sin defectos materiales; aceptación limitada a los casos sintéticos documentados |
| T7 | Auditoría del resultado integrado | T3–T6 | Codex GPT-6.1 Sol | auditado 2026-11-11: P1 y P2 reparados y verificados por el principal; sin re-auditoría independiente de la reparación |

T1 y T2 no comparten archivos: el contrato del motor está fijado arriba. T3 y T6a tampoco:
T3 trabaja en `shared/`, `backend/` y `client/src/data/`; T6a solo en `planning-engine/`.
Desde el 2026-11-10 el usuario pide delegar solo a agentes de Codex.

### Resultado de T1 y arrastre para T3

Verificación del orquestador: 18 pruebas del perfil y del contrato pasan, más las de
persistencia y consejero (26 en total). No se ejecutaron el chequeo de tipos de los `.d.mts`
ni `programacion-academica-advisor-backend.test.mjs` (requiere `backend/dist`).
Corrección del orquestador (`9267ac0`): un docente con licencia y carga asignada se informa
como no disponible (`reason: 'on-leave'`), no como falta de autorización del VRAP.

T3 debe resolver:

- `backend/src/programacion-academica/schedule-validator.ts` rechaza los campos nuevos del
  docente; `client/src/data/academicResources.ts` los descarta al copiar.
- `shared/prototype-teacher-profiles.mjs` (sin confirmar en la rama principal) usa `regime`
  para ordinario/contratado y `dedication` para TC/DE/TP; el contrato usa `appointment` y
  `regime`. Hay que unificarlos, no mantener dos formas.
- `loadAuthorizationBlockers` no lista docentes sin tope regulado (contrato, tiempo parcial,
  régimen sin registrar); T3 decide si esos vacíos bloquean la publicación.
- Lecturas añadidas por el agente, marcadas `inferred`: una autorización del VRAP puede
  superar el tope de 10 h de posgrado; la licencia fija también el mínimo en 0; el 40 % de
  tiempo parcial se mide sobre las horas semanales de servicio.

### Resultado de T2

Verificación del orquestador tras integrar: 36 pruebas del motor y del consejero y las 5 de
escala pasan.

Reparación del orquestador (`333a50f`): con el modelo por sección, el cálculo de decisiones
mínimas no quedaba probado ni en 60 s sobre el catálogo sintético de 166 secciones, y el
motor devolvía `CAPACITY_ANALYSIS_LIMIT` sin decisiones. El modelo ahora cuenta secciones
por curso, minutos y docente; el análisis completo queda probado en 0,16–0,25 s. El tope de
tiempo del análisis pasó de 250 ms a 20 % del presupuesto con máximo de 1 s. Se adaptó la
prueba de plazo inyectado de `test_solver_scale.py` para que falle solo si una búsqueda
empieza después del plazo, porque el análisis de capacidad resuelve antes.

Medición sobre el catálogo sintético de demostración (56 cursos, 166 secciones, 91 docentes,
política sin tarde ni sábado; no son datos reales):

| Tope autorizado por docente | Secciones cubribles por capacidad | Decisiones mínimas para el resto | Secciones programadas |
| --- | --- | --- | --- |
| 600 min (demo actual), sin excepción | 124 | 20 cursos requieren docente adicional | 110 en 2,5 s, faltante probado |
| 600 min, excepción hasta 1000 | 124 | 23 excepciones (5520 min) liberan 30; 8 cursos requieren docente adicional (12 secciones) | 110 en 2,5 s, faltante probado |
| 720 min (12 h de 60 min), excepción hasta 1200 | 141 | 15 excepciones (5520 min) liberan 21; 4 cursos requieren docente adicional (4 secciones) | 124 en 2,5 s, inconcluso; 125 en 20 s, faltante probado |

Además, 18 secciones quedan excluidas por no tener franja para su bloque
(`NO_SCHEDULING_WINDOW`) con la política sin tarde ni sábado: esa parte del faltante es de
horario, no de docentes, y la cubrirá T6. Con 2,5 s los niveles de prelación no quedan
probados; lo resuelve el presupuesto de T4.

### Resultado de T6a

Verificación del orquestador tras integrar: 50 pruebas del motor y del consejero y las 5 de
escala pasan. El agente añadió el diagnóstico `WINDOW_ANALYSIS_LIMIT` para cuando el plazo
no alcanza a completar el análisis.

Medición del orquestador sobre el catálogo sintético (tope de 720 min, 2,5 s de búsqueda):

| Política | Secciones sin franja | Programadas | Prueba |
| --- | --- | --- | --- |
| Sin tarde ni sábado | 18 | 124 de 166 | inconclusa |
| Con tarde | 0 | 140 de 166 | inconclusa |
| Cursos partidos | 0 | 122 de 166 | inconclusa |
| Con tarde y cursos partidos | 0 | 141 de 166 | faltante probado: se alcanza el máximo de capacidad docente |

Habilitar la tarde o partir los cursos da franja a las 18 secciones; el sábado, a ninguna.
Las 25 secciones restantes son de capacidad docente: 15 excepciones de carga liberan 21 y
4 cursos requieren docente adicional.

### Resultado de T3 e integración real

Verificación del orquestador: 28 pruebas compartidas y 53 del backend pasan tras integrar.

Defecto hallado al probar con el motor real y corregido por el orquestador: el validador de
la Propuesta exigía que el certificado de capacidad listara todos los cursos, pero el motor
lista solo los que tienen faltante; toda generación real respondía 500. Las pruebas del
agente usaban una respuesta simulada del motor y no lo detectaban. Se añadió una prueba con
la forma real.

Escenario de punta a punta (capa de datos del cliente → API NestJS → motor Python, catálogo
sintético de 56 cursos y 166 secciones, 61 docentes ordinarios con 12 h y 30 contratados
con 10 h de demo, hora lectiva de 60 min, 2,5 s de búsqueda), ejecutado el 2026-11-11:

| Política | Programadas | Cubribles por capacidad | Prueba |
| --- | --- | --- | --- |
| Sin tarde ni sábado | 120 de 166 | 136 | inconclusa; el motor informa que la tarde o partir cursos da franja a 18 secciones |
| Con tarde y cursos partidos | 136 de 166 | 136 | faltante probado |

En ambos casos: 12 excepciones de carga liberan 16 secciones, cada una con sus requisitos y
su fuente (`OF-02`); 8 cursos requieren docente adicional (14 secciones); ningún docente
supera su tope; 0 bloqueos de publicación. Los niveles de prelación se calculan pero no
quedan probados en 2,5 s. No se probó el flujo en navegador ni el bloqueo de publicación
contra el servidor real (cubierto por 5 pruebas del backend).

### Resultado de T4a

Verificación del orquestador tras integrar: 59 pruebas del motor y las 5 de escala pasan; no
quedan procesos de búsqueda vivos tras las pruebas.

Cada trabajo corre en un proceso hijo; cancelar lo termina de inmediato y devuelve el mejor
horario válido recibido. Los trabajos viven en memoria (15 minutos, máximo 20) y se pierden
al reiniciar el motor. El número de hilos de búsqueda ahora se limita a los núcleos
disponibles, también en la ruta síncrona (2 en este servidor en lugar de 4).

Medición del agente sobre el catálogo sintético con prelación inventada, 30 s y 2 núcleos:
primer horario a 0,96 s (108 secciones), 109 a los 2,5 s, 110 al final con faltante probado.

Hallazgo: más tiempo no prueba la prelación. Las tres etapas terminan óptimas, pero la marca
queda en falso porque el motor recorta los candidatos de horario por docente y sección, no
por el plazo. Probarla requiere T8.

### Resultado de T5

Verificación del orquestador tras integrar: 329 pruebas de datos del cliente, lint y build
pasan. Revisé dos capturas (cola de decisiones en oscuro, editor de carga docente en claro).
Corrección del orquestador: la sigla VRAP salía en minúsculas en dos textos.

Escenario real del agente en navegador (React → NestJS → motor, 56 cursos sintéticos):
propuesta inicial «Búsqueda inconclusa», 120 de 166 completas, «Carga autorizada cubre 136
de 166», «20 decisiones cubren 30 secciones»; tras habilitar la tarde desde la cola,
«Faltante comprobado» con 136 de 166; tras registrar una declaración jurada en un docente
e igualar su carga semanal, 138 de 166.

Pendiente o no probado:

- El bloqueo de publicación no se ejerció contra el servidor real (el motor nunca asigna
  por encima de lo autorizado); lo cubren pruebas con respuestas simuladas.
- Registrar la autorización no basta: el tope efectivo es el menor entre la carga semanal
  declarada y el máximo autorizado, así que hay que pulsar «Igualar la carga semanal al
  máximo autorizado». Conviene que la decisión lleve el tope objetivo.
- No hay validador compartido para los bloqueos; el cliente repite la comprobación de forma.
- La tarjeta de resultado tras una acción de la cola conserva el texto del consejero
  («Resultado de aplicar 1 recomendación»); corresponde a T6b.
- Las pruebas de componentes viven en el script de verificación, no en `test:data`.
- Las capturas muestran nombres del catálogo sintético de referencia sin enmascarar, igual
  que la evidencia anterior; confirmar su procedencia antes de compartirlas fuera del repo.
- No se probó con lector de pantalla.

## Criterios de aceptación

- **T1.** Cada límite devuelto cita su artículo. DE/TC: mínimo 10, máximo ordinario 12,
  hasta 20 con declaración jurada registrada, más de 20 solo con autorización VRAP
  registrada. La tabla de categoría y régimen es la de la R.R. 005348. Falta de duración
  de hora lectiva, de perfil o de régimen produce una brecha explícita, nunca un valor por
  defecto. Los borradores guardados sin los campos nuevos siguen validando.
- **T2.** Un faltante de capacidad compartido entre cursos se detecta y queda probado. El
  horario nunca supera `maxWeeklyMinutes`. Un docente por contrato solo recibe secciones
  que nadie de un nivel anterior puede cubrir, aunque tenga mejor preferencia horaria. Una
  elección temprana no deja sin cubrir un curso cubrible. Sin los campos nuevos el
  resultado es el de hoy.
- **T3.** Una propuesta que requiere una autorización no registrada no puede publicarse y
  el motivo se muestra. El escenario sintético de 56 cursos devuelve cobertura completa o
  la lista de decisiones que la completan.

## Verificación

Solo datos sintéticos; `datos-reales/` queda excluido para todos los agentes. Comprobaciones
ligeras y dirigidas (servidor con cómputo limitado): pruebas del archivo afectado y un
build al final, sin suites de Playwright.

## Reparación T7 (2026-11-11, paquete acoplado de seis hallazgos)

Checkout de integración `feat/planning-normative-engine`, base `1f7063d`. Sin commits,
merges ni delegación. Solo mantenimiento local del producto interno; se conservan los
componentes, el guardado explícito, CAS, algoritmos, aprobación y publicación separadas,
y `docs/design-direction.md`. No se cambian alumno SUM, selector de módulos ni tokens.
Fuentes: auditoría T7 aportada por el operador (`testimony`, reproducida con pruebas
sintéticas locales `observed`), ADR 0003 y perfil normativo vigente (fuentes normativas
ya registradas arriba). Ninguna prueba local verifica comportamiento de SUM.

### Extensiones compatibles y alcance

- `PA-ENGINE-2` conserva sus campos opcionales. `configurationMaxWeeklyMinutes` es un
  nuevo techo opcional para el ajuste explícito de configuración dentro de la autorización
  vigente; debe superar el tope actual y no superar el techo alcanzable. El par
  `exceptionMaxWeeklyMinutes`/`exceptionKind` sigue siendo opcional, pero ambos deben
  existir juntos y el techo debe superar el actual. `configuration-adjustment` amplía el
  tipo de decisión, **no** el tipo de autorización documental. Los consumidores anteriores
  deben actualizar su enum antes de recibir esta variante; las solicitudes antiguas sin
  los nuevos campos siguen funcionando. El motor distingue el ajuste y el trámite formal
  según la carga realmente necesaria, sin elevar silenciosamente el tope del horario.
  La declaración y VRAP registradas siguen resolviéndose únicamente en el perfil compartido.
- `normative.gaps` añade opcionalmente `blocking`, `assignedMinutes`, `minimumMinutes`
  y `shortfallMinutes`. No se sustituye `normative.blockers` (autorización/licencia).
  Publicación recalcula ambos sobre el horario congelado. Los vacíos obligatorios producen
  HTTP 409 `NORMATIVE_VALIDATION_REQUIRED` con `gaps` y explicación; los de autorización
  conservan `LOAD_AUTHORIZATION_REQUIRED`. El cliente admite el envelope ampliado.
- Se bloquean perfil/periodo, duración, nombramiento/régimen faltantes y mínimos sin
  resolver, incluyendo servicio TP faltante y RENACYT TP no resuelto. No se bloquean por
  sí solos rango inferido, procedencia documental incompleta ni máximo TP/contrato no
  regulado. Contratados permanecen fuera del mínimo de ordinarios.
- **Decisión local-only:** para cada ordinario incluido en los recursos cuyo mínimo está
  resuelto, asignación menor al mínimo produce `MINIMUM_LOAD_SCOPE_UNRESOLVED`, con
  faltante por docente. No se presume carga externa cero ni cumplimiento externo, ni se
  crea un contrato de carga externa. La programación parcial sigue editable/provisional.
  El solver **no impone mínimos**; cobertura completa no acredita cumplimiento total.
  Publicación exige que el mínimo pueda acreditarse en este alcance; de lo contrario
  permanece bloqueada. Todos los números provienen del perfil por facultad/periodo.
- Las pruebas de ciclo de publicación usan docentes de contrato sintéticos explícitos
  para aislar CAS/persistencia; los mínimos ordinarios se prueban aparte, incluyendo
  publicación justo en el mínimo derivado del perfil. No hay migración automática de
  borradores: un borrador antiguo puede seguir editándose/aprobándose, pero no publicarse
  si sus datos obligatorios o su cumplimiento quedan sin acreditar.
- Al ajustar manualmente se retiran certificado/decisiones/prelación automáticos y se
  actualiza la prueba de cobertura. El formulario reinicia su borrador por docente y
  periodo mediante identidad React; conserva escritura al renderizar el mismo docente.
  `PA-ENGINE-JOBS-1` no cambia. T4b/T6b/T8 siguen pendientes.

### Regresiones y aceptación

| Criterio | Comprobación sintética | Esperado | Resultado |
| --- | --- | --- | --- |
| T7-1 | `programacion-academica-normative-publication.spec.ts`: falta duración, nombramiento o régimen; camino real guardar→revisar→aprobar→publicar | Rechazo 409 con gap obligatorio; autorización sigue diferenciada | Verde; la regresión inicial publicaba docentes sin régimen/nombramiento |
| T7-2 | `programacion-academica-normative.spec.ts` y publicación: TC/DE, TP 40 %, RENACYT, licencia, contrato, frontera exacta y faltante de un minuto | Mínimos derivados del perfil, faltante explícito, no falsa aprobación ni bloqueo de generación parcial | Verde |
| T7-3 | `test_capacity_prelation.py` y adaptador normativo: demanda 2×60, configurado 60, autorizado 720; demanda 13×60; declaración y VRAP existentes | Ajuste de 60 sin trámite para 2 secciones; excepción formal para 13; horario conserva su tope | Verde; antes rechazaba el tipo de ajuste y atribuía declaración al primer caso |
| T7-4 | `programacion-academica-api.test.mjs`: prueba completa con pendientes, prueba parcial sin pendientes, estado contradictorio; formas completa/faltante/inconclusa/legacy | Rechazar contradicciones, aceptar resultados honestos y legacy sin prueba | Verde; antes aceptaba `complete` con pendientes |
| T7-5 | `test_capacity_prelation.py`: ambas mitades del par, techo igual al actual, pares válidos y ajuste fuera del techo | Rechazo de entradas inconsistentes, decisiones sin tipo nulo inválido | Verde; antes no rechazaba medio par |
| T7-6 | `node client/scripts/test-planning-teacher-draft.mjs` | A→B no envía autorización de A, servicio B correcto, misma identidad conserva escritura, cambio de periodo limpia | Verde; mismo arnés con componente original falla con `SYN-A-DRAFT` en B |

El arnés UI ejecuta el componente real y sus handlers con stores de hooks aislados por la
clave React emitida. No usa DOM ni navegador: no acredita foco, zoom, accesibilidad visual
ni reconciliación DOM completa. No se tomaron capturas ni se inspeccionaron servidores
existentes. Dependencias: enlaces locales ignorados `backend/node_modules` y
`client/node_modules` a instalaciones existentes del checkout principal, solo para resolver
paquetes; sin instalaciones ni cambios de lockfile. El primer comando pnpm intentó su
verificación automática y avisó que no podía instalar en un enlace; los checks posteriores
usan los ejecutables existentes directamente (equivalentes a los scripts de package.json).

### Comandos ejecutados y resultados finales

Desde este checkout, con workdir explícito en cada comando:

- Raíz: `node --test shared/academic-normative-profile.test.mjs shared/programacion-academica-api.test.mjs shared/programacion-academica-publication.test.mjs`: **24/24**.
- Raíz: `planning-engine/.venv/bin/python -m pytest planning-engine/test_capacity_prelation.py planning-engine/test_window_decisions.py planning-engine/test_solver_scale.py -q`: **39/39**, aviso preexistente de deprecación de langchain-community.
- Backend: `SUM_PLANNING_ENGINE_URL=off ./node_modules/.bin/vitest run test/programacion-academica-normative.spec.ts test/programacion-academica-normative-publication.spec.ts test/programacion-academica-publication.spec.ts test/programacion-academica-persistence.spec.ts test/programacion-academica-block-api.spec.ts test/programacion-academica-schedule.spec.ts`: **115/115**. Incluye HTTP real cliente (capa de datos)→NestJS con puerto efímero y directorio temporal propio, publicación válida, rechazo por mínimo no acreditado y rechazo de versión obsoleta. No se ejecutó React DOM→HTTP→Python; el motor se verificó por separado y esta ronda deshabilita su URL expresamente.
- Cliente: `./node_modules/.bin/tsc -p tsconfig.data-tests.json && node --experimental-strip-types --test --test-isolation=none src/data/*.test.ts` (script `test:data`): **330/330**.
- Raíz: `node client/scripts/test-planning-teacher-draft.mjs`: **verde**. Copia temporal del componente original obtenida con `git show HEAD:client/src/screens/PlanningTeacherLoad.tsx`, cargada por el mismo arnés: **rojo**, A→B conserva indebidamente `SYN-A-DRAFT`; copia eliminada.
- Backend: `./node_modules/.bin/nest build`: **verde**; repetido tras la corrección final del alcance docente.
- Cliente: `./node_modules/.bin/tsc -b && ./node_modules/.bin/vite build`: **verde**, un build final; aviso de tamaño de bundle y tiempos de plugins, sin errores.
- Backend: `./node_modules/.bin/oxlint --type-aware src/ test/`: **verde**, cuatro avisos `unbound-method` preexistentes en `local-profile-session.spec.ts`.
- Cliente: `./node_modules/.bin/eslint .`: **verde**.
- Raíz: `git diff --check`: **verde**. Rama y HEAD permanecen `feat/planning-normative-engine` / `1f7063d`.

Fallos intermedios resueltos: regresiones rojas del validador y medio par de excepción;
fixtures antiguas publicaban sin contexto y requirieron duración/periodo explícitos;
validador interno no admitía inicialmente el campo de ajuste; el primer intento de pytest
nombró un inexistente `test_solver.py` (no ejecutó pruebas; comando corregido arriba).
El chequeo adicional `tsc --noEmit` del backend antes del build incluía pruebas ajenas que
importaban `dist` aún inexistente y un error de tipo en la nueva prueba (corregido). Tras
el build también detectó una importación estática de la capa cliente fuera del root TS del
backend: el escenario de aceptación carga ahora esa capa dinámicamente en runtime; los
fuentes de ambos proyectos se comprueban en sus propios builds. No se amplió ninguna
configuración TS ni dependencia para ello.

Ajuste final de alcance: cuando la solicitud enumera demandas, los mínimos y vacíos
obligatorios por docente solo bloquean para docentes cuyos cursos intersectan esa demanda;
los recursos de cursos ajenos no se consideran implícitamente sujetos a un mínimo de este
horario. Sin demanda declarada, el evaluador considera explícita la lista de docentes
recibida. Regresión adicional `T7 partial demand does not enforce another course teacher
minimum`. Para los docentes vinculados, un alcance parcial sigue sin acreditar carga externa:
no se presume exención. El chequeo adicional final `backend/node_modules/.bin/tsc --noEmit`
(únicamente tras disponer de dist y aislar la importación runtime de aceptación) también pasa.

### Revisión final y correcciones del principal (2026-11-11)

La revisión independiente de T7 detectó tres defectos. El principal los reprodujo
con regresiones rojas y corrigió directamente en este checkout, sin otra delegación.

| Criterio | Regresión sintética | Antes | Después |
| --- | --- | --- | --- |
| Contrato sin régimen | `T7 recheck keeps contract ordering gaps nonblocking without a regime` y fila de publicación de contrato sin régimen | Gap de prelación `REGIME_MISSING` convertido en bloqueo de carga | Gap visible, sin exigir régimen para límites de ordinarios fuera de alcance |
| Ajuste manual sin búsqueda ficticia | `T7 recheck manual placement preserves coverage status without inventing a search budget` | Mover un bloque cambiaba `impossible`/null a `search-limit`/work | Conserva estado, motivo histórico y prueba de cobertura: demanda, recursos y número de sesiones cubiertas no cambian; retira prelación, certificado y decisiones |
| Resultado exhaustivo compatible | `test_exhaustive_room_shortfall_has_a_valid_proof_and_termination` | Dos secciones con una sola franja de aula: inconcluso sin motivo de límite, rechazado por contrato | Faltante probado cuando CP-SAT demuestra óptimo sin recorte ni sustitución por incumbente |

El objetivo legacy usa un peso de cobertura que supera toda ganancia posible de
preferencias (`20 * número de secciones con opciones + 1`), conservando el orden
cobertura→preferencias a cualquier tamaño admitido. Un óptimo del modelo exhaustivo
acredita máxima cobertura; el estado óptimo de un modelo recortado no la acredita.
No se cambian los contratos, las interfaces ni el alcance autorizado.

Comprobaciones ejecutadas por el principal:

- Backend: seis archivos dirigidos de la ronda anterior (normative, normative-publication, publication, persistence, block-api, schedule), con `SUM_PLANNING_ENGINE_URL=off`: 117/117 antes de la fila adicional de contrato sin régimen. Incluye la aceptación HTTP sintética ya descrita.
- Python: `planning-engine/.venv/bin/python -m pytest planning-engine/test_capacity_prelation.py planning-engine/test_window_decisions.py planning-engine/test_solver_scale.py planning-engine/test_solve_jobs.py -q`: 49/49; deprecación preexistente.
- Compartidos: `node --test shared/academic-normative-profile.test.mjs shared/programacion-academica-api.test.mjs shared/programacion-academica-publication.test.mjs`: 24/24.
- Backend: `./node_modules/.bin/nest build` y `./node_modules/.bin/oxlint --type-aware src/ test/`: aprobados; cuatro avisos preexistentes en `local-profile-session.spec.ts`.
- Integración por proceso: `DemoProposalService.createProposalAsync` con fetch inyectado ejecutó Python real por stdin y validó la propuesta compartida. Curso sintético de 120 min, dos secciones, un aula con una franja de 120 min, contrato sin régimen con 240 min de capacidad: faltante probado, límite null y cero gaps bloqueantes. Sin red ni servidores. El primer intento no llegó al motor por usar un hostname no local; corregido a loopback (con transporte igualmente inyectado) pasó.
- Un intento de actualizar documentos/prueba desde el directorio backend falló por ruta relativa duplicada antes de escribir; corregido desde la raíz del checkout.

Las tres regresiones nuevas fallaron antes de las correcciones y pasaron después.
No se amplía la aceptación a DOM, navegador, visuales ni React→NestJS→Python por HTTP.
T4b/T6b/T8 siguen pendientes. Cambios sin commit.

Tras añadir la fila de publicación de contratado sin régimen:
`SUM_PLANNING_ENGINE_URL=off backend/node_modules/.bin/vitest run --root backend test/programacion-academica-normative-publication.spec.ts`: **10/10**.
`git diff --check`: **aprobado**.

## T4b: encargo de integración de trabajos (2026-11-11)

Estado: listo para implementación; depende de T4a y T5 ya integrados y conserva las
reparaciones T7 sin commit. Producto interno exclusivamente: preservar componentes,
navegación, guardado explícito, CAS y `docs/design-direction.md`; solo se autoriza
cambiar `/local/programacion-academica` y sus paneles existentes. Sin cambios al alumno
SUM ni al selector. Reutilizar adaptadores y contratos, no crear un segundo generador.

Contrato local fijado para este ticket (`PA-PLANNING-JOBS-1`):

- `POST /api/local/programacion-academica/v1/busquedas`, body `{ request: AcademicRequest, budgetSeconds: number }`; presupuesto validado entre 1 y 120 s, interfaz inicialmente 30 s (decisión local). No inicia por montaje.
- `GET .../busquedas/:jobId` sin body/query y `POST .../busquedas/:jobId/cancelar` con objeto vacío. Mantener los guards de acceso/origen existentes para lecturas/escrituras. Job desconocido o caducado: 404; errores de motor explícitos, sin cambio silencioso a mocks.
- Respuesta común: `{ jobId, state, phase, elapsedSeconds, budgetSeconds, progress, proposal, error }`. `state`: running/completed/cancelled/failed. Fases y progreso usan los valores reales de `PA-ENGINE-JOBS-1`; `proposal` es `AcademicProposal | null`, `error` es `{ code, message } | null`. Validación runtime en ambas fronteras. Identidad pública del trabajo estable y separada del identificador interno del motor; propuesta estable entre actualizaciones, sin gastar un slot de propuesta por sondeo.
- Extender el snapshot del motor para exponer su mejor resultado también mientras corre. Un resultado incompleto en curso/cancelado debe indicar honestamente esa condición: ampliar `limitReason` con `running`/`cancelled` en los tipos y validadores afectados, sin atribuir tiempo/trabajo agotado. Mantener `coverageProof: inconclusive` salvo testigo completo. El fin normal mantiene pruebas/diagnósticos finales del motor.
- Un trabajo activo por instancia, misma vida en memoria que el motor; no persistencia de trabajos. Empezar otro cancela el anterior. Cancelación idempotente; no crear trabajos huérfanos en errores, desmontaje, cambios de periodo/configuración o respuestas de inicio tardías. Cancelar conserva el mejor horario válido si existe. Sin resultado nuevo, conservar el borrador anterior y mostrar el resultado real de la cancelación.
- Sondeo secuencial acotado, sin solicitudes superpuestas; se detiene en estado terminal, error o disposición de la sesión. Respuestas de una configuración anterior nunca sustituyen la vigente. Mostrar primer horario en Tabla/Semana sin esperar el plazo final, junto con progreso/fase reales y botón Cancelar. Mientras mejora, no permitir editar, guardar, aprobar ni publicar un resultado cambiante; al terminar/cancelar vuelve el flujo explícito habitual. No guardar automáticamente.

Propiedad: un único worker del paquete acoplado puede extender shared API/validadores,
backend módulo de programación/cliente de motor, planning-engine jobs/models, cliente
adaptadores/sesión y paneles de programación existentes, pruebas sintéticas y registro de
este plan. T6b y T8 no pertenecen al encargo. No modificar fuentes ajenas.

Aceptación: iniciar sin bloqueo HTTP; recibir primer horario antes del terminal; progreso
real coherente con propuesta; cancelar con/sin incumbente; terminal completo/faltante/error;
versión/configuración/periodo y desmontaje descartan resultados tardíos y cancelan CPU;
identidad estable y retención acotada; regresión T7 intacta; guardar exige fin del trabajo y
acción expresa. Probar contrato, backend y sesión; escenario real cliente→NestJS→Python
con stack propio enteramente sintético (puertos nuevos y estado temporal propio), más
comprobación UI enfocada si es viable. Builds/lint afectados y tests relevantes, sin suites
visuales antiguas masivas ni datos de procedencia incierta. Registrar criterio→check→resultado.

### T4b implementado (2026-11-11, sin commit)

Fuente y alcance: contrato local fijado `PA-PLANNING-JOBS-1` del encargo anterior
(`local-only`), dependencias PA-ENGINE-2/PA-ENGINE-JOBS-1 y reparaciones T7 presentes.
Observaciones de aceptación exclusivamente sintéticas locales (`observed`); no se
inspeccionó SUM, datos privados ni servicios existentes. Se conserva la dirección y
rediseño vinculantes, tipografía, controles shadcn, Tabla/Semana y aprobación/publicación.
Solo cambia funcionalmente `/local/programacion-academica`. T8/T6b no implementados.

Archivos propios de T4b (las demás modificaciones previas T7 se conservan):

- `shared/programacion-academica-api.{mjs,d.mts,test.mjs}`.
- `backend/src/programacion-academica/{demo-proposal.service.ts,demo.controller.ts,planning-engine.client.ts,generator.types.ts,schedule-generator.ts}` y `backend/test/programacion-academica-jobs.spec.ts`.
- `planning-engine/{jobs.py,models.py,test_solve_jobs.py}`.
- `client/src/data/{academicScheduling.ts,planningSession.ts,planningSession.test.ts,planningDecisions.ts}`;
  `client/src/screens/{AcademicScheduling.tsx,PlanningStatusBar.tsx}`;
  `client/scripts/verify-planning-jobs.mjs` y este plan.

Contrato y decisiones: endpoints iniciar/consultar/cancelar con los guards existentes;
presupuesto inicial 30 s, frontera 1–120 s; identidad pública UUID separada de la del
motor, identidad de propuesta estable y un solo slot por trabajo con incumbente.
Retención en memoria de hasta 20 trabajos, 15 minutos desde creación, sin persistir
trabajos. Otro inicio cancela el anterior; cancelar terminal es idempotente. Python
transporta el mejor testigo durante ejecución y cancelación, sin afirmar optimalidad.
Los resultados incompletos llevan `running`/`cancelled`, con prueba `inconclusive`.
Cobertura completa solo acredita cobertura, conservando vacíos normativos y puertas T7.
La ampliación del enum requiere actualizar consumidores que exhaustivamente discriminen
motivos; los requests anteriores y el endpoint síncrono siguen siendo compatibles.
Corrección aislada necesaria en `schedule-generator.ts`: estrechar el tipo del motivo
que su diagnóstico síncrono recibe; no cambia algoritmo, límites ni decisiones T8.
El adaptador omite `capacityCertificate`/`prelation` nulos que Python serializa pero el
contrato de propuesta representa como ausentes; no relaja sus validadores.

La sesión predeterminada usa trabajos, con sondeo secuencial cada 250 ms, timeout de
cada consulta y plazo total acotado al presupuesto más margen de supervisión. Cambiar
configuración/periodo, reemplazar búsqueda o desmontar invalida su secuencia, aborta
el sondeo y cancela el trabajo, incluso si el inicio llega tarde. Cancelar antes del
incumbente conserva la propuesta anterior. No hay autosave ni fallback por errores.
La pantalla abre Horario al recibir el primer incumbente en curso; conserva las vistas,
filtros y controles existentes y bloquea edición/guardado/aprobación/publicación durante
la búsqueda. Muestra fase y conteos reales y Cancelar; la cancelación queda explícita.
Se conserva el seam autorizado de tests que sustituyen únicamente `createProposal`
sobre una copia del cliente predeterminado. El test integrado comprueba también la
sesión predeterminada sin ese override y rechaza llamadas al endpoint síncrono/autosave.

Skills aplicadas: `nestjs-best-practices` (fronteras y errores async), `vitest`, `oxlint`
y `diagnosing-bugs` (regresiones de cancelación y transporte). CodeGraph/configuración
existentes comprobados; no se reindexó ni inicializó ni recorrió ninguna fuente privada.

| Criterio | Escenario/check sintético | Resultado |
| --- | --- | --- |
| Inicio sin esperar solver, primer horario antes del terminal, progreso real | `node --experimental-strip-types client/scripts/verify-planning-jobs.mjs`: adaptador real→NestJS→Python en puertos efímeros propios, 40 secciones independientes | Verde; inicio running <5 s, incumbente recibido running, conteos y propuesta coherentes |
| Identidad/retención y aislamiento | Script integrado más `programacion-academica-jobs.spec.ts`: 25 actualizaciones, una identidad/slot, copia retornada alterada | Verde; no consume slots por sondeo ni altera copias retenidas |
| Cancelar con/sin incumbente, sin CPU residual | Script integrado; `test_solve_jobs.py` mata y comprueba proceso; tests de sesión para borrador anterior | Verde; idempotencia y testigo válido conservados, sin atribuir agotamiento del presupuesto |
| Final completo/faltante/error, desconocido/caducado y rechazo | Python jobs; backend jobs (fallo/forma inválida/expiry/deshabilitado); script real completo y faltante, desconocido, presupuesto, origen y query/cancel body inválidos | Verde; error sin propuesta inválida, upstream cancelado al fallar/expirar |
| Configuración/periodo/desmontaje/reinicio y sondeos secuenciales | `planningSession.test.ts`: inicios diferidos y poll pendiente tras invalidación, signal abortada, no polling adicional | Verde; ningún resultado obsoleto sustituye el workspace actual |
| Pruebas honestas y runtime | Shared API tests y aceptación real; motivos running/cancelled, conteos incompatibles y pruebas prematuras rechazadas | Verde; cobertura completa no afirma cumplimiento normativo ni prelación óptima |
| Guardado explícito y gates | Guardar incumbente running devuelve 409 en stack real; backend captura/edición bloqueadas; sesión no llama guardar, aprobar/publicar conservan idle/CAS | Verde; trabajo final/cancelado vuelve al flujo explícito habitual |
| T7 intacto | Suites normativas/publicación/persistencia/schedule, pytest y arnés docente T7 existente | Verde; no se retiran brechas mínimas ni bloqueos de publicación |
| UI/visual | Build/lint; conexión de sesión y apertura del panel de Horario inspeccionada en fuente | No se ejecutó DOM/navegador, foco/teclado/zoom ni comparación visual. No se acredita aceptación visual ni React DOM→HTTP→Python |

Comandos/resultados de la ronda (ejecutables locales equivalentes a package scripts;
sin pnpm install, nuevas dependencias ni lockfiles, recursos pesados secuenciales):

- Raíz: `node --test shared/academic-normative-profile.test.mjs shared/programacion-academica-api.test.mjs shared/programacion-academica-publication.test.mjs`: **24/24**.
- Raíz: `planning-engine/.venv/bin/python -m pytest planning-engine/test_capacity_prelation.py planning-engine/test_window_decisions.py planning-engine/test_solver_scale.py planning-engine/test_solve_jobs.py -q`: **49/49**, aviso existente de deprecación langchain-community.
- Backend: `SUM_PLANNING_ENGINE_URL=off ./node_modules/.bin/vitest run test/programacion-academica-jobs.spec.ts test/programacion-academica-normative.spec.ts test/programacion-academica-normative-publication.spec.ts test/programacion-academica-publication.spec.ts test/programacion-academica-persistence.spec.ts test/programacion-academica-block-api.spec.ts test/programacion-academica-schedule.spec.ts`: **122/122** en la ronda de siete archivos; después se añadió un quinto test de retención/aislamiento y `... vitest run test/programacion-academica-jobs.spec.ts` pasó **5/5**.
- Cliente: `./node_modules/.bin/tsc -p tsconfig.data-tests.json && node --experimental-strip-types --test --test-isolation=none src/data/*.test.ts`: **335/335**.
- Raíz: `node client/scripts/test-planning-teacher-draft.mjs`: **verde**.
- Raíz: `node --experimental-strip-types client/scripts/verify-planning-jobs.mjs`: **verde**, incluye sesión predeterminada real, sin fallback ni autosave.
- Backend: `./node_modules/.bin/nest build` y `./node_modules/.bin/oxlint --type-aware src/ test/`: **verdes**; cuatro avisos unbound-method preexistentes en local-profile-session.spec.ts.
- Cliente: `./node_modules/.bin/tsc -b && ./node_modules/.bin/vite build` y `./node_modules/.bin/eslint .`: **verdes**; avisos de bundle/plugin timings y CSS @reference, sin errores.
- Raíz: `git diff --check`: **verde**. Sin commits, merges, resets, limpieza de checkout ni cambios de rama/HEAD.

Fallos intermedios resueltos: `python` no existía (se usó python3); algunos comandos de
edición con ruta relativa de raíz se lanzaron desde client/backend y fallaron sin editar
archivos (se repitieron desde la raíz correcta); la primera compilación detectó el nuevo
enum en el diagnóstico síncrono; el stack real detectó el opcional null del motor;
la primera suite cliente detectó el seam antiguo del consejero y se conservó; dos
aserciones nuevas requirieron corregir su expectativa (estado busy tras dispose y
mensaje interno de HttpException, comprobado ahora por status/envelope). Sin fallos
pendientes en los checks ejecutados.

Recursos: el runner construye sus fixtures desde cero, usa allowlist de entorno sin
variables snapshot ni credenciales, reserva puertos nuevos y crea su directorio temporal.
En finally detiene y espera exclusivamente a sus procesos y borra ese directorio. Las
rondas terminaron con confirmación de limpieza. No se tocaron servicios del operador.
La integración es sesión/capa de datos→HTTP NestJS→Python; queda pendiente la
comprobación DOM/visual enfocada por el principal, sin bloquear T8/T6b ni reinterpretar
estos resultados como evidencia de SUM.

## T8: encargo de candidatos exhaustivos (2026-11-11)

Depende de T4a y perfil/contrato PA-ENGINE-2 ya presentes. T4b se revisa en paralelo
sin editar; sus archivos jobs/models/transport/session/shared quedan fuera de T8.
Propiedad exclusiva del worker T8: `planning-engine/solver.py`, pruebas existentes de
capacidad/prelación/escala/ventanas si son necesarias y un nuevo test de exhaustividad;
registro de resultados en `docs/reverse-engineering/plans/programacion-academica-t8-results.md`.
No modificar este plan ni archivos del worker T4b. No commits ni instalación.

Objetivo y contrato: eliminar recortes arbitrarios de candidatos por docente/sección y
muestreo de ambientes, o reemplazarlos únicamente con poda cuya inocuidad esté demostrada.
Conservar PA-ENGINE-2 y PA-ENGINE-JOBS-1/PA-PLANNING-JOBS-1 sin nuevos campos. Si el plazo
no permite construir/explorar todos los candidatos, conservar un testigo válido y declarar
búsqueda inconclusa por tiempo, nunca prueba de imposibilidad/optimalidad del modelo reducido.
Un testigo completo sí acredita cobertura, pero no prelación si no se demostró.
Mantener restricciones, tramos normativos resueltos, orden lexicográfico estricto, valores
fijados con asignaciones libres y hooks/procesos de T4a/T4b. No ejecutar búsqueda ilimitada.

Aceptación: casos sintéticos pequeños construidos para que la única solución o la mejor
prelación requieran un candidato descartado por cada recorte anterior, incluidos ambientes,
docentes y cursos continuos/partidos; resultado coincide con enumeración exhaustiva de
referencia independiente cuando sea manejable. Deadline/cancelación durante construcción
preservan respuesta y no marcan pruebas falsas. Primer horario se publica pronto mediante
hooks existentes, con presupuesto de tiempo y memoria controlado. Reejecutar regresiones
relevantes, medir un caso de escala sintético disponible con procedencia verificada y
presupuesto acotado, informar conteos/tiempos y límites sin presentar test local como SUM.

Preservar todas las interfaces existentes y `docs/design-direction.md`; T8 no autoriza
cambiar ninguna pantalla. Prohibido datos-reales directa o indirectamente, producción,
exports, servidores ajenos y fixtures de procedencia incierta. Solo datos independientes
sintéticos. No asumir que un horario completo cumple mínimos de publicación.

### T4b: reparación de ciclo de vida tras auditoría (2026-11-11)

La revisión independiente confirmó cuatro regresiones: inicio aceptado cuya respuesta se
pierde deja CPU sin seguimiento; limpieza fallida deja de reintentarse al marcar el snapshot
fallido; el cliente desbloquea edición/guardado tras fallar cancelar; cancelar antes de un
inicio rechazado deja busy sin resolver. Requieren una reparación acoplada de protocolo,
backend y sesión; T4b no se considera cerrado por los checks previos.

Extensión compatible autorizada de PA-PLANNING-JOBS-1: identificador de correlación opcional
(UUID validado) conocido por el llamador antes de iniciar, tanto en cliente→backend como en
backend→motor. Mantener identidades públicas/internas separadas. Reintentos con misma clave
y mismo payload son idempotentes; misma clave con distinto payload rechaza conflicto. Una
cancelación previa debe impedir el inicio tardío de ese mismo trabajo durante la retención
acotada; una respuesta perdida no vuelve imposible reconciliar/cancelar. No modificar el
contrato síncrono del solver ni sus campos de candidatos (T8 los posee).

Las obligaciones pendientes de detener CPU se registran aparte del estado público de error;
no se descartan por poda, un fallo de transporte, un DELETE fallido ni al cerrar el módulo.
Reintentos y reconciliación acotados y explícitos; no afirmar que la CPU terminó sin prueba.
La sesión no habilita guardado/edición mientras el trabajo siga activo o incierto. Cancelar
antes de fallo de inicio debe resolverse con un resultado confirmado, o mostrar incertidumbre
con una vía explícita de reintento, nunca busy silencioso e irreversible. Pruebas rojas/verdes
de las cuatro carreras, correlación y cancel-before-start; repetir integración sintética.

Propiedad exclusiva del reparador: shared contrato de trabajos/validadores/tests; backend
programación trabajos/controller/transporte/tests; engine jobs.py/main.py y tests de trabajos,
cliente adaptador/sesión/tests y aviso/acción de cancelación dentro de paneles actuales;
registro separado `programacion-academica-t4b-lifecycle-results.md`. No editar solver.py,
pruebas de candidatos/escala/capacidad, ni documento T8, que están asignados a otro worker.
Conservar diseño e interfaces existentes solo en /local/programacion-academica; alumno y
selector excluidos. Privacidad y pruebas enteramente sintéticas vigentes. Un ciclo automático
de reparación, sin commits y sin nueva delegación desde el worker.


### Recepción de T8 (2026-11-11)

Implementación recibida sin commit; véase [informe T8](programacion-academica-t8-results.md).
El worker reporta 79 casos distintos aprobados, incluyendo oráculo exhaustivo pequeño,
regresiones de candidatos descartados y control de interrupciones. No equivale a una
ejecución conjunta de 79. Escala sintética: primer testigo 3.2 ms, retorno 2.44 s sobre
presupuesto 2.5 s, inconcluso honesto porque no terminó el modelo exhaustivo. Sin cambios
UI ni contrato. Revisión independiente del modelo requerida antes del cierre de T8.


### Cierre de T8 tras auditoría (2026-11-11)

Revisión independiente de modelo/pruebas sin defectos materiales confirmados. Respaldó
factorización exacta de docente/inicio/ambiente, restricciones y extracción, fijación de
valores lexicográficos y prueba conservadora del incumbente. No reejecutó las 79 pruebas;
inspección de fuentes, diff y comprobación de whitespace aprobada. El oráculo independiente
cubre seis casos de continuo/partido/ambientes/evitar contrato; no cubre por sí solo todos
los rangos de categoría/interfacultad, preferencias, cohortes, laboratorios o cupos. Esos
límites no se presentan como garantías universales. Sin aceptación visual ni publicación
normativa derivada de este cierre.

## Preparación de T6b (no despachar mientras T4b posee archivos compartidos)

Objetivo: el consejero consume `proposal.decisions`, `capacityCertificate`, `coverageProof`
y `normative` de PA-ENGINE-2/T7, en lugar de volver a estimar con heurísticas o simular un
horario independiente. Hoy `buildLocalDeterministicAdvisor` calcula aumentos hasta 2400 min
y franjas por cantidad de pendientes; `analyzeProposalAdvisor` puede llamar /v1/advisor
para proponer/simular. T6b debe retirar esas dos fuentes de decisiones del camino actual.
No inventar decisiones cuando faltan pruebas o el solver no terminó su análisis.

Reutilización: mantener endpoint de consejero, versión esperada y panel/patches existentes
cuando representen el mismo efecto. Las recomendaciones aplicables pueden usar cambios de
franja, modalidad, incorporación explícita de referencias y ajustes dentro del techo ya
autorizado. Una excepción formal pendiente no se vuelve un patch autoaplicable: se muestra
con requisitos/fuentes y lleva al registro docente existente. No elevar carga por encima
del máximo autorizado ni tratar incorporación de recurso como disponibilidad confirmada.

Contrato candidato para fijar al inicio del ticket: trazabilidad opcional `decisionIds` en
recomendaciones; fuente explícita `engine-decisions` sin atribuir LLM ni simulación. Mantener
lectura legacy de modos anteriores; `verifiedImpact` solo si existe una regeneración real
comparable, jamás por sumar condiciones necesarias ni por reutilizar una simulación vieja.
Impacto de una decisión de capacidad es cota/condición necesaria, no garantía de horario.
Las referencias de docentes/ambientes son el catálogo sintético existente; la incorporación
sigue explícita, validada y necesita completar disponibilidad/datos obligatorios cuando
falten. No introducir un catálogo alternativo ni tope 2400 como autorización normativa.

Aceptación prevista: correspondencia decisión→recomendación/acción, IDs y versión obsoleta;
ninguna llamada de propuesta/simulación al antiguo /v1/advisor para decidir; ningún aumento
sin evidencia formal; datos faltantes/decisiones vacías honestos; aplicación explícita→trabajo
T4b→comparación del resultado real, sin autosave; referencias conocidas/desconocidas y datos
incompletos; regresiones T7/T8 y cancelación T4b intactas. Verificación con sesión/adaptador,
NestJS y Python propios, datos independientes sintéticos. UI conserva estructura, estilos,
componentes y navegación según docs/design-direction.md; solo paneles actuales de
/local/programacion-academica autorizados, alumno/selector excluidos. Contrato definitivo y
propiedad se fijan después de recibir la reparación de T4b; esta preparación no autoriza
trabajo concurrente sobre archivos compartidos.


### Recepción de reparación T4b y habilitación T6b (2026-11-11)

Véase [informe de ciclo de vida](programacion-academica-t4b-lifecycle-results.md).
Revisión del principal confirma reserva antes del POST, ID interno separado, barreras
contra inicios tardíos, propiedad de limpieza separada del estado público y bloqueo de
la sesión incierta con reintento explícito. El worker reporta regresiones rojas/verdes e
integración sintética con pérdidas en ambos enlaces; límites de memoria/retención y falta
de recuperación durable quedan explícitos. Sin garantías de parada por un error de red.
T6b queda habilitado sin otro worker escribiendo sus archivos.

## T6b: contrato y encargo fijados (2026-11-11)

Implementar sobre PA-ENGINE-2, T7 y T4b reparado. El endpoint de consejero actual y su CAS
`expectedEditVersion` se conservan. La fuente de decisiones es exclusivamente la propuesta
retenida (`decisions`, certificado, prueba y reporte normativo), no heurísticas de déficit,
turnos ni una llamada a /v1/advisor para volver a proponer/simular. Si falta análisis,
mostrarlo y pedir nueva búsqueda; no inventar recomendaciones o prueba de insuficiencia.
No iniciar análisis automáticamente al montar ni consultar normativa/LLM para decidir.

Extensión compatible de respuesta: `source.mode` admite `engine-decisions` (providerLabel
null y sin fallbackReason); cada recomendación aplicable puede incluir `decisionIds`
validados, no vacíos, únicos y relacionados con decisiones vigentes. Conservar la lectura
legacy para historiales; no emitir verifiedImpact ni razonamiento de simulación para este
modo. Comparación de impacto solo después de aplicar explícitamente y regenerar mediante
T4b, usando el resultado real y la versión asociada. Fuente local-only de esta conversión
se distingue de las fuentes normativas de cada decisión.

Correspondencias:
- planning-window y delivery-mode-split: patches existentes exactamente para lo señalado
  por decisiones, sin agregar sábado/tarde por cantidad de pendientes.
- configuration-adjustment: patch increase_teacher_load existente con incremento exacto,
  dentro del máximo YA autorizado resuelto por perfil y versión. No sustituye autorización.
- teacher-load-exception formal: requisitos/fuentes y acceso al registro docente existente,
  sin patch ejecutable por encima de lo autorizado. Usar cola PlanningDecisions existente
  para la acción de registro; el consejero puede describir el bloqueo sin crear un patch
  ilegal ni simular disponibilidad de autorización.
- additional-teacher: enlazar recursos de referencia compatibles del catálogo existente,
  sin duplicar recursos/identidades ni inventar disponibilidad, categoría o autorización.
  Incorporación explícita, editable y validada; referencias incompletas deben mostrar qué
  falta. No prometer cobertura por mera incorporación ni imponer un tope normativo 2400.
  Si no hay referencia adecuada, informar recurso adicional requerido, sin candidato ficticio.

Reutilizar paneles/UI, adaptador, patch application y controles vigentes. Autorizado solo
/local/programacion-academica y paneles; mantener docs/design-direction.md, tipografía y
componentes, alumno/selector/tokens excluidos. Fuente de impacto es condición necesaria
(capacidad/franja) y no una simulación ni garantía. Cancelado/inconcluso no significa
imposible. Rechazar consejero mientras el trabajo corre o su limpieza esté incierta.

Propiedad exclusiva de un paquete acoplado: shared API de consejero/tipos/validadores/tests;
backend cliente de consejero/servicio/helpers/tests del módulo; cliente adaptador/estado/
patches/paneles de consejero existentes y tests; script nuevo de aceptación sintética;
registro separado programacion-academica-t6b-results.md. No modificar solver/candidatos,
jobs/main/protocolo de cancelación, perfil normativo ni reportes T7/T8/T4b. No nuevo servicio
paralelo de recomendaciones ni dependencias. Retirar camino legacy vivo del consejero local
sin borrar código Python ajeno que pudiera conservar otros consumidores; documentar retiro.

Aceptación: validación de modo/trazas; tabla de conversión anterior, selección vacía y
obsoleta; faltan/ausentes decisiones; ninguna llamada /v1/advisor ni simulación para emitir
recomendaciones; ninguna carga no autorizada; referencias faltantes/duplicadas y campos
incompletos; aplicar explícitamente→T4b→resultado real, sin autosave; versión/configuración
obsoleta bloquea aplicación. Comprobar en stack nuevo sintético cliente→NestJS→Python,
regresiones de publicación T7 y trabajos T4b, builds/lint/test:data afectados. UI/DOM/foco/
teclado/zoom verificados al cierre integrado si no se ejecutan aquí. No se afirma fidelidad
visual por pasar tests de datos. Sin commits y sin acceder a datos-reales/ directa o
indirectamente, producción, snapshots ni servicios del operador.


### Recepción T6b y cierre integrado (2026-11-11)

Informe recibido: [T6b](programacion-academica-t6b-results.md). Se retira el camino vivo
/v1/advisor/heurísticas del backend y se conserva aplicación explícita/versionada. El
worker reporta 18 shared, 49 backend, 341 cliente y stack sintético sesión→NestJS→Python
aprobados, además de builds/lint. Referencias nuevas quedan sin disponibilidad/carga
inventadas; necesitan configuración explícita. Estas cifras no son una ejecución adicional
del principal. Revisión independiente de T6b requerida antes del cierre.

Aceptación integrada pendiente: nuevo stack enteramente sintético propio y navegador de
pruebas aislado (sin acceder a servicios del operador). Generación inicia trabajo,
primer horario/progreso/cancelación, bloqueo de acciones mientras corre, consejero usa
fuente engine-decisions sin llamada /v1/advisor, aplicación explícita y regeneración,
registro docente no arrastra borrador entre identidades, guardado/revisión/aprobación/
publicación con rechazo normativo y un caso permitido, anchos estrechos y teclado/foco.
No toda la matriz requiere navegador si la capa está cubierta por HTTP/tests actuales,
pero debe distinguirse cobertura DOM de la cobertura de contrato/servicio. Mantener
interfaces/design-direction en la única ruta interna autorizada; no cambiar alumno ni
selector. Referencias visuales actuales solo se usan con igual viewport/estado/contenido;
sin equivalente no afirmar paridad. Registrar fallos verificables, no reparar código en
la etapa de prueba. Scripts/evidencia/informe de aceptación asignados de forma exclusiva
al test worker; auditor no escribe y no arranca navegador. Estado sin commit.


### T6b auditado y corregido por el principal (2026-11-11)

Dos P2 confirmados corregidos directamente: validación atómica de recursos compuestos y
texto de ajustes ya autorizados en SuggestionCard. Regresiones nuevas rojas antes y verdes
después; 342 pruebas de datos y 15 comprobaciones de componentes SSR aprobadas. Véase
informe T6b ampliado. El test worker conserva propiedad exclusiva de su script/evidencia
y fue informado del cambio para recargar la versión actual. Aceptación DOM todavía en curso.


### Aceptación DOM integrada de T6b (2026-11-11)

El test worker terminó sin resultado; el principal asumió el script y la evidencia. Cinco
correcciones solo del script (ruta, navegador instalado, tres selectores); sin cambios de
aplicación. Resultado: 6/6 escenarios aprobados sobre stack sintético propio. Observaciones
abiertas: 422 de vista-previa al reanudar borradores, control «Editar horario» ausente tras
cancelar, zoom real y paridad visual sin verificar. Detalle en el informe T6b. Sin commit.


### T7: auditoría integrada y reparaciones (2026-11-11)

Auditor independiente (solo lectura) sobre `12f5e2d..1a0d05c`: resultado no aceptado por un P1
y un P2; sin vía hallada para eludir el bloqueo de publicación.

- P1 (decisión combinada perdía la separación de componentes): reparado en `b92e2d3` por un
  worker Codex. Contrato: `requiresSplit?: true` en la decisión y `splitCourseIds?` en el patch
  de franja existente; aplicación atómica en la sesión. Verificación del principal: pytest de
  decisiones de franja 16/16, `nest build`, y aceptación DOM integrada 6/6 sobre el árbol reparado.
- P2 (texto de faltante comprobado afirmaba un máximo de secciones no demostrado): corregido por
  el principal en `4cd977e`; datos cliente 342/342 entonces, 344/344 según el worker tras P1.

No verificado: escenario combinado en navegador, y re-auditoría independiente de `b92e2d3`.
Siguen abiertas las observaciones del informe T6b (Editar horario tras cancelar, zoom real,
paridad visual).
