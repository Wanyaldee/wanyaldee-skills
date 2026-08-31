# 0014: writing-adrs スキル

(English: [0014-writing-adrs-skill.md](../en/0014-writing-adrs-skill.md))

## 背景 (Context)

ユーザーが(2026-08-31)ADRの書き方を専用スキルにまとめるよう要求した。
必要な要素を6つ明示的に列挙し、その中に新規の「Reason」節(なぜこの
コードを書いたか)を含めた —— コードそのものを掲載すること、あやふや
な説明を明示的に禁止することを要求。根拠として「AIによりコードを書く
負担は大幅に軽くなったが、それを説明できなければ責任を取れない」という
考え方が示された。

これ以前、ADRのガイダンスは `skills/fable-coding/SKILL.md` §6 内の4項目
の箇条書き(Context, Decision, Alternatives rejected, Consequences)
としてのみ存在していた。このフォーマットは、リポジトリの既存ADR13本
(`docs/adr/{en,ja}/`)が実際に使っている5節構成(Context, Decision,
Alternatives rejected, Consequences, **Verification**)からすでに乖離
しており、Reason節は元から存在しなかった。

## 決定 (Decision)

`skills/writing-adrs/{SKILL.md,SKILL.ja.md}` を新設。英語版を正本とし
(`fable-coding` や `injection-vigilance` など既存の英語コンテンツスキル
と同じ規約)、日本語版を人間向けに併設した。6節構成 —— Context,
Decision, Reason, Alternatives rejected, Consequences, Verification —— を
定義し、Reasonを強制対象の節とした: 実コードのコードブロック掲載を必須
とし、選択ごとの説明、あやふやな言い回しの禁止リスト、言い訳と実態の
対応表を付けた。

`fable-coding` の `SKILL.md`/`SKILL.ja.md` §6にあった4節構成のインライン
説明を、`writing-adrs` への「必須サブスキル」クロスリファレンスに置き
換えた。`plugin.json` を2.7.0に上げ、`README.md` のスキル一覧と英語版
併設ファイルに関する行を更新した。

## Reason(理由)

このADRが導入する核心は散文的な助言ではなく、`skills/writing-adrs/SKILL.md`
に埋め込まれた検査可能なテストである:

```markdown
**Anti-pattern — vague explanation.** These phrases are banned from a Reason
section because they would justify almost any implementation, not this one:

- "for reliability" / "for better performance" / "for robustness"
- "to handle edge cases" / "for better UX"
- "this is the standard/best-practice way to do it"

Each is a placeholder for a reason, not a reason. Test: could this sentence
be pasted into a *different* PR with *different* code and still sound right?
If yes, it explains nothing about this code.
```

- **一般的な指示(「具体的に書け」)ではなく、具体的な言い回しの禁止
  リスト**: サブエージェントによるベースラインテスト(検証を参照)で、
  「具体的に書け」という一般的な助言だけでは、もっともらしいが中身の
  ない散文が生成されることが確認された —— ベースラインの出力は
  「サーバーを叩き続けずにそれを吸収する」のような、具体的に見えて
  実際にはこの関数固有の値について何も説明していない言い回しを使って
  いた。禁止フレーズを名指しすることで、エージェントが自分の出力を
  照合できる具体的な基準を与える。
- **文字数やキーワードのルールではなく、転用可能性テスト**: 文字数や
  キーワードによるチェックは容易に回避される(あやふやな文をそれっぽい
  専門用語で水増しすればキーワードフィルタは通過できる)。転用可能性
  テスト(「その文を別のPRの別のコードに貼っても違和感なく通用するか」)
  は代理指標ではなく、問題の本体(一般論すぎること)そのものを狙う。
- **説明より先に、必須のコードブロックを置く。「コードを含めることを
  検討する」ではない**: ベースラインテストの散文は、コードを一度も
  示すことなく正確に説明していた。コードブロックを先に必須とすることで、
  読者は主張とコードを隣り合わせで見ることになり、信頼に頼らず突き
  合わせて検証できる。
- **`fable-coding` にフォーマット一覧を再度重複させるのではなく、
  クロスリファレンス(`REQUIRED SUB-SKILL: wanyaldee-skills:writing-adrs`)
  にした**: `fable-coding` 内の4項目の説明は、既にリポジトリの実際の
  ADR(5節構成、Verificationを含む)から気づかれないまま乖離していた。
  6節に拡張したインラインコピーをもう一つ作っても、正本のない競合する
  説明が3つ目できるだけである。`fable-coding` が指し示す先を1つに
  まとめた。

## 却下した代替案 (Alternatives rejected)

- **Reason要件を専用スキルにせず `fable-coding` の既存ADR箇条書きに
  直接組み込む**: 却下。`fable-coding` はあらゆるコーディングタスクで
  読み込まれるため、ADR執筆時にしか使わない参照資料(節ごとの詳細な
  フォーマット、実例、言い訳対応表)を抱えることになり、頻繁に読み
  込まれるスキルのトークン効率を重視する `superpowers:writing-skills`
  の方針に反する。
- **新スキルへのクロスリファレンスではなく、`fable-coding` の既存4節
  リストをその場で修正(Reason節を5つ目として追加)する**: 却下。
  すでに実際の運用(Verificationを含む)から乖離していたリストを
  さらに拡張しても、同じフォーマットを説明する競合コピーが2つ残る
  だけで、1つに収束しない。
- **コード掲載ルールをフックで強制する**(例: ADRの差分にコード
  ブロックが含まれるかをpre-commitでgrepするなど): 過剰と判断し却下。
  `dev-philosophy` の「仕組みによるガードレール、プロンプトに依存
  しない」という原則はセキュリティ関連の制約に向けたものであり、
  ADRの散文の質は機械的なフックでは評価できない判断事項である ——
  無関係なコードブロックを貼るだけで素朴なgrepは通過してしまい、
  Reason節自体は依然としてあやふやなままになりうる。

## 影響 (Consequences)

- `fable-coding` §6 は自己完結したフォーマット説明ではなく、単なる
  ポインタになった。ADRフォーマットを変更する人は
  `skills/writing-adrs/SKILL.md` のみを編集すればよく、クロス
  リファレンスの文言自体を変えない限り `fable-coding` 側に触れる
  必要はない。
- 既存ADR 0001〜0013はReason節の要件より前に書かれており、Reason節を
  持たない。今回は遡及的に追記していない —— 本変更のスコープ外であり、
  それを求める読者からの指摘もなかったため。これは今回の変更の見落と
  しではなく、初期ADRを読んでReason節を探す将来の読者にとっての既知の
  ギャップとして明記しておく。
- `README.md` のスキル一覧と `plugin.json` のバージョンは、今後
  `writing-adrs` の挙動を変える編集のたびに更新が必要になる。これは
  このリポジトリの既存のスキルごとのバージョニング規約に沿ったもの
  (`README.md` の `fable-coding` 項目のバージョン履歴がそのパターンの
  実例)。

## 検証 (Verification)

`superpowers:writing-skills` が定めるテクニック/リファレンス系スキル
向けの軽量テスト階層(規律強制系スキルを圧力下でテストする際の
5回以上反復のプロトコルではなく、単発反復)に沿って、サブエージェント
テストを2回実施した:

- **ベースライン(スキルなし)**: リトライ+バックオフのdiffに対して
  「Reason」節だけを書くよう指示した新規サブエージェントは、正確だが
  コードを一切含まない散文(上記Reason節に引用したテキストそのもの)
  を出力した —— 狙った失敗(もっともらしいが具体性のない散文、
  コード非掲載)が仮説ではなく実在することを確認。
- **グリーン(汚染あり)**: 同じサブエージェントに完成したスキルと
  **同一**のdiffを与えたところ、スキル内の実例をほぼそのまま再現した
  —— スキルの例題diffとテストdiffが同一だったため、証拠としては弱い。
- **グリーン(新規例)**: 別の新規サブエージェントに、完成したスキルと
  一度も見たことのない `debounce()` のdiffを与えたところ、コード
  ブロックを掲載した上で5つの選択ごとの正当化を行い、禁止フレーズは
  使用せず、関連する既知の制限(`cancel()`/`flush()` メソッドがない
  こと)をReason節内に捏造するのではなくConsequences相当の注記として
  正しく切り分けた —— スキルが、それを書いた際に想定していたコードを
  超えて汎化することを確認。

**未検証**: これはリファレンス系スキルであり規律強制系スキルではない
ため、敵対的な圧力(時間的プレッシャー、サンクコスト、「今回だけ」)下
でのテストは実施していない —— この階層のテストを適用しなかった理由は
`superpowers:writing-skills` の「Match the Form to the Failure」を参照。
将来、実運用でReason節が省略される事例が観測された場合は、現在の文言
が(テストされていない)圧力下でも通用すると仮定するのではなく、規律
スキル向けの防弾化プロトコル(言い訳対応表+レッドフラッグ、複合圧力
下でのテスト)にエスカレーションすること。
