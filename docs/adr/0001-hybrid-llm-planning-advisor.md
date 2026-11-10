# Consejero de planificación híbrido con motor determinista como única autoridad

El **Consejero de planificación** calcula déficits matemáticos y parches candidatos de forma determinista en el backend y utiliza un router LLM compatible con OpenAI (ej. Groq) únicamente para priorizar combinaciones, explicar trade-offs y redactar recomendaciones sobre identidades docentes seudonimizadas. El LLM nunca asigna bloques horarios directamente ni muta el workspace sin confirmación explícita del usuario seguida de una regeneración en el motor determinista.

## Opciones consideradas

- **LLM como generador o reparador directo de horarios**: rechazado porque cualquier alucinación violaría restricciones duras de cruce docente/aula, cobertura exacta de componentes y trazabilidad de la **Propuesta**.
- **Llamadas al proveedor LLM desde el cliente React**: rechazado porque expondría credenciales (`API_KEY`) en el navegador y rompería la frontera de seguridad de `VITE_*`.
- **Enviar nombres propios al proveedor externo**: rechazado para evitar fuga de datos personales si el entorno local se alimenta con plantillas docentes reales; el servidor reemplaza identidades por alias opacos (`DOCENTE_01`) en tránsito y rehidrata al responder.
