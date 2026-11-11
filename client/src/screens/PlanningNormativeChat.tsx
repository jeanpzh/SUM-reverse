import { PlanningFetchLoading } from '../components/PlanningFetchLoading'
import { useRef } from 'react'
import type { NormativeChat } from './useNormativeChat'
import { Send, Square, ArrowRight, SlidersHorizontal } from 'lucide-react'
import type { AcademicNormativeRequest } from '../../../shared/programacion-academica-api.mjs'
import type { PlanningPeriod } from '../data/academicScheduling'
import { NormativeAdvice } from '../components/ai-elements/NormativeAdvice'
import { Message, MessageContent } from '../components/ui/Message'
import { Bubble, BubbleContent } from '../components/ui/Bubble'
import { MessageScrollerProvider, MessageScroller, MessageScrollerViewport, MessageScrollerContent, MessageScrollerItem, MessageScrollerButton } from '../components/ui/MessageScroller'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from '../components/ui/InputGroup'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { NativeSelect } from '../components/ui/NativeSelect'
import { Label } from '../components/ui/Label'
import { regimeNamedIn } from '../data/normativeRegime'
import { PROTOTYPE_TEACHER_PROFILES, prototypeProfileFor } from '../../../shared/prototype-teacher-profiles.mjs'


type ExampleQuestion = {
  question: string
  teacherType: AcademicNormativeRequest['teacherType']
}

const EXAMPLE_QUESTIONS: readonly ExampleQuestion[] = [
  {
    question: '¿Cuál es la carga lectiva máxima para un docente ordinario?',
    teacherType: 'ordinario',
  },
  {
    question: '¿Cuáles son los regímenes de dedicación y sus horas mínimas?',
    teacherType: 'ordinario',
  },
  {
    question: '¿Quién aprueba la asignación de actividades lectivas?',
    teacherType: 'ordinario',
  },
  {
    question: '¿Qué casos especiales permiten superar el límite de carga lectiva?',
    teacherType: 'ordinario',
  },
] as const

export function PlanningNormativeChat({ academicPeriod, chat }: { academicPeriod: PlanningPeriod; chat: NormativeChat }) {
  const { question, setQuestion, turns, loading, asOf, teacherType, teacherId, cancel, submit } = chat
  const profile = teacherId ? prototypeProfileFor(teacherId) : null
  const regimeLabel = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const selectSuggestion = (item: ExampleQuestion) => {
    // A selected teacher profile fixes the regime; suggestions must not silently replace it.
    if (!profile) chat.changeTeacherType(item.teacherType)
    chat.setQuestion(item.question)
    void chat.submit(item.question, profile ? teacherType : item.teacherType, undefined, true)
  }

  return (
    <div className="planning-chat">
      <details className="planning-chat__context">
        <summary className="planning-chat__context-summary">
          <div className="planning-chat__context-info">
            <span className="planning-chat__context-badge">Contexto · FISI · {academicPeriod}</span>
            <span className="planning-chat__context-meta">
              {profile ? `Docente ${profile.id} · ${regimeLabel(profile.regime)} ${profile.dedication}` : teacherType === 'unknown' ? 'Filtro: Todos los regímenes' : `Filtro: Régimen ${teacherType}`}
            </span>
          </div>
          <span className="planning-chat__context-toggle">
            <SlidersHorizontal className="size-3" aria-hidden="true" />
            <span>Filtros</span>
          </span>
        </summary>
        <div className="planning-chat__filters">
          <p className="m-0 text-xs text-muted-foreground">Las preguntas de seguimiento usan tu última consulta respondida. Cambiar los filtros inicia otra conversación.</p>
          <Label className="text-xs font-medium">
            Fecha de consulta
            <Input
              type="date"
              required
              value={asOf}
              disabled={loading}
              onChange={(e) => {
                chat.changeAsOf(e.target.value)
              }}
              className="mt-1 h-8 text-xs"
            />
          </Label>
          <Label className="text-xs font-medium">
            Docente (prototipo sintético)
            <NativeSelect
              value={teacherId}
              disabled={loading}
              onChange={(e) => {
                chat.changeTeacher(e.target.value)
              }}
              className="mt-1 h-8 text-xs"
            >
              <option value="">Ninguno (elegir régimen)</option>
              {PROTOTYPE_TEACHER_PROFILES.map((item) => (
                <option key={item.id} value={item.id}>{`${item.id} · ${regimeLabel(item.regime)} ${item.dedication}`}</option>
              ))}
            </NativeSelect>
          </Label>
          {profile && (
            <p className="m-0 text-xs text-muted-foreground">
              Perfil sintético del prototipo, no oficial. Solo el régimen se envía a la consulta; la dedicación se muestra como referencia.
            </p>
          )}
          <Label className="text-xs font-medium">
            Régimen docente
            <NativeSelect
              value={teacherType}
              disabled={loading || Boolean(profile)}
              onChange={(e) => {
                chat.changeTeacherType(e.target.value as AcademicNormativeRequest['teacherType'])
              }}
              className="mt-1 h-8 text-xs"
            >
              <option value="unknown">Todos los regímenes (general)</option>
              <option value="ordinario">Ordinario</option>
              <option value="contratado">Contratado</option>
            </NativeSelect>
          </Label>
        </div>
      </details>

      <MessageScrollerProvider autoScroll>
        <MessageScroller className="planning-chat__scroller">
          <MessageScrollerViewport>
            <MessageScrollerContent className="planning-chat__messages" aria-label="Conversación normativa">
              {turns.length === 0 && (
                <div className="planning-chat__empty">
                  <div className="planning-chat__empty-header">
                    <h3 className="planning-chat__empty-title">Consulta antes de decidir</h3>
                    <p className="planning-chat__empty-desc">
                      Consulta normas de carga lectiva y decisiones docentes con fuentes verificables.
                    </p>
                  </div>
                  <div className="planning-chat__suggestions">
                    <span className="planning-chat__suggestions-label">Preguntas frecuentes</span>
                    <div className="planning-chat__suggestions-grid">
                      {EXAMPLE_QUESTIONS.map((item) => (
                        <button
                          key={item.question}
                          type="button"
                          className="planning-chat__suggestion-btn"
                          onClick={() => selectSuggestion(item)}
                        >
                          <span className="planning-chat__suggestion-text">{item.question}</span>
                          <ArrowRight className="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {turns.map((turn) => (
                <MessageScrollerItem key={turn.id} messageId={turn.id} scrollAnchor>
                  <Message align="end">
                    <MessageContent>
                      <Bubble align="end" variant="muted">
                        <BubbleContent className="text-[length:var(--planning-text-base)] font-semibold leading-snug">
                          {turn.question}
                        </BubbleContent>
                      </Bubble>
                    </MessageContent>
                  </Message>
                  <Message className="planning-chat__reply">
                    <MessageContent>
                      {turn.answer ? (
                        <div className="grid gap-2">
                          {regimeNamedIn(turn.question) && regimeNamedIn(turn.question) !== turn.answer.context.teacherType && (
                            <div role="status" className="flex flex-wrap items-center gap-2 text-sm">
                              <span className="text-muted-foreground">
                                {turn.answer.context.teacherType === 'unknown'
                                  ? `La pregunta menciona el régimen ${regimeNamedIn(turn.question)}, pero el filtro está en Todos los regímenes.`
                                  : `La pregunta menciona el régimen ${regimeNamedIn(turn.question)}, pero esta consulta usó el régimen ${turn.answer.context.teacherType}.`}
                              </span>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={loading}
                                onClick={() => void submit(turn.question, regimeNamedIn(turn.question) ?? undefined)}
                              >
                                {`Consultar como docente ${regimeNamedIn(turn.question)}`}
                              </Button>
                            </div>
                          )}
                          <NormativeAdvice advice={turn.answer} />
                        </div>
                      ) : turn.error ? (
                        <div role="alert" className="grid gap-2 text-sm text-destructive">
                          <p className="m-0 font-normal">{turn.error}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={loading}
                            onClick={() => chat.retry(turn.id)}
                          >
                            Reintentar consulta normativa
                          </Button>
                        </div>
                      ) : turn.cancelled ? (
                        <p className="m-0 text-sm font-normal text-muted-foreground">Consulta cancelada.</p>
                      ) : (
                        <PlanningFetchLoading label="Consultando fuentes normativas…" />
                      )}
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          {turns.length > 0 && (
            <MessageScrollerButton
              aria-label="Ir al final de la conversación"
              className="bottom-3 right-4 left-auto translate-x-0 shadow-md border bg-background/95 backdrop-blur-sm"
            />
          )}
        </MessageScroller>
      </MessageScrollerProvider>

      <form
        className="planning-chat__composer"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="planning-chat__composer-inner">
          <Label htmlFor="planning-chat-question" className="sr-only">
            Pregunta normativa
          </Label>
          <InputGroup>
            <InputGroupTextarea
              ref={textareaRef}
              id="planning-chat-question"
              maxLength={1000}
              rows={2}
              required
              value={question}
              placeholder="Pregunta sobre carga lectiva o normativa docente…"
              onChange={(event) => setQuestion(event.target.value)}
            />
            <InputGroupAddon align="block-end">
              <span className="planning-chat__hint">
                {question.length > 0 ? `${question.length}/1000` : ''}
              </span>
              {loading ? (
                <InputGroupButton aria-label="Cancelar consulta" onClick={(event) => {
                  // The second click of Enviar's double-click lands on this replacement.
                  if (event.detail < 2) cancel()
                }}>
                  <Square className="size-3.5" />
                  <span>Cancelar</span>
                </InputGroupButton>
              ) : (
                <InputGroupButton
                  type="submit"
                  disabled={!question.trim() || !asOf}
                  aria-label="Enviar consulta"
                >
                  <Send className="size-3.5" />
                  <span>Enviar</span>
                </InputGroupButton>
              )}
            </InputGroupAddon>
          </InputGroup>
          <p className="planning-chat__notice">Las respuestas no modifican ni aprueban propuestas.</p>
        </div>
      </form>
    </div>
  )
}
