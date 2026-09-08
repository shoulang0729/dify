# Dify Cloud への「ブラウザ不要」投入経路（Console API）＋ Playwright MCP 代替

- 日付：2026-09-08
- 種別：M/L（`scripts/**`・`dify/env/**`・`tools/verify.mjs`・`dify/DEPLOY.md` に触る）
- 関連：`docs/handoff/2026-09-07-repo-layout-v2.md` §4-4・§4-5・§5-1／`dify/DEPLOY.md` §1・§5／`CLAUDE.md` §2-10・§2-12／Issue #82（Cloud 実装）・#84（構成 v2）・#98（第 2 弾 10 件）・#3（export 方向）
- 前提の環境：**この砂箱からは `api.dify.ai` / `cloud.dify.ai` に到達できない**。ネットワークを呼ぶ検証はすべて PM の Mac（実機確認）に回す。implementer が回せるのは `scripts/dify/tests/mock_server.py` を使ったループバック往復のみ

---

## 0. 目的

**「第 2 弾 10 件を、人がブラウザを触らずに Cloud へ投入・公開できる」状態にする。**

いま困っていること：

- `dify/DEPLOY.md` §1 と `.claude/commands/dify-deploy.md` は、Cloud への投入・公開・KB 紐づけを **Claude in Chrome の画面操作**に固定している
- VS Code 拡張の Claude Code には Claude in Chrome が無い → **人が手で 12 回同じ画面操作をする**（PM：「めんどい」）
- `release.py` の cloud 経路は `IMPORT.md` を出して**必ず止まる**（設計 §4-4 の「Cloud は自動 import しない」）。第 2 弾 10 件ではこの停止がボトルネックになる

終わりの状態（この設計が満たされたら完了）：

1. `python3 scripts/dify/cloud_deploy.py --env cloud-master --all` の 1 コマンドで、12 本の DSL が Cloud に**新規または上書き**でインポートされ、公開まで進む
2. 同じコマンドを 2 回叩いてもアプリが二重に増えない（冪等）
3. トークン・API キーの値が、ログ・結果ファイル・Issue・リポジトリに**一度も出ない**
4. Claude in Chrome が無い環境でも、代替（Playwright MCP）で同じ画面操作ができる手順が `DEPLOY.md` にある
5. `release.py --env cloud-master` の import 段が、この経路を使って**止まらずに**先（KB・テスト）へ進める

**非目標**：export 方向（Dify → git の自動取得。Issue #3 に残す。`sync_back.py` の手動経路は変えない）／セルフホスト経路の挙動変更（`inhouse`・`customer-a` は今のまま email/password ログイン）／`mock/**`・`data/world/**`・DSL 本体（`dify/apps/*.yml`）の変更／モデル・プロンプトの変更。

---

## 1. 事実と「確認要」

### 1-1. 確認済みの事実

| # | 事実 | 出所 |
|---|---|---|
| F1 | Service API（`https://api.dify.ai/v1`）は独自 User-Agent（`scripts/dify/run_tests.py` の `USER_AGENT = "dify-scripts/1.0 (+https://github.com/shoulang0729/dify)"`）で Cloudflare の error 1010 を回避できる | #96・`run_tests.py` L57・`kb_upload.py` L51 |
| F2 | Cloud の UI で「既存アプリへの DSL 上書きインポート」ができ、**アプリ id・API キーは変わらない** | 2026-09-08 実機確認（`DEPLOY.md` §1-④） |
| F3 | `render.py` の R5 は `knowledge.<管理番号>.id` を knowledge-retrieval ノードの `dataset_ids` に流し込む。`id` が `null` / `${VAR}` 未定義なら「未解決」として `dataset_ids` を触らない（`--strict` でも exit 1 にしない） | `render.py` L107-128・L280-300 |
| F4 | `dify/env/cloud-master/env.yml` の `knowledge.*.id` は現在すべて `null`（KB は UI で作る運用） | `env.yml` |
| F5 | `scripts/dify/console_api.py` は **email / password ログイン**（`POST /console/api/login`）＋ `apps/imports` ＋ `apps?page=` ＋ `workflows/publish` を実装済み。ただし**独自 UA を送っていない**（`_req` の headers は `Authorization` と `Content-Type` のみ）。エンドポイント形は「1.15.x で確認要」と自ら明記している | `console_api.py` |
| F6 | `release.py` は `edition: cloud` のとき `IMPORT.md` を書いて `return 0` で止まる。selfhost のときだけ `console_api.login_from_env` → `import_and_publish` を呼ぶ | `release.py` L520 付近 |
| F7 | `mock_server.py` は既に `/console/api/login`・`/console/api/apps/imports`・`GET /console/api/apps`・`/console/api/apps/{id}/workflows/publish` を返す | `mock_server.py` |
| F8 | `tools/verify.mjs` §12 の env スキーマ検査は**必須キーの存在だけ**を見る（`REQUIRED_TOP = schema,name,description,dify,models,knowledge,brand,flags,variables`）。**未知のトップレベルキーは失敗にならない** | `verify.mjs` L566-590 |
| F9 | verify §12-b の秘密検出は `sk-…` と `\b[0-9a-fA-F]{32,}\b` / `\b[A-Za-z0-9+]{32,}={0,2}\b`。**UUID（`xxxxxxxx-xxxx-…`）はハイフンで語境界が切れるためヒットしない**。`${` を含む行は 16 進検査から除外される。生 URL は cloud-master のみ `https://api.dify.ai/v1` と `https://cloud.dify.ai` を許可 | `verify.mjs` L573-624 |
| F10 | `render.py` は env.yml の `dify` / `models` / `brand` / `variables` / `knowledge` / `flags` / `schema` / `name` しか読まない。**未知のトップレベルキー（`apps:`）は無視される** | `render.py` `expand_env` |
| F11 | `kb_upload.py` は作成・再利用した dataset の id をログに出す（`KB を作成: id=...`） | `kb_upload.py` L238・L256 |
| F12 | この砂箱から `api.dify.ai` / `cloud.dify.ai` には到達できない。Mac からは到達できる | 本セッションで確認 |

### 1-2. 確認要（**推測であり、実機で 1 回ずつ確かめるまで確定させない**）

| # | 推測している内容 | なぜ確定できないか | 確認手順（§1-3） |
|---|---|---|---|
| **C1** | Cloud の Console API に **`Authorization: Bearer <console_token>`（localStorage の `console_token`）で認証が通る** | 一般知識。Cloud は Cloudflare・CSRF・追加ヘッダを挟んでいる可能性がある | N1 |
| **C2** | `POST /console/api/apps/imports`（body `{"mode":"yaml-content","yaml_content":...}`、既存上書きは `"app_id"` 併記）が Cloud の版でも同じ形 | Dify 1.x のソース由来の一般知識。Cloud の版番号は不明 | N2 |
| **C3** | 応答 `status` が `pending` / `pending_variable` のとき `POST /console/api/apps/imports/{import_id}/confirm` で確定する | 同上。実際に pending が返る条件（`version: 0.6.0` の差など）も不明 | N2 |
| **C4** | 公開は Chatflow / Workflow とも `POST /console/api/apps/{app_id}/workflows/publish` | 同上。チャットボット（非 workflow）系は別エンドポイントの可能性 | N3 |
| **C5** | 下書きの取得・更新は `GET /console/api/apps/{app_id}/workflows/draft` / `POST …/draft`（body に `graph`・`features`・`environment_variables` 等） | 同上 | N4 |
| **C6** | **`dataset_ids` を入れた DSL をインポートすれば、UI での KB 紐づけが不要になる**（＝ C5 の draft 書き換えが要らない） | Dify がインポート時に dataset_ids を検証し、存在しない／権限が無い id を落とす実装がある可能性。DI-012 のように UI 側が値を上書きする可能性もある | N5 |
| **C7** | Service API キーは `GET/POST /console/api/apps/{app_id}/api-keys` で一覧・発行でき、**発行時の応答に平文の token が入る**（一覧は伏字の可能性） | 一般知識。Cloud の版で応答形が違うと、キーが取れない／逆に一覧で平文が漏れる | N6 |
| **C8** | Cloudflare は Console API でも Python 標準 UA を弾く（＝ F1 と同じ UA 対策が要る） | Service API では実測済みだが、Console API のホスト（`cloud.dify.ai`）は別配信の可能性 | N1 |
| **C9** | `console_token` の有効期限（数時間〜数日）。切れたら 401 が返る | 一般知識。Cloud の設定値は不明 | N1（時間をおいて 2 回） |

> **implementer への指示**：C1〜C9 は**コードのコメントにも「確認要」と明記して実装する**。応答形が違ったときに直す場所が `console_api.py` の 1 ファイルで済むよう、HTTP 呼び出しをそこから外に出さない（既存の設計方針＝ `DEPLOY.md` §5 末尾を踏襲）。

### 1-3. 実機での確認手順（PM が Mac で 1 回だけ行う。所要 10 分程度）

Chrome で `https://cloud.dify.ai` にログインした状態で、**開発者ツール → Network タブ**を開き、UI を 1 操作するたびに実リクエストを 1 本ずつ写す。**写すのはメソッド・パス・リクエスト body のキー名・レスポンスのキー名だけ**。Authorization ヘッダの値・API キー・token の値は写さない（`CLAUDE.md` §2-10）。

| # | UI の操作 | 見るリクエスト | 記録すること |
|---|---|---|---|
| **N1** | ページを再読み込みする（`GET /console/api/apps` などが飛ぶ） | 任意の `console/api/*` | ① `Authorization` ヘッダが `Bearer` 形式か ② 他に必須の独自ヘッダ（`X-…`）が付いているか ③ Cookie に依存していそうか。あわせて **Application → Local Storage → `console_token`** の**キー名が存在すること**（値は見るだけでコピー先は `~/.config/dify/cloud-master.env` のみ） |
| **N2** | アプリ一覧 →「アプリを作成 → DSL ファイルをインポート」で 1 本インポート。続けて既存アプリの「…」→「DSL をインポート」→ 上書き | `POST …/apps/imports` | パス・body のキー名（`mode` / `yaml_content` / `app_id` の有無）・レスポンスのキー名（`id` / `status` / `app_id` / `app_mode` / `error`）・**`status` に何が入ったか**。pending が出たら続く `confirm` の有無 |
| **N3** | そのアプリの右上「公開」 | `POST …/workflows/publish` | パス・body・レスポンス |
| **N4** | ノードを 1 つ動かして自動保存させる | `POST …/workflows/draft` | パス・body のトップレベルキー名。あわせて `GET …/workflows/draft` の応答トップレベルキー名 |
| **N5** | **`dataset_ids` を入れた DSL を 1 本インポートし、知識検索ノードを開く** | （画面確認） | KB が最初から紐づいているか／空か。紐づいていれば **C6 は真**＝ draft 書き換え経路は不要 |
| **N6** | 「API アクセス」→ API キーを 1 つ発行 | `GET/POST …/api-keys` | パス・レスポンスのキー名（`token` が平文か伏字か）。**値は写さない** |

結果は Issue にコメント（**値は貼らない**）。C1〜C9 の真偽が確定したら、`console_api.py` のコメントから「確認要」を外す PR を別に立てる。

---

## 2. 経路の設計

### 2-1. 全体フロー

```
  ~/.config/dify/cloud-master.env       dify/env/cloud-master/env.yml
   DIFY_CONSOLE_TOKEN=…（人が 1 回貼る）   apps.<番号>.id / knowledge.<番号>.id
   DIFY_CONSOLE_URL=https://cloud.dify.ai        │
   DIFY_DATASET_ID_KN01=…（KB 作成後）           │
            │                                    │
            └────────────┬───────────────────────┘
                         v
        ┌──────────────────────────────────────────────────────────┐
        │ scripts/dify/cloud_deploy.py --env cloud-master --all     │
        ├──────────────────────────────────────────────────────────┤
        │ 0 preflight   env.yml / PyYAML / DIFY_CONSOLE_TOKEN の有無 │  → 未設定なら exit 2
        │               （値は出さない。"set"/"unset" だけ表示）      │
        │ 1 render      render.py --env <env> --strict <番号...>     │  → dify/build/<env>/*.yml
        │               （knowledge.*.id が解決していれば            │
        │                dataset_ids が焼き込まれる＝R5）            │
        │ 2 resolve     app_id を決める（§2-2 の優先順）             │
        │ 3 import      POST /console/api/apps/imports               │  → 401 なら exit 3（§2-4）
        │                 mode: yaml-content, yaml_content: <本文>   │
        │                 app_id: <既存なら>  ← これが上書き（F2）    │
        │ 4 confirm     status が pending 系なら                     │
        │                 POST …/imports/{id}/confirm                │
        │ 5 kb          --bind-kb draft のときだけ                   │  ← 既定 dsl（何もしない）
        │                 GET/POST …/workflows/draft で dataset_ids  │
        │ 6 publish     POST …/apps/{app_id}/workflows/publish       │  ← --no-publish で飛ばす
        │ 7 report      番号 → app_id の表を表示                     │
        │               env.yml 書き戻し用の断片を stdout に出す       │
        │               （--write-env のときだけファイルを書く）      │
        └──────────────────────────────────────────────────────────┘
                         │
                         v
        kb_upload.py --env <env> <番号>      （KB がある番号だけ。既存のまま）
        run_tests.py --env <env> <番号...>   （既存のまま）
```

### 2-2. app_id の決め方（冪等性の核）

**同じ番号を 2 回投入してもアプリが増えないこと**が要件。次の優先順で 1 つに決める。

| 優先 | 決め方 | 挙動 |
|---|---|---|
| 1 | CLI `--app-id KN-01=<id>` | その id へ上書き |
| 2 | `dify/env/<env>/env.yml` の `apps.<番号>.id`（`${VAR}` は展開。未解決は「無し」扱い） | その id へ上書き |
| 3 | 名前一致：`GET /console/api/apps` を全ページ取り、レンダ済み DSL の `app.name` と**完全一致**するものを探す | 1 件ヒット → その id へ上書き（採用した id をログに出す）<br>2 件以上 → **exit 1 で停止**（どれに上書きすべきか機械では決められない）<br>0 件 → 4 へ |
| 4 | 新規作成（`app_id` を送らない） | 応答の `app_id` を採用し、**書き戻し断片**を出す |

- 優先 3 は `--no-adopt-by-name` で無効化できる（無効時は 4 に落ちる＝必ず新規作成）。既定は**有効**（既存 `console_api.import_and_publish` の挙動と同じ。名前が同じアプリを増やさない方が事故が少ない）
- **`app_id` を送る上書きは「アプリ id・API キーが変わらない」**（F2）。したがって、一度 env.yml に id を書けば、以後は何度流しても同じアプリが更新されるだけ
- 公開（`publish`）は毎回新しい公開バージョンを作るが、アプリは増えない＝冪等の観点では無害

### 2-3. KB 紐づけの二択（既定は「DSL に焼き込む」）

| 経路 | 内容 | 前提 | 採否 |
|---|---|---|---|
| **A（既定）`--bind-kb dsl`** | env.yml の `knowledge.<番号>.id` を解決した状態で render → `dataset_ids` 入りの DSL をインポート（R5、F3） | **C6 が真であること**。dataset id は `kb_upload.py` のログ（F11）か Cloud の KB 画面 URL から取り、`DIFY_DATASET_ID_<番号>` に入れる | **推奨**。追加の API を叩かない |
| **B（代替）`--bind-kb draft`** | インポート後に `GET …/workflows/draft` → graph 内の `knowledge-retrieval` ノードの `dataset_ids` を差し替え → `POST …/workflows/draft` → publish | **C5 が真であること** | C6 が偽（N5 で KB が空だった）と分かったときだけ使う |
| **C `--bind-kb none`** | 何もしない（UI で紐づける従来運用） | — | 逃げ道として残す |

> **DI-012 との関係**：UI で KB を紐づけると Rerank が強制 ON になる既知事象がある。経路 A（インポート時に `dataset_ids` が入っている）で Rerank がどうなるかは**未確認**。N5 のとき「検索設定」の Rerank 状態も一緒に見て、Issue にコメントする。**cloud-master は Rerank ON を許容する方針が採択済み**（`docs/handoff/2026-09-08-thinking-budget-and-streaming.md` §4）なので、どちらでも止めない。

### 2-4. 失敗時の分岐

| 症状 | 判定 | スクリプトの振る舞い | exit |
|---|---|---|---|
| `DIFY_CONSOLE_TOKEN` 未設定 | preflight | 「§0 の手順でブラウザからトークンを取り、`~/.config/dify/<env>.env` に入れてください」＋ 取得手順の 4 行を表示。**値は一切表示しない** | 2 |
| HTTP 401 / 403 かつ本文に `unauthorized` / `token` | 認証 | 「トークンが期限切れです。ブラウザから取り直してください」＋ 取得手順を表示して**その場で止まる**（以降の番号に進まない） | 3 |
| HTTP 403 かつ本文に `error code: 1010` | Cloudflare | 「User-Agent が拒否されました。`USER_AGENT` 定数を確認してください」（キーは無関係と明記） | 3 |
| HTTP 404 / 405（`/console/api/apps/imports`） | エンドポイント差異 | 「Cloud の版で API 形が違う可能性。設計書 §1-3 N2 の手順で実リクエストを確認してください」＋ ステータスと本文先頭 500 字 | 1 |
| 応答 `status: failed` | インポート失敗 | `error` をそのまま表示（DSL 側の問題。`python3 dify/check.py` を案内） | 1 |
| `confirm` 後も pending | 未解決 | 「手動インポートに切り替えてください」＋ `IMPORT.md` の場所 | 1 |
| publish が 4xx | 公開失敗 | **import は成功しているので app_id を必ず表示**（次回実行が上書きになる）。`--no-publish` で再実行できる旨を案内 | 1 |
| 接続不可（`URLError`） | 到達不可 | 「この環境から `cloud.dify.ai` に到達できません（砂箱では実行しない）」 | 2 |
| 複数番号中 1 本が失敗 | — | **残りは続行**し、最後に「成功 n / 失敗 m」の表を出す（`--stop-on-error` で先頭失敗時に中断） | 1 |

**ログに出さないもの**：`DIFY_CONSOLE_TOKEN` の値・`Authorization` ヘッダ全体・API キーの値・`~/.config/dify/*` の中身。有無の表示は既存作法（`${VAR:+set}`）に揃え、`DIFY_CONSOLE_TOKEN: set` の形にする。エラー本文を出すときも、本文中に `Bearer ` で始まる文字列や `app-[A-Za-z0-9]{20,}` があれば `***` に置換してから出す。

---

## 3. env スキーマの拡張

### 3-1. `apps:`（新設。トップレベル）

```yaml
apps:
  KN-01: { id: null }        # Cloud のアプリ id。null = 未投入（初回は新規作成される）
  DC-01: { id: null }
```

- **キーは管理番号**（`dify/apps/<番号>-*.yml` と 1:1）。`id` は Cloud のアプリ UUID、`${VAR}`、または `null`
- **cloud-master には実 id を書いてよい**（PM 判断済み。アプリ id は URL に出るもので秘密ではない。アクセスには認証が要る）
- **顧客・社内 env は `${DIFY_APP_ID_<番号ハイフン無し>}`**（`CLAUDE.md` §2-10：顧客環境の値はリポジトリに書かない）
- **本設計書では cloud-master も `null` を置く**。KN-01・DC-01 の実 id は PM が Cloud で確認して入れる（§12 P1）

### 3-2. 変更前後（件数と id 一覧）

**`dify/env/cloud-master/env.yml`**

| | 変更前 | 変更後 |
|---|---|---|
| トップレベルキー | 9（`schema` `name` `description` `dify` `models` `knowledge` `brand` `flags` `variables`） | **10**（`apps` を追加） |
| `apps` の件数 | — | **12** |
| `apps` の id 一覧 | — | `KN-01: null` `KN-02: null` `KN-03: null` `DC-01: null` `DC-02: null` `DC-04: null` `GN-01: null` `GN-02: null` `GN-05: null` `LG-01: null` `LG-04: null` `NM-03: null`（＝ `dify/apps/*.yml` の 12 本と完全一致） |
| `knowledge.*.id` | `KN-01: null` `KN-02: null` `KN-03: null` `GN-01: null` | `KN-01: '${DIFY_DATASET_ID_KN01}'` `KN-02: '${DIFY_DATASET_ID_KN02}'` `KN-03: '${DIFY_DATASET_ID_KN03}'` `GN-01: '${DIFY_DATASET_ID_GN01}'`（**件数 4 は不変**。`customer-a` と同じ書き方に揃える） |

**`dify/env/inhouse/env.yml` / `dify/env/customer-a/env.yml`**

| | 変更前 | 変更後 |
|---|---|---|
| トップレベルキー | 9 | **10**（`apps` を追加） |
| `apps` の件数 | — | **12**（`KN-01`〜`NM-03`。値はすべて `{ id: '${DIFY_APP_ID_<番号ハイフン無し>}' }`） |

`dify/apps/*.yml` そのもの（DSL 12 本）は**1 バイトも変えない**。

### 3-3. 既存ツールへの影響

| ツール | 影響 | 対応 |
|---|---|---|
| `render.py` | **なし**。`expand_env` は既知キーしか読まない（F10）。`apps:` は無視される | 変更しない |
| `render.py --env cloud-master --all --check`（§2-12 の load-bearing 検査） | **注意あり**。`knowledge.*.id` を `${DIFY_DATASET_ID_*}` にすると、**その環境変数が設定された shell で `--check` を回したとき**に `dataset_ids` が焼き込まれ、マスタとバイト不一致になる。変数が未設定なら従来どおり「未解決」で恒等（F3） | **`--check` は素の環境（変数を source していない shell・CI と同じ状態）で実行する**旨を `dify/env/README.md` と `DEPLOY.md` §6 に 1 行書く。CI（`verify.mjs` §12-d）は変数を持たないので**従来どおり PASS** |
| `verify.mjs` §12 | 現状は未知キーを見ないので**そのままでも FAIL しない**（F8）。UUID も秘密検出に掛からない（F9） | **§12-e を追加**（次項） |
| `regress.mjs` | **影響なし**（`mock/js/data/**` のみが対象） | 変更しない |
| `kb_upload.py` | **なし** | 変更しない |
| `sync_back.py` | **なし**（env.yml の `apps` を読まない） | 変更しない |
| `release.py` | §5 で拡張 | — |

### 3-4. `verify.mjs` §12-e（追加する検査）

```
12-e. dify/env/**/env.yml の apps:
  - 3 環境すべてに apps: がある（REQUIRED_TOP に 'apps' を足す）
  - apps の子キーが /^[A-Z]{2}-\d{2}$/ で、dify/apps/<番号>-*.yml が実在する
  - dify/apps/*.yml の 12 本すべてが apps: に載っている（過不足を FAIL）
  - 各エントリの id が null / ${VAR} / UUID 形（/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/）のいずれか
  - cloud-master 以外の env では id が null または ${VAR} のみ（生 UUID は FAIL＝顧客環境の値をリポジトリに書かせない）
```

`schema: 1` は据え置く（`verify.mjs` の `^schema:\s*1$` 検査を変えない）。**必須キーを 1 つ増やすのはスキーマ変更**なので §12 P2 で PM 判断を仰ぐ（推奨：足す。3 環境同時に書くので即座に FAIL は出ない）。

---

## 4. スクリプト仕様

### 4-1. どこに書くか（既存を壊さない分け方）

| ファイル | 役割 | 変更の性質 |
|---|---|---|
| `scripts/dify/console_api.py` | **HTTP をここだけに閉じ込める**（既存方針）。トークン認証・独自 UA・新メソッドを**追加**する。既存の `login()` / `import_dsl()` / `list_apps()` / `publish()` / `login_from_env()` / `import_and_publish()` の**シグネチャと戻り値は変えない**（`release.py` の selfhost 経路が現状のまま動くこと） | 追加のみ |
| `scripts/dify/cloud_deploy.py` | **新設**。CLI・env.yml 読み・render 呼び出し・app_id 解決・冪等制御・レポート・env 書き戻し | 新規 |
| `scripts/dify/tests/mock_server.py` | Console API の不足エンドポイントを追加 | 追加のみ |
| `scripts/dify/tests/test_cloud_deploy.py` | **新設**。mock 相手の往復テスト 1 本（`test_run_tests.py` と同じ作法。`npm test` には入れない） | 新規 |

> `console_api.py` を「セルフホスト専用」から「Console API 共通クライアント」に格上げする。モジュール docstring の「Cloud では使わない」の段落は**書き換える**（Cloud も対象、ただし認証はトークン方式、と明記）。`dify/README.md` の該当 1 行も直す。

### 4-2. `console_api.py` に足すもの

```python
CONSOLE_USER_AGENT = "dify-scripts/1.0 (+https://github.com/shoulang0729/dify)"  # F1 と同一。Cloudflare 1010 対策

class ConsoleAuthError(ConsoleAPIError): ...   # 401 / 403 を分けて捕まえる（exit 3 の判定に使う）

class ConsoleClient:
    def set_token(self, token): ...            # ブラウザ由来の console_token を直接入れる（Cloud）
    def confirm_import(self, import_id): ...   # C3
    def get_draft(self, app_id): ...           # C5
    def update_draft(self, app_id, draft): ... # C5
    def list_api_keys(self, app_id): ...       # C7（PR-4）
    def create_api_key(self, app_id): ...      # C7（PR-4）

def client_from_env(console_url, timeout=...):
    """DIFY_CONSOLE_TOKEN があればトークン認証、無ければ DIFY_CONSOLE_EMAIL/PASSWORD でログイン。
    どちらも無ければ ConsoleAuthError。値はログに出さない。"""
```

- `_req` に **`User-Agent: CONSOLE_USER_AGENT` を必ず付ける**（現状は付いていない＝ F5。selfhost にも無害）
- `_req` は 401/403 を `ConsoleAuthError` に変換する。**例外メッセージに Authorization ヘッダを含めない**。本文を載せるときは `Bearer\s+\S+` と `app-[A-Za-z0-9]{16,}` を `***` に置換
- `import_dsl` は現状 `status` を見て confirm を叩く実装が既にある。**戻り値を `(app_id, status)` に変えない**（既存呼び出しを壊さないため、`import_dsl_ex()` として詳細版を追加するか、`return_details=False` の既定引数を足す。implementer の判断でよいが**既存戻り値は str のまま**）

### 4-3. `cloud_deploy.py` の CLI

```
python3 scripts/dify/cloud_deploy.py --env <env> [--all | <番号>...] [オプション]

  --env <env>              必須。dify/env/<env>/env.yml
  --all                    dify/apps/*.yml すべて（12 本）
  --dry-run                render まで実行し、以降は「実行予定」を表示するだけ。ネットワークを呼ばない
  --no-publish             インポートまでで止める（公開しない）
  --bind-kb {dsl,draft,none}   既定 dsl（§2-3）
  --app-id <番号>=<id>     app_id を明示（複数指定可）
  --no-adopt-by-name       名前一致による既存アプリ採用を無効化（必ず新規作成）
  --write-env              env.yml の apps.<番号>.id が null の行だけを実 id に書き換える（§4-5）
  --stop-on-error          最初の失敗で中断（既定は残りを続行）
  --timeout <秒>           既定 120
```

**環境変数**

| 変数 | 必須 | 用途 |
|---|---|---|
| `DIFY_CONSOLE_TOKEN` | Cloud で必須 | ブラウザの localStorage `console_token`。`~/.config/dify/<env>.env` に置く |
| `DIFY_CONSOLE_URL` | 任意 | 未設定なら env.yml の `dify.console_url`（cloud-master は `https://cloud.dify.ai`） |
| `DIFY_DATASET_ID_<番号>` | 任意 | `--bind-kb dsl` のとき、`knowledge.<番号>.id` の `${VAR}` を解決する |
| `DIFY_CONSOLE_EMAIL` / `DIFY_CONSOLE_PASSWORD` | selfhost のみ | 既存のまま（Cloud では使わない） |

**exit code**

| 値 | 意味 |
|---|---|
| 0 | 全件成功（`--dry-run` の正常終了を含む） |
| 1 | 1 件以上の失敗（インポート／公開／API 形の差異） |
| 2 | 引数・環境不備（env.yml 無し・PyYAML 無し・トークン未設定・到達不可） |
| 3 | 認証エラー（401 / 403。トークン期限切れ・Cloudflare） |

**標準出力の形（例。値は一切含まない）**

```
== cloud_deploy.py --env cloud-master --all ==
DIFY_CONSOLE_TOKEN: set   DIFY_CONSOLE_URL: https://cloud.dify.ai
[render] --env cloud-master --strict --all → dify/build/cloud-master/
[KN-01] app_id=env(apps.KN-01) → 上書きインポート … completed → 公開
[KN-02] 名前一致なし → 新規作成 app_id=xxxxxxxx-… → 公開
...
== 結果 ==
| 番号 | 経路 | app_id | 公開 |
|---|---|---|---|
| KN-01 | 上書き | xxxxxxxx-… | OK |
成功 12 / 失敗 0

env.yml に書き戻す差分（--write-env を付けると自動で書きます）:
  apps:
    KN-02: { id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx }
```

### 4-4. 冪等性のまとめ

| 状況 | 2 回目の挙動 |
|---|---|
| `apps.<番号>.id` が env.yml にある | 同じアプリを上書き。アプリは増えない |
| id が無く、同名アプリが 1 件 | それを上書き（`--no-adopt-by-name` でなければ） |
| id が無く、同名アプリが 2 件以上 | **停止**（人が env.yml に id を書いて再実行） |
| id も同名アプリも無い | 新規作成 → 書き戻し断片を出す |
| publish を 2 回 | 公開バージョンが増えるだけ。アプリは増えない |

### 4-5. env.yml の書き戻し（推奨：既定は表示のみ）

**推奨は「既定＝ stdout に断片を出すだけ／`--write-env` を明示したときだけ書く」**（PM 提示の 2 案のうち後者を既定オフで採用）。理由：env.yml はコメント・flow スタイル（`{ id: null }`）で整形されており、YAML を再シリアライズすると整形が壊れて diff が読めなくなる（DI-002 と同種の事故）。

`--write-env` の実装制約（implementer 必読）：

- **YAML の再 dump をしない**。`apps:` ブロック内の `^(\s*<番号>:\s*\{\s*id:\s*)null(\s*\}.*)$` に**完全一致する行だけ**を置換する
- 現在値が `null` **以外**（`${VAR}` や既存 UUID）の行は**絶対に書き換えない**。書き換えが必要そうなら「手で直してください」と表示して exit 1
- 書き換えたら「n 行を更新しました。`git diff dify/env/<env>/env.yml` で確認してから commit してください」と表示する（**スクリプトは commit しない**）

---

## 5. `release.py` との統合

`release.py` の **stage 3-import** だけを変える。他の段（render・guard・KB・test・CHANGELOG・tag）は現状のまま。

```
stage 3-import
  edition == 'selfhost'  → 現状のまま console_api（email/password）
  edition == 'cloud'
      ├ --dry-run                        → IMPORT.md 生成のみ（現状どおり。ネットワークを呼ばない）
      ├ DIFY_CONSOLE_TOKEN が set かつ --no-console-import でない
      │     → cloud_deploy の import/publish を呼ぶ（サブプロセスではなく import して関数呼び出し）
      │       成功 → **止まらず stage 4-kb へ進む**
      │       失敗 → [STOP] stage=3-import（従来どおり後続に進まない）
      └ それ以外（トークン未設定 / --no-console-import）
            → 現状どおり IMPORT.md を書いて return 0（手動インポート待ち）
```

- 新オプション `--no-console-import`（cloud でも従来の手動経路を強制）
- **`IMPORT.md` は自動経路でも生成する**（証跡・手動フォールバック用）。生成した上で自動インポートに進む
- どちらの経路を選んだかを 1 行ログに出す：`[import] cloud 経路: Console API（DIFY_CONSOLE_TOKEN: set）` / `[import] cloud 経路: 手動（IMPORT.md）`
- `--dry-run` は**引き続きネットワークを一切呼ばない**（受け入れ条件 A5）

---

## 6. Playwright MCP 代替（ブラウザ経路を残す）

Console API 経路が使えないとき（トークンが取れない・API 形が違う・KB 紐づけが UI でしかできない）に備え、**画面操作の依頼文を「Claude in Chrome でも Playwright MCP でも同じ」形に書き直す**。

### 6-1. `dify/DEPLOY.md` §0 に足す文（implementer がこの通り入れる）

```md
### ブラウザ操作が要るとき（Claude in Chrome が無い環境）

Cloud の投入・公開は §5 の Console API 経路（`cloud_deploy.py`）で完結するので、**通常はブラウザ操作は不要**。
`console_token` の取得と、Console API が使えないときの逃げ道としてだけブラウザを使う。

Claude in Chrome が無い環境（VS Code 拡張の Claude Code など）では **Playwright MCP** を足すと、
同じ画面操作を Claude Code から行える。

    claude mcp add --scope user playwright -- npx -y @playwright/mcp@latest --user-data-dir ~/.cache/dify-playwright

- `--user-data-dir` を固定するとログイン状態が残る（毎回ログインし直さなくてよい）
- **初回だけ人がログインする**：Playwright が開いたウィンドウで `https://cloud.dify.ai` にログインし、
  そのウィンドウを閉じずに次の指示を出す。2 回目以降は同じプロファイルが再利用される
- **ログイン情報・トークンをチャットに貼らない**（`CLAUDE.md` §2-10）。エージェントには「画面で操作して」とだけ頼む

#### `console_token` の取り方（Console API 経路の前提。人が 1 回だけ行う）

1. Chrome で `https://cloud.dify.ai` にログイン
2. 開発者ツール（⌥⌘I）→ **Application** タブ → 左の **Local Storage** → `https://cloud.dify.ai`
3. キー `console_token` の値をコピー
4. `~/.config/dify/cloud-master.env` の `DIFY_CONSOLE_TOKEN=` の右に貼って保存（**リポジトリの中には置かない**）

    export DIFY_ENV=cloud-master
    set -a; source ~/.config/dify/$DIFY_ENV.env; set +a
    [ -n "${DIFY_CONSOLE_TOKEN:-}" ] && echo set || echo unset   # 値は表示しない

トークンには期限がある。`cloud_deploy.py` が exit 3（認証エラー）で止まったら、この手順でもう一度取り直す。
**値をチャット・ログ・Issue・結果ファイルに貼らない。**
```

### 6-2. `dify/DEPLOY.md` §3 の書き換え（見出しごと差し替え）

```md
## 3. ブラウザに頼む文面例（Claude in Chrome / Playwright MCP のどちらでも同じ）

§5 の Console API 経路（`cloud_deploy.py`）が使えないときの代替。**操作内容は両者で同じ**なので、
Claude in Chrome がある環境ではそのまま、無い環境では §0 の Playwright MCP を入れてから同じ文面を使う。
Playwright MCP のときは、あらかじめ同じプロファイルで Dify Cloud にログインしておくこと。

- 取り込み：「Dify Cloud の Studio で『アプリを作成』→『DSL ファイルをインポート』→ URL タブに
  `https://raw.githubusercontent.com/shoulang0729/dify/main/dify/apps/KN-01-tech-knowledge-qa.yml` を貼って作成。
  LLM ノードのモデルが `openrouter / qwen/qwen3.8-max` になっているか確認して公開し、『API アクセス』で
  API キーを 1 つ発行して、その値を **画面で見せるだけ**（チャットには貼らない）」
- 既存アプリの更新：「対象アプリを開き、アプリ名横の『…』→『DSL をインポート』→ ローカルの
  `dify/apps/<番号>-*.yml` を選んで『上書きしてインポート』。終わったら右上から公開」
- KB 紐づけ：「KN-01 技術ナレッジQA のアプリを開き、『知識検索』ノードのナレッジに『KN-01 技術ナレッジQA』を
  追加して保存、右上から再公開」
- 動作確認：「KN-01 のプレビューで『SUS304 の Φ8 深穴（深さ 60mm）ドリル加工、推奨条件を教えて』と送り、
  回答に TR-2024-007 と 0.06 mm/rev が含まれるか教えて」
```

### 6-3. `.claude/commands/dify-deploy.md`（**PM が適用**。architect も implementer も触らない）

`## 1. アプリの取り込み（Chrome）` の節を、次の文面に差し替える案：

```md
## 1. アプリの取り込み（既定：Console API。ブラウザは代替）

まず `[ -n "${DIFY_CONSOLE_TOKEN:-}" ] && echo set || echo unset` を確認する。

- **set のとき（推奨）**：ブラウザを使わない。
  `python3 scripts/dify/cloud_deploy.py --env $DIFY_ENV <番号...>`
  （`--dry-run` を先に 1 回。exit 3 が出たら `dify/DEPLOY.md` §0 の手順でトークンを取り直して 1 回だけ再試行し、
  それでも駄目なら止まって報告する）。新規作成された番号は、表示された書き戻し断片を
  `dify/env/$DIFY_ENV/env.yml` の `apps:` に**人が**貼る（`--write-env` を使う場合も `git diff` を見せてから）
- **unset のとき**：`dify/DEPLOY.md` §3 の文面で **Claude in Chrome または Playwright MCP** に画面操作を頼む。
  どちらも無い環境なら、`dify/build/$DIFY_ENV/IMPORT.md` の手順を提示して**止まる**（人が手で入れる）

いずれの経路でも、**モデルが DSL の指定どおりか**（`openrouter / qwen/qwen3.8-max`、分類・抽出は
`moonshotai/kimi-k3`、`temperature 0.2` / `max_tokens 8192` / `reasoning_effort low` /
`exclude_reasoning_tokens ON`）を公開前に確認し、違っていたら**直さずに報告する**（DI-010 / DI-011 / DI-014）。
既存アプリの再インポート前に Cloud 側の乖離を見る手順（`sync_back.py --dry-run`、DI-013）は従来どおり。
```

---

## 7. 変更ファイルと PR 分割

| PR | 内容 | 触るファイル | 並列 |
|---|---|---|---|
| **PR-1** | `console_api.py` にトークン認証・独自 UA・`confirm_import` / `get_draft` / `update_draft` を追加（既存 API は不変）。`mock_server.py` に `POST …/imports/{id}/confirm`・`GET/POST …/workflows/draft`・401 応答（`Authorization` 無し／`expired` トークン）を追加。`tests/test_console_api.py` を新設 | `scripts/dify/console_api.py`・`scripts/dify/tests/mock_server.py`・`scripts/dify/tests/test_console_api.py`（新規） | 単独 |
| **PR-2** | `cloud_deploy.py` 新設（§4-3）。`dify/env/*/env.yml` に `apps:` 追加＋ cloud-master の `knowledge.*.id` を `${VAR}` 化。`verify.mjs` §12-e 追加。`tests/test_cloud_deploy.py` 新設 | `scripts/dify/cloud_deploy.py`（新規）・`dify/env/cloud-master/env.yml`・`dify/env/inhouse/env.yml`・`dify/env/customer-a/env.yml`・`tools/verify.mjs`・`scripts/dify/tests/test_cloud_deploy.py`（新規）・`scripts/dify/tests/mock_server.py`（PR-1 が入っていれば追加変更なし） | **PR-1 の後**（`console_api.py` の新 API に依存） |
| **PR-3** | `release.py` の stage 3 統合（§5）＋ `--no-console-import`。ドキュメント：`dify/DEPLOY.md`（§0 追記・§3 差し替え・§5 の表と `console_api.py` の説明更新・§6 に `--check` 注意）・`scripts/dify/env.example`（`DIFY_CONSOLE_TOKEN`・`DIFY_APP_ID_*`・`DIFY_DATASET_ID_*` 追記）・`dify/README.md`（`console_api.py` の 1 行）・`dify/env/README.md`（`apps:` の説明と `--check` 注意） | `scripts/dify/release.py`・`dify/DEPLOY.md`・`scripts/dify/env.example`・`dify/README.md`・`dify/env/README.md` | **PR-2 の後** |
| **PR-4（任意）** | API キーの発行・取得（C7 が真だったときだけ）。`--issue-api-key` は `~/.config/dify/<env>.env` に追記するだけで**値を表示しない**。既にキーがあれば作らない。書き込み先がリポジトリ内なら拒否 | `scripts/dify/console_api.py`・`scripts/dify/cloud_deploy.py`・`scripts/dify/tests/mock_server.py`・`dify/DEPLOY.md` | **PR-1 の後なら PR-2/3 と並列可**（ただし `console_api.py` が PR-1 と重なるので、PR-1 マージ後に開始） |

実質は **PR-1 → PR-2 → PR-3 の直列**（`CLAUDE.md` §5：同じファイルを触るお題は直列）。PR-4 は C7 の実機確認（N6）が済むまで着手しない。

---

## 8. 触らない範囲（reviewer の diff 監査基準）

- **`mock/**` 全部**（①デモ）。`js/data/**`・`css/**`・`catalog.html`・`index.html`
- **`data/world/**`**（架空世界マスタ）
- **`dify/apps/*.yml`（DSL 12 本）**。1 バイトも変えない。モデル・プロンプト・`dataset_ids`・`version` を触らない
- **`dify/kb/**`・`dify/tests/*.json`・`dify/results/**`**
- `scripts/dify/render.py`・`kb_upload.py`・`run_tests.py`・`sync_back.py`（**import して使うだけ**。R1〜R10 の置換ロジックを変えない）
- `tools/regress.mjs`・`tools/regress.baseline.json`（データ層は無関係。`--update` しない）
- `tools/verify.mjs` の §1〜§11（§12 に 12-e を**追加**するだけ。既存検査の条件を緩めない）
- **`.claude/**`**（§6-3 は文案の提示まで。適用は PM）
- **`CLAUDE.md`**（§12 P3 の追記案も PM が適用）
- `dify/CHANGELOG.md`（リリース時に `release.py` が書くもの。手で書かない）
- `.github/workflows/**`（`npm test` の中身を変えない＝新テストは CI に入れない）
- `dify/env/**/env.yml` の既存キー（`models` / `knowledge` の**件数**・`brand` / `flags` / `variables`）。今回変えるのは `apps:` の**追加**と cloud-master の `knowledge.*.id` の**値の書き方**だけ

---

## 9. 受け入れ条件

### 9-A. 機械検証（砂箱で実行できる。implementer が PR 前、reviewer がレビュー時）

| # | 条件 |
|---|---|
| A1 | `node tools/verify.mjs` が PASS（§12-e を含む） |
| A2 | `node tools/regress.mjs` が PASS（**`--update` していない**こと。データ層は無関係） |
| A3 | `python3 scripts/dify/render.py --env cloud-master --all --check` が 12 本すべて `[OK]`（**`DIFY_DATASET_ID_*` を設定していない素の shell で**） |
| A4 | `python3 dify/check.py` が PASS（DSL 無変更の確認） |
| A5 | `python3 scripts/dify/release.py --env cloud-master --all --dry-run` が exit 0 で、**ネットワークを呼ばない**（`DIFY_CONSOLE_TOKEN` を設定した状態でも `--dry-run` は import を実行しない） |
| A6 | `python3 scripts/dify/tests/test_console_api.py` が全件 PASS（mock 相手。トークン認証・confirm・draft・401） |
| A7 | `python3 scripts/dify/tests/test_cloud_deploy.py` が全件 PASS。最低限：<br>① 新規作成 → app_id を得る<br>② **同じ番号を 2 回流してアプリが増えない**（mock の `STATE["apps"]` 件数が変わらない）<br>③ `apps.<番号>.id` があるとき `app_id` 付きで送る（上書き）<br>④ 401 で exit 3、メッセージにトークン再取得手順が出る<br>⑤ **標準出力・標準エラー・生成ファイルにトークン文字列が 1 度も現れない**（テストで grep する）<br>⑥ `--dry-run` でネットワークを呼ばない<br>⑦ `--write-env` が `id: null` の行だけを書き換え、`${VAR}` の行は書き換えず exit 1 |
| A8 | `git status` に `.env`・`~/.config` 由来のファイル・`dify/build/**` が出ない |
| A9 | 既存の `python3 scripts/dify/tests/test_run_tests.py` と `test_sync_back.py` が引き続き PASS（`console_api.py` / `mock_server.py` の変更が既存を壊していない） |
| A10 | `git grep -n "DIFY_CONSOLE_TOKEN" -- scripts dify docs` の結果に**値の例が 1 つも無い**（変数名・`:+set` 形のみ） |

### 9-B. 実機確認（PM が Mac で。砂箱では不可能。**PR のマージ条件には含めない**が、Issue にチェックリストとして残す）

| # | 条件 | 対応する確認要 |
|---|---|---|
| B1 | §1-3 の N1〜N4 を実施し、C1〜C5 の真偽を Issue にコメント（値は貼らない） | C1〜C5・C8・C9 |
| B2 | `cloud_deploy.py --env cloud-master --dry-run KN-01` が exit 0 | — |
| B3 | `cloud_deploy.py --env cloud-master KN-01` で **既存の KN-01 が上書き**され、アプリ id・Service API キーが変わらない（`run_tests.py KN-01` が同じキーで通る） | C2・F2 |
| B4 | 続けてもう 1 回同じコマンドを流し、**Cloud のアプリ一覧の件数が増えない** | 冪等 |
| B5 | `cloud_deploy.py --env cloud-master --all` で第 2 弾 10 件が投入・公開され、10 件の app_id が書き戻し断片に出る | — |
| B6 | `--bind-kb dsl` で投入した KN-01 の知識検索ノードに KB が**最初から紐づいている**（＝ C6 が真）。紐づいていなければ `--bind-kb draft` を試し、結果を Issue に記録 | C6・DI-012 |
| B7 | トークンを期限切れにして（または壊して）実行し、**exit 3 ＋ 取り直し手順**が出る | C9 |
| B8 | Claude in Chrome の無い環境で Playwright MCP を入れ、§6-2 の文面で「取り込み → 公開」が通る | — |
| B9 | 実行ログ・`dify/results/**`・Issue コメントのどこにもトークン／API キーの値が無い | §2-4 |

**B1〜B9 の結果で C1〜C9 が偽と分かったら、`console_api.py` の該当箇所だけを直す PR を立てる**（他のファイルに波及させない）。詰まりは `dify/KNOWN_ISSUES.md` に `DI-016` 以降で起票する（現在の最大は DI-015）。

---

## 10. implementer のコマンド列

```bash
# 0) 準備
git switch -c feat/<issue>-cloud-console-deploy origin/main

# 1) 実装（PR ごとに §7 の対象ファイルだけ）

# 2) 機械検証（すべて砂箱内で完結。ネットワークは 127.0.0.1 のみ）
python3 scripts/dify/tests/test_console_api.py        # PR-1
python3 scripts/dify/tests/test_cloud_deploy.py       # PR-2
python3 scripts/dify/tests/test_run_tests.py          # 既存が壊れていないこと
python3 scripts/dify/tests/test_sync_back.py
python3 dify/check.py
env -u DIFY_DATASET_ID_KN01 -u DIFY_DATASET_ID_KN02 -u DIFY_DATASET_ID_KN03 -u DIFY_DATASET_ID_GN01 \
  python3 scripts/dify/render.py --env cloud-master --all --check
python3 scripts/dify/release.py --env cloud-master --all --dry-run
npm test                                              # verify + regress
git status --short                                    # .env / dify/build/** が出ないこと

# 3) 値が漏れていないこと
git grep -n "console_token\|DIFY_CONSOLE_TOKEN" -- scripts dify docs tools
```

**やらないこと**：`node tools/regress.mjs --update`／`dify/apps/*.yml` の編集／`.claude/**`・`CLAUDE.md` の編集／実ネットワークへの接続（砂箱からは到達不可。試みてタイムアウトを待たない）。

---

## 11. reviewer の照合点

1. **diff の範囲が §7 の表と §8 の「触らない範囲」に一致**しているか（特に `dify/apps/*.yml` が 0 行差分、`mock/**` が 0 行差分）
2. `console_api.py` の**既存関数のシグネチャ・戻り値が変わっていない**こと（`release.py` の selfhost 経路が壊れていない）。`import_dsl` の戻り値が `str` のままか
3. **秘密が出ない実装か**：`log()` に token / API キーを渡していないか、例外メッセージで本文をそのまま出すときに `Bearer`・`app-…` をマスクしているか、`--write-env` の書き込み先がリポジトリ外に限られているか
4. **§2-10**：`git grep` でトークンの実値・`~/.config/dify/*` の内容が入っていないこと。`.gitignore` の除外が効いていること
5. **§2-12**：`dify/apps/*.yml` に環境固有値が焼き込まれていないこと。`render --check` が素の環境で 12/12 `[OK]`（A3）
6. **env スキーマ**：`apps:` が 3 環境すべてにあり、件数 12 が `dify/apps/*.yml` と一致（§3-2 の id 一覧と照合）。cloud-master 以外に生 UUID が無いこと
7. `verify.mjs` の変更が **§12-e の追加だけ**で、既存の検査条件を緩めていないこと（`REQUIRED_TOP` への `apps` 追加以外に既存配列を削っていないか）
8. `--dry-run` がネットワークを呼ばないこと（`release.py` も `cloud_deploy.py` も）。A5 のログに `[import]` の実行行が出ていないこと
9. `npm test`（verify・regress）が PASS。**regress の baseline が更新されていない**こと
10. 「確認要」が**コードのコメントと DEPLOY.md の両方に残っている**こと（実機未確認のまま断定していないか）
11. PR 本文に設計書パス・検証結果・触っていない範囲があること

---

## 12. PM 判断待ち・確認要

| # | 論点 | architect の推奨 |
|---|---|---|
| **P1** | `dify/env/cloud-master/env.yml` の `apps.KN-01.id` / `apps.DC-01.id` の実値 | 設計書では `null`。**PM が Cloud のアプリ URL（`/app/<uuid>/…`）から確認して入れる**。入れる前でも動く（名前一致で採用される）が、入れておくと確実 |
| **P2** | `verify.mjs` の `REQUIRED_TOP` に `apps` を足す（＝ 3 環境すべてに必須）か、任意キーのままにするか | **足す**。3 環境同時に書くので即 FAIL は出ず、将来 env を増やしたときの書き忘れを防げる。`schema: 1` は据え置き |
| **P3** | `CLAUDE.md` §2-12 の一文追記（**PM が適用**。architect は触らない） | 追記案：「**モデル・KB id・アプリ id**・社名と拠点の表記・Start 変数の既定・フラグは env にだけ書く」＋ §2-12 の検出欄に「`tools/verify.mjs` §12-e（`apps:` の番号一覧が `dify/apps/*.yml` と一致）」を足す |
| **P4** | `release.py` の cloud 経路を「トークンがあれば自動で Console API」にするか、`--console-import` の明示を要るようにするか | **トークンがあれば自動**（＋ `--no-console-import` で従来経路）。トークンを置くこと自体が明示的な意思表示なので、二重の明示は運用の手間になる |
| **P5** | API キーの自動発行（C7・PR-4）をやるか | **N6 の実機確認が済むまで着手しない**。応答に平文キーが入るなら `~/.config/dify/<env>.env` への直接書き込み（値を表示しない）で実装、伏字なら諦めて UI 発行のまま |
| **P6** | `--bind-kb` の既定 | **`dsl`**（C6 が真である前提）。N5 で偽と分かったら既定を `draft` に変える PR を別に立てる |
| **P7** | `docs/dify/implementation-guide.md` L195・L198 と `docs/dify/feasibility-33-services.md` L86 の「Cloud は Console API が壊れやすい」という記述の更新 | **今回は変えない**（実機確認 B1〜B9 が済んでから、事実に基づいて 1 PR で直す）。設計書 §12 にこの項目があること自体を Issue に残す |

**確認要の一覧（再掲）**：C1 トークン認証／C2 imports の body 形／C3 confirm／C4 publish のパス／C5 draft の GET・POST／C6 `dataset_ids` 焼き込みで KB が紐づくか／C7 api-keys の応答／C8 Console API の Cloudflare UA／C9 トークン期限。

---

## 13. Issue 案

`docs/handoff/2026-09-08-cloud-console-deploy.issue.md` に本文を書き出す（この環境に `gh` が無いため。PM が `gh issue create` するか画面から起票する）。
