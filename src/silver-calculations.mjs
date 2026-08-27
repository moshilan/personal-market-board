export const OUNCE_TO_GRAM = 31.1034768

function unavailable(name, collectedAt, reason) {
  return { name, available: false, sourceUrl: 'derived', collectedAt: collectedAt.toISOString(), reason }
}

export function deriveInternationalSilverCny(xagUsd, usdCny, collectedAt) {
  if (!xagUsd.available || !usdCny.available) {
    return unavailable('国际白银人民币折算价', collectedAt, 'XAG/USD或USD/CNY不可用')
  }
  return {
    name: '国际白银人民币折算价', available: true,
    value: xagUsd.value * usdCny.value / OUNCE_TO_GRAM,
    currency: 'CNY', unit: 'gram', sourceUrl: 'derived', sourceName: '公式计算',
    calculatedAt: collectedAt.toISOString(),
    inputs: [
      { name: xagUsd.name, sourceUrl: xagUsd.sourceUrl, observedAt: xagUsd.observedAt },
      { name: usdCny.name, sourceUrl: usdCny.sourceUrl, observedAt: usdCny.observedAt },
    ],
  }
}

export function deriveDomesticSilverCny(agTd, collectedAt) {
  if (!agTd.available) return unavailable('国内白银', collectedAt, 'Ag(T+D)不可用')
  return {
    name: '国内白银', available: true, value: agTd.value / 1000,
    currency: 'CNY', unit: 'gram', sourceUrl: 'derived', sourceName: '单位换算',
    calculatedAt: collectedAt.toISOString(),
    inputs: [{ name: agTd.name, sourceUrl: agTd.sourceUrl, observedAt: agTd.observedAt }],
  }
}

export function deriveSilverSpread(domesticSilverCny, internationalSilverCny, collectedAt) {
  if (!domesticSilverCny.available || !internationalSilverCny.available) {
    return unavailable('国内外白银价差', collectedAt, '国内白银或国际白银人民币折算价不可用')
  }
  const value = domesticSilverCny.value - internationalSilverCny.value
  return {
    name: '国内外白银价差', available: true, value,
    percentage: value / internationalSilverCny.value * 100,
    currency: 'CNY', unit: 'gram', sourceUrl: 'derived', sourceName: '公式计算',
    calculatedAt: collectedAt.toISOString(),
    inputs: [
      { name: domesticSilverCny.name, calculatedAt: domesticSilverCny.calculatedAt },
      { name: internationalSilverCny.name, calculatedAt: internationalSilverCny.calculatedAt },
    ],
  }
}
