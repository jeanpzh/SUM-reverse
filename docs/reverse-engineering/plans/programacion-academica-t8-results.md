# T8 — candidatos completos y límites honestos

Fecha: 2026-11-11. Checkout: `/home/ubuntu/.t3/worktrees/SUM-reverse/t3-81820e33`,
rama `feat/planning-normative-engine`, HEAD `1f7063d`, sin commit.
Contrato: encargo T8 al final de `programacion-academica-normative-engine.md`,
ADR 0003, PA-ENGINE-2 y PA-ENGINE-JOBS-1/PA-PLANNING-JOBS-1 existentes.
Es un cambio del producto interno (`local-only`), con observaciones locales sintéticas;
no acredita comportamiento SUM ni cumplimiento normativo de publicación.

## Alcance y archivos

- `planning-engine/solver.py`: elimina límite de 24 posiciones y selección de un solo
  ambiente por posición; factoriza tiempos/docentes y ambientes sin perder combinaciones.
  Publica cada mejora del testigo rápido incluso en problemas pequeños, conserva el mejor
  testigo lexicográfico entre etapas y comprueba plazo/cancelación dentro de generación.
- Nuevo `planning-engine/test_candidate_exhaustiveness.py`: 30 pruebas, fixtures inventados
  desde cero, oráculo independiente y fallos controlados de plazo/cancelación.
- `planning-engine/test_capacity_prelation.py`: actualiza solo las expectativas antiguas
  sobre falta de prueba por muestreo (dos pruebas). Conserva las adiciones T7 existentes.
- `planning-engine/test_solver_scale.py`: actualiza la expectativa del conflicto de
  componentes partidos: el modelo completo ahora prueba el faltante.
- Este informe nuevo. El plan principal y jobs/models/backend/client/shared no se editan.

Se preservan las modificaciones iniciales T7/T4b, incluido `coverage_weight =
20 * len(section_options) + 1` y la prueba exhaustiva de cobertura únicamente con
optimalidad y sin sustitución por testigo. Sin cambios de pantallas, interfaces,
contratos ni perfil normativo; `docs/design-direction.md` permanece intacto.
No instalaciones, hijos, commits, merges, resets ni nuevos worktrees.

## Diagnóstico y solución

Se aplicó `diagnosing-bugs`. CodeGraph y su configuración existentes se comprobaron;
`codegraph explore "planning-engine/solver.py candidate generation placements proof tests"`
fue la primera consulta de código. No se inicializó ni reindexó. Lecturas directas para
los rangos y pruebas no entregados en esa consulta. No hay AGENTS adicionales dentro
 de planning-engine. Se leyeron RTK, instrucciones raíz, glosario y ADR 0003.

Hipótesis comprobadas por la regresión: posiciones posteriores a 24 quedan fuera;
el ambiente elegido por rotación puede ser precisamente el que necesita otra sección;
las alternativas inyectadas del incumbente representan el mismo horario con puntuación
artificial. Las dos primeras causaban pérdida de cobertura/prelación; las últimas se
retiran del modelo y el testigo se conserva por separado.

La representación continua elige docente/inicio del bloque, y cada componente elige
cualquier ambiente compatible a su inicio desplazado. La representación partida elige
un docente para toda la sección y un inicio por componente. En ambas, para cada
(sección, componente, día, inicio), la suma de elecciones de ambiente es igual a la suma
de las activaciones por docente. Esta suma es booleana porque solo un docente/opción
puede poseer la sección. La disponibilidad del ambiente no depende del docente.
Por ello compartir las elecciones de ambiente es una factorización exacta: cada horario
original tiene una representación y cada solución representada da un horario válido.
Evita el producto cartesiano de ambientes entre componentes y la duplicación por docente.

Se conservan disponibilidad, capacidad/tipo de ambiente, continuidad, docente único,
carga y secciones máximas, elegibilidad y conflictos exactos de docente/ambiente/cohorte.
La secuencia continúa siendo cobertura → contrato → interfacultativo → rango → preferencias,
fijando valores óptimos y dejando libres las asignaciones. Las preferencias partidas
mantienen la puntuación existente del motor; T8 no añade una política de preferencias.

No se añade poda heurística. Se deduplican únicamente posiciones idénticas de ventanas
solapadas. Se rechazan opciones por restricciones duras existentes. Los caches LRU de
8192 entradas pueden expulsar resultados para recalcularlos; no eliminan candidatos.
Un modelo parcial se descarta al interrumpir su construcción y nunca se resuelve como
si fuera exhaustivo. El testigo completo prueba cobertura, y por sí solo jamás prelación.
Las mejoras CP-SAT también se conservan por calidad lexicográfica aunque una etapa sin
prueba devuelva otro horario con iguales sesiones y peores niveles posteriores.

## Aceptación

| Criterio | Escenario/check sintético | Esperado | Actual |
| --- | --- | --- | --- |
| Eliminar cap continuo/partido | X necesita posiciones después de 24; Y ocupa el tramo inicial con ambiente de mayor capacidad y disponibilidad fija | Cobertura completa con A | Verde en ambos modos |
| Mejor docente excluido por cap | Mismo caso con C contratado habilitado solo para X | Toda la cobertura con A, contrato=0, niveles probados | Verde en ambos modos |
| Todos los ambientes | X flexible y Y requiere el ambiente grande durante todo el intervalo | X usa el pequeño en todos sus componentes | Verde continuo y partido |
| Referencia exhaustiva independiente | Enumeración de horarios completos sin helpers del solver ni CP-SAT, seis combinaciones de los casos anteriores | Mismo vector cobertura/contrato/interfacultad/rango | 6/6 coincidencias |
| Plazo/cancelación durante construcción | Reloj/cancel inyectados al crear inicio/opción y ambiente; dos modos, con testigo completo/parcial | Conservar horario válido; completo solo acredita cobertura; sin pruebas de prelación; motivo time/cancelled para parcial | 16/16 verdes |
| Cancelar antes de generar | should_cancel verdadero desde el inicio | Vacío, inconclusive, cancelled, prelación sin probar | Verde |
| Primera publicación temprana | Hook guarda fases al recibir testigo | Testigo en preparing, antes de capacidad/modelo | Verde; escala medida abajo |
| T7 y contratos existentes | Capacidad/prelación, ventanas, escala, jobs | Restricciones, peso dinámico, pruebas honestas y proceso cancelable | Suite secuencial 67/67; suite enfocada ampliada 30/30 |
| Conflicto real con candidatos completos | Un docente no puede cubrir dos componentes; dos ambientes disponibles | shortfall-proven, impossible, sin motivo de límite | Verde; sustituye expectativa histórica de muestreo |
| Dirección visual e interfaces | Diff por propiedad de archivos | Sin cambios UI/TS/contratos por T8 | Verificado; sin navegador ni builds innecesarios |

## Red/green y comandos

Todos los comandos desde el checkout explícito indicado arriba, usando `.venv` existente.
No se usaron servidores del operador, producción, exports ni fuentes privadas. Los jobs
usan su TestClient local y procesos propios; sus pruebas comprueban cancelación/terminación.

1. Red definitivo, antes del cambio del solver:
   `planning-engine/.venv/bin/python -m pytest planning-engine/test_candidate_exhaustiveness.py -q`
   → **6 failed**, 0.48 s. Sin C, cobertura inconclusa en continuo/partido; con C, docente
   contratado innecesario; ambientes, cobertura inconclusa. La primera versión del fixture
   dejaba desplazar también Y; se fijó su disponibilidad antes de este red definitivo.
2. Green inicial más regresiones:
   `planning-engine/.venv/bin/python -m pytest planning-engine/test_candidate_exhaustiveness.py planning-engine/test_capacity_prelation.py planning-engine/test_window_decisions.py -q`
   → 39 passed, dos expectativas históricas sobre muestreo fallaron y se actualizaron.
3. Primera ronda escala/jobs:
   `planning-engine/.venv/bin/python -m pytest planning-engine/test_solver_scale.py planning-engine/test_solve_jobs.py -q -s`
   → 12 passed, dos fallos: expectativa antigua y tiempo 2.887 s para presupuesto 2.5 s.
   Se compartieron variables de ambiente entre docentes. Una repetición todavía midió
   2.800 s; instrumentación efímera en el comando ubicó el paro de generación a 2.503 s
   y el retorno a 2.734 s, atribuible a liberar el modelo parcial. Sin archivos de debug.
4. Se reserva el décimo final del mismo presupuesto del request para liberar objetos y
   transferir a búsqueda. No es un límite nuevo de candidatos, ni se cambia maxTimeSeconds;
   agotar la preparación devuelve testigo/inconclusive. No se relajó la tolerancia del test.
   Es una reserva operativa local, no una garantía universal de tiempo real del runtime.
5. Ronda secuencial final del solver y contratos Python relevantes:
   `planning-engine/.venv/bin/python -m pytest planning-engine/test_candidate_exhaustiveness.py planning-engine/test_capacity_prelation.py planning-engine/test_window_decisions.py planning-engine/test_solver_scale.py planning-engine/test_solve_jobs.py -q -s`
   → **67 passed**, 16.79 s. Escala inicial 0.761 s, 211 sesiones; parches continuo 0.760 s,
   322/332; partido 0.772 s, 330/332; partido presupuesto 2.5 s: 2.372 s, 330/332.
   Jobs: cancelación 4 ms y peor health 16 ms. Aviso preexistente langchain-community.
6. Después se amplió solo la parametrización de interrupciones a inicio/ambiente y
   continuo/partido. Mismo comando enfocado del punto 1 → **30 passed**, 0.62 s.
   Unión de cobertura ejecutada: **79 casos distintos verdes**; no se afirma una ejecución
   conjunta de los 79. No hubo cambios de solver después de la ronda de 67.
7. `git diff --check` → verde. HEAD/rama confirmados sin cambios.

## Medición adicional acotada y reproducible

Procedencia: fixture `test_solver_scale.scale_request.__wrapped__()` existente, que importa
solo `createDemoCatalog` puro y construye demanda/requisitos independientes sintéticos.
No es un generador derivado de snapshots. Presupuesto 2.5 s; comprobación posterior con
`assert_hard_constraints`. Comando exacto (heredoc desde raíz del checkout):

```sh
planning-engine/.venv/bin/python - <<'PY'
import sys, time, resource
sys.path.insert(0, 'planning-engine')
from solver import SearchHooks, solve_academic_schedule, search_workers
from test_solver_scale import scale_request, assert_hard_constraints
req = scale_request.__wrapped__()
req.maxTimeSeconds = 2.5
phases, witnesses = [], []
started, cpu = time.monotonic(), time.process_time()
result = solve_academic_schedule(req, SearchHooks(on_phase=phases.append,
    on_improvement=lambda rows: witnesses.append((time.monotonic() - started, len(rows)))))
elapsed, cpu_elapsed = time.monotonic() - started, time.process_time() - cpu
assert_hard_constraints(req, result)
print(dict(courses=len(req.courses), teachers=len(req.teachers), rooms=len(req.rooms), sections=len(req.sections), sessions=len(req.requirements), budget=req.maxTimeSeconds, workers=search_workers(), elapsed=round(elapsed, 4), cpu=round(cpu_elapsed, 4), peakRssKiB=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss, firstWitness=witnesses[0], lastWitness=witnesses[-1], improvements=len(witnesses), phases=phases, scheduled=len(result.assignments), coverageProof=result.coverageProof, limitReason=result.limitReason, candidateVisits=result.candidateVisits, prelation=result.prelation))
PY
```

Resultado: 56 cursos, 91 docentes, 49 ambientes, 166 secciones y 332 sesiones;
2 workers disponibles; pared **2.4393 s**, CPU **2.3893 s**, RSS máximo del proceso
**357504 KiB** (incluye imports del harness). Primer testigo: 3 sesiones a **0.003202 s**;
mejor inicial: 211 sesiones a **0.009414 s**, 108 mejoras. Fases preparing/capacity;
10933 visitas; final **search-limit / inconclusive / time**, prelación ausente porque
este fixture no trae prioridades completas. La construcción exhaustiva no terminó
con ese presupuesto. Sin CPU de búsqueda huérfana: el comando síncrono terminó y los
jobs verificaron terminación de sus procesos. Sin benchmark de 120 segundos.

## Límites honestos

La generación sigue creciendo con secciones, docentes, inicios, componentes y ambientes;
la factorización evita productos innecesarios, pero no garantiza completar cualquier modelo
ni limita universalmente la memoria de CP-SAT. El plazo y la reserva operativa limitan
trabajo y permiten conservar testigos; estos casos de escala no prueban prelación óptima.
No se añadió un cupo de memoria/candidatos ni un campo de contrato. Los resultados
medidos son válidos para estos fixtures y esta máquina de 2 CPU. La cancelación de un
solve nativo sin nuevas soluciones sigue supervisada por el job manager existente.
No se revisó ni implementó T6b ni la auditoría concurrente T4b. Sin bloqueos de interfaz.
