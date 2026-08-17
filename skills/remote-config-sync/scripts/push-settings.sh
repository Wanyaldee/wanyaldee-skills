#!/bin/sh
# Push ~/.claude/settings.json from this (Windows) machine to configured
# WSL distros and SSH hosts, only when the remote copy differs. Silent when
# there is nothing to do; prints one line per target actually changed.
set -eu

SRC="$HOME/.claude/settings.json"
CONF="$HOME/.claude/remote-sync-targets.conf"

[ -f "$SRC" ] || exit 0
[ -f "$CONF" ] || exit 0

hash_file() {
    sha256sum "$1" 2>/dev/null | cut -d' ' -f1
}

SRC_HASH=$(hash_file "$SRC")
STAMP=$(date +%Y%m%d%H%M%S)

sync_wsl() {
    distro="$1"
    remote_hash=$(wsl.exe -d "$distro" -- sh -c 'sha256sum "$HOME/.claude/settings.json" 2>/dev/null | cut -d" " -f1' 2>/dev/null || true)
    [ "$remote_hash" = "$SRC_HASH" ] && return 0
    wsl.exe -d "$distro" -- sh -c '
        mkdir -p "$HOME/.claude"
        [ -f "$HOME/.claude/settings.json" ] && cp "$HOME/.claude/settings.json" "$HOME/.claude/settings.json.bak.'"$STAMP"'"
        cat > "$HOME/.claude/settings.json"
    ' < "$SRC"
    echo "[remote-config-sync] WSL:$distro の settings.json を更新しました (旧設定は settings.json.bak.$STAMP に退避)"
}

sync_ssh() {
    host="$1"
    remote_hash=$(ssh -o ConnectTimeout=5 "$host" 'sha256sum "$HOME/.claude/settings.json" 2>/dev/null | cut -d" " -f1' 2>/dev/null || true)
    [ "$remote_hash" = "$SRC_HASH" ] && return 0
    ssh -o ConnectTimeout=5 "$host" '
        mkdir -p "$HOME/.claude"
        [ -f "$HOME/.claude/settings.json" ] && cp "$HOME/.claude/settings.json" "$HOME/.claude/settings.json.bak.'"$STAMP"'"
        cat > "$HOME/.claude/settings.json"
    ' < "$SRC"
    echo "[remote-config-sync] SSH:$host の settings.json を更新しました (旧設定は settings.json.bak.$STAMP に退避)"
}

# CONF format: one target per line, "wsl:<distro-name>" or "ssh:<host-alias>"
# Blank lines and lines starting with # are ignored.
while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
        ''|'#'*) continue ;;
        wsl:*) sync_wsl "${line#wsl:}" ;;
        ssh:*) sync_ssh "${line#ssh:}" ;;
    esac
done < "$CONF"
