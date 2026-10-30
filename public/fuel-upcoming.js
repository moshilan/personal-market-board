import { activeFuelControl } from './fuel-reminder.js'

export function resolveUpcomingFuelView(view, now = Date.now()) {
  if (activeFuelControl(view)) return view
  const upcoming = view?.upcomingFuel
  if (!upcoming || upcoming.status !== 'upcoming') return view
  const effectiveAt = Date.parse(upcoming.effectiveFrom)
  if (!['92号汽油', '95号汽油', '0号柴油'].every((label) => Number.isFinite(upcoming.prices?.[label]) && upcoming.prices[label] > 0)) return view
  if (!Number.isFinite(effectiveAt) || effectiveAt > now) return view

  return {
    ...view,
    fuel: view.fuel.map((item) => {
      const value = upcoming.prices?.[item.label]
      if (!Number.isFinite(value) || value <= 0) return item
      return {
        ...item,
        available: true,
        value,
        displayStatus: 'current',
        observedAt: upcoming.effectiveFrom,
        effectiveAt: upcoming.effectiveFrom,
        collectedAt: upcoming.collectedAt,
        sourceUrl: upcoming.sourceUrl,
        sourceLabel: upcoming.sourceName ?? '广东省发展改革委',
      }
    }),
    upcomingFuel: null,
  }
}
