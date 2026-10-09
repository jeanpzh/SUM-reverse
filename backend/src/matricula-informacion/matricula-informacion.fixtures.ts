import type { ArticuloMatricula } from './matricula-informacion.types.js'

export function createArticuloMatricula(periodo: string): ArticuloMatricula {
  return {
    introduccion: 'Módulo de Matrícula Vía Internet',
    secciones: [
      {
        id: 'cronograma',
        titulo: 'Control de Cronograma de Matrícula',
        descripcion: `Información sobre el cronograma académico relacionado con la matrícula del periodo ${periodo}.`,
      },
      {
        id: 'acceso-facultad',
        titulo: 'Control de Acceso de Facultad',
        descripcion: 'Información sobre el control de acceso de la facultad.',
      },
      {
        id: 'prematricula',
        titulo: 'Control de Pre-Matrícula',
        descripcion: 'Información sobre el proceso de pre-matrícula.',
      },
      {
        id: 'deudas',
        titulo: 'Control de Deudas Registradas',
        descripcion: 'Información sobre las deudas registradas.',
      },
      {
        id: 'interfaz',
        titulo: 'Interfaz de Matrícula',
        descripcion: 'Información sobre la interfaz del módulo de matrícula.',
      },
    ],
  }
}
