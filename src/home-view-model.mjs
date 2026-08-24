const HOME_ASSETS = [
  { assetId: 'xau-usd', label: '国际黄金', unitLabel: 'USD/盎司', digits: 2 },
  { assetId: 'international-gold-cny-gram', label: '人民币折算', unitLabel: '元/克', digits: 2 },
  { assetId: 'au9999', label: 'Au99.99', unitLabel: '元/克', digits: 2 },
  { assetId: 'domestic-international-gold-spread', label: '国内外价差', unitLabel: '元/克', digits: 2 },
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

function unavailableAsset(definition) {
  return {
    ...definition,
    available: false,
    displayStatus: 'unavailable',
    value: null,
    observedAt: null,
    reason: '尚无本地数据',
  }
}

function decorate(definition, byAsset) {
  const observation = byAsset.get(definition.assetId)
  return observation ? { ...definition, ...observation } : unavailableAsset(definition)
}

export function buildHomeView(displaySnapshot) {
  const byAsset = new Map((displaySnapshot?.observations ?? []).map((observation) => [observation.assetId, observation]))
  const gold = HOME_ASSETS.map((definition) => decorate(definition, byAsset))
  return {
    gold,
    brands: BRAND_ASSETS.map((definition) => decorate(definition, byAsset)),
    fuel: FUEL_ASSETS.map((definition) => decorate(definition, byAsset)),
  }
}
