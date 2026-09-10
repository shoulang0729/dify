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
4. 右上「公開」→「公開する」。**`dataset_ids` を焼き込んだ build 版（`dify/build/<env>/*.yml`。§1 冒頭・§5）をインポートした場合は、UI での KB 紐づけ（②）が起きないため Rerank も自動 ON にならず、公開チェックリストが「Rerank モデル は必須です」で止まることがある（KB 付き 4 本＝KN-01・KN-02・KN-03・GN-01。DI-033）。**その場合は暫定として、公開前に「知識検索」ノードの検索設定を開き、**Rerank モデルを 1 つ手で選んでから**公開し直す（案 D は 2026-09-09 に PM が採用を決定済み。**適用＝#195 PR-2 マージ後**はマスタ DSL 側に明示されるため、この手作業は不要になる）
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
- **新規 KB 作成時は Rerank を無効化**（`retrieval_model.reranking_enable: false` を送信）。これは **dataset（KB）単位の既定検索設定**であり、DI-005 が観測した「OpenRouter 経由の Cohere Rerank が 429 を返した」件（ノード側とは層が違う。#195 §1 Q1・§2）と混同しないこと。`POST /datasets` がこの項目を受け付けない版では、警告を出して従来どおり作成するので、その場合は Chrome で **ナレッジ → 該当 KB → 検索設定 → Rerank を OFF** にする。既存 KB を再利用する経路では設定を変更しないので、既存 KB は必ず画面で確認する
- **KB を紐づけたら、その場で「知識検索」ノードの検索設定を開いて確認する**。Rerank が勝手に ON になり
  Rerank モデル（`openrouter / cohere/rerank-4-pro` など）が入っていることがある（DI-012）。**2026-09-08 PM 決定（案 c）**でこれを許容していたが、W4-2（`dataset_ids` 焼き込み build 版）でその前提が崩れ、**2026-09-09 に PM が案 D（マスタ DSL・`cloud-master` env に Rerank を明示）の採用を決定**（`docs/handoff/2026-09-09-rerank-decision.md` §3・§4、#195 §11 P-1）。**適用は #195 PR-2 でこれから**（本節時点のマスタ DSL は `reranking_enable: false` のまま）。入っていたらそのまま進めてよい

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
- 結果は `dify/results/<管理番号>-<YYYYMMDD-HHMM>.md`（入力／出力／期待語の一致／禁止語／応答言語／所要秒／トークン／判定の表＋出力全文）
- 結果の表には**所要秒とトークン数**が入る（`message_end` / `workflow_finished` の usage 由来。取れないときは `—`）
- 結果の表には**応答言語**の列も入る（`expect_lang` に対する `scripts/dify/lang_check.py` の判定。値は `OK` / `NG: …` / `—`。
  設計: `docs/handoff/2026-09-08-response-language-contract.md` §4。判定は `judge()`（期待語・禁止語）とは独立で、
  地の文の言語が壊れているだけでも判定は FAIL になる）
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
3. どちらの場合も **再インポート後に「公開」**し、KN-01 系は**知識検索ノードの KB 紐づけをやり直す**（`dataset_ids` は空で入るため）。**`dataset_ids` を焼き込んだ build 版（§1 冒頭・§5）を再インポートした場合は KB 紐づけが自動で保持されるぶん、KB 紐づけ操作が起きず Rerank も自動 ON にならないため、公開時に「Rerank モデル は必須です」で止まることがある（DI-033。①4 と同じ現象）。**その場合は公開前に検索設定で Rerank モデルを 1 つ手で選ぶ
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
- 公開が「Rerank モデル は必須です」で止まったとき（`dataset_ids` を焼き込んだ build 版。DI-033）：「公開できないので『知識検索』ノードを開き、検索設定で Rerank モデルを 1 つ選んで保存してから、もう一度公開して」

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

### 承認ゲート（Required reviewers）は現在オフ（2026-09-09 の PM 判断・#121）

`dify-ops.yml` は `op` ごとに 3 つのジョブのどれか 1 つだけを走らせる。**Environment
`dify-cloud-master` の Required reviewers はいま外してあり、`probe` / `run_tests` / `kb_upload` /
`kb_refresh` / `kb_replace` / `both` の**どの `op` も承認クリックを待たずに実行される**。

**理由**：`run_tests` と `probe` の承認クリックが開発の往復（DI-007〜DI-022 の「直す → 再テスト」
の反復）を止めており、その頻度に対して人間のゲートが割に合わなかった。

**代わりに、KB を壊す事故はコード側の歯止めで防いでいる**（`kb_upload.py` 側。設計書
`docs/handoff/2026-09-08-cloud-auth-and-w4.md` §4-2）：

- `kb_replace` は `confirm` に管理番号そのものを打たないと通らない（Validate inputs、K6）
- 削除できる文書数の上限は 5（`MAX_DELETE`）。超えたら 1 件も削除せず exit 1（K2）
- 削除対象は `dify/kb/<番号>/` に実在するファイル名と完全一致する文書だけ（K1）
- `tools/verify.mjs` §15 が、削除系 API を呼ぶ関数を `kb_upload.py` の `delete_document()` 1 つに
  限定していることを機械で検査する（K8）

| op | 走るジョブ | `environment`（宣言） | 承認待ち |
|---|---|---|---|
| `probe` | `probe` | 無し | **無し**（そもそも environment を宣言していない） |
| `run_tests` | `tests` | `dify-cloud-master`（secrets 読み取り用に宣言。承認は発生しない） | **無し** |
| `kb_upload` / `kb_refresh` / `kb_replace` / `both` | `kb` | `dify-cloud-master` | **無し**（Required reviewers を外したため。ゲートを戻せば復活する） |

**`both` は `kb_upload` と `run_tests` の両方を行うため `kb` ジョブで実行する**（KB を書き換えるため。
`environment` を分ける構造自体は維持しているので、後述のとおりゲートを戻すこともできる）。

**ゲートを戻す場合**：Settings → Environments → `dify-cloud-master` → Required reviewers を
再度有効にすれば、`tests` と `kb` の両方に承認が復活する（`environment:` を宣言しているため）。
`probe` は environment を持たないので影響を受けない。**`kb` だけに戻したい場合**は、`kb` 専用の
Environment（例：`dify-cloud-master-kb`）を別に作り、`DIFY_DATASET_KEY` と `DIFY_APP_KEY_*` を
そちらへ移し、`kb` ジョブの `environment:` をそちらに向ける（`tests` は元の環境のまま残せる）。

### どの操作がどこで回せるか（§1-1 の再掲）

| ラベル | 実行場所 | 回せる操作 |
|---|---|---|
| `run:cloud` | クラウド（Claude Code on the web） | 設計・実装・レビュー・デモ・文書。ネットワークを使わない検証すべて |
| `run:runner` | GitHub ホストランナー（`workflow_dispatch` → `dify-ops.yml`） | O5 KB 投入（`kb_upload.py`）・O6 テスト実行（`run_tests.py`）。**承認ゲートは現在オフ**（上記参照。ゲートを戻せば Environment `dify-cloud-master` の承認が要る） |
| `run:mac` | PM の Mac（ブラウザのログイン済みセッションが要る） | O1〜O4・O7・O8・O10（DSL の投入・上書き・公開・KB 紐づけ・API キー発行・DSL エクスポート・モデル設定の確認） |

**`run:*` は Issue・PR に必ず 1 つ付ける。** 判定基準は `docs/handoff/2026-09-08-execution-split-and-runner.md` §1-1 の操作表（O1〜O10）。

### 実行のしかた（PM）

1. GitHub の Actions タブ → `dify-ops` ワークフロー → **Run workflow**
2. 入力
   - `op`：`kb_upload`（KB 投入のみ・同名文書はスキップ）／`kb_refresh`（同名文書の中身だけ差し替え）／`kb_replace`（同名文書を削除して入れ直す）／`run_tests`（テスト実行のみ）／`both`（`kb_upload` ＋ `run_tests`）／`probe`（秘密を使わない Dify Cloud への到達性確認。§下記）
   - `codes`：管理番号を空白区切り（例 `KN-01 DC-01`）。`^[A-Z]{2}-[0-9]{2}( [A-Z]{2}-[0-9]{2})*$` に一致しない値は検証ステップで即失敗する。**`kb_replace` は削除を伴うため 1 件のみ**（2 件以上を指定すると Validate inputs で即 exit 1）。**`probe` では不要**（空欄のままでよい。検証もスキップされる）
   - `confirm`：**`kb_replace` のときだけ必須**。`codes` と完全に同じ文字列（対象の管理番号そのもの）を入力する。空欄・値違いは Validate inputs で即 exit 1（他の `op` では未使用。空欄のままでよい）
   - `env`：`cloud-master`（当面これだけ）
3. **どの `op` も承認待ちにならず即座に実行される**（Required reviewers を外してあるため。上記参照）。ゲートを戻した場合は `run_tests` / `kb_upload` / `kb_refresh` / `kb_replace` / `both` で一時停止し、承認待ちになる（`probe` だけは environment を宣言していないので影響を受けない）
4. ジョブが `kb_upload.py` / `run_tests.py` を実行する。結果は
   - Job Summary（合否の要約。値は出さない。`kb_refresh` / `kb_replace` は文書ごとの出力〔`kb_upload.py` の標準出力。id はマスク済み〕も折りたたみ表示で残る）
   - `dify/results/<env>/<番号>-<YYYYMMDD-HHMM>.md`（テスト実行時のみ生成）を **`bot/dify-ops-<run_id>` ブランチに push → 自動で PR 作成**
5. **PR のマージは人が行う**（`main` への直 push はしない。CLAUDE.md §5）。中身を読んでから squash マージする

### `kb_refresh` / `kb_replace` —— KB の文書を入れ替える（W4-1。#121）

設計: `docs/handoff/2026-09-08-cloud-auth-and-w4.md` §4-2（歯止め K1〜K8）・§4-3（壊れたときの復旧）。
実体は `scripts/dify/kb_upload.py --refresh` / `--replace`（詳しい挙動は `python3 scripts/dify/kb_upload.py --help`）。

- **どちらを先に試すべきか：`kb_refresh` が第一候補。** 同名文書の中身だけを差し替え、**一度も削除しない**（`PATCH`、404/405 なら `update-by-text` にフォールバック）ので、失敗しても既存の文書がそのまま残る＝失うものが無い。`kb_replace` は同名文書を **削除してから** 入れ直すので、一時的に KB から消える窓ができる
- **`kb_replace` の制約**：
  - **`codes` は 1 件のみ**（`kb_refresh` は複数可。削除しないので危険度が低いため）。CI（`dify-ops.yml`）は `op: kb_upload` から `--replace` を呼べない構造にしてある（歯止め K6）
  - **`confirm` に対象の管理番号と完全一致する文字列を要求する**。`op` の選択肢を選んだだけでは走らない二重確認。誤って別の番号を打つと一致せず止まるので、コピペミスでの誤爆も同時に防げる
  - 削除できる文書数の上限は 5（`MAX_DELETE`。K2）・削除は 1 文書ずつ「削除 → 直後に再投入」（K3）・削除対象は `dify/kb/<番号>/` に実在するファイル名と完全一致する文書だけ（K1）・KB そのものの削除（`DELETE /datasets/{id}`）は実装されていない（K4）
- **`kb_refresh` が 404/405 で失敗したら `kb_replace` に切り替える。** 1.17.0 に更新 API（`PATCH …/documents/{id}` または `update-by-text`）が実在するかは未確認（設計書 §11 V3）。`kb_refresh` の初回実行がそのまま実機確認を兼ねる
- **壊れたときの復旧**（設計書 §4-3）：

  | 失敗 | 起きること | 復旧 |
  |---|---|---|
  | `kb_refresh` が 4xx で失敗 | 文書は元のまま。何も失われない | `op: kb_upload`（フラグ無し）で再実行すれば従来どおり |
  | `kb_replace` で削除後にアップロードが失敗 | **その 1 文書だけ KB から欠ける** | **`op: kb_upload`（フラグ無し）で同じ番号を再実行**すれば、同名文書が無いので再投入される。**正本は `dify/kb/<番号>/`（Git）なので内容は失われない** |
  | インデックス中で削除できない | 4xx で停止。KB は無傷 | 数分待って再実行 |
  | ナレッジ API キーが失効 | 401 で停止。KB は無傷 | PM が画面で再発行 → Environment secret `DIFY_DATASET_KEY` を更新 |

### `probe` —— 秘密を使わない Dify Cloud への到達性確認（W4-3 の前提確認。#121）

設計: `docs/handoff/2026-09-08-cloud-auth-and-w4.md` §10・§11「W4-3」（受け入れ条件 V5）。

**何のためか**：W4-3（Cloud のコンソール認証を CI から使えるようにする）を作り込む前に、
**GitHub ホストランナーから `cloud.dify.ai` の前段（Cloudflare）を通過できるか**だけを確かめる。
`api.dify.ai`（Service API）では Cloudflare が独自でない User-Agent を弾いた前例（DI-004）があり、
コンソール側（`cloud.dify.ai`）で同じことが起きないかを、**認証を試みる前に**見ておく。

- **秘密を一切使わない**（`secrets.*` を参照しない）。**認証が通る必要は無い**。見たいのは前段だけ
- `codes` は不要（空欄のままでよい。Validate inputs で検証がスキップされる）
- `GET https://cloud.dify.ai/console/api/setup` を 1 回叩くだけ。**`POST`/`PUT`/`DELETE` は送らない**ので Dify 側に副作用は無い
- User-Agent は `console_api.py` / `kb_upload.py` / `run_tests.py` と同じ `dify-scripts/1.0 (+https://github.com/shoulang0729/dify)`
- 判定（設計書 §10）：
  - **200 / 401 / 403（本文に Cloudflare のシグネチャ `error code: 1010` を含まない）** → 成功。「前段は通っている。Cookie 案（W4-3）は成立しうる」と Job Summary に出す
  - **403 かつ本文に `error code: 1010`** → **Cloudflare に弾かれている**。User-Agent を変えて 1 回だけ再試行し、それでも解消しなければ失敗（**W4-3 は保留**とし DI を起票する）
  - それ以外（接続失敗・想定外の HTTP status）→ 区別できるメッセージを Job Summary に出す
  - **照合は `error code: 1010`（大文字小文字・コロン前後の空白ゆれのみ許容）に絞っている。** 単純な `1010` の部分一致だと、`request_id` や件数に偶然その数字が入るだけの無関係な 403 まで「Cloudflare に弾かれた」と誤判定するため（reviewer 指摘）。**ただし** Cloudflare がブロック本文の文言を変えた場合（コロン無し表記・見出しのみ・HTML タグが挟まる表記など）は逆に**見逃して「成功」と誤判定しうる**。V5 の一次判定として使い、疑わしい結果が出たら本文を目視で確認すること
- **本文を目視で確認する場所**：**Job Summary**（Actions の実行結果画面）に、判定結果（成功／失敗／判定不能）とは別に、**1 回目（再試行したときは 2 回目も）の応答本文**が `<details>` で折りたたまれて残る（見出しに使った User-Agent と HTTP status も併記）。長い本文は先頭 2000 文字に切り詰め、切ったことが見出しに表示される。**`GET /console/api/setup` は認証情報を送らない公開エンドポイントで `probe` は秘密を一切使わないため、本文はそのまま出している**（このステップに将来認証を足す場合はこの前提を見直すこと）
- **Environment `dify-cloud-master` の承認ゲートは付かない**（#121。PM 決定）。秘密を一切使わず、Dify に副作用も無い読み取り専用の疎通確認のため、ゲートを通す安全上の意味が無い。実行記録は Actions のログにそのまま残る

### 変更パスガード（load-bearing）

push の直前に、ステージされたファイルがすべて次のどちらかに一致するかを機械で検査する。1 つでも外れたら **push せずにジョブを失敗させる**。

```
^dify/results/[^/]+/[^/]+\.md$
^dify/state/[^/]+\.yml$
```

`dify/state/` は W2 で導入予定（いまは生成されない）。**実機側の自動 PR が `docs/service-map.md`・`mock/**`・`dify/apps/**` などを書き換えて紛れ込ませることを構造的に防ぐ**（#121 の「生成物の二重生成」対策）。

### 秘密の扱い（#121。案 B＝ゲート自体を外す。鍵の置き場は変えていない）

`tests` ジョブ（`op: run_tests`）にも `kb` ジョブと同じ `environment: dify-cloud-master` を
宣言している。**Required reviewers を外してあるので承認は発生しないが、Environment secret は
そのまま読める。** そのため `DIFY_APP_KEY_<番号>`（12 本）を Repository secret に複製する必要は
無い（12 個のコピーは PM の負担が大きく、案 A として検討したが不採用）。

- `DIFY_DATASET_KEY`：**Environment secret `dify-cloud-master`** のまま。`kb` ジョブだけが読む（`tests` ジョブの env: には列挙していない）
- `DIFY_APP_KEY_<番号>`（12 本）：**Environment secret `dify-cloud-master`** のまま。`tests` ジョブと `kb` ジョブの両方が読む（どちらも同じ environment を宣言しているため）
- `DIFY_BASE_URL`（秘密ではない）：Environment variable のまま。`tests` ジョブも同じ environment を宣言しているのでそのまま読める（複製不要）
- ワークフローはキーの**値**をログに出さない（`set -x` 不使用、`env` / `printenv` 不使用）。「設定されているか」だけを確認する
- `run_tests.py` のエラー出力にはキーは含まれない（API のエラー本文だけ。実装を確認済み）
- 失敗しても Dify 側に副作用は無い（`kb_upload.py` は冪等・同名文書スキップ、`run_tests.py` は読み取りのみ）

**移行手順**：PM が Settings → Environments → `dify-cloud-master` → **Required reviewers のチェックを
外す**（1 回）。鍵の登録・複製は不要。この操作をする**前**に `tests` / `kb` を実行しても、
Environment 自体は既に存在し secrets/vars は変わらず読めるため壊れない。単に承認待ちが残るだけ。

### 実機の到達性（A1）はまだ確認していない

設計書の A1（`run_tests.py --env cloud-master KN-01` を実際に 1 本流し、Cloudflare 1010 も 401 も出ないことを確認する）は、
**Environment secret の登録が PM の作業待ちのため、この PR の時点では未実施**。ワークフローは作成済みだが、
**PM が secret を登録したあとに、初回実行として A1 を行う**（承認ゲートは現在オフのため、登録さえ済めば承認待ちは発生しない）。到達できなければ DI として起票する。

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

- Settings → Environments → `dify-cloud-master` を作成 → **Deployment branches** を `main` のみに制限
- **Settings → Environments → `dify-cloud-master` → Required reviewers のチェックを外す**（2026-09-09 の PM 判断・案 B。#121。`tests` と `kb` が承認待ちにならなくなる。`probe` はそもそも environment を宣言していないので無関係）
- Settings → Environments → `dify-cloud-master` → Secrets に `DIFY_DATASET_KEY`・`DIFY_APP_KEY_<番号>`（12 本）を登録（**#121 で Repository secret への複製は不要になった**。`tests` ジョブも同じ Environment secret をそのまま読む）
- 任意：Settings → Environments → `dify-cloud-master` → Variables に `DIFY_BASE_URL`（秘密ではない。既定 `https://api.dify.ai/v1`）
- Settings → Actions → General → Fork pull request workflows from outside collaborators → **Require approval for all outside collaborators**
- ラベル `run:cloud` / `run:runner` / `run:mac` を Issues → Labels で作成（無くてもワークフローは動くが、PR への自動付与ができない）

## 8. Cloud のコンソール認証（リフレッシュトークン）の取り方

設計: `docs/handoff/2026-09-08-cloud-auth-and-w4.md` §8（Cookie 案の詳細設計）・§8-6（取り出す手順）・
§8-4（切れたときの終了コード表）。実装: `scripts/dify/console_api.py`（Issue #121 W4-3 PR-4）。

**保存するのはリフレッシュトークン 1 個だけ**（Environment secret `DIFY_CONSOLE_REFRESH`）。`console_api.py`
がジョブの冒頭で `POST /console/api/refresh-token` を叩いて、そのジョブだけで使う
アクセストークン・CSRF トークンをその場で取得する。**「1 回置けば 30 日もつ」ではない**——
リフレッシュトークンは 1 回使うと無効化される（rotate）ため、**投入する回ごとに取り直す**運用になる
（§8-3）。

### 取り方（ブラウザの開発者ツール。PM が 1 人で完結）

**値は画面にもチャットにも出さず、GitHub の Environment secret 入力欄に直接貼ること。**
ターミナルの履歴にも残さない（`CLAUDE.md` §2-10）。

1. Chrome 等で Dify Cloud（`https://cloud.dify.ai`）にログイン済みのタブを開く
2. 開発者ツール（⌥⌘I）→ **Application** タブ → 左の **Cookies** → `https://cloud.dify.ai`
3. **`__Host-refresh_token` の Value を右クリック → コピー**（画面に出したまま共有しない。スクリーンショットを撮らない）
4. GitHub → リポジトリの **Settings → Environments → `dify-cloud-master` → Secrets** →
   `DIFY_CONSOLE_REFRESH` を **Update**（無ければ **Add secret**）で直接貼る
5. **そのブラウザではログアウトしない**（`logout` はサーバ側のリフレッシュトークンを無効化するので、
   貼ったばかりの secret も同時に死ぬ）

ローカルで動かす場合（Mac・ホストランナーの手元確認など）は `~/.config/dify/<env>.env` の
`DIFY_CONSOLE_REFRESH=` に同じ値を貼る（`scripts/dify/env.example` 参照。**リポジトリの中には置かない**）。

### 切れたときにどうなるか（§8-4 の再掲。値は一切出さない）

| 事象 | 終了コード | 対応 |
|---|---|---|
| `POST /refresh-token` が 401（期限切れ・既に使用済み） | 3 | 上の手順でもう一度取り直し、`DIFY_CONSOLE_REFRESH` を更新する |
| refresh は 200、その後の API が 401（CSRF 不一致） | 3 | 実装の不具合として `console_api.py` を確認・報告する（取り直しでは直らない） |
| その後の API が 403 かつ本文に `error code: 1010`（Cloudflare） | 4 | User-Agent の付与を確認する（`CONSOLE_USER_AGENT`。DI-004） |
| ジョブ途中で 401（アクセストークンが 60 分を超えた） | — | `console_api.py` がメモリ上の最新のリフレッシュトークンで自動的に 1 回だけ再取得して続行する（人の操作は不要） |
| `DIFY_CONSOLE_REFRESH` が未設定 | 2 | 上の手順で取得し、Environment secret に登録する |

### 異変時の即時失効手順

1. Dify のブラウザで**ログアウト**する（当該リフレッシュトークンとその系列は即座に無効化される）
2. GitHub の Environment secret `DIFY_CONSOLE_REFRESH` を削除する（次の実行で exit 2 になり、事故的な再利用を防ぐ）
3. 必要なら上の手順で新しいリフレッシュトークンを取り直して貼り直す

### 非推奨：`DIFY_CONSOLE_TOKEN`

旧来のトークン認証（`console_token`）は Dify Cloud `1.17.0` に存在しないため Cloud には使えない
（Issue #114 N1）。`client_from_env()` は互換のため読み込むが、**新規は使わないこと**。
セルフホストは引き続き `DIFY_CONSOLE_EMAIL` / `DIFY_CONSOLE_PASSWORD` でログインする（§0・§1）。

## 9. Dify Cloud への投入・公開を自動化する（`op: deploy`。W4-4。#121）

設計: `docs/handoff/2026-09-08-cloud-auth-and-w4.md` §9-2（P1・復旧手順）・§9-3（入力検証・承認ゲート）・
§11「W4-4」（受け入れ条件）。実装: `.github/workflows/dify-ops.yml`（`deploy` ジョブ）・
`scripts/dify/cloud_deploy.py`（P1・B3 を実装）・`scripts/dify/console_api.py`（`logout()`）。

**これで Mac の「DSL の再インポート（12 本）＋ 公開」がホストランナーから回せるようになる**
（§6 の表の最後の行）。Cookie の取り方・切れたときの対応は §8（このファイル）を参照。

### 実行のしかた（PM）

1. GitHub の Actions タブ → `dify-ops` ワークフロー → **Run workflow**
2. 入力（**正確な文字列**）
   - `op`：**`deploy`**
   - `codes`：対象の管理番号を空白区切りで 1〜12 件（例 `KN-01 DC-01`。12 本まとめて流す場合は
     `dify/apps/` にある 12 本の管理番号をすべて空白区切りで列挙する。**13 件以上は Validate inputs で即
     exit 1**）
   - `confirm`：**固定文字列 `deploy`**（`codes` の値ではない。1〜12 件を毎回打ち直させるのは
     非現実的なため、`kb_replace` とは異なる方式にしてある。入力が `deploy` と完全一致しないと
     Validate inputs で即 exit 1）
   - `env`：`cloud-master`
3. 現状 Required reviewers は外れているため、承認待ちにならず即座に実行される（`kb` ジョブと同じ
   Environment。§7 参照。ゲートを戻した場合はここでも承認待ちになる）
4. ジョブが `scripts/dify/cloud_deploy.py --env <env> <codes>` を実行する。結果は Job Summary と
   Actions のログの両方に出る（**値〔Cookie／CSRF／リフレッシュトークン／app_id の完全な UUID〕は
   一切出ない**。`console_api._mask()` を必ず通す）
5. **このジョブは何も commit・push しない**（新規アプリを作った場合の `env.yml` 書き戻し候補は
   ログ・Job Summary に出るだけ。`dify/env/**` への自動書き込みは変更パスガードの対象外＝
   意図的に実装していない。反映は人が `git diff` を見てから行う）
6. 続けて `op: run_tests` で合否を確認することを推奨する（`op: deploy` 自体はテストを実行しない）

### 何をしているか（P1・B3。`cloud_deploy.py` 側で実装）

- **P1（設計書 §9-2）**：対象番号すべての **インポートが完了してから、まとめて公開**する。
  **1 本でもインポートに失敗したら、公開は 1 本も行わない**（成功していた番号も公開しない）。
  「半分だけ新しい」状態を作らないため
- **B3（設計書 §8-7）**：`DIFY_CONSOLE_REFRESH` で認証したセッションは、import・publish の
  成否によらず、ジョブの最後に必ず `POST /console/api/logout` を試みる（`console_api.ConsoleClient.logout()`）。
  **`DIFY_CONSOLE_TOKEN`（非推奨）・selfhost の email/password 認証では何もしない**
  （このセッション無効化は Cookie 案＝リフレッシュトークンのセッションに限った歯止めのため）。
  logout 自体が失敗しても deploy 全体の終了コードには影響しない（ログに残るだけ）
- インポートは **上書き**（`dify/env/cloud-master/env.yml` の `apps.<番号>.id` が `null` のときは
  名前一致で既存アプリを探して上書きし、無ければ新規作成。§2-2）。**新規作成は想定していない**
  （12 本は既に Mac から一度デプロイ済み）。名前が一致しない・複数一致する場合は `AmbiguousNameError`
  として失敗に記録される（他の番号の処理は続く）

### 終了コードとジョブの判定

| `cloud_deploy.py` の exit code | 意味 | ジョブの表示 |
|---|---|---|
| 0 | 全件成功（インポート＋公開） | 完了 |
| 1 | 1 件以上失敗（インポートまたは公開）。**P1 によりこの場合は公開を 1 件も行っていない可能性が高い**（インポート段階の失敗なら確実に 0 件） | 失敗あり |
| 2 | 引数・環境不備（`DIFY_CONSOLE_REFRESH` 等が未設定・env.yml が無い等）、**または KB 紐づけの安全弁に抵触**（下記「既知の制限」） | 設定不備 |
| 3 | 認証エラー（401/403）。即座に停止し、以降の番号は処理しない | 認証エラー |

### 壊れたときの復旧（設計書 §9-2）

**まず事実**：Dify の DSL インポートは下書き（draft workflow）を置き換えるだけで、**公開版は
`publish` するまで変わらない**。したがって **インポートが失敗しても、動いている公開版は壊れない**。
壊れうるのは「インポート成功・公開まで進んだが、公開後に問題が見つかった」場合だけ。

1. 症状を確認する（Studio でアプリを開き、下書きが壊れているか／公開版が動いているかを見る）
2. **公開版が動いているなら急がない**（デモは止まらない）
3. Git から再 render：`source ~/.config/dify/cloud-master.env && python3 scripts/dify/render.py --env cloud-master <番号>`
4. UI の「DSL をインポート → 上書きしてインポート」で `dify/build/cloud-master/<番号>-*.yml` を流す
   （**ダイアログの「現在の下書きをバックアップ」を押してから**）。または `op: deploy` を対象の番号
   だけで再実行する
5. 公開 → `op: run_tests` で合否を確認
6. **アプリ id と API キーは上書きインポートでは変わらない**ので、環境変数の入れ替えは不要

**復元用の情報は Git だけ**：インポート前の DSL をエクスポートして残す運用は**採っていない**
（暗号化された `dataset_ids` を含む DSL を公開リポジトリの artifact に残すことになるため）。
「どの版を投入したか」は PR 本文と `dify/CHANGELOG.md` に記録し、**復旧は Git から再 render →
再インポート**で行う。

### 既知の制限：KB を紐づけている番号（KN-01・KN-02・KN-03・GN-01）は `dataset_ids` が空のままだと `op: deploy` が上書きで紐づけを消しうる —— **ただし機械が止める**

`dify/apps/KN-01-*.yml` 等のマスタ DSL は **`dataset_ids: []`（空）のまま**コミットされている
（コメントに明記：「インポート後に UI で KB を紐づける」）。`dataset_ids` を焼き込む仕組み
（`render.py` R5・`cloud_deploy.py --bind-kb dsl`〔既定〕）は実装済みだが、**焼き込みには
`DIFY_DATASET_ID_KN01` 等の環境変数が要り、現時点でこれらは GitHub の secret として登録していない**
（`docs/handoff/2026-09-08-execution-split-and-runner.md` の方針：将来 `dify/state/cloud-master.yml`
〔W2。未実装〕から読む想定で、**それまでは置かない**）。**恒久対応（実行時に Datasets API から
id を引く）は architect が設計中**（Issue #121）。

**外し忘れても機械が止めます。** `cloud_deploy.py` に **KB 紐づけの安全弁**（`find_empty_kb_bindings()`。
モジュール docstring の「1.5 kb-guard」）を追加した：render 結果に `knowledge-retrieval` ノードを
持つのに `dataset_ids` が空のままの番号が `codes` に **1 本でも**含まれていたら、**Phase 1（インポート）
どころかセッション確立（`client_from_env`）より前に、実行全体を `exit 2` で停止する**（P1 と同じ
「1 本でも該当したら全体を止める」思想。`--force` のような回避フラグは意図的に用意していない）。
判定材料に「レンダ済み DSL の `knowledge-retrieval` ノードの `dataset_ids`」を選んだ理由は、
`dify/kb/<番号>/` ディレクトリの有無という運用上の慣習ではなく、**実際にアップロードする DSL
そのもの**を見るのがもっとも確実なため（`cloud_deploy.py` のコード内コメントに詳細）。

止まったときのメッセージ（実物。値は出ない）:

```
[STOP] KB を要求しているのに dataset_ids が空のままのアプリがあります。このまま上書きインポート・公開
すると、Dify 上で既に紐づいている知識ベースの紐づけが空にリセットされる可能性があります（PM 報告に
基づく追加の歯止め。Issue #121 W4-4）。

対象（管理番号: knowledge-retrieval ノード名）:
  - KN-02: 知識検索（設備マニュアル・アラームコード表・保全規程）

どうすればよいか（どちらか）:
  1. これらの番号を codes から外して再実行する（KB を持たないアプリだけを deploy する）
  2. DIFY_DATASET_ID_<番号>（例 DIFY_DATASET_ID_KN01）を設定して dataset_ids を焼き込んでから
     再実行する（dify/DEPLOY.md §1-④・§9「既知の制限」を参照）

恒久対応（実行時に Datasets API から id を引く）は architect が設計中です（Issue #121）。それが入る
まで --force のような回避フラグはありません。1 本でも該当したら実行全体を停止します（P1 と同じ思想。
半分だけ危険な状態で進めない）。
```

- KN-01 / KN-02 / KN-03 / GN-01 を再投入したい場合は、**引き続き Mac の手順**（§1-④・§5-4）を使う
  （`~/.config/dify/cloud-master.env` に `DIFY_DATASET_ID_*` を置いた上で render → インポート）か、
  同じ環境変数をホストランナーのジョブに渡して `op: deploy` を実行する（現時点では secret 未登録）
- `--dry-run` では警告のみ表示し、停止しない（プレビュー用途のため。「本番実行ではこのまま
  exit 2 で停止します」と併記される）
- 機械確認：`scripts/dify/tests/test_cloud_deploy.py` の `test_kb_guard_blocks_before_phase1` /
  `test_kb_guard_allows_when_dataset_ids_baked` / `test_kb_guard_unit_detects_empty_dataset_ids`

## 10. リフレッシュトークンの自動更新（rotate した新しい値をジョブが書き戻す）

設計: `docs/handoff/2026-09-09-refresh-token-writeback.md`（Issue #212）。

**この節は PR-1・PR-2・PR-3・PR-4 にわたって段階的に完成させる（設計書 §10 の分割案）。**
PR-1・PR-2・PR-3 で §10-1〜§10-4・§10-6 が入った。**§10-5（今すぐ無効化。`op: token_revoke`）は
PR-4 でまだ実装されていない**。

### §10-1 何が変わるか

**これまで**：`op: deploy` / `op: inspect` を回すたびに、ブラウザから `__Host-refresh_token` を取って
GitHub の secret に貼り直していた（§8）。

**これから**：**ジョブが自分で新しい値を書き戻す。** PM の手作業は **PAT を 1 回作るだけ**になる。

**注意（トレードオフ）**：この運用では、ジョブの後も Dify のセッションが**生きたまま**残る（従来は
毎回 `logout` して殺していた）。今すぐ無効化したいときは **§10-5** を使う（PR-4 で追加予定。
それまでの間は、異変時はブラウザでログアウト → `DIFY_CONSOLE_REFRESH` を手動で削除する）。

### §10-2 最初の 1 回：書き戻し用の PAT を作る（10 分）

**値を画面に出したまま共有しない。スクリーンショットを撮らない。チャットに貼らない**（`CLAUDE.md` §2-10）。

1. GitHub の右上のアバター → **Settings**（リポジトリの Settings ではなく**アカウントの** Settings）
2. 左メニューのいちばん下 **Developer settings**
3. **Personal access tokens** → **Fine-grained tokens**（classic ではない）
4. **Generate new token**
5. **Token name**：`dify-ops refresh writeback`
6. **Expiration**：**Custom** → **1 年後の日付**（最長 366 日）。※ **期限が切れたら、この §10-2 をもう一度やる。それが唯一の定期作業**
7. **Resource owner**：`shoulang0729`（自分のアカウント）
8. **Repository access**：**Only select repositories** → **`shoulang0729/dify` の 1 つだけ**を選ぶ
9. **Repository permissions**：**`Secrets`** を **Read and write** にする。**さらに同じ「Repository permissions」の一覧から `Environments` を探し、これも `Read and write` にする**（`Secrets` だけでは 403 になることを実測済み。V-A：2026-09-10、GitHub Actions run #13）。**それ以外は触らない**（`Metadata: Read-only` は自動で付く）
   - **すでに `Secrets: Read and write` だけで PAT を作ってしまった場合、作り直しは不要。** github.com の **Settings → Developer settings → Personal access tokens → Fine-grained tokens** で該当トークン（`dify-ops refresh writeback`）を開き、**`Environments` を `Read and write` に変更して `Update token`** すればよい（トークンの値は変わらない。secret の貼り直しも不要）
10. **Generate token** → 値が 1 度だけ表示される。**このページを離れると二度と表示されない**
11. **別のタブ**で：リポジトリ → **Settings** → **Environments** → **`dify-cloud-master`** → **Environment secrets** → **Add secret**
    - **Name**：`GH_SECRETS_PAT`（**綴りを間違えると書き戻しが動かない**）
    - **Secret**：手順 10 の値を貼る（手で打たない）
    - **Add secret**
12. PAT のタブに戻って閉じる。**クリップボードを別の文字列で上書きする**（適当な語をコピーする）

**動作確認（本物のリフレッシュトークンは 1 円も消費しない）**：Actions タブ → `dify-ops` →
**Run workflow** → `op`：**`token_selftest`** ／ `codes`：空のまま ／ `env`：`cloud-master`。
緑になり、Job Summary に「**成功。`GH_SECRETS_PAT` は Environment `dify-cloud-master` の secret を
書き換えられます。**」と出れば OK。**`Secrets: Read and write` だけでは足りないことは確認済み**
（V-A の答え。2026-09-10、run #13：`Secrets` のみの PAT で 3 回リトライしてすべて
`HTTP 403: Resource not accessible by personal access token`。エンドポイントは
`.../environments/dify-cloud-master/secrets/public-key` で、repository secret ではなく
**environment secret** の公開鍵取得が拒否されていた）。**上の手順 9 のとおり `Environments` も
`Read and write` にしてから実行すること。**

### §10-3 動作確認（1 回だけ・Dify には何も書き込まない）

1. Actions タブ → `dify-ops` → **Run workflow**
2. `op`：**`token_refresh`** ／ `codes`：空のまま ／ `env`：`cloud-master`
3. 緑になり、Job Summary に **`🔑 リフレッシュトークンを更新しました`** が出れば成功
4. **もう一度**同じ `op: token_refresh` を回す。**2 回目も緑になれば、書き戻しが本当に効いている**
   （従来なら 2 回目は必ず認証エラーだった）

赤くなったら Job Summary の **原因の切り分け表**を見る。

### §10-4 取り直し（書き戻しに失敗したとき・30 日以上回さなかったとき）

**推奨：Dify のふだん使いのタブとは別に、シークレット（プライベート）ウィンドウで取る。**
理由：リフレッシュトークンは**先に使ったほうが勝つ**。ふだん使いのタブと同じ値を CI に渡すと、
**タブを開いた瞬間に CI 側が死ぬ**（またはその逆でタブがログアウトする）。

1. **シークレットウィンドウ**で `https://cloud.dify.ai` を開き、**そこで新しくログイン**する
2. 開発者ツール（⌥⌘I）→ **Application** → **Cookies** → `https://cloud.dify.ai`
3. **`__Host-refresh_token` の Value** を右クリック → **Copy value**
4. GitHub → **Settings → Environments → `dify-cloud-master` → `DIFY_CONSOLE_REFRESH` → Update** に貼る
5. **シークレットウィンドウを、ログアウトせずにそのまま閉じる**（ログアウトすると貼った値も死ぬ）
6. §10-3 の動作確認を 1 回だけ回す

### §10-6 やってはいけないこと

- **`Cancel workflow` を押して `deploy` / `inspect` を途中で止める**：rotate 済み・書き戻し前だと、
  secret が死ぬ（書き戻しステップは `always()` なのでたいていは走るが、強制終了の猶予内に間に合わない
  可能性がある）。止めたいときは終わるまで待つ
- **同じリフレッシュトークンを Mac のローカル実行（`~/.config/dify/cloud-master.env`）と CI の両方に
  置く**：先に使ったほうが勝ち、もう一方が死ぬ。**ローカルで Console API を触るときは §10-4 の手順で
  別のセッションを取る**
- **PAT を repository secret に置く**：Environment のゲートが効かなくなる。必ず Environment
  `dify-cloud-master` の secret に置く

