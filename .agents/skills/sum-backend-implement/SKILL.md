---
name: sum-backend-implement
description: Dirigir implementaciones del backend SUM independiente NestJS a su skill propia sum-nestjs-implement. Usar como entrada compatible desde la raíz con contrato listo y archivos backend asignados.
---

# SUM: implementar backend

Esta es una entrada compatible para el orquestador raíz. La implementación/verificación de la carpeta tiene sus propias instrucciones; no mantener una segunda política independiente aquí.

1. Leer [AGENTS.md raíz](../../../AGENTS.md) y [backend/AGENTS.md](../../../backend/AGENTS.md).
2. Resolver contrato/especificación, criterios, dependencias y propiedad de archivos asignada.
3. Cargar y aplicar [sum-nestjs-implement](../../../backend/.agents/skills/sum-nestjs-implement/SKILL.md) para ejecutar el trabajo dentro de `backend/`.
4. Entregar resultados al principal con archivos, comandos/salidas reales, criterios y límites. La integración se evalúa con `sum-fullstack-verify`, no se infiere desde checks de una carpeta.

Los trabajadores no delegan ni amplían el contrato. Implementadores `sum-implementer`/`sum-executor` usan GPT-6 Luna High. En simulación, no modificar código ni ejecutar comprobaciones. Autorización, fuentes y privacidad siguen la raíz; no contactar SUM desde la réplica.
