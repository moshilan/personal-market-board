import { windowTime } from '../public/fuel-reminder.js'

export const FUEL_RULE_URL = 'https://www.ndrc.gov.cn/xwdt/xwfb/202203/t20220317_1319446_ext.html'
export const FUEL_CALENDAR_URL = 'https://cx.sinopecsales.com/yjkqiantai/core/toCalendar'
export const FUEL_MEDIA_URL = 'https://energy.cngold.org/oilpro.html'

// Manually verified against Sinopec's October–December 2026 calendar images.
// Only these holiday-free intervals are verified; never extrapolate across years.
export const VERIFIED_FUEL_WINDOWS = ['2026-10-29', '2026-11-12', '2026-11-26', '2026-12-10', '2026-12-24'].map((date) => ({
  date, sourceName: '中国石化调价日历', sourceUrl: FUEL_CALENDAR_URL,
  imageUrl: `https://cx.sinopecsales.com/yjkqiantai/oilImages/${date.slice(0, 7).replace('-', '')}.png`,
  verifiedAt: '2026-10-30', ruleChecked: true,
}))

function text(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim()
}

export function parseFuelPrediction(html, sourceUrl, collectedAt) {
  const article = html.match(/<div[^>]*class=["'][^"']*article-info[^"']*["'][^>]*>([\s\S]*?)(?=<div[^>]*class=["'][^"']*article_con)/i)?.[1]
  const time = article?.match(/<span[^>]*>\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s*<\/span>/i)
  const title = text(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '')
  const body = html.match(/<div[^>]*class=["'][^"']*article_con[^"']*["'][^>]*>([\s\S]*)/i)?.[1] ?? ''
  const content = text(body.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '')
  const target = content.match(/(?:新一轮成品油调价窗口|下一轮[^。]{0,15}调价窗口)[^。]{0,25}?(\d{1,2})月(\d{1,2})日24时/)
  const direction = title.match(/油价预计(上调|下调|不调整)/)?.[1]
  if (!time || !target || !direction || !/^https:\/\/energy\.cngold\.org\/c\/\d{4}-\d{2}-\d{2}\/c\d+\.html$/.test(sourceUrl)) return null
  const publishedAt = `${time[1]}T${time[2]}+08:00`
  const windowDate = `${time[1].slice(0, 4)}-${target[1].padStart(2, '0')}-${target[2].padStart(2, '0')}`
  const timestamp = Date.parse(collectedAt)
  if (!Number.isFinite(Date.parse(publishedAt)) || Date.parse(publishedAt) > timestamp || timestamp - Date.parse(publishedAt) >= 86_400_000 || !(windowTime(windowDate) > timestamp)) return null
  return { windowDate, direction: { 上调: 'up', 下调: 'down', 不调整: 'unchanged' }[direction], publishedAt, collectedAt, sourceUrl, sourceName: '金投原油网（综合资讯）', title }
}

export async function collectFuelReminder(collectedAt, getText, officialOutcome = null) {
  const result = { windows: VERIFIED_FUEL_WINDOWS, collectedAt: collectedAt.toISOString(), ruleUrl: FUEL_RULE_URL, officialOutcome, prediction: null }
  try {
    const html = await getText(FUEL_MEDIA_URL)
    const candidates = [...html.matchAll(/<a\b[^>]*href=["'](https:\/\/energy\.cngold\.org\/c\/\d{4}-\d{2}-\d{2}\/c\d+\.html)["'][^>]*>([\s\S]*?)<\/a>/gi)]
      .filter((match) => /油价调整最新消息.*今日.*油价预计/.test(text(match[2])))
      .sort((a, b) => b[1].localeCompare(a[1]))
    if (candidates.length) result.prediction = parseFuelPrediction(await getText(candidates[0][1]), candidates[0][1], result.collectedAt)
    if (!result.prediction) result.predictionReason = '暂无注明发布时间且未过期的可靠预测'
  } catch {
    result.predictionReason = '媒体预测来源暂不可用'
  }
  return result
}
