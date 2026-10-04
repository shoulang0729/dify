# rev4 残課題 R-1（IT の取引先担当者）・R-4（GN-05 の 3 業種化）

**ラベル**：`run:cloud`
**レーン**：M/L
**設計書**：`docs/handoff/2026-09-21-rev4-residuals-r1-r4.md`
**出所**：`docs/handoff/2026-09-12-portal-industry-rev4.md` §17 の **R-1** と **R-4**（**PM 決定 2026-09-21**。R-2・R-3 は保留）

---

## 何をするか

### R-1 —— IT ポータルの取引先担当者が製造・金融の人物を流用している（跨ぎ違反）

`mock/js/data/portal/front.js` の `PCONTACT.it`（102〜107 行）と `PHIST.it`（137〜148 行）が、
`data/world/{mfg,fin}/people.csv` の 6 名（**王 磊・佐藤 美咲・劉 洋・森下 隆一・高梨 直人・陳 慧**）を
そのまま使っている。`CLAUDE.md` §2-13 の跨ぎの例外は「**青嶺精工・碧洋銀行の社名と拠点名に限って**」であり、
**人・部署は跨がない**と明記されている。役職の列も `mfg/org.csv`・`fin/org.csv` の部署名そのものになっている。

→ **`data/world/it/client_contacts.csv` を新設し、IT 世界の固有の 6 名に差し替える。**
所属先は `clients.csv` の青嶺精工・碧洋銀行のまま（**社名と拠点名だけ跨ぐ**）。

| 新しい人（ja / zh / en） | 所属（社名だけ跨ぐ） | 拠点 | 役職（社内表記） | 置き換える人 |
|---|---|---|---|---|
| 万 沁 / 万沁 / Wan Qin | 青嶺精工 | 蘇州工場 | 情報システム 主任 | 王 磊（mfg） |
| 瀬戸 陽平 / 濑户阳平 / Yohei Seto | 青嶺精工 | 蘇州工場 | 生産システム 駐在担当 | 佐藤 美咲（mfg） |
| 岑 睿 / 岑睿 / Cen Rui | 青嶺精工 | 蘇州工場 | 工場 IT 運用 担当 | 劉 洋（mfg） |
| 卞 昊 / 卞昊 / Bian Hao | 碧洋銀行 | 上海本部 | 勘定系システム 主管 | 森下 隆一（fin） |
| 柴田 律 / 柴田律 / Ritsu Shibata | 碧洋銀行 | 上海本部 | 事務システム 受入担当 | 高梨 直人（fin） |
| 龐 雯 / 庞雯 / Pang Wen | 碧洋銀行 | 上海本部 | 帳票基盤 担当 | 陳 慧（fin） |

姓（万・瀬戸・岑・卞・柴田・龐）・名（沁・陽平・睿・昊・律・雯）とも、既存 55 名
（mfg 22・fin 17・it 5・mfg partner_contacts 6・fin client_contacts 5）と重複しない。

**`PHIST.it` も同時に直す**（`openHistDrawer()` が**氏名の文字列一致**で結合しているため）。
`PHIST.it` の本文にある他世界の部署名 3 か所（`総務`／`設備状況`／`審査部 定例`）も言い換える。

### R-4 —— GN-05（文書要約）を 3 業種に広げる

`SVCS.gn5.industries` を `['mfg']` → `['mfg', 'fin', 'it']` にし、**金融・IT の台本を 1 本ずつ新設**する。

- `place: '*'` は**文字列のまま**（3 業種ともホームの「横断で使う AI」。`gn6`/`gn7` と同じ作法。
  `dc8` のような業種別オブジェクトにはしない）
- **`SVCS.gn5` の `name` / `desc` は 3 言語とも 1 バイトも変えない**（業種を含意する語が無いことを確認済み）
- **`PSVC`（`mock/js/data/portal/svc.js`）は変更不要**（`place` も業種分割も持たない構造）
- 金融：高梨 直人（審査部次長・上海本部）が **丁社の中国語 設備投資計画書 62 ページ**を日本語 1 枚にし、
  `CRD-26-0096` / `RNG-2026-0158` の審査に使う
- IT：村井 拓也（営業課長・上海拠点）が **α 社の中国語 RFP 76 ページ**を日本語 1 枚にし、
  提案可否の判断と提案書 `PRP-2026-031` の骨子づくりに使う（顧客側の個人名は出さない）
- **新しい人名・番号体系・KPI 値はゼロ**。`data/world/{fin,it}/documents.csv` への追記も**不要**

**副次的な効果**：金融・IT のポータルから GN-05 を開いたときに出ていた
`PT.scriptWorldPlain`（「この台本は製造の世界のものです」）の代用表示が消える（`pscn()` の `from === want`）。

---

## 受け入れ条件（抜粋。全 35 件は設計書 §6）

**PR-1（R-1）**

- `npm test` が PASS。**`regress` の counts が 1 つも動かない**
  （`{"cats":15,"subs":36,"svcs":87,"tags":67,"ui":94,"byIndustry":{"mfg":{"svcs":55,"cats":10},"fin":{"svcs":30,"cats":8},"it":{"svcs":26,"cats":7}},"svcsMulti":12}`）
- `node tools/check-world.mjs` の warn が **12 件のまま**（mfg 10 / fin 1 / it 1 / multi 0）
- `node portal/scripts/gen-seed.mjs --check` が **PASS**（＝**`portal/seed/**` を触らない**）
- `grep -n "王 磊\|佐藤 美咲\|劉 洋\|森下 隆一\|高梨 直人\|陳 慧" mock/js/data/portal/` が**ヒット 0**
- IT ポータルの `cust`（取引先）で担当者 6 名、接触履歴の往復件数が **3 / 2 / 1 / 2 / 2 / 2 件**（合計 12）

**PR-2（R-4）**

- `npm run index` → `npm test` が PASS。**verify の warn は 17 件のまま**、
  `it` の「台本の無い SVCS」は **11 件（`kn4, kn5, dc2, dc8, gn6, gn7, po1, po2, po3, po4, eg1`）で並びも同じ**
- `node tools/regress.mjs` の差分が **4 行ちょうど**
  （`byIndustry.fin 30→31` / `byIndustry.it 26→27` / `svcsMulti 12→13` / `SVCS.gn5 industries [mfg]→[mfg,fin,it]`）
- `--update` 後：`{"cats":15,"subs":36,"svcs":87,"tags":67,"ui":94,"byIndustry":{"mfg":{"svcs":55,"cats":10},"fin":{"svcs":31,"cats":8},"it":{"svcs":27,"cats":7}},"svcsMulti":13}`
  （**`svcs` は 87 のまま。id は 1 つも増減しない**）
- `node tools/check-world.mjs` の warn が **12 件のまま**（台本を 2 本足しても増えない）
- `node portal/scripts/gen-seed.mjs` の差分が **`portal/seed/catalog.json` 1 本・`+3 -1` 行**だけ
- `git diff mock/js/data/catalog.js` が **1 行の置換だけ**

---

## 触らない範囲（全量は設計書 §5）

**1 バイトも触らない**：`CLAUDE.md`・`.claude/**`／`tools/*.mjs`・`tools/lib/load.mjs`（`regress.baseline.json` の
`--update` 生成物のみ例外）／`mock/css/**`／`mock/js/portal/{app,render,events}.js`・`mock/js/{app,render,events}.js`／
`mock/*.html`／`mock/js/data/portal/` の `ui.js`・`org.js`・`common.js`・`mgmt.js`・`back.js`・`sys.js`・**`svc.js`**／
`front.js` の `PSTAGE`・`PDEALS`・`PPART`・`PQTR`・`PNEWS`・`PVENDOR`・`PQUAL`・`PORDER`・`PCRED`・`PREG`／
`mock/js/data/{ui,home,style}.js`／**`mock/js/data/scenarios/mfg/**`**／`data/world/{mfg,fin}/**`／
`data/world/it/` の `client_contacts.csv` 以外／`portal/` の `seed/catalog.json` 以外／`dify/**`・`scripts/**`／
`.github/workflows/**`・`package.json`／**`docs/handoff/2026-09-12-portal-industry-rev4.md` の本文**／
`localStorage` のキー（`mock.lang`・`mock.theme`・`mock.fav` の 3 つのまま）

**値を変えるが形は変えない**：`front.js` の `PCONTACT.it`（6 行）・`PHIST.it`（12 行）／
`catalog.js` の `SVCS.gn5.industries`（1 プロパティ）／`GN-05.md`（2 行）／`service-index.md`（1 行）／
`data/world/README.md`（1 行＋1 段落）

---

## PR の分割案（**2 本・直列。PR-1 → PR-2 の順**）

| PR | 内容 | 触るファイル | 生成物 |
|---|---|---|---|
| **PR-1**（R-1） | IT の取引先担当者を IT 世界の人物に | `data/world/it/client_contacts.csv`（新規）／`data/world/README.md`／`mock/js/data/portal/front.js` | **なし** |
| **PR-2**（R-4） | GN-05 を 3 業種に | `mock/js/data/catalog.js`／`mock/js/data/scenarios/fin/gn.js`／`mock/js/data/scenarios/it/gn.js`／`docs/dify/usecases/GN-05.md`／`docs/handoff/service-index.md` | `docs/service-map.md`（`npm run index`）／`tools/regress.baseline.json`（`--update`）／`portal/seed/catalog.json`（`gen-seed`） |

**直列にする理由**：`portal/seed/**` を再生成するのは PR-2 だけで、PR-1 が先に入っていれば
PR-2 の seed 差分が「`catalog.json` の `+3 -1` 行」だけになり、reviewer が機械的に照合できる。
逆順・並列だとこの照合が効かなくなる。

**PR-2 の実行順**：① リテラル → ② `npm run index` → ③ `node tools/regress.mjs`（差分 4 行を目視）→
④ `node tools/regress.mjs --update` → ⑤ `node portal/scripts/gen-seed.mjs` → ⑥ `npm test` →
⑦ `npm run portal:test` → ⑧ `node tools/check-world.mjs`

PR 本文に「**設計書 `docs/handoff/2026-09-21-rev4-residuals-r1-r4.md` §4-3 のデータ変更に伴う基準更新**」と書く。

---

## PM 判断待ち（いずれもマージの条件ではない）

| # | 論点 | 推奨 |
|---|---|---|
| Q1 | `GN-05.md` §5-1 の System プロンプトが「青嶺精工 蘇州工場」を固定している | **別 Issue。**会社名は `dify/env/<env>/env.yml` の環境差分（`CLAUDE.md` §2-12）で、直すなら `dify/apps/`・`dify/env/`・`dify/tests/` を同時に動かす。**推奨で進めてよい** |
| Q2 | `CLAUDE.md` §2-13 の跨ぎの例外を「人」にも広げる案 | **却下を推奨**（`check-world` W1 の検出力が IT だけ落ちる）。**推奨で進めてよい** |
| Q3 | `tools/check-world.mjs` の走査範囲を `mock/js/data/portal/**` に広げるか（R-1 は warn にすら出なかった） | **別 Issue。**本件とファイル集合が重ならないので並列可。**推奨で進めてよい** |
| Q4 | rev4 §17 R-4 は **GN-05 と LG-01 の両方**を挙げていたが、PM 決定は GN-05 のみ | **GN-05 のみで進める**。読み違いが無いかの確認だけお願いしたい |
