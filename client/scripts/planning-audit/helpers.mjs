import assert from 'node:assert/strict'
import { setPlanningCheckbox } from '../planning-checkboxes.mjs'
export const route = '/local/programacion-academica'
export const api = '/api/local/programacion-academica/v1'
export async function closeChat(page) {
  if (await page.locator('#planning-toggle-chat').getAttribute('aria-expanded') === 'true') {
    const close = page.getByRole('button', { name: 'Cerrar asistente', exact: true })
    if (await close.isVisible()) await close.click()
    else await page.locator('#planning-toggle-chat').click()
  }
}
export async function nav(page, stage, view) {
  if (!await page.locator('#planning-tour-nav a[href]:visible').count()) await page.locator('[data-slot=sidebar-trigger]').click()
  const hrefs = await page.locator('#planning-tour-nav a[href]').evaluateAll(items => items.map(item => item.getAttribute('href')))
  const href = hrefs.find(href => {const u = new URL(href, 'http://local');return u.searchParams.get('etapa') === stage && (!view || u.searchParams.get('vista') === view)})
  assert.ok(href, `Navigation ${stage}/${view}`)
  const link = page.locator(`#planning-tour-nav a[href="${href}"]:visible`).first()
  if (!await link.isVisible()) await page.locator('[data-slot=sidebar-trigger]').click()
  await link.click()
  await page.waitForURL(u => u.searchParams.get('etapa') === stage && (!view || u.searchParams.get('vista') === view))
}
export function response(page, suffix, method = 'POST') {
  const pending = page.waitForResponse(r => new URL(r.url()).pathname.endsWith(suffix) && r.request().method() === method, { timeout: 45000 })
  void pending.catch(() => {}) // Let per-scenario cleanup close the page without an unhandled rejection.
  return pending
}
export async function json(r) {assert.equal(r.status(), 200, (await r.text()).slice(0,500));return r.json()}
export async function singleCourse(page, base) {
  await closeChat(page)
  const catalog = await json(await page.request.get(`${base}${api}/catalogo`))
  const course = catalog.courses.find(c => c.planningPatterns?.some(p => p.weeklySessions.length > 0) && catalog.teachers.some(t => t.courseIds.includes(c.courseId)) && catalog.rooms.some(r => r.capacity >= c.targetCapacity))
  assert.ok(course)
  await nav(page, 'preparacion', 'cursos')
  await setPlanningCheckbox(page.getByRole('checkbox', {name:`Seleccionar ${course.courseId}`,exact:true}))
  await page.getByLabel(`Demanda ${course.courseId}`,{exact:true}).fill('1')
  return course
}
export async function generate(page, all = false) {
  await closeChat(page)
  await nav(page, 'preparacion', 'resumen')
  if (all) await page.getByRole('button',{name:/Seleccionar los .* cursos del catálogo/}).click()
  const pending = response(page, '/propuestas')
  await page.locator('#planning-tour-primary').click()
  const proposal = await json(await pending)
  await page.locator('.planning-status-bar').waitFor()
  return proposal
}
export async function save(page, title) {
  await page.getByLabel('Nombre de la propuesta',{exact:true}).fill(title)
  const pending = response(page, '/borradores/guardar')
  await page.locator('#planning-tour-save').click()
  const r = await pending
  return {draft:await json(r),payload:r.request().postDataJSON()}
}
export async function resume(page, draft) {
  await page.locator('#planning-tour-proposals').click()
  const row = page.locator('.academic-scheduling__saved-row').filter({hasText:draft.title})
  const pending = response(page,`/borradores/${draft.id}/continuar`)
  await row.getByRole('button',{name:'Continuar edición',exact:true}).click()
  const result = await json(await pending)
  await page.getByRole('dialog',{name:'Mis propuestas',exact:true}).waitFor({state:'hidden'})
  return result.draft
}
