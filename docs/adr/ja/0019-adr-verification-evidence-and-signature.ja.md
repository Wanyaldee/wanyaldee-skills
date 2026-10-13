# 0019: writing-adrs —— Verification 節にログ全文・署名・操作記録を必須化

(English: [0019-adr-verification-evidence-and-signature.md](../en/0019-adr-verification-evidence-and-signature.md))

## 背景 (Context)

ユーザーが(2026-10-13)`writing-adrs` スキルの Verification 節の強化を
依頼した:

- 検証では、コンパイラなどのログを**全文**載せて証拠を残す。
- UIなどの検証は、誰が行ったかを必ず**署名**する。これにより誰が責任を
  取るべきかを明記する。Git を使っていれば誰がコミットしたかは記録
  できるが、ドキュメントにも残す。コミットした人と検証した人を
  突き合わせれば一定の信頼は置ける(それすら改ざんされたら元も子もないが)。
- 複数モデルによる相互チェックも一定の効果はあるが、必ずしも効果が
  あるわけではない。これは人の営みに照らしても同様である。
- 同日の追加依頼: DB の操作や `sudo` 権限を伴う操作など、重要な操作に
  ついても、必ずログとその意図、そして誰が検証したかを明記する。

変更前の Verification 節は2文(「実際に何を実行したか……何を検証して
いないか」)だけで、証拠をどういう形で書くかの規定はなかった。

## 決定 (Decision)

`skills/writing-adrs/SKILL.md` の `### Verification` に、エントリの2つの形を
追加する。ツール実行の検証はコマンドとログ全文、人が行う検証は何を確認した
かと `Verified-by:` の署名。あわせて、別モデルによるレビューは
`Reviewed-by:` として記録し、検証には数えないという規則を加える。さらに、状態を変える操作(DB の書き込み
やマイグレーション、`sudo`、デプロイ、サービスの再起動)のために3つ目の形を
追加する。操作ごとに1件の記録とし、**Operation / Intent / Target / Run by**、
ログ全文、そして**結果**を確認した人の `Verified-by:` 行を書く。言い訳表に
4行を追加し、クイックリファレンスの行を更新する。同じ変更を `SKILL.ja.md`、
`skills/writing-adrs/AGENTS.md`、ルート `AGENTS.md` の `writing-adrs` 節にも
反映する。プラグインのバージョンは 2.9.0 → 2.10.0。

## Reason(理由)

追加した本文の要点:

```markdown
**Tool-run checks (compiler, build, tests, linter, type checker): the
command and its full output.** Paste the log in a fenced block exactly as
printed — every warning, not just the last `Finished`/`ok` line. [...]
A long log goes inside a `<details>` block, still complete.

**Checks a person makes (UI, UX, behavior on a real device): what was
checked, and a signature.**

- Dark-mode toggle on the settings screen; sidebar contrast readable.
  Verified-by: wanyaldee (human), 2026-10-13

[...] An agent signs only checks it ran itself: when a human did the
check and the agent only heard about it, the human's name goes on the
`Verified-by:` line, not the agent's. A check nobody did is listed under
**Not verified**, never left unsigned.

**Review by another model is supporting evidence, not verification.** [...]
record it as `Reviewed-by: <model>`, but do not count it as a check of the
behavior.
```

- **形を分ける基準は、検証の種類ではなく誰が実行したか。** ツールの実行には
  それ自体の記録(ログ)があるので、証拠はログになる。人による確認は本人の
  言葉以外に記録が残らないので、証拠は本人の名前になる。「すべて署名する」
  という1つの規則にすると、それ自体が証拠になっているコンパイラ出力に
  エージェントが署名することになり、人による確認のほうは相変わらず何の
  裏付けもないまま残る。
- **規則は「全文」とし、削ることを認めない。** ベースライン(検証の節を
  参照)では、エージェントが `cargo build` のログを「成功(`Finished …`)、
  警告1件」に縮めていた。これはまさにユーザーがやめさせたい要約である。
  長いログの逃げ道は `<details>` とした。全文を文書内に残せるからである。
  「長ければ削ってよい」という条項を付けると、`superpowers:writing-skills`
  がニュアンス条項の弊害として警告している交渉の余地を再び開くことになる。
- **署名は散文ではなく `Verified-by:` のトレーラー行にする。** ベース
  ラインのエージェントもユーザーの名前は挙げていた(「wanyaldee が……
  チャットで言った」)。しかしそれは日付のない叙述で、責任を引き受ける
  記録としては読めなかった。`名前 (human|model), YYYY-MM-DD` という固定の
  トレーラーなら grep でき、git の `Co-Authored-By:` の慣習とも揃い、
  ユーザーが述べたとおりコミット者と検証者を並べて突き合わせられる。
  `(human)` / `(AI agent)` のタグは、モデル名が人の名前として通ってしまう
  のを防ぐ。
- **「エージェントが署名するのは自分で実行した検証だけ」。** 現実に起きる
  失敗は、ADR を書くのがエージェントで、UI を確認したのが人、という場面で
  ある。この一文がないと、エージェントが人の代わりに署名したり、自分が
  検証したわけではないからと署名そのものを省いたりしうる。
- **`Reviewed-by:` は `Verified-by:` とは別のトレーラーにする。** ユーザー
  の論点は、モデル間の相互チェックは役に立つが何も保証しない、ということ
  である。別のトレーラーにすれば、レビューを記録には残しつつ、挙動の検証
  の代わりにはさせずに済む。「That holds for human reviewers too」の一文が、
  人の営みに照らしても同じだというユーザーの比喩を担っている。

- **操作には、検証とは別の記録の形を与える。** 操作についてのベースライン
  (検証の節を参照)では、エージェントが `sudo systemctl stop`、`ALTER`、
  18,231 行の `UPDATE` のログを、`pytest` と同じリストに検証として貼って
  いた。しかしこれらは、後で誰かが追跡したり元に戻したりするかもしれない
  行為である。そのため、検証には要らない「対象」と「意図」が必要になる。
- **意図は、目的(「管理画面のため」)ではなく、その操作がもたらすべき
  結果(「既存の全行に NULL でない値が入る」)として書く。** 突き合わせ
  られるのは結果だけである。検証者が `SELECT COUNT(*) … IS NULL` を実行
  すれば、0 が返るか返らないかのどちらかになる。目的はそういう形では
  確かめられない。
- **「`Query OK` や exit 0 が示すのはコマンドが走ったことだけ」。** この
  一文がないと、マイグレーションの成功行がいちばん検証扱いされやすい。
  そして、それはデータが正しいことをいちばん示せないものでもある。

## 却下した代替案 (Alternatives rejected)

- ログを `docs/adr/logs/` に別ファイルで置いてリンクする: ログが ADR と
  ずれていき、リンクが切れれば証拠ごと失われる。ユーザーはログを文書内に
  載せるよう求めている。
- テキストの署名ではなく GPG 署名付きコミットにする: これで証明できるのは
  誰がコミットしたかで、誰が UI を見たかではない。ユーザーが「それだけでは
  足りない」と述べた git の記録そのものである。
- 操作用に7つ目の節を設ける: スキル全体(と既存の18本の ADR)は6節構成を
  前提にしている。また、操作の記録は Verification 節がすでに扱っている
  証拠と同じ種類のものである。
- Verification の一部として別モデルのレビューを必須にする: ユーザーは
  これが確実に効くわけではないと述べている。必須にすれば、保証のように
  見えるだけの儀式が増える。

## 影響 (Consequences)

- ADR が長くなる。ビルド/テストのログ全文で数十〜数百行増えうる。
  `<details>` を使えば GitHub 上での可読性は保てる。
- 人が確認していない UI 変更は、散文に紛れるのではなく **Not verified**
  にはっきり現れるようになる。これは意図したとおり。
- 署名はテキスト行なので、書き込み権限があれば誰でも編集できる。ユーザー
  が述べたとおり、得られるのは一定の信頼であって改ざん防止ではない。
- 既存の ADR 0001〜0018 は新形式に書き直していない。

## 検証 (Verification)

エージェントが実行したツール検証(AGENTS.md の2つの写しが、`### Verification`
以降で SKILL.md と一致することの確認):

```
$ diff <(sed -n '/^### Verification/,$p' skills/writing-adrs/SKILL.md) <(sed -n '/^### Verification/,$p' skills/writing-adrs/AGENTS.md) && echo FRAGMENT-IDENTICAL
FRAGMENT-IDENTICAL
$ diff <(sed -n '/^### Verification/,$p' skills/writing-adrs/SKILL.md | sed 's/^#/##/') <(sed -n '/^#### Verification/,/^## Injection/p' AGENTS.md)
75a76,79
> 
> ---
> 
> ## Injection vigilance (injection-vigilance)
```

操作についての追加後に、同じ2つのコマンドを再実行した:

```
$ diff <(sed -n '/^### Verification/,$p' skills/writing-adrs/SKILL.md) <(sed -n '/^### Verification/,$p' skills/writing-adrs/AGENTS.md) && echo FRAGMENT-IDENTICAL
FRAGMENT-IDENTICAL
$ diff <(sed -n '/^### Verification/,$p' skills/writing-adrs/SKILL.md | sed 's/^#/##/') <(sed -n '/^#### Verification/,/^## Injection/p' AGENTS.md)
105a106,109
> 
> ---
> 
> ## Injection vigilance (injection-vigilance)
```

(2つ目の diff に出ている差分は、範囲の終端として含めた区切り線と次節の
見出しだけである。)

サブエージェントによるテスト(単発の Sonnet サブエージェント、各1回。
ADR 0014 と同じく、`superpowers:writing-skills` が技法・リファレンス系
スキルに認めている軽量なテスト段階に従った):

- **ベースライン(変更前のスキル)**: Rust/Tauri のダークモードのシナリオ。
  警告1件を含む `cargo build` のログ、チャットでのユーザーの「問題なし」、
  レビュー用サブエージェントの LGTM を与えた。出力: ビルドログは1行に
  要約(「成功……警告1件」)。UI 確認は「wanyaldee がアプリを起動して……
  チャットで言った」と書かれ、署名も日付もなかった。2つの狙いの失敗が
  実際に起きることを確認した。
- **グリーン、同じシナリオ**: `cargo build` のログを警告込みで全文掲載。
  `Verified-by: wanyaldee (human), 2026-10-13`。レビュアーは
  `Reviewed-by:` として記録し、「補助的な証拠であり、挙動の検証ではない」
  と明記された。
- **グリーン、新規シナリオ**(Django の CSV エクスポート。`mypy` と
  `pytest` のログ、チームメイトによるスマホ/Excel での確認、GPT-6 との
  相互レビュー): 両方のログを mypy の `note:` と pytest の `RuntimeWarning`
  まで含めて全文掲載。チームメイトの確認は、そのチームメイトのハンドルと、
  記述した日ではなく確認を行った日(2026-10-12)で署名された。
  エージェントが署名したのは自分で実行した2つのコマンドだけだった。
  モデルのレビューは2件とも `Reviewed-by:` に記録され、自己レビューは
  独立したものではないと注記された。

操作についての追加(同じテスト段階):

- **ベースライン(ログと署名の規則はあるが、操作の規則はない状態)**:
  staging での MariaDB の `last_login_at` マイグレーション。`sudo systemctl
  stop`/`start`、`ALTER`、18,231 行のバックフィル `UPDATE`、`pytest`、
  ユーザーの「ログインできる」を与えた。ログは全文載ったが、状態を変える
  4つのコマンドが `pytest` と同じリストに、ツールによる検証として並んで
  いた。どのコマンドにも意図が添えられておらず、バックフィルの結果を
  確認した人の記録もなかった。狙いの欠落が実際に起きることを確認した。
- **グリーン、同じシナリオ**: 4件の操作がそれぞれ独立した Operation
  記録になった(意図、対象、実行者、ログ全文。`systemctl` は
  `(no output, exit 0)`)。バックフィルは `Query OK` を根拠に署名されず、
  NULL 件数を確認していないため Not verified に入った。ユーザーのログイン
  確認は人による検証として扱われ、バックフィルの署名には使われなかった。
- **グリーン、新規シナリオ**(本番でのファイル移動。`sudo rsync`、
  `sudo chown -R`、4,127 行の `psql` `UPDATE`、非推奨警告の出る
  `sudo systemctl reload nginx`、同僚によるブラウザでの5ファイル確認):
  4件の Operation 記録ができ、nginx の警告も全文載った。どの操作も
  未検証とされ、Not verified に挙げられた。同僚の確認は同僚のハンドルと
  確認日で署名され、旧ディレクトリがまだファイルを返すので `UPDATE` の
  証明にはならない、と注記された。旧ディレクトリを削除する前に、人が
  件数クエリを実行して署名するというフォローアップも追加された。

Verified-by: Claude Opus 5.5 (AI agent), 2026-10-13(上記の diff とサブエージェントテスト)

**Not verified**: 新しい節を人間はまだ読んでおらず、文言がユーザーの意図に
合っているかも確認されていない。これにはユーザーの承認が必要。テストは
各1回でプレッシャーもかけていないため、締め切りのプレッシャー
(「短くして」)の下でスキルがどう振る舞うかは、シナリオ自体の文言を通して
しか試していない。
