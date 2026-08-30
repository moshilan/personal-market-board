const GROUPS = {
  gold: ['international-gold-cny-gram', 'au9999'],
  silver: ['international-silver-cny-gram', 'domestic-silver-cny-gram'],
  brands: ['brand-gold-chow-sang-sang', 'brand-gold-chow-tai-fook', 'brand-gold-luk-fook', 'brand-gold-lao-feng-xiang'],
  goldSpread: ['domestic-international-gold-spread'],
  silverSpread: ['domestic-international-silver-spread'],
}

function dateOf(item) {
  const value = item.metadata?.effectiveFrom ?? item.collectedAt ?? item.observedAt
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function buildTrendDecisions(history, now = Date.now(), existing = {}) {
  const today = dateOf({ collectedAt: now })
  const dates = new Set(history.filter((item) => item.available).map(dateOf))
  const decisions = structuredClone(existing ?? {})
  for (const [group, assets] of Object.entries(GROUPS)) {
    decisions[group] ??= {}
    for (const date of dates) {
      if (date >= today || decisions[group][date]) continue
      const present = new Set(history.filter((item) => item.available && assets.includes(item.assetId) && dateOf(item) === date).map((item) => item.assetId))
      decisions[group][date] = present.size === assets.length ? 'complete' : 'skipped'
    }
  }
  return decisions
}
