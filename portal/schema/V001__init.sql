-- portal/schema/V001__init.sql — 素の PostgreSQL（Flyway 形式）
--
-- 設計書: docs/handoff/2026-09-10-portal-nocobase.md §8-2' ①・docs/handoff/2026-09-11-repo-layout-v3.md §2-3。
-- 方式 (a) の歯止め（README.md 参照）：
--   1. DB_UNDERSCORED=true（NocoBase 側の設定。ここでは列名を最初から snake_case にする）
--   2. DB_TABLE_PREFIX=nb_ は NocoBase の *システムテーブル* にのみ付く。ここに並ぶ業務テーブルには付けない
--   3. 主キーはすべて bigint GENERATED ALWAYS AS IDENTITY（NocoBase 既定の Snowflake ID を使わない）
--
-- 実データは 1 バイトも入れない（tools/check-nodata.mjs G2 で *.sql の混入経路も検査）。
-- このファイルは DDL のみで、INSERT 文は置かない（データは NocoBase の画面 or 別スクリプトから投入する）。

CREATE TABLE departments (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name_ja       text NOT NULL,
  name_zh       text,
  name_en       text,
  parent_id     bigint REFERENCES departments (id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE staff (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  department_id bigint REFERENCES departments (id),
  role          text,
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
-- 氏名・連絡先は実データ（外部データソース経由）にのみ存在する。このテーブルには持たせない。

CREATE TABLE customers (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name_ja       text NOT NULL,
  name_zh       text,
  name_en       text,
  industry      text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contacts (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id   bigint NOT NULL REFERENCES customers (id),
  role          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE opportunities (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id   bigint REFERENCES customers (id),
  owner_id      bigint REFERENCES staff (id),
  stage         text NOT NULL DEFAULT 'new',
  amount        numeric(14, 2),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  code          text UNIQUE,
  customer_id   bigint REFERENCES customers (id),
  owner_id      bigint REFERENCES staff (id),
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects_history (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id    bigint NOT NULL REFERENCES projects (id),
  changed_at    timestamptz NOT NULL DEFAULT now(),
  changed_by    bigint REFERENCES staff (id),
  field         text NOT NULL,
  old_value     text,
  new_value     text
);

CREATE TABLE todos (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id    bigint REFERENCES projects (id),
  assignee_id   bigint REFERENCES staff (id),
  title         text NOT NULL,
  due_date      date,
  priority      text NOT NULL DEFAULT 'mid',
  status        text NOT NULL DEFAULT 'open',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE todos_history (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  todo_id       bigint NOT NULL REFERENCES todos (id),
  changed_at    timestamptz NOT NULL DEFAULT now(),
  changed_by    bigint REFERENCES staff (id),
  field         text NOT NULL,
  old_value     text,
  new_value     text
);

-- ai_services: 管理番号（KN-02 形式）の台帳。名称・分類・成熟度は seed/catalog.json から seed する
-- （正本は shoulang0729/dify の mock/js/data/catalog.js。CATS/SVCS）。
CREATE TABLE ai_services (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  mgmt_code     text UNIQUE NOT NULL,   -- 例: KN-02
  name_ja       text NOT NULL,
  name_zh       text,
  name_en       text,
  category      text,
  maturity      smallint NOT NULL,      -- 1=提供中 / 2=試行版 / 3=構想（shoulang0729/dify CLAUDE.md §2-7 と同じ値域）
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- knowledge_categories: 全社 6 ＋ 部門 6 の大分類・中分類 46（seed/catalog.json から seed。本文は持たない）
CREATE TABLE knowledge_categories (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scope         text NOT NULL,          -- 'corp' | 'dept'
  major_code    text NOT NULL,          -- 例: C1 / D1
  major_name    text NOT NULL,
  minor_name    text NOT NULL,
  review_days   integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- kpi_topics: 組織 KPI の観点（9 観点・指標 52 件。seed/catalog.json から seed）
CREATE TABLE kpi_topics (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic_code    text UNIQUE NOT NULL,   -- 例: K1
  topic_name    text NOT NULL,
  measure_name  text NOT NULL,
  frequency     text,
  source_state  text,                   -- 'have' | 'connect' | 'new'
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- goal_topics: 個人目標（MBO）の観点（8 観点。seed/catalog.json から seed）
CREATE TABLE goal_topics (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  topic_code    text UNIQUE NOT NULL,   -- 例: P1 / P0
  topic_name    text NOT NULL,
  measure_type  text NOT NULL,          -- 'auto' | 'mix' | 'man'
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- v_pipeline: 案件のステージ別集計ビュー（NocoBase Community でもコレクションとして取り込める。
-- 設計書 docs/handoff/2026-09-10-portal-nocobase.md §4-11-2' 利点1）
CREATE VIEW v_pipeline AS
SELECT
  stage,
  count(*)      AS opp_count,
  sum(amount)   AS total_amount
FROM opportunities
GROUP BY stage;
