import { browser } from 'k6/browser'
import { Counter } from 'k6/metrics'
import { check } from 'k6'

const browserStarted = new Counter('browser_runtime_smoke_started')

export const options = {
  scenarios: {
    chromium_startup: {
      executor: 'shared-iterations',
      vus: 1,
      iterations: 1,
      options: { browser: { type: 'chromium' } },
    },
  },
  thresholds: { browser_runtime_smoke_started: ['count==1'] },
}

export default async function () {
  let page
  try {
    page = await browser.newPage()
    await page.goto('about:blank')
    browserStarted.add(1)
    check(page, { 'Chromium opened a blank page': (value) => value !== null })
  } finally {
    if (page) await page.close()
  }
}
