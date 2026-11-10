# Cabecera compacta: herramientas con iconos y ayuda contextual

Written against: `53f9251cd11afe9254601fa24c2da9c13508496b` más el árbol de trabajo sin commit, revisado el 2026-11-09. Estado: implementado por Luna high; integración verificada por root (ver registro al final).

## Evidence chain

- Surface: `/local/programacion-academica`, cabecera común a Resumen, Cursos, Docentes y ambientes, Horario, Revisión docente y Aprobación y publicación.
- Problem: el usuario seleccionó explícitamente la propuesta de compactar las herramientas de la cabecera con iconos y tooltips después de comparar dos capturas de AWS. Es una nueva decisión local de presentación; no un defecto preexistente demostrado ni evidencia del SUM.
- Design evidence: `docs/design-direction.md` gobierna esta ruta; la preferencia del usuario en esta iteración introduce herramientas compactas inspiradas en AWS, conservando texto en decisiones académicas. Las capturas aportadas muestran iconos en herramientas globales y texto en acciones principales. No copiar cuentas, nombres de recursos ni identificadores de esas capturas al repositorio.
- Owner: `client/src/screens/PlanningScopeHeader.tsx`, líneas 56–83 al revisar. Sus consumidores se trazan desde `AcademicScheduling.tsx`, dentro de `PlanningShell` → `SidebarProvider` → `SidebarInset`.
- Scope and affected surfaces: las seis vistas que comparten esa cabecera. El chat y la guía conservan sus handlers actuales.
- Uncertainty: evaluar legibilidad, descubribilidad y ancho realmente recuperado con renderizado local; la captura de AWS no determina píxeles CSS ni garantiza comprensión de nuestros iconos.

## Design language

- Audited surface: herramientas Asistente y Guía de la cabecera interna.
- Design sources: dirección vigente, composición actual y preferencia explícita del usuario tras evaluar AWS.
- Documented decisions: Geist, shadcn/Radix, Lucide, superficies neutras, acciones primarias azules; mantener contratos, guardado explícito, validación, edición y aprobación/publicación.
- Governing owners and consumers: `PlanningScopeHeader`, `AcademicScheduling`, `PlanningShell`, `ui/Button`, `ui/Tooltip`.
- Explicit exceptions: el peso raíz 450 se conserva por decisión explícita; no sustituirlo ni cambiar tipografía por la de AWS. Alumno SUM y selector de módulos están excluidos del rediseño.

## Design decision

Convertir exclusivamente los controles Asistente y Guía de la primera fila en botones de icono con tooltip al hover y foco. Mantener las etiquetas accesibles actuales, los IDs, el estado abierto y los callbacks. Mantener texto visible en Guardar, Generar, Revisar pendientes, Aprobar y Publicar.

La compactación reduce ancho ocupado; no se busca reducir el área interactiva ni encoger toda la tipografía. El título del asistente dentro de su panel sigue visible. No añadir herramientas ni trasladar el chat a la izquierda.

## Reuse

- `Button` existente, `size="icon"`, variante `ghost`; el asistente conserva `secondary` cuando está abierto. Su variante icon usa `size-10`, el tamaño existente del kit.
- `MessageSquare` y `HelpCircle` de Lucide, `className="size-4"`, `aria-hidden="true"`.
- `Tooltip`, `TooltipTrigger`, `TooltipContent` de `client/src/components/ui/Tooltip.tsx`. Usar `TooltipTrigger asChild` para no anidar botones.
- Ya existe `TooltipProvider` alrededor del contenido en `SidebarProvider` (`client/src/components/ui/Sidebar.tsx:138–156`). No crear otro proveedor global ni modificar el proveedor compartido.
- Tooltip portala mediante `usePlanningPortalContainer`, preservando tema y tokens de planificación.
- Exemplar: `SidebarMenuButton` en `ui/Sidebar.tsx` para composición con tooltip; `PlanningContextPanel.tsx:24–33` para los iconos de controles del chat (no modificarlo en este encargo).
- Escala vigente en `PlanningShell.css`: 12/14/15/18/20/26/28 px a raíz de 16 px. Conservarla. AWS/Cloudscape es referencia conceptual: https://cloudscape.design/foundation/visual-foundation/typography/ . No introducir otra familia, escala ni dependencia.

## Changes

1. `client/src/screens/PlanningScopeHeader.tsx`
   - Importar los tres componentes Tooltip indicados.
   - Envolver cada Button de Asistente y Guía en su propio Tooltip con Trigger asChild.
   - Cambiar ambos `size="sm"` a `size="icon"`. Retirar las clases de separación/tamaño de texto que solo servían a su etiqueta; conservar los colores/estados y usar iconos `size-4`.
   - Retirar únicamente los spans visibles «Asistente» y «Guía». Mantener `aria-label` en el Button. No duplicar el nombre con un span sr-only adicional.
   - El tooltip del asistente usa exactamente el mismo texto dinámico que su aria-label: «Abrir asistente normativo» / «Cerrar asistente normativo». Conservar `id="planning-toggle-chat"`, `aria-expanded`, onClick y presencia condicional cuando existe onToggleChat.
   - El tooltip de la guía dice «Ver guía del sistema». Conservar aria-label, `id="planning-tour-guide"` y onGuide.
   - Conservar el agrupamiento existente y los espacios entre controles. No crear un primitive paralelo IconButton ni cambiar Button/Tooltip globales.
   - Preserve: título por vista, SidebarTrigger, fila de propuesta, ámbito, estado, próxima acción, guardado y sus motivos de deshabilitado.
   - Verify: dos controles de herramienta cuadrados; tooltips legibles con ratón y teclado; mismas acciones y restauración de foco.

2. `client/scripts/verify-planning-redesign.mjs`
   - Añadir una comprobación usando nombres accesibles e IDs vigentes: foco sobre cada herramienta → tooltip correspondiente visible; Escape → tooltip oculto; activar guía/chat → mismo resultado anterior.
   - Comprobar que el asistente mantiene aria-expanded al abrir/cerrar y que el foco vuelve a planning-toggle-chat al cerrar el Sheet expandido.
   - Verificar tamaño calculado de los botones: igual ancho y alto, al menos 40 CSS px en la configuración por defecto del kit.
   - No cambiar las guardas de procedencia sintética, rutas base, efectos de API ni manejo de procesos. No sustituir assertions funcionales existentes por simples búsquedas de texto.

## Scope

- Inherit: solo las seis vistas internas que montan PlanningScopeHeader.
- Verify: modos claro/oscuro, chat cerrado/acoplado/expandido, guía disponible, sidebar expandido/colapsado y viewport estrecho.
- Exclude: componentes del alumno, `/`, `/local/modulos`, `shared/`, backend, datos, reglas académicas, navegación, primitivas globales, tipografía y composición interna del chat.
- Instrucciones para el ejecutor: leer AGENTS.md y client/AGENTS.md; preservar docs/design-direction.md y reutilizar interfaces existentes. Usar CodeGraph antes de localizar código. Conservar todo el trabajo sin commit: sin reset, clean, stash, checkout ni commits. No crear worktree desde HEAD: varios archivos solo existen sin commit en este checkout.
- `datos-reales/` está prohibido incluso mediante servidores, APIs, capturas, cachés o logs. No inspeccionar servicios de procedencia desconocida. No tomar como sintético un servidor solo porque sea localhost.

## Validation

| Criterio | Escenario sintético / check | Resultado esperado |
| --- | --- | --- |
| Herramientas compactas | Cabecera en las seis vistas | Asistente y Guía muestran solo icono; acciones académicas conservan texto |
| Ayuda contextual | Hover y foco de cada herramienta | Tooltip correcto, legible y tematizado; Escape lo descarta |
| Estado del chat | Abrir, cerrar, expandir, cerrar Sheet | aria-expanded correcto; historial conservado; foco devuelto al botón |
| Guía | Activar con Enter; cerrar guía | Mismos destinos/targets; retorno de foco a planning-tour-guide |
| Reflow | 1440, 720, 390 y 360 px; texto al 200 % | Sin desbordamiento horizontal ni controles solapados; área interactiva conservada |
| Reutilización | Inspección del diff | Solo Button/Tooltip/Lucide existentes; sin nuevas dependencias ni primitivas |
| Alcance | Comparar con estado inicial guardado | Ninguna modificación nueva a pantallas del alumno, selector, contratos o backend |
| Compilación | `pnpm --dir client build` | Exit 0; registrar aviso de chunk >500 kB si persiste |
| Lint | `pnpm --dir client lint` | Exit 0 |
| Datos | `pnpm --dir client test:data` | Todos pasan, sin cambios de lógica |
| Integración | `node client/scripts/verify-planning-redesign-stack.mjs` desde raíz | Escenarios y nuevas comprobaciones pasan sobre stack propio sintético; procesos propios terminan |

Los tests son autorización prevista para la etapa de implementación, no resultados de esta planificación. Revisar el launcher antes de ejecutarlo; necesita sus puertos libres. No matar servicios ajenos ni cambiar mappings Tailscale para hacer sitio. La suite larga tuvo previamente un timeout; consultar `advisor-plans/validation-sol-2026-11-09.md` y registrar el resultado real, sin presentar resultados combinados como una única ejecución completa.

## Stop conditions

- El botón de guía o chat cambió de propietario o ya no tiene los callbacks/IDs indicados: reconciliar el plan con el código; no sobrescribir trabajo.
- Hace falta modificar las primitivas globales o eliminar texto de acciones académicas: queda fuera de esta decisión.
- El entorno de validación utiliza datos privados o de procedencia desconocida: no inspeccionarlo; crear una reproducción independiente sintética.
- Un tooltip intercepta activación/foco o requiere anidar botones: corregir la composición con asChild antes de continuar.

## Design documentation

Después de implementar y validar, registrar en `docs/design-direction.md`: «Las herramientas Asistente y Guía de la cabecera usan iconos con tooltip al hover/foco y nombre accesible; las acciones académicas conservan texto visible». Este plan no modifica ese documento ni cambia el peso raíz 450.


## Registro de implementación

- Luna (`gpt-6-luna`, esfuerzo alto) implementó los dos archivos autorizados y reportó build y lint con exit 0, y 302 tests de datos aprobados. Persiste el aviso de chunk de planificación >500 kB.
- Root revisó la composición y normalizó la indentación del JSX. Ajustó la precondición del test: el chat comienza abierto en escritorio; al comprobar hover hay que retirar el puntero del botón después de cerrarlo para provocar un nuevo pointer-enter. No se cambió el comportamiento de la aplicación para satisfacer el test.
- Root ejecutó el nuevo escenario en un stack propio con entorno explícitamente sintético, LLM desactivado, almacenamiento temporal nuevo y puertos 3636/3637/5636. El preview 5436 y sus mappings Tailscale no se tocaron.
- Escenario `compact-header-tooltips-and-accessible-controls`: aprobado. Comprueba hover, foco, Escape, área mínima 40 px, controles cuadrados, activación de guía/chat, aria-expanded y retorno de foco.
- Evidencia de integración: `/tmp/sum-header-icons-evidence/acceptance.json`; log `/tmp/sum-header-icons-verified.log`. Consultar el resultado final para reflow; no confundir los primeros intentos de prueba con la ejecución verificada.
- `docs/design-direction.md` actualizado por root con la decisión aceptada. Sin cambios a contratos, backend, tipografía ni pantallas del alumno.
- Resultado final de integración root: **2/2 escenarios aprobados**, incluidos reflow por las cuatro etapas a 800/390/720/360 px y texto al 200 % a 1440 px. Lint root y diff --check aprobados. El preview supervisado permanece activo.
