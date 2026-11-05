# 0022: sticky-notes mod (side pane of next commands, summary, and checked understanding)

(日本語: [0022-sticky-notes-mod.ja.md](../ja/0022-sticky-notes-mod.ja.md))

## Context

The user asked (2026-11-05) for a mod that keeps, beside the chat in the same
session, a sticky-note / thread-like pane with three things: commands to run
next, a summary of the conversation, and the user's own written
understanding. In follow-ups the same day they added: (a) point out where the
written understanding is wrong ("ここ違うんじゃない"), and (b) make it work
at repository level — chosen from a three-way question as "check the note
against the repository's docs too" and "save the notes per repository"
(not "share them through a committed file").

Before this, the only way to keep such notes was the conversation itself,
where they scroll away, or an ad hoc file in the repo.

## Decision

Added `mods/sticky-notes/`, a function-hooks plugin listed as a third plugin
in `.claude-plugin/marketplace.json`
(`/plugin install sticky-notes@wanyaldee-skills`), built the same way as
`mods/context-handoff` (ADR 0018).

- `/sticky` opens a pane (`$.ui.open` + `ui.render` on `Pane`) with three
  sections: next commands (add / copy / delete), conversation summary
  (button or `/sticky-summary`; one haiku call), own understanding (add /
  delete / re-check; `/sticky-note`).
- Each note added is checked in the background by one haiku call against the
  conversation and the repo's `CLAUDE.md`, `AGENTS.md`, ADRs (newest first)
  and `README.md`, capped at 80,000 characters. The verdict is drawn under the
  note as a reply: `✓` / `⚠ ここ違うかも: …` / `? 判断できず: …`.
- Commands and notes are written through to `$.store` under
  `repo:<project root>` on every change and loaded on `session.start`. The
  summary stays session-only (`$.state`).

## Reason

Persistence: `$.state` is what the pane redraws from, `$.store` what
survives the session.

```ts
const storeKey = async ($: EngineInterface) => `repo:${await $.session.root()}`

async function load($: EngineInterface) {
  const saved = (await $.store.get(await storeKey($))) as Partial<Saved> | undefined
  if (!saved) return
  const settle = (list: Sticky[] = []) =>
    list.map(n => (n.review?.verdict === 'pending' ? { ...n, review: undefined } : n))
  await update($, commands, () => settle(saved.commands))
  await update($, notes, () => settle(saved.notes))
}

async function edit($: EngineInterface, which: Which, fn: (list: Sticky[]) => Sticky[]) {
  if (which === 'commands') await update($, commands, fn)
  else await update($, notes, fn)
  await save($)
}
```

- Keyed by `$.session.root()`, not by session id or `cwd`: the user asked
  for "repository level", and a shell `cd` inside the session does not move
  the root, so the key does not drift mid-session. Same choice as ADR 0018's
  handoff record.
- Two stores, not `$.store` alone: a `$.state` read inside `ui.render`
  subscribes the pane, so a write redraws it; `$.store` has no such
  subscription.
- Write-through in `edit`, not on `session.end`: a crash or a closed
  terminal never runs `session.end`, and the lists are a few KB, so saving
  every change costs nothing measurable.
- `settle` drops a `pending` verdict on load: the haiku call that would have
  resolved it died with the old session, and without this the note would
  show `照合中…` forever.
- `which: 'commands' | 'notes'` instead of passing the atom: the engine's
  load-time state scan refuses `update($, to, …)` where `to` is a parameter
  (`claude plugin validate` reported it); each atom has to be named literally.
- `if (!saved) return` keeps whatever `$.state` holds: on the first load
  after upgrading from the session-only version, the store is empty and the
  notes already written in that session must not be wiped.

The check: which documents, in which order, within which budget.

```ts
const REPO_CHARS = 80_000

for (const rel of ['CLAUDE.md', 'AGENTS.md', ...adrs, 'README.md']) {
  const text = await readIf($, `${root}/${rel}`).catch(() => undefined)
  if (!text) continue
  const block = `<file path="${rel}">\n${text}\n</file>\n`
  if (out.length + block.length > REPO_CHARS) continue
  out += block
}
```

- Order is instruction files → ADRs newest first (`.sort().reverse()` on
  zero-padded `NNNN-` names) → README: instruction files state the rules a
  note is most likely to be about; a newer ADR supersedes an older one; the
  README mostly restates both.
- `docs/adr/en` when it exists, else `docs/adr`: this repo keeps en/ja pairs,
  and reading both would spend half the budget on duplicates.
- `continue`, not `break`, past a block that does not fit: one long ADR
  should not shut out a short README after it.
- 80,000 characters: this repo's `AGENTS.md` (31.7k) plus `README.md`
  (17.2k) plus the newest ADRs fill it; with the 40,000-character transcript
  cap that is ~120k characters, inside haiku's context with room for the
  reply. Older ADRs in this repo (en total 112.7k) do not fit and are left out.

```ts
prompt: [
  { text: `<repository>\n${docs}</repository>`, cache: true },
  { text: `<conversation>\n${transcript}\n</conversation>\n\n<user_understanding>\n${note.text}\n</user_understanding>` },
],
```

- Repo block first and cache-marked: it is identical across checks made
  within the cache window, so writing several notes in a row pays for it once.
  The conversation changes every turn, so it goes after the cache mark.
- `if (which === 'notes') void review($, id)` in `add`: not awaited, so
  `/sticky-note` and the input box return at once instead of after a
  model call that may take tens of seconds.

```ts
function parseReview(text: string): Review {
  const found = text.match(/\{[\s\S]*\}/)
  try {
    const v = JSON.parse(found?.[0] ?? '') as { verdict?: unknown; comment?: unknown }
    const verdict = VERDICTS.find(x => x === v.verdict)
    if (verdict) return { verdict, comment: String(v.comment ?? '') }
  } catch {}
  return { verdict: 'unclear', comment: text.trim().slice(0, 200) }
}
```

- The reply is treated as untrusted text: a verdict outside the three known
  values, or prose around the JSON, falls back to `unclear` with the raw
  reply shown, so a malformed answer is visible rather than silently
  dropped or shown as `✓`.

Summary is manual (button / `/sticky-summary`), not on every
`turn.complete`: one haiku call over up to 40,000 characters per turn would
cost on every turn whether or not the pane is looked at.

## Alternatives rejected

- Feed the notes to the main model through `prompt.compose` so it points out
  mismatches in chat: the correction would land in the chat, not under the
  note, and the system prompt would change every time a note is added,
  breaking the main thread's prompt cache.
- Share notes through a committed file (`.claude/sticky.md`): offered to the
  user and not chosen.
- Session id as the store key: a new session would start empty, which is
  what "repository level" was asked to avoid.
- Auto-summary on every turn: per-turn cost for a pane that may be closed.
- Reading both `docs/adr/en` and `docs/adr/ja`: duplicates under one budget.
- A merge-by-id on save to handle two concurrent sessions: not needed yet;
  marked with a `ponytail:` comment.

## Consequences

- Two sessions open on the same repo overwrite each other's additions (last
  write wins).
- Each note added sends up to ~120k characters to haiku. Cost is per note,
  not per turn.
- In a repo whose docs exceed 80k characters, older ADRs are not consulted;
  a note about an old decision may come back `? 判断できず` or `✓` against a
  newer ADR only.
- The check's output is displayed only; nothing the model replies is
  executed, so text in repo docs or the transcript can at worst produce a
  wrong verdict, not an action.
- The summary does not survive the session.
- The function-hooks API is early access; a Claude Code update may require
  changes.

## Verification

Run in `/home/ko200/wanyaldee-skills` on Claude Code 2.1.318 by Claude Opus
5.5 (AI agent), 2026-11-05.

`claude plugin validate mods/sticky-notes`:

<details>

```
Validating plugin manifest: /home/ko200/wanyaldee-skills/mods/sticky-notes/.claude-plugin/plugin.json

  ❯ types ./types/index.d.ts declares on $: nothing (no EngineInterface member)
  ❯ types ./types/index.d.ts declares state: sticky-notes.commands, sticky-notes.notes, sticky-notes.summary, sticky-notes.isSummarizing

Validating hooks: /home/ko200/wanyaldee-skills/mods/sticky-notes/hooks/hooks.json

  ❯ ./register.tsx hooks: session.start, command.run{command=sticky}, command.run{command=sticky-cmd}, command.run{command=sticky-note}, command.run{command=sticky-summary}, ui.render{component=Pane, requestId=sticky-notes}
  ❯ ./register.tsx answers its own command: command.run{command=sticky}
  ❯ ./register.tsx answers its own command: command.run{command=sticky-cmd}
  ❯ ./register.tsx answers its own command: command.run{command=sticky-note}
  ❯ ./register.tsx answers its own command: command.run{command=sticky-summary}
  ❯ ./register.tsx calls: $.clock.now (via add, summarize), $.command.register, $.fs.exists (via readIf, repoDocs), $.fs.list (via repoDocs), $.fs.read (via readIf), $.model.complete (via review, summarize), $.session.messages (via transcriptOf), $.session.root (via repoDocs, storeKey), $.state.get, $.state.set, $.store.get (via load), $.store.set (via save), $.ui.copy, $.ui.open, $.ui.resolve
  ❯ ./register.tsx state writes: sticky-notes.commands, sticky-notes.isSummarizing, sticky-notes.notes, sticky-notes.summary
  ❯ ./register.tsx state reads: sticky-notes.commands, sticky-notes.isSummarizing, sticky-notes.notes, sticky-notes.summary

Plugin directory checks for /home/ko200/wanyaldee-skills/mods/sticky-notes. The plugin directory is the catalog that plugins are submitted to; this is a subset of what it runs.

⚠ Found 1 plugin directory warning:

  ❯ .claude-plugin/plugin.json icon: No icon (ICON_MISSING). No icon found in the plugin. The validator looked for `icon` in plugin.json and for a file at .claude-plugin/icon.png or .svg, assets/icon.png or .svg, or a similar path.
    Fix: Add a square PNG to the plugin folder at .claude-plugin/icon.png, or set `icon` in plugin.json to the path of a square PNG or JPEG in the plugin: 512 to 2048 px on each side, under 2 MB. SVG and WebP are not accepted. That file may become the listing icon only once: the first time the plugin is saved or submitted in the developer portal. Adding or changing it later does not change the icon.

About these checks:

  ❯ The repository root was taken to be /home/ko200/wanyaldee-skills, the nearest parent folder with a .git folder or file. README.md was taken from it, because this plugin folder has none of its own. For a plugin submitted from a git repository, the repository root is the top folder of that repository, with only what is committed there, so check that the folder named above is that top folder.
  ❯ hooks/hooks.json names a hooks module (a code file listed under `modules`). The plugin directory has rules of its own for such code, and these checks apply none of them, so passing here does not mean the directory accepts the plugin. The developer portal's own validation applies those rules.

These plugin directory checks do not change the result below.

The directory also runs a safety scan and a policy review that this command does not.

✔ Validation passed
```

</details>

`claude plugin test mods/sticky-notes` (exit 0):

```
tests/sticky.test.tsx:
(pass) commands and notes added by slash command show in the pane and are saved per repo [118.68ms]
(pass) a new session in the same repo loads the saved notes [49.81ms]
(pass) the summary button calls the model with the transcript [46.07ms]
(pass) a note is checked against the repo docs and the conversation [83.47ms]

 4 pass
 0 fail
Ran 4 tests across 1 file. [0.59s]
```

`tsc -p` with the tsconfig from the bundled `claude-code.d.ts` header
(TypeScript 5, `strict`, `noUncheckedIndexedAccess`), including `hooks`,
`types` and `tests` (exit 0):

```
(no output, exit 0)
```

Live session (the authoring session, mod hot-loaded from the dev folder):
`/sticky`, `/sticky-cmd` and `/sticky-note` answered
`付箋ペインを開きました。`, `コマンドを付箋に追加しました。` and
`認識を付箋に書き込みました。` respectively.

- The pane's look in a terminal (the three sections and the notes in them).
  Verified-by: Wanyaldee (human), 2026-11-05
- A `⚠ ここ違うかも` reply appeared under a note in the live pane as the
  check finished, without reopening the pane. (In the test harness a mounted
  pane did not redraw on that write and the test re-mounts instead; the live
  engine does redraw.)
  Verified-by: Wanyaldee (human), 2026-11-05

**Not verified:**

- Loading saved notes in a new session on a real store (covered only by a
  stubbed-store test).
- Verdict quality of haiku on real notes against this repo's docs.
- Installing through `/plugin install sticky-notes@wanyaldee-skills` (the
  live run used the dev folder, not the marketplace entry).
