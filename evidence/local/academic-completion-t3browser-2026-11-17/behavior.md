# Programación completa con LLM y T3 Browser

Fecha: 2026-11-17. Clase: `observed` local. Fuente: catálogo PA-DEMO-1 explícitamente sintético, `createDemoCatalog` → `adaptSyntheticCatalog` → `scenarioProgrammingRows`. Main integrado: `ba08183`; árbol probado `6899e26`, comprobado idéntico al merge. Periodo 2027-I, 56 cursos, viewport 1280×800. No es una observación de SUM productivo ni una certificación normativa.

Se usaron exclusivamente herramientas nativas `preview_*` de T3 Browser, en una pestaña propia. El motor, backend y frontend fueron procesos temporales propios en puertos 3967/3966/5966, con un almacén nuevo vacío. Bedrock Nova Lite estuvo activo con credencial externa a Git. No se modificaron servicios o borradores del operador. No se usó Playwright headless como sustituto del navegador solicitado.

## Recorrido ejecutado

1. Seleccionar los 56 cursos y generar: 211/332 sesiones, 108/166 secciones, cero cruces. Cero consultas al consejero al montar.
2. Consultar manualmente: `llm-assisted`, sin `verifiedImpact`; Aplicar deshabilitado.
3. Seleccionar las cuatro tarjetas: carga, ventana, sesiones divididas y asignación T/P + L independiente. Las últimas dos pertenecen a la misma clase Modalidad; se conservan cuatro clases de parches.
4. Simular selección: `llm-assisted`, 332/332 y 166/166. IDs medidos iguales a los enviados; Aplicar habilitado.
5. Desmarcar la asignación por grupos: impacto invalidado y Aplicar bloqueado. Volver a marcarla con tecla Espacio: selección recuperada, pero impacto todavía inválido.
6. Expandir el rail: ancho 419 → 1279 px y las cuatro selecciones conservadas. Volver a simular: `llm-assisted`, impacto vigente para la selección exacta.
7. Aplicar: una sola regeneración adicional, propuesta real `complete`, 332/332 sesiones únicas y 166/166 secciones. Cero pendientes, cruces de docente/ambiente y solapamientos internos de sección. La UI muestra Programación completa. Hay 15 secciones con más de un docente y 66 con modo agrupado.
8. Verificar la respuesta real: cero violaciones de habilitación, disponibilidad, capacidad, tipo laboratorio, duración de sesiones, agrupamientos/continuidad, carga semanal y límites de secciones únicas por docente. Misma demanda inicial. Borradores guardados: cero. Sin excepciones de página ni fallos HTTP observados en el recorrido.

Un observador de `fetch` reenviaba sin modificar solicitudes ni respuestas. Conservó cuerpos sintéticos solo en memoria para comprobar restricciones; la evidencia serializada contiene únicamente métricas, IDs de recomendaciones y resultados. No conserva nombres, cookies, cabeceras ni credenciales. El observador, la pestaña y los procesos temporales se retiraron al terminar.

## Condiciones y reproducción

El resultado completo aplica aumentos explícitos para 25 docentes sintéticos: 600 → 780–1500 minutos. No se afirma que sean mínimos, normativamente admisibles ni institucionalmente autorizados. La simulación y la aplicación no conceden autorizaciones. No se guardó, aprobó ni publicó un horario.

Reproducir los pasos en un stack propio que cumpla las condiciones sintéticas descritas en [la guía integrada](../../../docs/testing/academic-completion-integrated.md). Para participación real del modelo, configurar el motor con el lanzador live y una credencial externa conforme al README de planning-engine. No usar servidores del operador con snapshots privados. No ejecutar build o transformaciones SSR mientras el navegador mantiene la sesión.

Registro de criterios y mediciones: [acceptance.json](acceptance.json). Capturas: [consulta](analysis.png), [simulación expandida](expanded-simulation.png), [resultado real](complete.png). El resultado acredita esta ejecución concreta; tiempos y búsqueda pueden variar.
