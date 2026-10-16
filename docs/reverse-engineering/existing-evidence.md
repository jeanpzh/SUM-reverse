# Inventario de evidencia SUM

Fecha de auditoría: 2026-10-08. Esta documentación amplía el material de `evidence/sum/` y `docs/frontend/`; no reemplaza ni altera los originales.

## Trabajo anterior reutilizable

| Fuente | Cobertura y uso | Calidad / límite |
| --- | --- | --- |
| `docs/frontend/routes.md` | Inventario de 16 destinos SUM observados y nombres de navegación. | Las ocho tarjetas de Inicio y los nueve recursos de Manuales no tienen destino confirmado. |
| `docs/frontend/navigation.md`, `components.md` | Shell, navegación y patrones reutilizables descritos. | La mayoría son notas de observación; no todas tienen imagen de referencia. |
| `evidence/sum/<pantalla>/{structure,interactions,measurements}.md` | Notas para las 16 rutas: estructura, controles, dimensiones y límites de interacción. | No hay captura SUM retenida para 14 pantallas; los datos personales y académicos fueron omitidos. Las mediciones proceden de distintos estados de scroll. |
| `evidence/sum/tutoria/reference.png`, `evidence/sum/manuales/reference.png` | Dos referencias visuales sanitizadas. | Tutoría muestra el estado vacío. Manuales conserva el contenido principal y oculta la cabecera de cuenta. |
| `evidence/local/**` | 16 capturas candidatas locales, mediciones, verificaciones y resultados registrados. | Son evidencia del cliente local, no del SUM. `evidence/local/verification.md` registra build, lint y verificación aprobados; no se repitieron en esta auditoría. |
| `client/scripts/verify.mjs`, `client/src/data/*.test.ts` | Pruebas automatizadas locales del router/UI y capa de datos. | Son pruebas de la réplica con mocks e interceptores locales, no una validación contra producción. |
| `raw-types/README.md`, `raw-types/*.ts` | Doce conjuntos de tipos candidatos y rutas/acciones asociadas en el README. | El README declara extracción desde DevTools; no se encontró HAR, traza ni respuesta cruda para corroborar el origen o los métodos. Véase `contracts/observed-api.md`. |
| `docs/superpowers/specs/2026-10-07-raw-types-api-design.md` y `docs/superpowers/plans/2026-10-07-raw-types-api.md` | Decisiones y plan de integración de mocks, endpoints y adaptadores. | Especifican el cliente local. No prueban contratos del servidor ni autorizan usar la API real. |

## Archivos de captura y registros

El inventario no encontró archivos HAR, Playwright trace, logs de red ni respuestas crudas exportadas. Sí encontró notas Markdown, dos referencias SUM sanitizadas, capturas de candidatos locales, JSON de mediciones/resultados, tipos TypeScript y código de pruebas local. No se inspeccionaron capturas que pudieran contener valores personales.

`powershell-brave-startup.ps` estaba sin seguimiento en Git al iniciar la auditoría. Se conserva intacto y no se considera evidencia funcional del SUM.

## Evidencia nueva de REA

| ID | Operación | Resultado acotado | Límites |
| --- | --- | --- | --- |
| `ev_22f7640ca4d76ffc58cab9d3f84eac2ce045a0a67a72bb3ab365d2b7b3171859` | `binary_session` y `list_browser_targets` | Identidad REA alineada con `rea-agents` 6.0.0, skill esperada v33 y digest de catálogo `4c5f67…71ab1a`; una página SUM en el origen esperado. | Identifica servidor y pestaña, no comportamiento de la aplicación. No se guardaron URL completa ni datos de cuenta en este inventario. |
| Captura REA pasiva del 2026-10-08 (referencia deliberadamente no enlazada) | `capture_web_screenshot` | Viewport de 1295 × 887 en Inicio. Confirma el shell, la navegación y tarjetas de información académica en la posición visible. | La captura incluía un nombre en la cabecera; su artefacto no se incorpora a este repositorio ni se enlaza desde la especificación. No se desplazó ni se evaluó JavaScript. La posición y viewport no coinciden con la medición Playwright anterior, por lo que no se comparan geometrías. |

No se ejecutaron `inspect_web_page`, `analyze_web_bundle`, `observe_web_session`, `inspect_web_event_listeners` ni `inspect_web_network_capture`: el material visual y estructural existente responde las preguntas de interfaz cubiertas, y una captura de DOM/red podría devolver datos personales. Sus capacidades aparecen disponibles en el catálogo REA actual, pero disponibilidad no equivale a ejecución comprobada en este análisis.

## Clasificación transversal

- **Verificado por observación del cliente:** estructura y rótulos visibles documentados en las notas por pantalla; dos estados visuales de referencia sanitizados; una observación actual de Inicio vía REA. Alcance limitado a la cuenta y estados que estaban disponibles.
- **Parcial:** resultado de controles no activados, estados alternativos, pantallas con mediciones sin captura de referencia, y controles de Inicio/Manuales que solo se identifican como enlaces o botones.
- **Inferido / fuente declarada:** contratos TypeScript y asociaciones ruta/acción de `raw-types/README.md`; supuestos de método, valores ausentes y respuestas envelope. La fuente original no está archivada.
- **Desconocido:** internals del servidor, autenticación, parámetros/cuerpos completos, errores, paginación, persistencia, permisos y reglas académicas. No se inspeccionó ni se infirió implementación backend.

## Duplicaciones, inconsistencias y lagunas

1. Las mediciones de Inicio anteriores (1038 × 711, primer acceso a tarjeta cerca del borde inferior) no son comparables con la captura REA actual (1295 × 887, scroll ya avanzado). No constituyen una contradicción de diseño hasta fijar viewport y scroll.
2. `docs/frontend/implementation.md` y la especificación del 2026-10-07 registran que Inicio local pasó de tarjetas apiladas observadas a un bento grid aprobado. Es una decisión de diseño de la réplica, no evidencia SUM; para fidelidad estricta debe revisarse.
3. Las notas dicen que ocho tarjetas de Inicio y nueve recursos de Manuales son enlaces, pero no se siguieron sus destinos. Las rutas no deben deducirse por sus rótulos.
4. La navegación indica que 16 rutas cargaron desde la sesión autorizada; la nota de Inicio también documenta un enlace inestable y un intento directo que acabó en login. Las pruebas posteriores respaldan disponibilidad histórica de esas pantallas, pero el acceso actual puede caducar.
5. El catálogo de endpoints del README y los tipos no tienen respaldos crudos en el repositorio. El método de ocho acciones no está especificado y todos los métodos `POST` en `client/src/data/endpoints.ts` son una hipótesis local explícita.
6. Hay medidas con valores diferentes para tablas/formularios entre notas y JSON de mediciones locales, lo que es esperable porque son clientes distintos. Usar siempre la fuente SUM para observación y la fuente local solo para comparar.
7. Conteos de formularios difieren: Datos Personales 61 textboxes/80 comboboxes observados frente a 46/69 en la réplica; Ficha Socioeconómica 107/76 frente a 74/108. El propio inventario local documenta que los detalles/campos no están completos.

