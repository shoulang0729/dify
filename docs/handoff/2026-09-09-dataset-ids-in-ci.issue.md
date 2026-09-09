# `op: deploy` が KB の紐づけを消さないようにする（dataset id を実行時に Datasets API から解決する）

設計書: `docs/handoff/2026-09-09-dataset-ids-in-ci.md`
親: #121（W4）／**前提: #208（W4-4 `op: deploy`）を先にマージ**
レーン: **M/L** ／ ラベル: `run:cloud`

---

## 何を直すか

`dify/apps/{KN-01,KN-02,KN-03,GN-01}-*.yml` は `dataset_ids: []` で出荷されている。焼き込みの仕組み（`render.py` R5）は実装済みだが、**`DIFY_DATASET_ID_*` は GitHub の secret に無い**。そのため `op: deploy` をこの 4 本に流すと、**空の `dataset_ids` で上書きインポートされ、公開時に実機の KB 紐づけが黙って消える**。`render.py` は「未解決・警告」を 1 行出すだけで exit 0 を返すので、警告を読まない限り気づけない。

#208 は「実行全体を止める」暫定歯止めで事故を防ぐ。**本 Issue は、止まらずに正しく動く恒久対応。**

## どう直すか（要約）

- **dataset id は実行時に Datasets API から KB 名で引く。** `GET /v1/datasets` の `name` 完全一致。名前の唯一の定義は `dify/env/<env>/env.yml` の `knowledge.<番号>.name`（KB を作る `kb_upload.py` と同じ 1 行を読む）
- **新しい secret はゼロ。** `DIFY_DATASET_KEY` は Environment `dify-cloud-master` に登録済みで、`deploy` ジョブは同じ Environment を宣言している。ステップの `env:` に 1 行足すだけ
- **PM の手作業はゼロ。** 4 つの値をコピーする作業も、それを更新し続ける作業も発生しない
- **`render.py` は 1 バイトも変えない。** 解決した id は `cloud_deploy.py` が **render サブプロセスの env にだけ**渡す（親の `os.environ` にも `$GITHUB_ENV` にもジョブの `env:` にも入れない）→ `render --check` の 12/12 バイト一致は「差分ゼロ」で保たれる
- **`dify/state/` は作らない**（W2 と衝突する。API から引ける以上、解決の入力としては要らない）
- **失敗は fail closed。** 引けない・重複する・API が落ちている → **Dify に 1 バイトも書かずに `exit 2`**

## PR 分割

| PR | 中身 | 触るファイル | 依存 |
|---|---|---|---|
| **PR-1** | `scripts/dify/dataset_ids.py`（新規・**GET のみ**）／`scripts/dify/tests/test_dataset_ids.py`（新規）／`scripts/dify/tests/mock_server.py`（`GET /v1/datasets` のページング）／`tools/verify.mjs`（**§12-f を追加**。新しい節番号は取らない） | 左の 4 本のみ | **#208 と並列可** |
| **PR-2** | `scripts/dify/cloud_deploy.py`（0.5 段＝解決／1.5 段＝ G-KB2／`run_render(..., extra_env=)`／`--no-resolve-datasets`）／`scripts/dify/tests/test_cloud_deploy.py` | 左の 2 本のみ | **#208 マージ後・PR-1 の後** |
| **PR-3** | `.github/workflows/dify-ops.yml`（`deploy` ジョブに `DIFY_DATASET_KEY`）／`dify/DEPLOY.md` §9（既知の制限 → 恒久対応）／`dify/env/README.md`／`scripts/dify/env.example`／`dify/KNOWN_ISSUES.md` | 左の 5 本のみ | **PR-2 の後**（#208 も同じファイルを触るため直列） |
| **PR-4（任意・後続）** | `scripts/dify/release.py` にも同じ経路 | `release.py`・テスト | PR-2 の後 |

**#208 の暫定歯止め**：`cloud_deploy.py` にあるならそのまま **G-KB2** として残す（位置を 1.5 段へ）。`dify-ops.yml` の shell にあるなら PR-2 で Python 側へ移し、PR-3 で shell 側を削る。**歯止めを 2 か所に置かない。**

## 受け入れ条件

### 共通（全 PR）

- [ ] `npm test` が ALL PASS（warn は現状と同じ 2 件）
- [ ] **`python3 scripts/dify/render.py --env cloud-master --all --check` が 12/12 `[OK]`**（`DIFY_DATASET_ID_*` を source していない素の shell）
- [ ] `git diff` に **`scripts/dify/render.py` が 1 行も出ない**
- [ ] `git diff` に **`dify/apps/**`・`dify/env/**/env.yml`・`mock/**`・`tools/regress.baseline.json` が 1 行も出ない**（データ層の変更 **0 件**。`regress --update` しない）
- [ ] 既存テスト全件 PASS（`test_kb_upload` / `test_cloud_deploy` / `test_console_api` / `test_run_tests` / `test_sync_back` / `test_masking` / `test_lang_check` / `test_inspect_rerank`）
- [ ] `dify-ops.yml` のトリガが `workflow_dispatch` のみ

### PR-1

- [ ] **T1** `kb_codes()` が KN-01 / KN-02 / KN-03 / GN-01 の 4 件だけを返す（**番号のハードコードではなく DSL の `knowledge-retrieval` ノードから導出**）
- [ ] **T2** `resolve()` が **`GET` 以外の HTTP メソッドを 1 度も送らない**（モックが POST/PATCH/DELETE を受けたら失敗）
- [ ] **T3** 名前完全一致 1 件を引ける。**`has_more` を跨いだ 2 ページ目**の KB も引ける
- [ ] **T4** 同名 KB が 2 件 → `DatasetResolveError`（**先頭を採らない**）
- [ ] **T5** 名前 0 件 → `DatasetResolveError`
- [ ] **T6** 環境変数が設定済みの番号は **API を 1 度も呼ばない**（GET 0 回）
- [ ] **T7** 標準出力・例外文字列に **完全な UUID が出ない**（KB 名は出てよい）
- [ ] **T8** `resolve()` 前後で **`os.environ` のキー集合が不変**
- [ ] **T9** `assert_bound()` が空 `dataset_ids` で例外、UUID 1 件入りで正常終了
- [ ] `verify.mjs` §12-f が `.github/workflows/**` の `DIFY_DATASET_ID_` を検出して FAIL にできる（手元で 1 行入れて確認）

### PR-2

- [ ] **T10** 解決値が **`run_render` に渡る env dict にだけ**入り、親プロセスの `os.environ` には入らない
- [ ] **T11** 解決に失敗すると **`exit 2` で Console API に 1 リクエストも飛ばない**（import 0 回・publish 0 回）
- [ ] **T12** render 出力の `dataset_ids` が空のまま来ると **`exit 2`・import 0 回**（G-KB2 がここに一本化されている）
- [ ] **T13** `--dry-run` が **Datasets API にも Console API にも 1 リクエストも送らない**
- [ ] **T14** KB を持たない 8 本だけが対象なら、`DIFY_DATASET_KEY` 未設定でも正常に動く

### PR-3

- [ ] `dify/DEPLOY.md` §9 から「`codes` にこの 4 番号を含めない」という回避策が消え、恒久対応と失敗時の挙動（**何も起きない**）が書かれている
- [ ] `dify/DEPLOY.md` に「`op: deploy` の前に `op: kb_upload` が済んでいること」が 1 行ある

## 触らない範囲（明示）

- **`scripts/dify/render.py`（1 バイトも変えない）**
- **`dify/apps/*.yml`（12 本。`dataset_ids: []` のまま）**
- **`dify/env/**/env.yml`（3 環境とも変更なし）**
- **`dify/state/`（作らない。W2 に残す）**
- `tools/verify.mjs` の §13（W2 予約）・§14・§15・§16（#205 予定）
- `mock/**`・`data/world/**`・`tools/regress.mjs`・`tools/regress.baseline.json`
- `scripts/dify/{kb_upload,console_api,sync_back,release,masking}.py`（PR-4 を除く）
- `.github/workflows/{verify,pages}.yml`・`.claude/**`
- `CLAUDE.md`（文案は設計書 §13 D-3。**適用は PM**）

## PM 判断待ち（推奨つき。設計書 §13）

| # | 判断 | 推奨 |
|---|---|---|
| D-1 | `release.py` にも同経路を通すか | **後続 PR-4** |
| D-2 | `render.py --check` 自体を R5 非依存に頑健化するか | **しない（今回は）**。§2-12 に触るため独立 Issue |
| D-3 | `CLAUDE.md` に 1 行足すか | **足す（完了時）**。文案は設計書 §13 |
| D-4 | verify の節番号 | **§12-f**（新番号を取らない） |
| D-5 | Datasets API の失敗を再試行するか | **しない**（fail closed 優先） |
| D-6 | 実機確認を同じ Issue に含めるか | **別 Issue（`run:runner`）**。`CLAUDE.md` §7 |

## 実機確認（**この Issue の対象外。別 Issue `run:runner`**）

- `op: deploy` に `KN-02` 1 本 → 公開後に Studio の知識検索ノードで KB が選択済み
- 続けて `op: run_tests KN-02` が合格
- `DIFY_DATASET_KEY` を外した状態で `op: deploy KN-02` → **`exit 2` で止まり、Cloud 側の紐づけが変わらない**
- ジョブログ・Job Summary に dataset id の完全な UUID が出ていない
