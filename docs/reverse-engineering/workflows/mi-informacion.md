# Mi Información — ejecución

- **Fecha:** 2026-10-08.
- **Modo:** ejecutar con `$sum-workflow`.
- **Estado:** implementación local y verificaciones finalizadas; el módulo global queda parcial con criterios visuales y estados no observados pendientes.
- **Plan persistente:** [plan de Mi Información](../plans/mi-informacion.md).

## Gate y uso del entorno autorizado

El solicitante declaró expresamente que el entorno era autorizado y delimitó la inspección a estas cinco vistas y a interacciones de lectura. Se usó el Brave iniciado por `powershell-brave-startup.ps`, CDP loopback `127.0.0.1:9222`, con origen permitido `https://sum.unmsm.edu.pe`. Las consultas Playwright y REA se hicieron secuencialmente sobre el mismo target. Se observaron navegación, DOM, estilos, etiquetas, tipos y geometría. No se alteraron registros, no se enviaron formularios, no se descargaron archivos ni se leyeron o guardaron valores personales/académicos.

La captura sanitizada del sidebar y las mediciones/limitaciones están en [observaciones](../../../evidence/sum/mi-informacion/observations-2026-10-08.md). REA filtró secciones DOM/accessibility por política; las observaciones de etiquetas proceden de consultas Playwright que solo devolvieron texto de rótulos y metadatos de controles, omitiendo valores.

## Implementación por pantalla

| Pantalla | Resultado local | Estado de referencia |
| --- | --- | --- |
| Menú desplegable Mi Información | Menú expansible con cuatro enlaces y navegación local; nombre del enlace Formulario actualizado a «Formulario de Datos». | Observado con REA/Playwright; solo existe referencia visual sanitaria del sidebar. |
| Mi Perfil | Personal inicia activo; botón Académica presenta los nueve rótulos observados. Cambio de Contraseña se deja fuera del comportamiento implementado. | Personal y Académica observadas; contraseña/descarga no verificadas. |
| Historial Académico | Resumen/tabla local y campo de búsqueda visible; ocho encabezados mantenidos. Datos son fixtures locales. | Estructura y encabezados observados; no se inspeccionó contenido de filas ni se usó búsqueda. |
| Formulario de Datos | Ocho secciones con rótulos observados y controles sintéticos; el único control habilitado observado es el campo étnico. | Orden, anclas y mapa de controles observados; opciones/validación/edición/descarga pendientes. |
| Ficha Socioeconómica | Trece secciones, encabezados observados y fila familiar vacía en réplica. | Orden y tabla observados; valores de fila, estados alternativos y algunas asociaciones detalladas de campos pendientes. |

## Verificación y capturas

- Captura fuente sanitizada: `evidence/sum/mi-informacion/reference-sidebar.png`.
- Capturas locales sintéticas: menú `evidence/local/mi-informacion/menu-candidate.png`; Perfil `evidence/local/perfil/{candidate,academic-candidate}.png`; Historial, Formulario y Ficha `evidence/local/{historial,formulario-datos,ficha-socioeconomica}/candidate.png`.
- Capturas no retienen información estudiantil real.
- Las rutas completas son localmente implementables/verificables; no se afirma equivalencia visual de pantalla completa porque no se retuvieron referencias seguras para contenido personal.
- Build/lint/Playwright local: resultados registrados en la corrida final abajo.

### Corrida final

- `pnpm --dir client verify` — aprobado: modo mock, 16 rutas, todas las aserciones del script pasaron, 0 consultas API.
- `pnpm --dir client build` — aprobado (`tsc -b`, Vite).
- `pnpm --dir client lint` — aprobado.
- `git diff --check` — aprobado.
- Capturas locales regeneradas: sidebar abierto `evidence/local/mi-informacion/menu-candidate.png`, Perfil `candidate.png` + `academic-candidate.png`, Historial, Formulario y Ficha en sus carpetas `evidence/local/`.

## Pendientes que no se declaran completos

- Comparación visual de pantalla completa para las cuatro rutas; solo el sidebar tiene una referencia sanitaria retenida.
- Cambio de Contraseña, descarga SUM, edición/modificación, opciones, validación y estados condicionales.
- Búsqueda/ordenamiento/paginación y datos del Historial.
- Valores y acciones de filas de Familia Salud.
- Asociación exacta de todos los controles/etiquetas de las secciones dinámicas de la Ficha.
