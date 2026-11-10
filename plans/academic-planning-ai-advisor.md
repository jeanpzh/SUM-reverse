# Plan — Consejero Agentic con LangChain (`init_chat_model` + Tools CP-SAT), AI Elements y Claridad en Preparación

## Contrato de ejecución PA-ADVISOR-2 (2026-11-08)

Desarrollo de producto: aplicar `AGENTS.md` actualizado; las skills `sum-*` quedan fuera de este trabajo. Preservar `docs/design-direction.md`, las pantallas del alumno y las interfaces existentes. Solo se autorizan cambios del consejero, su solver, contratos/adaptadores y Preparación del producto interno.

- Extender la petición existente con `selectedRecommendationIds?: string[]`. Ausente: simular las recomendaciones por defecto; lista vacía: simular ningún parche. Rechazar IDs desconocidos, sin ampliar el catálogo cerrado de parches.
- Extender la respuesta retrocompatiblemente con `verifiedImpact?`: los seis contadores definidos abajo más `recommendationIds: string[]` y `solverStatus: 'complete' | 'impossible' | 'search-limit'`. Los contadores describen una ejecución real, nunca una garantía de óptimo ni de reproducibilidad de otra ejecución limitada por tiempo. No emitir impacto verificado si no se ejecutó la simulación.
- `reasoningSteps?: Array<{toolName: string; inputSummary: string; outputSummary: string}>` registra únicamente herramientas realmente ejecutadas y resúmenes operativos; no pensamientos internos del modelo.
- Cambiar la selección invalida la vista previa anterior. La UI permite simular la selección actual mediante la misma ruta de consejero; no atribuir a una selección el resultado de otra. Mantener comprobación de versión y evitar respuestas obsoletas.
- Máximo dos rondas de herramientas, con límites también al número de llamadas y al tiempo total. Cada dry-run usa hasta 0.8 s de CP-SAT; la latencia de red del proveedor no permite garantizar 2–3 s totales. Fallos del proveedor conservan el fallback determinista y no simulan llamadas LLM.
- No enviar nombres/IDs docentes al proveedor: usar alias también en argumentos/resultados de herramientas. Mostrar en la UI solo resultados permitidos y rehidratados localmente. Markdown sin HTML crudo.
- 166/166 es un objetivo de aceptación del escenario sintético, pendiente de comprobar; no un resultado ya obtenido. Registrar cobertura real e inconclusión si no se alcanza.

Asignación: un worker posee `planning-engine/`, `shared/programacion-academica-api.*` y los adaptadores/controlador/servicio de consejero en `backend/src/programacion-academica/`; otro posee los archivos del consejero y Preparación en `client/`, sus pruebas y dependencias. Propiedad disjunta; no modificar AGENTS ni cambios ajenos. Se comparte checkout para conservar la base actual no versionada, sin crear commits de cambios previos. El principal integra, verifica el flujo sintético y coordina el navegador secuencialmente.

## 1. Resumen de Decisiones Acordadas (Grilling)

1. **Adaptador universal de LangChain (`init_chat_model`) + Tool Calling**:
   - Usar el inicializador universal built-in de LangChain (`from langchain.chat_models import init_chat_model`) en [`planning-engine/advisor.py`](file:///home/ubuntu/projects/SUM-reverse/planning-engine/advisor.py) para instanciar cualquier proveedor cambiando solo variables de entorno (`model_provider="bedrock_converse"`, `"ollama"`, `"openai"`, `"groq"`).
   - Dotar al agente de herramientas deterministas `@tool` vinculadas con `.bind_tools(...)` (máximo 2 rondas de *tool-calling*, 0.8 s por dry-run CP-SAT):
     - `inspect_bottlenecks`: devuelve el desglose de cuellos de botella (con identidades docentes seudonimizadas `DOCENTE_001`…).
     - `simulate_patches_cpsat(recommendation_ids: list[str])`: aplica en memoria el subconjunto de parches elegidos y ejecuta un dry-run real en OR-Tools CP-SAT (`solver.py`), devolviendo el impacto exacto (`currentCompleteSections -> projectedCompleteSections`, `currentScheduledSessions -> projectedScheduledSessions`).
2. **Resolución de 166/166 secciones en 1 clic (`solver.py` + `advisor.py`)**:
   - **Holgura docente acumulada multi-curso**: En [`planning-engine/advisor.py`](file:///home/ubuntu/projects/SUM-reverse/planning-engine/advisor.py), descontar la bolsa compartida de minutos libres entre todos los cursos pendientes (no curso por curso de forma aislada), sumando un margen de seguridad para evitar una 2.ª iteración.
   - **Candidatos `split` por componente en CP-SAT**: En [`planning-engine/solver.py`](file:///home/ubuntu/projects/SUM-reverse/planning-engine/solver.py), permitir que las secciones en modalidad `split` coloquen sus componentes (`T`, `P`, `L`) en huecos independientes de la cohorte manteniendo un único docente responsable por sección (`assign_teacher[sec, teacher]`), eliminando la congestión en ciclos VII–IX.
3. **Componentes AI Elements + Markdown en el Frontend (`client/src/components/ai-elements/`)**:
   - Instalar `react-markdown` y `remark-gfm` en `client`.
   - Crear componentes estilo **AI Elements** reutilizables en `client/src/components/ai-elements/`:
     - `MessageResponse.tsx`: renderizador Markdown GFM con `.typeset.typeset-planning` (listas, negritas, tablas, bloques de código).
     - `Reasoning.tsx`: bloque colapsable que muestra la traza de razonamiento y las llamadas a herramientas ejecutadas por LangChain (`inspect_bottlenecks`, `simulate_patches_cpsat` con su resultado verificado).
     - `SuggestionCard.tsx`: tarjeta de recomendación con checkbox, badge de impacto, barra de simulación verificada (`verifiedImpact`) y acordeón `<details>` auditable con la lista completa de docentes (`600 → 1200 min`) o cursos afectados.
4. **Claridad en Preparación: Borrador en memoria vs. Acción `POST` y Selección en 1 clic**:
   - Mantener `0` cursos seleccionados al iniciar en frío (preservando compatibilidad con los tests existentes), pero agregar en [`PlanningPreparationSummary.tsx`](file:///home/ubuntu/projects/SUM-reverse/client/src/screens/PlanningPreparationSummary.tsx) y [`AcademicScheduling.tsx`](file:///home/ubuntu/projects/SUM-reverse/client/src/screens/AcademicScheduling.tsx) un botón directo **"Seleccionar los 56 cursos del catálogo"** desde la propia vista **Resumen** (sin obligar a navegar a la pestaña Cursos).
   - Mostrar explícitamente qué controles modifican solo el **Borrador en memoria (`Sin enviar`)** frente a las acciones que ejecutan un **`POST` al servidor** (`Generar horarios · POST /propuestas`, `Guardar propuesta · POST /borradores/guardar`).

---

## 2. Arquitectura del Consejero con `init_chat_model` (Multi-Proveedor)

```mermaid
flowchart LR
  UI["React UI (PlanningStatusBar + AI Elements)"]
  NEST["NestJS :3210 (/propuestas/:id/consejero)"]
  FAST["FastAPI :3220 (/v1/advisor)"]
  CODEC["AdvisorPrivacyCodec (DOCENTE_001)"]
  LC["LangChain init_chat_model()"]
  TOOLS["@tool inspect_bottlenecks / @tool simulate_patches_cpsat"]
  CPSAT["OR-Tools CP-SAT Dry-Run (0.8s)"]
  PROVIDERS["Bedrock Converse | Ollama | OpenAI / Groq"]

  UI -->|POST| NEST -->|HTTP| FAST
  FAST --> CODEC --> LC
  LC <-->|bind_tools (max 2 rounds)| TOOLS
  TOOLS --> CPSAT
  LC --> PROVIDERS
```

### Variables de entorno soportadas por el adaptador LangChain (`planning-engine`)
| Proveedor | `SUM_LLM_PROVIDER` | Variables principales | Modelo por defecto |
| :--- | :--- | :--- | :--- |
| **Amazon Bedrock** | `bedrock_converse` (auto si hay token/IAM) | `AWS_BEARER_TOKEN_BEDROCK` (o `_FILE`), `AWS_REGION` | `us.amazon.nova-lite-v1:0` |
| **Ollama (local)** | `ollama` | `SUM_LLM_BASE_URL=http://127.0.0.1:11434`, `SUM_LLM_MODEL=qwen2.5:7b` | `llama3.1:8b` |
| **OpenAI / Groq / vLLM** | `openai` | `SUM_LLM_BASE_URL`, `SUM_LLM_API_KEY`, `SUM_LLM_MODEL` | `llama-3.3-70b-versatile` |

---

## 3. Cambios por Archivo

### A.Contrato compartido (`shared/`)
- [`shared/programacion-academica-api.mjs`](file:///home/ubuntu/projects/SUM-reverse/shared/programacion-academica-api.mjs) y [`shared/programacion-academica-api.d.mts`](file:///home/ubuntu/projects/SUM-reverse/shared/programacion-academica-api.d.mts):
  - Extender `AcademicAdvisorResponse` con campos opcionales retrocompatibles:
    - `verifiedImpact?: { currentScheduledSessions: number; projectedScheduledSessions: number; requiredSessions: number; currentCompleteSections: number; projectedCompleteSections: number; totalSections: number }`
    - `reasoningSteps?: Array<{ toolName: string; inputSummary: string; outputSummary: string }>`

### B. Worker Python (`planning-engine/`)
- [`planning-engine/pyproject.toml`](file:///home/ubuntu/projects/SUM-reverse/planning-engine/pyproject.toml):
  - Añadir `langchain>=0.3`, `langchain-core>=0.3`, `langchain-aws>=0.2`, `langchain-openai>=0.3`, `langchain-ollama>=0.2`.
- [`planning-engine/models.py`](file:///home/ubuntu/projects/SUM-reverse/planning-engine/models.py):
  - Añadir `AdvisorVerifiedImpact` y `AdvisorReasoningStep` a `AcademicAdvisorResponse`.
- [`planning-engine/solver.py`](file:///home/ubuntu/projects/SUM-reverse/planning-engine/solver.py):
  - En modo `split`, crear variables CP-SAT independientes por componente vinculadas al mismo docente de la sección (`teacher_sec_var`), permitiendo desacoplar Teoría y Práctica/Laboratorio en distintos días/huecos sin colisión de cohorte.
- [`planning-engine/advisor.py`](file:///home/ubuntu/projects/SUM-reverse/planning-engine/advisor.py):
  - Descontar la holgura docente acumulada entre cursos que comparten docentes.
  - Implementar `run_cpsat_dry_run(req, patches, max_time_seconds=0.8)` para calcular `verifiedImpact`.
  - Implementar el agente con `init_chat_model(...)` + `@tool` (`inspect_bottlenecks`, `simulate_patches_cpsat`) con máximo 2 iteraciones, seudonimización `DOCENTE_001` y rehidratación garantizada.
- [`planning-engine/test_engine.py`](file:///home/ubuntu/projects/SUM-reverse/planning-engine/test_engine.py):
  - Añadir test del dry-run CP-SAT verificado y del bucle de tools con LangChain.

### C. Cliente React (`client/`)
- [`client/package.json`](file:///home/ubuntu/projects/SUM-reverse/client/package.json):
  - Añadir `react-markdown` y `remark-gfm`.
- `client/src/components/ai-elements/`:
  - `MessageResponse.tsx`: renderizado Markdown seguro y estilizado con `.typeset.typeset-planning`.
  - `Reasoning.tsx`: componente colapsable estilo AI Elements para mostrar las invocaciones `@tool` (`inspect_bottlenecks`, `simulate_patches_cpsat`) y pasos del agente.
  - `SuggestionCard.tsx`: tarjeta de recomendación con vista previa auditable de los cambios del parche (todos los docentes y cursos afectados).
- [`client/src/screens/PlanningStatusBar.tsx`](file:///home/ubuntu/projects/SUM-reverse/client/src/screens/PlanningStatusBar.tsx):
  - Integrar `MessageResponse`, `Reasoning`, `SuggestionCard` y el banner de **Impacto Verificado en CP-SAT** (`19/166 → 166/166 secciones`).
  - Mostrar estado `Aplicando y regenerando…` en el botón primario y renombrar el botón secundario del footer a `Volver al horario` (evitando el doble botón `Cerrar`).
- [`client/src/screens/PlanningPreparationSummary.tsx`](file:///home/ubuntu/projects/SUM-reverse/client/src/screens/PlanningPreparationSummary.tsx) y [`client/src/screens/AcademicScheduling.tsx`](file:///home/ubuntu/projects/SUM-reverse/client/src/screens/AcademicScheduling.tsx):
  - Añadir botón directo **"Seleccionar los 56 cursos del catálogo"** cuando hay `0` seleccionados en Resumen, enlaces directos desde los contadores (`Cursos seleccionados`, `Docentes`, `Ambientes`) hacia su pestaña y badges claros diferenciando **Edición local en memoria** vs. **Acción de servidor (`POST`)**.

---

## 4. Verificación

1. **Checks rápidos**:
   - `uv run --directory planning-engine pytest -q`
   - `./client/node_modules/.bin/tsc -b client/tsconfig.json`
   - `./backend/node_modules/.bin/tsc --noEmit -p backend/tsconfig.json`
   - `pnpm --dir client lint`
2. **Prueba E2E en vivo en el navegador de T3 Code (`:5413`)**:
   - Seleccionar los 56 cursos en 1 clic desde **Resumen de preparación**, generar propuesta inicial, abrir **Consultar consejero**, verificar la ejecución de tools de LangChain + Bedrock (`Reasoning`), el `verifiedImpact` (`166/166`), y confirmar que al pulsar **Aplicar seleccionadas y regenerar** se alcanza **166/166 secciones completas en 1 sola iteración**.
