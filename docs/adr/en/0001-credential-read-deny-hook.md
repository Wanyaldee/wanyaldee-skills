# 0001: Ship credential-file read blocking as a plugin hook

(日本語: [0001-credential-read-deny-hook.ja.md](../ja/0001-credential-read-deny-hook.ja.md))

## Context

The user wanted .env-style credential files protected from Claude "by mechanism, not by skill text", and wanted that protection to travel with the plugin so installing `fable-coding` applies it automatically. Claude Code plugins cannot ship `permissions.deny` rules — permission rules live only in settings files (user/project/local/managed). Plugins *can* ship hooks, which load automatically when the plugin is enabled.

## Decision

Add a `PreToolUse` hook (matcher `Read`) registered via `hooks/hooks.json` and declared in `.claude-plugin/plugin.json` (`"hooks": "./hooks/hooks.json"`). The hook runs `hooks/deny-secrets.py` (python3, stdlib only), which matches the target `file_path` basename against a fixed deny list (`.env`, `.env.*`, `*.pem`, `id_rsa`, `id_ed25519`, `credentials.json`) plus any path containing `/.aws/`, and returns `permissionDecision: "deny"` on match. Version bumped to 1.2.0.

## Alternatives rejected

- **Ship `permissions.deny` in the plugin** — not supported; plugins have no settings surface.
- **Node script (like the ponytail plugin uses)** — user runs Node via nvm, which is not guaranteed on PATH in non-interactive hook shells; python3 is reliably present on Linux/macOS.
- **Also matching the Bash tool and grepping commands for `.env`** — regex-on-command-text is noisy (false positives on `.env.example` mentions, writes, comments) and still trivially bypassable; settings-level `Read(...)` deny rules already cover Bash better.

## Consequences

- Any machine that installs and enables the plugin gets Read-tool blocking of credential files with zero per-machine setup.
- `.env.example` / `.env.sample` are also blocked (matched by `.env.*`); accepted as the safe side.
- Ceiling (`ponytail:` comment in deny-secrets.py): the hook covers only the Read tool. Bash reads (`cat .env`) and content leaks via Grep output are not covered — for hard coverage, pair with `permissions.deny` `Read(...)` rules in settings (documented in README).
- Windows without python3 on PATH will show a hook error and fail open; add a `commandWindows` variant if Windows support is ever needed.
- The hook fails open on unexpected stdin (harness always sends valid JSON, so this is theoretical).
