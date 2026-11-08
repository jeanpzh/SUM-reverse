import { useEffect, useRef, useState } from 'react'
import { toast } from '../components/ui/Sonner'
import { Button } from '../components/ui/Button'
import { NativeSelect } from '../components/ui/NativeSelect'
import { Label } from '../components/ui/Label'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../components/ui/Collapsible'
import { Alert } from '../components/ui/Alert'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../components/ui/Table'
import { academicSectionLabel, fetchAcademicPublication, fetchAcademicPublications } from '../data/academicScheduling'
import type { AcademicDemandEstimate, AcademicPublication, AcademicPublicationList } from '../../../shared/programacion-academica-api.mjs'
import { fetchIntentionDemand } from '../data/prematricula-intention'
import type { E2Demand } from '../data/prematricula-intention'
import { ConfirmDialog, type ConfirmRequest } from '../components/ui/ConfirmDialog'
import './AcademicIntentionDemandPanel.css'

type Props = { dirty: boolean; busy: boolean; onFork: (id: string, expectedVersion: number) => void; potential: AcademicDemandEstimate | null; finalDemand: Record<string, string> }

export function AcademicIntentionDemandPanel({ dirty, busy, onFork, potential, finalDemand }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [publications, setPublications] = useState<AcademicPublicationList | null>(null)
  const [publicationId, setPublicationId] = useState('')
  const [publication, setPublication] = useState<AcademicPublication | null>(null)
  const [demand, setDemand] = useState<E2Demand | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [publicationListVersion, setPublicationListVersion] = useState(0)
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null)
  const queryToken = useRef(0)
  const queryController = useRef<AbortController | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void fetchAcademicPublications(fetch, controller.signal).then((value) => {
      setPublications(value)
      setPublicationId((current) => current && value.items.some((item) => item.id === current) ? current : value.currentId ?? value.items[0]?.id ?? '')
    }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'No se pudieron consultar las publicaciones locales.') })
    return () => { controller.abort(); queryController.current?.abort() }
  }, [publicationListVersion])

  const query = async () => {
    const selected = publications?.items.find((item) => item.id === publicationId)
    if (!selected) return
    queryController.current?.abort()
    const controller = new AbortController()
    queryController.current = controller
    const currentToken = ++queryToken.current
    setLoading(true); setError(''); setDemand(null)
    try {
      const exactPublication = await fetchAcademicPublication(selected.id, fetch, controller.signal)
      if (exactPublication.publicationVersion !== selected.publicationVersion || exactPublication.approvedVersion !== selected.approvedVersion) throw new Error('La publicación consultada cambió desde el listado.')
      const result = await fetchIntentionDemand({ publicationId: exactPublication.id, publicationVersion: exactPublication.publicationVersion }, fetch, controller.signal)
      if (currentToken === queryToken.current && selected.id === publicationId) { setPublication(exactPublication); setDemand(result) }
    } catch (cause) { if (!controller.signal.aborted && currentToken === queryToken.current) setError(cause instanceof Error ? cause.message : 'No se pudo consultar la demanda agregada.') }
    finally { if (!controller.signal.aborted && currentToken === queryToken.current) setLoading(false) }
  }

  const fork = () => {
    if (!publication) return
    const source = publication
    setConfirmRequest({
      title: 'Crear borrador E1',
      description: dirty
        ? 'Hay cambios locales sin guardar. ¿Descartarlos y crear un nuevo borrador desde esta publicación?'
        : `¿Crear un nuevo borrador desde «${source.title}»? La publicación permanecerá sin cambios.`,
      confirmLabel: 'Crear borrador',
      destructive: dirty,
      onConfirm: () => {
        toast.success('La solicitud de nuevo borrador se atiende en el panel de propuesta; revisa allí su resultado.')
        onFork(source.id, source.approvedVersion + 1)
      },
    })
  }

  // Keep native details/summary for verification selectors; Radix owns disclosure state.
  return <Collapsible asChild open={expanded} onOpenChange={setExpanded}>
    <details className="academic-intention-demand" open={expanded}>
      <CollapsibleTrigger asChild>
        <summary onClick={(event) => { event.preventDefault(); setExpanded((value) => !value) }}>Intenciones de prematrícula</summary>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="academic-intention-demand__body">
          <div className="academic-intention-demand__controls">
            <div className="academic-intention-demand__field"><Label htmlFor="academic-intention-publication">Publicación de intenciones</Label>
              <NativeSelect id="academic-intention-publication" value={publicationId} onChange={(event) => {
                queryToken.current += 1; queryController.current?.abort(); setLoading(false); setPublicationId(event.currentTarget.value); setPublication(null); setDemand(null); setError('')
              }}>
                <option value="">Seleccione una publicación</option>
                {publications?.items.map((item) => <option key={item.id} value={item.id}>Publicación {item.publicationVersion} · {item.title} · {item.id === publications.currentId ? 'Vigente' : 'Anterior'}</option>)}
              </NativeSelect>
            </div>
            <Button variant="outline" type="button" disabled={loading} onClick={() => setPublicationListVersion((value) => value + 1)}>Actualizar publicaciones</Button>
            <Button variant="outline" type="button" disabled={!publicationId || loading} onClick={() => void query()}>{loading ? 'Consultando…' : 'Consultar intenciones'}</Button>
            <Button variant="outline" type="button" disabled={!publication || busy} onClick={fork}>Crear borrador E1 de esta publicación</Button>
          </div>
          {error && <Alert variant="destructive" role="alert">{error}</Alert>}
          {publication && <p className="academic-intention-demand__publication">{publication.title} · SISTEMAS · 2027-I · publicación v{publication.publicationVersion} · aprobada v{publication.approvedVersion}</p>}
          {demand && <>
            <dl className="academic-intention-demand__totals"><div><dt>Intenciones registradas</dt><dd>{demand.registeredStudents}</dd></div><div><dt>Contadas</dt><dd>{demand.countedStudents}</dd></div><div><dt>Excluidas</dt><dd>{demand.excludedStudents}</dd></div></dl>
            <div className="academic-intention-demand__table-wrap"><Table stickyHeader><TableHeader><TableRow><TableHead>Asignatura</TableHead><TableHead>Potencial estimado E1</TableHead><TableHead>Intención registrada</TableHead><TableHead>Demanda final de planificación</TableHead><TableHead>Secciones · estudiantes/capacidad</TableHead></TableRow></TableHeader><TableBody>
              {demand.courses.map((course) => <TableRow key={course.courseId}><TableCell>{course.courseId} · {course.name}</TableCell><TableCell>{potential?.rows.find((row) => row.courseId === course.courseId)?.baseDemand ?? '—'}</TableCell><TableCell>{course.students}</TableCell><TableCell>{finalDemand[course.courseId] ?? '—'}</TableCell><TableCell>{course.sections.map((section) => `${academicSectionLabel(publication!.schedule, section.sectionId)}: ${section.students}/${section.capacity}`).join(' · ')}</TableCell></TableRow>)}
            </TableBody></Table></div>
          </>}
          <Collapsible>
            <CollapsibleTrigger asChild><Button variant="ghost" type="button">Cómo se calcula la demanda</Button></CollapsibleTrigger>
            <CollapsibleContent>
              <p>Consulta agregada local de la publicación exacta. Solo cuenta la última intención válida de cada participante sintético; no incluye borradores ni población del estimador.</p>
              <p className="academic-intention-demand__distinction">El potencial estimado E1 ({potential?.source.label ?? 'sin estimación actual'}) proviene del espacio de trabajo abierto y puede referirse a otra configuración. La intención registrada y la demanda final editable de planificación son fuentes y poblaciones distintas. Estos valores no se suman ni modifican automáticamente la demanda final.</p>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
      </CollapsibleContent>
    </details>
  </Collapsible>
}
