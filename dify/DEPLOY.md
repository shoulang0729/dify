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
- Dify Cloud の **設定 → モデルプロバイダー**で **OpenRouter プラグインを追加**し、API キーを登録済み。キーは画面に入れるもので、リポジトリにも環境変数にも置かない。**プラグイン定義に載っていることと、そのアカウントで実際に呼べることは別**なので、初回は LLM ノードのモデル一覧に `qwen/qwen3.8-max` と `moonshotai/kimi-k3` が出るかを目で確認する（出なければ止めて `KNOWN_ISSUES.md` に起票）。OpenRouter は customizable-model 対応なので、一覧に無い id は手入力もできる

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

### 環境変数の確認のしかた（値を出さない）

キーが入っているかを確かめるときは **設定の有無だけ**を見る。

    [ -n "${DIFY_APP_KEY_KN01:-}" ] && echo set || echo unset

**禁止**：`echo $DIFY_APP_KEY_KN01` / `env` / `printenv` / `set` / `cat ~/.config/dify/*` /
`export -p`。値がツール出力・ログ・チャットに 1 度でも出たら**そのキーは漏れたものとして扱う**
（Dify の画面で再発行する。手順は §4 の表の最終行）。

### ブラウザ操作が要るとき（Claude in Chrome が無い環境）

Cloud の投入・公開は §5 の Console API 経路（`cloud_deploy.py`）で完結するので、**通常はブラウザ操作は不要**。
`console_token` の取得と、Console API が使えないときの逃げ道としてだけブラウザを使う。

Claude in Chrome が無い環境（VS Code 拡張の Claude Code など）では **Playwright MCP** を足すと、
同じ画面操作を Claude Code から行える。

    claude mcp add --scope user playwright -- npx -y @playwright/mcp@latest --user-data-dir ~/.config/dify/pw-profile

- `--user-data-dir` を固定するとログイン状態が残る（毎回ログインし直さなくてよい）
- **初回だけ人がログインする**：Playwright が開いたウィンドウで `https://cloud.dify.ai` にログインし、
  そのウィンドウを閉じずに次の指示を出す。2 回目以降は同じプロファイルが再利用される
- **ログイン情報・トークンをチャットに貼らない**（`CLAUDE.md` §2-10）。エージェントには「画面で操作して」とだけ頼む
- **ファイルの読み取りは MCP の作業ディレクトリ配下に限られる**（`outside allowed roots` で拒否される。DI-021）。
  リポジトリが別の場所にあるときは、インポートする DSL を作業ディレクトリ配下へ一時コピーしてから読み込ませる
- 公開のショートカットは `⌘⇧P`。**知識検索ノードに KB が未選択だと、UI がチェックリストで止めて公開リクエスト自体を送らない**
  （コンソールに `Checklist has unresolved items`）。KB を先に作って紐づけてから公開する
- API キーは画面に出た値を読まず、**一覧行のコピーボタン → クリップボード → `~/.config/dify/<env>.env` へ直接書き込む**
  （値を会話・ログに出さない。`CLAUDE.md` §2-10）

#### `console_token` の取り方（Console API 経路の前提。人が 1 回だけ行う）

> **確認要（2026-09-08 実測）**：Dify Cloud `1.17.0` のブラウザでは **`localStorage` に `console_token` が無い**。
> コンソール API は **httpOnly のセッション Cookie ＋ `X-CSRF-Token` ヘッダ**で認証しており、Bearer ヘッダは送っていない
> （[#114 のコメント](https://github.com/shoulang0729/dify/issues/114)）。下の手順は旧版・セルフホスト向けとして残している。
> Cloud で Console API 経路を使う場合は、ログイン API がトークンを返すかの確認から要る。

1. Chrome で `https://cloud.dify.ai` にログイン
2. 開発者ツール（⌥⌘I）→ **Application** タブ → 左の **Local Storage** → `https://cloud.dify.ai`
3. キー `console_token` の値をコピー
4. `~/.config/dify/cloud-master.env` の `DIFY_CONSOLE_TOKEN=` の右に貼って保存（**リポジトリの中には置かない**）

```bash
export DIFY_ENV=cloud-master
set -a; source ~/.config/dify/$DIFY_ENV.env; set +a
[ -n "${DIFY_CONSOLE_TOKEN:-}" ] && echo set || echo unset   # 値は表示しない
```

トークンには期限がある。`cloud_deploy.py` が exit 3（認証エラー）で止まったら、この手順でもう一度取り直す。
**値をチャット・ログ・Issue・結果ファイルに貼らない。**

## 1. 手順

**`DIFY_ENV=cloud-master`（既定）のとき**は render 不要。マスタの raw URL をそのまま貼れる（① そのまま）。
**社内・顧客環境（`inhouse` / `customer-a` 等）のとき**は、先に `render.py` でその環境向けの DSL を `dify/build/<env>/` に作る：

```bash
python3 scripts/dify/render.py --env $DIFY_ENV --all --strict
```

- Cloud（セルフホストでない環境）は Studio の「DSL ファイルをインポート」→ **ローカルファイル** タブで `dify/build/$DIFY_ENV/*.yml` を選ぶ（① の 1〜2 の代わり）
- `--strict` は `${VAR}` の未定義・`models.overrides` の不一致などを exit 1 で検出する（値はログに出さない）。詳しくは [`env/README.md`](./env/README.md)

### ブラウザ不要の経路（推奨。`DIFY_CONSOLE_TOKEN` があるとき）

`console_token`（§0）を取ってあれば、ブラウザを開かずに投入・公開できる。まず `--dry-run` で確認する：

```bash
python3 scripts/dify/cloud_deploy.py --env $DIFY_ENV --all --dry-run
python3 scripts/dify/cloud_deploy.py --env $DIFY_ENV --all
```

- 同じ番号を 2 回流してもアプリは増えない（`apps.<番号>.id` か名前一致で既存アプリを上書きする）
- 新規作成された番号は、表示された書き戻し断片を `dify/env/$DIFY_ENV/env.yml` の `apps:` に**人が**貼る
  （`--write-env` を使う場合も `git diff` を見せてから commit する）
- `DIFY_CONSOLE_TOKEN` が未設定なら exit 2 で止まり §0 の取り方を案内する。401/403 なら exit 3 で止まり取り直し手順が出る
- 詳しいオプションは §5 と `python3 scripts/dify/cloud_deploy.py --help`
- `scripts/dify/release.py --env $DIFY_ENV --all` を使う場合も、`DIFY_CONSOLE_TOKEN` が set なら import 段でこの経路が自動で使われる（§5）

**`DIFY_CONSOLE_TOKEN` が無いとき**は、以降の ①〜④（Chrome、または §0 の Playwright MCP）の画面手順で進める。

### ① アプリの取り込み（Chrome。`cloud-master` の場合）
1. Studio → 「アプリを作成」→ **「DSL ファイルをインポート」** → **URL** タブ
2. raw URL を貼って「作成」
   - `https://raw.githubusercontent.com/shoulang0729/dify/main/dify/apps/KN-01-tech-knowledge-qa.yml`
   - `https://raw.githubusercontent.com/shoulang0729/dify/main/dify/apps/DC-01-hq-report-draft.yml`
   - `version: 0.6.0` は Cloud より古いので「古いバージョン」の警告が出ることがある → そのまま続行
3. LLM ノードを開き、**モデルが `openrouter / qwen/qwen3.8-max` になっているか確認**する。あわせて
   モデル設定のパラメータが **`temperature 0.2` / `max_tokens 4096` / `reasoning_effort low` /
   `exclude_reasoning_tokens ON`** になっているかを見る（DSL の `completion_params` の指定どおりなら変更不要。
   DI-010 / DI-011 の対処）。空欄・エラーならプロバイダー未設定。
   **勝手に別のモデル・別の値に変えない**（変えるなら env とマスタを同時に直す＝`CLAUDE.md` §2-12）
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
- **チャンクは区切り `\n\n`・最大 1024 字の custom 固定**（`kb_upload.py` が送信。UI 既定の改行区切りだと条件表・箇条書きが 1 行 1 チャンクに分断される。DI-006）
- **新規 KB 作成時は Rerank を無効化**（`retrieval_model.reranking_enable: false` を送信。DI-005）。`POST /datasets` がこの項目を受け付けない版では、警告を出して従来どおり作成するので、その場合は Chrome で **ナレッジ → 該当 KB → 検索設定 → Rerank を OFF** にする。既存 KB を再利用する経路では設定を変更しないので、既存 KB は必ず画面で確認する
- **KB を紐づけたら、その場で「知識検索」ノードの検索設定を開いて確認する**。Rerank が勝手に ON になり
  Rerank モデル（`openrouter / cohere/rerank-4-pro` など）が入っていることがある（DI-012。**cloud-master は UI 既定の Rerank ON を許容する**。方針は
  `docs/handoff/2026-09-08-thinking-budget-and-streaming.md` §4 で PM が採択済み）。入っていたらそのまま進めてよい

### ③ テスト実行と結果の commit
```bash
python3 scripts/dify/run_tests.py KN-01 DC-01
git add dify/results/*.md
git commit -m "test(dify): KN-01 / DC-01 Service API テスト結果"
git push
```
- 受信は **streaming**（`response_mode: streaming`）が既定。Dify Cloud の前段が blocking を
  **120 秒で HTTP 504** にするため（DI-010）。`--timeout` の既定は 600 秒
- 従来の blocking で試したいときは `--blocking`（セルフホストや、504 の再現確認に使う）
- 結果は `dify/results/<管理番号>-<YYYYMMDD-HHMM>.md`（入力／出力／期待語の一致／禁止語／所要秒／トークン／判定の表＋出力全文）
- 結果の表には**所要秒とトークン数**が入る（`message_end` / `workflow_finished` の usage 由来。取れないときは `—`）
- 失敗があっても全件回し、最後に合否を集計する（終了コード 1）。設定不備（キー未設定）は 2
- API を呼ばず JSON だけ確かめる：`python3 scripts/dify/run_tests.py --dry-run KN-01 DC-01`
- 接続先を直接指定したいときは `--base-url`、結果の出力先を変えたいときは `--out`


### ④ 既存アプリを更新する（再インポート）

マスタを直したあと、Cloud 上の既存アプリに反映する手順。

0. **再インポートの前に、Cloud 側が Git と乖離していないか見る。**
   Chrome で対象アプリを「DSL をエクスポート」→ 落ちたファイルを

       python3 scripts/dify/sync_back.py ~/Downloads/<番号>*.yml --dry-run

   に掛け、差分要約を読む。**モデル・プロンプトに身に覚えのない差分があれば、そこで止めて報告する**
   （2026-09-08 に DC-01 の Cloud 下書きが `gpt-4o-mini` になっていた。Git に無い変更＝ DI-013）。
   差分が `dataset_ids` / `dependencies` / `version` / Rerank 設定だけなら、そのまま 1 番へ進んでよい
1. Studio でそのアプリを開く → 左上のアプリ名横「…」→ **「DSL をインポート」** → ローカルの `dify/apps/<番号>-*.yml` を選ぶ → **「上書きしてインポート」**（**2026-09-08 に Cloud で確認済み**：既存アプリの下書きが上書きされ、アプリ id・API キーは変わらない。このダイアログに URL タブは無いのでファイルを選ぶ。`version: 0.6.0` の警告は続行でよい）
2. 上書きできない版だった場合は、**新規アプリとして作成し、旧アプリの名前に `(old)` を付けて残す**（`/dify-deploy` の既定動作と同じ）。API キーは新アプリで再発行し、環境変数を差し替える
3. どちらの場合も **再インポート後に「公開」**し、KN-01 系は**知識検索ノードの KB 紐づけをやり直す**（`dataset_ids` は空で入るため）
4. 反映できたら `python3 scripts/dify/run_tests.py --env $DIFY_ENV <番号...>` を回し、結果を `dify/results/<env>/` に commit する

## 2. Claude Code に渡すプロンプト例（1 行）

```
dify/DEPLOY.md に従って KN-01 と DC-01 を投入・テストし、結果を dify/results/ に commit して push。エラーは Issue #82 にコメント。API キーは環境変数から読み、値は出力しない
```

## 3. ブラウザに頼む文面例（Claude in Chrome / Playwright MCP のどちらでも同じ）

§1 の Console API 経路（`cloud_deploy.py`）が使えないときの代替。**操作内容は両者で同じ**なので、
Claude in Chrome がある環境ではそのまま、無い環境では §0 の Playwright MCP を入れてから同じ文面を使う。
Playwright MCP のときは、あらかじめ同じプロファイルで Dify Cloud にログインしておくこと。

- 取り込み：「Dify Cloud の Studio で『アプリを作成』→『DSL ファイルをインポート』→ URL タブに `https://raw.githubusercontent.com/shoulang0729/dify/main/dify/apps/KN-01-tech-knowledge-qa.yml` を貼って作成。LLM ノードのモデルが `openrouter / qwen/qwen3.8-max` になっているか確認して公開し、『API アクセス』で API キーを 1 つ発行して、その値を **画面で見せるだけ**（チャットには貼らない）」
- 既存アプリの更新：「対象アプリを開き、アプリ名横の『…』→『DSL をインポート』→ ローカルの `dify/apps/<番号>-*.yml` を選んで『上書きしてインポート』。終わったら右上から公開」
- KB 紐づけ：「KN-01 技術ナレッジQA のアプリを開き、『知識検索』ノードのナレッジに『KN-01 技術ナレッジQA』を追加して保存、右上から再公開」
- 動作確認：「KN-01 のプレビューで『SUS304 の Φ8 深穴（深さ 60mm）ドリル加工、推奨条件を教えて』と送り、回答に TR-2024-007 と 0.06 mm/rev が含まれるか教えて」

## 4. トラブル時

| 症状 | 原因の目安 | 対処 |
|---|---|---|
| `HTTP 401` | キー違い（ナレッジ API キーとアプリ API キーの取り違え、コピー漏れ） | 環境変数を再設定。`echo ${DIFY_APP_KEY_KN01:+set}` で「set」と出るか確認（値は表示しない） |
| `HTTP 403` に `error code: 1010` | Cloudflare が Python 標準の User-Agent（`Python-urllib/x`）を拒否 | スクリプトは独自の `User-Agent` を送る（`USER_AGENT` 定数）。古い版のスクリプトなら更新する。キーは無関係 |
| `HTTP 404` | アプリ未公開／URL 違い | アプリを「公開」してから再実行。`DIFY_BASE_URL` が `https://api.dify.ai/v1` か確認 |
| `HTTP 400` に `variable ... required` | Workflow の入力変数名が DSL と違う | `dify/tests/DC-01.json` の `inputs` キー（`period` `site` `kpi_notes` `lang`）と Start ノードを照合 |
| KB 検索 0 件・回答が定型文だけ | インデックス未完了／KB がノードに未紐づけ | ナレッジ画面で 3 文書が「利用可能」になっているか確認 → ノードに KB を追加して再公開 |
| モデルのエラー（provider not found 等） | `openrouter` プラグイン未導入、またはそのアカウントで当該モデルが未提供 | 設定 → モデルプロバイダーで OpenRouter を追加。モデルが一覧に無ければ手入力（customizable-model）を試し、それでも駄目なら `KNOWN_ISSUES.md` に `DI-xxx` で起票して止まる |
| インポートで「バージョンが古い」警告 | `version: 0.6.0` と Cloud の差 | 警告なら続行。**エラー**で止まる場合はエラー文をそのまま Issue に貼る |
| `kb_upload.py` が `タイムアウト` | 大きい文書のインデックス中 | `--timeout 1800` で再実行（同名文書はスキップされる） |
| `HTTP 504`（本文 `error code: 504`）が 120 秒前後で返る | blocking 受信で Cloud 前段のゲートウェイに掛かった（DI-010） | 既定の streaming を使う（`--blocking` を外す）。それでも遅いときはモデルの `reasoning_effort` を見直す（`docs/handoff/2026-09-08-thinking-budget-and-streaming.md` §2-7） |
| API キーの値が画面・ログ・チャットに出てしまった | `echo $VAR` などで値を展開した（§0） | **そのキーを漏れたものとして扱う**。Dify の該当アプリ → 「API アクセス」→ 旧キーを削除 → 新規作成し、`~/.config/dify/<env>.env` の該当行を差し替えて `set -a; source ...; set +a` し直す。リポジトリ・Issue・PR に値が残っていないことを `git log -p` で確認する |

報告のしかた：エラー文（HTTP ステータス＋本文）を**そのまま**貼る。API キーは貼らない。

実際に起きた不具合とその後の顛末は [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md)（`DI-xxx`）に残す。

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
| `cloud`（`cloud-master` など） | `dify/build/<env>/IMPORT.md` を生成（証跡・手動フォールバック用）。**`DIFY_CONSOLE_TOKEN` が set かつ `--no-console-import` でなければ**、続けて `scripts/dify/cloud_deploy.py` の関数を呼んで自動インポート・公開まで進み、そのまま KB 投入・テストへ続く。**トークン未設定、または `--no-console-import` 指定のとき**は従来どおりそこで止まり、IMPORT.md の手順（raw URL または `dify/build/<env>/*.yml` のファイル選択）で Chrome（または §0 の Playwright MCP）から手動インポート → 公開 → API キー発行してから、続き（`kb_upload.py` / `run_tests.py`）を人が判断して実行する |
| `selfhost`（`inhouse` / `customer-a` など） | `scripts/dify/console_api.py` で **ログイン → DSL インポート（既存アプリなら上書き、無ければ新規）→ 公開** まで自動で進み、続けて KB 投入・テストまで通す（**変更なし**） |

`--no-console-import` を付けると、`DIFY_CONSOLE_TOKEN` があっても cloud 経路は常に IMPORT.md による手動インポート待ちになる。

### 手順（cloud・トークンありの自動実行）

1. `render.py --env <env> --strict` → `dify/build/<env>/`
2. ガード確認（selfhost と同じ。すべて警告のみ）
3. `IMPORT.md` を生成 → `cloud_deploy.py` の関数で **app_id 解決 → インポート（既存なら上書き）→ 公開**（`--stop-on-error` 相当の挙動ではなく、1 件失敗したら `[STOP] stage=3-import` でそこまでで止まる。`dify/env/<env>/env.yml` の `apps:` に新規 app_id が無ければ、表示された断片を人が貼る）
4〜7. selfhost と同じ（KB → test → tag → CHANGELOG）

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
| `DIFY_CONSOLE_TOKEN` | Cloud のトークン認証（§0 の取り方）。set なら `release.py`／`cloud_deploy.py` が自動でこれを使う。値はログに出ない |
| `DIFY_CONSOLE_URL` | Console API の基点（未設定なら env.yml の `dify.console_url`。`cloud-master` は `https://cloud.dify.ai`） |
| `DIFY_CONSOLE_EMAIL` / `DIFY_CONSOLE_PASSWORD` | Console ログイン（selfhost のみ。**cloud では使わない**。値はログに出ない） |

### `--dry-run` を必ず先に

`--dry-run` は render・ガード・（cloud なら）`IMPORT.md` 生成までは実際に行い、その先（selfhost の login/import/publish・cloud の Console API 自動インポート・KB 投入・テスト・tag・CHANGELOG）は**実行予定のコマンドを表示するだけ**でネットワークを一切呼ばない。`DIFY_CONSOLE_TOKEN` が set の状態でも `--dry-run` は Console API を呼ばない。まず `--dry-run` で render 結果（`dify/build/<env>/render-report.md`）とガードの警告を確認してから本番実行する。

### `console_api.py` について

`scripts/dify/console_api.py` は Console API の共通クライアント（`login` / `import_dsl` / `list_apps` / `publish` / `confirm_import` / `get_draft` / `update_draft`）を 1 ファイルに閉じ込めている。**selfhost は email/password ログイン、Cloud は `DIFY_CONSOLE_TOKEN` によるトークン認証**（`client_from_env()`）。**エンドポイントの形は実機で一部未確認**（設計書 `docs/handoff/2026-09-08-cloud-console-deploy.md` §1-2 の確認要 C1〜C9）。エラーが出たら、このファイルだけを直せばよい形にしてある。

## 6. Cloud での修正を Git に戻す（`sync_back.py`）

**マスタは Git、Cloud は編集場所。** Dify Cloud の画面でプロンプトやノードを直したら、そのままにせず必ず Git のマスタに戻す。
戻していない変更は、社内・顧客環境へのリリース（§5）に一切反映されない。

```bash
# 1) Chrome：対象アプリ → 右上「…」→「DSL をエクスポート」→ ~/Downloads に落ちる
# 2) 正規化してマスタへ書き戻す（ネットワークは呼ばない）
python3 scripts/dify/sync_back.py ~/Downloads/KN-01*.yml --env cloud-master
#    まず中身だけ見たいとき
python3 scripts/dify/sync_back.py ~/Downloads/KN-01*.yml --dry-run
# 3) 検証（DIFY_DATASET_ID_* を source していない素の shell で。
#    export された shell だと knowledge.*.id が焼き込まれ、[DIFF] になる。§5・env/README.md）
python3 dify/check.py
python3 scripts/dify/render.py --env cloud-master --all --check     # 12 本すべて [OK] マスタとバイト一致
# 4) 差分を読んで PR（プロンプト差分は必ず人が読む）
git switch -c feat/<issue>-sync-back-KN-01 && git add dify/apps && git commit
```

`sync_back.py` が自動で戻すもの：`dataset_ids` → `[]`（環境固有 id をマスタに入れない）／`dependencies` → `[]`／`version` → `0.6.0`／
ブランド語彙の逆置換（`cloud-master` は対象なし）。**モデルは戻さない**：Cloud で人がモデルを変えていた場合は exit 1 で止まるので、
`dify/env/cloud-master/env.yml` を直すか、Cloud 側を DSL の指定に戻すかを**人が決める**（`CLAUDE.md` §2-12）。

**他環境（`inhouse` / `customer-a`）からの逆流は非対応**（exit 2）。それらの DSL には KB id・顧客ブランド語・環境固有モデルが
焼き込まれていて、逆写像が一意にならないため。**別のセルフホストへ展開するときも、エクスポートしたファイルを持ち込まない**。
Git のマスタから `python3 scripts/dify/release.py --env inhouse --all` で作る（env 差分は `render.py` が入れるもので、
ある環境の完成品を別環境に貼ると、その環境の値が混ざったままになる）。

不具合・詰まりは `KNOWN_ISSUES.md` に `DI-xxx` で残す（[`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md)。§4 末尾も参照）。

## 7. GitHub ホストランナーで KB 投入・テストを回す（`dify-ops.yml`。W1）

設計: `docs/handoff/2026-09-08-execution-split-and-runner.md`（W1 の節・§2「実行環境は 3 つある」）。
**Mac が要らない操作（O5 KB 投入・O6 テスト実行）は、GitHub の `workflow_dispatch` から回せる。**
Mac の前に座らずに `kb_upload.py` / `run_tests.py` を実行し、結果を PR として受け取れる。

### どの操作がどこで回せるか（§1-1 の再掲）

| ラベル | 実行場所 | 回せる操作 |
|---|---|---|
| `run:cloud` | クラウド（Claude Code on the web） | 設計・実装・レビュー・デモ・文書。ネットワークを使わない検証すべて |
| `run:runner` | GitHub ホストランナー（`workflow_dispatch` → `dify-ops.yml`） | O5 KB 投入（`kb_upload.py`）・O6 テスト実行（`run_tests.py`）。Environment `dify-cloud-master` の承認が要る |
| `run:mac` | PM の Mac（ブラウザのログイン済みセッションが要る） | O1〜O4・O7・O8・O10（DSL の投入・上書き・公開・KB 紐づけ・API キー発行・DSL エクスポート・モデル設定の確認） |

**`run:*` は Issue・PR に必ず 1 つ付ける。** 判定基準は `docs/handoff/2026-09-08-execution-split-and-runner.md` §1-1 の操作表（O1〜O10）。

### 実行のしかた（PM）

1. GitHub の Actions タブ → `dify-ops` ワークフロー → **Run workflow**
2. 入力
   - `op`：`kb_upload`（KB 投入のみ）／`run_tests`（テスト実行のみ）／`both`（両方）
   - `codes`：管理番号を空白区切り（例 `KN-01 DC-01`）。`^[A-Z]{2}-[0-9]{2}( [A-Z]{2}-[0-9]{2})*$` に一致しない値は検証ステップで即失敗する
   - `env`：`cloud-master`（当面これだけ）
3. Environment `dify-cloud-master` に **required reviewers** が設定されていれば、ここでジョブが一時停止し、承認待ちになる。**PM が承認するまでキーには一切触れない**
4. 承認後、ジョブが `kb_upload.py` / `run_tests.py` を実行する。結果は
   - Job Summary（合否の要約。値は出さない）
   - `dify/results/<env>/<番号>-<YYYYMMDD-HHMM>.md`（テスト実行時のみ生成）を **`bot/dify-ops-<run_id>` ブランチに push → 自動で PR 作成**
5. **PR のマージは人が行う**（`main` への直 push はしない。CLAUDE.md §5）。中身を読んでから squash マージする

### 変更パスガード（load-bearing）

push の直前に、ステージされたファイルがすべて次のどちらかに一致するかを機械で検査する。1 つでも外れたら **push せずにジョブを失敗させる**。

```
^dify/results/[^/]+/[^/]+\.md$
^dify/state/[^/]+\.yml$
```

`dify/state/` は W2 で導入予定（いまは生成されない）。**実機側の自動 PR が `docs/service-map.md`・`mock/**`・`dify/apps/**` などを書き換えて紛れ込ませることを構造的に防ぐ**（#121 の「生成物の二重生成」対策）。

### 秘密の扱い

- キーは **Environment secret `dify-cloud-master`**（`DIFY_DATASET_KEY`・`DIFY_APP_KEY_<番号>` 12 本）に置く。**PM が GitHub の UI で登録する**（このワークフローはキーの値に一切触れない）
- ワークフローはキーの**値**をログに出さない（`set -x` 不使用、`env` / `printenv` 不使用）。「設定されているか」だけを確認する
- `run_tests.py` のエラー出力にはキーは含まれない（API のエラー本文だけ。実装を確認済み）
- 失敗しても Dify 側に副作用は無い（`kb_upload.py` は冪等・同名文書スキップ、`run_tests.py` は読み取りのみ）

### 実機の到達性（A1）はまだ確認していない

設計書の A1（`run_tests.py --env cloud-master KN-01` を実際に 1 本流し、Cloudflare 1010 も 401 も出ないことを確認する）は、
**Environment secret の登録が PM の作業待ちのため、この PR の時点では未実施**。ワークフローは作成済みだが、
**PM が secret と Environment の承認者を設定したあとに、初回実行として A1 を行う**。到達できなければ DI として起票する。

### ラベル規約（3 分類）

Issue・PR には次の 3 分類のいずれか **1 つだけ**を `run:*` ラベルとして付ける（判定は §1-1 の操作表）。

| ラベル | 意味 |
|---|---|
| `run:cloud` | クラウドだけで完結する（O1〜O10 をどれも含まない） |
| `run:runner` | (b)(c) だけが要る（O5・O6）。ホストランナーで回せる |
| `run:mac` | (a) ブラウザのログイン済みセッションが要る（O1〜O4・O7・O8・O10 のいずれか） |

**`run:mac` の Issue は必ず「Mac が要る操作」を本文に O1〜O10 の番号で列挙する。** 列挙できないなら `run:mac` ではない。
2 つ付くのは Issue を分割する合図。

### PM が GitHub の UI で設定すること（ワークフローでは設定できない）

- Settings → Environments → `dify-cloud-master` を作成 → **Required reviewers** に PM を追加 → **Deployment branches** を `main` のみに制限
- Settings → Environments → `dify-cloud-master` → Secrets に `DIFY_DATASET_KEY`・`DIFY_APP_KEY_<番号>`（12 本）を登録
- 任意：Settings → Environments → `dify-cloud-master` → Variables に `DIFY_BASE_URL`（秘密ではない。既定 `https://api.dify.ai/v1`）
- Settings → Actions → General → Fork pull request workflows from outside collaborators → **Require approval for all outside collaborators**
- ラベル `run:cloud` / `run:runner` / `run:mac` を Issues → Labels で作成（無くてもワークフローは動くが、PR への自動付与ができない）

