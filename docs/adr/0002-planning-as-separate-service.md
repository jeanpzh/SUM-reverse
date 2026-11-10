# Servicio de planificación académica independiente de SUM con contrato HTTP explícito

La programación académica (`/local/programacion-academica`, incluyendo su motor determinista, almacenamiento de **Borradores**/**Publicaciones** y el **Consejero de planificación** de [ADR-0001](./0001-hybrid-llm-planning-advisor.md)) se concibe y despliega como un **servicio independiente** del backend estudiantil/docente de SUM. La integración entre ambos contextos ocurre exclusivamente mediante contratos HTTP explícitos (`shared/programacion-academica-api.mjs` / esquema OpenAPI) y adaptadores de frontera, sin compartir estado en memoria ni acoplar el ciclo de despliegue de SUM a los requisitos de cómputo o secretos (`SUM_LLM_*`) de la oficina académica.

## Contexto y problema

1. **Dos dominios con actores y ciclos de vida distintos**:
   - **Backend SUM** (`matricula-regular`, `prematricula`, `asistencias`, `reportes`, `tutoria`): sistema transaccional orientado a estudiantes y docentes.
   - **Servicio de Planificación Académica** (`programacion-academica` + `AcademicAdvisorModule` + motor/solver): herramienta interna de gabinete para la escuela profesional.
2. **Requisitos operativos divergentes**: el servicio de planificación concentra algoritmos intensivos (heurístico determinista hoy; solver CP-SAT en Python como evolución natural) y credenciales de salida hacia proveedores LLM (`SUM_LLM_API_KEY`, timeouts de 8 s). Mantenerlo acoplado al proceso de SUM mezcla superficies de seguridad y dificulta evolucionar o reemplazar el lenguaje del planificador.
3. **Acoplamiento accidental actual**: aunque `backend/src/programacion-academica/local-main.ts` ya permite levantar el servicio por separado en el puerto `3210`, el cliente redirige todo por un único proxy (`/api`) y existen importaciones cruzadas en código (`prematricula` y `operational-offer` inyectan `SavedDraftService` directamente; `programacion-academica` importa tipos y semillas internas de `matricula-regular`).

## Decisión: Separación en 2 etapas

### Paso 1 (inmediato): Frontera de servicio NestJS independiente y proxy dedicado

1. **Proceso y puerto propios**: el servicio de planificación se ejecuta desde `local-main.ts` como proceso autónomo (por defecto `http://127.0.0.1:3210`), separado del backend SUM (`http://127.0.0.1:3000`).
2. **Enrutamiento de frontera en el cliente**: Vite y el proxy inverso enrutan `/api/local/programacion-academica/v1` hacia `VITE_SUM_PLANNING_API_PROXY_TARGET` (con fallback a `VITE_SUM_API_PROXY_TARGET` para compatibilidad en entornos de un solo proceso), mientras el resto de `/api` sigue apuntando al backend SUM.
3. **Dirección única de dependencias y contrato de publicación**:
   - El contrato wire (`shared/programacion-academica-api.mjs`, futuro artefacto OpenAPI/JSON Schema) es la única interfaz compartida.
   - Cuando SUM (`operational-offer`, `prematricula`) necesita consultar una **Publicación** vigente o específica, la consume a través de un puerto/adaptador de lectura (`AcademicPublicationReader`: HTTP hacia `/local/programacion-academica/v1/publicaciones/...` o lectura acotada del almacén publicado) en lugar de acoplarse al módulo interno del planificador.
   - `programacion-academica` no importa tipos internos de `matricula-regular` (`Meeting`, `CourseDocument`); define sus propios tipos de dominio horario y aísla la carga de semillas sintéticas en su adaptador de catálogo.
4. **Ubicación del Consejero IA (ADR-0001)**: `AcademicAdvisorModule` vive **dentro del Servicio de Planificación Académica** (no en el backend de SUM), ya que necesita inspeccionar la `RetainedProposal` y los diagnósticos del motor horario.

### Paso 2 (evolución posterior): Sustitución opcional del motor/servicio por Python (FastAPI + OR-Tools CP-SAT)

Una vez consolidada la frontera HTTP del Paso 1, el Servicio de Planificación Académica puede migrarse total o parcialmente a **Python (FastAPI + OR-Tools CP-SAT + cliente LLM)** manteniendo intactos:
- el cliente React (`client/src/data/academicScheduling.ts`),
- el backend SUM en NestJS, y
- las invariantes de [ADR-0001](./0001-hybrid-llm-planning-advisor.md) (el solver determinista/CP-SAT sigue siendo la única autoridad sobre `assignments`; el LLM solo explica y prioriza **Recomendaciones** sobre entradas).

## Opciones consideradas

- **Mantener todo en un único backend monolítico NestJS para siempre**: rechazado porque contradice la separación real de productos (oficina de planificación vs. portal estudiantil SUM), acopla secretos/timeouts de IA al proceso de alumnos y bloquea la adopción futura de motores especializados de horarios (OR-Tools CP-SAT).
- **Reescribir de inmediato todo el planificador y sus validadores en Python/Go antes de separar la frontera**: rechazado como primer paso porque mezcla dos riesgos (corte arquitectónico + reescritura completa de reglas de negocio, borradores, revisión docente y publicaciones). Extraer primero la frontera en el código existente hace que el reemplazo posterior del motor sea seguro y verificable contra el mismo contrato HTTP.
- **Extraer únicamente el Consejero LLM a un microservicio FastAPI dejando el motor horario dentro de SUM**: rechazado porque cortaría por el lugar equivocado; el consejero y el motor de horarios pertenecen al mismo contexto delimitado de Planificación Académica.
