# 部門ポータルの業種対応（rev4）

- 日付: 2026-09-12
- レーン: **M/L**（データ層・画面台帳・共通レイヤー・`tools/verify.mjs` §17・`regress` 基準に触る）
- 実行場所: **`run:cloud`**（ネットワーク不要。設計・実装・検証すべてクラウドで回る）
- 種別: 設計書（architect）。実装は implementer、マージ判定は reviewer
- 位置づけ: `docs/handoff/2026-09-11-portal-mock-pages.md`（rev2＋§15）の **rev4**。
  同書には **§16 として 1 段落の参照**だけを追記し、本文 §0〜§15 は書き換えない。
  **同書 §14 の規則 1・規則 2 は本書で撤回する**（§14 の見出し直下に注記 1 行を足す）
- 前段: `docs/handoff/2026-09-12-portal-industry-fronts.md`（#293 の調査提案書）。
  **PM は 2026-09-12 に同書の推奨をすべて採用した**（(a)(b)・Q1〜Q4）。本書はその決定を実装可能な形に落としたもの
- 関連: `2026-09-10-portal-nocobase.md`（rev3・本番設計）／`2026-09-11-sysops-usecase.md`（`sys` 画面）／
  `2026-09-11-it-industry.md`（3 世界と跨ぎの例外）／`2026-09-12-portal-indicators-i18n.md`（指標名の正本と verify §19）／
  `CLAUDE.md` §2-1・§2-3・§2-6・§2-9・§2-13・§2-14
- 本書の数字は **`origin/main` の `d484ff7`（`SVCS` 82 件・`PT` 73 キー・`PSCREENS` 16 件）を実走して数えたもの**

---

## §0 結論

### 0-1. 8 行

1. **ポータルは「翠雲システムズ 1 社の部門ポータル」から「業種ごとに会社が替わる 3 つの部門ポータル」になる。**
   業種チップ（`.mockbar`・足場）を動かすと、**会社・部門・ログイン中の人・見える画面・行データ・「この画面の AI」**が
   まとめて替わる。台本（`SCENARIOS`）は 1 バイトも触らない。
2. **画面 id は 16 → 20。新設 4 枚（`qual` / `order` / `cred` / `reg`）、消える画面は 0。**
   業種ごとに見えるのは **製造 17 枚 / 金融 16 枚 / IT 16 枚**。
3. **`cust` を「顧客」から「取引先」へ作り替え、全業種テンプレートにする**（PM 決定 (b)）。
   `watch`・`vend` は**フロント → 共通**へ移す（グループが替わるだけで、画面は消えない）。
4. **`sys`（稼働状況）を業種テンプレートにし、製造では「設備の稼働状況」として出す**（PM 決定 Q3）。金融では出さない。
5. **`SVCS[].place` を 27 件付け替える**。`'out'`（ポータルに置かない）は **18 件 → 0 件**になる。
   **`SVCS[].industries` は 1 件も変えない**（`regress` の `counts` を 1 つも動かさない）。
6. **規則 1（画面の AI を業種で絞らない）・規則 2（業種チップは AI サービス画面だけを再描画する）を撤回する**（PM 決定 Q1）。
   その結果 **49 マス中 11 マスが「この画面の AI：0 本」**になる。空マスは `PT.noScreenAi` で正直に出す。
7. **世界マスタに 49 行を先に足す**（PM 決定 Q4 ＋ 製造の品質・受注記録と両業種の取引先担当者）。
   新しい番号体系は 1 つも作らない（すべて既存の `calendar.md` の書式に載せる）。
8. **PR は 7 本**（マスタ先行 1 ＋ モック 6）。`PR-C` と `PR-D` だけ並列可、あとは直列。

### 0-2. 画面構成（業種 × 区分 × 画面 id）

```
                       製造 mfg              金融 fin              IT it
                       青嶺精工 蘇州工場     碧洋銀行 上海本部     翠雲システムズ 上海
┌ （グループなし）──────────────────────────────────────────────────────────────
│ home   ホーム          ●                     ●                     ●
├ gFront フロント業務────────────────────────────────────────────────────────────
│ cust   取引先          ● partners 顧客 3     ● clients 5           ● clients 4    ← 作り替え(b)
│ proj   案件            －                     －                     ● PDEALS 10
│ qual   品質・不具合    ● 新設 14 行          －                     －            ← 新設
│ order  受注・出荷      ● 新設  9 行          －                     －            ← 新設
│ cred   与信・審査      －                     ● 新設  7 行          －            ← 新設
│ reg    当局対応・レポート －                   ● 新設 14 行          －            ← 新設
├ gCommon 共通業務───────────────────────────────────────────────────────────────
│ act    To Do           ●                     ●                     ●
│ sys    稼働状況        ● 設備 6 件           －（画面ごと出ない）   ● システム 9 件
│ meet   会議            ●                     ●                     ●
│ know   ナレッジ        ●                     ●                     ●
│ watch  ニュース・ウォッチ ●                   ●                     ●            ← gFront から移動
│ vend   仕入先・パートナー ●                   ●                     ●            ← gFront から移動
│ ai     AI サービス     ●                     ●                     ●
├ gMgmt マネジメント─────────────────────────────────────────────────────────────
│ kpi    KPI             ●                     ●                     ●
│ goal   目標            ●                     ●                     ●
│ ppl    要員            ●                     ●                     ●
├ gBack バック業務───────────────────────────────────────────────────────────────
│ exp    経費・経理      ●                     ●                     ●
│ req    申請・承認      ●                     ●                     ●
│ trn    研修・サーベイ  ●                     ●                     ●
└──────────────────────────────────────────────────────────────────────────────
画面 id の集合 = 20（現行 16 ＋ 新設 4）。見える枚数 = 製造 17 ／ 金融 16 ／ IT 16。
「この画面の AI」のマス = 17+16+16 = 49（うち 0 本は 11 マス。§11-3）。
```

### 0-3. 変更の一覧（何をどこで）

| # | 変えるもの | ファイル | PR |
|---|---|---|---|
| 1 | 世界マスタ（新 CSV 5 本・追記 1 本・49 行） | `data/world/{mfg,fin}/**`・`data/world/README.md` | PR-0 |
| 2 | 画面台帳 `PSCREENS`（`ind` / `lbl` / `ct`）＋ `PT` の画面名 4 つ | `mock/js/data/portal/ui.js` | PR-A |
| 3 | ナビの業種絞り込み ＋ 新 4 画面の殻 | `mock/js/portal/render.js` | PR-A |
| 4 | 行データ定数 23 本の業種化 ＋ `PCOMPANY` ＋ `pd()` ＋ `pstate` の業種別 | `mock/js/data/portal/{org,front,common,mgmt,back,sys}.js`・`js/portal/{app,render,events}.js` | PR-B |
| 5 | `cust` を「取引先」テンプレートへ（`PPART` / `PQTR` / `PCONTACT` / `PHIST`） | `mock/js/data/portal/front.js`・`js/portal/render.js` | PR-C |
| 6 | 新画面 4 枚の中身（`PQUAL` / `PORDER` / `PCRED` / `PREG`） | `mock/js/data/portal/front.js`・`js/portal/render.js` | PR-D |
| 7 | `place` の付け直し 27 件 ＋ 規則 1 撤回 ＋ `V.ai` 作り直し | `mock/js/data/catalog.js`・`js/portal/{app,render}.js`・`tools/{verify,regress}.mjs`・`regress.baseline.json` | PR-E |
| 8 | 台本の世界の解決（`pworldOf` の fallback）＋ 規則 5・6 の文言 | `mock/js/portal/{app,demo}.js`・`js/data/portal/ui.js` | PR-F |
| 9 | `INDUSTRIES.mfg.dept` の不整合是正（情報システム部 → 製造二課） | `mock/js/data/ui.js` | PR-B |

---

## §1 目的・範囲・触らない範囲

### 1-1. 目的

1. 顧客に「**あなたの会社の部門ポータルだとこう見える**」を、業種チップ 1 つで見せられるようにする。
2. カタログ 82 件のうち**置き場所が無かった 18 件に画面を与える**（`out` → 0）。
   「どの業務画面から、どの AI が呼べるか」を業種ごとに正直に見せる。
3. **カタログの穴が見えるようにする**。規則 1 を撤回すると 11 マスが「AI 0 本」になる。これは事故ではなく材料である。

### 1-2. 変更する範囲

`data/world/{mfg,fin}/**`・`data/world/README.md`・
`mock/js/data/ui.js`（`INDUSTRIES.mfg.dept` の 1 行だけ）・`mock/js/data/catalog.js`（`place` の 27 行だけ）・
`mock/js/data/portal/**`（7 本すべて）・`mock/js/portal/**`（4 本すべて）・
`tools/verify.mjs`（§17 のみ）・`tools/regress.mjs`（`place` の比較 1 か所）・`tools/regress.baseline.json`（`--update` 1 回）・
`docs/handoff/2026-09-11-portal-mock-pages.md`（**§16 の 1 段落と §14 の注記 1 行だけ**）。

### 1-3. 触らない範囲（明示）

**1 バイトも触らない：**

- `mock/js/data/scenarios/**`（台本 95 本）——**読むだけ**（rev2 §14-6 規則 5-2・AC-22）
- `mock/catalog.html`・`mock/js/{app,render,events}.js`・`mock/css/components.css`——カタログの見え方は 1 ピクセルも変えない
- `mock/css/tokens.css`——`--ntt-*` も dark ブロックの本数も変えない（`CLAUDE.md` §2-2）。
  **新しいトークンも足さない**（新画面は既存の `.block` / `.tw` / `ptbl()` / `.tile` / `.chip` / `.st` だけで組む）
- `mock/css/portal.css`——**新しいクラスを足さない**。新画面 4 枚は既存クラスの組み合わせだけで作る
- `mock/js/data/home.js`——`FEED[].persona` は**読むだけ**（ポータルが主語として引く）
- `mock/js/data/portal/**` の **`PKNOW` / `PKPITOPIC` / `PGOAL.topics`**
  ——**`tools/verify.mjs` §19-c が `data/world/it/*.csv` の `name_ja` とバイト一致を検査している**（#292）。
  **業種化すると即 FAIL する。**業種で分けない（理由は §7-1）
- `portal/**`（⑤ポータル・NocoBase）——スキーマ・seed・DDL。**業種は DB の列にしない**（§13-2）。
  `portal/scripts/gen-seed.mjs` は `SVCS[].place` も `PSCREENS` も読んでいない（実走で確認）。
  したがって `npm run portal:test` は**回す必要がない**（`CLAUDE.md` §2-14）
- `dify/**`・`scripts/**`・`docs/demo/**`・`docs/dify/**`
- `.github/workflows/**`（`pages.yml` は `path: mock` のまま）
- `docs/handoff/2026-09-11-portal-mock-pages.md` の **§0〜§15 の本文**（改訂は §16 の参照と §14 の注記のみ）
- `CLAUDE.md`・`.claude/**`——**改定は不要**（§13-4 で確認した）
- `localStorage` のキー——`mock.lang` / `mock.theme` の 2 つのまま。**業種は保存しない**（`CLAUDE.md` §2-6・rev2 D11）

**値を変えるが、形は変えない：**

- `mock/js/data/catalog.js`——`SVCS[].place` **だけ**。`id`/`cat`/`sub`/`st`/`industries`/`tags`/`name`/`desc`/`added` と
  `CATS` は 1 バイトも触らない（`CLAUDE.md` §2-9・§2-11）

---

## §2 rev2 §14 の規則の改訂

| 規則 | rev2 | rev4 |
|---|---|---|
| 規則 1 | この画面の AI は**業種で絞らない** | **撤回。**「`place` が一致し、**かつ** `industries` に表示中の業種を含む」に戻す（§2-1） |
| 規則 2 | 業種チップが変えるのは AI サービス画面だけ | **撤回。**業種チップは `renderAll()` を呼ぶ（§2-2） |
| 規則 3 | 台本の業種は**行の世界**が決める | **維持。ただし fallback を精密化**（`'it'` 固定 → 表示中の業種）（§2-3） |
| 規則 4 | 行の世界の正本は `data/world/it/clients.csv` | **維持。**`PWORLD` は 1 行も増やさない（§2-3） |
| 規則 5 | 世界の語の扱い | **維持。**ポータルのデータ層が使ってよい世界が業種ごとに 1 つに決まるので、**むしろ厳しくなる**（§2-4） |
| 規則 6 | 代用の明示 | **維持。文言だけ更新**（`scriptWorldPlain`。§12-3） |

### 2-1. 規則 1 の撤回 —— 「この画面の AI」の式

```
その画面の AI = SVCS.filter(s => placeOf(s, ind) === 画面id && s.industries.includes(ind))
                並び順: st 昇順（提供中 → 試行版 → 構想） → 管理番号昇順
ホームの横断 AI = SVCS.filter(s => placeOf(s, ind) === '*' && s.industries.includes(ind))

placeOf(s, ind) = （s.place が文字列なら）s.place
                  （s.place がオブジェクトなら）s.place[ind]
                  （s.place が無ければ）undefined
```

**撤回する理由**：規則 1 の根拠は「自部門は 1 つしかないので、自部門のポータルの画面構成が顧客業種で変わるのはおかしい」だった。
**ポータルを 3 社に増やした時点でこの前提が消える。**青嶺精工の品質画面に金融の CV-03（審査コメントのドラフト）が出るのは明確に誤りである。

**空マスの扱い**：0 本のときは `PT.noScreenAi`（ホームの横断ブロックは `PT.noCrossAi`）を 1 行出す。
ブロックそのものは消さない——**「この画面で効く AI をこれから作ります」という会話の材料になる**（PM 決定 Q1）。

### 2-2. 規則 2 の撤回 —— 再描画の範囲

業種チップは **`renderAll()`** を呼ぶ（カタログ側の業種切替と同じ振る舞い）。`mock/js/portal/events.js` の 1 か所。
あわせて `renderIdentity()`（レール上部の会社名・部門名・拠点、ヘッダの who ブロック、環境チップ）を呼ぶ。

**業種切替の副作用（意図どおり）**

| 状態 | 業種切替のとき |
|---|---|
| `pstate.scr`（いま見ている画面） | **その業種で見えるなら維持、見えないなら `home` へ落とす** |
| 絞り込み（`pipeCu`/`pipeTeam`/`dealF`/`dealSort`/`cuFilter`/`kindFilter`/`sysCu`/`sysSt`/`sysScope`） | **初期化する**（他業種の行 id を指しているため） |
| `pstate.back`（行に残した AI の戻り） | **業種ごとに保持する**（`back[業種][画面][行]`。§4-2） |
| `pstate.cand` / `candSeq`（To Do 候補の採否） | **業種ごとに保持する**（§4-2） |
| `pstate.now`（時刻プリセット）・`lang`・`theme`・`perm`/`dev`/`usr`/`prod` | **維持する**（業種と無関係） |

### 2-3. 規則 3 の精密化 —— fallback を「表示中の業種」に

```js
/* js/portal/app.js（PR-F） */
/** 行の世界：行の顧客がどの架空世界の会社か。
    行が無い／行の顧客が世界を跨がないなら、いま見ているポータルの業種（＝その会社の世界）。 */
const pworldOf = (ctx) => (ctx && PWORLD[ctx.cu]) || pstate.ind;
```

**変えるのは最後の `|| 'it'` → `|| pstate.ind` の 1 か所だけ。**`pscn()` は 1 行も変えない。

**なぜ正しいか**：rev2 の `'it'` は「ポータル＝翠雲システムズ＝ IT 世界」を直接書いたもの。
rev4 ではポータルの会社が業種で替わるので、**同じことを言うには `pstate.ind` と書くのが正しい**。

**`PWORLD` は 1 行も増やさない。**`CLAUDE.md` §2-13 により、**世界を跨いだ参照ができるのは IT 世界だけ**
（`data/world/it/clients.csv` の `ref_world`）。製造ポータルの行はすべて製造世界、金融ポータルの行はすべて金融世界なので、
**跨ぎの辞書が要るのは IT だけ**である。`PWORLD` は `PDEALS[].cu`（`proj` ＝ IT 専用画面）と対応したまま変わらない（verify §17-k はそのまま）。

**`pstate.ind` を読むのは `pworldOf()` **1 関数だけ**にする**（verify §17-l で担保。§14-2）。

### 2-4. 規則 5 の強化 —— ポータルのデータ層が使ってよい世界

```
mock/js/data/portal/** の <定数>.mfg → data/world/mfg/ の語だけ
                        <定数>.fin → data/world/fin/ の語だけ
                        <定数>.it  → data/world/it/ の語だけ
                                     ＋ 社名・拠点名に限り 青嶺精工・碧洋銀行・蘇州工場・上海本部（ref_world の例外）
```

- 台本（`SCENARIOS`）の中の語は**台本の世界のもの**。ポータルは 1 文字も書き換えない（rev2 §14-6-2 のまま）
- `scn.persona` はポータルでは使わない（rev2 §14-6-3 のまま）。会話の主語は**その業種のログイン中の利用者**
- **`tools/check-world.mjs`（`npm run world`）は `mock/js/data/portal/**` を見ていない**（`loadMock()` が
  `catalog.html` の `<script src>` を読むため、ポータルのデータ層は対象外。実走で確認）。
  したがって **PR-B・PR-C・PR-D では warn が増えも減りもしない**。
  世界の混ざりは **reviewer の diff 監査**と **verify §17-p（新設。§14-2）**で見る

---

## §3 画面台帳（`PSCREENS`）

### 3-1. 形

```js
/* mock/js/data/portal/ui.js */
const PSCREENS = [
  { grp: '',        id: 'home',  icon: '…', ct: null },
  { grp: 'gFront',  id: 'cust',  icon: '…', ct: { mfg: '3',  fin: '5',  it: '4'  } },
  { grp: 'gFront',  id: 'proj',  icon: '…', ind: ['it'],        ct: { it: '10' } },
  { grp: 'gFront',  id: 'qual',  icon: '…', ind: ['mfg'],       ct: { mfg: '14' } },
  { grp: 'gFront',  id: 'order', icon: '…', ind: ['mfg'],       ct: { mfg: '9'  } },
  { grp: 'gFront',  id: 'cred',  icon: '…', ind: ['fin'],       ct: { fin: '7'  } },
  { grp: 'gFront',  id: 'reg',   icon: '…', ind: ['fin'],       ct: { fin: '14' } },
  { grp: 'gCommon', id: 'act',   icon: '…', ct: { mfg: '10', fin: '10', it: '10' } },
  { grp: 'gCommon', id: 'sys',   icon: '…', ind: ['mfg','it'], lbl: { mfg: 'sysMfg' }, ct: { mfg: '6', it: '9' } },
  { grp: 'gCommon', id: 'meet',  icon: '…', ct: { mfg: '4',  fin: '4',  it: '4'  } },
  { grp: 'gCommon', id: 'know',  icon: '…', ct: { mfg: '12', fin: '12', it: '12' } },
  { grp: 'gCommon', id: 'watch', icon: '…', ct: { mfg: '5',  fin: '5',  it: '5'  } },
  { grp: 'gCommon', id: 'vend',  icon: '…', ct: { mfg: '6',  fin: '3',  it: '3'  } },
  { grp: 'gCommon', id: 'ai',    icon: '…' },
  { grp: 'gMgmt',   id: 'kpi',   icon: '…', ct: { mfg: '9',  fin: '9',  it: '9'  } },
  { grp: 'gMgmt',   id: 'goal',  icon: '…', ct: { mfg: '4',  fin: '4',  it: '4'  } },
  { grp: 'gMgmt',   id: 'ppl',   icon: '…', ct: { mfg: '6',  fin: '6',  it: '5'  } },
  { grp: 'gBack',   id: 'exp',   icon: '…', ct: { mfg: '3',  fin: '3',  it: '3'  } },
  { grp: 'gBack',   id: 'req',   icon: '…', ct: { mfg: '4',  fin: '4',  it: '4'  } },
  { grp: 'gBack',   id: 'trn',   icon: '…', ct: { mfg: '8',  fin: '8',  it: '11' } }
];
```

- **`ind` を省略＝全業種**（`home`・`cust`・共通・マネジメント・バックの 14 枚）
- **`icon` は現行の 16 枚をそのまま使い、新 4 枚だけ足す**（§3-3）
- **`ct` は文字列 → 業種別オブジェクト**。`renderRail()` は `s.ct && s.ct[pstate.ind]` を読む。
  `ai` は現行どおり `SVCS.length` から出す（業種で絞らない。カタログ全体の件数だから）
- **`lbl` はラベルキーの業種別上書き**。いまは `sys` の `mfg` だけ（`PT.sysMfg`＝設備の稼働状況）

### 3-2. `watch` / `vend` のグループ移動

`grp` を `gFront` → `gCommon` に変えるだけ。**`PGRP` は 4 つのまま変えない。**
移動の理由：ニュース収集も仕入先管理も**業種に関係なく同じ形で成立する**（PM 決定 (a) 方針 2）。
フロントに残すと「製造のフロントが 4 枚・金融が 4 枚・IT が 3 枚」になり、業種別フロントの対比がぼやける。

### 3-3. 新 4 画面のアイコン（`PSCREENS[].icon`。20×20・`stroke-width:1.6`・既存と同じ作法）

| id | `icon`（path の `d`） | 図柄 |
|---|---|---|
| `qual` | `M10 2.5l6.5 3v5c0 3.6-2.7 6.3-6.5 7-3.8-.7-6.5-3.4-6.5-7v-5z M7.4 10l1.9 1.9 3.3-3.6` | 盾＋チェック（品質） |
| `order` | `M3 6h9l2 3h3v6H3z M6 15a1.4 1.4 0 100 .1 M13 15a1.4 1.4 0 100 .1 M3 4h6` | 荷台＋車輪（出荷） |
| `cred` | `M3 8l7-4 7 4v1H3z M5 9v5M9 9v5M13 9v5M15 9v5M3 16h14` | 銀行（与信） |
| `reg` | `M5 3h10v14H5z M7.5 6.5h5M7.5 9.5h5M7.5 12.5h3 M14.5 14.5l1.5 1.5` | 文書＋押印（当局） |

---

## §4 状態と遷移

### 4-1. `pd()` —— 業種で行データを引く 1 つのヘルパー

```js
/* js/portal/app.js（PR-B）。業種ごとの行データを引く。
   その業種のキーが無いときは it に落とす（PSCREENS[].ind で画面自体を隠しているので通常は起きない）。 */
const pd = (obj) => (obj && (obj[pstate.ind] ?? obj.it)) || [];
```

**`pdata('PACT')` のような「定数名を文字列で渡す」形は使えない。**
`mock/js/data/portal/**` は `const` 宣言なので `window` に載らない（`CLAUDE.md` §2-3 の「純粋なリテラル宣言のみ」の帰結）。
描画側は **`PACT.map(...)` → `pd(PACT).map(...)`** と、識別子をそのまま渡す形に置き換える。
**HTML の構造は 1 行も変えない**（提案書 §7-2 ③ の記述をここで訂正する）。

### 4-2. `pstate` の変更（3 か所だけ）

```js
const pstate = {
  ind: 'it',          // 変えない（既定は IT＝翠雲システムズ。rev3 の本番設計と揃える）
  …（lang / theme / scr / perm / dev / usr / prod / now / mockbar は現行のまま。`mockbar` は #297 が足した帯の折りたたみ状態）…

  /* ▼ 変更 1：行に残した AI の戻りを業種ごとに持つ。back[業種][画面id][行id] = [{svc, at, line}] */
  back: { mfg: {}, fin: {}, it: {} },

  /* ▼ 変更 2：To Do 候補の採否を業種ごとに持つ（PCAND の業種別クローン） */
  cand:    { mfg: PCAND.mfg.map(c => Object.assign({}, c)),
             fin: PCAND.fin.map(c => Object.assign({}, c)),
             it:  PCAND.it .map(c => Object.assign({}, c)) },
  candSeq: { mfg: 960, fin: 960, it: 960 },

  /* ▼ 変更 3：絞り込みは業種切替で初期化する（値の形は変えない） */
  pipeCu: '', pipeTeam: '', dealSort: { key: 'sg', dir: 'asc' },
  dealF: { cu: '', ow: '', sg: '', rag: '' },
  cuFilter: '', kindFilter: '', sysScope: 'all', sysCu: '', sysSt: ''
};
```

`pstate` の**キー名は 1 つも増やさない／減らさない**（`back` / `cand` / `candSeq` の**値の形**だけが変わる）。

### 4-3. 業種切替のハンドラ（`js/portal/events.js`。規則 2 の撤回）

```
#indSw .chip の click
  1. pstate.ind = chip.dataset.ind
  2. チップの aria-pressed を付け替える
  3. 絞り込みを初期化（pipeCu / pipeTeam / dealF / dealSort / cuFilter / kindFilter / sysScope / sysCu / sysSt）
  4. いまの画面がその業種で見えないなら pstate.scr = 'home'
  5. renderIdentity()   ← レール上部・ヘッダの who・環境チップ
  6. renderAll()        ← ナビ・全画面・3 層分類・候補リスト・showScreen
  7. renderNowSw()      ← sys の時刻プリセット（sys が見える業種のときだけ／既に有れば何もしない）
```

### 4-4. `pstate.back` が業種を跨ぐときの扱い（PM の問い）

**業種ごとに保持する（破棄しない）。**
理由：PR-4 の訴求は「**結果がその画面に残る**」。デモで業種を往復するたびに消えると、
「残る」ことを見せた直後に消える——という最悪の見え方になる。
行 id は業種ごとに別空間（`K 社` / `甲社` / `青嶺精工`）なので、業種で 1 段掘るだけで衝突もしない。
`localStorage` には**書かない**（メモリのみ。`CLAUDE.md` §2-6）。

---

## §5 会社・部門・ペルソナ（`PCOMPANY`）

### 5-1. 決めたこと

| 業種 | 社名（`INDUSTRIES[].wordmark`） | 部門（`INDUSTRIES[].dept`） | 主語（`FEED[業種].persona`） | 拠点・期 |
|---|---|---|---|---|
| mfg | 青嶺精工 | **製造二課**（← 情報システム部） | 李 強／製造二課 課長／蘇州工場 | 蘇州工場 ／ 2025 年 9 月 |
| fin | 碧洋銀行 | 事務統括部 | 韓 雪／事務統括部 主管／上海本部 | 上海本部 ／ FY2026 上期 |
| it | 翠雲システムズ | ソリューション本部 | 岸本 奈津／PMO室 主任／上海拠点 | 上海 ／ FY2026 上期 |

**`INDUSTRIES.mfg.dept` を「情報システム部」→「製造二課」に直す**（`mock/js/data/ui.js` の 1 行・3 言語）。
理由：`data/world/mfg/org.csv` の 16 部署に**情報システム部は存在しない**。`seizo2`（製造二課）は実在し、
`FEED.mfg.persona`（李 強／製造二課 課長）の所属と一致する。**PM 決定 Q2 の既定（`FEED` 流用）**に従い、
主語は差し替えず、**部門名のほうを主語に合わせる**。

```js
/* mock/js/data/ui.js の INDUSTRIES[0].dept を置き換える（この 1 行だけ） */
dept: { ja: '製造二課', zh: '制造二科', en: 'Manufacturing Section 2' },
```

**「製造二課の課長が受注・出荷と取引先の画面を見るのか」への答え**：見る。
製造二課は K 社向けブラケット系（`SK-3310-A` / `SK-2207-B` / `SK-3318`）の製造を担当しており、
**自課の受注残・納期・出荷予定・不具合はこの課長の仕事に直結する**。
なお粒度（課／部／本部）は業種で揃っていないが、これは 3 社の実在する組織をそのまま使っているためで、揃えない。

### 5-2. `PCOMPANY`（新設・`mock/js/data/portal/org.js`）

```js
/* mock/js/data/portal/org.js（PR-B で追加）
   会社名・部門名は INDUSTRIES[].wordmark / dept が正本（二重に持たない）。
   ここが持つのは「拠点と期」「閲覧範囲」「アバターの 2 文字」だけ。 */
const PCOMPANY = {
  mfg: {
    av: 'LQ',
    fy: 'FY2025',
    site:  { ja: '蘇州工場 ／ 2025 年 9 月',   zh: '苏州工厂 ／ 2025 年 9 月',   en: 'Suzhou Plant / September 2025' },
    scope: { ja: '製造二課 ／ 自課の受注・品質を閲覧', zh: '制造二科 ／ 查看本科的订单与质量', en: 'Mfg. Sec. 2 / own orders and quality' }
  },
  fin: {
    av: 'HX',
    fy: 'FY2026',
    site:  { ja: '上海本部 ／ FY2026 上期',   zh: '上海总部 ／ FY2026 上半年',   en: 'Shanghai Head Office / FY2026 H1' },
    scope: { ja: '事務統括部 ／ 全行の事務を閲覧', zh: '事务统筹部 ／ 查看全行事务', en: 'Operations Planning / bank-wide' }
  },
  it: {
    av: 'KN',
    fy: 'FY2026',
    site:  { ja: '上海 ／ FY2026 上期',       zh: '上海 ／ FY2026 上半年',       en: 'Shanghai / FY2026 H1' },
    scope: { ja: 'PMO ／ 全案件 閲覧',        zh: 'PMO ／ 可查看全部项目',        en: 'PMO / all projects' }
  }
};
```

**`PT.org` / `PT.site` / `PT.role` の 3 キーは削除する**（`PCOMPANY` と `INDUSTRIES` から組み立てるため）。
`PT` は 71 → 71 + 追加 18 − 削除 3 = **86 キー**（§12-4）。

### 5-3. `renderIdentity()`（`js/portal/render.js` に新設・約 12 行）

```
#brandOrg  ← PL(INDUSTRIES[ind].wordmark) + ' ' + PL(INDUSTRIES[ind].dept)
#brandSite ← PL(PCOMPANY[ind].site)
#avatar    ← PCOMPANY[ind].av
#whoName   ← PL(FEED[ind].persona.name)
#whoRole   ← PL(FEED[ind].persona.role) + ' ／ ' + PL(PCOMPANY[ind].scope)
#crumb     ← PL(INDUSTRIES[ind].wordmark) + ' ' + pt('brand') + ' ／ ' + pt(画面id)
```

`showScreen()` の `pt('org').split(' ')[0]` は `PL(INDUSTRIES[pstate.ind].wordmark)` に置き換える。
`PORG.persona` は削除し、`PORG.team`（氏名 → チーム。`proj` ＝ IT 専用画面の絞り込み）だけを残す。

---

## §6 世界マスタへの追加（PR-0。合計 49 行）

**新しい番号体系は 1 つも作らない。**すべて `data/world/{mfg,fin}/calendar.md` に既にある書式に載せる。
**ポータル内部の行 id（`A-…` To Do・`M-…` 会議・`E-…` 経費・`R-…` 申請・`G-…` 目標・`S-…` サーベイ・`C-…` 候補・`EV-…` イベント）は
ポータルの持ち物であり、世界マスタには登録しない**（IT でも現にそうなっている）。
マスタに足すのは**世界に属する識別子**（品番・設備・取引先・人・不具合・受注・稟議・当局通達）だけである。

### 6-1. `data/world/mfg/calendar.md` への追記（2 行）

```
## 会計年度・締め日
- 会計年度：**4/1〜3/31**（日本本社に合わせる）。出典 `docs/handoff/2026-09-12-portal-industry-rev4.md` §5-1。
  ポータルの四半期表（`PQTR.mfg`）で必要になったため確定した（それまでは「台本に明記なし（未確定）」）
```

文書番号の体系の表には**追記しない**（本 PR で使う `NC-` `CL-` `ECR-` `TR-` `8D-` `CAR-` `RFQ-` `SO-` `INV-` `PL-` `RT-` は
すべて既に登録済み）。

### 6-2. `data/world/mfg/records.csv`（新設・19 行）

ヘッダ：`record_id,kind,opened,due,part_no,partner_code,equip_id,owner_dept,state,title_ja,title_zh,title_en,note`
`kind`：`nc`（不具合）/ `claim`（顧客クレーム）/ `ecr`（変更要求）/ `tr`（技術報告）/ `rfq`（引合）/ `so`（受注）/ `ship`（出荷・通関）
`state`：`open` / `review` / `hold` / `closed`
**どのフィールドにも ASCII の `,` と `"` を入れない**（§19-f と同じ作法）。

```csv
record_id,kind,opened,due,part_no,partner_code,equip_id,owner_dept,state,title_ja,title_zh,title_en,note
NC-2025-0912,nc,2025-09-12,2025-09-19,SK-3310-A,K 社,PX-200,hinshitsu,open,初品の寸法ばらつき,首件尺寸波动,First-article dimensional variation,台本既出（mock/js/data/scenarios/mfg/qa.js）
NC-2024-0118,nc,2024-11-18,,SK-3310-A,K 社,D-118,hinshitsu,closed,冷間時の位置ずれによる不適合,冷态时定位偏移导致的不合格,Nonconformance from cold-start misalignment,台本既出（qa.js・kn.js）
8D-25-0912,nc,2025-09-12,2025-09-26,SK-3310-A,K 社,PX-200,hinshitsu,open,8D 報告（寸法ばらつき）,8D 报告（尺寸波动）,8D report for dimensional variation,台本既出（qa.js）
CL-25-0906,claim,2025-09-06,2025-09-13,SK-3310-A,K 社,,hinshitsu,open,塗装ブツのクレーム,涂装颗粒投诉,Paint-speck claim,台本既出（qa.js）
CL-25-0906-02,claim,2025-09-06,2025-09-13,SK-2207-B,K 社,,hinshitsu,open,タップ不通のクレーム（同日 2 件目）,丝锥不通投诉（同日第 2 件）,Tapping-blockage claim (same day second case),台本既出（qa.js）
CAR-24-01,nc,2024-10-02,,,K 社,,hinshitsu,closed,工程監査の是正処置報告,工序审核纠正措施报告,Process-audit corrective action report,docs/dify/usecases/QA-04.md
ECR-25-0088,ecr,2025-08-20,2025-09-30,SK-3310-A,T 社,,gijutsu,review,鋼板供給先の切替（S 社 → T 社）,钢板供应商切换（S 公司 → T 公司）,Steel supplier switch from S to T,台本既出（qa.js・pt.js）
ECR-24-0017,ecr,2024-05-14,,SK-2207-B,,,gijutsu,closed,曲げ工程の順序変更,折弯工序顺序变更,Bending sequence change,台本既出（qa.js）
ECR-23-0041,ecr,2023-06-08,,SK-3310-A,U 社,,gijutsu,closed,代替鋼板への切替,切换至替代钢板,Switch to alternate steel supplier,台本既出（partners.csv の U 社）
TR-2024-007,tr,2024-07-03,,SK-3310-A,,PX-200,gijutsu,closed,E-47 アラームの原因調査,E-47 报警原因调查,Root-cause study for alarm E-47,台本既出（kn.js・dc.js）
TR-2024-102,tr,2024-12-11,,SK-3310-A,,J-3310,gijutsu,closed,塗装治具の寸法流用検討,涂装治具尺寸沿用研究,Paint-jig dimension reuse study,台本既出（en.js）
TR-2023-041,tr,2023-04-19,,SK-1190,J 社,D-092,gijutsu,closed,生産終了品の金型保管方針,停产品的模具保管方针,Mold retention policy for discontinued part,台本既出（en.js）
RFQ-2025-118,rfq,2025-09-01,2025-09-19,SK-3310-C,K 社,,eigyo,open,新規ブラケットの引合,新支架询价,RFQ for a new bracket,台本既出（nm.js）
RFQ-2025-131,rfq,2025-09-05,2025-09-26,SK-3318,V 社,,eigyo,open,ステーの引合（年間上限条項つき）,支撑件询价（含年度上限条款）,RFQ for a stay with annual value cap,本設計で追加（書式は calendar.md の RFQ-YYYY-NNN）
SO-2509-018,so,2025-09-08,2025-09-30,SK-3310-A,K 社,,seisankanri,open,9 月分の確定受注,9 月确定订单,Confirmed order for September,台本既出（gn.js GN-03）
SO-2510-001,so,2025-09-09,2025-10-31,SK-2207-B,K 社,,seisankanri,open,10 月分（日本向け）,10 月订单（面向日本）,October order for Japan,台本既出（gn.js GN-03）
SO-2510-003,so,2025-09-10,2025-10-31,SK-3310-A,V 社,,seisankanri,hold,10 月分（年間上限条項の確認待ち）,10 月订单（等待年度上限条款确认）,October order on hold for value-cap check,台本既出（gn.js GN-03）
INV-2025-0906,ship,2025-09-06,,SK-3310-A,K 社,,butsuryu,closed,上海発 大阪向けの発票,上海发往大阪的发票,Invoice for the Shanghai to Osaka shipment,台本既出（dc.js DC-06）
RT-2508-04,ship,2025-08-22,,SK-2207-B,K 社,,butsuryu,closed,タップ不通分の返品,丝锥不通品退货,Return for tapping-blockage parts,台本既出（gn.js GN-02）
```

> `PL-2025-0906`（パッキングリスト）は `INV-2025-0906` と同一出荷の対になる書類なので、**行にはせず
> `PORDER` の「書類」列で `INV-2025-0906 / PL-2025-0906` と並べて出す**（マスタに 2 行持たない）。
> `SO-2510-002` も同様に `SO-2510-001` の同時受注として `PORDER` の備考で触れるだけにする。

### 6-3. `data/world/mfg/partner_contacts.csv`（新設・6 行）

ヘッダ：`contact_id,name_ja,name_zh,name_en,partner_code,title_ja,title_zh,title_en,site,native,note`
**姓は既存 42 名（mfg 20・fin 17・it 5）と重複しないものを選んだ。**

```csv
contact_id,name_ja,name_zh,name_en,partner_code,title_ja,title_zh,title_en,site,native,note
k-he-jun,何 俊,何俊,He Jun,K 社,調達課 主管,采购科 主管,Procurement Section Supervisor,常熟,zh,取引先（顧客）側の担当者。青嶺精工の社員ではない
k-matsumoto-kaoru,松本 薫,松本薰,Kaoru Matsumoto,K 社,生産技術 駐在員,生产技术 驻在员,Production Engineering Expatriate,常熟,ja,同上
v-yuan-fang,袁 芳,袁芳,Yuan Fang,V 社,購買 担当,采购 担当,Procurement Staff,蘇州,zh,同上
s-cui-bin,崔 斌,崔斌,Cui Bin,S 社,営業 課長,营业 科长,Sales Manager,蘇州,zh,取引先（仕入先）側の担当者
t-qiu-lan,邱 蘭,邱兰,Qiu Lan,T 社,技術営業,技术营业,Technical Sales,蘇州,zh,同上。ECR-25-0088 の切替候補先
w-okano-tetsu,岡野 哲,冈野哲,Tetsu Okano,W 社,通関・輸出入 担当,报关与进出口 担当,Customs and Trade Staff,上海,ja,物流事業者側の担当者。SH-OSA-01 の窓口
```

### 6-4. `data/world/fin/notices.csv`（新設・10 行。**PM 決定 Q4**）

ヘッダ：`notice_id,issued,authority,topic_ja,topic_zh,topic_en,affects_dept,due,owner_dept,note`
`authority`：`banking`（銀行監督）/ `fx`（外為）/ `aml`（マネロン・KYC）/ `privacy`（個人情報）
`affects_dept` / `owner_dept` は `data/world/fin/org.csv` の `dept_id`。

```csv
notice_id,issued,authority,topic_ja,topic_zh,topic_en,affects_dept,due,owner_dept,note
NTF-2026-017,2026-09-07,privacy,行内システムのログ保存に関する留意事項,关于行内系统日志留存的注意事项,Points to note on system log retention,system,2026-12-31,system,本設計で追加（書式は calendar.md の NTF-YYYY-NNN）
NTF-2026-016,2026-09-08,fx,為替予約の実需原則に関する照会回答,关于远期结售汇实需原则的答复,Reply on the genuine-demand rule for FX forwards,shijo,2026-11-30,shijo,本設計で追加
NTF-2026-015,2026-09-02,banking,四半期報告の提出期限の前倒し,季度报告提交期限提前,Earlier deadline for quarterly regulatory reports,kikaku,2026-10-20,kikaku,本設計で追加
NTF-2026-013,2026-08-24,banking,与信審査記録の保存年限の見直し,授信审查记录保存年限的调整,Revision of the retention period for credit-review records,shinsa,2026-10-31,compliance,台本既出（scenarios/fin/kn.js KN-05・KN-08）
NTF-2026-011,2026-07-15,aml,疑わしい取引の届出様式の変更,可疑交易报告表格变更,Change to the suspicious-transaction report form,jimu,2026-09-30,compliance,本設計で追加
NTF-2026-008,2026-06-02,fx,クロスボーダー人民元送金の報告項目追加,跨境人民币汇款报告项目新增,Added reporting items for cross-border RMB remittance,shijo,2026-09-15,risk,本設計で追加
NTF-2026-004,2026-04-10,privacy,個人情報の越境移転に関する運用指針,个人信息跨境转移操作指引,Guidance on cross-border transfer of personal data,jimu,2026-09-12,compliance,本設計で追加。ポータルのニュース行と対応
NTF-2025-041,2025-11-28,banking,自己資本比率の算定方法の一部改定,资本充足率计算方法部分修订,Partial revision of the capital-ratio calculation,risk,2026-03-31,risk,台本既出（kn.js KN-08 の過去比較）
NTF-2025-032,2025-09-05,banking,大口与信の報告閾値の引き下げ,大额授信报告阈值下调,Lower reporting threshold for large exposures,shinsa,2025-12-31,risk,本設計で追加
NTF-2025-019,2025-05-20,aml,顧客管理の継続的確認の頻度,客户尽职调查持续核实频率,Frequency of ongoing customer due diligence,jimu,2025-09-30,compliance,本設計で追加
```

### 6-5. `data/world/fin/credit_cases.csv`（新設・7 行）

ヘッダ：`case_id,ringi_id,client_code,product_id,amount_mm,stage,applied,due,reviewer_id,note`
`amount_mm` の単位は**百万元**（`kpi.csv` の `loan_balance` と同じ単位）。
`stage`：`draft`（起案）/ `kyc`（KYC 確認中）/ `review`（審査中）/ `approved`（承認済）/ `returned`（差戻し）
`reviewer_id` は `data/world/fin/people.csv` の `person_id`。

```csv
case_id,ringi_id,client_code,product_id,amount_mm,stage,applied,due,reviewer_id,note
CRD-26-0087,RNG-2026-0142,丙社,loan-capex,850,review,2026-08-28,2026-09-18,takanashi-naoto,台本既出（scenarios/fin/cv.js CV-03）
CRD-26-0091,RNG-2026-0089,甲社,loan-working,1200,approved,2026-07-10,2026-08-05,yang-jianguo,台本既出（cv.js）
CRD-26-0094,RNG-2026-0151,乙社,lc-trade,600,review,2026-09-01,2026-09-25,yang-jianguo,本設計で追加（書式は calendar.md の CRD-YY-NNNN / RNG-YYYY-NNNN）
CRD-26-0096,RNG-2026-0158,丁社,loan-capex,2400,draft,2026-09-05,2026-10-09,takanashi-naoto,本設計で追加
CRD-26-0098,RNG-2026-0160,戊社,loan-working,300,kyc,2026-09-08,2026-09-30,yang-jianguo,本設計で追加。KYC スクリーニングで保留（CV-04）
CRD-26-0079,RNG-2026-0120,甲社,fx-forward,450,approved,2026-06-02,2026-06-28,takanashi-naoto,本設計で追加
CRD-26-0101,RNG-2026-0163,丙社,loan-working,500,returned,2026-09-08,2026-09-24,yang-jianguo,本設計で追加。記載不備で差戻し
```

### 6-6. `data/world/fin/client_contacts.csv`（新設・5 行）

ヘッダ：`contact_id,name_ja,name_zh,name_en,client_code,title_ja,title_zh,title_en,site,native,note`
**拠点は上海・大連だけを使う**（`data/world/fin/company.md` の拠点。他世界の地名を持ち込まない）。

```csv
contact_id,name_ja,name_zh,name_en,client_code,title_ja,title_zh,title_en,site,native,note
ko-ishikawa-wataru,石川 渉,石川涉,Wataru Ishikawa,甲社,財務部長,财务部长,Head of Finance,上海,ja,取引先側の担当者。碧洋銀行の行員ではない
otsu-duan-yu,段 宇,段宇,Duan Yu,乙社,資金課 主管,资金科 主管,Treasury Section Supervisor,上海,zh,同上
hei-gu-min,顧 敏,顾敏,Gu Min,丙社,総経理,总经理,General Manager,上海,zh,同上。CRD-26-0087 の相手先
tei-guo-hong,郭 紅,郭红,Guo Hong,丁社,財務総監,财务总监,Finance Director,大連,zh,同上
bo-he-gang,賀 剛,贺刚,He Gang,戊社,業務部 経理,业务部 经理,Business Department Manager,上海,zh,同上
```

### 6-7. `data/world/fin/vendors.csv` への追記（2 行）

記号は `clients.csv` の甲乙丙丁戊に続く十干（`己` の次の `庚`・`辛`）。既存行は 1 バイトも触らない。

```csv
庚社,service,システム保守ベンダ（帳票基盤の運用委託）,系统运维厂商（报表平台运维外包）,System maintenance vendor for the reporting platform,CN,設計書 2026-09-12-portal-industry-rev4.md §6-7。記号は十干（己 に続く 庚）
辛社,service,事務代行（帳票の入力・照合の外部委託）,事务代办（报表录入与核对外包）,BPO vendor for form entry and reconciliation,CN,同上
```

### 6-8. `data/world/README.md` への追記

- ファイル一覧に **`mfg/records.csv`・`mfg/partner_contacts.csv`・`fin/notices.csv`・`fin/credit_cases.csv`・`fin/client_contacts.csv`** の 5 本を足す
- **「未統一」は 1 行も増やさない／減らさない**（現状 12 件＝製造 10・金融 1・IT 1 のまま）
- `npm run world` の warn 件数は **12 件のまま**（PR-0 の受け入れ条件。§16-1）

### 6-9. 追加行の総数

| ファイル | 行 |
|---|---|
| `data/world/mfg/records.csv`（新設） | 19 |
| `data/world/mfg/partner_contacts.csv`（新設） | 6 |
| `data/world/fin/notices.csv`（新設） | 10 |
| `data/world/fin/credit_cases.csv`（新設） | 7 |
| `data/world/fin/client_contacts.csv`（新設） | 5 |
| `data/world/fin/vendors.csv`（追記） | 2 |
| **合計** | **49** |

**マスタ先行 PR は業種で分けない。1 本にする。**理由：どちらも `data/world/README.md` の同じ表を触るので、
分けても直列になり、分けた利得がない。

---

## §7 行データ定数の業種化（PR-B）

### 7-1. 業種化する／しない の一覧

**業種化する（`{ mfg: […], fin: […], it: […] }` の形にする）—— 23 定数**

| ファイル | 定数 | mfg | fin | it | 備考 |
|---|---|---|---|---|---|
| `front.js` | `PPART`（← `PCUST` を改名） | 3 | 5 | 4 | §8-1 |
| `front.js` | `PCONTACT` | 6 | 5 | 6 | §8-3 |
| `front.js` | `PHIST` | 10 | 9 | 12 | §8-4 |
| `front.js` | `PNEWS` | 5 | 5 | 5 | §7-2 |
| `front.js` | `PVENDOR` | 6 | 3 | 3 | §7-2 |
| `common.js` | `PACT` | 10 | 10 | 10 | §7-2 |
| `common.js` | `PCAND` | 3 | 3 | 3 | §7-2 |
| `common.js` | `PMEET` | 4 | 4 | 4 | §7-2 |
| `mgmt.js` | `PPEOPLE` | 6 | 6 | 5 | §7-2 |
| `mgmt.js` | `PATT` | 6 | 6 | 5 | §7-2 |
| `mgmt.js` | `PKPI` | 6 | 6 | 5 | §7-2 |
| `mgmt.js` | `PGOAL.mine` | 4 | 4 | 4 | **`PGOAL.topics` は業種化しない** |
| `mgmt.js` | `PGOAL.team` | 6 | 6 | 5 | 同上 |
| `mgmt.js` | `PQTR` | 3 | 5 | 4 | 形が変わる（§8-2） |
| `back.js` | `PEXP` | 3 | 3 | 3 | §7-2 |
| `back.js` | `PREQ` | 4 | 4 | 4 | §7-2 |
| `back.js` | `PTRAIN` | 8 | 8 | 10 | §7-2 |
| `back.js` | `PMYTRAIN` | 6 | 6 | 8 | §7-2 |
| `back.js` | `PMYITEM` | 8 | 8 | 11 | §7-2 |
| `back.js` | `PMYSURVEY` | 3 | 3 | 3 | §7-2 |
| `back.js` | `PSURVEY` | 6 | 6 | 6 | §7-2 |
| `sys.js` | `PSYS` | 6 | — | 9 | §10。金融は画面ごと出ない |
| `sys.js` | `PSYSEV` | 8 | — | 14 | §10 |
| `sys.js` | `PSYSST` | 7 | — | 7 | §10-2。状態の語彙が業種で違う |

**新設（1 業種だけが持つ）—— 4 定数**

| ファイル | 定数 | 行 | 画面 |
|---|---|---|---|
| `front.js` | `PQUAL` | mfg 10 ＋ 4 | `qual`（§9-1） |
| `front.js` | `PORDER` | mfg 6 ＋ 3 | `order`（§9-2） |
| `front.js` | `PCRED` | fin 7 | `cred`（§9-3） |
| `front.js` | `PREG` | fin 10 ＋ 4 | `reg`（§9-4） |

**業種化しない（据え置き）**

| 定数 | なぜ |
|---|---|
| **`PKNOW`** | **`tools/verify.mjs` §19-c が `data/world/it/knowledge_categories.csv` の `name_ja` 58 行とバイト一致を検査している**（#292）。形を変えると即 FAIL。**かつ「分類の型」であって行データではない**ので 3 業種で共有してよい |
| **`PKPITOPIC`** | 同上（`kpi_topics.csv` 61 行。観点 9／指標 52 の内訳も §19-b が数える） |
| **`PGOAL.topics`** | 同上（`goal_topics.csv` 8 行） |
| `PSTAGE` / `PDEALS` / `PSTAGE_AI` | `proj`（案件）は **IT 専用画面**。業種で分ける必要がない |
| `PWORLD` | §2-3。跨ぎの辞書が要るのは IT だけ。verify §17-k はそのまま |
| `PORG.team` | `proj` のチーム絞り込み（IT 専用）。`PORG.persona` は削除（§5-3） |
| `PKNOWACT` / `PSRC` / `PST` / `PHOW` / `PHOWLONG` / `PTODO_STATE` / `PSYSNOW` / `PCUR_Q` | 型・語彙・プリセット。業種に依らない |
| `PSVC` / `POUT` / `PNEW` / `PCTXDEF` | サービス側の辞書。`PCTXDEF` は**キーを 4 つ足すだけ**（§9-5） |

> **`PCUR_Q` が 3 業種とも 2 でよい理由**：製造も会計年度を 4/1〜3/31 に確定する（§6-1）ので、
> 製造の「今日」2025-09-12 は FY2025 Q2、金融の 2026-09-08 と IT の 2026-09-11 は FY2026 Q2。**3 業種とも Q2**。

### 7-2. 製造（`.mfg`）の行データ —— 世界の「今日」は **2025-09-12**

**語はすべて `data/world/mfg/**` のもの。**人は `people.csv` の 20 名から、品番は `products.csv`、設備は `equipment.csv`、
取引先は `partners.csv`、記録は `records.csv`（§6-2）、番号は `calendar.md` の書式。

```js
/* common.js — PACT.mfg（To Do 10）[番号, 案件/種別, 内容, 担当, 期限, 残り, 優先度] */
['A-0912', 'NC-2025-0912', '初品の寸法ばらつきの 8D を出す', '陳 静', '2025-09-09', '超過 3 日', '高'],
['A-0913', 'CL-25-0906', 'K 社への一次回答を返す', '陳 静', '2025-09-13', 'あと 1 日', '高'],
['A-0918', 'ECR-25-0088', 'T 社への切替可否を生産技術と詰める', '王 磊', '2025-09-19', 'あと 7 日', '高'],
['A-0901', 'SO-2510-003', 'V 社の年間上限条項を営業に確認する', '李 強', '2025-09-30', 'あと 18 日', '中'],
['A-0922', 'RFQ-2025-118', '新規ブラケットの見積を提出する', '李 強', '2025-09-19', 'あと 7 日', '中'],
['A-0884', '—', '課の年度目標を全員に周知する', '李 強', '2025-08-29', '超過 14 日', '低'],
['A-0930', '研修', '輸出管理を受講する', '李 強', '2025-10-31', 'あと 49 日', '高'],
['A-0931', '研修', '「中国労働法の基礎」を受け終える', '李 強', '—', '進捗 60%', '中'],
['A-0940', 'サーベイ', 'エンゲージメント調査 2025 Q2 に回答する', '李 強', '2025-09-19', 'あと 7 日', '中'],
['A-0950', '目標', '上期の中間レビューを提出する', '李 強', '2025-09-30', 'あと 18 日', '高']

/* common.js — PCAND.mfg（AI が拾った To Do 候補 3） */
{ id: 'C-01', txt: '金型予熱の基準温度を作業標準書に反映する', src: 'NC-2025-0912 の原因調査メモ', who: '王 磊', days: 7, state: 'new', no: '' },
{ id: 'C-02', txt: 'K 社の 10 月内示を生産計画に取り込む', src: 'メール', who: '李 強', days: 3, state: 'new', no: '' },
{ id: 'C-03', txt: 'DO-3200 の温度ムラの再測定を依頼する', src: '設備保全課 週次 議事録', who: '劉 洋', days: 2, state: 'new', no: '' }

/* common.js — PMEET.mfg（会議 4）[番号, 件名, 日付, 出席, 議事録の状態] */
['M-0911', '製造二課 週次', '2025-09-11', '李 強 ほか 8 名', '議事録 未作成'],
['M-0910', '品質連絡会（CL-25-0906）', '2025-09-10', '陳 静 ほか 5 名', '議事録 作成済'],
['M-0908', '工場月次', '2025-09-08', '全員 42 名', '議事録 作成済'],
['M-0916', '本社 生産本部 来訪（予定・VST-2025-014）', '2025-09-16', '来訪 3 名／受入 5 名', '段取り 未着手']

/* mgmt.js — PPEOPLE.mfg（要員 6）[氏名, Role, 担当, 稼働%, Skill] */
['李 強', '課長', 'L1 / L3（SK-3310 系）', 108, '製造管理・K 社対応'],
['張 小雨', '作業者', 'L3（SK-3310-A）', 92, 'プレス（入社 2 か月）'],
['陳 静', '品質', 'NC-2025-0912 / CL-25-0906', 118, '寸法検査・8D'],
['王 磊', '生産技術', 'ECR-25-0088 / TR-2024-007', 104, '工程設計・PX-200'],
['劉 洋', '設備保全', 'PX-200 / DO-3200', 96, '保全・金型予熱'],
['孫 麗', '物流', 'INV-2025-0906 / 通関', 84, '輸出入・通関']

/* mgmt.js — PATT.mfg（勤怠 6。所定 160h/月・必須研修 5 本）[氏名, Role, 実働h, 残業h, 年休付与, 取得, 備考, 必須研修受講数] */
['李 強', '課長', 174, 14, 14, 4, 'K 社の 10 月内示対応が重なっている', 4],
['張 小雨', '作業者', 162, 2, 10, 1, '入社 2 か月。必須研修が残り 3 本', 2],
['陳 静', '品質', 189, 29, 12, 2, 'CL-25-0906 の一次回答とクレーム 2 件を 1 人で持っている', 3],
['王 磊', '生産技術', 171, 11, 14, 6, '', 5],
['劉 洋', '設備保全', 168, 8, 12, 5, '', 4],
['孫 麗', '物流', 158, 0, 16, 9, '', 5]

/* mgmt.js — PKPI.mfg（個人 KPI 6）[氏名, 必須研修%, サーベイ回答%, 期限超過 To Do 件, 納期遵守%, 年休取得%] */
['李 強', 80, 67, 1, 92, 29],
['張 小雨', 40, 100, 0, 100, 10],
['陳 静', 60, 33, 2, 83, 17],
['王 磊', 100, 100, 0, 100, 43],
['劉 洋', 80, 67, 0, 100, 42],
['孫 麗', 100, 100, 0, 100, 56]

/* mgmt.js — PGOAL.mine.mfg（李 強の MBO 4）[id, 観点, 目標, 目標値, 実績, 測り方, 期限, ウェイト%] */
['G-01', 'P3 案件遂行', '担当ラインの納期遵守率 95% 以上', '95%', '92%', '自動', '2026-03-31', 30],
['G-02', 'P4 品質・改善', '塗装ブツによる不適合を月 2 件以下にする', '2 件/月', '4 件/月', '自動', '2026-03-31', 30],
['G-03', 'P5 育成・自己開発', '新人 1 名を単独作業まで引き上げる', '単独可', 'OJT 3/5', '手動', '2026-03-31', 20],
['G-04', 'P7 業務改善・AI 活用', '8D 作成の手作業を 1 件あたり 2 時間削減する', '2 時間/件', '0.5 時間/件', '手動', '2026-03-31', 20]

/* mgmt.js — PGOAL.team.mfg（6）[氏名, Role, 目標数, 設定状況, 設定日, 達成率%, 状況] */
['李 強', '課長', 4, '設定済', '2025-04-16', 71, '中間レビュー未提出'],
['張 小雨', '作業者', 3, '未設定', '—', 0, '着任後 2 か月。設定期限 2025-09-30'],
['陳 静', '品質', 4, '設定済', '2025-04-11', 66, ''],
['王 磊', '生産技術', 4, '設定済', '2025-04-14', 88, ''],
['劉 洋', '設備保全', 3, '設定済', '2025-04-18', 79, ''],
['孫 麗', '物流', 3, '設定済', '2025-04-10', 93, '']

/* back.js — PEXP.mfg（経費 3。番号は calendar.md の EX-NNNN）[番号, 内容, 申請者, 金額, 状態, 指摘] */
['EX-0835', '出張精算（蘇州 → 常熟 09-03〜09-04）', '李 強', '1,480 元', '差戻し', '宿泊の発票が 1 枚不足'],
['EX-0841', '会食（K 社 調達課）', '李 強', '980 元', '承認待ち', '—'],
['EX-0831', 'タクシー・交通（8 月分）', '陳 静', '420 元', '精算済', '—']

/* back.js — PREQ.mfg（申請 4。番号は calendar.md の RG-YY-NNNN）[番号, 種類, 件名, 申請者, 状態, 期限] */
['RG-25-0117', '稟議', '乾燥炉 DO-3200 の更新（A 社 RMB 1,850,000）', '劉 洋', '差戻し', '2025-09-19'],
['RG-25-0121', '稟議', 'T 社への鋼板切替（ECR-25-0088）', '王 磊', '部長承認待ち', '2025-09-30'],
['RG-25-0119', '購買', '寸法検査用ゲージ 2 式', '陳 静', '記載不備', '2025-09-15'],
['RG-25-0112', '契約', 'W 社 物流業務委託 更新', '孫 麗', '法務レビュー中', '2025-10-31']

/* back.js — PTRAIN.mfg（研修 8。分母 6 名）[区分, 研修名, 受講済人数, 期限] */
['必須', 'コンプライアンス基礎', 5, '2025-09-30'],
['必須', '情報セキュリティ', 4, '2025-09-30'],
['必須', '輸出管理', 3, '2025-10-31'],
['必須', 'ハラスメント防止', 6, '2025-08-31'],
['必須', '中国労働法の基礎', 5, '2025-08-31'],
['任意', '寸法検査の実務', 3, ''],
['任意', '金型保全の基礎', 2, ''],
['任意', '日本語ビジネス会話', 2, '']

/* back.js — PMYTRAIN.mfg（李 強の受講状況 6）[区分, 研修名, 状態, 受講日/期限, 備考] */
['必須', '輸出管理', '未受講', '2025-10-31', '期限まで 49 日'],
['必須', 'コンプライアンス基礎', '受講済', '2025-06-12', ''],
['必須', '情報セキュリティ', '受講済', '2025-05-20', ''],
['必須', 'ハラスメント防止', '受講済', '2025-04-18', ''],
['必須', '中国労働法の基礎', '受講中', '—', '進捗 60%'],
['任意', '金型保全の基礎', '推奨', '—', 'PX-200 の E-47 対応から']

/* back.js — PMYITEM.mfg（研修＋サーベイ 8）[区分, 名称, 状態, 期限/受講日, 備考, To Do 番号] */
['サーベイ', 'エンゲージメント調査 2025 Q2', '未回答', '2025-09-19', 'あと 7 日', 'A-0940'],
['サーベイ', 'CL-25-0906 の振り返り', '未回答', '2025-09-26', 'あと 14 日', ''],
['必須研修', '輸出管理', '未受講', '2025-10-31', 'あと 49 日', 'A-0930'],
['必須研修', '中国労働法の基礎', '受講中', '—', '進捗 60%', 'A-0931'],
['任意研修', '金型保全の基礎', '推奨', '—', 'PX-200 の E-47 対応から', ''],
['必須研修', 'コンプライアンス基礎', '受講済', '2025-06-12', '', ''],
['必須研修', '情報セキュリティ', '受講済', '2025-05-20', '', ''],
['必須研修', 'ハラスメント防止', '受講済', '2025-04-18', '', '']

/* back.js — PMYSURVEY.mfg（3）[番号, 名称, 状態, 期限/回答日, 備考] */
['S-0901', 'エンゲージメント調査 2025 Q2', '未回答', '2025-09-19', 'あと 7 日'],
['S-0903', 'CL-25-0906 の振り返り', '未回答', '2025-09-26', 'あと 14 日'],
['S-0902', '「ハラスメント防止」研修の事後アンケート', '回答済', '2025-08-31', '']

/* back.js — PSURVEY.mfg（サーベイの種類 6）[id, 種類, 頻度, 対象, 回収率%, つながる KPI] */
['SV1', 'エンゲージメント調査', '四半期', '課 全員（6 名）', 67, 'K7'],
['SV2', '研修の事後アンケート', '研修ごと', '受講者', 91, 'K6'],
['SV3', '不具合対応の振り返り', 'クレーム・不適合の完了後', '対応メンバー', 58, 'K2 / K8'],
['SV4', '顧客満足度', '四半期', '取引先の担当者', 42, 'K3'],
['SV5', '改善提案の募集', '随時', '工場 全員', 51, 'K8'],
['SV6', '1on1 の記録', '月次', '課長と本人', 83, 'K7']

/* front.js — PNEWS.mfg（5）[対象, 区分, 見出し, 日付, 効く先] */
['K 社', '取引先', '常熟で新ラインの立ち上げを発表', '2025-09-11', 'SK-3318 の増量に効く'],
['S 社', '仕入先', '鋼板 SPCC の価格改定を通知', '2025-09-10', 'ECR-25-0088 の切替判断に効く'],
['製造', '業界', '中国の自動車部品市況が 3 か月ぶりに上向き', '2025-09-10', '—'],
['T 社', '仕入先', '塗装工程の設備増強を発表', '2025-09-09', '切替候補の能力確認に効く'],
['貿易', '業界', '上海港の混雑が解消に向かう', '2025-09-08', 'INV-2025-0906 の船積みに効く']

/* front.js — PVENDOR.mfg（仕入先・パートナー 6）[会社, 区分, 常駐, 関わる案件, 与信, 契約期限] */
['S 社', '材料・塗装外注', '—', 'SK-3310-A / SK-2207-B', '注意', '2025-12-31'],
['T 社', '材料・工程の代替候補', '—', 'ECR-25-0088', '良', '2026-03-31'],
['A 社', '設備メーカー（乾燥炉）', '—', 'RG-25-0117', '良', '—'],
['B 社', '設備メーカー（比較見積）', '—', 'RG-25-0117', '良', '—'],
['U 社', '代替鋼板 供給候補', '—', 'ECR-23-0041', '良', '—'],
['W 社', '物流（輸送・通関）', '2 名', 'INV-2025-0906 / SH-OSA-01', '良', '2025-10-31']
```

### 7-3. 金融（`.fin`）の行データ —— 世界の「今日」は **2026-09-08**

**語はすべて `data/world/fin/**` のもの。**人は `people.csv` の 17 名、部署は `org.csv`、先は `clients.csv`、
商品は `products.csv`、通達は `notices.csv`（§6-4）、与信は `credit_cases.csv`（§6-5）、番号は `calendar.md` の書式。

```js
/* common.js — PACT.fin（To Do 10） */
['A-0908', 'NTF-2026-013', '保存年限の改定を事務手続に反映する', '羅 佳', '2026-09-05', '超過 3 日', '高'],
['A-0909', 'NTF-2026-004', '越境移転の運用指針への対応をまとめる', '韓 雪', '2026-09-12', 'あと 4 日', '高'],
['A-0910', 'CRD-26-0087', '丙社の審査コメントを起案する', '高梨 直人', '2026-09-11', 'あと 3 日', '高'],
['A-0911', 'CRD-26-0098', '戊社の KYC スクリーニング結果を整理する', '楊 建国', '2026-09-16', 'あと 8 日', '中'],
['A-0902', 'NTF-2026-015', '四半期報告の前倒しに合わせて工程を引く', '鄭 麗華', '2026-09-30', 'あと 22 日', '中'],
['A-0884', '—', '部の年度目標を全員に周知する', '韓 雪', '2026-08-26', '超過 13 日', '低'],
['A-0930', '研修', 'マネーロンダリング対策を受講する', '韓 雪', '2026-09-30', 'あと 22 日', '高'],
['A-0931', '研修', '「個人情報保護の実務」を受け終える', '韓 雪', '—', '進捗 60%', '中'],
['A-0940', 'サーベイ', 'エンゲージメント調査 2026 Q2 に回答する', '韓 雪', '2026-09-18', 'あと 10 日', '中'],
['A-0950', '目標', '上期の中間レビューを提出する', '韓 雪', '2026-09-30', 'あと 22 日', '高']

/* common.js — PCAND.fin（3） */
{ id: 'C-01', txt: '大連支店の照会フローを確認する', src: '審査部 定例 議事録', who: '韓 雪', days: 2, state: 'new', no: '' },
{ id: 'C-02', txt: 'NTF-2026-011 の様式変更を営業店へ通知する', src: 'メール', who: '羅 佳', days: 5, state: 'new', no: '' },
{ id: 'C-03', txt: '差戻しの多い申請様式を洗い出す', src: '事務統括部 週次 議事録', who: '韓 雪', days: 9, state: 'new', no: '' }

/* common.js — PMEET.fin（会議 4。番号は calendar.md の MTG-YYYY-NNNN） */
['MTG-2026-0463', '事務統括部 週次', '2026-09-07', '韓 雪 ほか 6 名', '議事録 未作成'],
['MTG-2026-0451', '審査部 定例', '2026-09-04', '高梨 直人 ほか 4 名', '議事録 作成済'],
['MTG-2026-0448', '部門月次', '2026-09-02', '全員 24 名', '議事録 作成済'],
['MTG-2026-0470', '日本本店 専務来訪（予定・VST-2026-021）', '2026-09-16', '来訪 2 名／受入 5 名', '段取り 未着手']

/* mgmt.js — PPEOPLE.fin（要員 6） */
['韓 雪', '事務統括', '当局報告 / 事務手続', 106, '事務規程・照会対応'],
['羅 佳', 'コンプライアンス', 'NTF-2026-013 / NTF-2026-011', 114, '当局通達・AML'],
['中野 隆', 'リスク統括', 'NTF-2025-041 / 大口与信', 98, '自己資本・与信集中'],
['高梨 直人', '審査', 'CRD-26-0087 / CRD-26-0096', 110, '与信審査・稟議'],
['楊 建国', '審査', 'CRD-26-0094 / CRD-26-0098', 102, '与信審査・KYC'],
['鄭 麗華', '財務', '月次クローズ / 四半期報告', 88, '会計・開示']

/* mgmt.js — PATT.fin（勤怠 6） */
['韓 雪', '事務統括', 171, 11, 14, 5, '', 4],
['羅 佳', 'コンプライアンス', 183, 23, 12, 2, '当局通達 3 本の対応が重なっている', 5],
['中野 隆', 'リスク統括', 168, 8, 16, 7, '', 4],
['高梨 直人', '審査', 176, 16, 14, 3, '審査中 2 件を 1 人で持っている', 5],
['楊 建国', '審査', 169, 9, 12, 6, '', 4],
['鄭 麗華', '財務', 158, 0, 14, 9, '', 5]

/* mgmt.js — PKPI.fin（個人 KPI 6）[氏名, 必須研修%, サーベイ回答%, 期限超過 To Do 件, 期限遵守%, 年休取得%] */
['韓 雪', 80, 67, 1, 92, 36],
['羅 佳', 100, 33, 2, 83, 17],
['中野 隆', 80, 100, 0, 100, 44],
['高梨 直人', 100, 67, 1, 89, 21],
['楊 建国', 80, 100, 0, 100, 50],
['鄭 麗華', 100, 100, 0, 100, 64]

/* mgmt.js — PGOAL.mine.fin（韓 雪の MBO 4） */
['G-01', 'P3 案件遂行', '照会の一次回答率 90% 以上', '90%', '87.5%', '自動', '2027-03-31', 30],
['G-02', 'P4 品質・改善', '事務ミスによる差戻しを月 5 件以下にする', '5 件/月', '8 件/月', '自動', '2027-03-31', 25],
['G-03', 'P6 組織・チーム', '事務手続マニュアルを 10 本更新する', '10 本', '4 本', '手動', '2027-03-31', 20],
['G-04', 'P7 業務改善・AI 活用', '当局報告の作成時間を月 6 時間削減する', '6 時間/月', '2 時間/月', '手動', '2027-03-31', 25]

/* mgmt.js — PGOAL.team.fin（6） */
['韓 雪', '事務統括', 4, '設定済', '2026-04-14', 74, '中間レビュー未提出'],
['羅 佳', 'コンプライアンス', 4, '設定済', '2026-04-10', 81, ''],
['中野 隆', 'リスク統括', 3, '設定済', '2026-04-17', 69, ''],
['高梨 直人', '審査', 5, '設定済', '2026-04-09', 86, ''],
['楊 建国', '審査', 4, '設定済', '2026-04-15', 77, ''],
['鄭 麗華', '財務', 3, '設定済', '2026-04-08', 92, '']

/* back.js — PEXP.fin（経費 3） */
['E-0906', '出張精算（上海 → 大連 09-02〜09-03）', '韓 雪', '3,240 元', '差戻し', '宿泊の発票が 1 枚不足'],
['E-0905', '会食（甲社 財務部）', '高梨 直人', '1,680 元', '承認待ち', '—'],
['E-0901', 'タクシー・交通（8 月分）', '羅 佳', '520 元', '精算済', '—']

/* back.js — PREQ.fin（申請 4。番号は calendar.md の RNG-YYYY-NNNN） */
['RNG-2026-0158', '稟議', '丁社 設備資金 24 億元（CRD-26-0096）', '高梨 直人', '部長承認待ち', '2026-09-18'],
['RNG-2026-0163', '稟議', '丙社 運転資金 5 億元（CRD-26-0101）', '楊 建国', '記載不備', '2026-09-15'],
['RNG-2026-0155', '購買', '帳票基盤の保守委託（庚社）更新', '韓 雪', '法務レビュー中', '2026-09-30'],
['RNG-2026-0149', 'システム利用', '外部信用情報サービスの利用申請', '中野 隆', '承認済', '—']

/* back.js — PTRAIN.fin（研修 8。分母 6 名） */
['必須', 'コンプライアンス基礎', 5, '2026-09-30'],
['必須', '情報セキュリティ', 4, '2026-09-30'],
['必須', 'マネーロンダリング対策', 3, '2026-09-30'],
['必須', 'ハラスメント防止', 6, '2026-08-31'],
['必須', '中国労働法の基礎', 6, '2026-08-31'],
['任意', '個人情報保護の実務', 3, ''],
['任意', '与信分析の基礎', 2, ''],
['任意', '日本語ビジネス会話', 2, '']

/* back.js — PMYTRAIN.fin（韓 雪の受講状況 6） */
['必須', 'マネーロンダリング対策', '未受講', '2026-09-30', '期限まで 22 日'],
['必須', 'コンプライアンス基礎', '受講済', '2026-06-10', ''],
['必須', '情報セキュリティ', '受講済', '2026-05-18', ''],
['必須', 'ハラスメント防止', '受講済', '2026-04-16', ''],
['必須', '中国労働法の基礎', '受講済', '2026-04-16', ''],
['任意', '個人情報保護の実務', '受講中', '—', '進捗 60%']

/* back.js — PMYITEM.fin（8） */
['サーベイ', 'エンゲージメント調査 2026 Q2', '未回答', '2026-09-18', 'あと 10 日', 'A-0940'],
['サーベイ', 'NTF-2026-013 対応の振り返り', '未回答', '2026-09-25', 'あと 17 日', ''],
['必須研修', 'マネーロンダリング対策', '未受講', '2026-09-30', 'あと 22 日', 'A-0930'],
['任意研修', '個人情報保護の実務', '受講中', '—', '進捗 60%', 'A-0931'],
['任意研修', '与信分析の基礎', '推奨', '—', 'CRD-26-0098 の担当から', ''],
['必須研修', 'コンプライアンス基礎', '受講済', '2026-06-10', '', ''],
['必須研修', '情報セキュリティ', '受講済', '2026-05-18', '', ''],
['必須研修', 'ハラスメント防止', '受講済', '2026-04-16', '', '']

/* back.js — PMYSURVEY.fin（3） */
['S-0901', 'エンゲージメント調査 2026 Q2', '未回答', '2026-09-18', 'あと 10 日'],
['S-0903', 'NTF-2026-013 対応の振り返り', '未回答', '2026-09-25', 'あと 17 日'],
['S-0902', '「ハラスメント防止」研修の事後アンケート', '回答済', '2026-08-31', '']

/* back.js — PSURVEY.fin（6） */
['SV1', 'エンゲージメント調査', '四半期', '部 全員（24 名）', 74, 'K7'],
['SV2', '研修の事後アンケート', '研修ごと', '受講者', 96, 'K6'],
['SV3', '当局対応の振り返り', '通達対応の完了後', '対応メンバー', 62, 'K2 / K8'],
['SV4', '顧客満足度', '四半期', '取引先の担当者', 39, 'K3'],
['SV5', '改善提案の募集', '随時', '部 全員', 48, 'K8'],
['SV6', '1on1 の記録', '月次', '上長と本人', 90, 'K7']

/* front.js — PNEWS.fin（5） */
['甲社', '取引先', '中国事業の体制変更を公表', '2026-09-07', 'CRD-26-0091 の窓口が変わる可能性'],
['丙社', '取引先', '自動車部品の新工場計画を発表', '2026-09-06', 'CRD-26-0087 の資金使途に関係'],
['金融', '業界', '当局が越境データ移転の運用指針を改定', '2026-09-05', 'NTF-2026-004 の対応に効く'],
['金融', '業界', '人民元の対円相場が 3 か月ぶりの水準', '2026-09-04', '為替予約の実需照会が増える見込み'],
['丁社', '取引先', '素材価格の改定を通知', '2026-09-03', 'CRD-26-0096 の採算前提に効く']

/* front.js — PVENDOR.fin（3） */
['己社', '旅行会社（ハイヤー・出張手配）', '—', 'VST-2026-021', '良', '2027-03-31'],
['庚社', 'システム保守（帳票基盤）', '2 名', 'RNG-2026-0155', '良', '2026-09-30'],
['辛社', '事務代行（帳票の入力・照合）', '4 名', '月次クローズ', '注意', '2026-12-31']
```

### 7-4. IT（`.it`）—— **1 バイトも書き換えない**

現行のリテラルを **`.it` キーの下に移すだけ**。値・順序・空白・コメントを変えない。
唯一の例外は **`PCUST` → `PPART` の改名**（定数名だけ。行の中身はそのまま。§8-1）。

**reviewer の確認方法**：`git show <PR-B>:mock/js/data/portal/common.js` を整形し、
`.it` の中身が `origin/main` の同名定数と**要素単位で一致**することを確かめる。

---

## §8 `cust` を「取引先」テンプレートへ（PR-C）

### 8-0. レイアウト（3 業種で同じ骨格。列と行だけが替わる）

```
┌ 取引先 ─────────────────────────────────────────────────────────────────────┐
│ ① 今期の <指標>  —  計画・実績・見込                                        │
│    FY<年>（4 月〜3 月）／ 単位：<単位>            いまは Q2                  │
│    ┌───────┬─────┬─────┬─────┬─────┬─────┐                                 │
│    │ 取引先 │ Q1  │ Q2  │ Q3  │ Q4  │通期 │  各 2 列（計画／実績・見込）    │
│    └───────┴─────┴─────┴─────┴─────┴─────┘  最終行に合計                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ ② 取引先（<n> 件）                                                          │
│    <head[0]> | <head[1]> | <head[2]> | <head[3]> | <head[4]> | この行で使う AI│
│    社名は button（押すと ③ が絞られる）                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│ ③ 担当者（名刺から取り込み ／ <m> 名）  [チップ：すべて／取引先ごと]         │
│    氏名 | 名刺 | 役職（原文）| 役職（社内表記）| 取引先 | 拠点 | 最終接触 |    │
│    名刺取得 | 接触履歴ボタン ＋ この行で使う AI                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ ④ 解説（.doc-dev「名刺 1 枚が担当者になるまで」9 手順）  ← 3 業種で同じ      │
├─────────────────────────────────────────────────────────────────────────────┤
│ ⑤ この画面の AI                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
寸法：既存の .grid / .block / .body flush / .tw table / ptbl() のまま。新しい CSS クラスは足さない。
```

**①②③⑤ は業種で中身が替わる。④ は 3 業種で同じ**（名刺 OCR の切り分けの説明は業種に依らない）。
④ の末尾にある「人物は架空世界マスタの実在レコードです」の 1 文は、業種ごとの出所に差し替える
（製造＝`data/world/mfg/partner_contacts.csv`／金融＝`data/world/fin/client_contacts.csv`／IT＝`mfg`・`fin` の `people.csv`）。

### 8-1. `PPART`（← `PCUST` を改名）

```js
/* front.js — PPART。head は表ヘッダ（ja 固定。D12）。rows[].cells は 2 列目以降（AI 列を除く）。
   head.length === cells.length + 1 であること（verify §17-q）。
   it だけ calc:'deals' を持ち、cells の代わりに PDEALS から受注後／受注前／受注残を算出する。 */
const PPART = {
  mfg: {
    head: ['取引先', '区分', '拠点', '主な品番', '直近の記録'],
    ai: ['pt1', 'gn8'],
    rows: [
      { id: 'K 社', full: 'K 社（自動車部品）', cells: ['顧客', '常熟／日本', 'SK-3310-A / SK-2207-B / SK-3318', 'CL-25-0906 クレーム 2 件'] },
      { id: 'V 社', full: 'V 社', cells: ['顧客', '蘇州', 'SK-3318', 'SO-2510-003 上限条項の確認待ち'] },
      { id: 'J 社', full: 'J 社（旧顧客）', cells: ['取引終了（2023）', '—', 'SK-1190', 'TR-2023-041 金型 D-092 を保管中'] }
    ]
  },
  fin: {
    head: ['先', '区分', '拠点', '主な商品', '与信残高（億元）'],
    ai: ['cv2', 'kn7', 'rs3', 'gn8'],
    rows: [
      { id: '甲社', full: '甲社（日系製造業）', cells: ['法人', '上海', '運転資金 / 為替予約', '90.1'] },
      { id: '乙社', full: '乙社（日系商社）', cells: ['法人', '上海', 'L/C・貿易金融', '65.1'] },
      { id: '丙社', full: '丙社（現地民営・自動車部品）', cells: ['法人', '上海', '設備資金 / 運転資金', '52.6'] },
      { id: '丁社', full: '丁社（現地国有・素材）', cells: ['法人', '大連', '設備資金', '78.3'] },
      { id: '戊社', full: '戊社（現地サービス業）', cells: ['法人', '上海', '運転資金', '26.0'] }
    ]
  },
  it: {
    head: ['顧客', '拠点', '受注後', '受注前', '受注残（百万円）'],
    calc: 'deals',
    ai: ['gn8'],
    rows: [
      { id: '青嶺精工', full: '青嶺精工株式会社', site: '蘇州工場／日本本社' },
      { id: '碧洋銀行', full: '碧洋銀行株式会社', site: '上海本部／大連支店' },
      { id: 'α 社', full: 'α 社', site: '—' },
      { id: 'β 社', full: 'β 社', site: '—' }
    ]
  }
};
```

**`rows[].ai` を書けば行ごとに上書きできる**（書かなければ `PPART[ind].ai`）。
`ai` に書く id は `SVCS` に実在し、かつ **`placeOf(svc, ind) === 'cust'` である必要はない**
（`V.cust` の行 AI は現行も `prowAi(['rs3','rs1'])` のように手で選んでいる。この作法は変えない）。

### 8-2. `PQTR`（四半期表。指標をデータ側に持たせる）

```js
/* mgmt.js — PQTR。rows は現行の形（cu / plan[4] / act[2] / fc[2]）のまま。
   fy・unit・metric を足し、V.cust の見出しがこれを読む。単位と指標名は業種で違う（PM 決定 (b)）。 */
const PQTR = {
  mfg: { fy: 'FY2025', unit: '百万円', metric: '売上', rows: [
    { cu: 'K 社', plan: [62.0, 64.0, 66.0, 64.0], act: [60.8, 62.9], fc: [67.0, 64.0] },
    { cu: 'V 社', plan: [5.0, 5.0, 6.0, 6.0],     act: [4.6, 5.1],   fc: [6.0, 6.0] },
    { cu: 'J 社', plan: [0, 0, 0, 0],             act: [0, 0],       fc: [0, 0] }
  ] },
  fin: { fy: 'FY2026', unit: '億元', metric: '貸出残高', rows: [
    { cu: '甲社', plan: [90.0, 92.0, 95.0, 96.0], act: [88.5, 90.1], fc: [94.0, 96.0] },
    { cu: '乙社', plan: [65.0, 66.0, 68.0, 69.0], act: [64.2, 65.1], fc: [67.5, 69.0] },
    { cu: '丙社', plan: [52.0, 54.0, 58.0, 60.0], act: [50.8, 52.6], fc: [59.0, 61.0] },
    { cu: '丁社', plan: [78.0, 79.0, 80.0, 80.0], act: [77.6, 78.3], fc: [79.5, 80.0] },
    { cu: '戊社', plan: [26.0, 27.0, 28.0, 29.0], act: [25.4, 26.0], fc: [27.5, 29.0] }
  ] },
  it: { fy: 'FY2026', unit: '百万円', metric: '売上', rows: [ …現行の 4 行をそのまま… ] }
};
```

- 見出しは `今期の${PQTR[ind].metric} — 計画・実績・見込` ／ `${PQTR[ind].fy}（4 月〜3 月）／ 単位：${PQTR[ind].unit}`
- **金融の単位を「億元」にした理由**：`data/world/fin/kpi.csv` の `loan_balance` は百万元建てで 31,200。
  そのまま表に出すと 10 列すべてが 5 桁になり狭幅で破綻する。**1 億元 = 100 百万元**で、
  Q2 実績の合計 312.1 億元が `kpi.csv` の 31,200 百万元と一致する（reviewer はここを見れば整合が取れる）
- **仕入先には売上表を出さない**：`PQTR[ind].rows` に載るのは `PPART[ind].rows` のうち `cells[0]` が
  「顧客」または「法人」のものだけ（製造の仕入先 S・T・A・B・U・W は `vend` 画面にいる。§3-2）

### 8-3. `PCONTACT`（担当者）

```js
/* front.js — PCONTACT。[氏名, 名刺の言語, 役職（名刺の原文）, 役職（社内表記）, 取引先, 拠点, 最終接触, 名刺取得] */
mfg: [   /* data/world/mfg/partner_contacts.csv（§6-3）の写し */
  ['何 俊',   'zh', '采购科 主管',   '調達課 主管',        'K 社', '常熟', '2025-09-04', '2024-06'],
  ['松本 薫', 'ja', '生産技術 駐在員', '生産技術 駐在員',   'K 社', '常熟', '2025-08-28', '2023-11'],
  ['袁 芳',   'zh', '采购 担当',     '購買 担当',          'V 社', '蘇州', '2025-07-15', '2024-10'],
  ['崔 斌',   'zh', '营业 科长',     '営業 課長',          'S 社', '蘇州', '2025-09-09', '2023-04'],
  ['邱 蘭',   'zh', '技术营业',      '技術営業',            'T 社', '蘇州', '2025-09-05', '2025-06'],
  ['岡野 哲', 'ja', '通関・輸出入 担当', '通関・輸出入 担当', 'W 社', '上海', '2025-09-06', '2024-02']
],
fin: [   /* data/world/fin/client_contacts.csv（§6-6）の写し */
  ['石川 渉', 'ja', '財務部長',     '財務部長',     '甲社', '上海', '2026-09-05', '2025-09'],
  ['段 宇',   'zh', '资金科 主管',  '資金課 主管',  '乙社', '上海', '2026-08-20', '2026-03'],
  ['顧 敏',   'zh', '总经理',       '総経理',       '丙社', '上海', '2026-09-02', '2026-03'],
  ['郭 紅',   'zh', '财务总监',     '財務総監',     '丁社', '大連', '2026-06-18', '2025-11'],
  ['賀 剛',   'zh', '业务部 经理',  '業務部 経理',  '戊社', '上海', '2026-07-22', '2026-01']
],
it: [ …現行の 6 行をそのまま… ]
```

**「最終接触が古い」の判定（現行 `c[6] < '2026-08-01'`）は業種ごとの基準日に直す。**
`PCOMPANY[ind].staleBefore`（`mfg: '2025-08-01'` / `fin: '2026-08-01'` / `it: '2026-08-01'`）を足して比較する。

### 8-4. `PHIST`（接触履歴）

```js
/* front.js — PHIST。[氏名, 日付, 種類, 内容, 関連] */
mfg: [   /* 10 行 */
  ['何 俊',   '2025-09-06', 'メール', '塗装ブツのクレームを受領', 'CL-25-0906'],
  ['何 俊',   '2025-09-04', '訪問',  '10 月内示の説明。SK-3318 の増量見込み', 'SO-2510-001'],
  ['何 俊',   '2025-07-02', '会議',  '価格改定の折衝（第 3 回）。保留 2 件', 'M-0702'],
  ['松本 薫', '2025-08-28', '訪問',  '常熟ラインの立ち上げ支援。治具の寸法確認', 'TR-2024-102'],
  ['松本 薫', '2025-06-11', '会議',  '新規ブラケットの要求仕様 Rev.D の説明', 'RFQ-2025-118'],
  ['袁 芳',   '2025-07-15', 'メール', '年間上限条項の適用範囲について照会', 'SO-2510-003'],
  ['崔 斌',   '2025-09-09', '訪問',  '鋼板 SPCC の価格改定の通知', 'ECR-25-0088'],
  ['崔 斌',   '2025-05-20', '会議',  '塗装外注の能力確認', '—'],
  ['邱 蘭',   '2025-09-05', '訪問',  '切替候補としての工程監査の受入', 'ECR-25-0088'],
  ['岡野 哲', '2025-09-06', 'メール', '上海発 大阪向けの船積み書類を送付', 'INV-2025-0906']
],
fin: [   /* 9 行 */
  ['石川 渉', '2026-09-05', '会議',  '四半期報告。運転資金の枠更新の相談', 'CRD-26-0091'],
  ['石川 渉', '2026-06-20', '会食',  '着任の挨拶', '—'],
  ['段 宇',   '2026-08-20', 'メール', 'L/C 開設の手続きについて質問対応', 'CRD-26-0094'],
  ['段 宇',   '2026-06-30', '会議',  '貿易金融の枠組みの説明', '—'],
  ['顧 敏',   '2026-09-02', '訪問',  '新工場の設備資金の相談。面談記録 CLM-26-2211', 'CRD-26-0087'],
  ['顧 敏',   '2026-07-08', '会議',  '財務状況のヒアリング（第 1 回）', 'MTG-2026-0430'],
  ['郭 紅',   '2026-06-18', '訪問',  '大連支店 経由の設備資金の打診', 'CRD-26-0096'],
  ['賀 剛',   '2026-07-22', 'メール', '運転資金の追加枠の照会', 'CRD-26-0098'],
  ['賀 剛',   '2026-04-10', '会議',  'KYC 資料の更新依頼', '—']
],
it: [ …現行の 12 行をそのまま… ]
```

---

## §9 新画面 4 枚（PR-A で殻・PR-D で中身）

**4 枚とも骨格は同じ**：`① タイル 4 つ → ② 主テーブル → ③ 補助テーブル（`cred` は無し） → ④ 解説 2〜3 行 → ⑤ この画面の AI`。
既存の `V.exp`（50 行）・`V.req`（28 行）と同じ作り。**新しい CSS クラスを 1 つも足さない。**

### 9-1. `qual` 品質・不具合（製造・12 行）

```
┌ 品質・不具合 ───────────────────────────────────────────────────────────────┐
│ ① [未クローズ 5] [期限超過 1] [今月のクレーム 2] [不良率 0.42%]             │
│    ↑ .tiles / .tile（既存）。3 つ目は alarm クラス、4 つ目は kpi.csv の値    │
├─────────────────────────────────────────────────────────────────────────────┤
│ ② 不具合・クレーム・変更要求（8 件）                                        │
│    番号 | 区分 | 発生日 | 品番 | 設備 | 相手 | 担当課 | 期限 | 状態 | AI     │
├─────────────────────────────────────────────────────────────────────────────┤
│ ③ 技術報告・是正処置（4 件）                                                │
│    番号 | 区分 | 発行日 | 対象 | 設備 | 担当課 | 状態 | AI                   │
├─────────────────────────────────────────────────────────────────────────────┤
│ ④ 解説（.note 2 行 ＋ .pn blk 1 行）                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ ⑤ この画面の AI（8 本）                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

```js
/* front.js — PQUAL（mfg のみ）。番号・品番・設備はすべて data/world/mfg/records.csv（§6-2）の写し。 */
const PQUAL = { mfg: {
  tiles: [
    { lbl: '未クローズ',       num: '5',  unit: '件',   delta: '期限つき 5 件のうち 1 件が超過' },
    { lbl: '期限超過',         num: '1',  unit: '件',   delta: 'NC-2025-0912 の 8D 提出', alarm: true },
    { lbl: '今月のクレーム',   num: '2',  unit: '件',   delta: 'いずれも K 社・09-06 受領' },
    { lbl: '不良率（8 月）',   num: '0.42', unit: '%',  delta: '目標 0.40%／前月 0.38%' }
  ],
  head: ['番号', '区分', '発生日', '品番', '設備', '相手', '担当課', '期限', '状態'],
  ai: ['qa1', 'qa3', 'kn1'],
  rows: [
    ['NC-2025-0912',  '不具合',   '2025-09-12', 'SK-3310-A', 'PX-200', 'K 社', '品質保証課', '2025-09-19', '対応中'],
    ['8D-25-0912',    '8D 報告',  '2025-09-12', 'SK-3310-A', 'PX-200', 'K 社', '品質保証課', '2025-09-26', '対応中'],
    ['CL-25-0906',    'クレーム', '2025-09-06', 'SK-3310-A', '—',      'K 社', '品質保証課', '2025-09-13', '一次回答待ち'],
    ['CL-25-0906-02', 'クレーム', '2025-09-06', 'SK-2207-B', '—',      'K 社', '品質保証課', '2025-09-13', '一次回答待ち'],
    ['ECR-25-0088',   '変更要求', '2025-08-20', 'SK-3310-A', '—',      'T 社', '生産技術課', '2025-09-30', '審査中'],
    ['NC-2024-0118',  '不具合',   '2024-11-18', 'SK-3310-A', 'D-118',  'K 社', '品質保証課', '—',          '完了'],
    ['ECR-24-0017',   '変更要求', '2024-05-14', 'SK-2207-B', '—',      '—',    '生産技術課', '—',          '完了'],
    ['ECR-23-0041',   '変更要求', '2023-06-08', 'SK-3310-A', '—',      'U 社', '生産技術課', '—',          '完了']
  ],
  trHead: ['番号', '区分', '発行日', '対象', '設備', '担当課', '状態'],
  trAi: ['en1', 'en3'],
  tr: [
    ['TR-2024-007', '技術報告', '2024-07-03', 'SK-3310-A', 'PX-200',  '生産技術課', '完了'],
    ['TR-2024-102', '技術報告', '2024-12-11', 'SK-3310-A', 'J-3310',  '生産技術課', '完了'],
    ['TR-2023-041', '技術報告', '2023-04-19', 'SK-1190',   'D-092',   '生産技術課', '完了'],
    ['CAR-24-01',   '是正処置', '2024-10-02', '工程監査',  '—',       '品質保証課', '完了']
  ],
  notes: [
    '<b>1 行が「1 件の不適合」です。</b>不具合・クレーム・変更要求・8D 報告を 1 本の台帳にしているのは、同じ品番で起きたことを時系列で並べたいからです。区分を列で持てば、あとから分けるのは表示側だけで済みます。',
    '<b>設備の列は空でも構いません。</b>設備に起因しない不具合（材料・作業・図面）があるためです。埋まっている行は、設備の稼働状況（<code>PX-200</code>・<code>D-118</code>）からも同じ 1 件に辿れます。'
  ],
  prod: '本番：不適合は品質システム（QMS）が正本。ポータルは参照と AI の呼び出しだけを受け持つ'
} };
```

### 9-2. `order` 受注・出荷（製造・7 行）

```
① [引合 2] [受注残 3] [今月の出荷 1] [納期遵守 92%]
② 引合・受注（5 件）  番号 | 区分 | 受付日 | 品番 | 相手 | 数量 | 納期 | 状態 | AI
③ 出荷・通関（2 件）  番号 | 区分 | 出荷日 | 品番 | 仕向地 | 書類 | 状態 | AI
④ 解説 2 行 ／ ⑤ この画面の AI（5 本）
```

```js
const PORDER = { mfg: {
  tiles: [
    { lbl: '引合',         num: '2', unit: '件', delta: 'RFQ-2025-118 は 09-19 回答期限' },
    { lbl: '受注残',       num: '3', unit: '件', delta: 'うち 1 件が年間上限条項で保留', alarm: true },
    { lbl: '今月の出荷',   num: '1', unit: '件', delta: '大阪向け 09-06 通関済' },
    { lbl: '納期遵守（8 月）', num: '92', unit: '%', delta: '目標 95%' }
  ],
  head: ['番号', '区分', '受付日', '品番', '相手', '数量', '納期', '状態'],
  ai: ['nm1', 'nm4', 'gn3'],
  rows: [
    ['RFQ-2025-118', '引合', '2025-09-01', 'SK-3310-C', 'K 社', '試作 200',  '2025-09-19', '見積作成中'],
    ['RFQ-2025-131', '引合', '2025-09-05', 'SK-3318',   'V 社', '月 8,000',  '2025-09-26', '条件確認中'],
    ['SO-2509-018',  '受注', '2025-09-08', 'SK-3310-A', 'K 社', '62,000',    '2025-09-30', '生産中'],
    ['SO-2510-001',  '受注', '2025-09-09', 'SK-2207-B', 'K 社', '24,000',    '2025-10-31', '計画済（SO-2510-002 と同時受注）'],
    ['SO-2510-003',  '受注', '2025-09-10', 'SK-3310-A', 'V 社', '6,000',     '2025-10-31', '保留（年間上限条項）']
  ],
  shipHead: ['番号', '区分', '出荷日', '品番', '仕向地', '書類', '状態'],
  shipAi: ['dc6', 'en2'],
  ship: [
    ['INV-2025-0906', '出荷', '2025-09-06', 'SK-3310-A', '大阪（SH-OSA-01）', 'INV-2025-0906 / PL-2025-0906', '通関済'],
    ['RT-2508-04',    '返品', '2025-08-22', 'SK-2207-B', '常熟（K 社）',      'RT-2508-04',                    '受領済']
  ],
  notes: [
    '<b>引合から出荷までを 1 本の流れで持ちます。</b>引合番号（RFQ）・受注番号（SO）・出荷書類（INV / PL）は別の番号体系ですが、品番と相手で 1 本につながります。',
    '<b>書類の列に 2 つ並ぶのは、発票とパッキングリストが同じ出荷の対だからです。</b>通関書類の確認（DC-06）はこの 2 枚を一緒に受け取ります。'
  ],
  prod: '本番：受注は生産管理システムが正本。出荷書類は物流課の台帳から取り込む'
} };
```

### 9-3. `cred` 与信・審査（金融・7 行）

```
① [審査中 2] [起案・KYC 2] [稟議処理日数 6.2 日] [与信先数 405]
② 与信案件（7 件）
   審査番号 | 稟議番号 | 先 | 商品 | 金額（億元）| ステージ | 申請日 | 期限 | 審査担当 | AI
④ 解説 2 行 ／ ⑤ この画面の AI（4 本）   ※補助テーブルは置かない
```

```js
const PCRED = { fin: {
  tiles: [
    { lbl: '審査中',          num: '2',   unit: '件', delta: 'CRD-26-0087 は 09-18 期限' },
    { lbl: '起案・KYC 確認中', num: '2',  unit: '件', delta: '戊社は KYC で保留', alarm: true },
    { lbl: '稟議処理日数',    num: '6.2', unit: '日', delta: '目標 5.0 日／前月 5.8 日' },
    { lbl: '与信先数',        num: '405', unit: '社', delta: '目標 420 社／前月 398 社' }
  ],
  head: ['審査番号', '稟議番号', '先', '商品', '金額（億元）', 'ステージ', '申請日', '期限', '審査担当'],
  ai: ['cv3', 'cv4', 'dc11'],
  rows: [
    ['CRD-26-0087', 'RNG-2026-0142', '丙社', '設備資金貸出',  '8.5',  '審査中',     '2026-08-28', '2026-09-18', '高梨 直人'],
    ['CRD-26-0094', 'RNG-2026-0151', '乙社', 'L/C・貿易金融', '6.0',  '審査中',     '2026-09-01', '2026-09-25', '楊 建国'],
    ['CRD-26-0096', 'RNG-2026-0158', '丁社', '設備資金貸出',  '24.0', '起案',       '2026-09-05', '2026-10-09', '高梨 直人'],
    ['CRD-26-0098', 'RNG-2026-0160', '戊社', '運転資金貸出',  '3.0',  'KYC 確認中', '2026-09-08', '2026-09-30', '楊 建国'],
    ['CRD-26-0101', 'RNG-2026-0163', '丙社', '運転資金貸出',  '5.0',  '差戻し',     '2026-09-08', '2026-09-24', '楊 建国'],
    ['CRD-26-0091', 'RNG-2026-0089', '甲社', '運転資金貸出',  '12.0', '承認済',     '2026-07-10', '2026-08-05', '楊 建国'],
    ['CRD-26-0079', 'RNG-2026-0120', '甲社', '為替予約',      '4.5',  '承認済',     '2026-06-02', '2026-06-28', '高梨 直人']
  ],
  notes: [
    '<b>審査番号と稟議番号を両方持ちます。</b>審査番号（CRD）は案件の一生に 1 つ、稟議番号（RNG）は決裁の回ごとに増えます。差戻して出し直すと稟議番号だけが替わるので、履歴を追うには両方要ります。',
    '<b>金額は億元です</b>（1 億元 = 100 百万元）。取引先画面の「与信残高」と同じ単位で、<code>data/world/fin/kpi.csv</code> の貸出残高（百万元）と突き合わせられます。'
  ],
  prod: '本番：与信案件は審査系システムが正本。ポータルは自分に回ってきた案件だけを見る'
} };
```

### 9-4. `reg` 当局対応・レポート（金融・14 行）

```
① [対応中 6] [未着手 1] [期限 30 日以内 3] [当局報告件数 14 件/月]
② 当局通達と対応状況（10 件）
   通達番号 | 発出日 | 区分 | 論点 | 影響する部署 | 対応期限 | 状態 | AI
③ 定例レポート（4 件）  名称 | 頻度 | 次回提出 | 担当 | 状態 | AI
④ 解説 2 行 ／ ⑤ この画面の AI（4 本）
```

```js
const PREG = { fin: {
  tiles: [
    { lbl: '対応中',           num: '6',  unit: '件', delta: '完了 3 件・未着手 1 件' },
    { lbl: '未着手',           num: '1',  unit: '件', delta: 'NTF-2026-017（09-07 発出）', alarm: true },
    { lbl: '期限 30 日以内',   num: '3',  unit: '件', delta: 'NTF-2026-004 / -008 / -011' },
    { lbl: '当局報告件数（8 月）', num: '14', unit: '件', delta: '前月 12 件' }
  ],
  head: ['通達番号', '発出日', '区分', '論点', '影響する部署', '対応期限', '状態'],
  ai: ['kn5', 'kn8'],
  rows: [
    ['NTF-2026-017', '2026-09-07', '個人情報', '行内システムのログ保存に関する留意事項',   'システム部',     '2026-12-31', '未着手'],
    ['NTF-2026-016', '2026-09-08', '外為',     '為替予約の実需原則に関する照会回答',       '市場業務部',     '2026-11-30', '対応中'],
    ['NTF-2026-015', '2026-09-02', '銀行監督', '四半期報告の提出期限の前倒し',             '経営企画部',     '2026-10-20', '対応中'],
    ['NTF-2026-013', '2026-08-24', '銀行監督', '与信審査記録の保存年限の見直し',           '審査部',         '2026-10-31', '対応中'],
    ['NTF-2026-011', '2026-07-15', 'マネロン', '疑わしい取引の届出様式の変更',             '事務統括部',     '2026-09-30', '対応中'],
    ['NTF-2026-008', '2026-06-02', '外為',     'クロスボーダー人民元送金の報告項目追加',   '市場業務部',     '2026-09-15', '対応中'],
    ['NTF-2026-004', '2026-04-10', '個人情報', '個人情報の越境移転に関する運用指針',       '事務統括部',     '2026-09-12', '対応中'],
    ['NTF-2025-041', '2025-11-28', '銀行監督', '自己資本比率の算定方法の一部改定',         'リスク統括部',   '2026-03-31', '完了'],
    ['NTF-2025-032', '2025-09-05', '銀行監督', '大口与信の報告閾値の引き下げ',             '審査部',         '2025-12-31', '完了'],
    ['NTF-2025-019', '2025-05-20', 'マネロン', '顧客管理の継続的確認の頻度',               '事務統括部',     '2025-09-30', '完了']
  ],
  rptHead: ['名称', '頻度', '次回提出', '担当', '状態'],
  rptAi: ['dc8', 'dc9'],
  rpt: [
    ['月次 当局報告',       '月次', '2026-09-16', '韓 雪',     '作成中'],
    ['四半期 当局報告',     '四半期', '2026-10-20', '鄭 麗華', '未着手（NTF-2026-015 で前倒し）'],
    ['大口与信の報告',       '月次', '2026-09-10', '中野 隆',   '提出済'],
    ['疑わしい取引の届出',   '随時', '—',          '羅 佳',     '様式変更の反映待ち（NTF-2026-011）']
  ],
  notes: [
    '<b>通達 1 本に、影響する部署と対応期限を必ず付けます。</b>「読んだ」で終わらせないためです。期限の無い通達は運用上どこにも落ちないので、期限は必須にします。',
    '<b>定例レポートを同じ画面に置くのは、通達が期限を動かすからです。</b>NTF-2026-015（四半期報告の前倒し）は、下の表の 2 行目の提出日を動かしました。2 つの表を別画面に置くと、この関係が見えなくなります。'
  ],
  prod: '本番：通達の受信は当局のポータルから。対応状況はコンプライアンス部の台帳が正本'
} };
```

### 9-5. `PCTXDEF` に 4 キーを足す（PR-D）

```js
qual:  ['no', 'kind', 'part', 'equip', 'cu', 'due', 'state'],
order: ['no', 'kind', 'part', 'cu', 'qty', 'due', 'state'],
cred:  ['no', 'ringi', 'cu', 'product', 'amount', 'stage', 'due'],
reg:   ['no', 'issued', 'authority', 'topic', 'dept', 'due', 'state']
```

対応する `PT` のラベルキーは §12-2（`ctxRecord` / `ctxKind` / `ctxPartNo` / `ctxEquip` / `ctxQty` /
`ctxRingi` / `ctxProduct` / `ctxAmount` / `ctxStage` / `ctxNotice` / `ctxIssued` / `ctxAuthority` /
`ctxTopic` / `ctxDept`）。既存の `ctxCustomer` / `ctxDue` / `ctxState` は使い回す。

---

## §10 `sys` の製造テンプレート（PM 決定 Q3）

### 10-1. 何をするか

- `PSCREENS` の `sys` に `ind: ['mfg','it']` と `lbl: { mfg: 'sysMfg' }` を付ける（§3-1）。**金融では出ない**
- **`2026-09-11-sysops-usecase.md` の導出規則（§6-4）をそのまま使う**：
  `base_state` だけをデータが持ち、**サービス時間対象外**と**バッチ（製造では暖機）**は
  `PSYS[].hours` / `PSYS[].batch` と `PSYSNOW` の「いま」から**表示のたびに導出する**。
  `js/portal/app.js` の `pSysParseHours()` / `pSysParseBatch()` / `pSysState()` は **1 行も変えない**
- `PSYSNOW`（時刻プリセット 3 つ）は**業種で共有**（`平日 10:20` / `平日 22:40` / `休日 03:10`）。
  日付は IT 世界のものだが、**プリセットは「曜日と時刻」しか使わない**ので製造でもそのまま成立する

### 10-2. `PSYSST.mfg`（状態の語彙 7 つ・3 言語・`lv` は IT と同じ）

| key | `lv` | ja | zh | en | 製造での意味 |
|---|---|---|---|---|---|
| `normal` | g | 稼働中 | 运行中 | Running | 定常生産 |
| `incident` | r | 故障停止中 | 故障停机中 | Down due to a fault | アラームで停止 |
| `degraded` | y | 能力低下（単能運転） | 产能下降（单机运行） | Running at reduced capacity | 一部の工程だけ |
| `blocked` | y | 段取り中 | 换型中 | Changeover in progress | 金型交換・品番切替 |
| `maint` | n | 計画保全中 | 计划保养中 | Planned maintenance | 予定どおりの停止 |
| `batch` | n | 立上げ・暖機中 | 启动预热中 | Warming up | `batch` 窓から導出 |
| `offhours` | n | 非稼働時間帯 | 非运行时段 | Outside operating hours | `hours` から導出 |

### 10-3. `PSYS.mfg`（6 件。`data/world/mfg/equipment.csv` の写し）

```js
{ id: 'PX-200', name: 'プレス機（L2）', kind: 'line', client: '蘇州工場 L2', project: 'SK-3310-A',
  ownerId: 'liu-yang', owner: '劉 洋', dept: '', criticality: '高',
  hours: '平日 08:00-20:00; 土 08:00-13:00', batch: '日次 07:30-08:00' },
{ id: 'PX-300', name: 'NC 旋盤（L3）', kind: 'line', client: '蘇州工場 L3', project: 'SK-3310-A',
  ownerId: 'wang-lei', owner: '王 磊', dept: '', criticality: '中',
  hours: '平日 08:00-20:00', batch: '日次 07:30-08:00' },
{ id: 'DO-3200', name: '乾燥炉（塗装ライン）', kind: 'line', client: '蘇州工場 塗装', project: 'SK-3310-A',
  ownerId: 'liu-yang', owner: '劉 洋', dept: '', criticality: '高',
  hours: '平日 07:00-22:00', batch: '日次 06:00-07:00' },
{ id: 'D-118', name: '金型（SK-3310-A 段取り用）', kind: 'tool', client: '蘇州工場 L3', project: 'SK-3310-A',
  ownerId: 'liu-yang', owner: '劉 洋', dept: '', criticality: '中',
  hours: '平日 08:00-20:00', batch: '' },
{ id: 'J-3310', name: '塗装治具（ラック）', kind: 'tool', client: '蘇州工場 塗装', project: 'SK-3310-A',
  ownerId: 'wang-lei', owner: '王 磊', dept: '', criticality: '中',
  hours: '平日 07:00-22:00', batch: '' },
{ id: 'D-092', name: '金型（SK-1190 用・倉庫 T-2 保管）', kind: 'tool', client: '蘇州工場 倉庫 T-2', project: '',
  ownerId: '', owner: '設備保全課', dept: 'hozen', criticality: '低',
  hours: '', batch: '' }
```

`kind` は IT の `customer` / `internal` に対して製造は `line`（ラインの設備）/ `tool`（金型・治具）。
**`pstate.sysScope`（自分が使う／担当／全社）の 3 択はそのまま使う**（「全社」＝工場全体）。

### 10-4. `PSYSEV.mfg`（8 件。番号はポータル内部の `EV-2509-NN`）

```js
{ id: 'EV-2509-01', sys: 'PX-200', at: '2025-09-11 22:05', kind: 'alert', sev: 'high',
  summary: 'アラーム E-47（スライド下死点位置ずれ）。D-118 の冷間時に発生' },
{ id: 'EV-2509-02', sys: 'PX-200', at: '2025-09-12 00:15', kind: 'recover', sev: 'info',
  summary: '復旧。金型を 40℃ まで予熱して再開（金型予熱基準）' },
{ id: 'EV-2509-03', sys: 'DO-3200', at: '2025-09-11 07:30', kind: 'alert', sev: 'warn',
  summary: '炉内の温度ムラ ±8℃。塗装ブツの一因として調査中' },
{ id: 'EV-2509-04', sys: 'DO-3200', at: '2025-09-11 09:45', kind: 'recover', sev: 'info',
  summary: '復旧。送風量を調整して ±4℃ に収束' },
{ id: 'EV-2509-05', sys: 'PX-300', at: '2025-09-11 21:00', kind: 'block', sev: 'info',
  summary: '品番切替のため段取りを開始（SK-3310-A → SK-2207-B）' },
{ id: 'EV-2509-06', sys: 'PX-300', at: '2025-09-12 06:00', kind: 'unblock', sev: 'info',
  summary: '段取り完了。初品検査へ' },
{ id: 'EV-2509-07', sys: 'J-3310', at: '2025-09-13 02:00', kind: 'maint_start', sev: 'info',
  summary: '治具の洗浄と寸法確認のため計画停止を開始' },
{ id: 'EV-2509-08', sys: 'J-3310', at: '2025-09-13 04:00', kind: 'maint_end', sev: 'info',
  summary: '計画停止終了' }
```

`kind` / `sev` の値域は IT と同じ（`alert` / `recover` / `block` / `unblock` / `maint_start` / `maint_end`、
`high` / `critical` / `warn` / `info`）。**`app.js` の導出ロジックは 1 行も変えない。**

### 10-5. 金融で `sys` を出さないことの説明

`PSCREENS.sys.ind = ['mfg','it']`。ナビにも画面にも出ない。
**理由を `V.ai` の注記に 1 行書く**：「碧洋銀行の部門ポータル（事務統括部）は、システムの稼働状況を
自部門の画面として持ちません。勘定系の稼働はシステム部の画面です」。
これは**「共通画面なのに業種によって出ない」ことを画面の中で説明する**ための 1 行で、PM 決定 Q3 の帰結である。

---

## §11 `SVCS[].place` の付け直し（PR-E）

### 11-1. 形（後方互換）

```js
place: 'qual'                                  // 文字列（78 件。現行と同じ形）
place: { mfg: 'kpi', fin: 'reg', it: 'proj' }  // オブジェクト（4 件だけ）
```

オブジェクト形にするのは **DC-08・DC-11・EG-01・KN-05 の 4 件だけ**。
**キーは `svc.industries` と過不足なく一致させる**（verify §17-c。片方だけ書いて他方が消えるのを防ぐ）。

```js
/* js/portal/app.js — 業種を考慮した place の読み取り（PR-E で追加） */
const placeOf = (s, ind) => {
  const p = s && s.place;
  if (p === undefined) return undefined;
  return typeof p === 'string' ? p : p[ind];
};
```

### 11-2. 全 82 件の変更前後（`CLAUDE.md` §2-9）

**件数は 82 件のまま。`id` の追加・削除・改名はゼロ。`industries` も 1 件も変えない。**
`regress` の `counts` は 1 つも動かない（`cats:15, subs:35, svcs:82, tags:67, ui:91,
byIndustry{mfg:{svcs:50,cats:10}, fin:{svcs:30,cats:8}, it:{svcs:26,cats:7}}, svcsMulti:12`）。

| 管理番号 | 名称 | 業種 | 現行 `place` | rev4 の `place` | |
|---|---|---|---|---|---|
| CV-01 | 提案・ピッチ資料の作成（候補先選定・比較企業分析） | fin | `'proj'` | `'cred'` | **変更** |
| CV-02 | 面談前ブリーフの作成 | fin | `'cust'` | `'cust'` |  |
| CV-03 | 審査コメントのドラフト作成 | fin | `'out'` | `'cred'` | **変更** |
| CV-04 | KYCスクリーニングとエスカレーション整理 | fin | `'out'` | `'cred'` | **変更** |
| DC-01 | 日本本社への報告資料作成 | mfg | `'proj'` | `'kpi'` | **変更** |
| DC-02 | 議事録作成と次回論点整理 | mfg/fin/it | `'meet'` | `'meet'` |  |
| DC-03 | 教育・OJT資料作成 | mfg | `'trn'` | `'trn'` |  |
| DC-04 | 安全衛生・5S掲示物・改善提案の中国語化 | mfg | `'out'` | `'trn'` | **変更** |
| DC-05 | 稟議・申請書の作成と記載漏れ検出 | mfg | `'req'` | `'req'` |  |
| DC-06 | 輸出入・通関書類の確認 | mfg | `'out'` | `'order'` | **変更** |
| DC-07 | サプライヤー契約書ドラフト支援 | mfg | `'req'` | `'req'` |  |
| DC-08 | 報告レビュー（提出前チェック／受領後の論点整理） | mfg/fin/it | `'proj'` | `{ mfg:'kpi', fin:'reg', it:'proj' }` | **変更** |
| DC-09 | 議案・報告書・提案書のドラフト作成（テンプレート選択） | fin | `'proj'` | `'reg'` | **変更** |
| DC-10 | 予実差の理由の書き起こし | it | `'kpi'` | `'kpi'` |  |
| DC-11 | 契約書レビュー（逸脱条項の検出と修正案） | mfg/fin/it | `'proj'` | `{ mfg:'req', fin:'cred', it:'proj' }` | **変更** |
| EG-01 | 上流工程の仕様支援（読解・質問回答・エラー対処） | mfg/fin/it | `'proj'` | `{ mfg:'qual', fin:'know', it:'proj' }` | **変更** |
| EN-01 | 仕様改訂の差分検出・取引先用語対応 | mfg | `'out'` | `'qual'` | **変更** |
| EN-02 | BOM逆引き | mfg | `'out'` | `'order'` | **変更** |
| EN-03 | 図面の類似検索 | mfg | `'out'` | `'qual'` | **変更** |
| FA-01 | GL勘定のリコンシリエーション | fin | `'exp'` | `'exp'` |  |
| FA-02 | 月次クローズの実行と報告 | fin | `'exp'` | `'exp'` |  |
| FA-03 | 財務諸表のレビュー（整合性・監査対応） | fin | `'exp'` | `'exp'` |  |
| FA-04 | 財務モデルの作成と決算反映 | fin | `'exp'` | `'exp'` |  |
| FA-05 | バリュエーションのレビュー | fin | `'exp'` | `'exp'` |  |
| GN-01 | 経費精算チェック | mfg | `'exp'` | `'exp'` |  |
| GN-02 | 請求書（発票）処理 | mfg | `'exp'` | `'exp'` |  |
| GN-03 | 受注・発注書の読み取りと登録支援 | mfg | `'vend'` | `'order'` | **変更** |
| GN-04 | スケジュール調整 | mfg | `'meet'` | `'meet'` |  |
| GN-05 | 文書要約 | mfg | `'*'` | `'*'` |  |
| GN-06 | 頼まれ事・放置業務の追跡 | mfg/fin/it | `'act'` | `'act'` |  |
| GN-07 | 幹部来訪・出張のアテンド段取り | mfg/fin/it | `'meet'` | `'meet'` |  |
| GN-08 | 名刺の読み取りと項目抽出 | it | `'cust'` | `'cust'` |  |
| KN-01 | 技術ナレッジQA | mfg | `'out'` | `'qual'` | **変更** |
| KN-02 | 設備マニュアル・取扱説明書の検索 | mfg | `'out'` | `'sys'` | **変更** |
| KN-03 | 社内規程・就業規則QA | mfg | `'know'` | `'know'` |  |
| KN-04 | 社内問い合わせ受付とFAQ蓄積 | mfg/fin/it | `'know'` | `'know'` |  |
| KN-05 | 当局通達の影響分析・マニュアル反映 | mfg/fin/it | `'out'` | `{ mfg:'know', fin:'reg', it:'know' }` | **変更** |
| KN-06 | 事務手続の照会 | fin | `'out'` | `'know'` | **変更** |
| KN-07 | 行内営業情報の検索（日誌・接触履歴） | fin | `'out'` | `'cust'` | **変更** |
| KN-08 | 当局通達・ガイドラインDB（照会・過去比較） | fin | `'out'` | `'reg'` | **変更** |
| KN-09 | 取込文書の分類自動振り分け | it | `'know'` | `'know'` |  |
| KN-10 | 規程と現場運用の食い違い検出 | it | `'know'` | `'know'` |  |
| LG-01 | 日中翻訳（社内の言い方に揃える） | mfg | `'*'` | `'*'` |  |
| LG-02 | 社内用語・呼称の統一（用語集） | mfg | `'know'` | `'know'` |  |
| LG-03 | 現地スタッフとの認識合わせ（手順の中国語書き下し） | mfg | `'know'` | `'know'` |  |
| LG-04 | ビジネスメール作成（日中往復） | mfg | `'act'` | `'act'` |  |
| NM-01 | 見積り・原価計算 | mfg | `'proj'` | `'order'` | **変更** |
| NM-02 | 購買見積の比較 | mfg | `'vend'` | `'vend'` |  |
| NM-03 | 日報・実績の集計と要約 | mfg | `'kpi'` | `'kpi'` |  |
| NM-04 | 在庫・納期の問い合わせ回答 | mfg | `'out'` | `'order'` | **変更** |
| NM-05 | データ分析アシスタント | mfg | `'kpi'` | `'kpi'` |  |
| PO-01 | アンケート・インタビュー収集 | mfg/fin/it | `'trn'` | `'trn'` |  |
| PO-02 | アイデアの募集・蓄積・投票集計 | mfg/fin/it | `'trn'` | `'trn'` |  |
| PO-03 | 小テスト・コンプライアンスチェックの実施と集計 | mfg/fin/it | `'trn'` | `'trn'` |  |
| PO-04 | 稼働の集計とコスト配分の提案 | mfg/fin/it | `'ppl'` | `'ppl'` |  |
| PO-05 | 年休の取り残し検知と取得計画 | it | `'ppl'` | `'ppl'` |  |
| PO-06 | 残業の偏りからの要員リスク検知 | it | `'ppl'` | `'ppl'` |  |
| PO-07 | AI利用実績からの削減時間の見積 | it | `'kpi'` | `'kpi'` |  |
| PT-01 | 取引先・サプライヤーの与信・リスク監視 | mfg | `'vend'` | `'cust'` | **変更** |
| PT-02 | 業界・材料相場リサーチ（本社報告の外部根拠） | mfg | `'watch'` | `'watch'` |  |
| PT-03 | 業界誌・技術記事アーカイブの横断検索 | mfg | `'watch'` | `'watch'` |  |
| PT-04 | 現地給与水準の照会と給与改定の妥当性確認 | mfg | `'ppl'` | `'ppl'` |  |
| PT-05 | 現地技術者・管理職の採用支援（一次面談の要約・候補者サマリ） | mfg | `'ppl'` | `'ppl'` |  |
| PT-06 | 戦略購買の立案（集約・複数年・代替サプライヤー） | mfg | `'vend'` | `'vend'` |  |
| PT-07 | RFQ 起草と購買代行への引き継ぎ | mfg | `'vend'` | `'vend'` |  |
| PT-08 | 研修プログラム化と実施代行・受講管理 | mfg | `'trn'` | `'trn'` |  |
| QA-01 | 不具合原因分析・報告書（8D）作成 | mfg | `'out'` | `'qual'` | **変更** |
| QA-02 | 変更点影響予測（4M変更管理） | mfg | `'out'` | `'qual'` | **変更** |
| QA-03 | 顧客クレーム一次回答・分類 | mfg | `'out'` | `'qual'` | **変更** |
| QA-04 | 完成車メーカー工程監査への対応資料 | mfg | `'out'` | `'qual'` | **変更** |
| RS-01 | 企業・業界ニュースの自動収集と配信 | fin | `'watch'` | `'watch'` |  |
| RS-02 | セクター・発行体のモニタリング | fin | `'watch'` | `'watch'` |  |
| RS-03 | 顧客IR・決算の収集と日本語要約・比較 | fin | `'watch'` | `'watch'` |  |
| RS-04 | 市場・企業データの照会（金融情報端末・契約データベース） | fin | `'watch'` | `'watch'` |  |
| RS-05 | ダッシュボード出力からの気づき分析 | fin | `'kpi'` | `'kpi'` |  |
| SL-01 | 引合の受注確度推定 | it | `'proj'` | `'proj'` |  |
| SL-02 | 失注理由の蓄積と傾向分析 | it | `'proj'` | `'proj'` |  |
| SL-03 | 過去提案の横断検索と再利用 | it | `'proj'` | `'proj'` |  |
| SO-01 | 障害アラートの要約と初動案 | it | `'sys'` | `'sys'` |  |
| SO-02 | 稼働状況の自然言語照会 | it | `'sys'` | `'sys'` |  |
| SO-03 | 障害・稼働の定期報告（稼働率・障害件数・MTTR） | it | `'kpi'` | `'kpi'` |  |
| SO-04 | 障害報告・再発防止策のドラフト | it | `'sys'` | `'sys'` |  |

**変更するのは 27 件**（`CV-01, CV-03, CV-04, DC-01, DC-04, DC-06, DC-08, DC-09, DC-11, EG-01, EN-01, EN-02, EN-03,
GN-03, KN-01, KN-02, KN-05, KN-06, KN-07, KN-08, NM-01, NM-04, PT-01, QA-01, QA-02, QA-03, QA-04`）。
残り 55 件は 1 バイトも触らない。

**`'out'` は 18 件 → 0 件になる。**業種テンプレート化によって、置き場所の無かった 18 件すべてに画面ができた
——これが本件のいちばん分かりやすい成果である。

### 11-3. 「この画面の AI」の件数（規則 1 撤回後・49 マス）



| 画面 | 製造 | 金融 | IT |
|---|---|---|---|
| `cust` | 1（PT-01） | 2（KN-07 CV-02） | 1（GN-08） |
| `proj` | — | — | 6（DC-08 DC-11 EG-01 SL-01 SL-02 SL-03） |
| `qual` | 8（KN-01 QA-01 QA-02 QA-03 QA-04 EN-01 EN-03 EG-01） | — | — |
| `order` | 5（DC-06 NM-01 NM-04 EN-02 GN-03） | — | — |
| `cred` | — | 4（DC-11 CV-01 CV-03 CV-04） | — |
| `reg` | — | 4（KN-05 DC-08 KN-08 DC-09） | — |
| `act` | 2（LG-04 GN-06） | 1（GN-06） | 1（GN-06） |
| `sys` | 1（KN-02） | — | 3（SO-01 SO-02 SO-04） |
| `meet` | 3（DC-02 GN-04 GN-07） | 2（DC-02 GN-07） | 2（DC-02 GN-07） |
| `know` | 5（KN-03 KN-04 KN-05 LG-02 LG-03） | 3（KN-04 KN-06 EG-01） | 4（KN-04 KN-05 KN-09 KN-10） |
| `watch` | 2（PT-02 PT-03） | 4（RS-01 RS-02 RS-03 RS-04） | **0** |
| `vend` | 3（NM-02 PT-06 PT-07） | **0** | **0** |
| `kpi` | 4（DC-01 DC-08 NM-03 NM-05） | 1（RS-05） | 3（DC-10 PO-07 SO-03） |
| `goal` | **0** | **0** | **0** |
| `ppl` | 3（PT-04 PT-05 PO-04） | 1（PO-04） | 3（PO-04 PO-05 PO-06） |
| `exp` | 2（GN-01 GN-02） | 5（FA-01 FA-02 FA-03 FA-04 FA-05） | **0** |
| `req` | 3（DC-05 DC-07 DC-11） | **0** | **0** |
| `trn` | 6（DC-03 DC-04 PT-08 PO-01 PO-02 PO-03） | 3（PO-01 PO-02 PO-03） | 3（PO-01 PO-02 PO-03） |
| ホーム `'*'` | 2（LG-01 GN-05） | **0** | **0** |

**合計**：製造 50 件 ／ 金融 30 件 ／ IT 26 件が、それぞれ 1 つの画面に載る（`out` 0・未配置 0）。

### 11-4. 空マス 11 個（正直に書く）

| 業種 | 空マス | なぜ空か |
|---|---|---|
| 製造 | `goal` | 目標設定を支援する AI がカタログに 1 本も無い |
| 金融 | `vend` / `req` / `goal` / ホーム `'*'` | 仕入先管理・申請・目標・全画面横断の AI が金融向けに 1 本も無い |
| IT | `watch` / `vend` / `exp` / `req` / `goal` / ホーム `'*'` | IT 業のカタログ 26 件は案件・稼働・要員・ナレッジに寄っている |

**`goal` が 3 業種とも 0 なのは、カタログに「目標（MBO）を支援する AI」が 1 本も無いから。**
**ホームの横断 `'*'`（LG-01 翻訳・GN-05 文書要約）が製造だけなのは、この 2 件の `industries` が `['mfg']` だから。**

**`SVCS[].industries` は広げない。**理由：
① 広げると `regress` の `counts.byIndustry` と `svcsMulti` が動き、**`place` の差分と混ざって読めなくなる**
② どのサービスを他業種へ広げるかは**カタログ側のプロダクト判断**であって、ポータルの設計判断ではない
③ **空マスが見えること自体に価値がある**（PM 決定 Q1）。`PT.noScreenAi` を出し、
   「この画面で効く AI をこれから作ります」という会話の材料にする

> 申し送り：LG-01・GN-05・GN-01・GN-02・RS-01 あたりは業種横断に見える。
> **カタログ側で `industries` を広げるかどうかは別 Issue**（本設計では触らない）。

### 11-5. `V.ai`（AI サービス画面）の作り直し

現行の `V.ai` には **`place` を持たない 21 件の話** と **「カタログに IT 業がまだありません」** が
文字列でハードコードされている。どちらも `main` の実態（未配置 0・IT 業 26 件）と食い違っている。
**PR-E でこの画面を作り直す。**

| ブロック | 現行 | rev4 |
|---|---|---|
| タイル | 業種のサービス数／辿れる／辿れない／未配置／稼働中 | **業種のサービス数／この業種で置いた／空マスの画面数／稼働中** の 4 つ |
| 「ポータルからは辿れない N 件」 | `place: 'out'` の分類別内訳（18 件） | **「業種 × 画面の置き場所の内訳」**（§11-3 の表をそのまま描く）。`out` が 0 なのでブロックごと差し替える |
| 注記 | IT 業が無い前提の文章 | **「この業種で AI が 1 本も無い画面」の一覧**と、`sys` を金融で出さない理由（§10-5） |

`POUT` は**空オブジェクトとして残す**（定数と verify §17-g の検査を温存し、将来 `out` が復活しても動くようにする）。

---

## §12 多言語（`PT`。`CLAUDE.md` §2-1）

**`PT` だけが 3 言語辞書である**という §7 の整理は rev4 でも変わらない。
**業種化した行データは ja の素の文字列のまま**（D12 維持）。`{ja:…}` 形にしない
——半端な 3 言語オブジェクトを作らないため（verify §17-e がそれを検出する）。

### 12-1. 新しい画面名・空マス文言（PR-A）

| key | ja | zh | en |
|---|---|---|---|
| `qual` | 品質・不具合 | 质量与不良 | Quality & defects |
| `order` | 受注・出荷 | 订单与出货 | Orders & shipping |
| `cred` | 与信・審査 | 授信与审查 | Credit & review |
| `reg` | 当局対応・レポート | 监管应对与报告 | Regulatory & reporting |
| `sysMfg` | 設備の稼働状況 | 设备运行状况 | Equipment status |
| `noScreenAi` | この画面の AI はまだありません | 本画面尚无 AI 服务 | No AI services on this screen yet |
| `noCrossAi` | 横断で使う AI はまだありません | 尚无跨画面使用的 AI | No cross-screen AI services yet |
| `indNote` | 会社（業種）ごとのポータルを切り替えます。画面・データ・AI がまとめて替わります | 切换不同行业（公司）的门户。画面、数据与 AI 会一并变化 | Switches between the portals of different companies (industries); screens, data and AI all change together |

**変更する既存キー（1 つ）**

| key | 現行 ja | rev4 ja | rev4 zh | rev4 en |
|---|---|---|---|---|
| `cust` | 顧客 | **取引先** | **交易对象** | **Business partners** |

**削除する既存キー（3 つ）**：`org` / `site` / `role` → `PCOMPANY` と `INDUSTRIES` から組み立てる（§5-2）。

### 12-2. 文脈カードのラベル（PR-D）

| key | ja | zh | en |
|---|---|---|---|
| `ctxRecord` | 記録番号 | 记录编号 | Record no. |
| `ctxKind` | 区分 | 类别 | Type |
| `ctxPartNo` | 品番 | 品号 | Part no. |
| `ctxEquip` | 設備 | 设备 | Equipment |
| `ctxQty` | 数量 | 数量 | Quantity |
| `ctxRingi` | 稟議番号 | 稟议编号 | Approval no. |
| `ctxProduct` | 商品 | 产品 | Product |
| `ctxAmount` | 金額 | 金额 | Amount |
| `ctxStage` | ステージ | 阶段 | Stage |
| `ctxNotice` | 通達番号 | 通知编号 | Notice no. |
| `ctxIssued` | 発出日 | 发布日期 | Issued |
| `ctxAuthority` | 区分（当局） | 类别（监管） | Authority |
| `ctxTopic` | 論点 | 要点 | Topic |
| `ctxDept` | 担当部署 | 负责部门 | Owning dept. |

既存の `ctxCustomer` / `ctxDue` / `ctxState` / `ctxOwner` はそのまま使い回す。

### 12-3. 規則 6 の文言更新（PR-F）

`scriptWorldRow` は**変えない**（行に別世界の顧客がいるのは IT の `proj` / `cust` だけ。そこでの文面はいまのままで正しい）。
`scriptWorldPlain` を**いま見ているポータルの業種に触れる形**に更新する。

| key | ja | zh | en |
|---|---|---|---|
| `scriptWorldPlain` | いま見ているのは{want}のポータルですが、この台本は{from}の世界のものです。会話と結果に出る会社名・拠点・品番は台本の世界のものになります | 当前查看的是{want}的门户，但此脚本取自{from}的虚构世界。对话与结果中出现的公司名称、厂区与品号均来自脚本所在的世界 | You are viewing the {want} portal, but this script comes from the {from} world, so the company names, sites and part numbers in the conversation and result belong to the script's world |

`{from}` / `{want}` には `INDUSTRIES[].name`（3 言語）を差し込む——**現行の実装のまま**。

### 12-4. `PT` のキー数

**現行（`d484ff7` で 73 キー） ＋ 8（§12-1） ＋ 14（§12-2） − 3（削除 `org`/`site`/`role`） = 92 キー。**
3 言語すべて埋める（verify §17-e が FAIL で見る）。
**絶対数は実装時の `main` で数え直すこと**（#297 で `mockbarHide` / `mockbarShow` の 2 キーが増えたように、
ポータルの小さな PR で増減する）。**増減の内訳（＋8 ＋14 −3）のほうが正**。

---

## §13 本番との違い

### 13-1. `2026-09-10-portal-nocobase.md`（rev3）との関係

**rev3 は「翠雲システムズ 1 社の本番ポータル」の設計であり、rev4 はそれを 1 ミリも変えない。**
rev3 §5-2' の「画面 → テーブル」対応表（15 画面）・§3-3' の業務スキーマ・`portal/schema/V001__init.sql` は
**そのまま生きている**。rev4 が足すのは**モックの上だけの業種切替**であって、本番は 1 社 1 ポータルなので業種切替は存在しない。
本番の翠雲ポータルに `qual` / `order` / `cred` / `reg` は**作らない**——この 4 枚は
「顧客 A（製造）／顧客 B（金融）にポータルを作るならこうなる」という**提案の材料**である。

### 13-2. 明記する 3 点（`V.ai` と `.mockbar` の注記）

1. **`.mockbar` はレビュー用の足場**（`CLAUDE.md` §2-4）。**業種チップを足しても足場のまま。**本番 UI には出ない
2. **業種を DB の列にしない。**本番は 1 社 1 インスタンス。`portal/schema/V001__init.sql` に `industry` 列を足さない
   （足すと「1 つの DB に 3 社が同居する」設計に見え、rev3 §3-3' の「業務スキーマは唯一変えてはいけない層」を汚す）
3. **業種テンプレートの意味は「同じ骨格で会社を差し替えられる」こと。**
   共通 13 画面（`act`/`sys`/`meet`/`know`/`watch`/`vend`/`ai`/`kpi`/`goal`/`ppl`/`exp`/`req`/`trn`）と
   `cust` は**列も骨格も 3 業種で同じ**で、替わるのは行だけ。フロントの業種別 5 枚だけが会社ごとの作り込みになる
   ——顧客に「共通部分はそのまま、あなたの業務の画面だけ作ります」と説明できる

### 13-3. rev3 §0-2 の対応表に足す 1 行（rev3 は別 architect の担当。**本設計では触らない。申し送りのみ**）

| 層 | デモで使うもの | 本番で置き換わるもの | 置き換えの境目 |
|---|---|---|---|
| 業種切替 | `.mockbar` の業種チップ 3 つ | **無い**（1 社 1 ポータル） | `.mockbar` を消し、`pstate.ind` を 1 つに固定する。**DB のスキーマは変わらない** |

### 13-4. `CLAUDE.md` の改定は不要（確認結果）

- §2-3 の「共通レイヤーの契約」は**カタログの `state` の話**で、ポータルの `pstate` は対象外。
  `pstate` のキー名は 1 つも増減しない（§4-2）
- §2-6 の `localStorage` 許可集合（`mock.lang` / `mock.theme` / `mock.fav`）は**変えない**。業種は保存しない
- §2-7 の `st` の値域・§2-11 の管理番号・§2-9 の「差し替えはデータ層だけ」も満たす
- §2-13 の「新しい名前・数字はまずマスタへ」は PR-0 で先に満たす
- §2-14 の `portal/`（⑤）は**触らない**

**したがって `CLAUDE.md` は 1 バイトも変えない。**

---

## §14 検証

### 14-1. `tools/verify.mjs` §17 の改訂点（枝番ごと）

| 枝番 | いまの検査 | rev4 | PR |
|---|---|---|---|
| 17-a | `<script src>` の順・本数 | **改訂不要。**新しいデータファイルを作らない（既存 7 本に定数を足すだけ） | — |
| 17-b | インライン `<script>`/`<style>` 0・`<link>` 2 本 | **改訂不要** | — |
| **17-c** | `place` の値域＝`PSCREENS` の id ／ `'*'` ／ `'out'`。キー無しは warn | **改訂。**① 文字列のときは **`svc.industries` のすべての業種で見える画面** であること（例：`'qual'` を `industries: ['mfg','fin']` のサービスに付けたら FAIL）② オブジェクトのときは **キー集合が `svc.industries` と過不足なく一致**し、各値がその業種で見える画面 id ／ `'*'` ／ `'out'` ③ 値域外・キー不一致は FAIL、キー自体が無いものは warn（現状 0 件） | PR-E |
| 17-d | `portal.css` の色の直値・未定義 `var()` | **改訂不要**（新しい CSS を書かない） | — |
| **17-e** | `PT` と `js/data/portal/**` の `{ja:…}` が 3 言語 | **改訂。**`PORTAL_ONLY_KEYS` に **`PCOMPANY` / `PPART` / `PQUAL` / `PORDER` / `PCRED` / `PREG`** を足し、`PCUST` を外す（改名）。`PCOMPANY[].site` / `[].scope` が 3 言語であることが新たに掛かる | PR-B / PR-C / PR-D |
| 17-f | `mock.*` が許可集合の部分集合 | **改訂不要**（業種は保存しない） | — |
| **17-g** | `PSVC`/`PSTAGE_AI`/`newai` の id 実在・`PCTXDEF` のキー・`POUT` と `place:'out'` の一致 | **改訂不要。**`POUT` が空・`place:'out'` が 0 件でも現行ロジックで PASS する。`PCTXDEF` の 4 キー追加も現行チェックを通る。**ただし `PPART[].ai` / `PQUAL[].ai` などに書いた id の実在検査を足す**（17-g に 1 ブロック追加） | PR-C / PR-D |
| 17-h | `mockbar`・`langSel`・`themeBtn` の存在 | **改訂不要** | — |
| 17-i | `PSVC` が `st`/`name`/`cat` を持たない | **改訂不要** | — |
| 17-j | 生 URL が無い | **改訂不要** | — |
| **17-k** | `PWORLD` のキー ＝ `PDEALS[].cu`、`clients.csv` の `ref_world` と矛盾しない | **改訂不要**（`PDEALS` も `PWORLD` も IT 専用のまま）。**コメントを 1 行だけ更新**（「`proj` は IT 専用画面」） | PR-B |
| **17-l** | ① `demo.js` に `pstate.ind` が無い ② `pscreenAiIds`/`pcrossAiIds` に `industries` が**無い** | **①は維持。②は撤回し、逆向きに置き換える**：両関数の本体が **`industries` を参照する**こと（規則 1' の担保）。**さらに `pscn()` の本体に `pstate.ind` が現れないことを足す**（業種の解決は `pworldOf()` 1 か所。規則 3 の担保） | PR-E / PR-F |
| **17-m**（新） | — | `PSCREENS[].ind` の値が `INDUSTRIES` の id のみ／省略＝全業種／**`home` と `ai` はすべての業種で見える**／`PSCREENS[].id` ごとに `V[id]` が `js/portal/render.js` に定義されている／`lbl` の値が `PT` に存在するキー | PR-A |
| **17-n**（新） | — | 業種別の行データ定数（`{mfg,fin,it}` の形をしたもの）について、**`PSCREENS` でその業種に見える画面の定数は、その業種のキーを持ち、配列なら長さ 1 以上**。見えない業種のキーは無くてよい（`PSYS` に `fin` が無いのは正） | PR-B |
| **17-o**（新） | — | `PCOMPANY` のキーが `INDUSTRIES` の id と過不足なく一致し、各業種に `av`（2 文字）・`fy`・`site`（3 言語）・`scope`（3 言語）・`staleBefore`（`YYYY-MM-DD`）がある。**`mock/js/data/home.js` の `FEED[業種].persona` が 3 業種とも存在する** | PR-B |
| **17-p**（新） | — | **世界の混ざりの検出**：`mock/js/data/portal/**` の `.mfg` の中に `碧洋銀行`・`翠雲システムズ`・`上海本部` が現れない／`.fin` の中に `青嶺精工`・`翠雲システムズ`・`蘇州工場` が現れない（`.it` は `ref_world` の例外があるので検査しない）。社名は `INDUSTRIES[].wordmark.ja` から取り、tools に業種をハードコードしない（#251） | PR-B |
| **17-q**（新） | — | `PPART[ind].head.length === rows[].cells.length + 1`（`calc` を持つ業種は skip）。`PQUAL`/`PORDER`/`PCRED`/`PREG` も `head.length === rows[i].length` | PR-C / PR-D |

### 14-2. `tools/regress.mjs`

```js
/* 現行（129 行目付近）— place がオブジェクトになると常に不一致になる */
if (bs.place !== s.place) diffs.push(`SVCS.${s.id} place: …`);
/* rev4 */
if (JSON.stringify(bs.place) !== JSON.stringify(s.place)) diffs.push(`SVCS.${s.id} place: …`);
```

`snapshot.svcs[].place` はそのまま（オブジェクトは JSON にそのまま入る）。
**基準更新は PR-E で 1 回だけ**（`node tools/regress.mjs --update`）。PR 本文に
「設計書 `2026-09-12-portal-industry-rev4.md` §11-2 のデータ変更に伴う基準更新」と書く。
**差分は `SVCS.<id> place: … → …` の 27 行だけ。`counts` は 1 つも変わらない。**

### 14-3. Playwright（`run:cloud`。reviewer が回す）

| # | 何を |
|---|---|
| **P-1** | **3 業種 × 全画面 × 3 言語 × 2 テーマ** で `console` の error / warning が **0**。組み合わせは 製造 17 ＋ 金融 16 ＋ IT 16 ＝ 49 画面 × 3 × 2 ＝ **294 通り** |
| **P-2** | 各画面の**行数**が §7〜§10 の表と一致する（`tbody tr` の数を数える）。例：製造 `qual` = 8 ＋ 4、金融 `reg` = 10 ＋ 4、製造 `sys` = 6 |
| **P-3** | **ナビの枚数**が 製造 17 / 金融 16 / IT 16。金融に `sys` が無い。製造に `proj` が無い |
| **P-4** | 「この画面の AI」のボタン数が §11-3 の表と一致する（49 マス）。**0 本の 11 マスで `PT.noScreenAi` が出る** |
| **P-5** | 業種チップを製造 → 金融 → IT → 製造 と回したあと、**製造の画面に金融の語（碧洋銀行・甲社・稟議）が 1 つも出ない**（`document.body.innerText` を正規表現で検査） |
| **P-6** | 業種を替えても `mock.lang` / `mock.theme` 以外の `localStorage` キーが増えない |
| **P-7** | `cust` で行に AI の戻りを残す → 業種を替える → 戻すと**戻りが残っている**（§4-4） |
| **P-8** | 狭幅 400px は §15-3（既知の制限）のまま。**新画面でも同じ扱い**（直さない） |

### 14-4. そのほか

- `node tools/verify.mjs` / `node tools/regress.mjs` / `npm test` が PASS
- `npm run world` の warn が **12 件のまま**（増えない・減らない）
- `npm run index`（`docs/service-map.md`）は **`place` を出力していないので再生成不要**。
  ただし **PR-E の前後で `docs/service-map.md` に差分が出ないこと**を reviewer が確認する
- `npm run portal:test` は**回さない**（`portal/**` に触らないため。`CLAUDE.md` §2-14）

---

## §15 PR 分割

### 15-1. 7 本（マスタ先行 1 ＋ モック 6）

| PR | 題 | 触るファイル | 大きさ | 前提 |
|---|---|---|---|---|
| **PR-0** | 世界マスタへの追加（49 行） | `data/world/mfg/{records,partner_contacts}.csv`（新）・`data/world/mfg/calendar.md`・`data/world/fin/{notices,credit_cases,client_contacts}.csv`（新）・`data/world/fin/vendors.csv`・`data/world/README.md` | **M** | なし |
| **PR-A** | 画面台帳の業種化＋ナビ絞り込み＋新 4 画面の殻 | `mock/js/data/portal/ui.js`・`mock/js/portal/render.js`・`tools/verify.mjs`（17-c 骨格 / 17-m） | **S** | なし |
| **PR-B** | 行データ 23 定数の業種化＋`PCOMPANY`＋`pd()`＋`pstate`＋業種チップで `renderAll()`＋`INDUSTRIES.mfg.dept` | `mock/js/data/ui.js`・`mock/js/data/portal/{org,front,common,mgmt,back,sys}.js`・`mock/js/portal/{app,render,events}.js`・`tools/verify.mjs`（17-e / 17-n / 17-o / 17-p） | **L** | PR-0・PR-A |
| **PR-C** | `cust` を「取引先」へ（`PPART`/`PQTR`/`PCONTACT`/`PHIST`） | `mock/js/data/portal/{front,mgmt}.js`・`mock/js/portal/render.js`（`V.cust`）・`tools/verify.mjs`（17-q） | **M** | PR-B |
| **PR-D** | 新画面 4 枚の中身（`PQUAL`/`PORDER`/`PCRED`/`PREG`・`PCTXDEF` 4 キー・`PT` 14 キー） | `mock/js/data/portal/{front,svc,ui}.js`・`mock/js/portal/render.js`（`V.qual`/`V.order`/`V.cred`/`V.reg`） | **M** | PR-B |
| **PR-E** | `place` 27 件＋オブジェクト形 4 件＋規則 1 撤回＋`V.ai` 作り直し＋`POUT` 空 | `mock/js/data/catalog.js`・`mock/js/data/portal/svc.js`・`mock/js/portal/{app,render}.js`・`tools/verify.mjs`（17-c / 17-l）・`tools/regress.mjs`・`tools/regress.baseline.json` | **M** | PR-A・PR-D |
| **PR-F** | `pworldOf` の fallback＋規則 5・6 の文言＋`.mockbar` の `indNote` | `mock/js/portal/{app,demo}.js`・`mock/js/data/portal/ui.js`・`mock/portal.html`・`tools/verify.mjs`（17-l 後半） | **S** | PR-D・PR-E |

```
PR-0 ──> PR-A ──> PR-B ──┬──> PR-C ──┐
                          └──> PR-D ──┴──> PR-E ──> PR-F
                          （C と D は並列可。V.cust と V.qual/order/cred/reg は別関数）
```

- **PR-B が最大**（`mock/js/data/portal/**` のほぼ全ファイル）。**他と並列にしない**
- **`tools/verify.mjs` を触る PR（A・B・C・D・E・F）はすべて直列**（`CLAUDE.md` §5）。
  したがって実質的に並列できるのは **PR-C と PR-D のデータ部分だけ**で、
  片方が verify を先に入れたらもう片方は rebase する。**迷ったら全部直列で構わない**
- **`portal/**` には触らない。**`npm run portal:test` を回す PR はゼロ

### 15-2. 並行している作業との衝突

| 並行 | ファイル集合 | 判定 |
|---|---|---|
| **指標 3 言語化（#292 PR-1・#294 PR-2）** | `data/world/it/{knowledge_categories,kpi_topics,goal_topics}.csv`・`portal/**`・`tools/verify.mjs` §19 | **マージ済み。衝突しない。**ただし **§19-c が `PKNOW` / `PKPITOPIC` / `PGOAL.topics` のバイト一致を見ている**ので、**この 3 定数を業種化しない**という制約が rev4 に掛かる（§7-1） |
| **LG-01（#296）** | `mock/js/data/scenarios/mfg/lg.js`・`docs/service-map.md`・`docs/dify/usecases/LG-01.md` | **マージ済み（案 B）。`mock/js/data/catalog.js` は据え置きだったので衝突しない。**ただし LG-01 の台本は `template: 'form'` → `'upload'` になったので、製造ポータルのドロワーで LG-01 を開くと**アップロード型のテンプレート**が出る（`TEMPLATES` 5 種のまま。PR-F の目視確認に入れる） |
| **ポータルの見え方の修正（#297）** | `mock/css/portal.css`・`mock/js/data/portal/ui.js`（`PT` に 2 キー）・`mock/js/portal/{app,render,events}.js`（`pstate.mockbar`・sticky・帯の折りたたみ） | **マージ済み。**rev4 が業種化する 23 定数には触っていない。**`pstate.mockbar` は rev4 でも触らない**（§4-2 の「キー名を増減しない」は rev4 自身の変更についての宣言であり、#297 が足したキーはそのまま残す）。`.mockbar` に `PT.indNote` を 1 行足す PR-F は、**折りたたんだ状態でも壊れないこと**を確認する |
| **rev3（NocoBase 本番設計）** | `docs/handoff/2026-09-10-portal-nocobase.md` | **触らない。**§13-3 の 1 行は申し送りのみ |

---

## §16 受け入れ条件

### 16-1. PR-0（世界マスタ）

- **AC-01** 新 CSV 5 本が §6-2〜§6-6 の**ヘッダ・行数・本文と完全一致**（製造 19＋6、金融 10＋7＋5）。
  `data/world/fin/vendors.csv` は **2 行追記のみ**で既存 1 行に差分ゼロ
- **AC-02** どのフィールドにも **ASCII の `,` と `"` が無い**。全ファイルが LF 終端
- **AC-03** 新しく登場する**識別子の書式がすべて `calendar.md` に登録済み**
  （`NC-` `CL-` `ECR-` `TR-` `8D-` `CAR-` `RFQ-` `SO-` `INV-` `RT-` `NTF-` `CRD-` `RNG-`）。
  `data/world/mfg/calendar.md` の追記は **会計年度の 2 行だけ**
- **AC-04** 人名の**姓が既存 42 名（mfg 20・fin 17・it 5）と重複しない**（何・松本・袁・崔・邱・岡野・石川・段・顧・郭・賀）
- **AC-05** `npm run world` の warn が **12 件のまま**。`data/world/README.md` の「未統一」は 1 行も増減しない
- **AC-06** `npm test` PASS。`mock/**` に差分ゼロ

### 16-2. PR-A（画面台帳）

- **AC-07** `PSCREENS` が 20 件。`ind` の集合が §3-1 のとおり。`watch`・`vend` の `grp` が `gCommon`
- **AC-08** ナビの枚数が 製造 17 / 金融 16 / IT 16。金融に `sys` が出ない
- **AC-09** `PT` に `qual`/`order`/`cred`/`reg`/`sysMfg`/`noScreenAi`/`noCrossAi`/`indNote` の 8 キーが
  **ja/zh/en すべて**入っている。`cust` が「取引先／交易对象／Business partners」に変わっている
- **AC-10** 新 4 画面が**見出しと「この画面の AI」ブロックだけ**で描画され、console error 0
- **AC-11** verify §17-m が入り、`node tools/verify.mjs` PASS

### 16-3. PR-B（行データの業種化）

- **AC-12** 23 定数が `{mfg,fin,it}` の形。**`.it` の中身が `origin/main` の同名定数と要素単位で一致**（§7-4）
- **AC-13** `PKNOW` / `PKPITOPIC` / `PGOAL.topics` の **diff がゼロ**。`node tools/verify.mjs` §19 が PASS
- **AC-14** `PCOMPANY` が §5-2 のとおり。`PORG.persona` が消え、`PT.org`/`PT.site`/`PT.role` が消えている
- **AC-15** `INDUSTRIES.mfg.dept` が「製造二課／制造二科／Manufacturing Section 2」。**`regress` に差分ゼロ**
  （`snapshot.industries` は id しか持たないため）
- **AC-16** 業種チップで `renderAll()` が走り、**会社名・部門名・拠点・ログイン中の人・ナビ・全画面**が替わる
- **AC-17** 業種を替えて戻すと、**残した AI の戻りと To Do 候補の採否が復元される**（§4-4）
- **AC-18** 製造の画面に金融・IT の語が 1 つも出ない（verify §17-p ＋ Playwright P-5）
- **AC-19** `localStorage` のキーが `mock.lang` / `mock.theme` の 2 つのまま

### 16-4. PR-C（取引先）

- **AC-20** 3 業種で `cust` が描画され、行数が 製造 3 / 金融 5 / IT 4。担当者が 6 / 5 / 6
- **AC-21** 四半期表の見出しが業種で替わる（売上・百万円・FY2025 ／ 貸出残高・億元・FY2026 ／ 売上・百万円・FY2026）。
  **金融の Q2 実績合計 312.1 億元が `data/world/fin/kpi.csv` の `loan_balance` 31,200 百万元と一致**
- **AC-22** IT の `cust` の見え方が `origin/main` と**同じ**（列・行・数字・注記。改名以外の差分ゼロ）
- **AC-23** 社名を押すと担当者が絞られる／チップが効く（3 業種とも）

### 16-5. PR-D（新画面 4 枚）

- **AC-24** 4 画面の行数が 製造 `qual` 8＋4・`order` 5＋2、金融 `cred` 7・`reg` 10＋4
- **AC-25** タイルの数字が §9 のとおりで、`data/world/**/kpi.csv` の値と矛盾しない
  （不良率 0.42%・稟議処理日数 6.2 日・与信先数 405・当局報告件数 14 件）
- **AC-26** 行から AI を押すとドロワーが開き、**`PCTXDEF` の列がラベル付きで出る**（3 言語）
- **AC-27** `mock/css/portal.css` の diff が**ゼロ**（新しいクラスを足していない）
- **AC-28** `mock/js/data/scenarios/**` の diff が**ゼロ**

### 16-6. PR-E（`place`）

- **AC-29** `mock/js/data/catalog.js` の diff が **`place:` の 27 行だけ**。`CATS` と他フィールドに差分ゼロ
- **AC-30** `regress` の差分が `SVCS.<id> place:` の **27 行だけ**。`counts` は 1 つも変わらない。
  PR 本文に「設計書 §11-2 のデータ変更に伴う基準更新」と書いてある
- **AC-31** 「この画面の AI」の件数が **§11-3 の表と 49 マスすべて一致**
- **AC-32** **0 本の 11 マスで `PT.noScreenAi`（ホームは `PT.noCrossAi`）が出る**
- **AC-33** `verify` の warn から「置き場所を決めていない」が出ない（未配置 0）。`POUT` が空で PASS
- **AC-34** `V.ai` に「カタログに IT 業種はまだありません」「置き場所を決めていない 21 件」が**残っていない**
- **AC-35** `docs/service-map.md` に差分が出ない

### 16-7. PR-F（台本）

- **AC-36** `js/portal/app.js` の `pworldOf()` が `|| pstate.ind`。**`pscn()` と `demo.js` に `pstate.ind` が 1 つも無い**
- **AC-37** 製造ポータルの `qual` 行から QA-01 を開くと**製造の台本**が出て、**代用バナーが出ない**
- **AC-38** 金融ポータルの `cred` 行から CV-03 を開くと**金融の台本**が出て、代用バナーが出ない
- **AC-39** 製造ポータルの `trn` 行から PO-01（台本は製造）→ バナー無し。
  IT ポータルの `trn` 行から PO-01 → **`PT.scriptWorldPlain` が出る**（IT に台本が無いため）
- **AC-40** `.mockbar` の業種チップの下に `PT.indNote` が 1 行出る（3 言語）。**帯を折りたたんでも（#297）レイアウトが壊れない**
- **AC-40b** 製造ポータルで LG-01 を開くと、#296 で `upload` 型になった台本がアップロードのテンプレートで再生される

### 16-8. 全 PR 共通

- **AC-41** `node tools/verify.mjs` / `node tools/regress.mjs` / `npm test` が PASS
- **AC-42** `npm run world` の warn が 12 件のまま
- **AC-43** `mock/css/tokens.css` の diff がゼロ。`--ntt-*` も dark ブロックも触っていない
- **AC-44** `portal/**`・`dify/**`・`.github/workflows/**`・`CLAUDE.md`・`.claude/**` の diff がゼロ
- **AC-45** 実名・実在製品名・生 URL がゼロ（verify §17-j）
- **AC-46** Playwright P-1〜P-8（§14-3）が通る

---

## §17 残課題（rev4 の外・別 Issue を提案する）

| # | 論点 | 提案 |
|---|---|---|
| **R-1** | **IT の `PCONTACT` 6 名は `data/world/{mfg,fin}/people.csv` の人物**（王 磊・佐藤 美咲・劉 洋・森下 隆一・高梨 直人・陳 慧）である。`CLAUDE.md` §2-13 の跨ぎの例外は **「社名と拠点名に限って」**であり、**人は跨がない**と書いてある。**いまの `mock/js/data/portal/front.js` はこの境界を越えている**（`V.cust` の注記が自分でそう書いている） | **rev4 では直さない**（rev4 が作った問題ではなく、直すと PM 承認済みの IT 画面の見え方が変わる）。**別 Issue**で「IT の取引先担当者を `data/world/it/client_contacts.csv` として新設し、α 社・β 社の担当者に置き換えるか、§2-13 の例外を人にも広げるか」を PM に諮る |
| **R-2** | `data/world/mfg/calendar.md` の**世界の「今日」は 2025-09 前後**だが、`pt.js`（PT-01〜08）は 2026 年の日付を持つ（既知の未統一 ①〜⑩ とは別の記述）。製造ポータルは **2025-09-12** に揃えたので、`watch` の PT-02・PT-03 や `vend` の PT-06・PT-07 の台本を開くと**台本の中だけ 2026 年**になる | **rev4 では直さない**（台本は 1 バイトも触らない）。`data/world/README.md` の「未統一」に既に記載済み |
| **R-3** | `goal`（目標）が 3 業種とも AI 0 本 | **カタログ側の穴**。`PT.noScreenAi` で見えるようにするところまでが rev4 の仕事。埋めるなら新サービスの採番（別 Issue） |
| **R-4** | `LG-01` / `GN-05` の `industries` が `['mfg']` のため、金融・IT のホームに横断 AI が 0 本 | **カタログ側の判断**（§11-4 の申し送り）。rev4 では `industries` を触らない |

**PM 判断待ちはゼロ。**(a)(b)・Q1〜Q4 はすべて PM が決定済みで、本書はその決定の範囲内に収まっている。
R-1〜R-4 は**本件をマージする条件ではない**（別 Issue の候補として記録する）。
