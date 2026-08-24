const app = document.querySelector('#app')
const readingNote = document.querySelector('#reading-note')
const refreshButton = document.querySelector('.display-refresh')
const pageTitle = document.querySelector('#page-title')
const pageKicker = document.querySelector('#page-kicker')
const navigationButtons = [...document.querySelectorAll('[data-view]')]
const formatter = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
let hasRendered = false
let activeView = 'home'
let latestData = null

function dateTime(value) {
  if (!value) return '暂无行情时间'
  const dateOnly = value.match(/^\d{4}-(\d{2})-(\d{2})$/)
  if (dateOnly) return `${Number(dateOnly[1])}月${Number(dateOnly[2])}日`
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const fields = Object.fromEntries(new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${fields.month}月${fields.day}日 ${fields.hour}:${fields.minute}`
}

function statusText(item) { return item.displayStatus === 'cached' ? '缓存数据' : item.available ? '当前有效' : '不可用' }

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

function statusLine(item, timeLabel = '行情时间', timeValue = item.observedAt) {
  const line = element('p', 'quote-meta')
  line.append(element('span', `status status-${item.displayStatus}`, statusText(item)), element('span', '', item.available ? `${timeLabel}：${dateTime(timeValue)}` : item.reason || '暂未取得可靠数据'))
  return line
}

function sourceLine(item, fallback = '公开报价') { return element('p', 'source-line', item.available ? `来源：${item.sourceLabel ?? fallback}` : '') }

function sectionHeading(title, note) {
  const heading = element('div', 'section-heading')
  heading.append(element('h2', '', title), element('p', '', note))
  return heading
}

function quoteCard(item, className = '', { unitLabel = item.unitLabel, source = false, timeLabel = '行情时间', timeValue = item.observedAt } = {}) {
  const card = element('article', `quote-card ${className}`)
  const heading = element('div', 'quote-heading')
  heading.append(element('h3', '', item.label), element('span', 'unit', unitLabel))
  card.append(heading, element('strong', item.available ? 'quote-value' : 'quote-value unavailable-value', quoteValue(item)))
  if (item.assetId === 'domestic-international-gold-spread' && item.available) card.append(element('p', 'spread-percent', Number.isFinite(item.percentage) ? `较国际折算价 ${item.percentage >= 0 ? '+' : ''}${formatter.format(item.percentage)}%` : '百分比不可用'))
  card.append(statusLine(item, timeLabel, timeValue))
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
  })
}

function renderHome(view) {
  const fragment = document.createDocumentFragment()
  const goldSection = element('section', 'summary-section')
  goldSection.append(sectionHeading('金价摘要', '国内参考，元/克'))
  const goldGrid = element('div', 'gold-grid')
  view.gold.forEach((item) => goldGrid.append(quoteCard(item, item.assetId === 'domestic-international-gold-spread' ? 'gold-spread' : '')))
  goldSection.append(goldGrid)
  const xau = element('article', 'reference-row')
  xau.append(element('span', '', view.xauUsd.label), element('strong', '', quoteValue(view.xauUsd, view.xauUsd.unitLabel)), statusLine(view.xauUsd))
  goldSection.append(xau)
  const fuelSection = element('section', 'fuel-section')
  fuelSection.append(sectionHeading('油价摘要', '广东官方最高零售价'))
  const fuelGrid = element('div', 'fuel-grid')
  view.fuel.forEach((item) => fuelGrid.append(fuelCard(item)))
  fuelSection.append(fuelGrid)
  const brandSection = element('section', 'brands-section')
  brandSection.append(sectionHeading('品牌金价', '足金饰品，元/克'))
  const brandList = element('div', 'brand-list')
  view.brands.forEach((item) => brandList.append(brandRow(item, false)))
  brandSection.append(brandList)
  fragment.append(goldSection, fuelSection, brandSection)
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
  const brandSection = element('section', 'brands-section')
  brandSection.append(sectionHeading('品牌金价', '品类、时间与来源'))
  const brandList = element('div', 'brand-list')
  view.brands.forEach((item) => brandList.append(brandRow(item, true)))
  brandSection.append(brandList)
  fragment.append(marketSection, brandSection)
  return fragment
}

function renderFuel(view) {
  const fragment = document.createDocumentFragment()
  const fuelSection = element('section', 'summary-section')
  fuelSection.append(sectionHeading('广东油价', '官方最高零售价'))
  const fuelGrid = element('div', 'fuel-grid')
  view.fuel.forEach((item) => fuelGrid.append(fuelCard(item, true)))
  fuelSection.append(fuelGrid)
  fragment.append(fuelSection)
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
  if (focus) { window.scrollTo({ top: 0, behavior: 'auto' }); pageTitle.focus({ preventScroll: true }) }
}

async function loadDisplay() {
  refreshButton.disabled = true
  refreshButton.setAttribute('aria-busy', 'true')
  refreshButton.textContent = '正在读取'
  readingNote.textContent = '正在读取本地展示数据'
  try {
    const response = await fetch('/api/home', { cache: 'no-store' })
    if (!response.ok) throw new Error('读取失败')
    render(await response.json())
    readingNote.textContent = '已重新读取本地展示数据'
  } catch {
    if (!hasRendered) { app.replaceChildren(element('p', 'load-error', '暂时无法读取数据')); app.setAttribute('aria-busy', 'false') }
    readingNote.textContent = '未能读取本地展示数据'
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
