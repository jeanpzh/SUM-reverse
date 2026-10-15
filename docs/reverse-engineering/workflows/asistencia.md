# Mis Asistencias: ejecución integrada

Fecha local: 2026-10-08. Modo ejecutar. Encargo: realizar Mis Asistencias. Alcance: backend readonly propio + ruta React existente conectada en modo local + CSV local y escenarios de comportamiento.

Fuente B: notas sanitizadas históricas en evidence/sum/asistencia y tipo candidato raw-types/mis-asistencias.ts. Fuente A: aplicación sintética, HTTP/NestJS y navegador local. No se solicita inspección de producción ni se reutiliza autorización histórica para otra acción. La evidencia permite estructura/encabezados; destino de calendario y resultado descarga SUM unverified. CSV y fórmulas de conteo son local-only.

Contrato fijo: [asistencia-api-v1](../contracts/local-api/asistencia.md). Complejidad media, incertidumbre baja para contrato local, impacto medio por integraciónreadonly. Reutilizar tabla/route/adapters/CSV existentes y patrón NestJS recién refactorizado. No nuevo planner: decisiones explícitas y patrón suficientemente especificado.

| Etapa | Decisión / propietario | Estado |
| --- | --- | --- |
| Evidencia/spec | Root reuse notas, añade contrato local y criterios A-* | listo |
| Backend | asistencias_backend / sum-implementer LunaHigh; backend/src/asistencias/**, app.module, README | implementado; build/lint aprobados |
| Cliente | asistencias_client / sum-implementer LunaHigh; api/transport/validatorAsistencias/TableScreens soloAttendance | implementado; build/lint aprobados |
| Integración | Root HTTP+Playwright y escenario REA/CDP local secuencial | criterios A-* aprobados; REA/CDP con cobertura parcial registrada |

Skills antes del código: backend AGENTS enruta sum-nestjs-implement, nestjs-best-practices y reglas relevantes, Node patterns/principles, oxlint; cliente sum-react-implement y react-best-practices/accesibilidad pertinentes. Tipado avanzado solo si requiere. Root sum-workflow, sum-evidence-to-spec, sum-fullstack-verify, sum-behavior-discovery y reverse-engineer-anything. Contrato/estado/evidencia exclusivos principal; workers no delegan y no usan navegador compartido.

Criterios A-HTTP/INVALID/READONLY/UI/EMPTY/RECOVERY/CONTRACT/CSV/GUARD en contrato. Debe observarse solicitud real al backend; mock no acredita integración. REA conecta por CDP a un navegador sintético propio, con alcance local y sin cuentas ni secretos. Estado: aceptado para alcance funcional local. [Informe](../../../evidence/local/asistencia-integracion/fullstack-verification.md), [resultados](../../../evidence/local/asistencia-integracion/check-results.json) y [comportamiento](../../../evidence/local/asistencia-integracion/behavior.md). Reparaciones backend1 (tipo literal pipe) y cliente1 (helper no usado). Ajuste de limpieza del harness principal documentado por separado, sin cambio de producto. Nueve consultas previas conservan JSON/status.

REA se conectó realmente por CDP9333 a navegador propio. EvidenceID final ev_1504e069e038be14cb9c0e9e20e78df75781d9254ae7ec83f4bcde9ce4b3145d: pasos completos, POST+HTTP200, snapshots de tabla. Eventos marcados incompletos por proveedor; no se declara captura exhaustiva ni paridad SUM. Calendario permanece no verificado/deshabilitado. Servidor3000 y cliente5173 disponibles con datos populated.
