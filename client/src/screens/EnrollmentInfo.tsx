import { PageTitle } from '../components/Common'

const sections = [
  [
    'Control de Cronograma de Matrícula',
    'El acceso al módulo de matrícula se realiza dentro de las fechas establecidas en el cronograma académico. Consulte el periodo de matrícula correspondiente a su facultad.',
  ],
  [
    'Control de Acceso de Facultad',
    'La facultad habilita el acceso al proceso de matrícula según su programación y los requisitos académicos correspondientes.',
  ],
  [
    'Control de Pre-Matrícula',
    'La prematrícula permite consultar las asignaturas disponibles de acuerdo con el plan de estudios y los requisitos del estudiante.',
  ],
  [
    'Control de Deudas Registradas',
    'Las deudas registradas pueden afectar el acceso al proceso de matrícula. Revise su reporte de deudas y las indicaciones de su facultad.',
  ],
  [
    'Interfaz de Matrícula',
    'El módulo presenta las asignaturas, secciones y horarios programados para el periodo académico. Revise esta información antes de realizar su matrícula.',
  ],
]

export function EnrollmentInfo() {
  return (
    <>
      <PageTitle>Información de Matrícula</PageTitle>
      <article className="enrollment-article">
        <h3>Módulo de Matrícula Vía Internet</h3>
        {sections.map(([title, text], index) => (
          <section key={title}>
            <h4>
              {index + 1}. {title}
            </h4>
            <p>{text}</p>
          </section>
        ))}
      </article>
    </>
  )
}
