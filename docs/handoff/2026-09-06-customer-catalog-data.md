# 顧客版カタログ A：メニュー（データ層）差し替え設計書

- 日付：2026-09-06
- 作成：architect
- レーン：**M/L**（データ層 `CATS` / `SVCS` / `TAGS` と UI 辞書 `T.wordmark` に触る。§2-1 / §2-9）
- 対象：`mock/catalog.html`
- 対の設計書：`docs/handoff/2026-09-06-demo-scenarios.md`（B：デモ遷移。本書の id を前提にする）
- Issue 下書き：`docs/handoff/customer-catalog-data.issue.md`

---

## 0. 目的 / 背景

AIエージェントカタログのモックを、**在中日系製造業（中国工場）向け**の顧客版に仕立てる。
本書は 2 本のうちの **A：データ層差し替え**。分類（`CATS`）・サービス（`SVCS`）・タグ（`TAGS`）を顧客向けに再編し、ヘッダーのワードマークを仮社名にする。

PM の判断済み事項（本書ではそのまま前提にする）：

1. **粒度は「業務シナリオ」**。カタログ 1 項目＝担当者が「これ 1 つで悩みが片付く」と感じる単位。細かい機能は `desc` の中に畳む。
2. **悩んだら残す**。旧 33 件のうち工場顧客に明らかに無関係なものだけ落とす。判断は旧 33 件すべてについて 1 行ずつ書く（§4）。
3. 入力素材はコンサル案「その１」（機能粒度 28 件）・「その２」（シナリオ粒度 5 件）・PM 追加 1 件（当局通達の影響分析・マニュアル反映）。
4. 成熟度は `st: 1 提供中 / 2 試行版 / 3 構想`。データ整備・技術難度の壁が高いものは正直に 3。
5. **メニュー文言は ja / zh / en 3 言語必須**（§2-1）。en はドラフト可・空にしない。「日中対応」をタグにしない（§2-5）。
6. 仮社名は明らかに架空のもの。色・書体などデザインは NTT DATA トークンのまま。

§2-9 のとおり **描画ロジックには一切触らない**。データだけを差し替える。

---

## 1. 変更する範囲

| ファイル | 箇所 | 変更 |
|---|---|---|
| `mock/catalog.html` | `const TAGS = {…}` | 全置換（36 → 35 キー） |
| `mock/catalog.html` | `const CATS = […]` | 全置換（6 分類 12 中分類 → **7 分類 15 中分類**） |
| `mock/catalog.html` | `const SVCS = […]` | 全置換（33 件 → **33 件**。id は全て新規） |
| `mock/catalog.html` | `T.wordmark` の値 | 仮社名に変更（キーは変えない） |
| `mock/catalog.html` | `const state` の `openCats: { doc: true }` / `lastCat: 'doc'` | 初期値の分類 id を新 id `kn` に変更（キーは変えない。`doc` は新 CATS に無いため） |
| `mock/catalog.html` | `SVCS` 直前のコメント `/* st: 1 = 提供中 / 2 = 試行版 …` | `1 / 2 / 3` の 3 段階に表記を合わせる（コメントのみ） |
| `tools/regress.baseline.json` | 全体 | `node tools/regress.mjs --update` で再生成（本書 §5 の件数・id と一致すること） |
| `mock/README.md` | 収録モック表の A 行 | 「大分類6×中分類12×33サービス」→「大分類7×中分類15×33サービス（在中日系製造業向け）」 |
| `mock/index.html` | 55 行目付近の説明文 | 同上の件数表記を更新（文言のみ） |

### 1-1. 触らない範囲（reviewer の diff 監査基準）

- `T` の **キー集合**（`wordmark` の値のみ変える。キー追加・削除なし → regress の `uiKeys` は不変）
- `PATTERNS`
- `state` の**キー集合**・`view` の値域・`data-act` の一覧（§2-3）
- 描画関数（`renderSidebar` / `renderMain` / `cardHTML` / `detailHTML` 等）・イベントハンドラ・`detectLang` / `L` / `filtered` などヘルパー
- 2 つの `<style>` ブロック（トークン・コンポーネント CSS）。`--ntt-*` は不変（§2-2）
- `.wordmark` の見た目（dashed 枠のプレースホルダ表現も**このお題では変えない**。文字だけ差し替える）
- ヘッダーの `dept`（情報システム部）・`appTitle`・アバター
- `.mockbar` / 言語切替 / テーマ切替 / `localStorage` キー（§2-4 / §2-6）
- `tools/verify.mjs` / `tools/regress.mjs` のロジック
- `.github/workflows/pages.yml` / `mock/.nojekyll`
- `mock/top.html`（バンドル済み・手編集不可）

---

## 2. 再編の考え方（architect の決定）

### 2-1. 分類軸：**7 分類**（PM 叩き台 6 分類 ＋「汎用業務支援」）

PM 叩き台の 6 分類をそのまま採用し、「悩んだら残す」で残った汎用業務（経費・請求書・受発注・日程・要約）を **7 つ目「汎用業務支援」** に収容する。
理由：汎用業務を既存 6 分類に散らすと「文書・資料作成」が 9 件超に膨らみ、シナリオ粒度の意図（1 分類 3〜7 件で見渡せる）が崩れる。また顧客に「これは製造現場固有、これは事務の汎用」と説明しやすい。

| # | 分類 id | ja | 件数 | 中分類 id |
|---|---|---|---|---|
| 1 | `kn` | ナレッジ検索・問い合わせ | 5 | `tech`（技術・設備ナレッジ）/ `rule`（規程・労務・当局） |
| 2 | `qa` | 品質・不具合対応 | 4 | `defect`（不具合分析・報告）/ `change`（変更・クレーム・監査） |
| 3 | `dc` | 文書・資料作成 | 7 | `report`（報告・会議）/ `site`（教育・現場掲示）/ `apply`（申請・契約・貿易） |
| 4 | `lg` | 日中コミュニケーション | 4 | `trans`（翻訳・用語）/ `align`（認識合わせ・連絡） |
| 5 | `nm` | 見積・数字 | 5 | `cost`（見積・原価・購買）/ `actual`（実績・在庫・分析） |
| 6 | `en` | 図面・BOM・技術文書 | 3 | `spec`（仕様・標準書）/ `bom`（BOM・図面） |
| 7 | `gn` | 汎用業務支援 | 5 | `office`（経理・受発注）/ `daily`（日常業務） |

- 「貿易・申請」は PM 指示どおり独立分類にせず、`dc` の中分類 `apply` に吸収（稟議・契約・通関の 3 件で中分類として成立する）。
- 分類の並び順＝**顧客の関心順**（探す → 品質 → 作る → 言葉 → 数字 → 図面 → 汎用）。旧「文書作成」先頭から変える。
- 中分類 id は**全体で一意**にする（`filtered()` / `countSub()` は `sub` だけで絞るため、分類をまたいで同じ id を使うと件数が混ざる）。

### 2-2. id 体系

旧 id（`m1` `d1` `a1` `v1` `s1` `f1` `w1` `c1` `g1`…）は**一切再利用しない**。
再利用すると `regress.mjs` が「分類移動」「成熟度変更」として報告し、削除＋追加の実態が読めなくなる。新 id は「分類 id ＋ 連番」（`kn1`…`gn5`）。B の設計書（シナリオ）はこの id をキーにする。

### 2-3. 成熟度の付け方

| st | 基準 | 例 |
|---|---|---|
| 1 提供中 | 文書を読んで答える／書く。RAG＋生成で今日から動く | 技術ナレッジQA、翻訳、議事録、日報集計 |
| 2 試行版 | 社内データの整備（不具合台帳・BOM・規程の構造化）や業務ルール取り込みが前提 | 8D 作成、BOM 逆引き、稟議記載漏れ、通関書類確認 |
| 3 構想 | 図面認識・履歴データの蓄積・原価モデルなど技術／データの壁が高い | 図面類似検索、4M 変更影響予測、見積り・原価計算 |

内訳：**st1 = 15 件 / st2 = 15 件 / st3 = 3 件**。

### 2-4. タグの方針

- タグ＝「業務キーワード」。分類の重複ではなく、横断検索の手がかり（`filtered()` はタグ文言も検索対象）。
- 1 サービス 1〜2 個。**未使用タグを残さない**（`verify.mjs` が warn を出す）。
- 「日中対応」「翻訳可」のような全サービス共通の前提はタグにしない（§2-5）。ただし**翻訳そのものが業務**である `lg1` には `translate` を付ける（これは区別タグではなく業務名）。

---

## 3. 新メニュー：全文言（ja / zh / en）

> implementer はこの節を **そのまま転記**する。翻訳・言い換えをしない。en はモック用ドラフト（要ネイティブレビュー）。
> 表記ゆれ防止：ja の「日中」は「日中」、zh は「中日」（中国側の慣用）、en は「JP–CN」。

### 3-1. `T.wordmark`（仮社名）— 推奨案

| key | ja | zh | en |
|---|---|---|---|
| `wordmark` | `青嶺精工` | `青岭精工` | `SEIREI SEIKO` |

- 読み：せいれいせいこう。「青嶺（せいれい）」は一般名詞の組み合わせで、実在の上場企業・大手部品メーカーの商号と重ならないことを確認して選んだ（架空であることが一目で分かる程度に無個性）。
- 代替案は §7 PM 判断待ちに列挙。`.wordmark` の dashed 枠はプレースホルダ表現のまま残す（デザイン不変の指示）。

### 3-2. `TAGS`（34 キー）

旧 36 キーを全置換。順序は下表のまま（辞書順ではなく業務順。`regress` はソートして比較するので順序は自由）。

| key | ja | zh | en |
|---|---|---|---|
| `search` | 検索 | 检索 | Search |
| `faq` | 問い合わせ対応 | 咨询应答 | Inquiry |
| `equipment` | 設備 | 设备 | Equipment |
| `regulation` | 社内規程 | 公司规章 | Policies |
| `hr` | 労務 | 劳务人事 | HR & Labor |
| `authority` | 当局・法規 | 监管法规 | Regulators |
| `defect` | 不具合 | 不良 | Defects |
| `rootcause` | 原因分析 | 原因分析 | Root cause |
| `report8d` | 8D報告 | 8D报告 | 8D report |
| `change4m` | 4M変更 | 4M变更 | 4M change |
| `claim` | クレーム | 客诉 | Claims |
| `audit` | 監査 | 审核 | Audits |
| `report` | 報告資料 | 汇报资料 | Reports |
| `meeting` | 会議 | 会议 | Meetings |
| `education` | 教育・OJT | 培训・OJT | Training |
| `safety` | 安全・5S | 安全・5S | Safety & 5S |
| `approval` | 稟議・申請 | 审批申请 | Approvals |
| `trade` | 輸出入・通関 | 进出口・报关 | Trade & customs |
| `contract` | 契約 | 合同 | Contracts |
| `translate` | 翻訳 | 翻译 | Translation |
| `glossary` | 用語集 | 术语表 | Glossary |
| `procedure` | 手順書 | 作业指导 | Procedures |
| `mail` | メール | 邮件 | Email |
| `costing` | 原価 | 成本 | Costing |
| `purchase` | 購買 | 采购 | Procurement |
| `kpi` | 実績集計 | 实绩汇总 | KPIs |
| `inventory` | 在庫・納期 | 库存・交期 | Inventory & lead time |
| `analysis` | データ分析 | 数据分析 | Data analysis |
| `spec` | 仕様書 | 规格书 | Specifications |
| `bom` | BOM | BOM | BOM |
| `drawing` | 図面 | 图纸 | Drawings |
| `finance` | 経理 | 财务 | Finance |
| `order` | 受発注 | 订单 | Orders |
| `calendar` | 日程 | 日程 | Scheduling |
| `summary` | 要約 | 摘要 | Summaries |

（**35 キー**。全キーが下記 SVCS のいずれかで使われる。）

### 3-3. `CATS`（7 分類 / 15 中分類）

```js
const CATS = [
  { id: 'kn',
    name: { ja: 'ナレッジ検索・問い合わせ', zh: '知识检索与咨询', en: 'Knowledge & Inquiry' },
    abbr: { ja: 'ナレッジ', zh: '知识', en: 'Knowledge' },
    subs: [
      { id: 'tech', name: { ja: '技術・設備ナレッジ', zh: '技术与设备知识', en: 'Technical & Equipment' } },
      { id: 'rule', name: { ja: '規程・労務・当局', zh: '规章・劳务・监管', en: 'Policies, HR & Regulators' } }
    ]},
  { id: 'qa',
    name: { ja: '品質・不具合対応', zh: '质量与不良应对', en: 'Quality & Defect Response' },
    abbr: { ja: '品質', zh: '质量', en: 'Quality' },
    subs: [
      { id: 'defect', name: { ja: '不具合分析・報告', zh: '不良分析与报告', en: 'Defect Analysis & Reporting' } },
      { id: 'change', name: { ja: '変更・クレーム・監査', zh: '变更・客诉・审核', en: 'Change, Claims & Audits' } }
    ]},
  { id: 'dc',
    name: { ja: '文書・資料作成', zh: '文档与资料制作', en: 'Documents & Reports' },
    abbr: { ja: '文書', zh: '文档', en: 'Docs' },
    subs: [
      { id: 'report', name: { ja: '報告・会議', zh: '汇报与会议', en: 'Reporting & Meetings' } },
      { id: 'site',   name: { ja: '教育・現場掲示', zh: '培训与现场看板', en: 'Training & Shop Floor' } },
      { id: 'apply',  name: { ja: '申請・契約・貿易', zh: '申请・合同・贸易', en: 'Applications, Contracts & Trade' } }
    ]},
  { id: 'lg',
    name: { ja: '日中コミュニケーション', zh: '中日沟通', en: 'JP–CN Communication' },
    abbr: { ja: '日中', zh: '中日', en: 'JP–CN' },
    subs: [
      { id: 'trans', name: { ja: '翻訳・用語', zh: '翻译与术语', en: 'Translation & Terminology' } },
      { id: 'align', name: { ja: '認識合わせ・連絡', zh: '共识确认与联络', en: 'Alignment & Correspondence' } }
    ]},
  { id: 'nm',
    name: { ja: '見積・数字', zh: '报价与数据', en: 'Costing & Numbers' },
    abbr: { ja: '数字', zh: '数据', en: 'Numbers' },
    subs: [
      { id: 'cost',   name: { ja: '見積・原価・購買', zh: '报价・成本・采购', en: 'Quotes, Costing & Procurement' } },
      { id: 'actual', name: { ja: '実績・在庫・分析', zh: '实绩・库存・分析', en: 'Actuals, Inventory & Analysis' } }
    ]},
  { id: 'en',
    name: { ja: '図面・BOM・技術文書', zh: '图纸・BOM・技术文档', en: 'Drawings, BOM & Tech Docs' },
    abbr: { ja: '図面', zh: '图纸', en: 'Drawings' },
    subs: [
      { id: 'spec', name: { ja: '仕様・標準書', zh: '规格与作业标准', en: 'Specs & Standards' } },
      { id: 'bom',  name: { ja: 'BOM・図面', zh: 'BOM与图纸', en: 'BOM & Drawings' } }
    ]},
  { id: 'gn',
    name: { ja: '汎用業務支援', zh: '通用业务支持', en: 'General Office Support' },
    abbr: { ja: '汎用', zh: '通用', en: 'General' },
    subs: [
      { id: 'office', name: { ja: '経理・受発注', zh: '财务与订单', en: 'Finance & Orders' } },
      { id: 'daily',  name: { ja: '日常業務', zh: '日常业务', en: 'Daily Work' } }
    ]}
];
```

> 注意：中分類 id `bom` と TAGS の `bom`、中分類 id `report` と TAGS の `report` は**別の辞書**なので衝突しない（`subOf` と `tag` は別関数）。ただし混同しやすいので、SVCS の `sub` と `tags` を書き間違えないこと。

### 3-4. `SVCS`（33 件）

並び順＝この表の順（分類順 → 中分類順 → 連番）。`regress` は並び順も比較する。

```js
/* st: 1 = 提供中 / 2 = 試行版 / 3 = 構想
   en は機械下訳ベースのドラフト（モック用途・要ネイティブレビュー）
   対象顧客：在中日系製造業（中国工場）。全サービス日中どちらの入力も受ける（§2-5） */
const SVCS = [
  /* ---- kn: ナレッジ検索・問い合わせ ---- */
  { id: 'kn1', cat: 'kn', sub: 'tech', st: 1, tags: ['search'],
    name: { ja: '技術ナレッジQA', zh: '技术知识问答', en: 'Technical Knowledge QA' },
    desc: { ja: '過去の設計書・工程条件・技術報告・トラブル対応記録を横断検索し、根拠箇所を引用して技術的な質問に答えます。「この材質の推奨加工条件は？」「前にも同じ症状はあった？」に即答し、属人化したノウハウの継承を支援します。',
            zh: '跨越设计文档、工艺条件、技术报告与故障处置记录进行检索，引用依据回答技术问题。例如"这种材质的推荐加工条件是什么""以前有没有同样的现象"，助力经验传承。',
            en: 'Searches design documents, process conditions, technical reports and trouble records, then answers technical questions with quoted sources — e.g. recommended machining conditions for a material, or whether a symptom has occurred before.' } },
  { id: 'kn2', cat: 'kn', sub: 'tech', st: 1, tags: ['equipment', 'search'],
    name: { ja: '設備マニュアル・取扱説明書の検索', zh: '设备手册与说明书检索', en: 'Equipment Manual Search' },
    desc: { ja: '設備メーカーの取扱説明書・保全手順・アラームコード表から該当ページを探し、手順を要約して返します。中国語で聞いて日本語マニュアルの該当箇所を引くなど、言語をまたいだ検索に対応します。',
            zh: '从设备厂商的说明书、保全手册与报警代码表中找到相关页面并概括操作步骤。支持跨语言检索，例如用中文提问、引用日文手册的对应位置。',
            en: 'Finds the relevant page in equipment manuals, maintenance procedures and alarm-code tables and summarizes the steps. Works across languages — ask in Chinese, get the matching section of a Japanese manual.' } },
  { id: 'kn3', cat: 'kn', sub: 'rule', st: 1, tags: ['regulation', 'hr'],
    name: { ja: '社内規程・就業規則QA', zh: '公司规章与员工手册问答', en: 'Company Policy & Work Rules QA' },
    desc: { ja: '就業規則・経費規程・出張規程・工場管理規定などの社内文書から、根拠条文を引用して質問に答えます。日本語版と中国語版の規程を突き合わせ、版ズレがあれば併記して注意を促します。',
            zh: '从员工手册、费用规定、出差规定、工厂管理规定等公司文件中引用条款回答提问。同时对照日文版与中文版规章，若版本不一致则并列提示。',
            en: 'Answers questions by quoting the governing clause from work rules, expense and travel policies and factory regulations. Cross-checks the Japanese and Chinese editions and flags any version mismatch.' } },
  { id: 'kn4', cat: 'kn', sub: 'rule', st: 2, tags: ['faq', 'hr'],
    name: { ja: '労務・総務の社内問い合わせ対応', zh: '劳务与总务内部咨询应答', en: 'HR & Admin Internal Helpdesk' },
    desc: { ja: '入社手続き・社会保険・休暇申請・証明書発行・IT 申請などの定型質問に、社内 FAQ と申請手順をもとに自動回答します。回答できない質問は担当部署へ引き継ぎ、問い合わせ履歴を分類して残します。',
            zh: '基于内部FAQ与申请流程，自动回答入职手续、社保、休假申请、证明开具、IT申请等常见问题。无法回答时转交相关部门，并对咨询记录进行分类留存。',
            en: 'Auto-answers routine questions on onboarding, social insurance, leave, certificates and IT requests from internal FAQs and procedures. Hands unresolved questions to the responsible team and logs them by category.' } },
  { id: 'kn5', cat: 'kn', sub: 'rule', st: 2, tags: ['authority', 'regulation'],
    name: { ja: '当局通達の影響分析・マニュアル反映（NFRA・地方当局等）', zh: '监管通知影响分析与手册更新（金融监管总局・地方主管部门等）', en: 'Regulatory Notice Impact & Manual Update (NFRA, local authorities)' },
    desc: { ja: '国家金融監督管理総局（NFRA）・税務・海関・地方政府などの通達を読み込み、自社への影響（対象業務・期限・必要な対応）を整理します。さらに影響を受ける社内マニュアル・規定の該当箇所を特定し、改訂案のドラフトまで作成します。',
            zh: '读取国家金融监督管理总局、税务、海关、地方政府等的通知文件，整理对本公司的影响（涉及业务、期限、应对事项），并定位受影响的内部手册与规定条款，生成修订草案。',
            en: 'Reads notices from the NFRA, tax and customs authorities and local governments, summarizes the impact on your company (affected operations, deadlines, required actions), then locates the affected internal manuals and drafts the revisions.' } },

  /* ---- qa: 品質・不具合対応 ---- */
  { id: 'qa1', cat: 'qa', sub: 'defect', st: 2, tags: ['defect', 'rootcause', 'report8d'],
    name: { ja: '不具合原因分析・報告書（8D）作成', zh: '不良原因分析与8D报告制作', en: 'Defect Root-Cause Analysis & 8D Report' },
    desc: { ja: '不良の発生状況を入力すると、過去の類似不具合・対応記録を検索して原因候補（なぜなぜ）を提示し、8D 形式の不具合報告書・品質記録のドラフトを作成します。是正処置の妥当性チェックと、日本語・中国語の報告書の同時出力に対応します。',
            zh: '输入不良发生情况后，检索历史类似不良与处置记录，给出原因假设（5Why），并生成8D格式的不良报告与质量记录草案。支持纠正措施的合理性检查，以及中日双语报告同时输出。',
            en: 'Given the facts of a defect, searches similar past defects and countermeasures, proposes root-cause hypotheses (5-Why) and drafts the 8D report and quality record. Checks corrective actions and outputs the report in Japanese and Chinese.' } },
  { id: 'qa2', cat: 'qa', sub: 'change', st: 3, tags: ['change4m'],
    name: { ja: '変更点影響予測（4M変更管理）', zh: '变更点影响预测（4M变更管理）', en: 'Change Impact Prediction (4M Change Control)' },
    desc: { ja: '材料・工程・人・設備（4M）の変更申請時に、過去の変更履歴と不具合記録から「この変更で過去に何が起きたか」を照合し、影響を受ける工程・特性・顧客承認の要否を申請時点で提示します。変更管理の抜け漏れを事前に防ぎます。',
            zh: '在材料・工艺・人员・设备（4M）变更申请时，对照历史变更记录与不良记录，提示"此类变更过去发生过什么"，并在申请阶段给出受影响的工序、特性以及是否需要客户承认，防止变更管理遗漏。',
            en: 'When a 4M change (material, method, man, machine) is requested, matches it against past change history and defect records to show what happened before, and flags affected processes, characteristics and customer-approval needs at request time.' } },
  { id: 'qa3', cat: 'qa', sub: 'change', st: 2, tags: ['claim'],
    name: { ja: '顧客クレーム一次回答・分類', zh: '客户投诉初步回复与分类', en: 'Customer Claim First Response & Triage' },
    desc: { ja: '顧客からのクレーム連絡（メール・帳票・電話メモ）を要約し、重要度・区分・担当部門を判定して一次回答文を作成します。同種クレームの傾向も集計し、重大案件は即時にエスカレーションします。日本の顧客への日本語回答、中国の顧客への中国語回答を切り替えて作成できます。',
            zh: '总结客户的投诉（邮件、单据、电话记录），判定重要度、类别与责任部门，并生成初步回复。统计同类投诉趋势，重大案件即时上报。可按客户分别生成日文或中文回复。',
            en: 'Summarizes customer claims from email, forms or call notes, judges severity, category and owning department, and drafts the first response. Tracks recurring claim patterns and escalates serious cases immediately. Replies in Japanese or Chinese to match the customer.' } },
  { id: 'qa4', cat: 'qa', sub: 'change', st: 2, tags: ['audit', 'report'],
    name: { ja: '完成車メーカー工程監査への対応資料', zh: '整车厂工艺审核应对资料', en: 'OEM Process Audit Response Pack' },
    desc: { ja: '完成車メーカーの工程監査チェックリストを読み込み、各項目に対応する社内の管理文書・記録・実績データを紐づけて回答案と提出資料一覧を作成します。指摘事項への是正計画書のドラフトにも対応します。',
            zh: '读取整车厂的工艺审核检查表，将每一项与内部管理文件、记录和实绩数据关联，生成回答草案与提交资料清单。也可起草针对指出事项的纠正计划书。',
            en: 'Reads an OEM process-audit checklist, maps each item to your control documents, records and performance data, and produces draft answers plus a submission list. Also drafts corrective-action plans for findings.' } },

  /* ---- dc: 文書・資料作成 ---- */
  { id: 'dc1', cat: 'dc', sub: 'report', st: 1, tags: ['report'],
    name: { ja: '日本本社への報告資料作成', zh: '面向日本总部的汇报资料制作', en: 'Reports for Japan Headquarters' },
    desc: { ja: '月次実績・品質状況・トピックスのメモや数字を渡すと、本社フォーマットの報告資料（要旨・実績・課題・対策）のドラフトを作成します。中国語の現場データから日本語の報告を直接起こせます。会議資料・報告資料全般に使えます。',
            zh: '提供月度实绩、质量状况与要点备注后，按总部格式生成汇报资料（要点・实绩・课题・对策）草案。可直接从中文现场数据生成日文汇报，也适用于一般会议资料。',
            en: 'Turns monthly figures, quality status and topic notes into a headquarters-format report draft (summary, results, issues, actions). Produces Japanese reports directly from Chinese shop-floor data; usable for meeting materials in general.' } },
  { id: 'dc2', cat: 'dc', sub: 'report', st: 1, tags: ['meeting', 'summary'],
    name: { ja: '議事録作成と次回論点整理', zh: '会议纪要生成与下次议题整理', en: 'Meeting Minutes & Next-Agenda Builder' },
    desc: { ja: '日中混在の会議録音・メモから、決定事項・担当・期限・未決事項を整理した議事録を作成し、次回会議で議論すべき論点リストを提案します。日本語版・中国語版の議事録を同時に出力できます。',
            zh: '基于中日混合的会议录音或笔记，整理决议事项、负责人、期限与待定事项生成纪要，并提出下次会议应讨论的议题清单。可同时输出中日双语纪要。',
            en: 'Builds minutes — decisions, owners, deadlines and open items — from mixed Japanese/Chinese recordings or notes, and proposes the agenda for the next meeting. Outputs Japanese and Chinese versions together.' } },
  { id: 'dc3', cat: 'dc', sub: 'site', st: 2, tags: ['education', 'procedure'],
    name: { ja: '教育・OJT資料作成', zh: '培训与OJT资料制作', en: 'Training & OJT Material Builder' },
    desc: { ja: '作業標準書・過去の不具合事例・安全ルールから、新人・異動者向けの教育資料（スライド・確認テスト・OJT チェックリスト）を作成します。作業者の母語に合わせて中国語版を主にし、監督者向けに日本語版を添えるといった出し分けができます。',
            zh: '基于作业标准书、历史不良案例与安全规则，生成面向新人与调岗人员的培训资料（课件、确认测试、OJT检查表）。可按对象区分输出：作业者用中文版，监督者附日文版。',
            en: 'Creates training decks, quizzes and OJT checklists for new and transferred staff from work standards, past defects and safety rules. Outputs Chinese for operators and Japanese for supervisors as needed.' } },
  { id: 'dc4', cat: 'dc', sub: 'site', st: 1, tags: ['safety', 'translate'],
    name: { ja: '安全衛生・5S掲示物・改善提案の中国語化', zh: '安全卫生・5S看板・改善提案的中文化', en: 'Chinese Versions of Safety, 5S Posters & Kaizen Sheets' },
    desc: { ja: '日本語で書かれた安全衛生ルール・5S 掲示物・改善提案シートを、現場で伝わる中国語の掲示文に書き起こします。逆に中国語の改善提案を日本語に整えて本社共有用にすることもできます。掲示に適した短い文と図解の見出しを提案します。',
            zh: '将日文的安全卫生规则、5S看板与改善提案表改写为现场易懂的中文看板文案；也可将中文改善提案整理成日文供总部共享。提供适合张贴的短句与图示标题建议。',
            en: 'Rewrites Japanese safety rules, 5S posters and kaizen sheets into shop-floor Chinese, and turns Chinese kaizen proposals into polished Japanese for headquarters. Suggests short poster-ready lines and illustration captions.' } },
  { id: 'dc5', cat: 'dc', sub: 'apply', st: 2, tags: ['approval'],
    name: { ja: '稟議・申請書の作成と記載漏れ検出', zh: '审批单与申请书的撰写及缺漏检查', en: 'Approval Request Drafting & Omission Check' },
    desc: { ja: '設備投資・修繕・購買・出張などの稟議書・申請書を、目的と条件を伝えるだけで社内フォーマットで作成します。金額基準に応じた承認ルートの判定、添付漏れ・記載漏れの検出、差し戻し理由の下書きまで支援します。',
            zh: '只需说明目的与条件，即可按公司格式生成设备投资、维修、采购、出差等审批单与申请书。支持按金额标准判定审批路径、检测附件与填写缺漏，并起草退回理由。',
            en: 'Drafts approval requests — capex, repairs, purchasing, travel — in your corporate format from the purpose and terms. Determines the approval route by amount, detects missing fields and attachments, and drafts rejection notes.' } },
  { id: 'dc6', cat: 'dc', sub: 'apply', st: 2, tags: ['trade'],
    name: { ja: '輸出入・通関書類の確認', zh: '进出口与报关单证核对', en: 'Import/Export & Customs Document Check' },
    desc: { ja: 'インボイス・パッキングリスト・契約書・HS コードの整合をチェックし、通関で差し戻されやすい不備（品名不一致・数量・原産地・単価）を指摘します。保税区の出入りや加工貿易手冊の消し込みに必要な書類一覧も案内します。',
            zh: '核对发票、装箱单、合同与HS编码的一致性，指出报关中易被退单的缺陷（品名不一致、数量、原产地、单价）。并提示保税区进出、加工贸易手册核销所需的单证清单。',
            en: 'Cross-checks invoices, packing lists, contracts and HS codes and flags the inconsistencies customs commonly rejects — item names, quantities, origin, unit prices. Lists documents needed for bonded-zone movements and processing-trade handbook reconciliation.' } },
  { id: 'dc7', cat: 'dc', sub: 'apply', st: 2, tags: ['contract', 'purchase'],
    name: { ja: 'サプライヤー契約書ドラフト支援', zh: '供应商合同起草辅助', en: 'Supplier Contract Drafting Assistant' },
    desc: { ja: '取引基本契約・品質保証協定・秘密保持契約などを、契約類型と条件を指定すると社内標準条項に基づいてドラフトします。中国語の契約書と日本語対訳の同時作成、相手方案文との条項比較にも対応します。最終判断は法務レビューを前提とします。',
            zh: '指定合同类型与条件后，基于公司标准条款起草基本交易合同、质量保证协议、保密协议等。支持中文合同与日文对照同时生成、与对方版本的条款比对。最终以法务审核为准。',
            en: 'Drafts master supply agreements, quality assurance agreements and NDAs from standard clauses given the type and terms. Produces the Chinese contract with a Japanese parallel text and compares clauses against the counterparty draft. Final sign-off stays with Legal.' } },

  /* ---- lg: 日中コミュニケーション ---- */
  { id: 'lg1', cat: 'lg', sub: 'trans', st: 1, tags: ['translate', 'glossary'],
    name: { ja: '日中翻訳（社内の言い方に揃える）', zh: '中日翻译（统一为公司内部用语）', en: 'JP–CN Translation in Company Wording' },
    desc: { ja: '技術文書・報告・チャットを日中双方向に翻訳します。社内用語集と過去の対訳を参照し、「治具」「仕掛」「ポカヨケ」などを現場で通じる社内の言い方に揃えます。訳語の候補が複数あるときは根拠付きで併記します。',
            zh: '对技术文档、汇报与聊天进行中日双向翻译。参照公司术语表与历史对译，将"治具""在制品""防错"等词统一为公司内部通用说法。存在多个译法时附依据并列提示。',
            en: 'Translates technical documents, reports and chat both ways between Japanese and Chinese, aligning terms like jig, WIP and poka-yoke to your in-house wording via the glossary and past translations. Lists alternatives with rationale when several are valid.' } },
  { id: 'lg2', cat: 'lg', sub: 'trans', st: 1, tags: ['glossary'],
    name: { ja: '社内用語・呼称の統一（用語集）', zh: '公司术语与称谓统一（术语表）', en: 'Company Glossary & Term Alignment' },
    desc: { ja: '文書・チャットに現れる部品名・工程名・略語の揺れ（同じものの別の呼び方）を検出し、社内標準の呼称と対訳を提示します。用語集への新規登録案や、拠点間・部門間で呼称が食い違っている語の一覧も作成します。',
            zh: '检测文档与聊天中零件名、工序名、缩写的不统一（同一事物的不同叫法），给出公司标准称谓与对译。生成术语表新增建议，以及各基地・部门之间叫法不一致的词汇清单。',
            en: 'Detects inconsistent names for the same part, process or abbreviation across documents and chat, and proposes the standard term with its translation. Suggests glossary additions and lists terms that differ between sites or departments.' } },
  { id: 'lg3', cat: 'lg', sub: 'align', st: 2, tags: ['procedure', 'translate'],
    name: { ja: '現地スタッフとの認識合わせ（手順の中国語書き下し）', zh: '与现地员工的共识确认（工序中文化与确认项明示）', en: 'Alignment with Local Staff (Procedures in Chinese)' },
    desc: { ja: '日本人駐在員が口頭や日本語メモで伝えた作業指示を、手順ごとに番号を付けた中国語の指示文に書き下し、「確認すべき点」「よくある誤解」を明示します。現地スタッフの理解確認質問（3 問程度）も自動生成し、伝わったかを確かめられます。',
            zh: '将日方驻在员口头或日文备注下达的作业指示，改写为逐条编号的中文指示，并明示"需确认事项"与"常见误解"。自动生成约3道理解确认问题，便于确认现地员工是否理解到位。',
            en: 'Rewrites instructions given verbally or in Japanese notes by expatriate staff into numbered Chinese steps, highlighting points to confirm and common misunderstandings. Generates about three comprehension-check questions so you can confirm the message landed.' } },
  { id: 'lg4', cat: 'lg', sub: 'align', st: 1, tags: ['mail'],
    name: { ja: 'ビジネスメール作成（日中往復）', zh: '商务邮件撰写（中日往来）', en: 'Business Email Writer (JP–CN Correspondence)' },
    desc: { ja: '要件と相手（本社・顧客・サプライヤー・当局）を伝えると、敬語・商務中文の適切な文面を作成します。受け取った中国語メールの日本語要約と返信案、日本語メールの中国語返信案など、日中往復のやり取りをまとめて支援します。',
            zh: '说明事项与对象（总部、客户、供应商、主管部门）后，生成措辞得体的日文敬语或商务中文邮件。支持中文来信的日文摘要与回复草案、日文来信的中文回复草案，全面辅助中日往来沟通。',
            en: 'Writes appropriately formal Japanese or business Chinese email given your intent and the recipient (HQ, customer, supplier, authority). Summarizes incoming Chinese mail in Japanese and drafts replies in either direction.' } },

  /* ---- nm: 見積・数字 ---- */
  { id: 'nm1', cat: 'nm', sub: 'cost', st: 3, tags: ['costing'],
    name: { ja: '見積り・原価計算', zh: '报价与成本计算', en: 'Quotation & Cost Estimation' },
    desc: { ja: '図面・仕様・数量から、材料費・加工費・金型償却・物流費を社内の原価テーブルで積み上げ、見積書ドラフトと原価内訳を作成します。過去の類似品見積との比較や、為替・材料市況の変動による感度も提示します。',
            zh: '根据图纸、规格与数量，按公司成本表累计材料费、加工费、模具摊销与物流费，生成报价单草案与成本明细。可与历史类似品报价比较，并提示汇率、原材料行情变动的敏感度。',
            en: 'Builds material, processing, tooling-amortization and logistics costs from drawings, specs and volumes using your cost tables, producing a quotation draft and cost breakdown. Compares with similar past quotes and shows sensitivity to FX and material prices.' } },
  { id: 'nm2', cat: 'nm', sub: 'cost', st: 2, tags: ['purchase', 'costing'],
    name: { ja: '購買見積の比較', zh: '采购报价比较', en: 'Purchase Quote Comparison' },
    desc: { ja: '複数サプライヤーの見積書（形式・通貨・単位がばらばら）を読み取って同じ条件に正規化し、単価・MOQ・納期・支払条件の比較表を作成します。前回発注価格との差や、値上げ理由の妥当性チェックにも使えます。',
            zh: '读取多家供应商格式、货币、单位各不相同的报价单，归一到同一条件后生成单价、MOQ、交期、付款条件的比较表。可与上次采购价对比，并检查涨价理由的合理性。',
            en: 'Reads supplier quotes in differing formats, currencies and units, normalizes them to like-for-like terms and builds a comparison of unit price, MOQ, lead time and payment terms. Also compares with the last order price and sanity-checks price-increase reasons.' } },
  { id: 'nm3', cat: 'nm', sub: 'actual', st: 1, tags: ['kpi', 'summary'],
    name: { ja: '日報・実績の集計と要約', zh: '日报与实绩汇总摘要', en: 'Daily Report & KPI Roll-up' },
    desc: { ja: 'ライン別の生産日報・品質日報・設備稼働記録を集計し、生産数・不良率・稼働率・主要トピックスを日次／週次で要約します。中国語で書かれた日報から日本語の週報を自動で作ることができ、異常値には解説コメントを付けます。',
            zh: '汇总各生产线的生产日报、质量日报与设备运行记录，按日／周概括产量、不良率、稼动率与主要事项。可由中文日报自动生成日文周报，并对异常值附加说明。',
            en: 'Aggregates line-level production, quality and equipment logs into daily and weekly summaries of output, defect rate, utilization and key topics. Produces a Japanese weekly report from Chinese daily reports, with commentary on outliers.' } },
  { id: 'nm4', cat: 'nm', sub: 'actual', st: 2, tags: ['inventory', 'faq'],
    name: { ja: '在庫・納期の問い合わせ回答', zh: '库存与交期咨询应答', en: 'Inventory & Lead-Time Inquiry Answers' },
    desc: { ja: '「この品番の在庫はいくつ？」「来週の出荷に間に合う？」といった営業・顧客・本社からの問い合わせに、在庫・生産計画・入荷予定を照会して回答します。回答文はそのまま返信に使える形で作成し、確認が必要な前提条件を明示します。',
            zh: '针对销售、客户、总部提出的"该品号库存多少""能否赶上下周出货"等问题，查询库存、生产计划与到货预定后作答。回复以可直接转发的形式生成，并明示需确认的前提条件。',
            en: 'Answers stock and delivery questions from sales, customers and HQ — "how many of this part are in stock?", "can we make next week\'s shipment?" — by querying inventory, production plans and inbound schedules. Replies are ready to forward, with assumptions stated.' } },
  { id: 'nm5', cat: 'nm', sub: 'actual', st: 1, tags: ['analysis', 'kpi'],
    name: { ja: 'データ分析アシスタント', zh: '数据分析助手', en: 'Data Analysis Assistant' },
    desc: { ja: '自然言語の質問から生産・品質・原価のデータを集計・可視化し、示唆をコメント付きで返します。「ライン別の不良率推移を見せて」「残業時間と不良の相関は？」など、SQL や BI ツールの知識がなくても分析できます。',
            zh: '通过自然语言提问，对生产、质量、成本数据进行汇总与可视化，并附带分析洞察。例如"看一下各线不良率趋势""加班时间与不良是否相关"，无需SQL或BI工具知识。',
            en: 'Aggregates and charts production, quality and cost data from plain-language questions — "show defect-rate trends by line", "is overtime correlated with defects?" — with written insights. No SQL or BI skills required.' } },

  /* ---- en: 図面・BOM・技術文書 ---- */
  { id: 'en1', cat: 'en', sub: 'spec', st: 2, tags: ['spec', 'glossary'],
    name: { ja: '仕様改訂の差分検出・取引先用語対応', zh: '规格修订差异检出与客户术语对应', en: 'Spec Revision Diff & Customer Terminology Mapping' },
    desc: { ja: '完成車メーカーの要求仕様書・作業標準書・手順書の新旧版を比較し、変更箇所と影響（管理項目・検査方法・記録様式）を一覧にします。メーカーごとに異なる用語を社内呼称に対応づけて読解し、改訂版の社内文書ドラフトも作成します。',
            zh: '比较整车厂要求规格书、作业标准书与作业指导书的新旧版本，列出变更点及影响（管理项目、检验方法、记录表单）。将各厂商不同的术语对应到公司内部称谓进行解读，并生成修订版内部文件草案。',
            en: 'Compares old and new versions of OEM requirement specs, work standards and procedures, listing changes and their impact on control items, inspection methods and record forms. Maps each OEM\'s terminology to your in-house terms and drafts the revised internal documents.' } },
  { id: 'en2', cat: 'en', sub: 'bom', st: 2, tags: ['bom'],
    name: { ja: 'BOM逆引き', zh: 'BOM反查', en: 'Reverse BOM Lookup' },
    desc: { ja: '部品番号・材料ロット・サプライヤー名から、それが使われている製品・上位アセンブリ・出荷先・出荷時期を逆引きします。不具合発生時の影響範囲特定や、材料変更時の対象製品の洗い出しに使います。',
            zh: '根据零件号、材料批次或供应商名称，反向查出所用产品、上级装配、出货对象与出货时间。用于不良发生时的影响范围确定，以及材料变更时的对象产品筛查。',
            en: 'Traces a part number, material lot or supplier back to the products, parent assemblies, customers and shipment dates that used it. Used to scope the impact of a defect or identify products affected by a material change.' } },
  { id: 'en3', cat: 'en', sub: 'bom', st: 3, tags: ['drawing', 'search'],
    name: { ja: '図面の類似検索', zh: '图纸相似检索', en: 'Similar Drawing Search' },
    desc: { ja: '新規引合の図面を入力すると、形状・寸法・材質・加工要件が近い過去の図面を検索し、その製品の工程・原価・不具合履歴を提示します。見積の初期検討や、既存治具・金型の流用可否判断に使います。',
            zh: '输入新询价的图纸后，检索形状、尺寸、材质、加工要求相近的历史图纸，并给出该产品的工艺、成本与不良履历。用于报价初期评估以及既有治具、模具能否沿用的判断。',
            en: 'Given a drawing from a new inquiry, finds past drawings with similar geometry, dimensions, material and machining requirements and shows their process, cost and defect history. Supports early quoting and jig/mold reuse decisions.' } },

  /* ---- gn: 汎用業務支援 ---- */
  { id: 'gn1', cat: 'gn', sub: 'office', st: 1, tags: ['finance'],
    name: { ja: '経費精算チェック', zh: '报销审核辅助', en: 'Expense Report Checker' },
    desc: { ja: '発票（領収書）と精算申請の内容を照合し、規程違反・金額不一致・発票の記載不備（抬頭・税号）を自動で検出してコメントします。駐在員の日本円建て精算や出張規程との照合にも対応します。',
            zh: '核对发票与报销申请内容，自动检测违规、金额不一致以及发票信息缺漏（抬头、税号）并给出说明。支持驻在员日元报销及与出差规定的核对。',
            en: 'Matches fapiao receipts against expense claims and flags policy breaches, amount mismatches and receipt defects (company title, tax ID) with explanations. Handles expatriates\' yen-denominated claims and travel-policy checks.' } },
  { id: 'gn2', cat: 'gn', sub: 'office', st: 1, tags: ['finance'],
    name: { ja: '請求書（発票）処理', zh: '发票处理', en: 'Invoice (Fapiao) Processing' },
    desc: { ja: '受領した増値税発票・請求書をデータ化し、発注・入庫との三点照合、仕訳候補の提案、支払期日の管理を行います。発票の真偽確認に必要な項目の抜き出しや、会計システムへの登録案の作成にも対応します。',
            zh: '将收到的增值税发票与账单数据化，与采购订单、入库进行三单匹配，提出记账科目建议并管理付款期限。支持提取发票查验所需信息，并生成财务系统录入草案。',
            en: 'Digitizes incoming VAT fapiao and invoices, performs three-way matching against POs and receipts, proposes journal entries and tracks payment due dates. Extracts the fields needed for fapiao verification and drafts accounting-system entries.' } },
  { id: 'gn3', cat: 'gn', sub: 'office', st: 2, tags: ['order'],
    name: { ja: '受注・発注書の読み取りと登録支援', zh: '订单与采购单读取及录入辅助', en: 'Order Document Reading & Entry Support' },
    desc: { ja: '顧客からの注文書・内示・発注メールや、サプライヤーへの発注書の内容を構造化し、基幹システムへの登録案を作成します。形式がばらばらな帳票や、日中混在の記載にも対応し、数量・納期・単価の前回との差分を指摘します。',
            zh: '将客户订单、预示、订货邮件以及对供应商的采购单内容结构化，生成核心系统录入草案。支持格式各异的单据与中日混合的记载，并指出数量、交期、单价与上次的差异。',
            en: 'Structures customer POs, forecasts and order emails as well as your own purchase orders into draft entries for the core system. Copes with inconsistent formats and mixed Japanese/Chinese content, and highlights changes in quantity, delivery and price versus last time.' } },
  { id: 'gn4', cat: 'gn', sub: 'daily', st: 1, tags: ['calendar', 'meeting'],
    name: { ja: 'スケジュール調整', zh: '日程协调', en: 'Scheduling Assistant' },
    desc: { ja: '日本本社・中国工場・サプライヤーの参加者の空き状況と時差・両国の祝日を踏まえて候補日時を提示し、日中 2 言語の招集メールまで作成します。定例会議の振替や来訪・監査の日程調整にも使えます。',
            zh: '结合日本总部、中国工厂与供应商参会者的空闲情况、时差及两国节假日，提出候选时间并生成中日双语的会议邀请。也可用于例会改期以及来访、审核的日程协调。',
            en: 'Proposes meeting times across HQ, the China plant and suppliers, accounting for availability, time difference and both countries\' holidays, and drafts the bilingual invitation. Also handles rescheduling regular meetings and visit or audit dates.' } },
  { id: 'gn5', cat: 'gn', sub: 'daily', st: 1, tags: ['summary'],
    name: { ja: '文書要約', zh: '文档摘要', en: 'Document Summarizer' },
    desc: { ja: '長文の報告書・仕様書・通達・メールスレッドを、目的に応じた粒度の要点サマリーに変換します。中国語の長文を日本語 1 枚に要約する、日本語の本社資料を中国語の箇条書きにするなど、言語をまたいだ要約に対応します。',
            zh: '将长篇报告、规格书、通知与邮件往来压缩为不同粒度的要点摘要。支持跨语言摘要，例如将中文长文概括为一页日文，或将日文总部资料整理为中文要点。',
            en: 'Condenses long reports, specifications, notices and email threads into summaries at your chosen level of detail. Works across languages — a one-page Japanese summary of a Chinese document, or Chinese bullet points from Japanese HQ materials.' } }
];
```

### 3-5. `state` 初期値（キーは変えない）

```js
  openCats: { kn: true },
  lastCat: 'kn',
```

（`doc` は新 CATS に存在しないため。`state` のキー集合・他の初期値は不変。）

---

## 4. 旧 33 件の処遇（残した／落とした／統合した）

凡例：**残** = 内容を顧客向けに書き直して残す ／ **統** = 新サービスに統合（機能として desc に畳む）／ **落** = 工場顧客に明らかに無関係なので落とす。

| 旧 id | 旧名称 | 処遇 | 行き先（新 id） | 理由 |
|---|---|---|---|---|
| m1 | 議事録作成エージェント | 統 | dc2 | その１-9「議事録作成と次回論点整理」に統合。日中混在会議の前提を追加 |
| m2 | 文書要約エージェント | 残 | gn5 | 通達・仕様書・メールの日中横断要約として汎用に残す |
| m3 | アクション抽出エージェント | 統 | dc2 | 「担当・期限・未決事項」の抽出として議事録に畳む |
| d1 | 報告書ドラフト作成 | 統 | dc1 | その１-8/10「本社報告・会議資料」に統合 |
| d2 | 契約書ドラフト支援 | 残 | dc7 | サプライヤー契約（基本契約・品質保証協定・NDA）として残す。PM 指名 |
| d3 | 提案書作成支援 | 落 | — | 営業提案書は部品工場の担当者業務に無い |
| d4 | ビジネスメール作成 | 残 | lg4 | 日中往復メールとして残す。PM 指名 |
| a1 | データ分析アシスタント | 残 | nm5 | 生産・品質・原価データを対象に書き直して残す。PM 指名 |
| a2 | 売上レポート自動生成 | 統 | nm3 | その１-19「日報・実績の集計と要約」に統合（売上→生産・品質実績） |
| a3 | リスク分析エージェント | 落 | （部分的に qa2 / kn5） | 汎用の案件リスク分析は対象外。変更リスクは qa2、規制リスクは kn5 が担う |
| v1 | 顧客の声(VOC)分析 | 統 | qa3 | 「同種クレームの傾向集計」としてクレーム対応に畳む |
| v2 | 競合・市場調査エージェント | 落 | — | PM 指示（明らかに無関係） |
| s1 | 社内規程検索 | 統 | kn3 | その１-3「社内規程・就業規則QA（日中2言語）」に統合・発展 |
| s2 | 技術ナレッジQA | 残 | kn1 | その２-S2。工程条件・トラブル記録を対象に書き直し |
| s3 | ドキュメント横断検索 | 統 | kn1 / kn2 | 横断意味検索は kn1（技術文書）と kn2（設備マニュアル）の中の機能として畳む |
| s4 | 法令・規制リサーチ | 統 | kn5 | その１-5 ＋ PM 追加「当局通達の影響分析・マニュアル反映」に統合 |
| s5 | FAQ自動応答ボット | 統 | kn4 | その１-27「採用・労務の問い合わせ」と合わせ「労務・総務の社内問い合わせ対応」に。PM 指名（残す候補）だが単体 FAQ より業務名の方が伝わる |
| f1 | 経費精算チェック | 残 | gn1 | 発票・駐在員精算の観点を追加。PM 指名 |
| f2 | 請求書処理エージェント | 残 | gn2 | 増値税発票・三点照合の観点を追加。PM 指名 |
| f3 | 受発注処理支援 | 残 | gn3 | 迷ったが残す。顧客 PO・内示の読み取りは工場に実需 |
| w1 | スケジュール調整エージェント | 残 | gn4 | 時差・両国祝日・2 言語招集を追加。PM 指名 |
| w2 | 承認フロー自動化 | 統 | dc5 | PM 指示（→稟議に統合）。承認ルート判定・差し戻し下書きとして畳む |
| w3 | 定型業務オートメーション | 落 | — | RPA 連携は「業務シナリオ」ではなく実現手段。シナリオ粒度の方針に合わない |
| c1 | 問い合わせ一次対応 | 統 | qa3 | 顧客からの連絡の一次対応はクレーム対応に集約 |
| c2 | コールセンター応対支援 | 落 | — | PM 指示（明らかに無関係） |
| c3 | 多言語サポート翻訳 | 統 | lg1 | その１-14「日中翻訳（社内の言い方に揃える）」に統合。対訳辞書管理は lg2 |
| c4 | クレーム要約・分類 | 統 | qa3 | その１-25「顧客クレーム一次回答」と合わせて 1 サービスに |
| c5 | 営業フォローアップ支援 | 落 | — | PM 指示（明らかに無関係） |
| g1 | コードレビュー支援 | 落 | — | PM 指示（明らかに無関係） |
| g2 | テストケース生成 | 落 | — | PM 指示（明らかに無関係） |
| g3 | SQL・クエリ生成 | 落 | — | PM 指示。分析ニーズは nm5 が自然言語で吸収 |
| g4 | 障害対応ナレッジ支援 | 統 | qa1 / kn1 | IT 障害→設備・品質トラブルに読み替え、「過去の類似不具合検索」として qa1 と kn1 に畳む |
| g5 | 設計書・仕様書生成 | 落 | — | ソースコードからの IT 文書生成。工場業務に無い |

内訳：**残 10 / 統 14 / 落 9**（計 33）。

### 4-1. コンサル素材 → 新サービスの対応（漏れ確認用）

| 素材 | 新 id | | 素材 | 新 id |
|---|---|---|---|---|
| その１-1 過去不具合検索 | qa1（S1 統合） | | その１-15 認識合わせ | lg3 |
| その１-2 技術情報QA | kn1（S2） | | その１-16 用語集 | lg2 |
| その１-3 規程QA | kn3 | | その１-17 見積・原価 | nm1 |
| その１-4 設備マニュアル | kn2 | | その１-18 購買見積比較 | nm2 |
| その１-5 当局通達 | kn5（PM 追加に統合） | | その１-19 日報集計 | nm3 |
| その１-6 8D 作成 | qa1（S1） | | その１-20 在庫・納期 | nm4 |
| その１-7 原因分析 | qa1（S1） | | その１-21 要求仕様読解 | en1（S3） |
| その１-8 本社報告 | dc1 | | その１-22 BOM 逆引き | en2（S4） |
| その１-9 議事録 | dc2 | | その１-23 標準書改訂差分 | en1（S3） |
| その１-10 会議資料 | dc1 | | その１-24 図面類似検索 | en3 |
| その１-11 工程監査資料 | qa4 | | その１-25 クレーム一次回答 | qa3 |
| その１-12 教育・OJT | dc3 | | その１-26 稟議・申請書 | dc5 |
| その１-13 掲示物中国語化 | dc4 | | その１-27 採用・労務問い合わせ | kn4 |
| その１-14 日中翻訳 | lg1 | | その１-28 輸出入・通関 | dc6 |
| その２-S5 4M 変更影響予測 | qa2（新規） | | PM 追加 NFRA 通達影響分析 | kn5 |

28 ＋ S5 ＋ PM 追加 = 30 素材すべてに行き先がある。旧 33 件からの「残」10 件のうち素材と重ならない純増は gn1〜gn5・lg4・nm5・dc7 の 8 件（33 = 25 素材由来 ＋ 8 純増）。

---

## 5. 変更前後の件数と id 一覧（`regress.mjs --update` の根拠）

### 5-1. 件数

| | 変更前 | 変更後 |
|---|---|---|
| `counts.cats` | 6 | **7** |
| `counts.subs` | 12 | **15** |
| `counts.svcs` | 33 | **33** |
| `counts.tags` | 36 | **35** |
| `counts.ui`（T キー数） | 27 | **27**（不変） |
| `patterns` | nav / dash / feed | 不変 |

### 5-2. CATS / subs

- 削除：`doc[minutes,draft]` `ana[data,voc]` `kn[internal,external]` `auto[fin,flow]` `cs[support,sales]` `dev[code,ops]`
- 追加：`kn[tech,rule]` `qa[defect,change]` `dc[report,site,apply]` `lg[trans,align]` `nm[cost,actual]` `en[spec,bom]` `gn[office,daily]`
- 注意：分類 id `kn` は旧新で同じ文字列だが、中分類が `internal,external` → `tech,rule` に変わる。regress では「`CATS.kn.subs: [internal,external] → [tech,rule]`」として出る（削除＋追加ではない）。想定内。

### 5-3. SVCS id

- 削除（33）：`m1 m2 m3 d1 d2 d3 d4 a1 a2 a3 v1 v2 s1 s2 s3 s4 s5 f1 f2 f3 w1 w2 w3 c1 c2 c3 c4 c5 g1 g2 g3 g4 g5`
- 追加（33、この順）：`kn1 kn2 kn3 kn4 kn5 qa1 qa2 qa3 qa4 dc1 dc2 dc3 dc4 dc5 dc6 dc7 lg1 lg2 lg3 lg4 nm1 nm2 nm3 nm4 nm5 en1 en2 en3 gn1 gn2 gn3 gn4 gn5`

| 新 id | cat/sub | st | tags |
|---|---|---|---|
| kn1 | kn/tech | 1 | search |
| kn2 | kn/tech | 1 | equipment, search |
| kn3 | kn/rule | 1 | regulation, hr |
| kn4 | kn/rule | 2 | faq, hr |
| kn5 | kn/rule | 2 | authority, regulation |
| qa1 | qa/defect | 2 | defect, rootcause, report8d |
| qa2 | qa/change | 3 | change4m |
| qa3 | qa/change | 2 | claim |
| qa4 | qa/change | 2 | audit, report |
| dc1 | dc/report | 1 | report |
| dc2 | dc/report | 1 | meeting, summary |
| dc3 | dc/site | 2 | education, procedure |
| dc4 | dc/site | 1 | safety, translate |
| dc5 | dc/apply | 2 | approval |
| dc6 | dc/apply | 2 | trade |
| dc7 | dc/apply | 2 | contract, purchase |
| lg1 | lg/trans | 1 | translate, glossary |
| lg2 | lg/trans | 1 | glossary |
| lg3 | lg/align | 2 | procedure, translate |
| lg4 | lg/align | 1 | mail |
| nm1 | nm/cost | 3 | costing |
| nm2 | nm/cost | 2 | purchase, costing |
| nm3 | nm/actual | 1 | kpi, summary |
| nm4 | nm/actual | 2 | inventory, faq |
| nm5 | nm/actual | 1 | analysis, kpi |
| en1 | en/spec | 2 | spec, glossary |
| en2 | en/bom | 2 | bom |
| en3 | en/bom | 3 | drawing, search |
| gn1 | gn/office | 1 | finance |
| gn2 | gn/office | 1 | finance |
| gn3 | gn/office | 2 | order |
| gn4 | gn/daily | 1 | calendar, meeting |
| gn5 | gn/daily | 1 | summary |

成熟度内訳：st1 = 15 / st2 = 15 / st3 = 3。中分類別件数：tech 2, rule 3, defect 1, change 3, report 2, site 2, apply 3, trans 2, align 2, cost 2, actual 3, spec 1, bom 2, office 3, daily 2。

### 5-4. TAGS

- 削除（36）：`meeting summary task docgen legal sales mail doc bi viz report risk voc classify research rag hr eng search chatbot finance check ocr purchase calendar workflow rpa realtime translate crm dev quality test db ops sre`
- 追加（35）：`search faq equipment regulation hr authority defect rootcause report8d change4m claim audit report meeting education safety approval trade contract translate glossary procedure mail costing purchase kpi inventory analysis spec bom drawing finance order calendar summary`
- 同名で残るキー（regress では差分に出ない）：`search hr report meeting translate purchase finance calendar summary mail`（10 件。文言は書き換える）
  → 実質の削除 26 / 追加 25。

### 5-5. T（UI 辞書）

- キー集合：**不変**（27）。`wordmark` の値のみ変更。

---

## 6. 受け入れ条件

機械検証：

1. `node tools/verify.mjs` → **ALL PASS**（warn は既存の `未使用キー: all` のみ許容。**未使用タグの warn が出ないこと**）
2. `node tools/regress.mjs`（`--update` 前）→ FAIL し、差分が §5 と一致すること（reviewer が照合）
   - `counts.cats: 6 → 7` / `counts.subs: 12 → 15` / `counts.tags: 36 → 35` / `counts.svcs` と `counts.ui` は差分に**出ない**
   - `CATS 削除: doc ana auto cs dev` / `CATS 追加: qa dc lg nm en gn` / `CATS.kn.subs: [internal,external] → [tech,rule]`
   - `SVCS 削除` 33 件・`SVCS 追加` 33 件が §5-3 と一致。「分類移動」「成熟度」「tags」の行が**1 件も出ない**（旧 id を再利用していない証拠）
   - `TAGS 削除` 26 件・`TAGS 追加` 25 件が §5-4 と一致
   - `T(UI キー)` / `PATTERNS` の行が出ない
3. `node tools/regress.mjs --update` 後、`node tools/regress.mjs` → PASS。`tools/regress.baseline.json` の `counts` が `{"cats":7,"subs":15,"svcs":33,"tags":35,"ui":27}`
4. `git diff` が `mock/catalog.html` の **`TAGS` / `CATS` / `SVCS` の 3 リテラル ＋ `T.wordmark` の値 ＋ `state` の 2 初期値 ＋ SVCS 直前のコメント** の範囲に収まる（`<style>`・関数・ハンドラに差分なし）。加えて `tools/regress.baseline.json` / `mock/README.md` / `mock/index.html` の文言行。

目視（PM／reviewer）：

5. ブラウザで開き、ja / zh / en を切り替えて **サイドバー 7 分類・すべてのサービス 33** が出る。分類を開くと中分類と件数（§5-3 の中分類別件数）が一致
6. 各言語でカード・詳細に空欄や別言語の混入がない（特に en）
7. ヘッダーのワードマークが `青嶺精工 / 青岭精工 / SEIREI SEIKO` に切り替わる。dashed 枠・色・書体は変わっていない
8. 検索欄に「8D」「BOM」「发票」「fapiao」を入れるとそれぞれ該当サービスが出る（タグ・desc の横断検索が生きている）
9. ダークモードで成熟度ドット・バッジ（提供中／試行版／構想）の 3 種が表示される（qa2 / nm1 / en3 が「構想」）
10. 初期表示で「ナレッジ検索・問い合わせ」が開いた状態になる（`openCats: { kn: true }`）

---

## 7. PR 分割案 / 並列可否

| PR | 内容 | ブランチ案 | 並列 |
|---|---|---|---|
| **A-1** | 本書全体（TAGS / CATS / SVCS / wordmark / state 初期値 / baseline 更新 / README・index 文言） | `feat/customer-catalog-data` | B とは**直列**（B は本書の id を前提。同一ファイル `mock/catalog.html` の `SVCS` 周辺に触る） |

- A は 1 PR にまとめる。TAGS / CATS / SVCS は相互参照（`verify` 6. データ整合）があるため分けると中間状態で FAIL する。
- B（`2026-09-06-demo-scenarios.md`）は **A のマージ後**に着手。B-1（テンプレート実装）は A と触る箇所が異なる（`T` 追加・`state` 追加・`renderMain` 分岐・CSS 追加）ため**技術的には A と並列可能**だが、B-1 の動作確認に A の id が要るので、PM が急ぐ場合のみ並列（コンフリクトは `T` と `state` 付近に限定される見込み）。推奨は直列。
- PR 本文に「設計書 `docs/handoff/2026-09-06-customer-catalog-data.md` §5 のデータ変更に伴う基準更新」と書く（§3 のルール）。

---

## 8. PM 判断待ち（推奨案は各 1 つ）

| # | 論点 | 選択肢 | **推奨** |
|---|---|---|---|
| P-1 | 分類数 | (a) 7 分類（汎用業務支援あり）／(b) 6 分類（汎用 5 件を `dc`・`nm` に散らす） | **(a)**。理由は §2-1 |
| P-2 | 総件数 | (a) 33 件（本書）／(b) 汎用 `gn` を gn1・gn2・gn4 の 3 件に絞り 31 件／(c) さらに lg4・nm5 を落とし 29 件 | **(a)**。「迷ったら残す」に従う。絞るなら (b)（gn3 受発注・gn5 要約は他で代替しやすい） |
| P-3 | 仮社名 | (a) 青嶺精工 / 青岭精工 / SEIREI SEIKO／(b) 陽和機工 / 阳和机工 / YOWA KIKO／(c) 白樺精密 / 白桦精密 / SHIRAKABA PRECISION | **(a)**。3 案いずれも実在大手と重ならないことを確認済みだが、最終確認（商号検索）は PM 側で |
| P-4 | kn5 の名称の長さ | (a) 「当局通達の影響分析・マニュアル反映（NFRA・地方当局等）」（本書）／(b) 「当局通達の影響分析・マニュアル反映」（括弧を desc に移す） | **(a)**。PM の意図（NFRA を明示）を優先。カードで 2 行になるが `.c-name` は折り返し可 |
| P-5 | 「その１-1 過去不具合検索」を独立サービスとして残すか | (a) S1（qa1）に統合（本書）／(b) `qa0` 「過去の不具合・トラブル対応の検索」を st1 で追加し 34 件 | **(a)**。その２の統合方針に従う。ただし「まず検索だけ使いたい」需要が強ければ (b) |
| P-6 | 中国側表記 | (a) 大陸簡体・中国側慣用（「中日」「不良」「客诉」「稼动率」）／(b) 日本語直訳寄り | **(a)** |
| P-7 | ヘッダー `dept`（情報システム部）と avatar「S」 | (a) そのまま／(b) 顧客の閲覧者像に合わせ「管理部 / 管理部 / Admin Dept.」に変更（S レーン） | **(a)**。本お題の範囲外。必要なら S レーンで別 Issue |
| P-8 | `.wordmark` の dashed 枠 | (a) そのまま（プレースホルダ表現を維持）／(b) 実線・ブランド色ロゴ風に（S レーン） | **(a)**。「デザインは変えない」指示に従う |

---

## 9. CLAUDE.md への影響（PM 承認事項）

- §6 バックログ「顧客版カタログ（製造業・日中2拠点）：… 6 分類 24 サービス」→ 本書の結果「7 分類 33 サービス」に更新が必要。**architect は CLAUDE.md を変えない**ので、A-1 マージ時に PM が更新する（S 相当の文言変更）。
- §2 load-bearing の変更は**なし**（A はデータ層のみ）。

