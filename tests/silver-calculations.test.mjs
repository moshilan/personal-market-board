import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveDomesticSilverCny, deriveInternationalSilverCny, deriveSilverSpread } from '../src/silver-calculations.mjs'

const collectedAt = new Date('2026-08-27T08:00:00.000Z')
const xagUsd = { name: 'XAG/USD', available: true, value: 68.924004, observedAt: '2026-08-27T08:00:00.000Z', sourceUrl: 'https://xaus.com/api/v1/spot' }
const usdCny = { name: 'USD/CNY', available: true, value: 7.2, observedAt: '2026-08-27T08:00:00.000Z', sourceUrl: 'https://example.test/usd-cny' }
const agTd = { name: 'Ag(T+D)', available: true, value: 16711, observedAt: '2026-08-27', sourceUrl: 'https://www.sge.com.cn/h5_sjzx/yshq' }

test('白银按指定公式折算人民币克价并计算国内外价差', () => {
  const international = deriveInternationalSilverCny(xagUsd, usdCny, collectedAt)
  const domestic = deriveDomesticSilverCny(agTd, collectedAt)
  const spread = deriveSilverSpread(domestic, international, collectedAt)
  assert.equal(international.value, 68.924004 * 7.2 / 31.1034768)
  assert.equal(domestic.value, 16.711)
  assert.equal(spread.value, domestic.value - international.value)
  assert.equal(spread.percentage, spread.value / international.value * 100)
  assert.deepEqual(domestic.inputs, [{ name: 'Ag(T+D)', sourceUrl: 'https://www.sge.com.cn/h5_sjzx/yshq', observedAt: '2026-08-27' }])
})

test('白银输入不可用时派生值明确不可用', () => {
  const international = deriveInternationalSilverCny({ ...xagUsd, available: false }, usdCny, collectedAt)
  const domestic = deriveDomesticSilverCny({ ...agTd, available: false }, collectedAt)
  const spread = deriveSilverSpread(domestic, international, collectedAt)
  assert.equal(international.available, false)
  assert.equal(domestic.available, false)
  assert.equal(spread.available, false)
})
