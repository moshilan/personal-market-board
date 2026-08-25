import { buildDisplaySnapshot } from './market-data-store.mjs'
import { buildMarketViews } from './home-view-model.mjs'

const TREND_ASSETS = new Set([
  'international-gold-cny-gram',
  'au9999',
  'domestic-international-gold-spread',
  'guangdong-fuel-92',
  'guangdong-fuel-95',
  'guangdong-fuel-0-diesel',
])
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1_000

function trendTime(observation) {
  return observation.metadata?.effectiveFrom ?? observation.collectedAt ?? observation.observedAt
}

function chinaDate(timestamp) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function buildTrendHistory(history, now = Date.now()) {
  const from = now - THIRTY_DAYS_MS
  const latestByAssetDay = new Map()
  for (const observation of history
    .filter((item) => item.available && TREND_ASSETS.has(item.assetId))
    .filter((item) => Date.parse(trendTime(item)) >= from)) {
    const date = chinaDate(trendTime(observation))
    const key = `${observation.assetId}:${date}`
    const existing = latestByAssetDay.get(key)
    if (!existing || Date.parse(observation.collectedAt) > Date.parse(existing.collectedAt)) latestByAssetDay.set(key, observation)
  }
  return [...latestByAssetDay.values()]
    .map((item) => ({
      assetId: item.assetId,
      value: item.value,
      percentage: item.percentage ?? null,
      date: chinaDate(trendTime(item)),
      timestamp: trendTime(item),
      observedAt: item.observedAt,
      collectedAt: item.collectedAt,
    }))
    .sort((left, right) => left.date.localeCompare(right.date) || left.assetId.localeCompare(right.assetId))
}

export function buildDashboardResponse(store, now = Date.now()) {
  const liveSnapshot = store.latestAttempt ?? { collectedAt: null, observations: [] }
  const displaySnapshot = buildDisplaySnapshot(liveSnapshot, store)
  return {
    collectedAt: displaySnapshot.collectedAt,
    views: buildMarketViews(displaySnapshot),
    history: buildTrendHistory(store.history, now),
  }
}
