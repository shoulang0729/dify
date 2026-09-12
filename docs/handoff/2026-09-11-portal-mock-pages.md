# 社内ポータル概念モックの取り込みと Pages 公開

- 日付: 2026-09-11
- レーン: **M/L**（データ層・多言語辞書・トークン・Pages 設定に触る）
- 種別: 設計書（architect）。実装は implementer、マージ判定は reviewer
- **版：rev2（2026-09-11）。**§4-4 の式・§4-5 の件数・§5-7 の `pscn()`・AC-16・AC-24・§13 Q4/Q6・付録 B は
  **§14（末尾）で改訂された**。読むときは §14 を正とする
- **2026-09-12：rev4 が出た。**§14 の**規則 1・規則 2 は撤回**（§16 → `docs/handoff/2026-09-12-portal-industry-rev4.md`）
- 関連: `CLAUDE.md` §2-1〜§2-13 / `docs/handoff/2026-09-07-split-catalog.md`（層分けの作法）/
  `docs/handoff/2026-09-08-finance-catalog.md`（業種 2 段構造）/ `docs/handoff/2026-09-08-live-links.md`（§14 の節番号）

---

## 0. 決定事項の要約

| # | 決めたこと |
|---|---|
| D1 | ポータルは **`mock/portal.html`** として dify リポの `mock/` に入れる。Pages の同じサイトの 2 枚目のページになる（URL は `https://shoulang0729.github.io/dify/portal.html`） |
| D2 | 185KB の単一 HTML を **データ（`js/data/portal/*.js` 7 本）／状態とヘルパー（`js/portal/app.js`）／描画（`js/portal/render.js`・`demo.js`）／イベント（`js/portal/events.js`）** に分ける。`catalog.html` と同じ作法。`type="module"` にしない |
| D3 | CSS は **`css/tokens.css` を `<link>` で共有**し、ポータル固有は **`css/portal.css`**。`components.css` は読み込まない（クラス名の名前空間を分ける） |
| D4 | ポータルのインライン token ブロックは捨て、そこにしか無かった **22 個のセマンティックトークンを `tokens.css` に足す**（`--ntt-*` は 1 バイトも触らない。dark ブロックは 1 つのまま） |
| D5 | ポータルが自前で持っていた **カタログ 67 件のコピー（`CAT` / `CATN`）を削除**し、`js/data/catalog.js` の `CATS` / `SVCS` をそのまま読む |
| D6 | **サービス → 画面の対応表は `SVCS[].place`（カタログのデータ層）に置く**。値は画面 id ／ `'*'` ／ `'out'` ／ キー無し（未配置）。`regress.mjs` のスナップショットにも足す（基準更新は 1 回だけ） |
| D7 | **`out` の理由文と、案件ステージ単位の割り付けはポータル側に残す**。カタログが持つのは「どの画面か」という事実だけ |
| D8 | **台本はポータル内で再生する。共有するのはデータ（`SCENARIOS` / `TEMPLATES`）だけで、描画はポータルの `js/portal/demo.js`** が持つ |
| D9 | 台本の見せ方は **右ドロワー（`min(560px, 96vw)`）**。カタログの `demo` 画面（`#main` を占有する 2 ペイン）とは別レイアウト。**行の文脈が入力の先頭に自動で入り、結果はドロワーの中に返る**。閉じても消えない証拠として行に 1 行の戻りを残す（PR-4） |
| D10 | `SCENARIOS[業種][id]` の解決は **`[ポータルの業種, ...INDUSTRIES の id]` の順で最初に見つかったもの**。`SCENARIOS.it` が無ければ `mfg` → `fin` に落ちる。IT 業が足されても**ポータル側は 1 行も直さない** |
| D11 | **`localStorage` は既存の `mock.lang` / `mock.theme` だけを読み書きする。4 つ目のキーは作らない**。`mock.fav` は触らない |
| D12 | **多言語は「ラベル辞書 `PT` は ja/zh/en 完全一致」まで**。画面本文の解説散文は v1 では日本語のまま（`{ja:…}` の形にしない＝半端な 3 言語オブジェクトを作らない）。ここは PM 判断（§13 Q1） |
| D13 | `tools/verify.mjs` に **§17（ポータル契約）** を足す。§13 は #121 W2 予約・§14 は #124・§15 は #121 W4-1・§16 は #205 が既に使っているため §17 が最初の空き |
| D14 | PR は **4 本**（層分け取り込み／`place` のカタログ移設／台本の実行／行への戻りと AI サービス画面）。**PR-1 のマージ時点で Pages にポータル 15 画面が出る** |

---

## 1. 目的

1. PM が 30 件近いコメントで作り込んだ社内ポータルの概念モック（15 画面）を、**レビューできる場所（GitHub Pages）に置く**。
2. AI エージェントカタログと**同じデータ層を共有**し、カタログ 67 件のコピーを消す。カタログに 1 行足せばポータルの画面にボタンが増える状態にする。
3. **業務の画面の中から AI を呼ぶと、行の文脈が渡り、結果がその画面に返る**——という体験を、実装（NocoBase）を待たずに見せられるようにする。

このお題は「Pages に載せる概念モック」であり、NocoBase の実装ではない。

---

## 2. 範囲

### 2-1. 変更する範囲

| ファイル | 何をするか | どの PR |
|---|---|---|
| `mock/portal.html`（新規） | 殻だけ。`<link>` 2 本＋`<script src>` 30 本。`<style>` 0 個・インライン `<script>` 0 個 | PR-1 |
| `mock/css/portal.css`（新規） | ポータル固有のコンポーネント CSS。色の直値ゼロ | PR-1 |
| `mock/js/data/portal/*.js`（新規 7 本） | ポータル固有の架空データと辞書。純粋なリテラル宣言のみ | PR-1 |
| `mock/js/portal/*.js`（新規 4 本） | 状態・ヘルパー・描画・イベント | PR-1 / PR-3 |
| `mock/css/tokens.css` | **セマンティック層に 22 トークン追加**（light と dark の両方）。`--ntt-*` は触らない | PR-1 |
| `mock/index.html` | デモガイドにポータルのカードを 1 枚足す（既存の ja/zh 2 言語の作法に合わせる） | PR-1 |
| `mock/README.md` | 収録モックの表に 1 行、ディレクトリ構成に 2 ブロック | PR-1 |
| `mock/js/data/catalog.js` | **`SVCS` の各要素に `place` を 1 語足す**。他の行は触らない | PR-2 |
| `tools/verify.mjs` | §17 を足す。既存 §1〜§16 は触らない | PR-1 / PR-2 |
| `tools/lib/load.mjs` | `loadPortal(ROOT)` を追加。`loadMock()` は 1 バイトも変えない | PR-1 |
| `tools/regress.mjs` | スナップショットの `svcs` に `place` を足す | PR-2 |
| `tools/regress.baseline.json` | `--update` を 1 回（PR-2 の本文に理由を書く） | PR-2 |
| `docs/handoff/service-index.md` | 触らない（管理番号は増減しない） | — |

### 2-2. 触らない範囲（明示）

**1 バイトも触らない：**

- `mock/catalog.html`
- `mock/js/app.js` / `mock/js/render.js` / `mock/js/events.js`
- `mock/css/components.css`
- `mock/js/data/ui.js` / `home.js` / `style.js` / `live.js`
- `mock/js/data/scenarios/**`（**読むだけ**。台本の値は 1 文字も変えない）
- `mock/scripts.html`
- `.github/workflows/**`（`pages.yml` は `path: mock` のままで、ポータルも自動的に公開される）
- `data/world/**`（§13 Q4 参照）
- `dify/**` / `scripts/**` / `docs/demo/**` / `docs/dify/**`
- `tools/check-world.mjs` / `tools/gen-index.mjs` / `docs/service-map.md`
- `CLAUDE.md`・`.claude/**`（改定の**提案**は §8-3 に書く。PM 承認後に別 PR）

**他の architect が並行しているため触らない：**
`docs/handoff/2026-09-10-portal-nocobase.md` / `2026-09-11-nocobase-research.md` / `portal-nocobase.issue.md` /
`2026-09-11-it-industry.md` / `it-industry.issue.md` / `2026-09-11-repo-layout-v3.md`

### 2-3. 並行している設計との関係

| 並行中の設計 | この設計との関係 |
|---|---|
| **カタログに IT 業を足す**（`docs/it-industry`。14 分類 33 中分類 77 サービス・PR 6 本） | **待たない。**ポータルは `SVCS` / `CATS` / `INDUSTRIES` / `SCENARIOS` を実行時に数えるので、IT が入れば自動で追随する（§5-7）。**衝突するのは `mock/js/data/catalog.js` の 1 ファイルだけ**で、こちらは PR-2 で `place` の 1 語を足すのみ。**IT の PR を先にマージし、PR-2 をそのあとに回す**のが安全。IT で増える 21 件は `place` を持たないので verify §17-c が warn を出し、AI サービス画面に「置き場所を決めていない 21 件」として出る（そういう設計にしてある） |
| **リポジトリ構成 v3**（`docs/handoff/2026-09-11-repo-layout-v3.md`） | **待たない。**モックが `mock/` に置かれることは v3 のどの案でも変わらない。ただし `tools/regress.mjs` の `counts` の形が変わる作業が含まれるので §9-3 の注意を参照 |
| **社内ポータル（NocoBase）の実装設計**（`docs/handoff/2026-09-10-portal-nocobase.md` ほか） | **別物。**この設計は「Pages に載せる概念モック」で、NocoBase の実装ではない。ポータルの `.mockbar` に「NocoBase の実装ではありません」と書いてあるとおり。ドロワーの「置き方」（`btn` / `embed` / `flow`）の説明文は NocoBase 側の調査結果を写したものなので、**調査結果が変われば `PHOWLONG` を直す**（`js/data/portal/ui.js` の 3 行だけ） |

**`mock/js/data/catalog.js` について：** PR-2 でだけ触る。触ってよいのは **`SVCS` の各要素に `place: '…'` を足すこと**だけ。
`id` / `cat` / `sub` / `st` / `industries` / `tags` / `name` / `desc` / `added` と `CATS` は 1 バイトも変えない
（§2-9・§2-11。`regress.mjs` がこれを機械で見る）。

---

## 3. ファイル構成と層分け

### 3-1. 置き場所

```
mock/
├── index.html               デモガイド（カタログ＋ポータルの 2 枚のカード）
├── catalog.html             AI エージェントカタログ（触らない）
├── portal.html              ★ 部門ポータル（新規。殻だけ）
├── css/
│   ├── tokens.css           ★ セマンティック層に 22 トークン追加。両ページが <link> で共有
│   ├── components.css       カタログ用（触らない）
│   └── portal.css           ★ ポータル用（新規）
└── js/
    ├── data/                ← 両ページが共有するデータ層。純粋なリテラル宣言のみ（§2-3）
    │   ├── ui.js            T / PATTERNS / TAGS / TEMPLATES     （両ページが読む）
    │   ├── catalog.js       CATS / SVCS                          （両ページが読む。PR-2 で place 追加）
    │   ├── home.js          HOME / FEED                          （カタログのみ）
    │   ├── style.js         CAT_STYLE                            （両ページが読む）
    │   ├── live.js          LIVE                                 （カタログのみ。§3-4 参照）
    │   ├── scenarios/       SCENARIOS                            （両ページが読む）
    │   └── portal/          ★ ポータル固有のデータ（新規 7 本）
    │       ├── ui.js        PT（3 言語ラベル）/ PSCREENS / PGRP / PHOW / PST
    │       ├── svc.js       PSVC / POUT / PNEW / PSTAGE_AI / PCTXDEF
    │       ├── org.js       PORG（会社・部門・要員・顧客・協力会社）
    │       ├── front.js     PDEALS / PCUST / PCONTACT / PHIST / PNEWS / PVENDOR
    │       ├── common.js    PACT / PCAND / PMEET / PKNOW / PKNOWACT
    │       ├── mgmt.js      PKPI / PKPITOPIC / PGOAL / PPEOPLE / PATT / PQTR
    │       └── back.js      PEXP / PREQ / PTRAIN / PSURVEY / PMYITEM
    ├── app.js / render.js / events.js     カタログのアプリ層（触らない）
    └── portal/              ★ ポータルのアプリ層（新規 4 本）
        ├── app.js           pstate / ヘルパー（PL() / pt() / psvcOf() / pscn() / pscriptLang()）
        ├── render.js        renderRail / renderScreen / V.*（15 画面）
        ├── demo.js          実行ドロワー（台本の描画。PR-3）
        └── events.js        click ハンドラ / 言語・テーマの listener / 起動
```

### 3-2. `portal.html` の `<script src>` 順（**この並びが唯一の正**）

```
js/data/ui.js
js/data/catalog.js
js/data/style.js
js/data/scenarios/mfg/kn.js … pt.js … eg.js      （10 本）
js/data/scenarios/fin/kn.js … eg.js              （8 本）
js/data/portal/ui.js
js/data/portal/svc.js
js/data/portal/org.js
js/data/portal/front.js
js/data/portal/common.js
js/data/portal/mgmt.js
js/data/portal/back.js
js/portal/app.js
js/portal/render.js
js/portal/demo.js
js/portal/events.js
```

- 合計 **3 ＋ 18 ＋ 7 ＋ 4 = 32 本**（台本ファイルが増減すれば自動で変わる。§9-1 の検査は実ディレクトリから期待値を計算する）
- `home.js`（`HOME`/`FEED`）と `live.js`（`LIVE`）は**読み込まない**。ポータルが使わないため
  （`LIVE` は 2026-09-11 時点で空。中身が入ったら PR-5 で足す。§13 Q5）
- `type="module"` にしない（古典的スクリプトのまま＝`file://` で開ける）
- **インライン `<script>` 0 個・`<style>` 0 個**

### 3-3. `portal.html` の殻

いまのモックは `<!DOCTYPE>` も `<html>` も `<head>` も無い断片で始まっている。`tokens.css` の
`:root[data-theme="dark"]` と `:root[data-lang="…"]` を効かせるために、`catalog.html` と同じ殻を付ける。

```html
<!DOCTYPE html>
<html lang="ja" data-theme="light" data-lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>部門ポータル ／ 部门门户 ／ Department Portal</title>
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/portal.css">
</head>
<body>
  <div class="mockbar"> … （そのまま移設） </div>
  <div class="shell">
    <aside class="rail"> … </aside>
    <div class="main"><header class="topbar"> … </header><div class="canvas" id="canvas"></div></div>
  </div>
  <!-- script src ×32 -->
</body>
</html>
```

- `<link>` は **`tokens.css` → `portal.css`** の 2 本。相対パスのみ（先頭 `/`・`../` 禁止）
- `data-lang` を `<html>` に付けることで、`tokens.css` の `:root[data-lang="ja|zh|en"] { --font-ui: … }` が効く。
  **`portal.css` の `body` は `var(--font-jp)` ではなく `var(--font-ui)` を使う**（言語に合わせたフォント切替が無料で付く。いまのモックには無い改善）

### 3-4. `portal.css`

- いまのインライン `<style>`（462 行）のうち、**先頭のトークン定義ブロック（1〜170 行相当）は丸ごと捨てる**。`tokens.css` の `<link>` に置き換える
- 残り（`.mockbar` 以降のコンポーネント）を `portal.css` に移す
- **色の直値（`#RRGGBB` / `#RGB`）を 1 つも残さない。** いまあるのは 6 箇所だけ：

| いまの行 | 直したあと |
|---|---|
| `.rail { … color: #C3CDD6; }` | `color: var(--text-on-rail);` |
| `.brand .mark { … color: #fff; }` | `color: var(--text-on-rail-strong);` |
| `.brand b { … color: #fff; }` | `color: var(--text-on-rail-strong);` |
| `.navbtn { … color: #C3CDD6; }` | `color: var(--text-on-rail);` |
| `.navbtn:hover { background: rgba(255,255,255,.06); color: #fff; }` | `background: var(--surface-rail-hover); color: var(--text-on-rail-strong);` |
| `.navbtn[aria-current="page"] { background: rgba(46,144,255,.16); … color: #fff; }` | `background: var(--surface-rail-selected); … color: var(--text-on-rail-strong);` |

- `rgba(…)` は直値検査の対象外だが、rail の 2 つは意味のあるトークンなので `tokens.css` に上げる
- **`.nm2` の回避策を解消する。** いま `.aibtn` の分類色は CSS クラス名（`.kn` / `.dc` / …）で渡していて、
  分類 `nm` が `.aibtn .nm`（サービス名の span）と衝突するため `nm2` という偽の分類 id を作っている。
  **分類色はインライン custom property で渡す**：`<button class="aibtn" style="--cat-accent:var(--cat-kn)">`。
  `.aibtn .no { color: var(--cat-accent, var(--action-primary)); }` は既にフォールバック付きなので、
  未定義の分類（IT 業で `--cat-xx` がまだ無い場合など）でも壊れない

### 3-5. 3 層の見分け（`classifyBlocks()`）

いまは **見出しの文字列一致（`AI_HEADS`）と本文の正規表現（`DEVRE`）でブロックを 3 層に分類**している。
これは日本語の見出しが前提で、§7 で見出しを 3 言語化すると壊れる。

- **PR-1：描画時に `blk-ai` を明示的に付ける**（`<section class="block blk-ai">`）。`classifyBlocks()` は
  「既に `blk-ai` / `doc-dev` / `doc-user` が付いていれば尊重し、無いものだけ従来どおり推測する」に変える
- **PR-1 の受け入れ条件に「3 層の色分けが移設の前後で 1 ブロックも変わらないこと」を入れる**（§12-1 AC-8）
- `DEVRE`（開発メモ／使い方の振り分け）の明示化は**この設計の範囲外**（§7 の見出し 3 言語化と同じ PR で扱う。§13 Q1）

---

## 4. データを二重に持たない

### 4-1. 消すもの

| いまの定数 | どうするか |
|---|---|
| `CAT`（67 行のカタログのコピー） | **削除**。`SVCS`（`js/data/catalog.js`）を読む |
| `CATN`（13 分類名のコピー・日本語のみ） | **削除**。`CATS`（3 言語）を読む |
| `catOf(no)` / `CATC` | 削除。`SVCS` / `CATS` から引く |
| `svcOf(no)` の `CAT` フォールバック | `SVCS` から引く。`name` は `PL(x.name)` で 3 言語 |
| `PLACE`（67 件の対応表） | **`SVCS[].place` に移す**（§4-3） |

これにより、**カタログにサービスが 1 件増えると、ポータルの AI サービス画面の件数と内訳がその場で変わる**。
IT 業 21 件が入った日に、ポータルは 1 行も直さずに 77 件を数える。

### 4-2. ポータル固有として新しく持つもの

`js/data/portal/` の 7 ファイル（§3-1）。**純粋なリテラル宣言のみ**（`document`・`localStorage`・関数呼び出しを書かない。
`loadPortal()` が `node:vm` で実行して読むため）。いまのモックの `V.*` の中にベタ書きされている数字と表は、
すべてここへ引き上げる。

いまのモックからの移設対応：

| いまの定数 | 行き先 | 新しい名前 |
|---|---|---|
| `L` | `portal/ui.js` | **`PT`**（`L(obj)` はカタログのヘルパー名と紛らわしいため改名） |
| `SCREENS` | `portal/ui.js` | `PSCREENS`。**`ai:[…]` の手書きリストは削除**（§4-4） |
| `SCRNAME` | 削除 | `PT` から引く |
| `HOW` / `HOWLONG` / `ST` | `portal/ui.js` | `PHOW` / `PHOWLONG` / `PST` |
| `SVC`（サービス別の `short`/`how`/`ctx`/`out`/`why`） | `portal/svc.js` | `PSVC` |
| `PLACE` の `out` 理由（18 件） | `portal/svc.js` | `POUT` |
| `'NEW1'`（未採番の追加候補） | `portal/svc.js` | `PNEW` |
| `STAGE_AI` | `portal/svc.js` | `PSTAGE_AI` |
| `TEAM`・社名・拠点・ペルソナ | `portal/org.js` | `PORG` |
| `STAGE` / `DEALS` / `CONTACT` / `HIST` / `NEWS` / `VENDOR` | `portal/front.js` | `PSTAGE` / `PDEALS` / … |
| `ACT` / `CAND` / `MEET` / `KNOW_CORP` / `KNOW_DEPT` / `KNOWACT` | `portal/common.js` | `PACT` / `PCAND` / … |
| `PEOPLE` / `ATT` / `PKPI` / `KPI_TOPICS` / `PKPI_TOPICS` / `MYGOAL` / `TEAMGOAL` / `QTR` / `SRC` / `CUR_Q` | `portal/mgmt.js` | `PPEOPLE` / … |
| `EXPENSE` / `REQUEST` / `TRAIN` / `MYTRAIN` / `MYITEM` / `SURVEY` / `MYSURVEY` / `TODO_STATE` | `portal/back.js` | `PEXP` / … |
| `PIPE_TOTAL` / `PIPE_W` / `BACKLOG` / `sum` / `inPre` / `dealVal` など**計算するもの** | `js/portal/app.js` | そのまま（**データ層に置かない**。§2-3） |

> `candSeq`（採用時に採番するカウンタ）のような**書き換わる値は `js/portal/app.js` の `pstate` に置く**。
> `js/data/portal/**` に `let` の可変カウンタを置かない。

### 4-3. `PLACE` をどこに持つか —— **`SVCS[].place`（カタログのデータ層）**

**決定：`mock/js/data/catalog.js` の `SVCS` の各要素に `place` を足す。**

```js
{ id: 'dc8', cat: 'dc', sub: 'report', st: 2, industries: ['mfg','fin'], tags: [...],
  place: 'proj',                                   // ← 追加するのはこの 1 語だけ
  name: { … }, desc: { … } },
```

**値域**

| 値 | 意味 |
|---|---|
| `PSCREENS` の画面 id（`cust` `proj` `act` `ppl` `trn` `meet` `know` `kpi` `exp` `req` `watch` `vend`） | その画面の「この画面の AI」ブロックに出る |
| `'*'` | どの画面からでも呼ぶ。**ホームの「横断で使う AI」ブロックにだけ出す**（全画面に重複表示しない） |
| `'out'` | ポータルには置かない（顧客自身の業務・管理部の業務） |
| **キーが無い** | **未配置＝置き場所を決めていない。**verify §17 が warn、AI サービス画面が件数で出す |

**そう決めた理由**

1. PM の方針（「バッジもポータル配置も同じ 1 か所から決める」）そのもの。バッジ（ポータルから使える／カタログのみ）は
   `place != null && place !== 'out'` で決まる。判定が 2 か所に散らない
2. **`regress.mjs` の基準は `place` を足しただけでは 1 文字も変わらない。** スナップショットの `svcs` は
   `{id, cat, sub, st, industries, tags}` しか取っていない（`tools/regress.mjs` L40 を確認済み）。
   ただし**それでは配置の取り違えを機械で守れない**ので、**PR-2 で `place` をスナップショットに足し、
   `--update` を 1 回だけ行う**。以後、配置を勝手に変えると regress が FAIL する
3. **キー無しを許すことで、並行中の IT 業 21 件の PR が壊れない。** `place` 必須にすると、IT の PR が
   ポータルを知らずに書いた瞬間 FAIL する。未配置は **warn**（verify §17-c）とし、
   ポータルの AI サービス画面に「置き場所を決めていない N 件」として出す。
   これは PM がモックに書いた
   「カタログにサービスが増えたときここが 0 でなくなり、それが『置き場所を決めていない』の合図になります」
   と同じ仕掛け
4. `SVCS[].id`（管理番号）は顧客に見える不変の値（§2-11）。`place` はその 1 列なので、
   顧客版への差し替え（§2-9）でも id と同じ扱いで移動していける

**ポータル側に残すもの（カタログのデータ層に入れないもの）**

| もの | どこ | 理由 |
|---|---|---|
| `'out'` の理由文（18 件・日本語） | `portal/svc.js` の `POUT` | ポータルの解説レイヤーの文。顧客向けカタログには出さない文言をカタログのデータ層に入れない |
| 案件ステージ単位の割り付け（`PSTAGE_AI`） | `portal/svc.js` | ステージは「案件画面の中のどこか」＝画面より 1 段細かい。カタログは「どの画面か」までを持ち、画面の中のどこに出るかは画面の持ち物。PM の意向（「どのステージに出るか」も列で）との差分は §13 Q3 |
| `ctx` / `out` / `why` / `how` / `short`（サービス別の説明） | `portal/svc.js` の `PSVC` | ポータルに置いたときだけの説明。カタログの `desc` と役割が違う |

**カタログ側の表示：** `place` を**カタログの画面には出さない**（バッジを出さない）。
PM がモックに「顧客に見せるときはバッジを出しません——ポータルに埋め込んだときだけ出す形を提案します。ここは PM 判断です」
と書いた通り、v1 は**出さない**（§13 Q2）。`place` はデータとしてだけ存在し、ポータルだけが読む。

### 4-4. 「この画面の AI」ブロックは `place` から自動生成する

> **⚠️ rev1。この節の式は §14-2 で改訂された（業種フィルタを削除）。式は §14-2 を正とする。**

いまの `SCREENS[].ai` は 2〜4 件の手書きリスト。**削除し、`place` から作る。**

```
その画面の AI = SVCS.filter(s => s.place === 画面id && s.industries に ポータルの業種 が含まれる)
              並び順: st 昇順（提供中 → 試行版 → 構想） → 管理番号昇順
ホームだけ追加で: SVCS.filter(s => s.place === '*')  を「横断で使う AI」ブロックに
```

これで **`place: 'proj'` を 1 行足すと案件画面にボタンが 1 つ増える**（画面側は直さない）。
件数の多い画面（`exp` 7 件・`proj` 6 件・`watch` 6 件）は `st:1` が先頭に来る。

`PNEW`（未採番の追加候補。いまは `NEW1` 名刺 OCR の 1 件）は `place` を持てないので、
`PSCREENS[].newai: ['NEW1']` として手書きで持ち、**「提案」の印を付けて末尾に並べる**。
カタログに採番された時点で `PNEW` から消し、`SVCS` に `place` 付きで足す
（IT 業の設計と接続する箇所。§13 Q6）。

### 4-5. 変更前後の件数と id 一覧（§2-9）

> **⚠️ rev1（67 サービス時点）。IT 業のマージ（#255〜#259）で 77 サービスになり、件数は §14-8 の表に更新された。**

**件数は変わらない。**

| | 変更前 | 変更後 |
|---|---|---|
| `INDUSTRIES` | 2（`mfg` `fin`） | 2（変更なし） |
| `CATS` | 13 | 13（変更なし） |
| `CATS[].subs` 合計 | 29 | 29（変更なし） |
| `SVCS` | 67 | 67（変更なし） |
| `TAGS` | 57 | 57（変更なし） |
| `T` のキー | 91 | 91（変更なし） |
| `SVCS[].place` を持つ要素 | 0 | **67**（新しい列） |

**id 一覧は 1 件も増減しない。**`SVCS` の並び順も変えない。追加するのは `place` のキーだけ。
`place` の内訳（管理番号。付録 A に画面別の全一覧）：

| `place` | 件数 | 管理番号 |
|---|---|---|
| `cust` | 1 | CV-02 |
| `proj` | 6 | CV-01 DC-01 DC-08 DC-09 EG-01 NM-01 |
| `act` | 2 | GN-06 LG-04 |
| `ppl` | 3 | PO-04 PT-04 PT-05 |
| `trn` | 5 | DC-03 PO-01 PO-02 PO-03 PT-08 |
| `meet` | 3 | DC-02 GN-04 GN-07 |
| `know` | 4 | KN-03 KN-04 LG-02 LG-03 |
| `kpi` | 3 | NM-03 NM-05 RS-05 |
| `exp` | 7 | FA-01 FA-02 FA-03 FA-04 FA-05 GN-01 GN-02 |
| `req` | 2 | DC-05 DC-07 |
| `watch` | 6 | PT-02 PT-03 RS-01 RS-02 RS-03 RS-04 |
| `vend` | 5 | GN-03 NM-02 PT-01 PT-06 PT-07 |
| `'*'` | 2 | GN-05 LG-01 |
| **ポータルに置く小計** | **49** | |
| `'out'` | 18 | CV-03 CV-04 DC-04 DC-06 EN-01 EN-02 EN-03 KN-01 KN-02 KN-05 KN-06 KN-07 KN-08 NM-04 QA-01 QA-02 QA-03 QA-04 |
| **合計** | **67** | |

> 検算：49 ＋ 18 ＝ 67。`SVCS` 全件に `place` が付き、キー無し（未配置）は 0 件。
> 置く 49 件の成熟度内訳は **提供中 9 ／ 試行版 19 ／ 構想 21**
> （カタログ全体の提供中は 12 件で、うち 3 件 KN-01・KN-02・DC-04 は `'out'`）。
> 業種内訳は **製造のみ 26 ／ 金融のみ 13 ／ 両業種 10**。

---

## 5. 台本の動かし方（★この設計の本体）

### 5-1. 何を共有し、何をポータルが持つか

| | 置き場 | 誰が読むか |
|---|---|---|
| **台本のデータ** `SCENARIOS[業種][id]`（`template` / `persona` / `steps` / `input` / `result` / `script`） | `mock/js/data/scenarios/**`（**触らない**） | カタログとポータルの両方 |
| **テンプレート辞書** `TEMPLATES`（5 種の名称・説明・3 言語） | `mock/js/data/ui.js`（**触らない**） | 両方 |
| **台本の描画** | カタログ＝`mock/js/render.js` ／ ポータル＝**`mock/js/portal/demo.js`** | それぞれ自分の分だけ |

### 5-2. `CLAUDE.md` §2-3 との関係（reviewer 向けの整理）

> §2-3 の「描画は `mock/js/render.js`」「読み込み順は `catalog.html` の `<script src>` の並びが唯一の正」は、
> **`catalog.html` というアプリの中の契約**である。§2-3 の見出しは「共通レイヤーの契約（パターンを増やすときの土台）」で、
> ここでいう「パターン」は ①ナビ ②ダッシュボード ③業務フィードという**カタログの表示パターン**を指す。
>
> ポータルは**カタログの 4 つ目のパターンではなく、同じデータ層を読む 2 本目のアプリ**である。したがって
> ポータルが `js/portal/render.js` を持つことは §2-3 違反ではない。§2-3 のうち**ポータルにも効く部分は次の 3 つ**で、
> 設計はこれを全部満たしている：
>
> 1. **`mock/js/data/**` は純粋なリテラル宣言のみ**（`document`・`localStorage`・関数呼び出しを書かない）
>    → `js/data/portal/**` も同じ。`loadPortal()` が `node:vm` で実行して読む（§9-1）
> 2. **読み込み順はその HTML の `<script src>` の並びが唯一の正**
>    → ポータルは `portal.html` の並びが正。verify §17-a が実ディレクトリから期待値を計算して照合する
> 3. **表示レイヤーは `state` を読んで描くだけ。表示側の都合でデータの形を変えない**
>    → ポータルは `SCENARIOS` / `TEMPLATES` / `SVCS` を**読むだけ**。1 バイトも書き換えない。
>      ポータルの都合で欲しくなった値（`ctx` / `how` / `short`）はポータル側の `PSVC` に持つ
>
> **カタログの `state` には触らない。**ポータルは別の `pstate`（§5-8）を持つ。
> `catalog.html` と `portal.html` は同時に読み込まれることが無いので、グローバルの衝突も起きない。

### 5-3. カタログのデモ画面との違い

**カタログ（`view === 'demo'`。`#main` を丸ごと置き換える 2 ペイン）**

```
[← サービス詳細へ] │ KN-02 設備マニュアル…  [QAチャット型]  劉 洋・蘇州工場  ●提供中  [最初から]
┌── work-pane ──────────────┬── chat-pane ─────────────────────────┐
│ 入力パネル                 │ [agent] こんにちは。…                │
│   files / fields / 差分 / key │ [user]  …                            │
│   [実行]                   │ [agent] …                            │
│ 結果パネル                 │ ────────────────────────             │
│   見出し＋kv or 表          │ 質問例: [日本語 …] [中文 …]          │
│                            │ [入力欄                    ] [送信]  │
└────────────────────────────┴──────────────────────────────────────┘
```

主語は**台本のペルソナ**（劉 洋・蘇州工場）。入力は台本の固定値。画面全体を占有する。

**ポータル（右ドロワー。後ろの画面はそのまま見えている）**

```
 案件 ── 画面は消えない ──────────────┐ ┌─ .aidrawer  width: min(560px, 96vw) ────────┐
 ┌ パイプライン ──────────────────┐  │ │ DC-08  報告レビュー          ●試行版   [×] │
 │ ▣ P-2411  MES 更改 第2期        │  │ ├────────────────────────────────────────────┤
 │   青嶺精工 ／ 篠崎 悠真 ／ Red  │  │ │ ① この画面から渡す文脈                     │
 │   [DC-08 報告レビュー][DC-01 …] │◀─┼─┤   案件     P-2411 MES 更改 第2期           │
 │   ✦ DC-08 の戻り 論点3件 [開く] │  │ │   顧客     青嶺精工                         │
 │ ▣ P-2418  与信ワークフロー刷新  │  │ │   担当     篠崎 悠真                        │
 │   …                             │  │ │   ステージ 進行中 ／ 期限 2026-10-31        │
 └─────────────────────────────────┘  │ │   状態     Red                              │
 ┌ この画面の AI（自動生成・6 件）─┐  │ │   ⓘ 画面の行から自動で入ります。打ち直しは要りません │
 │ [DC-01][DC-08][CV-01][NM-01]… │  │ ├────────────────────────────────────────────┤
 └─────────────────────────────────┘  │ │ ② 入力 — フォーム入力→ドラフト生成型       │
                                       │ │   ・報告先   日本本社 事業部長              │
                                       │ │   ・観点     進捗・課題・要員               │
                                       │ │   [この内容で実行]                          │
                                       │ ├────────────────────────────────────────────┤
                                       │ │ ③ 結果                                      │
                                       │ │   提出前チェック結果                        │
                                       │ │   論点 / 未決 / 数字の裏取り …              │
                                       │ │   [この結果を画面に残す]                    │
                                       │ ├────────────────────────────────────────────┤
                                       │ │ ④ 続けて聞く                                │
                                       │ │   質問例 [日本語 …] [中文 …]                │
                                       │ │   [入力欄                      ] [送信]     │
                                       │ ├────────────────────────────────────────────┤
                                       │ │ ⑤ 置き方 ／ ここに置く理由 ／ デモと本番     │
                                       │ └─────────────────────────────────────────────┘
```

**違いを 6 つ、はっきり書く：**

| # | カタログ | ポータル |
|---|---|---|
| 1 | `#main` を占有する全画面 | **右ドロワー。後ろの行と数字が見えたまま。**「どの行から呼んだか」が常に画面に残る |
| 2 | ヘッダの主語は**台本のペルソナ**（劉 洋・蘇州工場） | ヘッダの主語は**サービス**。文脈カードの主語は**行**（P-2411 ／ 青嶺精工 ／ 篠崎 悠真 ／ 進行中）。`persona` は使わない（押しているのはログイン中の利用者） |
| 3 | 入力欄は台本の固定値だけ | **入力の先頭に「この画面から渡す文脈」が自動で入っている欄が並ぶ。**これが「Dify の画面で単体で開くと案件名から打ち直しになる」の解消 |
| 4 | 結果はデモ画面の中で閉じる | **結果はドロワーに返り、`[この結果を画面に残す]` で行の下に 1 行の戻りが残る**（PR-4）。ドロワーを閉じても残る |
| 5 | work ペイン ／ chat ペインの**横 2 列** | **縦 1 列**（文脈 → 入力 → 結果 → 会話 → 解説）。幅 560px の読み物として上から下に読める |
| 6 | 3 層の見分けは無い | **ドロワー全体が AI 層（ターコイズ `--ai-*`）。**⑤ の解説は `.note` で「開発メモ／使い方」トグルの対象。業務＝白／解説＝黄土・青／AI＝ターコイズの区別は壊れない |

### 5-4. 文脈の渡し方 —— **台本は 1 バイトも書き換えない**

**やらないこと：** `scn.input[lang].fields` の `label` を行の値と突き合わせて書き換える。
（ja と zh でラベル文字列が違うので、突き合わせは必ず片方の言語で外れる。壊れやすい。）

**やること：** `PCTX[画面id](行)` が作った**文脈行を、入力パネルの先頭に「自動で入る欄」として差し込む**。
台本の `input` はそのまま下に並べる。追加であって書き換えではない。

```js
/* js/data/portal/svc.js — 画面ごとに「行から何を渡すか」を宣言する（純粋なリテラル） */
const PCTXDEF = {
  proj: ['id', 'nm', 'cu', 'ow', 'sg', 'due', 'rag'],
  cust: ['cu', 'own', 'stage'],
  act:  ['id', 'tgt', 'ttl', 'ow', 'due'],
  vend: ['nm', 'kind', 'credit', 'until'],
  watch:['date', 'src', 'ttl', 'deal'],
  meet: ['id', 'ttl', 'date', 'att'],
  exp:  ['id', 'kind', 'amt', 'state'],
  req:  ['id', 'kind', 'applicant', 'state'],
  ppl:  ['nm', 'role', 'deals', 'util'],
  trn:  ['id', 'kind', 'ttl', 'due'],
  know: ['grp', 'ttl', 'owner', 'updated'],
  kpi:  ['topic', 'metric', 'value'],
  home: []
};
```

- ラベル（`案件` / `顧客` / `担当` …）は `PT` の 3 言語。値は登録された言語のまま（§2-5 と同じ考え方）
- **行から呼んだ場合**（`rowai` のボタン）は上の全項目が入る
- **ブロックから呼んだ場合**（「この画面の AI」ブロック）は行が無いので、**画面レベルの文脈だけ**
  （画面名・自部門・業種）を出し、「行から呼ぶと案件 id と顧客名も渡ります」という 1 行の案内を添える
  （`PT.ctxNoRow`）。これで「行から呼ぶ意味」が画面の上で説明できる
- 自動で入る欄には `.auto` を付け、右肩に **「この画面から」**（`PT.autoFilled`、3 言語）の小さな印を出す

### 5-5. `TEMPLATES` 5 種の出し分け

`scn.template` をそのまま使う。**カタログと同じ 5 種だが、ポータルでは縦 1 列に畳む。**

| `template` | ② 入力の出し方 | ③ 実行後 |
|---|---|---|
| `qa` | **入力パネルを出さない。**文脈カードの直下に `[この文脈で聞く]`（＝台本 1 ターン目を消費）。`scn.input` を持たないテンプレート | 会話だけ（`result` が無い）。④ の往復へ |
| `form` | 自動で入る欄 ＋ 台本の `fields`（`label` と `value` を表示。編集はできない） ＋ 実行ボタン | `result` パネル（`items` の縦積み or `columns`+`rows` の表） |
| `upload` | 自動で入る欄 ＋ `files` をファイルチップで。**`.drop`（ドラッグ&ドロップ枠）は出さない**——ポータルでは行に付いている添付を使う想定なので、その旨を 1 行（`PT.uploadNote`） | `result` パネル |
| `diff` | 自動で入る欄 ＋ `left ⇄ right` の 2 チップ | `result` パネル |
| `lookup` | 自動で入る欄 ＋ `query`（照会キー）。**行がキーを持つ画面では、文脈カードの先頭に行のキーが既に出ている**ので、`query` は「台本の既定値」として下に置く | `result` パネル（表が多い） |

実測：ポータルに置く 49 件の内訳は **`qa` 6 ／ `form` 21 ／ `upload` 18 ／ `lookup` 4 ／ `diff` 0**。
`diff` は今は画面に出ないが、実装は 5 種すべて入れる（カタログにあるものをポータルで落とさない）。

### 5-6. 実行ボタンと、実機が無いものの扱い

| 条件 | ボタン | 冒頭の注意 |
|---|---|---|
| 台本あり・`st === 1`（提供中） | `PT.runLive`「この内容で実行」 | なし |
| 台本あり・`st === 2 / 3`（試行版・構想） | `PT.runMock`「想定の動きを見る」 | **いまのモックの文言をそのまま維持**：「〈試行版〉です。実機はまだありません。ここに出しているのは『何を渡して何が返る想定か』だけで、動くものとしては見せません。」 |
| **台本なし** | ボタンを出さない | `PT.noScript`「このサービスには台本を用意していません。渡すもの・返るものだけを出します」。以降は**いまのドロワーと同じ 4 セクション**（渡す文脈 / 返ってくるもの / 置き方 / ここに置く理由） |

> 2026-09-11 時点で、**ポータルに置く 49 件はすべて台本を持っている**（`SCENARIOS.mfg` 49 件・`SCENARIOS.fin` 29 件で
> 67 件を全部覆っている）。「台本なし」の分岐は**将来カタログに台本の無いサービスが増えたときのため**に用意する。
> verify §9 が「台本の無い `SVCS`」を既に warn している。

### 5-7. 業種と `SCENARIOS[業種][id]` の解決（IT 業が足されても壊れない）

> **⚠️ rev1。この節の `pscn()`（業種チップを第一希望にする規則）は §14-4 で改訂された
> （「行の世界」を第一希望にする規則に差し替え）。`PT.borrowed` は §14-7 の 2 キーに置き換えられた。**

```js
/* js/portal/app.js */
const pscn = (svcId) => {
  const order = [...new Set([pstate.ind, ...INDUSTRIES.map(i => i.id)])];   // 例: ['it','mfg','fin']
  for (const k of order) {
    const s = (window.SCENARIOS[k] || {})[svcId];
    if (s) return { scn: s, from: k };
  }
  return null;
};
const pscriptLang = (l) => (l === 'zh' ? 'zh' : 'ja');   // カタログ app.js の scriptLang と同じ規則
```

- **いまの 2 業種で動く：**ポータルの業種が `mfg` なら `mfg` の台本、`fin` なら `fin` の台本。
  両方にある 10 件（DC-02 DC-08 EG-01 GN-06 GN-07 KN-04 PO-01 PO-02 PO-03 PO-04）はポータルの業種が勝つ
- **IT を選ぶと：**`SCENARIOS.it` が無いので `mfg` → `fin` の順に落ちる。**`chat` フォールバックは要らない**
  （49 件すべて台本を持っているため必ず当たる）。当たらなかったときだけ §5-6 の「台本なし」に落ちる
- **`from !== pstate.ind` のとき**、ドロワーに 1 行出す：`PT.borrowed`「この台本は{ind}向けのものを流用しています」。
  PM がモックに書いた「いま使っている 49 件は製造業・金融業向けに作ったサービスを流用しています」と噛み合う
- **IT 業が `INDUSTRIES` と `SCENARIOS.it` に入った日：**`order` は `['it','mfg','fin']` のまま
  （`INDUSTRIES` から自動で作るので）、`SCENARIOS.it` が先に当たるようになる。
  **ポータルのコードは 1 行も直さない。**「流用しています」の 1 行も自動で消える

**AI サービス画面の業種の扱いも同じ規則で自己修復させる：**

```
pstate.ind が INDUSTRIES に有る  → SVCS.filter(s => s.industries.includes(pstate.ind)) で絞る
pstate.ind が INDUSTRIES に無い  → 全件を見せ、「カタログに〈IT 業〉がまだありません。…流用しています」の注記を出す
```

いまのモックは `ind === 'it' ? CAT : CAT.filter(...)` というベタ書きの分岐。これを上の判定に置き換えると、
IT 業がカタログに入った瞬間に注記が消えて絞り込みが始まる。

### 5-8. 英語のときの台本（§2-5）

- 台本（`script`・`input`・`result`）は **ja / zh のみ**。UI 言語が `en` のときは `pscriptLang('en') === 'ja'` で
  **日本語の台本を再生する**（カタログの `scriptLang()` と完全に同じ規則）
- 質問例のチップは **ja と zh を常に両方出す**（カタログと同じ）。英語のチップは作らない
- **UI 言語が `en` のときだけ**、④ の上に 1 行出す：
  `PT.scriptLangNote`「台本は日本語と中国語だけです。エージェント本体は入力した言語で返します」
  （3 言語。§付録 B）。これは§2-5 の契約を顧客に説明するための文で、カタログには無いポータルの追加
- 「日中対応」を**サービスの区別タグにしない**（§2-5）。`PSVC` にそういう印を作らない

### 5-9. 結果をポータルの画面に返す

**主たる答え：ドロワーの ③ 結果パネル。**ドロワーはポータルの画面の上に重なっているので、
「Dify の別画面に飛ばされない」という要件はこれで満たす。

**加えて（PR-4）：`[この結果を画面に残す]` を押すと、呼び出した行の下に 1 行の戻りが残る。**

```
▣ P-2411  MES 更改 第2期        青嶺精工 ／ 篠崎 悠真 ／ Red
   [DC-08 報告レビュー] [DC-01 本社報告] [CV-01 …]
   ✦ DC-08 の戻り   論点 3 件・未決 1        09-11 14:20   [開く]
```

- 保存先は **`pstate.back[画面id][行id] = [{ svc, at, line }]`**（メモリのみ。`localStorage` に書かない。§2-6）
- `line` は `scn.result[lang].title` と最初の `items[0].k` から作る 1 行要約。新しい文言は作らない
- `[開く]` で同じドロワーを**結果が出た状態**で開き直す
- 既存の「AI が拾った To Do 候補（候補 → 採用）」と同じ考え方（AI の出力は人が採ってはじめて業務データになる）。
  戻りは**採用ではない**ので、業務データ（`PDEALS` など）は書き換えない
- **PM がここを落としたければ PR-4 だけ落とせる。**PR-3 まででも「結果がポータルに返る」は成立する

### 5-10. AI サービス画面（15 画面目）の作り直し

いまのモックは、この画面に**破線の枠で「この枠の中にカタログが入ります（iframe）」**と書き、
`https://shoulang0729.github.io/dify/` を `target="_blank"` で開くリンクを置いている。
PM の判断（iframe 不採用・別タブ不採用）に従って**両方とも外す**。

- 破線の枠 → **同一サイト内リンクのカード**。`href="catalog.html"`（相対パス・同じタブ）。
  ポータルとカタログは同じ Pages サイトの 2 枚のページなので、これは「埋め込み」でも「別タブ」でもなく**ただの遷移**
- `catalog.html` の側からポータルへのリンクは**足さない**（§2-4：`catalog.html` は本番 UI 相当の画面。
  ポータルへの行き来はレビュー用の足場なので、導線は `index.html`（デモガイド）に置く）
- 4 つのタイル（業種のサービス数／ポータルから辿れる／辿れない／実機が稼働中）は `SVCS` から計算する
- **「置き場所を決めていない N 件」のタイルを 1 つ足す**（`place` キーが無い件数）。いまは 0
- 「辿れない N 件」の内訳表の理由は `POUT` から引く

---

## 6. トークン（`tokens.css` に足す 22 個）

ポータルのインライン token ブロックにしか無かったものを、**セマンティック層に**足す。
light（`:root`）と dark（`:root[data-theme="dark"]`）の**両方に同時に**書く。値はポータルの現物をそのまま使う。

| # | トークン | light | dark | 用途 |
|---|---|---|---|---|
| 1 | `--rag-r` | `#B32100` | `#FF8A66` | 案件の Red |
| 2 | `--rag-r-bg` | `rgba(228,38,0,.12)` | `rgba(228,38,0,.20)` | 〃 |
| 3 | `--rag-y` | `#8A5300` | `#FFD34D` | 案件の Yellow |
| 4 | `--rag-y-bg` | `rgba(255,196,0,.20)` | `rgba(255,196,0,.18)` | 〃 |
| 5 | `--rag-g` | `#00733A` | `#5BE79B` | 案件の Green |
| 6 | `--rag-g-bg` | `rgba(0,203,93,.14)` | `rgba(43,224,126,.16)` | 〃 |
| 7 | `--prod-fg` | `#6B3389` | `#C9A6E4` | 「本番との違い」層 |
| 8 | `--prod-bg` | `rgba(107,51,137,.10)` | `rgba(107,51,137,.24)` | 〃 |
| 9 | `--prod-bd` | `rgba(107,51,137,.34)` | `rgba(201,166,228,.40)` | 〃 |
| 10 | `--doc-fg` | `#7A5B00` | `#D9BC5B` | 「開発メモ」層 |
| 11 | `--doc-bg` | `rgba(255,196,0,.07)` | `rgba(255,196,0,.07)` | 〃 |
| 12 | `--doc-bd` | `rgba(122,91,0,.28)` | `rgba(217,188,91,.30)` | 〃 |
| 13 | `--usr-fg` | `#005B96` | `#7FC0FF` | 「使い方」層 |
| 14 | `--usr-bg` | `rgba(0,113,188,.06)` | `rgba(46,144,255,.08)` | 〃 |
| 15 | `--usr-bd` | `rgba(0,113,188,.28)` | `rgba(127,192,255,.30)` | 〃 |
| 16 | `--ai-fg` | `#00707C` | `#5FD3DE` | 「AI」層（ドロワー・AI ブロック） |
| 17 | `--ai-bg` | `rgba(0,223,237,.06)` | `rgba(0,223,237,.07)` | 〃 |
| 18 | `--ai-bd` | `rgba(0,112,124,.32)` | `rgba(95,211,222,.30)` | 〃 |
| 19 | `--text-on-rail` | `#C3CDD6` | `#C3CDD6` | 濃紺サイドバーの文字 |
| 20 | `--text-on-rail-strong` | `var(--ntt-white)` | `var(--ntt-white)` | 〃（見出し・選択中） |
| 21 | `--surface-rail-hover` | `rgba(255,255,255,.06)` | `rgba(255,255,255,.06)` | サイドバーの hover |
| 22 | `--surface-rail-selected` | `rgba(46,144,255,.16)` | `rgba(46,144,255,.16)` | サイドバーの選択中 |

**守ること（§2-2）**

- `--ntt-*`（ブランドパレット）は**追加も変更もしない**
- **dark ブロックは 1 つのまま。**ポータルのインライン CSS には
  `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` と `:root[data-theme="dark"]` の
  **2 つ**があり、しかも `--cat-cv` / `--cat-qa` 系の行が 2〜3 回重複している（移植時の事故）。
  **どちらも捨てて `tokens.css` の 1 ブロックに一本化する**
- `--cat-*` は `tokens.css` に既に 13 分類ぶん light/dark 対称で入っている（verify §5-b が検査済み）。ポータルは読むだけ
- `portal.css` の `var(--x)` はすべて `tokens.css` で定義済みであること（verify §17-d）

---

## 7. 多言語（§2-1）

### 7-1. v1 でどこまで訳すか

| 対象 | v1 | 検査 |
|---|---|---|
| **`PT`**（ナビ 15・グループ 4・ブランド 3・チップ 2・ロール 1・テーマ 1＋§5 で足す 28）＝ラベル辞書 | **ja / zh / en 完全一致・空値なし・en にかな残りなし** | verify §17-e（カタログ §2 と同じ検査） |
| `PSVC[].short`（行のボタンに出る短いラベル） | **3 言語必須** | verify §17-e |
| `SVCS[].name` / `desc` / `CATS[].name`（カタログから読む） | **既に 3 言語**（`PL()` で引く） | verify §2 |
| `TEMPLATES[].name` / `desc` | **既に 3 言語** | verify §2 |
| `SCENARIOS[].steps` / `persona` | **既に 3 言語** | verify §9 |
| `SCENARIOS[].script` / `input` / `result` | **ja / zh のみ**（§2-5 の実装。en は ja に落ちる） | verify §9 |
| `PSVC[].ctx` / `out` / `why`、`POUT`、`PKNOWACT`、画面の見出し・表ヘッダ・`.note` の解説散文 | **v1 は日本語のみ** | §7-2 のルール |
| 架空の業務データ（案件名・顧客名・人名・数字） | **登録された言語のまま**（§2-5 と同じ考え方。いまのモックの方針を踏襲） | — |

### 7-2. 「半端な 3 言語」を作らないための機械的なルール

> **`mock/js/data/portal/**` に現れる `{ ja: … }` の形のオブジェクトは、`zh` と `en` も必ず埋まっていること。
> 3 言語で出せないものは素の文字列で書く（`{ja:'…'}` の形にしない）。**

- verify §17-e がこれを検査する。`{ja:…}` の形を見つけたら `zh` / `en` の有無と空でないことを見る
- 素の文字列は「訳していない日本語の説明文」だと**形で分かる**。あとで訳すときは `{ja,zh,en}` に変えるだけ
- **`PT` に `ja` だけ足す、という半端な状態が構造的に作れない**

### 7-3. `en` で開いたときの見え方（正直に書いておく）

ナビ・画面タイトル・パンくず・ブランド・ドロワーのラベルは英語になる。**画面本文の見出しと解説は日本語のまま。**
これはいまのモックと同じ挙動で、PM は英語のスクリーンショット（`en.png`）を見て進めている。

「開発メモ」「使い方」のトグルを両方 OFF にすると解説散文は消えるので、**残る日本語は見出しと表ヘッダ**になる。
これを訳すかどうかは §13 Q1（PM 判断）。訳すなら見出し・表ヘッダで概算 150 キー × 3 言語で、
`classifyBlocks()` の見出し文字列一致を明示クラスに置き換える作業（§3-5）と同じ PR にすべき。

---

## 8. load-bearing への影響一覧（`CLAUDE.md` §2）

| 節 | 触るか | どうするか |
|---|---|---|
| **§2-1** 多言語 ja/zh/en 完全一致 | **触る** | `PT` と `PSVC[].short` を 3 言語完全一致にし、verify §17-e で検査。解説散文は素の文字列（§7-2）。**英語を空にしない** |
| **§2-2** セマンティックトークンのみ・ブランド不変 | **触る** | `tokens.css` のセマンティック層に 22 個追加（§6）。`--ntt-*` は不変。**dark ブロックは 1 つのまま**（ポータルの 2 ブロック＋重複行は捨てる）。`portal.css` は色の直値ゼロ（現状の 6 箇所をトークン化） |
| **§2-3** 共通レイヤーの契約 | **触らない（拡張する）** | カタログの `state` / `data-act` / 読み込み順 / `render.js` は 1 バイトも触らない。ポータルは別アプリとして `pstate` と自分の描画層を持つ。整理は §5-2。**`CLAUDE.md` §2-3 に 1 段落足す提案は §8-3** |
| **§2-4** 足場とプロダクト機能を混ぜない | **維持** | ポータルの `.mockbar`（業種・開発メモ・使い方・本番との違い・編集権限）＝**足場**。ヘッダの言語切替とテーマ切替＝**プロダクト機能**。`catalog.html` にポータルへのリンクを足さない（導線は `index.html`） |
| **§2-5** 言語切替はメニュー表示のみ | **維持** | 台本は ja/zh のみ。en は ja に落ちる（§5-8）。`detectLang()` はカタログの契約（verify §7 がカタログのアプリ層を見る）。**ポータルにも同じ規則の `pscriptLang()` を置く**が、`detectLang` 相当の自由入力判定は PR-3 でカタログと同じ実装を複製する |
| **§2-6** `localStorage` は 3 キーだけ | **触る（キーは増やさない）** | ポータルは **`mock.lang` と `mock.theme` だけ**を読み書きする。改名も転用もしない（意味は同じ「モックの表示言語／テーマ」）。`mock.fav` は読まない・書かない。**キーごとに別の try** で読む（§2-6 の作法）。verify §17-f がポータルのアプリ層にも同じ許可集合を当てる。**4 つ目は作らない** |
| **§2-7** 成熟度 `st` は 1/2/3 | **維持** | ポータルは `SVCS[].st` をそのまま読む。**`PSVC` の `st` コピーは削除**（いまのモックは `st` を二重に持っている）。`PNEW` だけ `st: 0`（未採番の提案）を持つが、これは `SVCS` の外なので値域検査に触れない |
| **§2-8** Pages の公開方式 | **触らない** | `pages.yml` は `path: mock` のまま。`mock/portal.html` は `https://shoulang0729.github.io/dify/portal.html` として自動で公開される。参照はすべて相対パス。`_` 始まりディレクトリを作らない。`.nojekyll` はそのまま |
| **§2-9** 顧客版差し替えはデータ層だけ | **触る** | `SVCS` に `place` を足す（§4-3）。件数と id 一覧は §4-5。**id の改名・欠番は無し。**描画ロジック（`render.js`）は触らない |
| **§2-10** シークレットを置かない | **維持** | ポータルの会社・人・数字はすべて架空（翠雲システムズ／篠崎 悠真 ほか。`data/world/` の 2 世界と姓名衝突なしを確認済み）。実 URL・キーを書かない。**`LIVE`（本番 Dify の URL）は読み込まない**（§3-2） |
| **§2-11** 管理番号 | **維持** | ポータルは `SVCS[].id` → `KN-02` の変換だけを使う（カタログの `svcCode()` と同じ規則を `js/portal/app.js` に複製）。**別データを持たない**（いまのモックは `'KN-02'` を生キーにしているが、`SVCS[].id` からの変換に統一する） |
| **§2-12** 環境差分は `dify/env/` に閉じる | **触らない** | `dify/**` に一切触らない |
| **§2-13** 架空データの正本は `data/world/` | **触らない（別 Issue）** | 翠雲システムズは `data/world/` に無い 3 つ目の架空世界（自部門）。**v1 は `mock/js/data/portal/org.js` を正本とし、`data/world/` へは昇格させない。**理由は §13 Q4。`tools/check-world.mjs` は warn のみ・CI 外なので現状の 10 件の warn を増やさない |

### 8-3. `CLAUDE.md` の改定提案（**PM 承認後に別 PR。この設計では触らない**）

1. **§2-3 の冒頭に 1 段落**
   > **`mock/` には HTML が 2 枚ある。**`catalog.html`（AI エージェントカタログ）と `portal.html`（社内ポータル）で、
   > **`mock/js/data/**` を共有し、アプリ層はページごとに分かれる**（カタログ＝`js/app.js`・`render.js`・`events.js`／
   > ポータル＝`js/portal/*.js`）。この節の `state`・`data-act`・読み込み順・「描画は `render.js`」は
   > **`catalog.html` の中の契約**。ポータルは `pstate` と `js/portal/render.js` を持つ。
   > 両ページに共通で効くのは「`js/data/**` は純粋なリテラル宣言のみ」と
   > 「読み込み順はそのページの `<script src>` の並びが唯一の正」の 2 つ。

2. **§2-6 に 1 行**
   > `mock.lang` / `mock.theme` は **`catalog.html` と `portal.html` が共有する**（同じ意味・同じ値域）。
   > `mock.fav` はカタログだけが使う。

3. **§2-8 に 1 行**
   > `mock/portal.html` は `https://shoulang0729.github.io/dify/portal.html`。`catalog.html` と同じサイトの 2 枚目。

4. **§2-9 に 1 行**
   > `SVCS[].place`（ポータルのどの画面に出るか）もデータ層。差し替え時は `place` も一緒に移す。

5. **§6 バックログに 1 行**（社内ポータル概念モック。設計書とこの Issue へのリンク）

6. **§3 検証コマンドの表は変えない**（`npm test` が `verify` と `regress` を回すので、§17 は自動で入る）

---

## 9. 検証

### 9-1. `tools/lib/load.mjs` に `loadPortal(ROOT)` を足す

`loadMock()` は **1 バイトも変えない**（カタログの検査を巻き添えにしない）。同じ作法で `portal.html` を読む関数を足す：

```
loadPortal(ROOT) → {
  html, cssLinks, scriptSrcs,        // portal.html を読む
  dataSources, appSources,           // js/data/** と js/portal/**
  data: { T, TEMPLATES, CATS, SVCS, CAT_STYLE, SCENARIOS,
          PT, PSCREENS, PSVC, POUT, PNEW, PSTAGE_AI, PCTXDEF, PORG, … },
  vmErrors
}
```

- `node:vm` の 1 コンテキストで `portal.html` の `<script src>` 順に `js/data/**` を実行する（`js/portal/**` は実行しない）
- **`js/data/portal/**` も「純粋なリテラル宣言のみ」**。`document`・`localStorage`・関数呼び出しを書くと vm で落ちる

### 9-2. `tools/verify.mjs` §17（新設）

**節番号：§17。**§13 は #121 W2 予約／§14 は #124（本番リンク）／§15 は #121 W4-1（削除系 API）／
§16 は #205（デモ資材）が既に使っている。**§17 が最初の空き**（`tools/verify.mjs` L29〜L64 の一覧で確認済み）。

| 枝番 | 検査 | 結果 |
|---|---|---|
| **17-a** | `portal.html` の `<script src>` が §3-2 の順・本数（実ディレクトリから計算：data 3 ＋ scenarios 実数 ＋ portal data 7 ＋ portal app 4）・すべて実在・すべて相対パス | FAIL |
| **17-b** | `portal.html` に インライン `<script>` 0 個・`<style>` 0 個。`<link>` は `css/tokens.css` → `css/portal.css` の 2 本。トークン定義のコピー（`--ntt-*` の定義行）が無い | FAIL |
| **17-c** | `SVCS[].place` の値域：`PSCREENS` の画面 id ／ `'*'` ／ `'out'` のいずれか。**キー自体が無いものは warn**（「置き場所を決めていない: KN-09, …」） | 値域外＝FAIL／未設定＝warn |
| **17-d** | `portal.css` に色の直値（`#RGB` / `#RRGGBB`）が無い。`portal.css` の `var(--x)` がすべて `tokens.css` で定義済み | FAIL |
| **17-e** | `PT` と `PSVC[].short` が ja/zh/en を全部持ち、空でなく、`en` にかな（ひらがな・カタカナ）が残っていない。**`js/data/portal/**` に現れる `{ja:…}` 形のオブジェクトはすべて 3 言語** | FAIL |
| **17-f** | ポータルのアプリ層（`js/portal/*.js`）に現れる `mock.*` のリテラルが `mock.lang` / `mock.theme` の 2 つの部分集合（`mock.fav` を書いたら FAIL）。§2-6 の許可集合と同じ考え方 | FAIL |
| **17-g** | `PSVC` / `PSTAGE_AI` / `PSCREENS[].newai` に出てくる管理番号が `SVCS` に存在する（`PNEW` の id は除く）。`PCTXDEF` のキーが `PSCREENS` の id に存在する。`POUT` のキーが `place === 'out'` の管理番号と過不足なく一致 | FAIL |
| **17-h** | `portal.html` に `class="mockbar"`（足場）がある／ヘッダに言語切替（`id="langSel"`）とテーマ切替（`id="themeBtn"`）がある（§2-4） | FAIL |
| **17-i** | `PSVC` が `st` / `name` / `cat` を持っていない（`SVCS` からの二重持ちの再発を止める） | FAIL |
| **17-j** | `portal.html` / `portal.css` / `js/portal/**` / `js/data/portal/**` に `http://` `https://` の生 URL が無い（§2-10。`catalog.html` への相対リンクは可） | FAIL |

> §17 は `mock/portal.html` が無ければ**節ごと skip**（PR-2 以降の分割マージ中に落ちないように。§16 と同じ作法）。

### 9-3. `tools/regress.mjs`

- スナップショットの `svcs` に **`place` を足す**：`{ id, cat, sub, st, industries, tags, place }`
- 差分メッセージ：`SVCS.<id> place: proj → exp`
- **PR-2 で `--update` を 1 回。**PR 本文に「設計書 `docs/handoff/2026-09-11-portal-mock-pages.md` §4-3・§4-5 のデータ変更に伴う基準更新」と書く
- **`counts` は 1 つも変わらない**（`cats:13` / `subs:29` / `svcs:67` / `tags:57` / `ui:91` と業種別の件数）。
  変わったら `place` 以外に触っている
- **注意（2026-09-11 時点の並行作業）**：`docs/handoff/2026-09-11-repo-layout-v3.md` §8-2 の作業で
  `counts` の業種別キーが `svcsMfg` / `svcsFin` / `svcsBoth` / `catsMfg` / `catsFin` から
  `byIndustry` / `svcsMulti` に置き換わる（業種を `tools/**` にハードコードしない）。
  **この設計はそのどちらでも成立する**（`place` を `svcs` の各要素に足すだけで、`counts` には何も足さない）。
  実装時は `main` の現物に合わせること。**`counts` の形を先に変えるのは repo-layout-v3 側の仕事で、この PR ではやらない**

### 9-4. `npm test` / その他

- `npm test` = `verify` ＋ `regress`。CI の `verify` ワークフローがそのまま回る
- `npm run index`（`docs/service-map.md`）は **再生成不要**（サービスの増減が無いため）。念のため PR-2 で `node tools/gen-index.mjs --check` が通ることを確認する
- `npm run world` の warn 件数を**増やさない**（現状 16 warn。§13 Q4）

---

## 10. 公開

- `pages.yml` は `path: mock` のまま。**`main` にマージされた時点で自動デプロイ**
- URL：**`https://shoulang0729.github.io/dify/portal.html`**
  （`path: mock` で `mock/` がサイトのルートになるため、URL に `/mock/` は入らない。§2-8）
- 参照はすべて相対パス（`css/tokens.css` / `js/portal/app.js` / `catalog.html`）＝**`file://` でも開ける**
- `mock/` 配下に `_` 始まりディレクトリを作らない。`.nojekyll` はそのまま

**導線**

| どこから | どこへ | 形 |
|---|---|---|
| `mock/index.html`（デモガイド。ja/zh の 2 言語） | `portal.html` | カードを 1 枚追加。既存の `.cta ja` / `.cta zh` の作法に合わせる |
| `mock/index.html` | `catalog.html` | 既存のまま |
| `portal.html` の AI サービス画面 | `catalog.html` | `href="catalog.html"`（同じタブ・相対パス） |
| `catalog.html` | `portal.html` | **足さない**（§2-4） |
| `mock/README.md` | 両方 | 収録モックの表に 1 行、ディレクトリ構成に `portal.html` / `css/portal.css` / `js/data/portal/` / `js/portal/` |

---

## 11. PR 分割

**4 本。PR-1 → （PR-2 ∥ PR-3）→ PR-4。**
185KB の層分けは**独立した 1 本にする**（レビューできる diff の大きさにするため、
そして「動きは変えず場所だけ変える」ことを reviewer が確認できるようにするため）。

| PR | 題 | 触るファイル | Pages に出るもの |
|---|---|---|---|
| **PR-1** | ポータルを `mock/` に取り込み、4 層に分ける | `mock/portal.html`（新）／`mock/css/portal.css`（新）／`mock/css/tokens.css`（22 トークン追加）／`mock/js/data/portal/*.js`（新 7）／`mock/js/portal/{app,render,events}.js`（新 3）／`mock/index.html`／`mock/README.md`／`tools/lib/load.mjs`（`loadPortal` 追加）／`tools/verify.mjs`（§17-a,b,d,e,f,h,i,j） | **15 画面すべて。**言語切替・テーマ切替・業種切替・3 層トグル・権限トグル・カスケード・絞り込み・接触履歴・候補採用・AI 入口ドロワー（説明のみ、いまと同じ） |
| **PR-2** | サービス → 画面の対応表をカタログのデータ層へ | `mock/js/data/catalog.js`（`place` を 67 件に追加）／`mock/js/data/portal/svc.js`（`PLACE` 削除・`POUT` 新設）／`mock/js/portal/render.js`（`place` から AI ブロックを生成）／`tools/regress.mjs`＋`baseline.json`（`--update` 1 回）／`tools/verify.mjs`（§17-c,g） | 「この画面の AI」ブロックが `place` から自動生成される。AI サービス画面に「置き場所を決めていない N 件」が出る |
| **PR-3** | 台本をポータルで再生する（実行ドロワー） | `mock/js/portal/demo.js`（新）／`mock/js/portal/{app,render,events}.js`／`mock/js/data/portal/{ui,svc}.js`（`PT` の 28 キー・`PCTXDEF`）／`mock/css/portal.css` | **ドロワーで台本が動く。**文脈カード・テンプレート 5 種の入力・結果パネル・往復・業種フォールバック・en の注記 |
| **PR-4** | 結果を行に残す／AI サービス画面の作り直し | `mock/js/portal/{app,render,demo,events}.js`／`mock/js/data/portal/ui.js`／`mock/css/portal.css` | 行の下に AI の戻りが 1 行残る。AI サービス画面の iframe プレースホルダが `catalog.html` への導線に替わる |

**並列可否**：PR-2 と PR-3 は `js/portal/render.js` が重なるので**直列**にするのが安全。
どうしても並列にするなら PR-2 を先にマージしてから PR-3 を rebase する。

**ブランチ**：`feat/<issue>-pr1-portal-split` / `-pr2-place` / `-pr3-demo` / `-pr4-writeback`
**`run:*` ラベル**：4 本とも **`run:cloud`**（ネットワーク不要の検証のみ）

---

## 12. 受け入れ条件

### 12-1. PR-1

- AC-1 `node tools/verify.mjs` / `node tools/regress.mjs` / `npm test` がすべて PASS。**`regress` の出力（`counts` と差分一覧）が `main` と 1 文字も変わっていない**
- AC-2 `mock/portal.html` に `<style>` 0 個・インライン `<script>` 0 個。`<link>` は `css/tokens.css` → `css/portal.css` の 2 本。`<script src>` は §3-2 の順で 32 本
- AC-3 `mock/css/portal.css` に `#RGB` / `#RRGGBB` が 1 つも無い。`portal.css` の `var(--x)` がすべて `tokens.css` で定義済み
- AC-4 `mock/css/tokens.css` の `--ntt-*` の**行が 1 つも変わっていない**（`git diff` で確認）。`:root[data-theme="dark"]` ブロックは **1 つのまま**。追加した 22 トークンが light と dark の両方にある
- AC-5 `mock/js/data/portal/**` に `document` / `localStorage` / `window.` / 関数呼び出しが 1 つも無い（純粋なリテラル宣言のみ）。`loadPortal()` が vm で読めて `vmErrors` 0 件
- AC-6 `mock/catalog.html` / `mock/js/app.js` / `render.js` / `events.js` / `mock/css/components.css` / `mock/js/data/{ui,catalog,home,style,live}.js` / `mock/js/data/scenarios/**` の diff が**ゼロ**
- AC-7 **移設前後で画面が同じ**：`ja/light`・`zh/dark`・`en/light` の 3 通り × 15 画面で、移設前の単一 HTML と `portal.html` のスクリーンショットが一致（レイアウト・文言・色）
- AC-8 **3 層の色分けが 1 ブロックも変わっていない**（業務＝白・解説＝黄土/青・AI＝ターコイズ）。`.mockbar` の 4 トグルが移設前と同じ挙動
- AC-9 `CAT` / `CATN` / `catOf` / `CATC` が**どこにも残っていない**。AI サービス画面の件数が `SVCS` から計算されている（67／49／18／12 が出る）
- AC-10 ブラウザのコンソールにエラー 0 件。`file://` で `portal.html` を直接開いても 15 画面すべてが描画される
- AC-11 `mock.lang` / `mock.theme` を書き込み、`catalog.html` を開いたときに同じ言語・同じテーマになる。`mock.fav` は読み書きしない
- AC-12 `mock/index.html` からポータルへ行ける。`mock/README.md` の構成図が実ファイルと一致

### 12-2. PR-2

- AC-13 `SVCS` 67 件すべてに `place` があり、§4-5 の表と**完全に一致**する（49 ＋ 18）
- AC-14 `mock/js/data/catalog.js` の diff が **`place:` の追加行だけ**（`id`/`cat`/`sub`/`st`/`industries`/`tags`/`name`/`desc`/`added` と `CATS` に差分ゼロ）
- AC-15 `regress` の差分が **`place` の追加だけ**。`counts` は 1 つも変わらない（`cats:13` / `subs:29` / `svcs:67` / `tags:57` / `ui:91` と業種別の件数がすべて同じ）。`tools/regress.baseline.json` の diff が `place` の行だけ。PR 本文に「設計書 `docs/handoff/2026-09-11-portal-mock-pages.md` §4-3・§4-5 のデータ変更に伴う基準更新」と書いてある
- AC-16 **（§14-11 で改訂）**「この画面の AI」ブロックが `place` から生成され、12 画面それぞれで **§14-8** の件数と一致する。ホームの「横断で使う AI」に GN-05・LG-01 の 2 件が出る。**業種チップを動かしても 1 件も変わらない**
- AC-17 `SVCS` に架空のサービスを 1 件足して `place: 'proj'` にすると、**案件画面のボタンが 1 つ増える**（描画コードを直さずに。確認後に戻す）
- AC-18 `place` はカタログの画面（`catalog.html`）に**一切表示されない**
- AC-19 `node tools/gen-index.mjs --check` が PASS（`docs/service-map.md` は再生成不要）

### 12-3. PR-3

- AC-20 **台本が動く**：案件画面の行から DC-08 を開き、`[この内容で実行]` → 結果が出て、質問例で 3 往復できる
- AC-21 **文脈が見えている**：ドロワーの①に `P-2411` / 青嶺精工 / 篠崎 悠真 / 進行中 / 2026-10-31 / Red が出る。②の自動で入る欄に「この画面から」の印がある
- AC-22 **台本を書き換えていない**：`mock/js/data/scenarios/**` の diff がゼロ
- AC-23 **テンプレート 5 種**がそれぞれ §5-5 の通りに出る（`qa` は入力パネル無し・`form` `upload` `lookup` は結果パネルあり・`diff` は手で `SCENARIOS` を差して確認）
- AC-24 **（§14-11 で差し替え。rev1 のこの記述は無効）** 新しい AC-24 / AC-24b / AC-24c は §14-11 を見ること
- AC-25 **英語**：UI を `en` にしても台本は日本語で動き、④の上に `PT.scriptLangNote` が出る。`ja` / `zh` では出ない
- AC-26 **`st !== 1`** のサービスでは「試行版です。実機はまだありません。…」の注意が**いまのモックと同じ文言で**出て、ボタンが `[想定の動きを見る]` になる
- AC-27 **3 層が壊れていない**：ドロワー全体が AI 層の色。⑤の解説が「開発メモ／使い方」トグルで消える
- AC-28 ドロワーは `Esc` と背景クリックで閉じ、閉じたときに呼び出したボタンへフォーカスが戻る（いまの挙動を維持）
- AC-29 ドロワーを開いても**後ろの画面のスクロール位置が飛ばない**

### 12-4. PR-4

- AC-30 `[この結果を画面に残す]` で行の下に 1 行の戻りが残り、ドロワーを閉じても消えない。`[開く]` で結果付きのドロワーが開く
- AC-31 戻りは `localStorage` に書かれない（リロードで消える）。`mock.fav` を汚さない
- AC-32 AI サービス画面に **iframe の破線枠と `target="_blank"` の絶対 URL が残っていない**。`catalog.html` への相対リンク（同じタブ）になっている
- AC-33 「置き場所を決めていない N 件」のタイルが出て、いまは 0 件

### 12-5. 全 PR 共通

- AC-34 `.claude/**` と `CLAUDE.md` に差分ゼロ
- AC-35 `dify/**` / `data/world/**` / `.github/workflows/**` / `docs/demo/**` に差分ゼロ
- AC-36 `npm run world` の warn が増えていない
- AC-37 PR 本文に設計書パス・変更要約・検証結果・**触っていない範囲**が書いてある

---

## 13. PM 判断待ち

| # | 論点 | architect の推奨 |
|---|---|---|
| **Q1** | **画面本文（見出し・表ヘッダ・解説散文）を zh / en に訳すか。** v1 は日本語のまま（ナビ・ラベル・ドロワーだけ 3 言語）。訳すなら概算 150 キー × 3 言語＋`classifyBlocks()` の明示クラス化で PR 1 本ぶん | **v1 は訳さない。**まず Pages に出して、中国側のレビュアーに見せてから決める。訳すと決まったら独立した PR-5 にする（`PT` の形が決まっているので後から足せる） |
| **Q2** | **カタログ側に「ポータルから使える」バッジを出すか。** PM 自身がモックに「顧客に見せるときはバッジを出しません。ポータルに埋め込んだときだけ出す形を提案します。ここは PM 判断です」と書いている | **v1 は出さない。**`place` はデータとしてだけ持ち、ポータルだけが読む。顧客にカタログを見せる場面で「ポータル」という社内の都合が出るのを避ける。必要になったら `.mockbar` のトグル 1 つで出せる |
| **Q3** | **案件ステージ単位の割り付け（`STAGE_AI`）もカタログのデータ層に持つか。** PM のモックの注記は「どのポータル画面・**どのステージに出るか**を列で」 | **v1 はポータル側（`PSTAGE_AI`）に残す。**ステージは案件画面の内部構造なので、カタログが知る必要がない。「1 行足すだけでボタンが増える」性質は `place` だけで満たせる。必要なら後から `place` を `{screen, stages}` に広げられる（後方互換） |
| **Q4** | **翠雲システムズ（自部門の架空世界）を `data/world/` に昇格させるか。** §2-13 は「新しい名前・数字はまずマスタに足す」 | **v1 は `mock/js/data/portal/org.js` を正本にし、昇格は別 Issue。**理由：`data/world/` は「顧客環境で実データに差し替える境目」（§2-13）で、自社側の架空世界は差し替え対象ではない。また `check-world.mjs` の未統一 warn（現状 10 件）を増やしたくない。**ただしポータルの顧客は `data/world/` の青嶺精工・碧洋銀行そのものなので、社名・拠点の表記は `data/world/` に合わせる**（PR-1 の受け入れ条件に含める） **／ ⚠️ rev2 で撤回（§14-10）：#255 で `data/world/it/` が新設され、翠雲システムズの世界はそこが正本になった。ポータルのデータ層はその写し（§14-5）** |
| **Q5** | **`LIVE`（稼働中アプリへの公開 URL）をポータルのドロワーに出すか。** §2-10 は「架空データしか入っていない 12 本は Pages に載せてよい（PM 確認済み）」 | **v1 は出さない**（`LIVE` は 2026-09-11 時点で空なので出しようがない）。中身が入ったら PR-5 で `st:1` のドロワーに「実機を開く」を出す。カタログには既に同じ仕掛けがある |
| **Q6** | **`PNEW`（未採番の追加候補。いまは `NEW1` 名刺 OCR の 1 件。AI サービス画面の本文では 10 件と書かれている）を、IT 業のカタログ追加設計（`docs/it-industry`）に渡すか** | **渡す。**ただしこの設計では**リンクだけ**にする（Issue のコメントで IT の architect に伝える）。ポータル側は `PNEW` に持ち続け、カタログに採番されたら `PNEW` から消して `SVCS` に `place` 付きで足す。**この設計は IT 業の PR を待たない** **／ ✅ rev2 で解決（§14-8）：`new1`（名刺 OCR）は GN-08 として採番された。`PNEW` は空にする** |
| **Q7** | **`CLAUDE.md` の改定（§8-3 の 5 箇所）を承認するか** | **PR-1 のマージ後に、別 PR（`docs/…`）で 5 箇所まとめて。**内容は §8-3 に全文を書いた |
| **Q8** | **PR-4（結果を行に残す）をやるか** | **やる。**「Dify の別画面に飛ばされず、結果が業務の画面に残る」が顧客に一番効く場面だから。ただし PR-3 までで「結果がポータルに返る」は成立しているので、**時間が無ければ PR-4 だけ落とせる** |

---

## 付録 A. `SVCS[].place` 全 67 件

```
CV-02 → cust
CV-01 DC-01 DC-08 DC-09 EG-01 NM-01                      → proj
GN-06 LG-04                                              → act
PO-04 PT-04 PT-05                                        → ppl
DC-03 PO-01 PO-02 PO-03 PT-08                            → trn
DC-02 GN-04 GN-07                                        → meet
KN-03 KN-04 LG-02 LG-03                                  → know
NM-03 NM-05 RS-05                                        → kpi
FA-01 FA-02 FA-03 FA-04 FA-05 GN-01 GN-02                → exp
DC-05 DC-07                                              → req
PT-02 PT-03 RS-01 RS-02 RS-03 RS-04                      → watch
GN-03 NM-02 PT-01 PT-06 PT-07                            → vend
GN-05 LG-01                                              → '*'
CV-03 CV-04 DC-04 DC-06 EN-01 EN-02 EN-03 KN-01 KN-02
KN-05 KN-06 KN-07 KN-08 NM-04 QA-01 QA-02 QA-03 QA-04    → 'out'
```

`'out'` の理由（`POUT`。ポータル側・日本語。いまのモックの文言をそのまま移す）：

```
KN-01 顧客の業務（青嶺精工の技術ナレッジ）   KN-02 顧客の業務（設備マニュアル）
KN-05 顧客の業務（当局通達の反映）           KN-06 顧客の業務（銀行の事務手続）
KN-07 顧客の業務（行内営業情報）             KN-08 顧客の業務（当局通達DB）
CV-03 顧客の業務（審査コメント）             CV-04 顧客の業務（KYC）
QA-01 顧客の業務（製造の品質）               QA-02 顧客の業務（4M 変更管理）
QA-03 顧客の業務（クレーム対応）             QA-04 顧客の業務（工程監査）
DC-04 顧客の業務（工場の掲示物）             DC-06 顧客の業務（通関書類）
NM-04 顧客の業務（在庫・納期）
EN-01 顧客の業務（仕様改訂）                 EN-02 顧客の業務（BOM）
EN-03 顧客の業務（図面）
```

## 付録 B. `PT` に足す 29 キー（ja / zh / en の全文）

> **⚠️ rev2：`borrowed` は廃止し、`scriptWorldRow` / `scriptWorldPlain` の 2 キーに置き換えた（§14-7）。
> 下の表の `borrowed` の行は読み飛ばすこと。28 − 1 ＋ 2 ＝ 29 キー。**

既存の `L`（ナビ 15・グループ 4・ブランド 3・環境 2・ロール 1・本番 1・テーマ 1 ＝ 27 キー）は
すでに 3 言語揃っているので**そのまま `PT` に改名するだけ**。以下は §5 で足す分。

| key | ja | zh | en |
|---|---|---|---|
| `ctxHead` | この画面から渡す文脈 | 本画面传递的上下文 | Context passed from this screen |
| `ctxNote` | 画面の行から自動で入ります。打ち直しは要りません | 自动取自画面中的行，无需重新输入 | Filled in automatically from the row — no retyping |
| `ctxNoRow` | 行から呼ぶと、案件 id と顧客名も一緒に渡ります | 从行调用时，项目编号与客户名称也会一并传递 | Call it from a row and the project id and customer name are passed too |
| `autoFilled` | この画面から | 来自本画面 | From this screen |
| `inputHead` | 入力 | 输入 | Input |
| `runLive` | この内容で実行 | 按此内容执行 | Run with this |
| `runMock` | 想定の動きを見る | 查看预期的动作 | See the intended behaviour |
| `runDone` | 実行しました | 已执行 | Done |
| `resultHead` | 結果 | 结果 | Result |
| `keepResult` | この結果を画面に残す | 将此结果留在画面上 | Keep this result on the screen |
| `kept` | 画面に残しました | 已留在画面上 | Kept on the screen |
| `rowBack` | AI の戻り | AI 的返回 | AI result |
| `rowBackOpen` | 開く | 打开 | Open |
| `askHead` | 続けて聞く | 继续提问 | Ask more |
| `chipsLabel` | 質問例 | 提问示例 | Examples |
| `chipJa` | 日本語 | 日语 | Japanese |
| `chipZh` | 中文 | 中文 | Chinese |
| `send` | 送信 | 发送 | Send |
| `chatPh` | 日本語でも中国語でも入力できます | 日文中文均可输入 | Type in Japanese or Chinese |
| `demoDone` | 台本はここまでです | 脚本到此结束 | End of the script |
| `scriptLangNote` | 台本は日本語と中国語だけです。エージェント本体は入力した言語で返します | 脚本仅有日文与中文。智能体会按输入的语言回复 | Scripts exist in Japanese and Chinese only; the agent replies in the language you type |
| `borrowed` | この台本は{ind}向けのものを流用しています | 此脚本借用自面向{ind}的内容 | This script is borrowed from the {ind} catalog |
| `noScript` | このサービスには台本を用意していません。渡すもの・返るものだけを出します | 此服务尚未准备脚本，仅展示输入与输出的设想 | No script for this service — only the intended input and output are shown |
| `noPlace` | 置き場所を決めていない | 尚未确定放置位置 | No screen assigned yet |
| `uploadNote` | 本番では、この行に付いている添付をそのまま渡します | 正式环境下将直接传递此行的附件 | In production the attachment on this row is passed as-is |
| `openCatalog` | カタログを開く | 打开服务目录 | Open the catalog |
| `screenAi` | この画面の AI | 本画面的 AI | AI on this screen |
| `crossAi` | 横断で使う AI | 跨画面使用的 AI | AI used across screens |

> `borrowed` の `{ind}` には `INDUSTRIES[].name`（3 言語）を差し込む。
> `en` にかな（ひらがな・カタカナ）は 1 文字も無い（verify §17-e が検査する）。

---

# §14. rev2 — 業種フィルタの矛盾の解消と、台本の業種の規則（2026-09-11）

> **⚠️ 2026-09-12 追記：本節の【規則 1】（§14-2）と【規則 2】（§14-3）は rev4 で撤回された。規則 3〜6 は維持（規則 3 は fallback だけ精密化）。現行版は §16 が指す `docs/handoff/2026-09-12-portal-industry-rev4.md` §2 である。**

> **この節が §4-4・§5-7・AC-16・AC-24 の現行版。**上の §4-4 の式と §5-7 の `pscn()` は
> **rev1 の記述であり、この節で改訂された**（読むときは §14 を正とする）。
> 経緯：PR-1（#252）・PR-2（#260）のマージ後、reviewer が §4-4 の式と AC-16 の矛盾を指摘した。
> PR-3（台本の実行ドロワー）に着手する前に、ここで確定させる。

## 14-1. 何が矛盾していたか

| | rev1 の記述 |
|---|---|
| §4-4 の式 | `SVCS.filter(s => s.place === 画面id && s.industries に ポータルの業種 が含まれる)` |
| AC-16 | 「12 画面それぞれで **§4-5 の件数**（業種で分けていない件数）と一致する」 |

業種で絞れば件数は §4-5 と一致しない。**両立しない。**
#260 の implementer は AC-16 を満たす側（`place === screenId` のみ）を実装した（`mock/js/portal/app.js` の
`pscreenAiIds()` / `pcrossAiIds()`）。**この実装が正しい。§4-4 の式のほうを改訂する。**

## 14-2. 【規則 1】「この画面の AI」は業種で絞らない

**改訂後の式（§4-4 を置き換える）**

```
その画面の AI = SVCS.filter(s => s.place === 画面id)
                並び順: st 昇順（提供中 → 試行版 → 構想） → 管理番号昇順
                末尾に PSCREENS[].newai（PNEW の未採番候補）
ホームの「横断で使う AI」 = SVCS.filter(s => s.place === '*')  ／ 並び順は同じ
```

**理由（4 つ）**

1. **`industries` と `place` は意味の違う軸である。**
   `industries` は「**カタログを**どの顧客業種のメニューとして見せるか」。
   `place` は「**翠雲システムズの部門ポータルの**どの画面に出るか」。
   自部門は 1 つしかないので、自部門のポータルの画面構成が顧客業種で変わるのはおかしい。
   2 つの軸を掛け算した瞬間に意味が壊れる。

2. **実測で壊れる。**`main`（IT 業マージ後、77 サービス）で業種フィルタを入れると：

   | 画面 | 全件 | mfg | fin | **it** |
   |---|---|---|---|---|
   | 顧客 `cust` | 1 | 0 | 1 | **0** |
   | 案件 `proj` | 6 | 4 | 4 | **2** |
   | To Do `act` | 2 | 2 | 1 | **1** |
   | 要員 `ppl` | 3 | 3 | 1 | **1** |
   | 研修・サーベイ `trn` | 5 | 5 | 3 | **3** |
   | 会議 `meet` | 3 | 3 | 2 | **2** |
   | ナレッジ `know` | 4 | 4 | 1 | **1** |
   | KPI `kpi` | 3 | 2 | 1 | **0** |
   | 経費・経理 `exp` | 7 | 2 | 5 | **0** |
   | 申請・承認 `req` | 2 | 2 | 0 | **0** |
   | ニュース・ウォッチ `watch` | 6 | 2 | 4 | **0** |
   | 仕入先・パートナー `vend` | 5 | 5 | 0 | **0** |
   | 横断 `'*'` | 2 | 2 | 0 | **0** |
   | **合計** | **49** | 36 | 23 | **10** |

   自部門は IT 業なので、既定の業種で見ると **13 か所のうち 7 か所（顧客・KPI・経費経理・申請承認・
   ニュースウォッチ・仕入先パートナー・横断）が空になり、49 件が 10 件に落ちる。**
   PM がモックに書いた「ポータルから辿れる 49 件」という説明が成立しない。

3. **`.mockbar` の業種チップは「どの顧客業種のカタログを見ているか」の足場であって、
   自部門の画面構成の切替ではない。** ポータルの顧客は青嶺精工（製造）と碧洋銀行（金融）と α 社・β 社で、
   **同時に全部を相手にしている。**翠雲システムズの To Do 画面は、チップを動かしても同じである。

4. **#260 の実装がすでにこちら。**直すのは設計書の式 1 本だけで、コードは 1 行も動かさない。

## 14-3. 【規則 2】業種チップが変えるのは AI サービス画面だけ

```
.mockbar の業種チップ（製造 / 金融 / IT）が変えるもの
  ✔ AI サービス画面（scr-ai）の集計・内訳表・注記         … カタログの見え方を見せる画面だから
  ✘ 業務 13 画面の「この画面の AI」ブロック                … 規則 1
  ✘ 業務 13 画面のデータ（案件・顧客・要員・数字）        … 自部門は 1 つ
  ✘ 台本の選択                                            … 規則 3
```

`mock/js/portal/events.js` は業種切替で `#scr-ai` だけを再描画している。**この挙動が正しい。**
他の画面を再描画する必要はない（rev1 で「業種切替時に再描画していない」と指摘された点は、
**指摘ではなく仕様**として確定させる）。

## 14-4. 【規則 3】台本の業種は「行の世界」が決める（業種チップではない）

**`pscn()` の改訂（§5-7 を置き換える）**

```js
/* js/portal/app.js（PR-3） */
/** 行の世界：行の顧客がどの架空世界の会社か。行が無い／IT 世界の内側なら 'it' */
const pworldOf = (ctx) => (ctx && PWORLD[ctx.cu]) || 'it';

/** サービス id と呼び出しの文脈から、どの業種の台本を引くかを決める */
function pscn(svcId, ctx) {
  const svc = SVCS.find(s => s.id === svcId);
  if (!svc) return null;
  const order = [...new Set([ pworldOf(ctx), ...svc.industries, ...INDUSTRIES.map(i => i.id) ])];
  for (const k of order) {
    const s = (window.SCENARIOS[k] || {})[svcId];
    if (s) return { scn: s, from: k, want: pworldOf(ctx) };
  }
  return null;                       // 台本なし（§5-6 の分岐へ）
}
```

**候補の順番＝ ① 行の世界 → ② そのサービスが属する業種（宣言順） → ③ `INDUSTRIES` の宣言順。**
最初に当たったものを使う。**業種チップ（`pstate.ind`）は一切見ない。**

**なぜ「行の世界」が第一希望なのか**

ポータルは翠雲システムズの部門ポータルで、その**案件はすべて顧客の世界の仕事**である。
`P-2411 MES 更改 第2期 ／ 青嶺精工` の行で DC-08（報告レビュー）を押したとき、
**製造の台本（蘇州工場・TR-2024-007）が出るのは正しい**——報告する相手の仕事が製造だからである。
同じ DC-08 を `P-2418 与信ワークフロー刷新 ／ 碧洋銀行` の行で押せば金融の台本が出る。
**行がすでに世界を指しているので、業種チップに決めさせる必要がない。**
これは PR-3 の目的（「行の文脈が渡る」）そのものでもある。

**当てはめ**

| 呼び出し | 候補の順 | 使う台本 |
|---|---|---|
| 案件 `P-2411 ／ 青嶺精工` から DC-08 | `mfg, mfg, fin, it` | `SCENARIOS.mfg.dc8` |
| 案件 `P-2418 ／ 碧洋銀行` から DC-08 | `fin, mfg, fin, it` | `SCENARIOS.fin.dc8` |
| 案件 `O-2605 ／ α 社` から SL-01 | `it, it, mfg, fin` | `SCENARIOS.it.sl1`（#261 で投入） |
| 案件 `O-2605 ／ α 社` から DC-08 | `it, mfg, fin` | `it` に無ければ `mfg` |
| 「この画面の AI」ブロック（行なし）から CV-02 | `it, fin` | `SCENARIOS.fin.cv2` |
| 「この画面の AI」ブロック（行なし）から GN-05 | `it, mfg` | `SCENARIOS.mfg.gn5` |

**IT の台本が増えても壊れない**：`SCENARIOS.it` にサービスが足されると、IT 世界の行（α 社・β 社）と
行なしの呼び出しで自動的にそちらが勝つ。製造・金融の行は**そのまま製造・金融の台本を引き続ける**
（IT の台本に差し替わってしまわない）。**ポータルのコードは 1 行も直さない。**

## 14-5. 【規則 4】「行の世界」の正本は `data/world/it/clients.csv`

`data/world/it/clients.csv`（#255 で新設済み）が、すでに必要な列を持っている：

```
code,kind,ref_world,…
青嶺精工,customer,mfg,…
碧洋銀行,customer,fin,…
α 社,customer,,…        ← 空＝IT 世界の内側（外部世界を参照しない）
β 社,customer,,…        ← 同上
```

`mock/js/data/portal/org.js` に **`PWORLD`（顧客名 → 業種 id ／ 空なら `'it'`）** を置く。
**これは `ref_world` 列の写しであって、新しい世界の情報ではない**（§2-13：新しい名前・数字はマスタに足す。
ここでは足していない）。社名の 3 言語表記もポータルは持たない（`clients.csv` の note の通り、二重に持たない）。

```js
/* js/data/portal/org.js — data/world/it/clients.csv の ref_world 列の写し */
const PWORLD = { '青嶺精工': 'mfg', '碧洋銀行': 'fin', 'α 社': 'it', 'β 社': 'it' };
```

`clients.csv` に取引先が増えたら `PWORLD` も足す（verify §17-k が突き合わせる）。

## 14-6. 【規則 5】世界の語がポータルの画面に出ることの扱い

**規則 3 によって、世界の語の混在は「事故」ではなく「正しい状態」になる。**そのうえで 4 つ決める。

1. **ポータルのデータ層（`mock/js/data/portal/**`）は `data/world/it/` の語だけを使う。**
   翠雲システムズ／篠崎 悠真・黄 思涵・蔡 文博・村井 拓也・岸本 奈津／α 社・β 社／γ 社・δ 社・ε 社／
   `PJ-2026-014`・`PRP-2026-031` などの文書番号。
   青嶺精工・碧洋銀行は `clients.csv` に参照として登録済みなので**顧客名としては使ってよい**が、
   その世界の人名・拠点名・品番はポータルのデータ層に書かない（それは台本の側の持ち物）。

2. **台本の中の語は台本の世界のもの。ポータルは 1 文字も書き換えない。**
   `SCENARIOS[].script` / `input` / `result` に出る「蘇州工場」「SUS304」「TR-2024-007」は
   そのまま出す。`mock/js/data/scenarios/**` は読むだけ（AC-22）。

3. **`scn.persona` はポータルでは使わない**（rev1 §5-3 の違い #2 のとおり）。
   会話の主語は**ログイン中の利用者（岸本 奈津・PMO）**。したがって
   **王 磊（生産技術課 主任・蘇州工場）のような台本のペルソナがポータルの画面に出ることはない。**
   世界の語が出るのは**返答と結果の本文だけ**に閉じる。

4. **台本の世界と行の世界がずれているときだけ、ドロワーに 1 行出す**（規則 6）。
   ずれていないとき（青嶺精工の行 × 製造の台本）は当たり前なので**何も出さない**。

**`npm run world`（`tools/check-world.mjs`）の warn を増やさないこと**を PR-3 の受け入れ条件に入れる。
確認の対象はポータルのデータ層が `data/world/it/` の語だけを使っていること。

## 14-7. 【規則 6】代用の明示（新しい文言 2 つ）

| 条件 | 出すもの |
|---|---|
| 台本の世界（`from`）＝行の世界（`want`） | **何も出さない** |
| ずれている・**行から呼んだ** | `PT.scriptWorldRow` |
| ずれている・**行なし**（ブロックから呼んだ） | `PT.scriptWorldPlain` |

ドロワーの **② 入力の直前**（文脈カードのすぐ下）に、`.note` として 1 行。

| key | ja | zh | en |
|---|---|---|---|
| `scriptWorldRow` | この台本は{from}の世界のものです。この行の顧客（{cu}）は{want}なので、会話と結果に出る会社名・拠点・品番は台本の世界のものになります | 此脚本取自{from}的虚构世界。本行客户（{cu}）属于{want}，因此对话与结果中出现的公司名称、厂区与品号均来自脚本所在的世界 | This script comes from the {from} world. The customer on this row ({cu}) is {want}, so the company names, sites and part numbers in the conversation and result belong to the script's world |
| `scriptWorldPlain` | この台本は{from}の世界のものです。会話と結果に出る会社名・拠点・品番は台本の世界のものです | 此脚本取自{from}的虚构世界。对话与结果中出现的公司名称、厂区与品号均来自该世界 | This script comes from the {from} world. The company names, sites and part numbers in the conversation and result belong to that world |

`{from}` / `{want}` には `INDUSTRIES[].name`（3 言語）を差し込む。`{cu}` は行の顧客名（登録された言語のまま）。

**rev1 §5-7 の `PT.borrowed`（「この台本は{ind}向けのものを流用しています」）は廃止**し、上の 2 つに置き換える。
`PT.borrowed` を §付録 B から取り下げる（`PT` の新規キーは 28 → 29 になる）。

**出る頻度（`main` の実測）**

| 行の世界 | 置く 49 件のうち 台本の世界がずれる件数 |
|---|---|
| `mfg`（青嶺精工の 4 案件） | 13 件（残り 36 件は製造の台本がそのまま当たる） |
| `fin`（碧洋銀行の 4 案件） | 26 件（残り 23 件は金融の台本が当たる） |
| `it`（α 社・β 社の 2 案件、および行なし） | 49 件（`SCENARIOS.it` が空のため。#261 の投入後に減る） |

## 14-8. 未配置 10 件に `place` を付ける（PR-2b を新設）

IT 業のマージ（#255〜#259）で **10 件が `place` を持たないまま入った**。
verify §17-c が設計どおり warn を出している：

```
⚠️  置き場所を決めていない: GN-08, KN-09, KN-10, DC-10, PO-05, PO-06, PO-07, SL-01, SL-02, SL-03
```

**10 件はすべて翠雲システムズ自身の業務**（自部門の営業・要員・ナレッジ・KPI）で、
`'out'`（顧客自身の業務）ではない。**PR-3 の前に `place` を付ける。**

| 管理番号 | 名称 | `place` | 理由 |
|---|---|---|---|
| GN-08 | 名刺の読み取りと項目抽出 | `cust` | 顧客画面の「名刺から取り込み」。**`PNEW` の `new1`（名刺OCR・未採番）がこれとして採番された** |
| KN-09 | 取込文書の分類自動振り分け | `know` | ナレッジの分類 |
| KN-10 | 規程と現場運用の食い違い検出 | `know` | 全社規程と部門運用の突き合わせ |
| DC-10 | 予実差の理由の書き起こし | `kpi` | KPI 画面の数字に理由を付ける |
| PO-05 | 年休の取り残し検知と取得計画 | `ppl` | 要員画面の勤怠・年休 |
| PO-06 | 残業の偏りからの要員リスク検知 | `ppl` | 要員画面の稼働 |
| PO-07 | AI 利用実績からの削減時間の見積 | `kpi` | KPI 画面の「AI 活用」観点 |
| SL-01 | 引合の受注確度推定 | `proj` | パイプラインの確度（`lead` / `prop`） |
| SL-02 | 失注理由の蓄積と傾向分析 | `proj` | パイプライン |
| SL-03 | 過去提案の横断検索と再利用 | `proj` | パイプライン（`prop`） |

**あわせて `PNEW` を空にする。**`PNEW = ['new1']` と `PSCREENS` の `newai: ['new1']`（顧客画面）を削除し、
`PSVC` の `new1` エントリも削除する。GN-08 として採番されたので、未採番の候補ではなくなった
（rev1 §13 Q6 の「カタログに採番されたら `PNEW` から消して `SVCS` に `place` 付きで足す」がそのまま起きた）。

**PR-2b 後の件数（§4-5 の表の更新）**

| `place` | rev1（67 件時点） | **rev2（77 件時点）** | 増えた分 |
|---|---|---|---|
| `cust` | 1 | **2** | GN-08 |
| `proj` | 6 | **9** | SL-01 SL-02 SL-03 |
| `act` | 2 | 2 | |
| `ppl` | 3 | **5** | PO-05 PO-06 |
| `trn` | 5 | 5 | |
| `meet` | 3 | 3 | |
| `know` | 4 | **6** | KN-09 KN-10 |
| `kpi` | 3 | **5** | DC-10 PO-07 |
| `exp` | 7 | 7 | |
| `req` | 2 | 2 | |
| `watch` | 6 | 6 | |
| `vend` | 5 | 5 | |
| `'*'` | 2 | 2 | |
| **置く小計** | **49** | **59** | +10 |
| `'out'` | 18 | 18 | |
| **未配置** | 0 | **0** | |
| **合計** | 67 | **77** | +10 |

**`regress.mjs` の基準更新は 2 回目**（`--update` を 1 回）。差分は `SVCS.<id> place: (なし) → …` の **10 行だけ**。
`counts` は 1 つも変わらない（`cats:14, subs:33, svcs:77, tags:64, ui:91, byIndustry{mfg:49,fin:29,it:21}, svcsMulti:11`）。

## 14-9. `tools/verify.mjs` §17 への追加

| 枝番 | 検査 | 結果 |
|---|---|---|
| **17-c**（改訂） | 未配置（`place` キー無し）は warn。**PR-2b のマージ後は 0 件**。値域外は FAIL（現行のまま） | 変更なし |
| **17-k**（新規・PR-3） | `PWORLD` のキー集合が `PDEALS[].cu` の集合と**過不足なく一致**し、値が `INDUSTRIES` の id のいずれか。かつ `data/world/it/clients.csv` の `code` 列に全キーが存在し、`ref_world` が空でないものは `PWORLD` の値と一致する | FAIL |
| **17-l**（新規・PR-3） | ドロワーの台本解決に **`pstate.ind` が現れない**（`js/portal/demo.js` に `pstate.ind` の参照が無い＝規則 3 の機械的な担保）。`pscreenAiIds` / `pcrossAiIds` に `industries` の参照が無い（規則 1 の担保） | FAIL |

## 14-10. PR 分割の更新

| PR | 題 | 状態 |
|---|---|---|
| PR-1 | 取り込みと 4 層分け | **マージ済み（#252）** |
| PR-2 | `place` をカタログのデータ層へ | **マージ済み（#260）** |
| **PR-2b** | **未配置 10 件に `place` を付け、`PNEW` を空にする**（`mock/js/data/catalog.js` の 10 行＋`js/data/portal/{svc,ui}.js`＋`regress.baseline.json` の `--update` 1 回） | **新設。PR-3 の前** |
| PR-3 | 台本の実行ドロワー（§14-4〜14-7 の規則で） | 着手前 |
| PR-4 | 行への戻り／AI サービス画面の作り直し | |

**あわせて直す設計書の記述（PR-2b または PR-3 の PR 本文で引用する）**

| 節 | 直す内容 |
|---|---|
| §4-4 | 式から `&& s.industries に ポータルの業種 が含まれる` を削除 → §14-2 |
| §4-5 | 件数の表を 59＋18＝77 に更新 → §14-8 |
| §5-7 | `pscn()` を業種チップ起点から「行の世界」起点に差し替え → §14-4 |
| §13 Q4 | 「`data/world/` に昇格させない」は**撤回**。#255 で `data/world/it/` が新設され、翠雲システムズの世界は**そこが正本**になった。ポータルのデータ層はその写しである（§14-5・§14-6） |
| §13 Q6 | `PNEW` の `new1` は GN-08 として採番された。**解決済み** → §14-8 |
| 付録 B | `PT.borrowed` を削除し、`scriptWorldRow` / `scriptWorldPlain` を追加（28 → 29 キー） |

## 14-11. 受け入れ条件の更新

### PR-2b（新設）

- **AC-38** `mock/js/data/catalog.js` の diff が **`place:` の追加 10 行だけ**。`CATS` と他のフィールドに差分ゼロ
- **AC-39** `node tools/verify.mjs` の warn から「置き場所を決めていない」が**消える**（warn は 17 → 16 件）
- **AC-40** `regress` の差分が `SVCS.<id> place: (なし) → …` の **10 行だけ**。`counts` は 1 つも変わらない。PR 本文に「設計書 §14-8 のデータ変更に伴う基準更新」と書いてある
- **AC-41** ポータルの各画面の AI ブロックの件数が §14-8 の表と一致する（顧客 2・案件 9・要員 5・ナレッジ 6・KPI 5、他は据え置き）
- **AC-42** `PNEW` が空になり、`PSCREENS` の `newai` と `PSVC` の `new1` が消えている。顧客画面に「未採番」のボタンが出ない

### PR-3（更新。rev1 の AC-20〜AC-29 を次のように差し替え・追加）

- **AC-16（改訂）** 「この画面の AI」の件数が **§14-8 の表**と一致し、**業種チップを動かしても 1 件も変わらない**（13 画面 × 業種 3 通り＝ 39 通りで確認）
- **AC-20** 台本が動く：案件画面の `P-2411 ／ 青嶺精工` の行から DC-08 を開き、実行 → 結果 → 3 往復できる（rev1 のまま）
- **AC-21** 文脈が見えている：①に `P-2411` / 青嶺精工 / 篠崎 悠真 / 進行中 / 2026-10-31 / Red が出る。②の自動で入る欄に「この画面から」の印がある（rev1 のまま）
- **AC-22** `mock/js/data/scenarios/**` の diff が**ゼロ**（rev1 のまま）
- **AC-23** テンプレート 5 種がそれぞれ §5-5 のとおりに出る（rev1 のまま）
- **AC-24（差し替え）** **台本の業種が「行の世界」で決まる**：
  (a) `P-2411 ／ 青嶺精工` の DC-08 → **製造**の台本／(b) `P-2418 ／ 碧洋銀行` の DC-08 → **金融**の台本／
  (c) `O-2605 ／ α 社` の DC-08 → 製造の台本＋`PT.scriptWorldRow`／
  (d) 「この画面の AI」ブロック（行なし）から CV-02 → 金融の台本＋`PT.scriptWorldPlain`／
  (e) **(a)〜(d) のいずれも、業種チップを製造 / 金融 / IT に動かしても結果が変わらない**
- **AC-24b（新規）** `window.SCENARIOS.it = { dc8: {…} }` を手で足すと、**(c) だけ**が IT の台本に変わり、
  **(a)(b) は製造・金融の台本のまま**（IT の台本に差し替わらない）。確認後に戻す
- **AC-24c（新規）** `js/portal/demo.js` に **`pstate.ind` の参照が 1 つも無い**（verify §17-l）
- **AC-25** 英語：UI を `en` にしても台本は日本語で動き、`PT.scriptLangNote` が出る（rev1 のまま）
- **AC-26** `st !== 1` のサービスで「試行版です。実機はまだありません。…」がいまの文言で出る（rev1 のまま）
- **AC-27** 3 層が壊れていない（rev1 のまま）
- **AC-28** `Esc` と背景クリックで閉じ、呼び出したボタンにフォーカスが戻る（rev1 のまま）
- **AC-29** ドロワーを開いても後ろの画面のスクロール位置が飛ばない（rev1 のまま）
- **AC-43（新規）** **世界の語**：`P-2411 ／ 青嶺精工` の DC-08 の会話に蘇州工場などの製造の語が出ても
  **代用バナーが出ない**（台本の世界＝行の世界）。`P-2418 ／ 碧洋銀行` で製造の台本になるサービスでは
  **必ず `PT.scriptWorldRow` が出る**
- **AC-44（新規）** **ペルソナが出ない**：どのドロワーにも `scn.persona`（王 磊・劉 洋など）の名前・役職・拠点が
  **1 か所も描画されない**。会話の主語は岸本 奈津
- **AC-45（新規）** `PWORLD` のキーが `PDEALS[].cu` と過不足なく一致し、`data/world/it/clients.csv` の
  `ref_world` と矛盾しない（verify §17-k）
- **AC-46（新規）** `npm run world`（`tools/check-world.mjs`）の warn が**増えていない**

## 14-12. PM 判断待ち（rev2 で増えた分）

| # | 論点 | 推奨 |
|---|---|---|
| **Q9** | **未配置 10 件の `place`（§14-8 の表）を承認するか。**とくに PO-07（AI 利用実績からの削減時間の見積）は KPI 画面と AI サービス画面のどちらでもよい | **§14-8 の表のとおり。**PO-07 は **`kpi`**（削減時間は KPI の「業務改善・AI 活用」観点の数字だから。AI サービス画面はカタログの見え方を説明する画面で、業務の数字を置く場所ではない） |
| **Q10** | **業種チップの説明文言を変えるか。**規則 2 を決めた以上、チップの意味は「どの顧客業種のカタログを見るか」であって「ポータルの業種」ではない | **PR-3 で `.mockbar` のチップに 1 行の説明を足す**：「カタログの見え方を切り替えます（業務画面は変わりません）」。文言は PM 確認のうえ 3 言語で `PT` に入れる |
| **Q11** | **`GN-05`（汎用業務支援）と `LG-01`（日中コミュニケーション）が `industries` に `it` を持たない。**この 2 件は `place: '*'`（全画面）で、上海の IT 企業にこそ必要に見える | **カタログ側（IT 業設計）の判断。**この設計は業種で絞らないので**ポータルは影響を受けない**（規則 1）。IT 業の architect に申し送るだけにする |

## §15. 追補

### 15-1. AC-39 の誤記訂正（2026-09-11・Issue #270）

AC-39 の「warn は 17 → 16 件」は誤記。実際は 18 → 17（#264）。本文（§14-11）は据え置き。

### 15-2. ポータルの指標名はモックで確定（**PM 決定 2026-09-11・決定 3-①**）

**決定：ポータルの指標名（ナレッジ分類 46・KPI 観点 46・目標／MBO の項目名）は、モックの現行名で確定する。**
**`data/world/it/` に正本を置くときは、モック（`mock/js/data/portal/{common,mgmt}.js`）の名前をそのまま写す。**

つまり **この設計書のモック側が正本**であり、`docs/handoff/2026-09-10-portal-nocobase.md` §5-17-2・§5-18-3・§5-23-2 の
一覧は**案のまま残る**（同書 §11-16 の ⏳ はこの決定で解けた。記録は同書 §18-1）。

| 対象 | 正本（モック） | 確定した件数（main `4a4f3d1` で実走） |
|---|---|---|
| ナレッジの大分類・中分類 | `mock/js/data/portal/common.js` の **`PKNOW`** | 大分類 **12**（`C1`〜`C6` ＋ `D1`〜`D6`）／中分類 **46** |
| KPI の観点・指標 | `mock/js/data/portal/mgmt.js` の **`PKPITOPIC`** | 観点 **9**（`K1`〜`K9`）／指標 **52**（K1 7／K2 5／K3 6／K4 7／K5 7／K6 5／K7 5／K8 6／K9 4） |
| 目標（MBO）の観点 | `mock/js/data/portal/mgmt.js` の **`PGOAL.topics`** | **8**（`P1`〜`P7` ＋ `P0`） |

> **⚠️ 決定文の「KPI 観点 46」は nocobase 設計書 §5-18-3 の案の数である。**モックの現行値は **52**
> （`sys` 設計で K5 に**稼働率・MTTR** が足された分などを含む。`docs/handoff/2026-09-11-sysops-usecase.md` §6-7）。
> **「モックの現行名で確定」なので、52 が確定値。**

**この設計書に対する作業は発生しない。**

- **モックのリテラルは 1 バイトも変えない。**「モックが正本」と決まっただけである
- `PKNOW` / `PKPITOPIC` / `PGOAL` は **ja のみのリテラル**で、3 言語辞書ではない。`CLAUDE.md` §2-1 の対象は
  `PT`（ラベル辞書）だけ、という §7 の整理は**そのまま有効**。zh / en が要るのは NocoBase 実装側の
  `name_zh` / `name_en` 列であって、モックではない（§13 Q1 の「v1 は画面本文を訳さない」も維持）
- **名前を後から変えるときは、モック → `data/world/it/` → seed の順**（逆をやるとモックと画面が食い違う）

### 15-3. 400px 幅の横スクロールは今は直さない（**PM 決定 2026-09-11・決定 5**。既知の制限）

**決定：ポータルモックの狭幅（400px）での横スクロールは、今は直さない。**
**理由：これは PC でレビューするためのモックだから。**顧客にスマートフォンで見せる予定が立った時点で、
**M/L レーンの別 Issue** として対応する（レスポンシブは `portal.css` のグリッドと表の設計に触るので S では収まらない）。

**計測値（reviewer が記録したもの）**

| | 内容 |
|---|---|
| 事象 | ビューポート幅 **400px** で、ポータルの**全 15〜16 画面**に横スクロールが出る（`document.scrollWidth > 400`） |
| 計測値 | `scrollWidth` **418〜1272px**（画面によって幅が違う。最大は表の列が多い画面） |
| 初出 | **#252（PR-1）** から。つまり**ポータルを取り込んだ最初の PR からある既存事象**で、後続 PR が作り込んだものではない |
| 直近の確認 | **#271 で悪化していない**（画面が増えても最大値・件数ともに増えていない） |

**この節の扱い**

- **受け入れ条件ではない。**§12・§14-11 の AC に「狭幅で横スクロールしないこと」を**足さない**
- **reviewer は、この事象を理由に PR を止めない。**ただし **`scrollWidth` の最大値が 1272px を超えた**場合や、
  **新しい画面が広幅側に外れた**場合は「悪化」として PR 本文に書く（次に直すときの手掛かりになる）
- **`tools/verify.mjs` に検査を足さない**（DOM の実測は verify の担当ではない）

## §16. rev4 —— 部門ポータルの業種対応（2026-09-12・参照）

**rev4 の本体は別ファイル `docs/handoff/2026-09-12-portal-industry-rev4.md` にある。**
ポータルを「翠雲システムズ 1 社」から「業種ごとに会社が替わる 3 つの部門ポータル」にし、
フロント画面を業種別（製造＝品質・不具合／受注・出荷、金融＝与信・審査／当局対応・レポート、IT＝案件）にして、
共通・マネジメント・バックと顧客画面（→「取引先」）を業種テンプレートにする。
**本書 §14 の規則 1（画面の AI を業種で絞らない）と規則 2（業種チップは AI サービス画面だけを再描画する）は
rev4 §2 で撤回された**（規則 3〜6 は維持。規則 3 は `pworldOf()` の fallback を `'it'` 固定から
「表示中の業種」に精密化しただけ）。`SVCS[].place` は 27 件が付け替わり `'out'` は 0 件になる。
**本書 §0〜§15 の本文は rev4 では書き換えていない**ので、この §16 と rev4 §2 の対照表を正として読むこと。
