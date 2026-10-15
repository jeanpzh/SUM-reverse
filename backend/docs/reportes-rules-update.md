# Revisión de Reportes con las reglas locales de backend

Fecha: 2026-10-08

## Resultado

No se modificó código: la revisión del módulo no encontró una brecha concreta frente a `backend/AGENTS.md`, `backend/.agents/skills/sum-nestjs-implement/SKILL.md` y `reportes-api-v1`. Un cambio sin evidencia de incumplimiento agregaría riesgo sin cambiar un criterio observable.

## Criterios comprobados

- **Contrato y separación por capas:** `reportes.controller.ts` expone las seis consultas POST locales; `consulta-reporte.pipe.ts` valida en el límite HTTP; `reportes.service.ts` forma el envelope; `reportes.repository.ts` selecciona y copia fixtures definidos en `reportes.fixtures.ts`.
- **Validación de entrada:** el pipe exige la acción literal correspondiente, rechaza query extra y cuerpo no vacío con `INVALID_ACTION`, `INVALID_QUERY` e `INVALID_BODY`, y evalúa en el orden definido por el contrato. La evidencia `check-results.json` registra acción ausente, errónea y duplicada, query extra y body rechazados.
- **Datos y repetibilidad:** los fixtures son sintéticos (`DEMO-001`); `REPORTES_FIXTURE` admite `populated`/`empty`, rechaza otros valores al construir el repositorio, y cada lectura devuelve una copia profunda. El modo vacío conserva formulario y metadatos de matrícula.
- **Sin escritura ni dependencias externas:** los handlers solo llaman a `consultar`; el repositorio opera en memoria. No se observa cliente HTTP, import de `client/`, persistencia externa, autenticación ni llamadas SUM en el módulo revisado. La matriz de integración registra `externalRequests: []`.
- **Resultados:** `check-results.json` marca `R-HTTP`, `R-INVALID`, `R-UI`, `R-GUARD`, `R-RETRY`, `R-REPEAT`, `R-EMPTY` y `R-CSV` como aprobados contra NestJS real. `boundary-results.json` registra estados de carga y un fallo de contrato inyectado como experimento sintético.

## Límites de esta revisión

El contrato y los fixtures declaran las formas y los valores como `local-only`; no verifican implementación privada ni comportamiento de SUM. Esta revisión fue estática y reutilizó la evidencia local existente. No ejecutó el servidor, build, lint, pruebas ni navegador; por tanto, no añade una afirmación de verificación nueva. Las comprobaciones funcionales citadas son las ya registradas en `evidence/local/reportes/check-results.json` y `boundary-results.json`.
