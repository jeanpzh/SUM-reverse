# Matrícula regular virtual FISI 2026-II: planificación

## Ejecución 2026-10-11

- Modo: ejecutar exclusivamente planificación documental mediante `speckit-plan`.
- Alcance: feature existente `specs/001-matricula-regular-fisi/`; React en `client/`, NestJS independiente en `backend/`, ambas escuelas FISI.
- Objetivo: auditar reutilización, completar contexto y gates, investigar decisiones y producir diseño solo si cumple los prerrequisitos.
- Rama Git: `jeanpzh/REA`; identificador lógico Spec Kit: `001-matricula-regular-fisi`. No se creó ni cambió una rama.
- Restricciones: sin implementación, commits, pruebas de aplicación, servidores, producción o datos privados. `datos-reales/` permanece excluido, también indirectamente.

### Entradas y procedencia

| Entrada | Uso y límites |
| --- | --- |
| [Spec vigente](../../../specs/001-matricula-regular-fisi/spec.md) | Requisitos y aclaraciones ya recibidas; base normativa y recorrido testimoniado, sin aceptación N3. |
| [Checklist](../../../specs/001-matricula-regular-fisi/checklists/requirements.md) | 13/16; CHK006, CHK009 y CHK013 pendientes. Sin modificación de marcadores. |
| [Constitución 1.0.0](../../../.specify/memory/constitution.md) | Siete principios y gates obligatorios. |
| [Resumen de sesión](../session-summary-2026-10-11.md) | Continuidad del trabajo; no fuente primaria ni ampliación de permisos. |
| [Dossier FISI](../../domain/fisi/2026-II/README.md) y [preguntas](../../domain/fisi/2026-II/open-questions.md) | Fuentes offline y ámbito académico; revisión contra las respuestas vigentes de la spec, sin actualizar documentos originales. |
| [Contratos locales existentes](../contracts/local-api/) | Candidatos de reutilización que requieren contraste con código vigente; consultas no acreditan registro de matrícula. |

Las huellas SHA-256 de instrucciones, constitución, spec, checklist y fuentes se preservaron para verificar que esta etapa no los altera. También se registró una línea base de 146 archivos de código en carpetas explícitamente permitidas; no se inspeccionaron datasets.

### Enrutamiento y propiedad

- Complejidad alta: recorrido integrado y varios perfiles/reglas académicas.
- Incertidumbre alta: B-01–B-06 y cuatro definiciones funcionales pendientes.
- Impacto alto: integridad del registro, capacidad, repetición y protección de datos.
- Disparador: petición explícita de planificación y preferencia establecida en AGENTS.md.
- Planner despachado: `sum-planner`, perfil real `gpt-6.1-sol`, esfuerzo `high`; agente `/root/matricula_plan`.
- Escritura exclusiva del planner: [plan.md](../../../specs/001-matricula-regular-fisi/plan.md), [research.md](../../../specs/001-matricula-regular-fisi/research.md); artefactos Phase 1 únicamente tras aprobar el gate.
- Escritura del principal: este registro y comprobaciones documentales. Workers de implementación no despachados. El planner no delega.
- Reparaciones automáticas de implementación: 0; no hubo implementación.

### Etapas

| Etapa | Decisión | Resultado |
| --- | --- | --- |
| Setup | Ejecutar | `setup-plan.sh --json` reutilizó la plantilla existente y resolvió la misma feature. |
| Hooks previos | Omitir | `.specify/extensions.yml` ausente al inicio; ningún hook registrado. |
| Auditoría y Phase 0 | Ejecutar | [MR-PLAN-1](../../../specs/001-matricula-regular-fisi/plan.md) y [MR-RESEARCH-1](../../../specs/001-matricula-regular-fisi/research.md), revisión 1: auditoría estática, decisiones, diez invariantes, unidades futuras condicionadas y estrategia de aceptación. Phase 0 parcial. |
| Phase 1 | Bloquear | `ERROR`: investigación incompleta por aclaraciones pendientes; no habilita modelo de datos, contrato definitivo ni quickstart. |
| Implementación e integración | Omitir | Fuera de la etapa solicitada. |
| Hooks posteriores | Omitir | `.specify/extensions.yml` sigue ausente al finalizar; ningún hook registrado. |

### Incertidumbres que deben preservarse

1. Orden y cardinalidad de avisos cuando concurren errores.
2. Horas operativas del 11–12 de agosto.
3. Resultados de ambos estudiantes ante la última vacante.
4. Resultado y recuperación cuando se pierde la respuesta tras un posible registro.

Las respuestas existentes sobre PP acumulado y `>=17`, prematrícula previa, rechazo completo, reinicio de selección y reporte solo tras aceptación siguen registradas como testimonios. La falta de corroboración no vuelve esas preguntas sin responder. Una decisión técnica local no cierra N3.

### Resultado de reutilización comunicado por el planner

`MC-CONTRACT-1`, `MI-CONTRACT-1` y los módulos `ReportesRepository`/`ReportesService` ofrecen puntos de integración para lectura. La revisión confirmó cinco consultas de reportes, soporte opcional de snapshots y copias de resultados; no un contrato de escritura ni efectos de inscripción. `validateMatriculaWire` valida formas de datos, sin acreditar validación académica o control de capacidad. Las rutas y símbolos auditados quedan detallados en el plan y la investigación.

La reutilización del transporte, vistas y repositorios de consulta debe conservar sus consumidores actuales. No se propone conectar una nueva escritura a snapshots del operador ni considerar esos snapshots fixtures. Un conjunto nuevo sintético debe tener procedencia y reset explícitos antes de cualquier verificación futura.

### Estado y validación

Estado final: **bloqueado para completar Phase 0 y avanzar a Phase 1**. Documentación independiente completada por `sum-planner`; no existe contrato nuevo de escritura fijado ni handoff listo para implementación. Las nueve unidades futuras son dependencias propuestas, no tareas despachadas ni un `tasks.md`.

El principal revisó ambos documentos y corrigió únicamente espacios al final de línea en sus cabeceras; ninguna decisión del planner cambió. Esta corrección documental no fue una reparación de implementación.

Comprobación documental: `python3 /tmp/validate-sum-plan-docs.py`, **PASS** en sus tres grupos de comprobación. Comprueba tres documentos, enlaces locales, whitespace, campos de plantilla e identificadores FR/AC/SC; compara SHA-256 de doce entradas protegidas y 146 archivos de código. Comprueba ausencia de artefactos Phase 1 y `tasks.md`. El diff de revisión se conserva temporalmente en `/tmp/sum-matricula-plan-review.diff`; no incluye cambios previos ajenos.

Los resultados de aceptación visual, conductual N3, backend de escritura e integración permanecen **no verificados**. No se ejecutaron pruebas de aplicación, build/lint, servicios, producción ni commits. Siguiente acción: aportar las cuatro definiciones pendientes y revisar sus dependencias mediante clarify; después completar research y volver a evaluar el gate. La corroboración N3 conserva su propia condición de cierre.

## Ejecución posterior: planificación local autorizada, 2026-10-11

Esta ejecución sigue a la autorización expresa del usuario mediante `speckit-clarify`.
La spec vigente contiene 29 FR, 33 AC y 8 SC. L-01–L-04 fijan resultados propios de la
réplica y permiten continuar el diseño local; no resuelven las preguntas de referencia
MR-U01–MR-U04 ni cierran B-01–B-06/N3. El bloqueo anterior queda como registro histórico.

- Encargo: aplicar `speckit-plan` a la misma feature, hasta diseño Phase 1.
- Setup ejecutado: reutilizó `plan.md`; branch lógica `001-matricula-regular-fisi`, Git `jeanpzh/REA`, sin cambio de rama.
- Hooks previos: `.specify/extensions.yml` ausente; ningún hook registrado.
- Reutilización: auditoría focalizada y contratos readonly de la ejecución anterior; revisar brechas y diseño de writes sin repetir investigación suficiente.
- Complejidad/impacto: altos por integridad, concurrencia y recuperación. Incertidumbre funcional local reducida por L-01–L-04; incertidumbre N3 conservada.
- Planner efectivo: se retomó `/root/matricula_plan`, rol `sum-planner`, perfil `gpt-6.1-sol`, esfuerzo `high`, sin subdelegación.
- Escrituras exclusivas del planner: `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, `contracts/` de la feature y contrato canónico nuevo `docs/reverse-engineering/contracts/local-api/matricula-regular.md`.
- Escritura exclusiva del principal: este registro, revisión del resultado y comprobaciones documentales. Ningún worker de implementación despachado.
- Restricciones: no código, fixtures, pruebas de aplicación, build/lint, commits, servidores, exportaciones, producción, browsers o datos privados. Preservar spec, checklist, fuentes, instrucciones y otros contratos.
- Protección: SHA-256 de 168 archivos de entrada/código registrados antes de editar; copia de plan/research/workflow previos para un diff que excluya cambios anteriores.

### Resultados y gates de esta ejecución

| Etapa | Resultado actual |
| --- | --- |
| Phase 0 | [Research revisión 2](../../../specs/001-matricula-regular-fisi/research.md) completo para decisiones locales; auditoría reutilizada, MR-U01–MR-U04 pendientes como preguntas SUM/N3. |
| Phase 1 | [Plan revisión 2](../../../specs/001-matricula-regular-fisi/plan.md), [modelo](../../../specs/001-matricula-regular-fisi/data-model.md), [referencia contractual/UI](../../../specs/001-matricula-regular-fisi/contracts/README.md) y [guía futura](../../../specs/001-matricula-regular-fisi/quickstart.md). |
| Contrato compartido | [MR-CONTRACT-1](../contracts/local-api/matricula-regular.md), autoridad única HTTP/DTO/errores/efectos; lecturas existentes preservadas. |
| Constitution Check | Gates documentales del diseño local aprobados antes/después; N3 y aceptación funcional siguen pendientes. |
| Implementación y tareas | No ejecutadas; no se generó `tasks.md`, no se despacharon workers de código. |
| Hooks posteriores | `.specify/extensions.yml` ausente; ningún hook registrado. |

Diseño propio: memoria por ejecución `runId`, singleton de un proceso, cola serial y
publicación conjunta de cursos/cupos/reporte/resultado. Identidad de solicitud por
run/actor/request y payload canónico; consulta sin efectos, repetición conserva resultado.
Reinicio/reset genera otro run y descarta estado anterior; `RUN_CHANGED` evita aceptar,
rechazar o reenviar silenciosamente la solicitud del run destruido. No se promete
durabilidad ni coordinación de varios procesos. Sesión de demostración identificada,
sin autenticación nueva ni tokens SUM. Son decisiones `local-only`.

El perfil documental conserva horas desconocidas del 11–12. Las ventanas sintéticas
de pruebas tienen revisión/procedencia propias sin fallback. Gaps por datos desconocidos
impiden commit en ese caso. La UI no añade polling, panel de vacantes actualizadas ni
conservación de elección después de rechazo por cupo. Los efectos de matrícula se leen
en la API propia, sin reportes seed/snapshot como confirmación.

El principal revisó contrato/modelo y pidió cerrar cuatro inconsistencias documentales:
separación de clase de evidencia frente a decisión local, frases heredadas de Phase 1
pendiente, causa de curso no ofertado sin entrada alcanzable y precedencia protocolaria
de replay frente a catálogo/sesión. El planner las corrigió antes de cerrar su entrega.
Ninguna de estas correcciones fue reparación de implementación; contador de reparaciones 0.

**Validación documental: PASS**, `python3 /tmp/validate-sum-plan-r2.py`: siete documentos,
enlaces, fences, whitespace, IDs y campos de plantilla; 168 entradas/código protegidos
sin cambios; `tasks.md` ausente y hooks ausentes. El diff de revisión se conserva en
`/tmp/sum-matricula-plan-r2-review.diff`, comparado con las entradas de esta ejecución.
La spec/checklist se preservaron: 29 FR, 33 AC, 8 SC y checklist 13/16.

**Estado final: diseño local completo**, preparado para revisión de requisitos y generación
de tareas; no es una implementación aceptada. Siguiente etapa admisible:
`speckit-checklist` y `speckit-tasks`, sin repetir la auditoría suficiente.
Fidelidad N3, aceptación visual, API implementada e integración React/NestJS permanecen
no verificadas. Sin pruebas de aplicación, build/lint, servidores, browser, producción,
datos privados, exportaciones o commits.


## Ejecución posterior: cierre de hallazgos y tareas, 2026-10-11

Estado de entrada: checklist personalizado de fidelidad evaluado 34/40, con seis
criterios abiertos en H-FID-01–H-FID-05. El usuario aportó investigación y solicitó
las etapas `speckit-plan` y `speckit-tasks`; no implementación ni commit.

- Decisiones confirmadas mediante dos respuestas explícitas: selección local por
  intersección prematrícula completa/oferta; todo rechazo académico definitivo
  retorna al registro y reinicia selección; pérdida de respuesta mantiene intento
  recuperable; datos incompletos quedan pendientes.
- Alcance confirmado: MAT-01–MAT-10 como categorías de catálogo finito con todos los
  FR/AC existentes; ACC-01–ACC-10 para pantallas de esta feature, sin Inicio general
  ni afirmación de conformidad integral WCAG AA. Excepciones/ramas académicas,
  concurrencia y recuperación conservadas.
- Fuentes públicas contrastadas por el principal: [nota de revisión](../../domain/fisi/2026-II/planning-source-review-2026-10-11.md). F1/F2 reconsultadas, no normas nuevas;
  resolución PCM publicada contrastada, anexo/vigencia consolidada no auditados;
  W3C primaria como referencia técnica local. No observación productiva de matrícula.
- Reutilización: auditoría y diseño r2; no repetir búsqueda de código suficiente ni
  inferir funcionalidad actual desde el repositorio público mencionado.
- Planner efectivo retomado: `/root/matricula_plan`, `sum-planner`, GPT-6.1 Sol High,
  sin subdelegación. Etapa documental; ningún worker de implementación despachado.
- Ownership planner: spec, plan, research, modelo, referencia UI/contrato, quickstart,
  contrato canónico y catálogo de aceptación; tasks solo tras diseño listo.
- Ownership principal: revisión pública, este registro, evaluación de fidelidad,
  setup y comprobaciones documentales. Archivos disjuntos.
- Setup-plan reutilizó archivo existente sin sustituirlo. Feature lógica
  `001-matricula-regular-fisi`; rama Git `jeanpzh/REA`, sin cambio de rama.
- Hooks antes de planificación: `.specify/extensions.yml` ausente.
- Estado de diseño: revisión r3 y MR-CONTRACT-2 listos para tareas; cierre local
  reevaluado por el principal. N3 conserva gate separado.

Prohibiciones conservadas: datos privados directos/indirectos, snapshots del operador,
servidores/exportadores, experimentos SUM, código/fixtures/tests de aplicación y
commits. Solo documentación local y fuentes públicas institucionales/técnicas.


### Resultado del cierre local y generación de tareas

| Etapa | Resultado documental |
| --- | --- |
| Fuentes | Nota PUB-01–PUB-05 enlazada; contenido normativo y estándar técnico separados de testimonios, inferencias y políticas locales. No sesión SUM observada. |
| Phase 0 | Research r3 reutiliza auditoría suficiente y conserva MR-U01–MR-U04 como pendientes N3. |
| Phase 1 | Plan revisión 3, MR-MODEL-2, MR-CONTRACT-2, referencia UI, catálogo MR-ACCEPTANCE-1 y quickstart sincronizados. |
| Checklist personalizado | Reevaluación 40/40 para calidad documental local; historial de34/40 y cinco hallazgos conservado. H-FID-01–H-FID-05 cerrados localmente; B-01–B-06/N3 abiertos. Requirements integrado se preserva13/16. |
| Setup-tasks | Script resolvió la misma feature y plantilla vigente; no creó otra feature ni cambió rama. Hooks antes/después plan/tasks ausentes. |
| Tareas | [tasks.md](../../../specs/001-matricula-regular-fisi/tasks.md):51 casillas pendientes, seis historias, dependencias/ownership, ejemplos de parejas disjuntas y restricciones literales para handoff. No ejecutadas. |

Catálogo finito:113 variantes ×2 escuelas=226 instancias funcionales y170 celdas ACC
separadas. SC-002 cuenta50 casos known normativos y16 expected-gap aparte; un resultado
unknown/pending local no verifica una regla SUM ni conformidad normativa desconocida.
MAT-01–MAT-10 permanecen categorías, no diez pruebas exhaustivas.

El principal pidió tres precisiones de diseño: variante PP desconocido, condiciones de
aplicabilidad de causas simultáneas y separación de universos funcional/ACC; también
precisó redacción heredada de etapa y aviso local veraz ante navegación manual a reporte.
En tasks revisó rutas completas y secuencia de verificación con navegador único. Estas
son correcciones documentales previas a ejecución; no ciclos de reparación de aplicación.

Siguiente acción: `speckit-analyze` en modo de análisis documental sin modificaciones,
si lo solicita el usuario; implementación solo en etapa asignada posteriormente. No se
despacharon Luna workers, ni se ejecutaron tests/build/lint, servidores, navegador,
REA, integración, exportaciones o commits. La consulta web se limitó a fuentes públicas.


**Estado final de esta ejecución: diseño local y generación de tareas completos**,
pendientes de implementación y aceptación funcional. El principal verificó los seis
criterios documentales reabiertos contra r3 y conservó el historial del checklist.

**Validación documental final: PASS**, `python3 /tmp/validate-sum-plan-r3.py`:12 documentos,
enlaces locales/fences/whitespace/IDs;157 entradas e instrucciones/archivos de código
protegidos sin cambios; cinco respuestas testimoniales originales y cuadro F6 preservados;
51 tareas con numeración/labels/formato y caminos de archivo completos;40/40 criterios
del checklist personalizado. Comprobación adicional:113 variantes únicas,10ACC y
verificación funcional/accesible en secuencia con único navegador. Hooks posteriores
plan/tasks ausentes. Diff de esta ejecución: `/tmp/sum-plan-r3-review.diff`.

Conteo de tareas: Setup3 +Foundation9 +US1(5) +US2(5) +US3(5) +US4(5) +US5(7)
+US6(7) +Final5 =51. Todas pendientes, pruebas solo planificadas. Modelo del planner
real GPT-6.1 Sol High reutilizado; ningún cambio de modelo simulado ni despacho de código.


## Corrección documental autorizada después de analyze, 2026-10-11

El análisis de solo lectura identificó C1 (referencia AC-26 incorrecta), U1
(orden ambiguo del evaluador para el MVP US1) e I1 (cronología de fuentes/revisión).
El usuario autorizó corregir únicamente estos puntos y repetir la comprobación.
Esta es una etapa de remediación documental separada del análisis sin escrituras.

- Se reutiliza `/root/matricula_plan`, rol real `sum-planner`, GPT-6.1 Sol High, sin
  subdelegación ni nueva auditoría de código. No es un replanteamiento de la feature.
- Ownership planner: documentos de requisitos/diseño/catálogo/tasks y aclaración
  de contrato si la necesita U1. Principal: checklist, workflow y checks.
- C1: PP>19 corresponde a AC-25; se planifican ocho variantes AC-26 para los días
  11/12 y PP sintéticos0/16/17/20, con ventana de prueba explícita y ninguna hora
  oficial nueva. Catálogo esperado121 variantes/242 instancias; ACC170 separado.
- U1: evaluador único de entrada en Foundation antes de Context/US1, reutilizado
  en US2; 51 IDs de tareas conservados, sin hardcode de elegibilidad ni backend mock.
- I1: diferenciar consultas iniciales históricas de la revisión pública posterior
  y sincronizar la tabla constitucional vigente. N3 conserva sus dependencias.
- Baselines: doce documentos para diff y163 entradas/instrucciones/source protegidos.
  Hooks ausentes; misma rama/feature. Estado de remediación: correcciones terminadas, revisión4.

No código, fixtures, tests de aplicación, build/lint, servicios, exportadores, datos
privados, inspección SUM o commits. Las casillas de tareas permanecen pendientes.


**Comprobación de remediación: PASS**, `python3 /tmp/validate-sum-analysis-remediation.py`.
Doce documentos con enlaces, formato e identificadores comprobados;163 entradas protegidas
sin cambios, incluidos código, instrucciones, constitución, dossier y requirements.md.
Se preservaron las cinco respuestas testimoniales originales, F6 y la matriz normativa.
Catálogo121 variantes únicas/242 instancias funcionales,170ACC separados;51 tareas pendientes.
T007 define el evaluador único, T012 lo verifica antes de T015; T020 reutiliza la función.
Plan/research revisión4; MR-CONTRACT-2 aclarado sin cambio HTTP. Diff de esta remediación:
`/tmp/sum-analysis-remediation-review.diff`. Estas comprobaciones son documentales;
no constituyen ejecución de las tareas ni corroboración N3.

Termina la etapa de corrección autorizada. La repetición de analyze posterior se realiza
solo en lectura y se informa en conversación; no escribe un informe al repositorio.


Reanálisis readonly:13 documentos conservados por SHA-256 durante la ejecución;
C1/U1 cerrados, sin nuevos bloqueantes locales ni conflictos constitucionales.
I1 conservaba una etiqueta «plan r3» en quickstart: terminada la lectura, se corrigió
esa referencia a r4 en una etapa separada bajo la autorización documental original.
Las47 entradas de requisitos (29FR/8SC/10ACC) tienen asociación a las51 tareas;
no hay tareas sin justificación de historia, requisito o gate constitucional.
Cobertura documental no acredita que las pruebas futuras hayan pasado. N3 sigue pendiente.
