# 0021: install.sh for non-Claude-Code agents (Agent Skills first, AGENTS.md fallback)

(日本語: [0021-install-script-for-other-agents.ja.md](../ja/0021-install-script-for-other-agents.ja.md))

## Context

The user asked (2026-10-23) whether other agents could get a shell script
that asks which agent is in use and installs accordingly, instead of the
v2.9.0 instructions (ADR 0017): clone the repo, then copy an `AGENTS.md`
by hand.

ADR 0017 assumed that agents other than Claude Code have no on-demand
loading mechanism and only read `AGENTS.md` passively. By 2026-10 that was
no longer true. Official docs checked in this session:

- Codex CLI reads skills from `$HOME/.agents/skills`, repo `.agents/skills`
  and `/etc/codex/skills`, with `name`/`description` frontmatter and
  progressive disclosure. Its `AGENTS.md` loading stops at
  `project_doc_max_bytes`, 32 KiB by default.
- Cursor reads `.agents/skills`, `.cursor/skills`, `~/.agents/skills` and
  `~/.cursor/skills`.
- Gemini CLI reads `~/.gemini/skills` or the `~/.agents/skills` alias, and
  workspace `.gemini/skills` or `.agents/skills`.
- GitHub Copilot reads `~/.copilot/skills` and repo `.github/skills`. This
  comes from Microsoft's Visual Studio docs, as reported by a search
  summary (medium confidence).

The root `AGENTS.md` was 31,567 bytes before this change, just under Codex's
32,768-byte limit. Appending it to a project that already had an
`AGENTS.md` would get the tail truncated.

The user chose, when asked: Agent Skills where supported with AGENTS.md as
fallback, and the home directory by default with `--project DIR` as an
option.

## Decision

Added `install.sh` (POSIX sh) at the repo root. Agents are picked from an
interactive menu or with `--agent codex,cursor,gemini,copilot,agents-md`.
`--project DIR` switches the target from the home directory to a
repository. `--dry-run` lists the files without writing. A confirmation
prompt appears unless `--yes` is given.

The script installs `fable-coding`, `writing-adrs`, `injection-vigilance`
and `dev-philosophy`, the same four skills ADR 0017 chose. They go in as
`<dir>/<name>/SKILL.md`, where `<dir>` is `.agents/skills` for
Codex/Cursor/Gemini and `.copilot/skills` (user) or `.github/skills`
(project) for Copilot. `agents-md` requires `--project`. It writes the root
`AGENTS.md` into `DIR/AGENTS.md` between
`<!-- wanyaldee-skills:begin/end -->` markers, so re-running replaces the
block instead of adding a second copy.

Also: a README usage section, step 2 of the root `AGENTS.md`'s "Using this
in another project", and `plugin.json` 2.12.0.

## Reason

```sh
case "$a" in
    codex|cursor|gemini) add_target "$BASE/.agents/skills" ;;
    copilot)
        if [ -n "$PROJECT" ]; then add_target "$BASE/.github/skills"
        else add_target "$HOME/.copilot/skills"; fi ;;
```

- **One shared `.agents/skills`, not `~/.codex/skills`/`~/.cursor/skills`/
  `~/.gemini/skills` each**: all three agents read `.agents/skills`, and
  Cursor and Gemini also read their own folder. Writing to both would give
  Cursor two `fable-coding` skills. `add_target` dedupes, so picking all
  three writes one copy.
- **Copilot gets its own folder**: `.agents/skills` support for Copilot
  appeared only in a mirror of the CLI docs. `.github/skills` and
  `~/.copilot/skills` are the paths Microsoft documents.

```sh
render_skill() {
    awk 'NR==1 && $0=="---" {fm=1; print; next} fm {print; if ($0=="---") exit}' \
        "$REPO/skills/$1/SKILL.md"
    echo
    awk '
        NR==1 { sub(/ — AGENTS\.md (fragment|断片)$/, ""); print; next }
        state==0 && /^>/ { state=1; next }
        state==1 && /^>/ { next }
        state==1 { state=2; if ($0=="") next }
        { print }
    ' "$REPO/skills/$1/AGENTS.md"
}
```

- **Frontmatter from `SKILL.md`, body from the `AGENTS.md` fragment, not
  `SKILL.md` copied as-is**: `SKILL.md` contains Claude-only syntax
  (`REQUIRED SUB-SKILL: Use wanyaldee-skills:writing-adrs`, "the harness
  already stops for", `CLAUDE.md` as the only config file). The fragments
  already generalized exactly those spots in ADR 0017. Reusing them means
  no new set of substitutions has to stay in sync with every future
  `SKILL.md` edit.
- **The first blockquote and the title suffix are dropped**: every fragment
  opens with `> Standalone AGENTS.md copy ... see [SKILL.md](SKILL.md)`,
  and the relative links in it break outside this repo. Only the first
  contiguous `>` block is removed (`state` 0→1→2), so later blockquotes in
  the body stay.

```sh
install_file() {
    if [ -f "$1" ]; then
        if cmp -s "$1" "$2"; then echo "  unchanged $1"; return; fi
        cp "$1" "$1.bak.$STAMP"
    fi
```

- **The backup is `SKILL.md.bak.<stamp>`, not a renamed folder**: a folder
  such as `fable-coding.bak.<stamp>/` that still held a `SKILL.md` would be
  discovered as a second skill. A file not named `SKILL.md` is ignored.
- **`cmp -s` skips identical files**: re-running is a no-op and leaves no
  pile of `.bak` files.
- **No `rm` anywhere**: overwriting with `cp` is enough, and it keeps the
  script clear of this package's own `rm -rf` hook (ADR 0016).

```sh
[ "$size" -le 32768 ] || echo "  warning: $dest is $size bytes; Codex truncates past 32768 by default ..."
```

- Warn instead of refusing in `agents-md` mode: the target agent might not
  be Codex, and agents have no shared limit. The warning tells the reader
  how to avoid truncation: use `--agent codex` (skills).

## Alternatives rejected

- **`AGENTS.md` per agent only (GEMINI.md, `.cursor/rules/*.mdc`,
  `copilot-instructions.md`)**: rejected by the user. The guidance would
  stay always-loaded, and it does not fix the 32 KiB truncation.
- **Install all seven skills**: `memory-*` and `remote-config-sync` depend
  on Claude Code mechanisms, as in ADR 0017.
- **`curl | sh` without cloning**: the script needs the skill files next to
  it, and piping unread remote code into a shell goes against the
  package's injection-vigilance stance.
- **A Claude Code mode in the script**: the plugin already installs it.
  Menu choice 6 only prints the `/plugin` commands.

## Consequences

- Skills installed this way are a snapshot. After `git pull`, re-run
  `install.sh`. Unchanged files are skipped; changed ones are backed up.
- The per-agent paths are from documentation as of 2026-10-23. If an agent
  moves its folder, only the `case` block needs to change.
- The README and root `AGENTS.md` now mention `install.sh`. The root
  `AGENTS.md` grew to 31,735 bytes, still under 32 KiB on its own.
- No uninstall mode. Removal means deleting the four folders by hand. Not
  added because nobody asked for it (YAGNI).

## Verification

`shellcheck install.sh` (via `uvx --from shellcheck-py`): no output, exit 0.

End-to-end run against a temporary `HOME` (`$T` = a scratch directory, with
`proj/AGENTS.md` pre-seeded as `# existing\nkeep me`). The trace is from
`set -x`; lines from the shell's `grep` wrapper function are removed.
Everything else is as printed:

<details>
<summary>log</summary>

```
++ HOME=$T/home
++ /home/ko200/wanyaldee-skills/install.sh --agent codex,cursor,gemini,copilot --yes
Will write:
  $T/home/.agents/skills/fable-coding/SKILL.md
  $T/home/.agents/skills/writing-adrs/SKILL.md
  $T/home/.agents/skills/injection-vigilance/SKILL.md
  $T/home/.agents/skills/dev-philosophy/SKILL.md
  $T/home/.copilot/skills/fable-coding/SKILL.md
  $T/home/.copilot/skills/writing-adrs/SKILL.md
  $T/home/.copilot/skills/injection-vigilance/SKILL.md
  $T/home/.copilot/skills/dev-philosophy/SKILL.md
Existing files that differ are kept as <file>.bak.20261023095259.
  wrote     $T/home/.agents/skills/fable-coding/SKILL.md
  wrote     $T/home/.agents/skills/writing-adrs/SKILL.md
  wrote     $T/home/.agents/skills/injection-vigilance/SKILL.md
  wrote     $T/home/.agents/skills/dev-philosophy/SKILL.md
  wrote     $T/home/.copilot/skills/fable-coding/SKILL.md
  wrote     $T/home/.copilot/skills/writing-adrs/SKILL.md
  wrote     $T/home/.copilot/skills/injection-vigilance/SKILL.md
  wrote     $T/home/.copilot/skills/dev-philosophy/SKILL.md
Done. Restart the agent if the skills don't appear.
++ echo exit=0
exit=0
++ HOME=$T/home
++ /home/ko200/wanyaldee-skills/install.sh --agent codex --yes
++ grep -c unchanged
4
++ HOME=$T/home
++ /home/ko200/wanyaldee-skills/install.sh --agent agents-md --project proj --yes
Will write:
  $T/proj/AGENTS.md  (wanyaldee-skills block, replaced on re-run)
Existing files that differ are kept as <file>.bak.20261023095259.
  wrote     $T/proj/AGENTS.md
Done. Restart the agent if the skills don't appear.
++ echo exit=0
exit=0
++ HOME=$T/home
++ tail -2
++ /home/ko200/wanyaldee-skills/install.sh --agent agents-md --project proj --yes
  unchanged $T/proj/AGENTS.md
Done. Restart the agent if the skills don't appear.
++ grep -c wanyaldee-skills:begin proj/AGENTS.md
1
++ head -2 proj/AGENTS.md
# existing
keep me
++ HOME=$T/home
++ /home/ko200/wanyaldee-skills/install.sh --agent agents-md --yes
install.sh: agents-md needs --project (there is no shared user-level AGENTS.md path)
++ echo exit=1
exit=1
```

</details>

The shell's `grep` is a wrapper function around ugrep. The leftover-syntax
check was rerun with `/usr/bin/grep` and a positive control:

```
$ /usr/bin/grep -rn 'wanyaldee-skills:\|REQUIRED SUB-SKILL\|AGENTS.md fragment\|断片' home/.agents home/.copilot; echo "leftover-grep exit=$?"
leftover-grep exit=1
$ /usr/bin/grep -rln '^name: \(fable-coding\|writing-adrs\|injection-vigilance\|dev-philosophy\)$' home/.agents home/.copilot | wc -l
8
$ /usr/bin/grep -c 'wanyaldee-skills:begin' proj/AGENTS.md
1
$ wc -c < proj/AGENTS.md
31816
```

An earlier run in the same session also checked the non-terminal refusal:
`--agent codex </dev/null` printed
`install.sh: refusing to write without a terminal; pass --yes`, exit 1.
An unknown agent printed `install.sh: unknown agent: foo`, exit 1.

Verified-by: Claude Opus 5.5 (AI agent), 2026-10-23 (shellcheck and runs above)

**Not verified**:

- No real Codex CLI, Cursor, Gemini CLI or Copilot was run, so it is not
  confirmed that any of them lists or triggers the installed skills. The
  folder paths come from docs only.
- The interactive menu was not driven from a real terminal in this session.
  Only the `--agent` path ran.
- The script ran under `dash` and the `/bin/sh` it was launched with. It
  was not run on macOS (BSD `awk`/`cmp`).
