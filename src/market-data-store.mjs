import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export const STORE_VERSION = 1
export const HISTORY_INTERVAL_MS = 30 * 60 * 1_000
export const HISTORY_RETENTION_MS = 31 * 24 * 60 * 60 * 1_000

const ASSET_IDS = {
  'XAU/USD': 'xau-usd',
  'USD/CNY': 'usd-cny',
  'Au99.99': 'au9999',
  '国际黄金人民币折算价': 'international-gold-cny-gram',
  '国内外价差': 'domestic-international-gold-spread',
  '周生生': 'brand-gold-chow-sang-sang',
  '周大福': 'brand-gold-chow-tai-fook',
  '六福珠宝': 'brand-gold-luk-fook',
  '老凤祥': 'brand-gold-lao-feng-xiang',
  '92号汽油': 'guangdong-fuel-92',
  '95号汽油': 'guangdong-fuel-95',
  '0号柴油': 'guangdong-fuel-0-diesel',
  '98号汽油': 'guangdong-fuel-98',
}

function sourceId(record) {
  const seed = record.sourceUrl ?? record.sourceName ?? 'unknown'
  return `source:${seed.replace(/[^a-zA-Z0-9]+/g, '-').replace(/(^-|-$)/g, '').toLowerCase()}`
}

function assetId(record) {
  const label = record.brand ?? record.name ?? record.product
  return ASSET_IDS[label] ?? `unknown:${label}`
}

function observationTime(record) {
  return record.effectiveFrom ?? record.observedAt ?? record.quoteDate ?? record.calculatedAt ?? record.collectedAt
}

function observationId(record) {
  return `observation:${assetId(record)}:${sourceId(record)}:${observationTime(record)}`
}

function metadata(record) {
  const fields = [
    'name', 'brand', 'product', 'baseCurrency', 'quoteCurrency', 'quoteDate',
    'rawSourceTimestamp', 'sourceTimePrecision', 'effectiveFrom', 'backupSourceUrl',
  ]
  return Object.fromEntries(fields.filter((field) => record[field] !== undefined).map((field) => [field, record[field]]))
}

function unavailableObservation(record) {
  return {
    id: observationId(record),
    assetId: assetId(record),
    label: record.brand ?? record.name ?? record.product,
    available: false,
    value: null,
    currency: record.currency ?? record.quoteCurrency ?? null,
    unit: record.unit ?? (record.baseCurrency ? 'rate' : null),
    observedAt: record.observedAt ?? record.quoteDate ?? record.effectiveFrom ?? null,
    collectedAt: record.collectedAt,
    calculatedAt: record.calculatedAt ?? null,
    source: {
      id: sourceId(record),
      name: record.sourceName ?? null,
      type: record.sourceUrl === 'derived' ? 'derived' : 'external',
      url: record.sourceUrl ?? null,
    },
    valueType: record.sourceUrl === 'derived' ? 'derived' : 'observed',
    derivedFromIds: [],
    reason: record.reason,
    metadata: metadata(record),
  }
}

function availableObservation(record, derivedFromIds) {
  return {
    id: observationId(record),
    assetId: assetId(record),
    label: record.brand ?? record.name ?? record.product,
    available: true,
    value: record.value,
    percentage: record.percentage ?? null,
    currency: record.currency ?? record.quoteCurrency,
    unit: record.unit ?? (record.baseCurrency ? 'rate' : null),
    observedAt: record.observedAt ?? record.quoteDate ?? record.effectiveFrom ?? record.calculatedAt,
    collectedAt: record.collectedAt,
    calculatedAt: record.calculatedAt ?? null,
    source: {
      id: sourceId(record),
      name: record.sourceName ?? null,
      type: record.sourceUrl === 'derived' ? 'derived' : 'external',
      url: record.sourceUrl ?? null,
    },
    valueType: record.sourceUrl === 'derived' ? 'derived' : 'observed',
    derivedFromIds,
    metadata: metadata(record),
  }
}

export function normalizeSnapshot(rawSnapshot) {
  const rawRecords = [
    rawSnapshot.xauUsd,
    rawSnapshot.usdCny,
    rawSnapshot.au9999,
    rawSnapshot.internationalGoldCny,
    rawSnapshot.spread,
    ...rawSnapshot.brands,
    ...rawSnapshot.guangdongFuel,
  ]
  const baseRecords = rawRecords.filter((record) => record.sourceUrl !== 'derived')
  const observations = baseRecords.map((record) => record.available ? availableObservation(record, []) : unavailableObservation(record))
  const idsByName = new Map(baseRecords.map((record) => [record.name, observationId(record)]))

  for (const record of rawRecords.filter((item) => item.sourceUrl === 'derived')) {
    const recordWithCollectionTime = { ...record, collectedAt: record.collectedAt ?? rawSnapshot.collectedAt }
    const derivedFromIds = record.available
      ? record.inputs.map((input) => idsByName.get(input.name)).filter(Boolean)
      : []
    observations.push(recordWithCollectionTime.available ? availableObservation(recordWithCollectionTime, derivedFromIds) : unavailableObservation(recordWithCollectionTime))
    idsByName.set(recordWithCollectionTime.name, observationId(recordWithCollectionTime))
  }

  return {
    schemaVersion: STORE_VERSION,
    collectedAt: rawSnapshot.collectedAt,
    observations,
  }
}

export function createEmptyStore() {
  return {
    schemaVersion: STORE_VERSION,
    latestAttempt: null,
    latestSuccessfulByAsset: {},
    history: [],
  }
}

export async function readStore(storePath) {
  try {
    const store = JSON.parse(await readFile(storePath, 'utf8'))
    if (store.schemaVersion !== STORE_VERSION || !Array.isArray(store.history) || !store.latestSuccessfulByAsset) {
      throw new Error('本地数据文件结构不兼容')
    }
    return store
  } catch (error) {
    if (error.code === 'ENOENT') return createEmptyStore()
    throw error
  }
}

async function writeStore(storePath, store) {
  await mkdir(dirname(storePath), { recursive: true })
  const temporaryPath = `${storePath}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, 'utf8')
  await rename(temporaryPath, storePath)
}

function shouldAppendHistory(history, observation) {
  if (!observation.available) return false
  const assetHistory = history.filter((item) => item.assetId === observation.assetId)
  if (observation.metadata.effectiveFrom) {
    return !assetHistory.some((item) => item.metadata.effectiveFrom === observation.metadata.effectiveFrom)
  }
  if (observation.assetId.startsWith('brand-') && observation.metadata.quoteDate) {
    return !assetHistory.some((item) => item.metadata.quoteDate === observation.metadata.quoteDate)
  }
  const latest = assetHistory.at(-1)
  return !latest || Date.parse(observation.collectedAt) - Date.parse(latest.collectedAt) >= HISTORY_INTERVAL_MS
}

export function getHistory(store, assetId, { from, to } = {}) {
  return store.history.filter((observation) => (
    observation.assetId === assetId
    && (!from || observation.observedAt >= from)
    && (!to || observation.observedAt <= to)
  ))
}

export function buildDisplaySnapshot(liveSnapshot, store) {
  const observations = liveSnapshot.observations.map((liveObservation) => {
    if (liveObservation.available) return { ...liveObservation, displayStatus: 'current' }
    const cachedObservation = store.latestSuccessfulByAsset[liveObservation.assetId]
    if (!cachedObservation) return { ...liveObservation, displayStatus: 'unavailable' }
    return {
      ...cachedObservation,
      displayStatus: 'cached',
      liveStatus: 'unavailable',
      liveReason: liveObservation.reason,
    }
  })
  return { collectedAt: liveSnapshot.collectedAt, observations }
}

export async function persistSnapshot(rawSnapshot, storePath) {
  const liveSnapshot = normalizeSnapshot(rawSnapshot)
  const store = await readStore(storePath)
  store.latestAttempt = liveSnapshot
  for (const observation of liveSnapshot.observations) {
    if (!observation.available) continue
    store.latestSuccessfulByAsset[observation.assetId] = observation
    if (shouldAppendHistory(store.history, observation)) store.history.push(observation)
  }
  const retentionStart = Date.parse(liveSnapshot.collectedAt) - HISTORY_RETENTION_MS
  store.history = store.history.filter((observation) => Date.parse(observation.collectedAt) >= retentionStart)
  await writeStore(storePath, store)
  return { liveSnapshot, displaySnapshot: buildDisplaySnapshot(liveSnapshot, store), store }
}
