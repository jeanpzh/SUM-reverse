// Acceptance for the Planning v2 shell: structure, copy, computed-style fidelity to the approved boards
// (docs/design/academic-planning-2026-11-16/boards), one primary per view, status text, visible focus and
// reflow. Expected values live in planning-v2-board-spec.mjs (BOARD_SPEC).
//
// Run only on a fresh, operator-confirmed synthetic stack, e.g.:
//   pnpm --dir client exec node scripts/verify-planning-redesign-stack.mjs verify-planning-v2-shell.mjs
// Never attach to a snapshot-backed server or production. Light theme, fresh draft, 1440x1000 first.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { BOARD_SPEC as B } from './planning-v2-board-spec.mjs'
import { gotoStage, openProposalMenu, closeProposalMenu, proposalTitleField } from './planning-v2-helpers.mjs'

if (process.env.SUM_REDESIGN_SYNTHETIC !== '1') throw new Error('Fresh explicitly synthetic stack required: SUM_REDESIGN_SYNTHETIC=1')
const base = new URL(process.env.SUM_REDESIGN_BASE || 'http://127.0.0.1:5436')
if (base.protocol !== 'http:' || base.hostname !== '127.0.0.1' || base.pathname !== '/' || base.search || base.hash || base.username || base.password) throw new Error('Dedicated loopback origin required')
const evidence = resolve(process.env.SUM_REDESIGN_EVIDENCE || '../evidence/local/planning-v2-2026-11-16')
await mkdir(evidence, { recursive: true })

const results = []
let problems = []
const expect = (actual, expected, label) => {
  if (actual !== expected) problems.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}
const expectTrue = (condition, label) => { if (!condition) problems.push(label) }
const near = (actual, expected, label, tolerance = 0.5) => {
  if (!(Math.abs(actual - expected) <= tolerance)) problems.push(`${label}: expected ${expected}±${tolerance}, got ${actual}`)
}
const criterion = async (id, description, run) => {
  problems = []
  try {
    await run()
    if (problems.length) throw new Error(problems.join(' | '))
    results.push({ id, passed: true })
    console.log(`PASS ${id}: ${description}`)
  } catch (error) {
    results.push({ id, passed: false })
    console.log(`FAIL ${id}: ${description}: ${String(error.message).replace(/\s+/g, ' ').slice(0, 1800)}`)
  }
}

const norm = (text) => text.replace(/\s+/g, ' ').trim()
const color = (value) => value.replace(/\s+/g, '')
const px = (value) => parseFloat(value)
const styles = (locator, props) => locator.evaluate((el, names) => {
  const style = getComputedStyle(el)
  return Object.fromEntries(names.map((name) => [name, style[name]]))
}, props)
const box = async (locator) => locator.evaluate((el) => { const r = el.getBoundingClientRect(); return { width: r.width, height: r.height } })

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: B.viewport })
const page = await context.newPage()
page.setDefaultTimeout(20000)
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const root = page.locator('.planning-root')
const title = page.locator('#planning-page-title')
const primary = page.locator('#planning-tour-primary:visible') // the id also exists on hidden stage copies (all stages stay mounted)

const capture = (name) => page.screenshot({ path: resolve(evidence, `${name}.png`) })
const settle = async () => { await page.evaluate(() => document.fonts.ready) }

// Visible ink-filled pressables outside segmented controls, toolbars, tabs, switches, checkboxes and the rail.
const inkFilled = () => page.evaluate((ink) => [...document.querySelectorAll('.planning-root button, .planning-root a[href], .planning-root [role="button"]')]
  .filter((el) => {
    const rect = el.getBoundingClientRect()
    if (!rect.width || !rect.height || getComputedStyle(el).visibility === 'hidden') return false
    if (getComputedStyle(el).backgroundColor.replace(/\s+/g, '') !== ink) return false
    if (el.closest('[role="tablist"], [role="group"], [role="toolbar"], [role="radiogroup"], [role="menu"], [role="listbox"], nav')) return false
    return !el.matches('[aria-pressed], [aria-selected], [aria-current], [role="tab"], [role="checkbox"], [role="switch"]')
  })
  .map((el) => ({ id: el.id, text: el.textContent.trim().slice(0, 60) })), B.colors.ink)

const overflowAt = async (label) => {
  const original = page.viewportSize()
  for (const width of B.overflowWidths) {
    await page.setViewportSize({ width, height: original.height })
    const facts = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth - document.documentElement.clientWidth, body: document.body.scrollWidth - document.documentElement.clientWidth }))
    expectTrue(facts.doc <= 0 && facts.body <= 0, `${label} @${width}px: document horizontal overflow (${JSON.stringify(facts)})`)
  }
  await page.setViewportSize(original)
}

const assertEyebrowStyle = async (locator, label) => {
  const s = await styles(locator, ['fontFamily', 'fontSize', 'lineHeight', 'textTransform', 'letterSpacing', 'color'])
  expectTrue(s.fontFamily.includes(B.eyebrow.fontFamilyIncludes), `${label} eyebrow font-family includes ${B.eyebrow.fontFamilyIncludes} (got ${s.fontFamily})`)
  expect(px(s.fontSize), B.eyebrow.fontSizePx, `${label} eyebrow font-size`)
  expect(px(s.lineHeight), B.eyebrow.lineHeightPx, `${label} eyebrow line-height`)
  expect(s.textTransform, B.eyebrow.textTransform, `${label} eyebrow text-transform`)
  near(px(s.letterSpacing), px(B.eyebrow.letterSpacing), `${label} eyebrow letter-spacing`, 0.05)
  expect(color(s.color), B.eyebrow.color, `${label} eyebrow color`)
}

const assertPageHead = async (spec, label) => {
  expect(norm(await title.innerText()), spec.title, `${label} h1 copy`)
  const s = await styles(title, ['fontSize', 'lineHeight', 'fontWeight', 'letterSpacing', 'fontFamily'])
  expect(px(s.fontSize), B.title.fontSizePx, `${label} h1 font-size`)
  expect(px(s.lineHeight), B.title.lineHeightPx, `${label} h1 line-height`)
  expect(s.fontWeight, B.title.fontWeight, `${label} h1 font-weight`)
  near(px(s.letterSpacing), px(B.title.letterSpacing), `${label} h1 letter-spacing`, 0.05)
  expectTrue(s.fontFamily.includes(B.title.fontFamilyIncludes), `${label} h1 font-family includes ${B.title.fontFamilyIncludes} (got ${s.fontFamily})`)
  const eyebrow = title.locator('xpath=preceding-sibling::*[1]')
  expect(await eyebrow.count(), 1, `${label} eyebrow is the sibling immediately before #planning-page-title`)
  if (await eyebrow.count()) {
    await assertEyebrowStyle(eyebrow, label)
    return norm(await eyebrow.textContent())
  }
  return ''
}

const assertPrimaryStyle = async (label) => {
  const s = await styles(primary, ['backgroundColor', 'color', 'borderTopLeftRadius', 'fontSize', 'fontWeight', 'paddingTop', 'paddingLeft', 'fontFamily'])
  expect(color(s.backgroundColor), B.primary.background, `${label} primary background`)
  expect(color(s.color), B.primary.color, `${label} primary text color`)
  expectTrue(px(s.borderTopLeftRadius) >= B.primary.radiusMinPx, `${label} primary is a pill (radius ${s.borderTopLeftRadius} < ${B.primary.radiusMinPx}px)`)
  expect(px(s.fontSize), B.primary.fontSizePx, `${label} primary font-size`)
  expect(s.fontWeight, B.primary.fontWeight, `${label} primary font-weight`)
  expect(px(s.paddingTop), B.primary.paddingY, `${label} primary padding-y`)
  expect(px(s.paddingLeft), B.primary.paddingX, `${label} primary padding-x`)
  expectTrue(s.fontFamily.includes(B.primary.fontFamilyIncludes), `${label} primary font-family includes ${B.primary.fontFamilyIncludes}`)
  const ghost = await styles(page.locator('#planning-tour-save'), ['backgroundColor', 'borderTopLeftRadius'])
  expect(color(ghost.backgroundColor), B.ghost.background, `${label} Guardar (ghost) background`)
  expectTrue(px(ghost.borderTopLeftRadius) >= B.ghost.radiusMinPx, `${label} Guardar is a pill`)
}

const assertOnePrimary = async (label, { allowSelectAll = false, allowNone = false } = {}) => {
  // Contract (handoff §3 / DESIGN-v2 "one primary"): at most one `#planning-tour-primary` is visible per view. Zero is valid when
  // no action applies (e.g. Revisión/Aprobación without a saved proposal); then no ink-filled pressable may stand in for it.
  // The id also exists on hidden stage copies, so only the visible one counts.
  const visiblePrimaries = await page.locator('#planning-tour-primary:visible').count()
  if (allowNone && visiblePrimaries === 0) {
    const stray = (await inkFilled()).filter((item) => item.id !== 'planning-tour-primary')
    expectTrue(stray.length === 0, `${label} has no primary but shows ink-filled pressables: ${JSON.stringify(stray)}`)
    return
  }
  expect(visiblePrimaries, 1, `${label} visible #planning-tour-primary count`)
  const filled = await inkFilled()
  const extras = filled.filter((item) => item.id !== 'planning-tour-primary')
  const tolerated = allowSelectAll && B.tolerances.emptyStateSelectAllMayBeInk
    ? extras.filter((item) => B.stages.preparacion.selectAllButton.test(item.text)) : []
  if (tolerated.length) console.log(`  NOTE ${label}: tolerating a second ink pill (${tolerated[0].text}); see BOARD_SPEC.tolerances`)
  extras.splice(0, extras.length, ...extras.filter((item) => !tolerated.includes(item)))
  expectTrue(filled.some((item) => item.id === 'planning-tour-primary'), `${label} primary must be ink-filled (found ${JSON.stringify(filled)})`)
  expectTrue(extras.length === 0, `${label} has extra ink-filled primaries: ${JSON.stringify(extras)}`)
}

const assertFields = async (label) => {
  const fields = page.locator('#planning-main-content').locator(
    'input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]):not([type="file"]):not([type="button"]), select, [role="combobox"]')
  const visible = []
  for (const field of await fields.all()) {
    if (await field.isVisible() && await field.getAttribute('aria-invalid') !== 'true') visible.push(field)
  }
  for (const [index, field] of visible.entries()) {
    const name = await field.evaluate((el) => el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.id || el.tagName)
    const tag = `${label} field #${index + 1} (${name})`
    const s = await styles(field, ['borderTopLeftRadius', 'borderTopColor', 'borderTopWidth', 'backgroundColor'])
    // Review board: the simulated-role select is the one documented exception (`border-radius:9999px; height:28px`).
    const roleSelect = name === 'Rol simulado de revisión'
    near((await box(field)).height, roleSelect ? 28 : B.field.heightPx, `${tag} height`)
    if (roleSelect) expectTrue(px(s.borderTopLeftRadius) >= 9999, `${tag} is a pill (radius ${s.borderTopLeftRadius})`)
    else expect(px(s.borderTopLeftRadius), B.field.radiusPx, `${tag} radius`)
    expect(color(s.borderTopColor), B.field.borderColor, `${tag} border color`)
    expect(px(s.borderTopWidth), B.field.borderWidthPx, `${tag} border width`)
  }
  return visible.length
}

try {
  await page.goto(`${base.origin}${B.route}`, { waitUntil: 'networkidle' })
  await title.waitFor({ timeout: 45000 })
  await settle()

  // ---------------------------------------------------------------- shell chrome (fresh draft, Oferta de cursos)
  await criterion('theme-and-scope-bar', 'light default; scope bar 52px with board copy, switchers, chat toggle, ⌘K search and synthetic marker', async () => {
    expect(await root.getAttribute('data-theme'), 'light', 'default theme')
    const bar = root.locator('.planning-scope-header').first()
    expect(await bar.count(), 1, 'scope bar (.planning-scope-header)')
    expect(px((await styles(bar, ['height'])).height), B.scopeBar.heightPx, 'scope bar height')
    expectTrue((await bar.innerText()).includes(B.scopeBar.brand), `scope bar shows "${B.scopeBar.brand}"`)
    const switchers = bar.locator('button[aria-haspopup]')
    expectTrue(await switchers.count() >= 2, 'scope bar has the school/term and proposal switchers (button[aria-haspopup])')
    const proposals = page.locator(`#${B.scopeBar.proposalSwitcherId}`)
    expect(await proposals.getAttribute('aria-haspopup'), 'dialog', 'proposal switcher aria-haspopup')
    expectTrue(await bar.locator(`#${B.scopeBar.proposalSwitcherId}`).count() === 1, 'proposal switcher lives in the scope bar')
    const chip = bar.locator('.planning-scope-header__draft-state[data-draft-state]')
    expect(await chip.count(), 1, 'draft-state chip (.planning-scope-header__draft-state[data-draft-state])')
    if (await chip.count()) expect(await chip.getAttribute('role'), 'status', 'draft-state chip role')
    expectTrue(await bar.getByRole('textbox', { name: B.scopeBar.searchLabel }).count() === 1, `⌘K search labelled "${B.scopeBar.searchLabel}"`)
    expectTrue((await bar.innerText()).includes(B.scopeBar.searchShortcut), `search shows ${B.scopeBar.searchShortcut}`)
    expectTrue(await bar.getByRole('button', { name: B.scopeBar.guideButtonName, exact: true }).count() === 1, `"${B.scopeBar.guideButtonName}" icon button`)
    const chat = page.locator(`#${B.scopeBar.chatToggleId}`)
    expect(await chat.count(), 1, 'assistance toggle #planning-toggle-chat')
    expect(await chat.getAttribute('aria-pressed') !== null, true, 'assistance toggle exposes aria-pressed')
    expect(await page.locator('#planning-chat-body').isVisible(), false, 'assistance rail closed by default')
    expectTrue(await root.getByText(B.scopeBar.syntheticMarker, { exact: true }).first().isVisible(), `"${B.scopeBar.syntheticMarker}" marker visible`)
    // The scope bar sits above the rail and spans the page.
    const barBox = await bar.boundingBox()
    expectTrue(barBox !== null && barBox.y <= 1 && barBox.width >= B.viewport.width - 1, 'scope bar is the full-width top row')
  })

  await criterion('proposal-switcher-menu', '#planning-tour-proposal wraps the menu with the rename field; menu closes with Escape', async () => {
    expect(await page.locator('#planning-tour-proposal').isVisible(), false, 'proposal menu closed on load')
    await openProposalMenu(page)
    expect(await proposalTitleField(page).count(), 1, '#planning-proposal-title inside #planning-tour-proposal')
    expect(await proposalTitleField(page).getAttribute('id'), 'planning-proposal-title', 'rename field id')
    // textContent, not innerText: v2 renders field labels as uppercase mono eyebrows (text-transform), which innerText follows
    expectTrue((await page.locator('#planning-tour-proposal').textContent()).includes('Nombre de la propuesta') && await page.locator('#planning-tour-proposal').getByLabel('Nombre de la propuesta', { exact: true }).isVisible(), 'rename field label "Nombre de la propuesta"')
    await capture('proposal-menu-1440')
    await closeProposalMenu(page)
  })

  await criterion('stage-rail-copy-and-style', 'rail is 216px with board eyebrows, labels and order; no Resumen; current item is sand', async () => {
    const nav = root.locator(`nav[aria-label="${B.rail.ariaLabel}"]`)
    expect(await nav.count(), 1, `rail nav[aria-label="${B.rail.ariaLabel}"]`)
    near((await box(nav)).width, B.rail.widthPx, 'rail width')
    const entries = await nav.evaluate((el, eyebrows) => [...el.querySelectorAll('*')].flatMap((node) => {
      const text = node.textContent.replace(/\s+/g, ' ').trim()
      if (node.tagName === 'A') return [{ kind: 'link', text, current: node.getAttribute('aria-current') }]
      if (!node.closest('a') && node.children.length === 0 && eyebrows.includes(text)) return [{ kind: 'eyebrow', text }]
      return []
    }), B.rail.groups.map((group) => group.eyebrow))
    const clean = (text) => text.replace(/(?:\s+(?:✓|\d+|completado|pendientes?))+$/, '').trim()
    const sequence = entries.filter((entry) => !(entry.kind === 'link' && entry.text.includes('Módulos'))).map((entry) => clean(entry.text))
    const expected = B.rail.groups.flatMap((group) => [group.eyebrow, ...group.items])
    expect(JSON.stringify(sequence), JSON.stringify(expected), 'rail eyebrows and stage labels in board order')
    for (const forbidden of B.rail.forbiddenItems) expectTrue(!sequence.includes(forbidden), `rail has no "${forbidden}" destination`)
    expectTrue(await root.getByRole('link', { name: /Módulos/ }).first().isVisible(), `"${B.rail.moduleLink}" link visible`)
    for (const group of B.rail.groups) await assertEyebrowStyle(nav.getByText(group.eyebrow, { exact: true }).first(), `rail "${group.eyebrow}"`)

    const current = nav.locator('a[aria-current="page"]')
    expect(await current.count(), 1, 'exactly one current rail item')
    expect(clean(norm(await current.first().textContent())), B.stages.preparacion.label, 'fresh stack lands on Oferta de cursos')
    const currentStyle = await styles(current.first(), ['backgroundColor', 'color', 'borderTopLeftRadius', 'fontWeight'])
    expect(color(currentStyle.backgroundColor), B.rail.current.background, 'current item background')
    expect(color(currentStyle.color), B.rail.current.color, 'current item color')
    expectTrue(px(currentStyle.borderTopLeftRadius) >= B.rail.item.radiusMinPx, 'current item is a pill')
    const other = nav.locator('a:not([aria-current="page"])').filter({ hasText: B.stages.horario.label }).first()
    const otherStyle = await styles(other, ['backgroundColor', 'color', 'fontWeight'])
    expect(color(otherStyle.color), B.rail.item.color, 'inactive item color')
    expect(otherStyle.fontWeight, B.rail.item.fontWeight, 'inactive item font-weight')
    expectTrue(color(otherStyle.backgroundColor) !== B.rail.current.background, 'inactive item is not sand')
  })

  await criterion('oferta-fresh-page-head', 'Oferta de cursos page head matches Preparation board (h1, mono eyebrow, pill primary, ghost Guardar)', async () => {
    const spec = B.stages.preparacion
    const eyebrow = await assertPageHead(spec, 'Oferta de cursos')
    expect(eyebrow, spec.eyebrowFresh, 'Oferta de cursos eyebrow (fresh, ungenerated, unsaved)')
    await assertPrimaryStyle('Oferta de cursos')
    expect(norm(await page.locator('#planning-tour-save').innerText()), 'Guardar', 'Guardar label')
    const generationOptions = page.getByRole('button', { name: spec.secondaryLabels[0], exact: true })
    expectTrue(await generationOptions.count() === 1, `"${spec.secondaryLabels[0]}" ghost button`)
    await assertOnePrimary('Oferta de cursos (fresh)', { allowSelectAll: true })
    await capture('oferta-fresh-1440')
  })

  // ---------------------------------------------------------------- populate the offer (synthetic catalog)
  const selectAll = page.getByRole('button', { name: B.stages.preparacion.selectAllButton })
  if (await selectAll.count()) {
    await selectAll.first().click()
    await selectAll.first().waitFor({ state: 'detached' }).catch(() => {})
  }

  await criterion('oferta-readiness-strip', 'readiness strip is a role=status region with text, board copy, 12px radius and status colors', async () => {
    const spec = B.stages.preparacion
    const strip = page.getByRole('region', { name: spec.strip.ariaLabel })
    await strip.waitFor()
    const status = strip.getByRole('status').first()
    const label = norm((await status.innerText()).replace(/^[^\p{L}]+/u, ''))
    const state = Object.entries(spec.strip.states).find(([, value]) => value.label === label)
    expectTrue(Boolean(state), `strip status word is one of ${Object.values(spec.strip.states).map((item) => item.label).join(' | ')} (got "${label}")`)
    expectTrue(/\p{L}{4,}/u.test(label), 'status is conveyed as text, not color only')
    if (state) {
      const tone = B.statusColors[state[1].tone]
      // The region (`.planning-status-bar`) is the strip root hook; the board's surface (tint, 12px radius, 10/16 padding) is its
      // inner `.planning-status-bar__strip`, which is what the board values describe.
      const stripStyle = await styles(strip.locator('.planning-status-bar__strip').first(), ['backgroundColor', 'borderTopLeftRadius', 'paddingTop', 'paddingLeft'])
      expect(color(stripStyle.backgroundColor), tone.background, `strip background (${state[0]})`)
      expect(color((await styles(status, ['color'])).color), tone.color, `strip status color (${state[0]})`)
      expect(px(stripStyle.borderTopLeftRadius), B.strip.radiusPx, 'strip radius')
      expect(px(stripStyle.paddingTop), B.strip.paddingY, 'strip padding-y')
      expect(px(stripStyle.paddingLeft), B.strip.paddingX, 'strip padding-x')
      if (state[1].disclosure) expectTrue(await strip.getByRole('button', { name: state[1].disclosure, exact: true }).count() === 1, `"${state[1].disclosure}" disclosure in the ready state`)
    }
    expectTrue(spec.strip.factsPattern.test(norm(await strip.innerText())), `strip facts match ${spec.strip.factsPattern}`)
    await capture(`oferta-strip-${state ? state[0] : 'unknown'}-1440`)
  })

  await criterion('oferta-populated-primary-and-focus', 'single ink pill "Generar propuesta"; Tab reaches it and shows the 2px ink focus outline', async () => {
    const spec = B.stages.preparacion
    expect(norm(await primary.innerText()), spec.primaryLabel, 'primary label')
    await assertPrimaryStyle('Oferta de cursos (populated)')
    await assertOnePrimary('Oferta de cursos (populated)')
    expect(await primary.isEnabled(), true, 'primary enabled on the synthetic catalog (needed for the keyboard check)')
    await page.locator('body').click({ position: { x: 1, y: 1 } })
    let reached = false
    for (let i = 0; i < 120 && !reached; i += 1) {
      await page.keyboard.press('Tab')
      reached = await page.evaluate(() => document.activeElement?.id === 'planning-tour-primary')
    }
    expectTrue(reached, 'primary reachable by keyboard (Tab)')
    if (reached) {
      const s = await styles(primary, ['outlineStyle', 'outlineWidth', 'outlineColor', 'outlineOffset'])
      expect(s.outlineStyle, B.focus.outlineStyle, 'focus outline style')
      expect(px(s.outlineWidth), B.focus.outlineWidthPx, 'focus outline width')
      expect(color(s.outlineColor), B.focus.outlineColor, 'focus outline color')
      expect(px(s.outlineOffset), B.focus.outlineOffsetPx, 'focus outline offset')
    }
    await page.locator('body').click({ position: { x: 1, y: 1 } })
  })

  await criterion('oferta-fields', 'every visible field in the page is 32px high, 6px radius, 1px rgb(138,143,153) border', async () => {
    // v2: on a populated offer the course filters sit in the collapsed "Filtros y valores iniciales" disclosure and the demand
    // input lives in the course detail pane (Preparation board: "Demanda de planificación"). Open both so their fields are measured.
    await page.getByText('Filtros y valores iniciales', { exact: true }).click()
    await page.getByRole('button', { name: /^Inspeccionar / }).first().click()
    await page.getByRole('complementary', { name: /^Inspector de curso / }).waitFor()
    const count = await assertFields('Oferta de cursos')
    console.log(`  Oferta de cursos: ${count} field(s) checked`)
    expectTrue(count >= 1, 'at least one field (course search or demand input) is visible on Oferta de cursos')
  })

  await criterion('oferta-reflow', 'no document horizontal overflow at 360/720/1440 on Oferta de cursos', () => overflowAt('Oferta de cursos'))

  // ---------------------------------------------------------------- remaining stages
  await criterion('docentes-y-ambientes', 'copy, one primary, status text, fields and reflow on Docentes y ambientes', async () => {
    const spec = B.stages.recursos
    await gotoStage(page, spec.label, 'preparacion')
    await title.waitFor()
    await settle()
    const eyebrow = await assertPageHead(spec, spec.label)
    expectTrue(eyebrow.startsWith(spec.eyebrowPrefix), `${spec.label} eyebrow starts with "${spec.eyebrowPrefix}" (got "${eyebrow}")`)
    await assertOnePrimary(spec.label)
    await assertPrimaryStyle(spec.label)
    await assertFields(spec.label)
    expect(clean(norm(await root.locator(`nav[aria-label="${B.rail.ariaLabel}"] a[aria-current="page"]`).first().textContent())), spec.label, 'current rail item')
    await capture('docentes-ambientes-1440')
    await overflowAt(spec.label)
  })

  // Generate the proposal on the synthetic catalog, then check Horario.
  let generated = false
  await criterion('generate-proposal', 'Generar propuesta posts /propuestas and lands on Horario', async () => {
    await gotoStage(page, B.stages.preparacion.label, 'preparacion')
    const response = page.waitForResponse((res) => /\/propuestas$/.test(new URL(res.url()).pathname) && res.request().method() === 'POST', { timeout: 120000 })
    await primary.click()
    expect((await response).status(), 200, 'generation response status')
    await page.waitForURL((url) => url.searchParams.get('etapa') === 'horario', { timeout: 120000 })
    generated = true
  })

  if (generated) {
    await criterion('horario-fidelity', 'Horario head, result strip, filters and table match the Main board', async () => {
      const spec = B.stages.horario
      await title.waitFor()
      await settle()
      const eyebrow = await assertPageHead(spec, 'Horario')
      expectTrue(spec.eyebrowPattern.test(eyebrow), `Horario eyebrow matches ${spec.eyebrowPattern} (got "${eyebrow}")`)
      await assertOnePrimary('Horario')
      await assertPrimaryStyle('Horario')
      expect(norm(await page.locator('#planning-tour-save').innerText()), spec.saveLabel, 'Guardar label')

      // All stages stay mounted and the inactive ones are hidden: scope to the current stage's strip (handoff §3 hook).
      const strip = page.locator('.planning-status-bar[data-status]:visible')
      expect(await strip.count(), 1, 'visible result strip .planning-status-bar[data-status]')
      const word = page.locator('#academic-scheduling-result')
      expect(await word.getAttribute('role'), 'status', '#academic-scheduling-result role')
      expectTrue(/\p{L}{4,}/u.test(norm(await word.innerText())), 'result status is text, not color only')
      const stripStyle = await styles(strip.locator('.planning-status-bar__strip').first(), ['borderTopLeftRadius', 'paddingTop', 'paddingLeft', 'backgroundColor']) // inner surface, see oferta-readiness-strip
      expect(px(stripStyle.borderTopLeftRadius), B.strip.radiusPx, 'result strip radius')
      expect(px(stripStyle.paddingTop), B.strip.paddingY, 'result strip padding-y')
      expect(px(stripStyle.paddingLeft), B.strip.paddingX, 'result strip padding-x')
      const tones = Object.values(B.statusColors)
      expectTrue(tones.some((tone) => tone.background === color(stripStyle.backgroundColor)), `result strip background is a status tint (got ${stripStyle.backgroundColor})`)

      expectTrue(await page.getByPlaceholder(spec.searchPlaceholder, { exact: true }).count() === 1, `search placeholder "${spec.searchPlaceholder}"`)
      expectTrue(await page.getByRole('combobox', { name: spec.teacherFilterName }).count() >= 1 || await page.getByLabel(spec.teacherFilterName, { exact: true }).count() >= 1, `"${spec.teacherFilterName}" filter`)
      const group = page.getByRole('group', { name: spec.viewGroup.name, exact: true })
      expect(await group.count(), 1, 'view switch group "Vista"')
      for (const option of spec.viewGroup.options) expectTrue(await group.getByText(option, { exact: true }).count() === 1, `view option "${option}"`)

      const table = page.getByRole('table', { name: spec.tableName })
      expect(await table.count(), 1, `table "${spec.tableName}"`)
      const headers = (await table.locator('thead th').allTextContents()).map(norm)
      expect(JSON.stringify(headers), JSON.stringify(spec.columns), 'table column headers')
      await assertEyebrowStyle(table.locator('thead th').first(), 'table header')
      const stateColumn = spec.columns.indexOf('Estado')
      const cells = await table.locator(`tbody tr td:nth-child(${stateColumn + 1})`).allTextContents()
      expectTrue(cells.length > 0 && cells.every((text) => /\p{L}{4,}/u.test(norm(text))), 'every Estado cell carries a text label')
      expectTrue(await assertFields('Horario') >= 2, 'Horario toolbar exposes at least the search and teacher fields')
      await capture('horario-1440')
      await overflowAt('Horario')
    })
  }

  for (const key of ['revision', 'aprobacion']) {
    const spec = B.stages[key]
    await criterion(`${key}-fidelity`, `${spec.label}: copy, one primary, pill style, fields and reflow`, async () => {
      await gotoStage(page, spec.label, key)
      await title.waitFor()
      await settle()
      await assertPageHead(spec, spec.label)
      await assertOnePrimary(spec.label, { allowNone: true })
      if (await page.locator('#planning-tour-primary:visible').count()) await assertPrimaryStyle(spec.label)
      await assertFields(spec.label)
      await capture(`${key}-1440`)
      await overflowAt(spec.label)
    })
  }

  await criterion('no-browser-exceptions', 'no uncaught page errors during the run', async () => {
    expect(JSON.stringify(errors), '[]', 'page errors')
  })
} finally {
  await browser.close()
}

function clean(text) { return text.replace(/(?:\s+(?:✓|\d+|completado|pendientes?))+$/, '').trim() }

const failed = results.filter((result) => !result.passed)
console.log(`\n${results.length - failed.length}/${results.length} criteria passed`)
if (failed.length) {
  console.log(`Failed: ${failed.map((result) => result.id).join(', ')}`)
  process.exitCode = 1
}
assert.ok(results.length > 0, 'No criterion ran')
