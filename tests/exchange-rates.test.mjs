import assert from 'node:assert/strict'
import test from 'node:test'
import { buildUsdCnyObservation, convertExchangeRate, parseEcbExchangeRates, selectExchangeRatesForCalculations, SUPPORTED_CURRENCIES } from '../src/exchange-rates.mjs'

const collectedAt = '2026-09-25T03:30:00.000Z'
const csv = `KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE\n${[
  ['CNY', '7.6302'], ['GBP', '0.85986'], ['HKD', '8.9148'], ['JPY', '180.57'], ['KRW', '1555.69'], ['SGD', '1.4549'], ['USD', '1.1367'],
].map(([code, value]) => `EXR.D.${code}.EUR.SP00.A,D,${code},EUR,SP00,A,2026-09-24,${value}`).join('\n')}`
const rates = parseEcbExchangeRates(csv, collectedAt, collectedAt)

test('解析 ECB 同批 7 个 EUR 基准报价并归一为 8 个 USD 基准币种', () => {
  assert.equal(rates.available, true)
  assert.deepEqual(Object.keys(rates.rates).sort(), SUPPORTED_CURRENCIES.map(({ code }) => code).sort())
  assert.equal(rates.sourceObservedAt, '2026-09-24')
  assert.equal(rates.collectedAt, collectedAt)
  assert.equal(rates.sourceTimePrecision, 'date')
  assert.equal(rates.referenceBase, 'EUR')
  assert.equal(rates.rates.USD, 1)
  assert.equal(rates.rates.CNY, 7.6302 / 1.1367)
  assert.equal(rates.rates.EUR, 1 / 1.1367)
})

test('较早的最近发布工作日可用，且交叉换算沿用同批数据', () => {
  assert.equal(rates.available, true)
  assert.equal(convertExchangeRate(1, 'CNY', 'USD', rates), 1 / rates.rates.CNY)
  assert.equal(convertExchangeRate(1, 'JPY', 'USD', rates), 1 / rates.rates.JPY)
  assert.equal(convertExchangeRate(1, 'HKD', 'EUR', rates), rates.rates.EUR / rates.rates.HKD)
  assert.equal(convertExchangeRate(1, 'CNY', 'SGD', rates), rates.rates.SGD / rates.rates.CNY)
  assert.equal(convertExchangeRate(1, 'EUR', 'EUR', rates), 1)
})

test('金银折算共用ECB批次的USD/CNY及源数据日，失败时只回用ECB缓存', () => {
  const usdCny = buildUsdCnyObservation(rates, collectedAt)
  assert.equal(usdCny.value, rates.rates.CNY)
  assert.equal(usdCny.observedAt, rates.sourceObservedAt)
  assert.equal(usdCny.sourceUrl, rates.sourceUrl)
  const unavailable = { available: false, reason: 'network error' }
  assert.equal(selectExchangeRatesForCalculations(unavailable, rates), rates)
  assert.equal(selectExchangeRatesForCalculations(rates, unavailable), rates)
  assert.equal(selectExchangeRatesForCalculations(unavailable, { available: true, base: 'USD', rates: { CNY: 7.2 }, sourceName: 'Currency Exchange Tool' }), unavailable)
})

test('缺币种、重复数据、混合日期、未来日期或无效汇率时整批不可用', () => {
  assert.equal(parseEcbExchangeRates(csv.replace(/EXR\.D\.KRW\.EUR\.SP00\.A[^\n]*\n/, ''), collectedAt, collectedAt).available, false)
  assert.equal(parseEcbExchangeRates(`${csv}\n${csv.split('\n').at(-1)}`, collectedAt, collectedAt).available, false)
  assert.equal(parseEcbExchangeRates(csv.replace('2026-09-24,180.57', '2026-09-23,180.57'), collectedAt, collectedAt).available, false)
  assert.equal(parseEcbExchangeRates(csv.replaceAll('2026-09-24', '2026-09-26'), collectedAt, collectedAt).available, false)
  assert.equal(parseEcbExchangeRates(csv.replace('2026-09-24,180.57', '2026-09-24,0'), collectedAt, collectedAt).available, false)
  assert.equal(parseEcbExchangeRates('invalid', collectedAt, collectedAt).available, false)
})

test('空值、非法金额、负数、币种和不可用批次不能换算', () => {
  assert.equal(convertExchangeRate('', 'CNY', 'USD', rates), null)
  assert.equal(convertExchangeRate('NaN', 'CNY', 'USD', rates), null)
  assert.equal(convertExchangeRate(-1, 'CNY', 'USD', rates), null)
  assert.equal(convertExchangeRate(1, 'ABC', 'USD', rates), null)
  assert.equal(convertExchangeRate(1, 'CNY', 'USD', { ...rates, available: false }), null)
})
