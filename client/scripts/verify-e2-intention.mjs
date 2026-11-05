// Dedicated synthetic Compose project only. No operator instance, private snapshots or production.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

if (process.env.SUM_E2_INTENTION_SYNTHETIC !== '1') throw new Error('Confirma el proyecto propio sintético con SUM_E2_INTENTION_SYNTHETIC=1')
const base = 'http://127.0.0.1:5280'
const phase = process.env.SUM_E2_INTENTION_PHASE
if (!['save','resume'].includes(phase)) throw new Error('SUM_E2_INTENTION_PHASE=save|resume')
const root=fileURLToPath(new URL('../../',import.meta.url))
const evidence=resolve(root,'evidence/local/prematricula-e2-intention')
const statePath=resolve(evidence,'synthetic-intentions.json')
await mkdir(evidence,{recursive:true})
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe')?'C:/Program Files/Google/Chrome/Application/chrome.exe':undefined)})
const e1='/api/local/programacion-academica/v1', e2='/api/local/prematricula/v1'
const errors=[],external=[]
const responseFor=(page,path)=>page.waitForResponse(response=>new URL(response.url()).pathname===path && response.request().method()==='POST')
async function json(page,path,data) {
  const response=await page.request.fetch(`${base}${path}`,data===undefined?{}:{method:'POST',data})
  assert.equal(response.status(),200,`${path}: ${await response.text()}`)
  return response.json()
}
async function forkAndPublish(page,source) {
  let draft=(await json(page,`${e1}/borradores/${source.id}/nuevo-borrador`,{expectedVersion:source.approvedVersion+1})).draft
  const demands=draft.configuration.request.demands
  draft=(await json(page,`${e1}/borradores/${draft.id}/revision/enviar`,{expectedVersion:draft.version})).draft
  for(const teacher of draft.review.teachers) draft=(await json(page,`${e1}/borradores/${draft.id}/revision/responder`,{
    expectedVersion:draft.version,round:draft.review.round,teacherId:teacher.teacherId,decision:'conformity',observation:''})).draft
  draft=(await json(page,`${e1}/borradores/${draft.id}/aprobar`,{expectedVersion:draft.version})).draft
  const list=await json(page,`${e1}/publicaciones`)
  draft=(await json(page,`${e1}/borradores/${draft.id}/publicar`,{expectedVersion:draft.version,expectedCurrentId:list.currentId})).draft
  return {publication:await json(page,`${e1}/publicaciones/${draft.id}`),demands}
}
async function enter(page,actorId) {
  const logout=page.getByRole('button',{name:'Salir',exact:true})
  if(await logout.count()) { await logout.click(); await page.waitForURL('**/local/login') }
  await page.goto(`${base}/local/login`)
  await page.locator('input[name="scenario"][value="regular"]').check()
  await page.locator(`input[name="profile"][value="${actorId}"]`).check()
  await page.getByRole('button',{name:'Iniciar prueba',exact:true}).click()
  await page.waitForURL('**/alumnoWebSum/v2/inicio')
  const pending=responseFor(page,`${e2}/contexto`)
  await page.goto(`${base}/alumnoWebSum/v2/reportes/prematricula`)
  const response=await pending; assert.equal(response.status(),200)
  await page.locator('.student-premat > summary').click()
  await page.locator('.student-premat__body').waitFor()
  return {identity:response.request().postDataJSON().identity,context:await response.json()}
}
async function choose(page,publication,sectionNumber) {
  const select=page.locator('.student-premat__controls select')
  if(await select.inputValue()!==publication.id) await select.selectOption(publication.id)
  const pending=responseFor(page,`${e2}/publicacion`)
  await page.getByRole('button',{name:'Consultar',exact:true}).click(); await pending
  const row=page.locator('.student-premat table tbody tr').filter({hasText:'20118091'}).first()
  await row.getByRole('button',{name:'Elegir',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'Secciones disponibles'})
  await dialog.locator('input[type="radio"]').nth(sectionNumber-1).check()
  const selectedId=await dialog.locator('input[type="radio"]').nth(sectionNumber-1).getAttribute('value')
  const validated=page.waitForResponse(response=>new URL(response.url()).pathname===`${e2}/validar`
    && response.request().postDataJSON().selection.some(item=>item.sectionId===selectedId))
  await dialog.getByRole('button',{name:'✓ Aceptar',exact:true}).click()
  assert.equal((await (await validated).json()).status,'valid')
  const saved=responseFor(page,`${e2}/guardar`)
  await page.getByRole('button',{name:'Guardar borrador',exact:true}).click()
  const response=await saved; assert.equal(response.status(),200)
  const value=await response.json()
  await page.getByRole('status').filter({hasText:`Borrador guardado · versión ${value.draft.version}.`}).waitFor()
  return value.draft
}
async function register(page) {
  const button=page.getByRole('button',{name:/^(Registrar intención|Actualizar intención)$/})
  await button.waitFor(); await button.isEnabled()
  const pending=responseFor(page,`${e2}/intencion/registrar`)
  await button.click()
  const response=await pending; assert.equal(response.status(),200,await response.text())
  const value=await response.json()
  assert.equal(value.validation.status,'valid')
  await page.locator('.student-intention').getByRole('status').filter({hasText:/Intención (registrada|actualizada)/}).waitFor()
  return value
}
const demand=(page,publication)=>json(page,`${e2}/demanda`,{publicationId:publication.id,publicationVersion:publication.publicationVersion})
const course=d=>d.courses.find(item=>item.courseId==='20118091')
async function unchanged(page,identity) {
  const context=await json(page,`/api/local/matricula-regular/v1/contextos/${identity.actorId}`)
  const report=await json(page,`/api/local/perfiles/v1/consultas/matricula?${new URLSearchParams(identity)}`)
  return {offer:context.data.offer,report:report.data.payload}
}
async function schoolQuery(page,publication) {
  await page.locator('.academic-intention-demand select').selectOption(publication.id)
  const pending=responseFor(page,`${e2}/demanda`)
  await page.getByRole('button',{name:'Consultar intenciones',exact:true}).click()
  const response=await pending; assert.equal(response.status(),200)
  return response.json()
}
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}})
  page.on('pageerror',e=>errors.push(e.message))
  page.on('dialog',dialog=>void dialog.accept())
  page.on('request',request=>{if(!request.url().startsWith(`${base}/`)&&!request.url().startsWith('data:'))external.push(request.url())})
  if(phase==='save') {
    const list=await json(page,`${e1}/publicaciones`)
    let source
    for(const item of list.items) {
      const publication=await json(page,`${e1}/publicaciones/${item.id}`)
      if(publication.schedule.sections.filter(section=>section.courseId==='20118091').length>=2) { source=publication;break }
    }
    assert.ok(source,'Preparar primero la publicación sintética del verificador E2 de borradores')
    const prepared=await forkAndPublish(page,source), pubA=prepared.publication
    assert.equal((await demand(page,pubA)).countedStudents,0)
    const a=await enter(page,'SYN-SIS-A'), beforeA=await unchanged(page,a.identity)
    let draftA=await choose(page,pubA,1)
    assert.equal((await demand(page,pubA)).countedStudents,0,'guardar no registra ni migra intención')
    const first=await register(page)
    assert.equal((await demand(page,pubA)).countedStudents,1)
    draftA=await choose(page,pubA,2)
    const savedOnly=course(await demand(page,pubA))
    assert.equal(savedOnly.sections.find(s=>s.sectionId.endsWith(',1]')).students,1,'guardar conserva intención anterior')
    const second=await register(page)
    assert.equal(second.intention.version,first.intention.version+1)
    const updated=await demand(page,pubA)
    assert.equal(updated.countedStudents,1)
    assert.equal(course(updated).sections.find(s=>s.sectionId.endsWith(',2]')).students,1)
    assert.deepEqual(await unchanged(page,a.identity),beforeA)
    assert.deepEqual(await json(page,`${e1}/publicaciones/${pubA.id}`),pubA)

    const b=await enter(page,'SYN-SIS-B'), beforeB=await unchanged(page,b.identity)
    const draftB=await choose(page,pubA,1)
    const bRegistered=await register(page)
    assert.equal(bRegistered.intention.actorId,'SYN-SIS-B')
    assert.notEqual(draftB.id,draftA.id)
    const total=await demand(page,pubA)
    assert.equal(total.countedStudents,2); assert.equal(course(total).students,2)
    assert.ok(course(total).sections.every(s=>s.students===1))
    const forged=await page.request.post(`${base}${e2}/intencion/registrar`,{data:{identity:b.identity,draftId:draftA.id,
      expectedDraftVersion:draftA.version,expectedIntentionVersion:second.intention.version,expectedAcademicRevision:b.context.academicRevision}})
    assert.equal(forged.status(),403)
    assert.deepEqual(await unchanged(page,b.identity),beforeB)
    const next=await forkAndPublish(page,pubA), pubB=next.publication
    const activeA=await enter(page,'SYN-SIS-A'), beforeMove=await unchanged(page,activeA.identity)
    draftA=await choose(page,pubB,1)
    assert.equal((await demand(page,pubA)).countedStudents,2)
    assert.equal((await demand(page,pubB)).countedStudents,0)
    const moved=await register(page)
    assert.equal((await demand(page,pubA)).countedStudents,1)
    assert.equal((await demand(page,pubB)).countedStudents,1)
    const stale=await page.request.post(`${base}${e2}/intencion/registrar`,{data:{identity:activeA.identity,draftId:draftA.id,
      expectedDraftVersion:draftA.version,expectedIntentionVersion:moved.intention.version-1,expectedAcademicRevision:activeA.context.academicRevision}})
    assert.equal(stale.status(),409)
    assert.deepEqual(await unchanged(page,activeA.identity),beforeMove)
    for(const publication of [pubA,pubB]) assert.deepEqual(await json(page,`${e1}/publicaciones/${publication.id}`),publication)
    await page.locator('.student-intention').screenshot({path:resolve(evidence,'intencion-registrada.png')})
    await writeFile(statePath,JSON.stringify({phase:'save',source:'own synthetic Compose5280',pubA,pubB,expectedDemands:next.demands,
      actorA:{id:draftA.id,draftVersion:draftA.version,intentionVersion:moved.intention.version},
      actorB:{id:draftB.id,draftVersion:draftB.version,intentionVersion:bRegistered.intention.version},errors,external},null,2))
  } else {
    const state=JSON.parse(await readFile(statePath,'utf8'))
    const a=await enter(page,'SYN-SIS-A')
    const restored=await json(page,`${e2}/intencion/contexto`,{identity:a.identity})
    assert.equal(restored.intention.version,state.actorA.intentionVersion)
    assert.equal(restored.intention.draftId,state.actorA.id)
    assert.equal(restored.intention.history.at(-1).publicationId,state.pubB.id)
    const studentPanel=page.locator('.student-intention')
    await studentPanel.getByText('Intención registrada',{exact:true}).waitFor()
    assert.equal(await studentPanel.locator('dd').first().innerText(),String(state.actorA.intentionVersion))
    assert.equal(await studentPanel.getByRole('button',{name:'Actualizar intención',exact:true}).isEnabled(),false)
    await studentPanel.screenshot({path:resolve(evidence,'intencion-recuperada.png')})
    const b=await enter(page,'SYN-SIS-B')
    const ownB=await json(page,`${e2}/intencion/contexto`,{identity:b.identity})
    assert.equal(ownB.intention.draftId,state.actorB.id)
    assert.equal(ownB.intention.version,state.actorB.intentionVersion)
    await page.goto(`${base}/local/programacion-academica`)
    await page.locator('.academic-intention-demand > summary').click()
    const old=await schoolQuery(page,state.pubA), current=await schoolQuery(page,state.pubB)
    assert.equal(old.countedStudents,1); assert.equal(current.countedStudents,1)
    assert.ok(!JSON.stringify(current).includes('SYN-SIS-'),'escuela no recibe identidades')
    const totals=page.locator('.academic-intention-demand__totals')
    assert.deepEqual(await totals.locator('dd').allTextContents(),['1','1','0'])
    assert.ok(await totals.locator('div').evaluateAll(nodes=>nodes.every(node=>{
      const term=node.querySelector('dt'), value=node.querySelector('dd')
      return value.getBoundingClientRect().left>=term.getBoundingClientRect().right
    })),'los valores de totales no se superponen con sus etiquetas')
    await page.locator('.academic-intention-demand').screenshot({path:resolve(evidence,'demanda-agregada.png')})
    const forked=responseFor(page,`${e1}/borradores/${state.pubB.id}/nuevo-borrador`)
    await page.getByRole('button',{name:'Crear borrador E1 de esta publicación',exact:true}).click()
    const response=await forked; assert.equal(response.status(),200,await response.text())
    const draft=(await response.json()).draft
    assert.equal(draft.origin.draftId,state.pubB.id); assert.notEqual(draft.id,state.pubB.id)
    assert.deepEqual(draft.configuration.request.demands,state.expectedDemands,'conteos no reemplazan demanda final del borrador E1')
    for(const publication of [state.pubA,state.pubB]) assert.deepEqual(await json(page,`${e1}/publicaciones/${publication.id}`),publication)
    await writeFile(statePath,JSON.stringify({...state,phase:'resume',recoveredAfterRestart:true,aggregatesVerified:true,newDraftCreated:true,errors,external},null,2))
  }
  assert.deepEqual(errors,[]); assert.deepEqual(external,[])
  console.log(`PASS E2 intention ${phase}: registration, latest unique counts, isolation, immutable E1 and unchanged enrollment`)
} finally { await browser.close() }
