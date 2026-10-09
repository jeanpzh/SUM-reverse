import { useStudent } from '../data/useStudent'
import { toProfileAcademicRows } from '../data/adapters'
import type { ApiResponseMap } from '../data/contracts'
import { downloadCsv } from '../data/download'
import { getMiRepresentation } from '../data/miInformacion'
import { useStudentFormData } from '../data/useStudent'
import type { MiInformacionRepresentation } from '../../../shared/mi-informacion-wire.mjs'
import { StudentPhoto } from '../components/StudentPhoto'

export function Profile({ response, local = false, representation }: {
  response: ApiResponseMap['perfil']
  local?: boolean
  representation?: MiInformacionRepresentation
}) {
  const [activePanel, setActivePanel] = useState<'personal' | 'academic' | 'password'>('personal')
  const student = useStudent()
  const formulario = useStudentFormData()
  const alumno = formulario?.data.alumno
  const studentName = [alumno?.apePaterno, alumno?.apeMaterno, alumno?.nomAlumno]
    .filter(Boolean)
    .join(' ')
  const viewRepresentation = representation ?? getMiRepresentation(response)
  const hasCandidateData = viewRepresentation === 'candidate-v1' || viewRepresentation === 'local-v1'
  const personal: [string, string][] = [
    ['Documento de Identidad', `${response.data.tipoDocumento} ${response.data.numDocumento}`.trim()],
    ['Estado Civil', response.data.estadoCivil || 'No registrado'],
    ['Sexo', response.data.desSexo || 'No registrado'],
    ['Fecha de Nacimiento', response.data.fechaNacimiento || 'No registrado'],
    ['Lugar de Nacimiento', [response.data.departamentoNac, response.data.provinciaNac, response.data.distritoNac].filter(Boolean).join(' / ') || 'No registrado'],
    ['Teléfono', response.data.telefono || 'No registrado'],
    ['Celular', response.data.celular || 'No registrado'],
    ['Correo Institucional', response.data.correoInstitucional || 'No registrado'],
    ['Correo Personal', response.data.correoPersonal || 'No registrado'],
    ['Dirección', response.data.direccion || 'No registrado'],
  ]
  if (hasCandidateData || local) personal.splice(9, 0, ['Domicilio',
    [response.data.departamentoDir, response.data.provinciaDir, response.data.distritoDir].filter(Boolean).join(' / ') || 'No registrado'])
  const academic = hasCandidateData || local
    ? toProfileAcademicRows(response.data)
    : ['Año de Ingreso', 'Modalidad de Ingreso', 'Colegio de Procedencia', 'Año / Ciclo de Estudio',
      'Promedio Ponderado', 'Situación Académica', 'Estado de Permanencia', 'Última Matricula',
      'Promedio de Última Matricula'].map((label) => [label, 'No registrado'] as [string, string])
  return (
    <div className="profile-layout">
      <aside className="profile-summary">
        <div className="profile-avatar">
          <StudentPhoto
            photo={alumno?.foto}
            alt={studentName ? `Foto de ${studentName}` : 'Foto del estudiante'}
          />
        </div>
        <h2>{student.name}</h2>
        <p>{student.code}</p>
        <span className="role-label">ALUMNO</span>
        <hr />
        <p>{student.faculty}</p>
        <p>{student.program}</p>
        <button
          className="download-button"
          onClick={() => downloadCsv('perfil', ['Dato', 'Valor'], personal)}
        >
          ⇩ Descargar Perfil
        </button>
      </aside>
      <div className="profile-detail">
        <div className="profile-tabs" role="tablist" aria-label="Información del perfil">
          <button type="button" role="tab" aria-selected={activePanel === 'personal'} onClick={() => setActivePanel('personal')}>
            Información Personal
          </button>
          <button type="button" role="tab" aria-selected={activePanel === 'academic'} onClick={() => setActivePanel('academic')}>
            Información Académica
          </button>
          <button type="button" role="tab" aria-selected={activePanel === 'password'} disabled>
            Cambio de Contraseña
          </button>
        </div>
        <article className="profile-panel">
          <h3>{activePanel === 'academic' ? 'Información Académica' : 'Información Personal'}</h3>
          <dl>
            {(activePanel === 'academic'
              ? academic
              : personal).map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </article>
      </div>
    </div>
  )
}
import { useState } from 'react'
