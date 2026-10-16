# Research: matrícula regular virtual FISI 2026-II

**ID / revisión**: `MR-RESEARCH-1`, revisión 4, 2026-10-11.

**Entrada**: [spec.md](spec.md), [checklist](checklists/requirements.md), [MR-PLAN-1](plan.md).

**Planner efectivo**: `sum-planner`, GPT-6.1 Sol High; sin subdelegación.

**Estado**: Phase 0 completa para el diseño local autorizado L-01–L-06. Phase 1 habilitada para contrato propio. N3 permanece pendiente por fuentes/casos, sin bloquear esas políticas locales.

## Fuentes y límites revisados

**Nueva entrada MR-S08 / local-only:** autorización expresa L-01–L-06 de `spec.md`, 2026-10-11. Revisión vigente: 29 FR, 33 AC y 8 SC. Se reutiliza la auditoría r1 sin repetir exploración suficiente; no se añaden observaciones SUM.

| ID / clase | Referencia / fecha / ámbito | Uso y límite |
| --- | --- | --- |
| MR-S01 / normative | [Reglas F1–F6](../../docs/domain/fisi/2026-II/business-rules.md), [README](../../docs/domain/fisi/2026-II/README.md); corte 2026-10-11 | F1 R.R. 002642-2026-R, 26-02-2026; F2 anexo R.R. 014408-2025-R, 16-12-2025; F6 firmado 21-07-2026 según dossier. FISI 2026-II; norma/calendario, no enforcement SUM. En etapa inicial no se reconsultaron fuentes remotas; la revisión pública posterior MR-S09/PUB-01–05 reconsultó F1/F2 sin runtime SUM. |
| MR-S02 / testimony | [AS-IS](../../docs/domain/fisi/2026-II/as-is-process.md) P01/P03–P09 y `spec.md / Clarifications`, 2026-10-11 | Experiencia declarada FISI 2026-II y periodos anteriores recurrentes. Clarifications posterior precisa preguntas antes abiertas en AS-IS. Falta de corroboración no equivale a falta de respuesta. |
| MR-S03 / observed documental | F6 descrito en dossier; M-01 resumido en `spec.md`, 2026-10-11 | F6 acredita cuadro publicado; M-01 aviso de éxito de manual con edición/ámbito pendientes. Se reutilizan resúmenes, sin abrir originales. No prueban commit/redirección/registro FISI. |
| MR-S04 / inferred | [Fidelidad N0–N3](../../docs/domain/fisi/2026-II/emulation-fidelity.md), corte 2026-10-11 | Niveles/configurabilidad locales; America/Lima inferida por jurisdicción. Catálogo placeholder no adoptado como literal/contrato. |
| MR-S05 / unverified | [Q-01–Q-35](../../docs/domain/fisi/2026-II/open-questions.md), B-01–B-06/G-01–G-03 de spec | Preguntas no son reglas. Nuevas aclaraciones reducen incertidumbre descriptiva, conservan corroboración N3. |
| MR-S06 / observed local estática | Código/manifests auditados abajo, leídos 2026-10-11 | Acredita implementación en repositorio, no runtime o comportamiento SUM. No pruebas/servicios ejecutados. |
| MR-S07 / documentación histórica | [Plan matrícula](../../docs/reverse-engineering/plans/matricula.md), [plan MC](../../docs/reverse-engineering/plans/matricula-compatibility.md), contratos MC/MI/reportes/RI, 2026-10-08 | Lecturas/wire reutilizables. Plan MC registra cierre sintético posterior; contrato conserva nota de estado previa. No se reprodujo verificación ni se certifica un nuevo write por resultados históricos. |

[Constitución 1.0.0](../../.specify/memory/constitution.md), AGENTS raíz/carpetas y
[resumen de sesión](../../docs/reverse-engineering/session-summary-2026-10-11.md)
delimitan etapa. Resumen/planes históricos son contexto revisado, no nueva evidencia
primaria. Solo documentos y código seguros offline/estáticos; ningún acceso a
`datos-reales/` o snapshots indirectos, producción, browser, REA, servidores/exportadores.

## Auditoría de reutilización

CodeGraph se usó antes de buscar/leer código, con consultas de matrícula, repositorios,
transporte y componentes. Algunas coincidencias fueron amplias/truncadas; se completaron
lecturas focalizadas pertinentes. No es auditoría exhaustiva de módulos ni datasets.

| Archivo / símbolo | Hallazgo concreto | Reutilización / brecha e impacto |
| --- | --- | --- |
| `shared/matricula-wire.mjs`, `.d.mts`; `validateMatriculaWire`, `dataSchemas` | Cinco lecturas, `codError:null`, JSON y extras preservados. | Reutilizar wire; números/flags no prueban capacidad/elegibilidad. No sustituir por validator write ni relajar para nuevos efectos. |
| `backend/src/reportes/reportes.controller.ts`; `prematricula`, `matricula`, `horarios` | POST readonly bajo reportes, consulta sin payload de elección. | Conservar rutas/acciones/errores; matrícula aquí significa reporte. Fuente mutable futura exige revisar consumidores y contrato, sin duplicarlo. |
| `backend/src/reportes/reportes.repository.ts`; `read`, `readFormulario`, `readMatriculaSnapshot` | Seed clonado populated/empty; snapshots opcionales al arranque; copias por lectura. | No es repositorio de inscripción ni multiestudiante. Snapshot/seed podrían ocultar efectos si se mezclan sin diseño; no se arrancó para inspeccionarlos. |
| `backend/src/reportes/reportes.service.ts`; `consultar` | Prefiere snapshot en tres reportes y luego envelope seed. | Correspondencia inscripción→reporte requiere fuente explícita; reporte poblado previo no demuestra aceptación. |
| `backend/src/matricula-informacion/`; `MatriculaInformacionService.consultar`, repository `read/readSnapshot` | Unión wire académico/artículo local; periodo del contexto común. | Reutilizar consulta/unión; flags no definen por sí solos FR-021/turnos. Nuevo estado local necesita revisión de MI/MC. |
| `backend/src/common/readonly-query.ts`, `ConsultaReportePipe` | Frontera runtime de lectura; prioridad acción→query→body. | Conservar; no convertir esa prioridad en precedencia académica ni body vacío en DTO de elección. |
| `client/src/data/api.ts`; `createSumApi.get`; `client.ts`, `sumApi.get` | Consultas sin payload; mock clonado, local HTTP credentials omit, legacy api. | Nuevo write requiere operación explícita y revisión; no fetch de pantalla ni red SUM. |
| `client/src/data/transport.ts`; `buildEndpointUrl`, `parseResponse`; `matriculaInformacion.ts`, `validateMatriculaInformacion`; `matriculaWire.ts`, `assertMatriculaWire` | Frontera runtime de union informativa/wire, propia/candidato separadas. | Preservar formas y errores; no fallback mock tras fallo ni deducir perfil/PP/permisos desde campos. |
| `client/src/screens/EnrollmentInfo.tsx`; `EnrollmentInfo`, `EnrollmentMessage`; ruta información | Fechas/mensajes/perfil condicional y orientación local, enlace local a reporte. | Reutilizar lectura/contexto; no es elección/confirmación. Nuevo control exige criterio/ownership; no botón universal deducido. |
| `client/src/screens/TableScreens.tsx`, rutas reportes/programación | Ubicación de tablas/reportes, consumidores localizados por CodeGraph/planes. | Candidatas a extensión focalizada al fijar migración. No nueva pantalla de reporte paralela; detalle de writes inexistente en contrato. |
| `client/src/components/Common.tsx`; `PageTitle`, `StudentSummary`, `DataTable`, `DownloadButton` | Resumen admite override; tabla ReactNode/vacío, CSV local. | Reutilizar componentes y contexto correcto. CSV no es PDF SUM. |
| `client/src/components/CourseScheduleModal.tsx`; `CourseScheduleModal` | Dialog de horarios por fila, patrón accesible/cierre/scroll. | Reutilizar patrón si compatible; no aviso M-01 ni control de cruces/cupos. Nueva interfaz de resultado debe justificar diferencia, sin duplicar horarios. |
| `client/src/components/RouteStatus.tsx`; `RoutePending`, `RouteError` | Consulta carga/error, reintento con invalidate. | Reutilizar lecturas. No determina reenvío write ante commit incierto MR-U04. |
| [MC-CONTRACT-1](../../docs/reverse-engineering/contracts/local-api/matricula-compatibility.md), [MI-CONTRACT-1](../../docs/reverse-engineering/contracts/local-api/matricula-informacion.md), [reportes-api-v1](../../docs/reverse-engineering/contracts/local-api/reportes.md), [RI-CONTRACT-1](../../docs/reverse-engineering/contracts/local-api/remaining-implementation.md) | Cinco consultas own-api, actor seed único/periodo `2026-2`; programación sin cálculo de permisos/capacidad. | Base readonly, no writes. No copiar/duplicar contratos en feature. Mapear `2026-II`/`2026-2`, perfil y fuente del reporte explícitamente antes de migrar. |

No se encontró contrato local de inscripción en el inventario pertinente auditado.
Esta conclusión no autoriza explorar rutas/backend privado SUM.

## Decisiones y alternativas

### MR-D01 — reutilizar proyectos y consultas

- **Decision**: conservar `client/`, `backend/` y revisiones readonly; planificar solo la ampliación faltante.
- **Rationale**: consultas/componentes existentes cubren documentos, programación e información; no efectos de inscripción.
- **Alternatives considered**: `server/`, contratos paralelos o seed/reporte como confirmación. Rechazadas por reutilización y ausencia de efecto write.

### MR-D02 — respuestas recibidas y N3 separados

- **Decision**: rechazo todo-o-nada, PP acumulado `>=17`/`>19`, acceso posterior, prematrícula habilitada sin descarga y reinicio por cupo son respuestas, mantenidas como testimonio/requisito según spec.
- **Rationale**: Clarifications precisa pendientes de AS-IS/dossier; falta de evidencia posterior no vuelve inexistente la respuesta.
- **Alternatives considered**: repreguntar atomicidad funcional/PP/prematrícula o declarar todo observado por entrevista. Ambas alteran estado de conocimiento.

### MR-D03 — gate local revaluado por autorización

- **Decision**: completar Phase 0/1 para L-01–L-06; MR-U conserva preguntas SUM/N3, ya no prerequisito de esas políticas locales.
- **Rationale**: el usuario autorizó todas causas, ventanas synthetic separadas, exactamente una aceptación y replay/consulta sin duplicar.
- **Alternatives considered**: restaurar gate r1 o afirmar preguntas SUM resueltas. Ninguna refleja la autorización. La parada r1 fue correcta para su entrada anterior y queda sustituida solo para diseño local.

### MR-D04 — perfil local y separación de capas

- **Decision**: diseño fijado: perfil facultad/periodo/escuela/plan/modalidad con versión/fuentes, DTO runtime → servicio → repositorio NestJS; wire separado de proyección React.
- **Rationale**: constitución IV/VI y arquitectura existente; evita FISI universal y reglas académicas dentro del parser de lectura.
- **Alternatives considered**: hardcode global o flags opacos como permisos. Rechazadas. Modelo/contrato final propios fijados; sin ORM/auth/almacenamiento durable añadido.

### MR-D05 — resultado local recuperable y commit único

- **Decision**: cola serial por run, copia candidata con publicación conjunta de matrícula/cupos/reporte/Outcome, identidad `(runId,actorId,requestId)` y comparación canónica completa; consulta sin efectos.
- **Rationale**: implementa L-03/L-04 y todo-o-nada en un backend propio de una instancia, sin cambiar lecturas readonly.
- **Alternatives considered**: lock en navegador, compensación multicurso, clave nueva por reintento o usar reporte seed. Producen carreras, duplicados o falso éxito; no satisfacen aceptación.

### MR-D06 — apariencia y mejoras

- **Decision**: M-01 solo acredita aviso del manual; error semejante con icono/causa es inferencia local autorizada. Polling, conservar elección y disabled de cruces siguen fuera de alcance.
- **Rationale**: mejoras cambian recorrido testimoniado y necesitan alcance propio; éxito no da literal de error.
- **Alternatives considered**: presentarlas como fidelidad o inventar error desde éxito. Sin sustento.

Sin consultas de framework: el diseño no requiere sintaxis/API/configuración nueva
desde documentación externa. Implementadores consultarán Context7 resolve/query si
requieren APIs de biblioteca, conforme AGENTS.

### MR-D07 — memoria por run y garantía explícita

- **Decision**: repositorio synthetic en memoria single-process; seed inicial independiente; reset interno de tests/reinicio genera UUID run nuevo, sin reset HTTP, snapshots, ORM/disco. Resultado/replay dura run completo; sesión demo no lo elimina.
- **Rationale**: suficiente para pérdida de respuesta y concurrencia del alcance local, con lifetime comprobable; run anterior devuelve RUN_CHANGED sin reenvío ni matrícula silenciosa.
- **Alternatives considered**: almacenamiento durable/base externa o memoria sin epoch. Primera amplía alcance innecesariamente; segunda confunde reinicio con unknown del mismo run. Caída entre procesos no está cubierta por durabilidad.

### MR-D08 — perfiles conocidos, synthetic y gaps

- **Decision**: perfil documental con 11–12 unknown/sin write; perfiles de tests `MR-SYN-SIS-1`/`MR-SYN-SOFT-1` y reloj/ventana synthetic identificados; toda condición faltante deja gap, sin aprobar ni inventar rechazo.
- **Rationale**: satisface L-02 e aislamiento sin completar F6/planes/equivalencias/requisitos institucionales. Testimoniado PP>=17/>19 no reescribe max19 documental.
- **Alternatives considered**: 24h implícitas, PP desconocido=0 o fallback FISI. Rechazadas por FR-015/FR-027. Bordes/timezone elegidos como mecánica local explícita, no dato SUM.

### MR-D09 — sesión simulada e incertidumbre de transporte

- **Decision**: entrada demo inicia15min; renovación explícita solo al recargar vigente; vencida necesita entrada nueva. sessionStorage conserva identidad/elección synthetic incierta; consulta/repetición manual con misma identidad, sin polling/reenvío automático.
- **Rationale**: reproduce duración/reinicio relatados identificando inicio/renew como decisión local. Abort/red/JSON no convierten resultado en rechazo; lookup disponible después de caducidad dentro mismo run.
- **Alternatives considered**: cookies/login nuevos, invalidate como reenvío o borrar solicitud incierta al expirar. Introducen auth fuera de alcance o impiden recuperación L-04.

### MR-D10 — autoridad única y reporte propio

- **Decision**: [MR-CONTRACT-2](../../docs/reverse-engineering/contracts/local-api/matricula-regular.md) canónico; feature/contracts solo enlace/UI. Prefijo nuevo own-api, reports de accepted exclusivamente, adaptación a componentes actuales sin cambiar MC/MI/RI/reportes.
- **Rationale**: DTO de elección/múltiples actores incompatible con POST readonly/body vacío; separar fuente de commit evita seed como confirmación.
- **Alternatives considered**: duplicar contrato en feature, cambiar antiguas consultas o reutilizar snapshot operador. Rechazadas por incompatibilidad, regresión y privacidad.

### MR-D11 — bootstrap de aceptación sintético aislado

- **Decision**: futuro test-app importa solo módulo propio con factories synthetic; integración UI usa shell/lecturas auxiliares de fixture independiente explícito en harness, sin conectar módulos/snapshots de procedencia desconocida. Pruebas reales own-api y efecto real; shell de contexto no acredita su integración histórica.
- **Rationale**: desactivar un env de snapshot no garantiza procedencia del resto del backend. No se inicia proceso hoy.
- **Alternatives considered**: lanzar aplicación existente por ser localhost o interceptar own-api con mocks. Primera no establece procedencia; segunda no acredita React→NestJS→estado.

## Preguntas SUM/N3 conservadas, diseño local resuelto

| ID estable | Pregunta SUM que sigue abierta | Decisión local que permite diseño |
| --- | --- | --- |
| MR-U01 | Orden/cardinalidad/evento/literal de validaciones simultáneas; B-01/Q-13/Q-14/Q-28 | L-01, todas causas conocidas en conjunto. Orden técnico estable propio, ningún primer-error académico. |
| MR-U02 | Horas oficiales11–12 y bordes/categorías; B-04/Q-25/Q-31 | L-02, pendiente sin write o perfil de tests synthetic explícito, nunca fallback. |
| MR-U03 | Resultados/ganador/momento de ambos por última plaza SUM; B-03/Q-15/Q-17 | L-03, cola/commit propio, exactly1 accepted y1 rejected, sin ganador exigido. |
| MR-U04 | Respuesta perdida tras posible registro SUM; B-05/Q-22/Q-23 | L-04, identidad/canonical payload/resultado consultable por run, replay sin efectos extra. |

Otros gaps mantienen su caso: habilitación observable/prerrequisitos/literales de referencia,
precisión/reloj, categorías, planes/oferta/equivalencias/autorizaciones, salud/deuda, momento
real de reporte. El modelo proporciona contextos synthetic conocidos o pending; no recupera
reglas desconocidas. B-01–B-06 no cerrados N3 por norma, autorización, entrevista o tests propios.

### MR-D12 — selección y retorno local completos

- **Decision**: L-05 intersección de prematrícula COMPLETA/oferta del plan; forced-known fuera de prematrícula causa propia, incompleto gap. L-06 todo rejected académico definitivo retorna/limpia elección; protocolo/pending/unknown diferenciados.
- **Rationale**: autorizaciones explícitas tras H-FID01/02, sin decidir filtrado/retorno universal SUM.
- **Alternatives considered**: unión de listas, habilitación desde lista incompleta o retorno indefinido por causa. No satisfacen autorización; polling/disabledcruce/conservar tras rechazo siguen fuera.

### MR-D13 — universo finito y accesibilidad local

- **Decision**: [catálogo](acceptance-catalog.md) con121 variantes×2escuelas, categorías MAT01–10 originales; ACC01–10 con170 celdas aplicables, foco definido, excepciones técnicas por elemento.
- **Rationale**: cierre local de H-FID04/05, preserva29FR/33AC/8SC y ramas normativas; no10casos ni certificación AA/global.
- **Alternatives considered**: porcentaje sin denominador, eliminar repitencia/unknown o aplicarACC a Inicio. Rechazadas por cobertura/alcance.

**MR-S09:** [revisión pública suplementaria](../../docs/domain/fisi/2026-II/planning-source-review-2026-10-11.md), PUB01–05, recopilada por principal. F1/F2 son reconsultas, no nuevas normas; textos públicos no prueban UI ni horas11–12. PUB04 solo publicación, anexo/vigencia/aplicabilidad no auditados. PUB05 W3C2.2 técnico para requisitos locales autorizados. Investigación usuario es entrada documental, no observado SUM.

## Cierre

Research completo para contrato y diseño local delimitado; decisiones técnicas diseñables
resueltas en MR-CONTRACT-2/modelo. Phase1 actualiza modelo, contrato MR-CONTRACT-2 y guía/catálogo; tasks posterior con autorización documental y gates satisfechos.
Sin nuevos probes, implementación, tests/build/lint, servidor o commit. Principal registra
checks documentales y workflow. Modelo efectivo mismo `sum-planner`, GPT-6.1 Sol High.

### Remediación C1/U1/I1 — alcance documental autorizado

- **Decision**: corregir vínculo AC25/AC26 y añadir ocho variantes synthetic11/12/PP0,16,17,20;
  adelantamiento del evaluador de acceso único a T007/T012 Foundation; fuentes públicas posteriores
  diferenciadas de reutilización inicial. 121variantes/242instancias,51tareas/170ACC sin expansión extra.
- **Rationale**: permite US1/MVP real antes de US2 y trazabilidad exacta de las afirmaciones de fuente.
- **Alternatives considered**: forzar eligible con mock, duplicar evaluador en US2 o completar horas
  oficiales. No satisfacen independencia/privacidad/fidelidad. Contrato2 se aclara sin cambiar wire.
