export const EXCHANGE_RATES_SOURCE_URL = 'https://api.exchangerate.fun/latest?base=USD&symbols=CNY,HKD,JPY,EUR,GBP,KRW,SGD'
export const CURRENCY_EXCHANGE_TOOL_URL = 'https://www.currencyexchangetool.com/api/v1/convert'
export const SUPPORTED_CURRENCIES = [
  { code: 'CNY', name: '人民币', displayUnit: 1 }, { code: 'USD', name: '美元', displayUnit: 1 },
  { code: 'HKD', name: '港币', displayUnit: 1 }, { code: 'JPY', name: '日元', displayUnit: 100 },
  { code: 'EUR', name: '欧元', displayUnit: 1 }, { code: 'GBP', name: '英镑', displayUnit: 1 },
  { code: 'KRW', name: '韩元', displayUnit: 100 }, { code: 'SGD', name: '新加坡元', displayUnit: 1 },
]
const CODES = new Set(SUPPORTED_CURRENCIES.map(({ code }) => code))
function chinaDate(value) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
export function unavailableExchangeRates(collectedAt, reason = '暂无可靠汇率数据', sourceUrl = EXCHANGE_RATES_SOURCE_URL, sourceName = 'ExchangeRate.fun') {
  return { available: false, base: 'USD', rates: {}, sourceObservedAt: null, collectedAt, sourceTimePrecision: null, sourceUrl, sourceName, reason }
}
export function parseExchangeRateFun(payload, collectedAt, now = collectedAt) {
  const timestamp = Number(payload?.timestamp)
  const sourceObservedAt = Number.isFinite(timestamp) ? new Date(timestamp * 1000) : null
  if (!sourceObservedAt || Number.isNaN(sourceObservedAt.getTime())) return unavailableExchangeRates(collectedAt, '缺少有效汇率源时间')
  if (payload.base !== 'USD') return unavailableExchangeRates(collectedAt, '汇率基准不是USD')
  const rates = Object.fromEntries(SUPPORTED_CURRENCIES.map(({ code }) => [code, code === 'USD' ? 1 : Number(payload.rates?.[code])]))
  if (Object.values(rates).some((value) => !Number.isFinite(value) || value <= 0)) return unavailableExchangeRates(collectedAt, '缺少支持币种汇率')
  const age = new Date(now).getTime() - sourceObservedAt.getTime()
  if (chinaDate(sourceObservedAt) !== chinaDate(now) || age < 0 || age > 2 * 60 * 60 * 1000) return { ...unavailableExchangeRates(collectedAt, '汇率源时间已过期或不属于北京时间当天'), base: 'USD', rates, sourceObservedAt: sourceObservedAt.toISOString(), sourceTimePrecision: 'second' }
  return { available: true, base: 'USD', rates, sourceObservedAt: sourceObservedAt.toISOString(), collectedAt, sourceTimePrecision: 'second', sourceUrl: EXCHANGE_RATES_SOURCE_URL, sourceName: 'ExchangeRate.fun', reason: null }
}

export function parseCurrencyExchangeToolBatch(records, collectedAt, now = collectedAt) {
  const parsed = records.map((record) => ({ code: record.to, rate: Number(record.rate), observedAt: new Date(record.updatedAt) }))
  const requiredCodes = new Set([...CODES].filter((code) => code !== 'USD'))
  if (parsed.length !== requiredCodes.size || new Set(parsed.map(({ code }) => code)).size !== parsed.length || parsed.some(({ code, rate, observedAt }) => !requiredCodes.has(code) || !Number.isFinite(rate) || rate <= 0 || Number.isNaN(observedAt.getTime()))) return unavailableExchangeRates(collectedAt, '备用汇率源返回字段不完整')
  const nowTime = new Date(now).getTime()
  if (parsed.some(({ observedAt }) => {
    const age = nowTime - observedAt.getTime()
    return chinaDate(observedAt) !== chinaDate(now) || age < -5 * 60 * 1_000 || age > 2 * 60 * 60 * 1_000
  })) return unavailableExchangeRates(collectedAt, '备用汇率源存在过期或非北京时间当天数据', CURRENCY_EXCHANGE_TOOL_URL, 'Currency Exchange Tool')
  const sourceObservedAt = new Date(Math.max(...parsed.map(({ observedAt }) => observedAt.getTime())))
  return {
    available: true,
    base: 'USD',
    rates: Object.fromEntries([['USD', 1], ...parsed.map(({ code, rate }) => [code, rate])]),
    sourceObservedAt: sourceObservedAt.toISOString(),
    sourceObservedAtByCurrency: Object.fromEntries(parsed.map(({ code, observedAt }) => [code, observedAt.toISOString()])),
    collectedAt,
    sourceTimePrecision: 'second',
    sourceUrl: CURRENCY_EXCHANGE_TOOL_URL,
    sourceName: 'Currency Exchange Tool',
    reason: null,
  }
}
export function convertExchangeRate(amount, from, to, exchangeRates) {
  if (typeof amount === 'string' && amount.trim() === '') return null
  const value = Number(amount)
  if (!exchangeRates?.available || !CODES.has(from) || !CODES.has(to) || !Number.isFinite(value) || value < 0) return null
  const fromRate = exchangeRates.rates[from]; const toRate = exchangeRates.rates[to]
  if (!Number.isFinite(fromRate) || !Number.isFinite(toRate) || fromRate <= 0 || toRate <= 0) return null
  return value * toRate / fromRate
}
