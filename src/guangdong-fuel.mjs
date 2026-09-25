export const GUANGDONG_FUEL_INDEX_URL = 'https://drc.gd.gov.cn/spjg/index.html'

const GUANGDONG_ORIGIN = 'https://drc.gd.gov.cn'
const PRODUCTS = [
  { name: '92号汽油', pattern: /^92号汽油/ },
  { name: '95号汽油', pattern: /^95号汽油/ },
  { name: '0号柴油', pattern: /^0号柴油/ },
]

function decodeHtml(value) {
  return value
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
}

function htmlText(value) {
  return decodeHtml(value.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[\u00a0\s]+/g, ' ')
    .trim()
}

function validShanghaiEffectiveTime(year, month, day) {
  const effectiveAt = Date.UTC(year, month - 1, day, 16)
  const date = new Date(effectiveAt)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error('公告生效日期无效')
  }
  return new Date(effectiveAt).toISOString()
}

function parseAdjustmentTitle(title) {
  const match = title.match(/^(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日\s*24时起成品油价格(?:按机制)?调整$/)
  if (!match) return null
  const [, year, month, day] = match
  return validShanghaiEffectiveTime(Number(year), Number(month), Number(day))
}

export function parseGuangdongFuelCandidates(listHtml) {
  const candidates = []
  const anchors = listHtml.matchAll(/<a\b[^>]*href\s*=\s*(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a\s*>/gi)
  for (const [, , href, label] of anchors) {
    const title = htmlText(label)
    const effectiveFrom = parseAdjustmentTitle(title)
    if (!effectiveFrom) continue

    let url
    try {
      url = new URL(decodeHtml(href), GUANGDONG_FUEL_INDEX_URL)
    } catch {
      continue
    }
    if (url.origin !== GUANGDONG_ORIGIN || !/^\/spjg\/content\/post_\d+\.html$/.test(url.pathname)) continue
    candidates.push({ title, effectiveFrom, url: url.href })
  }

  const unique = new Map(candidates.map((candidate) => [candidate.url, candidate]))
  return [...unique.values()].sort((left, right) => Date.parse(right.effectiveFrom) - Date.parse(left.effectiveFrom))
}

function parseEffectiveFromArticle(html) {
  const dates = new Set()
  for (const match of htmlText(html).matchAll(/自\s*(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日\s*24\s*时起/g)) {
    dates.add(validShanghaiEffectiveTime(Number(match[1]), Number(match[2]), Number(match[3])))
  }
  if (dates.size !== 1) throw new Error('公告中缺少唯一、有效的24时生效日期')
  return [...dates][0]
}

function parsePositivePrice(value, product) {
  const normalized = value.replace(/[\s,，]/g, '')
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null
  const price = Number(normalized)
  if (!Number.isFinite(price) || price <= 0) return null
  if (price < 3 || price > 15) throw new Error(`${product}元/升价格超出合理范围`)
  return price
}

export function parseGuangdongFuelAnnouncement(html, { title, url }) {
  const titleEffectiveFrom = parseAdjustmentTitle(title)
  if (!titleEffectiveFrom) throw new Error('公告标题不是可识别的成品油调价公告')
  const effectiveFrom = parseEffectiveFromArticle(html)
  if (effectiveFrom !== titleEffectiveFrom) throw new Error('公告标题日期与正文生效日期不一致')
  if (!htmlText(html).includes('元/升')) throw new Error('公告未明确提供元/升价格列')

  const values = new Map()
  for (const [, row] of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)) {
    const cells = [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]\s*>/gi)].map(([, cell]) => htmlText(cell))
    if (cells.length < 2) continue
    const firstCell = cells[0].replace(/[\s\u00a0]/g, '')
    const product = PRODUCTS.find((item) => item.pattern.test(firstCell))
    if (!product) continue

    const priceCells = cells.slice(1).reverse()
    let price = null
    for (const cell of priceCells) {
      price = parsePositivePrice(cell, product.name)
      if (price !== null) break
    }
    if (price === null) throw new Error(`未能从${product.name}公告行解析元/升价格`)
    const existing = values.get(product.name)
    if (existing !== undefined && existing !== price) throw new Error(`${product.name}公告价格行不唯一`)
    values.set(product.name, price)
  }

  for (const product of PRODUCTS) {
    if (!values.has(product.name)) throw new Error(`公告中未找到${product.name}元/升价格`)
  }

  return {
    effectiveFrom,
    sourceUrl: url,
    prices: Object.fromEntries(PRODUCTS.map(({ name }) => [name, values.get(name)])),
  }
}

export async function findGuangdongFuelAnnouncements(collectedAt, getText) {
  if (!(collectedAt instanceof Date) || !Number.isFinite(collectedAt.getTime())) throw new Error('采集时间无效')
  const listHtml = await getText(GUANGDONG_FUEL_INDEX_URL)
  const candidates = parseGuangdongFuelCandidates(listHtml)
  const eligible = candidates.filter((candidate) => Date.parse(candidate.effectiveFrom) <= collectedAt.getTime())
  if (eligible.length === 0) throw new Error('官方公告列表中没有已生效的成品油调价公告')

  const currentCandidate = eligible[0]
  const currentHtml = await getText(currentCandidate.url)
  const current = { ...parseGuangdongFuelAnnouncement(currentHtml, currentCandidate), title: currentCandidate.title }

  const upcomingCandidate = candidates.find((candidate) => Date.parse(candidate.effectiveFrom) > collectedAt.getTime())
  let upcoming = null
  if (upcomingCandidate) {
    try {
      const upcomingHtml = await getText(upcomingCandidate.url)
      upcoming = {
        ...parseGuangdongFuelAnnouncement(upcomingHtml, upcomingCandidate),
        title: upcomingCandidate.title,
        status: 'upcoming',
      }
    } catch {
      // A malformed or unreachable future notice must not replace the verified current prices.
    }
  }

  return { current, upcoming }
}

export async function findCurrentGuangdongFuelAnnouncement(collectedAt, getText) {
  return (await findGuangdongFuelAnnouncements(collectedAt, getText)).current
}
