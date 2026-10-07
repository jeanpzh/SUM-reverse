# Reusable Frontend Patterns

Confirmed from the student home screen:

- **Student shell:** sidebar, top header, and independently tall main content region.
- **Sidebar navigation item:** icon plus label; observed links include both direct routes and expandable category headings.
- **Home shortcut card:** rounded white container with category label, heading, bullet summary, and “Ver más...” action.
- **Data table:** pages use a page title, optional “Descargar” button, grouped column headings, and a scrollable body. Attendance and curriculum tables contain student-specific values; tutoring showed an empty state.
- **Tutorial resource card:** linked row with a title, description, date, and WebSUM 2.0 label.
- **Profile tabs:** Mi Perfil exposes Información Personal, Información Académica, and Cambio de Contraseña. Only the initial personal tab was observed.
- **Long student form:** a section navigator links to stacked form groups with disabled fields and occasional “Modificar” actions. Account values are excluded from evidence.
- **Enrollment information article:** one text-led page with a module introduction and five numbered policy/control sections; no controls were present in the observed state.
- **Typography and colors:** Poppins throughout; dark blue sidebar with muted lavender text; white shortcut cards.

The shared shell was confirmed on home, attendance, tutoring, study plan, manuals, profile, history, and personal-data forms. Enrollment and all five Reports screens were subsequently inspected. The local shared architecture is documented in `implementation.md`.
