# Inicio

- **Ruta observada:** `/alumnoWebSum/v2/inicio`.
- **Interfaz:** shell de estudiante; resumen académico y ocho tarjetas de acceso en la página, según evidencia previa. La captura REA actual muestra parte de las tarjetas de información y el período en scroll avanzado.
- **Interacciones:** controles de tarjeta identificados como “Ver más...”; sus destinos/resultados no están verificados. El menú lateral contiene categorías observadas en `docs/frontend/routes.md`.
- **Evidencia:** `evidence/sum/home/{structure,interactions,measurements}.md`; captura REA pasiva del 2026-10-08, no enlazada porque mostraba un nombre de cuenta.
- **Límite:** no hay screenshot SUM persistido porque la cabecera contiene identidad; el snapshot REA tampoco se guarda. Viewport Playwright 1038×711 y snapshot REA 1295×887 con scroll distinto; no comparar posiciones.
- **Confianza:** media para shell y categorías; baja para destinos y respuesta de las tarjetas. La cuadrícula bento local es una decisión ya anotada en `docs/superpowers/specs/2026-10-07-raw-types-api-design.md`, no diseño fuente verificado.

## Revisión incremental REA — 2026-10-08

- **Resultado:** bloqueada para nueva inspección de la fuente. No hay entorno de pruebas autorizado con datos sintéticos ni artefactos sanitizados de Inicio aptos para análisis estático. En la carpeta relacionada solo hay notas SUM y capturas de candidatos de la réplica local; estas últimas no son referencia del SUM.
- **Herramientas:** se consultaron los contratos actuales. `inspect_web_page` incluye DOM y puede devolver textos; `analyze_web_bundle` captura fuentes JS y puede solicitar source maps; `capture_web_screenshot` entrega el viewport completo sin opción de redacción; el snapshot de Playwright puede exponer el árbol de accesibilidad. No ejecuté ninguna sobre producción. Tampoco hay HAR en la evidencia relacionada para `inspect_web_network_capture`.
- **Hallazgo nuevo de interfaz:** ninguno. La captura REA citada por la auditoría inicial era un viewport con scroll y cabecera identificable; no es segura para persistir ni permite comparar medidas con Playwright.
- **Hechos reutilizables:** la estructura del shell y las ocho tarjetas descritas en las notas Playwright siguen siendo el único respaldo de la fuente. Sidebar, topbar, área principal y tarjeta son componentes razonables para React, pero los resultados de las tarjetas no están especificados.
- **Pendiente:** referencia de demo sanitaria en estado superior, viewport y scroll anotados; prueba autorizada de navegación del shell y destino de tarjetas, sin acciones académicas.
- **Decisión:** Inicio no está listo para implementación visual fiel. El shell base puede construirse a partir de medidas conocidas; decidir bento frente a tarjetas apiladas y cerrar estados/destinos requiere evidencia segura.

