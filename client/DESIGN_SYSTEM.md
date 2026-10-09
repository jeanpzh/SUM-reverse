# Design system SUM

La fuente ejecutable de tokens es `src/styles/theme.css`, importada una vez desde `src/index.css`. Tailwind 4 genera utilidades a partir de esos tokens. La identidad conserva Poppins, azul institucional y superficies blancas; los acentos y estados son decisiones locales, no mediciones nuevas de SUM.

## Colores por función

| Función | Token / utilidad |
| --- | --- |
| Fondo general | `--color-sum-background` / `bg-sum-background` |
| Panel | `--color-sum-surface` / `bg-sum-surface` |
| Fondo secundario | `--color-sum-surface-muted` / `bg-sum-surface-muted` |
| Texto principal | `--color-sum-text` / `text-sum-text` |
| Encabezado | `--color-sum-heading` / `text-sum-heading` |
| Texto secundario | `--color-sum-muted` / `text-sum-muted` |
| Bordes | `--color-sum-border` / `border-sum-border` |
| Navegación | `sum-sidebar`, `sum-sidebar-text`, `sum-sidebar-active`, `sum-topbar` |
| Enlace y foco | `sum-link` |
| Selección | `sum-accent`, `sum-accent-soft` |
| Estados | `sum-danger`, `sum-success`, `sum-warning`; acompañar siempre con texto |

## Tipografía

Una familia para toda la interfaz: `font-sans` (Poppins con fallback). `font-mono` se reserva a contenido técnico donde sea necesario. Los números comparables usan `tabular-nums`.

| Rol | Utilidad | Tamaño |
| --- | --- | --- |
| Metadato auxiliar | `text-meta` | 11 px |
| Tabla o fila de datos | `text-data` | 12 px |
| Navegación y cuerpo | `text-body` | 14 px |
| Título de sección | `text-section` | 18 px |
| Título de página | `text-page` | 24 px |

El tamaño debe corresponder al rol, no al componente. Etiqueta y valor de una misma fila usan `text-data`; evitar cifras sobredimensionadas. Los tamaños equivalen a estos píxeles con raíz de 16 px y permiten escalado del usuario.

## Uso

```tsx
<section className="rounded-panel border border-sum-border bg-sum-surface p-4 font-sans text-body text-sum-text">
  <h2 className="text-section font-semibold text-sum-heading">Resumen</h2>
  <p className="text-data tabular-nums">12.50</p>
</section>
```

CSS específico de pantalla consume la misma fuente:

```css
.screen-heading {
  color: var(--color-sum-heading);
  font-size: var(--text-section);
}
```

No redefinir paletas por pantalla ni copiar hexadecimales. Añadir un token central solo si representa una función reutilizable. Usar la escala de 4 px para espacios y `rounded-control` / `rounded-panel` para radios. `shadow-floating` está reservado a menús y diálogos; los paneles normales usan borde, sin glow ni degradados.

## Integración gradual

Se conserva el reset actual: Tailwind se carga sin Preflight para evitar cambios involuntarios en tablas y formularios existentes. Las reglas CSS heredadas sin capa tienen prioridad sobre utilidades; al migrar un componente, retirar del selector antiguo las propiedades reemplazadas o moverlo a `@layer components`. No agregar `!important` para resolver esa convivencia.

Historial, horario semanal y las variables de Información de Matrícula consumen tokens. La base global usa la fuente y colores comunes. `App.css` y otras pantallas mantienen estilos históricos; su migración completa queda pendiente y debe hacerse por componente con revisión visual. No se afirma conformidad WCAG ni paridad visual a partir de los tokens.

Checks requeridos: `pnpm --dir client build` y `pnpm --dir client lint`. Las verificaciones visuales o de comportamiento usan fixtures sintéticos cuando estén autorizadas.
