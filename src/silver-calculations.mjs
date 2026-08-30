export const OUNCE_TO_GRAM = 31.1034768

function unavailable(name, collectedAt, reason, extra = {}) {
  return { name, available: false, sourceUrl: 'derived', collectedAt: collectedAt.toISOString(), reason, ...extra }
}

function chinaDate(value) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value ?? ''))) return value
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
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
    observedAt: agTd.observedAt, quoteDate: agTd.observedAt,
    displayOnly: agTd.displayOnly === true, marketStatus: agTd.marketStatus ?? null,
    calculatedAt: collectedAt.toISOString(),
    inputs: [{ name: agTd.name, sourceUrl: agTd.sourceUrl, observedAt: agTd.observedAt }],
  }
}

export function deriveSilverSpread(domesticSilverCny, internationalSilverCny, collectedAt) {
  if (!domesticSilverCny.available || !internationalSilverCny.available) {
    return unavailable('国内外白银价差', collectedAt, '国内白银或国际白银人民币折算价不可用')
  }
  const domesticDate = chinaDate(domesticSilverCny.observedAt)
  const internationalDate = chinaDate(internationalSilverCny.observedAt)
  if (domesticSilverCny.displayOnly && (!domesticDate || !internationalDate || domesticDate !== internationalDate)) {
    return unavailable('国内外白银价差', collectedAt, '休市日无法取得同一交易日国际白银折算价', { preventCache: true })
  }
  const value = domesticSilverCny.value - internationalSilverCny.value
  return {
    name: '国内外白银价差', available: true, value,
    percentage: value / internationalSilverCny.value * 100,
    currency: 'CNY', unit: 'gram', sourceUrl: 'derived', sourceName: '公式计算',
    observedAt: domesticSilverCny.observedAt,
    displayOnly: domesticSilverCny.displayOnly === true,
    marketStatus: domesticSilverCny.marketStatus ?? null,
    calculatedAt: collectedAt.toISOString(),
    inputs: [
      { name: domesticSilverCny.name, calculatedAt: domesticSilverCny.calculatedAt },
      { name: internationalSilverCny.name, calculatedAt: internationalSilverCny.calculatedAt },
    ],
  }
}
