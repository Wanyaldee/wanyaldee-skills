---
name: remote-config-sync
description: Explains and troubleshoots the SessionStart hook that pushes this Windows machine's ~/.claude/settings.json to configured WSL distros and SSH hosts. Use when the user asks why remote settings.json is stale, how to add a new WSL/SSH sync target, why a hook/plugin doesn't seem to apply in WSL or over SSH, or wants to run the sync manually.
---

# Remote config sync

This machine (Windows) is the source of truth for `~/.claude/settings.json`.
A `SessionStart` hook (`hooks/hooks.json` in this plugin) runs
`scripts/push-settings.sh` on every session start on this machine. The
script pushes `settings.json` to each configured WSL distro / SSH host,
but only when the remote copy's hash differs from the source — silent
when nothing changed, one Japanese line per target actually updated.

## Scope

Only `settings.json` is synced (hooks, `enabledPlugins`,
`extraKnownMarketplaces`, etc.). `CLAUDE.md` and files under `hooks/` are
out of scope by design (confirmed with the user 2026-08-17) — add them
later only if asked.

## Known limitation

The hook only fires when a Claude Code session *starts on this Windows
machine*. If the user opens Claude Code (or a Zed ACP agent) directly
inside WSL or over SSH without going through this machine first, nothing
pushes — there is no hook running here to trigger it, and the remote side
has no path back to this machine's filesystem. Say this plainly if asked;
don't imply it syncs on the remote side too.

Separately, and more fundamentally: this only matters if the remote WSL
distro / SSH host already has **Claude Code and this `wanyaldee-skills`
plugin installed**. Pushing `settings.json` does not install anything —
it only references `enabledPlugins`/`extraKnownMarketplaces` by name. If
either is missing on the remote, Zed's ACP agent there either won't start
or starts without this package's hooks/skills, silently. Provisioning a
new remote target is a separate manual step this skill does not cover.

## Adding a target

1. Copy `scripts/remote-sync-targets.conf.example` to
   `~/.claude/remote-sync-targets.conf` (not tracked in this repo — it
   names the user's personal hosts).
2. Add one line per target: `wsl:<distro-name>` or `ssh:<host-alias from
   ~/.ssh/config>`.
3. Next session start syncs it. To sync immediately without waiting:
   `sh skills/remote-config-sync/scripts/push-settings.sh` (run from the
   plugin's installed location, or pass the full path).

## Troubleshooting

- No output on session start = either no `remote-sync-targets.conf`, or
  every target's hash already matched. Both are correct, quiet outcomes.
- A target never updates: check `wsl.exe -l -v` for the exact distro name,
  or that the SSH alias resolves (`ssh <alias> true`) without a password
  prompt (the hook has no TTY to answer one — key-based auth only).
- Previous remote `settings.json` is never deleted, only renamed to
  `settings.json.bak.<timestamp>` before overwrite.
