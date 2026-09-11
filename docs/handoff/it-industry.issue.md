# AI エージェントカタログに 3 つ目の業種「IT 業」を足す

設計書: `docs/handoff/2026-09-11-it-industry.md`
レーン: **M/L** ／ ラベル: `run:cloud` ／ 関連: #242（社内ポータル NocoBase）・#120（金融版カタログ）

---

## 背景

社内ポータルの概念モック（#242）で各画面に AI サービスを配置していったところ、次が分かった。

- カタログ 67 件のうち、**自部門（IT 業）の画面に載るのは 49 件**。残り 18 件は顧客自身の業務（製造現場・金融窓口・図面・BOM）
- その 49 件は**製造業・金融業向けに作ったサービスを流用している状態**。自部門は IT 業なのに、カタログに IT 業が無い
- **カタログがカバーしていない自部門固有の業務が 10 件**見つかった

IT 業を足すと ①ポータルが何を使っているか業種で説明できる ②自部門固有のユースケースに置き場所ができる ③無理な流用がなくなる、の 3 つが同時に片付く。

IT 業の世界は**架空の日系 SIer の中国拠点（上海）ソリューション本部**。**その顧客が青嶺精工（`mfg`）と碧洋銀行（`fin`）**という関係になる。

---

## 決めたこと（設計書 §0）

| 問い | 結論 |
|---|---|
| **分類** | **新設は 1 分類だけ** `sl` 営業・案件管理（IT 専用）。ほかの 7 件は既存分類に寄せ、**新中分類を 3 つ**（`kn/ops`・`po/staff`＋`sl` の 2 つ）。**13 分類 29 中分類 → 14 分類 33 中分類** |
| `cv` を IT に広げるか | **広げない。** 名称も中分類 2 つ（`credit` 審査・与信／`kyc`）も銀行固有で、広げると名称が嘘になる。金融が 5 分類を新設した #120 と同じ型にする |
| **既存 49 件** | **(A) `industries` に `'it'` を足す。** (B) 別サービスとして起こすと**管理番号が 49 個増え、`docs/dify/usecases` が 49 本・DSL が 49 本増える**。これは「マスタ DSL 1 本を env で配る」（`CLAUDE.md` §2-12）に真っ向から反する |
| **⚠️ (A) の懸念は事実ではない** | 「IT 業で開くと青嶺精工の台本が出る」は**成り立たない**。`SCENARIOS` は業種キー（`SCENARIOS[industry][id]`、`scenarios/<業種>/<分類>.js`）で、IT に台本が無ければ `start` は**世界の語を 1 つも含まない汎用チャット**にフォールバックする（設計書 §3-1 に根拠コード） |
| **台本の本数** | **第 1 弾は 10 本**（IT 固有の新サービス）。既存側は最大 49 本を後続で。**合計最大 59 本**（各 ja/zh）。`SCENARIOS.it` が無いうちは verify の warn も 0 件なので、**段階を切れる** |
| **世界の跨ぎ** | **社名と拠点名だけ跨ぐ。人・部署・品番・設備・KPI・文書番号は跨がない。逆流禁止。** `clients.csv` に `ref_world` 列。`check-world.mjs` は `it` バケットの W1（社名）/W5（拠点）だけ許可集合を和集合にする |
| **成熟度** | 新規 10 件は**すべて `st: 3`（構想）**。実装リファレンスが書けたら 2、DSL 投入＋テスト PASS で 1 |
| **数の変化** | 67 → **77 サービス**（製造 49／金融 29／IT 21）、13 → **14 分類**、29 → **33 中分類**、タグ 57 → **64**、構想 26 → **36** |

---

## ⚠️ 先に決めてほしいこと（3 つ。PR-1 着手前）

### ① IT 業の会社名（3 言語）

**「N 社」を正式社名にしない。** `mfg` の取引先記号（`K 社`・`S 社`・`A 社`）と**同じ形**なので、読者が「どこかの取引先」と誤読する。青嶺精工・碧洋銀行と同じく固有名を与える。

| | ja | zh | en |
|---|---|---|---|
| **A（推奨）** | 翠雲システムズ株式会社 | 翠云系统股份有限公司 | Suiun Systems, Ltd. |
| B | 黎星システムズ株式会社 | 黎星系统股份有限公司 | Reisei Systems, Ltd. |
| C | 明澄システムズ株式会社 | 明澄系统股份有限公司 | Meicho Systems, Ltd. |

**本環境から実在名との衝突を調査できない。** `fin` が「瑞央 → 碧洋」を PM 判断で差し替えた前例（`docs/handoff/2026-09-08-finance-catalog.md` §9 #4）と同じ扱いにしたい。

### ② 人物 5 名のうち 4 名の改名（1 名は**完全衝突**）—— **決定済み（PM 2026-09-11）**

ポータルのモックで使っている 5 名を既存 37 名（mfg 20・fin 17）と突き合わせた結果：

| ポータルの名前 | 判定 | **確定（PM 2026-09-11）** |
|---|---|---|
| **高橋 亮** | **✗ 完全衝突。`data/world/mfg/people.csv` に `takahashi-ryo,高橋 亮,Ryo Takahashi` が既にいる** | **篠崎 悠真 / 筱崎悠真 / Yuma Shinozaki**（zh は簡体字。`篠` → `筱`。既存の `高桥亮`・`渡边克彦` と体系を揃える） |
| 李 婷 | ⚠ 名「婷」が既に 2 人（呉 婷・潘 婷） | **黄 思涵 / 黄思涵 / Huang Sihan** |
| 周 建国 | ⚠ 名「建国」が既に 2 人（馮 建国・楊 建国） | **蔡 文博 / 蔡文博 / Cai Wenbo** |
| 村井 拓也 | ✓ 問題なし | **村井 拓也 / 村井拓也 / Takuya Murai**（そのまま） |
| 石田 真希 | ⚠ 姓「石田」が `fin` にいる（石田 由美） | **岸本 奈津 / 岸本奈津 / Natsu Kishimoto** |

**IT 世界は 3 つの世界の登場人物が同じ画面に出る唯一の世界**なので、「建国さん」「婷さん」が 3 人ずついるとデモの口頭説明で実害が出る。確定 5 名は**姓・名とも既存 37 名と重複が無い**。正本は設計書 §3-4-1 の確定表。

> **（記録）PM 判断前の仮案 —— 採用しない。** 本節には当初 **藤井 亮 / 李 雯 / 周 建偉 / 村井 拓也 / 島田 真希** という推奨が書かれていた。**PM 判断前の仮案。2026-09-11 に PM が確定（篠崎／黄／蔡／村井／岸本）。既存 37 名と姓名の完全一致なし。** `data/world/it/people.csv`・台本・ポータルに仮案の名前を書かないこと（PR #255 で混入し差し戻した）。

### ③ 取引先記号 `C 社`・`D 社`・`S 社`・`T 社`・`U 社` は**使えない**

| 記号 | 判定 |
|---|---|
| `S 社` | **✗ `mfg/partners.csv` で使用中**（材料・塗装外注）。**製造台本に 51 回出る** |
| `T 社` | **✗ 使用中**（材料・工程の代替候補）。**台本に 43 回** |
| `U 社` | **✗ 使用中**（代替鋼板供給者） |
| `C 社`・`D 社` | ⚠ 未使用だが**ラテン大文字＋社は `mfg` の名前空間**（`K`/`S`/`T`/`W`/`A`/`B`/`U`/`V`/`J`）。どの世界の取引先か判別できない |

**提案：IT は第 3 の体系＝ギリシャ文字（`α 社`・`β 社`・`γ 社`）。** ja・zh・en のどれでも通り、`fin` の十干（`甲社`）とも `mfg` のラテン文字とも形が違い、`check-world.mjs` の `CANDIDATE_RE` に引っかからない。

**①②③ はポータル側（`docs/portal-nocobase-rev2` ブランチ）にも反映が要ります。**`data/world/it/` の正本は本リポジトリが持つので、ポータル側は参照するだけになります（方向は現リポ → 新リポの片方向のみ）。

---

## やること（PR 分割。**直列**。`catalog.js`・`home.js`・`regress.baseline.json` が重なる）

| PR | 題 | 主なファイル | 触らない | 大きさ |
|---|---|---|---|---|
| **PR-1** | 業種 `it` の足場と架空世界マスタ | `js/data/ui.js`（`INDUSTRIES` 1 件）・`js/data/style.js`（`IND_LOGO.it`）・`js/app.js`（`state.fav.it`）・`tools/verify.mjs`（`INDUSTRY_ORDER`・§16-c のハードコード）・`tools/regress.mjs`（`svcsIt`/`catsIt`・検算式）・`tools/gen-index.mjs`（`①台本(IT)` 列）・`regress.baseline.json`・`docs/service-map.md`・**`data/world/it/**` 8 ファイル**・`data/world/README.md` | `catalog.js`・`home.js`・`render.js`・`events.js`・`css/**`・`check-world.mjs` | 中 |
| **PR-2** | 既存 11 件を IT に開放（**ここで IT タブが押せる**） | `js/data/catalog.js`（`industries` 22 か所）・`js/data/home.js`（`HOME.it`・`FEED.it`）・`regress.baseline.json`・`docs/service-map.md` | `ui.js`・`style.js`・`css/**`・`tools/**` | 中 |
| **PR-3** | IT 固有 10 サービス ＋ 分類 `sl` ＋ 中分類 2 ＋ タグ 7 ＋ 色 | `js/data/catalog.js`・`js/data/ui.js`（`TAGS` 7）・`js/data/style.js`（`CAT_STYLE.sl`）・`css/tokens.css`（`--cat-sl` light/dark）・`js/data/home.js`・`regress.baseline.json`・`docs/service-map.md` | `components.css`・`render.js`・`events.js`・`tokens.css` の `--ntt-*` | **大** |
| **PR-4** | IT 台本 10 本 ＋ `check-world.mjs` の `it` バケット | `js/data/scenarios/it/{sl,kn,po,gn,dc}.js`（新規 5）・`catalog.html`（`<script src>` 5 行）・`tools/check-world.mjs`・`data/world/README.md` | `js/data/*.js`・`regress.baseline.json`（**`--update` 不要**） | 大 |
| **PR-5** | ポータルの 49 件のうち残りを IT に開放 | `js/data/catalog.js`・`regress.baseline.json`・`docs/service-map.md` | — | **id 一覧を受け取るまで着手しない** |
| **PR-6** | 文書の件数更新 | `README.md`・**`CLAUDE.md` §2-3・§2-13・§6（PM 承認後）**・`docs/demo/*.md`・`docs/dify/usecases/README.md`・`docs/handoff/service-index.md` | `mock/**`・`tools/**`・`data/world/**` | 小 |

**PR-1 と PR-2 を分ける理由**：PR-1 は検査の道具（`tools/**`）を変えるので単独で見たい。PR-1 だけでも `npm test` が PASS し、IT ボタンが disabled で出るだけで壊れない。

---

## 受け入れ条件

### 全 PR 共通
- `npm test` が **ALL PASS**（`node tools/verify.mjs && node tools/regress.mjs`）
- `npm run index` 実行済み（verify §11 の鮮度検査 PASS）
- `regress --update` した PR は本文に「設計書 §5 のデータ変更に伴う基準更新」と書く
- PR 本文に：設計書パス・変更要約・`npm test` の集計行・**warn 件数の変化**・触っていない範囲

### PR ごと
- **PR-1**：verify §1 が `INDUSTRIES=3`／regress が `業種別 svcs: mfg=49 fin=29 it=0 ／ 重複を除いた合計 = 67（svcs=67）`／`docs/service-map.md` に `①台本(IT)` 列／**`npm run world` の warn が 11 件のまま不変**／IT ボタンが disabled で見える
- **PR-2**：regress が `… it=11 ／ 重複を除いた合計 = 67（svcs=67）`／verify §9 の**「業種 "it" で台本の無い SVCS」warn が出ない**（`SCENARIOS.it` が無いため）／verify §10 が `HOME.it`/`FEED.it` を PASS／IT で `DC-02` を `start` すると **`chat` にフォールバックし、青嶺精工・碧洋銀行の語が 1 つも出ない**
- **PR-3**：regress が `cats:14 subs:33 svcs:77 tags:64`／`… it=21 ／ 重複を除いた合計 = 77（svcs=77）`／verify 5-b が `--cat-*` 14 個 × light/dark 対称を PASS／`docs/service-map.md` に `SL-01`〜`SL-03`・`KN-09`・`KN-10`・`PO-05`〜`PO-07`・`GN-08`・`DC-10` の 10 行（③列は `—`）／**`mfg`・`fin` で見える件数が 1 件も変わらない**
- **PR-4**：verify §9-A が `scenarios/it/*.js` を PASS／verify §9 の warn が「業種 "it" で台本の無い SVCS **11 件**: kn4, kn5, dc2, dc8, gn6, gn7, po1, po2, po3, po4, eg1」（**想定内**）／**regress が `--update` 無しで PASS**／`check-world.mjs` が `[it]` を出力し**跨ぎ（青嶺精工・碧洋銀行・蘇州工場・上海本部）を warn にしない**／**`[mfg]`・`[fin]` の warn が 11 件のまま不変**（逆流していない証拠）
- **PR-6**：`grep -rn "67 サービス\|13 分類\|29 中分類" README.md CLAUDE.md docs/` が 0 件（生成物 `docs/service-map.md` を除く）

### PM のモック承認（人が見る）
1. 業種セグメントが **製造 / 金融 / IT** の 3 つ（日・中・英で折り返さない）
2. IT に切り替えるとヘッダーの社名とロゴが入れ替わり、サイドバーが IT の分類だけになる
3. IT でお気に入りを付け、製造に戻しても混ざらない。リロードしても残る
4. 3 パターン（① ② ③）すべてで IT が破綻しない
5. `sl` の色（赤橙）が light・dark の両方で読める

---

## 触らない範囲（reviewer の diff 監査の基準）

全 PR 共通：

- **`mock/css/tokens.css` の `--ntt-*`**（ブランドパレット。§2-2）。PR-3 で足すのは `--cat-sl` / `--cat-sl-bg` のセマンティック 2 行のみ（**light・dark の両方**。片方だけだと verify 5-b が FAIL）
- **`mock/js/render.js` のパターン分岐**（§2-3）。業種セグメントは `INDUSTRIES` を回して描くので**描画コードの変更は不要**
- **`localStorage` の許可集合**（`mock.lang` / `mock.theme` / `mock.fav` の 3 つ。**4 つ目は作らない**。`mock.fav` は `INDUSTRIES` から業種キーを動的に検証しているので**移行コードも不要**、`state.fav` に `it: []` を足すだけ）
- **既存 `SVCS[].id` の改名**（§2-9・§2-11）。id は増えるだけ、欠番は作らない
- **`.github/workflows/pages.yml`**
- **`docs/handoff/2026-09-10-portal-nocobase.md`・`2026-09-11-nocobase-research.md`・`portal-nocobase.issue.md`**（別 architect が並行作業中）

---

## `CLAUDE.md` への変更提案（**PM 承認が要る**。設計書 §9-1 に文面）

| 節 | 変更 |
|---|---|
| **§2-3**（load-bearing） | `industry` は業種（`mfg`/`fin`）→ **（`mfg`/`fin`/`it`）**。併せて `scenarios/<分類>.js`（大分類ごと 8 ファイル）の記述が**既に実態とずれている**（現在は `scenarios/<業種>/<分類>.js` で mfg 10・fin 8）ので直すことを提案 |
| **§2-6**（load-bearing） | `mock.fav` の例示 `{mfg:[…], fin:[…]}` に `it` を足すだけ。**許可集合は 3 キーのまま変わらない** |
| **§2-13**（load-bearing） | **世界を跨ぐのは IT 世界だけ、かつ社名と拠点名だけ。人・部署・品番・設備・KPI・文書番号は跨がない。逆流禁止**、を 1 項目として追記 |
| **§6**（バックログ） | 「13 分類 29 中分類 67 サービス（製造 49／金融 29／両業種 11、提供中 12／試行版 29／構想 26）」→「**14 分類 33 中分類 77 サービス（製造 49／金融 29／IT 21、提供中 12／試行版 29／構想 36）**」 |

---

## 実機（Dify）

本 Issue では `dify/apps/`・`dify/kb/`・`dify/tests/` を**作らない**。作るときは別 Issue・`run:runner`。順番は設計書 §7-2。

**最初に作る 1 本の推奨：`KN-10`（規程と現場運用の食い違い検出）。** `diff` テンプレートで `KN-08` と構成が近く、KB が規程 3 本だけで足り、**IT 世界だけで完結して跨ぎの検証が要らない**。
