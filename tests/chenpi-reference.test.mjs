import test from 'node:test'
import assert from 'node:assert/strict'
import { pricePerJin, formatChenpiPrice, formatChenpiPriceTime, isMainChenpiListing, hasChenpiPriceTimeEvidence, hasChenpiPagePriceEvidence, chenpiOneYearReferences, hasChenpiDisplayValue, formatChenpiOffer } from '../public/chenpi-reference.mjs'
import { CHENPI_REFERENCE } from '../public/chenpi-reference-data.mjs'

test('陈皮公斤区间和包装报价按500克换算，保留非封顶上界', () => {
  assert.deepEqual(pricePerJin({ min: 400, max: 1160, unit: '元/公斤' }), { min: 200, max: 580, openEnded: false })
  assert.equal(formatChenpiPrice({ min: 108, unit: '元/件', weightGrams: 50 }), '1,080元/斤')
  assert.equal(formatChenpiPrice({ min: 255, unit: '元/件', weightGrams: 250 }), '510元/斤')
  assert.equal(formatChenpiPrice({ min: 2400, max: 4000, unit: '元/公斤', openEnded: true }), '1,200–2,000及以上元/斤')
})

test('价格或重量不足以换算时显示暂无，不补规格或零价', () => {
  for (const price of [null, { min: null, unit: '元/斤' }, { min: 10, max: 5, unit: '元/斤' },
    { min: 108, unit: '元/件' }, { min: 108, unit: '元/件', weightGrams: 0 }, { min: 10, unit: '元/袋' }]) {
    assert.equal(formatChenpiPrice(price), '暂无')
  }
})

test('陈皮快照保留市场原始年限组、未知报价日期和可追溯的原价', () => {
  assert.deepEqual(CHENPI_REFERENCE.market.map((quote) => quote.label), ['3–5年', '7–8年', '8–10年及以上'])
  const all = [...CHENPI_REFERENCE.market, ...CHENPI_REFERENCE.core, ...CHENPI_REFERENCE.villages.flatMap((village) => village.quotes)]
  assert.equal(new Set(all.map((quote) => quote.id)).size, all.length)
  for (const quote of all) {
    assert.ok(quote.sourceUrl.startsWith('https://'))
    assert.ok(quote.sourceName && quote.originalText && quote.priceType)
    assert.equal(quote.collectedAt, '2026-09-28')
    assert.notEqual(pricePerJin(quote.price), null)
  }
  for (const village of CHENPI_REFERENCE.villages) {
    for (const quote of village.quotes) {
      assert.equal(quote.sourceDate, null)
      assert.equal(quote.priceDate, null)
      assert.equal(formatChenpiPriceTime(quote), '采集时间：2026-09-28')
      assert.ok(['供应挂牌', '零售挂牌'].includes(quote.priceType))
    }
  }
  const meijiang = CHENPI_REFERENCE.villages.find((village) => village.name === '梅江').quotes[0]
  assert.match(meijiang.label, /2016年标/)
  assert.match(meijiang.note, /不换算为10年/)
  const newPeel = all.find((quote) => quote.id === 'chakeng-zhimian-2023-erhong-250g')
  assert.match(newPeel.yearEvidence.text, /未满3年/)
})

test('陈皮价格时间优先原报价日期，报道与电商采集时间不冒充报价日期', () => {
  const quotes = [...CHENPI_REFERENCE.market, ...CHENPI_REFERENCE.core, ...CHENPI_REFERENCE.villages.flatMap((village) => village.quotes)]
  for (const quote of quotes) {
    assert.match(formatChenpiPriceTime(quote), /^(报价日期|报道时间|采集时间)：\d{4}(?:年\d{1,2}月|-\d{2}-\d{2})/)
  }
  assert.equal(formatChenpiPriceTime(CHENPI_REFERENCE.market[0]), '报道时间：2026年1月13日 · 采集时间：2026-09-28')
  assert.equal(formatChenpiPriceTime(CHENPI_REFERENCE.core[0]), '报道时间：2025年10月12日 · 采集时间：2026-09-28')
  const guidance = CHENPI_REFERENCE.core.find((quote) => quote.id === 'core-10-years-circle-guidance')
  assert.equal(formatChenpiPriceTime(guidance), '报价日期：2026年1月 · 报道时间：2026年7月28日 · 采集时间：2026-09-28')
  assert.equal(formatChenpiPriceTime({ priceDate: '2025-12-01', sourceDate: '2026-07-28', collectedAt: '2026-09-28' }), '报价日期：2025年12月1日 · 报道时间：2026年7月28日 · 采集时间：2026-09-28')
  const newPeel = quotes.find((quote) => quote.id === 'chakeng-zhimian-2023-erhong-250g')
  assert.match(newPeel.label, /2023年晒制/)
  assert.equal(formatChenpiPriceTime(newPeel), '采集时间：2026-09-28')
})

test('历史圈枝价目完整保留四个原年档及青皮二红大红，不进入2026资料', () => {
  const history = CHENPI_REFERENCE.core.filter((quote) => quote.period === 'historical')
  const actual = Object.fromEntries(history.map((quote) => [`${quote.yearBand}/${quote.peelType}`, [quote.price.min, quote.price.max]]))
  assert.deepEqual(actual, {
    '1/青皮': [350, 450], '1/二红皮': [420, 520], '1/大红皮': [480, 580],
    '5/青皮': [1400, 1700], '5/二红皮': [1700, 2000], '5/大红皮': [2000, 2500],
    '10/青皮': [4500, 6000], '10/二红皮': [6000, 7500], '10/大红皮': [7500, 10000],
    '15/青皮': [10000, 15000], '15/二红皮': [15000, 22000], '15/大红皮': [22000, 35000],
  })
  assert.equal(history.length, 12)
  assert.ok(history.every((quote) => quote.priceDate === null && quote.sourceDate === '2025-10-12' && quote.observationType === '媒体价格表 · 历史资料'))
  assert.equal(CHENPI_REFERENCE.core.filter((quote) => quote.period !== 'historical').length, 1)
})

test('全部挂牌有独立核验和年限证据，规格不冒充起购量，冲突及未核验记录移出主参考', () => {
  const listings = CHENPI_REFERENCE.villages.flatMap((village) => village.quotes)
  for (const quote of listings) {
    assert.ok(quote.originalOffer && quote.yearEvidence.text && quote.pageCheck.text)
    assert.equal(quote.pageCheck.checkedAt, '2026-09-28')
    assert.ok(['supply', 'retail', 'branded-retail'].includes(quote.listingTier))
  }
  assert.deepEqual(listings.filter(isMainChenpiListing).map((quote) => quote.id), [
    'dongjia-luo-10-years', 'tianma-luo-5-years', 'tianma-cha-story-10-years-50g', 'chakeng-zhang-2020-erhong', 'chakeng-zhimian-2023-erhong-250g',
  ])
  const shengyuan = listings.find((quote) => quote.id === 'tianma-shengyuan-10-years-500g')
  assert.equal(shengyuan.pageCheck.observedPrice.min, 380)
  assert.equal(hasChenpiPriceTimeEvidence(shengyuan), false)
  assert.equal(shengyuan.yearEvidence.kind, 'conflict')
  const branded = listings.find((quote) => quote.id === 'tianma-cha-story-10-years-50g')
  const dated = listings.find((quote) => quote.id === 'chakeng-zhimian-2023-erhong-250g')
  assert.equal(branded.minimumOrder, null)
  assert.equal(branded.packageSpec, '50克/件')
  assert.equal(dated.minimumOrder, null)
  assert.equal(dated.packageSpec, '250克/件')
  assert.equal(dated.yearEvidence.kind, 'production-date')
  assert.equal(listings.find((quote) => quote.id === 'chakeng-zhang-2020-erhong').yearEvidence.kind, 'merchant-year')
})

test('当前报价必须有明确价格日期或当日直达页面的同价证据，页面存在与商品年份不够', () => {
  const valid = CHENPI_REFERENCE.villages.find((village) => village.name === '茶坑').quotes[1]
  assert.equal(hasChenpiPriceTimeEvidence(valid), true)
  assert.equal(valid.pageCheck.observedAt, '2026-09-28T18:20:37+08:00')
  for (const patch of [
    { observedPrice: null }, { offerText: '' }, { excerpt: '' }, { method: 'search-cache' },
    { httpStatus: 404 }, { state: 'page-exists' }, { checkedAt: '2026-09-27' },
    { observedAt: '2026-09-27T18:20:37+08:00' },
    { observedPrice: { ...valid.price, min: 250 } },
  ]) assert.equal(isMainChenpiListing({ ...valid, pageCheck: { ...valid.pageCheck, ...patch } }), false)
  assert.equal(isMainChenpiListing({ ...valid, pageCheck: null }), false)
  for (const key of ['priceDate', 'priceUpdatedAt']) {
    assert.equal(isMainChenpiListing({ ...valid, pageCheck: null, [key]: '2026-09-28' }), true)
    assert.equal(hasChenpiPagePriceEvidence({ ...valid, pageCheck: { ...valid.pageCheck, httpStatus: 404 }, [key]: '2026-09-28' }), false)
    for (const date of ['2026-09-29', '2026-02-30', '2026-09']) {
      assert.equal(isMainChenpiListing({ ...valid, pageCheck: null, [key]: date }), false)
    }
    assert.equal(isMainChenpiListing({ ...valid, [key]: '2026-09-28', pageCheck: { state: 'sold-out' } }), false)
  }
})

test('1年档仅取来源明确的1年资料，不把生产年份或未满3年的样本强行归档', () => {
  const oneYear = chenpiOneYearReferences()
  assert.equal(oneYear.length, 3)
  assert.ok(oneYear.every((quote) => quote.yearBand === 1 && quote.period === 'historical'))
  assert.deepEqual(chenpiOneYearReferences({ core: [{ label: '1年标称' }, { yearBand: 3 }, { yearBand: 1 }] }), [{ yearBand: 1 }])
})

test('下架售罄及缺失年限证据的挂牌均不能进入主参考', () => {
  const valid = CHENPI_REFERENCE.villages.find((village) => village.name === '茶坑').quotes[0]
  for (const state of ['removed', 'sold-out', 'unverified']) {
    assert.equal(isMainChenpiListing({ ...valid, pageCheck: { ...valid.pageCheck, state } }), false)
  }
  assert.equal(isMainChenpiListing({ ...valid, yearEvidence: { kind: 'conflict' } }), false)
  assert.equal(isMainChenpiListing({ ...valid, yearEvidence: null }), false)
  assert.equal(isMainChenpiListing({ ...valid, conflicts: ['品种冲突'] }), false)
  assert.equal(isMainChenpiListing({ ...valid, price: { min: 108, unit: '元/件' } }), false)
})

test('普通缺失占位不渲染，包装原价优先且更新日期独立于商品年份', () => {
  for (const value of [null, undefined, '', ' ', '未披露', '暂无', '未知', '未确认', '—']) assert.equal(hasChenpiDisplayValue(value), false)
  assert.equal(hasChenpiDisplayValue('年标性质未确认，不推算足年'), true)
  const listings = CHENPI_REFERENCE.villages.flatMap((village) => village.quotes)
  assert.equal(formatChenpiOffer(listings.find((quote) => quote.id === 'tianma-cha-story-10-years-50g')), '108元 / 50g')
  assert.equal(formatChenpiOffer(listings.find((quote) => quote.id === 'chakeng-zhimian-2023-erhong-250g')), '255元 / 250g')
  assert.equal(formatChenpiPriceTime({ priceUpdatedAt: '2026-09-27', collectedAt: '2026-09-28', productionDate: '2023-12' }), '报价更新日期：2026年9月27日 · 采集时间：2026-09-28')
})
