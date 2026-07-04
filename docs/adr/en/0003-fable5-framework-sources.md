# 0003: Incorporate the two Fable 5 framework sources (official prompting guide + leaked system prompt)

(日本語: [0003-fable5-framework-sources.ja.md](../ja/0003-fable5-framework-sources.ja.md))

## Context

The user supplied two documents describing Claude Fable 5's thinking framework and asked for them to be incorporated into the plugin, split into a separate skill if warranted:

1. Anthropic's official guide *Prompting Claude Fable 5* (`platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5`).
2. The leaked Fable 5 production system prompt from `elder-plinius/CL4R1T4S` (`ANTHROPIC/CLAUDE-FABLE-5.md`).

The two sources have different natures: the official guide mixes (a) behavioral rules Fable 5 follows while working and (b) guidance for people *building on* Fable 5 (effort tuning, scaffolding, tool design, migration). The leaked prompt is mostly consumer-app configuration (file paths, image search, copyright limits) with a small transferable core (tone, formatting minimalism, mistake handling).

## Decision

Split by trigger scope (same reasoning as ADR 0002):

- **Behavioral rules → merged into `skills/fable-coding/SKILL.md`** (v1.4.0): act-when-informed / no overplanning (§0), progress claims audited against tool results (§5), final-summary readability + prose-over-formatting + owning mistakes (§7, the last two from the leaked prompt), assessment-vs-fix boundary + evidence check before state-changing commands + no ending turns on promises (§9), plus four new anti-patterns. These fire on coding tasks, which is where that skill already triggers.
- **Builder-facing guidance → new skill `skills/prompting-fable-5/SKILL.md`**: effort levels, Anthropic's tested snippet blocks kept verbatim, subagent/memory/send_to_user scaffolding, refusal fallback to Opus 4.8, `reasoning_extraction` pitfall, Opus→Fable migration checklist, and a short "default persona" section distilled from the leaked prompt. Fires when writing prompts/agents/skills targeting Fable 5 — a scope the coding skill must not hijack.
- Consumer-app material from the leaked prompt (copyright word limits, image search rules, upload paths, product catalog) was deliberately **not** incorporated: it is claude.ai app configuration, not a coding/thinking framework.

## Alternatives rejected

- **One combined "fable-thinking" skill** — wrong granularity: half the content must fire on every coding task, the other half only when building on Fable 5; a single description can't trigger correctly for both.
- **Copying the official guide wholesale into the coding skill** — most of it (timeouts, send_to_user JSON, API parameters) is irrelevant during a coding task and would dilute the discipline skill.
- **Incorporating the full leaked system prompt** — its bulk is app plumbing; only the transferable behavioral core earns a place.

## Consequences

- Prompt-engineering work for Fable 5 now gets Anthropic's tested wording verbatim instead of from-memory paraphrases.
- The coding skill gains the officially documented anti-fabrication and boundary rules, aligning the emulation with Anthropic's own steering guidance.
- Each English skill ships a human-reference `SKILL.ja.md` translation alongside it; Claude loads only `SKILL.md`, so edits go to the English file first and the translation follows.
- Ceiling: both sources are snapshots (guide fetched 2026-07-04; leaked prompt is community-transcribed and unverified). The leaked-prompt content is marked by provenance in this ADR; if Anthropic revises the guide, `prompting-fable-5` needs a manual refresh.
