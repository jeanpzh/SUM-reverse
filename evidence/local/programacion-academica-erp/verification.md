# E1: editores compactos, preferencias y caso ERP180

Fecha local2026-10-29. Rama schedule-pt1. Principal: diagnóstico, plan, contrato,
API/integración y correcciones aisladas; workers preferences_core/preferences_ui
GPT-6 Luna High, archivos disjuntos y sin subdelegación. Skillssum-workflow y
implementación/verificación locales aplicables. CodeGraph sinCLI: exclusiones
verificadas, sin instalación/init. Fuente catálogo sintético autorizado y reglas
funcionales del usuario; PDF y datos privados no abiertos. Aceptación observed/local-only.

## Diagnóstico comprobado frente a relato pendiente de reproducción

- Editor anterior renderizaba todos los docentes y sus casillas: longitud excesiva.
- assignmentRows colocaba tipo/duración donde sus headers indicaban día/hora:
  error real de representación. Calendario emitía un evento por componente, no por
  bloque; eran componentes válidos pero presentación confusa.
- DFS priorizaba primerID, no preferencias ni límite de secciones por curso. Un mismo
  docente con dos secciones es válido; cuatro de240min requieren960min. Un docente
  con carga600 no puede cubrir las cuatro; esa limitación sí es matemática.
- Una respuesta actual válida no puede tener0componentes asignados con asignaciones
  de calendario no vacías: DTO verifica longitud/contadores. No se dispuso de la
  configuración/respuesta exacta del relato del usuario; no se atribuye su combinación
  de statusimpossible ySEARCH_LIMIT a caché, recursos o versión sin evidencia.
  Se añadieron guards contra esa contradicción y pruebas de estados parciales.

## Cambios y archivos

- AcademicResourceEditor.tsx/CSS: un panel por tipo; selector referencia y lista
  compacta, edición de nombre completo, estado conservado al cambiar, buscador
  multiselección con chips, carga, disponibilidad, preferencias y máximos por curso.
  Identificaciones duplicadas rechazadas antes de cambiar estado. AmbienteAP/NP mismo
  patrón compacto, sin duplicar catálogo49. Selección de referencia ya incorporada
  sigue disponible aun con máximo32; IDs temporalmente vacíos no duplican referencia.
- schedule.types.ts/schedule-validator.ts: preferencias blandas y límites de
  secciones únicas por profesor/curso. generator.types/input/generator y nuevo
  teacher-preferences.ts: tres políticas explicables, poda temprana por restricciones,
  preferencias priorizadas sin prohibir fallback, balanced opcional, límites
  cooperativos sobre TODOS los intervalos enumerados incluso descartados por filtros.
- shared/programacion-academica-api.mjs/.d.mts: contrato aditivo, validación de
  políticas/preferencias/cupos, coherencia estado/counter/diagnósticos; sin contratos
  paralelos. demo-proposal.service.ts: filtra/valida/clona recursos elegidos y conserva
  autoridad/cupos/preferencias/política originales, informe blando y nombres retenidos.
- academicScheduling.ts/.test.ts y AcademicScheduling.tsx: agrupador común de
  bloques para tabla y calendario, detalle de componentes/duraciones/ambientes,
  responsable, cobertura secciones completas/parciales/pendientes y8componentes
  separados de4bloques. Razón de terminación independiente de cobertura; propuesta
  parcial marcada no definitiva. Nombres/tiempos visibles en bloques4/6h.
- Nuevas pruebas backend de preferencias y ERP180; scripts de navegador actualizados
  y nuevo client/scripts/verify-academic-erp.mjs. Plan:
  docs/reverse-engineering/plans/programacion-academica-compact-preferences.md.

## Verificaciones capturadas

- pnpm --dir backend test programacion-academica:11archivos/244casos aprobados.
  ERP180 completo con2docentes, uno con4secciones permitido, insuficiencia total
  de carga/cupos, preferencias blandas y fallback, balanced, docente único,
  bloques4/6h, backtracking, límites computacionales y parciales válidos.
- Node tres suites puras:203/203 (46dimensionamiento,67validador,90generador).
- shared/programacion-academica-api.test.mjs:5/5, incluye contradicción de status,
  cero contador con asignaciones presentes, duplicados y políticas/recursos inválidos.
- Backendbuild y tsc -p tsconfig.build.json --noEmit --incremental false: pasaron.
  Lint pasó con4advertencias previas unbound-method en local-profile-session.spec.ts
  líneas52/68/89/135. Clientebuild/lint/test:data pasaron,195/195casos.
- Docker compose.local.yaml --env-file NUL, proyecto propio sum-academic-acceptance
  en5280: código final compilado, contenedores saludables. El servicio existente5180
  no se consultó/interrumpió; configuración habitual no cambió. Sin instalaciones
  de dependencias nuevas, migraciones ni cambios de manifests/lockfiles.
- verify-academic-erp.mjs enChrome real: solo1formulario docente/ambiente activo,
  cambio entre2recursos conserva disponibilidad/preferencias/carga/cupo, nombres
  autorizados, selector sin duplicados y rechazo decolisión deID; búsqueda de ERP.
  Recursos suficientes:4secciones/8componentes/4eventos de4h,2secciones por docente,
 4preferencias cumplidas. Insuficiente:statusimpossible comprobado por carga480<960,
  conserva2secciones válidas/4componentes/2bloques y2pendientes. Un docente960min/cupo4:
  completo8componentes,2secciones dentro y2fuera de preferencias, sin falsa imposibilidad.
  Snapshot anterior inmutable, oferta matrícula igual; sin erroresJS ni tráficoexterno.
- verify-academic-compose.mjs: pasó selector/estudiante/API/generador/continuidad,
  modo split, configuración compacta y regeneración, oferta inmutable tras generar,
  matrícula sintética aceptada/idempotente. No se certifica toda la suiteglobal.
- CapturasERP revisadas: calendario4bloques18-22 y parcial2bloques; tabla/contadores
  consistentes. Sin comparación visual con SUM oficial.

## Correcciones durante integración y límites

La integración detectó que el nuevo editor copiaba pavilion de referencia al recurso
HTTP, cuyo contrato no lo admite: se corrigió la proyección explícita sin debilitar
la API. Una primera expectativa del testdealertas era demasiado amplia para dos
errores independientes; se acotó por panel. Se actualizaron selectores de pruebas
al editorcompacto. El principal corrigió esos casos aislados y repitió la integración.
La revisión detectó filtros previos a checkpoints; ahora cada intervalo descartado
también cuenta para presupuesto/tiempo, con regresión específica.

Las políticas son heurísticas: no garantizan mejor reparto ni óptimo global.
Preferencias orientativas, carga/cupos/disponibilidad obligatorios. SEARCH_LIMIT
no demuestra imposibilidad; impossible se refiere al dominio/recursos configurados.
Configuración solo en estado de pantalla; propuestas15min en memoria, máximo20.
Hasta32docentes/ambientes activos y32cursos por propuesta. Ambiente tipoL no impone
equipamiento ni laboratorio físico automáticamente; regla previa no ampliada.
Sin E2/E3/aprobación/publicación/SUMoficial/serviciosIA; matrícula intacta, sin commits/push.

## Auditoría de reanudación — 30 de octubre de 2026

Se recuperó el plan `programacion-academica-compact-preferences.md`, se revisaron
los archivos guardados y el estado completo de Git, incluidos los nuevos no rastreados.
Rama confirmada: `schedule-pt1`. Se conservaron todos los cambios anteriores.
El contador de archivos editados de una ejecución no equivale al estado total de Git:
hay seis archivos rastreados modificados desde etapas anteriores y numerosos archivos
nuevos del módulo, pruebas y documentación todavía sin commit.

**Conclusión:** el desarrollo funcional ya estaba terminado. Faltaba cerrar la
verificación del último ajuste visual del calendario y entregar el informe final.
En esta reanudación no se modificó código de aplicación, contratos ni configuraciones:
se repitieron comprobaciones, se regeneró evidencia sintética y se completó este informe.

| Requisito auditado | Estado final | Evidencia repetida |
| --- | --- | --- |
| Selector docente y un único formulario | Implementado y verificado | Navegador ERP: un panel activo, lista compacta y referencia sin duplicar |
| Selector de aulas/laboratorios | Implementado y verificado | Navegador ERP: un panel activo y catálogo AP/NP conservado |
| Preferencias y disponibilidades conservadas al cambiar | Implementado y verificado | Cambio entre dos docentes/ambientes; valores y franjas retenidos |
| Carga semanal y máximo por docente/asignatura | Implementado y verificado | Pruebas del validador, generador y caso ERP suficiente/insuficiente |
| Un docente puede asumir varias secciones | Implementado y verificado | ERP completo con dos docentes y también con uno de 960 minutos/cupo cuatro |
| Bloques continuos de cuatro y seis horas | Implementado y verificado | Casos de generador y servicio; ERP real con cuatro bloques de cuatro horas |
| SEARCH_LIMIT distinto de imposibilidad | Implementado y verificado | Límite de exploración conserva parcial válida; contrato rechaza diagnóstico contradictorio |
| Coherencia de secciones/componentes/calendario | Implementado y verificado | Cuatro secciones, ocho componentes y cuatro eventos; parcial con dos bloques y cuatro componentes |
| Bloque único con detalle interno | Implementado y verificado | Captura revisada: responsable, ambiente, 18:00–22:00, cuatro horas y componentes 120+120 |
| Matrícula existente | Verificado en el alcance local probado | Oferta igual tras generar; matrícula sintética aceptada e idempotente; fuentes de matrícula sin cambios |

No se encontraron requisitos funcionales pendientes, parcialmente implementados o
errores nuevos dentro de los diez puntos auditados. Las limitaciones de prototipo
indicadas debajo no equivalen a requisitos incompletos autorizados.

### Resultados actuales

- Backend focalizado: **244/244 pruebas**, once archivos, mediante
  `pnpm --dir backend test programacion-academica`.
- Generador y regresiones con Node: **203/203** entre dimensionamiento, validador
  y generador. Contratos compartidos: **5/5**.
- `pnpm --dir backend build`, `exec tsc -p tsconfig.build.json --noEmit --incremental false`
  y `lint`: pasaron. Cuatro advertencias previas `unbound-method` en
  `test/local-profile-session.spec.ts`, líneas 52, 68, 89 y 135; ningún error nuevo.
- `pnpm --dir client build`, `lint` y `test:data`: pasaron; **195/195 pruebas**.
- Comprobación adicional sin editar archivos: preferencias eligió B para las cuatro
  secciones frente a A sin preferencias; primera factible eligió A; balanced asignó
  dos a cada uno. Ejecuciones deterministas con la misma disponibilidad/carga factible.
- Docker disponible: reconstrucción y reinicio exclusivamente del proyecto sintético
  `sum-academic-acceptance` en **5280**, con `--env-file NUL`, contenedores saludables.
  No se consultó ni reinició el servicio existente en **5180**.
- Navegador real: `verify-academic-erp.mjs` y `verify-academic-compose.mjs` pasaron.
  La captura final confirma nombres completos legibles dentro de los bloques.
  No hubo errores JavaScript ni tráfico externo. Git `diff --check` pasó.

### Caso solicitado: 20118104, demanda 180 y capacidad 45

| Configuración | Resultado observado |
| --- | --- |
| Dos docentes, 480 minutos y máximo dos secciones cada uno, franjas suficientes | Completo: cuatro secciones, ocho componentes, cuatro bloques y cuatro preferencias cumplidas |
| Un docente, 480 minutos y máximo dos secciones | Incompatibilidad comprobada: carga total 480 frente a 960 necesarios; se conservan dos secciones válidas, cuatro componentes y dos bloques, con dos secciones pendientes |
| Un docente, 960 minutos y máximo cuatro secciones | Completo: cuatro secciones; dos dentro y dos fuera de preferencias, con advertencia blanda y sin afirmar optimalidad |

Ninguna verificación repetida falló. Los fallos iniciales del formulario y de los
selectores de prueba descritos en la sección anterior ya estaban corregidos antes
de esta reanudación. El estado contradictorio relatado originalmente por el usuario
no se reprodujo con una única respuesta válida; sigue sin atribuirse a una causa
no comprobada. Ahora se rechaza por contrato en vez de representarlo como resultado.

Continúan las limitaciones expresamente fuera de alcance: estado sin persistencia
de disco, búsqueda acotada y heurística sin óptimo global garantizado, máximo 32
docentes/ambientes activos y 32 cursos por propuesta, equipamiento de laboratorio
no modelado. No se certificó toda la suite global ni comportamiento institucional.
No se implementó E2/E3, aprobación, publicación o integración oficial. Sin commits/push.
