# お気に入り（Favorites）— 設計書

- 日付：2026-09-08
- レーン：**M**（`state` の形・`localStorage` キー・`data-act` 一覧・`T`・検査ツールに触る＝CLAUDE.md §2-3 / §2-6 / §2-1 の load-bearing に該当）
- 元 Issue：#120 の派生
- 対象：`mock/js/app.js`・`mock/js/render.js`・`mock/js/events.js`・`mock/js/data/ui.js`（`T` のみ）・`mock/css/components.css`（**追記のみ**）・`tools/verify.mjs`・`tools/regress.baseline.json`
- 前提設計書：`docs/handoff/2026-09-08-finance-catalog.md`（業種軸・`state.industry`・`HOME`/`FEED` の業種キー）／`2026-09-07-split-catalog.md`（読み込み契約）／`2026-09-06-patterns-dash-feed.md`（①②③）／`2026-09-07-new-badge.md`（`added` を state に持たせない流儀）

---

## 0. 要約

### 0-1. PM から与えられた前提（再検討しない）

1. Dify には Explore アプリの `is_pinned`（ピン留め）が実在する（`api/models/model.py` の `InstalledApp.is_pinned`、`api/controllers/console/explore/installed_app.py` で切替）。**お気に入りは Dify にも実在する概念**
2. したがって **`.mockbar` の足場ではなく、ヘッダー配下の「本番相当の画面」に置くプロダクト機能**として設計する（CLAUDE.md §2-4）

### 0-2. 本書の結論（1 画面分）

| 決めたこと | 結論 | 節 |
|---|---|---|
| 単位 | **サービス単位**（分類・タグはお気に入りにしない） | §1-1 |
| 業種をまたぐか | **またがない。業種ごとに別リスト**（`mock.fav = { mfg:[…], fin:[…] }`） | §1-2 |
| `localStorage` | **新キー `mock.fav` を 1 つだけ足す。既存 `mock.lang` / `mock.theme` は 1 バイトも触らない**（§2-6 の更新文案は §7-1。適用は PM） | §2-1 |
| `state` | `fav`（業種キー付きの id 配列）と `favOnly`（お気に入りだけを表示中か）を追加（§2-3 の更新文案は §7-1） | §2-2 |
| データ層 | **`js/data/**` には一切置かない**（利用者ごとの状態。`SVCS`・`HOME`・`FEED` を汚さない＝`added` と同じ流儀） | §2-3 |
| `data-act` | **`fav`（付け外し）と `favlist`（お気に入り一覧へ）の 2 つを追加** | §2-4 |
| カードの印 | 右上に **星ボタン（塗り／輪郭の形で区別。色だけに頼らない）**。既存の NEW・管理番号・タグ・成熟度は減らさない | §3-1 |
| ① 階層ナビ | サイドバー最上部、「すべてのサービス」の**直下・区切り線の上**に「お気に入り」＋件数。0 件でも出す | §3-2 |
| ② ダッシュボード | `dash-duo` の**上**に全幅の「お気に入り」帯（カード最大 6 件＋「すべて見る」）。**0 件なら帯ごと出さない**（新着帯と同じ規則） | §3-3 |
| ③ 業務フィード | 右レール**最上段**に「お気に入り」ボックス（最大 6 行＋「すべて見る」）。0 件なら出さない | §3-4 |
| 詳細画面 | `cta-row` に**文字ラベル付き**のトグルボタン。デモ画面／チャット画面には**置かない** | §3-5 |
| 上限 | **件数の上限は設けない**。②③ の表示だけ 6 件で切る。壊れた保存値は起動時に捨てる | §3-7 |
| regress | **お気に入りの中身は対象外**（利用者の状態でデータ層ではない）。ただし `T` に 9 キー増えるので `uiKeys` / `counts.ui` の差分は出る＝`--update` が必要 | §4-2 |
| `T` | **新規 9 キー**（ja/zh/en すべて本書で確定。§5） | §5 |
| Dify の `is_pinned` | **同期しない**。カタログ側（v1 は `localStorage`、将来は PC-02 の認証基盤）で持つ | §6 |
| PR 分割 | **2 本・直列**（PR-1 土台＋①、PR-2 ②③ への露出） | §8 |

### 0-3. 触らない範囲（明示）

- **`mock/catalog.html`**：1 行も変えない（`<script src>` も `<link>` も増やさない。verify §1-B の本数・順序検査に影響を出さない）
- **`mock/index.html`・`mock/scripts.html`**：触らない（**並行作業中**。§8-3）
- **`mock/css/tokens.css`**：1 行も変えない（**新しい色トークンを作らない**。星は既存の `--action-primary` / `--text-secondary` だけで描く。§3-6）
- **`mock/css/components.css`**：**追記のみ**。既存セレクタの宣言を書き換えない。色の直値を書かない（§2-2）
- **`mock/js/data/catalog.js`・`home.js`・`style.js`・`scenarios/**`**：1 行も変えない（`SVCS` / `HOME` / `FEED` / `SCENARIOS` にお気に入りを埋め込まない）
- **`mock/js/data/ui.js`**：`T` に §5 の 9 キーを足すだけ。`TAGS` / `PATTERNS` / `TEMPLATES` / `INDUSTRIES` は触らない
- **`localStorage` キー `mock.lang` / `mock.theme`**：名前も値の形式も変えない
- **既存の `data-act` 12 種**の意味：変えない（`all` / `cat` / `sub` / `gocat` / `industry` に `state.favOnly = false` の 1 行を足すのは**追加であって意味の変更ではない**。§2-4）
- **`.mockbar`**：お気に入りの UI を 1 つも置かない（§2-4 の足場と製品の切り分け）
- **`dify/**`・`data/world/**`・`docs/dify/**`**：本 PR では触らない（`platform-components.md` への追記は §6-3 の PM 判断）
- **`.claude/**`**・**`CLAUDE.md`**：architect は変更しない。§7 は**文案**で、適用は PM

---

## 1. §A 何をお気に入りにするか

### 1-1. 単位はサービス（`SVCS[].id`）

- お気に入りの対象は **`SVCS` の 1 件＝管理番号 1 つ**（`kn2` → `KN-02`）。分類・中分類・タグはお気に入りにしない
- 理由：
  1. 利用者が「また使う」と思う対象はサービス。分類（`KN`）をお気に入りにしても、その中の 5 件からもう一度選ぶことになる
  2. ③ 業務フィードの右レールには既に**分類単位の「担当分類」**がある（`FEED[].mine`）。分類をお気に入りにすると住み分けが消える（§3-4）
  3. 保存されるのは管理番号だけ＝`docs/handoff/service-index.md` の台帳と 1:1。顧客版への差し替え（§2-9）でも id は不変なので保存値が腐らない
- 保存する値は**内部 id（`kn2`）**であって管理番号（`KN-02`）ではない。管理番号は表示のためだけの変換（§2-11）なので保存値には使わない

### 1-2. 業種はまたがない（**推奨：業種ごとに別リスト**）

66 件のうち **業種横断サービスは 10 件**（`kn4` `kn5` `dc2` `dc8` `gn6` `po1` `po2` `po3` `po4` `eg1`）。「製造でお気に入りにした `DC-02` は金融でも星が付くか？」の答え：**付かない**。

| | 案 A：業種で分ける（**採用**） | 案 B：業種をまたぐ 1 本のリスト |
|---|---|---|
| 保存の形 | `{"mfg":["kn1","dc2"],"fin":["kn6"]}` | `["kn1","dc2","kn6"]` |
| 業種切替後の見え方 | その業種で自分が選んだものだけ | 66 件中 10 件だけが引き継がれ、**残り 56 件は選んだのに消えたように見える** |
| デモの筋 | 業種切替＝「別の顧客環境を見せる」。前の顧客のデモ状態が残らない | 製造のデモで付けた星が、そのまま銀行のデモに出る |
| 本番での姿 | 1 テナント＝1 業種なので、そのまま「利用者ごとの 1 本のリスト」に潰れる。移行不要 | 同じ |
| 実装量 | `state.fav[state.industry]` の 1 段（`HOME` / `FEED` と同じ形） | 配列 1 本 |

**採用理由**：業種切替は `events.js` の `industry` ハンドラで `openCats` / `selCat` / `selSub` / `selSvc` / `view` / `query` / `log` を**すべてリセット**する既存規則がある。お気に入りだけが業種をまたいで残ると、この「業種を切り替えたら別の世界に入る」という一貫性が崩れる。また案 B は「10 件だけ生き残る」という説明しづらい中途半端な挙動になる。

**結果**：`state.fav` は `HOME` / `FEED` と同じ**業種キー**（`{ mfg: [], fin: [] }`）で持つ。

---

## 2. §B 置き場と永続化（load-bearing）

### 2-1. `localStorage` に新キー `mock.fav` を足す（**PM 承認事項**）

**判定：足してよい。ただし §2-6 の load-bearing に該当するので PM の承認を取ってから実装する。**

§2-6 の原文は「`localStorage` キーは `mock.lang` / `mock.theme` ／ 変えるとレビュー参加者の設定が飛ぶ。変更禁止」。禁じているのは**既存 2 キーの改名・転用**であって、独立した新キーの追加ではない。それでも承認を求める理由は、この条文が「キーの集合」を書いていて、集合を増やすと条文自体が古くなるため。

**追加してよいと判断した根拠**

1. 既存 2 キーの名前・値・読み書きの経路（`loadPrefs` / `savePrefs`）を**変えない**。`mock.fav` が無い／壊れていても、`mock.lang` / `mock.theme` は今までどおり読める（`try/catch` は別々にする。§2-5）
2. お気に入りはプロダクト機能（§0-1）。**リロードで消える「お気に入り」は壊れて見える**ので、`pattern` / `industry` のような足場の一時状態（保存しない）とは扱いを変える必要がある
3. 逆に「保存しない」を選ぶと、レビュー中に言語切替（`renderAll`）を挟むだけでは消えないが、ブラウザを閉じると消える。顧客レビューは複数日にわたるので、これは機能の説明にならない
4. 追加は 1 キーで打ち止めにできる。§7-1 の文案で **「許可されたキーは `mock.lang` / `mock.theme` / `mock.fav` の 3 つだけ。増やすときは設計書＋PM 承認」** と明文化し、`tools/verify.mjs` で**許可集合の外の `'mock.*'` リテラルを FAIL にする**（§4-1）。今より検査が強くなる

**保存の仕様**

| 項目 | 値 |
|---|---|
| キー | `mock.fav`（`mock.` プレフィクスは既存 2 キーと同じ） |
| 値 | JSON 文字列。`{"mfg":["kn1","dc2"],"fin":["kn6"]}`（業種 id → 内部 id の配列） |
| 書き込み | `savePrefs()` に 1 行追加（言語・テーマと同じ関数。呼ぶ場所が増えるだけ） |
| 読み込み | `loadPrefs()` で読み、**検証してから** `state.fav` に入れる（§2-5） |
| 無い／壊れている場合 | 例外を投げずに `{ mfg: [], fin: [] }` で起動する |
| 初期化の手段 | ブラウザの devtools で `localStorage.removeItem('mock.fav')`。**UI に「すべて解除」ボタンは v1 では作らない**（§9 #4） |

### 2-2. `state` に持つもの

```js
const state = {
  industry: 'mfg',
  pattern: 'nav',
  lang: 'ja',
  theme: 'light',
  openCats: { kn: true },
  selCat: null,
  selSub: null,
  lastCat: 'kn',
  selSvc: null,
  view: 'list',
  query: '',
  fav: { mfg: [], fin: [] },   // ← 追加：業種ごとのお気に入り（SVCS[].id の配列。localStorage 'mock.fav' に保存）
  favOnly: false,              // ← 追加：list ビューで「お気に入りだけ」を表示中か
  log: []
};
```

- **`fav` の順序**：`localStorage` には**追加した順**で入る（実装が素直）。ただし**画面に出す順は必ず `SVCS` のカタログ順**（§3-7）。順序を表示に使わないので、順序の意味を仕様として保証しない
- **`favOnly` を別キーにする理由**：お気に入り一覧は「分類でも中分類でもない横断ビュー」。`selCat = '__fav'` のような擬似分類にすると `catOf()` が `undefined` を返して既存の描画が壊れる。`query` と同じ「絞り込み条件」として独立に持つのが §2-3 の流儀に合う
- **`favOnly` は保存しない**（`localStorage` に入れるのは `fav` だけ）。リロードで必ずホームに戻る

### 2-3. データ層には置かない

- `mock/js/data/**` は純粋なリテラル宣言のみ（verify が `node:vm` で実行して読む。`localStorage` 参照は §1 で FAIL）。お気に入りは**利用者ごとの状態**なのでここには置かない
- `SVCS` にも `HOME` / `FEED` にも埋め込まない。これは `added`（NEW バッジ）で確立した流儀と同じ ——「サービスの属性ではないものを `SVCS` に入れない」
- 置き場所は **`mock/js/app.js`**：`state.fav` の定義／ヘルパー（`favSet` `isFav` `favList` `toggleFav`）／`loadPrefs` `savePrefs` の拡張。描画は `render.js`、click ハンドラは `events.js`（§2-3 の置き場契約どおり）

### 2-4. 追加するヘルパーと `data-act`

**`mock/js/app.js` に追加するヘルパー（4 つ）**

| 名前 | 返すもの |
|---|---|
| `favIds()` | `state.fav[state.industry]`（無ければ空配列を作って返す） |
| `isFav(id)` | `favIds().includes(id)` |
| `favList()` | **`visSvcs().filter(x => favIds().includes(x.id))`** ＝ 現在業種で見えるお気に入りサービスを**カタログ順**で返す。件数・①一覧・②帯・③レールは**すべてこれ 1 本**を使う |
| `toggleFav(id)` | あれば取り除き、無ければ末尾に足す。`savePrefs()` は呼び出し側（`events.js`）で呼ぶ |

`filtered()` の先頭に 1 行足す：

```js
function filtered() {
  let list = visSvcs();
  if (state.favOnly) list = list.filter(x => isFav(x.id));   // ← 追加
  if (state.selSub) …（以降は現行のまま）
```

**`data-act` に 2 つ追加**（既存 12 種は意味を変えない）

| act | arg | 動き |
|---|---|---|
| `fav` | サービス id | `toggleFav(arg)` → `savePrefs()` → §3-8 の部分再描画。**`renderAll()` は呼ばない**（スクロール位置が飛ぶため） |
| `favlist` | なし | `state.favOnly = true; state.selCat = null; state.selSub = null; state.query = ''; state.view = 'list';` → `renderAll()` |

**既存ハンドラへの 1 行追加**（`state.favOnly = false;`）：`all` / `cat` / `sub` / `gocat` / `industry`。`svc` は追加不要（`view` が `detail` になるので `favOnly` は効かない。一覧に戻る `back` で元のお気に入り一覧に帰れるほうが自然）。

### 2-5. `loadPrefs` / `savePrefs` の拡張（`try` を分ける）

```
loadPrefs():
  ① 既存の mock.lang / mock.theme の try ブロックは 1 バイトも変えない
  ② 別の try ブロックで mock.fav を読む
     - JSON.parse に失敗 → 何もしない（既定の空リスト）
     - パースできても形が違う（オブジェクトでない／値が配列でない）→ 何もしない
     - 各業種の配列は「文字列であること」だけを見て state.fav[<業種>] に入れる
       （存在しない id はここでは捨てない。favList() が visSvcs() で絞るので画面には出ない＝
        カタログを差し替えても保存値が壊れず、戻せば復活する）
     - 業種キーは INDUSTRIES の id のみ受け入れる。未知のキーは捨てる
     - 安全弁として 1 業種あたり 200 件で切る（壊れた／膨らんだ値の防御）

savePrefs():
  ③ 既存 2 行の後ろに localStorage.setItem('mock.fav', JSON.stringify(state.fav)) を足すだけ
```

`savePrefs()` は言語切替・テーマ切替でも呼ばれるので、`state.fav` が常に一緒に書き戻る。これで整合が取れる。

---

## 3. §C 見せ方

### 3-1. カード（3 パターン共通・最重要）

`cardHTML(x)` の `.c-top` 右端に星ボタンを 1 つ足す。**既存の情報は 1 つも削らない**。

```
┌──────────────────────────────────────────────┐
│ ┌────┐  KN・技術ナレッジ           [NEW] KN-02  ★│   ← .c-top（★ が最右）
│ │icon│  設備トラブル一次診断                       │
│ └────┘                                          │
│ 型式と症状から、過去の対応履歴と手順書を…            │   ← .c-desc（2 行クランプ）
│ ● 提供中   検索   設備                            │   ← .c-meta
└──────────────────────────────────────────────┘
```

**寸法・仕様**

| 項目 | 値 |
|---|---|
| 位置 | `.c-code`（NEW＋管理番号のまとまり）の**右隣**。`.c-top` の最後の子 |
| ボタン寸法 | 28 × 28 px（`.c-code` との間隔 `var(--space-2)` = 8px） |
| アイコン | 18 × 18 px のインライン SVG（星）。`aria-hidden="true" focusable="false"`（`catIcon` と同じ） |
| off（未登録） | 輪郭の星（`fill: none; stroke: currentColor; stroke-width: 1.75`）／色 `var(--text-secondary)` |
| on（登録済） | **塗りつぶした星**（`fill: currentColor; stroke: currentColor`）／色 `var(--action-primary)` |
| hover | off → `var(--action-primary)`。背景 `var(--surface-hover)` |
| フォーカス | 既存のグローバル `:focus-visible { box-shadow: var(--shadow-focus) }` がそのまま効く（追加 CSS 不要） |
| 常時表示 | **hover のときだけ出す、はやらない**。タッチ環境と資料用スクリーンショットで見えなくなるため |

**カードの情報量への影響**：`.c-head`（分類パンくず＋サービス名）の幅が 36px（28 + 8）縮む。`.c-crumb` は既に `text-overflow: ellipsis`、`.c-name` は折り返しなので破綻しない。**実装後に一覧を目視し、`.c-name` が 3 行になるカードが出ていないことを確認する**（受け入れ条件 §8-4）。

**入れ子ボタン問題（実装者への警告）**

- `.card` は `<div data-act="svc">` なので、中に `<button data-act="fav">` を置ける（HTML として妥当）
- 一方 **`.use-row`（②よく使う）・`.feed-item`（③フィード項目）・`.side-link`（③右レール）は `<button>`**。この中に星ボタンを入れると `<button>` の入れ子になり HTML として不正・ブラウザが構造を壊す。**これらの行には星を置かない**（§3-3・§3-4 はこれを前提に設計している）
- click は `document` の単一ハンドラ＋`e.target.closest('[data-act]')`。星を押したときは最も内側の `[data-act="fav"]` が拾われるので、カードの `svc` は発火しない。`stopPropagation()` は不要

### 3-2. ① 階層ナビ（`renderSidebar`）

```
┌──────────────────────┐
│ すべてのサービス      48 │   ← 既存
│ ★ お気に入り           3 │   ← 追加（data-act="favlist"）
│ ────────────────────  │   ← 既存の .nav-divider
│ ▸ 知識・ナレッジ         │
│ ▸ 品質                  │
└──────────────────────┘
```

- **位置**：「すべてのサービス」の直下、区切り線の**上**。区切り線の下は分類の並びなので、分類ではないものを混ぜない
- 星アイコン（`.ic-sm` 相当 16px、`--action-primary`）＋ラベル `t('favTitle')`＋件数（既存 `.cnt` を流用）
- 選択中（`state.favOnly === true`）は既存の `.nav-item.on` を使う
- **0 件でも常に出す**（推奨）。理由：レイアウトが動かない／機能の存在が伝わる／押すと空状態の説明（§3-6）が出て使い方が分かる。件数 `0` を出す。※ 0 件のとき隠す案は §9 #3 の PM 判断
- `state.favOnly` が true のとき、`.nav-item[data-act="all"]` の `.on` は付かない（`!state.selCat && !state.selSub && !state.favOnly` で判定）

**お気に入り一覧（`favOnly` の list ビュー）**

- タイトル `t('favTitle')`、パンくず `t('home') + ' ／ ' + t('favTitle')`、件数は既存の `.count`
- 中身は既存の `gridHTML()`。検索欄も既存のまま効く（**お気に入りの中を検索**できる。`filtered()` の順序がそう動く）
- ②③ から来たときは既存の「ホームへ戻る」リンクがそのまま出る（`state.pattern !== 'nav'` の分岐は変えない）

### 3-3. ② ダッシュボード（`dashSectionsHTML`）

**住み分け**

| 帯 | 出どころ | 主語 |
|---|---|---|
| **お気に入り**（追加） | 利用者が押した星 | **わたしが選んだ** |
| よく使われているエージェント | `HOME[ind].frequent`（社内利用実績のサンプル値） | みんながよく使う |
| おすすめ | `HOME[ind].recommended` | 運営が薦める |
| 新しく追加された | `SVCS[].added` から計算 | 最近増えた |

3 つが「他人の都合」なのに対し、お気に入りだけが「自分の意思」。だから**一番上**に置く。

**レイアウト**

```
┌─ hero（既存。変更なし）───────────────────────────┐
└───────────────────────────────────────────────┘
┌─ .dash-sec.dash-fav（追加。0 件なら丸ごと出ない）──────┐
│ │お気に入り   自分で選んだエージェント   すべて見る（9）│
│ [card][card][card]                                  │   ← 既存 .grid、最大 6 件
└───────────────────────────────────────────────┘
┌─ .dash-sec.dash-new（既存の新着帯。0 件なら出ない）─────┐
└───────────────────────────────────────────────┘
┌─ .dash-duo（既存）: おすすめ | よく使う＋分類 ───────────┐
└───────────────────────────────────────────────┘
```

- **`newHTML` と同じ形**（`dash-duo` の上に全幅で挿む）にするので、`renderDash` の構造は変わらず、`dashSectionsHTML()` の戻り値の先頭に 1 つ足すだけ：
  `return \`${favHTML}${newHTML}<div class="dash-duo">…\`;`
- **カードを使う**ので星の付け外しがその場でできる（`.use-row` を使わない理由は §3-1 の入れ子ボタン問題）
- 表示は**最大 6 件**（`favList().slice(0, 6)`）。7 件以上のとき `.sec-h` に `t('favSeeAll')`（`data-act="favlist"`）を出す。6 件以下なら「すべて見る」は出さない
- **0 件なら帯ごと出さない**（`if (!fav.length) return '';`）。既存の新着帯と同じ規則。②のホームは「初めての人向けの顔」なので、空の箱を置かない。星はカード上に常時あるので発見性は保たれる

### 3-4. ③ 業務フィード（`feedSectionsHTML`）

**住み分け**（右レールを上から読むと「明示 → 担当 → 自動」になる）

| ボックス | 意味 | 単位 |
|---|---|---|
| **お気に入り**（追加・最上段） | 自分で明示的に選んだ | サービス |
| 担当分類（既存） | 組織が決めた担当範囲 | **分類** |
| 最近使った（既存） | 自動でたまる履歴 | サービス |

```
┌─ .feed-main ────────┐ ┌─ .feed-side ──────┐
│ 対応が必要           │ │ │お気に入り        │  ← 追加（0 件なら出ない）
│ 定例の業務           │ │ ★ 設備トラブル…   │
│ お知らせ             │ │ ★ 議事録作成      │
│                     │ │ すべて見る（9）    │
│                     │ ├───────────────┤
│                     │ │ │担当分類（既存）  │
│                     │ ├───────────────┤
│                     │ │ │最近使った（既存）│
└─────────────────┘ └─────────────────┘
```

- 既存の `.side-box` / `.side-link` をそのまま使う（新しい CSS ほぼ不要）。行の左は**分類アイコン**（`catIcon(x.cat,'ic-sm')`）で「最近使った」と同じ形にし、**星は行に置かない**（`.side-link` が `<button>` のため。§3-1）
- 付け外しは詳細画面か、「すべて見る」→ カード一覧で行う
- 最大 6 行。7 件以上のときだけ末尾に「すべて見る（N）」（`data-act="favlist"`）
- **0 件ならボックスごと出さない**（レールが 2 箱に戻るだけでレイアウトは崩れない）

### 3-5. 詳細画面（`view === 'detail'`）

- `.cta-row` の中、「デモを見る／利用開始する」の**右隣**に**文字ラベル付き**のトグルを置く：

```
[ デモを見る ]  [ ★ お気に入りに追加 ]   ※ 本画面はコンセプト確認用のモックです
```

- カード上の星はアイコンだけなので意味が伝わりにくい。詳細画面には文字を出して、機能の名前を 1 回だけはっきり見せる
- ラベルは登録済みなら `t('favRemove')`、未登録なら `t('favAdd')`。星のアイコンも塗り／輪郭で連動
- スタイルは新規 `.btn-ghost`（`--surface-card` 背景＋`--border-default` 枠＋`--text-body` 文字、高さは `.btn-primary` と揃える）。**色の直値は書かない**
- **`chat` / `demo` ビューには置かない**。デモ中の画面は台本に集中させる（`chat-hdr` の情報量を増やさない）

### 3-6. 0 件のとき・アクセシビリティ

**0 件**

| 場所 | 0 件のときの見せ方 |
|---|---|
| ① サイドバー | 「お気に入り 0」を**出す**（押せる） |
| ① お気に入り一覧 | `gridHTML` の既定文言ではなく、専用の空状態： `t('favEmpty')`（見出し）＋ `t('favEmptyHint')`（説明）。**検索語がある状態で 0 件のときは既存の `t('noResults')` のまま**（「お気に入りが無い」と「検索に当たらない」を混ぜない） |
| ② ダッシュボード | 帯ごと出さない |
| ③ 業務フィード | ボックスごと出さない |
| 詳細画面 | 「お気に入りに追加」ボタンが出る（常に） |

実装メモ：`gridHTML(list)` に**任意の第 2 引数**（空のときに差し込む HTML）を足す。既存 4 か所の呼び出しは引数なしのままで挙動が変わらない。

**アクセシビリティ**

| 項目 | 仕様 |
|---|---|
| キーボード | 星は本物の `<button>`。Tab で到達、Enter / Space でトグル。フォーカスリングは既存 `:focus-visible` |
| 状態の伝達 | `aria-pressed="true|false"`。トグル時にこの属性を書き換える（読み上げは状態変化を拾う） |
| ラベル | `aria-label` に**サービス名込み**の文言（`t('favAddAria')` / `t('favRemoveAria')` の `{name}` を置換）。カード内の名前と関連付けが無いため、名前を label に入れないと「ボタン」としか読まれない |
| `title` | `t('favAdd')` / `t('favRemove')`（マウス利用者向けの短い方） |
| 色だけに頼らない | **塗り／輪郭という形の差**で区別する。加えて `aria-pressed` と `title`。色覚特性・モノクロ印刷でも判別できる |
| コントラスト | off = `--text-secondary`（light `#5A6B78` は白地で約 5.3:1、dark `#A4B0BA` はカード地 `#111C30` で約 7:1）。**`--text-muted` は白地で 2.9:1 しかなく、図形の 3:1 要件（WCAG 1.4.11）を満たさないので使わない**。on = `--action-primary`（light `#0071BC` は白地で約 4.6:1） |
| ライブリージョン | v1 では作らない（`aria-pressed` の変化で足りる） |
| 既知の未対応 | `.card` 自体が `<div>` でキーボード操作できないのは**既存の課題**。本件の範囲外（星だけは操作できる） |

### 3-7. 多すぎるとき

- **件数の上限は設けない**。全 66 件を星にしても保存値は 1KB に満たない
- 表示の切り方：② と ③ は **6 件**まで＋「すべて見る（N）」。① の一覧と `favlist` ビューは**全件**（既存のグリッドがスクロールする）
- 並び順は**常に `SVCS` のカタログ順**（`favList()` が `visSvcs()` を filter するので自動的にそうなる）。追加順や最近順にしない ——「星を押すたびに一覧の並びが変わる」ほうが混乱するため
- 壊れた／膨らんだ保存値は起動時に 200 件で切る（§2-5）

### 3-8. トグル時の再描画（実装の要）

`renderAll()` も `renderMain()` も呼ばない（`renderMain()` の末尾は `el.scrollTop = 0` なので、一覧の 12 件目に星を付けると先頭まで飛ぶ）。代わりに：

```
act === 'fav' のとき：
  1. toggleFav(arg); savePrefs();
  2. syncFavButtons(arg)   … document 内の [data-act="fav"][data-arg="<id>"] を全部探し、
                              class / aria-pressed / aria-label / title / SVG を書き換える
  3. renderSidebar()       … ① の件数を更新（nav 以外のパターンでは既存どおり即 return）
  4. 画面の種類ごとに、お気に入りから作られている領域だけ差し替える：
     - ②③ のホーム（#home-holder がある）→ innerHTML = dashSectionsHTML() / feedSectionsHTML()
     - list ビュー（#grid-holder がある）→ innerHTML = gridHTML(filtered()) と #count の更新
       （favOnly のときは外した項目がその場で消える）
     - detail ビュー → 2. のボタン書き換えだけで足りる（他に描き直す物が無い）
```

`bindHomeSearch` / `panelHTML` で既に使われている「領域だけ差し替える」流儀に合わせる。ホーム差し替え後は `bindHomeSearch()` を**再度呼ばない**（`#search` 要素自体は `#home-holder` の外にあり作り直されないため。実装時に要確認 → §8-4 の確認項目）。

---

## 4. §D 検査への影響

### 4-1. `tools/verify.mjs`

| 節 | 変更 |
|---|---|
| §2 i18n | 変更不要（`T` を舐めるので新 9 キーが自動で 3 言語検査される） |
| §3 未定義キー | 変更不要。ただし**実装側の書き方に制約**：参照は `t('favAdd')` のように**リテラル引数**で書く。`t(k)` のような間接参照にすると未使用キー warn が出る（`kindLabel` と同じ注意） |
| §4 未使用キー | 変更不要。9 キーすべてが参照されていること（warn が増えないことが受け入れ条件） |
| §5 CSS | 変更不要。`components.css` に色の直値を書かないこと・`var()` が定義済みであることは既存検査がそのまま効く |
| §6 データ整合 | **変更なし**（お気に入りはデータ層に無い） |
| **§7 共通レイヤー** | ① `required` に **`'fav'` と `'favOnly'`** を追加<br>② `requiredActs` に **`'fav'` と `'favlist'`** を追加<br>③ `localStorage` キー検査を拡張：必須 3 キー `mock.lang` / `mock.theme` / `mock.fav` の存在に加え、**アプリ層に現れる `'mock.…'` 文字列リテラルの集合がこの 3 つの部分集合であること**を検査し、外があれば FAIL（`appText.matchAll(/'mock\.[a-z]+'/g)`）。§2-6 を今より強く守る |
| §9 シナリオ整合 | 変更不要 |
| §10 HOME/FEED | **変更不要**（`HOME` / `FEED` にお気に入りを持たせないため） |
| §11 索引 | 変更不要（サービスを増やさない） |

`tools/lib/load.mjs`：変更不要（`DATA_KEYS` は増えない）。

### 4-2. `tools/regress.mjs`

**お気に入りの中身は regress の対象外**でよい。判定理由：

1. regress が比べているのは `mock/js/data/**` のデータ層（`CATS` / `SVCS` / `TAGS` / `PATTERNS` / `T` のキー）。お気に入りは `js/data/**` に 1 バイトも足さないので、比較対象そのものが存在しない
2. お気に入りは**利用者ごとに違う値**なので「基準ファイルと一致すべき」という概念が成立しない。`added`（NEW）を regress の対象外にしたのと同じ理屈
3. `tools/regress.mjs` のコードは**変更なし**

ただし **`T` に 9 キー増えるので、`uiKeys` と `counts.ui` に差分が出る**：

```
counts.ui: 78 → 87
T(UI キー) 追加: favAdd, favAddAria, favEmpty, favEmptyHint, favNote,
                 favRemove, favRemoveAria, favSeeAll, favTitle
```

- PR では `node tools/regress.mjs --update` を実行し、PR 本文に **「設計書 `2026-09-08-favorites.md` §5 の `T` 追加に伴う基準更新」** と書く（CLAUDE.md §3）
- **reviewer の照合点**：`tools/regress.baseline.json` の diff が **`counts.ui` の 1 行と `uiKeys` の 9 行の追加だけ**であること。`cats` / `svcs` / `tags` / `patterns` / `industries` / それ以外の `counts.*` に 1 行でも差分があれば**設計外の破壊**（§8-5）

---

## 5. §E i18n（`T` に足す 9 キー。ja / zh / en 確定）

`mock/js/data/ui.js` の `T` の**末尾**（NEW 表示ブロックの後ろ）に、コメント付きで 1 ブロックとして足す。既存キーは 1 つも変えない。

```js
  /* ---- お気に入り（設計書 2026-09-08-favorites.md §5。9 キー） ---- */
  favTitle:      { ja: 'お気に入り', zh: '收藏', en: 'Favorites' },
  favAdd:        { ja: 'お気に入りに追加', zh: '添加到收藏', en: 'Add to favorites' },
  favRemove:     { ja: 'お気に入りから外す', zh: '取消收藏', en: 'Remove from favorites' },
  favAddAria:    { ja: '{name} をお気に入りに追加',
                   zh: '将「{name}」添加到收藏',
                   en: 'Add {name} to favorites' },
  favRemoveAria: { ja: '{name} をお気に入りから外す',
                   zh: '将「{name}」从收藏中移除',
                   en: 'Remove {name} from favorites' },
  favEmpty:      { ja: 'お気に入りはまだありません。',
                   zh: '还没有收藏的服务。',
                   en: 'No favorites yet.' },
  favEmptyHint:  { ja: 'カード右上の星印を押すと、ここに集まります。',
                   zh: '点击卡片右上角的星标，即可收藏到这里。',
                   en: 'Press the star at the top right of a card to collect it here.' },
  favSeeAll:     { ja: 'すべて見る（{n}）', zh: '查看全部（{n}）', en: 'See all ({n})' },
  favNote:       { ja: '自分で選んだエージェント',
                   zh: '您自己收藏的智能体',
                   en: 'Agents you picked yourself' }
```

**使う場所**

| キー | 使う場所 |
|---|---|
| `favTitle` | ① サイドバーのラベル／お気に入り一覧の見出し・パンくず／② 帯の `h2`／③ ボックスの `h3` |
| `favAdd` / `favRemove` | 星ボタンの `title`／詳細画面のボタン文字 |
| `favAddAria` / `favRemoveAria` | 星ボタンの `aria-label`（`{name}` を `L(x.name)` で置換） |
| `favEmpty` / `favEmptyHint` | ① お気に入り一覧が 0 件かつ検索語なしのとき |
| `favSeeAll` | ②③ で 7 件以上のときの「すべて見る」（`{n}` は総件数） |
| `favNote` | ② 帯の `.sec-note`（③ の `.side-box` には note の置き場が無いので使わない） |

`en` にかなを入れない（verify §2）。`{name}` / `{n}` のプレースホルダは 3 言語すべてに必ず入れる。

---

## 6. §F Dify 側（`is_pinned`）との関係

### 6-1. v1：同期しない。カタログ側で持つ

Dify の `InstalledApp.is_pinned` は **Explore（Dify 自身の画面）にインストールされたアプリのピン留め**。一方このカタログは #124 で整理したとおり**自前の画面**で、Dify のアプリ一覧をそのまま映すものではない。同期しない理由は 3 つ：

1. **粒度が合わない**。カタログの単位は管理番号（`SVCS[].id`）で、成熟度 `st=3`（構想）を含む。構想のサービスには **Dify アプリが存在しない**ので `installed_app` に対応する行が無い。1:1 の対応表が作れない
2. **`is_pinned` は「テナント × 利用者 × インストール済みアプリ」の状態**。カタログは複数環境（社内・顧客 A・顧客 B）へ配るマスタ（§2-12）で、環境をまたぐと `installed_app` の id が変わる。管理番号は不変なので、保存すべきキーはカタログ側の管理番号のほう
3. **双方向同期は Console API 呼び出しとトークン管理を招く**（§2-10 のシークレット規律に直接ぶつかる）。モックの段階で払うコストではない

したがって **v1 は `localStorage`（ブラウザ 1 台分）**。「本人の設定であってサーバの状態ではない」ことは、デモの説明としても正しい。

### 6-2. 将来（1 段落）

本番 UI（`docs/dify/platform-components.md` の **PC-16 本番 UI**）を作る段になったら、お気に入りは **PC-02（認証・ロール）が持つ利用者プロファイル**に移す。保存キーは管理番号のまま（`favorites: ["KN-02","DC-08"]`）で、環境を移しても壊れない。Dify の `is_pinned` との関係は**カタログ → Dify の一方向だけ**を検討する ―― カタログで星を付けた「提供中（`st=1`）」のサービスについて、対応する `installed_app` があれば Explore 側も pin する。逆方向（Dify で pin → カタログに反映）はやらない。Explore を使わない利用者のほうが多い前提の UI だから。この一方向同期でさえ、`installed_app` の id を管理番号に対応づける表（`dify/env/<env>/env.yml` の `apps:` が既に持っている）と Console API トークンが要るので、**PC-16 を作る意思決定と同時に判断する**。

### 6-3. `docs/dify/platform-components.md` への指摘（本 PR では触らない）

- **PC-02（認証・ロール）**：「利用者ごとの個人設定（お気に入り・言語・テーマ）の保存先」が現状どこにも書かれていない。1 行足すべき
- **PC-16（本番 UI）**：「お気に入り（Dify の `is_pinned` に相当する概念。カタログ側で保持し、同期は一方向のみ検討）」を機能一覧に足すべき
- どちらも `docs/dify/` の範囲なので、**本設計書の PR では変更しない**。§9 #6 の PM 判断とし、承認されたら別 Issue で回す

---

## 7. §G CLAUDE.md の更新文案（**適用は PM。architect は変更しない**）

> 前提：`docs/handoff/2026-09-08-finance-catalog.md` §7-1 の文案（`state.industry` の追加など）が**まだ適用されていない**。以下は**その適用後**を前提に書いてある。順番が前後する場合は PM が調整すること。

**§2-3「状態」の差し替え**

```
- **状態**：`state = { industry, pattern, lang, theme, openCats, selCat, selSub, lastCat, selSvc, view, query, fav, favOnly, log }`。
  （industry の説明は finance-catalog §7-1 の文案どおり）
  `fav` は **業種キーのお気に入り**（`{ mfg: ['kn1', …], fin: [] }`。値は `SVCS[].id`。`localStorage` の `mock.fav` に保存）。
  `favOnly` は list ビューで「お気に入りだけ」を表示中かどうか（保存しない＝リロードでホームに戻る）。
  **お気に入りは利用者ごとの状態なので `js/data/**` には置かない**（`SVCS`・`HOME`・`FEED` に埋め込まない。regress の対象外。
  `added` と同じ流儀）。画面に出す順は常に `SVCS` のカタログ順（`favList()` の 1 本に集約）。
  `view` は `list` / `detail` / `chat` / `demo`。`log` は …（以降は現行のまま）
```

**§2-3「遷移」の差し替え**

```
- **遷移**：`document` の `click` ハンドラの `data-act`（`industry`/`pattern`/`all`/`cat`/`sub`/`svc`/`back`/`backdetail`/
  `start`/`send`/`run`/`chip`/`restart`/`gocat`/**`fav`**/**`favlist`**）。…（既存の説明はそのまま）…
  `fav` はサービスのお気に入りをトグルする（`renderAll()` を呼ばず、星ボタン・サイドバーの件数・
  お気に入りから作られている領域だけを差し替える＝一覧のスクロール位置を飛ばさない）。
  `favlist` はお気に入りだけの一覧へ（`favOnly = true`、分類選択は解除）。`all`/`cat`/`sub`/`gocat`/`industry` は `favOnly` を解除する。
```

**§2-6 の差し替え（キーの追加。ここが本件の load-bearing）**

```
### 2-6. `localStorage` キーは `mock.lang` / `mock.theme` / `mock.fav` の 3 つだけ
- `mock.lang`（表示言語）・`mock.theme`（テーマ）：**改名・転用禁止**。変えるとレビュー参加者の設定が飛ぶ
- `mock.fav`（お気に入り。`{"mfg":["kn1"],"fin":[]}` の JSON）：2026-09-08 に追加（設計書 `docs/handoff/2026-09-08-favorites.md` §2-1、PM 承認）。
  読み書きは `mock/js/app.js` の `loadPrefs()` / `savePrefs()` のみ。**壊れていても例外を投げず空で起動する**こと
- **キーを 4 つ目に増やさない**。増やすなら設計書に理由を書いて PM の承認を取る
- 検出：`tools/verify.mjs` §7（3 キーの存在＋アプリ層に現れる `'mock.*'` リテラルがこの 3 つの部分集合であること）
```

**§4 の表（architect の欄）**：変更なし。

**§6 バックログへの 1 行追加**

```
- **お気に入り（#XX）**：設計書 `docs/handoff/2026-09-08-favorites.md`。サービス単位・業種ごと・`localStorage` の `mock.fav`。
  ①②③ すべてに露出（カード右上の星／① サイドバー入口／② 帯／③ 右レール／詳細のボタン）。
  Dify の `is_pinned` とは同期しない（将来 PC-16 でカタログ →Dify の一方向のみ検討）。
```

---

## 8. §G 段取り

### 8-1. PR 分割（**2 本・直列**）

`render.js` と `ui.js` を両方が触るので**並列にしない**（CLAUDE.md §5）。

| PR | 内容 | 触るファイル |
|---|---|---|
| **PR-1「土台と ①」** | `state.fav` / `state.favOnly`・ヘルパー 4 つ・`loadPrefs`/`savePrefs`・`filtered()` の 1 行・`T` 9 キー・**カードの星**・**詳細画面のトグル**・**① サイドバーの入口と `favOnly` 一覧＋空状態**・`data-act` `fav`/`favlist`・既存 5 ハンドラへの `favOnly = false`・`verify.mjs` §7 拡張・`regress --update`・CSS 追記（`.fav-btn` / `.btn-ghost` / `.nav-item` の星） | `mock/js/app.js`・`render.js`・`events.js`・`data/ui.js`・`css/components.css`・`tools/verify.mjs`・`tools/regress.baseline.json` |
| **PR-2「②③ への露出」** | ② `dashSectionsHTML` にお気に入り帯（最大 6＋すべて見る）・③ `feedSectionsHTML` の右レール最上段にお気に入りボックス・CSS 追記（`.dash-fav` / `.sec-more`） | `mock/js/render.js`・`css/components.css` |

- PR-1 だけでも機能は成立する（3 パターンすべてでカードの星が使え、① から一覧に行ける）。PR-2 が入るまで ②③ のホームにお気に入りの入口が無いだけ
- 1 本にまとめても構わないが、PR-1 は「仕組み」、PR-2 は「置き場所」でレビューの観点が違う。**2 本を推奨**

### 8-2. 実装順の注意（implementer 向け）

1. `mock/catalog.html` は**触らない**。`<script src>` も `<link>` も増やさない（verify §1-B の本数・順序検査に影響する）
2. `T` の参照は必ず `t('favAdd')` のリテラル引数で書く（verify §3/§4 が正規表現で追うため）
3. `components.css` は**ファイル末尾ではなく、関連する既存ブロックの直後**に足す（星 → `.badge-new` の後、`.btn-ghost` → `.btn-primary` の後、`.dash-fav` → `.dash-new` の後）。色の直値禁止
4. `gridHTML(list)` の第 2 引数（空状態 HTML）は**任意**にする。既存 4 か所の呼び出しを書き換えない
5. トグル時に `renderAll()` / `renderMain()` を呼ばない（§3-8）

### 8-3. 並行作業との衝突

| ファイル | 並行作業 | 本件 | 衝突 |
|---|---|---|---|
| `mock/index.html` | **触る**（デモガイド） | 触らない | なし |
| `mock/scripts.html`（新設） | **触る** | 触らない | なし |
| `mock/catalog.html` | 触らない想定 | **触らない** | なし |
| `mock/css/components.css` | 触らない想定 | **追記のみ**（3 か所、既存ブロックの直後） | 万一双方が触っても追記同士なら手で解ける |
| `mock/js/**`・`tools/**`・`data/ui.js` | 触らない想定 | 触る | なし |

- 並行作業が `components.css` を触る予定があるなら、**本件を後にする**（追記位置が動くだけなので直列化の代償は小さい）
- **`mock/index.html`（デモの見方）にお気に入りの説明を足す作業は、本件 PR-2 のマージ後に別 PR で**。並行作業と同じファイルなので同時に触らない（§9 #5）

### 8-4. 受け入れ条件

**機械検証（必須）**

1. `node tools/verify.mjs` が **FAIL 0**。かつ **warn の件数と内容が main と同じ**（＝新 9 キーがすべて参照されていて「未使用キー」warn が増えていない）
2. `node tools/regress.mjs` が **`counts.ui: 78 → 87` と `T(UI キー) 追加: fav* 9 件` だけ**を差分として報告し、`--update` 後に PASS。**`cats` / `subs` / `svcs` / `tags` / `patterns` / `industries` の差分が 0 件**
3. `npm test` が PASS（CI の `verify` ワークフローと同じ）
4. `verify.mjs` §7 に **`state` の `fav` / `favOnly`、`data-act` の `fav` / `favlist`、`localStorage` 許可集合 3 キー**の検査が入っていること（検査自体の追加を diff で確認）
5. 意図的に `mock/js/app.js` へ `localStorage.getItem('mock.zzz')` を足すと `verify.mjs` §7 が **FAIL する**こと（新検査が効いていることの確認。確認後に戻す）

**手動確認（PR 本文にチェック結果を書く）**

6. カードの星を押す → 塗りに変わる／`aria-pressed` が `true` に／**一覧のスクロール位置が動かない**
7. Tab キーだけで星に到達でき、Enter と Space の両方でトグルできる
8. リロードしても状態が残る。言語切替・テーマ切替・パターン切替（①→②→③）でも消えない
9. **業種を切り替えると別のリストになる**（製造で 3 件 → 金融に切替で 0 件 → 製造に戻すと 3 件）
10. ① サイドバーの件数が即座に更新される。「お気に入り」を押すと一覧が出る。0 件のとき `favEmpty` ＋ `favEmptyHint` が出る。**検索語ありで 0 件のときは `noResults` のまま**
11. ② で 0 件のとき帯が出ない／1〜6 件で「すべて見る」が出ない／7 件以上で出る。③ も同様
12. 詳細画面のボタン文字が「お気に入りに追加」⇄「お気に入りから外す」で切り替わる
13. 3 言語すべてで文言が出る（en にかな無し・zh に日本語漢字表現の混入無し）。ダークモードで星の on/off が両方見える
14. `localStorage.setItem('mock.fav','{{{')` → リロードしても**白画面にならず** 0 件で起動する。`localStorage.removeItem('mock.fav')` → 0 件に戻る
15. `.c-name` が 3 行になるカードが一覧に無い（星の追加で名前の幅が 36px 縮んだ影響。§3-1）
16. ②③ のホームで星を押した後も検索欄が動く（`bindHomeSearch` の再バインドが必要かどうかの確認。§3-8）

### 8-5. reviewer の照合点

1. **`mock/catalog.html` の diff が 0 行**であること
2. **`mock/css/tokens.css` の diff が 0 行**であること（新しい色トークンを作らない約束）
3. `mock/js/data/` の diff が **`ui.js` の `T` 9 キー追加だけ**であること。`catalog.js` / `home.js` / `style.js` / `scenarios/**` は 0 行
4. `tools/regress.baseline.json` の diff が **`counts.ui` 1 行＋`uiKeys` 9 行の追加だけ**であること（§4-2）
5. `components.css` の diff が**追記のみ**で、既存セレクタの宣言が書き換わっていないこと。`#RRGGBB` の直値が 1 つも無いこと
6. `.mockbar` にお気に入りの UI が入っていないこと（§2-4：足場と製品を混ぜない）
7. `.use-row` / `.feed-item` / `.side-link` の**中に `<button>` が入っていない**こと（§3-1 の入れ子ボタン）
8. `localStorage` の読み書きが `app.js` の `loadPrefs` / `savePrefs` の 2 か所だけであること。`js/data/**` に `localStorage` が現れないこと（verify §1 も見るが目でも確認）
9. `renderAll()` が `fav` ハンドラから呼ばれていないこと（§3-8）
10. `CLAUDE.md` が PR に含まれて**いない**こと（更新は PM が別途行う）

---

## 9. §H PM 判断待ち

| # | 論点 | 選択肢 | architect の推奨 |
|---|---|---|---|
| 1 | **`localStorage` に新キー `mock.fav` を足してよいか**（§2-6 の load-bearing） | (a) 足す ／ (b) 足さずセッション限り（リロードで消える） | **(a) 足す**。理由は §2-1。既存 2 キーは 1 バイトも触らず、verify で「4 つ目を作らせない」検査を同時に足す |
| 2 | **お気に入りを業種で分けるか** | (a) 業種ごとに別リスト ／ (b) 業種をまたぐ 1 本 | **(a)**。(b) は 66 件中 10 件だけが引き継がれ、説明できない挙動になる（§1-2） |
| 3 | **① で 0 件のとき「お気に入り」の入口を出すか** | (a) 件数 0 で常に出す ／ (b) 0 件なら隠す | **(a)**。レイアウトが安定し、押せば使い方が分かる。「顧客デモの初期状態に空の項目を出したくない」なら (b) |
| 4 | **「すべて解除」ボタンを作るか** | (a) v1 では作らない ／ (b) お気に入り一覧に置く | **(a)**。デモ前の初期化は devtools で足りる。頻繁に初期化したいなら (b) を別 Issue で |
| 5 | **`mock/index.html`（デモの見方）にお気に入りの説明を足すか** | (a) 本件の後に別 PR ／ (b) 足さない | **(a)**。index.html は**並行作業中**なので同じ PR では触らない（§8-3） |
| 6 | **`docs/dify/platform-components.md` に PC-02・PC-16 の追記をするか** | (a) 別 Issue ／ (b) 今はしない | **(a) 別 Issue**。§6-3 の 2 行。本件の PR には含めない |
| 7 | **星の色** | (a) 既存トークンのみ（on = `--action-primary` の青） ／ (b) 金色の新トークン `--fav-on` を tokens.css に追加 | **(a)**。tokens.css を 1 行も触らずに済み、light/dark 両方のコントラストが既に保証されている。「星は金色でないと直感的でない」と判断するなら (b)（light/dark 2 値の追加が必要） |
| 8 | **PR を 2 本に分けるか** | (a) 2 本・直列 ／ (b) 1 本 | **(a)**。PR-1 は仕組み、PR-2 は置き場所でレビュー観点が違う |
| 9 | **文言の確認**（§5 の 9 キー） | ja/zh/en を本書で確定済み | 顧客向けの言い回しの好みは PM 判断。特に `favNote`「自分で選んだエージェント」／`favEmptyHint`「カード右上の星印を押すと、ここに集まります。」 |

---

## 10. 未確認事項（推測で埋めていないもの）

1. **`bindHomeSearch` の再バインド要否**（§3-8 の 4）：`#home-holder` を差し替えたとき `#search` のリスナが生きているかは、`#search` が `#home-holder` の外にあるかどうかで決まる。②（`hero` 内）と ③（`feed-head` 内）はいずれも外に見えるが、**実装時にブラウザで確認すること**（受け入れ条件 §8-4 の 16）
2. **並行作業が `mock/css/components.css` を触るか**：PM に確認要。触るなら本件を後回しにする（§8-3）
3. **Dify の `is_pinned` の API 形状**（PATCH のパスやパラメータ名）：v1 では使わないので本書では確認していない。§6-2 を実装するときに Dify のソースで確認する
