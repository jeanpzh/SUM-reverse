import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck } from 'lucide-react'

export function PlanningResultStrip({ status, label, facts, action, children, statusId, className = '', ariaLabel = 'Resultado' }: {
  ariaLabel?: string
  status: string
  label: ReactNode
  facts?: readonly ReactNode[]
  action?: ReactNode
  children?: ReactNode
  statusId?: string
  className?: string
}) {
  const success = ['complete', 'ready', 'approved', 'published', 'ready-for-approval'].includes(status)
  return <section className={`planning-status-bar ${className}`} data-status={status} aria-label={ariaLabel}>
    <div className="planning-status-bar__strip">
      <strong id={statusId} role="status" className="planning-status-bar__state-row">
        {success ? <CircleCheck size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}{label}
      </strong>
      {facts && <div className="planning-status-bar__facts">{facts.map((fact, index) => <span className="planning-status-bar__fact" key={index}>{fact}</span>)}</div>}
      {action && <div className="planning-status-bar__actions">{action}</div>}
    </div>
    {children}
  </section>
}
