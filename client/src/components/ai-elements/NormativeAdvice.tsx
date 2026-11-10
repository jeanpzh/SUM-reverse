import { PlanningFetchLoading } from '../PlanningFetchLoading'
import { useEffect, useId, useRef, useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/Collapsible'
import { validateAcademicNormativeResponse } from '../../../../shared/programacion-academica-api.mjs'
import type { AcademicNormativeRequest, AcademicNormativeResponse } from '../../../../shared/programacion-academica-api.mjs'
import type { PlanningPeriod } from '../../data/academicScheduling'
import { fetchAcademicNormativeAdvice } from '../../data/academicScheduling'
import { NormativeMarkdown } from './NormativeMarkdown'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { NativeSelect } from '../ui/NativeSelect'
import { Textarea } from '../ui/Textarea'
import { Alert, AlertDescription } from '../ui/Alert'
import { FileCheck2, CircleHelp, TriangleAlert } from 'lucide-react'
import { NormativeEvidence } from './NormativeEvidence'
import { NormativeDetails } from './NormativeDetails'
import './NormativeAdvice.css'

export function NormativeAdvice({ advice }: { advice: AcademicNormativeResponse }) {
  validateAcademicNormativeResponse(advice)
  const supported = advice.status === 'supported'
  const conflict = advice.status === 'conflict'
  const hasSources = advice.citations.length > 0
  const unavailable = advice.retrievalMode === 'unavailable'
  const Icon = supported ? FileCheck2 : conflict ? TriangleAlert : CircleHelp
  const title = supported ? 'Sustento documental' : conflict ? 'Fuentes en conflicto'
    : unavailable ? 'Consulta documental no disponible' : hasSources ? 'Aplicación sin confirmar' : 'Sin evidencia suficiente'
  const evidenceReason = advice.citations.some((citation) => citation.effectiveFrom === null)
    ? 'La entrada en vigencia de los extractos localizados no está confirmada.'
    : advice.citations.some((citation) => advice.context.asOf > citation.reviewedAt)
      ? 'La fecha consultada es posterior a la revisión de las fuentes localizadas.'
      : 'Los extractos localizados no bastan para confirmar la respuesta en este contexto.'
  const explanation = conflict
    ? 'Las fuentes se contradicen. Se requiere revisión documental antes de concluir.'
    : unavailable ? 'No hay una base documental disponible para esta consulta.'
    : hasSources
      ? evidenceReason
      : 'No se recuperaron fuentes aplicables a esta consulta y sus filtros.'
  const nextStep = advice.nextStep ?? (conflict ? 'Contrasta las disposiciones y sus fechas con la autoridad correspondiente.'
    : unavailable ? 'Revisa la disponibilidad del corpus o vuelve a intentar la consulta más tarde.'
    : advice.context.teacherType === 'unknown'
      ? 'Comprueba el régimen docente en el contexto de la consulta y revisa las disposiciones del periodo.'
      : advice.context.teacherType === 'contratado' && !hasSources
        ? 'Solicita la norma aplicable al régimen contratado; no traslades los límites del régimen ordinario.'
        : 'Revisa la vigencia y el alcance de las disposiciones para el periodo consultado.')

  return <section aria-label="Respuesta normativa" data-normative-status={advice.status}
    className="normative-advice [overflow-wrap:anywhere]">
    <div className="normative-advice__conclusion">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div className="min-w-0">
          <p className="normative-advice__conclusion-title">{title}</p>
          {!supported && (hasSources || unavailable) && <p className="normative-advice__summary">{explanation}</p>}
        </div>
      </div>
      <span className="normative-advice__meta">{advice.context.facultyId} · {advice.context.academicPeriod}</span>
    </div>
    {!unavailable && <div className="normative-advice__body" data-documentary-answer>
      <NormativeMarkdown>{advice.answer}</NormativeMarkdown>
    </div>}
    {!supported && <p className="normative-advice__next-step"><strong>Siguiente paso:</strong> {nextStep}</p>}
    <div className="normative-advice__disclosures">
      <NormativeEvidence citations={advice.citations} />
      <NormativeDetails advice={advice} />
    </div>
  </section>
}

// Mounted only while the advisor is open; its key also follows proposal/version/period.
export function NormativeQuestionForm({ academicPeriod, compact = false }: { academicPeriod: PlanningPeriod; compact?: boolean }) {
  const id = useId()
  const [question, setQuestion] = useState('')
  const [period, setPeriod] = useState<string>(academicPeriod)
  const [asOf, setAsOf] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [teacherType, setTeacherType] = useState<AcademicNormativeRequest['teacherType']>('unknown')
  const [answer, setAnswer] = useState<AcademicNormativeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])

  const invalidate = () => {
    pending.current?.abort()
    setAnswer(null)
    setError(null)
    setLoading(false)
  }
  const submit = async () => {
    invalidate()
    const controller = new AbortController()
    pending.current = controller
    setLoading(true)
    try {
      // The shared runtime validator checks the text field's period before transport.
      const result = await fetchAcademicNormativeAdvice({ question: question.trim(), facultyId: 'FISI', academicPeriod: period as PlanningPeriod, asOf, teacherType }, globalThis.fetch, controller.signal)
      if (!controller.signal.aborted) setAnswer(result)
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'No se pudo consultar la normativa.')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  return <section aria-label="Consulta normativa" className={`grid min-w-0 gap-3 border-0 border-t border-solid border-border pt-3 ${compact ? 'normative-question--compact' : ''}`}>
    {compact && !answer && !loading && !error && <div className="normative-question__empty"><strong>Consulta antes de decidir</strong>Pregunta sobre carga lectiva o normativa docente. Cada respuesta mostrará las fuentes disponibles y lo que no se puede determinar.</div>}
    <h4 className="m-0 text-sm font-semibold">Consultar normativa</h4>
    <form onSubmit={(event) => { event.preventDefault(); void submit() }} className="grid min-w-0 gap-3">
      <Collapsible defaultOpen={!compact}>
        {compact && <CollapsibleTrigger asChild><Button type="button" size="sm" variant="ghost">Contexto de la consulta · {period}</Button></CollapsibleTrigger>}
        <CollapsibleContent className="normative-question__filters grid min-w-0 gap-3 sm:grid-cols-2">
        <div><Label htmlFor={`${id}-faculty`}>Facultad</Label><NativeSelect id={`${id}-faculty`} value="FISI" onChange={invalidate}><option value="FISI">FISI</option></NativeSelect></div>
        <div><Label htmlFor={`${id}-period`}>Periodo académico</Label><Input id={`${id}-period`} value={period} required pattern="[0-9]{4}-(I|II)" placeholder="2027-I" onChange={(e) => { invalidate(); setPeriod(e.target.value) }} /></div>
        <div><Label htmlFor={`${id}-date`}>Fecha de consulta normativa</Label><Input id={`${id}-date`} type="date" required value={asOf} onChange={(e) => { invalidate(); setAsOf(e.target.value) }} /></div>
        <div><Label htmlFor={`${id}-type`}>Régimen docente</Label><NativeSelect id={`${id}-type`} value={teacherType} onChange={(e) => { invalidate(); setTeacherType(e.target.value as AcademicNormativeRequest['teacherType']) }}>
          <option value="unknown">Todos los regímenes (general)</option><option value="ordinario">Ordinario</option><option value="contratado">Contratado</option>
        </NativeSelect></div>
        </CollapsibleContent>
      </Collapsible>
      <div><Label htmlFor={`${id}-question`}>Pregunta normativa</Label><Textarea id={`${id}-question`} required maxLength={1000} value={question} onChange={(e) => { invalidate(); setQuestion(e.target.value) }} /></div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={loading || !question.trim()}>{error ? 'Reintentar consulta normativa' : 'Consultar fuentes'}</Button>
        {loading && <Button type="button" variant="outline" onClick={invalidate}>Cancelar consulta</Button>}
      </div>
    </form>
    <div className="normative-question__result" aria-live="polite" aria-busy={loading}>
      {loading && <PlanningFetchLoading label="Consultando fuentes normativas…" />}
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {answer && <NormativeAdvice advice={answer} />}
    </div>
  </section>
}
