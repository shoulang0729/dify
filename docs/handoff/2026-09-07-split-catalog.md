# リファクタリング P2 — `catalog.html` を層ごとにファイル分割（ビルド不要）

- Issue: #77
- レーン: **M/L**（共通レイヤー・トークン・データ層・検証ハーネス・Pages 公開物すべてに触る）
- 基準コミット: `e94afc7`（`mock/catalog.html` 4,242 行 / 572 KB）
- 前提: **Issue #74（NEW 表示）のマージ後に着手**。#74 は `T`・コンポーネント CSS・`cardHTML` を触るため、先に入れて行番号を確定させる
- 設計者: architect（実装しない）

---

## 0. 目的（何が困っていて、何が解決すれば終わりか）

| 困りごと | 解決の形 |
|---|---|
| Claude Design（CSS・描画）／台本 writer（データ）／PM（文言）が同じ 572 KB の 1 ファイルを編集し、並列作業が常に直列に落ちる | 編集者ごとにファイルが分かれ、**衝突がファイル単位で機械的に判定できる** |
| `mock/index.html` がトークン定義を**コピー**して持っており、手で同期している（現時点で既に catalog.html 側にある 74 行分の新トークンが index.html に無い） | index.html が `css/tokens.css` を `<link>` で参照し、**コピーが 0 になる** |
| 「1 つ目の `<style>` / 2 つ目の `<style>`」という**位置に依存した**ルール（CLAUDE.md §2-2、Claude Design 引き渡しメモ §2）が壊れやすい | ルールが**ファイル名**を指すようになる |

**維持するもの（この設計の制約）**：静的 HTML/CSS/JS・**ビルド不要**・`file://` でも GitHub Pages でも同じに動く・検査項目を 1 つも減らさない・データ層の中身は 1 バイトも変えない（`regress` の差分 0）。

**非目標**：見た目の変更、データの追加・修正、描画ロジックの改善、ES modules 化、バンドラ導入、npm 依存の追加。

---

## 1. 分割後のファイル構成

```
mock/
├── catalog.html            殻（HTML と <link>/<script src> のみ）
├── index.html              デモガイド（トークンは <link> 参照に置換）
├── css/
│   ├── tokens.css          現在の 1 つ目 <style>
│   └── components.css      現在の 2 つ目 <style>
├── js/
│   ├── data/
│   │   ├── ui.js           T / PATTERNS / TAGS / TEMPLATES
│   │   ├── catalog.js      CATS / SVCS
│   │   ├── home.js         HOME / FEED
│   │   ├── style.js        CAT_STYLE
│   │   └── scenarios/
│   │       ├── kn.js  qa.js  dc.js  lg.js
│   │       └── nm.js  en.js  gn.js  pt.js      （大分類 8 ファイル）
│   ├── app.js              state / ヘルパー / detectLang / デモ制御 / 設定の永続化
│   ├── render.js           renderChrome 〜 renderMain / *HTML / renderAll
│   └── events.js           click ハンドラ / 言語・テーマの listener / 起動
├── README.md
└── .nojekyll
```

### 1-1. 各ファイルの内容・出所・規模・主な編集者

行範囲は基準コミット `e94afc7` のもの。**#74 マージ後に行番号は変わるので、実装は「行番号」ではなく下表の「開始マーカー／終了マーカー」で切り出すこと**（§9-1）。

| ファイル | 出所（`mock/catalog.html` の行範囲 @e94afc7） | 行数 | サイズ | 主な編集者 |
|---|---|---|---|---|
| `css/tokens.css` | 16–302（1 つ目 `<style>` の中身） | 287 | 11.9 KB | Claude Design（値のみ）／PM |
| `css/components.css` | 305–978（2 つ目 `<style>` の中身） | 674 | 38.8 KB | Claude Design |
| `js/data/ui.js` | `T` 1024–1116 ／ `PATTERNS` 1117–1135 ／ `TAGS` 1136–1184 ／ `TEMPLATES` 1484–1531 | 209 | 約 13 KB | PM・翻訳 |
| `js/data/catalog.js` | `CATS` 1185–1247 ／ `SVCS` 1248–1483 | 299 | 約 40 KB | PM（§2-9 の顧客版差し替え） |
| `js/data/home.js` | `HOME` 3293–3324 ／ `FEED` 3344–3388 | 77 | 約 8 KB | PM |
| `js/data/style.js` | `CAT_STYLE` 3325–3343 | 19 | 約 4 KB | Claude Design（SVG path のみ） |
| `js/data/scenarios/kn.js` | `SCENARIOS` の `kn*` ブロック | 114 | 22.2 KB | 台本 writer |
| 〃 `qa.js` | `qa*` | 168 | 31.0 KB | 〃 |
| 〃 `dc.js` | `dc*` | 364 | 78.2 KB | 〃 |
| 〃 `lg.js` | `lg*` | 168 | 36.0 KB | 〃 |
| 〃 `nm.js` | `nm*` | 220 | 38.5 KB | 〃 |
| 〃 `en.js` | `en*` | 118 | 26.6 KB | 〃 |
| 〃 `gn.js` | `gn*` | 256 | 65.7 KB | 〃 |
| 〃 `pt.js` | `pt*` | 351 | 92.8 KB | 〃 |
| `js/app.js` | 3389–3516（`const state` 〜 `applyPrefs()` の直後まで） | 128 | 約 6 KB | **触らない層**（§2-3） |
| `js/render.js` | 3517–4181（`renderChrome` 〜 `renderAll`） | 665 | 約 30 KB | Claude Design |
| `js/events.js` | 4182–4239（click ハンドラ 〜 起動） | 58 | 約 3 KB | **触らない層**（§2-3） |
| `catalog.html`（残る殻） | 1–15 / 979–1018 / 4240–4242 ＋ `<link>`/`<script src>` | 約 62 | 約 3.5 KB | ほぼ固定 |

**合計 17 ファイル**（`catalog.html` `index.html` ＋ CSS 2 ＋ データ 12 ＋ アプリ 3）。分割後の総行数・総バイト数は分割前と同じ（ヘッダーコメント分だけ増える）。

### 1-2. PM 提示の構成からの変更点と理由

| PM 案 | 本設計 | 理由 |
|---|---|---|
| `js/data/ui.js` = T/PATTERNS/TAGS/TEMPLATES | 同じ | — |
| `js/data/catalog.js` = CATS/SVCS/**CAT_STYLE/HOME/FEED** | `catalog.js` = CATS/SVCS、**`home.js` = HOME/FEED**、**`style.js` = CAT_STYLE** に 3 分割 | 分割の目的は「**編集者ごとに分ける**」。`CATS`/`SVCS` は §2-9 の顧客版差し替え（regress の主対象）、`HOME`/`FEED` は ②③ の疑似データ（PM が数字と文面を触る）、`CAT_STYLE` は **Claude Design が触ってよい唯一のデータ**（引き渡しメモ §2「SVG path だけは差し替え可」）。同じファイルに置くと、差し替え PR とデザイン PR が再び衝突する。`style.js` は 19 行だが、designer に「`css/**` と `js/data/style.js` と `js/render.js` だけ」と言い切れる価値が大きい |
| `js/data/scenarios/` を **1 サービス 1 ファイル（43 個）** | **大分類 8 ファイル** | §10-1 に判断根拠。要約：①サービス追加で殻（`catalog.html`）を触らずに済む ②中国からの回線でリクエスト数を増やさない ③同一分類の別サービスは行が離れるため git が自動マージできる ④台本作業は通常 1 分類単位で割り当てる。**将来 1 サービス 1 ファイルに変えても読み込み契約は変わらない**（`<script>` タグ一覧が増えるだけ） |
| `js/app.js` に state / render / ハンドラを全部 | **`app.js` / `render.js` / `events.js` の 3 分割** | 引き渡しメモ §2 の「`<script>` 中盤＝触らない／後半＝描画は変えてよい」という**層の境界をファイル境界に一致させる**ため。分割前の 3389 行目以降には `/* 6. 描画 — 固定文言 */` という明確な切れ目があり、追加コストはゼロ。Claude Design は `render.js` だけを開けばよく、`state`・`data-act`・`detectLang`・localStorage（verify §7 の対象）は designer が開かないファイルに固まる。最小リスクで進めたい場合は `app.js` 1 本でも読み込み契約は同じ（§10-4） |

---

## 2. 読み込み順と依存

### 2-1. `catalog.html` の殻（確定形）

```html
<head>
  <meta charset="UTF-8">                          ← 変更なし（.js の文字コード解決に効く。§12-1）
  <meta name="viewport" …>
  <title>…</title>
  <template id="__bundler_thumbnail" …>…</template>   ← 触らない（削除は別 Issue）
  <link rel="stylesheet" href="css/tokens.css">
  <link rel="stylesheet" href="css/components.css">
</head>
<body>
  … 既存の .app / .mockbar / header / #sidebar / main（1 行も変えない）…

  <!-- データ層（純粋なリテラルのみ。実行時副作用なし） -->
  <script src="js/data/ui.js"></script>
  <script src="js/data/catalog.js"></script>
  <script src="js/data/home.js"></script>
  <script src="js/data/style.js"></script>
  <script src="js/data/scenarios/kn.js"></script>
  <script src="js/data/scenarios/qa.js"></script>
  <script src="js/data/scenarios/dc.js"></script>
  <script src="js/data/scenarios/lg.js"></script>
  <script src="js/data/scenarios/nm.js"></script>
  <script src="js/data/scenarios/en.js"></script>
  <script src="js/data/scenarios/gn.js"></script>
  <script src="js/data/scenarios/pt.js"></script>
  <!-- アプリ層 -->
  <script src="js/app.js"></script>      <!-- state / ヘルパー。冒頭でデータの存在を assert -->
  <script src="js/render.js"></script>   <!-- 描画。app.js のヘルパーに依存 -->
  <script src="js/events.js"></script>   <!-- ハンドラと起動。render.js に依存。必ず最後 -->
</body>
```

**規約**：
- **古典的スクリプト**。`type="module"` にしない（`file://` は module を CORS で拒否する）。`defer` / `async` / `integrity` / `crossorigin` も付けない（`</body>` 直前に置くので不要、かつ順序保証を単純に保つ）。
- パスは**必ず相対**（先頭 `/` 禁止、`../` 禁止）。`mock/` がサイトのルートなので先頭 `/` でも Pages では動くが `file://` で壊れる（§2-8 / §12-3）。
- **タグの並び順＝依存順**。この並びは verify が読み取って実行順の再現に使う（§4-2）ので、勝手に並べ替えない。

### 2-2. なぜ古典的スクリプトで変数が共有されるのか（実装者向けの前提）

古典的スクリプトのトップレベル `const` / `let` は**グローバル字句環境**に入り、**同一ページの後続スクリプトから見える**（`window` のプロパティにはならない）。よって `ui.js` の `const T` は `render.js` から素の `T` で参照できる。分割前と同じ意味になる。

ただし**同じ名前を 2 つのファイルで `const` すると `SyntaxError: Identifier 'T' has already been declared` で 2 つ目以降が丸ごと死ぬ**。これがこの分割の最大の事故源なので、verify に「全 JS を連結して `node --check`」を足して機械検出する（§4-2 の追加検査 A）。

### 2-3. `SCENARIOS` の登録方式

台本ファイルは 8 個あるので `const SCENARIOS` を使えない。**`window` のプロパティ**として累積する：

```js
/* mock/js/data/scenarios/kn.js */
'use strict';
window.SCENARIOS = window.SCENARIOS || {};
Object.assign(window.SCENARIOS, {
  kn1: { template: 'qa',
    …（元の catalog.html の該当ブロックを 1 バイトも変えずに貼る）…
  },
  kn2: { … },
  …
});
```

- `Object.assign(…, { …元のブロック群… })` にすることで、**元の `  kn1: { … },` という行を 1 文字も変えずに移せる**（§9 のバイト同一性検査が成立する）。各ファイル末尾のブロックに末尾カンマは不要（付けても JS として合法）。
- `app.js`／`render.js` からは**素の `SCENARIOS`** で参照できる（グローバルオブジェクトのプロパティ解決）。既存コードの `SCENARIOS[id]`（`scnOf`）は**書き換え不要**。
- 他のデータ（`T`/`PATTERNS`/`TAGS`/`TEMPLATES`/`CATS`/`SVCS`/`HOME`/`FEED`/`CAT_STYLE`）は **`const` のまま**（1 ファイル 1 宣言なので問題ない）。`const` と `window.` を同じ名前で混ぜないこと。

### 2-4. 読み込み順が崩れたときの検出（`js/app.js` 冒頭の assert）

```js
/* mock/js/app.js 冒頭 */
'use strict';
/* 読み込み順の保険。<script src> が 1 つでも欠けた／順序が入れ替わったときに、
   白画面ではなく「どのファイルが来ていないか」を画面に出す。
   注：このメッセージは T（多言語辞書）に置かない。T 自体が来ていない場合に使うため、
       §2-1（3 言語同時）の対象外とする ―― 開発者向けの起動失敗表示であって UI 文言ではない */
(function () {
  var missing = [];
  if (typeof T === 'undefined')          missing.push('js/data/ui.js (T/PATTERNS/TAGS/TEMPLATES)');
  if (typeof CATS === 'undefined' || typeof SVCS === 'undefined') missing.push('js/data/catalog.js (CATS/SVCS)');
  if (typeof HOME === 'undefined' || typeof FEED === 'undefined') missing.push('js/data/home.js (HOME/FEED)');
  if (typeof CAT_STYLE === 'undefined')  missing.push('js/data/style.js (CAT_STYLE)');
  if (typeof SCENARIOS === 'undefined' || Object.keys(SCENARIOS).length === 0)
                                         missing.push('js/data/scenarios/*.js (SCENARIOS)');
  if (!missing.length) return;
  var el = document.getElementById('main');
  if (el) el.innerHTML = '<pre style="padding:24px;white-space:pre-wrap">'
    + 'データファイルが読み込まれていません / Data files are not loaded:\n  - '
    + missing.join('\n  - ')
    + '\n\ncatalog.html の &lt;script src&gt; の並びを確認してください（設計書 2026-09-07-split-catalog.md §2-1）。'
    + '\nCheck the &lt;script src&gt; order in catalog.html.</pre>';
  throw new Error('mock: data files missing — ' + missing.join(', '));
})();
```

- `typeof X === 'undefined'` は**未宣言の識別子に対しても例外を投げない**ので、この形以外で書かないこと（`if (!T)` は ReferenceError になる）。
- `throw` により `render.js` / `events.js` は実行されるが `renderAll()` で失敗する。画面には上のメッセージが残る。
- **この文字列は ja + en の 2 言語**。理由は上のコメントのとおり（§2-1 の 3 言語ルールは辞書 `T`・`TAGS`・`CATS`・`SVCS`・`TEMPLATES`・`PATTERNS`・`HOME`・`FEED` に掛かるもので、起動失敗のフォールバックは対象外）。verify の未定義キー検査（`t('…')`）にも掛からない。

---

## 3. 触らない範囲（明示）

- **データの中身**：`T` / `PATTERNS` / `TAGS` / `TEMPLATES` / `CATS` / `SVCS` / `SCENARIOS` / `HOME` / `FEED` / `CAT_STYLE` の値は**1 バイトも変えない**。`regress` は差分 0（`--update` 禁止）。
- **CSS の中身**：`css/tokens.css` / `css/components.css` は移すだけ。値・セレクタ・並び・コメントを変えない。`--ntt-*` はもちろん、セマンティックトークンの値も触らない。
- **描画・遷移**：`render*` / `*HTML` / `data-act` / `data-arg` / `id="search"` `#msgs` `#chat-input` `#home-holder` / `state` の形 / `view` の 4 値 / `detectLang` / `localStorage` キー。
- **`catalog.html` の body マークアップ**：`.mockbar`・ヘッダー（`#lang-select` `#theme-btn`）・`.app` `.body` `#sidebar` `main` はそのまま。
- **`<template id="__bundler_thumbnail">`**（旧バンドラの遺物）：この PR では触らない。削除の是非は `top.html` 削除（PR-3）と一緒に別 Issue。
- **`.github/workflows/pages.yml`**：`path: mock` のまま（`mock/css` `mock/js` はサブディレクトリなので自動的に公開対象。ワークフローの変更は不要）。
- **`mock/.nojekyll`**：残す。**Jekyll を無効化しているので `js/` `css/` のような普通のディレクトリはそのまま配信される**（`_` 始まりのディレクトリを作らないこと）。
- **`.claude/agents/**` / `.claude/commands/**`**：architect も implementer も触らない（§10-5 で PM に判断を返す）。
- **`CLAUDE.md`**：implementer は触らない。§6 の置き換え案は PM が適用する。

---

## 4. `tools/verify.mjs` / `tools/regress.mjs` の改修方針

### 4-1. 共通ローダーを切り出す

`verify.mjs` と `regress.mjs` が同じ「分割されたファイルからデータを取り出す」処理を持つのは二重管理になる。**`tools/lib/load.mjs`（新規）** に集約する。

```
tools/lib/load.mjs   loadMock(ROOT) → {
  html,           // mock/catalog.html の生テキスト
  indexHtml,      // mock/index.html の生テキスト
  cssLinks,       // catalog.html の <link rel=stylesheet> href を出現順に
  scriptSrcs,     // catalog.html の <script src> を出現順に
  tokenCss, componentCss,           // mock/css/*.css を直接読んだテキスト
  jsSources: [{ path, src }],       // scriptSrcs の順に読んだ全 JS
  dataSources / appSources,         // js/data/** と それ以外に分けたもの
  data: { T, PATTERNS, TAGS, TEMPLATES, CATS, SVCS, CAT_STYLE, HOME, FEED, SCENARIOS }
}
```

**データの取り出し方（重要な設計変更）**：現行の `grab(name)` は「`const NAME = …;` を正規表現で切り出して `Function()` で評価」という脆い方法で、verify §10 のコメントにも「grab() の正規表現に合わない書き方の可能性」と書かれている。分割後は **`node:vm` の 1 つのコンテキストで、`catalog.html` に書かれた順に `js/data/**` を実際に実行する**：

```js
const ctx = vm.createContext({});
vm.runInContext('var window = globalThis;', ctx);           // ブラウザの window の代役
for (const f of dataSources) new vm.Script(f.src, { filename: f.path }).runInContext(ctx);
const data = vm.runInContext(
  '({ T, PATTERNS, TAGS, TEMPLATES, CATS, SVCS, CAT_STYLE, HOME, FEED, SCENARIOS: window.SCENARIOS })', ctx);
```

利点：(a) 正規表現依存が消える、(b) **ブラウザと同じ実行順・同じスコープ規則**で読むので、順序ミスや二重宣言がそのまま verify の FAIL になる、(c) 構文エラーがファイル名と行番号付きで出る。
制約：`js/data/**` は**純粋なリテラル宣言のみ**（`document` / `localStorage` / 関数呼び出しを書かない）。分割前の該当範囲を確認済み — 実行時参照はゼロなので、この制約は現状のまま満たされる。**この制約は新しい load-bearing なので CLAUDE.md §2-3 に追記する（§6）**。

### 4-2. `verify.mjs` の検査項目：現行 → 改修後（**1 つも減らさない**）

| # | 検査 | 現行の対象 | 改修後の対象 | 判定 |
|---|---|---|---|---|
| 1 | JS 構文（`node --check`） | 抽出した 1 つの `<script>` | **各 JS ファイルを個別に** `node --check`（ファイル名付きで失敗箇所が出る） | 維持＋強化 |
| 1-A | **（新規）二重宣言** | — | 全 JS を `scriptSrcs` の順に連結して `node --check`。`const T` の二重宣言など**分割で新たに生まれる事故**を検出 | 追加 |
| 1-B | **（新規）読み込み契約** | — | ①`<script src>`/`<link href>` の実ファイルが存在 ②パスが相対（先頭 `/`・`../` を含まない） ③`js/data/scenarios/` のタグ集合＝同ディレクトリの `*.js` 集合（**タグに書き忘れた台本ファイルは verify を通ってしまうがブラウザでは消える**ため必須） ④順序が `data/ui → data/catalog → data/home → data/style → data/scenarios/* → app → render → events` ⑤`catalog.html` に `<style>` ブロックが 0 個 | 追加 |
| 2 | i18n キー集合（ja/zh/en） | `grab()` の戻り | `load.mjs` の `data` | 維持（ロジック不変） |
| 3 | 未定義キー参照 `t('k')` / `T.k` | `<script>` テキスト | **全 JS ファイルの連結テキスト** | 維持 |
| 4 | 未使用キー（warn） | 〃 | 〃 | 維持 |
| 5 | CSS トークン（`var()` 未定義／dark ブロック 1 個／`--ntt-*` 不上書き／コンポーネント CSS に色直値なし／`data-lang` フォント 3 種／`--cat-*` light-dark 対称／`--cat-<id>` の warn） | 1 つ目・2 つ目の `<style>` | **`mock/css/tokens.css` と `mock/css/components.css` を直接読む**（ロジックは 1 行も変えない） | 維持 |
| 5-A | **（新規）index.html のトークン非コピー** | — | `mock/index.html` が `href="css/tokens.css"` を持ち、かつ**トークン定義を含まない**（`--ntt-future-blue:` などの定義行が無い）。さらに index.html のインライン CSS の `var()` が `tokens.css` で定義済み・色直値なし（**現状で両方 PASS することを確認済み**） | 追加 |
| 6 | データ整合（cat/sub/st/tags・id 重複・管理番号） | `grab()` | `load.mjs` の `data` | 維持 |
| 7 | 共通レイヤー契約 | `<script>` テキスト / `html` | `state`・`data-act`・`detectLang`・`localStorage` は **`js/app.js` + `js/render.js` + `js/events.js` の連結**（どのファイルに置いても通る＝将来の再分割に強い）／`.mockbar`・`#lang-select`・`#theme-btn` は **`catalog.html`** | 維持 |
| 8 | Pages 設定（`path: mock`・`.nojekyll`） | 変更なし | 変更なし。**加えて** `mock/` 直下に `_` 始まりのディレクトリが無いこと（Jekyll 無効でも紛らわしいので明示） | 維持＋追加 |
| 9 | シナリオ整合 | `grab()` | `load.mjs` の `data`（`SCENARIOS` は `window.SCENARIOS`）。**加えて** 各シナリオ id の接頭 2 文字＝置かれているファイル名（`kn1` が `dc.js` にあったら FAIL） | 維持＋追加 |
| 10 | HOME / FEED 整合 | `grab()` | `load.mjs` の `data`。「grab() の正規表現に合わない可能性」という但し書きは削除できる | 維持 |

### 4-3. `regress.mjs` の改修

- 冒頭の `html` 読み込み＋`grab()` を **`loadMock()` の `data` に置換**するだけ。`snapshot` の作り方・比較ロジック・`tools/regress.baseline.json` は**一切変えない**。
- **受け入れ条件：3 つの PR すべてで `node tools/regress.mjs` が差分 0**。`--update` を使ったらこの Issue は失敗とみなす。

---

## 5. `mock/index.html`

**変更はこれだけ**：

- **削除**：`<style>` … `/* tokens/colors.css */` 〜 `/* tokens/spacing.css */` の中身（現行 23–237 行）。これは `catalog.html` のトークンの**古いコピー**で、現時点で既に 74 行分（`--cat-*` 18 個、`--surface-hero*`、`--status-*-text/-hero`、`--badge-due-bg`、dark の `--shadow-*` など）が欠けている。
- **追加**：`</title>` の後、既存のインライン `<script>`（`mock.lang` / `mock.theme` を読む先読みスクリプト）の**後ろ**に

  ```html
  <link rel="stylesheet" href="css/tokens.css">
  ```

- **残す**：先読み `<script>`（`localStorage` の `mock.lang` / `mock.theme` を読んで `data-lang` / `data-theme` を設定する。§2-6。**このスクリプトは触らない**）、2 つ目の `<style>`（index 専用のコンポーネント CSS 73 行。`var()` 未定義ゼロ・色直値ゼロを確認済み）、本文。
- 副作用：index.html が catalog と同じトークン（`--cat-*` など）を持つようになる。index 側は使っていないので**見た目は変わらない**（PR-A の受け入れ条件で light/dark・ja/zh のスクリーンショット比較）。

---

## 6. `CLAUDE.md` の表記置き換え案（**PM が適用する**。implementer は触らない）

| 箇所 | 現行 | 置き換え |
|---|---|---|
| §2-1 冒頭 | 「`mock/catalog.html` 内の `T`・`TAGS`・…」 | 「**`mock/js/data/**` 内の** `T`・`TAGS`・`PATTERNS[].name/desc`・`CATS[].name/abbr/subs[].name`・`SVCS[].name/desc`」 |
| §2-2 冒頭 | 「2つ目の `<style>`（コンポーネント CSS）に `#RRGGBB` の直値を書かない」 | 「**`mock/css/components.css`** に `#RRGGBB` の直値を書かない」 |
| §2-2 2 行目 | 「`--ntt-*` は変更禁止。ダーク対応は…」 | 「**`mock/css/tokens.css`** の `--ntt-*` は変更禁止。ダーク対応は同ファイルの `:root[data-theme="dark"]` で…（**dark ブロックは 1 つだけ**）。**`mock/index.html` は同じ `tokens.css` を `<link>` で参照する。トークンをコピーしない**」 |
| §2-3「データ」 | （置き場の記載なし） | 冒頭に「置き場：`mock/js/data/ui.js`（`T`/`PATTERNS`/`TAGS`/`TEMPLATES`）・`catalog.js`（`CATS`/`SVCS`）・`home.js`（`HOME`/`FEED`）・`style.js`（`CAT_STYLE`）・`scenarios/<分類>.js`（`SCENARIOS`。大分類ごと 8 ファイル、`window.SCENARIOS` に `Object.assign` で登録）。**`js/data/**` は純粋なリテラル宣言のみ**（`document`・`localStorage`・関数呼び出しを書かない。verify が vm で実行して読むため）」を追加 |
| §2-3「状態」「遷移」 | （置き場の記載なし） | 「`state` とヘルパーは `mock/js/app.js`、描画は `mock/js/render.js`、click ハンドラと起動は `mock/js/events.js`。**読み込み順は `catalog.html` の `<script src>` の並びが唯一の正**（`data/ui → data/catalog → data/home → data/style → data/scenarios/* → app → render → events`）。古典的スクリプトのまま（`type="module"` にしない＝`file://` 対応）」 |
| §2-8 | 「`path: mock` で `mock/` をサイトのルートとして公開」 | 末尾に「**`mock/css/**`・`mock/js/**` も公開対象**。`catalog.html`/`index.html` からの参照は**相対パスのみ**（先頭 `/`・`../` 禁止＝`file://` でも開ける）。`mock/` 配下に `_` 始まりのディレクトリを作らない」 |
| §5 並列ルール | 「`mock/catalog.html` の同じ関数を触るお題は直列」 | 「**同じファイル**を触るお題は直列。分割後は `css/components.css`（デザイン）／`js/data/scenarios/<分類>.js`（台本）／`js/data/*.js`（データ）／`js/render.js`（描画）が別ファイルなので、**別ファイルなら並列可**」 |
| §6 バックログ | 「`top.html` の扱い」の項 | 「リファクタリング P2（#77）で `catalog.html` を層ごとに分割済み。P3 候補：`?v=` キャッシュスタンプの機械検証、`tools/bundle.mjs`（単一ファイル生成）、`scenarios/` の 1 サービス 1 ファイル化」を追記 |

---

## 7. Pages とキャッシュ

- **ワークフローの変更は不要**。`upload-pages-artifact` の `path: mock` はディレクトリごと上げるので、`mock/css` `mock/js` はそのまま公開される。`paths:` トリガも `mock/**` なので新規サブディレクトリを拾う。
- GitHub Pages は HTML もアセットも `Cache-Control: max-age=600` 前後で返す。分割前は「1 ファイルが古い」だけだったが、分割後は「**HTML は新しいのに CSS/JS が古い**」という組み合わせが最大 10 分発生しうる（自己修復はする）。
- **推奨：P2 では `?v=` を付けない。P3 で機械検証つきで入れる。**
  - 理由：手書きの `?v=<日付>` は更新忘れが必ず起きて、あるときから「付いているのに当てにならない」状態になる。それなら最初から付けないほうが安全。
  - P2 の運用でカバーする：レビュー手順に「**Pages を確認するときは初回だけ強制リロード（Cmd/Ctrl+Shift+R）**」を明記（reviewer の Pages 確認手順・引き渡しメモに追記）。顧客デモは事前に開いて確認するので実害はない。
  - P3 案：`tools/stamp.mjs` が各アセットの内容ハッシュ 8 桁を計算して `catalog.html` / `index.html` のタグに `?v=` を書き込み、`verify.mjs` が「タグの値＝現在の内容ハッシュ」を検査する。忘れたら FAIL、FAIL メッセージに正しい値が出る。
  - PM が P2 でも付けたい場合は §10-2 参照。

---

## 8. `tools/bundle.mjs`（単一ファイル生成）の要否

**推奨：P2 では作らない。**

- 分割後も `file://` でそのまま開ける。オフライン配布は **`mock/` フォルダを zip で渡せば足りる**（`catalog.html` をダブルクリックで動く）。
- 「1 ファイルだけメール添付」が本当に必要になったときに P3 で作る。作る場合の条件を先に決めておく：
  1. 出力は `dist/catalog.single.html`、**`dist/` は `.gitignore`**（生成物をコミットしない。`top.html` が「バンドル済みで手編集不可」になった失敗を繰り返さない）
  2. 結合は `<link>`/`<script src>` をファイル内容に置換するだけ。minify・トランスパイルはしない
  3. `verify.mjs` は**分割ファイルだけ**を見る（生成物は検査対象にしない）

---

## 9. 移行 PR の分割

**共通の前提**：`#74` マージ後の `main` から順に積む。**PR-A → PR-B → PR-C は直列**（すべて `catalog.html` と `tools/verify.mjs` を触る）。各 PR で `node tools/verify.mjs` と `node tools/regress.mjs` が PASS、かつ **Playwright で全画面**（P1/P2/P3 ホーム × light/dark × ja/zh/en、詳細、chat、demo 5 テンプレート）を確認する。

### 9-1. 切り出しの原則（3 PR 共通・受け入れ条件の土台）

- **1 バイトも書き換えない**。実装者が新しく足してよいのは、各ファイル**先頭のヘッダーコメント 1 ブロックと `'use strict';` の 1 行**、およびデータ登録に必要な**ラッパー行**（`window.SCENARIOS = …;` / `Object.assign(window.SCENARIOS, {` / `});`）だけ。
- 行番号ではなく**マーカー**で切る（#74 で行番号がずれるため）：

  | 切り出し | 開始マーカー | 終了マーカー |
  |---|---|---|
  | tokens.css | `<style>` の次の行（`/* tokens/colors.css */`） | 1 つ目の `</style>` の前の行 |
  | components.css | 2 つ目の `<style>` の次の行 | 2 つ目の `</style>` の前の行 |
  | 各データ | `const <NAME> = ` の行（直前のヘッダーコメントを含める） | 対応する `};` / `];` の行 |
  | scenarios | `SCENARIOS` 内の `  <id>: {` 行 | 次の `  <id>: {` の前の行（最後は `};` の前） |
  | app.js | `/* … 3. 状態（共通レイヤー）… */` のコメント開始行 | `/* … 6. 描画 — 固定文言 … */` の直前の行 |
  | render.js | `/* … 6. 描画 — 固定文言 … */` の行 | `function renderAll() { … }` の行 |
  | events.js | `renderAll()` 定義の次の行 | `</script>` の前の行 |

- **PR 本文に、実際に使った抽出コマンド（`sed -n 'A,Bp'` の一覧）を貼る**。reviewer はそれを base コミットに対して実行し、生成物と PR のファイルを `diff` して**差分ゼロ**を確認する（＝バイト同一性の証明）。ヘッダーコメントとラッパー行も抽出コマンドに含める（`{ cat <<'EOF' … EOF; sed -n 'A,Bp' old; } > new`）ことで、`diff` が完全に 0 になる形にする。

### 9-2. PR-A：CSS 分離

**変更**：`mock/css/tokens.css`・`mock/css/components.css` 新規／`mock/catalog.html` の 2 つの `<style>` を `<link>` 2 本に／`mock/index.html` のトークンコピーを `<link>` に置換／`tools/verify.mjs` §5 の対象を CSS ファイルに変更・検査 5-A と 1-B⑤ を追加／`mock/README.md` のツリー更新。

**受け入れ条件**
1. `sed` 抽出の再実行で `css/tokens.css`・`css/components.css` が**差分ゼロ**（ヘッダーコメント込みで一致）
2. `catalog.html` に `<style>` ブロックが 0 個、`<link>` が **tokens → components の順**で 2 本
3. `index.html` にトークン定義行が 0 個、`<link href="css/tokens.css">` が 1 本、先読み `<script>`（`mock.lang`/`mock.theme`）は無傷
4. `node tools/verify.mjs` PASS（§5 の全項目が CSS ファイルに対して動いている＝FAIL を意図的に起こす確認は不要だが、`ok()` のメッセージ本数が減っていないこと）／`node tools/regress.mjs` 差分 0
5. `file://` で `mock/catalog.html` を開き、light/dark × ja/zh/en で**分割前とピクセル同等**（P2 ホームのスクリーンショット比較）。`mock/index.html` も同様
6. Pages（マージ後）で 404 が出ない（DevTools Network で `css/tokens.css` `css/components.css` が 200）

**reviewer の確認点**：`git diff` で CSS の中身に 1 行も変更が無いこと（`--similarity` で rename 扱いになっていれば理想）／`--ntt-*` の値が動いていないこと／dark ブロックが 1 つのままであること／`index.html` の見た目が変わっていないこと。

### 9-3. PR-B：データ分離

**変更**：`mock/js/data/{ui,catalog,home,style}.js`・`mock/js/data/scenarios/{kn,qa,dc,lg,nm,en,gn,pt}.js` 新規／`catalog.html` の `<script>` からデータ部を削除し `<script src>` 12 本を追加（**アプリ部はインラインのまま**）／`tools/lib/load.mjs` 新規／`verify.mjs` の §1・1-A・1-B・2・3・4・6・9・10 を新ローダーへ／`regress.mjs` を新ローダーへ。

- この中間状態は**そのまま動く**：データの `<script src>` が先、インラインの `<script>` が後なので、インライン側から `T`・`SCENARIOS` が見える。
- verify §7 の対象は**この PR ではまだインライン `<script>`**（`load.mjs` が「`js/**` の非データ JS ＋ catalog.html のインライン `<script>`」を返す形にしておくと PR-C で対象を減らすだけで済む）。

**受け入れ条件**
1. 抽出コマンド再実行で 12 ファイルすべて**差分ゼロ**（ラッパー行とヘッダー以外の追加・削除・並べ替えが無い）
2. **データ同一性**：base と PR で全 10 定数を取り出し、キーを再帰的にソートして正規化した JSON が**完全一致**（`SCENARIOS` はブロックの並び順が変わるためキーソートで比較する。並び順は実行結果に影響しない —— verify §9 も `for…in`、`regress` は `SCENARIOS` を見ない、描画は `SCENARIOS[id]` の参照のみ）
3. `node tools/regress.mjs` **差分 0**、`node tools/verify.mjs` PASS（`SVCS=43` `SCENARIOS 43 件` などの件数表示が分割前と同じ）
4. 検査項目が減っていないこと：verify の出力行（`✅`/`⚠️` の項目）を分割前後で並べて比較し、**新規追加分（1-A / 1-B / 5-A / 8 追加 / 9 追加）以外は同一**
5. わざと壊して落ちることの確認（implementer が PR 本文に結果を貼る）：(a) `catalog.html` から `scenarios/pt.js` のタグを 1 本消す → verify FAIL（1-B③）、(b) `ui.js` の `const T` を `catalog.js` にもう 1 つ足す → verify FAIL（1-A）、(c) タグの順序を入れ替える → verify FAIL（1-B④）。**確認後は必ず元に戻す**
6. `file://` と Pages の両方で全画面が動く。特に **`zh` 表示で文字化けが無い**こと（§12-1）。demo 5 テンプレートの台本が 8 ファイル全分類から引けること（各分類 1 件ずつ、計 8 サービスで「デモを見る」→ 台本 2 往復）

**reviewer の確認点**：`<script src>` の並びが §2-1 と一致／`js/data/**` に `document`・`localStorage`・関数呼び出しが無い（`grep`）／`scenarios/*.js` の id 接頭がファイル名と一致／`regress.baseline.json` が**変更されていない**こと（`--update` 痕跡がないこと）。

### 9-4. PR-C：アプリ分離

**変更**：`mock/js/{app,render,events}.js` 新規／`catalog.html` からインライン `<script>` を削除し `<script src>` 3 本を追加（殻の完成）／`app.js` 冒頭に §2-4 の assert を追加／`verify.mjs` §7 の対象を `js/app.js + js/render.js + js/events.js` に／`docs/handoff/2026-09-07-claude-design-handoff.md` §2 の表を差し替え（§10 の案）／`mock/README.md` のツリー更新。

**受け入れ条件**
1. 抽出コマンド再実行で 3 ファイルが**差分ゼロ**（ヘッダー・`'use strict';`・assert ブロック以外の変更なし）。assert は `app.js` の**先頭にのみ**追加され、既存コードの行は 1 行も動かない
2. `catalog.html` にインライン `<script>` が 0 個（`<script>` はすべて `src` 付き）。`catalog.html` が 100 行未満
3. `node tools/verify.mjs` PASS（§7 の `state` 10 キー・`data-act` 13 種・`detectLang`・`mock.lang`/`mock.theme` がすべて検出されている）／`node tools/regress.mjs` 差分 0
4. assert の動作確認：`catalog.html` から `js/data/ui.js` のタグを一時的に消すと、白画面ではなく**欠落ファイル名が画面に出る**（スクリーンショットを PR 本文に貼る）。確認後は戻す
5. `file://` と Pages で全画面。IME（②③ の検索が `#home-holder` だけ差し替わり日本語変換が壊れない）、デモの「考え中」タイマー、言語切替後の会話復元（`state.log`）を実機で確認
6. `docs/handoff/2026-09-07-claude-design-handoff.md` §2 が新パスに更新されている

**reviewer の確認点**：`state` の形・`view` の 4 値・`data-act` 13 種が 1 つも欠けていない／`demoReplyTimer`・`demoPending`・`demoPendingFreeform` が `app.js` で宣言され `render.js`/`events.js` から代入されている（ファイル跨ぎの `let` 共有が意図どおり）／`events.js` が最後に読み込まれている／`renderAll` が `render.js` にある。

---

## 10. Claude Design 引き渡しメモの更新案（PR-C で適用）

`docs/handoff/2026-09-07-claude-design-handoff.md` §2 の表を次に差し替える。

```
mock/
├── index.html            デモガイド（日／中）。css/tokens.css を <link> で共有（コピーしない）
├── catalog.html          殻。<link> 2 本と <script src> 15 本だけ。ここは基本触らない
├── css/tokens.css        トークン層
├── css/components.css    コンポーネント CSS
├── js/data/…             データ層（触らない。style.js の SVG path だけ可）
├── js/app.js             状態・ヘルパー（触らない）
├── js/render.js          描画（変えてよい）
└── js/events.js          遷移・起動（触らない）
```

| ファイル | 層 | 触ってよいか |
|---|---|---|
| `mock/css/tokens.css`（287 行） | **トークン層**：`--ntt-*` → セマンティック（light）→ `:root[data-theme="dark"]` → `data-lang` 別フォント | セマンティックトークンの**値**は変えてよい。名前は変えない。`--ntt-*` は名前も値も不変。新トークンは light と dark を**同時に**。**dark ブロックは 1 つだけ**（増やすと検査が素通りする）。**`index.html` も同じファイルを見ているので、壊すと 2 画面同時に壊れる** |
| `mock/css/components.css`（674 行、139 クラス） | **コンポーネント CSS** | 自由に変えてよい。色は `var(--…)` のみ、`#RRGGBB` 直値は禁止（verify FAIL） |
| `mock/js/render.js`（665 行） | **描画**：`renderChrome / renderSeg / renderSidebar / cardHTML / gridHTML / todoHTML / bindHomeSearch / dashSectionsHTML / renderDash / feedItemHTML / feedSectionsHTML / renderFeed / panelHTML / resultHTML / chipsHTML / renderMain / addMsg / showTyping / renderAll` | マークアップ・クラス名は変えてよい。**`data-act` / `data-arg` / `id="search" #msgs #chat-input #home-holder` は残す**。`bindHomeSearch` の IME 対策（`renderMain()` を呼ばず `#home-holder` だけ差し替える）も残す |
| `mock/js/data/style.js`（19 行） | **分類アイコン**（`CAT_STYLE` の SVG path） | 差し替え可。色は CSS の `--cat-*` 側 |
| `mock/js/data/{ui,catalog,home}.js` ＋ `js/data/scenarios/*.js` | **データ層** | **触らない** |
| `mock/js/app.js`・`mock/js/events.js` | **状態と遷移**：`state`・`data-act` ハンドラ・`detectLang`・localStorage | **触らない** |
| `mock/catalog.html` | 殻 | `<link>`/`<script src>` の並びを変えない。body のマークアップは `renderSidebar`/`renderMain` が差し込む器なので基本触らない |

あわせて §2 冒頭の「`catalog.html` 本体。1 ファイル完結（約 520 KB）」の記述と、Pages 確認手順に「**初回は強制リロード（Cmd/Ctrl+Shift+R）**」を追記する。

---

## 11. 影響を受ける手順

- **reviewer の Playwright**：`file://.../mock/catalog.html` を開く手順は**そのまま**。古典的スクリプトは `file://` から相対パスで読める（module だけが CORS で拒否される。だから `type="module"` にしない）。ローカルサーバを使う場合は **`mock/` をルートにして** 配信すること（`python3 -m http.server` を repo ルートで実行すると `/mock/…` になり、Pages と URL 構造がずれる）。
- **implementer の並列ルール（CLAUDE.md §5）が細かくなる**：これまで「`catalog.html` を触るお題はすべて直列」だったのが、
  - 台本追加（`js/data/scenarios/<分類>.js`）× デザイン（`css/components.css` + `js/render.js`）× 文言（`js/data/ui.js`）は**並列可**
  - **新サービス追加は `js/data/catalog.js` + `js/data/scenarios/<分類>.js` の 2 ファイル**（`catalog.html` は触らない）
  - 直列が必要なのは同じファイルを触るとき（例：デザイン 2 本立てで両方 `components.css`）
- **PM のレビュー**：GitHub 上の差分が層ごとに分かれるので、「データだけの PR」「見た目だけの PR」が一目で分かる。
- **`tools/regress.baseline.json` は不変**。この Issue の 3 PR で 1 度も `--update` しない。

---

## 12. リスクと対策

| # | リスク | 対策・検出 |
|---|---|---|
| 12-1 | **文字化け**：`.js` の文字コードが UTF-8 と解釈されない（日本語・中国語の台本が全滅） | ファイルは **BOM なし UTF-8**。`catalog.html` の `<meta charset="UTF-8">` は古典的スクリプトのエンコーディングのフォールバックとして効き、Pages は `.js` を `charset=utf-8` 付きで返す。**PR-B の受け入れ条件に「`file://` と Pages の両方で zh 表示・中国語台本の文字化けが無いこと」を入れる**（Playwright で既知の中国語文字列の存在を確認） |
| 12-2 | **二重宣言**で後続ファイルが丸ごと死ぬ（`const T` が 2 か所） | verify 検査 1-A（全 JS 連結 `node --check`）。PR-B の受け入れ条件 5-(b) で実際に落ちることを確認 |
| 12-3 | **パス間違い**で `file://` だけ、または Pages だけ壊れる | verify 検査 1-B②（相対パスのみ）。両方で開くのが各 PR の受け入れ条件 |
| 12-4 | **台本ファイルを作ったのに `<script>` タグに書き忘れ** → verify は PASS するのに画面から台本が消える | verify 検査 1-B③（タグ集合＝ディレクトリの `*.js` 集合） |
| 12-5 | **CSS/JS の古いキャッシュ**と新しい HTML の組み合わせ | §7（P2 は強制リロード運用、P3 でハッシュ検証） |
| 12-6 | 分割の途中でデータが 1 文字ずれる | §9-1 の抽出コマンド再実行 diff ＋ PR-B 受け入れ条件 2 の正規化 JSON 比較 ＋ `regress` 差分 0 の三重 |
| 12-7 | #74（NEW 表示）とのコンフリクト | **#74 のマージを待ってから着手**。行番号ではなくマーカーで切る（§9-1） |
| 12-8 | Jekyll がディレクトリを落とす | `mock/.nojekyll` を残す（既存）＋ verify §8 追加検査（`_` 始まりディレクトリ禁止） |

---

## 13. PM 判断待ち（推奨つき）

| # | 論点 | 選択肢 | **推奨** |
|---|---|---|---|
| 10-1 | `scenarios/` の粒度 | (a) 大分類 8 ファイル / (b) 1 サービス 1 ファイル 43 個 | **(a) 8 ファイル**。理由：サービス追加で殻（`catalog.html`）を触らずに済む（43 個だと追加のたびに `<script>` タグを増やす＝共有ファイルの編集が戻ってくる）／中国からの回線でリクエスト数を増やさない／同一分類の別サービスは行が離れるので git が自動マージする／台本作業は 1 分類単位で割り当てる。**後から (b) に移行しても読み込み契約は変わらない** |
| 10-2 | `?v=` キャッシュスタンプ | (a) 付けない（P3 で機械検証つき） / (b) `?v=<日付>` を手で更新 / (c) P2 でハッシュ＋verify 検証 | **(a)**。手書きの `?v=` は更新忘れで信用を失う。P2 は「Pages 確認は初回だけ強制リロード」で運用し、P3 で `tools/stamp.mjs` ＋ verify 検証としてまとめて入れる |
| 10-3 | `tools/bundle.mjs` | (a) 作らない / (b) P2 で作る | **(a)**。`file://` で動くのでフォルダ zip で足りる。必要になったら P3（条件は §8） |
| 10-4 | アプリ層を 3 分割するか | (a) `app.js`/`render.js`/`events.js` / (b) `app.js` 1 本（PM 案） | **(a)**。切れ目が既にコメントで存在し追加コストがゼロで、引き渡しメモの「触ってよい／いけない」の境界がファイル境界と一致する（Claude Design は `render.js` だけ開けばよい）。(b) を選んでも読み込み契約は同じで、後から分割できる |
| 10-5 | `.claude/agents/*.md` の更新 | architect は触れない。`architect.md` は `mock/catalog.html` を名指し、`commands/feature.md` は「`mock/catalog.html` の同じ関数を触るお題は直列」と書いている | **PM が PR-C 後に更新**を推奨（`mock/**` への言い換えと、並列判定を「同じ**ファイル**なら直列」に）。実害は小さいので後追いで可 |
| 10-6 | 実施タイミング | #74 マージ後・Claude Design の次の戻りの前 | **その通り**。デザインの戻りが `catalog.html` の巨大 diff で来ると分割とコンフリクトする。**PM から Claude Design に「次の戻りは分割後の `css/components.css` + `js/render.js` に対して出してほしい」と先に伝える**のが望ましい（既に作業中なら、分割を待たずに先にデザイン PR をマージしてから P2 を始める） |
| 10-7 | `CLAUDE.md` §2 の書き換え（§6 の表） | load-bearing の記述を PM が更新 | **PR-C マージ直後に PM が適用**。§2-2 の「1 つ目／2 つ目の `<style>`」はファイル名に置き換わるので、この更新をしないと以後のエージェントが古い前提で動く（この設計の中で**唯一 load-bearing の文言を変える提案**なので、PM 承認が必要） |
