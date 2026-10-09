import type { ReactNode } from 'react'
import { useStudent } from '../data/useStudent'
import { downloadCsv } from '../data/download'
import type { StudentSummaryData } from '../data/adapters'

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <article className="page-title">
      <h2>{children}</h2>
    </article>
  )
}

export function StudentSummary({ student: override }: { student?: StudentSummaryData }) {
  const shellStudent = useStudent()
  const student = override ?? shellStudent
  return (
    <fieldset className="student-summary">
      <legend>Datos del Estudiante</legend>
      <div className="summary-row">
        <div>
          <span>Periodo Académico</span>
          <strong>{student.period}</strong>
        </div>
      </div>
      <div className="summary-row">
        <div>
          <span>Facultad</span>
          <strong>{student.faculty}</strong>
        </div>
        <div>
          <span>Programa</span>
          <strong>{student.program}</strong>
        </div>
      </div>
      <div className="summary-row">
        <div>
          <span>Especialidad</span>
          <strong>{student.specialty}</strong>
        </div>
        <div>
          <span>Plan de Estudios</span>
          <strong>{student.plan}</strong>
        </div>
      </div>
    </fieldset>
  )
}

export function DownloadButton({
  name,
  headers = [],
  rows = [],
}: {
  name: string
  headers?: string[]
  rows?: string[][]
}) {
  return (
    <button className="download-button" onClick={() => downloadCsv(name, headers, rows)}>
      <span aria-hidden="true">⇩</span> Descargar
    </button>
  )
}

export function DataTable({
  headers,
  rows,
  empty,
  footer = true,
  className = '',
}: {
  headers: string[]
  rows: ReactNode[][]
  empty?: string
  footer?: boolean
  className?: string
}) {
  return (
    <div className={`table-card ${className}`}>
      <div className="table-overflow">
        <table>
          <thead>
            <tr>
              {headers.map((header, index) => (
                <th key={`${header}-${index}`}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, column) => (
                    <td key={column}>{cell}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty-cell" colSpan={headers.length}>
                  {empty ?? 'No hay registros'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {footer && <p className="table-footer">Mostrando {rows.length} registros</p>}
    </div>
  )
}

export function Icon({ name }: { name: string }) {
  const paths: Record<string, ReactNode> = {
    home: <path d="M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10" />,
    user: (
      <>
        <circle cx="12" cy="7" r="4" />
        <path d="M4 22v-3a8 8 0 0 1 16 0v3M17 10l5 4-5 4" />
      </>
    ),
    edit: (
      <>
        <circle cx="9" cy="6" r="4" />
        <path d="M2 20v-3a7 7 0 0 1 10-6M14 20l2-7 5-5 3 3-5 5-5 4Z" />
      </>
    ),
    file: <path d="M5 2h10l5 5v15H5ZM14 2v6h6M8 12h9M8 16h9" />,
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="17" rx="2" />
        <path d="M7 2v6M17 2v6M3 11h18m-12 5 3 3 5-6" />
      </>
    ),
    tutor: (
      <>
        <rect x="9" y="2" width="13" height="12" rx="1" />
        <circle cx="5" cy="10" r="3" />
        <path d="M1 22v-5h9v5M12 18h10M15 14v4" />
      </>
    ),
    book: <path d="M5 3h15v18H5a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3ZM5 3v18M9 7h7M9 11h7" />,
    video: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="4" />
        <path d="m10 9 6 3-6 3Z" />
      </>
    ),
  }
  return (
    <svg
      className="nav-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] ?? paths.file}
    </svg>
  )
}
