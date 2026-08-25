import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDashboardResponse, buildTrendHistory } from '../src/dashboard-data.mjs'

function observation(assetId, value, timestamp, extra = {}) {
  return {
    assetId,
    available: true,
    value,
    observedAt: timestamp,
    collectedAt: timestamp,
    metadata: {},
    ...extra,
  }
}

test('趋势响应只包含近30天的趋势资产和必要字段', () => {
  const now = Date.parse('2026-08-24T12:00:00.000Z')
  const history = [
    observation('international-gold-cny-gram', 1001, '2026-08-24T08:00:00.000Z'),
    observation('au9999', 1003, '2026-08-23T08:00:00.000Z'),
    observation('brand-gold-chow-sang-sang', 1390, '2026-08-24T08:00:00.000Z'),
    observation('guangdong-fuel-92', 7.8, '2026-07-10T16:00:00.000Z'),
    observation('guangdong-fuel-95', 8.4, '2026-08-14T16:00:00.000Z', { metadata: { effectiveFrom: '2026-08-14T16:00:00.000Z' } }),
  ]
  const trend = buildTrendHistory(history, now)
  assert.deepEqual(trend.map((item) => item.assetId), ['guangdong-fuel-95', 'au9999', 'international-gold-cny-gram'])
  assert.deepEqual(Object.keys(trend[0]).sort(), ['assetId', 'collectedAt', 'observedAt', 'percentage', 'timestamp', 'value'])
})

test('仪表盘响应保留页面当前数据并附带趋势历史', () => {
  const store = {
    history: [
      observation('international-gold-cny-gram', 1001, '2026-08-24T08:00:00.000Z'),
      observation('domestic-international-gold-spread', 2, '2026-08-24T08:00:00.000Z', { percentage: 0.2 }),
    ],
    latestAttempt: { collectedAt: '2026-08-24T08:00:00.000Z', observations: [] },
    latestSuccessfulByAsset: {},
  }
  const response = buildDashboardResponse(store, Date.parse('2026-08-24T12:00:00.000Z'))
  assert.deepEqual(response.history.map((item) => item.assetId), ['international-gold-cny-gram', 'domestic-international-gold-spread'])
  assert.ok(response.views.gold)
})
