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

export function isMainChenpiListing(quote) {
  return ['production-date', 'merchant-age', 'merchant-year'].includes(quote.yearEvidence?.kind)
    && quote.pageCheck?.state === 'price-visible' && pricePerJin(quote.price) !== null
}

function node(tag, className, text) {
  const result = document.createElement(tag)
  if (className) result.className = className
  if (text !== undefined) result.textContent = text
  return result
}

function quoteCard(quote, { excluded = false } = {}) {
  const card = node('article', 'chenpi-card')
  card.dataset.quoteId = quote.id
  card.dataset.referenceRole = excluded ? 'excluded' : quote.period === 'historical' ? 'historical' : 'observation'
  const heading = node('div', 'chenpi-card-heading')
  const kind = quote.priceType === '零售挂牌' || quote.priceType === '零售调查观察' ? 'retail'
    : quote.priceType === '供应挂牌' ? 'supply' : 'reference'
  heading.append(node('h3', '', quote.label), node('span', `chenpi-kind chenpi-kind-${kind}`, quote.priceType))
  card.append(heading, node('strong', 'chenpi-price', quote.merchant ? quote.originalOffer : formatChenpiPrice(quote.price)))
  if (quote.merchant && quote.price.unit !== '元/斤') {
    card.append(node('p', 'chenpi-converted', `辅助换算：${formatChenpiPrice(quote.price)}（按规格折算，非斤装售价）`))
  }
  card.append(node('p', 'chenpi-date', formatChenpiPriceTime(quote)))
  if (quote.observationType) card.append(node('p', 'chenpi-detail', `资料类型：${quote.observationType}`))
  card.append(node('p', 'chenpi-original', `原始口径：${quote.originalText}`))
  if (quote.merchant) card.append(node('p', 'chenpi-detail', `商家：${quote.merchant}`))
  if (quote.merchant) card.append(node('p', 'chenpi-detail', `圈枝：${quote.circle ?? '未明确'}`))
  if (quote.merchant) {
    card.append(node('p', 'chenpi-year-evidence', `年份证据：${quote.yearEvidence?.text ?? '未披露'}`))
    card.append(node('p', 'chenpi-detail', `包装规格：${quote.packageSpec ?? '未披露'}`))
    card.append(node('p', 'chenpi-detail', `起购量：${quote.minimumOrder ?? '未披露'}`))
    card.append(node('p', 'chenpi-detail', `原始报价时间：${calendarDate(quote.priceDate)}`))
    card.append(node('p', 'chenpi-page-check', `截至${quote.pageCheck?.checkedAt ?? '未披露'}页面核验：${quote.pageCheck?.text ?? '未核验'}`))
  }
  if (excluded) card.append(node('p', 'chenpi-exclusion', `移出主参考：${quote.exclusionReason ?? '页面状态或年份证据不足'}`))
  if (quote.note) card.append(node('p', 'chenpi-note', quote.note))
  const source = node('p', 'chenpi-source')
  const link = node('a', '', quote.sourceName)
  link.href = quote.sourceUrl
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  source.append(document.createTextNode('来源：'), link)
  card.append(source)
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
  fragment.append(node('p', 'chenpi-intro', '价格资料快照截至2026年9月28日，本页暂不自动更新'))
  fragment.append(node('p', 'chenpi-page-note', '本页观察东甲、梅江、天马、茶坑四村，不代表官方产区分级；原文中的「核心」「一线」仅为来源用语。1斤＝500克。'))
  fragment.append(node('p', 'chenpi-page-note', '各项为有时间依据的资料或挂牌观察，不代表当前有效价或成交价。页面显示价格不等于可购买；库存和购买条件未核实的会注明。'))
  fragment.append(referenceSection('年限行情参考', '2026年媒体实地走访的零售观察，保留原年限组；不是2026年9月重新调查的行情。', data.market))
  const core = referenceSection('四村相关圈枝资料', '2026年媒体资料与历史媒体价格表分层；不同来源、皮类和交易口径不合并。', data.core.filter((quote) => quote.period !== 'historical'))
  core.append(node('p', 'chenpi-conflict-note', data.conflictNote))
  core.append(node('p', 'chenpi-empty', '四村3年圈枝专项参考：暂无可靠数据。'))
  const history = node('details', 'chenpi-history')
  const historical = data.core.filter((quote) => quote.period === 'historical')
  history.append(node('summary', '', `2025年历史媒体价格表（圈枝${historical.length}档，展开查看）`), node('p', 'chenpi-section-note', '历史资料不进入2026挂牌主参考。原表未披露独立价目或采价日期，保留2025年10月12日报道时间；只摘录圈枝，其他枝型见原表。'))
  const historyList = node('div', 'chenpi-list')
  historical.forEach((quote) => historyList.append(quoteCard(quote)))
  history.append(historyList)
  core.append(history)
  fragment.append(core)
  const villages = referenceSection('四村公开报价观察', '2026年9月28日页面核验快照。供应、普通零售、品牌小包装分别观察；年限为商家声明，不按年份相减推算足年，不计算均价或排名。', [])
  const list = villages.querySelector('.chenpi-list')
  list.replaceChildren()
  list.before(node('p', 'chenpi-conflict-note', '部分供应挂牌明显低于媒体参考。年限证据、枝型、皮类、包装、日期及采价口径不同，不能据此认定同品价差，也不合成统一价格区间。'))
  for (const name of ['东甲', '梅江', '天马', '茶坑']) {
    const group = node('div', 'chenpi-village')
    group.append(node('h3', 'chenpi-village-name', name))
    const quotes = data.villages?.find((village) => village.name === name)?.quotes ?? []
    for (const [tier, label] of [['supply', '供应／批发挂牌'], ['retail', '普通零售挂牌'], ['branded-retail', '品牌小包装零售']]) {
      const lane = node('div', 'chenpi-listing-tier')
      lane.dataset.tier = tier
      lane.append(node('h4', '', label))
      const included = quotes.filter((quote) => quote.listingTier === tier && isMainChenpiListing(quote))
      if (included.length) included.forEach((quote) => lane.append(quoteCard(quote)))
      else lane.append(node('p', 'chenpi-empty', '暂无符合当前口径的公开报价'))
      group.append(lane)
    }
    list.append(group)
  }
  const excludedQuotes = data.villages.flatMap((village) => village.quotes.filter((quote) => !isMainChenpiListing(quote)))
  const excluded = node('details', 'chenpi-excluded')
  excluded.append(node('summary', '', `移出主参考的样本与核验记录（${excludedQuotes.length}条）`), node('p', 'chenpi-section-note', '下架、售罄、字段冲突或本轮无法核验的样本仅保留审查记录，不参与主参考。'))
  const excludedList = node('div', 'chenpi-list')
  excludedQuotes.forEach((quote) => excludedList.append(quoteCard(quote, { excluded: true })))
  excluded.append(excludedList)
  villages.append(excluded)
  fragment.append(villages)
  return fragment
}
