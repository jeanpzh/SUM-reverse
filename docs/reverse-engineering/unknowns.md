# Preguntas pendientes y evidencia necesaria

No se explorarán tabuladores de contraseña, matrícula, edición de datos, uploads, ni rutas privadas no disponibles. Las siguientes preguntas se resuelven con evidencia sintética/local o una captura preparada por el operador.

| Pregunta | Estado | Siguiente evidencia segura | Prioridad |
| --- | --- | --- | --- |
| ¿A qué llevan las ocho tarjetas de Inicio? | Desconocido | Que el operador provea los destinos/resultados desde una sesión de demostración; no seguirlos en producción. | Media |
| ¿Cómo se ve Inicio en la parte superior, sin scroll, con datos anonimizados? | Bloqueado: no hay entorno autorizado ni captura SUM sanitaria; los candidatos locales son de la réplica. | Captura preparada por el operador en entorno de prueba sintético, con viewport/scroll anotados y redacción previa a compartir. | Alta |
| ¿Qué hace colapsar el menú y cómo persiste? | Parcial; no se obtuvo observación nueva. | Prueba local de la réplica. Para describir el comportamiento SUM, evidencia de demo autorizada y sanitaria; no inspeccionar la pestaña de producción. | Baja |
| ¿Qué muestra Información Académica en Perfil? | Desconocido | Fixture de demostración o evidencia sanitaria del operador. Cambio de contraseña excluido. | Media |
| ¿Qué campos, orden y tipos exactos tienen los formularios? | Parcial | Exportar solo etiquetas y atributos sin valores desde una sesión de prueba; corregir conteos locales. | Alta |
| ¿Qué estructura/estado existe para historial vacío y otros períodos? | Parcial | Datos sintéticos o evidencia autorizada anonimizada; no consultar otros estudiantes. | Media |
| ¿Qué hacen las acciones de calendario de Asistencias y fila Horarios de Programación? | Parcial | Fixture de curso sintético local; no ejecutar en SUM. | Media |
| ¿Cuál es el formato, nombre y método de los recursos de descarga SUM? | Desconocido | Archivo de ejemplo sanitario proporcionado por operador; nunca descargar datos reales. | Baja |
| ¿Cuáles son los contratos de las 12 acciones del README? | Parcial / inferido | Captura HAR sanitizada preparada fuera de producción; quitar cuerpos, cookies, tokens e identificadores. | Alta para integración API |
| ¿Cuáles son los métodos HTTP de las ocho acciones sin método declarado? | Desconocido | Fuente documental autorizada o HAR sanitario de demo; no inferir POST por patrón. | Alta para integración API |
| ¿Qué endpoints alimentan Inicio, Historial, Ficha Socioeconómica y Manuales? | Desconocido | Documentación institucional o fixture sanitizada del entorno de pruebas. | Media |
| ¿Qué estados de error, no autorizado y carga muestra SUM? | Desconocido | Simular solo localmente con mocks; para apariencia SUM, referencia de operador. | Media |
| ¿Cómo se comporta el sitio en móvil/hover/foco/teclado? | Desconocido | Pruebas locales de accesibilidad y evidencia de viewport de demo. | Media |
| ¿Qué algoritmos/reglas existen detrás de los datos académicos? | Fuera de alcance | No se investigarán internos del servidor; implementar solo reglas que se documenten formalmente. | Fuera de alcance |

La lista de herramientas REA disponibles no es evidencia de que esos comportamientos se hayan inspeccionado. Consultas DOM, scripts o tráfico quedan pendientes hasta tener estado de prueba y sanitización que no exponga datos personales.

## Bloqueo incremental de Inicio — 2026-10-08

La auditoría acotada consultó contratos REA/Playwright, pero no ejecutó observación de página: `inspect_web_page` devuelve estructura DOM y puede incluir texto; `analyze_web_bundle` obtiene fuentes de scripts; captura de screenshot no permite redactar antes de devolver el viewport. No existe un HAR ni bundle fuente sanitizado entre las evidencias de Inicio relacionadas. La fuente de producción autenticada no se inspeccionó. Se requiere un entorno de demostración aprobado o evidencia ya sanitizada por el operador.

