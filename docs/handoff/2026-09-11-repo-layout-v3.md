# リポジトリ構成 v3 —— NocoBase ポータルの取り込み判断と、リファクタリングの棚卸し

- **版**：**rev2（2026-09-11 夕。PM 決定を反映して確定）** ／ rev1（2026-09-11 昼。推奨と PM 判断待ち 7 件）。**rev2 で変えたのは §0・§0-2（新設）・§1-2・§5-3・§6-5（新設）・§7・§8・§9・§10・§11・§12。rev1 の判断の筋は 1 つも覆っていない**（状態を「推奨」→「決定」、棚卸し項目を「未」→「済（PR 番号）」に書き換え、main の現状に追随させた）
- Issue: （未採番。Issue 本文は `docs/handoff/repo-layout-v3.issue.md`）
- 種別: **M/L**（architect 成果物。本 PR は**設計書のみ**。`mock/**`・`tools/**`・`scripts/**`・`dify/**`・`data/world/**`・`CLAUDE.md` を 1 バイトも変えない）
- ラベル: `run:cloud`
- 前提設計書：
  - `docs/handoff/2026-09-07-repo-layout-v2.md`（#84。4 区分・`data/world/`・`dify/env/`・リリースモデル）
  - `docs/handoff/2026-09-10-portal-nocobase.md`（#242。**分離**の判断・`check-nodata.mjs`・`${VAR}` の型。2026-09-11 に rev2 で改訂中）
  - `docs/handoff/2026-09-11-nocobase-research.md`（NocoBase 公式調査。エディション別機能）
  - `docs/handoff/2026-09-11-it-industry.md`（業種「IT 業」追加。`tools/**` の業種ハードコードを発見）
  - `docs/handoff/2026-09-11-portal-mock-pages.md`（`mock/portal.html`）
- **本書はこれらを 1 文字も書き換えない。** 他の architect が並行しているため、申し送りは §11 にまとめた

---

## 0. 決定（PM 2026-09-11）と、その代償（5 行）

**rev2：以下は「推奨」ではなく PM の決定である。§10 の判断待ち 7 件はすべて推奨どおりで確定した。**

1. **1 リポに取り込む（決定）。** `shoulang0729/dify` の直下に `portal/` を作り、`shoulang0729/portal` の中身をそこへ移す。
2. **2 リポに戻す分岐条件 X-2（GitLab 移行が半年以内に確実か）は「確実ではない」と PM が判断した**（2026-09-11）。X-1 は §3 の設計で満たせる。したがって**戻す条件はどちらも成立しない**（§1-2）。
3. 分けた決定的理由 **R1（ランタイム境界）は「同じリポジトリ」ではなく「同じ `npm test` / 同じ `package.json`」の問題**であり、`portal/` を独立 npm プロジェクト＋独立ワークフローにすれば境界は引ける（§3）。
4. 得るもの：**`data/world/`（mfg / fin / it の 3 世界）・81 サービスのカタログ・管理番号→アプリ id の 3 本の手コピーが「生成物＋鮮度検査」に変わる**。`CLAUDE.md`・CI・Issue 番号の二重管理が消える（§1）。
5. **代償は 1 つだけ：GitLab へ出す日に `git subtree split --prefix=portal` を 1 回打つ必要がある。** 恒常コスト（毎週の手コピー）を一回コスト（切り出し 1 回）に替える取引である（§4）。その代償を確実に払えるよう、**切り出し可能性の制約 S-1〜S-7 を初日から効かせる**（§4-2）。これを守らないと 1 リポは罠になる。

---

## 0-1. 触らない範囲（reviewer の diff 監査の基準）

本 PR（rev1 の新規追加 ＋ rev2 の追補）で変更するのは次の 2 ファイルだけ。

- `docs/handoff/2026-09-11-repo-layout-v3.md`（本書）
- `docs/handoff/repo-layout-v3.issue.md`（Issue 本文）

触らない：

| 対象 | 判断 |
|---|---|
| `mock/**` | **1 バイトも変えない。** データ層（`CATS`/`SVCS`/`TAGS`/`SCENARIOS`/`HOME`/`FEED`/`LIVE`/`PSCREENS`）不変 → **`tools/regress.mjs` は差分ゼロ。`--update` 不要** |
| `tools/**`・`tools/regress.baseline.json`・`scripts/**` | 変えない（§8 は**提案**であって本 PR の実装ではない） |
| `dify/**`・`data/world/**` | 変えない |
| `.github/workflows/**` | 変えない（特に `pages.yml` の `path: mock`。`CLAUDE.md` §2-8） |
| `CLAUDE.md`・`README.md`・`.claude/**` | **変えない。** §6 は提案。適用は PM 承認後の別 PR |
| `docs/handoff/2026-09-10-portal-nocobase.md`／`2026-09-11-nocobase-research.md`／`2026-09-11-it-industry.md`／`2026-09-11-portal-mock-pages.md`／`2026-09-11-sysops-usecase.md`／`2026-09-11-bp-usecases.md`（すべて main にマージ済み） | **他の architect の担当。読むだけ・1 バイトも変えない。申し送りは §11** |

---

## 0-2. rev2 で main の現状に合わせた箇所（reviewer はここを照合する）

rev1 は 2026-09-11 の昼に書かれ、その後 main に **IT 業（#255〜#264）・ポータルモック PR-1〜4（#252/#260/#267/#271）・システム運用（#266/#268/#269/#271〜#274）・件数訂正（#265/#275）** が入った。**rev1 が前提にしていた数字と節番号が動いている。**

| # | rev1 の記述 | **main の現状（2026-09-11 夕、`4a4f3d1`）** | 反映先 |
|---|---|---|---|
| **D-1** | 13 分類 29 中分類 67 サービス（製造 49／金融 29／両業種 11） | **15 分類 35 中分類 81 サービス**（製造 49／金融 29／**IT 25**／複数業種 11、**提供中 12／試行版 29／構想 40**）。`TAGS` 66 件 | §0・§8-3・§9・§12 |
| **D-2** | `data/world/` は mfg / fin の 2 世界 | **mfg / fin / it の 3 世界**（人物 20 / 17 / 5 ＝ 42 名）。**IT 世界だけ社名・拠点名の跨ぎを例外として許す**（`data/world/README.md` 17 行・`data/world/it/company.md`） | §6-5・§8-1 |
| **D-3** | `tools/verify.mjs` の実装済み最大は §16、**§17 を新設**する（R-P5） | **§17 は「部門ポータル（`mock/portal.html`）契約」が使用済み**（#252〜#271）。**本書の新節は §18 になる**。§13 は依然として永久欠番 | §5-3・§8-1 |
| **D-4** | `tools/verify.mjs` 1219 行 | **1506 行**（§17 が入った分）。L-3 の判断（分割しない）は変わらない | §8-1・§8-4 |
| **D-5** | CI は 11 ステップ | **13 ステップ**。`verify.yml:60` の**管理番号 12 個のベタ書きは健在** | §8-1 R-P2 |
| **D-6** | `npm run world` の warn は 11 件 | **12 件**（mfg 10／fin 1／it 1）。`data/world/README.md` の「未統一」表は既に 12 行で一致している | §8-1 R-I3・§12 |
| **D-7** | `node tools/verify.mjs` の warn は 16 件 | **17 件** | §12 |
| **D-8** | （記述なし） | **`mock/portal.html` は 16 画面**（`PSCREENS`。#272 で `sys` が増えた）。`SVCS[].place` は 81 件すべてに付き、画面に置くのは 63 件・`out` が 18 件 | §8-1 R-I5（新設） |

**rev1 の判断（1 リポ・5 区分・§2-14・切り出し制約 S-1〜S-7・`seed/` を生成物にする）は、いずれもこの差分で揺らがない。** 動いたのは「数字」と「節番号」と「棚卸し項目の消化状況」だけである。

---

## 1. 1 リポ / 2 リポの比較（観点ごと。正直に）

**前提の更新（PM から 2026-09-11 に受領。これが比較の重みを変えている）：**

| # | 変わったこと | 比較への効き方 |
|---|---|---|
| **U-1** | **NocoBase は Community（無料）版。Professional は買わない** | `2026-09-10-portal-nocobase.md` rev2 §4-11 の「デモも本番も Professional ＋ 方式 (b)」が**成り立たない**。Migration Manager（Professional+）も External PostgreSQL データソース（Standard+）も Auth: LDAP（Professional+）も使えない → **方式 (a)（メイン DB 内で取り込み）＋ 定義移送は自前**。「顧客向けアプリ開発・販売可」の条件も外れる |
| **U-2** | **部門内の意識合わせに閉じて使う** | 「顧客提示デモの器」ではなくなった。**R2（変更速度と参加者が違う）が消える**。参加者は PM ＋ 3 エージェントのまま |
| **U-3** | **顧客に見せる概念モックは `mock/portal.html`（dify リポ確定）** | 顧客提示の面は dify 側に残る。portal は「実験・意識合わせ」に降格 |
| **U-4** | **本番は GitLab Self-Managed へ移行する前提** | 1 リポの唯一の代償。§4 で扱う |

**U-1 と U-2 で、2 リポを支えていた 4 本の理由のうち R2 が消え、R1 と R3・R4 は「リポジトリを分ける理由」から「ディレクトリと CI を分ける理由」に降りた。** これが推奨が反転した根拠である。

### 1-1. 観点ごとの比較表

| # | 観点 | **1 リポ（`dify/portal/`）** | **2 リポ（`shoulang0729/portal`）** | 判定 |
|---|---|---|---|---|
| **A** | **GitLab 移行** | GitLab へ出す日に **`git subtree split --prefix=portal` を 1 回**打つ。その後 `portal/` は dify 側で凍結し、GitLab が正本になる（GitHub 側にミラーを戻すかは §4-3）。**切り出し可能性を §4-2 の S-1〜S-7 で担保する** | portal リポをそのまま GitLab へ push mirror すればよい。**1 コマンドで済む** | **2 リポが有利。** ただし差は「1 回のイベント」でしかない |
| **B** | **実データを入れない保証** | `check-nodata.mjs` を **`portal/**` に限定**してかける。allowlist は `data/world/` から**直接**生成できる（`seed/world/` への手コピーが要らない＝**allowlist が古びない**） | allowlist を `seed/world/` から生成する。`seed/world/` は dify からの手コピーなので、**コピーが古いと allowlist も古く、検査が甘くなる**（誤検知が減る方向ではなく、**知らない実名を見逃す方向**にずれる） | **1 リポが有利。**検査の土台が正本に直結する |
| **C** | **CI** | ルート `verify.yml` は無傷（`npm test` の意味は変えない）。**`portal-verify.yml` を新設し `paths: portal/**` で起動**。中身はシェル 1 行（`npm --prefix portal test`） | 2 つのリポで 2 つの CI。ワークフロー YAML・`.nvmrc`・`package.json` が二重 | **1 リポがやや有利**（二重管理が消える）。ただし **required check の扱いに注意**（§5-2） |
| **D** | **公開範囲** | 両方 public。`pages.yml` の `path: mock` は allowlist なので **`portal/` は Pages に出ない**。秘密と実 URL は `${VAR}`（§2-10 の作法をそのまま適用） | 同じ | **差が無い。** リポジトリを分けても public である以上、防壁は `check-nodata` 1 本という点は同じ |
| **E** | **`CLAUDE.md` の区分** | **⑤ポータルとして区分を 1 つ増やす**（§6）。load-bearing に **§2-14 を 1 項**足す | portal リポに別の `CLAUDE.md`。現状 **dify 側 §1/§4/§5/§2-10/§2-11/§2-12/§2-13 の抜粋を書き写している**（9.5 KB）。dify 側を直すたびに追随が要る | **1 リポが有利。**「抜粋の追随」は必ず腐る |
| **F** | **`data/world/` の共有** | **コピーが「生成物＋鮮度検査」になる。** `portal/seed/**` は `data/world/**` から生成してコミットし、`portal/tools/check-seed-fresh.mjs` が再生成してバイト一致を見る（`render.py --check` と `npm run index` と同じ型）。**ずれたら CI が落ちる** | 手コピー ＋ `# source: … @ <sha>` の出典行。**ずれても誰も気づかない**（`portal-nocobase.md` §6-2 自身が「痛くなったら `export:world` を作る」と先送りしている） | **1 リポが明確に有利** |
| **G** | **ほかに二重になるもの** | 無し | ① **81 サービス**のカタログ（JSON 1 本の手コピー）② 管理番号 → Dify アプリ id（`dify/env/*/env.yml` の `apps:` の手コピー）③ `.gitignore`・`package.json`・`.nvmrc` ④ 3 エージェント分業と Git 運用の文面 ⑤ **Issue / PR 番号が 2 系統**（`portal-nocobase.md` rev2 §7-7-3 G-6 が既に「出自を明記せよ」と回避策を書いている＝痛みが出ている証拠） | **1 リポが有利** |
| **H** | **R1 ランタイム境界は守れるか** | 守れる。**境界はリポジトリではなくディレクトリ＋`package.json`＋ワークフロー**（§3）。ルートの `package.json` は `dependencies` ゼロのまま、ルート `npm test` は `portal/` を見ない | 自明に守れる | **1 リポでも守れる。** これが本書の中心の主張（§3） |
| **I** | **リポジトリの重さ** | NocoBase 本体は入らない（Docker イメージ）。入るのは DDL・定義エクスポート・docker-compose・seed・（将来）TypeScript プラグイン。**プラグインを書き始めると lockfile が入る**（数百 KB〜数 MB）。clone とエージェントの探索範囲が広がる | 影響なし | **2 リポがやや有利。** ただし `portal/` を 1 ディレクトリに閉じれば探索は絞れる |
| **J** | **`CLAUDE.md` の肥大** | 既に長い `CLAUDE.md` に §2-14 が 1 項増える。ポータル固有の詳細は `portal/CLAUDE.md` に置き、ルートは 1 項だけ | ルートは増えない | **2 リポがやや有利。**§6 の設計（ルートは 1 項・詳細は `portal/CLAUDE.md`）で差を最小化する |

### 1-2. 結論

**1 リポを推奨する。**

決め手は **F と G**：2 リポの代償は **3 本の手コピー ＋ 文書の二重管理 ＋ 番号の 2 系統**で、これは**作業するたびに毎回かかる恒常コスト**である。一方 1 リポの代償は **GitLab 切り出し 1 回**で、しかも `git subtree split` という枯れた手段がある。

**恒常コストを一回コストに替える取引として成立する。**

**ただし、次の 2 つが満たされないなら 2 リポのままにすべきである（PM が判断するときの分岐点）：**

- **X-1**：`portal/` を **独立 npm プロジェクト**にできない（ルート `package.json` に `dependencies` を足さざるを得ない）ならば、`CLAUDE.md` §2-3・§2-8 の「ビルド不要・`file://` で開ける」が壊れる → **2 リポに戻す**
- **X-2**：GitLab 移行が **半年以内に確実**であるならば、恒常コストを払う期間が短いので 1 リポの利得が出ない → **2 リポのまま**

**X-1 は §3 の設計で満たせる（`portal/package.json` を別に置くだけ）。**

**【決定（PM 2026-09-11）】X-2 について PM は「GitLab 移行は半年以内に確実ではない」と判断した。したがって X-1・X-2 のどちらも成立せず、1 リポ案を採用する。**以降、本書は 1 リポを前提に書く（2 リポの記述は判断の根拠として残すが、実装対象ではない）。

### 1-3. 「分けた理由」の現在の状態（`portal-nocobase.md` §1 への申し送り）

| 理由 | 初版（2026-09-10） | 2026-09-11 時点 |
|---|---|---|
| **R1 ランタイム境界** | 決定的 | **生きている。ただしリポジトリではなくディレクトリ境界で守れる**（§3） |
| **R2 変更速度と参加者** | 補強 | **消えた。** U-2 により参加者が同じ（部門内・PM ＋ 3 エージェント） |
| **R3 `path: mock` の 1 行の負荷** | 補強 | **弱い。** `path:` は allowlist であって denylist ではないので、`portal/` が同居しても Pages に出るものは変わらない |
| **R4 検査の対象が違う** | 補強 | **生きている。ただしワークフローを分ければ解決**（§5）。「自分に関係ない検査が並ぶ」は `portal-verify.yml` を分けることで起きない |
| **（public に実データ）** | §1-2b で取り下げ済み | 取り下げのまま。1 リポでも 2 リポでも public なので差が無い |

---

## 2. 1 リポ案のディレクトリ構成

### 2-1. ツリー

```
dify/                                （リポジトリ = shoulang0729/dify）
├── CLAUDE.md                        ルールの正本。⑤ポータルの行を 1 つ、§2-14 を 1 項足す（§6）
├── README.md                        地図。「5 区分」に変わる（§6-2）
├── package.json                     ★ 変更しない。dependencies ゼロ・test = verify + regress
├── .nvmrc                           22
├── mock/                            ①デモ（Pages のルート。portal.html を含む）
├── dify/ scripts/ tools/            ②実装ソース
├── docs/                            ③ユースケース・シナリオ・設計書（portal の設計書もここ）
├── data/world/                      ④ダミーデータ（正本。**mfg / fin / it の 3 世界**。`dept` は新設せず it を流用＝§10-1 N-c）
└── portal/                          ⑤ポータル（NocoBase）★ 新設。ここだけが「動くもの」
    ├── CLAUDE.md                    切り出したときそのままルートの CLAUDE.md になる形で書く
    ├── README.md                    何が入り、何が入らないか（実データは 1 バイトも入らない）
    ├── package.json                 ★ 独立。ルートの package.json を参照しない
    ├── .env.example                 変数名だけ。値は 1 つも書かない
    ├── schema/                      素の PostgreSQL。NocoBase をやめても残る層
    │   ├── V001__init.sql           Flyway 形式の DDL
    │   └── README.md                方式 (a) の歯止め（§2-3）をここに明記
    ├── nocobase/                    NocoBase 固有の層
    │   ├── export/                  定義エクスポート（画面・コレクション・ロール・WF）
    │   ├── docker/                  docker-compose.yml ＋ .env の型
    │   └── plugins/                 自作プラグイン（TypeScript。当面は空）
    ├── seed/                        ★ 生成物。手で編集しない
    │   ├── world/                   data/world/** から生成（出典行つき）
    │   ├── catalog.json             mock/js/data/catalog.js から生成（67 サービス・管理番号）
    │   └── apps.json                dify/env/<env>/env.yml の apps: から生成（管理番号 → app id）
    ├── env/                         環境レイヤー（dify/env/ と同じ作法）
    │   ├── README.md                環境台帳（dify/env/README.md と同じ形）
    │   ├── demo/portal.yml          架空世界の値は直値で書いてよい
    │   └── prod/portal.yml          ${VAR} だけ。実値は 1 つも書かない
    ├── scripts/                     apply.sh / migrate.sh / gen-seed.mjs
    ├── tools/                       check-nodata.mjs / check-seed-fresh.mjs / nodata.baseline.json
    └── docs/                        portal に閉じた記録（nodata-known.md など）
```

### 2-2. `schema/` を `nocobase/` の外に出す理由

`2026-09-10-portal-nocobase.md` rev2 §4-11-2 が「**NocoBase 固有の部分と素の PostgreSQL の部分が Git 上で目で分かれる**」ことを原則 11（将来 NocoBase から移行可能）の実装だと書いている。**その線をディレクトリで引く。**

- `portal/schema/**` ＝ 誰でも読めるプレーンな SQL。**NocoBase をやめても残る**
- `portal/nocobase/**` ＝ NocoBase をやめたら捨てる

PM の叩き台にあった `nocobase/`（設定エクスポート・プラグイン・docker-compose）はこの 3 つを 1 ディレクトリにまとめたもので、意図は同じ。**`schema/` を混ぜないことだけが本書の追加。**

### 2-3. Community（方式 (a)）の歯止めをどこに書くか

U-1 により、外部データソース（方式 (b)）が使えず**方式 (a)（NocoBase のメイン DB 内で業務テーブルを取り込む）**になる。`portal-nocobase.md` rev2 §4-11-3 が挙げた方式 (a) の弱点のうち **「初回に決めて以後変更できない設定」** が本当に効いてくる。

**`portal/schema/README.md` の先頭に、初日に固定する 3 つを書く**（値は rev2 §3-5 C2 の通り）：

| 設定 | 固定値 | 理由 |
|---|---|---|
| `DB_UNDERSCORED` | `true` | 後から変えると全テーブル作り直し |
| `DB_TABLE_PREFIX` | `nb_` | NocoBase のシステムテーブルと業務テーブルを名前で分離する。方式 (a) では同じ DB に同居するため、**これが唯一の見分け** |
| 主キー型 | **明示する**（既定に任せない） | 移行時に型が変わると FK が全部壊れる |

**この 3 つは `portal/env/**` ではなく `portal/schema/README.md` と `portal/nocobase/docker/.env.example` の両方に書く**（環境差分ではなく「両環境で一致必須」だから。rev2 §3-5 C2）。

### 2-4. `dify/env/` の型（§2-12）を `portal/env/` に適用できるか

**できる。** ただし 1 点だけ Dify と違うので明記する（rev2 §7-6-3 と同じ内容）：

- `CLAUDE.md` §2-12 の「マスタ DSL にプレースホルダを入れない」は **Dify Cloud への URL インポートを壊さないための制約**であって一般則ではない
- ポータルには URL インポートが無いので、**`portal/nocobase/export/**` と `portal/env/prod/portal.yml` に `${VAR}` を書いてよい**
- 適用するのは 3 つ：①マスタ 1 本 ＋ 環境差分 1 枚 ②秘密は `${VAR}` でリポジトリの外（`~/.config/portal/<env>.env`）③**環境台帳 `portal/env/README.md` を env 定義と同じ PR で必ず更新する**

### 2-5. `portal/seed/` を「生成物」にする（1 リポの核心）

**2 リポで最も腐りやすかった手コピーを、`docs/service-map.md` と同じ型に置き換える。**

| | 2 リポ（現行設計） | **1 リポ（本書）** |
|---|---|---|
| 作り方 | 人が `data/world/**` を `seed/world/` へコピーし、`# source: … @ <sha>` を書き足す | `node portal/scripts/gen-seed.mjs` が `data/world/**`・`mock/js/data/catalog.js`・`dify/env/<env>/env.yml` を読んで `portal/seed/**` を**生成してコミット** |
| 鮮度の担保 | 無し（人が覚えている） | **`node portal/tools/check-seed-fresh.mjs` が再生成してバイト一致を見る。ずれたら FAIL** |
| 正本の方向 | 規約（`portal/CLAUDE.md` に「逆流禁止」と書く） | **機械。`portal/seed/**` を手で直すと次の CI で必ず落ちる** |

**生成物であることを `portal/seed/README.md` の 1 行目に書く**（`docs/service-map.md` と同じ作法）。

**切り出し可能性との関係（重要）**：`gen-seed.mjs` はリポジトリ外（`../data/world/`）を読むが、**生成物 `portal/seed/**` はコミットされている**ので、`portal/` を切り出した後も `portal/` 単体で動く。切り出した時点で `check-seed-fresh.mjs` は「正本が無い」として **skip**（FAIL ではない）に落ちる設計にする（§4-2 S-1）。

---

## 3. R1（ランタイム境界）を 1 リポで守る —— 3 つの分離

`portal-nocobase.md` §1-1 が挙げた 3 つの懸念に、1 つずつ対応を書く。

| 懸念（§1-1 の原文） | 対応 | 検証 |
|---|---|---|
| **「`npm test` の意味が変わる。DB を要するテストが同居する」** | **ルート `package.json` の `test` を変えない。** `portal/` は独立 npm プロジェクトで、`portal/package.json` の `test` を持つ。ルートからは `npm run portal:test`（= `npm --prefix portal test`）という**別のスクリプト**で呼ぶ。**ルート `npm test` は `portal/` を 1 バイトも見ない** | verify に節を 1 つ足す（§5-3） |
| **「`dependencies` ゼロという現リポの性質が失われる」** | **ルート `package.json` の `dependencies` はゼロのまま。** NocoBase・Flyway・プラグインの依存は `portal/package.json` にだけ入る。`.gitignore` に `portal/node_modules/` を足す | verify §5-3 で「ルート `package.json` に `dependencies` が無い」を検査 |
| **「CI 時間が桁で変わる」** | **ワークフローを分ける。** `verify.yml` は無傷（`portal/**` のために遅くならない）。`portal-verify.yml` は `paths: portal/**` でしか起動しない | §5 |

**つまり R1 は「リポジトリ」ではなく「`package.json` とワークフロー」の境界だった。** ディレクトリで引き直せる。

**ただし 1 点だけ、1 リポで本当に失われるものがある**：`CLAUDE.md` §3 の **「1 つでも FAIL ならマージしない」の対象が 2 系統になる**。ルート `npm test` が緑でも `portal/` が赤いことがありうる。→ §5-2 と §6-3 で扱う。

---

## 4. GitLab 移行をどう扱うか（1 リポの唯一の代償）

### 4-1. 方針 —— 「切り出す日」を 1 回のイベントとして設計する

| フェーズ | `portal/` の正本 | 手段 |
|---|---|---|
| **フェーズ 1（いま〜本番投入前）** | **`shoulang0729/dify` の `portal/`** | — |
| **フェーズ 2（本番に実データを入れる日）** | **GitLab Self-Managed の `portal` リポジトリ** | `git subtree split --prefix=portal -b portal-only` → GitLab へ push。以後 dify 側の `portal/` は**凍結**（`portal/README.md` に「正本は GitLab へ移った」と 1 行） |

**`git subtree split` は `portal/**` に触れたコミットだけを抜き出して独立した履歴を作る標準コマンドである。** 追加のツールも外部サービスも要らない。

### 4-2. 切り出し可能性の制約（S-1〜S-7）—— 初日から効かせる

**これを守らないと 1 リポは罠になる。** 守れば切り出しは 30 分で終わる。

| # | 制約 | なぜ | 検査 |
|---|---|---|---|
| **S-1** | **`portal/**` の実行時コードはリポジトリ外（`../`）を読まない。** 例外は `portal/scripts/gen-seed.mjs` と `portal/tools/check-seed-fresh.mjs` の 2 本だけで、この 2 本は**正本が見つからないとき FAIL ではなく skip** する | 切り出した後も `portal/` 単体で `npm test` が緑になること | `portal/tools/check-nodata.mjs` に「`portal/**` の `.mjs`/`.sh`/`.yml` に `../`（`portal/` の外へ出る相対パス）が現れるのは allowlist の 2 ファイルだけ」を足す |
| **S-2** | **`portal/package.json` は独立。** ルートの `package.json`・`.nvmrc` に依存しない（Node のバージョンは `portal/.nvmrc` に自分で持つ） | 切り出した先にルートの `package.json` は無い | `portal/tools/check-nodata.mjs` |
| **S-3** | **CI の中身はシェル 1 行（`npm --prefix portal test`）。** 判定・分岐・生成はすべて `portal/tools/*.mjs`・`portal/scripts/*.sh` に置く | `.gitlab-ci.yml` への移行が YAML 1 枚の書き換えで済む（rev2 §7-7-3 G-1） | reviewer の diff 監査 |
| **S-4** | **`portal/**` の文書から dify 側を参照するときは、相対パスではなく `shoulang0729/dify` の `<パス>` と書く** | 切り出した先で相対パスは切れる。リポジトリ名つきなら「別リポを見よ」と読める | reviewer |
| **S-5** | **`portal/CLAUDE.md` は「切り出したときそのままルートの CLAUDE.md になる」形で書く** | 切り出し作業に「文書の書き直し」を含めない | reviewer |
| **S-6** | **GitHub 固有機能を `portal/` の設計の前提にしない。** 使ってよいのは `actions/checkout` と `actions/setup-node` だけ。Environments / Required reviewers / OIDC / `GITHUB_TOKEN` 前提の自動 PR / Pages を使わない | rev2 §7-7-3 G-2 と同じ | reviewer |
| **S-7** | **切り出し手順を `portal/docs/split.md` にコマンドで書き、取り込み PR の時点で 1 回 dry-run して結果を記録する** | 「いざ移そうとしたら動かない」を初日に潰す。**移行が半年後でも、手順が動くことは今日確認できる** | 取り込み PR の受け入れ条件（§9 PR-N2） |

### 4-3. 切り出した後の GitHub 側

rev2 §7-7-2 が「**実データが 1 バイトも入らないなら、GitLab（正本）→ GitHub（public ミラー）の全量ミラーが安全に成立する**」と書いている。**この性質は 1 リポでも変わらない。**

ただし 1 リポでは**ミラー先が dify リポの `portal/` にはならない**（履歴が別物になるため）。ミラーが要るなら**そのとき改めて `shoulang0729/portal` を作り直してミラー先にする**。`shoulang0729/portal` を削除せず archive にしておく理由でもある（§7）。

**PM 判断が要るのはここ**：切り出した後 GitHub に public ミラーを戻すかどうか。**推奨は「戻さない」**（U-2 により顧客提示は `mock/portal.html` が担うので、ポータル実装を public に見せ続ける動機が無い）。→ §10 判断 6。

---

## 5. CI の設計

### 5-1. ワークフローを 2 枚にする

| ワークフロー | 起動条件 | 中身 | 変更 |
|---|---|---|---|
| `verify.yml`（既存） | `pull_request` / `push: main`（**`paths` フィルタを足さない**） | 現状のまま（**13 ステップ**。PR-R4 が `npm run ci` に寄せるが本数は変えない） | **PR-R4 のみ** |
| **`portal-verify.yml`（新設）** | `paths: ['portal/**', '.github/workflows/portal-verify.yml']` | `actions/checkout` → `actions/setup-node`（`node-version-file: portal/.nvmrc`）→ `npm --prefix portal ci` → **`npm --prefix portal test`（シェル 1 行）** | 新規 |
| `pages.yml`（既存） | `paths: mock/**` | `path: mock`（§2-8） | **無変更** |

**`verify.yml` に `paths-ignore: portal/**` を足さない理由**：`paths` フィルタが付いたワークフローは条件に合わないとき**ジョブが生成されない**。required check にしていると PR が pending のまま詰まる。`verify.yml` は現状数十秒なので、`portal/` だけの PR でも回してよい（**`portal/` を触っても `verify.mjs` は FAIL しない**ことが前提。§5-3 でそれを保証する）。

**`portal-verify.yml` は required check にしない**（推奨）。理由は上と同じで、`portal/` に触らない PR ではジョブが生成されず pending になるため。代わりに：

- `CLAUDE.md` §3 の検証コマンドに **`npm run portal:test`** を足し、implementer が PR 前に必ず回す
- reviewer は「`portal/**` に差分がある PR では `portal-verify` の緑を確認する」（`.claude/agents/reviewer.md` の手順。**PM が適用**）
- **設定が消えたことを機械で検出する**：§5-3

### 5-2. 「1 つでも FAIL ならマージしない」が 2 系統になる問題

`CLAUDE.md` §3 は検証コマンドを 1 つの箱に入れている。1 リポにすると箱が 2 つになる。**箱を 1 つに戻すのは推奨しない**（ルート `npm test` から `portal` を呼ぶと、`portal/node_modules` が無い環境で必ず落ち、R1 が崩れる）。

**代わりに「どちらの箱に入るか」をファイルパスで一意に決める**（§6-3 の §2-14 案）：

> `portal/**` は**ルート `npm test` の対象外**であり、**`npm run portal:test` の対象**である。`portal/**` 以外は逆。**両方の対象になるファイルは無い。**

### 5-3. ルート `verify.mjs` に足す 1 節（**§18**。rev1 は §17 と書いていた）

**【rev2 の訂正】`tools/verify.mjs` の §17 は「部門ポータル（`mock/portal.html`）契約」が既に使っている**（#252〜#271。§0-2 D-3）。**本節は §18 として実装する。** 番号は §8-1 R-P3 の採番規則（実装済みの最大 ＋ 1）に従って implementer が最終決定する。**番号がずれても検査の中身は変わらない。**

**`portal/` を取り込んだときに壊れうる 4 点だけを見る。増やさない。**

| # | 検査 | 判定 |
|---|---|---|
| **18-a** | `portal/` が存在するなら `.github/workflows/portal-verify.yml` が実在し、`paths:` に `portal/**` を含む | FAIL |
| **18-b** | ルート `package.json` に `dependencies` が無く、`scripts.test` が `node tools/verify.mjs && node tools/regress.mjs` のまま（**§2-3 の「ビルド不要」の土台**） | FAIL |
| **18-c** | `portal/package.json` が実在し、ルートの `package.json` を参照していない（S-2） | FAIL |
| **18-d** | `pages.yml` の `path:` が `mock` のまま（**既存の §8 で検査済み**）＋ **`mock/` 配下から `portal/`（リポジトリ直下の新設ディレクトリ）を参照するリンクが無い**（Pages に出ない範囲を参照しない） | FAIL |

**18-d の注意（rev2 で追加）**：`mock/portal.html`・`mock/js/portal/**`・`mock/css/portal.css` は **Pages に出る①デモの一部**であり、⑤ポータル（リポジトリ直下の `portal/`）とは別物である。**検査は「`mock/**` の中に `portal/`（先頭が `portal/` で始まる相対リンク）が現れないこと」で書く。`portal` という語だけを拾うと `mock/portal.html` で必ず誤検知する。**

`portal/` が無ければ**節ごと skip**（`dify/samples/` を見る §16 と同じ作法）。**取り込み前にこの節を先に入れておける**（§9 PR-R4）。

---

## 6. `CLAUDE.md` の変更（**PM 承認済み（2026-09-11）。architect は書き換えない —— 実装は PR-N1**）

**rev2：§10 判断 2・3・4・7 が確定したので、§6-1〜§6-4 は「提案」から「承認済みの設計」になった。そのまま当てられる文面は §6-5 にある。** 本 PR は `CLAUDE.md` を 1 バイトも変えない（§12 A-8）。

### 6-1. 4 区分 → 5 区分

**提案：⑤を増やす。** `portal/` を②実装ソースに入れない。

理由：②（`dify/`・`scripts/`・`tools/`）は「Dify に投入する定義とその検証」で**ランタイムを持たない**。`portal/` は**動くシステム**であり、`npm test` の対象も CI も別である。②に押し込むと、**地図から「どちらの検証の箱に入るか」が読めなくなる**（§5-2 の分岐がまさにそこ）。

冒頭の地図に足す文案（1 文）：

> **⑤ポータル**＝`portal/`（社内向けポータル（NocoBase Community）の定義・DDL・架空のデモデータ。**実データは 1 バイトも入らない**。ルート `npm test` の対象外で、検証は `npm run portal:test`。設計は `docs/handoff/2026-09-10-portal-nocobase.md` と `docs/handoff/2026-09-11-repo-layout-v3.md`）

### 6-2. `README.md` と `tools/verify.mjs` の同時変更（**見落とすと必ず FAIL する**）

`tools/verify.mjs` **§11-b（665 行付近）が README の見出し文字列をリテラルで持っている**：

```js
const mapSection = readme.match(/## このリポジトリの歩き方（4 区分）[\s\S]*?(?=\n## |\n---|\s*$)/);
```

**「4 区分」→「5 区分」に変えるなら、次の 3 ファイルを同じ PR で変える必要がある**：

1. `README.md` の見出しと表（行を 1 つ足す）
2. `tools/verify.mjs` の上記リテラルと `section('11. 索引の鮮度・README の 4 区分地図')`
3. `CLAUDE.md` 冒頭の地図

**これを設計書に書いておかないと、implementer が README だけ直して verify が FAIL する。**

### 6-3. load-bearing に足す 1 項（§2-14 案）

**4 点だけ。ポータルの中身の設計（スキーマ・画面・ロール）は load-bearing に入れない**（`portal/CLAUDE.md` の担当）。

> ### 2-14. `portal/` はルートの検証から分離する
> - **何を**：① **ルート `package.json` の `dependencies` はゼロ・`scripts.test` は `verify + regress` のまま**（`portal/` の依存をルートに足さない）② **`portal/**` はルート `npm test` の対象外、`npm run portal:test`（= `npm --prefix portal test`）の対象**。両方の対象になるファイルは無い ③ **`portal/**` に実データ・秘密・実 URL を置かない**（検査は `portal/tools/check-nodata.mjs`。CI は `portal-verify.yml`）④ **`portal/**` は単独で切り出せる状態を保つ**（外への相対参照は `gen-seed.mjs`・`check-seed-fresh.mjs` の 2 本だけ。設計書 `2026-09-11-repo-layout-v3.md` §4-2 S-1〜S-7）
> - **なぜ**：`mock/` が「ビルド不要・`file://` で開ける」（§2-3・§2-8）のは `dependencies` ゼロが土台。ポータルは常駐サーバと DB を持つので、同じ箱に入れると土台が消える。**切り出し可能性は GitLab 移行の保険**
> - **検出**：`tools/verify.mjs` §17（17-a〜17-d）／`portal/tools/check-nodata.mjs`／reviewer の diff 監査

### 6-4. §3・§5・§7 への追記案

| 節 | 追記 | 理由 |
|---|---|---|
| **§3 検証コマンド** | `npm run portal:test` を 1 行足す。**あわせて現在の誤記を直す**：「`npm test` … CI の verify ワークフローと同じ」は事実と違う（CI は 11 ステップ。§8 R-P2） | implementer が回すコマンドの一覧 |
| **§5 Git 運用** | 「**`portal/**` とそれ以外はファイル集合が重ならないので並列可**」を 1 行 | 並列判断の明文化 |
| **§7 実行場所** | **`run:*` の 4 つ目を作らない**（推奨）。`portal/` の設計・実装・検査は `run:cloud`、docker を動かすのは `run:mac`。ただし **`run:mac` の定義文「ブラウザのログイン済みセッションが要る」を「PM の手元でしか動かせないもの（ブラウザのログイン済みセッション／ローカル docker）」に広げる** | ラベルを増やすと「1 つだけ」の規律が薄まる |


### 6-5. **【rev2 新設】PR-N1 でそのまま当てる文面**（implementer はここをコピーする）

**PM 決定（2026-09-11）により §6-1〜§6-4 は承認された。** 加えて **main の現状とのずれ 3 件（件数・`industry` の値域・3 世界）も同じ PR にまとめてよい**と PM が判断したので、**PR-N1 は下の 9 か所を 1 つの diff で当てる**。

**当てる前に必ず確認**：ここに書いた「変更前」は 2026-09-11 夕（`4a4f3d1`）の `CLAUDE.md` の実文である。**当てる時点でずれていたら止めて PM に返す**（黙って直さない）。

#### N1-1. 冒頭の地図：4 区分 → 5 区分（`CLAUDE.md` 3 行目）

**変更前（3 行目の抜粋）**：

```text
`shoulang0729/dify` は次の **4 区分**を置くリポジトリ：…／**④ダミーデータ**＝…（デモ投入用の入力サンプル）。地図はトップ `README.md`、管理番号からの索引は `docs/service-map.md`（生成物）。
```

**変更後**：`**4 区分**` を `**5 区分**` に変え、`（デモ投入用の入力サンプル）` の直後・`。地図はトップ` の前に次の 1 文を挿入する（先頭の全角スラッシュを含む）：

```text
／**⑤ポータル**＝`portal/`（社内向けポータル（NocoBase Community）の定義・DDL・架空のデモデータ。**実データは 1 バイトも入らない**。ルート `npm test` の対象外で、検証は `npm run portal:test`。設計は `docs/handoff/2026-09-10-portal-nocobase.md` と `docs/handoff/2026-09-11-repo-layout-v3.md`）
```

**同じ PR で必ず一緒に変える 2 ファイル（片方だけだと verify が FAIL する。§6-2）**：
1. `README.md` の見出し `## このリポジトリの歩き方（4 区分）` → `（5 区分）`＋表に ⑤ の行を 1 つ足す
2. `tools/verify.mjs`（現状 690 行・692 行）の `## このリポジトリの歩き方（4 区分）` リテラル 2 か所と、666 行の `section('11. 索引の鮮度・README の 4 区分地図')`

#### N1-2. §2-3 の `industry` の値域に `it` を足す（`CLAUDE.md` 44 行目）

**変更前 → 変更後**（44 行の中の 1 文だけ）：

```text
変更前: `industry` は業種（`mfg`/`fin`）。
変更後: `industry` は業種（`mfg`/`fin`/`it`。値の正本は `mock/js/data/ui.js` の `INDUSTRIES`。tools/** に業種をハードコードしない＝#251）。
```

#### N1-3. §2-13 を 3 世界と「跨ぎの例外」に合わせる（`CLAUDE.md` 108 行・109 行・110 行）

**108 行 変更前**（先頭部分）：

```text
- **何を**：会社（青嶺精工／青岭精工／Seirei Seiko Co., Ltd.）・拠点（蘇州工場・Japan HQ）・人・部署・品番・設備・…
```

**108 行 変更後**（先頭だけ差し替え。「・品番・設備・」以降はそのまま）：

> - **何を**：**業種ごとに 1 つの世界**（`data/world/mfg` 青嶺精工／`data/world/fin` 碧洋銀行／`data/world/it` 翠雲システムズ）。会社（社名は ja/zh/en の 3 言語）・拠点・人・部署・品番・設備・取引先記号・KPI・文書番号体系・規程と社内 ID の台帳（`documents.csv`）・カレンダー。台本（`mock/js/data/scenarios/**`）・KB 用文書（`dify/kb/**`）・テスト（`dify/tests/**`）・入力サンプル（`dify/samples/**`）・ユースケース文書はここにある値だけを使う。**新しい名前・数字はまずマスタに足す**

- **109 行 の末尾に 1 文を足す**：

> **世界の語彙は混ぜない。ただし IT 世界だけ、`clients.csv` の `ref_world` 列で参照を明示したうえで、青嶺精工・碧洋銀行の社名と拠点名（蘇州工場・上海本部）に限って参照してよい**（人・部署・品番・設備・KPI・文書番号は跨がない。逆方向は禁止）。**例外の範囲は `data/world/README.md` と `data/world/it/company.md` が正本。**

**110 行 変更前 → 変更後**（末尾の丸括弧だけ）：

```text
変更前: …理由付きで 1 行ずつ載せる（現状 10 件）
変更後: …理由付きで 1 行ずつ載せる（**現状 12 件**：製造 10／金融 1／IT 1）
```

#### N1-4. §2-14 を load-bearing に足す（§2-13 の直後）

**§6-3 の文面をそのまま入れる**（4 点だけ。ポータルの中身の設計は `portal/CLAUDE.md` の担当）。**1 か所だけ rev2 で訂正**：検出の節番号は §17 ではなく **§18**（§0-2 D-3）。

> ### 2-14. `portal/` はルートの検証から分離する
> - **何を**：① **ルート `package.json` の `dependencies` はゼロ・`scripts.test` は `verify + regress` のまま**（`portal/` の依存をルートに足さない）② **`portal/**` はルート `npm test` の対象外、`npm run portal:test`（= `npm --prefix portal test`）の対象**。両方の対象になるファイルは無い ③ **`portal/**` に実データ・秘密・実 URL を置かない**（検査は `portal/tools/check-nodata.mjs`。CI は `portal-verify.yml`）④ **`portal/**` は単独で切り出せる状態を保つ**（外への相対参照は `gen-seed.mjs`・`check-seed-fresh.mjs` の 2 本だけ。設計書 `2026-09-11-repo-layout-v3.md` §4-2 S-1〜S-7）
> - **なぜ**：`mock/` が「ビルド不要・`file://` で開ける」（§2-3・§2-8）のは `dependencies` ゼロが土台。ポータルは常駐サーバと DB を持つので、同じ箱に入れると土台が消える。**切り出し可能性は GitLab 移行の保険**
> - **用語の衝突に注意**：**`mock/portal.html`・`mock/js/portal/**`・`mock/css/portal.css` は①デモ（Pages に出る部門ポータルの概念モック）** であり、本項の**⑤ポータル（リポジトリ直下の `portal/`）とは別物**。本項が縛るのは後者だけ
> - **検出**：`tools/verify.mjs` **§18**（18-a〜18-d）／`portal/tools/check-nodata.mjs`／reviewer の diff 監査

#### N1-5. §3 検証コマンドに 1 行足す（`CLAUDE.md` の ```bash ブロック）

`npm run world` の行の**次**に 1 行：

```
npm run portal:test       # portal/ の検証（= npm --prefix portal test）。portal/** に触った PR でだけ回す。ルート npm test はこれを呼ばない
```

**あわせて同じブロックの誤記を直す**（§8-1 R-P2）：`npm test` の行の `（CI の verify ワークフローと同じ）` を `（CI の verify ワークフローはこの 2 つに加えて Python 側の検査も回す。詳細は .github/workflows/verify.yml）` に。**PM 判断 4 で `npm run ci` の新設を採ったので、PR-R4 が `npm run ci` を作ったら、この行はさらに `npm run ci` を指す形に直す**（PR-R4 の受け入れ条件。§9）。

#### N1-6. §5 Git 運用に 1 行足す（「別ファイルなら並列可」の行の次）

> - **`portal/**` とそれ以外はファイル集合が重ならないので並列可**（ただし `CLAUDE.md`・`README.md`・`tools/verify.mjs` を触る PR は常に直列）

#### N1-7. §7 の `run:mac` の定義文を広げる（`CLAUDE.md` 172 行）

**172 行の表セル 2 列目だけ**（3 列目の「回せるもの」は 1 バイトも変えない）：

```text
変更前: PM の Mac（ブラウザのログイン済みセッションが要る）
変更後: PM の Mac（**PM の手元でしか動かせないもの**：ブラウザのログイン済みセッション／ローカル docker）
```

**`run:*` の 4 つ目は作らない**（PM 判断 7）。`portal/` の設計・実装・検査は `run:cloud`、docker を動かすのは `run:mac`。

#### N1-8. §6 バックログの件数を実データに合わせる（`CLAUDE.md` 157 行）

**157 行の末尾の 1 文だけ**（その前の経緯の記述は変えない）：

```text
変更前: 現在は **13 分類 29 中分類 67 サービス**（製造 49／金融 29／両業種 11、提供中 12／試行版 29／構想 26）
変更後: 現在は **15 分類 35 中分類 81 サービス**（製造 49／金融 29／IT 25、複数業種 11、提供中 12／試行版 29／構想 40。**最新は `docs/service-map.md`（生成物）と `node tools/regress.mjs` の出力が正**）
```

**この数字は `node tools/regress.mjs` の出力（2026-09-11 `4a4f3d1`）と一致している。当てる時点で再実行して確認すること。**

#### N1-9. §6 バックログの棚卸し（`CLAUDE.md` 159 行・160 行。§8-1 L-1・L-2）

**159 行 変更前**（該当部分）：

```text
P3 候補：`?v=` キャッシュスタンプの機械検証、`tools/bundle.mjs`（単一ファイル生成）、`scenarios/` の 1 サービス 1 ファイル化。
```

**159 行 変更後**：

> P3 候補は棚卸し済み（設計書 `docs/handoff/2026-09-11-repo-layout-v3.md` §8-1 L-1・L-2）：**`?v=` キャッシュスタンプは 1 つも存在しないので機械検証の対象が無い**／**`tools/bundle.mjs`（単一ファイル生成）は `top.html` 廃止で目的が消えた**／**`scenarios/` の 1 サービス 1 ファイル化は当面やらない**（閾値：1 ファイル 600 行を超えたら再検討。現状の最大は `mfg/dc.js` 373 行）。

**160 行（`top.html` の扱い）変更前 → 変更後**：

```text
変更前: ②③ が `catalog.html` に入ったので **削除（PR-3）**。
変更後: ②③ が `catalog.html` に入ったので **削除済み**（`mock/` に存在しない）。
```

#### N1-10. 当てない・変えないもの（明示）

| 対象 | 理由 |
|---|---|
| §2-1〜§2-12 の本文 | 本件と無関係。**1 バイトも変えない** |
| §2-2 の `--ntt-*` 不変・§2-6 の `localStorage` 許可集合・§2-8 の `path: mock`・§2-9 の id 改名禁止・§2-11 の管理番号 | load-bearing。**PR-N1 の対象外** |
| §4 の 3 エージェント分業表 | 変えない（`portal/` でも同じ分業） |
| §7 の `run:cloud`／`run:runner` の定義文・秘密の 3 種 | 変えない（4 つ目を作らない＝ PM 判断 7） |

---

## 7. `shoulang0729/portal` リポジトリをどうするか（**決定。PM 2026-09-11**）

**1 リポに決まった**（§0・§10 判断 1）。**GitHub 上の操作（close・archive）は PM が行う。エージェントはリポジトリ設定を触らない。**

**取り込み元の実測（2026-09-11 時点、REST API で確認）**：`shoulang0729/portal` は public・未 archive・`main` と `feat/portal-skeleton` の 2 ブランチ。`main` には `README.md` 1 本だけ。**PR #1（`feat/portal-skeleton`、open）に入っているのは 16 ファイル**（`CLAUDE.md` 9.5 KB・`README.md`・`package.json`・`.gitignore`・`.env.example`・`.github/workflows/verify.yml`・`docs/nodata-known.md`・`tools/check-nodata.mjs` 27.6 KB・`tools/nodata-common-words.txt`・`tools/nodata.baseline.json`・`seed/world/README.md`・`seed/world/{mfg,fin}/{company.md,org.csv,people.csv}`）。**`nocobase/`・`schema/`・`env/`・`scripts/` はまだ存在しない**（§2-1 のツリーは PR-N2 で新設する）。

**持ち込みの条件（PR-N2 の受け入れ条件。reviewer が 1 ファイルずつ見る）**：

| # | 条件 |
|---|---|
| **C-a** | **実名（顧客・社員・取引先）・実 URL・秘密（トークン／API キー／Cookie／パスワード）が 1 つも無い**こと。`.env.example` は**変数名だけ**で値を書かない（`CLAUDE.md` §2-10） |
| **C-b** | `seed/world/{mfg,fin}/**` の 7 ファイルは**そのままコピーしない**。`portal/scripts/gen-seed.mjs` で `data/world/**`（**3 世界**）から生成し直す（§2-5・下表 4） |
| **C-c** | `tools/check-nodata.mjs` は走査範囲を `portal/**` に読み替えてから入れる（§8-1 R-P4） |
| **C-d** | `.github/workflows/verify.yml`（portal 側）は**そのまま持ち込まない**。dify 側で `portal-verify.yml` として書き直す（`paths: portal/**`・中身はシェル 1 行。S-3） |
| **C-e** | `CLAUDE.md`（portal 側 9.5 KB）は `portal/CLAUDE.md` として置く。**dify 側 `CLAUDE.md` の抜粋になっている部分は「`shoulang0729/dify` の `CLAUDE.md` §X を見よ」に置き換える**（S-4・S-5。二重管理を消すのが 1 リポの目的） |

**1 つでも満たせないファイルは持ち込まず、PR-N2 で書き直す。**

**扱いの決定：**

| # | 対象 | 扱い |
|---|---|---|
| **1** | **中身（`CLAUDE.md`・`README.md`・`package.json`・`.gitignore`・`.env.example`・`tools/check-nodata.mjs`・`tools/nodata-common-words.txt`・`tools/nodata.baseline.json`・`seed/world/`・`docs/nodata-known.md`・`.github/workflows/verify.yml`）** | **ファイルをコピーして dify リポの `portal/` に新規 commit で置く。履歴は持ち込まない**（`git subtree add` を使わない）。理由：portal リポの履歴は 2 commit しかなく、持ち込むと将来の `subtree split` の履歴が汚れる。出自は取り込み PR の commit message と `portal/README.md` に書けば足りる |
| **2** | **PR #1（`feat/portal-skeleton`）** | **マージせず close。** close コメントに「内容は `shoulang0729/dify` の取り込み PR（#<番号>）に取り込んだ。判断は `docs/handoff/2026-09-11-repo-layout-v3.md` §1」と書く |
| **3** | **リポジトリ本体** | **取り込み PR がマージされたあとに archive（read-only）。削除しない。** 過去の Issue / チャットからのリンクが切れないようにするため（`CLAUDE.md` §2-8 が `mock/` を改名しない理由と同じ考え方）。`README.md` の先頭に 1 行「このリポジトリは `shoulang0729/dify` の `portal/` に統合された」 |
| **4** | **`seed/world/` の中身** | **そのままコピーせず、`portal/scripts/gen-seed.mjs` で `data/world/**` から生成し直す**（§2-5）。手コピーの出典行はここで役目を終える |
| **5** | **`tools/check-nodata.mjs`** | コピーしたうえで **走査範囲を `portal/**` に読み替える**（§8 R-P5）。G1（トップレベル構造の allowlist）は「リポジトリのトップレベル」→「`portal/` 直下」に読み替える |

**2 リポのままにする場合**（**採らない**。記録として残す）：PR #1 をレビューしてマージし、`portal-nocobase.md` の PR-A → PR-B → PR-C に進む道だったが、**PM 決定により選ばれなかった**。

---

## 8. リファクタリングの棚卸し（**rev2：消化状況つき**）

**rev1（2026-09-11 昼）の一覧に、2026-09-11 夕（`4a4f3d1`）時点の状態を足した。**
状態は **済（PR 番号）／一部済／未** の 3 つ。**「済」は実装対象から外す。reviewer は「済」の行に diff が出ていないことを確認すればよい。**

優先度：**P0 ＝ IT 業 PR より前（→ 2026-09-11 に IT 業は流れたので、P0 は事実上すべて決着）／P1 ＝ ポータル取り込みより前／P2 ＝ いつでも**

### 8-1. 一覧（状態つき）

| # | 項目 | 優先 | **状態（2026-09-11 夕）** | 残っている作業 | どの PR |
|---|---|---|---|---|---|
| **R-I1** | `tools/**` の業種ハードコードを `INDUSTRIES` 駆動にする（rev1 §8-2 の 8 か所） | P0 | **済（#251）** | 無し。`tools/regress.mjs` 28 行・`tools/gen-index.mjs` 37 行・`tools/check-world.mjs` 96 行のコメントが本書 §8-2 を出典として引いている | — |
| **R-I2** | `regress.baseline.json` の `counts` を業種 map に移行 | P0 | **済（#251）** | 無し。現在の基準は `{"cats":15,"subs":35,"svcs":81,"tags":66,"ui":91,"byIndustry":{"mfg":{"svcs":49,"cats":10},"fin":{"svcs":29,"cats":8},"it":{"svcs":25,"cats":7}},"svcsMulti":11}` | — |
| **R-I3** | `data/world/README.md` の人数と「未統一」件数 | P0 | **済** | 無し。README は人物 **mfg 20／fin 17／it 5** と「未統一 mfg 10／fin 1／it 1」を実数で書いており、`npm run world`（warn 12 件）と一致する。**ただし `CLAUDE.md` §2-13 の「現状 10 件」だけが取り残されている** → §6-5 N1-3 | **PR-N1** |
| **R-I4** | 件数の手書きが複数ファイルに散在 | P0 | **一部済（#265／#275）** | #265 が当時の実数（14/33/77）に揃え、#275 が `docs/handoff/service-index.md` を 81 件に・ポータルの AI サービス件数バッジを `SVCS.length` に変えた。**その後 #269（SO-01〜04 の追加）で実数が 15/35/81 に動き、手書きが再びずれた**（下表 8-3）。**「毎回ずれる」ことが実証されたので、rev1 の方針＝数字を語る場所を絞って残りは `docs/service-map.md` 参照に置き換える、を実行する** | **PR-R3** |
| **R-I5** | **【rev2 新設】ポータル画面数の手書き「15 画面」が 5 か所**（実数は **16**。#272 で `sys` が増えた） | P0 | **未** | `mock/README.md:15,56`・`mock/index.html:163`・`mock/js/data/portal/ui.js:14,122`・`mock/js/portal/render.js:2`。**R-I4 と同じ性質の問題なので同じ PR で処理する**（数字を残すのは `mock/index.html` だけ、他は「`PSCREENS` が正本」に） | **PR-R3** |
| **R-P1** | `CLAUDE.md` 4 区分 → 5 区分 ＋ `README.md` ＋ `verify.mjs` §11-b のリテラル（§6-2） | P1 | **未** | 3 ファイル同時。文面は §6-5 N1-1 にそのまま貼れる形で書いた | **PR-N1** |
| **R-P2** | **CI の契約のずれ**：`CLAUDE.md` §3 の「`npm test` ＝ CI の verify ワークフローと同じ」が事実と違う。さらに `verify.yml` に**管理番号 12 個がベタ書き** | P1 | **未**（rev1 は「CI は 11 ステップ」と書いたが、**現在は 13 ステップ**。`verify.yml:60` の管理番号ベタ書きは健在） | **PM 判断 4 の決定に従い `npm run ci` を新設**して `verify.yml` を数行にする。管理番号 12 個は `package.json` か `tools/` 側へ移す（GitLab 移行の G-1） | **PR-R4** |
| **R-P3** | `tools/verify.mjs` の節番号の採番規則（**§13 が永久欠番**・設計書と実装の番号違いの注記が 5 か所） | P1 | **未**（**§13 は依然欠番。実装済みの最大は §17**＝部門ポータル契約） | 冒頭に「§13 は永久欠番」を 1 行／注記 5 か所を冒頭に集約／**採番規則＝設計書は番号を予約せず、implementer が「実装済みの最大 ＋ 1」を取る**を `docs/handoff/README.md` に 1 行 | **PR-R4** |
| **R-P4** | `portal/` 取り込み時の `check-nodata.mjs` の読み替え（走査範囲を `portal/**` に限定。G2 の `*.sql` は `portal/schema/` だけ、G3 の `*.csv` は `portal/seed/` だけ、N4/N5/N6 は `portal/**` 限定。**G4 だけはリポジトリ全体**） | P1 | **未** | そのままコピーすると `data/world/**` の CSV と `docs/**` の URL で大量 FAIL する | **PR-N2** |
| **R-P5** | **ルート `verify.mjs` の新節**（§5-3 の 4 検査） | P1 | **未**（**rev1 の「§17」は使用済みになったので §18 に繰り下げ**。§0-2 D-3） | 取り込み**前**に入れる。`portal/` が無い間は節ごと skip | **PR-R4** |
| **L-1** | `CLAUDE.md` §6 バックログの棚卸し（`top.html` 削除済み／`?v=` が存在しない／`bundle.mjs` の目的消滅） | P2 | **未**（3 点とも rev1 の指摘のまま：`mock/top.html` は存在せず、`catalog.html`／`portal.html` の `<script src>` に `?v=` は 1 つも無い） | 文面は §6-5 N1-9 | **PR-N1**（§6 を触る PR にまとめる。rev1 は PR-R3 としていたが、**`CLAUDE.md` を触る PR は 1 本に寄せる**方が PM 承認が 1 回で済む） |
| **L-2** | `scenarios/` の 1 サービス 1 ファイル化 | P2 | **未（やらないと明記する）** | 現状の最大は `mfg/dc.js` **373 行**・`mfg/pt.js` 353 行で rev1 から変わっていない（IT 業の `scenarios/it/**` が増えても 1 ファイルは小さい）。**閾値「1 ファイル 600 行」を書いて先送りする** | **PR-N1**（§6 の同じ行） |
| **L-3** | `tools/verify.mjs` の分割 | P2 | **分割しない（維持）** | 行数は rev1 の 1219 → **1506**（§17 が入った分）。§8-4 の理由は行数が増えても変わらない。**代わりに R-P3 をやる** | — |
| **L-4** | `mock/js/render.js` 847 行 | P2 | **分割しない（維持）** | 行数は 847 のまま。パターンは 3 つで打ち止め（`CLAUDE.md` §2-3） | — |

**rev1 から消えた前提**：rev1 §8-1 の「なぜ今か」は「IT 業 PR の**前**にやらないと 2 度手間」を軸にしていたが、**IT 業 PR は 2026-09-11 に PR-R1 相当（#251）を先に流したうえで流れた**（rev1 §9-1 の警告どおりの順で実行された）。したがって **R-I1／R-I2 の「2 度手間」は現実には起きていない。**

### 8-2. R-I1 の対象（8 か所）—— **済（#251）。記録として残す**

| # | ファイル:行 | 現状 | あるべき形 |
|---|---|---|---|
| 1 | `tools/verify.mjs:91` | `const INDUSTRY_ORDER = ['mfg','fin'];` | `INDUSTRIES.map(i => i.id)` から取る（`INDUSTRIES` が表示順の正本） |
| 2 | `tools/verify.mjs:94-96` | `CAT_ORDER_BY_INDUSTRY = { mfg:[…], fin:[…] }` | **データ側から導く**（各業種で `industries` にその業種を含む `CATS` の宣言順）。導けないなら `INDUSTRIES` にキーが無い業種を FAIL にする |
| 3 | `tools/verify.mjs:363` | `industries の順序が ['mfg','fin'] 固定でない` | メッセージを `INDUSTRY_ORDER` から組み立てる |
| 4 | `tools/verify.mjs:1138`（§16-c） | `!['mfg','fin'].includes(fm.industry)` | `!industryIds.has(fm.industry)`（**`industryIds` は 92 行に既にある**） |
| 5 | `tools/regress.mjs:28-32` ＋ **50-60 行の検算** | `svcsMfg + svcsFin − svcsBoth === svcs` | 包除原理をやめる。**`SVCS.every(s => s.industries?.some(i => industryIds.has(i)))`**（全サービスが少なくとも 1 つの既知業種に属する）＋ **業種別件数は map で保存**（R-I2） |
| 6 | `tools/gen-index.mjs:45` | `industryLabel = { mfg:'製造', fin:'金融' }` | **`INDUSTRIES[].name.ja` から取る**（`mock/js/data/ui.js` が正本。ラベルの二重定義を消す） |
| 7 | `tools/gen-index.mjs:83-84`（**本書で追加**） | `demoMfgCell`／`demoFinCell` の **2 列固定** | `INDUSTRIES` の数だけ列を作る（ヘッダも動的に）。**`docs/service-map.md` が再生成されるので `npm run index` と verify §11-a の期待出力も変わる** |
| 8 | `tools/check-world.mjs`（**本書で追加**。`warnCounts`/`currentInd`/バケット判定/`ind === 'fin' ?` のパス分岐/`ind === 'mfg' ?` の `equipment`・`partners`/`FEED` を mfg 限定 —— **10 か所以上**） | `mfg`/`fin`/`both` の 3 バケット固定 | **IT 業 architect の設計（`it` バケットの W1/W5 だけ和集合）に従う。** 本書では方針だけ：**バケットを `INDUSTRIES` ＋ `multi` から作り、業種ごとの「持っているファイル」（`equipment.csv` の有無など）をハードコードせず `existsSync` で判定する** |

**rev2 の確認結果**：8 か所すべてが #251（`refactor(tools): 業種ハードコード(mfg/fin)を INDUSTRIES 駆動にし、regress 基準を業種 map へ移行`）で解消され、`docs/service-map.md` の列も **①台本(製造)／①台本(金融)／①台本(IT)** の 3 列に再生成されている。**この表は実装対象ではなく、reviewer が「もう触らなくてよい」と判断するための記録である。**

### 8-3. R-I4／R-I5 の対象と**確定方針**（PR-R3）

**実データ（`node tools/regress.mjs` の出力、2026-09-11 `4a4f3d1`）**：

```
15 分類 / 35 中分類 / 81 サービス / TAGS 66
製造 mfg  大分類 10 中分類 20 サービス 49
金融 fin  大分類  8 中分類 15 サービス 29
IT   it   大分類  7 中分類 12 サービス 25
複数業種にまたがるもの 11
成熟度   提供中 12 / 試行版 29 / 構想 40
部門ポータル PSCREENS 16 画面 / SVCS[].place に画面を持つ 63 件・out 18 件
```

| ファイル | 2026-09-11 夕の記述 | 実数 | **確定方針** |
|---|---|---|---|
| `CLAUDE.md` §6（157 行） | 13 分類 29 中分類 67 サービス（製造 49／金融 29／両業種 11、提供中 12／試行版 29／構想 26） | 15/35/81・IT 25・構想 40 | **数字を残す**（PM とエージェントが最初に読む場所）＋「最新は `docs/service-map.md` と `regress.mjs` の出力が正」を添える → §6-5 N1-8（**PR-N1**） |
| `mock/index.html:148` | `<div class="stat-n">77</div>` | 81 | **数字を残す**（顧客が読む） |
| `mock/index.html:163` | 部門ポータル・**15 画面** | 16 | **数字を残す** |
| `mock/index.html:208-210` | 製造 10 分類 49／金融 8 分類 29／**IT 6 分類 21** | IT は **7 分類 25** | **数字を残す** |
| `docs/demo/briefing-catalog.md:10,17,36` | **14 分類・33 中分類・77 サービス**／「## 2. 14 分類の意味と 33 中分類」／製造 49・金融 29・**IT 21** | 15/35/81・IT 25 | **数字を残す**（顧客提示資料。数字が無いと意味をなさない） |
| `docs/demo/briefing-coverage.md:41,42` | 「67 サービス全体を…7 つの波」「現在 **77 サービス**まで拡大」「後から加わった IT 業種固有の **10 サービス**」 | 81／IT 固有は SO-01〜04 を含めて 14 | **数字を残す**（Wave の話は「この設計を立てた時点の 67」を指すので、**67 はそのまま。現在値の 77 だけを 81 に**） |
| `README.md:16` | 「**77 サービス**（実装リファレンスは 67 件）の詳細ユースケース」 | 81 | **数字を消す** →「全サービスの詳細ユースケース（件数は `docs/service-map.md`）」 |
| `mock/README.md:14` | 「業種3×大分類**14**×中分類**33**×**77**サービス（… 日系 SIer **21** 件 …）」 | 15/35/81・IT 25 | **数字を消す** →「業種・大分類・中分類・サービスの構成は `docs/service-map.md`（生成物）を参照」 |
| `mock/README.md:15` | 「概念モック（**15 画面**）」「カタログ **77 件**のうちポータルに置くのは **49 件**」 | 16 画面・81 件・63 件 | **数字を消す** →「画面は `mock/js/data/portal/ui.js` の `PSCREENS`、置き場所は `SVCS[].place` が正本」 |
| `mock/README.md:56` | `V.*（15 画面）` | 16 | **数字を消す**（`PSCREENS` 参照に） |
| `mock/js/data/portal/ui.js:14,122` | コメント「ナビ（画面ラベル。**15 画面**）」「`PSCREENS` — 画面台帳（**15 画面**）」 | 16 | **数字を消す**（`PSCREENS` の要素数が自明なので件数を書かない） |
| `mock/js/portal/render.js:2` | `V.*（15 画面）` | 16 | **数字を消す** |
| `docs/dify/README.md:3,23` | 既に「最新の分類・サービス件数は `docs/service-map.md` を参照」 | — | **済（#265）。触らない** |
| `docs/dify/implementation-guide.md:3` | 既に「最新の分類・サービス件数は `docs/service-map.md` を参照」 | — | **済（#265）。触らない** |

**「現在を語る場所」は 4 つだけに絞る（確定）**：`CLAUDE.md` §6 ／ `mock/index.html` ／ `docs/demo/briefing-catalog.md` ／ `docs/demo/briefing-coverage.md`。**残りはすべて生成物（`docs/service-map.md`）かデータ（`PSCREENS`／`SVCS[].place`）への参照に置き換える。**

**機械検査は足さない（rev1 の判断を維持）**：「`\d+ 分類` がデータと一致」は誤検知が多く、`briefing-*.md` の文脈依存の数字（「この設計を立てた時点の 67」など）まで拾う。**代わりに、カタログにサービスを足す PR の受け入れ条件に「§8-3 の 4 ファイルの数字を更新した」を毎回書く**（`docs/handoff/README.md` の「設計書に必ず書くこと」に 1 行足す。PR-R4 で R-P3 と同時に）。

### 8-4. L-3（`verify.mjs` の分割）を推奨しない理由

節は 1〜17（**§13 は永久欠番**）で **1506 行**（rev1 執筆時は §16 まで 1219 行）。**節ごとにファイルへ分けるのは、行数が増えても推奨しない。**

- 各節は `mock`（`loadMock()` の戻り値）・`allJsText`・`appText`・`ok`/`fail`/`warn` を**共有している**。分割すると引数の受け渡しかグローバルな context オブジェクトが要り、**読みやすさは上がらず、検査の意味が変わるリスクだけが増える**
- 「1 ファイルで上から読むと全部の検査が分かる」は**エージェントが読む前提では利点**である
- 節が増え続けること自体は問題ではない。**問題は採番が Issue の着手順で衝突していること**（R-P3）

**代わりにやること（R-P3。意味を 1 バイトも変えない）**：

1. 冒頭のコメントに **「§13 は永久欠番（Issue #121 W2 用に予約されたまま使われなかった）」** を 1 行で明記する
2. **§14／§15／§16 のヘッダに散っている「設計書は §X としているが…」という同じ趣旨の注記 5 か所を、冒頭の 1 か所に集約する**
3. **採番規則を決める**：**設計書は節番号を予約しない。implementer が実装時に「実装済みの最大 ＋ 1」を取る。設計書には「新しい節（番号は実装時に決める）」と書く。** `docs/handoff/README.md` の「設計書に必ず書くこと」に 1 行足す

---

## 9. 実装 PR の分割と順番（**rev2：確定版**）

**rev1 の PR-R1／PR-R2 は #251 と `data/world/README.md` の更新で消化済み。IT 業 PR（#255〜#264）とポータルモック PR-1〜4（#252/#260/#267/#271）とシステム運用 PR-1〜5（#268〜#274）も流れた。** したがって残るのは **5 本**である。

```
  【いま】  main = 4a4f3d1（15 分類 35 中分類 81 サービス / ポータル 16 画面 / 3 世界 / verify §17 まで）
                                  │
                                  ▼
  PR-R3  件数・画面数の参照化（R-I4 / R-I5）        ─┐
         mock/index.html・mock/README.md・          │ 並列可（ファイル集合が重ならない）
         docs/demo/briefing-*.md・README.md・        │
         mock/js/data/portal/ui.js・js/portal/render.js
                                                     │
  PR-R4  verify.mjs §18 新設 ＋ 節番号規則 ＋ npm run ci ─┘
         tools/verify.mjs・.github/workflows/verify.yml・package.json・docs/handoff/README.md
                                  │
                                  ▼（PR-R4 は PR-N1 より前。§9-1）
  PR-N1  CLAUDE.md 5 区分 ＋ §2-14 ＋ 件数 ＋ industry 値域 ＋ 3 世界 ＋ §6 棚卸し   ※ PM 承認
         CLAUDE.md・README.md・tools/verify.mjs（§11-b のリテラル）
                                  │
                                  ▼
  PR-N2  portal/ の新設と取り込み
         portal/**（新規）・.github/workflows/portal-verify.yml（新規）・.gitignore・package.json
                                  │
                                  ▼
  PR-N3  shoulang0729/portal の PR #1 を close ／ リポジトリを archive
         （GitHub 上の操作。PR ではない。PM が行う）
```

### 9-1. PR ごとの定義（触るファイル・受け入れ条件・並列可否）

#### PR-R3 —— 件数・画面数の参照化（R-I4 / R-I5）

| | |
|---|---|
| **触るファイル** | `mock/index.html`（148・163・208-210 行）／`mock/README.md`（14・15・56 行）／`docs/demo/briefing-catalog.md`（10・17・36 行）／`docs/demo/briefing-coverage.md`（41・42 行）／`README.md`（16 行）／`mock/js/data/portal/ui.js`（14・122 行の**コメントだけ**）／`mock/js/portal/render.js`（2 行の**コメントだけ**） |
| **触らない** | `mock/js/data/**` の**データ本体**（`CATS`/`SVCS`/`TAGS`/`SCENARIOS`/`HOME`/`FEED`/`LIVE`/`PSCREENS` の値）／`CLAUDE.md`（件数は PR-N1）／`tools/**` |
| **受け入れ条件** | ① §8-3 の表のとおりに 4 ファイルは実数へ、それ以外は参照へ置換 ② **`node tools/regress.mjs` が差分ゼロ**（`--update` **不要**。データを 1 バイトも変えないため） ③ `node tools/verify.mjs` PASS・**warn 17 件で不変** ④ `npm test` PASS ⑤ `mock/index.html`・`mock/README.md` の数字が `node tools/regress.mjs` の出力と一致することを PR 本文に貼る ⑥ **`mock/js/data/portal/ui.js` の変更が `/* */` コメント内だけ**であること（reviewer が diff で確認） |
| **並列** | **PR-R4 と並列可**（`tools/**` と `mock/**`・`docs/**` で重ならない） |
| **ラベル** | `run:cloud` |

#### PR-R4 —— `verify.mjs` §18 新設・節番号の採番規則・CI 契約（R-P2 / R-P3 / R-P5）

| | |
|---|---|
| **触るファイル** | `tools/verify.mjs`（**§18 を新設**・冒頭コメントに「§13 は永久欠番」・注記 5 か所の集約）／`package.json`（`scripts.ci` を新設）／`.github/workflows/verify.yml`（ステップを `npm run ci` に寄せ、**管理番号 12 個のベタ書きを YAML から出す**）／`docs/handoff/README.md`（採番規則 1 行 ＋ 件数更新の 1 行） |
| **触らない** | **`package.json` の `scripts.test`（`node tools/verify.mjs && node tools/regress.mjs` のまま）と `dependencies`（ゼロのまま）** ← §2-14 案の土台／`mock/**`／`data/world/**`／`tools/regress.baseline.json` |
| **受け入れ条件** | ① §5-3 の 18-a〜18-d を実装し、**`portal/` が無い現時点では節ごと skip して PASS** ② **18-d が `mock/portal.html` で誤検知しない**ことをテストで示す（§5-3 の注意） ③ `npm run ci` が `.github/workflows/verify.yml` の現行 13 ステップと**同じ検査を同じ順で**回す（PR 本文に対応表） ④ 管理番号 12 個は `dify/env/**` か `tools/` 側から導く（**YAML に書かない**＝ S-3／G-1） ⑤ `npm test` PASS・**warn 件数は 17 から増えない** ⑥ `node tools/regress.mjs` 差分ゼロ ⑦ 採番規則「設計書は節番号を予約しない。implementer が実装済みの最大 ＋ 1 を取る」を `docs/handoff/README.md` に明記 |
| **並列** | **PR-R3 と並列可。PR-N1 とは直列**（どちらも `tools/verify.mjs` を触る） |
| **ラベル** | `run:cloud` |

#### PR-N1 —— `CLAUDE.md` の変更（**PM 承認が要る。文面は §6-5 にそのまま貼れる形で用意した**）

| | |
|---|---|
| **触るファイル** | `CLAUDE.md`（§6-5 の N1-1〜N1-9）／`README.md`（見出し `（4 区分）`→`（5 区分）`＋表に ⑤ の行）／`tools/verify.mjs`（666・690・692 行のリテラル 3 か所） |
| **触らない** | `CLAUDE.md` §2-1〜§2-12 の本文・§4 の分業表・§7 の `run:cloud`／`run:runner` の定義と秘密の 3 種（§6-5 N1-10）／`.claude/**`／`mock/**`／`data/world/**`／`tools/regress.baseline.json` |
| **受け入れ条件** | ① §6-5 の N1-1〜N1-9 を**すべて**当てる（一部だけ当てない） ② **`README.md`・`tools/verify.mjs` を同じ PR で変える**（片方だけだと verify §11-b が FAIL する） ③ `npm test` PASS ④ `node tools/regress.mjs` 差分ゼロ ⑤ **`CLAUDE.md` §6 に書く件数が `node tools/regress.mjs` の出力と一致**（PR 本文に貼る） ⑥ **§6-5 の「変更前」が当てる時点の実文と食い違ったら止めて PM に返す**（黙って直さない） ⑦ **PM の承認コメントを PR に紐づける**（`CLAUDE.md` は load-bearing） |
| **並列** | **直列**（`tools/verify.mjs` で PR-R4 と、`CLAUDE.md` で他のすべてと重なる） |
| **ラベル** | `run:cloud` |

#### PR-N2 —— `portal/` の新設と取り込み

| | |
|---|---|
| **触るファイル（新規）** | `portal/README.md`／`portal/CLAUDE.md`／`portal/package.json`／`portal/.nvmrc`／`portal/.env.example`／`portal/schema/{V001__init.sql,README.md}`／`portal/nocobase/{export/,docker/,plugins/}`／`portal/seed/**`（**生成物**）／`portal/env/{README.md,demo/portal.yml,prod/portal.yml}`／`portal/scripts/gen-seed.mjs`／`portal/tools/{check-nodata.mjs,check-seed-fresh.mjs,nodata.baseline.json,nodata-common-words.txt}`／`portal/docs/{nodata-known.md,split.md}`／`.github/workflows/portal-verify.yml` |
| **触るファイル（既存）** | `.gitignore`（`portal/node_modules/` を足す）／`package.json`（`scripts.portal:test` を足す。**`scripts.test` と `dependencies` は変えない**） |
| **触らない** | `mock/**`／`data/world/**`／`dify/**`／`tools/**`／`CLAUDE.md`（PR-N1 で済ませてある）／`.github/workflows/{verify.yml,pages.yml,dify-ops.yml}` |
| **中身の制約** | **定義と架空データだけ**。`portal/schema/` は素の PostgreSQL（NocoBase をやめても残る層）、`portal/nocobase/` は NocoBase 固有（やめたら捨てる）（§2-2）。方式 (a) の歯止め 3 つ（`DB_UNDERSCORED=true`／`DB_TABLE_PREFIX=nb_`／主キー型の明示）を `portal/schema/README.md` と `portal/nocobase/docker/.env.example` の**両方**に書く（§2-3） |
| **`shoulang0729/portal` PR #1 からの持ち込み** | **§7 の C-a〜C-e を全部満たすファイルだけ**。`seed/world/**` の 7 ファイルは**コピーせず `gen-seed.mjs` で 3 世界から生成し直す**。portal 側 `.github/workflows/verify.yml` は持ち込まず `portal-verify.yml` として書き直す。portal 側 `CLAUDE.md` の dify 抜粋は参照に置き換える |
| **受け入れ条件** | ① **ルート `npm test` PASS**（`portal/node_modules` が無い状態でも通る＝R1） ② **`npm run portal:test` PASS** ③ `node tools/verify.mjs` の **§18 が skip から実検査に変わって PASS**（18-a〜18-d） ④ **`node portal/tools/check-nodata.mjs` PASS**（走査範囲は `portal/**`。R-P4 の読み替え済み） ⑤ **`node portal/tools/check-seed-fresh.mjs` PASS**（`gen-seed.mjs` の再生成とバイト一致） ⑥ **`portal/docs/split.md` の `git subtree split --prefix=portal` を 1 回 dry-run し、結果（commit 数・生成ブランチ・`portal/` 単体で `npm test` が通ったか）を PR 本文に貼る**（S-7） ⑦ **実名・実 URL・秘密が 1 つも無い**ことを reviewer が全ファイル目視 ⑧ `node tools/regress.mjs` 差分ゼロ ⑨ `.github/workflows/pages.yml` の `path: mock` が不変（`portal/` は Pages に出ない） |
| **並列** | **直列**（PR-N1 の後。§18 が PR-R4 で入っていること・5 区分が PR-N1 で入っていることが前提） |
| **ラベル** | `run:cloud`（**docker を実際に起動するのは別 Issue で `run:mac`。本 PR は定義とファイルだけ**） |

#### PR-N3 —— `shoulang0729/portal` の後始末（**PR ではない。PM が GitHub 上で行う**）

| | |
|---|---|
| **操作** | ① PR #1 を **close**（マージしない）。close コメントに「内容は `shoulang0729/dify` の PR-N2（#<番号>）に取り込んだ。判断は `docs/handoff/2026-09-11-repo-layout-v3.md` §1・§7」 ② `README.md` の先頭に 1 行「このリポジトリは `shoulang0729/dify` の `portal/` に統合された」 ③ リポジトリを **archive（read-only）。削除しない**（過去の Issue／チャットのリンクを切らないため。`CLAUDE.md` §2-8 が `mock/` を改名しない理由と同じ） |
| **前提** | **PR-N2 がマージされていること。** 順序を逆にすると取り込み元が読めなくなる |
| **エージェントはやらない** | リポジトリ設定（archive・delete・visibility）の変更・他リポの PR の close |

### 9-2. 「この順でないと 2 度手間になる」箇所（rev2 で残るもの）

| 逆順にすると | 何が起きるか |
|---|---|
| **PR-N2 → PR-R4** | `portal/` が入った後に §18 を足すと、**既に壊れている状態からの修正**になる（`portal-verify.yml` の書き忘れ・ルート `package.json` への `dependencies` 混入を数 PR 気づかない） |
| **PR-N2 → PR-N1** | `CLAUDE.md`（PM 承認要）と数十ファイルの新規追加が 1 つの diff に入り、reviewer が load-bearing を照合できない |
| **PR-N1 → PR-R4** | どちらも `tools/verify.mjs` を触るので**必ず衝突する**。R-P3 の採番規則を先に入れておかないと、PR-N1 が §11-b のリテラルを触るときに節番号の注記と混ざる |
| **PR-N3 → PR-N2** | 取り込み元（PR #1）を archive してから取り込むことになり、C-a〜C-e の確認ができない |

### 9-3. 並列可否のまとめ

| 組 | 判定 | 理由 |
|---|---|---|
| **PR-R3 × PR-R4** | **並列可** | `mock/**`・`docs/demo/**`・`README.md` ／ `tools/**`・`package.json`・`.github/workflows/verify.yml`・`docs/handoff/README.md` でファイル集合が重ならない |
| **PR-R3 × PR-N1** | **直列**（PR-R3 が先） | `README.md` を両方が触る |
| **PR-R4 × PR-N1** | **直列**（PR-R4 が先） | `tools/verify.mjs` を両方が触る |
| **PR-N1 × PR-N2** | **直列** | 5 区分と §2-14 が入っていることが PR-N2 の前提 |
| **PR-N2 × 他の mock/dify 系 PR** | **並列可** | `portal/**` は新設ディレクトリで既存と重ならない（`.gitignore`・`package.json` の 1 行ずつだけ注意） |

---

## 10. PM 判断（**2026-09-11 に 7 件すべて確定。判断待ちは残っていない**）

| # | 論点 | **決定（PM 2026-09-11）** | 反映先 |
|---|---|---|---|
| **1** | 1 リポにするか | **(a) `dify/portal/` に取り込む。** 分岐条件 **X-2（GitLab 移行が半年以内に確実か）について PM は「確実ではない」と判断**したため、2 リポに戻す条件は成立しない | §0・§1-2・§2・§4 |
| **2** | 4 区分 → 5 区分にするか | **(a) ⑤ポータルを増やす。** `README.md` と `tools/verify.mjs` §11-b のリテラルを**同じ PR で**変える | §6-1・§6-2・**§6-5 N1-1**・PR-N1 |
| **3** | `CLAUDE.md` §2-14 を足してよいか | **足す。4 点だけ**（ポータルの中身は `portal/CLAUDE.md`）。**検出の節番号は §17 ではなく §18**（§0-2 D-3） | §6-3・**§6-5 N1-4**・PR-N1 |
| **4** | CI 契約のずれ（R-P2）をどう直すか | **(a) `npm run ci` を新設して `verify.yml` を数行にする。** 管理番号 12 個のベタ書きも YAML から出す | §8-1 R-P2・**§6-5 N1-5**・PR-R4 |
| **5** | ポータルモック Pages PR と IT 業 PR を並列にしてよいか | **決着済み（結果として直列で流れた）。** 両者とも `mock/index.html` を触ったため。**以後の並列可否は §9-3 の表が正** | §9-3 |
| **6** | GitLab へ切り出した後、GitHub に public ミラーを戻すか | **戻さない。** `shoulang0729/portal` は **archive のまま残す**（将来ミラーが要るときの器） | §4-3・§7 |
| **7** | `run:*` ラベルの 4 つ目を作るか | **作らない。** `run:mac` の定義文を「PM の手元でしか動かせないもの（ブラウザのログイン済みセッション／ローカル docker）」に広げる | §6-4・**§6-5 N1-7** |

**この 7 件は再度 PM に問い直さない。** 実装中に前提が崩れたら（§6-5 の「変更前」が実文と食い違う／`git subtree split` の dry-run が失敗する など）、**止めて PM に返す**（§9-1 の各受け入れ条件）。

### 10-1. 【rev2 新設】この先で新たに PM 判断が要るもの（**いまは判断を求めない。PR-N2 の直前に出す**）

| # | 論点 | いつ | architect の見立て |
|---|---|---|---|
| **N-a** | `portal/` に **NocoBase の定義エクスポート（JSON）をコミットするか**、DDL＋手順書だけにするか | PR-N2 の設計時 | **コミットする**（`portal/nocobase/export/`）。Community には Migration Manager が無いので、定義の移送はエクスポートを git に置く以外に手段が無い（§2-4） |
| **N-b** | `portal/` の docker を**誰の手元で動かすか**（`run:mac` で PM のみか、将来 runner を使うか） | 本番投入の検討時 | **当面 `run:mac` のみ**。セルフホストランナーは「入れない」が既存の判断（`CLAUDE.md` §7） |
| **N-c** | `data/world/dept`（自部門の世界）を新設するか、`data/world/it` を流用するか | PR-N2 の `gen-seed.mjs` を書くとき | **`data/world/it` を流用**（翠雲システムズ＝自部門の世界として既に 5 名・システム台帳まで入っている。新設すると 4 つ目の世界を維持することになる） |
---

## 11. 他の architect・implementer への申し送り（**rev2 で更新。本書は該当ファイルを触らない**）

**rev1 の申し送り 6 件のうち 4・5・6 は IT 業／ポータルモックの PR が流れたことで役目を終えた。** 残りと新規を書く。

| # | 宛先 | 状態 | 内容 |
|---|---|---|---|
| **1** | `2026-09-10-portal-nocobase.md`（rev3 が #256 でマージ済み） | **対応済み** | U-1（Community 確定）は rev3 で反映された（#256「Community 版・正本はポータル・モック確定の画面仕様を反映」）。**方式 (a) の歯止め C1〜C3 が生きていることを PR-N2 で確認する** |
| **2** | 同上 | **要確認** | rev2 §7-4-3 N1 の「31 名（mfg 17 ＋ fin 14）」は**実数とずれている。実数は 42 名（mfg 20 ＋ fin 17 ＋ it 5）**。**allowlist を人数で語らない書き方に直す**（PR-N2 で `gen-seed.mjs` が 3 世界から生成するので、人数は自動的に追随する） |
| **3** | 同上 | **本書が引き取る** | 「手コピー ＋ 出典行」は 1 リポで「**生成物 ＋ 鮮度検査**」に置き換わる（本書 §2-5）。`export:catalog`／`export:world` は**取り込み PR（PR-N2）で最初から作る**＝ `portal/scripts/gen-seed.mjs` |
| **4** | `2026-09-11-it-industry.md` | **完了** | 業種ハードコード 8 か所は #251 で解消（rev1 の指摘どおり IT 業 PR-1 の**前**に独立 PR で流れた） |
| **5** | 同上 | **完了** | `gen-index.mjs` の業種列は動的になり、`docs/service-map.md` は 3 列（製造／金融／IT）で再生成済み |
| **6** | `2026-09-11-portal-mock-pages.md` | **完了** | `mock/index.html` の件数記述は #265 で更新された。**ただし #269 で再びずれた**ので PR-R3 で参照化する（§8-3） |
| **7** | **【rev2 新設】`2026-09-11-portal-mock-pages.md`・`2026-09-11-sysops-usecase.md` の担当** | **依頼** | **`mock/portal.html` 系（①デモ）と、これから作る `portal/`（⑤ポータル）は別物である。** 文書で「ポータル」とだけ書くと読み手が取り違える。**`CLAUDE.md` §2-14 に用語の衝突を 1 行入れる**（§6-5 N1-4）。今後の設計書では**「部門ポータル（モック）」と「NocoBase ポータル（`portal/`）」を書き分ける**こと |
| **8** | **【rev2 新設】PR-R3 の implementer** | **依頼** | `mock/js/data/portal/ui.js` と `mock/js/portal/render.js` で触ってよいのは **`/* */` コメントだけ**。**`PSCREENS` の値・`PT` の辞書・描画関数に 1 バイトも触らない**（`tools/regress.mjs` と verify §17 が守っている範囲） |
| **9** | **【rev2 新設】PR-R4 の implementer** | **依頼** | 新節の番号は本書が **§18** と書いているが、**着手時点で `tools/verify.mjs` の実装済み最大を数え直して「最大 ＋ 1」を取る**（R-P3 の採番規則そのもの。設計書の番号を優先しない）。番号が変わったら PR 本文に 1 行書く |

---

## 12. 受け入れ条件（本 PR ＝ 設計書 rev2）

本 PR は設計書のみ。**機械検証の期待結果は「何も変わらない」こと。**

| # | 条件 | rev2 の実測（2026-09-11 `4a4f3d1` 上） |
|---|---|---|
| **A-1** | `node tools/verify.mjs` **PASS**（warn の件数が本 PR の前後で不変） | **PASS / warn 17 件**（rev1 は 16 件と書いていたが、その後 `portal.html` の未配置などで増えた。§0-2 D-7） |
| **A-2** | `node tools/regress.mjs` **PASS**（`mock/js/data/**` を 1 バイトも触らないので**差分ゼロ。`--update` 不要**） | **PASS**（`cats 15 / subs 35 / svcs 81 / tags 66 / ui 91`） |
| **A-3** | `npm test` **PASS** | **PASS** |
| **A-4** | `npm run world` の warn 件数が本 PR の前後で不変（CI 対象外） | **12 件**（製造 10／金融 1／IT 1。rev1 は 11 件と書いていた。§0-2 D-6） |
| **A-5** | diff が `docs/handoff/2026-09-11-repo-layout-v3.md` と `docs/handoff/repo-layout-v3.issue.md` の **2 ファイルのみ**（§0-1） | — |
| **A-6** | §11 に挙げた他 architect 担当の設計書に diff が無い | — |
| **A-7** | **【rev2 新設】実名・実 URL・秘密を 1 つも書いていない**（`CLAUDE.md` §2-10）。本書に出る固有名は架空世界（青嶺精工・碧洋銀行・翠雲システムズ）と OSS 名（NocoBase・PostgreSQL・Flyway）と自リポジトリ名だけ | — |
| **A-8** | **【rev2 新設】`CLAUDE.md` を 1 バイトも変えていない**（§6・§6-5 は**提案**。適用は PM 承認後の PR-N1） | — |

---

## 13. 用語

| 語 | 意味 |
|---|---|
| **1 リポ** | `shoulang0729/dify` の直下に `portal/` を置く案（本書の推奨） |
| **2 リポ** | `shoulang0729/portal` を別リポジトリとして維持する案（`2026-09-10-portal-nocobase.md` の初版・rev2 の結論） |
| **切り出し** | `git subtree split --prefix=portal` で `portal/**` の履歴を独立したリポジトリに抜き出すこと |
| **S-1〜S-7** | §4-2 の切り出し可能性の制約 |
| **R-I*／R-P*／L-*** | §8 のリファクタリング項目（I ＝ IT 業の前／P ＝ ポータル取り込みの前／L ＝ いつでも） |
| **PR-R1〜R4／PR-N1〜N3** | §9 の PR 番号（R ＝ リファクタリング／N ＝ NocoBase 取り込み） |
| **U-1〜U-4** | §1 冒頭の、2026-09-11 に PM から受領した前提の更新 |
| **X-1／X-2** | §1-2 の「2 リポに戻すべき分岐条件」（**X-2 は PM が「成立しない」と判断した**） |
| **⑤ポータル** | リポジトリ直下の `portal/`（NocoBase の定義・DDL・架空データ）。**`mock/portal.html`（①デモの部門ポータル概念モック）とは別物** |
| **部門ポータル（モック）** | `mock/portal.html`・`mock/js/portal/**`・`mock/js/data/portal/**`・`mock/css/portal.css`。**Pages に出る**。16 画面 |
| **D-1〜D-8** | §0-2 の「rev1 と main の現状のずれ」 |
| **N1-1〜N1-10** | §6-5 の `CLAUDE.md` 変更提案（PR-N1 でそのまま当てる文面） |
