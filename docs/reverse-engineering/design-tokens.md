# Tokens visuales observados

Este inventario separa valores medidos en SUM de valores existentes en la réplica. Los valores locales no son automáticamente tokens de SUM.

| Token | Valor respaldado por SUM | Fuente / confianza | Valor local, solo para comparar |
| --- | --- | --- | --- |
| Familia de fuente | Poppins | `evidence/sum/home/measurements.md`; media. | `Poppins` se empaqueta localmente; `:root` conserva Arial como fallback. |
| Tamaño base de shell | 14 px | Medición de Inicio; media. | `.student-app` usa 14 px. |
| Ancho sidebar | 280 px | Mediciones de Inicio y múltiples pantallas; alta. | `--sidebar-width: 280px`. |
| Alto barra superior | 64 px | Mediciones repetidas; alta. | `.topbar` 64 px. |
| Alto de navegación | 50 px | Notas de Mis Asistencias/Tutoría/Plan/Manuales; media-alta. | `.nav-item` 50 px. |
| Fondo sidebar | `rgb(48, 71, 103)` / `#304767` | Medición de Inicio; media-alta. | `#304767`. |
| Texto sidebar | `rgb(179, 184, 212)` / `#B3B8D4` | Medición de Inicio; media. | `#b3b8d4`. |
| Fondo header | `rgba(2, 51, 94, 0.5)` según valor computado | Medición de Inicio; media-baja: falta color de composición y referencia de píxeles sanitizada. | `#6e8fac`; discrepancia que no se resuelve con los datos disponibles. |
| Tarjetas blancas | blanco, radio 15 px y padding 20 px en Inicio | Nota de medidas de Inicio; media. | `.shortcut-card` tiene 14 px en el bento local actual. |
| Títulos interiores | 32 px local; SUM medido en varias cajas pero sin tokens tipográficos agregados | `evidence/sum/*/measurements.md`; baja para tamaño exacto global. | `.page-title h2` 32 px desktop y 24 px en un breakpoint local. |
| Colores de contenido y tablas | No hay una paleta SUM completa archivada. | Falta muestreo verificable con captura sanitaria. | Los colores CSS locales son aproximación, no evidencia. |

## Verificar antes de fijar

1. Header: obtener una captura de referencia sanitizada o una medición de estilo sin valores de cuenta.
2. Confirmar colores, tipografía y radio de tarjetas en más de una pantalla.
3. Registrar viewport, DPR, scroll y estado de menú de cada medida. Las medidas actuales mezclan esos estados.
4. Medir responsive con aprobación del operador y datos de prueba, sin navegar a estados privados.

