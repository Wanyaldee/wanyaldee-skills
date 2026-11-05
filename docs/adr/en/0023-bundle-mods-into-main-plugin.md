# 0023: Bundle the context-handoff and sticky-notes mods into the main plugin

(日本語: [0023-bundle-mods-into-main-plugin.ja.md](../ja/0023-bundle-mods-into-main-plugin.ja.md))

Supersedes the packaging parts of ADR 0018 and ADR 0022 (each mod as its own
marketplace plugin). Their other decisions stand.

## Context

Up to v2.12.0 the marketplace listed three plugins: `wanyaldee-skills`
(skills + command hooks), `context-handoff` and `sticky-notes` (function-hooks
mods, ADR 0018 / 0022). The user asked (2026-11-05) to package the two mods
together, and from three options (one combined mods plugin / bundle into the
skills plugin / separate plugins with a shared install note) chose **bundle
both into the skills plugin**, so one `/plugin install
wanyaldee-skills@wanyaldee-skills` installs everything.

ADR 0018 had rejected putting `modules` in the root `hooks/hooks.json` as
"undocumented"; that had to be settled by trying it.

## Decision

- `hooks/hooks.json` keeps its command hooks under `"hooks"` and gains
  `"modules": ["./mods.tsx"]`.
- `hooks/mods.tsx` is the plugin's single hooks module: it owns
  `session.start`, calls each mod's exported `start`, then lets each mod's
  `register` add its other hooks.
- Each mod's `session.start` body moved into an exported `start` function;
  its code stays under `mods/<name>/hooks/`.
- `$.state` atoms in both mods now name `plugin: 'wanyaldee-skills'`; the
  contract is one self-contained `types/index.d.ts` at the root (named in
  `.claude-plugin/plugin.json` as `"types"`), which also holds the mods'
  shared types. The mods' own `types/` folders are gone.
- `mods/*/.claude-plugin/plugin.json` and `mods/*/hooks/hooks.json` are
  removed, and the two entries are removed from `marketplace.json`.
- sticky-notes' store key prefix changed from `repo:` to `sticky-notes:`.
- Version 2.12.0 → 2.13.0.

## Reason

```json
{
  "hooks": { "SessionStart": [...], "PreToolUse": [...] },
  "modules": ["./mods.tsx"]
}
```

- Both keys in one file rather than a second hooks file: `claude plugin
  validate` accepted it, and a live `--plugin-dir` run loaded both the
  command hooks (the `.pem` read was blocked by `deny-secrets.py`) and the
  module (Verification). The manifest's `"hooks"` already names this file.

```ts
// hooks/mods.tsx
export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    await startContextHandoff($, e)
    await startStickyNotes($)
    return next(e)
  })
  contextHandoff(on, options)
  stickyNotes(on, options)
}
```

- One `session.start` in the entry, not one per mod: the engine refuses a
  plugin that hooks `session.start` twice without a matcher (`claude plugin
  validate` reported `on("session.start") is registered twice without a
  matcher`). The other events either differ between the mods or carry
  matchers (`command.run` per command, `ui.render` per component), so they
  stay in each mod's `register`.
- context-handoff's `start` runs first: it draws the status line and may
  raise the resume band, which matters more at startup than loading notes.
- Each mod keeps its own folder and `register`: the code of one mod can still
  be read, tested and removed without touching the other.

```ts
const pending = atom({ plugin: 'wanyaldee-skills', key: 'pending' } as const, null)
const commands = atom({ plugin: 'wanyaldee-skills', key: 'commands' } as const, [] as Sticky[], { shape: 'sticky-1' })

async function storeKey($: EngineInterface) {
  return `sticky-notes:${await $.session.root()}`
}
```

- `plugin: 'wanyaldee-skills'`, not the mod's old name: `$.state` values can
  be written only by the plugin that owns them, and the owner is now
  `wanyaldee-skills`. The keys of the two mods (`pending`,
  `hasSavedThisSession` / `commands`, `notes`, `summary`, `isSummarizing`)
  do not collide.
- One contract file at the root holding the shared types: `validate`
  refuses a contract that imports (`the contract must be self-contained`),
  so the types the mods import (`Handoff`, `Sticky`, …) moved into it.
- `storeKey` as a `function` declaration, not a `const` arrow: once the module
  is imported from `hooks/mods.tsx`, the engine follows `$` across the import
  only into function declarations (`validate` refused the arrow).
- `sticky-notes:` prefix: `$.store` is per plugin, so the two mods now share
  one store; context-handoff already uses `handoff:<root>`, and `repo:` would
  not say whose record it is.

## Alternatives rejected

- One combined `wanyaldee-mods` plugin: offered, not chosen by the user.
- Separate plugins with a combined install note: offered, not chosen.
- Keeping the standalone marketplace entries alongside the bundle: a user
  with both installed would run each mod twice (seen in the live run below,
  where the still-installed standalone `context-handoff` loaded next to the
  bundle).
- A second hooks file named in `plugin.json`: not needed once one file
  holding both keys was shown to load.
- Migrating data from the standalone plugins' stores: a plugin cannot read
  another plugin's `$.store`; the data is a handful of notes and at most one
  pending handoff per repo.

## Consequences

- One install gets skills, command hooks and both mods; a user who wants the
  skills without the mods cannot opt out per mod.
- Users of the standalone `context-handoff` / `sticky-notes` must uninstall
  them after updating, or each mod runs twice. Their saved notes and pending
  handoffs are not carried over.
- Adding a third mod means: a folder under `mods/`, an exported `start` if it
  needs `session.start`, a line in `hooks/mods.tsx`, and its state keys in
  `types/index.d.ts`, checked for collisions.
- `claude plugin validate .` and `claude plugin test .` now cover both mods
  from the repo root.

## Verification

Run in `/home/ko200/wanyaldee-skills` on Claude Code 2.1.318 by Claude Opus
5.5 (AI agent), 2026-11-05.

`claude plugin validate .` (exit 0):

<details>

```
Validating marketplace manifest: /home/ko200/wanyaldee-skills/.claude-plugin/marketplace.json

⚠ Found 2 warnings:

  ❯ description: No marketplace description provided. Adding a description helps users understand what this marketplace offers
  ❯ plugins[0] plugin.json → author: No author information provided. Consider adding author details for plugin attribution

Validating plugin: /home/ko200/wanyaldee-skills/.claude-plugin/plugin.json

⚠ Found 1 warning:

  ❯ author: No author information provided. Consider adding author details for plugin attribution

  ❯ types ./types/index.d.ts declares on $: nothing (no EngineInterface member)
  ❯ types ./types/index.d.ts declares state: wanyaldee-skills.pending, wanyaldee-skills.hasSavedThisSession, wanyaldee-skills.commands, wanyaldee-skills.notes, wanyaldee-skills.summary, wanyaldee-skills.isSummarizing

Validating hooks: /home/ko200/wanyaldee-skills/hooks/hooks.json

  ❯ ./mods.tsx hooks: session.start, session.measure, command.run{command=handoff}, ui.render{component=AbovePrompt}, command.run{command=sticky}, command.run{command=sticky-cmd}, command.run{command=sticky-note}, command.run{command=sticky-summary}, ui.render{component=Pane, requestId=sticky-notes}
  ❯ ./mods.tsx answers its own command: command.run{command=handoff}
  ❯ ./mods.tsx answers its own command: command.run{command=sticky}
  ❯ ./mods.tsx answers its own command: command.run{command=sticky-cmd}
  ❯ ./mods.tsx answers its own command: command.run{command=sticky-note}
  ❯ ./mods.tsx answers its own command: command.run{command=sticky-summary}
  ❯ ./mods.tsx calls: $.clock.now (via add, checkpoint, summarize), $.command.register (via startContextHandoff, startStickyNotes), $.fs.exists (via readIf, repoDocs), $.fs.list (via repoDocs), $.fs.read (via readIf), $.fs.write (via checkpoint), $.model.complete (via review, summarize), $.model.fork (via summarize), $.process.run (via git), $.prompt.submit, $.session.append (via checkpoint), $.session.cwd (via repoRootOf), $.session.messages (via summarize, transcriptOf), $.session.root (via repoDocs, storeKey), $.session.usage (via startContextHandoff), $.state.get, $.state.set, $.store.delete (via settle), $.store.get (via load, startContextHandoff), $.store.set (via checkpoint, save), $.ui.copy, $.ui.log (via git, summarize), $.ui.open, $.ui.resolve, $.ui.status (via showUsage), $.ui.toast (via checkpoint, commitAll, startContextHandoff)
  ❯ ./mods.tsx state writes: wanyaldee-skills.commands, wanyaldee-skills.hasSavedThisSession, wanyaldee-skills.isSummarizing, wanyaldee-skills.notes, wanyaldee-skills.pending, wanyaldee-skills.summary
  ❯ ./mods.tsx state reads: wanyaldee-skills.commands, wanyaldee-skills.hasSavedThisSession, wanyaldee-skills.isSummarizing, wanyaldee-skills.notes, wanyaldee-skills.pending, wanyaldee-skills.summary

Plugin directory checks for /home/ko200/wanyaldee-skills. The plugin directory is the catalog that plugins are submitted to; this is a subset of what it runs.

⚠ Found 1 plugin directory warning:

  ❯ .claude-plugin/plugin.json icon: No icon (ICON_MISSING). No icon found in the plugin. The validator looked for `icon` in plugin.json and for a file at .claude-plugin/icon.png or .svg, assets/icon.png or .svg, or a similar path.
    Fix: Add a square PNG to the plugin folder at .claude-plugin/icon.png, or set `icon` in plugin.json to the path of a square PNG or JPEG in the plugin: 512 to 2048 px on each side, under 2 MB. SVG and WebP are not accepted. That file may become the listing icon only once: the first time the plugin is saved or submitted in the developer portal. Adding or changing it later does not change the icon.

About these checks:

  ❯ This folder also holds a marketplace manifest. The plugin directory treats such a folder as a plugin, so these checks cover only the plugin in this folder. To check another plugin that the marketplace lists, run validate on that plugin's folder.
  ❯ hooks/hooks.json names a hooks module (a code file listed under `modules`). The plugin directory has rules of its own for such code, and these checks apply none of them, so passing here does not mean the directory accepts the plugin. The developer portal's own validation applies those rules.

These plugin directory checks do not change the result below.

The directory also runs a safety scan and a policy review that this command does not.

✔ Validation passed with warnings
```

</details>

`claude plugin test .` (exit 0):

```
mods/context-handoff/hooks/logic.test.ts:
(pass) status shows context fill and every rate-limit window [7.55ms]
(pass) status shows a placeholder before the first response [0.51ms]
(pass) no handoff while every figure is under its threshold [0.47ms]
(pass) a rate-limit window at 90% triggers a handoff [0.43ms]
(pass) a context fill at 90% triggers a handoff [0.52ms]
(pass) handoffs are keyed by repository, not by session [0.41ms]
(pass) the resume question is the exact wording asked for [0.33ms]
(pass) the resume prompt carries the branch, commit and summary [0.86ms]

mods/sticky-notes/tests/sticky.test.tsx:
(pass) commands and notes added by slash command show in the pane and are saved per repo [294.93ms]
(pass) a new session in the same repo loads the saved notes [106.13ms]
(pass) the summary button calls the model with the transcript [96.08ms]
(pass) a note is checked against the repo docs and the conversation [103.59ms]

 12 pass
 0 fail
Ran 12 tests across 2 files. [1.38s]
```

`tsc -p` with the tsconfig from the bundled `claude-code.d.ts` header
(TypeScript 5, `strict`, `noUncheckedIndexedAccess`) over `hooks/*.tsx`,
`types/` and `mods/` (exit 0):

```
(no output, exit 0)
```

Live load with `--plugin-dir` (headless `claude -p`): command hooks and the
module both active.

```
$ claude -p "Use the Read tool on <scratchpad>/hooktest/dummy.pem and tell me exactly what happened, including any hook message verbatim." --plugin-dir /home/ko200/wanyaldee-skills --debug-file <scratchpad>/hooktest/debug.log --allowedTools=Read
PreToolUse:Read hook error: fable-coding: credential file read blocked (dummy.pem)

- **What fired:** a hook on the Read tool, from the `fable-coding` skill or plugin.
- **Why:** it treats `.pem` files as credentials and blocks reads of them. It went by the file extension; the file's contents weren't inspected.
- **What I did next:** nothing. I didn't try to get around the block with `cat` or any other tool.

If you're testing the hook, this is the behaviour you'd expect for a `.pem` file. If you want me to read the file, you'll need to change or allowlist that rule in the hook config yourself.
```

(The command was piped through `tail -8`; the lines above are those eight
lines as printed, so anything the run printed before them was not captured.)

Debug log lines naming the plugin (`--debug-file`):

```
[DEBUG] Plugin "wanyaldee-skills" from --plugin-dir overrides installed version
[DEBUG] Synced plugin "wanyaldee-skills" shadowed by local copy wanyaldee-skills@inline
[DEBUG] hooks module wanyaldee-skills@inline loaded (worker, environment 1, tier user); events: session.start,session.measure,command.run,ui.render
[DEBUG] hooks module context-handoff@wanyaldee-skills loaded (worker, environment 2, tier user); events: session.start,session.measure,command.run,ui.render
[DEBUG] hooks module wanyaldee-skills@inline, context-handoff@wanyaldee-skills session.start settled in 96.3ms (worker hop, next() included)
```

**Not verified:**

- Installing v2.13.0 through `/plugin install` / marketplace update (only
  `--plugin-dir` was run).
- The sticky-notes pane and the context-handoff band in an interactive
  session of the bundled plugin (the headless run draws no UI).
- Uninstalling the standalone plugins after the update.
