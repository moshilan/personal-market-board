import assert from 'node:assert/strict'
import test from 'node:test'
import { buildHomeView, buildMarketViews } from '../src/home-view-model.mjs'

function observation(assetId, value, displayStatus = 'current', extra = {}) {
  return {
    assetId,
    available: value !== null,
    value,
    observedAt: '2026-08-24T08:00:00.000Z',
    displayStatus,
    reason: value === null ? '测试不可用' : undefined,
    ...extra,
  }
}

test('首页模型展示当前有效数据与价差百分比', () => {
  const home = buildHomeView({ observations: [
    observation('xau-usd', 2400),
    observation('au9999', 1000),
    observation('domestic-international-gold-spread', 20, 'current', { percentage: 2 }),
    observation('guangdong-fuel-92', 7.8),
  ] })
  assert.equal(home.gold.find((item) => item.assetId === 'xau-usd').displayStatus, 'current')
  assert.equal(home.gold.find((item) => item.assetId === 'au9999').displayStatus, 'current')
  assert.deepEqual(home.gold.map((item) => item.assetId), ['xau-usd', 'au9999'])
  assert.equal(home.fuel.length, 2)
})

test('金价与油价视图保留完整内容，首页只保留92与95摘要', () => {
  const views = buildMarketViews({ observations: [
    observation('xau-usd', 2400),
    observation('usd-cny', 7.2),
    observation('guangdong-fuel-92', 7.8),
    observation('guangdong-fuel-95', 8.5),
    observation('guangdong-fuel-0-diesel', 7.1),
  ] })
  assert.equal(views.home.fuel.length, 2)
  assert.equal(views.gold.references.length, 2)
  assert.equal(views.silver.silver.length, 3)
  assert.equal(views.silver.references.length, 1)
  assert.equal(views.silver.references[0].assetId, 'xag-usd')
  assert.equal(views.fuel.fuel.length, 3)
  assert.equal(views.fuel.fuel[0].effectiveAt, null)
})

test('首页展示国际、国内白银的紧凑摘要', () => {
  const home = buildHomeView({ observations: [
    observation('xag-usd', 68.2),
    observation('domestic-silver-cny-gram', 16.711),
  ] })
  assert.deepEqual(home.silver.map((item) => item.value), [68.2, 16.711])
  assert.deepEqual(home.silver.map((item) => item.unitLabel), ['美元/盎司', '元/克'])
  assert.deepEqual(home.silver.map((item) => item.assetId), ['xag-usd', 'domestic-silver-cny-gram'])
})

test('首页模型保留缓存状态和原始行情时间', () => {
  const home = buildHomeView({ observations: [observation('xau-usd', 2400, 'cached')] })
  const xau = home.xauUsd
  assert.equal(xau.displayStatus, 'cached')
  assert.equal(xau.observedAt, '2026-08-24T08:00:00.000Z')
})

test('首页模型为缺失或不可用记录保留不可用状态', () => {
  const home = buildHomeView({ observations: [observation('au9999', null, 'unavailable')] })
  const au9999 = home.gold.find((item) => item.assetId === 'au9999')
  const brand = home.brands[0]
  assert.equal(au9999.available, false)
  assert.equal(au9999.displayStatus, 'unavailable')
  assert.equal(brand.displayStatus, 'unavailable')
})
