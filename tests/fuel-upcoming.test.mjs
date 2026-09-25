import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMarketViews } from '../src/home-view-model.mjs'
import { resolveUpcomingFuelView } from '../public/fuel-upcoming.js'

const upcomingFuel = {
  status: 'upcoming',
  effectiveFrom: '2026-09-25T16:00:00.000Z',
  collectedAt: '2026-09-25T08:00:00.000Z',
  sourceUrl: 'https://drc.gd.gov.cn/spjg/content/post_1.html',
  sourceName: '广东省发展改革委',
  prices: { '92号汽油': 8.7, '95号汽油': 9.4, '0号柴油': 8.4 },
}

function snapshot(includeUpcoming = true) {
  const observations = [
    ['guangdong-fuel-92', '92号汽油', 8.63],
    ['guangdong-fuel-95', '95号汽油', 9.35],
    ['guangdong-fuel-0-diesel', '0号柴油', 8.31],
  ].map(([assetId, label, value]) => ({
    assetId, label, value, available: true, displayStatus: 'current',
    observedAt: '2026-09-24T16:00:00.000Z', effectiveAt: '2026-09-24T16:00:00.000Z',
  }))
  return { observations, upcomingFuel: includeUpcoming ? upcomingFuel : null }
}

test('首页只接收待生效公告摘要，油价页保留完整待生效价格', () => {
  const views = buildMarketViews(snapshot())
  assert.equal(views.home.upcomingFuel.status, 'upcoming')
  assert.equal(views.fuel.upcomingFuel.prices['92号汽油'], 8.7)
  assert.equal(views.fuel.fuel[0].value, 8.63)
})

test('到达生效时刻后自动提升为当前价并移除upcoming', () => {
  const view = buildMarketViews(snapshot()).fuel
  const before = resolveUpcomingFuelView(view, Date.parse('2026-09-25T15:59:59.999Z'))
  assert.equal(before.fuel[0].value, 8.63)
  assert.equal(before.upcomingFuel.status, 'upcoming')

  const after = resolveUpcomingFuelView(view, Date.parse('2026-09-25T16:00:00.000Z'))
  assert.equal(after.fuel[0].value, 8.7)
  assert.equal(after.fuel[0].displayStatus, 'current')
  assert.equal(after.fuel[0].effectiveAt, upcomingFuel.effectiveFrom)
  assert.equal(after.fuel[0].sourceUrl, upcomingFuel.sourceUrl)
  assert.equal(after.upcomingFuel, null)
})

test('没有待生效公告时不生成占位模块', () => {
  const views = buildMarketViews(snapshot(false))
  assert.equal(views.home.upcomingFuel, null)
  assert.equal(views.fuel.upcomingFuel, null)
})
