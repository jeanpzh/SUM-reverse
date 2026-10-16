---
name: sum-fullstack-verify
description: Verificar escenarios funcionales de una réplica SUM React y NestJS, contratos HTTP, efectos y persistencia locales con datos sintéticos. Usar para integración completa; la comparación visual corresponde a sum-frontend-verify.
---

# SUM: verificar React y NestJS

Leer `AGENTS.md` raíz, los AGENTS.md de `client/` y `backend/`, especificación, contrato local API, escenarios y cambios identificables. Reutilizar los informes de las skills locales `sum-react-verify` y `sum-nestjs-verify` cuando sus entradas sigan vigentes; el principal acredita la integración. Una petición de verificar funcionalidad autoriza comprobaciones locales de sus criterios; ejecutar al menos cada escenario obligatorio del alcance o registrar por qué está bloqueado. Esta skill no repara código ni inspecciona producción. Propiedad del informe: `evidence/local/<slug>/fullstack-verification.md`.

1. Inspeccionar scripts de `client/package.json` y `backend/package.json` si existe. Identificar versiones/huellas, fixtures, modo de datos y comandos existentes. No declarar pruebas/backend disponibles por aparecer en un plan. Reutilizar resultados solo con entradas y condiciones vigentes.
2. Ejecutar build/lint de los proyectos afectados según autorización. Para verificar integración, iniciar servidor propio y cliente apuntando a él, con datos sintéticos y red limitada a orígenes locales explícitos; comprobar que no usa mocks/interceptores en lugar del servidor real. Distinguir `mock`, `API propia` y `referencia` en el informe.
3. Verificar por criterio, cuando el encargo autorice pruebas: método/ruta/query/cuerpo, serialización DTO, envelope y error, estado visible, efecto del servicio y almacenamiento. Usar suites existentes, HTTP local y Playwright/escenarios REA pertinentes; no instalar un framework ni generar pruebas adicionales sin autorización.
4. Cubrir éxito, vacío, validación fallida, error y recuperación según contrato. Para escritura local, comprobar lectura posterior, recarga y reinicio si se exige persistencia. Si se exigen idempotencia, permisos o concurrencia, usar casos deterministas definidos; dos clicks con el mismo resultado visual no demuestran atomicidad. No hacer pruebas de carga.
5. Para fidelidad de comportamiento, comparar únicamente escenarios de referencia observados, sanitizados y equivalentes. REA `compare_web_captures`/`verify_reconstruction` es opcional si Evidence/esquemas son compatibles; la aceptación nunca depende de formatos nuevos innecesarios. Supuestos locales pueden pasar su contrato, pero quedan sin verificar contra SUM.
6. Emitir resultado por criterio: fuente, precondición/acción/espera, HTTP y efecto esperado/real, comando/código de salida y `cumple`, `falla`, `bloqueado` o `no aplica`. Separar backend local, integración, fidelidad funcional y fidelidad visual. Para visuales usar `sum-frontend-verify` con sus condiciones.

Si falta backend, fixture o herramienta, registrar exactamente qué criterio no pudo ejecutarse y continuar comprobaciones independientes. No inferir integración desde build/lint o una captura. Entregar fallas al principal con contador de reparación compartido (máximo un ciclo), sin reducir alcance para declarar aceptación.
