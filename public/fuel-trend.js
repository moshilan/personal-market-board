export const FUEL_TREND_RANGES = [
  { id: 'recent10', label: '近10次', count: 10 },
  { id: 'halfYear', label: '半年', months: 6 },
  { id: 'year', label: '1年', months: 12 },
]

function chinaDate(timestamp = new Date()) {
  const fields = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(timestamp)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  return `${fields.year}-${fields.month}-${fields.day}`
}

function rangeStartDate(months, today) {
  const [year, month, day] = today.split('-').map(Number)
  const target = new Date(Date.UTC(year, month - 1 - months, 1))
  const targetYear = target.getUTCFullYear()
  const targetMonth = target.getUTCMonth() + 1
  const targetLastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(Math.min(day, targetLastDay)).padStart(2, '0')}`
}

export function fuelTrendPoints(data, assetIds, range = FUEL_TREND_RANGES[0], today = chinaDate()) {
  const events = new Map()
  for (const item of data.history ?? []) {
    if (!assetIds.includes(item.assetId)) continue
    const date = item.date ?? chinaDate(item.timestamp)
    if (date > today) continue
    const event = events.get(date) ?? new Map()
    const existing = event.get(item.assetId)
    if (!existing || Date.parse(item.collectedAt) > Date.parse(existing.collectedAt)) event.set(item.assetId, { ...item, date })
    events.set(date, event)
  }

  let dates = [...events]
    .filter(([, event]) => assetIds.every((assetId) => event.has(assetId)))
    .map(([date]) => date)
    .sort()
  if (range.count) dates = dates.slice(-range.count)
  else dates = dates.filter((date) => date >= rangeStartDate(range.months, today))
  return assetIds.map((assetId) => ({
    assetId,
    points: dates.map((date) => events.get(date).get(assetId)),
  }))
}
