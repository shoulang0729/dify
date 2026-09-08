# 2026-09-08 W4：Dify Cloud の投入・公開・KB 操作を自動化する（＝ Mac を不要にする）

Issue: #121（W4）／関連: #114（認証の実機観測）・#84（構成 v2）・#82 / #98（投入と往復）
レーン: **M/L**（architect → 実装は implementer）
前提設計書: `docs/handoff/2026-09-08-execution-split-and-runner.md`（W1 は実装済み＝ `.github/workflows/dify-ops.yml`）
状態: 設計。実装は未着手
データ層（`CATS` / `SVCS` / `TAGS`）: **変更しない**（本件はモックに触らない）

---

## §0 要約（先に結論）

1. **いま Mac でしかできない 3 作業のうち 2 つは、認証を一切必要とせずに消せる。**
   - **KB の文書削除** → ナレッジ API（`dataset-` キー）に **`DELETE /v1/datasets/{dataset_id}/documents/{document_id}` が実在する**（Dify 本体ソースで確認）。さらに**削除せずに中身だけ差し替える更新 API** もある。`DIFY_DATASET_KEY` は W1 で既に Environment secret にあるので、**追加の秘密はゼロ**
   - **KB の紐づけ直し（U4）** → **真である可能性が高い。** Dify の DSL インポートは `dataset_ids` の各要素を `decrypt_dataset_id()` に通し、**「すでに素の UUID ならそのまま返す」**（ソースで確認）。つまり `dataset_ids` に素の UUID を焼き込んだ DSL をインポートすれば、**KB は最初から紐づく**。焼き込みの仕組み（`render.py` R5 ＋ `cloud_deploy.py --bind-kb dsl`）は**既に実装済み**で、必要なのは実機 1 本の確認と手順書の書き換えだけ
2. **したがって第 1 段階（W4-1）は「認証を要しない 2 つ」**にする。ここが終わると **Mac に残るのは「DSL の再インポートと公開」だけ**になる。
3. **認証はその次（W4-2 / W4-3）。** PM は **GitHub OAuth** でログインしているため、`console_api.py` の既存のメール／パスワード経路は**セルフホスト専用**の位置づけに落ちる。ホストランナーで GitHub OAuth を通す案は**採らない**（§7-0）。
4. **`console_api.py` は Cloud に対して 7 か所足りない**（§2。行番号つき）。最大の 2 つは **(G2) ログイン応答に `access_token` が無い**（Cloud/main はトークンを **Set-Cookie** で返す）と **(G4) `X-CSRF-Token` を送っていない**（`login_required` は **GET でも** CSRF を検査する）。#114 N1 の 401 はこれで説明が付く。
5. **Cookie 案（PM 承認済み）は成立する。ただし「1 回置けば 30 日もつ」ではない。** アクセストークンと CSRF トークンの寿命は既定 **60 分**、リフレッシュトークンは既定 **30 日だが 1 回使うと無効化される（rotate）**。現実的な形は **「投入する回ごとに、直前に 1 回取って置き、そのジョブで使い切り、最後に `logout` で無効化する」**（§8）。マスタ改訂のたびに 5 分の手作業で、Mac での 12 回のドラッグ＆公開が消える。
6. **セッション Cookie / アクセストークンは、サーバ側では IP にも User-Agent にも紐づいていない**（JWT ペイロードは `{user_id, exp, iss, sub}` のみ。§10）。残る不確実性は Cloudflare 側だけで、**ホストランナーから 1 回叩けば判定できる**。
7. **危険は「削除できる資格情報が CI に載る」こと。** 歯止めは §9（削除系 API をコードに存在させない・機械検査・承認ゲート・使い捨てセッション・publish は全件成功後）。
8. **W1 のワークフローに既存の欠陥を 1 件見つけた**：`kb_upload.py` が **dataset id と document id をそのまま標準出力に出す**。**公開リポジトリの Actions ログは誰でも読める**ので、`CLAUDE.md` §2-10 が「書かない」としている dataset id が実質公開される。W4-1 で同時に直す（§9-5）。

---

## §1 目的 / 変更する範囲 / 触らない範囲

### 1-1 目的

**「KB の文書削除」「12 本の再インポート」「KB の紐づけ直しと再公開」を、人が Mac の前に座らずに回せるようにする。**
ただし全部を一度に自動化しない。**認証を要しないものから消す。**

### 1-2 変更する範囲（段階ごと。§11 に PR 分割）

| 段階 | 触るファイル |
|---|---|
| **W4-1** | `scripts/dify/kb_upload.py`（文書の更新・置換・id のマスク）／`scripts/dify/tests/test_kb_upload.py`（新規）／`scripts/dify/tests/mock_server.py`（エンドポイント追加）／`.github/workflows/dify-ops.yml`（`op` の追加）／`dify/DEPLOY.md` §2（KB の節）／`tools/verify.mjs` §14（新設・削除系の機械検査） |
| **W4-2** | `dify/DEPLOY.md` §1-④・§8（再インポート手順の書き換え）／`dify/env/README.md`（1 行）。**コード変更なし**（焼き込みは実装済み） |
| **W4-3** | `scripts/dify/console_api.py`（Cloud 認証層）／`scripts/dify/tests/test_console_api.py`／`scripts/dify/env.example` |
| **W4-4** | `.github/workflows/dify-ops.yml`（`op: deploy`）／`dify/DEPLOY.md` §9 |

### 1-3 触らない範囲（明示）

- `mock/**`（デモ。本件と無関係。**データ層 `CATS`/`SVCS`/`TAGS` の変更は 0 件**）
- `data/world/**`
- **`dify/apps/*.yml`（DSL 12 本。1 バイトも変えない）** — 焼き込みは `dify/build/`（`.gitignore` 済み）に対してのみ行う
- **`dify/env/**/env.yml`** — W4-2 でも**変更不要**（`knowledge.*.id` は `${DIFY_DATASET_ID_*}` のままでよい）
- `dify/kb/**`・`dify/tests/*.json`・`dify/results/**`
- `.github/workflows/verify.yml`・`pages.yml`
- `.claude/**`
- `tools/regress.mjs`・`tools/regress.baseline.json`・`tools/verify.mjs` の §1〜§13（**§14 を新設するだけ**）
- `CLAUDE.md`（**文案のみ。適用は PM**）
- `scripts/dify/render.py`・`sync_back.py`・`release.py`・`cloud_deploy.py`（W4-1・W4-2 では触らない）

---

## §2 `console_api.py` は Cloud に対して何が足りないのか（具体）

**調べ方**：`scripts/dify/console_api.py` を全行読み、Dify 本体（`langgenius/dify` の `main`、2026-09-08 に `raw.githubusercontent.com` から取得）の認証実装と突き合わせた。**推測ではなくソースの引用で書く。**
**注意**：引用元は `main`。Cloud は `current_version=1.17.0`（#114 N1）。**版差の可能性は残る**ので、§13 の V1 で実機確認する。ただし #114 の実機観測（`__Host-csrf_token` が JS から見える／`x-csrf-token` ヘッダが付く／`authorization` ヘッダが無い／CSRF 無しの `fetch` が 401）は、以下のソースの挙動と**すべて一致する**。

### 2-1 Dify 側の認証の実体（ソース）

| # | 事実 | 出典（`langgenius/dify` main） |
|---|---|---|
| S1 | アクセストークンは **Cookie `__Host-access_token`（httpOnly）** から取る。**無ければ `Authorization: Bearer` ヘッダからも取る** | `api/libs/token.py` `extract_access_token()` = `extract_console_cookie_token(request) or _try_extract_from_header(request)` |
| S2 | `login_required` は認証後に **必ず `check_csrf_token(request, user.id)` を呼ぶ**。`OPTIONS` 以外の**全メソッド**（GET も）が対象 | `api/libs/login.py` `login_required` 内「we put csrf validation here for less conflicts」 |
| S3 | CSRF 検査は **ヘッダ `X-CSRF-Token` と Cookie の CSRF 値が一致**し、かつその値が **JWT として検証でき `sub == user.id`・未失効**であること | `api/libs/token.py` `check_csrf_token()` |
| S4 | CSRF が不要なのは **`/console/api/apps/<uuid>/workflows/draft`** と アーカイブ DL の 2 経路だけ | 同 `CSRF_WHITE_LIST` |
| S5 | **ログインは応答本文にトークンを返さない。** `{"result": "success"}` を返し、**access / refresh / csrf の 3 つを Set-Cookie で返す** | `api/controllers/console/auth/login.py` `LoginApi.post` → `_token_response()` |
| S6 | **リクエストの `password` はフロントが base64 した値**で、サーバが base64 デコードする。デコード不能なら `AuthenticationFailedError` | `wraps.py` `decrypt_password_field` → `_decrypt_field` → `libs/encryption.py`（「Base64 encoding for obfuscation」） |
| S7 | メール／パスワードのログイン自体が**機能フラグで無効化されうる**（無効なら **403**） | `wraps.py` `email_password_login_enabled`（`SystemFeatureService.is_email_password_login_enabled()`） |
| S8 | アクセストークン既定寿命 **60 分**、リフレッシュトークン **30 日**。CSRF Cookie の `max_age` は**アクセストークンと同じ 60 分** | `api/configs/feature/__init__.py`（`ACCESS_TOKEN_EXPIRE_MINUTES=60` / `REFRESH_TOKEN_EXPIRE_DAYS=30`）・`libs/token.py` `set_csrf_token_to_cookie` |
| S9 | **`POST /console/api/refresh-token` は `login_required` でも CSRF 必須でもない。** Cookie のリフレッシュトークンだけを見て、新しい 3 点セットを Set-Cookie で返す | `login.py` `RefreshTokenApi.post` |
| S10 | **リフレッシュは 1 回きり**（rotate で古い値を Redis から削除して新しい値を保存する） | `api/services/account_service.py` `rotate_token_pair()` |

### 2-2 `console_api.py` の穴（行番号は現行 main のファイル）

| # | 穴 | 場所 | Cloud で何が起きるか |
|---|---|---|---|
| **G1** | **Cookie を保持しない。** `urllib.request.Request` を素で使い、`HTTPCookieProcessor` も opener も無い | L119〜142 `_req()` | ログインが成功しても `Set-Cookie`（S5）が捨てられ、次のリクエストに何も載らない |
| **G2** | **ログイン応答から `access_token` を読もうとする。** 無ければ例外で停止 | L152〜160 `login()` | Cloud/main の応答は `{"result":"success"}`（S5）。**`ConsoleAPIError("login: access_token がレスポンスにありません")` で必ず止まる。ここが最初の失敗点** |
| **G3** | **`password` を平文で送る** | L154 | サーバは base64 デコードする（S6）。平文はデコードに失敗する（または別の文字列に化ける）ので **認証失敗**。base64 で送る必要がある |
| **G4** | **`X-CSRF-Token` を送らない／CSRF Cookie も持たない** | L121〜125 `_req()` のヘッダ組み立て | **たとえ Bearer が通っても `login_required` の CSRF 検査（S2・S3）で 401**。#114 N1 の「CSRF ヘッダ無しの `fetch` が 401」と一致 |
| **G5** | **`DIFY_CONSOLE_TOKEN`（localStorage の `console_token`）前提の設計が全体に残っている** | L13〜28 の docstring・L66〜72 `TOKEN_HELP`・L113〜117 `set_token()`・L241〜258 `client_from_env()` | 1.17.0 に `console_token` は存在しない（#114 N1）。環境変数名・ヘルプ文言ごと置き換えが要る |
| **G6** | **トークンの更新経路が無い** | 全体 | アクセストークンは 60 分（S8）。12 本の投入が 60 分を超えると途中で 401 になり、回復できない。`/console/api/refresh-token`（S9）を実装する必要がある |
| **G7** | **マスクが Cookie / CSRF を対象にしていない** | L76〜79 `_MASK_PATTERNS`（`Bearer …` と `app-…` のみ） | Cookie 値・CSRF 値が例外本文やログに出うる。**公開リポジトリの Actions ログは誰でも読める**ので、送るなら同時にマスクを広げる必要がある |

**結論**：`console_api.py` の Cloud 対応は「エンドポイント表の修正」ではなく **認証層（G1〜G4・G6・G7）の作り直し**である。逆に言えば **`ENDPOINTS`・冪等ロジック・`cloud_deploy.py` は無傷**で、直すのは `_req` と `login` の周辺に閉じる。

---

## §3 いま Mac でしかできない操作 —— 自動化できるかの判定

**確認済み**＝ Dify 本体のソースかコード上の実装で経路が確定しているもの。**未確認**＝ 実機（Cloud 1.17.0）で確かめていないもの。

| # | 操作 | API で置き換えられるか | 認証 | 状態 |
|---|---|---|---|---|
| **A1** | **KB の文書削除** | **できる**。`DELETE /v1/datasets/{dataset_id}/documents/{document_id}` → **204** | **ナレッジ API キー**（`dataset-`。W1 で登録済み） | **確認済み（ソース）**：`api/controllers/service_api/dataset/document.py` `DocumentApi.delete`。404=文書なし / 403=アーカイブ済み / インデックス中は削除不可 |
| **A2** | **KB の文書を「消さずに」差し替え** | **できる**。`POST /v1/datasets/{id}/documents/{doc_id}/update-by-text`、ファイルは canonical リソースへの **`PATCH /v1/datasets/{id}/documents/{doc_id}`**（旧 `…/update-by-file`） | 同上 | **確認済み（ソース）**：同ファイル `DocumentUpdateByTextApi` / `DocumentApi.patch`。**未確認**：1.17.0 に canonical `PATCH` があるか、multipart のフィールド名（V3） |
| **A3** | **KB の文書一覧** | できる。`GET /v1/datasets/{id}/documents`（`id`・`name` が返る） | 同上 | **確認済み**（`kb_upload.py` が現に使っている） |
| **A4** | **KB の作成・文書投入** | できる（実装済み） | 同上 | **確認済み**（W1 で CI 化済み） |
| **A5** | **DSL の新規インポート** | できる。`POST /console/api/apps/imports` | **コンソール認証** | エンドポイントは確認済み（#114 コメント／ソース）。**認証が未解決**（§2） |
| **A6** | **DSL の上書きインポート** | できる。同上に `app_id` を渡す | 同上 | パスは確認済み。**body の実形は未取得（#114 U2）／認証未解決** |
| **A7** | **アプリの公開** | できる。`POST /console/api/apps/{id}/workflows/publish` → 200 | 同上 | **確認済み（実機 N3）**。ただし **UI 側のチェックリスト検証を飛ばせるかは未確認**（U3） |
| **A8** | **KB の紐づけ** | **そもそも不要にできる**（§5） | — | `dataset_ids` の焼き込みで消える見込み。**実機未確認（V2）** |
| **A9** | **API キーの発行** | できる。`POST /console/api/apps/{id}/api-keys` → 201、`token` は平文 | コンソール認証 | **確認済み（実機 N6）**。ただし **CI で発行すると平文キーがジョブの文脈に載る**ので、W4 では**やらない**（§9-4） |

---

## §4 【最優先 1】KB の文書を、認証を増やさずに入れ替える

### 4-1 何が確認できたか

`api/controllers/service_api/dataset/document.py`（`main`）に、ナレッジ API（`DatasetApiResource` ＝ `Authorization: Bearer dataset-…`）で使える次のルートが実在する。

```
GET    /v1/datasets/{dataset_id}/documents                                 一覧（id / name / 状態）
POST   /v1/datasets/{dataset_id}/document/create-by-file                    新規（kb_upload.py が使用中）
POST   /v1/datasets/{dataset_id}/documents/{document_id}/update-by-text     本文の差し替え（削除しない）
PATCH  /v1/datasets/{dataset_id}/documents/{document_id}                    ファイルでの差し替え（削除しない）
DELETE /v1/datasets/{dataset_id}/documents/{document_id}                    削除 → 204
```

**したがって「同名文書があるから手で消す」という作業は、コンソール認証と無関係に消せる。**
`kb_upload.py` は既に一覧を取り、同名をスキップしている（`existing = {d.get("name") …}`）ので、**同じループで `id` を拾えば足りる**。

### 4-2 設計（`kb_upload.py` の契約）

**既定の挙動は今と同じ（同名はスキップ）。** 追加するのは 2 つのフラグだけ。

| フラグ | 意味 | 使う API | 危険度 |
|---|---|---|---|
| （なし・既定） | 同名文書はスキップ | — | 無 |
| **`--refresh`** | **同名文書の中身だけ差し替える（削除しない）**。文書 id は保たれる | `PATCH …/documents/{id}`（無ければ `POST …/update-by-file`） | 低（元に戻せる。Git が正本） |
| **`--replace`** | 同名文書を**削除してから**入れ直す | `DELETE` → `create-by-file` | **中**（一時的に KB から消える） |

**推奨は `--refresh` を第一候補にすること。** 削除を伴わないので事故のとき失うものが無い。`--replace` は「更新 API が 1.17.0 に無かった」「更新ではチャンク設定が変わらない」場合の逃げ道として置く。

**歯止め（すべて必須。実装の受け入れ条件にする）**

| # | 歯止め | なぜ |
|---|---|---|
| **K1** | **削除・更新の対象は「`dify/kb/<管理番号>/` に実在するファイル名と完全一致する文書」だけ。** 一致しない文書には触れない | KB 全消しを構造的に不可能にする。Git に無い文書は絶対に消えない |
| **K2** | **1 回の実行で削除できる文書数の上限（`MAX_DELETE = 5`）。** 超えたら 1 件も削除せず exit 1 | 想定外の一致（KB の取り違え）で大量に消えるのを止める |
| **K3** | **削除は 1 文書ずつ「削除 → 直後に再投入」**。全部消してから入れ直さない | 途中で失敗しても、欠けるのは最大 1 文書 |
| **K4** | **`DELETE /datasets/{id}`（KB そのものの削除）は実装しない。** コードに書かない | KB を丸ごと失う経路を存在させない |
| **K5** | **`--replace` は `--dry-run` と併用したとき、削除予定の文書名を列挙して終了する**（削除しない） | 人が対象を目で確かめられる |
| **K6** | **CI（`dify-ops.yml`）では `--replace` を `op: kb_replace` として分離し、`codes` は 1 件のみ許可**。`op: kb_upload` からは呼べない | 「テストのついでに消えた」を起こさない |
| **K7** | **削除の前に、その文書の `id` と `name` を Job Summary に出す（id はマスク）**。実行後に「何を消したか」が残る | 事後に追える |
| **K8** | **機械検査**：`tools/verify.mjs` §14（新設）が `scripts/dify/**.py` を走査し、**`"DELETE"` を渡す HTTP 呼び出しが `kb_upload.py` の 1 関数だけ**であることを確認する。他ファイル（`console_api.py` など）に現れたら **FAIL** | 「削除系 API を呼ばない」を人の注意力ではなく機械で担保する（§9-1） |

### 4-3 壊れたときの復旧

| 失敗 | 起きること | 復旧 |
|---|---|---|
| `--refresh` が 4xx | 文書は元のまま。何も失われない | フラグ無しで再実行すれば従来どおり |
| `--replace` で削除後にアップロードが失敗 | **その 1 文書だけ KB から欠ける** | **`python3 scripts/dify/kb_upload.py --env cloud-master <番号>`（フラグ無し）を再実行**すれば、同名文書が無いので再投入される。**正本は `dify/kb/<番号>/`（Git）なので内容は失われない** |
| インデックス中で削除できない（`DocumentIndexingError`） | 4xx で停止。KB は無傷 | 数分待って再実行 |
| ナレッジ API キーが失効 | 401 で停止。KB は無傷 | PM が画面で再発行 → Environment secret を更新 |

---

## §5 【最優先 2】U4 —— `dataset_ids` を焼き込めば KB は紐づくか

### 5-1 判定：**真である可能性が高い（ソース根拠あり）。実機 1 本で確定できる。**

Dify のインポート処理は、`knowledge-retrieval` ノードの `dataset_ids` を**そのまま使わず、1 件ずつ復号関数に通す**：

```
api/services/app_dsl_service.py（import 側）
  for node in graph.get("nodes", []):
      if node["data"]["type"] == KNOWLEDGE_RETRIEVAL:
          node["data"]["dataset_ids"] = [ decrypt_dataset_id(encrypted_data=dataset_id, tenant_id=app.tenant_id) ... ]

api/services/app_dsl_service.py（decrypt_dataset_id）
  """AES decryption with fallback to plain text UUID"""
  if cls._is_valid_uuid(encrypted_data):     # ← ここ
      return encrypted_data                  # ← 素の UUID はそのまま通る
```

- **エクスポート側は暗号化する**（同ファイル、`encrypt_dataset_id`）。#114 の DI-015 が「暗号化された `dataset_ids`」を観測しているのはこれ。
- **インポート側は素の UUID を素通しする。** よって **`dataset_ids: ['<KB の UUID>']` を焼き込んだ DSL をインポートすれば、下書きの知識検索ノードに KB が紐づいた状態で入る。**
- 紐づけば **N3 の公開チェックリスト（KB 未選択だと publish が発火しない）も通る**はず。→ V2 で同時に確認する。

### 5-2 焼き込む仕組みは**すでにある**（新規実装は不要）

| 部品 | 状態 |
|---|---|
| `scripts/dify/render.py` **R5** | `knowledge.<管理番号>.id` を `dataset_ids` に焼き込む。**実装済み** |
| `dify/env/cloud-master/env.yml` `knowledge:` | `KN-01/KN-02/KN-03/GN-01` の 4 件が `${DIFY_DATASET_ID_*}`。**変更不要** |
| `scripts/dify/cloud_deploy.py` `--bind-kb dsl`（既定） | 「render 済み DSL に焼き込まれている前提で、紐づけ操作を何もしない」。**実装済み**、単体テスト **T8** で焼き込みを機械確認済み |
| 出力先 | `dify/build/<env>/`。**`.gitignore` 済み**（`dify/build/`） |
| `scripts/dify/sync_back.py` **N1** | 書き戻し時に `dataset_ids` を必ず `[]` に戻す。**マスタに実 id が混入しない**ことが担保済み |

**つまり W4-2 の実体は「コードを書くこと」ではなく「手順を変えること」**：Mac で UI からインポートするとき、**`dify/apps/<番号>-*.yml`（マスタ）ではなく `dify/build/cloud-master/<番号>-*.yml`（render 出力）を選ぶ**。それだけで紐づけ直しが消える。

```bash
# Mac（~/.config/dify/cloud-master.env に DIFY_DATASET_ID_* がある前提）
source ~/.config/dify/cloud-master.env
python3 scripts/dify/render.py --env cloud-master --all       # → dify/build/cloud-master/*.yml
# この 12 本を UI の「DSL をインポート → 上書きしてインポート」で流す
```

### 5-3 `--check` のバイト一致（`CLAUDE.md` §2-12）を壊さないか

**壊さない。ただし条件がある。**

- `render.py` R5 は `knowledge.<番号>.id` が **null / 未解決なら焼き込まない**（「未解決・警告」を出すだけ、exit 1 にしない）。`cloud-master` の env は `${DIFY_DATASET_ID_*}` なので、**環境変数が無い素の shell では未解決 → 出力はマスタとバイト一致**する。
- 逆に **`DIFY_DATASET_ID_*` を `export` した shell で `--check` を回すと `[DIFF]` になる**（`dify/env/README.md` に既記載）。これは仕様であって退行ではない。
- したがって受け入れ条件は **「`DIFY_DATASET_ID_*` を source していない素の shell で `render.py --env cloud-master --all --check` が 12/12 `[OK]`」**（現行の条件と同じ。変更なし）。
- **`dify/apps/*.yml` は 1 バイトも変えない。** 焼き込みは `dify/build/` にしか起きない。

### 5-4 確かめ方（V2。Mac で 1 本だけ・10 分）

1. `source ~/.config/dify/cloud-master.env && python3 scripts/dify/render.py --env cloud-master KN-02`
2. 出力 `dify/build/cloud-master/KN-02-*.yml` の `dataset_ids:` に **UUID が 1 件入っている**ことを目視（**値は Issue に貼らない**）
3. Cloud の Studio で **KN-02 を開く → 「DSL をインポート」→「上書きしてインポート」** に **build 側の** ファイルを渡す
4. **知識検索ノードを開き、KB が選択済みかを見る** ← これが U4 の答え
5. そのまま **公開**を押し、チェックリストに引っかからずに `POST …/workflows/publish` が飛ぶかを見る（N3 の裏返し）
6. `python3 scripts/dify/run_tests.py --env cloud-master KN-02`（またはホストランナーの `dify-ops`）で **検索が効いているか**を確認
7. 結果を Issue #121 に「V2：真／偽」で 1 行報告（**UUID は書かない**）

**偽だった場合**：`cloud_deploy.py --bind-kb draft`（`get_draft` / `update_draft` で紐づける経路）が実装済みだが、これは**コンソール認証が要る**ので W4-3 待ちになる。その場合 A8 は Mac に残る。

---

## §6 この 2 つが通ったとき、Mac に残る作業

| 作業 | W4-1・W4-2 の後 |
|---|---|
| KB の文書削除 | **消える**（ホストランナーの `dify-ops` から `op: kb_refresh` / `kb_replace`） |
| KB の紐づけ直し | **消える**（`dataset_ids` 焼き込み。V2 が真なら） |
| 再公開（紐づけ直しに伴うもの） | **消える**（インポート直後に 1 回公開するだけになる） |
| **DSL の再インポート（12 本）＋ 公開** | **残る**（コンソール認証が要る。§7 以降） |
| DSL のエクスポート（`sync_back` の入力） | 残る（頻度は低い） |
| モデル設定・課金の確認 | 残る（そもそも自動化しない） |

**Mac の作業時間は「12 本 ×（インポート＋紐づけ＋公開）」から「12 本 ×（インポート＋公開）」に減り、KB の手作業は消える。** さらに §7 が解ければ 0 になる。

---

## §7 認証をどう解くか（4 案の比較）

### 7-0 前提：**GitHub OAuth のログインを CI で通す案は採らない**

PM は Dify Cloud に **GitHub アカウント（OAuth）** でログインしている。ホストランナーで OAuth を通すには **GitHub 本体の ID／パスワード（＋ 2 段階認証）を CI に置く**ことになる。

- **GitHub アカウントの資格情報は、Dify のアカウントより桁違いに強い**（このリポジトリの main への push、secrets の書き換え、他リポジトリすべて）
- 2 段階認証を CI で通すには TOTP のシード（＝ 2 要素の意味を消す秘密）を置くことになる
- **`CLAUDE.md` §2-10 の趣旨（秘密は最小スコープ・失効しやすいものだけ）に真っ向から反する**

→ **この道は採らない。** 以降の案はすべて「GitHub のログイン情報を CI に置かない」ことを前提にする。

### 7-1 比較

| | **A. `requests` でメール／パスワードログイン** | **B. Cookie（リフレッシュトークン）を secret に置く** | **C. Playwright にログインさせ、その文脈で API** | **D. Mac にセルフホストランナー常駐** |
|---|---|---|---|---|
| 前提 | Dify アカウントにパスワードが設定できること | 人が 1 回ブラウザからトークンを取り出せること | ブラウザを動かせる場所があること | Mac が常時起動 |
| **いまの可否** | **不可**（PM 確認：設定画面に「パスワードを設定」が無い）。パスワード再設定の導線が使えれば復活＝ **§12 の付録・確認要** | **可**（PM 承認済み） | 可。ただし**ホストランナーでも Mac でも動く**が、ログインには人の操作が要る（OAuth のため）→ **結局 Mac** | 可 |
| **ホストランナーで完結するか** | **する**（パスワードがあれば） | **する** | しない（OAuth のログインに人が要る） | しない |
| 秘密の置き場 | メール＋パスワード（Environment secret） | **リフレッシュトークン 1 個**（Environment secret） | 置かない（ブラウザプロファイル内） | 置かない（Mac のローカル） |
| 秘密の強さ | **強い**（アカウント全体・失効しにくい） | 強いが**使い捨てにできる**（§8-6） | — | — |
| 壊れやすさ | 低（`/console/api/login` は安定） | 中（トークン寿命の運用が要る） | **高**（UI 変更で壊れる。#114 の N2・N4 は body すら採れていない） | 中（スリープ・ランナー更新） |
| 実装量 | 小（`console_api.py` の認証層のみ） | **小〜中**（同じ認証層 ＋ refresh 1 本） | 大（Playwright 常駐・寿命管理） | 中（＋ §4-2 の S1〜S7 という重い安全条件） |
| 失敗したとき | 401 で停止。**Dify 側に副作用なし** | 401 で停止。**副作用なし** | 認証できず停止 | ジョブが queued のまま／**公開リポジトリでは Mac が攻撃面になる** |
| 公開リポジトリでの安全性 | Environment 承認で可 | Environment 承認で可 | 影響なし | **既定では危険**（前設計書 §4-2） |

### 7-2 推奨

> **推奨：まず W4-1（§4・§5＝認証を要しない削減）。認証は B（Cookie／リフレッシュトークン）を本命とする。C は採らない。D は最後の手段として残すが、いまは採らない。A はパスワード再設定の導線が使えたら復活させる（§12 付録）。**

理由：
1. **B は「ホストランナーで完結する」唯一の実用案**である。C は結局ブラウザの前に人が要るので「Mac を不要にする」という目的を満たさない。
2. **B の秘密は使い捨てにできる**（ジョブの最後に `logout` して無効化する。§8-6）。漏れても実行後には死んでいる。これは A（パスワード）より優れた性質である。
3. **D は目的（Mac を不要にする）と正反対**であり、公開リポジトリでの残余リスクも大きい。
4. **A が復活すれば最良**（秘密を 1 回置けば以後の手作業ゼロ）。ただし **PM 確認済みで UI からは不可**。§12 付録の確認だけ残す。

---

## §8 Cookie 案の詳細設計（PM 承認済み。認証の本命）

**この案の勘所は「取り方」ではなく「切れたときにどうなるか」。以下はすべてソース根拠つきで書く。**

### 8-1 何を保存するのか —— **保存するのはリフレッシュトークン 1 個だけ**

Dify のコンソールセッションは **3 つのトークン**でできている（`api/libs/token.py` `_token_response`）。

| トークン | Cookie 名（Cloud） | JS から見えるか | 既定寿命 | CI で使うか |
|---|---|---|---|---|
| アクセストークン | `__Host-access_token` | **見えない**（httpOnly） | **60 分** | ジョブ内で作る（保存しない） |
| CSRF トークン | `__Host-csrf_token` | **見える**（httpOnly ではない。#114 N1 で観測済み） | **60 分** | ジョブ内で作る（保存しない） |
| リフレッシュトークン | `__Host-refresh_token` | **見えない**（httpOnly） | **30 日**（ただし §8-3） | **これだけを secret に置く** |

**「Cookie だけ保存しても動くか？」への答え**：

- **CSRF トークンは Cookie とは別に必要**。`login_required` は **GET でも** `X-CSRF-Token` ヘッダを検査し、**ヘッダの値と Cookie の値が一致**し、かつ **JWT として検証でき `sub` がユーザ id・未失効**であることを要求する（`check_csrf_token`）。**したがって「ヘッダに送る値」と「Cookie に載せる値」の両方が要る（同じ値でよい）。**
- **リクエストごとに更新されるわけではない**。CSRF トークンは**ログイン／リフレッシュのときに 1 回発行**され、以後は同じ値を使い回せる（`generate_csrf_token` は `{exp, sub}` の JWT を発行するだけで、リクエストごとの更新機構は無い）。→ **「Cookie だけ保存しても動かない」問題は起きない。** ただし**寿命が 60 分**なので、保存する意味がない。
- アクセストークンは **`Authorization: Bearer` ヘッダでも受け付けられる**（`extract_access_token()` が Cookie → ヘッダの順に見る）。**Cookie ジャーを持たずに Bearer ＋ CSRF ヘッダ ＋ CSRF Cookie だけでも通る**（CSRF は Cookie とヘッダの一致が要るので、CSRF Cookie だけは送る必要がある）。

**結論**：保存するのは **リフレッシュトークン 1 個**。ジョブの冒頭で

```
POST /console/api/refresh-token
Cookie: __Host-refresh_token=<secret の値>
（login_required でも CSRF 必須でもない ← RefreshTokenApi はどちらのデコレータも持たない）
→ 200 + Set-Cookie ×3（新しい access / csrf / refresh）
```

を 1 回叩いて、**その回だけ使う 3 点セットを手に入れる**。

### 8-2 有効期限（ソース値。Cloud の実値は確認要 V4）

| 値 | 既定 | 出典 |
|---|---|---|
| アクセストークン | **60 分** | `ACCESS_TOKEN_EXPIRE_MINUTES: PositiveInt = 60` |
| CSRF トークン（Cookie の `max_age` も同じ） | **60 分** | `set_csrf_token_to_cookie(max_age=60 * ACCESS_TOKEN_EXPIRE_MINUTES)` |
| リフレッシュトークン | **30 日** | `REFRESH_TOKEN_EXPIRE_DAYS: PositiveFloat = 30` |

**Cloud がこの既定値を使っているかは未確認（V4）。** 確かめ方は §8-5 の運用そのもの（1 回置いて、翌週使えるかを見る）。

### 8-3 **最重要：リフレッシュトークンは 1 回使うと死ぬ**

```
api/services/account_service.py rotate_token_pair()
  new_refresh_token = _generate_refresh_token()
  AccountService._delete_refresh_token(refresh_token, account_id)   # ← 古い値を Redis から削除
  AccountService._store_refresh_token(new_refresh_token, account_id)
```

つまり **「1 回 secret に置けば 30 日間そのまま使える」わけではない**。**1 ジョブ実行につき 1 回**、値が入れ替わる。取りうる運用は 3 つ：

| 運用 | 中身 | 評価 |
|---|---|---|
| **R-a 使い切り（推奨）** | 投入する回ごとに、人が直前に 1 回取って Environment secret を更新 → そのジョブで使い切る → **ジョブ末尾で `logout` して無効化** | **手間は「投入回あたり 1 回・3 分」**。マスタ改訂は毎日ではないので許容できる。**漏れても実行後は死んでいる**のが最大の利点 |
| R-b 書き戻し | ジョブが新しいリフレッシュトークンを **Environment secret に書き戻す**（REST `PUT …/environments/{env}/secrets/{name}`、libsodium 暗号化） | `GITHUB_TOKEN` では**書けない**。**`secrets: write` を持つ PAT が新たに要る**＝ リポジトリの秘密を書き換えられる強い資格情報が 1 つ増える。**採らない**（§9-4） |
| R-c 放置 | 1 回置いたまま何度も使う | **2 回目で必ず 401**（rotate 済み）。**成立しない** |

**推奨は R-a。**「1 回置けば 30 日」という期待は**成立しない**ことを、PM にはっきり伝える必要がある（§12 判断 4）。

### 8-4 切れたとき、ワークフローは何をするか（実装契約）

**黙って失敗させない。** `console_api.py` の Cloud 認証層は、次を厳密に区別して**別々の終了コードとメッセージ**を出す。

| 事象 | 判定 | 終了コード | メッセージ（値は一切出さない） |
|---|---|---|---|
| `POST /refresh-token` が 401 | **セッションの期限切れ、または既に 1 回使われた** | **3** | 「**Dify Cloud のセッションが期限切れです（または既に使用済み）。`dify/DEPLOY.md` §9 の手順でリフレッシュトークンを取り直し、Environment secret `DIFY_CONSOLE_REFRESH` を更新してください。**」＋ Job Summary に同文 |
| `refresh-token` が 200、その後の API が 401 | **CSRF の組み立てが誤っている**（トークンは生きている） | **3** | 「CSRF ヘッダ／Cookie の不一致。実装の不具合として報告してください（V1 の再確認が要る）」 |
| その後の API が **403 かつ本文に `1010`** | **Cloudflare がランナーを弾いた**（DI-004 と同じ症状） | **4** | 「Cloudflare に弾かれました。独自 User-Agent が付いているか確認してください（DI-004）」 |
| ジョブ途中で 401（60 分超え） | アクセストークンの寿命切れ | — | **メモリに持っている最新のリフレッシュトークンで 1 回だけ自動再取得**して継続。それも失敗したら上の 401 と同じ扱い |
| secret が未設定 | 設定不備 | **2** | 「`DIFY_CONSOLE_REFRESH` が未設定です」 |

**どの場合も、Dify 側には副作用が無い**（インポートを始める前に認証を確立し、失敗したら 1 本もインポートしない＝ §9-2 の「全件成功してから公開」と対）。

### 8-5 更新の手間（正直な評価）

| 頻度 | 実態 | 判定 |
|---|---|---|
| **マスタ改訂 → 12 本の再投入** | 月に数回程度（#98 のような投入イベント単位） | **R-a で許容できる。** 1 回 3 分の手作業で、Mac での「12 回のドラッグ＆ドロップ＋公開」が消える |
| KB 投入・テスト実行 | 週に何度も | **そもそも Cookie 不要**（W1 ＋ W4-1 のナレッジ API で完結） |
| 毎日の細かい修正 | もし毎日 12 本を投入するなら、毎日 3 分の手作業が要る | **その頻度なら破綻する。**そのときは A（パスワード）か D（Mac 常駐）を再検討する |

**要点**：Cookie 案は「常時自動化」ではなく **「投入イベントを 1 コマンドにする」**もの。目的（Mac の前に座らない）は満たすが、**完全な無人化ではない**。

### 8-6 取り出す手順（値をログ・チャットに出さない）

**共通の原則**：取り出した値は **画面にもチャットにも出さず、GitHub の Environment secret 入力欄に直接貼る**（`CLAUDE.md` §2-10）。ターミナルの履歴にも残さない。

**方法 1：ブラウザの開発者ツール（いちばん確実。PM が 1 人で完結）**
1. Chrome で Dify Cloud にログイン済みのタブを開く
2. 開発者ツール → **Application → Cookies → `https://cloud.dify.ai`**
3. **`__Host-refresh_token` の Value を右クリック → コピー**（画面に出したまま共有しない。スクリーンショットを撮らない）
4. GitHub → Settings → Environments → `dify-cloud-master` → **Secrets → `DIFY_CONSOLE_REFRESH` を Update** に直接貼る
5. **そのブラウザではログアウトしない**（`logout` は Redis 側のリフレッシュトークンを消すので、secret も同時に死ぬ）

**方法 2：Playwright（VS Code の Claude Code から。値を表示させない）**
- 既存のログイン済みプロファイル（`--user-data-dir`）で `context.cookies()` を取り、**`__Host-refresh_token` の値だけをクリップボードへ**入れて終了するスクリプトを人が実行する。**標準出力にもファイルにも書かない**
- `DI-021`（Playwright MCP は作業ディレクトリ配下しか読めない）は**この用途には無関係**（ファイルを読まないため）
- **注意**：Claude Code のセッションに値を渡さない。エージェントに「Cookie を読んで教えて」と頼まない（チャットログに残る＝ §2-10 違反）

**方法 3（採らない）**：`console_api.py` に「ブラウザから取り出すコマンド」を実装する。**値がプロセスの出力に出る経路を作らない**ため、実装しない。

### 8-7 危険の評価（セッションは API キーより強い）

**漏れたときに何ができてしまうか**（コンソール API の権限＝アカウント全体）：

| できてしまうこと | 影響 |
|---|---|
| **アプリの削除**（`DELETE /console/api/apps/{id}`） | 12 本のアプリと API キーが消える。**復旧は Git からの再インポート＋キー再発行＋環境変数の入れ替え**（半日仕事） |
| **KB の削除**（`DELETE /console/api/datasets/{id}`） | 文書の再投入とインデックス再生成が要る（`dify/kb/` が正本なので内容は失われない） |
| DSL の全取得 | 架空世界のデータのみ（`cloud-master`）。実害は小さい |
| メンバー招待・ワークスペース設定・課金設定の変更 | **PM のアカウント名義で行われる。金銭的影響がありうる** |

**Environment の承認ゲートだけで足りるか → 足りない。** 承認ゲートは「**ワークフロー実行**が secret に触る前に人が止める」仕組みであって、**漏れた値そのものの悪用は止められない**。したがって次を重ねる：

| # | 歯止め | 効果 |
|---|---|---|
| **B1** | **Environment secret（`dify-cloud-master`）に置き、required reviewers（PM）と deployment branch = `main` を付ける**（W1 と同じ設定） | fork PR に渡らない・承認なしに動かない |
| **B2** | **保存するのはリフレッシュトークン 1 個だけ。** アクセス／CSRF は保存しない | 漏洩面を 1 つに絞る |
| **B3** | **ジョブの最後に `POST /console/api/logout` を呼び、使ったセッションを無効化する**（`revoke_token_pair` が Redis の値を消す） | **実行後は漏れても無価値**。Cookie 案の危険の大半をここで消す |
| **B4** | **値をログに出さない**：`_MASK_PATTERNS` に **Cookie ヘッダ全体・`X-CSRF-Token` ヘッダ・`__Host-*` の値**を足す（G7 の是正）。`set -x` 禁止・`env` 禁止（W1 と同じ） | **公開リポジトリの Actions ログは誰でも読める** |
| **B5** | **削除系 API をコードに存在させない**（§9-1 の機械検査） | セッションが強くても、**スクリプトが削除を呼べない** |
| **B6** | **異変時の即時失効手順を `DEPLOY.md` に書く**：Dify のブラウザで**ログアウト**すれば当該リフレッシュトークンは無効化される。加えて GitHub 側で secret を削除する | 事故対応が 1 分で終わる |

---

## §9 危険の評価と歯止め（妥協しない）

### 9-1 「削除系の API を呼ばない」をどう担保するか

**方針：注意書きではなく、コードに存在させない＋機械で検査する。**

| 層 | 担保 |
|---|---|
| 実装 | `console_api.py` に **`DELETE` を送る関数を書かない**（`_req` に `DELETE` を渡す呼び出しを 1 つも作らない）。アプリ削除・KB 削除・API キー削除は**関数として存在しない** |
| 機械検査 | **`tools/verify.mjs` §14（新設）**：`scripts/dify/**.py` を走査し、HTTP メソッドとして `"DELETE"` を渡している箇所を列挙する。**許可されるのは `kb_upload.py` の文書削除 1 か所だけ**（ファイル名＋関数名で許可）。それ以外にあれば **FAIL** |
| CI | `dify-ops.yml` の `op` は **choice で列挙**（`kb_upload` / `kb_refresh` / `kb_replace` / `run_tests` / `deploy`）。**`op` に「削除」は存在しない**。`kb_replace` だけが文書削除を伴い、**`codes` は 1 件のみ**・Environment 承認が要る |
| レビュー | `.github/workflows/**` と `scripts/dify/**` を触る PR は reviewer が diff を全行読む（既存の運用条件） |

**なぜ verify に入れるか**：将来 `--force` のようなフラグが「便利だから」と足されるのを、**PR の時点で機械が止める**ため。人の記憶に頼らない。

### 9-2 上書きインポートが失敗して、アプリが壊れた状態で残る可能性

**まず事実**：Dify の DSL インポートは **下書き（draft workflow）を置き換えるだけ**で、**公開版は `publish` するまで変わらない**（`app_dsl_service` は `sync_draft_workflow` を呼ぶ）。**したがってインポートが失敗しても、動いているデモ（Service API 経由の公開版）は壊れない。**

**設計上の契約**：

| # | 契約 | なぜ |
|---|---|---|
| **P1** | **`op: deploy` は「全件インポート成功」を確認してから、まとめて `publish` する。** 1 本でも失敗したら **publish を 1 本も行わない** | 「半分だけ新しい」状態を作らない |
| **P2** | **インポート前に、対象アプリの現行 DSL をエクスポートして成果物（artifact）に残す**…は **採らない**（DSL に `dataset_ids` の暗号値が入り、公開リポジトリの artifact は誰でも取得できる）。代わりに **「Git のどの版を投入したか」を PR 本文と結果ファイルに記録**する。**復旧は Git から再 render → 再インポート** | 秘密を公開経路に出さずに、復旧に必要な情報だけ残す |
| **P3** | **失敗しても `dify/results/**` 以外を書かない**（W1 の変更パスガードをそのまま使う） | リポジトリ側の破壊を防ぐ |
| **P4** | **`--dry-run` を必ず先に**（`cloud_deploy.py` に実装済み。ネットワークを呼ばない） | 対象と順序を人が確認できる |

**復旧手順（`DEPLOY.md` §9 に書く）**

1. 症状を確認する（Studio でアプリを開き、下書きが壊れているか／公開版が動いているか）
2. **公開版が動いているなら急がない**（デモは止まらない）
3. Git から再 render：`source ~/.config/dify/cloud-master.env && python3 scripts/dify/render.py --env cloud-master <番号>`
4. UI の「DSL をインポート → 上書きしてインポート」で `dify/build/cloud-master/<番号>-*.yml` を流す（**ダイアログの「現在の下書きをバックアップ」を押してから**）
5. 公開 → `run_tests.py` で合否を確認 → 結果を commit
6. **アプリ id と API キーは上書きインポートでは変わらない**（#114 の実機確認済み）ので、環境変数の入れ替えは不要

### 9-3 `dify-ops.yml` に乗せる場合の入力検証と承認ゲート（W1 と同じ形にできるか）

**できる。W1 の形をそのまま踏襲し、`deploy` にだけ 3 つ足す。**

| 項目 | W1（既存） | W4 で足すもの |
|---|---|---|
| トリガ | `workflow_dispatch` のみ | 変更なし（**`pull_request` 系は絶対に足さない**） |
| 入力検証 | `codes` を `^[A-Z]{2}-[0-9]{2}( …)*$` で再検証、`env:` 経由でのみ参照 | 同じ。**`kb_replace` は `codes` が 1 件のみ**、**`deploy` は最大 12 件**を追加検証 |
| 承認 | `environment: dify-cloud-master`（required reviewers） | 変更なし。**`deploy` と `kb_replace` は同じ Environment を使う**（承認が必ず入る） |
| 追加の確認入力 | — | **`confirm` 入力（文字列）**：`kb_replace` / `deploy` のときだけ、**`op` と同じ文字列の入力を要求**し、一致しなければ即失敗。誤操作の 2 重化 |
| 権限 | 既定 `contents: read`、ジョブだけ `contents: write` / `pull-requests: write` | 変更なし |
| 変更パスガード | `dify/results/**`・`dify/state/**` のみ | 変更なし |
| タイムアウト | 45 分 | **`deploy` は 30 分**（アクセストークンの 60 分以内に収める。§8-4） |

### 9-4 秘密が増えることの評価

| | W1（いま） | W4-1 | W4-3・W4-4 |
|---|---|---|---|
| 置く秘密 | `DIFY_DATASET_KEY`（1）＋ `DIFY_APP_KEY_*`（12） | **増えない** | ＋ **`DIFY_CONSOLE_REFRESH`（1）** |
| スコープ | 1 ナレッジ／1 アプリずつ | 同左 | **アカウント全体** |
| 失効のしやすさ | 画面から 1 分で再発行 | 同左 | **ブラウザでログアウトすれば即無効**（§8-7 B6） |
| 漏れたときの最悪 | KB の読み書き・アプリの実行 | **＋ 文書の削除**（Git が正本なので復旧可） | **アプリ・KB の削除、課金設定の変更** |
| 緩和 | Environment 承認・ログ非出力 | ＋ §4-2 の K1〜K8 | ＋ §8-7 の B1〜B6（**特に B3 の使い捨て**） |

**評価**：W4-1 は**秘密を 1 つも増やさない**。W4-3 で初めて「アカウント権限の秘密」が 1 つ増えるが、**使い捨て（B3）にできるため、常時有効な API キーより危険が小さい面もある**。**PM の判断が要るのはここだけ**（§12 判断 3）。

### 9-5 いま既に起きている漏れ（W4-1 で同時に直す）

**`kb_upload.py` は dataset id と document id を標準出力に出している。**

```
log(f"既存 KB を再利用: id={ds['id']}")
log(f"KB を作成: id={ds['id']}")
log(f"アップロード: {fname} … -> document id={doc.get('id')} …")
```

W1 の `dify-ops.yml` はこれをそのまま実行するので、**公開リポジトリの Actions ログに dataset id が出る**。`CLAUDE.md` §2-10 は `dify/env/**` に **dataset id を書かない**と定めており、同じ値が公開ログに出るのは趣旨に反する。

**是正（W4-1 の必須項目）**：`kb_upload.py` の id 出力を **先頭 8 文字＋`…` のマスク**にする（照合はできるが再利用はできない粒度）。**KNOWN_ISSUES への起票（`DI-025` 相当）は implementer / PM が採番する**（architect は番号を決めない）。

---

## §10 セッションは IP / User-Agent に紐づいていないか

**判定：サーバ側では紐づいていない（ソース根拠あり）。残る不確実性は Cloudflare だけ。**

| 対象 | 中身 | IP / UA の束縛 |
|---|---|---|
| アクセストークン | JWT。ペイロードは **`{user_id, exp, iss, sub:"Console API Passport"}`**（`account_service.get_account_jwt_token_for_account_id`） | **無し** |
| CSRF トークン | JWT。ペイロードは **`{exp, sub}`**（`libs/token.generate_csrf_token`） | **無し** |
| リフレッシュトークン | 乱数文字列。Redis に **`refresh_token:<値> → account_id`** で保存（`account_service`） | **無し** |
| 検証経路 | `check_csrf_token` は **ヘッダと Cookie の一致・JWT の検証・`sub` の一致・`exp`** しか見ない | **無し** |

→ **Mac で取ったトークンを GitHub ホストランナーで使える**（サーバの認証ロジック上は）。

**残る確認事項（V5）**：**Cloudflare が GitHub の egress を弾かないか。** `api.dify.ai`（Service API）では **DI-004** の実績があり、独自 User-Agent で解消している。コンソール側（`cloud.dify.ai`）も同じ前段があるかは未確認。

**最小の確かめ方（秘密を使わない）**

```bash
# ホストランナーから 1 回だけ。認証は通らなくてよい。見たいのは「Cloudflare に弾かれるか」だけ
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H 'User-Agent: dify-scripts/1.0 (+https://github.com/shoulang0729/dify)' \
  https://cloud.dify.ai/console/api/setup
```

- **200 / 401 / 403（本文に `1010` を含まない）** → 前段は通っている。Cookie 案は成立しうる
- **403 かつ本文に `error code: 1010`** → Cloudflare が弾いている。**UA を変えて再試行**し、それでも駄目なら Cookie 案はホストランナーでは成立しない（→ D か、Mac での実行に戻す）

**これは `dify-ops.yml` に `op: probe`（秘密を一切使わない疎通確認）として実装できる。W4-3 の最初の受け入れ条件にする。**

---

## §11 段階と PR 分割（いちばん小さく始めて効果が出る単位）

> **第 1 段階 ＝ W4-1（認証を要しない 2 つ）。** これが終わると **Mac に残るのは「DSL の再インポートと公開」だけ**になる。認証（W4-3・W4-4）はその後。

### W4-1【第 1 段階】KB の入れ替えを CI で回す（認証を増やさない）

| | 中身 |
|---|---|
| **PR-1** | `scripts/dify/kb_upload.py`：`--refresh`（更新 API で中身を差し替え）／`--replace`（削除して入れ直し。K1〜K5 の歯止め込み）／**id 出力のマスク（§9-5）**。`scripts/dify/tests/test_kb_upload.py`（新規）と `mock_server.py` のエンドポイント追加。`tools/verify.mjs` §14（削除系の機械検査） |
| **PR-2** | `.github/workflows/dify-ops.yml`：`op` に `kb_refresh` / `kb_replace` を追加（`kb_replace` は `codes` 1 件のみ・`confirm` 入力必須）。`dify/DEPLOY.md` §2 の KB の節を更新 |
| 触らない | `dify/apps/**`・`dify/env/**`・`mock/**`・`.claude/**`・`verify.yml`・`pages.yml`・`scripts/dify/{render,console_api,cloud_deploy,release,sync_back}.py` |
| 並列 | **PR-1 と PR-2 は直列**（PR-2 は PR-1 のフラグ名に依存する）。W4-2 とは並列可（触るファイルが違う） |
| 秘密 | **増えない**（`DIFY_DATASET_KEY` は W1 で登録済み） |

**受け入れ条件（機械検証）**

- [ ] `python3 scripts/dify/tests/test_kb_upload.py` 全件 PASS。少なくとも次を含む
  - [ ] T1：フラグ無しの既定挙動が**現状と同一**（同名はスキップ・削除も更新もしない）
  - [ ] T2：`--refresh` が **`DELETE` を 1 回も呼ばない**（モックサーバが `DELETE` を受けたら失敗）
  - [ ] T3：`--replace` が **`dify/kb/<番号>/` に無い名前の文書を削除しない**（KB 側に余分な文書を置いたモックで確認。K1）
  - [ ] T4：削除対象が `MAX_DELETE` を超えると **1 件も削除せず exit 1**（K2）
  - [ ] T5：`--replace --dry-run` が**削除予定を列挙するだけで DELETE を呼ばない**（K5）
  - [ ] T6：**標準出力に dataset id / document id の完全な UUID が出ない**（正規表現で検査。§9-5）
  - [ ] T7：削除直後にアップロードが失敗しても、**次の文書の削除に進まない**（K3）
- [ ] `node tools/verify.mjs` PASS（**§14 新設**：`scripts/dify/**.py` の `DELETE` 呼び出しが `kb_upload.py` の許可関数のみ）
- [ ] `node tools/regress.mjs` PASS（`--update` しない。**データ層は変更 0 件**）
- [ ] `python3 scripts/dify/render.py --env cloud-master --all --check` が 12/12 `[OK]`（`DIFY_DATASET_ID_*` を source していない素の shell）
- [ ] 既存の `test_console_api.py` / `test_cloud_deploy.py` / `test_run_tests.py` / `test_sync_back.py` が PASS
- [ ] `dify-ops.yml` のトリガが `workflow_dispatch` のみ（`pull_request` / `pull_request_target` / `schedule` を含まない）
- [ ] **実機（確認要 V3）**：`op: kb_refresh` で `KN-02` を 1 回流し、**文書が二重にならず、内容が更新され、`run_tests.py` の合否が変わらない**こと。更新 API が 404/405 を返したら **`--replace` に切り替えて再実行**し、結果を Issue に記録

### W4-2【第 1 段階・並列可】`dataset_ids` の焼き込みで「紐づけ直し」を消す

| | 中身 |
|---|---|
| **PR-3** | `dify/DEPLOY.md` §1-④ 手順 3 の書き換え（「紐づけ直し」→「`dify/build/` の DSL を使えば不要」）＋ §1-④ に render 手順を追加。`dify/env/README.md` に 1 行。**コード変更なし** |
| 前提 | **V2（§5-4）を先に実施**する。真であることを確認してから手順書を書き換える |
| 触らない | `dify/apps/**`（1 バイトも変えない）・`dify/env/**/env.yml`・`scripts/**` |
| 並列 | W4-1 と並列可。ただし **`DEPLOY.md` を W4-1 の PR-2 も触る**ので、**同じファイルを触る 2 本は直列**（`CLAUDE.md` §5） |

**受け入れ条件**

- [ ] **V2 が真**：build 側の DSL を上書きインポートしたあと、**Studio の知識検索ノードに KB が選択済みで表示される**（Issue #121 に「V2：真」と 1 行。UUID は書かない）
- [ ] 同じアプリで**公開がチェックリストに引っかからず通る**（N3 の裏返し）
- [ ] `run_tests.py --env cloud-master KN-02` が合格（検索が効いている）
- [ ] `render.py --env cloud-master --all --check` が **素の shell で 12/12 `[OK]`**（§5-3）
- [ ] `git status` が `dify/apps/**` に差分を出さない
- [ ] `DEPLOY.md` の従来手順（手で紐づける方法）が**削除されず、V2 が偽だった場合の経路として残っている**

### W4-3 Cloud のコンソール認証（Cookie ／ リフレッシュトークン）

| | 中身 |
|---|---|
| **PR-4** | `scripts/dify/console_api.py`：Cloud 認証層（**G1 Cookie 保持・G3 base64・G4 CSRF ヘッダ＋Cookie・G6 refresh・G7 マスク拡張**）。`DIFY_CONSOLE_TOKEN` を **`DIFY_CONSOLE_REFRESH`** に置き換え（**セルフホストの email/password 経路は残す**）。`TOKEN_HELP` を実機に合わせて書き直す。`scripts/dify/tests/test_console_api.py` 拡張・`mock_server.py` に refresh / CSRF を実装。`scripts/dify/env.example` |
| **PR-5** | `.github/workflows/dify-ops.yml` に **`op: probe`**（秘密を使わない疎通確認。§10）を追加 |
| 前提 | **V1（§13）と V5（§10）を先に実施** |
| 並列 | W4-1・W4-2 と並列可（触るファイルが違う。ただし `dify-ops.yml` を触る PR は直列） |

**受け入れ条件**

- [ ] **V5**：`op: probe` がホストランナーから **200 / 401 / 403（1010 を含まない）** を返す。`1010` が出たら **W4-3 は保留**し DI 起票
- [ ] `test_console_api.py` 全件 PASS。少なくとも
  - [ ] 認証済みの全リクエストに **`X-CSRF-Token` ヘッダ**と **CSRF Cookie** が付き、**値が一致**する
  - [ ] `refresh-token` の応答 `Set-Cookie` から **access / csrf / refresh の 3 つを取り出す**
  - [ ] refresh が 401 のとき **exit 3** かつ「セッション期限切れ」のメッセージ（§8-4）
  - [ ] **ログ・例外本文に Cookie 値・CSRF 値・リフレッシュトークンが出ない**（正規表現で検査。G7）
  - [ ] **`DELETE` を送る関数が 1 つも無い**（§9-1）
  - [ ] セルフホストの email/password 経路が**壊れていない**（既存テストが PASS。ただし base64 化に伴う変更は selfhost にも適用される＝ V6）
- [ ] `node tools/verify.mjs` / `node tools/regress.mjs` PASS
- [ ] **実機**：`python3 -m scripts.dify.console_api --console-url https://cloud.dify.ai`（一覧のみ）が **アプリ 12 件を返す**。値（id）は表示するが**ログを公開の場に貼らない**

### W4-4 投入・公開の自動化（`op: deploy`）

| | 中身 |
|---|---|
| **PR-6** | `.github/workflows/dify-ops.yml` に `op: deploy`（`cloud_deploy.py` を呼ぶ）。`confirm` 入力・`codes` 上限 12・`timeout-minutes: 30`・**全件成功してから publish**（P1）・**ジョブ末尾で `logout`**（B3）。`dify/DEPLOY.md` §9（Cookie の取り方・失効時の手順・復旧手順） |
| 前提 | W4-3 の実機確認が済んでいること。**U2（imports の body 実形）と U3（サーバ側チェックリスト）を確認済みであること** |

**受け入れ条件**

- [ ] `deploy` が **1 本でもインポートに失敗したら publish を 1 本も行わない**（モックで機械確認）
- [ ] ジョブ末尾で **`logout` を必ず呼ぶ**（失敗時も `if: always()`）
- [ ] 変更パスガードが有効（`dify/results/**`・`dify/state/**` 以外を push しない）
- [ ] **実機**：12 本を 1 回で投入 → 公開 → `run_tests.py` が第 1 弾・第 2 弾とも従来と同じ合否
- [ ] ジョブログ・Job Summary・PR 本文に **Cookie / CSRF / リフレッシュトークン / API キー / dataset id の完全な値が出ない**

---

## §12 PM が判断すべき点（推奨つき）

| # | 判断 | 選択肢 | **推奨** | 理由 |
|---|---|---|---|---|
| **1** | **W4-1（KB の入れ替え）を先に入れるか** | 入れる / 認証を先にやる | **入れる** | 秘密を 1 つも増やさず、いちばん手数の多い作業（同名文書の手動削除）が消える。壊れても Git が正本 |
| **2** | **KB の入れ替えは「更新」か「削除して入れ直し」か** | `--refresh`（更新）既定 / `--replace`（削除）既定 | **`--refresh` を既定、`--replace` は明示フラグ＋上限 5 件** | 削除を伴わない方が事故のとき失うものが無い。ただし 1.17.0 に更新 API があるかは V3 で確認 |
| **3** | **リフレッシュトークンを Environment secret に置くか** | 置く / 置かない | **置く（承認済み）。ただし「1 回置けば 30 日」ではない**（§8-3） | ホストランナーで完結する唯一の実用案。使い捨て（`logout`）にできるので、常時有効な API キーより危険を小さくできる |
| **4** | **更新の運用**（§8-3） | R-a 使い切り（投入回ごとに人が 1 回置く） / R-b 書き戻し（PAT が要る） | **R-a** | R-b は `secrets: write` を持つ PAT が増える＝ リポジトリ全体を書き換えられる秘密。効果に見合わない |
| **5** | **`logout` でセッションを毎回無効化するか** | する / しない | **する** | 漏洩窓を実行時間だけに絞れる。代償は「次回また 3 分」だけ |
| **6** | **API キーの自動発行（A9）をやるか** | やる / やらない | **やらない** | 発行応答に **平文キー**が入る（N6）。CI の文脈に平文キーを載せる利益が無い（既に 12 本発行済み） |
| **7** | **`op: deploy` の対象範囲** | 12 本一括のみ / 番号指定も可 | **番号指定も可。ただし `confirm` 入力必須** | 1 本だけ直したいときに全件流すのは無駄で、失敗面も広い |
| **8** | **Mac のセルフホストランナー（D）** | いま入れる / 入れない | **入れない** | 目的（Mac を不要にする）と正反対。前設計書 §4-2 の残余リスクも大きい。W4-1〜W4-4 が全部駄目だったときの最後の手段として残す |
| **9** | **パスワード再設定の抜け道を試すか**（付録・§13 付） | 試す / 試さない | **試す（5 分）。ただし本筋ではない** | 通れば Mac が完全に不要になる。駄目でも失うものは 5 分 |
| **10** | `CLAUDE.md` への追記 | 採用 / 見送り | **W4-1 完了時に 1 行だけ**（「KB の文書入れ替えはホストランナーで回す。削除系 API は `kb_upload.py` の 1 か所のみ・verify §14 で機械検査」） | load-bearing の追加は最小に。**適用は PM** |

---

## §13 未確認の前提と、確かめ方

| # | 未確認 | なぜ重要か | 確かめ方（最小） | 確認する場所 |
|---|---|---|---|---|
| **V1** | **Cloud 1.17.0 の認証が §2-1（S1〜S9）のとおりか**（引用は `main`） | W4-3 の実装形が決まる | ブラウザで 1 回：`Application → Cookies` に **`__Host-access_token` / `__Host-refresh_token` / `__Host-csrf_token` の 3 つがあるか**を見る（値は見ない・貼らない）。3 つ揃っていれば S5・S8 は成立 | Mac・5 分 |
| **V2** | **`dataset_ids` の焼き込みで KB が紐づくか（U4）** | **紐づけ直しが消えるか** | §5-4 の 7 手順（KN-02 を 1 本） | Mac・10 分 |
| **V3** | **1.17.0 に文書の更新 API があるか**（canonical `PATCH …/documents/{id}` / `POST …/update-by-text`） | `--refresh` が使えるか（駄目なら `--replace`） | ホストランナーの `op: kb_refresh` を KN-02 で 1 回。404/405 なら無い | **ホストランナー**（Mac 不要） |
| **V4** | **Cloud のトークン寿命が既定値（60 分 / 30 日）か** | 運用の手数が決まる | R-a の運用で自然に分かる（refresh が 401 になったら期限切れ）。**急ぐ必要はない** | 運用の中で |
| **V5** | **Cloudflare がホストランナーからのコンソール API を弾かないか** | **Cookie 案が成立するかの分水嶺** | §10 の `op: probe`（秘密を使わない curl 1 回） | **ホストランナー** |
| **V6** | **base64 化（G3）がセルフホスト 1.15.x でも必要か** | selfhost 経路を壊さないか | `mock_server.py` で両対応にし、実機（inhouse）が立ったときに確認。**当面は Cloud 側だけ base64 で送る実装にして selfhost の既存挙動を変えない**のが安全 | 実装時に判断 |
| **V7** | **`POST /console/api/apps/imports` の body 実形**（#114 U2 のまま） | `deploy` の実装形 | W4-4 の実機投入時に Network を記録する（**キー名だけ。値は記録しない**） | Mac・投入のついで |
| **V8** | **サーバ側が publish のチェックリスト検証をするか**（#114 U3） | 紐づけ漏れのまま公開されないか | V2 の手順 5 で同時に分かる | Mac |

### 付録：パスワード再設定の抜け道（**本筋ではない。5 分で判定できる**）

**分かっていること（ソース）**：Dify には **`POST /console/api/reset-password`（再設定メールの送信）** が存在する。ただし **`@email_password_login_enabled` で保護されており、メール／パスワードログインが無効な環境では 403** を返す（`api/controllers/console/auth/login.py` `ResetPasswordSendEmailApi`）。
また **メールコードでのログイン（`/console/api/email-code-login`）は Cloud では Cloudflare Turnstile のトークンを要求する**（`EmailCodeSendPayload.turnstile_token`：「Required at runtime for Dify Cloud」）。**したがってメールコード経路は自動化できない。**

**PM が試す手順（3 行）**

1. Dify Cloud のログイン画面で「**パスワードをお忘れですか**」を押し、**GitHub OAuth で使っているメールアドレス**を入れる
2. メールが届いてパスワードを設定できたら、**いったんログアウトして「メール＋パスワード」でログインできるか**を試す
3. できたなら §7 の **案 A が復活**する（`DIFY_CONSOLE_EMAIL` / `DIFY_CONSOLE_PASSWORD` を Environment secret に置けば、**Cookie の取り直しが不要になり Mac が完全に不要**）。**この場合も `console_api.py` の G1〜G4・G6・G7 の修正はそのまま必要**（ログインは Cookie を返すため）

**秘密を使わない事前判定**（メールを飛ばさずに、メール／パスワードログインが有効かだけ見る）

```bash
# 存在しないアカウントで 1 回だけ。403 = メール/パスワードログインが無効（抜け道も無い）
curl -sS -o /dev/null -w "%{http_code}\n" -X POST https://cloud.dify.ai/console/api/login \
  -H 'Content-Type: application/json' \
  -H 'User-Agent: dify-scripts/1.0 (+https://github.com/shoulang0729/dify)' \
  -d '{"email":"nobody@example.invalid","password":"eA==","remember_me":false}'
```

- **403** → 機能ごと無効。**付録は死に。Cookie 案（§8）で進む**
- **401 / 400 / 429** → 機能は有効。**パスワード再設定を試す価値がある**

---

## §14 参照

- Issue #121（W4）・Issue #114（N1〜N6 の実機観測。`console_token` は 1.17.0 に存在しない）
- `docs/handoff/2026-09-08-execution-split-and-runner.md`（W1〜W3・実行場所の 3 分類・セルフホストランナーの危険）
- `docs/handoff/2026-09-08-cloud-console-deploy.md`（`console_api.py` / `cloud_deploy.py` の元設計。認証の節は本書 §2 で置き換える）
- `docs/handoff/2026-09-07-repo-layout-v2.md` §3・§4（env レイヤーと `render.py` の R1〜R10）
- `dify/DEPLOY.md`（§1-④ 再インポート・§7 ホストランナー）・`dify/env/README.md`・`dify/KNOWN_ISSUES.md`（DI-004・DI-013・DI-021）
- `.github/workflows/dify-ops.yml`（W1。本書の追加はここに乗る）
- Dify 本体ソース（`langgenius/dify` `main`、2026-09-08 取得）：`api/libs/token.py`・`api/libs/login.py`・`api/controllers/console/auth/login.py`・`api/controllers/console/wraps.py`・`api/libs/encryption.py`・`api/services/account_service.py`・`api/services/app_dsl_service.py`・`api/controllers/service_api/dataset/document.py`・`api/configs/feature/__init__.py`
- `CLAUDE.md` §2-10（秘密）・§2-12（環境差分）・§3（検証）・§5（Git 運用）
