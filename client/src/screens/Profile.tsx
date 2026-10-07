import { student } from '../data/routes'
import { Icon } from '../components/Common'
import { downloadFixture } from '../data/download'

const personal = [
  ['Código de estudiante', student.code],
  ['Apellidos', 'ESTUDIANTE'],
  ['Nombres', 'DEMOSTRACIÓN'],
  ['Tipo de documento', 'Documento de demostración'],
  ['Número de documento', 'DOC-DEMO'],
  ['Fecha de nacimiento', '01/01/2000'],
  ['Sexo', 'No especificado'],
  ['Estado civil', 'No especificado'],
  ['Lugar de nacimiento', 'Lima'],
  ['Dirección', 'Dirección de demostración'],
  ['Correo electrónico', 'No registrado'],
  ['Teléfono', 'No registrado'],
]

export function Profile() {
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
          onClick={() => downloadFixture('perfil', ['Dato', 'Valor'], personal)}
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
