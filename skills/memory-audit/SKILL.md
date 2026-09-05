---
name: memory-audit
description: Use when the user says "/memory-audit", "audit memories", "メモリ監査", "check my memories", or asks what's stale or wrong in memory. Report-only by default.
---

# Memory audit

Sweep every project's memory directory, grade each file against
[[memory-discipline]], and report — most severe first. Do not modify
anything unless invoked with `--fix`, and even then apply only the
mechanical repairs listed at the bottom.

## Procedure

1. **Enumerate.** `ls -d ~/.claude/projects/*/memory` — for each directory,
   read `MEMORY.md` and every other `*.md` in full. They are small; read all
   of them, don't sample.

2. **Index integrity.** Diff the file list against the index: every memory
   file needs exactly one `MEMORY.md` line, and every index line a file.
   Unindexed = never recalled; dangling = recall promising a 404.

3. **Attribution.** For each file, note `origin:` if present. If only
   `originSessionId` exists, try to resolve the model:
   `grep -o '"model":"[^"]*"' ~/.claude/projects/*/<sessionId>.jsonl | sort | uniq -c`
   (quote the glob path carefully — project dirs start with `-`, so prefix
   `./` or `--` when globbing). A purged transcript = lost provenance; flag
   it, and record the resolution while it's still possible.

4. **Per-file checks**, in severity order:
   - **Contradicted:** a claim you can cheaply verify against current state
     (a repo's visibility, a file's existence, a version, a "pending"
     decision since resolved) that is now false.
   - **Repo duplication:** body restates a document the project already has
     (the giveaway: it links to its own source-of-truth). Should be pointer
     + delta.
   - **Unindexed / dangling** (from step 2).
   - **Mixed volatility:** durable setup facts and current-status in one
     file — flag the split point.
   - **Format:** missing Why/How on feedback/project types, non-kebab name,
     `type` outside `metadata:`, relative dates, missing `origin`.

5. **Report.** Group by project, one line per finding: file, defect, the
   fix. Lead with a one-paragraph verdict (worst finding + overall health).
   Note per-model patterns only if attribution actually shows one. End with
   the fix list split into *mechanical* vs *needs the user's judgment*.

## --fix (mechanical repairs only)

Allowed: add missing index lines; remove dangling index lines; backfill
`origin:` where step 3 resolved it; convert relative dates when context
pins the absolute one. Everything else — deleting stale memories, shrinking
dumps to pointers, splitting files — is judgment: list it, don't do it.
Never touch memory content under `--fix` beyond frontmatter and dates.
