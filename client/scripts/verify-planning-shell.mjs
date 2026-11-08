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
    id: element.id,
    inHeader: Boolean(element.closest('.planning-scope-header')),
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

  await criterion('AC3', 'scheduling route renders inside the planning shell with A canvas, no rail, title and font', () => withPage(1440, 900, async (page) => {
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
        rails: document.querySelectorAll('nav.planning-rail').length,
        canvas: computed('.planning-root')?.backgroundColor ?? null,
        headingColor: heading?.color ?? null,
        headingSize: heading?.fontSize ?? null,
        rootFontSize: computed('.planning-root')?.fontSize ?? null,
      }
    })
    expectEqual(facts.planningRoots, 1, 'planning-root count')
    expectEqual(facts.mains, 1, 'main landmark count')
    expectEqual(facts.rails, 0, 'navigation rail count (removed 2026-11-08)')
    expectEqual(facts.canvas, 'rgb(245, 246, 245)', 'canvas background-color')
    expectEqual(facts.headingColor, 'rgb(32, 41, 37)', 'page title h2 color')
    expectEqual(facts.headingSize, '24px', 'page title h2 font-size')
    expectEqual(facts.rootFontSize, '14px', 'planning-root font-size')
    await page.screenshot({ path: join(evidenceDir, 'scheduling-1440.png') })
  }))

  await criterion('AC4', 'theme selector and back link live in the scope header, are keyboard reachable with a solid focus outline, and the back link navigates', () => withPage(1440, 900, async (page) => {
    await page.goto(scheduling, { waitUntil: 'networkidle' })
    const theme = page.locator('#planning-theme')
    await theme.focus()
    const first = await focusedFacts(page)
    await page.keyboard.press('Tab')
    const second = await focusedFacts(page)
    await page.screenshot({ path: join(evidenceDir, 'focus-header-controls-1440.png') })
    expectEqual(first.id, 'planning-theme', 'theme selector focus')
    expectTrue(first.inHeader, 'theme selector is outside the scope header')
    expectEqual(second.text, backLabel, 'Tab after the theme selector')
    expectTrue(second.inHeader, 'back link is outside the scope header')
    expectTrue(second.outlineStyle !== 'none' || second.outlineWidth > 0, 'back link has no visible focus indicator')
    const back = page.getByRole('link', { name: backLabel, exact: true })
    await back.click()
    await page.waitForURL(/\/local\/modulos$/)
    await page.waitForLoadState('networkidle')
    expectEqual(await page.locator('.planning-root').count(), 0, 'planning-root count after back link navigation')
  }))

  await criterion('AC5', 'at 800px the document does not scroll horizontally', () => withPage(800, 900, async (page) => {
    await page.goto(scheduling, { waitUntil: 'networkidle' })
    const facts = await page.evaluate(() => {
      const root = document.documentElement
      return {
        scrollWidth: root.scrollWidth,
        clientWidth: root.clientWidth,
      }
    })
    expectTrue(!(facts.scrollWidth > facts.clientWidth + 1), `document scrollWidth ${facts.scrollWidth} exceeds clientWidth ${facts.clientWidth}`)
    await page.screenshot({ path: join(evidenceDir, 'scheduling-800.png') })
  }))

  // Mobile width on every planning stage (route `?etapa=`). Asserts the document itself,
  // not inner scroll containers.
  await criterion('AC5-390', 'at 390px the document does not scroll horizontally on any planning stage', () => withPage(390, 844, async (page) => {
    for (const etapa of ['preparacion', 'horario', 'revision', 'aprobacion']) {
      await page.goto(`${scheduling}?etapa=${etapa}`, { waitUntil: 'networkidle' })
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
      expectTrue(scrollWidth <= 390, `stage ${etapa}: document scrollWidth ${scrollWidth} exceeds 390`)
      await page.screenshot({ path: join(evidenceDir, `scheduling-390-${etapa}.png`) })
    }
  }))

  // 200% text size checks only the shell. Screen panels inside main still overflow at
  // this size; that is a recorded slice-2 gap, not a shell failure.
  await criterion('ZOOM-TEXT', 'at 200% root text size the header controls do not overflow and the shell stays within the viewport', () => withPage(1440, 900, async (page) => {
    await page.goto(scheduling, { waitUntil: 'networkidle' })
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
    await page.waitForTimeout(200)
    const facts = await page.evaluate(() => ({
      items: [...document.querySelectorAll('.planning-shell-controls a, .planning-shell-controls label')].map((element) => ({
        text: element.textContent.trim(),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      })),
      viewport: document.documentElement.clientWidth,
      shellRight: Math.max(...['.planning-scope-header', '.planning-main'].map((selector) => document.querySelector(selector)?.getBoundingClientRect().right ?? Infinity)),
    }))
    expectEqual(facts.items.length, 2, 'header control label and link count')
    for (const item of facts.items) {
      expectTrue(item.scrollWidth <= item.clientWidth + 1, `"${item.text}" overflows: scrollWidth ${item.scrollWidth} > clientWidth ${item.clientWidth}`)
    }
    expectTrue(facts.shellRight <= facts.viewport + 1, `shell right edge ${facts.shellRight} exceeds viewport ${facts.viewport} at 200%`)
    await page.screenshot({ path: join(evidenceDir, 'zoom-200-1440.png') })
  }))

  // 200% browser zoom of a 1440px window leaves a 720px CSS viewport (WCAG reflow).
  await criterion('ZOOM-REFLOW', 'at 720px (200% page zoom of 1440px) the document does not scroll horizontally', () => withPage(720, 450, async (page) => {
    await page.goto(scheduling, { waitUntil: 'networkidle' })
    const facts = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expectTrue(facts.scrollWidth <= facts.clientWidth + 1, `document scrollWidth ${facts.scrollWidth} exceeds clientWidth ${facts.clientWidth}`)
    await page.screenshot({ path: join(evidenceDir, 'zoom-reflow-720.png') })
  }))
} finally {
  await browser.close()
}

const failed = results.filter((row) => !row.passed).length
console.log(`${results.length - failed}/${results.length} criteria passed; screenshots in ${evidenceDir}`)
if (failed) process.exitCode = 1
