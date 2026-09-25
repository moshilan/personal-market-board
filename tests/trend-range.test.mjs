import assert from 'node:assert/strict'
import test from 'node:test'
import { selectTrendDates } from '../public/trend-range.js'

const dates = [
  '2026-09-01', '2026-09-02', '2026-09-05', '2026-09-08', '2026-09-12',
  '2026-09-15', '2026-09-18', '2026-09-21', '2026-09-25',
]
const history = dates.flatMap((date) => [
  { assetId: 'international-gold-cny-gram', date },
  { assetId: 'au9999', date },
  { assetId: 'brand-gold-chow-sang-sang', date },
])

test('一周趋势选择最近7个有效日期，跨越7个自然日时仍保留7个趋势日', () => {
  const selected = selectTrendDates(history, ['international-gold-cny-gram', 'au9999'], 'week', '2026-09-19')
  assert.deepEqual([...selected], ['2026-09-05', '2026-09-08', '2026-09-12', '2026-09-15', '2026-09-18', '2026-09-21', '2026-09-25'])
})

test('品牌黄金使用品牌有效日期，其他周期仍按自然日期筛选', () => {
  const brandDates = selectTrendDates(history, ['brand-gold-chow-sang-sang'], 'week', '2026-09-19')
  const monthDates = selectTrendDates(history, ['brand-gold-chow-sang-sang'], 'month', '2026-09-01')
  assert.equal(brandDates.size, 7)
  assert.deepEqual([...monthDates], dates)
})
