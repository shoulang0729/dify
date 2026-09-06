# Issue 下書き：顧客版カタログ B — 担当者シナリオとデモ遷移

> `gh` が使えないため Issue 本文をここに置く。PM が GitHub Issue にコピーする。**A（customer-catalog-data）のマージ後に着手。**

## タイトル

feat(mock): 顧客版カタログ B — 担当者ペルソナ・利用シナリオ・5 テンプレートの業務デモ（`state.view = 'demo'`）

## 設計書

`docs/handoff/2026-09-06-demo-scenarios.md`

## 概要

各サービスに担当者ペルソナ・利用シナリオ（3〜6 手順）・画面遷移テンプレート（5 種）・台本（ja / zh 各 3 往復）を持たせ、詳細画面に表示し、「デモを見る」で業務デモ画面を開く。

- テンプレート 5 種：`qa`（QAチャット型）／`upload`（アップロード→結果型）／`form`（フォーム入力→ドラフト生成型）／`diff`（差分比較型）／`lookup`（照会型）
- 共通レイヤーの拡張（§2-3 の範囲内で追加のみ）：`state.view` に `'demo'`、`state.log` を追加、`data-act` に `run` / `chip` / `restart` を追加。既存の値・ハンドラは不変
- 新データ：`TEMPLATES`（3 言語）・`SCENARIOS`（サービス id → Scenario。台本は ja / zh のみ）
- `T` に 22 キー追加（3 言語）→ regress `counts.ui: 27 → 49`
- `tools/verify.mjs` に `requiredActs` 3 種追加と新設 §9 シナリオ整合チェック

## 受け入れ条件（設計書 §7 の要約）

- [ ] `node tools/verify.mjs` → ALL PASS（新設 §9 を含む。warn は既存の `all` のみ）
- [ ] `--update` 前の `node tools/regress.mjs` の差分が **`counts.ui: 27 → 49` と `T(UI キー) 追加` 22 件のみ**（CATS / SVCS / TAGS / PATTERNS の行なし）
- [ ] `--update` 後 PASS
- [ ] 33 サービスすべてに `SCENARIOS` があり、詳細画面に担当者・画面タイプ・利用シナリオが 3 言語で出る。CTA が「デモを見る」
- [ ] `qa` 型：チップ（日／中）→ 3 往復進む → 台本終了メッセージ。自由入力でも進む（入力言語で返答）
- [ ] `upload` / `form` / `diff` / `lookup` 型：実行前はチップなし・誘導文、「実行」で結果パネル＋チップ出現、以降 2 往復
- [ ] デモ途中で言語切替（ja→zh→en）しても会話（`log`）と結果パネルが保持される。en UI では台本は ja
- [ ] 「最初から」で `log` が空になり入力パネルが再び有効化
- [ ] `svc` → 別サービスの `start` で前サービスの会話が残らない
- [ ] `SCENARIOS` に無い id（テスト用に一時的に 1 件外す）では従来の `chat` view に落ちる
- [ ] ダークモードで `.demo-*` / `.panel` / `.chip` / `.tbl` に浮いた色がない（トークンのみ）
- [ ] `main` 幅 900px 未満で 2 ペインが縦積みになる
- [ ] `git diff`：`CATS` / `SVCS` / `TAGS` / `PATTERNS` に差分なし。`T` は追加のみ。`state` は `log` 追加のみ。既存 `data-act` ハンドラの意味不変（`start` の分岐追加のみ）

## 触らない範囲

`CATS` / `SVCS` / `TAGS` / `PATTERNS`（`SVCS[].scenario` も足さない）、`state` の既存 10 キー、`view` の既存値の挙動、既存 `data-act` の意味、`renderSidebar` / `renderSeg` / `renderChrome` / `cardHTML` / `gridHTML` / `filtered` / `detectLang` / `L` / `t` / `tag`、`T` 既存 27 キーの値、1 つ目の `<style>`（トークン。dark 追加もしない）、`.mockbar` / 言語・テーマ切替 / `localStorage`、`tools/regress.mjs` ロジック、`pages.yml`、`mock/top.html`、`mock/index.html`

## PR 分割案

| PR | 内容 | 並列 |
|---|---|---|
| **B-1** `feat/demo-template` | `T` 22 キー、`TEMPLATES`、`state.log`、ヘルパー、`renderMain` の detail 拡張＋`demo` 分岐、`sendChat` 分岐、`run`/`chip`/`restart`、CSS、`verify.mjs` 拡張、regress `--update`。`SCENARIOS` は **kn1（qa）・qa1（upload）・dc5（form）・qa2（diff）・nm4（lookup）の 5 件だけ**投入（各テンプレート 1 件） | A のマージ後。B-2 と直列 |
| **B-2** `feat/demo-scripts` | 残り 28 件の `SCENARIOS` 投入（設計書 §6 を転記）。コード変更なし。verify §9 で整合確認 | B-1 のマージ後。**B-2 内は分類ごと（kn/qa/dc/lg/nm/en/gn）に複数人で並列可**（`SCENARIOS` リテラルの別ブロックを追記するだけ。マージ順は任意。ただし同じ id を二重に書かないこと） |

B-2 を 1 PR にまとめても良い（PM 判断）。regress は B-2 では変化しない（`SCENARIOS` はスナップショット対象外）。

## PM 判断待ち（設計書 §9）

P-1 テンプレート数（推奨 5。4 種案：`diff` を `upload` に統合）／P-2 チップを日中 2 本出すか（推奨 2 本）／P-3 結果パネルの言語固定（推奨 実行時言語で固定）／P-4 `chat` view の存続（推奨 フォールバックとして残す）／P-5 CLAUDE.md §2-3 への追記承認（`view: 'demo'`、`log`、`run`/`chip`/`restart`、`TEMPLATES`/`SCENARIOS`）／P-6 台本の固有名（架空の K 社・S 社・T 社・青嶺精工）の扱い／P-7 B-2 の PR 粒度

## CLAUDE.md への影響（PM 承認事項）

§2-3 の「データ」「状態」「遷移」の列挙に本 Issue の追加分を追記する必要がある（architect は CLAUDE.md を変えない）。§6 バックログの「モック ②③」は本 Issue の共通レイヤー拡張の上に乗る前提で不変。
