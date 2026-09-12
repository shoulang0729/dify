# ポータルの指標名を 3 言語で確定する（ナレッジ分類・KPI 観点と指標・目標（MBO）観点）

- 日付: 2026-09-12 ／ レーン: **M/L**（データ層の正本を新設し、`portal/` の DDL・seed の形を変える）
- 実行場所: **`run:cloud`**（ネットワーク不要。設計・実装・検証すべてクラウドで回る）
- 前提となる決定: `docs/handoff/2026-09-10-portal-nocobase.md` **§18-1**（PM 決定 2026-09-11・#276。指標名はモックの現行 ja 名で確定）／同 §5-17・§5-18・§5-23（案）／`docs/handoff/2026-09-11-repo-layout-v3.md` §2-5・§4-2（`portal/` の切り出し可能性）／`docs/handoff/2026-09-11-portal-mock-pages.md` §7-1 **D12**（モックの散文は v1 では日本語のまま）
- 関連: `CLAUDE.md` §2-1（3 言語同時・空値なし・en にかな残りなし）／§2-13（架空データの正本は `data/world/`）／§2-14（`portal/**` はルート検証から分離）／§4（**翻訳を implementer に投げない**）

---

## §0 結論

1. **正本は `data/world/it/` に新設する CSV 3 本**（候補 (a)）。ファイル名は `portal/schema/V001__init.sql` のテーブル名にそのまま合わせて `knowledge_categories.csv` / `kpi_topics.csv` / `goal_topics.csv`。**3 本とも `name_ja` / `name_zh` / `name_en` を持つ**（`data/world/it/` の既存 `clients.csv`（`role_ja/zh/en`）・`kpi.csv`（`name_ja/zh/en`）・`documents.csv`（`title_ja/zh/en`）と同じ作法）。
2. **`name_ja` はモックの現行値をバイト一致で写す**（§18-1 の決定。1 文字も変えない）。**ja を変えたくなったら順序は変わらず「① モック → ② `data/world/it/` → ③ seed」**（§18-1-4 はそのまま生きる）。**zh / en の正本はこの CSV**（モックは zh/en を持たない）。
3. **モックの表示は D12 を維持する**（指標名は日本語固定。`mock/js/data/portal/{common,mgmt}.js` のリテラルも `mock/js/portal/render.js` も**触らない**）。理由は §3。
4. **件数（`origin/main` の `dacd470` で実走して数えた値）**：ナレッジ **大分類 12 / 中分類 46**、KPI **観点 9 / 指標 52**、MBO **観点 8**。**3 言語化する名前は合計 127 件**。
5. **PR は 3 本**：**PR-1（ルート側・正本 CSV ＋ 機械検査）** ∥ **PR-A（`portal/` 側・既存バグ 2 件の修正）** → **PR-2（`portal/` 側・`gen-seed.mjs` と DDL と seed 再生成）**。PR-1 と PR-A は**ファイル集合が重ならないので並列可**、PR-2 は PR-1 と PR-A の両方に**依存するので直列**（§9）。
6. 途中で**既存の不具合を 2 件見つけた**（`gen-seed.mjs` の `reviewDays` に文書数が入っている／`kpi_topics.topic_code` の `UNIQUE` は 52 行を入れた瞬間に落ちる）。**本件と同時に直す**（§12）。

---

## §1 いま何が無いか

| | 現状 |
|---|---|
| ja の名前 | **確定済み**。`mock/js/data/portal/common.js` の `PKNOW`、`mgmt.js` の `PKPITOPIC` / `PGOAL.topics` の**リテラルが正本**（§18-1-1） |
| zh / en | **どこにも無い。** モックのこれらは `{ja,zh,en}` 形ではなく素の文字列で、`CLAUDE.md` §2-1 の対象外（`mock/js/data/portal/**` で 3 言語なのは `PT` だけ） |
| DB の列 | `portal/schema/V001__init.sql` の `knowledge_categories` / `kpi_topics` / `goal_topics` には **`name_zh` / `name_en` 列そのものが無い**（`ai_services` にはある）。rev3 §5-1' は「ある」前提で書かれていたが、#285 で実装された DDL には入っていない。**本件で足す** |
| seed | `portal/seed/catalog.json` の `knowledge` / `kpi` / `goal` は **ja の文字列だけ**を持つ |

**つまり本件は「翻訳を決める」作業であり、決めた結果を置く場所を 1 つに決める作業でもある。**

---

## §2 正本の置き場（決定）

### 2-1. 候補の比較

| | (a) `data/world/it/` に CSV を新設し 3 言語で持つ | (b) モックの js リテラルを `{ja,zh,en}` 形に変える | (c) `portal/seed/**` に直接書く |
|---|---|---|---|
| `CLAUDE.md` §2-13（架空データの正本は `data/world/`） | **合う。** 指標名は翠雲システムズ（`it` 世界）の部門定義そのもの。台本・KB・ポータルの 3 つが同じ語を使う場面が既にある | **ずれる。** モックは `data/world/` の**消費側**。台本（`scenarios/**`）と同じ立場 | **違反。** `portal/seed/**` は生成物（手で編集しない） |
| §2-14 S-1（`gen-seed.mjs` の外部参照） | **増えない。** `gen-seed.mjs` は既に `data/world/**` を読んでいる（`WORLD_DIR`）。読むファイルが増えるだけで、参照先の**根**は増えない | 増えない（`mock/js/data/portal/**` も既に読んでいる） | — |
| 3 言語の機械検査 | **新しく足す必要がある**（verify §19。§8-1） | **ただで付く。** verify §17-e が `js/data/portal/**` の `{ja:…}` を全部 3 言語で検査している | 付かない |
| モックの表示 | **変わらない**（D12 維持。§3） | **`render.js` を `PL()` 経由に直す必要が出る**。直さなければ「3 言語データがあるのに ja しか出ない」という嘘の状態が残る | 変わらない |
| §18-1「モックのリテラルは 1 バイトも変えない」 | 守れる | **破る**（形を変える） |
| `tools/check-world.mjs` の影響 | **無い。** `check-world.mjs` は世界ディレクトリから**読むファイル名を明示列挙**している（`people.csv`・`products.csv`・`kpi.csv`・`documents.csv` など）。新しい CSV は単に読まれない。**allowlist の更新は不要**（`data/world/README.md` のファイル表に 3 行足すだけ） | 無い | 無い |

**⚠️ `data/world/it/kpi.csv` に相乗りさせてはならない。** `kpi.csv` は `check-world.mjs` の **W8（KPI の値の食い違い検査）**の入力で、`name_ja` / `name_zh` に載った語が台本・KB に出るたび「基準値と一致するか」を見る。ここに「売上」「稼働率」「顧客」のような一般語を 52 件足すと、**W8 の warn が爆発して `data/world/README.md` の「未統一 12 件」台帳が機能しなくなる**。**別ファイルにする**。

### 2-2. 決定

**(a)。`data/world/it/` に次の 3 本を新設する。**

| ファイル | 行数 | 対応するテーブル |
|---|---|---|
| `data/world/it/knowledge_categories.csv` | **58**（大分類 12 ＋ 中分類 46） | `knowledge_categories` |
| `data/world/it/kpi_topics.csv` | **61**（観点 9 ＋ 指標 52） | `kpi_topics` |
| `data/world/it/goal_topics.csv` | **8**（観点 8） | `goal_topics` |

**「業種に依らない部門共通語彙では？」への答え**：確かに「就業・労務」「情報セキュリティ」のような語は業種に依らない。それでも `data/world/it/` に置く理由は 3 つ。① **このポータルは翠雲システムズ ソリューション本部の面**であり（`PT.org`）、ナレッジ分類の切り方（`D2 中国拠点の実務`・`D4 デリバリ標準`・`D6 ノウハウ`）と KPI の観点（`K2 案件の健全性`）は**明確に在中日系 SIer の語**である。業種共通ではない。② `data/world/` に「業種に属さない共通ディレクトリ」を新設すると `CLAUDE.md` §2-13 の「**業種ごとに 1 つの世界**」という単純な形が崩れる（rev3 §14-8''-2 も「**新しいディレクトリを作らない**」と書いている）。③ 顧客版に差し替えるとき、**分類体系は顧客ごとに丸ごと入れ替わる**。世界の外に置くと「どの顧客の分類か」が消える。

**`data/world/README.md` の `it/` の節に 3 行足す**（`it-industry` PR-1 が作った既存の表への追記。新しい節は作らない）。

### 2-3. ja と zh/en の正本が分かれることの整理（§18-1-4 との関係）

| 何 | 正本 | 変えるときの順序 |
|---|---|---|
| **ja** | `mock/js/data/portal/{common,mgmt}.js` | ① モック → ② `data/world/it/*.csv` → ③ `portal/seed/`（**§18-1-4 のまま**） |
| **zh / en** | `data/world/it/*.csv` | ① CSV → ② `portal/seed/`（モックは通らない。モックは zh/en を持たないため） |
| **構造・属性**（`review_days`・`frequency`・`source`・`viewers`・`src_state`・`measure_type`） | `mock/js/data/portal/{common,mgmt}.js` | ① モック → ② `portal/seed/`（CSV は通らない。**CSV は名前だけを持つ**） |

**この「ja は 2 か所に書かれる」状態は機械検査で閉じる**（verify §19。CSV の `name_ja` がモックとバイト一致し、件数と並び順も一致することを検査する。§8-1）。ずれたらルート `npm test` が FAIL する。

---

## §3 モックの表示の扱い —— **D12 を維持（日本語固定）**

**決定：モックは 1 バイトも触らない。** 指標名は日本語のまま表示する。

理由：

1. **周りが日本語のままだから。** `renderKnow` / `renderKpi` / `renderGoal` の**見出し・表ヘッダ・解説散文はすべて `render.js` に直書きの日本語**（例「全社ナレッジ ／ 正本は本社 ／ 部門は参照のみ」「並びは『基本動作 → 制度 → 個別』です」）。指標名だけ中国語に切り替わると、**表の中身だけ中国語・枠は日本語**という一番読みにくい状態になる。D12 は「半端な 3 言語オブジェクトを作らない」という判断であり、本件はその判断を覆す材料を持っていない。
2. **本件の目的は DB の列を埋めること**であって、モックの見え方を変えることではない（§18-1-3「まだやらない」の解消）。
3. §18-1 が明示的に「**モックのリテラルは本決定では 1 バイトも変えない**」と書いている。

**将来 3 言語表示にしたくなったら**（バックログ。本件では**やらない**）：① `common.js` / `mgmt.js` の名前を `{ja,zh,en}` 形に変える（**zh/en は CSV から写す。翻訳をやり直さない**）→ ② `render.js` の当該 3 関数を `PL()` 経由にする → ③ **`render.js` の見出し・散文も `PT` に移す**（ここを一緒にやらないと ① の見た目が壊れる）→ ④ verify **§17-e が自動で 3 言語一致を検査する**（既存。新しい検査は要らない）。**②③ は同じファイル（`render.js`）を触るので 1 本の PR にまとめる。**

---

## §4 件数（実走値）

**`origin/main` の `dacd470` で `tools/lib/load.mjs` から読み出して数えた。**

| 対象 | 件数 | 内訳 |
|---|---|---|
| ナレッジ 大分類 | **12** | 全社 `C1`〜`C6` 6 ＋ 部門 `D1`〜`D6` 6 |
| ナレッジ 中分類 | **46** | C1 4 / C2 4 / C3 5 / C4 4 / C5 4 / C6 3（計 24）＋ D1 4 / D2 4 / D3 4 / D4 4 / D5 3 / D6 3（計 22） |
| KPI 観点 | **9** | `K1`〜`K9` |
| KPI 指標 | **52** | K1 7 / K2 5 / K3 6 / K4 7 / K5 7 / K6 5 / K7 5 / K8 6 / K9 4 |
| MBO 観点 | **8** | `P1`〜`P7` ＋ `P0` |
| **3 言語化する名前の合計** | **127** | 12 ＋ 46 ＋ 9 ＋ 52 ＋ 8 |

§18-1-2 の確定値（ナレッジ 12 / 46・KPI 9 / 52・MBO 8）と**一致**。

---

## §5 3 言語表（本体）

**ja はモックの現行値そのまま（実走で読み出して生成した。手で打ち直していない）。zh は簡体字、en は既存の `PT`・`CATS`・`TAGS` と同じ語調（短い名詞句・文末のピリオド無し）。**

### 5-1. ナレッジ（大分類 12 ＋ 中分類 46 ＝ 58 行）

| code | 区分 | ja | zh | en |
|---|---|---|---|---|
| C1 | 大 | 全社の基本動作 | 全公司基本工作规范 | Company-wide working basics |
| C1-01 | 中 | 仕事の進め方の基本 | 工作推进的基本方法 | Basics of getting work done |
| C1-02 | 中 | 報告・連絡・相談 | 报告・联络・商谈 | Reporting and escalation |
| C1-03 | 中 | 会議と議事録 | 会议与会议纪要 | Meetings and minutes |
| C1-04 | 中 | 文書の作り方と保管 | 文档编写与保管 | Writing and storing documents |
| C2 | 大 | 理念・行動規範 | 理念与行为规范 | Values and code of conduct |
| C2-01 | 中 | 経営理念 | 经营理念 | Corporate philosophy |
| C2-02 | 中 | 行動規範 | 行为规范 | Code of conduct |
| C2-03 | 中 | 組織と権限 | 组织与权限 | Organization and authority |
| C2-04 | 中 | 倫理・通報 | 伦理与举报 | Ethics and whistleblowing |
| C3 | 大 | 制度・規程 | 制度与规程 | Policies and regulations |
| C3-01 | 中 | 就業・労務 | 劳动规章与考勤 | Work rules and labor |
| C3-02 | 中 | 報酬・評価 | 薪酬与考核 | Compensation and evaluation |
| C3-03 | 中 | 休暇 | 休假 | Leave |
| C3-04 | 中 | 出張・経費 | 出差与费用 | Travel and expenses |
| C3-05 | 中 | 福利厚生 | 福利待遇 | Employee benefits |
| C4 | 大 | 統制・セキュリティ | 内控与安全 | Controls and security |
| C4-01 | 中 | 情報セキュリティ | 信息安全 | Information security |
| C4-02 | 中 | 個人情報・データ保護 | 个人信息与数据保护 | Personal data protection |
| C4-03 | 中 | 輸出管理・貿易 | 出口管制与贸易 | Export control and trade |
| C4-04 | 中 | 契約・法務 | 合同与法务 | Contracts and legal |
| C5 | 大 | 申請と手続き | 申请与手续 | Requests and procedures |
| C5-01 | 中 | 稟議・決裁 | 请示与审批 | Approval requests |
| C5-02 | 中 | 購買・発注 | 采购与下单 | Purchasing and ordering |
| C5-03 | 中 | 採用・異動 | 招聘与调动 | Hiring and transfers |
| C5-04 | 中 | システム利用申請 | 系统使用申请 | System access requests |
| C6 | 大 | 教育・研修 | 教育与培训 | Education and training |
| C6-01 | 中 | 必須研修 | 必修培训 | Mandatory training |
| C6-02 | 中 | 新任・着任時 | 新任与到任 | Onboarding |
| C6-03 | 中 | 資格・スキル | 资格与技能 | Qualifications and skills |
| D1 | 大 | 部門の基本動作 | 部门基本工作规范 | Department working basics |
| D1-01 | 中 | 着任時の手引き | 到任指南 | Onboarding guide |
| D1-02 | 中 | 用語と略語 | 术语与缩略语 | Terms and abbreviations |
| D1-03 | 中 | 連絡と報告のルール | 联络与报告规则 | Contact and reporting rules |
| D1-04 | 中 | ツールとアカウント | 工具与账号 | Tools and accounts |
| D2 | 大 | 中国拠点の実務 | 中国分公司实务 | China office practices |
| D2-01 | 中 | 現地の手続き（ビザ・居留・届出） | 当地手续（签证・居留・备案） | Local procedures (visa / residence / filings) |
| D2-02 | 中 | 現地の商習慣 | 当地商业习惯 | Local business customs |
| D2-03 | 中 | 日中コミュニケーション | 日中沟通 | Japan-China communication |
| D2-04 | 中 | 拠点の連絡先 | 分公司联系方式 | Office contacts |
| D3 | 大 | 顧客と案件 | 客户与项目 | Customers and projects |
| D3-01 | 中 | 顧客プロファイル | 客户档案 | Customer profiles |
| D3-02 | 中 | 提案・見積 | 提案与报价 | Proposals and quotes |
| D3-03 | 中 | 議事録 | 会议纪要 | Meeting minutes |
| D3-04 | 中 | 検収・納品 | 验收与交付 | Acceptance and delivery |
| D4 | 大 | デリバリ標準 | 交付标准 | Delivery standards |
| D4-01 | 中 | 見積の考え方 | 估算方法 | Estimating approach |
| D4-02 | 中 | 設計とレビュー | 设计与评审 | Design and review |
| D4-03 | 中 | 品質・テスト | 质量与测试 | Quality and testing |
| D4-04 | 中 | リリース・移行 | 发布与迁移 | Release and migration |
| D5 | 大 | 障害とトラブル | 故障与问题 | Incidents and troubles |
| D5-01 | 中 | 障害報告 | 故障报告 | Incident reports |
| D5-02 | 中 | 再発防止 | 防止再发生 | Preventing recurrence |
| D5-03 | 中 | 既知の問題 | 已知问题 | Known issues |
| D6 | 大 | ノウハウ | 经验与诀窍 | Know-how |
| D6-01 | 中 | 勝ちパターン | 制胜模式 | Winning patterns |
| D6-02 | 中 | 失注の記録 | 失单记录 | Lost-deal records |
| D6-03 | 中 | 技術メモ | 技术备忘 | Technical notes |

### 5-2. KPI（観点 9 ＋ 指標 52 ＝ 61 行）

| code | 区分 | ja | zh | en |
|---|---|---|---|---|
| K1 | 観点 | 業績 | 业绩 | Performance |
| K1-01 | 指標 | 受注高 | 签约额 | Bookings |
| K1-02 | 指標 | 売上 | 销售额 | Revenue |
| K1-03 | 指標 | 粗利（率） | 毛利（率） | Gross profit (margin) |
| K1-04 | 指標 | 営業利益（率） | 营业利润（率） | Operating profit (margin) |
| K1-05 | 指標 | 予算比 | 预算达成率 | Budget attainment |
| K1-06 | 指標 | 受注残 | 在手订单 | Order backlog |
| K1-07 | 指標 | パイプライン（確度加重） | 商机金额（按成功率加权） | Pipeline (probability-weighted) |
| K2 | 観点 | 案件の健全性 | 项目健康度 | Project health |
| K2-01 | 指標 | Red/Yellow/Green 比率 | 红/黄/绿 比例 | Red/Yellow/Green ratio |
| K2-02 | 指標 | 納期遵守率 | 交期达成率 | On-time delivery rate |
| K2-03 | 指標 | 検収までの日数 | 至验收的天数 | Days to acceptance |
| K2-04 | 指標 | 変更要求の件数 | 变更请求件数 | Change requests |
| K2-05 | 指標 | 手戻り工数 | 返工工时 | Rework hours |
| K3 | 観点 | 顧客 | 客户 | Customers |
| K3-01 | 指標 | 顧客別売上 | 各客户销售额 | Revenue by customer |
| K3-02 | 指標 | 上位顧客への集中度 | 大客户集中度 | Top-customer concentration |
| K3-03 | 指標 | 継続率 | 续约率 | Retention rate |
| K3-04 | 指標 | 新規顧客数 | 新增客户数 | New customers |
| K3-05 | 指標 | 提案勝率 | 中标率 | Win rate |
| K3-06 | 指標 | 失注理由の構成 | 失单原因构成 | Loss reasons breakdown |
| K4 | 観点 | 要員・稼働 | 人员与稼动 | People and utilization |
| K4-01 | 指標 | 稼働率 | 稼动率 | Utilization rate |
| K4-02 | 指標 | 要員数 | 人员数 | Headcount |
| K4-03 | 指標 | 残業時間 | 加班工时 | Overtime hours |
| K4-04 | 指標 | 年休取得率 | 年假使用率 | Annual leave taken |
| K4-05 | 指標 | 離職率 | 离职率 | Attrition rate |
| K4-06 | 指標 | 採用充足率 | 招聘达成率 | Hiring fill rate |
| K4-07 | 指標 | 一人当たり粗利 | 人均毛利 | Gross profit per head |
| K5 | 観点 | 品質・障害 | 质量与故障 | Quality and incidents |
| K5-01 | 指標 | 稼働率 | 系统可用率 | System availability |
| K5-02 | 指標 | 障害件数 | 故障件数 | Incidents |
| K5-03 | 指標 | 重大障害 | 重大故障 | Major incidents |
| K5-04 | 指標 | MTTR | 平均修复时间（MTTR） | MTTR (mean time to repair) |
| K5-05 | 指標 | 再発率 | 再发生率 | Recurrence rate |
| K5-06 | 指標 | 一次回答までの時間 | 首次响应时间 | First-response time |
| K5-07 | 指標 | 顧客からの指摘件数 | 客户指出问题件数 | Customer-raised issues |
| K6 | 観点 | 人材育成 | 人才培养 | People development |
| K6-01 | 指標 | 必須研修の受講率 | 必修培训完成率 | Mandatory training completion |
| K6-02 | 指標 | 資格保有者数 | 持证人数 | Certified staff |
| K6-03 | 指標 | スキル充足率 | 技能满足率 | Skill coverage |
| K6-04 | 指標 | 育成計画の進捗 | 培养计划进度 | Development plan progress |
| K6-05 | 指標 | OJT 完了率 | OJT 完成率 | OJT completion rate |
| K7 | 観点 | チームビルディング | 团队建设 | Team building |
| K7-01 | 指標 | エンゲージメント調査スコア | 敬业度调研得分 | Engagement survey score |
| K7-02 | 指標 | 1on1 の実施率 | 1on1 实施率 | One-on-one completion rate |
| K7-03 | 指標 | 部門イベントの参加率 | 部门活动参与率 | Team event participation |
| K7-04 | 指標 | ナレッジ投稿数 | 知识库投稿数 | Knowledge contributions |
| K7-05 | 指標 | 新任 1 年の定着率 | 新员工一年留存率 | First-year retention |
| K8 | 観点 | 社内施策・改善 | 内部举措与改善 | Internal initiatives and improvement |
| K8-01 | 指標 | 施策の件数と進捗 | 举措件数与进度 | Initiatives and progress |
| K8-02 | 指標 | 改善提案の件数と採用率 | 改善提案件数与采纳率 | Improvement proposals and adoption rate |
| K8-03 | 指標 | 標準化の適用率 | 标准化适用率 | Standardization adoption |
| K8-04 | 指標 | AI の利用者数・利用回数 | AI 使用人数・使用次数 | AI users and usage count |
| K8-05 | 指標 | AI による削減時間 | AI 节省工时 | Hours saved by AI |
| K8-06 | 指標 | ナレッジの要見直し件数 | 待复审知识件数 | Knowledge items due for review |
| K9 | 観点 | コンプライアンス・統制 | 合规与内控 | Compliance and controls |
| K9-01 | 指標 | 必須研修の未了件数 | 必修培训未完成件数 | Overdue mandatory training |
| K9-02 | 指標 | セキュリティ事故件数 | 安全事件件数 | Security incidents |
| K9-03 | 指標 | 監査指摘件数 | 审计指出事项件数 | Audit findings |
| K9-04 | 指標 | 申請の期限遵守率 | 申请按期完成率 | Request on-time rate |

### 5-3. 目標（MBO）観点 8

| code | ja | zh | en |
|---|---|---|---|
| P1 | 業績 | 业绩 | Performance |
| P2 | 顧客 | 客户 | Customers |
| P3 | 案件遂行 | 项目执行 | Project execution |
| P4 | 品質・改善 | 质量与改善 | Quality and improvement |
| P5 | 育成・自己開発 | 培养与自我提升 | Development and self-learning |
| P6 | 組織・チーム | 组织与团队 | Organization and team |
| P7 | 業務改善・AI 活用 | 业务改善与 AI 应用 | Process improvement and AI adoption |
| P0 | 共通・必須（全員に自動で付く） | 通用・必须（全员自动分配） | Common and mandatory (auto-assigned to all) |

### 5-4. 訳の方針と、機械で確認したこと

**方針**

1. **既存訳がある語はそのまま流用した**（新しい訳語を作らない）：`data/world/it/kpi.csv` から **年休取得率 → 年假使用率 / Annual leave taken**、**AI による削減時間 → AI 节省工时 / Hours saved by AI**、**提案勝率 → 中标率 / Win rate**、**稼働率（要員）→ 稼动率 / Utilization rate**。`PT` から **顧客 → 客户 / Customers**、**案件 → 项目 / Projects**、**ナレッジ → 知识库 / Knowledge**、**要員 → 人员 / People**、**目標 → 目标 / Goals**。
2. **en は短い名詞句**。動詞形・文にしない（`PT` の `Knowledge` / `Requests` / `Projects` と同じ）。**Title Case にしない**（既存の `PT` は `News Watch` のような固有ラベルだけ大文字。指標名は sentence case に揃えた）。
3. **単位・括弧はそのまま**。`粗利（率）` → `毛利（率）` / `Gross profit (margin)` のように、ja の括弧の意味（「率も見る」）を落とさない。
4. **`MTTR` のような略語は zh で 1 度だけ展開する**（`平均修复时间（MTTR）`）。en は `MTTR (mean time to repair)`。
5. **⚠️ `稼働率` は ja が同じで意味が違う 2 件がある**：`K4 要員・稼働` の `稼働率` は**人の稼働**（`稼动率` / `Utilization rate`）、`K5 品質・障害` の `稼働率` は**システムの可用性**（`系统可用率` / `System availability`）。**訳し分けた。**このため**指標の一意キーは `name_ja` ではなく `code`（`K4-01` / `K5-01`）**にしてある（§6-2）。
6. `P0 共通・必須（全員に自動で付く）` の zh は **`通用・必须（全员自动分配）`** とした。`PT.gCommon`（共通業務 → `共通业务`）と字面を揃えていない。**`共通` は中国語として通じないため**で、既存の `PT.gCommon` は本件では**触らない**（§11）。気になるなら PM 判断（§13-3）。

**機械で確認したこと（architect が実走。出力そのまま）**

```
=== 件数 ===
{"ナレッジ大分類":12,"ナレッジ中分類":46,"KPI 観点":9,"KPI 指標":52,"MBO 観点":8}
=== 検査 ===
OK 対訳の欠落 0 / 空値 0 / en のかな残り 0 / ASCII カンマ 0 / 件数一致 / コード重複なし
```

検査した内容：① モックから読んだ ja **127 件すべてに zh/en が付いている**（対訳漏れ 0）／② **zh・en に空文字・空白だけの値が無い**／③ **en にかな（ひらがな・カタカナ）が 1 文字も残っていない**（`CLAUDE.md` §2-1 の en 判定と同じ正規表現）／④ **どのフィールドにも ASCII のカンマ・二重引用符が無い**（CSV をクォート無しで書けること。§6-1）／⑤ **件数が §4 と一致**／⑥ **`code` が 127 件すべて一意**／⑦ 使われていない対訳エントリが無い（表に余計な行が無い）。

---

## §6 ファイル仕様（CSV 3 本）

### 6-1. 共通の規則

- **文字コード UTF-8・改行 LF・末尾に改行 1 つ。ヘッダ 1 行必須。**
- **どのフィールドにも ASCII のカンマ `,` と二重引用符 `"` を書かない**（クォート処理を要らなくする。区切りが必要なら全角の `・` `、` を使い、en は ` / ` か ` and ` を使う）。§5-4 の検査 ④ で確認済み。
- **並びはモックの並び順そのまま**（`seq` の昇順。ソートし直さない）。モックの並びには意味がある（ナレッジは「基本動作 → 制度 → 個別」の読む順）。
- **`code` の作り方**：親コード（`C1` / `K1` / なし）＋ `-` ＋ 2 桁ゼロ埋めの `seq`（`C1-01`・`K4-07`）。**`CLAUDE.md` §2-11 の管理番号と同じ形だが別体系**（サービスの管理番号は `KN-02` のように**分類コードが 2 文字**。こちらは `C1`/`K1`/`P1` で**数字を含む**ので衝突しない）。**通番は永久欠番**（並びを変えても番号は変えない。将来の行の削除でも再利用しない）。
- **ファイルの先頭に `#` で始まるコメント行を置かない**（既存の `data/world/it/*.csv` と同じ。出典は `data/world/README.md` に書く）。

### 6-2. 列

**`data/world/it/knowledge_categories.csv`（58 行＋ヘッダ）**

| 列 | 値域 | 説明 |
|---|---|---|
| `scope` | `corp` / `dept` | `PKNOW.corp` / `PKNOW.dept` |
| `kind` | `major` / `minor` | 大分類 / 中分類 |
| `code` | `C1`〜`D6` / `C1-01` 形 | 一意 |
| `parent` | 空 / 大分類の code | `major` は空 |
| `seq` | 1 以上の整数 | `scope` 内（`major`）／親内（`minor`）の 1 起点の並び |
| `name_ja` `name_zh` `name_en` | 非空 | **`name_ja` はモックとバイト一致** |

**`data/world/it/kpi_topics.csv`（61 行＋ヘッダ）**：列は `kind,code,parent,seq,name_ja,name_zh,name_en`。`kind` は `topic` / `metric`。`scope` 列は持たない。

**`data/world/it/goal_topics.csv`（8 行＋ヘッダ）**：列は同上。`kind` は `topic` のみ、`parent` は全行空。

**`note` 列は置かない。** 既存の `kpi.csv` などは `note` を持つが、この 3 本は「名前だけを持つ台帳」なので、書きたくなったら `data/world/README.md` 側に書く（列が増えると「属性はモック側が正本」という §2-3 の線が曖昧になる）。

### 6-3. CSV に**入れない**もの

`review_days`（90/180/365）・文書数・着任時に読むか・`frequency`（月次/週次/四半期）・`source`・`viewers`・`src_state`（have/connect/new）・`measure_type`（auto/mix/man）・**MBO の役割別の指標例**（`PGOAL.topics[3..5]`。組織長／営業／社員の例）。

理由：**これらは名前ではなく属性・画面の作り**で、正本はモック（§2-3）。特に**役割別の指標例は `goal_topics` テーブルにも `seed/catalog.json` にも載っていない**ので、3 言語化しても行き先が無い。必要になったら別の設計書で（`goal_catalog` に `examples` を持たせる話とセットになる）。**本件では ja のまま残す。**

---

## §7 seed（`portal/seed/catalog.json`）の新しい形と DDL の追加列

### 7-1. `catalog.json` の形（**変更あり。後方互換は取らない**）

**いま `portal/seed/catalog.json` を読む実装は 1 つも無い**（NocoBase の実機がまだ無い。`portal/nocobase/export/` は空）。**消費者ゼロのいま形を変えるのが一番安い**ので、文字列を `{ja,zh,en}` に置き換える。

```jsonc
"knowledge": {
  "corp": [
    { "code": "C1",
      "name": { "ja": "全社の基本動作", "zh": "全公司基本工作规范", "en": "Company-wide working basics" },
      "reviewDays": 90,
      "subs": [ { "code": "C1-01", "name": { "ja": "…", "zh": "…", "en": "…" } }, … ] }, …
  ],
  "dept": [ … ],
  "majorTotal": 12,
  "subTotal": 46
},
"kpi": {
  "topics": [
    { "code": "K1",
      "name": { "ja": "業績", "zh": "业绩", "en": "Performance" },
      "frequency": "月次", "source": "会計システム", "viewers": "経営・PM", "srcState": "connect",
      "measures": [ { "code": "K1-01", "name": { "ja": "受注高", "zh": "签约额", "en": "Bookings" } }, … ] }, …
  ],
  "topicTotal": 9,
  "measureTotal": 52
},
"goal": {
  "topics": [ { "code": "P1", "name": { "ja": "業績", "zh": "业绩", "en": "Performance" }, "measureType": "auto" }, … ],
  "topicTotal": 8
}
```

- **`majorName` / `topicName` は `name` に改名する**（`ai_services` 側・`cats`/`svcs` 側の `name` と形を揃える。`catalog.json` の中で同じ意味のキーが 3 通りあるのをここで畳む）。
- **`subs` は文字列配列 → オブジェクト配列**（`code` が付く）。
- **`frequency` / `source` / `viewers` は ja のまま**（§6-3。画面の属性であって指標名ではない）。**`_comment` にその旨を 1 行書く。**
- **`_comment` の「正本」の記述を更新する**：`… ナレッジ／KPI／MBO の名前は data/world/it/{knowledge_categories,kpi_topics,goal_topics}.csv（zh/en）と mock/js/data/portal/{common,mgmt}.js（ja・属性）`。

### 7-2. DDL（`portal/schema/V001__init.sql`）

**`V002__…sql` を作らず `V001__init.sql` を直接直す。** 理由：**この DDL はまだどこにも適用されていない**（`portal/nocobase/docker/` は雛形、実機なし）。Flyway の「適用済みを書き換えない」規則は適用済みの環境がある場合の話で、初日の DDL を分割すると `portal/schema/README.md` の表と食い違う。**この判断は本設計書に閉じる**（次に誰かが DDL を触るときには実機がある可能性が高いので、そのときは `V002__` を作る）。

| テーブル | 変更 |
|---|---|
| `knowledge_categories` | `name_zh` `name_en` を足す。**`major_name` / `minor_name` を `major_name_ja` / `minor_name_ja` にはしない**——代わりに**行の形を変える**：`kind`（`major`/`minor`）・`code`・`parent_code`・`seq`・`name_ja`・`name_zh`・`name_en`・`review_days`。**58 行**（いまの「46 行で大分類名を 46 回繰り返す」形をやめる。CSV と 1 対 1 になる） |
| `kpi_topics` | 同じく `kind`（`topic`/`metric`）・`code`・`parent_code`・`seq`・`name_ja`・`name_zh`・`name_en`・`frequency`・`source_state`。**61 行**。**`topic_code` の `UNIQUE` は外す**（§12-2 のバグ） |
| `goal_topics` | `name_zh` `name_en` を足す。`topic_code` → `code`、`topic_name` → `name_ja`。**8 行**。`UNIQUE(code)` は残す |

**3 テーブルとも `UNIQUE (code)`**（`kind` を跨いでも `code` は一意。§6-1 の採番規則で保証される）。`portal/schema/README.md` の表の行数・説明も同時に直す。

---

## §8 機械検査

### 8-1. ルート側：`tools/verify.mjs` に **§19** を足す

**`portal/` が無くても回る**（入力は `data/world/it/**` と `mock/js/data/portal/**` だけ。`CLAUDE.md` §2-14 に抵触しない）。`data/world/it/knowledge_categories.csv` が**無ければ節ごと skip**（§16・§17 と同じ作法）。

| # | 検査 | FAIL 条件 |
|---|---|---|
| 19-a | ヘッダが §6-2 の列名・列順と一致 | 違う |
| 19-b | 行数が `58` / `61` / `8`、`kind` の内訳が `12+46` / `9+52` / `8` | 違う |
| 19-c | **`name_ja` がモック（`PKNOW` / `PKPITOPIC` / `PGOAL.topics`）の値とバイト一致**（`scope`・`parent`・`seq` で対応づけて並び順も一致） | 1 件でもずれ |
| 19-d | `name_zh` / `name_en` が空でない・**`name_en` にかなが無い**（§2-1 と同じ正規表現） | 1 件でも |
| 19-e | `code` が 3 ファイル横断で一意・採番規則（`親-2 桁`）どおり・`parent` が実在 | 違う |
| 19-f | どのフィールドにも ASCII の `,` `"` が無い | 1 件でも |

**実装時に `§19` が空いていることを確認する。** 埋まっていたら次の空き番号を使い、その旨を PR 本文に書く（`tools/verify.mjs` 冒頭のコメントは §13〜§18 の予約状況を記録している。`origin/main` `dacd470` 時点で **§19 は未使用**）。

**`tools/regress.mjs` は変更しない。** `regress.baseline.json` のキーは `industries` / `cats` / `svcs` / `tags` / `patterns` / `uiKeys` / `counts` で、**ポータルのデータは 1 つも入っていない**（実走で確認）。`--update` も不要。

### 8-2. `portal/` 側：既存の検査でそのまま閉じる

- `node portal/scripts/gen-seed.mjs --check`（= `npm run portal:test` の `check-seed-fresh.mjs`）が**再生成とのバイト一致**を見る。CSV を直して seed を再生成し忘れたら落ちる。
- `gen-seed.mjs` は **CSV とモックの件数・`code` が食い違ったら例外で止める**（黙って空文字を書かない）。`data/world/` が無い単体チェックアウトでは従来どおり skip（§4-2 S-1 の作法を変えない）。
- `node portal/tools/check-nodata.mjs`：**新しい語が実在企業名・実 URL と誤検出されないか**を見る。`nodata.baseline.json` に追記が必要になったら**その行の理由を PR 本文に書く**（安易に baseline を太らせない）。

---

## §9 実装 PR の分割

| PR | 内容 | 触るファイル | 並列 |
|---|---|---|---|
| **PR-1**（ルート） | 正本 CSV 3 本 ＋ README ＋ verify §19 | `data/world/it/knowledge_categories.csv`（新）・`data/world/it/kpi_topics.csv`（新）・`data/world/it/goal_topics.csv`（新）・`data/world/README.md`・`tools/verify.mjs` | **PR-A と並列可** |
| **PR-A**（portal・バグ修正） | §12 の既存バグ 2 件だけを直す（i18n と無関係。先に入れて diff を分ける） | `portal/scripts/gen-seed.mjs`・`portal/schema/V001__init.sql`・`portal/schema/README.md`・`portal/seed/catalog.json`（再生成） | **PR-1 と並列可** |
| **PR-2**（portal・本体） | `gen-seed.mjs` が CSV を読み 3 言語で出す ＋ DDL に列追加 ＋ seed 再生成 | `portal/scripts/gen-seed.mjs`・`portal/schema/V001__init.sql`・`portal/schema/README.md`・`portal/README.md`・`portal/seed/catalog.json`（再生成）・必要なら `portal/tools/nodata.baseline.json` | **PR-1 と PR-A の両方に依存。直列** |

- **PR-1 と PR-A はファイル集合が重ならない**（`data/world` ＋ `tools/verify.mjs` ／ `portal/**`）ので `CLAUDE.md` §5 のとおり並列可。
- **PR-2 は PR-1 のマージ後**（CSV が無いと `gen-seed.mjs` が動かない）**かつ PR-A のマージ後**（同じ 4 ファイルを触る）。
- **PR-A を省いて PR-2 に混ぜてもよい**が、その場合は「i18n の diff」と「バグ修正の diff」が混ざる。**reviewer の読みやすさを優先して分けることを推奨**。急ぐなら PR-A → PR-2 の 2 本でも成立する（PR-1 は独立）。
- 検証：**PR-1 は `npm test`**（ルート）、**PR-A / PR-2 は `npm test` ＋ `npm run portal:test`**。`npm run world`（warn のみ）は **PR-1 で実行して warn 件数が 12 件から増えていないことを確認**して PR 本文に書く（§2-2 のとおり増えないはずだが、確認する）。

### 9-1. 受け入れ条件（PR ごと）

**PR-1**
1. CSV 3 本が §6 の仕様どおり（列・行数 58/61/8・並び・ASCII カンマ無し・末尾改行）。
2. `name_ja` が **§5 の表と 1 文字も違わない**（＝モックとバイト一致）。`name_zh` / `name_en` も §5 の表のとおり（**訳を勝手に直さない。直したいときは PM に返す**）。
3. `tools/verify.mjs` に §19（19-a〜19-f）があり、**わざと 1 文字ずらすと FAIL する**ことを実装者が手元で 1 回確認した（PR 本文にその旨）。
4. `data/world/README.md` の `it/` の表に 3 行追加。**新しい節・新しいディレクトリを作っていない**。
5. `npm test` PASS。`npm run world` の warn が 12 件のまま。

**PR-A**
1. `gen-seed.mjs` の `reviewDays` が `PKNOW` 行の **index 4**（90/180/365）を読む。再生成した `catalog.json` の `C1.reviewDays` が **90**（いまは 18）。
2. `kpi_topics` の `topic_code UNIQUE` が外れ、**52 行を入れても衝突しない**。
3. `npm test` ＋ `npm run portal:test` PASS（`--check` がバイト一致）。

**PR-2**
1. `portal/seed/catalog.json` の `knowledge` / `kpi` / `goal` が §7-1 の形で、**`name.zh` / `name.en` が 127 件すべて非空**。
2. `gen-seed.mjs` が **CSV とモックの件数・code が食い違ったら例外で止まる**（空文字でごまかさない）。`data/world/` が無いときは従来どおり `--check` を skip。
3. DDL が §7-2 のとおり（3 テーブルに `name_zh` / `name_en`、`kpi_topics` は 61 行の形、`UNIQUE (code)`）。`portal/schema/README.md` の表も一致。
4. `npm test` ＋ `npm run portal:test` PASS。`node portal/tools/check-nodata.mjs` で**新しい NG が出ていない**。
5. **`mock/**` を 1 バイトも触っていない。**

---

## §10 受け入れ条件（本件全体）

1. **ナレッジ 12＋46 / KPI 9＋52 / MBO 8 の合計 127 件すべてに ja・zh・en が揃っている。空値ゼロ・en にかなゼロ。**
2. **ja はモックの現行値とバイト一致**（`tools/verify.mjs` §19-c が守る）。
3. **`mock/**` は 1 バイトも変わっていない**（D12 維持）。
4. **`portal/seed/**` は手編集ゼロ**（すべて `gen-seed.mjs` の出力）。
5. ルート `npm test` と `npm run portal:test` が両方 PASS。**ルート `package.json` の `dependencies` はゼロのまま**（§2-14）。
6. **実在企業名・実 URL・実データが 1 つも入っていない。**

---

## §11 触らない範囲（明示）

- **`mock/**` 全部。** 特に `mock/js/data/portal/common.js`・`mgmt.js` のリテラル（ja のまま）、`mock/js/portal/render.js`、`mock/js/data/portal/ui.js` の **`PT`**（`gCommon` の `共通业务` を含め既存訳は直さない）、`mock/css/**`、`mock/js/data/{ui,catalog,home,style}.js`、`mock/js/data/scenarios/**`。
- **`data/world/mfg/**`・`data/world/fin/**`**（本件は `it` だけ）。**`data/world/it/` の既存 8 ファイル**（`company.md`・`org.csv`・`people.csv`・`clients.csv`・`vendors.csv`・`products.csv` 相当・`kpi.csv`・`calendar.md`・`documents.csv`）。**特に `kpi.csv` に指標を足さない**（§2-1 の W8 の件）。
- **`tools/check-world.mjs`**（allowlist の更新は不要。§2-1）・**`tools/regress.mjs`**・**`tools/regress.baseline.json`**。
- **`dify/**`**（マスタ DSL・env・KB・tests）・**`docs/service-map.md`**・**`.github/workflows/**`**。
- **`.claude/**`・`CLAUDE.md`**（本件で load-bearing の変更は発生しない。§2-6 の `localStorage` キーも増えない）。
- **既存の設計書**：`2026-09-10-portal-nocobase.md`・`2026-09-11-portal-mock-pages.md`・`2026-09-11-repo-layout-v3.md` は**書き換えない**。本書が新しい版として追記の関係に立つ（`CLAUDE.md` §4）。**本書は §18-1 を覆していない**——§18-1 が「まだやらない」と書いた 3 言語表を埋めただけで、ja の正本も §18-1-4 の変更順序もそのまま。
- **`portal/nocobase/**`・`portal/env/**`・`portal/docs/**`**（本件の 3 PR は触らない）。

---

## §12 途中で見つけた既存の不具合（本件と同時に直す）

### 12-1. `gen-seed.mjs` が `reviewDays` に**文書数**を入れている

`portal/scripts/gen-seed.mjs` の `buildCatalogJson()`：

```js
const [code, majorName, subs, reviewDays] = row;
```

`PKNOW` の行は `[id, 大分類名, 中分類の配列, 文書数, 見直しの目安(日), 着任時に読むか]` なので、**index 3 は文書数**。結果、`portal/seed/catalog.json` は `C1.reviewDays = 18`（正しくは **90**）になっている。**12 行すべて誤り。** 90/180/365 のはずの値が 9〜63 になっているので目視でも分かる。→ **PR-A で修正**（index 4 を読む）。

### 12-2. `kpi_topics.topic_code UNIQUE` は 52 行を入れた瞬間に落ちる

`portal/schema/V001__init.sql`：

```sql
CREATE TABLE kpi_topics (
  topic_code    text UNIQUE NOT NULL,   -- 例: K1
  topic_name    text NOT NULL,
  measure_name  text NOT NULL,
```

**1 行 1 指標**（コメントも README も「9 観点・指標 52 件」）なので `K1` が 7 行に出る。`UNIQUE` が効いていれば **2 行目の INSERT で失敗する**。→ **PR-A で `UNIQUE` を外す**（§7-2 で `UNIQUE (code)` に置き換わる）。

**どちらも実機が無いので今は誰も踏んでいない。踏む前に直す。**

---

## §13 PM 判断待ち

1. **zh / en の訳を一読してほしい**（§5 の 127 件）。**顧客に見せる語**になるので、語感の NG があれば差し戻す。特に見てほしいのは 3 か所：
   - `C1 全社の基本動作` → `全公司基本工作规范` / `Company-wide working basics`（「基本動作」は中国語にそのまま持ち込めないので意訳した）
   - `D2 中国拠点の実務` → `中国分公司实务` / `China office practices`（`PT` が `上海拠点` を `上海分公司` としているのに合わせた）
   - `K4 稼働率` = `稼动率`（人）と `K5 稼働率` = `系统可用率`（システム）の**訳し分け**（§5-4-5）
2. **モックは日本語のままでよいか**（§3。D12 維持）。「顧客に中国語で見せたい」なら別 Issue（`render.js` の見出し・散文ごと `PT` に移す作業が付いてくる）。
3. `P0 共通・必須` の zh を **`通用・必须`** とし、`PT.gCommon` の既存訳 `共通业务` と字面を揃えなかった（§5-4-6）。**既存訳の方を直す**なら別 Issue（`PT` は `mock/js/data/portal/ui.js`。§17-e の対象なので 3 言語同時）。
4. **`portal/schema/V001__init.sql` を直接書き換える**ことの確認（§7-2。`V002__` を作らない。実機がまだ無いため）。

---

## 付録 A. CSV 本文（実装はここからバイトで写す）

**`data/world/it/knowledge_categories.csv`**

```csv
scope,kind,code,parent,seq,name_ja,name_zh,name_en
corp,major,C1,,1,全社の基本動作,全公司基本工作规范,Company-wide working basics
corp,minor,C1-01,C1,1,仕事の進め方の基本,工作推进的基本方法,Basics of getting work done
corp,minor,C1-02,C1,2,報告・連絡・相談,报告・联络・商谈,Reporting and escalation
corp,minor,C1-03,C1,3,会議と議事録,会议与会议纪要,Meetings and minutes
corp,minor,C1-04,C1,4,文書の作り方と保管,文档编写与保管,Writing and storing documents
corp,major,C2,,2,理念・行動規範,理念与行为规范,Values and code of conduct
corp,minor,C2-01,C2,1,経営理念,经营理念,Corporate philosophy
corp,minor,C2-02,C2,2,行動規範,行为规范,Code of conduct
corp,minor,C2-03,C2,3,組織と権限,组织与权限,Organization and authority
corp,minor,C2-04,C2,4,倫理・通報,伦理与举报,Ethics and whistleblowing
corp,major,C3,,3,制度・規程,制度与规程,Policies and regulations
corp,minor,C3-01,C3,1,就業・労務,劳动规章与考勤,Work rules and labor
corp,minor,C3-02,C3,2,報酬・評価,薪酬与考核,Compensation and evaluation
corp,minor,C3-03,C3,3,休暇,休假,Leave
corp,minor,C3-04,C3,4,出張・経費,出差与费用,Travel and expenses
corp,minor,C3-05,C3,5,福利厚生,福利待遇,Employee benefits
corp,major,C4,,4,統制・セキュリティ,内控与安全,Controls and security
corp,minor,C4-01,C4,1,情報セキュリティ,信息安全,Information security
corp,minor,C4-02,C4,2,個人情報・データ保護,个人信息与数据保护,Personal data protection
corp,minor,C4-03,C4,3,輸出管理・貿易,出口管制与贸易,Export control and trade
corp,minor,C4-04,C4,4,契約・法務,合同与法务,Contracts and legal
corp,major,C5,,5,申請と手続き,申请与手续,Requests and procedures
corp,minor,C5-01,C5,1,稟議・決裁,请示与审批,Approval requests
corp,minor,C5-02,C5,2,購買・発注,采购与下单,Purchasing and ordering
corp,minor,C5-03,C5,3,採用・異動,招聘与调动,Hiring and transfers
corp,minor,C5-04,C5,4,システム利用申請,系统使用申请,System access requests
corp,major,C6,,6,教育・研修,教育与培训,Education and training
corp,minor,C6-01,C6,1,必須研修,必修培训,Mandatory training
corp,minor,C6-02,C6,2,新任・着任時,新任与到任,Onboarding
corp,minor,C6-03,C6,3,資格・スキル,资格与技能,Qualifications and skills
dept,major,D1,,1,部門の基本動作,部门基本工作规范,Department working basics
dept,minor,D1-01,D1,1,着任時の手引き,到任指南,Onboarding guide
dept,minor,D1-02,D1,2,用語と略語,术语与缩略语,Terms and abbreviations
dept,minor,D1-03,D1,3,連絡と報告のルール,联络与报告规则,Contact and reporting rules
dept,minor,D1-04,D1,4,ツールとアカウント,工具与账号,Tools and accounts
dept,major,D2,,2,中国拠点の実務,中国分公司实务,China office practices
dept,minor,D2-01,D2,1,現地の手続き（ビザ・居留・届出）,当地手续（签证・居留・备案）,Local procedures (visa / residence / filings)
dept,minor,D2-02,D2,2,現地の商習慣,当地商业习惯,Local business customs
dept,minor,D2-03,D2,3,日中コミュニケーション,日中沟通,Japan-China communication
dept,minor,D2-04,D2,4,拠点の連絡先,分公司联系方式,Office contacts
dept,major,D3,,3,顧客と案件,客户与项目,Customers and projects
dept,minor,D3-01,D3,1,顧客プロファイル,客户档案,Customer profiles
dept,minor,D3-02,D3,2,提案・見積,提案与报价,Proposals and quotes
dept,minor,D3-03,D3,3,議事録,会议纪要,Meeting minutes
dept,minor,D3-04,D3,4,検収・納品,验收与交付,Acceptance and delivery
dept,major,D4,,4,デリバリ標準,交付标准,Delivery standards
dept,minor,D4-01,D4,1,見積の考え方,估算方法,Estimating approach
dept,minor,D4-02,D4,2,設計とレビュー,设计与评审,Design and review
dept,minor,D4-03,D4,3,品質・テスト,质量与测试,Quality and testing
dept,minor,D4-04,D4,4,リリース・移行,发布与迁移,Release and migration
dept,major,D5,,5,障害とトラブル,故障与问题,Incidents and troubles
dept,minor,D5-01,D5,1,障害報告,故障报告,Incident reports
dept,minor,D5-02,D5,2,再発防止,防止再发生,Preventing recurrence
dept,minor,D5-03,D5,3,既知の問題,已知问题,Known issues
dept,major,D6,,6,ノウハウ,经验与诀窍,Know-how
dept,minor,D6-01,D6,1,勝ちパターン,制胜模式,Winning patterns
dept,minor,D6-02,D6,2,失注の記録,失单记录,Lost-deal records
dept,minor,D6-03,D6,3,技術メモ,技术备忘,Technical notes
```

**`data/world/it/kpi_topics.csv`**

```csv
kind,code,parent,seq,name_ja,name_zh,name_en
topic,K1,,1,業績,业绩,Performance
metric,K1-01,K1,1,受注高,签约额,Bookings
metric,K1-02,K1,2,売上,销售额,Revenue
metric,K1-03,K1,3,粗利（率）,毛利（率）,Gross profit (margin)
metric,K1-04,K1,4,営業利益（率）,营业利润（率）,Operating profit (margin)
metric,K1-05,K1,5,予算比,预算达成率,Budget attainment
metric,K1-06,K1,6,受注残,在手订单,Order backlog
metric,K1-07,K1,7,パイプライン（確度加重）,商机金额（按成功率加权）,Pipeline (probability-weighted)
topic,K2,,2,案件の健全性,项目健康度,Project health
metric,K2-01,K2,1,Red/Yellow/Green 比率,红/黄/绿 比例,Red/Yellow/Green ratio
metric,K2-02,K2,2,納期遵守率,交期达成率,On-time delivery rate
metric,K2-03,K2,3,検収までの日数,至验收的天数,Days to acceptance
metric,K2-04,K2,4,変更要求の件数,变更请求件数,Change requests
metric,K2-05,K2,5,手戻り工数,返工工时,Rework hours
topic,K3,,3,顧客,客户,Customers
metric,K3-01,K3,1,顧客別売上,各客户销售额,Revenue by customer
metric,K3-02,K3,2,上位顧客への集中度,大客户集中度,Top-customer concentration
metric,K3-03,K3,3,継続率,续约率,Retention rate
metric,K3-04,K3,4,新規顧客数,新增客户数,New customers
metric,K3-05,K3,5,提案勝率,中标率,Win rate
metric,K3-06,K3,6,失注理由の構成,失单原因构成,Loss reasons breakdown
topic,K4,,4,要員・稼働,人员与稼动,People and utilization
metric,K4-01,K4,1,稼働率,稼动率,Utilization rate
metric,K4-02,K4,2,要員数,人员数,Headcount
metric,K4-03,K4,3,残業時間,加班工时,Overtime hours
metric,K4-04,K4,4,年休取得率,年假使用率,Annual leave taken
metric,K4-05,K4,5,離職率,离职率,Attrition rate
metric,K4-06,K4,6,採用充足率,招聘达成率,Hiring fill rate
metric,K4-07,K4,7,一人当たり粗利,人均毛利,Gross profit per head
topic,K5,,5,品質・障害,质量与故障,Quality and incidents
metric,K5-01,K5,1,稼働率,系统可用率,System availability
metric,K5-02,K5,2,障害件数,故障件数,Incidents
metric,K5-03,K5,3,重大障害,重大故障,Major incidents
metric,K5-04,K5,4,MTTR,平均修复时间（MTTR）,MTTR (mean time to repair)
metric,K5-05,K5,5,再発率,再发生率,Recurrence rate
metric,K5-06,K5,6,一次回答までの時間,首次响应时间,First-response time
metric,K5-07,K5,7,顧客からの指摘件数,客户指出问题件数,Customer-raised issues
topic,K6,,6,人材育成,人才培养,People development
metric,K6-01,K6,1,必須研修の受講率,必修培训完成率,Mandatory training completion
metric,K6-02,K6,2,資格保有者数,持证人数,Certified staff
metric,K6-03,K6,3,スキル充足率,技能满足率,Skill coverage
metric,K6-04,K6,4,育成計画の進捗,培养计划进度,Development plan progress
metric,K6-05,K6,5,OJT 完了率,OJT 完成率,OJT completion rate
topic,K7,,7,チームビルディング,团队建设,Team building
metric,K7-01,K7,1,エンゲージメント調査スコア,敬业度调研得分,Engagement survey score
metric,K7-02,K7,2,1on1 の実施率,1on1 实施率,One-on-one completion rate
metric,K7-03,K7,3,部門イベントの参加率,部门活动参与率,Team event participation
metric,K7-04,K7,4,ナレッジ投稿数,知识库投稿数,Knowledge contributions
metric,K7-05,K7,5,新任 1 年の定着率,新员工一年留存率,First-year retention
topic,K8,,8,社内施策・改善,内部举措与改善,Internal initiatives and improvement
metric,K8-01,K8,1,施策の件数と進捗,举措件数与进度,Initiatives and progress
metric,K8-02,K8,2,改善提案の件数と採用率,改善提案件数与采纳率,Improvement proposals and adoption rate
metric,K8-03,K8,3,標準化の適用率,标准化适用率,Standardization adoption
metric,K8-04,K8,4,AI の利用者数・利用回数,AI 使用人数・使用次数,AI users and usage count
metric,K8-05,K8,5,AI による削減時間,AI 节省工时,Hours saved by AI
metric,K8-06,K8,6,ナレッジの要見直し件数,待复审知识件数,Knowledge items due for review
topic,K9,,9,コンプライアンス・統制,合规与内控,Compliance and controls
metric,K9-01,K9,1,必須研修の未了件数,必修培训未完成件数,Overdue mandatory training
metric,K9-02,K9,2,セキュリティ事故件数,安全事件件数,Security incidents
metric,K9-03,K9,3,監査指摘件数,审计指出事项件数,Audit findings
metric,K9-04,K9,4,申請の期限遵守率,申请按期完成率,Request on-time rate
```

**`data/world/it/goal_topics.csv`**

```csv
kind,code,parent,seq,name_ja,name_zh,name_en
topic,P1,,1,業績,业绩,Performance
topic,P2,,2,顧客,客户,Customers
topic,P3,,3,案件遂行,项目执行,Project execution
topic,P4,,4,品質・改善,质量与改善,Quality and improvement
topic,P5,,5,育成・自己開発,培养与自我提升,Development and self-learning
topic,P6,,6,組織・チーム,组织与团队,Organization and team
topic,P7,,7,業務改善・AI 活用,业务改善与 AI 应用,Process improvement and AI adoption
topic,P0,,8,共通・必須（全員に自動で付く）,通用・必须（全员自动分配）,Common and mandatory (auto-assigned to all)
```
