import { collectionStatusForChina } from './collection-status.mjs'
import { SUPPORTED_CURRENCIES, convertExchangeRate } from './exchange-rates.js'

const app = document.querySelector('#app')
const readingNote = document.querySelector('#reading-note')
const refreshButton = document.querySelector('.display-refresh')
const pageTitle = document.querySelector('#page-title')
const pageKicker = document.querySelector('#page-kicker')
const pageShell = document.querySelector('.page-shell')
const topbar = document.querySelector('.topbar')
const collectionStatus = document.querySelector('#collection-status')
const navigationButtons = [...document.querySelectorAll('[data-view]')]
const formatter = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
let hasRendered = false
let activeView = 'home'
let latestData = null
let readingNoteTimer = null
let trendRangeDays = 7

const TREND_COLORS = {
  'international-gold-cny-gram': '#205c50',
  au9999: '#a96f17',
  'domestic-international-gold-spread': '#9d4a3f',
  'international-silver-cny-gram': '#526f9e',
  'domestic-silver-cny-gram': '#78865b',
  'domestic-international-silver-spread': '#9d4a3f',
  'guangdong-fuel-92': '#205c50',
  'guangdong-fuel-95': '#a96f17',
  'guangdong-fuel-0-diesel': '#526f9e',
  'brand-gold-chow-sang-sang': '#205c50',
  'brand-gold-chow-tai-fook': '#a96f17',
  'brand-gold-luk-fook': '#9d4a3f',
  'brand-gold-lao-feng-xiang': '#526f9e',
}

function dateTime(value) {
  if (!value) return '暂无行情时间'
  const dateOnly = value.match(/^\d{4}-(\d{2})-(\d{2})$/)
  if (dateOnly) return `${Number(dateOnly[1])}月${Number(dateOnly[2])}日`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const fields = Object.fromEntries(new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${fields.month}月${fields.day}日 ${fields.hour}:${fields.minute}`
}

function dateShort(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value ?? ''
  const fields = Object.fromEntries(new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', timeZone: 'Asia/Shanghai' }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${fields.month}/${fields.day}`
}

function statusText(item) {
  if (item.displayStatus === 'cached') return '缓存'
  const reason = item.reason ?? ''
  if (/过期|非新鲜|新鲜度/.test(reason)) return item.assetId === 'usd-cny' ? '汇率过期' : '数据较旧'
  if (/失败|超时|请求|采集|获取/.test(reason)) return '获取失败'
  return '不可用'
}

function quoteValue(item, unitLabel) {
  if (!item.available) return '暂无可靠数据'
  const sign = item.assetId.endsWith('spread') && item.value > 0 ? '+' : ''
  return `${sign}${formatter.format(item.value)}${unitLabel ? ` ${unitLabel}` : ''}`
}

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function statusLine(item, timeLabel = '行情时间', timeValue = item.observedAt, { showCurrentStatus = false } = {}) {
  const line = element('p', 'quote-meta')
  if (showCurrentStatus || item.displayStatus !== 'current' || !item.available) line.append(element('span', `status status-${item.displayStatus}`, statusText(item)))
  line.append(element('span', '', item.available ? `${timeLabel}：${dateTime(timeValue)}` : item.reason || '暂未取得可靠数据'))
  return line
}

function displaySourceLabel(item, fallback = '公开报价') {
  if (['au9999', 'ag-td', 'domestic-silver-cny-gram'].includes(item.assetId)) return '上海黄金交易所'
  return item.sourceLabel ?? fallback
}

function sourceLine(item, fallback = '公开报价') { return element('p', 'source-line', item.available ? displaySourceLabel(item, fallback) : '') }

function cacheNote(items) {
  if (!items.some((item) => item?.displayStatus === 'cached')) return null
  return element('p', 'cache-note', '部分数据来自最近一次有效缓存')
}

function sectionHeading(title, note) {
  const heading = element('div', 'section-heading')
  heading.append(element('h2', '', title), element('p', '', note))
  return heading
}

function trendPoints(data, assetIds, days = trendRangeDays, historyKey = 'history') {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1_000
  return assetIds.map((assetId) => ({
    assetId,
    points: (data[historyKey] ?? [])
      .filter((item) => item.assetId === assetId && Date.parse(item.date ?? item.timestamp) >= cutoff)
      .map((item) => ({ ...item, timestamp: item.date ?? item.timestamp })),
  }))
}

function sharedQuoteDay(items) {
  const days = [...new Set(items.filter((item) => item?.available).map((item) => dateTime(item.observedAt).split(' ')[0]))]
  return days.length === 1 ? days[0] : null
}

function svgNode(name, attributes = {}) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name)
  Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value)))
  return node
}

function scaleDomain(series) {
  const points = series.flatMap((item) => item.points)
  if (!points.length) return null
  const values = points.map((item) => item.value)
  const times = points.map((item) => Date.parse(item.timestamp))
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const padding = Math.max((maxValue - minValue) * 0.15, Math.abs(maxValue) * 0.002, 0.02)
  return { minValue: minValue - padding, maxValue: maxValue + padding, minTime: Math.min(...times), maxTime: Math.max(...times) }
}

function chartSvg(series, { step = false, zeroLine = false } = {}) {
  const domain = scaleDomain(series)
  if (!domain) return null
  const width = 320
  const height = 174
  const left = 39
  const right = 12
  const top = 17
  const bottom = 31
  const plotWidth = width - left - right
  const plotHeight = height - top - bottom
  const valueRange = domain.maxValue - domain.minValue || 1
  const hasTimeRange = domain.maxTime !== domain.minTime
  const timeRange = domain.maxTime - domain.minTime || 1
  const x = (point) => hasTimeRange ? left + (Date.parse(point.timestamp) - domain.minTime) / timeRange * plotWidth : left + plotWidth / 2
  const y = (value) => top + (domain.maxValue - value) / valueRange * plotHeight
  const svg = svgNode('svg', { class: 'trend-svg', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': '历史趋势图' })
  ;[0, .5, 1].forEach((ratio) => svg.append(svgNode('line', { x1: left, y1: top + plotHeight * ratio, x2: width - right, y2: top + plotHeight * ratio, class: 'trend-grid-line' })))
  if (zeroLine && domain.minValue <= 0 && domain.maxValue >= 0) svg.append(svgNode('line', { x1: left, y1: y(0), x2: width - right, y2: y(0), class: 'trend-zero-line' }))
  ;[domain.maxValue, (domain.maxValue + domain.minValue) / 2, domain.minValue].forEach((value) => {
    const label = svgNode('text', { x: left - 7, y: y(value) + 3, class: 'trend-axis-label', 'text-anchor': 'end' })
    label.textContent = formatter.format(value)
    svg.append(label)
  })
  const firstLabel = svgNode('text', { x: hasTimeRange ? left : width / 2, y: height - 8, class: 'trend-axis-label', ...(hasTimeRange ? {} : { 'text-anchor': 'middle' }) })
  firstLabel.textContent = dateShort(new Date(domain.minTime).toISOString())
  svg.append(firstLabel)
  if (hasTimeRange) {
    const lastLabel = svgNode('text', { x: width - right, y: height - 8, class: 'trend-axis-label', 'text-anchor': 'end' })
    lastLabel.textContent = dateShort(new Date(domain.maxTime).toISOString())
    svg.append(lastLabel)
  }
  series.forEach(({ assetId, points }) => {
    if (!points.length) return
    const commands = points.map((point, index) => {
      const pointX = x(point)
      const pointY = y(point.value)
      if (!index) return `M ${pointX} ${pointY}`
      return step ? `H ${pointX} V ${pointY}` : `L ${pointX} ${pointY}`
    })
    svg.append(svgNode('path', { d: commands.join(' '), class: 'trend-line', stroke: TREND_COLORS[assetId] }))
    points.forEach((point) => svg.append(svgNode('circle', { cx: x(point), cy: y(point.value), r: 3.5, class: 'trend-dot', fill: TREND_COLORS[assetId] })))
  })
  return svg
}

function trendLegend(items) {
  const legend = element('div', 'trend-legend')
  items.forEach(({ assetId, label }) => {
    const item = element('span', 'trend-legend-item')
    const dot = element('i', 'trend-legend-dot')
    dot.style.background = TREND_COLORS[assetId]
    item.append(dot, document.createTextNode(label))
    legend.append(item)
  })
  return legend
}

function trendRangeButtons() {
  const controls = element('div', 'trend-range')
  ;[[7, '7天'], [30, '30天']].forEach(([days, label]) => {
    const button = element('button', '', label)
    button.type = 'button'
    button.setAttribute('aria-pressed', String(trendRangeDays === days))
    button.addEventListener('click', () => { trendRangeDays = days; render(latestData) })
    controls.append(button)
  })
  return controls
}

function accumulationNote(series, days) {
  const points = series.flatMap((item) => item.points)
  if (!points.length) return element('p', 'trend-note', '历史数据积累中，尚无真实记录')
  const timestamps = points.map((item) => Date.parse(item.timestamp))
  const coverage = Math.max(...timestamps) - Math.min(...timestamps)
  if (points.length < 2 || coverage < days * 24 * 60 * 60 * 1_000) return element('p', 'trend-note', `历史数据积累中，目前仅有${points.length}条真实记录`)
  return element('p', 'trend-note', `近${days}天，共${points.length}条真实记录`)
}

function goldTrendNote(series, days) {
  const counts = series.map((item) => `${item.label}${item.points.length}条`)
  if (series.every((item) => item.points.length >= 2)) return accumulationNote(series, days)
  return element('p', 'trend-note', `历史数据积累中，${counts.join('，')}`)
}

function spreadTrendNote(series, currentSpread, days) {
  const count = series[0].points.length
  if (!count) return element('p', 'trend-note', currentSpread?.available ? '暂无历史记录，等待下一次采集' : '暂无历史记录')
  if (count === 1) return element('p', 'trend-note', '当前仅有1条历史记录，数据积累中')
  return accumulationNote(series, days)
}

function trendCard({ title, note, series, step = false, zeroLine = false, showRange = false, rangeDays = trendRangeDays, statusNote }) {
  const card = element('section', 'trend-card')
  const heading = element('div', 'trend-card-heading')
  const titleNode = element('div')
  titleNode.append(element('h3', '', title), element('p', '', note))
  heading.append(titleNode)
  if (showRange) heading.append(trendRangeButtons())
  card.append(heading, trendLegend(series))
  const svg = chartSvg(series, { step, zeroLine })
  if (svg) card.append(svg)
  card.append(statusNote ? statusNote() : accumulationNote(series, rangeDays))
  return card
}

function fuelMovement(item) {
  if (item.points.length < 2) return '暂无前次调价记录'
  const delta = item.points.at(-1).value - item.points.at(-2).value
  if (delta === 0) return '最近一次未调价'
  return `最近一次${delta > 0 ? '上涨' : '下降'}${formatter.format(Math.abs(delta))}元/升`
}

function fuelTrendPoints(data, assetIds, maxRecords = 10) {
  const records = (data.history ?? []).filter((item) => assetIds.includes(item.assetId))
  const timestamps = [...new Set(records.map((item) => item.timestamp))].sort((left, right) => Date.parse(left) - Date.parse(right)).slice(-maxRecords)
  const includedTimestamps = new Set(timestamps)
  return assetIds.map((assetId) => ({ assetId, points: records.filter((item) => item.assetId === assetId && includedTimestamps.has(item.timestamp)) }))
}

const QUOTE_COPY = {
  'xau-usd': { title: '国际黄金', subtitle: 'XAU/USD' },
  au9999: { title: '国内黄金', subtitle: '上金所 Au99.99' },
  'usd-cny': { title: '美元兑人民币', subtitle: 'USD/CNY' },
  'international-gold-cny-gram': { title: '国际黄金折算', subtitle: '折算人民币/克' },
  'domestic-international-gold-spread': { title: '国内外价差', subtitle: '上金所金价 - 国际折算价' },
  'xag-usd': { title: '国际白银', subtitle: 'XAG/USD' },
  'international-silver-cny-gram': { title: '国际白银折算', subtitle: '折算人民币/克' },
  'domestic-silver-cny-gram': { title: '国内白银', subtitle: '上金所 Ag(T+D)' },
  'domestic-international-silver-spread': { title: '国内外价差', subtitle: '国内白银 - 国际折算价' },
}

function quoteCopy(item) { return QUOTE_COPY[item.assetId] ?? { title: item.label, subtitle: null } }

function quoteCard(item, className = '', { unitLabel = item.unitLabel, source = false, timeLabel = '行情时间', timeValue = item.observedAt, showCurrentStatus = false, exceptionStatusOnly = false, showExceptionalMeta = false } = {}) {
  const card = element('article', `quote-card ${className}`)
  const copy = quoteCopy(item)
  const isSpread = item.assetId.endsWith('spread')
  const isSpot = ['xau-usd', 'xag-usd'].includes(item.assetId)
  const heading = element('div', 'quote-heading')
  const displayTitle = isSpot && !className.includes('home-quote')
    ? (item.assetId === 'xau-usd' ? '国际现货黄金' : '国际现货白银')
    : copy.title
  heading.append(element('h3', '', displayTitle))
  if (isSpread) heading.append(element('span', 'spread-heading-note', copy.subtitle))
  else if (isSpot) heading.append(element('span', 'unit', unitLabel === 'USD/盎司' ? '美元/盎司' : unitLabel))
  else if (unitLabel) heading.append(element('span', 'unit', unitLabel))
  card.append(heading)
  if (isSpread && item.available) {
    const values = element('div', 'spread-values')
    const amount = element('div', 'spread-metric')
    amount.append(element('strong', 'quote-value', quoteValue(item)), element('span', 'spread-unit', '元/克'))
    const percentage = element('div', 'spread-metric spread-percentage')
    percentage.append(element('strong', 'spread-percent-value', Number.isFinite(item.percentage) ? `${item.percentage >= 0 ? '+' : ''}${formatter.format(item.percentage)}%` : '百分比不可用'), element('span', 'spread-context', item.assetId.includes('silver') ? '相对国际白银折算价' : '相对国际折算价'))
    values.append(amount, percentage)
    card.append(values)
  } else {
    card.append(element('strong', item.available ? 'quote-value' : 'quote-value unavailable-value', quoteValue(item)))
    if (!isSpot && copy.subtitle) card.append(element('p', 'quote-subtitle', copy.subtitle))
  }
  if (exceptionStatusOnly) {
    if (item.displayStatus !== 'cached' && (item.displayStatus !== 'current' || !item.available)) card.append(element('p', 'quote-meta quote-exception', statusText(item)))
  } else if (showExceptionalMeta) {
    if (item.displayStatus !== 'cached' && (item.displayStatus !== 'current' || !item.available)) card.append(statusLine(item, timeLabel, timeValue, { showCurrentStatus }))
  } else if (item.displayStatus !== 'cached' && (item.displayStatus !== 'current' || !item.available)) {
    card.append(statusLine(item, timeLabel, timeValue, { showCurrentStatus }))
  }
  if (source && isSpot && item.available) {
    const spotSource = element('p', 'source-line spot-source-line')
    spotSource.append(element('span', '', copy.subtitle), element('span', '', displaySourceLabel(item)))
    card.append(spotSource)
  }
  else if (source && !isSpot && !['international-gold-cny-gram', 'au9999', 'international-silver-cny-gram', 'domestic-silver-cny-gram', 'ag-td'].includes(item.assetId) && item.sourceLabel !== '公式计算') card.append(sourceLine(item))
  return card
}

function brandRow(item, detailed) {
  const row = element('article', detailed ? 'brand-row brand-detail' : 'brand-row')
  if (detailed) {
    const main = element('div', 'brand-main')
    main.append(
      element('h3', 'brand-name', item.label),
      element('span', 'brand-product', item.product),
      element('strong', item.available ? '' : 'unavailable-value', quoteValue(item, '元/克')),
    )
    const meta = element('p', 'brand-meta', item.available ? `${dateTime(item.observedAt)} · ${displaySourceLabel(item)}` : item.reason || '暂未取得可靠数据')
    if (item.displayStatus !== 'cached' && (item.displayStatus !== 'current' || !item.available)) meta.append(document.createTextNode(' · '), element('span', `status status-${item.displayStatus}`, statusText(item)))
    row.append(main, meta)
    return row
  }
  const label = element('div', 'brand-label')
  label.append(element('h3', '', item.label))
  if (detailed) label.append(element('p', 'product-line', item.product))
  row.append(label, element('strong', item.available ? '' : 'unavailable-value', quoteValue(item, '元/克')), statusLine(item))
  return row
}

function fuelCard(item, detailed = false) {
  const card = element('article', `fuel-card ${detailed ? 'fuel-detail' : 'fuel-summary'}`)
  card.append(element('h3', 'fuel-name', item.label))
  const valueLine = element('div', 'fuel-value-line')
  valueLine.append(element('strong', item.available ? 'quote-value' : 'quote-value unavailable-value', quoteValue(item)))
  if (item.available) valueLine.append(element('span', 'fuel-unit', '元/升'))
  card.append(valueLine)
  if (item.displayStatus !== 'current' || !item.available) card.append(element('p', 'quote-meta quote-exception', statusText(item)))
  return card
}

function brandSummaryItem(item) {
  const itemNode = element('article', 'brand-summary-item')
  const heading = element('div', 'brand-summary-heading')
  heading.append(element('h3', '', item.label))
  if (item.displayStatus !== 'cached' && (item.displayStatus !== 'current' || !item.available)) heading.append(element('span', `status status-${item.displayStatus}`, statusText(item)))
  itemNode.append(heading, element('strong', item.available ? '' : 'unavailable-value', quoteValue(item, '元/克')))
  return itemNode
}

function brandSummary(view) {
  const section = element('section', 'brands-section')
  section.append(sectionHeading('品牌黄金', '足金饰品，元/克'))
  const summary = element('div', 'brand-summary')
  view.brands.forEach((item) => summary.append(brandSummaryItem(item)))
  section.append(summary)
  const note = cacheNote(view.brands)
  if (note) section.append(note)
  return section
}

function renderHome(view) {
  const fragment = document.createDocumentFragment()
  const goldSection = element('section', 'summary-section')
  goldSection.append(sectionHeading('黄金摘要', '国际与国内黄金'))
  const goldGrid = element('div', 'gold-grid')
  const homeGold = view.gold
  homeGold.filter(Boolean).forEach((item) => goldGrid.append(quoteCard(item, 'home-quote', { showExceptionalMeta: true })))
  goldSection.append(goldGrid)
  const goldCacheNote = cacheNote(homeGold)
  if (goldCacheNote) goldSection.append(goldCacheNote)
  const silverSection = element('section', 'summary-section')
  silverSection.append(sectionHeading('白银摘要', '国际与国内白银'))
  const silverGrid = element('div', 'gold-grid')
  view.silver.forEach((item) => silverGrid.append(quoteCard(item, 'home-quote', { showExceptionalMeta: true })))
  silverSection.append(silverGrid)
  const silverCacheNote = cacheNote(view.silver)
  if (silverCacheNote) silverSection.append(silverCacheNote)
  const fuelSection = element('section', 'fuel-section')
  fuelSection.append(sectionHeading('油价摘要', '广东官方最高零售价'))
  const fuelGrid = element('div', 'fuel-grid')
  view.fuel.forEach((item) => fuelGrid.append(fuelCard(item)))
  fuelSection.append(fuelGrid)
  fragment.append(goldSection, silverSection, brandSummary(view), fuelSection)
  return fragment
}

function renderGold(view) {
  const fragment = document.createDocumentFragment()
  const marketSection = element('section', 'summary-section')
  const marketQuotes = [...view.gold, ...view.references]
  const marketDate = sharedQuoteDay(marketQuotes)
  marketSection.append(sectionHeading('黄金参考', marketDate ? `数据日期：${marketDate}` : '黄金与价差'))
  const goldGrid = element('div', 'gold-grid')
  view.gold.forEach((item) => goldGrid.append(quoteCard(item, item.assetId === 'domestic-international-gold-spread' ? 'gold-spread' : 'market-quote', { source: true, showExceptionalMeta: Boolean(marketDate) })))
  marketSection.append(goldGrid)
  const goldCacheNote = cacheNote(view.gold)
  if (goldCacheNote) marketSection.append(goldCacheNote)
  const references = element('div', 'reference-list')
  view.references.forEach((item) => references.append(quoteCard(item, `reference-card ${['xau-usd', 'xag-usd'].includes(item.assetId) ? 'spot-quote' : ''}`, { source: true, unitLabel: item.unitLabel === 'USD/盎司' ? '美元/盎司' : item.unitLabel, showExceptionalMeta: Boolean(marketDate) })))
  marketSection.append(references)
  const referenceCacheNote = cacheNote(view.references)
  if (referenceCacheNote) marketSection.append(referenceCacheNote)
  const historySection = element('section', 'trend-section')
  historySection.append(sectionHeading('黄金趋势', '仅展示本地真实记录'))
  const goldSeries = trendPoints(latestData, ['international-gold-cny-gram', 'au9999'])
  goldSeries[0].label = '国际黄金折算'
  goldSeries[1].label = '国内黄金'
  historySection.append(trendCard({ title: '国际与国内黄金', note: '元/克，同一坐标便于观察差距', series: goldSeries, showRange: true, statusNote: () => goldTrendNote(goldSeries, trendRangeDays) }))
  const spreadSeries = trendPoints(latestData, ['domestic-international-gold-spread'])
  spreadSeries[0].label = '国内外价差'
  const currentSpread = view.gold.find((item) => item.assetId === 'domestic-international-gold-spread')
  historySection.append(trendCard({ title: '国内外价差', note: '元/克，横线为0', series: spreadSeries, zeroLine: true, statusNote: () => spreadTrendNote(spreadSeries, currentSpread, trendRangeDays) }))
  const brandSection = element('section', 'brands-section')
  brandSection.append(sectionHeading('品牌黄金', '品类、时间与来源'))
  const brandList = element('div', 'brand-list')
  view.brands.forEach((item) => brandList.append(brandRow(item, true)))
  brandSection.append(brandList)
  const brandCacheNote = cacheNote(view.brands)
  if (brandCacheNote) brandSection.append(brandCacheNote)
  const brandTrendSection = element('section', 'trend-section brand-trend-section')
  brandTrendSection.append(sectionHeading('品牌黄金趋势', '仅展示已结束自然日'))
  const brandSeries = trendPoints(latestData, [
    'brand-gold-chow-sang-sang',
    'brand-gold-chow-tai-fook',
    'brand-gold-luk-fook',
    'brand-gold-lao-feng-xiang',
  ], trendRangeDays, 'brandHistory')
  brandSeries[0].label = '周生生'
  brandSeries[1].label = '周大福'
  brandSeries[2].label = '六福'
  brandSeries[3].label = '老凤祥'
  brandTrendSection.append(trendCard({
    title: '四品牌黄金', note: '元/克，每品牌每天最多1条真实记录', series: brandSeries, showRange: true,
    statusNote: () => goldTrendNote(brandSeries, trendRangeDays),
  }))
  fragment.append(marketSection, historySection, brandSection, brandTrendSection)
  return fragment
}

function renderSilver(view) {
  const fragment = document.createDocumentFragment()
  const marketSection = element('section', 'summary-section')
  const marketQuotes = [...view.silver, ...view.references]
  const marketDate = sharedQuoteDay(marketQuotes)
  marketSection.append(sectionHeading('白银参考', marketDate ? `数据日期：${marketDate}` : '白银与价差'))
  const silverGrid = element('div', 'gold-grid')
  view.silver.forEach((item) => silverGrid.append(quoteCard(item, item.assetId.endsWith('spread') ? 'gold-spread silver-spread' : 'market-quote', { source: true, showExceptionalMeta: Boolean(marketDate) })))
  marketSection.append(silverGrid)
  const silverCacheNote = cacheNote(view.silver)
  if (silverCacheNote) marketSection.append(silverCacheNote)
  const references = element('div', 'reference-list')
  view.references.forEach((item) => references.append(quoteCard(item, `reference-card ${['xau-usd', 'xag-usd'].includes(item.assetId) ? 'spot-quote' : ''}`, { source: true, unitLabel: item.unitLabel === 'USD/盎司' ? '美元/盎司' : item.unitLabel, showExceptionalMeta: Boolean(marketDate) })))
  marketSection.append(references)
  const referenceCacheNote = cacheNote(view.references)
  if (referenceCacheNote) marketSection.append(referenceCacheNote)
  const historySection = element('section', 'trend-section')
  historySection.append(sectionHeading('白银趋势', '仅展示本地真实记录'))
  const silverSeries = trendPoints(latestData, ['international-silver-cny-gram', 'domestic-silver-cny-gram'])
  silverSeries[0].label = '国际白银折算'
  silverSeries[1].label = '国内白银'
  historySection.append(trendCard({ title: '国际与国内白银', note: '元/克，同一坐标便于观察差距', series: silverSeries, showRange: true, statusNote: () => goldTrendNote(silverSeries, trendRangeDays) }))
  const spreadSeries = trendPoints(latestData, ['domestic-international-silver-spread'])
  spreadSeries[0].label = '国内外价差'
  const currentSpread = view.silver.find((item) => item.assetId === 'domestic-international-silver-spread')
  historySection.append(trendCard({ title: '国内外价差', note: '元/克，横线为0', series: spreadSeries, zeroLine: true, statusNote: () => spreadTrendNote(spreadSeries, currentSpread, trendRangeDays) }))
  fragment.append(marketSection, historySection)
  return fragment
}

function renderFuel(view) {
  const fragment = document.createDocumentFragment()
  const fuelSection = element('section', 'summary-section')
  const currentFuel = view.fuel.find((item) => item.effectiveAt) ?? view.fuel[0]
  const fuelHeading = element('div', 'fuel-page-heading')
  fuelHeading.append(element('h2', '', '广东最高零售价'))
  const fuelContext = element('div', 'fuel-context')
  fuelContext.append(
    element('p', '', currentFuel?.effectiveAt ? `当前有效 · 自${dateTime(currentFuel.effectiveAt)}起执行` : '当前有效时间暂无可靠数据'),
    element('p', '', `来源：${currentFuel?.sourceLabel ?? '广东省发展改革委'}`),
    element('p', 'fuel-note', '各加油站实际售价可能低于政府最高零售价。'),
  )
  fuelHeading.append(fuelContext)
  fuelSection.append(fuelHeading)
  const fuelGrid = element('div', 'fuel-grid')
  view.fuel.forEach((item) => fuelGrid.append(fuelCard(item, true)))
  fuelSection.append(fuelGrid)
  const trendSection = element('section', 'trend-section')
  trendSection.append(sectionHeading('油价调整记录', '最近10次调价'))
  const fuelSeries = fuelTrendPoints(latestData, ['guangdong-fuel-92', 'guangdong-fuel-95', 'guangdong-fuel-0-diesel'])
  fuelSeries[0].label = '92号汽油'
  fuelSeries[1].label = '95号汽油'
  fuelSeries[2].label = '0号柴油'
  const fuelRecordCount = new Set(fuelSeries.flatMap((item) => item.points.map((point) => point.timestamp))).size
  if (fuelRecordCount < 2) {
    trendSection.append(element('p', 'trend-note', fuelRecordCount === 1 ? '当前仅有1次调价记录，历史数据积累中' : '历史数据积累中，尚无真实调价记录'))
  } else {
    trendSection.append(trendCard({ title: '广东油价调价趋势', note: '元/升，每个点为一次实际调价，展示最近10次', series: fuelSeries, step: true }))
    const movements = element('div', 'fuel-movements')
    fuelSeries.forEach((item) => movements.append(element('p', '', `${item.label}：${fuelMovement(item)}`)))
    trendSection.append(movements)
  }
  fragment.append(fuelSection, trendSection)
  return fragment
}

function renderExchange(view) {
  const rates = view.exchangeRates
  const fragment = document.createDocumentFragment()
  const converterSection = element('section', 'exchange-section')
  converterSection.append(sectionHeading('货币换算器', rates?.available ? `数据时间：${dateTime(rates.sourceObservedAt)}` : ''))
  const form = element('div', 'exchange-converter')
  const amount = element('input', 'exchange-amount'); amount.type = 'number'; amount.inputMode = 'decimal'; amount.min = '0'; amount.step = 'any'; amount.placeholder = '输入金额'; amount.value = '1'; amount.setAttribute('aria-label', '金额')
  const from = element('select', 'exchange-select'); from.setAttribute('aria-label', '起始币种')
  const to = element('select', 'exchange-select'); to.setAttribute('aria-label', '目标币种')
  SUPPORTED_CURRENCIES.forEach(({ code, name }) => { from.append(new Option(`${code} ${name}`, code)); to.append(new Option(`${code} ${name}`, code)) })
  from.value = 'CNY'; to.value = 'USD'
  const swap = element('button', 'exchange-swap', '⇄'); swap.type = 'button'; swap.setAttribute('aria-label', '交换币种')
  const result = element('output', 'exchange-result'); result.setAttribute('aria-live', 'polite')
  const update = () => { const converted = convertExchangeRate(amount.value, from.value, to.value, rates); result.textContent = rates?.available && converted !== null ? `${converted.toLocaleString('zh-CN', { maximumFractionDigits: 6 })} ${to.value}` : '' }
  amount.addEventListener('input', update); from.addEventListener('change', update); to.addEventListener('change', update)
  swap.addEventListener('click', () => { const current = from.value; from.value = to.value; to.value = current; update(); from.focus() })
  const isUnavailable = !rates?.available
  ;[amount, from, swap, to].forEach((control) => { control.disabled = isUnavailable })
  form.append(amount, from, swap, to, result); converterSection.append(form)
  if (isUnavailable) converterSection.append(element('p', 'exchange-unavailable', '汇率数据暂不可用，请稍后查看'))
  const listSection = element('section', 'exchange-section'); listSection.append(sectionHeading('常用汇率', '以人民币为参照'))
  const list = element('div', 'exchange-list')
  if (rates?.available) SUPPORTED_CURRENCIES.filter(({ code }) => code !== 'CNY').forEach(({ code, name, displayUnit }) => {
    const row = element('article', 'exchange-row'); const unit = displayUnit
    const value = rates.rates?.[code] ? rates.rates.CNY / rates.rates[code] * unit : null
    row.append(element('div', 'exchange-currency', `${code} ${name}`), element('strong', value === null ? 'unavailable-value' : '', value === null ? '暂无' : `${unit} ${code} = ${value.toLocaleString('zh-CN', { maximumFractionDigits: 6 })} 元`)); list.append(row)
  })
  if (rates?.available) listSection.append(list, element('p', 'exchange-source', `来源：${rates.sourceName} · 更新时间：${dateTime(rates.sourceObservedAt)}`))
  fragment.append(converterSection, listSection); update(); return fragment
}

function render(data) {
  latestData = data
  updateCollectionStatus(data.collection)
  topbar.classList.toggle('home-topbar', activeView === 'home')
  collectionStatus.hidden = activeView !== 'home'
  const view = data.views[activeView]
  app.replaceChildren(activeView === 'home' ? renderHome(view) : activeView === 'gold' ? renderGold(view) : activeView === 'silver' ? renderSilver(view) : activeView === 'exchange' ? renderExchange(view) : renderFuel(view))
  app.setAttribute('aria-busy', 'false')
  hasRendered = true
}

function selectView(viewName, focus = false) {
  activeView = viewName
  const titles = { home: ['日常行情', null], gold: ['黄金', '国际、国内与品牌黄金'], silver: ['白银', '国际与国内白银'], exchange: ['汇率', null], fuel: ['广东油价', null] }
  pageTitle.textContent = titles[viewName][0]
  pageKicker.textContent = titles[viewName][1] ?? ''
  pageKicker.hidden = !titles[viewName][1]
  topbar.classList.toggle('home-topbar', viewName === 'home')
  collectionStatus.hidden = viewName !== 'home'
  navigationButtons.forEach((button) => {
    if (button.dataset.view === viewName) button.setAttribute('aria-current', 'page')
    else button.removeAttribute('aria-current')
  })
  if (latestData) render(latestData)
  if (focus) { pageShell.scrollTo({ top: 0, behavior: 'auto' }); pageTitle.focus({ preventScroll: true }) }
}

function updateCollectionStatus(collection) {
  const status = collectionStatusForChina(collection)
  collectionStatus.replaceChildren(
    element('span', 'collection-status-label', '今日采集状态'),
    element('strong', `collection-status-value collection-status-${status.kind}`, status.label),
  )
}

function setReadingNote(message, duration = 0) {
  if (readingNoteTimer) clearTimeout(readingNoteTimer)
  readingNote.textContent = message
  readingNote.hidden = false
  if (duration) readingNoteTimer = setTimeout(() => { readingNote.hidden = true }, duration)
}

async function loadDisplay() {
  refreshButton.disabled = true
  refreshButton.setAttribute('aria-busy', 'true')
  refreshButton.textContent = '正在读取'
  setReadingNote('正在读取本地展示数据')
  try {
    const response = await fetch(new URL('./api/home.json', import.meta.url), { cache: 'no-store' })
    if (!response.ok) throw new Error('读取失败')
    render(await response.json())
    setReadingNote('已重新读取本地展示数据', 2200)
  } catch {
    if (!hasRendered) { app.replaceChildren(element('p', 'load-error', '暂时无法读取数据')); app.setAttribute('aria-busy', 'false') }
    setReadingNote('未能读取本地展示数据')
  } finally {
    refreshButton.disabled = false
    refreshButton.removeAttribute('aria-busy')
    refreshButton.textContent = '刷新显示'
  }
}

navigationButtons.forEach((button) => button.addEventListener('click', () => selectView(button.dataset.view, true)))
refreshButton.addEventListener('click', loadDisplay)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js')
loadDisplay()
