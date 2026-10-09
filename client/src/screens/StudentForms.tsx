import { useStudent, useStudentFormData } from '../data/useStudent'
import type { ApiResponseMap } from '../data/contracts'
import { PageTitle } from '../components/Common'
import { downloadCsv } from '../data/download'
import { toProfileRows, toStudentSummary } from '../data/adapters'
import { getMiRepresentation, toFichaLocalData } from '../data/miInformacion'
import { getDataMode } from '../data/client'

type Section = { title: string; fields: string[] }
type FieldView = { id: string; label: string; value: string | null; control: string }
type SectionView = { id: string; title: string; fields: FieldView[] }
// Sanitized labels observed in the authorized read-only session. Values remain synthetic.
const sections: Section[] = [
  {
    title: 'Datos Personales',
    fields: [
      'Código de Estudiante*', 'Nombre de Estudiante*', 'Tipo de Doc. de Identidad*?',
      'Número de Doc. de Identidad*', 'Fecha de Nacimiento*@', 'Sexo*?', 'Estado Civil*?',
      'País*?', 'Departamento*?', 'Provincia*?', 'Distrito*?',
      'POR SUS COSTUMBRES Y ANTEPASADOS SE SIENTE PARTE DE:?','Pueblo Indígena?',
      'Especifique el grupo étnico:', 'HABLA ALGUNA LENGUA INDIGENA U ORIGINARIA:?', 'Lengua?',
      'Departamento*?', 'Provincia*?', 'Distrito*?', 'Dirección*', 'Teléfono Fijo*',
      'Teléfono Móvil*', 'Correo Personal*#',
    ],
  },
  {
    title: 'Colegio de Procedencia',
    fields: [
      'País*?', 'Departamento*?', 'Provincia*?', 'Distrito*?', 'Tipo de Colegio*?',
      'nombre de Colegio*', 'Pago Mensual*', 'Año de conclusión de Secundaria*?',
      'Tipo de Preparación Universitaria*?',
    ],
  },
  {
    title: 'Dependencia Económica',
    fields: [
      '¿Depende económicamente de sus padres o tutores?*?', 'Número de Hijos*',
      '¿Usted trabaja en la actualidad?*?', '¿Donde Trabaja?*', '¿Con quien vive?*?',
      'Tipo de vivienda*?',
    ],
  },
  {
    title: 'Recursos de Estudio',
    fields: [
      'Transporte*?', 'Acceso a Internet*?', 'Acceso a Bibliotecas*?', 'Alimentación*?',
      '¿Pertenece a algún programa de Becas? ¿Cúal?*?',
    ],
  },
  {
    title: 'Transporte',
    fields: [
      '¿Es residente en la vivienda universitaria?*?', 'Medio de transporte hacia la Universidad*?',
      '¿Cuánto tiempo te demoras(minutos) en llegar a la Universidad?*',
    ],
  },
  {
    title: 'Salud',
    fields: [
      '¿Sufres de alguna discapacidad física? ¿Cuál?*?',
      '¿Estás inscrito en CONADIS, tienes carnet de CONADIS?*?',
      '¿A que seguro de salud se encuentra incorporado?*?',
    ],
  },
  {
    title: 'Interés Académico',
    fields: [
      '¿Cómo se siente en la carrera?*?', '¿Qué curso fue el más difícil y por qué?*?',
      'Motivo*~', '¿Se siente motivado con la carrera?*?',
      '¿Siente que los profesores motivan a seguir estudiando?*?',
      '¿Qué área de cursos le agrada más?*~', '¿En qué área le gustaría especializarse?*~',
    ],
  },
  {
    title: 'Contacto',
    fields: [
      'Nombres y Apellidos*', 'Departamento*?', 'Provincia*?', 'Distrito*?', 'Dirección*',
      'Teléfono Fijo*', 'Teléfono Móvil*', 'Correo Personal*',
    ],
  },
]
const socioeconomic: Section[] = [
  { title: 'Datos Alumno', fields: ['Código de Estudiante', 'Nombre de Estudiante', 'Sexo', 'Identidad Étnica', 'Teléfono Fijo', 'Fecha de Nacimiento', 'País', 'Departamento', 'Provincia', 'Distrito', 'Estado Civil', 'Correo Personal', 'Tipo de Doc. de Identidad', 'Número de Doc. de Identidad', 'Teléfono Móvil', 'Religión', 'Lengua Materna', 'Cuenta de Facebook'] },
  { title: 'Colegio de Procedencia', fields: ['País?', 'Departamento?', 'Provincia?', 'Distrito?', 'Tipo de Colegio?', 'Nombre del Colegio', 'Pago Mensual', 'Año de conclusión de Secundaria?', 'Tipo de Preparación Universitaria?'] },
  { title: 'Dependencia Económica', fields: ['¿Depende económicamente de sus padres o tutores?^s', 'Número de Hijos', 'Cantidad de personas con las que vive', '¿Usted trabaja en la actualidad?^s', 'Actividad del trabajo', 'Teléfono del trabajo', 'Lugar de Trabajo'] },
  { title: 'Contacto', fields: ['Nombres y Apellidos', 'Teléfono Fijo', 'Teléfono Móvil', 'Parentesco', 'Correo Personal', 'Departamento?', 'Provincia?', 'Distrito?', 'Dirección', 'Nombre del Exterior', 'Teléfono del Exterior', 'Dirección del Exterior'] },
  { title: 'Salud', fields: ['¿A que seguro de salud se encuentra incorporado?^s', 'Especifique el tipo de seguro que tiene:~', 'Alergias~', 'Tipo de Sangre?^s', 'Discapacidad?^s', 'Especifique el tipo de discapacidad:~'] },
  { title: 'Interés Académico', fields: ['¿Cómo se siente en la carrera?^s', '¿Qué curso fue el más difícil y por qué?^s', 'Motivo~', '¿Se siente motivado con la carrera?^s', '¿Siente que los profesores motivan a seguir estudiando?^s', '¿Qué área de cursos le agrada más?~', '¿En qué área le gustaría especializarse?~'] },
  { title: 'Transporte', fields: ['¿Es residente en la vivienda universitaria?^s', 'Medio de transporte hacia la Universidad?^s', '¿Cuánto tiempo te demoras en llegar a la Universidad?(mins)'] },
  { title: 'Familia Salud', fields: [] },
  { title: 'Recursos de Estudio', fields: ['Transporte?', 'Acceso a Internet?', 'Acceso a Bibliotecas?', 'Alimentación?', '¿Pertenece a algún programa de Becas? ¿Cúal?'] },
  { title: 'Datos Vivienda', fields: ['Tenencia de la Vivienda?^s', 'Especifique su tipo de vivienda:~', 'Número de habitaciones exclusivas para dormitorios', 'SISFOH?^s', 'Tipo de Vivienda?^s', 'Especifique su tipo de vivienda:~', 'Tipo de Techo?^s', 'Especifique su tipo de techo:~', 'Tipo de Pared?^s', 'Especifique su tipo de pared:~', 'Tipo de Piso?^s', 'Especifique su tipo de piso:~', 'Abastecimiento de Agua?^s', 'Especifique su tipo de abastecimiento de agua:~', 'Tipo de Desagüe?^s', 'Especifique su tipo de desagüe:~', 'Electricidad?^s', 'Telefono?^s', 'Cable?^s', 'Internet?^s', 'Otros servicios con los que cuente~'] },
  { title: 'Situación Económica', fields: ['Ingresos del Estudiante', 'Ingresos de la Familia', 'Ingresos por Beca', 'Otros Ingresos', 'Alimentación', 'Movilidad', 'Vivienda', 'Servicio', 'Salud', 'Educacion', 'Recreación', 'Deuda', 'Otro', 'Alimentación', 'Movilidad', 'Vivienda', 'Servicio', 'Salud', 'Educacion', 'Recreación', 'Deuda', 'Otro'] },
  { title: 'Recreación', fields: ['¿Qué deportes practicas?~', '¿Qué actividades artísticas practicas?~', '¿Qué actividades sociales practicas?~', '¿En que agrupación artística, cultural, deportiva, religiosa, política, etc. participas?~'] },
  { title: 'Aptitudes y Habilidades', fields: ['Respeto^', 'Sinceridad^', 'Tolerancia^', 'Solidaridad^', 'Disciplina^', 'Creatividad^', 'Adaptación^', 'Cortesía^', 'Paciencia^', 'Aptitudes Personales:~', 'Trabajo en equipo^', 'Liderazgo^', 'Control de Estrés^', 'Capacidad Analítica^', 'Comunicación^', 'Innovación^', 'Proactiva^', 'Flexibilidad^', 'Motivación^', 'Habilidades Profesionales:~', 'Empatía^', 'Liderazgo^', 'Escucha Activa^', 'Persuasión^', 'Asertividad^', 'Positivo^', 'Habilidades Sociales:~'] },
]

export function StudentForms({
  socioeconomic: isSocioeconomic = false,
  ficha,
  profile,
}: {
  socioeconomic?: boolean
  ficha?: ApiResponseMap['fichaSocioeconomica'] | null
  profile?: ApiResponseMap['perfil'] | null
}) {
  const student = useStudent()
  const formResponse = useStudentFormData()
  const { data } = formResponse
  const formRepresentation = getMiRepresentation(formResponse)
  const candidateForm = !isSocioeconomic && formRepresentation === 'candidate-v1'
  const fichaRepresentation = ficha ? getMiRepresentation(ficha) : undefined
  const fichaData = ficha ? toFichaLocalData(ficha) : null
  if (isSocioeconomic && fichaRepresentation === 'opaque') {
    return <><PageTitle>Ficha Socioeconómica</PageTitle>
      <p className="route-status" role="status">Información aún no disponible para mostrar.</p></>
  }
  if (isSocioeconomic && getDataMode() === 'local' && !fichaData) {
    return <><PageTitle>Ficha Socioeconómica</PageTitle>
      <p className="route-status" role="status">Información aún no disponible para mostrar.</p></>
  }
  const values = Object.fromEntries(profile ? toProfileRows(profile.data, data.alumno) : [
    ['Código de estudiante', data.alumno.codAlumno],
    ['Apellidos', `${data.alumno.apePaterno} ${data.alumno.apeMaterno}`.trim()],
    ['Nombres', data.alumno.nomAlumno],
  ])
  values['Código de Estudiante'] = data.alumno.codAlumno
  values['Nombre de Estudiante'] = data.alumno.nomAlumno
  if (profile) values['Número de Doc. de Identidad'] = profile.data.numDocumento
  const formularioLocal = formRepresentation === 'local-v1' && 'secciones' in data ? data : null
  const localSections = isSocioeconomic ? fichaData?.secciones ?? null : formularioLocal?.secciones ?? null
  const displayedStudent = isSocioeconomic && fichaData ? toStudentSummary(fichaData.alumno) : student
  const knownCandidateValues: Record<string, string> = {
    'Código de Estudiante': data.alumno.codAlumno,
    'Nombre de Estudiante': data.alumno.nomAlumno,
  }
  const fieldValue = (label: string) => {
    const key = label.replace(/[?~^*]/g, '')
    if (candidateForm) return knownCandidateValues[key] ?? 'Información no disponible'
    return values[key] || 'Dato de demostración'
  }
  const completed: Record<string, boolean> = {
    'Datos Personales': data.datosPersonalesCompletado,
    'Colegio de Procedencia': data.colegioCompletado,
    'Dependencia Económica': data.dependenciaEconomicaCompletado,
    'Recursos de Estudio': data.recursosEstudioCompletado,
    Transporte: data.transporteCompletado, Salud: data.saludCompletado,
    'Interés Académico': data.interesAcademicoCompletado, Contacto: data.contactoCompletado,
  }
  const catalog = isSocioeconomic ? socioeconomic : sections
  const title = isSocioeconomic ? 'Ficha Socioeconómica' : 'Formulario de Datos Personales'
  const groups: SectionView[] = localSections
    ? localSections.map((section, sectionIndex) => ({
      id: section.id,
      title: section.titulo,
      fields: section.campos.map((field, fieldIndex) => ({
        id: field.id, label: field.etiqueta, value: field.valor,
        control: catalog[sectionIndex]?.fields[fieldIndex] ?? field.etiqueta,
      })),
    }))
    : catalog.map((section, sectionIndex) => ({
      id: `${isSocioeconomic ? 'ficha' : 'formulario'}-${sectionIndex + 1}`,
      title: section.title,
      fields: section.fields.map((field, fieldIndex) => ({
        id: `field-${sectionIndex}-${fieldIndex}`, label: field.replace(/[?~^*@#]/g, ''),
        value: null, control: field,
      })),
    }))
  const exportRows = candidateForm ? [] : localSections
    ? groups.flatMap((group) => group.fields.map((field) => [group.title,
      field.label, field.control.endsWith('^') ? ''
        : field.value === null ? (field.control.endsWith('@') ? '' : 'No registrado') : field.value]))
    : catalog.flatMap((group) => group.fields.map((field) => [group.title, field.replace('?', ''), fieldValue(field)]))
  const family = fichaData?.familiares ?? []
  return (
    <>
      <PageTitle>{title}</PageTitle>
      <div className={`form-layout ${isSocioeconomic ? 'socioeconomic-forms' : 'personal-forms'}`}>
        <nav className="section-nav" aria-label="Secciones del formulario">
            {groups.map((group, i) => (
            <a key={group.id} href={`#section-${i}`}>
              {group.title}
            </a>
          ))}
          <a href="#form-download">Descargar Formulario</a>
        </nav>
        <div className="form-column">
          <section className="form-intro">
            <h3>{title}</h3>
          <p>{displayedStudent.name}</p>
          <p>
            Código de estudiante: <strong>{displayedStudent.code}</strong>
          </p>
          {candidateForm && <p>Correo institucional: <strong>{data.alumno.correoInstitucional}</strong></p>}
          <p>{isSocioeconomic
            ? localSections ? 'Los datos se muestran por sección.' : 'Los campos de esta ficha son datos de demostración.'
            : candidateForm ? 'Hay datos del formulario que aún no se pueden mostrar.'
              : data.llenar ? 'Hay secciones pendientes de completar.' : 'Los datos se muestran por sección.'}</p>
          </section>
          {groups.map((group, i) => (
            <form
              className="form-section"
              id={`section-${i}`}
              key={group.id}
              onSubmit={(event) => event.preventDefault()}
            >
              <h3>{group.title}</h3>
              {!isSocioeconomic && group.title in completed && (
                <p className="form-completion">{completed[group.title] ? 'Completado' : 'Pendiente'}</p>
              )}
              <div className="form-fields">
                {group.fields.map((field) => {
                  const control = field.control
                  const select = control.endsWith('?')
                  const textarea = control.endsWith('~')
                  const checkbox = control.endsWith('^')
                  const explicitSelect = control.endsWith('^s')
                  const inputType = control.endsWith('@') ? 'date' : control.endsWith('#') ? 'email' : 'text'
                  const label = field.label
                  const id = field.id
                  const value = localSections
                    ? (field.value === null ? 'No registrado' : field.value)
                    : fieldValue(control.replace(/[?~^*]/g, '').replace(/s$/, explicitSelect ? '' : 's'))
                  const candidateDate = candidateForm && inputType === 'date'
                  const candidateUnavailable = candidateForm
                    && !Object.hasOwn(knownCandidateValues, label)
                  return (
                    <label key={id} htmlFor={id}>
                      <span>{label}</span>
                      {checkbox ? (
                        <input id={id} type="checkbox" disabled />
                      ) : textarea ? (
                        <textarea id={id} disabled value={value} readOnly />
                      ) : select || explicitSelect ? (
                        <select id={id} disabled value={value}>
                          <option>{value}</option>
                        </select>
                      ) : (
                        <input id={id} type={inputType} disabled={candidateForm || !(label === 'Especifique el grupo étnico:' && !isSocioeconomic)}
                          value={candidateDate ? '' : inputType === 'date' && localSections ? (field.value ?? '') : value} readOnly />
                      )}
                      {candidateUnavailable && <small>Información no disponible</small>}
                    </label>
                  )
                })}
              </div>
              {group.title === 'Familia Salud' && (
                <div className="table-overflow family-table">
                  <table>
                    <thead>
                      <tr>
                        {[
                          'Nombre',
                          'Edad',
                          'Parentesco',
                          'Grado',
                          'Ocupación',
                          'Condición Laboral',
                          'Aporte Económico(S/.)',
                          'Enfermedad',
                          'Tipo Discapacidad',
                          'Acción',
                        ].map((header) => (
                          <th key={header}>{header}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {family.map((person) => <tr key={person.id}>
                        <td>{person.nombre}</td><td>{person.edad}</td><td>{person.parentesco}</td>
                        <td>{person.grado}</td><td>{person.ocupacion}</td><td>{person.condicionLaboral}</td>
                        <td>{person.aporteEconomico}</td><td>{person.enfermedad ?? 'No registrado'}</td>
                        <td>{person.tipoDiscapacidad ?? 'No registrado'}</td><td><button type="button" disabled>Acción</button></td>
                      </tr>)}
                      {!family.length && (localSections
                        ? <tr><td colSpan={10}>No hay familiares registrados.</td></tr>
                        : <tr><td colSpan={10} /> </tr>)}
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
            {candidateForm && <p>La descarga estará disponible cuando se pueda asociar el mapa del formulario a sus campos.</p>}
            <button
              className="download-button"
              disabled={candidateForm}
              onClick={() =>
                downloadCsv(
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
