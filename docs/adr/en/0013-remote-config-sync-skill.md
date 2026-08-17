# 0013: Windows-to-WSL/SSH settings.json sync skill

(日本語: [0013-remote-config-sync-skill.ja.md](../ja/0013-remote-config-sync-skill.ja.md))

## Context

The user's main editor is Zed, and they edit through the ACP-based Claude
Agent rather than the bare CLI. The user confirmed (2026-08-17, via a
hook-fire test with a throwaway `UserPromptSubmit` hook) that Zed's
ACP-based Claude Agent reads the same `~/.claude/settings.json` as the CLI
on the same machine — hooks fired identically from both. The open question
that followed: does the same config apply automatically when editing over
WSL or SSH?

It does not, and can't by default: Zed's remote development (SSH) and WSL
integration run the editor's headless server — and therefore the ACP
agent — on the remote/WSL side, which reads *its own* home directory's
`~/.claude/`. Nothing carries the Windows-side config across that boundary
automatically.

## Decision

Add a `remote-config-sync` skill plus a `SessionStart` hook
(`scripts/push-settings.sh`) that:

- Treats this Windows machine as the source of truth for `settings.json`
  only (not `CLAUDE.md`, not the `hooks/` scripts — user chose to scope
  narrowly rather than sync everything).
- Reads a target list from `~/.claude/remote-sync-targets.conf`
  (`wsl:<distro>` / `ssh:<host-alias>` lines), kept outside the repo since
  it names the user's personal hosts.
- Pushes only when the remote's SHA-256 differs from the source — silent
  when nothing changed, one Japanese line per target actually updated
  (user explicitly asked for changes to always be reported).
- Backs up the remote's previous `settings.json` to
  `settings.json.bak.<timestamp>` before overwrite rather than deleting it.

## Alternatives rejected

- **Hook on the remote side instead**, checking staleness against Windows:
  rejected because SSH hosts have no path back to the Windows filesystem
  without pre-configured reverse connectivity, and it would need the
  plugin separately configured on every remote anyway.
- **Sync CLAUDE.md and hooks/ too**: offered to the user, who scoped it to
  `settings.json` only for this pass.
- **Bidirectional sync**: rejected — one-directional push from a single
  source of truth avoids merge-conflict logic the user did not ask for.

## Consequences

- Known ceiling, stated plainly in the skill: the hook only fires when a
  session starts *on this Windows machine*. A session opened directly
  inside WSL or over SSH (bypassing Windows) does not trigger a push —
  there is no hook running there to do it, and no connectivity back even
  if there were.
- `remote-sync-targets.conf` must be created manually per machine
  (`scripts/remote-sync-targets.conf.example` is the template) — this is
  intentional so the shared plugin package carries no personal hostnames.
- Manual invocation remains available:
  `sh skills/remote-config-sync/scripts/push-settings.sh`.
- **Hard dependency, not just a sync gap:** this only helps if the remote
  WSL distro / SSH host already has Claude Code and this
  `wanyaldee-skills` plugin installed. Pushing `settings.json` there does
  nothing on its own — `settings.json` just references
  `enabledPlugins`/`extraKnownMarketplaces` by name; it doesn't install
  anything. If Claude Code or the plugin is missing on the remote, Zed's
  ACP agent on that remote either won't start or will start without this
  skill package's hooks/skills at all, silently. Provisioning Claude Code
  + the plugin on a new remote target remains a separate manual step, not
  covered by this sync.

## Verification

Tooling confirmed present on the user's machine before writing the script:
`sha256sum`, `wsl.exe`, `ssh` all resolve in the Git Bash environment the
hook runs under. Script logic (hash-compare, backup-then-overwrite) was not
run end-to-end against a live WSL/SSH target in this session — the user has
not yet populated `remote-sync-targets.conf`. Verify on first real use by
checking `settings.json.bak.<timestamp>` appears on the target before
trusting the hook silently thereafter.
