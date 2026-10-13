# 0020: fable-coding — hypothesize before judging inherited code

(日本語: [0020-hypothesize-before-judging-inherited-code.ja.md](../ja/0020-hypothesize-before-judging-inherited-code.ja.md))

## Context

The user asked (2026-10-13) for a rule, probably in `fable-coding`: code
that looks like an anti-pattern was most likely written under some
constraint. The agent should form hypotheses about why it was written that
way and always leave them in a form the person in charge can be asked
about, keeping in mind that sometimes there is no such person. The
candidate reasons are library limits, machine spec, deadlines — the "adult
circumstances" that are never written down. Making them explicit keeps a
future reader (including the author) out of trouble. If the constraint
looks solvable now, leave a proposal, but do not implement it.

`fable-coding` already banned drive-by fixes ("adjacent improvements …
get listed as proposals at the end, not implemented") and had `ponytail:`
comments for the author's own shortcuts. Neither asked *why* inherited
code looks the way it does.

## Decision

In `skills/fable-coding/SKILL.md`:

- §1 (Understand before touching anything): a new bullet with a
  four-field note per odd-looking item outside the task: Hypotheses,
  Evidence, Question for the `git blame` author (with their last-commit
  date), and Proposal (not implemented). If no owner can be found, the
  note says "Owner: unknown" (or "left").
- §3: `ponytail:` comments now name the constraint that forced the
  shortcut, not just the ceiling and the upgrade path.
- Anti-patterns: "Calling inherited code wrong, or proposing to replace
  it, without hypotheses for why it was written that way and a question
  for its owner."

Mirrored into `SKILL.ja.md`, `skills/fable-coding/AGENTS.md`, and the root
`AGENTS.md`. Plugin version 2.10.0 → 2.11.0.

## Reason

```markdown
**sync.py:9 `time.sleep(1.2)`, `per_page=50`**
- Hypotheses: (a) undocumented API rate limit hit in 2023; (b) deadline: commit says "quick fix before release"; (c) memory limit on the old worker host
- Evidence: `git blame` → h-tanaka, 2023-03-02, "quick fix before release"; no comment, no ADR
- Question for h-tanaka (last commit 2024-01): "Was the 1.2s sleep added because of 429s from /orders, or as a precaution before release?"
- Proposal (not implemented): if (a) no longer holds, `per_page=500` and no sleep cuts the sync from N/50 to N/500 requests; measure on staging first
```

- **A fixed four-field shape, not a prohibition.** The baseline agent
  already obeyed "no drive-by fixes". What it left out was the
  hypotheses and the question to the owner. Per `superpowers:writing-skills`'
  "Match the Form to the Failure", an omitted element calls for a template
  slot, not another "don't".
- **"At least two hypotheses."** With only one, the agent writes down the
  first plausible story. The baseline did exactly that: it guessed
  "rate limit", missed the deadline signal in the commit message, and
  treated the `requests==2.19.1` pin as merely "old". With a second
  hypothesis required, the evidence has to pick between them.
- **The question is addressed to the `git blame` author, with their
  last-commit date.** "Ask the team" goes to nobody. A named person with a
  date tells the reader whether that person can still be asked, which is
  the user's "sometimes there is no person in charge" case. "Owner:
  unknown" keeps the hypotheses on record even when nobody can confirm
  them.
- **Proposal only when the evidence suggests the constraint may no longer
  hold; never implemented in this task.** This follows the user's "提案
  ベースで残しておく(実装はしない)" and matches the existing ban on
  drive-by fixes in §3.
- **`ponytail:` gains the constraint.** This is the author side of the
  same problem. The constraint (deadline, library bug, machine spec) is
  the one thing a later reader cannot get back from the code.

## Alternatives rejected

- Put it in `writing-adrs`: ADRs are written for one's own changes. This
  rule is about reading other people's code during any task, which is
  `fable-coding` §1's territory.
- Open an issue per finding automatically: this publishes to an external
  tracker without asking, and on a noisy codebase it floods the tracker.
  The note is written so it can be pasted into an issue once the user
  decides to.
- Require asking the owner before continuing the task: it blocks the
  actual task on someone who may have left.

## Consequences

- Final reports get longer whenever the touched area has odd code. Each
  item is four lines.
- The hypotheses are guesses. Their value is in being recorded and
  checkable, not in being right.
- The note lives in the final report, which is not persistent unless the
  user files it somewhere. Persisting it (issue, ADR, code comment) is
  left to the user.

## Verification

Tool-run check (run by the agent), confirming §1 of both AGENTS.md copies
matches SKILL.md and the other two edits are present:

```
$ for f in skills/fable-coding/AGENTS.md AGENTS.md; do diff <(sed -n '/Never guess an API/,/^#* *2\. Diagnose/p' skills/fable-coding/SKILL.md | sed '$d') <(sed -n '/Never guess an API/,/^#* *2\. Diagnose/p' $f | sed '$d') && echo "$f section1 identical"; grep -c 'constraint that forced it\|Calling inherited code wrong' $f; done
skills/fable-coding/AGENTS.md section1 identical
2
AGENTS.md section1 identical
2
```

Subagent tests (single-shot Sonnet, one rep each, lighter tier as in ADR
0014):

- **Baseline (skill before this change)**: fix a `TypeError` in `total()`
  in a `sync.py` whose `fetch_orders` has `sleep(1.2)` and `per_page=50`,
  with `requests==2.19.1` pinned. The agent fixed only the bug and listed
  two bare proposals ("check whether sleep/per_page are still needed",
  "update requests"). The rate-limit hypothesis appeared only in its
  private notes. It formed no hypothesis for the pin, missed the deadline
  signal ("quick fix before release"), and wrote no question to
  h-tanaka.
- **Green, novel scenario** (a typo fix in a React `SettingsForm.tsx`, next
  to a `setTimeout(…, 0)` IME workaround by y-ishii, whose last commit was
  2022-02, plus a hand-rolled `debounce` and a React 17 pin from a
  squashed "initial import" by ci-bot): it fixed only the typo. It gave
  three hypotheses with confidence for each item and identified the
  Safari IME workaround as the most likely reason, so it did not remove
  it. It wrote a question to y-ishii flagged "may no longer be here", and
  wrote "Owner: unknown" for the ci-bot items, pointing to the old repo's
  history. The lodash/React 18 proposals were marked not implemented, and
  the React bump was gated on learning why it was pinned.

Verified-by: Claude Opus 5.5 (AI agent), 2026-10-13 (diff and subagent tests above)

**Not verified**: the green test ran once, without pressure. No human has
reviewed the wording against what the user meant.
