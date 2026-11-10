# Calidad de respuestas: E2E con Bedrock real

**Veredicto:** utilidad parcial. El consejero aporta diagnóstico y simulación aprovechables; el chat normativo todavía no es suficientemente útil para responder preguntas documentales concretas. La prueba funcional no acreditaba esto.

## Condiciones y método

Evaluación del 2026-11-10 sobre commit 66823bd. Fuente `observed`, solo el producto local con escenarios incorporados explícitamente sintéticos y corpus público revisado. Periodo 2027-I y fecha 2026-11-10, como la UI actual. No se modificaron corpus, prompts, reglas o aplicación durante la medición. No se inspeccionó SUM ni servidores/datasets privados.

Se fijaron antes de ejecutar doce preguntas y sus fuentes esperadas a partir de planning-engine/normative-corpus/v1.json. El corpus es referencia de contenido, no prueba de vigencia ni aplicación individual. Se recogieron respuestas reales en dos stacks propios: React 5846 → NestJS 3846 → Python 3847. Uno léxico/extractivo sin proveedor; otro con Titan V2, pgvector temporal e ingesta explícita de 17 fragmentos, y Nova Lite habilitado para el consejero.

La rúbrica revisa cinco aspectos separados: responder la pregunta, pertinencia de fuentes, incertidumbre específica, siguiente paso útil y ausencia de autorización inventada. Se evalúa tanto la vista inicial como la información accesible al desplegar. El recolector puede terminar correctamente y dejar una evaluación de calidad negativa. No se usa otro LLM como juez ni se fabrica una puntuación de satisfacción.

## Comparación documental

| Caso | Fuente esperada | Léxico: posición de primera fuente pertinente | Bedrock híbrido: posición | Explicación concreta inicial |
| --- | --- | --- | --- | --- |
| tc-limit | art-7 | 1 | 1 | No en ambos modos |
| tc-paraphrase | art-7 | Ausente | Ausente | No en ambos modos |
| academic-hour | art-8 | 1 | 1 | No en ambos modos |
| approval | art-6, art-26 | 3 | 3 | No en ambos modos |
| postgraduate | comp-segunda | 1 | 1 | No en ambos modos |
| renacyt | comp-primera | 1 | 3 | No en ambos modos |
| paid-postgraduate | art-6 | 1 | 1 | No en ambos modos |

En seis de las siete preguntas documentales principales aparece al menos una fuente esperada en ambos modos. Es cobertura mínima de fuente, no precisión global. Ninguna de las siete vistas iniciales explica los hechos preguntados: muestran esencialmente la misma advertencia de vigencia y el mismo siguiente paso genérico. En seis casos la información se puede reconstruir leyendo varios extractos desplegados, pero el trabajo de síntesis recae en el usuario.

## Fallos de calidad confirmados

1. **Paráfrasis práctica fallida en ambos modos.** «Quiero ponerle catorce horas semanales de clases a un profesor nombrado a tiempo completo. ¿Puedo hacerlo directamente?» no recupera art. 7. La variante formal del máximo sí lo recupera. Esto ocurrió también con embeddings Titan reales y retrievalMode=hybrid; no es solo falta de configuración.

2. **La respuesta no explica el contenido encontrado.** Preguntar por duración de hora académica localiza art. 8, pero la vista inicial no explica 45/50/60 ni que falta la decisión de Facultad para elegir uno. La abstención sobre vigencia debe conservarse; lo que falta es distinguir contenido documental de aplicabilidad al caso.

3. **Pregunta fuera del corpus presentada como problema de vigencia.** La consulta sobre cómo calcular un aumento de sueldo y cuándo se pagará devuelve siete citas de actividades académicas en ambos modos. No reconoce que el corpus no contiene esa respuesta salarial. La ausencia de una respuesta falsa no convierte esas fuentes en pertinentes.

4. **Sin contexto conversacional.** La misma pregunta «¿Y quién autoriza eso en ese caso?» produce una respuesta y citas idénticas después de dos antecedentes distintos (hora académica y exceso de carga). En el primer contexto falta art. 8. El HTTP solo envía question/facultyId/academicPeriod/asOf/teacherType, sin historial. Es coherente con el contrato actual de consultas independientes, pero no con la expectativa habitual de un chat que muestra una conversación.

5. **Incertidumbre y siguientes pasos poco específicos.** El caso contratado se abstiene correctamente, pero no explica inicialmente que faltan reglas para ese régimen. La pregunta RENACYT exige abrir el extracto para conocer las condiciones; con el ranking híbrido, su disposición principal pasó del primer al tercer lugar en esta muestra.

## Qué aportó Bedrock realmente

La autenticación privada funcionó, el preflight retornó 1024 dimensiones y la ingesta indexó los 17 fragmentos con Titan Text Embeddings V2. Las doce consultas del segundo E2E registraron modo híbrido. Sus doce respuestas normativas permanecieron extractivas con fallbackReason=insufficient_evidence: el guard de sustento no permite generar mientras la vigencia/aplicabilidad siga sin confirmarse. Por tanto, no se puede afirmar que se haya evaluado redacción generativa normativa: el código no llegó a usarla.

## Utilidad del consejero

El consejero sí registró llm-assisted con bedrock_converse / us.amazon.nova-lite-v1:0. En ambos modos presentó 211/332 componentes y 108/166 secciones completas; la simulación de la selección proyectó 243/332 y 124/166, respectivamente, con search-limit. Es una proyección medida por CP-SAT, no garantía de la siguiente regeneración ni autorización normativa.

Sus tres cuellos de botella y tres recomendaciones dan una acción concreta. La excepción de ventana se seleccionó por defecto y el aumento de carga no. Esto sí es útil para explorar capacidad; la confirmación y regeneración siguen siendo explícitas. Los contadores de causas se solapan y no son sumables como pendientes distintos.

El resumen y verifiedImpact fueron exactamente iguales entre fallback determinista y Bedrock en esta muestra. El cambio visible del LLM fue sobre todo la priorización de recomendaciones y una traza adicional de herramientas. No se observó una explicación sustancialmente mejor que justifique atribuirle toda la utilidad al modelo. Una sola propuesta no demuestra que siempre ocurra así.

## Seguridad y trazabilidad

El primer archivo de credencial configurado no era legible y falló antes de llamar a Bedrock. Se recibió una clave nueva mediante el campo privado y solo el proceso de evaluación la consumió desde su archivo privado; no se imprimió, copió a Git ni incluyó en estos artefactos. La primera ingesta real terminó, pero el navegador no encontró su binario por el HOME temporal. Se corrigió la ruta al ejecutable de Playwright y se repitió el stack aislado; la ingesta repetida volvió a consumir embeddings. No hubo un resultado de calidad inventado para ese fallo del verificador.

Las dos corridas completas del recolector terminaron con cero pageerrors. Todos los procesos propios y PostgreSQL temporal se detuvieron. Las respuestas/citas contienen solo las preguntas generales, el corpus público y fixtures sintéticas; no hay cabeceras de autenticación, secretos ni datos del operador.

## Prioridades sugeridas por la evidencia

1. Separar una explicación breve de qué dice el documento de la decisión de si aplica al caso; mantener el estado de abstención y los límites de vigencia/autorización.
2. Usar la paráfrasis fallida y el caso salarial como pruebas rojas para corregir relevancia/ranking, sin dar por hecho que cambiar de embedding resolverá la calidad.
3. Hacer explícito que las consultas son independientes o definir contexto conversacional acotado y validado.
4. Dar el siguiente paso específico (régimen, acuerdo de Facultad o norma ausente), no la misma frase para cualquier pregunta.
5. Comparar el valor del LLM del consejero en más propuestas frente al diagnóstico determinista, antes de aumentar su uso.

Esta tanda evalúa y documenta: no relaja reglas ni implementa silenciosamente esos cambios. No es una certificación de calidad general ni de comportamiento SUM.

Artefactos: lexical/responses.json, bedrock/responses.json, bedrock/provider-preflight.json, bedrock/ingestion.json y quality-review.json.
