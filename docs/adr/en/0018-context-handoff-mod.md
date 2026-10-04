# 0018: context-handoff mod (usage display + automatic handoff near limits)

(日本語: [0018-context-handoff-mod.ja.md](../ja/0018-context-handoff-mod.ja.md))

## Context

The user asked (2026-10-04) for a mod that (a) always shows how much of the
context window is in use, and (b) when a limit starts getting close,
immediately commits, records what was being worked on, and — without relying
on a session ID — continues the work after the user confirms. The
confirmation must be asked on the next launch of Claude, worded as
「このリポジトリでこの作業をやっていましたがトークン切れで作業を一時中断しました、続行しますか」.

Before this, nothing in the package touched Claude Code's runtime: the
package was skills plus command hooks (`hooks/*.py`, a shell `SessionStart`
hook). Hitting the 5-hour rate limit mid-task meant the next session started
cold, and resuming relied on `--resume <id>` or the user retyping context.

## Decision

Added `mods/context-handoff/`, a Claude Code plugin of **function hooks**
(`hooks/hooks.json` → `{ "modules": ["./register.tsx"] }`), listed as a
second plugin in `.claude-plugin/marketplace.json`
(`/plugin install context-handoff@wanyaldee-skills`). It is separate from the
`wanyaldee-skills` plugin, whose `hooks/hooks.json` holds command hooks.

- `session.start` / `session.measure` → `$.ui.status(...)` with context fill
  and every rate-limit window.
- `session.measure` at ≥90% on any rate-limit window or on context → once per
  session: summary via `$.model.fork`, write `<repo>/.claude/handoff.md`,
  `git add -A` + commit, save the record in `$.store` under
  `handoff:<repo root>`, append a wrap-up note for the running model.
- Next interactive `session.start` in the same repo root → a band above the
  prompt asking the required question, with `[続行する]` (submits a resume
  prompt carrying the summary) and `[破棄する]` (drops the record).
- `/handoff` runs the same checkpoint by hand.

## Reason

Trigger and threshold (`hooks/logic.ts`):

```ts
export const CONTEXT_THRESHOLD = 90
export const RATE_LIMIT_THRESHOLD = 90

export function limitReason(context, rateLimits): string | null {
  const hot = rateLimits.find(limit => limit.percentUsed >= RATE_LIMIT_THRESHOLD)
  if (hot !== undefined) return `レート制限 ${limitLabel(hot.kind)} が ${hot.percentUsed}% に到達`
  if (context.percent !== undefined && context.percent >= CONTEXT_THRESHOLD) return `コンテキストが ${context.percent}% に到達`
  return null
}
```

- Hooked on `session.measure`, not a timer: the engine fires it after each
  main-thread turn and whenever a rate-limit window moves a whole point, so
  the check costs nothing between turns, and a checkpoint after a turn ends
  never commits a half-applied Edit sequence from inside a turn.
- 90%, not 95–99%: the checkpoint itself spends tokens (one `$.model.fork`
  over the whole transcript), and `rateLimits` only updates from the last API
  response, so the margin has to absorb one more turn plus the summary
  request. At 100% the fork would fail and the summary would be lost.
- Rate limit checked before context: rate-limit exhaustion is what actually
  stops work ("トークン切れ"); context fill is recoverable by auto-compact, so
  it is the second reason, not the first.

Once per session, surviving hot reloads:

```ts
const hasSavedThisSession = atom({ plugin: 'context-handoff', key: 'hasSavedThisSession' } as const, false)
...
if (reason !== null && !(await read($, hasSavedThisSession))) await checkpoint($, reason)
```

- `$.state`, not a module `let`: a hot reload re-runs `register` and fires
  `session.start` again; a module variable would reset and the mod would
  commit again and offer the session its own handoff back. The same flag
  gates the resume question in `session.start`.
- Set at the top of `checkpoint`, before any `await` that talks to git or the
  model: two `session.measure` events (context and rate limit moving in the
  same turn) cannot both start a checkpoint.

Keying the record (no session ID):

```ts
export const storeKey = (repoRoot: string): string => `handoff:${repoRoot}`
```

- `$.store` persists across sessions; keyed by `git rev-parse --show-toplevel`
  (falling back to cwd), so launching from any subdirectory of the repo finds
  it, and two repos never see each other's handoff. This is what "SessionID
  なしで" means here.

The commit (`commitAll` in `register.tsx`):

```ts
await git($, ['add', '-A'], repoRoot)
const hasStaged = !(await git($, ['diff', '--cached', '--quiet'], repoRoot)).isOk
if (!hasStaged) return ''
const committed = await git($, ['commit', '-m', commitMessage(reason)], repoRoot)
```

- `add -A`: the user asked for an immediate commit of the work; new files
  are part of the work. `.gitignore` still applies.
- `diff --cached --quiet` first: `git commit` with nothing staged exits 1,
  which would read as a failure and raise a misleading toast.
- No `--no-verify`: the user's pre-commit hooks (secret scanners included)
  keep running; on failure the change stays staged and a toast says so.
- `handoff.md` is written before the commit so it lands in the same commit:
  the note travels with the branch, readable by an agent without this mod.

The summary:

```ts
const reply = await $.model.fork({ prompt: SUMMARY_PROMPT })
```

- `$.model.fork`, not `$.model.complete`: fork replays the main thread's
  last request, so the prompt cache serves the transcript and the session's
  own model writes the summary from full context. `complete` has no history.
- Fallback to the last 3 user prompts, not an empty note: the resume prompt
  needs some anchor even when the API is already refusing.

The question as a band, not a pane or a toast: an unasked pane opens only at
≥144 terminal columns, and a toast disappears. The `AbovePrompt` band renders
until a button clears `pending`, which is what 「必ず聞く」 needs.

## Alternatives rejected

- Command hooks (Python) like the existing ones: they cannot read the live
  context/rate-limit figures or draw a status line or band.
- Merging `modules` into the root `hooks/hooks.json`: mixing function and
  command hooks in one manifest is undocumented; a separate plugin keeps the
  existing hooks untouched.
- Storing the record only in `.claude/handoff.md`: detection on startup would
  have to parse a file that a later commit may have deleted or edited.
- `$.prompt.submit` on startup without asking: the user explicitly wanted
  confirmation first.
- A userConfig for thresholds: not requested; the constants are one edit away.

## Consequences

- A checkpoint commit lands on whatever branch is checked out, including
  `main`, and includes untracked non-ignored files.
- `.claude/handoff.md` stays in the repo until the resumed agent deletes it
  (the resume prompt asks it to).
- Only turn ends are checked: one long turn that crosses from 85% to 100%
  gets no checkpoint.
- Rate limits show only on a subscription; off one, only context triggers.
- The function-hooks API is early access; a Claude Code update may require
  changes.

## Verification

- `claude plugin validate mods/context-handoff`: passed.
- `tsc` against the bundled `claude-code.d.ts` (Claude Code 2.1.289): no errors.
- `claude plugin test mods/context-handoff`: 8 unit tests of `logic.ts`
  (status format, thresholds at 89.9/90, store key, exact question wording,
  resume prompt content) pass.
- **Not verified**: the git/fork/band path in a live session. Hot reload was
  declined in the authoring session, so the mod has not run end to end; the
  first real rate-limit approach is the first live test.
