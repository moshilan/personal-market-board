import test from 'node:test'
import assert from 'node:assert/strict'
import {
  findCurrentGuangdongFuelAnnouncement,
  GUANGDONG_FUEL_INDEX_URL,
  parseGuangdongFuelAnnouncement,
  parseGuangdongFuelCandidates,
} from '../src/guangdong-fuel.mjs'

// Synthetic parser fixtures only; never used by the collector or published market data.
function listing(...dates) {
  return `<html>${dates.map((date) => `<a href="/spjg/content/post_${date.replaceAll('-', '')}.html">${date.slice(0, 4)}年${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日24时起成品油价格调整</a>`).join('')}</html>`
}

function announcement(date, prices) {
  const [year, month, day] = date.split('-').map(Number)
  const rows = [
    ['92号汽油（Ⅵ）', '10998', '10698', prices[0]],
    ['95号汽油（Ⅵ）', '11620', '11320', prices[1]],
    ['0号柴油（Ⅵ）', '9305', '9005', prices[2]],
  ].map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')
  return `<article><p>自${year}年${month}月${day}日24时起执行</p><table><tr><th>品名</th><th>最高批发价格（元/吨）</th><th>最高零售价格（元/吨）</th><th>最高零售价格（元/升）</th></tr>${rows}</table></article>`
}

test('广东公告列表只接受官方商品价格调价公告并按生效日期排序', () => {
  const html = `${listing('2026-09-24', '2026-09-11', '2026-08-28')}<a href="https://example.com/spjg/content/post_9.html">2026年9月25日24时起成品油价格调整</a><a href="/spjg/content/post_8.html">2026年9月24日成品油价格不作调整</a>`
  const candidates = parseGuangdongFuelCandidates(html)
  assert.deepEqual(candidates.map(({ effectiveFrom }) => effectiveFrom), [
    '2026-09-24T16:00:00.000Z',
    '2026-09-11T16:00:00.000Z',
    '2026-08-28T16:00:00.000Z',
  ])
  assert.ok(candidates.every(({ url }) => url.startsWith('https://drc.gd.gov.cn/spjg/content/post_')))
})

test('解析公告正文的日期及92、95、0号柴油元/升价格', () => {
  const parsed = parseGuangdongFuelAnnouncement(announcement('2026-09-11', ['8.31', '9.00', '7.98']), {
    title: '2026年9月11日24时起成品油价格调整',
    url: 'https://drc.gd.gov.cn/spjg/content/post_4954696.html',
  })
  assert.equal(parsed.effectiveFrom, '2026-09-11T16:00:00.000Z')
  assert.deepEqual(parsed.prices, { '92号汽油': 8.31, '95号汽油': 9, '0号柴油': 7.98 })
})

test('9月11日24时后选择9月11日公告及对应直接升价', async () => {
  const chosen = await findCurrentGuangdongFuelAnnouncement(new Date('2026-09-11T16:00:00.001Z'), async (url) => {
    if (url === GUANGDONG_FUEL_INDEX_URL) return listing('2026-09-11', '2026-08-28')
    return announcement('2026-09-11', ['8.31', '9.00', '7.98'])
  })
  assert.match(chosen.sourceUrl, /post_20260911\.html$/)
  assert.deepEqual(chosen.prices, { '92号汽油': 8.31, '95号汽油': 9, '0号柴油': 7.98 })
})

test('9月24日公告提前发布时，生效前仍选9月11日；生效后切换9月24日', async () => {
  const getText = async (url) => {
    if (url === GUANGDONG_FUEL_INDEX_URL) return listing('2026-09-24', '2026-09-11')
    if (url.endsWith('20260924.html')) return announcement('2026-09-24', ['8.55', '9.20', '8.12'])
    return announcement('2026-09-11', ['8.31', '9.00', '7.98'])
  }

  const before = await findCurrentGuangdongFuelAnnouncement(new Date('2026-09-24T15:59:59.999Z'), getText)
  assert.match(before.sourceUrl, /post_20260911\.html$/)
  assert.deepEqual(before.prices, { '92号汽油': 8.31, '95号汽油': 9, '0号柴油': 7.98 })

  const atEffectiveTime = await findCurrentGuangdongFuelAnnouncement(new Date('2026-09-24T16:00:00.000Z'), getText)
  assert.match(atEffectiveTime.sourceUrl, /post_20260924\.html$/)
  assert.deepEqual(atEffectiveTime.prices, { '92号汽油': 8.55, '95号汽油': 9.2, '0号柴油': 8.12 })
})

test('公告标题/正文日期不符或价格表缺项时拒绝标为当前值', () => {
  assert.throws(() => parseGuangdongFuelAnnouncement(announcement('2026-08-28', ['8.31', '9.00', '7.98']), {
    title: '2026年9月11日24时起成品油价格调整',
    url: 'https://drc.gd.gov.cn/spjg/content/post_1.html',
  }), /日期与正文生效日期不一致/)
  assert.throws(() => parseGuangdongFuelAnnouncement('<p>自2026年9月11日24时起执行</p><table>元/升<tr><td>92号汽油</td><td>8.31</td></tr></table>', {
    title: '2026年9月11日24时起成品油价格调整',
    url: 'https://drc.gd.gov.cn/spjg/content/post_1.html',
  }), /未找到95号汽油/)
})

test('最新已生效公告读取失败时不回退伪装为较旧官方当前值', async () => {
  const requested = []
  await assert.rejects(() => findCurrentGuangdongFuelAnnouncement(new Date('2026-09-25T00:00:00.000Z'), async (url) => {
    requested.push(url)
    if (url === GUANGDONG_FUEL_INDEX_URL) return listing('2026-09-24', '2026-09-11')
    throw new Error('模拟最新公告请求失败')
  }), /模拟最新公告请求失败/)
  assert.equal(requested.length, 2, '失败时只读取列表和最新已生效公告，不请求更旧公告')
})
