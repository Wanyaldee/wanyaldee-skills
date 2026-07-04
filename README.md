# fable-coding

Fable 5のコーディング規律をSkill化し、Sonnet 5などで再現するためのプラグイン。

## インストール

Claude Code内で:

```
/plugin marketplace add Wanyaldee/fable-coding
/plugin install fable-coding@fable-coding
```

Privateリポジトリのため、`gh auth login` 済み(または git の GitHub 認証設定済み)の環境が必要。

## 使い方

インストール後、コーディングタスクで `fable-coding` スキルが自動的に候補になる。明示的に使う場合はプロンプトで「fable-codingスキルを使って」と指示する。

## 収録スキル

- `fable-coding` — Fable 5級のコーディング規律(計画→根本原因→最小差分→検証→ADR)
- `dev-philosophy` (v1.3.0〜) — 開発哲学: 自動化の境界線(ヒューマンインザループ、外部信頼サービス優先)、仕組みによるセキュリティ、技術スタック方針(Python/Rust、MariaDB、Proxmox)、MIT License 標準。システム設計・アーキテクチャ提案時に適用される。

## 認証情報ファイルの読み取りブロック(v1.2.0〜)

プラグインを有効化すると PreToolUse フックが自動で登録され、Claude が以下のファイルを Read ツールで読むことを拒否する:

- `.env` / `.env.*`
- `*.pem` / `id_rsa` / `id_ed25519`
- `credentials.json` / `.aws/` 配下

制限: このフックがカバーするのは Read ツールのみ。`cat .env` のような Bash 経由の読み取りまで固めたい場合は、settings.json の `permissions.deny` に `Read(**/.env)` 等を併せて設定する(deny ルールは Bash コマンドにも適用される)。
