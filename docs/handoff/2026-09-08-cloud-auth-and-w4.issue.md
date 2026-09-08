# Issue #121 への追記案（W4。PM が貼る。Issue 本体は architect が更新しない）

## W4 の設計ができました —— 認証を解く前に、認証を要しない 2 つで Mac の作業を減らす

設計書: `docs/handoff/2026-09-08-cloud-auth-and-w4.md`（ブランチ `docs/w4-cloud-auth-design`）
レーン: M/L / 実行場所: 一部 `run:runner`・確認だけ `run:mac`

### 分かったこと（Dify 本体のソースで確認。推測ではない）

1. **KB の文書削除はナレッジ API でできる。** `DELETE /v1/datasets/{dataset_id}/documents/{document_id}` → 204。さらに**削除せずに中身だけ差し替える更新 API**（`update-by-text` / canonical `PATCH`）もある。使うのは `DIFY_DATASET_KEY` だけで、**W1 で登録済み＝秘密は 1 つも増えない**
2. **`dataset_ids` の焼き込み（U4）は真である可能性が高い。** Dify のインポートは `dataset_ids` を `decrypt_dataset_id()` に通すが、この関数は**素の UUID ならそのまま返す**（`app_dsl_service.py`）。焼き込みの仕組み（`render.py` R5 ＋ `cloud_deploy.py --bind-kb dsl` ＋ 単体テスト T8）は**すでに実装済み**で、必要なのは**実機 1 本の確認と手順書の書き換えだけ**
3. **`console_api.py` は Cloud に対して 7 か所足りない**（設計書 §2）。最初の失敗点は **ログイン応答に `access_token` が無いこと**（Cloud はトークンを Set-Cookie で返す）。次に **`X-CSRF-Token` を送っていないこと**（`login_required` は GET でも CSRF を検査する）。#114 N1 の 401 はこれで説明が付く
4. **セッションは IP にも User-Agent にも紐づいていない**（JWT のペイロードは `{user_id, exp, iss, sub}` だけ）。**Mac で取ったトークンをホストランナーで使える**。残る不確実性は Cloudflare だけで、秘密を使わない 1 回の疎通確認で判定できる
5. **Cookie 案は「1 回置けば 30 日」ではない。** アクセス／CSRF は 60 分、リフレッシュトークンは 30 日だが**1 回使うと無効化される（rotate）**。現実的な運用は「**投入する回ごとに 1 回置いて、そのジョブで使い切り、最後に `logout` で無効化する**」。手間は 1 回 3 分
6. **既存の漏れを 1 件発見**：`kb_upload.py` が dataset id / document id を標準出力に出しており、**公開リポジトリの Actions ログに出る**。W4-1 で同時にマスクする

### 段階（全部いっぺんには作らない）

| 段階 | 中身 | 秘密 | 実行場所 |
|---|---|---|---|
| **W4-1**（第 1 段階） | `kb_upload.py` に `--refresh` / `--replace` ＋ 歯止め ＋ id マスク。`dify-ops.yml` に `op: kb_refresh` / `kb_replace` | **増えない** | `run:runner` |
| **W4-2**（並列可） | `dataset_ids` 焼き込みで紐づけ直しを廃止（**コード変更なし。手順書だけ**） | 増えない | 確認のみ `run:mac` |
| **W4-3** | `console_api.py` の Cloud 認証層（Cookie・CSRF・base64・refresh・マスク） | **＋1**（リフレッシュトークン） | `run:runner` |
| **W4-4** | `dify-ops.yml` に `op: deploy`（投入＋公開） | 同上 | `run:runner` |

**W4-1 と W4-2 が終わると、Mac に残るのは「DSL の再インポートと公開」だけ**になります。

### PR 分割案

1. **PR-1** `kb_upload.py`（`--refresh` / `--replace` / id マスク）＋ `test_kb_upload.py` ＋ `mock_server.py` ＋ `verify.mjs` §14（削除系の機械検査）
2. **PR-2** `dify-ops.yml` に `op: kb_refresh` / `kb_replace`（`confirm` 入力必須・`kb_replace` は 1 件のみ）＋ `DEPLOY.md` §2
3. **PR-3** `DEPLOY.md` §1-④ の書き換え（`dify/build/` の DSL を使う）＋ `dify/env/README.md` 1 行（**V2 の確認後**）
4. **PR-4** `console_api.py` の Cloud 認証層 ＋ テスト ＋ `env.example`
5. **PR-5** `dify-ops.yml` に `op: probe`（秘密を使わない疎通確認）
6. **PR-6** `dify-ops.yml` に `op: deploy` ＋ `DEPLOY.md` §9（Cookie の取り方・失効時・復旧手順）

PR-1 → PR-2 は直列。PR-3 は `DEPLOY.md` を触るので PR-2 と直列。PR-4 は並列可。

### 触らない範囲

`mock/**`（**データ層 `CATS`/`SVCS`/`TAGS` の変更は 0 件**）／`data/world/**`／**`dify/apps/*.yml`（1 バイトも変えない）**／**`dify/env/**/env.yml`**／`dify/kb/**`・`dify/tests/**`／`.github/workflows/{verify,pages}.yml`／`.claude/**`／`tools/regress.*`／`tools/verify.mjs` の §1〜§13／`CLAUDE.md`（文案のみ・適用は PM）

### PM にお願いしたい確認（設計書 §13）

- **V2**（10 分・Mac）：`render.py` で焼き込んだ DSL を 1 本だけ上書きインポートし、**知識検索ノードに KB が選択済みで入るか**。真なら紐づけ直しが消えます
- **V1**（5 分・Mac）：Cookie に `__Host-access_token` / `__Host-refresh_token` / `__Host-csrf_token` の 3 つがあるか（**値は見ない・貼らない**）
- **付録**（5 分）：ログイン画面の「パスワードをお忘れですか」から、OAuth のアカウントにパスワードを設定できるか。**通れば Mac が完全に不要**になります

### PM 判断（設計書 §12 に 10 件。推奨つき）

主なもの：W4-1 を先に入れる（**推奨：入れる**）／KB は更新を既定・削除は明示フラグ（**推奨：そうする**）／リフレッシュトークンを Environment secret に置く（**承認済み。ただし使い切り運用**）／毎回 `logout` する（**推奨：する**）／API キーの自動発行はしない（**推奨：しない**）／Mac のセルフホストランナーは入れない（**推奨：入れない**）
