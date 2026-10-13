# 0020: fable-coding —— 引き継いだコードを断じる前に仮説を立てる

(English: [0020-hypothesize-before-judging-inherited-code.md](../en/0020-hypothesize-before-judging-inherited-code.md))

## 背景 (Context)

ユーザーが(2026-10-13)、おそらく `fable-coding` に当たるものとして次の
規則を依頼した: アンチパターンに見えるコードにも、何らかの制約や事情が
ある可能性が高い。なぜそう実装したかの仮説を立て、必ず担当者に聞ける形に
しておく(担当者がいないケースもある)。ライブラリが不完全だったのか、
マシンスペックか、納期の都合か。こうした「大人の事情」を明確化して
おくことで、後の自分が困らないようにする。今の状態なら解決できそうで
あれば、提案ベースで残しておく(実装はしない)。

`fable-coding` には、すでに「ついで改善」の禁止(「気づいた隣接改善は
最後に提案として列挙し、実装しない」)と、自分のショートカットに付ける
`ponytail:` コメントがあった。しかしどちらも、引き継いだコードが**なぜ**
そうなっているのかを問うものではなかった。

## 決定 (Decision)

`skills/fable-coding/SKILL.md` に対して:

- §1(Understand before touching anything)に1項目を追加する。タスク範囲外の
  不自然なコード1件ごとに、4項目のメモを残す: 仮説、根拠、`git blame` の
  作者への質問(最終コミット日付き)、提案(未実装)。担当者が見つからない
  場合は「Owner: unknown」(または「left」)と書く。
- §3: `ponytail:` コメントに、天井とアップグレード経路だけでなく、その
  ショートカットを強いた制約も書く。
- Anti-patterns に追加: 「引き継いだコードを、なぜそう書かれたかの仮説も
  担当者への質問もないまま、間違いと断じたり置き換えを提案したりする」。

同じ変更を `SKILL.ja.md`、`skills/fable-coding/AGENTS.md`、ルート
`AGENTS.md` に反映する。プラグインのバージョンは 2.10.0 → 2.11.0。

## Reason(理由)

```markdown
**sync.py:9 `time.sleep(1.2)`, `per_page=50`**
- Hypotheses: (a) undocumented API rate limit hit in 2023; (b) deadline: commit says "quick fix before release"; (c) memory limit on the old worker host
- Evidence: `git blame` → h-tanaka, 2023-03-02, "quick fix before release"; no comment, no ADR
- Question for h-tanaka (last commit 2024-01): "Was the 1.2s sleep added because of 429s from /orders, or as a precaution before release?"
- Proposal (not implemented): if (a) no longer holds, `per_page=500` and no sleep cuts the sync from N/50 to N/500 requests; measure on staging first
```

- **禁止ではなく、4項目の固定の形にする。** ベースラインのエージェントは
  「ついで改善禁止」をすでに守っていた。欠けていたのは仮説と担当者への
  質問である。`superpowers:writing-skills` の「Match the Form to the Failure」
  によれば、要素の欠落に効くのは「〜するな」をもう1つ増やすことではなく、
  テンプレートに枠を設けることである。
- **「仮説は2つ以上」。** 1つだけだと、エージェントは最初に思いついた
  もっともらしい話を書く。ベースラインがまさにそうで、「レート制限」と
  推測し、コミットメッセージにある納期の兆候を見落とし、
  `requests==2.19.1` の固定を単に「古い」と扱った。2つ目の仮説を必須に
  すれば、どちらが有力かを根拠で選ばざるを得なくなる。
- **質問は `git blame` の作者宛てにし、最終コミット日を添える。**
  「チームに確認」では誰にも届かない。名前と日付があれば、読者はその人に
  まだ聞けるかを判断できる。これがユーザーの言う「担当者がいないケース」
  への対応である。「Owner: unknown」と書けば、誰も確認できなくても仮説は
  記録に残る。
- **提案は、制約がもう成り立たない可能性を根拠が示すときだけ書き、
  このタスクでは決して実装しない。** ユーザーの「提案ベースで残しておく
  (実装はしない)」に従っており、§3 にある既存の「ついで改善」禁止とも
  合っている。
- **`ponytail:` に制約を加える。** これは同じ問題の、書く側の対応である。
  制約(納期、ライブラリのバグ、マシンスペック)は、後の読者がコードから
  取り戻せない唯一の情報である。

## 却下した代替案 (Alternatives rejected)

- `writing-adrs` に入れる: ADR は自分の変更について書くものである。この
  規則は、どのタスクの最中でも他人のコードを読むときのもので、
  `fable-coding` §1 の領分である。
- 見つけるたびに自動で issue を立てる: 確認なしに外部のトラッカーへ公開
  することになり、雑然としたコードベースではトラッカーがあふれる。メモは、
  ユーザーが決めればそのまま issue に貼れる形にしてある。
- 先に担当者に聞いてからタスクを続けることを必須にする: 本来のタスクが、
  すでにいないかもしれない人を待って止まってしまう。

## 影響 (Consequences)

- 触った範囲に不自然なコードがあると、最終報告が長くなる。1件あたり4行。
- 仮説はあくまで推測である。価値は、当たっていることではなく、記録されて
  確かめられることにある。
- メモが残るのは最終報告の中で、ユーザーがどこかに残さない限り永続しない。
  永続化(issue、ADR、コードコメント)はユーザーに委ねる。

## 検証 (Verification)

エージェントが実行したツール検証(両 AGENTS.md の §1 が SKILL.md と一致し、
残り2つの変更が入っていることの確認):

```
$ for f in skills/fable-coding/AGENTS.md AGENTS.md; do diff <(sed -n '/Never guess an API/,/^#* *2\. Diagnose/p' skills/fable-coding/SKILL.md | sed '$d') <(sed -n '/Never guess an API/,/^#* *2\. Diagnose/p' $f | sed '$d') && echo "$f section1 identical"; grep -c 'constraint that forced it\|Calling inherited code wrong' $f; done
skills/fable-coding/AGENTS.md section1 identical
2
AGENTS.md section1 identical
2
```

サブエージェントによるテスト(単発の Sonnet、各1回。ADR 0014 と同じ軽量な
テスト段階):

- **ベースライン(変更前のスキル)**: `sync.py` の `total()` の `TypeError` を
  直すタスク。同じファイルの `fetch_orders` には `sleep(1.2)` と
  `per_page=50` があり、`requests==2.19.1` が固定されている。エージェントは
  バグだけを直し、根拠のない提案を2つ挙げた(「sleep と per_page がまだ必要か
  確認」「requests を更新」)。レート制限の仮説はエージェントの非公開メモに
  しか出てこなかった。バージョン固定については仮説がなく、納期の兆候
  ("quick fix before release")を見落とし、h-tanaka への質問も書かなかった。
- **グリーン、新規シナリオ**: React の `SettingsForm.tsx` の誤字修正。すぐ隣に、
  y-ishii(最終コミット 2022-02)による `setTimeout(…, 0)` の IME 回避策と、
  ci-bot による squash された "initial import" 由来の手書き `debounce` と
  React 17 の固定がある。エージェントは誤字だけを直した。各項目に確度付きの
  仮説を3つ挙げ、Safari IME 回避が最有力の理由だと判断して削除しなかった。
  y-ishii への質問には「もう在籍していない可能性あり」と注記した。ci-bot の
  分は「Owner: unknown」とし、旧リポジトリの履歴を当たるよう示した。
  lodash 化と React 18 化の提案は未実装と明記し、React の更新は固定の理由を
  確かめてからとした。

Verified-by: Claude Opus 5.5 (AI agent), 2026-10-13(上記の diff とサブエージェントテスト)

**Not verified**: グリーンテストはプレッシャーなしで1回だけ実行した。文言がユーザーの
意図に合っているかは、まだ人が確認していない。
