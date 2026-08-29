import assert from 'node:assert/strict'
import test from 'node:test'
import { convertExchangeRate, parseExchangeRateFun, SUPPORTED_CURRENCIES } from '../src/exchange-rates.mjs'

const payload = { base: 'USD', timestamp: 1788022811, rates: { CNY: 6.728, HKD: 7.84095, JPY: 160.085, EUR: 0.863222, GBP: 0.738825, KRW: 1377.57, SGD: 1.2743 } }
const collectedAt = '2026-08-29T17:30:00.000Z'
const rates = parseExchangeRateFun(payload, collectedAt, collectedAt)

test('完整解析8个支持币种并保留源时间与采集时间', () => {
  assert.equal(rates.available, true)
  assert.deepEqual(Object.keys(rates.rates).sort(), SUPPORTED_CURRENCIES.map(({ code }) => code).sort())
  assert.equal(rates.sourceObservedAt, '2026-08-29T17:00:11.000Z')
  assert.equal(rates.collectedAt, collectedAt)
  assert.equal(rates.sourceTimePrecision, 'second')
})

test('交叉换算始终使用同一批USD基准汇率', () => {
  assert.equal(convertExchangeRate(1, 'CNY', 'USD', rates), 1 / 6.728)
  assert.equal(convertExchangeRate(1, 'JPY', 'USD', rates), 1 / 160.085)
  assert.equal(convertExchangeRate(1, 'HKD', 'EUR', rates), 0.863222 / 7.84095)
  assert.equal(convertExchangeRate(1, 'CNY', 'SGD', rates), 1.2743 / 6.728)
})

test('过期、非法、空和负数输入不可换算', () => {
  assert.equal(parseExchangeRateFun(payload, collectedAt, '2026-08-29T20:01:00.000Z').available, false)
  assert.equal(convertExchangeRate('', 'CNY', 'USD', rates), null)
  assert.equal(convertExchangeRate(-1, 'CNY', 'USD', rates), null)
  assert.equal(convertExchangeRate(1, 'ABC', 'USD', rates), null)
  assert.equal(convertExchangeRate(1, 'CNY', 'USD', { ...rates, available: false }), null)
})

test('缺少任一支持币种时整批不可用，不用残缺数据换算', () => {
  const incomplete = { ...payload, rates: { ...payload.rates, KRW: undefined } }
  assert.equal(parseExchangeRateFun(incomplete, collectedAt, collectedAt).available, false)
})
