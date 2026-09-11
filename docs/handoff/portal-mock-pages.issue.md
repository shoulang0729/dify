# 社内ポータルの概念モックを `mock/` に取り込み、カタログのデータ層を共有して台本が動くようにし、Pages で公開する

**設計書：** [`docs/handoff/2026-09-11-portal-mock-pages.md`](2026-09-11-portal-mock-pages.md)
**レーン：** M/L　**ラベル：** `run:cloud`
**公開先：** `https://shoulang0729.github.io/dify/portal.html`（`pages.yml` は `path: mock` のまま。マージで自動デプロイ）

---

## なにをするか

PM が 30 件近いコメントでレビューして作り込んだ社内ポータルの概念モック（15 画面・単一 HTML・185KB）を
dify リポの `mock/` に取り込む。そのとき

1. **`catalog.html` と同じ作法で 4 層に分ける**（データ／状態とヘルパー／描画／イベント）
2. **カタログ 67 件のコピー（`CAT` / `CATN`）を捨て、`mock/js/data/catalog.js` を正本にする**
3. **サービス → ポータル画面の対応表を `SVCS[].place` に移す**（バッジも配置も同じ 1 か所から決まる）
4. **台本（`SCENARIOS`）をポータルの中で再生する。レイアウトはカタログのデモ画面とは別**
5. **Pages に出す**

**やらないこと：** NocoBase の実装。iframe での埋め込み。別タブで開く。

---

## 決まっていること（設計書 §0 の抜粋）

| # | 決定 |
|---|---|
| D1 | 置き場所は dify リポの `mock/portal.html`（Pages の同じサイトの 2 枚目） |
| D3 | `css/tokens.css` を `<link>` で共有し、ポータル固有は `css/portal.css`。`components.css` は読まない |
| D4 | ポータルのインライン token ブロックは捨て、そこにしか無かった **22 セマンティックトークンを `tokens.css` に足す**（`--ntt-*` 不変・dark ブロックは 1 つのまま） |
| D5 | `CAT` / `CATN` を削除して `CATS` / `SVCS` を読む |
| D6 | 対応表は **`SVCS[].place`**（画面 id ／ `'*'` ／ `'out'` ／ キー無し＝未配置） |
| D8 | **共有するのはデータだけ**（`SCENARIOS` / `TEMPLATES`）。**描画はポータルの `js/portal/demo.js`** |
| D9 | 台本は**右ドロワー**で見せる。行の文脈が入力の先頭に自動で入り、結果はドロワーに返る |
| D10 | `SCENARIOS` の解決は `[ポータルの業種, ...INDUSTRIES の id]` 順。**`SCENARIOS.it` が足されてもポータルは 1 行も直さない** |
| D11 | **`localStorage` は既存の `mock.lang` / `mock.theme` だけ。4 つ目のキーは作らない** |
| D12 | 多言語は「ラベル辞書 `PT` は ja/zh/en 完全一致」まで。画面本文の解説散文は v1 は日本語のまま（§13 Q1） |
| D13 | `tools/verify.mjs` に **§17** を足す（§13〜§16 は既に使用済み。§17 が最初の空き） |

---

## PR の分割案（4 本。PR-1 → PR-2 → PR-3 → PR-4）

### PR-1 `feat/<issue>-pr1-portal-split` — 取り込みと層分け
- 新規：`mock/portal.html` / `mock/css/portal.css` / `mock/js/data/portal/*.js`（7 本）/ `mock/js/portal/{app,render,events}.js`
- 変更：`mock/css/tokens.css`（22 トークン追加）/ `mock/index.html` / `mock/README.md` / `tools/lib/load.mjs`（`loadPortal` 追加）/ `tools/verify.mjs`（§17-a,b,d,e,f,h,i,j）
- **この PR のマージで Pages に 15 画面が出る。**

### PR-2 `feat/<issue>-pr2-place` — 対応表をカタログのデータ層へ
- `mock/js/data/catalog.js` に `place` を 67 件（**追加行だけ**）／ `PLACE` 削除・`POUT` 新設 ／ AI ブロックを `place` から自動生成 ／ `tools/regress.mjs` に `place` を足して `--update` 1 回 ／ verify §17-c,g
- **IT 業の PR が先にマージされる場合はそのあとに回す**（同じ `catalog.js` を触るため）

### PR-3 `feat/<issue>-pr3-demo` — 台本をポータルで再生する
- `mock/js/portal/demo.js`（新）／`PT` の 28 キー（3 言語）／`PCTXDEF`／`portal.css`
- 文脈カード・テンプレート 5 種の入力・結果パネル・往復・業種フォールバック・英語のときの注記

### PR-4 `feat/<issue>-pr4-writeback` — 結果を行に残す／AI サービス画面の作り直し
- 行の下に「AI の戻り」1 行（メモリのみ）／iframe プレースホルダを `catalog.html` への相対リンクに置換／「置き場所を決めていない N 件」タイル
- **時間が無ければこの PR だけ落とせる**（PR-3 までで「結果がポータルに返る」は成立）

---

## 受け入れ条件（全 37 件は設計書 §12。要点だけ）

- `npm test`（verify ＋ regress）PASS。**`regress` の `counts` が 1 つも変わらない**
- `mock/catalog.html` / `js/app.js` / `js/render.js` / `js/events.js` / `css/components.css` /
  `js/data/{ui,catalog,home,style,live}.js` / `js/data/scenarios/**` の **diff がゼロ**（PR-2 の `catalog.js` の `place` 追加行を除く）
- `mock/css/tokens.css` の **`--ntt-*` の行が 1 つも変わっていない**。`:root[data-theme="dark"]` は **1 つのまま**
- `mock/css/portal.css` に **色の直値（`#RGB` / `#RRGGBB`）が 1 つも無い**
- `mock/js/data/portal/**` に `document` / `localStorage` / 関数呼び出しが無い（`loadPortal()` が vm で読める）
- **移設前後で 15 画面が同じ**（`ja/light`・`zh/dark`・`en/light` のスクリーンショット比較）。**3 層の色分けが 1 ブロックも変わらない**
- `mock.lang` / `mock.theme` が `catalog.html` と共有される。**`mock.fav` は読み書きしない**
- `place` 67 件が設計書 §4-5 の表と完全一致（49 ＋ 18）。**`SVCS` に 1 件足して `place:'proj'` にすると案件画面のボタンが増える**（描画コードを直さずに）
- **台本が動く**：案件行から DC-08 を開き、文脈（P-2411 / 青嶺精工 / 篠崎 悠真 / 進行中）が見えたまま実行 → 結果 → 3 往復
- **`mock/js/data/scenarios/**` の diff がゼロ**（台本は 1 バイトも書き換えない）
- 業種 `it` で「この台本は製造業向けのものを流用しています」が出る。`window.SCENARIOS.it` を手で足すとそちらが優先される
- UI が `en` のとき台本は日本語で動き、`PT.scriptLangNote` が出る
- `file://` で `portal.html` を直接開いても 15 画面が描画され、コンソールエラー 0 件

---

## 触らない範囲（明示）

**1 バイトも触らない：**
`mock/catalog.html` ／ `mock/js/app.js` ／ `mock/js/render.js` ／ `mock/js/events.js` ／ `mock/css/components.css` ／
`mock/js/data/{ui,home,style,live}.js` ／ `mock/js/data/scenarios/**`（**読むだけ**）／ `mock/scripts.html` ／
`.github/workflows/**` ／ `data/world/**` ／ `dify/**` ／ `scripts/**` ／ `docs/demo/**` ／ `docs/dify/**` ／
`tools/check-world.mjs` ／ `tools/gen-index.mjs` ／ `docs/service-map.md` ／ `CLAUDE.md` ／ `.claude/**`

**`mock/js/data/catalog.js`** は PR-2 でだけ触る。触ってよいのは **`SVCS` の各要素に `place:` を足すこと**だけ。
`id` / `cat` / `sub` / `st` / `industries` / `tags` / `name` / `desc` / `added` と `CATS` は 1 バイトも変えない。

**`tools/verify.mjs`** は §17 の追加のみ。§1〜§16 は触らない。
**`tools/lib/load.mjs`** は `loadPortal()` の追加のみ。`loadMock()` は 1 バイトも変えない。

**他の architect が並行しているため触らない設計書：**
`docs/handoff/2026-09-10-portal-nocobase.md` ／ `2026-09-11-nocobase-research.md` ／ `portal-nocobase.issue.md` ／
`2026-09-11-it-industry.md` ／ `it-industry.issue.md` ／ `2026-09-11-repo-layout-v3.md`

---

## PM 判断待ち（設計書 §13）

| # | 論点 | 推奨 |
|---|---|---|
| Q1 | 画面本文（見出し・表ヘッダ・解説）を zh / en に訳すか | **v1 は訳さない。**Pages に出してから決める |
| Q2 | カタログ側に「ポータルから使える」バッジを出すか | **v1 は出さない**（PM 自身がモックで判断を保留した箇所） |
| Q3 | 案件ステージ単位の割り付けもカタログのデータ層に持つか | **v1 はポータル側に残す**（`place` だけで「1 行足せばボタンが増える」は満たせる） |
| Q4 | 翠雲システムズを `data/world/` に昇格させるか | **v1 は `js/data/portal/org.js` を正本。**昇格は別 Issue |
| Q5 | `LIVE`（稼働中アプリの URL）をドロワーに出すか | **v1 は出さない**（`LIVE` は現時点で空） |
| Q6 | `PNEW`（未採番の追加候補）を IT 業の設計に渡すか | **渡す。**この Issue にコメントでリンクするだけ。**IT の PR は待たない** |
| Q7 | `CLAUDE.md` の改定 5 箇所（設計書 §8-3 に全文） | **PR-1 のマージ後に別 PR** |
| Q8 | PR-4（結果を行に残す）をやるか | **やる。**ただし落とせる |

---

## 関連

- `CLAUDE.md` §2-1 / §2-2 / §2-3 / §2-4 / §2-5 / §2-6 / §2-8 / §2-9 / §2-10 / §2-11 / §2-13
- `docs/handoff/2026-09-07-split-catalog.md`（層分けの作法）
- `docs/handoff/2026-09-08-finance-catalog.md`（業種の 2 段構造）
- `docs/handoff/2026-09-08-live-links.md`（verify の節番号の取り合い）
