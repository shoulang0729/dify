# rev4 残課題 R-1（IT の取引先担当者）・R-4（GN-05 の 3 業種化）

- 日付: 2026-09-21
- レーン: **M/L**（`data/world/**` の新設・データ層 `SVCS[].industries`・台本・`regress` 基準・`portal/seed/**` に触る）
- 実行場所: **`run:cloud`**（ネットワーク不要。設計・実装・検証すべてクラウドで回る）
- 種別: 設計書（architect）。実装は implementer、マージ判定は reviewer
- 出所: `docs/handoff/2026-09-12-portal-industry-rev4.md` **§17 の R-1 と R-4**。**PM 決定 2026-09-21：R-1・R-4 を実施、R-2・R-3 は保留**
- 関連: `CLAUDE.md` §2-1・§2-3・§2-9・§2-11・§2-13・§2-14／`data/world/README.md`「世界の語彙は混ぜない」／
  `data/world/it/company.md`「顧客と世界の跨ぎ」／`docs/handoff/2026-09-11-it-industry.md` §3-4／
  `docs/handoff/2026-09-12-portal-industry-rev4.md` §2-3（規則 3）・§8-3・§8-4・§17
- 本書の数字はすべて **`main`（`SVCS` 87 件・`regress` counts `{"svcs":87,...,"svcsMulti":12}`）の作業用コピーに
  リテラルと CSV 行を実際に差し込んで実走**して得たもの（§6 に出力を転記）

---

## §0 目的と PM 決定

### 0-1. 6 行

1. **R-1**：IT ポータルの取引先担当者 6 名が製造・金融の `people.csv` の人物だった（`CLAUDE.md` §2-13 の
   「**人・部署・品番・設備・KPI・文書番号は跨がない**」に違反）。**IT 世界の固有の人物 6 名を新設して差し替える。**
2. **R-1 の置き場**：`data/world/it/client_contacts.csv` を**新設**する（列は `data/world/mfg/partner_contacts.csv`
   と同一。金融の `data/world/fin/client_contacts.csv` と同じ作りになる）。所属は `clients.csv` の顧客
   **青嶺精工・碧洋銀行**で、**社名と拠点名だけを跨いで参照し、人物は IT 世界の新規人物**にする。
3. **R-1 の副作用**：`PCONTACT.it` の 6 行だけでなく、**`PHIST.it` の 12 行も同時に差し替える**
   （`openHistDrawer()` が `PHIST` を**氏名の文字列一致**で引くため。片方だけ直すと接触履歴が空になる）。
   あわせて `PHIST.it` の本文に混ざっている**他世界の部署名 3 か所**（`総務`／`設備`／`審査部 定例`）も言い換える。
4. **R-4**：`SVCS.gn5`（GN-05 文書要約）の `industries` を `['mfg']` → `['mfg', 'fin', 'it']` にし、
   **金融・IT の台本を 1 本ずつ新設**する。`place: '*'` は据え置き（3 業種のホームの「横断で使う AI」に出る）。
5. **`SVCS.gn5` の `name` / `desc` は 1 バイトも変えない**（3 言語とも「長文の報告書・仕様書・通達・メールスレッド」
   という横断的な書き方で、業種を含意する語が無いことを確認済み。§8 の判断待ち 1 件は別の話）。
6. **PR は 2 本。直列**。**PR-1（R-1）は `portal/seed/**` を再生成しない**（実走で確認。§2-4）、
   **PR-2（R-4）だけが `portal/seed/catalog.json` を再生成する**。順序は **PR-1 → PR-2**（§7）。

### 0-2. R-2・R-3 は本書の対象外

| # | 論点 | 本書での扱い |
|---|---|---|
| R-2 | `pt.js`（PT-01〜08）の台本が 2026 年の日付で、製造の世界の「今日」（2025-09）とずれる | **保留（PM 決定）**。`data/world/README.md` の「未統一」に記載済みのまま |
| R-3 | `goal`（目標）画面が 3 業種とも AI 0 本 | **保留（PM 決定）**。新サービスの採番が要るため `/usecase` の流れ |

---

## §1 事実（行番号つき。`main` 時点）

### 1-1. R-1 —— どこが跨いでいるか

**`mock/js/data/portal/front.js`**（rev4 で分割されたファイルはこれ 1 本。IT 専用ファイルは無い）

| 行 | 定数 | 中身 | どの世界の人か |
|---|---|---|---|
| 102 | `PCONTACT.it[0]` | `['王 磊', 'zh', '生产技术科 主管', '生産技術課 主任', '青嶺精工', …]` | `data/world/mfg/people.csv` `wang-lei` |
| 103 | `PCONTACT.it[1]` | `['佐藤 美咲', 'ja', '管理部 総務・人事 駐在員', …]` | `mfg/people.csv` `sato-misaki` |
| 104 | `PCONTACT.it[2]` | `['劉 洋', 'zh', '设备保全科 技师', '設備保全課 技師', …]` | `mfg/people.csv` `liu-yang` |
| 105 | `PCONTACT.it[3]` | `['森下 隆一', 'ja', '営業第一部長', …]` | `data/world/fin/people.csv` `morishita-ryuichi` |
| 106 | `PCONTACT.it[4]` | `['高梨 直人', 'ja', '審査部次長', …]` | `fin/people.csv` `takanashi-naoto` |
| 107 | `PCONTACT.it[5]` | `['陳 慧', 'zh', '营业第一部 主管', …]` | `fin/people.csv` `chen-hui` |
| 137〜148 | `PHIST.it`（12 行） | 上の 6 名を**氏名の文字列**で参照 | 同上 |

- 役職の 3・4 列目も **`mfg/org.csv`（`生産技術課`・`設備保全課`・`管理部`）と `fin/org.csv`（`営業第一部`・`審査部`）の
  部署名そのもの**であり、**社名・拠点名の例外の外側**にある。
- 6 名は `mock/js/data/scenarios/{mfg,fin}/**` のペルソナとしても使われている（王 磊 6 か所・佐藤 美咲 5 か所・
  劉 洋 2 か所・森下 隆一 4 か所・高梨 直人 3 か所・陳 慧 5 か所）。**台本側は正しい**ので 1 バイトも触らない。
- `PHIST.it` の本文にも他世界の語が 3 か所ある：140 行「検収担当は**総務**と兼務」／142 行「**設備**状況の確認」／
  145 行「**審査部** 定例」。

**跨ぎルールの正本（3 か所とも同じことを言っている）**

- `CLAUDE.md` §2-13：「**IT 世界だけ、`clients.csv` の `ref_world` 列で参照を明示したうえで、青嶺精工・碧洋銀行の
  社名と拠点名（蘇州工場・上海本部）に限って参照してよい**（人・部署・品番・設備・KPI・文書番号は跨がない）」
- `data/world/README.md` 17 行目：同文
- `data/world/it/company.md` 「顧客と世界の跨ぎ」の表：「人物・部署・品番・設備・KPI・文書番号 ｜ **✗ 跨がない** ｜
  **顧客側の担当者が要るときは役割だけで書く**」

### 1-2. R-1 —— 既存の受け皿

| ファイル | 行数 | 列 |
|---|---|---|
| `data/world/mfg/partner_contacts.csv` | 6 名 | `contact_id,name_ja,name_zh,name_en,partner_code,title_ja,title_zh,title_en,site,native,note` |
| `data/world/fin/client_contacts.csv` | 5 名 | `contact_id,name_ja,name_zh,name_en,client_code,title_ja,title_zh,title_en,site,native,note` |
| `data/world/it/` | **無い** | —（本書で新設） |

**IT は `client_contacts.csv` を新設する**（`clients.csv` の 4 件がすべて `kind: customer` で、仕入先側の担当者は
出てこないため。金融と同じ `client_code` 列名にそろえる）。

### 1-3. R-1 —— `PCONTACT` / `PHIST` を読むコード（氏名で結合している）

- `mock/js/portal/render.js` 202〜203：`V.cust` が `pd(PCONTACT)` / `pd(PHIST)` を読む
- `mock/js/portal/render.js` 1779〜1780：`openHistDrawer(name)` が
  `pd(PCONTACT).find(x => x[0] === name)` と `pd(PHIST).filter(h => h[0] === name)` で**氏名一致の結合**をしている

→ **`PCONTACT.it` と `PHIST.it` は同じ PR で同時に差し替える。**

### 1-4. R-1 —— 名前の重複チェックの基準（既存の全人物）

| 台帳 | 人数 |
|---|---|
| `data/world/mfg/people.csv` | 22 |
| `data/world/fin/people.csv` | 17 |
| `data/world/it/people.csv` | 5 |
| `data/world/mfg/partner_contacts.csv` | 6 |
| `data/world/fin/client_contacts.csv` | 5 |
| **合計** | **55** |

新設する 6 名は、この 55 名と**姓・名のいずれも重複しない**こと（`it/people.csv` の `note` が守っている作法）。

### 1-5. R-4 —— `gn5` の現状

| 場所 | 行 | 現状 |
|---|---|---|
| `mock/js/data/catalog.js` | 398 | `{ id: 'gn5', cat: 'gn', sub: 'daily', st: 1, industries: ['mfg'], tags: ['summary'],` |
| `mock/js/data/catalog.js` | 399 | `place: '*',` ← **横断（ホームの「横断で使う AI」）。文字列のまま変えない** |
| `mock/js/data/scenarios/mfg/gn.js` | 159〜194 | `gn5: { template: 'upload', … }`（小林 誠・工場長・蘇州工場。VOC 通達 38 ページの要約） |
| `mock/js/data/scenarios/fin/gn.js` | — | `gn5` **無し**（このファイルは `gn6`・`gn7` の 2 本） |
| `mock/js/data/scenarios/it/gn.js` | — | `gn5` **無し**（このファイルは `gn8` の 1 本） |
| `mock/js/data/portal/svc.js` | 47〜49 | `gn5: { short, how: 'btn', ctx, out, why }` |

**横断サービスの `place` の書き方**（比較用）

| id | `industries` | `place` |
|---|---|---|
| `gn6` | `['mfg', 'fin', 'it']` | `'act'`（**文字列。業種別オブジェクトにしていない**） |
| `gn7` | `['mfg', 'fin', 'it']` | `'meet'`（同上） |
| `dc8` | `['mfg', 'fin', 'it']` | `{ mfg: 'kpi', fin: 'reg', it: 'proj' }`（**業種で置き場が変わるときだけ**オブジェクト） |

→ **`gn5` は 3 業種とも「ホームの横断 AI」なので `place: '*'` の文字列のまま。オブジェクトにしない。**

### 1-6. R-4 —— `PSVC` は業種を持たない

`mock/js/data/portal/svc.js` の `PSVC` は `{ short, how, ctx, out, why }` だけで、**`place` も業種分割も持たない**
（`svc.js` 冒頭 10〜13 行に「サービス → ポータル画面の対応表は `SVCS[].place` に移した」「`PSVC` は `st`/`name`/`cat`
を持たない」と明記。`tools/verify.mjs` §17-i が機械で担保）。`gn6`・`gn7` も同じ形。

→ **`PSVC` の変更は不要**（`PSVC.gn5` は既に存在し、3 業種で同じ説明でよい）。§8 の判断待ちにも上げない。

### 1-7. R-4 —— いま金融・IT のポータルで GN-05 を開くと何が起きるか

`mock/js/portal/app.js` 191〜206 の `pscn(svcId, ctx)`：候補順は ① 行の世界 → ② `svc.industries`（宣言順）→
③ `INDUSTRIES` の宣言順。ホームの横断 AI には行の文脈が無いので `want = pstate.ind`。
**いまは `SCENARIOS.mfg.gn5` しか無いため `from = 'mfg'` になり、`PT.scriptWorldPlain`（「いま見ているのは
{want} のポータルですが、この台本は {from} の世界のものです」）の代用表示が出る。**

→ R-4 の後は **`from === want` になり、金融・IT のポータルから GN-05 を開いても代用表示が出なくなる**
（§6 の AC-14）。これは rev4 §2-3 規則 3 の想定どおりの解消であり、規則そのものは変えない。

### 1-8. R-4 —— 使える世界の素材（新規採番はゼロ）

| 業種 | 使うもの | 正本 |
|---|---|---|
| fin | 審査案件 `CRD-26-0096`（丁社・`loan-capex`・`amount_mm` 2400・`due` 2026-10-09・`reviewer_id` `takanashi-naoto`） | `data/world/fin/credit_cases.csv` 5 行目 |
| fin | 稟議 `RNG-2026-0158`（同行） | 同上 |
| fin | 取引先記号 `丁社`（現地国有・素材／大連） | `data/world/fin/clients.csv` |
| fin | ペルソナ 高梨 直人／`審査部次長`／`上海本部`／`ja` | `data/world/fin/people.csv` `takanashi-naoto`・`company.md` |
| fin | 接触履歴「大連支店 経由の設備資金の打診（2026-06-18）」 | `mock/js/data/portal/front.js` `PHIST.fin` 132 行 |
| it | 提案書番号 `PRP-2026-031` | `data/world/it/documents.csv` 3 行目 |
| it | 社内規程 `ITR-08`（情報セキュリティ規程） | `data/world/it/documents.csv` 6 行目 |
| it | 取引先記号 `α 社`（現地民営・EC/物流。**半角スペースあり**） | `data/world/it/clients.csv` |
| it | 標準サービス時間 `平日 07:00-22:00; 土 07:00-13:00` | `data/world/it/calendar.md`「サービス時間とバッチ窓」 |
| it | ペルソナ 村井 拓也／`営業課長`／`上海拠点`／`ja` | `data/world/it/people.csv` `murai-takuya`・`company.md` |

**新しい人名・番号体系・KPI 値は 1 つも作らない。**`data/world/{fin,it}/documents.csv` への追記も**不要**
（両方とも既存行で足りることを実走で確認した。§6-3 の `check-world` W6 が PASS）。

---

## §2 R-1 の設計

### 2-1. 新設する CSV：`data/world/it/client_contacts.csv`

列は `data/world/mfg/partner_contacts.csv` と同一（`partner_code` → `client_code` だけ `fin` にそろえる）。
**ASCII カンマ・二重引用符は 1 つも使わない**（`check-world.mjs` / `gen-seed.mjs` は単純な `split(',')` で読む）。

```csv
contact_id,name_ja,name_zh,name_en,client_code,title_ja,title_zh,title_en,site,native,note
seirei-wan-qin,万 沁,万沁,Wan Qin,青嶺精工,情報システム 主任,信息系统 主管,Information Systems Lead,蘇州工場,zh,顧客側の担当者。翠雲システムズの社員ではない。社名・拠点名だけ clients.csv の ref_world で参照し 人物は IT 世界の固有名（data/world/README.md「跨ぎ」）
seirei-seto-yohei,瀬戸 陽平,濑户阳平,Yohei Seto,青嶺精工,生産システム 駐在担当,生产系统 驻在担当,Production Systems Liaison (Expatriate),蘇州工場,ja,同上
seirei-cen-rui,岑 睿,岑睿,Cen Rui,青嶺精工,工場 IT 運用 担当,工厂IT运维 担当,Plant IT Operations Staff,蘇州工場,zh,同上
hekiyo-bian-hao,卞 昊,卞昊,Bian Hao,碧洋銀行,勘定系システム 主管,核心系统 主管,Core Banking Systems Supervisor,上海本部,zh,同上
hekiyo-shibata-ritsu,柴田 律,柴田律,Ritsu Shibata,碧洋銀行,事務システム 受入担当,事务系统 验收担当,Back-office Systems Acceptance Lead,上海本部,ja,同上
hekiyo-pang-wen,龐 雯,庞雯,Pang Wen,碧洋銀行,帳票基盤 担当,报表平台 担当,Reporting Platform Staff,上海本部,zh,同上
```

**この 6 名を選んだ根拠**

| 新しい人 | 置き換える人 | 所属（社名だけ跨ぐ） | 姓の重複 | 名の重複 | 役職が他世界の部署名でないこと |
|---|---|---|---|---|---|
| 万 沁（Wan Qin） | 王 磊（mfg） | 青嶺精工・蘇州工場 | 無 | 無 | `情報システム` は `mfg/org.csv` に無い |
| 瀬戸 陽平（Yohei Seto） | 佐藤 美咲（mfg） | 青嶺精工・蘇州工場 | 無 | 無 | `生産システム` は `mfg/org.csv` に無い（`生産技術課`・`生産管理課` とは別語） |
| 岑 睿（Cen Rui） | 劉 洋（mfg） | 青嶺精工・蘇州工場 | 無 | 無 | `工場 IT 運用` は `mfg/org.csv` に無い |
| 卞 昊（Bian Hao） | 森下 隆一（fin） | 碧洋銀行・上海本部 | 無 | 無 | `勘定系システム` は `fin/org.csv` に無い（`システム部` とは別語） |
| 柴田 律（Ritsu Shibata） | 高梨 直人（fin） | 碧洋銀行・上海本部 | 無 | 無 | `事務システム 受入担当` は `fin/org.csv` に無い（`事務統括部` とは別語） |
| 龐 雯（Pang Wen） | 陳 慧（fin） | 碧洋銀行・上海本部 | 無 | 無 | `帳票基盤` は IT 世界の語（`it/clients.csv` の碧洋銀行の `role_ja`「上海本部の事務システム・帳票基盤の受託開発」） |

- **姓**：万・瀬戸・岑・卞・柴田・龐 —— §1-4 の 55 名のどの姓とも一致しない
- **名**：沁・陽平・睿・昊・律・雯 —— 同 55 名のどの名とも一致しない
- **拠点**は `蘇州工場`・`上海本部` の 2 つだけ（`CLAUDE.md` §2-13 が名指しで許している拠点名。
  `大連支店`・`日本本店`・`常熟` は**使わない**）
- **役職は「役割だけ」**（`it/company.md`「顧客側の担当者が要るときは役割だけで書く」）。
  `it/gn.js` の GN-08 台本が既に「部门为生产技术部门」と一般語で書いている前例に合わせた

### 2-2. `mock/js/data/portal/front.js` の差し替え（101〜108 行）

**変更前（101〜108 行）**

```js
  it: [
    ['王 磊', 'zh', '生产技术科 主管', '生産技術課 主任', '青嶺精工', '蘇州工場', '2026-08-28', '2024-11'],
    ['佐藤 美咲', 'ja', '管理部 総務・人事 駐在員', '管理部 総務・人事 駐在員', '青嶺精工', '蘇州工場', '2026-09-02', '2025-04'],
    ['劉 洋', 'zh', '设备保全科 技师', '設備保全課 技師', '青嶺精工', '蘇州工場', '2026-07-15', '2024-05'],
    ['森下 隆一', 'ja', '営業第一部長', '営業第一部長', '碧洋銀行', '上海本部', '2026-09-05', '2025-09'],
    ['高梨 直人', 'ja', '審査部次長', '審査部次長', '碧洋銀行', '上海本部', '2026-09-09', '2026-03'],
    ['陳 慧', 'zh', '营业第一部 主管', '営業第一部 主管', '碧洋銀行', '上海本部', '2026-08-20', '2026-03']
  ]
```

**変更後（列の意味・行数・日付・取引先・拠点はすべて据え置き。氏名と役職 2 列だけが替わる）**

```js
  it: [   /* data/world/it/client_contacts.csv の写し（R-1。顧客側の担当者は IT 世界の固有名） */
    ['万 沁', 'zh', '信息系统 主管', '情報システム 主任', '青嶺精工', '蘇州工場', '2026-08-28', '2024-11'],
    ['瀬戸 陽平', 'ja', '生産システム 駐在担当', '生産システム 駐在担当', '青嶺精工', '蘇州工場', '2026-09-02', '2025-04'],
    ['岑 睿', 'zh', '工厂IT运维 担当', '工場 IT 運用 担当', '青嶺精工', '蘇州工場', '2026-07-15', '2024-05'],
    ['卞 昊', 'zh', '核心系统 主管', '勘定系システム 主管', '碧洋銀行', '上海本部', '2026-09-05', '2025-09'],
    ['柴田 律', 'ja', '事務システム 受入担当', '事務システム 受入担当', '碧洋銀行', '上海本部', '2026-09-09', '2026-03'],
    ['龐 雯', 'zh', '报表平台 担当', '帳票基盤 担当', '碧洋銀行', '上海本部', '2026-08-20', '2026-03']
  ]
```

- **3 列目（名刺の原文）と 4 列目（社内表記）の作法は既存どおり**：`native: 'zh'` の人は原文が簡体字、
  `native: 'ja'` の人は 2 列とも同じ文字列（`mfg`・`fin` の既存行と同じ）
- 3 言語は CSV 側（`name_ja/zh/en`・`title_ja/zh/en`）が持つ。`PCONTACT` は `mfg`・`fin` と同じく**単一言語の写し**
  （`tools/verify.mjs` §17-e の 3 言語検査は `{ja,zh,en}` の形をしたオブジェクトだけを見るので、
  この配列は対象外。**形を変えない**＝新たな検査が掛かって壊れることもない）

### 2-3. `mock/js/data/portal/front.js` の差し替え（136〜149 行）

**変更後（12 行。日付・種類・関連 id はすべて据え置き。氏名 12 か所と本文 3 か所が替わる）**

```js
  it: [   /* 12 行。氏名は data/world/it/client_contacts.csv（R-1） */
    ['万 沁', '2026-08-28', '訪問', 'MES 更改 第2期の現地確認。ライン停止時間の調整', 'P-2411'],
    ['万 沁', '2026-07-02', '会議', '仕様レビュー（第 3 回）。帳票要件で保留 2 件', 'M-0702'],
    ['万 沁', '2026-05-20', 'メール', '第 2 期の見積を送付', '—'],
    ['瀬戸 陽平', '2026-09-02', '会議', '受入体制の確認。検収担当は他業務と兼務', 'M-0902'],
    ['瀬戸 陽平', '2026-06-11', '訪問', '年度計画の説明', '—'],
    ['岑 睿', '2026-07-15', '訪問', '現地の運用状況を確認。旧版の手順書が現場に残っていた', 'P-2411'],
    ['卞 昊', '2026-09-05', '会議', '四半期報告。与信ワークフローの進捗', 'P-2418'],
    ['卞 昊', '2026-06-20', '会食', '着任の挨拶', '—'],
    ['柴田 律', '2026-09-09', '会議', '受入定例。当局報告の要件が未確定', 'M-0909'],
    ['柴田 律', '2026-08-05', '会議', '要件ヒアリング（第 1 回）', 'M-0805'],
    ['龐 雯', '2026-08-20', 'メール', '照会 API の仕様について質問対応', 'P-2425'],
    ['龐 雯', '2026-06-30', '会議', 'キックオフ', '—']
  ]
```

**本文を言い換えた 3 か所（他世界の部署名を落とす）**

| 行 | 変更前 | 変更後 | 理由 |
|---|---|---|---|
| 140 | 検収担当は**総務**と兼務 | 検収担当は**他業務**と兼務 | `総務課`（`mfg/org.csv`）を連想させる |
| 142 | **設備状況**の確認 | **現地の運用状況**を確認 | `設備保全課`（`mfg/org.csv`）に紐づく語 |
| 145 | **審査部 定例** | **受入定例** | `審査部`（`fin/org.csv`）そのもの |

`P-2411` / `P-2418` / `P-2425` / `M-07xx` は **IT 世界の案件番号・議事録番号**（`PDEALS`）なので据え置き。

### 2-4. `portal/seed/**` は再生成しない（実走で確認）

`portal/scripts/gen-seed.mjs` 37 行 `const WORLD_FILES = ['company.md', 'org.csv', 'people.csv'];`。
**`client_contacts.csv` はこのリストに無い**ので `portal/seed/world/it/` は増えない。
また `gen-seed.mjs` が `mock/js/data/portal/**` から読むのは **`PKNOW` / `PKPITOPIC` / `PGOAL`（`common.js`・`mgmt.js`）だけ**で、
`front.js` は読まない。

**実走**：R-1 だけを当てた状態で `node portal/scripts/gen-seed.mjs --check` →
`✅ PASS: portal/seed/** は正本から再生成した内容とバイト一致`。

→ **PR-1 は `portal/**` を 1 バイトも触らない。**`npm run portal:test` は「触っていないことの確認」として 1 回だけ回す。

### 2-5. `data/world/README.md` の更新（R-1 で触る 2 行）

1. **IT のファイル表**（81 行 `clients.csv` の行の直後）に 1 行足す：

```markdown
| `client_contacts.csv` | 顧客企業側の担当者 6 名（翠雲システムズの社員ではない。所属先は `clients.csv` の青嶺精工・碧洋銀行だが、**社名と拠点名だけを跨いで参照し、人物は IT 世界の固有名**。`docs/handoff/2026-09-21-rev4-residuals-r1-r4.md` §2-1 で新設） |
```

2. **IT の `people.csv` の行**（83 行）の末尾「既存 38 名（mfg 21・fin 17）と姓名の重複なし」は**そのまま**
   （`people.csv` は社員台帳で、`client_contacts.csv` は別台帳。混ぜない）。

**「未統一」の節（108 行以降）には R-1 に対応する行は無い**（`node tools/check-world.mjs` の warn は
`SCENARIOS` / KB / テストが入力で、`mock/js/data/portal/**` を見ていないため、R-1 は元から warn になっていない）。
**したがって消す行は無い。**代わりに、IT の節（148〜163 行）の「**解消済み（PR-4）**」段落の後ろに 1 段落を足す：

```markdown
**解消済み（R-1・`docs/handoff/2026-09-21-rev4-residuals-r1-r4.md`）**：ポータルモックの `PCONTACT.it` / `PHIST.it`
が `data/world/{mfg,fin}/people.csv` の人物 6 名（王 磊・佐藤 美咲・劉 洋・森下 隆一・高梨 直人・陳 慧）を
流用していた跨ぎ違反は、`data/world/it/client_contacts.csv` の 6 名（万 沁・瀬戸 陽平・岑 睿・卞 昊・柴田 律・龐 雯）
に差し替えて解消した。`check-world.mjs` はポータルのデータ層を走査対象にしていないため、この違反は
**warn には出ていなかった**（`tools/check-world.mjs` の適用範囲外。`docs/handoff/2026-09-12-portal-industry-rev4.md` §17 R-1）。
```

**`tools/check-world.mjs` は 1 バイトも変えない**（走査範囲を `mock/js/data/portal/**` に広げるかは §8 の判断待ち Q3）。

---

## §3 R-4 の設計

### 3-1. `mock/js/data/catalog.js`（398 行。1 行だけ）

```diff
-  { id: 'gn5', cat: 'gn', sub: 'daily', st: 1, industries: ['mfg'], tags: ['summary'],
+  { id: 'gn5', cat: 'gn', sub: 'daily', st: 1, industries: ['mfg', 'fin', 'it'], tags: ['summary'],
     place: '*',
```

**触らない**：`id` / `cat` / `sub` / `st` / `tags` / `place` / `name` / `desc` / `added`（`CLAUDE.md` §2-9・§2-11）。
`CATS` も 1 バイトも触らない（`gn` 大分類も `gn/daily` 中分類も既に `mfg`・`fin`・`it` の 3 業種に出ている）。

### 3-2. `SVCS.gn5` の `name` / `desc` を変えない根拠

| 言語 | 現行の `desc` に業種を含意する語があるか |
|---|---|
| ja | 「長文の報告書・仕様書・通達・メールスレッド」「中国語の長文を日本語 1 枚に」「日本語の本社資料を中国語の箇条書きに」→ **無し** |
| zh | 「长篇报告、规格书、通知与邮件往来」「将中文长文概括为一页日文」→ **無し** |
| en | 「long reports, specifications, notices and email threads」→ **無し** |

`name` は「文書要約 / 文档摘要 / Document Summarizer」で業種色ゼロ。**3 言語とも変更不要。**
（§8 に判断待ちとして上げない。PM の追加判断は要らない）

### 3-3. `mock/js/data/scenarios/fin/gn.js` —— `gn5` を新設（`gn6` の直前に挿入）

- 挿入位置：11 行目 `  /* gn6: 頼まれ事・放置業務の追跡 …` の**直前**（id の数字順）
- **ファイル末尾の既存エントリ（`gn7`）には既に `,` が付いている**ので末尾はいじらない
- `template` は `mfg` と同じ `upload`
- `steps` は ja/zh/en の 3 言語・各 4 件。`script` は **ja/zh のみ**・各 3 往復
- `q` / `a` に `'`（U+0027）を書かない。`result` は `items` 形式（markdown 表を書かない）

```js
  /* gn5: 文書要約（既存・業種横断。R-4 で金融へ拡張）。高梨直人が 丁社 の中国語 設備投資計画書を
     日本語 1 枚にして CRD-26-0096 / RNG-2026-0158 の審査に使う。数字と期限は原文の該当ページ付き */
  gn5: { template: 'upload',
    persona: { name: { ja: '高梨 直人', zh: '高梨直人', en: 'Naoto Takanashi' },
               role: { ja: '審査部次長', zh: '审查部副部长', en: 'Deputy General Manager, Credit Review Department' },
               site: { ja: '上海本部', zh: '上海总部', en: 'Shanghai Head Office' }, native: 'ja' },
    steps: { ja: ['丁社の設備資金の申込（CRD-26-0096）に、62 ページの中国語 設備投資計画書が添えられてきた。審査期限は 2026-10-09 で全部読む時間がない', 'PDF をアップロードし、「日本語で 1 枚に。返済原資と前提条件を中心に」と指示', '要点・返済原資・前提条件・審査で確認したい点・原文の該当ページの 1 枚要約が返る', '稟議 RNG-2026-0158 の審査メモに貼り、確認事項を営業第一部へ投げる'],
             zh: ['丁社的设备资金申请（CRD-26-0096）附带了62页中文设备投资计划书。审查期限为2026-10-09，没时间全部读完', '上传PDF，指示「日文一页，以还款来源与前提条件为中心」', '返回要点、还款来源、前提条件、审查需确认事项与原文对应页码的一页摘要', '贴到稟议 RNG-2026-0158 的审查备忘中，并把需确认事项转给营业第一部'],
             en: ['A 62-page Chinese capital-investment plan arrives with a capex loan application, and the review deadline leaves no time to read it all', 'Upload the PDF and ask for a one-page Japanese summary focused on repayment sources and assumptions', 'Get key points, repayment sources, assumptions, open review questions and the matching source pages on one page', 'Paste it into the review memo for the internal approval and send the open questions to the corporate banking division'] },
    input: { ja: { files: ['丁社_设备投资计划书_2026-09.pdf'] }, zh: { files: ['丁社_设备投资计划书_2026-09.pdf'] } },
    result: {
      ja: { title: '要約（日本語 1 枚）：丁社「設備投資計画書」2026 年 9 月（原文 62 ページ・中国語）',
            items: [
              { k: '計画の要点（3 点）', v: '① 大連の既存工場に素材処理ラインを 1 本増設。投資総額 30 億元、2027-06 稼働予定（p.5）\n② 資金調達は自己資金 6 億元・当行申込 24 億元（p.18）。既往行からの借換は計画に無い\n③ 増設後の年産能力は 1.6 倍。販売先は既存 7 割・新規 3 割の想定（p.24）' },
              { k: '返済原資', v: '・計画上の返済原資は増設ラインの営業キャッシュフロー（p.31、年 4.2 億元）。既存ラインの CF は p.33 に別掲\n・元金返済は 2027 年 12 月開始・7 年（p.35）。据置は稼働予定から 18 か月で、据置中は利息のみ（p.34）\n・p.31 の前提は「新規販売先 3 割が計画どおり立ち上がる」こと。立ち上がりが遅れた場合の感応度は原文に記載なし' },
              { k: '前提条件（原文に明記されたもの）', v: '・素材価格は 2026 年 8 月水準で横置き（p.28）\n・増設に必要な環境認可は 2026 年 12 月取得見込み（p.12。現時点では未取得）\n・設備の納期 10 か月（p.14）' },
              { k: '審査で確認したい点（案）', v: '① 感応度分析（新規販売先の立ち上がり遅延・素材価格上昇）の提出依頼\n② 環境認可の申請状況と、取得見込みの根拠\n③ 既往与信との合算での保全の考え方\n④ 大連支店経由の打診（2026-06-18）時点の計画との差分' },
              { k: '原文の重要箇所', v: 'p.5 投資概要／p.12 環境認可／p.14 設備納期／p.18 資金調達計画／p.24 販売計画／p.31〜35 収支と返済計画' }
            ] },
      zh: { title: '摘要（日文一页・中文对照）：丁社《设备投资计划书》2026年9月（原文62页・中文）',
            items: [
              { k: '计划要点（3点）', v: '① 在大连既有工厂增设1条原材料处理线。投资总额30亿元，预计2027-06投产（p.5）\n② 资金来源为自有资金6亿元・向本行申请24亿元（p.18）。计划中没有既有银行的借新还旧\n③ 增设后年产能为1.6倍。销售对象设想为既有7成・新增3成（p.24）' },
              { k: '还款来源', v: '・计划上的还款来源为增设线的经营性现金流（p.31，年4.2亿元）。既有线的CF在p.33单列\n・本金偿还自2027年12月起・7年（p.35）。宽限期为自预计投产起18个月，宽限期内仅付息（p.34）\n・p.31 的前提是「新增销售对象3成按计划爬坡」。爬坡延迟时的敏感性分析原文未记载' },
              { k: '前提条件（原文明确记载的）', v: '・原材料价格按2026年8月水平持平（p.28）\n・增设所需的环保许可预计2026年12月取得（p.12。目前尚未取得）\n・设备交期10个月（p.14）' },
              { k: '审查需确认事项（方案）', v: '① 要求提交敏感性分析（新增销售对象爬坡延迟・原材料涨价）\n② 环保许可的申请状况与取得预期的依据\n③ 与既有授信合并后的担保思路\n④ 与经大连分行洽谈时点（2026-06-18）计划的差异' },
              { k: '原文重要位置', v: 'p.5 投资概要／p.12 环保许可／p.14 设备交期／p.18 资金筹措计划／p.24 销售计划／p.31〜35 收支与还款计划' }
            ] } },
    script: {
      ja: [
        { q: '【アップロード】丁社_设备投资计划书_2026-09.pdf — 日本語で 1 枚に。返済原資と前提条件を中心に', a: '62 ページを読み、日本語 1 枚に要約しました（結果）。審査に効く点は 3 つです。① 返済原資は増設ラインの営業キャッシュフロー（p.31、年 4.2 億元）で、既存ラインの CF とは別建てになっています。② その前提は「新規販売先 3 割が計画どおり立ち上がる」ことで、遅れた場合の感応度は原文に記載がありません。③ 環境認可は 2026 年 12 月取得見込みで、現時点では未取得です（p.12）。数値・期限は原文どおり転記し、該当ページを付けています。審査期限は 2026-10-09 です。' },
        { q: '返済計画の年数と据置期間の根拠は原文のどこ？', a: '原文 p.35「还款安排」の表です。元金返済は 2027 年 12 月開始・7 年（84 回）、据置は稼働予定（2027-06）から 18 か月と記載されています。p.34 に「宽限期内仅付息」とあります。注意点が 2 つあります。① p.35 の表は p.31 の年 4.2 億元の CF を前提に組まれています。CF が計画を下回った場合のカバー率は原文に記載が無いため、こちらでは計算していません。丁社に感応度分析の提出を依頼することをお勧めします。② 据置の起点が「稼働予定」なので、設備の納期 10 か月（p.14）が延びると返済開始も後ろ倒しになります。' },
        { q: '営業第一部に投げる確認依頼、日本語と中国語で。担当と期限を明記', a: '確認依頼案（日中併記）：\n---\n件名：【確認依頼】丁社 設備投資計画書（CRD-26-0096）— 審査前の 4 点 ／【需确认】丁社 设备投资计划书 — 审查前4项\n\n営業第一部 各位\n丁社の設備投資計画書（62 ページ）を 1 枚に要約しました（添付）。審査期限は 2026-10-09 です。以下 4 点を 2026-09-25 までにお願いします。\n・感応度分析（新規販売先の立ち上がり遅延・素材価格上昇）の提出依頼 — 陳\n・環境認可の申請状況と取得見込みの根拠 — 陳\n・既往与信との合算での保全の考え方 — 森下部長\n・2026-06-18 の打診時点の計画との差分 — 森下部長\n稟議は RNG-2026-0158 です。\n\n营业第一部 各位：\n已将丁社设备投资计划书（62页）摘要为1页（附件）。审查期限为2026-10-09。以下4项请在2026-09-25前处理。\n・要求提交敏感性分析（新增销售对象爬坡延迟・原材料涨价）— 陈\n・环保许可的申请状况与取得预期的依据 — 陈\n・与既有授信合并后的担保思路 — 森下部长\n・与2026-06-18 洽谈时点计划的差异 — 森下部长\n稟议编号为 RNG-2026-0158。\n高梨\n---' }
      ],
      zh: [
        { q: '【上传】丁社_设备投资计划书_2026-09.pdf — 日文一页，以还款来源与前提条件为中心', a: '已读完62页，摘要为日文一页（结果为中文对照）。对审查有影响的3点：① 还款来源为增设线的经营性现金流（p.31，年4.2亿元），与既有线的CF分开列示。② 其前提是「新增销售对象3成按计划爬坡」，延迟时的敏感性分析原文没有记载。③ 环保许可预计2026年12月取得，目前尚未取得（p.12）。数值与期限按原文转录并附上对应页码。审查期限为2026-10-09。' },
        { q: '还款计划的年限与宽限期的依据在原文哪里？', a: '在原文 p.35「还款安排」的表格。本金偿还自2027年12月起・7年（84期），宽限期记载为自预计投产（2027-06）起18个月。p.34 写明「宽限期内仅付息」。两点提醒：① p.35 的表格以 p.31 的年4.2亿元CF为前提编制。CF低于计划时的覆盖倍数原文没有记载，因此本助手不做计算，建议要求丁社提交敏感性分析。② 宽限期的起点是「预计投产」，若设备交期10个月（p.14）延长，还款开始也会相应后移。' },
        { q: '写一封发给营业第一部的确认请求，中日双语，写明负责人和期限', a: '确认请求草案（中日对照）：\n---\n主题：【需确认】丁社 设备投资计划书（CRD-26-0096）— 审查前4项 ／【確認依頼】丁社 設備投資計画書 — 審査前の 4 点\n\n营业第一部 各位：\n已将丁社设备投资计划书（62页）摘要为1页（附件）。审查期限为2026-10-09。以下4项请在2026-09-25前处理。\n・要求提交敏感性分析（新增销售对象爬坡延迟・原材料涨价）— 陈\n・环保许可的申请状况与取得预期的依据 — 陈\n・与既有授信合并后的担保思路 — 森下部长\n・与2026-06-18 洽谈时点计划的差异 — 森下部长\n稟议编号为 RNG-2026-0158。\n\n営業第一部 各位\n丁社の設備投資計画書（62 ページ）を 1 枚に要約しました（添付）。審査期限は 2026-10-09 です。以下 4 点を 2026-09-25 までにお願いします。\n・感応度分析（新規販売先の立ち上がり遅延・素材価格上昇）の提出依頼 — 陳\n・環境認可の申請状況と取得見込みの根拠 — 陳\n・既往与信との合算での保全の考え方 — 森下部長\n・2026-06-18 の打診時点の計画との差分 — 森下部長\n稟議は RNG-2026-0158 です。\n高梨\n---' }
      ] } },
```

**この台本で使っている世界の値**（すべて既存。新規採番ゼロ）

| 値 | 正本 |
|---|---|
| 高梨 直人 / 高梨直人 / Naoto Takanashi | `data/world/fin/people.csv` `takanashi-naoto` |
| 審査部次長 / 审查部副部长 / `Deputy General Manager, Credit Review Department` | 同上 `title_ja/zh/en`（**`check-world` W2 は 3 言語の完全一致を見るので 1 文字も変えない**） |
| 上海本部 / 上海总部 / Shanghai Head Office | `data/world/fin/company.md`（`SCENARIOS.fin.gn6` と同じ文字列） |
| 丁社 | `data/world/fin/clients.csv`（**空白なし**が正） |
| CRD-26-0096 / RNG-2026-0158 / 2026-10-09 | `data/world/fin/credit_cases.csv` 5 行目 |
| 2026-06-18 の大連支店経由の打診 | `PHIST.fin` 132 行 |

**新しい数字を持ち込まないための作法**：金額は `credit_cases.csv` の `amount_mm` 2400（＝24 億元）を当行申込額として
使い、投資総額 30 億元・自己資金 6 億元はその内訳として台本内で閉じている。**`fin/kpi.csv` の指標名
（貸出残高・延滞率など）は 1 つも使わない**（`check-world` W8 が「同名別値」で拾うのを避ける）。

### 3-4. `mock/js/data/scenarios/it/gn.js` —— `gn5` を新設（`gn8` の直前に挿入）

- 挿入位置：12 行目 `  /* gn8: 名刺の読み取りと項目抽出 …` の**直前**
- **注意**：`it/gn.js` の**末尾の `gn8` には `,` が付いていない**（`fin/gn.js` の `gn7` とは違う）。
  `gn8` の前に挿入するので末尾はいじらないが、**もし末尾に足す実装に変えるなら `gn8` の後ろに `,` が要る**
- 顧客側の個人名は**出さない**（`it/company.md`「役割だけで書く」）。青嶺精工・碧洋銀行にも触れず、
  **`α 社` だけで完結させる**（跨ぎそのものが発生しない）
- ファイル名に `α 社` を入れない（`check-world` W5 が取引先記号の空白ゆれを見るため、
  ファイル名は `RFP_生产管理系统更新_2026-09.pdf` とし、本文では**半角スペースつきの `α 社`** と書く）

```js
  /* gn5: 文書要約（既存・業種横断。R-4 で IT へ拡張）。村井拓也が α 社の中国語 RFP を日本語 1 枚にし、
     提案可否の判断と提案書 PRP-2026-031 の骨子づくりに使う。顧客側の個人名は出さない（§3-4 跨ぎの規則） */
  gn5: { template: 'upload',
    persona: { name: { ja: '村井 拓也', zh: '村井拓也', en: 'Takuya Murai' },
               role: { ja: '営業課長', zh: '营业科长', en: 'Sales Manager' },
               site: { ja: '上海拠点', zh: '上海分公司', en: 'Shanghai Office' }, native: 'ja' },
    steps: { ja: ['α 社から 76 ページの中国語 RFP が届いた。提案可否を 3 日で決める必要があり、全部読む時間がない', 'PDF をアップロードし、「日本語で 1 枚に。当社が受けられるかの判断材料中心で」と指示', '要点・対応できる／できない・前提条件・提案前に確認したい点・原文の該当ページの 1 枚要約が返る', '日本本社へ送り、提案書 PRP-2026-031 の骨子づくりに使う'],
             zh: ['α 社发来76页中文RFP。需要在3天内决定是否提案，没时间全部读完', '上传PDF，指示「日文一页，以能否承接的判断材料为中心」', '返回要点、可对应与不可对应的项目、前提条件、提案前需确认事项与原文对应页码的一页摘要', '发送给日本总部，用于提案书 PRP-2026-031 的框架编写'],
             en: ['A 76-page Chinese RFP arrives from a local client and the bid decision is due in three days', 'Upload the PDF and ask for a one-page Japanese summary focused on whether the work can be taken on', 'Get key points, what can and cannot be met, assumptions, open questions and the matching source pages on one page', 'Send it to the Japan HQ and use it as the skeleton of the proposal'] },
    input: { ja: { files: ['RFP_生产管理系统更新_2026-09.pdf'] }, zh: { files: ['RFP_生产管理系统更新_2026-09.pdf'] } },
    result: {
      ja: { title: '要約（日本語 1 枚）：α 社「生産管理システム更新 RFP」2026 年 9 月（原文 76 ページ・中国語）',
            items: [
              { k: '調達の要点（3 点）', v: '① 対象は受注から出荷までの基幹システムの更新。現行は自社開発で 2018 年稼働（p.8）\n② 提案期限 2026-10-02、稼働希望 2027-04（p.4）。契約は年次更新の保守込み（p.61）\n③ 選定は価格 40％・体制 30％・機能適合 30％（p.66）' },
              { k: '当社が対応できる／できない', v: '・対応できる：要件定義から結合テストまでの受託と、上海拠点の日中 2 言語の窓口（p.22 の機能要求 1〜9）\n・確認が要る：24 時間の運用監視（p.44）。当社の標準サービス時間は 平日 07:00-22:00; 土 07:00-13:00 で、体制の追加が前提になる\n・原文だけでは判断できない：既存データの移行量と文字コード（p.51 が「详见附件」で止まり、附件が添付されていない）' },
              { k: '前提条件（原文に明記されたもの）', v: '・現行システムのソースは開示される（p.53）\n・受入テストは α 社側が実施（p.58）\n・瑕疵担保は検収後 12 か月（p.62）' },
              { k: '提案前に確認したい点（案）', v: '① 附件（データ移行仕様）の提供\n② 24 時間監視の要否と時間帯の定義\n③ 提案期限 2026-10-02 と稼働希望 2027-04 の間隔（要件定義の開始時期）\n④ 保守の年次更新の条件' },
              { k: '原文の重要箇所', v: 'p.4 スケジュール／p.8 現行システム／p.22 機能要求／p.44 運用要求／p.51 データ移行／p.61〜66 契約と選定基準' }
            ] },
      zh: { title: '摘要（日文一页・中文对照）：α 社《生产管理系统更新RFP》2026年9月（原文76页・中文）',
            items: [
              { k: '招标要点（3点）', v: '① 对象为从接单到出货的核心系统更新。现行系统为自主开发，2018年投产（p.8）\n② 提案期限2026-10-02，期望投产2027-04（p.4）。合同含按年续签的运维（p.61）\n③ 评标为价格40％・体制30％・功能符合度30％（p.66）' },
              { k: '本公司可对应与不可对应的项目', v: '・可对应：从需求定义到集成测试的承接，以及上海分公司的中日双语窗口（p.22 的功能要求1〜9）\n・需确认：24小时运维监控（p.44）。本公司的标准服务时间为 平日 07:00-22:00; 土 07:00-13:00，需要追加体制\n・仅凭原文无法判断：既有数据的迁移量与字符编码（p.51 写到「详见附件」为止，附件未随文提供）' },
              { k: '前提条件（原文明确记载的）', v: '・现行系统的源代码将予以开示（p.53）\n・验收测试由 α 社方实施（p.58）\n・质保期为验收后12个月（p.62）' },
              { k: '提案前需确认事项（方案）', v: '① 提供附件（数据迁移规格）\n② 24小时监控的必要性与时段定义\n③ 提案期限2026-10-02 与期望投产2027-04 之间的间隔（需求定义的启动时点）\n④ 运维按年续签的条件' },
              { k: '原文重要位置', v: 'p.4 日程／p.8 现行系统／p.22 功能要求／p.44 运维要求／p.51 数据迁移／p.61〜66 合同与评标标准' }
            ] } },
    script: {
      ja: [
        { q: '【アップロード】RFP_生产管理系统更新_2026-09.pdf — 日本語で 1 枚に。当社が受けられるかの判断材料中心で', a: '76 ページを読み、日本語 1 枚に要約しました（結果）。判断に効く点は 3 つです。① 機能要求 1〜9（p.22）は、要件定義から結合テストまでの受託として当社の標準の型に収まります。② 運用要求の 24 時間監視（p.44）は当社の標準サービス時間（平日 07:00-22:00; 土 07:00-13:00）を超えるため、体制の追加が前提になります。③ データ移行の仕様は p.51 が「详见附件」で止まり、附件が添付されていません。ここが未知のままだと工数が読めません。提案期限は 2026-10-02（p.4）です。' },
        { q: '選定基準の配点と、価格以外で差がつく項目は原文のどこ？', a: '原文 p.66「评标办法」の表です。価格 40％・体制 30％・機能適合 30％。体制 30％の内訳は p.67 に「常駐人数 10／日中両言語の窓口 10／類似案件の実績 10」と分解されています。機能適合 30％は p.22 の機能要求 1〜9 に対する○△×で、△は 0.5 点換算（p.68）。p.69 に「同点の場合は稼働開始日が早い側を優先」とあります。当社の得点見込みは原文に無いため出していません。実績の書き方は提案書 PRP-2026-031 の骨子で決める論点として残しました。' },
        { q: '日本本社に送る 1 枚に、当社の情報セキュリティ規程との差分も足して', a: '1 枚要約に「規程との差分」を 1 節足しました。ITR-08（情報セキュリティ規程）と RFP の要求を突き合わせた結果、差分は 3 点です。① 作業端末（p.47）：RFP は α 社の貸与端末のみと定めています。ITR-08 は当社管理端末を前提にしているため、貸与端末を使うなら例外申請が要ります。② ログの保存期間（p.48）：RFP は 12 か月、ITR-08 は 24 か月。長い方に合わせれば両方を満たせます。③ 再委託（p.55）：RFP は事前承認制で、ITR-08 も同じ扱いのため差分はありません。①の例外申請は当社側の手続きなので、可否の判断は管理部へお願いします。原文に無い解釈は足していません。' }
      ],
      zh: [
        { q: '【上传】RFP_生产管理系统更新_2026-09.pdf — 日文一页，以能否承接的判断材料为中心', a: '已读完76页，摘要为日文一页（结果为中文对照）。对判断有影响的3点：① 功能要求1〜9（p.22）作为从需求定义到集成测试的承接，落在本公司的标准范围内。② 运维要求中的24小时监控（p.44）超出本公司标准服务时间（平日 07:00-22:00; 土 07:00-13:00），需以追加体制为前提。③ 数据迁移规格在 p.51 写到「详见附件」为止，附件未随文提供，这部分不明会导致工数无法估算。提案期限为2026-10-02（p.4）。' },
        { q: '评标配分，以及价格之外能拉开差距的项目在原文哪里？', a: '在原文 p.66「评标办法」的表格。价格40％・体制30％・功能符合度30％。体制30％的明细在 p.67 分解为「常驻人数10／中日双语窗口10／类似项目实绩10」。功能符合度30％为对 p.22 功能要求1〜9 的○△×评价，△按0.5分折算（p.68）。p.69 写明「同分时优先投产日期更早的一方」。本公司的得分预期原文没有记载，因此不做推算。实绩的写法作为提案书 PRP-2026-031 框架中需要确定的议题保留。' },
        { q: '在发给日本总部的一页中，再加上与本公司信息安全规章的差异', a: '已在一页摘要中增加「与规章的差异」一节。将 ITR-08（信息安全规章）与RFP的要求逐项比对，差异有3点：① 作业终端（p.47）：RFP 规定只能使用 α 社的借用终端。ITR-08 以本公司管理终端为前提，若使用借用终端需提交例外申请。② 日志保存期限（p.48）：RFP为12个月，ITR-08为24个月，按较长的一方执行即可同时满足。③ 再委托（p.55）：RFP为事前审批制，ITR-08 也是同样处理，没有差异。①的例外申请属于本公司内部手续，可否请由管理部判断。没有添加原文之外的解释。' }
      ] } },
```

**この台本で使っている世界の値**（すべて既存。新規採番ゼロ）

| 値 | 正本 |
|---|---|
| 村井 拓也 / 村井拓也 / Takuya Murai | `data/world/it/people.csv` `murai-takuya` |
| 営業課長 / 营业科长 / Sales Manager | 同上 `title_ja/zh/en` |
| 上海拠点 / 上海分公司 / Shanghai Office | `data/world/it/company.md` 拠点表（`SCENARIOS.it.gn8` と同じ文字列） |
| α 社 | `data/world/it/clients.csv`（**半角スペースあり**が正） |
| PRP-2026-031（提案書番号） | `data/world/it/documents.csv` 3 行目 |
| ITR-08（情報セキュリティ規程） | `data/world/it/documents.csv` 6 行目 |
| 平日 07:00-22:00; 土 07:00-13:00 | `data/world/it/calendar.md`「サービス時間とバッチ窓」の標準型 |

**`it/kpi.csv` の指標名（要員稼働率・受注率など）は 1 つも使わない**（W8 回避）。
`p.4` `p.66` などのページ番号は文書番号ではないので W6 の対象外（実走で確認済み）。

### 3-5. `mock/js/data/portal/svc.js`（`PSVC`）—— 変更なし

§1-6 のとおり `PSVC` は `place` も業種分割も持たない。`PSVC.gn5` の
`{ short: {ja:'要約', zh:'摘要', en:'Summary'}, how: 'btn', ctx, out, why }` は 3 業種で通じる。
**このファイルは PR-2 でも触らない。**

### 3-6. `tools/lib/load.mjs`（`PORTAL_DATA_KEYS`）—— 変更なし

R-1・R-4 とも `mock/js/data/portal/**` に**新しい定数を足さない**（既存の `PCONTACT` / `PHIST` の値を替えるだけ）。
rev4 §18-2b の申し送り（新定数を足したら `PORTAL_DATA_KEYS` を同時に更新する）は**発動しない**。

### 3-7. `docs/service-map.md` の再生成（`npm run index`）

`gn5` の行と集計行が変わる（実走で確認。`tools/verify.mjs` §11 が鮮度を検査するので必須）。

```diff
-| GN-05 | 文書要約 | GN/daily | 製造 | 提供中 | [mfg/gn.js](…) upload | — | — | …
+| GN-05 | 文書要約 | GN/daily | 製造・金融・IT | 提供中 | [mfg/gn.js](…) upload | [fin/gn.js](…) upload | [it/gn.js](…) upload | …
-| 集計 | — | — | — | — | ①製造 55 | ①金融 30 | ①IT 15 | ②12 | ③72 | ④KB 4 | ④テスト 12 |
+| 集計 | — | — | — | — | ①製造 55 | ①金融 31 | ①IT 16 | ②12 | ③72 | ④KB 4 | ④テスト 12 |
```

（集計行の「①金融／①IT」は**台本の本数**。`regress` の `byIndustry.*.svcs`（サービス件数）とは別の数。）

### 3-8. `docs/handoff/service-index.md`（手書きの台帳。1 行）

```diff
-| **GN-05** | `gn5` | gn/daily | 文書要約 | 提供中 | 製造 | upload |
+| **GN-05** | `gn5` | gn/daily | 文書要約 | 提供中 | 製造・金融・IT | upload |
```

（96 行目。`npm run index` の生成物ではないので**手で直す**。`GN-06` / `GN-07` の行と同じ書式にそろえる。）

### 3-9. `docs/dify/usecases/GN-05.md` の差分（2 か所）

**3 行目（台本の参照先）**

```diff
-> 1 サービス 1 ファイル。モックの台本（`SCENARIOS.gn5`）を写すのではなく、実装者が Dify でアプリを組み・テストするために必要なことを書く。
+> 1 サービス 1 ファイル。モックの台本（`SCENARIOS.{mfg,fin,it}.gn5`）を写すのではなく、実装者が Dify でアプリを組み・テストするために必要なことを書く。
```

**14 行目（主担当（ペルソナ））**——`DC-11.md` 14 行目の横断サービスの書式にそろえる

```diff
-| 主担当（ペルソナ） | 工場長（小林 誠）・蘇州工場・母語 ja。利用者：全社員（管理職中心） |
+| 主担当（ペルソナ） | 製造：小林 誠／工場長／蘇州工場／母語 ja（`data/world/mfg/people.csv` `kobayashi-makoto`）。金融：高梨 直人／審査部次長／上海本部／母語 ja（`data/world/fin/people.csv` `takanashi-naoto`）。IT：村井 拓也／営業課長／上海拠点／母語 ja（`data/world/it/people.csv` `murai-takuya`）。利用者：全社員（管理職中心） |
```

**業種の行は新設しない。**`GN-05.md` の項目表にはもともと「業種」行が無く、`GN-06.md`（横断）にも無い。
`DC-09.md` だけが `| 業種 | 金融（industries: ['fin']）|` を持つが、これは単一業種のサービスの書き方であり、
横断サービスの正しい前例は `DC-11.md`（業種行を持たず、ペルソナ行に 3 業種を書く）。**後者に合わせる。**

**§5-1 の System プロンプト（「あなたは青嶺精工 蘇州工場の文書要約アシスタントです」）は本書では変えない。**
会社名・拠点は `CLAUDE.md` §2-12 で `dify/env/<env>/env.yml` が持つ環境差分であり、実装リファレンス側の
書き換えは `dify/apps/GN-05-document-summary.yml` と `dify/env/**` を巻き込む。
**§8 の判断待ち Q1 として PM に上げる**（推奨：別 Issue。本件では触らない）。

**`dify/apps/GN-05-document-summary.yml`・`dify/tests/GN-05.json`・`dify/env/**` は 1 バイトも触らない。**

---

## §4 変更前後の件数と id 一覧

### 4-1. `data/world/`

| ファイル | 前 | 後 | 差分 |
|---|---|---|---|
| `data/world/it/client_contacts.csv` | 無し | **6 行**（ヘッダ除く） | **新設**。`contact_id` = `seirei-wan-qin` / `seirei-seto-yohei` / `seirei-cen-rui` / `hekiyo-bian-hao` / `hekiyo-shibata-ritsu` / `hekiyo-pang-wen` |
| `data/world/it/people.csv` | 5 行 | **5 行** | **変更なし**（社員台帳。顧客側の人は入れない） |
| `data/world/{fin,it}/documents.csv` | 2 行 / 8 行 | **同じ** | **追記不要**（§1-8。実走で `check-world` W6 が PASS） |
| `data/world/{mfg,fin}/**` | — | — | **1 バイトも触らない** |

### 4-2. `mock/js/data/portal/front.js`

| 定数 | 前 | 後 | 差分 |
|---|---|---|---|
| `PCONTACT.mfg` / `.fin` | 6 / 5 行 | **同じ** | 触らない |
| `PCONTACT.it` | 6 行 | **6 行** | **氏名 6 件・役職 12 セルを差し替え**。行数・列数・日付・取引先・拠点は不変 |
| `PHIST.mfg` / `.fin` | 10 / 9 行 | **同じ** | 触らない |
| `PHIST.it` | 12 行 | **12 行** | **氏名 12 件を差し替え、本文 3 件を言い換え**。日付・種類・関連 id は不変 |
| `PPART` / `PQTR` / `PDEALS` / `PNEWS` / `PVENDOR` / `PQUAL` / `PORDER` / `PCRED` / `PREG` | — | — | **触らない** |

### 4-3. `mock/js/data/catalog.js`（`CATS` / `SVCS` / `TAGS`）

| 対象 | 前 | 後 |
|---|---|---|
| `CATS` | 15 大分類 / 36 中分類 | **同じ**（触らない） |
| `SVCS` の件数 | **87** | **87**（増減なし。**id は 1 つも増えず、1 つも消えない**） |
| `TAGS` | 67 | **同じ** |
| `SVCS.gn5.industries` | `['mfg']` | **`['mfg', 'fin', 'it']`** ← **これ 1 か所だけ** |

**`regress` の counts（`tools/regress.baseline.json`）**

```diff
-{"cats":15,"subs":36,"svcs":87,"tags":67,"ui":94,"byIndustry":{"mfg":{"svcs":55,"cats":10},"fin":{"svcs":30,"cats":8},"it":{"svcs":26,"cats":7}},"svcsMulti":12}
+{"cats":15,"subs":36,"svcs":87,"tags":67,"ui":94,"byIndustry":{"mfg":{"svcs":55,"cats":10},"fin":{"svcs":31,"cats":8},"it":{"svcs":27,"cats":7}},"svcsMulti":13}
```

| キー | 前 | 後 |
|---|---|---|
| `counts.svcs` | 87 | **87**（変わらない） |
| `counts.byIndustry.mfg.svcs` | 55 | **55**（変わらない） |
| `counts.byIndustry.fin.svcs` | 30 | **31** |
| `counts.byIndustry.it.svcs` | 26 | **27** |
| `counts.byIndustry.*.cats` | 10 / 8 / 7 | **10 / 8 / 7**（変わらない。`gn` は 3 業種とも既に出ている） |
| `counts.svcsMulti` | 12 | **13** |
| `SVCS.gn5 industries`（id 単位の記録） | `[mfg]` | `[mfg,fin,it]` |

**`regress.mjs --update` は PR-2 で 1 回だけ。**PR 本文に「**設計書 `docs/handoff/2026-09-21-rev4-residuals-r1-r4.md`
§4-3 のデータ変更に伴う基準更新**」と書く（`CLAUDE.md` §3）。

### 4-4. `SCENARIOS` の件数

| 業種 | 前 | 後 | 追加する id |
|---|---|---|---|
| `SCENARIOS.mfg` | 55 | **55** | —（`mfg.gn5` は既存。触らない） |
| `SCENARIOS.fin` | 30 | **31** | **`gn5`** |
| `SCENARIOS.it` | 15 | **16** | **`gn5`** |
| 合計 | 100 | **102** | — |

**`verify` の「台本の無い SVCS」warn**

| 業種 | 前 | 後 |
|---|---|---|
| mfg | warn 無し（55/55） | **warn 無し** |
| fin | warn 無し（30/30） | **warn 無し**（31/31。**gn5 の台本を書かないとここに新しい warn が出る**） |
| it | 11 件（`kn4, kn5, dc2, dc8, gn6, gn7, po1, po2, po3, po4, eg1`） | **11 件（同じ並び）** |

### 4-5. `portal/seed/**`

| PR | 再生成 | 差分 |
|---|---|---|
| PR-1（R-1） | **不要**（`--check` が PASS） | 0 ファイル |
| PR-2（R-4） | **必要** | `portal/seed/catalog.json` のみ（`+3 -1` 行。`gn5.industries` の配列） |

---

## §5 触らない範囲（明示）

### 5-1. 1 バイトも触らない

- **`CLAUDE.md`・`.claude/**`** —— load-bearing の改定は不要（§2-13 の跨ぎルールは**そのまま守る方向の修正**であり、
  ルール自体を緩めない。§8 の Q2 で「例外を人に広げる」案は**却下を推奨**）
- **`tools/verify.mjs`・`tools/regress.mjs`・`tools/check-world.mjs`・`tools/lib/load.mjs`・`tools/index.mjs`**
  —— 検査ロジックは 1 行も変えない（`tools/regress.baseline.json` は `--update` の生成物として PR-2 でだけ変わる）
- **`mock/css/**`**（`tokens.css`・`components.css`・`portal.css`）—— 新しいクラスもトークンも足さない
- **`mock/js/portal/{app,render,events}.js`**・**`mock/js/{app,render,events}.js`** —— 描画・遷移は触らない
  （R-1 は `PCONTACT`/`PHIST` の**値**だけ、R-4 は `SVCS[].industries` の**値**だけ）
- **`mock/catalog.html`・`mock/portal.html`・`mock/index.html`** —— `<script src>` の並びを変えない
- **`mock/js/data/portal/`** の `ui.js`（`PSCREENS`/`PT`）・`org.js`・`common.js`・`mgmt.js`・`back.js`・`sys.js`・**`svc.js`**
- **`mock/js/data/portal/front.js` の `PSTAGE` / `PDEALS` / `PPART` / `PQTR` / `PNEWS` / `PVENDOR` / `PQUAL` / `PORDER` / `PCRED` / `PREG`**
  （同じファイル内でも `PCONTACT` と `PHIST` の `it` キー以外は触らない）
- **`mock/js/data/ui.js`・`home.js`・`style.js`** —— `T` / `PATTERNS` / `TAGS` / `TEMPLATES` / `INDUSTRIES` / `HOME` / `FEED` / `CAT_STYLE`
- **`mock/js/data/scenarios/mfg/**`**（`mfg/gn.js` の `gn5` を含む。**既存の製造の台本は読むだけ**）
- **`mock/js/data/scenarios/{fin,it}/**` の `gn.js` 以外のファイル**
- **`data/world/{mfg,fin}/**`** —— 既存の世界マスタ
- **`data/world/it/` の `people.csv` / `org.csv` / `company.md` / `clients.csv` / `calendar.md` / `documents.csv` /
  `systems.csv` / `vendors.csv` / `kpi.csv` / `knowledge_categories.csv` / `kpi_topics.csv` / `goal_topics.csv`**
- **`portal/`（⑤ポータル）の `schema/**`・`ddl/**`・`tools/**`・`scripts/**`・`package.json`**
  —— PR-2 で変わるのは **`portal/seed/catalog.json`（生成物）だけ**
- **`dify/**`**（`apps/GN-05-document-summary.yml`・`tests/GN-05.json`・`env/**`・`kb/**`・`samples/**`）・**`scripts/**`**
- **`.github/workflows/**`**・**`package.json`**
- **`docs/handoff/2026-09-12-portal-industry-rev4.md` の本文**（§17 の表も含め 1 バイトも書き換えない。
  本書が「別 Issue」として §17 の提案を実行した形。`CLAUDE.md` §4 の作法）
- **`localStorage` のキー**（`mock.lang` / `mock.theme` / `mock.fav` の 3 つのまま）

### 5-2. 値を変えるが、形は変えない

| ファイル | 変える範囲（関数・定数の粒度） |
|---|---|
| `mock/js/data/portal/front.js` | **`PCONTACT.it` の 6 行**と **`PHIST.it` の 12 行**だけ。行数・列数・列の意味は不変 |
| `mock/js/data/catalog.js` | **`SVCS` の `id: 'gn5'` の `industries` プロパティ**だけ |
| `docs/dify/usecases/GN-05.md` | **3 行目と 14 行目**だけ（§3-9） |
| `docs/handoff/service-index.md` | **96 行目**だけ（§3-8） |
| `data/world/README.md` | **IT のファイル表に 1 行**と **IT の節に 1 段落**だけ（§2-5） |

### 5-3. 生成物（手で書かない）

`docs/service-map.md`（`npm run index`）／`tools/regress.baseline.json`（`node tools/regress.mjs --update`）／
`portal/seed/**`（`node portal/scripts/gen-seed.mjs`）。**3 つとも生成コマンドの出力をそのままコミットする。**

---

## §6 受け入れ条件（実走出力）

**すべて `main` の作業用コピーに本書のリテラルと CSV 行を実際に差し込んで実走した出力。**
reviewer はこの文字列と一致することを確認する。

### 6-1. PR-1（R-1）を当てた直後

| # | 条件 | 実走出力 |
|---|---|---|
| AC-01 | `node tools/verify.mjs` が PASS。**warn 件数は 17 のまま** | `✅ ALL PASS / ⚠️ 17 warn` |
| AC-02 | `node tools/regress.mjs` が PASS。**counts は 1 つも動かない** | `✅ regress PASS — データ層は基準と一致 {"cats":15,"subs":36,"svcs":87,"tags":67,"ui":94,"byIndustry":{"mfg":{"svcs":55,"cats":10},"fin":{"svcs":30,"cats":8},"it":{"svcs":26,"cats":7}},"svcsMulti":12}` |
| AC-03 | `node tools/check-world.mjs` の warn 合計が **12 件のまま**（内訳も同じ） | `製造（mfg）: 10 件 ／ 金融（fin）: 1 件 ／ IT（it）: 1 件 ／ 業種横断（multi）: 0 件 ／ 合計 12 件` |
| AC-04 | `[it] W9`（カバレッジ）が warn を出さない | `✅ people.csv の全員が走査対象に出現` |
| AC-05 | `[it] W1` / `W2` / `W3` / `W5` / `W6` が warn を出さない | `✅ SCENARIOS / FEED の人名はすべて people.csv に登録済み` / `✅ 台本の役職はすべて people.csv（主務＋兼務）に登録済み` / `✅ 拠点表記は company.md と整合` / `✅ 取引先記号はすべて clients.csv に登録済み` / `✅ 文書番号は calendar.md の体系に一致（該当なしを含む）` |
| AC-06 | `[it] W4` の社名出現回数が**変わらない** | `⚠️  表記の出現回数: ja「翠雲システムズ」4 回 / zh「翠云系统」4 回 / en「Suiun Systems」1 回` |
| AC-07 | **`portal/seed/**` の再生成が要らない** | `node portal/scripts/gen-seed.mjs --check` → `✅ PASS: portal/seed/** は正本から再生成した内容とバイト一致` |
| AC-08 | `npm run portal:test` が PASS | `合計: FAIL 0 件 / warn 17 件` → `✅ PASS` → `✅ PASS: portal/seed/** は正本から再生成した内容とバイト一致` |
| AC-09 | `git diff --stat` が **`mock/js/data/portal/front.js` 1 本＋新規 `data/world/it/client_contacts.csv`＋`data/world/README.md`** だけ（`portal/**` に差分なし） | `mock/js/data/portal/front.js ｜ 40 ++++++++++++++++++++--------------------` |
| AC-10 | `mock/portal.html` を IT 業種で開き `cust`（取引先）を見ると、担当者が **6 名**で、**王 磊・佐藤 美咲・劉 洋・森下 隆一・高梨 直人・陳 慧 が 1 人も出ない** | 目視（Pages） |
| AC-11 | 6 名それぞれの行を押すと接触履歴ドロワーが開き、**往復件数が 3 / 2 / 1 / 2 / 2 / 2 件**（合計 12 件、`main` と同じ） | 目視 |
| AC-12 | `PCONTACT.it`／`PHIST.it` の行範囲（差し替え後の `front.js` で `PCONTACT.it` の開始行から `PHIST.it` の終了行まで。変更前の 101〜148 行に相当）を `sed -n '<開始>,<終了>p' mock/js/data/portal/front.js \| grep -c "王 磊\\|佐藤 美咲\\|劉 洋\\|森下 隆一\\|高梨 直人\\|陳 慧"` で数えて **0**。**`mock/js/data/portal/` 全体や `front.js` 全体を対象にしない**（`sys.js`・`back.js`・`common.js`・`mgmt.js` と `front.js` の `PCRED` には、製造・金融本来の業務データとして王 磊・劉 洋・高梨 直人が正しく残る。reviewer 実測：ディレクトリ全体で 29 件、`front.js` 全体で 3 件＝いずれも正当） | `0`（行範囲限定） |

### 6-2. PR-2（R-4）を当てた直後

| # | 条件 | 実走出力 |
|---|---|---|
| AC-13 | `npm run index` の後、`node tools/verify.mjs` が PASS。**warn 件数は 17 のまま**、`it` の「台本の無い SVCS」は **11 件で並びも同じ** | `⚠️  業種 "it" で台本の無い SVCS 11 件: kn4, kn5, dc2, dc8, gn6, gn7, po1, po2, po3, po4, eg1` → `✅ ALL PASS / ⚠️ 17 warn` |
| AC-13b | **`npm run index` を忘れると FAIL する**（実走で確認済み。実装の手順漏れの検出点） | `❌ docs/service-map.md が古い、または存在しない。` |
| AC-14 | 金融・IT のポータルのホームから GN-05 を開いても **`PT.scriptWorldPlain` の代用表示が出ない**（`pscn()` の `from === want`） | 目視（Pages）。根拠は §1-7 |
| AC-15 | `node tools/regress.mjs` を **`--update` の前に**回すと、差分が **4 行ちょうど**（それ以外の増減が無い） | `- counts.byIndustry.fin: {"svcs":30,"cats":8} → {"svcs":31,"cats":8}` / `- counts.byIndustry.it: {"svcs":26,"cats":7} → {"svcs":27,"cats":7}` / `- counts.svcsMulti: 12 → 13` / `- SVCS.gn5 industries: [mfg] → [mfg,fin,it]` |
| AC-16 | `node tools/regress.mjs --update` の後、再実行で PASS | `✅ regress PASS — データ層は基準と一致 {"cats":15,"subs":36,"svcs":87,"tags":67,"ui":94,"byIndustry":{"mfg":{"svcs":55,"cats":10},"fin":{"svcs":31,"cats":8},"it":{"svcs":27,"cats":7}},"svcsMulti":13}` |
| AC-17 | 業種別の内訳行 | `業種別 svcs: mfg=55 fin=31 it=27 ／ svcsMulti(2 業種以上)=13（svcs=87）` |
| AC-18 | `node tools/check-world.mjs` の warn 合計が **12 件のまま**（台本を 2 本足しても増えない） | `製造（mfg）: 10 件 ／ 金融（fin）: 1 件 ／ IT（it）: 1 件 ／ 業種横断（multi）: 0 件 ／ 合計 12 件` |
| AC-19 | `[fin]` の W1・W2・W3・W5・W6・W8・W9 が**すべて `✅`**（新しい人名・役職・拠点・記号・文書番号・KPI 値を持ち込んでいない） | `✅ SCENARIOS / FEED の人名はすべて people.csv に登録済み` ほか 6 行 |
| AC-20 | `[it]` の W1・W2・W3・W5・W6・W8・W9 が**すべて `✅`** | 同上 |
| AC-21 | `[fin] W4` / `[it] W4` の社名出現回数が**変わらない** | `⚠️  表記の出現回数: ja「碧洋銀行」6 回 / zh「碧洋银行」2 回 / en「Hekiyo Bank」1 回` ／ `⚠️  表記の出現回数: ja「翠雲システムズ」4 回 / zh「翠云系统」4 回 / en「Suiun Systems」1 回` |
| AC-22 | **`portal/seed/**` の再生成が要る**ことを検出できる | 再生成前：`❌ 差分あり: seed/catalog.json` → `❌ FAIL: seed/** が正本と一致しない（1 件）。` |
| AC-23 | `node portal/scripts/gen-seed.mjs` の後、`portal/seed/` の差分が **`catalog.json` 1 本・`+3 -1` 行**だけ | `portal/seed/catalog.json ｜ 4 +++-` ／ 中身は `"industries": [ "mfg" ] → [ "mfg", "fin", "it" ]` |
| AC-24 | `npm run portal:test` が PASS | `合計: FAIL 0 件 / warn 17 件` → `✅ PASS` → `✅ PASS: portal/seed/** は正本から再生成した内容とバイト一致` |
| AC-25 | `npm test` が PASS | `✅ ALL PASS / ⚠️ 17 warn` ＋ `✅ regress PASS — …"svcsMulti":13}` |
| AC-26 | `docs/service-map.md` の GN-05 行が §3-7 のとおり、集計行が `①金融 31` / `①IT 16` | `git diff docs/service-map.md` が **2 行の置換だけ** |
| AC-27 | 金融のカタログ（`mock/catalog.html` 業種＝金融）で GN-05 が一覧に出て、詳細から台本が動く（ja 3 往復・zh 3 往復） | 目視（Pages） |
| AC-28 | IT のカタログでも同様に GN-05 が出て台本が動く | 目視 |
| AC-29 | **`SVCS.gn5` の `name` / `desc` / `place` / `st` / `tags` / `added` の diff がゼロ** | `git diff mock/js/data/catalog.js` が **1 行の置換だけ** |
| AC-30 | 2 本の新しい台本の `script` に **`'`（U+0027）が 1 つも無い**（verify §9 が FAIL にする） | AC-13 に含まれる |

### 6-3. 両 PR 共通（reviewer の diff 監査）

| # | 条件 |
|---|---|
| AC-31 | §5-1 の「1 バイトも触らない」に挙げたファイルに diff が無い |
| AC-32 | `mock/js/data/scenarios/mfg/**` に diff が無い（製造の台本は読むだけ） |
| AC-33 | `tools/**` の diff は `regress.baseline.json`（PR-2 のみ）だけ。`.mjs` に diff が無い |
| AC-34 | 新しい `localStorage` キー・新しい CSS トークン・新しい `data-act` が 1 つも増えていない |
| AC-35 | 実在の製品名・企業名・個人名が 1 つも入っていない（架空の世界の語だけ） |

---

## §7 PR 分割（2 本・直列）

### PR-1 —— R-1：IT の取引先担当者を IT 世界の人物にする

| | |
|---|---|
| ブランチ | `feat/<issue>-it-client-contacts` |
| ラベル | `run:cloud` |
| 触るファイル | `data/world/it/client_contacts.csv`（**新規**）／`data/world/README.md`（2 か所）／`mock/js/data/portal/front.js`（`PCONTACT.it`・`PHIST.it`） |
| 生成物 | **なし**（`portal/seed/**` も `docs/service-map.md` も `regress.baseline.json` も動かない） |
| 検証 | `npm test` ／ `node tools/check-world.mjs` ／ `node portal/scripts/gen-seed.mjs --check` ／ `npm run portal:test` |
| 受け入れ条件 | AC-01〜AC-12・AC-31〜AC-35 |

### PR-2 —— R-4：GN-05 を 3 業種に広げる

| | |
|---|---|
| ブランチ | `feat/<issue>-gn5-three-industries` |
| ラベル | `run:cloud` |
| 触るファイル | `mock/js/data/catalog.js`（1 行）／`mock/js/data/scenarios/fin/gn.js`（`gn5` 新設）／`mock/js/data/scenarios/it/gn.js`（`gn5` 新設）／`docs/dify/usecases/GN-05.md`（2 行）／`docs/handoff/service-index.md`（1 行） |
| 生成物 | `docs/service-map.md`（`npm run index`）／`tools/regress.baseline.json`（`node tools/regress.mjs --update`）／`portal/seed/catalog.json`（`node portal/scripts/gen-seed.mjs`） |
| 手順 | ① リテラルを入れる → ② `npm run index` → ③ `node tools/regress.mjs`（**差分 4 行を目視で確認してから**）→ ④ `node tools/regress.mjs --update` → ⑤ `node portal/scripts/gen-seed.mjs` → ⑥ `npm test` → ⑦ `npm run portal:test` → ⑧ `node tools/check-world.mjs` |
| 検証 | 上の ③〜⑧ |
| 受け入れ条件 | AC-13〜AC-30・AC-31〜AC-35 |

### 7-1. 順序と、直列にする理由

```
PR-1（R-1）──マージ──▶ PR-2（R-4）
```

- **直列にする理由は 2 つ。**
  ① **`data/world/README.md` を両方が触る**（PR-1 は IT のファイル表と IT の節、PR-2 は—— §4-1 のとおり
  追記不要なので**実際には触らない**が、世界マスタに手を入れる余地を残すなら衝突する）。
  ② より確実な理由として、**`portal/seed/**` は PR-2 だけが再生成する**。
  PR-1 が先にマージされていれば PR-2 の `gen-seed` は「`catalog.json` 1 本だけの差分」になり、
  reviewer が AC-23 の `+3 -1` と照合できる。**逆順や並列だと seed の差分に PR-1 由来のものが混ざる余地が生じ、
  この照合が効かなくなる。**
- **PR-1 → PR-2 の順を守る。**PR-2 を先に出してはいけない。

### 7-2. 依頼文（Issue に書く一文）

> `docs/handoff/2026-09-21-rev4-residuals-r1-r4.md` の §2 を PR-1、§3 を PR-2 として、**この順で直列に**実装する。
> リテラルは設計書に全文あるので**翻訳も創作もしない**。`data/world/` に新しい名前・数字を足すのは §2-1 の CSV 6 行だけ。

---

## §8 PM 判断待ち

| # | 論点 | architect の推奨 | 推奨で進めてよいか |
|---|---|---|---|
| **Q1** | `docs/dify/usecases/GN-05.md` §5-1 の System プロンプトが「あなたは**青嶺精工 蘇州工場**の文書要約アシスタントです」と製造の社名を固定している。3 業種に広げた以上、ここも直すべきか | **本件では直さない。別 Issue。**会社名・拠点は `CLAUDE.md` §2-12 で `dify/env/<env>/env.yml` が持つ環境差分であり、直すなら `dify/apps/GN-05-document-summary.yml` と `dify/env/**` と `dify/tests/GN-05.json` を同時に動かす必要がある（§2-12 の「既定を変えるときは 3 つ同時」）。モックの台本とは別の作業 | **推奨で進めてよい**（PR-2 は §3-9 の 2 行だけ） |
| **Q2** | `CLAUDE.md` §2-13 の跨ぎの例外を「人」にも広げる案（rev4 §17 R-1 が挙げたもう一方の選択肢） | **却下を推奨。**例外を人に広げると、IT の台本 16 本すべてで「どの人物がどの世界のものか」を人が判断し続けることになり、`check-world.mjs` の W1（人名）が IT だけ 3 世界の和集合になって検出力が落ちる。**社名・拠点名だけの例外は、案件の話に必要な最小限として設計されている**（`it/company.md` の表） | **推奨で進めてよい**（＝ `CLAUDE.md` は触らない） |
| **Q3** | `tools/check-world.mjs` の走査範囲を `mock/js/data/portal/**` にも広げるか（R-1 のような跨ぎ違反が **warn にすら出なかった**ため） | **別 Issue を推奨。**広げると `PWORLD` の `ref_world` を W1〜W9 が解釈できる必要があり、`check-world.mjs` の作り直しになる。本件（値の差し替え）とファイル集合が重ならないので並列可 | **推奨で進めてよい**（本件では `tools/**` を触らない） |
| **Q4** | `LG-01`（翻訳）の `industries` も `['mfg']` のまま。rev4 §17 R-4 は **GN-05 と LG-01 の両方**を挙げていたが、PM 決定は GN-05 のみ | **本件は GN-05 のみで確定。**LG-01 を広げるなら金融・IT の台本 2 本（各 ja/zh 3 往復）が別途要る。`LG-01` は `place: '*'` なので構造は GN-05 と同型で、本書 §3 がそのまま雛形になる | **確認だけお願いしたい**（GN-05 のみで進める、で合っていれば PM 判断不要） |

**上記 4 件はいずれも本件をマージする条件ではない。**Q1〜Q3 は推奨どおりなら PM の返信なしで PR-1・PR-2 を進めてよい。
Q4 だけ、PM 決定の読み違いが無いかの確認（GN-05 のみ）。

---

## §9 実装者への注意（地雷）

1. **3 言語同時**：`steps` は ja/zh/en の 3 言語・各 4 件で長さ一致（`verify` §9 が 3〜6 件の範囲も見る）
2. **`script` は ja/zh のみ**（en を書かない。`verify` §9 が 2〜4 往復の範囲も見る）
3. **`q` / `a` に `'`（U+0027）を書かない**。引用は `「」` か `『』`
4. **リテラル内の `}` を行頭に置かない**（`tools/lib/load.mjs` の vm 読み取りの作法）
5. **`fin/gn.js` の末尾の `gn7` には既に `,` が付いている。`it/gn.js` の末尾の `gn8` には `,` が付いていない。**
   本書はどちらも**既存エントリの前に挿入する**設計なので末尾を触らないが、位置を変えるなら `,` を確認すること
6. **`result` に markdown 表を書かない**（`items` の `{ k, v }` 形式。改行は `\n`）
7. **新しい人名・数字は `data/world/<業種>/` に先に足す**（本件で足すのは §2-1 の CSV 6 行だけ。
   `documents.csv` への追記は不要）
8. **世界を混ぜない**：IT の台本（`it/gn.js` の `gn5`）は `α 社` だけで完結させ、青嶺精工・碧洋銀行に触れない。
   `PCONTACT.it` / `PHIST.it` は社名と拠点名（青嶺精工・碧洋銀行・蘇州工場・上海本部）だけ跨ぐ
9. **実在の製品名・企業名を出さない**（`MES`・`RFP`・`L/C` のような一般語は可）
10. **`npm run index` を忘れない**（忘れると `verify` §11 が FAIL する。AC-13b）
11. **`node tools/regress.mjs --update` は差分 4 行を目視で確認してから**（それ以外の増減があればリテラルの書き間違い）
