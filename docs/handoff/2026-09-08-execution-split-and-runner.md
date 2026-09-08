# 2026-09-08 実行環境の切り分けと、クラウド⇄ローカルの往復をなくす

Issue: #121（本文＝ファイル境界、コメント＝仕事の受け渡し）
関連: #114（Console API 経路の前提が崩れた記録）・#84（構成 v2）・#82 / #98（投入と往復）
レーン: **M/L**（architect → implementer → reviewer）
状態: 設計。実装は未着手

PM の要望（2026-09-08）：**「CloudDify はローカルしか実装できない、他はクラウドで作業が可能。この切り分けをして、行ったり来たりしたくない」**

---

## §0 要約

1. 「Mac でしかできないこと」を操作単位で 10 個に分解すると、理由は **(a) ブラウザのログイン済みセッションが要る / (b) 秘密がローカルにしかない / (c) Dify に到達できない** の 3 種類に割れる。
2. **(b)(c) は Mac の固有事情ではない。** GitHub のホストランナー（`ubuntu-latest`）は Dify に到達でき、秘密は Environment secret で渡せる。つまり **KB 投入（O5）とテスト実行（O6）は、今日からクラウド側だけで回せる**。
3. **本当に Mac が要るのは (a) だけ** ＝ 投入・上書き・公開・KB 紐づけ・API キー発行・エクスポート（O1〜O4・O7・O8・O10）。Dify Cloud 1.17.0 のコンソール API は **httpOnly セッション Cookie ＋ `X-CSRF-Token`** で、Bearer トークンが存在しない（#114 N1 の実機観測）ため、ブラウザの外から認証できない。
4. したがって推奨は **D → A＋B の順の段階導入**。まず (b)(c) をホストランナーへ移し（W1）、往復の頻度を下げる。次に設計と事実をファイルで分け（W2）、最後に (a) を Mac のセルフホストランナー＋Playwright 認証で押し出す（W3・W4）。
5. **公開リポジトリでのセルフホストランナーは既定では危険**（fork PR で任意コードが Mac 上で走る）。7 つの回避策を全部満たすことを W3 の必須条件にする。満たせないなら W3 は採用せず、#121 コメントの案 1（Mac 側ポーリング）に落とす。

---

## §1 いまの往復の実体（操作単位）

### 1-1 操作の一覧

`dify/DEPLOY.md`・`scripts/dify/*.py`・`.claude/commands/dify-deploy.md` の実物と、#114 の実機観測（2026-09-08、Cloud `current_version=1.17.0`）から引いた。**推測は「未確認」と明記する。**

| # | 操作 | 実行しているもの | Mac でしかできない理由 | 種別 | 根拠 |
|---|---|---|---|---|---|
| **O1** | DSL の新規インポート | `cloud_deploy.py`（Console API）／Studio 画面 | コンソール API の認証が **httpOnly セッション Cookie ＋ `X-CSRF-Token`**。`localStorage` に `console_token` は存在せず、`Authorization` ヘッダも送られていない。CSRF ヘッダ無しの `fetch(..., {credentials:'include'})` は **401** | (a) | #114 コメント「N1〜N6 の実機観測」 |
| **O2** | DSL の上書きインポート | アプリ名 →「…」→「DSL をインポート」→「上書きしてインポート」 | 同 O1。加えて **上書き経路は画面のダイアログでしか実施していない**（`POST /apps/imports` に `app_id` を渡す形はソースで確認済みだが、Cloud での実行は未確認） | (a) | #114 コメント／`dify/DEPLOY.md` §1-④ |
| **O3** | 公開（publish） | `POST /console/api/apps/{app_id}/workflows/publish` | 同 O1。さらに **UI はクライアント側でチェックリストを検証し、未解決だと POST を出さない**（`Checklist has unresolved items`）。サーバ側が同じ検証をするかは未確認 | (a) | #114 コメント N3 |
| **O4** | 知識検索ノードへの KB 紐づけ | Studio 画面 | 同 O1。マスタ DSL は `dataset_ids: []` なので **上書きインポートのたびに紐づけが外れる**。draft API による差し替え（`--bind-kb draft`）は C5・C6 が未確認 | (a) | #114 追記／`cloud_deploy.py` docstring |
| **O5** | KB の作成・文書投入・索引待ち | `kb_upload.py`（Datasets API・`DIFY_DATASET_KEY`） | **ブラウザ不要。API キー認証**。Mac に固定されているのは、キーが `~/.config/dify/<env>.env` にしかないことと、実行環境から `api.dify.ai` に出られないこと **だけ** | (b)(c) | `kb_upload.py` docstring |
| **O6** | Service API テスト実行 | `run_tests.py`（`DIFY_APP_KEY_<番号>`） | 同 O5 | (b)(c) | `run_tests.py` docstring |
| **O7** | Service API キーの発行 | `POST /console/api/apps/{app_id}/api-keys` → 201、`token` は平文（`app-` 始まり 28 文字） | 同 O1（コンソール API）＋ 発行された値を人が `~/.config/dify/<env>.env` に書く運用 | (a)(b) | #114 コメント N6 |
| **O8** | Cloud → Git の逆流（DSL エクスポート） | 画面「DSL をエクスポート」→ `sync_back.py` | **エクスポートの取得だけ**が (a)。`sync_back.py` 自体はネットワークを呼ばず、クラウド側でも動く | (a) | `sync_back.py` docstring／DEPLOY.md §6 |
| **O9** | app id / dataset id の採取 | 画面 URL・API 応答 | 実機に問い合わせないと存在しない値（＝「事実の生成」）。O1・O5 の副産物 | (a)(c) | `dify/env/README.md`「`apps:`」節 |
| **O10** | モデルプロバイダ・モデル一覧の確認 | 設定 → モデルプロバイダー画面 | ワークスペース設定は画面のみ。コンソール API 経路は未確認 | (a) | `dify/DEPLOY.md` §0 |

### 1-2 理由の 3 分類

| 種別 | 中身 | Mac 固有か | 解き方 |
|---|---|---|---|
| **(a) ブラウザのログイン済みセッション** | Cloud 1.17.0 のコンソール API は httpOnly Cookie ＋ CSRF。Cookie は JS からも取り出せない | **Mac 固有**（そのブラウザプロファイルの中にしか無い） | Playwright にログインさせ**ブラウザの文脈のまま**叩く（#114 案 2 ＝ 本書 B）／画面操作を続ける |
| **(b) 秘密がローカルにしかない** | `DIFY_DATASET_KEY`・`DIFY_APP_KEY_*` が `~/.config/dify/<env>.env` にある | **Mac 固有ではない**。値をどこに複製するかの判断だけ | GitHub Environment secret（§4-1） |
| **(c) 実行環境から Dify に到達できない** | Claude Code on the web の砂箱から `api.dify.ai` / `cloud.dify.ai` に出られない | **Mac 固有ではない**。GitHub Actions のランナーは外に出られる | ホストランナーで実行（§3 案 D） |

### 1-3 往復の 1 サイクル（いま起きていること）

```
クラウド側                        PM（人の中継）                Mac
─────────                        ─────────                    ────
DSL を直す → PR → main                                          
                          ──▶  文章を貼り付け  ──────────▶  O2 上書きインポート（画面）
                                                                 O4 KB 紐づけ（画面）
                                                                 O3 公開（画面）
                                                                 O5 kb_upload.py
                                                                 O6 run_tests.py
                                                                 dify/results/** を commit → push
KNOWN_ISSUES を読む  ◀────────  「失敗した」  ◀──────────────  結果を報告
DSL を直す → PR → main   （以下くり返し）
```

**中継は 2 回**（依頼と結果）。1 サイクルの待ちは PM が Mac の前に座るまで。DI-007〜DI-022 のような「直す → 再テスト」を 1 日に何度も回すと、この中継がそのまま所要時間になる。

### 1-4 副次的な結合（#121 本文の 4 点）

1. `dify/env/*/env.yml` が **設計値（クラウドが書く）と実機の採番（Mac が書く）を同居**させている（`cloud_deploy.py --write-env`）
2. `tools/verify.mjs` §12-e が `apps:` と `dify/apps/*.yml` の一致を要求するため、DSL を 1 本足すだけで env を触る
3. `dify/KNOWN_ISSUES.md` に実機観測とコード上の発見が同じ表で混ざる（`DI-xxx` の採番が両側で衝突しうる）
4. `docs/service-map.md` は生成物で、どちらの環境でも再生成できてしまう

---

## §2 分かったこと（設計の起点）

> **Mac が本当に必要なのは、10 操作のうち (a) の 7 つだけ。KB 投入とテスト実行は Mac を必要としていない。**

これは #121 本文の表（「クラウド＝ Dify Cloud に到達できない」）が **実行環境を 2 つだと仮定している**ことの見落としである。実行環境は 3 つある：

| 実行環境 | Dify への到達 | 秘密の受け取り | ブラウザセッション | 常時稼働 |
|---|---|---|---|---|
| クラウド（Claude Code on the web） | ✗ | ✗ | ✗ | ○ |
| **GitHub ホストランナー（`ubuntu-latest`）** | **○**（要実証。§10 の A1） | **○**（Environment secret） | ✗ | **○** |
| Mac（CLI / VS Code 拡張） | ○ | ○ | **○** | ✗ |

3 つ目を使うだけで往復の半分が消える。しかも **セルフホストランナーの危険（§4-2）を一切持ち込まない**。

---

## §3 恒久策の比較

案は互いに排他ではない。**A は「起動と受け渡し」、B は「Cloud 認証の突破」、C は「対象環境の変更」、D は「実行場所の追加」** と、直交する別の軸を扱っている。この直交性が #114 と #121 のコメントでは混ざっていたので、まず分けて評価する。

### 3-1 各案

| | **A. Mac にセルフホストランナー** | **B. Playwright にログインさせ、ブラウザの文脈のままコンソール API** | **C. 自動化はセルフホスト Dify（inhouse）に寄せる** | **D. GitHub ホストランナー＋ Environment secret（追加案）** |
|---|---|---|---|---|
| 何を解くか | 起動（`workflow_dispatch` で押し込む）・結果の回収 | (a) ブラウザセッション | (a) を回避（selfhost は email/password ログインが `console_api.py` で動く） | (b) 秘密・(c) 到達性 |
| 解かないもの | (a)。Mac の中で結局ブラウザか Playwright が要る | 起動（誰かが Mac で走らせる必要が残る） | Cloud 上のマスタは手作業のまま。**顧客デモは Cloud で回っている** | (a)。投入・公開はできない |
| **秘密の置き場と読める人** | 追加なし（ランナーはローカルの環境変数を読む）。ただし**ランナーが Mac 上で任意コードを実行できる**＝ `~/.config/dify/**`・キーチェーン・SSH 鍵が実質的に読める | 追加なし（Cookie はブラウザの中で完結。取り出さない） | selfhost の email/password が要る。**Cloud より 1 段強い秘密**（アカウント全体） | `cloud-master` の API キーを GitHub Environment secret に複製。読めるのは PM と、承認されたワークフロー実行 |
| **Mac の常駐** | **要る**（オフラインだとジョブが待つ／失敗する） | 要る（実行のたび） | 要らない（社内サーバが常時稼働なら） | **要らない** |
| **壊れやすさ** | 中。ランナーの自動更新・macOS のスリープ・トークン失効 | **高**。Dify の UI 変更で DOM/経路が変わる。#114 の N2・N4 は body すら未取得 | 低（API が安定）。ただし **inhouse 環境そのものが未構築・未確認**（`dify/env/README.md` 台帳：確認状態 `未確認`） | **低**。既存スクリプトをそのまま呼ぶだけ |
| **実装量** | 中（ワークフロー 1 本＋ Mac 側のセットアップ手順） | 大（`console_api.py` に browser 経路を足す／Playwright を常駐させる／認証の寿命管理） | 特大（社内サーバの構築・モデル調達・KB 再構築。#121 の範囲外） | **小**（ワークフロー 1 本。スクリプトは無変更） |
| **PM の手数** | 初回のセットアップ 30 分。以後は Environment の承認クリックのみ | 初回のログイン 1 回。以後はプロファイルが持つ（`--user-data-dir`） | 大（サーバ運用） | **Secrets 登録 1 回＋実行ごとの承認クリック** |
| **失敗したとき何が壊れるか** | **最悪：Mac のローカル資産が全部読まれる**（公開リポジトリ＋ fork PR。§4-2）。通常の失敗は「ジョブが queued のまま」 | 認証が通らず投入が止まる。**副作用は無い**（読めないだけ） | Cloud のマスタと inhouse が二重管理になり、`sync_back` の逆写像が壊れる（DEPLOY.md §6 の非対応事項） | テストが流れない。**Dify 側の破壊は無い**（`run_tests.py` は読み取りのみ、`kb_upload.py` は冪等・同名文書スキップ） |
| **公開リポジトリでの安全性** | **既定では危険**（§4-2） | 影響なし（GitHub を経由しない） | 影響なし | 安全（fork PR に secrets は渡らない。Environment 承認で二重化） |

### 3-2 推奨

> **推奨：D を最初に入れ（W1）、次に設計と事実をファイルで分け（W2）、その後に A ＋ B を組み合わせる（W3・W4）。C は採らない。**

理由：

1. **D は今日入れられて、往復の半分（O5・O6）を消す。** 実装量が最小（スクリプトは 1 行も変えない）で、失敗しても Dify 側に副作用が無く、公開リポジトリの危険を持ち込まない。DI-007〜DI-022 の「直す → 再テスト」の反復は全部ここに乗る。**効果／リスク比が他案と桁で違う。**
2. **A は「起動」を解くが「認証」を解かない。** A だけ入れても、Mac 上のジョブは結局 Playwright か画面操作を呼ぶ。したがって **A は B とセットでしか完成しない**。そして A は §4-2 の危険を持ち込むので、D で得られる分を先に取り切ってから判断すべき。
3. **B 単体では起動が人のまま。** #114 の推奨（案 2）は認証の話としては正しいが、「往復をなくす」には足りない。かつ N2・N4 のリクエスト body が未取得のままなので、いま設計を固めると作り直しになる。
4. **C は採らない。** 顧客デモは Cloud 上で回っており（`dify/env/README.md` 台帳で `cloud-master` だけが `確認済`）、`inhouse` は未構築・`未確認`。自動化のために本番相当の環境を先に作るのは順序が逆。**ただし将来 inhouse が立ったときの逃げ道としては残す**（`console_api.py` の email/password 経路は無傷。#114 の報告どおり）。

---

## §4 推奨案の設計

### 4-1 秘密の置き場と渡し方

**原則（CLAUDE.md §2-10 を崩さない）**

| 原則 | 中身 |
|---|---|
| **P1** | **ブラウザ資格情報（Dify のログイン ID／パスワード／セッション Cookie／CSRF トークン）は Mac から出さない。** GitHub にも置かない。Cookie は httpOnly で取り出せない（#114 N1）が、仮に取り出せても置かない |
| **P2** | **複製してよいのは `cloud-master` の Service / Datasets API キーだけ。** 理由：スコープが 1 アプリ／1 ナレッジに限られ、画面から 1 分で失効・再発行できる（`DEPLOY.md` §4 最終行）。かつ `cloud-master` は `data/world/` の架空データしか入っていない（CLAUDE.md §2-10 で PM 確認済み） |
| **P3** | **顧客環境（`customer-a`）・社内環境（`inhouse`）のキーは GitHub に置かない。** それらは Mac ／現地からのみ |
| **P4** | **リポジトリの中には一切書かない。** `.env`・`env.yml`・`state.yml`・Issue・PR・チャット・結果ファイル・ジョブログのどれにも出さない（現状維持） |

**置き場**

| 秘密 | Mac | GitHub | スコープ |
|---|---|---|---|
| `DIFY_DATASET_KEY` | `~/.config/dify/cloud-master.env` | **Environment secret `dify-cloud-master`** | ナレッジ全体（`cloud-master` ワークスペース） |
| `DIFY_APP_KEY_<番号>`（12 本） | 同上 | 同上 | アプリ 1 本ずつ |
| `DIFY_BASE_URL` | 同上 | **Environment variable**（秘密ではない。`https://api.dify.ai/v1`） | — |
| Dify のログイン情報 | ブラウザプロファイル | **置かない** | — |
| セッション Cookie / CSRF | ブラウザ内 | **置かない** | — |
| `DIFY_DATASET_ID_*` | 同上 | **置かない**（W2 以降は `dify/state/cloud-master.yml` から読む） | — |

**なぜ Repository secret ではなく Environment secret か**

1. Environment に **required reviewers（PM）** を付けられる。ワークフローが secret に触る直前で止まり、PM が承認するまで動かない。**ワークフローを書き換えて secret を盗む攻撃が、承認画面で必ず可視化される**
2. Environment に **deployment branch policy** を付けられる。`main` のワークフローからしか使えないようにする
3. 公開リポジトリでは、**fork からの PR には secrets が渡らない**（GitHub の仕様）。Environment はそれをさらに絞る

**リポジトリ設定（PM が 1 回だけ行う。ワークフローでは設定できない）**

- Settings → Environments → `dify-cloud-master` を作成 → Required reviewers に PM → Deployment branches: `main` のみ
- Settings → Actions → General → Fork pull request workflows from outside collaborators → **Require approval for all outside collaborators**
- Settings → Actions → General → Workflow permissions → **Read repository contents permission**（既定を read に。書くジョブだけ `permissions:` で明示的に上げる）

### 4-2 セルフホストランナーの安全性（W3 を入れる場合の必須条件）

**このリポジトリは public（`visibility: public`、2026-09-08 API 確認）。したがってセルフホストランナーは既定では危険である。** GitHub 自身が公開リポジトリでのセルフホストランナー利用を推奨していない。危険の中身：

> 誰でもこのリポジトリを fork し、ワークフロー定義を書き換えた PR を出せる。その PR がセルフホストランナーで実行されると、**PM の Mac 上で第三者のコードが PM の権限で走る**。`~/.config/dify/**` の API キー、ログイン済みブラウザプロファイル、SSH 鍵、キーチェーン、他の顧客資料が読める。ランナーが `--ephemeral` でなければ、次のジョブに残る細工（PATH 上の偽コマンド、`~/.gitconfig` の書き換え、常駐プロセス）も置ける。

**W3 の必須条件（全部満たさないなら W3 を採用しない）**

| # | 条件 | なぜ |
|---|---|---|
| **S1** | **`pull_request` / `pull_request_target` トリガでセルフホストのジョブを一切定義しない。** トリガは `workflow_dispatch` のみ | fork PR からの実行経路を構造的に消す。`pull_request_target` は特に危険（base の権限で走る） |
| **S2** | **`runs-on` はラベル 3 つで固定**：`[self-hosted, macOS, dify-mac]`。`self-hosted` だけにしない | ラベルの取り違えで他のジョブが Mac に落ちるのを防ぐ |
| **S3** | **`--ephemeral` で登録し、1 ジョブごとに登録解除する。** ジョブ後に作業ディレクトリを消す | ジョブ間の持ち越し（永続化された細工）を断つ |
| **S4** | **専用の macOS ユーザーアカウントでランナーを動かす。** そのユーザーのホームに `~/.config/dify/cloud-master.env` を置き、PM の通常アカウントのホーム・キーチェーン・SSH 鍵には読み取り権限を与えない | 万一実行されても、被害を「`cloud-master` の API キー」に閉じ込める。**再発行で回復できる範囲に収める** |
| **S5** | **checkout する ref を `workflow_dispatch` の入力で受けない。** ワークフローが動く `github.ref`（＝ `main` またはこのリポジトリのブランチ）を使う | 任意 ref を持ち込ませない |
| **S6** | **Settings → Actions → Require approval for all outside collaborators** を有効にする | S1 の保険（将来トリガを増やしたときの二重防御） |
| **S7** | **`permissions:` を最小に。** 既定 `contents: read`、結果を push するステップだけ `contents: write`。`GITHUB_TOKEN` を他ジョブに渡さない | ランナーが乗っ取られたときのリポジトリ側被害を絞る |
| **S8**（推奨・必須ではない） | **常駐させず、必要なときだけ `./run.sh --once`** | 攻撃可能な時間窓を PM が明示的に開けるときだけにする。ただし「往復をなくす」効果は落ちる（PM 判断 §12-3） |

**それでも残るリスク**：write 権限を持つ人（＝ PM 自身と、将来の共同作業者）が main にワークフローを追加すれば、承認なしで Mac 上で動かせる。これは技術で消せない（Environment の required reviewers を全ジョブに付ければ緩和できる）。**W3 を入れるなら、`.github/workflows/**` の変更を含む PR は reviewer が必ず diff を読む**ことを運用条件にする。

**代替（W3 を採用しない場合）**：#121 コメントの案 1 ＝ Mac 側から GitHub をポーリング（`launchd` で `claude -p`）。**inbound の実行経路が存在しないので、上の危険はゼロ**。代償は最大 1 時間の待ちと、実行記録が人の書いたコメントになること。

### 4-3 ワークフローの形

新規 `.github/workflows/dify-ops.yml`（既存の `verify.yml`・`pages.yml` は変更しない）。

**トリガ**：`workflow_dispatch` のみ

**入力**

| 入力 | 型 | 値 | 既定 |
|---|---|---|---|
| `op` | choice | `test` / `kb` / `kb-and-test` / `deploy`（W3 で追加） | `test` |
| `codes` | string | 管理番号を空白区切り、または `all` | `all` |
| `env` | choice | `cloud-master`（当面これだけ） | `cloud-master` |
| `runner` | choice | `hosted` ／（W3 で `mac` を追加） | `hosted` |

**入力の検証（コマンドインジェクション対策。W1 の受け入れ条件）**

- `codes` は `^(all|[A-Z]{2}-[0-9]{2}( [A-Z]{2}-[0-9]{2})*)$` に一致しなければ **即失敗**
- 入力を `run:` の shell 行に直接展開しない。必ず `env:` 経由で環境変数として渡し、`"$CODES"` の形で参照する

**実行**

```
jobs:
  ops:
    runs-on: ubuntu-latest            # W3 で ${{ inputs.runner == 'mac' && ... }} を足す
    environment: dify-cloud-master    # ← required reviewers（PM）でここで止まる
    permissions:
      contents: write                 # 結果ブランチの push のみ
    timeout-minutes: 45               # キューに溜めない（§4-4）
    steps:
      1  checkout（github.ref）
      2  setup-python（3.x）。pyyaml は render を呼ぶときだけ
      3  入力の検証（上の正規表現）
      4  秘密の有無だけ確認（[ -n "${VAR:-}" ] && echo set || echo unset。値は出さない）
      5  op に応じて実行
           kb   : python3 scripts/dify/kb_upload.py --env $ENV <code>   （dify/kb/<code>/ があるものだけ）
           test : python3 scripts/dify/run_tests.py --env $ENV <codes...>
      6  結果の要約を $GITHUB_STEP_SUMMARY に（合否表・所要秒・トークン。**出力全文は貼らない**）
      7  変更パスのガード（下記）
      8  ブランチ bot/dify-ops-<run_id> に commit → push → gh pr create
```

**成果物と、人が判断する場所**

| 成果物 | 形 | 誰が確定するか |
|---|---|---|
| `dify/results/<env>/<番号>-<YYYYMMDD-HHMM>.md` | 新規ファイル | **PR のマージ（人）** |
| `dify/state/<env>.yml`（W2 以降） | 更新 | 同上 |
| 合否のサマリ | ジョブサマリ（GitHub 上、commit しない） | — |
| 失敗の記録 | **自動では書かない。** `KNOWN_ISSUES.md` への `DI-xxx` 追記は人（原因の見立てが要るため） | 人 |

**main には直 push しない**（CLAUDE.md §5）。PR を作るところまでが自動、**マージは人**。

**変更パスのガード（load-bearing。実装必須）**

push の直前に `git diff --cached --name-only` を取り、**全部が次の正規表現に一致すること**を検査する。1 つでも外れたら push せずジョブを失敗させる：

```
^dify/results/[^/]+/[^/]+\.md$
^dify/state/[^/]+\.yml$
```

**なぜ**：ランナーが `docs/service-map.md`・`mock/**`・`dify/apps/**` を書き換えて PR に混ぜると、#121 の 4 番目の衝突（生成物の二重生成）がそのまま再発する。**実機側の自動 PR は「事実」以外を書かない**を機械で担保する。

**秘密がログに出ない**

- `set -x` を使わない。`run:` に `--dry-run` 以外の値展開を書かない
- スクリプト側は既にマスク済み（`console_api._mask()`／`run_tests.py` の `USER_AGENT` 経路）
- ジョブサマリに貼るのは **合否表だけ**。出力全文は結果ファイル（PR の diff）に閉じる
- third-party action を使うなら **commit SHA でピン留め**する（`actions/*` は公式。`peter-evans/create-pull-request` 等は使わず、`git` ＋ `gh` CLI で済ませる）

### 4-4 失敗時の切り戻し

| 状況 | 何が起きるか | 復旧 |
|---|---|---|
| ホストランナーが Dify に到達できない（Cloudflare 1010 等） | ジョブが exit 1／3 で失敗。PR は作られない。**Dify 側に副作用なし** | DI-004（独自 UA）で既に解決済みの症状。再発したら `run_tests.py` の `USER_AGENT` を確認 → Mac 手動経路へ |
| API キーが失効（401） | `run_tests.py` が exit 2（設定不備）。PR は作られない | PM が画面で再発行 → Environment secret を更新 |
| Environment の承認が来ない | ジョブは waiting のまま。**何も起きない** | PM が承認するか、実行をキャンセル |
| **Mac のランナーがオフライン（W3）** | ジョブは queued。`timeout-minutes` で失敗にする（既定の 24 時間放置にしない） | 失敗通知 → PM が Mac を起こして再実行。**または DEPLOY.md の手動経路** |
| ランナー自体を撤去した | `runner: mac` の実行が失敗するだけ。`hosted` は無傷 | ラベル規約と `DEPLOY.md` はそのまま残るので、運用は **W1 の状態まで退化するだけで止まらない** |

**従来の手動経路は削除しない。** `dify/DEPLOY.md` §1〜§6 と `.claude/commands/dify-deploy.md` は**そのまま残す**。W1〜W4 は「自動でもできる」を足すのであって、「手ではできない」にはしない。DEPLOY.md には §7 として「どの操作がどの実行場所で回せるか」の表（§1-1 の再掲）を足す。

---

## §5 ラベル規約（#121 の元の主題）

### 5-1 ラベル

| ラベル | 意味 | 色（提案） |
|---|---|---|
| `run:cloud` | **クラウドだけで完結する。** §1-1 の O1〜O10 をどれも含まない | 緑 `#0e8a16` |
| `run:mac` | **(a) のブラウザセッションが要る**（O1〜O4・O7・O8・O10 のいずれかを含む） | 橙 `#d93f0b` |
| `run:runner` | **(b)(c) だけが要る**（O5・O6）。ホストランナーで回せる | 青 `#1d76db` |
| `blocked:mac` | Mac 側の作業待ちで止まっている | 灰 `#cfd3d7` |
| `blocked:cloud` | クラウド側の作業待ちで止まっている | 灰 `#cfd3d7` |

**`for:` ではなく `run:` を推奨する理由**：これは「誰に頼むか（宛先）」ではなく「**どこで実行できるか（属性）**」である。宛先は assignee で表せば足り、属性は実行場所の判定に機械的に使える（W3 のワークフローが `run:mac` を見て起動する）。#121 コメントの `for:mac` / `for:cloud` から名前を変えるだけなので、PM が `for:` を選ぶなら 5 個の rename で済む（§12-2）。

**`run:runner` を分けた理由**：#121 コメントの 2 分類（`for:mac` / `for:cloud`）だと、O5・O6 が `for:mac` に落ちて **本書 §2 の発見が運用に反映されない**。3 分類にすることで「これは Mac を起こさずに済む」が一目で分かる。

### 5-2 付ける主体・タイミング

| いつ | 誰 | 何を |
|---|---|---|
| Issue 作成時 | **立てた人**（architect が設計 Issue を立てるとき／PM が要望を書くとき） | `run:*` を **必ず 1 つ**。判定は §1-1 の表を見て「O1〜O10 のどれを含むか」 |
| PR 作成時 | **implementer** | 対応する Issue と同じ `run:*` を 1 つ |
| 相手待ちになったとき | 止めた側 | `blocked:*` を足す。**`run:*` は外さない**（実行場所は変わらないため） |
| 相手に返すとき | 返す側 | コメントを書き、`blocked:*` を外す。実行場所が変わるなら `run:*` を付け替える |

**規約**

- **`run:*` は 1 つだけ。2 つ付くのは Issue を分割する合図**（#121 コメントの原則を踏襲）
- **`run:mac` の Issue は必ず「Mac が要る操作」を本文に列挙する**（O1〜O10 の番号で）。列挙できないなら `run:mac` ではない
- 着手したら自分に assign する（重複着手の防止）

### 5-3 機械検証

Issue のラベルは `tools/verify.mjs` の対象外（ローカルで GitHub を見ないため）。代わりに：

- **PR テンプレート**（`.github/pull_request_template.md`）に「実行場所：`run:cloud` / `run:runner` / `run:mac` のどれか」のチェック欄を足す（W1）
- **W3 のワークフローが `run:mac` を実質的な検証にする**（ラベルが付いていない Issue は Mac のジョブに乗らない）

---

## §6 設計と実機の事実を分ける（`dify/state/<env>.yml`）

### 6-1 要否 → **要る**

理由：#121 本文の結合 1・2 は、`env.yml` が「こうしたい（設計）」と「こうなっている（事実）」を同居させていることに起因する。ファイルを分ければ、**クラウド側の PR と Mac 側の自動 PR が同じ行を触らなくなる**。加えて DI-013（Cloud 側の下書きが Git と乖離していたのに誰も気づかなかった）に対して、**「いま Cloud に何が乗っているか」を Git 側で持つ**という答えになる。

### 6-2 境界

| | `dify/env/<env>/env.yml`（**設計値**） | `dify/state/<env>.yml`（**実機の事実**） |
|---|---|---|
| 意味 | こうしたい | こうなっている |
| 書く主体 | **人**（クラウドで編集可） | **機械のみ**（Mac ／ランナーの自動 PR）。手で編集しない |
| 例 | モデル・`completion_params`・KB の論理名・ブランド語彙・フラグ・`apps:` の**番号一覧** | app id・dataset id・公開時刻・投入した DSL のハッシュ・KB の文書一覧・最終テスト結果 |
| 無いとき | `render.py` が exit 2 | **`render.py` は成功する**（未解決＝警告。#121 の受け入れ条件） |
| PR の主体 | 設計側（`run:cloud`） | 実機側（`run:mac` / `run:runner` の自動 PR） |
| verify | §12（既存） | **§13（新設）** |

### 6-3 スキーマ（案）

```yaml
schema: 1
env: cloud-master
updated_at: '2026-09-08T09:40:00+09:00'
updated_by: hosted-runner        # 'mac' | 'hosted-runner' のみ。人名・メールは書かない
apps:
  KN-01:
    id: 00000000-0000-0000-0000-000000000000   # cloud-master のみ直値可（§6-4）
    published_at: '2026-09-08T01:20:00+09:00'
    dsl_sha256: '<64 hex>'      # 投入した dify/apps/<番号>-*.yml の SHA-256（Git のどの版が乗っているか）
    api_key: true               # 発行済みかどうかの真偽だけ。値は絶対に持たない
knowledge:
  KN-01:
    id: 00000000-0000-0000-0000-000000000000
    documents: ['工程条件書_旋盤ライン3.md', '設備保全内部規程と連絡先.md']   # ファイル名だけ
    indexed_at: '2026-09-08T09:10:00+09:00'
tests:
  KN-01:
    at: '2026-09-08T09:39:00+09:00'
    pass: 4
    fail: 0
    result: dify/results/cloud-master/KN-01-20260908-0939.md
```

**持たないもの**：API キーの値・トークン・Cookie・顧客の実名・実 URL・メール・パスワード・人名（`updated_by` は `mac` / `hosted-runner` の 2 値のみ）。

### 6-4 秘密の判定（`dify/state/` に id を直値で書いてよいか）

| env | app id | dataset id | git 追跡 |
|---|---|---|---|
| `cloud-master` | **直値可** | **直値可** | **追跡する** |
| `inhouse` / `customer-a` | 不可 | 不可 | **追跡しない**（`.gitignore`） |

根拠：`dify/env/README.md` は既に「アプリ id は URL に出るもので秘密ではない」とし、`cloud-master` の `apps.<番号>.id` に実 id を直値で書いてよいと定めている。`cloud-master` は `data/world/` の架空データしか入っておらず、id を知っても未認証では何もできない。一方、顧客環境の id は §2-10 が明示的に禁止している。

`.gitignore` に足す（W2）：

```
# 実機の事実。cloud-master 以外は追跡しない（CLAUDE.md §2-10）
dify/state/*.yml
!dify/state/cloud-master.yml
```

### 6-5 既存ツールへの影響（W2 の実装範囲）

| ファイル | 変更 |
|---|---|
| `scripts/dify/render.py` | `--state <path>`（既定 `dify/state/<env>.yml`、無ければ黙って無視）。R5 の `dataset_ids` 解決順を **`${VAR}` 環境変数 → state → env.yml** に。**state が無くても `--check` が 12/12 `[OK]`** |
| `scripts/dify/cloud_deploy.py` | `--write-env` → **`--write-state`**。書き先を `dify/state/<env>.yml` に。`--write-env` は 1 版だけ「非推奨」警告付きで残し、state に書く |
| `tools/verify.mjs` | §12-e は **`apps:` の番号一覧の一致だけを見る**（id は `null` 固定を要求）。**§13 を新設**：state のスキーマ・`updated_by` の値域・秘密の非混入・`cloud-master` 以外の state が追跡されていないこと |
| `dify/env/*/env.yml` | **変更不要**（`cloud-master` は既に全件 `id: null`）。**Mac の並行作業と衝突しない** |
| `dify/env/README.md` | 「`apps:`」節に「id は `dify/state/` が持つ」を追記 |

---

## §7 KNOWN_ISSUES と service-map の衝突（#121 本文 3・4）

### 7-1 `dify/KNOWN_ISSUES.md`

**採番の衝突が本体**（両側が同時に `DI-023` を採ると、どちらかが番号を振り直すことになり、Issue/PR の参照がずれる）。

推奨：**ID は `DI-` の 1 系列を維持し（永久欠番の台帳価値を壊さない）、採番帯と表を分ける。**

| 帯 | 誰が書くか | 中身 |
|---|---|---|
| `DI-001` 〜 `DI-499` | **実機側**（Mac ／ランナー） | 実際に観測した症状（HTTP ステータス・応答・画面の挙動） |
| `DI-500` 〜 | **クラウド側** | コードを読んで見つけた不整合（DI-003 の重複定義のような静的な発見） |

表も §A（実機で観測）／§B（コード上の発見）に分ける。**既存の DI-001〜DI-022 は動かさない**（うち DI-002・DI-003 はコード上の発見だが、番号を振り直すと過去の PR の参照が壊れるので §A に残し、備考に「コード上の発見」と書くだけにする）。

`git` の 3-way merge は節が違えば通るので、これで日常の追記競合はほぼ消える。

### 7-2 `docs/service-map.md`

生成物。両側で `npm run index` を打てるのが問題。

推奨：**再生成してよいのはクラウド側（`run:cloud`）だけ**とし、実機側の自動 PR は §4-3 の変更パスガードで構造的に書けなくする。`tools/verify.mjs` §11 の鮮度検査は現状のまま（PR で FAIL するので取りこぼさない）。CLAUDE.md §7（§9 の文案）に 1 行書く。

---

## §8 段階導入と PR 分割

### W1（最小・1 PR で入る）— **ホストランナーで KB とテストを回す**

**なぜこれが最小で効果があるか**：スクリプトを 1 行も変えずに、O5（KB 投入）と O6（テスト実行）が Mac から外れる。DI-007〜DI-022 で繰り返した「直す → 再テスト」の待ちが消える。セルフホストランナーの危険を持ち込まず、失敗しても Dify 側に副作用が無い。

| | 中身 |
|---|---|
| **PR-1** | `.github/workflows/dify-ops.yml`（新規・`workflow_dispatch` 限定・`ubuntu-latest`・Environment `dify-cloud-master`・入力検証・変更パスガード・結果ブランチ → 自動 PR）／`.github/pull_request_template.md`（新規・実行場所チェック欄）／`dify/DEPLOY.md` §7（実行場所の表・§1-1 の再掲）／本設計書／`CLAUDE.md` §7 の**文案**（適用は PM） |
| 触るファイル | `.github/workflows/dify-ops.yml`・`.github/pull_request_template.md`・`dify/DEPLOY.md`・`docs/handoff/**`（新規） |
| **触らない** | `dify/env/**`・`dify/apps/**`（Mac が並行作業中）・`scripts/**`・`tools/**`・`mock/**`・`.github/workflows/{verify,pages}.yml`・`.claude/**` |
| 前提 | PM が Environment `dify-cloud-master` と secrets を登録済み（§4-1・§12-1） |
| 並列 | PR-4 と並列可（ファイル集合が重ならない） |

### W2 — **設計と実機の事実をファイルで分ける**（#121 本文）

| | 中身 |
|---|---|
| **PR-2** | `dify/state/cloud-master.yml`（新規・空の骨格）／`.gitignore`／`scripts/dify/render.py`（`--state`）／`scripts/dify/cloud_deploy.py`（`--write-state`）／`tools/verify.mjs`（§12-e の緩和・§13 新設）／`scripts/dify/tests/`（新規テスト）／`dify/env/README.md` |
| **触らない** | `dify/env/*/env.yml`（変更不要。§6-5）・`dify/apps/**`・`mock/**` |
| 並列 | **不可**（`render.py`・`verify.mjs` を触る。#98 の投入作業が一段落してから。#121 本文の「着手のタイミング」どおり） |

### W3 — **Mac のセルフホストランナー**（§4-2 の S1〜S7 を全部満たす場合のみ）

| | 中身 |
|---|---|
| **PR-3** | `.github/workflows/dify-ops.yml` に `runner: mac` 経路と `op: deploy` を追加／`dify/DEPLOY.md` §8（ランナーのセットアップ手順：専用ユーザー・`--ephemeral`・ラベル `dify-mac`）／`docs/handoff/` に運用注意 |
| 前提 | PM が §12-3 を承認し、リポジトリ設定（§4-1 の 3 項目）を済ませていること |
| 並列 | PR-1 の後（同じワークフローファイル）。PR-2 とは並列可 |

### W4 — **Playwright 認証ブリッジ**（#114 案 2）

| | 中身 |
|---|---|
| **PR-4** | `scripts/dify/console_api.py` に browser 経路（Playwright でログイン → その文脈で `POST /console/api/...`）。`ENDPOINTS` と認証層だけを差し替え、`cloud_deploy.py` の冪等ロジックは無傷（#114 の報告どおり「ロジック自体は無傷」） |
| 前提 | **#114 の N2・N4 のリクエスト body を先に採取する**（現在未取得）。採取せずに実装すると作り直しになる |
| 並列 | PR-1・PR-2 と並列可（`scripts/dify/console_api.py` のみ） |

**順序の要点**：W1 は他のどれとも独立に効く。W3 は W1 の上に乗る。W4 は W3 の完成に必要だが、W3 無しでも Mac の手数を減らす。**W2 は #98 の投入が終わるまで着手しない。**

---

## §9 `CLAUDE.md` への追記案（§7 新設。**適用は PM**）

> CLAUDE.md の load-bearing を無断で変えない（architect の禁止事項）。以下は**文案**であり、本設計書の承認とは別に PM が採否を決める。

```markdown
## §7 実行場所の切り分け（どこで回せるか）

作業には 3 つの実行場所がある。**Issue と PR には `run:*` ラベルを必ず 1 つ付ける。**

| ラベル | 実行場所 | 回せるもの |
|---|---|---|
| `run:cloud` | クラウド（Claude Code on the web） | 設計・実装・レビュー・デモ・文書。ネットワークを使わない検証すべて |
| `run:runner` | GitHub ホストランナー（`workflow_dispatch` → `dify-ops.yml`） | KB 投入（`kb_upload.py`）・テスト実行（`run_tests.py`）。Environment `dify-cloud-master` の承認が要る |
| `run:mac` | PM の Mac（ブラウザのログイン済みセッションが要る） | DSL の投入・上書き・公開・KB 紐づけ・API キー発行・DSL エクスポート・モデル設定の確認 |

- 判定基準は `docs/handoff/2026-09-08-execution-split-and-runner.md` §1-1 の操作表（O1〜O10）
- **`run:*` は 1 つだけ。2 つ付くのは Issue を分割する合図**
- **設計値と実機の事実をファイルで分ける**：設計＝`dify/apps/`・`dify/kb/`・`dify/tests/`・`dify/env/<env>/env.yml`（人が書く。クラウド可）／実機の事実＝`dify/state/<env>.yml`・`dify/results/**`（機械だけが書く。手で編集しない）
- **実機側の自動 PR は `dify/results/**` と `dify/state/**` 以外を書かない**（ワークフローが機械で検査する）。`docs/service-map.md` の再生成はクラウド側だけが行う
- **秘密**：GitHub に置いてよいのは `cloud-master` の Service / Datasets API キーだけ（Environment secret `dify-cloud-master`）。**Dify のログイン情報・セッション Cookie は Mac から出さない**（§2-10）
- **公開リポジトリなのでセルフホストランナーは `workflow_dispatch` 限定・`--ephemeral`・専用ユーザーで動かす**（同設計書 §4-2 の S1〜S7）
```

---

## §10 受け入れ条件

### W1

- [ ] `.github/workflows/dify-ops.yml` のトリガが `workflow_dispatch` のみ（`pull_request` / `pull_request_target` / `schedule` を含まない）
- [ ] `runs-on: ubuntu-latest`（W1 ではセルフホストを一切参照しない）
- [ ] `environment: dify-cloud-master` を指定している。既定 `permissions:` が `contents: read`
- [ ] `codes` 入力が正規表現で検証され、shell に直接展開されていない（`env:` 経由）
- [ ] **A1（実証）**：ホストランナーから `run_tests.py --env cloud-master KN-01` を 1 回流し、**Cloudflare 1010 も 401 も出ずに結果ファイルが生成される**こと。403 が出た場合は DI として起票し、W1 の残りは保留
- [ ] push 直前の変更パスガードが実装され、`dify/results/**` と `dify/state/**` 以外が混ざると **push せずに失敗**する
- [ ] ジョブログ・ジョブサマリ・結果ファイル・PR 本文に API キーの値が出ない
- [ ] `node tools/verify.mjs` PASS ／ `node tools/regress.mjs` PASS（`--update` しない）
- [ ] 既存の `verify.yml`・`pages.yml` に差分が無い
- [ ] `dify/DEPLOY.md` の従来手順（§1〜§6）が削られていない

### W2

- [ ] **`dify/state/` が空でも** `python3 scripts/dify/render.py --env cloud-master --all --check` が 12/12 `[OK]`（素の shell、`DIFY_DATASET_ID_*` を source しない）
- [ ] `python3 dify/check.py` PASS（DSL 無変更）
- [ ] `node tools/verify.mjs` PASS（§12-e 緩和後・§13 新設）／`node tools/regress.mjs` PASS
- [ ] `dify/env/*/env.yml` に **1 バイトの差分も無い**
- [ ] `cloud_deploy.py --write-state` が `${VAR}` 行を書き換えず、`dify/state/<env>.yml` にだけ書く（単体テスト）
- [ ] `.gitignore` が `dify/state/cloud-master.yml` だけを追跡する
- [ ] **同じ時間にクラウド側とローカル側で作業しても `git pull --ff-only` が衝突しない**（#121 の受け入れ条件。設計側と実機側でファイルが重ならないことを reviewer が diff で確認）

### W3

- [ ] §4-2 の S1〜S7 が**全部**満たされていることを reviewer が 1 つずつ確認し、PR 本文にチェック結果を書く
- [ ] `runs-on: [self-hosted, macOS, dify-mac]`（`self-hosted` 単独でない）
- [ ] `timeout-minutes` が設定され、ランナーがオフラインでも 24 時間 queued にならない
- [ ] ランナーを止めた状態で `runner: hosted` の実行が影響を受けない

---

## §11 触らない範囲（本 Issue 全体）

- `mock/**`（デモ。本件と無関係）
- `data/world/**`
- `dify/apps/*.yml`（DSL 12 本。**1 バイトも変えない**）
- **`dify/env/**/env.yml`**（Mac が並行作業中。W2 でも変更不要＝ §6-5）
- `dify/kb/**`・`dify/tests/*.json`
- `dify/results/**`（機械が書く。設計では触らない）
- `.github/workflows/verify.yml`・`pages.yml`（**新規ファイルだけ足す**）
- `.claude/**`
- `tools/regress.mjs`・`tools/regress.baseline.json`
- `tools/verify.mjs` の §1〜§11（W2 で §12-e と §13 のみ）
- `CLAUDE.md`（**文案のみ。適用は PM**）

---

## §12 PM が判断すべき点（推奨つき）

| # | 判断 | 選択肢 | **推奨** | 理由 |
|---|---|---|---|---|
| **1** | `cloud-master` の API キーを GitHub Environment secret に複製してよいか | 可 / 不可 | **可** | 効果が最大（往復の半分が消える）。スコープが 1 アプリ／1 ナレッジで、画面から 1 分で再発行できる。`cloud-master` は架空データのみ（§2-10 で PM 確認済み）。**不可なら W1 は実施できず、ラベル規約と W2 だけになる** |
| **2** | ラベル名 | `run:cloud`/`run:runner`/`run:mac` / `for:cloud`/`for:mac`（#121 コメント案） | **`run:` の 3 分類** | 「宛先」ではなく「実行場所の属性」。2 分類だと O5・O6 が `for:mac` に落ちて §2 の発見が運用に反映されない。`for:` を選ぶなら rename 5 個で済む |
| **3** | Mac のセルフホストランナーを入れるか（W3） | 入れる（S1〜S7 必須） / 入れない（案 1 のポーリングで代替） | **W1・W2 を入れてから再判断。入れるなら S1〜S7 を全部満たす条件で** | 公開リポジトリなので残余リスクがある（§4-2）。W1 の効果を見てから、残る往復の量に見合うかを決める方が判断材料が揃う |
| **4** | ランナーを常駐させるか（S8） | 常駐 / 必要時だけ `--once` | **常駐**（S1〜S7 を満たす前提で） | 常駐しないと「往復をなくす」効果が半減する。攻撃面は S1（`workflow_dispatch` 限定）で構造的に閉じている |
| **5** | `dify/state/` の git 追跡範囲 | 全 env / `cloud-master` のみ | **`cloud-master` のみ**（他は `.gitignore`） | 顧客・社内環境の id は §2-10 が禁止。`cloud-master` の id は URL に出るもので秘密ではない（`dify/env/README.md` の既存判断と整合） |
| **6** | `dify/state/` に dataset id を直値で書いてよいか | 可 / `${VAR}` のまま | **`cloud-master` に限り可** | `${VAR}` のままだと「実機の事実を Git 側に持つ」という目的（DI-013 対策）を果たさない。verify §13 で `cloud-master` 以外の直値を FAIL にする |
| **7** | `cloud_deploy.py --write-env` の扱い | 即削除 / 1 版だけ警告付きで残す | **1 版だけ残す**（state に書き、非推奨警告を出す） | Mac 側の手順書・コマンドが移行しきるまでの猶予。次の版で削除 |
| **8** | `KNOWN_ISSUES.md` の分離方式 | 帯分け（DI-001〜499 実機／DI-500〜 コード）＋節分け / ファイル分割 / 現状維持 | **帯分け＋節分け** | 1 系列を保つので永久欠番の台帳価値が壊れない。既存 DI-001〜022 を動かさずに済む |
| **9** | 自動 PR をどこまで自動化するか | 結果を main へ直 push / PR 作成まで自動・マージは人 / アーティファクトのみ | **PR 作成まで自動・マージは人** | CLAUDE.md §5（main 直 commit 禁止）を守る。結果の中身は人が読む価値がある（DI の起票判断） |
| **10** | `CLAUDE.md` §7 の追記（§9 の文案） | 採用 / 修正して採用 / 見送り | **採用** | ラベル規約とファイル境界は 3 エージェント全員が読む場所にないと機能しない |
| **11** | W2 の着手タイミング | いま / #98 が一段落してから | **#98 が一段落してから**（#121 本文の指示どおり） | `render.py`・`verify.mjs` を触るので、投入作業と重なると混乱する |

---

## §13 未確認の前提（実装前に潰すもの）

| # | 未確認 | 影響 | いつ確定するか |
|---|---|---|---|
| **U1** | GitHub ホストランナー（`ubuntu-latest`）から `api.dify.ai` に到達できるか。Cloudflare が GitHub の egress を弾かないか | W1 が成立するか | **W1 の A1 で実証**（KN-01 を 1 本流す）。弾かれたら DI 起票 → W1 保留 |
| **U2** | `POST /console/api/apps/imports` のリクエスト body（`mode` / `yaml_content` / `app_id`）と `/workflows/draft` の body | W4 の実装形 | #114 の N2・N4。**Playwright の Network 記録で body が保存できなかった**ため未取得 |
| **U3** | サーバ側が publish のチェックリスト検証をするか（UI のクライアント検証を飛ばせるか） | W4 で公開まで自動化できるか | #114 N3 の続き |
| **U4** | `dataset_ids` を焼き込んだ DSL のインポートで KB が最初から紐づくか（C6） | O4 が消えるか（消えれば W3・W4 の価値が大きく上がる） | #114 N5。**未実施**（マスタが `dataset_ids: []` のため） |
| **U5** | GitHub の Environment required reviewers が `workflow_dispatch` で期待どおり止めるか | §4-1 の前提 | PM が Environment を作った直後に 1 回試す |

---

## §14 参照

- Issue #121（本文：ファイル境界／コメント：仕事の受け渡し）
- Issue #114（コメント 2026-09-08：N1〜N6 の実機観測。Cloud 1.17.0 に `console_token` が無い）
- `docs/handoff/2026-09-08-cloud-console-deploy.md`（前提が崩れた設計。認証の節は本書 §1-2 で置き換える）
- `docs/handoff/2026-09-07-repo-layout-v2.md` §3・§4（env レイヤーと render）
- `dify/DEPLOY.md`（§0 前提・§1 手順・§5 release・§6 sync_back）
- `dify/env/README.md`（環境台帳・`apps:` 節）
- `dify/KNOWN_ISSUES.md`（DI-004 Cloudflare 1010・DI-013 Cloud 乖離・DI-021 Playwright の allowed roots）
- `CLAUDE.md` §2-10（秘密）・§2-12（環境差分）・§3（検証）・§5（Git 運用）
