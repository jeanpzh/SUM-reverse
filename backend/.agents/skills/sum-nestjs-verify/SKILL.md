---
name: sum-nestjs-verify
description: Verificar localmente contrato HTTP y persistencia/lectura del backend NestJS SUM mediante escenarios autorizados y fixtures sintéticos. Usar para aceptación backend; la integración cliente/UI la coordina el orquestador.
---

# Verificación NestJS local

Aplica `backend/AGENTS.md` y el `AGENTS.md` raíz. Usa contrato, escenarios y evidencias existentes como criterios; distingue resultados observados localmente de afirmaciones sobre SUM. No inspecciones SUM de producción, no uses REA/Playwright y no delegues.

Ejecuta primero build y lint pertinentes (`pnpm --dir backend build`, `pnpm --dir backend lint`). Solo ejecuta pruebas de aplicación o escenarios HTTP si la tarea/workflow los solicita o autoriza. Para escenarios autorizados, usa únicamente datos sintéticos y API local. Comprueba status, envelope, campos/serialización, errores y repetibilidad exactamente contra el contrato. Si el contrato define dos modos de fixtures, verifica arranque/configuración de ambos, consultas de lectura y que solicitudes repetidas o concurrentes no muten datos. Nunca agregues endpoints de reset ni cambies datos reales.

Build/lint no prueban contrato en ejecución; mocks no acreditan integración cliente-servidor. Reporta por separado checks estáticos, pruebas/scenarios HTTP realmente corridos, integración que queda fuera de alcance y cualquier limitación. No repares código: entrega diagnóstico con comando, salida relevante y criterio afectado al implementador/orquestador.
