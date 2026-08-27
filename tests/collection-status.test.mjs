import assert from 'node:assert/strict'
import test from 'node:test'
import { collectionStatusForChina } from '../public/collection-status.mjs'

const today = new Date('2026-08-28T12:00:00.000Z')

test('当天最近成功采集显示中国时区时间', () => {
  assert.deepEqual(collectionStatusForChina({ latestSuccessfulAt: '2026-08-28T01:26:00.000Z' }, today), {
    kind: 'updated', label: '今日已更新 · 09:26',
  })
})

test('当天没有成功采集且最近一次采集失败时显示异常', () => {
  assert.deepEqual(collectionStatusForChina({
    latestAttemptAt: '2026-08-28T01:26:00.000Z',
    latestAttemptSucceeded: false,
  }, today), { kind: 'error', label: '数据异常' })
})

test('无当天成功采集且没有当天全失败尝试时显示待更新', () => {
  assert.deepEqual(collectionStatusForChina({
    latestSuccessfulAt: '2026-08-27T01:26:00.000Z',
    latestAttemptAt: '2026-08-27T01:26:00.000Z',
    latestAttemptSucceeded: true,
  }, today), { kind: 'pending', label: '今日待更新' })
})

test('跨中国自然日不会沿用昨天的成功状态', () => {
  assert.deepEqual(collectionStatusForChina({ latestSuccessfulAt: '2026-08-27T15:59:00.000Z' }, new Date('2026-08-27T16:01:00.000Z')), {
    kind: 'pending', label: '今日待更新',
  })
})
