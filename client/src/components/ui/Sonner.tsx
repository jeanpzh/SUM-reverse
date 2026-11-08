// shadcn/ui Sonner (registry "sonner"), adapted: --planning-* tokens, no next-themes.
// Rendered once by PlanningShell inside .planning-root. Use toast() only for feedback on a
// completed action; blocking states, field errors and disabled-gate reasons stay inline.
import type { CSSProperties } from 'react'
import { Toaster as Sonner, toast, type ToasterProps } from 'sonner'
import './Sonner.css'

function Toaster({ style, ...props }: ToasterProps) {
  return (
    <Sonner
      className="planning-toaster"
      position="bottom-right"
      closeButton
      containerAriaLabel="Notificaciones"
      toastOptions={{ closeButtonAriaLabel: 'Cerrar notificación' }}
      style={{
        '--normal-bg': 'var(--planning-surface)',
        '--normal-text': 'var(--planning-text)',
        '--normal-border': 'var(--planning-border)',
        '--border-radius': 'var(--planning-radius-floating)',
        ...style,
      } as CSSProperties}
      {...props}
    />
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export { Toaster, toast }
