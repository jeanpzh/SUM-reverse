import type { AlumnoFixture } from '../reportes/reportes.types.js'
import type { SeccionInformacion } from './mi-informacion.types.js'

type CatalogSection = { title: string; labels: string[] }

// Catálogos extraídos offline de StudentForms.tsx. Los caracteres finales * ? @ # ~ ^
// son marcadores de control; se conservan los signos de pregunta propios del rótulo.
const formSections: CatalogSection[] = [
  { title: 'Datos Personales', labels: [
    'Código de Estudiante*', 'Nombre de Estudiante*', 'Tipo de Doc. de Identidad*?',
    'Número de Doc. de Identidad*', 'Fecha de Nacimiento*@', 'Sexo*?', 'Estado Civil*?',
    'País*?', 'Departamento*?', 'Provincia*?', 'Distrito*?',
    'POR SUS COSTUMBRES Y ANTEPASADOS SE SIENTE PARTE DE:?', 'Pueblo Indígena?',
    'Especifique el grupo étnico:', 'HABLA ALGUNA LENGUA INDIGENA U ORIGINARIA:?', 'Lengua?',
    'Departamento*?', 'Provincia*?', 'Distrito*?', 'Dirección*', 'Teléfono Fijo*',
    'Teléfono Móvil*', 'Correo Personal*#',
  ] },
  { title: 'Colegio de Procedencia', labels: [
    'País*?', 'Departamento*?', 'Provincia*?', 'Distrito*?', 'Tipo de Colegio*?',
    'nombre de Colegio*', 'Pago Mensual*', 'Año de conclusión de Secundaria*?',
    'Tipo de Preparación Universitaria*?',
  ] },
  { title: 'Dependencia Económica', labels: [
    '¿Depende económicamente de sus padres o tutores?*?', 'Número de Hijos*',
    '¿Usted trabaja en la actualidad?*?', '¿Donde Trabaja?*', '¿Con quien vive?*?',
    'Tipo de vivienda*?',
  ] },
  { title: 'Recursos de Estudio', labels: [
    'Transporte*?', 'Acceso a Internet*?', 'Acceso a Bibliotecas*?', 'Alimentación*?',
    '¿Pertenece a algún programa de Becas? ¿Cúal?*?',
  ] },
  { title: 'Transporte', labels: [
    '¿Es residente en la vivienda universitaria?*?', 'Medio de transporte hacia la Universidad*?',
    '¿Cuánto tiempo te demoras(minutos) en llegar a la Universidad?*',
  ] },
  { title: 'Salud', labels: [
    '¿Sufres de alguna discapacidad física? ¿Cuál?*?',
    '¿Estás inscrito en CONADIS, tienes carnet de CONADIS?*?',
    '¿A que seguro de salud se encuentra incorporado?*?',
  ] },
  { title: 'Interés Académico', labels: [
    '¿Cómo se siente en la carrera?*?', '¿Qué curso fue el más difícil y por qué?*?',
    'Motivo*~', '¿Se siente motivado con la carrera?*?',
    '¿Siente que los profesores motivan a seguir estudiando?*?',
    '¿Qué área de cursos le agrada más?*~', '¿En qué área le gustaría especializarse?*~',
  ] },
  { title: 'Contacto', labels: [
    'Nombres y Apellidos*', 'Departamento*?', 'Provincia*?', 'Distrito*?', 'Dirección*',
    'Teléfono Fijo*', 'Teléfono Móvil*', 'Correo Personal*',
  ] },
]

const socioeconomicSections: CatalogSection[] = [
  { title: 'Datos Alumno', labels: [
    'Código de Estudiante', 'Nombre de Estudiante', 'Sexo', 'Identidad Étnica', 'Teléfono Fijo',
    'Fecha de Nacimiento', 'País', 'Departamento', 'Provincia', 'Distrito', 'Estado Civil',
    'Correo Personal', 'Tipo de Doc. de Identidad', 'Número de Doc. de Identidad',
    'Teléfono Móvil', 'Religión', 'Lengua Materna', 'Cuenta de Facebook',
  ] },
  { title: 'Colegio de Procedencia', labels: [
    'País?', 'Departamento?', 'Provincia?', 'Distrito?', 'Tipo de Colegio?', 'Nombre del Colegio',
    'Pago Mensual', 'Año de conclusión de Secundaria?', 'Tipo de Preparación Universitaria?',
  ] },
  { title: 'Dependencia Económica', labels: [
    '¿Depende económicamente de sus padres o tutores?^s', 'Número de Hijos',
    'Cantidad de personas con las que vive', '¿Usted trabaja en la actualidad?^s',
    'Actividad del trabajo', 'Teléfono del trabajo', 'Lugar de Trabajo',
  ] },
  { title: 'Contacto', labels: [
    'Nombres y Apellidos', 'Teléfono Fijo', 'Teléfono Móvil', 'Parentesco', 'Correo Personal',
    'Departamento?', 'Provincia?', 'Distrito?', 'Dirección', 'Nombre del Exterior',
    'Teléfono del Exterior', 'Dirección del Exterior',
  ] },
  { title: 'Salud', labels: [
    '¿A que seguro de salud se encuentra incorporado?^s', 'Especifique el tipo de seguro que tiene:~',
    'Alergias~', 'Tipo de Sangre?^s', 'Discapacidad?^s', 'Especifique el tipo de discapacidad:~',
  ] },
  { title: 'Interés Académico', labels: [
    '¿Cómo se siente en la carrera?^s', '¿Qué curso fue el más difícil y por qué?^s', 'Motivo~',
    '¿Se siente motivado con la carrera?^s', '¿Siente que los profesores motivan a seguir estudiando?^s',
    '¿Qué área de cursos le agrada más?~', '¿En qué área le gustaría especializarse?~',
  ] },
  { title: 'Transporte', labels: [
    '¿Es residente en la vivienda universitaria?^s', 'Medio de transporte hacia la Universidad?^s',
    '¿Cuánto tiempo te demoras en llegar a la Universidad?(mins)',
  ] },
  { title: 'Familia Salud', labels: [] },
  { title: 'Recursos de Estudio', labels: [
    'Transporte?', 'Acceso a Internet?', 'Acceso a Bibliotecas?', 'Alimentación?',
    '¿Pertenece a algún programa de Becas? ¿Cúal?',
  ] },
  { title: 'Datos Vivienda', labels: [
    'Tenencia de la Vivienda?^s', 'Especifique su tipo de vivienda:~',
    'Número de habitaciones exclusivas para dormitorios', 'SISFOH?^s', 'Tipo de Vivienda?^s',
    'Especifique su tipo de vivienda:~', 'Tipo de Techo?^s', 'Especifique su tipo de techo:~',
    'Tipo de Pared?^s', 'Especifique su tipo de pared:~', 'Tipo de Piso?^s',
    'Especifique su tipo de piso:~', 'Abastecimiento de Agua?^s',
    'Especifique su tipo de abastecimiento de agua:~', 'Tipo de Desagüe?^s',
    'Especifique su tipo de desagüe:~', 'Electricidad?^s', 'Telefono?^s', 'Cable?^s',
    'Internet?^s', 'Otros servicios con los que cuente~',
  ] },
  { title: 'Situación Económica', labels: [
    'Ingresos del Estudiante', 'Ingresos de la Familia', 'Ingresos por Beca', 'Otros Ingresos',
    'Alimentación', 'Movilidad', 'Vivienda', 'Servicio', 'Salud', 'Educacion', 'Recreación',
    'Deuda', 'Otro', 'Alimentación', 'Movilidad', 'Vivienda', 'Servicio', 'Salud', 'Educacion',
    'Recreación', 'Deuda', 'Otro',
  ] },
  { title: 'Recreación', labels: [
    '¿Qué deportes practicas?~', '¿Qué actividades artísticas practicas?~',
    '¿Qué actividades sociales practicas?~',
    '¿En que agrupación artística, cultural, deportiva, religiosa, política, etc. participas?~',
  ] },
  { title: 'Aptitudes y Habilidades', labels: [
    'Respeto^', 'Sinceridad^', 'Tolerancia^', 'Solidaridad^', 'Disciplina^', 'Creatividad^',
    'Adaptación^', 'Cortesía^', 'Paciencia^', 'Aptitudes Personales:~', 'Trabajo en equipo^',
    'Liderazgo^', 'Control de Estrés^', 'Capacidad Analítica^', 'Comunicación^', 'Innovación^',
    'Proactiva^', 'Flexibilidad^', 'Motivación^', 'Habilidades Profesionales:~', 'Empatía^',
    'Liderazgo^', 'Escucha Activa^', 'Persuasión^', 'Asertividad^', 'Positivo^',
    'Habilidades Sociales:~',
  ] },
]

function cleanLabel(source: string): string {
  let label = source.replace(/\^s$/, '')
  label = label.replace(/\*\?$/, '').replace(/[*@#~^]+$/, '')
  const terminalQuestionIsSemantic = source.startsWith('¿') || source.endsWith(':?') || /\?.*[*?@#~^]/.test(source)
  if (!terminalQuestionIsSemantic) label = label.replace(/\?$/, '')
  return label.trim()
}

export function buildSections(kind: 'formulario' | 'ficha', alumno: AlumnoFixture, empty = false): SeccionInformacion[] {
  const catalog = kind === 'formulario' ? formSections : socioeconomicSections
  const values: Record<string, string> = {
    'Código de Estudiante': alumno.codAlumno,
    'Nombre de Estudiante': `${alumno.nomAlumno} ${alumno.apePaterno} ${alumno.apeMaterno}`.trim(),
    'Tipo de Doc. de Identidad': 'DNI',
    'Número de Doc. de Identidad': 'DEMO-DOC-001',
    'Fecha de Nacimiento': '2008-01-15',
    Sexo: alumno.sexo,
    'Teléfono Fijo': '010000000',
    'Teléfono Móvil': '900000001',
    'Correo Personal': 'persona@example.test',
  }
  return catalog.map((section, sectionIndex) => ({
    id: `${kind}-${String(sectionIndex + 1).padStart(2, '0')}`,
    titulo: section.title,
    campos: section.labels.map((source, fieldIndex) => {
      const etiqueta = cleanLabel(source)
      const identifier = etiqueta === 'Código de Estudiante' || etiqueta === 'Nombre de Estudiante'
      const value = identifier ? values[etiqueta] : empty ? null : values[etiqueta] ?? null
      return { id: `${kind}-${String(sectionIndex + 1).padStart(2, '0')}-${String(fieldIndex + 1).padStart(3, '0')}`, etiqueta, valor: value }
    }),
  }))
}
