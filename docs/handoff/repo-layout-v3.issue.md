# リポジトリ構成 v3 —— NocoBase ポータルを 1 リポに取り込む（**PM 決定済み**）と、リファクタリングの棚卸し

- **設計書**: [`docs/handoff/2026-09-11-repo-layout-v3.md`](./2026-09-11-repo-layout-v3.md) **rev2（2026-09-11 夕。PM 決定を反映して確定）**
- **ラベル**: `run:cloud`
- **種別**: M/L
- **関連**: #84（構成 v2）・#242（ポータル分離）・#251（業種ハードコード除去）・#255〜#264（IT 業）・#252/#260/#267/#271（ポータルモック）・#265/#275（件数訂正）・#266〜#274（システム運用）／設計書 `2026-09-10-portal-nocobase.md`・`2026-09-11-nocobase-research.md`・`2026-09-11-it-industry.md`・`2026-09-11-portal-mock-pages.md`

---

## 1. 決定（PM 2026-09-11）

- **`shoulang0729/portal` を `shoulang0729/dify` の `portal/` に取り込む（1 リポ）。**
- 分岐条件 **X-2「GitLab 移行が半年以内に確実か」について PM は「確実ではない」と判断**した。X-1（独立 npm プロジェクトにできるか）は設計で満たせる。**したがって 2 リポに戻す条件はどちらも成立しない。**
- 分けた決定的理由 **R1（ランタイム境界）は「同じ `npm test` / 同じ `package.json`」の問題**であり、独立 npm プロジェクト＋独立ワークフローで境界は引ける（設計書 §3）。
- **代償は GitLab へ出す日の `git subtree split --prefix=portal` 1 回だけ。** 恒常コスト（3 本の手コピー・文書の二重管理・Issue 番号の 2 系統）を一回コストに替える取引。
- **設計書 §10 の PM 判断待ち 7 件はすべて推奨どおりで確定した。判断待ちは残っていない。**

| # | 論点 | 決定 |
|---|---|---|
| 1 | 1 リポにするか | **する**（`dify/portal/`） |
| 2 | 4 区分 → 5 区分 | **⑤ポータルを増やす**（`README.md`・`verify.mjs` §11-b も同じ PR で） |
| 3 | `CLAUDE.md` §2-14 を足すか | **足す（4 点だけ）**。検出の節番号は **§18**（§17 は使用済み） |
| 4 | CI 契約のずれの直し方 | **`npm run ci` を新設して YAML を数行にする** |
| 5 | ポータルモック PR と IT 業 PR の並列 | **決着済み（結果として直列で流れた）**。以後は設計書 §9-3 が正 |
| 6 | 切り出し後 GitHub に public ミラーを戻すか | **戻さない。`shoulang0729/portal` は archive のまま残す** |
| 7 | `run:*` ラベルの 4 つ目 | **作らない。`run:mac` の定義文を広げる** |

---

## 2. rev1 と main の現状のずれ（rev2 で直した。設計書 §0-2）

rev1 は 2026-09-11 昼の執筆で、その後 main が動いた。**判断は 1 つも覆っていないが、数字と節番号が変わった。**

| # | rev1 | **現状（`4a4f3d1`）** |
|---|---|---|
| D-1 | 13 分類 29 中分類 67 サービス | **15 分類 35 中分類 81 サービス**（製造 49／金融 29／IT 25、複数業種 11、提供中 12／試行版 29／構想 40、TAGS 66） |
| D-2 | `data/world/` は 2 世界 | **mfg / fin / it の 3 世界**（人物 20 / 17 / 5）＋ IT だけ社名・拠点名の跨ぎを例外として許可 |
| D-3 | `verify.mjs` の新節は §17 | **§17 は部門ポータル契約が使用済み → 新節は §18** |
| D-4 | `verify.mjs` 1219 行 | **1506 行**（L-3「分割しない」の判断は不変） |
| D-5 | CI 11 ステップ | **13 ステップ**。`verify.yml:60` の管理番号 12 個ベタ書きは健在 |
| D-6 | `npm run world` warn 11 件 | **12 件**（mfg 10／fin 1／it 1） |
| D-7 | `verify.mjs` warn 16 件 | **17 件** |
| D-8 | — | **`mock/portal.html` は 16 画面**（`PSCREENS`）。`SVCS[].place` は 81 件すべてに付き、画面配置 63・`out` 18 |

---

## 3. 棚卸しの消化状況（設計書 §8-1）

| # | 項目 | 状態 | 残り |
|---|---|---|---|
| **R-I1** | `tools/**` の業種ハードコード 8 か所 → `INDUSTRIES` 駆動 | **済（#251）** | — |
| **R-I2** | `regress.baseline.json` の `counts` を業種 map に | **済（#251）** | — |
| **R-I3** | `data/world/README.md` の人数・未統一件数 | **済** | `CLAUDE.md` §2-13 の「現状 10 件」→ **12 件** だけ残る（PR-N1） |
| **R-I4** | 件数の手書きが散在 | **一部済（#265／#275）** | **#269 で再びずれた。** 参照化して「数字を語る場所」を 4 つに絞る（PR-R3） |
| **R-I5** | **【新規】ポータル画面数「15 画面」が 5 か所**（実数 16） | **未** | PR-R3 |
| **R-P1** | 4 区分 → 5 区分（`CLAUDE.md`＋`README.md`＋`verify.mjs` §11-b） | **未** | PR-N1 |
| **R-P2** | CI 契約のずれ（`npm test` ＝ CI ではない・管理番号ベタ書き） | **未** | PR-R4（`npm run ci` 新設） |
| **R-P3** | `verify.mjs` の節番号（§13 永久欠番・注記 5 か所） | **未** | PR-R4 |
| **R-P4** | `check-nodata.mjs` の走査範囲を `portal/**` に読み替え | **未** | PR-N2 |
| **R-P5** | `verify.mjs` の新節（4 検査） | **未**（**§17 → §18 に繰り下げ**） | PR-R4 |
| **L-1** | `CLAUDE.md` §6 バックログ棚卸し（`top.html` 削除済み・`?v=` 不存在・`bundle.mjs` 目的消滅） | **未** | PR-N1 |
| **L-2** | `scenarios/` の 1 サービス 1 ファイル化 | **やらないと明記**（閾値 600 行。現状最大 373 行） | PR-N1 |
| **L-3** | `verify.mjs` の分割 | **分割しない（維持）** | — |
| **L-4** | `render.js` 847 行の分割 | **分割しない（維持）** | — |

---

## 4. 実装 PR の分割と順番（設計書 §9。**確定版・残り 5 本**）

```
PR-R3  件数・画面数の参照化（R-I4 / R-I5）      ─┐ 並列可
PR-R4  verify.mjs §18 ＋ 節番号規則 ＋ npm run ci ─┘
            ↓（PR-R4 が先）
PR-N1  CLAUDE.md 5 区分 ＋ §2-14 ＋ 件数 ＋ industry 値域 ＋ 3 世界 ＋ §6 棚卸し  ※ PM 承認
            ↓
PR-N2  portal/ の新設と取り込み
            ↓
PR-N3  shoulang0729/portal の PR #1 を close ／ リポジトリを archive（GitHub 操作。PM が行う）
```

### PR-R3 —— 件数・画面数の参照化

- **触る**：`mock/index.html`（148・163・208-210）／`mock/README.md`（14・15・56）／`docs/demo/briefing-catalog.md`（10・17・36）／`docs/demo/briefing-coverage.md`（41・42）／`README.md`（16）／`mock/js/data/portal/ui.js`（14・122 の**コメントだけ**）／`mock/js/portal/render.js`（2 の**コメントだけ**）
- **触らない**：`mock/js/data/**` のデータ本体（`CATS`/`SVCS`/`TAGS`/`SCENARIOS`/`HOME`/`FEED`/`LIVE`/`PSCREENS` の値）・`CLAUDE.md`・`tools/**`
- **受け入れ条件**：設計書 §8-3 の表どおり／**`regress` 差分ゼロ（`--update` 不要）**／`verify` PASS・**warn 17 件で不変**／数字が `node tools/regress.mjs` の出力と一致することを PR 本文に貼る／`portal/ui.js`・`render.js` の diff が `/* */` コメント内だけ
- **並列**：PR-R4 と並列可

### PR-R4 —— `verify.mjs` §18・節番号規則・CI 契約

- **触る**：`tools/verify.mjs`／`package.json`（`scripts.ci` 新設）／`.github/workflows/verify.yml`／`docs/handoff/README.md`
- **触らない**：**`package.json` の `scripts.test` と `dependencies`（ゼロのまま）**・`mock/**`・`data/world/**`・`tools/regress.baseline.json`
- **受け入れ条件**：18-a〜18-d を実装し `portal/` が無い現時点では**節ごと skip して PASS**／**18-d が `mock/portal.html` で誤検知しない**／`npm run ci` が現行 13 ステップと同じ検査を同じ順で回す（対応表を PR 本文に）／**管理番号 12 個を YAML から出す**／`npm test` PASS・warn 17 件から増えない／`regress` 差分ゼロ／採番規則「実装済みの最大 ＋ 1」を `docs/handoff/README.md` に明記
- **並列**：PR-R3 と並列可。**PR-N1 とは直列**

### PR-N1 —— `CLAUDE.md`（**PM 承認済み。文面は設計書 §6-5 にそのまま貼れる形で用意**）

- **触る**：`CLAUDE.md`（N1-1〜N1-9）／`README.md`（見出し `（4 区分）`→`（5 区分）`＋⑤の行）／`tools/verify.mjs`（666・690・692 のリテラル 3 か所）
- **当てる 9 か所**：① 5 区分＋⑤ポータルの 1 文 ② §2-3 の `industry` 値域に `it` ③ §2-13 を 3 世界＋跨ぎの例外＋「現状 12 件」に ④ **§2-14 を新設**（4 点＋用語の衝突注記。検出は §18） ⑤ §3 に `npm run portal:test`＋`npm test` ＝ CI の誤記是正 ⑥ §5 に「`portal/**` とそれ以外は並列可」 ⑦ §7 の `run:mac` の定義文を広げる ⑧ §6 の件数を 15/35/81 に ⑨ §6 の P3 候補・`top.html` の棚卸し
- **触らない**：§2-1〜§2-12 の本文・§4 の分業表・§7 の `run:cloud`／`run:runner` と秘密の 3 種・`.claude/**`・`mock/**`・`data/world/**`
- **受け入れ条件**：9 か所を**すべて**当てる／**`README.md` と `verify.mjs` を同じ PR で**（片方だけだと verify §11-b が FAIL）／`npm test` PASS／`regress` 差分ゼロ／件数が `regress` の出力と一致することを PR 本文に貼る／**設計書 §6-5 の「変更前」が実文と食い違ったら止めて PM に返す**／PM の承認コメントを PR に紐づける
- **並列**：**直列**

### PR-N2 —— `portal/` の新設と取り込み

- **触る（新規）**：`portal/README.md`・`portal/CLAUDE.md`・`portal/package.json`・`portal/.nvmrc`・`portal/.env.example`・`portal/schema/{V001__init.sql,README.md}`・`portal/nocobase/{export,docker,plugins}/`・`portal/seed/**`（**生成物**）・`portal/env/{README.md,demo/portal.yml,prod/portal.yml}`・`portal/scripts/gen-seed.mjs`・`portal/tools/{check-nodata.mjs,check-seed-fresh.mjs,nodata.baseline.json,nodata-common-words.txt}`・`portal/docs/{nodata-known.md,split.md}`・`.github/workflows/portal-verify.yml`
- **触る（既存）**：`.gitignore`（`portal/node_modules/`）／`package.json`（`scripts.portal:test` のみ。**`scripts.test` と `dependencies` は不変**）
- **触らない**：`mock/**`・`data/world/**`・`dify/**`・`tools/**`・`CLAUDE.md`・`.github/workflows/{verify.yml,pages.yml,dify-ops.yml}`
- **中身は定義と架空データだけ。** `schema/`＝素の PostgreSQL（NocoBase をやめても残る）／`nocobase/`＝NocoBase 固有（やめたら捨てる）。方式 (a) の歯止め 3 つ（`DB_UNDERSCORED=true`／`DB_TABLE_PREFIX=nb_`／主キー型の明示）を `schema/README.md` と `nocobase/docker/.env.example` の**両方**に書く
- **`shoulang0729/portal` PR #1（16 ファイル）からの持ち込み条件**（設計書 §7 C-a〜C-e）：**実名・実 URL・秘密が 1 つも無い**／`seed/world/**` は**コピーせず `gen-seed.mjs` で 3 世界から生成し直す**／`check-nodata.mjs` は走査範囲を `portal/**` に読み替えてから／portal 側 `verify.yml` は持ち込まず `portal-verify.yml` として書き直す／portal 側 `CLAUDE.md` の dify 抜粋は「`shoulang0729/dify` の `CLAUDE.md` §X を見よ」に置換。**1 つでも満たせないファイルは持ち込まず書き直す**
- **受け入れ条件**：**ルート `npm test` PASS**（`portal/node_modules` が無い状態でも通る）／**`npm run portal:test` PASS**／verify **§18 が skip から実検査に変わって PASS**／`node portal/tools/check-nodata.mjs` PASS／`node portal/tools/check-seed-fresh.mjs` PASS／**`git subtree split --prefix=portal` を 1 回 dry-run し結果を PR 本文に貼る**（S-7）／実名・実 URL・秘密が無いことを reviewer が全ファイル目視／`regress` 差分ゼロ／`pages.yml` の `path: mock` が不変
- **並列**：**直列**（PR-N1 の後）

### PR-N3 —— `shoulang0729/portal` の後始末（**PR ではない。PM が GitHub 上で行う**）

- ① PR #1（`feat/portal-skeleton`、open）を **close**（マージしない）。close コメントに「内容は `shoulang0729/dify` の PR-N2（#<番号>）に取り込んだ。判断は設計書 §1・§7」
- ② `README.md` 先頭に 1 行「このリポジトリは `shoulang0729/dify` の `portal/` に統合された」
- ③ リポジトリを **archive（read-only）。削除しない**（過去の Issue／チャットのリンクを切らないため）
- **前提**：PR-N2 がマージされていること。**エージェントはリポジトリ設定を触らない**

---

## 5. 触らない範囲（reviewer の diff 監査の基準）

**本 PR（設計書 rev2）で触らないもの：**
- `mock/**`（データ層 `CATS`/`SVCS`/`TAGS`/`SCENARIOS`/`HOME`/`FEED`/`LIVE`/`PSCREENS` を含む。**regress 差分ゼロ**）
- `tools/**`・`tools/regress.baseline.json`・`scripts/**`・`dify/**`・`data/world/**`
- `.github/workflows/**`（特に `pages.yml` の `path: mock`）
- **`CLAUDE.md`・`README.md`・`.claude/**`**（§6・§6-5 は**提案文**。適用は PM 承認後の PR-N1）
- 他 architect 担当の設計書（`2026-09-10-portal-nocobase.md`・`2026-09-11-{nocobase-research,it-industry,portal-mock-pages,sysops-usecase,bp-usecases}.md`）

**後続 PR で共通に触らないもの：**
- `mock/css/tokens.css` の `--ntt-*`（§2-2）・`localStorage` の許可集合（§2-6）・`SVCS[].id` の改名（§2-9/§2-11）・`pages.yml` の `path: mock`（§2-8）
- **ルート `package.json` の `dependencies` はゼロ・`scripts.test` は `verify + regress` のまま**（§2-3 の「ビルド不要」の土台）

---

## 6. 用語の衝突（**重要。読み違えが起きる**）

| 語 | 指すもの |
|---|---|
| **部門ポータル（モック）** | `mock/portal.html`・`mock/js/portal/**`・`mock/js/data/portal/**`・`mock/css/portal.css`。**①デモ。Pages に出る。16 画面** |
| **⑤ポータル** | リポジトリ直下の **`portal/`**（NocoBase の定義・DDL・架空データ）。**Pages に出ない。ルート `npm test` の対象外** |

今後の設計書・PR 本文では「**部門ポータル（モック）**」と「**NocoBase ポータル（`portal/`）**」を書き分ける。

---

## 7. 申し送り（設計書 §11）

1. `portal-nocobase.md`：rev2 §7-4-3 N1 の「31 名（mfg 17 ＋ fin 14）」は**実数 42 名（20 ＋ 17 ＋ 5）**とずれている。**allowlist を人数で語らない書き方に**（PR-N2 の `gen-seed.mjs` が 3 世界から生成するので自動追随する）
2. `portal-nocobase.md`：「手コピー ＋ 出典行」は 1 リポで「**生成物 ＋ 鮮度検査**」に置き換わる。`export:catalog`／`export:world` は **PR-N2 で最初から作る**
3. PR-R3 の implementer：`mock/js/data/portal/ui.js`・`mock/js/portal/render.js` で触ってよいのは **`/* */` コメントだけ**
4. PR-R4 の implementer：新節の番号は設計書が §18 と書いているが、**着手時点で実装済み最大を数え直して「最大 ＋ 1」を取る**（採番規則そのもの）
5. 今後新たに PM 判断が要るもの（**いまは求めない**。設計書 §10-1）：N-a NocoBase 定義エクスポートを git に置くか（見立て：置く）／N-b docker を誰の手元で動かすか（見立て：当面 `run:mac`）／N-c `data/world/dept` を新設するか（見立て：**`it` を流用**）
