const GOLD_ASSETS = [
  { assetId: 'international-gold-cny-gram', label: '国际黄金人民币折算', unitLabel: '元/克' },
  { assetId: 'au9999', label: 'Au99.99', unitLabel: '元/克' },
  { assetId: 'domestic-international-gold-spread', label: '国内外价差', unitLabel: '元/克' },
]

const REFERENCE_ASSETS = [
  { assetId: 'xau-usd', label: '国际黄金 XAU/USD', unitLabel: 'USD/盎司' },
  { assetId: 'usd-cny', label: 'USD/CNY', unitLabel: 'CNY/美元' },
]

const SILVER_ASSETS = [
  { assetId: 'international-silver-cny-gram', label: '国际白银人民币折算', unitLabel: '元/克' },
  { assetId: 'domestic-silver-cny-gram', label: '国内白银', unitLabel: '元/克' },
  { assetId: 'domestic-international-silver-spread', label: '国内外白银价差', unitLabel: '元/克' },
]

const SILVER_REFERENCES = [
  { assetId: 'xag-usd', label: '国际白银 XAG/USD', unitLabel: 'USD/盎司' },
  { assetId: 'usd-cny', label: 'USD/CNY', unitLabel: 'CNY/美元' },
]

const BRAND_ASSETS = [
  { assetId: 'brand-gold-chow-sang-sang', label: '周生生' },
  { assetId: 'brand-gold-chow-tai-fook', label: '周大福' },
  { assetId: 'brand-gold-luk-fook', label: '六福' },
  { assetId: 'brand-gold-lao-feng-xiang', label: '老凤祥' },
]

const FUEL_ASSETS = [
  { assetId: 'guangdong-fuel-92', label: '92号汽油', priority: 'primary' },
  { assetId: 'guangdong-fuel-95', label: '95号汽油', priority: 'primary' },
  { assetId: 'guangdong-fuel-0-diesel', label: '0号柴油', priority: 'secondary' },
]

function sourceLabel(observation) {
  if (observation.source?.name) return observation.source.name
  try { return new URL(observation.source?.url).hostname } catch { return null }
}

function unavailableAsset(definition) {
  return {
    ...definition, available: false, displayStatus: 'unavailable', value: null, observedAt: null,
    reason: '尚无本地数据', sourceLabel: null, product: definition.assetId.startsWith('brand-') ? '足金饰品' : null, effectiveAt: null,
  }
}

function decorate(definition, byAsset) {
  const observation = byAsset.get(definition.assetId)
  if (!observation) return unavailableAsset(definition)
  return {
    ...definition, ...observation, sourceLabel: sourceLabel(observation),
    product: observation.metadata?.product ?? (definition.assetId.startsWith('brand-') ? '足金饰品' : null),
    effectiveAt: observation.metadata?.effectiveFrom ?? null,
  }
}

export function buildMarketViews(displaySnapshot) {
  const byAsset = new Map((displaySnapshot?.observations ?? []).map((observation) => [observation.assetId, observation]))
  const gold = GOLD_ASSETS.map((definition) => decorate(definition, byAsset))
  const silver = SILVER_ASSETS.map((definition) => decorate(definition, byAsset))
  const silverReferences = SILVER_REFERENCES.map((definition) => decorate(definition, byAsset))
  const references = REFERENCE_ASSETS.map((definition) => decorate(definition, byAsset))
  const brands = BRAND_ASSETS.map((definition) => decorate(definition, byAsset))
  const fuel = FUEL_ASSETS.map((definition) => decorate(definition, byAsset))
  return {
    home: { gold, xauUsd: references[0], silver: silver.slice(0, 2), brands, fuel: fuel.slice(0, 2) },
    gold: { gold, references, brands },
    silver: { silver, references: silverReferences },
    fuel: { fuel },
  }
}

export function buildHomeView(displaySnapshot) {
  return buildMarketViews(displaySnapshot).home
}
