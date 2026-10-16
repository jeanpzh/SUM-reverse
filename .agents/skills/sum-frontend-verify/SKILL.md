---
name: sum-frontend-verify
description: Dirigir verificaciones frontend SUM a su skill propia sum-react-verify. Usar como entrada compatible desde la raíz; no acredita integración ni inspecciona producción.
---

# SUM: verificar frontend

Esta es una entrada compatible para el orquestador raíz. La implementación/verificación de la carpeta tiene sus propias instrucciones; no mantener una segunda política independiente aquí.

1. Leer [AGENTS.md raíz](../../../AGENTS.md) y [client/AGENTS.md](../../../client/AGENTS.md).
2. Resolver contrato/especificación, criterios, dependencias y propiedad de archivos asignada.
3. Cargar y aplicar [sum-react-verify](../../../client/.agents/skills/sum-react-verify/SKILL.md) para ejecutar el trabajo dentro de `client/`.
4. Entregar resultados al principal con archivos, comandos/salidas reales, criterios y límites. La integración se evalúa con `sum-fullstack-verify`, no se infiere desde checks de una carpeta.

Los trabajadores no delegan ni amplían el contrato. Implementadores `sum-implementer`/`sum-executor` usan GPT-6 Luna High. En simulación, no modificar código ni ejecutar comprobaciones. Autorización, fuentes y privacidad siguen la raíz; no contactar SUM desde la réplica.
