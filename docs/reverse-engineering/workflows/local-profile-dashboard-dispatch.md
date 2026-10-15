# Dashboard local con perfiles y sesión compartida

Fecha: 2026-10-14. Run Orca: `run_e1fc9af07465`.

## Encargo y autorización

El usuario pidió integrar el flujo aislado en todo el dashboard y autorizó continuar delegando. Requisitos: inicio local con perfiles preconfigurados; una sesión de 15 minutos desde entrada; identidad y datos coherentes en todas las pantallas; reutilización de la matrícula desde «Ver matrícula»; prematrícula habilitada y reglas vigentes como condiciones, reporte solo tras aceptación. Es diseño propio `local-only`, sin afirmación de autenticación SUM o paridad N3.

Se preservan las 42/51 casillas aceptadas y nueve pendientes de la feature 001. Esta ampliación tendrá IDs propios y no borra los pendientes anteriores. El pedido actual revoca la pausa para el trabajo asignado. No modifica permisos de datos o producción.

## Despacho previsto

1. Planner `sum-planner`, Codex GPT-6.1 Sol High: diseño, plan, contrato y tareas persistentes; solo documentos.
2. Routing vigente por preferencia explícita del usuario: backend Claude Sonnet High y frontend Codex GPT-6 Luna High en worktrees aislados, archivos disjuntos. Decisiones difíciles a Claude Opus High. Paquetes de al menos cuatro unidades lógicas cuando las dependencias lo permitan. La transferencia histórica se registra abajo.
3. Antigravity: pruebas/fixtures o verificación acotada independiente cuando se libere una plaza; comprobar configuración real antes de atribuir modelo/esfuerzo.
4. Principal: adopción del contrato, integración de entregas y aceptación sintética real; conservar contador de reparaciones y cierre/liberación de workers.

Máximo dos workers concurrentes; sin subdelegación. Ningún implementador modifica arbitrariamente spec/plan/contratos. Navegador con propietario único. Fuentes sintéticas independientes y código no privado; `datos-reales/` y accesos indirectos prohibidos.

## Estado

- Orca comprobado: runtime ready/reachable, versión 1.4.223, runtime `8d5aadd8-b969-4e51-a693-e5c7ce608e9d`.
- Validador global de routing falla por defaults efectivos distintos; no acredita catálogo. Se solicitará selección explícita al launcher y se revisará su receipt; no se afirma cambio del modelo del coordinador.
- Planner documental: `task_f82812f52590` / `ctx_6e1dc9e5d954`, terminal `term_387582d9-6a4f-4fcb-aec0-e1b903cd1f1b`; receipt `turn_started`, modelo efectivo `gpt-6.1-sol`, esfuerzo `high`.
- Nueva preferencia expresa: decisiones difíciles a Claude. Propietario de decisiones: `task_6cc52ede9c46` / `ctx_9157662c17e0`, terminal `term_6aa6a363-0afa-4d6e-b214-1e1d0398e7f9`; receipt `turn_started`, modelo efectivo `opus`, esfuerzo `high`. Solo escribe `docs/reverse-engineering/plans/local-profile-dashboard-decisions.md`. El planner recibió la actualización y conserva el borrador documental, sin aprobación arquitectónica final.
- Worktrees nuevos: `../sum-dashboard-api` y `../sum-dashboard-ui`, ambos creados por Orca como hijos de REA desde `jeanpzh/REA`. La creación UI devolvió desconexión, pero un listado posterior confirmó positivamente su existencia; no se duplicó la creación.
- Baseline API: 607 archivos permitidos copiados desde el estado actual, incluyendo fuente no committeada. Manifiesto SHA256 en `evidence/local/local-profile-dashboard/api-baseline.json`. Se omiten privados, entornos, dependencias, compilados y symlinks; dependencias existentes se enlazan explícitamente y excluyen del índice. No se altera trabajo histórico.
- Implementación global: pendiente de reconciliación Claude y GO de raíz. LP-R1 independiente ya asignada.
- Pruebas de aplicación de esta ampliación: aún no ejecutadas.

## Actualizaciones de coordinación

- El usuario eligió explícitamente «Selector de perfiles sencillo»: formulario local con cuatro perfiles; no se requiere recrear el login SUM para esta ampliación. También pidió consultar comportamientos o interfaces desconocidos antes de inventarlos; los workers reciben esa instrucción mediante ask/reply.
- Planner entregó los seis documentos DRAFT y `worker_done` succeeded. No se ejecutó código desde esa etapa. Claude recibió ownership exclusivo posterior de esos documentos para reconciliar sus decisiones antes del contrato definitivo.
- Release de `ctx_6e1dc9e5d954` devolvió `retained/user_takeover/processAction:none`. Se respeta esa propiedad; no se afirma que el terminal haya sido cerrado ni se fuerza un cierre.
- Primer intento de iniciar API con selector POSIX falló en preflight `selector_not_found`; listado de tasks confirmó que no se creó tarea/dispatch adicional. Corrección: usar el ID completo exacto devuelto por Orca, incluida su ruta UNC, sin cambiar ejecutable ni crear duplicados.
- Paquete API preparado: LP-R1 independiente primero; LP-S1 y LP-B1–B4 solo después de GO explícito tras Claude. Archivos y pruebas exclusivos en `local-profile-dashboard-api-brief.md`; no navegador ni bootstrap/operator AppModule.

- Worker API confirmado: task_45925d9b6f4e / ctx_b155e4895684 / term_f7cb2730-3256-497e-814b-3f799010d90d; receipt turn_started y modelo/esfuerzo efectivos gpt-6-luna/high. LP-S1 y LP-B1–B4 siguen bajo gate explícito.

- R1 aclaración respondida msg_ce050cc7d421: cinco archivos autorizados, incluida selection.rules.ts, para ordenar tres caminos con el mismo contrato MR2; sin cambio normativo.
- LPD-DEC-1 de Claude publicada con diseño local: logout cliente sin endpoint nuevo, perfil personal explícitamente no disponible, recovery MR2 ya tiene namespace por actor/run y reloj sintético que avanza. Reconciliación documental en curso; no se envió GO global todavía.

## Cambio de routing solicitado por el usuario

El usuario prefiere **backend a Claude y UI a Codex**. Codex API ctx_b155e4895684 y Sonnet UI task_1b41bb140de6 / ctx_daaf5d87a8ef (term_7bf19600-02b8-4baf-87e9-e54ad41a457c) reciben orden de cerrar en checkpoint y entregar handoff conservando cambios. No iniciar sustitutos hasta settlement de cada responsable, para mantener exclusividad y máximo dos workers. Se reutilizarán los mismos worktrees y tareas con retry-of, con diagnóstico explícito de transferencia por routing, sin reiniciar implementación ni repetir S1/R1. Claude Opus mantiene decisiones difíciles; implementación backend Claude Sonnet High, UI Codex Luna High.

LP-R1 y LP-S1 ya se aceptaron en raíz; 198 tests backend y7 shared, build/lint backend PASS. LP-B1–B4 y F1–F4 no se aceptan por esta reasignación.

- Seguimiento de transferencia: terminal UI confirmó lectura del cambio y escritura del reporte. Codex seguía creando archivos y su último check limitaba salida a1000 tokens; posible ocultamiento de instrucciones posteriores. Tras leer su terminal se envió un único aviso de atención con interrupt para revisar inbox completo/ack, sin crear tarea nueva ni cambiar autoridad. No se cerraron procesos ni se inició editor duplicado.

- UI transferencia settled: ctx_daaf5d87a8ef reportó failed voluntario, dejó dos pruebas RED y reporte; cero F2–F4. Release retained/user_takeover, sin cierre forzado. Retry de MISMA task_1b41bb140de6 iniciado como Codex gpt-6-luna/high: ctx_77c3f47f443c, term_1b6e6708-55e2-4705-9d59-e95a9956d00a, receipt turn_started. Worktree UI y avances conservados.
- Aviso de atención a API: primer comando --interrupt con --wait-submit fue rechazado en preflight; se corrigió quitando la combinación incompatible, sin duplicar input. Segundo receipt accepted:true (351bytes); se conserva coordinación/autoridad de ctx_b155e4895684 y no se lanzó sustituto API aún.
- Helper de inbox completo asignado a ambos worktrees en evidence/local/local-profile-dashboard/orca-inbox.py: no auto-ack; procesar todos los mensajes y ack explícito antes de volver a consultar.

- API publicó reporte ampliado antes del settlement: B1–B4 implementados, 224 tests combinados/9 archivos, build/lint PASS (4 warnings unbound-method en test B1). Se conserva íntegramente. Aún falta aceptación/revisión del responsable Claude y verificación real React/Nest; no se cambian casillas B1–B4 por el reporte solo. El cambio de routing no autoriza desechar la implementación ya verificada.

- API Codex settled succeeded ctx_b155e4895684: entrega final reporta225 tests backend +7 Node, build/lint PASS, cuatro warnings en test B1; R1/S1 y todo B1–B4 conservados. Su release devolvió retained/user_takeover. No se reintenta task completada.
- Nuevo trabajo distinto de backend-finalización/V1 infraestructura asignado a Claude Sonnet High: task_c233d9a7d60f / ctx_2aa9bd01fd21 / term_5e299fb7-66b9-4662-a049-6d949d3f2930, receipt turn_started. Propiedad: B1–B4 para revisión/ajustes necesarios y cuatro archivos V1 explícitos (test-app, bootstrap.spec, Vite config sintético, script de arranque). No reimplementación ni pruebas repetidas por simple cambio de propietario; UI Codex conserva exclusividad de sus archivos.
- El backend queda efectivamente a cargo de Claude y UI a Codex, con dos workers activos. Antigravity para runner acotado/visitas cuando haya plaza, sin tercer implementador concurrente.

- Backend/bootstrap17 archivos integrados con guards de baseline y manifesto SHA256; raíz build/lint exit0 (4 warnings),10 archivos/236 pruebas PASS. Protocolo aclarado por raíz: actor fuera de cuatro literales falla estructura400; literal reconocido ausente del run da404. Sin cambios de wire o S1.
- UI31 archivos integrados con guards de baseline y SHA256. Raíz test:data141/141 PASS; build con config sintético y lint en comprobación.
- Antigravity no ejecutó Task: task_b7a3a4367b97 / ctx_a47b8675e069 falló agent_readiness por agent-trust-workspace. Release retained/user_takeover; no se acepta confianza ni se cierra por fuera del recovery. Fallback Codex autorizado por configuración permitida, comunicado al usuario. Retry reutiliza terminal UI probado y task existente; primer intento con --terminal sin --worktree fue rechazado preflight terminal_worktree_mismatch, sin nuevo dispatch; corrección usa ID completo exacto UI.

- Reuso del terminal Codex settled fue rechazado agent_unconfigured pese a agentIdentity codex; ningún nuevo dispatch. Se preservó ese terminal y se inició retry explícito de la misma tarea fallida con launcher Codex nuevo en el mismo worktree UI: ctx_deee151071a9 / term_98cf3de0-b8f6-4ff0-9127-76d4de9a71da, efectivo gpt-6-luna/high y receipt turn_started. No editor de aplicación duplicado: todas las entregas anteriores settled. GO-FULLSTACK enviado con propiedad exclusiva de navegador y runner/report; compilaciones y236/141 pruebas de raíz PASS.

- Primer runner integrado falló antes de rutas: selector sin radios. Un ajuste de espera no lo resolvió; raíz autorizó diagnóstico acotado, manteniendo todos los criterios. Captura real mostró catálogo500 y root identificó error del harness: controlledClock.now devolvía string ISO aunque Clock exige Date. Corrección dirigida autorizada al runner exclusivamente; no defecto de UI/API acreditado ni cambio del producto. Evidencia fallida se conserva; nueva ejecución pendiente. Un check de Orca sufrió WSL accept4 failed110; status posterior confirmó mismo runtime ready/reachable, sin reinicio ni duplicación.

- Por nueva instrucción del usuario, correcciones fáciles pueden ser del principal. No se lanzó Claude adicional. Raíz corrigió tres payloads MI en el servicio para entregar el envelope existente (message:null,codError:null,data), validando el payload real sin envolverlo artificialmente. Propiedad acotada: servicio + HTTP/bootstrap tests. Nuevo HTTP test falló RED con formularioDatos.message y pasó GREEN (8/8); combinado237/237, build/lint PASS.28 respuestas HTTP reales (4actores×7claves) pasaron S1 y parsers reales del cliente, cero escrituras académicas. Exactamente3 archivos sincronizados a ambos worktrees con guards SHA; UI backend recompilado PASS y GO reenviado. Instancia demo propia reiniciada en los mismos puertos tras exit0 del proceso anterior, sin tocar servicios desconocidos.
