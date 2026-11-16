// Shared Playwright helpers for the Planning v2 shell (docs/design/academic-planning-2026-11-16/handoff.md §3).
// Synthetic stacks only. Prefer role/name selectors and the stable ids listed in the handoff.
//
// v2 shell facts these helpers rely on (the UI worker must honour them):
//  - Stage rail: <nav aria-label="Etapas de la propuesta"> with one link per stage; the accessible name
//    starts with the stage label and may be followed by a count or a "completado" mark.
//  - URL keeps `?etapa=<stage>[&vista=<view>]` (preparacion|horario|revision|aprobacion; cursos|recursos).
//  - `#planning-tour-proposals` (scope-bar switcher button) opens a menu/dialog whose container is
//    `#planning-tour-proposal` and which holds the rename field `#planning-proposal-title`
//    (label "Nombre de la propuesta") and the saved-proposals list (`#academic-scheduling-saved-proposals`,
//    rows `.academic-scheduling__saved-row`, dialog name "Mis propuestas" when it is a dialog).
//  - Resumen is no longer a destination: the readiness strip lives on "Oferta de cursos".

export const STAGE_LABELS = Object.freeze({
  preparacion: 'Oferta de cursos',
  recursos: 'Docentes y ambientes',
  horario: 'Horario',
  revision: 'Revisión docente',
  aprobacion: 'Aprobación y publicación',
})

// Maps legacy names used by older scripts to the v2 stage label. 'Preparación' and 'Resumen' land on
// "Oferta de cursos" (the readiness strip replaced Resumen).
const LEGACY_LABELS = Object.freeze({ 'Preparación': 'Oferta de cursos', Resumen: 'Oferta de cursos', Cursos: 'Oferta de cursos' })

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export const stageLabel = (name) => LEGACY_LABELS[name] ?? name

export const RAIL_NAME = 'Etapas de la propuesta'

/** Link in the stage rail (scoped to the rail nav); tolerates a trailing count/"completado" in the name. */
export function stageLink(page, name) {
  const label = stageLabel(name)
  return page.locator('.planning-root').locator(`nav[aria-label="${RAIL_NAME}"]`).getByRole('link', {
    name: new RegExp(`^(?:✓\\s*)?${escapeRegExp(label)}(?:[\\s,]|$)`),
  }).first()
}

/**
 * Click a stage in the rail, then wait until that same link is the current page. Oferta de cursos and
 * Docentes y ambientes share `etapa=preparacion`, so the URL alone cannot tell the navigation finished.
 * Pass `etapa` to also assert the route.
 */
export async function gotoStage(page, name, etapa) {
  const link = stageLink(page, name)
  await link.click()
  await link.and(page.locator('[aria-current="page"]')).waitFor() // re-queried, so it survives a re-render
  if (etapa) await page.waitForURL(new RegExp(`etapa=${etapa}(?:&|$)`))
}

/**
 * The result strip of the CURRENT stage (`.planning-status-bar[data-status]`, handoff §3). All stages stay mounted and the
 * inactive ones are hidden, so an unscoped `.planning-status-bar` locator matches several strips (strict-mode violation).
 */
export const statusBar = (page) => page.locator('.planning-status-bar[data-status]:visible')

/** The proposal switcher's container (`#planning-tour-proposal`); only present while the menu is open. */
export const proposalMenu = (page) => page.locator('#planning-tour-proposal')
export const proposalTitleField = (page) => proposalMenu(page).locator('#planning-proposal-title')

export async function openProposalMenu(page) {
  const trigger = page.locator('#planning-tour-proposals')
  if (!await proposalMenu(page).isVisible()) await trigger.click()
  await proposalMenu(page).waitFor({ state: 'visible' })
  return proposalMenu(page)
}

export async function closeProposalMenu(page) {
  if (!await proposalMenu(page).isVisible()) return
  await page.keyboard.press('Escape')
  if (await proposalMenu(page).isVisible()) await page.locator('#planning-tour-proposals').click()
  await proposalMenu(page).waitFor({ state: 'hidden' })
}

/** Fills the rename field inside the proposal switcher menu and closes the menu. */
export async function setProposalTitle(page, title) {
  await openProposalMenu(page)
  await proposalTitleField(page).fill(title)
  await closeProposalMenu(page)
}

export async function readProposalTitle(page) {
  await openProposalMenu(page)
  const value = await proposalTitleField(page).inputValue()
  await closeProposalMenu(page)
  return value
}

export async function isProposalTitleDisabled(page) {
  await openProposalMenu(page)
  const disabled = await proposalTitleField(page).isDisabled()
  await closeProposalMenu(page)
  return disabled
}

/** Saved-proposals row for `title` inside the open proposal switcher. */
export async function savedProposalRow(page, title) {
  await openProposalMenu(page)
  return page.locator('.academic-scheduling__saved-row').filter({ hasText: title })
}

/**
 * Opens the assistance rail (≥1280px) or Sheet (<1280px) from the scope bar and selects a tab.
 * The rail is closed by default (handoff §1) and holds two tabs: "Consejero" and "Normativa". The normative
 * question field exists only while the Normativa tab is mounted; the advisor only while Consejero is.
 */
export async function openAssistance(page, tab) {
  const body = page.locator('#planning-chat-body')
  if (!await body.isVisible()) await page.locator('#planning-toggle-chat').click()
  await body.waitFor({ state: 'visible' })
  if (tab) {
    const control = page.getByRole('tab', { name: tab, exact: true })
    if (await control.getAttribute('aria-selected') !== 'true') await control.click()
    await control.and(page.locator('[aria-selected="true"]')).waitFor()
  }
  return body
}

export const openNormativa = (page) => openAssistance(page, 'Normativa')
export const openConsejero = (page) => openAssistance(page, 'Consejero')
