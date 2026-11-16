import { useContext, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { SidebarTrigger } from '../components/ui/Sidebar'
import { PlanningScopeBarContext } from '../components/planningSlots'
import { ModeToggle } from '../components/mode-toggle'
import { Button } from '../components/ui/Button'
import { HelpCircle, Save, PanelRight, Menu, List } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/Tooltip'

export interface PlanningScopeHeaderProps {
  eyebrow?: string
  title: string
  proposalTitle: string
  version: number | null
  nextAction?: ReactNode
  tertiaryAction?: ReactNode
  proposalActions?: ReactNode
  scopeSwitcher?: ReactNode
  generationOptions?: ReactNode
  actionSlotRef?: Ref<HTMLDivElement>
  draftState: string
  draftStateText: string
  workspaceDirty: boolean
  canSave: boolean
  draftBusy: boolean
  onGuide: () => void
  onSave: () => void
  disabledReason?: string | null
  onToggleChat?: () => void
  isChatOpen?: boolean
}

export function PlanningScopeHeader({ eyebrow, title, proposalTitle, version, nextAction, tertiaryAction,
  proposalActions, scopeSwitcher, generationOptions, actionSlotRef, workspaceDirty, canSave,
  draftBusy, onGuide, onSave, disabledReason, onToggleChat, isChatOpen = false,
}: PlanningScopeHeaderProps): ReactNode {
  const scopeBar = useContext(PlanningScopeBarContext)
  const bar = <header className="planning-scope-bar planning-scope-header" aria-label="Ámbito de planificación">
    <span className="planning-navigation-trigger"><SidebarTrigger aria-label="Mostrar u ocultar el menú" /><span className="planning-navigation-trigger__desktop" aria-hidden="true"><List size={12} /></span><Menu className="planning-navigation-trigger__mobile" size={18} aria-hidden="true" /></span>
    <span className="planning-scope-bar__product">Planificación académica</span>
    <span className="planning-scope-bar__divider" aria-hidden="true" />
    {scopeSwitcher}
    {proposalActions}
    <div className="planning-scope-bar__tools">
      <Tooltip><TooltipTrigger asChild>
        <Button id="planning-tour-guide" type="button" variant="ghost" size="icon" onClick={onGuide} aria-label="Guía">
          <HelpCircle aria-hidden="true" />
        </Button>
      </TooltipTrigger><TooltipContent>Guía</TooltipContent></Tooltip>
      {onToggleChat && <Tooltip><TooltipTrigger asChild>
        <Button id="planning-toggle-chat" type="button" variant="ghost" size="icon" onClick={onToggleChat}
          aria-label="Asistente" aria-pressed={isChatOpen} aria-expanded={isChatOpen} data-active={isChatOpen || undefined}>
          <PanelRight aria-hidden="true" />
        </Button>
      </TooltipTrigger><TooltipContent>{isChatOpen ? 'Cerrar asistente' : 'Abrir asistente'}</TooltipContent></Tooltip>}
      <ModeToggle className="planning-theme-control" />
    </div>
  </header>
  return <>
    {scopeBar ? createPortal(bar, scopeBar) : null}
    <header className="planning-page-head">
      <div className="planning-page-head__text">
        <p className="planning-eyebrow">{eyebrow ?? <>{proposalTitle} · {version ? `versión ${version}` : 'sin versión guardada'} · <span data-dirty={workspaceDirty || undefined}>{workspaceDirty ? 'cambios sin guardar' : version ? 'guardada' : 'sin guardar'}</span></>}</p>
        <h1 id="planning-page-title">{title}</h1>
        {disabledReason && <p id="planning-save-reason" className="planning-page-head__reason">{disabledReason}</p>}
      </div>
      {tertiaryAction && <details className="planning-mobile-stage-actions"><summary>Acciones</summary>{tertiaryAction}</details>}
      <div className="planning-page-head__actions">
        <span className="planning-mobile-provenance">Datos sintéticos · local</span>
        {tertiaryAction && <div className="planning-page-head__tertiary">{tertiaryAction}</div>}
        <Button type="button" variant="outline" id="planning-tour-save" disabled={!canSave || draftBusy}
          onClick={onSave} aria-describedby={disabledReason ? 'planning-save-reason' : undefined}>
          <Save className="size-4" aria-hidden="true" />{draftBusy ? 'Guardando…' : 'Guardar'}
        </Button>
        {generationOptions}
        {nextAction}
        <div className="planning-page-head__panel-actions" ref={actionSlotRef} />
      </div>
    </header>
  </>
}
