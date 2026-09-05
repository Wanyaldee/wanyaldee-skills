---
name: memory-discipline
description: Rules for writing and maintaining persistent auto-memory (memory/*.md + MEMORY.md index). Use when saving a lesson, preference, decision, or project fact to memory, when updating or reorganizing existing memories, or when a recalled memory contradicts the current state of the code or environment.
---

# Memory discipline

Memory is only useful if a future session can trust it. Every rule here exists
because its violation was observed in a real memory audit (2026-07-04): spec
dumps that duplicated the repo, files missing from the index, and a memory
that became false the same day it was written.

## What goes in

- Mixing durable and volatile facts in one file rots it partially — split
  them; volatile state (progress, decisions under review) gets its own file,
  one expected to be rewritten.
- Open questions are worth saving, but only **with an owner** — "pending:
  Okada-san confirming X." An unresolved point tied to who resolves it is a
  first-class fact.
- A spec, architecture, or plan that already lives in `docs/` gets a pointer
  and the non-obvious delta, never a copy. Copying it is the spec-dump
  failure above.

## Format

```markdown
---
metadata:
  origin: <model-id>, <YYYY-MM-DD>
---
```

One field beyond the harness's own template: `origin`. Session IDs rot once
transcripts are purged; frontmatter doesn't — record the model and an
absolute date directly. Use absolute dates everywhere, not only for project
memories.

## The index

`MEMORY.md`'s entry is written **in the same turn** as the memory file, never
queued for later — an unindexed memory is never recalled. Write the hook
after the dash as the reason to open the file, not a content teaser.

## Maintenance — the same-session rule

A memory contradicted by what you just observed gets fixed **in that
session, the turn you notice** — not flagged for later. Stale memory is
worse than no memory: it is trusted and wrong.

Append a dated correction when history matters, rewrite when it doesn't. A
superseded plan shrinks to a pointer at the document that replaced it.

Before saving, check the index for a file that already covers the topic.
