# Verificación E2E y UX de planificación

Fecha: 2026-11-08 UTC. Código auditado: `dfc13293a1a303b05661b50a0972d83890bfebcd`, rama `t3/planning-shadcn-primitives`.

**Resultado: el ciclo principal llega a publicación con persistencia real. La aceptación UX queda pendiente: la guía no avanza y revisión docente desborda a 390px.** Esta pasada no modifica la aplicación.

## Alcance y procedencia

- Fuente de los resultados: `observed`, entorno `local-only`, Sistemas / periodo de demostración 2027-I. No son observaciones de SUM ni evidencia normativa.
- Dirección vinculante: [docs/design-direction.md](../../../docs/design-direction.md), decisión del usuario del 2026-11-07; se conserva A, sin adoptar un tema de Hallmark.
- API propia: `backend/dist/programacion-academica/local-main.js` en loopback 3415. Cliente Vite en loopback 5295, modo `local`, proxy `/api`, perfil `synthetic-actors`, simulador desactivado.
- Ambos procesos se iniciaron con entorno explícito mínimo; no heredaron variables snapshot. Almacenamiento nuevo: `/tmp/sum-hallmark-synthetic-drafts`.
- El catálogo incorporado está declarado sintético: [contrato](../../../docs/reverse-engineering/contracts/local-api/programacion-academica-demo.md), apartado de nombres y catálogo; `backend/src/programacion-academica/synthetic-catalog-adapter.ts:239–243`. La semejanza de un nombre de referencia con una persona no establece procedencia privada.
- Se creó un documento de auditoría con INE002, demanda 30 y capacidad 45 mediante la UI. No se usaron interceptores ni respuestas simuladas de red. Los POST llegaron a NestJS y los efectos se contrastaron con lecturas posteriores de la API.
- Navegador: T3 Code Preview, sesión propia de incógnito, navegación secuencial. Escritorio 1280×800, móvil 390×844; mediciones de cursos también a 320, 768 y 1920px. Capturas de esta ejecución, sin comparación pixel a pixel con otra versión.

## Criterio → escenario → resultado

| ID | Escenario y resultado esperado | Resultado real | Estado |
| --- | --- | --- | --- |
| E01 | Arranque sin borradores: cargar catálogo y presentar vacío | Catálogo 200; 0 cursos seleccionados, oferta incompleta. El texto «Guardado» es engañoso: UX-03 | Cumple funcional / observación UX |
| E02 | Checkbox Radix y capacidad inválida: bloquear guardado | Seleccionar INE002 funciona; capacidad 0 deshabilita Guardar y muestra «Demanda y capacidad requeridas»; 45 recupera el control | Cumple |
| E03 | Guardar configuración y anunciar éxito | POST guardar 200, versión 1; Sonner «Guardada · versión 1.»; lista real contiene el documento | Cumple |
| E04 | Recargar y recuperar configuración | Mis propuestas → Continuar edición; POST continuar 200; mismo nombre, selección y demanda, versión 1 | Cumple |
| E05 | Generar con una asignatura válida | POST propuestas 200; programación completa, 1 sección y 2/2 componentes. Resultado existe en Horario, aunque no se comunica el siguiente paso desde Preparación: UX-04 | Cumple funcional / observación UX |
| E06 | Guardar horario y habilitar revisión | POST guardar 200, versión 2; aparece Enviar a revisión docente | Cumple |
| E07 | Tabla y Semana representan la propuesta | Mismo curso, sección y bloque; Semana presenta agenda por días a 390px, sin desbordamiento de documento en ese estado | Cumple en el caso probado |
| E08 | Scroll vertical con cabecera fija en cursos | Con 56 cursos, contenedor con overflow auto. Al desplazar 600px, cabecera queda a 1px del borde superior del contenedor (antes: 2.5px) | Cumple |
| E09 | Enviar y responder revisión simulada | POST revisión/enviar 200 → versión 3, pendiente; seleccionar vista Docente y Dar conformidad → POST responder 200, versión 4, lista para aprobación | Cumple; descubribilidad UX-05 |
| E10 | Cancelar aprobación no escribe | AlertDialog abre con Cancelar enfocado; Escape cierra y devuelve foco; lectura de API conserva versión 4, ready-for-approval | Cumple |
| E11 | Aprobar con confirmación explícita | Confirmar Aprobar → POST aprobar 200, versión 5, estado approved; publicar sigue siendo una acción separada | Cumple |
| E12 | Cancelar publicación no publica; confirmar sí | Tras cancelar: currentId null e items vacíos. Confirmar Publicar → POST publicar 200, versión 6, publicación 1 vigente | Cumple |
| E13 | Publicación de solo lectura | Guardar propuesta y Volver a generar deshabilitados; encabezado informa versión congelada | Cumple en controles observados |
| E14 | Crear nuevo borrador conserva el origen | AlertDialog → POST nuevo-borrador 200; nuevo id y versión 1; lectura de publicaciones idéntica antes/después | Cumple |
| E15 | Título vacío: rechazo y recuperación | Validador del cliente impide el POST; alert «title: texto inválido» y toast genérico. Corregir título y guardar produce POST 200, versión 2 del nuevo borrador | Cumple funcional / texto UX-06 |
| E16 | Cancelar cambio de periodo conserva ediciones | Demanda 31 sin guardar; seleccionar 2026-II abre AlertDialog. Escape conserva 2027-I y demanda 31 | Cumple |
| E17 | Persistencia después de reiniciar NestJS | Listas de borradores/publicaciones exactamente iguales antes/después: borrador versión 2 y original published versión 6 | Cumple; [registro](restart-check.json) |
| E18 | Guía debe avanzar y permitir salir | Cinco clics en Siguiente mantienen Etapas / Paso 1 de 5. Escape cierra y devuelve foco a Guía | **Falla UX-01** |
| E19 | Revisión docente no debe desbordar a 390px | En vista Docente: documento de 404px para viewport de 390; textarea content-box, ancho real 392px para ancho CSS 366px | **Falla UX-02** |
| E20 | Foco y reflow de los estados probados | Cuatro Tab alternan Aprobar/Cancelar dentro del AlertDialog y mantienen focus-visible. Cursos no desborda el documento a 320/390/768/1280/1920; tabla mantiene scroll interno | Cumple en estados observados |

### Incidencia del entorno

Los primeros procesos abiertos mediante sesiones de ejecución terminaron con SIGTERM (143). Un intento de guardar produjo ERR_CONNECTION_REFUSED: la UI retuvo los cambios y mostró un alert de error. Se reiniciaron procesos independientes con la misma carpeta sintética; se recuperó la versión 1, se regeneró y el resto del ciclo terminó correctamente. No se clasifica esa interrupción como fallo del backend. La pérdida de propuesta en memoria tras reinicio es distinta de la persistencia del borrador guardado, comprobada en E17.

## Checks deterministas

| Comando | Salida relevante | Exit |
| --- | --- | --- |
| `nice pnpm --dir client test:data` | 270 pruebas, 270 pasan, 0 fallan | 0 |
| `nice pnpm --dir client lint` | Sin diagnósticos | 0 |
| `nice pnpm --dir client build` | TypeScript y Vite; built in 9.32s | 0 |
| `nice pnpm --dir backend build` | Nest build | 0 |
| `nice pnpm --dir backend lint` | 0 errores; 4 warnings unbound-method en test/local-profile-session.spec.ts | 0 |
| `nice pnpm --dir client check:planning-contrast` | Pares de tokens claro/oscuro cumplen sus umbrales | 0 |

Las salidas completas están en los archivos `.txt` de esta carpeta. Las 270 pruebas son de la capa de datos; no se presentan como 270 pruebas E2E. E01–E20 son escenarios ejecutados en navegador, API y almacenamiento según corresponde.

## Hallmark

Se ejecutó [Hallmark](https://github.com/Nutlope/hallmark), modo audit y scope app, versión 2.0.0, commit upstream `407fa689f4a276f2fd389208d271d0fef08f5058`, clonado solo en `/tmp/sum-hallmark-audit`. Se revisaron SKILL, redesign/audit, App screens y gates. No se instaló una dependencia en el proyecto ni se aplicó un tema nuevo.

Comando base: `nice node /tmp/sum-hallmark-audit/skills/hallmark/scripts/sloplint.mjs <31 archivos explícitos de planificación/UI> --scope app --genre modern-minimal --render --url http://127.0.0.1:5295/local/programacion-academica --before --json`.

- [Resultado before](hallmark-before.json): 35 FAIL, 4 REFLEX, 2 WARN. Exit 0 significa que se escribió el registro before; **no significa aceptación**.
- [Barrido previo](hallmark.json): 38 FAIL, 4 REFLEX, 2 WARN, exit 1; incluye tres avisos extra por ausencia del sello Hallmark en CSS que Hallmark no había creado.
- 32 FAIL de gate 48 señalan declaraciones de tokens dentro de `.planning-root`. Se descartan como incompatibilidad del detector con el ámbito de tokens adoptado por este proyecto; no son 32 colores sin tokenizar.
- Gate 63 señala puntuación de metadatos; es una sugerencia de redacción, no un fallo funcional. Gate 39a sobre estados disabled y gate 33 sobre un SVG del componente Tour requieren revisar el estado realmente renderizado antes de afirmar una infracción de accesibilidad.
- REFLEX 26b y WARN F3/F7 son candidatos de acabado; no sustituyen la verificación de estilos computados, teclado y capturas. La tipografía y estructura A prevalecen sobre reglas de marketing.
- **El renderizador propio de Hallmark no se ejecutó:** no existe puppeteer-core ni un binario Chrome local. Su informe lo declara. Las capturas y comprobaciones de interacción de esta auditoría se ejecutaron por T3 Preview; no se presentan como un render pass de Hallmark.

## Límites pendientes

- Sin lector de pantalla ni comprobación de zoom real al 200%; no se declara conformidad WCAG completa.
- No se ejecutaron ajuste de bloque, arrastre, demanda estimada, escenarios imposibles/límite de búsqueda, catálogo de 96 cursos, concurrencia ni sustitución de una publicación vigente en esta pasada.
- Activación de matrícula e intenciones no se probaron: pertenecen a módulos adicionales ausentes de la API dedicada de planificación. No se inspeccionaron pantallas estudiantiles.
- No se ejecutó la suite Playwright histórica. Se usó el navegador solicitado de T3 para las interacciones reales y se guardaron sus observaciones.
- No hay evidencia de producción ni se acredita fidelidad visual al SUM: se audita el producto interno local.

Ver [hallazgos UX y capturas](ux-audit.md), [observaciones de navegador](browser-observations.json) y lecturas de API de esta carpeta. Las capturas contienen únicamente el entorno de demostración declarado sintético.
