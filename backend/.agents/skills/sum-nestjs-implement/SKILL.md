---
name: sum-nestjs-implement
description: Implementar contratos locales SUM ya especificados en el backend NestJS de este repositorio, con DTOs validados y fixtures sintéticos. Usar para cambios de backend; no para cliente o descubrimiento de SUM.
---

# Implementación NestJS local

Aplica `backend/AGENTS.md` y el `AGENTS.md` raíz. Antes de editar:

1. Identifica archivos asignados, criterios y dependencias; lee el contrato local aplicable y escenarios/evidencia disponibles.
2. Mantén separada la evidencia `observed`, `inferred`, `unverified` y las decisiones `local-only`. Si falta un contrato esencial, informa la brecha al orquestador en vez de inventar rutas, campos o comportamiento.
3. Revisa el scaffold/módulo existente y modifica solo el área backend asignada. No delegues.

Implementa el contrato con módulos/controladores, DTOs más validación runtime, servicios y repositorios explícitos. Valida la forma exacta del request en la frontera HTTP; retorna el status, envelope y errores definidos por el contrato. Los datos serán sintéticos y locales. No uses endpoints SUM, clientes de red, telemetría ni imports runtime desde `client/`. Define configuración y duración de persistencia de forma explícita; para lecturas, conserva repetibilidad e impide que un consumidor mute fixtures compartidos.

No agregues reglas académicas ni estados que el contrato no defina, y no cambies cliente, contratos compartidos o configuración raíz fuera de la propiedad asignada. Ejecuta build/lint backend pertinentes; pruebas solo cuando estén solicitadas/autorizadas. Tras fallar una comprobación, permite como máximo un ciclo de reparación automática; si persiste, devuelve diagnóstico reproducible al orquestador.

Al entregar, enumera archivos, criterios resueltos, decisiones propias `local-only`, comandos/resultados y brechas restantes. No describas build/lint como verificación funcional o de integración.
