# 表示パターン ②ダッシュボード / ③業務フィード 実装設計書

- 日付：2026-09-06
- 作成：architect
- レーン：**M/L**（`T` キー追加・新データ定数 2 つ・`data-act` 1 つ追加・`PATTERNS[].ready` 変更・CSS 追加 → §2-1 / §2-2 / §2-3 / regress 基準に触る）
- 対象：`mock/catalog.html`、`tools/verify.mjs`（検証の拡張のみ）、`tools/regress.baseline.json`、`mock/README.md`
- 前提：A-1（#30）／B-1（#33）／A-2（#35）／B-2（#37）がマージ済み。現状は **8 分類 / 17 中分類 / 41 サービス / 43 タグ / T 49 キー / SCENARIOS 41 件**
- Issue 下書き：`docs/handoff/patterns-dash-feed.issue.md`

---

## 0. 目的 / 背景

`PATTERNS` の ② `dash` / ③ `feed` は `ready: false` のまま、`.mockbar` のセグメントが disabled、`renderMain` が `todoHTML(p)` でプレースホルダを出している。この 2 パターンを実装し、**同じカタログを 3 通りの入口で見比べられる**状態にする。

見せ方の役割分担（PM 既定方針。再検討しない）：

| | 誰に | 何を前面に |
|---|---|---|
| ① `nav` 階層ナビ | 目的が明確な人 | 分類 → 中分類 → サービス |
| ② `dash` ダッシュボード | **デモを見る工場長**（初めて使う人） | 全体像（件数・成熟度の内訳）・よく使われている・おすすめ |
| ③ `feed` 業務フィード | **実装後に使う担当者** | 期限・通知・定例・最近使った・担当分類 |

**業務メニューとジャンプ先の動きは 3 パターンで共通**。②③ からサービスを選んでも、同じ `detail` → `demo` に遷移する。`state` の形・`SVCS` / `SCENARIOS` のデータ形・既存 `data-act` の意味は変えない（§2-3）。

あわせて、PM 承認済みの追加要件として **サービスの「管理番号」表示**（`kn2` → `KN-02`）を ①②③ 共通で入れる（**§7B**）。これは②③ より先に単独 PR（PR-0）で実施する。

---

## 1. 変更する範囲

| ファイル | 箇所 | 変更 |
|---|---|---|
| `mock/catalog.html` | ヘルパー | **`pad2()` / `svcCode()` を追加**（管理番号の変換。§7B-1）。データも辞書も増やさない |
| `mock/catalog.html` | `cardHTML` | 1 行目を `.c-top`（`.c-crumb` ＋ `.code`）に変える（§7B-2）。**①②③ 共通の唯一の見た目変更** |
| `mock/catalog.html` | `renderMain` の `detail` 分岐 | `.d-crumb` と `<h1>` の間に `.code.d-code` を 1 行挿入（§7B-2）。ほかは変えない |
| `mock/catalog.html` | 2 つ目の `<style>` | `.code` / `.card .c-top` / `.d-code` を追加（§7B-3） |
| `tools/verify.mjs` | §6 データ整合 | `SVCS[].id` の形式と管理番号の重複を検査（§7B-5） |
| `mock/catalog.html` | `T` | UI キー **24 個追加**（② 12 / ③ 12。§4）。既存 49 キーの値は変えない |
| `mock/catalog.html` | `PATTERNS` | `dash.ready` `feed.ready` を `false → true`。`name` / `desc` / `id` / 並びは**変えない** |
| `mock/catalog.html` | `SCENARIOS` の直後 | 新定数 **`HOME`**（②用）と **`FEED`**（③用）を追加（§5） |
| `mock/catalog.html` | click ハンドラ | `data-act` に **`gocat` を 1 つだけ追加**（§3-3）。既存 12 種の挙動は不変 |
| `mock/catalog.html` | `renderMain` | 先頭に**ホーム分岐を 4 行挿入**（§3-2）。`list` 分岐に「ホームへ戻る」を条件付きで追加（§3-4）。`detail` / `chat` / `demo` の 3 分岐は**一切触らない** |
| `mock/catalog.html` | 描画関数 | `renderDash()` / `dashSectionsHTML()` / `renderFeed()` / `feedSectionsHTML()` / `bindHomeSearch()` を新設（§6・§7） |
| `mock/catalog.html` | 2 つ目の `<style>` | `.dash-*` / `.stat-*` / `.rank-*` / `.reco-*` / `.cat-row` / `.feed-*` / `.side-*` を追加（§8）。**トークンのみ、`#RRGGBB` 直値なし** |
| `mock/catalog.html` | `@media (max-width:1180px)` | 既存ブロックに `.feed-body` の 1 カラム化などを**追記**（§8-3）。既存の `.demo-body` / `.work-pane` 行は変えない |
| `tools/verify.mjs` | §7 | `requiredActs` に **`gocat`** を追加 |
| `tools/verify.mjs` | 新設 §10 | ホームデータ整合（`HOME` / `FEED` の id 参照・3 言語・値域）（§9-2） |
| `tools/regress.baseline.json` | — | `--update`（`patterns.*.ready` と `uiKeys` / `counts.ui`。§10） |
| `mock/README.md` | A 行 | 「①のみ実装、②③は Phase 2」→ 3 案とも実装（§11） |

### 1-1. 触らない範囲（reviewer の diff 監査基準）

**データ層**
- `CATS` / `SVCS` / `TAGS` / `TEMPLATES` / `SCENARIOS` — **1 文字も変えない**。②③ 用の情報を `SVCS[].featured` のようなフィールドで埋め込むことも禁止（§2-3 の流儀＝別定数）
- `PATTERNS` の `id` / `name` / `desc` / 並び（変えるのは `ready` の 2 か所だけ）
- `T` の既存 49 キーの**キー名も値も**変えない。**`todoEyebrow` / `todoTitle` は削除しない**（削除すると `regress` の `uiKeys` に余計な差分が出る）

**共通レイヤー（§2-3）**
- `state` の 11 キー（`pattern` `lang` `theme` `openCats` `selCat` `selSub` `lastCat` `selSvc` `view` `query` `log`）— **キーを増やさない・意味を変えない**
- `view` の値集合 `list` / `detail` / `chat` / `demo` — **増やさない**
- 既存 `data-act` 12 種（`pattern` `all` `cat` `sub` `svc` `back` `backdetail` `start` `send` `run` `chip` `restart`）のハンドラ本文

**関数**
- `renderSidebar`（`state.pattern !== 'nav'` で空にする現行実装のまま。②③ はサイドバーを持たない → §12 の PM 判断 8）
- `renderSeg`（`ready` はデータ駆動なのでコード変更不要）
- `renderChrome` / `gridHTML` / `todoHTML` / `resultHTML` / `panelHTML` / `chipsHTML` / `addMsg` / `sendChat` / `filtered` / `detectLang` / `L` / `t` / `tag` / `countText` / `statusText` / `statusClass` / `scnOf` / `scriptLang` / `nextTurn` / `consume` / `loadPrefs` / `savePrefs` / `applyPrefs`
- `cardHTML` — **PR-0（§7B）の `.c-top` / `.code` 追加を除いて**変えない。PR-1 / PR-2 では 1 文字も触らない
- `renderMain` の `demo` / `chat` の 2 分岐（1 文字も触らない）。`detail` 分岐は **PR-0 の `.d-code` 1 行挿入のみ**（PR-1 / PR-2 では触らない）。`list` 分岐は §3-4 の 1 ブロックのみ

**その他**
- 1 つ目の `<style>`（トークン）。`--ntt-*` 不変。**dark 用トークンの追加もしない**（既存セマンティックトークンだけで描く）
- `.mockbar` の構造（§2-4：足場。②③ の有効化は `ready: true` だけで達成する）
- ヘッダー（`wordmark` / `appTitle` / `dept` / アバター / 言語切替 / テーマ切替）。③ のペルソナはヘッダーに出さない（§12 の PM 判断 5）
- `localStorage` キー `mock.lang` / `mock.theme`
- `tools/regress.mjs` のロジック（baseline の更新のみ）
- `.github/workflows/pages.yml` / `mock/.nojekyll` / `mock/index.html` / `mock/top.html`
- `CLAUDE.md`（§13 に記載。**PM が更新する**）

---

## 2. 現状の確認（実装前スナップショット）

`node tools/regress.mjs` の `counts`：

```
{ cats: 8, subs: 17, svcs: 41, tags: 43, ui: 49 }
patterns: [ {nav,ready:true}, {dash,ready:false}, {feed,ready:false} ]
```

分類別の件数と成熟度内訳（②のダッシュボードが描く数字。実装後に画面と突き合わせる）：

| 分類 id | 名称（ja） | 件数 | 提供中(st1) | 試行版(st2) | 構想(st3) |
|---|---|---|---|---|---|
| kn | ナレッジ検索・問い合わせ | 5 | 3 | 2 | 0 |
| qa | 品質・不具合対応 | 4 | 0 | 3 | 1 |
| dc | 文書・資料作成 | 7 | 3 | 4 | 0 |
| lg | 日中コミュニケーション | 4 | 2 | 2 | 0 |
| nm | 見積・数字 | 5 | 1 | 3 | 1 |
| en | 図面・BOM・技術文書 | 3 | 0 | 2 | 1 |
| gn | 汎用業務支援 | 5 | 3 | 2 | 0 |
| pt | パートナー連携 | 8 | 0 | 3 | 5 |
| **合計** | | **41** | **12** | **21** | **8** |

これらは **`SVCS` から実行時に計算する**。定数として書き込まない（データが変わったら自動で追随すること）。

---

## 3. 共通レイヤーへの乗せ方（ここが本設計の肝）

### 3-1. 「ホーム」の定義 — `view` を増やさずに 3 パターンを分ける

`state.view` に値を足さない。代わりに **`view === 'list'` の「絞り込みが何も無い状態」＝ホーム**と定義し、そこだけパターンで描き分ける。

```
             view === 'list'                      view === 'detail' / 'chat' / 'demo'
   ┌────────────────────────────────────┐      ┌──────────────────────────────────┐
   │ atHome（selCat/selSub/query 全て空）│      │                                  │
   │   ① → すべてのサービス グリッド     │      │   ①②③ 完全に共通（既存のまま）    │
   │   ② → ダッシュボード                │      │                                  │
   │   ③ → 業務フィード                  │      │                                  │
   ├────────────────────────────────────┤      └──────────────────────────────────┘
   │ 絞り込みあり（分類 / 中分類 / 検索）│
   │   ①②③ 共通のグリッド                │
   │   ②③ のみ「‹ ホームへ戻る」を付ける │
   └────────────────────────────────────┘
```

- `atHome = !state.selCat && !state.selSub && !state.query.trim()`
- **パターンを切り替えても `selCat` / `selSub` / `selSvc` / `view` / `log` は保持される**（§2-3 の契約どおり）。したがって「① で品質分類を開いた状態で ② に切り替える」と、②でも品質分類のグリッドが出る。ダッシュボードを見るには「‹ ホームへ戻る」（＝既存 `all` act）を 1 回押す。**これは仕様**であり、reviewer はこの挙動を回帰と判定しない。
- 起動直後は `selCat=null / selSub=null / query=''` なので、② に切り替えた瞬間はダッシュボードが出る。

### 3-2. `renderMain` への挿入（4 行）

```js
function renderMain() {
  const el = document.getElementById('main');

  const pat = PATTERNS.find(p => p.id === state.pattern);
  if (pat && !pat.ready) { el.innerHTML = todoHTML(pat); return; }   // ← 残す（将来のパターン用）

  /* ▼ 追加：ホーム（絞り込みなしの list）だけパターンで描き分ける */
  const atHome = !state.selCat && !state.selSub && !state.query.trim();
  if (state.view === 'list' && atHome && state.pattern === 'dash') { renderDash(el); return; }
  if (state.view === 'list' && atHome && state.pattern === 'feed') { renderFeed(el); return; }
  /* ▲ 追加ここまで */

  if (state.view === 'list') { /* 既存のまま（§3-4 の 1 ブロックのみ追加） */ }
  else if (state.view === 'detail') { /* 既存のまま。1 文字も変えない */ }
  else if (state.view === 'demo')   { /* 既存のまま。1 文字も変えない */ }
  else { /* chat：既存のまま */ }
  el.scrollTop = 0;
}
```

`renderDash` / `renderFeed` は **`return` するので `el.scrollTop = 0;` を通らない**。各関数の末尾で `el.scrollTop = 0;` を自前で行うこと。

### 3-3. 追加する `data-act` は `gocat` の 1 つだけ（理由付き）

既存の `cat` act は**アコーディオンのトグル**である：

```js
else if (act === 'cat') {
  const open = !!state.openCats[arg];
  state.openCats[arg] = !open;
  if (!open) { state.selCat = arg; ... }     // ← 既に開いていると selCat を設定しない
  renderAll();
}
```

②③ のホームには分類タイル／担当分類リンクがあり、これを `cat` に割り当てると **`state.openCats[arg]` が既に `true` のとき（初期値 `{ kn: true }`、または ① から遷移してきた場合）クリックしても何も起きない**。かといって `cat` の中で `state.pattern` を見て分岐すると「パターン固有の都合で遷移を変える」ことになり §2-3 に反する。

そこで **トグルを持たない `gocat` を新設**する（`cat` からトグルを取り除いただけ。既存 `cat` は不変）。

```js
else if (act === 'gocat') {
  state.selCat = arg; state.selSub = null; state.lastCat = arg;
  state.openCats[arg] = true; state.view = 'list'; state.query = '';
  renderAll();
}
```

- `openCats[arg] = true` にするので、その後 ① に切り替えるとその分類が開いた状態で見える（選択位置の保持）。
- 中分類へのジャンプは**既存の `sub` act をそのまま使う**（`sub` はトグルを持たず安全）。本設計では中分類へのジャンプ導線は置かないが、将来増やすときも `sub` で足りる。
- サービスへのジャンプは**既存の `svc`**（→ `detail` → `start` → `demo`）。**②③ から直接 `demo` に飛ぶ act は作らない**（PM 既定方針 1）。

`data-act` は 12 種 → **13 種**になる。`verify.mjs` の `requiredActs` に追記する（§9-2）。

### 3-4. `list` 分岐に足す「ホームへ戻る」（②③ のみ）

②③ にはサイドバーが無いので、グリッドからホームに戻る導線が必要。既存 `.backlink`（詳細画面の「一覧へ戻る」と同じ見た目）を、`list-wrap` の先頭に条件付きで置く。**遷移は既存の `all` act をそのまま使う**（`selCat=null; selSub=null; view='list'`）。

```js
// list 分岐の el.innerHTML テンプレート冒頭
<div class="list-wrap" data-screen-label="サービス一覧">
  ${state.pattern !== 'nav' ? `<button class="backlink" data-act="all"><span class="arrow"></span>${esc(t('backHome'))}</button>` : ''}
  <div class="list-head"> ... 既存のまま ... </div>
```

`state.pattern !== 'nav'` のガードにより **① の見た目・DOM は完全に不変**（回帰ゼロ）。

`all` act は `state.query` を消さないため、検索中に「ホームへ戻る」を押すと query が残ってホームに戻れない。**`all` は触らない**方針なので、②③ の「ホームへ戻る」ボタンには `data-act="all"` に加えて検索欄をクリアする必要がある —— これを避けるため、**`list` 分岐の検索ハンドラを次のようにする**（§3-5）。

### 3-5. 検索の扱い（IME を壊さない）

②③ のホームにも検索欄を置く（`id="search"`、① と同じ `.search` クラス）。**ホーム全体を再描画すると日本語 IME の変換が壊れる**ため、① と同じ「差し替え方式」にする。

```js
/** ②③ ホームの検索欄を束ねる。sectionsFn() はホーム本体の HTML を返す関数 */
function bindHomeSearch(sectionsFn) {
  const s = document.getElementById('search');
  const h = document.getElementById('home-holder');
  if (!s || !h) return;
  s.addEventListener('input', () => {
    state.query = s.value;
    const q = state.query.trim();
    if (!q) { h.innerHTML = sectionsFn(); return; }      // 空に戻したらホームを復元
    const list = filtered();
    h.innerHTML = `<div class="home-count">${esc(countText(list.length))}</div>` + gridHTML(list);
  });
}
```

- `renderMain()` を呼ばないので **フォーカスもキャレットも IME 変換中の文字列も保持される**。
- 検索結果のカードは既存 `cardHTML`（`data-act="svc"`）なので、クリックすれば ①②③ 共通の詳細へ行く。
- 検索語を入れたまま言語切替 → `renderAll()` → `atHome` が false → **共通のグリッド画面**に移る（「ホームへ戻る」ボタン付き）。動作としては一貫しているので許容する。
- ① の `list` 分岐の検索ハンドラは**変更しない**。

---

## 4. 追加する `T` キー（24 個・ja / zh / en）

> implementer はこの節を**そのまま転記**する。翻訳・言い換えをしない。en はモック用ドラフト。
> 既存 49 キーの後ろに、②用ブロック → ③用ブロックの順で追記する。

### 4-1. ② ダッシュボード（12 キー）

```js
  /* ---- ② ダッシュボード（12 キー） ---- */
  dashWelcome:  { ja: 'AIエージェント ホーム', zh: 'AI智能体 首页', en: 'AI Agent Home' },
  dashLead:     { ja: '{c} 分類 {n} 件のエージェントを用意しています。よく使われているものから試せます。',
                  zh: '共 {c} 个分类 {n} 个智能体，可以从常用的开始试用。',
                  en: '{n} agents in {c} categories. Start with the ones most people use.' },
  statAll:      { ja: 'サービス総数', zh: '服务总数', en: 'All services' },
  dashFreq:     { ja: 'よく使われているエージェント', zh: '常用智能体', en: 'Most used agents' },
  dashFreqNote: { ja: '社内の利用実績（デモ用のサンプル値）', zh: '公司内使用情况（演示用示例数据）', en: 'Company-wide usage (sample figures for this demo)' },
  usesUnit:     { ja: '今月 {n} 件', zh: '本月 {n} 次', en: '{n} runs this month' },
  dashReco:     { ja: 'おすすめ', zh: '推荐', en: 'Recommended' },
  dashRecoNote: { ja: '初めての方はここから', zh: '初次使用可从这里开始', en: 'A good place to start' },
  recoWhy:      { ja: 'おすすめの理由', zh: '推荐理由', en: 'Why' },
  dashCats:     { ja: '分類から見る', zh: '按分类查看', en: 'Browse by category' },
  dashCatsNote: { ja: 'バーは成熟度の内訳（提供中／試行版／構想）', zh: '柱状条显示成熟度构成（已上线／试用版／构想）', en: 'The bar shows the maturity mix (available / trial / concept)' },
  backHome:     { ja: 'ホームへ戻る', zh: '返回首页', en: 'Back to home' },
```

`{c}` = `CATS.length`、`{n}` = `SVCS.length`、`usesUnit` の `{n}` = `HOME.frequent[].uses`。置換は既存 `chatHello` と同じ `.replace('{n}', …)` 方式。

### 4-2. ③ 業務フィード（12 キー）

```js
  /* ---- ③ 業務フィード（12 キー） ---- */
  feedEyebrow:  { ja: 'MY WORK', zh: 'MY WORK', en: 'MY WORK' },
  feedTitle:    { ja: '今日の業務', zh: '今日工作', en: 'Today at work' },
  feedLead:     { ja: '期限・通知・定例から入ります。担当している業務だけが並びます。',
                  zh: '从期限、通知、例行工作进入，只显示与您相关的业务。',
                  en: 'Enter from deadlines, notices and routines. Only your own work is listed.' },
  feedAction:   { ja: '対応が必要', zh: '需要处理', en: 'Needs action' },
  feedRoutine:  { ja: '定例の業務', zh: '例行工作', en: 'Routine work' },
  feedNotice:   { ja: 'お知らせ', zh: '通知事项', en: 'Notices' },
  kindDue:      { ja: '期限', zh: '期限', en: 'Due' },
  kindNotify:   { ja: '通知', zh: '通知', en: 'Notice' },
  kindRoutine:  { ja: '定例', zh: '例行', en: 'Routine' },
  feedOpen:     { ja: '開く', zh: '打开', en: 'Open' },
  feedMine:     { ja: '担当分類', zh: '负责分类', en: 'My categories' },
  feedRecent:   { ja: '最近使った', zh: '最近使用', en: 'Recently used' }
```

「デモ用のサンプルである」旨の注記は、③ では**既存の `mockNote`** をそのまま使う（キーを増やさない）。

---

## 5. 追加するデータ定数（`SVCS` に埋め込まない）

配置：`SCENARIOS` の閉じ括弧の直後、`/* 3. 状態（共通レイヤー） */` の前。

> **`grab()` 対策（必須）**：`verify.mjs` / `regress.mjs` は `const NAME = ( [ … \n] | { … \n} );` の正規表現でリテラルを取り出す。
> **`HOME` / `FEED` の閉じ括弧 `};` は必ず行頭（インデント 0）に置き、途中の行に行頭 `}` や `]` を作らない**こと。

### 5-1. `HOME`（② 用）

```js
/* ============================================================
   2c. ② ダッシュボードのホーム用データ
   frequent[].uses は「社内利用実績のサンプル値」。実データではない（画面に注記を出す）。
   SVCS に埋め込まず別定数にする（§2-3 の流儀。SCENARIOS と同じ）
   ============================================================ */
const HOME = {
  frequent: [
    { id: 'kn1', uses: 312 },
    { id: 'lg1', uses: 268 },
    { id: 'dc2', uses: 214 },
    { id: 'nm3', uses: 186 },
    { id: 'qa1', uses: 147 },
    { id: 'kn3', uses: 132 }
  ],
  recommended: [
    { id: 'dc1',
      why: { ja: '現場の数字から本社向け報告の下書きまで一気に作れます。効果が最初に見えやすい業務です。',
             zh: '可以从现场数据一口气生成给总部的汇报草案，是最容易先看到效果的业务。',
             en: 'Turns plant figures into a draft report for headquarters in one step. The easiest place to see value first.' } },
    { id: 'kn2',
      why: { ja: '止まった設備の型式と症状を入れるだけ。紙のマニュアルを探す時間がなくなります。',
             zh: '只需输入停机设备的型号和现象，不必再翻纸质手册。',
             en: 'Just enter the model and symptom of the stopped machine. No more hunting through paper manuals.' } },
    { id: 'qa3',
      why: { ja: '顧客からの一報に、その日のうちに一次回答を返せます。分類も記録に残ります。',
             zh: '客户来函当天即可给出初步答复，分类结果也会留存记录。',
             en: 'Send a first reply to a customer complaint the same day, with the classification kept on record.' } }
  ]
};
```

参照サービス（すべて `SVCS` に存在すること）：`kn1` `lg1` `dc2` `nm3` `qa1` `kn3` `dc1` `kn2` `qa3`（9 件・重複なし）。

### 5-2. `FEED`（③ 用）

```js
/* ============================================================
   2d. ③ 業務フィードのホーム用データ
   items は「担当者の今日の仕事」を表す疑似イベント。すべてデモ用のサンプル。
   絶対日付は書かない（デモ日が変わっても古びないよう相対表現だけにする）
   kind: 'due'（期限あり）/ 'routine'（定例）/ 'notify'（お知らせ）
   タイトル・成熟度・分類は SVCS から引くので、ここには持たせない
   ============================================================ */
const FEED = {
  persona: { name: { ja: '李 強', zh: '李强', en: 'Li Qiang' },
             role: { ja: '製造二課 課長', zh: '制造二科 科长', en: 'Manufacturing Sec. 2 Manager' },
             site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' } },
  mine:   ['qa', 'dc', 'nm'],
  recent: ['lg1', 'dc2', 'kn1', 'gn5'],
  items: [
    { id: 'qa1', kind: 'due',
      when: { ja: '本日 17:00 まで', zh: '今天 17:00 前', en: 'Today, by 17:00' },
      note: { ja: 'ライン3 の寸法不良。顧客への提出は明日 10:00。',
              zh: '3号线尺寸不良，明天 10:00 前需提交给客户。',
              en: 'Dimensional defect on line 3. Due to the customer tomorrow at 10:00.' } },
    { id: 'dc5', kind: 'due',
      when: { ja: '明日まで', zh: '明天前', en: 'By tomorrow' },
      note: { ja: '乾燥炉の更新稟議。金額区分が変わり差し戻しになっています。',
              zh: '烘干炉更新审批。金额档次变更后被退回。',
              en: 'Approval request for the drying oven. Returned because the amount tier changed.' } },
    { id: 'qa2', kind: 'due',
      when: { ja: '今週中', zh: '本周内', en: 'This week' },
      note: { ja: '治具の切り替えを 9/15 に予定。先に影響範囲を確認します。',
              zh: '计划 9/15 更换治具，需先确认影响范围。',
              en: 'The jig changeover is planned for Sep 15. Check the impact first.' } },
    { id: 'nm3', kind: 'routine',
      when: { ja: '毎日 8:30', zh: '每天 8:30', en: 'Daily at 8:30' },
      note: { ja: '前日の生産実績と不良件数を朝会用にまとめます。',
              zh: '把前一天的产量与不良件数整理成早会材料。',
              en: 'Summarise output and defect counts from the previous day for the morning meeting.' } },
    { id: 'lg3', kind: 'routine',
      when: { ja: '毎週月曜', zh: '每周一', en: 'Every Monday' },
      note: { ja: '今週の作業変更点を現場向けの中国語に書き下します。',
              zh: '把本周作业变更点写成现场用中文。',
              en: 'Rewrite the changes for this week into Chinese for the shop floor.' } },
    { id: 'kn5', kind: 'notify',
      when: { ja: '新着', zh: '最新', en: 'New' },
      note: { ja: '地方当局の排水基準通達が公布されました。該当手順の確認依頼が来ています。',
              zh: '地方主管部门发布了排水标准通知，已收到相关作业确认请求。',
              en: 'A local authority notice on wastewater limits was issued. A review of the related procedures is requested.' } },
    { id: 'en1', kind: 'notify',
      when: { ja: '新着', zh: '最新', en: 'New' },
      note: { ja: '取引先の仕様書が Rev.C に更新されました。差分の確認をおすすめします。',
              zh: '客户规格书已更新为 Rev.C，建议确认差异。',
              en: 'A customer specification moved to Rev.C. Reviewing the differences is recommended.' } }
  ]
};
```

参照サービス：`qa1` `dc5` `qa2` `nm3` `lg3` `kn5` `en1`（items 7 件）＋ `lg1` `dc2` `kn1` `gn5`（recent 4 件）。参照分類：`qa` `dc` `nm`。すべて `SVCS` / `CATS` に存在する。

**文字列の約束**：`'`（U+0027）を使わない（JS の引用符と衝突する）。en も所有格アポストロフィを避けた表現にしてある。

---

## 6. ② ダッシュボードの画面設計

### 6-1. レイアウト（デスクトップ / 幅 1181px 以上・サイドバーなし）

```
┌ .mockbar  [① 階層ナビ][② ダッシュボード][③ 業務フィード]        ← 足場（構造は変えない） ┐
├ .hdr      青嶺精工 │ AIエージェントカタログ        情報システム部 [日▾][◐]              ┤
├ .body ────────────────────────────────────────────────────────────────────────────────┤
│ （サイドバーなし。main が全幅）                                                          │
│ ┌ .dash-wrap  padding: 32px 36px 48px ────────────────────────────────────────────────┐ │
│ │ .crumb  AI AGENT CATALOG                                                            │ │
│ │ .dash-hero                                                                          │ │
│ │   h1  AIエージェント ホーム                          ┌ .search 280px ───────────┐    │ │
│ │   p   8 分類 41 件のエージェントを用意しています…      │ サービスを検索           │    │ │
│ │                                                     └──────────────────────────┘    │ │
│ │ ┌ #home-holder ─────────────────────────────────────────────────────────────────┐   │ │
│ │ │ .stat-strip   grid auto-fit minmax(160px,1fr) gap 16px                        │   │ │
│ │ │  ┌────────┐┌────────┐┌────────┐┌────────┐                                     │   │ │
│ │ │  │  41    ││ ● 12   ││ ● 21   ││ ● 8    │   ← .stat-n 28px bold               │   │ │
│ │ │  │サービス││ 提供中 ││ 試行版 ││ 構想   │   ← .stat-l 12px secondary          │   │ │
│ │ │  │ 総数   ││        ││        ││        │                                     │   │ │
│ │ │  └────────┘└────────┘└────────┘└────────┘                                     │   │ │
│ │ │                                                                               │   │ │
│ │ │ .dash-sec ── よく使われているエージェント     社内の利用実績（デモ用のサンプル値）│   │ │
│ │ │ ┌ .rank-grid  auto-fill minmax(300px,1fr) gap 16px ─────────────────────────┐ │   │ │
│ │ │ │ ┌ .rank-item ───────┐ ┌ .rank-item ───────┐ ┌ .rank-item ───────┐        │ │   │ │
│ │ │ │ │ ①      今月 312 件│ │ ②      今月 268 件│ │ ③      今月 214 件│  ← .rank-h│   │ │
│ │ │ │ │┌ .card (既存) ───┐│ │┌ .card ─────────┐│ │┌ .card ─────────┐│        │ │   │ │
│ │ │ │ ││ ナレッジ・技術  ││ ││ 日中・翻訳     ││ ││ 文書・報告     ││        │ │   │ │
│ │ │ │ ││ 技術ナレッジQA  ││ ││ 日中翻訳…      ││ ││ 議事録作成…    ││        │ │   │ │
│ │ │ │ ││ 過去の設計書…   ││ ││ …              ││ ││ …              ││        │ │   │ │
│ │ │ │ ││ ●提供中 [検索]  ││ ││ ●提供中 […]    ││ ││ ●提供中 […]    ││        │ │   │ │
│ │ │ │ │└─────────────────┘│ │└────────────────┘│ │└────────────────┘│        │ │   │ │
│ │ │ │ └───────────────────┘ └──────────────────┘ └──────────────────┘  ×6     │ │   │ │
│ │ │ └───────────────────────────────────────────────────────────────────────────┘ │   │ │
│ │ │                                                                               │   │ │
│ │ │ .dash-sec ── おすすめ                              初めての方はここから        │   │ │
│ │ │ ┌ .reco-grid  auto-fill minmax(300px,1fr) ────────────────────────────────┐   │   │ │
│ │ │ │ ┌ .reco-item ─────────┐ …×3                                            │   │   │ │
│ │ │ │ │┌ .card (既存) ─────┐│                                                 │   │   │ │
│ │ │ │ ││ 日本本社への報告… ││                                                 │   │   │ │
│ │ │ │ │└───────────────────┘│                                                 │   │   │ │
│ │ │ │ │ .r-why                                                                │   │   │ │
│ │ │ │ │  おすすめの理由 現場の数字から本社向け報告の下書きまで…                │   │   │ │
│ │ │ │ └─────────────────────┘                                                 │   │   │ │
│ │ │ └─────────────────────────────────────────────────────────────────────────┘   │   │ │
│ │ │                                                                               │   │ │
│ │ │ .dash-sec ── 分類から見る          バーは成熟度の内訳（提供中／試行版／構想）  │   │ │
│ │ │ ┌ .cat-row  data-act="gocat" data-arg="kn" ───────────────────────────────┐   │   │ │
│ │ │ │ ナレッジ検索・問い合わせ    5件のサービス   ███████████░░░░░░░  3 / 2 / 0│   │   │ │
│ │ │ └─────────────────────────────────────────────────────────────────────────┘   │   │ │
│ │ │ ┌ .cat-row  ... ×8（CATS の順）                                            ┐  │   │ │
│ │ │ └─────────────────────────────────────────────────────────────────────────┘   │   │ │
│ │ └───────────────────────────────────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### 6-2. レイアウト（幅 1180px 以下）

サイドバーが無いので崩れる箇所はほとんど無い。`grid auto-fit / auto-fill` が効いて 2 列 → 1 列に落ちる。追加で必要な指定は `.dash-hero` の縦積みのみ。

```
┌ .dash-wrap ────────────────────────┐
│ AI AGENT CATALOG                   │
│ AIエージェント ホーム               │   ← .dash-hero が flex-direction: column
│ 8 分類 41 件の…                     │
│ ┌ .search  width:100% ───────────┐ │      （検索欄は全幅）
│ └────────────────────────────────┘ │
│ ┌ 41 ┐┌ 12 ┐                       │   ← .stat-strip は 2 列
│ └────┘└────┘                       │
│ ┌ 21 ┐┌ 8  ┐                       │
│ └────┘└────┘                       │
│ よく使われているエージェント          │
│ ┌ .rank-item（1 列）──────────────┐│
│ └─────────────────────────────────┘│
│ …                                  │
│ ┌ .cat-row（成熟度の内訳は折返し）─┐│
│ │ ナレッジ検索・問い合わせ  5件     ││
│ │ ███████████░░░░  3 / 2 / 0       ││
│ └──────────────────────────────────┘│
└────────────────────────────────────┘
```

### 6-3. 描画関数（実装の骨格）

```js
/** ② ダッシュボード：ホーム本体（検索で差し替える範囲） */
function dashSectionsHTML() {
  const n1 = SVCS.filter(x => x.st === 1).length;
  const n2 = SVCS.filter(x => x.st === 2).length;
  const n3 = SVCS.filter(x => x.st === 3).length;
  /* .stat-strip / .dash-sec ×3 を組み立てて返す
     - よく使う : HOME.frequent.map((f, i) => `<div class="rank-item">
                    <div class="rank-h"><span class="rank-n">${i + 1}</span>
                      <span class="rank-uses">${esc(t('usesUnit').replace('{n}', f.uses))}</span></div>
                    ${cardHTML(svcOf(f.id))}</div>`)
     - おすすめ : HOME.recommended.map(r => `<div class="reco-item">${cardHTML(svcOf(r.id))}
                    <div class="r-why"><span class="r-why-l">${esc(t('recoWhy'))}</span>${esc(L(r.why))}</div></div>`)
     - 分類     : CATS.map(c => .cat-row  data-act="gocat" data-arg="${c.id}")
                  各分類の st 内訳は SVCS から計算し、幅を style="width:NN%" で与える（0 件のセグメントは出さない）
  */
}

function renderDash(el) {
  el.innerHTML = `
  <div class="dash-wrap" data-screen-label="ダッシュボード">
    <div class="crumb">AI AGENT CATALOG</div>
    <div class="dash-hero">
      <div>
        <h1>${esc(t('dashWelcome'))}</h1>
        <p>${esc(t('dashLead').replace('{c}', CATS.length).replace('{n}', SVCS.length))}</p>
      </div>
      <input class="search" id="search" placeholder="${esc(t('searchPh'))}" value="${esc(state.query)}">
    </div>
    <div id="home-holder">${dashSectionsHTML()}</div>
  </div>`;
  bindHomeSearch(dashSectionsHTML);
  el.scrollTop = 0;
}
```

- `cardHTML` は**そのまま呼ぶ**（改変しない）。`.card` は既に `data-act="svc"` を持つのでクリックで詳細へ行く。
- 成熟度バーの色はクラスで与える（`.cat-bar .s-live / .s-trial / .s-concept`）。**インライン `style` は幅（%）だけ**。色は絶対にインラインで書かない。

### 6-4. ② のクリック → act マッピング

| クリック対象 | `data-act` | arg | 結果 |
|---|---|---|---|
| よく使う／おすすめのカード（`.card`） | `svc`（既存） | サービス id | `view='detail'`、`log=[]` → 既存の詳細 → `start` → `demo` |
| 分類の行（`.cat-row`） | **`gocat`（新規）** | 分類 id | `selCat` 設定・`view='list'` → 共通グリッド（「ホームへ戻る」付き） |
| 検索欄 | （act なし） | — | `bindHomeSearch` が `#home-holder` を差し替える |
| `.mockbar` のセグメント | `pattern`（既存） | `nav`/`dash`/`feed` | 選択位置を保ったままパターン切替 |

**新規 act は `gocat` の 1 つだけ。**

---

## 7. ③ 業務フィードの画面設計

### 7-1. レイアウト（デスクトップ / 幅 1181px 以上・サイドバーなし）

```
├ .body ────────────────────────────────────────────────────────────────────────────────┤
│ ┌ .feed-wrap  padding: 32px 36px 48px ────────────────────────────────────────────────┐ │
│ │ .feed-head                                                                          │ │
│ │  MY WORK                                                ┌ .search 280px ────────┐   │ │
│ │  今日の業務                                              │ サービスを検索        │   │ │
│ │  期限・通知・定例から入ります。担当している業務だけが…     └───────────────────────┘   │ │
│ │  (李) 李 強 ／ 製造二課 課長 ・ 蘇州工場   ※ 本画面はコンセプト確認用のモックです      │ │
│ │ ┌ #home-holder ─────────────────────────────────────────────────────────────────┐   │ │
│ │ │ .feed-body   grid-template-columns: minmax(0,1fr) 300px; gap: 32px            │   │ │
│ │ │ ┌ .feed-main ───────────────────────────┐ ┌ .feed-side ───────────────────┐  │   │ │
│ │ │ │ ■ 対応が必要                    ③     │ │ ┌ .side-box ────────────────┐ │  │   │ │
│ │ │ │ ┌ .feed-item  data-act="svc" ───────┐ │ │ │ 担当分類                  │ │  │   │ │
│ │ │ │ │ [期限] 本日 17:00 まで            │ │ │ │ ─────────────────────────  │ │  │   │ │
│ │ │ │ │ 不具合原因分析・報告書（8D）作成   │ │ │ │ 品質・不具合対応       4  │ │  │   │ │
│ │ │ │ │ ライン3 の寸法不良。顧客への提出は │ │ │ │ 文書・資料作成         7  │ │  │   │ │
│ │ │ │ │ 明日 10:00。                     │ │ │ │ 見積・数字             5  │ │  │   │ │
│ │ │ │ │ 品質・不具合対応 ●試行版   開く ›  │ │ │ │   ↑ .side-link            │ │  │   │ │
│ │ │ │ └───────────────────────────────────┘ │ │ │     data-act="gocat"      │ │  │   │ │
│ │ │ │ ┌ .feed-item（dc5）────────────────┐ │ │ └───────────────────────────┘ │  │   │ │
│ │ │ │ └───────────────────────────────────┘ │ │ ┌ .side-box ────────────────┐ │  │   │ │
│ │ │ │ ┌ .feed-item（qa2）────────────────┐ │ │ │ 最近使った                │ │  │   │ │
│ │ │ │ └───────────────────────────────────┘ │ │ │ ────────────────────────  │ │  │   │ │
│ │ │ │                                       │ │ │ ● 日中翻訳（社内の…）      │ │  │   │ │
│ │ │ │ ■ 定例の業務                    ②     │ │ │ ● 議事録作成と次回論点…    │ │  │   │ │
│ │ │ │ ┌ .feed-item（nm3）────────────────┐ │ │ │ ● 技術ナレッジQA          │ │  │   │ │
│ │ │ │ └───────────────────────────────────┘ │ │ │ ● 文書要約                │ │  │   │ │
│ │ │ │ ┌ .feed-item（lg3）────────────────┐ │ │ │   ↑ .side-link            │ │  │   │ │
│ │ │ │ └───────────────────────────────────┘ │ │ │     data-act="svc"        │ │  │   │ │
│ │ │ │                                       │ │ └───────────────────────────┘ │  │   │ │
│ │ │ │ ■ お知らせ                      ②     │ │                               │  │   │ │
│ │ │ │ ┌ .feed-item（kn5）────────────────┐ │ │                               │  │   │ │
│ │ │ │ └───────────────────────────────────┘ │ │                               │  │   │ │
│ │ │ │ ┌ .feed-item（en1）────────────────┐ │ │                               │  │   │ │
│ │ │ │ └───────────────────────────────────┘ │ │                               │  │   │ │
│ │ │ └───────────────────────────────────────┘ └───────────────────────────────┘  │   │ │
│ │ └───────────────────────────────────────────────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────────────────────────────────┘ │
```

節見出しの右の数字（③②②）は `.sec-count`。件数は `FEED.items` から算出する（定数に持たない）。

### 7-2. レイアウト（幅 1180px 以下）

```
┌ .feed-wrap ─────────────────────────┐
│ MY WORK                             │
│ 今日の業務                          │
│ 期限・通知・定例から入ります。…      │
│ (李) 李 強 ／ 製造二課 課長・蘇州工場 │
│ ┌ .search width:100% ─────────────┐ │
│ └─────────────────────────────────┘ │
│ ■ 対応が必要                 ③      │   ← .feed-body が 1 カラム
│ ┌ .feed-item ────────────────────┐  │      （.feed-side は下に回る）
│ └────────────────────────────────┘  │
│ …                                   │
│ ■ お知らせ                   ②      │
│ ┌ .feed-item ────────────────────┐  │
│ └────────────────────────────────┘  │
│ ┌ .side-box 担当分類 ────────────┐  │
│ └────────────────────────────────┘  │
│ ┌ .side-box 最近使った ──────────┐  │
│ └────────────────────────────────┘  │
└─────────────────────────────────────┘
```

### 7-3. 描画関数（実装の骨格）

```js
const KIND_LABEL = { due: 'kindDue', notify: 'kindNotify', routine: 'kindRoutine' };

function feedItemHTML(it) {
  const x = svcOf(it.id), c = catOf(x.cat);
  return `
  <div class="feed-item ${it.kind}" data-act="svc" data-arg="${x.id}">
    <div class="fi-h">
      <span class="fi-kind ${it.kind}">${esc(t(KIND_LABEL[it.kind]))}</span>
      <span class="fi-when">${esc(L(it.when))}</span>
    </div>
    <div class="fi-title">${esc(L(x.name))}</div>
    <div class="fi-note">${esc(L(it.note))}</div>
    <div class="fi-foot">
      <span class="fi-cat">${esc(L(c.name))}</span>
      <span class="status"><span class="dot ${statusClass(x.st)}"></span>${esc(statusText(x.st))}</span>
      <span class="fi-open">${esc(t('feedOpen'))} ›</span>
    </div>
  </div>`;
}

/** ③ フィード：ホーム本体（検索で差し替える範囲） */
function feedSectionsHTML() {
  const by = (k) => FEED.items.filter(i => i.kind === k);
  /* .feed-body > .feed-main（対応が必要 / 定例の業務 / お知らせ の 3 節）
                 + .feed-side（担当分類 / 最近使った の 2 箱）
     - 節が 0 件なら節ごと出さない
     - 担当分類 : FEED.mine.map(id => .side-link data-act="gocat" data-arg=id、右に countCat(id))
     - 最近使った: FEED.recent.map(id => .side-link data-act="svc"  data-arg=id、左に .dot) */
}

function renderFeed(el) {
  el.innerHTML = `
  <div class="feed-wrap" data-screen-label="業務フィード">
    <div class="feed-head">
      <div>
        <div class="crumb">${esc(t('feedEyebrow'))}</div>
        <h1>${esc(t('feedTitle'))}</h1>
        <p>${esc(t('feedLead'))}</p>
        <div class="feed-who">
          <div class="avatar">${esc(L(FEED.persona.name).charAt(0))}</div>
          <span>${esc(L(FEED.persona.name))} ／ ${esc(L(FEED.persona.role))}・${esc(L(FEED.persona.site))}</span>
          <span class="cta-note">${esc(t('mockNote'))}</span>
        </div>
      </div>
      <input class="search" id="search" placeholder="${esc(t('searchPh'))}" value="${esc(state.query)}">
    </div>
    <div id="home-holder">${feedSectionsHTML()}</div>
  </div>`;
  bindHomeSearch(feedSectionsHTML);
  el.scrollTop = 0;
}
```

### 7-4. ③ のクリック → act マッピング

| クリック対象 | `data-act` | arg | 結果 |
|---|---|---|---|
| フィード項目（`.feed-item`、`開く ›` を含む） | `svc`（既存） | サービス id | `view='detail'`、`log=[]` → 既存の詳細 → `start` → `demo` |
| 「最近使った」の行 | `svc`（既存） | サービス id | 同上 |
| 「担当分類」の行 | `gocat`（②で追加済み） | 分類 id | 共通グリッド（「ホームへ戻る」付き） |
| 検索欄 | （act なし） | — | `#home-holder` の差し替え |

**③ では新規 act を追加しない。**

---

## 7B. 管理番号表示（①②③ 共通・PR-0）

PM 承認済みの追加要件。**採番ルールは確定済みで再検討しない。**

### 7B-1. 採番ルールとヘルパー

**管理番号 = 内部 id を大文字化し、通番を 2 桁ゼロ埋め。** `kn2` → `KN-02`、`pt8` → `PT-08`。

- **変換のみ**。新しいデータも新しい辞書も作らない（`SVCS` に `code` フィールドを足さない）
- **3 言語共通表示**（`T` にキーを追加しない。`L()` / `t()` を通さない）
- 通番は分類内の追加順・**永久欠番**。中分類を移しても番号は不変（＝ id を変えない限り番号も変わらない）

ヘルパー（`statusClass` の直後、`detectLang` の前に置く）：

```js
const pad2 = (n) => String(n).padStart(2, '0');
/** サービス id → 管理番号（kn2 → KN-02）。表示のためだけの変換。データには持たせない */
const svcCode = (id) => {
  const m = /^([a-z]+)(\d+)$/.exec(id);
  return m ? `${m[1].toUpperCase()}-${pad2(m[2])}` : String(id).toUpperCase();
};
```

現行 41 件の変換結果（reviewer の照合用）：

| 分類 | id | 管理番号 |
|---|---|---|
| kn | kn1〜kn5 | `KN-01` `KN-02` `KN-03` `KN-04` `KN-05` |
| qa | qa1〜qa4 | `QA-01` `QA-02` `QA-03` `QA-04` |
| dc | dc1〜dc7 | `DC-01` `DC-02` `DC-03` `DC-04` `DC-05` `DC-06` `DC-07` |
| lg | lg1〜lg4 | `LG-01` `LG-02` `LG-03` `LG-04` |
| nm | nm1〜nm5 | `NM-01` `NM-02` `NM-03` `NM-04` `NM-05` |
| en | en1〜en3 | `EN-01` `EN-02` `EN-03` |
| gn | gn1〜gn5 | `GN-01` `GN-02` `GN-03` `GN-04` `GN-05` |
| pt | pt1〜pt8 | `PT-01` `PT-02` `PT-03` `PT-04` `PT-05` `PT-06` `PT-07` `PT-08` |

（`EN-xx` の `EN` は分類「図面・BOM・技術文書」の id `en` に由来する。UI 言語の `en`（English）とは無関係。混同しないこと）

### 7B-2. 表示位置

**(a) サービスカード（`cardHTML`）— 右上**

```
┌ .card  data-act="svc" ─────────────────────────────────┐
│ ┌ .c-top  display:flex; align-items:baseline ────────┐ │
│ │ ナレッジ検索・問い合わせ・技術・設備ナレッジ  KN-02 │ │  ← .c-crumb（左） / .code（右・margin-left:auto）
│ └────────────────────────────────────────────────────┘ │
│ 設備マニュアル・取扱説明書の検索                        │  ← .c-name（既存のまま）
│ 設備の型式と症状から、該当箇所を…                       │  ← .c-desc（既存のまま）
│ ●提供中  [設備] [検索]                                  │  ← .c-meta（既存のまま）
└────────────────────────────────────────────────────────┘
```

差分は `cardHTML` の 1 行目だけ：

```js
  <div class="card" data-act="svc" data-arg="${x.id}">
    <div class="c-top">
      <div class="c-crumb">${esc(L(c.name))}・${esc(L(sb.name))}</div>
      <span class="code">${esc(svcCode(x.id))}</span>
    </div>
    ...以下は既存のまま...
```

`.c-crumb` の文言・クラス・スタイルは変えない（`.c-top` で包むだけ）。②③ の「よく使う」「おすすめ」「検索結果」も `cardHTML` を呼ぶので**自動的に番号が出る**。

**(b) 詳細ヘッダー（`renderMain` の `detail` 分岐）— サービス名の上・左寄せ**

```
┌ .detail-card ───────────────────────────────────────────┐
│ ナレッジ検索・問い合わせ・技術・設備ナレッジ              │  ← .d-crumb（既存）
│ KN-02                                                   │  ← ★ 追加：.code.d-code
│ 設備マニュアル・取扱説明書の検索                          │  ← h1（既存）
│ [提供中] [設備] [検索]                                   │
│ ━━                                                      │
└─────────────────────────────────────────────────────────┘
```

差分は 1 行の挿入だけ：

```js
        <div class="d-crumb">${esc(L(c.name))}・${esc(L(sb.name))}</div>
        <div class="code d-code">${esc(svcCode(x.id))}</div>   <!-- ★ 追加 -->
        <h1>${esc(L(x.name))}</h1>
```

**(c) 出さない場所**：`chat` / `demo` のヘッダー（`.chat-hdr`）、`.feed-item`、`.side-link`、`.cat-row`。今回のスコープ外。増やしたくなったら別 Issue にする。

### 7B-3. CSS（トークンのみ）

```css
  /* ===== 管理番号 ===== */
  .code {
    font-family: var(--font-mono); font-size: var(--text-overline);
    letter-spacing: 0.04em; color: var(--text-muted); white-space: nowrap;
  }
  .card .c-top { display: flex; align-items: baseline; gap: var(--space-2); }
  .card .c-top .code { margin-left: auto; flex-shrink: 0; }
  .detail-card .d-code { margin-bottom: 6px; }
```

- `--font-mono` / `--text-overline` / `--text-muted` / `--space-2` はすべて定義済みトークン。**新規トークンなし・直値なし**
- `.card` の `gap: 7px` はそのまま効く（`.c-top` が 1 つ目の子になるだけ）

### 7B-4. ① に対する回帰（許容範囲として明示）

**①の見た目が変わるのは、この管理番号の追加だけ。** ほかの ① 回帰はすべて禁止（reviewer はここを基準に判定する）。

| 変わる | 変わらない |
|---|---|
| カード右上に `KN-02` 等が出る | `.c-crumb` の文言・折り返し挙動・色・サイズ |
| 詳細のパンくずと名前の間に 1 行入る（約 +19px） | サイドバー・グリッド列数・カード高さの計算式（`.c-desc` は 2 行クランプのまま） |
| — | 検索対象（`filtered()` は**触らない**。管理番号では検索できない。※やるなら別 Issue） |

### 7B-5. `tools/verify.mjs` への追記（§6 データ整合の中）

```js
  // 管理番号（§7B）
  const codeSeen = new Map();
  for (const s of SVCS) {
    if (!/^[a-z]{2}\d+$/.test(s.id)) { fail(`SVCS.${s.id}: id が /^[a-z]{2}\\d+$/ に一致しない（管理番号を作れない）`); bad++; }
    const code = s.id.replace(/^([a-z]+)(\d+)$/, (_, a, b) => a.toUpperCase() + '-' + String(b).padStart(2, '0'));
    if (codeSeen.has(code)) { fail(`管理番号の重複: ${code}（${codeSeen.get(code)} と ${s.id}）`); bad++; }
    codeSeen.set(code, s.id);
  }
```

- 現行 41 件はすべて `/^[a-z]{2}\d+$/` に一致し、重複なし（PASS するはず）
- 将来 `pt10` のような 2 桁通番が来ても `PT-10` になり衝突しない。`pt010` のような書き方をすると `PT-10` と衝突して FAIL する ＝ 想定どおりの検出

### 7B-6. PR 分割上の位置 — **②③ より先に単独 PR（PR-0）を推奨**

| 案 | 評価 |
|---|---|
| **PR-0 として単独（推奨）** | `cardHTML` と `detail` 分岐は ①②③ が共有する。**本機能で唯一 ① の見た目が変わる変更**なので、単独 PR にすると reviewer が「①のスクリーンショット差分＝管理番号だけ」を 1 回で確認できる。`T` も `HOME`/`FEED` も `PATTERNS.ready` も触らないので **`regress` は PASS のまま（`--update` 不要）**＝ baseline の変更が PR-1 / PR-2 に閉じる |
| ② の PR に同梱 | ②の diff に ① の回帰が混ざり、reviewer が「②のせいか管理番号のせいか」を切り分けられない。**非推奨** |

PR-0 の検証：`node tools/verify.mjs` → ALL PASS（新設の id 形式チェックを含む）、`node tools/regress.mjs` → **PASS（差分ゼロ）**。差分が 1 行でも出たら、データ層かキーを触っている。

### 7B-7. 受け入れ条件（PR-0）

| # | 操作 | 期待 |
|---|---|---|
| F-1 | `node tools/verify.mjs` | ALL PASS。§6 に「管理番号の重複なし」相当の PASS が出る |
| F-2 | `node tools/regress.mjs` | **PASS（`--update` を実行しない）** |
| F-3 | ① の一覧（41 件） | 全カードの右上に管理番号。`KN-01`〜`PT-08` が §7B-1 の表と一致。ゼロ埋め 2 桁 |
| F-4 | ① の詳細（kn2） | パンくずの下・名前の上に `KN-02` |
| F-5 | 言語を 中文 / English に切替 | 管理番号は**変わらない**（3 言語共通） |
| F-6 | ダークテーマ | `.code` が `--text-muted` で読める。浮かない |
| F-7 | 幅 1100px / カード幅 300px | 長いパンくず（例 `dc`・`apply`）でも番号が折り返さず、カードからはみ出さない |
| F-8 | `git diff` | `CATS` / `SVCS` / `TAGS` / `TEMPLATES` / `SCENARIOS` / `T` / `PATTERNS` / `state` に差分ゼロ |

---

## 8. CSS（トークンのみ・直値禁止）

### 8-1. 追加するクラスと使用トークン

| クラス | 役割 | 主なトークン |
|---|---|---|
| `.dash-wrap` / `.feed-wrap` | 画面枠 | `padding: var(--space-8) 36px var(--space-12) 36px`（`.list-wrap` と同じ） |
| `.dash-hero` / `.feed-head` | 見出し＋検索 | `display:flex; align-items:flex-end; justify-content:space-between; gap:var(--space-6); flex-wrap:wrap; margin-bottom:var(--space-8)` |
| `.dash-hero h1` / `.feed-head h1` | h1 | `font-size: var(--text-h2); color: var(--text-heading); font-weight: var(--weight-bold)` |
| `.dash-hero p` / `.feed-head p` | リード文 | `font-size: 13.5px; color: var(--text-secondary); line-height: var(--leading-relaxed)` |
| `.stat-strip` | 統計の帯 | `display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:var(--space-4); margin-bottom:var(--space-10)` |
| `.stat` | 統計カード | `background:var(--surface-card); border:1px solid var(--border-card); border-bottom:2px solid var(--border-card); padding:var(--space-5)` |
| `.stat-n` | 数字 | `font-size:28px; font-weight:var(--weight-bold); color:var(--text-heading)` |
| `.stat-l` | ラベル | `font-size:12px; color:var(--text-secondary)`。左に既存 `.dot.live/.trial/.concept` を置く |
| `.dash-sec` | 節 | `margin-bottom: var(--space-10)` |
| `.sec-h` | 節見出し行 | `display:flex; align-items:baseline; gap:var(--space-3); margin-bottom:var(--space-4)`。左に `border-left: var(--border-accent) solid var(--action-primary)` 相当のキーライン |
| `.sec-note` | 節の補足 | `font-size:11.5px; color:var(--text-muted)`。`margin-left:auto` |
| `.sec-count` | 件数バッジ | `font-size:var(--text-overline); color:var(--text-muted)` |
| `.rank-grid` / `.reco-grid` | カード並び | `display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:var(--space-4)`（`.grid` と同じ） |
| `.rank-item` / `.reco-item` | カードの入れ物 | `display:flex; flex-direction:column; gap:6px` |
| `.rank-h` | 順位＋利用件数 | `display:flex; align-items:center; justify-content:space-between` |
| `.rank-n` | 順位 | `width:20px;height:20px;border-radius:50%;background:var(--action-primary);color:var(--text-on-brand);font-size:11.5px;font-weight:var(--weight-bold)` |
| `.rank-uses` | 利用件数 | `font-size:var(--text-overline); color:var(--text-secondary)` |
| `.r-why` | おすすめ理由 | `font-size:12.5px; line-height:var(--leading-relaxed); color:var(--text-body); background:var(--surface-sunken); border:1px solid var(--border-subtle); padding:var(--space-3)` |
| `.r-why-l` | 「おすすめの理由」 | `font-size:var(--text-overline); font-weight:var(--weight-bold); color:var(--action-primary); margin-right:6px` |
| `.cat-row` | 分類行（ボタン） | `display:grid; grid-template-columns: minmax(200px,1.2fr) auto minmax(160px,1fr) auto; align-items:center; gap:var(--space-4); width:100%; text-align:left; padding:12px var(--space-4); border:none; border-top:1px solid var(--border-subtle); background:transparent` |
| `.cat-row:hover` | | `background: var(--surface-hover)` |
| `.cat-row .c-nm` | 分類名 | `font-size:13.5px; font-weight:var(--weight-bold); color:var(--text-heading)` |
| `.cat-bar` | 成熟度バー | `display:flex; height:8px; background:var(--surface-sunken); overflow:hidden; border-radius:var(--radius-pill)` |
| `.cat-bar .s-live` | | `background: var(--status-success)` |
| `.cat-bar .s-trial` | | `background: var(--status-warning)` |
| `.cat-bar .s-concept` | | `background: var(--status-concept)` |
| `.cat-mix` | 内訳の数字 | `font-size:var(--text-overline); color:var(--text-secondary)` |
| `.home-count` | 検索結果件数 | `font-size:12.5px; color:var(--text-secondary); margin-bottom:var(--space-4)` |
| `.feed-body` | 2 カラム | `display:grid; grid-template-columns:minmax(0,1fr) 300px; gap:var(--space-8); align-items:start` |
| `.feed-main` / `.feed-side` | 列 | `min-width:0` / `display:flex; flex-direction:column; gap:var(--space-4)` |
| `.feed-who` | ペルソナ行 | `display:flex; align-items:center; gap:var(--space-2); margin-top:var(--space-3)`。既存 `.avatar` を 26px に縮める指定は `.feed-who .avatar { width:26px; height:26px; font-size:12px; }` |
| `.feed-sec` | フィードの節 | `margin-bottom: var(--space-8)` |
| `.feed-item` | 項目カード | `display:flex; flex-direction:column; gap:6px; width:100%; text-align:left; background:var(--surface-card); border:1px solid var(--border-card); border-left:var(--border-accent) solid var(--border-card); padding:var(--space-4) var(--space-5); margin-bottom:var(--space-3); cursor:pointer` |
| `.feed-item:hover` | | `border-left-color: var(--action-primary)` |
| `.feed-item.due` | 期限つきの強調 | `border-left-color: var(--status-danger)` |
| `.feed-item.routine` | | `border-left-color: var(--status-info)` |
| `.feed-item.notify` | | `border-left-color: var(--status-concept)` |
| `.fi-kind` | 種別ラベル | `font-size:var(--text-overline); font-weight:var(--weight-bold); padding:2px var(--space-2); border-radius:var(--radius-xs)`。`.due` → `background:var(--badge-concept-bg); color:var(--status-danger)`／`.notify` → `var(--badge-concept-bg)`＋`var(--badge-concept-fg)`／`.routine` → `var(--badge-trial-bg)`＋`var(--badge-trial-fg)` |
| `.fi-when` | 期限表現 | `font-size:12px; color:var(--text-secondary)` |
| `.fi-title` | サービス名 | `font-size:15px; font-weight:var(--weight-bold); color:var(--text-heading)` |
| `.fi-note` | 業務の文脈 | `font-size:12.5px; line-height:var(--leading-relaxed); color:var(--text-body)` |
| `.fi-foot` | 下段 | `display:flex; align-items:center; gap:var(--space-3); flex-wrap:wrap; margin-top:4px` |
| `.fi-cat` | 分類名 | `font-size:var(--text-overline); color:var(--action-primary); font-weight:var(--weight-bold)` |
| `.fi-open` | 「開く ›」 | `margin-left:auto; font-size:12.5px; color:var(--text-link)` |
| `.side-box` | 右レール箱 | `background:var(--surface-card); border:1px solid var(--border-card); padding:var(--space-4)` |
| `.side-box h3` | 箱見出し | `font-size:13px; font-weight:var(--weight-bold); color:var(--text-heading); margin:0 0 var(--space-3)` |
| `.side-link` | 箱の行（ボタン） | `display:flex; align-items:center; gap:var(--space-2); width:100%; text-align:left; border:none; background:transparent; padding:8px 0; border-top:1px solid var(--border-subtle); font-size:13px; color:var(--text-body)` |
| `.side-link:hover` | | `color: var(--text-link)` |
| `.side-link .cnt` | 件数 | `margin-left:auto; font-size:var(--text-overline); color:var(--text-muted)` |

**厳守**：この節に出てくる色はすべて既存トークン。**新しいトークンを 1 つも追加しない**（dark 用も追加しない）。`#RRGGBB` はコンポーネント CSS に 1 つも書かない（`verify.mjs` §5 が FAIL する）。

### 8-2. `.search` の幅

`.search` は `width: 280px` 固定。②③ のヘッダーでは `flex-wrap` により折り返るので、1180px 以下用に `.dash-hero .search, .feed-head .search { width: 100%; }` を追加する（`.list-wrap .search` には影響させない）。

### 8-3. `@media (max-width: 1180px)` への追記

既存ブロックの**末尾に追記**する。既存 2 行（`.demo-body` / `.work-pane`）は触らない。

```css
  @media (max-width: 1180px) {
    .demo-body { flex-direction: column; }                    /* 既存 */
    .work-pane { ... }                                        /* 既存 */
    /* ▼ 追記 */
    .feed-body { grid-template-columns: minmax(0, 1fr); }
    .dash-hero, .feed-head { flex-direction: column; align-items: stretch; }
    .dash-hero .search, .feed-head .search { width: 100%; }
    .cat-row { grid-template-columns: 1fr auto; row-gap: var(--space-2); }
  }
```

---

## 9. 言語 / テーマ / `state.log` が壊れないこと

### 9-1. 設計上の保証

| 懸念 | 保証の根拠 |
|---|---|
| 言語切替（日/中/英） | `renderDash` / `renderFeed` は `t()` / `L()` 経由でのみ文言を出す。`HOME.recommended[].why` / `FEED.persona.*` / `FEED.items[].when` / `.note` は 3 言語必須（`verify` §10 で検査）。サービス名・分類名は既存 `SVCS` / `CATS` の 3 言語辞書 |
| 言語切替後の再描画 | `lang-select` → `savePrefs(); applyPrefs(); renderAll()` → `renderMain()` → ホームは全再描画される。②③ に固有の状態を持たせないので復元処理は不要 |
| テーマ切替 | `applyPrefs()` が `data-theme` を切り替えるだけ。②③ の CSS は既存セマンティックトークンのみ使用 → ダークで浮かない |
| `state.log` の復元 | ②③ は `view === 'list'` のときにしか描かれない。`view === 'demo'` の分岐（`state.log` の復元・`demoReplyTimer`）は**1 文字も触らない** |
| デモ中のパターン切替 | `pattern` act は `state.view` / `state.log` / `state.selSvc` を変えない → `renderAll()` 後もデモ画面と会話が保持される（3 パターンとも同じ画面が出る） |
| 検索中の IME | ホームの検索は `#home-holder` の差し替えのみ（`renderMain()` を呼ばない）→ 入力欄が再生成されないので変換が壊れない（§3-5） |

### 9-2. `tools/verify.mjs` の追記

**(a) §7 共通レイヤー契約**

```js
const requiredActs = ['pattern','all','cat','sub','svc','back','backdetail','start','send','run','chip','restart','gocat'];
```

**(b) 新設 §10「ホームデータ整合（HOME / FEED）」**

`grab('HOME')` / `grab('FEED')` を取得し、次を検査する（1 つでも外れたら FAIL）：

1. `HOME` / `FEED` が取得できる（取得できない＝`grab()` の正規表現に合わない書き方 → FAIL）
2. `HOME.frequent` は 1 件以上。各 `id` が `SVCS` に存在。`id` の重複なし。`uses` が 1 以上の整数
3. `HOME.recommended` は 1 件以上。各 `id` が `SVCS` に存在。`why` を `checkML()`（ja/zh/en 非空・en にかな無し）
4. `FEED.persona.name` / `.role` / `.site` を `checkML()`
5. `FEED.mine` の各要素が `CATS` の id に存在
6. `FEED.recent` の各要素が `SVCS` に存在。重複なし
7. `FEED.items` は 1 件以上。各要素の `id` が `SVCS` に存在、`kind ∈ {due, notify, routine}`、`when` / `note` を `checkML()`
8. （warn）`HOME.frequent` の `uses` が降順でない場合は warn（順位表示の見栄えのため）

**(c) PATTERNS の ready**

`PATTERNS` の `ready` が全て `true` になるので、`todoHTML` は実行時には到達しなくなる。**`todoHTML` と `T.todoEyebrow` / `T.todoTitle` は残す**（将来のパターン追加用。`verify` §3 は参照をソースから拾うので未定義・未使用の警告は出ない）。

---

## 10. `regress.mjs` の期待差分（`--update` が必要）

`regress.mjs` のスナップショット対象は `cats` / `svcs` / `tags` / `patterns[{id,ready}]` / `uiKeys` / `counts{cats,subs,svcs,tags,ui}`。

> **重要（PM 依頼文の前提を 1 点だけ訂正）**：`counts` のうち **`ui`（`T` のキー数）は不変にできない**。3 言語ラベルを追加する以上 `T` にキーが増えるため。**不変なのは `cats` / `subs` / `svcs` / `tags` の 4 つ**。

| | 実装前 | PR-1（②）後 | PR-2（③）後 |
|---|---|---|---|
| `counts.cats` | 8 | **8** | **8** |
| `counts.subs` | 17 | **17** | **17** |
| `counts.svcs` | 41 | **41** | **41** |
| `counts.tags` | 43 | **43** | **43** |
| `counts.ui` | 49 | **61** | **73** |
| `patterns.nav.ready` | true | true | true |
| `patterns.dash.ready` | false | **true** | true |
| `patterns.feed.ready` | false | false | **true** |

期待される差分メッセージ（`--update` 前に `node tools/regress.mjs` を実行して**この行だけが出ること**を確認する）：

**PR-1（②）**
```
- counts.ui: 49 → 61
- T(UI キー) 追加: dashWelcome
- T(UI キー) 追加: dashLead
- T(UI キー) 追加: statAll
- T(UI キー) 追加: dashFreq
- T(UI キー) 追加: dashFreqNote
- T(UI キー) 追加: usesUnit
- T(UI キー) 追加: dashReco
- T(UI キー) 追加: dashRecoNote
- T(UI キー) 追加: recoWhy
- T(UI キー) 追加: dashCats
- T(UI キー) 追加: dashCatsNote
- T(UI キー) 追加: backHome
- PATTERNS.dash.ready: false → true
```
（`CATS` / `SVCS` / `TAGS` の行が 1 行でも出たら **データ層を壊している**。マージ不可）

**PR-2（③）**
```
- counts.ui: 61 → 73
- T(UI キー) 追加: feedEyebrow / feedTitle / feedLead / feedAction / feedRoutine / feedNotice
                 / kindDue / kindNotify / kindRoutine / feedOpen / feedMine / feedRecent
- PATTERNS.feed.ready: false → true
```

確認後に `node tools/regress.mjs --update`。**PR 本文に「設計書 `docs/handoff/2026-09-06-patterns-dash-feed.md` §10 の意図的変更に伴う基準更新」と明記する。**

---

## 11. `mock/README.md` の更新（PR-2 に含める）

A 行の
```
表示パターン3案（① 階層ナビ／② ダッシュボード／③ 業務フィード。①のみ実装、②③は Phase 2）を切替。
```
を
```
表示パターン3案（① 階層ナビ／② ダッシュボード／③ 業務フィード。3案とも実装済み）を切替。
同じカタログ・同じ詳細/デモ画面に、3通りの入口から入れる。
```
に差し替える。**他の行は触らない。**

---

## 12. PM 判断待ち（決めていない。各点に architect 推奨を 1 行）

| # | 論点 | architect 推奨 |
|---|---|---|
| D-1 | ②の「よく使う」は何で決めるか（個人の利用履歴 / 社内全体の実績 / 手選び） | **社内全体の実績（手選びのサンプル値）**。個人履歴は③の「最近使った」が担うので役割が被らない |
| D-2 | 利用件数の数字（今月 312 件など）を出すか | **出す**。工場長には件数が一番効く。ただし「デモ用のサンプル値」の注記を必ず併記する（`dashFreqNote`） |
| D-3 | ②のおすすめ 3 件の選定（dc1 本社報告 / kn2 設備マニュアル検索 / qa3 クレーム一次回答） | **この 3 件のまま**。効果が早く見える・現場が毎日触る・顧客対応の 3 方向をカバーしている |
| D-4 | ③のペルソナを誰にするか（李 強／製造二課 課長／蘇州工場） | **このまま**。`SCENARIOS` の qa2・dc5・nm3 に既出の人物なので、詳細画面に進んでも人物像がぶれない |
| D-5 | ヘッダーの「情報システム部」を③のペルソナに合わせるか | **合わせない**。ヘッダーは①②③共通で、触ると①の回帰範囲が広がる |
| D-6 | ③の疑似イベントの粒度（7 件＝期限 3／定例 2／お知らせ 2） | **7 件のまま**。増やすと画面が縦に伸び、工場長デモで下までスクロールが必要になる |
| D-7 | ③に絶対日付（「9月8日（月）」等）を出すか | **出さない**。相対表現（本日／明日／今週／毎週月曜）だけにして、デモ日が変わっても古びないようにする |
| D-8 | ②③でサイドバーを隠すか | **隠す**（現行 `renderSidebar` のまま）。3 パターンの見た目の差が明確になり、`renderSidebar` を触らずに済む |
| D-9 | ②③に「すべてのサービス（41 件）一覧」への導線を置くか | **置かない**。それは①の役割。②③ からは検索と分類タイルで到達できる |
| D-10 | `counts.ui` が不変にできない件（§10） | **`regress --update` を PR ごとに実施**。「`counts` 不変」は `cats`/`subs`/`svcs`/`tags` の 4 つ、と読み替える |
| D-11 | ②の h1 文言「AIエージェント ホーム」 | **このまま**。顧客名や効果訴求（「業務を 30% 削減」等）は入れない |
| D-12 | ②③ を PM がモック承認するタイミング | **PR-1 マージ後に② を Pages で確認 → PR-2 着手**。②のトーンが違えば③の書き直し量が減る |
| D-13 | 管理番号（`KN-02`）で検索できるようにするか | **今回はしない**。`filtered()` は §1-1 の触らない範囲。要るなら別 Issue（S レーン相当） |
| D-14 | 管理番号を `chat` / `demo` のヘッダーや ③ のフィード項目にも出すか | **出さない**。カードと詳細の 2 か所に絞ると、番号が「サービスの識別子」だと伝わりやすい |

---

## 13. `CLAUDE.md` への影響（PM 承認事項。architect も implementer も書き換えない）

| § | 現状 | 必要な更新 | 理由 |
|---|---|---|---|
| §2-3「遷移」 | `data-act` 12 種を列挙 | **`gocat` を追加**して 13 種にする。「`gocat` は `cat` からアコーディオンのトグルを取り除いたもの。②③ のホームから分類へ直接ジャンプするために使う」の 1 文を添える | load-bearing の `data-act` 一覧が実装とズレると reviewer の照合基準が壊れる |
| §2-3「データ」 | `CATS` / `SVCS` / `TAGS` / `TEMPLATES` / `SCENARIOS` | **`HOME`（②のよく使う・おすすめ）/ `FEED`（③の疑似イベント・担当分類・最近使った）を追加**。「いずれも `SVCS` に埋め込まず別定数」と明記 | 次の担当者が `SVCS` にフィールドを足す事故を防ぐ |
| §2-3「状態」 | `state` 11 キー・`view` 4 値 | **変更なし**（②③ は `view` も `state` も増やさない）。「ホーム＝`view==='list'` かつ `selCat`/`selSub`/`query` が空、をパターンで描き分ける」の 1 文を追記すると親切 | 設計意図の記録 |
| §2-4 | `.mockbar` は足場 | **変更なし**（`ready: true` にするだけで構造は不変） | — |
| §2-9 | 「顧客版カタログへの差し替えはデータ層だけ」 | **1 文追記**：「`SVCS[].id` は管理番号（`kn2` → `KN-02`、§7B）として**顧客に見える**。id の改名は番号の変更になるので、直すときは欠番にして新しい id を採る」 | 番号が変わると顧客の資料・問い合わせと突き合わなくなる |
| §6 バックログ | 「モック ②ダッシュボード / ③業務フィード：§2-3 の共通レイヤー上に実装。並列可」 | **完了に更新**（「並列可」は誤り。同一ファイルの同一関数を触るので直列。§14 参照） | 次回の並列判断の材料 |

**更新は PM が行う。**（`docs/claude:` のコミットとして PR-2 マージ後に。過去の #31 / #34 と同じ運用）

---

## 14. PR 分割案 / 並列可否

### 14-1. 分割

| PR | 内容 | 触るファイル |
|---|---|---|
| **PR-0：管理番号表示（①②③ 共通）** | `pad2` / `svcCode` ヘルパー／`cardHTML` の `.c-top` 化／`detail` 分岐に `.d-code` 1 行／`.code` 系 CSS 3 行／`verify.mjs` §6 に id 形式・番号重複の検査。**`T` / `HOME` / `FEED` / `PATTERNS` / `state` / データ層に触らない → `regress` は差分ゼロ（`--update` 不要）** | `mock/catalog.html`, `tools/verify.mjs` |
| **PR-1：② ダッシュボード＋共通土台** | `T` 12 キー（`backHome` 含む）／`HOME` 定数／`gocat` act／`renderMain` のホーム分岐 4 行／`list` 分岐の「ホームへ戻る」1 ブロック／`bindHomeSearch` / `renderDash` / `dashSectionsHTML`／`.dash-*` 系 CSS ＋ media 追記／`PATTERNS.dash.ready = true`／`verify.mjs`（`requiredActs` に `gocat`・§10 の `HOME` 部分）／`regress --update` | `mock/catalog.html`, `tools/verify.mjs`, `tools/regress.baseline.json` |
| **PR-2：③ 業務フィード** | `T` 12 キー／`FEED` 定数／`renderMain` のホーム分岐に `feed` の 1 行／`renderFeed` / `feedSectionsHTML` / `feedItemHTML`／`.feed-*` `.side-*` 系 CSS ＋ media 追記／`PATTERNS.feed.ready = true`／`verify.mjs` §10 の `FEED` 部分／`regress --update`／`mock/README.md` の A 行 | `mock/catalog.html`, `tools/verify.mjs`, `tools/regress.baseline.json`, `mock/README.md` |

### 14-2. 並列可否 → **直列（PR-0 → PR-1 → PR-2）**

`CLAUDE.md` §5 の基準（ファイル集合が重ならないときだけ並列）に照らして **並列不可**。重なる箇所：

1. `mock/catalog.html` の `T`（末尾に両方が追記 → 隣接 hunk 衝突）
2. `renderMain` のホーム分岐（**同じ 4 行の hunk**）
3. `PATTERNS`（隣接する 2 行）
4. `@media (max-width: 1180px)`（同じブロック末尾）
5. `tools/verify.mjs` の新設 §10（同じ節）
6. `tools/regress.baseline.json`（`uiKeys` 配列が全面的に変わる → 機械的な衝突）

PR-0 も同じ `mock/catalog.html` を触るため、**PR-1 より先に単独でマージする**（理由は §7B-6）。PR-0 が触るのは `cardHTML` / `detail` 分岐 / ヘルパー / `.code` 系 CSS で、PR-1・PR-2 が触る `T` / `renderMain` のホーム分岐 / `PATTERNS` とは重ならないが、`regress.baseline.json` の扱いを分離する意味で直列にする。

`bindHomeSearch` と「ホームへ戻る」は PR-1 で入れ、PR-2 は**それを再利用するだけ**にする。PR-1 / PR-2 の implementer は **前の PR が main にマージされた後**にブランチを切る。

`mock/README.md` の更新（S 相当）は PR-2 に同梱する。単独 PR にしない。

---

## 15. 受け入れ条件

### 15-1. 機械検証（PR-1 / PR-2）

> **PR-0 は例外**：`regress` は差分ゼロで PASS する。`--update` を実行しない（§7B-6 / §7B-7）。

```bash
node tools/verify.mjs      # → ✅ ALL PASS（warn は「未使用タグ」など既存分のみ。新規 FAIL 0）
node tools/regress.mjs     # → §10 の期待差分“だけ”が出ることを目視確認
node tools/regress.mjs --update
node tools/regress.mjs     # → ✅ regress PASS
```

`verify` で特に確認する項目：
- §2 i18n：`T` のキー数が PR-1 後 61 / PR-2 後 73、全キー 3 言語非空、en にかな無し
- §3：未定義キー参照 0。§4：未使用キー warn に**新規追加キーが 1 つも出ない**
- §5：コンポーネント CSS に色の直値なし。`var()` 未定義なし。dark ブロックで `--ntt-*` を上書きしていない
- §7：`data-act` 13 種 OK（`gocat` を含む）、`state` 必須キー 10 件 OK
- §10（新設）：`HOME` / `FEED` の整合 OK

### 15-2. Playwright による目視確認（reviewer も再実行する）

```bash
export NODE_PATH=/opt/node22/lib/node_modules
export PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
# executablePath: /opt/pw-browsers/chromium-1194/chrome-linux/chrome
# file:///home/user/Dify/mock/catalog.html を 1440x900 と 1100x900 で開く
```

確認手順と期待結果：

| # | 操作 | 期待 |
|---|---|---|
| A-1 | 起動直後（① nav） | 従来どおりのサイドバー＋「すべてのサービス」41 件グリッド。**①の見た目の差分は §7B の管理番号だけ**（PR-0 以降） |
| A-2 | `.mockbar` の②③セグメント | `disabled` が外れている。クリックできる |
| B-1 | ② に切替 | サイドバー無し。統計 `41 / 12 / 21 / 8`、よく使う 6 枚、おすすめ 3 枚、分類 8 行（件数 5/4/7/4/5/3/5/8）が §2 の表と一致 |
| B-2 | ②で「技術ナレッジQA」カードをクリック | ①と同じ詳細画面（ペルソナ 王 磊・画面タイプ QAチャット型・利用シナリオ）。「デモを見る」で `demo` に入り、チップで会話が進む |
| B-3 | ②で分類「品質・不具合対応」の行をクリック | 4 件のグリッド＋左上に「‹ ホームへ戻る」。押すとダッシュボードに戻る |
| B-4 | ②で `openCats.kn === true` の状態（初期値）で「ナレッジ検索・問い合わせ」行をクリック | **5 件のグリッドが出る**（`gocat` がトグルでないことの確認。ここが `cat` だとバグる） |
| B-5 | ②の検索欄に「翻訳」と入力 | ダッシュボードが検索結果グリッドに差し替わる。全消しするとダッシュボードが戻る。**日本語 IME で入力しても変換が中断しない** |
| C-1 | ③ に切替 | 「対応が必要 3／定例の業務 2／お知らせ 2」、右レールに「担当分類（品質 4・文書 7・数字 5）」「最近使った 4 件」 |
| C-2 | ③で「不具合原因分析・報告書（8D）作成」項目をクリック | ①②と同じ詳細画面 → 「デモを見る」でアップロード型デモ |
| C-3 | ③の「担当分類 > 文書・資料作成」 | 7 件のグリッド＋「‹ ホームへ戻る」 |
| D-1 | 言語を 中文 → English と切替（②③ 各画面で） | 日本語が 1 文字も残らない。数字・順位はそのまま |
| D-2 | ダークテーマに切替（②③ 各画面で） | 浮いた色・読めない文字が無い。成熟度バーの 3 色が識別できる |
| D-3 | デモ画面（`demo`）で 2 往復進めてから ②→③→① とパターン切替 | 会話（`state.log`）が消えず、3 パターンとも同じデモ画面が出る |
| D-4 | ①で分類「見積・数字」を選んだ状態で②に切替 | ②でも「見積・数字」の 5 件グリッド（＋「ホームへ戻る」）。**選択位置が保持される**（§3-1 の仕様） |
| E-1 | 幅 1100px で ②③ | 統計 2 列、カード 1 列、③の右レールが下に回る。横スクロールが出ない |
| E-2 | 幅 1100px で ① とデモ画面 | 実装前と同じ（`@media` 既存 2 行が壊れていない） |
| F-9 | ②の「よく使う」「おすすめ」「検索結果」のカード | `cardHTML` 経由なので管理番号が出る（②③ 側の追加実装は不要） |
| F-10 | ③の `.feed-item` / 右レール | 管理番号は**出ない**（§7B-2 (c) のスコープ外。出ていたらスコープ超過） |

### 15-3. 目視での load-bearing 照合（reviewer）

- `git diff` に `CATS` / `SVCS` / `TAGS` / `TEMPLATES` / `SCENARIOS` の行が**1 行も含まれない**
- `state` の定義と `view` の値集合が変わっていない
- 既存 `data-act` 12 種のハンドラ本文が変わっていない（増えたのは `gocat` の 1 ブロックだけ）
- `renderSidebar` / `gridHTML` / `sendChat` / `panelHTML` / `chipsHTML` が変わっていない
- `cardHTML` の差分が PR-0 の `.c-top` / `.code` だけ（PR-1 / PR-2 では差分ゼロ）
- 1 つ目の `<style>`（トークン）が変わっていない
- `.mockbar` の HTML 構造が変わっていない
