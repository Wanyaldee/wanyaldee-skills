#!/bin/sh
# Install the four agent-agnostic skills (fable-coding, writing-adrs,
# injection-vigilance, dev-philosophy) into AI coding agents other than
# Claude Code. Claude Code itself uses the plugin marketplace instead.
#
# Agents that support the Agent Skills standard (SKILL.md folders) get the
# skills as on-demand skills; anything else gets the root AGENTS.md as an
# always-loaded fallback inside a marker block. See ADR 0021.
set -eu

REPO=$(cd "$(dirname "$0")" && pwd)
SKILLS="fable-coding writing-adrs injection-vigilance dev-philosophy"
STAMP=$(date +%Y%m%d%H%M%S)
BEGIN='<!-- wanyaldee-skills:begin -->'
END='<!-- wanyaldee-skills:end -->'

usage() {
    cat <<'EOF'
Usage: ./install.sh [--agent LIST] [--project DIR] [--dry-run] [--yes]

  --agent LIST   comma-separated: codex, cursor, gemini, copilot, agents-md
                 (omit to choose from a menu)
  --project DIR  install into this repository instead of your home directory
                 (required for agents-md)
  --dry-run      show what would be written, change nothing
  --yes          skip the confirmation prompt

Claude Code: use the plugin instead —
  /plugin marketplace add Wanyaldee/wanyaldee-skills
  /plugin install wanyaldee-skills@wanyaldee-skills
EOF
}

die() { echo "install.sh: $*" >&2; exit 1; }

AGENTS="" PROJECT="" DRY=0 YES=0
while [ $# -gt 0 ]; do
    case "$1" in
        --agent) [ $# -ge 2 ] || die "--agent needs a value"; AGENTS="$2"; shift 2 ;;
        --project) [ $# -ge 2 ] || die "--project needs a value"; PROJECT="$2"; shift 2 ;;
        --dry-run) DRY=1; shift ;;
        --yes) YES=1; shift ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; exit 2 ;;
    esac
done

if [ -z "$AGENTS" ]; then
    [ -t 0 ] || die "no --agent given and stdin is not a terminal"
    cat <<'EOF'
Which agent(s)? (space-separated numbers)
  1) Codex CLI
  2) Cursor
  3) Gemini CLI
  4) GitHub Copilot
  5) Other (write AGENTS.md into a project)
  6) Claude Code (shows the plugin command)
EOF
    printf '> '
    read -r picks
    for n in $picks; do
        case "$n" in
            1) AGENTS="$AGENTS,codex" ;;
            2) AGENTS="$AGENTS,cursor" ;;
            3) AGENTS="$AGENTS,gemini" ;;
            4) AGENTS="$AGENTS,copilot" ;;
            5) AGENTS="$AGENTS,agents-md" ;;
            6) usage | sed -n '/^Claude Code/,$p'; exit 0 ;;
            *) die "unknown choice: $n" ;;
        esac
    done
    [ -n "$AGENTS" ] || die "nothing selected"
    if [ -z "$PROJECT" ]; then
        printf 'Project directory (empty = your home directory, all projects): '
        read -r PROJECT
    fi
fi

if [ -n "$PROJECT" ]; then
    [ -d "$PROJECT" ] || die "not a directory: $PROJECT"
    BASE=$(cd "$PROJECT" && pwd)
else
    BASE="$HOME"
fi

# Resolve each agent to a skills directory (or the AGENTS.md fallback).
# Codex, Cursor and Gemini CLI all read .agents/skills, so selecting several
# of them still writes one copy; a second copy under ~/.cursor/skills etc.
# would show up as a duplicate skill in agents that scan both.
TARGETS=""
add_target() {
    case " $TARGETS " in *" $1 "*) ;; *) TARGETS="$TARGETS $1" ;; esac
}
for a in $(echo "$AGENTS" | tr ',' ' '); do
    case "$a" in
        codex|cursor|gemini) add_target "$BASE/.agents/skills" ;;
        copilot)
            if [ -n "$PROJECT" ]; then add_target "$BASE/.github/skills"
            else add_target "$HOME/.copilot/skills"; fi ;;
        agents-md)
            [ -n "$PROJECT" ] || die "agents-md needs --project (there is no shared user-level AGENTS.md path)"
            add_target "AGENTS_MD" ;;
        *) die "unknown agent: $a" ;;
    esac
done

# SKILL.md = the authoritative SKILL.md frontmatter + the AGENTS.md fragment
# body. The fragment already has Claude-Code-only syntax generalized (ADR
# 0017); its leading "> Standalone copy..." note and the "— AGENTS.md
# fragment" title suffix only make sense inside this repo, so drop them.
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

echo "Will write:"
for t in $TARGETS; do
    if [ "$t" = AGENTS_MD ]; then
        echo "  $BASE/AGENTS.md  (wanyaldee-skills block, replaced on re-run)"
    else
        for s in $SKILLS; do echo "  $t/$s/SKILL.md"; done
    fi
done
echo "Existing files that differ are kept as <file>.bak.$STAMP."

[ "$DRY" -eq 1 ] && { echo "(dry run, nothing written)"; exit 0; }
if [ "$YES" -eq 0 ]; then
    [ -t 0 ] || die "refusing to write without a terminal; pass --yes"
    printf 'Proceed? [y/N] '
    read -r ok
    case "$ok" in y|Y|yes) ;; *) echo "Aborted."; exit 1 ;; esac
fi

# Write $2 to $1, backing up a differing existing file. The backup keeps the
# .bak suffix on the file, not the folder: a renamed folder that still held a
# SKILL.md would be picked up as a second copy of the skill.
install_file() {
    if [ -f "$1" ]; then
        if cmp -s "$1" "$2"; then echo "  unchanged $1"; return; fi
        cp "$1" "$1.bak.$STAMP"
    fi
    mkdir -p "$(dirname "$1")"
    cp "$2" "$1"
    echo "  wrote     $1"
}

TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT
for t in $TARGETS; do
    if [ "$t" = AGENTS_MD ]; then
        dest="$BASE/AGENTS.md"
        {
            if [ -f "$dest" ]; then
                awk -v b="$BEGIN" -v e="$END" '$0==b {skip=1} !skip {print} $0==e {skip=0}' "$dest"
            fi
            echo "$BEGIN"
            cat "$REPO/AGENTS.md"
            echo "$END"
        } > "$TMP"
        install_file "$dest" "$TMP"
        size=$(wc -c < "$dest")
        # Codex stops reading project docs past project_doc_max_bytes (32 KiB default).
        [ "$size" -le 32768 ] || echo "  warning: $dest is $size bytes; Codex truncates past 32768 by default — prefer --agent codex (skills) there"
    else
        for s in $SKILLS; do
            render_skill "$s" > "$TMP"
            install_file "$t/$s/SKILL.md" "$TMP"
        done
    fi
done
echo "Done. Restart the agent if the skills don't appear."
