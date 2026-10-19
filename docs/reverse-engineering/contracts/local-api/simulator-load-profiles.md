# SIM-LOAD-2 — perfiles sintéticos de carga

2026-10-19; decisión local-only. Extiende el manifiesto interno de SIM-PUBLIC-1 sin cambiar rutas HTTP, DTOs, UI SUM ni el modo local/scenarios. Datos construidos desde fixtures sintéticos independientes; jamás snapshots ni SUM. Planificación principal; implementación Luna High. Preservar fidelidad visual e interacción SUM; ninguna pantalla React puede cambiar.

## Configuración y manifiesto

- `SIMULATOR_ACTOR_COUNT`: entero 1..1000, default100 por compatibilidad. Los escenarios nuevos usan400identidades distintas.
- `SIMULATOR_SCENARIO_PROFILE`: `shared` (default), `ample`, `last-seat`, `multi-uniform`, `multi-hotspot`, `distributed` (legacy). `SIMULATOR_CONTENTION` sigue admitiendo shared/distributed; perfil explícito prevalece y manifest.contention es shared salvo distributed. Configuración validada antes de mutarBD.
- Shared: curso1capacidad10; otros cursoscapacidadactorCount. Todos eligen las3secciones. Ample: capacidadactorCount en todas. Last-seat: curso1capacidad10 y otroscursoscapacidadactorCount+9;9alumnos auxiliares previamente matriculados usando el store real, fuera de manifest.actors;400contendientes nuevos. Nunca occupied sin enrollment/items/report/request.
- Multi-uniform/multi-hotspot: mismo catálogo fijo de5secciones porcurso, cada seccióncapacidad20 en curso1, actorCount en otros. Uniform asigna actor index%5; hotspot asigna80%algrupo0 y20% repartido grupos1..4. Selección de3cursos consistente porgrupo. Para400: uniform100aceptados,hotspot100aceptados; hotspot otrosgrupos20actorescadauno. Distribución calculable desde manifest, no solo por nombre.
- Manifest existente conserva campaignId/runId/actors[{actorId,credential,selection?}]/selection?/contention/expectedAccepted. Campos nuevos: actorCount, scenarioProfile, initialEnrollments, initialRequests, expectedRejected, capacityBySection (array `{courseId,sectionId,capacity,initialOccupied}`), opcional seed metadata. expectedAccepted cuenta solo nuevos actores del manifiesto; last-seat1. expectedRejected=actorCount-expectedAccepted.
- Preflight: expectativas compatibles con catálogo, elecciones válidas y únicas; manifest legado100 sigue válido. Ningún consumer exigeexactamente100. Las identidades sintéticas siguen SYN-* y credenciales43base64url; no se imprimen.
- Campaña4h porfixture; runners crean campaña fresca para cada escenario. Sesión15min: pruebas sostenidas renuevan sesión académica y reautentican antes de expirar, manteniendo identidad porVU.

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
