# CLAUDE.md — このリポジトリでの作業ルール

`shoulang0729/dify` は次の **4 区分**を置くリポジトリ：**①デモ**＝`mock/`（AIエージェントカタログの UI モック、GitHub Pages で公開）／**②実装ソース**＝`dify/`（マスタ DSL・環境レイヤー・KB・テスト）・`scripts/`・`tools/`／**③ユースケース・シナリオ**＝`docs/`（設計書・実装リファレンス）・`mock/js/data/scenarios/`（デモ台本）／**④ダミーデータ**＝`data/world/`（架空世界マスタ）・`dify/kb/`・`dify/tests/`。地図はトップ `README.md`、管理番号からの索引は `docs/service-map.md`（生成物）。
Dify Cloud で確定したマスタを、社内・顧客 A・顧客 B… の環境へ `dify/env/<env>/env.yml` の差し替えでリリースする（§2-12）。
（SwingTrainer アプリ本体は別リポ `shoulang0729/Dify.SwingTrainer`。）

作業は **architect → implementer → reviewer** の3エージェント分業で進める（`/feature <お題>`）。
このファイルは3エージェント全員が読む。**特に「§2 load-bearing」が本体。**

---

## §1 レーン判定（PM が最初に決める）

| レーン | 基準 | 流れ |
|---|---|---|
| **S** | 文言・余白・要素の削除/移動のみ。データ層・多言語辞書・トークン・共通レイヤー・Pages 設定に**触らない** | PM が受け入れ条件を書く → implementer → reviewer（軽量。ただし §2 と verify は省かない） |
| **M/L** | それ以外すべて。特にデータ層・多言語・トークン・共通レイヤーに触るもの | architect（設計書＋Issue）→（UI なら PM がモック承認）→ implementer → reviewer |

迷ったら **M/L**。複数の小さな S は1つの Issue にまとめてよい。

**ユースケースの追加**（Notion の指示書・アイデア → デモのデータ層＋実装リファレンス）は `/usecase <Notion URL | DB URL | 要望文>` で回す（段取りは `docs/handoff/2026-09-07-usecase-intake.md`、候補の台帳は Notion DB「ユースケース候補」）。中身は M/L として architect → implementer → reviewer を通る。

---

## §2 load-bearing —— 勝手に変えない（壊れると困るもの）

各項目：**何を** / **なぜ** / **どこで検出するか**。

### 2-1. 多言語辞書のキー集合は ja / zh / en で完全一致
- 対象：**`mock/js/data/**` 内の** `T`（UI 文言）・`TAGS`・`PATTERNS[].name/desc`・`CATS[].name/abbr/subs[].name`・`SVCS[].name/desc`
- なぜ：言語切替で一部だけ別言語が残る事故を防ぐ。`L(obj)` は `obj[lang] ?? obj.ja` にフォールバックするので**欠落は静かに日本語が出て気づけない**
- 検出：`tools/verify.mjs`（キー欠落・空値・`en` にかな残り）
- ルール：**追加は3言語同時**。英語はモック用ドラフトでよいが**空にしない**

### 2-2. 色はセマンティックトークンのみ。ブランドパレットは不変
- 対象：**`mock/css/components.css`** に **`#RRGGBB` の直値を書かない**。必ず `var(--surface-*|--text-*|--border-*|--action-*|--status-*|--badge-*)`
- **`mock/css/tokens.css`** の `--ntt-*`（NTT DATA ブランドパレット）は**変更禁止**。ダーク対応は同ファイルの `:root[data-theme="dark"]` で**セマンティック層だけ**上書き（**dark ブロックは 1 つだけ**）。**`mock/index.html` は同じ `tokens.css` を `<link>` で参照する。トークンをコピーしない**
- なぜ：直値が1つ入ると、その箇所だけダークで浮く／ブランド色がズレる
- 検出：`tools/verify.mjs`（直値検出・`var()` 未定義検出・dark ブロック存在）

### 2-3. 共通レイヤーの契約（パターンを増やすときの土台）
- **置き場**：`mock/js/data/ui.js`（`T`/`PATTERNS`/`TAGS`/`TEMPLATES`）・`catalog.js`（`CATS`/`SVCS`）・`home.js`（`HOME`/`FEED`）・`style.js`（`CAT_STYLE`）・`scenarios/<分類>.js`（`SCENARIOS`。大分類ごと 8 ファイル、`window.SCENARIOS` に `Object.assign` で登録）。**`js/data/**` は純粋なリテラル宣言のみ**（`document`・`localStorage`・関数呼び出しを書かない。verify が vm で実行して読むため）。`state` とヘルパーは `mock/js/app.js`、描画は `mock/js/render.js`、click ハンドラと起動は `mock/js/events.js`。**読み込み順は `catalog.html` の `<script src>` の並びが唯一の正**（`data/ui → data/catalog → data/home → data/style → data/scenarios/* → app → render → events`）。古典的スクリプトのまま（`type="module"` にしない＝`file://` 対応）
- **データ**：`CATS`（大分類→中分類）/ `SVCS`（サービス、`cat`/`sub`/`st`/`tags`/`name`/`desc`、任意 `added`〔追加日 `YYYY-MM-DD`。`NEW_DAYS` 以内なら ①バッジ／②新着帯／③お知らせを**その場で計算**して出す。`state`・`HOME`・`FEED` には持たせない。regress の対象外〕）/ `TAGS` / `TEMPLATES`（デモ画面テンプレート 5 種 `qa`/`upload`/`form`/`diff`/`lookup` の名称・説明、3 言語）/ `SCENARIOS`（サービス id → `{ template, persona{name,role,site,native}, steps{ja,zh,en}, input?, result?, script{ja,zh} }`。**台本 `script` と `input`/`result` は ja/zh のみ**＝§2-5 の実装。`SVCS` に埋め込まず別定数）/ `HOME`（② ダッシュボード用：`frequent`〔よく使う 6 件・サンプル利用件数〕・`recommended`〔おすすめ 3 件・理由 3 言語〕。**`SVCS` に埋め込まず別定数**。参照 id は `SVCS`/`CATS` に存在すること）/ `FEED`（③ 業務フィード用：`persona`・`mine`〔担当分類 3〕・`recent`〔最近使った 4〕・`items`〔疑似イベント 7 件、`kind` は `due`/`routine`/`notify`、絶対日付は持たない〕。**`SVCS` に埋め込まず別定数**。管理番号はフィード項目に出さない）/ `CAT_STYLE`（分類 id → インライン SVG アイコン。色は CSS の `--cat-*` トークン側）
- **状態**：`state = { pattern, lang, theme, industry, openCats, selCat, selSub, lastCat, selSvc, view, query, log, fav, favOnly }`。`industry` は業種（`mfg`/`fin`）。`fav` は業種ごとのお気に入り id、`favOnly` は一覧をお気に入りに絞っているか（`fav` だけ `localStorage` に持つ。§2-6）。`view` は `list` / `detail` / `chat` / `demo`。`log` はデモで消費した台本ターン `[{lang,q,a}]`（`log.length` が次に消費する index。言語切替後の再描画で会話を復元）
- **遷移**：`document` の `click` ハンドラの `data-act`（`pattern`/`industry`/`all`/`cat`/`sub`/`svc`/`back`/`backdetail`/`start`/`send`/`run`/`chip`/`restart`/`gocat`/`fav`/`favlist`）。`industry` は業種切替（`.mockbar` に置く。レビュー用の足場）。`fav` は星の付け外し、`favlist` は一覧をお気に入りに絞る。**`fav` は全体を描き直さない**（一覧のスクロール位置が飛ぶため、押した箇所だけを差し替えてフォーカスを戻す）。`gocat` は分類タイルから直接その分類の一覧へ（`cat` と違いトグルしない）。`start` は `SCENARIOS` にあれば `demo`、なければ従来の `chat` へ（フォールバックを残す）
- **ホーム**：`view === 'list'` かつ `selCat`/`selSub`/`query` が全部空の状態。ここだけ `pattern` で描き分ける（① グリッド / ② `renderDash` / ③ `renderFeed`）。`detail`/`chat`/`demo` は 3 パターン完全共通
- ルール：**表示レイヤー（`renderSidebar` / `renderMain` 内のパターン分岐）は `state` を読んで描くだけ**。パターン固有の都合で `state` の形・データ形・遷移を変えない
- なぜ：**パターンを切り替えても選択位置が保持され、同じ業務を別の見せ方で直接比較できる**のはこの契約のおかげ。②③（ダッシュボード / 業務フィード）はこの上に乗せる
- 検出：`tools/verify.mjs`（`state` の必須キー・`data-act` 一覧・§9 シナリオ整合：`SCENARIOS` の id が `SVCS` に存在／`template` が `TEMPLATES` に存在／型の形式。台本の無い `SVCS` は warn／§10 `HOME`・`FEED` の参照 id と 3 言語／§6 `added` の形式／§7 `DEMO_DATE` が固定のまま main に入ると warn）＋ reviewer の diff 監査

### 2-4. 「モックの足場」と「プロダクト機能」を混ぜない
- `.mockbar`（パターン選択セグメント）＝**レビュー用の足場**。本番 UI には存在しない
- ヘッダー右の **言語切替（日/中/英）と テーマ切替** ＝**プロダクト機能**。本番にも残る
- なぜ：顧客に「上のグレー帯は検討用、実画面はその下」と説明できる構成を保つ
- 検出：reviewer の diff 監査

### 2-5. 言語切替はメニュー表示のみ。エージェント本体は日中どちらの入力も受ける
- 言語切替が変えるのは**メニュー・ラベルの表示言語だけ**
- チャット入力は `detectLang()` で **入力言語（ja/zh）を判定し、UI 言語と無関係にその言語で返答**する
- 「日中対応」を**サービスの区別タグにしない**（全サービスの前提だから）
- 検出：`tools/verify.mjs`（`detectLang` の存在）＋ reviewer

### 2-6. `localStorage` キーは許可集合。いまは `mock.lang` / `mock.theme` / `mock.fav` の 3 つだけ
- **既存キーの改名・転用は禁止**（変えるとレビュー参加者の設定が飛ぶ）。**新しいキーを足すのは PM 判断**で、足したら**この節の一覧と `tools/verify.mjs` の許可集合を同時に更新する**
- `mock.fav` はお気に入り（業種ごと `{mfg:[…], fin:[…]}`）。**壊れた値が入っていても他の設定を巻き添えにしない**よう、キーごとに別の try で読み書きする
- 検出：`tools/verify.mjs`（アプリ層に現れる `mock.*` のリテラルが許可集合の部分集合であること。4 つ目を書くと FAIL する）

### 2-7. 成熟度 `st` は 1 / 2 / 3（提供中 / 試行版 / 構想）
- 追加するなら `statusText` / `statusClass` / `.dot.*` / `.badge.*` / トークン（light・dark）を**同時に**
- 検出：`tools/verify.mjs`（`st` の値域）

### 2-8. Pages の公開方式
- `.github/workflows/pages.yml` は **`path: mock`** で `mock/` を**サイトのルート**として公開。URL に `/mock/` は**含まれない**（`https://shoulang0729.github.io/dify/`）
- **`mock/css/**`・`mock/js/**` も公開対象**。`catalog.html`/`index.html` からの参照は**相対パスのみ**（先頭 `/`・`../` 禁止＝`file://` でも開ける）。`mock/` 配下に `_` 始まりのディレクトリを作らない
- `mock/.nojekyll` 必須
- **`mock/` ＝ 4 区分の①デモ。改名しない**（`localStorage` の `mock.lang`/`mock.theme` と過去 Issue/PR のリンクが load-bearing）
- 検出：`tools/verify.mjs`

### 2-9. 顧客版カタログへの差し替えは「データ層だけ」
- 顧客向けメニュー（分類・サービス）の差し替えは `CATS` / `SVCS` / `TAGS` の**データだけ**を変える。描画ロジックは触らない
- 変更前後の**件数と id 一覧を設計書に書く**（reviewer が `regress.mjs` の差分と照合）
- `SVCS[].id` は管理番号（§2-11、例 `KN-02`）として**顧客に見える**。差し替え時も **id を改名しない**（不要になったら欠番、新規は新 id）
- 検出：`tools/regress.mjs`

### 2-10. シークレットを置かない
- Dify のトークン／Cookie／API キーは**環境変数渡し**。コミット・チャット貼り付け禁止
- `.gitignore` で `.env`・`.env.*`（`.env.example` は除く）・`*.key`・`*.pem`・`secrets/`・`dify/build/` を除外済み。設定ファイルはリポジトリの外（`~/.config/dify/env`）
- **`dify/env/**/env.yml` にも顧客実名・実 URL・dataset id・キーを書かない**。環境固有の値は `${VAR}` で環境変数から渡す。顧客は `customer-a` のような匿名 id
- **公開デモ（GitHub Pages）に本番 Dify の URL を載せてよいのは、架空データしか入っていないアプリだけ**。Pages は誰でも見られるので、URL を載せた時点でリンクを知った全員がそのアプリを開ける。**顧客の実データ・実名・社内文書を投入した環境の URL は載せない**（環境台帳 `dify/env/README.md` の確認状態と対で判断する）。2026-09-08 時点で Cloud にある 12 本は `data/world/` の架空世界だけを使っており、載せてよい（PM 確認済み）。仕組みは Issue #124
- 検出：`tools/verify.mjs`（§12 env に秘密・実名が無い）

### 2-11. 管理番号（サービスの呼び名）
- サービスは **`<分類コード>-<2桁通番>`** で呼ぶ：内部 id を大文字化し通番を 2 桁ゼロ埋め（`kn2` → `KN-02`、`pt8` → `PT-08`）。**変換のみ**で別データは持たない。台帳は `docs/handoff/service-index.md`
- 大分類は `KN` / 中分類は `KN/rule` / 台本ターンは `KN-02 ja#2` / 手順は `KN-02 step3` / 表示パターンは `P1`（nav）`P2`（dash）`P3`（feed）
- **通番は分類内の追加順、永久欠番**（削除しても再利用しない）。中分類を移しても番号は変えない。顧客実名版に差し替えても番号は不変（§2-9）
- なぜ：設計書・Issue・PR・チャットで「KN-05 の中国語台本 3 往復目」と言えば一意に決まる
- 検出：`tools/verify.mjs`（`SVCS[].id` が `/^[a-z]{2}\d+$/`・変換後の番号が重複しない）＋ `tools/regress.mjs` の id 一覧（欠番の台帳）

### 2-12. 環境差分は `dify/env/<env>/env.yml` に閉じる
- **何を**：モデル（provider/name/`completion_params`、用途 `chat`/`reasoning`/`embedding`/`rerank`）・KB id・社名と拠点の表記・Start 変数の既定・フラグ（`cross_border`/`partner_mode`/`pipl_mask`）は env にだけ書く。マスタ DSL（`dify/apps/*.yml`）には**架空世界マスタの語と Cloud で動く既定値**（`langgenius/openrouter/openrouter` `qwen/qwen3.8-max`・`dataset_ids: []`）だけを書く。プレースホルダ（`{{…}}`）は入れない
- **なぜ**：マスタ 1 本を社内・顧客 A・顧客 B へ配るため。DSL を環境ごとに fork すると差分が追えなくなる。プレースホルダを入れないのは Cloud への URL インポート（マスタをそのまま貼る）を壊さないため
- **既定モデルを変えるときは `dify/env/**/env.yml`・マスタ DSL・`dify/env/README.md` の環境台帳を同時に変える**（`render.py --env cloud-master --all --check` が全件 PASS すること）。手順は `docs/handoff/2026-09-07-china-models-and-syncback.md` §2-3
- **どこで検出**：`scripts/dify/render.py --env cloud-master --all --check` の出力がマスタと**バイト一致**／`tools/verify.mjs` §12（env のスキーマ・秘密や実名が無い）／`render.py --strict`（未解決の `${VAR}`・未一致の override）
- 設計書：`docs/handoff/2026-09-07-repo-layout-v2.md` §3・§4

### 2-13. 架空データの正本は `data/world/`
- **何を**：会社（青嶺精工／青岭精工／Seirei Seiko Co., Ltd.）・拠点（蘇州工場・Japan HQ）・人・部署・品番・設備・取引先記号・KPI・文書番号体系・カレンダー。台本（`mock/js/data/scenarios/**`）・KB 用文書（`dify/kb/**`）・テスト（`dify/tests/**`）・ユースケース文書はここにある値だけを使う。**新しい名前・数字はまずマスタに足す**
- **なぜ**：4 か所に同じ架空世界が散らばり、既に食い違っている（社名の英名が無かった・`K社`/`K 社`・役職ゆれ）。顧客環境では実データに差し替える境目でもある
- **どこで検出**：`node tools/check-world.mjs`（`npm run world`。**warn のみ・CI には入れない**）。食い違いを潰す PR では `--strict`。未統一の一覧は `data/world/README.md`

---

## §3 検証コマンド（implementer は PR 前、reviewer はレビュー時に必ず実行）

```bash
node tools/verify.mjs     # 構文 / i18n 一致 / 未定義・未使用キー / CSS トークン / データ整合 / 共通レイヤー / Pages 設定 / シナリオ整合
node tools/regress.mjs    # データ層スナップショット比較（件数・id）。FAIL = 意図しない増減
node tools/regress.mjs --update   # 設計書に書かれた意図的なデータ変更のときだけ基準を更新
npm test                  # 上 2 つをまとめて実行（CI の verify ワークフローと同じ）。PR では GitHub Actions の `verify` が自動で走る
npm run index             # docs/service-map.md（管理番号の索引）を再生成。verify §11 が鮮度を検査するので、サービスを足したら必ず
npm run world             # data/world/ と台本・文書の食い違いを報告（warn のみ。CI には入れない）
```

**1つでも FAIL、または §2 の逸脱があればマージしない。**
`regress` を `--update` するときは、PR 本文に「設計書 §X のデータ変更に伴う基準更新」と書く。

---

## §4 エージェントの分業と禁止事項（要約。詳細は `.claude/agents/*.md`）

| | やる | やらない |
|---|---|---|
| **PM（ユーザー）** | レーン判定・プロダクト判断・モック承認・並列/直列の判断 | — |
| **architect** | 設計書（`docs/handoff/`）・Issue・S 判定 | アプリコードを書く／設計後に設計書を黙って変える／`.claude/` を触る |
| **implementer** | feature ブランチで設計通りに実装・verify/regress・PR | `docs/handoff/` を変える／設計判断／main 直 commit |
| **reviewer** | verify/regress・diff 監査・load-bearing 照合・squash マージ・Pages 確認 | 検証 FAIL のまま承認／PR の主張を信じて diff を見ない／自分で直す |

---

## §5 Git 運用

- `main` 直 commit 禁止。`feat/<issue>-<slug>` 等で作業 → PR → **squash マージ** → ブランチ削除
- コミットメッセージは意味のあるものに。PR 本文に設計書パス・変更要約・検証結果・触っていない範囲
- 並列は**ファイル集合が重ならないときだけ**。**同じファイル**を触るお題は直列。分割後は `css/components.css`（デザイン）／`js/data/scenarios/<分類>.js`（台本）／`js/data/*.js`（データ）／`js/render.js`（描画）が別ファイルなので、**別ファイルなら並列可**
- **リリースは `release/<env>/<YYYYMMDD>` タグ**（同日 2 回目は `-2`）。環境ごとの記録は `dify/CHANGELOG.md`。**顧客ごとにブランチを切らない**（差分は `dify/env/` で吸収）
- 設計書は機能ごとに `docs/handoff/YYYY-MM-DD-<slug>.md`

---

## §6 バックログ（v2 以降）

- **Dify Export / Import 自動化（git ⇄ Dify 同期）**：**import 方向（git → Dify）は #84 の `render.py`／`release.py` で実装**（Cloud は URL インポート、セルフホストは Console API）。export 方向（Dify → git）のみ Issue #3 に残る（セルフホスト後）
- **リポジトリ構成 v2（#84）**：4 区分・`data/world`・`dify/env`・リリースモデル。設計書 `docs/handoff/2026-09-07-repo-layout-v2.md`。PR-1（地図・索引・world）済み、PR-2（env＋render）・PR-3（release＋CHANGELOG）進行中
- **Dify Cloud 実装（#82）**：第 1 弾 KN-01・DC-01 を `dify/apps/` に置き、Mac の Claude Code（`/dify-deploy`）で投入・テスト。結果は `dify/results/`
- **モック ②ダッシュボード / ③業務フィード**：§2-3 の共通レイヤー上に実装。**直列**（`T` 末尾・`renderMain` ホーム分岐・`PATTERNS`・verify §10・`regress.baseline.json` が重なる）。設計書 `docs/handoff/2026-09-06-patterns-dash-feed.md`。①②③ すべて実装済み（#42：PR-1 #47・デザインパス #51・PR-2 #52）。見え方の改善は Claude Design に引き渡す予定（トークン名は変えず値だけ触る／レイアウトは 2 つ目の `<style>` と `render*`）
- **顧客版カタログ（製造業・日中2拠点）**：シナリオ粒度で **7 分類 33 サービス**に再編し、A-1（#30）でデータ層を差し替え済み（§2-9）。A-2 パートナー連携 8 件・B-1 デモ遷移テンプレート・B-2 台本は投入済み。2026-09-07 に **DC-08 報告レビュー（提出前チェック／受領後の論点整理）** と **GN-06 頼まれ事・放置業務の追跡** を追加し 8 分類 17 中分類 43 サービス（提供中 12／試行版 23／構想 8）。金融版カタログ（#120、架空の碧洋銀行、業種切替は `.mockbar`）で RS・CV・FA・PO・EG の 5 分類と金融向けサービスが加わり、**GN-07 幹部来訪・出張アテンド段取り**（#132）も追加された結果、現在は **13 分類 29 中分類 67 サービス**（製造 49／金融 29／両業種 11、提供中 12／試行版 29／構想 26）。設計書は `docs/handoff/2026-09-06-*.md`、実現性は `docs/dify/`
- **ユースケース化の段取り**：`/usecase`（`.claude/commands/usecase.md`）。Notion DB「ユースケース候補」の状態 `候補` → `確認中` → `設計中` → `実装中` → `公開済み`。統廃合は 5 軸（分類・タグ・ペルソナ・入出力・出口）の一致数で判定。Notion 原文はコミットしない（§2-10）
- **リファクタリング P2（#77）**で `catalog.html` を層ごとに分割済み（`css/tokens.css`・`components.css`・`js/data/**`・`js/app.js`・`render.js`・`events.js`）。P3 候補：`?v=` キャッシュスタンプの機械検証、`tools/bundle.mjs`（単一ファイル生成）、`scenarios/` の 1 サービス 1 ファイル化。構成 v2（#84）は `docs/handoff/2026-09-07-repo-layout-v2.md`
- **`top.html` の扱い**：バンドル済みで手編集不可。②③ が `catalog.html` に入ったので **削除（PR-3）**。トップ `index.html` はデモガイド（#45）
