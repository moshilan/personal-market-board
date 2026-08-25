import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function playwrightModulePath() {
  if (process.env.PLAYWRIGHT_MODULE_PATH) return process.env.PLAYWRIGHT_MODULE_PATH
  const userProfile = process.env.USERPROFILE
  if (!userProfile) throw new Error('请设置PLAYWRIGHT_MODULE_PATH或USERPROFILE以定位Playwright')
  return resolve(userProfile, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright', 'index.mjs')
}

const modulePath = playwrightModulePath()
if (!existsSync(modulePath)) throw new Error('未找到Playwright，请设置PLAYWRIGHT_MODULE_PATH')
const { chromium } = await import(pathToFileURL(modulePath).href)

const [baseUrl, outputDirectory] = process.argv.slice(2)
if (!baseUrl || !outputDirectory) throw new Error('用法：node tests/verify-home-ui.mjs <url> <截图目录>')
await mkdir(outputDirectory, { recursive: true })

const chromePath = process.env.CHROME_EXECUTABLE_PATH
  ?? (process.env.ProgramFiles ? resolve(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe') : undefined)
const browser = await chromium.launch({ headless: true, ...(chromePath && existsSync(chromePath) ? { executablePath: chromePath } : {}) })
try {
  for (const width of [360, 393]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1 })
    const consoleErrors = []
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '刷新显示' }).click()
    await page.waitForLoadState('networkidle')
    await assert.doesNotReject(() => page.getByRole('heading', { name: '金价摘要', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '品牌金价', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '油价摘要', exact: true }).waitFor())
    assert.equal(await page.getByRole('heading', { name: '国际金价', exact: true }).count(), 1)
    assert.equal(await page.getByRole('heading', { name: '国内金价', exact: true }).count(), 1)
    assert.equal(await page.getByText('XAU/USD · 国际现货黄金', { exact: true }).count(), 1)
    assert.equal(await page.getByText('上金所 Au99.99', { exact: true }).count(), 1)
    assert.equal(await page.getByText('国际黄金人民币折算', { exact: true }).count(), 0)
    assert.equal(await page.getByText('国内外价差', { exact: true }).count(), 0)
    assert.equal(await page.getByText('USD/CNY', { exact: true }).count(), 0)
    assert.equal(await page.getByText('98号汽油').count(), 0)
    assert.equal(await page.getByText('0号柴油', { exact: true }).count(), 0)
    assert.equal(await page.locator('.brand-summary-item').count(), 4)
    assert.equal(await page.locator('.brand-row, .brand-detail-link').count(), 0)
    assert.equal(await page.getByText('当前有效', { exact: true }).count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    assert.equal(await page.evaluate(() => {
      const scroller = document.querySelector('.page-shell')
      scroller.scrollTop = scroller.scrollHeight
      const navigationTop = document.querySelector('.bottom-nav').getBoundingClientRect().top
      const brandBottom = document.querySelector('.brand-summary').getBoundingClientRect().bottom
      const fuelBottom = document.querySelector('.fuel-grid').getBoundingClientRect().bottom
      return brandBottom <= navigationTop && fuelBottom <= navigationTop
    }), true, '滚动到页面底部时，品牌摘要和油价摘要不应被底部导航遮挡')
    const snapshot = await page.evaluate(() => fetch('/api/home.json', { cache: 'no-store' }).then((response) => response.json()))
    const anomalousSnapshot = structuredClone(snapshot)
    anomalousSnapshot.views.home.gold[0].displayStatus = 'cached'
    anomalousSnapshot.views.home.gold[1].available = false
    anomalousSnapshot.views.home.gold[1].displayStatus = 'unavailable'
    anomalousSnapshot.views.home.gold[1].reason = '测试获取失败'
    await page.route('**/api/home.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(anomalousSnapshot) }))
    await page.getByRole('button', { name: '刷新显示' }).click()
    await assert.doesNotReject(() => page.getByText('缓存', { exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByText('获取失败', { exact: true }).waitFor())
    assert.equal(await page.getByText('当前有效', { exact: true }).count(), 0)
    await page.unroute('**/api/home.json')
    await page.getByRole('button', { name: '刷新显示' }).click()
    assert.deepEqual(consoleErrors, [])
    await page.getByRole('button', { name: '金价' }).click()
    await assert.doesNotReject(() => page.getByRole('heading', { name: '国际与国内参考', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '国际金价', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '美元兑人民币', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '国际金价折算', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByText('XAU/USD · 国际现货黄金', { exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByText('USD/CNY', { exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByText('折算人民币/克', { exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByText('上金所金价 - 国际折算价', { exact: true }).waitFor())
    assert.equal(await page.locator('.quote-heading h3').evaluateAll((headings) => headings.every((heading) => heading.scrollHeight <= heading.clientHeight)), true, '行情主标题不应在窄卡片内换行')
    await assert.doesNotReject(() => page.getByRole('heading', { name: '国内外价差', exact: true }).first().waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '金价趋势', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '国际与国内金价', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByText('历史数据积累中，目前仅有2条真实记录', { exact: true }).waitFor())
    await page.getByRole('button', { name: '30天', exact: true }).click()
    assert.equal(await page.getByRole('button', { name: '30天', exact: true }).getAttribute('aria-pressed'), 'true')
    assert.equal(await page.getByText('当前有效', { exact: true }).count(), 0)
    assert.equal(await page.evaluate(() => {
      const scroller = document.querySelector('.page-shell')
      scroller.scrollTop = scroller.scrollHeight
      const navigationTop = document.querySelector('.bottom-nav').getBoundingClientRect().top
      return document.querySelector('.brand-row:last-child').getBoundingClientRect().bottom <= navigationTop
    }), true, '金价页最后一个品牌不应被底部导航遮挡')
    await page.getByRole('button', { name: '油价' }).click()
    await assert.doesNotReject(() => page.getByRole('heading', { name: '广东最高零售价', exact: true, level: 2 }).waitFor())
    await assert.doesNotReject(() => page.getByText(/^当前执行：自.+起$/).waitFor())
    await assert.doesNotReject(() => page.getByText('来源：广东省发展改革委', { exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByText('政府最高零售价；各加油站实际售价可能更低。', { exact: true }).waitFor())
    assert.equal(await page.getByRole('heading', { name: '0号柴油', exact: true }).count(), 1)
    assert.equal(await page.locator('.fuel-detail .source-line').count(), 0)
    assert.equal(await page.locator('.fuel-detail .quote-meta').count(), 0)
    await assert.doesNotReject(() => page.getByRole('heading', { name: '油价调整记录', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByText('历史数据积累中，目前仅有3条真实记录', { exact: true }).waitFor())
    assert.equal(await page.evaluate(() => {
      const scroller = document.querySelector('.page-shell')
      scroller.scrollTop = scroller.scrollHeight
      const navigationTop = document.querySelector('.bottom-nav').getBoundingClientRect().top
      return document.querySelector('.fuel-card:last-child').getBoundingClientRect().bottom <= navigationTop
    }), true, '油价页最后一个油品不应被底部导航遮挡')
    await page.getByRole('button', { name: '首页' }).click()
    await page.screenshot({ path: resolve(outputDirectory, `home-${width}.png`), fullPage: true })
    await page.route('**/api/home.json', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }))
    await page.getByRole('button', { name: '刷新显示' }).click()
    await page.getByText('未能读取本地展示数据').waitFor()
    assert.equal(await page.getByRole('heading', { name: '金价摘要', exact: true }).count(), 1)
    await page.screenshot({ path: resolve(outputDirectory, `home-${width}-read-failure.png`), fullPage: true })
    await page.close()
  }
} finally {
  await browser.close()
}
