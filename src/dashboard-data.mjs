import { buildDisplaySnapshot } from './market-data-store.mjs'
import { buildMarketViews } from './home-view-model.mjs'
import { buildTrendDecisions } from './trend-decisions.mjs'

const DAILY_TREND_ASSETS = new Set([
  'international-gold-cny-gram',
  'au9999',
  'domestic-international-gold-spread',
  'international-silver-cny-gram',
  'domestic-silver-cny-gram',
  'domestic-international-silver-spread',
])
const FUEL_TREND_ASSETS = new Set([
  'guangdong-fuel-92',
  'guangdong-fuel-95',
  'guangdong-fuel-0-diesel',
])
const BRAND_TREND_ASSETS = new Set([
  'brand-gold-chow-sang-sang',
  'brand-gold-chow-tai-fook',
  'brand-gold-luk-fook',
  'brand-gold-lao-feng-xiang',
])
const YEAR_DAYS_MS = 366 * 24 * 60 * 60 * 1_000
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

function buildDailyTrendHistory(history, assetIds, now, { excludeToday = false, windowMs = YEAR_DAYS_MS, allowedDates = null } = {}) {
  const from = now - windowMs
  const today = chinaDate(now)
  const latestByAssetDay = new Map()
  for (const observation of history
    .filter((item) => item.available && assetIds.has(item.assetId))
    .filter((item) => Date.parse(trendTime(item)) >= from)) {
    const date = chinaDate(trendTime(observation))
    if (excludeToday && date === today) continue
    if (allowedDates && !allowedDates.has(date)) continue
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

export function buildTrendHistory(history, now = Date.now(), decisions = null) {
  const finalized = decisions ?? buildTrendDecisions(history, now)
  const allowed = (group) => new Set(Object.entries(finalized[group] ?? {}).filter(([, status]) => status === 'complete').map(([date]) => date))
  return [
    ...buildDailyTrendHistory(history, new Set(['international-gold-cny-gram', 'au9999']), now, { excludeToday: true, allowedDates: allowed('gold') }),
    ...buildDailyTrendHistory(history, new Set(['international-silver-cny-gram', 'domestic-silver-cny-gram']), now, { excludeToday: true, allowedDates: allowed('silver') }),
    ...buildDailyTrendHistory(history, new Set(['domestic-international-gold-spread']), now, { excludeToday: true, allowedDates: allowed('goldSpread') }),
    ...buildDailyTrendHistory(history, new Set(['domestic-international-silver-spread']), now, { excludeToday: true, allowedDates: allowed('silverSpread') }),
    ...buildDailyTrendHistory(history, FUEL_TREND_ASSETS, now, { windowMs: THIRTY_DAYS_MS }),
  ].sort((left, right) => left.date.localeCompare(right.date) || left.assetId.localeCompare(right.assetId))
}

export function buildBrandTrendHistory(history, now = Date.now(), decisions = null) {
  const finalized = decisions ?? buildTrendDecisions(history, now)
  return buildDailyTrendHistory(history, BRAND_TREND_ASSETS, now, { excludeToday: true, allowedDates: new Set(Object.entries(finalized.brands ?? {}).filter(([, status]) => status === 'complete').map(([date]) => date)) })
}

export function buildDashboardResponse(store, now = Date.now()) {
  const liveSnapshot = store.latestAttempt ?? { collectedAt: null, observations: [] }
  const displaySnapshot = buildDisplaySnapshot(liveSnapshot, store)
  const latestSuccessfulAt = Object.values(store.latestSuccessfulByAsset)
    .map((observation) => observation.collectedAt)
    .filter(Boolean)
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null
  return {
    collectedAt: displaySnapshot.collectedAt,
    collection: {
      latestAttemptAt: liveSnapshot.collectedAt,
      latestAttemptSucceeded: liveSnapshot.observations.some((observation) => observation.available),
      latestSuccessfulAt,
    },
    views: buildMarketViews(displaySnapshot),
    exchangeRates: displaySnapshot.exchangeRates,
    history: buildTrendHistory(store.history, now, store.trendDecisions),
    brandHistory: buildBrandTrendHistory(store.history, now, store.trendDecisions),
  }
}
