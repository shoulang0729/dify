# Issue 本文（`gh` が使えない環境のため書き出し。PM が GitHub に貼る）

> ラベル案：`mock` / `design-done` / `needs-pm-decision`
> 関連：#120 の派生

---

## タイトル

`feat(mock): お気に入り（Favorites）— サービス単位・業種ごと・①②③ すべてに露出`

---

## 本文

### 設計書

`docs/handoff/2026-09-08-favorites.md`

レーン：**M**（`state` の形・`localStorage` キー・`data-act` 一覧・`T` に触る＝CLAUDE.md §2-3 / §2-6 / §2-1 の load-bearing）

### 背景

PM から「お気に入り機能が欲しい（もし Dify にあるのならば）」。
2026-09-08 に PM が Dify のソースで確認済み：`api/models/model.py` の `InstalledApp.is_pinned`、`api/controllers/console/explore/installed_app.py` で切替。**お気に入りは Dify にも実在する概念**なので、`.mockbar`（レビュー用の足場）ではなく**ヘッダー配下の本番相当の画面に置くプロダクト機能**として設計する（CLAUDE.md §2-4）。

### 決めたこと（要約）

| | 結論 |
|---|---|
| 単位 | サービス単位（`SVCS[].id`）。分類・タグはお気に入りにしない |
| 業種 | **またがない**。業種ごとに別リスト（横断サービス 10 件も引き継がない） |
| 永続化 | **`localStorage` に新キー `mock.fav` を 1 つだけ追加**（`{"mfg":["kn1"],"fin":[]}`）。既存 `mock.lang` / `mock.theme` は 1 バイトも触らない → **§2-6 の変更なので PM 承認が要る** |
| `state` | `fav`（業種キーの id 配列）と `favOnly`（お気に入りだけ表示中か）を追加 |
| データ層 | `mock/js/data/**` には**置かない**（`SVCS`・`HOME`・`FEED` に埋め込まない。`added` と同じ流儀） |
| `data-act` | **`fav`**（付け外し）と **`favlist`**（お気に入り一覧へ）を追加。既存 12 種の意味は変えない |
| カード | 右上に星ボタン（**塗り／輪郭の形で区別**。色だけに頼らない）。NEW・管理番号・タグ・成熟度は 1 つも減らさない |
| ① 階層ナビ | 「すべてのサービス」の直下・区切り線の上に「お気に入り」＋件数。**0 件でも出す** |
| ② ダッシュボード | `dash-duo` の上に全幅の帯（カード最大 6 ＋「すべて見る」）。**0 件なら帯ごと出さない**（新着帯と同じ規則） |
| ③ 業務フィード | 右レール最上段にボックス（最大 6 行）。「明示（お気に入り）→ 担当分類 → 自動（最近使った）」で住み分け |
| 詳細画面 | `cta-row` に文字ラベル付きトグル。`chat` / `demo` には置かない |
| regress | **お気に入りの中身は対象外**（利用者の状態）。ただし `T` が 9 キー増えるので `counts.ui: 78 → 87` の差分は出る＝`--update` が必要 |
| Dify | `is_pinned` と**同期しない**。将来は PC-16 本番 UI ＋ PC-02 認証で、カタログ → Dify の一方向のみ検討 |

### 受け入れ条件（機械検証）

1. `node tools/verify.mjs` が **FAIL 0**。かつ **warn の件数・内容が main と同じ**（新 9 キーがすべて参照され「未使用キー」warn が増えていない）
2. `node tools/regress.mjs` の差分が **`counts.ui: 78 → 87` と `T(UI キー) 追加: favAdd, favAddAria, favEmpty, favEmptyHint, favNote, favRemove, favRemoveAria, favSeeAll, favTitle` の 9 件だけ**。`cats` / `subs` / `svcs` / `tags` / `patterns` / `industries` の差分は **0 件**。`--update` 後に PASS
3. `npm test` が PASS
4. `tools/verify.mjs` §7 に **`state.fav` / `state.favOnly`・`data-act` の `fav` / `favlist`・`localStorage` 許可集合 3 キー（`mock.lang` / `mock.theme` / `mock.fav`）** の検査が入っている
5. `mock/js/app.js` に `localStorage.getItem('mock.zzz')` を一時的に足すと **verify §7 が FAIL する**（新検査が効いている証拠。確認後に戻す）

### 受け入れ条件（手動）

6. 星を押しても**一覧のスクロール位置が動かない**（`renderAll()` を呼ばない）
7. Tab だけで星に到達、Enter と Space の両方でトグル、`aria-pressed` が切り替わる
8. リロード・言語切替・テーマ切替・パターン切替（①②③）で消えない
9. **業種を切り替えると別のリストになる**（製造 3 件 → 金融 0 件 → 製造に戻すと 3 件）
10. 0 件のとき：① は `favEmpty` ＋ `favEmptyHint`、②③ は帯／ボックスごと出ない。**検索語ありで 0 件のときは既存の `noResults`**
11. 7 件以上のときだけ ②③ に「すべて見る（N）」が出る
12. 3 言語すべてで文言が出る（en にかな無し）。**ダークモードで星の on/off が両方見える**
13. `localStorage.setItem('mock.fav','{{{')` → 白画面にならず 0 件で起動
14. `.c-name` が 3 行になるカードが一覧に無い（星の追加で名前の幅が 36px 縮む影響）

### 触らない範囲（明示）

- **`mock/catalog.html`**（1 行も変えない。`<script src>` / `<link>` を増やさない）
- **`mock/css/tokens.css`**（新しい色トークンを作らない。星は `--action-primary` / `--text-secondary` だけで描く）
- **`mock/index.html`・`mock/scripts.html`**（**並行作業中**。デモガイドへの説明追加は本件マージ後に別 PR）
- **`mock/js/data/catalog.js`・`home.js`・`style.js`・`scenarios/**`**（0 行）
- `mock/js/data/ui.js` は **`T` に 9 キー追加のみ**（`TAGS` / `PATTERNS` / `TEMPLATES` / `INDUSTRIES` は触らない）
- `mock/css/components.css` は**追記のみ**（既存セレクタの宣言を書き換えない。色の直値禁止）
- `localStorage` キー `mock.lang` / `mock.theme`
- `.mockbar`（お気に入りの UI を 1 つも置かない）
- `dify/**`・`data/world/**`・`docs/dify/**`
- **`CLAUDE.md`**（設計書 §7 は文案。適用は PM）・`.claude/**`

### PR の分割案（**2 本・直列**。`render.js` と `ui.js` が重なるので並列にしない）

**PR-1「土台と ①」**
`state.fav` / `state.favOnly`・ヘルパー 4 つ（`favIds` / `isFav` / `favList` / `toggleFav`）・`loadPrefs`/`savePrefs` の拡張・`filtered()` の 1 行・`T` 9 キー・カードの星・詳細画面のトグル・① サイドバーの入口と `favOnly` 一覧＋空状態・`data-act` `fav`/`favlist`・既存 5 ハンドラ（`all`/`cat`/`sub`/`gocat`/`industry`）への `favOnly = false`・`verify.mjs` §7 拡張・`regress --update`・CSS 追記
→ `mock/js/app.js`・`render.js`・`events.js`・`data/ui.js`・`css/components.css`・`tools/verify.mjs`・`tools/regress.baseline.json`

**PR-2「②③ への露出」**
② `dashSectionsHTML` にお気に入り帯（最大 6 ＋「すべて見る」）・③ `feedSectionsHTML` の右レール最上段にボックス・CSS 追記
→ `mock/js/render.js`・`css/components.css`

PR-1 単体でも機能は成立する（3 パターンでカードの星が使え、① から一覧に行ける）。

### reviewer の照合点

1. `mock/catalog.html` の diff が **0 行**
2. `mock/css/tokens.css` の diff が **0 行**
3. `mock/js/data/` の diff が **`ui.js` の 9 キー追加だけ**
4. `tools/regress.baseline.json` の diff が **`counts.ui` 1 行 ＋ `uiKeys` 9 行の追加だけ**
5. `components.css` は追記のみ・`#RRGGBB` の直値 0
6. `.mockbar` にお気に入りの UI が無い（§2-4）
7. **`.use-row` / `.feed-item` / `.side-link` の中に `<button>` が入っていない**（これらは `<button>` なので入れ子は不正 HTML）
8. `localStorage` の読み書きが `app.js` の `loadPrefs` / `savePrefs` の 2 か所だけ
9. `fav` ハンドラから `renderAll()` を呼んでいない
10. `CLAUDE.md` が PR に含まれていない

### PM 判断待ち（設計書 §9。**#1 は着手前に必要**）

| # | 論点 | 推奨 |
|---|---|---|
| **1** | **`localStorage` に新キー `mock.fav` を足してよいか（§2-6 の load-bearing）** | **足す**。既存 2 キーは無変更・verify で「4 つ目を作らせない」検査を同時に足す |
| 2 | お気に入りを業種で分けるか | **分ける** |
| 3 | ① で 0 件のとき入口を出すか | **出す（件数 0）** |
| 4 | 「すべて解除」ボタン | **v1 では作らない** |
| 5 | `mock/index.html` への説明追加 | **本件マージ後に別 PR**（並行作業中のため） |
| 6 | `docs/dify/platform-components.md`（PC-02 / PC-16）への追記 | **別 Issue** |
| 7 | 星の色 | **既存トークンのみ（on は青 `--action-primary`）**。金色にするなら tokens.css に light/dark 2 値の追加が必要 |
| 8 | PR を 2 本に分けるか | **2 本・直列** |
| 9 | 文言（9 キーの ja/zh/en は設計書 §5 に確定済み） | 言い回しの好みは PM 判断 |
