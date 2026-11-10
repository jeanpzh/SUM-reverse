// Utility means measured regenerated coverage, not a new proposal ID alone.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {chromium} from 'playwright'
import {setPlanningCheckbox} from './planning-checkboxes.mjs'
import {api,generate,response,json,save,resume,closeChat,nav} from './planning-audit/helpers.mjs'
if(process.env.SUM_REDESIGN_SYNTHETIC!=='1')throw new Error('Owned synthetic stack required')
const base=new URL(process.env.SUM_REDESIGN_BASE)
if(base.protocol!=='http:'||base.hostname!=='127.0.0.1'||base.pathname!=='/'||base.search||base.hash||base.username||base.password)throw new Error('Owned loopback origin required')
const evidence=resolve(process.env.SUM_REDESIGN_EVIDENCE)
await mkdir(evidence,{recursive:true})
const browser=await chromium.launch()
const page=await browser.newPage({viewport:{width:1440,height:1000}})
page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(45000)
const generationRequests=[]
page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname.endsWith('/v1/propuestas'))generationRequests.push(r.postDataJSON())})
const errors=[],observed={source:'Actual UI -> own synthetic NestJS/Python; no model calls or transport mocking'}
page.on('pageerror',e=>errors.push(e.message))
const coverage=p=>{
 const assigned=new Map()
 for(const a of p.assignments)assigned.set(a.sectionId,(assigned.get(a.sectionId)||0)+1)
 const pending=new Set(p.pending.map(p=>p.sectionId))
 return {components:p.counts.scheduledSessions,required:p.counts.requiredSessions,completeSections:p.sections.filter(s=>assigned.has(s.sectionId)&&!pending.has(s.sectionId)).length,totalSections:p.counts.sections,pendingComponents:p.pending.length,status:p.status}
}
try{
 await page.goto(`${base.origin}/local/programacion-academica`,{waitUntil:'networkidle'})
 await page.locator('#planning-page-title').waitFor({timeout:45000})
 const constrained=process.env.SUM_ASSISTANT_CASES==='advisor-policy-window-complete'
 if(constrained){
  await closeChat(page)
  const catalog=await json(await page.request.get(`${base.origin}${api}/catalogo`))
  const course=catalog.courses.find(c=>c.cycle>=7&&c.planningPatterns?.some(p=>p.weeklySessions.reduce((sum,s)=>sum+s.durationMinutes,0)>240))
  assert.ok(course,'Reviewed synthetic catalog needs a senior continuous block longer than the normal evening window')
  const pattern=course.planningPatterns.find(p=>p.weeklySessions.reduce((sum,s)=>sum+s.durationMinutes,0)>240)
  await nav(page,'preparacion','cursos')
  await setPlanningCheckbox(page.getByRole('checkbox',{name:`Seleccionar ${course.courseId}`,exact:true}))
  await page.getByLabel(`Demanda ${course.courseId}`,{exact:true}).fill('1')
  await page.getByLabel(`Patrón ${course.courseId}`,{exact:true}).selectOption(pattern.id)
  observed.scenario={kind:'single-course-window-bottleneck',courseId:course.courseId}
 }
 const original=await generate(page,!constrained)
 observed.before=coverage(original)
 const requested=response(page,'/consejero')
 await page.getByRole('button',{name:'Consultar consejero',exact:true}).click()
 const initial=await json(await requested)
 observed.defaultSimulation=initial.verifiedImpact
 const panel=page.getByRole('dialog',{name:'Consejero de planificación',exact:true})
 await panel.locator('[data-advisor-impact=verified]').waitFor()
 const selected=initial.recommendations.filter(r=>(constrained?['enable_planning_window']:['enable_planning_window','change_delivery_mode']).includes(r.patch.kind))
 assert.equal(selected.length,constrained?1:2)
 for(const r of initial.recommendations){
  const checkbox=panel.getByRole('checkbox',{name:r.title,exact:true})
  const desired=selected.some(s=>s.id===r.id)
  if((await checkbox.getAttribute('aria-checked')==='true')!==desired)await checkbox.click()
 }
 const firstChoice=panel.getByRole('checkbox',{name:selected[0].title,exact:true})
 await firstChoice.click();await firstChoice.click()
 const apply=panel.getByRole('button',{name:'Aplicar seleccionadas y regenerar',exact:true})
 observed.invalidated={applyDisabled:await apply.isDisabled(),describedBy:await apply.getAttribute('aria-describedby'),selectedIds:selected.map(r=>r.id)}
 await page.screenshot({path:resolve(evidence,'selection-before-simulation.png')})
 const simulate=response(page,'/consejero')
 await panel.getByRole('button',{name:'Simular selección actual',exact:true}).click()
 const simulated=await json(await simulate)
 observed.simulation=simulated.verifiedImpact
 await panel.locator('[data-advisor-impact=verified]').waitFor()
 assert.equal(await apply.isEnabled(),true)
 const regenerated=response(page,'/propuestas')
 await apply.click()
 const regen=await regenerated
 const actual=await json(regen)
 observed.after=coverage(actual)
 observed.appliedRequest={planningPolicy:regen.request().postDataJSON().planningPolicy,deliveryModes:[...new Set(regen.request().postDataJSON().demands.map(d=>d.deliveryMode))]}
 observed.changedTeacherLoads=generationRequests[1].resources.teachers.filter(t=>generationRequests[0].resources.teachers.find(p=>p.id===t.id)?.maxWeeklyMinutes!==t.maxWeeklyMinutes).map(t=>t.id)
 assert.deepEqual(observed.changedTeacherLoads,[],'Safe window/delivery recommendations must not raise teacher load')
 observed.gain={components:observed.after.components-observed.before.components,completeSections:observed.after.completeSections-observed.before.completeSections}
 await panel.waitFor({state:'hidden'})
 await page.locator('.planning-status-bar').waitFor()
 observed.visibleOutcome=await page.locator('[data-advisor-outcome]').count()
 await page.screenshot({path:resolve(evidence,'actual-regenerated.png')})
 const drafts=await json(await page.request.get(`${base.origin}${api}/borradores`))
 assert.equal(drafts.items.length,0,'Applying does not implicitly save')
 assert.equal(observed.appliedRequest.planningPolicy.allowAfternoon,true)
 assert.equal(observed.appliedRequest.planningPolicy.allowSaturday,true)
 if(!constrained)assert.ok(observed.appliedRequest.deliveryModes.includes('split'))
 if(constrained){assert.equal(actual.status,'complete');assert.equal(actual.pending.length,0)}
 assert.ok(observed.gain.components>0,'These synthetic safe recommendations must improve actual coverage')
 assert.ok(observed.gain.completeSections>0,'Actual complete sections must increase')
 const {draft}=await save(page,`Consejero utilidad sintética ${Date.now()}`)
 await page.reload({waitUntil:'networkidle'});await page.locator('#planning-page-title').waitFor({timeout:45000});await closeChat(page)
 const restored=await resume(page,draft)
 assert.deepEqual(coverage(restored.proposal),observed.after)
 observed.persisted=true
 assert.ok(observed.invalidated.describedBy,'Apply must explain the missing current simulation next to its action')
 assert.equal(observed.visibleOutcome,1,'Show actual measured gain after regeneration')
 assert.deepEqual(errors,[])
 console.log('PASS advisor utility: valid selection -> simulation -> apply -> real gain -> explicit save -> resume')
}catch(error){observed.failure=error.message;console.log(`FAIL ${error.message}`);process.exitCode=1}
finally{observed.errors=errors;await writeFile(resolve(evidence,'utility.json'),JSON.stringify(observed,null,2));await browser.close()}
