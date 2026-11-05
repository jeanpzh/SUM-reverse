# E2 — ejecución de borrador individual

Principal: 2026-11-04, `schedule-pt1`. Fuente: requisito explícito del usuario,
decisión `local-only`. [Plan](../plans/prematricula-e2-draft.md) y
[contrato](../contracts/local-api/prematricula-e2.md).
Preservar fidelidad SUM: solo sección compacta nueva en el reporte de prematrícula;
reutilizar selector y WeeklySchedule, conservar reporte y matrícula. Solo datos
sintéticos; ninguna lectura de privados, PDF o producción.

Skills: sum-workflow e implementación propia de cada carpeta; aceptación del
principal con sum-fullstack-verify y revisión local con sum-react-verify.
Plan/contrato del principal sin delegar planificación. Implementación disjunta:
e2_backend y e2_frontend, agentes reales gpt-6-luna/high, fork none, sin subdelegación.
Se utilizó el modelo disponible; no se simuló activar un perfil TOML ausente.
CodeGraph no se inicializó: CLI/índice ausentes y exclusiones adicionales pendientes.
Principal: shared, registro del módulo, exportaciones compatibles y navegador
secuencial del Compose propio en 5280; sin tocar servicio del operador en 5180.

Sin contratos E3 nuevos/modificados. Datos fuente y reglas de matrícula conservados.
Se exportan helpers de clasificación existentes y se generaliza el store JSON sin
cambiar sus valores predeterminados E1. No se añadieron dependencias ni cambios
Docker, migraciones, commits o push; se conservaron los cambios anteriores.

## Cierre

Backend y frontend entregaron archivos disjuntos. El principal amplió aceptación y
pruebas focales diagnosticadas, y ejecutó Docker/Chrome reales. Se corrigió el error
E2 de pasar asignaciones completas a un validador de intervalos estricto; se corrigió
el fixture de publicación sin relajar el contrato. No hubo reparaciones ciegas ni
modificaciones al generador o reglas E3.

Resultado: 364 pruebas focales backend, 204 frontend y 27 contratos/configuración
pasan; build/tipos de fuente/lint pasan con cuatro warnings previos del backend.
Suite adicional de perfiles: 40 pasan y 1 fallo previo de separadores Windows.
Los 203 casos Node base también pasan y solapan Vitest. Navegador verifica A/B,
CAS, cruce, edición, publicación fijada, borrador vacío y reinicio; pasan regresiones
existentes E1 y matrícula. Sin solicitudes externas o errores de página.

[Informe de aceptación y límites](../../../evidence/local/prematricula-e2-draft/fullstack-verification.md).
Etapa detenida: sin Registrar intención, agregados o integración E3.
