const DAY = 86_400_000
const PRODUCTS = ['92号汽油', '95号汽油', '0号柴油']

export function activeFuelControl(view) {
  const outcome = view?.fuelReminder?.officialOutcome
  if (!['暂停调整', '延迟调整'].includes(outcome?.direction)) return null
  const time = Date.parse(outcome.effectiveFrom)
  const latest = Math.max(...(view?.fuel ?? []).map((item) => Date.parse(item.effectiveAt ?? item.metadata?.effectiveFrom)).filter(Number.isFinite))
  const upcoming = Date.parse(view?.upcomingFuel?.effectiveFrom)
  return Number.isFinite(time) && !(latest > time) && !(upcoming > time) ? outcome : null
}

export function windowTime(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return NaN
  const midnight = Date.parse(`${date}T00:00:00+08:00`)
  if (!Number.isFinite(midnight)) return NaN
  return new Date(midnight + 8 * 3_600_000).toISOString().slice(0, 10) === date ? midnight + DAY : NaN
}

export function resolveFuelReminder(view, now = Date.now()) {
  const data = view?.fuelReminder ?? {}
  const windows = (data.windows ?? []).filter((item) => Number.isFinite(windowTime(item.date))).sort((a, b) => a.date.localeCompare(b.date))
  const next = windows.find((item) => windowTime(item.date) > now) ?? null
  const previous = windows.filter((item) => windowTime(item.date) <= now).at(-1)
  const upcoming = view?.upcomingFuel
  const control = activeFuelControl(view)
  if (control) return { state: 'official', next, outcome: control, direction: control.direction, summary: `官方已公告：${control.direction}，后续窗口待官方确认`, advice: null }
  const effective = Date.parse(upcoming?.effectiveFrom)
  const complete = PRODUCTS.every((label) => Number.isFinite(upcoming?.prices?.[label]) && upcoming.prices[label] > 0)
  if (upcoming?.status === 'upcoming' && complete && effective > now) {
    const changes = PRODUCTS.map((label) => {
      const current = view.fuel?.find((item) => item.label === label)
      return current?.available && current.displayStatus === 'current' ? upcoming.prices[label] - current.value : null
    })
    const known = changes.every((value) => value !== null)
    const direction = !known ? '待核对' : changes.every((value) => value === 0) ? '不调整' : changes.some((value) => value > 0) && changes.some((value) => value < 0) ? '分品种调整' : changes.some((value) => value > 0) ? '上涨' : '下调'
    const rising = known ? PRODUCTS.filter((_, index) => changes[index] > 0) : []
    return { state: 'official', next, upcoming, direction, summary: `官方已公告：${direction}，${upcoming.effectiveFrom}`, advice: rising.length ? `${rising.join('、')}已确定上涨，有加油需求可在生效前加油。` : null }
  }
  const outcome = data.officialOutcome
  if (outcome?.direction === '不调整' && Date.parse(outcome.effectiveFrom) > now) {
    return { state: 'official', next, outcome, direction: outcome.direction, summary: `官方已公告：${outcome.direction}`, advice: null }
  }
  const currentEffective = Math.max(...(view?.fuel ?? []).filter((item) => item.available && item.displayStatus === 'current').map((item) => Date.parse(item.effectiveAt ?? item.metadata?.effectiveFrom)).filter(Number.isFinite), effective <= now && complete ? effective : -Infinity, outcome?.direction === '不调整' && Date.parse(outcome.effectiveFrom) <= now ? Date.parse(outcome.effectiveFrom) : -Infinity)
  const awaiting = previous && !(currentEffective >= windowTime(previous.date))
  const prediction = data.prediction
  const published = Date.parse(prediction?.publishedAt)
  const predictionValid = next && !awaiting && prediction?.windowDate === next.date && ['up', 'down', 'unchanged'].includes(prediction.direction) && prediction.sourceUrl && prediction.sourceName && published <= now && now - published < DAY && (!previous || published >= windowTime(previous.date))
  if (predictionValid) return { state: 'prediction', next, prediction, summary: `媒体预测：预计${{ up: '上涨', down: '下调', unchanged: '不调整' }[prediction.direction]}，非官方结果`, advice: null }
  return { state: 'planned', next, awaiting: Boolean(awaiting), summary: awaiting ? '上一窗口结果待核实，以官方公告为准' : next ? `下一轮调价窗口：${next.date}，24时，是否调整待官方公告` : '下一轮调价窗口暂未确认', advice: null }
}
