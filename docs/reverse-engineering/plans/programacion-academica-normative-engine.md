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
| T4b | Backend e interfaz consumen los trabajos del motor: primer horario rápido, progreso y cancelación | T4a, T5 | por asignar | pendiente |
| T5 | Interfaz: estado de cobertura, cola de decisiones, vacíos normativos, datos reglamentarios del docente con registro de autorizaciones, bloqueos en la publicación | T3 | Claude Sonnet 5.5 (Codex sin cuota) | verificado e integrado 2026-11-11 |
| T6a | Motor: decisiones de franja y de modalidad para las secciones sin franja (`planning-window`, `delivery-mode-split`, base `window-precheck`) | T2 | Codex GPT-6.1 Sol | verificado e integrado 2026-11-10 (`1ca4df2`) |
| T6b | El consejero consume las decisiones del motor en lugar de proponer y simular; recursos de referencia | T3, T6a | por asignar | pendiente |
| T8 | Motor: generar candidatos sin recorte (o con recorte demostrablemente inocuo) para que la prelación y la cobertura puedan quedar probadas | T4a | por asignar | pendiente |
| T7 | Auditoría del resultado integrado | T3–T6 | por asignar | pendiente |

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
