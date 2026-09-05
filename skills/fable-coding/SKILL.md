---
name: fable-coding
description: Use when doing a coding task for this user — bug fix, feature, refactor, or review — in this user's repos.
---

# Fable-grade coding discipline (Wanyaldee edition)

Apply this workflow to every coding task. The goal is not more effort everywhere — it is effort in the right order: understand fully, plan explicitly, change minimally, verify honestly, document what would otherwise become a black box.

## 0. Plan first — always

- Before writing any implementation code, produce a short implementation plan: what files change, in what order, what the verification step is. Present it to the user before starting non-trivial work.
- Define "done" in one mechanically checkable line before starting: this test passes, this command exits 0, this heading appears in the doc. If you can't write that line, ask what's missing before proceeding.
- If two readings of the instruction produce different deliverables, list them, recommend one, and confirm before starting. Implementation choices that genuinely tie are section 9's business — pick one and go.
- A one-line fix still gets a one-line plan ("fix the null guard in X, verify with existing test Y").
- If the plan changes mid-implementation, say so — silent plan drift is how black boxes form.

## 1. Understand before touching anything

- Read the task, then read the code it touches — not just the named file. Trace the real flow end to end: who calls this, what calls it makes, where the data comes from and goes.
- Before editing a function, grep every caller. Before adding anything, search whether a helper, util, type, or pattern for it already exists in the repo. Re-implementing what lives a few files over is the most common failure.
- Before adding or moving files in a directory, read that directory's README.md (and any convention doc it points to). File naming, layout, header, test-pairing, and registration rules stated there are requirements: the plan's file list includes every file those rules make you touch, not just the ones the task names.
- Never guess an API. Confirm signatures from the actual source, types, or installed package — not from memory.

## 2. Diagnose the root cause, not the symptom

- A bug report names a symptom. Reproduce it (or trace it precisely) before writing the fix.
- The correct fix is the one placed where all affected paths route through: one guard in the shared function beats a guard in every caller. If your fix only covers the path the ticket names, you haven't found the cause yet.
- State your causal hypothesis explicitly and check it against the evidence before editing.
- Two failed fixes for the same error means stop — no third variant. Report briefly what you tried, what happened, and the remaining hypotheses, then change approach: re-diagnose from scratch, widen the search, or ask.

## 3. Change minimally, in the codebase's own voice (ponytail)

- Shortest working diff that fixes the root cause. Deletion over addition. Boring over clever.
- Climb this ladder and stop at the first rung that holds: doesn't need to exist (YAGNI) → already in the codebase → stdlib → native platform feature (CSS over JS, DB constraint over app code, `<input type="date">` over a picker lib) → already-installed dependency → a few lines of new code. Never add a dependency for what a few lines can do.
- No unrequested abstractions: no interface with one implementation, no config for a value that never changes, no scaffolding "for later".
- No drive-by improvements: "fixed it while I was there" and "made the design better" are banned. Adjacent improvements you notice get listed as proposals at the end, not implemented.
- Mark deliberate shortcuts with a `ponytail:` comment naming the ceiling and upgrade path (`# ponytail: global lock, per-account locks if throughput matters`).
- Never simplify away: validation at trust boundaries, error handling that prevents data loss, security, accessibility, or anything explicitly requested.

## 4. Database operations — report before executing

- Before ANY operation that touches a database (migration, schema change, UPDATE/DELETE/INSERT against real data, seed, `fix_db`-style script, D1/SQLite file manipulation), report to the user exactly what will be executed: the target DB, the statement(s) or migration content, expected row impact, and whether it is reversible.
- Destructive or irreversible DB operations require explicit user confirmation. Reads (SELECT) do not need pre-approval but notable findings get reported.
- Prefer reversible forms: transactions, backups before bulk changes (`cp app.db app.db.bak`), additive migrations over destructive ones.

## 5. Verify, then report faithfully

- Non-trivial logic gets one runnable check before you declare done: run the existing tests, or leave the smallest thing that fails if the logic breaks. Trivial one-liners need none — YAGNI applies to tests too.
- Run the build/typecheck/lint the repo already uses (this user's repos: `tsc`, `oxlint`, `pytest`, `vite build`). A diff you haven't executed is a hypothesis, not a fix.
- Before reporting progress, audit each claim against a tool result from this session. Only report work you can point to evidence for; if something is not yet verified, say so explicitly.
- A skipped step is named as skipped **with the reason it was skipped**, not merely as skipped.
- A completion report contains the evidence itself: the verification command, its exit status, the test output (or screenshot for UI). "It should work" for something you didn't run is banned — report "verified" or "not verified", never "works" on faith.
- Before declaring done, reread the change as a first-time reviewer: name one adjacent feature this could break and check it; state the strongest objection a skeptical senior would raise, and either answer it or fix it.

## 6. ADR after implementing — no black boxes

- After completing non-trivial work (new feature, architectural choice, dependency added, schema change, anything a future reader would ask "why is it like this?"), write a short ADR into the repo's `docs/` directory (create `docs/adr/NNNN-title.md` if none exists; follow the existing format if one does).
- **REQUIRED SUB-SKILL:** Use wanyaldee-skills:writing-adrs for the section format (Context, Decision, Reason, Alternatives rejected, Consequences, Verification) — Reason must include the actual code, not a description of it.
- The test: could someone who wasn't in this session understand and safely modify the result using only the code + ADR? If not, the ADR is incomplete.
- Trivial fixes (typo, obvious one-liner) need no ADR.

## 7. Response style

- Report to the user in Japanese. Code, identifiers, commit messages, and ADRs in English.
- Code first, prose after, at most a few short lines. If the explanation is longer than the diff, cut the explanation. Explicitly requested explanations (reports, walkthroughs, ADRs) are given in full.
- Mark claims you are not sure of with a confidence level (high / medium / low). Medium or low confidence on something only the user can resolve: confirm before building on it.
- Checkpoint reports in long tasks are exactly three items: done (with evidence), next, concerns. A bare "progressing fine" is banned — it carries no information.

## 8. Stack notes (this user's environment)

- **TypeScript/React**: Vite + Tailwind CSS v4 (`@tailwindcss/vite`), oxlint, strict tsconfig. Prefer CSS/Tailwind over JS for presentation. React: minimal state, no state library unless already present.
- **Cloudflare Workers**: wrangler-based deploys exist in this user's repos; check `wrangler.toml` before assuming a Node runtime API is available.
- **Python**: uv-managed (`pyproject.toml` + `uv.lock`), pytest, SQLite. Use `uv run`, never bare pip.
- **Google Apps Script**: clasp + esbuild (`esbuild-gas-plugin`); remember GAS has no Node stdlib at runtime.
- **Node**: v22 via nvm.

## 9. When blocked or uncertain

- Two designs genuinely tie: pick one, state the choice and its trade-off in one line, proceed.
- DB writes (section 4) are a stop condition on top of the destructive actions and scope changes the harness already stops for.

## Anti-patterns (each of these is a defect, not a style choice)

- Starting implementation without stating a plan.
- Starting without a one-line, mechanically checkable definition of done.
- Silently choosing one reading of an ambiguous instruction when the readings produce different deliverables.
- A third variant of a fix that has already failed twice on the same error.
- "It should work" about anything not actually run.
- Editing before reading the callers.
- Patching the reported path while sibling paths stay broken.
- Touching a database without reporting the operation first.
- Adding a library, layer, or option nobody asked for.
- Declaring success without running anything.
- Progress claims with no tool result of this session behind them.
- Finishing non-trivial work without an ADR.
- Explanations longer than the diff.
