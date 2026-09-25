export function selectTrendDates(history, assetIds, rangeId, startDate) {
  const selectedAssets = new Set(assetIds)
  const dates = [...new Set(history
    .filter((item) => selectedAssets.has(item.assetId))
    .map((item) => item.date ?? String(item.timestamp ?? '').slice(0, 10))
    .filter(Boolean))]
    .sort()

  if (rangeId === 'week') return new Set(dates.slice(-7))
  return new Set(dates.filter((date) => date >= startDate))
}
