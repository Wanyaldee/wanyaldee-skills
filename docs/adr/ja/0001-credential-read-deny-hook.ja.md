# 0001: 認証情報ファイルの読み取りブロックをプラグインフックとして同梱する

(English: [0001-credential-read-deny-hook.md](../en/0001-credential-read-deny-hook.md))

## Context(背景)

ユーザーは .env 系の認証情報ファイルを「スキルの文面ではなく仕組みで」Claude から保護したいと考え、さらにその保護を `fable-coding` プラグインのインストールだけで各環境に適用できるようにしたかった。しかし Claude Code のプラグインは `permissions.deny` ルールを同梱できない — permission ルールは settings ファイル(user/project/local/managed)専用である。一方、hooks はプラグインに同梱でき、プラグインを有効化すると自動で読み込まれる。

## Decision(決定)

`hooks/hooks.json` で `PreToolUse` フック(matcher: `Read`)を登録し、`.claude-plugin/plugin.json` に `"hooks": "./hooks/hooks.json"` を宣言した。フックは `hooks/deny-secrets.py`(python3、stdlib のみ)を実行し、対象 `file_path` のベース名を固定の deny リスト(`.env`、`.env.*`、`*.pem`、`id_rsa`、`id_ed25519`、`credentials.json`)と照合、加えてパスに `/.aws/` を含む場合も一致とみなし、一致時に `permissionDecision: "deny"` を返す。バージョンを 1.2.0 に上げた。

## Alternatives rejected(却下した代替案)

- **プラグインに `permissions.deny` を同梱する** — 非サポート。プラグインには settings を注入する面がない。
- **Node スクリプト(ponytail プラグインと同方式)** — このユーザーは nvm 経由の Node のため、非対話シェルのフック実行時に node が PATH にある保証がない。python3 は Linux/macOS でほぼ確実に存在する。
- **Bash ツールにもマッチさせてコマンド文字列を grep する** — コマンドテキストへの正規表現はノイズが多く(`.env.example` への言及、書き込み、コメントで誤検知)、それでも容易に回避可能。Bash 側は settings の `Read(...)` deny ルールの方がうまくカバーする。

## Consequences(帰結)

- プラグインをインストール・有効化した環境は、追加設定ゼロで Read ツールによる認証情報ファイル読み取りがブロックされる。
- `.env.example` / `.env.sample` も `.env.*` に一致してブロックされる(安全側に倒した仕様として許容)。
- 上限(deny-secrets.py 内の `ponytail:` コメント): このフックがカバーするのは Read ツールのみ。Bash 経由の読み取り(`cat .env`)や Grep 出力経由の内容漏えいは対象外 — 固くカバーしたい場合は settings の `permissions.deny` に `Read(...)` ルールを併設する(README に記載)。
- python3 が PATH にない Windows ではフックエラーになり fail open する。Windows 対応が必要になったら `commandWindows` バリアントを追加する。
- 想定外の stdin に対しては fail open する(ハーネスは常に正しい JSON を送るため理論上の話)。
