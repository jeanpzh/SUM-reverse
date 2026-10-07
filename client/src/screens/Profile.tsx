import { useStudent, useStudentFormData } from '../data/useStudent'
import { toProfileRows } from '../data/adapters'
import type { ApiResponseMap } from '../data/contracts'
import { Icon } from '../components/Common'
import { downloadCsv } from '../data/download'

export function Profile({ response }: { response: ApiResponseMap['perfil'] }) {
  const student = useStudent()
  const alumno = useStudentFormData().data.alumno
  const personal = toProfileRows(response.data, alumno)
  return (
    <div className="profile-layout">
      <aside className="profile-summary">
        <div className="profile-avatar">
          <Icon name="user" />
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
          <button
            role="tab"
            aria-selected="true"
            aria-controls="personal-profile"
            id="personal-tab"
          >
            Información Personal
          </button>
          <button role="tab" aria-selected="false" disabled>
            Información Académica
          </button>
          <button role="tab" aria-selected="false" disabled>
            Cambio de Contraseña
          </button>
        </div>
        <article
          className="profile-panel"
          role="tabpanel"
          id="personal-profile"
          aria-labelledby="personal-tab"
        >
          <h3>Información Personal</h3>
          <dl>
            {personal.map(([label, value]) => (
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
