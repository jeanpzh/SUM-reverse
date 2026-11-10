# PA-ADVISOR-2 — aceptación integrada

Fecha: 2026-11-08. Fuente `observed`, exclusivamente local y sintética. Decisiones de producto del plan `plans/academic-planning-ai-advisor.md`; no acredita comportamiento SUM.

## Entorno y alcance

Servicios propios con entorno limpio: Vite 5414 → NestJS 3414 → Python CP-SAT 3424. Almacenamiento temporal independiente `/tmp/sum-advisor-acceptance-DEBYxG`. Sin snapshots privados, dotenv ni credenciales de proveedores. Playwright MCP ejecutó el flujo; T3 reanudó el borrador para mostrarlo en su navegador integrado.

## Criterio → prueba → resultado real

| Criterio | Escenario | Resultado |
| --- | --- | --- |
| Preparación inicial sin selección | Abrir Resumen | 0 cursos, 91 docentes, 49 ambientes |
| Selección de escuela completa | Botón dinámico del Resumen | 56 cursos; navegación Cursos conserva 56 incluidos |
| Navegación desde contadores | Cursos y Ambientes | Abren vistas Cursos y Recursos respectivamente |
| Resumen móvil | Viewport 390 × 844 | Documento 390 px, sin desborde horizontal |
| Generación inicial real | UI POST de 56 cursos, 166 secciones | HTTP 200; 203/332 componentes, 104/166 secciones completas, `search-limit` |
| Invalidación de selección | Seleccionar recomendación split | Aplicar queda deshabilitado hasta simular otra vez |
| Dry-run real tras reparación | Carga docente + ventana + split | HTTP 200; 328/332 componentes y 164/166 secciones; `search-limit` |
| Aplicar y regenerar | Botón del consejero | HTTP 200 en 3214 ms; 164/166 secciones, 328/332 componentes; 82 docentes y 24 ambientes efectivamente asignados |
| Alcance íntegro tras aplicar | Petición generada | Conserva 56 cursos; habilita explícitamente tarde y sábado conforme a los parches seleccionados |
| Identificadores desconocidos | Petición sintética negativa | HTTP 400 |
| Versión obsoleta | Petición sintética negativa | HTTP 409 |
| Selección vacía | `selectedRecommendationIds: []` | HTTP 200, impacto con IDs vacíos, 164/166 secciones y `search-limit` |
| Diálogo móvil | 390 × 844 | Ancho 358, izquierda 16, derecha 374; scrollWidth=clientWidth=356 |
| Teclado | Escape desde consejero | Cierra diálogo y devuelve foco a Consultar consejero |
| Guardar y reanudar | Guardado por UI, lectura en T3 | HTTP 200; borrador `fc2586ba-0cbc-4a98-8aa9-24ed973e057c`, versión 1, título «PA-ADVISOR-2 · Escuela completa · sintético» |

Se registró un error de recurso HTTP 422 en la consulta de vista previa de publicación del borrador incompleto. No es un error JavaScript ni prueba de publicación exitosa. No se aprobó ni publicó el borrador.

## Límites y pendientes

- Permanecen sin resolver la sección 2 de ALGORÍTMICA Y PROGRAMACIÓN ORIENTADA A OBJETOS (`20118041`) y la sección 4 de MODELOS Y SIMULACIÓN (`20118055`). No se demostró imposibilidad.
- La búsqueda limitada por tiempo puede producir coberturas diferentes. El worker obtuvo 165/166 en su prueba de escala; este flujo integrado obtuvo 164/166. La meta 166/166 no está cumplida.
- Se usó fallback determinista por proveedor no configurado. Se ejecutó realmente `simulate_patches_cpsat`; no se atribuyen llamadas LLM inexistentes. Proveedores reales Bedrock/Ollama/OpenAI requieren verificación posterior; sus adaptadores se probaron con dobles sintéticos.
- La reparación acotada preservó incumbentes y diversificó candidatos split; el resultado conserva `search-limit` al recortar candidatos. No se amplió el presupuesto ni se redujo la demanda.

## Validación por capas

Cliente: build/lint aprobados por worker, 286 pruebas de datos y 3 de renderizado. Motor/API: build/lint NestJS aprobados (4 advertencias previas), 4 pruebas Node, 22 pruebas Python tras reparación. El principal ejecutó el escenario integrado y `git diff --check` sobre los archivos asignados, aprobado. Estos checks no equivalen a fidelidad con producción ni a cobertura completa de la escuela.

## Revisión independiente y correcciones finales

El auditor Codex identificó tres bloqueos, corregidos por el principal:

1. `MessageResponse` ahora descarta elementos Markdown `img`, además del HTML crudo. Regresión verifica que URLs con identidades sintéticas rehidratadas no producen imágenes ni precargas.
2. `EnablePlanningWindowPatch` omite cada bandera `None` al serializar. Se mantiene `source.providerLabel: null`, requerido por contrato. Dos regresiones HTTP de FastAPI verifican los parches individuales tarde/sábado. En el flujo real NestJS → Python, una configuración con sábado habilitado y tarde deshabilitada devuelve HTTP 200, `verifiedImpact` y exactamente `{kind: 'enable_planning_window', allowAfternoon: true}`; la configuración inversa también conserva impacto y HTTP 200.
3. Aplicar un parche que no cambia ventanas conserva `policy: null`; solo un parche explícito de ventana crea una política. Regresión del reducer cubre ambos casos.

Validación final: 287/287 pruebas de datos cliente, 4/4 de renderizado, lint y build cliente aprobados. 24/24 pruebas Python aprobadas al ejecutar de forma aislada. Una ejecución simultánea con build excedió la tolerancia del test temporal de escala (1.076 s frente a 1.0 s), con 23 pruebas aprobadas; la repetición aislada pasó sin modificar el presupuesto ni la prueba. No se atribuye un límite estricto de tiempo de pared bajo contención de CPU. Las cuatro pruebas Node y build/lint NestJS anteriores permanecen vigentes: las correcciones finales no modificaron NestJS ni el contrato JavaScript.

Estado: consejero integrado y hallazgos resueltos; aceptación de cobertura completa 166/166 y proveedores reales pendiente. No se realizaron commits, aprobación ni publicación.
