import { CHENPI_REFERENCE } from './chenpi-reference-data.mjs'

const number = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 })

export function pricePerJin(price) {
  if (!price || !Number.isFinite(price.min) || price.min < 0) return null
  const maximum = price.max ?? price.min
  if (!Number.isFinite(maximum) || maximum < price.min) return null
  const multiplier = price.unit === '元/斤' ? 1 : price.unit === '元/公斤' ? 0.5
    : price.unit === '元/件' && Number.isFinite(price.weightGrams) && price.weightGrams > 0 ? 500 / price.weightGrams : null
  if (multiplier === null) return null
  return { min: price.min * multiplier, max: maximum * multiplier, openEnded: Boolean(price.openEnded) }
}

export function formatChenpiPrice(price) {
  const normalized = pricePerJin(price)
  if (!normalized) return '暂无'
  const range = normalized.min === normalized.max ? number.format(normalized.min)
    : `${number.format(normalized.min)}–${number.format(normalized.max)}`
  return `${range}${normalized.openEnded ? '及以上' : ''}元/斤`
}

function calendarDate(value, monthOnly = false) {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value ?? '')
  if (!match) return '未披露'
  return `${match[1]}年${Number(match[2])}月${!monthOnly && match[3] ? `${Number(match[3])}日` : ''}`
}

export function formatChenpiPriceTime(quote) {
  const collected = `采集时间：${calendarDate(quote.collectedAt, true)}`
  const reported = quote.sourceDate ? `报道时间：${calendarDate(quote.sourceDate)}` : null
  return [quote.priceDate ? `报价日期：${calendarDate(quote.priceDate)}` : null, reported, collected]
    .filter(Boolean).join(' · ')
}

function node(tag, className, text) {
  const result = document.createElement(tag)
  if (className) result.className = className
  if (text !== undefined) result.textContent = text
  return result
}

function quoteCard(quote) {
  const card = node('article', 'chenpi-card')
  card.dataset.quoteId = quote.id
  const heading = node('div', 'chenpi-card-heading')
  const kind = quote.priceType === '零售挂牌' || quote.priceType === '零售调查观察' ? 'retail'
    : quote.priceType === '供应挂牌' ? 'supply' : 'reference'
  heading.append(node('h3', '', quote.label), node('span', `chenpi-kind chenpi-kind-${kind}`, quote.priceType))
  card.append(heading, node('strong', 'chenpi-price', formatChenpiPrice(quote.price)))
  card.append(node('p', 'chenpi-original', `原始口径：${quote.originalText}`))
  if (quote.merchant) card.append(node('p', 'chenpi-detail', `商家：${quote.merchant}`))
  if (quote.merchant) card.append(node('p', 'chenpi-detail', `圈枝：${quote.circle ?? '未明确'}`))
  if (quote.minimumOrder) card.append(node('p', 'chenpi-detail', `起购量：${quote.minimumOrder}`))
  if (quote.note) card.append(node('p', 'chenpi-note', quote.note))
  const source = node('p', 'chenpi-source')
  const link = node('a', '', quote.sourceName)
  link.href = quote.sourceUrl
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  source.append(document.createTextNode('来源：'), link)
  card.append(source, node('p', 'chenpi-date', formatChenpiPriceTime(quote)))
  return card
}

function referenceSection(title, description, quotes) {
  const section = node('section', 'chenpi-section')
  section.append(node('h2', '', title), node('p', 'chenpi-section-note', description))
  const list = node('div', 'chenpi-list')
  if (quotes?.length) quotes.forEach((quote) => list.append(quoteCard(quote)))
  else list.append(node('p', 'chenpi-empty', '暂无可靠参考数据'))
  section.append(list)
  return section
}

export function renderChenpiReference(data = CHENPI_REFERENCE) {
  const fragment = document.createDocumentFragment()
  fragment.append(node('p', 'chenpi-intro', `家庭选购参考 · 1斤＝500克 · 调研采集日期：${data.collectedAt}`))
  fragment.append(node('p', 'chenpi-page-note', '以下为有日期的调研快照。零售、供应挂牌和媒体参考分别展示，挂牌价不代表成交价。'))
  fragment.append(referenceSection('年限行情参考', '保留媒体走访的年限分组，不拆成单年均价。', data.market))
  const core = referenceSection('核心产区圈枝参考', '媒体及指导参考各自保留口径，价格不合并。', data.core)
  core.append(node('p', 'chenpi-empty', '3年核心产区圈枝：暂无近期可靠专项参考。'))
  fragment.append(core)
  const villages = referenceSection('四村公开报价观察', '商家标称年限与年份分开记录，村间不计算均价或排名。', [])
  const list = villages.querySelector('.chenpi-list')
  list.replaceChildren()
  for (const name of ['东甲', '梅江', '天马', '茶坑']) {
    const group = node('div', 'chenpi-village')
    group.append(node('h3', 'chenpi-village-name', name))
    const quotes = data.villages?.find((village) => village.name === name)?.quotes ?? []
    if (quotes.length) quotes.forEach((quote) => group.append(quoteCard(quote)))
    else group.append(node('p', 'chenpi-empty', '暂无可靠公开报价'))
    list.append(group)
  }
  fragment.append(villages)
  return fragment
}
