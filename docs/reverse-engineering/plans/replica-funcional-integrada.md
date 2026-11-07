# Plan de implementación: réplica funcional integrada del SUM

> Ejecución futura por tareas con las skills de cada carpeta. El principal planifica y fija contratos; los implementadores usan GPT-6 Luna High. Este documento no inicia implementación ni autoriza rediseños.

**Fecha / revisión:** 2026-10-19 / RFI-1. **Autor:** principal, sin agentes planificadores.
**Estado:** plan detallado propuesto. Primer trabajo ejecutable: F0, reconciliación documental y contratos. F1–F9 requieren sus contratos cerrados antes de despachar código.
**Objetivo:** completar una réplica independiente y verificable del recorrido académico del alumno, con población sintética diversa, persistencia, gestión operativa y concurrencia, preservando las interfaces SUM existentes.
**Arquitectura:** React y su capa de datos consumen la API NestJS propia. Reutilizar el motor académico, proyectores, proveedores de acceso y `EnrollmentStore`; PostgreSQL es el adaptador persistente actual. Las garantías de matrícula se especifican independientemente del motor SQL.
**Tecnologías existentes:** TypeScript, React, NestJS, PostgreSQL, Docker Compose, k6, Prometheus y Grafana. No se propone reemplazarlas ni añadir dependencias por defecto.
**Especificaciones base:** [matrícula regular](../../../specs/001-matricula-regular-fisi/spec.md), [dashboard por alumno](../../../specs/002-local-profile-dashboard/spec.md), [SIM-PUBLIC-1](../contracts/local-api/simulador-produccion.md), [perfiles de carga](../contracts/local-api/simulator-load-profiles.md). RFI-1 amplía su alcance; no declara esas especificaciones completas para módulos nuevos.

## 1. Corrección de alcance y fuentes

La aclaración del usuario establece que [SITUACION-SUM.md](../../../SITUACION-SUM.md) es una **guía referencial**, no una descripción real del SUM. Sus RF se usan como índice de necesidades posibles, nunca como evidencia de interfaces, normas vigentes, fallas, procedimientos o arquitectura del SUM.

Interpretación de «lo demás es necesario»: mantener el recorrido del alumno, diversidad académica, consistencia de datos, gestión del simulador, seguridad de identidad, rendimiento, observabilidad y verificación. Los módulos administrativos mencionados previamente se conservan en una entrega posterior con decisiones explícitas de prototipo; no se eliminan silenciosamente ni se inventan pantallas oficiales.

| Fuente | Uso y límite |
| --- | --- |
| Instrucciones del usuario y AGENTS | Requisitos del producto propio, conservación visual, aislamiento local, modelos y privacidad. |
| SITUACION-SUM | Guía de necesidades; sus afirmaciones requieren comprobación independiente. |
| [Dossier FISI 2026-II](../../domain/fisi/2026-II/README.md) | Referencias normativas/documentales delimitadas por facultad y periodo; revisar vigencia antes de ampliar reglas. No demuestra ejecución SUM. |
| Código, contratos y evidencia local existente | Implementación y resultados de la réplica; historial de resultados no equivale a verificación de cambios futuros. |
| Evidencia sanitizada de SUM | Solo respalda las pantallas/estados y condiciones capturados. Los vacíos permanecen `unverified`. |

Los porcentajes de 65 % y 35–40 % comunicados anteriormente fueron estimaciones informales. No son una línea base medida. Este plan usa criterios y entregas con evidencia, sin convertir cantidad de pantallas en avance funcional.

## 2. Restricciones globales

- Preservar fidelidad visual y de interacción de las pantallas SUM replicadas: estructura, estilos, textos, navegación y componentes. Reutilizar interfaces existentes es criterio de aceptación en toda tarea/handoff.
- No hay autorización de rediseño en este encargo. Adaptar datos/estado en pantallas actuales. Los controles nuevos de borradores y las vistas administrativas requieren diseño local concreto revisado antes de implementarse; no atribuirlos al SUM.
- Conservar modo mock, selector local, catálogo de escenarios y `compose.local.yaml`. La campaña persistente es opt-in. Una mejora compartida solo puede entrar con regresión de ambos modos.
- Conservar el arranque con un solo Compose para el simulador. k6 continúa como servicio bajo demanda. Las pruebas no se ejecutan automáticamente al levantar la web.
- Usar únicamente fixtures independientes y de procedencia sintética acreditada. Nunca abrir/indexar `datos-reales/`, acceder a snapshots privados por API ni ejecutar `compose.prod.yaml` del operador.
- No leer bundles externos de procedencia incierta para «completar» escenarios. Si una procedencia es insuficiente, construir el mínimo equivalente sintético de forma independiente.
- No tráfico automatizado, escrituras ni pruebas de carga contra SUM. El entorno desplegado de la réplica no es el SUM institucional.
- Mantener desconocido, vacío conocido, rechazo académico y error técnico como estados distintos. Ningún fallo de API se transforma en datos mock o éxito.
- La matrícula confirmada, detalles, solicitud, consumo de cupos y reporte conservan atomicidad. La identidad proviene de la sesión del servidor; nunca del selector/payload del cliente.
- Un resultado incierto se consulta por la misma identidad de operación. No crear automáticamente otra solicitud que pueda duplicar efectos.
- Las configuraciones de una campaña abierta son inmutables según el contrato vigente. Las ampliaciones de gestión deben respetarlo o versionar explícitamente una transición compatible.
- Planificación solo por principal. Implementación futura Luna High; máximo dos workers, archivos disjuntos, sin subdelegación y navegador secuencial. No hay workers nuevos en esta etapa.

## 3. Base que se reutiliza

| Capacidad existente | Artefactos principales | Brecha que aborda el plan |
| --- | --- | --- |
| Motor de reglas y selección | `backend/src/matricula-regular/{rules,selection.rules,windows,profiles}.ts` | Integración de perfiles variados en persistencia, cobertura de fronteras y datos coherentes; no otro motor. |
| Escenarios y registros sintéticos | `academic-demo.fixtures.ts`, `academic-demo.validation.ts`, `enrollment-scenarios.ts`, `expanded-scenarios.ts` | Preparación reproducible de cohortes persistentes; revisar procedencia de cada entrada antes de reutilizarla. |
| Proyecciones académicas | `backend/src/local-profile-dashboard/{academic-projection,profile-projection,scenario-reference-projection}.ts` | Todas las pantallas deben reflejar al mismo alumno, periodo y revisión. |
| Persistencia e identidad | `backend/src/persistence/`, `backend/src/auth/`, `backend/migrations/001_simulator.sql` | Evitar acoplamientos de proveedor, completar recuperación y operación. |
| Cliente | `client/src/data/{accessProvider,localProfileSession,localProfileDashboard,matriculaRegular}.ts`, pantallas/componentes existentes | Integración y manejo de sesión/errores sin rediseño. |
| Carga | `load/`, `backend/scripts/{seed-simulator,synthetic-load-profile,audit-simulator}.ts` | Carga académica heterogénea y perfiles sostenidos, además de los doce escenarios actuales. |
| Evidencia de carga | [Verificación con 400 alumnos](../../../evidence/local/simulador-produccion/scenarios-400/verification.md) | Doce escenarios con integridad aprobada; seis fallan latencia; soak de 30 minutos y renovación natural aún pendientes en ese informe. |

No reimplementar los trabajos cerrados de [remaining-implementation](remaining-implementation.md), [perfiles de escenarios](perfiles-escenarios-matricula.md) y [simulador PostgreSQL](simulador-postgresql-concurrencia.md). Comparar revisión/huellas antes de reutilizar sus resultados como evidencia vigente.

## 4. Entregas y dependencias

| Entrega | Fases | Resultado observable |
| --- | --- | --- |
| E1 — Recorrido académico persistente | F0, F1, F2, F3, F4 | Alumnos distintos consultan datos coherentes, se matriculan y recuperan su resultado tras recarga/reingreso/reinicio. |
| E2 — Simulador operable y medido | F5, F6, F7 | Configuración reproducible, control de campañas, auditoría, recuperación y carga diversa con resultados separados de integridad y rendimiento. |
| E3 — Gestión académica ampliada | F8 | Oferta/aulas, autorizaciones, tutorías, evaluaciones/actas y documentos, como funciones propias explícitamente especificadas. |
| E4 — Portabilidad y conexión autorizada | F9 | Pruebas de contrato para almacenamiento, adaptador Oracle verificable si hay entorno disponible y frontera de integración de lectura. |

Orden: F0 → F1 → F2 → F3. F4 consume F0/F2 y puede avanzar junto al trabajo de cliente de F3 con ownership disjunto. F5 consume F2/F4. F6 consume E1 y el seed reproducible de F5. F7 integra E1/F5/F6. F8 consume F0/F2/F5 y contratos propios. F9 empieza por contrato de almacenamiento después de F2; la integración institucional depende de un contrato/entorno autorizado externo.

F8/E4 están en el plan general; no son condiciones para demostrar E1 ni justifican retrasarlo. Cada entrega tiene un cierre independiente, y el proyecto completo mantiene sus pendientes visibles.

## 5. F0 — Inventario, contrato y aceptación congelados

**Responsable:** principal. **Complejidad / incertidumbre / impacto:** media / media / alta. Solo documentación.
**Archivos:** este plan; contratos existentes `matricula-regular.md`, `local-profile-dashboard.md`, `simulador-produccion.md`, `simulator-load-profiles.md`; registro `workflows/replica-funcional-integrada.md`.

- [ ] F0.1 Crear matriz por ruta/acción: datos fuente, permiso, efecto, persistencia, estado vacío/error, evidencia actual y brecha. Revisar las 16 pantallas sin asumir que una pantalla de lectura necesita edición.
- [ ] F0.2 Congelar ampliación de SIM-LOAD para cohortes académicas y expectativas por alumno. Mantener SIM-PUBLIC y MR sin nuevas rutas si sus respuestas existentes bastan.
- [ ] F0.3 Registrar campos de historial, plan, oferta y perfil que ya admiten los contratos y las incompatibilidades reales que exijan migración. No crear una segunda representación de matrícula.
- [ ] F0.4 Fijar matriz de permisos: estudiante sobre recursos propios; operador del simulador sobre campañas; roles académicos de F8 definidos por alcance propio, sin permisos globales implícitos.
- [ ] F0.5 Marcar por tarea: pantallas autorizadas, criterios, archivos exclusivos, versión contractual, pruebas sintéticas previstas y fuente. Asignar `lista` únicamente cuando no queden decisiones bloqueantes de esa tarea.

**Aceptación AC-01:** cada ruta/acción del alcance E1 tiene fuente y estado; cada cambio contractual incluye compatibilidad/migración, errores y casos de frontera. Revisar documentos/enlaces; no ejecutar aplicaciones durante esta fase.

## 6. F1 — Población académica sintética coherente

**Dependencia:** F0. **Responsable futuro:** backend Luna High. **Complejidad / incertidumbre / impacto:** alta / media / alta.
**Modificar:** `backend/scripts/seed-simulator.ts`, `backend/scripts/synthetic-load-profile.ts`; reutilizar fixtures/validación existentes sin cambiar sus resultados locales.
**Crear propuesto:** `backend/scripts/synthetic-academic-campaign.ts`, `backend/test/synthetic-academic-campaign.spec.ts`.

**Interfaz interna propuesta, a congelar en F0:** `createAcademicCampaign({ actorCount, seed, revision }): AcademicCampaign`; `AcademicCampaign` contiene `actors: ActorProfile[]`, `profiles: EnrollmentProfile[]`, `offer: OfferedCourse[]` y casos `{ actorId, cohortId, selection, expectedState, expectedCauseCodes, expectedGapCodes }`. Reutilizar tipos shared para selecciones/estados/códigos; no exportar credenciales en este catálogo. El seed de acceso mantiene su manifiesto privado separado.

- [ ] F1.1 Definir diez cohortes: regular, repitencia autorizada, tutoría incumplida, prerrequisito incumplido, cruce, deuda, horario desconocido, omisión de curso repetido, turno cerrado y excepción de créditos aplicable. Distribución inicial reproducible: 20 alumnos por cohorte en cada escuela, 400 en total. Para otra población usar reparto determinista y registrar cantidades reales.
- [ ] F1.2 Derivar historial, aprobados, repitencias, ponderado y prematrícula de una misma fuente académica sintética. Validar las equivalencias conocidas; las desconocidas generan gap. Respetar escuela/plan/periodo y documentar las decisiones locales de redondeo/cálculo ya adoptadas.
- [ ] F1.3 Resolver contradicciones de oferta antes de combinar escenarios: una sección no puede tener horario conocido para unos y desconocido para otros. Usar secciones/ofertas diferentes cuando el dato difiera; conservar cupos realmente compartidos dentro de cada grupo competidor.
- [ ] F1.4 Preparar cualquier ocupación inicial mediante matrículas válidas con detalles y solicitudes auditables. No copiar contadores de fixtures locales que no tengan filas de matrícula equivalentes en PostgreSQL. Registrar alumnos auxiliares aparte de los 400 competidores.
- [ ] F1.5 Definir dos variantes: `academic-ample` con capacidad suficiente para todos los elegibles y `academic-scarce` con una sección disputada por al menos 40 elegibles, capacidad 10. Los inelegibles no consumen plazas; la identidad de los ganadores no es determinista.
- [ ] F1.6 Mantener aparte el caso de prerrequisito forzado por HTTP: el curso excluido no se presenta como seleccionable en la UI. La prueba UI comprueba su ausencia; la prueba de API comprueba el rechazo.

**AC-02:** mismas entradas producen los mismos datos académicos y expectativas; códigos de acceso siguen siendo aleatorios. 400 identidades únicas, referencias válidas, cero cruces de escuela/plan y expectativas explícitas por cohorte.
**AC-03:** `academic-ample` cumple los resultados por alumno; `academic-scarce` tiene exactamente 10 ganadores entre elegibles del grupo disputado, sin anticipar quiénes. Expectativas fijadas por fixtures revisados; no obtener el resultado esperado llamando al mismo evaluador que se está verificando.

## 7. F2 — Persistencia y proyecciones de la misma fuente

**Dependencia:** F1. **Responsable futuro:** backend Luna High. **Complejidad / incertidumbre / impacto:** alta / media / alta.
**Modificar:** `backend/src/persistence/{enrollment-store,postgres-enrollment.store}.ts`, `backend/src/auth/simulator-public-dashboard.controller.ts`, proyectores de `backend/src/local-profile-dashboard/`, `backend/scripts/audit-simulator.ts`.
**Migraciones:** añadir una migración posterior a las existentes solo si un campo no cabe en el modelo vigente; no reescribir migraciones aplicadas. **Prueba propuesta:** `backend/test/simulator-academic-coherence.e2e-spec.ts`.

- [ ] F2.1 Persistir el perfil enriquecido y la oferta sin perder su procedencia/revisión. Reutilizar documentos existentes; normalizar tablas adicionales solo cuando una invariante lo necesite.
- [ ] F2.2 Proyectar perfil, historial, plan, programación y prematrícula desde esa revisión. Tras confirmar, matrícula y horarios se proyectan del reporte confirmado, no de una oferta que pudo cambiar después.
- [ ] F2.3 Evitar campos sintéticos contradictorios entre perfil y restricciones: no presentar una deuda incumplida como inexistente. Si el wire de una pantalla no representa el dato, F0 debe extenderlo o expresar indisponibilidad; no inventar importes médicos/financieros ni notas.
- [ ] F2.4 Comprobar reinicio de ambas API, lectura desde otra réplica, cierre de campaña y nueva campaña sin contaminar resultados previos. Reautenticar después de TTL cuando corresponda; no exigir que una sesión vencida siga autorizada.
- [ ] F2.5 Extender auditoría a igualdad entre matrícula/detalles/reporte, suma de créditos, pertenencia y ocupación; las consultas ordinarias no producen escrituras académicas.

**AC-04:** los datos vistos antes/después de matrícula son coherentes para las dos escuelas y diez cohortes. Tras reinicio se recuperan exactamente los resultados confirmados. Rechazados y `configuration-pending` dejan cero detalles/cupos/reportes nuevos.

## 8. F3 — Recorrido del alumno conservando las pantallas

**Dependencia:** F2 y contrato de F0. **Responsable futuro:** frontend Luna High; aceptación integrada por principal.
**Modificar si el diagnóstico lo exige:** `client/src/data/{localProfileDashboard,localProfileSession,matriculaRegular,academicRequirements,localAcademicView}.ts`, `AcademicHistory.tsx`, `TableScreens.tsx`, `RegularEnrollment.tsx`, `RegularEnrollmentReport.tsx`, `WeeklySchedule.tsx` y componentes de matrícula existentes.
**Pruebas:** extender pruebas de datos existentes; crear escenario de navegador focalizado bajo `client/scripts/` según la convención vigente, sin duplicar el verificador global.

- [ ] F3.1 Enlazar identidad → historial/plan → prematrícula/oferta → selección → confirmación → matrícula/horario/reporte con la API persistente, sin fuentes mock de respaldo.
- [ ] F3.2 Conservar columnas, modales, botones y navegación; completar los estados existentes con datos nuevos. Verificar teclado, foco y errores en las regiones modificadas.
- [ ] F3.3 Cubrir recarga, atrás/adelante, dos pestañas, respuesta tardía tras logout, cambio de alumno, expiración y consulta de resultado incierto. Comprobar el incidente histórico de logout tras recarga antes de darlo por pendiente o corregido.
- [ ] F3.4 Verificar descargas propias ya soportadas: contenido coincide con pantalla y resultado confirmado. No convertir un CSV local en supuesto PDF oficial.
- [ ] F3.5 Comparar visualmente antes/después con el mismo contenido, viewport, scroll y estado. Separar regresión frente a la réplica actual de paridad frente a una referencia SUM suficiente.

**AC-05:** diez cohortes × dos escuelas tienen recorrido o rechazo/gap esperado, con efecto verificado en API/DB. El caso forzado de prerrequisito se separa de la interacción UI.
**AC-06:** recorrido de lectura por las 16 pantallas sin mezcla de alumno y con estados vacíos/errores veraces. Ninguna regresión estructural no autorizada. Las acciones sin contrato no se habilitan por aparentar completitud.

## 9. F4 — Identidad sustituible y recuperación

**Dependencia:** F0/F2. **Responsables futuros:** backend y frontend Luna High, tareas disjuntas.
**Archivos:** `backend/src/auth/{identity-provider,simulator-auth.service,simulator-auth.controller}.ts`, controladores públicos; `client/src/data/accessProvider.ts`, `localProfileSession.ts` y sus pruebas.

- [ ] F4.1 Comprobar sustitución de `IdentityProvider.authenticateCredential(credential)` por un proveedor sintético alternativo mediante inyección, manteniendo `PublicPrincipal`, permisos y sesiones. No implementar SSO institucional sin su contrato.
- [ ] F4.2 Comprobar que el proveedor frontend mantiene `login/current/logout` y que la vista de acceso existente es la única afectada por el método temporal. Un futuro flujo con redirecciones requiere contrato nuevo, no fingir equivalencia con un código.
- [ ] F4.3 Probar acceso cruzado, sesión vencida/revocada, logout en vuelo, doble clic, resultado perdido antes/después de commit y reingreso del mismo alumno.
- [ ] F4.4 Probar recuperación después de más de 15 minutos reales y conservar una consulta pendiente sin reenviarla automáticamente. Diferenciar expiración de acceso y sesión académica.

**AC-07:** un actor nunca consulta ni muta datos de otro; reingreso no habilita una segunda matrícula. Sustitución de proveedor sintético sin modificar el motor de matrícula. Ningún secreto en URLs, capturas, logs versionados o etiquetas métricas.

## 10. F5 — Operación reproducible de campañas

**Dependencia:** F2/F4. **Responsables futuros:** backend para scripts; principal para contratos/configuración raíz asignada.
**Archivos:** scripts actuales `seed-simulator.ts`, `migrate-simulator.ts`, `close-simulator.ts`, `audit-simulator.ts`; `compose.yaml`, `load/scenarios.sh` solo si es imprescindible; documentación de uso vigente.

- [ ] F5.1 Reutilizar entrada validada del seed para perfil, semilla, población y revisión; conservar arranque de un Compose. Proponer un único comando de preparación de campaña, mostrar únicamente resumen y ubicación protegida de accesos.
- [ ] F5.2 Distinguir preparar, abrir, cerrar y archivar. Fijar contrato de ciclo de vida en F0 antes de añadir estados; una campaña cerrada conserva consultas/replays autorizados y no admite matrículas nuevas.
- [ ] F5.3 Proteger rotación frente a carga en curso con el bloqueo operativo existente. Un usuario web no reinicia la campaña de otros ni exporta sus accesos.
- [ ] F5.4 Preparar respaldo y restauración en volumen/DB sintéticos aislados. Nunca restaurar encima de la campaña activa como prueba.
- [ ] F5.5 Registrar versión de migración, commit, revisión de fixture y configuración de recursos en cada ejecución. Demostrar que el modo local anterior sigue arrancando con su configuración.

**AC-08:** preparar → acceder → matricular → cerrar → consultar → restaurar copia aislada tiene efectos esperados y auditables. Arranque normal no ejecuta k6, borra campañas ni rota códigos por sorpresa.

## 11. F6 — Carga realista y diagnóstico de rendimiento

**Dependencia:** E1 y seed F5. **Responsables futuros:** worker Luna High con propiedad explícita de `load/` y scripts; principal interpreta resultados.
**Archivos:** `load/{scenarios.sh,profile-config.mjs,common.js,mixed.js,enrollment.js,sessions.js}`, auditoría y verificadores existentes; nuevo `load/academic.js` si evita sobrecargar scripts actuales.

- [ ] F6.1 Añadir `academic-ample` y `academic-scarce`: cada VU tiene identidad, selección y expectativa propias. Distinguir accepted, rejected, pending y errores técnicos. Rechazo académico esperado no cuenta como fallo HTTP.
- [ ] F6.2 Escalar en pasos 1/25/100/200/400; medir login, carga de dashboard, contexto y confirmación por separado. Reutilizar barrera de apertura, último cupo, demanda uniforme/concentrada, reintentos y cortes ya existentes.
- [ ] F6.3 Ejecutar soak de 30 minutos y expiración/recuperación natural. Medir memoria, colas y conexiones a lo largo del tiempo, no solo indicadores finales.
- [ ] F6.4 Correlacionar latencia con cola del pool, espera de locks, duración de transacción, CPU/RAM y event loop. Separar tiempo de red, servicio y espera cuando haya instrumentación suficiente; añadir solo lo necesario para una hipótesis concreta.
- [ ] F6.5 Cambiar una variable por experimento: tamaño de pool, trabajo dentro de transacción, consultas/índices o concurrencia de llegada. No aumentar conexiones sin medir capacidad de DB. Mantener una línea base comparable.
- [ ] F6.6 Preservar umbrales existentes p95 < 2 s y p99 < 5 s donde ya aplican; fijarlos para los nuevos escenarios de matrícula antes de ejecutarlos. Medir recuperación con su criterio propio y contar transitorios; no ocultarlos ni declarar rendimiento aprobado donde no se definió SLO.
- [ ] F6.7 Cuando sea posible ejecutar k6 en otro host para separar el generador de la aplicación. Si comparten host, registrar esa limitación y medir saturación del generador. 400 usuarios es un objetivo experimental, no un «peor caso» universal.

**AC-09:** invariantes SQL sin violaciones; resultados por cohorte/capacidad correctos. Registrar demanda ofrecida, completada y descartada, VUs activos, timeouts y errores.
**AC-10:** informe por escenario con integridad y rendimiento separados, configuración/recursos, intervalo Grafana, commit y resultado real. E2 no declara su objetivo de rendimiento cumplido si cualquier escenario obligatorio lo incumple.

## 12. F7 — Aceptación integrada y evidencia reutilizable

**Dependencia:** E1/F5/F6. **Responsable:** principal con `sum-fullstack-verify`, sin revisor/planner adicional por rutina.
**Salida propuesta:** `evidence/local/replica-funcional-integrada/verification.md`, resultados agregados sin identidades/credenciales y huellas de fuentes comprobadas.

- [ ] F7.1 Registrar por criterio AC-01–AC-10: escenario, entrada, esperado, resultado, comando, evidencia y límite. Reutilizar verificaciones vigentes; repetir las afectadas por los cambios.
- [ ] F7.2 Ejecutar build/lint de capas afectadas y pruebas focalizadas de contratos/datos/HTTP. Luego navegador real contra NestJS/PostgreSQL y auditoría final.
- [ ] F7.3 Separar cuatro dictámenes: fidelidad visual de referencia, comportamiento de referencia, contrato propio e integración. Una aprobación local no convierte los dos primeros en verificados.
- [ ] F7.4 Documentar operación desde clon limpio, acceso, cambio de campaña, ejecución individual de carga, Grafana e interpretación de resultados. Conservar el flujo simple con Docker.

**Comandos previstos, no ejecutados en esta planificación:**

```sh
pnpm --dir backend build
pnpm --dir backend lint
pnpm --dir backend exec tsc -p tsconfig.scripts.json
pnpm --dir client build
pnpm --dir client lint
pnpm --dir client test:data
pnpm --dir backend test
pnpm --dir backend test:e2e
docker compose up --build -d
SCENARIO_QUICK=1 bash load/scenarios.sh all
bash load/scenarios.sh soak
```

Antes de ejecutar suites generales revisar su configuración y procedencia. Seleccionar pruebas focalizadas cuando baste; usar campañas/volúmenes sintéticos de aceptación, nunca el backend privado del operador. La batería de carga rota campañas: coordinarla con el uso humano y conservar resultados anteriores. La implementación futura debe fijar los comandos exactos de las nuevas pruebas junto a cada handoff.

## 13. F8 — Gestión académica ampliada, como producto propio

**Dependencia:** F0/F2/F5. **Complejidad / incertidumbre / impacto:** alta / alta / alta.
**Estado:** diseño por módulo antes de implementación. No hay aprobación de nuevas pantallas administrativas ni un contrato institucional que copiar. Primero entregar especificación local concreta; preservar interfaces SUM existentes en todos los handoffs.

| Tarea | Diseño y archivos propuestos | Aceptación mínima |
| --- | --- | --- |
| F8.1 Borradores de planificación | Extensión del contrato MR para borrador separado de matrícula; repositorio dedicado dentro de `backend/src/matricula-regular/`; adaptador cliente reutiliza selección existente. Antes de código fijar controles visibles. | Guardar/recuperar elección propia con revisión; borrador no consume cupos, no es matrícula ni sobrescribe un resultado incierto. Al confirmar se revalida oferta/cupo. |
| F8.2 Oferta, docentes y aulas | Revisiones de oferta sobre el modelo vigente; nuevo módulo `backend/src/academic-administration/` únicamente para comandos administrativos y auditoría. | Aula sin solapamiento dentro de su ámbito, capacidad de sección compatible, cambios trazados. Campaña abierta conserva revisión; reporte previo no cambia retroactivamente. |
| F8.3 Autorizaciones y tutoría | Reutilizar `creditException`, `tutorship` y requisitos existentes; workflow local propuesto solicitud → revisión → aprobada/rechazada, con roles/acceso y efectos fijados en contrato. | Estudiante no se autoriza; decisión identifica motivo, alcance y periodo. Repetición de aprobación no duplica efectos. Campaña abierta no cambia reglas silenciosamente: nuevas autorizaciones requieren revisión/campaña definida. |
| F8.4 Evaluaciones, asistencia y actas | Reutilizar contratos de reportes; escritura se especifica aparte de lectura. Acta local borrador → cerrada; corrección crea revisión con motivo, no sobrescribe historia. | Notas válidas según perfil académico explícito, actor/curso/periodo autorizados; cierre/reintento/corrección auditables; historial y PP coherentes tras cambio aprobado. |
| F8.5 Sílabos | Documento versionado por curso/sección/periodo y semanas, vinculado desde región de interfaz previamente definida. | Consulta de versión vigente, autor/fecha y revisión anterior; autorización de edición. No declarar que esta interfaz existe en SUM. |
| F8.6 Lista de espera | Especificación local previa: prioridad, empate, caducidad y cómo se libera/ofrece una plaza. Separar espera de matrícula; no inventar cancelación dentro del flujo regular actual. | Inscripción única en cola; oferta/reclamación concurrente no crea sobrecupo; elegibilidad revalidada. Sin política de liberación aprobada no se implementa admisión automática. |
| F8.7 Documentos y auditoría | Reutilizar reporte confirmado; historial de eventos y verificación de documento propio, permisos/retención definidos. Firma institucional se mantiene como dependencia externa. | Documento refleja matrícula exacta; modificación detectable y versiones trazables. Hash o firma de demo nunca se presentan como firma institucional/legal. |

**Contratos:** principal agrega un documento por módulo bajo `docs/reverse-engineering/contracts/local-api/` solo después de revisar incompatibilidades con los existentes. Cada contrato especifica rutas propias, DTO runtime, roles, estados, idempotencia, concurrencia, versión y errores. No inventar ahora firmas definitivas para módulos cuyo diseño de interacción aún no está aprobado.

**Perfiles y fronteras adicionales:** incluir egreso/excepciones, equivalencias, cambios de plan y estado académico desconocido cuando estén documentados o definidos localmente. Procesos de rectificación, retiro, reserva y reactualización necesitan contrato independiente antes de incorporarse; no se deducen de habilitar edición de matrícula.

**AC-11:** cada submódulo tiene camino válido, denegación por rol/ámbito, repetición, error, persistencia y efecto verificables con fixtures sintéticos. Funcionalidades institucionales desconocidas siguen sin afirmarse como SUM. E3 se reporta por submódulo, sin un «completo» global prematuro.

## 14. F9 — Independencia del motor e integración de lectura

**Dependencia:** F2; entorno Oracle separado y contrato externo para las ramas que lo requieren.
**Archivos:** `backend/src/persistence/enrollment-store.ts`, adaptador PostgreSQL y suite de conformidad propuesta `backend/test/enrollment-store.contract.ts`. Adaptador Oracle bajo `backend/src/persistence/` solo cuando su entorno/driver se haya verificado.

- [ ] F9.1 Congelar contrato de `EnrollmentStore`: preservar firmas vigentes `readSnapshot`, `submit`, `lookup`, `report`, creación/renovación de sesión y cierre. Refinar retornos `unknown` a contratos compartidos cuando corresponda, con migración de consumidores documentada.
- [ ] F9.2 Especificar garantías comunes: transacción atómica, exclusión por alumno, capacidad condicional, unicidad, orden estable de bloqueo, replay durable, rollback y cierre coordinado. El SQL, JSONB, bindings y tratamiento de errores quedan en cada adaptador.
- [ ] F9.3 Ejecutar la misma suite de conformidad sobre PostgreSQL y, cuando esté disponible, Oracle sintético aislado. No reemplazar la prueba Oracle por mocks ni asumir que su aislamiento equivale al de PostgreSQL.
- [ ] F9.4 Para conexión institucional, obtener contrato autorizado de lectura y diseñar un importador/adaptador con procedencia, fecha, revisión y validación. Probar primero con proveedor sintético. Prohibido proxy improvisado, exportaciones privadas o acceso a credenciales institucionales.
- [ ] F9.5 Distinguir identidad institucional de almacenamiento Oracle; se pueden integrar por separado. No conectar escrituras del simulador a la matrícula oficial.

**AC-12:** misma suite de invariantes pasa en cada motor acreditado y cada resultado identifica motor/versión/entorno. Mientras falte Oracle, estado «contrato agnóstico definido; adaptador Oracle no verificado». Integración institucional queda bloqueada solo en esa rama cuando no existe acceso/contrato autorizado.

## 15. Riesgos a comprobar de forma explícita

| Condición | Tratamiento / tarea |
| --- | --- |
| Fixtures combinados se contradicen o cuentan ocupación inexistente | Cohortes/ofertas coherentes, auxiliares matriculados y auditoría F1/F2. |
| Cambio de alumno con solicitudes antiguas aún en vuelo | Invalidación por generación, descarte de respuesta tardía y pruebas F3/F4. |
| Reglas ausentes se interpretan como permiso | Estado pendiente explícito, fronteras por perfil y pruebas F1/F2. |
| Resultado confirmado se pierde para el navegador | Lookup con identidad original y prueba de corte antes/después de commit F4/F6. |
| Carga agota el generador y parece un límite del backend | Métricas de ambas partes, llegada ofrecida/completada y generador separado F6. |
| Administrador cambia cupos/reglas durante matrícula | Inmutabilidad/versiones, transición coordinada y pruebas F5/F8. |
| Evidencia visual no comparable o incompleta | Dictámenes separados, regresión con mismas condiciones F3/F7. |

## 16. Handoffs, coste y commits

- Primer bloque de ejecución: F0 + F1; segundo F2 + F3/F4; tercero F5–F7. No despachar todos los módulos en una sesión ni cargar documentación irrelevante.
- Cada worker recibe únicamente root/folder AGENTS y skill local, contrato congelado, tarea, dependencias satisfechas, archivos exclusivos, criterios y pruebas. Incluir siempre fidelidad SUM, pantallas autorizadas y reutilización de interfaces.
- Backend: `backend/.agents/skills/sum-nestjs-implement/SKILL.md`; cliente: `client/.agents/skills/sum-react-implement/SKILL.md`. Verificación integrada por principal con `sum-fullstack-verify`.
- Perfil efectivo futuro: `gpt-6-luna`, esfuerzo `high`, contexto mínimo. Si el perfil no está disponible, informar; no afirmar cambio de modelo por un prompt. Verificar configuración real al despachar.
- CodeGraph: comprobar configuración/índice y exclusiones antes de usarlo; no inicializar si no puede garantizar exclusión de archivos privados y symlinks ajenos. Registrar limitación y usar búsquedas acotadas. No repetir indexación por tarea.
- Máximo un ciclo de reparación automática tras fallo; si persiste, principal diagnostica y registra la siguiente decisión. No relajar umbrales ni reiniciar el contador cambiando de worker.
- Commits previstos por resultado: contrato/cohortes, persistencia/proyecciones, recorrido/sesiones, operación, carga/diagnóstico y evidencia. Los módulos F8/F9 tienen commits propios; no mezclar artefactos de ejecución ni secretos.
- Antes de cada commit de implementación: diff, checks afectados y aceptación aplicable. Antes de push: revisar rama/remoto y autorización vigente. Este turno de planificación no hace commits/push ni consume pruebas de carga.

## 17. Registro de avance y siguiente acción

Cada tarea tendrá estado `pendiente`, `lista`, `en-curso`, `verificada`, `fallida` o `bloqueada`; evidencia, revisión de entrada y reparaciones usadas. Un checkbox se marca únicamente al completar su resultado, no por crear un archivo.

Métricas separadas: criterios obligatorios de E1/E2 aprobados sobre total congelado; módulos E3 aceptados; adaptadores E4 realmente verificados; cobertura de referencia SUM por pantalla/estado. No sumar estas métricas en un porcentaje único sin acordar ponderación y denominador.

**Siguiente acción:** completar F0 y preparar el handoff F1 con contrato de cohortes y aceptación AC-02/03. Mantener este plan como fuente de continuidad; no volver a planificar todo en la siguiente sesión.
