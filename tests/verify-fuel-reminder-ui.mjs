import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const { chromium } = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH ?? resolve(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href)
const [baseUrl, output] = process.argv.slice(2)
if (!baseUrl || !output) throw Error('用法：node tests/verify-fuel-reminder-ui.mjs <url> <截图目录>')
await mkdir(output, { recursive: true })
const executablePath = process.env.CHROME_EXECUTABLE_PATH ?? resolve(process.env.ProgramFiles, 'Google/Chrome/Application/chrome.exe')
const browser = await chromium.launch({ headless: true, ...(existsSync(executablePath) ? { executablePath } : {}) })
try {
  for (const width of [360, 393]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true })
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.clock.install({ time: new Date('2026-10-30T04:00:00Z') })
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    const snapshot = await page.evaluate(() => fetch('/api/home.json').then((response) => response.json()))
    let fixture = structuredClone(snapshot)
    await page.route('**/api/home.json', (route) => route.fulfill({ json: fixture }))
    const refresh = async () => {
      const [response] = await Promise.all([page.waitForResponse('**/api/home.json'), page.getByRole('button', { name: '刷新显示' }).click()])
      await response.finished()
      await page.waitForFunction(() => !document.querySelector('.display-refresh').disabled)
    }
    await refresh()
    assert.match(await page.locator('.fuel-upcoming-summary').innerText(), /下一轮调价窗口：2026-11-12/)
    await page.getByRole('button', { name: '油价', exact: true }).click()
    assert.match(await page.locator('.fuel-upcoming').innerText(), /不代表必然调价/)
    await page.screenshot({ path: resolve(output, `fuel-planned-${width}.png`), fullPage: true })

    for (const view of [fixture.views.home, fixture.views.fuel]) view.fuelReminder.prediction = {
      windowDate: '2026-11-12', direction: 'up', publishedAt: '2026-10-30T02:36:31Z', collectedAt: '2026-10-30T04:00:00Z',
      sourceUrl: 'https://energy.cngold.org/c/2026-10-30/c10848406.html', sourceName: '金投原油网（综合资讯）', title: '测试媒体预计上涨',
    }
    await refresh()
    assert.match(await page.locator('.fuel-upcoming').innerText(), /预计上涨，非官方结果/)
    assert.doesNotMatch(await page.locator('.fuel-upcoming').innerText(), /生效前加油/)
    assert.match(await page.locator('.fuel-upcoming').innerText(), /发布时间/)
    await page.screenshot({ path: resolve(output, `fuel-prediction-${width}.png`), fullPage: true })
    await page.clock.fastForward(86_400_000)
    assert.doesNotMatch(await page.locator('.fuel-upcoming').innerText(), /预计上涨/)

    for (const view of [fixture.views.home, fixture.views.fuel]) {
      view.upcomingFuel = {
        status: 'upcoming', effectiveFrom: '2026-11-12T16:00:00Z', collectedAt: '2026-11-12T08:00:00Z',
        sourceUrl: 'https://drc.gd.gov.cn/spjg/content/post_999.html', prices: { '92号汽油': 9.1, '95号汽油': 9.9, '0号柴油': 8.7 },
      }
    }
    await refresh()
    assert.match(await page.locator('.fuel-upcoming').innerText(), /官方已公告：上涨/)
    assert.match(await page.locator('.fuel-upcoming').innerText(), /生效前加油/)
    assert.equal(await page.locator('.fuel-upcoming-row').count(), 3)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, '官方上涨提示必须在移动端换行')
    await page.screenshot({ path: resolve(output, `fuel-official-${width}.png`), fullPage: true })
    await page.clock.setSystemTime(new Date('2026-11-12T15:59:59Z'))
    await refresh()
    await page.clock.fastForward(2000)
    assert.equal(await page.locator('.fuel-upcoming-row').count(), 0)
    assert.match(await page.locator('.fuel-upcoming').innerText(), /2026-11-26/)
    assert.match(await page.locator('.fuel-detail').first().innerText(), /9.10/)
    assert.doesNotMatch(await page.locator('.fuel-upcoming').innerText(), /生效前加油/)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.screenshot({ path: resolve(output, `fuel-effective-${width}.png`), fullPage: true })
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('360px、393px：计划、媒体预测、预测过期、官方上涨、生效切价及下一窗口验收通过')
} finally { await browser.close() }
