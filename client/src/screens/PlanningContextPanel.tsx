import { useEffect, useRef, type KeyboardEvent } from 'react'
import { Maximize, Minimize, Scale, X } from 'lucide-react'
import type { PlanningPeriod } from '../data/academicScheduling'
import { PlanningNormativeChat } from './PlanningNormativeChat'
import { planningAssist, usePlanningAssist, type PlanningAssistTab } from './PlanningAssistState'
import { usePlanningSessionContext } from '../components/PlanningSessionProvider'
import type { NormativeChat } from './useNormativeChat'
import './PlanningContextPanel.css'
import './PlanningAssist.css'

export interface PlanningContextPanelProps {
  academicPeriod: PlanningPeriod
  chat: NormativeChat
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onClose: () => void
}

const TABS: ReadonlyArray<{ id: PlanningAssistTab; label: string }> = [
  { id: 'consejero', label: 'Consejero' },
  { id: 'normativa', label: 'Normativa' },
]

// Stable identity: React re-runs a changing ref callback on every render.
function bindAdvisorSlot(element: HTMLDivElement | null) {
  if (!element) return
  planningAssist.setSlot(element)
  return () => planningAssist.clearSlot(element)
}

export function PlanningContextPanel({ academicPeriod, chat, expanded, onExpandedChange, onClose }: PlanningContextPanelProps) {
  const { tab, advisors, openRequests } = usePlanningAssist()
  const { state: { draft } } = usePlanningSessionContext()
  const titleRef = useRef<HTMLHeadingElement | null>(null)
  const tabRefs = useRef<Record<PlanningAssistTab, HTMLButtonElement | null>>({ consejero: null, normativa: null })

  // "Consultar consejero" opens the rail on purpose, so focus follows to the panel.
  useEffect(() => {
    if (planningAssist.consumeFocusRequest()) {
      if (advisors > 0 && planningAssist.getTab() === 'consejero') titleRef.current?.focus()
      else tabRefs.current[planningAssist.getTab()]?.focus()
    }
  }, [openRequests, advisors])

  const selectTab = (next: PlanningAssistTab, focus = false) => {
    planningAssist.setTab(next)
    if (focus) tabRefs.current[next]?.focus()
  }
  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.findIndex((item) => item.id === tab)
    const next = event.key === 'ArrowRight' ? TABS[(index + 1) % TABS.length]
      : event.key === 'ArrowLeft' ? TABS[(index - 1 + TABS.length) % TABS.length]
      : event.key === 'Home' ? TABS[0]
      : event.key === 'End' ? TABS[TABS.length - 1]
      : null
    if (!next) return
    event.preventDefault()
    selectTab(next.id, true)
  }

  return (
    <section className="planning-copilot planning-assist" data-expanded={expanded || undefined} aria-label={tab === 'consejero' ? 'Consejero de planificación' : 'Asistente normativo'}>
      <header className="planning-assist__header">
        <div className="planning-assist__identity"><Scale size={18} aria-hidden="true" /><div><h2 ref={titleRef} tabIndex={-1}>Consejero normativo</h2><span className="planning-eyebrow">{draft.title} · {draft.version === null ? 'sin guardar' : `v${draft.version}`}</span></div></div>
        <div hidden={advisors > 0 && tab === 'consejero'} role="tablist" aria-label="Asistencia" className="planning-assist__tabs">
          {TABS.map((item) => (
            <button key={item.id} type="button" role="tab" id={`planning-assist-tab-${item.id}`}
              ref={(element) => { tabRefs.current[item.id] = element }}
              aria-selected={tab === item.id} aria-controls={`planning-assist-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1} className="planning-assist__tab"
              onClick={() => selectTab(item.id)} onKeyDown={onTabKeyDown}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="planning-assist__controls">
          <button type="button" className="planning-assist__icon-btn"
            aria-label={expanded ? 'Restaurar tamaño' : 'Expandir al ancho completo'}
            title={expanded ? 'Restaurar tamaño' : 'Expandir al ancho completo'}
            onClick={() => onExpandedChange(!expanded)}>
            {expanded ? <Minimize size={14} strokeWidth={1.5} aria-hidden="true" /> : <Maximize size={14} strokeWidth={1.5} aria-hidden="true" />}
          </button>
          <button type="button" className="planning-assist__icon-btn" aria-label="Cerrar asistente" title="Cerrar asistente" onClick={onClose}>
            <X size={14} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      </header>
      <div id="planning-chat-body" className="planning-copilot__body planning-assist__body">
        <div role="tabpanel" id="planning-assist-panel-consejero" aria-labelledby="planning-assist-tab-consejero"
          hidden={tab !== 'consejero'} className="planning-assist__panel planning-assist__panel--advisor">
          {tab === 'consejero' && <>
            <div ref={bindAdvisorSlot} className="planning-assist__slot" />
            {advisors === 0 && <div className="planning-assist__empty">
              <span className="planning-eyebrow">Consejero de planificación</span>
              <p>Selecciona los cursos y revisa los recursos en Preparación para generar una propuesta.</p>
            </div>}
          </>}
        </div>
        <div role="tabpanel" id="planning-assist-panel-normativa" aria-labelledby="planning-assist-tab-normativa"
          hidden={tab !== 'normativa'} className="planning-assist__panel planning-assist__panel--normative">
          {tab === 'normativa' && <PlanningNormativeChat academicPeriod={academicPeriod} chat={chat} />}
        </div>
      </div>
    </section>
  )
}
