# Plan de verificación de la réplica

Este plan se ejecuta en `client/` con datos sintéticos. No usa la API de SUM. Los resultados anteriores están registrados en `evidence/local/verification.md`, `evidence/local/check-results.json` y los archivos `client/src/data/*.test.ts`; no se repitieron en esta auditoría.

## Suite existente que se puede reutilizar

- `pnpm --dir client test:data`: contratos, construcción de URL, configuración, parser y adaptadores de datos locales.
- `pnpm --dir client verify`: Playwright headless local, carga directa de 16 rutas, navegación, back/forward, estado inicial de perfil, formularios read-only, anclas, modal, descargas simuladas y bloqueo de solicitudes externas.
- `pnpm --dir client build` y `pnpm --dir client lint`: validación TypeScript/bundle y estilo.

Los documentos guardan ejecuciones anteriores aprobadas. No deben interpretarse como resultado de esta auditoría ni como prueba de acceso a producción.

## Criterios funcionales siguientes

1. Fijar fixtures sintéticos y verificar coherencia entre Perfil, resumen, matrícula, programación, horarios, asistencia y reportes.
2. Comprobar navegación directa, grupos, active state, volver/avanzar y el estado colapsado en viewport desktop y estrecho.
3. Comprobar tabla poblada/vacía, overflow, conteos, y exportación CSV contra exactamente las filas presentadas.
4. Comprobar modal local de horarios: apertura/cierre, foco accesible, teclado, bloqueo/restauración de scroll y datos sintéticos.
5. Probar API únicamente con servidor/interceptor local: ruta/acción, método explícitamente etiquetado como supuesto donde corresponda, JSON inválido, HTML, HTTP no exitoso, `codError`, cancelación y lista opaca.
6. Validar accesibilidad de navegación/diálogo/formularios y ausencia de datos reales, recursos externos y peticiones fuera de localhost.
7. Comparar visualmente a viewport, scroll y estado idénticos contra referencias sanitizadas. Actualmente solo Manuales y Tutoría permiten una comparación SUM directa persistida.

No certificar respuesta de backend ni fidelidad de estados que no estén respaldados por evidencia. No probar inscripción, edición, pagos, descargas personales ni acciones de SUM real.

