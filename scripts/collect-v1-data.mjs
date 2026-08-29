import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { persistSnapshot } from '../src/market-data-store.mjs'
import { CURRENCY_EXCHANGE_TOOL_URL, EXCHANGE_RATES_SOURCE_URL, parseCurrencyExchangeToolBatch, parseExchangeRateFun, unavailableExchangeRates } from '../src/exchange-rates.mjs'
import { deriveDomesticSilverCny, deriveInternationalSilverCny, deriveSilverSpread } from '../src/silver-calculations.mjs'

const OUNCE_TO_GRAM = 31.1034768
const TIME_ZONE = 'Asia/Shanghai'
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const DEFAULT_STORE_PATH = resolve(SCRIPT_DIRECTORY, '../data/market-data.json')

const SOURCES = {
  xauUsdPrimary: 'https://xaus.com/api/v1/spot',
  xauUsdBackup: 'https://api.goldprice.dev/v1/prices?symbol=XAU-USD-SPOT&include=sources',
  usdCny: 'https://www.currencyexchangetool.com/api/v1/convert?amount=1&from=USD&to=CNY',
  exchangeRates: EXCHANGE_RATES_SOURCE_URL,
  exchangeRatesBackup: CURRENCY_EXCHANGE_TOOL_URL,
  au9999: 'https://www.sge.com.cn/h5_sjzx/yshq',
  agTd: 'https://www.sge.com.cn/h5_sjzx/yshq',
  chowSangSang: 'https://cn.chowsangsang.com/gold-info',
  brands: {
    '周大福': 'https://cngoldprice.com/brand/chow-tai-fook/today-gold-price',
    '六福珠宝': 'https://cngoldprice.com/brand/luk-fook/today-gold-price',
    '老凤祥': 'https://cngoldprice.com/brand/lao-feng-xiang/today-gold-price',
  },
  guangdongFuel: 'https://drc.gd.gov.cn/ywgg/content/post_4942632.html',
}

function now() {
  return new Date()
}

function shanghaiDate(value) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

function unavailable(name, sourceUrl, collectedAt, reason) {
  return { name, available: false, sourceUrl, collectedAt, reason }
}

async function getText(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'PersonalMarketBoard/0.1' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.text()
}

async function getJson(url) {
  return JSON.parse(await getText(url))
}

function parseNumber(value) {
  const number = Number(String(value).replaceAll(',', '').trim())
  if (!Number.isFinite(number) || number <= 0) throw new Error('价格不是正数')
  return number
}

async function collectXauUsdFromXaus(collectedAt) {
  const payload = await getJson(SOURCES.xauUsdPrimary)
  const observedAt = new Date(payload.price_as_of)
  if (Number.isNaN(observedAt.getTime())) throw new Error('缺少有效来源时间')
  if (payload.stale === true || payload.data_state?.status !== 'fresh') throw new Error('来源标记为非新鲜数据')
  if (shanghaiDate(observedAt) !== shanghaiDate(collectedAt)) throw new Error('来源时间不属于当天')

  return {
    name: 'XAU/USD',
    available: true,
    value: parseNumber(payload.xau?.price),
    currency: 'USD',
    unit: 'troy_ounce',
    observedAt: observedAt.toISOString(),
    collectedAt: collectedAt.toISOString(),
    sourceUrl: SOURCES.xauUsdPrimary,
    sourceName: payload.price_source ?? 'XAUS',
  }
}

async function collectXagUsd(collectedAt) {
  try {
    const payload = await getJson(SOURCES.xauUsdPrimary)
    const observedAt = new Date(payload.price_as_of)
    if (Number.isNaN(observedAt.getTime())) throw new Error('缺少有效来源时间')
    if (payload.stale === true || payload.data_state?.status !== 'fresh') throw new Error('来源标记为非新鲜数据')
    if (shanghaiDate(observedAt) !== shanghaiDate(collectedAt)) throw new Error('来源时间不属于当天')
    return {
      name: 'XAG/USD', available: true, value: parseNumber(payload.silver_usd_oz),
      currency: 'USD', unit: 'troy_ounce', observedAt: observedAt.toISOString(), collectedAt: collectedAt.toISOString(),
      sourceUrl: SOURCES.xauUsdPrimary, sourceName: payload.silver_source ?? payload.price_source ?? 'XAUS',
    }
  } catch (error) {
    return unavailable('XAG/USD', SOURCES.xauUsdPrimary, collectedAt.toISOString(), error.message)
  }
}

async function collectXauUsdFromGoldprice(collectedAt) {
  const payload = await getJson(SOURCES.xauUsdBackup)
  const quote = payload.symbols?.find((item) => item.symbol === 'XAU' && item.quote_currency === 'USD' && item.contract_type === 'spot')
  const source = quote?.sources?.find((item) => item.informational !== true)
  const observedAt = new Date(source?.source_timestamp ?? quote?.computed_at)
  if (!quote || !source || Number.isNaN(observedAt.getTime())) throw new Error('缺少有效现货报价或来源时间')
  if (quote.is_stale === true || source.is_stale === true) throw new Error('来源标记为非新鲜数据')
  if (shanghaiDate(observedAt) !== shanghaiDate(collectedAt)) throw new Error('来源时间不属于当天')

  return {
    name: 'XAU/USD',
    available: true,
    value: parseNumber(quote.price),
    currency: 'USD',
    unit: 'troy_ounce',
    observedAt: observedAt.toISOString(),
    collectedAt: collectedAt.toISOString(),
    sourceUrl: SOURCES.xauUsdBackup,
    sourceName: `GoldPrice.dev / ${source.display_name ?? source.source}`,
  }
}

async function collectXauUsd(collectedAt, options = {}) {
  try {
    if (options.simulatePrimaryFailure) throw new Error('验证模拟：XAUS不可用')
    return await collectXauUsdFromXaus(collectedAt)
  } catch (primaryError) {
    try {
      if (options.simulateBackupFailure) throw new Error('验证模拟：备用源不可用')
      return await collectXauUsdFromGoldprice(collectedAt)
    } catch (backupError) {
      return {
        ...unavailable('XAU/USD', SOURCES.xauUsdPrimary, collectedAt.toISOString(), `XAUS失败：${primaryError.message}；备用源失败：${backupError.message}`),
        backupSourceUrl: SOURCES.xauUsdBackup,
      }
    }
  }
}

async function collectUsdCny(collectedAt) {
  try {
    const payload = await getJson(SOURCES.usdCny)
    const observedAt = new Date(payload.updatedAt)
    if (Number.isNaN(observedAt.getTime())) throw new Error('缺少有效来源时间')
    const ageMs = collectedAt.getTime() - observedAt.getTime()
    if (shanghaiDate(observedAt) !== shanghaiDate(collectedAt)) throw new Error('来源时间不属于当天')
    if (ageMs < -5 * 60 * 1_000 || ageMs > 2 * 60 * 60 * 1_000) throw new Error('来源时间超过2小时')

    return {
      name: 'USD/CNY',
      available: true,
      value: parseNumber(payload.rate),
      baseCurrency: 'USD',
      quoteCurrency: 'CNY',
      observedAt: observedAt.toISOString(),
      collectedAt: collectedAt.toISOString(),
      sourceUrl: SOURCES.usdCny,
      sourceName: 'Currency Exchange Tool',
    }
  } catch (error) {
    return unavailable('USD/CNY', SOURCES.usdCny, collectedAt.toISOString(), error.message)
  }
}

async function collectExchangeRates(collectedAt) {
  try {
    const primary = parseExchangeRateFun(await getJson(SOURCES.exchangeRates), collectedAt.toISOString(), collectedAt)
    if (primary.available) return primary
    throw new Error(primary.reason)
  } catch (error) {
    try {
      const records = await Promise.all(['CNY', 'HKD', 'JPY', 'EUR', 'GBP', 'KRW', 'SGD'].map(async (to) => getJson(`${SOURCES.exchangeRatesBackup}?amount=1&from=USD&to=${to}`)))
      const backup = parseCurrencyExchangeToolBatch(records, collectedAt.toISOString(), collectedAt)
      return backup.available ? backup : unavailableExchangeRates(collectedAt.toISOString(), `ExchangeRate.fun与备用汇率源均不可用：${backup.reason}`)
    } catch (backupError) {
      return unavailableExchangeRates(collectedAt.toISOString(), `ExchangeRate.fun与备用汇率源均不可用：${backupError.message}`)
    }
  }
}

async function collectAu9999(collectedAt) {
  try {
    const html = await getText(SOURCES.au9999)
    const dateMatch = html.match(/上海黄金交易所(\d{4})年(\d{2})月(\d{2})日延时行情/)
    const valueMatch = html.match(/Au99\.99[\s\S]{0,400}?<td[^>]*>\s*([\d.]+)\s*<\/td>/)
    if (!dateMatch || !valueMatch) throw new Error('未找到Au99.99当日行情字段')
    const observedDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
    if (observedDate !== shanghaiDate(collectedAt)) throw new Error('上金所行情日期不属于当天')

    return {
      name: 'Au99.99',
      available: true,
      value: parseNumber(valueMatch[1]),
      currency: 'CNY',
      unit: 'gram',
      observedAt: observedDate,
      sourceTimePrecision: 'date',
      collectedAt: collectedAt.toISOString(),
      sourceUrl: SOURCES.au9999,
      sourceName: '上海黄金交易所延时行情',
    }
  } catch (error) {
    return unavailable('Au99.99', SOURCES.au9999, collectedAt.toISOString(), error.message)
  }
}

async function collectAgTd(collectedAt) {
  try {
    const html = await getText(SOURCES.agTd)
    const dateMatch = html.match(/上海黄金交易所(\d{4})年(\d{2})月(\d{2})日延时行情/)
    const valueMatch = html.match(/Ag\(T\+D\)[\s\S]{0,400}?<td[^>]*>\s*([\d.]+)\s*<\/td>/)
    if (!dateMatch || !valueMatch) throw new Error('未找到Ag(T+D)当日行情字段')
    const observedDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`
    if (observedDate !== shanghaiDate(collectedAt)) throw new Error('上金所行情日期不属于当天')
    return {
      name: 'Ag(T+D)', available: true, value: parseNumber(valueMatch[1]),
      currency: 'CNY', unit: 'kilogram', observedAt: observedDate, sourceTimePrecision: 'date',
      collectedAt: collectedAt.toISOString(), sourceUrl: SOURCES.agTd, sourceName: '上海黄金交易所延时行情',
    }
  } catch (error) {
    return unavailable('Ag(T+D)', SOURCES.agTd, collectedAt.toISOString(), error.message)
  }
}

async function collectBrands(collectedAt) {
  const [officialHtml, ...aggregatePages] = await Promise.all([
    getText(SOURCES.chowSangSang),
    ...Object.values(SOURCES.brands).map(getText),
  ])
  const officialPricePayload = officialHtml.match(/gold-prices='([^']+)'/)?.[1]
  const officialDataPayload = officialHtml.match(/:gold_data='([^']+)'/)?.[1]
  if (!officialPricePayload || !officialDataPayload) throw new Error('周生生官方页缺少金价数据')
  const officialPrices = JSON.parse(officialPricePayload)
  const officialData = JSON.parse(officialDataPayload.replaceAll('&quot;', '"'))
  const officialRecord = officialPrices.find((item) => item.label.includes('足金饰品'))
  const officialValue = officialRecord?.items.find((item) => item.name === '卖出')?.price
  const officialTime = officialData.map((item) => item.lastUpdateDate).filter(Boolean).sort().at(-1)
  if (!officialTime || !officialValue || shanghaiDate(new Date(officialTime)) !== shanghaiDate(collectedAt)) {
    throw new Error('周生生官方页未返回当天足金饰品报价')
  }

  const aggregateBrands = Object.entries(SOURCES.brands).map(([brand, sourceUrl], index) => {
    const html = aggregatePages[index]
    const quoteTime = html.match(/更新：<!-- -->\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/)?.[1]
    const value = html.match(/黄金饰品<\/h3>[\s\S]{0,500}?>([\d.]+)<\/p>/)?.[1]
    if (!quoteTime || !value || !quoteTime.startsWith(shanghaiDate(collectedAt))) {
      throw new Error(`${brand}未返回当天黄金饰品报价`)
    }
    return {
      brand,
      product: '黄金饰品',
      available: true,
      value: parseNumber(value),
      currency: 'CNY',
      unit: 'gram',
      quoteDate: quoteTime.slice(0, 10),
      rawSourceTimestamp: quoteTime,
      collectedAt: collectedAt.toISOString(),
      sourceUrl,
    }
  })

  return [
    {
      brand: '周生生',
      product: '足金饰品',
      available: true,
      value: parseNumber(officialValue),
      currency: 'CNY',
      unit: 'gram',
      quoteDate: shanghaiDate(collectedAt),
      rawSourceTimestamp: officialTime,
      collectedAt: collectedAt.toISOString(),
      sourceUrl: SOURCES.chowSangSang,
    },
    ...aggregateBrands,
  ]
}

function extractFuelPrice(html, product) {
  const text = html.replace(/<[^>]+>/g, ' ').replaceAll('&nbsp;', ' ')
  const match = text.match(new RegExp(`${product}（Ⅵ）[\\s\\S]{0,800}?(\\d{4,5})[\\s\\S]{0,800}?(\\d{4,5})[\\s\\S]{0,800}?([\\d.]+)`))
  if (!match) throw new Error(`未找到${product}最高零售价`)
  return parseNumber(match[3])
}

async function collectGuangdongFuel(collectedAt) {
  try {
    const html = await getText(SOURCES.guangdongFuel)
    const effectiveMatch = html.match(/自(\d{4})年(\d{1,2})月(\d{1,2})日24时起执行/)
    if (!effectiveMatch) throw new Error('未找到公告生效时间')
    const effectiveDate = new Date(Date.UTC(Number(effectiveMatch[1]), Number(effectiveMatch[2]) - 1, Number(effectiveMatch[3]), 16))
    const products = ['92号汽油', '95号汽油', '0号柴油'].map((product) => ({
      product,
      available: true,
      value: extractFuelPrice(html, product),
      currency: 'CNY',
      unit: 'liter',
      effectiveFrom: effectiveDate.toISOString(),
      collectedAt: collectedAt.toISOString(),
      sourceUrl: SOURCES.guangdongFuel,
      sourceName: '广东省发展改革委',
    }))
    products.push(unavailable('98号汽油', SOURCES.guangdongFuel, collectedAt.toISOString(), '当前有效公告未列出98号汽油'))
    return products
  } catch (error) {
    return ['92号汽油', '95号汽油', '0号柴油', '98号汽油'].map((product) => unavailable(product, SOURCES.guangdongFuel, collectedAt.toISOString(), error.message))
  }
}

function deriveInternationalGoldCny(xauUsd, usdCny, collectedAt) {
  if (!xauUsd.available || !usdCny.available) {
    return unavailable('国际黄金人民币折算价', 'derived', collectedAt.toISOString(), 'XAU/USD或USD/CNY不可用')
  }
  return {
    name: '国际黄金人民币折算价',
    available: true,
    value: xauUsd.value * usdCny.value / OUNCE_TO_GRAM,
    currency: 'CNY',
    unit: 'gram',
    sourceUrl: 'derived',
    sourceName: '公式计算',
    calculatedAt: collectedAt.toISOString(),
    inputs: [
      { name: xauUsd.name, sourceUrl: xauUsd.sourceUrl, observedAt: xauUsd.observedAt },
      { name: usdCny.name, sourceUrl: usdCny.sourceUrl, observedAt: usdCny.observedAt },
    ],
  }
}

function deriveSpread(au9999, internationalGoldCny, collectedAt) {
  if (!au9999.available || !internationalGoldCny.available) {
    return unavailable('国内外价差', 'derived', collectedAt.toISOString(), 'Au99.99或国际黄金人民币折算价不可用')
  }
  const value = au9999.value - internationalGoldCny.value
  return {
    name: '国内外价差',
    available: true,
    value,
    percentage: value / internationalGoldCny.value * 100,
    currency: 'CNY',
    unit: 'gram',
    sourceUrl: 'derived',
    sourceName: '公式计算',
    calculatedAt: collectedAt.toISOString(),
    inputs: [
      { name: au9999.name, sourceUrl: au9999.sourceUrl, observedAt: au9999.observedAt },
      { name: internationalGoldCny.name, calculatedAt: internationalGoldCny.calculatedAt },
    ],
  }
}

const collectedAt = now()
const simulateCollectionFailure = process.argv.includes('--simulate-collection-failure')
const xauOptions = {
  simulatePrimaryFailure: process.argv.includes('--simulate-xaus-failure'),
  simulateBackupFailure: process.argv.includes('--simulate-xau-backup-failure'),
}
const unavailableBrands = (reason) => ['周生生', '周大福', '六福珠宝', '老凤祥'].map((brand) => ({
  ...unavailable(brand, brand === '周生生' ? SOURCES.chowSangSang : SOURCES.brands[brand], collectedAt.toISOString(), reason),
  brand,
}))
const unavailableFuel = (reason) => ['92号汽油', '95号汽油', '0号柴油', '98号汽油'].map((product) => (
  unavailable(product, SOURCES.guangdongFuel, collectedAt.toISOString(), reason)
))
const [xauUsd, xagUsd, usdCny, exchangeRates, au9999, agTd, brands, guangdongFuel] = simulateCollectionFailure
  ? [
      unavailable('XAU/USD', SOURCES.xauUsdPrimary, collectedAt.toISOString(), '验证模拟：全部实时采集失败'),
      unavailable('XAG/USD', SOURCES.xauUsdPrimary, collectedAt.toISOString(), '验证模拟：全部实时采集失败'),
      unavailable('USD/CNY', SOURCES.usdCny, collectedAt.toISOString(), '验证模拟：全部实时采集失败'),
      unavailableExchangeRates(collectedAt.toISOString(), '验证模拟：全部实时采集失败'),
      unavailable('Au99.99', SOURCES.au9999, collectedAt.toISOString(), '验证模拟：全部实时采集失败'),
      unavailable('Ag(T+D)', SOURCES.agTd, collectedAt.toISOString(), '验证模拟：全部实时采集失败'),
      unavailableBrands('验证模拟：全部实时采集失败'),
      unavailableFuel('验证模拟：全部实时采集失败'),
    ]
  : await Promise.all([
      collectXauUsd(collectedAt, xauOptions),
      collectXagUsd(collectedAt),
      collectUsdCny(collectedAt),
      collectExchangeRates(collectedAt),
      collectAu9999(collectedAt),
      collectAgTd(collectedAt),
      collectBrands(collectedAt).catch((error) => unavailableBrands(error.message)),
      collectGuangdongFuel(collectedAt),
    ])
const internationalGoldCny = deriveInternationalGoldCny(xauUsd, usdCny, collectedAt)
const spread = deriveSpread(au9999, internationalGoldCny, collectedAt)
const internationalSilverCny = deriveInternationalSilverCny(xagUsd, usdCny, collectedAt)
const domesticSilverCny = deriveDomesticSilverCny(agTd, collectedAt)
const silverSpread = deriveSilverSpread(domesticSilverCny, internationalSilverCny, collectedAt)

const rawSnapshot = { collectedAt: collectedAt.toISOString(), xauUsd, xagUsd, usdCny, exchangeRates, au9999, agTd, internationalGoldCny, spread, internationalSilverCny, domesticSilverCny, silverSpread, brands, guangdongFuel }
const result = await persistSnapshot(rawSnapshot, DEFAULT_STORE_PATH)
console.log(JSON.stringify({ liveSnapshot: result.liveSnapshot, displaySnapshot: result.displaySnapshot }, null, 2))
