import assert from 'node:assert/strict'
import {nav,response,json,singleCourse,generate,save,resume,closeChat} from './helpers.mjs'
import {courseControl,noResultDisplayed} from '../planning-v2-helpers.mjs'
export const extraScenarios = [
  ['demand-two-sources-preserve-manual-demand',async ({page,base,record}) => {
    const course=await singleCourse(page,base)
    await page.getByRole('button',{name:'Resumen de demanda',exact:true}).click()
    const modal=page.getByRole('dialog',{name:'Resumen de demanda potencial',exact:true})
    for(const source of ['existing-regular-v1','independent-120-v1']){
      await modal.getByLabel('Fuente de demanda potencial',{exact:true}).selectOption(source)
      const pending=response(page,'/demanda/estimar')
      await modal.getByRole('button',{name:'Estimar demanda potencial',exact:true}).click()
      const result=await json(await pending)
      assert.equal(result.source.id,source)
      assert.ok(result.rows.some(r=>r.courseId===course.courseId))
      assert.doesNotMatch(await modal.innerText(),/SYN-SIS-[AB]/)
      record({source,population:result.source.populationSize})
    }
    await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'})
    assert.equal(await (await courseControl(page,'Demanda final',course.courseId)).inputValue(),'1')
  }],
  ['manual-valid-slot-updates-version-and-preserves-duration',async ({page,base}) => {
    await singleCourse(page,base);const proposal=await generate(page)
    const first=proposal.assignments[0]
    const old=first.startMinute
    await page.getByRole('table',{name:'Secciones de la propuesta'}).locator(`tr[data-section-id=${JSON.stringify(first.sectionId)}]`).first().getByRole('button',{name:/^Inspeccionar sección/}).click()
    await page.locator('.planning-inspector').getByRole('button',{name:'Editar horario',exact:true}).click()
    const targetDay=first.day===1?2:1
    await page.getByLabel(`Día revisión ${first.sectionId}`,{exact:true}).selectOption(String(targetDay))
    const pending=response(page,'/ajustes')
    await page.getByRole('button',{name:'Aplicar ajuste',exact:true}).click()
    const adjusted=await json(await pending)
    assert.equal(adjusted.editVersion,(proposal.editVersion??0)+1)
    const moved=adjusted.assignments.find(a=>a.sessionId===first.sessionId)
    assert.equal(moved.day,targetDay)
    assert.equal(moved.startMinute,old)
    assert.equal(moved.endMinute-moved.startMinute,first.endMinute-first.startMinute)
    assert.ok(adjusted.manuallyAdjustedSectionIds.includes(first.sectionId))
  }],
  ['changing-demand-invalidates-saved-schedule-and-resumes-config-only',async ({page,base}) => {
    const course=await singleCourse(page,base);await generate(page)
    const {draft}=await save(page,`AUDIT config ${Date.now()}`)
    await nav(page,'preparacion','cursos')
    await (await courseControl(page,'Demanda final',course.courseId)).fill('2')
    const stale=await noResultDisplayed(page);assert.ok(stale.none,`Changing demand invalidates the visible result: ${JSON.stringify(stale)}`)
    const {draft:changed,payload}=await save(page,draft.title)
    assert.equal(payload.proposalId,null)
    assert.equal(changed.proposal,null)
    assert.equal(changed.version,draft.version+1)
    await page.reload({waitUntil:'networkidle'});await page.locator('#planning-page-title').waitFor();await closeChat(page)
    const restored=await resume(page,changed)
    assert.equal(restored.proposal,null)
    await nav(page,'preparacion','cursos')
    assert.equal(await (await courseControl(page,'Demanda final',course.courseId)).inputValue(),'2')
  }],
]
