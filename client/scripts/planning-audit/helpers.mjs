import assert from 'node:assert/strict'
import { openProposalMenu, setProposalTitle, statusBar, selectOnlyCourse, courseControl } from '../planning-v2-helpers.mjs'
export const route = '/local/programacion-academica'
export const api = '/api/local/programacion-academica/v1'
export async function closeChat(page) {
  const toggle = page.locator('#planning-toggle-chat')
  // v1 toggled aria-expanded; the v2 boards use aria-pressed.
  if (await toggle.getAttribute('aria-expanded') === 'true' || await toggle.getAttribute('aria-pressed') === 'true') {
    const close = page.getByRole('button', { name: 'Cerrar asistente', exact: true })
    if (await close.isVisible()) await close.click()
    else await page.locator('#planning-toggle-chat').click()
  }
}
export async function nav(page, stage, requestedView) {
  const view = requestedView === 'resumen' ? 'cursos' : requestedView // Resumen is not a v2 destination; its readiness strip lives on Oferta de cursos
  if (!await page.locator('#planning-tour-nav a[href]:visible, nav[aria-label="Etapas de la propuesta"] a[href]:visible').count()) await page.locator('[data-slot=sidebar-trigger]').click()
  const hrefs = await page.locator('#planning-tour-nav a[href], nav[aria-label="Etapas de la propuesta"] a[href]').evaluateAll(items => items.map(item => item.getAttribute('href')))
  const href = hrefs.find(href => {const u = new URL(href, 'http://local');return u.searchParams.get('etapa') === stage && (!view || u.searchParams.get('vista') === view)})
  assert.ok(href, `Navigation ${stage}/${view}`)
  const link = page.locator(`:is(#planning-tour-nav, nav[aria-label="Etapas de la propuesta"]) a[href="${href}"]:visible`).first()
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
  await selectOnlyCourse(page, course.courseId)
  await (await courseControl(page, 'Demanda final', course.courseId)).fill('1')
  return course
}
export async function generate(page, all = false) {
  await closeChat(page)
  await nav(page, 'preparacion', 'cursos')
  if (all) await page.getByRole('button',{name:/Seleccionar los .* cursos del catálogo/}).click()
  const pending = response(page, '/propuestas')
  await page.locator('#planning-tour-primary').click()
  const proposal = await json(await pending)
  await statusBar(page).waitFor() // all stages stay mounted: scope to the visible (current stage) strip
  return proposal
}
export async function save(page, title) {
  await setProposalTitle(page, title)
  const pending = response(page, '/borradores/guardar')
  await page.locator('#planning-tour-save').click()
  const r = await pending
  return {draft:await json(r),payload:r.request().postDataJSON()}
}
export async function resume(page, draft) {
  await openProposalMenu(page)
  const row = page.locator('.academic-scheduling__saved-row').filter({hasText:draft.title})
  const pending = response(page,`/borradores/${draft.id}/continuar`)
  await row.getByRole('button',{name:'Continuar edición',exact:true}).click()
  const result = await json(await pending)
  await page.locator('#planning-tour-proposal, [role=dialog][aria-label="Mis propuestas"]').first().waitFor({state:'hidden'}) // v2 menu or legacy dialog
  return result.draft
}
