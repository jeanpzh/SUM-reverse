import { Link } from '@tanstack/react-router'
import { student, routeUrl, type ScreenId } from '../data/routes'
import { StudentSummary, Icon } from '../components/Common'

const shortcuts: {
  id: ScreenId
  category: string
  title: string
  description: string
  featured?: boolean
}[] = [
  {
    id: 'perfil',
    category: 'Mi Información',
    title: 'Mi Perfil',
    description: 'Consulta tus datos personales y académicos, y descarga tu perfil.',
    featured: true,
  },
  {
    id: 'historial',
    category: 'Mi Información',
    title: 'Historial Académico',
    description: 'Revisa asignaturas, calificaciones y promedio ponderado.',
  },
  {
    id: 'matricula-informacion',
    category: 'Matrícula',
    title: 'Información de Matrícula',
    description: 'Consulta el cronograma, los requisitos y las etapas del proceso.',
  },
  {
    id: 'programacion-asignaturas',
    category: 'Matrícula',
    title: 'Programación de Asignaturas',
    description: 'Explora cursos, secciones, docentes, horarios y número de matriculados.',
    featured: true,
  },
  {
    id: 'reportes-prematricula',
    category: 'Reportes',
    title: 'Reporte de Prematricula',
    description: 'Revisa tus asignaturas, créditos y ciclo de prematrícula.',
  },
  {
    id: 'reportes-matricula',
    category: 'Reportes',
    title: 'Reporte de Matricula',
    description: 'Consulta asignaturas matriculadas, secciones y docentes asignados.',
  },
  {
    id: 'reportes-deudas',
    category: 'Reportes',
    title: 'Reporte de Deudas',
    description: 'Consulta conceptos, montos registrados y observaciones.',
  },
  {
    id: 'plan-estudios',
    category: 'Información Académica',
    title: 'Plan de Estudios',
    description: 'Revisa las asignaturas, créditos y prerrequisitos de tu plan.',
  },
]

export function Home() {
  return (
    <>
      <section className="home-overview" aria-label="Resumen del estudiante">
        <div className="home-student">
          <div className="student-avatar">
            <Icon name="user" />
          </div>
          <div>
            <h1>{student.name}</h1>
            <span className="role-label">ALUMNO</span>
            <p>Código: {student.code}</p>
          </div>
        </div>
        <StudentSummary />
      </section>
      <section className="shortcut-grid" aria-label="Accesos principales">
        {shortcuts.map((card) => (
          <div
            className={`shortcut-slot${card.featured ? ' shortcut-slot-featured' : ''}`}
            key={card.id}
          >
            <article className="shortcut-card">
              <span className="shortcut-category">{card.category}</span>
              <h2>{card.title}</h2>
              <p>{card.description}</p>
              <Link className="more-button" to={routeUrl(card.id)}>
                Ver más...
              </Link>
            </article>
          </div>
        ))}
      </section>
    </>
  )
}
