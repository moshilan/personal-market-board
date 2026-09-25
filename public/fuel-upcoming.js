export function resolveUpcomingFuelView(view, now = Date.now()) {
  const upcoming = view?.upcomingFuel
  if (!upcoming || upcoming.status !== 'upcoming') return view
  const effectiveAt = Date.parse(upcoming.effectiveFrom)
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
