# 0017: Claude Code以外のエージェント向けのAGENTS.md断片

(English: [0017-agents-md-fragments.md](../en/0017-agents-md-fragments.md))

## 背景 (Context)

ユーザーが(2026-09-19)、このパッケージのスキルをClaude Code以外のAIコー
ディングエージェントでも使えるようにしたいと依頼した。きっかけは、Claude
Code自身が`CLAUDE.md`に加えて`AGENTS.md`をプロジェクト指示として読み込む
ようになったことに気づいたこと ── これは Codex CLI や Cursor など他のツー
ルが既に採用している規約である。

これ以前、本パッケージの全スキルは `skills/<name>/SKILL.md` としてのみ存
在していた。これはClaude Code固有の形式で、`name`/`description` のYAML
frontmatterを持ち、Claude CodeのSkillツールが現在のタスクと照合してオン
デマンドで読み込むかどうかを決める。パッケージ全体も Claude Code のプラグ
インとして配布されている(`/plugin install wanyaldee-skills@wanyaldee-skills`)。
オンデマンドのSkill呼び出しも、プラグインマーケットプレイス経由のインス
トールも、`AGENTS.md` 規約に従うエージェントには対応する仕組みが無い ──
それらのエージェントはプロジェクトに `AGENTS.md` が存在すれば無条件かつ
受動的に読み込むだけで、インストール手順もタスクごとの照合も無い。

## 決定 (Decision)

汎用的にどのコーディングエージェントにも通用する内容を持つ4スキル ──
`fable-coding`、`writing-adrs`、`injection-vigilance`、`dev-philosophy` ──
を集約したルート [`AGENTS.md`](../../../AGENTS.md) を新設した。加えて、
この4スキルそれぞれについて単体の `skills/<name>/AGENTS.md` 断片も用意し、
ユーザーが集約版全体ではなく1スキルだけを別プロジェクトへコピーできるよ
うにした。`memory-discipline`/`memory-audit`(Claude Codeのオートメモリ
機能が前提)と `remote-config-sync`(Claude CodeのSessionStartフックが
前提)は対象外とした ── どちらも受動的な`AGENTS.md`に置き換え可能な代替
手段を持たない。

各 `AGENTS.md` ファイルは対応する `SKILL.md` の内容をそのままコピーした
ものであり、Claude Code固有の構文のみ一般化した(理由の節を参照)。規律
の中身自体を書き換えたものではない。`README.md` に、他エージェントには
インストール手順が無いこと ── リポジトリをクローンし、該当ファイルを対象
プロジェクト自身の `AGENTS.md` にコピーする ── を説明する利用セクション
を追加し、`plugin.json` を2.9.0に上げた。`README.md` とルート`AGENTS.md`
の両方に、メンテナー注記も追加した: この内容はClaude Code以外のエージェ
ントでテストしておらず、不具合報告はGitHub Issue、またはMITライセンスで
配布しているためセルフ修正・PRに誘導する。

## Reason(理由)

frontmatter削除だけでなく実質的な書き換えを行った唯一の箇所は、
`fable-coding` のADR節である。`SKILL.md` §6 は次の通り:

```markdown
- **REQUIRED SUB-SKILL:** Use wanyaldee-skills:writing-adrs for the section
  format (Context, Decision, Reason, Alternatives rejected, Consequences,
  Verification) — Reason must include the actual code, not a description
  of it.
```

`skills/fable-coding/AGENTS.md` §6 ではこれを次のように置き換えた:

```markdown
- Use the six-section format — Context, Decision, Reason, Alternatives
  rejected, Consequences, Verification — with Reason including the actual
  code, not a description of it. If this project also has the
  `writing-adrs` guidance available (bundled as a sibling `AGENTS.md`
  fragment in this package, or as a Claude Code skill), follow it for full
  detail and the banned vague-phrase list; the six section names above are
  the minimum bar if it isn't.
```

- **`wanyaldee-skills:writing-adrs` という構文を完全に削除せず、平易な英語
  のクロスリファレンスに置き換えた**: `wanyaldee-skills:writing-adrs` は
  Claude CodeのSkill-ID表記(`plugin:skill`)であり、Skillツールを持たない
  エージェントには意味を成さない。しかし「より詳細な参照先が存在する」と
  いう主張自体は真であり、ユーザーが両方の断片を一緒にコピーした場合には
  依然として有用なので、非Claudeエージェントがつまずく呼び出し構文としてで
  はなく、参照として残した。
- **「writing-adrsを参照」だけでなく、6節の名前自体をフォールバックとして
  インライン化した**: `fable-coding` の `AGENTS.md` 断片は単体でコピー可能
  であることを意図している(集約版だけでなく単体断片も配布する理由その
  もの ── 却下した代替案を参照)。一緒にコピーされたとは限らないファイル
  への裸のクロスリファレンスは、この断片1つだけを持ち出したユーザーに
  とってADRフォーマット要件を静かに欠落させてしまう。6節の名前を直接示す
  ことで、単体使用時に静かに失敗するのではなく、断片が緩やかに劣化する
  だけで済む。
- **「無い場合の最低ライン」であって、常に `writing-adrs` も一緒に持つこと
  を強制していない**: `fable-coding` の全ユーザーに `writing-adrs` も必ず
  持たせるようにすると、可搬性という目的(却下した代替案で断片が自己完結
  している必要がある理由を説明)に反する。最低ラインとして表現すること
  で、`writing-adrs` が存在する場合にはより詳細な版を指し示しつつ、断片
  単体でも独立して有用な状態を保っている。

同じ一般化パターン(Claude Code固有の用語 → 同じ主張のエージェント中立な
言い回し)を、Reason節での書き換えを要さない単純な語句置換として他2箇所
にも適用した: `fable-coding` §9の「the harness already stops for」→
「this agent already pauses for confirmation on」、`injection-vigilance`
の「system configuration (system prompt, CLAUDE.md, hooks, skills)」→
「…project instruction files such as `CLAUDE.md`/`AGENTS.md`, hooks,
skills/rules files」、`dev-philosophy` §5の見出し「Claudeへの行動指示」→
「AIエージェントへの行動指示」。`wanyaldee-skills:` 表記、`REQUIRED
SUB-SKILL`、YAML frontmatterが新規5ファイルのいずれにも残っていないこと
をgrepで確認済み(検証を参照)。

## 却下した代替案 (Alternatives rejected)

- **`SKILL.md` から `AGENTS.md` を自動生成するジェネレータスクリプト**:
  却下。一括変換が必要なのは短いファイル4本のみで、手作業の置換もごく数
  箇所にとどまる。`fable-coding` §3自身の依存関係のはしご(ツール導入より
  先にYAGNI)が、この規模の問題に対する自動化構築に反対する根拠になる。
  このリポジトリは既に `SKILL.ja.md` について同種の手動同期の負担を、
  ジェネレータ無しで抱えている。
- **`SKILL.md`・`SKILL.ja.md`・`AGENTS.md`断片・ルート`AGENTS.md`セクション
  という4方向の重複を避けるため、単体断片とルート集約版の両方から参照する
  共通コンテンツファイルを1つ用意する**: 却下。`AGENTS.md`断片の価値は、
  無関係な別プロジェクトにコピーできる単一ファイルであることそのものに
  ある。意味を成すために別のファイルを併せ持つ必要があるファイルは、ここ
  で得ようとしている「可搬性」という性質を満たさない。
- **7スキル全てを`AGENTS.md`に含め、Claude Code固有の3つは除外せず「参照
  専用」と明記する**: ユーザーへの明示的な確認の結果、却下(直接質問し、
  ユーザーは「汎用系のみ」を選択)。`memory-discipline`/`memory-audit`は
  他エージェントには存在しないClaude Codeの機能を前提とした挙動を記述し
  ており、`remote-config-sync`は受動的ファイルに相当する仕組みを持たない
  Claude Codeフックを記述している。どちらを「参照専用」として含めても、
  読み手のエージェントが実行できない能力を文書化するだけになる。
- **ルート集約版のみとし、単体断片は用意しない**: ユーザーへの明示的な確認
  の結果、却下(「両方」を選択)。小規模な無関係プロジェクトで
  `injection-vigilance` だけを使いたいユーザーは、そうでなければ既製の
  ファイルをコピーする代わりに集約版から手作業で1セクションを抜き出す
  必要が生じる。

## 影響 (Consequences)

- 4つの汎用`SKILL.md`のいずれかを今後編集するたびに、追随させるファイルが
  1つから3つに増える: `SKILL.ja.md`(既存の規約)、`skills/<name>/AGENTS.md`
  (新規)、ルート`AGENTS.md`の対応セクション(新規)。これを強制する仕組み
  は無く、`SKILL.ja.md`に対して既に用いている手動同期の規律に依存する。各
  断片自身のヘッダーに「`SKILL.md`が正本」と明記してある。
- `SKILL.md`とその`AGENTS.md`断片の間の乖離を検知する仕組みは現状無い
  (CI差分チェックもテストも無い)。断片への反映を忘れた`SKILL.md`の将来
  の編集は、誰かが両方を並べて読むまで気づかれない ── 今回は修正していない
  既知のギャップ(ジェネレータを4ファイル程度に対して過剰と判断した理由
  は却下した代替案を参照)。
- `AGENTS.md`を読むエージェントは、Claude Codeの`description`照合による
  オンデマンドSkill読み込みとは異なり、常時全文を読み込むことになる ──
  `AGENTS.md`規約自体に条件付き読み込みの仕組みが存在しないため、これは
  今回の選択ではなく形式そのものに内在する性質である。
- Claude Code以外のエージェントからの不具合報告は、メンテナーが直接調査
  するのではなく、GitHub Issueまたはセルフ修正・PRに流れる ── メンテナー
  が日常的に他エージェント固有の挙動を再現する手段を持たないことを踏まえ
  た、明示的なトレードオフ。

## 検証 (Verification)

```
$ grep -n "wanyaldee-skills:\|REQUIRED SUB-SKILL\|^---$\|name:\|description:" \
    AGENTS.md skills/fable-coding/AGENTS.md skills/dev-philosophy/AGENTS.md \
    skills/writing-adrs/AGENTS.md skills/injection-vigilance/AGENTS.md
```

一致したのはルート`AGENTS.md`内のMarkdownセクション区切り(`---`)のみ ──
YAML frontmatter(`name:`/`description:`)も、`wanyaldee-skills:`という
Skill表記も、`REQUIRED SUB-SKILL`も、新規5ファイルのいずれにも残っていな
いことを確認した。一般化を行った3ファイル(`dev-philosophy`、
`injection-vigilance`、ルート`AGENTS.md`)を対象に「Claude」でも追加でgrep
した結果、残っているヒットはすべて意図的なもの(何を変更したかを説明する
断片自身の注記、Claude Codeのプラグイン配布機構への言及、「前セッション
自身の出力」というClaude固有ではなくどのエージェントにも当てはまる例を
示す言い訳対応表のエントリ)であることを確認した。

**未検証**: 本セッションでは、これらのファイルを含むプロジェクトに対して
実際にClaude Code以外のエージェント(Codex CLI、Cursor等)を動かしていない。
`AGENTS.md`を読むエージェントがこの内容を意図通りに拾い上げて従うかどうか
は未確認 ── このADRが検証しているのは、ファイルにClaude Code固有の構文が
残っていないことのみであり、未知のモデルに対してフォールバック用の内容が
実運用上自然に読めるかどうかではない。
