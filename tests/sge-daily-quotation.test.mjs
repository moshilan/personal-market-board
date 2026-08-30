import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { findLatestValidSgeDailyQuotation, parsePositiveSgePrice, parseSgeDailyQuotationHtml } from '../src/sge-daily-quotation.mjs'

const fixture = await readFile(new URL('./fixtures/sge-daily-quotation.html', import.meta.url), 'utf8')

test('按表头定位收盘价并解析Au99.99、Ag(T+D)', () => {
  const rows = parseSgeDailyQuotationHtml(fixture)
  assert.equal(rows.length, 4)
  assert.equal(findLatestValidSgeDailyQuotation(fixture, 'Au99.99', { latestDate: '2026-08-28' }).value, 992.29)
  assert.equal(findLatestValidSgeDailyQuotation(fixture, 'Ag(T+D)', { latestDate: '2026-08-28' }).value, 16639)
})

test('拒绝无效收盘价并支持千分位', () => {
  assert.equal(parsePositiveSgePrice('1,234.50'), 1234.5)
  for (const value of ['-', '—', '0', '0.0', 'abc']) assert.throws(() => parsePositiveSgePrice(value), /正数/)
})

test('最近有效交易日跳过占位值', () => {
  const quote = findLatestValidSgeDailyQuotation(fixture, 'Au99.99', { latestDate: '2026-08-28' })
  assert.deepEqual({ tradeDate: quote.tradeDate, value: quote.value }, { tradeDate: '2026-08-27', value: 992.29 })
})
