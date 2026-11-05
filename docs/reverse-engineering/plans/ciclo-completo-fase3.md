# Cierre de programación y ciclo E1 → E2 → E3

Fecha: 2026-11-05. Autor del diagnóstico y plan: principal.
Estado actualizado: P1/P2 y A/B/C implementados; recorrido sintético integrado
aprobado en Docker y navegador, incluido reinicio. Ver
[aceptación y límites](../../../evidence/local/ciclo-completo-fase3/fullstack-verification.md).
Los apartados de diagnóstico conservan la línea base previa a implementación.
Rama: `docs/fase3-propuesta`, derivada de `schedule-pt1` en `5f9083f`.
El merge `dfa3e52` contiene el mismo árbol de aplicación. No se hacen commits,
push ni merges; se conservan los documentos locales de otros trabajos.

Complejidad alta por identidad, oferta y persistencia; incertidumbre media en la
demo y alta en reglas institucionales de programación; impacto alto en matrícula.

## 1. Fuentes y significado de fase

| ID | Fuente revisada, fecha y ámbito | Clase y límite |
| --- | --- | --- |
| P-01 | [README de la propuesta](https://github.com/jeanpzh/propuesta-pre-matricula/blob/main/README.md), versión 2026-10-29, blob `db36d6ec0f92a1e7e8888233b420cd7bba3afaf9` | Requisito de diseño `local-only`, no norma ni estado real del software. Repositorio privado: se enlaza, sin copiar el documento. |
| P-02 | [Análisis de la propuesta](https://github.com/jeanpzh/propuesta-pre-matricula/blob/main/propuesta-prematricula-horarios.md), blob `33b9ef3aaffd09ba94b53384da954ceafab006a1`, secciones 9–11 | Propuesta con testimonios e hipótesis identificados. Sus etapas y arquitectura exploratoria difieren del README; no asumir una especificación institucional cerrada. |
| U-01 | Encargo y dos aclaraciones del usuario, 2026-11-05 | Criterios de planificación reportados (`testimony`) y decisiones para la demo (`local-only`). No se convierten en reglas oficiales. |
| C-01 | Código/contratos `5f9083f`, revisión estática de este encargo | Implementación local constatada; su existencia no sustituye pruebas integradas. |
| V-01 | [Aceptación de PR35](../../../evidence/local/pr35-review/fullstack-verification.md) y [traslado E2/E3](../../../evidence/local/e2-e3-intention-import/fullstack-verification.md) | Resultados históricos sintéticos con sus límites; no son pruebas nuevas ni paridad SUM. |
| OF | [Investigación oficial](../../domain/fisi/2026-II/phase3-planning-sources-2026-11-05.md) | Documentos UNMSM/FISI consultados 2026-11-05, con periodo, plan, discrepancias y limitaciones por fuente. |

El repositorio localizado es `jeanpzh/propuesta-pre-matricula`. Su raíz contiene
dos Markdown, una presentación PPTX y su generador; no contiene PDF. Se revisaron
ambos Markdown. No se ejecutó el generador ni se trasladaron documentos privados.

E1/E2/E3 designan etapas del recorrido del alumno/escuela. En P-01, fase 2 es
programación asistida y fase 3 es el ciclo completo con reajuste, portal docente,
asistentes y adopción institucional. Los cinco nuevos pedidos mejoran principalmente
E1. A/B/C del encargo son el puente de la demo hacia E3; completarlos no acredita
por sí solo toda la fase 3 institucional de P-01. Se conservan ambos alcances.

## 2. Estado contrastado con el código

| Área | Existe y se reutiliza | Brecha real |
| --- | --- | --- |
| E1 catálogo/demanda | Adaptador sintético, estimador potencial, demanda final editable, cálculo `ceil(demanda/capacidad)` | Defaults de catálogo: demanda 0 y objetivo 30. No están los presets 180/90/45. Catálogo reutilizado de programación, no currículo oficial completo de diez ciclos. |
| E1 recursos | Catálogo de referencia, editor y recursos activos; ocho docentes iniciales y cuatro ambientes | El generador utiliza solo recursos activos. Hay 49 ambientes de referencia, pero máximo 32 activos; no hay filtro de nombre docente ni datos de categoría/adscripción vigentes. |
| E1 horarios | DFS acotado, validación independiente, docente/aula/sección sin cruces, disponibilidad, carga, bloques continuos y preferencias docentes | Ventanas globales L–V 08–22; no política por ciclo/noches/sábado. `compatibleGroups` se envía vacío. `kind` de aula/laboratorio no llega al validador como restricción de compatibilidad. No se acredita ausencia de cruces entre cursos del mismo ciclo. |
| E1 revisión/publicación | Borradores, CAS, conformidades por huella, aprobación y versiones inmutables | Rol Escuela/Docente simulado; no portal autenticado, plazos o máximo de rondas del proceso propuesto, fijación/regeneración de aceptadas ni conciliador/LangGraph. |
| E2 | Publicaciones, selección, calendario, borradores personales, intención explícita, historial y agregados por publicación | Dos perfiles SIS, escenario Regular; periodo literal 2027-I. Validación E2 parcial: no aplica hoy mínimo 12/máximo 26 ni toda la política de repetición del motor de confirmación. Es una decisión local documentada, no equivalencia con P-01. |
| E2 → E3 | Botón existente, lectura de intención, correspondencias explícitas, descarte de respuestas tardías, protección ante solicitud incierta | Positivo compatible probado aisladamente; demo real rechaza 2027-I → 2026-II. No existe activación operativa 2027-I desde publicación E1. |
| E3 | Evaluación, confirmación, idempotencia, resultados, reporte y ocupaciones del motor existente | La vía local usa un `RunState` en memoria, con cola y copia candidata. Reiniciar no recupera sus matrículas. No tiene oferta/contexto persistente 2027-I activable. |
| Persistencia | E1/E2: `SavedDraftStore<T>` con checksum, escritura temporal/fsync/rename y CAS de servicio; simulador público: `EnrollmentStore` PostgreSQL | Son garantías y caminos distintos. No atribuir la transacción PostgreSQL al Compose local. Reutilizar interfaces/implementaciones compatibles antes de extender almacenamiento. |

Referencias principales: `synthetic-catalog-adapter.ts`, `demo-proposal.service.ts`,
`generator-input.ts`, `generator-limits.ts`, `schedule-validator.ts`,
`prematricula.service.ts`, `matricula-regular.repository.ts`, `store.types.ts`,
`persistence/enrollment-store.ts`, `AcademicScheduling.tsx`, `AcademicResourceEditor.tsx`.
La propuesta contempla Python/CP-SAT y agentes; la aplicación actual funciona con
NestJS/TypeScript. Esa diferencia no autoriza sustituir el generador ni añadir
servicios o dependencias antes de medir una necesidad concreta.

Comprobación estructural nueva del seed explícitamente sintético, sin ejecutar la
aplicación: 56 códigos únicos en programación y 85 en filas de plan; ambos cubren
ciclos 1–10. Esto comprueba presencia de ciclos, no integridad de un currículo
institucional ni que todos los cursos del plan ya tengan oferta y patrón semanal.

## 3. Los cinco pedidos y las decisiones de la demo

### Demanda por paridad y capacidad

Perfil de planificación versionado por facultad/escuela/plan/periodo, con procedencia
U-01. Para cursos de ciclos 1–10, semestre I: impares 180, pares 90; semestre II:
pares 180, impares 90. Objetivo inicial 45. Producen 4/2 secciones si no se ajustan.
No significan 180 alumnos únicos en todo el programa ni un conteo observado de E2.
No escalar los dos estudiantes de la demo para obtener esas cifras.

Se aplican al crear una planificación o mediante acción explícita. Una edición,
estimación revisada, intención agregada o borrador recuperado conserva su valor;
cambiar de periodo no sobrescribe ajustes silenciosamente. Mantener separados
potencial, intención, preset y demanda final. `26-1` del encargo es ejemplo:
normalizar a `2026-I` solo en la entrada de planificación; no confundirlo con
antecedentes académicos `2026-1`, ni modificar su significado en el ledger.

El contrato actual fija 2027-I en workspace/publicación/demanda/E2. Demostrar la
paridad de 2026-II exige una extensión validada por ámbito; no basta un selector
visual ni sustituir todas las ocurrencias de 2027-I. La demo A/B/C permanece 2027-I.

### Tesis y docentes

Tras «lo recomendado» del usuario, la excepción afecta a habilitación docente;
conservar presets 180/90/45 editables. No inventar un aforo especial de tesis.
Los códigos del fixture sintético son `20118081`, `20118091`, `20118101`, ciclos
8/9/10. Solo el primero quedó contrastado en una oferta oficial parcial plan 2018,
periodo 2026-0; los otros dos siguen sin cotejo curricular completo. Los códigos
locales sirven para la demo, no prueban el currículo institucional vigente.

Regla local solicitada: candidatos habilitados de FISI para esos cursos, con
adscripción/especialidad explícitas. No deducir facultad, categoría ni disponibilidad
por el nombre o asignación histórica. Usar metadatos sintéticos construidos para
la demo; un docente desconocido no pasa automáticamente a habilitado.
La mención «en su mayoría principales, auxiliares» no se interpreta como exclusión
de asociados. OF-02 art. 9 incluye las tres categorías y establece prelación general;
no se corroboró una exclusividad especial para estas asignaturas. No confundir
responsable de curso con asesor de tesis ni aplicar una norma de otra facultad.

### Preferencia nocturna y excepciones

Para ciclos VII–X, priorizar L–V desde 18:00. Tras «recomendado» del usuario, la
alternativa preferida es desde 14:00 con aprobación explícita; sábado por la mañana
queda después, procurando minimizar su uso. No relajar cruces, capacidad, habilitación
o disponibilidad. Registrar qué excepción se propone y quién la acepta.

Modelar preferencia por curso/periodo, sin disfrazarla de disponibilidad del docente.
Antes del handoff, fijar hora final admisible, ventana exacta del sábado y criterio
medible de minimización; el cierre actual de 22:00 es un límite local del catálogo,
no una norma corroborada. Conservar bloques continuos; un bloque que no cabe no se
recorta ni divide sin la excepción explícita existente. `search-limit` no demuestra
que sea inevitable una excepción ni que no exista una solución nocturna.

### Recursos automáticos y búsqueda

El comportamiento actual es deliberado: referencia y recurso incorporado son listas
distintas. Conviene incluir el conjunto elegible del periodo sin altas una a una,
con exclusiones/ajustes explícitos. Para aulas, incorporar automáticamente las
disponibles del inventario sintético; mantener capacidad y clasificación. No
inventar disponibilidad institucional ni activar incondicionalmente todo docente
que haya aparecido en una programación histórica.

Reutilizar el editor con búsqueda digitada, sin distinción de tildes/mayúsculas,
por nombre y código, lista progresivamente filtrada, teclado y estado sin resultados.
La búsqueda no cambia las selecciones activas ni las asignaciones guardadas.

## 4. Límites e incompatibilidades antes de modificar contratos

1. El catálogo administrativo contiene 56 cursos de referencia, pero la petición
   admite 32 cursos/docentes/ambientes y 128 sesiones/secciones. Los 49 ambientes
   no caben como activos. Con 4/2 secciones por curso, una oferta de todos los ciclos
   puede superar esos límites. Dimensionar con patrones reales del fixture y prueba
   reproducible; no retirar límites ni prometer programación completa por aumentar inputs.
2. Revisar coherentemente shared runtime/declaraciones, validadores de generador,
   cobertura, límites, persistencia y UI. No introducir un segundo contrato para
   el mismo comportamiento. Las ventanas/compatibilidad por ciclo y el tipo de
   ambiente requieren transporte y comprobación del servidor, no solo decoración UI.
3. El fingerprint del catálogo valida borradores/publicaciones existentes. Cambiar
   defaults o metadatos puede invalidarlos. Definir lectura compatible por revisión
   y migración explícita de borradores; publicaciones previas permanecen legibles,
   inmutables y con sus capacidades originales. No eludir verificaciones de integridad.
4. Un perfil futuro reutiliza `fisi-regular`, evaluador y turnos existentes, con fechas
   sintéticas explícitas o calendario verificado. No copiar las fechas 2026-II a 2027-I.
5. Contexto/actor/sesión deben quedar ligados a una oferta y ámbito. El repositorio
   local y GET de contexto actuales representan una ejecución global; no cambiar
   el `scope.period` del mismo actor ni reiniciar el escenario para cambiar de semestre.
   Congelar selección de contexto por sesión/run antes de A; no introducir un cambio
   global que altere otras pestañas o la oferta 2026-II.

## 5. Trabajo incremental y propiedad de archivos futura

El principal congela los contratos y aceptación antes de despachar. Backend y cliente
se asignan a implementadores GPT-6 Luna High con archivos disjuntos, máximo dos
workers sin subdelegación. El principal verifica integración. No hay agentes
planificadores. En este encargo solo hubo un investigador de fuentes oficiales.

| ID / dependencia | Resultado y módulos a revisar/modificar | Criterio de salida y estado |
| --- | --- | --- |
| D0 / ninguna | Este diagnóstico, fuentes y registro; reutilizar planes E1/E2/importación y contratos vigentes | Documentado; no reescribir el plan general ajeno `replica-funcional-integrada.md`. |
| S0 / D0 | Tipos de pruebas, helpers HTTP, fixtures negativos tipados; `backend/test/`, tsconfig/scripts solo si se justifica. Revisar suites de navegador existentes y su configuración Vite | Cero diagnósticos en alcance acordado, causas previas/nuevas registradas; flujos originales conservan aserciones y pasan. Pendiente de implementación autorizada. |
| P1 / D0 | Presets, búsqueda y pool de recursos: `AcademicScheduling.tsx`, `AcademicResourceEditor.tsx`, `data/academicScheduling.ts`; `synthetic-catalog-adapter.ts`, `demo-proposal.service.ts`, shared PA y sus pruebas | Casos pares/impares, ajustes conservados, todos los ambientes elegibles sin altas individuales, búsqueda accesible; sin romper documentos anteriores. Pendiente. |
| P2 / P1 + decisiones horarias | Política por curso/ciclo, habilitación de tesis, grupos compatibles, ambientes y límites: `generator.types.ts`, `generator-input.ts`, `generator-limits.ts`, `schedule.types.ts`, `schedule-validator.ts`, `schedule-generator.ts`, `session-coverage.ts`, shared PA y tests | Cero violaciones duras; conteo de excepciones; capacidad, aulas/labs y búsqueda acotada verificados. Pendiente. |
| A0 / D0 | Principal: ampliar contrato propio desde `programacion-academica-demo.md`, `matricula-regular.md`, `local-profile-dashboard.md`, `profile.types.ts`, `store.types.ts`; resolver identidad/contextos, calendario y garantías de almacenamiento | Esquema exacto, errores, CAS, compatibilidad y escenarios listos antes del código. No congelado todavía. |
| A / A0 + S0 | Activación E1 → E3: `programacion-academica/academic-release.ts`, `saved-draft.service.ts`, `demo.controller.ts`; adaptador/servicio de activación junto al módulo existente; repositorio/contextos/perfiles/sesiones y almacenamiento E3; control local en `AcademicPublicationPanel.tsx` | Una publicación válida se activa una sola vez en oferta 2027-I con origen explícito y ocupación cero; persiste y se recupera sin tocar 2026-II ni E1. Pendiente. |
| B / A | `prematricula.service.ts`, `shared/matricula-intention-import.*`, `RegularEnrollment.tsx`, adaptadores/sesión/contexto y rutas locales existentes | Intención de A/B cargada desde oferta real compatible; pendientes y cambio de sección, sin alterar E2 ni ocupación. Docker/navegador real, sin respuestas controladas como sustituto. Pendiente. |
| C / B | `matricula-regular.service.ts`, `rules.ts`, `windows.ts`, `result.service.ts`, `report.service.ts`, repositorio y pruebas; reusar `evaluateAndCommitSubmission`/camino existente y almacenamiento compatible | Confirmación 2027-I revalidada, atómica e idempotente, reporte y recuperación durable; última vacante sin sobreocupación, 2026-II sin regresión. Pendiente. |
| I / A+B+C y P2 para escala completa | Scripts locales/Compose y evidencia nueva con datos sintéticos; actualizar informe de avance | Recorrido integral obligatorio y matriz por criterio con comandos/resultados. No ejecutado para la nueva fase. |
| R / I, contrato propio nuevo | Reajuste S-5, rondas con plazos y secciones fijadas, roles reales, agentes opcionales y eventual enlace institucional | Alcance futuro de la propuesta; no queda cubierto por A/B/C ni autorizado para conectar OSUM. |

Prioridad técnica del puente: A0 → A → B → C → I, como pide el encargo. P1/P2
cierran mejoras E1 en entregas separadas; no deben bloquear una demo A/B/C pequeña
ya publicable ni cambiar publicaciones aprobadas para poder integrarla. La prueba
de escala con todos los ciclos sí depende de P2 y de resolver sus límites.

## 6. Invariantes de A, B y C

- Activación toma identidad y versión de publicación, verifica snapshot aprobado,
  integridad y ámbito, y crea correspondencias desde IDs canónicos. No usa nombres,
  números de grupo o parecido de horarios como equivalencia. Conservar origen por
  curso/sección y revisión de oferta; capacidades autorizadas y ocupaciones separadas.
- Activación repetida equivalente devuelve el recurso existente; petición divergente
  o cambio de oferta activa requiere resolución explícita/CAS. Oferta nueva nace con
  ocupación cero. No borrar ni reinterpretar matrículas previas, ni hacer reset global.
- Propuesta local de persistencia a validar en A0: reutilizar `SavedDraftStore<T>`
  para una unidad de escritura por contexto que contenga oferta, solicitudes,
  inscripciones, reportes y contadores; persistir la copia candidata antes de hacerla
  visible. Evaluar cuota de 2 MiB y validación completa. Garantía limitada a un escritor
  y reinicio del proceso; no afirmar transacción multiarchivo/multiproceso ni tolerancia
  a pérdida eléctrica sin prueba. Si no basta, evaluar `EnrollmentStore` PostgreSQL
  existente con aislamiento por campaña, sin otro motor ni mezcla con la campaña pública.
- Reanudar tras reinicio conserva resultados e idempotencia; renovar o recrear sesión
  académica explícitamente no borra el resultado. No reutilizar tokens/sesiones de otro
  contexto ni aceptar un intento antiguo contra una oferta distinta.
- B importa una selección editable; sigue vigente la barrera de solicitudes inciertas.
  C vuelve a comprobar perfil, créditos y excepciones, turnos, prerequisitos, repitencia,
  tutoría, condiciones institucionales, horario y vacantes dentro de la operación.
  Fallo antes de publicar/persistir no consume plazas; respuesta perdida se recupera
  consultando el mismo requestId, nunca reenviando una identidad nueva automáticamente.
- E1 y la intención E2 conservan sus versiones/historial. Matricularse no registra
  una nueva intención ni cambia el agregado histórico del alumno.

## 7. Aceptación sintética prevista

| Criterio | Escenario y resultado esperado | Estado |
| --- | --- | --- |
| AC-P1 | Semestres I/II invierten 180/90 por ciclo; objetivo 45; override, borrador y fuente de demanda conservados; 4/2 secciones | Planeado |
| AC-P2 | Tesis local con docente FISI habilitado; docente ajeno/desconocido no se asigna; asociado no excluido sin regla explícita; sin cambio automático de cupos | Planeado |
| AC-P3 | VII–X nocturno preferido; excepción 14:00 aprobada antes de sábado; todas las restricciones duras se mantienen; límite de búsqueda no se vende como imposibilidad | Planeado; faltan ventanas exactas |
| AC-P4 | 49 ambientes sintéticos elegibles utilizables, filtro docente con/sin tildes y cero resultados; no duplica recursos, borrar texto restaura lista | Planeado |
| AC-A1 | Publicación inválida, versión obsoleta, duplicado, contexto incompatible y fallo de persistencia no cambian oferta; éxito crea mapa inequívoco, revisión y ocupación cero | Planeado |
| AC-A2 | Reiniciar recupera oferta activa y documentos; contexto 2026-II y otra sesión/periodo quedan intactos | Planeado |
| AC-B1 | Dos estudiantes registran intenciones reales, Escuela ve agregados, activa su publicación; cada alumno carga solo su intención, cambia sección y conserva E2 | Planeado |
| AC-C1 | Selección válida 12–26 o excepción expresa confirma mediante motor actual; requisitos desconocidos producen pendiente; fuera de turno no confirma | Planeado |
| AC-C2 | Dos alumnos compiten concurrentemente por una plaza: exactamente uno aceptado, ocupado nunca supera capacidad; alternativa admisible para el otro | Planeado |
| AC-C3 | Reenvío idéntico produce mismo resultado/reporte; payload distinto con misma clave no muta; fallo en persistencia deja estado anterior; resultado perdido se recupera tras reinicio | Planeado |
| AC-I1 | E1 genera/revisa/publica, E2 A/B registran, Escuela agrega/activa, E3 importa/modifica/confirma/reporta; todo con servicios reales en Compose y navegador | Planeado |
| AC-I2 | Cambio/cierre/desaparición de sección y oferta obsoleta conservan intención; E1 no cambia, 2026-II sigue funcionando; sin mocks sustituyendo integración | Planeado |
| AC-V | Mismas pantallas SUM, componentes, textos y navegación preservados; solo controles locales autorizados cambian | Planeado; fidelidad visual de referencia requiere condiciones equivalentes |

Comandos futuros según package.json: build/lint de ambas capas, `client test:data`,
Node tests shared/config, `backend test`, `backend test:e2e` cuando se provea su
PostgreSQL sintético y suites de navegador secuenciales. Ejecutar scripts propios
E1/E2/importación, agregar activación/confirmación real 2027-I y reinicios. Compose
usa nombre/puertos/volúmenes nuevos; nunca eliminar volúmenes del operador.

## 8. Estabilidad reproducida en este diagnóstico

Se ejecutó TypeScript sin emitir ni usar incremental, en código actual y worktrees
aislados comparables. Dependencias existentes compartidas, sin instalación ni servidor.
En la línea base `ddf3d63` se generaron primero declaraciones de fuente en su worktree
y se proporcionaron ambas dependencias para evitar errores artificiales por archivos
ausentes. La medición inicial no comparable de 103 se descartó.

- Actual `5f9083f`: **106 diagnósticos, todos en `backend/test/`**; se confirma también
  en worktree aislado. `tsc --noEmit --incremental false -p backend/tsconfig.build.json`
  pasa. El comando completo usa `backend/tsconfig.json` y sale con código 2.
- Pre-PR `ddf3d63`: **77 diagnósticos**. Hay **29 en archivos de pruebas nuevos**;
  76 firmas coinciden y una firma preexistente del helper cambia su mensaje/tipo.
  Diferencia por firma: 30 añadidas/1 retirada; no confundirla con 30 bugs nuevos.
  Los informes históricos de 104 no sustituyen este conteo con su versión/entorno.
- Distribución nueva: acceso académico 14, preferencias 6, traslado E3 2, servicio E2 2,
  demanda/demo/edición/publicación/revisión docente 1 cada uno. Corregir tipos de dobles
  y entradas negativas sin quitar escenarios ni debilitar validación runtime.
- [CI final de PR35](https://github.com/jeanpzh/SUM-reverse/actions/runs/42055483436):
  client/backend pasan; backend-browser falla: **14 fallos y 16 aprobados**, tres
  archivos fallidos y uno aprobado. Timeouts esperando paneles y selector de matrícula.
  El [CI anterior](https://github.com/jeanpzh/SUM-reverse/actions/runs/39840222099) ya
  registraba fallo de backend-browser; no se ha demostrado aún igualdad de causa.
  No atribuir los 14 fallos al caso histórico aislado 595/596 ni llamarlos flakiness
  sin diagnóstico. S0 debe comparar navegación, modo/sesión, DOM y red sintética.

No se repitieron suites de aplicación, Docker ni navegador en esta etapa documental.
Los resultados de aceptación PR35 se mantienen históricos y acotados. Los logs de CI
consultados provienen del workflow sintético público; no se copian logs crudos.

## 9. Siguiente paso y límites del diagnóstico inicial

Completar A0 y el handoff de A usando los contratos existentes: definir selección de
contexto/sesión, snapshot durable, capacidades/orígenes y calendario sintético 2027-I.
S0 debe dejar una línea base de regresión utilizable. P1 está acotado funcionalmente;
P2 necesita fijar ventanas y procedencia docente antes de codificar.

La próxima autorización de implementación no autoriza commits, push, cambios a
`master` ni integración institucional. Cada handoff debe nombrar root/folder AGENTS,
skill local, revisión contractual, dependencias, archivos exclusivos, pruebas,
preservación de fidelidad SUM y pantallas autorizadas. Como máximo un ciclo automático
de reparación tras un fallo; después, diagnóstico y decisión registrada del principal.

## 10. Ejecución y cierre posterior autorizado

El usuario autorizó implementar y reiteró continuar. Se completaron contrato y
criterios antes de los handoffs. P1/P2 y A/B/C reutilizan los módulos y pantallas
existentes. La aceptación por criterio AC-P1 a AC-V se registra en el informe
enlazado al inicio; sus resultados actualizan la tabla de planificación del
apartado7. No se amplía el alcance a toda la adopción institucional de P-01.

El principal completó las tareas que los trabajadores no terminaron por límite
del proveedor y ejecutó la aceptación. La unicidad por estudiante/periodo incluye
versiones de oferta; se conserva la matrícula anterior al activar otra. Se probó
la concurrencia por última plaza y el cambio a una alternativa disponible, además
de rollback de persistencia y recuperación después de reinicio. Se corrigieron
los106 diagnósticos TS reproducidos; quedan0. No se eliminaron pruebas.

Se preservaron documentos ajenos, publicaciones inmutables e intenciones E2.
No hubo commits/push/merges ni acceso institucional. Permanecen los límites
de evidencia oficial, paridad visual de referencia, un solo escritor y las pruebas
PostgreSQL omitidas descritos en el informe; no bloquean la demo local verificada.
