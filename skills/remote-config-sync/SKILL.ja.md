---
name: remote-config-sync
description: このWindowsマシンの ~/.claude/settings.json を、設定済みのWSLディストリビューション/SSHホストへ自動プッシュする SessionStart フックの説明とトラブルシューティング。リモート側の settings.json が古い理由、同期対象の追加方法、WSL/SSH上でhook/pluginが反映されない理由を聞かれたとき、または手動同期を実行したいときに使う。
---

# リモート設定同期

このマシン(Windows)を `~/.claude/settings.json` の正本(source of truth)
とする。このプラグインの `hooks/hooks.json` に登録された `SessionStart`
フックが、このマシンでのセッション開始のたびに `scripts/push-settings.sh`
を実行する。スクリプトは設定済みの各WSLディストリビューション/SSHホストへ
`settings.json` をプッシュするが、**リモート側のハッシュがソースと異なる
場合のみ**行う ── 変化がなければ無出力、更新したターゲットのみ日本語1行で
報告する。

## 対象範囲

同期するのは `settings.json` のみ(hooks・`enabledPlugins`・
`extraKnownMarketplaces` などを含む)。`CLAUDE.md` や `hooks/` 配下の
個別スクリプトは対象外(2026-08-17にユーザーと確認済み)。今後必要になれば
追加を検討する。

## 既知の制限

このフックは **Windows側でセッションが開始したときだけ** 発火する。
ユーザーがこのマシンを経由せず、WSLやSSH先で直接Claude Code(あるいは
Zed経由のACPエージェント)を開いた場合、そちら側で発火するフックが存在
せず、かつリモート側からこのマシンのファイルシステムへ到達する経路も
ないため、何も同期されない。聞かれたらこの点は正直に伝えること ──
リモート側でも自動的に同期されるかのような説明はしない。

さらに根本的な前提条件として: この仕組みが意味を持つのは、リモートの
WSLディストリ/SSHホスト側に**すでにClaude Codeとこの`wanyaldee-skills`
プラグインがインストール済み**の場合のみである。`settings.json` を
プッシュしても何もインストールされない ──
`enabledPlugins`/`extraKnownMarketplaces` を名前で参照しているだけ。
どちらかがリモートに欠けていると、そちらで動くZedのACPエージェントは
起動しないか、本パッケージのhooks/skillsを持たないまま静かに起動する。
新しいリモート先へのClaude Code + プラグインの導入は、このスキルの
対象外の別作業。

## 同期対象の追加方法

1. `scripts/remote-sync-targets.conf.example` を
   `~/.claude/remote-sync-targets.conf` にコピーする(このリポジトリには
   含めない ── ユーザー個人のホスト名が入るため)
2. 1行につき1ターゲット: `wsl:<ディストリ名>` または
   `ssh:<~/.ssh/config のHostエイリアス>`
3. 次回セッション開始時に同期される。すぐ試したい場合は手動実行も可能:
   `sh skills/remote-config-sync/scripts/push-settings.sh`
   (プラグインのインストール先、またはフルパスで実行)

## トラブルシューティング

- セッション開始時に何も出力されない = `remote-sync-targets.conf` が
  存在しないか、全ターゲットのハッシュが既に一致している。どちらも
  正常な(静かな)結果。
- 特定ターゲットが更新されない: `wsl.exe -l -v` で正確なディストリ名を
  確認するか、SSHエイリアスがパスワードなしで解決するか
  (`ssh <alias> true`)を確認する(フックにはTTYがなくパスワード入力を
  待てないため、鍵認証必須)。
- 上書き前のリモート側 `settings.json` は削除されず、
  `settings.json.bak.<タイムスタンプ>` にリネームされるだけ。
