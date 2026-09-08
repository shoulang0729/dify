# Issue 案：Dify Cloud への「ブラウザ不要」投入経路（Console API）＋ Playwright MCP 代替

> `gh` が使えない環境のため、Issue 本文をここに書き出す。PM が `gh issue create --title … --body-file docs/handoff/2026-09-08-cloud-console-deploy.issue.md` するか、画面から起票する。起票後、この節に Issue 番号を追記する。

---

**タイトル**：`feat(dify): Cloud への投入・公開をブラウザ無しで回す（Console API 経路）＋ Playwright MCP 代替`

**ラベル案**：`dify` / `scripts` / `M-L`
**関連**：#82（Cloud 実装）・#84（構成 v2）・#98（第 2 弾 10 件）・#3（export 方向は対象外）

## 背景

Cloud への投入・公開・KB 紐づけを Claude in Chrome の画面操作に固定していたため、Claude in Chrome が無い環境（VS Code 拡張の Claude Code）では人が手で 12 回同じ操作をすることになった。第 2 弾 10 件（#98）の投入が控えており、人手ゼロで回る経路が要る。

## 設計書

**`docs/handoff/2026-09-08-cloud-console-deploy.md`**

## やること（要点）

1. `scripts/dify/console_api.py` を **Console API 共通クライアント**に格上げ（トークン認証 `DIFY_CONSOLE_TOKEN`・独自 UA・`confirm_import` / `get_draft` / `update_draft` を**追加**。既存 API のシグネチャは不変）
2. `scripts/dify/cloud_deploy.py` を新設：render → app_id 解決 → import（新規／上書き）→ confirm → publish → レポート。**冪等**（同じ番号を 2 回流してもアプリが増えない）
3. env スキーマに `apps.<管理番号>.id` を追加（3 環境 × 12 件）。cloud-master の `knowledge.*.id` を `${DIFY_DATASET_ID_*}` に統一し、`dataset_ids` を焼き込んだ DSL をインポートして **UI での KB 紐づけを不要にする**（要実機確認）
4. `tools/verify.mjs` に §12-e（`apps:` の番号一覧が `dify/apps/*.yml` と一致・顧客 env に生 UUID を書かせない）
5. `scripts/dify/release.py` の cloud 経路を「トークンがあれば自動 import、無ければ従来の `IMPORT.md` で停止」に
6. `dify/DEPLOY.md` に §0（トークンの取り方・Playwright MCP の入れ方）と §3 の書き換え（Claude in Chrome / Playwright MCP のどちらでも同じ文面）
7. ネットワークを呼ばない往復テスト（`scripts/dify/tests/mock_server.py` にコンソール API の最小エンドポイントを追加）

## 受け入れ条件（機械検証・マージ条件）

- [ ] `node tools/verify.mjs` PASS（§12-e を含む）
- [ ] `node tools/regress.mjs` PASS（**`--update` していない**）
- [ ] `python3 scripts/dify/render.py --env cloud-master --all --check` が 12/12 `[OK]`（`DIFY_DATASET_ID_*` 未設定の素の shell で）
- [ ] `python3 dify/check.py` PASS（DSL 無変更）
- [ ] `python3 scripts/dify/release.py --env cloud-master --all --dry-run` が exit 0 かつネットワークを呼ばない
- [ ] `python3 scripts/dify/tests/test_console_api.py` 全件 PASS
- [ ] `python3 scripts/dify/tests/test_cloud_deploy.py` 全件 PASS（新規作成／**2 回流して増えない**／上書き／401 で exit 3／出力にトークンが現れない／`--dry-run`／`--write-env` が `${VAR}` 行を書き換えない）
- [ ] 既存 `test_run_tests.py`・`test_sync_back.py` が PASS
- [ ] `git status` に `.env`・`dify/build/**` が出ない
- [ ] トークン・API キーの値がログ・結果ファイル・リポジトリに出ない

## 実機確認（PM が Mac で。マージ条件には含めない）

- [ ] B1 設計書 §1-3 の N1〜N4 を実施し、C1〜C5 の真偽をコメント（**値は貼らない**）
- [ ] B3 `cloud_deploy.py --env cloud-master KN-01` で既存 KN-01 が上書きされ、アプリ id・API キーが不変
- [ ] B4 もう 1 回流してアプリ件数が増えない
- [ ] B5 `--all` で第 2 弾 10 件が投入・公開される
- [ ] B6 `--bind-kb dsl` で KB が最初から紐づいているか（C6 の真偽）
- [ ] B7 期限切れトークンで exit 3 ＋ 取り直し手順が出る
- [ ] B8 Playwright MCP で §6-2 の文面が通る

## 触らない範囲

`mock/**`／`data/world/**`／`dify/apps/*.yml`（DSL 12 本・1 バイトも変えない）／`dify/kb/**`・`dify/tests/*.json`・`dify/results/**`／`scripts/dify/{render,kb_upload,run_tests,sync_back}.py`／`tools/regress.mjs`・`tools/regress.baseline.json`／`tools/verify.mjs` の §1〜§11／`.github/workflows/**`／`.claude/**`／`CLAUDE.md`（§6-3・§12 P3 は文案のみ、適用は PM）／`dify/CHANGELOG.md`

## PR の分割案（実質は直列）

1. **PR-1**：`console_api.py` 拡張（トークン認証・UA・confirm/draft）＋ `mock_server.py` にエンドポイント追加 ＋ `tests/test_console_api.py` 新設
2. **PR-2**（PR-1 の後）：`cloud_deploy.py` 新設 ＋ `dify/env/*/env.yml` に `apps:`（3 環境 × 12 件）＋ cloud-master の `knowledge.*.id` を `${VAR}` 化 ＋ `verify.mjs` §12-e ＋ `tests/test_cloud_deploy.py`
3. **PR-3**（PR-2 の後）：`release.py` stage 3 統合 ＋ `--no-console-import` ＋ ドキュメント（`DEPLOY.md` §0/§3/§5/§6・`env.example`・`dify/README.md`・`dify/env/README.md`）
4. **PR-4（任意・N6 の確認後）**：Service API キーの発行・取得（値を表示せず `~/.config/dify/<env>.env` へ）

## PM 判断待ち

- P1 cloud-master の `apps.KN-01.id` / `apps.DC-01.id` の実値（設計書では `null`）
- P2 `verify.mjs` の `REQUIRED_TOP` に `apps` を足すか（推奨：足す）
- P3 `CLAUDE.md` §2-12 の一文追記（**PM が適用**）
- P4 `release.py` の cloud 自動 import をトークン有無で自動判定するか（推奨：自動＋`--no-console-import`）
- P5 API キー自動発行の可否（推奨：N6 の確認後）
- P6 `--bind-kb` の既定（推奨：`dsl`）
- P7 `docs/dify/**` の「Cloud は Console API が壊れやすい」記述の更新（推奨：実機確認後に別 PR）

## 確認要（実機で確かめるまで断定しない）

C1 トークン認証／C2 `apps/imports` の body 形／C3 `confirm`／C4 `workflows/publish` のパス／C5 `workflows/draft` の GET・POST／C6 `dataset_ids` 焼き込みで KB が紐づくか／C7 `api-keys` の応答／C8 Console API の Cloudflare UA／C9 トークン期限。

**この砂箱からは `cloud.dify.ai` に到達できない。ネットワークを呼ぶ検証はすべて Mac の実機で行う。**
