# 0022: sticky-notes Mod(次のコマンド・会話の概要・照合付きの自分の認識を並べるサイドペイン)

(English: [0022-sticky-notes-mod.md](../en/0022-sticky-notes-mod.md))

## 背景 (Context)

ユーザーから(2026-11-05)、同じセッションの中で会話の横に付箋/スレッド風のペインを置き、3つのものを残せる Mod が欲しいと依頼があった: このあと打つコマンド、この会話の概要、自分の認識の書き込み。同日の追加依頼として (a) 書き込んだ認識が間違っていれば「ここ違うんじゃない」と指摘する、(b) リポジトリレベルで合わせられるようにする — 後者は3択の質問から「照合先にリポジトリの文書も加える」と「リポジトリ単位で保存する」が選ばれた(「コミットするファイルで共有する」は選ばれなかった)。

それまでは、こうしたメモは会話の中に書いて流れていくか、リポジトリに場当たり的なファイルを置くしかなかった。

## 決定 (Decision)

`mods/sticky-notes/` を追加した。function hooks のプラグインで、`.claude-plugin/marketplace.json` に3つ目のプラグインとして登録した(`/plugin install sticky-notes@wanyaldee-skills`)。作りは `mods/context-handoff`(ADR 0018)に揃えた。

- `/sticky` でペインを開く(`$.ui.open` + `Pane` への `ui.render`)。3つの欄: 次に打つコマンド(追加 / コピー / 削除)、会話の概要(ボタンか `/sticky-summary`、haiku 1回)、自分の認識(追加 / 削除 / 再照合、`/sticky-note`)。
- 認識を1件書き込むたびに、バックグラウンドで haiku を1回呼び、会話とリポジトリの `CLAUDE.md`、`AGENTS.md`、ADR(新しい順)、`README.md`(合計8万字まで)に照らして判定する。結果はメモの下に返信として表示する: `✓` / `⚠ ここ違うかも: …` / `? 判断できず: …`。
- コマンドと認識は変更のたびに `$.store` の `repo:<プロジェクトルート>` へ書き込み、`session.start` で読み込む。概要はセッション内のみ(`$.state`)。

## Reason(理由)

保存: ペインの再描画元は `$.state`、セッションを越えて残るのは `$.store`。

```ts
const storeKey = async ($: EngineInterface) => `repo:${await $.session.root()}`

async function load($: EngineInterface) {
  const saved = (await $.store.get(await storeKey($))) as Partial<Saved> | undefined
  if (!saved) return
  const settle = (list: Sticky[] = []) =>
    list.map(n => (n.review?.verdict === 'pending' ? { ...n, review: undefined } : n))
  await update($, commands, () => settle(saved.commands))
  await update($, notes, () => settle(saved.notes))
}

async function edit($: EngineInterface, which: Which, fn: (list: Sticky[]) => Sticky[]) {
  if (which === 'commands') await update($, commands, fn)
  else await update($, notes, fn)
  await save($)
}
```

- キーはセッション ID や `cwd` ではなく `$.session.root()`: 依頼が「リポジトリレベル」であり、セッション中にシェルで `cd` してもルートは動かないので、途中でキーがずれない。ADR 0018 の引き継ぎ記録と同じ選択。
- `$.store` だけにしないのは、`ui.render` 中の `$.state` の読み取りがペインを購読させ、書き込みで再描画されるため。`$.store` にはその購読がない。
- 保存は `session.end` ではなく `edit` での書き込み透過: クラッシュや端末を閉じた場合 `session.end` は走らない。リストは数 KB なので毎回保存しても実質コストはない。
- 読み込み時に `pending` の判定を消す(`settle`): それを解決するはずだった haiku 呼び出しは旧セッションと一緒に消えており、消さないと `照合中…` のまま残り続ける。
- atom を引数で渡さず `which: 'commands' | 'notes'` で選ぶ: エンジンのロード時の state スキャンは、`to` が引数の `update($, to, …)` を拒否する(`claude plugin validate` が報告した)。各 atom をリテラルに書く必要がある。
- `if (!saved) return` で `$.state` の内容を保持する: セッション内のみ保存していた版から更新した直後は store が空で、そのセッションで書いたメモを消してはいけない。

照合: どの文書を、どの順で、どの予算で読むか。

```ts
const REPO_CHARS = 80_000

for (const rel of ['CLAUDE.md', 'AGENTS.md', ...adrs, 'README.md']) {
  const text = await readIf($, `${root}/${rel}`).catch(() => undefined)
  if (!text) continue
  const block = `<file path="${rel}">\n${text}\n</file>\n`
  if (out.length + block.length > REPO_CHARS) continue
  out += block
}
```

- 順序は指示ファイル → ADR 新しい順(ゼロ埋めの `NNNN-` 名に `.sort().reverse()`)→ README: メモが関わる規則を書いているのは指示ファイル、新しい ADR は古いものを上書きし、README は両者の言い直しが多い。
- `docs/adr/en` があればそれ、なければ `docs/adr`: このリポジトリは en/ja の対を持つので、両方読むと予算の半分が重複に消える。
- 収まらないブロックで `break` ではなく `continue`: 長い ADR 1本のせいで、その後の短い README が締め出されないように。
- 8万字: このリポジトリの `AGENTS.md`(31.7k)+ `README.md`(17.2k)+ 新しい ADR 数本で埋まる。会話側の上限4万字と合わせて約12万字で、haiku のコンテキストに返答の余地を残して収まる。古い ADR(en 合計 112.7k)は入らない。

```ts
prompt: [
  { text: `<repository>\n${docs}</repository>`, cache: true },
  { text: `<conversation>\n${transcript}\n</conversation>\n\n<user_understanding>\n${note.text}\n</user_understanding>` },
],
```

- リポジトリ部分を先頭に置きキャッシュ指定: キャッシュ有効期間内の照合では同一なので、続けて何件か書いても支払いは1回分。会話は毎ターン変わるのでキャッシュ指定の後ろに置く。
- `add` の中で `if (which === 'notes') void review($, id)` と await しない: `/sticky-note` や入力欄が、数十秒かかりうるモデル呼び出しを待たずにすぐ戻る。

```ts
function parseReview(text: string): Review {
  const found = text.match(/\{[\s\S]*\}/)
  try {
    const v = JSON.parse(found?.[0] ?? '') as { verdict?: unknown; comment?: unknown }
    const verdict = VERDICTS.find(x => x === v.verdict)
    if (verdict) return { verdict, comment: String(v.comment ?? '') }
  } catch {}
  return { verdict: 'unclear', comment: text.trim().slice(0, 200) }
}
```

- 返答は信頼しないテキストとして扱う: 3つの既知の値以外の判定や JSON の前後の文章は、生の返答を見せた `unclear` に倒す。壊れた返答が黙って捨てられたり `✓` と表示されたりせず、目に見える。

概要は毎回の `turn.complete` ではなく手動(ボタン / `/sticky-summary`): 毎ターン最大4万字で haiku を呼ぶと、ペインを見ていなくても毎ターン費用がかかる。

## 却下した代替案 (Alternatives rejected)

- `prompt.compose` で本体モデルにメモを渡し、チャットで食い違いを指摘させる: 指摘がメモの下ではなくチャットに出るうえ、メモを足すたびにシステムプロンプトが変わり、本体のプロンプトキャッシュが壊れる。
- コミットするファイル(`.claude/sticky.md`)で共有: ユーザーに提示し、選ばれなかった。
- セッション ID を store のキーにする: 新しいセッションが空で始まり、「リポジトリレベル」で避けたかった状態になる。
- 毎ターンの自動要約: 閉じているかもしれないペインのために毎ターン費用がかかる。
- `docs/adr/en` と `docs/adr/ja` の両方を読む: 1つの予算の中で重複する。
- 2セッション同時利用に備えた保存時の id マージ: まだ不要。`ponytail:` コメントで印を付けた。

## 影響 (Consequences)

- 同じリポジトリで2つのセッションを同時に開くと、互いの追加を上書きする(後勝ち)。
- 認識を1件書くたびに最大約12万字を haiku に送る。費用はターン単位ではなくメモ単位。
- 文書が8万字を超えるリポジトリでは古い ADR は参照されない。古い決定に関するメモは `? 判断できず` や、新しい ADR だけを根拠にした `✓` になりうる。
- 照合の出力は表示されるだけで、モデルの返答を実行することはない。リポジトリ文書や会話内のテキストが引き起こせるのは、最悪でも誤った判定であって操作ではない。
- 概要はセッションを越えて残らない。
- function hooks の API は early access。Claude Code の更新で修正が必要になりうる。

## 検証 (Verification)

`/home/ko200/wanyaldee-skills` にて Claude Code 2.1.318 上で、Claude Opus 5.5(AI エージェント)が実行。2026-11-05。

`claude plugin validate mods/sticky-notes`:

<details>

```
Validating plugin manifest: /home/ko200/wanyaldee-skills/mods/sticky-notes/.claude-plugin/plugin.json

  ❯ types ./types/index.d.ts declares on $: nothing (no EngineInterface member)
  ❯ types ./types/index.d.ts declares state: sticky-notes.commands, sticky-notes.notes, sticky-notes.summary, sticky-notes.isSummarizing

Validating hooks: /home/ko200/wanyaldee-skills/mods/sticky-notes/hooks/hooks.json

  ❯ ./register.tsx hooks: session.start, command.run{command=sticky}, command.run{command=sticky-cmd}, command.run{command=sticky-note}, command.run{command=sticky-summary}, ui.render{component=Pane, requestId=sticky-notes}
  ❯ ./register.tsx answers its own command: command.run{command=sticky}
  ❯ ./register.tsx answers its own command: command.run{command=sticky-cmd}
  ❯ ./register.tsx answers its own command: command.run{command=sticky-note}
  ❯ ./register.tsx answers its own command: command.run{command=sticky-summary}
  ❯ ./register.tsx calls: $.clock.now (via add, summarize), $.command.register, $.fs.exists (via readIf, repoDocs), $.fs.list (via repoDocs), $.fs.read (via readIf), $.model.complete (via review, summarize), $.session.messages (via transcriptOf), $.session.root (via repoDocs, storeKey), $.state.get, $.state.set, $.store.get (via load), $.store.set (via save), $.ui.copy, $.ui.open, $.ui.resolve
  ❯ ./register.tsx state writes: sticky-notes.commands, sticky-notes.isSummarizing, sticky-notes.notes, sticky-notes.summary
  ❯ ./register.tsx state reads: sticky-notes.commands, sticky-notes.isSummarizing, sticky-notes.notes, sticky-notes.summary

Plugin directory checks for /home/ko200/wanyaldee-skills/mods/sticky-notes. The plugin directory is the catalog that plugins are submitted to; this is a subset of what it runs.

⚠ Found 1 plugin directory warning:

  ❯ .claude-plugin/plugin.json icon: No icon (ICON_MISSING). No icon found in the plugin. The validator looked for `icon` in plugin.json and for a file at .claude-plugin/icon.png or .svg, assets/icon.png or .svg, or a similar path.
    Fix: Add a square PNG to the plugin folder at .claude-plugin/icon.png, or set `icon` in plugin.json to the path of a square PNG or JPEG in the plugin: 512 to 2048 px on each side, under 2 MB. SVG and WebP are not accepted. That file may become the listing icon only once: the first time the plugin is saved or submitted in the developer portal. Adding or changing it later does not change the icon.

About these checks:

  ❯ The repository root was taken to be /home/ko200/wanyaldee-skills, the nearest parent folder with a .git folder or file. README.md was taken from it, because this plugin folder has none of its own. For a plugin submitted from a git repository, the repository root is the top folder of that repository, with only what is committed there, so check that the folder named above is that top folder.
  ❯ hooks/hooks.json names a hooks module (a code file listed under `modules`). The plugin directory has rules of its own for such code, and these checks apply none of them, so passing here does not mean the directory accepts the plugin. The developer portal's own validation applies those rules.

These plugin directory checks do not change the result below.

The directory also runs a safety scan and a policy review that this command does not.

✔ Validation passed
```

</details>

`claude plugin test mods/sticky-notes`(exit 0):

```
tests/sticky.test.tsx:
(pass) commands and notes added by slash command show in the pane and are saved per repo [118.68ms]
(pass) a new session in the same repo loads the saved notes [49.81ms]
(pass) the summary button calls the model with the transcript [46.07ms]
(pass) a note is checked against the repo docs and the conversation [83.47ms]

 4 pass
 0 fail
Ran 4 tests across 1 file. [0.59s]
```

同梱 `claude-code.d.ts` のヘッダにある tsconfig(TypeScript 5、`strict`、`noUncheckedIndexedAccess`)で `hooks`・`types`・`tests` を含めた `tsc -p`(exit 0):

```
(no output, exit 0)
```

ライブセッション(作成したセッションで、開発フォルダから hot load した Mod): `/sticky`、`/sticky-cmd`、`/sticky-note` がそれぞれ `付箋ペインを開きました。`、`コマンドを付箋に追加しました。`、`認識を付箋に書き込みました。` と応答した。

**未検証:**

- ターミナル上のペインの見た目、およびペイン描画後に届いた判定が開き直さずに再描画されるか。テストハーネスでは、マウント済みのペインはバックグラウンドの照合による書き込みで再描画されなかった(マウントし直すと判定が出た)。エンジンは `$.state` の書き込みで読み手が再描画されると文書化しているが、ライブのペインはまだ誰も目視していない。
- 実際の store を使った、新しいセッションでの保存済みメモの読み込み(store をスタブしたテストのみ)。
- 実際のメモをこのリポジトリの文書に照らしたときの haiku の判定品質。
- `/plugin install sticky-notes@wanyaldee-skills` 経由のインストール(ライブ実行はマーケットプレイスではなく開発フォルダから)。
