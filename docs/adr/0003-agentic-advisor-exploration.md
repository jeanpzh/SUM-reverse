# Exploración agéntica acotada del Consejero sobre el catálogo de recomendaciones

Enmienda a [ADR-0001](./0001-hybrid-llm-planning-advisor.md) (decisión del usuario, 2026-11-16). Extiende las capacidades del **Consejero de planificación** descrito en ADR-0001 y [ADR-0002](./0002-planning-as-separate-service.md) para explorar variantes cerradas del catálogo dentro de un presupuesto estricto sin ceder autoridad sobre parches ni prioridades.

## Contexto y problema

El diagnóstico y ranking determinista inicial acotan las variantes candidatas por tipo (`kind`) antes de invocar al modelo (por ejemplo, los principales cursos por déficit o las variantes amplias dentro del tope de simulaciones iniciales). Cuando una propuesta presenta múltiples causas superpuestas, el LLM necesita inspeccionar el diagnóstico seudonimizado, solicitar variantes puntuales fuera de la ventana inicial y probar combinaciones específicas en el simulador CP-SAT, manteniendo intactas las garantías de seguridad, privacidad, latencia y fallback determinista.

## Decisión

1. **Exploración guiada por herramientas cerradas**: El LLM puede consultar un resumen seudonimizado del diagnóstico (`inspect_diagnosis`), solicitar variantes del catálogo de **Recomendaciones** acotadas a un alcance validado (`request_variants(kind, scope)`) y elegir qué combinaciones simular en el solver (`simulate_patches_cpsat`), sujeto a topes estrictos de tiempo, rondas y simulaciones agénticas.
2. **Construcción y validación exclusiva en el catálogo**: Únicamente los módulos por `kind` del catálogo construyen y validan los parches mediante un `scope` de enumeración cerrada por tipo (franjas permitidas o `courseId` existente con componentes pendientes en la solicitud). El LLM nunca redacta parches libres, no asigna bloques horarios ni muta el workspace.
3. **Autoridad del impacto medido en el orden final**: Toda variante solicitada por el agente ingresa a la respuesta final únicamente a través del catálogo y de `rank_recommendations`, manteniendo todas las reglas vigentes (máximo 8 recomendaciones, descarte de variantes estrechas sin impacto medido, aumento de carga docente nunca por defecto y exactamente una recomendación de ventana por defecto). El orden final proviene del impacto medido en simulación CP-SAT, no de la opinión del modelo; el LLM solo redacta el resumen y racionales (manteniendo fijo el racional de aumento de carga docente) y únicamente puede reordenar dentro de empates de impacto medido.
4. **Continuidad intacta del camino sin LLM**: La ejecución sin proveedor configurado (`not_configured` / `deterministic-fallback`) permanece completamente funcional e idéntica al comportamiento determinista de referencia.

## Opciones consideradas

- **Permitir que el LLM redacte parches JSON libres o parámetros abiertos**: rechazado porque introduciría parches malformados o inconsistentes con las políticas académicas y rompería la frontera determinista de ADR-0001.
- **Permitir que `prioritizedIds` del modelo anule el ranking por impacto medido**: rechazado porque subordinaría la evidencia cuantitativa del solver CP-SAT a heurísticas textuales del modelo.
- **Bucle agéntico sin cota de simulaciones**: rechazado porque desbordaría el timeout del proveedor LLM (8 s) y el presupuesto HTTP de planificación (35 s); las simulaciones del agente se limitan a un máximo acotado con un único worker y semilla fija.
