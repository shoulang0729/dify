# リフレッシュトークンの自動更新（rotate した新しい値をジョブが Environment secret に書き戻す）

設計書：`docs/handoff/2026-09-09-refresh-token-writeback.md`
ラベル：`run:cloud`（実機検証は PR-3 で `run:runner` の別 Issue を起票する。`CLAUDE.md` §7「`run:*` は 1 つだけ」）
前提 Issue：#121（W4-3・W4-4）

## なぜ

2026-09-09、`op: deploy`（run #12）が exit 3（認証エラー）で落ちた。**落ち方は設計どおり**（render 成功 → 認証で停止 → Dify に 1 バイトも書き込まず → 案内メッセージ）。原因は 40 分前の `op: inspect`（run #11）が同じリフレッシュトークンを消費していたこと。リフレッシュトークンは **1 回使うと rotate されて死ぬ**（`docs/handoff/2026-09-08-cloud-auth-and-w4.md` §8-3）。

前設計 §8-5 は「月に数回なら許容」と評価していたが、**実測は 1 日で 2 回消費**（`inspect` 1 回・**失敗した `deploy` でも 1 回**）。PM は「実行のたびに 3 分の運び屋」をやめる判断をした。

**本 Issue は、前設計 §8-3 が「採らない」としていた R-b（書き戻し）を採る。** その判定を上書きする（前設計書は書き換えない）。

## 何をするか（結論だけ。詳細は設計書）

- **権限**：`GITHUB_TOKEN` では secret を書けない（`permissions:` に secrets スコープが無い）。**このリポジトリだけに絞った fine-grained PAT**（`Secrets: Read and write`）を Environment secret `GH_SECRETS_PAT` に置く（設計書 §3 D1）
- **暗号化**：**新しい pip 依存を入れない。** 標準ライブラリだけでは libsodium sealed box は作れない（X25519・XSalsa20-Poly1305 が無い）。PyNaCl も入れない。**ランナー同梱の `gh secret set` に封をさせる**（設計書 §3 D2）。**供給網の増分は 0**
- **いつ書き戻すか**：rotate のたびにランナーの一時ファイル（sink）へ上書き → workflow の書き戻しステップが **`if: always()`** で最後の 1 個を送る。`_req()` の 401 自動再取得で 2 回 rotate しても最後の値になる（設計書 §4-2）
- **`logout`（B3）とは正面から矛盾する**：`logout` は対のリフレッシュトークンも殺すので、**書き戻した値も同時に死ぬ**。**書き戻し運用のときは B3 を止める**（`safe_logout()` を sink 有効時にスキップ）。代替として **`op: token_revoke`（手動キルスイッチ）** を置く（設計書 §4-4）
- **失敗したとき**：secret に死んだ値が残る。**自動では直らない。** `::error::`・`[WB]` 行・Job Summary の 3 か所に**確定文言**（設計書 §5-2）で「もう使えない・PM が取り直す必要がある」と出し、ジョブを赤くする。**degrade 先は今日の運用（R-a）**
- **同時実行**：`deploy`・`inspect`・`token_refresh`・`token_revoke` に job 単位の `concurrency`（**`cancel-in-progress: false` は load-bearing**）
- **安全弁**：**`GH_SECRETS_PAT` を置くまで挙動は今日と 1 ミリも変わらない**（sink を設定しない → B3 が復活する）。PM は PR-3 まで進んだ時点で「やっぱりやめる」を選べる

## PR の分割案（直列。ファイル集合が重なる）

| PR | 中身 | 完了条件 |
|---|---|---|
| **PR-0** | 設計書のみ（コード変更なし） | `npm test` PASS |
| **PR-1** | `console_api.py` の sink 実装＋単体テスト t1〜t5・t9 ／ **`op: token_selftest`**（Dify を一切呼ばず、捨て用 secret `DIFY_CONSOLE_REFRESH_SELFTEST` にダミー値を書くだけ。**本物のトークンを 1 回も消費せずに PAT 権限〔V-A〕・`gh` の封印・Environment の綴りを実測する**）／ `DEPLOY.md` §10-2 の骨子 | 単体テスト緑。`op: token_selftest` が緑。**V-A の答えが `DEPLOY.md` §10-2 手順 9 に反映されている** |
| **PR-2** | `safe_logout()` の条件化（B3 の停止）＋ t6・t7 ／ `deploy`・`inspect` に Preflight／書き戻しステップ ／ `concurrency` ／ §5-2 の文言 | **t6 が「logout しない＋書き戻した値が生きている」を証明**。受け入れ条件 r1〜r10 |
| **PR-3** | `scripts/dify/console_session.py`（`refresh`）＋ `op: token_refresh` ／ `DEPLOY.md` §10 完成 ／ **実機検証 Issue を `run:runner` で起票** ／ 自己テスト用 secret の後始末 | 実機で `op: token_refresh` を 2 回連続で緑（別 Issue） |
| **PR-4** | `op: token_revoke`（B3'）＋ t8 ＋ `DEPLOY.md` §10-5 | `verify.mjs` §15 が PASS のまま |
| **PR-5** | **`CLAUDE.md` §7 の秘密の記述を設計書 §7-2 の原文に差し替える（PM 承認が前提）** | Issue に PM の明示的な承認コメントがある |

## 受け入れ条件

**機械（`scripts/dify/tests/`。モックサーバで完結。ネットワーク不要）**

- [ ] t1：`DIFY_REFRESH_SINK` 未設定なら sink を作らない（既存テストが全部通る）
- [ ] t2：sink 設定で `refresh()` 1 回 → **0600・末尾改行なし**・中身が新トークン
- [ ] t3：401 自動再取得を誘発して 2 回 rotate → sink は**2 回目**の値。**その値でモックに `refresh` が通る**
- [ ] t4：sink パスがリポジトリ作業ツリー配下 → `ConsoleAPIError`。**書かない**
- [ ] t5：rotate 値が形式検査に合わない → `ConsoleAPIError`。**書かない**
- [ ] **t6：sink 設定時に `safe_logout()` が `logout` を呼ばない。かつ sink の値でモックに `refresh` が通る**（§4-4 の矛盾が解けた証明）
- [ ] t7：sink 未設定時は従来どおり `logout` を呼び、その後 sink の値は使えない（B3 の性質が残っている）
- [ ] t8：`console_session.py revoke` が `logout` を呼び、**sink ファイルを削除する**
- [ ] t9：`_mask()` が `ghp_…` / `github_pat_…` を伏せる

**diff 監査（reviewer）**

- [ ] r1：`dify-ops.yml` の `permissions` が**どのジョブも `contents: read` のまま**
- [ ] r2：`concurrency` の **`cancel-in-progress: false`**。`kb`/`tests`/`probe` を入れていない
- [ ] r3：書き戻しの `TARGET_SECRET` / `TARGET_ENV` が**固定文字列**（`inputs.*` から作らない）
- [ ] r4：`gh secret set` が **`--body` ではなく stdin**
- [ ] r5：`set -x` / `env` / `printenv` / トークンの `echo` が**無い**
- [ ] r6：`mock/**`・`tools/verify.mjs`・`dify/env/**`・`dify/apps/**` の diff が **0 行**
- [ ] r7：設計書 §5-2 の 3 つの文言が**原文どおり**
- [ ] r8：`CLAUDE.md` の diff が **0 行**（PR-5 を除く）
- [ ] r9：**新しい pip 依存・新しい action が無い**（`pip install pyyaml` のまま）
- [ ] r10：`verify.mjs` §15 が PASS（`DELETE` は `kb_upload.delete_document` の 1 か所のまま）

**共通**

- [ ] `npm test` が PASS。**`regress --update` を打っていない**（データ層を触らないため）

## 触らない範囲（明示）

- **`mock/**` は 1 バイトも触らない**（データ層・多言語辞書・トークンに変更なし＝ regress の基準は据え置き）
- **`tools/verify.mjs` を触らない**（特に §15）
- `dify/apps/**`・`dify/kb/**`・`dify/tests/**`・`dify/env/**`・`dify/state/**`・`dify/results/**`
- `dify-ops.yml` の `kb` / `tests` / `probe` ジョブ（`concurrency` グループにも入れない）
- `console_api.py` の `login()` / `import_dsl()` / `publish()` / `list_apps()` のシグネチャ
- **`CLAUDE.md`（PR-5 だけが、PM 承認後に触る）**・`.claude/**`

## PM の判断待ち（設計書 §12）

1. **B3（実行後に必ずセッションを殺す）を手放してよいか。** 推奨＝手放す。ただし `dify-cloud-master` の Dify アカウントが**架空世界以外のデータを持つワークスペースに繋がっていないか**を確認したい
2. 月 1 回の自動延命（cron）を入れるか。推奨＝**まず入れない**（手動 `op: token_refresh` のみ）
3. PAT の期限は 1 年か 90 日か。推奨＝**1 年**
4. **`CLAUDE.md` §7 の差し替え（設計書 §7-2 の原文）の承認**。現行 §7 は `DIFY_CONSOLE_REFRESH` を置いた時点ですでに実態と食い違っている
