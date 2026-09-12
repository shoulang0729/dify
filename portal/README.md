# portal — 社内向けポータル（NocoBase Community）

**このディレクトリは `shoulang0729/dify` の⑤ポータル。**元は別リポジトリ `shoulang0729/portal`
（PR #1 `feat/portal-skeleton`）にあった骨組みを、設計書 `docs/handoff/2026-09-11-repo-layout-v3.md`
（rev2）の PM 決定（1 リポに統合）に従ってここへ移した。**`shoulang0729/portal` は取り込み後に PR #1 を
close し、リポジトリを archive する**（同設計書 §7・§9-1 PR-N3）。

社内向けポータルサイト（[NocoBase](https://www.nocobase.com/) Community 版）。**部門内の意識合わせ**に
使う、AI サービスの入口 ＋ 経営管理（KPI・目標・要員）・フロント業務・共通業務・バック業務を載せる面。
[`shoulang0729/dify`](https://github.com/shoulang0729/dify) の
`docs/dify/platform-components.md` にある **PC-16 本番 UI (b)（自前フロント）の実装**であり、既存の
サービスカタログ（管理番号・`SVCS`）・`data/world/` の架空世界・env レイヤーと**同じ製品の別デプロイ単位**
（別製品ではない）。設計の経緯・判断根拠は `shoulang0729/dify` の設計書
`docs/handoff/2026-09-10-portal-nocobase.md` と `docs/handoff/2026-09-11-repo-layout-v3.md` に
まとまっている（**参照は相対パスではなくリポジトリ名つきで書く。切り出し後も読めるように**。設計書
§4-2 S-4）。

**用語の注意**：`mock/portal.html`・`mock/js/portal/**`・`mock/js/data/portal/**`（①デモに含まれる
「部門ポータル（モック）」。Pages に出る）と、この `portal/`（⑤ポータル。NocoBase の定義・DDL）は**別物**。
`shoulang0729/dify` の `CLAUDE.md` §2-14 を参照。

## ⚠️ 実データは入りません

このディレクトリに入るのは **「定義」**（画面・スキーマ・ロール・ワークフローの構成。`nocobase/export/`）と
**「架空のデモデータ」**（`shoulang0729/dify` の `data/world/` 由来。`seed/**`。**生成物、手で編集しない**）
だけ。**実在の従業員・顧客・取引先の氏名、実際の勤怠・年休・研修の記録、本番の接続情報・API キー・
パスワードは 1 バイトも書きません。** 本番は「空の定義」をここからデプロイし、中身（実データ）は社内の
外部データソース（人事・勤怠・研修システムへの読み取り専用接続）から別途つなぎます。

このルールは `tools/check-nodata.mjs`（`npm test` に含まれる）で機械的に検査しています。詳細は
[`CLAUDE.md`](./CLAUDE.md) §1・§3 と `tools/check-nodata.mjs` の冒頭コメント、既知の warn は
[`docs/nodata-known.md`](./docs/nodata-known.md) を参照してください。

## ディレクトリの地図

| ディレクトリ | 内容 |
|---|---|
| `schema/` | 素の PostgreSQL の DDL（Flyway 形式）。**NocoBase をやめても残る層**。`README.md` に初日固定 3 値（`DB_UNDERSCORED`／`DB_TABLE_PREFIX`／主キー型）を明記 |
| `nocobase/export/` | 定義エクスポート（画面・コレクション・ロール・ワークフロー）の置き場。実機がまだ無いので現時点は空（`.gitkeep`） |
| `nocobase/docker/` | NocoBase を動かす docker-compose 構成と `.env.example` |
| `nocobase/plugins/` | 自作プラグイン（TypeScript）。当面は空（`.gitkeep`） |
| `seed/` | **生成物。手で編集しない。** `data/world/{mfg,fin,it}` と `mock/js/data/portal/*.js` の指標名（ナレッジ 46・KPI 52・MBO 8。ja は `mock/js/data/portal/{common,mgmt}.js`、zh/en は `data/world/it/{knowledge_categories,kpi_topics,goal_topics}.csv` が正本）・`mock/js/data/catalog.js` のカタログ・`dify/env/cloud-master/env.yml` の `apps:` から `scripts/gen-seed.mjs` が生成する |
| `env/` | 環境差分（`dify/env/` と同じ作法）。`demo/portal.yml` は架空世界の値を直値で書いてよい。`prod/portal.yml` は `${VAR}` だけ |
| `scripts/` | `gen-seed.mjs`（seed の生成） |
| `tools/` | 機械検証（`check-nodata.mjs`・`check-seed-fresh.mjs`） |
| `docs/` | このディレクトリに閉じた記録（`nodata-known.md`・`split.md`） |

## 検証

```bash
npm --prefix portal ci
npm --prefix portal test           # = check-nodata.mjs && check-seed-fresh.mjs
node portal/scripts/gen-seed.mjs   # seed/** を再生成
node portal/tools/check-nodata.mjs --strict     # warn も含めて厳しく見る（掃除の PR 用）
```

ルート側からは `npm run portal:test`（`shoulang0729/dify` の `package.json`）で同じことができる。
**ルート `npm test` はこのディレクトリを 1 バイトも見ない**（`CLAUDE.md` §2-14）。

## 取り込み元

このディレクトリの `CLAUDE.md`・`package.json`・`.gitignore`・`.env.example`・
`tools/check-nodata.mjs`・`tools/nodata-common-words.txt`・`docs/nodata-known.md` は
`shoulang0729/portal` の PR #1（`feat/portal-skeleton`、2 commit）から、設計書
`docs/handoff/2026-09-11-repo-layout-v3.md` §7 の条件（C-a〜C-e）を満たすものだけをコピーして
持ち込んだ（履歴は持ち込まない。`git subtree add` は使わない）。`seed/world/**` は元 PR のファイルを
そのままコピーせず、`scripts/gen-seed.mjs` で `shoulang0729/dify` の `data/world/**`（3 世界）から
生成し直した。`.github/workflows/verify.yml`（元 PR）は持ち込まず、`.github/workflows/portal-verify.yml`
として書き直した。

## 切り出し（GitLab 移行時）

`git subtree split --prefix=portal` で `portal/**` の履歴だけを独立リポジトリへ抜き出せる。手順は
[`docs/split.md`](./docs/split.md)。

## 関連

- [`shoulang0729/dify`](https://github.com/shoulang0729/dify) — 管理番号・サービスカタログ・
  架空世界（`data/world/`）の**正本**。AI エージェントカタログのモックは
  <https://shoulang0729.github.io/dify/> で公開中
