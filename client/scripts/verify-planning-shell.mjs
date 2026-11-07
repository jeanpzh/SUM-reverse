// Run only against an independently synthetic Compose acceptance project; never against production SUM.
import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

if (process.env.SUM_ACADEMIC_COMPOSE_SYNTHETIC !== '1') throw new Error('Se requiere una instancia propia explícitamente sintética')
const url = new URL(process.env.SUM_ACADEMIC_COMPOSE_BASE || 'http://127.0.0.1:5280')
if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error('Base local sin rutas ni credenciales requerida')
const base = url.origin
const evidenceDir = resolve(process.env.SUM_VERIFY_EVIDENCE_DIR || join(tmpdir(), 'sum-verify-planning-shell'))
const scheduling = `${base}/local/programacion-academica`
const backLabel = '← Módulos locales'
const results = []
const problems = []

const expectEqual = (actual, expected, label) => {
  if (actual !== expected) problems.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
}
const expectTrue = (condition, label) => {
  if (!condition) problems.push(label)
}
const criterion = async (id, description, check) => {
  problems.length = 0
  try {
    await check()
    if (problems.length) throw new Error(problems.join(' | '))
    results.push({ id, passed: true })
    console.log(`PASS ${id}: ${description}`)
  } catch (error) {
    results.push({ id, passed: false })
    console.log(`FAIL ${id}: ${description}: ${error.message.replace(/\s+/g, ' ').slice(0, 800)}`)
  }
}

await mkdir(evidenceDir, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || (existsSync('C:/Program Files/Google/Chrome/Application/chrome.exe') ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : undefined) })

const withPage = async (width, height, run) => {
  const page = await browser.newPage({ viewport: { width, height } })
  try {
    return await run(page)
  } finally {
    await page.close()
  }
}

const focusedFacts = (page) => page.evaluate(() => {
  const element = document.activeElement
  const style = getComputedStyle(element)
  return {
    text: element.textContent.trim(),
    inRail: Boolean(element.closest('nav.planning-rail')),
    outlineStyle: style.outlineStyle,
    outlineWidth: parseFloat(style.outlineWidth),
  }
})

try {
  await criterion('AC1', 'student routes and module chooser stay outside the planning shell', () => withPage(1440, 900, async (page) => {
    await page.goto(`${base}/local/login`, { waitUntil: 'networkidle' })
    await page.locator('input[name="scenario"]').first().check()
    await page.locator('input[name="profile"]').first().check()
    await page.getByRole('button', { name: 'Iniciar prueba', exact: true }).click()
    await page.waitForURL(/\/alumnoWebSum\/v2\/inicio$/)
    for (const path of ['/alumnoWebSum/v2/inicio', '/alumnoWebSum/v2/reportes/horarios', '/local/modulos']) {
      await page.goto(`${base}${path}`, { waitUntil: 'networkidle' })
      const state = await page.evaluate(() => {
        const main = document.querySelector('main')
        return {
          planningRoots: document.querySelectorAll('.planning-root').length,
          font: main ? getComputedStyle(main).fontFamily : null,
        }
      })
      expectEqual(state.planningRoots, 0, `${path} planning-root count`)
      expectTrue(state.font !== null && /Poppins/.test(state.font), `${path} main font-family is not Poppins (${state.font})`)
    }
  }))

  await criterion('AC3', 'scheduling route renders inside the planning shell with A canvas, rail, title and font', () => withPage(1440, 900, async (page) => {
    await page.goto(scheduling, { waitUntil: 'networkidle' })
    const facts = await page.evaluate(() => {
      const computed = (selector) => {
        const element = document.querySelector(selector)
        return element ? getComputedStyle(element) : null
      }
      const heading = computed('.page-title h2')
      return {
        planningRoots: document.querySelectorAll('.planning-root').length,
        mains: document.querySelectorAll('main').length,
        railLabel: document.querySelector('nav.planning-rail')?.getAttribute('aria-label') ?? null,
        current: document.querySelector('nav.planning-rail a[aria-current="page"]')?.textContent.trim() ?? null,
        canvas: computed('.planning-root')?.backgroundColor ?? null,
        railColor: computed('nav.planning-rail')?.backgroundColor ?? null,
        headingColor: heading?.color ?? null,
        headingSize: heading?.fontSize ?? null,
        rootFontSize: computed('.planning-root')?.fontSize ?? null,
      }
    })
    expectEqual(facts.planningRoots, 1, 'planning-root count')
    expectEqual(facts.mains, 1, 'main landmark count')
    expectEqual(facts.railLabel, 'Programación académica', 'rail aria-label')
    expectEqual(facts.current, 'Programaciones', 'active rail link text')
    expectEqual(facts.canvas, 'rgb(245, 246, 245)', 'canvas background-color')
    expectEqual(facts.railColor, 'rgb(32, 42, 37)', 'rail background-color')
    expectEqual(facts.headingColor, 'rgb(32, 41, 37)', 'page title h2 color')
    expectEqual(facts.headingSize, '24px', 'page title h2 font-size')
    expectEqual(facts.rootFontSize, '14px', 'planning-root font-size')
    await page.screenshot({ path: join(evidenceDir, 'scheduling-1440.png') })
  }))

  await criterion('AC4', 'rail is keyboard reachable with a solid focus outline; back link stays in view and navigates', () => withPage(1440, 900, async (page) => {
    await page.goto(scheduling, { waitUntil: 'networkidle' })
    await page.keyboard.press('Tab')
    const first = await focusedFacts(page)
    await page.screenshot({ path: join(evidenceDir, 'focus-first-tab-1440.png') })
    await page.keyboard.press('Tab')
    const second = await focusedFacts(page)
    expectEqual(first.text, 'Programaciones', 'first Tab target')
    expectTrue(first.inRail, 'first Tab target is outside nav.planning-rail')
    expectEqual(first.outlineStyle, 'solid', 'first Tab outline-style')
    expectTrue(first.outlineWidth > 0, `first Tab outline-width is ${first.outlineWidth}`)
    expectEqual(second.text, backLabel, 'second Tab target')
    expectEqual(second.outlineStyle, 'solid', 'second Tab outline-style')
    expectTrue(second.outlineWidth > 0, `second Tab outline-width is ${second.outlineWidth}`)

    await page.evaluate(() => window.scrollTo(0, 6000))
    await page.waitForTimeout(200)
    const scrollY = await page.evaluate(() => window.scrollY)
    const back = page.getByRole('link', { name: backLabel, exact: true })
    const box = await back.boundingBox()
    const viewport = page.viewportSize()
    expectTrue(box !== null && box.y >= 0 && box.y + box.height <= viewport.height,
      `back link box ${JSON.stringify(box)} not inside ${viewport.height}px viewport at scrollY ${scrollY}`)
    await page.screenshot({ path: join(evidenceDir, 'scrolled-back-link-1440.png') })

    await back.click()
    await page.waitForURL(/\/local\/modulos$/)
    await page.waitForLoadState('networkidle')
    expectEqual(await page.locator('.planning-root').count(), 0, 'planning-root count after back link navigation')
  }))

  await criterion('AC5', 'at 800px the rail is a top bar of under 120px and the document does not scroll horizontally', () => withPage(800, 900, async (page) => {
    await page.goto(scheduling, { waitUntil: 'networkidle' })
    const facts = await page.evaluate(() => {
      const root = document.documentElement
      const rail = document.querySelector('nav.planning-rail')
      return {
        scrollWidth: root.scrollWidth,
        clientWidth: root.clientWidth,
        railHeight: rail ? rail.getBoundingClientRect().height : null,
      }
    })
    expectTrue(!(facts.scrollWidth > facts.clientWidth + 1), `document scrollWidth ${facts.scrollWidth} exceeds clientWidth ${facts.clientWidth}`)
    expectTrue(facts.railHeight !== null && facts.railHeight < 120, `rail height is ${facts.railHeight}px`)
    await page.screenshot({ path: join(evidenceDir, 'scheduling-800.png') })
  }))

  await criterion('ZOOM', 'at 200% root text size rail links and product name do not overflow and the document does not scroll horizontally', () => withPage(1440, 900, async (page) => {
    await page.goto(scheduling, { waitUntil: 'networkidle' })
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
    await page.waitForTimeout(200)
    const facts = await page.evaluate(() => ({
      items: [...document.querySelectorAll('.planning-rail a, .planning-rail__product')].map((element) => ({
        text: element.textContent.trim(),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      })),
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
    }))
    expectEqual(facts.items.length, 3, 'rail link and product name count')
    for (const item of facts.items) {
      expectTrue(item.scrollWidth <= item.clientWidth + 1, `"${item.text}" overflows: scrollWidth ${item.scrollWidth} > clientWidth ${item.clientWidth}`)
    }
    expectTrue(facts.documentScrollWidth <= facts.documentClientWidth + 1, `document scrollWidth ${facts.documentScrollWidth} exceeds clientWidth ${facts.documentClientWidth} at 200%`)
    await page.screenshot({ path: join(evidenceDir, 'zoom-200-1440.png') })
  }))
} finally {
  await browser.close()
}

const failed = results.filter((row) => !row.passed).length
console.log(`${results.length - failed}/${results.length} criteria passed; screenshots in ${evidenceDir}`)
if (failed) process.exitCode = 1
