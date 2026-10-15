# Plan de Estudios: snapshots locales

## Alcance y evidencia

- Solicitud: conectar Plan de Estudios a un JSON snapshot local en el backend NestJS y mostrarlo en la ruta React existente.
- Fuentes: contrato [PE-SNAPSHOT-1](../contracts/local-api/plan-estudios-snapshots.md), tipo sanitizado `raw-types/plan-studios.ts`, especificación `../screens/plan-estudios.md` y evidencia estructural existente `evidence/sum/plan-estudios/`.
- Se reutilizó la ruta/API local, el fixture y la tabla existentes. No se inspeccionó SUM ni se accedió a `datos-reales/`, procesos, respuestas, browser o logs privados.
- El tipo local define shape y literales; no verifica un snapshot real ni establece semántica de prerequisitos o elegibilidad.

## Orquestación e implementación

1. Plan `plan-estudios-snapshots-2026-10-09`, autor `/root/mi_info_snapshots_plan`, perfil `sum-planner`, GPT-6.1 Sol High. Contrato y plan persistentes escritos antes del código.
2. Backend/shared PE-B1/B2 implementados por `/root/plan_estudios_backend`, `sum-executor`, GPT-6 Luna High, con las skills locales NestJS. Archivo fijo `plan-estudios.json`, configuración separada `PLAN_ESTUDIOS_SNAPSHOT_DIR`, validador candidato, manejo de archivo ausente y representación declarada.
3. Client PE-C1 implementado por `/root/plan_estudios_client`, `sum-executor`, GPT-6 Luna High, con skill local React. Transporte valida representación, UI separa candidate-v1 de fixture y ofrece CSV local para la proyección.
4. Root revisó estáticamente cabecera/envelope, los catorce campos y literales, filename/config, mapping de siete columnas y ausencia de deducciones académicas. Los tres catálogos Matrícula, Mi Información y Plan quedan opt-in e independientes.

## Resultado y límites

Implementación estática terminada. Candidate-v1 requiere un envelope con `data` de filas conforme a `raw-types/plan-studios.ts`; preserva orden/duplicados/extras y espacios de `codPlan`. Al faltar el archivo configurado devuelve `503 SNAPSHOT_MISSING`, sin usar seed. Sin la nueva variable, continúa el fixture previo. El snapshot no contiene identidad/periodo, por lo que se oculta el StudentSummary específico de la pantalla candidate.

La descarga candidate se etiqueta `Descargar CSV local` y exporta solo siete columnas visibles; no es el archivo JSON completo ni se verificó el formato de descarga SUM. No se certifica fidelidad visual integral, integridad de todas las filas reales ni reglas de equivalencia/aprobación.

## Validaciones

| Comando | Resultado informado |
| --- | --- |
| `pnpm --dir backend build` | exit 0 |
| `pnpm --dir backend lint` | exit 0 |
| `pnpm --dir client build` | exit 0 |
| `pnpm --dir client lint` | exit 0 |
| `git diff --check` | limpio por revisión de workers |

No se añadieron ni ejecutaron tests. No se inició servidor, no se hicieron solicitudes HTTP ni se inspeccionó navegador. Por tanto, PE-CANDIDATE/EMPTY/MISSING/INVALID/EXTRAS/REPEAT no están probados funcionalmente. El operador inicia el backend con `PLAN_ESTUDIOS_SNAPSHOT_DIR` y coloca `plan-estudios.json` en esa carpeta; reiniciar el proceso recarga el catálogo.
