# 0015: Fable 5.1 ハーネスとの重複解消と、prompting-fable-5 の 5.1 対応

(English: [0015-dedupe-against-fable-5-1-harness.md](../en/0015-dedupe-against-fable-5-1-harness.md))

## 背景 (Context)

ユーザーが日常利用モデルを Claude Fable 5.1 に移行し、その前提でパッケージ
全体の監査を要求(2026-09-05)、続いて発見事項の修正を、サブエージェントへ
割り振りかつ下位モデルを適宜使う形で要求した。Opus 5 ハーネスを基準とした
ADR 0012 以降、3点が変わっていた。

1. Fable 5.1 の Claude Code ハーネスは、Opus 5 のときより多くの
   `fable-coding` の規則を自ら述べており、さらに Memory 節を持つように
   なったため `memory-discipline` の大半を覆っている。
2. Anthropic が2本のページを公開したが、パッケージはまったく反映して
   いなかった: *Prompting Claude Fable 5.1* と *What's new in Claude
   Fable 5.1*。`prompting-fable-5` は Fable 5 のガイドのみから抽出されて
   おり、refusal 時のフォールバック先を Opus 4.8 だけと書いていたが、
   現在は Opus 4.8 と Opus 5 の2つが許可対象である。
3. 3つの description(`fable-coding`, `dev-philosophy`, `memory-audit`)が
   スキルのワークフローを要約していた。スキル記述のガイダンスによれば、
   手順を述べた description はエージェントが本文を読まずに済ませる
   近道を作る。

## 決定 (Decision)

バージョン 2.8.0。互いに衝突しないようファイル単位で分割した4つの編集を、
判断の重さに応じてモデルを選び4エージェントへ割り振った(内容編集3件は
Sonnet、description のみの編集は Haiku)。

- **`fable-coding`**: 10項目を削除、2項目を書き換え。1726語 → 1448語。
- **`memory-discipline`**: ハーネスの Memory 節に対する差分として書き直し。
  499語 → 358語。
- **`prompting-fable-5`**: 「Fable 5.1 — what changed」節を追加し、
  Anthropic のスニペットを逐語で引用。フォールバック先を修正。`max` effort と
  「effort の名前はモデル間で同じ思考量に対応しない」旨を統合。リーク
  プロンプト由来の persona 節に出所と陳腐化の注記を付与。
- **description**: `fable-coding`, `dev-philosophy`, `memory-audit` を
  発火条件のみの記述に書き換え。

`README.md` と `.claude-plugin/plugin.json` を追随。触れたスキルの
`SKILL.ja.md` はすべて同じ変更内で更新した。

## 理由 (Reason) — なぜこの行で、他ではないのか

削除の基準は機械的とした: 本セッションの Fable 5.1 ハーネスのシステム
プロンプトが同じ内容を述べている行だけを削る。それでも判断を要した3箇所。

**§9 は空にせず、削って残した。** 元の項目:

```markdown
- Only stop for: destructive actions, DB writes (section 4), or real scope
  changes the user must decide. If you hit one of these, ask and end the
  turn — don't end on a promise.
```

を次に置き換えた:

```markdown
- DB writes (section 4) are a stop condition on top of the destructive
  actions and scope changes the harness already stops for.
```

- ハーネスは "Stop only for destructive actions or genuine scope changes the
  user must decide" と述べており、3つの停止条件のうち2つは既に供給されて
  いる。繰り返せばコーディングタスクのたびに予算を払うことになる。
- 「DB 書き込み」はその2つに含まれず、しかもこのスキルの §4 の存在理由
  そのものである。項目ごと削除すれば、ユーザー自身の規則を無言で落とす
  ことになる —— ADR 0012 が既知の天井として警告した失敗そのもの。
- ハーネスの一覧に「加わる」形で書いたので、後の読者はシステムプロンプトを
  手元に持たなくても、どちらがローカル分かを見分けられる。

**`memory-discipline` のフォーマットブロックを、テンプレートから差分にした。**
以前はフロントマターのテンプレート全体を再掲していた。現在はこれだけ:

```markdown
---
metadata:
  origin: <model-id>, <YYYY-MM-DD>
---
```

- `origin` だけを示すのは、それがハーネス自身のテンプレートに無い唯一の
  項目だからである。`name`・`description`・`type` を再掲すればハーネスの
  逐語コピーになり、この ADR が他のすべての箇所で除去している当のものに
  なる。
- セッションIDではなく `<model-id>, <YYYY-MM-DD>` を採るのは、セッションIDが
  トランスクリプト削除後に解決不能になるため。このスキルを生んだ
  2026-07-04 の監査は、セッションログを grep して帰属を回復したが、それは
  ログがまだ存在していたから成立した。フロントマターにはその依存が無い。

**サブエージェントの削除1件を差し戻した。** `memory-discipline` を圧縮した
エージェントは、ハーネスが覆っていると判断して次の規則を落とした:

```markdown
- A spec, architecture, or plan that already lives in `docs/` gets a pointer
  and the non-obvious delta, never a copy. Copying it is the spec-dump
  failure above.
```

これは復元した。ハーネスは "Don't save what the repo already records" と
禁止を述べて止まっている。この行は処方を述べており、かつ「リポジトリと
重複する仕様書丸写し」はスキル冒頭が存在理由として挙げる3つの発見の1つ
である。処方だけ削って苦情を残せば、そのファイルは自分が直し方を教えない
問題に文句を言うだけになる。同エージェントのもう1件の削除(保存すべき
種類の列挙)は受け入れた。ハーネスが同じ4型(user, feedback, project,
reference)を、同じ「why を含める」条件付きで列挙しているためである。

## 却下した代替案 (Alternatives rejected)

- **`fable-coding` を 5.1 向けに全面書き直し** — 内容は元からバージョンに
  依存しておらず、重複部分だけが依存していた。書き直しは churn。ADR 0012 と
  同じ理由。
- **ハーネスが Memory 節を持った以上 `memory-discipline` を削除** — 6つの
  規則にハーネス側の対応物が無く、うち `origin` と同ターン索引の2つは
  2026-07-04 の監査で最も多く違反が観測されたもの。
- **`prompting-fable-5-1` を別スキルとして分離** — description が数字1つしか
  違わない2スキルは互いに対して確実に発火できない。Anthropic 自身の 5.1
  ガイドが 5 ガイドへの差分として書かれているので、スキルもその形に倣う。
- **スニペット集を `references/` へ分離** — 再度肥大した場合には正しい手だが、
  プロンプトエンジニアリング時にしか読み込まれないスキルに対し、今日の
  時点で2ファイル目と間接参照のコストを払う価値が無い。保留(下記)。
- **description にワークフロー要約を残す** — 人がパッケージを一覧する分には
  読みやすいが、それは README の役割で、README には既に載っている。
- **サブエージェントを使わず本セッションで全部やる** — ユーザーの明示的な
  コスト指示により却下。各編集は独立かつファイル分割済みで、委譲が最も
  効く形をしている。

## 影響 (Consequences)

- パッケージは Fable 5.1 ハーネスが述べないものだけを持つようになった。
  `fable-coding` に残るのは真にローカルな部分: 日本語報告、DB 事前報告、
  ADR 必須、armadillo 則、確信度表示、3点チェックポイント、スタックノート。
- 既知の天井(ADR 0012 から継承し、さらに鋭くなった): 今回の削除は Fable 5.1
  の Claude Code ハーネスに合わせて較正されている。旧モデル、SDK エージェント、
  素の API 統合では、削除した行を供給するものが何も無い。復元元はこの ADR と
  v2.7.0 時点の git。
- `prompting-fable-5` はパッケージ中で突出して最大のスキルになった。増加分の
  大半は Anthropic の逐語スニペットであり、それがこのスキルの価値そのもので、
  かつプロンプトエンジニアリング時にしか読み込まれないため、サイズは受容する。
  再度肥大したら `references/` へ分離する。
- `memory-audit` は `[[memory-discipline]]` を採点基準として参照するが、
  そのスキルはもう Why/How 必須や `type` 分類の規則を述べていない。監査自体は
  自前でチェック項目を列挙しているので動作するが、リンク先の基準は
  チェックリストより狭くなった。現状のままとする。
- `dev-philosophy` は本文が日本語のため `SKILL.ja.md` を持たない。README に
  その旨を明記した(従来は抜け漏れに見えていた)。

## 検証 (Verification)

- ADR 0012 と同じくテキスト比較: 削除した各行を、本セッションの Fable 5.1
  Claude Code システムプロンプトと突き合わせてから削除した。
- Anthropic の2ページは 2026-09-05 に実取得した。既存の Fable 5 スニペットは
  現行の Fable 5 ガイドと再照合して一致を確認したため、書き直さず維持した。
- 8スキルすべてがパースする: フロントマター有り、`name` がディレクトリ名と
  一致、フロントマターは1024文字未満。
- フック2本を合成ペイロードで7ケース実行し、すべて期待どおり: 認証情報パスと
  破壊的コマンド・DB 直叩きは拒否、テンプレートと通常パスは許可。なお Bash
  フックは、このテストを書く最初の試み自体をブロックし、実動作を実演した。
- 未検証: ADR 0010・0011 と異なり、ネスト `claude -p` による RED/GREEN は
  実行していない。4件のうち3件は冗長性の除去か発火条件の言い換えであり、
  検証対象の主張は「変わっていない挙動が変わっていないこと」になってしまい、
  この手法では綺麗に示せない。description の書き換えだけはその形で検証できた
  はず(新しい description を与えられたエージェントが本文を読むか)だが、
  そのテストは実施していない。
