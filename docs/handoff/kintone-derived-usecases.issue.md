# Issue 本文（`gh` 不在のためファイルで渡す）

起票済み：#320

> PM へ：この本文で起票してください。起票後、番号を設計書の冒頭「Issue 本文」行の横に追記します（architect が §16 追補として足します。本文は書き換えません）。

---

## タイトル

```
ノーコード業務 DB 由来の新規ユースケース 4 件（QA-05 / KN-12 / NM-06 / DC-12）＋ 新中分類 qa/safety
```

## ラベル

- `run:cloud`（設計・実装・レビュー・文書。ネットワークを使わない検証だけで完結する）
- **`run:*` は 1 つだけ**（`CLAUDE.md` §7）

---

## 概要

イベントで入手したノーコード業務 DB（kintone）の製品パンフレットから着想し、青嶺精工・蘇州工場の世界に置き換えた**新規ユースケース 4 件**をカタログに足す。あわせて **kintone の位置づけ（⑤ポータル／NocoBase の代替候補）**を設計書に 1 節だけ残す（**PoC はやらない。別 Issue にもしない**）。

| 管理番号 | 名称 | 分類/中分類 | `st` | 画面 | `place` |
|---|---|---|---|---|---|
| **QA-05** | ヒヤリハット・5S巡回記録の要約と傾向分析 | `qa`/**`safety`（新設）** | 3 | `upload` | `qual` |
| **KN-12** | 修理依頼のトリアージ（設備台帳・修理履歴・点検表の突き合わせ） | `kn`/`tech` | 3 | `form` | `sys` |
| **NM-06** | 棚卸差異の原因候補と処理案 | `nm`/`actual` | 3 | `upload` | `order` |
| **DC-12** | 承認者向けの申請要約と類似案件・規程照合 | `dc`/`apply` | 3 | `form` | `req` |

いずれも `industries: ['mfg']`・`added: '2026-09-21'`。**新規採番（永久欠番・改名なし）**。

## 設計書

- **`docs/handoff/2026-09-21-kintone-derived-usecases.md`**（3 言語リテラル全文・世界マスタ追加行・受け入れ条件の実走出力・PR 分割案まで入っている）
- 実装リファレンス：`docs/dify/usecases/{QA-05,KN-12,NM-06,DC-12}.md`（`_TEMPLATE.md` の 10 節すべて）
- 関連：`docs/handoff/2026-09-10-portal-nocobase.md` §19（3 行追補）／`docs/dify/platform-components.md`（PC-01・PC-03・PC-04・PC-13・PC-14 の「使うサービス」行）

## 受け入れ条件

1. `node tools/verify.mjs` → **`✅ ALL PASS / ⚠️ 17 warn`**。**warn の件数も中身も変更前と完全一致**（新しい warn を 1 件も増やさない）
2. `node tools/regress.mjs` → PASS。counts が
   `{"cats":15,"subs":36,"svcs":87,"tags":67,"ui":94,"byIndustry":{"mfg":{"svcs":55,"cats":10},"fin":{"svcs":30,"cats":8},"it":{"svcs":26,"cats":7}},"svcsMulti":12}`
   （変更前は `subs:35 / svcs:83 / mfg:51`）。`--update` は **PR-C でのみ**行い、PR 本文に「設計書 §10 のデータ変更に伴う基準更新」と書く
3. `node tools/check-world.mjs` → **3 本すべて適用後に合計 12 件**（製造 10／金融 1／IT 1／横断 0）。**変更前と同じ**。※ PR-A だけが入りマスタ（PR-B）が未マージの中間状態では 26 件になる（設計書 §13-3。warn のみで CI には入らない）
4. `npm run index` 後に `node tools/gen-index.mjs --check` が `✅ docs/service-map.md は最新`
5. `npm run portal:test` → PASS（`node portal/scripts/gen-seed.mjs` を再実行して生成物をコミットしてある）
6. `mock/**` と `docs/demo/**` に **`kintone` という文字列が 1 つも無い**（`grep -ri kintone mock docs/demo` が 0 件）
7. 4 件の `SCENARIOS` の `q`／`a` に `'`（U+0027）が 1 文字も無い
8. Pages（`https://shoulang0729.github.io/dify/`）で、業種＝製造・分類 QA に**「安全・5S」中分類**が出て、QA-05 の詳細 → デモ（3 往復）が日本語・中国語の両方で動く。KN-12・NM-06・DC-12 も同様

## 触らない範囲（設計書 §12 が正。reviewer の diff 監査基準）

- **`tools/**` は 1 バイトも触らない**（`check-world.mjs` のパーサを `5S-` 接頭辞のために直すこともしない）
- `mock/js/app.js`・`render.js`・`events.js`・`mock/css/**`・`mock/*.html`：**`state` の形・`data-act` の 16 種・描画ロジック・トークンを変えない**
- `mock/js/data/ui.js`：**`TAGS` に新語を足さない**（使うタグはすべて既存）・**`TEMPLATES` を増やさない**
- `mock/js/data/home.js`（`HOME`/`FEED`）・`style.js`（`CAT_STYLE`）：触らない
- `mock/js/data/portal/**` は **`svc.js` の `PSVC` だけ**。**`PSCREENS` に新画面を足さない**
- `mock/assets/**`：ダミー資産を増やさない（`input.assets` を書かない）
- `data/world/fin/**`・`data/world/it/**`：**世界の語彙を混ぜない**。触るのは `mfg` だけ
- `dify/**`・`.github/workflows/**`・`.claude/**`・`docs/demo/**`：範囲外
- **`CLAUDE.md` は触らない**（件数表記のずれは別 Issue。設計書 §15 Q4）

## PR 分割案

```
PR-B（世界マスタ）─→ PR-A（docs）─→ PR-C（データ層）
```

| PR | 内容 | 主な検証 |
|---|---|---|
| **PR-A（docs）** | 設計書・Issue 本文・実装リファレンス 4 本・`platform-components.md`（5 行）・`2026-09-10-portal-nocobase.md` §19（3 行）・`docs/dify/usecases/README.md`（見出し 68→72 と一覧 4 行） | `npm test`（差分ゼロ） |
| **PR-B（世界マスタ）** | `data/world/mfg/{people,documents,partners,records}.csv`（1／2／1／16 行追記）・`calendar.md`（6 行追記）・`portal/seed/world/mfg/people.csv`（再生成） | `npm test`／`check-world`（12 件）／`npm run portal:test` |
| **PR-C（データ層）** | `catalog.js`（`qa/safety` 1 行＋`SVCS` 4 件）・`scenarios/mfg/{qa,kn,nm,dc}.js`（各 1 エントリ）・`portal/svc.js`（`PSVC` 4 件）・`regress --update`・`npm run index`・`portal/seed/catalog.json`（再生成）・`service-index.md`（分類コード表 QA 行＋サービス 4 行） | `npm test`／`index:check`／`portal:test`／Pages 目視 |

- **PR-A は PR-C より先**（`gen-index` が実装リファレンスの実在を見るため。逆順だと PR-A のマージ時点で `service-map.md` が古くなり verify §11 が FAIL する）
- **PR-B は PR-A より先を推奨**。PR-A だけが入った中間状態では `check-world` の warn が **12 件 → 26 件**に増える（設計書 §13-3 で実測。CI には入らないのでマージはブロックされない）
- **PR-B と PR-C はファイル集合が重ならないので並列可**だが（`seed/world/mfg/people.csv` ⇄ `seed/catalog.json`）、PR-C の台本が PR-B の番号・人名・数字を使うため**直列（PR-B → PR-C）を推奨**
- **PR-A と PR-B は並列可**（その場合も PR-B を先にマージする）

## PM 判断待ち（**すべて推奨案で進めてよい**。詳細は設計書 §15）

| # | 論点 | 推奨 | 状態 |
|---|---|---|---|
| Q1 | KN-12 の `place` を `know` ではなく **`sys`**（設備の稼働状況）に | `sys`（PM 推奨の条件「設備台帳画面が無ければ」を満たさないため） | ✅ 推奨案で進めてよい |
| Q2 | `5S-` 接頭辞が `check-world` の候補抽出に掛からない | **`tools/**` は直さず `calendar.md` に注記** | ✅ 推奨案で進めてよい |
| Q3 | 週番号（`W37`）をやめて日付ベースの番号に | 日付ベース（`W` が書式パーサの許可集合に無い） | ✅ 推奨案で進めてよい |
| **Q4** | `CLAUDE.md` §6 の件数表記が**既に 1 件ずれている**（§6 は 82／実測 83。本設計後は 87） | **本 Issue では触らない。別 Issue で追従** | ⚠️ **PM 判断**（触らない案で進めてよいなら本 Issue はそのまま進行できる） |
| Q5 | NM-06 の固定資産棚卸をモード化しない | モード化しない（`scope` の 1 パラメータ） | ✅ 推奨案で進めてよい |
| Q6 | QA-05 の週次まとめを人事評価に使わない | 使わないと明記して運用 | ✅ 推奨案で進めてよい |
| Q7 | kintone 連携の PoC | **やらない**（PM 決定。Issue にしない） | ✅ 決定済み |
