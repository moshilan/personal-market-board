import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { chromium } from 'playwright'

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})

try {
  const page = await browser.newPage({ viewport: { width: 393, height: 844 } })
  await page.goto(pathToFileURL(resolve('public/index.html')).href, { waitUntil: 'networkidle' })
  await assert.doesNotReject(() => page.getByRole('heading', { name: '请从本地服务打开此看板', exact: true }).waitFor())
  assert.equal(await page.locator('link[rel="stylesheet"]').evaluate((node) => new URL(node.href).protocol), 'file:')
  assert.equal(await page.locator('body').evaluate((node) => getComputedStyle(node).backgroundColor), 'rgb(245, 242, 233)')
  assert.equal(await page.getByText('当前是直接打开的文件，无法读取本地行情数据').count(), 1)
  await page.close()
} finally {
  await browser.close()
}
