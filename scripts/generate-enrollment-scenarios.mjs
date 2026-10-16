#!/usr/bin/env node
import { lstat, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBuiltInEnrollmentScenarioBundles } from '../backend/dist/matricula-regular/enrollment-scenarios.js'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT = resolve(ROOT, 'evidence/local/perfiles-escenarios-matricula/generated')
const ids = ['regular', 'repitencia', 'tutoria', 'prerrequisito', 'cruce', 'cupo', 'deuda', 'gap-horario', 'prioridad']

async function ensureOutputDirectory() {
  const segments = ['evidence', 'local', 'perfiles-escenarios-matricula', 'generated']
  let current = ROOT
  for (const segment of segments) {
    current = resolve(current, segment)
    try {
      const stat = await lstat(current)
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Directorio de salida no permitido: ${segment}`)
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error
      await mkdir(current)
    }
  }
}

await ensureOutputDirectory()
const bundles = buildBuiltInEnrollmentScenarioBundles()
const guide = [
  '# Escenarios completos de matrícula', '',
  'Semillas sintéticas incorporadas: 97 filas del plan (85 cursos), 165 filas de programación y 64/65 intentos académicos en nueve periodos por perfil. Los originales de datos-sinteticos/ no se modifican.', '',
  '```sh', 'docker compose -f compose.local.yaml up --build', '```', '',
  'Abre http://localhost:5180 y selecciona escenario y estudiante. Cada inicio reinicia la prueba local. No es necesario generar ni montar estos JSON.', '',
  'Sistemas conserva el plan completo. Software usa la misma base con escuela adaptada como decisión local, no como plan oficial verificado. Solo las primeras secciones de ocho cursos tienen ajustes controlados de horario/cupo para reproducir los escenarios.', '',
  '| Perfil | Historial | Aprobadas | Ponderado |', '| --- | ---: | ---: | ---: |',
  ...bundles[0].fixtures.flatMap(({ actors }) => actors.map((actor) => `| ${actor.actorId} | ${actor.academic.attempts.length} | ${actor.approvedCourseIds.length} | ${actor.ponderado.toFixed(2)} |`)), '',
  'La prematrícula se deriva del historial y los prerrequisitos del plan. C13 depende de C09 y no se puede elegir en la interfaz. El caso HTTP negativo lo envía deliberadamente fuera del documento. Las secciones recomendadas se indican en selection de cada caso.', '',
  '| Escenario | Actor | Selección | Resultado esperado | Causas / gaps esperados |',
  '| --- | --- | --- | --- | --- |',
]
for (const bundle of bundles) {
  for (const item of bundle.cases) {
    const selection = item.selection.map(({ courseId }) => courseId.slice(-3)).join(', ')
    const causes = item.expected.causes.map(({ code, courseIds }) => `${code}${courseIds.length ? ` (${courseIds.map((id) => id.slice(-3)).join(',')})` : ''}`).join('; ') || '—'
    const gaps = item.expected.gaps.map(({ code, courseIds }) => `${code}${courseIds.length ? ` (${courseIds.map((id) => id.slice(-3)).join(',')})` : ''}`).join('; ') || '—'
    guide.push(`| ${bundle.scenarioId} | ${item.actorId} | ${selection} | ${item.expected.state} | ${causes}; gaps: ${gaps} |`)
  }
}
guide.push('', 'Revisión: PEM ampliado. source.referenceFiles conserva los hashes de los dos JSON académicos sintéticos utilizados.', '')

for (const bundle of bundles) {
  if (!ids.includes(bundle.scenarioId)) throw new Error('Builder devolvió escenario fuera de la lista permitida')
  await writeFile(resolve(OUTPUT, `${bundle.scenarioId}.json`), `${JSON.stringify(bundle, null, 2)}\n`, { mode: 0o644 })
}
await writeFile(resolve(OUTPUT, 'README.md'), guide.join('\n'), { mode: 0o644 })
console.log(`Generados ${bundles.length} paquetes sintéticos y README en evidence/local/perfiles-escenarios-matricula/generated`)
