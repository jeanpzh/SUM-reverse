# Pulido visual informado por Hallmark

Fecha: 2026-11-08. Hallmark 407fa68 en modo audit, scope app, solo análisis estático (sin `--render`), sobre 52 archivos de planificación y `components/ui`. Dirección A vinculante ([design-direction](../../../docs/design-direction.md)); no se adopta tema, fuente ni paleta de Hallmark. Comando: `nice node client/.agents/skills/hallmark/scripts/sloplint.mjs <52 archivos> --scope app --json`. «Antes» = `bc7d7cb`; «después» = rama `t3/planning-p2-ux-polish`.

## Conteo por regla

| Regla | Antes | Después | Acción |
| --- | --- | --- | --- |
| 33 svg sin aria | 1 FAIL | 0 | Corregido: `aria-hidden` en la flecha de Tour |
| 34 anchos `100vw` | 4 FAIL | 0 | Corregido: `100%` en paneles fijos (inspector de recursos, modal de recursos, hojas de Horario/Preparación) |
| 39a deshabilitado solo con opacidad | 1 FAIL | 0 | Corregido: color, fondo y cursor `not-allowed` |
| 26b `:active` | 4 REFLEX | 2 | Corregido en `PlanningShell.css` para botones; quedan avisos por archivo (NativeSelect.css, AcademicIntentionDemandPanel.css), ya cubiertos globalmente |
| 26b `:disabled` | (incl.) | 0 | Añadido `cursor: not-allowed` global en `.planning-root` |
| F3 `text-wrap: balance` | 1 WARN | 0 | Corregido en `.page-title h2` |
| 48 literales de color | 33 FAIL | 32 FAIL | Corregida la sombra `rgba` con `--planning-shadow`; el resto se omite |
| 19 guiones en copy | 6 FAIL | 6 | Omitido |
| 20 sello CSS | 3 FAIL | 3 | Omitido |
| 63 punto medio | 15 FAIL | 15 | Omitido |
| F7 receta de contenedor | 2 WARN | 2 | Omitido |
| **Total** | 63 FAIL, 4 REFLEX, 3 WARN | 56 FAIL, 2 REFLEX, 2 WARN | |

Waivers formales de Hallmark: 0 (no se escribió ninguno); los omitidos se justifican aquí.

## Reglas omitidas

- **48 (32 FAIL):** son las declaraciones de tokens `--planning-*` dentro de `.planning-root` y `.planning-root[data-theme='dark']`, es decir, el archivo de tokens. El detector no reconoce ese ámbito; no hay literales fuera de tokens.
- **19 (6):** «—» es el marcador de valor vacío y «–» el rango horario (`08:00–22:00`); las pruebas de datos dependen de ese formato. No son guiones de prosa.
- **20 (3):** sello/comentario de crítica de Hallmark en CSS. Contradice el alcance (auditoría de un diseño bloqueado).
- **63 (15):** separadores `·` de etiquetas de dominio (curso · sección · versión). Instrucción explícita de conservarlos.
- **F7 (2):** misma receta de contenedor en controles de formulario; variarla rompe la consistencia de controles que se buscaba (UX-07) y A prescribe superficies uniformes.
- **26b restantes (2):** `:active` ya está definido globalmente en `PlanningShell.css`; el detector evalúa por archivo.
- Fuente, paleta, héroe/landing, `--render`: no aplican (dirección A; sin renderizador local).

## Cambios aplicados (CSS/TSX)

- `PlanningShell.css`: reduced-motion sin `!important` (selector `:root .planning-root *`), `:active` de botones, `cursor: not-allowed`, `text-wrap: balance`, altura uniforme de controles (40px), tablas sin partir palabras.
- `PlanningWorkbench.css`, `PlanningPreparationSummary.css`: `[hidden]` sin `!important`, con especificidad `.planning-root`.
- `PlanningSections.css`, `AcademicResourceEditor.css`: `100vw` → `100%`; sombra por token.
- `AcademicScheduling.css`: estado deshabilitado por color, fondo y cursor.
- `Tour.tsx`: `aria-hidden` en la flecha.
