import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const [baseUrl, outputDirectory] = process.argv.slice(2)
if (!baseUrl || !outputDirectory) throw new Error('用法：node tests/verify-home-ui.mjs <url> <截图目录>')
await mkdir(outputDirectory, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
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
    assert.equal(await page.getByText('XAU/USD', { exact: true }).count(), 0)
    assert.equal(await page.getByText('98号汽油').count(), 0)
    assert.equal(await page.getByText('0号柴油', { exact: true }).count(), 0)
    assert.equal(await page.locator('.brand-summary-item').count(), 4)
    assert.equal(await page.locator('.brand-row').count(), 0)
    assert.equal(await page.getByText('当前有效', { exact: true }).count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    assert.equal(await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight)
      const navigationTop = document.querySelector('.bottom-nav').getBoundingClientRect().top
      const detailBottom = document.querySelector('.brand-detail-link').getBoundingClientRect().bottom
      const fuelBottom = document.querySelector('.fuel-grid').getBoundingClientRect().bottom
      return detailBottom <= navigationTop && fuelBottom <= navigationTop
    }), true, '滚动到页面底部时，品牌详情入口和油价摘要不应被底部导航遮挡')
    assert.deepEqual(consoleErrors, [])
    await page.getByRole('button', { name: '金价' }).click()
    await assert.doesNotReject(() => page.getByRole('heading', { name: '国际与国内参考', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByText('USD/CNY', { exact: true }).waitFor())
    assert.equal(await page.getByText('当前有效', { exact: true }).count() > 0, true)
    await page.getByRole('button', { name: '油价' }).click()
    await assert.doesNotReject(() => page.getByRole('heading', { name: '广东油价', exact: true, level: 2 }).waitFor())
    assert.equal(await page.getByText('0号柴油', { exact: true }).count(), 1)
    await page.getByRole('button', { name: '首页' }).click()
    await page.screenshot({ path: resolve(outputDirectory, `home-${width}.png`), fullPage: true })
    await page.route('**/api/home', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }))
    await page.getByRole('button', { name: '刷新显示' }).click()
    await page.getByText('未能读取本地展示数据').waitFor()
    assert.equal(await page.getByRole('heading', { name: '金价摘要', exact: true }).count(), 1)
    await page.screenshot({ path: resolve(outputDirectory, `home-${width}-read-failure.png`), fullPage: true })
    await page.close()
  }
} finally {
  await browser.close()
}
