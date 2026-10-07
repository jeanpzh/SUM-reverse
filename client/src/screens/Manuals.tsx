const resources = [
  ['Mi perfil', 'Guia para el usuario para verificar sus datos personales.'],
  ['Historial Academico', 'Guia para el usuario para visualizar sus calificaciones.'],
  ['Matricula Via Internet', 'Guia para el usuario para que realize su matricula via internet.'],
  [
    'Reporte de Matricula',
    'Guia para el usuario para visualizar y descargar el Reporte de Matricula.',
  ],
  [
    'Reporte de Prematricula',
    'Guia para el usuario para visualizar y descargar el Reporte de Prematricula.',
  ],
  ['Reporte de Evaluaciones', 'Guia para el usuario para el Ingreso de Evaluaciones.'],
  [
    'Programacion de Asignaturas',
    'Guia para el usuario para visualizar la informacion de las Asignaturas.',
  ],
  ['Mis Asistencias', 'Guia para el usuario para visualizar sus asistencias.'],
  ['Mis Tutorias', 'Guia para el usuario para visualizar sus tutorias.'],
]

export function Manuals() {
  return (
    <section className="manual-paper">
      <div className="tutorial-list">
        <span className="tutorial-legend">VideoTutoriales</span>
        {resources.map(([title, description]) => (
          <article
            className="tutorial-card"
            key={title}
            role="link"
            aria-disabled="true"
            tabIndex={0}
          >
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
            <div className="tutorial-meta">
              <time dateTime="2024-01-29">29/01/2024</time>
              <span>WebSUM 2.0</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
