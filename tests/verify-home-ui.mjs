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

async function assertBottomNavigation(page) {
  assert.equal(await page.evaluate(() => {
    const navigation = document.querySelector('.bottom-nav').getBoundingClientRect()
    const shell = document.querySelector('.page-shell').getBoundingClientRect()
    return Math.abs(navigation.bottom - window.innerHeight) < 1 && Math.abs(shell.bottom - navigation.top) < 1
  }), true, '底部导航应贴住视口底部，滚动区域应止于导航上方')
}

try {
  for (const width of [360, 393]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 1 })
    const consoleErrors = []
    const thirdPartyRequests = []
    page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    page.on('request', (request) => { if (/exchangerate\.fun|currencyexchangetool\.com/.test(request.url())) thirdPartyRequests.push(request.url()) })
    await page.goto(baseUrl, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '刷新显示' }).click()
    await page.waitForLoadState('networkidle')
    await assert.doesNotReject(() => page.getByRole('heading', { name: '黄金摘要', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '白银摘要', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '品牌黄金', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '油价摘要', exact: true }).waitFor())
    assert.equal(await page.locator('#page-kicker').isHidden(), true)
    assert.equal(await page.locator('.topbar').evaluate((topbar) => topbar.classList.contains('home-topbar')), true)
    assert.match(await page.locator('#collection-status').innerText(), /^今日采集状态\s+(已更新 · \d{2}:\d{2}|待更新|数据异常)$/)
    assert.equal(await page.locator('#collection-status').evaluate((status) => {
      const refresh = document.querySelector('.display-refresh').getBoundingClientRect()
      const rectangle = status.getBoundingClientRect()
      return rectangle.left < refresh.left
        && rectangle.right <= refresh.left
        && Math.abs((rectangle.top + rectangle.height / 2) - (refresh.top + refresh.height / 2)) < 1
    }), true, '首页采集状态应在刷新显示按钮左侧且同一行')
    await assertBottomNavigation(page)
    assert.equal(await page.getByRole('heading', { name: '国际黄金', exact: true }).count(), 1)
    assert.equal(await page.getByRole('heading', { name: '国内黄金', exact: true }).count(), 1)
    assert.equal(await page.getByText('折算人民币/克', { exact: true }).count(), 0)
    assert.equal(await page.getByText('上金所 Au99.99', { exact: true }).count(), 1)
    assert.equal(await page.getByText('国际黄金人民币折算', { exact: true }).count(), 0)
    assert.equal(await page.getByText('国内外价差', { exact: true }).count(), 0)
    assert.equal(await page.getByText('USD/CNY', { exact: true }).count(), 0)
    assert.equal(await page.getByRole('heading', { name: '国际白银', exact: true }).count(), 1)
    assert.equal(await page.getByText('国际白银折算', { exact: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: '首页' }).getAttribute('aria-current'), 'page')
    assert.equal(await page.getByText('98号汽油').count(), 0)
    assert.equal(await page.getByText('0号柴油', { exact: true }).count(), 0)
    assert.equal(await page.locator('.brand-summary-item').count(), 4)
    assert.equal(await page.locator('.brand-summary-meta').count(), 0)
    assert.equal(await page.locator('.brand-row, .brand-detail-link').count(), 0)
    assert.equal(await page.getByText('当前有效', { exact: true }).count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    assert.equal(await page.locator('.fuel-summary').evaluateAll((items) => {
      const rectangles = items.map((item) => item.getBoundingClientRect())
      return rectangles.length === 2 && rectangles.every((rectangle) => rectangle.top === rectangles[0].top && rectangle.height === rectangles[0].height)
    }), true, '首页油价摘要卡应同一行且等高')
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
    anomalousSnapshot.views.home.xauUsd.displayStatus = 'cached'
    anomalousSnapshot.views.home.gold[1].available = false
    anomalousSnapshot.views.home.gold[1].displayStatus = 'unavailable'
    anomalousSnapshot.views.home.gold[1].reason = '测试获取失败'
    await page.route('**/api/home.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(anomalousSnapshot) }))
    await page.getByRole('button', { name: '刷新显示' }).click()
    await assert.doesNotReject(() => page.getByText('部分数据来自最近一次有效缓存', { exact: true }).first().waitFor())
    assert.equal(await page.locator('.quote-card .status-cached, .brand-summary-item .status-cached').count(), 0)
    await assert.doesNotReject(() => page.getByText('获取失败', { exact: true }).waitFor())
    assert.equal(await page.getByText('当前有效', { exact: true }).count(), 0)
    assert.equal(await page.locator('.fuel-section .quote-meta').count(), 0)
    await page.unroute('**/api/home.json')
    await page.getByRole('button', { name: '刷新显示' }).click()
    assert.deepEqual(consoleErrors, [])
    await page.getByRole('button', { name: '黄金' }).click()
    assert.equal(await page.locator('#collection-status').isHidden(), true, '金价页不应显示今日采集状态')
    assert.equal(await page.getByText('国际、国内与品牌黄金', { exact: true }).isVisible(), true)
    await assertBottomNavigation(page)
    await assert.doesNotReject(() => page.getByRole('heading', { name: '黄金参考', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '国际黄金', exact: true }).waitFor())
    assert.equal(await page.getByRole('heading', { name: '美元兑人民币', exact: true }).count(), 1)
    await assert.doesNotReject(() => page.getByRole('heading', { name: '国际黄金折算', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByText(/XAU\/USD ·/).waitFor())
    await assert.doesNotReject(() => page.getByText('USD/CNY', { exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByText('美元/盎司', { exact: true }).waitFor())
    assert.equal(await page.getByText('CNY/美元', { exact: true }).count(), 0)
    await assert.doesNotReject(() => page.getByText('折算人民币/克', { exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByText('上金所金价 - 国际折算价', { exact: true }).waitFor())
    assert.equal(await page.locator('.quote-heading h3').evaluateAll((headings) => headings.every((heading) => heading.scrollHeight <= heading.clientHeight)), true, '行情主标题不应在窄卡片内换行')
    await assert.doesNotReject(() => page.getByRole('heading', { name: '国内外价差', exact: true }).first().waitFor())
    assert.equal(await page.locator('.gold-spread .spread-values').count(), 1)
    assert.equal(await page.locator('.gold-spread .spread-percent-value').count(), 1)
    assert.equal(await page.locator('.gold-spread .spread-unit').count(), 1)
    assert.equal(await page.locator('.gold-spread .spread-context').count(), 1)
    assert.equal(await page.locator('.gold-spread .spread-heading-note').count(), 1)
    await assert.doesNotReject(() => page.getByRole('heading', { name: '黄金趋势', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '国际与国内黄金', exact: true }).waitFor())
    assert.equal(await page.locator('.trend-note').count() > 0, true)
    const goldTrendRange = page.locator('.trend-card').nth(0).getByRole('button', { name: '30天', exact: true })
    await goldTrendRange.click()
    assert.equal(await goldTrendRange.getAttribute('aria-pressed'), 'true')
    const singlePointTrendSnapshot = structuredClone(snapshot)
    const trendTimestamp = snapshot.collectedAt
    const trendDate = trendTimestamp.slice(0, 10)
    const currentGold = Object.fromEntries(snapshot.views.gold.gold.map((item) => [item.assetId, item]))
    singlePointTrendSnapshot.history = [
      { assetId: 'international-gold-cny-gram', value: currentGold['international-gold-cny-gram'].value, percentage: null, date: trendDate, timestamp: trendTimestamp, observedAt: trendTimestamp, collectedAt: trendTimestamp },
      { assetId: 'au9999', value: currentGold.au9999.value, percentage: null, date: trendDate, timestamp: trendTimestamp, observedAt: trendTimestamp, collectedAt: trendTimestamp },
      { assetId: 'domestic-international-gold-spread', value: currentGold['domestic-international-gold-spread'].value, percentage: currentGold['domestic-international-gold-spread'].percentage, date: trendDate, timestamp: trendTimestamp, observedAt: trendTimestamp, collectedAt: trendTimestamp },
    ]
    await page.route('**/api/home.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(singlePointTrendSnapshot) }))
    await page.getByRole('button', { name: '刷新显示' }).click()
    await assert.doesNotReject(() => page.getByText('当前仅有1条历史记录，数据积累中', { exact: true }).waitFor())
    const singlePointGoldDots = await page.locator('.trend-card').nth(0).locator('.trend-dot').evaluateAll((dots) => dots.map((dot) => dot.getAttribute('fill')))
    assert.equal(singlePointGoldDots.filter((color) => color === '#205c50').length >= 1, true)
    assert.equal(singlePointGoldDots.filter((color) => color === '#a96f17').length >= 1, true)
    assert.equal(await page.locator('.trend-card').nth(1).locator('.trend-dot').count() >= 1, true)
    await assert.doesNotReject(() => page.getByText('历史数据积累中，国际黄金折算1条，国内黄金1条', { exact: true }).waitFor())
    assert.equal(await page.locator('.trend-card').nth(0).locator('.trend-axis-label').evaluateAll((labels) => labels.filter((label) => /^\d+\/\d+$/.test(label.textContent)).length), 1)
    await page.unroute('**/api/home.json')
    await page.getByRole('button', { name: '刷新显示' }).click()
    assert.equal(await page.getByText('当前有效', { exact: true }).count(), 0)
    assert.equal(await page.getByText('来源：公式计算', { exact: true }).count(), 0)
    assert.equal(await page.getByText('来源：上海黄金交易所', { exact: true }).count(), 0)
    await assert.doesNotReject(() => page.getByText(/gold-api\.com/).waitFor())
    assert.equal(await page.locator('.source-line').evaluateAll((items) => items.every((item) => !item.textContent.includes('来源：'))), true)
    assert.equal(await page.locator('.brand-detail .brand-main').count(), 4)
    assert.equal(await page.locator('.brand-detail .brand-meta').count(), 4)
    assert.equal(await page.locator('.brand-detail .source-line').count(), 0)
    assert.equal(await page.locator('.brand-detail .brand-main').evaluateAll((items) => items.every((item) => item.scrollWidth <= item.clientWidth)), true, '品牌黄金首行不应横向溢出')
    await assert.doesNotReject(() => page.getByRole('heading', { name: '品牌黄金趋势', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '四品牌黄金', exact: true }).waitFor())
    assert.equal(await page.locator('.brand-trend-section .trend-legend-item').count(), 4)
    assert.equal(await page.locator('.brand-trend-section .trend-dot').count(), snapshot.brandHistory.length)
    assert.equal(await page.locator('.brand-trend-section').evaluate((section) => section.scrollWidth <= section.clientWidth), true, '品牌趋势图不应横向溢出')
    assert.equal(await page.evaluate(() => {
      const scroller = document.querySelector('.page-shell')
      scroller.scrollTop = scroller.scrollHeight
      const navigationTop = document.querySelector('.bottom-nav').getBoundingClientRect().top
      return document.querySelector('.brand-row:last-child').getBoundingClientRect().bottom <= navigationTop
    }), true, '金价页最后一个品牌不应被底部导航遮挡')
    await page.getByRole('button', { name: '白银' }).click()
    assert.equal(await page.locator('#collection-status').isHidden(), true, '白银页不应显示今日采集状态')
    assert.equal(await page.locator('#page-title').textContent(), '白银')
    assert.equal(await page.getByRole('button', { name: '白银' }).getAttribute('aria-current'), 'page')
    await assertBottomNavigation(page)
    await assert.doesNotReject(() => page.getByRole('heading', { name: '白银参考', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '国际白银折算', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '国内白银', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '国内外价差', exact: true }).first().waitFor())
    await assert.doesNotReject(() => page.getByText('XAG/USD', { exact: true }).waitFor())
    assert.equal(await page.getByText('USD/CNY', { exact: true }).count(), 0)
    await assert.doesNotReject(() => page.getByText('美元/盎司', { exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByRole('heading', { name: '白银趋势', exact: true }).waitFor())
    assert.equal(await page.getByText('当前有效', { exact: true }).count(), 0)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    await page.getByRole('button', { name: '汇率' }).click()
    assert.equal(await page.getByRole('heading', { name: '汇率', exact: true }).count(), 1)
    assert.equal(await page.locator('.bottom-nav button').count(), 5)
    assert.equal(await page.locator('.exchange-select').count(), 2)
    assert.equal(await page.getByRole('button', { name: '交换币种' }).count(), 1)
    assert.equal(await page.getByRole('button', { name: '交换币种' }).innerText(), '⇄')
    assert.match(await page.locator('.exchange-source').innerText(), /^来源：(ExchangeRate\.fun|Currency Exchange Tool) · 更新时间：8月30日 \d{1,2}:\d{2}$/)
    assert.equal(await page.locator('.exchange-row').count(), 7)
    assert.equal(await page.locator('.exchange-select').evaluateAll((items) => {
      const widths = items.map((item) => Math.round(item.getBoundingClientRect().width))
      const swap = document.querySelector('.exchange-swap').getBoundingClientRect()
      return widths[0] === widths[1] && Math.round(swap.width) === 48 && swap.left > items[0].getBoundingClientRect().right && swap.right < items[1].getBoundingClientRect().left
    }), true)
    await page.locator('.exchange-amount').fill('100')
    await page.locator('.exchange-select').nth(0).selectOption('JPY')
    await page.locator('.exchange-select').nth(1).selectOption('USD')
    assert.match(await page.locator('.exchange-result').innerText(), /USD$/)
    await page.getByRole('button', { name: '交换币种' }).click()
    assert.equal(await page.locator('.exchange-select').nth(0).inputValue(), 'USD')
    assert.equal(await page.locator('.exchange-select').nth(1).inputValue(), 'JPY')
    for (const code of ['CNY', 'SGD', 'KRW', 'HKD', 'GBP']) await page.locator('.exchange-select').nth(0).selectOption(code)
    await page.locator('.exchange-amount').fill('-1')
    assert.equal(await page.locator('.exchange-result').innerText(), '')
    assert.deepEqual(thirdPartyRequests, [])
    const unavailableExchangeSnapshot = structuredClone(snapshot)
    unavailableExchangeSnapshot.views.exchange.exchangeRates = { available: false, rates: {}, reason: '后台数据不可用' }
    await page.route('**/api/home.json', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(unavailableExchangeSnapshot) }))
    await page.getByRole('button', { name: '刷新显示' }).click()
    await assert.doesNotReject(() => page.getByText('汇率数据暂不可用，请稍后查看', { exact: true }).waitFor())
    assert.equal(await page.getByText('汇率数据暂不可用，请稍后查看', { exact: true }).count(), 1)
    assert.equal(await page.getByText('当前汇率不可用', { exact: true }).count(), 0)
    assert.equal(await page.getByText('暂无可靠汇率', { exact: true }).count(), 0)
    await page.unroute('**/api/home.json')
    await page.getByRole('button', { name: '刷新显示' }).click()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    await page.getByRole('button', { name: '油价' }).click()
    assert.equal(await page.locator('#collection-status').isHidden(), true, '油价页不应显示今日采集状态')
    assert.equal(await page.getByRole('button', { name: '油价' }).getAttribute('aria-current'), 'page')
    assert.equal(await page.locator('#page-kicker').isHidden(), true)
    await assertBottomNavigation(page)
    await assert.doesNotReject(() => page.getByRole('heading', { name: '广东最高零售价', exact: true, level: 2 }).waitFor())
    await assert.doesNotReject(() => page.getByText(/^当前有效 · 自.+起执行$/).waitFor())
    await assert.doesNotReject(() => page.getByText('来源：广东省发展改革委', { exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByText('各加油站实际售价可能低于政府最高零售价。', { exact: true }).waitFor())
    assert.equal(await page.getByRole('heading', { name: '0号柴油', exact: true }).count(), 1)
    assert.equal(await page.locator('.fuel-grid').evaluate((grid) => getComputedStyle(grid).gridTemplateColumns.split(' ').length), 3)
    assert.equal(await page.locator('.fuel-detail .fuel-unit').count(), 3)
    assert.equal(await page.locator('.fuel-detail .fuel-name').evaluateAll((items) => items.every((item) => item.scrollWidth <= item.clientWidth)), true, '油品名称不应在三列卡片内换行或溢出')
    assert.equal(await page.locator('.fuel-detail').evaluateAll((items) => {
      const rectangles = items.map((item) => item.getBoundingClientRect())
      return rectangles.length === 3 && rectangles.every((rectangle) => rectangle.top === rectangles[0].top && rectangle.height === rectangles[0].height)
    }), true, '三张油价卡应同一行且等高')
    assert.equal(await page.locator('.fuel-detail .source-line').count(), 0)
    assert.equal(await page.locator('.fuel-detail .quote-meta').count(), 0)
    await assert.doesNotReject(() => page.getByRole('heading', { name: '油价调整记录', exact: true }).waitFor())
    await assert.doesNotReject(() => page.getByText('当前仅有1次调价记录，历史数据积累中', { exact: true }).waitFor())
    assert.equal(await page.locator('.trend-section .trend-svg').count(), 0)
    assert.equal(await page.getByText('仅展示可靠行情记录', { exact: true }).count(), 0)
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
    assert.equal(await page.getByRole('heading', { name: '黄金摘要', exact: true }).count(), 1)
    await page.screenshot({ path: resolve(outputDirectory, `home-${width}-read-failure.png`), fullPage: true })
    await page.close()
  }
} finally {
  await browser.close()
}
