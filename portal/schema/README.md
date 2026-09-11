# portal/schema/ — 素の PostgreSQL

**NocoBase をやめても残る層。** ここに置くのは Flyway 形式の DDL（`V001__init.sql` 以降）だけで、
NocoBase 固有の設定・エクスポートは `portal/nocobase/` に置く（設計書
`docs/handoff/2026-09-11-repo-layout-v3.md` §2-2）。

## 方式 (a) の歯止め —— 初日に決めて以後変更しない 3 つ

NocoBase Community（無料版）には Migration Manager・外部データソース（Standard+ が必要な
External PostgreSQL）が無いため、**方式 (a)（NocoBase のメイン DB 内で業務テーブルを取り込む）** を
採る。方式 (a) では次の 3 つが「初回に決めて以後変更できない設定」であり、**後から変えると DB の
作り直しになる**（設計書 §2-3）。

| # | 設定 | 固定値 | 理由 |
|---|---|---|---|
| 1 | `DB_UNDERSCORED` | **`true`** | 列名を snake_case にする。NocoBase をやめたとき別システムから素直に読める。既定の camelCase は他システムから見て癖がある。後から変えると全テーブル作り直し |
| 2 | `DB_TABLE_PREFIX` | **`nb_`** | NocoBase の**システムテーブル側にだけ**付く接頭辞。方式 (a) では業務テーブルと同じ DB に同居するため、**これが唯一の見分け**。業務テーブル（下記）には付けない |
| 3 | 業務テーブルの主キー型 | **`bigint GENERATED ALWAYS AS IDENTITY`（Flyway で明示）** | NocoBase 既定の Snowflake ID（53-bit）を業務テーブルに持ち込まない。移行時に主キー型が変わると FK が全部壊れる |

**この 3 つは `portal/env/**` ではなく、この `README.md` と `portal/nocobase/docker/.env.example` の
両方に同じ値を書く**（環境差分ではなく「両環境で一致必須」だから）。**「あとで決める」を許さない
唯一の場所。**

## 業務テーブル（`V001__init.sql`）

`DB_TABLE_PREFIX=nb_` は NocoBase のシステムテーブルにのみ付く。**業務テーブルには接頭辞を付けない**
（設計書 `docs/handoff/2026-09-10-portal-nocobase.md` §5-1'）。

| テーブル | 内容 |
|---|---|
| `staff` | 要員（`mock/js/data/portal/mgmt.js` の `PPEOPLE` 相当。氏名・役割・稼働率などは実データ投入時に外部データソースから入る） |
| `departments` | 部署 |
| `customers` | 顧客 |
| `contacts` | 顧客の担当者 |
| `opportunities` | 案件（フロント業務） |
| `projects` | プロジェクト（デリバリ） |
| `todos` | To Do（`PACT` 相当） |
| `ai_services` | AI サービス（管理番号・`seed/catalog.json` を参照する台帳） |
| `knowledge_categories` | ナレッジの分類（全社 6 ＋ 部門 6・中分類 46。`seed/catalog.json` から seed） |
| `kpi_topics` | 組織 KPI の観点（`PKPITOPIC` 相当・9 観点・指標 52 件） |
| `goal_topics` | 個人目標（MBO）の観点（`PGOAL.topics` 相当・8 観点） |

ビュー `v_pipeline`、履歴テーブル `projects_history`／`todos_history` は P0 の実装時に追加する
（このディレクトリはまだ骨組みの段階。設計書 `docs/handoff/2026-09-10-portal-nocobase.md` §8）。

主キーはすべて `id bigint GENERATED ALWAYS AS IDENTITY`。NocoBase から「Load from database」→
「Sync from database」でこれらのテーブルを取り込む（Community で可。同設計書 §12-2 の②）。
