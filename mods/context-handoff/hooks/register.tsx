import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, SessionRateLimit } from 'claude-code'

import type { Handoff } from '../types'
import {
  HANDOFF_FILE,
  SUMMARY_PROMPT,
  commitMessage,
  formatStatus,
  handoffMarkdown,
  limitReason,
  resumePrompt,
  resumeQuestion,
  storeKey,
  wrapUpNote,
} from './logic'

const pending = atom({ plugin: 'context-handoff', key: 'pending' } as const, null)
const hasSavedThisSession = atom({ plugin: 'context-handoff', key: 'hasSavedThisSession' } as const, false)

const FALLBACK_PROMPTS = 3

async function git($: EngineInterface, args: string[], cwd: string): Promise<{ isOk: boolean; out: string }> {
  try {
    const ran = await $.process.run(['git', ...args], { cwd })
    return { isOk: ran.exitCode === 0, out: ran.stdout.trim() }
  } catch (error) {
    $.ui.log(`context-handoff: git ${args[0]} failed: ${String(error)}`)
    return { isOk: false, out: '' }
  }
}

async function repoRootOf($: EngineInterface): Promise<string> {
  const cwd = await $.session.cwd()
  const root = await git($, ['rev-parse', '--show-toplevel'], cwd)

  return root.isOk && root.out !== '' ? root.out : cwd
}

/** Asks the session itself what it was doing; falls back to the last prompts typed. */
async function summarize($: EngineInterface): Promise<string> {
  const reply = await $.model.fork({ prompt: SUMMARY_PROMPT })
  if (reply.isAnswered && reply.text.trim() !== '') {
    return reply.text.trim()
  }
  $.ui.log(`context-handoff: summary fork gave no text (${reply.isAnswered ? 'empty' : reply.reason}), using recent prompts`)
  const messages = await $.session.messages()
  const prompts = messages
    .filter(message => message.role === 'user' && message.text.trim() !== '')
    .slice(-FALLBACK_PROMPTS)
    .map(message => `- ${message.text.trim().slice(0, 500)}`)

  return ['## 直近の依頼 (自動要約に失敗したため原文)', ...prompts].join('\n')
}

/** Stages everything .gitignore allows and commits it; answers the short sha, or '' when nothing was committed. */
async function commitAll($: EngineInterface, repoRoot: string, reason: string): Promise<string> {
  const isRepo = (await git($, ['rev-parse', '--is-inside-work-tree'], repoRoot)).isOk
  if (!isRepo) {
    return ''
  }
  await git($, ['add', '-A'], repoRoot)
  const hasStaged = !(await git($, ['diff', '--cached', '--quiet'], repoRoot)).isOk
  if (!hasStaged) {
    return ''
  }
  const committed = await git($, ['commit', '-m', commitMessage(reason)], repoRoot)
  if (!committed.isOk) {
    $.ui.toast('context-handoff: チェックポイントのコミットに失敗しました (pre-commit hook 等)。変更はステージ済みです')
    return ''
  }

  return (await git($, ['rev-parse', '--short', 'HEAD'], repoRoot)).out
}

async function checkpoint($: EngineInterface, reason: string): Promise<Handoff> {
  await update($, hasSavedThisSession, () => true)
  $.ui.toast(`${reason}。作業を記録してコミットします…`)

  const repoRoot = await repoRootOf($)
  const branch = (await git($, ['rev-parse', '--abbrev-ref', 'HEAD'], repoRoot)).out || '(なし)'
  const createdAt = new Date(await $.clock.now()).toISOString()
  const summary = await summarize($)
  const draft: Handoff = { repoRoot, branch, commit: '', reason, summary, createdAt }

  await $.fs.write(`${repoRoot}/${HANDOFF_FILE}`, handoffMarkdown(draft))
  const handoff: Handoff = { ...draft, commit: await commitAll($, repoRoot, reason) }
  await $.store.set(storeKey(repoRoot), handoff)

  await $.session.append({ message: { type: 'user', content: [{ type: 'text', text: wrapUpNote(handoff) }] } })
  $.ui.toast(`引き継ぎを保存しました (${handoff.commit || 'コミットなし'})。次回起動時に続行を確認します`)

  return handoff
}

function showUsage($: EngineInterface, context: SessionContextUsage, rateLimits: readonly SessionRateLimit[]) {
  $.ui.status(formatStatus(context, rateLimits))
}

async function settle($: EngineInterface, handoff: Handoff) {
  await $.store.delete(storeKey(handoff.repoRoot))
  await update($, pending, () => null)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'handoff',
      description: '今の作業を記録・コミットし、次のセッションへ引き継ぐ',
    })
    const usage = await $.session.usage()
    showUsage($, usage.context, usage.rateLimits)

    // A hot reload fires session.start again: never offer this session's own handoff back to it.
    const isOwnHandoff = await read($, hasSavedThisSession)
    if (e.isInteractive && !isOwnHandoff) {
      const saved = (await $.store.get(storeKey(await repoRootOf($)))) as Handoff | undefined
      if (saved !== undefined) {
        await update($, pending, () => saved)
        $.ui.toast(resumeQuestion(saved))
      }
    }

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    showUsage($, e.context, e.rateLimits)
    const reason = limitReason(e.context, e.rateLimits)
    if (reason !== null && !(await read($, hasSavedThisSession))) {
      await checkpoint($, reason)
    }

    return next(e)
  })

  on('command.run', { command: 'handoff' }, async $ => {
    const handoff = await checkpoint($, '手動で引き継ぎを要求')

    return { text: `引き継ぎを ${handoff.repoRoot}/${HANDOFF_FILE} に保存しました (${handoff.commit || 'コミットなし'})。` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const handoff = await read($, pending)
    if (handoff === null) {
      return next(e)
    }
    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" borderStyle="round" paddingX={1}>
        <Text bold>{resumeQuestion(handoff)}</Text>
        <Text dimColor>
          {handoff.reason} · {handoff.branch} · {handoff.commit || 'コミットなし'} · {handoff.createdAt}
        </Text>
        <Box>
          <Button
            key="resume"
            label="続行する"
            hotkey="y"
            variant="primary"
            onPress={async () => {
              await settle($, handoff)
              await $.prompt.submit({ text: resumePrompt(handoff), asUser: true })
            }}
          />
          <Button key="discard" label="破棄する" hotkey="n" onPress={() => settle($, handoff)} />
        </Box>
      </Box>
    )
  })
}
