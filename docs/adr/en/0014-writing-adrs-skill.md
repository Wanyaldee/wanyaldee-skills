# 0014: writing-adrs skill

(日本語: [0014-writing-adrs-skill.ja.md](../ja/0014-writing-adrs-skill.ja.md))

## Context

The user asked (2026-08-31) to consolidate ADR-writing practice into a
dedicated skill, specifying six required elements verbatim, including a new
"Reason" section (why this code was written) that must literally include the
code and explicitly forbid vague explanations — grounded in the principle
that AI has made writing code cheap but not understanding it, so
accountability requires the author be able to explain their own code.

Before this, ADR guidance existed only as four inline bullets inside
`skills/fable-coding/SKILL.md` §6 (Context, Decision, Alternatives rejected,
Consequences) — a format that had already drifted from the five-section
practice (Context, Decision, Alternatives rejected, Consequences,
**Verification**) actually used by the repo's 13 existing ADRs in
`docs/adr/{en,ja}/`, and had no Reason section at all.

## Decision

Added `skills/writing-adrs/{SKILL.md,SKILL.ja.md}` as a dedicated,
English-authoritative skill (with a Japanese companion, matching the repo's
existing convention for English-content skills such as `fable-coding` and
`injection-vigilance`) defining the six-section ADR format — Context,
Decision, Reason, Alternatives rejected, Consequences, Verification — with
Reason as the enforced section: a required fenced code block plus
per-choice explanation, a banned-phrase list for vague language, and a
rationalization table.

Replaced `fable-coding` `SKILL.md`/`SKILL.ja.md` §6's inline four-section
description with a `REQUIRED SUB-SKILL` cross-reference to `writing-adrs`.
Bumped `plugin.json` to 2.7.0 and updated `README.md`'s skill list and its
English-companion-file line.

## Reason

The core mechanism this ADR introduces is not prose guidance but a checkable
test, embedded in `skills/writing-adrs/SKILL.md`:

```markdown
**Anti-pattern — vague explanation.** These phrases are banned from a Reason
section because they would justify almost any implementation, not this one:

- "for reliability" / "for better performance" / "for robustness"
- "to handle edge cases" / "for better UX"
- "this is the standard/best-practice way to do it"

Each is a placeholder for a reason, not a reason. Test: could this sentence
be pasted into a *different* PR with *different* code and still sound right?
If yes, it explains nothing about this code.
```

- **A literal phrase blocklist, not a general instruction ("be specific")**:
  a subagent baseline test (see Verification) showed that generic advice
  like "be specific" still produces plausible-sounding, content-free prose —
  the baseline output used phrasing like "smooths over these without
  hammering the server," which reads as specific but explains nothing about
  *this* function's actual parameters. Naming the offending phrases gives an
  agent something concrete to check its own output against.
- **A transferability test, not a length or keyword rule**: length and
  keyword checks are gameable — an agent can pad a vague sentence with
  jargon and pass a keyword filter. The transfer test ("could this sentence
  be pasted into a different PR with different code and still sound
  right?") targets the actual defect, genericness, instead of a proxy for
  it.
- **Paired with a required code block, ordered before the explanation, not
  "consider including code"**: the baseline test's prose explained the code
  accurately without ever showing it. Requiring the block first forces the
  reader to see the literal claim and the code next to each other, so they
  can be checked against one another instead of trusted on faith.
- **Cross-reference (`REQUIRED SUB-SKILL: wanyaldee-skills:writing-adrs`) in
  `fable-coding` instead of duplicating the format list there again**: the
  four-bullet description in `fable-coding` was already silently out of
  sync with the five-section format the repo's own ADRs used (no
  Verification section listed). A second inline copy, patched to six
  sections, would leave a third — still driftable — description instead of
  one authoritative source `fable-coding` points at.

## Alternatives rejected

- **Folding the Reason requirement directly into `fable-coding`'s existing
  ADR bullet instead of a separate skill**: rejected — `fable-coding` loads
  for any coding task, and would carry reference material (the full
  section-by-section format, worked examples, rationalization table) that
  is only useful at the moment of writing an ADR, working against
  `superpowers:writing-skills`' token-efficiency guidance for
  frequently-loaded skills.
- **Patching `fable-coding`'s existing four-section list in place (add a
  fifth "Reason" bullet) rather than cross-referencing a new skill**:
  rejected — the list was already missing Verification relative to actual
  practice; extending it again would still leave two competing
  descriptions of the same format instead of collapsing to one.
- **Enforcing the code-inclusion rule with a hook** (e.g. a pre-commit check
  that greps an ADR diff for a fenced code block): rejected as
  disproportionate. `dev-philosophy`'s "guardrails by mechanism, not
  prompts" principle is for security-relevant constraints; an ADR's prose
  quality is a judgment call a hook can't evaluate — a pasted, irrelevant
  code block would satisfy a naive grep while the Reason section stayed
  just as vague.

## Consequences

- `fable-coding` §6 is now a pointer, not a self-contained format
  description. Anyone changing ADR format edits
  `skills/writing-adrs/SKILL.md` only; `fable-coding` doesn't need touching
  unless the cross-reference wording itself changes.
- Existing ADRs 0001–0013 predate the Reason section requirement and do not
  have one. Not retrofitted — out of scope for this change, and no reader
  complaint motivated it. This is a known gap for anyone reading the early
  ADRs looking for a Reason section, not an oversight in this change.
- `README.md`'s skill list and `plugin.json`'s version now need updating on
  any future `writing-adrs` edit that changes its behavior, per this repo's
  existing per-skill versioning convention (see the `fable-coding` bullet's
  version history in `README.md` for the pattern).

## Verification

Two subagent tests, using `superpowers:writing-skills`' lighter testing tier
for technique/reference skills (single-rep, not the 5+-rep protocol
reserved for discipline-enforcement skills tested under pressure):

- **Baseline (no skill)**: a fresh subagent asked to write only the
  "Reason" section for a retry-with-backoff diff produced accurate but
  code-free prose (the exact text quoted in Reason, above) — confirms the
  target failure (vague-but-plausible prose, no code) is real, not
  hypothetical.
- **Green, contaminated**: the same subagent, given the finished skill and
  the *same* diff, mostly reproduced the skill's own worked example
  verbatim — weak evidence, since the skill's example diff and the test
  diff were identical.
- **Green, novel**: a second fresh subagent, given the finished skill and
  an unrelated `debounce()` diff it had never seen, produced a fenced code
  block plus five choice-by-choice justifications with no banned phrases,
  and correctly deferred a related limitation (no `cancel()`/`flush()`
  method) to a Consequences-style note rather than inventing it inside
  Reason — confirms the skill generalizes past the code it was authored
  around.

**Not verified**: no test was run under adversarial pressure (time
pressure, sunk cost, "just this once"), since this is a reference skill, not
a discipline-enforcement skill — see `superpowers:writing-skills`' "Match
the Form to the Failure" guidance for why that tier of testing wasn't
applied here. If a future session is observed skipping the Reason section
anyway, escalate to the discipline-skill bulletproofing protocol
(rationalization table + red flags, tested under combined pressure) instead
of assuming the current wording holds up under pressure it hasn't been
tested against.
