# Asignación por sesión: validación integrada

Fecha: 2026-11-17. Fuente: `observed` local sobre catálogo `PA-DEMO-1`, declarado sintético; reglas nuevas `local-only`, inspiradas en la referencia pública oficial de Sistemas 2025-II cuya procedencia confirmó el usuario. No se importan personas ni se usa esa programación como fixture. El escenario de aceptación es **2027-I**, no se atribuyen reglas de otro periodo a una norma vigente.

## Qué cambió

Se conservan el modo legacy de docente único y las pantallas existentes. La configuración admite T/P con docente común y laboratorio independiente, o docente por sesión. Generación, ajuste, validación y revisión docente respetan los grupos declarados. Cambiar el docente de L no cambia T/P, incluso cuando antes eran contiguos y compartían docente. Los bloques editables conservan esa distinción. El responsable académico se deriva del orden declarado, no del orden accidental de la respuesta.

La política acepta procedencia y excepciones explícitas de sábado. No modifica disponibilidad docente ni de ambientes; no convierte una referencia histórica en disponibilidad futura. Los perfiles siguen siendo locales configurables: esto no certifica el reglamento docente ni una fuente institucional de habilitaciones. No hay una nueva base de datos de catálogos en este cambio.

El consejero expone un parche tipado de asignación docente; sigue teniendo orden determinista, no simula al consultar, exige selección exacta y no guarda ni publica al aplicar.

## Resultados observados desde React → NestJS → Python

Misma demanda: 56 cursos, 166 secciones y 332 sesiones. Stack propio con almacén temporal vacío, puertos 5866/3866/3867. LLM deshabilitado; no se usó clave ni se modificó el servicio persistente del operador.

| Recorrido | Inicial | Regeneración real | Resultado |
| --- | --- | --- | --- |
| Ventana + modalidad dividida + asignación T/P y L independiente, sin ampliar carga | 211/332 | 260/332, 125/166 secciones completas | Parcial, 72 pendientes, `search-limit` |
| Mismas opciones + ampliación de carga seleccionada explícitamente | 211/332 | 332/332, 166/166 secciones completas | `complete`, cero pendientes |

Los contadores son mediciones, no constantes del algoritmo. Pueden variar con presupuesto y carga del equipo. Las pruebas distinguen éxito de integración de alcanzar el objetivo; el modo de completitud con carga exige `targetMet=true` y falla si no se alcanza.

**Condición material:** el segundo recorrido selecciona aumentos para 25 docentes sintéticos, desde 600 hasta límites de 780–1500 minutos semanales. No necesita el aumento dirigido adicional de 120 minutos de la hipótesis previa, pero sí los aumentos existentes. No se demostró que estos sean mínimos ni que estén normativamente autorizados. En particular, no se debe convertir estos minutos a carga lectiva institucional sin régimen, equivalencia de hora lectiva y autorización pertinentes. Si esos aumentos no son admisibles, hay que incorporar o redistribuir capacidad docente habilitada y medir de nuevo.

## Reproducción

Requisitos: dependencias del repositorio, entorno Python y Chromium instalados. Compilar el backend de esta revisión antes del runner. No ejecutar build ni transformación SSR mientras el navegador está activo.

```sh
pnpm --dir backend build
SUM_REDESIGN_API_PORT=3866 \
SUM_REDESIGN_ENGINE_PORT=3867 \
SUM_REDESIGN_WEB_PORT=5866 \
SUM_REDESIGN_EVIDENCE=/tmp/completion-without-load \
node client/scripts/verify-planning-redesign-stack.mjs verify-planning-completion.mjs
```

El escenario anterior excluye la ampliación de carga. Para probar el recorrido sintético que la selecciona explícitamente:

```sh
SUM_ASSISTANT_CASES=completion-with-explicit-load \
SUM_REDESIGN_API_PORT=3866 \
SUM_REDESIGN_ENGINE_PORT=3867 \
SUM_REDESIGN_WEB_PORT=5866 \
SUM_REDESIGN_EVIDENCE=/tmp/completion-with-explicit-load \
node client/scripts/verify-planning-redesign-stack.mjs verify-planning-completion.mjs
```

Esta variable selecciona una prueba local, **no otorga autorización institucional**. Las advertencias externas siguen visibles. No se aplica ni guarda nada en el workspace del operador.

## Aceptación y verificaciones

| Criterio | Comprobación | Resultado |
| --- | --- | --- |
| Asignación T/P + L independiente, docente por sesión y legacy | Python y backend, casos anónimos con franjas incompatibles para un docente único | Pasa |
| Ajuste acotado al grupo y responsable determinista | Backend `programacion-academica-session-assignment.spec.ts` | 10/10 pasan |
| Revisión, aprobación y publicación con docentes participantes | Prueba backend del ciclo completo sintético | Pasa |
| Políticas y contratos compartidos | Node tests `shared/academic-planning-policy.test.mjs` y `shared/programacion-academica*.test.mjs` | 62/62 pasan |
| Regresiones backend | `vitest run programacion-academica` | 348/348 pasan |
| Motor y selección exacta del consejero | `pytest test_engine.py test_advisor_agent.py` | 41/41 pasan |
| Estado cliente, hidratación y edición por grupos | `pnpm --dir client test:data` | 312/312 pasan |
| Presentación y selectores accesibles | SSR consejero y componentes normativos | 9/9 y 16/16 pasan |
| Compilación y lint | Backend y cliente | Pasan; advertencias existentes de chunks y lint ajeno al módulo |
| Consulta sin simulación, selección exacta, una regeneración, misma demanda y sin guardado implícito | E2E real propio sin llamadas al modelo | Ambos recorridos pasan |
| Cruces docente/ambiente y solapamientos internos de sección | Pares de asignaciones en respuesta real E2E | Cero |

Los límites de búsqueda y preferencias no son normas. Los ensayos unitarios no sustituyen las comprobaciones de integración. El E2E de este cambio no acredita disponibilidad de Bedrock ni aprobación académica real; el E2E live anterior se conserva separado.

## Límites pendientes

- No hay controles nuevos para editar procedencia o rangos de excepción desde la UI; el contrato los admite y conserva, pero la entrada operativa necesita un flujo aprobado.
- No se implementa la integración institucional ni un catálogo maestro persistente de docentes/cursos/habilitaciones.
- El conflicto entre cursos del mismo ciclo/número de grupo sigue siendo una aproximación local que requiere definición académica de cohortes.
- El reglamento aplicable y los límites docentes institucionales requieren revisión por régimen y periodo antes de usar los aumentos del ejemplo.


Evidencia mínima: [sin ampliar carga](../../evidence/local/academic-completion-2026-11-17/without-load.json) y [con ampliación seleccionada](../../evidence/local/academic-completion-2026-11-17/with-explicit-load.json). La ejecución final de completitud también verifica habilitación por curso, disponibilidad, aforo, tipo laboratorio, suma de minutos por docente y límites de secciones únicas contra la configuración realmente enviada. Todas esas verificaciones pasaron.


## Cierre de hallazgos de auditoría

La revisión independiente del checkpoint b7347fe encontró dos P1 y dos P2, sin P0. Se resolvieron mediante regresiones dirigidas:

- Se conservan cuatro clases de parche. Las tarjetas de distribución horaria y asignación docente siguen separadas, pero ambas usan `change_delivery_mode`, con `deliveryMode` y/o `teacherAssignmentMode` opcionales y al menos un cambio requerido. La forma legacy con `deliveryMode: split` sigue aceptándose; no se publica un quinto `kind`.
- El consejero Python y el local TypeScript usan el perfil para describir ventanas con minutos exactos y solo proponen abrir las que están cerradas. Sábado habilitado de 08:30–13:30 no se describe como cerrado ni como 08:00–13:00.
- El cálculo determinista local de carga recorre cursos en el mismo orden lexicográfico que Python, independiente del orden de los pendientes.
- Python valida el periodo `20xx-I` / `20xx-II`; ambos validadores rechazan periodos mal formados o con espacios/saltos de línea.

Correcciones realizadas por el integrador; no se atribuye una segunda revisión independiente inexistente. La evidencia E2E adjunta se regenera tras estas correcciones con el contrato definitivo.
