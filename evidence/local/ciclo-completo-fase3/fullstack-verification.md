# Verificación local de programación, prematrícula y matrícula 2027-I

Principal, 2026-11-05. Rama `docs/fase3-propuesta`, derivada de `schedule-pt1`,
base `5f9083f`. Implementación autorizada por el usuario. Commit y push de la rama
de trabajo autorizados posteriormente; sin merge a ramas principales. Plan y contrato:
[plan](../../../docs/reverse-engineering/plans/ciclo-completo-fase3.md),
[API local](../../../docs/reverse-engineering/contracts/local-api/ciclo-completo-fase3.md).

## Procedencia y alcance

Entorno construido exclusivamente con fixtures sintéticos incorporados y solicitudes
independientes creadas para esta demostración. Compose propio
`sum-fase3-final-20261105`, puerto `127.0.0.1:5280`, volumen nuevo
`sum-fase3-final-20261105_academic-drafts`. Se comprobó que el volumen no existía
antes de crearlo. El proyecto de verificación anterior se detuvo conservando su
volumen; no se borraron volúmenes ni matrículas para repetir la prueba.

No se accedió a `datos-reales/`, snapshots privados, servidores del operador ni
producción SUM. Las capturas y resultados son `observed` **locales**, no observación
de producción. Las reglas 180/90/45, preferencias horarias, inventario, adscripción
docente y calendario de marzo de 2027 son decisiones `local-only` solicitadas para
el simulador. El respaldo y los límites institucionales están en
[fuentes oficiales](../../../docs/domain/fisi/2026-II/phase3-planning-sources-2026-11-05.md).
No se presentan esos valores como normas oficiales.

Se conservan las pantallas SUM, estilos y navegación existentes. Los controles
nuevos se integran en las áreas locales autorizadas. La revisión visual local no
certifica paridad de píxeles con SUM: no hubo captura de referencia equivalente.

## Cambios y garantías

- P1/P2: demanda por paridad 180/90, objetivo 45 editable, inventario inicial de
  91 docentes y 49 ambientes sintéticos, búsqueda sin tildes ni distinción de
  mayúsculas. Tesis exige docente FISI habilitado; no altera automáticamente cupos
  ni excluye asociados. VII–X prioriza L–V 18–22; excepciones explícitas 14–22 y
  luego sábado 08–13, limitadas por disponibilidad efectiva y duración completa.
- A: activación explícita desde publicación aprobada, correspondencias por
  identificadores de origen, versión/CAS, ocupación cero y contexto independiente.
  Activar otra publicación conserva oferta, solicitudes y matrículas anteriores.
- B: se reutiliza la importación de intención y selección editable existentes;
  identifica incompatibilidades y no cambia E2 ni reserva vacantes.
- C: confirma mediante el motor existente, con créditos, prerrequisitos, turnos,
  repitencias y vacantes. Cola global y persistencia previa a visibilidad evitan
  efectos parciales y sobreocupación. La unicidad del estudiante abarca todas las
  ofertas del mismo periodo/escuela/plan; repeticiones conservan el resultado.
- Reinicio: conserva ofertas, ocupaciones, solicitudes y reportes. Invalida sesiones
  operativas y pide reingreso explícito a la misma oferta 2027-I, sin volver
  silenciosamente a 2026-II. El reloj de demostración se reinicia, declarado como
  sintético. Recuperar una solicitud no vuelve a matricular.
- Accesibilidad: los diálogos existentes conservan foco con Tab/Shift+Tab y Escape,
  sin cambiar su diseño.

Módulos principales: `shared/academic-planning-policy.*`, `shared/enrollment-offer.*`,
`backend/src/programacion-academica/`, `backend/src/matricula-regular/operational-*`,
repositorio/servicios de matrícula y prematrícula, proyecciones del dashboard;
`client/src/screens/AcademicScheduling.tsx`, `AcademicResourceEditor.tsx`,
`AcademicPublicationPanel.tsx`, login, sesión y matrícula existentes. No se creó
otro motor ni se cambió la oferta histórica 2026-II.

## Criterios y resultados

| Criterio del plan | Comprobación sintética y resultado real | Dictamen |
| --- | --- | --- |
| AC-P1 | Pruebas de datos y navegador: 56 asignaturas, 180/90 por paridad, capacidad45; cambio I/II, override123 conservado; cálculo4/2 y recuperación de borradores | Cumple local |
| AC-P2 | Casos del generador/validador: tesis con docente FISI habilitado, rechazo de adscripción desconocida/ajena, asociado admisible, sin excepción automática de capacidad | Cumple local |
| AC-P3 | 97 casos dirigidos: noche, excepciones, disponibilidad, laboratorios, cruces y duración completa antes de22:00/13:00; camino sin política conservado | Cumple local; no se afirma horario óptimo |
| AC-P4 | Navegador:91 docentes/49ambientes cargados; búsqueda por código, vacío y restauración; datos cubren tildes/mayúsculas | Cumple local |
| AC-A1 | HTTP real: publicación válida, versión, duplicado, CAS obsoleto, contexto incompatible; activación UI real envía publicación/versión/CAS exactos y crea ocupación0 | Cumple local |
| AC-A2 | Reinicio del backend Compose: mismo runId/oferta, ocupaciones y reportes; aislamiento de oferta legacy2026-II | Cumple local |
| AC-B1 | Dos intenciones desde React, agregación2 estudiantes únicos; A importa4 coincidencias exactas y cambia todo su itinerario a sección2; E2 conserva ambas intenciones | Cumple integrado |
| AC-C1 | A confirma12 créditos con motor real; suites de reglas y HTTP conservan rechazos/gaps, excepciones y turnos históricos | Cumple local/integrado |
| AC-C2 | HTTP: dos estudiantes admisibles compiten por plazas1; exactamente uno acepta, el otro rechaza por SECTION_FULL; puede escoger secciones alternativas; no supera capacidad | Cumple local HTTP |
| AC-C3 | Reenvío devuelve resultado idéntico; payload distinto409; fallo de escritura503 conserva snapshot previo; reinicio recupera resultado conocido, reporte y ocupaciones | Cumple local HTTP/integrado |
| AC-I1 | Compose+Chromium: E1 generar/revisar/aprobar/publicar vía HTTP; E2 A/B mediante UI; Escuela activa por UI; E3 A importa/modifica/confirma/reporta; reinicio y reingreso2027 | Cumple integrado |
| AC-I2 | HTTP de cambio de oferta conserva contexto anterior; periodo incompatible rechazado; pruebas aisladas de importación cubren sección ausente/ambigua/modificada/llena; E1/E2 no cambian | Cumple en niveles indicados |
| AC-V | Capturas locales revisadas: mismas pantallas/componentes/navegación; periodo2027-1, secciones1/2 legibles, reporte4 filas/12 créditos | Conservación local; paridad SUM no certificada |

La inyección del fallo de disco sustituye únicamente la escritura del adaptador.
Las solicitudes HTTP, repositorio, copia candidata, validación, motor y recuperación
son reales. Los casos de importación con secciones manipuladas son pruebas aisladas,
no observaciones de una publicación inmutable modificada en Docker.

## Ejecución reproducible y comprobaciones

Build de ambas capas aprobado; `backend exec tsc --noEmit --incremental false -p
tsconfig.json` aprobado, **0 diagnósticos** frente a106 reproducidos inicialmente
(77 en base comparable anterior). Se corrigieron tipos de pruebas/entradas negativas
sin retirar casos ni debilitar aserciones. Lint cliente aprobado; backend aprobado
con cuatro advertencias preexistentes `unbound-method` en local-profile-session.

| Comprobación ejecutada | Resultado |
| --- | --- |
| `pnpm --dir client test:data` | 222/222 |
| `pnpm --dir backend test --exclude 'test/matricula-regular-us1*' --exclude 'test/matricula-regular-us2-us3*' --exclude 'test/matricula-regular-us5-us6*' --maxWorkers=2` | 51 archivos,753/753 |
| `pnpm --dir backend test test/enrollment-offer.integration.spec.ts` | 7/7, incluida concurrencia ampliada con alternativa tras ocupar la primera sección |
| Tres archivos de navegador MR y `matricula-regular-us1.spec.ts`, secuenciales | 4 archivos,30/30:14 escenarios de navegador y16 HTTP; agregado backend783/783 |
| Contratos compartidos (`node --test shared/*.test.mjs`) | 46/46 |
| `node --test scripts/compose-config.test.mjs` | 5/5 |
| `pnpm --dir backend test test/programacion-academica-generator.spec.ts` | 97/97 |
| `env -i PATH="$PATH" HOME="$HOME" pnpm --dir backend test:e2e` | 1 aprobado;9 omitidos por ausencia de PostgreSQL/campaña sintética configurada |
| Compose: build de ambos servicios; up propio con `--no-build --wait` | Ambos servicios saludables |
| `git diff --check` | Aprobado |

La suite general se ejecutó con concurrencia acotada a dos archivos. La nueva
prueba que publica dos ofertas y reinicia excedió inicialmente el timeout genérico
de5 segundos (5,7s); se fijó30s para ese recorrido HTTP completo. La prueba de
concurrencia ampliada usa el mismo límite. La primera ejecución paralela a builds
Docker/TypeScript tuvo además timeouts por contención. No se los ocultó ni se
retiraron aserciones; la suite posterior completa aprobó. Esto no demuestra la
causa del antiguo informe595/596, que no se reprodujo como tal.

El verificador real es [verify-cycle-complete.mjs](../../../client/scripts/verify-cycle-complete.mjs).
No intercepta respuestas para sustituir APIs. Chromium1440×1000, rutas locales,
sin errores JavaScript ni solicitudes externas. E1 se ejercita por HTTP propio;
registro de intenciones, activación, importación, modificación, confirmación y
reporte se ejercitan desde React. No se afirma haber automatizado cada botón E1.

```sh
SUM_CYCLE_SYNTHETIC=1 node client/scripts/verify-cycle-complete.mjs prepare
SUM_CYCLE_SYNTHETIC=1 node client/scripts/verify-cycle-complete.mjs confirm
env -i PATH="$PATH" HOME="$HOME" SUM_PORT=5280 docker compose --env-file /dev/null -f compose.local.yaml -p sum-fase3-final-20261105 restart backend
SUM_CYCLE_SYNTHETIC=1 node client/scripts/verify-cycle-complete.mjs resume
```

Los tres pasos terminaron con código0. Estado transitorio del verificador en `/tmp`,
no incorporado al repositorio. Tras matrícula confirmada, repetir desde prepare
requiere un proyecto sintético nuevo: no se borran matrículas para eludir la
unicidad por periodo. `capture` y `resume` permiten revisar el contexto confirmado.
Se corrigió una espera del verificador: alcanzar la URL de login no implica que
el catálogo asíncrono ya haya renderizado; ahora espera el perfil antes de contarlo.

Capturas de esta ejecución:
[parámetros](parametros-planificacion.png),
[intención A](intencion-SYN-SIS-A.png),
[intención B](intencion-SYN-SIS-B.png),
[activación](oferta-activada.png),
[selección editable](matricula-2027-editable.png),
[reporte confirmado](matricula-2027-confirmada.png),
[reporte tras reinicio](matricula-2027-reinicio.png).
Se revisaron visualmente activación y reporte confirmado; el script espera la
tabla de cuatro filas antes de capturar confirmado/reinicio.

## Límites que permanecen

Respecto de la propuesta completa, el cumplimiento es parcial. El núcleo sin IA
es coherente con README sección7 y análisis sección11.7: los agentes son una capa
separable. No existe proveedor LLM conectado. El solver actual es DFS acotado en
TypeScript, no el servicio Python/CP-SAT propuesto; no acredita optimización global
de preferencias, huecos o estabilidad. Quedan el ciclo completo de rondas con
plazos/fijación/regeneración, portal docente con roles, reajuste S-5 con propuestas
y avisos, validación académica completa compartida en E2/E3 y metas de carga/piloto
institucional. La demo A/B/C aprobada no certifica toda la fase3 de la propuesta.

La persistencia operativa usa un único escritor, documentos por contexto con
checksum, validación correlacionada, escritura temporal/renombrado y fsync de
archivo conforme al almacenamiento existente. Se verificaron reinicios y fallo
de escritura, no pérdida eléctrica ni coordinación multiproceso. Corrupción
falla de forma explícita; nunca restablece ocupación cero silenciosamente.

Las nueve pruebas e2e de PostgreSQL/publicación pública permanecen omitidas: esta
entrega usa el almacenamiento local de Compose; no certifica esa infraestructura.
Inventario, antecedentes y elegibilidad son sintéticos. Cualquier uso institucional
requiere datos/autorización y validación de ámbito independientes. No se certifica
paridad visual o comportamiento de producción SUM.
