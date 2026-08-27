import assert from 'node:assert/strict'
import test from 'node:test'
import { buildBrandTrendHistory, buildDashboardResponse, buildTrendHistory } from '../src/dashboard-data.mjs'

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
    observation('international-silver-cny-gram', 15.9, '2026-08-24T08:00:00.000Z'),
    observation('brand-gold-chow-sang-sang', 1390, '2026-08-24T08:00:00.000Z'),
    observation('guangdong-fuel-92', 7.8, '2026-07-10T16:00:00.000Z'),
    observation('guangdong-fuel-95', 8.4, '2026-08-14T16:00:00.000Z', { metadata: { effectiveFrom: '2026-08-14T16:00:00.000Z' } }),
  ]
  const trend = buildTrendHistory(history, now)
  assert.deepEqual(trend.map((item) => item.assetId), ['guangdong-fuel-95', 'au9999', 'international-gold-cny-gram', 'international-silver-cny-gram'])
  assert.deepEqual(Object.keys(trend[0]).sort(), ['assetId', 'collectedAt', 'date', 'observedAt', 'percentage', 'timestamp', 'value'])
})

test('同一自然日趋势记录只保留采集时间最晚的一条', () => {
  const now = Date.parse('2026-08-25T12:00:00.000Z')
  const trend = buildTrendHistory([
    observation('international-gold-cny-gram', 1001, '2026-08-24T01:00:00.000Z', { collectedAt: '2026-08-24T01:00:00.000Z' }),
    observation('international-gold-cny-gram', 1005, '2026-08-24T09:00:00.000Z', { collectedAt: '2026-08-24T09:00:00.000Z' }),
    observation('au9999', 1003, '2026-08-24T08:00:00.000Z'),
    observation('domestic-international-gold-spread', 2, '2026-08-24T08:00:00.000Z', { percentage: 0.2 }),
  ], now)
  assert.equal(trend.filter((item) => item.assetId === 'international-gold-cny-gram').length, 1)
  assert.equal(trend.find((item) => item.assetId === 'international-gold-cny-gram').value, 1005)
  assert.deepEqual([...new Set(trend.map((item) => item.date))], ['2026-08-24'])
})

test('品牌趋势排除中国时区当天、独立取每品牌当日最后记录且不补缺失日期', () => {
  const now = Date.parse('2026-08-28T12:00:00.000Z')
  const trend = buildBrandTrendHistory([
    observation('brand-gold-chow-sang-sang', 1390, '2026-08-26T01:00:00.000Z'),
    observation('brand-gold-chow-sang-sang', 1392, '2026-08-27T01:00:00.000Z'),
    observation('brand-gold-chow-sang-sang', 1394, '2026-08-27T09:00:00.000Z'),
    observation('brand-gold-chow-sang-sang', 1398, '2026-08-28T01:00:00.000Z'),
    observation('brand-gold-chow-tai-fook', 1395, '2026-08-27T09:00:00.000Z'),
    observation('brand-gold-luk-fook', 1393, '2026-08-26T09:00:00.000Z'),
    observation('brand-gold-luk-fook', 1396, '2026-08-28T01:00:00.000Z'),
    observation('brand-gold-lao-feng-xiang', 1391, '2026-08-27T09:00:00.000Z'),
  ], now)
  assert.deepEqual(trend.map((item) => [item.assetId, item.date, item.value]), [
    ['brand-gold-chow-sang-sang', '2026-08-26', 1390],
    ['brand-gold-luk-fook', '2026-08-26', 1393],
    ['brand-gold-chow-sang-sang', '2026-08-27', 1394],
    ['brand-gold-chow-tai-fook', '2026-08-27', 1395],
    ['brand-gold-lao-feng-xiang', '2026-08-27', 1391],
  ])
})

test('白银三项趋势独立按中国自然日取采集时间最晚记录', () => {
  const now = Date.parse('2026-08-28T12:00:00.000Z')
  const trend = buildTrendHistory([
    observation('international-silver-cny-gram', 15.8, '2026-08-27T01:00:00.000Z'),
    observation('international-silver-cny-gram', 16.0, '2026-08-27T09:00:00.000Z'),
    observation('domestic-silver-cny-gram', 16.7, '2026-08-27T09:00:00.000Z'),
    observation('domestic-international-silver-spread', 0.7, '2026-08-27T09:00:00.000Z', { percentage: 4.375 }),
  ], now)
  assert.equal(trend.filter((item) => item.assetId === 'international-silver-cny-gram').length, 1)
  assert.equal(trend.find((item) => item.assetId === 'international-silver-cny-gram').value, 16.0)
  assert.equal(trend.find((item) => item.assetId === 'domestic-international-silver-spread').percentage, 4.375)
})

test('仪表盘响应保留页面当前数据并附带趋势历史', () => {
  const store = {
    history: [
      observation('international-gold-cny-gram', 1001, '2026-08-24T08:00:00.000Z'),
      observation('domestic-international-gold-spread', 2, '2026-08-24T08:00:00.000Z', { percentage: 0.2 }),
      observation('brand-gold-chow-sang-sang', 1390, '2026-08-23T08:00:00.000Z'),
    ],
    latestAttempt: { collectedAt: '2026-08-24T08:00:00.000Z', observations: [] },
    latestSuccessfulByAsset: {},
  }
  const response = buildDashboardResponse(store, Date.parse('2026-08-24T12:00:00.000Z'))
  assert.deepEqual(response.history.map((item) => item.assetId).sort(), ['domestic-international-gold-spread', 'international-gold-cny-gram'])
  assert.deepEqual(response.brandHistory.map((item) => item.assetId), ['brand-gold-chow-sang-sang'])
  assert.ok(response.views.gold)
})
