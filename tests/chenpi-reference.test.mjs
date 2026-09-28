import test from 'node:test'
import assert from 'node:assert/strict'
import { pricePerJin, formatChenpiPrice } from '../public/chenpi-reference.mjs'
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
    assert.ok(quote.sourceName && quote.sourceDateLabel && quote.originalText && quote.priceType)
    assert.equal(quote.collectedAt, '2026-09-28')
    assert.notEqual(pricePerJin(quote.price), null)
  }
  for (const village of CHENPI_REFERENCE.villages) {
    for (const quote of village.quotes) {
      assert.equal(quote.sourceDate, null)
      assert.equal(quote.sourceDateLabel, '报价日期')
      assert.ok(['供应挂牌', '零售挂牌'].includes(quote.priceType))
    }
  }
  const meijiang = CHENPI_REFERENCE.villages.find((village) => village.name === '梅江').quotes[0]
  assert.match(meijiang.label, /2016年标/)
  assert.match(meijiang.note, /不换算为10年/)
  const newPeel = all.find((quote) => quote.id === 'chakeng-zhimian-2023-erhong-250g')
  assert.match(newPeel.note, /未满三年/)
})
