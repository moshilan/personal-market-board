import test from 'node:test'
import assert from 'node:assert/strict'
import { pricePerJin, formatChenpiPrice, formatChenpiPriceTime } from '../public/chenpi-reference.mjs'
import { CHENPI_REFERENCE } from '../public/chenpi-reference-data.mjs'

test('陈皮公斤区间和包装报价按500克换算，保留非封顶上界', () => {
  assert.deepEqual(pricePerJin({ min: 400, max: 1160, unit: '元/公斤' }), { min: 200, max: 580, openEnded: false })
  assert.equal(formatChenpiPrice({ min: 108, unit: '元/件', weightGrams: 50 }), '1,080元/斤')
  assert.equal(formatChenpiPrice({ min: 255, unit: '元/件', weightGrams: 250 }), '510元/斤')
  assert.equal(formatChenpiPrice({ min: 2400, max: 4000, unit: '元/公斤', openEnded: true }), '1,200–2,000及以上元/斤')
})

test('价格或重量不足以换算时显示暂无，不补规格或零价', () => {
  for (const price of [null, { min: null, unit: '元/斤' }, { min: 10, max: 5, unit: '元/斤' },
    { min: 108, unit: '元/件' }, { min: 108, unit: '元/件', weightGrams: 0 }, { min: 10, unit: '元/袋' }]) {
    assert.equal(formatChenpiPrice(price), '暂无')
  }
})

test('陈皮快照保留市场原始年限组、未知报价日期和可追溯的原价', () => {
  assert.deepEqual(CHENPI_REFERENCE.market.map((quote) => quote.label), ['3–5年', '7–8年', '8–10年及以上'])
  const all = [...CHENPI_REFERENCE.market, ...CHENPI_REFERENCE.core, ...CHENPI_REFERENCE.villages.flatMap((village) => village.quotes)]
  assert.equal(new Set(all.map((quote) => quote.id)).size, all.length)
  for (const quote of all) {
    assert.ok(quote.sourceUrl.startsWith('https://'))
    assert.ok(quote.sourceName && quote.originalText && quote.priceType)
    assert.equal(quote.collectedAt, '2026-09-28')
    assert.notEqual(pricePerJin(quote.price), null)
  }
  for (const village of CHENPI_REFERENCE.villages) {
    for (const quote of village.quotes) {
      assert.equal(quote.sourceDate, null)
      assert.equal(quote.priceDate, null)
      assert.equal(formatChenpiPriceTime(quote), '采集时间：2026年9月')
      assert.ok(['供应挂牌', '零售挂牌'].includes(quote.priceType))
    }
  }
  const meijiang = CHENPI_REFERENCE.villages.find((village) => village.name === '梅江').quotes[0]
  assert.match(meijiang.label, /2016年标/)
  assert.match(meijiang.note, /不换算为10年/)
  const newPeel = all.find((quote) => quote.id === 'chakeng-zhimian-2023-erhong-250g')
  assert.match(newPeel.note, /未满三年/)
})

test('陈皮价格时间优先原报价日期，报道与电商采集时间不冒充报价日期', () => {
  const quotes = [...CHENPI_REFERENCE.market, ...CHENPI_REFERENCE.core, ...CHENPI_REFERENCE.villages.flatMap((village) => village.quotes)]
  for (const quote of quotes) {
    assert.match(formatChenpiPriceTime(quote), /^(报价日期|报道时间|采集时间)：\d{4}年\d{1,2}月/)
  }
  assert.equal(formatChenpiPriceTime(CHENPI_REFERENCE.market[0]), '报道时间：2026年1月13日 · 采集时间：2026年9月')
  assert.equal(formatChenpiPriceTime(CHENPI_REFERENCE.core[0]), '报道时间：2025年10月12日 · 采集时间：2026年9月')
  const guidance = CHENPI_REFERENCE.core.find((quote) => quote.id === 'core-10-years-circle-guidance')
  assert.equal(formatChenpiPriceTime(guidance), '报价日期：2026年1月 · 报道时间：2026年7月28日 · 采集时间：2026年9月')
  assert.equal(formatChenpiPriceTime({ priceDate: '2025-12-01', sourceDate: '2026-07-28', collectedAt: '2026-09-28' }), '报价日期：2025年12月1日 · 报道时间：2026年7月28日 · 采集时间：2026年9月')
  const newPeel = quotes.find((quote) => quote.id === 'chakeng-zhimian-2023-erhong-250g')
  assert.match(newPeel.label, /2023年晒制/)
  assert.equal(formatChenpiPriceTime(newPeel), '采集时间：2026年9月')
})
