# dify/DEPLOY.md — Mac から Dify Cloud へ投入・テストする手順（全自動運用向け）

PM の Mac（Claude Code CLI ＋ Claude in Chrome）から、`dify/apps/*.yml` を Dify Cloud（`cloud.dify.ai`）に取り込み、
ナレッジを投入し、`dify/tests/*.json` を Service API で流して結果を `dify/results/` に残すまでの手順。
インポートの画面操作そのものは [`README.md`](./README.md) にある。ここは **順番とコマンド** だけ書く。

## 0. 前提

- Mac に Python 3 と `git`。`kb_upload.py` / `run_tests.py` は標準ライブラリのみで動く。**`render.py` / `check.py` は PyYAML が要る**（`pip3 install pyyaml`）
- Claude Code CLI でこのリポジトリを clone 済み（`git clone https://github.com/shoulang0729/dify.git && cd dify`）
- Chrome で Dify Cloud にログイン済み（Claude in Chrome が同じプロファイルを使う）
- API キーは **環境変数** で渡す（`CLAUDE.md` §2-10・§2-12）。値は commit しない・チャットに貼らない。**リポジトリ内に `.env` や `dify/env/**/env.yml` 以外の設定ファイルを作らない**（`git status` に出たら追加しないこと。`.gitignore` は `.env` `.env.*` `*.key` `*.pem` `secrets/` `dify/build/` を除外済み）
- どの環境に投入するかは `DIFY_ENV`（既定 `cloud-master`）で決める。環境の一覧・差分は [`env/README.md`](./env/README.md)

```bash
# 設定ファイルは **リポジトリの外** に置く（環境ごとに 1 ファイル）
mkdir -p ~/.config/dify && cp scripts/dify/env.example ~/.config/dify/cloud-master.env
# ~/.config/dify/cloud-master.env を編集して値を入れたら
export DIFY_ENV=cloud-master
set -a; source ~/.config/dify/$DIFY_ENV.env; set +a
# または直接
export DIFY_BASE_URL=https://api.dify.ai/v1
export DIFY_DATASET_KEY=...                 # ナレッジ API キー（Studio → ナレッジ → 右上 API → API キー）
export DIFY_APP_KEY_KN01=...                # KN-01 アプリの Service API キー（アプリ → API アクセス）
export DIFY_APP_KEY_DC01=...                # DC-01 アプリの Service API キー
```

環境変数名の規則：`DIFY_APP_KEY_<管理番号のハイフン無し>`（`KN-01` → `DIFY_APP_KEY_KN01`）。社内・顧客環境向けの追加変数は [`scripts/dify/env.example`](../scripts/dify/env.example) を参照。

## 1. 手順

**`DIFY_ENV=cloud-master`（既定）のとき**は render 不要。マスタの raw URL をそのまま貼れる（① そのまま）。
**社内・顧客環境（`inhouse` / `customer-a` 等）のとき**は、先に `render.py` でその環境向けの DSL を `dify/build/<env>/` に作る：

```bash
python3 scripts/dify/render.py --env $DIFY_ENV --all --strict
```

- Cloud（セルフホストでない環境）は Studio の「DSL ファイルをインポート」→ **ローカルファイル** タブで `dify/build/$DIFY_ENV/*.yml` を選ぶ（① の 1〜2 の代わり）
- `--strict` は `${VAR}` の未定義・`models.overrides` の不一致などを exit 1 で検出する（値はログに出さない）。詳しくは [`env/README.md`](./env/README.md)

### ① アプリの取り込み（Chrome。`cloud-master` の場合）
1. Studio → 「アプリを作成」→ **「DSL ファイルをインポート」** → **URL** タブ
2. raw URL を貼って「作成」
   - `https://raw.githubusercontent.com/shoulang0729/dify/main/dify/apps/KN-01-tech-knowledge-qa.yml`
   - `https://raw.githubusercontent.com/shoulang0729/dify/main/dify/apps/DC-01-hq-report-draft.yml`
   - `version: 0.6.0` は Cloud より古いので「古いバージョン」の警告が出ることがある → そのまま続行
3. LLM ノードを開き、**モデル**を環境で使えるものに選び直す（既定は `openai / gpt-4o-mini`。未設定ならプロバイダー設定へ）
4. 右上「公開」→「公開する」
5. 左メニュー「API アクセス」→「API キー」→ 新規作成 → 値を環境変数へ（`DIFY_APP_KEY_KN01` / `DIFY_APP_KEY_DC01`）

### ② ナレッジの投入（KN-01 のみ）
```bash
python3 scripts/dify/kb_upload.py --env $DIFY_ENV KN-01
# KB 名だけ確認したいとき（ネットワークを呼ばない）
python3 scripts/dify/kb_upload.py --env $DIFY_ENV --dry-run KN-01
```
- KB 名は `dify/env/$DIFY_ENV/env.yml` の `knowledge.KN-01.name`（`cloud-master` なら `KN-01 技術ナレッジQA`）
- あれば再利用・無ければ作成し、`dify/kb/KN-01/` の 3 文書をアップロード → インデックス完了まで待つ（数分）
- 同名文書はスキップ（再実行しても二重登録しない）
- 完了したら **Chrome**：KN-01 のアプリを開く → 「知識検索」ノード → **ナレッジを追加** → `KN-01 技術ナレッジQA` を選択 → 保存 → **再公開**

### ③ テスト実行と結果の commit
```bash
python3 scripts/dify/run_tests.py KN-01 DC-01
git add dify/results/*.md
git commit -m "test(dify): KN-01 / DC-01 Service API テスト結果"
git push
```
- 結果は `dify/results/<管理番号>-<YYYYMMDD-HHMM>.md`（入力／出力／期待語の一致／禁止語／所要秒／判定の表＋出力全文）
- 失敗があっても全件回し、最後に合否を集計する（終了コード 1）。設定不備（キー未設定）は 2
- API を呼ばず JSON だけ確かめる：`python3 scripts/dify/run_tests.py --dry-run KN-01 DC-01`

## 2. Claude Code に渡すプロンプト例（1 行）

```
dify/DEPLOY.md に従って KN-01 と DC-01 を投入・テストし、結果を dify/results/ に commit して push。エラーは Issue #82 にコメント。API キーは環境変数から読み、値は出力しない
```

## 3. Claude in Chrome に頼む文面例

- 取り込み：「Dify Cloud の Studio で『アプリを作成』→『DSL ファイルをインポート』→ URL タブに `https://raw.githubusercontent.com/shoulang0729/dify/main/dify/apps/KN-01-tech-knowledge-qa.yml` を貼って作成。LLM ノードのモデルを使えるものに変えて公開し、『API アクセス』で API キーを 1 つ発行して、その値を **画面で見せるだけ**（チャットには貼らない）」
- KB 紐づけ：「KN-01 技術ナレッジQA のアプリを開き、『知識検索』ノードのナレッジに『KN-01 技術ナレッジQA』を追加して保存、右上から再公開」
- 動作確認：「KN-01 のプレビューで『SUS304 の Φ8 深穴（深さ 60mm）ドリル加工、推奨条件を教えて』と送り、回答に TR-2024-007 と 0.06 mm/rev が含まれるか教えて」

## 4. トラブル時

| 症状 | 原因の目安 | 対処 |
|---|---|---|
| `HTTP 401` | キー違い（ナレッジ API キーとアプリ API キーの取り違え、コピー漏れ） | 環境変数を再設定。`echo ${DIFY_APP_KEY_KN01:+set}` で「set」と出るか確認（値は表示しない） |
| `HTTP 404` | アプリ未公開／URL 違い | アプリを「公開」してから再実行。`DIFY_BASE_URL` が `https://api.dify.ai/v1` か確認 |
| `HTTP 400` に `variable ... required` | Workflow の入力変数名が DSL と違う | `dify/tests/DC-01.json` の `inputs` キー（`period` `site` `kpi_notes` `lang`）と Start ノードを照合 |
| KB 検索 0 件・回答が定型文だけ | インデックス未完了／KB がノードに未紐づけ | ナレッジ画面で 3 文書が「利用可能」になっているか確認 → ノードに KB を追加して再公開 |
| モデルのエラー（provider not found 等） | `openai / gpt-4o-mini` が環境に無い | LLM ノードでモデルを選び直して再公開 |
| インポートで「バージョンが古い」警告 | `version: 0.6.0` と Cloud の差 | 警告なら続行。**エラー**で止まる場合はエラー文をそのまま Issue に貼る |
| `kb_upload.py` が `タイムアウト` | 大きい文書のインデックス中 | `--timeout 1800` で再実行（同名文書はスキップされる） |

報告のしかた：エラー文（HTTP ステータス＋本文）を**そのまま**貼る。API キーは貼らない。

## 5. 環境を選んでリリースする（`release.py`）

> 補足：`--dry-run` でも `render.py --strict` は走るので、`inhouse`／`customer-a` は `${VAR}` に相当する環境変数（少なくとも `DIFY_BASE_URL`・`DIFY_CONSOLE_URL`）が無いと exit 1 になる。`cloud-master` は環境変数なしで通る。

`§1`〜`§4` は 1 アプリずつ手で進める手順。`scripts/dify/release.py` は **render → import → KB → test → tag → CHANGELOG** を
1 コマンドで通す（[`env/README.md`](./env/README.md)・設計 `docs/handoff/2026-09-07-repo-layout-v2.md` §4-4）。

```bash
export DIFY_ENV=customer-a
set -a; source ~/.config/dify/$DIFY_ENV.env; set +a

# まず必ず --dry-run で確認する（ネットワークを一切呼ばない。render と、cloud なら IMPORT.md 生成だけ実行する）
python3 scripts/dify/release.py --env $DIFY_ENV --all --dry-run

# 中身に問題が無ければ本番実行（タグは push しない。CI や別 Issue で自動 push しない）
python3 scripts/dify/release.py --env $DIFY_ENV --all
git push origin "release/$DIFY_ENV/$(date +%Y%m%d)"   # タグの push は人が確認してから
```

### 環境ごとの経路

| env の `dify.edition` | 何が起きるか |
|---|---|
| `cloud`（`cloud-master` など） | **自動 import しない**。`dify/build/<env>/IMPORT.md` を生成してそこで止まる。IMPORT.md の手順（raw URL または `dify/build/<env>/*.yml` のファイル選択）で Chrome から手動インポート → 公開 → API キー発行してから、続き（`kb_upload.py` / `run_tests.py`）を人が判断して実行する。Console API は Cloudflare / Cookie で壊れやすいため（Issue #3・`CLAUDE.md` §6） |
| `selfhost`（`inhouse` / `customer-a` など） | `scripts/dify/console_api.py` で **ログイン → DSL インポート（既存アプリなら上書き、無ければ新規）→ 公開** まで自動で進み、続けて KB 投入・テストまで通す |

### 手順（selfhost の本番実行）

1. `render.py --env <env> --strict` → `dify/build/<env>/`
2. ガード確認（G1 越境・G2 PIPL マスク・G3 パートナー mock。**すべて警告のみ**。DP-02 の越境マトリクスが env に入るまでは release を止めない。警告が出たら手動で確認する）
3. `console_api.py` で import → publish
4. KB がある番号だけ `kb_upload.py --env <env>`
5. `run_tests.py --env <env>` → `dify/results/<env>/<番号>-<YYYYMMDD-HHMM>.md`
6. **全件合格のときだけ** `dify/CHANGELOG.md` に 1 行追記
7. **全件合格のときだけ** `git tag release/<env>/<YYYYMMDD>`（同日 2 回目以降は `-2` `-3` …）を**ローカルに**作る。`--no-tag` で抑止できる。**push は人が確認してから**別途行う

途中で失敗したら、その段より後には進まない（`[STOP] stage=...` に出る）。**失敗時は tag も CHANGELOG も書かない。**

### 環境変数（Console API 用。`scripts/dify/env.example` 参照）

| 変数 | 用途 |
|---|---|
| `DIFY_CONSOLE_URL` | Console API の基点（selfhost のみ） |
| `DIFY_CONSOLE_EMAIL` / `DIFY_CONSOLE_PASSWORD` | Console ログイン（selfhost のみ。**cloud では使わない**。値はログに出ない） |

### `--dry-run` を必ず先に

`--dry-run` は render・ガード・（cloud なら）`IMPORT.md` 生成までは実際に行い、その先（selfhost の login/import/publish・KB 投入・テスト・tag・CHANGELOG）は**実行予定のコマンドを表示するだけ**でネットワークを一切呼ばない。まず `--dry-run` で render 結果（`dify/build/<env>/render-report.md`）とガードの警告を確認してから本番実行する。

### `console_api.py` について

`scripts/dify/console_api.py` はセルフホスト Dify（Community 1.15.x 想定）の Console API（`login` / `import_dsl` / `list_apps` / `publish`）を 1 ファイルに閉じ込めている。**エンドポイントの形は 1.15.x の実機で未確認**（設計書 §4-4）。顧客・社内のセルフホストで初めて通すときにエラーが出たら、このファイルだけを直せばよい。

