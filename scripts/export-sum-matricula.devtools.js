// Pegar en Console del SUM autorizado. Exporta cinco GET a un ZIP, sin panel.
(async () => {
  if (location.origin !== 'https://sum.unmsm.edu.pe') throw Error('Abre la pestaña del SUM.')
  const jobs = [
    ['matricula-info', 'matricula/informacion', 'obtenerInformacion'],
    ['programacion-asignaturas', 'matricula/programacion', 'obtenerProgramacionAsignaturas'],
    ['reporte-pre-matricula', 'reportes/prematricula', 'obtenerAlumnoPrematricula'],
    ['reporte-matricula', 'reportes/matricula', 'obtenerAlumnoMatricula'],
    ['reporte-horario', 'reportes/horarios', 'obtenerHorariosAsignatura'],
  ]
  const files = []
  for (let i = 0; i < jobs.length; i++) {
    if (i) await new Promise(resolve => setTimeout(resolve, 2000))
    const [name, path, action] = jobs[i]
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    let text
    try {
      const response = await fetch(`/alumnoWebSum/v2/${path}?accion=${action}`, {
        method: 'GET', credentials: 'same-origin', redirect: 'error',
        headers: { Accept: 'application/json' }, signal: controller.signal,
      })
      if (!response.ok) throw Error(`HTTP ${response.status}: ${name}`)
      text = await response.text()
    } finally { clearTimeout(timeout) }
    let json
    try { json = JSON.parse(text) } catch { throw Error(`Respuesta no JSON: ${name}`) }
    if (!json || typeof json !== 'object' || Array.isArray(json)
      || !['message', 'codError', 'data'].every(key => Object.hasOwn(json, key))
      || json.codError !== null) throw Error(`Respuesta de error o incompleta: ${name}`)
    files.push([`datos-reales/${name}.json`, text])
    console.info(`SUM: ${i + 1}/5 respuestas recibidas`)
  }
  const encode = value => new TextEncoder().encode(value)
  const record = fields => {
    const bytes = new Uint8Array(fields.reduce((size, [width]) => size + width, 0))
    const view = new DataView(bytes.buffer)
    let position = 0
    for (const [width, value] of fields) {
      view[`setUint${width * 8}`](position, value, true)
      position += width
    }
    return bytes
  }
  const local = [], central = []
  let offset = 0, centralSize = 0
  const now = new Date()
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
  const date = ((Math.max(1980, Math.min(2107, now.getFullYear())) - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()
  for (const [filename, text] of files) {
    const name = encode(filename), data = encode(text), length = data.length
    let crc = 0xffffffff
    for (const byte of data) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
    crc = (~crc) >>> 0
    const header = record([[4,0x04034b50],[2,20],[2,0x800],[2,0],[2,time],[2,date],[4,crc],[4,length],[4,length],[2,name.length],[2,0]])
    const entry = record([[4,0x02014b50],[2,20],[2,20],[2,0x800],[2,0],[2,time],[2,date],[4,crc],[4,length],[4,length],[2,name.length],[2,0],[2,0],[2,0],[2,0],[4,0],[4,offset]])
    local.push(header, name, data)
    central.push(entry, name)
    offset += header.length + name.length + length
    centralSize += entry.length + name.length
    if (offset + centralSize + 22 > 0xffffffff) throw Error('El conjunto supera el límite ZIP32.')
  }
  const end = record([[4,0x06054b50],[2,0],[2,0],[2,files.length],[2,files.length],[4,centralSize],[4,offset],[2,0]])
  const url = URL.createObjectURL(new Blob([...local, ...central, end], { type: 'application/zip' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: 'sum-matricula-json.zip' })
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
  console.info('Descarga solicitada: sum-matricula-json.zip. Extrae datos-reales/ en el proyecto.')
})().catch(error => console.error('Exportación detenida, sin ZIP:', error?.name === 'AbortError' ? 'Tiempo de espera agotado.' : error.message))
