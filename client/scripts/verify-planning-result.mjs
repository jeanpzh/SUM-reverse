import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { createServer } from 'vite'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium } from 'playwright'

// Independently constructed synthetic data. No API, private fixtures or listening server.
const vite = await createServer({ configFile: false, envDir: false, root: new URL('..', import.meta.url).pathname,
  ssr: { external: true }, server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom' })
let browser
try {
  const { PlanningStatusBar } = await vite.ssrLoadModule('/src/screens/PlanningStatusBar.tsx')
  const proposal = { proposalId: 'synthetic-layout', editVersion: 0, status: 'search-limit',
    counts: { sections: 3, scheduledSessions: 2, requiredSessions: 4 },
    sections: ['a', 'b', 'c'].map(sectionId => ({ sectionId, courseId: 'synthetic-course' })),
    assignments: ['a', 'b'].map((sectionId, i) => ({ sectionId, teacherId: `synthetic-${i}`, roomId: `synthetic-${i}`, day: 1, startMinute: 480, endMinute: 540 })),
    pending: ['b', 'c'].map(sectionId => ({ sectionId, courseId: 'synthetic-course' })),
    diagnostics: [], stats: { exploredCandidates: 1, candidateVisits: 1, backtracks: 0 } }
  const render = (value) => renderToStaticMarkup(React.createElement(PlanningStatusBar, {
    proposal: value, academicPeriod: '2027-I', onReviewPending() {}, onRegenerate() {}, onApplyAdvisorPatches() {},
  }))
  const html = render(proposal)
  assert.match(html, /2 por completar/)
  assert.match(html, /Programación parcial/)
  // Retry consequences are disclosed in the confirmation after interaction.
  assert.doesNotMatch(html, /límite computacional/)
  assert.match(html, /Consultar consejero/)
  const complete = render({ ...proposal, status: 'complete', pending: [], sections: proposal.sections.slice(0, 2), counts: { ...proposal.counts, sections: 2 } })
  assert.match(complete, /Programación completa/)
  assert.doesNotMatch(complete, /Revisar \d+ pendientes/)
  assert.match(render({ ...proposal, status: 'invalid-input' }), /Entrada inválida/)
  const empty = render({ ...proposal, assignments: [], pending: proposal.sections.map(({ sectionId }) => ({ sectionId, courseId: 'synthetic-course' })) })
  assert.match(empty, /3 por completar/)
  const assets = new URL('../dist/assets/', import.meta.url)
  const names = (await readdir(assets)).filter(name => name.endsWith('.css')).sort((a, b) => Number(b.startsWith('index-')) - Number(a.startsWith('index-')))
  const css = (await Promise.all(names.map(name => readFile(new URL(name, assets), 'utf8')))).join('\n')
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  for (const width of [1440, 1100, 637, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.setContent(`<style>${css}</style><div class="planning-root" style="max-width:637px;margin:auto">${html}</div>`)
    const bounds = await page.locator('.planning-status-bar').boundingBox()
    const header = await page.locator('.planning-status-bar__strip').boundingBox()
    assert.ok(header.width > bounds.width - 60, `header uses available width at ${width}`)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `no overflow at ${width}`)
    const actions = page.locator('.planning-status-bar__actions button')
    assert.match(await actions.first().innerText(), /Consultar consejero/)
    for (const button of await actions.all()) assert.ok((await button.boundingBox()).height >= 32)
    await page.addStyleTag({ content: 'html { font-size: 200% }' })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `no overflow with enlarged text at ${width}`)
    console.log(`PASS synthetic result layout ${width}px, normal and enlarged text`)
  }
  console.log('PASS partial, complete, invalid-input and result strip layout')
} finally {
  await browser?.close()
  await vite.close()
}
