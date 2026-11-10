import { PlanningFetchLoading } from '../PlanningFetchLoading'
import { useEffect, useId, useRef, useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/Collapsible'
import { validateAcademicNormativeResponse } from '../../../../shared/programacion-academica-api.mjs'
import type { AcademicNormativeRequest, AcademicNormativeResponse } from '../../../../shared/programacion-academica-api.mjs'
import type { PlanningPeriod } from '../../data/academicScheduling'
import { fetchAcademicNormativeAdvice } from '../../data/academicScheduling'
import { NormativeMarkdown } from './NormativeMarkdown'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { NativeSelect } from '../ui/NativeSelect'
import { Textarea } from '../ui/Textarea'
import { Alert, AlertDescription } from '../ui/Alert'
import { ChevronDown, ExternalLink, FileText, AlertTriangle } from 'lucide-react'
import './NormativeAdvice.css'

const statusLabels: Record<string, string> = {
  supported: 'Sustento documental',
  'not-determined': 'No determinado',
  conflict: 'Conflicto documental',
}

const statusTitles: Record<string, string> = {
  supported: 'Sustento documental identificado para la consulta',
  'not-determined': 'No es posible determinar con la evidencia documental disponible',
  conflict: 'Conflicto normativo entre las fuentes recuperadas',
}

const modeLabels: Record<string, string> = {
  hybrid: 'Híbrida (léxica + semántica)',
  'lexical-only': 'Solo léxica',
  unavailable: 'No disponible',
}

const generationReasons: Record<string, string> = {
  not_configured: 'Proveedor no configurado.',
  timeout: 'El proveedor superó el tiempo de espera.',
  upstream_error: 'El proveedor no está disponible.',
  invalid_llm_output: 'La respuesta del modelo no pasó la validación.',
  insufficient_evidence: 'Se conserva la abstención porque la evidencia es insuficiente.',
  disabled: 'Generación con modelo desactivada en este entorno.',
}

export function NormativeAdvice({ advice }: { advice: AcademicNormativeResponse }) {
  validateAcademicNormativeResponse(advice)

  const isSupported = advice.status === 'supported'
  const isNotDetermined = advice.status === 'not-determined'

  return (
    <section
      aria-label="Respuesta normativa"
      className="normative-advice [overflow-wrap:anywhere]"
    >
      {/* 1. Conclusión (14px / 500) */}
      <div className="normative-advice__conclusion">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={isSupported ? 'secondary' : isNotDetermined ? 'warning' : 'destructive'}
            className="normative-advice__status-badge"
          >
            {statusLabels[advice.status]}
          </Badge>
          <span className="normative-advice__meta">
            {advice.context.facultyId} · {advice.context.academicPeriod} · {advice.citations.length}{' '}
            {advice.citations.length === 1 ? 'fuente recuperada' : 'fuentes recuperadas'}
          </span>
        </div>
        <p className="normative-advice__conclusion-title">
          {statusTitles[advice.status]}
        </p>
      </div>

      {/* 2. Explicación / Cuerpo (14px / 400, line-height 1.6) */}
      <div className="normative-advice__body">
        <NormativeMarkdown>{advice.answer}</NormativeMarkdown>
      </div>

      {/* 3. Evidencia / Fuentes normativas */}
      <div className="normative-advice__section">
        <h5 className="normative-advice__subtitle flex items-center gap-1.5">
          <FileText className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span>Fuentes normativas</span>
        </h5>
        {advice.citations.length === 0 ? (
          <p className="normative-advice__meta m-0">
            Sin fuentes normativas aplicables recuperadas para este criterio.
          </p>
        ) : (
          <ol className="normative-advice__citations-list m-0 p-0 list-none">
            {advice.citations.map((citation) => (
              <li key={citation.id} className="normative-advice__citation-card">
                <a
                  href={citation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                  className="normative-advice__citation-link inline-flex items-center gap-1.5"
                >
                  <span>
                    {citation.title} · {citation.article} (pág. {citation.page})
                  </span>
                  <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden="true" />
                </a>
                <p className="normative-advice__citation-excerpt m-0">
                  «{citation.excerpt}»
                </p>
                <div className="normative-advice__meta">
                  Ámbito {citation.scope} · Revisado el {citation.reviewedAt}
                  {citation.effectiveFrom &&
                    ` · Vigencia: ${citation.effectiveFrom} a ${citation.effectiveTo ?? 'vigente'}`}
                  {advice.context.asOf > citation.reviewedAt &&
                    ' · Fecha de consulta posterior a revisión'}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* 4. ¿Qué falta verificar? / Limitaciones (13px / 600 subtítulo, 14px / 400 lista) */}
      {advice.gaps.length > 0 && (
        <div className="normative-advice__section">
          <h5 className="normative-advice__subtitle flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>¿Qué falta verificar?</span>
          </h5>
          <ul className="normative-advice__list">
            {advice.gaps.map((gap, i) => (
              <li key={i}>{gap}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 5. Detalles técnicos de la consulta (Relegado a nivel secundario, colapsable) */}
      <Collapsible className="normative-advice__details">
        <CollapsibleTrigger className="normative-advice__details-trigger group flex w-full items-center justify-between text-left">
          <span>Detalles técnicos de la consulta</span>
          <ChevronDown
            className="size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="normative-advice__details-content">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-xs font-normal">
              Recuperación: {modeLabels[advice.retrievalMode] ?? advice.retrievalMode}
            </Badge>
            {advice.generation && (
              <Badge variant="outline" className="text-xs font-normal">
                Generación:{' '}
                {advice.generation.mode === 'llm-assisted'
                  ? advice.generation.providerLabel ?? 'IA asistida'
                  : 'extractiva'}
              </Badge>
            )}
          </div>
          {advice.generation?.fallbackReason && (
            <p className="m-0 text-xs text-muted-foreground">
              {generationReasons[advice.generation.fallbackReason] ??
                advice.generation.fallbackReason}
            </p>
          )}
          <div className="grid gap-1 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-foreground/80">Filtro de régimen docente:</span>{' '}
              {advice.context.teacherType === 'unknown'
                ? 'Todos los regímenes (general)'
                : advice.context.teacherType}
            </div>
            <div>
              <span className="font-medium text-foreground/80">Régimen verificado en fuentes:</span>{' '}
              {advice.context.teacherType === 'unknown'
                ? 'No delimitado en la documentación recuperada'
                : `Específico (${advice.context.teacherType})`}
            </div>
            <div>
              <span className="font-medium text-foreground/80">Fecha consultada:</span>{' '}
              {advice.context.asOf}
            </div>
            <div>
              <span className="font-medium text-foreground/80">Ámbito institucional:</span>{' '}
              Facultad de Ingeniería de Sistemas e Informática (FISI) · {advice.context.academicPeriod}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  )
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
