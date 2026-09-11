# 社内向けポータルサイト（NocoBase）— リポジトリ分離と第 1 段（P0）

設計書: `docs/handoff/2026-09-10-portal-nocobase.md`（**2026-09-11 改訂**）
公式調査の記録: `docs/handoff/2026-09-11-nocobase-research.md`（**新規**。対象 v2.2.10・出典 URL つき）
レーン: **M/L** ／ ラベル: `run:cloud` ／ Issue: #242 ／ PR: #243（初版）・**本 PR（改訂）**

---

## 🔄 2026-09-11 改訂 —— 前提が 8 つ変わり、調査で 9 つ決着した

**忙しい人は設計書の §R だけ読めば分かる。**

### 変わった前提（PM 確定）

| | 初版（2026-09-10） | 改訂（2026-09-11） |
|---|---|---|
| エディション | 無料版（Community）を想定 | **Professional 前提**（AD 連携も定義移送も Professional+ と判明） |
| AI 基盤 | Dify Cloud | **デモ＝Dify Cloud（稼働 12 本）／本番＝Dify Enterprise（社内）** |
| ソース・CI | GitHub | **デモ＝GitHub／本番＝GitLab Self-Managed** |
| 業務ドメイン | 勤怠・研修・年休・お知らせ（人事系） | **顧客／案件／TODO・Action／KPI／人員リソース／会議／部門共通知識／AI** |
| Identity | 未確定 | **オンプレ AD が正本**（粗い 5 区分は AD、案件単位は NocoBase） |
| Knowledge | 言及なし | **Outline Self-Hosted**（NocoBase＝業務データ／Outline＝文書） |
| スキーマ | 未確定（中心の問い） | **方式 (B)「先に PostgreSQL で設計し NocoBase に認識させる」**（PM が選択） |
| **作る範囲** | 曖昧 | **★ いま作るのはデモ版だけ。** 本番（AD / GitLab / Outline / Dify Enterprise）は**到達点として書くが実装しない** |

### ⭐ 設計書でいちばん重要な表 = **§0-2「デモ構成と本番構成の対応表」**

**PM 構成案の AD / GitLab / Outline / Dify Enterprise はすべて「既存環境を利用」＝手元に無い。** だから層ごとに **デモで使うもの ／ 本番で置き換わるもの ／ 置き換えの境目** を書いた。**設計の眼目は「デモで作ったものが本番にそのまま移せること」**なので、4 列目が本体。

**唯一変えてはいけない層＝業務スキーマ。** DDL は Flyway の SQL で Git 管理し、デモと本番に**同じファイル**を流す（`information_schema` の diff で機械確認）。

---

## 決めたこと（設計書 §0・§4-11・§14）

| 問い | 結論 |
|---|---|
| **エディションと方式** | **デモも本番も Professional。方式は (b) 外部データソース: External PostgreSQL。** 一体で決めた（§4-11）。理由の決定打は **Standard が「自社内部利用のみ」で、顧客提示デモが利用条件を外れうる**こと |
| **定義の移送** | **Migration Manager（Professional+）**。`uiSchemas`/`roles`/`workflows` 等は Overwrite、業務テーブルは Schema-only。**外部 DB は対象外なので DDL は Flyway が担う**（これは欠点ではなく**分業の線**。NocoBase 固有と素の PostgreSQL が Git 上で目で分かれる） |
| **業務ドメイン** | `staff` / `departments` / `customers` / `projects` / `actions` / `document_links` / `ai_services` ＋ 履歴。**`actions` が PC-01 `feed_items` の役割を担う**（器を 2 つ並べない） |
| **勤怠・研修・年休** | **スコープ外。落としてはいない。** P3 の `resources`（稼働状況）に統合。**初版の判定表は §15 附録 A-2 に全文保存**（その日にそのまま使える） |
| **Outline との境界** | NocoBase＝業務データ／Outline＝文書。接点は `document_links`。**実 URL を持たず** `${PORTAL_OUTLINE_BASE}` と結合。**デモでは未接続表示** |
| **★ AI の置き方** | **1 ページに隔離しない。既定は (a′) ボタン → Workflow（同期）→ HTTP request → 結果を画面へ。** iframe は「Dify そのものを見せる」場面に限る（**ログイン引き継ぎは記載なし**なので公開 Web アプリだけ）。**画面 → 管理番号 → 実機 → 置き方 → 渡す文脈**の表は §14-4 |
| **★ サービスが増えたとき** | **画面を直さない。** `ai_services` ＋ **`ai_service_screens`**（どの画面のどこに出すかを**行で持つ**）＋ コレクション駆動ブロック。**§14-4 の表そのものがテーブルの行になる** |
| **★ 実機が無い 55 件** | **嘘をつかない。** `st`（1/2/3）をポータルでも持ち、**`st=1` かつ URL 登録済みのときだけ「開く」を出す**。他は「カタログのみ（実機なし）」＋ カタログへのリンク ＋ **3 行の説明（何と何をつなぎ／どの入力を読み／どこまで確認しているか）**（`docs/handoff/2026-09-10-expert-feedback.md` と整合） |
| **★ 架空世界の橋渡し** | **ポータルのデモ世界＝「青嶺精工と碧洋銀行を顧客に持つ、日系 SIer の中国拠点ソリューション部門」。** カタログ・Dify デモ・ポータルが**1 つの世界**でつながる。`data/world/dept/` を新設（§14-8） |
| **リポジトリ** | **分ける**（維持）。決定的な理由は R1 ランタイム境界。**R5 が追加**：将来ホストが分かれる（GitHub / GitLab） |
| **実データ 1 バイトも入らない** | **不変。** むしろ **GitLab → GitHub の全量ミラーを安全に成立させる土台**になった（フィルタが要らない）。§7-7-2 |
| **最初に作る 1 つ** | **P0「案件とアクション ＋ 画面の中の AI」**（4 画面・2〜3 週・捨てられる規模）。主目的は **AC-1（Migration Manager で定義だけ移送）** と **AC-2（NocoBase が業務 DB に触っていない）** |

---

## 調査で決着した点（設計書 §4-4。出典は調査記録に全部ある）

| 決着 | 内容 |
|---|---|
| **U3 定義だけの移送** | **できる。Migration Manager（Professional+）** |
| **U14 Backup & Restore で定義だけ** | **できない**（v1.4 で非推奨・後継はフルバックアップのみ） |
| **U9 外部 DB 接続** | **できる。External PostgreSQL（Standard+）。NocoBase は外部 DB を一切変更しないと明記** |
| **U1 ライセンス** | Community 無料 / Standard $800 / **Professional $8,000** / Enterprise 要問合せ。**SSO は Professional+**。Instance ID 単位・Lifetime |
| **U2 / U7 / U8 / U10 / U13** | 対応 DB・プラグイン開発（TypeScript）・中国での到達性（Aliyun ミラー・ja/zh UI）・2.x の非推奨 18 件・本番構成（Docker 単一コンテナで足りる） |

**依然として不明なまま残したもの（断定しない）**：U4（移送ファイルの diff）・U5（SSE）・U6（iframe の変数とログイン引き継ぎ）・U11（接続情報の変数参照）＋ **新しく見えた U15〜U21**（チャート × 外部データソース／Own records × 外部テーブル／**LDAPS の記載なし**／**AD グループ → ロールの記載なし**／`.nbdata` の中身／Custom request の実行場所／**中国から github.com に到達できるか**）。

**⚠️ 公式ページ間の不一致**：商用比較表と `docs/plugins` のバッジが食い違う（**Migration Manager** 等）。**本書は厳しい方（Professional+）で設計してある**ので、どちらが正でも壊れない。→ **Q3 で確認**。

---

## 公式へ問い合わせる 7 件（設計書 §4-10。**このリポジトリの追跡対象**）

| # | 内容 | いつ | **否だったら** |
|---|---|---|---|
| **Q1** | **Auth: LDAP の LDAPS / TLS / 証明書対応**（公式ページに語が 1 つも無い） | **購入前** | **⚠️ 最大。本番の認証設計が作り直し。** 第 1 代替＝**GitLab（AD→LDAP）を OIDC の IdP にして NocoBase を OIDC で繋ぐ**（Outline と同じ経路。OIDC も Professional+ なのでライセンスは変わらない） |
| **Q2** | 1 ライセンスでカバーできるインスタンス数（デモ＋本番） | 購入時 | **費用のみ**（$8,000 × 2） |
| **Q3** | 比較表と docs の不一致（Migration Manager のエディション） | 購入前 | **緩い方が正なら費用が下がるだけ。設計は壊れない** |
| Q4 / Q5 | 方式 (a) の列追加／UI リレーションの FK | (a) に落ちるときだけ | 影響小（(b) を採るため） |
| **Q6**（新規） | **チャートが外部データソースを引けるか** | P0（R-4 で実機確認可） | 代替 D（集計ビュー or `kpi_snapshots`） |
| **Q7**（新規） | 外部データソースの接続情報を Variables and Secrets で参照する構文 | P0（R-8） | 代替 C'（`biz` 固定） |

---

## やること（本 Issue の範囲＝現リポのみ）

| PR | 内容 | 主なファイル | 状態 |
|---|---|---|---|
| **PR-1** | 設計書の初版 | `docs/handoff/2026-09-10-portal-nocobase.md` | **マージ済み**（#243） |
| **PR-1b**（本 PR） | **設計書の改訂 ＋ 調査記録の取り込み ＋ 本 Issue 本文の更新** | `docs/handoff/2026-09-10-portal-nocobase.md`（改訂）・**`docs/handoff/2026-09-11-nocobase-research.md`（新規）**・`docs/handoff/portal-nocobase.issue.md` | 本 PR |
| **PR-2**（**差し替え**） | **`data/world/dept/` を新設**（部門の架空世界。§14-8）＋ `data/world/README.md` に追記。~~旧 PR-2（勤怠・年休・研修・お知らせの 4 CSV × 2 業種）は取り下げ~~ | `data/world/dept/*`・`data/world/README.md` | PR-1b の後 |
| **PR-3** | `docs/dify/**` の追記（§9-2 の (1)〜(5)・(7)。**(6) PC-19 の新設は保留**）＋ `README.md` 1 行 ＋ `CLAUDE.md` 1 行 | `docs/dify/platform-components.md`・`README.md`・`CLAUDE.md` | PR-1b の後 |
| **PR-4**（**新規・別 Issue**） | **実機 12 本の Dify アプリ id と公開 Web アプリ URL の登録**（`apps:` が全件 `id: null`、`LIVE` が空）。**P0 のブロッカー** | `dify/env/cloud-master/env.yml`・`mock/js/data/live.js` | **`run:mac` / `run:runner`。本 Issue に含めない** |

### 並列可否

```
PR-1b（本 PR・先行必須）
  ├── PR-2   data/world/dept/**              ┐ ファイル集合が重ならない → 並列可
  └── PR-3   docs/dify/** README.md CLAUDE.md ┘

PR-4 は別 Issue（run:* の軸が違う）。独立に着手可
```

## 触らない範囲（reviewer の diff 監査の基準）

- **`mock/**`** — 1 バイトも変えない。データ層（`CATS`/`SVCS`/`TAGS`/`SCENARIOS`/`HOME`/`FEED`/`LIVE`）も不変 → **`tools/regress.mjs --update` は不要**（PR-4 は別 Issue）
- **`tools/**`・`tools/regress.baseline.json`・`scripts/**`**
- **`dify/**`**（`apps`・`env`・`kb`・`tests`・`samples`・`state`・`results`）
- **`.github/workflows/**`** — 特に **`pages.yml` の `path: mock`**（NocoBase は常駐サーバ ＋ DB なので、そもそも Pages に載らない）
- **`.claude/**`・`CLAUDE.md`** — 本 PR では変更しない。§9-1 の 1 行追加は**提案**であり PR-3
- **`docs/dify/**` の既存記述** — PR-3 まで変更しない
- **`docs/handoff/**` の他の設計書** — 本 PR が触るのは `2026-09-10-portal-nocobase.md`（改訂）・`portal-nocobase.issue.md`（更新）・`2026-09-11-nocobase-research.md`（新規）の 3 つだけ

## 受け入れ条件（PR-1b）

- `node tools/verify.mjs` **PASS**
- `node tools/regress.mjs` **PASS**（差分ゼロ）
- 設計書が `docs/handoff/README.md` の「設計書に必ず書くこと」1〜9 を満たす
- **`docs/dify/**`・`CLAUDE.md`・`mock/**`・`tools/**`・`dify/**`・`data/**` の diff が 0 行**
- **改訂で無効になった記述が、削除ではなく「取り消し線 ＋ 2026-09-11 改訂」印か §15 附録 A に残っている**
- **実在企業名が 1 つも書かれていない**（PM 構成案の例文にあった実在金融機関名は写していない。`CLAUDE.md` §2-10）
- **調査レポートが「記載なし」と書いたものが、設計書で断定に変わっていない**

## 受け入れ条件（PR-2・差し替え後）

- 追加するのは `data/world/dept/` の 8 ファイル程度と `data/world/README.md` への追記だけ
- **`mfg`（17 名）・`fin`（14 名）の人を増やさない。** 部員は `dept/` の中だけで新規に作り、**姓名を既存 31 名と重複させない**
- **顧客 2 社の社名は `mfg`/`fin` の `company.md` から引く**（新しい社名を作らない）。見込み客の記号は**既存記号（K/S/T/W/A/B/U/V/J/R・甲〜戊・己）と重複しない**もの
- **mfg と fin を互いに混ぜない**（`CLAUDE.md` §2-13）。`dept/` が両方を顧客に持つのは可（片方向参照）
- `npm run world` の **warn 件数が増えない**
- `npm test` PASS（`mock/js/data` を触らないので regress は差分ゼロ）

## PM 判断（13 件。**⏳ が 5 件。すべて推奨つき**。設計書 §11）

| # | 論点 | architect の推奨 |
|---|---|---|
| 11-1 ✅ | V-PM-1（公式ドキュメントを読む） | **完了。** 成果物＝`docs/handoff/2026-09-11-nocobase-research.md` |
| 11-2 ⏸ | PC-19 の採番 | **P2 へ後ろ倒し。** 使わない PC 番号を先に切らない |
| **11-3** ⏳ | Dify の `user` に社員 ID か仮名か | **仮名。** AD の識別子は GitLab・Outline と共通で、**1 つ漏れると横に繋がる**（理由が 1 つ増えた） |
| 11-4 ✅ | NocoBase の AI 機能を使わない | **維持**（Dify を LLM サービスとして登録する記載も無い） |
| 11-5 ✅ | 新リポ `shoulang0729/portal`・public | **維持**（フェーズ 2 でも GitHub 側はミラーとして public のまま） |
| 11-6 ✅ | §9-1・§9-2 の追記 | **適用。ただし内容を差し替えた**（PC-19 だけ保留） |
| 11-7 🔄 | `data/world/` に足すもの | **内容が変わった。** 勤怠 4 CSV → **`data/world/dept/`** |
| 11-8 ✅ | P0 をどこで動かすか | **PM のローカル docker。ただし 2 台**（移送元と移送先） |
| **11-9** ⏳ **ブロッカー** | **NocoBase Professional を買うか** | **買う。$8,000（¥50,000）・一括・Lifetime。** ① P0 の主目的が Migration Manager ② 本番の AD 連携でどのみち要る ③ **Standard は自社内部利用のみで顧客提示デモが条件を外れうる**。**Q1・Q2・Q3 を同時に問い合わせる** |
| **11-10** ⏳ | **中国拠点から `github.com` に到達できるか** | 情シスに確認。**否なら GitLab に片方向ミラー**（正本は動かさない）。P1 着手前まででよい |
| **11-11** ⏳ | **AD の 5 区分は OU か、セキュリティグループか** | 情シスに確認。**OU なら記載どおり繋がる。グループなら補完設計が要る**（公式に手段の記載なし）。P1 着手前まででよい |
| **11-12** ⏳ | **勤怠・研修・年休をスコープ外にしてよいか** | **スコープ外にする。ただし落とさない**（P3 の `resources` に統合。初版の設計は附録 A-2 に保存） |
| **11-13** ⏳ | **デモ世界を「青嶺精工・碧洋銀行を顧客に持つ日系 SIer 部門」として作ってよいか** | **作る。** カタログ・Dify デモ・ポータルが 1 つの架空世界でつながる（顧客提示として強い） |

## P0 のブロッカー（2 件）

1. **NocoBase Professional の購入**（11-9）
2. **実機 12 本の Dify アプリ id と公開 Web アプリ URL の登録**（PR-4・別 Issue）。**いまは `apps:` が全件 `id: null`、`LIVE` が `{}`** なので、(a′) も (b) も動かせない

## 本 Issue に含めないもの

**新リポ `shoulang0729/portal` の作業（PR-A2 / PR-B / PR-C / PR-D）は含めない。** `CLAUDE.md` §7 の `run:*` は 1 つだけで、ポータルの実行場所は軸が違う。新リポで独自のラベル体系を定義する（設計書 §7-3・§12-2）。

**PR-4（Dify の app id / URL 登録）も含めない**（`run:mac` / `run:runner`）。

`npm run export:catalog`／`export:world` も**今回は作らない**（手コピーが 3 回以上ずれたら着手）。
