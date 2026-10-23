# 0021: 他エージェント向け install.sh —— Agent Skills 優先、AGENTS.md は予備

(English: [0021-install-script-for-other-agents.md](../en/0021-install-script-for-other-agents.md))

## 背景 (Context)

ユーザーが(2026-10-23)、他エージェント向けの導入を「clone して
`AGENTS.md` を手でコピー」(v2.9.0、ADR 0017)ではなく、エージェントを
選ぶとそれに応じた方式でインストールするシェルスクリプトにできないかと
依頼した。

ADR 0017 は「Claude Code 以外のエージェントにはオンデマンド読み込みの
仕組みがなく、`AGENTS.md` を受動的に読むだけ」という前提だった。
2026-10 時点ではこれはもう成り立たない。このセッションで確認した公式
ドキュメントの内容は次のとおり。

- Codex CLI: `$HOME/.agents/skills`、リポジトリの `.agents/skills`、
  `/etc/codex/skills` からスキルを読む。frontmatter は `name`/`description`
  で、本文は必要になった時点で読み込む(progressive disclosure)。
  `AGENTS.md` の読み込みは `project_doc_max_bytes`(既定 32 KiB)で打ち切る。
- Cursor: `.agents/skills`、`.cursor/skills`、`~/.agents/skills`、
  `~/.cursor/skills` を読む。
- Gemini CLI: `~/.gemini/skills` またはその別名 `~/.agents/skills`、
  ワークスペースの `.gemini/skills` または `.agents/skills` を読む。
- GitHub Copilot: `~/.copilot/skills` とリポジトリの `.github/skills` を読む。
  これは Microsoft の Visual Studio ドキュメントを検索要約経由で確認した
  もの(確度: 中)。

変更前のルート `AGENTS.md` は 31,567 バイトで、Codex の上限 32,768 バイトの
すぐ下だった。既存の `AGENTS.md` があるプロジェクトに追記すると、末尾が
切り捨てられる。

ユーザーに確認して決めたこと: 対応エージェントにはスキル形式で入れ、
`AGENTS.md` は予備にする。インストール先はホームディレクトリを既定とし、
`--project DIR` も選べるようにする。

## 決定 (Decision)

リポジトリ直下に `install.sh`(POSIX sh)を追加した。エージェントは対話
メニューか `--agent codex,cursor,gemini,copilot,agents-md` で選ぶ。
`--project DIR` を付けると、書き込み先をホームディレクトリからその
リポジトリに切り替える。`--dry-run` は書き込み先を表示するだけで何も
書かない。`--yes` が無ければ書き込み前に確認を求める。

入れるのは `fable-coding`、`writing-adrs`、`injection-vigilance`、
`dev-philosophy` の4つ(ADR 0017 と同じ選定)。`<dir>/<name>/SKILL.md` として
書き込む。`<dir>` は Codex/Cursor/Gemini なら `.agents/skills`、Copilot なら
`.copilot/skills`(ユーザー)または `.github/skills`(プロジェクト)。
`agents-md` は `--project` が必須で、ルート `AGENTS.md` を
`DIR/AGENTS.md` の `<!-- wanyaldee-skills:begin/end -->` マーカーの間に
書き込む。再実行時はこのブロックを置き換えるので、二重には入らない。

あわせて README の使い方、ルート `AGENTS.md` の「Using this in another
project」の手順2を更新し、`plugin.json` を 2.12.0 に上げた。

## Reason(理由)

```sh
case "$a" in
    codex|cursor|gemini) add_target "$BASE/.agents/skills" ;;
    copilot)
        if [ -n "$PROJECT" ]; then add_target "$BASE/.github/skills"
        else add_target "$HOME/.copilot/skills"; fi ;;
```

- **`~/.codex`・`~/.cursor`・`~/.gemini` それぞれではなく、共通の
  `.agents/skills` 1箇所にする**: 3者とも `.agents/skills` を読む。
  Cursor と Gemini は自分専用のフォルダも読むので、両方に書くと Cursor には
  `fable-coding` が2つ見えてしまう。`add_target` が重複を除くので、3つ
  選んでも書くのは1部だけ。
- **Copilot だけ別フォルダにする**: Copilot が `.agents/skills` を読むという
  記述は、CLI ドキュメントのミラーでしか見つからなかった。Microsoft が文書化
  しているのは `.github/skills` と `~/.copilot/skills`。

```sh
render_skill() {
    awk 'NR==1 && $0=="---" {fm=1; print; next} fm {print; if ($0=="---") exit}' \
        "$REPO/skills/$1/SKILL.md"
    echo
    awk '
        NR==1 { sub(/ — AGENTS\.md (fragment|断片)$/, ""); print; next }
        state==0 && /^>/ { state=1; next }
        state==1 && /^>/ { next }
        state==1 { state=2; if ($0=="") next }
        { print }
    ' "$REPO/skills/$1/AGENTS.md"
}
```

- **`SKILL.md` をそのままコピーせず、frontmatter は `SKILL.md` から、本文は
  `AGENTS.md` 断片から取る**: `SKILL.md` には Claude 専用の書き方が残っている
  (`REQUIRED SUB-SKILL: Use wanyaldee-skills:writing-adrs`、"the harness
  already stops for"、設定ファイルとして `CLAUDE.md` だけを挙げている箇所)。
  断片では ADR 0017 でまさにこれらを一般化済み。それを再利用すれば、今後
  `SKILL.md` を編集するたびに追随させる置換ルールを新しく持たずに済む。
- **最初の引用ブロックとタイトル末尾を削る**: どの断片も冒頭が
  `> Standalone AGENTS.md copy ... see [SKILL.md](SKILL.md)` で始まり、そこの
  相対リンクはこのリポジトリの外では壊れる。削るのは最初に連続する `>`
  ブロックだけ(`state` 0→1→2)なので、本文の途中にある引用は残る。

```sh
install_file() {
    if [ -f "$1" ]; then
        if cmp -s "$1" "$2"; then echo "  unchanged $1"; return; fi
        cp "$1" "$1.bak.$STAMP"
    fi
```

- **退避はフォルダの改名ではなく `SKILL.md.bak.<stamp>`**:
  `fable-coding.bak.<stamp>/` のようなフォルダに `SKILL.md` が残っていると、
  2つ目のスキルとして読み込まれてしまう。ファイル名が `SKILL.md` でなければ
  無視される。
- **`cmp -s` で同一ならスキップする**: 再実行しても何も起きず、`.bak` が
  溜まらない。
- **`rm` を一切使わない**: `cp` で上書きすれば足りる。これでこのパッケージ
  自身の `rm -rf` フック(ADR 0016)にも引っかからない。

```sh
[ "$size" -le 32768 ] || echo "  warning: $dest is $size bytes; Codex truncates past 32768 by default ..."
```

- `agents-md` モードでは拒否ではなく警告にする: 書き込み先が Codex 用とは
  限らず、上限はエージェントによって違う。警告には切り捨てを避ける方法
  (`--agent codex` でスキル形式にする)を書いた。

## 却下した代替案 (Alternatives rejected)

- **エージェントごとの AGENTS.md 系ファイルだけにする**(GEMINI.md、
  `.cursor/rules/*.mdc`、`copilot-instructions.md`): ユーザーが却下。
  常時読み込みのままで、32 KiB の切り捨ても解決しない。
- **7スキルすべてを入れる**: `memory-*` と `remote-config-sync` は Claude Code
  の仕組みに依存する(ADR 0017 と同じ理由)。
- **clone せずに `curl | sh`**: スクリプトは同じリポジトリ内のスキルファイルを
  必要とする。また、読んでいないリモートのコードをシェルに流し込むのは、
  このパッケージの injection-vigilance の考え方に反する。
- **スクリプトに Claude Code 用モードを持たせる**: プラグインで入るので不要。
  メニュー6は `/plugin` コマンドを表示するだけにした。

## 影響 (Consequences)

- この方法で入れたスキルはその時点のコピーになる。`git pull` の後は
  `install.sh` を再実行する。変化の無いファイルはスキップし、変化した
  ファイルは退避してから上書きする。
- エージェントごとのパスは 2026-10-23 時点のドキュメントに基づく。どこかの
  エージェントがフォルダを変えたら、直すのは `case` の分岐だけで済む。
- README とルート `AGENTS.md` で `install.sh` に触れた。ルート `AGENTS.md` は
  31,735 バイトに増えたが、単体ではまだ 32 KiB 未満。
- アンインストール機能は無い。外すときは4つのフォルダを手で消す。誰も
  求めていないので作らなかった(YAGNI)。

## 検証 (Verification)

`shellcheck install.sh`(`uvx --from shellcheck-py` 経由): 出力なし、exit 0。

一時的な `HOME` に対して最後まで実行した(`$T` は作業用ディレクトリ。
`proj/AGENTS.md` には事前に `# existing\nkeep me` を置いた)。トレースは
`set -x` によるもので、シェルの `grep` ラッパー関数の行だけ除いた。それ
以外は表示されたとおり:

<details>
<summary>ログ</summary>

```
++ HOME=$T/home
++ /home/ko200/wanyaldee-skills/install.sh --agent codex,cursor,gemini,copilot --yes
Will write:
  $T/home/.agents/skills/fable-coding/SKILL.md
  $T/home/.agents/skills/writing-adrs/SKILL.md
  $T/home/.agents/skills/injection-vigilance/SKILL.md
  $T/home/.agents/skills/dev-philosophy/SKILL.md
  $T/home/.copilot/skills/fable-coding/SKILL.md
  $T/home/.copilot/skills/writing-adrs/SKILL.md
  $T/home/.copilot/skills/injection-vigilance/SKILL.md
  $T/home/.copilot/skills/dev-philosophy/SKILL.md
Existing files that differ are kept as <file>.bak.20261023095259.
  wrote     $T/home/.agents/skills/fable-coding/SKILL.md
  wrote     $T/home/.agents/skills/writing-adrs/SKILL.md
  wrote     $T/home/.agents/skills/injection-vigilance/SKILL.md
  wrote     $T/home/.agents/skills/dev-philosophy/SKILL.md
  wrote     $T/home/.copilot/skills/fable-coding/SKILL.md
  wrote     $T/home/.copilot/skills/writing-adrs/SKILL.md
  wrote     $T/home/.copilot/skills/injection-vigilance/SKILL.md
  wrote     $T/home/.copilot/skills/dev-philosophy/SKILL.md
Done. Restart the agent if the skills don't appear.
++ echo exit=0
exit=0
++ HOME=$T/home
++ /home/ko200/wanyaldee-skills/install.sh --agent codex --yes
++ grep -c unchanged
4
++ HOME=$T/home
++ /home/ko200/wanyaldee-skills/install.sh --agent agents-md --project proj --yes
Will write:
  $T/proj/AGENTS.md  (wanyaldee-skills block, replaced on re-run)
Existing files that differ are kept as <file>.bak.20261023095259.
  wrote     $T/proj/AGENTS.md
Done. Restart the agent if the skills don't appear.
++ echo exit=0
exit=0
++ HOME=$T/home
++ tail -2
++ /home/ko200/wanyaldee-skills/install.sh --agent agents-md --project proj --yes
  unchanged $T/proj/AGENTS.md
Done. Restart the agent if the skills don't appear.
++ grep -c wanyaldee-skills:begin proj/AGENTS.md
1
++ head -2 proj/AGENTS.md
# existing
keep me
++ HOME=$T/home
++ /home/ko200/wanyaldee-skills/install.sh --agent agents-md --yes
install.sh: agents-md needs --project (there is no shared user-level AGENTS.md path)
++ echo exit=1
exit=1
```

</details>

シェルの `grep` は ugrep を包むラッパー関数だった。そのため、Claude 専用の
書き方が残っていないかの確認は、`/usr/bin/grep` で対照パターン付きで
やり直した:

```
$ /usr/bin/grep -rn 'wanyaldee-skills:\|REQUIRED SUB-SKILL\|AGENTS.md fragment\|断片' home/.agents home/.copilot; echo "leftover-grep exit=$?"
leftover-grep exit=1
$ /usr/bin/grep -rln '^name: \(fable-coding\|writing-adrs\|injection-vigilance\|dev-philosophy\)$' home/.agents home/.copilot | wc -l
8
$ /usr/bin/grep -c 'wanyaldee-skills:begin' proj/AGENTS.md
1
$ wc -c < proj/AGENTS.md
31816
```

同じセッションのそれより前の実行で、端末が無いときの拒否も確認した:
`--agent codex </dev/null` で
`install.sh: refusing to write without a terminal; pass --yes` が出て exit 1。
未知のエージェントでは `install.sh: unknown agent: foo` が出て exit 1。

Verified-by: Claude Opus 5.5 (AI agent), 2026-10-23(上記の shellcheck と実行)

**Not verified**:

- 実際の Codex CLI、Cursor、Gemini CLI、Copilot は起動していない。入れた
  スキルが一覧に出て発火するかは未確認で、フォルダのパスはドキュメントに
  基づくだけ。
- 対話メニューは、このセッションでは実際の端末から操作していない。
  実行したのは `--agent` の経路だけ。
- 実行したのは `dash` と、起動に使った `/bin/sh` だけ。macOS(BSD 版の
  `awk`/`cmp`)では実行していない。
