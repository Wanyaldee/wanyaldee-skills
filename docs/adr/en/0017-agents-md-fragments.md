# 0017: AGENTS.md fragments for non-Claude-Code agents

(日本語: [0017-agents-md-fragments.ja.md](../ja/0017-agents-md-fragments.ja.md))

## Context

The user asked (2026-09-19) to make this package's skills usable by AI
coding agents other than Claude Code, prompted by noticing that Claude Code
itself now reads `AGENTS.md` as passive project instructions (alongside
`CLAUDE.md`) — a convention other tools (Codex CLI, Cursor, etc.) already
use.

Before this, every skill in this package existed only as
`skills/<name>/SKILL.md`: a Claude-Code-specific format with `name`/
`description` YAML frontmatter that Claude Code's Skill tool matches against
the current task to decide whether to load it on demand. The whole package
is distributed as a Claude Code plugin
(`/plugin install wanyaldee-skills@wanyaldee-skills`). Neither mechanism —
on-demand Skill invocation, or plugin-marketplace install — has an
equivalent in agents that follow the `AGENTS.md` convention: those agents
read `AGENTS.md` unconditionally whenever it's present in a project, with no
install step and no per-task matching.

## Decision

Added a root [`AGENTS.md`](../../../AGENTS.md) aggregating the four skills
whose content is generic enough to apply to any coding agent —
`fable-coding`, `writing-adrs`, `injection-vigilance`, `dev-philosophy` —
plus a standalone `skills/<name>/AGENTS.md` fragment for each of those four,
so a user can copy a single skill into another project instead of the
whole aggregate. Excluded `memory-discipline`/`memory-audit` (built on
Claude Code's auto-memory feature) and `remote-config-sync` (a Claude Code
`SessionStart` hook) — neither has a passive-`AGENTS.md`-compatible
fallback.

Each `AGENTS.md` file is a content copy of its `SKILL.md`, with Claude-Code
-specific syntax generalized (see Reason), not a rewrite of the guidance
itself. Updated `README.md` with a usage section explaining that other
agents have no install step — clone the repo, then copy the relevant file
into the target project's own `AGENTS.md` — and bumped `plugin.json` to
2.9.0. Both `README.md` and the root `AGENTS.md` also carry a maintainer
disclaimer: this content has not been tested against any non-Claude-Code
agent, and bug reports should go to a GitHub Issue or, since the package is
MIT-licensed, a self-fix/PR.

## Reason

The one substantive rewrite, not just frontmatter removal, is in
`fable-coding`'s ADR section. `SKILL.md` §6 reads:

```markdown
- **REQUIRED SUB-SKILL:** Use wanyaldee-skills:writing-adrs for the section
  format (Context, Decision, Reason, Alternatives rejected, Consequences,
  Verification) — Reason must include the actual code, not a description
  of it.
```

`skills/fable-coding/AGENTS.md` §6 replaces it with:

```markdown
- Use the six-section format — Context, Decision, Reason, Alternatives
  rejected, Consequences, Verification — with Reason including the actual
  code, not a description of it. If this project also has the
  `writing-adrs` guidance available (bundled as a sibling `AGENTS.md`
  fragment in this package, or as a Claude Code skill), follow it for full
  detail and the banned vague-phrase list; the six section names above are
  the minimum bar if it isn't.
```

- **`wanyaldee-skills:writing-adrs` syntax replaced with a plain-English
  cross-reference, not deleted outright**: `wanyaldee-skills:writing-adrs`
  is Claude Code's Skill-ID addressing scheme (`plugin:skill`) — meaningless
  to an agent with no Skill tool. But the underlying point (a fuller
  reference exists) is still true and still useful when a user copies both
  fragments together, so the reference stays, just not as invocation syntax
  a non-Claude agent would choke on.
- **The six section names inlined as a fallback, not just "see
  writing-adrs"**: `fable-coding`'s `AGENTS.md` fragment is meant to be
  copyable on its own (the whole point of shipping per-skill fragments
  instead of only the aggregate — see Alternatives rejected). A bare
  cross-reference to a file that may not have been copied alongside it
  would silently drop the ADR-format requirement for whoever takes only
  this one fragment. Naming the six sections directly means the fragment
  degrades gracefully instead of failing silently when used alone.
- **"the minimum bar if it isn't [available]", not a hard requirement to
  always have `writing-adrs` too**: forcing every `fable-coding` user to
  also carry `writing-adrs` would work against the portability goal
  (Alternatives rejected covers why fragments must be self-contained);
  phrasing it as a floor keeps the fragment independently useful while
  still pointing at the fuller version when present.

The same generalization pattern (Claude-Code-specific term → same claim,
agent-neutral wording) was applied in two other spots, without needing a
Reason-level rewrite since they're single-clause substitutions: `fable-coding`
§9's "the harness already stops for" → "this agent already pauses for
confirmation on"; `injection-vigilance`'s "system configuration (system
prompt, CLAUDE.md, hooks, skills)" → "...project instruction files such as
`CLAUDE.md`/`AGENTS.md`, hooks, skills/rules files"; `dev-philosophy` §5's
heading "Claude への行動指示" → "AIエージェントへの行動指示". Verified by grep
(see Verification) that no `wanyaldee-skills:` addressing, `REQUIRED
SUB-SKILL`, or YAML frontmatter survived into any of the five new files.

## Alternatives rejected

- **A generator script that derives `AGENTS.md` from `SKILL.md`
  automatically**: rejected — only four short files need one-time content
  adaptation with a handful of manual substitutions; `fable-coding` §3's own
  dependency ladder (YAGNI before tooling) argues against building
  automation for a problem this small, and this repo already carries the
  same kind of manual-sync burden for `SKILL.ja.md` without a generator.
- **One shared content file, referenced from both the per-skill fragment
  and the root aggregate, to avoid the four-way duplication (`SKILL.md`,
  `SKILL.ja.md`, `AGENTS.md` fragment, root `AGENTS.md` section)**:
  rejected — an `AGENTS.md` fragment's entire value is being a single file
  a user can copy into an unrelated project; a file that itself needs a
  second file alongside it to render meaningfully isn't portable, which is
  the property being bought here.
- **Including all seven skills in `AGENTS.md`, with the three Claude-Code
  -specific ones marked reference-only instead of omitted**: rejected per
  explicit user choice (asked directly; user picked "generic skills only") —
  `memory-discipline`/`memory-audit` describe behavior around a Claude Code
  feature that doesn't exist for other agents, and `remote-config-sync`
  describes a Claude Code hook with no passive-file equivalent; including
  either as "reference-only" prose would document a capability the reading
  agent cannot act on.
- **Root aggregate only, no per-skill fragments**: rejected per explicit
  user choice ("both") — a user who only wants `injection-vigilance` in a
  small unrelated project would otherwise have to hand-extract one section
  out of the aggregate instead of copying a ready file.

## Consequences

- Every future edit to one of the four generic `SKILL.md` files now has
  three follower files to keep in sync instead of one: `SKILL.ja.md`
  (existing convention), `skills/<name>/AGENTS.md` (new), and the
  corresponding section of the root `AGENTS.md` (new). No tooling enforces
  this; it relies on the same manual-sync discipline already used for
  `SKILL.ja.md`, and each fragment's own header states `SKILL.md` is
  authoritative.
- Nothing currently detects drift between a `SKILL.md` and its `AGENTS.md`
  fragment (no CI diff, no test). A future edit to `SKILL.md` that forgets
  the fragment will go unnoticed until someone reads both side by side —
  a known gap, not fixed here (see Alternatives rejected on why a generator
  was judged disproportionate for four files).
- Other agents reading `AGENTS.md` get the full always-loaded text on every
  task, unlike Claude Code's on-demand Skill loading gated by `description`
  matching — there is no equivalent conditional-loading mechanism in the
  `AGENTS.md` convention, so this is an inherent property of the format,
  not a choice made here.
- Bug reports from non-Claude-Code agents route to GitHub Issues or a
  self-fix/PR rather than to the maintainer investigating directly — an
  explicit trade-off given the maintainer has no day-to-day way to
  reproduce issues specific to another agent's behavior.

## Verification

```
$ grep -n "wanyaldee-skills:\|REQUIRED SUB-SKILL\|^---$\|name:\|description:" \
    AGENTS.md skills/fable-coding/AGENTS.md skills/dev-philosophy/AGENTS.md \
    skills/writing-adrs/AGENTS.md skills/injection-vigilance/AGENTS.md
```

Matched only Markdown `---` section separators in the root `AGENTS.md` — no
YAML frontmatter (`name:`/`description:`), no `wanyaldee-skills:`
Skill-addressing syntax, and no `REQUIRED SUB-SKILL` survived into any of
the five new files. A follow-up grep for `Claude` across the three files
where a generalization was made (`dev-philosophy`, `injection-vigilance`,
root `AGENTS.md`) confirmed the remaining hits are all intentional (the
fragment's own explanatory note about what changed, references to Claude
Code's plugin-distribution mechanism, and a rationalization-table example
about a *previous session's own output* that applies to any agent, not
Claude specifically).

**Not verified**: no actual non-Claude-Code agent (Codex CLI, Cursor, or
similar) was run against a project containing these files in this session.
Whether an `AGENTS.md`-reading agent picks up and follows this content as
intended is unconfirmed — this ADR only verifies the files are clean of
leftover Claude-Code-specific syntax, not that the fallback content reads
naturally to an unfamiliar model in practice.
