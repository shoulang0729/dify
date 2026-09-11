# BP の実装済み AI 製品 8 種をカタログとシナリオに取り込む（設計完了・実装待ち）

- **ラベル**：`run:cloud`
- **設計書**：[`docs/handoff/2026-09-11-bp-usecases.md`](./2026-09-11-bp-usecases.md)
- **レーン**：M/L（データ層 `CATS`/`SVCS`/`TAGS` に触る）
- **⚠️ 本 Issue の §7 は [`docs/handoff/2026-09-10-portal-nocobase.md`](./2026-09-10-portal-nocobase.md) の **rev4 の入力**です**（同設計書はこの Issue では 1 文字も触りません）

---

## 概要

BP（ビジネスパートナー。本リポジトリでは **`ζ 社`** と呼ぶ）が実装済みの AI 製品 8 種を、カタログ（14 分類 33 中分類 77 サービス）と照らし合わせ、**5 軸（分類・タグ・ペルソナ・入出力・出口）の一致数**で統廃合を判定しました。

| 判定 | 件数 | 内訳 |
|---|---|---|
| **統合**（新規採番しない） | **5** | LG-01（翻訳）／NM-05（ChatBI）／DC-02（議事録）／KN-09（個人 KB → チーム KB）／PT-05（履歴書スクリーニング） |
| **新規**（採番候補） | **1** | **DC-11 契約書レビュー（逸脱条項の検出と修正案）** |
| **対象外**（PM 判断 2026-09-11） | **2** | アパレルデザイン／採点 |
| **ポータルに取り込む**（PM 判断 2026-09-11） | **1** | AI ポータル。**特にコンテンツ監査と LLM ゲートウェイ** |

**カタログのデータ層で動くのは DC-11 の 1 件追加だけ**です。8 製品のうち 1 つも「カタログに BP 製品を並べる」形にしていません。カタログは「**どの業務ができるか**」の台帳であって、「**どの製品を買うか**」の台帳ではないためです。

---

## ★ 取り扱い注意（最優先）

出典は BP が出した**見積書（xlsx）**で、**実在ベンダの製品名・ドメイン・営業担当の実名と電話番号・価格**を含みます。**このリポジトリは public です。**

- **見積書そのものはリポジトリの外（PM のローカル）に置く**
- **リポジトリに書いてよいのは「機能の要約」だけ。** ベンダ名／製品名（ja・zh・en すべて）／ドメイン・URL／人名／電話番号／単価・小計・保守費・税率は、**設計書・Issue・PR 本文・コミットメッセージ・台本のどこにも 1 文字も書かない**（`CLAUDE.md` §2-10）
- **BP は記号 `ζ 社` で呼ぶ**。IT 世界（翠雲システムズ）の取引先記号はギリシャ文字で、`γ`・`δ`・`ε` が使用済みなので次は `ζ`（設計書 §6）

**reviewer は diff 監査でこれを機械的に確認すること**（受け入れ条件参照）。

---

## 「BP 実装済み」をカタログでどう表すか（設計の本体）

### 決めたこと

**`SVCS` に新フィールドも新タグも足さない。`docs/dify/build-or-buy.md`（新規 1 ファイル）を正本にし、各実装リファレンス `docs/dify/usecases/<XX-NN>.md` §10 から 1 行で指す。**

### 線引き

成熟度 `st`（1 提供中 / 2 試行版 / 3 構想）は「**我々の Dify 実機がどこまで動いているか**」を指す（`CLAUDE.md` §2-7）。`st: 1` が 12 件なのは `dify/apps/` の DSL 12 本と一致しているからで、`docs/service-map.md` の ②DSL 列・④テスト列がその証拠になっている。
**BP の製品が存在することは `st` を上げる理由にならない。** この線を動かすと `st: 1` の意味が「我々が動かせる」から「世の中に何かがある」に化ける。

### 4 案の比較（詳細は設計書 §3-2）

| 案 | 触るもの | 判定 |
|---|---|---|
| (a) `SVCS[].partner` の新フィールド | `catalog.js`・`verify.mjs`・`regress.mjs`・baseline・`render.js`・`T`・`components.css`・**`CLAUDE.md` §2-3（load-bearing）** | ✗ |
| (b) `TAGS` に「BP 実装あり」タグ | `ui.js`・`catalog.js`（5 件の `tags`）・baseline | ✗ |
| **(c) 実装リファレンス（`docs/dify/**`）に書く** | `docs/dify/**` のみ。**verify・regress ともに不変** | **✓ 推奨** |
| (d) PT（パートナー連携）の流儀に倣う | `CATS`・`SVCS`（5 件）・`TAGS`・`SCENARIOS` | ✗ |

**(a) を採らない主な理由**：`st` と直交する第 2 の軸を画面に出すと成熟度の意味が濁る／契約前の事実でデータ層と共通レイヤーを動かすのは早すぎる（流れたら巻き戻し）／`CLAUDE.md` §2-3 の変更に PM 承認が要る／**portal-mock-pages PR-2 が同じ `SVCS` の各要素に `place` を足し、同じ `regress.mjs` のスナップショットを触っている**。
**(d) を採らない理由**：PT は「パートナーが業務そのものを担う」サービス群。BP 製品は「我々のサービスを作る手段」。PT に並べると **LG-01 と 5 軸一致 5/5 のサービスが 2 つできる**（統廃合ルール違反）。

---

## 新規サービスの仕様（候補）

**DC-11 契約書レビュー（逸脱条項の検出と修正案）**

| 項目 | 値（候補） |
|---|---|
| 内部 id | `dc11` |
| 分類 / 中分類 | `dc` / `apply`（申請・契約・貿易） |
| 成熟度 `st` | **3（構想）** ← 我々の Dify 実機が無い |
| `industries` | `['mfg', 'fin', 'it']`（製造＝サプライヤー契約／金融＝融資契約／IT＝業務委託契約） |
| `tags` | `['contract', 'legal']`（`legal` は**新規 1 キー**。3 言語は設計書 §4-3） |
| テンプレート | `upload`（新テンプレートは増やさない） |

**`dc/apply` の `industries` を `['mfg']` → `['mfg','fin','it']` に広げる**必要があります（verify が `SVCS.industries ⊆ cat ∩ sub` を検査するため）。既存 3 件（DC-05・DC-06・DC-07）の `industries` は変えません。

**3 言語の `name`/`desc` 全文は設計書 §4-4 にあります。implementer はそれをそのまま転記してください（翻訳・言い換えをしない）。**

> **⚠️ 管理番号 DC-11 は PM 承認後に確定します**（`CLAUDE.md` §2-11：通番は永久欠番）。

---

## 変更前後の件数と id 一覧（reviewer が `regress.mjs` の差分と照合する）

| | 変更前 | 変更後 |
|---|---|---|
| 分類 `cats` | 14 | **14** |
| 中分類 `subs` | 33 | **33** |
| サービス `svcs` | 77 | **78** |
| タグ `tags` | 64 | **65** |
| UI キー `ui` | 91 | **91** |
| 成熟度 | 12 / 29 / 36 | 12 / 29 / **37** |
| 業種別 | mfg 49／fin 29／it 21 | **mfg 50／fin 30／it 22** |
| `svcsMulti` | 11 | **12** |

**追加 id：`dc11` の 1 件のみ。削除・改名・分類移動は 0 件。**

---

## ポータルへの取り込み（**portal-nocobase rev4 の入力**）

PM 判断により、AI ポータル製品は**ポータルに入れます**。設計書 §7 が rev4 の差分を決めています。**`2026-09-10-portal-nocobase.md` は本 Issue の PR では 1 文字も触りません。**

### 決めたこと（要約）

| 機能 | 持ち主 | 根拠 |
|---|---|---|
| **コンテンツ監査** | **ポータルの PostgreSQL**（`ai_audit_log` 新設） | rev3 §0-2 の「監査・履歴」行と同じ流儀（Audit logs は Enterprise+ なので自前）。**(a′) の呼び出しはポータルが本文を組み立てる**ので、ポータル側で記録すれば漏れが最小 |
| **LLM ゲートウェイ** | **Dify（Cloud → Enterprise）1 本のまま** | ポータルは LLM を直接叩かない（rev3 §14-5）。キー・利用量・モデル切替・国内モデルは既に `dify/env/<env>/env.yml` に集約済み。**GW をもう 1 段挟むと出口が 2 本になり、管理番号で追えない呼び出しが生まれる** |
| エージェント統合管理 | **NocoBase**（`ai_services`） | 77 サービスのカタログ構造を持てるのはこちらだけ |
| 統合 ID 認証 | **判断待ち**（§10 Q7） | Community では SSO 不可。「NocoBase Professional を買う」の代替として ζ 社が候補に。**C3 がどちらでも効く保険なので P0・P1 は決めずに進める** |
| IM 連携 | **Dify**（PC-14） | rev3 は「通知はデモでは作らない」。P1 以降 |
| プリセットのエージェント | **我々のカタログ 77 件** | ζ 社のプリセットは初期値としての価値のみ |

### コンテンツ監査の要点

- **`ai_usage_log`（メタ・FY+2 年）と `ai_audit_log`（本文・マスク後・90 日）を別テーブルにする。** 前者は K8 の集計元で全社が読み、後者は閲覧者が限られる。**Community の ACL は画面・ブロック・行で切るのが素直で列単位は弱い**ため、テーブルを分けるとロールで切れる
- **本文の保持を 90 日に切っても K8（AI の利用者数・利用回数・削減時間）は壊れない。** K8 の出所はメタの方（rev3 §5-18-4）
- **組織長は本文を見ない**を既定にする（rev3 §5-18-4「誰が AI を使っていないかを出す画面を作らない」と同じ理由）。本文を見たら `ai_audit_access` に必ず記録
- **送る文字列と記録する文字列を同一にする**（別々にマスクすると監査の役に立たない）。`redaction_rules_version` を持つ
- **`pii_erasure_requests` の対象に `ai_audit_log` を必ず含める**（含め忘れると「消せないところ」が 1 つ残る）
- **画面は増やさない（15 のまま）**：集計＝KPI 画面 K8 のブロック／本文の検索＝AI サービス画面の**ロール限定タブ**

### rev4 に反映すべき差分

設計書 **§7-6 の表**がそのまま引き渡しの一覧です（11 箇所）。新しく増える未確認 **U26〜U29** は §7-7。
**rev3 の判断は 1 つも覆しません**（Community を買わない・方式 (a)・M1 定義バンドル・C1〜C3・G-1〜G-3・業務スキーマ・15 画面・P0 のスコープ）。

---

## 触らない範囲（reviewer の diff 監査の基準）

- **既存 77 件の `SVCS` の値**（`name`/`desc`/`cat`/`sub`/`st`/`tags`/`industries`）— **1 文字も変えない**。特に `pt5.desc`・**`po3` の全フィールド（対象外）**・`lg1`/`nm5`/`dc2`
- `CATS` の `name`/`abbr`/`subs[].name`（変えるのは `subs.apply.industries` の配列だけ）／`TAGS` の既存 64 キー
- `T`・`TEMPLATES`（5 種）・`PATTERNS`・`HOME`・`FEED`・`CAT_STYLE`・`LIVE`・`state`・`data-act`・`localStorage`（3 キー）
- `mock/js/app.js`・`render.js`・`events.js`・`mock/css/**`（`--ntt-*` を含む）・`mock/catalog.html`
- **`mock/portal.html`・`mock/js/portal/**`・`mock/js/data/portal/**`・`mock/css/portal.css`**（portal-mock-pages の範囲）
- **`mock/js/data/scenarios/it/**`**（it-industry PR-4 の範囲）
- `tools/**` の**ロジック**（`regress.baseline.json` の `--update` を除く）／`.github/workflows/**`／`mock/.nojekyll`
- `CLAUDE.md`・`.claude/**`（§6 の件数 1 行は **PM が更新**）
- **`docs/handoff/2026-09-10-portal-nocobase.md`**（§7 は rev4 の**入力**であって、この Issue で書き換えるものではない）
- **別リポジトリ `shoulang0729/portal`**
- `docs/dify/usecases/PO-03.md`（対象外）
- `dify/**`／`data/world/` のうち `it/vendors.csv` 以外

---

## PR 分割案

| PR | 内容 | 依存 |
|---|---|---|
| **PR-1** | 設計書と Issue 本文（docs のみ） | なし。**すぐ出せる** |
| **PR-2** | `docs/dify/build-or-buy.md` 新設 ＋ `usecases/{LG-01,NM-05,DC-02,PT-05}.md` の §10 に 1 行 ＋ `docs/dify/README.md` 1 行 | Q1。PR-1 と並行可 |
| **PR-3** | `data/world/it/vendors.csv` に `ζ 社` 1 行 | it-industry PR-4 のマージ後が望ましい |
| **PR-4** | **データ層：DC-11 の追加**（`ui.js`・`catalog.js`・`regress.baseline.json`・`docs/service-map.md`・`docs/handoff/service-index.md`） | **it-industry PR-4 ＋ portal-mock-pages PR-2 のマージ後**／Q2・Q3 |
| **PR-5** | DC-11 の台本 3 本（`scenarios/{mfg,fin,it}/dc.js`）＋ `docs/dify/usecases/DC-11.md` ＋ `usecases/README.md` | **PR-4 のマージ後** |

**ポータル（§7）に PR はありません。** rev4 の改訂と `shoulang0729/portal` の実装は本 Issue の範囲外です。

### 並行作業との順序

```
  it-industry PR-4（scenarios/it/** ・ check-world.mjs）
  portal-mock-pages PR-2（catalog.js の place ・ regress.mjs ・ baseline）
        │
        ▼
  本件 PR-4（catalog.js ・ ui.js ・ baseline ・ service-map）
        ▼
  本件 PR-5（scenarios/{mfg,fin,it}/dc.js ・ usecases/DC-11.md）
```

---

## 受け入れ条件

### 全 PR 共通（最優先）

**禁止語リストそのものをリポジトリに置きません**（置いた時点で公開されるため）。PM がリポジトリの外（`~/.config/dify/bp-denylist.txt`）に持ち、implementer と reviewer は PR ごとに：

```bash
git grep -n -i -f ~/.config/dify/bp-denylist.txt -- . || echo "OK: 0 hits"
```

→ **0 hit**。リストが手元に無い環境では、**何も明かさない汎用パターン**（11 桁の連番・`¥` 金額・生の URL）で代替します。手順は設計書 §9-1。
**reviewer は必ず目で diff を読むこと。** 機械検査は補助です。

### PR-4（データ層）— **scratchpad の作業用コピーで実走済み**

`node tools/regress.mjs`（`--update` 前）が**この 9 行だけ**を出すこと：

```
   - counts.svcs: 77 → 78
   - counts.tags: 64 → 65
   - counts.byIndustry.mfg: {"svcs":49,"cats":10} → {"svcs":50,"cats":10}
   - counts.byIndustry.fin: {"svcs":29,"cats":8} → {"svcs":30,"cats":8}
   - counts.byIndustry.it: {"svcs":21,"cats":6} → {"svcs":22,"cats":6}
   - counts.svcsMulti: 11 → 12
   - CATS.dc.subs.apply industries: [mfg] → [mfg,fin,it]
   - SVCS 追加: dc11
   - TAGS 追加: legal
```

`node tools/verify.mjs` が **`✅ ALL PASS`**、warn が **16 → 18 件**。増える 2 件は `業種 "fin"/"mfg" で台本の無い SVCS 1 件: dc11` のみ（PR-5 で 0 に戻る）。

`npm run index` 後の `docs/service-map.md` に：
```
| DC-11 | 契約書レビュー（逸脱条項の検出と修正案） | DC/apply | 製造・金融・IT | 構想 | — | — | — | — | — | — | — |
```

### PR-1・PR-2（docs のみ）

- `verify` / `regress` が変更前とまったく同じ出力（`ALL PASS / ⚠️ 16 warn`・`regress PASS`）
- `git diff --stat` に `mock/`・`tools/`・`dify/`・`data/` が **1 行も現れない**
- `usecases/{LG-01,NM-05,DC-02,PT-05}.md` の差分が **§10 への 1 行追加のみ**。**`PO-03.md` が差分に現れない**

### PR-3（`ζ 社`）

- `npm run world` の warn 件数が **14 件のまま変わらない**（`vendors.csv` には「未使用」検査が掛からないことを確認済み）
- `verify` / `regress` が変更前と同じ。`vendors.csv` の差分が **1 行追加のみ**

### PR-5（台本・実装リファレンス）

- `verify` の warn から `dc11` の「台本の無い SVCS」が **3 業種とも消える**
- `regress` が **`--update` 無しで PASS**
- 台本に **`ζ` の文字・製品名・ベンダ名が 1 つも無い**
- `npm run world` の warn が増えない

### 目視（reviewer）

**P1 / P2 / P3 × ライト / ダーク × ja / zh / en**：

- 製造・金融・IT の 3 業種とも「文書・資料作成」→「申請・契約・貿易」に **DC-11 が構想バッジ付きで出る**
- 金融・IT で「申請・契約・貿易」の見出しが新しく現れ、**DC-11 だけ**が並ぶ（DC-05・DC-06・DC-07 は出ない）
- 製造で見える件数が **DC-11 の 1 件だけ増える**
- タグ絞り込みに **「法務・リスク／法务与风险／Legal & risk」** が現れ、押すと DC-11 だけが残る

---

## PM 判断待ち（推奨つき。詳細は設計書 §10）

| | 問い | 推奨 |
|---|---|---|
| **Q1** | 顧客に見せるカタログで「BP 製品で作れます」をどこまで出すか | **出さない**（案 (c)）。営業の場では口頭・提案書（リポジトリ外）で |
| **Q2** | DC-11 の採番を確定してよいか | **確定を推奨**（承認時点で永久欠番になる） |
| **Q3** | `dc/apply` を 3 業種に広げてよいか。中分類名は据え置きでよいか | **広げる・名前は据え置き** |
| **Q4** | LG-01 の台本に「元の体裁のまま返す」を足すか | **本件から切り離し、別 Issue に** |
| **Q5** | `CLAUDE.md` §6 の件数 1 行の更新 | PR-4 マージ後に `14 分類 33 中分類 78 サービス（提供中 12／試行版 29／構想 37）` へ（**現在の §6 は IT 業追加にも未追従なので併せて直す**） |
| **Q6** | **Dify Enterprise を入れるか**（§7-3-4） | **入れる前提で進める。** 入れるなら LLM ゲートウェイは Dify 1 本で ζ 社 GW は不要 |
| **Q7** | 統合 ID 認証をどうするか | **いま決めない。** C3 がどの選択肢でも効く保険なので P0・P1 は進められる |
| **Q8** | U26〜U29 を ζ 社に問い合わせるか | **U29 と U28 の 2 つだけ先に聞く**（2 問で判断材料の大半が揃う） |
| **Q9** | `ai_audit_log` の保持 90 日・本文は組織長に見せない、でよいか | **推奨どおり** |
