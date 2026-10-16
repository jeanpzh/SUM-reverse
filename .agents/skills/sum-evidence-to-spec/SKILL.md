---
name: sum-evidence-to-spec
description: Crear o completar una especificación de interfaz, comportamientos y contratos locales React/NestJS de SUM a partir de evidencia verificada de una funcionalidad. Usar cuando faltan alcance, criterios de aceptación o trazabilidad; no para inspeccionar producción ni implementar código.
---

# SUM: evidencia a especificación

## Responsabilidad y límites

Convertir evidencia existente en un contrato implementable de interfaz y comportamiento, con una API propia NestJS cuando el alcance lo requiera. Se activa ante una petición de especificación o una brecha documental identificada por `sum-workflow`. Excluye adquisición de evidencia, cambios en `client/` o `server/` y certificación de implementación.

## Entradas y salidas

- Entradas: funcionalidad y estado solicitado, inventario de evidencia, documentos relacionados y restricciones de la sesión.
- Salidas: especificación en `docs/reverse-engineering/screens/<slug>.md`, criterios comprobables, incertidumbres y trazabilidad a fuentes concretas. Completar el documento existente de forma incremental; no crear una segunda especificación de la misma pantalla. Para backend, enlazar un contrato en `docs/reverse-engineering/contracts/local-api/<slug>.md` según [contrato de comportamiento/API](references/behavior-contract.md). Mantener `observed-api.md` como inventario candidato; no sobrescribirlo con decisiones de la réplica.
- Estado de salida: `lista` para el alcance respaldado o `bloqueada` con el requisito y la evidencia que faltan. Una especificación parcial puede estar lista para un estado acotado sin certificar la pantalla completa.

## Procedimiento

1. Leer [AGENTS.md](../../../AGENTS.md) y localizar solo la fila de la funcionalidad en [cobertura](../../../docs/reverse-engineering/coverage-matrix.md), sus entradas en el [inventario](../../../docs/reverse-engineering/existing-evidence.md) y su especificación actual. Resolver nombres y carpetas mediante las rutas documentadas; no asumir que nombre visible y slug coinciden.
2. Leer únicamente sus notas en `evidence/sum/<carpeta>/` y documentos enlazados. Comprobar existencia, procedencia, sanitización y estado de cada fuente. Inspeccionar imágenes solo si están documentadas como sanitizadas. Las capturas de `evidence/local/` prueban la réplica y nunca sustituyen una referencia SUM.
3. Delimitar estados observados y separar hechos, inferencias, decisiones locales y desconocidos. Consultar [incertidumbres](../../../docs/reverse-engineering/unknowns.md) cuando una brecha afecte al alcance. Tipos candidatos o endpoints sin respaldo no establecen comportamiento del backend.
4. Revisar la especificación frente al [contrato de especificación](references/spec-contract.md). Reutilizar secciones válidas y añadir solo lo que falta. Citar rutas de archivo y la observación que respalda cada criterio. Para componentes o medidas compartidas, consultar únicamente las filas pertinentes del [catálogo](../../../docs/reverse-engineering/component-catalog.md) y [tokens](../../../docs/reverse-engineering/design-tokens.md).
5. Evaluar suficiencia por criterio: notas directas pueden sostener estructura o comportamiento observado; fidelidad visual exige referencia sanitizada comparable. Si falta evidencia para un requisito obligatorio de fidelidad, registrar el bloqueo y no emitir `lista` para ese requisito. Los requisitos propios se sustentan en decisiones locales explícitas, sin inventar destinos, filas, acciones, medidas ni estados SUM.
6. Si hay alcance funcional/backend, especificar escenarios y contrato propio conforme a [behavior-contract.md](references/behavior-contract.md). Los supuestos locales explícitos y autorizados pueden dejar lista la API propia, mientras la fidelidad SUM sigue sin verificar. No exigir nueva evidencia de producción para decisiones locales ni rebajar un criterio de fidelidad obligatorio.
7. Entregar cambios documentales, alcance listo, exclusiones, incertidumbres y siguiente etapa admisible. En simulación, describir el cambio propuesto y los gates sin escribir la especificación.

## Éxito y parada

Éxito: cada criterio obligatorio del alcance listo tiene evidencia verificable o decisión local explícita, y método local de comprobación; los supuestos y límites visuales son explícitos. Una etiqueta previa de confianza no sustituye esta revisión.

Parar ante evidencia no sanitizada, contradictoria sin resolución o insuficiente para el alcance requerido. Registrar la mínima evidencia segura necesaria; no abrir SUM, invocar REA ni intentar sortear el bloqueo. Si solo parte del alcance está respaldada, proponer ese alcance y esperar una decisión cuando cambie lo solicitado.
