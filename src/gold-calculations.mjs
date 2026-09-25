export const OUNCE_TO_GRAM = 31.1034768

function unavailable(name, sourceUrl, collectedAt, reason) {
  return { name, available: false, sourceUrl, collectedAt: collectedAt.toISOString(), reason }
}

export function deriveInternationalGoldCny(xauUsd, usdCny, collectedAt) {
  if (!xauUsd.available || !usdCny.available) {
    return unavailable('国际黄金人民币折算价', 'derived', collectedAt, 'XAU/USD或USD/CNY不可用')
  }
  return {
    name: '国际黄金人民币折算价',
    available: true,
    value: xauUsd.value * usdCny.value / OUNCE_TO_GRAM,
    currency: 'CNY',
    unit: 'gram',
    sourceUrl: 'derived',
    sourceName: '公式计算',
    observedAt: xauUsd.observedAt ?? usdCny.observedAt,
    calculatedAt: collectedAt.toISOString(),
    inputs: [
      { name: xauUsd.name, sourceUrl: xauUsd.sourceUrl, observedAt: xauUsd.observedAt },
      { name: usdCny.name, sourceUrl: usdCny.sourceUrl, observedAt: usdCny.observedAt },
    ],
  }
}

function chinaDate(value) {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return value
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function deriveGoldSpread(au9999, internationalGoldCny, collectedAt) {
  if (!au9999.available || !internationalGoldCny.available) {
    return unavailable('国内外价差', 'derived', collectedAt, 'Au99.99或国际黄金人民币折算价不可用')
  }
  if (au9999.displayOnly && chinaDate(au9999.observedAt) !== chinaDate(internationalGoldCny.observedAt)) {
    return unavailable('国内外价差', 'derived', collectedAt, '休市日无法取得同一交易日国际黄金折算价', { preventCache: true })
  }
  const value = au9999.value - internationalGoldCny.value
  return {
    name: '国内外价差', available: true, value,
    percentage: value / internationalGoldCny.value * 100,
    currency: 'CNY', unit: 'gram', sourceUrl: 'derived', sourceName: '公式计算',
    observedAt: au9999.observedAt,
    displayOnly: au9999.displayOnly === true,
    marketStatus: au9999.marketStatus ?? null,
    calculatedAt: collectedAt.toISOString(),
    inputs: [
      { name: au9999.name, sourceUrl: au9999.sourceUrl, observedAt: au9999.observedAt },
      { name: internationalGoldCny.name, calculatedAt: internationalGoldCny.calculatedAt },
    ],
  }
}
