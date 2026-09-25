import assert from 'node:assert/strict'
import test from 'node:test'
import { buildUsdCnyObservation, convertExchangeRate, parseEcbExchangeRates } from '../src/exchange-rates.mjs'
import { deriveGoldSpread, deriveInternationalGoldCny } from '../src/gold-calculations.mjs'
import { deriveInternationalSilverCny, deriveSilverSpread } from '../src/silver-calculations.mjs'

const collectedAt = new Date('2026-09-25T07:00:00.000Z')
const exchangeRates = {
  available: true, base: 'USD', sourceName: '欧洲央行', sourceUrl: 'https://data-api.ecb.europa.eu/test',
  sourceObservedAt: '2026-09-24', sourceTimePrecision: 'date', rateType: 'daily-reference', rates: { USD: 1, CNY: 6.712589073634204 },
}
const usdCny = buildUsdCnyObservation(exchangeRates, collectedAt.toISOString())

test('黄金、白银人民币折算和白银价差都沿用同一个ECB USD/CNY', () => {
  const gold = deriveInternationalGoldCny({ name: 'XAU/USD', available: true, value: 3800, observedAt: collectedAt.toISOString(), sourceUrl: 'https://xau.test' }, usdCny, collectedAt)
  const goldSpread = deriveGoldSpread({ name: 'Au99.99', available: true, value: 820 }, gold, collectedAt)
  const silver = deriveInternationalSilverCny({ name: 'XAG/USD', available: true, value: 45, observedAt: collectedAt.toISOString(), sourceUrl: 'https://xag.test' }, usdCny, collectedAt)
  const spread = deriveSilverSpread({ name: '国内白银', available: true, value: 12 }, silver, collectedAt)
  assert.equal(gold.value, 3800 * exchangeRates.rates.CNY / 31.1034768)
  assert.equal(goldSpread.value, 820 - gold.value)
  assert.equal(goldSpread.percentage, goldSpread.value / gold.value * 100)
  assert.equal(silver.value, 45 * exchangeRates.rates.CNY / 31.1034768)
  assert.equal(spread.value, 12 - silver.value)
  assert.deepEqual(gold.inputs[1], { name: 'USD/CNY', sourceUrl: exchangeRates.sourceUrl, observedAt: exchangeRates.sourceObservedAt })
  assert.deepEqual(silver.inputs[1], { name: 'USD/CNY', sourceUrl: exchangeRates.sourceUrl, observedAt: exchangeRates.sourceObservedAt })
})

test('ECB响应归一出的USD/CNY与换算器中USD→CNY完全一致', () => {
  const csv = 'FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE\nD,CNY,EUR,SP00,A,2026-09-24,7.6302\nD,USD,EUR,SP00,A,2026-09-24,1.1367\nD,HKD,EUR,SP00,A,2026-09-24,8.9148\nD,JPY,EUR,SP00,A,2026-09-24,180.57\nD,GBP,EUR,SP00,A,2026-09-24,0.85986\nD,KRW,EUR,SP00,A,2026-09-24,1555.69\nD,SGD,EUR,SP00,A,2026-09-24,1.4549'
  const rates = parseEcbExchangeRates(csv, collectedAt.toISOString(), collectedAt)
  assert.equal(rates.available, true)
  assert.equal(buildUsdCnyObservation(rates, collectedAt.toISOString()).value, rates.rates.CNY)
  assert.equal(convertExchangeRate(1, 'USD', 'CNY', rates), rates.rates.CNY)
})
