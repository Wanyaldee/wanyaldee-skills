import { expect, test } from 'claude-code/testing'
import type { TestBody } from 'claude-code/testing'

const RUN = {
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 120 },
} as const

const PANE = {
  plugin: 'wanyaldee-skills',
  component: 'Pane',
  requestId: 'sticky-notes',
  props: {
    title: '付箋',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const USAGE = { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

type On = Parameters<TestBody>[1]

// Stands in for the engine: a repo at /repo with one ADR, and a store map.
function engine(on: On, files: Record<string, string> = {}, store: Record<string, unknown> = {}) {
  on('clock.now', () => ({ value: 0 }))
  // context-handoff's start runs in the same session.start hook: give it a quiet usage.
  on('session.usage', () => ({ value: { startedAt: 0, context: { window: 200_000 }, rateLimits: [] } }))
  on('session.cwd', () => ({ value: '/repo' }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: '/repo\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  on('session.root', () => ({ value: '/repo' }))
  on('store.get', (_, e) => ({ value: store[e.key] }))
  on('store.set', (_, e) => ((store[e.key] = e.value), { value: undefined }))
  on('fs.exists', (_, e) => ({
    value: e.path in files || Object.keys(files).some(f => f.startsWith(`${e.path}/`)),
  }))
  on('fs.read', (_, e) => ({ value: files[e.path] ?? '' }))
  on('fs.list', (_, e) => ({
    value: Object.keys(files)
      .filter(f => f.startsWith(`${e.path}/`))
      .map(f => ({ name: f.slice(e.path!.length + 1), kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })),
  }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  return store
}

// The note check runs detached from the command: yield until it is done.
const settle = async (isDone: () => boolean = () => false) => {
  for (let j = 0; j < 5000 && !isDone(); j++) await Promise.resolve()
}

test('commands and notes added by slash command show in the pane and are saved per repo', async ($, on) => {
  const store = engine(on)
  on('session.messages', () => ({ value: [] }))

  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'sticky-cmd', args: 'git push origin main', ...RUN })
  await $.command.run({ command: 'sticky-note', args: 'DBは触らない方針', ...RUN })
  await settle()

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /git push/ }))?.text).toBe('$ git push origin main')
    expect((await ui.find({ type: 'Text', text: /DBは/ }))?.text).toBe('DBは触らない方針')
    await ui.unmount()
  }
  const saved = store['sticky-notes:/repo'] as { commands: { text: string }[] }
  expect(saved.commands.map(c => c.text)).toEqual(['git push origin main'])
})

test('a new session in the same repo loads the saved notes', async ($, on) => {
  engine(on, {}, {
    'sticky-notes:/repo': {
      commands: [{ id: 'a', text: 'npm test', at: 0 }],
      notes: [{ id: 'b', text: '前回の認識', at: 0, review: { verdict: 'pending', comment: '' } }],
    },
  })

  await $.session.start({ cwd: '/repo', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /npm test/ }))?.text).toBe('$ npm test')
  expect((await ui.find({ type: 'Text', text: /前回/ }))?.text).toBe('前回の認識')
  // A check cut off by the old session's end is dropped, not left spinning.
  expect(await ui.find({ type: 'Text', text: /照合中/ })).toBeUndefined()
  await ui.unmount()
})

test('the summary button calls the model with the transcript', async ($, on) => {
  engine(on)
  let sent = ''
  on('session.messages', () => ({
    value: [
      { role: 'user', text: '付箋Modを作りたい', toolUses: [] },
      { role: 'assistant', text: '作ります', toolUses: [] },
    ],
  }))
  on('model.complete', (_, e) => {
    sent = String(e.prompt)
    return { value: { isAnswered: true, text: '- 付箋Modを作成中', usage: USAGE } }
  })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'summarize' })
  expect(sent).toContain('USER: 付箋Modを作りたい')
  expect((await ui.find({ type: 'Text', text: /作成中/ }))?.text).toBe('- 付箋Modを作成中')
  await ui.unmount()
})

test('a note is checked against the repo docs and the conversation', async ($, on) => {
  engine(on, {
    '/repo/AGENTS.md': 'Report to the user in Japanese.',
    '/repo/docs/adr/0001-store.md': 'Notes are kept per repository.',
  })
  on('session.messages', () => ({
    value: [{ role: 'assistant', text: '概要はボタンで手動更新します', toolUses: [] }],
  }))
  let prompt = ''
  let isChecked = false
  on('model.complete', (_, e) => {
    prompt = String(e.prompt)
    isChecked = true
    return {
      value: {
        isAnswered: true,
        text: '{"verdict":"mismatch","comment":"docs/adr/0001-store.md ではリポジトリ単位で保持です"}',
        usage: USAGE,
      },
    }
  })

  await $.command.run({ command: 'sticky-note', args: '付箋はセッション内のみ保持', ...RUN })
  await settle(() => isChecked)
  await settle()
  expect(prompt).toContain('<file path="AGENTS.md">')
  expect(prompt).toContain('Notes are kept per repository.')
  expect(prompt).toContain('概要はボタンで手動更新します')

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /↳/ }))?.text).toBe(
    '  ↳ ⚠ ここ違うかも: docs/adr/0001-store.md ではリポジトリ単位で保持です',
  )
  await ui.unmount()
})
