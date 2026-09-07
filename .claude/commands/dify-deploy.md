---
description: Mac（Claude Code CLI ＋ Claude in Chrome）から dify/apps の DSL を Dify Cloud に投入し、KB を作り、テストを流して結果を commit する。dify/DEPLOY.md の実行手順。
---

対象: $ARGUMENTS（管理番号を空白区切り。例 `KN-01 DC-01`。空なら `dify/apps/*.yml` の全件）

正本は `dify/DEPLOY.md`（順番とコマンド）と `dify/README.md`（画面操作）。このコマンドはそれを **Mac 上で実行する手順**。この環境が Dify Cloud（`api.dify.ai`）に到達できることが前提（到達できない砂箱では実行しない）。

## 0. 前提確認（止まる条件）
- `git status` が clean で `main` が最新（`git pull --ff-only`）
- 環境変数：`DIFY_BASE_URL`、`DIFY_DATASET_KEY`、対象ごとの `DIFY_APP_KEY_<番号のハイフン無し>`。**値をチャットやログに出さない**。未設定なら「どのキーが無いか」だけ報告して止まる（`scripts/dify/env.example` を `~/.config/dify/env` にコピーして埋める案内）
- `python3 dify/check.py` が対象の DSL で OK

## 1. アプリの取り込み（Chrome）
対象ごとに、Claude in Chrome に次を頼む（自分で操作できる設定ならそのまま実行）：
> Dify Cloud の Studio で「アプリを作成 → DSL ファイルをインポート → URL」を開き、`https://raw.githubusercontent.com/shoulang0729/dify/main/dify/apps/<ファイル名>.yml` を貼って作成。古いバージョンの警告はそのまま続行。LLM ノードのモデルをこの環境のプロバイダーに合わせて選び、公開。「API アクセス」で API キーを新規作成して表示。
表示された API キーは **人が**環境変数に入れる（チャットに貼らない）。既に同名アプリがある場合は「上書きインポート」ではなく新規作成し、旧アプリは名前に `(old)` を付けて残す。

## 2. ナレッジの投入
`dify/kb/<番号>/` があるものだけ：
```bash
python3 scripts/dify/kb_upload.py <番号>
```
完了後、Chrome に「<番号> のアプリの知識検索ノードに KB `<番号> <サービス名>` を追加して保存・再公開」を頼む。KB が無いサービス（form 型など）はこの段を飛ばす。

## 3. テストと結果の記録
```bash
python3 scripts/dify/run_tests.py <番号...>
git add dify/results/*.md
git commit -m "test(dify): <番号...> Service API テスト結果"
git push
```
失敗があれば `dify/results/` の表を読んで原因を 1 行ずつ要約し、**DSL の修正が要るもの**は Issue #82 にコメント（エラー文はそのまま、キーは伏せる）。修正は別セッション（作る側）が行うので、ここでは DSL を直さない。

## 4. 完了報告（書式）
```
対象: <番号...>
取り込み: <番号> ✅/❌（エラー文）
KB: <番号> ✅（文書 n 本）/ 対象外
テスト: <番号> 合格 x/y（結果ファイル）
Issue #82 コメント: あり/なし
```

## 停止条件
- キー未設定・401（キー違い）・404（アプリ未公開）→ 該当を報告して止まる
- KB 検索が 0 件 → インデックス未完了の可能性。5 分待って 1 回だけ再実行、それでも 0 なら止まる
- `git status` に `.env` 等の秘密ファイルが出た → **絶対に add しない**。報告して止まる
