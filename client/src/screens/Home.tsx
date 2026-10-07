import { Link } from '@tanstack/react-router'
import { student, routeUrl, type ScreenId } from '../data/routes'
import { StudentSummary, Icon } from '../components/Common'

const shortcuts: { id: ScreenId; category: string; title: string; items: string[] }[] = [
  {
    id: 'perfil',
    category: 'Mi Información',
    title: 'Mi Perfil',
    items: ['Información personal del estudiante', 'Información académica', 'Descargar perfil'],
  },
  {
    id: 'historial',
    category: 'Mi Información',
    title: 'Historial Académico',
    items: [
      'Resumen del historial académico',
      'Promedio ponderado',
      'Calificaciones de las asignaturas',
    ],
  },
  {
    id: 'matricula-informacion',
    category: 'Matrícula',
    title: 'Información de Matrícula',
    items: [
      'Cronograma de matrícula',
      'Información del proceso de matrícula',
      'Controles de acceso y requisitos',
    ],
  },
  {
    id: 'programacion-asignaturas',
    category: 'Matrícula',
    title: 'Programación de Asignaturas',
    items: [
      'Asignaturas programadas',
      'Secciones y docentes',
      'Horarios disponibles',
      'Número de matriculados',
    ],
  },
  {
    id: 'reportes-prematricula',
    category: 'Reportes',
    title: 'Reporte de Prematricula',
    items: ['Asignaturas de prematrícula', 'Créditos y ciclo', 'Descargar reporte'],
  },
  {
    id: 'reportes-matricula',
    category: 'Reportes',
    title: 'Reporte de Matricula',
    items: ['Asignaturas matriculadas', 'Secciones y docentes asignados', 'Descargar reporte'],
  },
  {
    id: 'reportes-deudas',
    category: 'Reportes',
    title: 'Reporte de Deudas',
    items: ['Conceptos registrados', 'Información de montos', 'Observaciones'],
  },
  {
    id: 'plan-estudios',
    category: 'Información Académica',
    title: 'Plan de Estudios',
    items: ['Asignaturas del plan', 'Créditos y prerrequisitos', 'Descargar plan de estudios'],
  },
]

export function Home() {
  return (
    <>
      <section className="home-overview">
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
      <div className="shortcut-stack">
        {shortcuts.map((card) => (
          <div className="shortcut-slot" key={card.id}>
            <section className="shortcut-card">
              <span className="shortcut-category">{card.category}</span>
              <h2>{card.title}</h2>
              <ul>
                {card.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <Link className="more-button" to={routeUrl(card.id)}>
                Ver más...
              </Link>
            </section>
          </div>
        ))}
      </div>
    </>
  )
}
