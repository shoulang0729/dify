# portal/seed/ — 生成物。手で編集しない

`node portal/scripts/gen-seed.mjs` が shoulang0729/dify の `data/world/**`（mfg/fin/it の 3 世界）・
`mock/js/data/catalog.js`（CATS/SVCS）・`mock/js/data/portal/{common,mgmt}.js`（ナレッジ 46・KPI 52・
MBO 8 の指標名）・`dify/env/cloud-master/env.yml` の `apps:` から生成する。

**手で直しても次の CI（`node tools/check-seed-fresh.mjs`）が必ず落とす。** 増やすときは正本
（`shoulang0729/dify` 側）に足してから、このディレクトリで `node scripts/gen-seed.mjs` を再実行する
（設計書 `docs/handoff/2026-09-11-repo-layout-v3.md` §2-5）。

| ファイル | 内容 |
|---|---|
| `world/{mfg,fin,it}/{company.md,org.csv,people.csv}` | 架空世界（`data/world/` の手コピーではなく生成物） |
| `catalog.json` | サービスカタログ（管理番号）・分類・ナレッジ／KPI／MBO の指標名 |
| `apps.json` | 管理番号 → Dify アプリ id（値は常に `null`。実 id は持ち込まない） |
