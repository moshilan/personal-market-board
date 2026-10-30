import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveFuelReminder, windowTime } from '../public/fuel-reminder.js'
import { resolveUpcomingFuelView } from '../public/fuel-upcoming.js'
import { collectFuelReminder, parseFuelPrediction, VERIFIED_FUEL_WINDOWS } from '../src/fuel-reminder.mjs'
import { normalizeSnapshot, buildDisplaySnapshot, createEmptyStore } from '../src/market-data-store.mjs'
import { buildMarketViews } from '../src/home-view-model.mjs'

const at = (value) => Date.parse(`${value}+08:00`)
const sourceUrl = 'https://energy.cngold.org/c/2026-10-30/c10848406.html'
const predictionHtml = '<h1>油价调整最新消息：今日(10月30日)油价预计上调90元/吨</h1><div class="article-info"><div class="share"></div><span>2026-10-30 10:36:31</span></div><div class="article_con" id="zoom"><p>国内新一轮成品油调价窗口将于11月12日24时进行。</p><p>历史：下一轮调价窗口11月26日24时</p></div>'
function view() {
  return {
    fuel: ['92号汽油', '95号汽油', '0号柴油'].map((label) => ({ label, value: 8, available: true, displayStatus: 'current', effectiveAt: '2026-10-29T16:00:00Z' })),
    fuelReminder: { windows: VERIFIED_FUEL_WINDOWS },
  }
}

test('公开日历的已核实区间逐一为10个工作日，跨年不外推，24时按北京时间', () => {
  for (let index = 1; index < VERIFIED_FUEL_WINDOWS.length; index++) {
    let days = 0
    for (let timestamp = windowTime(VERIFIED_FUEL_WINDOWS[index - 1].date) + 86_400_000; timestamp <= windowTime(VERIFIED_FUEL_WINDOWS[index].date); timestamp += 86_400_000) {
      if (![0, 6].includes(new Date(timestamp).getUTCDay())) days++
    }
    assert.equal(days, 10)
  }
  assert.equal(windowTime('2026-11-12'), at('2026-11-13T00:00:00'))
  assert.ok(Number.isNaN(windowTime('2026-02-30')))
  assert.equal(resolveFuelReminder(view(), at('2027-01-01T00:00:00')).next, null)
})

test('计划窗口只给日期，未知结果、错过公告与假日区间不自行计算价格或日期', () => {
  const current = view()
  const reminder = resolveFuelReminder(current, at('2026-10-30T12:00:00'))
  assert.equal(reminder.state, 'planned'); assert.equal(reminder.next.date, '2026-11-12'); assert.equal(reminder.advice, null)
  const overdue = resolveFuelReminder(current, at('2026-11-13T00:00:00'))
  assert.equal(overdue.awaiting, true); assert.equal(overdue.next.date, '2026-11-26')
  assert.equal(resolveFuelReminder({ fuel: [], fuelReminder: { windows: [] } }, at('2026-10-01T00:00:00')).next, null)
})

test('媒体预测需发布时间、目标轮次与24小时有效期，官方公告优先', () => {
  const current = view()
  const prediction = parseFuelPrediction(predictionHtml, sourceUrl, '2026-10-30T04:00:00Z')
  assert.equal(prediction.windowDate, '2026-11-12')
  current.fuelReminder.prediction = prediction
  assert.equal(resolveFuelReminder(current, at('2026-10-30T12:00:00')).state, 'prediction')
  assert.equal(resolveFuelReminder(current, at('2026-10-30T12:00:00')).advice, null)
  assert.equal(resolveFuelReminder(current, at('2026-10-31T10:36:31')).state, 'planned')
  assert.equal(resolveFuelReminder(current, at('2026-10-30T10:00:00')).state, 'planned')
  current.fuelReminder.prediction.windowDate = '2026-10-29'
  assert.equal(resolveFuelReminder(current, at('2026-10-30T12:00:00')).state, 'planned')
  assert.equal(parseFuelPrediction(predictionHtml.replace('2026-10-30 10:36:31', ''), sourceUrl, '2026-10-30T04:00:00Z'), null)
  assert.equal(parseFuelPrediction(predictionHtml.replace('国内新一轮成品油调价窗口将于11月12日24时进行。', '未提供目标日期'), sourceUrl, '2026-10-30T04:00:00Z'), null)
})

test('只有已确认上涨且未生效提示加油，到点自动切价并推进窗口', () => {
  const current = view()
  current.upcomingFuel = { status: 'upcoming', effectiveFrom: '2026-11-12T16:00:00Z', prices: { '92号汽油': 8.1, '95号汽油': 8.2, '0号柴油': 8 } }
  const before = at('2026-11-12T23:59:59')
  assert.match(resolveFuelReminder(current, before).advice, /已确定上涨/)
  current.fuel[0].displayStatus = 'cached'
  assert.equal(resolveFuelReminder(current, before).advice, null)
  current.fuel[0].displayStatus = 'current'
  const after = resolveUpcomingFuelView(current, at('2026-11-13T00:00:00'))
  assert.equal(after.fuel[0].value, 8.1)
  assert.equal(resolveFuelReminder(after, at('2026-11-13T00:00:00')).next.date, '2026-11-26')
  assert.equal(resolveFuelReminder(after, at('2026-11-13T00:00:00')).advice, null)
  current.upcomingFuel.prices = { '92号汽油': 7.9, '95号汽油': 7.9, '0号柴油': 7.9 }
  assert.equal(resolveFuelReminder(current, before).advice, null)
  current.upcomingFuel.prices['95号汽油'] = undefined
  assert.equal(resolveUpcomingFuelView(current, at('2026-11-13T00:00:00')).fuel[0].value, 8)
})

test('官方不调整、暂停、延迟抑制旧预测；到下一窗口旧结果不再确认当前轮次', () => {
  for (const direction of ['不调整', '暂停调整', '延迟调整']) {
    const current = view()
    current.fuelReminder.officialOutcome = { direction, effectiveFrom: '2026-11-12T16:00:00Z' }
    const result = resolveFuelReminder(current, at('2026-11-12T20:00:00'))
    assert.equal(result.state, 'official'); assert.equal(result.direction, direction); assert.equal(result.advice, null)
    if (direction === '不调整') assert.equal(resolveFuelReminder(current, at('2026-11-27T00:00:00')).awaiting, true)
    else assert.equal(resolveFuelReminder(current, at('2026-11-27T00:00:00')).state, 'official')
  }
})

test('不调整生效后允许下一轮新预测，暂停延迟优先阻断同轮上涨和自动切价', () => {
  const current = view()
  current.fuelReminder.officialOutcome = { direction: '不调整', effectiveFrom: '2026-11-12T16:00:00Z' }
  current.fuelReminder.prediction = { windowDate: '2026-11-26', direction: 'up', publishedAt: '2026-11-13T01:00:00Z', sourceName: '测试来源', sourceUrl }
  assert.equal(resolveFuelReminder(current, at('2026-11-13T12:00:00')).state, 'prediction')
  current.upcomingFuel = { status: 'upcoming', effectiveFrom: '2026-11-12T16:00:00Z', prices: { '92号汽油': 9, '95号汽油': 9, '0号柴油': 9 } }
  for (const direction of ['暂停调整', '延迟调整']) {
    current.fuelReminder.officialOutcome.direction = direction
    assert.equal(resolveFuelReminder(current, at('2026-11-12T20:00:00')).direction, direction)
    assert.equal(resolveFuelReminder(current, at('2026-11-12T20:00:00')).advice, null)
    assert.equal(resolveUpcomingFuelView(current, at('2026-11-13T00:00:00')).fuel[0].value, 8)
  }
})

test('采集失败不伪造预测；提醒字段经仓储、显示快照与两页面完整传递', async () => {
  const reminder = await collectFuelReminder(new Date('2026-10-30T04:00:00Z'), async () => { throw Error('offline') })
  assert.equal(reminder.prediction, null)
  const normalized = normalizeSnapshot({ collectedAt: '2026-10-30T04:00:00Z', brands: [], guangdongFuel: [], fuelReminder: reminder })
  const display = buildDisplaySnapshot(normalized, createEmptyStore())
  const views = buildMarketViews(display)
  assert.equal(views.home.fuelReminder.windows.length, 5)
  assert.equal(views.fuel.fuelReminder.collectedAt, '2026-10-30T04:00:00.000Z')
})
