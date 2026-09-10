# 社内向けポータルサイト（NocoBase）— リポジトリ分離と第 1 段（P0）

設計書: `docs/handoff/2026-09-10-portal-nocobase.md`
レーン: **M/L** ／ ラベル: `run:cloud` ／ Issue: #242 ／ PR: #243

## 背景

PM の要望：**社内向けポータルを NocoBase で作り、裏に Dify、さらに各種経営管理システム・ダッシュボード・勤怠／研修／年休の取得状況・会社からのお知らせを載せる。**

これは新規のアイデアではない。`docs/dify/platform-components.md` の **PC-16 本番 UI (b) 自前フロント**（先行順 18 番・工数感 L）が要件として既にあり、**PC-01 フィードストア**（`feed_items` ＋ REST）と **PC-02 認証・ロール**（SSO → 社員 ID・部署 → 権限は前段で判定）がその土台として設計されている。**NocoBase は (b) の実装手段**（PM 確定）。

PM 確定事項（2026-09-10）：**用途は「顧客提示デモ」と「実運用の社内システム」の両方**／**最初から実データで作る**／**リポジトリは分離・private**。

## 決めたこと（設計書 §0）

| 問い | 結論 |
|---|---|
| リポジトリ | **分ける。新リポ `shoulang0729/portal`（private）。** 現リポからは 1 バイトも移さない |
| 位置づけ | **別製品ではなく「同じ製品の別デプロイ単位」**。PC-16 (b) の実装 ＋ AI でない社内情報の面 |
| 実データと顧客提示の両立 | **同じ定義・2 インスタンス（案 C）＋ 外部データソースの向き先を変える（案 D）**。同一インスタンス内のテナント分離（案 A）は**採らない**（`plugin-multi-app-manager` の説明に「本番では使うな」と配布者が明記） |
| 最初の制約 **C1** | **定義（画面・スキーマ・ロール・WF）をデータと別の器に置き、空インスタンスへ流し込める形で持つ。** 実データで作り始める日から C1-a／C1-b／C1-c を守る |
| 勤怠・年休・研修 | **PC-01 `feed_items` に乗らない**。人事・勤怠システムの**読み取りビュー**（PC-04）。`feed_items` に乗るのは「**あなたが何かをする必要がある**」だけ（`source` に `hr` を足す 1 点のみ） |
| 会社からのお知らせ | **`feed_items` に乗らない**。**新規 `announcements`**（掲載期間・全社宛・既読）。フィード面には `notify` として合流表示 |
| `data/world/` | **足す**（正本は現リポ・§2-13 を曲げない）。勤怠・年休・研修・お知らせの 4 種を `mfg`／`fin` 両方に。**日次の時系列は正本に置かず、規則と基準値だけ** |
| 共有の仕組み | **最初は作らない。手コピー ＋ 出典行。** 方向は**現リポ → 新リポの片方向のみ**（逆流禁止） |
| マスキング | **採らない**（漏れを機械で確かめられない／伏せても営業秘密が残る／説明が事故る） |
| 最初に作る 1 つ | **P0「私のページ」**（3 画面・実データ・SSO 無し・チャット UI を作らず Dify WebApp を iframe）。**主目的は AC-1／AC-4＝定義を移送できるかの実機確認** |

## ⚠️ PM に 1 つだけお願いがあります（V-PM-1・設計書 §4-7）

**本環境から `nocobase.com`・`docs.nocobase.com`・`github.com/nocobase/nocobase` のいずれにも到達できません**（agent proxy が CONNECT に 403）。したがって**公式ドキュメントは一切読めていません**。設計書の「確実に言えること」は **npm レジストリのパッケージメタデータだけ**を根拠にしています。

**PM がブラウザで 30 分読むだけで、設計が 4 つ確定します：**

1. **U1** ライセンスと価格の条件（**SSO／OIDC が無償側にあるか**）
2. **U2** 対応 DB の範囲
3. **U9** 外部データソースとして接続できる DB の一覧（`plugin-data-source-external-*` は npm に存在しない＝ 404）
4. **U3／U4** 定義（画面・コレクション）の移送・エクスポートに公式手順があるか

**見出しの有無だけで十分です。「無い」と分かるだけでも設計が 1 つ確定します。**「作ってから違うと分かる」より安い、というのが本 Issue の立場です。

## やること（本 Issue の範囲＝現リポのみ）

| PR | 内容 | 主なファイル |
|---|---|---|
| **PR-1** | **設計書のみ。** コード変更なし | `docs/handoff/2026-09-10-portal-nocobase.md`・`docs/handoff/portal-nocobase.issue.md` |
| **PR-2** | `data/world/` にポータル用の架空データを追加（設計書 §6-2） | `data/world/mfg/{attendance,leave,training,announcements}.csv`・`data/world/fin/` 同 4 本・`data/world/README.md` |
| **PR-3** | `docs/dify/**` の追記（§9-2 の 6 点）＋ `README.md` 1 行（§9-5）＋ PM 承認があれば `CLAUDE.md` 1 行（§9-1） | `docs/dify/platform-components.md`・`README.md`・（`CLAUDE.md`） |

### 並列可否

```
PR-1（本 PR・先行必須）
  ├── PR-2   data/world/**            ┐ ファイル集合が重ならない → 並列可
  └── PR-3   docs/dify/** README.md   ┘ ただし PR-3 は PM 判断待ち（下記 11-1／11-2／11-6）
```

## 触らない範囲（reviewer の diff 監査の基準）

- **`mock/**`** — 1 バイトも変えない。データ層（`CATS`/`SVCS`/`TAGS`/`SCENARIOS`/`HOME`/`FEED`/`LIVE`）も不変 → **`tools/regress.mjs --update` は不要**
- **`tools/**`・`tools/regress.baseline.json`・`scripts/**`**
- **`dify/**`**（`apps`・`env`・`kb`・`tests`・`samples`・`state`・`results`）
- **`.github/workflows/**`** — 特に **`pages.yml` の `path: mock`**（`CLAUDE.md` §2-8）。**NocoBase は常駐サーバ ＋ DB なので、そもそも GitHub Pages に載らない**（private 化と Pages の話は論点にならない）
- **`.claude/**`・`CLAUDE.md`** — 本 Issue では変更しない。§9-1 の 1 行追加は**提案**であり PM 承認事項
- **`docs/dify/**` の既存記述** — PR-3（PM 承認後）まで変更しない
- **`docs/handoff/**` の既存設計書** — 新規追加のみ

## 受け入れ条件（PR-1）

- `node tools/verify.mjs` **PASS**
- `node tools/regress.mjs` **PASS**（差分ゼロ）
- 設計書が `docs/handoff/README.md` の「設計書に必ず書くこと」1〜9 を満たす
- **`docs/dify/**`・`CLAUDE.md`・`mock/**`・`tools/**`・`dify/**` の diff が 0 行**

## 受け入れ条件（PR-2）

- 追加するのは `data/world/{mfg,fin}/` の 4 ファイル ×2 と `data/world/README.md` の表だけ
- **人を増やさない**（既存 `people.csv` の 17 名／14 名にだけ紐づける）。部署・拠点は `org.csv` の id をそのまま使う
- **2 つの世界の語彙を混ぜない**（`CLAUDE.md` §2-13）
- `npm run world` の **warn 件数が増えない**
- `npm test` PASS（`mock/js/data` を触らないので regress は差分ゼロ）

## PM 判断待ち（設計書 §11）

| # | 論点 | architect の推奨 |
|---|---|---|
| 11-1 | **V-PM-1 をやるか**（上の「PM に 1 つだけお願い」） | **やる。P0 着手前** |
| 11-2 | `PC-19 お知らせ・全社掲示ストア` を採番してよいか | **採番する。** ただし `platform-components.md` は「ID と名称は固定」と宣言しているので PM 承認が要る |
| 11-3 | Dify の `user` に社員 ID を素通しするか、仮名にするか | **仮名 ＋ ポータル側で逆引き**（PC-09 の Langfuse トレースにも残るため。PC-02 の記述に触れるので PM 判断） |
| 11-4 | NocoBase の AI 機能（`plugin-ai`）を使わない、を確定してよいか | **使わない。** AI の正本は Dify（67 サービスの資産がすべて Dify 側にある） |
| 11-5 | 新リポの名前 | `shoulang0729/portal`（**private**。public 化しない前提） |
| 11-6 | §9-1・§9-2 の追記を PR-3 で適用してよいか | **適用**（11-2 の判断待ちの (6) を除く） |
| 11-7 | `data/world/` に足す 4 ファイルの粒度 | **月次サマリと規則のみ。** 日次は新リポの生成器 |
| 11-8 | P0 をどこで動かすか | **まず PM のローカル docker**（捨てられる）。AC-3（人事 DB への読み取り）だけ社内で |

## 本 Issue に含めないもの

**新リポ `shoulang0729/portal` の作業（PR-A／PR-B／PR-C）は含めない。** `CLAUDE.md` §7 の `run:*` は 1 つだけで、ポータルの実行場所は軸が違う（クラウド／ポータルのサーバ）。新リポで独自のラベル体系を定義する（設計書 §7-3・§12-2）。

`npm run export:catalog`／`export:world` も**今回は作らない**（手コピーが 3 回以上ずれたら着手。設計書 §12-3）。
