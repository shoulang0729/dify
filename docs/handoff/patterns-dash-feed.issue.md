# [M/L] 表示パターン ②ダッシュボード / ③業務フィード を実装する（＋管理番号表示）

> `gh` が使えない環境のため、Issue 本文の下書きをここに置く。PM が GitHub に起票する。
> ラベル案：`mock` / `M-L` / `catalog.html`

## 設計書

**`docs/handoff/2026-09-06-patterns-dash-feed.md`**（implementer はこれを読む。設計書は implementer / reviewer は変更しない）

関連：`2026-09-06-customer-catalog-data.md`（A：データ層）／`2026-09-06-demo-scenarios.md`（B：詳細・デモ）／`2026-09-06-pm-decisions.md`

## やること（要約）

`PATTERNS` の ② `dash` / ③ `feed` は `ready: false` のままプレースホルダ（`todoHTML`）。この 2 パターンを実装して、**同じカタログ・同じ詳細/デモ画面に 3 通りの入口から入れる**状態にする。あわせて PM 承認済みの **サービス管理番号表示**（`kn2` → `KN-02`）を ①②③ 共通で入れる。

| | 誰に | 何を前面に |
|---|---|---|
| ② `dash` | デモを見る**工場長**（初めて使う人） | 全体像（41 件 / 提供中 12・試行版 21・構想 8）・よく使われている 6 件・おすすめ 3 件・分類 8 行（成熟度バー付き） |
| ③ `feed` | 実装後に使う**担当者**（李 強・製造二課 課長） | 対応が必要 3・定例 2・お知らせ 2・担当分類 3・最近使った 4 |
| 管理番号 | 全員 | カード右上と詳細ヘッダーに `KN-02` 形式で小さく表示（3 言語共通） |

**設計の肝**：`state` も `view` の値集合も増やさない。**「`view === 'list'` かつ `selCat` / `selSub` / `query` が全部空」＝ホーム**と定義し、そこだけパターンで描き分ける。詳細（`detail`）・デモ（`demo`）・チャット（`chat`）は 3 パターン完全共通で、**1 文字も触らない**。

## 受け入れ条件

### 機械検証
- `node tools/verify.mjs` → **ALL PASS**（新規 FAIL 0。新設の §10 ホームデータ整合と §6 管理番号チェックを含む）
- `node tools/regress.mjs` → 設計書 §10 の**期待差分だけ**が出る → `--update` → 再実行で PASS
  - **PR-0（管理番号）は差分ゼロで PASS。`--update` しない**
  - PR-1（②）：`counts.ui: 49 → 61`、`T` キー 12 追加、`PATTERNS.dash.ready: false → true` のみ
  - PR-2（③）：`counts.ui: 61 → 73`、`T` キー 12 追加、`PATTERNS.feed.ready: false → true` のみ
  - **`CATS` / `SVCS` / `TAGS` の差分行が 1 行でも出たらマージ不可**
  - `counts.cats: 8` / `subs: 17` / `svcs: 41` / `tags: 43` は**不変**（`counts.ui` は 3 言語ラベル追加のため必然的に増える）

### Playwright（`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`、モジュールは `/opt/node22/lib/node_modules/playwright`）
設計書 §15-2 の A-1〜F-10 をすべて実施。特に：
- ①階層ナビの見た目の差分が **管理番号の追加だけ**（それ以外の回帰はゼロ）
- ②で `openCats.kn === true`（初期値）のまま分類「ナレッジ検索・問い合わせ」を押して**5 件のグリッドが出る**（新 act `gocat` がトグルでないことの確認）
- ②③ からサービスを選ぶ → ①と同じ詳細 → 「デモを見る」で同じデモ画面
- 日本語 IME で ②③ の検索欄に入力しても変換が中断しない
- 日 / 中 / 英 で日本語の残りがゼロ。ダークで浮く色がゼロ。管理番号は 3 言語とも同じ
- デモを 2 往復進めてからパターンを切り替えても `state.log` が保持される
- 幅 1100px で横スクロールが出ない

## 触らない範囲（reviewer の diff 監査基準）

- **`CATS` / `SVCS` / `TAGS` / `TEMPLATES` / `SCENARIOS`** — 1 文字も変えない。②③ 用の情報を `SVCS` のフィールドに埋め込むのも禁止（別定数 `HOME` / `FEED` にする）
- **`state` の 11 キー**と `view` の 4 値（`list` / `detail` / `chat` / `demo`）— 増やさない
- 既存 `data-act` 12 種のハンドラ本文（**増えるのは `gocat` の 1 つだけ**）
- `renderSidebar`（②③ はサイドバーを持たない＝現行実装のまま）／`renderSeg`／`gridHTML`／`sendChat`／`panelHTML`／`chipsHTML`／`filtered`
- `cardHTML` は **PR-0 の `.c-top` / `.code` 追加のみ**。PR-1 / PR-2 では差分ゼロ
- `renderMain` の `demo` / `chat` 分岐。`detail` 分岐は **PR-0 の `.d-code` 1 行のみ**
- 1 つ目の `<style>`（トークン）。`--ntt-*` 不変。**dark 用トークンも追加しない**
- `.mockbar` の構造（②③ の有効化は `ready: true` だけ）／ヘッダー（言語・テーマ切替、`dept`）／`localStorage` キー
- `T` の既存 49 キー（**`todoEyebrow` / `todoTitle` を削除しない**）
- `tools/regress.mjs` のロジック／`pages.yml`／`.nojekyll`／`index.html`／`top.html`
- `CLAUDE.md`（更新は PM が行う。設計書 §13 参照）

## PR の分割案（**直列**：PR-0 → PR-1 → PR-2）

| # | 内容 | 主な差分 |
|---|---|---|
| **PR-0** | 管理番号表示（①②③ 共通） | `pad2` / `svcCode` ヘルパー、`cardHTML` の `.c-top` 化、`detail` に `.d-code` 1 行、`.code` 系 CSS 3 行、`verify.mjs` §6 に id 形式・番号重複チェック。**`regress` は差分ゼロ（`--update` しない）** |
| **PR-1** | ② ダッシュボード ＋ 共通土台 | `T` 12 キー（`backHome` 含む）、`HOME` 定数、**新 act `gocat`**、`renderMain` のホーム分岐 4 行、`list` 分岐の「‹ ホームへ戻る」、`bindHomeSearch` / `renderDash` / `dashSectionsHTML`、`.dash-*` CSS、`PATTERNS.dash.ready = true`、`verify.mjs`（`requiredActs` に `gocat`・新設 §10 の `HOME` 部分）、`regress --update` |
| **PR-2** | ③ 業務フィード | `T` 12 キー、`FEED` 定数、`renderFeed` / `feedSectionsHTML` / `feedItemHTML`、`.feed-*` `.side-*` CSS、`PATTERNS.feed.ready = true`、`verify.mjs` §10 の `FEED` 部分、`regress --update`、`mock/README.md` の A 行 |

**並列不可**。`mock/catalog.html` の `T` 末尾・`renderMain` のホーム分岐（同一 hunk）・`PATTERNS`（隣接 2 行）・`@media (max-width:1180px)`・`verify.mjs` の新設 §10・`regress.baseline.json` の `uiKeys` が重なる。各 implementer は**前の PR が main にマージされてからブランチを切る**。

ブランチ名案：`feat/<issue>-svc-code` / `feat/<issue>-pattern-dash` / `feat/<issue>-pattern-feed`

## PM 判断待ち（設計書 §12。推奨案どおりで進めてよければ「承認」だけください）

| # | 論点 | architect 推奨 |
|---|---|---|
| D-1 | ②の「よく使う」の意味 | 社内全体の実績（手選びのサンプル値）。個人履歴は③の「最近使った」が担当 |
| D-2 | 利用件数（今月 312 件など）を出すか | 出す。ただし「デモ用のサンプル値」の注記を必ず併記 |
| D-3 | ②のおすすめ 3 件（dc1 / kn2 / qa3） | このまま |
| D-4 | ③のペルソナ（李 強・製造二課 課長・蘇州工場） | このまま（`SCENARIOS` 既出の人物） |
| D-5 | ヘッダーの「情報システム部」を③に合わせるか | 合わせない（①への回帰を避ける） |
| D-6 | ③の疑似イベント 7 件（期限3／定例2／通知2） | このまま |
| D-7 | ③に絶対日付を出すか | 出さない（相対表現のみ。デモ日が変わっても古びない） |
| D-8 | ②③でサイドバーを隠すか | 隠す（現行 `renderSidebar` のまま） |
| D-9 | ②③に「すべてのサービス一覧」への導線 | 置かない（①の役割。検索と分類タイルで代替） |
| D-10 | `counts.ui` を不変にできない件 | PR ごとに `regress --update`。「`counts` 不変」は `cats`/`subs`/`svcs`/`tags` の 4 つと読み替え |
| D-11 | ②の h1「AIエージェント ホーム」 | このまま（効果訴求の文言は入れない） |
| D-12 | ②③ のモック承認タイミング | PR-1 マージ後に Pages で② を確認 → PR-2 着手 |
| D-13 | 管理番号で検索できるようにするか | 今回はしない（`filtered()` は触らない）。要るなら別 Issue |
| D-14 | 管理番号を `chat`/`demo` ヘッダーや ③ の項目にも出すか | 出さない（カードと詳細の 2 か所に絞る） |

## `CLAUDE.md` への影響（PM が更新。設計書 §13）

- §2-3「遷移」：`data-act` を 12 種 → **13 種**（`gocat` を追加）
- §2-3「データ」：**`HOME` / `FEED`** を追加（いずれも `SVCS` に埋め込まない別定数）
- §2-9：`SVCS[].id` は管理番号（`KN-02`）として**顧客に見える**ので、改名せず欠番＋新 id にする、を 1 文追記
- §6 バックログ：②③ を完了に更新（「並列可」は誤りだったので「直列」に訂正）
