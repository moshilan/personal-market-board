import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import test from 'node:test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildDisplaySnapshot, getHistory, normalizeSnapshot, persistSnapshot } from '../src/market-data-store.mjs'

function available(name, value, collectedAt, extra = {}) {
  return {
    name,
    available: true,
    value,
    currency: 'CNY',
    unit: 'gram',
    observedAt: collectedAt,
    collectedAt,
    sourceUrl: 'https://example.test/source',
    sourceName: '测试源',
    ...extra,
  }
}

function unavailable(name, collectedAt) {
  return { name, available: false, collectedAt, sourceUrl: 'https://example.test/source', reason: '测试失败' }
}

function snapshot(collectedAt, { xauAvailable = true } = {}) {
  const xauUsd = xauAvailable
    ? available('XAU/USD', 2400, collectedAt, { currency: 'USD', unit: 'troy_ounce' })
    : unavailable('XAU/USD', collectedAt)
  const usdCny = available('USD/CNY', 7.2, collectedAt, { baseCurrency: 'USD', quoteCurrency: 'CNY', unit: 'rate' })
  const au9999 = available('Au99.99', 560, collectedAt)
  const internationalGoldCny = xauAvailable
    ? available('国际黄金人民币折算价', 555, collectedAt, { sourceUrl: 'derived', inputs: [{ name: 'XAU/USD' }, { name: 'USD/CNY' }], calculatedAt: collectedAt })
    : unavailable('国际黄金人民币折算价', collectedAt)
  const spread = xauAvailable
    ? available('国内外价差', 5, collectedAt, { sourceUrl: 'derived', inputs: [{ name: 'Au99.99' }, { name: '国际黄金人民币折算价' }], calculatedAt: collectedAt })
    : unavailable('国内外价差', collectedAt)
  return {
    collectedAt,
    xauUsd,
    usdCny,
    au9999,
    internationalGoldCny,
    spread,
    brands: [available('周生生', 1000, collectedAt, { brand: '周生生', product: '足金饰品', quoteDate: '2026-08-24' })],
    guangdongFuel: [available('92号汽油', 7.8, collectedAt, { name: undefined, product: '92号汽油', unit: 'liter', observedAt: undefined, effectiveFrom: '2026-08-14T16:00:00.000Z' })],
  }
}

test('派生记录保留原始记录追溯关系', () => {
  const normalized = normalizeSnapshot(snapshot('2026-08-24T08:00:00.000Z'))
  const byAsset = Object.fromEntries(normalized.observations.map((item) => [item.assetId, item]))
  assert.deepEqual(byAsset['international-gold-cny-gram'].derivedFromIds, [byAsset['xau-usd'].id, byAsset['usd-cny'].id])
  assert.deepEqual(byAsset['domestic-international-gold-spread'].derivedFromIds, [byAsset.au9999.id, byAsset['international-gold-cny-gram'].id])
  assert.equal(byAsset['guangdong-fuel-92'].observedAt, '2026-08-14T16:00:00.000Z')
})

test('实时失败时展示层返回缓存，且不改写实时失败状态', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'market-data-store-'))
  const storePath = join(directory, 'market-data.json')
  await persistSnapshot(snapshot('2026-08-24T08:00:00.000Z'), storePath)
  const failed = await persistSnapshot(snapshot('2026-08-24T09:00:00.000Z', { xauAvailable: false }), storePath)
  const xau = failed.liveSnapshot.observations.find((item) => item.assetId === 'xau-usd')
  const displayed = failed.displaySnapshot.observations.find((item) => item.assetId === 'xau-usd')
  assert.equal(xau.available, false)
  assert.equal(displayed.displayStatus, 'cached')
  assert.equal(displayed.observedAt, '2026-08-24T08:00:00.000Z')
  assert.equal(displayed.liveStatus, 'unavailable')
})

test('历史按30分钟、品牌日期和油价生效时间去重', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'market-data-store-'))
  const storePath = join(directory, 'market-data.json')
  const first = await persistSnapshot(snapshot('2026-08-24T08:00:00.000Z'), storePath)
  const second = await persistSnapshot(snapshot('2026-08-24T08:20:00.000Z'), storePath)
  const third = await persistSnapshot(snapshot('2026-08-24T08:31:00.000Z'), storePath)
  assert.equal(getHistory(third.store, 'xau-usd').length, 2)
  assert.equal(getHistory(third.store, 'brand-gold-chow-sang-sang').length, 1)
  assert.equal(getHistory(third.store, 'guangdong-fuel-92').length, 1)
  assert.equal(buildDisplaySnapshot(first.liveSnapshot, second.store).observations[0].displayStatus, 'current')
})
