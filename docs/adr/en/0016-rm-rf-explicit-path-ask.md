# 0016: Let `rm -rf` on an explicit path ask instead of being denied outright

(日本語: [0016-rm-rf-explicit-path-ask.ja.md](../ja/0016-rm-rf-explicit-path-ask.ja.md))

## Context

ADR 0009 blocked `rm` with both the recursive and force flags, unconditionally.
It rejected the alternative of classifying the *target* — "target classification
of shell strings is fragile" — and blocked the flag combination instead, on the
grounds that `rm -r` without `-f` stays available for legitimate cleanup.

That prediction did not hold in practice. The user reports the block firing
repeatedly on ordinary cleanup, finished git worktrees being the named case, and
asks for a recursive delete naming an explicit directory to be permitted after
confirmation. `rm -r` is not the escape hatch ADR 0009 assumed: on a worktree or
a `node_modules` tree it prompts per protected file, which is why the blocked
form keeps being reached for.

The stated position in `dev-philosophy` §3 is a total ban on destructive
commands (「`rm -rf` などの破壊的コマンドの全面禁止」). This ADR narrows that
ban to the cases where the target is not knowable in advance. The philosophy
document still reads as absolute and is left unchanged here; reconciling it is
proposed, not done.

## Decision

`hooks/deny-bash.py` now returns one of three outcomes for a recursive-force
`rm`, instead of always denying:

- **ask** — every operand is a literal path that is not a protected location.
  Claude Code prompts the user, showing the paths, and the user approves or
  rejects. Version 2.8.0, shipped together with ADR 0015.
- **deny** — any operand is a glob, carries `$`/backtick expansion, is `.` or
  `..`, resolves to `/`, a top-level path, the home directory, one of the
  exact protected directories, or anything under a system root; or the
  operands cannot be read at all (unbalanced quotes, no operand, or the paths
  arrive through `xargs`/`find -exec`).
- Deny still wins over ask when one command line contains both, because the
  ask is recorded and only emitted after every deny rule has passed.

A separate pre-existing hole was found by the new edge-case tests and fixed:
the segment matcher did not recognise a path-prefixed binary, so `/bin/rm -rf /`
was **allowed** by the hook as shipped in 2.2.0 through 2.7.0.

## Reason — why this code, specifically

The load-bearing part is the operand classifier:

```python
def unsafe_target(tok):
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
```

- **Glob and `$`/backtick checks come first, before any path resolution.** The
  whole premise of asking is that the user can read the paths in the prompt and
  judge them. `rm -rf $BUILD_DIR` shows the user a variable name, not a
  destination, so confirmation would be theatre. This is the direct answer to
  ADR 0009's fragility objection: the fragile cases are refused, not guessed at.
- **`os.path.normpath(os.path.join(cwd, expanded))`, using the `cwd` from the
  hook payload rather than `os.getcwd()`.** The hook process does not
  necessarily run in the session's working directory, and a relative operand
  like `../old-worktree` means nothing without the right base. Getting this
  wrong would resolve `../..` to the wrong ancestor and mis-classify it.
- **`normpath` before comparison, not after.** It collapses `build/`,
  `./build//sub`, and `../..` into the form the protected-path set is written
  in. Comparing the raw token would let `"/etc/"` or `"foo/../.."` slip past a
  set-membership test.
- **`PROTECTED_EXACT` is exact-match, `SYSTEM_ROOTS` is prefix-match.** These
  are different risks. `/var` must not be deleted, but `/var/lib/myapp/cache` is
  ordinary application data and is exactly the kind of cleanup this change
  exists to unblock. `/usr` is different: nothing under it is the user's to
  delete, so the whole subtree is refused.
- **`< 2` path components, not `< 1`.** `/data` is a top-level directory that
  this list has never heard of, and an unknown top-level directory is more
  likely a mount point than a scratch folder. `/data/scratch` is two components
  and asks.
- **`.` and `..` are rejected by token before resolution.** `rm -rf .` resolves
  to a normal-looking deep path that would pass every later check, but deleting
  the working directory out from under a running session is never what was
  meant, and the deletion is not visible in the prompt text.
- **The function returns a sentence, not a boolean.** The string becomes the
  deny reason, so the user is told which operand failed and why rather than
  being told "blocked" again — the failure mode that produced this ADR.

The outcome for a misclassification is what makes the reversal of ADR 0009
defensible. That ADR was weighing target classification as a gate on *allow*,
where a false negative deletes data silently. Here classification gates *ask*:
the worst case for a wrongly-permitted path is a confirmation prompt the user
declines. Nothing reaches the filesystem without a human clicking through.

The `xargs`/`find -exec` case stays denied for the same reason as the glob case:

```python
    if indirect:
        deny(
            "rm -rf fed by xargs/find -exec blocked: the paths come from another "
            "command, so they can't be shown before deletion. ..."
        )
```

The paths exist only at runtime, so there is nothing to put in front of the user.

## Alternatives rejected

- **Allow outright instead of asking** — removes the human from the loop that
  `dev-philosophy` §2 requires for irreversible operations, and the user asked
  for 「確認の上」(after confirmation), not for a blanket allow.
- **Keep the deny and rely on the user running deletions with `!`** — this is
  the status quo that produced the complaint.
- **Allowlist a fixed set of directory names (`node_modules`, `build`, `dist`,
  worktree paths)** — would still block the next unlisted case, and a name-based
  list says nothing about where the directory actually is.
- **Resolve symlinks with `os.path.realpath`** — would catch a symlink pointing
  at `/etc`, but the hook runs before execution and reading the filesystem to
  decide makes the outcome depend on state that can change between the check and
  the deletion. The confirmation prompt shows the literal path the user typed,
  which is what they can actually verify. Noted as a ceiling.
- **Also relax the `.env` and DB rules** — not asked for, and neither has
  produced a reported false positive.

## Consequences

- Cleaning up a finished worktree, a build directory, or a `node_modules` tree
  now takes one confirmation instead of being impossible without the user
  running the command themselves.
- `/bin/rm -rf /` is denied for the first time since the Bash hook shipped. Any
  session between 2.2.0 and 2.7.0 could have run it.
- Known ceiling: symlinked operands are classified by their literal path, so a
  symlink named `build` that points at a system directory would reach the
  confirmation prompt described as `build`. The user is the check there.
- Known ceiling, unchanged from ADR 0009: this is an accident guard, not an
  adversarial boundary. A Python script that deletes a tree still passes.
- `dev-philosophy` §3 still states a total ban on `rm -rf`. The mechanism and
  the philosophy document now disagree. Proposed, not done: soften that line to
  "destructive commands require confirmation, and are refused outright when the
  target cannot be shown in advance."
- The test matrices live in this session's scratchpad, not in the repo. The
  package has no test directory and adding one is out of scope here; the cases
  are recorded in this ADR's Verification section by count and category.

## Verification

- Baseline before the change: 46-case matrix, 35 passed and 11 failed. All 11
  failures were the explicit-path cases the user reported, each returning deny.
- After the change: 46/46 pass. A second, adversarial matrix of 26 cases covers
  deny-beats-ask on mixed command lines, flag spellings (`-fr`, `-r -f`, `-rfv`,
  `--recursive --force`, `--`), path-prefixed binaries, trailing and doubled
  slashes, deep system paths, quoted dangerous targets, newline-separated
  scripts, and an empty command. It failed 1 of 26 on first run, which found the
  path-prefixed-binary hole; after the fix, 26/26 pass.
- Both matrices were re-run together after the fix: 72 of 72 cases pass.
- Confirmed by hand that the three path-prefixed forms behave: `/bin/rm -rf /`
  and `/usr/bin/rm -rf /etc` deny, `./scripts/rm -rf build` asks.
- Not verified: the `ask` decision has not been observed end to end in a live
  Claude Code session, only in the hook's JSON output. Whether the prompt renders
  the reason string as intended is unconfirmed.
