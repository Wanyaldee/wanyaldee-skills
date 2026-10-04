import { expect, test } from 'claude-code/testing'

import type { Handoff } from '../types'
import { formatStatus, limitReason, resumePrompt, resumeQuestion, storeKey } from './logic'

const HANDOFF: Handoff = {
  repoRoot: '/work/repo',
  branch: 'main',
  commit: 'abc1234',
  reason: 'レート制限 5h が 91% に到達',
  summary: '## 次の一手\n- テストを書く',
  createdAt: '2026-10-04T12:00:00.000Z',
}

test('status shows context fill and every rate-limit window', async () => {
  const text = formatStatus({ tokens: 84000, window: 200000, percent: 42 }, [
    { kind: 'five_hour', percentUsed: 63 },
    { kind: 'seven_day', percentUsed: 20.5 },
  ])

  expect(text).toBe('ctx 42% (84k/200k) · 5h 63% · 7d 20.5%')
})

test('status shows a placeholder before the first response', async () => {
  expect(formatStatus({ window: 200000 }, [])).toBe('ctx --/200k')
})

test('no handoff while every figure is under its threshold', async () => {
  expect(limitReason({ tokens: 1, window: 200000, percent: 89 }, [{ kind: 'five_hour', percentUsed: 89.9 }])).toBe(null)
})

test('a rate-limit window at 90% triggers a handoff', async () => {
  expect(limitReason({ window: 200000 }, [{ kind: 'five_hour', percentUsed: 90 }])).toBe('レート制限 5h が 90% に到達')
})

test('a context fill at 90% triggers a handoff', async () => {
  expect(limitReason({ tokens: 180000, window: 200000, percent: 90 }, [])).toBe('コンテキストが 90% に到達')
})

test('handoffs are keyed by repository, not by session', async () => {
  expect(storeKey('/work/repo')).toBe('handoff:/work/repo')
})

test('the resume question is the exact wording asked for', async () => {
  expect(resumeQuestion(HANDOFF)).toBe(
    'このリポジトリ (/work/repo) でこの作業をやっていましたがトークン切れで作業を一時中断しました、続行しますか',
  )
})

test('the resume prompt carries the branch, commit and summary', async () => {
  const prompt = resumePrompt(HANDOFF)

  expect(prompt).toContain('ブランチ main')
  expect(prompt).toContain('abc1234')
  expect(prompt).toContain('- テストを書く')
})
