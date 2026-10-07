import { student } from '../data/routes'
import { PageTitle } from '../components/Common'
import { downloadFixture } from '../data/download'

type Section = { title: string; fields: string[] }
// Labels are representative fixtures where discovery retained only section names.
const sections: Section[] = [
  {
    title: 'Datos Personales',
    fields: [
      'Código de estudiante',
      'Apellidos',
      'Nombres',
      'Tipo de documento?',
      'Número de documento',
      'Fecha de nacimiento',
      'Sexo?',
      'Estado civil?',
      'País de nacimiento?',
      'Departamento?',
      'Provincia?',
      'Distrito?',
      'Nacionalidad?',
      'Dirección',
      'Referencia de domicilio',
      'Correo electrónico',
      'Teléfono',
      'Celular',
    ],
  },
  {
    title: 'Colegio de Procedencia',
    fields: [
      'Nombre del colegio',
      'Tipo de colegio?',
      'País?',
      'Departamento?',
      'Provincia?',
      'Distrito?',
      'Año de ingreso',
      'Año de egreso',
      'Modalidad de estudios?',
      'Turno?',
      'Nivel educativo?',
      'Grado de instrucción?',
      'Dirección del colegio',
      'Tipo de gestión?',
      'Lengua de enseñanza?',
    ],
  },
  {
    title: 'Dependencia Económica',
    fields: [
      'Dependencia económica?',
      'Responsable del sustento?',
      'Situación laboral?',
      'Ocupación',
      'Centro de trabajo',
      'Actividad económica?',
      'Ingreso mensual',
      'Horario de trabajo',
      'Número de dependientes',
      'Tipo de empleo?',
      'Tiene beca?',
      'Tipo de beca?',
      'Fuente de ingresos?',
      'Apoyo familiar?',
      'Otros ingresos',
    ],
  },
  {
    title: 'Recursos de Estudio',
    fields: [
      'Tiene computadora?',
      'Tipo de computadora?',
      'Acceso a internet?',
      'Tipo de conexión?',
      'Dispone de libros?',
      'Biblioteca de consulta?',
      'Lugar de estudio?',
      'Ambiente exclusivo?',
      'Horas de estudio',
      'Material de consulta?',
      'Acceso a impresora?',
      'Dispositivo móvil?',
      'Condiciones de iluminación?',
      'Recursos digitales?',
      'Otros recursos',
    ],
  },
  {
    title: 'Transporte',
    fields: [
      'Medio de transporte?',
      'Tiempo de traslado',
      'Número de viajes',
      'Costo de transporte',
      'Lugar de procedencia',
      'Ruta habitual',
      'Frecuencia de traslado?',
      'Transporte propio?',
      'Tipo de movilidad?',
      'Punto de embarque',
      'Distrito de residencia?',
      'Distancia al centro de estudios',
    ],
  },
  {
    title: 'Salud',
    fields: [
      'Tipo de seguro?',
      'Centro de atención',
      'Grupo sanguíneo?',
      'Enfermedad crónica?',
      'Discapacidad?',
      'Tratamiento médico?',
      'Alergias',
      'Medicamentos',
      'Atención médica?',
      'Antecedentes de salud',
      'Actividad física?',
      'Frecuencia de actividad?',
      'Restricción alimentaria?',
      'Observaciones',
    ],
  },
  {
    title: 'Interés Académico',
    fields: [
      'Área de interés?',
      'Motivo de elección?',
      'Especialidad de interés',
      'Expectativa académica',
      'Participa en investigación?',
      'Área de investigación',
      'Interés en idiomas?',
      'Idioma?',
      'Nivel de idioma?',
      'Actividad extracurricular?',
      'Participación académica?',
      'Disponibilidad horaria?',
      'Objetivos de estudio',
      'Otros intereses',
    ],
  },
  {
    title: 'Contacto',
    fields: [
      'Nombre del contacto',
      'Parentesco?',
      'Teléfono de contacto',
      'Celular de contacto',
      'Correo de contacto',
      'Dirección del contacto',
      'Departamento?',
      'Provincia?',
      'Distrito?',
      'Persona de emergencia',
      'Teléfono de emergencia',
      'Disponibilidad de contacto?',
    ],
  },
]
const socioeconomic: Section[] = [
  sections[0],
  sections[1],
  sections[2],
  { ...sections[7], title: 'Contacto de Emergencia' },
  sections[5],
  {
    title: 'Interés Académico y Transporte',
    fields: [...sections[6].fields, ...sections[4].fields.slice(0, 6)],
  },
  {
    title: 'Salud Familiar',
    fields: [
      'Nombre del familiar',
      'Edad',
      'Parentesco?',
      'Grado de instrucción?',
      'Ocupación',
      'Situación laboral?',
      'Aporte familiar',
      'Enfermedad?',
      'Discapacidad?',
      'Tipo de atención?',
      'Seguro de salud?',
      'Observaciones',
    ],
  },
  sections[3],
  {
    title: 'Vivienda',
    fields: [
      'Tipo de vivienda?',
      'Tenencia de vivienda?',
      'Material de paredes?',
      'Material del techo?',
      'Material del piso?',
      'Número de habitaciones',
      'Número de habitantes',
      'Servicio de agua?',
      'Servicio de desagüe?',
      'Servicio eléctrico?',
      'Acceso a internet?',
      'Ambiente de estudio?',
      'Dirección de vivienda',
      'Tiempo de residencia',
      'Servicios disponibles?',
      'Estado de la vivienda?',
    ],
  },
  {
    title: 'Situación Económica',
    fields: [
      'Ingreso familiar mensual',
      'Número de aportantes',
      'Número de dependientes',
      'Gasto en alimentación',
      'Gasto en vivienda',
      'Gasto en transporte',
      'Gasto en educación',
      'Gasto en salud',
      'Otros gastos',
      'Tipo de sustento?',
      'Apoyo económico?',
      'Tipo de apoyo?',
      'Tiene beca?',
      'Tipo de beca?',
      'Situación laboral?',
      'Observaciones',
    ],
  },
  {
    title: 'Recreación',
    fields: [
      'Actividad deportiva?',
      'Deporte?',
      'Frecuencia?',
      'Actividad cultural?',
      'Tipo de actividad?',
      'Participación artística?',
      'Área artística?',
      'Tiempo libre',
      'Actividad recreativa',
      'Participación en grupos?',
      'Voluntariado?',
      'Organización',
      'Pasatiempos',
      'Otros intereses',
    ],
  },
  {
    title: 'Aptitudes y Habilidades',
    fields: [
      'Habilidad principal',
      'Área de aptitud?',
      'Conocimiento de idiomas?',
      'Idioma?',
      'Nivel?',
      'Conocimientos informáticos?',
      'Herramientas utilizadas',
      'Actividad artística?',
      'Tipo de actividad?',
      'Habilidades sociales',
      'Intereses personales',
      'Experiencia de voluntariado',
      'Participación estudiantil?',
      'Disponibilidad?',
      'Otros conocimientos',
    ],
  },
]

function fieldValue(label: string) {
  if (label === 'Código de estudiante') return student.code
  if (label === 'Apellidos') return 'ESTUDIANTE'
  if (label === 'Nombres') return 'DEMOSTRACIÓN'
  if (label === 'Número de documento') return 'DOC-DEMO'
  if (label === 'Fecha de nacimiento') return '01/01/2000'
  return 'No registrado'
}

export function StudentForms({
  socioeconomic: isSocioeconomic = false,
}: {
  socioeconomic?: boolean
}) {
  const groups = isSocioeconomic ? socioeconomic : sections
  const title = isSocioeconomic ? 'Ficha Socioeconómica' : 'Formulario de Datos Personales'
  const exportRows = groups.flatMap((group) =>
    group.fields.map((field) => [group.title, field.replace('?', ''), fieldValue(field)]),
  )
  return (
    <>
      <PageTitle>{title}</PageTitle>
      <div className={`form-layout ${isSocioeconomic ? 'socioeconomic-forms' : 'personal-forms'}`}>
        <nav className="section-nav" aria-label="Secciones del formulario">
          {groups.map((group, i) => (
            <a key={group.title} href={`#section-${i}`}>
              {group.title}
            </a>
          ))}
          <a href="#form-download">Descargar Formulario</a>
        </nav>
        <div className="form-column">
          <section className="form-intro">
            <h3>{title}</h3>
            <p>{student.name}</p>
            <p>
              Código de estudiante: <strong>{student.code}</strong>
            </p>
            <p>Los datos del estudiante se muestran por sección.</p>
          </section>
          {groups.map((group, i) => (
            <form
              className="form-section"
              id={`section-${i}`}
              key={group.title}
              onSubmit={(event) => event.preventDefault()}
            >
              <h3>{group.title}</h3>
              <div className="form-fields">
                {group.fields.map((field, j) => {
                  const select = field.endsWith('?')
                  const label = field.replace('?', '')
                  const id = `field-${i}-${j}`
                  return (
                    <label key={id} htmlFor={id}>
                      <span>{label}</span>
                      {select ? (
                        <select id={id} disabled defaultValue="No especificado">
                          <option>No especificado</option>
                        </select>
                      ) : (
                        <input id={id} disabled value={fieldValue(label)} readOnly />
                      )}
                    </label>
                  )
                })}
              </div>
              {group.title === 'Salud Familiar' && (
                <div className="table-overflow family-table">
                  <table>
                    <thead>
                      <tr>
                        {[
                          'Nombre',
                          'Edad',
                          'Parentesco',
                          'Educación',
                          'Ocupación',
                          'Empleo',
                          'Aporte',
                          'Enfermedad',
                          'Discapacidad',
                          'Acción',
                        ].map((header) => (
                          <th key={header}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td colSpan={10}>No hay registros familiares</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              {(isSocioeconomic || i < 4) && (
                <button className="modify-button" type="button" disabled>
                  Modificar
                </button>
              )}
            </form>
          ))}
          <section className="form-download" id="form-download">
            <h3>Descargar Formulario</h3>
            <button
              className="download-button"
              onClick={() =>
                downloadFixture(
                  isSocioeconomic ? 'ficha-socioeconomica' : 'formulario-datos',
                  ['Sección', 'Campo', 'Valor'],
                  exportRows,
                )
              }
            >
              ⇩ Descargar
            </button>
          </section>
        </div>
      </div>
    </>
  )
}
