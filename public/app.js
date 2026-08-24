const app = document.querySelector('#app')
const readingNote = document.querySelector('#reading-note')
const refreshButton = document.querySelector('.display-refresh')
const pageTitle = document.querySelector('#page-title')
const pageKicker = document.querySelector('#page-kicker')
const pageShell = document.querySelector('.page-shell')
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
  'guangdong-fuel-92': '#205c50',
  'guangdong-fuel-95': '#a96f17',
  'guangdong-fuel-0-diesel': '#526f9e',
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

function statusText(item, compact = false) { return item.displayStatus === 'cached' ? compact ? '缓存' : '缓存数据' : item.available ? '当前有效' : '不可用' }

function quoteValue(item, unitLabel) {
  if (!item.available) return '暂无可靠数据'
  const sign = item.assetId === 'domestic-international-gold-spread' && item.value > 0 ? '+' : ''
  return `${sign}${formatter.format(item.value)}${unitLabel ? ` ${unitLabel}` : ''}`
}

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function statusLine(item, timeLabel = '行情时间', timeValue = item.observedAt, { showCurrentStatus = true, compactStatus = false } = {}) {
  const line = element('p', 'quote-meta')
  if (showCurrentStatus || item.displayStatus !== 'current' || !item.available) line.append(element('span', `status status-${item.displayStatus}`, statusText(item, compactStatus)))
  line.append(element('span', '', item.available ? `${timeLabel}：${dateTime(timeValue)}` : item.reason || '暂未取得可靠数据'))
  return line
}

function sourceLine(item, fallback = '公开报价') { return element('p', 'source-line', item.available ? `来源：${item.sourceLabel ?? fallback}` : '') }

function sectionHeading(title, note) {
  const heading = element('div', 'section-heading')
  heading.append(element('h2', '', title), element('p', '', note))
  return heading
}

function trendPoints(data, assetIds, days = trendRangeDays) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1_000
  return assetIds.map((assetId) => ({
    assetId,
    points: (data.history ?? []).filter((item) => item.assetId === assetId && Date.parse(item.timestamp) >= cutoff),
  }))
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
  const timeRange = domain.maxTime - domain.minTime || 1
  const x = (point) => left + (Date.parse(point.timestamp) - domain.minTime) / timeRange * plotWidth
  const y = (value) => top + (domain.maxValue - value) / valueRange * plotHeight
  const svg = svgNode('svg', { class: 'trend-svg', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': '历史趋势图' })
  ;[0, .5, 1].forEach((ratio) => svg.append(svgNode('line', { x1: left, y1: top + plotHeight * ratio, x2: width - right, y2: top + plotHeight * ratio, class: 'trend-grid-line' })))
  if (zeroLine && domain.minValue <= 0 && domain.maxValue >= 0) svg.append(svgNode('line', { x1: left, y1: y(0), x2: width - right, y2: y(0), class: 'trend-zero-line' }))
  ;[domain.maxValue, (domain.maxValue + domain.minValue) / 2, domain.minValue].forEach((value) => {
    const label = svgNode('text', { x: left - 7, y: y(value) + 3, class: 'trend-axis-label', 'text-anchor': 'end' })
    label.textContent = formatter.format(value)
    svg.append(label)
  })
  const firstLabel = svgNode('text', { x: left, y: height - 8, class: 'trend-axis-label' })
  firstLabel.textContent = dateShort(new Date(domain.minTime).toISOString())
  const lastLabel = svgNode('text', { x: width - right, y: height - 8, class: 'trend-axis-label', 'text-anchor': 'end' })
  lastLabel.textContent = dateShort(new Date(domain.maxTime).toISOString())
  svg.append(firstLabel, lastLabel)
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

function trendCard({ title, note, series, step = false, zeroLine = false, showRange = false, rangeDays = trendRangeDays }) {
  const card = element('section', 'trend-card')
  const heading = element('div', 'trend-card-heading')
  const titleNode = element('div')
  titleNode.append(element('h3', '', title), element('p', '', note))
  heading.append(titleNode)
  if (showRange) heading.append(trendRangeButtons())
  card.append(heading, trendLegend(series))
  const svg = chartSvg(series, { step, zeroLine })
  if (svg) card.append(svg)
  card.append(accumulationNote(series, rangeDays))
  return card
}

function fuelMovement(item) {
  if (item.points.length < 2) return '暂无前次调价记录'
  const delta = item.points.at(-1).value - item.points.at(-2).value
  if (delta === 0) return '最近一次未调价'
  return `最近一次${delta > 0 ? '上涨' : '下降'}${formatter.format(Math.abs(delta))}元/升`
}

function quoteCard(item, className = '', { unitLabel = item.unitLabel, source = false, timeLabel = '行情时间', timeValue = item.observedAt, showCurrentStatus = true, compactStatus = false } = {}) {
  const card = element('article', `quote-card ${className}`)
  const heading = element('div', 'quote-heading')
  heading.append(element('h3', '', item.label), element('span', 'unit', unitLabel))
  card.append(heading, element('strong', item.available ? 'quote-value' : 'quote-value unavailable-value', quoteValue(item)))
  if (item.assetId === 'domestic-international-gold-spread' && item.available) card.append(element('p', 'spread-percent', Number.isFinite(item.percentage) ? `较国际折算价 ${item.percentage >= 0 ? '+' : ''}${formatter.format(item.percentage)}%` : '百分比不可用'))
  card.append(statusLine(item, timeLabel, timeValue, { showCurrentStatus, compactStatus }))
  if (source) card.append(sourceLine(item))
  return card
}

function brandRow(item, detailed) {
  const row = element('article', detailed ? 'brand-row brand-detail' : 'brand-row')
  const label = element('div', 'brand-label')
  label.append(element('h3', '', item.label))
  if (detailed) label.append(element('p', 'product-line', item.product))
  row.append(label, element('strong', item.available ? '' : 'unavailable-value', quoteValue(item, '元/克')), statusLine(item))
  if (detailed) row.append(sourceLine(item))
  return row
}

function fuelCard(item, detailed = false) {
  const hasEffectiveTime = Boolean(item.effectiveAt)
  return quoteCard(item, `fuel-card fuel-${item.priority}`, {
    unitLabel: '元/升', source: detailed,
    timeLabel: hasEffectiveTime ? '生效时间' : '行情时间',
    timeValue: hasEffectiveTime ? item.effectiveAt : item.observedAt,
    showCurrentStatus: detailed,
    compactStatus: !detailed,
  })
}

function brandSummaryItem(item) {
  const itemNode = element('article', 'brand-summary-item')
  const heading = element('div', 'brand-summary-heading')
  heading.append(element('h3', '', item.label))
  if (item.displayStatus !== 'current' || !item.available) heading.append(element('span', `status status-${item.displayStatus}`, statusText(item, true)))
  itemNode.append(heading, element('strong', item.available ? '' : 'unavailable-value', quoteValue(item, '元/克')))
  return itemNode
}

function brandSummary(view) {
  const section = element('section', 'brands-section')
  section.append(sectionHeading('品牌金价', '足金饰品，元/克'))
  const summary = element('div', 'brand-summary')
  view.brands.forEach((item) => summary.append(brandSummaryItem(item)))
  const time = view.brands.find((item) => item.available)?.observedAt
  const meta = element('p', 'brand-summary-meta', time ? `报价时间：${dateTime(time)}` : '报价时间：暂无可靠数据')
  section.append(summary, meta)
  return section
}

function renderHome(view) {
  const fragment = document.createDocumentFragment()
  const goldSection = element('section', 'summary-section')
  goldSection.append(sectionHeading('金价摘要', '国际与国内金价'))
  const goldGrid = element('div', 'gold-grid')
  const homeGold = [{ ...view.xauUsd, label: '国际金价 XAU/USD' }, view.gold.find((item) => item.assetId === 'au9999')]
  homeGold.filter(Boolean).forEach((item) => goldGrid.append(quoteCard(item, '', { showCurrentStatus: false, compactStatus: true })))
  goldSection.append(goldGrid)
  const fuelSection = element('section', 'fuel-section')
  fuelSection.append(sectionHeading('油价摘要', '广东官方最高零售价'))
  const fuelGrid = element('div', 'fuel-grid')
  view.fuel.forEach((item) => fuelGrid.append(fuelCard(item)))
  fuelSection.append(fuelGrid)
  fragment.append(goldSection, brandSummary(view), fuelSection)
  return fragment
}

function renderGold(view) {
  const fragment = document.createDocumentFragment()
  const marketSection = element('section', 'summary-section')
  marketSection.append(sectionHeading('国际与国内参考', '金价与价差'))
  const goldGrid = element('div', 'gold-grid')
  view.gold.forEach((item) => goldGrid.append(quoteCard(item, item.assetId === 'domestic-international-gold-spread' ? 'gold-spread' : '', { source: true })))
  marketSection.append(goldGrid)
  const references = element('div', 'reference-list')
  view.references.forEach((item) => references.append(quoteCard(item, 'reference-card', { source: true })))
  marketSection.append(references)
  const historySection = element('section', 'trend-section')
  historySection.append(sectionHeading('金价趋势', '仅展示本地真实记录'))
  const goldSeries = trendPoints(latestData, ['international-gold-cny-gram', 'au9999'])
  goldSeries[0].label = '国际折算价'
  goldSeries[1].label = 'Au99.99'
  historySection.append(trendCard({ title: '国际折算价与Au99.99', note: '元/克，同一坐标便于观察差距', series: goldSeries, showRange: true }))
  const spreadSeries = trendPoints(latestData, ['domestic-international-gold-spread'])
  spreadSeries[0].label = '国内外价差'
  historySection.append(trendCard({ title: '国内外价差', note: '元/克，横线为0', series: spreadSeries, zeroLine: true }))
  const brandSection = element('section', 'brands-section')
  brandSection.append(sectionHeading('品牌金价', '品类、时间与来源'))
  const brandList = element('div', 'brand-list')
  view.brands.forEach((item) => brandList.append(brandRow(item, true)))
  brandSection.append(brandList)
  fragment.append(marketSection, historySection, brandSection)
  return fragment
}

function renderFuel(view) {
  const fragment = document.createDocumentFragment()
  const fuelSection = element('section', 'summary-section')
  fuelSection.append(sectionHeading('广东油价', '官方最高零售价'))
  const fuelGrid = element('div', 'fuel-grid')
  view.fuel.forEach((item) => fuelGrid.append(fuelCard(item, true)))
  fuelSection.append(fuelGrid)
  const trendSection = element('section', 'trend-section')
  trendSection.append(sectionHeading('油价调整记录', '按实际生效日期'))
  const fuelSeries = trendPoints(latestData, ['guangdong-fuel-92', 'guangdong-fuel-95', 'guangdong-fuel-0-diesel'], 30)
  fuelSeries[0].label = '92号汽油'
  fuelSeries[1].label = '95号汽油'
  fuelSeries[2].label = '0号柴油'
  trendSection.append(trendCard({ title: '广东油价调价趋势', note: '元/升，每个点为一次实际调价，展示近30天', series: fuelSeries, step: true, rangeDays: 30 }))
  const movements = element('div', 'fuel-movements')
  fuelSeries.forEach((item) => movements.append(element('p', '', `${item.label}：${fuelMovement(item)}`)))
  trendSection.append(movements)
  fragment.append(fuelSection, trendSection)
  return fragment
}

function render(data) {
  latestData = data
  const view = data.views[activeView]
  app.replaceChildren(activeView === 'home' ? renderHome(view) : activeView === 'gold' ? renderGold(view) : renderFuel(view), element('footer', 'page-footer', '只展示已保存的本地行情记录'))
  app.setAttribute('aria-busy', 'false')
  hasRendered = true
}

function selectView(viewName, focus = false) {
  activeView = viewName
  const titles = { home: ['日常行情', '广东 · 日常价格'], gold: ['金价', '国际、国内与品牌金价'], fuel: ['广东油价', '92、95与0号柴油'] }
  pageTitle.textContent = titles[viewName][0]
  pageKicker.textContent = titles[viewName][1]
  navigationButtons.forEach((button) => button.toggleAttribute('aria-current', button.dataset.view === viewName))
  if (latestData) render(latestData)
  if (focus) { pageShell.scrollTo({ top: 0, behavior: 'auto' }); pageTitle.focus({ preventScroll: true }) }
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
    const response = await fetch('/api/home', { cache: 'no-store' })
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
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')
loadDisplay()
