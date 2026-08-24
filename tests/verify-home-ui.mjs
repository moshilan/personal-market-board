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
    await assert.doesNotReject(() => page.getByRole('heading', { name: '黄金', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '品牌金价', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '广东油价', exact: true }).waitFor())
    assert.equal(await page.getByText('98号汽油').count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    assert.deepEqual(consoleErrors, [])
    await page.screenshot({ path: resolve(outputDirectory, `home-${width}.png`), fullPage: true })
    await page.close()
  }
} finally {
  await browser.close()
}
