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

export function buildTrendHistory(history, now = Date.now()) {
  const from = now - THIRTY_DAYS_MS
  return history
    .filter((item) => item.available && TREND_ASSETS.has(item.assetId))
    .filter((item) => Date.parse(trendTime(item)) >= from)
    .map((item) => ({
      assetId: item.assetId,
      value: item.value,
      percentage: item.percentage ?? null,
      timestamp: trendTime(item),
      observedAt: item.observedAt,
      collectedAt: item.collectedAt,
    }))
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
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
