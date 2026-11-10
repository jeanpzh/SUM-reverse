import assert from 'node:assert/strict'
import {api,closeChat,nav,response,json,singleCourse,generate,save} from './helpers.mjs'
export const interactionScenarios = [
  ['empty-workspace-six-destinations',async ({page,record}) => {
    await closeChat(page)
    for (const [stage,view] of [['preparacion','resumen'],['preparacion','cursos'],['preparacion','recursos'],['horario'],['revision'],['aprobacion']]) {
      await nav(page,stage,view)
      assert.equal(await page.locator(`.planning-stage-panel--${stage}`).isVisible(),true)
    }
    await nav(page,'preparacion','resumen')
    assert.equal(await page.locator('.planning-status-bar').count(),0)
    assert.equal(await page.locator('#planning-tour-primary').innerText(),'Revisar oferta')
    record({configurationOnlySaveEnabled:await page.locator('#planning-tour-save').isEnabled()})
  }],
  ['generation-failure-can-be-retried-without-fake-proposal',async ({page,base}) => {
    await singleCourse(page,base)
    await nav(page,'preparacion','resumen')
    await page.route('**/v1/propuestas',route => route.abort(),{times:1})
    await page.locator('#planning-tour-primary').click()
    await page.getByRole('alert').filter({hasText:/gener|local|fetch|Failed|recuper|solicitud/i}).first().waitFor()
    assert.equal(await page.locator('.planning-status-bar').count(),0)
    assert.equal((await generate(page)).status,'complete')
  }],
  ['resource-modal-edit-survives-navigation',async ({page}) => {
    await closeChat(page)
    await nav(page,'preparacion','recursos')
    const first=page.getByRole('region',{name:'Tabla de docentes',exact:true}).getByRole('button',{name:/^Abrir ficha de/}).first()
    await first.click()
    const pane=page.locator('.academic-resource-workbench__inspector-pane')
    await pane.waitFor()
    const incorporate=pane.getByRole('button',{name:'Incorporar a la propuesta',exact:true})
    if(await incorporate.isVisible()) await incorporate.click()
    const load=page.getByLabel('Carga semanal docente',{exact:true})
    await load.fill('600')
    const id=await page.getByLabel('Identificación docente',{exact:true}).inputValue()
    await pane.getByRole('button',{name:'Cerrar ficha',exact:true}).click()
    await nav(page,'preparacion','resumen');await nav(page,'preparacion','recursos')
    await page.getByLabel('Buscar docentes por nombre o código',{exact:true}).fill(id)
    await page.getByRole('region',{name:'Tabla de docentes',exact:true}).getByRole('button',{name:/^Abrir ficha de/}).first().click()
    assert.equal(await page.getByLabel('Carga semanal docente',{exact:true}).inputValue(),'600')
    await page.keyboard.press('Escape')
    await pane.waitFor({state:'hidden'})
    assert.equal(await page.evaluate(()=>document.body.style.pointerEvents),'')
  }],
  ['invalid-adjustment-does-not-change-schedule',async ({page,base}) => {
    await singleCourse(page,base)
    const proposal=await generate(page)
    const first=proposal.assignments[0]
    const original=await json(await page.request.get(`${base}${api}/propuestas/${proposal.proposalId}`))
    await page.locator(`.planning-sections__row[data-section-id=${JSON.stringify(first.sectionId)}]`).getByRole('button',{name:/^Inspeccionar sección/}).click()
    await page.locator('.planning-inspector').getByRole('button',{name:'Editar horario',exact:true}).click()
    await page.getByLabel(`Inicio revisión ${first.sectionId}`,{exact:true}).fill('00:00')
    const pending=response(page,'/ajustes')
    await page.getByRole('button',{name:'Aplicar ajuste',exact:true}).click()
    assert.equal((await pending).status(),422)
    await page.getByRole('alert').filter({hasText:'No se aplicó el ajuste'}).waitFor()
    assert.deepEqual(await json(await page.request.get(`${base}${api}/propuestas/${proposal.proposalId}`)),original)
  }],
  ['save-network-error-preserves-work-and-retries',async ({page,base}) => {
    await singleCourse(page,base);const proposal=await generate(page)
    const title=`AUDIT retry save ${Date.now()}`
    await page.getByLabel('Nombre de la propuesta',{exact:true}).fill(title)
    await page.route('**/borradores/guardar',r=>r.abort(),{times:1})
    await page.locator('#planning-tour-save').click()
    await page.locator('#planning-draft-error').waitFor()
    assert.equal(await page.getByLabel('Nombre de la propuesta',{exact:true}).inputValue(),title)
    assert.equal(await page.locator('.planning-status-bar').getAttribute('data-status'),proposal.status)
    const result=await save(page,title)
    assert.equal(result.draft.title,title)
  }],
  ['advisor-saving-state-explains-global-block',async ({page,record,capture}) => {
    await generate(page,true)
    let release,entered
    const gate=new Promise(r=>{release=r})
    const started=new Promise(r=>{entered=r})
    await page.route('**/borradores/guardar',async r=>{entered();await gate;await r.continue()})
    await page.getByLabel('Nombre de la propuesta',{exact:true}).fill(`AUDIT delay ${Date.now()}`)
    const pending=response(page,'/borradores/guardar')
    await page.locator('#planning-tour-save').click();await started
    const advisor=page.getByRole('button',{name:'Consultar consejero',exact:true})
    const disabled=await advisor.isDisabled()
    const explanation=await page.locator('#planning-tour-save').innerText()
    record({disabledDuringSave:disabled,globalSaveLabel:explanation,nearbyReason:await advisor.getAttribute('aria-describedby')})
    const reasonId=await advisor.getAttribute('aria-describedby')
    const reasonText=reasonId ? await page.locator(`[id=${JSON.stringify(reasonId)}]`).innerText() : ''
    if(reasonId){
      await page.setViewportSize({width:390,height:844})
      await page.locator(`[id=${JSON.stringify(reasonId)}]`).waitFor()
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true)
      await capture('advisor-saving-reason-390')
      await page.setViewportSize({width:1440,height:1000})
    }
    release();await json(await pending)
    assert.ok(reasonId,'Disabled advisor must have a nearby accessible reason')
    assert.match(reasonText,/Esperando a que termine la operación con la propuesta/)
    await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(b=>b.textContent.trim()==='Consultar consejero'&&!b.matches(':disabled')))
    assert.equal(await advisor.getAttribute('aria-describedby'),null)
    assert.match(explanation,/Guardando/)
    await advisor.click()
    await page.getByRole('dialog',{name:'Consejero de planificación',exact:true}).waitFor()
    await page.keyboard.press('Escape')
    await page.getByRole('dialog',{name:'Consejero de planificación',exact:true}).waitFor({state:'hidden'})
    assert.equal(await advisor.isEnabled(),true)
  }],
  ['responsive-open-rail-does-not-silently-block-workspace',async ({page,record}) => {
    // A breakpoint transition closes the assistant; opening a modal needs an explicit command.
    await generate(page,true)
    await page.locator('#planning-toggle-chat').click()
    const observations=[]
    for(const width of [1280,1100,1024,900,720,390,1440]){
      await page.setViewportSize({width,height:850})
      const modal=page.getByRole('dialog',{name:'Asistente normativo',exact:true})
      if(width<1280)await page.locator('#planning-rail').waitFor({state:'hidden'})
      else if(width===1280)await page.locator('#planning-rail').waitFor()
      else await page.waitForFunction(()=>document.querySelector('#planning-toggle-chat')?.getAttribute('aria-expanded')==='false')
      observations.push({width,modalAfterResize:await modal.isVisible(),bodyPointerEvents:await page.evaluate(()=>document.body.style.pointerEvents),advisorAccessibleCount:await page.getByRole('button',{name:'Consultar consejero',exact:true}).count()})
    }
    record({resizeMatrix:observations})
    assert.equal(observations.every(row=>!row.modalAfterResize),true,'Resizing an open rail should not open a blocking modal without explicit intent (UX finding)')
  }],
  ['mobile-menu-assistant-close-and-focus',async ({page}) => {
    await closeChat(page)
    await page.setViewportSize({width:390,height:844})
    const toggle=page.locator('#planning-toggle-chat')
    await toggle.click()
    const modal=page.getByRole('dialog',{name:'Asistente normativo',exact:true})
    await modal.waitFor()
    await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'})
    assert.equal(await toggle.evaluate(el=>el===document.activeElement),true)
    await nav(page,'preparacion','cursos')
    assert.equal(await page.getByRole('region',{name:'Tabla de cursos para planificación',exact:true}).isVisible(),true)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true)
  }],
]
