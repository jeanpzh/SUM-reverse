import assert from 'node:assert/strict'
import {api,closeChat,nav,response,json,singleCourse,generate,save,resume} from './helpers.mjs'
export const lifecycleScenarios = [
  ['complete-draft-review-approval-publication-and-fork', async ({page,base,record}) => {
    await singleCourse(page,base)
    const proposal = await generate(page)
    assert.equal(proposal.status,'complete')
    const {draft:saved} = await save(page,`AUDIT lifecycle ${Date.now()}`)
    assert.equal(saved.state,'draft')
    await page.reload({waitUntil:'networkidle'})
    await page.locator('#planning-page-title').waitFor()
    await closeChat(page)
    const restored = await resume(page,saved)
    assert.equal(restored.id,saved.id)
    assert.equal(restored.version,saved.version)
    assert.deepEqual(restored.proposal.assignments,proposal.assignments)
    await nav(page,'revision')
    const submit = response(page,`/borradores/${saved.id}/revision/enviar`)
    await page.getByRole('button',{name:/^Enviar a revisión(?: docente)?$/}).click()
    let state = (await json(await submit)).draft
    assert.equal(state.state,'in-review')
    for (const teacher of state.review.teachers) {
      await page.getByLabel('Rol simulado de revisión',{exact:true}).selectOption('teacher')
      await page.getByLabel('Docente de revisión',{exact:true}).selectOption(teacher.teacherId)
      const conform = response(page,`/borradores/${saved.id}/revision/responder`)
      await page.getByRole('button',{name:'Dar conformidad',exact:true}).click()
      state = (await json(await conform)).draft
    }
    assert.equal(state.state,'ready-for-approval')
    await page.getByLabel('Rol simulado de revisión',{exact:true}).selectOption('school')
    await nav(page,'aprobacion')
    await page.locator('.academic-publication__preview').waitFor()
    const approve = page.getByRole('button',{name:'Aprobar (simulada)',exact:true})
    await approve.click()
    await page.getByRole('alertdialog').getByRole('button',{name:'Cancelar',exact:true}).click()
    assert.equal((await json(await page.request.get(`${base}${api}/borradores/${saved.id}/vista-previa`))).state,'ready-for-approval')
    await approve.click()
    const approval = response(page,`/borradores/${saved.id}/aprobar`)
    await page.getByRole('alertdialog').getByRole('button',{name:'Aprobar',exact:true}).click()
    const approved = (await json(await approval)).draft
    assert.equal(approved.state,'approved')
    assert.equal(await page.getByLabel('Nombre de la propuesta',{exact:true}).isDisabled(),true)
    const list = response(page,'/publicaciones','GET')
    await page.getByRole('button',{name:'Actualizar publicaciones',exact:true}).click()
    await json(await list)
    await page.getByRole('button',{name:'Publicar (simulada)',exact:true}).click()
    const publish = response(page,`/borradores/${saved.id}/publicar`)
    await page.getByRole('alertdialog').getByRole('button',{name:'Publicar',exact:true}).click()
    const published = (await json(await publish)).draft
    assert.equal(published.state,'published')
    const release = await json(await page.request.get(`${base}${api}/publicaciones/${saved.id}`))
    assert.deepEqual(release.schedule.assignments,proposal.assignments)
    await page.getByRole('button',{name:'Crear nuevo borrador',exact:true}).click()
    const fork = response(page,`/borradores/${saved.id}/nuevo-borrador`)
    await page.getByRole('alertdialog').getByRole('button',{name:'Crear borrador',exact:true}).click()
    const forked = (await json(await fork)).draft
    assert.notEqual(forked.id,saved.id)
    assert.equal(forked.state,'draft')
    assert.deepEqual(await json(await page.request.get(`${base}${api}/publicaciones/${saved.id}`)),release)
    record({proposalStatus:proposal.status,states:['draft','in-review','ready-for-approval','approved','published'],forked:true})
  }],
  ['teacher-observation-blocks-approval', async ({page,base}) => {
    await singleCourse(page,base);await generate(page)
    const {draft} = await save(page,`AUDIT observation ${Date.now()}`)
    await nav(page,'revision')
    const submit=response(page,`/borradores/${draft.id}/revision/enviar`)
    await page.getByRole('button',{name:/^Enviar a revisión(?: docente)?$/}).click()
    const state=(await json(await submit)).draft
    await page.getByLabel('Rol simulado de revisión',{exact:true}).selectOption('teacher')
    await page.getByLabel('Docente de revisión',{exact:true}).selectOption(state.review.teachers[0].teacherId)
    await page.getByLabel('Observación docente',{exact:true}).fill('Observación sintética: revisar disponibilidad.')
    const pending=response(page,`/borradores/${draft.id}/revision/responder`)
    await page.getByRole('button',{name:'Solicitar cambios',exact:true}).click()
    const observed=(await json(await pending)).draft
    assert.equal(observed.state,'in-review')
    assert.equal(observed.review.teachers[0].status,'changes-requested')
    await page.getByLabel('Rol simulado de revisión',{exact:true}).selectOption('school')
    await nav(page,'aprobacion')
    assert.equal(await page.getByRole('button',{name:'Aprobar (simulada)',exact:true}).count(),0)
  }],
  ['stale-save-does-not-overwrite-newer-version',async ({page,base}) => {
    await singleCourse(page,base);await generate(page)
    const {draft,payload}=await save(page,`AUDIT stale ${Date.now()}`)
    const remote=await page.request.post(`${base}${api}/borradores/guardar`,{data:{...payload,id:draft.id,expectedVersion:draft.version,title:`${draft.title} remote`}})
    assert.equal(remote.status(),200)
    const next=await remote.json()
    await page.getByLabel('Nombre de la propuesta',{exact:true}).fill(`${draft.title} local`)
    const pending=response(page,'/borradores/guardar')
    await page.locator('#planning-tour-save').click()
    assert.equal((await pending).status(),409)
    await page.locator('#planning-draft-error').waitFor()
    const persisted=await json(await page.request.get(`${base}${api}/borradores/${draft.id}/vista-previa`))
    assert.equal(persisted.title,next.title)
    assert.equal(persisted.version,next.version)
    assert.equal(await page.getByLabel('Nombre de la propuesta',{exact:true}).inputValue(),`${draft.title} local`)
  }],
]
