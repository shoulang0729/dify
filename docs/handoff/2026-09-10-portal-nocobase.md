# 社内向けポータルサイト（NocoBase）— リポジトリ分離と第 1 段の設計

- Issue: #242
- 種別: **M/L**（architect 成果物。本 PR は**設計書のみ**。アプリコード・データ層は 1 バイトも変えない）
- ラベル: `run:cloud`
- **初版 2026-09-10 ／ 改訂 2026-09-11（本版）。** 改訂の要約は **§R**。改訂で無効になった判断は消さずに **§15 附録 A** と本文の「~~取り消し線~~ ＋ 2026-09-11 改訂」印に残してある
- 前提設計書: `docs/dify/platform-components.md`（PC-01 / PC-02 / PC-04 / PC-09 / PC-10 / PC-16 / PC-17）・`docs/handoff/2026-09-07-repo-layout-v2.md` §3・§4（4 区分・env レイヤー）・`docs/handoff/2026-09-08-execution-split-and-runner.md` §1-1（実行場所）・`docs/handoff/2026-09-08-live-links.md`（`LIVE`）・`docs/handoff/2026-09-10-expert-feedback.md`（見せ方の方針）
- **調査の記録（本書の事実の根拠）**: **`docs/handoff/2026-09-11-nocobase-research.md`**（2026-09-11・対象 v2.2.10・出典 URL つき）。**あちらは事実、本書は判断。** 本書が「判明」と書いているものは必ずあちらに出典がある
- PM 確定事項（2026-09-10、**初版時**。時系列順）:
  1. **用途は「顧客提示デモ」と「実運用の社内システム」の両方**／**設計は実データを見ながら行う**／**リポジトリは分離**
  2. **（後から確定・前提が変わった）新リポは public。** リポジトリに入るのは**「定義」と「架空のデモデータ」だけ**で、**実データは 1 バイトも入らない**。本番は**空の定義をデプロイし、中身は別途投入する**。public にする目的は**顧客と社内に見せること**
  3. これは `dify/apps/*.yml`（マスタ）＋ `dify/env/<env>/env.yml`（`${VAR}` で外から）と**同じ作法**（`CLAUDE.md` §2-12）
- PM 確定事項（2026-09-11、**本改訂**）:
  4. **NocoBase は Professional 前提**／**AI は Dify Enterprise（社内・既存環境）**／**ソースと CI はデモが GitHub・本番が GitLab Self-Managed**／**Identity の正本はオンプレ Windows Server Active Directory**／**Knowledge は Outline Self-Hosted**／**業務ドメインは 顧客・案件・TODO/Action・KPI・人員リソース・会議・部門共通知識・AI 検索要約**
  5. **スキーマは方式 (B)「先に PostgreSQL で設計し、NocoBase に認識させる」**（PM が明示的に選択）
  6. **顧客向けデモは生きている。今後も継続する。** Dify のユースケースはポータルから利用可能にし、ユースケースは増やし続ける
  7. **PM 構成案（AD / GitLab / Outline / Dify Enterprise）は本番（中国拠点の社内システム）の到達点であって、デモの構成ではない。** それらは「既存環境を利用」＝顧客／中国拠点側にあり、**いま我々の手元には無い**
  8. **いま作るのはデモ版だけ。** 本番は「到達点」として設計書に書くが**実装しない**
  9. **ポータルの各種メニューの背後に、可能な場所で Dify アプリのデモを配置する**（AI を 1 ページに隔離しない。§14）

---

## §R. 2026-09-11 改訂 —— 何が変わったか（忙しい人はここだけ）

### R-1. 前提が変わった（8 点）

| # | 初版の前提（2026-09-10） | 本改訂の前提（2026-09-11） | 影響した節 |
|---|---|---|---|
| 1 | NocoBase は**無料版（Community）**を想定 | **Professional 前提。** AD 連携（Auth: LDAP）も定義移送（Migration Manager）も Professional+ と判明 | §4-3・§4-11・§11-9 |
| 2 | AI 基盤は **Dify Cloud** | **デモ＝Dify Cloud（稼働 12 本）／本番＝Dify Enterprise（社内）。** 差し替わるのはエンドポイントとキーだけ | §0-2・§10 |
| 3 | ソース管理・CI は **GitHub** | **デモ＝GitHub／本番＝GitLab Self-Managed。** 二段構え | §7-7・§12 |
| 4 | 業務ドメインは**勤怠・研修・年休・お知らせ（人事系）** | **顧客・案件・TODO/Action・KPI・人員リソース・会議・部門共通知識・AI。** 人事系は**スコープ外（落としたのではない。§5-6）** | §5 全面・§8 |
| 5 | Identity は**未確定**（P0 は SSO 無し） | **オンプレ AD が正本。** 粗い 5 区分（Management / Sales / Delivery / PM / General User）は AD、案件単位の細かい権限は NocoBase | §0-2・§5-8 |
| 6 | Knowledge の言及**なし** | **Outline Self-Hosted。** NocoBase＝業務データ（構造化）／Outline＝文書。接点は `document_links` | §5-7 |
| 7 | スキーマの作り方が**中心の問い**（§4-5） | **方式 (B)「先に PostgreSQL で設計」を PM が選択。** その実現方式 (a)/(b) を architect が決めた（§4-11） | §3・§4-11 |
| 8 | 顧客向けデモの位置づけが曖昧 | **デモは生きている。いま作るのはデモ版だけ。本番は到達点として書くが実装しない** | §0-2・§0-3 |

### R-2. 調査で決着した点（詳細は §4-4。出典は `docs/handoff/2026-09-11-nocobase-research.md`）

| 初版の未確認 | 決着 |
|---|---|
| **U3** 定義だけを移送できるか（C1 の中核） | **できる。Migration Manager（Professional+）。** テーブルごとに Schema-only / Overwrite / Skip。公式フロー「Release Management」あり |
| **U14** `plugin-backup-restore` で定義だけ運べるか | **運べない。** 当該プラグインは v1.4 で非推奨、後継 Backup Manager はフルバックアップのみ |
| **U9** 外部 DB に届くか | **届く。External PostgreSQL（Standard+）。** PostgreSQL 9.5+。**NocoBase は外部 DB を一切変更しないと明記** |
| **U1** ライセンス・価格・SSO の提供形態 | **Community 無料 / Standard $800 / Professional $8,000 / Enterprise 要問合せ。SSO（OIDC・SAML・LDAP・CAS）は Professional+。** ライセンスは Instance ID 単位 |
| **U2** 対応 DB | **PostgreSQL 10+ / MySQL 8.0.17+ / MariaDB 10.9+。Node.js 22+** |
| **U7** カスタムプラグインの開発言語 | **TypeScript（React + Ant Design + Formily / Koa / Sequelize）。`yarn build --tar` → `storage/plugins`** |
| **U8** 中国からの到達性・日本語 UI | **中国語 docs・Aliyun イメージミラー・ICP 備案・人民元価格・Gitee ミラーあり。UI は ja-JP / zh-CN を含む**（翻訳完成度の数値は記載なし） |
| **U13** 本番運用の推奨構成 | **Docker 推奨。最小 1 core / 2 GB、推奨 2 core / 4 GB。`CLUSTER_MODE` で多コア利用。複数ノードのクラスタは Enterprise+**（部門ポータル規模では不要） |
| **U12** GitHub Environment / protection rules | **論点が消えた**（本番は GitLab、デモの CI は secret ゼロ） |

**依然として不明のまま残ったもの**（断定しない）：**U4**（移送ファイルの diff が読めるか）・**U5**（SSE）・**U6**（iframe の URL 変数とログイン引き継ぎ）・**U11**（外部データソース接続情報の変数参照の構文）。加えて調査で**新しく分かった不明**が 7 件ある（U15〜U21。§4-4b）。

### R-3. 改訂で新しく決めたこと

| # | 決めたこと | どこ |
|---|---|---|
| D-1 | **デモも本番も NocoBase Professional。** 方式は **(b) 外部データソース: External PostgreSQL**。エディションと方式は**一体で決めた** | §4-11 |
| D-2 | **デモ／本番で唯一変えてはいけない層は「業務スキーマ」。** DDL は Flyway の SQL で Git 管理し、デモと本番に**同じファイルを流す** | §0-2・§3-3 |
| D-3 | **`actions` が PC-01 `feed_items` の役割を担う。** ポータルで 2 つの To-Do の器を並べない | §5-4 |
| D-4 | **`document_links` は Outline の実 URL を持たない。** 種別＋識別子＋表示名だけを持ち、`${PORTAL_OUTLINE_BASE}` と結合して組み立てる | §5-7 |
| D-5 | **AI を 1 ページに隔離しない。** 既定の置き方は **(a′) 画面のボタン → Workflow（同期）→ HTTP request → 結果を画面へ**。iframe は「Dify そのものを見せる」場面に限る | §14-5 |
| D-6 | **`ai_services` テーブル ＋ コレクション駆動ブロック。** 行を足すだけで画面に増える。**サービスが増えても画面定義を変えない** | §14-7 |
| D-7 | **ポータルのデモ世界は「青嶺精工と碧洋銀行を顧客に持つ、日系 SIer の中国拠点ソリューション部門」。** カタログ 67 サービスとポータルが 1 つの架空世界でつながる | §14-3 |
| D-8 | **P0 は「案件とアクション ＋ 画面の中の AI」**（旧 P0「私のページ」から差し替え） | §8 |
| D-9 | **新しい制約 C2（環境間で一致させる設定）と C3（ロール名を AD の 5 区分に揃える）** を初日から効かせる。**いま無料で入る保険** | §3-5・§3-6 |

### R-4. 改訂で無効になった判断（消していない。どこに残したか）

| 無効になったもの | どこに残したか |
|---|---|
| §4-4 の未確認表（U1〜U14 を「すべて未確認」と書いた版） | §4-4 の決着表に置き換え。**初版の記述は §15 附録 A-1 に全文** |
| §4-5 案 A〜案 D の比較（中心の問い） | §4-5 を「決着」に書き換え。**採否と理由は残している**（案 A・案 B を採らない理由は今も有効） |
| §4-6 代替 B（定義を手続きで持つ） | **決着＝不要になった**（Migration Manager が公式手段）。§4-6 に「決着」と明記して残す。代替 C（データソース名の固定）は**名前を `hr` → `biz` に変えて生きている** |
| §5 全体（勤怠・研修・年休・お知らせ ＝ 人事系ドメイン） | §5 を案件系に差し替え。**人事系の判定表（`feed_items` に乗る／乗らない）は §15 附録 A-2 に全文保存**。スコープ外にしただけで、判断そのものは今も有効 |
| §6-2 `data/world/` に足す 4 ファイル（勤怠・年休・研修・お知らせ） | **取り下げ。** 代わりに §14-8（部門・顧客・案件・Action・KPI）。§15 附録 A-3 |
| §8 P0「私のページ」3 画面 | §8 を差し替え。**旧 P0 と AC-1〜AC-7 は §15 附録 A-4 に保存**（新 AC への対応表つき） |
| §7-2 の GitHub Environment / Actions 従量の議論 | 論点消滅。§7-2 に「決着」と明記して残す |
| §11-1（V-PM-1 をやるか） | **実施済み。**`docs/handoff/2026-09-11-nocobase-research.md` が成果物 |

### R-5. 変わっていないもの（改訂しても動かない土台）

- **リポジトリを分ける**（§1。決定的な理由 R1 ランタイム境界は今も有効。GitLab へ移っても変わらない）
- **新リポ `shoulang0729/portal` に実データが 1 バイトも入らない**（§7-4 `check-nodata.mjs`）。**前提がいくつ変わってもここは変わらない。** むしろ GitLab 移行を安全にする土台になった（§7-7）
- **架空データの正本は現リポ `data/world/`。方向は片方向（dify → portal）。逆流禁止**（§6-1）
- **管理番号（`KN-02` 形式）が共通語彙**（§6-3・§6-4）。**デモ→本番でも不変**で、Dify 移行のキーになる
- **マスキングを採らない**（§4-9）
- **NocoBase の AI 機能を使わない。AI の正本は Dify**（§4-3）

---

## 0. 結論（1 画面分）

| 問い | 結論 |
|---|---|
| リポジトリ | **分ける。新リポ `shoulang0729/portal`（public）。** 現リポは 1 バイトも移さない（§1）。**本番は GitLab Self-Managed へ移る**（§7-7） |
| **リポジトリに入るもの／入らないもの** | 入る＝**定義**（画面・スキーマ・ロール・WF）と**業務テーブルの DDL（Flyway の SQL）**と**架空のデモデータ**（`data/world/` 由来）と設計書。**入らない＝実データ・秘密・接続先の実値**（すべて `${VAR}`。§7-6） |
| public にする以上やること | ① **実データが入らないことの機械検査**（`tools/check-nodata.mjs`。§7-4）② **公開されるものの一覧**を PM が 1 つずつ見る（§7-5）③ **秘密の置き場**を `dify/env` の型そのままで（§7-6） |
| 位置づけ | **別製品ではなく「同じ製品の別デプロイ単位」**。ポータル ＝ **PC-16 本番 UI (b) 自前フロント**の実装 ＋ AI 以外の面（顧客・案件・Action・KPI・人員・会議）の追加（§2） |
| **いま作るもの** | **デモ版だけ**（§0-3）。本番（AD / GitLab / Outline / Dify Enterprise）は**到達点として設計書に書くが実装しない** |
| **デモと本番の関係** | **アーキテクチャそのものが違う。** 層ごとの対応と「置き換えの境目」は **§0-2 が本書でいちばん重要な表** |
| **唯一変えてはいけない層** | **業務スキーマ。** DDL は Flyway の SQL で Git 管理し、デモと本番に**同じファイルを流す**（§3-3） |
| エディション | **デモも本番も Professional。** Migration Manager（定義移送）も Auth: LDAP も Professional+、かつ **Standard は自社内部利用のみ＝顧客提示デモが利用条件を外れうる**（§4-11） |
| スキーマの方式 | **方式 (b) 外部データソース: External PostgreSQL。** NocoBase は業務 DB に一切触らない（公式に明記）。DDL は Flyway で Git 管理。方式 (a)（メイン DB 内で取込）を採らない理由は §4-11-3 |
| 実データと顧客提示の両立 | **同じ定義・2 インスタンス（案 C）＋ 接続の向き先を変える（案 D）。移送手段は Migration Manager に決着**（§4-5） |
| 定義の移送 | **Migration Manager（Professional+）。** `collections`/`fields`/`uiSchemas`/`desktopRoutes`/`roles`/`dataSources`/`workflows` を Overwrite、業務テーブルは Schema-only（**外部 DB は対象外なので Flyway が担う**） |
| その前提を成立させる最初の制約 | **C1**（定義をデータと別の器に持つ）＋ **C2**（環境間で一致させる設定を初日に決めて固定）＋ **C3**（ロール名を AD の粗い 5 区分に揃える）。§3 |
| 業務ドメイン | **顧客 / 案件 / Action / 会議 / KPI / 人員リソース / 文書リンク / AI サービス**（§5）。**勤怠・研修・年休は今回のスコープ外**（落としたのではない。§5-6） |
| To-Do の器 | **`actions` 1 つ。** PC-01 `feed_items` の役割は `actions` が担う（`kind`・`status`・`source`・`source_ref` の意味を引き継ぐ。§5-4） |
| お知らせ | **`announcements` は P2 へ後ろ倒し**（§5-5）。PC-19 の採番もその PR で |
| Outline との境界 | **NocoBase＝業務データ（構造化）／Outline＝文書。** 接点は `document_links`。**実 URL を持たず** `${PORTAL_OUTLINE_BASE}` と結合する（§5-7） |
| **AI の置き方** | **1 ページに隔離しない。** 既定は **(a′) 画面のボタン → Workflow（同期）→ HTTP request → 結果を画面へ**。iframe は「Dify そのものを見せる」場面に限る。画面 → 管理番号 → 実機 → 置き方 → 渡す文脈の表は **§14-4** |
| **サービスを増やしたとき** | **画面を直さない。** `ai_services` テーブル ＋ コレクション駆動ブロック（Grid Card / List）。行を足すだけで増える（§14-7） |
| デモの架空世界 | **「青嶺精工と碧洋銀行を顧客に持つ、日系 SIer の中国拠点ソリューション部門」。** カタログ 67 サービスとポータルが 1 つの世界でつながる（§14-3） |
| `data/world/` | **足す。ただし中身が変わった**：勤怠・年休・研修・お知らせ（取り下げ）→ **部門・顧客・案件・Action・KPI**（§14-8）。正本は現リポ・§2-13 を曲げない |
| 共有の仕組み | **最初は作らない。手コピー＋出典行。** 方向は**現リポ → 新リポの片方向のみ**（§6） |
| 最初に作る 1 つ | **P0「案件とアクション ＋ 画面の中の AI」**（§8）。真の目的は **AC-1（Migration Manager で定義だけを別インスタンスへ移せる）** と **AC-2（業務 DB に NocoBase が触っていない）** |
| 現リポへの変更 | 本 PR（設計書改訂＋調査記録の取り込み）＋ PR-2（`data/world/dept/` 新設）＋ PR-3（`docs/dify/**` 追記・`README.md` 1 行・`CLAUDE.md` 1 行。**PM 了承済み**）。**`CLAUDE.md` §2 は触らない。`pages.yml` も触らない**（§9） |
| P0 のブロッカー | ① **Professional の購入**（§11-9）② **実機 12 本の app id と公開 Web アプリ URL の登録**（`dify/env/cloud-master/env.yml` の `apps:` が全部 `id: null`、`mock/js/data/live.js` の `LIVE` が空。§14-4b。**別 Issue**） |

### 0-1. 触らない範囲（明示。reviewer の diff 監査の基準）

- **`mock/**`**（`catalog.html`・`css/**`・`js/**`）— **1 バイトも変えない**。データ層（`CATS`/`SVCS`/`TAGS`/`SCENARIOS`/`HOME`/`FEED`/`LIVE`）も不変。よって **`tools/regress.mjs --update` は不要**
  - **注**：§14-4b の「実機 12 本の公開 URL 登録」は `mock/js/data/live.js` を触るが、**本 Issue の範囲外・別 Issue**（`run:mac`／`run:runner`）。本 PR・PR-2・PR-3 では触らない
- **`tools/**`・`tools/regress.baseline.json`・`scripts/**`**
- **`dify/**`**（`apps`・`env`・`kb`・`tests`・`samples`・`state`・`results`）
- **`.github/workflows/**`** — 特に **`pages.yml` の `path: mock`**（`CLAUDE.md` §2-8）。ポータルは静的サイトではないので Pages の対象にならない（§7-1）
- **`.claude/**`・`CLAUDE.md`** — 本 PR では触らない。§2 load-bearing の変更は要求しない。地図への 1 行追加は PR-3（§9-1。PM 了承済み）
- **`docs/dify/**` の既存記述** — 本 PR では変更しない。追記案は §9-2 に書くだけで、適用は PM 承認後の別 PR
- **`docs/handoff/**` の既存設計書** — 本 PR が変更するのは **`2026-09-10-portal-nocobase.md`（本書。改訂）** と **`portal-nocobase.issue.md`（Issue 本文の更新）** のみ。**`2026-09-11-nocobase-research.md` は新規追加**

### 0-2. ★ デモ構成と本番構成の対応表（本書でいちばん重要な表）

**PM 構成案（AD / GitLab Self-Managed / Outline Self-Hosted / Dify Enterprise）は本番の到達点であり、デモの構成ではない。** それらはすべて「既存環境を利用」＝中国拠点・顧客側にあり、**いま我々の手元には無い**。

**4 列目（置き換えの境目）が本書の要。** ここが曖昧なまま作ると、デモが本番に移せない形で固まる。

| 層 | デモで使うもの（**いま作る**） | 本番で置き換わるもの（**到達点。作らない**） | 置き換えの境目 —— 移行時に何が変わるか |
|---|---|---|---|
| **業務 DB（スキーマ）** | PostgreSQL（架空世界データ） | PostgreSQL（実データ） | **スキーマは同一。データだけ違う。ここだけは絶対に変えない**（C1 の本体）。境目＝**接続文字列 `${PORTAL_DSN_BIZ}` だけ**。DDL は同じ Flyway の SQL を両方に流す（デモ＝実装者、本番＝社内の運用者）。**同じファイルであることが機械で確認できる**（`information_schema` の diff） |
| **認証** | NocoBase のローカルユーザー（架空社員。P0 は 5 名） | オンプレ AD → **Auth: LDAP（Professional+）** | **ロール名・ロール定義・データスコープは同じ。** 差し替わるのは「誰がどのロールに入るか」の供給元だけ。境目＝① `users` の行の作り方（手入力 → LDAP 同期）② ロール付与の経路（手動 → **OU → 部署 → 部署ロール**）。**条件＝ロール名を AD の粗い 5 区分と 1:1 にしておくこと（C3）** |
| **データ権限** | ブロックのデータスコープ「担当者 = Current user」 | 同じ（＋ 必要なら PostgreSQL の RLS / View） | **定義は同じ。** 境目＝ RLS を足すかどうかだけ。**「Own records（作成者ベース）」に依存しない**ことが条件（代替 E。§4-6） |
| **NocoBase 本体** | セルフホスト（PM のローカル docker **2 台**） | セルフホスト（中国拠点の社内サーバ） | 境目＝`.env`（`DB_*`・`APP_KEY`）とライセンスキー（**Instance ID 単位**）。**`DB_UNDERSCORED`／`DB_TABLE_PREFIX`／`DB_SCHEMA`／`COLLECTION_MANAGER_SCHEMA` は両環境で一致必須**（Migration Manager の条件。**C2**） |
| **定義の移送** | デモが**定義の正本**。デモ 1 号機 → デモ 2 号機で移送を実証 | デモ → 本番の一方向 | **手段は同じ（Migration Manager）。** 境目＝移送先が増えるだけ。`environmentVariables` は Schema-only 既定＝**環境ごとの値は運ばれない**（意図どおり） |
| **AI** | **Dify Cloud**（`cloud-master`。稼働 **12 本**。**架空データしか入っていない**） | **Dify Enterprise**（社内） | 境目＝**`${DIFY_BASE_URL}` と `${DIFY_API_KEY_<番号>}`／`${DIFY_WEBAPP_URL_<番号>}` だけ**。**管理番号（`KN-02` 等）は不変**で、これが移行のキーになる（§10-1）。**⚠️ 本番の実データを Dify Cloud に送らない。(a′) の呼び出しは Enterprise に切り替わるまで本番で有効にしない**（§14-5 の歯止め） |
| **Knowledge** | **Outline は無い。** `document_links` は種別＋識別子＋表示名だけを持ち、`${PORTAL_OUTLINE_BASE}` が未設定なら**「（デモ環境では未接続）」と表示**してリンクを張らない | Outline Self-Hosted（AD →(LDAP)→ GitLab →(OIDC)→ Outline） | 境目＝**`${PORTAL_OUTLINE_BASE}` を入れるだけ**。**条件＝デモで実 URL を 1 つも書かないこと**（`CLAUDE.md` §2-10 と同じ理由。§5-7） |
| **ソース・CI** | GitHub（`shoulang0729/portal`・public）＋ GitHub Actions | GitLab Self-Managed（社内）＋ GitLab CI | 境目＝**ワークフロー定義 1 枚**（`.github/workflows/verify.yml` → `.gitlab-ci.yml`）。**条件＝CI の中身をシェル 1 行（`npm test`）に閉じ、ロジックを YAML に書かないこと**（§7-7） |
| **デプロイ** | 手元の docker に手で流し込む | 社内サーバ（GitLab CI から流せるようになる可能性がある） | 境目＝**流し込みスクリプト `scripts/apply.sh --strict` の呼び出し元が人から CI に変わるだけ**。**条件＝手順をスクリプト 1 本に閉じること**（手順書に人手の操作を書かない） |
| **公開範囲** | **顧客に見せる**（架空データのみ） | 社内のみ | 境目＝リポジトリの可視性。**実データが 1 バイトも入らない前提を守る限り、GitLab が正本になっても GitHub public への全量ミラーが安全に成立する**（§7-7。これが移行を容易にする最大の理由） |
| **通知** | **無し**（画面内の一覧だけ） | Teams（**中核にしない**。使えなくてもポータルは動く） | 境目＝Workflow に通知ノードを 1 つ足すだけ。**デモでは作らない**（作ると「Teams 前提」に見える） |
| **ネットワーク** | 日本側・インターネット可（Dify Cloud を呼ぶ） | 中国拠点・**国内で単独稼働**（国外 SaaS に恒常依存しない） | 境目＝**外向きの呼び先が Dify Cloud から社内 Dify Enterprise に変わる 1 点だけ**。**条件＝Google 等の国外 SaaS をデモでも使わないこと**（使うと本番で外せなくなる） |
| **監査・履歴** | 業務 DB 側の `*_history` テーブル（Flyway で作る） | 同じ | **NocoBase の Record history（Professional+）・Audit logs（Enterprise+）に依存しない**（§4-3。調査で裏が取れた）。境目＝無し |

### 0-3. いま作るのはデモ版だけ

- **本番の実装はしない。** 本書の本番側の記述は「移行時にこうなる」という**見通し**であって、作業指示ではない
- **§8 の P0 はデモ版の P0。** 受け入れ条件（AC-1〜AC-10）もデモ版のもの
- **設計の眼目は「デモで作ったものが、本番にそのまま移せること」。** だから §0-2 の 4 列目が最重要
- **本番側で先に決めておくことは 3 つだけ**：**C1**（定義とデータを分ける）・**C2**（環境間で一致させる設定）・**C3**（ロール名を AD の 5 区分に揃える）。いずれも**デモの初日に無料で入る保険**（§3）

---

## 1. なぜ分けるのか（結論は出ている。次に読む人のための記録）

PM は 2026-09-10 に「分離」で確定した（当初 private、のち **public** に変更）。以降この問いを繰り返さないために、根拠を残す。**結論（分ける）は変わらないが、理由は入れ替わった**（§1-2b）。

### 1-1. 決定的な理由 —— **R1 ランタイム境界**

**動かし方が違う。**

現リポは「ビルド不要の静的モック ＋ 宣言ファイル ＋ Node/Python の検証スクリプト」。`package.json` に **`dependencies` が 1 つも無く**、`npm test` が `node tools/verify.mjs && node tools/regress.mjs` の 2 本で完結する。ブラウザで `mock/catalog.html` を開くだけで動く（`file://` 対応が `CLAUDE.md` §2-3・§2-8 で load-bearing になっている）。

NocoBase は **Koa の常駐サーバ ＋ Sequelize のリレーショナル DB ＋ Redis ＋ cron ＋ WebSocket**（§4-2 A2）。`npm ci`・lockfile・migration・docker が入る。**改訂で Flyway（業務 DB の DDL）と PostgreSQL も加わった**ので、この差はさらに開いた。

同じ `main` に混ぜると：

- **`npm test` の意味が変わる。** `CLAUDE.md` §3 の「1 つでも FAIL ならマージしない」ハーネスに、DB を要するテストが同居する
- **`dependencies` ゼロという現リポの性質が失われる。** これは「ビルド不要」を支えている土台で、`mock/` を `file://` で開ける前提（§2-8）と繋がっている
- **CI 時間が桁で変わる**（現状の `verify` ワークフローは数十秒）

### 1-2. 補強する理由

| # | 理由 | 根拠 |
|---|---|---|
| **R2** | **変更速度と参加者が違う** | カタログ・DSL は PM ＋ 3 エージェントで日次に回る。ポータルは情シス・中国拠点の承認、AD／GitLab／Outline の既存環境への申請が絡む。同じ `main` に混ぜると片方のレビュー待ちがもう片方のリリースを止める（`CLAUDE.md` §5 は squash マージ 1 本道） |
| **R3** | **`path: mock` の 1 行の負荷が増える** | いまは公開してまずいものが `mock/` の外にも無いので、`path: mock` は「安全側の設定」。NocoBase の docker-compose・migration・エクスポートが同居すると、Pages に何が出るかの判断がこの 1 行に集中する |
| **R4** | **検査の対象が違う** | 新リポには**現リポに無い検査**（§7-4 の `check-nodata.mjs`）が要る。逆に現リポの検査（多言語 3 言語一致・CSS トークン・`SCENARIOS` 整合・Pages 設定）は新リポで 1 つも FAIL しない。混ぜると**どちらのリポでも「自分に関係ない検査」が並ぶ** |
| **R5**（2026-09-11 追加） | **将来、正本のホストが分かれる** | **本番は GitLab Self-Managed（社内）へ移る**（§7-7）。現リポ（カタログ・DSL・架空世界の正本）は GitHub に残る。**1 つの `main` に混ざっていたら、この分岐は不可能だった** |

### 1-2b. 取り下げた理由（**消さずに残す**。次に読む人が同じ問いを立てるため）

> ~~**public リポジトリに、実在従業員の勤怠・年休・研修を扱う schema とデータを置く選択肢が無い。**~~

**この理由は成り立たない。**（2026-09-10、PM 確定事項 2 により取り下げ）

PM の設計では **リポジトリに実データが 1 バイトも入らない**（定義と架空のデモデータだけ。本番は空の定義をデプロイして中身を別途投入する）。したがって「public に実データを置く」という状況が発生しない。

本書の初版はこれを「決定的な理由」として §1-1 に置いていた。**入れ替えた。** いま決定的なのは **R1（ランタイム境界）**。

**ただし、この理由が取り下げられたことで新しく必要になったものがある**：「実データが入らない」は**運用のルールであって、機械で見なければ破られる**。→ **§7-4 の検査を設計した。**

なお **schema（列名）そのものは公開される**。これは「実データ」ではないが**自社が何を測っているかが読める**ので、**§7-5 に公開されるものの一覧を置き、PM が 1 つずつ見られるようにした。**

**2026-09-11 補足**：ドメインが人事系から案件系に変わったことで、公開される列名の性質も変わった（`勤怠.打刻漏れ回数` → `projects.revenue`・`projects.risk`）。**§7-5 の判断対象は増えていない**が、P-1／P-3 の具体例を差し替えた。

### 1-3. PM 代行の見立てのうち、成り立たなかったもの（訂正）

> 「`check-world.mjs` の『全部が架空データ』という前提が曖昧になる」

**成り立たない。** `tools/check-world.mjs` は走査対象がディレクトリの **allowlist**（`mock/js/data/scenarios/**`・`dify/kb/**`・`dify/tests/**`・`docs/dify/usecases/**`・`dify/samples/**`）で、新しいディレクトリを足しても自動では見ない。「例外が要る」事態は自動的には起きない。

むしろ逆で、**ポータルのデモ用データを `data/world/` に足すのは §2-13 に沿った正しい行為**であり、現リポに残す理由になる（§14-8）。分ける理由としては使わない。

### 1-4. 「別リポジトリ」か「別デプロイ単位」か

**別デプロイ単位。** ポータルは `docs/dify/platform-components.md` の **PC-16 本番 UI (b)** そのものであり、67 サービス・管理番号・env レイヤーと同じ製品に属する。リポジトリを分けるのは**運用上の都合（可視性とランタイムと、将来のホスト分岐）**であって、製品を切るのではない。

この区別が効く場面：**新リポは現リポの語彙（管理番号・分類・架空世界）に従う**。逆はしない（§6-4）。**本番が GitLab に移っても、この従属関係は変わらない**（§7-7-5）。

---

## 2. PM の要望 × 既存設計（PC-01 / PC-02 / PC-16 ほか）の対応

「新しく作るもの」と「既にある設計を実装するだけのもの」を分ける。**2026-09-11 改訂でドメインが変わったので、表を差し替えた。**（旧版の人事系の行は §15 附録 A-2）

| PM の要望（原文の語） | 既存設計 | 判定 |
|---|---|---|
| **部門ポータル本体 / CRUD 画面** | **PC-16 本番 UI (b) 自前フロント**（「推奨」と明記。先行順 **18 番**、工数感 **L**）。「モックの情報構造を持ち、SSO（PC-02）→ Dify Service API」 | **要件は既存。** 新規は ① **実装手段の選定（NocoBase）** ② **AI 以外の面も載せる**という範囲拡張（PC-16 は AI サービスの UI しか想定していない） |
| **顧客 / 案件 / TODO・Action / 会議 / 人員リソース** | **PC-01〜PC-18 に無い。** PO-04（稼働集計）・GN-06（頼まれ事の追跡）・GN-04（スケジュール調整）は *AI サービス* であって、案件データの器ではない | **新規。** §5 のテーブル群。**ただし PC-01 `feed_items` の設計（`kind`／`status`／`source`／`source_ref`／冪等キー）を `actions` が引き継ぐ**ので、ゼロからの設計ではない（§5-4） |
| **KPI / ダッシュボード** | モックの ② `renderDash`（`HOME.frequent`／`recommended`）は **AI サービスの利用ダッシュボード**。経営 KPI のダッシュボードではない | **経営 KPI は新規。** 受け皿は `plugin-data-visualization`（**無料**と調査で確定）。**AI サービスのダッシュボード（②）とは別画面にする**（混ぜると PC-16 の ② の意味が消える）。**外部データソースをチャートに使えるかは不明（U15）** → §4-6 代替 D |
| **部門共通知識（Knowledge）** | `docs/dify/**` の KB 設計は **Dify の RAG 用**（機械が読む）。人が読む Wiki の設計は無い | **Outline に置く（新規の外部境界）。** NocoBase は `document_links` でリンクするだけ（§5-7） |
| **AI による検索・要約・分析** | PC-16 (b) の API 対応が既に定義済み：qa 型＝`POST /v1/chat-messages`、upload/diff 型＝`POST /v1/files/upload` → `POST /v1/workflows/run`、form/lookup 型＝`POST /v1/workflows/run`。結果パネルは `Result` 型 | **既存の実装。** 足りないのは §10 の 4 点（キーの粒度・`user` の匿名化・エラー時の見せ方・ストリーミング）と、**§14（画面の中にどう置くか）** |
| （利用者の識別・部署・権限） | **PC-02 認証・ロール**：SSO → 社員 ID・部署・拠点・言語 → **Dify Service API の `user` に社員 ID**。**権限は前段で判定** | **既存の実装。** NocoBase 側の受け皿は `plugin-departments`（無料）＋ `plugin-acl`。**本番の AD 連携は Auth: LDAP（Professional+）**。**AD グループ → ロールの直接マッピングは記載なし**（U18。§4-4b） |
| **各種経営管理システム** | **PC-04 業務システム連携**：読み取り（照会）・受信（イベント）・取込形式の出力。**登録・承認はしない** | **既存。ただし新しい決めが 1 つ**：これまでは「Dify → アダプタ → 基幹」の一方向前提だった。**ポータルが Dify を経由せず直接読む経路**を認める（§9-2 の追記案 (3)）。**今回のスコープ外**（P2 以降） |
| **Teams / Google** | 設計なし | **中核にしない。** Teams は通知とリンクだけ、Google は恒常依存しない。**デモでは両方とも作らない**（作ると本番で外せなくなる。§0-2） |

### 2-1. 1 行でいうと

**ポータル ＝ PC-16(b) ＋ PC-02 ＋（新規）部門の業務データの器 ＋（新規）画面の中に埋まった AI。**
PC-16 と PC-02 は**新しく設計するものではなく、実装するもの**。新規の設計判断は **業務テーブルの器**（§5）と **AI の置き方**（§14）の 2 つ。

---

## 3. 最初の制約 —— 「デモで作る」を、本番にそのまま移せる形で始める

守らずに始めると、3 か月後に「本番に移す」段になって、画面タイトル・選択肢・ワークフローの分岐条件に実在の部署名・拠点名・社内コードが焼き込まれており、**画面を作り直すことになる**。これは `CLAUDE.md` §2-12 が「マスタ DSL を環境ごとに fork すると差分が追えなくなる」と書いているのと同じ失敗。

**C1・C2・C3 はすべて「デモの初日に入れれば無料、後から入れると作り直し」という性質を持つ。**

### C1（設計全体の前提）

> **画面・スキーマ・ワークフローの「定義」を、データと別の器に置き、空のインスタンスへ流し込める形で持つこと。**

Dify 側の「マスタ DSL 1 本 ＋ `env.yml` 1 枚」（`CLAUDE.md` §2-12）と同じ形。ポータルに読み替えると：

| Dify 側 | ポータル側 |
|---|---|
| `dify/apps/*.yml`（マスタ DSL） | **Migration Manager の移送ファイル**（画面・コレクション・ロール・ワークフロー）＋ **Flyway の SQL**（業務テーブルの DDL） |
| `dify/env/<env>/env.yml`（環境差分） | **`.env`（`DB_*`・`APP_KEY`）＋ `env/<env>/portal.yml`（データソース名・閾値のキー名）＋ NocoBase の Variables and Secrets** |
| `render.py --env <env>` | `scripts/apply.sh --strict`（移送ファイルの適用 ＋ Flyway） |
| `render.py --check` がバイト一致 | **AC-1**（空のインスタンスに流し込むと同じ画面が出る）＋ **AC-2**（`information_schema` の diff がゼロ） |

### 3-1. C1-a — 定義に実データの語を焼き込まない（**不変**）

- 画面タイトル・ブロック名・選択肢・フィルタの既定値・ワークフローの分岐条件に、**実在の部署名・拠点名・社員名・顧客名・社内コードを直値で書かない**
- 表示文言は **Localization Management**（無料。コレクション名・フィールド名・メニューの ja/zh/en を UI で管理できると調査で確定）に置く。**3 言語同時**（現リポ `CLAUDE.md` §2-1 と同じ精神。文言は §5-9 に ja/zh/en を全部書いた）
- 選択肢は**マスタテーブル**（`departments`・`sites`・`customers`）から引く。テーブルの**行**は環境ごとに違ってよい
- **`CLAUDE.md` §2-12 の「プレースホルダ（`{{…}}`）は入れない」とは方向が違う**点に注意：Dify は「Cloud にそのまま貼れること」を優先してプレースホルダを禁じている。ポータルは URL インポートの制約が無いので、**参照（テーブル引き）と `${VAR}` の両方で解決してよい**（§7-6-3）

### 3-2. C1-b（**2026-09-11 改訂**）— 業務データを NocoBase の Master DB に置かない

> ~~**勤怠・年休・研修・人事は、外部データソースの読み取り専用接続にする**~~（初版。ドメインが変わったため差し替え）

**新しい形**：**業務データは別の PostgreSQL（外部データソース `biz`）に置き、DDL は Flyway で Git 管理する。NocoBase の Master DB には NocoBase 自身のシステムテーブルと定義しか入れない。**

- 根拠：調査 A-2 —— 外部データソースについて NocoBase は **"does not create columns, change column types, or delete real fields"** と**明記**している。これで「NocoBase をやめても業務データが残る」（PM 原則 11）が**推測でなく公式の記述で担保される**
- ポータルが Master DB に持ってよいのは、**NocoBase 自身のもの**（`users`・`roles`・`uiSchemas`・`workflows`・`environmentVariables` 等）**だけ**
- **これが「差し替え」の本体**：本番インスタンスは**同じ定義のまま、`biz` の接続先を本番 DB に変えるだけ**で成立する
- 方式 (a)（メイン DB 内で既存テーブルを取り込む）を採らない理由は **§4-11-3**

### 3-3. ★ デモ／本番で唯一変えてはいけない層 —— 業務スキーマ

- **DDL は `migrations/V<n>__<name>.sql`（Flyway 形式）として新リポで Git 管理する。** デモにも本番にも**同じファイルを流す**
- **NocoBase の画面から業務テーブルの列を足さない。** 足したくなったら Flyway の SQL を書き、流し、NocoBase 側で「Sync from database」を押す（調査 A-3。**自動追随はしない。手動同期**）
- **機械で確認できる**：デモと本番で `information_schema.columns` を吐いて diff を取る（**AC-2**）。`render.py --check` が「バイト一致」で担保しているのと同じ考え方
- **なぜ**：ここが一致していないと Migration Manager が運ぶ定義（`uiSchemas` のフィールド参照）が本番で壊れる。**画面が壊れる原因の第 1 位**

### 3-4. C1-c — 定義の移送を、作り始めた日から毎週やる

- **Migration Manager の移送ファイル（`.nbdata`）を毎週生成し、新リポにコミットする**（`yarn nocobase migration generate --ruleId=<id>`）
- **diff が読める形式かは不明（U4/U19）。** 読めなかった場合に備え、**定義の人が読める写しを併置する**：NocoBase の HTTP API（`plugin-api-keys`。無料）でコレクション・フィールド・ロール・ルートを JSON に吐く `scripts/dump-schema.mjs` を書き、**そちらを diff 監査の対象にする**（**AC-9**）
- 現リポの Issue #3（Dify の export 方向）と**同型の問題**。あちらで解けていないことを楽観しない

### 3-5. C2（新規・2026-09-11）— 環境間で一致させる設定を、初日に決めて固定する

Migration Manager は次の環境変数が**両環境で一致していないと移行できない**（調査 B-1）。しかも `DB_UNDERSCORED` と `DB_TABLE_PREFIX` は**後から変えられない**（調査 A-4）。

| 変数 | 決める値 | 理由 |
|---|---|---|
| `DB_UNDERSCORED` | **`true`** | 列名を snake_case にする。**NocoBase をやめたとき別システムから素直に読める**（PM 原則 11）。既定の camelCase は他システムから見て癖がある |
| `DB_TABLE_PREFIX` | **`nb_`** | NocoBase のシステムテーブルに接頭辞を付け、業務テーブルと区別する。方式 (b) では物理的に別 DB なので必須ではないが、**方式 (a) に落ちたときの取り返しが効く**（無料の保険） |
| `DB_SCHEMA` | **`public`** | 明示して固定する。**公式ドキュメントの環境変数一覧にはこの変数の説明が無い**（名前だけ Migration Manager のページに出る）ので、**値を決めて台帳に書くこと自体が防衛**になる |
| `COLLECTION_MANAGER_SCHEMA` | **設定しない（＝ `DB_SCHEMA` と同じ）** | 同上。**ドキュメントに説明が無い**ので、使わないことで不一致の芽を潰す |
| 業務テーブルの主キー | **`bigint`（明示）または `uuid`** | NocoBase 既定の Snowflake ID を業務テーブルに持ち込まない。**業務 DB は我々が Flyway で作るので、そもそも NocoBase の既定は効かない**が、**明文化しておく**（方式 (a) に落ちたときに効く） |

**この 5 行を新リポの `env/README.md`（環境台帳）に書き、`.env.example` と docker-compose の両方に同じ値を置く。** `dify/env/README.md` の環境台帳と同じ形（§6-5）。

### 3-6. C3（新規・2026-09-11）— ロール名を AD の粗い 5 区分に揃える

PM 構成案：AD には粗い組織（**Management / Sales / Delivery / PM / General User**）を持たせ、案件単位の細かい権限は NocoBase 側。

**デモは AD を持たないが、ロール名だけは初日からこの 5 つにする。**

- NocoBase のロール名を **`management` / `sales` / `delivery` / `pm` / `general`** に固定（表示名の ja/zh/en は §5-9）
- **6 つ目を作らない。** 細かい権限は「ロールを増やす」ではなく「**データスコープ**（担当者 = Current user 等）」で表現する
- **なぜ**：本番で AD → 部署 → **部署ロール**の経路に載せるとき、**ロール名が AD 側の区分と 1:1 でないと対応表が要る**。対応表は移行時に必ず腐る
- **⚠️ 未解決**：**AD 側がこの 5 区分を OU で表現しているのか、セキュリティグループで表現しているのかで設計が変わる**。調査 C-2 —— **セキュリティグループ（`memberOf`）ベースの対応付けはドキュメント上の手段が無い**。書かれている唯一の経路は **OU → 部署 → 部署ロール**。→ **PM 判断 11-11**

### 3-7. C1 が守れているかの機械検査（新リポ側）

| # | 検査 | 内容 | 詳細 |
|---|---|---|---|
| **V1** | **実データが入っていない**（定義と架空データだけ） | `data/world/` から機械で作った **allowlist** に無い、人名・社員番号・部署名・メール・電話・実在ドメインを検出。**禁止語リスト方式にしない**（禁止語リスト自体が実名の一覧になる） | **§7-4 に具体化**（`tools/check-nodata.mjs`。**実装済み**） |
| **V2** | 秘密が無い | `CLAUDE.md` §2-10 相当。**public なので必須** | §7-6（`${VAR}` の型）＋ §7-4 の N4/N5/N6・G1 |
| **V3** | 定義の写しの鮮度 | 最後の `dump-schema` が N 日以内（`tools/gen-index.mjs --check` が `docs/service-map.md` の鮮度を見ているのと同じ形） | §3-4 |
| **V4**（新規） | **スキーマの一致** | `migrations/**` を空の PostgreSQL に流した結果と、`schema/current.sql`（コミットされた `information_schema` の写し）が一致 | §3-3・**AC-2** |

---

## 4. NocoBase —— 判明したこと／依然として不明なこと

**NocoBase の採用は PM が決めた前提。** 本節は採否を論じない。**設計が推測の上に乗らないように、根拠のある事実と不明を分ける**ためのもの。

**2026-09-11 改訂の方針**：初版 §4-4 は「**すべて未確認。断定しない**」という態度で書かれていた。**その態度は変えない。** 変わったのは、25 問の公式調査（`docs/handoff/2026-09-11-nocobase-research.md`）で**一部に答えが出た**ことだけ。調査レポートが「ドキュメントに記載なし」と言っているものは、**引き続き「不明」として残す。「できない」に変換しない。**

### 4-1. 到達性（改訂：**本環境からは依然として到達できない**）

| 対象 | 本環境からの結果（2026-09-10・**2026-09-11 も同じ**） |
|---|---|
| `https://www.nocobase.com` | **到達不可**（agent proxy が CONNECT に 403） |
| `https://docs.nocobase.com` | **到達不可**（同上） |
| `https://github.com/nocobase/nocobase` | **到達不可** |
| `https://registry.npmjs.org/@nocobase/*` | **到達可**（proxy の `noProxy` に含まれる） |

**したがって本書の「判明」は、すべて `docs/handoff/2026-09-11-nocobase-research.md`（PM が別環境で実施した調査）からの引き写しである。** architect は公式ページを直接見ていない。**出典 URL は調査記録にある。** 疑わしいときは原文に当たること。

### 4-2. (A) npm レジストリで確認済みの事実（初版のまま。取得日 2026-09-10）

| # | 事実 | 根拠 |
|---|---|---|
| A1 | `@nocobase/server` の最新は **2.2.9**、ライセンス **Apache-2.0**、公開 **2026-09-09**。初版 2021-04-07 | `registry.npmjs.org/@nocobase/server`。**2026-09-11 訂正**：調査で **v2.2.10（2026-09-10 リリース）が Latest** と判明 |
| A2 | **Node.js の常駐サーバ ＋ リレーショナル DB**。依存に `koa`・`@koa/router`・`ws`・`redis`・`cron`、`@nocobase/database` の依存に **`sequelize`**・`umzug` | 同上・`@nocobase/database`。**調査 E-1／E-5 で裏が取れた** |
| A3 | **静的ホスティングには載らない**（GitHub Pages で配れない） | A2 の帰結 |
| A4 | Apache-2.0 で npm に出ている 2.2.9 のプラグイン群（`plugin-acl`／`users`／`departments`／`auth`／`data-source-manager`／`workflow`／`workflow-request`／`api-keys`／`block-iframe`／`data-visualization`／`localization`／`file-manager`／`notification-*`／`action-export`／`backup-restore`／`multi-app-manager` ほか） | 各パッケージの `license` と `time` |
| A5〜A10 | `plugin-departments`（部署の階層・ロール紐付け）／`plugin-acl`（ロール×リソース×アクション）／`plugin-data-source-manager`（内蔵・外部 DB・API）／`plugin-workflow-request`（任意の HTTP サービスへリクエスト）／`plugin-block-iframe`（iframe ブロック）／`plugin-api-keys`（API キーで HTTP API） | 各 `description`。**すべて調査 C-3／D-1／D-2 で裏が取れた** |
| A11 | **`plugin-multi-app-manager` は「テスト・デモ環境向けのみ。本番では使うな」と配布者自身が明記** | 同パッケージの `description`。**調査 C-4 で「deprecated → 後継 App supervisor（Enterprise+）」と判明。判断は変わらない** |
| A12 | `plugin-backup-restore` は「アプリケーションの複製・移行等のためのバックアップとリストア」 | **2026-09-11 訂正**：調査 B-2 —— **v1.4 で非推奨。後継 Backup Manager はフルバックアップのみで「定義だけ」は運べない**。→ U14 の答えは **No**（§4-4） |
| A13 | **SSO の具体プラグインは npm 上で 2.x が無い**（`plugin-oidc`／`saml`／`cas` は 0.21.0-alpha.16 / AGPL-3.0 / 2024-04-28 で停止） | 3 パッケージの `dist-tags` と `time`。**2026-09-11 解決**：調査 C-4 —— **Auth: LDAP / SAML / OIDC / CAS は Professional+（商用プラグイン）**。npm に無いのはそのため（**ただし「npm に無い理由」自体は公式に記載がない**ので断定しない） |
| A15 | **NocoBase 自身が AI 機能を持つ**（`@nocobase/plugin-ai`） | **2026-09-11 追加**：調査 C-4 —— **AI employees / AI: MCP server は無料、AI: Knowledge base は Professional+**。判断（使わない）は変わらない（§4-3） |
| A16 | **2.x は作り替えの途中**（`plugin-mobile` → `ui-layout` が開発中） | **2026-09-11 補強**：調査 E-4 —— **2.2 の非推奨一覧は 18 件、3.0 で削除予定**。新規構築は 2.2 系の Modern page (v2) / `/v/` エントリで作るのが安全 |
| A17 | `plugin-charts`（AGPL-3.0）は deprecated → `plugin-data-visualization`（Apache-2.0）へ。`plugin-audit-logs` も deprecated | **2026-09-11 補強**：調査 C-4 —— **Audit logs は Enterprise+、Record history は Professional+**。→ §4-3 の「監査ログを NocoBase の機能に依存しない」が**裏付けられた** |
| A18 | `plugin-data-source-external-{mysql,postgres,…}` は **npm に存在しない**（404） | **2026-09-11 解決**：調査 C-4 —— **External data source: PostgreSQL は Standard+（商用プラグイン）** |

### 4-3. (A) と調査から導ける設計判断

| 判断 | 根拠 | 改訂 |
|---|---|---|
| **同一インスタンス内のマルチアプリでテナント分離しない** | A11（配布者が本番非推奨と明言）＋ 調査 C-4（deprecated、後継は Enterprise+） | **維持・補強** |
| **本番用とデモ用は別インスタンス（別プロセス・別 DB）** | A11 の帰結。移送手段は **Migration Manager** に決着 | **維持** |
| **自前のチャット UI を最初に作らない** | A9／調査 D-2（iframe ブロックは無料）。SSE を画面に出せるかは**依然不明**（U5） | **維持** |
| **NocoBase の AI 機能は使わない。AI の正本は Dify** | A15。67 サービスの資産（DSL・env・KB・テスト・台本・ユースケース文書）がすべて Dify 側にある。**加えて調査 D-1 —— AI employees の LLM サービスとして Dify を直接登録する記載は無く、Knowledge base は Professional+** | **維持・補強**（PM 判断 11-4 了承済み） |
| **監査ログ・変更履歴を NocoBase の機能に依存しない** | A17 ＋ 調査 C-4（**Audit logs は Enterprise+、Record history は Professional+**） | **維持・裏付け完了。** 業務 DB 側に `*_history` を Flyway で作る（§5-1） |
| **バージョンを 2.2.x に固定し、P0 の間は上げない** | A16 ＋ 調査 E-4（非推奨 18 件・3.0 で削除） | **維持。** 数値タグで固定（調査 E-4：本番は数値タグ推奨、**ダウングレード不可**） |
| ~~**外部 DB 接続は「あるはず」で設計しない**~~ | ~~A18~~ | **2026-09-11 決着**：External PostgreSQL は**存在する。Standard+**（調査 A-1／C-4）。§4-11 で採用 |
| **非推奨プラグインを最初から使わない**（新規） | 調査 E-4 の 18 件 | `plugin-mobile`・`plugin-multi-app-manager`・`plugin-backup-restore`・`plugin-charts`／`echarts` を使わない |

### 4-4. ★ 未確認事項の決着表（**判明 / 依然として不明 / 公式へ問い合わせが必要**）

**初版 §4-4 の U1〜U14 を 1 つずつ突き合わせた。** 出典は `docs/handoff/2026-09-11-nocobase-research.md` の該当節（列に記す）。

| # | 未確認だったこと | 判定 | 内容 | 出典（調査記録の節 / URL） |
|---|---|---|---|---|
| **U1** | ライセンス・価格・SSO の提供形態 | **✅ 判明** | Community 無料 / **Standard $800** / **Professional $8,000** / Enterprise 要問合せ。一括払い・**Lifetime**（更新とサポートは 1 年）。**SSO（OIDC・SAML・LDAP・CAS）は Professional+**。ライセンスは **Instance ID 単位**。**Standard は自社内部利用のみ／Professional 以降は顧客向けアプリ開発・販売可** | C-1・C-4・C-5 / `www.nocobase.com/en/commercial`・`docs.nocobase.com/plugins` |
| **U2** | 対応 DB の範囲 | **✅ 判明** | **PostgreSQL 10+**（Docker 例は 16）／MySQL 8.0.17+／MariaDB 10.9+。Node.js 22+、Yarn 1.22.x | E-1 / `docs.nocobase.com/get-started/system-requirements` |
| **U3** | **定義だけをデータを除いて移送できるか**（C1 の中核） | **✅ 判明** | **できる。Migration Manager（Professional+）。** テーブル単位に **Schema-only / Overwrite / Skip**。`collections`／`fields`／`uiSchemas`／`desktopRoutes`／`roles`／`dataSources`／`workflows` は **Overwrite 既定**、`users`／`environmentVariables`／`executions` は **Schema-only 既定**。公式フロー「Release Management」あり。CLI は `yarn nocobase migration generate --ruleId=<id>` / `migration run <file>.nbdata` | B-1・B-3 / `docs.nocobase.com/ops-management/migration-manager/`・`…/built-in-tables`・`…/release-management/` |
| **U4** | **移送ファイルが diff の読める形式か** | **⚠️ 依然として不明** | 出力は `.nbdata` ファイル。**中身の形式・テキスト差分の可否はドキュメントに記載なし** | 記載なし（B-1 に CLI の記述のみ） |
| **U5** | SSE（ストリーミング）を画面に出せるか | **⚠️ 依然として不明** | Custom request の Response type は **JSON または Stream（ファイルダウンロード）**。Workflow の HTTP request ノードは **status / headers / data の 3 変数**で受ける同期前提。**チャットのトークン逐次表示に使えるかは記載なし** | D-1 / `docs.nocobase.com/workflow/nodes/request`・`…/actions/types/custom-request` |
| **U6** | iframe の URL パラメータ・ログイン引き継ぎ | **△ 半分判明／半分不明** | **判明**：iframe ブロックは**無料**、URL 指定と HTML 直接記述の両対応、HTML モードは Liquid と変数に対応。**不明**：**URL モードで使える変数の列挙は記載なし**、**埋め込み先のログイン状態を引き継ぐ仕組みの記載なし**（変数一覧に API token はあるが iframe URL への付与手順は記載なし） | D-2 / `docs.nocobase.com/interface-builder/blocks/other-blocks/iframe` |
| **U7** | カスタムプラグインの開発言語・ビルド | **✅ 判明** | **TypeScript。** クライアント＝React + Ant Design + Formily、サーバ＝Koa、DB＝Sequelize。`yarn pm create` → `yarn build <pkg> --tar` → `storage/plugins` に展開。i18n は `src/locale/<lang>.json` | E-5 / `docs.nocobase.com/plugin-development/` |
| **U8** | 中国からの到達性・日本語 UI | **✅ ほぼ判明**（完成度の数値だけ不明） | 中国語 docs（`docs.nocobase.com/cn/`）・**Aliyun イメージミラー**（`registry.cn-shanghai.aliyuncs.com/nocobase/nocobase:latest-full`）・ICP 備案・人民元価格・Gitee ミラー。UI 対応言語に **ja-JP / zh-CN を含む**。**翻訳率・完成度の記載はなし** | E-6・E-7 / `docs.nocobase.com/cn/get-started/installation/docker`・`…/get-started/translations` |
| **U9** | **外部データソースとして DB に届くか** | **✅ 判明** | **届く。「Data source: External PostgreSQL」（Standard+）。** PostgreSQL **9.5+**。接続設定に **Schema**（例 `public`）・**Table prefix**・取り込む Collections の絞り込み。ブロックで扱うには **Record unique key**（主キーまたはユニーク列）が必要。ビューや複合キーは手動指定。**"NocoBase does not manage its backup, restore, migrations, or schema changes" と明記** | A-1・A-2 / `docs.nocobase.com/data-sources/data-source-external-postgres/` |
| **U10** | 2.x 系内の破壊的変更 | **✅ ほぼ判明** | 2.2 の**非推奨 18 件**（3.0 で削除予定）。リリーストラックは Latest / Beta / Alpha。**ダウングレード不可**、本番は数値タグ推奨。**1.x → 2.x 専用の移行ガイドは記載なし**（新規構築なので影響なし） | E-4 / `docs.nocobase.com/get-started/upgrading/docker`・`www.nocobase.com/en/blog/2.2.0` |
| **U11** | **接続の向き先だけを差し替えられるか** | **△ 半分判明／半分不明** | **判明**：`DB_DIALECT`／`DB_HOST`／`DB_PORT`／`DB_DATABASE`／`DB_USER`／`DB_PASSWORD` は環境変数。**これらは Migration Manager の一致チェック対象に含まれない**＝環境ごとに変えてよい。外部データソースの接続情報は **Variables and Secrets（無料）** の対応プラグイン一覧に "Data Source: External PostgreSQL" と明記。`environmentVariables` は Schema-only 既定＝**値は運ばれない**。**不明**：**接続フォームでの参照構文（`{{$env.xxx}}` 等）は記載なし** | B-4 / `docs.nocobase.com/ops-management/variables-and-secrets/` |
| **U12** | GitHub Environment / deployment protection rules | **✅ 論点が消えた** | 本番は GitLab、デモの CI は **secret を 1 つも使わない**（§7-2）。**設計は依存していない** | — |
| **U13** | 本番運用の推奨構成 | **✅ 判明** | Docker 推奨。最小 1 core / 2 GB、推奨 2 core / 4 GB、Linux 推奨。`CLUSTER_MODE`（単一プロセスの多コア利用）。**複数ノードのクラスタは Enterprise+**（部門ポータル規模では不要）。バックアップは Backup Manager（無料・内部で `pg_dump`）。複数インスタンスは**ポートではなくホスト名で分離**（Cookie） | E-1・E-2 / `docs.nocobase.com/get-started/deployment/production`・`…/ops-management/backup-manager/` |
| **U14** | `plugin-backup-restore` で定義だけ運べるか | **✅ 判明＝No** | **運べない。** 当該プラグインは **v1.4 で非推奨**。後継 **Backup Manager（無料）はフルバックアップのみ**で、コレクション選択や「ユーザーデータをスキップ」の記載なし。復元は同一以上のバージョン・**同一の dialect / underscored / prefix / schema** が必要 | B-2 / `docs.nocobase.com/ops-management/backup-manager/` |

### 4-4b. 調査で**新しく生まれた不明**（U15〜U21）

**答えが出たことで、前は問いですらなかったものが見えた。** これらも「不明」として扱う。

| # | 不明なこと | なぜ設計に効くか | どう扱うか |
|---|---|---|---|
| **U15** | **外部データソースのコレクションを Data visualization のチャートに使えるか**（Data source 選択 UI がある旨の記載のみで明示なし） | **KPI・Dashboard 画面の前提**。方式 (b) を採ると業務テーブルは全部外部になる | **R-4（P0 で実機確認）**。落ちたら **代替 D**（§4-6） |
| **U16** | **外部データソースのレコードで、ロール権限のデータスコープ "Own records"（＝作成者ベース）が機能するか** | 「PM は自分の担当案件だけ」を Own records で書くと、外部テーブルに `createdBy` が無いので効かない可能性 | **代替 E で最初から回避**（§4-6）。R-5 で確認 |
| **U17** | **Auth: LDAP が LDAPS / TLS / 証明書に対応するか**（公式ページに「ldaps」「TLS」「SSL」「certificate」「Active Directory」「memberOf」の語が**1 つも無い**） | **本番の認証の根幹。** 平文 LDAP は社内標準として通らない可能性が高い | **公式へ問い合わせ Q1**（§4-10）。**答えが否だと本番の認証設計が作り直し** |
| **U18** | **AD セキュリティグループ → NocoBase ロールの直接マッピング**（記載なし。SAML ページには "user organization and role mapping are not supported" と明記、OIDC のマッピング対象は nickname / email / phone のみ） | PM 構成案の 5 ロールを AD 側で**どう表現しているか**で設計が変わる。**書かれている唯一の経路は OU → 部署 → 部署ロール** | **PM 判断 11-11**（AD 側の実情を確認）＋ C3（ロール名を揃える） |
| **U19** | **Migration Manager の出力 `.nbdata` の中身**（U4 の具体形） | reviewer の diff 監査が成立するか | **AC-9**（読めなければ `dump-schema.mjs` の写しを diff の対象にする） |
| **U20** | **Custom request アクションがサーバ側で実行されるか**（＝ API キーがブラウザに出ないか。記載なし） | **Dify の API キーが漏れるかどうか。** 漏れたら `CLAUDE.md` §2-10 違反 | **既定を「Workflow の HTTP request ノード」にすることで回避**（Workflow はサーバで動く）。§14-5 |
| **U21** | **中国拠点から `github.com` に到達できるか**（NocoBase とは無関係。社内ネットワークの問題） | 本番が GitLab に移っても、**カタログ・管理番号・架空世界・設計書の正本は現リポ（GitHub）に残る**。到達できないと**参照できない** | **PM 判断 11-10**。落ちたら「正本は dify、GitLab に片方向ミラー」を足す（§7-7-5） |

### 4-4c. 公式ページ間の不一致（**調査が指摘している。設計で前提にする前に確かめる**）

調査 C-4 は、**商用比較表（`www.nocobase.com/en/commercial`）と プラグイン別のエディションバッジ（`docs.nocobase.com/plugins`）の間に複数の不一致がある**と明記している。調査レポートは **docs/plugins のバッジを優先**しており、本書もそれに従う。

| 機能 | docs/plugins のバッジ | 商用比較表 | 本書の扱い |
|---|---|---|---|
| **Migration manager** | **Professional+** | **全エディション ✓** | **Professional+ として設計する（安全側）。** ただし **Q3 で確認**。**もし比較表が正なら、デモを Community で動かせる余地が生まれる**（§4-11 の判断が変わる） |
| **AI: Knowledge base** | Professional+ | 全 ✓ | 使わないので影響なし |
| **Password policy / 2FA(TOTP)** | Professional+ / Enterprise+ | 全 ✓ | 本番の論点。デモには影響なし |

**安全側（厳しい方）を前提に設計する**のが本書の立場。**緩い方が正だった場合は費用が下がるだけで、設計は壊れない。** 逆にすると壊れる。

### 4-5. 中心の問い（初版 §4-5）—— **決着**

初版の問い：「**同じ schema・同じ画面を 2 つのデータセットで動かせるか**」。候補 4 案の判定は次のとおり**決着した**。

| 案 | 中身 | 初版の判定 | **2026-09-11 の決着** |
|---|---|---|---|
| **案 A** 同一インスタンス内のマルチアプリ | 1 プロセスに本番アプリとデモアプリを同居 | 採らない | **採らない（維持）。** `plugin-multi-app-manager` は deprecated、後継 App supervisor は Enterprise+（調査 C-4）。理由がむしろ増えた |
| **案 B** 同一インスタンス内で collection を分ける | `projects_prod` / `projects_demo` を ACL で出し分け | 採らない | **採らない（維持）。** 画面が 2 セットになり「同じ画面」でなくなる／実データと架空データが同じ DB に同居する |
| **案 C** **別インスタンス 2 台 ＋ 定義の移送** | 別プロセス・別 DB で立て、**定義だけ**を移送 | 土台にする（**ただし U3 が未確認**） | **✅ 採る。U3 は決着：Migration Manager（Professional+）が公式手段。** 公式フロー「Release Management」が Development → Staging → Production をこの形で書いている |
| **案 D** **接続の向き先を差し替える** | 定義は 1 つ。業務データは外部データソースで、環境ごとに向き先を変える | 案 C の中で併用（**U9・U11 が未確認**） | **✅ 採る。U9 は決着**（External PostgreSQL・Standard+）。**U11 は半分**（`DB_*` は環境変数で可。外部データソースの接続情報は Variables and Secrets 対応だが**参照構文が不明**）→ **代替 C'（データソース名を `biz` に固定）で吸収**（§4-6） |

**採る形（案 C ＋ 案 D）**：

```
            ┌────────────── 定義（画面・コレクション・ロール・WF）──────────────┐
            │  Migration Manager の移送ファイル `.nbdata`                        │
            │  ＋ `scripts/dump-schema.mjs` の人が読める写し                      │
            │  → 新リポ `shoulang0729/portal` にコミット（C1-c）                 │
            └───────────┬──────────────────────────────┬────────────────────┘
                        │ migration run                  │ migration run
            ┌───────────▼───────────┐        ┌───────────▼───────────┐
            │ demo インスタンス      │        │ 本番インスタンス       │  ← 到達点。作らない
            │ （定義の正本）         │ ─────▶ │                       │
            │ NocoBase Master DB:   │        │ NocoBase Master DB:   │
            │  nb_* システムのみ     │        │  nb_* システムのみ     │
            │ 外部データソース `biz`:│        │ 外部データソース `biz`:│
            │  架空世界 PostgreSQL   │        │  実データ PostgreSQL   │
            │  （Flyway で DDL）     │        │  （**同じ** Flyway）   │
            │ AI: Dify Cloud        │        │ AI: Dify Enterprise   │
            └───────────────────────┘        └───────────────────────┘
               顧客提示（架空データのみ）          社内限定・非公開
```

**この形が成立する条件は C1-b ＋ C2 ＋ C3（§3）。** 実データが NocoBase の Master DB に入らなければ、環境の差は「`biz` の接続先」と「`.env`」と「ユーザーの供給元」だけになる。

### 4-6. 逃げ道（初版 §4-6 の代替 B / C の決着と、新しい代替 D / E）

**初版の目的は「できる前提で作って後から違った」を避けること。その目的は変えない。**

| 逃げ道 | 初版の位置づけ | **2026-09-11 の扱い** |
|---|---|---|
| **代替 B**（定義を HTTP API のスクリプトで手続き的に持つ） | U3 が否だったときの本命 | **✅ 決着＝不要。** Migration Manager が公式手段（U3 判明）。**ただし `scripts/dump-schema.mjs`（定義を JSON に吐く読み取り専用の写し）としては生かす**（U4/U19 が不明なので、**diff 監査の受け皿**が要る）。**書き戻しには使わない** |
| **代替 C**（データソース名を `hr` に固定） | U11 が否だったときの無料の保険 | **✅ 生きている。名前を `hr` → `biz` に変更**（ドメインが案件系になったため）。**P0 初日から `biz` に固定し、接続文字列だけを環境で変える。** U11 の残り半分（参照構文が不明）をこれで吸収する |
| **代替 D**（新規） | — | **U15（チャートが外部データソースを引けない）が否だったとき。** ① 業務 DB 側に**集計ビュー**を作り、外部データソースの Database view collection（無料）として読む → それでも駄目なら ② **NocoBase の Master DB に `kpi_snapshots`（集計値だけ）を持ち、Workflow で日次に書き写す**。**集計値には個人情報も明細も入らない**ので C1-b の精神は保たれる |
| **代替 E**（新規） | — | **U16（Own records が外部テーブルで効かない）を最初から回避。** **ロール権限の「Own records」に依存せず、ブロックのデータスコープで「担当者フィールド = Current user」と書く**（調査 C-3 に記載あり）。**P0 初日から。追加コストはゼロ** |
| **PC-04 アダプタ経由** | U9 が否だったときの代替 | **今回のスコープでは不要**（業務 DB は我々が作るので届かない理由が無い）。**経営管理システムとの連携（P2 以降）では引き続き有効** |

**代替 C'（`biz` 固定）と代替 E（担当者 = Current user）は、いま無料で入る保険なので、不明のままでも先に効かせる。**

### 4-7. 確かめる手順（改訂。**PM が手を動かす分は「問い合わせ」だけ**）

| # | 確かめること | 誰が | どうやって | いつ | 落ちたら |
|---|---|---|---|---|---|
| ~~V-PM-1~~ | ~~公式ドキュメントを 30 分読む~~ | ~~PM~~ | **✅ 実施済み（2026-09-11）。成果物＝`docs/handoff/2026-09-11-nocobase-research.md`** | — | — |
| **V-PM-2** | **Q1〜Q7 を販売元に問い合わせる**（§4-10） | **PM** | 購入検討の連絡と同時に | **Professional 購入の前**（11-9） | §4-10 の表 |
| **V-PM-3** | **U18** AD 側が 5 区分を **OU** で表現しているか、**セキュリティグループ**か | **PM ＋ 情シス** | 既存の AD を見てもらう | P1 着手前 | セキュリティグループなら、ロール付与を手動か Workflow / API で補う設計になる（§3-6） |
| **V-PM-4** | **U21** 中国拠点から `github.com` に到達できるか | **PM ＋ 情シス** | 現地から開いてもらう | P1 着手前 | GitLab に片方向ミラーを足す（§7-7-5） |
| **R-1** | **U3** Migration Manager でデモ 1 号機 → 2 号機に定義だけを移送できる（**AC-1**） | implementer | P0 の中で実機 | P0 | **Professional の購入判断に戻る。PM に報告して段取りを組み直す**（これが P0 の主目的） |
| **R-2** | **U4/U19** `.nbdata` の diff が読めるか（**AC-9**） | implementer | 2 回生成して `git diff` | P0 | `dump-schema.mjs` の写しを diff 監査の対象にする |
| **R-3** | **U9** 外部データソース `biz` が繋がり、Flyway で作ったテーブルがブロックに出る（**AC-2**） | implementer | P0 の中で実機 | P0 | 方式 (a) に落ちる（§4-11-3。C2 を守っていれば取り返しが効く） |
| **R-4** | **U15** チャートが外部データソースを引けるか（**AC-4**） | implementer | KPI 1 枚を作る | P0 | **代替 D** |
| **R-5** | **U16** 「担当者 = Current user」のデータスコープが外部テーブルで効くか（**AC-5**） | implementer | PM ロールで確認 | P0 | データを絞るビューを業務 DB 側に作る |
| **R-6** | **U6** iframe で Dify Cloud の KN-01 が開き、ja/zh 両方で返る（**AC-6**） | implementer | 実機 12 本のうち KN-01 | P0 | (a′) だけで組む（iframe をやめる） |
| **R-7** | **U20** Dify の API キーがブラウザに出ないこと（**AC-6**） | implementer | DevTools の Network を見る | P0 | 既定を Workflow の HTTP request に寄せる（最初からそうする） |
| **R-8** | **U11** 外部データソースの接続情報を Variables and Secrets から参照できるか | implementer | 接続フォームで試す | P0 | **代替 C'**（`biz` 固定＋接続文字列を環境ごとに手で入れる） |
| **R-9** | **U5** SSE を画面に出せるか | implementer | P3 の着手判断のときに小さく試す | P3 着手前 | チャットだけ別 SPA を iframe（§10-4） |

**記録先**：新リポの `docs/handoff/` に確認結果を 1 ファイル（`dify/results/` が「機械だけが書く実機の事実」であるのと同じ考え方で、**確認結果と設計値を混ぜない**）。

### 4-8. 不明が設計の前提になっているところの一覧（短く）

| 前提になっている不明 | どこで | 保険 |
|---|---|---|
| **U4/U19**（移送ファイルの diff） | §3-4 C1-c・AC-9 | `dump-schema.mjs` の写し |
| **U6**（iframe の変数・ログイン引き継ぎ） | §14-5 (b) | **公開 Web アプリ（ログイン不要）にだけ使う。** 断定しない |
| **U11**（接続情報の変数参照） | §4-5 案 D | 代替 C'（`biz` 固定） |
| **U15**（チャート × 外部データソース） | §5-3 KPI 画面 | 代替 D |
| **U16**（Own records × 外部テーブル） | §5-8 権限 | 代替 E（**最初から回避**） |
| **U17**（LDAPS） | **本番のみ。**§0-2 認証 | **Q1。答えが否だと本番の認証設計が作り直し** |
| **U18**（AD グループ → ロール） | **本番のみ。**§3-6 C3 | V-PM-3。OU なら記載どおり、グループなら補完設計 |
| **U20**（Custom request の実行場所） | §14-5 | **既定を Workflow に寄せて回避** |
| **U21**（中国 → GitHub） | §7-7-5 | V-PM-4。ミラーを足す |
| **4-4c の不一致**（Migration Manager のエディション） | §4-11 の判断そのもの | **Q3。安全側（Professional+）で設計してある** |

### 4-9. マスキング（実データを伏せて顧客に見せる）を採らない理由（**不変**）

1. **漏れを機械で確かめられない。** この組織の検証文化は「`tools/verify.mjs` が FAIL する」で担保している（`CLAUDE.md` §3）。マスキングの網羅性は同じ形で機械検証できない
2. **伏せても営業秘密が残る。** 氏名を伏せても「当社の実際の案件数・受注額・赤字案件の割合」は残る
3. **説明が事故る。** デモ中に「これは当社の実データを伏せたものです」と言う瞬間が発生しうる
4. **すでに資産がある。** `data/world/`（青嶺精工・碧洋銀行）は台本・KB・テスト・ユースケース 67 件と**語彙が揃っている**。**§14-3 の橋渡しが成立すれば、カタログ・Dify デモ・ポータルの 3 つで同じ世界が出る**。これは顧客提示として強い

**例外として認める範囲**：開発者が自分の画面を確認するために、社外に出さない環境で伏せ字表示を使うのは可。**顧客提示には使わない。**

### 4-10. ★ 公式へ問い合わせる件（このリポジトリの追跡対象）

調査レポートが「公式へ直接問い合わせ推奨」とした **5 件（Q1〜Q5）** に、本書で新たに **2 件（Q6・Q7）** を足した。

| # | 問い合わせること | 誰が | いつ | **答えが否だったら設計がどう変わるか** |
|---|---|---|---|---|
| **Q1** | **Auth: LDAP の LDAPS / TLS / 証明書対応**（公式ページに語が無い。U17） | **PM**（販売元へ。購入検討の連絡と同時） | **Professional 購入の前** | **⚠️ 最大。本番の認証設計が作り直し。** 平文 LDAP しか無いなら、① NocoBase を AD に直接繋がず、**GitLab（AD → LDAP）を OIDC の IdP にして NocoBase を OIDC で繋ぐ**（PM 構成案が Outline で使っている経路をそのまま流用。**OIDC も Professional+ なのでライセンスは変わらない**）② または stunnel 等で TLS を終端する。**①を第 1 代替にする** |
| **Q2** | **1 ライセンスでカバーできるインスタンス数**（デモ＋本番。Instance ID 単位と明記） | **PM** | 購入時 | **費用のみ。** 2 本要るなら **$8,000 × 2**。設計は変わらない。→ PM 判断 11-9 |
| **Q3** | **商用比較表と docs/plugins の不一致**（**Migration Manager** のエディション。§4-4c） | **PM** | **購入の前** | **緩い方（全エディション ✓）が正なら**：デモを Community で動かせる余地が出る（費用が下がる）。**厳しい方（Professional+）が正なら**：本書のまま。**本書は厳しい方で設計してあるので、どちらでも壊れない** |
| **Q4** | **方式 (a) で取り込んだ既存テーブルに NocoBase が列を追加することがあるか** | PM または implementer | **方式 (a) に落ちるときだけ** | **方式 (b) を採るので影響は小さい。** (b) では「列を作らない」と明記されている |
| **Q5** | **UI からリレーションを作ると DB レベルの FK 制約が作られるか** | 同上 | 同上 | **影響は小さい。** (b) では「実 FK 列を作らない（メタデータのみ）」と明記。**FK は Flyway の SQL で我々が張る** |
| **Q6**（新規） | **外部データソースのコレクションを Data visualization のチャートに使えるか**（U15） | implementer（R-4 で実機確認できるので、問い合わせは補助） | P0 | **代替 D**（§4-6）。KPI 画面の作り方が変わるだけで、他は壊れない |
| **Q7**（新規） | **外部データソースの接続情報を Variables and Secrets で参照する構文**（U11） | 同上（R-8） | P0 | **代替 C'**（`biz` 固定）。運用が少し手で増えるだけ |

**追跡の仕方**：本節の表を**このリポジトリの Issue #242 のコメントで更新する**（設計書は黙って書き換えない。`CLAUDE.md` §4 の architect の禁止事項）。答えが返ったら**新しい日付の設計書として追記する**。

### 4-11. ★ エディションと方式 (a)/(b) —— **一体で決める**

PM は「**(B) 先に PostgreSQL で設計 → NocoBase に認識させる**」を選んだ。その実現方式は 2 つあり（調査 §6）、**どちらを採れるかがエディションで決まる**ので、**切り離して決められない**。

#### 4-11-1. 組み合わせは 4 つしかない

| # | デモのエディション | 方式 | 定義の移送 | 費用 | 判定 |
|---|---|---|---|---|---|
| **①** | Community（無料） | **(a) のみ**（(b) は Standard+） | **不可**（Migration Manager は Professional+）→ **自前実装** | 0 | **採らない** |
| **②** | Standard（$800） | (a) / **(b) 可** | **不可**（両端に Professional が要る）→ **自前実装** | $800 | **採らない** |
| **③** | **Professional（$8,000）** | (a) / **(b) 可** | **可（Migration Manager）** | $8,000 ×（1 か 2。Q2） | **✅ 採る** |
| ④ | Enterprise | 全部 | 可 | 要問合せ | 過剰（クラスタ・Audit logs は不要） |

#### 4-11-2. 決定 —— **デモも本番も Professional ／ 方式は (b)**

**理由は 4 つ。3 番目が決定的。**

1. **P0 の主目的そのものが Migration Manager を回すこと。** 本書の眼目は「**デモで作ったものが本番にそのまま移せること**」（§0-3）。デモを Community で作ると、**移送手段の自前実装という最大の工数を後で丸ごと背負う**うえ、それは NocoBase の保証外になる。**「移せるか」を確かめるために「移す公式手段」を持たないのは本末転倒**
2. **本番でどのみち Professional を買う。** Auth: LDAP（AD 連携）が Professional+。**デモを Professional にして増えるのは、ライセンス 1 本分かどうか（Q2 で確認）だけ**
3. **★ Standard は「自社内部利用のみ」。Professional 以降が「顧客向けアプリ開発・販売可」**（調査 C-5）。**我々の用途は顧客提示デモ**であり、**Standard では利用条件を外れる可能性がある**。無料版も同様に不安が残る。**顧客に見せる以上、Professional を持つのが筋**
4. **方式 (b) が PM の原則にまっすぐ乗る。** 「NocoBase は外部 DB を一切変更しない」が**公式に明記**（調査 A-2）＝ 原則 5（PostgreSQL が正本）と原則 11（将来 NocoBase から移行可能）が**推測でなく仕様で担保される**。DDL を Flyway で Git 管理するので原則 8（GitLab CI/CD）とも整合する

**Migration Manager が業務テーブルを運ばないこと（(b) の弱点とされたもの）は、本書では欠点ではなく「分業の線」として扱う**：

| 運ぶもの | 手段 | Git 上の形 |
|---|---|---|
| 画面・コレクション定義・ロール・ルート・ワークフロー・データソース登録 | **Migration Manager** | `export/*.nbdata` ＋ `export/schema-dump.json`（人が読む写し） |
| 業務テーブルの DDL | **Flyway**（`migrations/V<n>__*.sql`） | **プレーンな SQL。誰でも読める。NocoBase をやめても残る** |

**この線があるおかげで、「NocoBase 固有の部分」と「素の PostgreSQL の部分」が Git 上で目で分かれる。** これは原則 11 の実装そのもの。

#### 4-11-3. 方式 (a) を採らなかった理由（**消さずに残す**）

方式 (a)（メイン DB 内の既存テーブルを Load from database で取り込む）は **無料**で、その点だけは (b) に優る。採らない理由は 4 つ：

1. **「取り込んだテーブルに NocoBase が後から列を足すか」がドキュメントに記載なし**（調査 A-2）。**原則 5・原則 11 の根拠が「記載なし」の上に乗る**。(b) は「変更しない」と明記されている
2. **初回に決めて以後変更できない設定が多い**（`DB_UNDERSCORED`・`DB_TABLE_PREFIX`・主キー型）。**間違えたときの取り返しが DB 作り直し**
3. **システムテーブルと業務テーブルが同じ DB に同居する。** Backup Manager のフルバックアップが両方を巻き込み、「定義だけ」「データだけ」の切り分けが運用で難しくなる
4. **リレーションの FK 制約が実際に作られるかも記載なし**（調査 A-4）。業務データの整合性を NocoBase の挙動に委ねることになる

**ただし (a) は「(b) が駄目だったときの戻り先」として残す。** そのために **C2（§3-5）を初日から守る**：`DB_UNDERSCORED=true`・`DB_TABLE_PREFIX=nb_`・主キーは明示。**これを守っていれば、(b) → (a) の戻りは「業務テーブルを NocoBase の DB へ移して取り込み直す」だけで済む。** 守らずに始めると DB の作り直しになる。

#### 4-11-4. 費用と PM 判断

- **Professional $8,000（中国語サイトでは ¥50,000）。一括払い・Lifetime。アップグレードとサポートは購入後 1 年**
- **デモ＋本番で 2 本要るかは Q2 で要問合せ**（Instance ID 単位）。P0 では **demo 1 号機 ＋ demo 2 号機**の 2 台が要る（移送の実証）ので、**最悪 2 本**
- **→ PM 判断 11-9。これが P0 のブロッカー**
- **購入待ちの間にできること**：業務 DB の Flyway SQL を書く／`data/world/dept/` の架空データを作る／docker-compose を書く。**Community で「画面の作り方の素振り」をするのは可**。ただし **P0 の AC-1（Migration Manager）は Professional が無いと満たせない**

---

## 5. 業務ドメイン —— 顧客・案件・Action（**2026-09-11 全面差し替え**）

> **初版の §5 は「勤怠・研修・年休・お知らせは PC-01 `feed_items` に乗るか」だった。** ドメインが人事系から案件系に変わったため差し替える。**初版の判定表は §15 附録 A-2 に全文残してある。判断そのものは取り下げていない**（勤怠・研修・年休の置き場を決める日が来たら、あの表がそのまま使える）。

### 5-1. テーブル一覧（業務 DB `biz`。DDL は Flyway で Git 管理）

**P0** = §8 で作る。**P2 / P3** = 見通しだけ。**NocoBase の Master DB には 1 つも置かない**（C1-b）。

| テーブル | 段 | 主な列（抜粋） | 備考 |
|---|---|---|---|
| **`staff`** | **P0** | `staff_id` / `login_key` / `name_ja` `name_zh` `name_en` / `dept_id` / `role_band`（`management`/`sales`/`delivery`/`pm`/`general`）/ `site_id` / `active` | **NocoBase の `users` とは別。** `users` は認証主体（デモ＝ローカル、本番＝AD 同期）で**環境ごとに中身が違う**（Migration Manager で Schema-only）。**案件の「担当者」は業務データなので `biz` 側に正本を置く**（原則 11）。突き合わせは `staff.login_key` ↔ `users` のログイン名 |
| **`departments`** | **P0** | `dept_id` / `name_ja` `name_zh` `name_en` / `parent_id` | 選択肢をここから引く（C1-a）。**NocoBase の `plugin-departments`（無料）は本番の AD 同期で使う**が、業務データとしての部署は `biz` 側 |
| **`customers`** | **P0** | `customer_id` / `code` / `name_ja` `name_zh` `name_en` / `industry` / `owner_staff_id` / `status` | **実在企業名を書かない（§5-8）** |
| **`projects`** | **P0** | `project_id` / `code` / `customer_id` / `title_ja` `title_zh` `title_en` / `owner_staff_id` / `status`（`lead`/`proposal`/`won`/`delivery`/`closed`/`lost`）/ `health`（`green`/`yellow`/`red`）/ `revenue_plan` `revenue_actual` / `start_on` `due_on` / `ai_summary` `ai_summary_at` | `health` が PM 構成案の **Red / Yellow / Green**。`ai_summary` は §14-5 (c) の書き戻し先 |
| **`actions`** | **P0** | `action_id` / `project_id?` / `customer_id?` / `owner_staff_id` / `title` / `kind`（`due`/`routine`/`notify`）/ `status`（`open`/`done`/`dismissed`）/ `priority` / `due_at` / `source`（`human`/`ai`/`system`）/ `source_ref`（冪等キー）/ `created_at` `updated_at` | **PC-01 `feed_items` の意味をそのまま引き継ぐ**（§5-4） |
| **`document_links`** | **P0** | `link_id` / `target_kind`（`project`/`customer`/`meeting`）/ `target_id` / `provider`（`outline`）/ `ext_ref`（Outline の doc id または slug）/ `title` / `updated_at` | **実 URL を持たない**（§5-7） |
| **`ai_services`** | **P0** | §14-7 に定義 | カタログ 67 件の写し ＋ ポータル側のメタ |
| **`*_history`** | **P0（薄く）** | `projects_history` / `actions_history`（`*_id` / `changed_at` / `changed_by` / `before` `after`(jsonb)） | **NocoBase の Record history（Professional+）・Audit logs（Enterprise+）に依存しない**（§4-3）。トリガまたはアプリ側で書く |
| `meetings` | P2 | `meeting_id` / `project_id?` / `held_on` / `title` / `attendees` / `minutes_ref`（→ `document_links`） | 議事録本文は **Outline** 側 |
| `opportunities` | P2 | `opportunity_id` / `customer_id` / `stage` / `amount` / `probability` / `close_on` | `projects` の前段（Pipeline） |
| `kpis` | P2 | `kpi_id` / `period` / `dept_id?` / `metric` / `plan` `actual` | Budget vs Actual・Pipeline・Overdue の集計元 |
| `resources` | P3 | `staff_id` / `period` / `assigned_project_id` / `allocation_pct` / `skill_tags` | People・Resource の稼働状況。**勤怠・研修・年休はここに合流する**（§5-6） |
| `announcements` / `announcement_reads` | P2 | 初版 §5-3 の定義のまま | §5-5 |

### 5-2. 画面 → テーブル対応表

| 画面（PM 構成案） | 主に読むテーブル | 書くか | 備考 |
|---|---|---|---|
| **Home** | `projects`（`health`・`due_on`）／`actions`（期限超過）／`kpis`（P2）／`ai_services` | いいえ | **Management Alert は「`health=red` かつ `due_on` が近い案件」で表現する。** 専用テーブルを作らない |
| **Customers** | `customers` ／ `projects`（顧客別）／ `kpis`（顧客別売上・P2）／ `document_links` | はい（CRUD） | 「関連 Outline Knowledge」＝ `document_links` |
| **Projects** | `projects` ／ `customers` ／ `staff` ／ `actions`（Next Action）／ `document_links` | はい | PM 構成案の列（Owner / Status / Revenue / Due Date / Risk / Next Action）がそのまま列に対応 |
| **Actions** | `actions` ／ `projects` ／ `staff` | はい | TODO / Owner / Due Date / Status / Priority / Project |
| **People・Resource** | `staff` ／ `departments` ／ `resources`（P3）／ `projects`（担当案件） | P3 | **所属・Role・担当案件は P0 でも出せる。稼働状況・Skill は P3** |
| **KPI・Dashboard** | `kpis` ／ `projects` ／ `actions` | いいえ | `plugin-data-visualization`（無料）。**外部データソースを引けるかは U15** → 代替 D |
| **会議** | `meetings` ／ `document_links` | P2 | 議事録本文は Outline |
| **知識** | `document_links`（一覧）／ Outline へのリンク | いいえ | **NocoBase 側に文書本文を持たない** |
| **AI** | `ai_services` | いいえ | §14。**ただし AI はこの 1 画面に閉じない** |

### 5-3. Home の構成（P0 で作る 1 画面目の見取り図）

```
┌──────────────────────────────────────────────────────────────┐
│  Home                                     [ja|zh|en]  [user] │
├──────────────────────────────────────────────────────────────┤
│  ┌─ 要対応（私） ─────────┐ ┌─ 注意が必要な案件 ────────┐ │
│  │ actions: owner=me       │ │ projects: health in         │ │
│  │   status=open           │ │   (red,yellow)              │ │
│  │   order by due_at       │ │   order by due_on           │ │
│  │ [期限超過を整理する]▶AI │ │ [今週の状況を要約]▶AI       │ │
│  └─────────────────────────┘ └─────────────────────────────┘ │
│  ┌─ KPI（P2。P0 は空き地）─┐ ┌─ AI サービス（上位 6 件）──┐ │
│  │ Budget vs Actual        │ │ ai_services: pinned=true    │ │
│  │ Pipeline / Overdue      │ │ Grid Card（行を足せば増える）│ │
│  └─────────────────────────┘ └─────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
   ▶AI ＝ §14-5 の (a′)：ボタン → Workflow（同期）→ HTTP request → 結果を画面へ
```

### 5-4. `actions` と PC-01 `feed_items` —— **器は 1 つにする**

**判断：ポータルでは `actions` が PC-01 `feed_items` の役割を担う。2 つの To-Do の器を並べない。**

| 観点 | 理由 |
|---|---|
| **正本が 1 つでなくなる** | PC-01 は「Dify のサービスが起票する小さな器（DB 1 テーブル ＋ REST 3 本）」。部門の TODO は**人が作る業務データ**で、正本は PostgreSQL（PM 原則 5）。両方を持つと「この Action はどっちに入るのか」を毎回考えることになる |
| **契約は捨てない** | `actions` は PC-01 の列の**意味をそのまま引き継ぐ**：`kind`（`due`/`routine`/`notify`）・`status`（`open`/`done`/`dismissed`）・`source`・**`source_ref`（冪等キー）**。PC-01 が「同じイベントで二重起票しない」ために設計した冪等キーは**そのまま要る**（AI が同じ案件に何度も Action を作らないように） |
| **PC-01 を実装するときどうなるか** | PC-01 の REST 3 本を建てる代わりに、**`actions` に書くアダプタ**を建てる。**PC-01 のテーブル定義そのものは変えない**（`docs/dify/platform-components.md` を書き換えない）。→ §9-2 の追記案 (1) |
| **`source` の値** | `human`（画面から人が作る）／`ai`（Dify が §14-5 (a′)(c) で作る）／`system`（期日・定例の自動生成） |

**⚠️ 歯止め**：**AI が作った Action は `source='ai'` で必ず区別し、画面上でも区別して見せる**（`docs/handoff/2026-09-10-expert-feedback.md` の「どこまで確認しているかを明示する」）。**人が作ったものと見分けがつかない形で AI に書かせない。**

### 5-5. `announcements`（会社からのお知らせ）—— **P2 へ後ろ倒し**

初版 §5-3 のスキーマ案（`title`/`body` の 3 言語・`category`・`audience`・`publish_from`/`publish_to`・`pinned` ＋ `announcement_reads`）は**そのまま有効**。ただし：

- **新しいドメイン（顧客・案件・Action）に含まれない。** PM 構成案の Home にあるのは「Management Alert」であり、これは **`projects.health` と `actions` で表現できる**（§5-2）
- **P0 に入れない。** P0 は「捨てられる規模」であることが条件（§8）
- **PC-19 の採番（PM 判断 11-2 で了承済み）も、`announcements` を実際に作る PR まで行わない。** `platform-components.md` は「ID と名称は固定」と宣言しているので、**使わない番号を先に切らない**

### 5-6. 勤怠・研修・年休 —— **今回のスコープ外。落としたのではない**

**PM が 2026-09-10 に要望として挙げたもの。黙って消さない。**

| | 扱い |
|---|---|
| **いま** | **スコープ外。** 新しいドメイン（顧客・案件・KPI・人員リソース）に直接含まれないため、P0〜P2 では作らない |
| **将来** | **P3 の `resources`（People・Resource の稼働状況）に統合する。** 稼働率・アサイン・スキルと、勤怠（残業）・年休（取得率）・研修（受講状況）は**同じ「人の状態」**であり、別画面にする理由がない |
| **設計は生きている** | 初版 §5-1〜§5-4 の判定（「**状態」は読み取りビュー、「あなたが何かをする必要がある」だけが器に乗る**）は**そのまま使える**。全文は **§15 附録 A-2** |
| **`feed_items` → `actions`** | 初版で「`feed_items` に乗る」と判定した 4 件（年休が基準に届かない／研修の受講期限／打刻漏れ／工数未提出）は、**`actions` に `source='system'` で乗る**。器が変わっただけで判定は変わらない |
| **`data/world/` の 4 CSV** | **PR-2 は取り下げ**（§15 附録 A-3）。P3 で `resources` を作るときに、案件系の架空データと**一緒に**設計し直す（バラバラに足すと世界が散らかる） |
| **PM 判断** | **11-12**（この扱いでよいかの確認。推奨＝この扱い） |

### 5-7. Outline との境界 —— `document_links` が接点

**NocoBase は業務データ（構造化）、Outline は文書・Knowledge。** 役割を分ける（PM 構成案）。

| | NocoBase（`biz`） | Outline |
|---|---|---|
| 持つもの | 顧客・案件・Action・KPI・人員・会議の**レコード** | 議事録・顧客情報・ノウハウ・方針制度・障害報告・提案資料の**文書** |
| 検索 | 列で絞る（フィルタ・データスコープ） | 全文検索 |
| 権限 | NocoBase RBAC ＋ データスコープ | Outline 側（GitLab OIDC 経由） |
| **持たないもの** | **文書の本文を持たない**（コピーしない） | **業務レコードを持たない** |

**接点は `document_links` 1 本。設計判断は 3 つ：**

1. **`document_links` は実 URL を持たない。** `provider`（`outline`）＋ `ext_ref`（Outline の doc id か slug）＋ `title` だけを持つ。**表示するとき `${PORTAL_OUTLINE_BASE}` と結合して URL を組み立てる**
   - **なぜ**：① 環境ごとに Outline のホストが違う（デモには Outline が無い）② **public リポジトリに社内 Outline の実 URL を書かない**（`CLAUDE.md` §2-10）③ `check-nodata.mjs` の **N6（実在ドメイン・生 IP）が FAIL する**
2. **デモでは `${PORTAL_OUTLINE_BASE}` が未設定。** そのとき **リンクを張らず「（デモ環境では未接続）」と表示する**（3 言語は §5-9）。**壊れたリンクを顧客に見せない**
3. **`document_links` に文書のタイトルを持つのは許す**（一覧に出すため）。ただし **`title` は架空世界の語だけ**（デモ）。本番では実タイトルが入るが、**それは本番の DB の中の話で、リポジトリには入らない**

**逆方向（Outline から NocoBase へのリンク）は作らない。** 片方向にする（正本を 2 つにしない、§6-1 と同じ精神）。

### 5-8. 権限 —— 認証 / アプリ権限 / データ権限の 3 層（PM 構成案のまま）

| 層 | デモ | 本番 | 定義は同じか |
|---|---|---|---|
| **認証**（誰であるか） | NocoBase ローカルユーザー | **AD**（Auth: LDAP。Professional+） | 供給元だけ違う |
| **アプリ権限**（どの画面・機能） | NocoBase RBAC（`plugin-acl`） | 同じ | **同じ。C3 でロール名を 5 つに固定** |
| **データ権限**（どのレコード） | ブロックのデータスコープ「**担当者 = Current user**」 | 同じ（＋必要なら PostgreSQL の RLS / View） | **同じ。代替 E で「Own records」に依存しない** |

**ロールごとの既定**（PM 構成案から。デモでも本番でも同じ定義）：

| ロール | `projects` | `customers` | `actions` | `kpis` |
|---|---|---|---|---|
| `management` | 全件 閲覧 | 全件 閲覧 | 全件 閲覧 | **全件 閲覧** |
| `sales` | `customers.owner_staff_id = me` の顧客の案件 | 自分の担当顧客 | 自分の Action | 自分の担当分 |
| `pm` | `projects.owner_staff_id = me` | 担当案件の顧客 | 自分の Action ＋ 担当案件の Action | 担当案件分 |
| `delivery` | 担当案件（アサインされているもの） | 閲覧のみ | 自分の Action | 無し |
| `general` | **公開フラグが立っている案件だけ** | 一覧のみ | 自分の Action | 無し |

**「上長は部下の分も」は P0 でやらない。** 調査 C-3 —— **ロール権限レベルで部署階層を参照する仕組みはドキュメントに記載なし**。ブロックのデータスコープで関連コレクション経由の条件は書けるが、「現在ユーザーの部署配下」を表す変数の記載がない。**P2 以降に、業務 DB 側のビュー（`v_staff_subordinates`）で解く**。

### 5-9. 表示文言（ja / zh / en。**implementer に翻訳させない**）

**Localization Management（無料）に入れる。3 言語同時**（現リポ `CLAUDE.md` §2-1 と同じ精神）。

**画面名・メニュー**

| キー | ja | zh | en |
|---|---|---|---|
| `nav.home` | ホーム | 首页 | Home |
| `nav.customers` | 顧客 | 客户 | Customers |
| `nav.projects` | 案件 | 项目 | Projects |
| `nav.actions` | アクション | 行动项 | Actions |
| `nav.people` | 人員・リソース | 人员与资源 | People & Resources |
| `nav.kpi` | KPI・ダッシュボード | KPI 与仪表盘 | KPI & Dashboard |
| `nav.meetings` | 会議 | 会议 | Meetings |
| `nav.knowledge` | 部門ナレッジ | 部门知识库 | Knowledge |
| `nav.ai` | AI サービス | AI 服务 | AI Services |

**ロール（C3 の 5 区分）**

| キー | ja | zh | en |
|---|---|---|---|
| `role.management` | マネジメント | 管理层 | Management |
| `role.sales` | 営業 | 销售 | Sales |
| `role.delivery` | デリバリー | 交付 | Delivery |
| `role.pm` | プロジェクトマネージャ | 项目经理 | Project Manager |
| `role.general` | 一般利用者 | 一般用户 | General User |

**案件の状態・健全性**

| キー | ja | zh | en |
|---|---|---|---|
| `project.status.lead` | 引合 | 线索 | Lead |
| `project.status.proposal` | 提案中 | 提案中 | Proposal |
| `project.status.won` | 受注 | 已中标 | Won |
| `project.status.delivery` | 進行中 | 进行中 | In Delivery |
| `project.status.closed` | 完了 | 已完成 | Closed |
| `project.status.lost` | 失注 | 未中标 | Lost |
| `project.health.green` | 順調 | 正常 | Green |
| `project.health.yellow` | 注意 | 注意 | Yellow |
| `project.health.red` | 要対応 | 需处理 | Red |

**Action**

| キー | ja | zh | en |
|---|---|---|---|
| `action.status.open` | 未完了 | 未完成 | Open |
| `action.status.done` | 完了 | 已完成 | Done |
| `action.status.dismissed` | 対応不要 | 无需处理 | Dismissed |
| `action.kind.due` | 期限あり | 有期限 | Due |
| `action.kind.routine` | 定例 | 例行 | Routine |
| `action.kind.notify` | お知らせ | 通知 | Notice |
| `action.source.ai` | AI が起票 | AI 生成 | Created by AI |
| `action.overdue` | 期限超過 | 已逾期 | Overdue |

**AI サービスの成熟度（カタログの `st` 1/2/3 をそのまま持つ。§14-6）**

| キー | ja | zh | en |
|---|---|---|---|
| `svc.st.1` | 提供中 | 提供中 | Available |
| `svc.st.2` | 試行版 | 试行版 | Pilot |
| `svc.st.3` | 構想 | 构想 | Concept |
| `svc.open` | 開く | 打开 | Open |
| `svc.notlive` | この環境では未接続 | 本环境未接入 | Not connected in this environment |
| `svc.catalogonly` | カタログのみ（実機なし） | 仅目录（无实机） | Catalog only (no running app) |

**AI ボタンと結果パネル**

| キー | ja | zh | en |
|---|---|---|---|
| `ai.summarize_project` | この案件の状況を要約 | 总结本项目的状况 | Summarize this project |
| `ai.draft_hq_report` | 本社向け報告の下書き | 起草总部报告 | Draft HQ report |
| `ai.organize_overdue` | 期限超過を担当者別に整理 | 按负责人整理逾期事项 | Organize overdue items by owner |
| `ai.draft_mail` | 顧客宛メールの下書き | 起草致客户邮件 | Draft customer email |
| `ai.running` | AI が処理しています… | AI 处理中… | Working… |
| `ai.error` | AI が応答しませんでした。時間をおいて試してください | AI 未响应，请稍后重试 | The AI did not respond. Please try again later. |
| `ai.truncated` | 応答が途中で終わりました | 响应中途结束 | The response ended prematurely. |
| `ai.disclaimer` | この結果は AI の下書きです。提出前に確認してください | 本结果为 AI 草稿，提交前请确认 | This is an AI draft. Please review before use. |

**Outline リンク**

| キー | ja | zh | en |
|---|---|---|---|
| `doc.open_outline` | ナレッジを開く | 打开知识库 | Open in Knowledge |
| `doc.not_connected` | （デモ環境では未接続） | （本演示环境未接入） | (Not connected in this demo) |

**`en` にかなを残さない・空にしない**（現リポ `CLAUDE.md` §2-1 の作法をそのまま持ち込む）。

### 5-10. **実在企業名を書かない**（PM 構成案からの持ち込み禁止）

PM 構成案の例文に **実在の金融機関名を含む「◯◯案件」**という表現が出てくる。**設計書・定義・デモデータのいずれにも写さない。**

- **理由**：`CLAUDE.md` §2-10。**新リポは public** で、顧客名は「我々がどこと取引しているか」そのもの。架空世界を使う体制（§2-13）を持っているのに実名を書けば、その体制が無意味になる
- **置き換え規則**：
  - デモデータ → **`data/world/` の架空企業**（青嶺精工 / 青岭精工 / Seirei Seiko Co., Ltd.、碧洋銀行）。§14-3 の橋渡しにより、**これがそのまま「我々の顧客」になる**
  - 設計書の例示 → **`<顧客A>` / `<顧客B>`**
  - 取引先の記号が要るとき → `data/world/mfg/partners.csv`（`K 社` 等）・`data/world/fin/clients.csv`（`甲社` 等）**の既存記号だけ**を使い、新しい記号を発明しない

---

## 6. 共有する資産の境界

### 6-1. 方向は片方向（現リポ → 新リポ）。逆流させない（**不変**）

1. **正本を 2 つにしない**（`CLAUDE.md` §2-13 の精神）。`data/world/` と 67 サービスのカタログは現リポが正本
2. **検査の非対称**。現リポは `verify.mjs`（3 言語一致・`SVCS` 整合・管理番号の重複なし）と `regress.mjs`（件数と id）と `check-world.mjs` が語彙を守っている。**新リポにはこれらの検査が無い**。検査の無い側から書き戻すと、検査で守っているものが静かに壊れる

**本番が GitLab に移っても変わらない**（§7-7-5）。

### 6-2. `data/world/`（デモ用データセットの正本）

> **2026-09-11 改訂**：~~勤怠・年休・研修・お知らせの 4 CSV × 2 業種を足す~~ → **取り下げ**（§5-6・§15 附録 A-3）。代わりに **§14-8 の `data/world/dept/`（部門の世界）** を足す。**正本は現リポのまま**という原則は変わらない。

### 6-3. 管理番号と 67 サービスのカタログ

- 正本：現リポ `mock/js/data/catalog.js` の `CATS`／`SVCS`／`TAGS`
- **第 1 段は手コピー**（67 行の JSON 1 ファイル → `ai_services` の seed）。更新頻度は月数回で、`tools/regress.mjs` が現リポ側で件数と id を守っている（`CLAUDE.md` §2-9）
- **`SVCS[].id` を改名しない**（§2-11）。新リポ側でも**管理番号（`KN-02` 形式）を共通語彙として使う**
- **痛くなったら**：現リポに `npm run export:catalog` → `docs/portal/catalog.json`（生成物・コミット）。**いまは作らない**

### 6-4. 管理番号 → Dify アプリ id ／ 公開 Web アプリ URL

ポータルが Dify を呼ぶために**必須**。正本は現リポ **`dify/env/<env>/env.yml` の `apps:`**（`apps.<番号>.id`）と **`mock/js/data/live.js` の `LIVE`**（公開 Web アプリ URL）。

- **⚠️ 2026-09-11 時点で両方とも空**：`dify/env/cloud-master/env.yml` の `apps:` は 12 件すべて `id: null`、`LIVE` は `{}`。**P0 のブロッカー**（§14-4b）
- 新リポは **管理番号 → アプリ id ／ WebApp URL ／ API キーの変数名** の表を持つ。**キー本体は書かず環境変数**（§10-1）
- **デモ＝`cloud-master`（Dify Cloud）／本番＝Dify Enterprise。差し替わるのは `${DIFY_BASE_URL}` と各キー・URL だけで、管理番号は不変**（§0-2）

### 6-5. env レイヤーの作法

**コードは共有しない。作法だけ真似る。** `scripts/dify/render.py` は Dify DSL 専用。真似るのは 3 つ：

1. **マスタ 1 本 ＋ 環境差分 1 枚**（§3 の C1）
2. **秘密は `${VAR}` で環境変数から渡し、リポジトリの外に置く**。`--strict` 相当で未定義なら失敗させ、黙って空文字にしない
3. **環境台帳を 1 枚持ち、env 定義と同じ PR で必ず一緒に更新する**（`dify/env/README.md` の表と同じ形）。**C2 の 5 行はここに書く**（§3-5）

### 6-6. 共有しないもの（明示）

`tools/verify.mjs`／`tools/regress.mjs`／`tools/check-world.mjs`／`tools/gen-index.mjs`／`scripts/dify/**`／`.github/workflows/dify-ops.yml`／`.github/workflows/pages.yml`／`mock/**`。**丸ごとコピーしない**（§7-3）。

### 6-7. 一覧

| 資産 | 正本 | 第 1 段 | 痛くなったら | 方向 |
|---|---|---|---|---|
| `data/world/`（架空世界。**`dept/` を新設**） | **現リポ** | 手コピー ＋ 出典行 | `npm run export:world` | → |
| 管理番号・67 サービス | **現リポ** `catalog.js` | 手コピー（JSON 1 本 → `ai_services`） | `npm run export:catalog` | → |
| 管理番号 → Dify アプリ id ／ WebApp URL | **現リポ** `dify/env/*/env.yml` ＋ `live.js` | 手コピー ＋ `${VAR}` | 同上に同梱 | → |
| env レイヤーの作法 | 現リポ `CLAUDE.md` §2-12 | **文書として書き直す** | — | →（文書のみ） |
| 3 エージェント分業・Git 運用 | 現リポ `CLAUDE.md` §1/§4/§5 | **抜粋を書き直す**（実装済み） | — | →（文書のみ） |
| 検証ツール・ワークフロー・モック | 現リポ | **共有しない** | — | — |
| ポータルの定義・業務 DDL・接続設定 | **新リポ／接続先** | — | — | **戻さない** |

---

## 7. 新リポを public で作るとき —— 何がそのまま使えて、何を新しく作るか

### 7-1. GitHub Pages —— **そもそも論点にならない**

**NocoBase は Koa の常駐サーバ ＋ DB（A2）なので、静的サイトホスティングである GitHub Pages に載らない**（A3）。public / private 以前の問題。

| | 置き場 |
|---|---|
| **顧客に見せる UI モック（現状）** | **現リポの public Pages のまま。`pages.yml` の `path: mock` は無傷**（`CLAUDE.md` §2-8） |
| **ポータルのデモ用インスタンス** | PM が用意するサーバ（または PM のローカルの docker。**P0 は 2 台**）。顧客提示は**画面共有**、または期間限定・認証つきの URL |
| **ポータルの本番インスタンス** | 中国拠点の社内。外部公開しない |

**将来 Pages を使うとしたら用途は 1 つだけ**：`dump-schema.mjs` の出力から生成した「**スキーマの説明ページ**」（テーブル・列・ロールの一覧、ER 図）。**P0 ではやらない。** やるときは §2-8 の作法を踏襲する（`path:` でルート指定／相対パスのみ／`.nojekyll`／`_` 始まりを作らない）。**ただし GitLab へ移った後は GitLab Pages になるので、いま仕組みを作り込まない**（§7-7）。

### 7-2. `dify-ops.yml` の仕組み —— **持ち込まない**（決着）

`.github/workflows/dify-ops.yml` は「Dify Cloud のコンソールにセッションで入って DSL を投入・公開する」ための仕掛け。ポータルは Dify を**呼ぶ側**であって投入しない。**`DIFY_CONSOLE_REFRESH` の書き戻しも `GH_SECRETS_PAT` も要らない。**

ポータルの CI に要るのは 4 つだけ：(1) lint、(2) **Flyway の migration が空の DB に通る（V4）**、(3) `check-nodata.mjs`（V1・V2）、(4) 定義の写しの鮮度（V3）。

> **2026-09-11 決着**：初版はここで **GitHub Environment ＋ Required reviewers**（U12）と **Actions の従量**を論じていた。**論点が消えた。** ① 本番デプロイは GitLab へ移る ② **デモの CI は secret を 1 つも使わない**設計のまま。**したがって承認ゲートの議論は GitLab 側で改めて行う**（いま前提を作らない）。初版の表は §15 附録 A-5。

### 7-3. `CLAUDE.md` ／ `verify.mjs` ／ `regress.mjs` をどこまで持ち込むか

**丸ごとコピーしない。**（**実施済み**。新リポの `CLAUDE.md` に反映済み）

| 現リポの節 | 新リポに持ち込むか |
|---|---|
| §1 レーン判定（S / M-L） | **持ち込む**（そのまま） |
| §2-1 多言語辞書 3 言語一致 | **読み替えて持ち込む**：`mock/` は無いが、**Localization Management の ja/zh/en を同時に入れる**という作法は持ち込む（§5-9） |
| §2-2〜2-4・2-6〜2-9（CSS トークン・共通レイヤー・`.mockbar`・`localStorage`・`st`・Pages・顧客版差し替え） | **持ち込まない**（`mock/` 前提）。**ただし `st`（1/2/3）だけは `ai_services.st` として持ち込む**（§14-6） |
| §2-5 応答言語の契約（入力言語で返す） | **持ち込む**（ポータルの UI 言語切替と Dify の応答言語は別、という説明が必要） |
| §2-10 シークレットを置かない | **持ち込む。public なので必須**（§7-6 が実装、§7-4 の N4/N5/N6・G1 が検査） |
| §2-11 管理番号 | **持ち込む**（Dify サービスを指すときの共通語彙。**デモ→本番でも不変**） |
| §2-12 env レイヤー | **作法だけ書き直す**（§6-5）＋ **C2 の 5 行**（§3-5） |
| §2-13 `data/world/` が正本 | **読み替えて持ち込む**：「**正本は現リポ。新リポは参照するだけ**」 |
| §3 検証コマンド | **書き直す**：`npm test` ＝ lint ＋ **V1／V2／V3／V4** |
| §4 3 エージェント分業 | **持ち込む**（そのまま） |
| §5 Git 運用 | **持ち込む**（そのまま）。**GitLab に移っても同じ**（`main` 直 commit 禁止・squash・1 Issue 1 ブランチ） |
| §6 バックログ | **持ち込まない** |
| §7 実行場所（`run:cloud`／`run:runner`／`run:mac`） | **持ち込まない。** 新リポで独自に定義する（軸が違う） |

### 7-4. 実データが入らないことを機械で見る —— `tools/check-nodata.mjs`（**実装済み・不変**）

**「実データを入れない」は運用のルールであり、機械で見なければ破られる。public リポジトリでこれが起きると取り返しがつかない**（履歴に残る）。**前提がいくつ変わっても、ここは変わらない。**

`tools/check-world.mjs` と**同じ allowlist 方式**（手書きの禁止語リストを作らない。allowlist は `seed/world/` から機械生成）。

**構造の検査（FAIL）**：**G1** トップレベルの allowlist ／ **G2** `*.sql`・`*.dump`・`*.bak`・`*.xlsx`・`*.db`・`*.sqlite` を置かない ／ **G3** `*.csv` は `seed/` の下だけ ／ **G4** `.env`（`.env.example` を除く）・`*.key`・`*.pem`・`secrets/` を置かない ／ **G5** `seed/` 以外に 1 MB 超を置かない

> **⚠️ 2026-09-11 の要調整**：**G2 が `*.sql` を禁止している**が、本改訂で **`migrations/V<n>__*.sql`（Flyway）を置く**ことになった。**G2 を「`migrations/**` の `.sql` だけは許す。ただし `INSERT` / `COPY` を含む `.sql` は FAIL」に変更する**（DDL は通し、データ投入は通さない）。**この変更は新リポ側の PR で行い、`tools/check-nodata.mjs` の冒頭コメントと `CLAUDE.md` §3 を同時に更新する**（設計書を先に改訂するのが作法）

**中身の検査**：**N1** 氏名らしき文字列（warn・baseline）／ **N2** 社員番号らしきパターン（warn）／ **N3** 部署名・拠点名（warn）／ **N4** メールアドレス（**FAIL**）／ **N5** 電話番号（**FAIL**）／ **N6** 実在ドメイン・生 IP（**FAIL**）

> **⚠️ 2026-09-11 の要調整**：**N6 の URL allowlist に社内 GitLab・社内 Outline のホストを足さない。** 足した時点で「社内システムのホスト名」が public リポジトリに載る。**そもそも書かない**（`${PORTAL_OUTLINE_BASE}`・GitLab はリポジトリ自身なので URL を書く必要が無い）。§5-7・§7-7-3

**誤検知を増やしすぎないための決め事**（不変）：FAIL は機械判定が確実な N4・N5・N6 と構造の G1〜G5 だけ／`--strict` で warn も FAIL／warn は baseline（件数 ＋ **中身のハッシュ**）で「増えたら FAIL・すり替わったら FAIL」／allowlist は手で書かない／除外リストは 1 行 1 語 ＋ 理由コメント必須・上限 50 語／**CI に入れる**。

### 7-5. 公開されるものの一覧（PM が 1 つずつ見るための表）

**「実データが入らない」＝「何も分からない」ではない。** public にする以上、次のものは読まれる。**2026-09-11 改訂でドメインが変わったので、具体例を差し替えた。判断が要る項目は増えていない。**

| # | 公開されるもの | 具体例（**改訂後**） | 何が読み取れるか | 隠せるか | PM の判断が要るか |
|---|---|---|---|---|---|
| **P-1** | **テーブル定義（列名・型）** | `projects.revenue_plan`・`projects.health`・`actions.priority` | **自部門が何を管理しているか** | **隠せない**（定義がリポジトリの本体） | — |
| **P-2** | **部署の階層とロールの体系** | `departments` の親子・ロール 5 区分 | 組織の形 | **体系は隠せない。値は架空にできる**（`data/world/dept/` に寄せる＝ C1-a） | — |
| **P-3** | **業務ルール（閾値・判定条件）** | 「`due_on` の n 日前に `health` を yellow にする」「赤字率が◯% を超えたら Alert」 | **自部門の運用方針・採算の基準** | **ルールの形は隠せない。閾値の数値は `${VAR}` に逃がせる** | **要判断** |
| **P-4** | **外部システムの名前と接続の形** | Outline・Dify・AD・GitLab の**製品名**、API のパス | 社内のシステム構成（攻撃面の情報にもなる） | **ホスト名は隠せる**（`${VAR}`）。**製品名は隠さない**（設計書で公言しているため。PM 構成案がすでに製品名で書かれている） | — |
| **P-5** | **画面の構成とロール** | 誰が何を見られるか（ロール × ブロック） | 権限設計 | 隠せない。**ただし顧客に見せたいものそのもの**（PM の狙い） | — |
| **P-6** | **ワークフローの分岐** | AI 呼び出しの条件・エスカレーション先の役職 | 決裁ライン | **役職名は `data/world/` の語に寄せる**（C1-a） | — |
| **P-7** | **デモデータ** | 架空の顧客・案件・Action（`data/world/` 由来） | **架空。むしろ見せたい** | — | — |
| **P-8** | **カレンダー・会計年度・締め日** | 会計年度・月次締め | 会計年度は公知。**締め日は運用情報** | **`${VAR}` か架空値に逃がせる** | **要判断** |
| **P-9** | **`.env.example` の変数名** | `PORTAL_DSN_BIZ`・`DIFY_API_KEY_KN01`・`PORTAL_OUTLINE_BASE` | **何と繋がっているか** | 隠せない（型として必要）。**値は入らない** | — |
| **P-10** | **文言・エラーメッセージ（ja/zh/en）** | §5-9 | 自社の言い回し | 問題なし | — |
| **P-11** | **管理番号と 67 サービスの一覧** | `KN-01`〜`EG-01` | **既に現リポの public Pages で公開済み** | — | — |
| **P-12** | **NocoBase のバージョン・プラグイン構成・エディション** | `2.2.x` ＋ **Professional** | 攻撃面／**使っている商用製品** | 隠せない（再現性に必要） | — |
| **P-13**（新規） | **業務テーブルの DDL（Flyway の SQL）** | `CREATE TABLE projects (...)` | **P-1 をより詳しく**（制約・インデックス・FK） | 隠せない（**これを公開するのが方式 (b) の利点でもある**） | — |

**PM の判断が要るのは P-3 と P-8 の 2 つだけ**（初版から変わらず）。

**architect の推奨**：**P-3 の閾値と P-8 の締め日は `${VAR}` にして、`.env.example` に変数名だけを置く。** そうすれば公開範囲から外れ、**PM は 1 つも判断しなくてよくなる**。実装コストは「定義に直値で書かない」だけでゼロに近い（C1-a を守れば自動的にそうなる）。

### 7-6. 秘密と「公開したくない値」の置き場

**判定：`dify/env` の型をそのまま持ち込める。** 持ち込むのは**型（ファイルの役割分担と規約）**であって `render.py` ではない。

| 現リポ | 新リポ | 同じか |
|---|---|---|
| `dify/apps/*.yml`（マスタ。公開してよい既定値だけ） | `export/**`（定義）＋ `migrations/**`（DDL） | **同じ** |
| `dify/env/<env>/env.yml` | `env/<env>/portal.yml`（データソース名・閾値のキー名・既定値） | **同じ** |
| `scripts/dify/env.example` | `.env.example` | **同じ** |
| 設定ファイルはリポジトリの外（`~/.config/dify/<env>.env`） | `~/.config/portal/<env>.env` | **同じ** |
| `render.py --strict` が未定義の `${VAR}` で exit 1 | `scripts/apply.sh --strict` | **同じ（必須）** |
| `dify/env/README.md` の表 ＋ 環境台帳 | `env/README.md`（**C2 の 5 行を含む**） | **同じ** |
| `tools/verify.mjs` §12 | **§7-4 の N4/N5/N6 ＋ G1〜G5** | **同じ役割** |

**`${VAR}` に入れるもの**

| 分類 | 例 | 変数名 |
|---|---|---|
| **秘密** | 業務 DB の接続文字列 | `${PORTAL_DSN_BIZ}` |
| | NocoBase の `APP_KEY`・DB パスワード | `${PORTAL_APP_KEY}` / `${PORTAL_DB_PASSWORD}` |
| | Dify Service API キー（**アプリ単位**） | `${DIFY_API_KEY_KN01}` …… **管理番号で命名** |
| | Dify のベース URL（本番は社内） | `${DIFY_BASE_URL}` |
| | LDAP の Bind DN / パスワード（**本番のみ**） | `${PORTAL_LDAP_BIND_DN}` / `${PORTAL_LDAP_BIND_PW}` |
| | NocoBase のライセンスキー | `${NOCOBASE_LICENSE_KEY}` |
| **秘密ではないが公開したくない値**（§7-5 P-3・P-8） | 判定閾値・締め日 | `${PORTAL_THRESHOLD_*}` 等 |
| **社内システムのホスト**（**新規**） | Outline のベース URL | `${PORTAL_OUTLINE_BASE}`（**デモでは未設定＝リンクを張らない**。§5-7） |
| **公開してよい既定値**（`${VAR}` にしない） | データソース名 `biz`・テーブル名・ロール名・管理番号 | 直値で書く |

**`demo` 環境の値は `env/demo/portal.yml` に直値で書いてよい**（架空だから）。これが「顧客に見せるデモが、リポジトリを clone しただけで再現できる」状態を作る —— PM の「顧客や社内に見せたい」に最も直接効く。

**`CLAUDE.md` §2-12 との違い**：§2-12 の「プレースホルダを入れない」は **Dify Cloud への URL インポートを壊さないため**の制約。**ポータルには URL インポートの制約が無い**ので、定義側に `${VAR}` を書いてよい。**この 1 点だけが Dify 側と違う**（新リポの `CLAUDE.md` §2 に明記済み）。

### 7-7. ★ GitHub → GitLab —— 二段構えと、いま詰まらないための点検

**デモは GitHub（`shoulang0729/portal`・public）、本番は GitLab Self-Managed（社内）。**

#### 7-7-1. フェーズ

| フェーズ | 正本 | GitHub | GitLab | 引き金 |
|---|---|---|---|---|
| **フェーズ 1（いま〜P1）** | **GitHub `shoulang0729/portal`（public）** | 正本 | 無し | — |
| **フェーズ 2（本番投入時）** | **GitLab Self-Managed（社内）** | **デモ用のミラー**（顧客・社内に見せる） | 正本 | **本番インスタンスに実データを入れる日**（推奨。PM 判断 11-11） |

#### 7-7-2. ★ なぜ移行が安全に成立するか（**「実データが入らない」の副産物**）

**リポジトリに実データ・秘密・実 URL が 1 バイトも入らないなら、GitLab（社内・正本）から GitHub（public・ミラー）へ全量ミラーしても安全。**

- フィルタリングが要らない（フィルタは必ず漏れる）
- **`check-nodata.mjs` を GitLab CI で必ず通してからミラーする**（ミラー前の最後の関門）
- ミラーは GitLab 標準の push mirror
- **逆に、もし実データや社内 URL を 1 つでも入れていたら、この移行は成立しない**（毎回人が選別することになる）。→ **§5-7（Outline の実 URL を持たない）・§7-4 N6（ホストを allowlist に足さない）が、この移行のための投資でもある**

#### 7-7-3. ★ いま GitHub 側で作るものが、GitLab に移せない形になっていないか（点検表）

**これがこの節でいちばん重要。** 今日の判断が将来詰まるところ。

| # | 点検項目 | 判定 | 守るルール |
|---|---|---|---|
| **G-1** | **CI のロジックをワークフロー YAML に書いていないか** | ⚠️ **要注意** | **CI の中身はシェル 1 行（`npm test`）に閉じる。** 判定・分岐・生成は `tools/*.mjs` と `scripts/*.sh` に置く。**移行は YAML 1 枚の書き換えで済む** |
| **G-2** | **GitHub 固有機能に依存していないか** | ✅ 現状問題なし | 使ってよいのは `actions/checkout` と `actions/setup-node` **だけ**。**Environments / Required reviewers / OIDC / `GITHUB_TOKEN` 前提の自動 PR / Dependabot / Pages を設計の前提にしない**（`dify-ops.yml` の型を持ち込まないと決めた §7-2 が効いている） |
| **G-3** | **社内システムのホスト名・URL を書いていないか** | ✅ **書かない** | Outline は `${PORTAL_OUTLINE_BASE}`、GitLab は「リポジトリ自身」なので URL 不要、AD は `${PORTAL_LDAP_*}`。**`check-nodata.mjs` N6 の allowlist に社内ホストを足さない**（足したら public に載る） |
| **G-4** | **秘密の置き場が GitHub 前提になっていないか** | ✅ 現状問題なし | **デモの CI は secret を 1 つも使わない。** 本番デプロイはリポジトリの CI から行わない（フェーズ 2 で GitLab CI から行えるようになるが、**いまその前提を作らない**） |
| **G-5** | **DDL を誰が流すかが人に紐づいていないか** | ⚠️ **要注意** | **Flyway の実行をコマンド 1 本（`scripts/migrate.sh`）に閉じる。** デモ＝実装者が手で叩く、本番＝運用者が手で叩く／GitLab CI が叩く。**どれでも同じスクリプト**。手順書に「NocoBase の画面でこう操作する」と書かない（**書いたら移せない**） |
| **G-6** | **Issue / PR 番号の参照が曖昧になっていないか** | ⚠️ 要注意 | 本文に番号を書くときは **「GitHub Issue #242」「GitHub PR #243」と出自を明記**する（GitLab は `#` が Issue、`!` が MR で体系が違う）。**設計書の正本は現リポ（GitHub）に残る**ので、ここは長く効く |
| **G-7** | **`seed/world/` の出典行がホストに依存していないか** | ✅ 問題なし | 現行の書式は `# source: shoulang0729/dify  data/world/… @ <sha>` で**ホスト名を含まない**。**この書式を変えない** |
| **G-8** | **設計書の置き場** | ⚠️ **PM 判断 11-10 に依存** | **設計の正本は現リポ `shoulang0729/dify`（GitHub）**。**中国拠点から `github.com` に到達できない場合、参照できない**（U21）→ §7-7-5 |
| **G-9** | **ブランチ保護・レビュー運用** | ✅ 問題なし | `main` 直 commit 禁止・feature ブランチ・squash マージは**両方にある機能**。運用の言葉で書いてあるので移行できる |
| **G-10** | **GitHub Pages に依存する成果物を作っていないか** | ✅ 作らない | スキーマ説明ページは **P0 でやらない**（§7-1）。作るときは GitLab Pages でも同じになる形で |

#### 7-7-4. 本番に移した時点で何が変わるか（先に書いておく）

| | フェーズ 1（デモ・GitHub） | フェーズ 2（本番・GitLab） |
|---|---|---|
| **CI の定義** | `.github/workflows/verify.yml` | `.gitlab-ci.yml`（**中身は同じ `npm test`**） |
| **CI が使う秘密** | **ゼロ** | 本番デプロイを CI から行うなら、GitLab の CI/CD variables（masked / protected）。**行うかはフェーズ 2 で判断** |
| **Flyway を誰が流すか** | 実装者が `scripts/migrate.sh`（手元の docker） | **社内の運用者が同じスクリプト**、または GitLab CI の deploy job。**SQL ファイルは同一** |
| **定義の適用** | `scripts/apply.sh --strict`（手） | 同じスクリプト。**Migration Manager の `.nbdata` はどちらも同じファイル** |
| **承認ゲート** | 無し（`workflow_dispatch` の `confirm` 入力で足りる） | GitLab の protected environment / manual job。**フェーズ 2 で設計する** |
| **可視性** | public | **社内のみ。GitHub 側はミラーとして public のまま** |
| **設計書** | 現リポ `docs/handoff/`（GitHub） | **同じ**（U21 が否ならミラーを足す） |

#### 7-7-5. U21（中国拠点から GitHub に到達できるか）が否だった場合

- **カタログ・管理番号・架空世界・設計書の正本は現リポ（GitHub）のまま**（§6-1 の逆流禁止は変えない）
- **GitLab に「読み取り専用の片方向ミラー」を足す**（`dify` → GitLab のミラーリポジトリ）。**正本は動かさない**
- **ミラーは検査を通さない**（現リポの `npm test` は GitHub 側の CI で通っている）
- **→ PM 判断 11-10。P1 着手前に確認する**

---

## 8. P0 —— 最初に作る 1 つ（**2026-09-11 差し替え。デモ版**）

> **初版の P0 は「私のページ」（お知らせ ＋ 勤怠・年休・研修の 3 つの数字 ＋ AI サービス一覧 ＋ iframe）だった。** ドメインが変わったので差し替える。**旧 P0 と旧 AC-1〜AC-7 は §15 附録 A-4 に全文＋新 AC への対応表つきで残してある。**

### 8-1. 先行順のどこに置くか

`docs/dify/platform-components.md` 末尾の先行順テーブルでは **7 番＝PC-16 (a)**（Dify WebApp で W1 をパイロット・工数感 S）、**18 番＝PC-16 (b)**（自前フロント・工数感 L）。ポータルは 18 番に当たるが遠い。**7 番と 18 番の間に「7.5 番」を置く**（初版から変わらず）。

### 8-2. P0「案件とアクション ＋ 画面の中の AI」（**デモ版**。4 画面・2〜3 週・捨てられる規模）

**選んだ理由**：**いちばん学びが大きく、かつ捨てられる。**

1. **P0 の主目的は「デモで作ったものが本番に移せる」ことの実証**（§0-3）。それを確かめるには **Migration Manager を実際に回す**しかない（**AC-1**）
2. **方式 (b)（外部 PostgreSQL ＋ Flyway）が本当に成立するか**は、テーブルを 1 本作っただけでは分からない。**リレーション（`projects` ↔ `customers` ↔ `actions`）があって初めて分かる**（**AC-2**）
3. **PM の最優先の訴求点（画面の中に Dify が埋まっている）を最小構成で見せられる**（**AC-6・AC-7**）
4. 案件・Action は**部門ポータルのいちばん狭い中核**で、これが動けば Customers / KPI / People は同じ型の繰り返しになる
5. **捨てられる**：テーブル 7 本・画面 4 枚・Workflow 2 本。全部消しても失うのは 2〜3 週

| # | 作るもの | 中身 | 実現手段 |
|---|---|---|---|
| **①** | **業務 DB（`biz`）** | `staff` / `departments` / `customers` / `projects` / `actions` / `document_links` / `ai_services` の 7 本 ＋ `projects_history` / `actions_history` | **Flyway の SQL**（`migrations/V1__init.sql`）。**NocoBase の画面からは 1 列も作らない**（§3-3） |
| **②** | **NocoBase から `biz` を認識** | 外部データソース名を **`biz` に固定**（代替 C'）。Schema=`public`。Record unique key は各テーブルの主キー | External PostgreSQL（Standard+。Professional に含まれる） |
| **③** | **画面 4 枚** | **Home**（§5-3）／**Projects 一覧**／**Project 詳細**（Actions 併載・`document_links`・AI ボタン 2 つ）／**AI サービス一覧**（§14-7） | 標準ブロック（Table / Details / List / Grid Card）。**カスタムプラグインを書かない** |
| **④** | **画面の中の AI**（§14） | (a′) 2 本：`GN-05` 文書要約 →「この案件の状況を要約」／`DC-01` 本社報告ドラフト →「本社向け報告の下書き」。(b) iframe 1 本：`KN-01` 技術ナレッジ QA | Workflow（Custom action event → HTTP request → Response message）＋ iframe ブロック |
| **⑤** | **定義の移送** | デモ 1 号機 → **デモ 2 号機**に定義だけを流し、同じ 4 画面が出る | **Migration Manager**（Professional+） |
| **⑥** | **デモデータ** | `data/world/dept/`（§14-8）から seed。**架空のみ** | `seed/` ＋ 投入スクリプト（`INSERT` は `seed/**` に置き、`migrations/**` には置かない。§7-4 G2） |

### 8-3. P0 でやらないこと（明示）

- **AD / LDAP**（本番のみ。ローカルユーザー 5 名＝5 ロール各 1 名で始める）
- **Outline の実接続**（`${PORTAL_OUTLINE_BASE}` 未設定＝「（デモ環境では未接続）」表示。§5-7）
- **GitLab**（フェーズ 2。§7-7）
- **Teams 通知・Google 連携**（作ると本番で外せなくなる。§0-2）
- **KPI・Dashboard の作り込み**（**チャート 1 枚だけ**を U15 の確認のために作る。AC-4）
- **`meetings` / `opportunities` / `kpis` / `resources` / `announcements`**（P2 以降）
- **勤怠・研修・年休**（§5-6）
- **自前のチャット UI**（iframe と (a′) に寄せる。U5 を回避）
- **NocoBase の AI 機能**（§4-3）
- **上長・部署階層の権限**（§5-8。P0 は「担当者 = Current user」だけ）
- **本番インスタンス**（**到達点。作らない**）

**逆に、P0 の初日から効かせる実装ルール（無料の保険）**：

- **外部データソースの登録名を `biz` に固定**（代替 C'）。本番も同じ名前で登録し、**接続先だけ環境で変える**
- **データスコープは「担当者 = Current user」。`Own records`（作成者ベース）を使わない**（代替 E）
- **`DB_UNDERSCORED=true` / `DB_TABLE_PREFIX=nb_` / `DB_SCHEMA=public` を `.env` と `env/README.md` に書いて固定**（C2）
- **ロール名を `management` / `sales` / `delivery` / `pm` / `general` の 5 つに固定。6 つ目を作らない**（C3）
- **画面・ブロック・ワークフローの名前に環境名（`prod`／`demo`）を入れない**
- **業務テーブルの列を NocoBase の画面から足さない**（§3-3）
- **C1-a / C1-b / C1-c を守る**（§3）

### 8-4. P0 の受け入れ条件（**デモ版**）

| # | 条件 | 検証方法 | 落ちたときの意味 |
|---|---|---|---|
| **AC-1** | **Migration Manager で定義だけをデモ 2 号機へ移送し、同じ 4 画面が出る。** 業務データは移送されない（Schema-only / 外部 DB は対象外） | 2 号機で画面を開く ＋ `biz` の行数を確認 | **P0 の主目的。** 落ちたら Professional の購入判断と §4-11 の組み合わせに戻る。**PM に報告して段取りを組み直す** |
| **AC-2** | **業務テーブルの DDL が `migrations/**` の SQL だけで再現でき、NocoBase が `biz` に列を足していない** | 空の PostgreSQL に Flyway を流し、稼働中の `biz` と `information_schema.columns` を diff → **0 行** | 方式 (b) の前提が崩れる。§4-11-3 の戻り先（方式 (a)）を検討 |
| **AC-3** | **`node tools/check-nodata.mjs` が PASS**（構造 G1〜G5・内容 N4〜N6 が FAIL ゼロ、N1〜N3 が baseline 以内） | CI | 実在の語が入った。**public なので即座に直す** |
| **AC-4** | **KPI チャートが 1 枚出る**（外部データソース `biz` を引く）。**引けないなら代替 D を採ったことが記録されている** | 画面 ＋ 記録ファイル | U15 が否。KPI の作り方が変わる（他は壊れない） |
| **AC-5** | **`pm` ロールのユーザーが、自分が `owner_staff_id` の案件だけを見る**（「担当者 = Current user」のデータスコープ） | 2 ユーザーで確認 | U16 が否。業務 DB 側のビューで解く |
| **AC-6** | **案件詳細の AI ボタンが Dify Cloud の `GN-05` を呼び、日本語と中国語の両方で回答が返る**（`CLAUDE.md` §2-5）。**かつ API キーがブラウザに出ない** | 画面 ＋ DevTools の Network | U20 が否。(a′) の実装を Workflow 側に寄せ直す |
| **AC-7** | **`ai_services` に 1 行 INSERT するだけで、AI サービス一覧に 1 件増える**（画面定義を 1 文字も変えない） | 行を足して再読み込み | D-6 が成立していない。**「ユースケースを増やし続ける」が成立しない** |
| **AC-8** | **実機の無いサービスに「開く」が出ず、成熟度（試行版／構想）が表示される** | 画面（`st=2`・`st=3` の行） | **動かないものを動くように見せている。**§14-6 違反 |
| **AC-9** | **定義の写しが Git にコミットされ、2 回取った差分が人に読める**（`.nbdata` が読めないなら `dump-schema.mjs` の JSON が読める） | `git diff` | reviewer の diff 監査が成立しない |
| **AC-10** | **リポジトリに秘密が 1 つも無く、未定義の `${VAR}` があると `scripts/apply.sh --strict` が exit 1 する** | CI ＋ 手動 | `CLAUDE.md` §2-10 違反／黙って空文字が入る |

**AC-1 と AC-2 が P0 の本体。** 4 画面は「それを確かめるための最小の題材」にすぎない。**AC-6・AC-7 が PM の訴求点。**

### 8-5. P0 の前提（**ブロッカー**）

| # | 前提 | 状態 | 誰が |
|---|---|---|---|
| **B-1** | **NocoBase Professional のライセンス**（デモ用。Q2 次第で 1 本か 2 本） | **未購入** | **PM 判断 11-9** |
| **B-2** | **実機 12 本の Dify アプリ id と公開 Web アプリ URL** | **未登録**（`dify/env/cloud-master/env.yml` の `apps:` が全件 `id: null`、`mock/js/data/live.js` の `LIVE` が `{}`） | **別 Issue**（`run:mac` または `run:runner`）。§14-4b |
| **B-3** | **`data/world/dept/`（部門の架空世界）** | **未作成** | **PR-2**（現リポ。§14-8） |
| **B-4** | **PostgreSQL と docker-compose** | 未作成 | 新リポ PR-B |

**B-1 の購入を待つ間にできること**：B-2 / B-3 / B-4 ＋ `migrations/V1__init.sql` の執筆 ＋ Community 版での画面の素振り。**ただし AC-1 は Professional が無いと満たせない。**

### 8-6. P0 の後（見通しだけ。確定させない。**すべてデモ版**）

| 段 | 内容 | 前提 |
|---|---|---|
| **P1** | Customers / People の画面／`meetings`・`opportunities`／KPI ダッシュボード本体／**画面の中の AI を §14-4 の表の全件に広げる** | P0 の AC-1・AC-4 |
| **P2** | `kpis` の集計／`announcements`（＋ PC-19 の採番）／PC-04 の読み取り経路／部署階層の権限 | P1 |
| **P3** | `resources`（稼働状況）＋ **勤怠・研修・年休の統合**（§5-6）／自前チャット UI（PC-16 (b) 本体。U5 次第） | P2 |
| **本番（到達点。いま作らない）** | AD / LDAP・Outline 実接続・GitLab 移行・Dify Enterprise への切り替え | §0-2 の 4 列目のとおり |

---

## 9. このリポジトリ側に必要な変更（提案。architect は `CLAUDE.md` を直接書き換えない）

### 9-1. `CLAUDE.md` — **PM 承認が要る。本 PR では触らない**（PM 了承済み・PR-3 で適用）

提案は**冒頭の地図に 1 行だけ**（初版から変更なし）：

> （社内向けポータル（NocoBase）は別リポ `shoulang0729/portal`（Public。**定義と架空のデモデータだけ**を置き、実データは入れない）。設計は `docs/handoff/2026-09-10-portal-nocobase.md`。）

- **4 区分は変えない。§2 load-bearing は 1 文字も変えない**
- 前例：冒頭に既に「（SwingTrainer アプリ本体は別リポ …）」がある

### 9-2. `docs/dify/**` — **PM 承認が要る。本 PR では触らない**（**2026-09-11 で内容を差し替え**）

| # | 対象 | 追記案 | 改訂 |
|---|---|---|---|
| (1) | `platform-components.md` **PC-01** の「読み手・書き手」 | 「**ポータル（PC-16 (b)）では `actions` テーブルがこの器の役割を担う**（`kind`／`status`／`source`／`source_ref` の意味を引き継ぐ）。設計は `docs/handoff/2026-09-10-portal-nocobase.md` §5-4」を 1 行。**テーブル定義・API・`kind`・`status` は 1 文字も変えない** | **差し替え**（初版は「`source` に `hr` を足す」だった） |
| (2) | 同 **PC-04** の「依存する外部システム」 | 「**部門の業務 DB（PostgreSQL。読み取り／書き込み）**」を足す | **差し替え**（初版は「人事マスタ・勤怠・研修（LMS）」だった） |
| (3) | 同 **PC-04** の「実現案」 | 「(6) **ポータル（PC-16）が Dify を経由せず直接読む経路も認める**」を足す | **維持** |
| (4) | 同 **PC-16** の「実現案（3 案）」の (b) | 「**実装手段として NocoBase（Professional）を採用。デモ＝Dify Cloud／本番＝Dify Enterprise。設計書 `docs/handoff/2026-09-10-portal-nocobase.md`**」を 1 行 | **更新** |
| (5) | 同 末尾の先行順テーブル | **7 番と 18 番の間に「7.5」** —「PC-16 (b) の試作（P0）。案件と Action の 4 画面・画面の中の AI・定義移送の確認」 | **更新** |
| ~~(6)~~ | ~~**PC-19 お知らせ・全社掲示ストア**（新設）~~ | **後ろ倒し**（§5-5）。`announcements` を実際に作る P2 の PR で採番する。**使わない番号を先に切らない** | **取り下げ（保留）** |
| (7)（新規） | 同 **PC-09**（トレース）・**PC-10**（個人情報） | 「**ポータルから Dify を呼ぶとき、`user` には社員 ID ではなく仮名を渡す**」（§10-2）。**PM 判断 11-3 が (b) に決まったら** | 新規 |

### 9-3. `data/world/` — PR-2 で実施（**内容差し替え**）

> ~~勤怠・年休・研修・お知らせの 4 ファイル × 2 業種~~（**取り下げ**。§15 附録 A-3）

**新しい PR-2**：**`data/world/dept/`（部門の世界）を新設**する。中身は §14-8。

### 9-4. 変更しないもの（確認）

| 対象 | 判断 |
|---|---|
| `mock/js/data/live.js` の `LIVE` | **本 Issue では変更しない。** ただし **§14-4b の登録作業は別 Issue で必要**（`LIVE` が `{}` のままだと iframe の URL が無い）。`LIVE` は「サービス内部 id → Dify の公開 Web アプリ URL」の定数（`docs/handoff/2026-09-08-live-links.md`）。**ポータルの URL は別物なので転用しない** |
| `docs/service-map.md` | **変更不要**（生成物。`npm run index`） |
| `.github/workflows/pages.yml` | **変更なし**（§7-1） |
| `tools/**`・`tools/regress.baseline.json` | **変更なし。** `mock/js/data` を触らないので `regress` は不変。**`--update` は不要** |
| `README.md` の 4 区分の表 | **変えない。**「関連プロジェクト」節に 1 行足すだけ（§9-5） |

### 9-5. `README.md` — PR-3 で 1 行（PM 承認後。**文言を更新**）

> 社内向けポータル（NocoBase Professional）は別リポジトリ **`shoulang0729/portal`（Public）**。**定義と架空のデモデータだけ**を置き、実データ・秘密・社内システムの URL は入れない（`${VAR}` で外から）。**いま作っているのはデモ版**で、本番（AD / GitLab Self-Managed / Outline / Dify Enterprise）は到達点。設計は [`docs/handoff/2026-09-10-portal-nocobase.md`](./docs/handoff/2026-09-10-portal-nocobase.md)、NocoBase の公式調査は [`docs/handoff/2026-09-11-nocobase-research.md`](./docs/handoff/2026-09-11-nocobase-research.md)。

---

## 10. Dify との接続点（**デモ＝Dify Cloud／本番＝Dify Enterprise**）

PC-02 が既に決めていること（**繰り返さない**）：SSO で社員 ID・部署・拠点・言語を取る／Dify Service API を呼ぶときに `user` を渡す／**権限は前段（ポータル）で判定**。

**画面の中にどう置くかは §14。** ここは接続の作法だけ。

### 10-1. API キーの粒度と持ち方

- **Dify の Service API キーはアプリ単位。** 実機 12 本 ＝ **12 個のキー**
- **ブラウザに出さない。** → **既定の呼び方を「Workflow の HTTP request ノード」にする**（Workflow はサーバで動く。**U20 が不明なので Custom request を既定にしない**。§14-5）
- キーは **NocoBase の Variables and Secrets（無料）** に置き、**値はリポジトリに入れない**（`${DIFY_API_KEY_KN01}` として `.env` から注入）
- **デモ→本番の境目は `${DIFY_BASE_URL}` と各キーだけ**（§0-2）。**管理番号は不変**
- **P0 の iframe（(b)）では API キーを使わない**（公開 Web アプリ）。**(a′) の 2 本だけがキーを使う**

### 10-2. `user` に何を渡すか —— **社員 ID をそのまま渡さない**（**AD 前提でも維持**）

**2026-09-11 の点検結果：維持する。理由が 1 つ減り、1 つ増えた。**

| | |
|---|---|
| **減った理由** | 本番の Dify は **Enterprise（社内）**になるので、「外部 SaaS に社員 ID が出る」という論点は消える |
| **残る理由** | ① `user` は **Dify の会話ログの主体**として保存され、**PC-09 の Langfuse トレースにも乗る**（PC-09 のリスク欄「トレースに個人情報が残る」）。社内であっても**閲覧範囲は Dify の管理者**になる ② **中国拠点の利用者が主体**で、**PIPL の対象**になる |
| **増えた理由（新規）** | **本番の identity は AD**。AD の `sAMAccountName` / UPN は **そのまま個人識別子**であり、かつ**他システム（GitLab・Outline）と共通**。**1 つ漏れると横に繋がる**。仮名にすればポータルで止まる |
| **デモでは** | **そもそも実在社員が存在しない**ので、P0 では自動的に満たされる。**ただし実装の形は最初から仮名にしておく**（本番で直すと `user` の値が変わり、Dify 側の会話履歴が分断される） |

**提案（維持）**：`user` には **社員 ID から導いた安定な仮名**（例 `u-<ハッシュ先頭 12 桁>`、ソルトは環境ごと）を渡し、**仮名 → 社員 ID の逆引きはポータル側だけが持つ**。監査（PC-10 (5)）はポータル側のログで成立する。→ **PM 判断 11-3**（唯一の回答待ち）。

### 10-3. エラー時の見せ方（3 分類。**不変**。文言は §5-9）

| # | 事象 | 見せ方 |
|---|---|---|
| **E1** | Dify に届かない／5xx | `ai.error` ＋ **その場の再送ボタン** ＋ **管理番号**（問い合わせで一意に指せる） |
| **E2** | タイムアウト／途中で切れた | **途中まで表示したまま** `ai.truncated`。**消さない** |
| **E3** | KB に無い・答えられない | **エラーとして扱わない。** 正常な回答（`docs/dify/implementation-guide.md` の「不確実なときの定型」の系）。ポータルがエラー表示に変換しない |
| **E0** | サービスの点検中 | `ai_services.enabled = false` にして、カードに「点検中」を出す。**成熟度 `st`（1/2/3）とは別の軸**（`CLAUDE.md` §2-7 の `st` の値域を増やさない） |

### 10-4. ストリーミングをどう出すか

- **P0 では扱わない**（(a′) は同期ワークフローで結果を一括表示、(b) は iframe）
- P3 で自前チャット UI を作るとき、**U5 が最初の関門**。出せないなら (a) カスタムプラグインを書く（TypeScript。U7 は判明済み）(b) チャットだけ別の小さな SPA にして iframe で埋める、の 2 択。**(b) を先に検討する**

---

## 11. PM 判断（**2026-09-11 更新**。8 件 → 13 件。**推奨を全件に付けた**）

**PM は「推奨で進めて」と繰り返し言っている。** したがって **⏳ が付いているものだけ**が本当に止まっている判断で、それ以外は推奨どおり進める。

| # | 状態 | 論点 | architect の推奨 |
|---|---|---|---|
| **11-1** | **✅ 完了** | V-PM-1（公式ドキュメントを読む） | **実施済み（2026-09-11）。** 成果物＝`docs/handoff/2026-09-11-nocobase-research.md`。本改訂はこれに基づく |
| **11-2** | **⏸ 保留（後ろ倒し）** | `PC-19 お知らせ・全社掲示ストア` の採番 | **了承済みだが、実施を P2 へ。** `announcements` を実際に作る PR で採番する。**使わない PC 番号を先に切らない**（§5-5・§9-2 (6)） |
| **11-3** | **⏳ 回答待ち（唯一）** | Dify の `user` に社員 ID を素通しするか、仮名にするか（§10-2） | **(b) 仮名 ＋ ポータル側で逆引き。** 本番の Dify が Enterprise（社内）になっても、① PC-09 の Langfuse トレースに乗る ② PIPL ③ **AD の識別子は GitLab・Outline と共通なので 1 つ漏れると横に繋がる**。**デモでは自動的に満たされるが、実装の形は最初から仮名にする** |
| **11-4** | ✅ 了承済み | NocoBase の AI 機能を使わない | **維持。** 調査で AI employees が無料と分かったが判断は変わらない（Knowledge base は Professional+、**Dify を LLM サービスとして直接登録する記載も無い**） |
| **11-5** | ✅ 了承済み | 新リポの名前と可視性 | `shoulang0729/portal`・**public**（維持）。**フェーズ 2 で正本が GitLab に移った後も、GitHub 側はミラーとして public のまま**（§7-7） |
| **11-6** | ✅ 了承済み（**内容が変わった**） | §9-1・§9-2 の追記を PR-3 で適用してよいか | **適用。ただし追記内容を差し替えた**（§9-2）。**(6) PC-19 の新設だけ取り下げ（保留）** |
| **11-7** | **🔄 更新** | `data/world/` に足すもの | **内容が変わった。** ~~勤怠・年休・研修・お知らせの 4 CSV × 2 業種~~ → **`data/world/dept/`（部門の世界）**（§14-8）。**旧 PR-2 は取り下げ** |
| **11-8** | ✅ 了承済み（**台数が増えた**） | P0 をどこで動かすか | **PM のローカル docker。ただし 2 台**（Migration Manager の移送元と移送先。AC-1） |
| **11-9** | ⏳ **新規・P0 のブロッカー** | **NocoBase Professional を購入するか**（§4-11-4） | **買う。$8,000（¥50,000）・一括・Lifetime。** 理由：① P0 の主目的（定義移送）が Professional の Migration Manager ② 本番の AD 連携（Auth: LDAP）でどのみち要る ③ **★ Standard は「自社内部利用のみ」で、顧客提示デモは利用条件を外れうる**。**デモ＋本番で 2 本要るかは Q2 で販売元に確認**（Instance ID 単位）。**同時に Q1・Q3 も聞く**（§4-10） |
| **11-10** | ⏳ **新規** | **中国拠点から `github.com` に到達できるか**（U21） | **情シスに確認。** 到達できないなら、**正本は現リポのまま**で GitLab に片方向ミラーを足す（§7-7-5）。**P1 着手前まででよい** |
| **11-11** | ⏳ **新規** | **AD 側が 5 区分（Management / Sales / Delivery / PM / General User）を OU で表現しているか、セキュリティグループか**（U18） | **情シスに確認。** **OU なら記載どおりの経路（OU → 部署 → 部署ロール）で繋がる。セキュリティグループなら、ロール付与を手動か Workflow / API で補う設計が要る**（公式に手段の記載が無い）。**P1 着手前まででよい**（デモは C3 でロール名を揃えておくだけ） |
| **11-12** | ⏳ **新規** | **勤怠・研修・年休を今回のスコープ外にしてよいか**（PM が 2026-09-10 に要望として挙げたもの） | **スコープ外にする。ただし落とさない。** P3 の `resources`（People・Resource の稼働状況）に統合する（§5-6）。**初版の設計は §15 附録 A-2 に残してある**ので、その日にそのまま使える |
| **11-13** | ⏳ **新規** | **ポータルのデモ世界を「青嶺精工・碧洋銀行を顧客に持つ、日系 SIer の中国拠点ソリューション部門」として作ってよいか**（§14-3） | **作る。** カタログ 67 サービスとポータルが**1 つの架空世界でつながる**（顧客提示として強い）。**必要なのは `data/world/dept/` の新設**（自部門の社名 1 つ・部員 6〜8 名・案件 10 件程度）。**既存 31 名は「顧客側の担当者」として流用**し、重複させない |

---

## 12. PR 分割案（**2026-09-11 更新**）

### 12-1. 現リポ（本 Issue の範囲）

| PR | 内容 | 主なファイル | ラベル | 状態 |
|---|---|---|---|---|
| **PR-1**（初版） | 設計書の初版 | `docs/handoff/2026-09-10-portal-nocobase.md`・`portal-nocobase.issue.md` | `run:cloud` | **マージ済み**（#243） |
| **PR-1b**（本 PR） | **設計書の改訂 ＋ 公式調査の記録の取り込み ＋ Issue 本文の更新。** コード変更なし | `docs/handoff/2026-09-10-portal-nocobase.md`（改訂）・**`docs/handoff/2026-09-11-nocobase-research.md`（新規）**・`docs/handoff/portal-nocobase.issue.md`（更新） | `run:cloud` | 本 PR |
| **PR-2**（**差し替え**） | **`data/world/dept/` を新設**（部門の架空世界。§14-8）＋ `data/world/README.md` の表に追記 | `data/world/dept/*.csv`・`data/world/dept/*.md`・`data/world/README.md` | `run:cloud` | PR-1b の後 |
| **PR-3** | `docs/dify/**` の追記（§9-2 の (1)〜(5)・(7)。**(6) PC-19 は保留**）＋ `README.md` 1 行（§9-5）＋ `CLAUDE.md` 1 行（§9-1） | `docs/dify/platform-components.md`・`README.md`・`CLAUDE.md` | `run:cloud` | PR-1b の後 |
| **PR-4**（**新規・別 Issue**） | **実機 12 本の Dify アプリ id と公開 Web アプリ URL の登録**（§14-4b。**P0 のブロッカー**） | `dify/env/cloud-master/env.yml` の `apps:`・`mock/js/data/live.js` | **`run:mac` または `run:runner`** | **本 Issue に含めない**（`run:*` は 1 つだけ。`CLAUDE.md` §7） |

**並列可否**：

```
PR-1b（本 PR・先行必須）
  ├── PR-2   data/world/dept/**          ┐ ファイル集合が重ならない → 並列可
  └── PR-3   docs/dify/** README.md CLAUDE.md ┘

PR-4 は別 Issue（実行場所の軸が違う）。PR-1b と独立に着手してよい
```

**検証の期待結果**（PR-1b・PR-2・PR-3 共通）：

- `node tools/verify.mjs` **PASS**
- `node tools/regress.mjs` **PASS**（`mock/js/data` を 1 バイトも触らないので**差分ゼロ**。**`--update` は不要**）
- `npm run world` は **warn のみ**（CI 対象外）。**PR-2 は `data/world/dept/` を新設するが、`tools/check-world.mjs` の走査対象は「語彙を使う側」のディレクトリ allowlist なので、正本側に足しても warn は増えない**（§1-3）

### 12-2. 新リポ（本 Issue の範囲外。**別 Issue**）

| PR | 内容 | 状態 |
|---|---|---|
| **PR-A** | 骨組み（`CLAUDE.md` 抜粋・`docs/`・`tools/check-nodata.mjs`・`seed/world/`・`.env.example`・CI） | **作成済み**（`feat/portal-skeleton`・PR #1。**マージ保留中**） |
| **PR-A2**（新規） | **本改訂に合わせた骨組みの調整**：① `check-nodata.mjs` の **G2 を「`migrations/**` の `.sql` は許すが `INSERT`/`COPY` を含むものは FAIL」に変更**（§7-4）② `CLAUDE.md` §1 の「勤怠・年休・研修」を案件系に差し替え ③ `env/README.md` に **C2 の 5 行**（§3-5）④ `.env.example` に `PORTAL_DSN_BIZ`・`PORTAL_OUTLINE_BASE`・`DIFY_BASE_URL` | PR-A のマージ後 |
| **PR-B** | docker-compose（NocoBase 2.2.x ＋ PostgreSQL 16）＋ `migrations/V1__init.sql`（§8-2 ①）＋ `scripts/migrate.sh`・`scripts/apply.sh` | Professional 購入と独立に着手可 |
| **PR-C** | P0 の 4 画面 ＋ (a′) 2 本 ＋ iframe 1 本 ＋ `ai_services` の seed | **B-1（ライセンス）と B-2（app id / URL）待ち** |
| **PR-D** | P0 の受け入れ確認の記録（AC-1〜AC-10 と R-1〜R-8 の結果） | PR-C の後 |

### 12-3. 将来（いまは作らない）

| | 内容 | 着手条件 |
|---|---|---|
| **PR-X** | `npm run export:catalog`／`export:world` | 手コピーが 3 回以上ずれた、または月 1 回以上の更新が要るようになったとき |
| **PR-Y** | GitLab への移行（`.gitlab-ci.yml`・push mirror の設定） | **フェーズ 2 の引き金＝本番インスタンスに実データを入れる日**（§7-7-1） |

---

## 13. 用語

| 語 | 意味 |
|---|---|
| **P0** | §8-2 の「案件とアクション ＋ 画面の中の AI」。先行順テーブルの「7.5 番」。**デモ版** |
| **デモ（`demo`）** | `data/world/`（青嶺精工・碧洋銀行・**部門の世界**）を見る NocoBase。**顧客提示用。いま作るのはこれだけ** |
| **本番** | 実データを見る NocoBase。中国拠点の社内限定。**到達点であり、いま作らない** |
| **定義** | 画面・コレクション・ロール・ルート・ワークフローの構成。**データを含まない**。Migration Manager が運ぶもの |
| **業務スキーマ** | `biz` の DDL。**Flyway の SQL で Git 管理**。**デモと本番で同一**（§3-3） |
| **`biz`** | 外部データソースの登録名（固定）。旧「代替 C」の `hr` を改名したもの |
| **C1 / C2 / C3** | §3 の制約（定義とデータを分ける／環境間で一致させる設定／ロール名を AD の 5 区分に揃える） |
| **V1〜V4** | 新リポの機械検査（§3-7） |
| **A1〜A18** | npm レジストリで確認済みの事実（§4-2） |
| **U1〜U21** | 未確認事項（§4-4・§4-4b）。**判明したものは「✅ 判明」、残るものは「⚠️ 不明」。断定しない** |
| **Q1〜Q7** | 公式へ問い合わせる件（§4-10） |
| **R-1〜R-9** | P0 の中で実機で確かめる手順（§4-7）。**初版の V-P0-* を改名** |
| **代替 B〜E** | 逃げ道（§4-6）。**B は決着＝不要、C' は `biz` 固定、D は KPI チャート、E は Own records に依存しない** |
| **AC-1〜AC-10** | P0 の受け入れ条件（§8-4） |
| **G1〜G5 / N1〜N6** | 新リポの機械検査（§7-4。構造は FAIL、内容は N4〜N6 が FAIL） |
| **P-1〜P-13** | public にすると読まれるものの一覧（§7-5） |
| **(a′) / (b) / (c)** | 画面に AI を置く 3 通り（§14-5）。**既定は (a′)** |
| **フェーズ 1 / 2** | ソース管理の段（GitHub 正本 → GitLab 正本。§7-7-1） |

---

## 14. ★ 画面の中に Dify を置く（PM 追加要件・2026-09-11）

### 14-1. 方針

> **AI を「AI」という 1 ページに隔離しない。** Home / Customers / Projects / Actions / People・Resource / KPI・Dashboard / 会議 / 知識 —— **それぞれの画面の文脈の中に、その場で使える Dify アプリを置く。**

これはデモの訴求点そのもの：**カタログ 67 サービスが「並んでいるだけ」から「業務画面の中で動く」に変わるところ**を見せる。

**設計上の要請は 2 つ**：

1. **画面と地続きであること**（「案件一覧を見ていて、その案件のリスクを要約させる」）
2. **サービスが増えても画面を直さないこと**（PM「ユースケースはどんどん増やしていきたい」）→ **§14-7 の `ai_services` ＋ `ai_service_screens` が本体**

**なお `AI` 画面（サービス一覧）は残す。** 隔離するのではなく、**「全部を見渡す入口」として 1 枚だけ置く**（カタログの役割）。

### 14-2. 「可能な場所」の判定基準 —— 3 つとも満たすものだけ

| # | 基準 | 判定の仕方 |
|---|---|---|
| **J1** | **その画面の文脈で自然に使えるユースケースが 67 サービスの中にあるか** | 無いところに無理に置かない。**空のままでよい**（空であることが設計の情報） |
| **J2** | **実機で動いているか** | **実機は 12 本**（`dify/apps/*.yml` ＝ `SVCS` の `st === 1` と完全一致）：**KN-01・KN-02・KN-03・DC-01・DC-02・DC-04・LG-01・LG-04・NM-03・GN-01・GN-02・GN-05**。残り 55 件は試行版（`st=2`）・構想（`st=3`）で実機が無い |
| **J3** | **架空データだけで動くか** | **12 本はすべて `data/world/` の架空世界だけを使っている**（`CLAUDE.md` §2-10 に PM 確認済みと明記）。**ただしポータルから渡す文脈も架空でなければならない**。デモ環境（`data/world/dept/`）なので満たす。**⚠️ 本番では満たさない → §14-5 の歯止め** |

### 14-3. ★ ドメインのずれと、架空世界の橋渡し

**問題**：カタログ 67 サービスは**製造業（青嶺精工）と金融（碧洋銀行）**という「**顧客の業務**」向けに作られている。一方ポータルは**自部門の案件・顧客・KPI** を扱う。素直には同じ画面に乗らない。

**判断：成立する。橋を架ける。**

> **ポータルのデモ世界＝「青嶺精工と碧洋銀行を顧客に持つ、日系 SIer の中国拠点ソリューション部門」。**

この設定を置くと：

| | |
|---|---|
| **`customers` の行** | **青嶺精工**（製造）と**碧洋銀行**（金融）。**既に社名・拠点・部署・人物がある架空企業**（`data/world/mfg`・`fin`）。作り直さなくてよい |
| **`projects` の行** | 「**青嶺精工向け `KN-01` 技術ナレッジ QA 導入**」「**碧洋銀行向け `RS-01` ニュース収集 PoC**」…… **管理番号がそのまま案件名になる** |
| **67 サービスの意味** | **我々が顧客に納めている／提案している AI サービスのカタログ**。ポータルの `ai_services` は「商品リスト」でもあり「自部門で使う道具」でもある。**二重の意味が自然に成立する** |
| **`staff` の行** | **部門の社員（新規。`data/world/dept/people.csv`）**。既存 31 名は**顧客側の担当者**として `customers` の連絡先に流用（新規に作らない） |
| **デモの物語** | 「この部門は 2 社に AI サービスを導入している。案件の進捗・Action・KPI をこのポータルで管理し、**その管理作業そのものにも AI（GN-05・DC-01・NM-03・LG-04）を使っている**」 |

**これが強い理由**：カタログ（`mock/catalog.html`）・Dify のデモ（実機 12 本）・ポータルの 3 つが**同じ架空世界**で繋がる。顧客に「これは別々のデモではなく、1 つの会社の話です」と言える。

**境界の規則（`CLAUDE.md` §2-13 を壊さないための線）**：

- **`dept/` は「mfg / fin の語を顧客として参照してよい唯一の世界」。** 逆に **mfg / fin 側から `dept/` を参照しない**（片方向。§6-1 と同じ精神）
- **mfg と fin を互いに混ぜる規則（§2-13）は変えない。** `dept/` が両方を顧客に持つのは、**「顧客 2 社の世界は互いに独立」だから成立する**
- **新しい人名・記号は `dept/` の中だけで作る。** `mfg/people.csv`（17 名）・`fin/people.csv`（14 名）を**増やさない**

→ **PM 判断 11-13**（この設定でよいか。推奨＝作る）

### 14-4. ★ 対応表：ポータル画面 → 管理番号 → 実機の状況 → 置き方 → 渡す文脈

**置き方の記号**：**(a′)** ボタン → Workflow（同期）→ HTTP request → 結果を画面へ ／ **(b)** iframe で Dify の画面を埋め込む ／ **(c)** 裏で一括処理してテーブルに書く ／ **(cat)** カタログ表示のみ（実機が無い。開けない）

| ポータル画面 | 置く Dify サービス（管理番号） | 実機の状況 | 置き方 | 渡す文脈 | 段 |
|---|---|---|---|---|---|
| **Home** | **`NM-03`** 日報・実績の集計と要約 | **✅ 実機** | **(a′)**（ボタン「期限超過を担当者別に整理」） | `actions` のうち `status='open'` かつ `due_at < today` の行（担当者名・案件名・期限・優先度） | **P0** |
| **Home** | **`GN-05`** 文書要約 | **✅ 実機** | **(c)**（夜間に全案件の状況要約を作り `projects.ai_summary` に書く）→ カードに表示 | 案件の `title` ＋ 直近 Action 10 件 ＋ `document_links.title` | **P0** |
| **Projects 一覧** | **`NM-03`** | ✅ 実機 | (a′)（ツールバー「今月の案件状況を集計」） | 絞り込み後の `projects` 行（状態・health・売上計画/実績・期日） | P1 |
| **Projects 一覧** | `GN-06` 頼まれ事・放置業務の追跡 | ❌ `st=2`（実機なし） | **(cat)** | — | — |
| **Project 詳細** | **`GN-05`** 文書要約 | **✅ 実機** | **(a′)**（「この案件の状況を要約」） | その案件 1 件の全項目 ＋ `actions` ＋ `document_links.title` | **P0** |
| **Project 詳細** | **`DC-01`** 日本本社への報告資料作成 | **✅ 実機** | **(a′)**（「本社向け報告の下書き」） | 同上 ＋ `customers.name_ja` ＋ 期間 | **P0** |
| **Project 詳細** | `DC-08` 報告レビュー（提出前チェック） | ❌ `st=2` | (cat) | — | — |
| **Actions** | **`NM-03`** | ✅ 実機 | (a′)（「期限超過を担当者別に整理」） | 絞り込み後の `actions` 行 | P1 |
| **Actions** | `GN-06` | ❌ `st=2` | (cat) | — | — |
| **Customers** | **`LG-04`** ビジネスメール作成（日中往復） | ✅ 実機 | (a′)（「顧客宛メールの下書き」） | 顧客名・担当者・案件名・用件（フォーム入力 1 行） | P1 |
| **Customers** | **`LG-01`** 日中翻訳 | ✅ 実機 | (a′)（選択テキストの翻訳） | 画面で選んだテキスト | P1 |
| **Customers** | `CV-02` 面談前ブリーフの作成 | ❌ `st=3` | (cat) | — | — |
| **People・Resource** | **`NM-03`** | ✅ 実機 | (a′)（「稼働状況を要約」） | `resources` の当月行（P3） | P3 |
| **People・Resource** | `PO-04` 稼働の集計とコスト配分／`PT-04` 給与水準照会／`PT-05` 採用支援 | ❌ `st=3` | (cat) | — | — |
| **KPI・Dashboard** | **`NM-03`** | ✅ 実機 | (a′)（「この数字から気づきを出す」） | チャートの元データ（`kpis` の当期行） | P2 |
| **KPI・Dashboard** | `NM-05` データ分析アシスタント／`RS-05` ダッシュボード出力からの気づき分析 | ❌ `st=2`・`st=3` | (cat) | — | — |
| **会議**（P2） | **`DC-02`** 議事録作成と次回論点整理 | ✅ 実機 | **(b)** iframe ＋ 結果を人が `meetings` に貼る（P2）／将来 (a′) | — | P2 |
| **会議** | `GN-04` スケジュール調整 | ❌ `st=2` | (cat) | — | — |
| **知識** | **`KN-01`** 技術ナレッジ QA／**`KN-03`** 社内規程・就業規則 QA | ✅ 実機 | **(b)** iframe | **渡さない**（KB に閉じた QA なので画面の文脈を渡す意味が薄い） | **P0**（KN-01 のみ） |
| **知識** | `KN-04` 社内問い合わせ受付と FAQ 蓄積／`KN-06` 事務手続の照会 | ❌ `st=2` | (cat) | — | — |
| **AI サービス一覧** | **67 件すべて** | 混在 | **(b)**（`st=1` かつ URL あり）／**(cat)**（それ以外） | — | **P0** |
| （画面なし。将来「管理業務」） | `GN-01` 経費精算チェック／`GN-02` 請求書（発票）処理 | ✅ 実機 | **(b)**（AI 一覧から） | — | P2 に画面を作るまで一覧のみ |
| （顧客側の業務。部門ポータルに画面が無い） | `KN-02` 設備マニュアル検索／`DC-04` 安全衛生掲示物の中国語化 | ✅ 実機 | **(b)**（AI 一覧から） ＋ **カタログへのリンク** | — | §14-6 |

**空欄の読み方**：**Home / Projects / Actions / Customers に置けるものは限られる。** これは失敗ではなく事実で、**「67 サービスのうち部門ポータルの画面に自然に乗るのは汎用系（`GN-*`・`NM-03`・`LG-*`・`DC-01`）だけ」**という情報そのもの。**無いところに無理に置かない**（J1）。

#### 14-4b. ⚠️ 前提が欠けている（**P0 のブロッカー**）

**上の表の (a′) も (b) も、いまのままでは動かない。**

| 欠けているもの | 現状 | 影響 |
|---|---|---|
| **Dify アプリ id** | `dify/env/cloud-master/env.yml` の `apps:` が **12 件すべて `id: null`** | (a′) の API 呼び出しができない |
| **公開 Web アプリ URL** | `mock/js/data/live.js` の `LIVE` が **`{}`（空）** | (b) の iframe に入れる URL が無い |

→ **PR-4（別 Issue・`run:mac` または `run:runner`）で登録する**（§12-1）。**P0 の着手条件**。

### 14-5. ★ 置き方の既定と使い分け

#### 既定は **(a′)**。理由は 3 つ

> **(a′)** ＝ 画面のボタン → **Workflow（Custom action event・同期モード）** → **HTTP request ノード** → **Response message**（または結果をテーブルに書いて画面に出す）。**すべて無料**（調査 D-1）。

1. **画面と地続きになる。** 行の文脈（案件 id・顧客名・期限・担当者）を**そのまま渡せる**。**これが PM の要件の本体**
2. **★ API キーがブラウザに出ない。** Workflow は**サーバで動く**。**Custom request アクション（(a)）がサーバ側で実行されるかはドキュメントに記載が無い（U20）** ので、**キーを持つ呼び出しを Custom request に置かない**。（Custom request 自体は「文脈を渡して外部 HTTP を叩く」用途として無料で使えるが、**キーが要らない呼び先にだけ使う**）
3. **結果をポータルの中に出せる。** 「ポータルに AI が埋まっている」という見え方になる

#### (b) iframe は「Dify そのものを見せたい」ときだけ

- **利点**：**既存の実機 12 本がそのまま使える。**作り込みゼロ
- **欠点**：**ポータルに埋まっている感じが薄い**。画面の文脈を渡せない（**URL モードで使える変数の列挙がドキュメントに無い＝U6**）
- **使う場所**：**AI サービス一覧からの「開く」**と、**KB に閉じた QA（`KN-01`・`KN-03`）**、**部門ポータルに受け皿の画面が無いサービス**
- **⚠️ ログイン引き継ぎ**：**ドキュメントに記載が無い**（U6）。**したがって「公開 Web アプリ（ログイン不要）」にだけ使う。**「引き継げる」と断定しない。引き継ぎが要る形になったら (a′) に寄せる

#### (c) 裏で一括は「一覧の全部に対して事前に済ませておく」とき

- Workflow のスケジュールトリガで夜間に回し、**結果をテーブルの列に書く**（`projects.ai_summary`）
- **利点**：画面を開いた瞬間に結果が出ている（デモで待ち時間がゼロ）
- **⚠️ 歯止め**：**AI が書いた列は必ず `ai_summary_at` とセットで持ち、画面に「AI の下書き（生成日時）」と明示する**（`ai.disclaimer`）。**人が書いた列と混ぜない**

#### 使い分けの原則（1 行）

> **「その画面の行に対して何かをする」→ (a′)。「AI そのものを見せる」→ (b)。「一覧の全部に対して事前に済ませておく」→ (c)。**

#### ⚠️ 本番への歯止め（**§0-2 の境目の 1 つ**）

- **(a′) と (c) は、本番の実データを Dify に送る。** デモでは Dify Cloud でよいが、**本番では Dify Enterprise（社内）に切り替わるまで有効にしない**
- 実装：`ai_services.enabled` と `${DIFY_BASE_URL}` の 2 つで止める。**`${DIFY_BASE_URL}` が Cloud を指している環境では (a′)/(c) を無効にする**フラグを 1 つ持つ（`PORTAL_ALLOW_EXTERNAL_AI`。既定 `false`、デモの env でだけ `true`）
- **(b) の iframe は公開 Web アプリなので、本番で開いても実データは送られない**（人が手で入力しない限り）。**ただし「入力しないこと」は機械で守れない**ので、本番では iframe も Enterprise の URL に差し替える

### 14-6. 実機が無いサービスの見せ方 —— **嘘をつかない**

**55 件は試行版（`st=2`）・構想（`st=3`）で実機が無い。** `docs/handoff/2026-09-10-expert-feedback.md` の設計方針（**何と何をつなぎ、どのインプットをどう読み、どこまで確認しているかを明示する**）と整合させる。

| 決め | 内容 |
|---|---|
| **成熟度をポータルでも持つ** | **`ai_services.st`（1/2/3）をカタログからそのまま写す**（`CLAUDE.md` §2-7 の値域を増やさない）。表示は `svc.st.1/2/3`（§5-9） |
| **「開く」を出す条件** | **`st = 1` かつ `live = true`（＝ WebApp URL か API キーが登録済み）のときだけ**。それ以外は **`svc.catalogonly`（カタログのみ（実機なし））** を出し、**ボタンを描かない**（グレーアウトでもなく、無い） |
| **代わりに出すもの** | **カタログへのリンク**（`https://shoulang0729.github.io/dify/` の該当分類）。「構想段階のものも含めた全体像はこちら」と示す |
| **3 行の説明**（`explain_ja` / `explain_zh` / `explain_en`） | **① 何と何をつなぐか ② どの入力をどう読むか ③ どこまで確認しているか。** `st=1` は「実機で確認済み」、`st=2` は「台本で確認・実機未」、`st=3` は「構想のみ」と**はっきり書く** |
| **⚠️ 禁止** | **試行版・構想のカードを、実機と同じ見た目で並べない。** 「開く」が無いだけでは弱いので、**バッジと 3 行の説明を必ず出す** |
| **デモでの説明** | 「**動くもの 12 本と、設計だけのもの 55 本が同じ表に並んでいます。バッジが違います**」と言えれば、有識者フィードバックの指摘に正面から答えられる |

### 14-7. ★ `ai_services` —— サービスが増えても画面を直さない仕組み

**根拠**：調査 D-3 —— **Grid Card / List / Kanban はコレクションのレコードをそのまま描画するブロック**（無料）。行アクションに **Link**（URL 変数を渡せる・別窓可）・**Pop-up**・**Trigger Workflow**・**JS Action** がある。

#### テーブル定義（`biz`。Flyway）

**`ai_services`**

| 列 | 型 | 内容 |
|---|---|---|
| `service_no` | text PK | **管理番号**（`KN-01` 形式）。**`CLAUDE.md` §2-11 の語彙。デモ→本番でも不変** |
| `internal_id` | text | 現リポの `SVCS[].id`（`kn1`）。手コピーの突き合わせ用 |
| `cat` / `sub` | text | 分類・中分類（カタログから写す） |
| `name_ja` / `name_zh` / `name_en` | text | 名称（3 言語。**空にしない**） |
| `desc_ja` / `desc_zh` / `desc_en` | text | 説明（3 言語） |
| `st` | smallint | 成熟度 1/2/3（§14-6） |
| `tags` | text[] | カタログのタグ |
| `live` | boolean | **実機があるか**（＝ `app_key_var` か `webapp_url_var` が登録済み） |
| `mode` | text | `api`（(a′) で呼ぶ）／`iframe`（(b)）／`catalog`（(cat)） |
| `app_key_var` | text | **API キーの変数名**（`DIFY_API_KEY_KN01`）。**キー本体は書かない** |
| `webapp_url_var` | text | **WebApp URL の変数名**（`DIFY_WEBAPP_URL_KN01`）。**URL 本体も書かない**（環境で変わるため） |
| `explain_ja` / `explain_zh` / `explain_en` | text | §14-6 の 3 行 |
| `enabled` | boolean | 点検中フラグ（E0。§10-3） |
| `pinned` | boolean | Home のカードに出すか |
| `sort` | int | 並び順 |

**`ai_service_screens`**（**これが「画面に出るか」をデータで持つ本体**）

| 列 | 型 | 内容 |
|---|---|---|
| `service_no` | text FK | → `ai_services` |
| `screen_key` | text | `home` / `projects` / `project_detail` / `actions` / `customers` / `people` / `kpi` / `meetings` / `knowledge` / `ai` |
| `slot` | text | `list_toolbar`（一覧のツールバー）／`row_action`（行のボタン）／`detail_panel`（詳細画面のパネル）／`card`（カード） |
| `label_key` | text | ボタン文言のキー（§5-9 の `ai.*`） |
| `context_query` | text | **渡す文脈の作り方**（NocoBase の変数式、または `biz` 側のビュー名）。**画面ごとの「何を渡すか」をここに持つ** |
| `sort` | int | 並び順 |

#### これで何が起きるか

| やりたいこと | やること | **画面定義を触るか** |
|---|---|---|
| **AI サービス一覧に 1 件増やす** | `ai_services` に 1 行 INSERT | **触らない**（Grid Card がそのまま描く。**AC-7**） |
| **既存の画面に AI ボタンを 1 つ増やす** | `ai_service_screens` に 1 行 INSERT | **触らない**（ボタンは `ai_service_screens` を読む List ブロックとして描く） |
| **新しい画面を作る** | 画面を作る ＋ `screen_key` を 1 つ増やす | 触る（**これは当然。画面が増えるのだから**） |
| **実機になった（`st=2` → `st=1`）** | `st` と `live` と `app_key_var` を UPDATE | **触らない**（「開く」が出るようになる） |

**設計の肝**：**ボタンも「コレクション駆動ブロック」で描く。** 画面に AI ボタンをハードコードしない。**§14-4 の表そのものが `ai_service_screens` の行になる。**

**呼び出し側の指針**：**サービスごとに Workflow を作らない。** **汎用ワークフロー 1 本**（入力＝`service_no` ＋ 文脈 JSON、処理＝`ai_services` を引いて `app_key_var` からキーを解決し HTTP request）にする。

> **⚠️ 不明（U11 と同型）**：**Workflow から「変数名を動的に解決して Variables and Secrets の値を取る」ことができるかはドキュメントに記載が無い。** できない場合の段階的な逃げ道：
> 1. **`ai_keys`（`service_no` → キー）を NocoBase の Variables and Secrets に JSON 1 レコードで持ち、JavaScript ノードで引く**（JS ノードは無料。Safe mode で `require` 不可だが JSON の参照はできる）
> 2. それも駄目なら **Workflow を「よく使う数本」だけ個別に持つ**（サービス追加で画面は直さないが Workflow は触る＝目的の半分は達成）
> **P0 では (a′) が 2 本なので 2 のままでも成立する。R-8 で確認し、結果を記録する。**

### 14-8. `data/world/` に足すもの（**PR-2。実装は別 PR**）

**`data/world/dept/` を新設**（第 3 の世界。§14-3 の橋渡しの正本）。

| ファイル | 内容 | 規則 |
|---|---|---|
| `company.md` | **自部門を持つ架空の日系 SIer**（社名 ja/zh/en）・中国拠点・事業内容・部門の位置づけ | **社名の案（PM が変えてよい）**：和泉テクノソリューションズ／和泉科技解决方案（上海）有限公司／Izumi Techno Solutions, Inc.。**実在企業と一致しないことを PM が確認する** |
| `org.csv` | 部門・チーム（ソリューション部の下に 3 チーム程度）。`dept_id` / `name_ja` `name_zh` `name_en` / `parent_id` | mfg / fin の部署名と重複させない |
| `people.csv` | **部員 6〜8 名**。`staff_id` / `login_key` / `name_ja` `name_zh` `name_en` / `dept_id` / `role_band`（5 区分）/ `site_id` | **既存 31 名（mfg 17・fin 14）と姓名を重複させない。** 5 ロールが最低 1 名ずついる |
| `customers.csv` | **顧客 2 社＝青嶺精工（mfg）・碧洋銀行（fin）** ＋ **見込み客の記号 2 社**（`P 社`・`Q 社`。**既存の記号 K/S/T/W/A/B/U/V/J/R・甲〜戊・己 と重複しない**） | **顧客 2 社の社名は mfg / fin の `company.md` から引く**（新しい社名を作らない） |
| `projects.csv` | **案件 10 件程度。** `project_code` / `customer` / `title_ja` `title_zh` `title_en` / `owner` / `status` / `health` / `revenue_plan` `revenue_actual` / `start_on` `due_on` | **案件名に管理番号を使う**（「青嶺精工向け `KN-01` 導入」）。**赤 1〜2 件・黄 2〜3 件**を入れて Home のデモが成立するように |
| `actions.csv` | **Action 15 件程度。** `owner` / `project_code` / `title` / `kind` / `status` / `priority` / `due_at` | **期限超過を 3〜4 件**入れる（Home と Actions のデモ） |
| `kpi.csv` | 部門 KPI（受注額・パイプライン・稼働率・赤字案件数）の基準値 | mfg / fin の `kpi.csv` と同じ書式 |
| `calendar.md` | 部門の会計年度・月次締め・**世界の「今日」** | **`fin` と同じ 2026-09-08 に揃える**（2 つの顧客世界を同時に見せるデモなので、部門側の時計を fin に合わせる。mfg の 2025-09 前後との差は「顧客ごとの時間軸」として説明できる） |

**規則（重要）**：

- **`dept/` は mfg / fin の社名・拠点を「顧客として」参照してよい唯一の世界。** 逆方向（mfg / fin から `dept/` を参照）は**しない**
- **mfg と fin を互いに混ぜる規則（`CLAUDE.md` §2-13）は変えない**
- **`tools/check-world.mjs` の走査対象には足さない**（走査対象は「語彙を使う側」であり、`data/world/` は正本側。§1-3）
- **`data/world/README.md` の表に `dept/` の節を足す**
- **新リポへは手コピー ＋ 出典行**（§6-2 の作法のまま）

---

## 15. 附録 A —— 改訂で落とした判断（**消さずに残す**）

**§1-2b の作法をそのまま適用する。** 前提が変わって本文から外れた記述を、**次に読む人が同じ問いを立てないように**ここに保存する。**取り下げたのは「いま使う場所」であって、判断そのものではない。**

### A-1. 初版 §4-4「未確認事項（**すべて未確認**。断定しない）」

初版はこの表を「設計が推測の上に乗らないため」に置いていた。**2026-09-11 の調査で一部に答えが出た**ので、本文 §4-4 は決着表に置き換えた。**初版の書きぶり（何を前提にしていて、落ちたら何が起きるか）は今も有効**なので残す。

| # | 未確認事項 | 設計の前提になっているか（初版） | 落ちたときの影響（初版） |
|---|---|---|---|
| U1 | ライセンスと価格の製品としての条件 | なっている（P1 の SSO＝PC-02） | P1 の工数と費用。P0 には影響しない |
| U2 | 対応 DB の正確な範囲とバージョン | なっている（本番インスタンスの DB 選定） | 社内 DB 標準と合わなければ運用方針の調整 |
| U3 | **定義だけを、データを除いて移送できるか** | **なっている（C1 の中核）** | §4-5 の実現手段を差し替える必要（代替 B） |
| U4 | 定義エクスポートが diff の読める形式か | なっている（reviewer の diff 監査） | 分割の自作が要る。工数増 |
| U5 | SSE（ストリーミング）を画面に出せるか | なっていない（P0 は iframe で回避） | P3 の作り方が変わる |
| U6 | iframe が URL パラメータ・認証つき埋め込みに対応するか | **なっている（P0 の AC-5）** | 利用者が Dify に別ログインする |
| U7 | カスタムプラグインの開発言語・ビルド手順 | なっていない | 「no-code」でなくなる境目が早く来る |
| U8 | 中国拠点からの到達性・日本語 UI の完成度 | なっていない（P0 は日本側のみ） | P1 以降の展開範囲 |
| U9 | **外部データソースとして DB／API に届くか** | **なっている（C1-b・AC-3）** | PC-04 のアダプタ経由に切り替える |
| U10 | 2.x 系内の破壊的変更 | なっていない（バージョン固定で回避） | 上げるときに再確認 |
| U11 | **向き先だけを差し替えられるか** | **なっている（§4-5 案 D）** | 代替 B／代替 C へ |
| U12 | Environment secret / deployment protection rules | なっていない | 設計は依存しない |
| U13 | 本番運用の推奨構成 | — | 情シスに出す構成図の根拠 |
| U14 | `plugin-backup-restore` で定義だけ運べるか | — | U3 と同じ問いを製品の機能名で聞き直したもの |

**この態度は本改訂でも変えていない**：調査レポートが「ドキュメントに記載なし」と言ったものは、**本文でも「不明」のまま**（U4・U5・U6・U11・U15〜U21）。

### A-2. 初版 §5「勤怠・研修・年休・お知らせは PC-01 `feed_items` に乗るか」（**全文**）

**取り下げたのではない。スコープ外にしただけ**（§5-6）。**P3 で `resources` を作る日に、この表がそのまま使える。**

**原則**：

> **「状態」は読み取りビュー。「あなたが何かをする必要がある」だけが `feed_items`。**

**判定表**：

| もの | `feed_items` に乗るか | 置き場 |
|---|---|---|
| 会社からのお知らせ（掲示） | **乗らない** | 新規 `announcements`（下記）。フィード面には `notify` として合流表示 |
| 年休の残日数・取得率 | **乗らない**（集計値。消化されない） | 人事システムの**読み取りビュー**（PC-04） |
| 当月の勤怠実績・残業時間 | **乗らない**（同上） | 同上 |
| 研修の受講状況・履歴 | **乗らない**（同上） | 同上 |
| 「年休の取得が基準に届いていない」 | **乗る**（`kind = notify`。期限があれば `due`） | `source_ref` ＝ 社員 ID ＋ 年度 ＋ 閾値 |
| 「研修 X の受講期限が n 日後」 | **乗る**（`kind = due`） | `source_ref` ＝ 研修 ID ＋ 社員 ID |
| 「勤怠の打刻漏れが n 件ある」 | **乗る**（`kind = due`） | `source_ref` ＝ 社員 ID ＋ 年月 |
| 「今月の工数入力が未提出」 | **乗る**（`kind = due`） | 同上 |

> **2026-09-11 の読み替え**：「乗る」と判定した 4 件は、**`actions` に `source='system'` で乗る**（器が変わっただけで判定は変わらない。§5-4）。

**`announcements`（新規）を `feed_items` に載せない理由**：

| 観点 | `feed_items` | お知らせ |
|---|---|---|
| 宛先 | `owner_id` ＝ **個人 1 人** | **全社／拠点／部署**（1 件が n 人に見える） |
| 生存期間 | `status` を `done`/`dismissed` にして**消える** | **掲載期間**の間ずっと出ている。読んでも消えない |
| 既読 | 概念が無い（`done` は「やった」） | **既読と未読**（やってはいない） |
| 履歴 | 積まない | **過去のお知らせを一覧で遡る** |

**スキーマ案（そのまま有効。P2 で使う）**：

- `announcements`：`id` ／ `title`（ja/zh/en）／ `body`（ja/zh/en。Markdown）／ `category`（`hr`/`safety`/`system`/`general`）／ `audience`（`all`/`site`/`dept`/`role`）／ `audience_ref` ／ `publish_from`・`publish_to`（**絶対日付を持つ**）／ `pinned` ／ `author_id` ／ `attachments` ／ `created_at`・`updated_at`
- `announcement_reads`：`announcement_id` ／ `user_id` ／ `read_at`（複合主キー）

**フィード面との関係**：原則は「合流表示」で行を二重に作らない。画面が 2 本のクエリを読んで 1 つの並びにする。例外は `pinned` かつ要対応のものだけ。

**PC 番号**：`PC-19 お知らせ・全社掲示ストア` として提案（PM 判断 11-2 で了承済み）。**ただし採番は `announcements` を実際に作る PR まで行わない**（§5-5）。

**勤怠・年休・研修の読み取りビュー（初版 §5-4）**：新テーブルを作らない／第 1 候補は外部データソース接続／第 2 候補は PC-04 のアダプタ／**PC-10（個人情報）が最も重く効く箇所**で、「本人の分だけ・上長は部下の分・人事は全員」の 3 層を `plugin-acl` ＋ `plugin-departments` で表現する。

### A-3. 初版 §6-2「`data/world/` に足す 4 ファイル × 2 業種」（**取り下げ**）

| ファイル | 内容 |
|---|---|
| `attendance.csv` | 勤怠の月次サマリと規則（所定労働時間・残業の上限・当月実績・打刻漏れ件数の基準値） |
| `leave.csv` | 年休の付与・取得・残 |
| `training.csv` | 研修の科目・受講期限・受講状況 |
| `announcements.csv` | 会社からのお知らせ（ja/zh/en） |

**取り下げた理由**：ドメインがスコープ外になった（§5-6）。**規則（人を増やさない／`org.csv` の id をそのまま使う／日次の時系列を正本に置かず基準値と規則だけを置く／2 つの世界の語彙を混ぜない）は `dept/` にもそのまま適用する**（§14-8）。**P3 で `resources` を作る日に、この 3 ファイルを `dept/` か `mfg`/`fin` のどちらに置くかを改めて決める。**

### A-4. 初版 §8「P0『私のページ』」と AC-1〜AC-7（**差し替え**）

**旧 P0**（3 画面・1〜2 週）：① 私のページ（お知らせ 5 件 ＋ 私の勤怠・年休・研修の 3 つの数字）② AI サービス一覧（67 件の表。実機 12 本にだけ「開く」）③ サービスを開く（Dify WebApp を iframe）。

**旧 AC → 新 AC の対応**：

| 旧 | 内容 | 新 |
|---|---|---|
| AC-1 | 定義を丸ごとエクスポートしてファイルに落とせる | **AC-1**（Migration Manager で移送）に吸収 |
| AC-2 | エクスポートに実在の語が現れない（V1 PASS） | **AC-3** |
| AC-3 | 勤怠・年休・研修が Master DB に 1 行も入っていない | **AC-2**（業務 DB に NocoBase が列を足していない）に発展 |
| AC-4 | 空の NocoBase に流し込むと同じ画面が出る | **AC-1** に統合 |
| AC-5 | Dify の iframe が開き ja/zh 両方で返る | **AC-6**（(a′) の API 呼び出しに変更。iframe は R-6） |
| AC-6 | API キー・DB パスワードがリポジトリに無い | **AC-10** |
| AC-7 | エクスポートの diff が人に読める | **AC-9** |
| — | — | **新規**：AC-4（チャート × 外部データソース）・AC-5（データスコープ）・AC-7（行を足すだけで画面に増える）・AC-8（実機が無いものを動くように見せない） |

**旧 P0 の「② AI サービス一覧・③ iframe」は生きている**（新 P0 の③④に入っている）。**落ちたのは ①「私のページ」だけ**（ドメインがスコープ外になったため）。

### A-5. 初版 §7-2 の「承認ゲートをどうするか」（**論点消滅**）

| 現リポのやり方 | public の新リポでどうなるか（初版の見立て） | 初版の判断 |
|---|---|---|
| GitHub Environment ＋ Required reviewers | public になったので制約は緩む見込み。ただし未確認（U12） | 設計を依存させない。`workflow_dispatch` の `confirm` 入力の文字列一致で代替 |
| Actions の従量 | public なので無料 | docker build を CI で回してよい |
| 秘密の置き場（Environment secret） | fork からの PR では secret が渡らない（未確認） | **P0 の CI は secret を 1 つも使わない**。本番デプロイはリポジトリの CI から行わない |

**消滅した理由**：**本番は GitLab へ移る**（§7-7）。承認ゲートの設計は**フェーズ 2 で GitLab の protected environment / manual job として改めて行う**。**「デモの CI は secret ゼロ」だけが生き残り、本文 §7-2 に残っている。**

### A-6. 初版 §4-6「代替 B（定義を手続きで持つ）」（**決着＝不要**）

> **代替 B**：NocoBase の HTTP API（`plugin-api-keys`）を使い、**コレクション定義・ロール・画面を作るスクリプト**を新リポに置き、空インスタンスに対して実行する（＝定義を宣言ではなく手続きで持つ）。Dify 側の `render.py` が「マスタ → 環境」に流し込んでいるのと同じ形。

**不要になった理由**：**U3 が決着した**（Migration Manager が公式手段）。

**ただし半分だけ生きている**：**`scripts/dump-schema.mjs`（定義を JSON に吐く読み取り専用の写し）** として使う。U4/U19（`.nbdata` の diff が読めるか）が不明なので、**reviewer の diff 監査の受け皿が要る**（§3-4・AC-9）。**書き戻しには使わない**（手で直した画面をスクリプトに書き戻す運用は Dify の Issue #3 と同型の負債になる）。

---

**（本書おわり）**
