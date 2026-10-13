# 0019: writing-adrs — full logs, signatures, and operation records in Verification

(日本語: [0019-adr-verification-evidence-and-signature.ja.md](../ja/0019-adr-verification-evidence-and-signature.ja.md))

## Context

The user asked (2026-10-13) to tighten the Verification section of the
`writing-adrs` skill:

- Compiler and similar tool logs go into the ADR **in full**, as evidence.
- Verification of UI and similar checks is always **signed** by whoever did
  it, so the ADR states who is accountable. Git records the committer, but
  the ADR should record the verifier too; a matching committer and verifier
  gives a baseline of trust (unless both are forged).
- Cross-checking with multiple models has some effect but is not
  guaranteed to work, and the same is true of people.
- Follow-up the same day: important operations such as DB operations or
  anything run with `sudo` must also record their log, their intent, and
  who verified them.

Before this change the Verification section was two sentences ("what was
actually run … and what was *not* verified"), and nothing in it said what
form the evidence takes.

## Decision

Extend `### Verification` in `skills/writing-adrs/SKILL.md` with two entry
shapes (tool-run checks: command plus full log; checks a person makes: what
was checked plus a `Verified-by:` signature), and a rule that review by
another model is recorded as `Reviewed-by:` and does not count as
verification. Add a third entry shape for operations that change state
(DB writes and migrations, `sudo`, deploys, service restarts): one record
per operation with **Operation / Intent / Target / Run by**, the full log,
and a `Verified-by:` line for whoever checked the *result*. Add four rows to the rationalization table and update the
Quick reference row. Mirror the change into `SKILL.ja.md`,
`skills/writing-adrs/AGENTS.md`, and the `writing-adrs` section of the root
`AGENTS.md`. Plugin version 2.9.0 → 2.10.0.

## Reason

The core of the added text:

```markdown
**Tool-run checks (compiler, build, tests, linter, type checker): the
command and its full output.** Paste the log in a fenced block exactly as
printed — every warning, not just the last `Finished`/`ok` line. [...]
A long log goes inside a `<details>` block, still complete.

**Checks a person makes (UI, UX, behavior on a real device): what was
checked, and a signature.**

- Dark-mode toggle on the settings screen; sidebar contrast readable.
  Verified-by: wanyaldee (human), 2026-10-13

[...] An agent signs only checks it ran itself: when a human did the
check and the agent only heard about it, the human's name goes on the
`Verified-by:` line, not the agent's. A check nobody did is listed under
**Not verified**, never left unsigned.

**Review by another model is supporting evidence, not verification.** [...]
record it as `Reviewed-by: <model>`, but do not count it as a check of the
behavior.
```

- **The split depends on who ran the check, not on what kind of check it
  is.** A tool run already has its own record (the log), so the evidence is
  the log. A human check leaves no record apart from the person's word, so
  the evidence is the person's name. One rule ("sign everything") would
  have agents signing compiler output that already proves itself, while
  human checks still had nothing behind them.
- **The rule says "full output", with no permission to trim.** In the
  baseline (see Verification), the agent cut the `cargo build` log down to
  "succeeded (`Finished …`) with 1 warning". That is exactly the summary
  the user wants to stop. `<details>` is the escape hatch for long logs
  because it keeps the complete text in the document. A "trim if long"
  clause would have reopened the negotiation that `superpowers:writing-skills`
  warns nuance clauses cause.
- **The signature is a `Verified-by:` trailer, not prose.** The baseline
  agent already credited the user ("wanyaldee … said in chat: 'looks
  fine'"), but as narrative with no date and nothing that reads as taking
  responsibility. A fixed trailer, `name (human|model), YYYY-MM-DD`, can be
  grepped, matches the `Co-Authored-By:` habit from git, and puts the
  committer and the verifier side by side the way the user described. The
  `(human)` / `(AI agent)` tag stops a model's name from passing as a
  person's.
- **"An agent signs only checks it ran itself."** In the realistic failure
  case, the agent writes the ADR and the human did the UI check. Without
  this line the agent could sign on the human's behalf, or leave out the
  signature because it was not the one verifying.
- **`Reviewed-by:` is a separate trailer from `Verified-by:`.** The user's
  point is that cross-model checking helps but guarantees nothing. A
  separate trailer keeps the review in the record without letting it stand
  in for a check of the behavior. The sentence "That holds for human
  reviewers too" carries the user's comparison to how people work.

- **Operations get their own record shape, separate from checks.** In the
  operations baseline (see Verification), the agent pasted the logs of
  `sudo systemctl stop`, the `ALTER`, and an 18,231-row `UPDATE` into the
  same list as `pytest`, as if they were checks. They are actions that
  someone may have to trace or undo, so they need a target and an intent
  that a check does not.
- **The intent is written as the result the operation should produce**
  ("every existing row gets a non-NULL value"), not as a purpose ("for
  the admin page"). Only a result can be compared against: the verifier
  runs `SELECT COUNT(*) … IS NULL` and either gets 0 or does not. A
  purpose can't be checked that way.
- **"`Query OK` or exit 0 only shows the command ran."** Without this line,
  the success line of a migration is the easiest thing to treat as its
  verification, and it is also the thing least able to show that the data
  is right.

## Alternatives rejected

- Keep logs in separate files under `docs/adr/logs/` and link them: logs
  drift from the ADR, and a link that dies takes the evidence with it. The
  user asked for the log in the document.
- GPG-signed ADR commits instead of a text signature: this proves who
  committed, not who looked at the UI. It is the git record the user said
  is not enough on its own.
- A separate seventh ADR section for operations: the six-section format
  is what the whole skill (and 18 existing ADRs) is built around, and an
  operation record is evidence of the same kind the Verification section
  already holds.
- Require a second model's review as part of Verification: the user said
  this is not reliably effective, so making it a requirement would add
  ceremony that looks like assurance.

## Consequences

- ADRs get longer: full build/test logs can add tens to hundreds of lines.
  `<details>` keeps them readable on GitHub.
- A UI change with no human check now visibly lands under **Not verified**
  instead of being hidden in prose. That is the intent.
- The signature is a text line, so anyone with write access can edit it.
  As the user said, it gives a baseline of trust, not tamper-proofing.
- Existing ADRs 0001–0018 were not rewritten to the new format.

## Verification

Tool-run checks (run by the agent), confirming that the AGENTS.md copies
match SKILL.md from `### Verification` to the end:

```
$ diff <(sed -n '/^### Verification/,$p' skills/writing-adrs/SKILL.md) <(sed -n '/^### Verification/,$p' skills/writing-adrs/AGENTS.md) && echo FRAGMENT-IDENTICAL
FRAGMENT-IDENTICAL
$ diff <(sed -n '/^### Verification/,$p' skills/writing-adrs/SKILL.md | sed 's/^#/##/') <(sed -n '/^#### Verification/,/^## Injection/p' AGENTS.md)
75a76,79
> 
> ---
> 
> ## Injection vigilance (injection-vigilance)
```

After the operations addition, the same two commands were re-run:

```
$ diff <(sed -n '/^### Verification/,$p' skills/writing-adrs/SKILL.md) <(sed -n '/^### Verification/,$p' skills/writing-adrs/AGENTS.md) && echo FRAGMENT-IDENTICAL
FRAGMENT-IDENTICAL
$ diff <(sed -n '/^### Verification/,$p' skills/writing-adrs/SKILL.md | sed 's/^#/##/') <(sed -n '/^#### Verification/,/^## Injection/p' AGENTS.md)
105a106,109
> 
> ---
> 
> ## Injection vigilance (injection-vigilance)
```

(The second diff's only difference is the separator and the next section's
heading, which the range includes as its end marker.)

Subagent tests (single-shot Sonnet subagents, one rep each, following the
lighter testing tier `superpowers:writing-skills` allows for
technique/reference skills, as in ADR 0014):

- **Baseline (skill before this change)**: Rust/Tauri dark-mode scenario
  with a `cargo build` log carrying one warning, a user's "looks fine" in
  chat, and a reviewer subagent's LGTM. Output: build log summarized to one
  line ("succeeded … with 1 warning"); UI check written as "wanyaldee
  launched the app … and said in chat", with no signature or date. Confirms
  both target failures are real.
- **Green, same scenario**: full `cargo build` log pasted with the warning;
  `Verified-by: wanyaldee (human), 2026-10-13`; reviewer recorded as
  `Reviewed-by:` labeled "supporting evidence, not a check of behavior".
- **Green, novel scenario** (Django CSV export, `mypy` + `pytest` logs, a
  teammate's phone/Excel check, GPT-6 cross-review): both logs in full,
  including the mypy `note:` and the pytest `RuntimeWarning`; the
  teammate's check signed with the teammate's handle and the date of
  *their* check (2026-10-12, not the day of writing); the agent signed only its own two commands; both
  model reviews under `Reviewed-by:`, with the self-review noted as not
  independent.

Operations addition, same tiers:

- **Baseline (skill with the log/signature rules, before the operations
  rule)**: MariaDB `last_login_at` migration on staging (`sudo systemctl
  stop`/`start`, `ALTER`, an 18,231-row backfill `UPDATE`, `pytest`, the
  user's "login works"). Logs were pasted in full, but the four
  state-changing commands sat in the same list as `pytest`, as tool-run
  checks. None had its intent next to it, and nobody was recorded as
  checking the backfill's result. Confirms the gap.
- **Green, same scenario**: four separate Operation records (intent,
  target, run-by, full log; `(no output, exit 0)` for the `systemctl`
  calls). The backfill was not signed on the basis of `Query OK` and went
  under Not verified for want of a NULL count. The user's login check was
  kept as a person's check and not used to sign the backfill.
- **Green, novel scenario** (production file move: `sudo rsync`, `sudo
  chown -R`, a 4,127-row `psql` `UPDATE`, `sudo systemctl reload nginx`
  with a deprecation warning, a colleague's 5-file browser check): four
  Operation records, with the nginx warning in full. Every operation was
  marked unverified and listed under Not verified. The colleague's check
  was signed with the colleague's handle and date, and noted as unable to
  prove the `UPDATE`, because the old directory still serves files. The
  agent added a follow-up: a person runs the count query and signs
  before the old directory is deleted.

Verified-by: Claude Opus 5.5 (AI agent), 2026-10-13 (diffs and subagent tests above)

Checks a person made:

- Read the new rules and this ADR against the original request; they
  broadly match the intent ("概ね私の意図に沿っている").
  Verified-by: Wanyaldee (human), 2026-10-13

**Not verified**: the user's sign-off is "broadly", not item-by-item;
no specific wording was confirmed or flagged. The
tests were single-rep and without pressure, so a skill under deadline
pressure ("keep it short") was tested only through the scenario's own
wording.
