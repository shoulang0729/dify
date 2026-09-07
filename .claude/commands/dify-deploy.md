---
description: Mac（Claude Code CLI ＋ Claude in Chrome）から dify/apps の DSL を Dify Cloud に投入し、KB を作り、テストを流して結果を commit する。dify/DEPLOY.md の実行手順。
---

対象: $ARGUMENTS（管理番号を空白区切り。例 `KN-01 DC-01`。空なら `dify/apps/*.yml` の全件）

正本は `dify/DEPLOY.md`（順番とコマンド）と `dify/README.md`（画面操作）。このコマンドはそれを **Mac 上で実行する手順**。この環境が Dify Cloud（`api.dify.ai`）に到達できることが前提（到達できない砂箱では実行しない）。

## 0. 前提確認（止まる条件）
- `git status` が clean で `main` が最新（`git pull --ff-only`）
- 環境変数：`DIFY_BASE_URL`、`DIFY_DATASET_KEY`、対象ごとの `DIFY_APP_KEY_<番号のハイフン無し>`。**値をチャットやログに出さない**。未設定なら「どのキーが無いか」だけ報告して止まる（`scripts/dify/env.example` を `~/.config/dify/env` にコピーして埋める案内）。**値の確認は `[ -n "${VAR:-}" ] && echo set || echo unset` の形だけを使う。`echo $VAR`・`env`・`printenv`・`set`・`export -p`・`cat ~/.config/dify/*` は禁止**（値が 1 度でも出力に出たら、そのキーは漏れたものとして扱い、Dify で再発行してから続ける）
- `python3 dify/check.py` が対象の DSL で OK

## 1. アプリの取り込み（Chrome）
対象ごとに、Claude in Chrome に次を頼む（自分で操作できる設定ならそのまま実行）：
> Dify Cloud の Studio で「アプリを作成 → DSL ファイルをインポート → URL」を開き、`https://raw.githubusercontent.com/shoulang0729/dify/main/dify/apps/<ファイル名>.yml` を貼って作成。古いバージョンの警告はそのまま続行。**LLM ノードを開き、モデルが DSL の指定どおり `openrouter / qwen/qwen3.8-max`（分類・抽出ノードがあれば `moonshotai/kimi-k3`）になっているか確認する。あわせてモデル設定のパラメータが `temperature 0.2` / `max_tokens 4096` / `reasoning_effort low` / `exclude_reasoning_tokens ON` になっているかを見る（DSL どおりなら変更不要。DI-010 / DI-011）。違っていたら**直さずに報告する**。空欄・エラー、またはモデル一覧に該当モデルが無い場合は、勝手に別のモデルを選ばずそこで止めて報告する**（設定 → モデルプロバイダーで OpenRouter の追加が要る。OpenRouter は id の手入力も可）。確認できたら公開。「API アクセス」で API キーを新規作成して表示。
表示された API キーは **人が**環境変数に入れる（チャットに貼らない）。既に同名アプリがある場合は「上書きインポート」ではなく新規作成し、旧アプリは名前に `(old)` を付けて残す。

**既存アプリを再インポートするときは、先に Cloud 側の乖離を見る。** Chrome で対象アプリを「DSL をエクスポート」→ 落ちたファイルを `python3 scripts/dify/sync_back.py ~/Downloads/<番号>*.yml --dry-run` に掛け、差分要約を読む。**モデル・プロンプトに身に覚えのない差分があれば、そこで止めて報告する**（DI-013）。再インポートの手順は `dify/DEPLOY.md` §1-④。

## 2. ナレッジの投入
`dify/kb/<番号>/` があるものだけ：
```bash
python3 scripts/dify/kb_upload.py <番号>
```
完了後、Chrome に「<番号> のアプリの知識検索ノードに KB `<番号> <サービス名>` を追加して保存・再公開」を頼む。KB が無いサービス（form 型など）はこの段を飛ばす。
KB を作ったら Chrome で**「検索設定」の Rerank を OFF** にする（既定 ON のままだと OpenRouter 経由の Rerank が 429 になり検索 0 件。`dify/KNOWN_ISSUES.md` DI-005）。チャンクの区切りは `\n\n`・最大 1024 字（DI-006）。
**KB をノードに紐づけたら、その場で「知識検索」ノードの検索設定を開いて確認する。** DSL が `reranking_enable: false` でも、UI が Rerank を強制 ON にして Rerank モデルを入れることがある（DI-012）。**入っていても消さず、その状態をそのまま報告する**（当面は ON を許容する方針。`docs/handoff/2026-09-08-thinking-budget-and-streaming.md` §4）。

## 3. テストと結果の記録
```bash
python3 scripts/dify/run_tests.py <番号...>
git add dify/results/*.md
git commit -m "test(dify): <番号...> Service API テスト結果"
git push
```
受信は streaming が既定（Cloud の blocking は 120 秒で 504。DI-010）。`--timeout` 既定は 600 秒。blocking を試すときだけ `--blocking`。
結果の表には所要秒とトークン数が入る。504 が出たら `--blocking` を付けていないか確認する。
失敗があれば `dify/results/` の表を読んで原因を 1 行ずつ要約し、**DSL の修正が要るもの**は Issue #82 にコメント（エラー文はそのまま、キーは伏せる）。修正は別セッション（作る側）が行うので、ここでは DSL を直さない。
失敗・詰まりは `dify/KNOWN_ISSUES.md` に `DI-xxx` の行を足す（症状 1 行・原因・対処・状態 `open`）。DSL 修正はここでは行わない。

## 4. 完了報告（書式）
```
対象: <番号...>
取り込み: <番号> ✅/❌（エラー文）
KB: <番号> ✅（文書 n 本）/ 対象外
テスト: <番号> 合格 x/y（結果ファイル）
Issue #82 コメント: あり/なし
KNOWN_ISSUES 追記: DI-xxx（無ければ「なし」）
```

## 停止条件
- キー未設定・401（キー違い）・404（アプリ未公開）→ 該当を報告して止まる
- KB 検索が 0 件 → インデックス未完了の可能性。5 分待って 1 回だけ再実行、それでも 0 なら止まる
- `git status` に `.env` 等の秘密ファイルが出た → **絶対に add しない**。報告して止まる
