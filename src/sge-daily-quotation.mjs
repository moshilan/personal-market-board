function decodeHtml(value) {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeDate(value) {
  const text = decodeHtml(value)
  const match = text.match(/(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?/) 
  if (!match) return null
  return `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`
}

export function parsePositiveSgePrice(value) {
  const text = String(value ?? '').replaceAll(',', '').trim()
  if (!text || text === '-' || text === '—') throw new Error('收盘价不是正数')
  const number = Number(text)
  if (!Number.isFinite(number) || number <= 0) throw new Error('收盘价不是正数')
  return number
}

export function parseSgeDailyQuotationHtml(html) {
  const rows = []
  const tableMatches = String(html).matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)
  for (const tableMatch of tableMatches) {
    const table = tableMatch[1]
    const rowMatches = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    const parsedRows = rowMatches.map((row) => [...row[1].matchAll(/<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi)].map((cell) => decodeHtml(cell[1])))
    const headerIndex = parsedRows.findIndex((row) => row.some((cell) => cell.includes('日期')) && row.some((cell) => cell.includes('合约')) && row.some((cell) => cell.includes('收盘价')))
    if (headerIndex < 0) continue
    const header = parsedRows[headerIndex]
    const dateIndex = header.findIndex((cell) => cell.includes('日期'))
    const contractIndex = header.findIndex((cell) => cell.includes('合约'))
    const closeIndex = header.findIndex((cell) => cell.includes('收盘价'))
    for (const row of parsedRows.slice(headerIndex + 1)) {
      if (row.length <= Math.max(dateIndex, contractIndex, closeIndex)) continue
      const tradeDate = normalizeDate(row[dateIndex])
      const contract = row[contractIndex].trim()
      if (!tradeDate || !contract) continue
      rows.push({ tradeDate, contract, closePrice: row[closeIndex] })
    }
  }
  return rows
}

export function findLatestValidSgeDailyQuotation(html, contract, { latestDate } = {}) {
  const candidates = parseSgeDailyQuotationHtml(html)
    .filter((row) => row.contract === contract && (!latestDate || row.tradeDate <= latestDate))
    .flatMap((row) => {
      try { return [{ ...row, value: parsePositiveSgePrice(row.closePrice) }] }
      catch { return [] }
    })
    .sort((left, right) => right.tradeDate.localeCompare(left.tradeDate))
  return candidates[0] ?? null
}

export function makeSgeFallbackRecord({ name, contract, unit, value, tradeDate, collectedAt, sourceUrl }) {
  return {
    name, available: true, value, currency: 'CNY', unit, observedAt: tradeDate,
    quoteDate: tradeDate, sourceTimePrecision: 'date', collectedAt: collectedAt.toISOString(),
    sourceUrl, sourceName: '上海黄金交易所每日行情', displayOnly: true, marketStatus: 'closed', contract,
  }
}
