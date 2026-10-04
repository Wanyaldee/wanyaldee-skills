import type { SessionContextUsage, SessionRateLimit } from 'claude-code'

import type { Handoff } from '../types'

export const CONTEXT_THRESHOLD = 90
export const RATE_LIMIT_THRESHOLD = 90
export const HANDOFF_FILE = '.claude/handoff.md'

const LIMIT_LABELS: Record<string, string> = {
  five_hour: '5h',
  seven_day: '7d',
  spend_limit: 'spend',
}

export const SUMMARY_PROMPT = [
  'トークン制限が近いため、この作業を次のエージェントに引き継ぎます。',
  '次のエージェントが会話履歴なしで作業を再開できるよう、日本語のMarkdownで以下を簡潔にまとめてください。',
  '見出しは「## 目的」「## 完了したこと」「## 残っていること」「## 次の一手」「## 関連ファイル」の5つ。',
  '推測は推測と明記し、まとめ以外の前置きは書かないでください。',
].join('\n')

const formatTokens = (n: number): string => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

export const limitLabel = (kind: string): string => LIMIT_LABELS[kind] ?? kind

export function formatStatus(context: SessionContextUsage, rateLimits: readonly SessionRateLimit[]): string {
  const ctx =
    context.percent === undefined || context.tokens === undefined
      ? `ctx --/${formatTokens(context.window)}`
      : `ctx ${context.percent}% (${formatTokens(context.tokens)}/${formatTokens(context.window)})`
  const limits = rateLimits.map(limit => `${limitLabel(limit.kind)} ${limit.percentUsed}%`)

  return [ctx, ...limits].join(' · ')
}

/** Why a handoff is due, or null while every figure is under its threshold. */
export function limitReason(context: SessionContextUsage, rateLimits: readonly SessionRateLimit[]): string | null {
  const hot = rateLimits.find(limit => limit.percentUsed >= RATE_LIMIT_THRESHOLD)
  if (hot !== undefined) {
    return `レート制限 ${limitLabel(hot.kind)} が ${hot.percentUsed}% に到達`
  }
  if (context.percent !== undefined && context.percent >= CONTEXT_THRESHOLD) {
    return `コンテキストが ${context.percent}% に到達`
  }

  return null
}

export const storeKey = (repoRoot: string): string => `handoff:${repoRoot}`

export const commitMessage = (reason: string): string =>
  `chore: handoff checkpoint before token limit\n\n${reason}. Work in progress, see ${HANDOFF_FILE}.`

export function handoffMarkdown(handoff: Handoff): string {
  return [
    '# 作業引き継ぎ (context-handoff)',
    '',
    `- リポジトリ: ${handoff.repoRoot}`,
    `- ブランチ: ${handoff.branch}`,
    `- 理由: ${handoff.reason}`,
    `- 記録日時: ${handoff.createdAt}`,
    '',
    handoff.summary,
    '',
  ].join('\n')
}

export const resumeQuestion = (handoff: Handoff): string =>
  `このリポジトリ (${handoff.repoRoot}) でこの作業をやっていましたがトークン切れで作業を一時中断しました、続行しますか`

export function resumePrompt(handoff: Handoff): string {
  const commitLine =
    handoff.commit === '' ? 'チェックポイントのコミットはありません。' : `チェックポイントのコミット: ${handoff.commit}`

  return [
    '前のセッションがトークン制限で中断した作業の続きをお願いします。',
    `ブランチ ${handoff.branch}。${commitLine}`,
    `引き継ぎメモ (${HANDOFF_FILE} と同じ内容):`,
    '',
    handoff.summary,
    '',
    `まず git log と git status で状態を確認してから「次の一手」から再開してください。作業が終わったら ${HANDOFF_FILE} を削除してください。`,
  ].join('\n')
}

export const wrapUpNote = (handoff: Handoff): string =>
  [
    `[context-handoff] ${handoff.reason}。作業内容を ${HANDOFF_FILE} に記録し、チェックポイントをコミットしました (${handoff.commit || 'コミットなし'})。`,
    '新しい大きな作業は始めず、今のステップを区切りのよいところで終え、ユーザーに中断を報告してください。',
  ].join('\n')
