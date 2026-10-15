# Plan: matrícula regular virtual FISI 2026-II

**ID / revisión:** `MR-PLAN-1`, revisión 4, 2026-10-11.
**Rama lógica:** `001-matricula-regular-fisi`; Git existente: `jeanpzh/REA`.
**Planner efectivo:** `sum-planner`, GPT-6.1 Sol High, mismo hilo, sin subdelegación.
**Estado:** Phase0/Phase1 de diseño local completas; implementación no ejecutada ni autorizada por esta etapa. N3 pendiente independiente.

## Resumen y cambio de entrada

[Spec vigente](spec.md): 29 FR, 33 AC, 8 SC y10ACC locales; autorización L-01–L-06 permite contrato
propio para todas causas, ventanas synthetic separadas, última vacante y recuperación.
Se reutiliza auditoría r1 en [research r4](research.md), sin repetir exploración suficiente.
La parada r1 se sustituye para diseño local; MR-U01–MR-U04 siguen preguntas SUM, no gates
para las cuatro políticas propias. [Checklist](checklists/requirements.md) preservado13/16:
no certifica subcasos completos ni N3.

Reutilizar React `client/`, NestJS `backend/`, wire/consultas/componentes; nueva escritura
no usa POST readonly/body vacío ni reportes seed como registro. Autoridad única
[MR-CONTRACT-2](../../docs/reverse-engineering/contracts/local-api/matricula-regular.md),
con [modelo](data-model.md), [referencia/UI](contracts/README.md) y [guía](quickstart.md).

## Contexto técnico

| Campo | Decisión/fuente revisada |
| --- | --- |
| Lenguaje | TypeScript cliente~6.0.2/backend^6.0.2 en manifests leídos r1; rangos declarados, instalación/runtime no certificados |
| Dependencias | React19.2.8, TanStack Router1.170.41, Vite8.3.0, NestJS12.0.1 declarados; conservar, sin dependencia nueva |
| Tipo/plataforma | Réplica web/API local loopback, fixtures independientes sintéticos; no SUM/proxy SUM/auth nueva |
| Storage | Memoria singleton single-process por run UUID; seed inicial, reset interno/reinicio nuevo run, no disco/ORM/snapshots/reset HTTP |
| Capacidad/atomicidad | Cola serial por run; validación actual, copia candidata y publicación conjunta sin I/O/await check→publish; reportes/resultados de mismo commit |
| Idempotencia/recuperación | Identidad run+actor+request, payload canónico completo, mismo resultado replay; diferente payload409; lookup sin efectos, sin TTL durante run |
| Reloj/sesión | Reloj servidor inyectable; sesión demostrativa15min, reload renueva vigente expresamente; caducidad no borra resultado del run |
| Calendario | Perfil documental con horas11–12 unknown/sin escritura; pruebas con perfil/ventana synthetic marcado, sin fallback. Bordes locales explícitos en contrato |
| Testing | Scripts actuales: cliente build/lint/test:data/verify; backend build/lint/test/test:e2e. Futuro bootstrap aislado con procedencia de todo proceso, no solo env snapshot |
| Rendimiento/escala | Sin SLO/aforo inventado; un proceso, dos escuelas, éxito/cruce/cupo por escuela y casos AC27–33. Cluster/crash durability fuera garantía |

## Constitution Check, antes y después de diseño

[Constitución1.0.0](../../.specify/memory/constitution.md), [AGENTS raíz](../../AGENTS.md),
[cliente](../../client/AGENTS.md), [backend](../../backend/AGENTS.md).

| Principio/gate | Revisión r4 | Evidencia/condición |
| --- | --- | --- |
| I Fidelidad | PASS diseño local, N3 pendiente | L01–06 explícitas, M01/manual limitado, no mecanismos SUM atribuidos |
| II Trazabilidad | PASS documental | Fuentes/clases/vigencia y discrepancias preservadas; PUB-01–05 documenta reconsulta pública de F1/F2, sin runtime SUM ni nueva norma |
| III Incertidumbre | PASS local | MR-U solo N3; reglas/datos desconocidos por caso→gap/sin commit, nunca aprobación tácita |
| IV Perfil | PASS diseño | Scope/version/source exactos, documentary/synthetic separados, no fallback facultad/periodo/plan |
| V Privacidad | PASS trabajo realizado | Docs/código estático r1, cero privado/producción/browser/servidores/exportadores |
| VI Reutilización | PASS diseño | MC/MI/RI/reportes intactos; nuevo own-write incompatible con DTOreadonly, migración aislada abajo |
| VII Verificación | PASS estrategia documental, aceptación funcional pendiente | Principal registra enlaces/diff/consistencia; quickstart solo escenarios futuros |
| G-RESEARCH/G-DESIGN | PASS para alcance local L01–06 | Decisiones técnicas/lifetime/contrato/modelo/guía fijados; no pregunta local diseñable abierta |
| G-N3 | Pendiente por B01–B06 | No se promueve prueba propia/testimonio/norma a SUM observado |
| G-IMPLEMENT | Pendiente etapa separada | Contrato fijo disponible; no código/tests/dispatch/commit desde plan |

Sin excepción constitucional justificada. Ausencia de datos/autoridades reales conserva
pendientes del caso; no bloquea contexto synthetic conocido ni diseño L01–06.

## Decisiones, invariantes y migración

MR-I01 perfil/version/fuente aislados; MR-I02 prematrícula habilitada distinta de descarga;
MR-I03 todo-o-nada; MR-I04 reporte solo aceptado/curso exacto; MR-I05 capacity nunca excedida;
MR-I06 sin respuesta no significa resultado, lookup/replay por run; MR-I07 elección/documento/
registro separados; MR-I08 procedencia/N3 conservados; MR-I09 solo synthetic; MR-I10 consultas
legacy sin writes. Se añaden MR-I11 mismo payload/identidad nunca reevalúa, distinto409;
MR-I12 run anterior RUN_CHANGED sin reenvío automático; MR-I13 unknown/gap no causa ficticia,
ningún commit cuando gap; MR-I14 report/request/cupos publicados juntos.

Auditoría r1 localizada con CodeGraph y lecturas focalizadas: `validateMatriculaWire`,
`ReportesRepository/Service`, `MatriculaInformacionService`, `createSumApi.get`,
`parseResponse`, `EnrollmentInfo`, `Common`, `RouteStatus`, `CourseScheduleModal`.
Detalle reutilizable permanece en research; no repetir certificaciones históricas.

Reutilizar [MC](../../docs/reverse-engineering/contracts/local-api/matricula-compatibility.md),
[MI](../../docs/reverse-engineering/contracts/local-api/matricula-informacion.md),
[RI](../../docs/reverse-engineering/contracts/local-api/remaining-implementation.md) y
[reportes](../../docs/reverse-engineering/contracts/local-api/reportes.md) solo como lecturas.
Migración incremental: nuevo módulo/transport propio de comandos, mismo proxy `/api`;
ningún cambio de contrato/envelope/modos existentes. Reporte de write en ruta propia con
proyección a `StudentSummary`, `DataTable`, `DownloadButton`; no pantalla paralela para
reporte legacy. El nuevo context scope `2026-II` no altera periodo legacy `2026-2`.

Ruta cliente local propuesta `/local/matricula-regular`, selector de actor synthetic;
reporte `/local/matricula-regular/reporte/$enrollmentId`. Root shell histórico puede usar
fixture auxiliar independiente en harness; no derive identidad/reglas own-api del shell.
Componentes `PageTitle`, `StudentSummary`, `DataTable`, `RoutePending`, `RouteError` y patrón
dialog accesible reutilizados. RouteError.invalidate solo lecturas. Modal propio de resultado
justificado por causas/estado distintos del modal de horarios; no duplicar horarios.

## Artefactos y ownership

```text
specs/001-matricula-regular-fisi/
├── spec.md                                  # actualizado
├── checklists/requirements.md               # preservado
├── plan.md / research.md                    # revisión4
├── data-model.md / quickstart.md             # Phase1
├── contracts/README.md                      # enlaza autoridad, UI propia
├── acceptance-catalog.md                    # universo funcional/ACC
└── tasks.md                                 # tareas futuras, no ejecución

docs/reverse-engineering/contracts/local-api/matricula-regular.md
```

Tasks se generan después de gates locales y setup del principal; no ejecutan código. Propiedad documental ampliada: spec/catálogo/tasks y artefactos anteriores; sin implementación. Principal
posee workflow/checks; otros contratos/fuentes/config/código/fixtures/tests sin cambios.
Hooks ausentes según setup del principal; mismo feature/rama, sin nuevo setup destructivo.

## Cierre documental local y catálogo

L-05/L-06 cierran selección/admisión/retorno locales: intersección completa y cause propio
para forzado conocido fuera de prematrícula; incompleto gap, cualquier rejected académico
reinicia/retorna. N3 no cambia. [Catálogo finito](acceptance-catalog.md):121 variantes ×2 =242;
SC00122, SC00250 known +16gap separados, SC0036, SC00412, SC00580 entradas, SC006/007242,
SC00822 instancias. ACC subconjunto solo feature:170 celdas, foco/modal/ruta definido; no
certificación AA/Inicio. Fuente [revisión pública](../../docs/domain/fisi/2026-II/planning-source-review-2026-10-11.md).

H-FID01 selección,02 retorno,03estado,04denominadores,05ACC quedan atendidos en artefactos
propios para reevaluación del principal, no marcados por planner en checklist. Gates local
spec/modelo/contrato/research completos; pruebas de aplicación aún no ejecutadas.

## Unidades futuras para Luna High

[Tasks](tasks.md) fija51 unidades ordenadas y sus archivos exactos, con constraints literales
C-T004/C-T006/C-T007/C-T030/C-T037. Es autoridad de ownership/dependencias de implementación;
las unidades MR de r2 se conservan como agrupaciones, no listas paralelas de candidatos.
MR-P01/P02 diseño completo r4; MR-S01=T006; MR-B01=perfil/reglas T004/T025/T030; MR-B02=store
T007/T008/T035; acceso Context/windows único T007 antes de US1 y test T012; T020 solo consume función. MR-B03=HTTP T015/T022/T036/T042; MR-C01=T009/T043/T044; MR-C02=paneles/rutas
T010/T016/T021/T026/T031/T037/T038/T045; MR-V01=bootstrap T011 y aceptación T047–T051.
T013–T046 incluyen tests/aceptación por historia. Estado todo código pendiente, no dispatch.

Tres Setup +9 Foundation; US1/2/3/4 cinco tareas cada una, US5/6 siete, Final cinco.
Shared antes de capas; backend/client disjuntos, mismo archivo por historia solo secuencial;
parejas [P] de tests backend/client con prerequisitos completos, máximo 2 workers sin delegar.
Bootstrap test propio usa puertos5741/5742 y proxy de test separado; abortar ocupado sin
conectarse a servicio ajeno. No modificar configuración de ejecución del operador.
Todas242 instancias/170 ACC y SC002known/pending tienen tasks y resultados esperados; no
porcentajes sin universo ni testsmocks sustituyendo integración real de own-api.

Root debe entregar AGENTS raíz/carpeta, skill propia `sum-nestjs-implement` o
`sum-react-implement`, revisión fixed, archivos anteriores, restricciones y tests exigidos.
Luna High no delega ni edita otro módulo/contrato/raíz. C02/B03 podrían paralelizar con
contrato fijo/S01 completo y listas disjuntas; browser de integración único/secuencial.
Bootstrap test aislado evita fuentes desconocidas del resto de AppModule. Mock solo de
shell/lecturas auxiliares no acredita su integración, own-api nunca mock en fullstack.

## Aceptación y verificaciones futuras

[Quickstart](quickstart.md) mapea AC01–33 y SC001–008, incluye all-causes, missingwindow,
synthetic origin, exactly1/1, lostresponse, same/differentpayload, fail-beforecommit,
expiredsession y reset/run. Todos **no ejecutados**. Normas/testimonios/gaps por caso se
verifican separados; pasos de proceso excluidos y mejoras de polling/conservación de elección fuera.

Comandos existentes en manifests r1: cliente build/lint/test:data/verify; backend
build/lint/test/test:e2e. Solo etapa futura autorizada, tras confirmar procedencia de
**todo** proceso/scenario e inspeccionar scripts. Compilar/lint/mocks no acredita integración.
Principal registra checks documentales actuales y preservación de entradas. Sin tests,
servidores, browser, nuevos probes, implementación o commit en esta etapa.

## Complejidad y razón de Sol

Impacto alto: sobreasignación, cursos parciales, falsa confirmación por seed, duplicados
tras timeout/reset. Sol fijó identidad/lifetime/serialización y compatibilidad de fuentes;
Luna recibe unidades acotadas ya diseñadas. MR-U no fue respondida como SUM: autorización
local permite mecanismos propios con garantías limitadas al run y N3 independiente.

Remediación acotada C1/U1/I1: AC25 primerturno PP>19; AC26 ocho variantes synthetic ambosdías/PP0,16,17,20;121variantes/242instancias. Acceso Context termina en Foundation; fuentes históricas y revisión vigente distinguidas.51tareas/170ACC intactos, contrato2 sin cambio wire, ninguna ejecución funcional.
