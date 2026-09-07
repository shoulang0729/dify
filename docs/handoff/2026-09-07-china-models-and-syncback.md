# 中国で使えるモデル（Qwen / Kimi）への既定切替 と、Cloud で調整した DSL を Git に戻す仕組み、実装不具合の記録場所

- Issue: 未起票（本書 §13 の「Issue 案」を PM が起票）
- レーン: **M/L**（`dify/env/**` の既定モデル・マスタ DSL・新スクリプト・`CLAUDE.md` の load-bearing 追記提案に触る）
- 基準コミット: `87d3cc3`（main）
- 設計者: architect（実装しない）
- 関連: `docs/handoff/2026-09-07-repo-layout-v2.md`（#84。§3 env スキーマ・§4-1 R1〜R10・§4-3 render.py）／`CLAUDE.md` §2-10・§2-12・§2-13・§3・§5／Issue #82（Wave 1 KN-01・DC-01）／Issue #98（Wave 2 10 DSL）
- PM の言葉：「LLM は中国で使える LLM にして欲しい。個人的には Qwen と KIMI の新しいやつを使いたい」「（Cloud で調整した DSL は）エクスポートして Git に入れておけば良いのか」「実装のときに出た不具合も記録してくれるよね？」

---

## 0. 目的（何が困っていて、何が解決すれば終わりか）

| 困りごと | 解決の形（本設計の完了形） |
|---|---|
| 既定モデルが `langgenius/openai/openai` `gpt-4o-mini` のままで、**顧客（中国拠点）で到達できないモデル**が全 env とマスタ DSL に書かれている。`customer-a` だけ SiliconFlow だが、その型番（`Qwen/Qwen3-235B-A22B`・`Qwen/Qwen3-32B`）は現在のプラグイン定義に**無い** | **全 env の既定を SiliconFlow の Qwen3.5-397B-A17B（生成）と Kimi-K2.6（推論）**にし、マスタ DSL も同じ値に揃える。`render.py --env cloud-master --all --check` が **PASS（マスタとバイト一致）**のまま |
| Dify Cloud の画面で直したプロンプト・ノードが、**Git のマスタに戻る道が無い**（手順も道具も無い。`implementation-guide.md` §7-1-3 は「export し直したものを正とする」と書いているだけ） | `scripts/dify/sync_back.py` が **export した YAML → マスタ `dify/apps/<番号>-<slug>.yml`** を正規化して書き戻し、差分要約を出し、`render --check` が通ることを自分で確認する |
| 実装・投入・テストで出た不具合が、Issue コメント・PR 本文・`dify/results/` に散らばり、**同じ罠を次の Wave で踏む** | `dify/KNOWN_ISSUES.md` 1 枚に `DI-xxx` の連番で残す。DSL 修正 PR は本文で `DI-xxx` を参照する |

**非目標**：モデルの実機ベンチマーク（DP-04 の日本語品質評価は別 Issue）／`mock/**` の変更／Wave 2 の DSL 作成そのもの（#98）／export 方向の**自動**取得（Console API 経由。Issue #3 に残る。本設計の sync_back は「人が画面から落としたファイル」を入力にする）。

---

## 1. 前提として確認した事実

### 1-1. 利用可能なモデル（確認日・確認元）

**確認日 2026-09-07 / 確認元：`langgenius/dify-official-plugins` main ブランチの `models/<provider>/models/llm/_position.yaml`（PM が取得）**

| プラグイン | 版 | provider id | LLM（`_position.yaml` の並び順） | 埋め込み / リランク |
|---|---|---|---|---|
| `models/siliconflow` | 0.0.59 | `langgenius/siliconflow/siliconflow` | `Qwen/Qwen3.5-397B-A17B` / `Qwen/Qwen3.6-27B` / `Qwen/Qwen3.6-35B-A3B` / `Qwen/Qwen3-235B-A22B-Instruct-2507` / `Pro/moonshotai/Kimi-K2.6` / `Pro/moonshotai/Kimi-K2.5` / `moonshotai/Kimi-K2-Thinking` / `moonshotai/Kimi-K2-Instruct` | `BAAI/bge-m3` / `BAAI/bge-reranker-v2-m3` |
| `models/moonshot` | 0.1.12 | `langgenius/moonshot/moonshot` | `kimi-k3` / `kimi-k2.7-code` / `kimi-k2.6` / `kimi-k2.5` / `kimi-k2-thinking` | — |
| `models/tongyi` | 0.2.18 | `langgenius/tongyi/tongyi`（Alibaba Model Studio / DashScope） | `qwen3.8-max` / `qwen3.7-plus` / `qwen3.6-plus` / `qwen3-max` / `kimi-k2.5` | — |

SiliconFlow の資格情報 `use_international_endpoint` で **`api.siliconflow.cn`（既定）と `api.siliconflow.com`（国際版）** を切り替える。

> **重要（この注意書きを DEPLOY.md にも入れる）**：「プラグイン定義に載っている」＝「PM のアカウント／エンドポイントで実際に使える」ではない。**実機での可用性は未確認（確認要）**。初回の `/dify-deploy` で LLM ノードのモデル選択画面に該当モデルが出るかを確認し、出なければ**その場で止めて** `dify/KNOWN_ISSUES.md` に `DI-xxx` を起票する（§4）。

### 1-2. 現状の値（変更前）

| 場所 | chat | reasoning | embedding | rerank |
|---|---|---|---|---|
| `dify/env/cloud-master/env.yml` | `langgenius/openai/openai` `gpt-4o-mini` | 同左 | `''` | `''` |
| `dify/env/inhouse/env.yml` | `langgenius/openai/openai` `gpt-4o-mini` | 同左 | `langgenius/openai/openai` `text-embedding-3-small` | `''` |
| `dify/env/customer-a/env.yml` | `…/siliconflow` `Qwen/Qwen3-235B-A22B` | `…/siliconflow` `Qwen/Qwen3-32B` | `…/siliconflow` `BAAI/bge-m3` | `…/siliconflow` `BAAI/bge-reranker-v2-m3` |
| `dify/apps/KN-01-tech-knowledge-qa.yml` L175-180 | `langgenius/openai/openai` `gpt-4o-mini`（`mode: chat` / `temperature: 0.2`） | — | — | `reranking_model: {model:'', provider:''}`（L134-137） |
| `dify/apps/*.yml` L7（先頭コメント） | `# モデル   : openai / gpt-4o-mini を既定。…` の 1 行が 2 本ともある（**ここも直す**。先頭 `#` ブロックは render が `extract_header` でそのまま持ち回るのでバイト一致に影響しない） | — | — | — |
| `dify/apps/DC-01-hq-report-draft.yml` L157-162 | 同上 | — | — | — |

- マスタ 2 本の**ノード種別**は `start` / `knowledge-retrieval`(KN-01 のみ) / `llm` / `answer`・`end` だけ。**`question-classifier` も `parameter-extractor` も無い**（`grep "type: "` で確認）→ **R2・R4（`models.reasoning`）は現時点でマスタのバイトに影響しない**。reasoning の変更は Wave 2 以降で効く
- `customer-a` の `Qwen/Qwen3-235B-A22B` と `Qwen/Qwen3-32B` は §1-1 の一覧に**無い**（後継は `Qwen/Qwen3-235B-A22B-Instruct-2507`）。今回の切替はこの不整合の解消も兼ねる

### 1-3. `render.py` の仕様のうち、本設計が依存するところ（コードで確認）

| # | 事実 | 根拠（`scripts/dify/render.py`） |
|---|---|---|
| F1 | `llm` ノードの role は `override_map.get(nid, "chat")` → `models.get(role)`。**role 名は任意**。`models` 直下にキーを足せば `overrides` から参照できる（**render.py の変更は不要**） | L224-226 |
| F2 | ただし `override_map` が使われるのは **`llm` ノードだけ**。`question-classifier` / `parameter-extractor` は常に `models.reasoning` 固定でアプリ単位の差し替えができない | L217-250 |
| F3 | `--check` は「render 結果 `out_bytes` と**そのマスタ自身**を比較」。`rendered == data`（dict として等価）なら `out_bytes = raw_text` なので必ず一致。**つまり `--check` PASS ＝「マスタの model ブロックが env の値と等価」の機械証明**になる | L495-505 |
| F4 | `rendered != data` のときだけ `dump_with_header()` が走り、`yaml.safe_dump` で**全文を再シリアライズ**する | L394-405 |
| F5 | `models.overrides` の `node_title` に一致するノードが 0 個なら `--strict` で exit 1 | L206-213 |
| F6 | `build_replace_table` が **2 か所で定義**されている（L157 の 1 引数版と L363 の 2 引数版。**後者が有効**）。import して使うときは 2 引数版になる。掃除は本 Issue の範囲外 | L157 / L363 |

### 1-4. `tools/verify.mjs` §12 が env.yml に課している制約（コードで確認）

| # | 制約 | 本設計への影響 |
|---|---|---|
| V1 | `models` の必須キーは `chat` / `reasoning` / `embedding` / `rerank` の**存在検査のみ**。未知キーの禁止は無い | **`kimi` / `qwen_small` を足しても verify.mjs の変更は不要**（L570・L594-596） |
| V2 | `cloud-master/env.yml` に書いてよい生 URL は `https://api.dify.ai/v1` と `https://cloud.dify.ai` の **2 つだけ**。他 env は生 URL 一切禁止。判定は**コメント行も含めたファイル全文**が対象 | **`api.siliconflow.cn` / `.com` や docs の URL を env.yml に書いてはいけない（コメントにも）。** エンドポイントの説明は `dify/env/README.md` と `dify/DEPLOY.md` に書く |
| V3 | 32 文字以上の英数字連続を「秘密の直値の疑い」で FAIL | 今回入れるモデル名は最長でも `moonshotai`（10 字）で切れるため無害（`/` `.` `-` が区切りになる） |

### 1-5. `dify/apps/` を `render.py` の出力で置き換えると何が起きるか（実測）

`python3 -c "yaml.safe_dump(yaml.safe_load(KN-01))"` を実行した結果、**System プロンプトの block scalar（`text: |-`）が 1 行の二重引用符文字列（`text: "あなたは…\n役割：…\n…"`）に潰れる**ことを確認した（KN-01 全文が 6,573 バイトの再整形になる）。
`dify/README.md` の規約「System プロンプトは `docs/dify/usecases/<番号>.md` §5-1 を写す」と、PR で人がプロンプト差分を読む運用が壊れるため、**render 出力をそのままマスタにコピーする手順は採らない**（§2-3 案 B を採用）。

---

## 2. 章 A — LLM 既定を Qwen / Kimi（SiliconFlow）に切り替える

### 2-1. 決定（PM 決定。再検討しない）

| 項目 | 決定 | 理由 |
|---|---|---|
| 既定プロバイダ | **全 env で SiliconFlow**（`langgenius/siliconflow/siliconflow`） | 1 契約で Qwen と Kimi の両方。`customer-a` の既定と provider id が揃う。日本側は国際版エンドポイント、中国側は `.cn`（資格情報の `use_international_endpoint` で切替＝**DSL にも env にも出ない**）。DP-01 推奨 (a) と整合 |
| `models.chat`（R1 = `llm` ノード） | `Qwen/Qwen3.5-397B-A17B`（`mode: chat` / `completion_params.temperature: 0.2` は**維持**） | 一覧の先頭＝最新の主力。生成品質が要る本文はここ |
| `models.reasoning`（R2 分類器・パラメータ抽出／R4 単一検索の判定） | `Pro/moonshotai/Kimi-K2.6` | Qwen と Kimi の両方が常に使われる構成にする |
| 追加 role `kimi` | `Pro/moonshotai/Kimi-K2.6`（`mode: chat`） | アプリ単位で生成側を Kimi に振るとき、`models.overrides` の `role: kimi` で指定できる |
| 追加 role `qwen_small` | `Qwen/Qwen3.6-35B-A3B`（`mode: chat`） | 軽量・高速用（短文分類・整形など）。同上 |
| `models.embedding` | `cloud-master` は `''` のまま／`inhouse`・`customer-a` は `BAAI/bge-m3` | Cloud の KB は画面で作るため（既定に任せる）。**KB 作成時に SiliconFlow `BAAI/bge-m3` を選ぶ**ことを `dify/README.md`・`DEPLOY.md`・`env/README.md` に明記する |
| `models.rerank` | 現状維持（`cloud-master`・`inhouse` は `''`、`customer-a` は `BAAI/bge-reranker-v2-m3`） | `cloud-master` で有効化すると KN-01 の `reranking_enable` が `true` に変わり、マスタの中身が変わる。**判断は DP-40 として起票**（§2-5） |
| API キー | **env.yml にも DSL にも書かない**。Dify の「設定 → モデルプロバイダー」に人が入れる | `CLAUDE.md` §2-10。env に置くのは provider id と model name だけ（`dify/env/README.md` の表そのまま） |
| `docs/dify/templates/05-*.yml` ほか 8 本 | **触らない** | `docs/dify/templates/README.md`「外部出典・**本文は無改変**」。雛形は参照用であって実行資材ではない |

**アプリ単位で入れ替えたいとき**は既存の `models.overrides`（`{ app, node_title, role }`）を使う。role には `chat` / `reasoning` / `kimi` / `qwen_small` / `local`（customer-a のみ）が書ける（§1-3 F1）。**ただし `overrides` が効くのは `llm` ノードだけ**（F2）。分類器のモデルをアプリ単位で変える必要が出たら別 Issue（render.py の変更が要る）。

### 2-2. `dify/env/*/env.yml` の確定内容（この通りに置く）

**変えるのは `models:` ブロックだけ。** `dify` / `knowledge` / `brand` / `flags` / `variables` は 1 バイトも変えない。

#### `dify/env/cloud-master/env.yml` の `models:`

```yaml
models:
  chat:       { provider: langgenius/siliconflow/siliconflow, name: Qwen/Qwen3.5-397B-A17B, mode: chat, completion_params: { temperature: 0.2 } }
  reasoning:  { provider: langgenius/siliconflow/siliconflow, name: Pro/moonshotai/Kimi-K2.6, mode: chat }
  kimi:       { provider: langgenius/siliconflow/siliconflow, name: Pro/moonshotai/Kimi-K2.6, mode: chat }   # overrides から role: kimi で参照
  qwen_small: { provider: langgenius/siliconflow/siliconflow, name: Qwen/Qwen3.6-35B-A3B, mode: chat }       # 軽量・高速用
  embedding:  { provider: '', name: '' }        # KB は画面で作る。作成時に SiliconFlow BAAI/bge-m3 を選ぶ
  rerank:     { provider: '', name: '' }        # 空＝reranking_enable: false のまま（DP-40）
  overrides: []
```

#### `dify/env/inhouse/env.yml` の `models:`

```yaml
models:
  chat:       { provider: langgenius/siliconflow/siliconflow, name: Qwen/Qwen3.5-397B-A17B, mode: chat, completion_params: { temperature: 0.2 } }
  reasoning:  { provider: langgenius/siliconflow/siliconflow, name: Pro/moonshotai/Kimi-K2.6, mode: chat }
  kimi:       { provider: langgenius/siliconflow/siliconflow, name: Pro/moonshotai/Kimi-K2.6, mode: chat }
  qwen_small: { provider: langgenius/siliconflow/siliconflow, name: Qwen/Qwen3.6-35B-A3B, mode: chat }
  embedding:  { provider: langgenius/siliconflow/siliconflow, name: BAAI/bge-m3 }
  rerank:     { provider: '', name: '' }
  overrides: []
```

#### `dify/env/customer-a/env.yml` の `models:`

```yaml
models:                                        # DP-01 (a)：中国拠点は SiliconFlow 中国版エンドポイント（資格情報側で .cn を選ぶ）
  chat:       { provider: langgenius/siliconflow/siliconflow, name: Qwen/Qwen3.5-397B-A17B, mode: chat, completion_params: { temperature: 0.2 } }
  reasoning:  { provider: langgenius/siliconflow/siliconflow, name: Pro/moonshotai/Kimi-K2.6, mode: chat }
  kimi:       { provider: langgenius/siliconflow/siliconflow, name: Pro/moonshotai/Kimi-K2.6, mode: chat }
  qwen_small: { provider: langgenius/siliconflow/siliconflow, name: Qwen/Qwen3.6-35B-A3B, mode: chat }
  embedding:  { provider: langgenius/siliconflow/siliconflow, name: BAAI/bge-m3 }
  rerank:     { provider: langgenius/siliconflow/siliconflow, name: BAAI/bge-reranker-v2-m3 }
  local:      { provider: langgenius/ollama/ollama, name: '${LOCAL_MODEL_NAME}', mode: chat }   # DP-03 越境ゼロ帯
  overrides:
    - { app: KN-03, node_title: 'LLM', role: local }     # HR 帯は自前モデル
    - { app: KN-04, node_title: 'LLM', role: local }
```

**禁止事項（verify §12 に直結）**：`api.siliconflow.cn` / `api.siliconflow.com` / `docs.siliconflow.cn` などの **URL を env.yml に書かない（コメント行も含めて）**。書くと `tools/verify.mjs` §12 が FAIL する（§1-4 V2）。

### 2-3. マスタ DSL `dify/apps/*.yml` の変更手順（**この手順で行う。手書きの当てずっぽうで直さない**）

`CLAUDE.md` §2-12 の同一性（`render --check --env cloud-master` がマスタとバイト一致）を守るため、マスタの `llm` ノードのモデルも同じ値にする。

| 案 | 手順 | 判定 |
|---|---|---|
| 案 A（PM 提示の素直な形） | `render --env cloud-master --all` → `dify/build/cloud-master/*.yml` を `dify/apps/` に**コピー** | **採らない**。§1-5 の実測どおり System プロンプトの block scalar が 1 行の `"…\n…"` に潰れ、生成バナー（`# ---- render.py: … generated=… ----`）がマスタに混入する。マスタは手で読む 1 本（`dify/README.md` の規約）なので壊してはいけない |
| **案 B（採用）** | ① env.yml を先に直す ② `render --env cloud-master --all` で `dify/build/cloud-master/*.yml` を生成し、**正しい値を目で確認する**（コピーはしない） ③ マスタの `model:` ブロックの **`name:` と `provider:` の 2 行だけ**を build の値に合わせる（他の行・整形・順序は触らない） ④ `render --env cloud-master --all --check` が全件 `[OK] マスタとバイト一致` で **exit 0** | **採用**。§1-3 F3 のとおり `--check` PASS は「マスタの model ブロックが env と等価」の**機械証明**なので、案 A と検証強度は同じ。加えて `git diff` が **1 ファイル 2 行**に収まりレビューできる |
| 案 C | `render.py` に「マスタを行単位で書き換える `--emit-master`」を足す | 本 Issue では採らない。行編集の実装リスクが、2 ファイル 4 行の変更に見合わない。Wave 2 以降でファイル数が増え、手作業が辛くなったら別 Issue（§2-7 の手順は 10 本でもそのまま回る） |

#### 具体的な変更箇所（変更前 → 変更後）

| ファイル | 行 | 変更前 | 変更後 |
|---|---|---|---|
| `dify/apps/KN-01-tech-knowledge-qa.yml` | 7 | `# モデル   : openai / gpt-4o-mini を既定。環境のプロバイダーに合わせて UI で変更する（dify/README.md）` | `# モデル   : siliconflow / Qwen/Qwen3.5-397B-A17B を既定（dify/env/cloud-master/env.yml の models.chat）。変えるときは env とマスタを同時に（dify/README.md）` |
| 同上 | 179 | `          name: gpt-4o-mini` | `          name: Qwen/Qwen3.5-397B-A17B` |
| 同上 | 180 | `          provider: langgenius/openai/openai` | `          provider: langgenius/siliconflow/siliconflow` |
| `dify/apps/DC-01-hq-report-draft.yml` | 7 | 同じ 1 行（`# モデル   : openai / gpt-4o-mini を既定。…`） | 同じ 1 行に差し替え |
| 同上 | 161 | `          name: gpt-4o-mini` | `          name: Qwen/Qwen3.5-397B-A17B` |
| 同上 | 162 | `          provider: langgenius/openai/openai` | `          provider: langgenius/siliconflow/siliconflow` |

- `completion_params: { temperature: 0.2 }` と `mode: chat` は**変えない**（env の `chat` と一致しているため）
- KN-01 の `reranking_model` / `reranking_enable`（L134-137）・`dataset_ids: []`（L130）・`version: 0.6.0`・`dependencies: []` は**変えない**
- インデントは既存のまま（半角スペース 10 個）。行番号は基準コミット `87d3cc3` のもの。ずれていたら `model:` ブロックを目印にする
- **`app.description` は触らない**（KN-01 の「(1) LLM ノードのモデルを環境のプロバイダーに合わせて選び直す」はプロバイダー未設定時の手順として今も正しい。Dify の画面に出る文言なので、必要になったら別 Issue で見直す）
- 先頭コメント L7 の変更は **`render --check` の判定に影響しない**（`extract_header` が `#` ブロックをそのまま持ち回り、恒等時は生バイトを比較するため）。それでも直すのは、マスタを読む人が古い既定値を信じないようにするため

### 2-4. 文書の更新（差し込む文案。この通りに入れる）

| # | ファイル | 変更 |
|---|---|---|
| A-1 | `dify/env/README.md` | 冒頭 3 行目の「`api.dify.ai / gpt-4o-mini` の既定値で動く 1 本」を「**`api.dify.ai / siliconflow・Qwen/Qwen3.5-397B-A17B` の既定値で動く 1 本**」に、「書いてよい値／書いてはいけない値」表の「`cloud-master` の `api.dify.ai`・`gpt-4o-mini` など」を「`cloud-master` の `api.dify.ai`・`Qwen/Qwen3.5-397B-A17B` など」に差し替える。<br>さらに「モデル用途 4 種の意味」の表の**下**に次を追加：<br>「**既定プロバイダは SiliconFlow**（`langgenius/siliconflow/siliconflow`）。全 env で `chat` = `Qwen/Qwen3.5-397B-A17B`、`reasoning` = `Pro/moonshotai/Kimi-K2.6`。アプリ単位で振り替えるための追加 role として **`kimi`**（Kimi-K2.6）と **`qwen_small`**（`Qwen/Qwen3.6-35B-A3B`、軽量・高速）を定義してあり、`models.overrides` の `role` から参照できる（**`overrides` が効くのは `llm` ノードだけ**）。<br>エンドポイントは資格情報の `use_international_endpoint` で切り替える（日本側＝国際版 `.com`／中国側＝既定 `.cn`）。**この設定と API キーは Dify 側の「設定 → モデルプロバイダー」に入れるもので、`env.yml` にも DSL にも書かない**（`CLAUDE.md` §2-10）。`env.yml` に URL を書くと `tools/verify.mjs` §12 が FAIL する。<br>`embedding` は `cloud-master` だけ空。**Cloud で KB を作るときは埋め込みモデルに SiliconFlow `BAAI/bge-m3` を選ぶ**（`scripts/dify/kb_upload.py` は現状 `embedding_model` を Datasets API に渡さず、ワークスペース既定が使われる）。」 |
| A-2 | `dify/README.md` | 「規約」の「モデルは `openai / gpt-4o-mini` を既定で書き…」の行を差し替え：<br>「モデルは **SiliconFlow `Qwen/Qwen3.5-397B-A17B`**（生成）を既定で書く。分類・抽出ノードを足すときは **`Pro/moonshotai/Kimi-K2.6`**（`models.reasoning`）。既定値は `dify/env/cloud-master/env.yml` の `models` が正で、**変えるときは env とマスタを同時に**（`render.py --env cloud-master --all --check` が通ること）。`dependencies` は空（プラグイン識別子のハッシュを固定しないため）」<br>さらに「インポート後にやること」表の 1 行目を差し替え：「LLM ノードの**モデル**が DSL の指定（`siliconflow / Qwen/Qwen3.5-397B-A17B`）どおり選ばれているか確認する。選べない場合は**プロバイダー未設定**（設定 → モデルプロバイダーで SiliconFlow を追加）」<br>2 行目（KN-01 の KB）に追記：「KB 作成時の埋め込みモデルは **SiliconFlow `BAAI/bge-m3`**」 |
| A-3 | `dify/DEPLOY.md` §0 前提 | 箇条書きに 1 項追加：<br>「- Dify Cloud の **設定 → モデルプロバイダー**で **SiliconFlow プラグインを追加**し、API キーと**エンドポイント（国際版 = `use_international_endpoint` を有効）**を登録済み。キーは画面に入れるもので、リポジトリにも環境変数にも置かない。**プラグイン定義に載っていることと、そのアカウントで実際に呼べることは別**なので、初回は LLM ノードのモデル一覧に `Qwen/Qwen3.5-397B-A17B` と `Pro/moonshotai/Kimi-K2.6` が出るかを目で確認する（出なければ止めて `dify/KNOWN_ISSUES.md` に起票）」<br>§1-① の手順 3 を差し替え：「LLM ノードを開き、**モデルが `siliconflow / Qwen/Qwen3.5-397B-A17B` になっているか確認**する（DSL の指定どおり入っていれば変更不要）。空欄・エラーならプロバイダー未設定」<br>§4 トラブル表の「モデルのエラー（provider not found 等）」行の「原因の目安」を「`siliconflow` プラグイン未導入、またはそのアカウントで当該モデルが未提供」に、「対処」を「設定 → モデルプロバイダーで SiliconFlow を追加。モデルが一覧に無ければ `dify/KNOWN_ISSUES.md` に `DI-xxx` で起票して止まる」に差し替え |
| A-4 | `docs/dify/decisions-pending.md` | **DP-01 の行末**に追記：「**決定（2026-09-07・PM）**：(a) 採用。既定プロバイダは全 env で SiliconFlow、`chat` = `Qwen/Qwen3.5-397B-A17B`、`reasoning` = `Pro/moonshotai/Kimi-K2.6`。追加 role `kimi` / `qwen_small` を env に定義。代替は Tongyi 直（`qwen3.8-max`）＋ Moonshot 直（`kimi-k3`）の 2 契約構成（`docs/handoff/2026-09-07-china-models-and-syncback.md` §2-5）。**実機での可用性は未確認**（初回 `/dify-deploy` で確認）」<br>**DP-04 の行末**に追記：「**方針（2026-09-07・PM）**：日本語品質の第一候補は **`Qwen/Qwen3.5-397B-A17B`**。評価セット 20 件はこれを対象に採点する（DeepSeek-V3.x・本社 Azure との比較は評価後）」<br>**A 節の末尾に DP-40 を新設**（§2-5 の行をそのまま） |
| A-5 | `docs/handoff/2026-09-06-pm-decisions.md` | 末尾に §12 を新設（§2-6 の文案をそのまま） |
| A-6 | `CLAUDE.md` §2-12 | **PM が適用**（architect・implementer は触らない）。「どこで検出」の直前に 1 行追加：<br>「・**既定モデルを変えるときは `dify/env/**/env.yml` とマスタ DSL を同時に変える**（`render.py --env cloud-master --all --check` が PASS すること）。手順は `docs/handoff/2026-09-07-china-models-and-syncback.md` §2-3」<br>あわせて §2-12 本文の例示「`langgenius/openai/openai` `gpt-4o-mini`」を「**`langgenius/siliconflow/siliconflow` `Qwen/Qwen3.5-397B-A17B`**」に差し替える（`dataset_ids: []` はそのまま） |
| A-7 | `.claude/commands/dify-deploy.md` §1 | **PM が適用**（`CLAUDE.md` §4・`2026-09-07-repo-layout-v2.md` §6-2 #16 により architect も implementer も `.claude/**` を触らない）。文案は §2-8 |
| A-8 | `docs/dify/templates/*.yml` | **触らない**（外部出典・無改変。`templates/README.md`）。雛形は「構成の参考」であって実行資材ではないので、`gpt-4o-mini` のままでよい |

### 2-5. DP-40（新設。`decisions-pending.md` の A 節末尾にこの 1 行を足す）

```md
| DP-40 | **`cloud-master`（および `inhouse`）でリランクを有効にするか** | 現状 `models.rerank` は空＝`reranking_enable: false`。有効化すると SiliconFlow `BAAI/bge-reranker-v2-m3` が使え、KN-01 の検索精度が上がる見込みだが、**マスタ DSL の `multiple_retrieval_config.reranking_enable` が `true` に変わり `reranking_model` に値が入る**（＝マスタの中身が env 都合で変わる）。`customer-a` は既に有効 | KN-01 ほか KB を引く全件、PC-08 | 本設計 §2-1、`2026-09-07-repo-layout-v2.md` §4-1 R3 | **W1 は現状維持（無効）**。KN-01 のテスト（`dify/tests/KN-01.json`）で検索の取りこぼしが出てから有効化し、そのとき env とマスタを同時に変える（§2-3 案 B の手順） | PM |
```

### 2-6. `docs/handoff/2026-09-06-pm-decisions.md` に足す §12（この通り）

```md
## 12. 中国で使えるモデルへの既定切替（`2026-09-07-china-models-and-syncback.md`）の PM 判断 — 2026-09-07

- 要望：「LLM は中国で使える LLM にして欲しい。個人的には Qwen と KIMI の新しいやつを使いたい」
- 事実確認：2026-09-07 に PM が `langgenius/dify-official-plugins` main の `models/<provider>/models/llm/_position.yaml` を取得（siliconflow 0.0.59 / moonshot 0.1.12 / tongyi 0.2.18）

| # | 決定 |
|---|---|
| D-1 | 既定プロバイダは **全 env で SiliconFlow**（1 契約で Qwen と Kimi。日本側は国際版エンドポイント、中国側は `.cn`。DP-01 (a) と整合） |
| D-2 | `models.chat` = `Qwen/Qwen3.5-397B-A17B`（temperature 0.2 維持）／`models.reasoning` = `Pro/moonshotai/Kimi-K2.6`。両モデルが常に使われる |
| D-3 | 追加 role **`kimi`**（Kimi-K2.6）と **`qwen_small`**（`Qwen/Qwen3.6-35B-A3B`）を env に定義し、`models.overrides` から参照できるようにする（render.py の変更は不要） |
| D-4 | `embedding` は `cloud-master` のみ空のまま（KB は画面で作る。**作成時に `BAAI/bge-m3` を選ぶ**と文書に明記）。`inhouse` / `customer-a` は `BAAI/bge-m3` |
| D-5 | `rerank` は現状維持。`cloud-master` の有効化は **DP-40** として起票（KN-01 の `reranking_enable` が変わるため） |
| D-6 | 代替案は Tongyi 直（`qwen3.8-max`）＋ Moonshot 直（`kimi-k3`）の 2 契約構成。`env.yml` の 2 行の変更だけで切替できる形にしておく |
| D-7 | マスタ DSL も同じ値に揃える。**手順は「env を直す → render で正しい値を確認 → マスタの `name`/`provider` 2 行だけ直す → `render --check` PASS」**（render 出力のコピーは prompt の block scalar を壊すため採らない） |
| D-8 | SiliconFlow の API キーとエンドポイント設定は **Dify 側の画面**に入れる。`env.yml`・DSL・環境変数には出さない |
| D-9 | Cloud で調整した DSL は **`scripts/dify/sync_back.py` で Git のマスタへ戻す**（Cloud は編集場所、Git がマスタ）。他 env からの逆流は非対応。別セルフホストへは `release.py --env inhouse` で配る |
| D-10 | 実装で出た不具合は **`dify/KNOWN_ISSUES.md`**（`DI-xxx` 連番）に残す。`docs/dify/usecases/<番号>.md` §10 には要約を書かずリンクだけ |

- `docs/dify/templates/*.yml` の `gpt-4o-mini` は触らない（外部出典・無改変）
- **確認要**：プラグイン定義に載っていても PM のアカウントで実際に呼べるとは限らない。初回 `/dify-deploy` で実機確認し、駄目なら `KNOWN_ISSUES.md` に起票して止まる
- `CLAUDE.md` §2-12 への 1 行追記と `.claude/commands/dify-deploy.md` の更新は **PM が適用**
```

### 2-7. 代替案（「最新」を最優先する場合の 2 契約構成）

| | 採用案（SiliconFlow 1 契約） | 代替案（Tongyi 直 ＋ Moonshot 直の 2 契約） |
|---|---|---|
| `models.chat` | `langgenius/siliconflow/siliconflow` `Qwen/Qwen3.5-397B-A17B` | `langgenius/tongyi/tongyi` `qwen3.8-max` |
| `models.reasoning` | `langgenius/siliconflow/siliconflow` `Pro/moonshotai/Kimi-K2.6` | `langgenius/moonshot/moonshot` `kimi-k3` |
| `embedding` / `rerank` | `BAAI/bge-m3` / `BAAI/bge-reranker-v2-m3`（同一プロバイダ） | **Tongyi にも Moonshot にも無い**。SiliconFlow か自前を別途契約（＝3 系統になる） |
| 契約・資格情報 | 1 系統 | 2〜3 系統（プラグインごとに API キー登録） |
| 「最新」度 | 一覧の先頭世代（Qwen3.5 / Kimi-K2.6） | 各ベンダ直の最新（Qwen3.8-max / Kimi-K3） |
| 切替の手間 | — | **`env.yml` の `models.chat` と `models.reasoning` の 2 行を書き換えるだけ**。その後 §2-3 案 B の手順でマスタを合わせる（`render --check` PASS まで） |
| リスク | ベンダ集約（SiliconFlow 障害時に全滅。DP-01 のフォールバック論点） | 契約・請求・レート制限が 3 系統に分散。KB は結局 SiliconFlow 依存 |

**この表を `dify/env/README.md` には転記しない**（設計書へのリンク 1 行に留め、env の README は運用手順に集中させる）。

### 2-8. `.claude/commands/dify-deploy.md` の更新文案（**PM が適用**）

§1 の Chrome 依頼文（`>` 引用ブロック）を次に差し替える：

> Dify Cloud の Studio で「アプリを作成 → DSL ファイルをインポート → URL」を開き、`https://raw.githubusercontent.com/shoulang0729/dify/main/dify/apps/<ファイル名>.yml` を貼って作成。古いバージョンの警告はそのまま続行。**LLM ノードを開き、モデルが DSL の指定どおり `siliconflow / Qwen/Qwen3.5-397B-A17B`（分類・抽出ノードがあれば `Pro/moonshotai/Kimi-K2.6`）になっているか確認する。空欄・エラー、またはモデル一覧に該当モデルが無い場合は、勝手に別のモデルを選ばずそこで止めて報告する**（設定 → モデルプロバイダーで SiliconFlow の追加が要る）。確認できたら公開。「API アクセス」で API キーを新規作成して表示。

§3 の末尾に 1 行追加：

> 失敗・詰まりは `dify/KNOWN_ISSUES.md` に `DI-xxx` の行を足す（症状 1 行・原因・対処・状態 `open`）。DSL 修正はここでは行わない。

§4 の完了報告の書式に 1 行追加：

```
KNOWN_ISSUES 追記: DI-xxx（無ければ「なし」）
```

---

## 3. 章 B — Cloud で調整した DSL を Git に戻す（`scripts/dify/sync_back.py`）

**考え方（DEPLOY.md にもこの 2 行を書く）：マスタは Git、Cloud は編集場所。** Cloud で直した内容は必ず Git に戻してからでないと、他の環境へは配らない。

### 3-1. CLI

```
python3 scripts/dify/sync_back.py <exported.yml> [--env cloud-master] [--code KN-01] [--dry-run] [--out <dir>]
```

| 引数 | 意味 |
|---|---|
| `<exported.yml>` | Dify の「DSL をエクスポート」で落としたファイル（例 `~/Downloads/KN-01 技術ナレッジQA.yml`） |
| `--env` | 既定 `cloud-master`。**v1 は `cloud-master` のみ対応**。他を指定したら理由を表示して **exit 2**（§3-5） |
| `--code` | 管理番号を明示（自動判定を上書き） |
| `--dry-run` | **書き込まない**。差分要約だけを出す |
| `--out` | 書き込み先ディレクトリ（既定 `dify/apps`）。検証・テスト用 |

終了コード：`0` 正常 ／ `1` 正規化後に `render --check` 相当が通らない・逆置換が曖昧 ／ `2` 引数・環境不備（PyYAML 無し・env 非対応・管理番号が決まらない・対応するマスタが無い）。**ネットワークは一切呼ばない。**

### 3-2. 処理（順に実行。1 つでも決まらなければ止まる）

| # | 処理 | 詳細 |
|---|---|---|
| S1 | 管理番号の判定 | 優先順：`--code` → `app.name` 先頭の `^([A-Z]{2}-\d{2})\b` → 入力ファイル名の `^([A-Z]{2}-\d{2})-`。決まらなければ **exit 2**（「`--code KN-01` を付けて再実行」と案内） |
| S2 | 対応するマスタの特定 | `dify/apps/<番号>-*.yml`。**0 件なら exit 2**（新規アプリの初登録は本スクリプトの対象外。人が `dify/apps/` にファイルを置いてから使う。理由：ファイル名の `<slug>` は人が決めるもの） |
| S3 | 正規化（逆適用） | §3-3 の N1〜N5 |
| S4 | 書き出し | §3-4 |
| S5 | 差分要約を stdout へ | §3-4 |
| S6 | 自己検証 | 書き出したファイルを読み直し、`render.py` の `render_app()` が**恒等**（`rendered == data`）になることを確認。ならなければ **exit 1** し、どのルール（R1〜R9）で差が出たかを表示する。＝ `render.py --env cloud-master --check <番号>` と同じ判定を**同一コードで**行う |

**実装方針**：`scripts/dify/render.py` から `load_env_raw` / `expand_env` / `build_replace_table` / `render_app` / `extract_header` / `dump_with_header` を **import して再利用**する（`release.py` が `console_api` を import しているのと同じ `sys.path.insert` の作法）。置換ロジックを sync_back に二重実装しない。`build_replace_table` は 2 引数版が有効（§1-3 F6）。

### 3-3. 正規化ルール（マスタに戻すときに必ず戻すもの）

| # | 対象 | 戻し方 | 根拠 |
|---|---|---|---|
| N1 | `knowledge-retrieval` ノードの `data.dataset_ids` | **常に `[]` にする。** env の `knowledge.<論理名>.id` と一致した id は黙って除去。一致しない id があった場合は **件数だけ warn**（`未知の dataset id を 1 件除去しました（値は表示しません）`）。**値はログに出さない** | `CLAUDE.md` §2-12「DSL には `dataset_ids: []` だけ」。§2-10（顧客環境の識別子を出さない）。PM 決定「env と一致した分のみ、他は warn」を「**除去はするが件数のみ warn・値はマスク**」として具体化した（マスタに環境固有 id を残さないことを優先） |
| N2 | `brand.replace` の語彙（`app.name` / `app.description` / ノードの `title` / `desc` / `prompt_template[].text`） | env の `replace` を **`to` → `from` の向きで逆適用**。`to` が空文字・未定義ならスキップ。**同じ `to` が複数の `from` に対応する（逆写像が一意でない）場合は置換せず warn し exit 1**（人が直す）。`cloud-master` は `replace: []` なので実質 no-op | `2026-09-07-repo-layout-v2.md` §4-1 R7 |
| N3 | `version` | env の `dify.dsl_version`（`0.6.0`）に強制。Cloud が新しい版で書き出しても戻す | R9・`dify/README.md` 規約 |
| N4 | `dependencies` | **`[]` に戻す**（Cloud の export はプラグイン識別子とハッシュを詰めてくる） | `dify/README.md` 規約「`dependencies` は空」・R10 |
| N5 | モデル（`llm` の `data.model`・分類器の `data.model`・`reranking_model`） | **触らない**。S6 の自己検証で env と一致しなければ **exit 1**（＝ Cloud で人がモデルを変えていたら、env を直すかモデルを戻すかを人に決めさせる。sync_back が黙って上書きしない） | §2-1 の決定を sync_back が勝手に覆さないため |

**それ以外（ノードの追加・削除・座標・プロンプト本文・変数）はそのまま通す。**それが「Cloud で調整した内容を戻す」ということ。

未知の付加フィールド（Cloud の版が増やしたキー）は v1 では**そのまま通し**、差分要約に「マスタに無いキー」として列挙する。恒常的に出るものが見つかったら `dify/KNOWN_ISSUES.md` に `DI-xxx` を立て、正規化ルール追加は別 PR（**確認要**：Cloud 1.x の export が何を付けるかは実機未確認）。

### 3-4. 書き出しと差分要約

- 既定の書き出し先は **マスタ `dify/apps/<番号>-<slug>.yml` を上書き**（PM 決定）。`--dry-run` なら書かない、`--out` で別ディレクトリに出せる
- ダンパーは `render.py` の `dump_with_header()` を使い、**マスタ先頭の `#` コメントブロックを保つ**。ただし sync_back は **複数行文字列を block scalar（`|-`）で出す representer を追加**した薄いラッパー `dump_master()` を使う（§1-5 の実測どおり、素の `safe_dump` は System プロンプトを 1 行に潰すため）。生成バナー行は**入れない**（マスタは生成物ではない）
- 上書き前に `git status --porcelain dify/apps/` を見て、対象ファイルに未コミットの変更があれば **warn**（止めはしない。人が `git diff` で確認できるため）
- 差分要約（stdout。**プロンプト本文は出さない**）：

```
sync_back: KN-01 ← ~/Downloads/KN-01 技術ナレッジQA.yml (env=cloud-master)
  ノード: 4 → 5  (+1 追加: llm 'ノード名' / -0 削除)
  モデル: llm 'LLM' siliconflow Qwen/Qwen3.5-397B-A17B (変更なし)
  プロンプト: llm 'LLM' system 1,240 → 1,388 字 (+148)
  version: 0.6.0 (N3 で強制)  dependencies: 3 件 → [] (N4)
  dataset_ids: 1 件 → [] (N1。env の KN-01 と一致)
  brand 逆置換: 0 件 (cloud-master は replace 空)
  マスタに無いキー: workflow.graph.nodes[3].data.retry_config
  [OK] render --env cloud-master --check 相当: 恒等（マスタとバイト一致）
  [WROTE] dify/apps/KN-01-tech-knowledge-qa.yml
```

### 3-5. 非対応と、その理由（DEPLOY.md にも 1 段落で書く）

- **`--env inhouse` / `--env customer-a` からの逆流は非対応**。実行したら「非対応。マスタは `cloud-master` から戻す」と表示して **exit 2**。理由：それらの環境の DSL には env が入れた KB id・顧客ブランド語・環境固有モデルが焼き込まれており、**逆写像が一意でない**（複数の `from` が同じ `to` に潰れうる。N2）。マスタに顧客の実名や id が混入する事故を、道具の側で不可能にしておく
- **別のセルフホストへ展開したいときは、エクスポートしたファイルを直接持ち込まない。** Git のマスタから `python3 scripts/dify/release.py --env inhouse --all` で作る。理由：env 差分（モデル・KB id・ブランド語・Start 変数の既定・フラグ）は `render.py` が入れるものなので、ある環境の完成品を別環境に貼ると**その環境の値が混ざったまま**になる

### 3-6. `dify/DEPLOY.md` に足す §6（この通り）

````md
## 6. Cloud での修正を Git に戻す（`sync_back.py`）

**マスタは Git、Cloud は編集場所。** Dify Cloud の画面でプロンプトやノードを直したら、そのままにせず必ず Git のマスタに戻す。
戻していない変更は、社内・顧客環境へのリリース（§5）に一切反映されない。

```bash
# 1) Chrome：対象アプリ → 右上「…」→「DSL をエクスポート」→ ~/Downloads に落ちる
# 2) 正規化してマスタへ書き戻す（ネットワークは呼ばない）
python3 scripts/dify/sync_back.py ~/Downloads/KN-01*.yml --env cloud-master
#    まず中身だけ見たいとき
python3 scripts/dify/sync_back.py ~/Downloads/KN-01*.yml --dry-run
# 3) 検証
python3 dify/check.py
python3 scripts/dify/render.py --env cloud-master --all --check     # 全件 [OK] マスタとバイト一致
# 4) 差分を読んで PR（プロンプト差分は必ず人が読む）
git switch -c feat/<issue>-sync-back-KN-01 && git add dify/apps && git commit && gh pr create
```

`sync_back.py` が自動で戻すもの：`dataset_ids` → `[]`（環境固有 id をマスタに入れない）／`dependencies` → `[]`／`version` → `0.6.0`／
ブランド語彙の逆置換（`cloud-master` は対象なし）。**モデルは戻さない**：Cloud で人がモデルを変えていた場合は exit 1 で止まるので、
`dify/env/cloud-master/env.yml` を直すか、Cloud 側を DSL の指定に戻すかを**人が決める**。

**他環境（`inhouse` / `customer-a`）からの逆流は非対応**（実行すると exit 2）。それらの DSL には KB id・顧客ブランド語・環境固有モデルが
焼き込まれていて、逆写像が一意にならないため。**別のセルフホストへ展開するときも、エクスポートしたファイルを持ち込まない**。
Git のマスタから `python3 scripts/dify/release.py --env inhouse --all` で作る（env 差分は `render.py` が入れるもので、
ある環境の完成品を別環境に貼ると、その環境の値が混ざったままになる）。

不具合・詰まりは `KNOWN_ISSUES.md` に `DI-xxx` で残す（§7）。
````

（`dify/DEPLOY.md` の目次的な導入文に §6・§7 を足すのを忘れない。）

### 3-7. テスト `scripts/dify/tests/test_sync_back.py`

既存の `scripts/dify/tests/` は **pytest ではなく単体で走るスクリプト**（`mock_server.py`）なので、それに合わせる。

```
python3 scripts/dify/tests/test_sync_back.py     # exit 0 で全件 PASS。ネットワークを呼ばない。dify/apps は書き換えない
```

| # | 検査 | 内容 |
|---|---|---|
| T1 | **往復**（本命） | `dify/apps/*.yml`（2 本）を `render.py --env cloud-master` 相当で render → その出力を一時ディレクトリに置き、`sync_back --out <tmp>` に通す → 出力を `yaml.safe_load` した結果が**マスタの `safe_load` 結果と dict として一致**する |
| T2 | N1 | 擬似 export（T1 の入力の `dataset_ids` に `["dummy-id-1"]` を入れたもの）→ 出力が `dataset_ids: []`。stdout に id の値が**出ていない**こと |
| T3 | N3・N4 | `version: 0.7.0` / `dependencies: [{...}]` を入れた擬似 export → 出力が `0.6.0` / `[]` |
| T4 | N5 | `model.name` を別の値にした擬似 export → **exit 1**、メッセージに R1 が出る |
| T5 | 可読性 | 出力の `prompt_template[].text` が **block scalar（`text: |-`）で書かれている**（`text: "…\n…"` になっていない）。§1-5 の退行防止 |
| T6 | 非対応 env | `--env customer-a` → **exit 2**、`dify/apps/` に書き込みが無い |
| T7 | 番号判定 | `app.name` が `KN-01 技術ナレッジQA` のファイルから `KN-01` が判定できる／判定できないファイルは exit 2 |

**テストは `dify/apps/` を書き換えない**（必ず `--out <tmpdir>`）。CI（`npm test`）には**入れない**（Python の実行を verify ワークフローに足さない。`CLAUDE.md` §3 のコマンド集合を変えない）。実行は implementer と reviewer が手で行い、結果を PR 本文に貼る。

### 3-8. `docs/dify/implementation-guide.md` への 1 行

- §7-1 の手順 3 の末尾に追記：「export し直したものを正とする → **`python3 scripts/dify/sync_back.py <export>.yml` でマスタ `dify/apps/` に書き戻す**（`dify/DEPLOY.md` §6）」
- §7-3 の末尾に追記：「Cloud → git の**手動 export 経路**は `scripts/dify/sync_back.py` で正規化して取り込む（Issue #3 に残るのは Console API による**自動**取得のみ）」

---

## 4. 章 C — 実装で出た不具合の記録（`dify/KNOWN_ISSUES.md`）

### 4-1. 書式（新設ファイル。この構造で作る）

```md
# dify/KNOWN_ISSUES.md — Dify 実装・投入・テストで出た不具合の記録

Dify への投入（`DEPLOY.md`）・テスト（`scripts/dify/run_tests.py` → `dify/results/<env>/`）・Cloud での調整で出た
**実際に観測した**不具合と、その対処をここに 1 行ずつ残す。設計時点の「未確定・リスク」は `docs/dify/usecases/<番号>.md` §10、
PM 判断待ちは `docs/dify/decisions-pending.md` で、ここには**起きたこと**だけを書く。

- ID は `DI-001` からの連番。**永久欠番**（消しても再利用しない）
- 直したら行を消さず、状態を `fixed` にして「対処」に PR 番号を書く（同じ罠を次の Wave で踏まないため）
- 状態：`open`（未解決）／`fixed`（修正済み）／`wontfix`（仕様・対象外と判断）
- DSL を直す PR は本文に `DI-xxx` を書く。`/dify-deploy` の完了報告にも「KNOWN_ISSUES 追記: DI-xxx」を出す
- 秘密（API キー・Cookie・dataset id・顧客の実名）は書かない（`CLAUDE.md` §2-10）。エラー文は必要な範囲だけ引用する

| ID | 日付 | env | 管理番号 | 症状（1 行） | 原因 | 対処 | 状態 | Issue/PR |
|---|---|---|---|---|---|---|---|---|
```

### 4-2. 初期行（**実際に確認できた事実のみ**を書く。作り話の行を入れない）

| ID | 日付 | env | 管理番号 | 症状（1 行） | 原因 | 対処 | 状態 | Issue/PR |
|---|---|---|---|---|---|---|---|---|
| DI-001 | 2026-09-07 | inhouse / customer-a | KN-01 | `env.yml` の `models.embedding` を `BAAI/bge-m3` にしても、KB 作成時に反映されずワークスペース既定の埋め込みモデルが使われる | `scripts/dify/kb_upload.py` が dataset 作成時に `embedding_model` / `embedding_model_provider` を Datasets API に渡していない（`indexing_technique: high_quality` のみ） | 当面は **KB 作成時に画面で `BAAI/bge-m3` を選ぶ**（`dify/env/README.md` に明記）。スクリプト対応は別 Issue | open | （本 Issue で記録のみ） |
| DI-002 | 2026-09-07 | cloud-master | — | `render.py` の出力をマスタ `dify/apps/` にコピーすると、System プロンプトの block scalar が 1 行の `"…\n…"` に潰れてレビュー不能になる | `dump_with_header()` の `yaml.safe_dump` が複数行文字列を block scalar で出さない | マスタ更新は **`name` / `provider` の行だけ手で直し、`render --check` で機械検証**する（本設計 §2-3 案 B）。`sync_back.py` は block scalar representer を持つ（§3-4） | open | （本 Issue で記録のみ） |
| DI-003 | 2026-09-07 | — | — | `scripts/dify/render.py` に `build_replace_table` が 2 つ定義されている（L157 の 1 引数版・L363 の 2 引数版）。後者が有効で動作に影響は無いが、import して使うときに紛らわしい | 実装時の消し忘れ | 掃除は別 PR。sync_back からは 2 引数版を使う | open | （本 Issue で記録のみ） |

**`dify/DEPLOY.md` §4 のトラブル表は KNOWN_ISSUES に移さない（architect 判断）。** §4 は「症状 → 原因の目安 → 対処」の**一般ガイド**（まだ起きていないことも含む予防表）で、KNOWN_ISSUES は**実際に観測した記録**。役割が違うものを混ぜると、どちらも信用できなくなる。代わりに §4 の末尾に 1 行足す：

```md
実際に起きた不具合とその後の顛末は [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md)（`DI-xxx`）に残す。
```

**Wave 1（#82）で PM が観測した事象がある場合は、PM が本人の記憶で行を足す。** implementer は**自分で観測していない事象を書かない**（伝聞で症状・原因を書くと記録の価値が消える）。

### 4-3. 運用（各所に 1 行ずつ）

| 場所 | 追記 |
|---|---|
| `dify/README.md` の「ファイル」表 | `\| KNOWN_ISSUES.md \| 投入・テスト・Cloud 調整で**実際に出た**不具合の記録（`DI-xxx` 連番。設計時点のリスクは `docs/dify/usecases/<番号>.md` §10） \|`（`CHANGELOG.md` の行の隣に置く） |
| `docs/dify/usecases/README.md` の「読み方」表の下 | 「**実装で出た不具合は各ファイル §10 に書かず、`dify/KNOWN_ISSUES.md`（`DI-xxx`）に残す**。§10 は設計時点の未確定・リスク専用。§10 から参照するときはリンクだけ書き、症状の要約を二重に持たない」 |
| `docs/dify/usecases/_TEMPLATE.md` §10 | 箇条書きの下に 1 行：「（実装・投入で**実際に出た**不具合は `../../../dify/KNOWN_ISSUES.md` の `DI-xxx`。ここには書かない）」 |
| `.claude/commands/dify-deploy.md` §3・§4 | **PM が適用**。§2-8 の文案 |

**既存 43 本の `usecases/*.md` は 1 バイトも触らない**（README と `_TEMPLATE.md` にルールを置けば足りる）。

---

## 5. 変更ファイル一覧（章 → PR 割当）

| # | ファイル | 章 | 変更 | PR |
|---|---|---|---|---|
| 1 | `dify/env/cloud-master/env.yml` | A | `models:` ブロックを §2-2 に差し替え | PR-1 |
| 2 | `dify/env/inhouse/env.yml` | A | 同上 | PR-1 |
| 3 | `dify/env/customer-a/env.yml` | A | 同上（`local` / `overrides` は残す） | PR-1 |
| 4 | `dify/apps/KN-01-tech-knowledge-qa.yml` | A | L179-180 の 2 行のみ | PR-1 |
| 5 | `dify/apps/DC-01-hq-report-draft.yml` | A | L161-162 の 2 行のみ | PR-1 |
| 6 | `dify/env/README.md` | A | A-1 の文案 | PR-1 |
| 7 | `dify/README.md` | A・C | A-2 の文案 ＋ ファイル表に `KNOWN_ISSUES.md` の行 | PR-1（A 分）/ PR-3（C 分。競合するなら PR-1 でまとめてよい） |
| 8 | `dify/DEPLOY.md` | A | §0 前提・§1-① 手順 3・§4 トラブル表（A-3） | PR-1 |
| 9 | `docs/dify/decisions-pending.md` | A | DP-01 / DP-04 に決定を追記、A 節末尾に **DP-40** を新設 | PR-1 |
| 10 | `docs/handoff/2026-09-06-pm-decisions.md` | A | §12 を新設（§2-6 をそのまま） | PR-1 |
| 11 | `scripts/dify/sync_back.py` | B | **新規** | PR-2 |
| 12 | `scripts/dify/tests/test_sync_back.py` | B | **新規** | PR-2 |
| 13 | `dify/DEPLOY.md` | B | §6 を追記（§3-6） | PR-2 |
| 14 | `docs/dify/implementation-guide.md` | B | §7-1 手順 3・§7-3 に各 1 行（§3-8） | PR-2 |
| 15 | `dify/KNOWN_ISSUES.md` | C | **新規**（§4-1 の書式 ＋ §4-2 の 3 行） | PR-3 |
| 16 | `dify/DEPLOY.md` | C | §4 末尾に 1 行（§4-2） | PR-3 |
| 17 | `docs/dify/usecases/README.md` | C | 「読み方」表の下に 1 行（§4-3） | PR-3 |
| 18 | `docs/dify/usecases/_TEMPLATE.md` | C | §10 に 1 行（§4-3） | PR-3 |
| 19 | `CLAUDE.md` §2-12 | A | **PM が適用**（§2-4 A-6） | — |
| 20 | `.claude/commands/dify-deploy.md` | A・C | **PM が適用**（§2-8） | — |

---

## 6. 触らない範囲（reviewer の diff 監査の基準）

- **`mock/**` は 1 バイトも変えない**。`node tools/regress.mjs` の差分 **0**（`--update` 禁止）。データ層（`CATS` 8 / `SVCS` 43 / `TAGS`）の件数・id 一覧は不変
- **`tools/verify.mjs` を変えない**（§1-4 V1 のとおり新 role は既存の検査を通る。もし FAIL したら実装を疑う前に本設計 §1-4 を読み直す）
- **`tools/regress.baseline.json`** を変えない
- **`scripts/dify/render.py` / `release.py` / `console_api.py` / `kb_upload.py` / `run_tests.py` を変えない**（sync_back は import して使うだけ。DI-001・DI-003 の修正は別 Issue）
- **`dify/apps/*.yml` の変更は先頭コメント L7 ＋ `name` ＋ `provider` の 3 行 × 2 ファイル＝ 6 行だけ**。プロンプト・ノード・id・`app.description`・`version`・`dependencies`・`dataset_ids`・`reranking_*` は触らない
- **`dify/env/*/env.yml` の変更は `models:` ブロックだけ**。`dify` / `knowledge` / `brand` / `flags` / `variables` は触らない
- **`docs/dify/templates/*.yml`**（外部出典・無改変）・**`docs/dify/usecases/*.md` の 43 本**・`platform-components.md`・`feasibility-33-services.md`・既存の `docs/handoff/*.md`（本書の追加と pm-decisions §12 の追記を除く）
- **`.claude/agents/**`・`.claude/commands/**`・`CLAUDE.md`**（§2-4 A-6 と §2-8 の文案は **PM が適用**）
- **`.github/workflows/*`**・`package.json`（`npm test` の中身を変えない）
- **秘密**：SiliconFlow / Moonshot / Tongyi の API キー・エンドポイント URL を `dify/env/**`・`dify/apps/**`・PR 本文・コミットメッセージに書かない

---

## 7. 受け入れ条件（機械検証できる形）

**全 PR 共通**：`node tools/verify.mjs` PASS ／ `node tools/regress.mjs` 差分 0 ／ `npm test` 緑（＝ CI の `verify`）。

**PR-1（モデル既定の切替）**

1. `python3 scripts/dify/render.py --env cloud-master --all --check` が **KN-01・DC-01 とも `[OK] マスタとバイト一致`** で **exit 0**
2. `git diff --numstat dify/apps/` が **2 ファイルとも `3 3`**（先頭コメント L7 ＋ `name` ＋ `provider`）。それ以上変わっていたら不合格
3. `grep -rn "gpt-4o-mini" dify/` の結果が **0 件**（`dify/env/*/env.yml`・`dify/apps/*.yml`・`dify/README.md`・`dify/DEPLOY.md`・`dify/env/README.md` から消えている。`docs/dify/templates/**` は**対象外＝残っていて正常**）
4. `grep -c "siliconflow" dify/env/cloud-master/env.yml` が **4**（chat / reasoning / kimi / qwen_small）、`dify/env/inhouse/env.yml` が **5**（＋ embedding）、`dify/env/customer-a/env.yml` が **6**（＋ embedding ＋ rerank）
5. `grep -n "siliconflow\.\(cn\|com\)" dify/env/*/env.yml` が **0 件**（URL を env に書いていない。verify §12 の URL 検査も PASS）
6. `python3 dify/check.py` が KN-01・DC-01 とも OK
7. `python3 scripts/dify/render.py --env customer-a --all --strict` が、環境変数なしでは exit 1（未定義変数名のみ列挙・値は出ない）、`DIFY_BASE_URL` 等を与えれば exit 0 で 2 本＋`render-report.md` を生成する（**新 role を足したことで既存動作が壊れていない**ことの確認）
8. `dify/env/README.md` に「`kimi`」「`qwen_small`」「`BAAI/bge-m3`」「`overrides` が効くのは `llm` ノードだけ」の 4 点が書かれている
9. `docs/dify/decisions-pending.md` に **DP-40** が 1 行あり、DP-01・DP-04 に「決定（2026-09-07・PM）」が入っている
10. `docs/handoff/2026-09-06-pm-decisions.md` に §12（D-1〜D-10）がある

**PR-2（`sync_back.py`）**

11. `python3 scripts/dify/tests/test_sync_back.py` が **exit 0**（T1〜T7 全 PASS）。実行後に `git status --porcelain dify/apps/` が**空**
12. `python3 scripts/dify/sync_back.py dify/apps/KN-01-tech-knowledge-qa.yml --dry-run` が差分要約を出し、**何も書き込まない**（`git status` が空）。要約に `[OK] render --env cloud-master --check 相当: 恒等` が出る
13. `python3 scripts/dify/sync_back.py <任意の export> --env customer-a` が **exit 2** で「非対応」と表示し、書き込まない
14. `grep -n "^import\|^from" scripts/dify/sync_back.py` に `render` からの import があり、置換ロジック（R1〜R9 相当）を**再実装していない**
15. `sync_back.py` の実行でネットワークを呼ばない（`socket` / `urllib` / `http` の import が無いことをコードレビューで確認）
16. `dify/DEPLOY.md` に §6 があり、(a) エクスポート → sync_back → `check.py` → `render --check` → PR の 5 手順 (b) 他 env 非対応の理由 (c) 別セルフホストは `release.py` で作る理由 が書かれている

**PR-3（`KNOWN_ISSUES.md`）**

17. `dify/KNOWN_ISSUES.md` が §4-1 の 9 列の表で始まり、**DI-001〜DI-003 の 3 行**がある。ID の重複が無い
18. `KNOWN_ISSUES.md` に `sk-` で始まる文字列・32 文字以上の英数字連続・顧客実名が**無い**
19. `dify/README.md` のファイル表と `dify/DEPLOY.md` §4 末尾から `KNOWN_ISSUES.md` へのリンクがあり、リンク先が実在する
20. `docs/dify/usecases/*.md`（43 本）の diff が **0**（README と `_TEMPLATE.md` のみ変更）

---

## 8. implementer が実行するコマンド列

```bash
# --- 共通の起点 ---
git switch main && git pull --ff-only
node tools/verify.mjs && node tools/regress.mjs        # 変更前に緑であることを確認

# ================= PR-1: モデル既定の切替 =================
git switch -c feat/<issue>-china-models
# 1) dify/env/{cloud-master,inhouse,customer-a}/env.yml の models: を §2-2 に差し替え（他のブロックは触らない）
# 2) 正しい値を render の出力で確認する（コピーはしない）
python3 scripts/dify/render.py --env cloud-master --all
sed -n '/^  chat:/,/^  overrides:/p' dify/env/cloud-master/env.yml
grep -n -A5 "^        model:" dify/build/cloud-master/*.yml
# 3) マスタの先頭コメント L7 と name/provider を合わせる（KN-01 L7,179,180 / DC-01 L7,161,162）
# 4) 機械検証（ここが受け入れ条件 1）
python3 scripts/dify/render.py --env cloud-master --all --check   # 全件 [OK] / exit 0
git diff --numstat dify/apps/                                     # 2 ファイルとも "3 3"
grep -rn "gpt-4o-mini" dify/                                      # 0 件（templates は docs/ 配下なので無関係）
grep -n "siliconflow\.\(cn\|com\)" dify/env/*/env.yml             # 0 件
python3 dify/check.py
DIFY_BASE_URL=https://example.invalid DIFY_CONSOLE_URL=https://example.invalid \
  BRAND_COMPANY_JA=X BRAND_COMPANY_ZH=X BRAND_COMPANY_EN=X BRAND_ENTITY_JA=X BRAND_ENTITY_ZH=X BRAND_ENTITY_EN=X \
  BRAND_SITE1_JA=X BRAND_SITE1_ZH=X BRAND_SITE1_EN=X BRAND_SITE2_JA=X BRAND_SITE2_ZH=X BRAND_SITE2_EN=X \
  KB_NAME_KN01=X LOCAL_MODEL_NAME=X \
  python3 scripts/dify/render.py --env customer-a --all --strict   # exit 0（ダミー値。実キーは使わない）
# 5) 文書（§2-4 A-1〜A-5 の文案をそのまま）
node tools/verify.mjs && node tools/regress.mjs && npm test
git add -A && git commit && git push -u origin HEAD               # PR 本文に本設計書パスと上の出力を貼る

# ================= PR-2: sync_back.py =================
git switch main && git pull --ff-only && git switch -c feat/<issue>-sync-back
# scripts/dify/sync_back.py と scripts/dify/tests/test_sync_back.py を書く（§3）
python3 scripts/dify/tests/test_sync_back.py                      # exit 0
python3 scripts/dify/sync_back.py dify/apps/KN-01-tech-knowledge-qa.yml --dry-run
git status --porcelain dify/apps/                                 # 空（何も書き換えていない）
python3 scripts/dify/render.py --env cloud-master --all --check    # 退行していないこと
node tools/verify.mjs && node tools/regress.mjs && npm test
git add -A && git commit && git push -u origin HEAD

# ================= PR-3: KNOWN_ISSUES.md =================
git switch main && git pull --ff-only && git switch -c feat/<issue>-known-issues
# dify/KNOWN_ISSUES.md（§4-1・§4-2）＋ 参照 3 か所（§4-3）
git diff --stat docs/dify/usecases/                               # README.md と _TEMPLATE.md だけ
node tools/verify.mjs && node tools/regress.mjs && npm test
git add -A && git commit && git push -u origin HEAD
```

**やらないこと**：`node tools/regress.mjs --update`（データ層は変わらない）／`dify/build/**` の commit（`.gitignore` 済み）／実 API キーを使った実行（本 Issue の検証は**すべてネットワーク無し**で完結する）。

---

## 9. reviewer の照合点

| # | 見るもの | 合格の形 |
|---|---|---|
| 1 | `git diff dify/apps/` | **6 行だけ**（2 ファイル × 先頭コメント L7 / `name` / `provider`）。プロンプト・ノード・id・`app.description`・`version`・`dependencies` が動いていない |
| 2 | `git diff dify/env/` | `models:` ブロック**だけ**。`knowledge` / `brand` / `flags` / `variables` / `dify` が動いていない。URL・キーが入っていない |
| 3 | `python3 scripts/dify/render.py --env cloud-master --all --check` | 自分の手で実行して **exit 0**（PR 本文の主張を信じない） |
| 4 | `node tools/regress.mjs` | 差分 0。`regress.baseline.json` が diff に**入っていない** |
| 5 | `node tools/verify.mjs` | PASS。**§12 が変更されていない**こと（`git diff tools/` が空） |
| 6 | `scripts/dify/sync_back.py` | `render.py` から import して再利用している／ネットワーク系の import が無い／`--env cloud-master` 以外で exit 2 ／既定の書き出し先が `dify/apps` で `--dry-run` が書き込まない |
| 7 | `python3 scripts/dify/tests/test_sync_back.py` | 自分の手で実行して exit 0。実行後 `git status` が空 |
| 8 | `dify/KNOWN_ISSUES.md` | 3 行が**実在する事実**を書いている（DI-001 は `kb_upload.py` に `embedding_model` を渡す箇所が無いことを、DI-003 は `render.py` の二重定義を、それぞれ grep で確認できる）。秘密・顧客実名が無い |
| 9 | `docs/dify/usecases/` | `git diff --stat` が README.md と `_TEMPLATE.md` の 2 本だけ |
| 10 | `.claude/**` と `CLAUDE.md` | **diff が空**（PM が適用する範囲。PR に入っていたら差し戻す） |
| 11 | PR 本文 | 設計書パス・実行した検証コマンドの出力・触っていない範囲が書かれている。`--update` を使っていない |

---

## 10. verify / regress への影響

| ツール | 影響 | 根拠 |
|---|---|---|
| `tools/verify.mjs` §12 | **変更不要。** `REQUIRED_MODELS` は `chat` / `reasoning` / `embedding` / `rerank` の**存在検査**のみで、未知キー（`kimi` / `qwen_small` / `local` / `overrides`）を禁止していない | verify.mjs L570・L594-596（§1-4 V1） |
| 同 §12 の URL 検査 | **制約になる。** `cloud-master` は `https://api.dify.ai/v1` と `https://cloud.dify.ai` 以外の生 URL を許さず、他 env は生 URL を一切許さない。**コメント行も対象**なので SiliconFlow の URL を env.yml に書かない | verify.mjs L618-624（§1-4 V2） |
| 同 §12 の秘密検出 | 影響なし。今回入れるモデル名は 32 文字以上の英数字連続を作らない | §1-4 V3 |
| 同 §11（索引の鮮度） | 影響なし。`SVCS` も `docs/dify/usecases/*.md` の**本数**も変わらないので `npm run index` は不要 | — |
| `tools/regress.mjs` | **差分 0 のまま。** `mock/js/data/**` を触らないので `CATS` 8 / 17 中分類 / `SVCS` 43 / `TAGS` の件数・id 一覧は不変。**`--update` は禁止** | `CLAUDE.md` §2-9・§3 |
| `npm test` / CI `verify` | 内容も定義も変えない。`test_sync_back.py` は CI に入れない（Python を verify ワークフローに足さない） | `CLAUDE.md` §3 |

---

## 11. Wave 2（Issue #98）以降への再適用手順

`feat/98-wave2-a` / `-b` / `-c` は基準時点（`87d3cc3`）では **main と同じコミットを指しており、新規 DSL はまだ 1 本も入っていない**（`git ls-tree <branch> dify/apps/` で確認）。Wave 2 の 10 本が `gpt-4o-mini` のまま作られた場合、統合時に次を回す。**PR-1 と同じ手順がそのまま N 本に効く**。

```bash
# Wave 2 のブランチを main（PR-1 マージ後）に rebase したあと：
python3 scripts/dify/render.py --env cloud-master --all           # 期待値を dify/build/cloud-master/ に出す
python3 scripts/dify/render.py --env cloud-master --all --check   # [DIFF] が出たファイルが直す対象
#   → [DIFF] のファイルだけ、model ブロックの name / provider の 2 行を build 側の値に合わせる
python3 scripts/dify/render.py --env cloud-master --all --check   # 全件 [OK] / exit 0 になるまで繰り返す
git diff --numstat dify/apps/                                     # 1 ファイルにつき "3 3"（先頭コメント L7 ＋ llm 1 個。llm が n 個なら 1+2n）
python3 dify/check.py
```

- **分類器・パラメータ抽出ノードを持つアプリ**（Wave 2 で出てくる想定）は、`--check` が R2 でも `[DIFF]` を出す。その場合は該当ノードの `model.name` / `model.provider` を **`Pro/moonshotai/Kimi-K2.6` / `langgenius/siliconflow/siliconflow`** に合わせる（`models.reasoning`）
- `--check` はマスタ 1 本ごとに `[OK]` / `[DIFF]` を出すので、**何本になっても手順は同じ**。ファイル数が増えて手作業が辛くなったら §2-3 案 C（`render.py --emit-master`）を別 Issue で検討する

---

## 12. PM 判断待ち・確認要

| # | 論点 | 状態 | 既定（回答が無ければこれで進む） |
|---|---|---|---|
| **確認要 1** | §1-1 のモデルが **PM のアカウント／エンドポイントで実際に呼べるか**（プラグイン定義に載ることと使えることは別） | **未確認**。実機確認は初回の `/dify-deploy` | 使えなければその場で止め、`KNOWN_ISSUES.md` に `DI-xxx` を起票。代替は §2-7 の表（`env.yml` 2 行の変更） |
| **確認要 2** | Dify Cloud の export が付ける未知フィールド（`retry_config` など版依存） | **未確認**（実機の export を見ていない） | sync_back v1 は**そのまま通し**、差分要約に「マスタに無いキー」として出す。恒常的なものが判明したら別 PR で正規化ルールを足す |
| **確認要 3** | セルフホスト（`inhouse` / `customer-a`）で SiliconFlow に到達できるか（社内網の外部到達） | **未確認**（顧客 IT） | env の値はこのまま。到達不可なら `models.local`（ollama）と `overrides` で帯ごとに逃がす（DP-03） |
| **判断 1** | §2-3 の手順を **案 B**（マスタの 2 行だけ手で直し `render --check` で機械検証）にした。PM 指示は「render 出力をコピー」だったが、§1-5 の実測（プロンプトの block scalar が潰れる）により変更した | **PM 確認待ち（軽微・技術的理由）** | **案 B で進める**。検証強度は案 A と同じ（§1-3 F3）で、`git diff` が読める分だけ勝る |
| **判断 2** | §3-3 N1 を「env と一致しない dataset id も**除去**し、**件数のみ warn**（値は出さない）」とした。PM 指示の「他は warn」を、マスタに環境固有 id を残さない側に倒した具体化 | **PM 確認待ち（軽微）** | この形で進める |
| **判断 3** | §4-2 で `DEPLOY.md` §4 のトラブル表を KNOWN_ISSUES に**移さない**と決めた（予防ガイドと観測記録は役割が違う） | architect 判断（報告） | 移さない。§4 末尾にリンク 1 行 |
| **判断 4** | Wave 1 で PM が観測した事象を初期行に足すか | **PM が本人の記憶で追記**（implementer は伝聞で書かない） | 空のまま（DI-001〜003 の 3 行で開始） |
| **判断 5** | DP-40（`cloud-master` のリランク有効化） | **PM 判断待ち**（`decisions-pending.md` に起票） | W1 は現状維持（無効） |

---

## 13. Issue 案（`gh` が使えないため、PM がこの内容で起票する）

**タイトル**

```
既定 LLM を中国で使える Qwen / Kimi（SiliconFlow）に切り替え、Cloud 調整の DSL を Git に戻す仕組みと不具合台帳を作る
```

**本文**

```md
設計書: docs/handoff/2026-09-07-china-models-and-syncback.md
レーン: M/L（architect → implementer → reviewer）
基準コミット: 87d3cc3（main）
関連: #84（リポジトリ構成 v2 / env・render）・#82（Wave 1 KN-01・DC-01）・#98（Wave 2）・#3（export 方向）

## 何をするか

**A. 既定 LLM を SiliconFlow の Qwen / Kimi にする**（PM 決定 2026-09-07）
- 全 env で `models.chat` = `Qwen/Qwen3.5-397B-A17B`、`models.reasoning` = `Pro/moonshotai/Kimi-K2.6`
- 追加 role `kimi` / `qwen_small` を env に定義（`models.overrides` から参照。render.py の変更は不要）
- `embedding` は cloud-master のみ空（KB 作成時に画面で `BAAI/bge-m3` を選ぶと文書に明記）、inhouse / customer-a は `BAAI/bge-m3`
- マスタ DSL（KN-01・DC-01）の `name` / `provider` も同じ値に揃える。**`render.py --env cloud-master --all --check` が PASS すること**（CLAUDE.md §2-12）
- API キーとエンドポイントは Dify 側の画面に入れる。env.yml・DSL・PR には書かない（§2-10）

**B. Cloud で調整した DSL を Git に戻す `scripts/dify/sync_back.py`**
- export した YAML を正規化して `dify/apps/<番号>-<slug>.yml` に書き戻す（`dataset_ids` → `[]` / `dependencies` → `[]` / `version` → `0.6.0` / ブランド語彙の逆置換）
- モデルは戻さず、env と食い違ったら exit 1 で止まる。差分要約を stdout に出し、`render --check` 相当を自分で確認する
- ネットワークを呼ばない。`--env cloud-master` 以外は非対応（exit 2）。往復テスト付き

**C. `dify/KNOWN_ISSUES.md`（`DI-xxx` 連番）**
- 投入・テスト・Cloud 調整で**実際に出た**不具合を 1 行ずつ残す。DSL 修正 PR は本文で `DI-xxx` を参照
- 初期行は実在する 3 件（DI-001 kb_upload の embedding 未指定 / DI-002 render 出力の block scalar 潰れ / DI-003 render.py の関数二重定義）

## 受け入れ条件（抜粋。全文は設計書 §7）

- `python3 scripts/dify/render.py --env cloud-master --all --check` が **全件 `[OK]` / exit 0**
- `git diff --numstat dify/apps/` が **2 ファイルとも `3 3`**（先頭コメント＋`name`＋`provider` の 6 行しか変えない）
- `grep -rn "gpt-4o-mini" dify/` が **0 件**（`docs/dify/templates/**` は対象外＝残していい）
- `grep -n "siliconflow\.\(cn\|com\)" dify/env/*/env.yml` が **0 件**（URL を env に書かない＝ verify §12）
- `python3 scripts/dify/tests/test_sync_back.py` が **exit 0**、実行後 `git status --porcelain dify/apps/` が空
- `node tools/verify.mjs` PASS ／ `node tools/regress.mjs` **差分 0**（`--update` 禁止）／ `npm test` 緑

## 触らない範囲

- `mock/**`（regress 差分 0・`regress.baseline.json` を変えない）
- `tools/verify.mjs`（新 role は既存の §12 を素通りする。設計書 §1-4）
- `scripts/dify/{render,release,console_api,kb_upload,run_tests}.py`（sync_back は import して使うだけ）
- `dify/apps/*.yml` は先頭コメント L7 ＋ `name` ＋ `provider` の 6 行だけ。プロンプト・ノード・`app.description`・`version`・`dependencies`・`dataset_ids`・`reranking_*` は不変
- `dify/env/*/env.yml` は `models:` ブロックだけ
- `docs/dify/templates/*.yml`（外部出典・無改変）、`docs/dify/usecases/*.md` の 43 本
- `.claude/**` と `CLAUDE.md`（§2-12 の 1 行追記と `/dify-deploy` の更新は **PM が適用**。設計書 §2-4 A-6・§2-8 に文案）

## PR の分割案（直列。`dify/DEPLOY.md` で 3 本とも重なるため）

1. **PR-1 モデル既定の切替** — `dify/env/*/env.yml` ×3・`dify/apps/*.yml` ×2・`dify/env/README.md`・`dify/README.md`・`dify/DEPLOY.md` §0/§1/§4・`decisions-pending.md`（DP-01/DP-04/DP-40）・`pm-decisions.md` §12
2. **PR-2 `sync_back.py`** — `scripts/dify/sync_back.py`・`scripts/dify/tests/test_sync_back.py`・`dify/DEPLOY.md` §6・`implementation-guide.md` §7
3. **PR-3 `KNOWN_ISSUES.md`** — `dify/KNOWN_ISSUES.md`・`dify/README.md` ファイル表・`dify/DEPLOY.md` §4 末尾・`usecases/README.md`・`usecases/_TEMPLATE.md`

PR-2 と PR-3 はファイル集合がほぼ独立だが `dify/DEPLOY.md` で衝突するため直列にする。PR-1 は Wave 2（#98）の統合前に入れるのが望ましい（設計書 §11 に再適用手順）。

## PM 判断待ち

- **確認要**：§1-1 のモデルが PM のアカウントで実際に呼べるか（初回 `/dify-deploy` で実機確認。駄目なら代替は設計書 §2-7）
- **判断 1**：マスタ更新の手順を「render 出力のコピー」から「2 行を手で直し `render --check` で機械検証」に変えた（理由：`safe_dump` が System プロンプトの block scalar を潰す。設計書 §1-5・§2-3）
- **判断 2**：sync_back の `dataset_ids` は、env と一致しない id も除去し件数のみ warn（値は出さない）
- **DP-40**：`cloud-master` でリランクを有効にするか（W1 は現状維持を推奨）
- `CLAUDE.md` §2-12 の 1 行追記と `.claude/commands/dify-deploy.md` の更新は PM が適用
```
