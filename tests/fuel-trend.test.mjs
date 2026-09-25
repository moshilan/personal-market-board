import assert from 'node:assert/strict'
import test from 'node:test'
import { GUANGDONG_FUEL_HISTORY_BACKFILL } from '../src/guangdong-fuel-history.mjs'
import { FUEL_TREND_RANGES, fuelTrendPoints } from '../public/fuel-trend.js'

const assetIds = ['guangdong-fuel-92', 'guangdong-fuel-95', 'guangdong-fuel-0-diesel']
const history = GUANGDONG_FUEL_HISTORY_BACKFILL.flatMap((event) => Object.entries(event.prices).map(([product, value]) => ({
  assetId: {
    '92号汽油': 'guangdong-fuel-92',
    '95号汽油': 'guangdong-fuel-95',
    '0号柴油': 'guangdong-fuel-0-diesel',
  }[product],
  value,
  date: new Date(event.effectiveFrom).toISOString().slice(0, 10),
  timestamp: event.effectiveFrom,
  collectedAt: '2026-09-25T08:55:46.458Z',
})))
const olderStoredHistory = ['2025-10-13', '2026-02-24', '2026-04-21'].flatMap((date, index) => assetIds.map((assetId, assetIndex) => ({
  assetId,
  value: 6 + index + assetIndex / 100,
  date,
  timestamp: `${date}T16:00:00.000Z`,
  collectedAt: '2026-09-25T08:55:46.458Z',
})))
const availableHistory = [...history, ...olderStoredHistory]

test('油价范围近10次按完整事件数选取且三种油品日期一致', () => {
  const series = fuelTrendPoints({ history }, assetIds, FUEL_TREND_RANGES[0], '2026-09-25')
  assert.deepEqual(series.map((item) => item.points.length), [10, 10, 10])
  assert.deepEqual(series[0].points.map((item) => item.date), series[1].points.map((item) => item.date))
  assert.deepEqual(series[0].points.map((item) => item.date), series[2].points.map((item) => item.date))
  assert.equal(series[0].points[0].date, '2026-05-21')
  assert.equal(series[0].points.at(-1).date, '2026-09-24')
})

test('半年和一年只展示现有历史中落入北京时间范围的事件', () => {
  const halfYear = fuelTrendPoints({ history: availableHistory }, assetIds, FUEL_TREND_RANGES[1], '2026-09-25')
  const year = fuelTrendPoints({ history: availableHistory }, assetIds, FUEL_TREND_RANGES[2], '2026-09-25')
  assert.deepEqual(halfYear.map((item) => item.points.length), [11, 11, 11])
  assert.equal(halfYear[0].points[0].date, '2026-04-21')
  assert.equal(halfYear[0].points.at(-1).date, '2026-09-24')
  assert.deepEqual(year.map((item) => item.points.length), [13, 13, 13])
  assert.equal(year[0].points[0].date, '2025-10-13')
})

test('油价范围忽略未来公告、不完整事件和同日重复采集', () => {
  const alteredHistory = availableHistory.filter((item) => !(item.date === '2026-08-14' && item.assetId === 'guangdong-fuel-95'))
  alteredHistory.push(...assetIds.map((assetId) => ({
    assetId, value: 99, date: '2026-09-25', timestamp: '2026-09-25T16:00:00.000Z', collectedAt: '2026-09-25T09:00:00.000Z',
  })))
  alteredHistory.push({ ...history.find((item) => item.assetId === 'guangdong-fuel-92'), value: 99 })
  const series = fuelTrendPoints({ history: alteredHistory }, assetIds, FUEL_TREND_RANGES[2], '2026-09-24')
  assert.deepEqual(series.map((item) => item.points.length), [12, 12, 12])
  assert.equal(series[0].points.some((item) => item.date === '2026-08-14'), false)
  assert.equal(series[0].points.some((item) => item.date === '2026-09-25'), false)
})
