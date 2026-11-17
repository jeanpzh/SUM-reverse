# Corrección de acceso al asistente y al consejero

Fuente: `observed`, producto interno local con fixtures del backend declaradas sintéticas y corpus público. Fecha: 2026-11-10. Ámbito autorizado: `/local/programacion-academica`; preservar `docs/design-direction.md`, las interfaces existentes, pantallas del alumno, selector de módulos y reglas/contratos. Se conserva el trabajo previo sin commit del selector de docentes, perfiles sintéticos y presentación del chat.

## Cambios

- `usePlanningAssistantDisplay.ts` separa apertura y expansión del layout. Al cruzar 1280 px se cierra el asistente antes de confirmar el render del nuevo layout: no se llega a montar un modal transitorio ni se vuelve inerte la aplicación. Volver a escritorio tampoco reabre el panel automáticamente. Abrirlo y expandirlo siguen siendo acciones explícitas.
- `AcademicScheduling.tsx` conserva el estado del chat fuera de su presentación y devuelve el foco al botón del asistente si estaba abierto al cambiar de layout. No se borran historial, borrador de pregunta, filtros ni docente seleccionado por ese cambio.
- `PlanningStatusBar.tsx` muestra un motivo visible junto al consejero desactivado, asociado por `aria-describedby` y anunciado como estado. Se retira al acabar la operación. El mensaje dice «Esperando a que termine la operación con la propuesta» porque el bloqueo existente también cubre otras operaciones sobre el borrador, además del guardado. No cambia qué acciones se bloquean.
- Las pruebas responsive ahora requieren abrir explícitamente el Sheet. Los verificadores de chat/loading usan el launcher y una base loopback validada en lugar de un servidor fijo ajeno.

No se cambian backend, contratos, algoritmo, fuentes normativas, persistencia ni aprobación/publicación. La distribución de perfiles docentes pendiente en el árbol de trabajo no forma parte de estos commits.

## Criterio → escenario → resultado

| Criterio | Comprobación real | Resultado |
| --- | --- | --- |
| No modal por resize | rail abierto, anchos 1280/1100/1024/900/720/390 y vuelta a 1440 | pasa; modal=false en todos; consejero accesible |
| Reapertura explícita y conversación | cerrar por breakpoint, Enter sobre el botón, expandir/restaurar | pasa; respuesta e historial conservados |
| Foco y cierre móvil | Sheet abierto explícitamente, Escape y navegación | pasa; foco restaurado, sin overflow |
| Razón de bloqueo | guardado HTTP retenido, motivo visible y aria-describedby | pasa; también comprobado a 390 px |
| Fin del bloqueo | liberar guardado y consultar consejero | pasa; habilitado y sin descripción obsoleta |
| Negocio intacto | guardar/recuperar/revisar/aprobar/publicar/fork, CAS409, ajuste422, demanda y ajuste válido | pasa en escenarios ejecutados |

## Evidencia y validación

- `before/acceptance.json`: ambos criterios fallaban (0/2), antes de cambiar el producto.
- `after/acceptance.json`: los dos hallazgos pasan y pasan los flujos de negocio; 13/14. El único fallo fue el límite de 10 s del verificador al esperar el primer montaje lazy mientras corrían build y suites en paralelo, sin pageerrors. Se alineó solo el timeout de arranque con los 45 s usados en los verificadores existentes.
- `final-targeted/acceptance.json`: repetición final de arranque y ambos hallazgos, 3/3. `final-targeted/advisor-saving-reason-390.png` muestra el motivo y el botón a 390 px sin overflow.
- `regressions/existing-suites.json`: las seis suites terminan con código 0. Asistente15/15 (incluye escenarios previos de perfiles presentes en el árbol local); calidad12 preguntas sin fallos de criterios; normativa6/6; chat6/6; loading2/2; rediseño9/9. La prueba de chat verifica retorno del foco al botón y reapertura con Enter tras el cambio de tamaño.
- Client build final: pasa (persiste aviso de chunks mayores de 500 kB).
- Client lint final: pasa.
- Client test:data: 306 pasan; este conteo incluye las pruebas previas aún sin commit del árbol local.
- `git diff --check`: pasa.

Se añade a CI la repetición de los dos hallazgos y el cierre/foco móvil. CI ejecutará el contenido versionado, sin los cambios locales previos de perfiles aún pendientes.

Todos los stacks fueron propios, con directorios temporales y entorno allowlist, proveedor cloud desactivado y puertos libres verificados. No se consultan datos privados ni servidores del operador. Las pruebas usan peticiones reales cliente→NestJS→Python salvo el retraso/fallo de transporte declarado para los casos de recuperación. No se repiten llamadas Bedrock: el cambio es de acceso/presentación y no afecta la recuperación documental. Los servicios de prueba se detuvieron.

## Reproducir

```sh
SUM_REDESIGN_API_PORT=4746 SUM_REDESIGN_ENGINE_PORT=4747 SUM_REDESIGN_WEB_PORT=6746 SUM_ASSISTANT_CASES=empty-workspace-six-destinations,advisor-saving-state-explains-global-block,responsive-open-rail-does-not-silently-block-workspace SUM_REDESIGN_EVIDENCE="$PWD/evidence/local/planning-findings-fix-2026-11-10/repeat" node client/scripts/verify-planning-redesign-stack.mjs verify-planning-comprehensive.mjs
```

Los scripts y JSON de ejecución detallan los escenarios; no son una certificación exhaustiva del producto ni de calidad normativa general.
