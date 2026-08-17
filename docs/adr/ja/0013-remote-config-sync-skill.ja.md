# 0013: Windows→WSL/SSH settings.json 同期スキル

(English: [0013-remote-config-sync-skill.md](../en/0013-remote-config-sync-skill.md))

## 背景 (Context)

ユーザーのメインエディタはZedであり、素のCLIではなくACP経由のClaude
Agentで編集を行っている。ユーザーは(2026-08-17、使い捨ての
`UserPromptSubmit` フックによる実測で)ZedのACP経由Claude Agentが同一
マシン上のCLIと同じ `~/.claude/settings.json` を読み込んでいることを
確認した ── 両方でフックが同一に発火した。続いて出た疑問: WSLやSSH
経由の編集でも同じ設定が自動的に反映されるか?

されない、かつデフォルトでは不可能。ZedのRemote Development(SSH)やWSL
統合は、エディタのheadlessサーバー ── したがってACPエージェントも ──
をリモート/WSL側で起動する。そちらは**自分自身の**ホームディレクトリの
`~/.claude/` を読む。Windows側の設定がその境界を自動的に越えることはない。

## 決定 (Decision)

`remote-config-sync` スキルと `SessionStart` フック
(`scripts/push-settings.sh`)を追加する。内容:

- このWindowsマシンを `settings.json` **のみ**の正本とする(`CLAUDE.md`や
  `hooks/`配下のスクリプトは対象外 ── ユーザーが全同期ではなく狭い範囲を
  選択)
- 同期対象は `~/.claude/remote-sync-targets.conf`(`wsl:<distro>` /
  `ssh:<hostエイリアス>` の行)から読む。ユーザー個人のホスト名が入るため
  リポジトリには含めない
- リモート側のSHA-256がソースと異なる場合のみプッシュ ── 変化なしなら
  無出力、更新したターゲットのみ日本語1行で報告(ユーザーが「書き換えが
  起きた際は必ず報告」を明示的に要求)
- 上書き前にリモートの旧 `settings.json` を削除せず
  `settings.json.bak.<timestamp>` へ退避

## 却下した代替案 (Alternatives rejected)

- **リモート側でフックを張り、Windows側との差分を検知する方式**:
  SSH先からWindowsのファイルシステムへ到達する経路が(逆方向接続の
  事前設定なしには)存在せず、結局各リモートに個別にプラグイン設定が
  必要になるため却下。
- **CLAUDE.mdやhooks/も同期対象にする**: ユーザーに提示したが、今回は
  `settings.json`のみに絞ると選択された。
- **双方向同期**: 単一の正本からの一方向プッシュとし、要求されていない
  マージコンフリクト処理を避けるため却下。

## 影響 (Consequences)

- スキルに明記した既知の限界: フックは**このWindowsマシンでセッションが
  開始したとき**のみ発火する。Windowsを経由せずWSL/SSH内で直接セッション
  を開いた場合はプッシュされない ── そちら側で発火するフックが存在せず、
  仮にあっても接続経路がない。
- `remote-sync-targets.conf` はマシンごとに手動作成が必要
  (`scripts/remote-sync-targets.conf.example` がテンプレート) ──
  共有プラグインパッケージに個人のホスト名を持ち込まないための意図的な
  設計。
- 手動実行も引き続き可能:
  `sh skills/remote-config-sync/scripts/push-settings.sh`
- **単なる同期漏れではない、必須の前提条件:** この仕組みが役立つのは、
  リモートのWSLディストリ/SSHホスト側に**すでにClaude Codeとこの
  `wanyaldee-skills` プラグインがインストール済み**の場合のみ。
  `settings.json` を送りつけるだけでは何もインストールされない ──
  `settings.json` は `enabledPlugins`/`extraKnownMarketplaces` を名前で
  参照しているだけで、実体を持ってこない。リモート側にClaude Code
  または本プラグインが未導入の場合、そのリモートで動くZedのACPエージェント
  はそもそも起動しないか、本パッケージのhooks/skillsを一切持たないまま
  静かに起動してしまう。新しいリモート先へのClaude Code + プラグインの
  導入は、この同期とは別に手動で行う必要がある。

## 検証 (Verification)

スクリプト作成前にユーザーのマシンでツール類の存在を確認済み:
`sha256sum`・`wsl.exe`・`ssh` はいずれもフックが動くGit Bash環境で解決
できる。ハッシュ比較→退避→上書きというスクリプトのロジック自体は、この
セッション内で実際のWSL/SSHターゲットに対してエンドツーエンドでは
実行していない(`remote-sync-targets.conf` をユーザーがまだ用意して
いないため)。初回の実運用時に、ターゲット側に
`settings.json.bak.<timestamp>` が現れることを確認してから、以降の
静かな動作を信頼すること。
