export const EXCHANGE_RATES_SOURCE_URL = 'https://data-api.ecb.europa.eu/service/data/EXR/D.CNY+USD+HKD+JPY+GBP+KRW+SGD.EUR.SP00.A?lastNObservations=1&format=csvdata'
export const SUPPORTED_CURRENCIES = [
  { code: 'CNY', name: '人民币', displayUnit: 1 }, { code: 'USD', name: '美元', displayUnit: 1 },
  { code: 'HKD', name: '港币', displayUnit: 1 }, { code: 'JPY', name: '日元', displayUnit: 100 },
  { code: 'EUR', name: '欧元', displayUnit: 1 }, { code: 'GBP', name: '英镑', displayUnit: 1 },
  { code: 'KRW', name: '韩元', displayUnit: 100 }, { code: 'SGD', name: '新加坡元', displayUnit: 1 },
]
const CODES = new Set(SUPPORTED_CURRENCIES.map(({ code }) => code))
const ECB_CURRENCIES = SUPPORTED_CURRENCIES.map(({ code }) => code).filter((code) => code !== 'EUR')

export function unavailableExchangeRates(collectedAt, reason = '暂无可靠汇率数据', sourceUrl = EXCHANGE_RATES_SOURCE_URL, sourceName = '欧洲央行') {
  return { available: false, base: 'USD', rates: {}, sourceObservedAt: null, collectedAt, sourceTimePrecision: null, sourceUrl, sourceName, reason }
}

export function parseEcbExchangeRates(csv, collectedAt, now = collectedAt) {
  if (typeof csv !== 'string' || !csv.trim()) return unavailableExchangeRates(collectedAt, '欧洲央行未返回参考汇率数据')
  const rows = csv.trim().split(/\r?\n/).map((line) => line.split(','))
  const header = rows.shift()
  const indexes = ['FREQ', 'CURRENCY', 'CURRENCY_DENOM', 'EXR_TYPE', 'EXR_SUFFIX', 'TIME_PERIOD', 'OBS_VALUE'].map((column) => header.indexOf(column))
  if (indexes.some((index) => index < 0)) return unavailableExchangeRates(collectedAt, '欧洲央行响应格式无法识别')
  const observations = new Map()
  for (const row of rows) {
    const [frequency, currency, denominator, rateType, suffix, date, rawValue] = indexes.map((index) => row[index])
    if (!ECB_CURRENCIES.includes(currency)) continue
    if (frequency !== 'D' || denominator !== 'EUR' || rateType !== 'SP00' || suffix !== 'A') return unavailableExchangeRates(collectedAt, `欧洲央行${currency}数据不是每日欧元参考汇率`)
    if (observations.has(currency)) return unavailableExchangeRates(collectedAt, `欧洲央行${currency}数据重复`)
    observations.set(currency, { date, value: Number(rawValue) })
  }
  if (ECB_CURRENCIES.some((code) => !observations.has(code))) return unavailableExchangeRates(collectedAt, '欧洲央行响应缺少支持币种')
  const dates = new Set([...observations.values()].map(({ date }) => date))
  const [sourceObservedAt] = dates
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(sourceObservedAt) ? new Date(`${sourceObservedAt}T00:00:00Z`) : null
  if (dates.size !== 1 || !parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== sourceObservedAt) {
    return unavailableExchangeRates(collectedAt, '欧洲央行币种数据日期不一致或无效')
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now))
  if (sourceObservedAt > today) return unavailableExchangeRates(collectedAt, '欧洲央行数据日期晚于当前日期')
  if ([...observations.values()].some(({ value }) => !Number.isFinite(value) || value <= 0)) return unavailableExchangeRates(collectedAt, '欧洲央行响应包含无效汇率')
  const euroRates = Object.fromEntries([...observations].map(([code, { value }]) => [code, value]))
  const usdPerEuro = euroRates.USD
  const rates = Object.fromEntries(SUPPORTED_CURRENCIES.map(({ code }) => [code, code === 'USD' ? 1 : code === 'EUR' ? 1 / usdPerEuro : euroRates[code] / usdPerEuro]))
  return { available: true, base: 'USD', rates, sourceObservedAt, collectedAt, sourceTimePrecision: 'date', sourceUrl: EXCHANGE_RATES_SOURCE_URL, sourceName: '欧洲央行', referenceBase: 'EUR', rateType: 'daily-reference', reason: null }
}

export function selectExchangeRatesForCalculations(liveRates, cachedRates) {
  if (liveRates?.available) return liveRates
  if (cachedRates?.available && cachedRates.rateType === 'daily-reference') return cachedRates
  return liveRates
}

export function buildUsdCnyObservation(exchangeRates, collectedAt) {
  const value = exchangeRates?.rates?.CNY
  if (!exchangeRates?.available || exchangeRates.base !== 'USD' || !Number.isFinite(value) || value <= 0) {
    return { name: 'USD/CNY', available: false, sourceUrl: exchangeRates?.sourceUrl ?? EXCHANGE_RATES_SOURCE_URL, sourceName: exchangeRates?.sourceName ?? '欧洲央行', collectedAt, reason: exchangeRates?.reason ?? 'ECB USD/CNY汇率不可用' }
  }
  return {
    name: 'USD/CNY', available: true, value, baseCurrency: 'USD', quoteCurrency: 'CNY',
    observedAt: exchangeRates.sourceObservedAt, collectedAt,
    sourceUrl: exchangeRates.sourceUrl, sourceName: exchangeRates.sourceName,
    sourceTimePrecision: exchangeRates.sourceTimePrecision,
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
