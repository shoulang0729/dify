# LG-01 の台本を「ファイルを渡して体裁を保ったまま返す」形に作り直す（form → upload）

**ラベル**：`run:cloud`
**レーン**：M（`mock/js/data/**` のデータ層・台本に触る）
**設計書**：`docs/handoff/2026-09-12-lg01-upload-script.md`

## 背景

`docs/handoff/2026-09-11-bp-usecases.md` §5-4 / §10 Q4 / §13-7 で「別 Issue」とされた項目。PM が 2026-09-12 に「やる」と決定。

現行の LG-01 台本は原文をフォームに貼り付ける形（`template: 'form'`）で、実務（本社から届く Word の技術連絡書と Excel の別紙を、見出し・表・段落の体裁を保ったまま中国語にして現場へ配る）と差がある。BP 製品を買うかどうかとは独立に、業務の事実として台本を実務に寄せる。

## やること

1. `mock/js/data/scenarios/mfg/lg.js` の `lg1` を **設計書 §4-3 の全文**で置き換える（`template: 'upload'`、3 往復、ja/zh 台本、`input.files` 2 件、`result` は `items` 6 項目）
2. `mock/js/data/catalog.js` の `SVCS.lg1` の **`desc` だけ**を設計書 §5-2 の 3 言語に差し替える（案 A。§12 P1 参照）
3. `npm run index` で `docs/service-map.md` を再生成する
4. `docs/dify/usecases/LG-01.md` の **§10 末尾に 1 ブロック追記**（設計書 §6 の文面。他の節は 1 文字も変えない）

## 決定事項（設計書 §0）

| # | 決定 |
|---|---|
| 1 | `template` を `form` → `upload`。`TEMPLATES` は 5 種のまま増やさない。`result` は `items`（`columns`+`rows` との併用は verify §9 が禁止） |
| 2 | `desc` は 3 言語同時に差し替え（案 A）。`st: 1` は据え置き。実機とデモの差は `usecases/LG-01.md` §10 に明記 |
| 3 | `industries: ['mfg']` のまま（世界の語彙を混ぜない／業種ごとの台本が要る／`regress` の `byIndustry` を動かさない） |
| 4 | 台本の値は `data/world/mfg/` にある語だけ。**`data/world/**` は触らない**（照合表は設計書 §8）。ペルソナは現行の呉 婷／王 磊を維持 |
| 5 | PR は 1 本。**`regress` は差分なし**（スナップショットに `name`/`desc`/`SCENARIOS`/`template` は入らない）。`--update` 禁止 |

## データ層の件数と id（**変わらない**）

`CATS` 15 分類 / 35 中分類、`SVCS` 82 件、`TAGS` 67、`T` 91、mfg 50 / fin 30 / it 26、`svcsMulti` 12 — **すべて変更前と同じ**。
`lg1` の `id`/`cat`/`sub`/`st`/`industries`/`tags`/`place` も変えない（`lg1` / `lg` / `trans` / `1` / `['mfg']` / `['translate','glossary']` / `'*'`）。
→ `tools/regress.baseline.json` は **diff に現れてはいけない**。

## PR の分割案

| PR | ファイル | 内容 |
|---|---|---|
| **PR-1** | `mock/js/data/scenarios/mfg/lg.js` / `mock/js/data/catalog.js` / `docs/service-map.md` / `docs/dify/usecases/LG-01.md` | 台本置き換え＋`desc`＋索引再生成＋§10 追記 |

`mock/js/data/scenarios/**`・`catalog.js` を触る他の PR とは**直列**。`portal/**` の PR とは並列可。

## 受け入れ条件（設計書 §10）

1. `node tools/verify.mjs` ALL PASS
2. `node tools/regress.mjs` PASS かつ**差分ゼロ**（`regress.baseline.json` が diff に現れない）
3. `npm test` PASS
4. `npm run index` 済み。`docs/service-map.md` の LG-01 行が `mfg/lg.js form` → `mfg/lg.js upload`。**他の行は変わらない**
5. `npm run world` の合計が **12 件のまま**（製造 10 / 金融 1 / IT 1）
6. `mock/catalog.html` を `file://` で開き、mfg × P1 × ja と zh の両方で LG-01 のデモが **3 ターン目まで到達**。ファイルチップ 2 件・結果 6 項目が崩れない
7. `mock/portal.html` の AI ブロックから LG-01 を開き、`upload` のドロワー（ファイルチップ＋`uploadNote`）が崩れず 3 ターン消費できる
8. デモ途中の言語切替（ja ⇄ zh）で会話が復元される
9. `git diff --stat` が **4 ファイルだけ**
10. `docs/dify/usecases/LG-01.md` の diff が §10 への 1 ブロック追加のみ
11. 実在企業名・BP 製品名・URL・個人情報が無い

## 触らない範囲

- `dify/**`（`apps` / `kb` / **`tests`** / `env` / `state` / `results`）。**`dify/tests/LG-01.json` の期待語は緩めない**。実機をファイル入力に作り直すのは**別 Issue**（`run:mac` / `run:runner`）
- `data/world/**`（新しい名前・数字を足さない）
- `mock/js/data/ui.js`（`TEMPLATES` を含む）・`mock/js/app.js` / `render.js` / `events.js`・`mock/css/**`・`mock/index.html`・`mock/portal.html`・`mock/js/portal/**`
- `mock/js/data/scenarios/mfg/lg.js` の `lg2` / `lg3` / `lg4`、`catalog.js` の `lg1.desc` 以外すべて
- `tools/**`（`regress.baseline.json` を含む）
- `docs/dify/usecases/LG-01.md` の §10 以外、`docs/dify/build-or-buy.md`、`docs/handoff/2026-09-11-bp-usecases.md`
- `CLAUDE.md`・`.claude/**`・`.github/**`・`portal/**`

## PM 判断待ち

- **P1**：`desc` を変えるか（顧客に見える文言）。推奨は案 A（設計書 §5-2）。案 B（据え置き）なら PR から `catalog.js` が落ちる
- **P2**：1 ターン目に未登録語を一般訳「技术通知书」で出す演出。推奨は採用
- **P3**：実機（Dify）をファイル入力に作り直すか。推奨は別 Issue（`PC-13` の外部変換が絡む）
