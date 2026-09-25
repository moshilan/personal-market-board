export const OUNCE_TO_GRAM = 31.1034768

function unavailable(name, sourceUrl, collectedAt, reason, extra = {}) {
  return { name, available: false, sourceUrl, collectedAt: collectedAt.toISOString(), reason, ...extra }
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

export function deriveGoldSpread(au9999, internationalGoldCny, collectedAt) {
  if (!au9999.available || !internationalGoldCny.available) {
    return unavailable('国内外价差', 'derived', collectedAt, 'Au99.99或国际黄金人民币折算价不可用')
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
