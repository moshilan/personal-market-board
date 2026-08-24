const app = document.querySelector('#app')
const readingNote = document.querySelector('#reading-note')
const refreshButton = document.querySelector('.display-refresh')
const formatter = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function dateTime(value) {
  if (!value) return '暂无行情时间'
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.replaceAll('-', '.')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' }).format(date)
}

function statusText(item) {
  if (item.displayStatus === 'cached') return '缓存数据'
  if (item.available) return '当前有效'
  return '不可用'
}

function quoteValue(item, unitLabel) {
  if (!item.available) return '不可用'
  const sign = item.assetId === 'domestic-international-gold-spread' && item.value > 0 ? '+' : ''
  const value = `${sign}${formatter.format(item.value)}`
  return unitLabel ? `${value} ${unitLabel}` : value
}

function element(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function statusLine(item) {
  const line = element('p', 'quote-meta')
  const status = element('span', `status status-${item.displayStatus}`, statusText(item))
  const time = element('span', '', item.available ? dateTime(item.observedAt) : item.reason || '暂无可靠数据')
  line.append(status, time)
  return line
}

function goldCard(item) {
  const cardType = item.assetId === 'xau-usd' ? 'gold-primary' : item.assetId === 'domestic-international-gold-spread' ? 'gold-spread' : ''
  const card = element('article', `gold-card ${cardType}`)
  const heading = element('div', 'quote-heading')
  heading.append(element('h3', '', item.label), element('span', 'unit', item.unitLabel))
  const value = element('strong', item.available ? 'quote-value' : 'quote-value unavailable-value', quoteValue(item))
  card.append(heading, value)
  if (item.assetId === 'domestic-international-gold-spread' && item.available) {
    const percentage = Number.isFinite(item.percentage) ? `较国际折算价 ${item.percentage >= 0 ? '+' : ''}${formatter.format(item.percentage)}%` : '百分比不可用'
    card.append(element('p', 'spread-percent', percentage))
  }
  card.append(statusLine(item))
  return card
}

function sectionHeading(title, note) {
  const heading = element('div', 'section-heading')
  heading.append(element('h2', '', title), element('p', '', note))
  return heading
}

function render(data) {
  app.replaceChildren()
  const goldSection = element('section', 'gold-section')
  goldSection.append(sectionHeading('黄金', '国际现货与国内参考'))
  const goldGrid = element('div', 'gold-grid')
  data.gold.forEach((item) => goldGrid.append(goldCard(item)))
  goldSection.append(goldGrid)

  const brandsSection = element('section', 'brands-section')
  brandsSection.append(sectionHeading('品牌金价', '足金饰品，元/克'))
  const brandList = element('div', 'brand-list')
  data.brands.forEach((item) => {
    const row = element('article', 'brand-row')
    const label = element('h3', '', item.label)
    const value = element('strong', item.available ? '' : 'unavailable-value', quoteValue(item, '元/克'))
    row.append(label, value, statusLine(item))
    brandList.append(row)
  })
  brandsSection.append(brandList)

  const fuelSection = element('section', 'fuel-section')
  fuelSection.append(sectionHeading('广东油价', '官方最高零售价'))
  const fuelGrid = element('div', 'fuel-grid')
  data.fuel.forEach((item) => {
    const card = element('article', `fuel-card fuel-${item.priority}`)
    card.append(element('h3', '', item.label), element('strong', item.available ? '' : 'unavailable-value', quoteValue(item, '元/升')), statusLine(item))
    fuelGrid.append(card)
  })
  fuelSection.append(fuelGrid)

  const footer = element('footer', 'page-footer', '只展示已保存的本地行情记录')
  app.append(goldSection, brandsSection, fuelSection, footer)
}

async function loadDisplay() {
  refreshButton.disabled = true
  refreshButton.setAttribute('aria-busy', 'true')
  refreshButton.textContent = '正在读取'
  readingNote.textContent = '正在读取本地展示数据'
  try {
    const response = await fetch('/api/home', { cache: 'no-store' })
    if (!response.ok) throw new Error('读取失败')
    const data = await response.json()
    render(data)
    readingNote.textContent = '已重新读取本地展示数据'
  } catch {
    app.replaceChildren(element('p', 'load-error', '本地展示数据暂时无法读取'))
    readingNote.textContent = '未能读取本地展示数据'
  } finally {
    refreshButton.disabled = false
    refreshButton.removeAttribute('aria-busy')
    refreshButton.textContent = '刷新显示'
  }
}

refreshButton.addEventListener('click', loadDisplay)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js')
loadDisplay()
