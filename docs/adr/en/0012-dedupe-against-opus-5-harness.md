# 0012: Deduplicate fable-coding against the Opus 5 Claude Code harness

(日本語: [0012-dedupe-against-opus-5-harness.ja.md](../ja/0012-dedupe-against-opus-5-harness.ja.md))

## Context

The user moved to Claude Opus 5 as the daily driver and asked (2026-07-26)
for the setup to be tuned for it. `fable-coding` was assembled while running
Fable 5, largely to *supply* discipline the harness of the day did not state.
The Opus 5 Claude Code system prompt now states several of those same rules
itself, in some cases word for word — the act-when-informed paragraph in
section 0 (folded in by ADR 0003 from Anthropic's Fable 5 prompting guide)
appears verbatim in the harness.

Duplicated instruction is not free: it consumes the skill's context budget,
and `prompting-fable-5` already records Anthropic's own guidance that skills
written for prior models are often too prescriptive and degrade output — try
removing before rewriting.

## Decision

Five bullets removed or trimmed from `skills/fable-coding/SKILL.md`, with
`SKILL.ja.md` following:

- §0 act when informed / do not re-derive settled facts — verbatim in the harness.
- §1 run independent searches in parallel — the harness states this.
- §3 match the surrounding code's naming and idiom — the harness states this.
- §5 report outcomes faithfully — trimmed to its one non-duplicated clause,
  that a skipped step is named *with the reason it was skipped*.
- §7 own mistakes without over-apologizing — the harness Corrections section
  states this.

112 lines to 107. Version 2.5.0.

Deliberately kept: section 3's ponytail ladder, which duplicates the ponytail
plugin's own SessionStart injection — that plugin is separately installable
and `fable-coding` must stand alone without it. The skill and plugin names
also stay as they are (ADR 0007).

## Verification

Textual, not behavioral: each removed line was matched against the Opus 5
Claude Code system prompt in this session before deletion, and the English
and Japanese diffs were compared to confirm both files changed at the same
five places. No RED/GREEN nested-`claude -p` run was performed, unlike
ADR 0010 and 0011 — this change removes redundancy rather than adding a
behavior, so the assertion under test would be that unchanged behavior stayed
unchanged, which those runs cannot show cleanly.

## Alternatives rejected

- **Also cut the anti-pattern list** (15 items, 17 lines, every one a
  restatement of sections 0–9, against the guide's "brief beats enumerated"):
  offered to the user, who chose the conservative cut.
- **Change nothing** — accepts the duplication, but the cost is paid on every
  coding task.
- **Rewrite the skill around Opus 5** — its content was never Fable-specific;
  only the redundancy was, so a rewrite would be churn.

## Consequences

- The skill now carries only what the harness does not, so what remains is
  the user-specific part: Japanese reporting, the DB-report rule, the ADR
  requirement, the armadillo rules, the stack notes.
- Known ceiling: the cut is calibrated to the Opus 5 Claude Code harness
  specifically. On a harness that does not state these rules — an older
  model, an SDK agent, a bare API integration — the removed lines are no
  longer supplied by anything. They are recoverable from this ADR and from
  git history at v2.4.0.
- The `prompting-fable-5` skill was left untouched: it documents how to
  prompt Fable 5 and is not affected by which model reads it. Its
  "fall back to Opus 4.8 on refusal" line is now arguably stale with Opus 5
  shipped, but that line quotes Anthropic's guide and was not re-verified
  against the current guide in this session.
