# AI エージェントカタログに 3 つ目の業種「IT 業」を足す

- 種別: **M/L**（architect 成果物。本 PR は**設計書と Issue 本文のみ**。`mock/**`・`tools/**`・`data/world/**` は 1 バイトも変えない）
- ラベル: `run:cloud`
- 前提設計書: `docs/handoff/2026-09-08-finance-catalog.md`（2 業種目を足したときの型。§1-2 `industries`・§4-8 表示・§7-2 世界マスタ）／`docs/handoff/2026-09-07-split-catalog.md`（データ層の分割）／`docs/handoff/2026-09-08-favorites.md`（`mock.fav` の業種キー）／`docs/handoff/2026-09-10-portal-nocobase.md`（IT 業の世界の出どころ。**本設計書からは参照するだけで変更しない**）
- 関連: `CLAUDE.md` §2-3 / §2-6 / §2-9 / §2-11 / §2-13 / §6

---

## 0. 何を決めたか（ここだけ読めば分かる）

| 問い | 結論 |
|---|---|
| **分類** | **新設は 1 分類だけ**：`sl` 営業・案件管理（IT 専用）。ほかの 7 件は既存分類に寄せ、**新中分類を 3 つ**足す（`kn/ops`・`po/staff`・`sl` の 2 中分類）。→ **13 分類 29 中分類 → 14 分類 33 中分類** |
| **`cv` を IT に広げるか** | **広げない。** `cv` は名称も中分類（`credit` 審査・与信／`kyc`）も銀行固有で、IT に広げると名称が嘘になる。金融が 5 分類を新設した前例（#120）に倣い、IT も自前の分類を持つ |
| **既存 49 件の扱い** | **(A) `industries` に `'it'` を足す。** ただし **(A) の懸念「青嶺精工の台本が IT 業に出る」は成り立たない**（§3-1 で実証）。`SCENARIOS` は**業種キー**（`SCENARIOS[industry][id]`）なので、IT に台本が無いサービスは**世界の語を一切含まない汎用チャットにフォールバック**する |
| **台本を何本書くか** | **第 1 弾は 10 本**（IT 固有の新サービス）。既存側は**最大 49 本**を後続で。合計最大 59 本（各 ja/zh の 2 言語）。**一度に書かない** |
| **世界の跨ぎ** | **社名と拠点名だけ跨ぐ。人・品番・設備・KPI・文書番号は跨がない。逆流（mfg/fin の台本に IT の語）は禁止。** `data/world/it/clients.csv` に `ref_world` 列を足して参照であることを明示し、`check-world.mjs` の `it` バケットでは W1（社名）/W5（拠点）だけ許可集合を和集合にする |
| **PR 分割** | **6 本**（§8）。PR-1 足場＋世界マスタ → PR-2 既存 11 件を IT に開放（ここで IT タブが押せるようになる）→ PR-3 IT 固有 10 サービス → PR-4 IT 台本 10 本＋`check-world` 拡張 → PR-5 ポータルの残り（**一覧待ちで着手しない**）→ PR-6 文書の件数更新 |
| **新サービスの成熟度** | **10 件すべて `st: 3`（構想）**。実装リファレンス（`docs/dify/usecases/<番号>.md`）が書けた時点で 2、`dify/apps` 投入＋テスト PASS で 1 に上げる（§7） |
| **PM 判断が要るもの** | **① IT 業の会社名（3 言語）** ② 分類 `sl` の承認（承認後に管理番号が確定し、**永久欠番になる**） ③ ポータルの 49 件の id 一覧 ④ `CLAUDE.md` §2-3・§2-13 の書き換え。**①②は PR-1 着手前に必要**（§10） |

### 0-1. 触らない範囲（reviewer の diff 監査の基準）

本設計書の PR（この 2 ファイル）が触らないもの：

- **`mock/**` すべて**（`catalog.html`・`css/**`・`js/**`）
- **`tools/**`・`tools/regress.baseline.json`・`scripts/**`**
- **`data/world/**`**（本書は `data/world/it/` の**中身を規定するだけ**。作るのは PR-1）
- **`dify/**`・`.github/workflows/**`・`.claude/**`・`CLAUDE.md`**
- **`docs/handoff/2026-09-10-portal-nocobase.md`・`docs/handoff/2026-09-11-nocobase-research.md`・`docs/handoff/portal-nocobase.issue.md`**（別 architect が並行作業中）
- `docs/handoff/**` の既存設計書すべて（本書は新規追加のみ）

実装 PR（PR-1〜PR-6）が触らないものは §8 の各行に書く。全 PR 共通で触らないもの：

- **`mock/css/tokens.css` の `--ntt-*`**（ブランドパレット。§2-2）。**PR-3 で足すのは `--cat-sl` / `--cat-sl-bg` のセマンティック 2 行のみ**（light・dark の両方。片方だけだと verify 5-b が FAIL）
- **`mock/js/render.js` のパターン分岐**（§2-3 の共通レイヤー契約）。業種セグメントは `INDUSTRIES` を回して描くので**描画コードの変更は不要**（§4-4-1 で実証）
- **`localStorage` の許可集合**（`mock.lang` / `mock.theme` / `mock.fav` の 3 つ。**4 つ目は作らない**。§4-4-3）
- **既存 `SVCS[].id` の改名**（§2-9・§2-11。欠番は作らない、id は増えるだけ）
- **`.github/workflows/pages.yml`**

---

## 1. 背景 —— なぜ 3 つ目の業種が要るのか

社内ポータルの概念モック（NocoBase。`docs/handoff/2026-09-10-portal-nocobase.md`、Issue #242）を作る過程で、ポータルの各画面に AI サービスを配置していったところ、次が分かった。

1. **カタログ 67 件のうち、自部門（IT 業）の画面に載るのは 49 件。** 残り 18 件は顧客自身の業務（製造現場・金融窓口・図面・BOM）で、自部門の画面には載らない
2. **その 49 件は製造業・金融業向けに作ったサービスを流用している状態。** 自部門は IT 業なのに、カタログに IT 業が無い
3. **カタログがカバーしていない自部門固有の業務が 10 件**見つかった（§2）

**IT 業を足すと 3 つが同時に片付く。**

| # | いま困っていること | IT 業を足すと |
|---|---|---|
| ① | ポータルが何を使っているかを業種で説明できない（「製造業向けの KN-01 を情シスが使っています」になる） | 「IT 業のカタログにこの 21 件があり、ポータルはそれを並べています」で通る |
| ② | 自部門固有の 10 件に置き場所が無い（`mfg` に入れると青嶺精工の世界に矛盾する） | `industries: ['it']` として置ける |
| ③ | 流用が無理をしている（`nm` 見積・数字 は製造原価、`en` 図面・BOM は設計図。SIer の案件原価・設計書とは別物） | 無理な流用をやめ、IT に必要なものだけを開放できる |

**この 3 つは「ポータルのために」ではなく「カタログのために」効く。** IT 業は在中日系企業の情報システム部門・SIer という**実在する顧客セグメント**であり、モックの説明力がそのぶん上がる。

### 1-1. IT 業の世界

**架空の日系 SIer の中国拠点（上海）ソリューション本部。** 顧客が青嶺精工（`mfg`）と碧洋銀行（`fin`）という関係になる（§5）。社内ポータルのデモと同じ世界を使う。

---

## 2. カタログに無い 10 件（PM から渡された原文）

| # | 原文 | 本書での配置（§3-2） |
|---|---|---|
| 1 | 名刺の読み取りと項目抽出（日中英）。名刺画像から氏名・会社・部門・役職・連絡先を抽出。名刺の言語を判定し、**役職は原文と社内表記の両方**を返す。名刺管理そのものはポータル側が持ち、AI は読み取りと抽出だけ | `gn`/`daily` |
| 2 | 引合の確度を過去案件から推定する | `sl`/`pipe`（新設） |
| 3 | 失注理由を蓄積して傾向を出す | `sl`/`pipe`（新設） |
| 4 | 過去提案を横断検索して再利用する | `sl`/`prop`（新設） |
| 5 | 年休の取り残しを検知して取得計画を促す | `po`/`staff`（新設） |
| 6 | 残業の偏りから要員リスクを早期に出す | `po`/`staff`（新設） |
| 7 | 取り込んだ文書を中分類に自動で振り分ける | `kn`/`ops`（新設） |
| 8 | 全社規程と部門の運用メモの食い違いを検出する | `kn`/`ops`（新設） |
| 9 | 計画と実績の差の理由を案件から書き起こす | `dc`/`report` |
| 10 | AI の利用ログから削減時間を見積もる | `po`/`collect` |

---

## 3. 決めたこと（§4 の 5 点への回答）

### 3-1. 【重要な訂正】(A) の前提 —— 「IT 業で開くと青嶺精工の台本が出る」は成り立たない

お題の §4-2 は「(A) `industries` に `'it'` を足すと、台本は世界ごとの値を使うので IT 業で開いたときに青嶺精工の台本が出る」としていた。**これは事実ではない。** 根拠：

| 場所 | 実装 |
|---|---|
| `mock/js/app.js` | `const scnOf = (id) => (SCENARIOS[state.industry] \|\| {})[id] \|\| null;` |
| `mock/js/data/scenarios/` | ディレクトリ構成は **`scenarios/<業種>/<分類>.js`**（`mfg/` 10 ファイル・`fin/` 8 ファイル）。`window.SCENARIOS` は **`SCENARIOS[業種][サービス id]`** の 2 段 |
| `tools/verify.mjs` §9-A | `js/data/scenarios/<業種>/<分類>.js` の **dirname が業種 id であること**を FAIL で検査している |

つまり `SCENARIOS` は**業種で完全に分かれている**。両業種サービス（現在 11 件）は `mfg/` 側と `fin/` 側に**別々の台本を 2 本**持っている。

したがって `SVCS.kn4.industries` に `'it'` を足しても、`SCENARIOS.it.kn4` が無ければ IT 業では**台本は 1 文字も出ない**。`data-act="start"` は `demo` ではなく `chat` にフォールバックし（§2-3 の「フォールバックを残す」）、表示されるのは：

```
T.chatHello  … 「こんにちは。「{name}」エージェントです。日本語・中国語どちらでも入力できます。」
T.chatReply  … 「（モック応答）ご入力ありがとうございます。実際のサービスでは、「{name}」がここで回答を生成します。」
T.chatPh     … 「メッセージを入力（日本語・中文どちらでも）」
```

**この 3 つはいずれも世界の語（社名・人名・品番・設備）を含まない。** `{name}` に入るのはサービス名（`SVCS[].name`）で、これも世界に依存しない。

**結論：(A) は世界の語を混ぜない。** (A) のコストは「IT 業のデモが 1 段階しょぼい（台本つきデモでなく汎用チャット）」だけで、正しさの問題ではない。

さらに、台本が無いサービスの warn の出かたも staging に使える：

```js
// tools/verify.mjs §9
for (const indId in SCENARIOS) {                 // ← SCENARIOS のキーだけを回る
  const noScript = SVCS.filter(s => s.industries.includes(indId) && !(SCENARIOS[indId]||{})[s.id]) …
  if (noScript.length) warn(…);
}
```

**`SCENARIOS.it` が存在しないうちは IT の warn は 1 件も出ない。** `scenarios/it/` を作った瞬間から、台本の無い IT サービスが warn になる。→ §8 の PR 順を「台本ディレクトリを作るのは最後」にした理由。

### 3-2. 分類 —— 新設 1 分類・新中分類 3 つ

#### 判断

| 案 | 採否 | 理由 |
|---|---|---|
| 10 件すべてを既存分類に寄せる | ✗ | #2・#3・#4（引合・失注・提案再利用）の入り先が無い。`cv/pitch`（提案・面談準備）は銀行のピッチ資料、`kn`（検索）は探すだけで、**案件を時系列で管理する軸**がどこにも無い |
| `cv` の `industries` を IT に広げ、中分類 `pipe` を足す | ✗ | `cv` の**名称が「顧客カバレッジ・審査」**で、中分類 3 つのうち 2 つ（`credit` 審査・与信／`kyc` KYC・コンプライアンス）は銀行固有。IT に広げると ①名称を変えるか（**顧客に見える文言の変更＝ fin の表示が変わる**）②IT で名称が嘘になるか、の二択になる |
| **新分類 `sl` を立てる（採用）** | ✓ | 金融が 5 分類（`rs`/`cv`/`fa`/`po`/`eg`）を新設した前例（#120）と同じ型。`CATS[].industries` で業種スコープが効くので、**fin の画面は 1 ピクセルも変わらない** |
| 新分類を 2 つ以上立てる（例：営業＋人材） | ✗ | #5・#6 は「要員の時間」の話で `po`（組織運営・PMO）の中分類で足りる。分類を増やすほど IT の一覧が薄く広がる（10 件しか無い） |

#### 新設する分類（1 つ）

```js
{ id: 'sl',
  industries: ['it'],
  name: { ja: '営業・案件管理', zh: '销售与商机管理', en: 'Sales & Pipeline' },
  abbr: { ja: '営業',       zh: '销售',           en: 'Sales' },
  subs: [
    { id: 'pipe', industries: ['it'],
      name: { ja: '引合・受注確度', zh: '商机与赢单概率', en: 'Pipeline & Win Rate' } },
    { id: 'prop', industries: ['it'],
      name: { ja: '提案資産の再利用', zh: '提案资产复用', en: 'Proposal Reuse' } }
  ]}
```

**挿入位置：`CATS` の末尾（`eg` の後）。** 純粋な append にして regress の diff を読みやすくする。IT 業のサイドバーの並びは `kn → dc → gn → po → eg → sl` になる。**「営業が最後」が見せ方として気に入らない場合は S レーンで並べ替えられる**（`CATS` の要素を動かすだけ。件数も id も変わらない）。

#### 新設する中分類（3 つ）

```js
// CATS.kn.subs の末尾に追加
{ id: 'ops', industries: ['it'],
  name: { ja: 'ナレッジ整備・運用', zh: '知识库整理与运维', en: 'Knowledge Curation' } },

// CATS.po.subs の末尾に追加
{ id: 'staff', industries: ['it'],
  name: { ja: '要員・労務', zh: '人员与劳务', en: 'Staffing & HR Ops' } },
```

（`sl` の 2 中分類は上の分類定義に含む。合計 4 中分類増 ＝ 29 → 33）

#### 既存分類・中分類の `industries` を広げるもの

**`INDUSTRY_ORDER` は `['mfg','fin','it']`**（§4-4-5）。配列の順序はこの順に固定する（verify §6 が FAIL で検査）。

| 対象 | 変更前 | 変更後 | いつ（PR） |
|---|---|---|---|
| `CATS.kn.industries` | `['mfg','fin']` | `['mfg','fin','it']` | PR-2 |
| `CATS.kn.subs.rule.industries` | `['mfg','fin']` | `['mfg','fin','it']` | PR-2 |
| `CATS.dc.industries` | `['mfg','fin']` | `['mfg','fin','it']` | PR-2 |
| `CATS.dc.subs.report.industries` | `['mfg','fin']` | `['mfg','fin','it']` | PR-2 |
| `CATS.gn.industries` | `['mfg','fin']` | `['mfg','fin','it']` | PR-2 |
| `CATS.gn.subs.daily.industries` | `['mfg','fin']` | `['mfg','fin','it']` | PR-2 |
| `CATS.po.industries` | `['mfg','fin']` | `['mfg','fin','it']` | PR-2 |
| `CATS.po.subs.collect.industries` | `['mfg','fin']` | `['mfg','fin','it']` | PR-2 |
| `CATS.po.subs.mgmt.industries` | `['mfg','fin']` | `['mfg','fin','it']` | PR-2 |
| `CATS.eg.industries` | `['mfg','fin']` | `['mfg','fin','it']` | PR-2 |
| `CATS.eg.subs.sysspec.industries` | `['mfg','fin']` | `['mfg','fin','it']` | PR-2 |
| `CATS.kn.subs`（`ops` を追加） | 3 件 | 4 件 | PR-3 |
| `CATS.po.subs`（`staff` を追加） | 2 件 | 3 件 | PR-3 |
| `CATS`（`sl` を追加） | 13 件 | 14 件 | PR-3 |

**広げない分類（明示）**：`rs`・`cv`・`fa`（金融専用のまま）／`qa`・`lg`・`nm`・`en`・`pt`（製造専用のまま）。**PR-5（ポータルの 49 件一覧）で広げる候補になるのは `lg`（日中コミュニケーション）が最有力**だが、一覧を受け取るまで決めない（§3-3）。

### 3-3. 既存 49 件をどう載せるか —— (A) を段階に切って採用

#### コスト比較

| | (A) `industries` に `'it'` を足す | (B) IT 業向けに別サービスとして起こす |
|---|---|---|
| `SVCS` の変更量 | 1 サービスあたり 1 行（`industries` の配列）。最大 49 行 | 1 サービスあたり **name 3 言語 ＋ desc 3 言語 ＋ cat/sub/st/tags** ＝ 最大 49 件の新規エントリ |
| 管理番号 | **増えない**（`KN-04` は IT でも `KN-04`） | **49 個の新しい永久欠番**が生まれる。`docs/service-map.md`・`docs/handoff/service-index.md`・`docs/dify/usecases/**` が 49 行ずつ増える |
| 世界の語の漏れ | **無い**（§3-1） | 無い |
| 台本 | 書かなければ汎用チャット。書くなら最大 49 本 | 最大 49 本（必須。台本の無い新規サービスは「作っただけ」になる） |
| 実装リファレンス `docs/dify/usecases/` | **増えない**（同じ管理番号を共有） | **49 本の新規 md**（§1 の「人がやったら何分か」も 49 本ぶん） |
| 実機（`dify/apps`） | **増えない**（同じ DSL を env で切り替える。`CLAUDE.md` §2-12 の型そのもの） | **49 本の DSL**。マスタ 1 本を環境に配る前提が崩れる |
| 顧客への説明 | 「同じエージェントが 3 業種で使えます」 | 「業種ごとに別のエージェントがあります」 |

**(A) を推奨する決め手は最後の 2 行。** `CLAUDE.md` §2-12 は「**マスタ DSL 1 本を社内・顧客 A・顧客 B へ env の差し替えで配る**」という製品の骨格で、(B) はこれに真っ向から反する。カタログ側だけ業種で分裂させると、実機側（12 本の DSL）と対応が取れなくなる。

#### 段階

台本の総量は「**(A) を採ると台本が要らない**」ではなく「**(A) だと台本を後から足せる**」。分けて数える：

| 段階 | 台本の本数 | どの PR |
|---|---|---|
| IT 固有の新サービス 10 件 | **10 本** | PR-4 |
| 既存の両業種サービス 11 件（IT に開放済み） | **11 本** | 後続（PR-4 のあと・別 Issue） |
| ポータルの 49 件のうち残り（最大 38 件） | **最大 38 本** | PR-5 のあと・別 Issue |
| **合計** | **最大 59 本**（各 ja / zh の 2 言語） | — |

**PR-4 までで書くのは 10 本だけ。** 残り 49 本は「台本が無い＝ verify の warn」という形で**欠落が見える**まま残す（`CLAUDE.md` §2-3 の「台本の無い `SVCS` は warn」がそのための仕組み）。**warn の件数を PR 本文に書いて、次に埋める人が数を把握できるようにする。**

#### ポータルの 49 件の id 一覧は本リポジトリに無い

お題の「49 件」は**ポータル側の作業成果**で、本リポジトリのどのファイルにも id 一覧が無い。**PR-5 は一覧を受け取るまで着手しない。** そのかわり PR-2 で、**一覧を待たずに確実に正しい 11 件**を先に開放する：

**既に `industries: ['mfg','fin']` の 11 件**（＝設計時点で「業種に依存しない」と判断済みのもの）。IT に開放してよいかを 1 件ずつ確認した結果、**11 件すべて妥当**：

| id | 管理番号 | 分類 | st | 名称 | IT 業での意味 |
|---|---|---|---|---|---|
| `kn4` | KN-04 | kn/rule | 2 | 社内問い合わせ受付とFAQ蓄積 | 情シス・管理部への問い合わせ窓口。そのまま |
| `kn5` | KN-05 | kn/rule | 2 | 当局通達の影響分析・マニュアル反映 | 個人情報保護法・データ越境の通達 → 受託案件の手順書への反映 |
| `dc2` | DC-02 | dc/report | **1** | 議事録作成と次回論点整理 | 日中混在の案件レビュー。そのまま |
| `dc8` | DC-08 | dc/report | 2 | 報告レビュー（提出前チェック／受領後の論点整理） | 進捗報告・検収報告。そのまま |
| `gn6` | GN-06 | gn/daily | 2 | 頼まれ事・放置業務の追跡 | そのまま |
| `gn7` | GN-07 | gn/daily | 3 | 幹部来訪・出張のアテンド段取り | 日本本社の役員来訪。そのまま |
| `po1` | PO-01 | po/collect | 3 | アンケート・インタビュー収集 | 要員アンケート・顧客満足度。そのまま |
| `po2` | PO-02 | po/collect | 3 | アイデアの募集・蓄積・投票集計 | そのまま |
| `po3` | PO-03 | po/collect | 3 | 小テスト・コンプライアンスチェックの実施と集計 | 情報セキュリティ教育。そのまま |
| `po4` | PO-04 | po/mgmt | 3 | 稼働の集計とコスト配分の提案 | **SIer の中核業務**（案件別稼働とコスト配分） |
| `eg1` | EG-01 | eg/sysspec | 3 | 上流工程の仕様支援（読解・質問回答・エラー対処） | **SIer の中核業務** |

`dc2` が **提供中（st:1）で実機 DSL もある**ので、PR-2 だけで「IT 業にも今日使えるものが 1 本ある」状態になる。

### 3-4. 架空世界マスタ `data/world/it/` と世界の跨ぎ

#### 跨ぎの規則（本書で決める）

既存の規則は `data/world/README.md`：「**2 つの世界の語彙は混ぜない**。金融の台本・KB・テストは `data/world/fin/` にある値だけを使い、製造業マスタの語（青嶺精工・K 社・PX-200 など）を流用しない。逆も同様」。

IT 世界は**顧客が青嶺精工と碧洋銀行**なので、ここを**意図的に、かつ限定して**破る。

| 何を | 跨いでよいか | 理由 |
|---|---|---|
| **社名**（青嶺精工 / 青岭精工 / Seirei Seiko、碧洋銀行 / 碧洋银行 / Hekiyo Bank） | **✓ 跨ぐ** | N 社から見て「顧客の名前」は外から見える顔。案件の話をすれば必ず出る |
| **拠点名**（蘇州工場、上海本部） | **✓ 跨ぐ** | 「蘇州工場の生産管理システム」のように案件の対象として出る |
| **人物**（王 磊・韓 雪 など） | **✗ 跨がない** | 顧客社内の個人は N 社のマスタが持つ情報ではない。顧客側の担当者が要るときは **役割だけ**（「先方の情報システム課長」）で書く |
| **品番・設備**（SK-2207・PX-200） | **✗ 跨がない** | 顧客の製造マスタ。SIer の台本に出す必然性が無い |
| **KPI**（不良率・貸出残高） | **✗ 跨がない** | 顧客の経営数字。N 社の KPI（稼働率・受注率・粗利率）と混ざると W8 の判定が壊れる |
| **文書番号**（ECR-25-0088・ERR-401） | **✗ 跨がない** | 顧客の文書体系。N 社の体系（`PJ-`・`PRP-`・`CR-`）を使う |
| **部署名**（生産技術課・審査部） | **✗ 跨がない** | 同上 |
| **逆流**（`mfg`/`fin` の台本に IT 世界の語） | **✗ 禁止** | 青嶺精工の台本に「翠雲システムズ」が出る理由が無い。世界の独立性を保つのはここ |

**一言でいうと：跨ぐのは「名刺に書いてある情報」だけ。**

#### `check-world.mjs` はこれで壊れるか —— 壊れる。PR-4 で直す

現状の実装（`tools/check-world.mjs`）：

- バケットは **`mfg` / `fin` / `both` の 3 つ**（`warnCounts = { mfg: 0, fin: 0, both: 0 }`）
- 台本の業種判定は「**パスに `/scenarios/fin/` を含めば `fin`、それ以外は `mfg`**」
- `kb`/`tests`/`usecases`/`samples` は管理番号 → `SVCS[].industries` で判定し、`mfg`&`fin` なら `both`、`fin` だけなら `fin`、**それ以外はすべて `mfg`**

したがって：

| いつ | 何が起きるか |
|---|---|
| PR-1（`data/world/it/` を作る） | **何も起きない。** `check-world` は `data/world/it/` を読まない（走査対象は allowlist）。`npm run world` の出力は **11 warn のまま不変**。これが PR-1 の受け入れ条件の 1 つ |
| PR-2（既存 11 件に `'it'` を足す） | **何も起きない。** `industries` が `['mfg','fin','it']` でも `bucketOf` は `mfg`&`fin` を見て `both` を返す |
| PR-3（IT 固有 10 サービスを足す） | **何も起きない。** `dify/kb`・`dify/tests`・`docs/dify/usecases`・`dify/samples` にファイルを作らないから |
| **PR-4（`scenarios/it/*.js` を作る）** | **壊れる。** `/scenarios/fin/` を含まないので **`mfg` バケット**に入り、翠雲システムズ・篠崎 悠真・`PJ-2026-014` がすべて「製造業マスタに無い語」として warn になる |

**PR-4 で `check-world.mjs` を拡張する**（`npm run world` は warn のみ・CI に入らないので FAIL は起きないが、台帳としての価値が落ちるので必ず直す）：

1. `warnCounts` に `it` を足し、バケットを **`mfg` / `fin` / `it` / `both`** の 4 つにする
2. 台本のバケット判定を「**`mock/js/data/scenarios/<ind>/` の `<ind>` をそのまま使う**」に変える（現在の「fin なら fin、他は mfg」を置き換える。`<ind>` が業種 id でないときだけ従来どおり `mfg` に倒す）
3. `bucketOf`（`kb`/`tests`/`usecases`/`samples`）：`industries` が 2 業種以上なら `both`、`['it']` だけなら `it`、`['fin']` だけなら `fin`、それ以外は `mfg`
4. **`both` の突き合わせ先を `mfg ∪ fin ∪ it` の和集合にする**（現在は `mfg ∪ fin`）
5. **跨ぎの許容（本設計の核心）**：**`it` バケットのときだけ**、
   - **W1（社名）と W5（拠点）の許可集合に `mfg`・`fin` の `company.md` の社名行・拠点行を足す**
   - **W2（役職）・W3（人）・W6（文書番号）・W7（品番・設備）・W8（KPI）は `it` のみ**（和集合にしない）
6. **`mfg` / `fin` バケットの許可集合に `it` の語を足さない**（逆流禁止の機械化）

この 5・6 が「跨ぎを認めつつ、跨ぎ過ぎを検出する」歯止めになる。**「全部和集合」にすると検査が意味を失う**ので採らない。

#### `data/world/it/` に置くファイル（8 つ。既存 2 世界と列構成を揃える）

| ファイル | 内容 | 列 |
|---|---|---|
| `company.md` | 社名（ja/zh/en）・現地法人・拠点・親子関係・事業内容・**顧客が他の 2 世界であることと跨ぎ規則**・実在名との衝突確認 | md（`fin/company.md` と同じ節構成） |
| `org.csv` | 部署 8 | `dept_id,dept_ja,dept_zh,dept_en,site_id,parent_dept_id,note` |
| `people.csv` | 人物 5（§3-4-1） | `person_id,name_ja,name_zh,name_en,dept_id,title_ja,title_zh,title_en,alt_title_ja,alt_title_zh,alt_title_en,site_id,native,note` |
| `clients.csv` | 顧客 4（**うち 2 件は他世界への参照**） | `fin/clients.csv` の列 ＋ **`ref_world`**（`mfg`/`fin`/空） |
| `vendors.csv` | 協力会社 3 | `code,kind,role_ja,role_zh,role_en,country,note` |
| `kpi.csv` | 指標 8 | `kpi_id,name_ja,name_zh,name_en,unit,target,current,prev,as_of,source,note` |
| `calendar.md` | 会計年度・月次クローズ・案件マイルストン・世界の「今日」・文書番号体系 | md |
| `documents.csv` | 規程 3 ＋ 社内 ID の書式 4 | `doc_id,kind,title_ja,title_zh,title_en,owner_dept,rev,note` |

`equipment.csv`・`products.csv` は置かない（`fin` が `equipment.csv` を置かないのと同じ理由。設備・品番が主役でない業種）。`hotels/vehicles/airports/routes/contacts.csv`（GN-07 用）は **GN-07 の IT 台本を書くときに足す**（PR-4 の範囲外。今は置かない）。

**すべてのファイルの先頭に既存 2 世界と同じ 3 言語の注記を入れる**：

```
この会社・人物・数値はすべて架空です。実在の企業・製品とは関係ありません。
本公司、人物及数据均为虚构，与实际企业、产品无关。
This company, its people and all figures are fictional and unrelated to any real organization.
```

#### 3-4-1. 人物 5 名 —— **1 名は完全衝突、3 名は紛らわしい**

ポータルのモックで使われている 5 名を、既存 31 名（mfg 20・fin 17。※`data/world/README.md` の「17 名／14 名」は追加後の実数とずれている。**実数は mfg 20・fin 17 の計 37 名**）と突き合わせた結果：

| ポータルの名前 | 判定 | 既存 | 対応 |
|---|---|---|---|
| **高橋 亮** | **✗ 完全衝突（姓名一致）** | `mfg/people.csv` の `takahashi-ryo,高橋 亮,Ryo Takahashi` | **改名必須** |
| 李 婷 | ⚠ 紛らわしい | 姓「李」＝ mfg 李 強／名「婷」＝ mfg 呉 婷・fin 潘 婷（**既に 2 人**） | 改名推奨 |
| 周 建国 | ⚠ 紛らわしい | 姓「周」＝ mfg 周 敏／名「建国」＝ mfg 馮 建国・fin 楊 建国（**既に 2 人**） | 改名推奨 |
| 村井 拓也 | ✓ 問題なし | 姓・名とも未使用 | そのまま |
| 石田 真希 | ⚠ 紛らわしい | 姓「石田」＝ fin 石田 由美 | 改名推奨 |

**既存の許容度**：姓の重複は既に存在する（`陳`＝ mfg 陳 静・fin 陳 慧）。名の重複も存在する（`建国`・`婷` が各 2 人）。**禁止されているのは姓名の完全一致だけ**なので、厳密に必須なのは高橋 亮 の改名 1 件。

**ただし IT 世界は 3 つの世界の登場人物が同じ画面に出る唯一の世界**（顧客が青嶺精工と碧洋銀行）なので、「建国さん」が 3 人・「婷さん」が 3 人いると**デモの口頭説明で実害が出る**。**4 名の改名が要る**（案は architect が出し、名前は PM が決める）。

**2026-09-11、PM が 4 名の改名を承認し、名前を確定した。下表が正本。** `data/world/it/people.csv`（PR-1）・IT 台本（PR-4）・ポータル側は、**この表の値だけ**を使う。

| 確定（PM 2026-09-11） | ja | zh | en | 部署 | 役職（ja / zh / en） | 拠点 | native |
|---|---|---|---|---|---|---|---|
| 高橋 亮 → **篠崎 悠真** | 篠崎 悠真 | 筱崎悠真 | Yuma Shinozaki | `deli1` | プロジェクトマネージャ / 项目经理 / Project Manager | 上海 | ja |
| 李 婷 → **黄 思涵** | 黄 思涵 | 黄思涵 | Huang Sihan | `deli2` | プロジェクトマネージャ / 项目经理 / Project Manager | 上海 | zh |
| 周 建国 → **蔡 文博** | 蔡 文博 | 蔡文博 | Cai Wenbo | `deli1` | デリバリリーダー / 交付负责人 / Delivery Lead | 上海 | zh |
| 村井 拓也（そのまま） | 村井 拓也 | 村井拓也 | Takuya Murai | `sales` | 営業課長 / 营业科长 / Sales Manager | 上海 | ja |
| 石田 真希 → **岸本 奈津** | 岸本 奈津 | 岸本奈津 | Natsu Kishimoto | `pmo` | PMO室 主任 / PMO室 主管 / PMO Office Lead | 上海 | ja |

確定 5 名は**姓・名とも既存 37 名（mfg 20・fin 17）と重複が無い**（姓名の完全一致どころか、姓だけ・名だけの重複も無い）。§9-2 で `data/world/README.md` に足す規約を最も強い形で満たす。**部署・役職・拠点・`native` は仮案から変えていない**（変わったのは名前だけ）。

**zh は簡体字に直して書く。** `篠` は簡体字に無いので `筱` を当てる（`篠崎悠真` ではなく **`筱崎悠真`**）。既存マスタの日本人名も `高橋 亮 → 高桥亮`・`渡辺 克彦 → 渡边克彦` と簡体字化しており、体系を揃える（PM 2026-09-11）。

##### 3-4-1-R.（記録）PM 判断前の仮案 —— **採用しない**

**PM 判断前の仮案。2026-09-11 に PM が確定（篠崎／黄／蔡／村井／岸本）。既存 37 名と姓名の完全一致なし。** 下表は PM 判断前に architect が書いた推奨で、**正本ではない**。`data/world/it/people.csv`・台本・ポータルに**この名前を書かない**こと（PR #255 で実際に混入し差し戻した）。判断の経緯を追えるように記録としてだけ残す。

| 仮案（不採用） | ja | zh | en |
|---|---|---|---|
| 高橋 亮 → 藤井 亮 | 藤井 亮 | 藤井亮 | Ryo Fujii |
| 李 婷 → 李 雯 | 李 雯 | 李雯 | Li Wen |
| 周 建国 → 周 建偉 | 周 建偉 | 周建伟 | Zhou Jianwei |
| 村井 拓也（そのまま。確定値と同じ） | 村井 拓也 | 村井拓也 | Takuya Murai |
| 石田 真希 → 島田 真希 | 島田 真希 | 岛田真希 | Maki Shimada |

**`data/world/README.md` への追記提案**（§9-2）：「**3 つの世界を通じて姓名の完全一致を作らない。名（下の名前）の 3 回目以降の再利用も避ける**」。

#### 3-4-2. 記号の体系 —— **`C 社`・`S 社`・`T 社`・`U 社` は使えない**

ポータルが仮置きで使っている記号を既存と突き合わせた結果：

| ポータルの記号 | 判定 |
|---|---|
| `S 社` | **✗ 既に使用中**。`mfg/partners.csv`：材料・塗装外注（SPCC 鋼板供給）。**製造台本に 51 回出る** |
| `T 社` | **✗ 既に使用中**。`mfg/partners.csv`：材料・工程の代替候補。**製造台本に 43 回出る** |
| `U 社` | **✗ 既に使用中**。`mfg/partners.csv`：代替鋼板供給者（ECR-23-0041） |
| `C 社`・`D 社` | ⚠ 未使用だが **ラテン大文字＋社 は `mfg` の記号名前空間**（`K`/`S`/`T`/`W`/`A`/`B`/`U`/`V`/`J` が使用済み）。IT で使うと読者が「どの世界の取引先か」を判別できない |

**`fin` は十干（甲社〜己社）という別体系を使う**ことでこれを避けている。IT も**第 3 の体系**が要る。

**決定：IT 世界の記号は ギリシャ文字 ＋ 半角スペース ＋ 社（`α 社`・`β 社`・`γ 社`）。**

| 案 | 採否 | 理由 |
|---|---|---|
| ラテン文字の未使用分（`C`/`D`/`E`…） | ✗ | `mfg` と同じ名前空間。混同する |
| 十干の続き（`庚`/`辛`/`壬`/`癸`） | ✗ | `fin` の続きに見える（甲〜己の次）。別世界であることが伝わらない |
| いろは（`イ 社`/`ロ 社`） | ✗ | 中国語話者に読めない。日中両言語で回すデモに向かない |
| **ギリシャ文字（採用）** | ✓ | ja・zh・en のどれでも通る。既存 2 体系のどちらとも形が違う。`check-world.mjs` の `CANDIDATE_RE`（`[A-Z]{1,4}(?:-…)`）に**引っかからない**ので誤検知が増えない |

**空白は `α 社`（半角スペース）に揃える**（`mfg` の `K 社` と同じ。`K社` のような空白ゆれが台本に 8 件残って warn になり続けている前例を繰り返さない）。

`clients.csv`（4 行）：

| code | kind | ref_world | role_ja | role_zh | role_en | country |
|---|---|---|---|---|---|---|
| 青嶺精工 | customer | **mfg** | 製造業の主要顧客（蘇州工場の生産管理・品質システムの受託開発と保守） | 制造业主要客户（苏州工厂生产管理与质量系统的受托开发与运维） | Main manufacturing client (MES/QMS development and maintenance for the Suzhou plant) | CN/JP |
| 碧洋銀行 | customer | **fin** | 金融の主要顧客（上海本部の事務システム・帳票基盤の受託開発） | 金融主要客户（上海总部事务系统与报表平台的受托开发） | Main financial client (back-office and reporting systems for the Shanghai head office) | CN/JP |
| α 社 | customer | （空） | 現地民営企業（EC・物流。仮置き） | 本地民营企业（电商与物流。占位） | Local private enterprise (e-commerce & logistics; placeholder) | CN |
| β 社 | customer | （空） | 日系商社（基幹系の保守。仮置き） | 日资商社（核心系统运维。占位） | Japanese-affiliated trading company (core-system maintenance; placeholder) | CN/JP |

**`ref_world` が入っている行の `note` に「社名の正本は `data/world/<ref_world>/company.md`。ここでは参照のみで、社名の 3 言語表記を二重に持たない」と書く。**

`vendors.csv`（3 行）：

| code | kind | role_ja | role_zh | role_en | country |
|---|---|---|---|---|---|
| γ 社 | partner | オフショア開発の協力会社（上海。常駐と持ち帰りの両方） | 离岸开发合作公司（上海。驻场与返厂并行） | Offshore development partner (Shanghai; on-site and off-site) | CN |
| δ 社 | partner | 技術者派遣会社（短期の要員補充） | 技术人员派遣公司（短期人员补充） | Engineer staffing agency (short-term augmentation) | CN |
| ε 社 | service | クラウド・ライセンスの再販業者 | 云服务与软件许可经销商 | Cloud and software-licence reseller | CN |

#### 3-4-3. 会社名 —— **PM 判断**

**「N 社」を正式名として使わない。** 理由：`mfg` の取引先記号（`K 社`・`S 社`・`A 社`）と**同じ形**なので、読者が「どこかの取引先」と誤読する。青嶺精工・碧洋銀行と同じく、**3 言語の固有名**を与える。

同じ造語法（色／自然＋業種語）で 3 案：

| | ja | zh | en | 現地法人（ja / zh / en） |
|---|---|---|---|---|
| **A（推奨）** | 翠雲システムズ株式会社 | 翠云系统股份有限公司 | Suiun Systems, Ltd. | 翠雲系統（上海）有限公司 / 翠云系统（上海）有限公司 / Suiun Systems (Shanghai) Co., Ltd. |
| B | 黎星システムズ株式会社 | 黎星系统股份有限公司 | Reisei Systems, Ltd. | 黎星系統（上海）有限公司 / 黎星系统（上海）有限公司 / Reisei Systems (Shanghai) Co., Ltd. |
| C | 明澄システムズ株式会社 | 明澄系统股份有限公司 | Meicho Systems, Ltd. | 明澄系統（上海）有限公司 / 明澄系统（上海）有限公司 / Meicho Systems (Shanghai) Co., Ltd. |

推奨は **A**：青（mfg）・碧（fin）に続く色名で世界が並んで見える。en が短く、既存の邦系 SIer 名と語感が離れている。

**本環境からは実在名との衝突を調査できない**（外部への到達を前提にしない方針）。`fin` が「瑞央 → 碧洋」を PM 判断で差し替えた前例（`docs/handoff/2026-09-08-finance-catalog.md` §9 #4）と同じく、**PM が最終確認して確定する**。後から衝突が分かったときに差し替える範囲は `data/world/it/company.md`・`INDUSTRIES.it.wordmark`・IT 台本の 3 か所だけに閉じる。

#### 3-4-4. 部署・拠点・KPI・文書番号

`org.csv`（8 行）：

| dept_id | ja | zh | en | site_id |
|---|---|---|---|---|
| `solution` | ソリューション本部 | 解决方案本部 | Solutions Division | `shanghai` |
| `deli1` | 第一デリバリ部 | 第一交付部 | Delivery Department I | `shanghai` |
| `deli2` | 第二デリバリ部 | 第二交付部 | Delivery Department II | `shanghai` |
| `sales` | 営業部 | 营业部 | Sales Department | `shanghai` |
| `pmo` | PMO室 | PMO室 | PMO Office | `shanghai` |
| `tech` | 技術推進部 | 技术推进部 | Technology Office | `shanghai` |
| `kanri` | 管理部 | 管理部 | Administration Department | `shanghai` |
| `jp_solution` | 日本本社 ソリューション事業部 | 日本总部 解决方案事业部 | Solutions Business Unit (Japan HQ) | `jp_hq` |

拠点（`company.md`）：

| id | ja | zh | en | 国 | 時差 |
|---|---|---|---|---|---|
| `shanghai` | 上海拠点 | 上海分公司 | Shanghai Office | 中国 | +8 |
| `jp_hq` | 日本本社 | 日本总部 | Japan Head Office | 日本 | +9 |

`kpi.csv`（8 行。値はすべて架空）：

| kpi_id | ja | zh | en | unit | target | current | prev |
|---|---|---|---|---|---|---|---|
| `utilization` | 要員稼働率 | 人员稼动率 | Resource utilization | % | 85 | 82.4 | 83.1 |
| `win_rate` | 受注率 | 中标率 | Win rate | % | 40 | 35.8 | 37.2 |
| `pipeline_amount` | 引合金額 | 商机金额 | Pipeline value | 万元 | 12000 | 10850 | 11200 |
| `gross_margin` | 案件粗利率 | 项目毛利率 | Project gross margin | % | 28 | 25.6 | 26.4 |
| `overtime_hours` | 平均残業時間 | 人均加班工时 | Average overtime | 時間/月 | 20 | 26.3 | 24.8 |
| `leave_taken` | 年休取得率 | 年假使用率 | Annual leave taken | % | 70 | 52.0 | 58.4 |
| `defect_density` | 納品後不具合密度 | 交付后缺陷密度 | Post-delivery defect density | 件/KLOC | 0.30 | 0.41 | 0.38 |
| `ai_hours_saved` | AI削減時間 | AI 节省工时 | Hours saved by AI | 時間/月 | 400 | 268 | 231 |

`as_of` は全行 `2026-08（月次）`、`source` は `台本未実装（PR-4 で参照予定）`、`note` は `架空値`。

**`mfg` の `defect_rate`（不良率）と `it` の `defect_density`（納品後不具合密度）は別指標**。`kpi_id` もラベルも違うので W8 が混同しない。

`documents.csv`（7 行）：

| doc_id | kind | title_ja | title_zh | title_en | owner_dept |
|---|---|---|---|---|---|
| `PJ-2026-014` | record_id | 案件番号（受注案件） | 项目编号（已签约项目） | Project number (won engagement) | `pmo` |
| `PRP-2026-031` | record_id | 提案書番号 | 提案书编号 | Proposal number | `sales` |
| `CR-2026-007` | record_id | 変更要求番号 | 变更请求编号 | Change-request number | `deli1` |
| `SOW-2026-009` | record_id | 作業範囲合意書番号 | 工作范围说明书编号 | Statement-of-work number | `sales` |
| `ITR-08` | rule | 情報セキュリティ規程 | 信息安全规章 | Information Security Policy | `tech` |
| `ITR-12` | rule | 就業・勤怠管理規程 | 考勤与工时管理规章 | Working Hours & Attendance Rules | `kanri` |
| `ITR-21` | rule | 年次有給休暇取得推進要領 | 年假使用推进办法 | Annual Leave Take-up Guidelines | `kanri` |

接頭辞 `PJ`・`PRP`・`CR`・`SOW`・`ITR` は **`mfg`（`ECR-`・`QC-`・`VST-`）・`fin`（`ERR-4xx`）のどれとも衝突しない**。また分類コード（`KN` `RS` `CV` `FA` `QA` `DC` `LG` `NM` `EN` `GN` `PT` `PO` `EG` ＋ 新設 `SL`）とも衝突しない（`check-world.mjs` §7-2 の歯止め検査に引っかからない）。

`calendar.md`：会計年度 **4/1〜3/31**（日本本社に合わせる）／月次クローズは翌月第 3 営業日／案件のマイルストンは要件定義・基本設計・結合テスト・検収／**世界の「今日」は 2026-09-11**／文書番号体系は上の `documents.csv` に対応させる。

---

## 4. モックのデータ層・検証への影響（全件）

### 4-1. データ層（`mock/js/data/**`）

| ファイル | 何を変えるか | PR |
|---|---|---|
| `ui.js` `INDUSTRIES` | **`it` を 1 件追加**（§4-2） | PR-1 |
| `ui.js` `TAGS` | **7 個追加**（§4-3） | PR-3 |
| `catalog.js` `CATS` | `industries` を 11 か所広げる（§3-2）／`sl` を 1 件追加／`kn.subs` に `ops`・`po.subs` に `staff` | PR-2・PR-3 |
| `catalog.js` `SVCS` | 既存 11 件の `industries` に `'it'`／**新規 10 件**（§4-5） | PR-2・PR-3 |
| `home.js` `HOME` | **`HOME.it` を追加**（§4-6）。PR-3 で recommended を 1 件差し替え | PR-2・PR-3 |
| `home.js` `FEED` | **`FEED.it` を追加**（§4-7）。PR-3 で items を 2 件差し替え | PR-2・PR-3 |
| `style.js` `CAT_STYLE` | **`sl` のアイコンを追加**（§4-8） | PR-3 |
| `style.js` `IND_LOGO` | **`it` のロゴを追加**（§4-8） | PR-1 |
| `scenarios/it/*.js` | **新規 5 ファイル**（`sl.js`・`kn.js`・`po.js`・`gn.js`・`dc.js`）。台本 10 本 | PR-4 |

### 4-2. `INDUSTRIES` に足すもの（3 言語すべて）

```js
{ id: 'it',
  name:     { ja: 'IT', zh: 'IT', en: 'IT Services' },
  desc:     { ja: '日系 SIer の中国拠点（上海）',
              zh: '日资系统集成商中国分公司（上海）',
              en: 'Japanese-affiliated systems integrator in China (Shanghai)' },
  wordmark: { ja: '<PM が §3-4-3 で確定>', zh: '<同左>', en: '<同左・大文字>' },
  dept:     { ja: 'ソリューション本部', zh: '解决方案本部', en: 'Solutions Division' } }
```

推奨案 A を採る場合の `wordmark`：`{ ja: '翠雲システムズ', zh: '翠云系统', en: 'SUIUN SYSTEMS' }`（`mfg` の `SEIREI SEIKO`・`fin` の `HEKIYO BANK` と同じく en は大文字）。

**`INDUSTRIES` の配列順は `mfg` → `fin` → `it`**（`.mockbar` の並びと `INDUSTRY_ORDER` に一致させる）。

### 4-3. `TAGS` に足すもの（7 個。3 言語すべて）

```js
  /* ---- IT カタログ新設タグ 7 個（設計書 2026-09-11-it-industry.md §4-3） ---- */
  ocr:         { ja: '読み取り・OCR', zh: '识别与OCR',     en: 'OCR & extraction' },
  pipeline:    { ja: '引合・案件',     zh: '商机与项目',   en: 'Pipeline' },
  winloss:     { ja: '受失注分析',     zh: '赢单失单分析', en: 'Win–loss analysis' },
  leave:       { ja: '休暇・年休',     zh: '休假与年假',   en: 'Leave' },
  taxonomy:    { ja: '分類・振り分け', zh: '分类与归集',   en: 'Taxonomy' },
  governance:  { ja: '規程整合',       zh: '规章一致性',   en: 'Policy alignment' },
  effect:      { ja: '効果測定',       zh: '效果测算',     en: 'Impact measurement' }
```

`TAGS` は 57 → **64**。**7 個すべてが §4-5 の 10 サービスで使われる**（未使用タグを作らない）。

### 4-4. 契約・状態・検証への影響

#### 4-4-1. `.mockbar` の業種切替が 2 つ → 3 つ

**`mock/js/render.js` は変更不要。**

```js
function renderIndSeg() {
  document.getElementById('ind-seg').innerHTML = INDUSTRIES.map(i => {
    const ready = SVCS.some(x => x.industries.includes(i.id));   // ← サービス 0 件なら disabled
    …
```

`INDUSTRIES` を回して描き、**その業種のサービスが 1 件以上あるかで有効/無効が決まる**。したがって：

- **PR-1（`INDUSTRIES.it` だけ足す）**：IT ボタンが **disabled で現れる**。押せない。`state` も `HOME`/`FEED` も要らない（verify §10 は「サービスが 1 件以上ある業種」だけを必須にする）
- **PR-2（11 件を開放）**：**コードを変えずに自動で押せるようになる**（`fin` が PR-1 で disabled・PR-3 で有効化された #120 と同じ流れ）

CSS も変更不要：`.mockbar .segwrap` は `flex-wrap: wrap; row-gap: var(--space-2)` なので 3 つ目のボタンは折り返しで収まる。`.seg button` は `padding: 5px 12px; font-size: 11.5px` で、ラベル `IT` / `IT` / `IT Services` はいずれも既存の `製造`・`金融`・`Manufacturing` より短いか同等。

#### 4-4-2. `state.industry` の値域（**`CLAUDE.md` §2-3 の変更。PM 承認が要る**）

```js
industry: 'mfg',        // 'mfg' | 'fin' | 'it'。localStorage には保存しない
…
fav: { mfg: [], fin: [], it: [] },
```

**`CLAUDE.md` §2-3 の「`industry` は業種（`mfg`/`fin`）」を「（`mfg`/`fin`/`it`）」に変える必要がある。** §2 は load-bearing なので **PM 承認を取ってから**（§9-1 に文面）。

#### 4-4-3. `mock.fav`（`localStorage`）—— **新しいキーは作らない。移行も不要**

`CLAUDE.md` §2-6 の要件を、いまの実装がそのまま満たすことを確認した：

```js
// mock/js/app.js
const indIds = new Set(INDUSTRIES.map(i => i.id));   // ← INDUSTRIES から動的に作る
for (const key of Object.keys(parsed)) {
  if (!indIds.has(key)) continue;                     // 業種キーは INDUSTRIES の id のみ受け入れる
  const arr = parsed[key];
  if (!Array.isArray(arr)) continue;                  // 形が違えば何もしない
  state.fav[key] = arr.filter(v => typeof v === 'string').slice(0, 200);
}
```

| 状況 | 挙動 |
|---|---|
| 既存利用者の `mock.fav` が `{"mfg":[…],"fin":[…]}`（`it` が無い） | `it` は初期値 `[]` のまま。**mfg/fin のお気に入りは消えない** |
| `mock.fav` が壊れている（JSON でない・配列でない） | `try` が別ブロックなので **`mock.lang`/`mock.theme` を巻き添えにしない**（§2-6） |
| 未知のキー（例：古い `retail`）が入っている | `indIds.has(key)` で弾かれ、**他のキーを巻き添えにしない** |

**実装者がやるのは `state.fav` の初期値に `it: []` を足すことだけ。** 移行コードもバージョン番号も要らない。**`localStorage` の許可集合は 3 つのまま**（§2-6 の「4 つ目は PM 判断」に触れない）。

#### 4-4-4. `HOME` / `FEED`

`tools/verify.mjs` §10 は **`readyIndustries`（サービスが 1 件以上ある業種）だけ**を必須にする。

- PR-1：IT のサービスは 0 件 → **`HOME.it`/`FEED.it` は不要**
- PR-2：IT のサービスが 11 件 → **`HOME.it`/`FEED.it` が必須**（無いと FAIL）

参照 id は「**その業種で見える** `SVCS`/`CATS`」でなければ FAIL。§4-6・§4-7 の内容はこの制約を満たす。

#### 4-4-5. `tools/**` の変更（5 か所。**これを忘れると PR-2 が FAIL する**）

| ファイル | 行 | 現状 | 変更 | PR |
|---|---|---|---|---|
| `tools/verify.mjs` | 91 | `const INDUSTRY_ORDER = ['mfg', 'fin'];` | `['mfg', 'fin', 'it']` | **PR-1** |
| `tools/verify.mjs` | 363 | 失敗メッセージ `industries の順序が ['mfg','fin'] 固定でない` | メッセージを `INDUSTRY_ORDER` から組み立てる（固定文字列をやめる） | PR-1 |
| `tools/verify.mjs` | 1138（§16-c） | `if (!['mfg','fin'].includes(fm.industry))` | `industryIds`（＝`INDUSTRIES` 由来）を使う。**ハードコードをやめる** | PR-1 |
| `tools/regress.mjs` | 28-32, 46 | `svcsMfg`/`svcsFin`/`svcsBoth`/`catsMfg`/`catsFin` | **`svcsIt`・`catsIt` を追加**（既存キーは消さない＝ baseline の継続性） | PR-1 |
| `tools/regress.mjs` | 53-54 | `svcsMfg + svcsFin − svcsBoth = checkSum` の検算 | **3 業種では包除原理が破綻する。** 業種別の件数と「**重複を除いた合計**」（`industries` が空でない `SVCS` の id の集合の大きさ）の表示に置き換える | PR-1 |
| `tools/gen-index.mjs` | 45 | `const industryLabel = { mfg: '製造', fin: '金融' };` | `it: 'IT'` を追加 | PR-1 |
| `tools/gen-index.mjs` | 135, 141, 145 | 索引の見出し・表ヘッダ・集計行が `①台本(製造)`/`①台本(金融)` の 2 列固定 | **`①台本(IT)` を 1 列追加**（`docs/service-map.md` は生成物なので `npm run index` で全行が更新される） | PR-1 |
| `tools/check-world.mjs` | §3-4 に記載 | バケットが `mfg`/`fin`/`both` | **`it` バケット追加＋跨ぎの許容** | **PR-4** |

`tools/regress.mjs` の置き換え後の表示（受け入れ条件に使う）：

```
   業種別 svcs: mfg=49 fin=29 it=11 ／ 重複を除いた合計 = 67（svcs=67）      ← PR-2 後
   業種別 svcs: mfg=49 fin=29 it=21 ／ 重複を除いた合計 = 77（svcs=77）      ← PR-3 後
```

#### 4-4-6. `--cat-sl` トークン（PR-3）

`tools/verify.mjs` 5-b は **`--cat-*` が light と dark で対称であること**を FAIL で検査する。**両方同時に足す。**

```css
/* mock/css/tokens.css  :root（light）— 既存 --cat-eg の次 */
  --cat-sl:      var(--ntt-orange-150);   /* #B22000 */
  --cat-sl-bg:   rgba(178, 32, 0, 0.12);

/* mock/css/tokens.css  :root[data-theme="dark"] — 既存 --cat-eg の次 */
  --cat-sl:      #FF8A66;  --cat-sl-bg: rgba(255, 138, 102, 0.18);
```

**`--ntt-orange-150` は既存のブランドパレット**（`mock/css/tokens.css` の不変ブロック）で、**値は変えず参照するだけ**（`--cat-kn` が `var(--ntt-future-blue)` を参照しているのと同じ流儀）。§2-2 に抵触しない。

コントラスト（実測）：

| | `--surface-card` | `--surface-canvas` | `--surface-sunken` |
|---|---|---|---|
| light `#B22000` | **6.78:1** | 6.36:1 | 5.97:1 |
| dark `#FF8A66` | **7.37:1** | 8.10:1 | 8.21:1 |

既存 13 分類の最小値（light `--cat-qa` `#B45309` の 4.43:1、dark `--cat-pt` `#F07AC0` の 6.69:1）を上回る。

**色相の衝突確認**：IT 業で同時に表示される分類は `kn`（青）・`dc`（ティール）・`gn`（緑）・`po`（ティール）・`eg`（紫）・`sl`（赤橙）。`cv`（`#9C2B3A` 深紅）とは色相が近いが、**`cv` は `['fin']`・`sl` は `['it']` なので同じ画面に並ばない**。

### 4-5. 新規 `SVCS` 10 件（3 言語すべて。implementer は翻訳しない）

**成熟度はすべて `st: 3`（構想）**（§7）。**`added` は付けない**（NEW バッジ・新着帯はマージ日に依存し、デモ日が動くと説明が事故る。必要なら別途 S レーンで）。

```js
  /* ---- sl: 営業・案件管理（IT）---- */
  { id: 'sl1', cat: 'sl', sub: 'pipe', st: 3, industries: ['it'], tags: ['pipeline', 'analysis'],
    name: { ja: '引合の受注確度推定', zh: '商机赢单概率推定', en: 'Opportunity Win-Probability Estimate' },
    desc: { ja: '引合・提案段階の案件について、過去の類似案件（顧客・業種・規模・提案内容・競合の有無・期間）を突き合わせ、受注確度の目安と、その根拠になった過去案件を返します。確度を下げている要因（要件が固まっていない・決裁者に会えていない・見積根拠が薄い）を挙げ、次に何を確かめるべきかを提案します。確度の確定と社内報告は営業が行います。',
            zh: '针对处于商机、提案阶段的项目，比对历史类似项目（客户、行业、规模、提案内容、有无竞争、周期），给出赢单概率的参考值以及作为依据的历史项目。同时列出拉低概率的因素（需求未固化、未见到决策者、报价依据薄弱），并建议下一步应确认的事项。概率的最终判定与内部汇报由营业负责。',
            en: 'For an opportunity at the inquiry or proposal stage, matches it against similar past deals (client, industry, size, scope, competition, duration) and returns an indicative win probability together with the past deals behind it. Lists what is pulling the probability down — requirements not frozen, no access to the decision maker, a thin basis for the estimate — and suggests what to confirm next. The final call and the internal report stay with the salesperson.' } },
  { id: 'sl2', cat: 'sl', sub: 'pipe', st: 3, industries: ['it'], tags: ['winloss', 'pipeline'],
    name: { ja: '失注理由の蓄積と傾向分析', zh: '失单原因沉淀与趋势分析', en: 'Loss-Reason Capture & Trend Analysis' },
    desc: { ja: '失注のたびに、理由（価格・体制・実績・納期・競合・社内都合）と案件の条件を聞き取って記録に残し、四半期ごとに傾向を返します。「この業種・この規模では価格で負けている」「要件定義の提案が弱い」といった繰り返し現れる型を、該当案件の一覧つきで示します。担当者の主観的な記述はそのまま残し、分類の口径だけを揃えます。',
            zh: '每次失单时，记录失单原因（价格、团队、业绩、交期、竞争、内部因素）与项目条件，并按季度给出趋势。以"在该行业、该规模上因价格失单""需求定义阶段的提案偏弱"等反复出现的模式呈现，并附相关项目清单。保留负责人的主观描述，只统一分类口径。',
            en: 'Each time a deal is lost, captures the reason (price, team, track record, schedule, competitor, internal) along with the deal\'s parameters, and reports the trend each quarter. Surfaces recurring patterns — losing on price in a given industry and deal size, weak proposals at the requirements stage — with the list of deals behind each. Keeps the owner\'s own wording and standardizes only the categories.' } },
  { id: 'sl3', cat: 'sl', sub: 'prop', st: 3, industries: ['it'], tags: ['proposal', 'search'],
    name: { ja: '過去提案の横断検索と再利用', zh: '历史提案的跨项目检索与复用', en: 'Past-Proposal Search & Reuse' },
    desc: { ja: '案件の条件（業種・システム領域・規模・体制・期間）を入れると、過去の提案書・見積・体制図から似た案件を探し、流用できる章と、そのまま使ってはいけない箇所（顧客固有の前提・失注した提案・古い価格）を分けて返します。顧客名を伏せた形での流用を既定とし、伏せ忘れを検出します。',
            zh: '输入项目条件（行业、系统领域、规模、团队、周期）后，从历史提案书、报价与团队结构图中查找相似项目，区分可复用的章节与不可直接沿用的部分（客户特有前提、已失单的提案、过时的价格）。默认以隐去客户名称的形式复用，并检测遗漏的未隐去之处。',
            en: 'Given the parameters of a deal (industry, system area, size, team, duration), finds similar past proposals, estimates and org charts, and separates the sections you can reuse from the parts you must not — client-specific assumptions, proposals that lost, outdated pricing. Reuse defaults to a client-anonymized form, and anything left un-anonymized is flagged.' } },

  /* ---- kn/ops: ナレッジ整備・運用（IT）---- */
  { id: 'kn9', cat: 'kn', sub: 'ops', st: 3, industries: ['it'], tags: ['taxonomy', 'search'],
    name: { ja: '取込文書の分類自動振り分け', zh: '导入文档的自动归类', en: 'Automatic Document Classification' },
    desc: { ja: 'ナレッジに取り込まれた文書（提案書・設計書・議事録・障害報告・規程）を読み、分類・中分類の候補と、判断の根拠になった記述を返します。既存の分類に収まらないものは「未分類」として理由つきで残し、分類そのものの見直し候補として集計します。確定は管理者が行い、自動では移動しません。',
            zh: '读取导入知识库的文档（提案书、设计书、会议纪要、故障报告、规章），返回分类与中分类的候选及其判断依据。无法归入既有分类的，标记为"未分类"并附理由保留，同时汇总为分类体系本身的调整候选。最终确定由管理员执行，系统不会自动移动文档。',
            en: 'Reads documents taken into the knowledge base — proposals, design documents, minutes, incident reports, policies — and returns candidate categories and sub-categories along with the wording each judgment rests on. Anything that does not fit is kept as "unclassified" with a reason and tallied as a candidate for revising the taxonomy itself. An administrator confirms; nothing is moved automatically.' } },
  { id: 'kn10', cat: 'kn', sub: 'ops', st: 3, industries: ['it'], tags: ['governance', 'regulation'],
    name: { ja: '規程と現場運用の食い違い検出', zh: '规章与现场运营的差异检测', en: 'Policy vs. Practice Gap Detection' },
    desc: { ja: '本社が定める全社規程と、拠点・部門で書かれた運用メモ・手順書・チェックリストを突き合わせ、食い違っている箇所を条文単位で示します。「規程より厳しい」「規程より緩い」「規程が想定していない」の 3 つに分け、緩い側を要対応として上位に出します。日本語の規程と中国語の運用メモをまたいで比較できます。',
            zh: '将总部制定的全公司规章与各分支、部门编写的运营备忘、作业手册、检查表进行比对，按条款指出不一致之处。分为"严于规章""宽于规章""规章未涵盖"三类，其中宽于规章的作为须处理项优先呈现。支持日文规章与中文运营备忘的跨语言比对。',
            en: 'Compares the company-wide rules issued by headquarters against the operating notes, procedures and checklists written at each site and department, and points out mismatches clause by clause. Sorts them into stricter than the rule, looser than the rule, and not covered by the rule, putting the looser ones at the top as items needing action. Works across a Japanese rulebook and Chinese operating notes.' } },

  /* ---- po/staff: 要員・労務（IT）---- */
  { id: 'po5', cat: 'po', sub: 'staff', st: 3, industries: ['it'], tags: ['leave', 'hr'],
    name: { ja: '年休の取り残し検知と取得計画', zh: '年假余额检测与休假计划', en: 'Unused-Leave Detection & Planning' },
    desc: { ja: '年次有給休暇の付与日数と取得実績を突き合わせ、取得率が低い人・期限までに消化しきれない人を検出します。案件のマイルストンと要員配置を見て、取得しやすい時期の候補を本人と上長に提示します。取得の指示や承認はしません。制度の条件は社内規程を参照し、拠点ごとの違い（日本・中国）を併記します。',
            zh: '将年假的授予天数与实际使用情况进行比对，识别使用率偏低、到期前无法消化的人员。结合项目里程碑与人员安排，向本人与上级提示便于休假的时间候选。不下达休假指示，也不进行审批。制度条件依据公司规章，并同时标注各地（日本、中国）的差异。',
            en: 'Compares granted annual leave against leave actually taken and flags people with low take-up or a balance they cannot use before it expires. Looking at project milestones and staffing, it suggests to the person and their manager when leave would be easiest to take. It does not instruct or approve leave. Conditions come from the company rules, with the differences between the Japan and China sites shown side by side.' } },
  { id: 'po6', cat: 'po', sub: 'staff', st: 3, industries: ['it'], tags: ['workload', 'hr'],
    name: { ja: '残業の偏りからの要員リスク検知', zh: '加班失衡与人员风险预警', en: 'Overtime Imbalance & Staffing Risk' },
    desc: { ja: '残業時間・稼働の記録を案件の状態（フェーズ・遅れ・変更要求の件数）と突き合わせ、特定の人に負荷が寄っている状態を早い段階で示します。「この案件のこの役割が 3 か月続けて突出している」「代われる人が 1 人もいない」といった形で、要員リスクとして上長・PMO に返します。評価や勤怠の是正には使いません。',
            zh: '将加班工时与稼动记录同项目状态（阶段、延期、变更请求数量）进行比对，及早呈现负荷集中于特定人员的情况。以"该项目该角色连续三个月明显偏高""无人可替换"等形式，作为人员风险反馈给上级与 PMO。不用于绩效评价或考勤纠正。',
            en: 'Cross-checks overtime and utilization records against project status (phase, slippage, number of change requests) to show early where load is concentrating on one person. Reports it to managers and the PMO as a staffing risk — this role on this project has been an outlier for three months running, nobody can take over — and is not used for performance reviews or attendance enforcement.' } },

  /* ---- po/collect: 収集・集計（IT）---- */
  { id: 'po7', cat: 'po', sub: 'collect', st: 3, industries: ['it'], tags: ['effect', 'dashboard'],
    name: { ja: 'AI利用実績からの削減時間の見積', zh: 'AI 使用实绩的节省工时估算', en: 'Time-Saved Estimate from AI Usage' },
    desc: { ja: 'カタログの各サービスがどれだけ使われたか（件数・利用者・分類）を集計し、サービスごとに定めた「人がやったときの所要時間」を掛けて削減時間の目安を出します。実測ではなく見積であること、前提に置いた所要時間を必ず併記し、前提を変えたときの結果も併せて返します。使われていないサービスと、使われ方が想定と違うサービスも挙げます。',
            zh: '汇总目录中各服务的使用情况（次数、使用者、分类），乘以为每个服务设定的"人工所需时间"，给出节省工时的参考值。必须同时标注这是估算而非实测，以及所采用的前提工时，并给出变更前提后的结果。同时列出未被使用的服务，以及使用方式与预期不符的服务。',
            en: 'Tallies how much each catalog service is used (volume, users, category) and multiplies it by the "how long a person would take" figure defined for that service to produce an indicative time saving. It always states that this is an estimate rather than a measurement, shows the assumed durations, and gives the result under alternative assumptions. Services nobody uses, and services used differently than expected, are listed too.' } },

  /* ---- gn/daily: 日常業務（IT）---- */
  { id: 'gn8', cat: 'gn', sub: 'daily', st: 3, industries: ['it'], tags: ['ocr', 'translate'],
    name: { ja: '名刺の読み取りと項目抽出', zh: '名片识别与信息提取', en: 'Business Card Reading & Field Extraction' },
    desc: { ja: '名刺の画像から氏名・会社名・部門・役職・電話・メール・住所を抽出します。名刺の言語（日本語・中国語・英語）を判定し、役職は原文の表記と社内の対応表記の両方を返します（中国語名刺の「主管」→ 社内表記「主任」など）。読み取り結果は確認・修正できる形で返し、名刺そのものの管理は社内ポータル側が行います。本サービスは読み取りと抽出だけを担当します。',
            zh: '从名片图像中提取姓名、公司名、部门、职务、电话、邮箱与地址。自动判定名片语言（日文、中文、英文），职务同时返回原文表述与公司内部对应表述（例如中文名片的"主管"对应内部表述"主任"）。识别结果以可确认、可修改的形式返回，名片本身的管理由公司内部门户负责，本服务只负责识别与提取。',
            en: 'Extracts name, company, department, job title, phone, email and address from a business-card image. Detects the card\'s language (Japanese, Chinese or English) and returns the job title both as printed and in your company\'s equivalent wording — 主管 on a Chinese card maps to 主任 internally. Results come back in a reviewable, editable form; the card records themselves are kept by the internal portal, and this service only reads and extracts.' } },

  /* ---- dc/report: 報告・会議（IT）---- */
  { id: 'dc10', cat: 'dc', sub: 'report', st: 3, industries: ['it'], tags: ['kpi', 'report'],
    name: { ja: '予実差の理由の書き起こし', zh: '计划实绩差异的原因说明', en: 'Plan-vs-Actual Variance Narrative' },
    desc: { ja: '稼働率・粗利率・引合金額などの計画と実績の差について、案件の出来事（受注の遅れ・要員の抜け・変更要求・検収の前倒し）を時系列で拾い、差の理由を文章として書き起こします。数字は集計元の案件へ辿れる形で残し、推測で書いた箇所は推測と明記します。月次・四半期の報告資料にそのまま貼れる長さで返します。',
            zh: '针对稼动率、毛利率、商机金额等计划与实绩的差异，按时间顺序梳理项目事件（签约延迟、人员抽调、变更请求、验收提前），将差异原因写成文字说明。数字保留可追溯至源项目的形式，基于推测的部分明确标注为推测。输出长度可直接粘贴进月度、季度汇报资料。',
            en: 'For gaps between plan and actuals — utilization, gross margin, pipeline value — it pulls the project events behind them in order (a late signing, a person pulled off, a change request, an early acceptance) and writes the explanation out in prose. Figures stay traceable back to the source projects, and anything inferred is labelled as inferred. Output is sized to paste straight into a monthly or quarterly report.' } },
```

**挿入位置**：`kn9`/`kn10` は `SVCS` の `kn` ブロックの末尾、`dc10` は `dc` ブロックの末尾、`gn8` は `gn` ブロックの末尾、`po5`〜`po7` は `po` ブロックの末尾、`sl1`〜`sl3` は **`SVCS` 全体の末尾に新しい `/* ---- sl: … ---- */` ブロック**として置く。

#### 管理番号（§2-11 の変換で一意に決まる。**マージ時点で永久欠番になる**）

| 内部 id | 管理番号 | 内部 id | 管理番号 |
|---|---|---|---|
| `sl1` | **SL-01** | `po5` | **PO-05** |
| `sl2` | **SL-02** | `po6` | **PO-06** |
| `sl3` | **SL-03** | `po7` | **PO-07** |
| `kn9` | **KN-09** | `gn8` | **GN-08** |
| `kn10` | **KN-10** | `dc10` | **DC-10** |

**この採番は §3-2 の分類が確定して初めて意味を持つ。** 分類を後から変えると採番もやり直しになり、`SL-01` などが欠番として残る。**PR-3 に着手する前に PM が §3-2 を承認すること**（§10 の判断待ち ②）。

### 4-6. `HOME.it`（PR-2 で追加。3 言語すべて）

```js
  /* ---- IT（日系 SIer 上海拠点）。世界マスタは data/world/it/**（設計書 §3-4）。
     台本は未投入（PR-4）なので、ここで挙げるサービスも start は chat フォールバックになる ---- */
  it: {
    frequent: [
      { id: 'dc2', uses: 241 },
      { id: 'eg1', uses: 188 },
      { id: 'po4', uses: 163 },
      { id: 'gn6', uses: 141 },
      { id: 'kn4', uses: 126 },
      { id: 'dc8', uses: 104 }
    ],
    recommended: [
      { id: 'eg1',
        why: { ja: '仕様書の読解と顧客からの質問対応は、どの案件でも立ち上がりに必ず起きます。最初に効果が見える 1 本です。',
               zh: '规格书的解读与客户提问应对，在任何项目的启动期都必然发生，是最先见效的一个。',
               en: 'Reading the spec and answering the client\'s questions happens at the start of every project. The quickest place to see value.' } },
      { id: 'dc2',
        why: { ja: '日中が混ざる案件レビューの議事録を、その場で両言語に起こせます。すでに提供中で、今日から使えます。',
               zh: '中日混合的项目评审纪要可当场生成双语版本。已在提供中，今天即可使用。',
               en: 'Turns a mixed Japanese/Chinese project review into minutes in both languages on the spot. Already in service — usable today.' } },
      { id: 'po4',
        why: { ja: '案件ごとの稼働とコスト配分は、毎月手で集計している部分です。集計の型を一度決めれば繰り返し使えます。',
               zh: '各项目的稼动与成本分摊目前每月都在手工汇总，口径定好一次即可反复使用。',
               en: 'Utilization and cost allocation per project are tallied by hand every month. Define the format once and reuse it.' } }
    ]
  }
```

**`uses` は降順**（verify §10 が降順でないと warn）。**PR-3 のあと**、`recommended` の 3 件目 `po4` を **`po6`（残業の偏りからの要員リスク検知）** に差し替える（IT 固有サービスを 1 件は推薦に載せるため）。差し替え時の `why`：

```js
      { id: 'po6',
        why: { ja: '負荷が 1 人に寄っていることは、遅れになって初めて分かることが多い業務です。案件の状態と突き合わせて早く出します。',
               zh: '负荷集中于一人往往要等到出现延期才被发现。本服务结合项目状态提前呈现。',
               en: 'Load concentrating on one person usually only becomes visible once something slips. This surfaces it early by reading it against project status.' } }
```

### 4-7. `FEED.it`（PR-2 で追加。3 言語すべて）

ペルソナは `data/world/it/people.csv` の **岸本 奈津（PMO室 主任・上海拠点）**（§3-4-1 の確定値）。部署名・拠点名は `data/world/it/org.csv`・`company.md` の正本に合わせる。**絶対日付は書かない。**

```js
  /* ---- IT（日系 SIer 上海拠点）。persona は data/world/it/people.csv の岸本奈津（PMO室 主任）。
     部署・拠点・文書番号の書式は data/world/it/**（org.csv・calendar.md）の正本に合わせる ---- */
  it: {
    persona: { name: { ja: '岸本 奈津', zh: '岸本奈津', en: 'Natsu Kishimoto' },
               role: { ja: 'PMO室 主任', zh: 'PMO室 主管', en: 'PMO Office Lead' },
               site: { ja: '上海拠点', zh: '上海分公司', en: 'Shanghai Office' } },
    mine:   ['po', 'dc', 'kn'],
    recent: ['dc2', 'po4', 'eg1', 'gn6'],
    items: [
      { id: 'po4', kind: 'due',
        when: { ja: '本日 17:00 まで', zh: '今天 17:00 前', en: 'Today, by 17:00' },
        note: { ja: '先月分の稼働を案件別に配分します。管理部への提出は明日です。',
                zh: '将上月的稼动按项目分摊，明天需提交管理部。',
                en: 'Allocate last month\'s utilization by project. Due to Administration tomorrow.' } },
      { id: 'dc8', kind: 'due',
        when: { ja: '明日まで', zh: '明天前', en: 'By tomorrow' },
        note: { ja: '月次の進捗報告。提出前に数字と本文の食い違いを見ておきます。',
                zh: '月度进度报告。提交前需检查数字与正文是否一致。',
                en: 'The monthly progress report. Check the figures against the text before it goes out.' } },
      { id: 'gn6', kind: 'due',
        when: { ja: '今週中', zh: '本周内', en: 'This week' },
        note: { ja: '営業部から頼まれた要員表の更新が止まっています。期限が近いので声掛けが必要です。',
                zh: '受营业部委托的人员表更新仍未完成，期限将近，需要提醒。',
                en: 'The staffing sheet asked for by Sales is stalled. The deadline is close and it needs a nudge.' } },
      { id: 'dc2', kind: 'routine',
        when: { ja: '毎週月曜', zh: '每周一', en: 'Every Monday' },
        note: { ja: '週次の案件レビューの議事録を作り、未決事項を次回の論点として整理します。',
                zh: '整理每周项目评审的纪要，并把未决事项列为下次的议题。',
                en: 'Write up the weekly project review and carry the open items over as next week\'s agenda.' } },
      { id: 'po3', kind: 'routine',
        when: { ja: '毎月 1 日', zh: '每月 1 日', en: 'The 1st of each month' },
        note: { ja: '情報セキュリティの小テストを配信し、未受験者を集計します。',
                zh: '发送信息安全小测验并统计未参加人员。',
                en: 'Send out the information-security quiz and tally who has not taken it.' } },
      { id: 'kn5', kind: 'notify',
        when: { ja: '新着', zh: '最新', en: 'New' },
        note: { ja: '個人情報の取り扱いに関する通達が更新されました。受託案件の手順書への影響を確認してください。',
                zh: '个人信息处理相关通知已更新，请确认对受托项目作业手册的影响。',
                en: 'A notice on handling personal data was updated. Check the impact on the procedures for client projects.' } },
      { id: 'po1', kind: 'notify',
        when: { ja: '新着', zh: '最新', en: 'New' },
        note: { ja: '要員アンケートの回答期限が近づいています。未回答が 3 割残っています。',
                zh: '人员问卷的回答期限临近，仍有三成未回答。',
                en: 'The staffing survey closes soon; 30% have not answered.' } }
    ]
  }
```

**PR-3 のあと**、`items` の 2 件を IT 固有サービスに差し替える（`po3` → `po5`、`po1` → `sl2`）：

```js
      { id: 'po5', kind: 'routine',
        when: { ja: '毎月 1 日', zh: '每月 1 日', en: 'The 1st of each month' },
        note: { ja: '年休の残日数を確認し、期限までに消化できない人に取得時期の候補を出します。',
                zh: '确认年假余额，并为到期前无法消化的人员提出休假时间候选。',
                en: 'Check remaining annual leave and suggest when to take it for anyone who cannot use it before it expires.' } },
      { id: 'sl2', kind: 'notify',
        when: { ja: '新着', zh: '最新', en: 'New' },
        note: { ja: '先月の失注 3 件の理由が登録されました。四半期の傾向に反映されています。',
                zh: '上月 3 件失单的原因已登记，已反映到季度趋势中。',
                en: 'Reasons for last month\'s three lost deals were recorded and are reflected in the quarterly trend.' } }
```

`mine` は `['po', 'dc', 'kn']` のまま（`sl` を入れると PMO のペルソナと合わない）。

### 4-8. アイコン（`CAT_STYLE.sl` と `IND_LOGO.it`）

既存と同じ規約：`viewBox 0 0 24 24` / `fill none` / `stroke currentColor` / `stroke-width 1.75`。**本リポジトリで書き起こしたもので、外部アイコン集は使わない**（帰属表記不要）。

```js
// mock/js/data/style.js  CAT_STYLE — 既存 eg の次
  /* ---- IT カタログ新設 1 分類。設計書 2026-09-11-it-industry.md §4-8 ---- */
  sl: { icon: '<path d="M3.5 20h17"/><path d="M4.5 16.5 9.5 11l3.5 3.5 6.5-8"/><path d="M15.5 6.5h4v4"/>' },
```

（右肩上がりの折れ線＋矢羽根＝パイプラインの推移。`nm` の棒グラフ・`rs` の虫眼鏡とは別の形）

```js
// mock/js/data/style.js  IND_LOGO — 既存 fin の次。viewBox は呼び出し側で 0 0 32 24
  /* IT（日系 SIer）＝「N」字のストロークと、右に伸びる通信線 3 本 */
  it: { icon: '<path d="M5 19V5l11 13V5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 8.5h8M21 12h8M21 15.5h5" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" opacity="0.5"/>' }
```

（`mfg` の「稜線」・`fin` の「波」と同じ流儀：太線 2px の主モチーフ＋1.25px・opacity 0.5 の副モチーフ。**実在企業のロゴに似せない幾何マーク**）

**`IND_LOGO` は `tools/verify.mjs` の検査対象外**で、欠けていても `indLogo()` が空文字を返すだけ（壊れない）。だからこそ **PR-1 で忘れずに足す**（忘れると IT のヘッダーだけ社名の左が空く）。

### 4-9. 生成物・文書

| 対象 | 何が起きるか | PR |
|---|---|---|
| `tools/regress.baseline.json` | **`--update` が必要**。`industries` 配列・`cats`・`svcs`・`tags`・`counts` が変わる。**PR 本文に「設計書 §X のデータ変更に伴う基準更新」と書く**（`CLAUDE.md` §3） | PR-1・PR-2・PR-3 |
| `docs/service-map.md` | **`npm run index` で再生成**。`①台本(IT)` 列が増え（PR-1）、業種列に「IT」が出て（PR-2）、10 行増える（PR-3）。verify §11 が鮮度を FAIL で検査 | PR-1・PR-2・PR-3 |
| `docs/dify/usecases/*.md` | **10 件ぶん未作成になる**（66/67 → 66/77）。`docs/service-map.md` の ③ 列が `—` になる（欠落が見える設計）。**本 Issue では書かない**（別 Issue） | — |
| `docs/dify/usecases/README.md` | 見出し「（67 件）」と一覧表 | PR-6 |
| `docs/handoff/service-index.md` | 「サービス（67 件）」と一覧 | PR-6 |
| `docs/demo/briefing-catalog.md` | 「13 分類・29 中分類・67 サービス」「対象業種」「2. 13 分類の意味と 29 中分類」 | PR-6 |
| `docs/demo/briefing-coverage.md`・`runbook-mfg.md` | 「67 サービス」 | PR-6 |
| `README.md` | 4 区分の地図の「67 サービスの詳細ユースケース」 | PR-6 |
| `CLAUDE.md` §2-3・§2-6・§6 | **PM 承認が要る**（§9-1） | PR-6 |
| `data/world/README.md` | 「2 つの世界」→「3 つの世界」・IT 世界の表・跨ぎ規則・人名規則 | PR-1 |

---

## 5. 数の変化（`CLAUDE.md` §2-9 が要求する「変更前後の件数と id 一覧」）

### 5-1. 全体

| | 現行 | PR-1 後 | PR-2 後 | PR-3 後 | PR-5 後（最大） |
|---|---|---|---|---|---|
| 業種 | 2 | **3** | 3 | 3 | 3 |
| 分類 | 13 | 13 | 13 | **14** | 14 |
| 中分類 | 29 | 29 | 29 | **33** | 33 |
| サービス | 67 | 67 | 67 | **77** | 77 |
| タグ | 57 | 57 | 57 | **64** | 64 |

### 5-2. 業種別のサービス件数

| | 現行 | PR-1 後 | PR-2 後 | PR-3 後 | PR-5 後（最大） |
|---|---|---|---|---|---|
| 製造（`mfg`） | 49 | 49 | 49 | 49 | 49 |
| 金融（`fin`） | 29 | 29 | 29 | 29 | 29 |
| **IT（`it`）** | — | **0** | **11** | **21** | **最大 59**（＝ 10 ＋ ポータルの 49） |
| `mfg` ∩ `fin` | 11 | 11 | 11 | 11 | 11 |
| **重複を除いた合計** | **67** | **67** | **67** | **77** | **77** |

### 5-3. 成熟度別

| | 現行 | PR-3 後 |
|---|---|---|
| 提供中（1） | 12 | 12 |
| 試行版（2） | 29 | 29 |
| 構想（3） | 26 | **36** |
| 合計 | 67 | **77** |

### 5-4. 分類別（PR-3 後。IT で見えるもの）

| 分類 | `industries` | IT の中分類 | IT のサービス |
|---|---|---|---|
| `kn` ナレッジ検索・問い合わせ | `['mfg','fin','it']` | `rule`・**`ops`** | `kn4` `kn5` **`kn9` `kn10`**（4） |
| `dc` 文書・資料作成 | `['mfg','fin','it']` | `report` | `dc2` `dc8` **`dc10`**（3） |
| `gn` 汎用業務支援 | `['mfg','fin','it']` | `daily` | `gn6` `gn7` **`gn8`**（3） |
| `po` 組織運営・PMO | `['mfg','fin','it']` | `collect`・`mgmt`・**`staff`** | `po1` `po2` `po3` `po4` **`po5` `po6` `po7`**（7） |
| `eg` エンジニアリング支援 | `['mfg','fin','it']` | `sysspec` | `eg1`（1） |
| **`sl` 営業・案件管理（新設）** | `['it']` | **`pipe`・`prop`** | **`sl1` `sl2` `sl3`**（3） |
| | | **6 分類 10 中分類** | **21 サービス** |

（太字が PR-3 で新規追加）

### 5-5. 追加される id の一覧（reviewer が `regress.mjs` の差分と照合する）

**追加（10）**：`sl1` `sl2` `sl3` `kn9` `kn10` `po5` `po6` `po7` `gn8` `dc10`
**削除（0）**、**改名（0）**、**欠番（0）**
**分類の追加（1）**：`sl`
**中分類の追加（4）**：`kn/ops` `po/staff` `sl/pipe` `sl/prop`
**タグの追加（7）**：`ocr` `pipeline` `winloss` `leave` `taxonomy` `governance` `effect`
**`industries` だけが変わる既存サービス（11）**：`kn4` `kn5` `dc2` `dc8` `gn6` `gn7` `po1` `po2` `po3` `po4` `eg1`
**`industries` だけが変わる既存分類（6）**：`kn` `dc` `gn` `po` `eg`（`rs`/`cv`/`fa`/`qa`/`lg`/`nm`/`en`/`pt` は不変）
**`industries` だけが変わる既存中分類（6）**：`kn/rule` `dc/report` `gn/daily` `po/collect` `po/mgmt` `eg/sysspec`

---

## 6. 受け入れ条件

### 6-1. 全 PR 共通

- `npm test`（`node tools/verify.mjs && node tools/regress.mjs`）が **ALL PASS**
- `npm run index` を実行済み（verify §11 の鮮度検査が PASS）
- **§0-1 と各 PR の「触らない範囲」に差分が無い**（reviewer が diff で確認）
- PR 本文に：設計書パス・変更要約・`npm test` の出力（末尾の集計行）・**warn 件数の変化**・触っていない範囲

### 6-2. PR ごと

| PR | 機械で確かめられること |
|---|---|
| **PR-1** | `verify` の §1 が `INDUSTRIES=3` を報告／`regress` が `業種別 svcs: mfg=49 fin=29 it=0 ／ 重複を除いた合計 = 67（svcs=67）`／`docs/service-map.md` に `①台本(IT)` 列がある／**`npm run world` の warn が 11 件のまま変わらない**（`data/world/it/` はまだ走査されない）／ブラウザで `mock/catalog.html` を開くと **IT ボタンが disabled で見える** |
| **PR-2** | `regress` が `業種別 svcs: mfg=49 fin=29 it=11 ／ 重複を除いた合計 = 67（svcs=67）`／verify §9 の**「業種 "it" で台本の無い SVCS」warn が出ない**（`SCENARIOS.it` がまだ無いため）／verify §10 が `HOME.it`/`FEED.it` を PASS／**IT ボタンが押せる**／IT で `dc2` を開いて `start` すると **`chat` にフォールバックし、青嶺精工・碧洋銀行の語が 1 つも出ない**（§3-1） |
| **PR-3** | `regress` が `cats:14 subs:33 svcs:77 tags:64` ／ `業種別 svcs: mfg=49 fin=29 it=21 ／ 重複を除いた合計 = 77（svcs=77）`／verify 5-b が `--cat-*` 14 個 × light/dark 対称を PASS／`docs/service-map.md` に `SL-01`〜`SL-03`・`KN-09`・`KN-10`・`PO-05`〜`PO-07`・`GN-08`・`DC-10` の 10 行がある（③ユースケース列は `—`）／**fin・mfg で見える分類・サービスの件数が 1 件も変わらない** |
| **PR-4** | verify §9-A が `js/data/scenarios/it/{sl,kn,po,gn,dc}.js` を PASS／verify §9 の warn が **「業種 "it" で台本の無い SVCS 11 件: kn4, kn5, dc2, dc8, gn6, gn7, po1, po2, po3, po4, eg1」**（PR-2 で開放した 11 件。**想定内**）／**`regress` が `--update` 無しで PASS**（データ層は変わらない）／`node tools/check-world.mjs` が `[it]` バケットを出力し、**跨ぎ（青嶺精工・碧洋銀行・蘇州工場・上海本部）を warn にしない**／**`[mfg]`・`[fin]` の warn が 11 件のまま変わらない**（逆流していない証拠） |
| **PR-5** | 受け取った id 一覧と `SVCS` の差分が 1 件ずつ対応／`mfg`・`fin` の件数が不変 |
| **PR-6** | `grep -rn "67 サービス\|13 分類\|29 中分類" README.md CLAUDE.md docs/` が 0 件（生成物 `docs/service-map.md` を除く） |

### 6-3. 人が見て確かめること（PM のモック承認）

1. `.mockbar` の業種セグメントが **製造 / 金融 / IT** の 3 つ（日・中・英の 3 言語すべてで折り返さずに収まる）
2. IT に切り替えるとヘッダーの社名とロゴが入れ替わり、**サイドバーが IT の分類だけ**になる
3. IT でお気に入りを付け、**製造に戻してもお気に入りが混ざらない**。リロードしても残る
4. 3 パターン（① ② ③）すべてで IT が破綻しない
5. **IT の分類の色（`sl` 赤橙）が light・dark の両方で読める**

---

## 7. 実機（Dify）への影響

### 7-1. 成熟度

**10 件すべて `st: 3`（構想）で入れる。**

- `st: 1`（提供中）にしない ＝ PM の指示どおり。実機が無いものを提供中にしない
- `st: 2`（試行版）にもしない。理由：**`docs/demo/briefing-coverage.md` は 67 サービスを成熟度で 7 つの Wave に切って実装計画を立てている**。実装リファレンス（`docs/dify/usecases/<番号>.md`）も無い段階で試行版に置くと、Wave の計画に「中身の無い 10 件」が紛れ込む
- **昇格の条件**：`docs/dify/usecases/<番号>.md` が書け、実現性が ◎/○ と評価されたら **3 → 2**。`dify/apps/<番号>-*.yml` を投入し `dify/tests/<番号>.json` が PASS したら **2 → 1**。どちらも `regress --update` を伴うデータ変更なので、そのときの PR 本文に理由を書く

なお **`fin` は試行版に実機の無いものを含む**（`KN-06`・`RS-01` など。verify §16 が「`dify/apps/…` が無い」と warn を出している）。IT で同じ状態を増やさないための判断。

### 7-2. 将来 `dify/**` を作るときの順番

本 Issue では `dify/apps/`・`dify/kb/`・`dify/tests/` を**作らない**。作るときは次の順で、**別 Issue・`run:runner` ラベル**（`CLAUDE.md` §7）：

| 順 | やること | 実行場所 | 備考 |
|---|---|---|---|
| 1 | `docs/dify/usecases/<番号>.md` 10 本（§1 に「人がやったら何分か」を入れる） | `run:cloud` | これが無いと DSL が書けない。**`SL-01`〜`SL-03` は 5 軸（分類・タグ・ペルソナ・入出力・出口）で `CV-01`/`CV-02` と重ならないことを確認する**（`/usecase` の統廃合判定） |
| 2 | `dify/env/` に IT 用の環境を足すかの判断 | `run:cloud` | **足さない見込み**。IT は業種であって環境ではない。KB を分けるだけなら `cloud-master` で足りる（`CLAUDE.md` §2-12） |
| 3 | `dify/kb/<番号>/` に `data/world/it/` 由来のダミー文書 | `run:cloud` | **`check-world.mjs` の `it` バケットが先に要る**（PR-4） |
| 4 | `dify/tests/<番号>.json`（`expect_lang` を含む） | `run:cloud` | §2-5 の応答言語契約 |
| 5 | `dify/apps/<番号>-*.yml`（マスタ DSL） | `run:cloud` | `render.py --env cloud-master --all --check` がバイト一致 |
| 6 | KB 投入 → テスト実行 → 公開 | `run:runner` | KB を持つアプリの公開は `run:mac`（#209 未実装） |

**最初に作る 1 本の推奨：`EG-01`（上流工程の仕様支援）ではなく、IT 固有の `KN-10`（規程と現場運用の食い違い検出）。** 理由：`diff` テンプレートで既存の `KN-08` と構成が近く、KB が規程 3 本（`ITR-08`/`ITR-12`/`ITR-21`）だけで足りる。**IT 世界だけで完結し、跨ぎの検証が要らない**。

---

## 8. PR 分割（6 本）

**並列は不可。`mock/js/data/catalog.js`・`home.js`・`tools/regress.baseline.json` が重なるため直列**（`CLAUDE.md` §5）。

| PR | 題 | 触るファイル | 触らないファイル | 大きさ |
|---|---|---|---|---|
| **PR-1** | 業種 `it` の足場と架空世界マスタ | `mock/js/data/ui.js`（`INDUSTRIES` 1 件）・`mock/js/data/style.js`（`IND_LOGO.it`）・`mock/js/app.js`（`state.industry` のコメントと `state.fav.it`）・`tools/verify.mjs`・`tools/regress.mjs`・`tools/gen-index.mjs`・`tools/regress.baseline.json`・`docs/service-map.md`・**`data/world/it/**` 8 ファイル**・`data/world/README.md` | **`catalog.js`・`home.js`・`render.js`・`events.js`・`css/**`・`tools/check-world.mjs`** | 中 |
| **PR-2** | 既存 11 件を IT に開放し、IT タブを押せるようにする | `mock/js/data/catalog.js`（`CATS` の `industries` 11 か所・`SVCS` の `industries` 11 か所）・`mock/js/data/home.js`（`HOME.it`・`FEED.it`）・`tools/regress.baseline.json`・`docs/service-map.md` | **`ui.js`・`style.js`・`css/**`・`tools/**`（baseline を除く）** | 中 |
| **PR-3** | IT 固有 10 サービス ＋ 分類 `sl` ＋ 中分類 2 ＋ タグ 7 ＋ 色 | `mock/js/data/catalog.js`・`mock/js/data/ui.js`（`TAGS` 7 個）・`mock/js/data/style.js`（`CAT_STYLE.sl`）・`mock/css/tokens.css`（`--cat-sl` light/dark の 2 行ずつ）・`mock/js/data/home.js`（recommended 1 件・items 2 件の差し替え）・`tools/regress.baseline.json`・`docs/service-map.md` | **`components.css`・`render.js`・`events.js`・`tokens.css` の `--ntt-*`** | **大**（3 言語の本文が多い） |
| **PR-4** | IT 台本 10 本 ＋ `check-world.mjs` の `it` バケット | `mock/js/data/scenarios/it/{sl,kn,po,gn,dc}.js`（新規 5）・`mock/catalog.html`（`<script src>` の追加 5 行）・`tools/check-world.mjs`・`data/world/README.md`（warn 表に `it` を追加） | **`js/data/*.js`（`scenarios/` を除く）・`tools/regress.baseline.json`（データ層は変わらない＝ `--update` 不要）** | 大 |
| **PR-5** | ポータルの 49 件のうち残りを IT に開放 | `mock/js/data/catalog.js`・`tools/regress.baseline.json`・`docs/service-map.md` | — | **一覧を受け取るまで着手しない**（§10 ③） |
| **PR-6** | 文書の件数更新 | `README.md`・`CLAUDE.md`（§2-3・§2-6・§6。**PM 承認後**）・`docs/demo/briefing-catalog.md`・`briefing-coverage.md`・`runbook-mfg.md`・`docs/dify/usecases/README.md`・`docs/handoff/service-index.md` | **`mock/**`・`tools/**`・`data/world/**`** | 小 |

**PR-1 と PR-2 を分ける理由**：PR-1 は `tools/**` を変える（検査の道具を変える PR は単独で見たい）。PR-1 だけをマージした状態でも `npm test` が PASS し、モックが壊れない（IT ボタンが disabled で出るだけ）ことを確かめられる。

**PR-3 と PR-4 を分ける理由**：`CLAUDE.md` §5 の「`js/data/scenarios/<分類>.js`（台本）と `js/data/*.js`（データ）は別ファイルなので別 PR にできる」。PR-4 は `SCENARIOS.it` を作った瞬間に warn の出かたが変わる（§3-1）ので、データ変更と混ぜない。

**`mock/catalog.html` の `<script src>` の並びが唯一の正**（§2-3）。PR-4 で追加する 5 行は `data/scenarios/fin/*.js` の**後ろ**、`app.js` の**前**に置く。

---

## 9. `CLAUDE.md` と `data/world/README.md` への変更提案（**PM 承認が要る。本 PR では書き換えない**）

### 9-1. `CLAUDE.md`

#### §2-3（load-bearing。**PM 承認必須**）

| 現行 | 提案 |
|---|---|
| `**状態**：state = { … }。`industry` は業種（`mfg`/`fin`）。 | `**状態**：state = { … }。`industry` は業種（`mfg`/`fin`/`it`）。 |
| （`scenarios/<分類>.js`（`SCENARIOS`。大分類ごと 8 ファイル、`window.SCENARIOS` に `Object.assign` で登録）） | **既に実態とずれている**（現在は `scenarios/<業種>/<分類>.js` で `mfg` 10・`fin` 8 ファイル）。`scenarios/<業種>/<分類>.js`（`SCENARIOS[業種][id]`。業種ごと・大分類ごとに 1 ファイル、`window.SCENARIOS` に `Object.assign` で登録）` に直すことを併せて提案する |

#### §2-6（load-bearing。**変更不要**）

`mock.fav` は業種ごと `{mfg:[…], fin:[…]}` → `{mfg:[…], fin:[…], it:[…]}` の例示を直すだけ。**許可集合は 3 キーのまま変わらない**（§4-4-3）ので、§2-6 の本質は変えない。

#### §2-13（load-bearing。**PM 承認必須**）

末尾に 1 項目追加：

> - **世界を跨ぐのは IT 世界だけ、かつ社名と拠点名だけ。** `data/world/it/`（日系 SIer の中国拠点）は**顧客として `mfg`・`fin` の会社名と拠点名を参照してよい**（`clients.csv` の `ref_world` 列で明示する）。**人・部署・品番・設備・KPI・文書番号は跨がない。** 逆方向（`mfg`/`fin` の台本・KB・テストに IT 世界の語を出すこと）は**禁止**。`tools/check-world.mjs` は `it` バケットの W1（社名）/W5（拠点）でだけ許可集合を和集合にし、他の検査は `it` のみで判定する。設計書 `docs/handoff/2026-09-11-it-industry.md` §3-4

#### §6（バックログ。load-bearing ではない）

「顧客版カタログ」の最終文を差し替える：

> 金融版カタログ（#120、架空の碧洋銀行、業種切替は `.mockbar`）で RS・CV・FA・PO・EG の 5 分類と金融向けサービスが加わり、**GN-07 幹部来訪・出張アテンド段取り**（#132）も追加された結果、13 分類 29 中分類 67 サービスになった。さらに **IT 版カタログ**（架空の日系 SIer 中国拠点。社内ポータル #242 と同じ世界）で **SL 営業・案件管理**の 1 分類と IT 固有 10 サービスが加わり、現在は **14 分類 33 中分類 77 サービス**（製造 49／金融 29／IT 21、提供中 12／試行版 29／構想 36）。IT 業の既存サービスへの開放は段階的（設計書 `docs/handoff/2026-09-11-it-industry.md` §3-3）。設計書は `docs/handoff/2026-09-06-*.md`・`2026-09-08-finance-catalog.md`・`2026-09-11-it-industry.md`、実現性は `docs/dify/`

### 9-2. `data/world/README.md`（PR-1 で実装。§2 ではないので PM 承認は不要だが、内容は本書が正）

1. 見出し「## 2 つの世界（製造業／金融）」→「## 3 つの世界（製造業／金融／IT）」
2. 「**2 つの世界の語彙は混ぜない**」の段落に**例外を 1 つ**加える（§9-1 の §2-13 と同じ文言）
3. 「## 何がここにあるか（IT／`data/world/it/`）」の表を追加（§3-4 のファイル表）
4. 「## 追加時のルール」に 1 項目追加：
   > 6. **3 つの世界を通じて姓名の完全一致を作らない。** 名（下の名前）の 3 回目以降の再利用も避ける（デモの口頭説明で「建国さん」が 3 人になると事故る）。**取引先・協力会社の記号は世界ごとに体系を分ける**：`mfg` はラテン大文字（`K 社`）、`fin` は十干（`甲社`）、`it` はギリシャ文字（`α 社`）
5. 「## 未統一」に「### IT（it）」の節を追加（PR-4 で `check-world` が `it` を見るようになってから。**PR-1 時点では warn 0 件なので節だけ作って「現時点 0 件」と書く**）
6. 既存の「人物 17 名」「人物 14 名」の記述が実数（mfg 20・fin 17）とずれているので、**PR-1 で併せて直す**

---

## 10. PM 判断待ち（推奨つき）

| # | 決めること | 推奨 | いつまでに |
|---|---|---|---|
| **①** | **IT 業の会社名（3 言語）** | **A: 翠雲システムズ / 翠云系统 / Suiun Systems, Ltd.**（§3-4-3）。**「N 社」は使わない**（`mfg` の取引先記号 `K 社`・`S 社` と同形で誤読される） | **PR-1 着手前** |
| **②** | **分類 `sl` 営業・案件管理の新設と 10 件の配置**（§3-2・§2） | 本書のとおり。承認後に `SL-01`〜`SL-03` などの管理番号が**永久欠番として確定**する | **PR-3 着手前**（早いほどよい） |
| **③** | **ポータルの 49 件の id 一覧** | 一覧が来るまで PR-5 に着手しない。来ない場合は **PR-2 の 11 件だけで IT カタログを成立させる**（成立する） | PR-5 着手前 |
| **④** | **`CLAUDE.md` §2-3・§2-13 の書き換え**（§9-1） | 承認。§2-13 の例外は**明文化しないと次の人が同じ問いを立てる** | PR-6 着手前 |
| **⑤** | 人物 4 名の改名（高橋 亮 の改名は**必須**。李 婷・周 建国・石田 真希 は推奨） | **決定済み（PM 2026-09-11）**：4 名とも改名し、**篠崎 悠真／黄 思涵／蔡 文博／村井 拓也（据置）／岸本 奈津**に確定（§3-4-1 の確定表が正本）。ポータル側に同じ名前を使わせる | ~~PR-1 着手前~~ 完了 |
| **⑥** | 記号体系をギリシャ文字（`α 社`）にすること（§3-4-2） | 採用。`S 社`・`T 社`・`U 社` は **`mfg` で使用中なので使えない**（`S 社` は製造台本に 51 回出る） | PR-1 着手前 |
| **⑦** | `CATS` での `sl` の並び位置（末尾） | 末尾でよい。気に入らなければ S レーンで動かせる（件数も id も変わらない） | いつでも |
| **⑧** | IT サービスに `added`（NEW バッジ）を付けるか | **付けない**（マージ日に依存し、デモ日が動くと説明が事故る） | いつでも |

### 10-1. ポータル側（別 architect）との調整事項

**本書は `docs/handoff/2026-09-10-portal-nocobase.md` を変更しない。** ただし次の 3 点は**ポータル側にも反映が要る**ので、PM から伝える：

1. **人物 4 名の改名**（§3-4-1 の確定表＝**篠崎 悠真／黄 思涵／蔡 文博／岸本 奈津**。`村井 拓也` は据置）。`高橋 亮` は既存マスタと完全衝突
2. **記号 `C 社`/`D 社`/`S 社`/`T 社`/`U 社` の廃止**（§3-4-2）。`S 社`・`T 社`・`U 社` は `mfg` で使用中
3. **「N 社」を正式社名にしない**（§3-4-3）

いずれも `data/world/it/` を**本リポジトリが正本として持つ**（`CLAUDE.md` §2-13）ので、ポータル側は**参照するだけ**になる。方向は「現リポ → 新リポの片方向のみ」（ポータル設計書 §6 の取り決めと同じ）。

---

## 11. 追補

> **§0〜§10 は 1 バイトも書き換えていない**（`CLAUDE.md` §4・sysops 設計書 §15 の作法）。
> 本節は PM 決定を記録するためだけに足した。矛盾する箇所については、**本節が §3・§10 より優先する**。

### 11-1. 会社名の確定（**PM 決定 2026-09-11・決定 3-②**。§3-4-3 と §10 ① の回答）

**決定：IT 業（自部門）の架空社名は、案 A で確定する。**

| | ja | zh | en |
|---|---|---|---|
| **本社** | **翠雲システムズ株式会社** | **翠云系统股份有限公司** | **Suiun Systems, Ltd.** |
| **現地法人** | 翠雲系統（上海）有限公司 | 翠云系统（上海）有限公司 | Suiun Systems (Shanghai) Co., Ltd. |
| **`INDUSTRIES.it.wordmark`** | 翠雲システムズ | 翠云系统 | SUIUN SYSTEMS |

**§3-4-3 が残していた 1 点（「本環境からは実在名との衝突を調査できない」ので PM が最終確認する）は、
PM が実名衝突を確認して OK と回答したことで解消した。**案 B（黎星システムズ）・案 C（明澄システムズ）は
**不採用**。`fin` の「瑞央 → 碧洋」のような差し替えは発生しない。

| | 内容 |
|---|---|
| **§10 ① の状態** | **⏳ PR-1 着手前 → ✅ 決定済み。**§10 の PM 判断待ちで残るのは **②③④⑦⑧** |
| **正本の置き場** | **`data/world/it/company.md`**（`CLAUDE.md` §2-13・§3-4-2）。**社名の 3 言語表記をここ以外に二重に持たない**。`INDUSTRIES.it.wordmark` と IT 台本は**この値を写すだけ** |
| **書く場所は 3 つだけ** | §3-4-3 の記述どおり：① `data/world/it/company.md` ② `INDUSTRIES.it.wordmark`（`mock/js/data/catalog.js`）③ IT 台本（`mock/js/data/scenarios/it/*.js`）。**後から衝突が分かったときに差し替える範囲もこの 3 か所に閉じる** |
| **「N 社」** | **使わない**（§3-4-3 のとおり。`mfg` の取引先記号 `K 社`・`S 社` と同形で誤読される） |
| **本文の書き換え** | **不要。**§3-4-3 の表の「**A（推奨）**」行と §4-2 の `wordmark` 例、§10 ① の推奨が**そのまま確定値**になった（語は 1 文字も変わっていない） |

**他の設計書との関係**：`docs/handoff/2026-09-10-portal-nocobase.md` §11-17'（自部門の社名。「残る確認は 1 つだけ＝
実在企業と一致しないことを PM が確認する」）も**同じ決定で決着する**。同書 §18-2 に記録した。
**本節が記録の正本**であり、ポータル側は参照するだけ（§10-1 の方向「現リポ → 新リポの片方向のみ」と同じ）。

**着手できるようになったもの**：PR-1（`data/world/it/` の新設）は**社名の確定を待っていたので着手可**。
ただし **②（分類 `sl` の新設と 10 件の配置）は未決のまま**で、PR-3 は引き続き止まっている。
