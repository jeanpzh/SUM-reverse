# SUM Replica — Design System

## Intent and evidence

Recreate the recognizable UNMSM SUM student portal while making the local replica easier to navigate, read, and use with a keyboard or small screen. Preserve the institutional blue shell, Poppins typography, Spanish labels, compact academic tables, and familiar page hierarchy. Improvements should clarify the existing experience; they must not turn it into a generic SaaS dashboard or a promotional landing page.

This document combines observed reference details with proposed improvements for the replica. A stated measurement is evidence; a proposed behavior is a local UX decision, not a claim about SUM.

| Evidence | Supported details | Confidence and limits |
| --- | --- | --- |
| `evidence/sum/mi-informacion/observations-2026-10-08.md` | Desktop shell, open Mi Información navigation, Poppins, profile/history/form sections, labels and control counts | Strong for the inspected state; values were omitted and protected tabs/downloads were not activated |
| `evidence/sum/home/measurements.md` | Sidebar 280 px, header 64 px, content offset, measured colors, white shortcut cards | Medium to high for the captured desktop viewport; no sanitized full-page reference image |
| `evidence/sum/*/structure.md` and `docs/reverse-engineering/screens/` | Page titles, table columns, section order, and visible controls across observed routes | Varies by route; row values and unvisited states are deliberately absent |
| User-provided sidebar captures in this thread | Expanded navigation and blue/lavender-gray surfaces | Useful for identity; exact color sampling is not retained |
| `docs/reverse-engineering/design-tokens.md` and `component-catalog.md` | Evidence confidence, local comparisons, component reuse boundaries | Local CSS values are not automatically SUM tokens |

Do not claim full-screen pixel parity from sidebar-only or sanitized structural evidence. Keep unknown states marked as unknown until new safe evidence is collected.

## Visual language

- **Atmosphere:** institutional, calm, information-dense, and practical. Students should find their destination and read academic records quickly.
- **Density:** balanced shell with dense data tables. Use spacing to separate sections, not oversized cards or decorative whitespace that hides rows.
- **Hierarchy:** persistent navigation → page title → optional academic context → page-specific content → table or form actions.
- **Identity:** retain the dark blue navigation rail, blue header, Poppins, SUM/UNMSM naming, Spanish terminology, and existing icon language. Do not redraw an uncertain crest or replace it with a fabricated logo.
- **Surface style:** white content panels and restrained borders. Use elevation only when it distinguishes a floating menu, modal, or separate surface.

## Color tokens

Only the first two values below have direct measured RGB values in the retained evidence. Treat the remaining roles as implementation guidance, not measured SUM colors.

| Token | Value | Role / status |
| --- | --- | --- |
| `--sum-sidebar` | `#304767` | Sidebar background; measured, medium-high confidence |
| `--sum-sidebar-text` | `#B3B8D4` | Sidebar labels; measured, medium confidence |
| `--sum-header-observed` | `rgba(2, 51, 94, 0.5)` | Computed header color; composition is unknown, low-medium confidence; do not treat as a final opaque hex |
| `--sum-selection` | Unspecified | A pale lavender/blue-gray selection surface appears in supplied menu captures; exact color is unmeasured |
| `--sum-content-surface` | White where observed | Cards in the home measurement; other page surfaces need route-specific confirmation |
| `--sum-content-background` | Unspecified | Use the existing replica token consistently until a sanitized reference measurement is available |
| `--sum-border`, `--sum-focus`, semantic status colors | Unspecified | Choose accessible local values, document them as local decisions, and keep them visually quiet |

Use a single blue-led palette. Do not introduce neon blue/purple, gradients, glow, or unrelated warm/cool gray mixtures. Check text and focus contrast against actual rendered backgrounds. Never use color alone to communicate active, error, or success state.

## Typography

- Use **Poppins** for the shell and page UI. The observed shell uses 14 px at the captured desktop viewport.
- Keep page titles clearly above body size without making them oversized. Existing measurements support repeated interior title blocks, but not one exact global title size.
- Use regular or medium weights for body and table content; use weight and spacing to establish hierarchy before adding color.
- Preserve the SUM's Spanish labels and accents exactly as documented per route. Keep institutional terms such as “Prematricula” only where the observed page omits the accent.
- Use tabular numerals where columns compare counts, credits, or grades. Avoid decorative display fonts and generic serif typography.

## Shell and layout

### Desktop

- Preserve the fixed-width, full-height dark navigation rail. The observed desktop sidebar is 280 px; the top bar is 64 px high. Main content begins below the header with the spacing recorded for each screen.
- Keep the student controls and session information in the top bar. Do not invent account details in examples or screenshots.
- Keep navigation groups expandable and retain their established order and Spanish names. The expanded submenu uses 50 px rows in the captured state.
- Keep page content aligned to a readable width. Wide academic tables may use the available main area rather than shrinking text until values become hard to scan.

### Small screens

Responsive navigation and mobile table behavior are not established by the retained SUM evidence. For the replica, implement them as explicit local UX improvements:

- Collapse the rail into a keyboard-operable drawer with a visible close control, backdrop, and focus return.
- Keep the active page visible in the navigation and avoid hiding the only route label.
- Keep tables readable with a labelled horizontal-scroll region or a carefully structured row layout; never clip actions or values silently.
- Stack form sections and summary panels into one column. Do not remove fields or actions to fit the viewport.
- Support zoom and long Spanish labels without overlap or fixed-height clipping.

## Components and interaction

### Navigation

- Preserve current group labels, route names, icons, and submenu hierarchy.
- Show the active destination with the existing blue/lavender-gray visual language and a non-color indicator such as weight or a left border.
- Give expandable groups `aria-expanded`, keyboard activation, visible focus, and a clear hit area. Opening a group must not navigate unexpectedly.
- Keep hover and focus treatments consistent with the active state without making them identical.

### Page heading and academic context

- Use one page title per route.
- Show the student summary only when its data source belongs to that screen's representation. Do not pair a real snapshot with a synthetic identity or period.
- When a snapshot lacks identity context, omit the summary rather than borrowing fields from another dataset.

### Tables

- Preserve each route's observed columns and order. Use semantic tables with scoped column headers and grouped headers for attendance counts/percentages.
- Align numeric values consistently; do not round, sum, relabel, or derive academic meaning unless a contract explicitly requires it.
- Keep search, download, and row actions outside data cells unless the observed structure places them there.
- On dense tables, use subtle row separators and restrained hover feedback. Do not use heavy card chrome around every row.
- Empty states should distinguish a valid empty list from unavailable, invalid, or still-loading data.

### Forms and section navigation

- Retain the observed Spanish section order and labels for Formulario de Datos and Ficha Socioeconómica.
- Place labels above controls, preserve native select/date/email semantics, and connect validation or help text with the relevant field.
- Many observed controls were disabled and read-only; do not make them editable or add save behavior without evidence and an explicit product requirement.
- A sticky section index, completion cues, and clear read-only explanation are local usability improvements. Do not imply that they exist in SUM.

### Downloads, dialogs, and actions

- Keep the visible “Descargar” action in its established location. Its production file format and effect were not verified.
- Label replica-generated exports explicitly, for example **“Descargar CSV local”**. Export only the fields the local projection actually contains.
- Keep schedule dialogs keyboard-operable, with a clear title, close button, focus management, and a compact table. The inspected reference supports the overlay pattern, not every schedule state.
- Do not activate protected or state-changing actions while collecting reference evidence.

## Data states and trust

- Keep `mock`, local fixture, and imported snapshot representations distinct. A local API error must never silently render mock data.
- Label demonstration data as such. Do not present a fixture as a real student's record.
- Show loading, retryable error, missing snapshot, valid empty, and populated states distinctly. Use concise Spanish messages and preserve the route when retrying.
- Never put personal values in committed screenshots or fixtures. Use synthetic data for development and mask identifying values in retained evidence.
- Candidate JSON types support shape validation; they do not establish hidden business rules, identity matching, eligibility, grades, or production backend behavior.

## Accessibility and motion

- Use semantic landmarks, headings in order, buttons for actions, links for navigation, and tables for tabular records.
- All controls must work by keyboard with a clear focus indicator. Focus must remain visible over blue navigation surfaces.
- Provide accessible names for icon-only controls and meaningful announcements for loading/error changes. Do not use placeholder text as the only label.
- Meet WCAG contrast for text and controls, including sidebar text and selected states. The measured palette does not exempt the implementation from contrast checks.
- Keep animation restrained: short transitions for menu and dialog state only. Respect `prefers-reduced-motion`; no perpetual shimmer, floating elements, or motion that competes with academic data.

## UX improvements that preserve the SUM identity

These are replica improvements, not claims about the reference site:

1. Make the current route and expanded navigation state easier to identify.
2. Improve responsive navigation and table access without changing the desktop hierarchy.
3. Separate “sin registros” from “snapshot no disponible” and from request errors.
4. Explain read-only controls and local CSV exports clearly.
5. Keep long forms navigable with a section index and stable return-to-section behavior.
6. Add keyboard, focus, screen-reader, zoom, and reduced-motion support while preserving the visual palette and terminology.

## Avoid

- Replacing the SUM blue shell or Poppins with a generic dashboard theme.
- Neon gradients, glow, ornamental hero sections, promotional copy, or decorative illustrations unrelated to the portal.
- Invented student names, grades, periods, rules, button effects, file formats, or hidden menu destinations.
- Treating every table, panel, or navigation item as the same reusable visual component when the evidence shows different hierarchy.
- Hiding uncertainty by converting missing snapshots into empty arrays or synthetic rows.
- Capturing or committing unredacted student data, private JSON, session material, or screenshots containing personal values.
