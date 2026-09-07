# リポジトリ構成 v2 — ①デモ／②実装ソース／③ユースケース・シナリオ／④ダミーデータ と、マスタ → 各環境へのリリースモデル

- Issue: #84
- レーン: **M/L**（`tools/` の検証ハーネス・`dify/**` の実装資材・トップ `README.md` の地図・`CLAUDE.md` の load-bearing 提案に触る）
- 基準コミット: `85fcb33`（main）／進行中: #77 PR-B `feat/77-split-b-data`・#82 `feat/dify-apps-first`
- 設計者: architect（実装しない）
- PM の言葉：「GitHub 内もドキュメントやソース整理しておいて。①デモ ②実装ソース ③詳細ユースケース想定、デモシナリオなど ④デモ用ダミーデータ。このユースケースをクラウドで実装したら、これをマスタとして、社内環境、顧客A環境、顧客B環境…にリリースしていく」

---

## 0. 目的（何が困っていて、何が解決すれば終わりか）

| 困りごと | 解決の形 |
|---|---|
| ディレクトリが 6 つ（`mock` `docs/handoff` `docs/dify` `dify` `scripts` `tools`）に増え、**新しく入る人・エージェントが「どれが何か」を毎回聞く** | トップ `README.md` に **4 区分 → ディレクトリ → 入口ファイル**の地図が 1 枚ある |
| 管理番号 `KN-02` から、①デモの台本・②DSL・③ユースケース文書・④ダミー文書 を辿るのに 4 か所を手で探す | **`docs/service-map.md`（生成物）** で 1 行に全部並ぶ。無いものは「—」で欠落が見える |
| 台本・ダミー文書・テストに出る人名・数字・品番が**それぞれの作者の頭の中**にあり、既に食い違っている（例：`青嶺精工` 2 回 / `青岭精工` 14 回・英名なし、`K 社` 133 回 / `K社` 8 回、王 磊の役職 3 通り） | **`data/world/` を架空世界の正本**にし、`tools/check-world.mjs` が食い違いを一覧で出す |
| Dify Cloud で作ったアプリを社内環境・顧客 A・顧客 B に配ると、**モデル名・KB id・社名・拠点が環境ごとに違う**。DSL を環境ごとに fork すると差分が追えなくなる | **環境差分を `dify/env/<env>/env.yml` 1 枚に閉じ込め**、`render.py` がマスタ DSL に流し込む。マスタは 1 本 |
| リリースが「Chrome で手でインポートして、動いたら終わり」で、**いつ・どの環境に・どの版を入れたか**が残らない | `release.py` が render → import → test → `dify/results/<env>/` → `git tag` → `dify/CHANGELOG.md` まで通す |

**維持するもの（この設計の制約）**
- モック（`mock/**`）は **1 バイトも変えない**。`node tools/regress.mjs` の差分 0、`verify` は PASS のまま
- #82（`dify/` 第 1 弾）の**配置をそのまま前提**にする。`git mv` は原則 0 件（§6-1）
- #77 P2（`catalog.html` 分割）の読み込み契約・`tools/lib/load.mjs` に**乗る**（作り直さない）
- Dify Cloud への **URL インポートが今までどおり動く**（マスタ DSL は生の YAML のまま。プレースホルダを入れない＝§4-2）

**非目標**：モックの見た目・データの変更／Dify アプリの新規追加（#82 の続きは別 Issue）／Dify からの export 自動化（Issue #3 の export 方向は v2.1、§4-6）。

---

## 1. 4 区分と置き場

### 1-1. 最終ツリー（この設計の完了形）

```
dify/（リポジトリのルート）
│
├── README.md                    ← ★4 区分の地図（PR-1 で全面追記。§1-4 に文案）
├── CLAUDE.md                    作業ルール（PM が §9 の案を適用）
├── package.json  .nvmrc  .gitignore
│
├── mock/                        ①デモ  ── GitHub Pages 公開物。改名しない（§1-2）
│   ├── index.html                  入口：デモガイド
│   ├── catalog.html                本体：AIエージェントカタログ
│   ├── css/{tokens,components}.css
│   └── js/
│       ├── data/{ui,catalog,home,style}.js
│       ├── data/scenarios/<分類>.js   ← ③デモ台本（コード。#77 PR-B で新設）
│       └── {app,render,events}.js
│
├── dify/                        ②実装ソース ＋ ④ダミーデータ（#82 の配置のまま）
│   ├── README.md                   入口：何があるか・手インポート手順・規約
│   ├── DEPLOY.md                   ②Mac からの投入・テスト手順（PR-3 で「リリース」章を追加）
│   ├── CHANGELOG.md                ②リリース履歴（PR-3 で新設）
│   ├── apps/<番号>-<slug>.yml       ②マスタ DSL（1 サービス 1 ファイル）
│   ├── env/                        ②環境レイヤー（PR-2 で新設。§3）
│   │   ├── README.md
│   │   ├── cloud-master/env.yml       既定＝マスタ（PM の Dify Cloud）
│   │   ├── inhouse/env.yml            社内環境
│   │   └── customer-a/env.yml         顧客 A（匿名 id。実名・キーは ${VAR}）
│   ├── kb/<番号>/*.md               ④KB 用ダミー文書
│   ├── tests/<番号>.json            ④テスト入力（`<番号> T<2桁>`）
│   ├── results/<env>/              ②テスト結果（PR-3 で env サブディレクトリ化）
│   ├── build/<env>/                生成物（.gitignore。commit しない）
│   └── check.py                    ②DSL 構造チェック
│
├── data/                        ④ダミーデータの上流
│   └── world/                      ★架空世界マスタ（PR-1 で新設。§2）
│       ├── README.md  company.md  calendar.md
│       └── org.csv  people.csv  products.csv  equipment.csv  partners.csv  kpi.csv
│
├── docs/                        ③詳細ユースケース・設計
│   ├── service-map.md              ★管理番号 → ①②③④ の索引（生成物・編集禁止。§1-3）
│   ├── dify/
│   │   ├── README.md                  入口：実装可能性・参照資料
│   │   ├── implementation-guide.md    ③全体方針・テスト書式・プロンプト共通ルール・DSL 運用
│   │   ├── platform-components.md     ③共通部品 PC-01〜17
│   │   ├── decisions-pending.md       ③PM 判断待ち DP-01〜39
│   │   ├── usecases/<番号>.md          ③1 サービス 1 ファイルの実装リファレンス（43 件）
│   │   └── templates/*.yml             参照 DSL（外部出典・無改変）
│   └── handoff/
│       ├── README.md                  入口：設計書の書き方
│       ├── YYYY-MM-DD-<slug>.md       ③設計書（architect → implementer）
│       ├── <slug>.issue.md            Issue 本文の下書き
│       └── service-index.md           管理番号の台帳（採番ルール・欠番）
│
├── scripts/dify/                ②Dify 操作スクリプト
│   ├── env.example                    環境変数の雛形（env ごとにコピー）
│   ├── render.py                      ★env をマスタ DSL に流し込む（PR-2。§4-3）
│   ├── release.py                     ★render → import → test → tag → CHANGELOG（PR-3。§4-4）
│   ├── console_api.py                 ★セルフホストの Console API を閉じ込める（PR-3）
│   ├── kb_upload.py                   KB へダミー文書を投入
│   └── run_tests.py                   Service API でテストを流す
│
├── tools/                       ②検証ハーネス（モック側）
│   ├── verify.mjs  regress.mjs  regress.baseline.json  lib/load.mjs
│   ├── gen-index.mjs                  ★docs/service-map.md を生成（PR-1）
│   └── check-world.mjs                ★世界マスタとの食い違いを報告（PR-1）
│
└── .github/workflows/{pages,verify}.yml
```

**4 区分は「ディレクトリ 1 対 1」ではない**（`dify/` は②と④にまたがり、③は `docs/` とデモ台本コードにまたがる）。だから地図（§1-4）と索引（§1-3）が要る。

| 区分 | 何 | 置き場 | 入口ファイル |
|---|---|---|---|
| **①デモ** | 顧客に見せる UI モック（Pages 公開） | `mock/` | `mock/index.html` |
| **②実装ソース** | Dify に入れる DSL・環境定義・操作スクリプト・検証ツール | `dify/apps` `dify/env` `scripts/dify` `tools` | `dify/README.md` |
| **③ユースケース・シナリオ** | 詳細ユースケース／設計書／デモ台本 | `docs/dify/usecases` `docs/dify/*.md` `docs/handoff` `mock/js/data/scenarios` | `docs/dify/usecases/README.md` |
| **④ダミーデータ** | 架空世界マスタ・KB 用文書・テスト入力 | `data/world` `dify/kb/<番号>` `dify/tests` | `data/world/README.md` |

### 1-2. `mock/` を `demo/` に改名するか → **推奨：改名しない**

| 観点 | 改名する（`mock/` → `demo/`） | 改名しない |
|---|---|---|
| 公開 URL | **変わらない**（`pages.yml` は `path: mock` で mock/ を*サイトのルート*として上げる。URL に `/mock/` は元々含まれない） | 変わらない |
| 名前と区分の一致 | ①デモ＝`demo/` で一致する（利点） | README の地図で「`mock/` ＝ ①デモ」と 1 行書けば足りる |
| 直す箇所 | `mock/` を含む参照が**リポジトリ全体で 322 か所**（`docs/handoff` 系だけで 250 超、`tools/verify.mjs` 8、`CLAUDE.md` 5、`.claude/**` 4） | 0 |
| load-bearing | §2-8（`path: mock`）・§2-1/2-2/2-3（ファイル位置）・verify §8 を同時に直す必要。**`localStorage` キー `mock.lang`/`mock.theme` は §2-6 で変更禁止**なので、ディレクトリだけ `demo` になり**恒久的にちぐはぐ**になる | 一貫 |
| 過去の資産 | 既存 Issue・PR・レビューコメントの blob リンク（`.../blob/<sha>/mock/catalog.html#L123`）が全部 404。設計書 14 本の行番号参照も読めなくなる | 生きたまま |
| 進行中の作業 | #77 PR-B/PR-C（`mock/**` を全面的に触る）と #82（`mock/catalog.html` 差分あり）に**全面衝突**。両方マージ後でないと不可能 | 影響なし |
| 得られるもの | ディレクトリ名の語感（「モック＝作り物」を顧客に見せない）。ただし**顧客が見るのは公開 URL だけ**でディレクトリ名は見えない | — |

**判断：改名しない。** 得るものが「リポジトリ内の語感」だけで、失うもの（322 か所の参照・過去リンク・`mock.*` キーとの不一致）が大きい。
代わりに **README の地図で①と明示**し、`mock/README.md` の冒頭に「このフォルダが**①デモ**（GitHub Pages 公開物）」の 1 行を足す。
どうしても改名するなら **PR-0 として単独で**（#77 PR-C と #82 のマージ後、他の PR を一切走らせない日に、`git mv` ＋ 全文置換 ＋ `.claude/**` と `CLAUDE.md` は PM が適用）。§10 Q1。

### 1-3. 管理番号 1 つから ①②③④ を全部辿る索引 → **`tools/gen-index.mjs` で生成**

**採用：生成（`docs/service-map.md`）。`docs/handoff/service-index.md` に列は足さない。**

理由：
- `service-index.md` は **architect が書き implementer は変更しない**（`docs/handoff/README.md`）。ファイルの有無で変わる列を手で保守すると、必ず実態とズレる
- 索引の元データは全部リポジトリの中にある（`SVCS` ＋ ファイルの存在）。生成すれば**嘘をつかない**
- 「無いもの」が空欄で見えるので、**カバレッジ表**（43 件中 DSL 2 件・KB 1 件…）としてそのまま使える

```
tools/gen-index.mjs
  入力: tools/lib/load.mjs の data.SVCS / data.CATS / data.SCENARIOS（#77 の共通ローダーに乗る）
        ＋ 実ファイルの存在: docs/dify/usecases/<番号>.md
                              dify/apps/<番号>-*.yml
                              dify/kb/<番号>/
                              dify/tests/<番号>.json
                              mock/js/data/scenarios/<分類>.js 内の <内部id> キー
  出力: docs/service-map.md（先頭に「このファイルは生成物。手で編集しない」＋生成コマンド）
  実行: npm run index          （= node tools/gen-index.mjs）
  検査: npm run index -- --check  → 内容が古ければ差分を出して exit 1
```

`docs/service-map.md` の形（1 行 = 1 サービス、43 行）：

```md
| 管理番号 | サービス | 分類 | 成熟度 | ①デモ台本 | ②DSL | ③ユースケース | ④KB | ④テスト |
|---|---|---|---|---|---|---|---|---|
| KN-01 | 技術ナレッジQA | KN/tech | 提供中 | [kn.js](../mock/js/data/scenarios/kn.js) qa | [KN-01-tech-knowledge-qa.yml](../dify/apps/KN-01-tech-knowledge-qa.yml) | [KN-01.md](./dify/usecases/KN-01.md) | [3 件](../dify/kb/KN-01/) | [4 件](../dify/tests/KN-01.json) |
| KN-02 | 設備マニュアル・取扱説明書の検索 | KN/tech | 提供中 | [kn.js](...) qa | — | [KN-02.md](...) | — | — |
```

末尾に集計行（`①43 / ②2 / ③43 / ④KB 1 / ④テスト 2`）。
`tools/verify.mjs` に **§11 索引の鮮度**を足す：`gen-index` の出力と `docs/service-map.md` が一致しなければ **FAIL**（メッセージに `npm run index` を出す）。ドキュメント追加のたびに 1 コマンド増えるが、索引が嘘をつかないことのほうが重い（§10 Q7 で warn に落とす選択肢も残す）。

### 1-4. トップ `README.md` の地図（PR-1 で追記する文案。この通りに入れる）

`## 収録モック` の**前**に以下を挿入し、既存の「収録モック」以下はそのまま残す。

```md
## このリポジトリの歩き方（4 区分）

| | 区分 | 置き場 | 入口 | 何が入っているか |
|---|---|---|---|---|
| ① | **デモ** | [`mock/`](./mock/) | [`mock/index.html`](./mock/index.html) | 顧客に見せる UI モック（GitHub Pages で公開）。カタログ・詳細・チャット・デモ 5 テンプレート |
| ② | **実装ソース** | [`dify/apps`](./dify/apps/) [`dify/env`](./dify/env/) [`scripts/dify`](./scripts/dify/) [`tools`](./tools/) | [`dify/README.md`](./dify/README.md) | Dify に入れるマスタ DSL、環境ごとの差分、投入・テスト・リリースのスクリプト、モックの検証ハーネス |
| ③ | **ユースケース・シナリオ** | [`docs/dify/usecases`](./docs/dify/usecases/) [`docs/handoff`](./docs/handoff/) [`mock/js/data/scenarios`](./mock/js/data/scenarios/) | [`docs/dify/usecases/README.md`](./docs/dify/usecases/README.md) | 43 サービスの詳細ユースケース、設計書、デモ台本（台本はコードなので `mock/` の下） |
| ④ | **ダミーデータ** | [`data/world`](./data/world/) [`dify/kb`](./dify/kb/) [`dify/tests`](./dify/tests/) | [`data/world/README.md`](./data/world/README.md) | 架空世界のマスタ（会社・人・品番・設備・KPI）、KB 用のダミー文書、テスト入力 |

**管理番号（`KN-02` など）から ①②③④ を横断する索引** → [`docs/service-map.md`](./docs/service-map.md)（生成物。`npm run index` で更新）
**マスタ → 社内・顧客環境へのリリース** → [`dify/env/README.md`](./dify/env/README.md) と [`dify/DEPLOY.md`](./dify/DEPLOY.md)
```

---

## 2. 架空世界マスタ `data/world/`

### 2-1. なぜ要るか

台本（43 サービス）・KB 用ダミー文書・テスト入力・ユースケース文書の 4 か所に、**同じ架空世界の人名・品番・数字**が散らばっている。今は各作者の記憶が正本で、実際に食い違っている（§2-3 の実測）。
顧客に見せる資料としての一貫性は「本物っぽさ」そのものなので、**正本を 1 か所に置き、機械で照合できるようにする**。

**重要な原則：`data/world/` は正本だが、自動反映はしない。** モックのデータ層も KB 文書も、マスタから生成しない（台本は文脈で表現が変わる：目標値・前月値・当月値）。`check-world.mjs` は**報告するだけ**。`regress.baseline.json` の契約は変えない。

### 2-2. ファイルとスキーマ

| ファイル | 形式 | 列／節 | 初版の作り方 |
|---|---|---|---|
| `README.md` | md | 使い方・追加ルール（§2-5）・`check-world` の読み方 | 新規 |
| `company.md` | md | 社名（ja/zh/en）・現地法人名・拠点表（id・ja/zh/en・国・時差）・事業内容・規模・親子関係（日本本社 ⇄ 蘇州工場）・**顧客に見せてよい説明 3 行** | §2-4 の値で新規 |
| `org.csv` | csv | `dept_id,dept_ja,dept_zh,dept_en,site_id,parent_dept_id,note` | `SCENARIOS[].persona.role` の部署名から抽出（生産技術課・製造二課・品質保証課・設備保全課・物流課・購買課・財務課・人事課・管理部・工場長室・営業） |
| `people.csv` | csv | `person_id,name_ja,name_zh,name_en,dept_id,title_ja,title_zh,title_en,site_id,native,note` | `SCENARIOS[].persona`（43 ブロック）＋ `FEED.persona` から抽出。**実測 17 名**（§2-3） |
| `products.csv` | csv | `part_no,name_ja,name_zh,name_en,customer_code,line_id,material,note` | 台本の品番から。`SK-3310-A`(76 回) `SK-2207-B`(41) `SK-3318`(20) `SK-3310-C` `SK-3318-A` `SK-1190` `ASSY-771` `QS-3310` `DO-3200` ほか |
| `equipment.csv` | csv | `equip_id,model,maker_role,line_id,site_id,name_ja,name_zh,name_en,note` | `PX-200`(20 回、金型予熱・アラーム E-47) ほか。ラインは `L1-L3`・工程は `QC-11` `CM-01` 等 |
| `partners.csv` | csv | `code,kind,role_ja,role_zh,role_en,country,note` | **社名は付けない**（PM 決定 PT-8）。`kind` は `customer`/`supplier`/`service`。台本の記号：`K 社`(133) `S 社`(53) `T 社`(43) `W 社`(5) `A 社`(5) `B 社`(3) `U 社`(2) `V 社`(1) `J 社`(1) ＋ パートナー 6 者の役割名（情報ベンダ／人事情報サービス／記事アーカイブ／採用エージェント／購買代行／研修ベンダ） |
| `kpi.csv` | csv | `kpi_id,name_ja,name_zh,name_en,unit,target,current,prev,as_of,source,note` | 不良率 0.42%（目標 0.40／前月 0.38）・稼働率 87.2%（前月 86.5）・生産数 186,400（計画 190,000）・残業 2,140h・無事故 412 日 ほか |
| `calendar.md` | md | 会計年度・締め日（月次報告・週報の曜日）・稼働日／祝日の扱い・**文書番号の体系**（`TR-YYYY-NNN` 技術報告／`NC-YYYY-NNNN` 不具合／`8D-YY-MMDD`／`ECR-YY-NNNN`／`RFQ-YYYY-NNN`／`PO-YYMM-NNN`／`C-YYYY-NNN` 顧客／`C-26NN-X` 匿名個人 ID）・**世界の「今日」**（台本が暗黙に置いている 2025-09 前後） | 台本の実測 28 種の文書番号から |

すべて **UTF-8・BOM なし・ヘッダー行あり・カンマ区切り**。`note` 列に出典（どの管理番号の台本から取ったか）を書く。

### 2-3. 既存資産から抽出した実測（初版の中身。implementer はここから作る）

| 項目 | 実測 | 備考（＝すでにある食い違い） |
|---|---|---|
| ペルソナ（`persona` ブロック） | **43 個**（`SCENARIOS` の全サービス） | — |
| ユニークな (名前, 役職) | **24 通り** | — |
| ユニークな人物（名前ベース） | **17 名**：王 磊／陳 静／李 強／張 小雨／劉 洋／周 敏／孫 麗／呉 婷／趙 偉／馮 建国／銭 芳／胡 娜／田中 浩二／小林 誠／中村 大輔／佐藤 美咲／高橋 亮 | **役職ゆれ 4 名**：王 磊（主任／主任〈教育担当兼務〉／主任〈用語集管理者〉）・周 敏（監査対応担当／顧客仕様担当）・孫 麗（出荷・在庫／輸出入）・呉 婷（工場長室 秘書・通訳／生産管理課 受注担当）・銭 芳（経費担当／買掛担当）。→ `people.csv` は**兼務を列で持つ**（`title_ja` は主務、`note` に兼務）か、**別人にする**かを implementer が §2-5 のルールで判断せず、**初版は「主務＋兼務メモ」で 1 行**にする |
| 拠点 | 全ペルソナが `蘇州工場`（44 回）。文中に `日本本社`(22)／`日本总部`(20)。英語は `Suzhou Plant` のみで **日本本社の英名が存在しない** | `company.md` で `Japan HQ` を定義（§2-4） |
| 社名 | `青岭精工`(zh) 14 回／`青嶺精工`(ja) **2 回のみ**／**英名なし** | ja 表記がほとんど使われていない。`company.md` で 3 言語を定義（§2-4） |
| 取引先記号 | `K 社`133・`K社`**8**（空白ゆれ）・`S 社`53・`T 社`43・`W/A/B/U/V/J 社` | 空白ゆれは check-world が拾う |
| 文書番号 | 28 種。多い順に `NC-2024-0118`(18) `ECR-25-0088`(16) `TR-2024-007`(10) `C-2025-118`(10) `8D-25-0912`(8) `C-2609-A`(8) | 年の桁が 4 桁（`TR-2024-007`）と 2 桁（`ECR-25-0088`）で混在 → `calendar.md` に**両方を正**として明記する（後付けで揃えない） |
| 品番・設備 | 58 種のコード。`SK-3310-A`(76) `SK-2207-B`(41) `PX-200`(20) `SK-3318`(20) ほか | `DC-02` が**会議室コードと管理番号（DC-02 議事録作成）で衝突**。`equipment.csv` の `note` に明記し、check-world は管理番号形式と衝突するコードを warn |
| KPI | 不良率 0.42%（目標 0.40／前月 0.38）・稼働率 87.2%（前月 86.5）・別サービスに「不良率 3.8% → 1.5%」（改善事例。別文脈） | 同じ指標に複数の値 → `kpi.csv` は「基準値」＋`note` に「改善事例は別コンテキスト」 |

### 2-4. `company.md` に置く 3 言語の値（ja / zh / en をここで確定。implementer に翻訳させない）

| 項目 | ja | zh | en |
|---|---|---|---|
| 社名（親会社） | 青嶺精工株式会社 | 青岭精工株式会社 | Seirei Seiko Co., Ltd. |
| 現地法人 | 青嶺精工（蘇州）有限公司 | 青岭精工（苏州）有限公司 | Seirei Seiko (Suzhou) Co., Ltd. |
| 拠点 `suzhou` | 蘇州工場 | 苏州工厂 | Suzhou Plant |
| 拠点 `jp_hq` | 日本本社 | 日本总部 | Japan HQ |
| 事業（1 行） | 自動車向け精密機械部品の製造（切削・プレス・組立） | 汽车用精密机械零部件的制造（切削・冲压・组装） | Precision machined components for the automotive industry (machining, pressing, assembly) |
| 但し書き（全ファイル冒頭） | この会社・人物・数値はすべて架空です。実在の企業・製品とは関係ありません。 | 本公司、人物及数据均为虚构，与实际企业、产品无关。 | This company, its people and all figures are fictional and unrelated to any real organization. |

**既存の `Suzhou Plant`（44 か所）は変えない。** `Japan HQ` と英語社名は**新規に決めた値**（モックに英語表記が存在しなかったため）。モックへの反映は本 Issue ではやらない（`mock/**` を触らない）。必要になったら別 S レーンで。§10 Q6。

### 2-5. 追加時のルール（`data/world/README.md` に書く）

1. **新しい人名・社名・品番・設備・数字を出すときは、まず `data/world/` に足す**。台本・KB 文書・テストはマスタにある値だけを使う
2. 既にある値を**別の文脈で違う数字にしたい**とき（改善事例など）は、`kpi.csv` に行を足して `note` で文脈を書く。台本側に裸の新しい数字を書かない
3. **取引先に社名を付けない**（PM 決定 PT-8）。記号（`K 社`）と役割名だけ。空白は `K 社`（半角スペース）に揃える — 既存の `K社` 8 か所は本 Issue では**直さない**（`mock/**` 不可侵）。check-world が warn として出し続ける
4. 実在の企業名・型番・URL・人名を混ぜない（`implementation-guide.md` §5-3）
5. 個人情報の見本（身分証 18 桁・電話 11 桁）は**架空値**を `people.csv` に持たず、テスト側（`dify/tests`）にだけ置く

### 2-6. `tools/check-world.mjs`（報告ツール）

```
node tools/check-world.mjs            # 報告のみ。常に exit 0
node tools/check-world.mjs --strict   # 1 件でも不一致なら exit 1（食い違いを潰す PR で使う）
npm run world                          # = node tools/check-world.mjs
```

**入力**：`data/world/*.csv|md` ＋ 走査対象 4 系統
- `mock/js/data/**`（#77 PR-B 後。`tools/lib/load.mjs` の `data` と生テキストの両方）
- `dify/kb/**/*.md`
- `dify/tests/*.json`
- `docs/dify/usecases/*.md`

**検査（すべて warn。FAIL にしない）**

| # | 検査 | 出す情報 |
|---|---|---|
| W1 | 人名：走査対象に出る人名が `people.csv` にあるか | 未登録の人名と出現箇所 |
| W2 | 役職ゆれ：同じ人名に複数の役職 | 人名・役職の一覧（初版で 5 名分出る想定） |
| W3 | 拠点：`company.md` の拠点表にない拠点表記 | 表記と箇所 |
| W4 | 社名：`青嶺精工`/`青岭精工`/英名 の表記が `company.md` と一致するか。英名が使われていない | 出現回数（ja 2 / zh 14 / en 0） |
| W5 | 取引先記号：`partners.csv` にない記号、空白ゆれ（`K社` と `K 社`） | 記号・回数 |
| W6 | 文書番号：`calendar.md` の体系に合わない書式／年が世界の期間外 | 番号と箇所 |
| W7 | 品番・設備：`products.csv`/`equipment.csv` にないコード。**管理番号形式（`^[A-Z]{2}-\d{2}$`）と衝突するコード**（`DC-02`） | コードと回数 |
| W8 | KPI：`kpi.csv` の指標名が出ているのに値が基準値・目標・前月のどれとも一致しない | 指標・値・箇所 |
| W9 | カバレッジ：`people.csv` にあるが**どこにも出てこない**人物（掃除の対象） | 人物名 |

**CI には入れない**（`npm test` に足さない）。初版では W2・W4・W5 が必ず出るため、CI を赤くしないこと。`--strict` は「食い違いを潰す PR」の受け入れ条件として使う。§10 Q3。

---

## 3. 環境レイヤー `dify/env/<env>/env.yml`

### 3-1. 何を env に置き、何を置かないか

| 置く | 置かない |
|---|---|
| 構造・キー名・**公開しても困らない既定値**（`cloud-master` の `api.dify.ai`・`gpt-4o-mini` など） | **顧客の実名・実 URL・dataset id・API キー・メール・パスワード** |
| モデルの用途別割り当て（provider / name） | モデルの API キー（`provider` の資格情報は Dify 側の設定） |
| 論理 KB 名 → 環境の KB 名（`id` は任意・既定 `null`） | 顧客環境で採番された id を**直値で**書くこと（`${VAR}` にする） |
| ブランド語彙の置換表（架空世界の語 → 環境の語） | 顧客社名そのもの（`${BRAND_COMPANY_JA}`） |
| フラグ（越境・パートナー・PIPL マスク） | フラグの根拠となる法務判断の文書（`docs/dify/decisions-pending.md` を参照するだけ） |

**`${VAR}` 展開**：`env.yml` の値に `${NAME}` があれば `render.py` がプロセス環境変数で置換する。`--strict` で未定義なら **exit 1**（黙って空文字にしない）。

### 3-2. スキーマ（`schema: 1`）

```yaml
schema: 1
name: <env id>                 # ディレクトリ名と一致（verify で照合）
description: <1 行>
dify:
  base_url:    <Service/Datasets API の基点>   # 例 https://api.dify.ai/v1
  console_url: <画面・Console API の基点>       # 例 https://cloud.dify.ai
  edition:     cloud | selfhost
  dsl_version: '0.6.0'                          # DSL の version フィールドに書く値
models:
  # 用途 4 種。provider は Dify のプラグイン識別子（langgenius/<vendor>/<vendor>）
  chat:      { provider: <str>, name: <str>, mode: chat, completion_params: { temperature: 0.2 } }
  reasoning: { provider: <str>, name: <str>, mode: chat }   # 分類・抽出・判定ノード用
  embedding: { provider: <str>, name: <str> }               # KB 作成時（kb_upload.py が使う）
  rerank:    { provider: <str>, name: <str> }               # 空文字ならリランク無効
  local:     { provider: <str>, name: <str>, mode: chat }   # 任意。越境ゼロ用（DP-03）
  overrides:                                                # 任意。個別ノード指定
    - { app: KN-03, node_title: 'LLM', role: local }
knowledge:
  # 論理 KB 名（管理番号または帯名）→ 環境の KB
  KN-01: { name: '<環境での KB 名>', id: null }              # id が null なら name で解決
brand:
  company:      { ja: <str>, zh: <str>, en: <str> }
  local_entity: { ja: <str>, zh: <str>, en: <str> }
  sites:
    - { id: suzhou, ja: <str>, zh: <str>, en: <str> }
    - { id: jp_hq,  ja: <str>, zh: <str>, en: <str> }
  replace:                       # 架空世界マスタの語 → この環境の語（空なら架空のまま）
    - { from: 青嶺精工, to: <str> }
flags:
  cross_border: allow | deny     # deny なら models.* が国内 provider か release.py が検査
  partner_mode: mock | live      # PT 系アプリの外部 API 呼び出し
  pipl_mask:    on | off         # on なら PIPL マスクノードの存在を検査
variables:
  # Start ノードの入力変数の既定値（変数名 → 値）
  site: <str>
  lang: ja
```

### 3-3. 3 環境の例（PR-2 でこの内容を置く）

**`dify/env/cloud-master/env.yml`（既定。マスタ）**
```yaml
schema: 1
name: cloud-master
description: PM の Dify Cloud。dify/apps/*.yml がそのまま動く基準環境。render は恒等（出力＝マスタとバイト一致）
dify:
  base_url: https://api.dify.ai/v1
  console_url: https://cloud.dify.ai
  edition: cloud
  dsl_version: '0.6.0'
models:
  chat:      { provider: langgenius/openai/openai, name: gpt-4o-mini, mode: chat, completion_params: { temperature: 0.2 } }
  reasoning: { provider: langgenius/openai/openai, name: gpt-4o-mini, mode: chat }
  embedding: { provider: '', name: '' }        # Cloud のワークスペース既定に任せる
  rerank:    { provider: '', name: '' }        # 空＝reranking_enable: false のまま
  overrides: []
knowledge:
  KN-01: { name: 'KN-01 技術ナレッジQA', id: null }
brand:
  company:      { ja: 青嶺精工株式会社, zh: 青岭精工株式会社, en: 'Seirei Seiko Co., Ltd.' }
  local_entity: { ja: 青嶺精工（蘇州）有限公司, zh: 青岭精工（苏州）有限公司, en: 'Seirei Seiko (Suzhou) Co., Ltd.' }
  sites:
    - { id: suzhou, ja: 蘇州工場, zh: 苏州工厂, en: Suzhou Plant }
    - { id: jp_hq,  ja: 日本本社, zh: 日本总部, en: Japan HQ }
  replace: []
flags: { cross_border: allow, partner_mode: mock, pipl_mask: off }
variables: { site: 蘇州工場, lang: ja }
```

**`dify/env/inhouse/env.yml`（社内環境。セルフホスト）**
```yaml
schema: 1
name: inhouse
description: 社内デモ・検証用のセルフホスト Dify。架空世界のまま（顧客ブランドに置換しない）
dify:
  base_url: ${DIFY_BASE_URL}
  console_url: ${DIFY_CONSOLE_URL}
  edition: selfhost
  dsl_version: '0.6.0'
models:
  chat:      { provider: langgenius/openai/openai, name: gpt-4o-mini, mode: chat, completion_params: { temperature: 0.2 } }
  reasoning: { provider: langgenius/openai/openai, name: gpt-4o-mini, mode: chat }
  embedding: { provider: langgenius/openai/openai, name: text-embedding-3-small }
  rerank:    { provider: '', name: '' }
  overrides: []
knowledge:
  KN-01: { name: 'KN-01 技術ナレッジQA', id: ${DIFY_DATASET_ID_KN01} }
brand: <cloud-master と同じ（架空世界のまま）。replace: []>
flags: { cross_border: allow, partner_mode: mock, pipl_mask: off }
variables: { site: 蘇州工場, lang: ja }
```

**`dify/env/customer-a/env.yml`（顧客 A。匿名 id。実名・URL・id・キーは一切書かない）**
```yaml
schema: 1
name: customer-a
description: 顧客 A のセルフホスト Dify（中国拠点）。実名・URL・dataset id・キーは環境変数で渡す
dify:
  base_url: ${DIFY_BASE_URL}
  console_url: ${DIFY_CONSOLE_URL}
  edition: selfhost
  dsl_version: '0.6.0'
models:                                        # DP-01 推奨 (a)：中国側は SiliconFlow 中国版
  chat:      { provider: langgenius/siliconflow/siliconflow, name: Qwen/Qwen3-235B-A22B, mode: chat, completion_params: { temperature: 0.2 } }
  reasoning: { provider: langgenius/siliconflow/siliconflow, name: Qwen/Qwen3-32B, mode: chat }
  embedding: { provider: langgenius/siliconflow/siliconflow, name: BAAI/bge-m3 }
  rerank:    { provider: langgenius/siliconflow/siliconflow, name: BAAI/bge-reranker-v2-m3 }
  local:     { provider: langgenius/ollama/ollama, name: ${LOCAL_MODEL_NAME}, mode: chat }   # DP-03 越境ゼロ帯
  overrides:
    - { app: KN-03, node_title: 'LLM', role: local }     # HR 帯は自前モデル
    - { app: KN-04, node_title: 'LLM', role: local }
knowledge:
  KN-01: { name: ${KB_NAME_KN01}, id: ${DIFY_DATASET_ID_KN01} }
brand:
  company:      { ja: ${BRAND_COMPANY_JA}, zh: ${BRAND_COMPANY_ZH}, en: ${BRAND_COMPANY_EN} }
  local_entity: { ja: ${BRAND_ENTITY_JA},  zh: ${BRAND_ENTITY_ZH},  en: ${BRAND_ENTITY_EN} }
  sites:
    - { id: suzhou, ja: ${BRAND_SITE1_JA}, zh: ${BRAND_SITE1_ZH}, en: ${BRAND_SITE1_EN} }
    - { id: jp_hq,  ja: ${BRAND_SITE2_JA}, zh: ${BRAND_SITE2_ZH}, en: ${BRAND_SITE2_EN} }
  replace:
    - { from: 青嶺精工, to: ${BRAND_COMPANY_JA} }
    - { from: 青岭精工, to: ${BRAND_COMPANY_ZH} }
    - { from: 蘇州工場, to: ${BRAND_SITE1_JA} }
    - { from: 苏州工厂, to: ${BRAND_SITE1_ZH} }
    - { from: 日本本社, to: ${BRAND_SITE2_JA} }
    - { from: 日本总部, to: ${BRAND_SITE2_ZH} }
flags: { cross_border: deny, partner_mode: mock, pipl_mask: on }
variables: { site: ${BRAND_SITE1_JA}, lang: ja }
```

顧客 B が増えたら `dify/env/customer-b/env.yml` を 1 枚足すだけ。**アプリ側（`dify/apps/*.yml`）は増えない。**

### 3-4. `dify/env/README.md`（PR-2 で新設）に書くこと

- 環境を足す手順（ディレクトリを作る → `customer-a/env.yml` をコピー → `name` を変える → `${VAR}` を `scripts/dify/env.example` に足す）
- **書いてよい値／書いてはいけない値**（§3-1 の表をそのまま）
- 環境変数の一覧と `~/.config/dify/<env>.env` の置き方（§5-2）
- モデル用途 4 種の意味（`chat`＝生成／`reasoning`＝分類・抽出・判定／`embedding`＝KB 索引／`rerank`＝再ランク）と、**embedding を変えたら KB の作り直しが要る**こと

---

## 4. `render.py` と `release.py`

### 4-1. 環境差分の在り処（参照 DSL と #82 の実 DSL で特定した実パス）

`dify/apps/KN-01-tech-knowledge-qa.yml`・`DC-01-hq-report-draft.yml`・`docs/dify/templates/03,07` を読んで確定した。

| # | DSL のパス | 何が環境依存か | env の出所 | マスタの既定値 | 実例 |
|---|---|---|---|---|---|
| R1 | `workflow.graph.nodes[].data.model.{provider,name,mode,completion_params}`（`data.type == llm`） | 生成モデル | `models.chat`（`models.overrides` で個別） | `langgenius/openai/openai` / `gpt-4o-mini` | KN-01 L175-180 / DC-01 L161-162 |
| R2 | 同上（`data.type ∈ {question-classifier, parameter-extractor}`） | 分類・抽出モデル | `models.reasoning` | — | `templates/03` |
| R3 | `...data.multiple_retrieval_config.reranking_model.{provider,model}` ＋ 兄弟の `reranking_enable` | リランクモデル | `models.rerank`（空なら `reranking_enable: false`） | `''` / `''` / `false` | KN-01 L134-137 / `templates/03` L689-691 |
| R4 | `...data.single_retrieval_config.model.{provider,name,...}` | 単一検索の判定モデル | `models.reasoning` | — | `templates/03` |
| R5 | `...data.dataset_ids`（`data.type == knowledge-retrieval`） | KB の id | `knowledge.<論理名>.id`（null なら空のまま＋警告） | `[]` | KN-01 L130 |
| R6 | `...data.variables[].{default,options}`（`data.type == start`） | 拠点の選択肢・既定値 | `variables` ＋ `brand.sites` | `default: ''` / `options: [蘇州工場, 日本本社]` | DC-01 L98-138 |
| R7 | `app.name` `app.description` ／ `...data.{title,desc}` ／ `...data.prompt_template[].text` | **社名・拠点の表記**（System プロンプトに「あなたは青嶺精工 蘇州工場の…」と入っている） | `brand.replace` の語彙置換 | 架空世界マスタの語 | KN-01 L182〜 |
| R8 | `workflow.environment_variables` | フラグ・外部エンドポイント | v1 では**注入しない**。`flags` は release.py のガードにだけ使う（§4-4 G1-G3） | `[]` | 両アプリ |
| R9 | `version` | Dify の DSL 版 | `dify.dsl_version` | `0.6.0` | 両アプリ |
| R10 | `dependencies` | プラグイン識別子のハッシュ | **触らない**（空のまま。#82 の規約） | `[]` | 両アプリ |

### 4-2. 置換の方式：(a) プレースホルダ vs (b) 実値＋置換表 → **推奨 (b)**

| | (a) マスタにプレースホルダ `{{MODEL_CHAT}}` | **(b) マスタは Cloud の実値のまま、env で差し替え** |
|---|---|---|
| Cloud への URL インポート | **壊れる**。`provider: {{MODEL_CHAT}}` は存在しないプロバイダーとして扱われ、#82 が確立した「raw URL を貼るだけ」の運用（`dify/README.md`・`DEPLOY.md` §1-①）が使えなくなる | **そのまま動く**。`cloud-master` は render 不要 |
| マスタの検証 | `check.py`・YAML パーサ・エディタの補完が効かない。プレースホルダの typo を Dify に入れるまで気づけない | マスタは常に「実際に動く 1 本」。`check.py` がそのまま使える |
| レビュー | プレースホルダを増やすたびに「これは置換対象か」を人が覚える | **置換対象は DSL のパスで機械的に決まる**（§4-1 の R1〜R7）。`render-report.md` に件数が出る |
| Dify から export し直したものを正にする運用（`implementation-guide.md` §7-1-3） | export にはプレースホルダが戻らない。毎回手で入れ直す | **export → そのまま `dify/apps/` へ上書き**で回る |
| 社名・拠点の置換 | プレースホルダをプロンプト本文に埋める＝日本語の文が読めなくなる | **架空世界マスタの語（`青嶺精工`）がそのままプレースホルダの役割**をする。プロンプトは日本語のまま読める |
| リスク | — | 語彙置換（R7）が**意図しない箇所に当たる**可能性。→ `brand.replace` は完全一致の語のみ・対象フィールドを R7 の 5 種に限定・`render-report.md` に置換箇所を全部出す |

**採用 (b)。** ただし「未解決を空で表す」規約は残す：`dataset_ids: []` と `reranking_model: {provider:'', model:''}` は **空＝未解決のサインタ**とし、`render.py --strict` は env が値を持たない限り**警告**（`dataset_ids` は release 時に FAIL、§4-4）。

### 4-3. `scripts/dify/render.py`（PR-2）

```
python3 scripts/dify/render.py --env <env> [KN-01 DC-01 ... | --all] [--strict] [--out dify/build]
```

| 項目 | 内容 |
|---|---|
| 入力 | `dify/env/<env>/env.yml`（`${VAR}` をプロセス環境変数で展開）＋ `dify/apps/*.yml` |
| 出力 | `dify/build/<env>/<番号>-<slug>.yml` ＋ `dify/build/<env>/render-report.md` |
| 依存 | PyYAML（`check.py` と同じ。無ければ「`pip3 install pyyaml`」を出して exit 2） |
| 恒等性 | **置換の結果がマスタと意味的に同一なら、マスタの生バイトをそのままコピーする**（YAML 再シリアライズによる整形差を出さない）。→ 受け入れ条件 6 |
| 出力の書式 | `yaml.safe_dump(sort_keys=False, allow_unicode=True, default_flow_style=False, width=4096)`。マスタ先頭の `#` コメントブロックは読み取って**先頭に戻し**、その下に生成バナー（env 名・生成時刻・render.py の版）を足す |
| `--strict` | 次のいずれかで exit 1：`${VAR}` 未定義／`models.chat` が空／`knowledge` に無い論理 KB を DSL が要求／`env.yml` の `name` とディレクトリ名の不一致／`schema` が未知 |
| ログ | 置換した DSL パスと前後の値を出す。**`${VAR}` の展開結果は伏せる**（`***` 表示。キー・URL が端末とログに残らないように） |
| `render-report.md` | `| 番号 | ルール | パス | 変更前 | 変更後 |` の表。R7 の語彙置換は「`青嶺精工` × 4 か所 → `***`」の件数のみ |

**論理 KB の決め方**：`knowledge-retrieval` ノードの `data.desc` か `title` からではなく、**アプリの管理番号**を既定の論理名にする（KN-01 のアプリ → 論理 KB `KN-01`）。1 アプリが複数 KB を引く場合は env の `knowledge` に `KN-01/tech`・`KN-01/rule` のように複数書き、**DSL のノード出現順**に割り当てる（順序は `render-report.md` に出す）。

**`models.overrides` の当て方**：`{ app, node_title, role }` の 3 つ組。`node_title` はマスタ DSL の `data.title`（日本語可）。一致するノードが 0 個なら `--strict` で FAIL（**サイレントに無視しない**）。

### 4-4. `scripts/dify/release.py`（PR-3）

```
python3 scripts/dify/release.py --env <env> [--apps KN-01 DC-01 | --all] [--dry-run] [--yes]
```

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │ 0. 前提チェック   env.yml の schema / ${VAR} / git のワーキングツリーが clean │
  │ 1. render        render.py --env <env> --strict  → dify/build/<env>/     │
  │ 2. ガード        G1 cross_border: deny なら models.* の provider が        │
  │                     国内許可リストにあるか（`docs/dify/decisions-pending.md`│
  │                     DP-02 の越境マトリクスを env に持たせるまでは警告）      │
  │                  G2 pipl_mask: on なら PIPL マスクノード（PC-10）の存在      │
  │                  G3 partner_mode: mock なら PT 系アプリの http-request の    │
  │                     ホストが実 API を指していないこと                        │
  │ 3. import        edition: selfhost → console_api.py（login → apps/import）  │
  │                  edition: cloud    → dify/build/<env>/IMPORT.md を生成       │
  │                                      （画面操作の手順＋Chrome に渡す文面）    │
  │ 4. KB            kb_upload.py --env <env>（models.embedding / 論理 KB 名）   │
  │ 5. test          run_tests.py --env <env> <番号...>                         │
  │                  → dify/results/<env>/<番号>-<YYYYMMDD-HHMM>.md            │
  │ 6. 記録          dify/CHANGELOG.md に 1 行追記                              │
  │ 7. tag           git tag release/<env>/<YYYYMMDD>  （--yes が無ければ表示のみ）│
  └────────────────────────────────────────────────────────────────────────┘
```

- **`--dry-run` は 1・2・3(cloud の手順書生成)・6/7 のコマンド表示だけ行い、ネットワークを一切呼ばない**（受け入れ条件 9）
- **Cloud は自動 import しない**：Console API は Cloudflare / Cookie 認証で壊れやすい（Issue #3・`CLAUDE.md` §6）。`cloud` は**手順書 ＋ Chrome 依頼文**を出して止まる。`IMPORT.md` には (i) `dify/build/<env>/` のファイルパス（画面のファイル選択でアップロード）、(ii) `cloud-master` の場合のみ raw URL（マスタ＝ビルド不要）、(iii) インポート後にやること（モデル確認・KB 紐づけ・公開・API キー発行）を出す
- **セルフホストの Console API は `scripts/dify/console_api.py` の 1 ファイルに閉じ込める**。エンドポイント（`POST /console/api/login`・アプリ import）は**版依存で本設計では未確認**。実装時に顧客環境の版で確認し、変更はこのファイルだけで済むようにする
- `dify/CHANGELOG.md` の行書式（固定）：
  ```md
  | 日付 | env | アプリ | tag | テスト | 備考 |
  |---|---|---|---|---|---|
  | 2026-09-20 | customer-a | KN-01 DC-01 | release/customer-a/20260920 | 8/8 | models.chat を Qwen3-235B に変更（env のみ、DSL 無変更） |
  ```

### 4-5. `dify/build/` は gitignore なのに Cloud の URL インポートはどうするか

- **`cloud-master`**：render は恒等なので、**`dify/apps/*.yml` の raw URL をそのまま使う**（#82 の運用そのまま）。build は不要
- **その他の env × cloud**：Dify の「DSL ファイルをインポート」は**ローカルファイルのアップロードにも対応**しているので、`dify/build/<env>/*.yml` をファイル選択で入れる（推奨）
- どうしても URL が要る場合の任意機能：`release.py --publish-branch` で `build/<env>` ブランチに built DSL を force-add して push し、そのブランチの raw URL を `IMPORT.md` に出す。**既定では実行しない**（生成物を main に混ぜない）

### 4-6. Issue #3（Dify Export/Import 自動化）の統合

- **import 方向**（git → Dify）は本設計の `render.py` ＋ `release.py` に統合する。#3 の「自動化」はここで実現される
- **export 方向**（Dify → git、`pull.py`）は**残す**。セルフホストの Console API が確認できてから（v2.1）。Cloud は着手しない
- Issue #3 はクローズせず、本 Issue #84 にリンクして「import 方向は #84 で実装、export 方向のみ残件」とコメントする（PM が実施）

---

## 5. Mac 全自動運用との整合

### 5-1. Chrome がやること／CLI がやること

| 操作 | 誰 | 理由 |
|---|---|---|
| DSL のレンダリング（env 適用） | **CLI**（`render.py`） | 決定的・差分が残る |
| Dify **Cloud** への DSL インポート、モデルの選び直し、KB のノード紐づけ、公開、API キー発行 | **Chrome**（Claude in Chrome） | Console API が Cloudflare / Cookie で壊れやすい。画面が正 |
| Dify **セルフホスト**への DSL インポート | **CLI**（`console_api.py`） | 自社・顧客の内部網。API が安定 |
| KB へのダミー文書投入 | **CLI**（`kb_upload.py`。Datasets API は Service API 系で安定） | — |
| テスト実行と結果の commit | **CLI**（`run_tests.py` → `dify/results/<env>/`） | 証跡が git に残る |
| タグ付け・CHANGELOG 追記 | **CLI**（`release.py`。`--yes` が無ければコマンド表示のみ） | 誤タグ防止 |
| **API キーの入力** | **PM 本人**（`~/.config/dify/<env>.env` に手で書く） | キーはチャットにも端末ログにも出さない（§2-10） |

`dify/DEPLOY.md` は **Mac の手順書**（今のまま §0〜§4 を維持し、**§5「環境を選んでリリースする」を追記**）。`.claude/commands/dify-deploy.md` は **PM が配置**する薄いコマンド定義で、中身は「`dify/DEPLOY.md` §5 に従って `--env <env>` で release.py を回し、失敗したらエラー文をそのまま Issue に貼る。キーは環境変数から読み値を出力しない」。**architect も implementer も `.claude/**` を触らない。**

### 5-2. 環境変数の一覧（`scripts/dify/env.example` に入れる）

環境ごとに 1 ファイル：`~/.config/dify/<env>.env`（**リポジトリの外**）。使うときは
```bash
export DIFY_ENV=customer-a
set -a; source ~/.config/dify/$DIFY_ENV.env; set +a
```

| 変数 | 必須 | 用途 |
|---|---|---|
| `DIFY_ENV` | ○ | 既定 `cloud-master`。`--env` 未指定時の既定になる |
| `DIFY_BASE_URL` | ○ | Service/Datasets API の基点（`env.yml` の `${DIFY_BASE_URL}` にも展開される） |
| `DIFY_CONSOLE_URL` | selfhost | Console API の基点 |
| `DIFY_CONSOLE_EMAIL` / `DIFY_CONSOLE_PASSWORD` | selfhost | Console API ログイン。**cloud では使わない** |
| `DIFY_DATASET_KEY` | KB 投入時 | ナレッジ API キー |
| `DIFY_APP_KEY_<番号ハイフン無し>` | テスト時 | 例 `DIFY_APP_KEY_KN01`（#82 の規則をそのまま） |
| `DIFY_DATASET_ID_<番号ハイフン無し>` | 任意 | `knowledge.*.id` の `${VAR}` 展開用 |
| `KB_NAME_<番号ハイフン無し>` | 顧客環境 | 環境での KB 名が架空名と違う場合 |
| `BRAND_COMPANY_{JA,ZH,EN}` / `BRAND_ENTITY_{JA,ZH,EN}` / `BRAND_SITE1_{JA,ZH,EN}` / `BRAND_SITE2_{JA,ZH,EN}` | 顧客環境 | 実名。**リポジトリに書かない** |
| `LOCAL_MODEL_NAME` | 任意 | 越境ゼロ帯の自前モデル名（DP-03） |

**`.gitignore` の不備を PR-2 で直す**：`CLAUDE.md` §2-10 は「`.gitignore` で `.env*`・`*.key`・`*.pem`・`secrets/` を除外済み」と書いているが、**現在の `.gitignore` には無い**（OS/Editor とログのみ）。#82 の `DEPLOY.md` もこれに気づいて「リポジトリ内に `.env` を作らない」と注意書きで回避している。PR-2 で以下を追加し、注意書きに頼るのをやめる：
```gitignore
# ---- Secrets ----
.env
.env.*
!scripts/dify/env.example
*.key
*.pem
secrets/
# ---- Build ----
dify/build/
```

---

## 6. 移行手順

### 6-1. `git mv` 一覧

**0 件。** `mock/` は改名しない（§1-2）。#82 の `dify/**`・`scripts/dify/**` の配置はそのまま使う。移動は次の 1 件だけ：

| 対象 | 変更 | いつ |
|---|---|---|
| `dify/results/.gitkeep` | → `dify/results/cloud-master/.gitkeep`（結果を env ごとに分ける） | PR-3 |

### 6-2. 参照の更新（本文まで設計書で確定させる）

| # | ファイル | 変更 | PR |
|---|---|---|---|
| 1 | `README.md`（トップ） | §1-4 の「このリポジトリの歩き方（4 区分）」を `## 収録モック` の前に挿入 | PR-1 |
| 2 | `mock/README.md` | 冒頭に「このフォルダが **①デモ**（GitHub Pages 公開物）。区分の全体像はトップ `README.md`」の 1 行 | PR-1 |
| 3 | `docs/dify/README.md` | 「ファイル」表の下に「`usecases/` は**③ユースケース**、実際に Dify へ入れる資材は `dify/`（②）、ダミーデータは `data/world`・`dify/kb`（④）」の 3 行と `docs/service-map.md` へのリンク | PR-1 |
| 4 | **`docs/dify/implementation-guide.md` §7-2** | 現行「export した DSL の置き場＝実装リポジトリ `dsl/<管理番号>/<app-name>.yml`（**本リポジトリには置かない**）」は **#82 と矛盾**している。次に差し替える：<br>「| export した DSL | **本リポジトリ `dify/apps/<管理番号>-<slug>.yml`**（1 サービス 1 ファイル） | `KN-02-manual-qa.yml` |」<br>「| KB id・tool 識別子 | **環境固有。DSL には入れず `dify/env/<env>/env.yml` に持つ**（`dataset_ids` は空のまま commit し、`scripts/dify/render.py` が環境ごとに埋める） | — |」<br>さらに §7-3 の「Export/Import 自動化は v2」に 1 行追記：「**import 方向は `docs/handoff/2026-09-07-repo-layout-v2.md` §4 の `render.py`／`release.py` に統合（Issue #84）。export 方向のみ Issue #3 に残る。**」 | PR-1 |
| 5 | `docs/dify/implementation-guide.md` §5-3 | 「ダミーの作り方」の冒頭に「**架空世界の正本は `data/world/`。新しい名前・数字はまずそこに足す**（`data/world/README.md`）」を 1 行追記。既存の記述（仮社名 青嶺精工・文書番号の体系）は残す | PR-1 |
| 6 | `package.json` | `"index": "node tools/gen-index.mjs"`, `"index:check": "node tools/gen-index.mjs --check"`, `"world": "node tools/check-world.mjs"` を追加。**`test` は変えない**（`world` を CI に入れない） | PR-1 |
| 7 | `tools/verify.mjs` | §11 索引の鮮度（`gen-index --check` 相当）＋ §11-b トップ `README.md` の 4 区分表のリンク先が実在すること | PR-1 |
| 8 | `tools/verify.mjs` | §12 `dify/env/**/env.yml` に秘密・実名が無い（§8 受け入れ条件 8 の判定） | PR-2 |
| 9 | `.gitignore` | §5-2 の Secrets / Build ブロックを追加 | PR-2 |
| 10 | `dify/README.md` | 「規約」に env 章を追加：「環境差分は `dify/env/<env>/env.yml`。DSL には Cloud で動く既定値（`gpt-4o-mini`・`dataset_ids: []`）だけを書く。`render.py --env cloud-master` の出力がマスタとバイト一致すること」 | PR-2 |
| 11 | `scripts/dify/kb_upload.py` | `--env`（既定 `$DIFY_ENV` → `cloud-master`）。KB 名を `knowledge.<論理名>.name` から取り、`models.embedding` が空でなければ dataset 作成時に渡す | PR-2 |
| 12 | `scripts/dify/.env.example` → `scripts/dify/env.example` | env ごとのファイルになるので名前から `.` を外す（`.gitignore` の `.env.*` に巻き込まれないため）。中身は §5-2 の表 | PR-2 |
| 13 | `scripts/dify/run_tests.py` | `--env`。出力先を `dify/results/<env>/` に | PR-3 |
| 14 | `dify/DEPLOY.md` | §5「環境を選んでリリースする」を追記（`DIFY_ENV` → `release.py` → 結果 commit → tag）。§0 の「リポジトリ内に `.env` を作らない」は `.gitignore` 修正後も**残す**（二重の防御） | PR-3 |
| 15 | `CLAUDE.md` | **PM が適用**（§9） | — |
| 16 | `.claude/agents/**`・`.claude/commands/dify-deploy.md` | **PM が適用**。architect も implementer も触らない | — |

`docs/handoff/2026-09-07-claude-design-handoff.md`・`docs/handoff/**` の既存設計書・`docs/dify/usecases/*.md`・`platform-components.md`・`decisions-pending.md` は**本 Issue では触らない**（`mock/` を改名しないので参照が壊れない）。

### 6-3. PR 分割と実施タイミング

| PR | 内容 | 触るファイル | 依存 |
|---|---|---|---|
| **PR-0**（任意・非推奨） | `mock/` → `demo/` 改名 | 全域（322 参照） | #77 PR-C ＋ #82 マージ後。**PM が Q1 で「やる」と決めた場合のみ** |
| **PR-1** 地図と索引・`data/world` | `README.md` `mock/README.md` `docs/dify/README.md` `docs/dify/implementation-guide.md` `docs/service-map.md`(生成) `data/world/**` `tools/gen-index.mjs` `tools/check-world.mjs` `tools/verify.mjs`(§11) `package.json` | **#77 PR-C マージ後**（`tools/lib/load.mjs` と `mock/js/data/scenarios/**` に依存し、`tools/verify.mjs` が衝突する） |
| **PR-2** 環境レイヤー＋render | `dify/env/**` `scripts/dify/render.py` `scripts/dify/kb_upload.py` `scripts/dify/env.example`（`.env.example` を rename） `.gitignore` `dify/README.md` `tools/verify.mjs`(§12) | **#82 マージ後**。PR-1 とは `tools/verify.mjs` だけ重なるので **PR-1 の後**（直列） |
| **PR-3** release＋CHANGELOG | `scripts/dify/release.py` `scripts/dify/console_api.py` `scripts/dify/run_tests.py` `dify/CHANGELOG.md` `dify/DEPLOY.md` `dify/results/cloud-master/.gitkeep` | PR-2 の後（`render.py` を呼ぶ） |

- **並列不可**。3 本とも `tools/verify.mjs` か `scripts/dify/**` で重なる。PR-1 → PR-2 → PR-3 の直列
- **開始条件**：#77 PR-B・PR-C と #82 が **両方 main に入ってから**。それまでこの Issue は着手しない（`mock/js/data/**` と `dify/**` が無い状態では gen-index も render も書けない）
- 1 PR に 1 テーマ。PR-1 は「読む人のための整理」、PR-2 は「配れるようにする」、PR-3 は「配った記録を残す」

---

## 7. 触らない範囲（reviewer の diff 監査の基準）

- **`mock/**` の中身**：データ層（`T`/`TAGS`/`CATS`/`SVCS`/`TEMPLATES`/`SCENARIOS`/`HOME`/`FEED`/`CAT_STYLE`）・CSS・`render*`・`state`・`data-act`・`detectLang`・`localStorage` キー（`mock.lang`/`mock.theme`）。**PR-1 で `mock/README.md` に 1 行足す以外、`mock/` は 1 バイトも変えない**
- **`tools/regress.baseline.json`**：`--update` 禁止。3 PR すべてで `node tools/regress.mjs` の差分 0
- **データ層の件数**：8 分類 / 17 中分類 / 43 サービス / タグ は**変更なし**（本 Issue はデータ層に触らないので `regress` の id 一覧も不変）
- **`dify/apps/*.yml` の中身**：マスタ DSL は PR-2/PR-3 で変えない（環境差は env で吸収する。DSL を直すのは別 Issue）
- **`.github/workflows/pages.yml`**：`path: mock` のまま。`mock/.nojekyll` も残す（§2-8）
- **`.github/workflows/verify.yml`**：`npm run verify` / `npm run regress` のまま（`world` を CI に足さない）
- **`docs/handoff/**` の既存設計書**（本設計書と issue 下書きの追加のみ）・`docs/dify/usecases/*.md`・`platform-components.md`・`decisions-pending.md`・`feasibility-33-services.md`・`docs/dify/templates/*.yml`
- **`.claude/agents/**`・`.claude/commands/**`**・**`CLAUDE.md`**（§9 の案を PM が適用）
- **顧客の実名・URL・dataset id・API キー**：`dify/env/**` にも `data/world/**` にも書かない

---

## 8. 受け入れ条件（機械検証できる形）

**全 PR 共通**：`node tools/verify.mjs` PASS ／ `node tools/regress.mjs` 差分 0（`--update` 禁止）／ CI の `verify` が緑。

**PR-1**
1. `npm run index` を 2 回実行して `docs/service-map.md` に差分が出ない（冪等）。行数 = `SVCS.length` + ヘッダ 2 + 集計 1 = **46 行**
2. `docs/service-map.md` の ②DSL 列は KN-01 / DC-01 の 2 行だけリンクを持ち、残り 41 行は `—`。④KB 列は KN-01 の 1 行のみ。④テスト列は KN-01 / DC-01 の 2 行のみ（#82 の実態と一致）
3. `npm run index -- --check` が最新なら exit 0、`docs/service-map.md` を 1 文字変えると exit 1
4. `node tools/verify.mjs` の §11 が「索引が最新」「README の 4 区分表のリンク先がすべて実在」を PASS
5. `node tools/check-world.mjs` が exit 0 で報告を出し、少なくとも **W2 役職ゆれ 5 名**・**W4 社名（ja 2 / zh 14 / en 0）**・**W5 空白ゆれ `K社` 8 件** を検出する（§2-3 の実測と一致 = ツールが実際に動いている証拠）
6. `data/world/people.csv` の `name_ja` 集合が `SCENARIOS[].persona.name.ja` の **17 名と完全一致**（過不足なし）
7. `node tools/regress.mjs` 差分 0（`mock/` を触っていない証拠）
8. `docs/dify/implementation-guide.md` §7-2 の「本リポジトリには置かない」が消え、`dify/apps/<管理番号>-<slug>.yml` に置き換わっている

**PR-2**

9. `python3 scripts/dify/render.py --env cloud-master --all` の出力 2 本が `dify/apps/*.yml` と **バイト一致**（`cmp` で確認）
10. `python3 scripts/dify/render.py --env customer-a --all --strict` が、環境変数未設定では **exit 1** で未定義の `${VAR}` 名を列挙し（値は出さない）、全部与えると **exit 0** で 2 本＋`render-report.md` を生成する
11. `render-report.md` に R1（model）・R3（rerank）・R6（Start 変数）・R7（語彙置換）の**置換件数**が出る。KN-01 では R1 が 1 件、R5（dataset_ids）が「未解決・警告」になる
12. `models.overrides` に一致しない `node_title` を書くと `--strict` が **exit 1**（サイレント無視しない）
13. `tools/verify.mjs` §12：`dify/env/**/env.yml` に (a) `sk-` で始まる文字列 (b) 32 文字以上の 16 進／base64 らしき文字列 (c) `cloud-master` の既知 2 つ以外の生 `http(s)://` URL が**無い**
14. `.gitignore` に `.env` `.env.*` `*.key` `*.pem` `secrets/` `dify/build/` があり、`git check-ignore dify/build/x.yml` が真を返す
15. `python3 scripts/dify/kb_upload.py --env cloud-master --dry-run KN-01` が KB 名 `KN-01 技術ナレッジQA` を出し、ネットワークを呼ばない

**PR-3**

16. `python3 scripts/dify/release.py --env cloud-master --all --dry-run` が (a) render 実行 (b) `dify/build/cloud-master/IMPORT.md` 生成 (c) 実行予定コマンドの一覧 を出し、**ネットワークを一切呼ばない**（`--dry-run` でソケットを開かないことをコードレビューで確認）
17. `--env customer-a`（`flags.cross_border: deny`）で `models.chat.provider` を海外 provider にすると **G1 ガードが警告を出す**
18. `dify/results/cloud-master/` が作られ、`run_tests.py --env cloud-master --dry-run KN-01` の出力先がそこになる
19. `dify/CHANGELOG.md` が §4-4 の 6 列の表で始まり、`release.py` が 1 行だけ追記する（既存行を書き換えない）
20. `--yes` 無しでは `git tag` を**実行せず**コマンド文字列を表示するだけ

---

## 9. `CLAUDE.md` への影響案（**PM が適用**。architect も implementer も触らない）

| 箇所 | 現行 | 案 |
|---|---|---|
| 冒頭 3 行 | 「**AIエージェントカタログの UI モック**（`mock/`…）と、**Dify 開発ツール群**（`scripts/`、`tools/`）を置くリポジトリ」 | 「**①デモ**＝`mock/`（UI モック、GitHub Pages 公開）／**②実装ソース**＝`dify/`・`scripts/`・`tools/`／**③ユースケース・シナリオ**＝`docs/`・`mock/js/data/scenarios/`／**④ダミーデータ**＝`data/world/`・`dify/kb/`・`dify/tests/` の 4 区分。地図はトップ `README.md`、管理番号からの索引は `docs/service-map.md`」 |
| §2-8 | 「`path: mock` で `mock/` をサイトのルートとして公開」 | **変更なし**（`mock/` は改名しない）。末尾に「**`mock/` ＝ 4 区分の①デモ。改名しない**（`localStorage` の `mock.lang`/`mock.theme` と過去 Issue/PR のリンクが load-bearing）」を追記 |
| §2-10 | 「`.gitignore` で `.env*`・`*.key`・`*.pem`・`secrets/` を除外済み」 | **実態に合わせる**（PR-2 で `.gitignore` を実際に直す）。さらに追記：「**`dify/env/**/env.yml` にも顧客実名・実 URL・dataset id・キーを書かない**。`${VAR}` で環境変数から渡す。設定ファイルは `~/.config/dify/<env>.env`（リポジトリの外）」 |
| **§2-12（新設）** | — | **「環境差分は `dify/env/<env>/env.yml` に閉じる」**<br>・**何を**：モデル（provider/name、用途 `chat`/`reasoning`/`embedding`/`rerank`）・KB id・社名と拠点の表記・Start 変数の既定・フラグ（`cross_border`/`partner_mode`/`pipl_mask`）は env にだけ書く。マスタ DSL（`dify/apps/*.yml`）には**架空世界マスタの語と Cloud で動く既定値**（`langgenius/openai/openai` `gpt-4o-mini`・`dataset_ids: []`）だけを書く<br>・**なぜ**：マスタ 1 本を社内・顧客 A・顧客 B へ配るため。DSL を環境ごとに fork すると差分が追えなくなる。プレースホルダを入れないのは Cloud への URL インポートを壊さないため<br>・**どこで検出**：`scripts/dify/render.py --env cloud-master` の出力がマスタと**バイト一致**／`tools/verify.mjs` §12（env に秘密・実名が無い）／`render.py --strict`（未解決の `${VAR}`・未一致の override） |
| **§2-13（新設・任意）** | — | **「架空データの正本は `data/world/`」**<br>・**何を**：会社・拠点・人・部署・品番・設備・取引先記号・KPI・文書番号体系・カレンダー。台本（`mock/js/data/scenarios/**`）・KB 用文書（`dify/kb/**`）・テスト（`dify/tests/**`）・ユースケース文書はここにある値だけを使う。新しい名前・数字はまずマスタに足す<br>・**なぜ**：4 か所に同じ架空世界が散らばっており、既に食い違っている（社名の英名が無い・`K社`/`K 社`・王 磊の役職 3 通り）<br>・**どこで検出**：`node tools/check-world.mjs`（**warn のみ・CI には入れない**）。食い違いを潰す PR では `--strict` |
| §3 検証コマンド | 3 行 | `npm run index`（索引の再生成）と `npm run world`（世界マスタとの照合。**CI には入れない**）を追記 |
| §5 Git 運用 | 「並列は**ファイル集合が重ならないときだけ**」 | 末尾に「**リリースは `release/<env>/<YYYYMMDD>` タグ**。環境ごとの記録は `dify/CHANGELOG.md`。顧客ごとにブランチを切らない（差分は `dify/env/` で吸収）」 |
| §6 バックログ | 「Dify Export / Import 自動化（git ⇄ Dify 同期）… Issue #3」 | 「**import 方向（git → Dify）は #84 の `render.py`／`release.py` で実装。export 方向（Dify → git）のみ #3 に残る**（セルフホスト後）」＋「**リポジトリ構成 v2（#84）**：4 区分・`data/world`・`dify/env`・リリースモデル。設計書 `docs/handoff/2026-09-07-repo-layout-v2.md`」 |

---

## 10. PM 判断待ち（推奨つき）

| # | 論点 | 選択肢 | architect 推奨 | 影響 |
|---|---|---|---|---|
| **Q1** | `mock/` を `demo/` に改名するか | (a) 改名しない (b) PR-0 で改名 | **(a) 改名しない**（§1-2）。得るものはリポジトリ内の語感だけ、失うものは 322 参照・過去 Issue/PR のリンク・`mock.*` キーとの整合 | (b) なら PR-0 を先頭に足し、`CLAUDE.md` §2-1/2-2/2-3/2-6/2-8 と `.claude/**` を PM が同時に更新 |
| **Q2** | render の方式 | (a) マスタにプレースホルダ (b) マスタは実値、env で置換 | **(b)**（§4-2）。Cloud への URL インポート運用（#82）を壊さない・マスタが常に「動く 1 本」 | (a) なら `dify/README.md` の URL インポート手順と `check.py` を作り直す |
| **Q3** | `data/world` の粒度 | (a) 3 ファイル（company/people/kpi） (b) **8 ファイル**（PM 提示のまま） (c) 8 ファイル＋`check-world` を CI 必須 | **(b)**。初版は**既存資産から抽出した値だけ**を載せ、新規に発明しない。`check-world` は CI に入れない（初版で必ず warn が出るため） | (c) にすると PR-1 の前に台本・KB の食い違いを全部潰す必要があり、`mock/**` を触ることになる（別 Issue） |
| **Q4** | リリースタグの命名 | (a) `release/<env>/<YYYYMMDD>`（同日 2 回目は `-2`） (b) `release/<env>/v<連番>` (c) `<env>-<YYYYMMDD>` | **(a)**。`git tag -l 'release/customer-a/*'` で env ごとに一覧でき、日付で並ぶ | — |
| **Q5** | 顧客環境の Dify 版 | (a) Community 1.15.x（セルフホスト） (b) Enterprise (c) 顧客ごとに違う | **(a)**。SSO・ロール（PC-02）は**本番 UI（PC-16 (b) 自前フロント）側で受ける**前提なので Enterprise は必須でない。Enterprise が要るのは Dify 自体でワークスペース分離・SSO をやる場合 | (b) なら `env.yml` に `workspace` 概念が要る（スキーマ拡張）。DP-32 と連動 |
| **Q6** | 社名・拠点の英語表記（`Seirei Seiko Co., Ltd.` / `Japan HQ`） | (a) 推奨のまま (b) 別案 | **(a)**。モックに英語表記が存在しなかったため新規に決めた。**モックへの反映は本 Issue ではやらない**（`mock/**` 不可侵）。必要なら別 S レーン | 顧客に見せる資料に出るので PM の確認が要る |
| **Q7** | `docs/service-map.md` の鮮度検査の強さ | (a) `verify` で **FAIL** (b) warn (c) 検査しない | **(a) FAIL**。`npm run index` の 1 コマンドで直る。索引が嘘をつくほうが高くつく | (a) だと `docs/dify/usecases/*.md` を足す PR で必ず `npm run index` が要る |
| **Q8** | `CHANGELOG.md` の置き場 | (a) `dify/CHANGELOG.md` (b) トップ `CHANGELOG.md` | **(a)**。リリースの対象は Dify アプリだけで、モック（Pages）は常に main が公開される別軸 | — |
| **Q9** | 顧客ごとにブランチを切るか | (a) 切らない（main 1 本＋`dify/env/`） (b) `customer-a` ブランチ | **(a)**。差分は env に閉じる（§2-12 案）。**顧客のカタログ実名版（`CATS`/`SVCS` の差し替え、§2-9）が要るときだけ**、その時点で別途判断 | (b) にすると 43 サービスの台本更新を毎回マージする作業が発生 |
| **Q10** | `.claude/commands/dify-deploy.md` を置くか | (a) 置く（PM が作成） (b) 置かない（`dify/DEPLOY.md` を直接読ませる） | **(a)**。`--env` の指定漏れと「キーを出力しない」の指示を毎回書かずに済む。**architect / implementer は `.claude/**` を触らないので PM が配置**（中身の文案は §5-1） | — |

---

## 11. 関連

| 文書 | 関係 |
|---|---|
| `docs/handoff/2026-09-07-split-catalog.md`（#77） | `mock/js/data/**` と `tools/lib/load.mjs` を作る。**本設計はその上に乗る**（PR-C マージ後に着手） |
| Issue #82（`feat/dify-apps-first`） | `dify/apps` `dify/kb` `dify/tests` `dify/results` `scripts/dify` `dify/README.md` `dify/DEPLOY.md` を作る。**本設計はこの配置を変えない** |
| Issue #3 | export 方向のみ残件（§4-6） |
| `docs/dify/implementation-guide.md` §7 | DSL の作り方・置き場。§7-2 を PR-1 で改訂（§6-2 #4） |
| `docs/dify/platform-components.md` PC-08 / PC-10 / PC-16 | `env.yml` の `models` は PC-08 のモデル表、`flags` は PC-10 の越境・PIPL、本番 UI は PC-16 |
| `docs/dify/decisions-pending.md` DP-01〜04 | `customer-a` の `models` は DP-01 推奨 (a)、`local` は DP-03、`cross_border: deny` は DP-02 の越境マトリクスの受け皿 |
| `docs/handoff/2026-09-06-pm-decisions.md` §6 PT-8 | 取引先に架空社名を付けない → `partners.csv` は役割名のみ |
| `docs/handoff/service-index.md` | 管理番号の台帳（採番ルール・欠番）。索引 `docs/service-map.md` は**生成物**で役割が違う |
