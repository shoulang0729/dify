# NocoBase 公式調査の記録（2026-09-11）— **事実の記録。設計判断ではない**

| | |
|---|---|
| **誰が** | PM が Claude Cowork に依頼して実施（設計書 `docs/handoff/2026-09-10-portal-nocobase.md` §4-7 の **V-PM-1** の実施結果）。architect が取り込み、冒頭のこの枠だけを足した |
| **いつ** | **2026-09-11**（取得日） |
| **何を** | 社内ポータル（NocoBase）の設計で未確認だった 25 問。A 既存 PostgreSQL スキーマとの関係／B 同じ画面定義を 2 環境で動かせるか／C Professional 版と認証（AD/LDAP）／D 外部システム連携（Dify・iframe・コレクション駆動ブロック・ダッシュボード）／E 運用（セルフホスト・CI/CD・アップグレード・プラグイン開発・多言語・中国からの到達性） |
| **対象バージョン** | **v2.2.10**（2026-09-10 リリース。GitHub Releases で「Latest」） |
| **調査範囲** | 公式ソースのみ（`docs.nocobase.com`／`www.nocobase.com`／`github.com/nocobase/nocobase`）。**公式ドキュメントに書かれていないことは「ドキュメントに記載なし」と明記**されており、ソースコードで確認できたものは「ソースで確認（ドキュメント記載なし）」と区別されている |

## この文書の位置づけ（重要）

- **これは事実の記録であって、設計判断ではない。** 設計判断は `docs/handoff/2026-09-10-portal-nocobase.md`（2026-09-11 改訂版）が持つ。本書に「貴社構成への含意」という節があるが、それは**調査者の見立て**であって、このリポジトリの決定ではない
- **断定していない箇所を断定に変えない。** 「記載なし」は「できない」ではなく「**分からない**」。設計書 §4-4 の分類（判明／依然として不明／公式へ問い合わせが必要）はこの区別に依存している
- **公式ページ間に不一致がある**（商用比較表 `www.nocobase.com/en/commercial` と `docs.nocobase.com/plugins` のバッジ。Migration Manager 等）。本書はその不一致をそのまま記録している。設計書 §4-4c で扱う
- **原文（出典 URL）が正。** 本書の引用は要約ツール経由の取得に基づく。契約・購入・本番設計の最終判断の前に各 URL の原文を確認すること
- **更新するときは新しい日付のファイルを足す**（本書を書き換えない）。設計書 §1-2b の「消さずに残す」と同じ作法

---


調査日: 2026-09-11
対象バージョン: **v2.2.10（2026-09-10 リリース、GitHub Releases で「Latest」）**。プレリリースとして v2.3.0-beta / v2.4.0-alpha / v3.0.0-alpha が並行しています。
出典: https://github.com/nocobase/nocobase/releases/latest

調査範囲は公式ソース（docs.nocobase.com、www.nocobase.com、github.com/nocobase/nocobase）のみです。公式ドキュメントに書かれていないことは「ドキュメントに記載なし」と明記し、GitHub のソースコードで確認できた事項は「ソースで確認（ドキュメント記載なし）」と区別しています。

エディション表記について: docs.nocobase.com/plugins の各プラグインには「Community Edition+」「Standard Edition+」「Professional Edition+」「Enterprise Edition+」のバッジがあり、「Community Edition+」= 無料版から利用可、「Professional Edition+」= Professional 以上を意味します。本レポートでは「無料」= Community Edition+、「Standard+」「Professional+」「Enterprise+」と表記します。エディションは Community（無料）/ Standard（$800）/ Professional（$8,000）/ Enterprise（要問合せ）の4段階です（C-4, C-5 参照）。
出典: https://docs.nocobase.com/plugins 、https://www.nocobase.com/en/commercial

---

## 0. 先に結論 — 特に重要な3問

| 問 | 結論 | 根拠 |
|---|---|---|
| **A-1** 既存 PostgreSQL テーブルを扱えるか | **記載あり・可能**。方式が2つある。(a) メインDB内の既存テーブルを「Load from database（Sync from database）」で取り込む — **無料**。(b) 別DBを「External data source: PostgreSQL」プラグインで接続 — **Standard+**（有償）。どちらも一覧・詳細・登録・更新のブロックを作れる。 | https://docs.nocobase.com/data-sources/data-source-main/ 、https://docs.nocobase.com/data-sources/data-source-external-postgres/ |
| **A-4** NocoBase が作るテーブルは素直か | **一部記載あり**。テーブル名 = collection name（`DB_TABLE_PREFIX` で接頭辞可）、列名は既定 camelCase（`DB_UNDERSCORED=true` で snake_case）、主キーの既定は **Snowflake ID (53-bit, bigint)**（Integer / UUID / Nano ID / 文字列に変更可）、プリセット列は id / createdAt / updatedAt / createdBy / updatedBy / space。**DB レベルの外部キー制約が実際に作られるか、多対多の中間テーブル命名規則は「ドキュメントに記載なし」**。 | https://docs.nocobase.com/data-sources/data-source-main/general-collection 、https://docs.nocobase.com/get-started/installation/env |
| **B-1** 定義だけ別環境に移せるか | **記載あり・可能**。機能名は **Migration Manager**、**Professional+**。テーブルごとに Schema-only / Overwrite / Skip を選び、業務テーブルは Schema-only、`collections` / `fields` / `uiSchemas` / `roles` などの定義テーブルは Overwrite が既定。開発→ステージング→本番の公式フロー「Release Management」に明記。 | https://docs.nocobase.com/ops-management/migration-manager/ 、https://docs.nocobase.com/ops-management/migration-manager/built-in-tables 、https://docs.nocobase.com/ops-management/release-management/ |

貴社構成への含意（詳細は §6）: 「先に PostgreSQL でテーブル設計 → NocoBase に認識させる」は成立します。ただし **NocoBase のメタデータ（表示名・ウィジェット・リレーション・権限）は NocoBase の管理テーブル側に保存され、対象テーブルには列を足さない**ので、業務テーブルは素の PostgreSQL のまま保てます。一方で「同じ定義・別データ」を公式手段で回すには Migration Manager（Professional+）が必要で、AD 連携（Auth: LDAP）も Professional+ なので、Professional 版前提はこの調査結果と整合します。

---

## A. 既存 PostgreSQL スキーマとの関係

### A-1. 既存テーブルを collection として認識できるか — 記載あり（可能）

**方式 (a): メインデータベース内の既存テーブルを取り込む（無料）**

メインデータソースは「NocoBase のシステムテーブルを保存し、業務テーブルも保存できる」と定義され、既存テーブルについては次のとおり記載があります。

> "Synchronizing existing database tables lets you manage them in NocoBase without recreating them." — With Load from database, you can: 1. Browse all tables in the database. 2. Select the tables to synchronize. 3. Identify table structures and field types automatically. 4. Import them into NocoBase for management.

PostgreSQL ページにも "To connect tables already present in your database, utilize the 'Sync from database' option available on the main-database management page." とあります。
出典: https://docs.nocobase.com/data-sources/data-source-main/ 、https://docs.nocobase.com/data-sources/main/postgresql

**方式 (b): 外部データソース「Data source: External PostgreSQL」（Standard+、有償）**

> "The plugin enables NocoBase to connect to existing PostgreSQL databases as external data sources. It reads PostgreSQL tables, fields, and views, using them as collections within NocoBase without modifying the original database schema."

対応バージョンは PostgreSQL 9.5 以上。接続設定に **Schema**（読み取るスキーマ、例 `public`）、**Table prefix**（一致するテーブル・ビューだけ読み、接頭辞を除去）、取り込む Collections の絞り込みがあります。ブロックで扱うには「Record unique key」（主キーまたはユニーク列）が必要で、ビューや複合キーのテーブルは手動指定です。エディションは "Standard, Professional, and Enterprise"。
出典: https://docs.nocobase.com/data-sources/data-source-external-postgres/ 、https://docs.nocobase.com/data-sources/data-source-manager/external-database

外部DBの位置づけとして "An external database is not the NocoBase system database. NocoBase does not manage its backup, restore, migrations, or schema changes." と明記されています。
出典: https://docs.nocobase.com/data-sources/data-source-manager/external-database

**関連機能（無料）**: 「Connect to database view」（既存ビューを接続。"Allow add new, update and delete actions" を有効化すると書込み可だが、実際に成功するかはビューが更新可能かと DB アカウントの権限次第）、「SQL collection」（SELECT のみ、読取専用）。
出典: https://docs.nocobase.com/data-sources/collection-view/ 、https://docs.nocobase.com/data-sources/collection-sql/

### A-2. 付加情報（表示名・型・ウィジェット・リレーション・権限）の保存先 — 記載あり

外部 PostgreSQL ページに、NocoBase はフィールドのメタデータと設定（titles, types, interfaces, permissions, workflows）を **自身のデータベースに保存**し、外部 PostgreSQL に対しては **"does not create columns, change column types, or delete real fields"** と記載されています。リレーションフィールドは "relation metadata only and do not automatically add real foreign-key columns"。
出典: https://docs.nocobase.com/data-sources/data-source-external-postgres/

リレーション概説にも、外部DBでは "Adding a relation field does not automatically create actual foreign keys, indexes, or join tables in the external database." とあります。
出典: https://docs.nocobase.com/data-sources/data-modeling/collection-fields/associations/

**具体的な管理テーブル名は公式ドキュメントに記載なし**。ソースで確認すると、メインDBのコレクション定義は `collections` テーブル（name, title, options(json) 等）と `fields` テーブル（name, type, interface, options(json), collectionName 等）、外部データソースの定義は `dataSourcesCollections` / `dataSourcesFields` テーブルに保存されています。
ソース: https://github.com/nocobase/nocobase/blob/main/packages/plugins/@nocobase/plugin-data-source-main/src/server/collections/collections.ts 、…/fields.ts 、https://github.com/nocobase/nocobase/blob/main/packages/plugins/@nocobase/plugin-data-source-manager/src/server/collections/data-sources-collections.ts

方式 (a)（メインDBで Load from database した既存テーブル）に対して NocoBase が後から列を追加するかどうかは **ドキュメントに記載なし**。

### A-3. PostgreSQL 側のスキーマ変更への追随 — 記載あり（手動同期）

自動検出の記述はありません。いずれも手動操作です。

外部 PostgreSQL: スキーマ変更後に「Sync from database」をクリック。"updates NocoBase collections, fields, primary keys, unique keys, and type mappings; it does not delete real PostgreSQL tables or data."
出典: https://docs.nocobase.com/data-sources/data-source-external-postgres/

外部DB全般: "Make schema changes through database tools, then use the refresh action to synchronize metadata."
出典: https://docs.nocobase.com/data-sources/data-source-manager/external-database

メインDB: "NocoBase can synchronize fields individually as well as synchronize an entire collection." / "Synchronize newly added fields after the database schema changes." / "Preserve existing data during synchronization."
出典: https://docs.nocobase.com/data-sources/data-source-main/

### A-4. NocoBase の画面から collection を作ったときの PostgreSQL 側の形 — 一部記載あり

| 項目 | 内容 | 判定 | 出典 |
|---|---|---|---|
| テーブル名 | Collection name（英数字と `_`、先頭は英字、作成後変更不可）がそのままテーブル名。API リファレンス `tableName`: "If not provided, the value of `options.name` will be used" | 記載あり | https://docs.nocobase.com/data-sources/data-source-main/general-collection 、https://docs.nocobase.com/api/database/collection |
| 接頭辞 | 環境変数 `DB_TABLE_PREFIX`（例 `nocobase_`）。ソースでは既存テーブル取込（dbsync）には付けない | 記載あり（ソースで補足） | https://docs.nocobase.com/get-started/installation/env 、https://github.com/nocobase/nocobase/blob/main/packages/core/database/src/database.ts |
| 列名の命名規則 | `DB_UNDERSCORED`: "Whether database table and field names are converted to snake case style. Default is `false`"。true にすると "the actual table and field names in the database will not match what is displayed in the UI"（例 `orderDetails` → `order_details`） | 記載あり | https://docs.nocobase.com/get-started/installation/env |
| 主キー | 選択肢は Single line text / Integer / **Snowflake ID (53-bit)** / UUID / Nano ID。**既定は Snowflake ID (53-bit)**（DB 型 bigint）。Integer の autoincrement 明記なし | 記載あり（一部記載なし） | https://docs.nocobase.com/data-sources/data-source-main/general-collection 、https://docs.nocobase.com/data-sources/data-modeling/collection-fields/advanced/snowflake-id |
| プリセット列 | ID(`id`), Created at(`createdAt`), Created by(`createdBy`), Updated at(`updatedAt`), Last updated by(`updatedBy`), Space(`space`)。"Keep them for normal business collections"。createdBy の実カラム名は該当ページが "To be added" | 記載あり（実カラム名は記載なし） | https://docs.nocobase.com/data-sources/data-source-main/general-collection 、https://docs.nocobase.com/data-sources/data-modeling/collection-fields/system-info/created-by |
| Sort 列 | 自動追加されず、必要なら手動で追加 | 記載あり | https://docs.nocobase.com/data-sources/field-sort/ |
| リレーションの外部キー制約 | m2o / o2m / m2m ページに ON DELETE（CASCADE / SET NULL / RESTRICT(既定) / NO ACTION）の設定あり。**DB レベルで FK 制約が実際に作成されるか、FK 列名規則、m2m 中間テーブルの自動命名は記載なし** | 記載なし | https://docs.nocobase.com/data-sources/data-modeling/collection-fields/associations/m2o/ 、…/o2m/ 、…/m2m/ |
| コレクションテンプレート | General / Tree / Calendar / Comment / File / Database view / Inheritance / SQL | 記載あり | https://docs.nocobase.com/data-sources/data-modeling/collection |

「将来 NocoBase をやめたときに別システムから読めるか」への公式回答は記載なしですが、上記から読み取れる範囲では、`DB_UNDERSCORED=true` で snake_case、主キーを Integer か UUID に明示指定すれば、テーブル自体は一般的な形になります。Snowflake ID（既定）や camelCase 列名（既定）は他システムから見ると癖があるため、**最初に決めて以後変えない**必要があります（`DB_UNDERSCORED` / `DB_TABLE_PREFIX` は後から変更できず、Migration Manager も両環境で一致を要求 — B-4 参照）。

### A-5. システムテーブルと業務テーブルのスキーマ分離 — 部分的に記載あり

| 手段 | 内容 | 判定 | 出典 |
|---|---|---|---|
| `nb init --db-schema` | "Database schema; only used by PostgreSQL"。例 `nb init --env app1 --yes --db-dialect postgres --db-schema public --db-table-prefix nb_ --db-underscored` | 記載あり | https://docs.nocobase.com/api/cli/init |
| 環境変数 `DB_SCHEMA` | 環境変数一覧ページには **記載なし**。Migration Manager ページに環境間で一致すべき変数として名前だけ登場。ソースでは `schema: process.env.DB_SCHEMA` を読み `CREATE SCHEMA IF NOT EXISTS` を実行 | 名前のみ記載、説明なし | https://docs.nocobase.com/ops-management/migration-manager/ 、https://github.com/nocobase/nocobase/blob/main/packages/core/database/src/helpers.ts |
| `COLLECTION_MANAGER_SCHEMA` | Migration Manager ページに名前のみ。ソースでは UI 作成コレクションの schema を `COLLECTION_MANAGER_SCHEMA || db.options.schema || 'public'` に置く実装。**つまりシステムテーブル = `DB_SCHEMA`、UI 作成の業務テーブル = `COLLECTION_MANAGER_SCHEMA` と分けられる実装はあるが、公式ドキュメントに説明なし** | ソースで確認（ドキュメント記載なし） | https://github.com/nocobase/nocobase/blob/main/packages/plugins/@nocobase/plugin-data-source-main/src/server/models/collection.ts |
| コレクション単位の `schema` オプション | API リファレンスに "Database schema specification" あり。UI からの設定方法は記載なし | 記載あり（API のみ） | https://docs.nocobase.com/api/database/collection |
| 外部データソース方式 | 業務DBを別DB/別スキーマに置き、外部 PostgreSQL データソースの **Schema** 指定で接続（Standard+） | 記載あり | https://docs.nocobase.com/data-sources/data-source-external-postgres/ |
| `DB_TABLE_PREFIX` | システムテーブルに接頭辞を付けて同一スキーマ内で区別 | 記載あり | https://docs.nocobase.com/get-started/installation/env |

---

## B. 同じ画面定義を2つの環境で動かせるか

### B-1. 定義（collection・ページ・ブロック・ロール）だけのエクスポート／インポート — 記載あり（Migration Manager、Professional+）

Migration Manager は "helps you transfer application configurations from one environment (e.g., Staging) to another (e.g., PROD)" と定義され、Backup Manager との使い分けは "Migration Manager: Best for moving specific configurations or table structures between environments. Backup Manager: Best for a complete data migration or full system backup/restore." です。エディションは **Professional Edition+**、Backup Manager プラグインが有効であることが前提です。
出典: https://docs.nocobase.com/ops-management/migration-manager/

移行ルールはテーブル単位に3種類:

- **Schema-only**: "Only synchronizes table structures. No data is inserted or updated."
- **Overwrite**: "Clears existing table records, then inserts new data."（構造変更も同期）
- **Skip**: "Does nothing to the table."

業務データの除外は "User-defined business data tables usually use schema-only to avoid overwriting production business data." と明記。
出典: 同上

組み込みテーブルの既定ルール（何が「定義」として運ばれるか）:

| テーブル | 内容 | 既定 |
|---|---|---|
| `collections` / `fields` | コレクション定義 | Overwrite |
| `uiSchemas` | "JSON layout definitions for pages and blocks" | Overwrite |
| `desktopRoutes` | メニュー・ルート | Overwrite |
| `roles` / `rolesResourcesScopes` | ロール・権限 | Overwrite |
| `dataSources` | "Main or external database connection configuration" | Overwrite |
| `workflows` | ワークフロー定義 | Overwrite |
| `users` | ユーザー（business runtime data 扱い） | Schema-only |
| `environmentVariables` | 環境変数（環境ごとに保持） | Schema-only |
| `executions` / `jobs` 等 | ワークフロー実行履歴 | Schema-only |

出典: https://docs.nocobase.com/ops-management/migration-manager/built-in-tables

制約: メインDBのテーブルのみ対象で "does not migrate data from external databases or sub-applications"。"NocoBase currently does not support zero-downtime migrations"。`.env` の `DB_UNDERSCORED`, `USE_DB_SCHEMA_IN_SUBAPP`, `DB_TABLE_PREFIX`, `DB_SCHEMA`, `COLLECTION_MANAGER_SCHEMA` が両環境で不一致だと移行不可。実行前に自動バックアップ。CLI は `yarn nocobase migration generate --ruleId=<id>` / `yarn nocobase migration run /path/to/file.nbdata`。
出典: https://docs.nocobase.com/ops-management/migration-manager/

関連: **Version control**（Professional+）は単一アプリ内のチェックポイント保存・復元で、"By default, saved versions do not include data from user-created collections."。環境間移動は Migration Manager の役割と明記。
出典: https://docs.nocobase.com/ops-management/version-control/

### B-2. Backup & Restore で「定義だけ」を運べるか — できない（記載なし）

旧 `@nocobase/plugin-backup-restore` は **v1.4 で非推奨**（"Starting from version v1.4, we have decided to deprecate this plugin."、理由の一つが "complex backup grouping design"）。後継の **Backup Manager**（`@nocobase/plugin-backups`、無料）は "fully backing up of the NocoBase database and user uploaded files" のフルバックアップで、設定項目はスケジュール・保持世代・クラウド同期・アップロードファイル含有・復元パスワードのみ。**コレクション選択や「ユーザーデータをスキップ」の記載はなし**。復元は同一以上のバージョン、同一の dialect / underscored / prefix / schema 設定が必要。
出典: https://www.nocobase.com/en/blog/nocobase-backup-restore 、https://docs.nocobase.com/ops-management/backup-manager/

### B-3. 「同じ定義・別データ」の公式推奨 — 記載あり（Release Management）

「Release Management」ガイドに、Development → Staging → Production の流れが明記されています。

- "Development configuration is usually treated as the source of truth and synchronized to staging and production."
- "Tables that carry real business data usually migrate structure only and use schema-only, avoiding overwrites of production data." / "Application and plugin built-in tables usually follow the default strategy and use overwrite first."
- "Variables and secrets isolate environment-specific configuration and sensitive information. Development, staging, and production should use their own variables and secrets."
- "Create a pre-release backup before publishing to production."
- 手順: 開発で移行ファイル生成 → ステージングで実行・検証 → 本番のリリース前バックアップ → 本番で同一ファイル実行 → 検証後アクセス再開

出典: https://docs.nocobase.com/ops-management/release-management/

このフローの中核（Migration Manager、Version control）は Professional+、Variables and Secrets と Backup Manager は無料です。

貴社の「デモ環境（架空データ）と本番環境（実データ）」は、このガイドの Development/Staging を「デモ」、Production を「本番」に読み替えればそのまま当てはまります。デモ環境を定義の正本にし、移行ファイルで本番へ流す形です。

### B-4. 接続先 PostgreSQL の環境ごとの差し替え — 記載あり（可能）

`DB_DIALECT`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`, `DB_TABLE_PREFIX`, `DB_UNDERSCORED` が環境変数として定義されています。Docker では `docker-compose.yml` の `environment` または `env_file`。ホスト・DB名・ユーザー・パスワードは Migration Manager の一致チェック対象に含まれないため、環境ごとに変えて問題ありません。
出典: https://docs.nocobase.com/get-started/installation/env 、https://docs.nocobase.com/ops-management/migration-manager/

外部データソース（Standard+）の接続設定については、「Variables and Secrets」プラグイン（無料）の対応プラグイン一覧に "Data Source: External PostgreSQL" が明記されており、"Storage of various external database configuration information" が用途例に挙がっています。`environmentVariables` テーブルは Migration Manager で Schema-only 既定なので、接続設定を変数参照にしておけば「定義は移して値は環境ごと」に運用できます。接続フォームでの参照構文（`{{$env.xxx}}` 等）は記載なし。
出典: https://docs.nocobase.com/ops-management/variables-and-secrets/ 、https://docs.nocobase.com/ops-management/migration-manager/built-in-tables

---

## C. Professional 版と認証

### C-1. LDAP / LDAPS で Active Directory と連携するプラグイン — 記載あり（Auth: LDAP、Professional+）

プラグインは **Auth: LDAP**（`@nocobase/plugin-auth-ldap`）、**Professional Edition+**。商用比較表でも "SSO (OIDC, SAML, LDAP, CAS)" は Professional 以上のみ ✓。
出典: https://docs.nocobase.com/auth-verification/auth-ldap/ 、https://docs.nocobase.com/plugins 、https://www.nocobase.com/en/commercial

設定項目（ドキュメント記載）:

- Basic: "Sign up automatically when the user does not exist"（自動ユーザー作成）、LDAP URL、Bind DN、Bind password、Test connection
- Search: Search DN（検索ベース）、Search filter（"using `{{account}}` to represent the user account used for login"）、Scope（Base / One level / Subtree、既定 Subtree）、Size limit
- Attribute Mapping: バインド用フィールド（username または email）、Attribute map（LDAP 属性 → NocoBase users の項目）

出典: https://docs.nocobase.com/auth-verification/auth-ldap/

**ドキュメントに記載なし**: 「ldaps」「TLS」「SSL」「certificate」「Active Directory」「memberOf」のいずれの語もページに存在しません。LDAPS の設定方法・証明書の扱い、AD 側の準備（サービスアカウント、OU 構成など）は記載なし。LDAP URL 欄に `ldaps://` を入れられるかは、ドキュメント上は不明です。

関連: **LDAP ユーザー同期**（同プラグイン、Professional+）。Sync filter の既定が `(&(objectCategory=person)(objectClass=user))` で AD 向けの値になっています。部署同期は `organizationalUnit` と `container` を既定で検索し、DN の親子関係で階層を保持。制限として "Only the first value is currently synchronized"（多値属性）、`memberOf` などからの複数部署、部署長は同期しない、と明記。
出典: https://docs.nocobase.com/users-permissions/sync/sources/ldap

### C-2. AD グループ → NocoBase ロールのマッピング — 記載なし（直接機能なし）

- LDAP 認証ページに role / group / department の語なし。
- SAML ページに "Currently, user organization and role mapping are not supported." と明記。
- OIDC のマッピング対象は nickname / email / phone のみ。
- ユーザー同期の対象は Users と Departments のみ（roles は同期対象に挙がっていない）。

出典: https://docs.nocobase.com/auth-verification/auth-ldap/ 、https://docs.nocobase.com/auth-verification/auth-saml/ 、https://docs.nocobase.com/auth-verification/auth-oidc/ 、https://docs.nocobase.com/users-permissions/sync/

**間接的に可能な経路（記載あり）**: LDAP 同期で AD の **OU / コンテナ**を NocoBase の「部署」として同期し、**Department roles**（部署に紐付くロール、"members of the current department can have these roles"）で部署→ロールを与える。つまり Management / Sales / Delivery / PM が AD 上で **OU** として存在すれば「OU → 部署 → 部署ロール」で実現できます。**セキュリティグループ（memberOf）ベースの対応付けはドキュメント上の手段がありません**。
出典: https://docs.nocobase.com/users-permissions/sync/sources/ldap 、https://docs.nocobase.com/users-permissions/departments/role

### C-3. レコード単位の絞り込み — 一部記載あり

| 機能 | 内容 | 出典 |
|---|---|---|
| ロールのアクション権限のデータスコープ | 「All records」か「Own records」（"records the user created"）の2択。カスタムフィルタや変数の記載なし | https://docs.nocobase.com/users-permissions/acl/permissions |
| フィールド権限 | 操作別にフィールド単位で閲覧/編集/追加を制御 | 同上 |
| ブロックのデータスコープ | ブロックに既定フィルタを設定。変数の例は「Current user」。関連コレクションのフィールドも条件に使用可 | https://docs.nocobase.com/interface-builder/blocks/block-settings/data-scope |
| 使える変数 | Current user / Current role / Current form / Current record / Current popup record / URL query parameters / API token / Current device type。**部署関連の変数（所属部署・上位部署・下位部署）は記載なし** | https://docs.nocobase.com/interface-builder/variables |
| 部署の階層 | 親子部署、Superior department、主部署、部署長（Department head）、複数部署所属 | https://docs.nocobase.com/users-permissions/departments/ |
| 部署を変数として使う | package.json の description に "use departments as variables in workflows and expressions" とあるが、ドキュメントに変数名・使い方の記載なし | https://raw.githubusercontent.com/nocobase/nocobase/main/packages/plugins/@nocobase/plugin-departments/package.json |

結論: 「本人は自分の担当案件だけ」は、ロール権限の「Own records」（作成者ベース）またはブロックのデータスコープで「担当者 = Current user」とすれば実現できます（記載あり）。「上長は部下の分も」は、ロール権限レベルで部署階層を参照する仕組みが **ドキュメントに記載なし**。ブロックのデータスコープで関連コレクション経由の条件（例: 案件.担当者.部署 = …）は書けますが、「現在ユーザーの部署配下」を表す変数は記載がありません。

### C-4. 無料版と Professional 版の機能差 — 記載あり（ただし公式ページ間で不一致あり）

公式の比較表は https://www.nocobase.com/en/commercial 、プラグイン別のエディション表記は https://docs.nocobase.com/plugins です。**両者の間で複数の不一致があります**（後述）。本レポートでは docs.nocobase.com/plugins のバッジを優先しています。

A・B・D で調べた機能のエディション:

| 機能 | エディション（docs/plugins） |
|---|---|
| メインDB の既存テーブル取込（Load from database） | 無料 |
| Database view collection / SQL collection | 無料 |
| **External data source: PostgreSQL / MySQL / MariaDB / SQL Server** | **Standard+** |
| External: KingbaseES | Professional+ |
| External: Oracle / ClickHouse / Doris | Enterprise+ |
| **Migration manager** | **Professional+**（比較表では全エディション ✓ と表示 → 不一致） |
| Version control | Professional+ |
| Backup manager | 無料 |
| Variables and secrets | 無料 |
| **Auth: LDAP / SAML / OIDC / CAS** | **Professional+** |
| Departments | 無料 |
| Data visualization（チャート） | 無料 |
| Workflow 本体、HTTP request / JavaScript / JSON / SQL / Loop / Parallel / Delay / Aggregate / Manual / Response message / Pre-Post-Custom action event 各ノード | 無料 |
| Workflow: Approval / Subflow / **Webhook トリガー** | Professional+ |
| Workflow: Database transaction ノード | Enterprise+ |
| Auth: API keys | 無料 |
| Public forms | 無料 |
| Block: iframe / Embed NocoBase | 無料 |
| AI employees / AI: MCP server | 無料 |
| AI: Knowledge base | Professional+（比較表では全 ✓ → 不一致） |
| Multi-app manager（deprecated）/ 後継 App supervisor | 無料 / Enterprise+ |
| Multi-portal | Professional+ |
| UI layout | 無料 |
| Audit logs | Enterprise+ |
| Record history | Professional+ |
| Custom brand | Standard+ |
| Import/Export Pro（大量） | Standard+ |
| Cluster mode / Redis・RabbitMQ アダプタ / Telemetry / IP restriction / Email manager | Enterprise+ |
| Password policy / 2FA(TOTP) | Professional+ / Enterprise+（比較表では全 ✓ → 不一致） |

出典: https://docs.nocobase.com/plugins 、https://www.nocobase.com/en/commercial

ライセンス: コミュニティ版は Apache-2.0。2026年2月のリリースノートに "Open source commercial plugins and update license from AGPL-3.0 to Apache-2.0 (#8682)" とありますが、対象プラグイン名は明記されていません。
出典: https://www.nocobase.com/en/agreement 、https://www.nocobase.com/en/blog/weekly-updates-20260226

**貴社構成で Professional+ が必要になるもの**: Auth: LDAP（AD 連携）、Migration Manager（定義だけの環境間移送）。External PostgreSQL は Standard+ ですが、方式 (a)（メインDB内で管理）を採れば無料の範囲です。

### C-5. Professional 版のライセンス形態と価格 — 記載あり

| 項目 | 内容 | 出典 |
|---|---|---|
| 価格（英語サイト） | Community: Free / Standard: **$800** / Professional: **$8,000** / Enterprise: Contact。いずれも一括払い | https://www.nocobase.com/en/commercial |
| 価格（中国語サイト） | Standard **¥5,000** / Professional **¥50,000**（人民元）。"一次性付费，可以终身使用"、アップグレード期間1年 | https://www.nocobase.com/cn/commercial |
| 期間 | "Lifetime license" — "There is no expiration date, and you don't need to pay annually."。バージョンアップとサポートは購入後 **1年間**。1年経過後の扱いは記載なし | https://www.nocobase.com/en/commercial |
| ユーザー数・アプリ数 | "no restrictions on the number of applications and users" | https://www.nocobase.com/en/agreement |
| 課金単位 | ライセンスキーは「Instance ID」に紐付き、"Authorization is directly bound to your NocoBase instance"。環境変更時は新しい Instance ID / License Key が必要。**1ライセンスで何インスタンスまで可か、開発/デモ環境の扱いは記載なし** | https://www.nocobase.com/en/blog/nocobase-commercial-license-activation-guide |
| 利用範囲 | Standard は自社内部利用のみ。Professional / Enterprise は "develop applications for your own clients or to sell the developed applications to clients" 可。顧客に設定権限を渡す場合は顧客側も商用ライセンスが必要 | https://www.nocobase.com/en/commercial |
| サポート | Standard 初回応答 24h / Professional 12h / Enterprise 4h | 同上 |
| アップ／ダウングレード | 上位への差額アップグレード可、ダウングレード不可 | 同上 |

貴社の「顧客に見せる提案用デモ」は Professional の利用範囲（顧客向けアプリ開発）に該当します。ただしデモ環境と本番環境が別インスタンスになるため、**1ライセンスで2インスタンスをカバーできるかは要問合せ**です。

---

## D. 外部システムとの連携

### D-1. 外部 API（Dify）の呼び出し — 記載あり（画面ボタン・Workflow とも可、無料）

**画面のボタンから**

- **Action: Custom request**（無料）: "Sending a request to any HTTP service supports sending context data to the target service."。GET/POST/PUT/DELETE、URL に変数可、Headers / Parameters / Body / Timeout、Response type は JSON または Stream（ファイルダウンロード）。"Access control: Used to restrict which roles can trigger this request step"。
  出典: https://docs.nocobase.com/interface-builder/actions/types/custom-request
- **Trigger workflow ボタン**（無料）: ボタンにワークフローをバインド。"Custom action event" は Trigger workflow ボタン専用。
  出典: https://docs.nocobase.com/interface-builder/actions/action-settings/bind-workflow
- **JS Action**（無料）: `ctx.api.request(options)` などが使える。外部 URL への直接 fetch 可否は記載なし。
  出典: https://docs.nocobase.com/interface-builder/actions/types/js-action

**Workflow から**

- **HTTP request ノード**（無料）: GET/POST/PUT/PATCH/DELETE、Headers/Params/Body に変数可、Body は JSON / form-urlencoded / XML / multipart、Timeout、"Ignore Failures"。応答は status code / headers / data の3変数。"Both the headers and the JSON-formatted response data still need to be parsed using a JSON node."
  出典: https://docs.nocobase.com/workflow/nodes/request
- **Custom action event トリガー**（無料）: ボタン押下で起動。同期モード（即時応答可）／非同期モード。
  出典: https://docs.nocobase.com/workflow/triggers/custom-action
- **Response message ノード**（無料）: 同期モードのワークフローで画面にメッセージを返す。
  出典: https://docs.nocobase.com/workflow/nodes/response-message
- **JavaScript ノード**（無料）: 既定は QuickJS/WASM の Safe mode で `require` 不可。ノード内から HTTP を発行する方法は記載なし（HTTP request ノードを使う前提）。
  出典: https://docs.nocobase.com/workflow/nodes/javascript
- **JSON ノード**（無料）: JMESPath / JSONPath Plus / JSONata で応答をパース。
  出典: https://docs.nocobase.com/workflow/nodes/json-query
- **Webhook トリガー**（外部 → NocoBase、**Professional+**）。
  出典: https://docs.nocobase.com/workflow/triggers/webhook

**AI employees プラグインと Dify**

- LLM サービスの対応プロバイダは "OpenAI, Gemini, Claude, DeepSeek, Qwen, Kimi, and Ollama local models"。設定は Title / API Key / Base URL（任意）。管理者ガイドの表に Provider "Compatible with services using the same specification"、Base URL "Needs to be modified when using a proxy" とあり、**同じ仕様（例: OpenAI 仕様）の API なら Base URL 差し替えで接続できると読めます**。
  出典: https://docs.nocobase.com/ai-employees/features/llm-service 、https://docs.nocobase.com/ai-employees/configuration/admin-configuration
- **Dify への直接接続はドキュメントに記載なし**（docs 内検索でヒットなし）。Dify を呼ぶ公式に記載された手段は、HTTP request ノード / Custom request アクション、または MCP 連携（Streamable HTTP / SSE、カスタムヘッダー認証可）です。
  出典: https://docs.nocobase.com/ai-employees/features/mcp
- Workflow の LLM ノード（Text Chat / Structured Output）は **非同期ワークフロー限定**。
  出典: https://docs.nocobase.com/ai-employees/workflow/nodes/llm/chat

### D-2. iframe ブロック — 記載あり（無料）

- "Create an iframe block on the page to embed and display external web pages or content."。URL 指定と HTML 直接記述の両対応、HTML モードは Liquid テンプレート対応。
- 変数: HTML モードは "Supports selecting variables from the current block context using the variable selector."。URL モードは「URL Variable Support」という見出しとスクリーンショットのみで、**使える変数の列挙は記載なし**。
- ログイン状態の引き継ぎ: 変数一覧に **API token**（"a credential for accessing the NocoBase API"）はあるが、**iframe の URL に付与する手順は記載なし**。埋め込み先（Dify 等）のログイン状態を引き継ぐ仕組みの記載もなし。

出典: https://docs.nocobase.com/interface-builder/blocks/other-blocks/iframe 、https://docs.nocobase.com/interface-builder/variables

逆方向（NocoBase を外部に埋め込む）: **Embed NocoBase**（無料）。ページ設定の「Copy embedded link」で `https://example.com/embed/xxx` を取得し、外部埋め込み時は `?token=xxx` を付与。**Public forms**（無料）は匿名ユーザー向けフォームを公開リンク / QR / iframe で提供。
出典: https://docs.nocobase.com/integration/embed/ 、https://docs.nocobase.com/plugins/@nocobase/plugin-public-forms/

### D-3. 「AI サービス一覧」をテーブルで持ち、行が増えたら画面にも自動で増える — 記載あり（コレクション駆動ブロック）

| ブロック | 内容 | 出典 |
|---|---|---|
| Grid Card（無料） | "displays summary information of data records in a card format"。列数設定、Data scope、行アクションに Edit / Delete / **Link** / Pop-up / Trigger Workflow / JS Action など | https://docs.nocobase.com/interface-builder/blocks/data-blocks/grid-card |
| List（無料） | "task lists, news, and product information" 向け。行アクションに Link あり | https://docs.nocobase.com/interface-builder/blocks/data-blocks/list |
| Kanban（無料） | Single select / Many-to-one でグルーピング | https://docs.nocobase.com/interface-builder/blocks/data-blocks/kanban |
| Link アクション | "The link action uses route navigation, supports passing URL variables"、"Open in new window" 可 | https://docs.nocobase.com/interface-builder/actions/types/link |
| URL フィールド | URL を保存、Details ブロックで "Display and open a URL" | https://docs.nocobase.com/data-sources/data-modeling/collection-fields/basic/url |
| Markdown ブロック + 変数 | Liquid テンプレート（if / for / フィルタ）と変数 | https://docs.nocobase.com/interface-builder/blocks/other-blocks/markdown |
| JS ブロック（無料） | `ctx.resource` でコレクションデータを取得し `ctx.render()` で React/HTML を描画する自由描画ブロック | https://docs.nocobase.com/interface-builder/blocks/other-blocks/js-block |

結論: Grid Card / List はコレクションのレコードをそのまま描画するブロックなので、「AI サービス」コレクションに行を追加すればカードとして表示されます。「行を追加すると自動反映」という文言そのものは記載なしですが、ブロックの定義上そう動きます。各カードから Link アクション（URL フィールドを変数で渡す）で Dify 等へ遷移する構成は公式ドキュメントの範囲内です。

### D-4. ダッシュボード（グラフ） — 記載あり（Data visualization、無料）

- プラグイン "Data visualization" は Built-in、**Community Edition+（無料）**。"Provides data visualization feature, including chart block and chart filter block"。
- チャート種類: "line, area, column, bar, pie, donut, funnel, scatter, etc."。ECharts ベースで、JS により "Return a full ECharts `option`" のカスタムチャートも可。
- データ取得: Builder モード（Data source + Collection、Measures: Sum/Count/Avg/Max/Min、Dimensions、Filter、Sort、Limit）と **SQL モード**（SQL 直書き）。
- フィルタ連動: ページのフィルタブロックとチャートが連動。"If the filter selects fields associated with a chart, their values are automatically merged into the chart query and trigger a refresh."
- 外部データソースをチャートに使えるかは、Data source 選択 UI がある旨の記載のみで明示なし。

出典: https://docs.nocobase.com/plugins 、https://docs.nocobase.com/data-visualization/ 、https://docs.nocobase.com/data-visualization/guide/chart-options 、https://docs.nocobase.com/data-visualization/guide/data-query 、https://docs.nocobase.com/data-visualization/guide/filters-and-linkage

---

## E. 運用

### E-1. セルフホスト構成 — 記載あり

必要ミドルウェア: Node.js 22 以上、Yarn 1.22.x（create-nocobase-app / Git ソース）。DB は MySQL 8.0.17+ / MariaDB 10.9+ / **PostgreSQL 10+**（Docker 例は postgres:16）。Redis は単一ノードでは任意（`CACHE_DEFAULT_STORE` は `memory` または `redis`）。nginx は必須ではないが本番では推奨。システム要件は最小 1 core / 2GB、推奨 2 core / 4GB 以上、Linux 推奨。
出典: https://docs.nocobase.com/get-started/installation/create-nocobase-app 、https://docs.nocobase.com/get-started/installation/docker 、https://docs.nocobase.com/get-started/installation/env 、https://docs.nocobase.com/get-started/system-requirements

インストール方法: Docker（推奨・本番向け）、create-nocobase-app（プラグイン開発向け）、Git ソース（本番非推奨）、`nb` CLI（`npm install -g @nocobase/cli@alpha` → `nb init`）。
出典: https://docs.nocobase.com/get-started/installation/docker 、https://docs.nocobase.com/get-started/installation/create-nocobase-app 、https://docs.nocobase.com/get-started/installation/git 、https://docs.nocobase.com/ai/install-nocobase-app

公式 docker-compose 例（PostgreSQL 版、要約）:

```yaml
services:
  app:
    image: nocobase/nocobase:latest-full
    environment:
      - APP_KEY=your-secret-key
      - DB_DIALECT=postgres
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_DATABASE=nocobase
      - DB_USER=nocobase
      - DB_PASSWORD=nocobase
      - TZ=Etc/UTC
    volumes:
      - ./storage:/app/nocobase/storage
    ports:
      - '13000:80'
  postgres:
    image: postgres:16
    command: postgres -c wal_level=logical
    volumes:
      - ./storage/db/postgres:/var/lib/postgresql/data
```

イメージタグは `latest` / `latest-full` / `beta` / `alpha` / 数値版。`-full` は PostgreSQL 16/17・MySQL 8.0・Oracle クライアントと LibreOffice を同梱（Backup Manager は full イメージ推奨）。初期ユーザーは公式ドキュメントに既定値が記載されている（**値は本書に転記しない。初回ログイン後に必ず変更すること**）。
出典: https://docs.nocobase.com/get-started/installation/docker

### E-2. 本番運用の推奨構成 — 記載あり

- 本番は Docker 推奨。複数インスタンスはポートではなくホスト名で分離（Cookie がポート分離されないため）。
  出典: https://docs.nocobase.com/get-started/deployment/production
- 単一プロセスの多コア利用: `CLUSTER_MODE`（`max` / `-1` / 数値）。
  出典: https://docs.nocobase.com/get-started/installation/env
- **クラスタモード（複数ノード）は Enterprise+**。Redis 8.0 以上（または RabbitMQ 4.0 以上をキューに）、商用アダプタプラグイン（pubsub / queue / lock / workerid）、全ノードで `storage` 共有、最低2インスタンス。Kubernetes マニフェスト例あり。
  出典: https://docs.nocobase.com/cluster-mode/ 、https://docs.nocobase.com/cluster-mode/preparations 、https://docs.nocobase.com/cluster-mode/kubernetes
- **バックアップ**: Backup Manager（無料）。PostgreSQL は内部で `pg_dump` を使用、アップロードファイルも同梱可、cron 自動実行、保持世代、クラウド同期、パスワード保護。復元は同一以上のバージョン・同一 DB 設定が必要。
  出典: https://docs.nocobase.com/ops-management/backup-manager/
- 2.2 のデプロイ注意: `/files/` ルートを SPA fallback より先に NocoBase へ転送、クラスタ全ノードを同時にアップグレード。
  出典: https://www.nocobase.com/en/blog/2.2.0

貴社規模（1拠点の部門ポータル）なら、単一コンテナ + `CLUSTER_MODE` で十分で、Enterprise のクラスタモードは不要と読めます。

### E-3. CI/CD からのデプロイ — ほぼ記載なし

- GitLab CI / GitHub Actions 等の CI パイプラインに関する公式ドキュメント: **記載なし**。
- create-nocobase-app 用の Dockerfile / カスタムイメージ構築手順: **記載なし**。
- 関連する記述: `nb init --yes --env app1` の非対話モードが CI 環境向けと明記。プラグインは `yarn build @scope/plugin --tar` で `.tgz` を作り、本番の `./storage/plugins` に展開、または `yarn pm pull` → `yarn nocobase upgrade --skip-code-update`。Docker 運用の更新は `docker compose pull app && docker compose up -d app`。
  出典: https://docs.nocobase.com/ai/install-nocobase-app 、https://docs.nocobase.com/plugin-development/build 、https://docs.nocobase.com/get-started/install-upgrade-plugins 、https://docs.nocobase.com/get-started/upgrading/docker
- イントラネット（オフライン）Docker ページは "Content to be added" の空ページ。
  出典: https://docs.nocobase.com/get-started/deployment/intranet/docker

GitLab CI で組む場合は、上記の断片（compose pull / up、プラグイン tgz 配置、Migration Manager の CLI `yarn nocobase migration run`）を自前でパイプライン化することになります。

### E-4. バージョンアップ手順と 2.x の方針 — 手順は記載あり、1.x→2.x 移行ガイドは記載なし

- Docker: DB バックアップ → image タグ更新 → `docker compose pull app` → `docker compose up -d app`。**ダウングレード不可**、本番は数値タグ推奨。ロールバックは DB 復元 + タグ戻し。
  出典: https://docs.nocobase.com/get-started/upgrading/docker
- create-nocobase-app: `yarn nocobase upgrade`。Git: `git pull` → `yarn install` → `yarn nocobase upgrade` → `yarn build`。
  出典: https://docs.nocobase.com/get-started/upgrading/create-nocobase-app 、https://docs.nocobase.com/get-started/upgrading/git
- リリーストラック: Latest（安定・本番推奨）/ Beta / Alpha。
  出典: https://docs.nocobase.com/get-started/quickstart
- **1.x → 2.x 専用のアップグレードガイドは記載なし**。2.0 の互換性情報はブログ / リリースノートに散在: フィールド既定値は非推奨（field assignment へ）、1.x の承認設定は 2.0 ブロック方式に切替後は戻せない、など。
  出典: https://github.com/nocobase/nocobase/releases/tag/v2.0.0 、https://www.nocobase.com/en/blog/nocobase-2-0-officially-released
- **plugin-mobile → ui-layout の状況**: 2.0-beta 告知で `@nocobase/plugin-mobile` は "Deprecated — Use @nocobase/plugin-ui-layout instead"、`plugin-ui-layout` は "New / Planned"。2.2 で `/v/mobile` エントリ（専用モバイルレイアウト、デスクトップとデータソース共有）を提供。2.2 の非推奨一覧（**3.0 で削除予定**）に `plugin-mobile` / `plugin-mobile-client` → `plugin-ui-layout`、`plugin-multi-app-manager` → `plugin-app-supervisor`、`plugin-backup-restore` → `plugin-backups`、`plugin-charts` / `plugin-echarts` → `plugin-data-visualization` など 18 件。docs 側に ui-layout 専用ページは確認できず（記載なし）。
  出典: https://www.nocobase.com/en/blog/2-0-beta 、https://www.nocobase.com/en/blog/2.2.0

新規構築なら最初から 2.2 系の Modern page（v2）と ui-layout / `/v/` エントリで作り、非推奨一覧にあるプラグインを使わないのが安全です。

### E-5. カスタムプラグインの開発言語とビルド — 記載あり

- スタック: **TypeScript**。クライアントは React + Ant Design + Formily、サーバーは Koa、DB 層は Sequelize ベース。マイクロカーネル構成で全機能がプラグイン。
  出典: https://docs.nocobase.com/plugin-development/
- 構造: `package.json`、`client-v2.js`、`server.js`、`src/client-v2/`、`src/server/`。配置先は `packages/plugins/`（開発）と `storage/plugins/`。
  出典: https://docs.nocobase.com/plugin-development/project-structure
- コマンド: `yarn pm create @scope/plugin-name` / `yarn pm enable` / `yarn pm disable` / `yarn build @scope/plugin-name --tar`。ビルドは Rsbuild（client）+ tsup（server）、出力 `dist/` と `storage/tar/*.tgz`。
  出典: https://docs.nocobase.com/plugin-development/build
- プラグイン i18n: `src/locale/<lang>.json`。
  出典: https://docs.nocobase.com/plugin-development/client/i18n

### E-6. 多言語（日本語・中国語） — 記載あり（完成度の数値は記載なし）

- UI 対応言語に **日本語（ja-JP）と简体中文（zh-CN）を含む**（English, 简体中文, 日本語, Español, Português, Deutsch, Français, Русский, Bahasa Indonesia, Tiếng Việt）。**翻訳率・完成度の記載はなし**。
  出典: https://docs.nocobase.com/get-started/translations 、https://docs.nocobase.com/system-management/language-settings/
- 切替: システム設定「Enabled Languages」の先頭が既定言語。複数有効時はユーザーが Personal Center で個人設定。
  出典: https://docs.nocobase.com/system-management/language-settings/
- **Localization Management** プラグイン: システム・プラグインの言語パックに加え、コレクション名・フィールド名・メニューの翻訳エントリを同期して UI 上で編集・公開。AI 従業員「Lina」による一括翻訳。
  出典: https://docs.nocobase.com/system-management/localization/ 、https://docs.nocobase.com/ai-employees/built-in/lina
- ドキュメント自体に日本語版あり（例 https://docs.nocobase.com/ja/get-started/installation/docker ）。

貴社の「日本語と中国語を常に一致させる」運用は、Localization Management でコレクション名・フィールド名の ja / zh 訳を同じ画面で管理できる点が合います。

### E-7. 中国からの到達性・中国国内デプロイ — 記載あり

- 中国語ドキュメント: https://docs.nocobase.com/cn/ 。
- **Aliyun イメージミラー**: 中国語版 Docker ページに `registry.cn-shanghai.aliyuncs.com/nocobase/nocobase:latest-full`（beta-full / alpha-full も）を明記。英語版には記載なし。
  出典: https://docs.nocobase.com/cn/get-started/installation/docker
- 中国語サイト https://www.nocobase.com/cn （ICP 備案あり、Gitee GVP リンク、中国企業事例）。価格は人民元建て（C-5）。Professional に国産 DB（KingbaseES）、Enterprise に OceanBase 対応。
  出典: https://www.nocobase.com/cn 、https://www.nocobase.com/cn/commercial
- Gitee ミラー: https://gitee.com/nocobase/nocobase（公式サイトからリンク。本文は robots 制限で未取得）。
- ライセンス認証は「Instance ID」とライセンスキーによる（C-5）。オフライン認証の可否は記載なし。

NocoBase は中国（北京）の会社が開発しており、中国国内のミラー・価格・ドキュメントが整っています。「中国国内ネットワークで単独稼働」の方針とは相性が良い製品です。

---

## 6. 貴社構成への含意

前提の6方針それぞれについて、調査結果から言えることをまとめます。

**方針4「PostgreSQL を業務データの正本にする」**

成立します。選択肢は2つで、どちらを取るかが最初の設計判断です。

| | 方式 (a) メインDB内で業務テーブルを管理 | 方式 (b) 外部データソースとして別DBを接続 |
|---|---|---|
| エディション | 無料 | Standard+ |
| 既存テーブルの取込 | Load from database | 接続時にスキーマ・接頭辞で絞り込み |
| NocoBase による業務テーブルへの変更 | UI から列追加すると DDL が実行される（記載あり）。取込済みテーブルに勝手に列を足すかは記載なし | 一切変更しない（明記） |
| リレーション | NocoBase が設定を作成（DB の FK 制約有無は記載なし） | メタデータのみ。FK は DB 側で自前管理 |
| Migration Manager の対象 | 対象（Schema-only で構造だけ移送可） | **対象外**（外部DBは移行しない） |
| Backup Manager の対象 | 対象 | 対象外（自前で pg_dump） |
| システムテーブルとの分離 | `DB_TABLE_PREFIX` または `COLLECTION_MANAGER_SCHEMA`（後者はドキュメント記載なし） | 物理的に別DB／別スキーマ |

「NocoBase をやめても業務データを移行可能に」という観点では、方式 (b) が最も素直です（NocoBase は業務DBに触らない）。ただし方式 (b) では Migration Manager がその業務テーブルの構造を運ばないので、DDL は Git 管理の SQL（Flyway 等）で別途流す必要があります。これは「PostgreSQL 側で先にテーブルを設計する」方針とは矛盾せず、むしろ整合します。

方式 (a) を取る場合は、最初に `DB_UNDERSCORED=true`、`DB_TABLE_PREFIX`（システムテーブル側に付ける）、主キー型（Integer または UUID）を決め、以後変更しないでください。これらは後から変えられず、Migration Manager も両環境の一致を要求します。

**方針3「AD を Identity の正本」**

Auth: LDAP（Professional+）で認証は可能ですが、LDAPS / TLS の記載がありません。導入前に「LDAP URL に `ldaps://` を指定できるか、証明書はどう扱うか」を公式に確認する必要があります。AD グループ→ロールの直接マッピングは記載がなく、AD の **OU** を部署として同期し「部署ロール」で権限を与える経路が唯一ドキュメントに書かれた方法です。AD 側が OU ではなくセキュリティグループで組織を表現している場合は、ロール付与を手動か Workflow / API で補う設計になります。

**「同じ定義・別データ」（デモと本番）**

Migration Manager（Professional+）と Release Management ガイドが公式にこの用途をカバーしています。デモ環境を定義の正本にし、`collections` / `fields` / `uiSchemas` / `roles` は Overwrite、業務テーブルは Schema-only で本番へ流す運用です。ライセンスが Instance ID 単位のため、デモ・本番の2インスタンスに1ライセンスで足りるかは要問合せです。

**Dify 連携**

HTTP request ノード（Workflow）と Custom request アクション（ボタン）はどちらも無料で、Dify の API を呼ぶには十分です。AI employees プラグインの LLM サービスとして Dify を直接登録する記載はありません。iframe で Dify の画面を埋め込む場合、ログイン状態の引き継ぎに関する記載はありません。

**残る確認事項（公式へ問い合わせ推奨）**

1. Auth: LDAP の LDAPS / 証明書対応
2. 1ライセンスでカバーできるインスタンス数（デモ + 本番）
3. 商用比較表と docs/plugins の間で不一致のある機能（Migration Manager 等）の正式なエディション
4. 方式 (a) で取り込んだ既存テーブルに NocoBase が列を追加することがあるか
5. UI からリレーションを作った際に DB レベルの FK 制約が作られるか

---

## 参照した公式 URL 一覧

リリース・エディション・価格
- https://github.com/nocobase/nocobase/releases 、https://github.com/nocobase/nocobase/releases/latest
- https://docs.nocobase.com/plugins
- https://www.nocobase.com/en/commercial 、https://www.nocobase.com/cn/commercial 、https://www.nocobase.com/en/agreement
- https://www.nocobase.com/en/blog/nocobase-commercial-license-activation-guide
- https://www.nocobase.com/en/blog/weekly-updates-20260226 、https://www.nocobase.com/en/blog/2.2.0 、https://www.nocobase.com/en/blog/2-0-beta 、https://www.nocobase.com/en/blog/nocobase-2-0-officially-released

A（データソース・コレクション）
- https://docs.nocobase.com/data-sources/data-source-main/ 、https://docs.nocobase.com/data-sources/main/postgresql
- https://docs.nocobase.com/data-sources/data-source-external-postgres/ 、https://docs.nocobase.com/data-sources/data-source-manager/external-database 、https://docs.nocobase.com/data-sources/data-source-manager/
- https://docs.nocobase.com/data-sources/data-source-main/general-collection 、https://docs.nocobase.com/data-sources/data-modeling/collection
- https://docs.nocobase.com/data-sources/data-modeling/collection-fields/associations/ （/m2o/ 、/o2m/ 、/m2m/）
- https://docs.nocobase.com/data-sources/data-modeling/collection-fields/advanced/snowflake-id 、https://docs.nocobase.com/data-sources/data-modeling/collection-fields/system-info/created-by 、https://docs.nocobase.com/data-sources/field-sort/
- https://docs.nocobase.com/data-sources/collection-view/ 、https://docs.nocobase.com/data-sources/collection-sql/
- https://docs.nocobase.com/get-started/installation/env 、https://docs.nocobase.com/api/cli/init 、https://docs.nocobase.com/api/database/collection
- ソース: https://github.com/nocobase/nocobase/blob/main/packages/core/database/src/database.ts 、…/helpers.ts 、https://github.com/nocobase/nocobase/blob/main/packages/plugins/@nocobase/plugin-data-source-main/src/server/collections/collections.ts 、…/fields.ts 、…/models/collection.ts 、https://github.com/nocobase/nocobase/blob/main/packages/plugins/@nocobase/plugin-data-source-manager/src/server/collections/data-sources-collections.ts

B（移行・環境）
- https://docs.nocobase.com/ops-management/migration-manager/ 、https://docs.nocobase.com/ops-management/migration-manager/built-in-tables
- https://docs.nocobase.com/ops-management/release-management/ 、https://docs.nocobase.com/ops-management/version-control/
- https://docs.nocobase.com/ops-management/backup-manager/ 、https://www.nocobase.com/en/blog/nocobase-backup-restore
- https://docs.nocobase.com/ops-management/variables-and-secrets/ 、https://docs.nocobase.com/multi-app/multi-app/

C（認証・権限）
- https://docs.nocobase.com/auth-verification/auth-ldap/ 、https://docs.nocobase.com/auth-verification/auth-saml/ 、https://docs.nocobase.com/auth-verification/auth-oidc/ 、https://docs.nocobase.com/auth-verification/auth-cas/
- https://docs.nocobase.com/users-permissions/sync/ 、https://docs.nocobase.com/users-permissions/sync/sources/ldap
- https://docs.nocobase.com/users-permissions/departments/ 、https://docs.nocobase.com/users-permissions/departments/role
- https://docs.nocobase.com/users-permissions/acl/permissions 、https://docs.nocobase.com/users-permissions/acl/role 、https://docs.nocobase.com/users-permissions/acl/ui
- https://docs.nocobase.com/interface-builder/blocks/block-settings/data-scope 、https://docs.nocobase.com/interface-builder/variables

D（連携・UI）
- https://docs.nocobase.com/interface-builder/actions/types/custom-request 、https://docs.nocobase.com/interface-builder/actions/action-settings/bind-workflow 、https://docs.nocobase.com/interface-builder/actions/types/js-action 、https://docs.nocobase.com/interface-builder/actions/types/link
- https://docs.nocobase.com/workflow/nodes/request 、https://docs.nocobase.com/workflow/triggers/custom-action 、https://docs.nocobase.com/workflow/nodes/response-message 、https://docs.nocobase.com/workflow/nodes/javascript 、https://docs.nocobase.com/workflow/nodes/json-query 、https://docs.nocobase.com/workflow/triggers/webhook
- https://docs.nocobase.com/ai-employees/features/llm-service 、https://docs.nocobase.com/ai-employees/configuration/admin-configuration 、https://docs.nocobase.com/ai-employees/features/mcp 、https://docs.nocobase.com/ai-employees/workflow/nodes/llm/chat
- https://docs.nocobase.com/interface-builder/blocks/other-blocks/iframe 、https://docs.nocobase.com/integration/embed/ 、https://docs.nocobase.com/plugins/@nocobase/plugin-public-forms/
- https://docs.nocobase.com/interface-builder/blocks/data-blocks/grid-card 、…/list 、…/kanban 、https://docs.nocobase.com/interface-builder/blocks/other-blocks/markdown 、…/js-block 、https://docs.nocobase.com/data-sources/data-modeling/collection-fields/basic/url
- https://docs.nocobase.com/data-visualization/ 、https://docs.nocobase.com/data-visualization/guide/data-query 、…/chart-options 、…/filters-and-linkage

E（運用）
- https://docs.nocobase.com/get-started/system-requirements 、https://docs.nocobase.com/get-started/installation/docker 、…/create-nocobase-app 、…/git 、https://docs.nocobase.com/ai/install-nocobase-app 、https://docs.nocobase.com/get-started/quickstart
- https://docs.nocobase.com/get-started/deployment/production 、https://docs.nocobase.com/get-started/deployment/intranet/docker
- https://docs.nocobase.com/get-started/upgrading/docker 、…/create-nocobase-app 、…/git 、https://docs.nocobase.com/get-started/install-upgrade-plugins
- https://docs.nocobase.com/cluster-mode/ 、https://docs.nocobase.com/cluster-mode/preparations 、https://docs.nocobase.com/cluster-mode/kubernetes
- https://docs.nocobase.com/plugin-development/ 、…/project-structure 、…/build 、…/client/i18n
- https://docs.nocobase.com/get-started/translations 、https://docs.nocobase.com/system-management/language-settings/ 、https://docs.nocobase.com/system-management/localization/ 、https://docs.nocobase.com/ai-employees/built-in/lina
- https://docs.nocobase.com/cn/get-started/installation/docker 、https://www.nocobase.com/cn

注記: ページ取得は要約ツールを経由しているため、引用は取得時に返された文言に基づきます。契約・設計の最終判断前には各 URL の原文を確認してください。
