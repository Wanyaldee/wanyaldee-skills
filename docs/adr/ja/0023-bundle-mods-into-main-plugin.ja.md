# 0023: context-handoff と sticky-notes の Mod を本体プラグインに同梱

(English: [0023-bundle-mods-into-main-plugin.md](../en/0023-bundle-mods-into-main-plugin.md))

ADR 0018 と ADR 0022 のうち、パッケージングに関する部分(各 Mod をマーケットプレイスの独立プラグインにする)を置き換える。それ以外の決定は有効なまま。

## 背景 (Context)

v2.12.0 まで、マーケットプレイスには3つのプラグインがあった: `wanyaldee-skills`(スキル+command hooks)、`context-handoff` と `sticky-notes`(function hooks の Mod、ADR 0018 / 0022)。ユーザーから(2026-11-05)2つの Mod を同時にパッケージングしたいと依頼があり、3択(Mod だけの統合プラグイン / スキル本体に同梱 / 別プラグインのまま手順だけまとめる)から **スキル本体に両方を同梱** が選ばれた。`/plugin install wanyaldee-skills@wanyaldee-skills` 1回ですべて入るようにする。

ADR 0018 はルートの `hooks/hooks.json` に `modules` を入れる案を「未文書」として却下していたため、実際に試して確かめる必要があった。

## 決定 (Decision)

- `hooks/hooks.json` は command hooks を `"hooks"` に残したまま、`"modules": ["./mods.tsx"]` を加える。
- `hooks/mods.tsx` をプラグイン唯一の hooks モジュールとする。`session.start` はここが持ち、各 Mod が export する `start` を呼んだあと、各 Mod の `register` に残りのフックを登録させる。
- 各 Mod の `session.start` の中身は export した `start` 関数に移した。コードは `mods/<name>/hooks/` に残る。
- 両 Mod の `$.state` の atom は `plugin: 'wanyaldee-skills'` を名乗る。契約(contract)はルートの自己完結した `types/index.d.ts` 1つ(`.claude-plugin/plugin.json` の `"types"`)で、Mod が使う共有の型もここに置く。各 Mod の `types/` は削除。
- `mods/*/.claude-plugin/plugin.json` と `mods/*/hooks/hooks.json` を削除し、`marketplace.json` から2エントリを外した。
- sticky-notes の store キーの接頭辞を `repo:` から `sticky-notes:` に変更。
- バージョン 2.12.0 → 2.13.0。

## Reason(理由)

```json
{
  "hooks": { "SessionStart": [...], "PreToolUse": [...] },
  "modules": ["./mods.tsx"]
}
```

- 2つ目の hooks ファイルではなく1ファイルに両キー: `claude plugin validate` が受け付け、`--plugin-dir` でのライブ実行でも command hooks(`.pem` の読み取りを `deny-secrets.py` が拒否)とモジュールの両方が読み込まれた(検証を参照)。manifest の `"hooks"` はすでにこのファイルを指している。

```ts
// hooks/mods.tsx
export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    await startContextHandoff($, e)
    await startStickyNotes($)
    return next(e)
  })
  contextHandoff(on, options)
  stickyNotes(on, options)
}
```

- `session.start` は Mod ごとではなく入口に1つ: matcher なしで `session.start` を2回フックするプラグインをエンジンは拒否する(`claude plugin validate` が `on("session.start") is registered twice without a matcher` と報告)。他のイベントは Mod 間で重ならないか matcher 付き(`command.run` はコマンドごと、`ui.render` はコンポーネントごと)なので、各 Mod の `register` に残した。
- context-handoff の `start` を先に呼ぶ: ステータスラインを描き、再開確認の帯を出しうるので、起動時には付箋の読み込みより重要。
- 各 Mod は自分のフォルダと `register` を保つ: 片方を読む・テストする・外すときにもう片方に触れずに済む。

```ts
const pending = atom({ plugin: 'wanyaldee-skills', key: 'pending' } as const, null)
const commands = atom({ plugin: 'wanyaldee-skills', key: 'commands' } as const, [] as Sticky[], { shape: 'sticky-1' })

async function storeKey($: EngineInterface) {
  return `sticky-notes:${await $.session.root()}`
}
```

- 旧 Mod 名ではなく `plugin: 'wanyaldee-skills'`: `$.state` の値は持ち主のプラグインしか書き込めず、持ち主はいまや `wanyaldee-skills`。両 Mod のキー(`pending`、`hasSavedThisSession` / `commands`、`notes`、`summary`、`isSummarizing`)は衝突しない。
- 共有の型を抱えた契約ファイルをルートに1つ: `validate` は import する契約を拒否する(`the contract must be self-contained`)ため、Mod が import する型(`Handoff`、`Sticky` など)をそこへ移した。
- `storeKey` を `const` のアロー関数ではなく `function` 宣言に: `hooks/mods.tsx` から import されると、エンジンは import 越しの `$` を関数宣言の中までしか追わない(`validate` がアロー関数を拒否した)。
- `sticky-notes:` 接頭辞: `$.store` はプラグイン単位なので2つの Mod が1つの store を共有する。context-handoff はすでに `handoff:<root>` を使っており、`repo:` では誰の記録か分からない。

## 却下した代替案 (Alternatives rejected)

- Mod だけの統合プラグイン `wanyaldee-mods`: 提示したが選ばれなかった。
- 別プラグインのまま手順をまとめる: 提示したが選ばれなかった。
- 単体エントリを同梱版と並べて残す: 両方入れたユーザーでは各 Mod が二重に動く(下のライブ実行で、インストール済みの単体 `context-handoff` が同梱版の横で読み込まれたのが見えている)。
- `plugin.json` で2つ目の hooks ファイルを指定: 1ファイルに両キーで読み込めると分かった以上不要。
- 単体プラグインの store からのデータ移行: プラグインは他プラグインの `$.store` を読めない。データは数件のメモと、リポジトリごとに高々1件の保留中の引き継ぎ。

## 影響 (Consequences)

- 1回のインストールでスキル・command hooks・両 Mod が入る。スキルだけ欲しいユーザーが Mod 単位で外すことはできない。
- 単体の `context-handoff` / `sticky-notes` の利用者は、更新後に単体版をアンインストールしないと各 Mod が二重に動く。保存済みの付箋や保留中の引き継ぎは引き継がれない。
- 3つ目の Mod を足すには: `mods/` にフォルダ、`session.start` が要るなら export した `start`、`hooks/mods.tsx` に1行、`types/index.d.ts` に衝突しない state キー。
- `claude plugin validate .` と `claude plugin test .` がリポジトリのルートから両 Mod を対象にする。

## 検証 (Verification)

`/home/ko200/wanyaldee-skills` にて Claude Code 2.1.318 上で、Claude Opus 5.5(AI エージェント)が実行。2026-11-05。

`claude plugin validate .`(exit 0):

<details>

```
Validating marketplace manifest: /home/ko200/wanyaldee-skills/.claude-plugin/marketplace.json

⚠ Found 2 warnings:

  ❯ description: No marketplace description provided. Adding a description helps users understand what this marketplace offers
  ❯ plugins[0] plugin.json → author: No author information provided. Consider adding author details for plugin attribution

Validating plugin: /home/ko200/wanyaldee-skills/.claude-plugin/plugin.json

⚠ Found 1 warning:

  ❯ author: No author information provided. Consider adding author details for plugin attribution

  ❯ types ./types/index.d.ts declares on $: nothing (no EngineInterface member)
  ❯ types ./types/index.d.ts declares state: wanyaldee-skills.pending, wanyaldee-skills.hasSavedThisSession, wanyaldee-skills.commands, wanyaldee-skills.notes, wanyaldee-skills.summary, wanyaldee-skills.isSummarizing

Validating hooks: /home/ko200/wanyaldee-skills/hooks/hooks.json

  ❯ ./mods.tsx hooks: session.start, session.measure, command.run{command=handoff}, ui.render{component=AbovePrompt}, command.run{command=sticky}, command.run{command=sticky-cmd}, command.run{command=sticky-note}, command.run{command=sticky-summary}, ui.render{component=Pane, requestId=sticky-notes}
  ❯ ./mods.tsx answers its own command: command.run{command=handoff}
  ❯ ./mods.tsx answers its own command: command.run{command=sticky}
  ❯ ./mods.tsx answers its own command: command.run{command=sticky-cmd}
  ❯ ./mods.tsx answers its own command: command.run{command=sticky-note}
  ❯ ./mods.tsx answers its own command: command.run{command=sticky-summary}
  ❯ ./mods.tsx calls: $.clock.now (via add, checkpoint, summarize), $.command.register (via startContextHandoff, startStickyNotes), $.fs.exists (via readIf, repoDocs), $.fs.list (via repoDocs), $.fs.read (via readIf), $.fs.write (via checkpoint), $.model.complete (via review, summarize), $.model.fork (via summarize), $.process.run (via git), $.prompt.submit, $.session.append (via checkpoint), $.session.cwd (via repoRootOf), $.session.messages (via summarize, transcriptOf), $.session.root (via repoDocs, storeKey), $.session.usage (via startContextHandoff), $.state.get, $.state.set, $.store.delete (via settle), $.store.get (via load, startContextHandoff), $.store.set (via checkpoint, save), $.ui.copy, $.ui.log (via git, summarize), $.ui.open, $.ui.resolve, $.ui.status (via showUsage), $.ui.toast (via checkpoint, commitAll, startContextHandoff)
  ❯ ./mods.tsx state writes: wanyaldee-skills.commands, wanyaldee-skills.hasSavedThisSession, wanyaldee-skills.isSummarizing, wanyaldee-skills.notes, wanyaldee-skills.pending, wanyaldee-skills.summary
  ❯ ./mods.tsx state reads: wanyaldee-skills.commands, wanyaldee-skills.hasSavedThisSession, wanyaldee-skills.isSummarizing, wanyaldee-skills.notes, wanyaldee-skills.pending, wanyaldee-skills.summary

Plugin directory checks for /home/ko200/wanyaldee-skills. The plugin directory is the catalog that plugins are submitted to; this is a subset of what it runs.

⚠ Found 1 plugin directory warning:

  ❯ .claude-plugin/plugin.json icon: No icon (ICON_MISSING). No icon found in the plugin. The validator looked for `icon` in plugin.json and for a file at .claude-plugin/icon.png or .svg, assets/icon.png or .svg, or a similar path.
    Fix: Add a square PNG to the plugin folder at .claude-plugin/icon.png, or set `icon` in plugin.json to the path of a square PNG or JPEG in the plugin: 512 to 2048 px on each side, under 2 MB. SVG and WebP are not accepted. That file may become the listing icon only once: the first time the plugin is saved or submitted in the developer portal. Adding or changing it later does not change the icon.

About these checks:

  ❯ This folder also holds a marketplace manifest. The plugin directory treats such a folder as a plugin, so these checks cover only the plugin in this folder. To check another plugin that the marketplace lists, run validate on that plugin's folder.
  ❯ hooks/hooks.json names a hooks module (a code file listed under `modules`). The plugin directory has rules of its own for such code, and these checks apply none of them, so passing here does not mean the directory accepts the plugin. The developer portal's own validation applies those rules.

These plugin directory checks do not change the result below.

The directory also runs a safety scan and a policy review that this command does not.

✔ Validation passed with warnings
```

</details>

`claude plugin test .`(exit 0):

```
mods/context-handoff/hooks/logic.test.ts:
(pass) status shows context fill and every rate-limit window [7.55ms]
(pass) status shows a placeholder before the first response [0.51ms]
(pass) no handoff while every figure is under its threshold [0.47ms]
(pass) a rate-limit window at 90% triggers a handoff [0.43ms]
(pass) a context fill at 90% triggers a handoff [0.52ms]
(pass) handoffs are keyed by repository, not by session [0.41ms]
(pass) the resume question is the exact wording asked for [0.33ms]
(pass) the resume prompt carries the branch, commit and summary [0.86ms]

mods/sticky-notes/tests/sticky.test.tsx:
(pass) commands and notes added by slash command show in the pane and are saved per repo [294.93ms]
(pass) a new session in the same repo loads the saved notes [106.13ms]
(pass) the summary button calls the model with the transcript [96.08ms]
(pass) a note is checked against the repo docs and the conversation [103.59ms]

 12 pass
 0 fail
Ran 12 tests across 2 files. [1.38s]
```

同梱 `claude-code.d.ts` のヘッダにある tsconfig(TypeScript 5、`strict`、`noUncheckedIndexedAccess`)で `hooks/*.tsx`・`types/`・`mods/` を対象にした `tsc -p`(exit 0):

```
(no output, exit 0)
```

`--plugin-dir` でのライブ読み込み(ヘッドレスの `claude -p`): command hooks とモジュールの両方が有効。

```
$ claude -p "Use the Read tool on <scratchpad>/hooktest/dummy.pem and tell me exactly what happened, including any hook message verbatim." --plugin-dir /home/ko200/wanyaldee-skills --debug-file <scratchpad>/hooktest/debug.log --allowedTools=Read
PreToolUse:Read hook error: fable-coding: credential file read blocked (dummy.pem)

- **What fired:** a hook on the Read tool, from the `fable-coding` skill or plugin.
- **Why:** it treats `.pem` files as credentials and blocks reads of them. It went by the file extension; the file's contents weren't inspected.
- **What I did next:** nothing. I didn't try to get around the block with `cat` or any other tool.

If you're testing the hook, this is the behaviour you'd expect for a `.pem` file. If you want me to read the file, you'll need to change or allowlist that rule in the hook config yourself.
```

(コマンドは `tail -8` に通しており、上はその8行をそのまま貼ったもの。それより前に出力された行は取得していない。)

プラグイン名を含むデバッグログの行(`--debug-file`):

```
[DEBUG] Plugin "wanyaldee-skills" from --plugin-dir overrides installed version
[DEBUG] Synced plugin "wanyaldee-skills" shadowed by local copy wanyaldee-skills@inline
[DEBUG] hooks module wanyaldee-skills@inline loaded (worker, environment 1, tier user); events: session.start,session.measure,command.run,ui.render
[DEBUG] hooks module context-handoff@wanyaldee-skills loaded (worker, environment 2, tier user); events: session.start,session.measure,command.run,ui.render
[DEBUG] hooks module wanyaldee-skills@inline, context-handoff@wanyaldee-skills session.start settled in 96.3ms (worker hop, next() included)
```

**未検証:**

- `/plugin install` / マーケットプレイス更新経由での v2.13.0 のインストール(実行したのは `--plugin-dir` のみ)。
- 同梱版の対話セッションでの sticky-notes のペインと context-handoff の帯(ヘッドレス実行では UI は描かれない)。
- 更新後の単体プラグインのアンインストール。
