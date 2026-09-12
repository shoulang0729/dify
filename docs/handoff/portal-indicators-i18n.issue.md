# ポータルの指標名を 3 言語で確定する（ナレッジ 12＋46 / KPI 9＋52 / MBO 8 ＝ 127 件）

- 設計書: `docs/handoff/2026-09-12-portal-indicators-i18n.md`
- ラベル: `run:cloud`
- レーン: **M/L**（データ層の正本を新設し、`portal/` の DDL・seed の形を変える）
- 前提: `docs/handoff/2026-09-10-portal-nocobase.md` §18-1（PM 決定 2026-09-11・#276。指標名はモックの現行 ja 名で確定。zh/en は「まだやらない」として残っていた）

## 何をするか

§18-1 が残した「**zh / en がまだ無い**」を閉じる。**翻訳は設計書 §5 に 127 件すべて書いてある**（`CLAUDE.md` §4：翻訳を implementer に投げない）。**implementer は設計書から転記するだけで、新しい訳を作らない。**

### 決めたこと（設計書 §0）

1. **正本は `data/world/it/` の CSV 3 本**（新設）。`knowledge_categories.csv`（58 行）・`kpi_topics.csv`（61 行）・`goal_topics.csv`（8 行）。列は `kind,code,parent,seq,name_ja,name_zh,name_en`（ナレッジのみ先頭に `scope`）。
2. **`name_ja` はモックとバイト一致**（§18-1 の決定を動かさない）。**zh/en の正本はこの CSV**。**属性（review_days・frequency・src_state・measure_type）の正本はモックのまま**。
3. **モックは 1 バイトも触らない**（D12 維持。指標名は日本語表示のまま）。
4. `data/world/it/kpi.csv` には**相乗りさせない**（`check-world.mjs` W8 の warn が爆発するため）。`tools/check-world.mjs` の変更は**不要**（読むファイル名を明示列挙しているので新ファイルは無視される）。

## PR の分割

| PR | 内容 | 触るファイル |
|---|---|---|
| **PR-1**（ルート） | 正本 CSV 3 本 ＋ `data/world/README.md` の `it/` 表に 3 行 ＋ `tools/verify.mjs` **§19**（19-a〜19-f） | `data/world/it/{knowledge_categories,kpi_topics,goal_topics}.csv`（新）・`data/world/README.md`・`tools/verify.mjs` |
| **PR-A**（portal・バグ修正） | 既存バグ 2 件（設計書 §12）。i18n と無関係なので diff を分ける | `portal/scripts/gen-seed.mjs`・`portal/schema/V001__init.sql`・`portal/schema/README.md`・`portal/seed/catalog.json`（再生成） |
| **PR-2**（portal・本体） | `gen-seed.mjs` が CSV を読み `name:{ja,zh,en}` で出す ＋ DDL に `name_zh`/`name_en` ＋ seed 再生成 | `portal/scripts/gen-seed.mjs`・`portal/schema/V001__init.sql`・`portal/schema/README.md`・`portal/README.md`・`portal/seed/catalog.json` |

- **PR-1 と PR-A は並列可**（ファイル集合が重ならない。`CLAUDE.md` §5）。
- **PR-2 は PR-1・PR-A の両方に依存（直列）**。CSV が無いと `gen-seed.mjs` が動かず、PR-A と同じ 4 ファイルを触る。

## 受け入れ条件

1. **127 件すべてに ja・zh・en。空値ゼロ・`en` にかなゼロ**（`CLAUDE.md` §2-1）。
2. **`name_ja` がモックとバイト一致**（`tools/verify.mjs` §19-c）。**わざと 1 文字ずらすと FAIL する**ことを実装者が確認し PR 本文に書く。
3. **`mock/**` は 1 バイトも変わっていない。**
4. **`portal/seed/**` は手編集ゼロ**（`gen-seed.mjs` の出力のみ）。`node portal/scripts/gen-seed.mjs --check` がバイト一致。
5. ルート `npm test` PASS ／ portal を触る PR は `npm run portal:test` も PASS。**ルート `package.json` の `dependencies` はゼロのまま**（`CLAUDE.md` §2-14）。
6. `npm run world` の warn が **12 件のまま**（PR-1 で確認）。
7. 実在企業名・実 URL・実データが 1 つも入っていない（`portal/tools/check-nodata.mjs` に新しい NG が出ない）。

## 触らない範囲（設計書 §11）

- **`mock/**` 全部**（`common.js`・`mgmt.js` のリテラル、`render.js`、`PT`、`css/**`、`scenarios/**`）
- **`data/world/mfg/**`・`data/world/fin/**`**、および **`data/world/it/` の既存 8 ファイル**（特に `kpi.csv`）
- `tools/check-world.mjs`・`tools/regress.mjs`・`tools/regress.baseline.json`（ポータルのデータは regress の対象外。実走で確認済み）
- `dify/**`・`docs/service-map.md`・`.github/workflows/**`
- **`.claude/**`・`CLAUDE.md`**（本件に load-bearing の変更は無い。`localStorage` キーも増えない）
- 既存の設計書 3 本（`2026-09-10-portal-nocobase.md` 等）。**本書は §18-1 を覆さず、その「まだやらない」を埋めるだけ**

## ついでに直す既存バグ（設計書 §12。PR-A）

1. `portal/scripts/gen-seed.mjs` が `PKNOW` 行の **index 3（文書数）** を `reviewDays` に入れている（`C1` が `90` ではなく `18`）。12 行すべて誤り。
2. `portal/schema/V001__init.sql` の `kpi_topics.topic_code` が `UNIQUE`。**1 行 1 指標なので `K1` が 7 行に出る＝ 2 行目の INSERT で落ちる。**

どちらも実機が無いので今は誰も踏んでいない。

## PM 判断待ち（設計書 §13）

1. **zh / en の一読**（127 件）。特に `全社の基本動作 → 全公司基本工作规范`、`中国拠点の実務 → 中国分公司实务`、**`稼働率` の訳し分け**（K4 人＝`稼动率` / K5 システム＝`系统可用率`）。NG があれば差し戻し。
2. **モックは日本語のままでよいか**（D12 維持）。中国語で見せたいなら別 Issue（`render.js` の見出し・散文ごと `PT` へ移す作業が付く）。
3. `P0 共通・必須` の zh を `通用・必须` とし、`PT.gCommon` の既存訳 `共通业务` と字面を揃えなかった。既存訳を直すなら別 Issue。
4. `portal/schema/V001__init.sql` を **`V002__` を作らず直接書き換える**ことの確認（実機がまだ無いため）。
