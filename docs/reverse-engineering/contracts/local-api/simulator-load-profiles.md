# SIM-LOAD-2 — perfiles sintéticos de carga

2026-10-19; decisión local-only. Extiende el manifiesto interno de SIM-PUBLIC-1 sin cambiar rutas HTTP, DTOs, UI SUM ni el modo local/scenarios. Datos construidos desde fixtures sintéticos independientes; jamás snapshots ni SUM. Planificación principal; implementación Luna High. Preservar fidelidad visual e interacción SUM; ninguna pantalla React puede cambiar.

Revisión 2026-10-22 (P0-07a de `docs/performance/plan.md`, aprobada por el usuario): límite de población 1..2000 y perfil `fisi-schools` con manifiesto de jornada. Sigue sin cambiar rutas, DTOs, frontend ni los perfiles existentes.

## Configuración y manifiesto

- `SIMULATOR_ACTOR_COUNT`: entero 1..2000 (antes 1..1000), default100 por compatibilidad. Los escenarios nuevos usan400identidades distintas. El límite cubre la jornada FISI de 1422 alumnos más la Escuela de IA; no afirma capacidad para 2000 concurrentes.
- `SIMULATOR_SCENARIO_PROFILE`: `shared` (default), `ample`, `last-seat`, `multi-uniform`, `multi-hotspot`, `fisi-schools`, `distributed` (legacy). `SIMULATOR_CONTENTION` sigue admitiendo shared/distributed; perfil explícito prevalece y manifest.contention es shared salvo distributed. Configuración validada antes de mutarBD.
- Shared: curso1capacidad10; otros cursoscapacidadactorCount. Todos eligen las3secciones. Ample: capacidadactorCount en todas. Last-seat: curso1capacidad10 y otroscursoscapacidadactorCount+9;9alumnos auxiliares previamente matriculados usando el store real, fuera de manifest.actors;400contendientes nuevos. Nunca occupied sin enrollment/items/report/request.
- Multi-uniform/multi-hotspot: mismo catálogo fijo de5secciones porcurso, cada seccióncapacidad20 en curso1, actorCount en otros. Uniform asigna actor index%5; hotspot asigna80%algrupo0 y20% repartido grupos1..4. Selección de3cursos consistente porgrupo. Para400: uniform100aceptados,hotspot100aceptados; hotspot otrosgrupos20actorescadauno. Distribución calculable desde manifest, no solo por nombre.
- Manifest existente conserva campaignId/runId/actors[{actorId,credential,selection?}]/selection?/contention/expectedAccepted. Campos nuevos: actorCount, scenarioProfile, initialEnrollments, initialRequests, expectedRejected, capacityBySection (array `{courseId,sectionId,capacity,initialOccupied}`), opcional seed metadata. expectedAccepted cuenta solo nuevos actores del manifiesto; last-seat1. expectedRejected=actorCount-expectedAccepted.
- Preflight: expectativas compatibles con catálogo, elecciones válidas y únicas; manifest legado100 sigue válido. Ningún consumer exigeexactamente100. Las identidades sintéticas siguen SYN-* y credenciales43base64url; no se imprimen.
- Campaña4h porfixture; runners crean campaña fresca para cada escenario. Sesión15min: pruebas sostenidas renuevan sesión académica y reautentican antes de expirar, manteniendo identidad porVU.

## Perfil `fisi-schools` y jornada FISI (revisión 2026-10-22)

**Procedencia.** `testimony`: conteos agregados aportados por el operador el 2026-10-22, tomados del PDF institucional público [Ranking de promedio ponderado por escuelas, matrícula 2026-I](https://sistemas.unmsm.edu.pe/site/images/Ranking_promedio_ponderado_por_Escuelas_-_Matr%C3%ADcula_Semestre_2026-I.pdf). Solo se usan agregados por franja y escuela; el contrato no contiene ni deriva identidades. Los conteos son de 2026-I; que la distribución se parezca entre semestres es un supuesto `local-only`. Los cortes de PP coinciden con el dossier FISI 2026-II ([as-is-process.md](../../../domain/fisi/2026-II/as-is-process.md)). El perfil dimensiona la carga del simulador y no acredita comportamiento del SUM.

**Tabla de pesos** (alumnos nuevos habilitados al abrir cada franja; total 1422):

| Franja | Etiqueta | PP desde | Sistemas | Software | Ciencia de la Computación | Total |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 06:00 | 17.00 | 16 | 7 | 1 | 24 |
| 2 | 08:00 | 16.00 | 67 | 40 | 6 | 113 |
| 3 | 10:00 | 15.00 | 135 | 137 | 21 | 293 |
| 4 | 12:00 | 14.00 | 286 | 203 | 18 | 507 |
| 5 | 14:00 | 13.00 | 201 | 96 | 16 | 313 |
| 6 | 16:00 | 12.00 | 77 | 34 | 6 | 117 |
| 7 | 18:00 | 11.00 | 16 | 12 | 3 | 31 |
| 8 | 20:00 | 10.00 | 3 | 7 | 3 | 13 |
| 9 | 22:00 | 0.00 | 3 | 5 | 3 | 11 |

La cantidad de la Escuela de IA no consta en la fuente. Es un parámetro y vale 0 por defecto.

**Configuración** (solo con `SIMULATOR_SCENARIO_PROFILE=fisi-schools`; con otro perfil, cualquiera de estas variables es un error de validación, para no ignorarla en silencio):

- `SIMULATOR_FISI_FRANJA`: `1`..`9` o `jornada`; default `4` (pico de las 12:00).
- `SIMULATOR_FISI_IA_ACTORS`: entero 0..actorCount; default 0.
- `SIMULATOR_FISI_CAPACITY`: `ample` (default) o `scarce`.
- `SIMULATOR_FISI_SCARCE_RATIO`: decimal en (0, 1), default `0.5`; solo se admite con `scarce`.
- Toda la configuración se valida antes de mutar la BD.

**Reparto determinista (resto mayor).** Para repartir un total T según pesos w_i con suma W: cada celda recibe ⌊T·w_i/W⌋. Las R unidades restantes van, una a cada una, a las R celdas con mayor parte fraccionaria. Los empates se resuelven por orden de celda: franja ascendente y, dentro de ella, Sistemas, Software, Ciencia de la Computación.

- **Modo franja k:** IA recibe `SIMULATOR_FISI_IA_ACTORS`. Las otras actorCount − IA identidades se reparten entre las tres escuelas con los pesos de la fila k. Si actorCount coincide con el total de la fila y no hay IA, los tamaños son exactos: la franja 4 con 507 da 286/203/18. Ejemplo verificable: la franja 4 con 400 da 226/160/14. No hay oleadas; es una sola ráfaga.
- **Modo `jornada`:** las actorCount − IA identidades se reparten con un único resto mayor sobre las 27 celdas franja × escuela. Con 1422 y sin IA, el resultado es la tabla exacta. Las identidades de IA se reparten entre las 9 franjas con los pesos de la columna Total; es una inferencia `local-only`, porque la fuente no da la franja de IA.

**Catálogo y selección.**

- Todos los actores se clonan de la plantilla sintética SISTEMAS: el `scope`, el perfil y la revisión no cambian. La cohorte es una etiqueta de carga, no un cambio de escuela académica.
- Los IDs siguen `SYN-SIS-U####`, numerados en orden de oleada ascendente y, dentro de cada una, por cohorte (`SIS`, `SOFT`, `CC`, `IA`).
- Cada cohorte no vacía tiene su propio grupo de tres secciones, una por curso del fixture: `<courseId>-FISI-<SIS|SOFT|CC|IA>`. Todos sus actores eligen ese mismo grupo: hay una selección compartida por cohorte, y las cohortes son disjuntas por sección. Una cohorte vacía no crea secciones.
- En modo jornada, la cohorte comparte su grupo durante toda la jornada.
- Capacidad `ample`: todas las secciones de la cohorte tienen capacidad igual a su tamaño total, así que todos son admitidos. Es la ruta más larga de la transacción y, por tanto, la cota pesimista de t_cs.
- Capacidad `scarce`: la sección del curso 1 de cada cohorte tiene capacidad max(1, ⌊tamaño × ratio⌋); los otros cursos, el tamaño total.

**Admisiones esperadas.** `expectedAccepted = Σ_cohortes min(tamaño, capacidad del curso 1)`; con `ample` es actorCount. `expectedRejected = actorCount − expectedAccepted`, y `initialEnrollments = initialRequests = 0`. Ejemplos verificables:

- franja 4 con 507, `ample`: 507 admitidas y 0 rechazadas;
- franja 4 con 507, `scarce` 0.5: capacidades 143/101/9, 253 admitidas y 254 rechazadas.

En jornada con `scarce`, el total de admisiones es determinista, pero no qué oleada obtiene los cupos. Esto depende del orden real de llegada y el contrato no lo fija.

**Manifiesto.** Conserva los campos existentes y añade solo en este perfil:

- `cohorts`: `[{cohort, size, capacity, sectionIds, expectedAccepted}]`;
- `fisi`: `{mode: 'franja'|'jornada', franja?, iaActors, capacityMode, scarceRatio?, sourceId: 'FISI-RANKING-2026-I'}`;
- `hotCohortSize`: la cohorte más grande; en jornada, la mayor cohorte dentro de una misma oleada;
- en jornada, `waves`: `[{wave, label, ppFrom, size}]`;
- en cada actor: `cohort`, y además `wave` (1..9) en jornada.

El ritmo de las oleadas (`WAVE_INTERVAL`, `WAVE_FRONTLOAD`) pertenece al escenario k6 (P0-08), no al manifiesto. El calendario del seed conserva la ventana sintética única con `minPp: 0`: las oleadas no reproducen en el backend la regla de PP por franja, y esa simplificación es `local-only`. Los manifiestos de los perfiles existentes no cambian.

## Escenarios HTTP k6

- `enrollment.js`: una vuelta por actor, barrera configurable, conteos delmanifest, p95submit<2s/p99<5s como objetivos locales explícitos configurables; desfase de barrera reportado y acotado; ninguna identidad reutilizada entreVUs.
- `login.js`: todos actores únicos inician dentro de5s;400logins+context/session y completions esperadas;0errores inesperados.
- `mixed.js`:400VUs (uno poractor), pausas1–5s, acciones70%consulta20%preparación10%confirmación; máximo1primer envío poractor, resultado académico conocido. Posterioresacciones leen estado; no reintentos masivos accidentales. Duración default10min, override para humo; resultados SQL deben correlacionarse con métricas reales.
- `retry.js`:400actores en campañaample; primer resultadoaceptado, dobleclick/replay concurrente delmismoUUID, payloaddistinto409REQUEST_CONFLICT, UUIDnuevoALREADY_ENROLLED, recuperaciónconsultando requestId trasdescartar respuesta. Poractor1matrícula y1rechazo nuevo =>800requests finales. MismoUUID noagrega solicitudes. Comparar payload completo canónico; verificar reportes/estado.
- `resilience.js`:400sesiones, lecturas durante interrupción controlada; solo fallos transport/502/503/504 esperados, no aceptar401/403 u otros silenciosamente; alfinal todos recuperanlecturas. Métricas fallos transitorios separadas, tiempo recuperación. Orquestador restaura servicios en trap; SQL sin efectos de escritura. Crash de matrícula a mitad de transacción se verifica adicionalmente con arnés determinista existente adaptado a runtime actual.
- `sessions.js`: escalones50→100→200→400, manteniendo identidad porVU, pausas; default10min mantenimiento; permite duración menor explícita parahumo y label modo. Complementar `reads.js` con llegadaabierta, población según manifiesto. No afirmar400concurrentes por fijar RATE400.
- `recovery.js` existente conserva alcance y usa configuración nueva sin romper legado.

## Operación, observabilidad y aceptación

Un Compose existente; `bash load/scenarios.sh <login|race|last-seat|ample|mixed|multi-uniform|multi-hotspot|retry|resilience|stress|soak|all>` prepara campañas400, conserva históricas y genera testidUUID, k6summary/log privado, auditoría y URLGrafana. Permite duración reducida explícita para aceptación rápida sin llamarla soak30min. Antes de cerrar campaña auditar conteos reales delservicio; no asumir100ni borrarvolúmenes. Fallo retorna exit distinto0 y restauraAPI/DB. Cadaescenario incluye perfil/carga/escenario en tags agregados, nunca actor/session/credential. Default `docker compose run --rm k6` sigue matrícula de campaña actual.

Collector interno scrapea JSONoperativo autenticado de ambasAPI y expone métricas Prometheus sin secretos/identidades: up,CPU acumulada,RSS,eventloop,poolcola/idle/total,esperasDB. Grafana añade paneles operativos, conserva consultas k6 y sirve puntos aislados. No publicar exporter,API niDB alhost.

Aceptación principal: build/lint backend, pruebasunitarias perfiles/validación/runners, Composeconfig, escenarios nuevos reales400 poractor y auditoríaSQL porcampaña, ambosmulti comparables, crashrollback/replay y falloAPI/DB conrestauración, sesiónrenovada enprueba>15min o reportar límite si solo humo, navegador real2–5usuarios sobreUI sinrediseño, Grafanaframes reales+métricasoperativas. No afirmar carga máxima absoluta ni equivalencia Oracle/SUM. Ejecuciones reducidas documentadas separadamente de largos runs pendientes.
