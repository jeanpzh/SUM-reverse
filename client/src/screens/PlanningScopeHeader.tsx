import { SidebarTrigger } from '../components/ui/Sidebar'
import type { ReactNode } from 'react'
import { PageTitle } from '../components/Common'
import { Button } from '../components/ui/Button'
import { HelpCircle, Save, MessageSquare } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/Tooltip'

export interface PlanningScopeHeaderProps {
  title: string
  proposalControls?: ReactNode
  nextAction?: ReactNode
  tertiaryAction?: ReactNode
  proposalActions?: ReactNode
  school?: string
  period?: string
  draftState: string
  draftStateText: string
  workspaceDirty: boolean
  canSave: boolean
  draftBusy: boolean
  saveIsPrimary?: boolean
  onGuide: () => void
  onSave: () => void
  disabledReason?: string | null
  onToggleChat?: () => void
  isChatOpen?: boolean
}

export function PlanningScopeHeader({
  title,
  proposalControls,
  nextAction,
  tertiaryAction,
  proposalActions,
  school = 'Sistemas',
  period = '2027-I',
  draftState,
  draftStateText,
  workspaceDirty,
  canSave,
  draftBusy,
  onGuide,
  onSave,
  disabledReason,
  onToggleChat,
  isChatOpen = false,
}: PlanningScopeHeaderProps): ReactNode {
  return (
    <header
      className="planning-scope-header"
      aria-label="Ámbito y estado de programación"
    >
      {/* Page title and scope row */}
      <div className="planning-scope-header__title-row">
        <div className="planning-scope-header__context">
          <SidebarTrigger aria-label="Mostrar u ocultar el menú" />
          <div id="planning-page-title"><PageTitle>{title}</PageTitle></div>
        </div>
        <div className="planning-scope-header__primary-actions">
          {nextAction}
          <Button type="button" variant="outline" id="planning-tour-save"
            disabled={!canSave || draftBusy} onClick={onSave}
            aria-label="Guardar propuesta de planificación">
            <Save className="size-4" aria-hidden="true" />
            <span>{draftBusy ? 'Guardando…' : 'Guardar'}</span>
          </Button>
          {tertiaryAction}
        </div>
        <div className="planning-scope-header__tools">
          {onToggleChat && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  id="planning-toggle-chat" aria-expanded={isChatOpen}
                  type="button"
                  variant={isChatOpen ? 'secondary' : 'ghost'}
                  size="icon"
                  onClick={onToggleChat}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={isChatOpen ? 'Cerrar asistente normativo' : 'Abrir asistente normativo'}
                >
                  <MessageSquare className="size-4" aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{isChatOpen ? 'Cerrar asistente normativo' : 'Abrir asistente normativo'}</TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                id="planning-tour-guide"
                type="button"
                variant="ghost"
                size="icon"
                onClick={onGuide}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Ver guía del sistema"
              >
                <HelpCircle className="size-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ver guía del sistema</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div id="planning-tour-proposal" className="planning-scope-header__actions">
        {proposalControls}
        <span className="planning-scope-header__divider" aria-hidden="true" />
        <span className="planning-scope-header__scope">{school} · {period}</span>
        <span className="planning-scope-header__draft-state" role="status"
          data-draft-state={draftState} data-dirty={workspaceDirty || undefined}>
          <span className="planning-scope-header__status-dot" aria-hidden="true" />
          {draftStateText}
        </span>
        {proposalActions}
        {!canSave && disabledReason && (
          <span className="planning-scope-header__disabled-reason">{disabledReason}</span>
        )}
      </div>
    </header>
  )
}
