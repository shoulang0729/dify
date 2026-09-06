# Issue 下書き：顧客版カタログ A-2 — パートナー連携ユースケース 8 件の追加（データ層＋台本）

> `gh` が使えないため Issue 本文をここに置く。PM が GitHub Issue にコピーする。**A-1（customer-catalog-data）のマージ後に着手。B-1 の前に入れることを推奨**（設計書 §7 PT-7）。

## タイトル

feat(mock): 顧客版カタログ A-2 — パートナー連携 8 分類目と 8 サービス（情報ベンダ・記事アーカイブ・給与DB・採用／購買／研修エージェント）を追加

## 設計書

`docs/handoff/2026-09-06-partner-usecases.md`（承認済み `2026-09-06-customer-catalog-data.md` / `2026-09-06-demo-scenarios.md` への**追補**。承認済み内容は変更しない）

## 概要

構想中のパートナー 6 者（役割名で扱う。実名・ブランド名は使わない）と協働するユースケース 8 件を、`mock/catalog.html` のデータ層に**追加のみ**で入れる。

- 分類：7 → **8**（`pt` パートナー連携。中分類 `data` データ・リサーチ／`service` 代行・エージェント）
- サービス：33 → **41**（`pt1`〜`pt8`。st2 = 3 / st3 = 5）
- タグ：35 → **43**（役割タグ `partner_infovendor` `partner_archive` `partner_salarydb` `partner_recruit` `partner_procure` `partner_training` ＋ 業務タグ `credit` `market`）
- `T` / `TEMPLATES` / `state` / `data-act` / CSS：**不変**（regress `counts.ui` 不変）
- 台本（`SCENARIOS` 8 件、ja/zh）は B-2 に合流して投入（設計書 §B-2 を転記）

| id | 名称（ja） | st | template | 接続する既存 id |
|---|---|---|---|---|
| pt1 | 取引先・サプライヤーの与信・リスク監視 | 2 | lookup | nm2, dc7 |
| pt2 | 業界・材料相場リサーチ（本社報告の外部根拠） | 2 | form | nm2, dc1, nm1 |
| pt3 | 業界誌・技術記事アーカイブの横断検索 | 2 | qa | kn1, dc1 |
| pt4 | 現地給与水準の照会と給与改定の妥当性確認 | 3 | lookup | kn3, dc1 |
| pt5 | 現地技術者・管理職の採用支援（一次面談の要約・候補者サマリ） | 3 | upload | kn4, dc1 |
| pt6 | 戦略購買の立案（集約・複数年・代替サプライヤー） | 3 | upload | nm2, nm5, dc7 |
| pt7 | RFQ 起草と購買代行への引き継ぎ | 3 | form | nm2, gn3, dc7 |
| pt8 | 研修プログラム化と実施代行・受講管理 | 3 | form | dc3, lg3, dc1 |

## 受け入れ条件（設計書 §6 の要約）

- [ ] `node tools/verify.mjs` → ALL PASS（warn は既存の `未使用キー: all` のみ。未使用タグの warn なし）
- [ ] `--update` 前の `node tools/regress.mjs` の差分が設計書 §4-2 と一致：`counts.cats 7→8` / `subs 15→17` / `svcs 33→41` / `tags 35→43`、`CATS 追加: pt`、`SVCS 追加` 8 件、`TAGS 追加` 8 件。**`削除` / `分類移動` / `成熟度` / `tags` / `並び順` / `T(UI キー)` / `PATTERNS` の行が 0 件**
- [ ] `node tools/regress.mjs --update` 後 PASS。baseline `counts` が `{"cats":8,"subs":17,"svcs":41,"tags":43,"ui":27}`（B-1 後に入れる場合は `ui: 49`）
- [ ] `git diff` が `CATS` 末尾 1 要素・`TAGS` 末尾 8 行・`SVCS` 末尾 8 要素（＋直前要素のカンマ）・baseline・`mock/README.md` / `mock/index.html` の件数表記行に収まる。承認済み 33 件・7 分類・35 タグの行に差分なし
- [ ] ブラウザ：サイドバー末尾に「パートナー連携」（初期状態は閉じている）、開くと中分類 2 つに 4 件ずつ。全 41 件。試行版 3・構想 5 のバッジがダークでも表示
- [ ] 検索「情報ベンダ」「与信」「采购代理」「Salary」で該当サービスが出る
- [ ] ja / zh / en で name/desc/タグに空欄・別言語混入なし。`grep -i speeda mock/catalog.html` が 0 件
- [ ] （B 実装後）pt1〜pt8 の詳細にペルソナ・手順・「デモを見る」。verify §9 で FAIL なし・warn 0。pt1 の表は 3 列 × 9 行で最終行「連携」、pt7 の結果先頭「連携」に案件番号と回答期限

## 触らない範囲

承認済み `CATS` 7 件・`SVCS` 33 件・`TAGS` 35 キーの値と並び順、`T` のキー集合と値、`TEMPLATES`、`PATTERNS`、`state`（`openCats` / `lastCat` も不変）、`data-act`、描画関数・ハンドラ・ヘルパー、2 つの `<style>`、`.mockbar` / 言語・テーマ切替 / `localStorage`、`tools/*.mjs` のロジック、`pages.yml`、`mock/top.html`、承認済み設計書 A・B、`docs/dify/**`

## PR 分割案

| PR | ブランチ | 内容 | 依存 / 並列 |
|---|---|---|---|
| **A-2** | `feat/partner-catalog-data` | 設計書 §3（`CATS` / `TAGS` / `SVCS` の追加）＋ regress `--update` ＋ README / index の件数表記 | A-1 のマージ後。**B-1 の前を推奨**（B-1 の verify §9 は「SVCS に無い id を SCENARIOS に書くと FAIL」のため、pt 台本の投入に A-2 が先に要る）。A-2 は `SVCS` 末尾・B-1 は `T` / 関数 / CSS と触る行が異なるので技術的には並列可 |
| **B-2 に合流** | `feat/demo-scripts` | 設計書 §B-2 の `SCENARIOS` 8 件を `gn5` の後に追記。コード変更なし。regress 変化なし | B-1 のマージ後。B-2 が既にマージ済みなら `feat/demo-scripts-partner`（B-3）として別 PR |

PR 本文に「設計書 `docs/handoff/2026-09-06-partner-usecases.md` §4 のデータ変更に伴う基準更新」と明記すること。

## PM 判断待ち（設計書 §7）

PT-1 分類（推奨 新設 `pt`）／PT-2 件数（推奨 8）／PT-3 成熟度（推奨 st2 = pt1 pt2 pt3、他 st3）／PT-4 新テンプレート（推奨 増やさず結果パネル「連携」行で表現）／PT-5 中分類 id（推奨 `data` / `service`）／PT-6 分類の位置（推奨 末尾）／PT-7 A-2 の実施タイミング（推奨 B-1 の前）／PT-8 架空社名（推奨 付けない）／PT-9 pt 台本の PR（推奨 B-2 に合流）／PT-10 PIPL 文言（推奨 モックにも短く出す）

## CLAUDE.md への影響

§2 load-bearing の変更なし。§6 バックログの件数を A-2 マージ時に PM が「8 分類 41 サービス（うちパートナー連携 8）」へ更新。
