import assert from 'node:assert/strict'
import { setProposalTitle, readProposalTitle, statusBar, noResultDisplayed } from '../planning-v2-helpers.mjs'
import {api,closeChat,nav,response,json,singleCourse,generate,save} from './helpers.mjs'
export const interactionScenarios = [
  ['empty-workspace-six-destinations',async ({page,record}) => {
    await closeChat(page)
    for (const [stage,view] of [['preparacion','cursos'],['preparacion','recursos'],['horario'],['revision'],['aprobacion']]) {
      await nav(page,stage,view)
      assert.equal(await page.locator(`.planning-stage-panel--${stage}`).isVisible(),true)
    }
    await nav(page,'preparacion','cursos')
    const empty=await noResultDisplayed(page);assert.ok(empty.none,`No result before generating: ${JSON.stringify(empty)}`)
    // v2: with an empty offer the single primary is the catalog selection (handoff §5.1), not "Revisar oferta"
    assert.match(await page.locator('#planning-tour-primary:visible').innerText(),/^Seleccionar los \d+ cursos del catálogo$/)
    record({configurationOnlySaveEnabled:await page.locator('#planning-tour-save').isEnabled()})
  }],
  ['generation-failure-can-be-retried-without-fake-proposal',async ({page,base}) => {
    await singleCourse(page,base)
    await nav(page,'preparacion','cursos')
    await page.route('**/v1/propuestas',route => route.abort(),{times:1})
    await page.locator('#planning-tour-primary').click()
    await page.getByRole('alert').filter({hasText:/gener|local|fetch|Failed|recuper|solicitud/i}).first().waitFor()
    const empty=await noResultDisplayed(page);assert.ok(empty.none,`A failed generation must not leave a proposal: ${JSON.stringify(empty)}`)
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
    // v2: the minutes control lives in the "Editar carga en minutos" disclosure (the visible control is "Carga máxima docente en horas")
    const minutes=async()=>{const load=pane.getByLabel('Carga semanal docente',{exact:true});if(!await load.isVisible())await pane.getByText('Editar carga en minutos',{exact:true}).click();await load.waitFor();return load}
    await (await minutes()).fill('660')
    const id=await page.getByLabel('Identificación docente',{exact:true}).inputValue()
    await pane.getByRole('button',{name:'Cerrar ficha',exact:true}).click()
    await nav(page,'preparacion','cursos');await nav(page,'preparacion','recursos')
    await page.getByLabel('Buscar docentes por nombre o código',{exact:true}).fill(id)
    await page.getByRole('region',{name:'Tabla de docentes',exact:true}).getByRole('button',{name:/^Abrir ficha de/}).first().click()
    assert.equal(await (await minutes()).inputValue(),'660')
    await page.keyboard.press('Escape')
    await pane.waitFor({state:'hidden'})
    assert.equal(await page.evaluate(()=>document.body.style.pointerEvents),'')
  }],
  ['invalid-adjustment-does-not-change-schedule',async ({page,base}) => {
    await singleCourse(page,base)
    const proposal=await generate(page)
    const first=proposal.assignments[0]
    const original=await json(await page.request.get(`${base}${api}/propuestas/${proposal.proposalId}`))
    await page.getByRole('table',{name:'Secciones de la propuesta'}).locator(`tr[data-section-id=${JSON.stringify(first.sectionId)}]`).first().getByRole('button',{name:/^Inspeccionar sección/}).click()
    await page.locator('.planning-inspector').getByRole('button',{name:'Editar horario',exact:true}).click()
    await page.getByLabel(`Inicio revisión ${first.sectionId}`,{exact:true}).selectOption('0') // v2: start is a select of minutes since midnight; 0 = 00:00, outside every window
    const pending=response(page,'/ajustes')
    await page.getByRole('button',{name:'Aplicar ajuste',exact:true}).click()
    assert.equal((await pending).status(),422)
    await page.getByRole('alert').filter({hasText:'No se aplicó el ajuste'}).waitFor()
    assert.deepEqual(await json(await page.request.get(`${base}${api}/propuestas/${proposal.proposalId}`)),original)
  }],
  ['save-network-error-preserves-work-and-retries',async ({page,base}) => {
    await singleCourse(page,base);const proposal=await generate(page)
    const title=`AUDIT retry save ${Date.now()}`
    await setProposalTitle(page,title)
    await page.route('**/borradores/guardar',r=>r.abort(),{times:1})
    await page.locator('#planning-tour-save').click()
    await page.locator('#planning-draft-error').waitFor()
    assert.equal(await readProposalTitle(page),title)
    assert.equal(await statusBar(page).getAttribute('data-status'),proposal.status)
    const result=await save(page,title)
    assert.equal(result.draft.title,title)
  }],
  ['advisor-saving-state-explains-global-block',async ({page,record,capture}) => {
    await generate(page,true)
    let release,entered
    const gate=new Promise(r=>{release=r})
    const started=new Promise(r=>{entered=r})
    await page.route('**/borradores/guardar',async r=>{entered();await gate;await r.continue()})
    await setProposalTitle(page,`AUDIT delay ${Date.now()}`)
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
      // v2 (ticket 10): below 720px the stage notices and secondary actions, including the advisor and its reason, sit inside the "Acciones" disclosure
      const actions=page.locator('details.planning-mobile-stage-actions:visible').first()
      if(!await actions.evaluate(el=>el.open))await actions.locator('summary').click()
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
    // v2: the advisor is the Consejero tab of the assistance rail, closed with its own button
    await page.getByRole('tabpanel',{name:'Consejero',exact:true}).waitFor()
    await page.getByRole('button',{name:'Cerrar asistente',exact:true}).click()
    await page.locator('#planning-chat-body').waitFor({state:'hidden'})
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
    // v2: the course table only exists once the offer has courses (empty state, States board 03), so select the catalog first
    await page.getByRole('button',{name:/^Seleccionar los .* cursos del catálogo$/}).click()
    await nav(page,'preparacion','cursos')
    assert.equal(await page.getByRole('region',{name:'Tabla de cursos para planificación',exact:true}).isVisible(),true)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true)
  }],
]
