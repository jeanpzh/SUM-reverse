export const routes = [
  { id: 'home', path: '/alumnoWebSum/v2/inicio', title: 'Inicio' },
  { id: 'perfil', path: '/alumnoWebSum/v2/informacion/perfil', title: 'Mi Perfil' },
  { id: 'historial', path: '/alumnoWebSum/v2/informacion/historial', title: 'Historial Académico' },
  {
    id: 'formulario-datos',
    path: '/alumnoWebSum/v2/informacion/formularioDatos',
    title: 'Formulario de Datos Personales',
  },
  {
    id: 'ficha-socioeconomica',
    path: '/alumnoWebSum/v2/informacion/fichaSocioeconomica',
    title: 'Ficha Socioeconómica',
  },
  {
    id: 'matricula-informacion',
    path: '/alumnoWebSum/v2/matricula/informacion',
    title: 'Información de Matrícula',
  },
  {
    id: 'programacion-asignaturas',
    path: '/alumnoWebSum/v2/matricula/programacion',
    title: 'Programación de Asignaturas',
  },
  {
    id: 'reportes-prematricula',
    path: '/alumnoWebSum/v2/reportes/prematricula',
    title: 'Reporte de Prematricula',
  },
  {
    id: 'reportes-matricula',
    path: '/alumnoWebSum/v2/reportes/matricula',
    title: 'Reporte de Matricula',
  },
  {
    id: 'reportes-horarios',
    path: '/alumnoWebSum/v2/reportes/horarios',
    title: 'Reporte de Horarios de Asignaturas Matriculadas',
  },
  {
    id: 'reportes-evaluaciones',
    path: '/alumnoWebSum/v2/reportes/evaluaciones',
    title: 'Reporte de Evaluaciones',
  },
  { id: 'reportes-deudas', path: '/alumnoWebSum/v2/reportes/deudas', title: 'Reporte de Deudas' },
  { id: 'asistencia', path: '/alumnoWebSum/v2/asistencia', title: 'Mis Asistencias' },
  { id: 'tutoria', path: '/alumnoWebSum/v2/tutoria', title: 'Mis Tutorias' },
  { id: 'plan-estudios', path: '/alumnoWebSum/v2/planEstudios', title: 'Plan de Estudios' },
  { id: 'manuales', path: '/alumnoWebSum/v2/manuales', title: 'Manuales y Tutoriales' },
] as const

export type ScreenId = (typeof routes)[number]['id']
export const routeUrl = (id: ScreenId) => routes.find((route) => route.id === id)!.path
export const routeAt = (path: string) =>
  routes.find((route) => route.path === path.replace(/\/$/, ''))

export const navigation: { label: string; icon: string; id?: ScreenId; children?: ScreenId[] }[] = [
  { label: 'Inicio', icon: 'home', id: 'home' },
  {
    label: 'Mi Información',
    icon: 'user',
    children: ['perfil', 'historial', 'formulario-datos', 'ficha-socioeconomica'],
  },
  {
    label: 'Matrícula',
    icon: 'edit',
    children: ['matricula-informacion', 'programacion-asignaturas'],
  },
  {
    label: 'Reportes',
    icon: 'file',
    children: [
      'reportes-prematricula',
      'reportes-matricula',
      'reportes-horarios',
      'reportes-evaluaciones',
      'reportes-deudas',
    ],
  },
  { label: 'Mis Asistencias', icon: 'calendar', id: 'asistencia' },
  { label: 'Mi Tutoria', icon: 'tutor', id: 'tutoria' },
  { label: 'Plan de Estudios', icon: 'book', id: 'plan-estudios' },
  { label: 'Manuales y Tutoriales', icon: 'video', id: 'manuales' },
]
