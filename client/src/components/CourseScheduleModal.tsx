import { useEffect, useRef } from 'react'
import type { ApiResponseMap } from '../data/contracts'
import { toCourseScheduleRows } from '../data/adapters'

type Course = ApiResponseMap['programacion']['data']['programacion'][number]

export function CourseScheduleModal({ course, onClose }: { course: Course | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pageOverflow = useRef<string | null>(null)

  const unlockPage = () => {
    if (pageOverflow.current === null) return
    document.documentElement.style.overflow = pageOverflow.current
    pageOverflow.current = null
  }

  const dismiss = () => {
    unlockPage()
    if (dialogRef.current?.open) dialogRef.current.close()
    onClose()
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (course && dialog && !dialog.open) {
      pageOverflow.current = document.documentElement.style.overflow
      dialog.showModal()
      document.documentElement.style.overflow = 'hidden'
    }
    return unlockPage
  }, [course])

  const rows = course ? toCourseScheduleRows(course.horarios) : []
  return (
    <dialog ref={dialogRef} className="course-schedule-dialog" aria-labelledby="course-schedule-title"
      aria-describedby="course-schedule-context" onClose={dismiss}
      onCancel={(event) => { event.preventDefault(); dismiss() }}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom) event.currentTarget.close()
      }}>
      <header className="course-schedule-dialog__header">
        <h2 id="course-schedule-title">Horarios</h2>
        <span className="sr-only" id="course-schedule-context">
          {course ? `${course.desAsignatura}, sección ${course.codSeccion}` : ''}
        </span>
        <button className="course-schedule-dialog__close" onClick={dismiss} aria-label="Cerrar horarios">×</button>
      </header>
      <div className="course-schedule-dialog__body">
        <table>
          <thead><tr><th>Horario</th><th>Día</th><th>Horas de clase</th><th>Aula</th><th>Tipo</th></tr></thead>
          <tbody>
            {rows.map((row, index) => <tr key={`${row[0]}-${index}`}>
              {row.map((cell, column) => <td key={column}>{cell}</td>)}
            </tr>)}
            {!rows.length && <tr><td colSpan={5}>No hay horarios registrados.</td></tr>}
          </tbody>
        </table>
      </div>
    </dialog>
  )
}
