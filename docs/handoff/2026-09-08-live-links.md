# 本番リンク（`live.js`）— デモ画面から Dify の本番アプリを開く

- 日付：2026-09-08
- Issue：#124
- レーン：**M/L**（データ層に新ファイル・多言語辞書・CSS・検証ツールに触る）
- 実行場所：`run:cloud`（設計・実装・レビュー）。URL の採取だけ `run:mac`
- 状態：**設計。PM 判断 D1〜D8 が未決（§10）**。D1・D4・D7 が決まるまで PR-2 以降は着手しない

---

## §0 前提の確認結果（現物で裏を取った事実）

| 確認したこと | 事実 | 確認方法 |
|---|---|---|
| `dify/apps/` の DSL 本数 | **12 本** | `ls dify/apps/` |
| `SVCS` の件数 | **67 件**（製造 49／金融 29／両業種 11） | `tools/lib/load.mjs` 相当の vm 実行 |
| `CATS` の件数 | **13 分類・29 中分類** | 同上 |
| 成熟度の内訳 | 提供中 12／試行版 29／構想 26 | 同上 |
| **12 本の DSL と「提供中 12 件」の集合** | **完全に一致**（`dc1 dc2 dc4 gn1 gn2 gn5 kn1 kn2 kn3 lg1 lg4 nm3`） | 両集合を JSON 比較して `true` |
| `dify/state/` | **まだ存在しない**（`docs/handoff/2026-09-08-execution-split-and-runner.md` §6 で W2／PR-2 として設計済み・未実装） | `ls dify/state/` が `No such file` |
| `dify/env/cloud-master/env.yml` の `apps:` | 12 件すべて `id: null`（実 id は未記入） | 現物 |
| `dify/results/cloud-master/` | 実行結果 md が多数（KN-01/02/03・DC-01/02/04・GN-01/02・LG-01・NM-03 など） | `find` |
| 実機側の自動 PR の変更パスガード | `dify/results/**`・`dify/state/**` **以外は push しない**（`.github/workflows/dify-ops.yml` L189-217） | 現物 |
| `catalog.html` の `<script src>` | `data/ui → data/catalog → data/home → data/style → data/scenarios/<業種>/* → app → render → events`（計 22 本） | 現物 |
| `mock/scripts.html` | **`js/data/*.js` を独自に読み込む 2 つ目の消費者**（台本レビューページ） | 現物 L179-188 |
| `tools/verify.mjs` の §番号 | §1〜§12 まで使用済み。**§13 は `dify/state/` 用に予約済み**（execution-split §6-5） | 現物 |
| `tools/regress.mjs` のスナップショット | `T` のキー一覧（`uiKeys`）と `counts.ui` を**含む** | 現物 |
| `mock/index.html` の記述 | 「2026-09-07 時点で 2 件（KN-01・DC-01）を投入済み」「66 サービス」「10 分類 48／8 分類 28」＝**現状（67／49／29）と不一致** | 現物 L148・L192-193・L265 |

### 0-1 この確認から出た、設計に効く 2 つの発見

**発見 A：いまは「実装済み」＝「提供中」が 1 対 1 で完全一致している。**
つまり **今日この印を出しても、成熟度バッジ「提供中」以上の情報は 1 ビットも増えない**。印に意味が出るのは次のどちらかが起きた瞬間から：

- 提供中 12 件のうち **まだ Cloud に公開していない／URL を確認していない**ものがある（＝ `LIVE` ⊊ 提供中）。これは**今まさにその状態**（`apps:` の id が全部 `null`、公開 URL はどこにも記録がない）。だから印の実際の意味は「提供中のうち、**いま押せば本当に動く**もの」になる
- 将来、試行版が先に実装される／提供中が一時的に落ちる

→ D1（§10）の判断材料。**「提供中」との重複を避けるため、印の文言は成熟度ではなく「押せる／開ける」を語る言葉にする**（§5-3 の `liveMark`）。

**発見 B：金融カタログでは印がほぼ出ない。**
12 本のうち金融業種で見えるのは `DC-02`（議事録作成）だけ。**金融 29 件中 1 件**。製造は 49 件中 12 件。碧洋銀行のデモで印を探しても 1 個しか無い。→ D1 の判断材料。

---

## §1 目的

Dify に本番実装したユースケースを、カタログの詳細画面から**新しいタブで直接開けるようにする**。デモ（台本）は**そのまま残す**。顧客に「これは絵ではなく、もう動いています」と、その場でクリックして示せる状態を作る。

**やらないこと**：デモを本番リンクに置き換えること。本番リンクを持たないサービスに「未実装」の否定的な印を出すこと。

---

## §2 変更する範囲 / 触らない範囲

### 2-1 変更する（PR ごとの内訳は §9）

| ファイル | 変更 | PR |
|---|---|---|
| `mock/js/data/live.js` | **新規**。`LIVE` の宣言（初期は空 `{}`） | PR-1 |
| `mock/catalog.html` | `<script src="js/data/live.js">` を 1 行追加 | PR-1 |
| `tools/lib/load.mjs` | `DATA_KEYS` に `'LIVE'` を追加 | PR-1 |
| `tools/verify.mjs` | §1-B の `expectedOrder`／`expectedCount` を 4 → 5 に。**§14 を新設** | PR-1 |
| `mock/js/app.js` | ヘルパー `liveOf(id)` を 1 本追加 | PR-2 |
| `mock/js/render.js` | `liveMarkHTML()` / `liveBtnHTML()` を追加し、4 か所に差し込む | PR-2 |
| `mock/css/components.css` | `.live-mark` / `.btn-live` を追加（既存トークンのみ） | PR-2 |
| `mock/js/data/ui.js` | `T` に 5 キー追加（ja/zh/en） | PR-2 |
| `tools/regress.baseline.json` | `--update`（`uiKeys` 86 → 91 のため） | PR-2 |
| `mock/js/data/live.js` | PM から受け取った URL を投入 | PR-3 |
| `tools/gen-live.mjs`・`package.json`・`scripts/dify/cloud_deploy.py`・`dify/state/cloud-master.yml` | 生成の自動化（#121 W2 の後） | PR-4 |
| `mock/index.html` | デモガイドに本番リンクの説明を 1 段落 | PR-5 |

### 2-2 触らない（明示）

- **`mock/scripts.html`**：`js/data/*.js` を独自に読み込む 2 つ目の消費者だが、`LIVE` は使わない。**`<script src>` を足さない**。台本レビューページに本番リンクは要らない
- **`mock/css/tokens.css`**：新しいトークンを 1 つも足さない。`--ntt-*` は不変（§2-2）
- **`mock/js/app.js` の `state`**：キーを 1 つも増やさない。`LIVE` は状態ではなく定数
- **`mock/js/events.js`**：`data-act` を 1 つも増やさない（§5-2 の理由）
- **`localStorage`**：4 つ目のキーを作らない（`mock.lang` / `mock.theme` / `mock.fav` のまま）
- **`mock/js/data/catalog.js`（`CATS`/`SVCS`）・`home.js`・`style.js`・`scenarios/**`**：1 バイトも変えない。`SVCS[]` に `url` を埋め込まない
- **`dify/apps/**`・`dify/env/**`・`dify/kb/**`・`dify/tests/**`**：変えない（PR-4 の `dify/state/` を除く）
- **`.github/workflows/**`**：変えない。とくに `dify-ops.yml` の変更パスガードは**緩めない**
- **`CLAUDE.md`**：この設計書では変えない。§7 に追記の**文案**だけ置く。反映は PM 承認後に別 PR
- **`docs/service-map.md`／`tools/gen-index.mjs`**：本番列を足さない（§10 の補足を参照）
- **`.claude/**`**

---

## §3 データ形式 — `LIVE`

### 3-1 置き場と読み込み順

新規ファイル **`mock/js/data/live.js`**。`catalog.html` の `<script src>` の並びで **`js/data/style.js` の直後・`js/data/scenarios/mfg/kn.js` の直前**に置く。

```
js/data/ui.js → js/data/catalog.js → js/data/home.js → js/data/style.js
  → js/data/live.js                                     ← ここ（新規・5 本目）
  → js/data/scenarios/mfg/*.js → js/data/scenarios/fin/*.js
  → js/app.js → js/render.js → js/events.js
```

理由：`LIVE` は他のどのデータにも依存しない純粋なリテラルなので、依存順の制約は無い。「設計データ（ui/catalog/home/style）」と「台本」の**境目**に置くことで、`live.js` だけが**実機の事実**であることが並びから読める。

`tools/verify.mjs` §1-B ④ の `expectedOrder` 冒頭 4 本を **5 本**にし、⑤ の `expectedCount = 4 + …` を **`5 + …`** にする。`tools/lib/load.mjs` の `DATA_KEYS` に `'LIVE'` を足す。

### 3-2 形

```js
'use strict';
/* mock/js/data/live.js — LIVE（Dify 上の本番アプリへの公開 URL）
   設計書 docs/handoff/2026-09-08-live-links.md。CLAUDE.md §2-3（js/data/** は純粋なリテラルのみ）・§2-10（公開範囲）。
   ここに書いてよいのは cloud-master（data/world/ の架空データしか入っていない環境）の公開 Web アプリ URL だけ。
   顧客の実データが入る環境（inhouse / customer-a）の URL は絶対に書かない。 */

const LIVE = {
  // '<内部 id>': { url: '<https:// で始まる公開 Web アプリ URL>', env: 'cloud-master', updated: 'YYYY-MM-DD' },
};
```

| フィールド | 必須 | 型・制約 | 意味 |
|---|---|---|---|
| キー | 必須 | `SVCS[].id`（`/^[a-z]{2}\d+$/`。例 `kn1`） | どのサービスの本番か |
| `url` | **必須** | `https://` で始まる文字列。ホストは `udify.app` のみ（§7 の許可ホスト） | 新しいタブで開く先 |
| `env` | **必須** | 文字列。**許可値は `'cloud-master'` のみ**（当面） | どの環境のアプリか。公開可否の判定軸 |
| `updated` | **必須** | `YYYY-MM-DD` | **人が実際に開いて動くことを確認した日**。「投入した日」ではない |

**任意フィールドは作らない。** 3 つとも必須にする理由：任意にすると「URL だけ書いて確認していない」状態が生まれ、デモ当日に 404 で恥をかく事故が起きる。`updated` の存在が「人が一度は開いた」の証跡になる。

**入れないもの**（意識的な除外）：

- **多言語文言**（`name` / `desc` の別版）。表示文言はすべて `T` に置く。`LIVE` を §2-1 の i18n 検査の対象外に保つため
- **API キー・トークン・dataset id・app id（UUID）**。`url` に含まれるサイトコード以外の秘密を持たない
- **複数環境**（`{ 'cloud-master': {...}, 'customer-a': {...} }` のような入れ子）。Issue のとおり **1 サービス 1 URL** で始める。必要になったら値をオブジェクトから配列に広げられる形にはなっている（キー構造は変えずに済む）
- **アプリ種別**（chat / workflow / completion）。URL のパスに現れており、UI では使わない

**キーを内部 id（`kn1`）にする理由**：`SCENARIOS` / `HOME` / `FEED` / `mock.fav` がすべて内部 id を結合キーにしている。ここだけ管理番号（`KN-01`）にすると、`render.js` の全参照が `LIVE[svcCode(x.id)]` になり、他のデータ層と読み方が変わる。管理番号↔内部 id の変換は**生成側と検査側だけ**が持つ（`KN-01` → `kn` + `parseInt('01')` = `kn1`。`svcCode()` の逆変換）。

### 3-3 データ件数（変更前後。§2-9 の記載義務）

| | 変更前 | 変更後（PR-1・PR-2） | 変更後（PR-3） |
|---|---|---|---|
| `CATS` | 13（中分類 29） | **13（29）変更なし** | 変更なし |
| `SVCS` | 67 | **67 変更なし** | 変更なし |
| `TAGS` | 57 | **57 変更なし** | 変更なし |
| `PATTERNS` | 3 | **3 変更なし** | 変更なし |
| `T`（UI キー） | 86 | **91**（+5。§5-3） | 変更なし |
| `LIVE` | （存在しない） | **0 件**（空オブジェクト） | **PM が URL を渡した件数のみ**（上限 12） |

**PR-3 で `LIVE` に入りうる id は次の 12 個だけ**（`dify/apps/` にある DSL と 1 対 1。これ以外の id を書くと verify §14-b/§14-d が FAIL する）：

| 管理番号 | 内部 id | 成熟度 | 業種 | 名称（ja） | DSL |
|---|---|---|---|---|---|
| DC-01 | `dc1` | 提供中 | 製造 | 日本本社への報告資料作成 | `DC-01-hq-report-draft.yml` |
| DC-02 | `dc2` | 提供中 | 製造・金融 | 議事録作成と次回論点整理 | `DC-02-meeting-minutes.yml` |
| DC-04 | `dc4` | 提供中 | 製造 | 安全衛生・5S 掲示物・改善提案の中国語化 | `DC-04-site-notice-zh.yml` |
| GN-01 | `gn1` | 提供中 | 製造 | 経費精算チェック | `GN-01-expense-check.yml` |
| GN-02 | `gn2` | 提供中 | 製造 | 請求書（発票）処理 | `GN-02-invoice-fapiao.yml` |
| GN-05 | `gn5` | 提供中 | 製造 | 文書要約 | `GN-05-document-summary.yml` |
| KN-01 | `kn1` | 提供中 | 製造 | 技術ナレッジ QA | `KN-01-tech-knowledge-qa.yml` |
| KN-02 | `kn2` | 提供中 | 製造 | 設備マニュアル・取扱説明書の検索 | `KN-02-equipment-manual-search.yml` |
| KN-03 | `kn3` | 提供中 | 製造 | 社内規程・就業規則 QA | `KN-03-internal-rules-qa.yml` |
| LG-01 | `lg1` | 提供中 | 製造 | 日中翻訳（社内の言い方に揃える） | `LG-01-ja-zh-translation.yml` |
| LG-04 | `lg4` | 提供中 | 製造 | ビジネスメール作成（日中往復） | `LG-04-business-email.yml` |
| NM-03 | `nm3` | 提供中 | 製造 | 日報・実績の集計と要約 | `NM-03-daily-report-summary.yml` |

`SVCS[].id` は改名しない（§2-11）。`LIVE` から項目が消えるのは「本番を下げた」意味であり、id の欠番管理とは無関係。

---

## §4 生成の流れ

### 4-1 制約の整理

1. `live.js` の中身（公開 URL）は **実機の事実**。人が Cloud で公開して初めて決まる（CLAUDE.md §7）
2. **実機側（`run:mac` / `run:runner`）の自動 PR は `dify/results/**` と `dify/state/**` しか書けない**（`dify-ops.yml` の変更パスガード）。したがって **`mock/js/data/live.js` を実機側から自動 PR で書くことはできない**
3. `dify/state/` は**まだ存在しない**（#121 W2 待ち）
4. Dify Cloud の公開 Web アプリ URL は `https://udify.app/<種別>/<サイトコード>`。**サイトコードは app id（UUID）とは別物**で、`dify/env/**/env.yml` の `apps:` からは導出できない

→ この 4 つから、**「実機が `dify/state/` に事実を書く → クラウド側が生成物として `live.js` に落とす」**という 2 段構えにする。これは `docs/service-map.md` とまったく同じ形（機械が生成、**再生成はクラウド側だけが行う**）で、CLAUDE.md §7 の原則と整合する。

### 4-2 流れ（フェーズ 2・最終形）

```
[run:mac / run:runner]                    [run:cloud]
Dify Cloud で公開                          │
   │                                       │
   ├─ cloud_deploy.py --write-state        │
   │     dify/state/cloud-master.yml に     │
   │     apps.<番号>.public_url を書く       │
   │     （自動 PR。パスガードを通る）        │
   │                                       │
   └──────── main にマージ ────────────────▶│
                                           ├─ node tools/gen-live.mjs
                                           │     dify/state/cloud-master.yml を読み
                                           │     mock/js/data/live.js を書き出す
                                           └─ 通常の PR（run:cloud）
```

`dify/state/cloud-master.yml` に足すフィールド（#121 W2 のスキーマ §6-3 への追加提案。**この設計書では実装しない**）：

```yaml
apps:
  KN-01:
    id: 00000000-0000-0000-0000-000000000000
    published_at: '2026-09-08T01:20:00+09:00'
    dsl_sha256: '<64 hex>'
    api_key: true
    public_url: 'https://udify.app/chat/xxxxxxxxxxxxxxxx'   # ← 追加。公開 Web アプリの URL
    public_checked_at: '2026-09-08'                          # ← 追加。人が開いて動くことを確認した日（YYYY-MM-DD）
```

`public_url` を state に置いてよい根拠：execution-split §6-4 が `cloud-master` について「app id は URL に出るもので秘密ではない・直値可・git 追跡する」と定めており、公開 Web アプリ URL は**より公開性が高い**（そもそも Pages に載せるのが目的）。`inhouse` / `customer-a` の state は `.gitignore` で追跡しないので、顧客環境の URL は git に入らない。

### 4-3 `tools/gen-live.mjs`（PR-4）

- 入力：`dify/state/cloud-master.yml`（無ければ**何もせず正常終了**し、既存の `live.js` を残す）
- 出力：`mock/js/data/live.js` を**丸ごと書き直す**（決定論的なフォーマッタ。同じ入力なら常にバイト一致）
- 変換：`public_url` と `public_checked_at` が**両方ある**エントリだけを出力。`KN-01` → `kn1`、`env: 'cloud-master'`、`updated: public_checked_at`
- 並び：`SVCS` の並び順（`catalog.js` の宣言順）。人が読んだときカタログと同じ順に見えるようにする
- `--check`：書き換えずに差分の有無だけを見て、差があれば exit 1（`gen-index.mjs --check` と同じ作法）
- `package.json` に `"live": "node tools/gen-live.mjs"` / `"live:check": "node tools/gen-live.mjs --check"`
- `tools/verify.mjs` §14-h（鮮度）：`dify/state/cloud-master.yml` がある場合、`gen-live` の出力と `live.js` が一致するか。**不一致は `warn`**（FAIL にしない。理由は §10 D6）

### 4-4 手で書ける形も残す（フェーズ 1・今回）

`dify/state/` が無い間（＝**今回の PR-1〜PR-3**）は、`live.js` を**手で書く**。

1. PM が Mac で対象アプリを開き、**「公開」→ アプリを実行 → URL をコピー**（`https://udify.app/chat/…`）
2. その URL を**ブラウザのシークレットウィンドウで開いて実際に動くことを確認**する（未ログインで開けることの確認も兼ねる。ここが §7 の公開判定そのもの）
3. PM が「管理番号・URL・確認日」の 3 点セットを implementer に渡す
4. implementer が `live.js` に 1 行足す。**判断はしない**（PM が渡していない番号は書かない）

フェーズ 2 に移っても**この手順は生きたまま残す**：`gen-live.mjs` は state があるときだけ上書きし、`live.js` そのものは常に人が読める・書けるリテラルであり続ける。

---

## §5 UI の変更点

### 5-1 レイアウト

**詳細画面（`view === 'detail'`）— `.cta-row`**

```
変更前：
┌──────────────────────────────────────────────────────────────┐
│ [ デモを見る ]  [ ☆ お気に入りに追加 ]  ※ 本画面はコンセプト…  │
└──────────────────────────────────────────────────────────────┘

変更後（LIVE にエントリがあるときだけ）：
┌──────────────────────────────────────────────────────────────┐
│ [ デモを見る ]  [ ↗ 本番を開く ]  [ ☆ お気に入りに追加 ]        │
│ ※ 本画面はコンセプト確認用のモックです                          │
│ ※ 本番アプリは架空データのデモ環境です                          │
└──────────────────────────────────────────────────────────────┘
        ↑primary        ↑ghost（新規 <a>）   ↑既存 ghost

LIVE にエントリが無いとき：変更前とまったく同じ（1 バイトも増えない）
```

- 「本番を開く」は **`.btn-primary` の直後・`favToggleHTML(x)` の直前**
- **`<button>` ではなく `<a href target="_blank" rel="noopener noreferrer">`**
- `liveNote` は `.cta-note` と同じ見た目のもう 1 行（`.cta-note.cta-note-live`）。`LIVE` にエントリがあるときだけ出す

**詳細画面 — `.d-meta`（成熟度バッジの並び）**

```
[提供中] [検索] [設備]              ← 変更前
[提供中] [↗ いま使える] [検索] [設備] ← 変更後（印は成熟度バッジの直後）
 ~~~~~~   ~~~~~~~~~~~~~
 塗り     枠線＋矢印アイコン ＝ 形が違うので成熟度と混ざらない
```

**カード（`cardHTML` の `.c-meta`）**

```
┌────────────────────────────────────┐
│ ▣  ナレッジ検索・問い合わせ・技術   ☆ │
│    技術ナレッジQA           KN-01   │
│    現場の不具合・工程条件を…         │
│  ●提供中  [↗ いま使える]  検索  設備 │   ← 印は .status の直後・タグの前
└────────────────────────────────────┘
```

### 5-2 `data-act` は増やさない（重要）

本番リンクは**通常のリンク**なので、`data-act` も `state` も要らない。

- 詳細画面のボタン＝`<a>`。`.cta-row` に `data-act` を持つ祖先は無いので、`document` の click ハンドラと衝突しない
- カード／`.use-row`／`.feed-item` の印＝**`<span>`（クリックできない）**。これらは `data-act="svc"` を持つ要素の**内側**なので、リンクにすると「カードを押したのに別タブが開く」事故になる。**印は表示だけ**、開くのは詳細画面から

→ CLAUDE.md §2-3 の「遷移」契約（`data-act` 16 種）と `state` の形は**無変更**。`tools/verify.mjs` §7 の `requiredActs` も無変更。

### 5-3 新しい `T` キー（5 個・ja / zh / en すべて記載）

`mock/js/data/ui.js` の `T` の**末尾**（`themeToDark` の後ろのブロック群のさらに末尾）に、コメント `/* ---- 本番リンク（設計書 2026-09-08-live-links.md §5-3。5 キー） ---- */` を付けて追加する。

| キー | ja | zh | en | 使い所 |
|---|---|---|---|---|
| `liveOpen` | `本番を開く` | `打开正式版` | `Open live app` | 詳細画面のボタン文字 |
| `liveMark` | `いま使える` | `已可使用` | `Live now` | カード・`.d-meta` の印 |
| `liveMarkAria` | `「{name}」は Dify 上で実際に使えます` | `「{name}」已在 Dify 上实际可用` | `"{name}" is live on Dify and usable now` | 印の `aria-label` / `title` |
| `liveOpenTitle` | `Dify 上の本番アプリを新しいタブで開きます（{updated} 時点で動作確認済み）` | `在新标签页中打开 Dify 上的正式应用（截至 {updated} 已确认可用）` | `Opens the live app on Dify in a new tab (verified working as of {updated})` | ボタンの `title` |
| `liveNote` | `※ 本番アプリは架空データのデモ環境です` | `※ 正式应用运行在使用虚构数据的演示环境上` | `* The live app runs on a demo environment that contains fictional data only.` | `.cta-note-live` |

`{name}` / `{updated}` の差し込みは既存の `chatHello`（`{name}`）・`favSeeAll`（`{n}`）と同じく `String.replace` で行う。

**文言の意図（D7 の材料）**：`liveMark` を「実装済み」「本番あり」にすると、顧客には「提供中」との違いが伝わらない（§0-1 の発見 A）。**「いま使える」は成熟度ではなく「押せば動く」という利用者視点の言葉**なので、隣に並ぶ「提供中」と意味が重ならない。代案は §10 D7。

### 5-4 CSS（`mock/css/components.css`。新しいトークンも `#RRGGBB` も書かない）

```
.live-mark   … 枠線 1px（var(--text-link)）／背景なし／文字 var(--text-link)
               font-size は .tag と同じ／radius は .badge と同じ／左に 12px の ↗ SVG
.btn-live    … .btn-ghost を土台にした <a>。text-decoration: none;
               color: var(--text-link); border-color: var(--border-default);
               hover で border-color / color を var(--text-link-hover) に
.cta-note-live … .cta-note と同じ（色は var(--text-secondary)）
```

**`--action-primary` ではなく `--text-link` を使う理由（load-bearing）**：`--action-primary` は dark でも `#0071BC` のまま据え置かれており（`tokens.css` の dark ブロックで確認済み）、dark のカード地 `#111C30` に対して **3.32:1** しか出ない。文字色としては AA（4.5:1）を割る。`--text-link` は dark で `#2E90FF` に切り替わり、同じ地に対して **5.31:1**。light では `#0071BC` on `#FFFFFF` で **5.14:1**。両テーマで AA を満たすのは `--text-link` の側。

数値は WCAG 2.x の相対輝度式（`(L1+0.05)/(L2+0.05)`）で計算し、**小数第 3 位を四捨五入**した値（reviewer の独立計算とも一致）。3.32:1 は文字には足りないが、**枠線は非テキスト UI なので 3:1 で足りる**（`.live-mark` の枠線も文字と同じ `--text-link` にするので、いずれにせよ余裕がある）。

**色だけに頼らない**：印は「枠線＋外部リンク矢印アイコン」という**形**で成熟度バッジ（塗りつぶし・アイコンなし）と NEW バッジ（塗りつぶし・ターコイズ）から区別できる。お気に入りの星（塗り／輪郭）と同じ考え方。

### 5-5 描画の差し込み位置（`mock/js/render.js`）

ヘルパーは 2 本だけ。**エントリが無ければ空文字を返す**ので、呼び出し側に分岐を書かない（`newBadgeHTML` と同じ作法）。

| # | 差し込み先 | パターン | 何を出すか |
|---|---|---|---|
| 1 | `cardHTML()` の `.c-meta`（`.status` の直後） | ①②③ 共通（②の「よく使う」「おすすめ」でも自動的に出る） | `liveMarkHTML(x)` |
| 2 | `detail` ビューの `.d-meta`（成熟度バッジの直後） | 3 パターン共通 | `liveMarkHTML(x)` |
| 3 | `detail` ビューの `.cta-row` | 3 パターン共通 | `liveBtnHTML(x)` ＋ `liveNote` |
| 4 | ② の `.use-row` の meta（`.status` の直後） | ② のみ | `liveMarkHTML(x)` |
| 5 | ③ の `.feed-item` の meta（`.status` の直後） | ③ のみ | `liveMarkHTML(x)` |

**規則：`statusText()` をサービスの隣に描いている場所には、その直後に印を置く。**（`.side-link` は成熟度も出していない小さなリンクなので**足さない**）
`chat` / `demo` ビューのヘッダーにも `.status` があるが、**足さない**（デモの最中に本番へ飛ばす導線は混乱のもと）。

`liveOf(id)` は `mock/js/app.js` に置く（`scnOf` の隣）：`SCENARIOS` と同じく「あれば返す・無ければ null」。

### 5-6 空でも壊れないこと（`LIVE = {}` / `file://`）

- `live.js` は `catalog.html` の `<script src>` で必ず読み込まれ、`const LIVE = {}` が常に定義される。`typeof` ガードは不要
- `LIVE` が空なら `liveMarkHTML` / `liveBtnHTML` は全件で空文字を返し、**画面は現状と完全に同一**（PR-2 の受け入れ条件）
- `file://` でも `<script src>` は相対パスなので読める（§2-8）。ネットワークアクセスは**リンクを押したときだけ**発生する。初期表示で外部へ 1 バイトも出さない
- `?v=` キャッシュスタンプは `catalog.html` の他の `<script src>` にも付いていないので、`live.js` にも**付けない**（既存の並びと揃える）

---

## §6 検証ツール

### 6-1 `tools/verify.mjs` — **§14 を新設**（§13 は `dify/state/` 用に予約済み）

`docs/handoff/2026-09-08-execution-split-and-runner.md` §6-5 が **§13 を `dify/state/` の検査に予約している**（W2／PR-2）。番号の取り合いを避けるため、本設計は **§14** を使う。W2 が先にマージされても後になっても衝突しない。

| 番号 | 検査 | 結果 |
|---|---|---|
| **14-a** | `mock/js/data/live.js` が存在し、`LIVE` がオブジェクトとして読める（`{}` でもよい） | 無い／オブジェクトでない → **FAIL** |
| **14-b** | `LIVE` の各キーが `SVCS[].id` に存在する | 無い id → **FAIL** |
| **14-c** | 各値が `url` / `env` / `updated` の 3 キーちょうどを持つ。`url` は `https://` で始まる文字列、`env` は `'cloud-master'`、`updated` は `/^\d{4}-\d{2}-\d{2}$/` | 違反 → **FAIL** |
| **14-d** | 各キーの管理番号（`kn1` → `KN-01`）に対応する `dify/apps/<管理番号>-*.yml` が実在する | 無い → **FAIL**（実装が無いのにリンクだけある状態を止める） |
| **14-e** | `url` のホストが許可ホスト集合 `['udify.app']` に含まれる | 外 → **FAIL**（顧客セルフホストの URL 混入を機械で止める。§7） |
| **14-f** | `url` に重複が無い | 重複 → **FAIL**（コピペ事故） |
| **14-g** | `dify/apps/` にあるが `LIVE` に無い管理番号の一覧 | **warn**（「12 本中 N 本にリンクあり」が毎回見える） |
| **14-h** | （PR-4 以降）`dify/state/cloud-master.yml` があるとき、`gen-live.mjs` の出力と `live.js` が一致 | 不一致 → **warn**（§10 D6） |

**14-c で「3 キーちょうど」を要求する理由**：将来 `token` や `api_key` のようなフィールドが「便利だから」と足されるのを止める。増やすときは設計書と verify を同時に変える＝ PM の目を通る。

**多言語検査（§2 の i18n）の対象外**：`LIVE` は表示文言を持たないので、`checkML` の対象に**追加しない**。§2-1 の「3 言語同時」は `T` の 5 キーが担う。

### 6-2 `tools/regress.mjs` — `LIVE` は **含めない**

**判断：含めない。**

理由：

1. `regress` の役割は **「設計データ層（`CATS`/`SVCS`/`TAGS`/`PATTERNS`/`T`）の意図しない増減」を止めること**（§2-9）。`LIVE` は設計値ではなく**実機の事実**で、Cloud にアプリを 1 本公開／停止するたびに正当に変わる
2. 含めると、**デプロイのたびに `--update` が要る**。`--update` を打つ回数が増えるほど「とりあえず `--update`」が習慣になり、`CATS`/`SVCS` の本当の事故を見逃す**基準そのものが緩む**。regress の価値は「めったに更新されない」ことに宿っている
3. `LIVE` の整合は verify §14 が全項目 FAIL で押さえており、`regress` に無くても穴は開かない。「黙って消えた」は §14-g の warn と reviewer の diff 監査で見える

**ただし PR-2 では `--update` が要る**：`T` に 5 キー足すため `snapshot.uiKeys`（86 → 91）と `counts.ui`（86 → 91）が動く。PR 本文に「設計書 `2026-09-08-live-links.md` §5-3 の `T` キー追加に伴う基準更新」と書く。`svcs` / `cats` / `tags` / `patterns` は**すべて無変更**でなければならない（reviewer は baseline の diff がこの 2 行＋キー 5 個だけであることを確認する）。

---

## §7 公開範囲のルールの明文化

### 7-0 Issue #124 §4 の 3 案の比較 → **(a) を採る**

| 案 | 内容 | 採否 | 理由 |
|---|---|---|---|
| **(a)** | **公開してよいアプリだけリンクを載せる**（架空データのみの `cloud-master` に限る） | **採用** | Pages・`file://`・対面のどれでも同じものが動く。ルールが**機械で検査できる**（`env` の値とホストを verify §14 が見る）。いま Cloud にある 12 本は `data/world/` の架空世界しか使っておらず、実害が無い（CLAUDE.md §2-10 で PM 確認済み） |
| (b) | `live.js` を Pages に公開せず、対面デモのときだけローカルで読み込む | 不採用 | `mock/` は**丸ごとサイトのルートとして公開**される（§2-8。`pages.yml` の `path: mock`）。除外するには `mock/` の外にファイルを置くか公開設定を分岐させるしかなく、**§2-8 の「`catalog.html` からの参照は相対パスのみ」を壊す**。さらに「PM のローカルにしか無いファイル」が生まれ、reviewer が Pages で確認できない状態＝ #121 が潰した「二重の正本」に逆戻りする |
| (c) | Dify 側でアクセス制限（ログイン必須）をかけてからリンクする | 不採用（将来の選択肢として残す） | 顧客がその場で押しても**ログイン画面が出て終わり**になり、この Issue の目的（本物に飛べる）が消える。顧客の実データを入れた環境を見せる必要が出たときは、リンクではなく**画面共有**で見せる（§7-1 末尾）。将来 (a) の費用が問題になれば D5(b) として再検討 |

補足：(a) と (c) は排他ではない。**環境ごとに変わるのは「載せるか／載せないか」だけ**で、`LIVE` の形は変えなくてよい（`env` の許可値を増やすだけ）。

### 7-1 いま `LIVE` に URL を載せてよい条件（3 つすべて）

| # | 条件 | 誰が判定 | どこで検出 |
|---|---|---|---|
| **C1** | そのアプリが乗っている環境が **`cloud-master`**（`data/world/` の架空世界データしか入っていない）。`dify/env/README.md` の環境台帳で「確認状態＝確認済」であること | **PM** | verify §14-c（`env` が `'cloud-master'` 以外なら FAIL） |
| **C2** | `dify/apps/<管理番号>-*.yml` がリポジトリにある（＝設計値が git にあり、何が動いているか追える） | 機械 | verify §14-d |
| **C3** | **PM が未ログインのブラウザでその URL を開き、実際に応答が返ることを確認した日**を `updated` に書いた | **PM**（`run:mac`） | verify §14-c（形式）／reviewer が PR 本文の確認記録と照合 |

**満たしていないもの**：`inhouse` / `customer-a`、および顧客の実データ・実名・社内文書を投入したあらゆる環境。**URL を `LIVE` に書かない。** 顧客デモで本番を見せる必要が出たら、**そのときは Pages ではなく画面共有で見せる**（リンクを公開面に置かない）。

### 7-2 リンクを公開する意味（PM が知っておくべき副作用）

Dify Cloud の公開 Web アプリ URL に含まれるサイトコードは、実質的に**「知っていれば誰でも使える鍵」**である。GitHub Pages に載せた時点で、

- リンクを知った全員が、PM の Dify ワークスペースのアプリを**未ログインで実行できる**
- 実行のたびに **PM の OpenRouter／Dify の利用枠を消費する**（`data/world/` の架空データしか読めないので情報漏えいは無いが、**費用は出る**）

→ §10 D5 で PM の受け入れ判断を仰ぐ。

### 7-3 `CLAUDE.md` §2-10 への追記文案（**この PR では反映しない**。PM 承認後に別 PR）

既存の最終行「…**顧客の実データ・実名・社内文書を投入した環境の URL は載せない**（環境台帳 `dify/env/README.md` の確認状態と対で判断する）。2026-09-08 時点で Cloud にある 12 本は `data/world/` の架空世界だけを使っており、載せてよい（PM 確認済み）。仕組みは Issue #124」の**直後に、次の 1 項目を足す**：

> - **公開デモに載せる本番 URL の置き場は `mock/js/data/live.js` の `LIVE` だけ**。`SVCS` にも `HOME`/`FEED` にも URL を埋め込まない。載せてよいのは **①環境が `cloud-master`（架空データのみ）②`dify/apps/<管理番号>-*.yml` がある ③PM が未ログインのブラウザで開いて動くことを確認した日を `updated` に書いた** の 3 つを満たすものだけ。判定するのは **PM**（`dify/env/README.md` の環境台帳「確認状態」と対で見る）。機械側は `tools/verify.mjs` §14 が `env: cloud-master` 以外・`udify.app` 以外のホスト・DSL の無い管理番号を FAIL にする。**公開 URL のサイトコードは「知っていれば誰でも使える鍵」なので、載せた分だけ利用枠を消費する**。設計書 `docs/handoff/2026-09-08-live-links.md` §7

---

## §8 受け入れ条件（全体）

1. `node tools/verify.mjs` が PASS（新設 §14 を含む）
2. `node tools/regress.mjs` が PASS（PR-2 の `--update` 後）
3. `npm run index` の出力が変わらない（`docs/service-map.md` は無変更）
4. `LIVE` が空のとき、`catalog.html` の見た目が**変更前と完全に一致**（①②③ 全パターン・detail・chat・demo・ja/zh/en・light/dark）
5. `LIVE` にエントリがあるとき、そのサービスの**詳細画面にだけ**「本番を開く」が出る。新しいタブで開く（`target="_blank"` ＋ `rel="noopener noreferrer"`）
6. 印はカード／`.d-meta`／`.use-row`／`.feed-item` に出る。**成熟度バッジとは形（枠線＋矢印）で区別できる**
7. `LIVE` に無いサービスには**何も出ない**（「未実装」の否定バッジを出さない）
8. `mock/css/components.css` に新しい `#RRGGBB` が **0 個**。`tokens.css` は無変更
9. `state` のキー・`data-act` の種類・`localStorage` のキーが**すべて無変更**
10. `file://` で `mock/catalog.html` を直接開いて動く
11. ja / zh / en の 3 言語で新しい文言が表示される（`T` の 5 キーが 3 言語とも空でない）
12. light / dark 両テーマで印とボタンの文字コントラストが **4.5:1 以上**（§5-4 の計算どおりであることを実測）
13. `mock/scripts.html` が無変更で、これまでどおり開ける
14. **幅 1100px と 375px で横スクロールが出ない**（Issue #124 の受け入れ条件）。カードの `.c-meta` は印が 1 つ増えるぶん折り返しが必要になるので、既存の `.c-meta` の `flex-wrap` を確認する。詳細画面の `.cta-row` も同様に、375px でボタン 3 つが縦に積める

---

## §9 PR 分割案

**PR-1 → PR-2 → PR-3 は直列**（`catalog.html` と `live.js` を共有するため）。PR-4・PR-5 は PR-3 の後なら並列可。

| PR | 内容 | 触るファイル | 受け入れ条件 | 実行場所 |
|---|---|---|---|---|
| **PR-1**<br>契約と検査 | `live.js` 新規（**空**）／`catalog.html` に 1 行／`load.mjs` の `DATA_KEYS`／`verify.mjs` §1-B の 4→5 と **§14 新設** | `mock/js/data/live.js`・`mock/catalog.html`・`tools/lib/load.mjs`・`tools/verify.mjs` | 全体 1・2・3・4・10・13。§14-g が「12 本中 0 本」と warn する。**画面は 1 ピクセルも変わらない** | `run:cloud` |
| **PR-2**<br>UI | `T` 5 キー／`liveOf`／`liveMarkHTML`・`liveBtnHTML` と差し込み 5 か所／CSS 3 クラス／`regress --update` | `mock/js/data/ui.js`・`mock/js/app.js`・`mock/js/render.js`・`mock/css/components.css`・`tools/regress.baseline.json` | 全体 1・2・4・6・8・9・11・12。**`LIVE` が空なので画面は PR-1 と同一**。baseline の diff が `uiKeys` 5 個＋`counts.ui` の 1 行だけ | `run:cloud` |
| **PR-3**<br>URL 投入 | PM から受け取った URL を `LIVE` に入れる | `mock/js/data/live.js` **のみ** | 全体 1・2・5・6・7。PR 本文に「管理番号・URL のホスト・確認日」の表（**URL 全体は PR 本文に貼らず diff で見る**）。§7-1 の C1〜C3 を PM が満たしたことを本文に明記 | `run:cloud`（URL の採取は `run:mac`） |
| **PR-4**<br>生成の自動化 | `tools/gen-live.mjs`（`--check`）／`package.json`／verify §14-h／`cloud_deploy.py --write-state` に `public_url`・`public_checked_at`／`dify/state/` のスキーマ追記 | `tools/gen-live.mjs`・`package.json`・`tools/verify.mjs`・`scripts/dify/cloud_deploy.py`・`dify/state/cloud-master.yml`・`docs/handoff/2026-09-08-execution-split-and-runner.md` | `gen-live.mjs` を 2 回続けて実行して出力がバイト一致。state が無くても正常終了。`--check` が現状で PASS | `run:cloud`。**#121 W2（`dify/state/` 導入）の後** |
| **PR-5**<br>デモガイド | `mock/index.html` に本番リンクの説明を 1 段落（ja/zh 併記） | `mock/index.html` **のみ** | 文言は PM 承認済み。`verify` §5-A（トークン非コピー）が PASS | `run:cloud`。**PM の文言承認後** |

**PR-4 の注意**：`docs/handoff/2026-09-08-execution-split-and-runner.md` は**他人の設計書**なので、`public_url` の追加は**追記の形**で行い、Issue #121 にコメントして合意を取る（勝手に書き換えない）。

---

## §10 PM 判断（推奨つき）

| # | 論点 | 選択肢 | **推奨** | 根拠 |
|---|---|---|---|---|
| **D1** | 67 件中 12 件（金融では 29 件中 1 件）にしか印が付かない。これは狙いどおりか | (a) 出す (b) 詳細画面のボタンだけにして一覧の印はやめる (c) 一覧に「本番あり」の絞り込みも足す | **(a) 出す** | 「今すぐ触れるのはどれか」はデモで最も多い質問。ただし §0-1 の発見 A のとおり**今日は「提供中 12」と完全一致**で情報量が増えない。印の価値は「提供中のうち、実際に URL を確認できた N 件」に絞ったときに初めて出る。**PR-3 で全 12 件を埋めず、確認できたものだけ入れる運用**にするのが前提。(c) は `favOnly` と同じ足場が要るので別 Issue |
| **D2** | `LIVE` を `regress.baseline.json` に含めるか | (a) 含めない (b) 含める | **(a) 含めない** | §6-2 の 3 点。とくに「`--update` の常態化が regress の価値を殺す」。整合は verify §14 が全項目 FAIL で押さえる |
| **D3** | `LIVE` が空（本番 0 件）のまま PR-1・PR-2 を main に入れてよいか | (a) 空で入れる (b) URL が揃うまで待つ | **(a) 空で入れる** | 空のとき画面が変わらないことが設計の前提（§5-6）。**空で main に入れておけば、URL の追加が「データ 1 行の PR」になり、デモ直前でも安全に足せる**。(b) はコードとデータが同じ PR に混ざり、レビューが重くなる |
| **D4** | 詳細画面で「デモ」と「本番」のどちらを主ボタンにするか | (a) デモが主・本番が副 (b) 本番が主・デモが副 (c) 両方とも同じ強さ | **(a) デモが主**（根拠を §10-1 に差し替えたうえで**維持**） | 応答速度の問題は解消済み。**残る根拠は「本番にはいま顧客の目の前で踏みやすい未解決不具合がある」こと**。詳細は §10-1 |
| **D5** | 公開 URL は実質「知っていれば誰でも使える鍵」。Pages に載せて利用枠が消費されることを受け入れるか | (a) 受け入れる（架空データのみ・費用は小） (b) Dify の WebApp にパスワードを掛ける (c) リンクを載せない | **(a) 受け入れる** ＋ 月次で使用量を見る | CLAUDE.md §2-10 は既に「架空データのアプリなら載せてよい」と PM 確認済み。(b) にすると顧客がその場で押せず、この Issue の目的（本物に飛べる）が消える。ただし**費用が出る事実**は §7-2 のとおり明記が要る |
| **D6** | `live.js` と `dify/state/` の鮮度検査（PR-4 §14-h）を FAIL にするか warn にするか | (a) warn (b) FAIL | **(a) warn** | state は**実機側の自動 PR** が単独で main に入れる。FAIL にすると、その自動 PR がマージされた瞬間に**誰も触っていない main の CI が赤くなる**。`docs/service-map.md`（§11-a・FAIL）は再生成もクラウド側なので同じ話にならない |
| **D7** | 印の文言（`liveMark`）ja | (a) `いま使える` (b) `実装済み` (c) `本番あり` (d) `本番稼働中` | **(a) いま使える** | (b)(c)(d) は「提供中」と意味が重なって見え、顧客が 2 つのバッジの違いを聞き返す。(a) は利用者視点で、隣の「提供中」（＝カタログ上の成熟度）と役割が分かれる。zh は `已可使用`、en は `Live now`。**採用しないなら zh/en も差し替えが要るので、この場で決めてほしい** |
| **D8** | `mock/index.html`（デモガイド）に本番リンクの節を足すか（PR-5） | (a) 足す (b) 足さない | **(a) 足す** | ガイドの L265 は「2026-09-07 時点で 2 件（KN-01・DC-01）を投入済み」と**古いまま**。本番リンクを出すなら説明が要る。**別件だが、同ガイドの件数（66 サービス／製造 10 分類 48／金融 8 分類 28）も現状（67／10 分類 49／8 分類 29）とズレている**。直すなら PR-5 に同梱するか、別の S レーンで回すかを決めてほしい |

### 10-1 D4 の根拠（`dify/KNOWN_ISSUES.md` と `dify/results/cloud-master/` の実測に当たって書き直し）

**訂正**：本設計書の初版は「DI-010 により本番は 200〜340 秒かかる／顧客の前で 3 分待つ」と書いていた。**これは誤り**で、その数字は**修正前**の症状である。`dify/KNOWN_ISSUES.md` の DI-010 は **2026-09-08 付で `fixed`**（PR #109 streaming ＋ PR #110 `completion_params`）、**504 は 0 件**になっている。

**修正後の実測（各アプリの最新の結果ファイル）**

| 管理番号 | 最新の結果ファイル | 所要秒（最短〜最長） |
|---|---|---|
| KN-01 | `KN-01-20260908-2045.md` | 〜21.0 s |
| KN-02 | `KN-02-20260908-2046.md` | 6.6〜18.2 s |
| KN-03 | `KN-03-20260908-2047.md` | 〜17.8 s |
| GN-05 | `GN-05-20260908-2050.md` | 〜17.7 s |
| GN-02 | `GN-02-20260908-0925.md` | 〜18.9 s |
| NM-03 | `NM-03-20260908-2051.md` | 〜6.7 s |
| LG-04 | `LG-04-20260908-0924.md` | 〜34.9 s |
| DC-04 | `DC-04-20260908-0935.md` | 〜38.4 s |
| DC-02 | `DC-02-20260908-0934.md` | 24.6〜49.6 s |
| **DC-01** | `DC-01-20260908-0740.md` | 7.4〜**72.5** s（T02 が最長） |

**KB 検索の QA 系は 7〜21 秒、生成の重いもの（報告資料作成）でも最長 72.5 秒。最悪でも 1 分強に収まっている。**「3 分待つ」という表現は根拠を失ったので取り下げる。

**それでも推奨を (a) デモが主 のまま維持する理由**（速度ではなく、より確かな 2 点に置き換える）：

1. **本番には、日中デモで踏みやすい未解決の不具合が残っている。** `dify/KNOWN_ISSUES.md` で `open` のまま残っているもののうち、**リンク先候補 12 本に直接あたるのは 4 件**：**DI-025**（`GN-01` `NM-03`：`lang=zh` 指定なのに地の文が丸ごと日本語）／**DI-026**（`LG-01`：説明・用語対応表・注記がすべて日本語）／**DI-027**（`DC-04`：注記の本体が中国語）／**DI-009**（`DC-01` T06 の社外秘の残し方が未確認）。いずれも**「中国語で聞いたのに日本語が返る」＝日中 2 拠点の顧客が真っ先に試す操作**で表面化する。台本デモは 3 言語ぶんレビュー済みで、この事故が起きない
2. **台本デモは決定論的で、オフライン（`file://`）でも動き、利用枠を消費しない。** 本番アプリは毎回生成し直すので出力が揺れ、ネットワークと PM の利用枠に依存する（§7-2）。**先に「必ず成立する話」を見せてから「本物もあります」と押す**順のほうが、デモの成否がネットワークとモデルの機嫌に左右されない

→ 速度の根拠は消えたが、**推奨は (a) のまま維持する**。ただし理由が「遅いから」から「まだ言語契約の未解決不具合が残っているから」に変わったので、**DI-025 / DI-026 / DI-027 が fixed になった時点で D4 は再検討に値する**（そのときは (c) 両方とも同じ強さ が現実的）。

**補足（PM 判断ではないが報告）**：`docs/service-map.md`（管理番号の索引）に「本番リンクあり」の列を足すことも考えたが、**今回は足さない**。`gen-index.mjs` が `LIVE` を読むようになると索引の再生成タイミングが実機の都合に引きずられる（§10 D6 と同じ問題）。必要になったら別 Issue で。

---

## §11 触らない範囲 — load-bearing の照合結果

| 節 | 内容 | 触れるか | どう守るか |
|---|---|---|---|
| **§2-1** | i18n キー集合が ja/zh/en 完全一致 | **触れる** | `T` に 5 キーを **3 言語同時**で追加（§5-3 に全文記載。implementer に翻訳させない）。`LIVE` 自体は文言を持たないので i18n 検査の対象外にする |
| **§2-2** | 色はセマンティックトークンのみ／`--ntt-*` 不変 | **触れる** | `components.css` に `#RRGGBB` を書かない。使うのは既存の `--text-link` / `--text-link-hover` / `--border-default` / `--text-secondary` のみ。`tokens.css` は**無変更**（dark ブロックも増やさない）。コントラストは §5-4 で light 5.14:1・dark 5.31:1 を計算済み |
| **§2-3** | 共通レイヤーの契約 | **触れる（追加のみ）** | `js/data/` に 5 本目のリテラルファイルを足す。**`state` は無変更・`data-act` は無変更・データ形は無変更**。表示レイヤーは `state` と `LIVE` を読んで描くだけ。パターン ①②③ で分岐しない（印は 3 パターン共通の規則で出す） |
| **§2-4** | 足場とプロダクト機能を混ぜない | 触れない | 本番リンクは**プロダクト機能**側（本番 UI にも残る）。`.mockbar` には何も足さない |
| **§2-5** | 言語切替はメニュー表示のみ | 触れない | `detectLang()` 無変更。本番アプリは別タブの Dify なので、モックの言語判定とは無関係 |
| **§2-6** | `localStorage` は 3 キーのみ | 触れない | 4 つ目を作らない。`LIVE` は静的データで永続化しない |
| **§2-7** | 成熟度 `st` は 1/2/3 | 触れない | `st` の値域も `statusText`/`statusClass`/`.dot.*`/`.badge.*` も無変更。**本番リンクは成熟度と別軸**なので `st` に 4 を足すような設計にはしない |
| **§2-8** | Pages の公開方式 | 触れない | `live.js` は `mock/js/data/` 配下（`_` 始まりでない）で自動的に公開対象。`catalog.html` からの参照は**相対パス**。`pages.yml` は無変更 |
| **§2-9** | 顧客版差し替えはデータ層だけ | 触れない | `CATS`/`SVCS`/`TAGS` を 1 バイトも変えない（件数は §3-3 の表のとおり全て据え置き）。顧客版に差し替えるときは `live.js` を**空にする**のが既定（顧客環境の URL は §7-1 で禁止） |
| **§2-10** | シークレットを置かない | **触れる（中核）** | §7 で条件 C1〜C3・許可ホスト・機械検出を定義。`LIVE` に API キー・トークン・dataset id・app id を持たせない。CLAUDE.md への追記は**文案のみ**（§7-3）、反映は PM 承認後 |
| **§2-11** | 管理番号 | 触れない | `SVCS[].id` を改名しない。`LIVE` のキーは内部 id、`dify/apps/` との突き合わせは `svcCode()` と同じ変換規則で verify が行う |
| **§2-12** | 環境差分は `env.yml` に閉じる | 触れない | `dify/env/**` を変更しない。**公開 URL は設計値ではなく実機の事実なので `env.yml` には置かない**（置き場は `dify/state/`。§4-2） |
| **§2-13** | 架空データの正本は `data/world/` | 触れない | `LIVE` は URL だけを持ち、架空世界の語を持たない。`npm run world` の結果は変わらない |
| **§7**（実行場所） | 設計値と実機の事実をファイルで分ける | **触れる** | `live.js` は**実機の事実の派生物**。実機側の自動 PR は `mock/**` を書けないので、**`dify/state/` を正本にしてクラウド側が生成する**という 2 段構え（§4-2）。`docs/service-map.md` と同じ形。`dify-ops.yml` の変更パスガードは緩めない |

---

## §12 未解決・後続

- **#121 W2（`dify/state/` の導入）が前提**：PR-4 はそれまで着手しない。W2 のスキーマに `public_url` / `public_checked_at` を足す提案（§4-2）は Issue #121 にコメントして合意を取る
- **サイトコードの取得方法が未確認**：`scripts/dify/console_api.py` は `publish` までは実装されているが、**公開 Web アプリのサイトコード（URL）を返すエンドポイントは未確認**（同ファイルの注記どおりエンドポイント形が実機未確認）。フェーズ 1 は**人がブラウザからコピーする**（§4-4）ので、この未確認は PR-1〜PR-3 をブロックしない
- **一覧の「本番あり」絞り込み**：D1(c)。必要なら別 Issue（`favOnly` と同じ足場が要り、`state` に触るので M/L）
- **`mock/index.html` の件数ズレ**（66/48/28 → 67/49/29）：本件とは別。D8 で扱いを決める
