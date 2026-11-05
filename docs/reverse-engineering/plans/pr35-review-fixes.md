# Correcciones de revisión de PR #35

Autor y aceptación integrada: principal. Fuente: revisión estática de `c79ac61`,
contratos locales E2 y plan `prematricula-e2-draft.md`. Alcance local sintético;
no se inspecciona producción ni datos privados. Un único ciclo de corrección.

Se preservan la fidelidad visual y de interacción de las pantallas SUM existentes,
sus estilos y componentes. Solo se autoriza corregir el estado asíncrono del panel
local de prematrícula y la clasificación HTTP del servicio E2; sin rediseños.

| Tarea | Archivos exclusivos | Criterio y comprobación | Responsable |
| --- | --- | --- | --- |
| F1 | `client/src/screens/StudentPreEnrollment.tsx` | La hidratación inicial obsoleta no reemplaza una publicación consultada o selección editada, ni muestra un error tardío. Comprobar con respuesta A demorada, consulta/edición de B y liberación de A; además build/lint. | Implementador GPT-6 Luna High |
| F2 | `backend/src/prematricula/prematricula.service.ts`, `backend/test/prematricula-service.spec.ts` | Fallo de almacenamiento upstream conserva HTTP 503 y el filtro E2 devuelve STORAGE_UNAVAILABLE; ausencia permanece 404 y publicación inválida 409. Pruebas sintéticas dirigidas y build/lint. | Implementador GPT-6 Luna High |

Contratos existentes sin cambios: `contracts/local-api/prematricula-e2.md`,
`contracts/local-api/prematricula-intention.md`; ninguna dependencia entre F1/F2.
El principal conserva navegador, scripts de verificación y este documento.
Los perfiles TOML citados por las instrucciones no existen en este checkout;
se usan los overrides reales del harness `gpt-6-luna` y razonamiento `high`.

La limpieza previa elimina 323 entradas `.pnpm-store` sin abrir su contenido,
añade su exclusión en `.gitignore` y CodeGraph y conserva el código de la PR.

Estado F1/F2: implementadas por dos trabajadores con overrides reales
GPT-6 Luna High y propiedad de archivos disjunta; verificadas por el principal.
Véase [aceptación](../../../evidence/local/pr35-review/fullstack-verification.md).

Decisión posterior al diagnóstico de verificación: el escenario E2 de recuperación
se detuvo porque el texto de cruce aparece legítimamente en dos paneles. Se acotó
su selector a `.student-premat__warning`, sin cambiar la aplicación, y se repitió
con un namespace sintético nuevo. Esta es una corrección aislada del verificador
por el principal; no inicia otro ciclo de reparación de la aplicación.
