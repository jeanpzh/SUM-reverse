# Consejero: de selección a utilidad medida

Evaluación y corrección local del 2026-11-10. Fuente `observed`: React → NestJS → Python propios, fixtures del backend declaradas sintéticas, corpus público y proveedor LLM desactivado. No se inspeccionan servidores de origen incierto ni datos privados. Ámbito autorizado: chat/consejero de `/local/programacion-academica`, conservando `docs/design-direction.md`, controles existentes, pantallas del alumno, contratos y reglas.

## Por qué estaba deshabilitado

La pestaña del usuario tenía marcadas excepción horaria y sesiones divididas, pero no una simulación vigente para esa selección. Cambiar cualquier checkbox invalida la vista previa, incluso al volver a marcar la misma combinación. Aplicar exige coincidencia de propuesta, versión y conjunto de recomendaciones. El bloqueo era correcto; faltaba explicar el paso necesario junto al botón.

Ahora el botón enlaza por aria-describedby un estado visible: «La selección cambió o no tiene una simulación vigente. Pulsa “Simular selección actual” antes de aplicar». Sin selección pide marcar una recomendación y con bloqueo de la propuesta muestra su motivo. No se permite aplicar resultados obsoletos ni se simula/aplica en silencio. El mensaje inicial de preview se acorta para no repetir la instrucción. Los alcances individuales se etiquetan como estimados y se aclara que pueden solaparse: no se suman como mejoras verificadas.

## Resultado real después de aplicar

La Sesión de programación mide las propuestas anterior y regenerada. El resultado pertenece exclusivamente al ID/versión obtenidos, se borra al invalidar/ajustar/recuperar/generar otra propuesta y solo se registra tras éxito. La interfaz muestra componentes, secciones completas, diferencias y pendientes reales. No copia la estimación del consejero ni conserva un mensaje de éxito tras un fallo. Una prueba de componentes comprueba expresamente que un descenso se presenta con cifras negativas.

`AdvisorImpact` ya representa predicción. El nuevo `AdvisorOutcome` representa una operación efectivamente terminada, sin reemplazar el contrato ni presentar esa predicción como ejecución. El resumen de comparación es temporal; el guardado conserva configuración y horario, no un historial nuevo de análisis.

## E2E final

| Caso | Antes | Simulación | Regeneración real | Persistencia |
| --- | --- | --- | --- | --- |
| Catálogo de 56 cursos, excepción horaria + sesiones divididas | 211/332 componentes, 108/166 secciones completas | 243/332,124/166 | 243/332,124/166; 89 componentes aún pendientes; search-limit | Guardado explícito y recuperación iguales al resultado |
| Un curso superior con bloque continuo más largo que la ventana nocturna (20118073), excepción horaria | 0/2 componentes, 0/1 secciones completas | 2/2,1/1 | 2/2,1/1; 0 pendientes; complete | Guardado explícito y recuperación iguales al resultado |

En el caso amplio se obtienen 32 componentes y 16 secciones completas adicionales. La excepción horaria sola ya proyectaba la misma cobertura: esta muestra **no acredita un beneficio incremental de dividir sesiones**, ni permite atribuir la mejora al LLM. El escenario controlado sí resuelve todo el pendiente de esa propuesta; no se extrapola al catálogo completo.

Ambos E2E comprueban por HTTP que se aplican los parámetros seleccionados, que no cambia la carga máxima de ningún docente, que no se guarda automáticamente, que el resultado visible corresponde a la regeneración y que solo al pulsar Guardar se persiste. No se aprueba/publica implícitamente ni se concede autorización normativa.

Artefactos finales: all-courses-final/utility.json y execution.log; complete-final/utility.json y execution.log; regressions-final/acceptance.json; final-runs.json. Los cuatro escenarios anteriores de invalidación, aplicación explícita y reintento con selección normal/vacía pasan. CI incorpora los dos casos de utilidad.

El E2E previo before/utility.json llegó a aplicar, guardar y recuperar correctamente, pero falló porque no había motivo accesible ni resultado visible. after y complete-case contienen los primeros éxitos. Los intentos final-all-courses y regressions conservan fallos de arranque/recarga bajo carga paralela de compilación; no se cuentan como éxitos. La espera de montaje lazy se alinea con 45 s; las acciones mantienen sus plazos. Las corridas definitivas se hicieron secuencialmente después del build: ambas pasan y la regresión pasa 4/4.

## T3 Browser

Se conservó la pestaña original del usuario y se abrió otra para una demostración controlada sobre el stack sintético propio 6846. Mediante controles reales se seleccionó el curso, se generó la propuesta incompleta, se desmarcó/remarcó la recomendación para reproducir el bloqueo, se leyó el motivo, se simuló y se aplicó. La nueva pestaña quedó mostrando 2/2 componentes y 1/1 secciones, sin pendientes. No se guardó esa demostración interactiva. Captura: demo/t3-browser-complete.png.

## Validación y límites

- Client build y lint finales pasan; persiste aviso de chunks >500 kB.
- 306 pruebas de datos pasan; se amplió la prueba del comando real para comprobar descarte del resultado al editar y ausencia de resultado tras fallo de regeneración.
- 14 pruebas de componentes pasan, incluida presentación honesta de una pérdida de cobertura.
- git diff --check pasa.

Estos conteos locales incluyen cambios previos del selector/perfiles docentes aún sin commit. Esos cambios permanecen fuera de esta corrección. No se modifica backend, solver, DTOs ni corpus. Los entornos de aceptación se detuvieron; el entorno solicitado por el usuario y las dos pestañas de demostración siguen abiertos. Las cifras prueban los casos descritos, no calidad normativa o exactitud general del modelo.

## Reproducción

```sh
SUM_REDESIGN_API_PORT=5146 SUM_REDESIGN_ENGINE_PORT=5147 SUM_REDESIGN_WEB_PORT=7146 SUM_REDESIGN_EVIDENCE="$PWD/evidence/local/planning-advisor-utility-2026-11-10/repeat-all" node client/scripts/verify-planning-redesign-stack.mjs verify-planning-advisor-utility.mjs
SUM_REDESIGN_API_PORT=5146 SUM_REDESIGN_ENGINE_PORT=5147 SUM_REDESIGN_WEB_PORT=7146 SUM_ASSISTANT_CASES=advisor-policy-window-complete SUM_REDESIGN_EVIDENCE="$PWD/evidence/local/planning-advisor-utility-2026-11-10/repeat-complete" node client/scripts/verify-planning-redesign-stack.mjs verify-planning-advisor-utility.mjs
```
