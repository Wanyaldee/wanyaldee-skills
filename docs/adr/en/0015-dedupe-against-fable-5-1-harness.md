# 0015: Deduplicate against the Fable 5.1 harness, and bring prompting-fable-5 up to Fable 5.1

(日本語: [0015-dedupe-against-fable-5-1-harness.ja.md](../ja/0015-dedupe-against-fable-5-1-harness.ja.md))

## Context

The user moved to Claude Fable 5.1 as the daily driver and asked (2026-09-05)
for an audit of the whole package under it, then for the findings to be
fixed, delegating to subagents and using cheaper models where they suffice.
Three things had changed since ADR 0012, which calibrated the package against
the Opus 5 Claude Code harness:

1. The Fable 5.1 Claude Code harness states more of `fable-coding`'s rules
   itself than the Opus 5 harness did, and it now carries a Memory section
   that covers most of `memory-discipline`.
2. Anthropic published two pages the package did not reflect at all:
   *Prompting Claude Fable 5.1* and *What's new in Claude Fable 5.1*.
   `prompting-fable-5` was distilled from the Fable 5 guide only, and told
   readers to configure refusal fallback to Opus 4.8, which is now one of two
   permitted targets rather than the only one.
3. Three descriptions (`fable-coding`, `dev-philosophy`, `memory-audit`)
   summarized their skill's workflow. Skill-authoring guidance holds that a
   description stating the process creates a shortcut agents take instead of
   reading the body.

## Decision

Version 2.8.0. Four independent edits, dispatched to four subagents
partitioned by file so none could collide, with the model chosen per task's
judgment load — Sonnet for the three content edits, Haiku for the
description-only edit:

- **`fable-coding`**: ten bullets deleted, two rewritten. 1726 → 1448 words.
- **`memory-discipline`**: rewritten as a delta on the harness's Memory
  section. 499 → 358 words.
- **`prompting-fable-5`**: a "Fable 5.1 — what changed" section added, with
  Anthropic's snippet blocks quoted verbatim; the fallback target corrected;
  `max` effort and the cross-model effort caveat folded in; the leaked-prompt
  persona section relabelled by provenance.
- **Descriptions**: `fable-coding`, `dev-philosophy`, and `memory-audit`
  rewritten to state triggering conditions only.

`README.md` and `.claude-plugin/plugin.json` follow. Every touched skill's
`SKILL.ja.md` was updated in the same change.

## Reason — why these lines and not others

The deletion rule was mechanical: a line goes only if the Fable 5.1 harness
system prompt in this session states the same thing. Three places where that
rule still required judgment.

**Section 9 was trimmed, not emptied.** The original bullet:

```markdown
- Only stop for: destructive actions, DB writes (section 4), or real scope
  changes the user must decide. If you hit one of these, ask and end the
  turn — don't end on a promise.
```

became:

```markdown
- DB writes (section 4) are a stop condition on top of the destructive
  actions and scope changes the harness already stops for.
```

- The harness says "Stop only for destructive actions or genuine scope
  changes the user must decide," so two of the three stop conditions are
  already supplied and repeating them costs budget on every coding task.
- "DB writes" is not among them, and it is the whole point of section 4 of
  this skill. Deleting the bullet outright would have silently dropped the
  user's own rule — the exact failure ADR 0012 flagged as its known ceiling.
- It is phrased as an addition to the harness's list rather than a fresh
  list, so a later reader can see which half is local without diffing
  against a system prompt they no longer have.

**`memory-discipline`'s format block became a delta, not a template.** The
file previously reprinted the whole frontmatter template. It now shows only:

```markdown
---
metadata:
  origin: <model-id>, <YYYY-MM-DD>
---
```

- Only `origin` appears, because it is the only field the harness's own
  template lacks. Reprinting `name`, `description`, and `type` would restate
  the harness verbatim, which is what this ADR removes everywhere else.
- `<model-id>, <YYYY-MM-DD>` rather than a session ID: session IDs stop
  resolving once transcripts are purged. The 2026-07-04 audit that produced
  this skill had to recover attribution by grepping session logs, and that
  only worked because the logs still existed. Frontmatter has no such
  dependency.

**One subagent cut was reverted.** The agent condensing `memory-discipline`
dropped this rule, judging it covered by the harness:

```markdown
- A spec, architecture, or plan that already lives in `docs/` gets a pointer
  and the non-obvious delta, never a copy. Copying it is the spec-dump
  failure above.
```

It was restored. The harness says only "Don't save what the repo already
records" — it states the prohibition and stops. This line states the remedy,
and "spec dumps that duplicated the repo" is one of the three findings the
skill's opening paragraph cites as its reason for existing. Cutting the
remedy while keeping the complaint leaves the file arguing against a problem
it no longer tells you how to fix. The agent's other cut — the list of what
to save — was accepted, because the harness enumerates the same four types
(user, feedback, project, reference) with the same "include the why."

## Alternatives rejected

- **Rewrite `fable-coding` from scratch for 5.1** — its content was never
  version-specific; only the overlap was, so a rewrite is churn. Same
  reasoning as ADR 0012.
- **Delete `memory-discipline` now that the harness has a Memory section** —
  six of its rules have no harness equivalent, and `origin` plus same-turn
  indexing are the two the 2026-07-04 audit found violated most often.
- **Fork a separate `prompting-fable-5-1` skill** — two skills whose
  descriptions differ by one digit cannot trigger reliably against each
  other. Anthropic's own 5.1 guide is written as a delta on the 5 guide, so
  the skill mirrors that shape.
- **Split the snippet library into `references/`** — the correct move if the
  file grows again, but it costs a second file and an indirection today for a
  skill that only loads during prompt-engineering work. Deferred, noted below.
- **Keep the workflow summaries in the descriptions** — they read well to a
  human scanning the package, but the README is where that belongs and it
  already carries them.
- **Do the whole edit in this session without subagents** — rejected on the
  user's explicit cost instruction; the edits are independent and
  file-partitioned, which is the shape delegation handles well.

## Consequences

- The package now carries only what the Fable 5.1 harness does not. What
  remains in `fable-coding` is the genuinely local part: Japanese reporting,
  the DB-report rule, the ADR requirement, the armadillo rules, confidence
  levels, three-item checkpoints, and the stack notes.
- Known ceiling, inherited from ADR 0012 and now sharper: the cut is
  calibrated to the Fable 5.1 Claude Code harness specifically. On an older
  model, an SDK agent, or a bare API integration, nothing supplies the
  removed lines. They are recoverable from this ADR and from git at v2.7.0.
- `prompting-fable-5` is now by far the largest skill in the package, most of
  the growth being Anthropic's verbatim snippet blocks. That is the skill's
  value and it only loads on prompt-engineering tasks, so the size is
  accepted. If it grows again, the split is into `references/`.
- `memory-audit` grades files against `[[memory-discipline]]`, and that skill
  no longer states the Why/How-required and `type`-taxonomy rules the audit
  checks for. The audit still works because it lists its own checks, but the
  linked standard is now narrower than the checklist. Left as is.
- `dev-philosophy` has no `SKILL.ja.md` because its body is already Japanese.
  The README now says so, where it previously read as an omission.

## Verification

- Textual, as in ADR 0012: every deleted line was matched against the Fable
  5.1 Claude Code system prompt in this session before deletion.
- Both Anthropic pages were fetched live on 2026-09-05. The existing Fable 5
  snippets were re-checked against the current Fable 5 guide and still match,
  so that content was kept rather than rewritten.
- All eight skills parse: frontmatter present, `name` matching the directory,
  frontmatter under the 1024-character limit.
- Both hooks were exercised with synthetic payloads, seven cases, all as
  expected: credential paths and destructive or direct-database commands
  denied, template and ordinary paths allowed. The Bash hook additionally
  blocked the first attempt at writing that test, which demonstrated it live.
- Not verified: no RED/GREEN nested-`claude -p` run, unlike ADR 0010 and
  0011. Three of the four edits remove redundancy or restate a trigger, so
  the assertion under test would be that unchanged behavior stayed unchanged,
  which those runs cannot show cleanly. The description rewrites are the one
  change that could be tested that way — an agent given the new description
  should still read the body — and that test was not run.
