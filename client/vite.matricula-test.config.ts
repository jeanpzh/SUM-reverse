import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { defineConfig, type Plugin } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'

// Local-only fixture for the root shell loader; independent of AppModule, client mocks and snapshots.
const syntheticAlumno = {
  codAlumno: 'SYN-SHELL-001', apePaterno: 'ESTUDIANTE', apeMaterno: 'SINTETICO', nomAlumno: 'DEMO',
  codFacultad: 0, desFacultad: 'Facultad de demostración', areaFacultad: 0,
  codEscuela: 0, desEscuela: 'Programa de prueba', areaEscuela: 0,
  codEspecialidad: 0, desEspecialidad: 'Especialidad sintética',
  codPlan: 'SYN-SHELL-PLAN', desPlan: 'Plan sintético', ponderado: 17,
  actualizoFormulario: false, habEncuesta: false, habEncuestaEgresados: false,
  habMatricula: false, periodo: '2026-II', urlFoto: '', foto: '',
  codPermanencia: 'S', desPermanencia: 'Sintética', codSituacion: 'S', desSituacion: 'Sintética',
  regimen: 'Semestral', egresadoEG: 'N', cicloEstudios: 1, anioIngreso: 2026,
  correoInstitucional: 'alumno.synthetic@example.test', sexo: 'No especificado', nroTicketMatEG: 0,
  infoSemestre: {
    fecSistema: null,
    fecInicioEncuestaDocente: '2026-11-01T00:00:00.000Z', fecFinEncuestaDocente: '2026-12-01T00:00:00.000Z',
    fecInicioEncuestaDocenteS1: '2026-11-01T00:00:00.000Z', fecFinEncuestaDocenteS1: '2026-12-01T00:00:00.000Z',
    fecInicioEncuestaDocenteS2: '2026-11-01T00:00:00.000Z', fecFinEncuestaDocenteS2: '2026-12-01T00:00:00.000Z',
    fecInicioEncuestaDocenteA1: '2026-11-01T00:00:00.000Z', fecFinEncuestaDocenteA1: '2026-12-01T00:00:00.000Z',
    fecInicioEncuestaDocenteA2: '2026-11-01T00:00:00.000Z', fecFinEncuestaDocenteA2: '2026-12-01T00:00:00.000Z',
  },
  infoMatricula: {
    fecInicioMatInternet: '2026-08-01', fecFinMatInternet: '2026-08-15',
    indMatInternet: 'N', indMatObservados: 'N', indMatDeudores: 'N', indMatIngresantes: 'N',
    indMatExonerados: 'N', indMatRepMultiple: 'N', indProgramacionInterna: 'N',
    indPagosAdicionales: 'N', obsSemMatInternet: null, indCertificadoMed: 'N',
    indHabMatricula: 'N', numMaxRepitencias: 0, indAutoSeguro: 'N', indMatCtrlHorario: 'N',
    sfecInicioMatInternet: '01/08/2026', sfecFinMatInternet: '15/08/2026',
  },
  anioEstudio: 1, codSede: 'SYN', sedeAlumno: 'Sede sintética', difCriterioCalif: false,
}

const sectionTitles = [
  'Datos Personales', 'Colegio de Procedencia', 'Dependencia Económica', 'Recursos de Estudio',
  'Transporte', 'Salud', 'Interés Académico', 'Contacto',
]
const sectionFieldCounts = [23, 9, 6, 5, 3, 3, 7, 8]
const formularioData = {
  alumno: syntheticAlumno,
  formulario: {},
  politicaPrivacidad: null,
  llenar: false,
  datosPersonalesCompletado: false,
  colegioCompletado: false,
  actividadProfesionalCompletado: false,
  dependenciaEconomicaCompletado: false,
  recursosEstudioCompletado: false,
  transporteCompletado: false,
  saludCompletado: false,
  interesAcademicoCompletado: false,
  contactoCompletado: false,
  secciones: sectionTitles.map((titulo, index) => {
    const section = String(index + 1).padStart(2, '0')
    return {
      id: `formulario-${section}`,
      titulo,
      campos: Array.from({ length: sectionFieldCounts[index] }, (_, fieldIndex) => ({
        id: `formulario-${section}-${String(fieldIndex + 1).padStart(3, '0')}`,
        etiqueta: `Campo sintético ${fieldIndex + 1}`,
        valor: null,
      })),
    }
  }),
}

function syntheticShellFormPlugin(): Plugin {
  return {
    name: 'synthetic-shell-form-fixture',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.method !== 'POST'
          || request.url !== '/api/alumnoWebSum/v2/informacion/formularioDatos?accion=obtenerFormularioDatosMatricula') {
          next()
          return
        }

        response.statusCode = 200
        response.setHeader('Content-Type', 'application/json; charset=utf-8')
        response.setHeader('X-SUM-MI-Representation', 'local-v1')
        response.end(JSON.stringify({ message: null, codError: null, data: formularioData }))
      })
    },
  }
}

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5741,
    strictPort: true,
    proxy: {
      '/api/local/matricula-regular/v1': {
        target: 'http://127.0.0.1:5742',
        changeOrigin: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  plugins: [
    syntheticShellFormPlugin(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
})
