# Checkpoint de verificación del solver de completitud y asignación por sesión (`1a38557`)

Fecha de medición: 2026-11-17  
Rama base: `t3/solver-assignment-parity` (checkpoint `1a38557`)  
Alcance: verificación aislada **solo en Python** (`planning-engine/`) con datos **100 % sintéticos** derivados de [`createDemoCatalog()`](file:///home/ubuntu/.t3/worktrees/SUM-reverse/t3-8f7dc393-d3833c50b93a2c08/backend/src/programacion-academica/demo-catalog.ts), [`planningDefaults`](file:///home/ubuntu/.t3/worktrees/SUM-reverse/t3-8f7dc393-d3833c50b93a2c08/shared/academic-planning-policy.mjs#L124-L129) y [`syntheticTeachingMetadata`](file:///home/ubuntu/.t3/worktrees/SUM-reverse/t3-8f7dc393-d3833c50b93a2c08/shared/academic-planning-policy.mjs#L130-L132).

> [!NOTE]
> Este documento cubre únicamente verificación unitaria, de escala y de paridad dry-run/regeneration en Python (`planning-engine`). No sustituye la integración E2E real React + NestJS + Python ni toca UI o contratos `shared/`.

---

## 1. Guardrails, CodeGraph y alcance de código

- **CodeGraph (`codegraph.json`)**: Al inspeccionar [codegraph.json](file:///home/ubuntu/.t3/worktrees/SUM-reverse/t3-8f7dc393-d3833c50b93a2c08/codegraph.json), excluye `datos-reales/`, `.env*`, `*secret*`, `*credential*`, `snapshots/`, etc., pero **no** excluye `client/diagnostics/` ni enlaces simbólicos. Por seguridad se omitió `codegraph init` y toda búsqueda se realizó con `grep` excluyendo rutas privadas y artefactos locales.
- **Datos privados y servicios**: No se listaron ni leyeron `datos-reales/`, `client/diagnostics/`, `.env` ni snapshots de operador; no se iniciaron servidores ni se tocaron puertos `3636`, `3637`, `5636` ni `systemd`; no se realizaron llamadas a proveedores LLM reales.
- **Archivos bajo ownership verificados sin cambios funcionales necesarios en el solver**:
  - [models.py](file:///home/ubuntu/.t3/worktrees/SUM-reverse/t3-8f7dc393-d3833c50b93a2c08/planning-engine/models.py)
  - [solver.py](file:///home/ubuntu/.t3/worktrees/SUM-reverse/t3-8f7dc393-d3833c50b93a2c08/planning-engine/solver.py)
  - [advisor.py](file:///home/ubuntu/.t3/worktrees/SUM-reverse/t3-8f7dc393-d3833c50b93a2c08/planning-engine/advisor.py)
  - [advisor_agent.py](file:///home/ubuntu/.t3/worktrees/SUM-reverse/t3-8f7dc393-d3833c50b93a2c08/planning-engine/advisor_agent.py)

---

## 2. Hallazgos en contratos `shared/` (reportados sin modificar `shared/`)

1. **[`getEffectivePlanningWindows`](file:///home/ubuntu/.t3/worktrees/SUM-reverse/t3-8f7dc393-d3833c50b93a2c08/shared/academic-planning-policy.mjs#L115-L123) no es idempotente respecto a `day === 6`**:
   - En Python ([`get_effective_planning_windows`](file:///home/ubuntu/.t3/worktrees/SUM-reverse/t3-8f7dc393-d3833c50b93a2c08/planning-engine/solver.py#L86-L101)), se filtran previamente los intervalos `w.day != 6` antes de añadir el sábado resuelto del perfil.
   - En JS (`shared/academic-planning-policy.mjs`), `baseWindows.map(...)` conserva cualquier `day === 6` previo y hace `result.push({ day: 6, ... })` encima. Con ventanas base L–V (`1..5`) es equivalente, pero duplicaría entradas de sábado si se re-aplica sobre ventanas ya expandidas.
2. **[`validateAcademicProposal`](file:///home/ubuntu/.t3/worktrees/SUM-reverse/t3-8f7dc393-d3833c50b93a2c08/shared/programacion-academica-api.mjs#L485-L529) depende de `sessionType` opcional para agrupar `L`**:
   - `assignments[]` define `sessionType` como campo opcional (L485), mientras [`getSectionComponentGroups`](file:///home/ubuntu/.t3/worktrees/SUM-reverse/t3-8f7dc393-d3833c50b93a2c08/shared/programacion-academica-api.mjs#L521) usa `assignment.sessionType ?? assignment.type` para separar laboratorio `'L'` en modo `tp-grouped-l-independent`. Si algún productor omite `sessionType` en un curso `tp-grouped-l-independent` con docente distinto para `L`, el validador lo rechazará como `Sección con docentes responsables distintos` (mitigado actualmente porque backend y `solver.py` pueblan `sessionType`).

---

## 3. Cobertura de pruebas Python (`pytest`)

Se añadieron pruebas unitarias y de paridad en [test_engine.py](file:///home/ubuntu/.t3/worktrees/SUM-reverse/t3-8f7dc393-d3833c50b93a2c08/planning-engine/test_engine.py) y [test_advisor_agent.py](file:///home/ubuntu/.t3/worktrees/SUM-reverse/t3-8f7dc393-d3833c50b93a2c08/planning-engine/test_advisor_agent.py) cubriendo:

- **Asignación por grupo y `split` (`tp-grouped-l-independent`)**: docente común para `T+P` (incluso divididos entre días distintos en `deliveryMode="split"`), docente distinto para `L` en ambiente `kind="laboratory"`, y bloqueo explícito cuando dos docentes de 120 min intentan dividir `T` y `P` en ese modo.
- **Asignación `per-session`**: tres docentes distintos cubren `T`, `P` y `L` de una misma sección con cero solapamientos internos (`SECTION_CONFLICT` verificado negativamente en franja única compartida).
- **Límite único de secciones (`sectionLimits`)**: `maxSections=1` permite a un docente cubrir múltiples grupos (`T+P` y `L`, o `T`, `P` y `L` en `per-session`) de una misma sección, pero impide tomar grupos de una segunda sección del mismo curso.
- **Excepciones de sábado y no-invención**: validación estricta de `allowSaturday` requerido para `exceptions`, rechazo de rangos inválidos (`start >= end`) y de `facultyId` desconocido, tope por defecto `780` (13:00), ventana explícita `840..1080` y garantía de 0 asignaciones en sábado cuando los recursos solo tienen disponibilidad L–V.
- **Compatibilidad legacy**: omitir `teacherAssignmentMode`, `facultyId`, `source`, `exceptions` y `allocationPolicy` conserva exactamente `"single-teacher-section"`, `"FISI"`, `780` y `"preferences"`.
- **Diferenciación real de `allocationPolicy`**: contraste verificable entre `"preferences"` (concentra en docente con preferencias, carga máxima 240 min), `"balanced"` (equilibra a 120 min máx.) y `"first-feasible"`.
- **Consejero: cinco tarjetas en cuatro clases y paridad**: orden determinista de las 5 recomendaciones preservado incluso si el LLM reordena `prioritizedIds`, respeto estricto de `selectedRecommendationIds`, cero ejecuciones CP-SAT en consulta (`selectedRecommendationIds=None`) y paridad exacta entre `run_cpsat_dry_run` y `POST /v1/solve` (`maxTimeSeconds=2.5`) sin inventar disponibilidad de sábado.

---

## 4. Medición reproducible sobre catálogo sintético `2027-I`

Script independiente: [measure_completion_checkpoint.py](file:///home/ubuntu/.t3/worktrees/SUM-reverse/t3-8f7dc393-d3833c50b93a2c08/planning-engine/scripts/measure_completion_checkpoint.py)

### 4.1 Receta de entrada sintética

- **Periodo**: `2027-I` (`revision="FISI-PLANNING-1"`, `facultyId="FISI"`).
- **Demanda**: 56 cursos (`180` si ciclo impar, `90` si ciclo par; `targetCapacity=45`) → **166 secciones**, **332 sesiones requeridas**, **44,520 min/semana** de demanda total.
- **Recursos**: 91 `referenceTeachers` (`maxWeeklyMinutes=600`, metadatos `syntheticTeachingMetadata(index)`, capacidad nominal total `54,600 min/semana`) y 49 `referenceRooms` (33 `classroom`, 16 `laboratory`), todos con disponibilidad únicamente **L–V 08:00–22:00** (`0` recursos con disponibilidad en sábado).
- **Estado inicial**: `allowAfternoon=false`, `allowSaturday=false`, `deliveryMode="continuous"`, `teacherAssignmentMode="single-teacher-section"`, `allocationPolicy="preferences"`.

### 4.2 Resultados medidos (presupuesto `<= 10 s`, invariantes duros validados)

| Escenario | Presupuesto | Tiempo real | Estado (`limitReason`) | Sesiones | Secciones completas | Sáb. | Tarde >=VII | Máx. carga docente |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline (L–V 8–22, >=VII 18–22, `continuous`, `single-teacher-section`, 600 m) | 2.5 s | 2.304 s | `search-limit` (`time`) | 211 / 332 | 108 / 166 | 0 | 0 | 600 min |
| Misma carga (600 m) + `enable_planning_window` (`allowAfternoon` + `allowSaturday`) | 2.5 s | 2.651 s | `search-limit` (`time`) | 243 / 332 | 124 / 166 | 0 | 35 | 600 min |
| Misma carga (600 m) + ventana + `split` en todos los cursos | 2.5 s | 2.577 s | `search-limit` (`time`) | 243 / 332 | 124 / 166 | 0 | 20 | 600 min |
| Misma carga (600 m) + ventana + `split` + `tp-grouped-l-independent` | 2.5 s | 2.562 s | `search-limit` (`time`) | 260 / 332 | 126 / 166 | 0 | 21 | 600 min |
| Misma carga (600 m) + ventana + `split` + `tp-grouped-l-independent` | 10.0 s | 10.143 s | `search-limit` (`time`) | 260 / 332 | 126 / 166 | 0 | 20 | 600 min |
| Misma carga (600 m) + ventana + `split` + `per-session` | 2.5 s | 2.700 s | `search-limit` (`time`) | 264 / 332 | 126 / 166 | 0 | 22 | 600 min |
| Misma carga (600 m) + ventana + `split` + `per-session` | 10.0 s | 10.070 s | `search-limit` (`time`) | 264 / 332 | 126 / 166 | 0 | 65 | 600 min |
| Consejero: 3 recs legacy (`load` + `window` + `delivery_mode`) | 2.5 s | 2.550 s | `search-limit` (`time`) | 330 / 332 | 165 / 166 | 0 | 45 | 1440 min |
| Consejero: **4 recs** (`legacy` + `tp-grouped-l-independent`) | 2.5 s | 1.976 s | **`complete`** (`null`) | **332 / 332** | **166 / 166** | 0 | 41 | 1440 min |

Observaciones clave:

- **Por qué `600 min/sem` no alcanza `332/332` ni con `per-session` ni con 10 s**: Aunque la capacidad nominal agregada (`54,600 min`) supera la demanda (`44,520 min`), existen **17 cursos** cuya demanda supera el pool de docentes habilitados para ese curso a `600 min`:
  - `INE002` (720 vs 1 docente = -120 min), `20118053` y `20118075` (1440 vs 2 docentes = -240 min c/u),
  - `20118071`, `20118076`, `20118077`, `20118092`, `20118093`, `20118095` (960 vs 1 docente = -360 min c/u),
  - `20118036`, `20118051`, `20118054`, `20118073` (1200 vs 1 docente = -600 min c/u),
  - `INO104`, `INO106`, `20118031`, `20118037` (1440 vs 1 docente = -840 min c/u).
- **Cargas ajustadas por la recomendación `rec-increase-teacher-load` (sujetas a autorización externa; no se afirma minimalidad)**: Para la línea base de `211/332`, el consejero determinista generó ajustes sobre **25 docentes anonimizados** pasando de `600 min` a:
  - `780 min`: `DOCENTE_001`, `DOCENTE_040`
  - `840 min`: `DOCENTE_036`, `DOCENTE_037`, `DOCENTE_073`
  - `900 min`: `DOCENTE_077`, `DOCENTE_083`
  - `960 min`: `DOCENTE_031`, `DOCENTE_032`, `DOCENTE_063`, `DOCENTE_064`
  - `1020 min`: `DOCENTE_059`, `DOCENTE_065`, `DOCENTE_066`, `DOCENTE_074`, `DOCENTE_084`
  - `1200 min`: `DOCENTE_041`
  - `1260 min`: `DOCENTE_013`, `DOCENTE_033`, `DOCENTE_039`
  - `1440 min`: `DOCENTE_062`
  - `1500 min`: `DOCENTE_006`, `DOCENTE_007`, `DOCENTE_029`, `DOCENTE_034`
  Con esos topes y las 4 recomendaciones activas, la carga efectiva máxima observada en la solución completa fue `1440 min` (sin usar el hipotético `+120 min` ad-hoc: el paso de `330/332` a `332/332 complete` ocurre al activar `tp-grouped-l-independent`).
- **Políticas `allocationPolicy` en el caso completo de 56 cursos**: En `all-4 recs` a `5.0 s`, las tres políticas (`preferences`, `balanced`, `first-feasible`) alcanzan `332/332 complete` con carga máxima `1440 min` (fijada inevitablemente por los cursos de 1 solo docente habilitado como `INO104`/`20118037`). La diferenciación estricta de objetivos entre las tres políticas queda verificada en `test_allocation_policy_three_way_differentiation`.
- **Sábado sin invención**: En todas las corridas con `allowSaturday=true`, `saturdayAssignments = 0`, ya que `0` docentes y `0` ambientes del catálogo de referencia poseen disponibilidad en sábado.

### 4.3 Paridad simulación (`run_cpsat_dry_run`) vs regeneración (`solve_academic_schedule`)

| Selección de recomendaciones | Dry-run (2.5 s) | Regeneración (2.5 s) | Paridad exacta |
| --- | --- | --- | --- |
| `['rec-enable-planning-window']` | 243 / 332 (`124` sec., `search-limit`, 2.495 s) | 243 / 332 (`124` sec., `search-limit`, 2.534 s) | Sí |
| `['rec-enable-planning-window', 'rec-change-delivery-mode']` | 243 / 332 (`124` sec., `search-limit`, 2.575 s) | 243 / 332 (`124` sec., `search-limit`, 2.587 s) | Sí |
| `['rec-enable-planning-window', 'rec-change-delivery-mode', 'rec-change-teacher-assignment-mode']` | 260 / 332 (`126` sec., `search-limit`, 2.087 s) | 260 / 332 (`126` sec., `search-limit`, 2.374 s) | Sí |
| `['rec-increase-teacher-load', 'rec-enable-planning-window', 'rec-change-delivery-mode']` | 330 / 332 (`165` sec., `search-limit`, 2.068 s) | 330 / 332 (`165` sec., `search-limit`, 2.550 s) | Sí |
| Las 4 recomendaciones (incluye `tp-grouped-l-independent`) | **332 / 332** (`166` sec., `complete`, 2.429 s) | **332 / 332** (`166` sec., `complete`, 1.976 s) | Sí |

---

## 5. Nota sobre sensibilidad temporal en `test_solver_scale.py`

Al ejecutar `pytest` combinado junto con `test_advisor_agent.py`, el subcaso de `budget=0.8 s` con `split=True, tpl=False` en [test_solver_scale.py](file:///home/ubuntu/.t3/worktrees/SUM-reverse/t3-8f7dc393-d3833c50b93a2c08/planning-engine/test_solver_scale.py#L93) agotó el margen de preparación CP-SAT en una corrida (`272` sesiones frente al piso `300`, `limitReason='time'`, `exploredCandidates=0`). Al ejecutarse de forma aislada según lo documentado en [planning-engine/README.md](file:///home/ubuntu/.t3/worktrees/SUM-reverse/t3-8f7dc393-d3833c50b93a2c08/planning-engine/README.md#L154-L155), pasó en `11.24 s` (`330/332` en `0.991 s` para `budget=0.8 s` y `332/332 complete` en `2.128 s` para `budget=2.5 s`).
