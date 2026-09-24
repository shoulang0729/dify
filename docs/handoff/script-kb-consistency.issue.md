# 台本・KB・テスト・ポータルの「同じ番号・同じ値」をそろえる（Cowork 取り込み #340〜#343 の PM 決定）

- ラベル：`run:cloud`（KB の実機反映は別 Issue `run:runner`＝下記 PR-1r）
- 設計書：`docs/handoff/2026-09-24-script-kb-consistency.md`
- 関連：PR #340〜#343、手渡しメモ `docs/handoff/cowork/2026-09-23-*.md`（4 本）、`docs/handoff/2026-09-16-showcase-demo.md` §20（本件で追補）
- レーン：M/L

## 何をするか

1. **出典番号の食い違いを分ける**（設計書 §2）
   - 深穴ドリルの記録を新番号に：`NC-2024-0118`→`NC-2024-0321`（折損）、`TR-2023-041`→`TR-2023-063`（条件検討）、`TR-2024-102`→`TR-2024-064`（工具交換基準）。**深穴の意味の箇所だけ**（kn1・dc3・pt3・pt8・eg1・`dify/kb/KN-01/**`・`docs/dify/usecases/{KN-01,DC-03,PT-03,PT-08}.md`・`dify/README.md`）
   - `TR-2024-007` は番号を変えず `records.csv` の件名を KB に合わせて訂正（件名「E-47 アラームの原因調査」は他のどこにも使用例が無かった）
   - `NC-2025-0912`／`8D-25-0912` を塗装ブツに訂正（幕 1 優先）。寸法ばらつきは `NC-2025-0904` に分離。ポータル `common.js` 2 行・`front.js` 3 行
   - `tools/check-world.mjs` に **W10**（記録番号の件名の照合。語彙は `data/world/mfg/record_terms.csv`。warn のみ・CI に入れない）
2. **KN-03 の年休未消化の精算**を「日給の 300%（うち 100% は通常の賃金として支払済み）」に（KB 3 ファイル・台本 kn3 の 4 か所・`KN-03.md` T03・テスト `KN-03 T03` を追加）。法令の条文番号・官庁名は書かない
3. showcase 設計書 §20 追補（PR-0 で済み）
4. `desc` 3 件（DC-03・KN-11・EN-03）を 3 言語同時に差し替え（設計書 §4 に全文）
5. 運用：runbook の口上 2 文（PR-0 で済み）。KN-03 の周知日は足さない。KN-01 の Rev.D の日付は **PM 判断待ち（Q1）**

## 受け入れ条件

- [ ] `node tools/verify.mjs` ALL PASS / 17 warn（変更前と同数）
- [ ] `node tools/regress.mjs` PASS、件数不変（`cats 15・subs 36・svcs 87・tags 67・ui 94`。`--update` しない）
- [ ] `node tools/check-world.mjs` 合計 12 件（製造 10／金融 1／IT 1）のまま、W10 は 0 件（PR-3 マージ後）
- [ ] `python3 dify/check.py` exit 0
- [ ] `python3 scripts/dify/run_tests.py --dry-run --out "$(mktemp -d)" KN-01 KN-03` → 9/9 合格
- [ ] `npm run ci` exit 0（dry-run 合計 49/49）
- [ ] `node portal/tools/check-seed-fresh.mjs` PASS（`portal/seed` の再生成は不要）
- [ ] PR-1 で `npm run index` 済み（KN-03 のテスト件数 4→5）
- [ ] 台本の置換数：kn1 8・dc3 6・pt3/pt8 8・eg1 2。kn11・kn12 の `NC-2024-0118`（位置ずれ）は残る
- [ ] 実機：`kb_refresh`（KN-01 KN-03）→ `run_tests` で KN-01 4/4・KN-03 5/5（PR-1r）

作業用コピーでの実走結果は設計書 §7。

## 触らない範囲

- `NC-2024-0118` を位置ずれの意味で使う箇所（kn11・kn12・`front.js` 223 行・`tools/gen-demo-assets.mjs`・`mock/assets/demo/**`・`documents.csv`・`equipment.csv`）
- `front.js` の `TR-2023-041`（金型保管）・`TR-2024-102`（塗装治具）の行、`mgmt.js`
- `dify/tests/KN-01.json`・`dify/apps/**`・`dify/env/**`・`dify/state/**`・**`dify/results/**`**・`scripts/dify/tests/test_lang_check.py`
- `docs/handoff/**` の既存文書（showcase は §20 の追記だけ）・`docs/dify/usecases/QA-02.md`
- `mock/**` の描画・イベント・CSS、`T`/`TAGS`/`CATS`/`HOME`/`FEED`、`localStorage`、`portal/**`、`CLAUDE.md`、`.claude/**`、`.github/**`
- 件数：`SVCS[].id` の追加・改名・削除なし

## PR の分割案

| PR | 中身 | ラベル | 順序・並列 |
|---|---|---|---|
| PR-0 | 設計書・本 Issue 本文・showcase §20・runbook 2 文（docs のみ） | `run:cloud` | 最初 |
| PR-1 | `data/world/mfg/records.csv`・`calendar.md`・`data/world/README.md`・`dify/kb/KN-01/`（4）・`dify/kb/KN-03/`（3）・`dify/tests/KN-03.json`・`docs/dify/usecases/{KN-01,KN-03,DC-03,PT-03,PT-08}.md`・`dify/README.md`・`docs/service-map.md` | `run:cloud` | PR-2 と並列可。マージは PR-2 より先 |
| PR-1r（別 Issue） | `dify-ops.yml`：`kb_refresh` KN-01 KN-03 → `run_tests` KN-01 KN-03 | `run:runner` | PR-1 マージ後 |
| PR-2 | `mock/js/data/scenarios/mfg/{kn,dc,pt,eg}.js`・`mock/js/data/catalog.js`・`mock/js/data/portal/{common,front}.js` | `run:cloud` | PR-1 と並列可 |
| PR-3 | `tools/check-world.mjs`（W10）・`data/world/mfg/record_terms.csv`（新）・`data/world/README.md` | `run:cloud` | PR-1・PR-2 のマージ後（先に入れると check-world の合計が 12 を超え CLAUDE.md §2-13 と食い違う）。`tools/**` は直列 |

## PM 判断待ち

- **Q1（必須）** KN-01 の Rev.D の日付：「日付だけ」だと Rev.C（2025-11-10）が Rev.D より後になり、Rev.D が 2026 年の文書を参照する矛盾も生まれる。案 A'（日付だけ＋Rev.C）／B（KB 全体を 1 年前倒し）／**C（変えずに `calendar.md` の未統一に記録。推奨）**。決まるまで PR-1 は Q1 の差分なしで進めてよい
- Q2（軽）runbook 57 行「確信度の低い 1 項目」を「2 項目・記入者本人」に直すか —— 推奨：直す（S レーン）
- Q3（軽）KN-12 の台本に `NC-2025-0904` を過去記録として足すか —— 推奨：足さない
