import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Review, Sticky, Summary } from '../types'

const PANE = 'sticky-notes'
const TITLE = '付箋'

// State is session-scoped ($.state), so notes live as long as this session.
const commands = atom({ plugin: 'sticky-notes', key: 'commands' } as const, [] as Sticky[], { shape: 'sticky-1' })
const notes = atom({ plugin: 'sticky-notes', key: 'notes' } as const, [] as Sticky[], { shape: 'sticky-1' })
const summary = atom({ plugin: 'sticky-notes', key: 'summary' } as const, null as Summary | null, { shape: 'summary-1' })
const isSummarizing = atom({ plugin: 'sticky-notes', key: 'isSummarizing' } as const, false)

// Transcript cap sent to the summarizer: keeps one haiku call cheap on long sessions.
const MAX_CHARS = 40_000

const hhmm = (at: number) => {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

let seq = 0

function reviewLine(r: Review): { label: string; color?: string; dimColor?: true } {
  if (r.verdict === 'pending') return { label: '  ↳ 照合中…', dimColor: true }
  if (r.verdict === 'ok') return { label: `  ↳ ✓ 会話と一致 ${r.comment}`, dimColor: true }
  if (r.verdict === 'mismatch') return { label: `  ↳ ⚠ ここ違うかも: ${r.comment}`, color: 'red' }
  return { label: `  ↳ ? 判断できず: ${r.comment}`, color: 'yellow' }
}

type Which = 'commands' | 'notes'

// Per-repository persistence: $.state is the live copy the pane redraws from,
// $.store (kept across sessions) the durable one, keyed by the project root.
// ponytail: last write wins; two sessions open on one repo overwrite each other's
// additions. Merge by id on write if that starts to matter.
const storeKey = async ($: EngineInterface) => `repo:${await $.session.root()}`
type Saved = { commands: Sticky[]; notes: Sticky[] }

async function save($: EngineInterface) {
  const saved: Saved = { commands: await read($, commands), notes: await read($, notes) }
  await $.store.set(await storeKey($), saved)
}

async function load($: EngineInterface) {
  const saved = (await $.store.get(await storeKey($))) as Partial<Saved> | undefined
  if (!saved) return
  // A check that was in flight when the last session ended never finishes.
  const settle = (list: Sticky[] = []) =>
    list.map(n => (n.review?.verdict === 'pending' ? { ...n, review: undefined } : n))
  await update($, commands, () => settle(saved.commands))
  await update($, notes, () => settle(saved.notes))
}

// The state scan needs each atom named literally, so the list is picked by name.
async function edit($: EngineInterface, which: Which, fn: (list: Sticky[]) => Sticky[]) {
  if (which === 'commands') await update($, commands, fn)
  else await update($, notes, fn)
  await save($)
}

async function add($: EngineInterface, which: Which, text: string) {
  const body = text.trim()
  if (!body) return
  const at = await $.clock.now()
  const id = `${at}-${seq++}`
  await edit($, which, list => [...list, { id, text: body, at }])
  if (which === 'notes') void review($, id)
}

async function transcriptOf($: EngineInterface) {
  const messages = await $.session.messages()
  return messages
    .filter(m => m.text)
    .map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.text}`)
    .join('\n\n')
    .slice(-MAX_CHARS)
}

// Repository docs the check reads, in priority order: instruction files, then
// ADRs newest first (decisions most likely to still hold), then the README.
// The budget keeps one haiku call bounded; what does not fit is left out.
const REPO_CHARS = 80_000

async function readIf($: EngineInterface, path: string) {
  return (await $.fs.exists(path)) ? String(await $.fs.read(path)) : undefined
}

async function repoDocs($: EngineInterface) {
  const root = await $.session.root()
  const adrDir = (await $.fs.exists(`${root}/docs/adr/en`)) ? 'docs/adr/en' : 'docs/adr'
  const adrs = (await $.fs.exists(`${root}/${adrDir}`))
    ? (await $.fs.list(`${root}/${adrDir}`))
        .filter(f => f.kind === 'file' && f.name.endsWith('.md'))
        .map(f => `${adrDir}/${f.name}`)
        .sort()
        .reverse()
    : []
  let out = ''
  for (const rel of ['CLAUDE.md', 'AGENTS.md', ...adrs, 'README.md']) {
    const text = await readIf($, `${root}/${rel}`).catch(() => undefined)
    if (!text) continue
    const block = `<file path="${rel}">\n${text}\n</file>\n`
    if (out.length + block.length > REPO_CHARS) continue
    out += block
  }
  return out
}

const REVIEW_SYSTEM = `You check a user's stated understanding against two sources: the repository's documents and the current conversation with a coding assistant.
Reply with one JSON object only: {"verdict":"ok"|"mismatch"|"unclear","comment":"..."}.
- ok: the note agrees with the sources.
- mismatch: the note contradicts or misreads a source; the comment says what that source actually says and names it (「会話」 or the file path, e.g. docs/adr/en/0019-x.md).
- unclear: neither source settles it.
If the conversation and the repository disagree with each other, say so in the comment.
The comment is Japanese, at most two sentences.`

const VERDICTS = ['ok', 'mismatch', 'unclear'] as const

// The model's reply is untrusted text: anything that is not the JSON asked for
// is kept as an 'unclear' comment instead of being dropped.
function parseReview(text: string): Review {
  const found = text.match(/\{[\s\S]*\}/)
  try {
    const v = JSON.parse(found?.[0] ?? '') as { verdict?: unknown; comment?: unknown }
    const verdict = VERDICTS.find(x => x === v.verdict)
    if (verdict) return { verdict, comment: String(v.comment ?? '') }
  } catch {}
  return { verdict: 'unclear', comment: text.trim().slice(0, 200) }
}

async function review($: EngineInterface, id: string) {
  const setReview = (r: Review) =>
    edit($, 'notes', list => list.map(n => (n.id === id ? { ...n, review: r } : n)))
  const note = (await read($, notes)).find(n => n.id === id)
  if (!note) return
  await setReview({ verdict: 'pending', comment: '' })
  const transcript = await transcriptOf($)
  const docs = await repoDocs($)
  if (!transcript && !docs) return setReview({ verdict: 'unclear', comment: '照合できる会話もリポジトリ文書もありません' })
  const r = await $.model.complete({
    model: 'haiku',
    effort: 'low',
    maxTokens: 400,
    timeoutMs: 90_000,
    system: REVIEW_SYSTEM,
    // Repo docs first and cache-marked: they rarely change between checks.
    prompt: [
      { text: `<repository>\n${docs}</repository>`, cache: true },
      { text: `<conversation>\n${transcript}\n</conversation>\n\n<user_understanding>\n${note.text}\n</user_understanding>` },
    ],
  })
  await setReview(r.isAnswered ? parseReview(r.text) : { verdict: 'unclear', comment: `照合に失敗: ${r.reason}` })
}

async function summarize($: EngineInterface) {
  if (await read($, isSummarizing)) return
  await update($, isSummarizing, () => true)
  try {
    const transcript = await transcriptOf($)
    const at = await $.clock.now()
    if (!transcript) {
      await update($, summary, () => ({ text: '(まだ会話がありません)', at }))
      return
    }
    const r = await $.model.complete({
      model: 'haiku',
      effort: 'low',
      maxTokens: 800,
      timeoutMs: 60_000,
      system:
        'You summarize a coding-assistant conversation for a sticky note. Reply in Japanese, as at most 8 short bullet points: goal, decisions made, current state, open questions. No preamble.',
      prompt: transcript,
    })
    await update($, summary, () => ({
      text: r.isAnswered ? r.text : `(要約に失敗: ${r.reason})`,
      at,
    }))
  } finally {
    await update($, isSummarizing, () => false)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sticky', description: '付箋ペインを開く' })
    await $.command.register({ name: 'sticky-cmd', description: '付箋: 次に打つコマンドを追加' })
    await $.command.register({ name: 'sticky-note', description: '付箋: 自分の認識を書き込む' })
    await $.command.register({ name: 'sticky-summary', description: '付箋: 会話の概要を更新' })
    await load($)
    return next(e)
  })

  on('command.run', { command: 'sticky' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: '付箋ペインを開きました。' }
  })
  on('command.run', { command: 'sticky-cmd' }, async ($, e) => {
    await add($, 'commands', e.args)
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: e.args.trim() ? 'コマンドを付箋に追加しました。' : '使い方: /sticky-cmd <コマンド>' }
  })
  on('command.run', { command: 'sticky-note' }, async ($, e) => {
    await add($, 'notes', e.args)
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: e.args.trim() ? '認識を付箋に書き込みました。' : '使い方: /sticky-note <メモ>' }
  })
  on('command.run', { command: 'sticky-summary' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    await summarize($)
    return { text: '会話の概要を更新しました。' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Input } = $.ui.resolve(e)
    const cmds = await read($, commands)
    const ns = await read($, notes)
    const sum = await read($, summary)
    const busy = await read($, isSummarizing)
    const remove = (which: Which, id: string) => () =>
      void edit($, which, list => list.filter(x => x.id !== id))

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold color="yellow">▍次に打つコマンド</Text>
          {cmds.length === 0 && <Text dimColor>(なし)</Text>}
          {cmds.map(c => (
            <Box flexDirection="row" gap={1}>
              <Text>$ {c.text}</Text>
              <Button onPress={p => void $.ui.copy({ text: c.text, surface: p.surface })}>copy</Button>
              <Button role="dismiss" onPress={remove('commands', c.id)}>×</Button>
            </Box>
          ))}
          <Input key="cmd" placeholder="コマンドを追加…" submitLabel="add" onSubmit={v => void add($, 'commands', v)} />
        </Box>

        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Text bold color="cyan">▍この会話の概要</Text>
            <Button key="summarize" onPress={() => void summarize($)}>{busy ? '要約中…' : '更新'}</Button>
          </Box>
          {sum ? (
            <>
              <Text>{sum.text}</Text>
              <Text dimColor>({hhmm(sum.at)} 時点)</Text>
            </>
          ) : (
            <Text dimColor>(「更新」で要約を作成)</Text>
          )}
        </Box>

        <Box flexDirection="column">
          <Text bold color="green">▍自分の認識</Text>
          {ns.length === 0 && <Text dimColor>(まだ書き込みなし)</Text>}
          {ns.map(n => (
            <Box flexDirection="column">
              <Box flexDirection="row" gap={1}>
                <Text dimColor>{hhmm(n.at)}</Text>
                <Text>{n.text}</Text>
                <Button key={`recheck-${n.id}`} onPress={() => void review($, n.id)}>照合</Button>
                <Button role="dismiss" onPress={remove('notes', n.id)}>×</Button>
              </Box>
              {n.review && (() => {
                const l = reviewLine(n.review)
                return <Text color={l.color} dimColor={l.dimColor}>{l.label}</Text>
              })()}
            </Box>
          ))}
          <Input key="note" rows={2} placeholder="今の理解・気づきを書く…" submitLabel="post" onSubmit={v => void add($, 'notes', v)} />
        </Box>
      </Box>
    )
  })
}
