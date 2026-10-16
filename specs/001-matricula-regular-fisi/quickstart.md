# Guía futura de validación local

**Revisión:** `MR-QUICKSTART-2`, 2026-10-11. Diseño, no ejecución.
Contrato único [MR-CONTRACT-2](../../docs/reverse-engineering/contracts/local-api/matricula-regular.md),
[modelo](data-model.md), [plan r4](plan.md). Ningún endpoint, fixture, test-app o verificador
de esta funcionalidad está implementado hoy. Los pasos siguientes requieren etapa de código
autorizada y unidades MR-S01/B01–B03/C01–C02/V01 completadas, sin cambiar esta limitación.

## Prerrequisitos de toda ejecución

1. Confirmar misma revisión contractual y entradas de aceptación. Leer AGENTS raíz y de
   carpetas, scripts vigentes y configuración del harness. No producción ni exportadores.
2. MR-V01 crea aplicación NestJS **aislada**, importando solo módulo propio y factories
   independientes synthetic del modelo. No ejecutar AppModule del operador ni arrancar
   módulos alimentados por snapshots/caches de procedencia desconocida. Desactivar un env
   de snapshot por sí solo no demuestra procedencia de todo el proceso.
3. Cliente `local`, base relativa `/api`, destino solo loopback hacia ese test-app. Shell y
   lecturas auxiliares reciben fixture independiente identificado en harness, sin datasets
   privados. Own-api/solicitudes/reportes no se interceptan: HTTP y estado real NestJS.
   Esta aceptación no certifica integración histórica del shell auxiliar.
4. Catálogo/modelo known synthetic explícito, programa seleccionado por factory test (no
   parámetro HTTP de escenario). Reloj inyectado15:00Z del11 o12 de agosto según variante; ventanas14:00–16:00Z
   de ambos días, con IDs distintos, minPP0 y origin synthetic. AC-26 cubre PP0/16/17/20
   sin matrícula del día previo por cada día/escuela. Perfil documental se prueba separadamente con horas11–12 desconocidas.
5. Crear estado nuevo por caso: run UUID, occupied inicial controlado, cero sesiones/
   requests/matrículas/reportes. Conservar run para escenarios de replay; reset solo test
   interno/reinicio genera nuevo run. Registrar fixture/revisión, reloj, actor, ruta y run.
6. Un único dueño de browser, páginas/actores synthetic A/B; ningún proceso anterior,
   credencial/cookie SUM ni log/body privado. Registros muestran IDs synthetic y efectos
   mínimos; capturas locales no contienen datos del operador.

## Comandos existentes y disponibilidad

Los manifests auditados contienen estos comandos; se revisarán nuevamente antes de uso.
**No se ejecutan desde planificación.** No configuran por sí solos entorno seguro ni
implementan los nuevos escenarios. Suites globales solo tras revisar procedencia de todos
sus procesos/fixtures; el alcance es el harness aislado, no un servicio local desconocido.

```sh
pnpm --dir client build
pnpm --dir client lint
pnpm --dir client test:data
pnpm --dir backend build
pnpm --dir backend lint
pnpm --dir backend test
pnpm --dir backend test:e2e
```

`pnpm --dir client verify` existe para escenarios actuales; no acredita esta funcionalidad
ni su integración automáticamente. MR-V01 asigna **un nuevo archivo futuro**
`client/scripts/verify-matricula-regular.mjs` y `backend/test/matricula-regular-test-app.ts`.
Todavía no existen comandos de arranque/ejecución para ese harness: el implementador
documentará los efectivamente disponibles tras crearlo. No se da una llamada ficticia,
no iniciar `start:dev`/`dev:local` contra backend del operador y no ejecutar generadores
que lean entradas privadas, aunque su nombre diga synthetic.

## Universo obligatorio de aceptación

[acceptance-catalog.md](acceptance-catalog.md) es inventario cerrado de121 variantes ×2 =242
instancias funcionales y170 celdas ACC aplicables. Sus IDs y denominadores son obligatorios;
las familias de abajo son procedimientos agrupados, no universo sustitutivo de10casos.
SC002 distingue50 known normativos de16 pending que solo acreditan gap/sinwrite. Tests
requeridos por spec/usuario, a implementar/ejecutar solo en etapa de código autorizada.
Cada reporte de resultado incluye ID expandido `-SIS`/`-SOFT`; no sumar reruns al numerador.

Foundation T007/T012 completa y verifica el evaluador real de acceso Context antes de
US1. T015/T017 no esperan a T020 ni usan eligible hardcode/mock; T020 reutiliza ese evaluador.

## Escenarios y resultados esperados

Todos pendientes de ejecución. Repetir los escenarios aplicables en Sistemas y Software,
con contextos/factories propios; ningún fixture declara ser plan/oferta real FISI.

| Check / criterios | Procedimiento futuro | Resultado esperado y límite |
| --- | --- | --- |
| MR-DOC; AC-01/AC-03/AC-04/AC-06/AC-09, SC-001 | Consultar contexto/prematrícula completa, vacía y documental F6; incluir curso conocido no ofertado | Plan/periodo/doc distintos; nueve filas/grupos6/7 repetidos, 13–14 presencial; no cursos/sección inventados ni CSV=PDF SUM |
| MR-PRE; AC-02/AC-20 | Contexto con turno known permitido, primero preEnrollmentEnabled=false, luego true sin descargar | False no permite entrada/registro, true satisface solo esa precondición. Descarga no cambia flag |
| MR-SLOT; AC-05/AC-07/AC-25/AC-26/AC-29 | Perfil synthetic y test de umbral17/>19/acceso posterior; reloj antes/inicio/interior/fin | Predicado local exacto por contrato, origin synthetic visible, selección/contexto school correctos; no regla oficial del11–12 completada |
| MR-MISSING; AC-28/SC-004 | Perfil documental en11–12; perfil absent/ajeno, PP unknown | configuration-pending+gap, sin enrollment/report/cupo; calendario/documentos siguen consultables; no fallback/PP0/24h |
| MR-REVIEW; AC-08 | Elegir tres course/section del fixture, revisar créditos/horarios/plan antes de enviar | Elección12créditos distinta de registro; ningún consumo de cupo ni borrador persistido académico |
| MR-RULES; AC-10–AC-13/SC-002 | Casos11/12/26/27, excepción conocida/desconocida, prerrequisitos/plan/prioridad, condiciones institucionales y branches2/3/4 según modelo | Límites/excepciones/fuentes respetados; ramas distintas y datos unknown pending. No virtualizar procedimiento presencial/admin |
| MR-REJECT; AC-14–AC-16/AC-21/AC-24/AC-27 | Fixture conflict+full, enviar multicurso y consultar estado/reporte del intento | Causas conocidas como conjunto exactamente ambos, cero cursos/cupos/reporte nuevo; reinicio elección por cupo. Modal local sin literal inventado. Reporte previo no se borra |
| MR-ACCEPT; AC-17–AC-19, SC-003 | Sesión demo vigente y selección12 válida; submit, lookup y report HTTP/UI | Outcome accepted, courses exactos, total12, mismo enrollment/report/fecha; no impresión/visado activador ni seed fallback |
| MR-LAST; AC-15/AC-30 | A/B mismo programa válidos, tres cursos iguales y última plazaS1; envíos concurrentes con IDs distintos | Exactamente una aceptación y un rechazo SECTION_FULL, occupiedS1+1 y S2/S3+1 solo ganador; rechazado cero cursos/reporte, selección reiniciada. Ganador no predeterminado |
| MR-LOST; AC-31 | Harness deja llegar/commit submit pero suprime respuesta al cliente; luego GET misma identidad | Antes de GET resultado no confirmado; GET mismo accepted/report. Consulta no crea matrícula ni plaza extra. Simulación solo local |
| MR-REPLAY; AC-22/AC-32 | Repetir misma identidad/payload tras aceptación y tras rechazo, además concurrentemente; después cambiar payload con sameID | Mismo Outcome definitivo exacto, no efectos extra; cambio409REQUEST_CONFLICT, original intacto. Nueva elección necesita nueva identidad |
| MR-BEFORE; AC-33 | Harness corta envío antes de entrega, confirma estado inicial, GET identidad antes de procesamiento nuevo | Lookupunknown/outcomenull, sin reporte/registro; desconocido no significa rechazo ni prueba de petición queued. Repetición manual sameID posteriormente mantiene dedup |
| MR-SESSION; AC-23/SC-006 | Avanzar reloj a expiresAt; intentar nueva solicitud, nueva entrada; caso separado aceptación con respuesta perdida antes de expiración | Nuevo intentoSESSION_EXPIRED/ningún write, nueva elección al reentrar; lookup/replay de resultado ya publicado sigue recuperable dentro run. No token/auth SUM |
| MR-RESET; FR-029/SC-008 | Accepted con respuesta perdida, reiniciar/resettest para run nuevo y consultar/repetir run anterior | RUN_CHANGED, no aceptación/rechazo inventado del run destruido, no registro nuevo/reenvío automático; garantía anterior limitada al run |
| MR-BOUNDARY; contrato HTTP | Tipos/keys/query extras/duplicados, choice inexistente/sesión ajena/perfil antiguo/GET reporte ajeno | 400/404/409 según contrato, sin efectos; reportes ajenos/no aceptados no fallback. Errores no exponen valores privados |
| MR-PROVENANCE; SC-005–SC-007 | Auditar referencias de29FR/33AC/8SC, synthetic origins y límites manual/testimonio, tráfico/checks | 100 % de trazabilidad, cero privados/SUM/procesos excluidos; N3 no elevado por tests locales |
| MR-REGRESSION; MR-I10 | Suites relevantes existentes con factories de procedencia confirmada, solo lecturas MC/MI/RI/reportes | Formas/acciones/modos/errores readonly conservados, sin writes; aceptación own-api separada |

UI: no nuevo panel de vacantes actualizadas ni polling. Capacidad/occupied del contrato
synthetic sirven al harness y validación del estado real; una lectura previa no autoriza
registro. Selección retenida solo mientras resultado incierto/replay; TODO rejected académico
definitivo retorna/limpia conforme L-06. Protocolo/pending no se confunden con rechazo. RouteError.invalidate solo vuelve a leer.

## Registro de aceptación y límites

Por escenario: criterio→fixture/setup→acción→HTTP/UI→estado/cupos/reporte antes/después→
esperado→real→evidencia. Tests unitarios/mocks solo frontera/lógica; integración exige
own-api real y efecto local consultado. Build/lint no sustituyen escenarios.

SC-008 requiere AC-27–AC-33 por ambas escuelas y MR-RESET/MR-BOUNDARY para garantía concreta;
SC-003 seis recorridos básicos (éxito/cruce/cupo por escuela). N2 normativa, simulaciónN1,
fidelidadN3 se informan por separado. Quedan MR-U01–MR-U04/B01–B06 y otros gaps de referencia;
literal/error/navegación exacta y normas no comprobadas no se certifican con este harness.

ACC se verifica conforme tabla/foco del catálogo en170 celdas, con teclado/AT/zoom/reflow/contraste/targets documentados; no solo análisis automático ni Inicio general.

Cuando D1 espera «Ver reporte local», su texto es veraz y local-only; no copiar el literal
M-01 ni el indicador REDIRECCIONANDO como si ya hubiera navegación en curso. M-01 permanece
referencia documental/visual, no una obligación de texto para ese estado local.

## Inicio de implementación autorizado

2026-10-11: el usuario aprobó el despacho con plan r4 y MR-CONTRACT-2. T002 revisó los manifests actuales: comandos de arriba disponibles, nuevos verificadores aún no implementados. Setup documentado en evidence/local/matricula-regular-fisi/handoff.md y provenance.md. Las secciones futuras no son resultados aprobados.
