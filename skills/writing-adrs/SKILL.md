---
name: writing-adrs
description: Use when writing an Architecture Decision Record (ADR) for a change that just landed or is about to land — a new feature, an architectural choice, a dependency added, a schema change, anything a future reader would ask "why is it like this?" — or when reviewing a draft ADR whose Reason section is vague or omits the actual code. Especially relevant for AI-assisted or AI-generated code, where the author must be able to explain the code well enough to take responsibility for it.
---

# Writing ADRs

An ADR records why code exists, not just what it does. Six sections, in this
order: **Context, Decision, Reason, Alternatives rejected, Consequences,
Verification.** Reason is the section people skip or fake — most of this
skill is about that one.

## When to write one

- After completing non-trivial work: new feature, architectural choice,
  dependency added, schema change, anything a future reader would ask "why is
  it like this?"
- Trivial fixes (typo, obvious one-liner) need none.
- File as `docs/adr/NNNN-title.md`, numbered sequentially from the highest
  existing number (create the directory if none exists). If the repo already
  splits ADRs into `docs/adr/en/` + `docs/adr/ja/` with cross-links, follow
  that split; otherwise a single file is fine.

## The six sections

### Context

What situation or problem led to this work. What was true before, what
question was open.

### Decision

What was actually done, in enough shape that a reader knows the mechanism
without reading the diff.

### Reason — why this code, specifically

Not a restatement of Decision. Decision says *what* was done; Reason says
*why it looks like this and not some other way that would also have
"worked."*

**Required: paste the actual code** (or the load-bearing excerpt) in a
fenced block, then explain the choices in it — specific values, algorithm,
ordering, library — against what a reader would naturally question about
each one. Prose that only names identifiers (`the retry loop`, `the timeout
value`) without showing the code makes the reader reconstruct the thing
being justified before they can judge the justification.

**Anti-pattern — vague explanation.** These phrases are banned from a Reason
section because they would justify almost any implementation, not this one:

- "for reliability" / "for better performance" / "for robustness"
- "to handle edge cases" / "for better UX"
- "this is the standard/best-practice way to do it"

Each is a placeholder for a reason, not a reason. Test: could this sentence
be pasted into a *different* PR with *different* code and still sound right?
If yes, it explains nothing about this code.

**Why this bar exists:** AI assistance has made writing code nearly free. It
has not made *understanding* code free. A change nobody involved can explain
is a change nobody can safely modify, debug, or take responsibility for
later — including the author, months on. The Reason section is where that
understanding gets forced into words, with the code sitting next to the
explanation so the two can be checked against each other.

**Bad** (correct-sounding prose, no code — the common failure mode):

> Reason: `requests.get` can fail transiently on flaky networks, and a
> bounded loop with exponential backoff smooths over that without hammering
> the server.

**Good** (same underlying reasoning, code included, one line per literal
choice):

```python
def fetch_with_retry(url, max_attempts=5):
    for attempt in range(max_attempts):
        try:
            return requests.get(url, timeout=5)
        except requests.RequestException:
            if attempt == max_attempts - 1:
                raise
            time.sleep(2 ** attempt)
```

- `except requests.RequestException`, not bare `except`: scoped to
  network/HTTP failures only, so a bug in caller code doesn't get silently
  retried too.
- `2 ** attempt` backoff, not a fixed delay: a fixed 1s delay across five
  attempts hammers a struggling server at a constant rate; exponential caps
  total wait near 31s while backing off harder each time.
- `max_attempts=5`, not unbounded: a dead endpoint fails in ~31s instead of
  retrying forever.
- last-attempt `raise`, not swallow-and-return-`None`: a caller checking the
  return value for `None` would mistake a real outage for an empty result.

### Alternatives rejected

One line each, with the specific reason it was rejected. "Considered X" with
no reason is not an entry.

### Consequences

What this makes easier or harder going forward. Known ceilings, including
anything shipped as a deliberate shortcut and left for later.

### Verification

What was actually run to confirm this works — and what was *not* verified.
"Not run end-to-end because X" is a valid, useful line, not a confession.

Each entry has one of two shapes:

**Tool-run checks (compiler, build, tests, linter, type checker): the
command and its full output.** Paste the log in a fenced block exactly as
printed — every warning, not just the last `Finished`/`ok` line. A summary
like "`cargo build`: passed, 1 warning" is a claim; the log is the evidence,
and the trimmed-away warning is often what a later reader is looking for. A
long log goes inside a `<details>` block, still complete.

````markdown
`cargo build --release`:

```
   Compiling app v0.3.1 (/work/app/src-tauri)
warning: unused variable: `theme_prev`
  --> src/settings.rs:42:9
...
    Finished `release` profile [optimized] target(s) in 41.87s
```
````

(`...` here only shortens this example; in an ADR, paste every line.)

**Checks a person makes (UI, UX, behavior on a real device): what was
checked, and a signature.**

```markdown
- Dark-mode toggle on the settings screen; sidebar contrast readable.
  Verified-by: wanyaldee (human), 2026-10-13
```

The signature names who answers for this check if it turns out wrong. Git
records who *committed*; only the ADR records who *verified*. When the
committer and the verifier are the same person on record, the pair gives a
baseline of trust — both can be forged, but forging them takes deliberate
effort. An agent signs only checks it ran itself: when a human did the
check and the agent only heard about it, the human's name goes on the
`Verified-by:` line, not the agent's. A check nobody did is listed under
**Not verified**, never left unsigned.

**Operations that change state (database writes and migrations, anything
run with `sudo`, deploys, service restarts): a record per operation.** These
are not checks — they are actions someone will need to trace or undo later.
Each one gets its intent, its target, the full log, and who verified the
result:

````markdown
- **Operation:** backfill `last_login_at` for existing users
  **Intent:** every existing row gets a non-NULL approximate value, so the
  admin page isn't blank for them
  **Target:** staging, `appdb`
  **Run by:** Claude Sonnet 5.5 (AI agent), 2026-10-13

  ```
  $ mysql -u admin -p appdb -e "UPDATE users SET last_login_at = updated_at WHERE last_login_at IS NULL;"
  Query OK, 18231 rows affected (2.17 sec)
  Rows matched: 18231  Changed: 18231  Warnings: 0
  ```

  Verified-by: wanyaldee (human), 2026-10-13 — `SELECT COUNT(*) FROM users
  WHERE last_login_at IS NULL` returned 0
````

Write the intent as the result the operation should produce, so the
verifier has something to compare against. The verifier checks that
result — "`Query OK`" or exit 0 only shows the command ran. A command with
no output is recorded as `(no output, exit 0)`. An operation whose result
nobody checked is listed under **Not verified**.

**Review by another model is supporting evidence, not verification.** Have
a second model (or agent) review the change if you like, and record it as
`Reviewed-by: <model>`, but do not count it as a check of the behavior.
Models share blind spots, just as two reviewers from the same team share
assumptions — a second reviewer raises confidence without replacing someone
looking at what the code actually does. That holds for human reviewers too.

## Rationalization table

| Excuse | Reality |
|---|---|
| "I already explained it in prose, code would be redundant" | Prose paraphrases; code is the actual claim being explained. The reader needs both, side by side, to check one against the other — this is the single most common way a Reason section still reads as vague even when the author wasn't being lazy. |
| "The Decision section already shows the diff" | Decision says what was done; Reason sits next to the code and justifies each part of it. Splitting them means the reader loses the code by the time they reach the justification. |
| "It's obviously the standard pattern, doesn't need justifying" | If it's standard, say so in one line, then name the one non-obvious choice (a specific timeout, a specific ordering). Ten seconds of work, worth far more than "standard pattern." |
| "The AI wrote it correctly, I don't need to re-derive why" | Correctness and understanding are different things. Unable to explain it now means unable to safely change it later, and unable to take responsibility for it today. |
| "This is a small change" | Small and self-explanatory doesn't need an ADR at all (see When to write one). If it earned an ADR, it earned a real Reason section. |
| "The build passed, the last line is enough" | The lines above `Finished` are where the warnings are. Paste the whole log; the reader decides what matters. |
| "The user said it looks fine, I'll note that" | Then the user verified it: put their name and the date on a `Verified-by:` line. Prose such as "the user confirmed" doesn't say who is accountable. |
| "The migration printed `Query OK`, that's the verification" | That shows the statement ran, not that the data is now what the intent says. Someone checks the result, and signs. |
| "Another model reviewed it, so it's verified" | That's a review, not a check of the behavior. Record it as `Reviewed-by:` and keep the actual check (or its absence) separate. |

## Quick reference

| Section | Answers |
|---|---|
| Context | What was true before; what question was open |
| Decision | What was done, and its shape |
| Reason | Why *this* code — code included, choice-by-choice |
| Alternatives rejected | What else was considered, and why not, one line each |
| Consequences | What gets easier/harder; known ceilings |
| Verification | Full logs for tool runs; a signature on checks a person made; intent + log + verifier for each DB/sudo/deploy operation; what wasn't verified |
