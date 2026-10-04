# 0018: context-handoff Mod(使用量表示+制限接近時の自動引き継ぎ)

(English: [0018-context-handoff-mod.md](../en/0018-context-handoff-mod.md))

## 背景 (Context)

ユーザーが(2026-10-04)次の Mod を依頼した: (a) コンテキストの使用量を常時
表示する、(b) 制限が近くなり始めたら即座にコミットし、やっている作業を記録し、
SessionID なしでユーザーの確認を取ったうえで作業の続きを行う。確認は次に
Claude を起動したときに「このリポジトリでこの作業をやっていましたがトークン
切れで作業を一時中断しました、続行しますか」と必ず聞くこと。

それまでこのパッケージは Claude Code のランタイムに触れておらず、スキルと
コマンドフック(`hooks/*.py`、シェルの `SessionStart` フック)だけだった。作業
中に5時間のレート制限に達すると次のセッションは白紙から始まり、再開は
`--resume <id>` かユーザーによる文脈の打ち直しに頼っていた。

## 決定 (Decision)

`mods/context-handoff/` を追加した。Claude Code の **function hooks** による
プラグイン(`hooks/hooks.json` → `{ "modules": ["./register.tsx"] }`)で、
`.claude-plugin/marketplace.json` に2つ目のプラグインとして登録
(`/plugin install context-handoff@wanyaldee-skills`)。コマンドフックを持つ
`wanyaldee-skills` プラグインとは別物。

- `session.start` / `session.measure` → `$.ui.status(...)` でコンテキスト使用率
  と全レート制限窓を表示。
- `session.measure` でレート制限窓のどれか、またはコンテキストが 90% 以上 →
  セッションごとに1回: `$.model.fork` で要約、`<repo>/.claude/handoff.md` に
  書き出し、`git add -A` してコミット、`$.store` の `handoff:<repo root>` に記録、
  実行中のモデルへ区切りで止める旨のメモを追加。
- 同じリポジトリでの次の対話セッションの `session.start` → プロンプト上の帯に
  所定の質問を表示し、`[続行する]`(要約付きの再開プロンプトを送信)と
  `[破棄する]`(記録を削除)を出す。
- `/handoff` で同じチェックポイントを手動実行。

## Reason(理由)

発火条件としきい値(`hooks/logic.ts`):

```ts
export const CONTEXT_THRESHOLD = 90
export const RATE_LIMIT_THRESHOLD = 90

export function limitReason(context, rateLimits): string | null {
  const hot = rateLimits.find(limit => limit.percentUsed >= RATE_LIMIT_THRESHOLD)
  if (hot !== undefined) return `レート制限 ${limitLabel(hot.kind)} が ${hot.percentUsed}% に到達`
  if (context.percent !== undefined && context.percent >= CONTEXT_THRESHOLD) return `コンテキストが ${context.percent}% に到達`
  return null
}
```

- タイマーではなく `session.measure` にフック: エンジンはメインスレッドの
  ターン終了ごとと、レート制限窓が1ポイント動くたびに発火する。ターン間の
  判定コストはゼロで、ターン終了後に走るため、ターン途中の Edit の連続を
  中途半端な状態でコミットすることがない。
- 95〜99% ではなく 90%: チェックポイント自体がトークンを使い(全履歴に対する
  `$.model.fork` 1回)、`rateLimits` は直前の API 応答からしか更新されない。
  余裕は「もう1ターン+要約リクエスト」を吸収する必要がある。100% では fork が
  失敗し要約が失われる。
- コンテキストより先にレート制限を判定: 作業を実際に止めるのはレート制限の
  枯渇(「トークン切れ」)で、コンテキストの充填は自動 compact で回復できるため
  2番目の理由とした。

セッションごとに1回(ホットリロードをまたいで):

```ts
const hasSavedThisSession = atom({ plugin: 'context-handoff', key: 'hasSavedThisSession' } as const, false)
...
if (reason !== null && !(await read($, hasSavedThisSession))) await checkpoint($, reason)
```

- モジュール変数ではなく `$.state`: ホットリロードは `register` を再実行し
  `session.start` も再発火する。モジュール変数だとリセットされ、再コミットや
  自分自身の引き継ぎを自分に提示してしまう。同じフラグで `session.start` の
  再開質問も抑止している。
- `checkpoint` の先頭、git やモデルへの `await` より前でセット: 同じターンで
  コンテキストとレート制限が両方動いて `session.measure` が2回来ても、
  チェックポイントは1回しか始まらない。

記録のキー(SessionID なし):

```ts
export const storeKey = (repoRoot: string): string => `handoff:${repoRoot}`
```

- `$.store` はセッションをまたいで残る。キーは `git rev-parse --show-toplevel`
  (失敗時は cwd)なので、リポジトリのどのサブディレクトリから起動しても
  見つかり、別リポジトリの引き継ぎは見えない。これが「SessionID なしで」の
  実装。

コミット(`register.tsx` の `commitAll`):

```ts
await git($, ['add', '-A'], repoRoot)
const hasStaged = !(await git($, ['diff', '--cached', '--quiet'], repoRoot)).isOk
if (!hasStaged) return ''
const committed = await git($, ['commit', '-m', commitMessage(reason)], repoRoot)
```

- `add -A`: ユーザーは作業の即時コミットを求めており、新規ファイルも作業の
  一部。`.gitignore` は引き続き効く。
- 先に `diff --cached --quiet`: ステージなしの `git commit` は終了コード1を
  返し、失敗と誤認して誤解を招くトーストを出してしまう。
- `--no-verify` なし: ユーザーの pre-commit フック(シークレットスキャナ含む)は
  そのまま動く。失敗時は変更をステージに残し、トーストで知らせる。
- `handoff.md` はコミット前に書くので同じコミットに入る: メモはブランチと
  一緒に移動し、この Mod を持たないエージェントでも読める。

要約:

```ts
const reply = await $.model.fork({ prompt: SUMMARY_PROMPT })
```

- `$.model.complete` ではなく `$.model.fork`: fork はメインスレッドの直前の
  リクエストを再送するので、履歴はプロンプトキャッシュから供給され、セッション
  自身のモデルが全文脈から要約を書く。`complete` は履歴を持たない。
- 空メモではなく直近3件の依頼原文にフォールバック: API が既に拒否している
  状況でも、再開プロンプトには手がかりが必要。

質問はペインやトーストではなく帯で表示: 頼まれずに開くペインはターミナル幅
144桁以上でしか開かず、トーストは消える。`AbovePrompt` の帯はボタンが
`pending` を消すまで描かれ続け、「必ず聞く」を満たす。

## 却下した代替案 (Alternatives rejected)

- 既存と同じコマンドフック(Python): ライブのコンテキスト/レート制限値を
  読めず、ステータスラインや帯も描けない。
- ルートの `hooks/hooks.json` に `modules` を混ぜる: function hooks と
  コマンドフックを1つのマニフェストに混在させる方法は文書化されていない。
  別プラグインなら既存フックに触れずに済む。
- 記録を `.claude/handoff.md` だけに置く: 起動時の検出が、後のコミットで
  削除・編集されたかもしれないファイルのパースに依存してしまう。
- 起動時に確認なしで `$.prompt.submit`: ユーザーは事前の確認を明示的に求めた。
- しきい値の userConfig: 依頼されておらず、定数の1行修正で済む。

## 影響 (Consequences)

- チェックポイントのコミットはチェックアウト中のブランチ(`main` を含む)に
  入り、無視されていない未追跡ファイルも含む。
- `.claude/handoff.md` は再開したエージェントが削除するまで残る(再開
  プロンプトで削除を依頼している)。
- 判定はターン終了時のみ: 1ターンで 85% から 100% を越えるとチェックポイント
  は作られない。
- レート制限はサブスクリプション利用時のみ表示。それ以外ではコンテキストだけが
  発火条件。
- function hooks の API はアーリーアクセスで、Claude Code の更新で修正が必要に
  なりうる。

## 検証 (Verification)

- `claude plugin validate mods/context-handoff`: 通過。
- 同梱の `claude-code.d.ts`(Claude Code 2.1.289)に対する `tsc`: エラーなし。
- `claude plugin test mods/context-handoff`: `logic.ts` の単体テスト8件
  (ステータス書式、89.9/90 のしきい値、ストアキー、質問文言の完全一致、再開
  プロンプトの内容)が通過。
- **未検証**: ライブセッションでの git / fork / 帯の経路。作成セッションでは
  ホットリロードが見送られたため、エンドツーエンドでは動かしていない。最初の
  実際のレート制限接近が最初の実地テストになる。
