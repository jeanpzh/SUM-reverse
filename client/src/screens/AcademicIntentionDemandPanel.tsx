import { useEffect, useRef, useState } from 'react'
import { academicSectionLabel, fetchAcademicPublication, fetchAcademicPublications } from '../data/academicScheduling'
import type { AcademicDemandEstimate, AcademicPublication, AcademicPublicationList } from '../../../shared/programacion-academica-api.mjs'
import { fetchIntentionDemand } from '../data/prematricula-intention'
import type { E2Demand } from '../data/prematricula-intention'
import './AcademicIntentionDemandPanel.css'

type Props = { dirty: boolean; busy: boolean; onFork: (id: string, expectedVersion: number) => void; potential: AcademicDemandEstimate | null; finalDemand: Record<string, string> }

export function AcademicIntentionDemandPanel({ dirty, busy, onFork, potential, finalDemand }: Props) {
  const [publications, setPublications] = useState<AcademicPublicationList | null>(null)
  const [publicationId, setPublicationId] = useState('')
  const [publication, setPublication] = useState<AcademicPublication | null>(null)
  const [demand, setDemand] = useState<E2Demand | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [publicationListVersion, setPublicationListVersion] = useState(0)
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
    setLoading(true); setError(''); setNotice(''); setDemand(null)
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
    if (dirty && !window.confirm('Hay cambios locales sin guardar. ¿Descartarlos y crear un nuevo borrador desde esta publicación?')) return
    setNotice('La solicitud de nuevo borrador se atiende en el panel de propuesta; revisa allí su resultado.')
    onFork(publication.id, publication.approvedVersion + 1)
  }

  return <details className="academic-intention-demand">
    <summary>Intenciones de prematrícula</summary>
    <div className="academic-intention-demand__body">
      <p>Consulta agregada local de la publicación exacta. Solo cuenta la última intención válida de cada participante sintético; no incluye borradores ni población del estimador.</p>
      <div className="academic-intention-demand__controls">
        <label>Publicación de intenciones
          <select value={publicationId} onChange={(event) => {
            queryToken.current += 1; queryController.current?.abort(); setLoading(false); setPublicationId(event.currentTarget.value); setPublication(null); setDemand(null); setError('')
          }}>
            <option value="">Seleccione una publicación</option>
            {publications?.items.map((item) => <option key={item.id} value={item.id}>Publicación {item.publicationVersion} · {item.title} · {item.id === publications.currentId ? 'Vigente' : 'Anterior'}</option>)}
          </select>
        </label>
        <button type="button" disabled={loading} onClick={() => setPublicationListVersion((value) => value + 1)}>Actualizar publicaciones</button>
        <button type="button" disabled={!publicationId || loading} onClick={() => void query()}>{loading ? 'Consultando…' : 'Consultar intenciones'}</button>
        <button type="button" disabled={!publication || busy} onClick={fork}>Crear borrador E1 de esta publicación</button>
      </div>
      {error && <p role="alert" className="academic-intention-demand__error">{error}</p>}{notice && <p role="status">{notice}</p>}
      {publication && <p className="academic-intention-demand__publication">{publication.title} · SISTEMAS · 2027-I · publicación v{publication.publicationVersion} · aprobada v{publication.approvedVersion}</p>}
      {demand && <>
        <dl className="academic-intention-demand__totals"><div><dt>Intenciones registradas</dt><dd>{demand.registeredStudents}</dd></div><div><dt>Contadas</dt><dd>{demand.countedStudents}</dd></div><div><dt>Excluidas</dt><dd>{demand.excludedStudents}</dd></div></dl>
        <div className="academic-intention-demand__table-wrap"><table><thead><tr><th>Asignatura</th><th>Potencial estimado E1</th><th>Intención registrada</th><th>Demanda final de planificación</th><th>Secciones · estudiantes/capacidad</th></tr></thead><tbody>
          {demand.courses.map((course) => <tr key={course.courseId}><td>{course.courseId} · {course.name}</td><td>{potential?.rows.find((row) => row.courseId === course.courseId)?.baseDemand ?? '—'}</td><td>{course.students}</td><td>{finalDemand[course.courseId] ?? '—'}</td><td>{course.sections.map((section) => `${academicSectionLabel(publication!.schedule, section.sectionId)}: ${section.students}/${section.capacity}`).join(' · ')}</td></tr>)}
        </tbody></table></div>
      </>}
      <p className="academic-intention-demand__distinction">El potencial estimado E1 ({potential?.source.label ?? 'sin estimación actual'}) proviene del espacio de trabajo abierto y puede referirse a otra configuración. La intención registrada y la demanda final editable de planificación son fuentes y poblaciones distintas. Estos valores no se suman ni modifican automáticamente la demanda final.</p>
    </div>
  </details>
}
