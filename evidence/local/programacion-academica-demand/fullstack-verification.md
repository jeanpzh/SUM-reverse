# E1 · estimación potencial sintética

Fecha:2026-11-02, America/Lima. Rama schedule-pt1. Diseño y aceptación del principal.
Requisitos del usuario y decisiones local-only; sin afirmación de norma o conducta
oficial SUM. No se consultaron documentos privados, datos-reales, producción ni el
servicio del operador en5180. Se preservó el trabajo previo sin commits/push.

## Diseño aplicado

Plan/contrato: docs/reverse-engineering/plans/programacion-academica-demand-demo.md.
Guía y fórmula de fixtures: docs/reverse-engineering/programacion-academica-demand-demo.md.
Se reutilizan catálogo/plan/antecedentes integrados, tipos académicos y
calculateRequiredSections. No se modifica el motor de horarios ni matrícula.
Nueva proyección DemandLearner mínima porque validateSyntheticAcademicRecord exige
IDs A/B y no admite la población independiente: se documenta esa incompatibilidad,
se valida la proyección propia y se conservan todos los contratos de matrícula.

Fuentes explícitas: regular/Sistemas (2personas), independiente120 con12copias
idénticas (132registros,120personas), revisión DEMAND-SYN-1. No se unen las versiones
de los actores de nueve escenarios como nuevas personas. La fuente independiente
genera antecedentes nuevos sobre el mismo plan, sin copiar las historias A/B.
Solo Sistemas/plan sintético, periodo objetivo2027-I/corte2026-1; no se predice2026-II.
Equivalencias: reconocimientos sintéticos explícitos, sin importar tablas oficiales.
Historial desconocido/conflicto/mapeo inválido no produce elegibilidad confirmada.

API: POST /api/local/programacion-academica/v1/demanda/estimar, mismas barreras
locales/origen/JSON que E1. Request: revisión/fuente/periodo/cursos-capacidades, sin
datos de alumnos. Response: agregados/procedencia/limitaciones; ni nombres, IDs,
actas ni historias. El endpoint no altera propuestas, oferta, cupos ni repositorios
de matrícula; fuentes cerradas en memoria y sin persistir estimaciones.

## Aceptación real

| Criterio | Escenario y resultado |
| --- | --- |
| Conteo único | Identidades duplicadas idénticas, incluso con hechos reordenados, cuentan una vez.132 registros →120personas en fuente independiente. Duplicados contradictorios quedan insuficientes. |
| Repetición incluida | ERP60 elegibles,24 repitentes dentro de60,36 no elegibles y24 insuficientes.60+36+24=120, no84 elegibles. Fallos múltiples cuentan una persona y aprobación conocida prevalece. |
| Prerrequisitos/equivalencias | Unitarios de conjunción, reconocimiento explícito de curso y prerrequisito; equivalencia desconocida no acredita reconocimiento. Datos posteriores al corte no se usan. |
| Integridad/gaps | Historial/plan/equivalencias desconocidos, correspondencias ausentes, fechas inválidas, datos faltantes y grafo inconsistente no dan falsa elegibilidad. Identidad ausente impide aceptar fuente interna. |
| Fuente pequeña | ERPregular:2personas,0elegibles,2noelegibles por prerrequisito,0insuficientes. No representa demanda institucional cero. |
| Secciones | Capacidad45 y base60 →2; capacidad30 →2; cero y divisiones exactas/redondeo verificados mediante section-sizing existente. Capacidad inválida rechazada. |
| Demanda final | Manual180 permanece tras estimar/cambiar fuente/reestimar. Usar base es explícito y se bloquea con insuficientes. Source regular permite adoptar0 explícitamente y volver a escribir180. |
| Interfaz | Fuente/revisión/población/registros/duplicados/corte/límites visibles; nombre/código de curso; causas expandibles; no identidades de estudiantes. Base y final en métricas distintas. |
| Respuesta obsoleta | Petición real retenida brevemente con route.continue, cambio de capacidad cancela/invalida: no reaparece la estimación anterior. Sin respuesta mock. Preview180/30=6 y180/45=4. |
| Generación real | Request de propuesta utiliza demanda final180/capacidad45, no base60. Respuesta complete,4secciones/8componentes, recursos sintéticos suficientes. |
| Editor anterior | verify-academic-manual conserva selector/editor único, cambio válido, rechazo docente/ambiente, continuidad y split dos días. |
| Matrícula | Oferta idéntica tras estimar/generar/ajustar; verify-academic-compose verifica navegación estudiantil, matrícula aceptada e idempotente, ocupación alterada solo por esa matrícula sintética. |
| Acceso/contrato | HTTP rechaza autoridad/alumnos del cliente, campos desconocidos, periodo/fuente/curso inválidos, capacidades inválidas, query, origen cross-site y público. Revisión obsoleta409 solo tras validar forma. |

## Ejecución y resultados

- `pnpm --dir backend test programacion-academica test/matricula-regular-regression.spec.ts test/enrollment-scenarios.spec.ts`:
  **16archivos,319/319**. Incluye268 académicas (15nuevas) y51regresiones de matrícula.
- `pnpm --dir backend build`:aprobado; `pnpm --dir backend exec tsc -p tsconfig.build.json --noEmit --incremental false`:aprobado.
- `pnpm --dir backend lint`:exit0, cuatro advertencias anteriores unbound-method en
  backend/test/local-profile-session.spec.ts (52,68,89,135).
- `pnpm --dir client build`, `pnpm --dir client lint`:aprobados;
  `pnpm --dir client test:data`:**198/198**. Build incluye tipos.
- `node --test shared/programacion-academica-api.test.mjs shared/programacion-academica-demand.test.mjs`:**10/10**.
- `pnpm --dir client exec eslint scripts/verify-academic-demand.mjs`:aprobado tras
  añadir evidencia JSON y reforzar estado complete del flujo integrado.
- `SUM_PORT=5280 docker compose --env-file NUL -f compose.local.yaml -p sum-academic-acceptance up --build --detach --wait`:
  compilación de ambos proyectos aprobada y ambos servicios saludables. Se repitió
  frontend tras la corrección visual, backend sin cambios conservado en caché.
- Con `SUM_ACADEMIC_COMPOSE_SYNTHETIC=1`, scripts browser reales
  verify-academic-demand.mjs, verify-academic-manual.mjs y verify-academic-compose.mjs:
  **aprobados**. Principal como único propietario del navegador; viewport1440×1000;
  solo instancia propia http://127.0.0.1:5280; sin erroresJS ni peticiones externas.
  La prueba de demora usa una petición real continuada, no un endpoint simulado.
- `git diff --check`:aprobado, aviso previo LF/CRLF de routeTree.gen.ts.

Resultado agregado sin alumnos en result.json y captura final academic-demand-panel.png.
Las suites Node203 del núcleo ya están incluidas en Vitest, no se suman ni se
declaran ejecutadas nuevamente por separado. No se certificó toda la suite global.

## Incidencias y correcciones

Un test de datos cliente esperaba un mensaje distinto para filas vacías: corregido
en el ciclo autorizado, verificación final198/198. La revisión previa reforzó
conocimiento de equivalencias, fechas coherentes de repitencia, validación antes de
409, integridad de proyección antes del fingerprint y deduplicación canónica.
Estas correcciones quedaron cubiertas antes de la aceptación integrada.

En inspección visual, algunas etiquetas se pegaban a las cifras por estilos
heredados. Corrección aislada del principal en CSS local: métricas apiladas con
separación. Se recompiló Docker y se repitió el navegador; captura final revisada.
No fallos finales pendientes. CodeGraph no se inicializó sin garantías acreditadas
de exclusión de dependencias/symlinks; no afectó los checks deterministas.

## Archivos de esta etapa

Nuevos: backend/src/programacion-academica/demand-fixtures.ts y demand-estimator.ts;
backend/test/programacion-academica-demand.spec.ts y programacion-academica-demand-http.spec.ts;
client/src/screens/AcademicDemandPanel.tsx; client/scripts/verify-academic-demand.mjs;
shared/programacion-academica-demand.test.mjs; plan, guía, workflow y esta evidencia.

Modificados dentro del trabajo previo sin rastrear: demo.controller.ts,
demo-proposal.service.ts; AcademicScheduling.tsx/.css; academicScheduling.ts/.test.ts;
shared/programacion-academica-api.mjs/.d.mts; contrato local y nota de evolución en
demand-findings. No hubo cambios en generador, catálogo/fixtures de matrícula,
pantallas estudiantiles, WeeklySchedule, manifiestos/lockfiles o Docker. Los seis
archivos rastreados modificados antes mantienen el mismo diff64inserciones/7eliminaciones.

## Límites y siguiente información necesaria

Es potencial académico de una fuente sintética al corte, no matrícula prevista.
Perfil fijo Sistemas/2027-I; sin padrón institucional, datos en progreso, continuidad,
equivalencias oficiales ni reglas completas de grupos/electivos. Necesidad por curso
no garantiza selección conjunta viable ni intención. No hay persistencia de la
edición, pronóstico estadístico, E2/E3, aprobación o publicación.

Para usar datos institucionales harían falta población autorizada/deduplicada,
resultados y equivalencias conciliados, planes/reglas vigentes, corte/periodo,
continuidad y evidencia de intención/tasas si se desea pronosticar. No se pide ni
se incorpora información privada en esta etapa. Sin commits, push o migraciones.

Abrir con Docker habitual en localhost:5180/local/programacion-academica tras
reconstruir. Las pruebas no usaron ni inspeccionaron ese servidor del operador.
