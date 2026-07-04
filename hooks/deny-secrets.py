#!/usr/bin/env python3
"""PreToolUse hook: deny Read access to credential files (.env, keys, cloud creds)."""
import fnmatch
import json
import os
import sys

DENY_BASENAMES = [".env", ".env.*", "*.pem", "id_rsa", "id_ed25519", "credentials.json"]
DENY_SUBSTRINGS = ["/.aws/"]

data = json.load(sys.stdin)
path = data.get("tool_input", {}).get("file_path") or ""
name = os.path.basename(path)
posix = path.replace("\\", "/")

# ponytail: covers the Read tool only; `cat .env` via Bash is not parsed here.
# Pair with permissions.deny Read(...) rules in settings for Bash coverage.
if any(fnmatch.fnmatch(name, p) for p in DENY_BASENAMES) or any(
    s in posix for s in DENY_SUBSTRINGS
):
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"fable-coding: credential file read blocked ({name})",
                }
            }
        )
    )
