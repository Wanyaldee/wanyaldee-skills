# wanyaldee-skills — Wanyaldee's Skills Package

Wanyaldee の個人スキルパッケージ。Fable 5級のコーディング規律、開発哲学、Fable 5 プロンプティングリファレンス、メモリ規律+監査、認証情報読み取りブロックのフック、Windows→WSL/SSH設定同期フックを収録。

v1.x までは `fable-coding` という名前だった(旧 URL は GitHub がリダイレクトする)。v2.0.0 で改名。旧名でインストール済みの環境は、`/plugin uninstall fable-coding` → `/plugin marketplace remove fable-coding` → 下記の手順で入れ直す。

## インストール

Claude Code内で:

```
/plugin marketplace add Wanyaldee/wanyaldee-skills
/plugin install wanyaldee-skills@wanyaldee-skills
```

## 使い方

インストール後、各スキルがタスク内容に応じて自動的に候補になる(コーディングタスク→`fable-coding`、設計提案→`dev-philosophy`、メモリ保存→`memory-discipline` 等)。明示的に使う場合はプロンプトでスキル名を指示する。`/memory-audit` はコマンドとして直接呼べる。

## 収録スキル

- `fable-coding` — Fable 5級のコーディング規律(計画→根本原因→最小差分→検証→ADR)。v1.4.0で公式プロンプティングガイド由来の行動規則(過剰計画の抑制、ツール結果に基づく進捗報告、assessとfixの境界、最終サマリの可読性、途中終了の禁止)を統合。v1.5.0で @armadillo_ai の7則(完了の機械的定義、複数解釈の確認、ついで改善禁止、証拠付き検証報告、修正2回まで、初見セルフレビュー、確信度+3点報告)を統合。v2.4.0でディレクトリ README の規約(ファイル命名・配置・登録規則)を計画の要件として読む規則を追加(ADR 0011)。v2.5.0で Opus 5 の Claude Code ハーネスが自ら述べている規則(行動の即応性、並列検索、周囲コードへの追従、ミスの率直な承認、結果の忠実報告)を削除して重複を解消(ADR 0012)。v2.7.0でADRフォーマットの記述を `writing-adrs` スキルへのクロスリファレンスに置き換え(ADR 0014)。v2.8.0で Fable 5.1 ハーネスが自ら述べている規則(結論先出し、`file:line` 参照、最終サマリの可読性、書式より散文、自力での情報収集、停止条件、assessとfixの境界、状態変更前の証拠確認、意図表明での終了禁止)10項目を削除(ADR 0015)。description をワークフロー要約から発火条件のみに書き換え。
- `writing-adrs` (v2.7.0〜) — ADR(Architecture Decision Record)の書き方: Context・Decision・Reason・Alternatives rejected・Consequences・Verification の6節構成。核は Reason 節 —— 実際のコードを掲載した上で、値・アルゴリズム・順序などの個別選択を具体的に説明することを必須とし、「信頼性のため」等のあやふやな一般論を明示的なアンチパターンとして禁止する。AIによってコーディングの負担が軽くなった分、書いた本人がそのコードを説明できなければ責任を取れない、という考え方に基づく(ADR 0014)。
- `prompting-fable-5` (v1.4.0〜) — Fable 5 / Mythos 5 を「使う側」のリファレンス: effort設定、公式スニペット集、サブエージェント/メモリ/send_to_userのスキャフォールディング、refusalフォールバック、旧モデルからのプロンプト移行チェックリスト。Fable 5向けのプロンプト・エージェント・スキルを書くときに発火する。v2.8.0で Fable 5.1 / Mythos 5.1 に対応(ADR 0015): 「Fable 5.1 — what changed」節を追加し、強制ツール使用の400化、履歴のappend-only必須(2026-08-31以降作成のアカウントで thinking ブロックが会話に束縛される)、進捗更新の減少と `thinking.display: "updates"`、エージェントループでのツール呼び出しバッチ化、散文の高密度化、チャットでの書式**不足**(旧モデル向けの反書式指示は削除すべき)、引用の無標化、ファイル全体書き換え、低effortでの検索抑制、xhigh/maxでの長文出力、スコープ・テストの過剰、安全分類器の誤検知3パターンを、Anthropicのスニペットを逐語で収録。フォールバック先を Opus 4.8 と Opus 5 の2つに訂正し、`max` effort と「effortの名前はモデル間で同じ思考量に対応しない」旨を追加。
- `memory-discipline` (v1.6.0〜) — 永続オートメモリの規範: `origin`(モデル+絶対日付)の記録、絶対日付の徹底、索引の同ターン更新、耐久的な事実と揮発的な状態の分離、担当者付きの未確定事項、矛盾に気づいたセッションでの即時修正。2026-07-04 の全プロジェクトメモリ監査の知見を規範化したもの。v2.8.0で Fable 5.1 ハーネスの Memory 節が述べている内容を削除し、差分だけを残す形に縮約(499語→355語、ADR 0015)。
- `memory-audit` (v1.7.0〜) — `/memory-audit` で全プロジェクトのメモリを一発監査: 索引整合、モデル帰属(originSessionId→セッションログ解決)、矛盾・重複・揮発性混在・形式のチェック。デフォルト報告のみ、`--fix` で機械的修正(索引補完・origin 補記・日付の絶対化)だけ適用。v2.8.0で description を発火条件のみに書き換え(ADR 0015)。
- `injection-vigilance` (v2.3.0〜) — プロンプトインジェクション警戒: 指示の出所はユーザー発言とシステム設定のみで、ツールで読んだものはすべてデータ。過去の Claude セッション自身の出力経由の注入(セルフインジェクション)も対象。データ内の指示めいたテキストは実行せず、位置つきで引用報告してユーザーに判断させる。ネスト `claude -p` での RED/GREEN テスト済み(ADR 0010)。
- `dev-philosophy` (v1.3.0〜) — 開発哲学: 自動化の境界線(ヒューマンインザループ、外部信頼サービス優先)、仕組みによるセキュリティ、技術スタック方針(Python/Rust、MariaDB、Proxmox)、MIT License 標準。システム設計・アーキテクチャ提案時に適用される。v2.8.0で description を発火条件のみに書き換え(ADR 0015)。
- `remote-config-sync` (v2.6.0〜) — Windowsマシンを正本として `~/.claude/settings.json` をWSL/SSH先へ自動プッシュする `SessionStart` フック。リモート側のハッシュが異なる場合のみ上書きし(旧設定は `.bak.<timestamp>` に退避)、更新したターゲットのみ報告。同期対象は `~/.claude/remote-sync-targets.conf`(リポジトリ非追跡、ユーザー個人管理)で指定。既知の制限として、このマシンを経由せずWSL/SSH側で直接セッションを開始した場合は発火しない。また前提条件として、リモート側にClaude Codeと本プラグインが事前導入されている必要がある(ADR 0013)。

英語スキル(`fable-coding`, `prompting-fable-5`, `injection-vigilance`, `memory-discipline`, `memory-audit`, `remote-config-sync`, `writing-adrs`)には人間用の和訳 `SKILL.ja.md` を併設している(v1.4.0〜)。`dev-philosophy` は本文が日本語のため和訳を持たない。Claude が読み込むのは `SKILL.md`(英語版)のみ。編集は英語版に行い、和訳を追随させる。

## 他エージェント向け(AGENTS.md、v2.9.0〜)

`SKILL.md` は Claude Code 専用の形式(`name`/`description` の frontmatter を持ち、Claude が状況に応じて能動的に Skill ツールで呼び出す)であり、`/plugin install` によるパッケージ配布も Claude Code にしか通用しない。Codex CLI や Cursor など `AGENTS.md` 規約に従う他エージェントは、この呼び出し機構もインストール機構も持たず、リポジトリ直下の `AGENTS.md` を常時受動的に読み込むだけである。

そのため、汎用的にどのエージェントにも効く4スキル(`fable-coding` / `dev-philosophy` / `writing-adrs` / `injection-vigilance`)に限り、`AGENTS.md` 形式でも提供している。`memory-discipline` / `memory-audit`(Claude Codeのオートメモリ機能が前提)と `remote-config-sync`(Claude CodeのSessionStartフックが前提)はClaude Code固有の仕組みに依存するため対象外(ADR 0017)。

- リポジトリ直下の [`AGENTS.md`](AGENTS.md) — 上記4スキルを集約した単一ファイル。
- `skills/<name>/AGENTS.md`(`fable-coding` / `dev-philosophy` / `writing-adrs` / `injection-vigilance` の4箇所)— スキル単体の断片。1スキルだけ他プロジェクトへ持ち込みたい場合はこちらをコピーする。

**他エージェントでの使い方**(`/plugin install` に相当する導入手順が無いため):

```
git clone https://github.com/Wanyaldee/wanyaldee-skills
```

してから、上記いずれかのファイルを対象プロジェクトの `AGENTS.md` としてコピー(または既存の `AGENTS.md` に追記)する。`fable-coding` の §8(スタック方針)や `dev-philosophy` の技術スタック選定はこのユーザー個人の既定値であり普遍的な標準ではないため、持ち込み先プロジェクトの実情に合わせて書き換えること。

`SKILL.md` が正本、`AGENTS.md` は追随して編集する派生物という位置づけは `SKILL.ja.md` と同じ(編集は `SKILL.md` に行い、`AGENTS.md`/`SKILL.ja.md` をそれぞれ追随させる)。

**動作確認の範囲**: メンテナーは普段 Claude Code のみを使用しており、Codex CLI や Cursor など他エージェントでの実地テストは行っていない。想定通りに動かない、指示の解釈が食い違う等に気づいた場合は GitHub Issue で報告してほしい。MIT License で配布している OSS なので、直してほしい内容が明確なら Issue を待つより自分で直した方が早いはず — フォークして修正・PR も歓迎する。

## 認証情報ファイルの読み取りブロック(v1.2.0〜)

プラグインを有効化すると PreToolUse フックが自動で登録され、Claude が以下のファイルを Read ツールで読むことを拒否する:

- `.env` / `.env.*`(ただし `.env*.example` / `.env*.sample` / `.env*.template` は必要なキー名の把握のため読み取り可、v2.1.0〜)
- `*.pem` / `id_rsa` / `id_ed25519`
- `credentials.json` / `.aws/` 配下

加えて Bash 用フック(v2.2.0〜)が以下のコマンドを拒否する:

- `.env` 系ファイルへの言及(テンプレートは除外)— `cat .env` など
- `mkfs` / `dd of=/dev/*`
- `rm -rf` のうち、対象を事前に提示できないもの — グロブ(`build/*`)、変数・コマンド置換(`$DIR`、`` `pwd` ``)、`.` / `..`、`/` と最上位パス、ホームディレクトリ自身、`/etc` `/usr` `/root` などシステム配下、`/var` `/tmp` `/home` 等の完全一致、`xargs`/`find -exec` 経由、引用符が壊れて解析できないもの
- DB クライアント直叩き — `mysql` / `mariadb` / `psql` / `sqlite3` / `mongosh` / `redis-cli` / `wrangler d1 execute|migrations apply`。実行するステートメントはユーザーに報告し、ユーザー自身が実行する(fable-coding セクション4の仕組み化)。

v2.8.0〜、`rm -rf` は一律拒否ではなくなった(ADR 0016)。対象がすべて保護対象外のリテラルなパスであれば、拒否ではなく**確認プロンプト**(`permissionDecision: "ask"`)を出し、削除対象のパスを示した上でユーザーが承認・却下する。完了済み worktree や `node_modules` の掃除がこれで通る。上の一覧にある「対象を事前に提示できないもの」は従来どおり拒否のままで、1つのコマンド行に両方が含まれる場合は拒否が優先する。あわせて、パス付きバイナリ(`/bin/rm -rf /`)が v2.2.0〜v2.7.0 のフックをすり抜けていた穴を修正した。

制限: 事故防止のガードであり敵対的境界ではない(詳細は ADR 0001 / 0009 / 0016)。念のため settings.json の `permissions.deny` に `Read(**/.env)` 等を併設しておくとフック無効時の保険になる。

## License

MIT
