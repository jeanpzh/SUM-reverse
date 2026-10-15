# Inicio — simulación del flujo

Fecha: 2026-10-08. Modo: `simular`. Ruta: `/alumnoWebSum/v2/inicio`. Slug del registro/especificación: `inicio`; slug de evidencia/local: `home`.

Objetivo: obtener fidelidad visual de Inicio con SUM. Restricción: nueva inspección bloqueada; no modificar frontend/especificación, ejecutar pruebas, contactar SUM ni llamar REA.

## Artefactos reutilizables

- [Especificación y bloqueo incremental](../screens/inicio.md), [cobertura](../coverage-matrix.md), [inventario](../existing-evidence.md) e [incertidumbres](../unknowns.md): el estado superior no tiene una referencia SUM sanitizada comparable.
- [Estructura](../../../evidence/sum/home/structure.md), [medidas](../../../evidence/sum/home/measurements.md) e [interacciones](../../../evidence/sum/home/interactions.md): notas históricas del shell y ocho tarjetas apiladas a viewport 1038 × 711. Destinos/resultados de tarjetas no observados.
- `client/src/screens/Home.tsx` y estilos: implementación local con bento documentado como decisión de la réplica; no es evidencia del diseño SUM.
- [Registro local](../../../evidence/local/home/verification.md) y candidatos de `evidence/local/home/`: evidencia de la réplica, sin capacidad de sustituir una referencia SUM.

La observación REA histórica fue a 1295 × 887 y con scroll distinto, contenía identidad y no está incorporada como referencia sanitizada. No se recuperó, inspeccionó ni enlazó el artefacto inseguro. Las geometrías no se comparan entre estados incompatibles.

## Decisiones y gates

| Etapa | Decisión simulada | Motivo |
| --- | --- | --- |
| Inventariar/reutilizar | Realizada mediante lectura | Las brechas y el bloqueo ya están documentados; no repetir investigación |
| Nueva investigación REA/Playwright | Bloquear | No hay fuente sanitizada ni entorno de demostración autorizado; producción queda excluida |
| `sum-evidence-to-spec` para una especificación visual lista | Bloquear | Falta evidencia obligatoria para fijar y verificar fidelidad visual; conservar la ficha y sus incertidumbres |
| `sum-frontend-implement` para fidelidad | Bloquear la etapa dependiente | El gate documental del alcance solicitado no se cumple |
| `sum-frontend-verify` para fidelidad | Bloquear comparación | Candidatos locales y pruebas estructurales no acreditan equivalencia SUM |

Puede proponerse un alcance estructural parcial sustentado por notas, pero requeriría una decisión explícita sobre el cambio de alcance. No se inicia ni se presenta como sustituto del objetivo visual. Los resultados locales previos permanecen históricos.

## Desbloqueo y estado final

Evidencia mínima requerida: referencia preparada y sanitizada por el operador del estado superior, con viewport, scroll, estado y recorte/redacciones documentados. Para certificar resultados de tarjetas se necesitan también destinos y estados observados seguros. Un entorno de demostración aprobado puede servir para una investigación futura específicamente autorizada; no se propone inspeccionar producción ni reinstalar `reverse-engineer-anything`.

**`simulado`**, con disposición prevista **`bloqueado` por evidencia visual obligatoria ausente y nueva inspección bloqueada**. Próximo gate: comprobar la referencia segura cuando exista; después completar especificación, evaluar diferencias de implementación y verificar localmente. Cero llamadas REA, inspecciones nuevas y pruebas reales en esta simulación.
