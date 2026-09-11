# リポジトリ構成 v3 —— NocoBase ポータルの取り込み判断と、リファクタリングの棚卸し

- Issue: （未採番。`gh` が使えないため Issue 本文は `docs/handoff/repo-layout-v3.issue.md`）
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

## 0. 推奨と、その代償（5 行）

1. **1 リポに取り込む**ことを推奨する。`shoulang0729/dify` の直下に `portal/` を作り、`shoulang0729/portal` の中身をそこへ移す。
2. 分けた決定的理由 **R1（ランタイム境界）は「同じリポジトリ」ではなく「同じ `npm test` / 同じ `package.json`」の問題**であり、`portal/` を独立 npm プロジェクト＋独立ワークフローにすれば境界は引ける（§3）。
3. 得るもの：**`data/world/`・67 サービスのカタログ・管理番号→アプリ id の 3 本の手コピーが「生成物＋鮮度検査」に変わる**。CLAUDE.md・CI・Issue 番号の二重管理が消える（§1）。
4. **代償は 1 つだけ：GitLab へ出す日に `git subtree split --prefix=portal` を 1 回打つ必要がある。** 恒常コスト（毎週の手コピー）を一回コスト（切り出し 1 回）に替える取引である（§4）。
5. その代償を確実に払えるよう、**切り出し可能性の制約 S-1〜S-7 を初日から効かせる**（§4-2）。これを守らないと 1 リポは罠になる。

---

## 0-1. 触らない範囲（reviewer の diff 監査の基準）

本 PR で変更するのは次の 2 ファイルだけ。**新規追加のみ。**

- `docs/handoff/2026-09-11-repo-layout-v3.md`（本書）
- `docs/handoff/repo-layout-v3.issue.md`（Issue 本文）

触らない：

| 対象 | 判断 |
|---|---|
| `mock/**` | **1 バイトも変えない。** データ層（`CATS`/`SVCS`/`TAGS`/`SCENARIOS`/`HOME`/`FEED`/`LIVE`）不変 → **`tools/regress.mjs` は差分ゼロ。`--update` 不要** |
| `tools/**`・`tools/regress.baseline.json`・`scripts/**` | 変えない（§8 は**提案**であって本 PR の実装ではない） |
| `dify/**`・`data/world/**` | 変えない |
| `.github/workflows/**` | 変えない（特に `pages.yml` の `path: mock`。`CLAUDE.md` §2-8） |
| `CLAUDE.md`・`README.md`・`.claude/**` | **変えない。** §6 は提案。適用は PM 承認後の別 PR |
| `docs/handoff/2026-09-10-portal-nocobase.md`／`2026-09-11-nocobase-research.md`／`portal-nocobase.issue.md`／`2026-09-11-it-industry.md`／`it-industry.issue.md`／`2026-09-11-portal-mock-pages.md`／`portal-mock-pages.issue.md` | **他の architect が並行編集中。読むだけ。申し送りは §11** |

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
| **G** | **ほかに二重になるもの** | 無し | ① 67 サービスのカタログ（JSON 1 本の手コピー）② 管理番号 → Dify アプリ id（`dify/env/*/env.yml` の `apps:` の手コピー）③ `.gitignore`・`package.json`・`.nvmrc` ④ 3 エージェント分業と Git 運用の文面 ⑤ **Issue / PR 番号が 2 系統**（`portal-nocobase.md` rev2 §7-7-3 G-6 が既に「出自を明記せよ」と回避策を書いている＝痛みが出ている証拠） | **1 リポが有利** |
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

**X-1 は §3 の設計で満たせる（`portal/package.json` を別に置くだけ）。X-2 は PM しか判断できない**（§10 判断 1）。

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
├── data/world/                      ④ダミーデータ（正本。mfg / fin /（IT 業 PR で）it /（portal で）dept）
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
| `verify.yml`（既存） | `pull_request` / `push: main`（**`paths` フィルタを足さない**） | 現状のまま（11 ステップ） | **無変更** |
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

### 5-3. ルート `verify.mjs` に足す 1 節（§17）

**`portal/` を取り込んだときに壊れうる 4 点だけを見る。増やさない。**

| # | 検査 | 判定 |
|---|---|---|
| **17-a** | `portal/` が存在するなら `.github/workflows/portal-verify.yml` が実在し、`paths:` に `portal/**` を含む | FAIL |
| **17-b** | ルート `package.json` に `dependencies` が無く、`scripts.test` が `node tools/verify.mjs && node tools/regress.mjs` のまま（**§2-3 の「ビルド不要」の土台**） | FAIL |
| **17-c** | `portal/package.json` が実在し、ルートの `package.json` を参照していない（S-2） | FAIL |
| **17-d** | `pages.yml` の `path:` が `mock` のまま（**既存の §8 で検査済み**）＋ **`mock/` 配下から `portal/` を参照するリンクが無い**（Pages に出ない範囲を参照しない） | FAIL |

`portal/` が無ければ**節ごと skip**（`dify/samples/` を見る §16 と同じ作法）。**取り込み前にこの節を先に入れておける**（§9 PR-R4）。

---

## 6. `CLAUDE.md` への提案（**PM 承認が要る。architect は書き換えない**）

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

---

## 7. `shoulang0729/portal` リポジトリをどうするか

**1 リポにする場合**（推奨）：

| # | 対象 | 扱い |
|---|---|---|
| **1** | **中身（`CLAUDE.md`・`README.md`・`package.json`・`.gitignore`・`.env.example`・`tools/check-nodata.mjs`・`tools/nodata-common-words.txt`・`tools/nodata.baseline.json`・`seed/world/`・`docs/nodata-known.md`・`.github/workflows/verify.yml`）** | **ファイルをコピーして dify リポの `portal/` に新規 commit で置く。履歴は持ち込まない**（`git subtree add` を使わない）。理由：portal リポの履歴は 2 commit しかなく、持ち込むと将来の `subtree split` の履歴が汚れる。出自は取り込み PR の commit message と `portal/README.md` に書けば足りる |
| **2** | **PR #1（`feat/portal-skeleton`）** | **マージせず close。** close コメントに「内容は `shoulang0729/dify` の取り込み PR（#<番号>）に取り込んだ。判断は `docs/handoff/2026-09-11-repo-layout-v3.md` §1」と書く |
| **3** | **リポジトリ本体** | **取り込み PR がマージされたあとに archive（read-only）。削除しない。** 過去の Issue / チャットからのリンクが切れないようにするため（`CLAUDE.md` §2-8 が `mock/` を改名しない理由と同じ考え方）。`README.md` の先頭に 1 行「このリポジトリは `shoulang0729/dify` の `portal/` に統合された」 |
| **4** | **`seed/world/` の中身** | **そのままコピーせず、`portal/scripts/gen-seed.mjs` で `data/world/**` から生成し直す**（§2-5）。手コピーの出典行はここで役目を終える |
| **5** | **`tools/check-nodata.mjs`** | コピーしたうえで **走査範囲を `portal/**` に読み替える**（§8 R-P5）。G1（トップレベル構造の allowlist）は「リポジトリのトップレベル」→「`portal/` 直下」に読み替える |

**2 リポのままにする場合**：PR #1 をレビューしてマージし、`portal-nocobase.md` rev2 §12-2 の PR-A → PR-B → PR-C に進む。ただし **U-1（Community 確定）により rev2 §4-11 の決定（Professional ＋ 方式 (b)）が成り立たないので、PR-A の前に rev2 の改訂が要る**（§11 申し送り 1）。

---

## 8. リファクタリングの棚卸し（**1 リポ / 2 リポの判断と独立**）

**並び順は「IT 業追加・ポータル取り込みの前にやらないと 2 度手間になるもの」が上。**
優先度：**P0 ＝ IT 業 PR より前／P1 ＝ ポータル取り込みより前／P2 ＝ いつでも（動いているものを綺麗にするだけ）**

### 8-1. 一覧

| # | 項目 | 優先 | なぜ今か（2 度手間の中身） | どの PR |
|---|---|---|---|---|
| **R-I1** | **`tools/**` の業種ハードコードを `INDUSTRIES` 駆動にする**（下表 8 か所） | **P0** | IT 業 PR がデータを足した瞬間に **`regress.mjs` の検算 `svcsMfg + svcsFin − svcsBoth === svcs` が FAIL する**（3 集合に包除原理が効かない）。順序を逆にすると、IT 業 PR で `['mfg','fin','it']` と 3〜8 か所書き足し、直後の整理でそれを全部消すことになる | **PR-R1**（IT 業 PR-1 の**前**） |
| **R-I2** | **`regress.baseline.json` の `counts` を業種 map に移行**（`svcsMfg`/`svcsFin`/`svcsBoth`/`catsMfg`/`catsFin` → `byIndustry: {mfg:…, fin:…}` ＋ `svcsMulti`） | **P0** | R-I1 と同じ PR でやる。**件数の値は 1 つも変えずにスキーマだけ変える**ので、reviewer は「13/29/67/49/29/11/10/8 が保たれている」だけ確認すればよい。IT 業 PR-1 と混ぜると「スキーマ変更」と「件数変更」が同じ diff に出て読めなくなる | **PR-R1**（`--update` は 1 回。PR 本文に「設計書 §8 R-I2 に伴う基準更新。件数は不変」と書く） |
| **R-I3** | **`data/world/README.md` の人数記述を実数に**（mfg 17 → **20**／fin 14 → **17**）＋**「未統一」の件数を 10 → 11 に**（`npm run world` の実測は 11 件） | **P0** | IT 業が `data/world/it/` を足すとき README の表に行が増える。ずれたまま足すと「どの数字が正か」が分からなくなる。**`CLAUDE.md` §2-13 の「現状 10 件」も同時に直す**（PM 承認要） | **PR-R2**（PR-R1 と並列可。ファイル集合が重ならない） |
| **R-I4** | **件数（13 分類 29 中分類 67 サービス）の手書きが 8 ファイルに散在** | **P0** | IT 業で全部ずれる。うち **`mock/index.html` は GitHub Pages に出る＝顧客が読む**。散ったまま IT 業 PR を流すと、顧客提示資料が古い数字のまま公開される | **PR-R3**（方針決め）＋ IT 業 PR-6 の受け入れ条件（数字更新） |
| **R-P1** | **`CLAUDE.md` 4 区分 → 5 区分 ＋ `README.md` ＋ `verify.mjs` §11-b のリテラル**（§6-2） | **P1** | 3 ファイル同時。ポータル取り込み PR に混ぜると、**PM 承認が要る `CLAUDE.md` の変更と大量の新規ファイルが 1 つの diff に入り reviewer が読めない** | **PR-N1**（取り込みの直前） |
| **R-P2** | **CI の契約のずれ**：`CLAUDE.md` §3 の「`npm test` ＝ CI の verify ワークフローと同じ」が**事実と違う**（CI は 11 ステップ：`dify/check.py`・`render.py --check`・python テスト 3 本・`run_tests.py --dry-run`）。さらに `verify.yml` の最終ステップに**管理番号 12 個がベタ書き** | **P1** | ポータルを足す前に「ルート `npm test` が見る範囲」を確定しないと、`portal/` の検査がどちらの箱に乗るか決まらない（§5-2）。管理番号のベタ書きは **GitLab 移行の G-1（CI のロジックを YAML に書かない）違反**でもある | **PR-R4**（`npm run ci` を新設して YAML を 1 行にする、または `CLAUDE.md` §3 の記述を事実に合わせる。**どちらにするかは §10 判断 4**） |
| **R-P3** | **`tools/verify.mjs` の節番号の採番規則**：**§13 が永久欠番**（#121 W2 の予約が使われないまま）、**設計書と実装で番号が食い違う注記がコード中に 5 か所**（§14／§15／§16 の各ヘッダ） | **P1** | IT 業とポータルで §17・§18 を足す前に規則を決める。いま決めないと注記が 7 か所に増える | **PR-R4** |
| **R-P4** | **`portal/` 取り込み時の `check-nodata.mjs` の読み替え**（走査範囲を `portal/**` に限定。G2 の `*.sql` は `portal/schema/` だけ許可、G3 の `*.csv` は `portal/seed/` だけ許可、N4/N5/N6 は `portal/**` 限定。**G4 だけはリポジトリ全体**） | **P1** | そのままコピーすると **`data/world/**` の CSV と `docs/**` の URL で大量 FAIL する**。取り込み PR の中でやる | **PR-N2** |
| **R-P5** | **`verify.mjs` §17（17-a〜17-d）の新設**（§5-3） | **P1** | 取り込み**前**に入れておけば、`portal/` が無い間は skip、取り込んだ瞬間から効く。後から入れると「既に壊れている状態」から始まる | **PR-R4**（取り込み前） |
| **L-1** | **`CLAUDE.md` §6 バックログの棚卸し** — ① **`top.html` は既に削除済み**（`mock/` に無い）② **`?v=` キャッシュスタンプは 1 つも存在しない**（`catalog.html` の `<script src>` は素のパス）ので「機械検証」の対象が無い ③ `tools/bundle.mjs`（単一ファイル生成）は `top.html` 廃止で目的が消えた | **P2** | 実害は無いが、**次に読む人が「まだやることが残っている」と誤解する**。IT 業とポータルで §6 をどのみち触るので、そのついでに | **PR-R3**（R-I4 と同じ PR。どちらも `CLAUDE.md` §6） |
| **L-2** | **`scenarios/` の 1 サービス 1 ファイル化**（§6 の P3 候補） | **P2** | **やらないことを明記する**を推奨。現状の最大は `mfg/dc.js` 373 行・`mfg/pt.js` 353 行で、まだ痛くない。IT 業で `scenarios/it/` が増えても 1 ファイルあたりは小さい。**閾値（1 ファイル 600 行）を書いて先送りする**方が、判断を毎回やり直すより安い | **PR-R3** |
| **L-3** | **`tools/verify.mjs` 1219 行の分割** | **P2** | **分割しない**を推奨。§9 の理由（下） | — |
| **L-4** | **`mock/js/render.js` 847 行**（①②③ の描画が 1 ファイル） | **P2** | パターンは 3 つで打ち止め（§2-3）。分ける理由が無い | — |

### 8-2. R-I1 の対象（8 か所。IT 業 architect が挙げた 5 か所 ＋ 本書で追加した 3 か所）

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

**注意**：7 は `docs/service-map.md` の列構成を変えるので、**`npm run index` の再生成が必要**（verify §11-a が FAIL する）。PR-R1 に含める。

### 8-3. R-I4 の対象（件数の手書き 8 ファイル）と推奨方針

| ファイル | 現在の記述 | 推奨 |
|---|---|---|
| `CLAUDE.md` §6（157 行） | 「現在は **13 分類 29 中分類 67 サービス**（製造 49／金融 29／両業種 11、提供中 12／試行版 29／構想 26）」 | **数字を残す**（PM とエージェントが最初に読む場所）。IT 業 PR で更新 |
| `mock/index.html:265` | 「**67 サービスすべて**で動きます」「**「提供中」12 件**」 | **数字を残す**（顧客が読む）。IT 業 PR で更新 |
| `docs/demo/briefing-catalog.md:10,17` | 「**13 分類・29 中分類・67 サービス**」「## 2. 13 分類の意味と 29 中分類」 | **数字を残す**（顧客提示資料。数字が無いと意味をなさない）。IT 業 PR で更新 |
| `docs/demo/briefing-coverage.md:33` | 「67 サービス全体を…7 つの波」 | 同上 |
| `README.md:16` | 「67 サービスの詳細ユースケース」 | **数字を消し**「全サービスの詳細ユースケース」に。最新は `docs/service-map.md`（生成物） |
| `mock/README.md:14` | 「業種2（製造・金融）×大分類13×中分類29×67サービス」 | **数字を消し**「業種・大分類・中分類・サービスの構成は `docs/service-map.md`（生成物）を参照」に |
| `docs/dify/README.md:3,23` | 「13 分類・67 サービス」「**67 サービスの一覧**」 | **数字を消す**（`usecases/README.md` が一覧の正本） |
| `docs/dify/implementation-guide.md:3` | 「カタログ 13 分類 67 サービス」 | **数字を消す** |

**方針：「現在を語る場所」を 4 つに絞る**（`CLAUDE.md` §6・`mock/index.html`・`docs/demo/briefing-*.md` の 2 本）。残り 4 ファイルは `docs/service-map.md` への参照に置き換える。

**機械検査は足さない**（「`\d+ 分類` がデータと一致」は誤検知が多く、`briefing-*.md` の文脈依存の数字まで拾う）。代わりに **IT 業 PR-6 の受け入れ条件に「上記 4 ファイルの数字を更新した」を明記する**。

### 8-4. L-3（`verify.mjs` の分割）を推奨しない理由

節は 1〜16（§13 は欠番）で 1219 行。**節ごとにファイルへ分けるのは推奨しない。**

- 各節は `mock`（`loadMock()` の戻り値）・`allJsText`・`appText`・`ok`/`fail`/`warn` を**共有している**。分割すると引数の受け渡しかグローバルな context オブジェクトが要り、**読みやすさは上がらず、検査の意味が変わるリスクだけが増える**
- 「1 ファイルで上から読むと全部の検査が分かる」は**エージェントが読む前提では利点**である
- 節が増え続けること自体は問題ではない。**問題は採番が Issue の着手順で衝突していること**（R-P3）

**代わりにやること（R-P3。意味を 1 バイトも変えない）**：

1. 冒頭のコメントに **「§13 は永久欠番（Issue #121 W2 用に予約されたまま使われなかった）」** を 1 行で明記する
2. **§14／§15／§16 のヘッダに散っている「設計書は §X としているが…」という同じ趣旨の注記 5 か所を、冒頭の 1 か所に集約する**
3. **採番規則を決める**：**設計書は節番号を予約しない。implementer が実装時に「実装済みの最大 ＋ 1」を取る。設計書には「新しい節（番号は実装時に決める）」と書く。** `docs/handoff/README.md` の「設計書に必ず書くこと」に 1 行足す

---

## 9. 流す順番（2 度手間が出ない並び）

```
                        ┌─ PR-R1  tools/** 業種ハードコード除去 ＋ regress baseline スキーマ移行
                        │         （件数は不変。--update 1 回。npm run index の再生成を含む）
  【P0：IT 業の前】 ────┤
                        └─ PR-R2  data/world/README.md の人数 20/17・未統一 11 件
                                  （PR-R1 と並列可。ファイル集合が重ならない）
                                            │
                                            ▼
  【IT 業】  IT 業 PR-1 ─→ PR-2 ─→ PR-3 ─→ PR-4 ─→ PR-5 ─→ PR-6
             （別 architect の設計。直列。PR-6 の受け入れ条件に §8-3 の 4 ファイルの数字更新を含める）
                                            │
              ┌─────────────────────────────┤（mock/index.html を IT 業 PR-6 が触るなら直列。
              │                             │  触らないなら並列可）
              ▼                             ▼
  【モック】 ポータルモック Pages PR      PR-R3  CLAUDE.md §6 の棚卸し ＋ 件数の参照化
             （mock/portal.html。               （L-1・L-2・R-I4 の残り 4 ファイル）
              別 architect の設計）              ※ CLAUDE.md を触るので PM 承認が要る
                                            │
                                            ▼
  【P1：取り込みの前】  PR-R4  verify.mjs §17 新設 ＋ 節番号の採番規則 ＋ CI 契約のずれ（R-P2/R-P3/R-P5）
                                            │
                                            ▼
                        PR-N1  CLAUDE.md 4 区分 → 5 区分（＋ README.md ＋ verify §11-b）※ PM 承認
                                            │
                                            ▼
  【取り込み】          PR-N2  portal/ 取り込み（skeleton のコピー ＋ check-nodata の範囲読み替え
                               ＋ gen-seed.mjs ＋ portal-verify.yml ＋ split.md の dry-run 記録）
                                            │
                                            ▼
                        PR-N3  portal リポを archive ／ PR #1 を close（GitHub 操作。PR ではない）
```

### 9-1. 「この順でないと 2 度手間になる」箇所

| 逆順にすると | 何が起きるか |
|---|---|
| IT 業 PR → PR-R1 | IT 業 PR で `['mfg','fin','it']` を **8 か所**書き足し、直後の PR-R1 で全部消す。さらに **IT 業 PR の途中で `regress` の検算が FAIL する**ので、検算を壊した状態で通すか、IT 業 PR の中で検算式を直すことになる（＝ PR-R1 の一部が IT 業 PR に混ざり、差分が読めなくなる） |
| IT 業 PR → PR-R2 | `data/world/README.md` に `it` の行を足すとき、隣の mfg/fin の行が間違ったままになる。あとで直すと「IT 業 PR が壊した」ように見える |
| 取り込み PR → PR-R4 | `portal/` が入った後に §17 を足すと、**既に壊れている状態からの修正**になる（`portal-verify.yml` を書き忘れたまま数 PR 進む） |
| 取り込み PR → PR-N1 | `CLAUDE.md`（PM 承認要）と数十ファイルの新規追加が 1 つの diff に入る。reviewer が load-bearing の照合をできない |
| PR-R3 を IT 業より前 | 件数を更新する場所を減らしても、**IT 業 PR で結局その 4 ファイルを触る**。順序は逆でも害は無いが、IT 業の後にやる方が「更新すべき数字」が確定していて安い |

### 9-2. 並列可否

- **PR-R1（`tools/**`）と PR-R2（`data/world/README.md`）** — 並列可
- **ポータルモック Pages PR（`mock/portal.html`・`pages.yml`?）と IT 業 PR（`mock/js/data/**`）** — **別ファイルなら並列可**（`CLAUDE.md` §5）。ただし**両方が `mock/index.html` を触るなら直列**。→ §10 判断 5
- **PR-R4（`tools/verify.mjs`）と IT 業 PR（`tools/**` も触る）** — **直列**（PR-R1 と PR-R4 はどちらも `tools/verify.mjs` を触る）

---

## 10. PM 判断待ち（推奨つき）

| # | 論点 | 選択肢 | **architect の推奨** |
|---|---|---|---|
| **1** | **1 リポにするか** | (a) `dify/portal/` に取り込む (b) `shoulang0729/portal` のまま | **(a)。** 代償は GitLab 切り出し 1 回（§4）。**分岐条件 X-2（GitLab 移行が半年以内に確実か）だけは PM しか判断できない。確実なら (b)** |
| **2** | **4 区分 → 5 区分にするか** | (a) ⑤ポータルを増やす (b) `portal/` を②実装ソースに入れる | **(a)。** 検証の箱が違うので地図に出す必要がある（§6-1）。**`README.md` と `verify.mjs` §11-b のリテラルを同じ PR で変える**（§6-2） |
| **3** | **`CLAUDE.md` §2-14 を足してよいか**（load-bearing に 1 項） | 足す／足さない | **足す。4 点だけ**（§6-3）。ポータルの中身（スキーマ・画面・ロール）は load-bearing に入れず `portal/CLAUDE.md` に置く |
| **4** | **CI 契約のずれ（R-P2）をどう直すか** | (a) `npm run ci` を新設して `verify.yml` を数行にする (b) `CLAUDE.md` §3 の記述を事実に合わせるだけ | **(a)。** GitLab 移行の G-1（CI のロジックを YAML に書かない）に沿うし、**管理番号 12 個のベタ書き**が YAML から消える。(b) は安いが同じ作業を後でやることになる |
| **5** | **ポータルモック Pages PR と IT 業 PR を並列にしてよいか** | 並列／直列 | **両者が `mock/index.html` を触るかで決まる。触るなら直列。** 触らないなら並列可。**PM が両 architect の設計書を見て判断する**（本書からは確認できない） |
| **6** | **GitLab へ切り出した後、GitHub に public ミラーを戻すか** | 戻す／戻さない | **戻さない。** U-2（部門内に閉じる）＋ U-3（顧客提示は `mock/portal.html`）により、ポータル実装を public に見せ続ける動機が無い。**`shoulang0729/portal` は archive のまま残す**（将来ミラーが要るときの器） |
| **7** | **`run:*` ラベルの 4 つ目を作るか** | 作る／作らない | **作らない。** `run:mac` の定義文を「PM の手元でしか動かせないもの（ブラウザのログイン済みセッション／ローカル docker）」に広げる（§6-4） |

---

## 11. 他の architect への申し送り（**本書は該当ファイルを触らない**）

| # | 宛先 | 内容 |
|---|---|---|
| **1** | `2026-09-10-portal-nocobase.md`（rev2 担当） | **U-1（NocoBase Community 確定・Professional は買わない）により rev2 §4-11 の決定「デモも本番も Professional ＋ 方式 (b)」が成り立たない。** 連鎖して §0-2（認証＝Auth: LDAP）・§0（定義の移送＝Migration Manager）・§4-5 の決着・§8-5 のブロッカー（Professional の購入）・§11-9 が影響を受ける。**方式 (a) に戻る場合の歯止め（C2：`DB_UNDERSCORED`/`DB_TABLE_PREFIX`/主キー型）は rev2 §3-5 に既に書かれているので、そこが生きる** |
| **2** | 同上 | **§7-4-3 N1 の「31 名（mfg 17 ＋ fin 14）」は実数とずれている。実数は 37 名（mfg 20 ＋ fin 17）**（`data/world/{mfg,fin}/people.csv` を実測）。allowlist を人数で語らない書き方に直すのが安全 |
| **3** | 同上 | **§6-1／§6-7 の「手コピー ＋ 出典行」は、1 リポになると「生成物 ＋ 鮮度検査」に置き換わる**（本書 §2-5）。§12-3 の「PR-X `export:catalog`／`export:world`（痛くなったら作る）」は**取り込み PR で最初から作ることになる** |
| **4** | `2026-09-11-it-industry.md` | **`tools/**` の業種ハードコードは 5 か所ではなく 8 か所**（`gen-index.mjs` の 2 列固定と `check-world.mjs` のバケット固定を追加。本書 §8-2）。**PR-R1 として IT 業 PR-1 の前に独立 PR で流すこと**を推奨（理由は §9-1）。`regress.baseline.json` の `counts` スキーマ変更（`--update` 1 回）も PR-R1 に含める |
| **5** | 同上 | `tools/gen-index.mjs` の業種列を動的にすると **`docs/service-map.md` の列構成が変わり `npm run index` の再生成が要る**（verify §11-a が FAIL する）。PR-R1 の受け入れ条件に入れること |
| **6** | `2026-09-11-portal-mock-pages.md` | **`mock/index.html` の件数記述（265 行「67 サービスすべて」「提供中 12 件」）を IT 業 PR も触る可能性がある。** 両方が触るなら直列（§10 判断 5） |

---

## 12. 受け入れ条件（本 PR）

本 PR は設計書のみ。**機械検証の期待結果は「何も変わらない」こと。**

| # | 条件 |
|---|---|
| **A-1** | `node tools/verify.mjs` **PASS**（warn の件数は本 PR の前後で不変。現状 16 件） |
| **A-2** | `node tools/regress.mjs` **PASS**（`mock/js/data/**` を 1 バイトも触らないので**差分ゼロ**。**`--update` は不要**） |
| **A-3** | `npm test` **PASS** |
| **A-4** | `npm run world` の warn 件数が本 PR の前後で不変（現状 11 件。CI 対象外） |
| **A-5** | diff が `docs/handoff/2026-09-11-repo-layout-v3.md` と `docs/handoff/repo-layout-v3.issue.md` の **2 ファイル新規追加のみ**（§0-1） |
| **A-6** | §11 に挙げた 7 ファイル（他 architect の担当）に diff が無い |

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
| **X-1／X-2** | §1-2 の「2 リポに戻すべき分岐条件」 |
