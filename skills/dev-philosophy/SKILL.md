---
name: dev-philosophy
description: Wanyaldee's development philosophy — apply when designing or proposing any system, architecture, automation, UI/UX, or new project, and when choosing a language. Covers human-centered foolproof design (usable by anyone, safe against misuse), automation boundaries (human-in-the-loop, lean on trusted external services like GAS/Discord), security guardrails enforced by mechanism not prompts, per-domain language choice (Rust for DB, Python for AI/bots, C/C++ for embedded, TypeScript for web), spec/ADR content preserved as code comments, MariaDB/Proxmox stack, and MIT licensing for new projects.
---

# 開発哲学・実装ガイドライン (Wanyaldee)

システム設計・アーキテクチャ提案・新規プロジェクト立ち上げでは、以下の哲学を前提とする。

## 1. 人間中心設計 (Human-Centered & Foolproof)

- **システムを扱うのは人間である**: 人の営み(運用する人、間違える人、引き継ぐ人)を考慮した開発を行う。
- **誰が使っても扱えるものを作る**: 特定の熟練者や開発者本人にしか扱えないシステムにしない。
- **Foolproof を原則として開発する**: 誤操作・誤入力を前提に、間違えても壊れない・そもそも間違えにくい設計にする(安全なデフォルト、危険操作の分離と確認、入力の制約化)。

## 2. 自動化の境界線と設計思想 (Automation Boundaries)

- **外部信頼リソースの最大活用**: 認証、フォーム受付、通知、インフラ管理など、外部の信頼できる既存システム(Google Workspace / GAS、Discord など)に依存できる箇所は積極的にそれらを活用し、車輪の再発明を避ける。
- **ヒューマンインザループの徹底**: すべてをシステム側で完結(完全自動化)させようとせず、不確実性の高い処理や重要局面(イベント運営のコア決定、データの書き換え等)では、必ず「人間の意思(承認・確認)」を介在させる設計にする。
- **迅速な仕組み化 (Rapid Prototyping)**: 迅速な実装と運用の柔軟性が求められるケース(イベントの運営システム管理など)においては、Google Apps Script (GAS) などを駆使してスマートかつスピーディーにシステムを組み上げる。

## 3. セキュリティ哲学 (Security & Guardrails)

- **プロンプト依存の排除**: 機密情報の保護や禁止ルールの運用において、プロンプトベース(MEMORY や指示文など)による制御に依存せず、コードやシステム構造によって物理的にロックすることを最優先とする。
- **物理的制限の徹底**: 以下の危険な操作や機密アクセスは、システム・コマンドレベル、または Git やデータベースの権限設定において物理的に制限をかけるアプローチを採用する。
  - `.env` などの環境変数・機密ファイルの閲覧不可設定
  - `rm -rf` などの破壊的コマンドの全面禁止
  - Git コマンド、システムコマンド、DB 操作に対する適切なアクセス権限の制限

## 4. 開発・アーキテクチャ方針 (Development & Architecture)

- **コードは仕様書にはなり得ない**: コードを読めば分かる、を仕様の代わりにしない。仕様書や ADR に相当する内容(なぜこの設計か、何を保証するか)は、コード内のコメントとして書き残すこと。
- **プロジェクトによって向いている言語を必ず考えること**: 言語選定は案件の性質から導く。
  - DB 操作: **Rust**
  - AI・データサイエンス・Discord Bot など: **Python**
  - 組み込み: **C / C++**
  - Web 開発: **TypeScript**
- **シンプルかつリーガルリスクの低いライセンス選定**: オープンソースプロジェクトを展開する際は、シンプルであり法的複雑性を回避できる「MIT License」を優先的に採用する。
- **エコシステムの選定と技術スタック**:
  - 仮想化・コンテナ管理には **Proxmox** を活用し、仮想マシンやコンテナによるインフラ構築を行う。
  - 開発言語には、堅牢性と効率性を両立する **Python** および **Rust** を中心に据える。
  - データベースには **MariaDB** を選定し、Discord ボットや Web アプリケーションと連携した統合的なアーキテクチャを好む。
  - P2P 通信の実装などにおいて、IP アドレスの露出リスクを回避するようなプライバシー・セキュリティに配慮した設計を行う。

## 5. Claude への行動指示 (Instructions for Claude)

- **設計提案のルール**:
  - 提案するシステムに「完全自動化によるリスク」がある場合は、ダッシュボードでの承認ボタンや Discord での確認メンションなど、人間の判断を挟むステップ(承認フロー)を必ず組み込むこと。
  - ゼロからすべてを作るのではなく、「GAS とスプレッドシートを組み合わせる」「既存の API を活用する」といった、堅牢かつ手軽な外部サービス依存の選択肢をファーストステップとして提示すること。
  - 設計パターンでは、環境変数の隠蔽や破壊的操作の物理的制限が担保されているかを常に考慮すること。
- **ライセンス**: 新規プロジェクトのコード生成やリポジトリ構成を提案する際は、標準で MIT License の適用を前提とする。
