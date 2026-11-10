# E2E visible de programación académica — 2026-11-08

Resultado: **recorrido funcional completado, con tres hallazgos de interfaz/manejo de errores**. No se modificó la aplicación para corregirlos.

## Entorno y método

- Cliente React del working tree sobre `1f918a2811a23e72b82e97c2e4fec9aaa4c5620c`. Ya existían cambios sin commit en `PlanningInspector.tsx` y `PlanningSections.css`, además de dos scripts temporales. Se conservaron. Hashes git de esos dos archivos al comprobar: `1bd011f1fbfca6f2ab9084267d37424528d7717e` y `93d91786f1b91f66e3f3c44d60e0e53e84bf339d`.
- NestJS standalone propio, build existente, iniciado con entorno permitido explícito y `SUM_ACADEMIC_SCHEDULING=1`; catálogo independiente sintético incorporado de 56 cursos. Una asignatura seleccionada, una sección, dos componentes, tres horas. No es una prueba de escala de 96 cursos.
- Puertos propios 3412/5412, comprobados libres antes de arrancar. Borradores exclusivamente en `/tmp/sum-e2e-visible-4YKZFQ`. No se usó `datos-reales/`, snapshots, producción, bases externas ni otro servidor del operador.
- Herramienta de pruebas: **Playwright MCP**, interacciones UI con locators y respuestas reales. Sin interceptores ni mocks de respuestas. Consultas HTTP directas solo para comprobar lecturas, igualdad y persistencia.
- Visualización: navegador integrado de **T3**, sesión distinta de MCP. Se mostraron selección/generación, Semana e inspector; luego se recuperó en T3 la misma versión publicada creada por MCP para mostrar el resultado real compartido. No se afirma que las dos herramientas controlaran la misma pestaña.
- Viewports 1280×800 y 390×844. El navegador T3 quedó abierto en Aprobación con la publicación sintética consultada. Los procesos propios permanecen activos para esa visualización.
- Clasificación de evidencia: observación local reproducida, no comportamiento verificado de SUM. Se aplicaron `sum-fullstack-verify` y `sum-react-verify`.

## Escenarios ejecutados

| Acción | Esperado | Resultado real |
| --- | --- | --- |
| Demanda negativa | Guardar y generar bloqueados | Cumple; ambos deshabilitados |
| Seleccionar curso, demanda1 y generar | Propuesta completa por API real | 200, una sección y dos componentes |
| Guardar | Versión1 recuperable | 200, versión1 |
| Editar a domingo no habilitado | Rechazo sin cambiar propuesta | 422; igualdad exacta del objeto antes/después |
| Editar a miércoles permitido | Mover el bloque completo | 200; ambos componentes pasan a día3 |
| Guardar ajuste | Nueva versión del mismo borrador | Versión2 |
| Enviar a revisión y dar conformidad | Transición válida | 200 → in-review → ready-for-approval; solicitud de cambios sin observación bloqueada |
| Vista previa y cancelar aprobación | Sin aprobación por cancelar | Cumple; cancelar no envía POST aprobar |
| Aprobar con confirmación | Documento congelado | 200, approved, versión5 |
| Publicar con confirmación | Publicación separada | 200, published, versión6; requiere actualizar previamente publicaciones |
| Recargar, Mis propuestas y Consultar | Recuperar publicado en solo lectura | 200, versión6; demanda y generación bloqueadas |
| Interrumpir solo el backend propio y actualizar historial | Error visible y recuperación posterior | 502 inducido; aviso visible, ver hallazgo E2E-3 |
| Reiniciar backend con el mismo almacén y actualizar | Publicación persistida e igual | 200; publicación1 y asignaciones intactas; desaparece la alerta |
| Crear nuevo borrador desde publicado, editar y guardar | Nueva identidad editable y origen inmutable | 200/200; identidad distinta; publicación original exactamente igual |
| Inspector por teclado y Escape | Acceso y cierre operativos | Sin autofocus inicial, pero el siguiente Tab entra al botón Cerrar; Escape cierra y devuelve foco |
| Móvil | Documento dentro de390px; tablas con scroll interno propio | Falla en Preparación; ver E2E-1 |

## Hallazgos confirmados

### E2E-1 — Media: Preparación desborda el ancho móvil

En 390×844, `document.documentElement.scrollWidth` es **470**, 80px más que el viewport. Se reprodujo en MCP y en T3, también al consultar la versión publicada. Al excluir elementos recortados por sus regiones internas de scroll, los elementos que llegan a470px pertenecen al panel de demanda: `.academic-demand__heading`, la etiqueta/select `Fuente de demanda potencial`, acciones y contenido.

Reproducción: incluir un curso, abrir Preparación a390px y desplazar hacia Demanda potencial. Esperado: el panel cabe y solo las tablas que lo necesitan tienen scroll interno. Actual: el propio documento desborda. [Captura](mobile-demand.png).

Además, en Aprobación se midió scrollWidth394 sin diálogo. Con confirmaciones abiertas se midió1143, aunque el diálogo en sí cabe (358px, x16–374). Esta última métrica corresponde al fondo bloqueado y no se presenta por sí sola como un diálogo fuera de pantalla.

Acción sugerida: corregir tamaños mínimos/flex y select del panel de demanda; verificar reflujo con y sin confirmaciones sin ocultar contenido mediante overflow global.

### E2E-2 — Media: Publicar queda bloqueado sin explicar el siguiente paso

Después de aprobar y actualizar la vista previa (`approved`, versión5), `Publicar (simulada)` sigue deshabilitado. El panel no ofrece una razón junto al control. Pulsar **Actualizar publicaciones** obtiene200 y habilita Publicar; entonces se puede completar la publicación.

No es una falla del endpoint ni una pérdida de datos. Es una dependencia de la UI que no comunica la siguiente acción. La lista actual es necesaria para el control de concurrencia: no se propone sustituir un estado desconocido por `currentId=null`. Acción sugerida: actualizar el listado automáticamente tras aprobar, o explicar junto al botón que primero debe actualizarse.

### E2E-3 — Baja: el aviso de indisponibilidad habla de JSON

Se detuvo únicamente el backend de prueba. Actualizar publicaciones obtuvo502 del proxy y mostró: `No se pudo actualizar el historial: La API local devolvió una respuesta que no es JSON válido.` El fallo inducido fue indisponibilidad del servicio; el mensaje expone un detalle de formato en vez de orientar al operador.

Tras reiniciar y actualizar, la consulta devolvió200, desapareció la alerta y se comprobó la publicación persistida. Acción sugerida: distinguir errores HTTP/proxy de fallos de validación del contenido y ofrecer un mensaje de indisponibilidad/reintento.

## Precisión sobre el foco del inspector

La primera observación parecía un problema de autofocus: al abrir Editar horario, el foco permanece en el disparador durante más de2s. La inspección posterior confirma un Sheet **no modal** con `onOpenAutoFocus.preventDefault()` explícito. El siguiente Tab entra al inspector y Escape cierra/restaura foco. Se registra como comportamiento deliberado observado, **no como bloqueo de teclado confirmado**. Las confirmaciones de aprobar/crear borrador sí reciben foco en Cancelar.

## Consola y red

Cero excepciones JavaScript no capturadas en `pageerror`. Los errores de consola corresponden al422 provocado y al502 inducido. Se observaron GET abortados durante recarga/remontaje y luego GET200; no se clasificaron como fallos de negocio. El detalle mínimo de checks y métodos/rutas/status está en [checks.json](checks.json), sin headers, cookies, tokens ni HAR.

## Límites

No se probó Tailscale en este recorrido: sus instancias previas no estaban activas y se usó un stack propio para garantizar procedencia. No se certifica la configuración del wrapper de origen `ts.net`. No se probaron perfiles/facultades alternativos, 96 cursos, búsqueda exhaustiva de combinaciones, rondas completas, activación de oferta estudiantil ni paridad con SUM. Se usó el build NestJS existente, no se hizo una nueva compilación ni una modificación backend. Las observaciones de UI incluyen los cambios sin commit ya presentes.

No se ejecutaron otra vez las suites antiguas ni se hicieron reparaciones; el encargo fue observar y registrar errores por Playwright MCP y visualizar en T3. Los cambios de aplicación previos quedaron intactos.
