# Issue 下書き：顧客版カタログ A — メニュー（データ層）差し替え

> `gh` が使えないため Issue 本文をここに置く。PM が GitHub Issue にコピーする。

## タイトル

feat(mock): 顧客版カタログ A — 在中日系製造業向けメニューへデータ層を差し替え（7 分類 33 サービス・仮社名）

## 設計書

`docs/handoff/2026-09-06-customer-catalog-data.md`

## 概要

`mock/catalog.html` の `TAGS` / `CATS` / `SVCS` を顧客（在中日系製造業・中国工場）向けに全置換し、ヘッダーのワードマークを仮社名「青嶺精工 / 青岭精工 / SEIREI SEIKO」にする。描画ロジックは触らない（CLAUDE.md §2-9）。

- 分類：6 → **7**（ナレッジ検索・問い合わせ／品質・不具合対応／文書・資料作成／日中コミュニケーション／見積・数字／図面・BOM・技術文書／汎用業務支援）
- 中分類：12 → **15**
- サービス：33 → **33**（id は全て新規 `kn1`…`gn5`。旧 33 件の処遇＝残 10／統合 14／落 9 は設計書 §4）
- タグ：36 → **35**
- `T` キー：27（不変。`wordmark` の値のみ変更）
- `state` 初期値：`openCats: { kn: true }` / `lastCat: 'kn'`

## 受け入れ条件（設計書 §6 の要約）

- [ ] `node tools/verify.mjs` → ALL PASS（warn は既存の `未使用キー: all` のみ。未使用タグの warn なし）
- [ ] `--update` 前の `node tools/regress.mjs` の差分が設計書 §5 と一致（`counts.cats 6→7` / `subs 12→15` / `tags 36→35`、SVCS 削除 33・追加 33、「分類移動／成熟度／tags」行が 0 件、`T(UI キー)` 行なし）
- [ ] `node tools/regress.mjs --update` 後 PASS。baseline の `counts` が `{"cats":7,"subs":15,"svcs":33,"tags":35,"ui":27}`
- [ ] `git diff` が `TAGS` / `CATS` / `SVCS` の 3 リテラル ＋ `T.wordmark` 値 ＋ `state` の 2 初期値 ＋ SVCS 直前コメント ＋ baseline ＋ README/index の文言行に収まる
- [ ] ブラウザで ja / zh / en 切替：サイドバー 7 分類・33 件、中分類件数が設計書 §5-3 と一致、空欄・別言語混入なし
- [ ] ワードマークが 3 言語で切り替わり、dashed 枠・色・書体は不変
- [ ] 検索「8D」「BOM」「发票」「fapiao」で該当サービスが出る
- [ ] ダークモードで「構想」バッジ（qa2 / nm1 / en3）が表示される

## 触らない範囲

`T` のキー集合、`PATTERNS`、`state` のキー集合、`data-act`、描画関数・ハンドラ・ヘルパー、2 つの `<style>`、`.wordmark` の見た目、`dept` / `appTitle`、`.mockbar`、`localStorage` キー、`tools/*.mjs` のロジック、`pages.yml`、`mock/top.html`

## PR 分割案

- **A-1（本 Issue、1 PR）**：`feat/customer-catalog-data`。TAGS / CATS / SVCS は相互参照があるため分割しない。
- 後続 **B**（`docs/handoff/2026-09-06-demo-scenarios.md`）は A のマージ後に着手（直列）。

PR 本文に「設計書 `docs/handoff/2026-09-06-customer-catalog-data.md` §5 のデータ変更に伴う基準更新」と明記すること。

## PM 判断待ち（設計書 §8）

P-1 分類数（推奨 7）／P-2 総件数（推奨 33）／P-3 仮社名（推奨 青嶺精工）／P-4 kn5 名称の長さ／P-5 過去不具合検索を独立させるか（推奨 統合）／P-6 中国側表記（推奨 大陸慣用）／P-7 `dept` 変更（推奨 対象外）／P-8 wordmark 枠（推奨 現状維持）

マージ時に PM が CLAUDE.md §6 バックログの「6 分類 24 サービス」を「7 分類 33 サービス」へ更新する。
