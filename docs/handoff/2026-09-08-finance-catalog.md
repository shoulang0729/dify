# 金融（在中日系銀行）カタログの新設と業種切替 — 設計書

- 日付：2026-09-08
- レーン：**L**（データ層・多言語辞書・共通レイヤー契約・検査ツール・`data/world`・`dify/` すべてに触る）
- 対象：`mock/**`（データ層・アプリ層・`catalog.html`・`tokens.css`）／`tools/**`／`data/world/**`／`docs/**`／`dify/env/**`（`dify/apps/**` は §5 の方針のみ、実装は後続）
- 元データ：PM が Excel から抽出した 30 件（リポジトリ外の scratchpad。**本書にも実名・提出者名は書かない**。以下「元＃1〜＃30」で参照する）
- 前提設計書：`docs/handoff/2026-09-07-usecase-intake.md`（統廃合 5 軸）／`2026-09-07-split-catalog.md`（読み込み契約）／`2026-09-07-repo-layout-v2.md`（4 区分・env・world）／`2026-09-06-patterns-dash-feed.md`（①②③）

---

## 0. 前提と、本書で決めたことの要約

### 0-1. PM 決定（再検討しない）

1. 1 つのデモに「製造業／金融」の業種切替を持たせる。データ層は業種ごと、描画ロジック・トークン・デザインは共通
2. 元 30 件すべてを新カタログに載せる。現実性は成熟度 `st` で表す
3. 架空の金融世界を `data/world/` に新設。既存の製造業マスタと混ぜない
4. 管理番号は既存規則のまま。既存 8 コード（KN/QA/DC/LG/NM/EN/GN/PT）と衝突しない新コードを割り当てる
5. **（追加条件）業種を問わない機能は、製造業と金融の両方のカタログに出る。ただしデモで見せる中身（ペルソナ・拠点・数字・KB・台本）は選択中の業種の世界で語られる**

### 0-2. 本書の結論（1 画面分）

| 決めたこと | 結論 |
|---|---|
| 業種の持ち方 | **案 1（`industries` を分類・中分類・サービスに持たせる）を採用**。`CATS` / `SVCS` は 1 本のまま。台本 `SCENARIOS` だけ業種で 2 階層にする（§1） |
| 管理番号 | **業種横断サービスも管理番号は 1 つ**。分類を業種で共有し、通番は分類内で業種を跨いで連番（§1-3） |
| 統廃合の結果 | 元 30 件 → **新規サービス 23 件 ＋ 既存サービスへの統合 5 件**（§2） |
| 分類コード | 新設 5 個：**RS / CV / FA / PO / EG**。既存 KN・DC・GN を業種共有に変更（§3） |
| 件数 | グローバル **66 件**（製造 48 ／ 金融 28 ／ うち両業種 10）。分類 8 → 13、中分類 17 → 29、タグ 43 → 56 |
| 業種切替の置き場 | **`.mockbar`（レビュー用の足場）**。ヘッダー（プロダクト機能）に置かない（§4-1） |
| `state` | `state.industry` を追加（CLAUDE.md §2-3 の更新文案は §7-1。適用は PM） |
| `localStorage` | **新キーを作らない**。業種はパターンと同じ「足場の一時状態」（§4-5） |
| `dify/apps/` | **平置きのまま。業種でディレクトリを分けない**（§5-1） |
| PR 分割 | 6 本（§6） |

### 0-3. 本書の文言分担（重要）

- **3 言語（ja/zh/en）を本書で確定するもの**：UI 文言（`T` の追加・削除）・`INDUSTRIES`・分類と中分類の `name`/`abbr`・タグ・**サービスの `name` と `desc`**・②おすすめの理由・②③ペルソナ
- **ja だけ本書に書き、zh/en を implementer が ja を原文に作るもの**：**③業務フィードの `when`/`note`** と **台本（`SCENARIOS` の `steps`/`script`/`input`/`result`）**。分量が本書の可読性を超えるため。§2-1 の 3 言語同時投入は `tools/verify.mjs` §2 が機械検出するので欠落は起きない
- この分担が不可なら PM が差し戻すこと（§9 の判断待ち #13）

### 0-4. 触らない範囲（明示）

- `mock/css/tokens.css` の **`--ntt-*`（ブランドパレット）**：1 行も変えない。追加するのは `--cat-rs/cv/fa/po/eg` とその `-bg`（light・dark 両方）だけ
- `mock/css/components.css`：**色の直値を入れない**。業種切替は既存の `.segwrap` / `.seg` を 1 組増やして使う（新規クラス・新規色トークンを作らない）
- **既存 43 件の `id` / `cat` / `sub` / `st` / `tags` / 配列内の並び順**：1 件も変えない（`industries` の 1 行追加と、KN-04 の `name`/`desc` 改訂だけが例外。改訂は §2-4-2 で PM 承認事項）
- `mock/js/data/scenarios/*.js` の**台本本文**：PR-1 の移動では 1 バイトも変えない（先頭 2 行のラッパーのみ）
- `mock/js/render.js` のパターン分岐（① / `renderDash` / `renderFeed`）の**構造**：業種でパターンを増やさない。①②③ は両業種共通
- `localStorage` キー `mock.lang` / `mock.theme`
- `.github/workflows/pages.yml`（`path: mock` のまま）
- `.claude/**`
- `CLAUDE.md`：本書は**更新文案を出すだけ**。適用は PM

---

## 1. 設計の中核 — 業種横断サービスをどう持つか

PM の追加条件「業種を問わない機能は両方のカタログに出る／デモの中身は選択中の業種の世界で語られる」を満たす持ち方を 3 案で比較する。

### 1-1. 3 案の比較

| | 案 1 サービスに `industries` | 案 2 共通サービス群＋業種固有群の 2 層 | 案 3 業種ごとに完全独立 |
|---|---|---|---|
| データの形 | `CATS` / `SVCS` は 1 本。各要素が `industries: ['mfg','fin']` を持つ | `SVCS_COMMON` / `SVCS_MFG` / `SVCS_FIN` の 3 配列を描画時に合流 | `data/mfg/*.js` と `data/fin/*.js` に丸ごと 2 セット |
| 管理番号 | **1 サービス 1 番号**が自然に守れる（`SVCS` が 1 本＝ id の一意性が構造で保証される） | 3 配列に跨る id 重複を検査で防ぐ必要がある | **同じ機能に番号が 2 つ**付く。または業種プレフィクスが要る |
| 「両方に出る」の表現 | `industries` の 1 行 | 共通群に置くだけ | 表現できない（コピーになる） |
| 「中身は選択中の業種で」 | `SCENARIOS[industry][id]` で解決 | 同じ | 同じ |
| 既存 43 件への影響 | `industries: ['mfg']` の 1 行追加（機械的） | **43 件を 2 配列に振り分け直す**＝並び順が動き regress 差分が読めなくなる | 影響なし（そのまま） |
| `tools/regress.mjs` | `svcs[]` に `industries` が 1 列増えるだけ。既存 43 件の id/cat/sub/st/tags 行は不変 | 配列が分かれるとスナップショットの構造が大きく変わる | 業種ごとに基準が 2 本。共通機能の退行が片方でしか見えない |
| `tools/gen-index.mjs` | 1 管理番号 = 1 行のまま（業種列を足す） | 同じ | 番号が 2 系統になり索引が二重帳簿になる |
| `dify/apps` `dify/kb` `dify/tests` | 管理番号キーのまま（§5） | 同じ | **実装資産が二重化**（PM の「既存資産を流用できる」に反する） |
| 判定 | **採用** | 不採用（利点が案 1 と同じで、既存 43 件の並び替えという実害だけがある） | **不採用**（PM 意図に反する。理由は下記） |

**案 3 を採らない理由**（PM の当初指示を差し替える）

1. 「議事録」「ToDo 追跡」「報告レビュー」「FAQ 応答」は**同じ機能**であって、業種で別サービスにすると顧客に 2 回説明することになる。PM の追加条件はまさにこれを否定している
2. 管理番号の一意性（§2-11 の load-bearing）が壊れる。`DC-02` と `BO-03` が同じものだという対応表を、設計書・Issue・PR・チャットで人が引き続けることになる
3. `dify/apps/<番号>-*.yml`・`dify/kb/<番号>/`・`dify/tests/<番号>.json`・`docs/dify/usecases/<番号>.md`・`env.yml` の `apps:`/`knowledge:` が**すべて管理番号キー**。番号が 2 つになれば実装資産も 2 倍になる
4. 永久欠番の台帳（§2-11）が業種ごとに二重帳簿になる

### 1-2. 採用する形

```js
// mock/js/data/catalog.js
const CATS = [
  { id: 'kn', industries: ['mfg', 'fin'], name: {...}, abbr: {...},
    subs: [
      { id: 'tech',   industries: ['mfg'],        name: {...} },
      { id: 'rule',   industries: ['mfg','fin'],  name: {...} },
      { id: 'bizlog', industries: ['fin'],        name: {...} }
    ]},
  ...
];

const SVCS = [
  { id: 'kn1', cat: 'kn', sub: 'tech', st: 1, industries: ['mfg'], tags: ['search'], name: {...}, desc: {...} },
  ...
];
```

- **`industries` は `CATS` / `subs` / `SVCS` すべてで必須**（省略時の既定値を作らない）。既定値は「銀行のメニューに図面が出る」ような静かな事故を生む。`tools/verify.mjs` §6 で FAIL にする
- 値は `['mfg']` / `['fin']` / `['mfg','fin']` の 3 通りのみ（順序も `mfg` → `fin` に固定。regress の文字列比較を安定させるため）
- 整合規則（verify で検査）：
  - `SVCS[].industries` ⊆ その `cat` の `industries` かつ ⊆ その `sub` の `industries`
  - どの業種でも、各分類は**その業種で見えるサービスを 1 件以上**持つ（空の分類がメニューに出ない）
  - どの中分類も、その業種で見えるサービスが 0 件なら、その業種では描かない（`subs[].industries` に頼らずサービス側からも判定できるが、**中分類は宣言を正**とする）

### 1-3. 管理番号は 1 サービス 1 番号（結論と、分類コード問題の解き方）

**結論：業種横断サービスにも番号は 1 つだけ振る。**

分類コードが業種で変わる問題は、**分類そのものを業種で共有する**ことで消える。

- 分類コードは「業種」ではなく「サービスの性質」に付く。`DC`（文書・資料作成）は製造業にも銀行にもある
- したがって `DC-02 議事録作成` は**両業種で `DC/report` に出る**。番号は `DC-02` の 1 つ
- **通番は分類内で業種を跨いで連番**。例：`KN-01`〜`KN-05` は製造業由来、`KN-06`〜`KN-08` は金融由来。金融のメニューでは `KN-04 / KN-05 / KN-06 / KN-07 / KN-08` が並び、`KN-01`〜`KN-03` は出ない＝**その業種では欠番に見える**。これは §2-11 の「永久欠番」と同じ読み方で説明できる
- 番号から業種は読めない。読めなくてよい（番号は「何のサービスか」を一意に指すための識別子であって、分類でも業種でもない）

**トレードオフ（記録）**：金融の担当者がメニューで `KN-04, KN-05, KN-06…` と飛び番を見る。`docs/handoff/service-index.md` に業種列を足し（§4-8）、`mock/index.html` の「管理番号」節に「番号は業種を跨いだ通し番号なので、自分の業種では飛び番になる」と 1 文足す（文案は implementer）。

### 1-4. 台本（`SCENARIOS`）だけ業種で 2 階層にする

「デモの中身は選択中の業種の世界で語られる」を満たす唯一の場所が台本。

```js
// mock/js/data/scenarios/mfg/kn.js
window.SCENARIOS = window.SCENARIOS || {};
window.SCENARIOS.mfg = window.SCENARIOS.mfg || {};
Object.assign(window.SCENARIOS.mfg, { kn1: { ... }, ... });   // ← 中身は 1 バイトも変えない
```

- `SCENARIOS[industry][svcId]`。アプリ層のアクセサは `scnOf(id)` → `(SCENARIOS[state.industry] || {})[id] || null`（`app.js` の 1 行変更）
- **`template` は業種ごとに違ってよい**。同じサービスでも見せ方が業種で変わることがある（例：`KN-05` は製造業では `upload`、金融では `qa`）。`TEMPLATES` は共通
- 業種横断サービスに片側の台本しか無い場合、その業種では `start` が `chat` にフォールバックする（§2-3 の既存仕様）。**verify は「台本の無い SVCS」を業種ごとに warn**（FAIL にしない）＝台本を後続 PR に回せる
- ファイル配置：`mock/js/data/scenarios/<industry>/<分類コード小文字>.js`

### 1-5. `HOME` / `FEED` も業種キーで持つ

```js
const HOME = { mfg: { frequent: [...], recommended: [...] }, fin: { ... } };
const FEED = { mfg: { persona, mine, recent, items }, fin: { ... } };
```

- アクセサは `home()` = `HOME[state.industry]` / `feed()` = `FEED[state.industry]`（`app.js` に 2 行追加）
- 参照 id は**その業種で見えるサービス／分類でなければ FAIL**（verify §10 を業種対応にする）

### 1-6. 業種で分けないもの（記録）

| 対象 | 理由 |
|---|---|
| `T`（UI 文言） | 画面固定文言は業種に依存しない。会社名・部署名だけは `INDUSTRIES` へ移す（§4-3） |
| `TAGS` | 1 つの辞書を共有。業種固有タグは自然に片側でしか使われない（未使用タグの warn は全体で見る） |
| `TEMPLATES` | デモ画面テンプレート 5 種は共通 |
| `PATTERNS`（①②③） | 表示パターンは業種と直交。両業種で 3 パターンすべて動く |
| `CAT_STYLE` | 分類 id がグローバルに一意なので分ける必要がない。新分類 5 個のアイコンを足すだけ |
| CSS トークン・レイアウト | §2-2 のまま。業種で色を変えない |

---

## 2. §A 統廃合 — 元 30 件 → 最終サービス一覧

### 2-1. 5 軸判定（`2026-09-07-usecase-intake.md` §3-1）の適用結果

判定が「そのまま」以外のものだけ根拠を書く。軸は A 分類 / B タグ / C ペルソナ / D 入出力 / E 出口。

| 突き合わせ | A | B | C | D | E | 一致 | 判定 | 根拠 |
|---|---|---|---|---|---|---|---|---|
| ＃4 議案・報告書 × ＃5 過去提案書 | ○ | ○ | ○ | ○ | × | 4 | **統合（テンプレート選択）** | 入力（最低限の情報＋過去文書の蓄積）と出力（ドラフト）が同種。出口だけが社内承認 / 顧客提出で分かれる → §3-3 の「フォームの 1 項目で切り替えられる」に該当。DC-08 と同じモード制 |
| ＃7 公開情報の自動収集 × ＃30 ネガティブニュース収集 | ○ | ○ | ○ | ○ | △ | 4 | **統合（モード）** | どちらも「条件設定 → 収集 → 要約 → 配信」。ネガティブ限定は収集条件の 1 項目 |
| ＃7+＃30 × ＃17 Market researcher | ○ | ○ | △ | × | × | 2 | **別サービス** | ＃17 は入力にブローカーリサーチ・開示が入り、出力が「与信/リスクレビュー用の論点」＝分析レポート。＃7+30 はクリッピングと配信。出口が定期配信 vs 与信レビュー会議で違う。**PM の候補（＃17 も 1 本に）を採らない** |
| ＃8 顧客 IR × ＃15 Earnings reviewer | ○ | ○ | × | × | × | 2 | **別サービス** | ＃8 は法人営業・審査が読む日本語要約と同業比較、＃15 は投資側が財務モデルを更新して投資仮説の変化をフラグする。出口が顧客提案 / 投資判断で違う |
| ＃15 Earnings reviewer × ＃16 Model builder | ○ | ○ | ○ | ○ | ○ | 5 | **統合（モード：新規作成 / 決算反映）** | どちらも入力＝開示資料・データフィード、出力＝財務モデル。＃15 は「更新」＝＃16 の保守モード |
| ＃16 × ＃18 Valuation reviewer | ○ | ○ | ○ | × | × | 3 →**分離** | **別サービス** | ＃16 は作る、＃18 はレビュー基準に照らして**チェックする**。入力（開示・フィード vs 出来上がったバリュエーション資料）も出力（モデル vs 指摘）も違い、同時に出すと片方が邪魔（§3-3 の分割条件）。**PM のヒント（＃18 と ＃16 は近い）を採らない** |
| ＃9 情報サービスプロバイダー × ＃10 WIND | ○ | ○ | ○ | ○ | ○ | 5 | **統合（データ源選択モード）** | どちらも「照会キーを入れて外部データを引き、表・分析を返す」。データ源はフォームの 1 項目で切り替えられる（§3-3）。WIND は既定のデータ源として名前を残す（実名の扱いは §9 #3） |
| ＃13 Pitch builder × ＃14 Meeting preparer | ○ | ○ | ○ | △ | × | 3 →**分割** | **別サービス** | ＃14 は面談直前に 1 枚を作る短サイクル（③フィードに載る性質）、＃13 は案件組成の資料作成。同時に出すと片方が邪魔 |
| ＃19 GL リコン × ＃20 月次クローズ | ○ | ○ | ○ | × | × | 3 →**分割** | **別サービス** | 入力が GL/NAV vs チェックリスト・仕訳。出口が差異調査 vs 決算確定。PM の指摘どおり |
| ＃21 Statement auditor × ＃18 Valuation reviewer | ○ | ○ | × | △ | × | 2 | **別サービス** | レビューという形は同じだが、読み手（経理 / IB）も基準も違う |
| ＃1 事務手続照会 × ＃2 当局通達 DB | ○ | △ | △ | × | × | 2 | **別のまま**（PM 決定どおり） | KB も観点も違う |
| ＃2 当局通達 DB × 既存 KN-05 当局通達の影響分析 | ○ | ○ | × | △ | × | 3 →**分離＋既存を業種横断化** | ＃2 は「登録して引く・過去と比べる」DB、KN-05 は「影響を分析してマニュアルに反映する」ワークフロー。出口が違うので**別サービス（KN-08）を新設**。ただし KN-05 は名称に NFRA を含み金融でもそのまま通じるので `industries: ['mfg','fin']` にする |
| ＃12 音声から議事録 × 既存 DC-02 | ○ | ○ | ○ | ○ | ○ | 5 | **既存へ統合＋業種横断化** | DC-02 をそのまま使う。「音声入力」は DC-02 の将来拡張（現行 DSL は文字起こしテキストのみ。`docs/dify/usecases/DC-02.md` に追記する） |
| ＃24 週報・月報 | — | — | — | — | — | — | **目的別分割（2 つに割る）** | 前半「報告のもれ・整合性のリアルタイムチェック＆提出」＝ **DC-08 提出前モードそのもの → DC-08 へ統合**。後半「稼働状況を収集し月末のコスト配分にサジェスト」＝入力（稼働実績）も出口（コスト配分）も違う → **新規 PO-04** |
| ＃25 QA のスタック・回答・評価 × 既存 KN-04 | ○ | ○ | △ | ○ | △ | 3〜4 | **既存へ統合＋業種横断化＋改称** | 「受け付ける・答えられなければ人に促す・回答を台帳に貯める・定期統計」は KN-04 の中身と同じ。ただし現行名「労務・総務の社内問い合わせ対応」は製造業寄りなので**業種中立に改称**（§2-4-2） |
| ＃28 ToDo 鬼トレース × 既存 GN-06 | ○ | ○ | ○ | ○ | ○ | 5 | **既存へ統合＋業種横断化** | GN-06 の設計（票化・期限と放置日数での並べ替え・振った側/振られた側の集計）と一致。「チャットの一言で追加・削除」も GN-06 の入力形式と同じ |

### 2-2. 最終サービス一覧（新規 23 件）

- 「利用者」列は元データの G 列（銀行／企業／自社）。**分類にしない。`TAGS` にもしない**（§3-4 で理由）
- 「優先度」列の ★ は元データの H 列。**データ層に持たせない**（§3-5）
- 成熟度 `st`：★ 6 件は `2`（試行版）、それ以外の新規は `3`（構想）

| 元＃ | 管理番号 | 内部 id | 名称（ja） | 分類/中分類 | st | 画面 | 利用者 | ★ | 判定 |
|---|---|---|---|---|---|---|---|---|---|
| ＃1 | **KN-06** | `kn6` | 事務手続の照会 | KN/rule | 2 | qa | 銀行・企業・自社 | ★ | そのまま |
| ＃6 | **KN-07** | `kn7` | 行内営業情報の検索（日誌・接触履歴） | KN/bizlog | 3 | qa | 銀行 | | そのまま |
| ＃2 | **KN-08** | `kn8` | 当局通達・ガイドラインDB（照会・過去比較） | KN/rule | 2 | diff | 銀行 | ★ | そのまま（KN-05 とは分離） |
| ＃4 ＃5 | **DC-09** | `dc9` | 議案・報告書・提案書のドラフト作成（テンプレート選択） | DC/report | 2 | form | 銀行・企業・自社 | ★ | 統合（2→1・モード制） |
| ＃7 ＃30 | **RS-01** | `rs1` | 企業・業界ニュースの自動収集と配信 | RS/news | 2 | form | 銀行・企業・自社 | ★ | 統合（2→1・モード制） |
| ＃17 | **RS-02** | `rs2` | セクター・発行体のモニタリング | RS/news | 3 | form | 銀行 | | 分離（RS-01 に統合しない） |
| ＃8 | **RS-03** | `rs3` | 顧客IR・決算の収集と日本語要約・比較 | RS/disc | 2 | upload | 銀行・企業・自社 | ★ | 分離（FA-04 に統合しない） |
| ＃9 ＃10 | **RS-04** | `rs4` | 市場・企業データの照会（金融情報端末・契約データベース） | RS/data | 2 | lookup | 銀行 | ★ | 統合（2→1・データ源モード） |
| ＃11 | **RS-05** | `rs5` | ダッシュボード出力からの気づき分析 | RS/data | 3 | upload | 銀行 | | そのまま |
| ＃13 | **CV-01** | `cv1` | 提案・ピッチ資料の作成（候補先選定・比較企業分析） | CV/pitch | 3 | form | 銀行・企業・自社 | | 分割（CV-02 と分ける） |
| ＃14 | **CV-02** | `cv2` | 面談前ブリーフの作成 | CV/pitch | 3 | form | 銀行・企業・自社 | | 分割 |
| ＃3 | **CV-03** | `cv3` | 審査コメントのドラフト作成 | CV/credit | 3 | upload | 銀行 | | そのまま |
| ＃22 | **CV-04** | `cv4` | KYCスクリーニングとエスカレーション整理 | CV/kyc | 3 | upload | 銀行・企業・自社 | | そのまま |
| ＃19 | **FA-01** | `fa1` | GL勘定のリコンシリエーション | FA/close | 3 | upload | 銀行 | | 分割（FA-02 と分ける） |
| ＃20 | **FA-02** | `fa2` | 月次クローズの実行と報告 | FA/close | 3 | form | 銀行・企業・自社 | | 分割 |
| ＃21 | **FA-03** | `fa3` | 財務諸表のレビュー（整合性・監査対応） | FA/close | 3 | upload | 銀行・企業・自社 | | そのまま |
| ＃15 ＃16 | **FA-04** | `fa4` | 財務モデルの作成と決算反映 | FA/model | 3 | upload | 銀行 | | 統合（2→1・モード制） |
| ＃18 | **FA-05** | `fa5` | バリュエーションのレビュー | FA/model | 3 | upload | 銀行 | | 分離（FA-04 に統合しない） |
| ＃23 | **PO-01** | `po1` | アンケート・インタビュー収集 | PO/collect | 3 | qa | 自社 | | そのまま（**業種横断**） |
| ＃26 | **PO-02** | `po2` | アイデアの募集・蓄積・投票集計 | PO/collect | 3 | form | 自社 | | そのまま（**業種横断**） |
| ＃27 | **PO-03** | `po3` | 小テスト・コンプライアンスチェックの実施と集計 | PO/collect | 3 | form | 自社 | | そのまま（**業種横断**） |
| ＃24 後半 | **PO-04** | `po4` | 稼働の集計とコスト配分の提案 | PO/mgmt | 3 | upload | 自社 | | ＃24 の目的別分割（**業種横断**） |
| ＃29 | **EG-01** | `eg1` | 上流工程の仕様支援（読解・質問回答・エラー対処） | EG/spec | 3 | qa | 銀行・企業・自社 | | そのまま（**業種横断**） |

### 2-3. 既存サービスへの統合（5 件・新規採番なし）

| 元＃ | 統合先 | 変更内容 |
|---|---|---|
| ＃12 音声から議事録 | **DC-02** 議事録作成と次回論点整理 | `industries: ['mfg','fin']` に。名称・分類・成熟度・タグは不変。金融台本を追加。音声入力の要望は `docs/dify/usecases/DC-02.md` に「将来拡張」として追記 |
| ＃24 前半 週報・月報のもれ/整合性チェック | **DC-08** 報告レビュー | `industries: ['mfg','fin']` に。他は不変。金融台本を追加（報告種別に「本部向け月次」「当局報告」を含める） |
| ＃25 QA のスタック・回答・評価 | **KN-04** | `industries: ['mfg','fin']` に。**`name`/`desc` を業種中立に改訂**（§2-4-2） |
| ＃28 ToDo 鬼トレース | **GN-06** 頼まれ事・放置業務の追跡 | `industries: ['mfg','fin']` に。他は不変。金融台本を追加 |
| （＃2 の周辺） | **KN-05** 当局通達の影響分析・マニュアル反映 | `industries: ['mfg','fin']` に。他は不変。金融台本を追加（`template` は金融では `qa`） |

**元＃ の網羅確認**：＃1 KN-06 ／＃2 KN-08 ／＃3 CV-03 ／＃4・＃5 DC-09 ／＃6 KN-07 ／＃7・＃30 RS-01 ／＃8 RS-03 ／＃9・＃10 RS-04 ／＃11 RS-05 ／＃12 DC-02 ／＃13 CV-01 ／＃14 CV-02 ／＃15・＃16 FA-04 ／＃17 RS-02 ／＃18 FA-05 ／＃19 FA-01 ／＃20 FA-02 ／＃21 FA-03 ／＃22 CV-04 ／＃23 PO-01 ／＃24 DC-08＋PO-04 ／＃25 KN-04 ／＃26 PO-02 ／＃27 PO-03 ／＃28 GN-06 ／＃29 EG-01。**30 件すべてに行き先がある。**

### 2-4. サービス文言（3 言語）

#### 2-4-1. 新規 23 件

| id | ja | zh | en |
|---|---|---|---|
| `kn6` name | 事務手続の照会 | 事务手续查询 | Operations Procedure Lookup |
| `kn6` desc | 預金・為替・融資実行などの事務手続について、行内の手続書・事務通達・様式の説明を横断検索し、根拠の条番号を引用して答えます。窓口や事務部門が手続書のどこを見ればよいかを、日本語でも中国語でも聞けます。 | 跨库检索存款、结算、放款执行等事务手续的行内手册、事务通知与表单说明，引用条款编号作答。柜面与事务部门可用中文或日文提问，快速定位手册中的相应位置。 | Searches internal procedure manuals, operational notices and form instructions for deposits, remittances and loan drawdowns, then answers with the clause numbers cited. Front-office and back-office staff can ask in Japanese or Chinese. |
| `kn7` name | 行内営業情報の検索（日誌・接触履歴） | 行内营业信息检索（日志・接触记录） | Internal Sales Records Search (Logs & Contact History) |
| `kn7` desc | 過去の営業日誌・面談記録・業務記録を横断検索し、「この先とはいつ誰が何を話したか」を時系列で返します。担当交代や共同訪問の前に、過去の接触経緯と保留になっている論点を 1 分で把握できます。 | 跨库检索历史营业日志、会谈记录与业务记录，按时间顺序返回「何时、何人、谈了什么」。在交接或联合拜访前，一分钟掌握过往接触经过与尚未了结的议题。 | Searches past call reports, meeting records and work logs and returns who talked with the client about what, in date order. Before a handover or a joint visit, the contact history and open points are visible in a minute. |
| `kn8` name | 当局通達・ガイドラインDB（照会・過去比較） | 监管通知与指引数据库（查询・历史比较） | Regulatory Notice & Guideline Database (Lookup & History Comparison) |
| `kn8` desc | 当局通達と、その後の当局とのやり取り・照会回答を 1 か所に登録し、条文単位で照会できるようにします。改訂版と旧版を並べて変更箇所を示し、過去に同じ論点でどう回答したかも合わせて返します。 | 将监管通知及其后与监管方的往来、答复统一登记，可按条款查询。并排比较修订版与旧版以显示变更点，同时返回过去针对同一议题的答复口径。 | Registers regulatory notices together with the follow-up correspondence and answers, and makes them searchable clause by clause. Shows what changed between the revised and previous versions and how the same point was answered before. |
| `dc9` name | 議案・報告書・提案書のドラフト作成（テンプレート選択） | 议案・报告・提案书草案生成（模板选择） | Proposal, Report & Pitch Draft Builder (Template-based) |
| `dc9` desc | 文書の種類（議案・本部報告・顧客向け提案書）を選び、案件名・金額・期間など最低限の情報を入れると、過去の同種文書の構成と言い回しに沿ったドラフトを返します。記載が必要なのに空欄の項目は「要記入」として明示します。 | 选择文书类型（议案・本部报告・客户提案书），输入案件名称、金额、期间等最少信息，即可生成沿用历史同类文书结构与措辞的草案。必填但为空的项目会明确标注为「待填写」。 | Pick the document type (internal proposal, head-office report, client pitch), enter the minimum facts such as deal name, amount and term, and get a draft that follows the structure and wording of past documents of the same kind. Required but empty fields are flagged as to be completed. |
| `rs1` name | 企業・業界ニュースの自動収集と配信 | 企业与行业新闻的自动采集与推送 | Automated Company & Industry News Collection and Delivery |
| `rs1` desc | 対象先・業界・キーワードと収集モード（一般／ネガティブ情報のみ）を設定しておくと、公開情報を定期的に集めて日本語の要約付きで配信します。取引先ごとにまとめたファイルを出力し、社内チャットへの通知にも回せます。 | 预先设定对象企业、行业、关键词与采集模式（一般／仅负面信息），即可定期采集公开信息并附日文摘要推送。可按客户汇总输出文件，也可转为公司内部聊天工具的通知。 | Set the target companies, industry, keywords and collection mode (general or adverse news only), and public information is gathered on a schedule and delivered with a Japanese summary. Files can be produced per client and pushed to the internal chat tool. |
| `rs2` name | セクター・発行体のモニタリング | 板块与发行体监测 | Sector & Issuer Monitoring |
| `rs2` desc | 担当セクターと発行体について、ニュース・開示・外部リサーチを突き合わせ、前回レビューからの変化を論点の形で返します。与信・リスクレビューの前に「今回議論すべき点」を 3〜5 件に絞り込めます。 | 针对负责的板块与发行体，比对新闻、信息披露与外部研究，以议题形式返回自上次评审以来的变化。可在授信与风险评审前把「本次应讨论的要点」收敛到 3〜5 项。 | Cross-checks news, disclosures and external research for the sectors and issuers you cover, and returns what changed since the last review as discussion points. Narrows the agenda for a credit or risk review to three to five items. |
| `rs3` name | 顧客IR・決算の収集と日本語要約・比較 | 客户IR与财报的采集及日文摘要・比较 | Client IR & Earnings Collection with Japanese Summary and Comparison |
| `rs3` desc | 取引先の年次報告書・決算資料を集めて日本語で要約し、過去期との比較表と同業他社との並べ方を自動で作ります。数字の増減には資料中の説明を紐づけ、面談や与信の下準備をそのまま資料として使えます。 | 采集客户的年度报告与财报资料，生成日文摘要，并自动制作与过往期间的比较表及同业对比。数字增减会关联资料中的说明，可直接作为会谈与授信的前期资料使用。 | Collects a client annual report and results materials, summarizes them in Japanese, and builds comparison tables against prior periods and peers. Movements in the figures are linked to the explanations in the source, so the output doubles as meeting and credit preparation. |
| `rs4` name | 市場・企業データの照会（金融情報端末・契約データベース） | 市场与企业数据查询（金融数据终端・签约数据库） | Market & Company Data Lookup (Financial Terminal, Licensed Databases) |
| `rs4` desc | 銘柄・企業・指標と期間を指定すると、契約している金融情報端末や外部データベースからデータを引き、表とグラフ用の数値で返します。データ源は照会ごとに選べ、契約範囲外の項目は取得せずに理由を返します。 | 指定标的、企业、指标与期间，即可从已签约的金融数据终端或外部数据库取数，返回表格与可作图的数值。数据源可逐次选择，超出合同范围的项目不予取数并说明原因。 | Enter the security, company, metric and period, and the data is pulled from the licensed financial terminal or external databases and returned as a table and chart-ready values. The source is chosen per query, and items outside the licence are declined with the reason. |
| `rs5` name | ダッシュボード出力からの気づき分析 | 基于仪表盘输出的洞察分析 | Insight Analysis from Dashboard Exports |
| `rs5` desc | BI ダッシュボードから出した PDF や CSV をそのまま渡すと、傾向・外れ値・前月との差を読み取り、確認すべき点を文章で返します。数字を眺めるところから「次に何を調べるか」までを 1 往復で進められます。 | 直接上传从 BI 仪表盘导出的 PDF 或 CSV，即可读取趋势、异常值与环比差异，并以文字返回需要确认的要点。从看数字到「下一步查什么」，一个来回即可完成。 | Hand over the PDF or CSV exported from a BI dashboard and get trends, outliers and month-on-month differences read back as written observations. Moves from looking at numbers to knowing what to check next in one round. |
| `cv1` name | 提案・ピッチ資料の作成（候補先選定・比較企業分析） | 提案与路演材料制作（目标筛选・可比公司分析） | Pitch Material Builder (Target Screening, Comparables) |
| `cv1` desc | 業種・規模・地域などの条件から候補先リストを作り、比較企業の指標を並べて提案資料の骨子を組み立てます。過去の類似案件の構成を参照するので、初稿から「行内で通る形」に近づきます。 | 根据行业、规模、地域等条件生成候选名单，排列可比公司指标并搭建提案材料骨架。参照过往同类案件的结构，初稿即接近「行内可通过的形式」。 | Builds a target list from criteria such as industry, size and region, lines up comparable company metrics and assembles the skeleton of the pitch. Because it references past deals of the same kind, the first draft is already close to what passes internal review. |
| `cv2` name | 面談前ブリーフの作成 | 会谈前简报生成 | Pre-Meeting Briefing Builder |
| `cv2` desc | 面談相手と目的を入れると、直近の取引・接触履歴・公開情報・未了の宿題を 1 枚にまとめたブリーフを返します。移動中に読める分量に絞り、聞くべき質問の候補も添えます。 | 输入会谈对象与目的，即可生成一页简报，汇总近期交易、接触记录、公开信息与未了事项。控制在路上可读完的篇幅，并附上建议提问。 | Enter who you are meeting and why, and get a one-page brief covering recent transactions, contact history, public information and open items. Kept short enough to read on the way, with suggested questions attached. |
| `cv3` name | 審査コメントのドラフト作成 | 授信审查意见草案生成 | Credit Review Comment Drafting |
| `cv3` desc | 財務データと案件資料を渡すと、過去の審査結果・審査コメントの書き方に沿ってコメントのドラフトを作ります。数字の根拠と、過去に同じ業種で指摘された論点を併記するので、審査部とのやり取りが減ります。 | 上传财务数据与案件资料，即可依照过往审查结论与审查意见的写法生成意见草案。同时列出数字依据与同业过往被指出的议题，减少与审查部门的往返。 | Hand over the financial data and the deal file and get a draft review comment written in the style of past credit decisions. The basis for each figure and the points previously raised for the same industry are shown together, reducing back-and-forth with the credit department. |
| `cv4` name | KYCスクリーニングとエスカレーション整理 | KYC筛查与上报事项整理 | KYC Screening & Escalation Summary |
| `cv4` desc | 提出書類と外部情報からエンティティ情報を組み立て、確認できた点・裏付けが取れない点・追加で必要な書類を一覧にします。コンプライアンス部門に上げるべき事項は理由と根拠をそろえた形でまとめます。 | 依据提交材料与外部信息构建实体信息，列出已确认事项、无法佐证的事项与需补充的材料。需上报合规部门的事项，会附理由与依据一并整理。 | Assembles the entity file from submitted documents and external sources, then lists what is confirmed, what cannot be substantiated and which documents are still missing. Items that need to go to compliance are packaged with the reason and the evidence. |
| `fa1` name | GL勘定のリコンシリエーション | 总账科目对账 | General Ledger Reconciliation |
| `fa1` desc | 総勘定元帳と補助簿・基準となる記録を突き合わせ、差異の一覧と、金額・日付・相手勘定から推定した原因を返します。前月に同じ差異が出ていた場合は、そのときの処理も合わせて示します。 | 将总账与明细账、基准记录进行核对，返回差异清单及依据金额、日期、对方科目推定的原因。若上月出现过相同差异，会一并提示当时的处理方式。 | Matches the general ledger against subsidiary records and the books of record, then returns the list of differences with a likely cause inferred from amount, date and counter-account. If the same difference occurred last month, how it was handled is shown as well. |
| `fa2` name | 月次クローズの実行と報告 | 月度结账执行与报告 | Month-End Close Execution & Reporting |
| `fa2` desc | 月次クローズのチェックリストを順に進め、未了の項目・必要な仕訳・期日超過を可視化し、クローズ報告のドラフトまで作ります。誰の作業で止まっているかが毎日わかるので、締めの終盤で慌てなくなります。 | 按顺序推进月度结账检查表，可视化未完成事项、需补仕訳与逾期项目，并生成结账报告草案。每天都能看到卡在谁那里，避免结账末期手忙脚乱。 | Walks through the month-end checklist, shows what is still open, which journal entries are needed and what is past due, and drafts the close report. Because it is visible every day whose task is holding things up, the last days of the close stop being a scramble. |
| `fa3` name | 財務諸表のレビュー（整合性・監査対応） | 财务报表评审（一致性・审计应对） | Financial Statement Review (Consistency & Audit Readiness) |
| `fa3` desc | 財務諸表と注記を読み、表間の整合・前期との継続性・開示の抜けを点検し、指摘を根拠付きで返します。監査で聞かれやすい点を先に洗い出し、説明の準備に使えます。 | 阅读财务报表与附注，检查表间一致性、与上期的连续性以及披露遗漏，并附依据返回指摘。提前梳理审计中常被问到的点，可用于准备说明口径。 | Reads the statements and notes, checks consistency across statements, continuity with the prior period and gaps in disclosure, and returns findings with their basis. Surfaces the points auditors usually ask about so the explanations can be prepared in advance. |
| `fa4` name | 財務モデルの作成と決算反映 | 财务模型构建与财报更新 | Financial Model Building & Earnings Update |
| `fa4` desc | 開示資料とデータフィードから財務モデルの骨格を作り、決算が出るたびに実績を反映して前提との差を示します。前提を変えた箇所と、その結果どの数字がどう動いたかを履歴として残します。 | 依据信息披露与数据源搭建财务模型骨架，并在每次发布财报后更新实绩、显示与假设的差异。变更了哪些假设、由此哪些数字如何变动，都会留存为历史记录。 | Builds the skeleton of a financial model from disclosures and data feeds, and updates actuals at each results release while showing the gap against the assumptions. Which assumptions were changed and how the numbers moved as a result is kept as a history. |
| `fa5` name | バリュエーションのレビュー | 估值评审 | Valuation Review |
| `fa5` desc | 出来上がったバリュエーションを、比較企業の選び方・手法の適用・社内のレビュー基準に照らして点検します。基準から外れている箇所と、その理由として書くべき説明の候補を返します。 | 依据可比公司的选取、方法的适用与行内评审标准，对已完成的估值进行检查。返回偏离标准之处，以及可作为理由记载的说明候选。 | Checks a completed valuation against the choice of comparables, the application of the method and the internal review standards. Returns where it deviates and what explanation should be recorded as the reason. |
| `po1` name | アンケート・インタビュー収集 | 问卷与访谈收集 | Survey & Interview Collection |
| `po1` desc | 設問に沿って対話形式で回答を集め、曖昧な回答にはその場で追加の質問をして具体化します。集まった回答は設問ごとに整理し、自由記述は論点別にまとめて返します。 | 按设问以对话方式收集回答，对含糊的回答当场追问以使其具体化。收集到的回答按设问整理，自由填写部分按议题归纳后返回。 | Collects answers in a conversational form and asks follow-up questions on the spot when an answer is vague. Responses are organized per question, with free text grouped by theme. |
| `po2` name | アイデアの募集・蓄積・投票集計 | 创意征集・沉淀・投票统计 | Idea Collection, Backlog & Voting |
| `po2` desc | 業務改善や活用アイデアを幅広く集めて 1 か所に貯め、似た提案は束ねて重複を減らします。定期的に投票を回して結果を集計し、検討に進めるものを順位付きで返します。 | 广泛征集业务改善与应用创意并集中沉淀，对相似提案进行归并以减少重复。定期发起投票并统计结果，按顺位返回可推进讨论的条目。 | Gathers improvement and use-case ideas from across the organization into one backlog and merges near-duplicates. Runs periodic votes, tallies the results and returns a ranked list of what should move forward. |
| `po3` name | 小テスト・コンプライアンスチェックの実施と集計 | 小测验与合规检查的实施及统计 | Quiz & Compliance Check Delivery and Scoring |
| `po3` desc | 社員向けの小テストやコンプライアンス確認をその場で実施し、実施状況と正答状況をリアルタイムで集計します。誤答の多い設問を示すので、次の教育で何を補えばよいかがわかります。 | 面向员工即时实施小测验与合规确认，实时统计实施情况与正确率。提示错误率高的题目，便于确定下次培训需要补强的内容。 | Runs short quizzes and compliance checks for staff on the spot and tallies completion and correctness in real time. Highlights the questions most often answered wrongly so the next training session knows what to cover. |
| `po4` name | 稼働の集計とコスト配分の提案 | 工时汇总与成本分摊建议 | Workload Aggregation & Cost Allocation Suggestions |
| `po4` desc | 各担当の稼働実績を集め、案件・組織単位に集計して月末のコスト配分案を提示します。前月からの偏りや、報告と実績が合っていない箇所も合わせて示します。 | 汇集各成员的工时实绩，按案件与组织统计，提出月末的成本分摊方案。同时提示与上月相比的偏差，以及汇报与实绩不一致之处。 | Collects each member's recorded effort, aggregates it by project and organization, and proposes the month-end cost allocation. Also shows shifts from the previous month and places where reports and actuals disagree. |
| `eg1` name | 上流工程の仕様支援（読解・質問回答・エラー対処） | 上游工序的规格支持（解读・答疑・错误处置） | Upstream Specification Support (Reading, Q&A, Error Handling) |
| `eg1` desc | 仕様書を読み込み、理解のために確認すべき点を質問の形で提示し、仕様に関する問い合わせにも根拠箇所を引用して答えます。エラーコードを入れれば対処の候補を返し、仕様間の矛盾も指摘します。 | 读取规格书，以提问形式提示为理解所需确认的要点，并引用依据回答关于规格的咨询。输入错误码可返回处置候选，同时指出规格之间的矛盾。 | Reads a specification, raises the points that need clarification as questions, and answers spec queries with the relevant passage quoted. Enter an error code and it returns candidate remedies, and it flags contradictions between specifications. |

#### 2-4-2. KN-04 の改称（既存サービスの文言変更・**PM 承認事項**）

| | 現行 | 改訂案 |
|---|---|---|
| name ja | 労務・総務の社内問い合わせ対応 | **社内問い合わせ受付とFAQ蓄積** |
| name zh | 劳务与总务内部咨询应答 | **内部咨询受理与FAQ沉淀** |
| name en | HR & Admin Internal Helpdesk | **Internal Helpdesk & FAQ Knowledge Base** |
| desc ja | 入社手続き・社会保険・休暇申請・証明書発行・IT 申請などの定型質問に、社内 FAQ と申請手順をもとに自動回答します。回答できない質問は担当部署へ引き継ぎ、問い合わせ履歴を分類して残します。 | **社内からの問い合わせを受け付け、蓄積された FAQ と申請手順をもとに回答します。答えが無い質問は担当部署へ引き継いで回答を促し、返ってきた回答を FAQ に貯めます。問い合わせと回答は分類して残し、定期的に件数と未回答の統計を返します。** |
| desc zh | （現行） | **受理来自公司内部的咨询，依据已沉淀的 FAQ 与申请手续作答。没有答案的问题转交主管部门并催促回复，收到的回答再沉淀进 FAQ。咨询与回答分类留存，并定期返回件数与未回答事项的统计。** |
| desc en | （現行） | **Receives internal inquiries and answers them from the accumulated FAQ and application procedures. Questions with no answer are routed to the owning department with a nudge, and the reply that comes back is added to the FAQ. Inquiries and answers are kept classified, with periodic statistics on volume and unanswered items.** |

`id` / `cat` / `sub` / `st` / `tags` は不変 → **regress の差分は `industries` だけ**。

---

## 3. §B 分類体系と管理番号

### 3-1. 分類一覧（変更後・グローバル 13 分類 29 中分類）

| コード | 大分類（ja / zh / en） | 略称（ja / zh / en） | 業種 | 中分類 |
|---|---|---|---|---|
| **KN** | ナレッジ検索・問い合わせ / 知识检索与咨询 / Knowledge & Inquiry | ナレッジ / 知识 / Knowledge | mfg, fin | `tech`(mfg) / `rule`(mfg,fin) / **`bizlog`(fin・新設)** |
| **QA** | （既存のまま） | | mfg | `defect` / `change` |
| **DC** | （既存のまま） | | **mfg, fin** | `report`(mfg,fin) / `site`(mfg) / `apply`(mfg) |
| **LG** | （既存のまま） | | mfg | `trans` / `align` |
| **NM** | （既存のまま） | | mfg | `cost` / `actual` |
| **EN** | （既存のまま） | | mfg | `spec` / `bom` |
| **GN** | （既存のまま） | | **mfg, fin** | `office`(mfg) / `daily`(mfg,fin) |
| **PT** | （既存のまま） | | mfg | `data` / `service` |
| **RS**★ | 情報収集・データ分析 / 信息收集与数据分析 / Research & Data Analysis | 情報 / 信息 / Research | fin | `news` / `disc` / `data` |
| **CV**★ | 顧客カバレッジ・審査 / 客户覆盖与审查 / Client Coverage & Credit | 顧客 / 客户 / Clients | fin | `pitch` / `credit` / `kyc` |
| **FA**★ | 財務・経理オペレーション / 财务与会计运营 / Finance & Accounting Operations | 財務 / 财务 / Finance | fin | `close` / `model` |
| **PO**★ | 組織運営・PMO / 组织运营与PMO / Organization & PMO | 組織 / 组织 / PMO | **mfg, fin** | `collect` / `mgmt` |
| **EG**★ | エンジニアリング支援 / 工程支持 / Engineering Support | 開発 / 开发 / Eng. | **mfg, fin** | `spec2` |

★ = 新設。既存 8 コードと衝突しない（RS / CV / FA / PO / EG）。

> **`EG` の中分類 id 注意**：`spec` は既に `EN/spec` で使われており、`tools/verify.mjs` §6 は中分類 id を**グローバルな集合**で照合する（`CATS.flatMap(c => c.subs.map(s => s.id))`）。同名でも FAIL にはならないが、`SVCS[].sub` から親分類を一意に決められなくなる。**`EG` の中分類 id は `spec2` ではなく `sysspec` とする**（下表）。

### 3-2. 新設中分類の文言（3 言語）

| 分類/中分類 | ja | zh | en |
|---|---|---|---|
| `KN/bizlog` | 営業情報・履歴 | 营业信息与记录 | Sales Records & History |
| `RS/news` | ニュース・モニタリング | 新闻与监测 | News & Monitoring |
| `RS/disc` | 開示・IR | 信息披露与IR | Disclosure & IR |
| `RS/data` | データ照会・分析 | 数据查询与分析 | Data Lookup & Analysis |
| `CV/pitch` | 提案・面談準備 | 提案与会谈准备 | Pitches & Meetings |
| `CV/credit` | 審査・与信 | 审查与授信 | Credit Review |
| `CV/kyc` | KYC・コンプライアンス | KYC与合规 | KYC & Compliance |
| `FA/close` | 決算・リコン | 结账与对账 | Close & Reconciliation |
| `FA/model` | モデル・評価 | 模型与估值 | Models & Valuation |
| `PO/collect` | 収集・集計 | 收集与统计 | Collection & Tallying |
| `PO/mgmt` | 進捗・工数 | 进度与工时 | Progress & Workload |
| `EG/sysspec` | 仕様・設計 | 规格与设计 | Specs & Design |

### 3-3. `CATS` 配列の並び（メニュー順）

新しい配列順：`kn, rs, cv, fa, qa, dc, lg, nm, en, gn, pt, po, eg`

- **製造業のメニュー**（`industries` に `mfg` を含むものだけ）：`kn, qa, dc, lg, nm, en, gn, pt, po, eg` — **既存 8 個の相対順序は変わらない**。末尾に PO・EG が付く
- **金融のメニュー**：`kn, rs, cv, fa, dc, gn, po, eg` — **8 大分類**（PM 指定の 4〜8 の範囲）。銀行の中核業務が上に来る
- `CATS` の配列順は `tools/regress.mjs` の比較対象に**入っていない**（id 集合と `subs` だけ）。順序変更は差分として出ないので、**本書のこの節がレビューの根拠**になる

### 3-4. 利用者（銀行／企業／自社）は分類にもタグにもしない

- 元データの G 列は「このエージェントを誰に売れるか」＝**営業上の区分**であって、利用者がメニューを探す軸ではない。分類にすると、同じサービスが 3 か所に出るか、分類が 3 × 業種で増える
- `TAGS` にしない理由：`TAGS` は検索と絞り込みに使われる（`app.js` の `filtered()` はタグの ja/zh/en を検索対象にしている）。「銀行」「企業」「自社」で絞り込めても業務の役に立たない。§2-5 の「日中対応をサービスの区別タグにしない」と同じ理由（全サービスの前提に近い属性はタグにしない）
- **置き場：`docs/handoff/service-index.md` の一覧表に「利用者」列を足す**（顧客に見せる資料ではなく社内台帳）。§2-2 の表がその正本

### 3-5. 優先度 ★ の表現

- **データ層に持たせない。`state` にも増やさない**（PM 指定）
- 表現は **成熟度 `st`**：★ 6 件（KN-06 / KN-08 / DC-09 / RS-01 / RS-03 / RS-04）を `st: 2`（試行版＝これから作るもの）、それ以外の新規を `st: 3`（構想）
- `added`（NEW バッジ）は**優先度に使わない**。金融の新規 23 件すべてに同じ日付を入れる（実際に同日追加なので正しい）。②ダッシュボードの新着帯には `NEW_DAYS`（30 日）の間 23 件が並ぶ。多いと感じるなら PM 判断で `added` を付けない選択もできる（§9 #14）
- 優先度そのものは**本書 §2-2 の表と Issue にだけ残す**

### 3-6. タグ（新設 13 個・3 言語）

| key | ja | zh | en |
|---|---|---|---|
| `news` | ニュース収集 | 新闻收集 | News monitoring |
| `disclosure` | 開示・IR | 信息披露・IR | Disclosure & IR |
| `screening` | KYC・スクリーニング | KYC与筛查 | KYC & screening |
| `valuation` | バリュエーション | 估值 | Valuation |
| `modeling` | 財務モデル | 财务模型 | Financial modeling |
| `closing` | 決算・クローズ | 结账・决算 | Close & reconciliation |
| `proposal` | 提案・ピッチ | 提案与路演 | Proposals & pitches |
| `client` | 顧客対応 | 客户对接 | Client coverage |
| `survey` | アンケート | 问卷调查 | Surveys |
| `idea` | アイデア | 创意提案 | Ideas |
| `workload` | 稼働・工数 | 工时与稼动 | Workload & effort |
| `dashboard` | ダッシュボード | 仪表盘 | Dashboards |
| `datasource` | 外部データ源 | 外部数据源 | External data sources |

**既存タグの再利用**（新規追加しない）：`procedure` `faq` `search` `authority` `report` `approval` `market` `credit` `summary` `analysis` `meeting` `audit` `finance` `education` `kpi` `spec`

**新規 23 件のタグ割り当て**

| id | tags | id | tags |
|---|---|---|---|
| `kn6` | `procedure`, `faq` | `fa1` | `closing`, `finance` |
| `kn7` | `search`, `client` | `fa2` | `closing`, `report` |
| `kn8` | `authority`, `search` | `fa3` | `audit`, `finance` |
| `dc9` | `report`, `approval` | `fa4` | `modeling`, `disclosure` |
| `rs1` | `news`, `market` | `fa5` | `valuation`, `modeling` |
| `rs2` | `news`, `credit` | `po1` | `survey`, `faq` |
| `rs3` | `disclosure`, `summary` | `po2` | `idea`, `survey` |
| `rs4` | `datasource`, `market` | `po3` | `education`, `kpi` |
| `rs5` | `dashboard`, `analysis` | `po4` | `workload`, `kpi` |
| `cv1` | `proposal`, `client` | `eg1` | `spec`, `faq` |
| `cv2` | `client`, `meeting` | | |
| `cv3` | `credit`, `report` | | |
| `cv4` | `screening`, `audit` | | |

### 3-7. データ層の変更前後（件数と id 一覧・**reviewer が regress の差分と照合する**）

| | 変更前 | 変更後 | 差分 |
|---|---|---|---|
| `CATS` 件数 | 8 | **13** | 追加 5：`rs` `cv` `fa` `po` `eg` |
| 中分類 合計 | 17 | **29** | 追加 12：`kn/bizlog` `rs/news` `rs/disc` `rs/data` `cv/pitch` `cv/credit` `cv/kyc` `fa/close` `fa/model` `po/collect` `po/mgmt` `eg/sysspec` |
| `SVCS` 件数 | 43 | **66** | 追加 23（下記）。**削除・改名・分類移動・成熟度変更・タグ変更は 0 件** |
| `TAGS` 件数 | 43 | **56** | 追加 13（§3-6）。削除 0 |
| `T`（UI キー） | 79 | **78** | 追加 1（`indLabel`）／削除 2（`wordmark` `dept` → `INDUSTRIES` へ移動。§4-3） |
| `PATTERNS` | 3 | 3 | 変更なし |
| 成熟度内訳 | 12 / 23 / 8 | **12 / 29 / 25** | 追加分のみ（st2 +6、st3 +17） |

**追加する `SVCS` の id 一覧（23 件・この順で配列末尾に追加する）**

```
kn6, kn7, kn8, dc9, rs1, rs2, rs3, rs4, rs5,
cv1, cv2, cv3, cv4, fa1, fa2, fa3, fa4, fa5,
po1, po2, po3, po4, eg1
```

**`industries` の内訳**

| 値 | 件数 | id |
|---|---|---|
| `['mfg']` | 38 | 既存 43 件のうち下記 5 件を除く全部 |
| `['mfg','fin']` | **10** | `kn4` `kn5` `dc2` `dc8` `gn6` `po1` `po2` `po3` `po4` `eg1` |
| `['fin']` | 18 | `kn6` `kn7` `kn8` `dc9` `rs1` `rs2` `rs3` `rs4` `rs5` `cv1` `cv2` `cv3` `cv4` `fa1` `fa2` `fa3` `fa4` `fa5` |

**業種別の件数**：製造業 **48**（38 + 10）／金融 **28**（18 + 10）／グローバル実件数 **66**（48 + 28 − 10）。

**分類 `industries`**：`['mfg','fin']` = `kn` `dc` `gn` `po` `eg`（5 個）／`['mfg']` = `qa` `lg` `nm` `en` `pt`（5 個）／`['fin']` = `rs` `cv` `fa`（3 個）。

---

## 4. §C モック側の構造

### 4-1. 業種切替の置き場：`.mockbar`（レビュー用の足場）

**推奨：`.mockbar` に置く。ヘッダー右（言語・テーマ）には置かない。**

理由：

1. **§2-4 の定義そのもの**。本番の銀行の画面に「製造業に切り替える」ボタンは存在しない。顧客に「上のグレー帯は検討用、実画面はその下」と説明できる構成を保つ
2. **§2-9 との整合**。顧客版カタログはデータ層の差し替えで作る＝業種は**納品時に決まる**。実行時に切り替えるのはレビューのためだけ
3. ヘッダーに置くと「銀行のメニューに製造業の分類が混ざる製品」に見える。言語・テーマは 1 人の利用者が日常的に切り替えるが、業種は切り替えない
4. パターン（①②③）と同じ性質＝同じ場所・同じ部品（`.segwrap` / `.seg`）で表現できる。**新しい CSS クラスも色トークンも増えない**（§2-2 を触らない）

### 4-2. レイアウト（ASCII）

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ CONCEPT MOCK — 社内検討用   業種: [製造業][ 金融 ]   パターン: [①][②][③]      │ ← .mockbar（足場・既存の高さのまま）
├──────────────────────────────────────────────────────────────────────────────┤
│ 瑞央銀行 │ AIエージェントカタログ            [日本語 ▾] [◐]  事務統括部  (Z) │ ← 本番相当ヘッダー（wordmark と dept が業種で変わる）
├──────────┬───────────────────────────────────────────────────────────────────┤
│ すべて 28│                                                                   │
│ ─────── │                                                                   │
│ ナレッジ │   （右ペインは業種で変わらない。①②③ の描画は完全共通）            │
│ 情報     │                                                                   │
│ 顧客     │                                                                   │
│ 財務     │                                                                   │
│ 文書     │                                                                   │
│ 汎用     │                                                                   │
│ 組織     │                                                                   │
│ 開発     │                                                                   │
└──────────┴───────────────────────────────────────────────────────────────────┘
```

- 業種セグメントは**パターンセグメントの左**に置く（「何のカタログか」→「どう見せるか」の順）
- 幅：`業種:` ラベル ＋ 2 ボタン。既存 `.seg button` の padding をそのまま使う。`.mockbar` の高さは変えない
- 画面幅が狭いときは `.segwrap` の既存の折り返しに従う（新しいメディアクエリを追加しない）
- `data-screen-label` は既存の「モックツールバー」のまま

### 4-3. データ層の持ち方と読み込み順

**ファイル構成（変更後）**

```
mock/js/data/
  ui.js         T（78 キー）/ PATTERNS / TAGS（56）/ TEMPLATES / INDUSTRIES ← 新設
  catalog.js    CATS（13・industries 付き）/ SVCS（66・industries 付き）
  home.js       HOME = { mfg: {...}, fin: {...} } / FEED = { mfg: {...}, fin: {...} }
  style.js      CAT_STYLE（13 分類 ＋ _fallback）
  scenarios/
    mfg/  kn.js qa.js dc.js lg.js nm.js en.js gn.js pt.js   ← 既存 8 本を移動（本文は不変）
    fin/  kn.js rs.js cv.js fa.js dc.js po.js eg.js gn.js   ← 新設 8 本
```

- **`js/data/**` は純粋なリテラル宣言のみ**（§2-3）を維持する。`INDUSTRIES` も配列リテラル。`document`・`localStorage`・関数呼び出しを書かない → `tools/lib/load.mjs` の vm 実行がそのまま通る
- 業種でファイルを分けるのは **台本だけ**。`CATS`/`SVCS`/`TAGS` を業種別ファイルに割ると、id の一意性が構造で保証されなくなる（§1-1 案 2 の不採用理由）

**`catalog.html` の `<script src>` の並び（唯一の正）**

```
js/data/ui.js
js/data/catalog.js
js/data/home.js
js/data/style.js
js/data/scenarios/mfg/kn.js  qa.js  dc.js  lg.js  nm.js  en.js  gn.js  pt.js     （CATS の mfg 表示順）
js/data/scenarios/fin/kn.js  rs.js  cv.js  fa.js  dc.js  gn.js  po.js  eg.js     （CATS の fin 表示順）
js/app.js
js/render.js
js/events.js
```

- 合計 **23 本**（現行 15 本 → PR-1 では 15 本のまま、PR-4 で 23 本）
- `INDUSTRIES` は `ui.js` に置く（`catalog.js` より前に読まれる必要はないが、UI 辞書と同じ層）

**`INDUSTRIES` の内容（3 言語・確定稿）**

```js
const INDUSTRIES = [
  { id: 'mfg',
    name:     { ja: '製造業',   zh: '制造业',   en: 'Manufacturing' },
    desc:     { ja: '在中日系製造業（中国工場）', zh: '在华日资制造业（中国工厂）', en: 'Japanese-affiliated manufacturer in China' },
    wordmark: { ja: '青嶺精工', zh: '青岭精工', en: 'SEIREI SEIKO' },
    dept:     { ja: '情報システム部', zh: '信息系统部', en: 'IT Department' } },
  { id: 'fin',
    name:     { ja: '金融（銀行）', zh: '金融（银行）', en: 'Banking' },
    desc:     { ja: '在中日系銀行（中国拠点）', zh: '在华日资银行（中国网点）', en: 'Japanese-affiliated bank in China' },
    wordmark: { ja: '瑞央銀行', zh: '瑞央银行', en: 'ZUIO BANK' },
    dept:     { ja: '事務統括部', zh: '事务统筹部', en: 'Operations Planning Dept.' } }
];
```

**`T` の変更（3 言語・確定稿）**

| キー | 操作 | ja | zh | en |
|---|---|---|---|---|
| `indLabel` | **追加** | 業種: | 行业: | Industry: |
| `wordmark` | **削除**（`INDUSTRIES[].wordmark` へ移動） | — | — | — |
| `dept` | **削除**（`INDUSTRIES[].dept` へ移動） | — | — | — |

`renderChrome()` の 2 行（`wordmark` / `dept`）が `T` 参照から `ind().wordmark` / `ind().dept` に変わる。`document.title` は `T.appTitle` のままで業種に依存しない。

### 4-4. `state` の変更

```js
const state = {
  industry: 'mfg',       // ← 追加。'mfg' | 'fin'
  pattern: 'nav',
  lang: 'ja', theme: 'light',
  openCats: { kn: true },
  selCat: null, selSub: null, lastCat: 'kn', selSvc: null,
  view: 'list', query: '', log: []
};
```

**業種を切り替えたときの状態遷移（`data-act="industry"`）**

| キー | 切替時の扱い | 理由 |
|---|---|---|
| `industry` | 新しい値 | — |
| `pattern` | **保持** | ①②③ の比較は業種を跨いでも意味がある |
| `lang` / `theme` | **保持** | プロダクト機能。業種と直交 |
| `openCats` | `{ <新業種の先頭分類>: true }` にリセット | 旧業種の分類 id が残ると、見えない分類が開いた状態になる |
| `selCat` / `selSub` / `selSvc` | `null` にリセット | 分類・サービスは業種を跨いで対応しない |
| `lastCat` | 新業種の先頭分類（`mfg`→`kn` / `fin`→`kn`） | 現状の既定値と同じ考え方 |
| `view` | `'list'` にリセット | 詳細・デモを開いたまま業種を変えると、他業種のサービスを見ていることになる |
| `query` | `''` にリセット | 検索語は業種のデータに紐づく |
| `log` | `[]` にリセット | 台本が変わるため |

> **§2-3 の「表示レイヤーは `state` を読んで描くだけ」は維持する。** 業種は「どのデータを読むか」を変えるだけで、描画の分岐（①②③）を増やさない。

**アプリ層に足すヘルパー（`mock/js/app.js`）**

```
ind()        → INDUSTRIES.find(i => i.id === state.industry)
inInd(x)     → x.industries.includes(state.industry)
visCats()    → CATS.filter(inInd)                     ※ subs も filter して返す
visSvcs()    → SVCS.filter(inInd)
home()       → HOME[state.industry]
feed()       → FEED[state.industry]
scnOf(id)    → (SCENARIOS[state.industry] || {})[id] || null   ※ 既存関数の中身を差し替え
```

`render.js` / `app.js` で `CATS` / `SVCS` を直接参照している箇所（`render.js` 38・41・181〜183・226〜228・250・255・334・347、`app.js` の `catOf` `svcOf` `countSub` `countCat` `filtered` `newSvcs`）を `visCats()` / `visSvcs()` に置き換える。**`svcOf(id)` だけは全件から引く**（`HOME`/`FEED` の参照は verify で業種内に閉じることを保証するので、実行時に全件から引いても不整合は起きない）。

### 4-5. `localStorage`

- `mock.lang` / `mock.theme` は**不変**（§2-6）
- **業種は保存しない。新キー `mock.industry` を作らない。**
  - 理由：業種は `.mockbar` の足場＝`state.pattern` と同じ性質で、`pattern` も保存していない。保存すると「前回 金融 で閉じた人が、次に開いたとき製造業のデモを期待して金融が出る」事故が起きる
  - 既定値は `'mfg'`（既存のデモが今までどおり開く。リロードで必ず既知の状態に戻る）
  - PM が「デモ中にリロードしても金融のままにしたい」と言うなら、§9 #6 で `mock.industry` を追加する（`loadPrefs`/`savePrefs` に 2 行）

### 4-6. i18n 検査（§2-1）の変更点 — `tools/verify.mjs`

| 節 | 変更 |
|---|---|
| §1-B ④ 読み込み順 | `expectedOrder` を `scenarios/mfg/*` → `scenarios/fin/*` の 2 段に。順序は各業種の `CATS` 表示順 |
| §1-B ③ scenarios 集合 | `readdirSync` を**業種ディレクトリごと**に回す。`scenarios/` 直下に `.js` が残っていたら FAIL（移動漏れの検出） |
| §1-B ⑤ 本数 | `15` 固定 → `4 + (mfg 台本ファイル数) + (fin 台本ファイル数) + 3` を**実ディレクトリから計算**して比較 |
| §2 i18n | `INDUSTRIES[].name` / `.desc` / `.wordmark` / `.dept` を `checkML` の対象に追加。`SCENARIOS` のループを `for (const ind of ['mfg','fin']) for (const id in (SCENARIOS[ind]||{}))` に |
| §6 データ整合 | **新規**：`CATS[].industries` / `CATS[].subs[].industries` / `SVCS[].industries` が必須・値域 `mfg`/`fin`・順序が `['mfg','fin']` 固定・空配列でない。`SVCS[].industries ⊆ cat.industries ∩ sub.industries`。各業種で**サービス 0 件の分類・中分類が無い**こと |
| §7 共通レイヤー | `required` に `'industry'` を追加。`requiredActs` に `'industry'` を追加 |
| §9 シナリオ整合 | `SCENARIOS[ind][id]` の id が **その業種で見える** `SVCS` に存在すること。台本の無い `SVCS` の warn を業種ごとに出す。§9-A のファイル名一致は `dirname` が業種 id・`basename` が分類コードであること |
| §10 HOME/FEED | `HOME[ind]` / `FEED[ind]` を業種ごとに検査。参照 id は**その業種で見える**サービス／分類であること |
| §11 索引 | 変更なし（`gen-index --check` に委ねる） |

`tools/lib/load.mjs`：`DATA_KEYS` に `INDUSTRIES` を追加。`data.SCENARIOS` は `window.SCENARIOS`（2 階層）をそのまま返す。

### 4-7. `tools/regress.mjs` と `regress.baseline.json`

**スナップショットの拡張**

```js
const snapshot = {
  industries: INDUSTRIES.map(i => i.id),                                  // 新規
  cats: CATS.map(c => ({ id: c.id, industries: [...c.industries],
                         subs: c.subs.map(s => ({ id: s.id, industries: [...s.industries] })) })),  // subs が配列→オブジェクト配列
  svcs: SVCS.map(s => ({ id: s.id, cat: s.cat, sub: s.sub, st: s.st,
                         industries: [...s.industries], tags: [...s.tags] })),                       // industries 列を追加
  tags: ..., patterns: ..., uiKeys: ...,
  counts: { cats: 13, subs: 29, svcs: 66, tags: 56, ui: 78,
            svcsMfg: 48, svcsFin: 28, svcsBoth: 10,            // 新規
            catsMfg: 10, catsFin: 8 }                          // 新規
};
```

**二重計上の扱い（明文化）**

- `counts.svcs` は**グローバルの実件数**（66）。業種別件数の合計（48 + 28 = 76）とは一致しない
- 検算式を `regress.mjs` の出力に 1 行入れる：`svcsMfg + svcsFin − svcsBoth === svcs`。一致しなければ FAIL（業種横断の付け間違いを機械検出できる）
- 差分メッセージに `SVCS.<id> industries: [mfg] → [mfg,fin]` を追加（業種の付け外しが黙って通らない）

**基準更新の手順（既存 43 件を壊さない移行）**

1. **PR-1** で `industries` を導入（既存 43 件はすべて `['mfg']`、`CATS` 8 個も `['mfg']`）→ `node tools/regress.mjs --update`。
   - **根拠**：本書 §3-7 の「変更前」行。この時点の期待差分は「スナップショット形状の変更（`subs` がオブジェクト配列に・`industries` 列追加・`counts` に業種別を追加）」のみ。**`svcs[]` の id/cat/sub/st/tags は 1 文字も変わらない**
   - reviewer は `git diff tools/regress.baseline.json` を `jq` で `svcs[].id`・`cat`・`sub`・`st`・`tags` だけ抜き出して**変更前後で完全一致**することを確認する（確認コマンドは Issue に書く）
2. **PR-3**（データ層）で 23 件追加・10 件を業種横断化 → 再度 `--update`。
   - **根拠**：本書 §3-7 の「変更後」行と、追加する id 一覧（23 件）・`industries` 内訳（10 件）
   - reviewer は差分が「SVCS 追加 23 件」「CATS 追加 5 件」「TAGS 追加 13 件」「T 追加 1 削除 2」「対象 5 件の `industries` 変更」だけであることを確認する。**削除・改名・分類移動・成熟度変更が 1 件でもあれば差し戻し**
3. PR-2・PR-4・PR-5・PR-6 では `--update` **しない**（データ層を触らないため）

### 4-8. `tools/gen-index.mjs` / `docs/service-map.md` / `docs/handoff/service-index.md`

**1 サービス = 1 行を維持する**（管理番号が 1 つだから索引も 1 行。§1-3 の帰結）。

`docs/service-map.md`（生成物）の列を次のように変える：

```
| 管理番号 | サービス | 分類 | 業種 | 成熟度 | ①台本(製造) | ①台本(金融) | ②DSL | ③ユースケース | ④KB | ④テスト |
```

- 「業種」列：`製造` / `金融` / `製造・金融`
- 「①台本」を業種で 2 列に割る。無い側は `—`（**欠落が見える設計**を保つ。`repo-layout-v2.md` §1-3）
- 集計行に `①製造 nn ／ ①金融 nn` を出す
- `gen-index.mjs` の変更点：`SCENARIOS` を 2 階層で読む／台本セルのリンク先を `../mock/js/data/scenarios/<ind>/<prefix>.js` に／`SVCS[].industries` から業種列を作る／④KB のファイル数カウントを**再帰**にする（§5-3 で KB に業種サブディレクトリを作るため）
- `npm run index` の再実行を PR-3 と PR-6 の受け入れ条件に入れる（verify §11 が鮮度を検査する）

`docs/handoff/service-index.md`（手書き台帳）：

- 「分類コード」表に**業種**列を足す
- サービス表に**業種**列と**利用者**列（§3-4）を足し、見出しを「## サービス（66 件／製造 48・金融 28・うち両業種 10）」に
- 「次に採番するとき」に 1 行足す：「**業種横断のサービスに番号を 2 つ振らない。番号は 1 つで、`industries` に両方を書く**」

### 4-9. `mock/index.html`（デモガイド）

- **§1「画面の構成」**：モックツールバーの説明に「業種（製造業／金融）」を 1 行追加（現行の「パターン」の説明の直前）
- **新設 §「業種の切り替え」**（現行 §7「表示パターン」の直後、§8「更新履歴」の前に挿入し、以降の番号を繰り下げる）：何が変わるか（メニュー・サービス・デモの世界）／何が変わらないか（画面の作り・言語・テーマ・パターン）／両方に出るサービスがあること／管理番号は業種を跨いだ通し番号なので自分の業種では飛び番になること
- **§6「管理番号」**に 1 文追加（上記の飛び番の説明）
- ja / zh の 2 言語（`index.html` は `.ja` / `.zh` クラスで併記する既存方式。en は無い）。**文案は implementer が書く**
- `css/tokens.css` は `<link>` のまま。トークンをコピーしない（§2-2 / verify §5-A）

### 4-10. CSS とアイコン

- `mock/css/tokens.css` に `--cat-rs` `--cat-cv` `--cat-fa` `--cat-po` `--cat-eg` と各 `-bg` を **light と dark の両方**に追加（verify §5-b が非対称を FAIL にする）。既存 8 色と識別できる色相を選ぶ。**`--ntt-*` は触らない。`components.css` に色直値を書かない**
- `mock/js/data/style.js` の `CAT_STYLE` に 5 分類のインライン SVG を追加（`viewBox 0 0 24 24` / `fill none` / `stroke currentColor` / `stroke-width 1.75`、本リポジトリで書き起こす。外部アイコン集を使わない）。無ければ `_fallback` で描かれるので**壊れないが warn が出る**（verify §5-c）

---

## 5. §D 実装ソース側（`dify/`）

### 5-1. `dify/apps/` は平置きのまま（業種でディレクトリを分けない）

**結論：分けない。**

| 観点 | 平置きのまま | `dify/apps/fin/` を作る |
|---|---|---|
| ファイル名の衝突 | **起きない**（管理番号が業種を跨いでグローバルに一意。§1-3） | — |
| `scripts/dify/render.py` | `glob(dify/apps/*.yml)` が 1 行。**変更不要** | 再帰 glob と出力先の階層化が要る |
| `tools/verify.mjs` §12-e | `readdirSync(dify/apps)` で管理番号を拾う。**変更不要** | 再帰読み取りに変更 |
| `tools/gen-index.mjs` ②DSL 列 | `appsFiles.find(f => f.startsWith(code + '-'))`。**変更不要** | パス解決の変更 |
| `scripts/dify/check.py` / `cloud_deploy.py` / `release.py` / `run_tests.py` | 走査範囲の変更**不要**（**確認要**：`cloud_deploy.py` と `release.py` の実 glob は未確認。実装前に確認する） |
| 業種の見分け | ファイル名の管理番号 → `mock` の `SVCS[].industries`（正本は 1 つ） | ディレクトリが第 2 の正本になり、`industries` と食い違い得る |

**したがって業種はディレクトリで表現しない。**業種の正本は `mock/js/data/catalog.js` の `SVCS[].industries` 1 か所に置き、`dify/` 側は管理番号でそれを引く（`docs/service-map.md` が橋渡し）。

### 5-2. 業種横断サービスのマスタ DSL は **1 本**。世界観の語は env に逃がす

**問題**：現行 12 本のマスタ DSL は system prompt に「あなたは**青嶺精工 蘇州工場**の…」とベタ書きされている（`DC-02` `GN-05` など全 12 本）。DC-02 を金融でも使うなら、この語が邪魔になる。

**判定**

| 案 | 内容 | 判定 |
|---|---|---|
| D-1 業種ごとに DSL を fork | `DC-02-mfg.yml` / `DC-02-fin.yml` | **不採用**。§2-12 の「マスタ 1 本を配る／DSL を環境ごとに fork すると差分が追えなくなる」に正面から反する。verify §12-e の「管理番号 1:1」も壊れる |
| D-2 env を業種ごとに増やす（`fin-cloud-master` 等） | 業種＝env の一種として扱う | **不採用**。`cloud-master` は「render が恒等＝出力がマスタとバイト一致」である必要があり、業種で 2 つ持つと**どちらがマスタか決まらない** |
| **D-3 業種横断アプリだけプロンプトを業種中立にし、固有名詞を `brand.replace` と Start 変数の既定値に逃がす** | 下記 | **採用** |

**採用案（D-3）の具体**

1. **業種固有アプリ**（`KN-01` 技術ナレッジ、`RS-01` ニュース収集 …）：プロンプトに**その業種の世界の語をそのまま書く**。現行 12 本は業種固有なので**何も変えない**
2. **業種横断アプリ**（`DC-02` `DC-08` `GN-06` `KN-04` `KN-05` `PO-01`〜`04` `EG-01` の 10 本）：
   - system prompt から社名・拠点名を外し、**「あなたは社内の会議記録担当です」**のような業種中立の語だけを書く
   - 会社名・拠点は Start 変数 `company` / `site` の**既定値**として持たせる。`render.py` の R6（`start` ノードの `variables[].{default,options}` ← `brand.replace`）と `env.variables`（R? 経由）が既にこの経路を持っている
   - env 側は既存の `brand.replace` に「中立語 → その環境の語」の対応表を書く。`cloud-master` は `replace: []` のままなので**中立語のまま出力＝マスタとバイト一致（恒等）が保たれる**
   - **§2-12 の「プレースホルダ（`{{…}}`）を入れない」に抵触しない**：Dify の Start 変数参照は DSL の正規の書き方であり、URL インポートで壊れない。禁止されているのは render 時に解決される未解決トークン（`${VAR}`）を DSL に書くこと
3. **既存 `DC-02` `GN-05` などの中立化は既存資産の書き換えになる** → **PM 承認事項**（§9 #8）。第 1 弾は `DC-02` 1 本で試し、`render.py --env cloud-master --all --check` が PASS すること・`dify/tests/DC-02.json` が通ることを確認してから残りに広げる

### 5-3. env・KB・テストへの影響

| 対象 | 判定 |
|---|---|
| `env.yml` の `apps:` | **全環境が全管理番号を列挙する現行仕様を維持**（verify §12-e が `dify/apps/*.yml` との完全一致を要求している）。金融アプリの DSL を足したら 3 環境すべての `apps:` にも足す（`id: null` / `${VAR}`）。「顧客 A（製造業）に金融アプリは配らない」は §12-e の検査対象ではなく、**配布時の絞り込み**の話 |
| `env.yml` に業種を書くか | **書く。トップレベルに `industry: mfg` / `fin` / `all` を追加**（`cloud-master` は `all`）。v1 では**記録のみ**（`release.py` の絞り込みは実装しない）。verify §12-a の必須キーに追加する。**業種は env の軸ではない**（§5-2 D-2 の理由）が、**配布先が持つ属性**ではある——この 2 つを混同しないよう `dify/env/README.md` に 1 段落書く |
| `env.yml` の `knowledge:` | 変更なし。**同じ管理番号でも env ごとに違う dataset id を指せる**ので、業種横断アプリの KB は env で吸収できる（銀行の環境には銀行の KB を紐づける）。これが「業種横断でも DSL 1 本」が成立する根拠 |
| `env.yml` の `brand:` | `company` / `local_entity` / `sites` は**その環境の業種の値**を書く。`cloud-master` は現在 製造業の値（青嶺精工）が入っている。**業種中立化の第 1 弾では `cloud-master` の `brand` は変えない**（render の恒等性を先に守る）。金融環境を作るときに `dify/env/customer-b/`（匿名 id）を新設する — **これは本書のスコープ外。PR-6 で判断** |
| `dify/kb/` | 業種固有アプリ：現行どおり `dify/kb/<管理番号>/` 直下。**業種横断アプリ：`dify/kb/<管理番号>/mfg/`・`fin/` のサブディレクトリに分ける**（銀行の KB に工場の規程を入れない）。`gen-index.mjs` の KB 件数カウントを再帰にする（§4-8） |
| `dify/tests/` | `dify/tests/<管理番号>.json` は**1 ファイルのまま**。`cases[]` の各要素に `industry: 'mfg' \| 'fin'` を足す。`scripts/dify/run_tests.py` が未知フィールドを無視するか **確認要**（無視しないなら `--industry` フィルタを足す） |
| `docs/dify/usecases/<管理番号>.md` | 1 管理番号 1 ファイル。業種横断のものは「§X 業種ごとの違い」節を設けて、製造業／金融それぞれのペルソナ・入力例・KB を書く |

### 5-4. §2-12 との整合（記録）

- **env ＝ 配布先の属性**（どの Dify に、どのモデルで、どの KB を指して配るか）
- **業種 ＝ サービスとマスタ側の属性**（そのアプリがどの世界の語で書かれているか／どの業種のメニューに出るか）
- 業種横断アプリでは「世界の語」が env の `brand.replace` / `variables` に落ちるので、**結果として env で吸収される**。しかし「どのアプリが金融向けか」は env では決まらない（`cloud-master` は両方持つ）。この 2 つを分けて書くことが §2-12 の維持条件

---

## 6. §E 段取り（PR 分割）

| PR | 内容 | 触るファイル | 並列 | 受け入れ条件（機械検証） |
|---|---|---|---|---|
| **PR-1 業種軸の骨格** | `industries` の導入（既存 43＝`['mfg']`、`CATS` 8＝`['mfg']`）／`INDUSTRIES` 新設・`T.wordmark`/`T.dept` 削除／`state.industry` ＋ `data-act="industry"`／`.mockbar` に業種セグメント（**「金融」は `disabled`**）／台本を `scenarios/mfg/` へ移動（本文不変）／`HOME`/`FEED` を `{ mfg: … }` に／verify・regress・gen-index・load.mjs の業種対応／`regress --update` | `mock/catalog.html` `mock/css/tokens.css`（無変更）`mock/js/data/*.js` `mock/js/data/scenarios/mfg/*`（移動）`mock/js/app.js` `render.js` `events.js` `tools/*.mjs` `tools/regress.baseline.json` `docs/service-map.md` | 直列（起点） | `npm test` PASS／`git log --follow` で台本 8 本が**純粋な rename**（内容差分 0）／`baseline.json` の `svcs[].{id,cat,sub,st,tags}` が更新前と完全一致／画面が PR-1 前と目視で同一（業種セグメントの追加を除く）／`node tools/gen-index.mjs --check` PASS |
| **PR-2 金融の架空世界マスタ** | `data/world/mfg/`（移動）＋ `data/world/fin/`（新設・§7-2）／`data/world/README.md` を索引に／`tools/check-world.mjs` の業種対応 | `data/world/**` `tools/check-world.mjs` `package.json`（無変更） | **PR-1 と並列可**（ファイル集合が重ならない） | `npm run world` が両業種を報告して exit 0／`git log --follow` で mfg 側 8 ファイルが純粋な rename／`npm test` PASS（world は CI 対象外だが退行が無いこと） |
| **PR-3 金融カタログのデータ層** | `CATS` に 5 分類・12 中分類追加／`SVCS` に 23 件追加・10 件を業種横断化／`TAGS` 13 追加／`CAT_STYLE` 5 追加／`tokens.css` に `--cat-*` 5 組（light/dark）／`HOME.fin`・`FEED.fin`／業種セグメントの「金融」を有効化／`KN-04` 改称／`service-index.md`・`service-map.md` 更新／`regress --update` | `mock/js/data/catalog.js` `ui.js` `home.js` `style.js` `mock/css/tokens.css` `docs/handoff/service-index.md` `docs/service-map.md` `tools/regress.baseline.json` | PR-1 の後。**台本なし**（`start` は `chat` フォールバック） | `npm test` PASS／regress の差分が §3-7 の表と**行単位で一致**（追加 23／分類 +5／中分類 +12／タグ +13／T +1 −2／`industries` 変更 5 件。**削除・改名・分類移動・成熟度変更 0**）／`svcsMfg + svcsFin − svcsBoth === svcs` が成立／`gen-index --check` PASS／金融メニューが 8 分類 28 件、製造業メニューが 10 分類 48 件 |
| **PR-4a 金融の台本（KN/DC/GN/PO/EG）** | `scenarios/fin/{kn,dc,gn,po,eg}.js`（★ の KN-06・KN-08・DC-09 ＋ 業種横断 10 件） | `mock/js/data/scenarios/fin/{kn,dc,gn,po,eg}.js` `mock/catalog.html`（`<script src>` 追加） | **PR-4b と並列可**（別ファイル）。ただし `catalog.html` が重なるので**片方が先にマージ**、もう片方は rebase | `npm test` PASS／verify §9 が該当 13 件で warn を出さない／`gen-index --check` PASS |
| **PR-4b 金融の台本（RS/CV/FA）** | `scenarios/fin/{rs,cv,fa}.js`（★ の RS-01・RS-03・RS-04 ＋ 残り） | `mock/js/data/scenarios/fin/{rs,cv,fa}.js` `mock/catalog.html` | 同上 | 同上（該当 14 件） |
| **PR-5 デモガイドと索引の仕上げ** | `mock/index.html` に業種切替の節（ja/zh）／`docs/handoff/service-index.md` の呼び方の例に業種の例を追加 | `mock/index.html` `docs/handoff/service-index.md` | PR-3 の後なら**いつでも並列可** | `npm test` PASS（verify §5-A：`index.html` がトークンをコピーしていない）／Pages でガイドが崩れない |
| **PR-6 Dify 実装リファレンスと DSL 方針** | `docs/dify/usecases/` に金融 23 件を追加／`env.yml` に `industry:` を追加（3 環境）／`dify/env/README.md` に §5-4 の 1 段落／**`DC-02` の業種中立化を 1 本だけ試す**／`docs/dify/usecases/DC-02.md` に音声入力の将来拡張を追記 | `docs/dify/**` `dify/env/**` `dify/apps/DC-02-*.yml` `dify/kb/DC-02/{mfg,fin}/` `dify/tests/DC-02.json` `tools/verify.mjs`（§12-a） | PR-3 の後。**PR-4・PR-5 と並列可**（`mock/**` を触らない） | `npm test` PASS／`python3 scripts/dify/render.py --env cloud-master --all --check` が全件 PASS（マスタとバイト一致）／`render.py --strict` に未解決 `${VAR}` なし／verify §12 PASS／`gen-index --check` PASS |

**推奨する回し方**：`PR-1 ∥ PR-2` → `PR-3` → `PR-4a → PR-4b`（`catalog.html` が重なるので直列寄り）／`PR-5 ∥ PR-6`。

**直列にする理由（`CLAUDE.md` §5）**：PR-1・PR-3・PR-4 はすべて `mock/catalog.html` の `<script src>` と `mock/js/data/*.js` を触る。PR-2（`data/world`）と PR-6（`docs/dify` `dify/env`）はファイル集合が重ならないので並列可。

---

## 7. §F その他

### 7-1. `CLAUDE.md` の更新文案（**適用は PM**）

> architect は `CLAUDE.md` を変更しない。以下は文案。PR-1 のマージ後に PM が適用する。

**§2-3「状態」の差し替え**

```
- **状態**：`state = { industry, pattern, lang, theme, openCats, selCat, selSub, lastCat, selSvc, view, query, log }`。
  `industry` は `mfg`（製造業）/ `fin`（金融）。**業種は「どのデータを読むか」だけを変え、描画の分岐を増やさない**
  （①②③ は両業種で共通）。業種を切り替えると `openCats`/`selCat`/`selSub`/`selSvc`/`view`/`query`/`log` はリセット、
  `pattern`/`lang`/`theme` は保持する。**`localStorage` には保存しない**（パターンと同じ足場の一時状態）。
  `view` は `list` / `detail` / `chat` / `demo`。`log` は …（以降は現行のまま）
```

**§2-3「置き場」への追記**

```
`scenarios/<業種>/<分類>.js`（`SCENARIOS[industry][svcId]`。業種ごと 8 ファイル、
`window.SCENARIOS.<業種>` に `Object.assign` で登録）。読み込み順は
`data/ui → data/catalog → data/home → data/style → data/scenarios/mfg/* → data/scenarios/fin/* → app → render → events`
```

**§2-3「データ」への追記**

```
`CATS` / `CATS[].subs` / `SVCS` は **`industries`（`['mfg']` / `['fin']` / `['mfg','fin']`）を必須で持つ**。
省略時の既定値は作らない。`SVCS[].industries` はその `cat` と `sub` の `industries` の部分集合であること。
`INDUSTRIES`（業種の定義。`name`/`desc`/`wordmark`/`dept` の 3 言語。会社名・部署名は `T` ではなくここ）。
`HOME` / `FEED` は業種キー（`HOME[industry]`）。
```

**§2-9 への追記**

```
- 業種（製造業／金融）も**データ層だけ**で表現する。1 サービス 1 管理番号を守り、
  業種横断のサービスには番号を 2 つ振らない（`industries` に両方を書く）。
  分類コードは業種ではなくサービスの性質に付く（`DC` は両業種にある）。
  通番は分類内で業種を跨いで連番＝ある業種のメニューでは飛び番に見える。
```

**§2-11 への追記**

```
- 業種横断のサービスも**番号は 1 つ**。`dify/apps/` は業種でディレクトリを分けない
  （管理番号がグローバルに一意なので分ける必要がない）。
```

**§6 バックログの差し替え（1 項目追加）**

```
- **金融（在中日系銀行）カタログと業種切替（#XX）**：設計書 `docs/handoff/2026-09-08-finance-catalog.md`。
  8 分類 28 サービス（うち業種横断 10）。製造業側は 10 分類 48 サービスに（PO・EG が両業種に出るため）。
  グローバル 13 分類 29 中分類 66 サービス。PR-1（骨格）〜PR-6（Dify）。
```

**§6 の既存記述の更新**（顧客版カタログの項）：`8 分類 17 中分類 43 サービス` → `製造業 10 分類 48 サービス／金融 8 分類 28 サービス／グローバル 13 分類 29 中分類 66 サービス`

### 7-2. `data/world/` 第 2 世界（金融）

**ディレクトリ**

```
data/world/
  README.md            ← 索引（2 世界の入口・共通ルール・未統一の一覧）
  mfg/                 ← 現行 8 ファイルを移動（内容不変）
    company.md org.csv people.csv products.csv equipment.csv partners.csv kpi.csv calendar.md
  fin/                 ← 新設
    company.md org.csv people.csv clients.csv products.csv kpi.csv calendar.md
```

- `equipment.csv` は金融に不要（設備が主役でない）。代わりに **`clients.csv`**（顧客企業の記号）を置く
- `tools/check-world.mjs` は業種ごとにマスタと走査対象を対にして回す：
  - `mfg` → `mock/js/data/scenarios/mfg/**`・`dify/kb/<code>/`（業種横断は `mfg/` サブ）・`dify/tests/*.json` の `industry: 'mfg'` ケース・`docs/dify/usecases/*.md` の製造業節
  - `fin` → 同様に `fin` 側
  - **warn のみ・CI に入れない**は不変。`--strict` の挙動も不変

**置く内容（**すべて架空**。製造業マスタの語を 1 つも流用しない）**

| ファイル | 内容 |
|---|---|
| `company.md` | 銀行名 **瑞央銀行株式会社 / 瑞央银行股份有限公司 / Zuio Bank, Ltd.**／現地法人 **瑞央銀行（中国）有限公司 / 瑞央银行（中国）有限公司 / Zuio Bank (China) Co., Ltd.**／拠点：**上海本部**（上海总部 / Shanghai Head Office）・**大連支店**（大连分行 / Dalian Branch）・**日本本店**（日本总行 / Japan Head Office）／事業内容（日系企業向け法人取引・現地企業取引・市場業務） |
| `org.csv` | 営業第一部（日系法人）／営業第二部（現地企業）／審査部／リスク統括部／コンプライアンス部／経営企画部／事務統括部／市場業務部／財務部／システム部（各 ja/zh/en） |
| `people.csv` | 8 名。日本人駐在 3（**森下 隆一**＝営業第一部長・**高梨 直人**＝審査部次長・**岡部 千夏**＝経営企画部 調査役）／現地 5（**陳 慧**＝営業第一部 主管・**楊 建国**＝審査部 主管・**沈 明**＝市場業務部 担当・**韓 雪**＝事務統括部 主管・**羅 佳**＝コンプライアンス部 担当）。**製造業マスタの 17 名と姓名が重複しないこと**を PR で確認する |
| `clients.csv` | 顧客企業は**記号のみ・社名を付けない**（製造業の `K 社` と同じ流儀だが**記号体系を変える**）：`甲社`（日系製造）・`乙社`（日系商社）・`丙社`（現地民営・自動車部品）・`丁社`（現地国有・素材）・`戊社`（サービス）。空白の入れ方は「`甲社`（空白なし）」を正とし、README に明記 |
| `products.csv` | 運転資金貸出／設備資金貸出／外貨両替／為替予約／L/C・貿易金融／キャッシュマネジメント／クロスボーダー人民元送金／投資信託販売（各 ja/zh/en） |
| `kpi.csv` | 貸出残高・預金残高・与信先数・延滞率・手数料収益・稟議処理日数・照会一次回答率・当局報告件数（基準値／目標／前月。文脈違いは `note` 列） |
| `calendar.md` | 会計年度 4/1〜3/31（日系本店に合わせる）／月次クローズは第 5 営業日／当局報告の期日／決算発表シーズン／**世界の「今日」= 2026-09-08**／文書番号体系：`RNG-2026-0142`（稟議）・`CRD-26-0087`（審査案件）・`NTF-2026-013`（当局通達）・`MTG-2026-0451`（議事録）・`CLM-26-2211`（面談記録）・`IRR-2026-021`（IR レポート） |

> **文書番号の接頭辞を 3 文字にした理由**：`tools/check-world.mjs` の W7 は `^[A-Z]{2}-\d{2}$` に見えるコードを「管理番号と紛らわしい」と報告する。`CR-26-…` のような 2 文字接頭辞は新分類コード `CV`/`FA`/`RS`/`PO`/`EG` と見分けがつかなくなる。3 文字なら衝突しない。

> **銀行名の確認**：「瑞央」は実在の金融機関名との衝突が低いと判断した候補。**実装前に PM または implementer が実在名との衝突を確認する**（§9 #4）。代替候補：**碧洋銀行 / 碧洋银行 / Hekiyo Bank**。

### 7-3. 実在サービス名の扱い（WIND・企業微信・BI ツール・記事 URL）

- 元データには実在サービス名と公開記事 URL が含まれる。`docs/dify/implementation-guide.md` §5-3 と `data/world/README.md` の原則は「実在の企業名・型番・URL・人名を混ぜない」
- **推奨：モック（`mock/**`）と架空世界マスタには実名を出さない。**
  - WIND → **「金融情報端末」**／`RS-04` の名称は「市場・企業データの照会（金融情報端末・契約データベース）」
  - 企業微信 → **「社内チャット」**
  - Tableau → **「BI ダッシュボード」**
  - Anthropic の記事 URL → 本書 §2-1 の出典欄と Issue にのみ残す（`mock/**`・`data/world/**` には書かない）
- 実名は**本書と Issue には残す**（設計の追跡のため）。ただし**提出者の実名は本書にも書かない**（PM 指示）

### 7-4. 業種横断の「第 2 陣」候補（**PM 判断待ち**・本書では変更しない）

次の既存サービスは機能としては業種を問わないが、PR-3 では `['mfg']` のままにする（元 30 件に対応する要望が無く、根拠が本書に無いため）。PM が望むなら次の版で `['mfg','fin']` にする。

| 管理番号 | サービス | 金融でも通じる理由 |
|---|---|---|
| LG-01 | 日中翻訳（社内の言い方に揃える） | 在中日系という前提が同じ |
| LG-02 | 社内用語・呼称の統一（用語集） | 同上 |
| LG-04 | ビジネスメール作成（日中往復） | 同上 |
| GN-01 | 経費精算チェック | 業種非依存 |
| GN-02 | 請求書（発票）処理 | 中国共通・業種非依存 |
| GN-04 | スケジュール調整 | 業種非依存 |
| GN-05 | 文書要約 | 業種非依存 |
| DC-05 | 稟議・申請書の作成と記載漏れ検出 | 銀行の稟議は DC-09 と重なるため**要検討** |
| NM-05 | データ分析アシスタント | RS-05 と重なるため**要検討** |

---

## 8. 受け入れ条件（全体）

1. `node tools/verify.mjs` / `node tools/regress.mjs`（= `npm test`）が全 PR で PASS
2. `node tools/gen-index.mjs --check` が PASS（`docs/service-map.md` が鮮度を保つ）
3. `python3 scripts/dify/render.py --env cloud-master --all --check` が全件 PASS（PR-6）
4. regress の差分が **§3-7 の表と行単位で一致**する。既存 43 件の `id`/`cat`/`sub`/`st`/`tags`/並び順に**変更が 1 件も無い**
5. 業種を切り替えても **①②③ のどのパターンでも白画面にならない**（台本の無いサービスは `chat` にフォールバック）
6. 業種を切り替えたあと、`state` が §4-4 の遷移表どおりにリセット／保持される
7. 言語（ja/zh/en）×テーマ（light/dark）×パターン（①②③）×業種（製造/金融）の **48 通り**で、文言の欠落・未翻訳・色の浮きが無い（目視。verify が i18n とトークンを機械検出済み）
8. `mock/css/tokens.css` の `--ntt-*` に差分が無い（`git diff` で確認）
9. `mock/css/components.css` に色の直値が無い（verify §5）
10. Pages（`https://shoulang0729.github.io/dify/`）で `catalog.html` と `index.html` の両方が開き、業種切替が動く
11. `localStorage` のキーが `mock.lang` / `mock.theme` の 2 つのままである（`grep -c "localStorage" mock/js/app.js` の中身確認）

---

## 9. PM 判断待ち（推奨つき）

| # | 論点 | 推奨 | 保留したときの影響 |
|---|---|---|---|
| 1 | 製造業カタログが 43 → **48 件**に増える（PO-01〜04・EG-01 が両業種に出る）ことの承認 | **増やす**（PM の追加条件どおり。「業種を問わない機能は両方に出る」） | PR-3 が着手できない |
| 2 | **KN-04 の改称**（労務・総務の社内問い合わせ対応 → 社内問い合わせ受付とFAQ蓄積。§2-4-2） | **改称する**。製造業のメニューでも通じる語で、＃25 を統合できる | ＃25 を KN-04 に統合できず、新規採番になる（金融 29 件） |
| 3 | **実在サービス名**（WIND・企業微信・BI ツール名・記事 URL）をモックに出すか | **出さない**（一般名にする。§7-3） | 台本と `RS-04` の名称が決まらない → PR-3・PR-4b が止まる |
| 4 | **架空銀行名**「瑞央銀行 / 瑞央银行 / Zuio Bank, Ltd.」で確定してよいか（代替：碧洋銀行 / Hekiyo Bank） | **瑞央銀行で確定**。実在名との衝突は実装前に確認 | PR-2（world）と PR-3（`INDUSTRIES.wordmark`）が止まる |
| 5 | 業種切替を **`.mockbar`（足場）**に置く（ヘッダーに置かない） | **`.mockbar`**（§4-1 の 4 理由） | PR-1 の UI が決まらない |
| 6 | 業種を `localStorage` に**保存しない**（リロードで製造業に戻る） | **保存しない**（§4-5）。必要なら `mock.industry` を追加（§2-6 の変更＝ CLAUDE.md 更新が要る） | PR-1 の挙動が決まらない |
| 7 | 業種横断の**第 2 陣候補 9 件**（§7-4）を金融にも出すか | **今回は出さない**。次の版で判断 | 金融のメニューが 28 件のまま（十分な件数） |
| 8 | **業種横断アプリのマスタ DSL 中立化**（`DC-02` の system prompt から「青嶺精工（蘇州）」を外し `brand.replace` / Start 変数に逃がす）を許可するか | **許可する**（§5-2 D-3。第 1 弾は `DC-02` 1 本だけ） | PR-6 で `DC-02` の金融対応ができず、業種横断アプリは「モックだけ両業種／実装は製造業だけ」になる |
| 9 | **`CLAUDE.md` の更新**（§7-1 の文案：§2-3 の `state`・置き場・データ、§2-9、§2-11、§6） | **PR-1 マージ後に適用** | 実装と CLAUDE.md が食い違う（load-bearing の記述が古くなる） |
| 10 | **＃15+＃16 統合／＃18 分離**（PM のヒント「＃18 と ＃16 は近い」と違う判定。§2-1） | **本書の判定を採る**（作る vs チェックするで入出力・出口が違う） | FA-04・FA-05 の粒度が決まらない |
| 11 | **＃17 を RS-01 に統合しない**判定（PM の候補と違う。§2-1） | **本書の判定を採る**（クリッピング配信 vs 与信レビュー論点） | RS-01・RS-02 の粒度が決まらない |
| 12 | 台本の無い金融サービス（PR-3 時点で 28 件中 28 件、PR-4 完了時 0 件）を、途中の PR で `chat` フォールバックのまま出してよいか | **よい**（verify は warn。既存の仕様） | PR-3 と PR-4 を 1 本にまとめる必要があり、PR が巨大になる |
| 13 | **本書の文言分担**（§0-3：台本と③フィードの `when`/`note` の zh/en を implementer が ja から作る） | **この分担で進める**（3 言語すべてを本書に書くと台本だけで本書が読めない長さになる） | architect が台本の全文（28 件 × 3 言語）を先に書く版が必要になる |
| 14 | 金融 23 件に `added`（NEW バッジ）を付けるか | **付ける**（実際に同日追加）。②の新着帯に 30 日間 23 件並ぶのが多すぎるなら付けない | 表示上の好みの問題。どちらでも動く |

---

## 10. Issue 本文（`gh` が無いので PM が起票。タイトルと本文をそのまま使える形）

> **タイトル**：金融（在中日系銀行）カタログの新設と業種切替（製造業／金融）

### 背景

PM から金融（銀行）向けのユースケース 30 件が Excel で提出された。既存の製造業カタログ（8 分類 43 サービス）とは別の世界（在中日系銀行）だが、議事録・ToDo 追跡・報告レビュー・FAQ 応答のように**業種を問わない機能は両方のカタログに出す**。デモで見せる中身（ペルソナ・拠点・数字・KB・台本）は選択中の業種の世界で語られる。

### 設計書

`docs/handoff/2026-09-08-finance-catalog.md`

### 決まったこと（要約）

- 業種は `CATS` / `CATS[].subs` / `SVCS` の **`industries`**（`['mfg']` / `['fin']` / `['mfg','fin']`）で表す。`CATS`・`SVCS` は 1 本のまま
- **1 サービス 1 管理番号**。業種横断でも番号は 1 つ。分類を業種で共有し、通番は分類内で業種を跨いで連番（ある業種のメニューでは飛び番に見える）
- 台本だけ業種で 2 階層：`SCENARIOS[industry][svcId]`、`mock/js/data/scenarios/<industry>/<分類>.js`
- 業種切替は **`.mockbar`（レビュー用の足場）**。`localStorage` に保存しない。`state.industry` を追加
- 統廃合：元 30 件 → 新規 23 件 ＋ 既存 5 件への統合（DC-02 / DC-08 / KN-04 / KN-05 / GN-06）
- 新設分類コード：**RS**（情報収集・データ分析）**CV**（顧客カバレッジ・審査）**FA**（財務・経理オペレーション）**PO**（組織運営・PMO）**EG**（エンジニアリング支援）。PO と EG は両業種
- `dify/apps/` は**平置きのまま**（業種でディレクトリを分けない）。業種横断アプリのマスタ DSL は 1 本で、世界観の語は `brand.replace` と Start 変数に逃がす

### データ層の変更前後（reviewer が `regress` と照合）

| | 前 | 後 |
|---|---|---|
| `CATS` | 8 | 13（追加：`rs` `cv` `fa` `po` `eg`） |
| 中分類 | 17 | 29（追加 12） |
| `SVCS` | 43 | 66（追加 23。削除・改名・分類移動・成熟度変更は 0） |
| `TAGS` | 43 | 56（追加 13） |
| `T` | 79 | 78（追加 `indLabel`／削除 `wordmark` `dept`） |
| 業種別 | — | 製造 48 ／ 金融 28 ／ 両業種 10 |

追加する id（この順で配列末尾）：`kn6 kn7 kn8 dc9 rs1 rs2 rs3 rs4 rs5 cv1 cv2 cv3 cv4 fa1 fa2 fa3 fa4 fa5 po1 po2 po3 po4 eg1`
両業種にする既存 id：`kn4 kn5 dc2 dc8 gn6`

### 受け入れ条件

1. `npm test`（verify + regress）が全 PR で PASS
2. `node tools/gen-index.mjs --check` PASS
3. `python3 scripts/dify/render.py --env cloud-master --all --check` PASS（PR-6）
4. regress 差分が設計書 §3-7 の表と行単位で一致。**既存 43 件の `id`/`cat`/`sub`/`st`/`tags`/並び順に変更 0**
5. 業種 × 言語 × テーマ × パターンの 48 通りで文言欠落・色の浮きが無い
6. 業種切替後の `state` が設計書 §4-4 の遷移表どおり
7. `mock/css/tokens.css` の `--ntt-*` に差分が無い／`components.css` に色の直値が無い
8. Pages で `catalog.html` と `index.html` の両方が開き、業種切替が動く
9. `localStorage` のキーは `mock.lang` / `mock.theme` の 2 つのまま

### 触らない範囲

- `mock/css/tokens.css` の `--ntt-*`（ブランドパレット）
- 既存 43 件の `id` / `cat` / `sub` / `st` / `tags` / 配列内の並び順（`industries` の 1 行追加と KN-04 の `name`/`desc` 改訂だけが例外）
- 既存台本の本文（PR-1 の移動では 1 バイトも変えない）
- `render.js` のパターン分岐（①②③）の構造。業種でパターンを増やさない
- `localStorage` キー `mock.lang` / `mock.theme`
- `.github/workflows/pages.yml`
- `.claude/**`
- `CLAUDE.md`（更新は PM が §7-1 の文案で適用）

### PR の分割案

1. **PR-1 業種軸の骨格**（`industries` 導入・`state.industry`・`.mockbar` の業種セグメント〔金融は disabled〕・台本を `scenarios/mfg/` へ移動・検査ツールの業種対応・`regress --update`）
2. **PR-2 金融の架空世界マスタ**（`data/world/mfg/` へ移動 ＋ `data/world/fin/` 新設・`check-world.mjs` の業種対応）— **PR-1 と並列可**
3. **PR-3 金融カタログのデータ層**（分類 5・中分類 12・サービス 23・タグ 13・`HOME.fin`/`FEED.fin`・`--cat-*` 5 組・金融セグメント有効化・`regress --update`）
4. **PR-4a 金融の台本（KN/DC/GN/PO/EG）** → **PR-4b 金融の台本（RS/CV/FA）**（`catalog.html` が重なるので直列寄り）
5. **PR-5 デモガイドと索引の仕上げ**（`mock/index.html` の業種切替の節）
6. **PR-6 Dify 実装リファレンスと DSL 方針**（`docs/dify/usecases/` 23 件・`env.yml` に `industry:`・`DC-02` の業種中立化を 1 本だけ試す）— **PR-4/PR-5 と並列可**

### PM 判断待ち

設計書 §9 の 14 項目（特に #1 製造業が 48 件に増えること、#2 KN-04 の改称、#3 実在サービス名の扱い、#4 架空銀行名、#8 `DC-02` の中立化、#9 `CLAUDE.md` の更新）。
