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

function calendarDate(value) {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value ?? '')
  if (!match) return '未披露'
  return `${match[1]}年${Number(match[2])}月${match[3] ? `${Number(match[3])}日` : ''}`
}

export function formatChenpiPriceTime(quote) {
  const collected = `采集时间：${quote.collectedAt}`
  const reported = quote.sourceDate ? `报道时间：${calendarDate(quote.sourceDate)}` : null
  return [quote.priceDate ? `报价日期：${calendarDate(quote.priceDate)}` : quote.priceUpdatedAt ? `报价更新日期：${calendarDate(quote.priceUpdatedAt)}` : null, reported, collected]
    .filter(Boolean).join(' · ')
}

function exactDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function hasChenpiPriceTimeEvidence(quote) {
  const collected = quote.collectedAt
  if (!exactDate(collected)) return false
  const dated = quote.priceDate ?? quote.priceUpdatedAt
  if (exactDate(dated) && dated <= collected) return true
  return hasChenpiPagePriceEvidence(quote)
}

export function hasChenpiPagePriceEvidence(quote) {
  const collected = quote.collectedAt
  if (!exactDate(collected)) return false
  const check = quote.pageCheck
  const observed = check?.observedPrice
  return Boolean(check?.state === 'price-visible' && check.method === 'direct-page' && check.httpStatus === 200
    && check.checkedAt === collected && check.observedAt?.startsWith(`${collected}T`)
    && Number.isFinite(Date.parse(check.observedAt)) && Boolean(check.offerText && check.excerpt)
    && observed?.min === quote.price?.min && (observed?.max ?? observed?.min) === (quote.price?.max ?? quote.price?.min)
    && observed?.unit === quote.price?.unit && observed?.weightGrams === quote.price?.weightGrams)
}

export function isMainChenpiListing(quote) {
  return ['production-date', 'merchant-age', 'merchant-year'].includes(quote.yearEvidence?.kind)
    && !quote.conflicts?.length
    && !['removed', 'sold-out'].includes(quote.pageCheck?.state)
    && hasChenpiPriceTimeEvidence(quote) && pricePerJin(quote.price) !== null
}

export function chenpiOneYearReferences(data = CHENPI_REFERENCE) {
  return data.core.filter((quote) => quote.yearBand === 1)
}

export function hasChenpiDisplayValue(value) {
  return typeof value === 'string' && Boolean(value.trim()) && !['未披露', '暂无', '未知', '未确认', '—'].includes(value.trim())
}

export function formatChenpiOffer(quote) {
  if (!quote.price?.weightGrams) return quote.originalOffer
  const { min, max = min, weightGrams } = quote.price
  return `${number.format(min)}${max !== min ? `～${number.format(max)}` : ''}元 / ${weightGrams}g`
}

function node(tag, className, text) {
  const result = document.createElement(tag)
  if (className) result.className = className
  if (text !== undefined) result.textContent = text
  return result
}

function sourceLine(quote) {
  const source = node('p', 'chenpi-source')
  const link = node('a', '', quote.sourceName)
  link.href = quote.sourceUrl
  link.target = '_blank'
  link.rel = 'noopener noreferrer'
  source.append(document.createTextNode('来源：'), link)
  return source
}

function quoteCard(quote) {
  const card = node('article', 'chenpi-card')
  card.dataset.quoteId = quote.id
  if (quote.yearBand !== undefined) card.dataset.yearBand = quote.yearBand
  card.dataset.referenceRole = quote.merchant ? 'current-listing' : 'dated-reference'
  const heading = node('div', 'chenpi-card-heading')
  const kind = quote.priceType === '零售挂牌' || quote.priceType === '零售调查观察' ? 'retail'
    : quote.priceType === '供应挂牌' ? 'supply' : 'reference'
  heading.append(node('h3', '', quote.label), node('span', `chenpi-kind chenpi-kind-${kind}`, quote.priceType))
  card.append(heading, node('strong', 'chenpi-price', quote.merchant ? formatChenpiOffer(quote) : formatChenpiPrice(quote.price)))
  if (quote.merchant && quote.price.unit !== '元/斤') {
    card.append(node('p', 'chenpi-converted', `折合约${formatChenpiPrice(quote.price)}（按包装重量换算）`))
  }
  const directlyChecked = quote.merchant && hasChenpiPagePriceEvidence(quote)
  if (!directlyChecked || quote.priceDate || quote.priceUpdatedAt) card.append(node('p', 'chenpi-date', formatChenpiPriceTime(quote)))
  if (directlyChecked) card.append(node('p', 'chenpi-date chenpi-page-check', `截至${quote.pageCheck.checkedAt}页面仍显示该价（${quote.pageCheck.offerText}）`))
  if (quote.merchant) {
    for (const [key, label] of [['merchant', '商家'], ['circle', '圈枝'], ['packageSpec', '包装规格'], ['minimumOrder', '起购量']]) {
      if (hasChenpiDisplayValue(quote[key])) card.append(node('p', 'chenpi-detail', `${label}：${quote[key]}`))
    }
    if (quote.price.max > quote.price.min) card.append(node('p', 'chenpi-detail', '该商家挂牌范围，不代表市场区间'))
    if (hasChenpiDisplayValue(quote.yearEvidence?.text)) card.append(node('p', 'chenpi-year-evidence', quote.yearEvidence.text))
    if (hasChenpiDisplayValue(quote.pageCheck?.text)) card.append(node('p', 'chenpi-detail', quote.pageCheck.text))
  } else {
    card.append(node('p', 'chenpi-original', `原始口径：${quote.originalText}`))
    if (quote.note) card.append(node('p', 'chenpi-note', quote.note))
  }
  card.append(sourceLine(quote))
  return card
}

function referenceSection(title, description, quotes) {
  const section = node('section', 'chenpi-section')
  section.append(node('h2', '', title), node('p', 'chenpi-section-note', description))
  const list = node('div', 'chenpi-list')
  if (quotes?.length) quotes.forEach((quote) => list.append(quoteCard(quote)))
  section.append(list)
  return section
}

export function renderChenpiReference(data = CHENPI_REFERENCE) {
  const fragment = document.createDocumentFragment()
  fragment.append(node('p', 'chenpi-intro', '价格资料快照截至2026年9月28日，本页暂不自动更新。'))
  fragment.append(node('p', 'chenpi-page-note', '观察东甲、梅江、天马、茶坑四村，不代表官方分级。未满3年称新皮／柑皮，3年以上称陈皮；商家年限单独标明。1斤＝500克。'))
  const listings = data.villages.flatMap((village) => village.quotes)
  const current = listings.filter(isMainChenpiListing)
  const merchants = new Set(current.map((quote) => quote.merchant))
  const observations = referenceSection('公开报价观察', `2026-09-28核验：${current.length}条挂牌，${merchants.size}家独立商家。同商家多个商品不增加商家数；页面展示不等于价格仍有效或成交。`, [])
  observations.classList.add('chenpi-current')
  const list = observations.querySelector('.chenpi-list')
  for (const [tier, label] of [['supply', '供应／批发挂牌'], ['retail', '普通零售挂牌'], ['branded-retail', '品牌小包装零售']]) {
    const included = current.filter((quote) => quote.listingTier === tier)
    if (!included.length) continue
    const lane = node('div', 'chenpi-listing-tier')
    lane.dataset.tier = tier
    lane.append(node('h3', '', label))
    included.forEach((quote) => lane.append(quoteCard(quote)))
    const missing = [['circle', '圈枝'], ['packageSpec', '包装规格'], ['minimumOrder', '起购量']]
      .filter(([key]) => included.some((quote) => !hasChenpiDisplayValue(quote[key]))).map(([, label]) => label)
    lane.append(node('p', 'chenpi-category-note', `${missing.length ? `部分${missing.join('、')}未提供；` : ''}价格生效期限未注明，购买入口不保证库存或下单成功。`))
    list.append(lane)
  }
  observations.append(node('p', 'chenpi-category-note', '其余组合暂无可核当前报价；不同年限、枝型、皮类及包装不合成市场区间或四村排名。'))
  fragment.append(observations)

  const market = referenceSection('市场走访参考', '记者2026年1月走访广州清平市场的零售观察，不是9月新报价。按原3–5年、7–8年、8–10年及以上展示，不拆成单年价。', data.market)
  market.classList.add('chenpi-market')
  market.append(node('p', 'chenpi-category-note', '本次走访未细分村、枝型、等级及仓储，不能与旁边挂牌认定为同品价差。'))
  const oneYear = node('p', 'chenpi-one-year')
  oneYear.append(document.createTextNode('1年新皮／柑皮参考仅有2025年历史资料，不将未满3年的商品强行归入1年。'))
  const showOneYear = node('button', 'chenpi-history-link', '查看1年新皮／柑皮历史参考')
  showOneYear.type = 'button'
  oneYear.append(showOneYear)
  market.append(oneYear)
  fragment.append(market)

  const secondary = referenceSection('历史与其他参考', '较早资料按来源日期分层，不能当作2026-09-28当前商品价。', [])
  const guidance = data.core.filter((quote) => quote.period !== 'historical')
  if (guidance.length) {
    const details = node('details', 'chenpi-guidance')
    details.append(node('summary', '', `行业指导价的媒体转述（${guidance.length}条，原始来源待核）`))
    guidance.forEach((quote) => details.append(quoteCard(quote)))
    details.append(node('p', 'chenpi-conflict-note', data.conflictNote))
    secondary.append(details)
  }
  const historical = data.core.filter((quote) => quote.period === 'historical')
  const history = node('details', 'chenpi-history')
  if (historical.length) {
    history.append(node('summary', '', `2025年历史媒体价格表（圈枝${historical.length}档）`))
    const table = node('table', 'chenpi-history-table')
    const caption = node('caption', 'chenpi-date', `全表${formatChenpiPriceTime(historical[0])}。原价均为人民币／斤，非当前报价。`)
    table.append(caption)
    const head = node('thead')
    const headers = node('tr')
    for (const label of ['原表年档', '皮类', '原价（元／斤）']) {
      const cell = node('th', '', label); cell.scope = 'col'; headers.append(cell)
    }
    head.append(headers); table.append(head)
    const body = node('tbody')
    historical.forEach((quote) => {
      const row = node('tr')
      row.dataset.quoteId = quote.id; row.dataset.yearBand = quote.yearBand
      row.append(node('td', '', quote.yearBand < 3 ? `${quote.yearBand}年新皮／柑皮` : `${quote.yearBand}年陈皮`), node('td', '', quote.peelType), node('td', '', formatChenpiPrice(quote.price)))
      body.append(row)
    })
    table.append(body)
    history.append(table, sourceLine(historical[0]), node('p', 'chenpi-category-note', '全表圈枝。采价日期、批零及样本量未披露；十年以下为新树价、以梅江为基准，不推算各村独立报价。'))
    secondary.append(history)
  }
  showOneYear.disabled = chenpiOneYearReferences(data).length === 0
  showOneYear.addEventListener('click', () => {
    history.open = true
    const first = history.querySelector('[data-year-band="1"]')
    if (first) { first.tabIndex = -1; first.scrollIntoView({ block: 'start' }); first.focus({ preventScroll: true }) }
  })
  const excludedQuotes = listings.filter((quote) => !isMainChenpiListing(quote))
  const excluded = node('details', 'chenpi-excluded')
  if (excludedQuotes.length) {
    excluded.append(node('summary', '', `排除记录（${excludedQuotes.length}条，不作参考价）`))
    excludedQuotes.forEach((quote) => {
      const record = node('div', 'chenpi-audit-record')
      record.dataset.quoteId = quote.id
      record.append(node('h3', '', `${quote.merchant} · ${quote.label}`), node('p', 'chenpi-year-evidence', quote.yearEvidence.text), node('p', 'chenpi-exclusion', quote.exclusionReason ?? '价格时间或商品证据不足，不作当前参考'), node('p', 'chenpi-date', `核验时间：${quote.pageCheck?.checkedAt ?? quote.collectedAt}`), sourceLine(quote))
      excluded.append(record)
    })
    secondary.append(excluded)
  }
  fragment.append(secondary)
  return fragment
}
