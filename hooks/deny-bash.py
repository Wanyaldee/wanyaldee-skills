#!/usr/bin/env python3
"""PreToolUse hook: gate dangerous Bash commands (secret reads, destructive ops, direct DB access).

Decisions: deny (never runs), ask (user confirms in the UI), or no output (no opinion).
"""
import json
import os
import re
import shlex
import sys

_payload = json.load(sys.stdin)
cmd = _payload.get("tool_input", {}).get("command") or ""
cwd = _payload.get("cwd") or os.getcwd()
home = os.path.expanduser("~")

# Exact paths that must never be the target of a recursive delete, even though
# user-owned data legitimately lives one level below them.
PROTECTED_EXACT = {"/", "/home", "/media", "/mnt", "/opt", "/run", "/srv", "/tmp", "/var"}
# Roots where the whole subtree is system state or another user's home.
SYSTEM_ROOTS = (
    "/bin", "/boot", "/dev", "/etc", "/lib", "/lib32", "/lib64",
    "/proc", "/root", "/sbin", "/sys", "/usr",
)


def _emit(decision, reason):
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": decision,
                    "permissionDecisionReason": f"fable-coding: {reason}",
                }
            }
        )
    )
    sys.exit(0)


def deny(reason):
    _emit("deny", reason)


def ask(reason):
    _emit("ask", reason)


# 1. .env references (templates stay readable — same policy as deny-secrets.py / ADR 0008).
# ponytail: matches command text, so writes like `cp .env.example .env` are also
# denied; ask the user to run those themselves.
for m in re.finditer(r'(?:^|[\s"\'=/(])(\.env(?:\.[A-Za-z0-9_.-]+)?)', cmd):
    if not m.group(1).endswith((".example", ".sample", ".template")):
        deny(
            f"'{m.group(1)}' referenced in Bash command; may expose secrets. "
            "Read the .env.example/.sample/.template variant, or ask the user to run this."
        )


def rm_targets(seg):
    """Operands of the `rm` in this segment, or None when they can't be read confidently."""
    try:
        tokens = shlex.split(seg)
    except ValueError:
        return None  # unbalanced quotes — fail closed
    idx = next((i for i, t in enumerate(tokens) if t == "rm" or t.endswith("/rm")), None)
    if idx is None:
        return None
    targets, flags_done = [], False
    for tok in tokens[idx + 1:]:
        if tok == "--":
            flags_done = True
            continue
        if not flags_done and tok.startswith("-") and len(tok) > 1:
            continue
        targets.append(tok)
    return targets


def unsafe_target(tok):
    """Why this operand may not be deleted without a human, or None when it's a plain path."""
    if any(g in tok for g in ("*", "?", "[")):
        return f"'{tok}' is a glob, so what it matches can't be known here"
    if "$" in tok or "`" in tok:
        return f"'{tok}' contains variable or command substitution"
    if tok in (".", ".."):
        return f"'{tok}' is the current or parent directory"
    expanded = os.path.expanduser(tok)
    if expanded.startswith("~"):
        return f"'{tok}' has a ~ reference that doesn't resolve here"
    path = os.path.normpath(os.path.join(cwd, expanded))
    if path in PROTECTED_EXACT:
        return f"'{tok}' resolves to {path}, a protected location"
    if path == home:
        return f"'{tok}' resolves to the home directory"
    if path == "/" or any(path == r or path.startswith(r + "/") for r in SYSTEM_ROOTS):
        return f"'{tok}' resolves to {path}, inside system-owned state"
    if len([p for p in path.split("/") if p]) < 2:
        return f"'{tok}' resolves to {path}, a top-level path"
    return None


# 2. Destructive commands.
# ponytail: only rm with BOTH -r and -f is gated; plain `rm -r` still runs unprompted.
pending_ask = None
for seg in re.split(r"[;|&\n]", cmd):
    # A leading path is allowed on the binary: `/bin/rm -rf x` is the same command.
    indirect = re.search(r"(?:\bxargs\s+|-exec\s+)(?:sudo\s+)?(?:[\w./-]*/)?rm\s", seg)
    direct = re.match(r"\s*(?:sudo\s+)?(?:[\w./-]*/)?rm\s", seg)
    if not (indirect or direct):
        continue
    flags = "".join(re.findall(r"\s-([A-Za-z]+)", seg))
    long_flags = re.findall(r"\s--(\w[\w-]*)", seg)
    recursive = "r" in flags or "R" in flags or "recursive" in long_flags
    force = "f" in flags or "force" in long_flags
    if not (recursive and force):
        continue
    if indirect:
        deny(
            "rm -rf fed by xargs/find -exec blocked: the paths come from another "
            "command, so they can't be shown before deletion. Delete the directories "
            "by name, or ask the user to run this."
        )
    targets = rm_targets(seg)
    if targets is None:
        deny("rm -rf blocked: this command's operands couldn't be parsed. Ask the user to run it.")
    if not targets:
        deny("rm -rf blocked: no path given.")
    for tok in targets:
        problem = unsafe_target(tok)
        if problem:
            deny(f"rm -rf blocked: {problem}. Ask the user to run destructive deletions themselves.")
    pending_ask = "recursive delete of " + ", ".join(targets) + " — confirm this is the right path"

if re.search(r"\bmkfs", cmd) or re.search(r"\bdd\b[^;|&\n]*\bof=/dev/", cmd):
    deny("filesystem/device-destroying command blocked.")

# 3. Direct DB access (human-in-the-loop: report the statement, let the user run it).
if re.search(
    r"(?:^|[;&|(\n]\s*|\bsudo\s+)(mysql|mariadb|psql|sqlite3|mongosh|mongo|redis-cli)\b", cmd
) or re.search(r"\bwrangler\s+d1\s+(execute|migrations\s+apply)\b", cmd):
    deny(
        "direct DB access via Bash blocked. Report the exact statement(s) to the user "
        "and let them execute (fable-coding section 4)."
    )

# Every deny rule passed; surface the recursive delete for confirmation (ADR 0016).
if pending_ask:
    ask(pending_ask)
