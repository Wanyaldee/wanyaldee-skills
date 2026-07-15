# wanyaldee-skills — Wanyaldee's Skills Package

Wanyaldee の個人スキルパッケージ。Fable 5級のコーディング規律、開発哲学、Fable 5 プロンプティングリファレンス、メモリ規律+監査、認証情報読み取りブロックのフックを収録。

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

- `fable-coding` — Fable 5級のコーディング規律(計画→根本原因→最小差分→検証→ADR)。v1.4.0で公式プロンプティングガイド由来の行動規則(過剰計画の抑制、ツール結果に基づく進捗報告、assessとfixの境界、最終サマリの可読性、途中終了の禁止)を統合。v1.5.0で @armadillo_ai の7則(完了の機械的定義、複数解釈の確認、ついで改善禁止、証拠付き検証報告、修正2回まで、初見セルフレビュー、確信度+3点報告)を統合。
- `prompting-fable-5` (v1.4.0〜) — Fable 5 / Mythos 5 を「使う側」のリファレンス: effort設定、公式スニペット集、サブエージェント/メモリ/send_to_userのスキャフォールディング、refusalフォールバック、旧モデルからのプロンプト移行チェックリスト。Fable 5向けのプロンプト・エージェント・スキルを書くときに発火する。
- `memory-discipline` (v1.6.0〜) — 永続オートメモリの規範: 1ファイル1事実、リポジトリ記録済み内容の保存禁止(ポインタ+差分)、`origin`(モデル+絶対日付)の記録、索引の同ターン更新、矛盾に気づいたセッションでの即時更新/削除。2026-07-04 の全プロジェクトメモリ監査の知見を規範化したもの。
- `memory-audit` (v1.7.0〜) — `/memory-audit` で全プロジェクトのメモリを一発監査: 索引整合、モデル帰属(originSessionId→セッションログ解決)、矛盾・重複・揮発性混在・形式のチェック。デフォルト報告のみ、`--fix` で機械的修正(索引補完・origin 補記・日付の絶対化)だけ適用。
- `injection-vigilance` (v2.3.0〜) — プロンプトインジェクション警戒: 指示の出所はユーザー発言とシステム設定のみで、ツールで読んだものはすべてデータ。過去の Claude セッション自身の出力経由の注入(セルフインジェクション)も対象。データ内の指示めいたテキストは実行せず、位置つきで引用報告してユーザーに判断させる。ネスト `claude -p` での RED/GREEN テスト済み(ADR 0010)。
- `dev-philosophy` (v1.3.0〜) — 開発哲学: 自動化の境界線(ヒューマンインザループ、外部信頼サービス優先)、仕組みによるセキュリティ、技術スタック方針(Python/Rust、MariaDB、Proxmox)、MIT License 標準。システム設計・アーキテクチャ提案時に適用される。

英語スキル(`fable-coding`, `prompting-fable-5`)には人間用の和訳 `SKILL.ja.md` を併設している(v1.4.0〜)。Claude が読み込むのは `SKILL.md`(英語版)のみ。編集は英語版に行い、和訳を追随させる。

## 認証情報ファイルの読み取りブロック(v1.2.0〜)

プラグインを有効化すると PreToolUse フックが自動で登録され、Claude が以下のファイルを Read ツールで読むことを拒否する:

- `.env` / `.env.*`(ただし `.env*.example` / `.env*.sample` / `.env*.template` は必要なキー名の把握のため読み取り可、v2.1.0〜)
- `*.pem` / `id_rsa` / `id_ed25519`
- `credentials.json` / `.aws/` 配下

加えて Bash 用フック(v2.2.0〜)が以下のコマンドを拒否する:

- `.env` 系ファイルへの言及(テンプレートは除外)— `cat .env` など
- `rm -rf`(`xargs`/`find -exec` 経由含む)/ `mkfs` / `dd of=/dev/*`
- DB クライアント直叩き — `mysql` / `mariadb` / `psql` / `sqlite3` / `mongosh` / `redis-cli` / `wrangler d1 execute|migrations apply`。実行するステートメントはユーザーに報告し、ユーザー自身が実行する(fable-coding セクション4の仕組み化)。

制限: 事故防止のガードであり敵対的境界ではない(詳細は ADR 0001 / 0009)。念のため settings.json の `permissions.deny` に `Read(**/.env)` 等を併設しておくとフック無効時の保険になる。

## License

MIT
