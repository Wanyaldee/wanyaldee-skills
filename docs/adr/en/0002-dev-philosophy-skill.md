# 0002: Package the user's development philosophy as a second skill

(日本語: [0002-dev-philosophy-skill.ja.md](../ja/0002-dev-philosophy-skill.ja.md))

## Context

The plugin so far shipped one skill (`fable-coding`, coding-task discipline) and a credential-deny hook. The user also maintains a development *philosophy* — human-centered/foolproof design, automation boundaries (human-in-the-loop, lean on trusted external services like GAS/Discord), mechanism-over-prompt security, per-domain language choice, spec/ADR content as code comments, MIT licensing — and wanted it to travel with the plugin so any environment that installs `fable-coding` applies it automatically, instead of living in per-machine memory or CLAUDE.md files.

## Decision

Add a second skill `skills/dev-philosophy/SKILL.md` (v1.3.0, extended in 1.3.1–1.3.2). Body is in Japanese (the user's own wording, lightly structured); the frontmatter `description` is in English and written trigger-first, since skill auto-matching runs on the description: it fires on system/architecture/automation/UI-UX design, new projects, and language choice. Sections: 1. Human-Centered & Foolproof, 2. Automation Boundaries, 3. Security & Guardrails, 4. Development & Architecture (language map: Rust for DB, Python for AI/DS/Discord bots, C/C++ for embedded, TypeScript for web; MariaDB/Proxmox; MIT), 5. Instructions for Claude (approval flows, external-service-first proposals).

## Alternatives rejected

- **Auto-memory / CLAUDE.md** — per-machine and per-project; does not travel with the plugin, and the user explicitly prefers mechanism over prompt-file sprawl.
- **Merging into the `fable-coding` skill** — wrong trigger scope: that skill fires on coding tasks; the philosophy must also fire on design/architecture proposals before any code exists.

## Consequences

- Any environment with the plugin gets the philosophy applied on design-shaped tasks with zero setup; updating it is an edit to one SKILL.md plus a version bump.
- The philosophy's "spec/ADR content as code comments" rule deliberately overrides the minimal-comment style of `fable-coding`/ponytail — explicit user rules win over style defaults.
- Human-Centered & Foolproof was placed as section 1 because the existing human-in-the-loop and physical-restriction rules read as concretizations of it.
- Ceiling: skill activation is model-mediated (description matching), not guaranteed on every eligible turn; for hard guarantees a hook would be needed, which this content does not warrant.
