# 既定 LLM を Qwen / Kimi（OpenRouter 経由）にする ＋ 環境台帳 ＋ Cloud 調整の Git 戻し ＋ 不具合台帳 ＋ 第 1 弾 DSL 修正

- Issue: 未起票（本書 §14 の「Issue 案」を PM が起票）
- レーン: **M/L**（`dify/env/**` の既定モデル・マスタ DSL 12 本・新スクリプト・`scripts/dify/kb_upload.py`・`CLAUDE.md` の load-bearing 追記提案に触る）
- 基準コミット: **`8e08b80`（main。#100 で Wave 2 の 10 本がマージ済み）**
- 版: **改訂 2（2026-09-07）**。初版（SiliconFlow を全 env の既定にする案）から、PM の契約実態（OpenRouter）と Wave 2 マージ・PM の Mac での実測結果を反映して書き直した
- 設計者: architect（実装しない）
- 関連: `docs/handoff/2026-09-07-repo-layout-v2.md`（#84。§3 env スキーマ・§4-1 R1〜R10・§4-3 render.py）／`CLAUDE.md` §2-10・§2-12・§2-13・§3・§5／Issue #82（第 1 弾 KN-01・DC-01 と**実機の観測記録**）／Issue #98・PR #100（第 2 弾 10 本）／**PR #96（未マージ。User-Agent 修正）**
- PM の言葉：「LLM は中国で使える LLM にして欲しい。個人的には Qwen と KIMI の新しいやつを使いたい」「**僕の契約は OpenRouter なので SiliconFlow はまだ切り替えなくて良い**」「**社内セルフホストは Ollama とかだと思う（未確認）**」「**基盤の各種環境の違いもメンテナンスしないといけないね**」「エクスポートして Git に入れておけば良いのか」「実装のときに出た不具合も記録してくれるよね？」

---

## 0. 目的（何が困っていて、何が解決すれば終わりか）

| 困りごと | 解決の形（本設計の完了形） |
|---|---|
| 既定モデルが `langgenius/openai/openai` `gpt-4o-mini` のままで、**PM の契約（OpenRouter）とも、顧客（中国拠点）の前提とも合っていない**。マスタは 12 本に増えたので、放置すると齟齬が 12 倍で広がる | **cloud-master とマスタ 12 本の既定を OpenRouter の Qwen / Kimi** にする。`render.py --env cloud-master --all --check` が **12 本すべて `[OK]`** のまま |
| 環境ごとの基盤（Cloud か selfhost か、どのプロバイダか、外に出られるか、**確認済みか未確認か**）が誰の頭の中にもあって、どこにも書かれていない | `dify/env/README.md` に**環境台帳**（env × edition × プロバイダ × モデル 4 種 × 外部到達 × 確認状態 × 確認日 × 根拠）を置き、`env.yml` を変えたら**同じ PR で台帳も更新**する |
| Dify Cloud の画面で直したプロンプト・ノードが、**Git のマスタに戻る道が無い** | `scripts/dify/sync_back.py` が export した YAML を正規化してマスタに書き戻し、差分要約を出し、`render --check` が通ることを自分で確認する |
| 第 1 弾の投入・テストで**実際に出た不具合**（Cloudflare 403・Rerank 429・1 行チャンク・誤答・言語・社外秘）が Issue コメントにしか無く、次の Wave で同じ罠を踏む | `dify/KNOWN_ISSUES.md` に `DI-xxx` の連番で残す（初期行 9 件）。DSL 修正 PR は本文で `DI-xxx` を参照する |
| 上の不具合のうち**直せるもの**（DSL のプロンプト・top_k、KB のチャンク・Rerank）が直っていない | 章 D（PR-4）で DSL 3 か所と `kb_upload.py` の `process_rule` / `reranking_enable` を直す |

**非目標**：モデルの品質ベンチマーク（DP-04 の日本語品質評価は別 Issue）／`mock/**` の変更／export 方向の**自動**取得（Console API 経由。Issue #3 に残る。sync_back は「人が画面から落としたファイル」を入力にする）／`inhouse`・`customer-a` の実機検証（**未確認のまま台帳に「未確認」と書くのが本設計の成果**）。

---

## 1. 前提として確認した事実

### 1-1. 利用可能なモデル（確認日・確認元）

**確認日 2026-09-07 / 確認元：`langgenius/dify-official-plugins` main ブランチの `models/<provider>/models/llm/_position.yaml` と各モデル定義（PM が取得）**

#### (a) OpenRouter — **cloud-master の既定（PM の契約先）**

| プラグイン | 版 | provider id | 使うモデル id |
|---|---|---|---|
| `models/openrouter` | **0.1.7** | `langgenius/openrouter/openrouter` | `qwen/qwen3.8-max`（最新主力・`mode: chat`・vision / tool-call 対応）／`qwen/qwen3.7-plus`／`qwen/qwen3.6-plus`／`qwen/qwen3.6-35b-a3b`（軽量）／`moonshotai/kimi-k3`（最新・context 1M）／`moonshotai/kimi-k2-0905` |

- OpenRouter プラグインは **customizable-model にも対応**（`_position.yaml` の一覧に無い id も、モデル設定画面で**手入力**して使える）。将来 id が増えたときに**プラグイン更新を待たずに切り替えられる**
- **1 契約で Qwen と Kimi の両方**に届く。API キーとルーティングの設定は Dify の「設定 → モデルプロバイダー」に入れるもので、**`env.yml` にも DSL にも書かない**

#### (b) SiliconFlow / Moonshot / Tongyi — **中国拠点（customer-a）と代替案のため**

| プラグイン | 版 | provider id | モデル |
|---|---|---|---|
| `models/siliconflow` | 0.0.59 | `langgenius/siliconflow/siliconflow` | `Qwen/Qwen3.5-397B-A17B` / `Qwen/Qwen3.6-27B` / `Qwen/Qwen3.6-35B-A3B` / `Qwen/Qwen3-235B-A22B-Instruct-2507` / `Pro/moonshotai/Kimi-K2.6` / `Pro/moonshotai/Kimi-K2.5` / `moonshotai/Kimi-K2-Thinking` / `moonshotai/Kimi-K2-Instruct`、埋め込み `BAAI/bge-m3`、リランク `BAAI/bge-reranker-v2-m3`。資格情報 `use_international_endpoint` で `api.siliconflow.cn`（既定）と `api.siliconflow.com` を切替 |
| `models/moonshot` | 0.1.12 | `langgenius/moonshot/moonshot` | `kimi-k3` / `kimi-k2.7-code` / `kimi-k2.6` / `kimi-k2.5` / `kimi-k2-thinking` |
| `models/tongyi` | 0.2.18 | `langgenius/tongyi/tongyi` | `qwen3.8-max` / `qwen3.7-plus` / `qwen3.6-plus` / `qwen3-max` / `kimi-k2.5` |

#### (c) Ollama — **inhouse（社内セルフホスト）の想定。未確認**

| プラグイン | 版 | provider id | 備考 |
|---|---|---|---|
| `models/ollama` | 1.0.1（公式） | `langgenius/ollama/ollama` | モデル名は**環境で入れたもの次第**なので `env.yml` には `${INHOUSE_CHAT_MODEL}` 等の環境変数で持つ。ベース URL は Dify 側の資格情報に入れる（`env.yml` に URL を書くと verify §12 が FAIL する。§1-4 V2） |

> **重要（DEPLOY.md にもこの注意書きを入れる）**：「プラグイン定義に載っている」＝「そのアカウント／エンドポイントで実際に使える」ではない。**実機の可用性は、cloud-master は初回 `/dify-deploy` で確認する。`inhouse` と `customer-a` は未確認のまま**（環境台帳に「未確認」と書く。§2-4）。

### 1-2. 現状の値（変更前。`8e08b80` 実測）

**マスタは 12 本**（`ls dify/apps/`）：`KN-01` `KN-02` `KN-03` `DC-01` `DC-02` `DC-04` `NM-03` `GN-01` `GN-02` `GN-05` `LG-01` `LG-04`

| 実測 | 値 |
|---|---|
| `llm` ノードの総数 | **13**（`LG-01` だけ 2 つ、他は 1 つずつ） |
| `question-classifier` / `parameter-extractor` | **0 本**（＝ R2・R4 は現時点でマスタのバイトに影響しない。`models.reasoning` が効くのは今後追加するアプリ） |
| `knowledge-retrieval` ノード | **4 本**（`KN-01` `KN-02` `KN-03` `GN-01`）。すべて `reranking_enable: false` / `reranking_model: {model:'', provider:''}`。`top_k` は KN-01 / KN-02 / GN-01 が **4**、KN-03 が **6** |
| モデル | 13 ノードすべて `provider: langgenius/openai/openai` / `name: gpt-4o-mini` / `mode: chat` / `completion_params: {temperature: 0.2}` |
| 先頭コメント | 12 本すべてに `# モデル   : openai / gpt-4o-mini を既定。…` の 1 行がある（行番号はファイルごとに違う：7〜15 行目） |
| `dify/kb/` | `KN-01` `KN-02` `KN-03` `GN-01` の 4 つ |
| `dify/tests/` | 12 本すべて分ある |

| env | chat | reasoning | embedding | rerank |
|---|---|---|---|---|
| `cloud-master` | `langgenius/openai/openai` `gpt-4o-mini` | 同左 | `''` | `''` |
| `inhouse` | `langgenius/openai/openai` `gpt-4o-mini` | 同左 | `langgenius/openai/openai` `text-embedding-3-small` | `''` |
| `customer-a` | `…/siliconflow` `Qwen/Qwen3-235B-A22B` | `…/siliconflow` `Qwen/Qwen3-32B` | `…/siliconflow` `BAAI/bge-m3` | `…/siliconflow` `BAAI/bge-reranker-v2-m3` |

`customer-a` の `Qwen/Qwen3-235B-A22B` と `Qwen/Qwen3-32B` は §1-1 (b) の一覧に**無い**（後継は `Qwen/Qwen3-235B-A22B-Instruct-2507`）。今回の更新で解消する。

### 1-3. `render.py` の仕様のうち、本設計が依存するところ（コードで確認）

| # | 事実 | 根拠（`scripts/dify/render.py`） |
|---|---|---|
| F1 | `llm` ノードの role は `override_map.get(nid, "chat")` → `models.get(role)`。**role 名は任意**。`models` 直下にキーを足せば `overrides` から参照できる（**render.py の変更は不要**） | L224-226 |
| F2 | `override_map` が使われるのは **`llm` ノードだけ**。`question-classifier` / `parameter-extractor` は常に `models.reasoning` 固定で、アプリ単位の差し替えができない | L217-250 |
| F3 | `--check` は「render 結果 `out_bytes` と**そのマスタ自身**を比較」。`rendered == data`（dict として等価）なら `out_bytes = raw_text` なので必ず一致。**`--check` PASS ＝「マスタの model ブロックが env の値と等価」の機械証明**。ファイルごとに `[OK]` / `[DIFF]` が出る | L495-505 |
| F4 | `rendered != data` のときだけ `dump_with_header()` が走り、`yaml.safe_dump` で**全文を再シリアライズ**する | L394-405 |
| F5 | `models.overrides` の `node_title` に一致するノードが 0 個なら `--strict` で exit 1 | L206-213 |
| F6 | `build_replace_table` が **2 か所で定義**されている（L157 の 1 引数版・L363 の 2 引数版。**後者が有効**） | L157 / L363 |
| **F7** | **`models.overrides` の `role` がその env の `models` に無いと、`models.get(role)` が空になり `provider`/`name` の条件を満たさないので、警告も出さずに<br>「マスタの値のまま」になる**（警告が出るのは `role == "chat"` かつ `models.chat` が空のときだけ） | L224-241 |

→ **F7 の帰結（設計に反映）**：`overrides` で使う role（`kimi` / `qwen_small` / `local`）は**全 env に定義する**。定義しない env があると、その環境だけ静かにマスタの既定モデルで動く。

### 1-4. `tools/verify.mjs` §12 が env.yml に課している制約（コードで確認）

| # | 制約 | 本設計への影響 |
|---|---|---|
| V1 | `models` の必須キーは `chat` / `reasoning` / `embedding` / `rerank` の**存在検査のみ**。未知キーの禁止は無い | **`kimi` / `qwen_small` を足しても verify.mjs の変更は不要**（L570・L594-596） |
| V2 | `cloud-master/env.yml` に書いてよい生 URL は `https://api.dify.ai/v1` と `https://cloud.dify.ai` の **2 つだけ**。他 env は生 URL 一切禁止。判定は**コメント行も含めたファイル全文** | **`openrouter.ai` / `api.siliconflow.cn` / Ollama のベース URL などを env.yml に書いてはいけない（コメントにも）。** エンドポイントの説明は `dify/env/README.md` と `dify/DEPLOY.md` に書く |
| V3 | 32 文字以上の英数字連続を「秘密の直値の疑い」で FAIL。ただし `${` を含む行は除外 | 今回入れるモデル名（`qwen/qwen3.8-max` 等）は 32 字連続を作らないので無害 |

### 1-5. `dify/apps/` を `render.py` の出力で置き換えると何が起きるか（実測）

`yaml.safe_dump(yaml.safe_load(KN-01))` を実行した結果、**System プロンプトの block scalar（`text: |-`）が 1 行の二重引用符文字列（`text: "あなたは…\n役割：…"`）に潰れる**ことを確認した（KN-01 全文が 6,573 バイトの再整形になる）。
`dify/README.md` の規約「System プロンプトは `docs/dify/usecases/<番号>.md` §5-1 を写す」と、PR で人がプロンプト差分を読む運用が壊れるため、**render 出力をそのままマスタにコピーする手順は採らない**（§2-3 案 B）。

### 1-6. PR #96（User-Agent）は**まだ main に入っていない**

`git branch -a --contains f04e607` の結果が `remotes/pr/96` のみ。main（`8e08b80`）には `User-Agent` の文字列が 1 か所も無い（`grep -rn "User-Agent" scripts/` が 0 件）。
→ **PR-4（`kb_upload.py` を触る）は PR #96 のマージ後に出す**（同じファイルの同じ関数を触るため）。KNOWN_ISSUES の DI-004 は「fixed（PR #96）」だが、**本設計の基準コミットでは未マージ**であることを行の備考に書く。

---

## 2. 章 A — 既定 LLM を OpenRouter の Qwen / Kimi にする ＋ 環境台帳

### 2-1. 決定（PM 決定。再検討しない）

| 項目 | 決定 | 理由 |
|---|---|---|
| **cloud-master のプロバイダ** | **`langgenius/openrouter/openrouter`**（SiliconFlow には**切り替えない**） | PM の契約が OpenRouter。1 契約で Qwen と Kimi の両方に届く。SiliconFlow は中国拠点で使うときの構成として §2-7 に残す |
| `models.chat`（R1 = `llm` ノード） | `qwen/qwen3.8-max`（`mode: chat` / `completion_params.temperature: 0.2` は**維持**） | 最新主力。vision / tool-call 対応で今後のノード追加にも耐える |
| `models.reasoning`（R2 分類器・パラメータ抽出／R4 単一検索の判定） | `moonshotai/kimi-k3` | Qwen と Kimi の両方が常に使われる構成。context 1M で長文の分類・抽出に向く。**現時点の 12 本には該当ノードが無い**ので、効くのは今後追加するアプリから |
| 追加 role `kimi` | `moonshotai/kimi-k3` | `models.overrides` の `role: kimi` でアプリ単位に生成側を Kimi へ振る |
| 追加 role `qwen_small` | `qwen/qwen3.6-35b-a3b` | 軽量・高速用（短文分類・整形） |
| `models.embedding` | **cloud-master は `''` のまま** | KB は画面で作る。埋め込みモデルはワークスペース既定に任せる（`kb_upload.py` は現状 `embedding_model` を渡さない＝ DI-001） |
| `models.rerank` | **cloud-master は `''` のまま（＝ `reranking_enable: false`）** | **DI-005 の実測**：UI で作った KB の Rerank 既定 ON（Cohere Rerank / OpenRouter 経由）が **429** になり検索 0 件になった。**DP-40 は「有効化しない」に寄せる**（§2-5） |
| `inhouse` | **`langgenius/ollama/ollama`**。モデル名は `${INHOUSE_CHAT_MODEL}` 等の環境変数。状態は**未確認** | PM「社内セルフホストは Ollama とかだと思う（未確認）」。実機に何が入っているか分からない以上、**具体名をリポジトリに書かない**のが正しい（`env.example` に変数名だけ足す） |
| `customer-a` | **SiliconFlow のまま**。モデル名だけ `Qwen/Qwen3.5-397B-A17B` / `Pro/moonshotai/Kimi-K2.6` に更新。状態は**未確認** | DP-01 (a)。旧型番が現行の一覧に無いため更新はする。実機は未確認 |
| **環境台帳** | `dify/env/README.md` に新設（§2-4） | PM「基盤の各種環境の違いもメンテナンスしないといけないね」。`env.yml` は機械が読む正、台帳は**人が読む正**（確認状態・確認日・根拠は env.yml に書けない） |
| API キー・ベース URL | **Dify 側の「設定 → モデルプロバイダー」に人が入れる。** `env.yml`・DSL・PR・チャットに書かない | `CLAUDE.md` §2-10。`env.yml` に URL を書くと verify §12 が FAIL（§1-4 V2） |
| `docs/dify/templates/*.yml` | **触らない** | 外部出典・無改変（`templates/README.md`）。雛形は参照用で実行資材ではない |

**アプリ単位で入れ替えたいとき**は `models.overrides`（`{ app, node_title, role }`）を使う。role は `chat` / `reasoning` / `kimi` / `qwen_small` / `local`（customer-a のみ）。**`overrides` が効くのは `llm` ノードだけ**（F2）。**使う role は全 env に定義する**（F7。定義漏れは静かにマスタの値のままになる）。

### 2-2. `dify/env/*/env.yml` の確定内容（この通りに置く）

**変えるのは `models:` ブロックだけ。** `dify` / `knowledge` / `brand` / `flags` / `variables` は 1 バイトも変えない。

#### `dify/env/cloud-master/env.yml` の `models:`

```yaml
models:
  chat:       { provider: langgenius/openrouter/openrouter, name: qwen/qwen3.8-max, mode: chat, completion_params: { temperature: 0.2 } }
  reasoning:  { provider: langgenius/openrouter/openrouter, name: moonshotai/kimi-k3, mode: chat }
  kimi:       { provider: langgenius/openrouter/openrouter, name: moonshotai/kimi-k3, mode: chat }        # overrides から role: kimi
  qwen_small: { provider: langgenius/openrouter/openrouter, name: qwen/qwen3.6-35b-a3b, mode: chat }      # 軽量・高速用
  embedding:  { provider: '', name: '' }        # KB は画面で作る。ワークスペース既定の埋め込みに任せる（DI-001）
  rerank:     { provider: '', name: '' }        # 空＝reranking_enable: false。Rerank は有効にしない（DI-005 / DP-40）
  overrides: []
```

#### `dify/env/inhouse/env.yml` の `models:`

```yaml
models:                                        # 社内セルフホストは Ollama 想定（2026-09-07 時点で未確認）。モデル名は環境変数で渡す
  chat:       { provider: langgenius/ollama/ollama, name: '${INHOUSE_CHAT_MODEL}', mode: chat, completion_params: { temperature: 0.2 } }
  reasoning:  { provider: langgenius/ollama/ollama, name: '${INHOUSE_REASON_MODEL}', mode: chat }
  kimi:       { provider: langgenius/ollama/ollama, name: '${INHOUSE_REASON_MODEL}', mode: chat }         # role を全 env に定義する（F7）
  qwen_small: { provider: langgenius/ollama/ollama, name: '${INHOUSE_SMALL_MODEL}', mode: chat }
  embedding:  { provider: langgenius/ollama/ollama, name: '${INHOUSE_EMBED_MODEL}' }
  rerank:     { provider: '', name: '' }
  overrides: []
```

#### `dify/env/customer-a/env.yml` の `models:`

```yaml
models:                                        # DP-01 (a)：中国拠点は SiliconFlow（エンドポイントは資格情報側で選ぶ）。2026-09-07 時点で未確認
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

> **`customer-a` の `overrides` に注意（確認要）**：`KN-03` は**もうマスタに存在する**（`dify/apps/KN-03-internal-rules-qa.yml`）。その `llm` ノードの `data.title` が `'LLM'` と一致しなければ `--strict` で exit 1 になる（F5）。implementer は `grep -n "title: " dify/apps/KN-03-internal-rules-qa.yml` で実際のタイトルを確認し、**`node_title` を実タイトルに合わせる**（`KN-04` はまだマスタに無いので、`ov.get("app") != code` で素通りする）。

#### `scripts/dify/env.example` に足す変数

```bash
# 社内セルフホスト（inhouse）の Ollama モデル名。実機に入っているモデル名を入れる（未確認）
INHOUSE_CHAT_MODEL=
INHOUSE_REASON_MODEL=
INHOUSE_SMALL_MODEL=
INHOUSE_EMBED_MODEL=
```

**禁止事項（verify §12 に直結）**：`openrouter.ai` / `api.siliconflow.cn` / Ollama のベース URL などの **URL を env.yml に書かない（コメント行も含めて）**。

### 2-3. マスタ DSL 12 本の変更手順（**この手順で行う。当てずっぽうで直さない**）

`CLAUDE.md` §2-12 の同一性（`render --check --env cloud-master` がマスタとバイト一致）を守るため、マスタの `llm` ノードのモデルも同じ値にする。

| 案 | 手順 | 判定 |
|---|---|---|
| 案 A | `render --env cloud-master --all` → `dify/build/cloud-master/*.yml` を `dify/apps/` に**コピー** | **採らない**。§1-5 の実測どおり System プロンプトの block scalar が潰れ、生成バナーがマスタに混入する |
| **案 B（採用）** | ① env.yml を先に直す ② `render --env cloud-master --all` で期待値を出す（コピーはしない） ③ 各マスタの `model:` ブロックの **`name:` と `provider:` の 2 行**＋**先頭コメントの「# モデル」行**だけを直す ④ `render --env cloud-master --all --check` が **12 本すべて `[OK]`**・exit 0 | **採用**。`--check` PASS は機械証明（F3）で案 A と検証強度は同じ。`git diff` が読める |
| 案 C | `render.py` に `--emit-master`（行単位の書き換え）を足す | 本 Issue では採らない。12 本 13 ノードは `--check` の `[DIFF]` を見ながら直せる範囲。**アプリが 30 本を超えて手作業が辛くなったら別 Issue** |

#### 変更内容（**行番号は書かない。`model:` ブロックと先頭コメントを目印にする**）

| 対象 | 変更前 | 変更後 |
|---|---|---|
| 全 12 本 × `llm` ノードの `data.model`（**計 13 か所**。`LG-01` だけ 2 か所） | `name: gpt-4o-mini`<br>`provider: langgenius/openai/openai` | `name: qwen/qwen3.8-max`<br>`provider: langgenius/openrouter/openrouter` |
| 全 12 本の先頭コメント（**各 1 行**） | `# モデル   : openai / gpt-4o-mini を既定。環境のプロバイダー（プロバイダ）に合わせて UI で変更する（dify/README.md）` | `# モデル   : openrouter / qwen/qwen3.8-max を既定（dify/env/cloud-master/env.yml の models.chat）。変えるときは env とマスタを同時に（dify/README.md）` |
| `question-classifier` / `parameter-extractor` ノード | （現在 0 本。今後追加されたら） | `name: moonshotai/kimi-k3` / `provider: langgenius/openrouter/openrouter`（＝ `models.reasoning`） |

- `completion_params: { temperature: 0.2 }` と `mode: chat` は**変えない**（env の `chat` と一致）
- `dataset_ids: []`・`reranking_enable: false`・`reranking_model`・`top_k`・`version: 0.6.0`・`dependencies: []`・`app.description` は**この PR では変えない**（`top_k` は章 D / PR-4）
- **`app.description` は触らない**（「インポート後に LLM ノードのモデルを選び直す」はプロバイダー未設定時の手順として今も正しい）
- 先頭コメントの変更は `--check` の判定に影響しない（`extract_header` が `#` ブロックをそのまま持ち回り、恒等時は生バイトを比較する）。それでも直すのは、マスタを読む人が古い既定値を信じないため
- **先頭コメントの文面はファイルごとに微妙に違う**（「プロバイダー」/「プロバイダ」）。`# モデル` で始まる行を 1 本ずつ置き換える

### 2-4. 環境台帳（`dify/env/README.md` に新設。この表と運用ルールをそのまま入れる）

`## 環境台帳（この表と `env.yml` は同じ PR で必ず一緒に更新する）` の見出しで、「モデル用途 4 種の意味」の**前**に置く。

| env | edition | 接続先の種類 | モデルプロバイダ | chat | reasoning | embedding | rerank | 外部到達 | 確認状態 | 確認日 | 根拠 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `cloud-master` | cloud | Dify Cloud（PM のワークスペース） | `langgenius/openrouter/openrouter` | `qwen/qwen3.8-max` | `moonshotai/kimi-k3` | （空＝ワークスペース既定） | （空＝無効） | OpenRouter に出られる | **確認済**（PM の契約） | 2026-09-07 | Issue #82 のコメント／本設計書 §1-1 |
| `inhouse` | selfhost | 社内セルフホスト（Community 1.15.x 想定） | `langgenius/ollama/ollama` | `${INHOUSE_CHAT_MODEL}` | `${INHOUSE_REASON_MODEL}` | `${INHOUSE_EMBED_MODEL}` | （空＝無効） | 外部 API に出られるか**未確認** | **未確認** | — | PM 談（2026-09-07）「Ollama とかだと思う」 |
| `customer-a` | selfhost | 顧客 A（中国拠点） | `langgenius/siliconflow/siliconflow` | `Qwen/Qwen3.5-397B-A17B` | `Pro/moonshotai/Kimi-K2.6` | `BAAI/bge-m3` | `BAAI/bge-reranker-v2-m3` | 越境 `deny`（`flags.cross_border`）。国外 API へは出さない前提 | **未確認** | — | DP-01 (a)／`decisions-pending.md` |

**台帳の書き方・更新ルール（README にそのまま書く）**

1. **`env.yml` を変えたら、同じ PR で台帳の行も更新する。** 片方だけの PR は reviewer が差し戻す（§10 の照合点 3）
2. **顧客の実名・実 URL・dataset id・API キー・メールを書かない**（`CLAUDE.md` §2-10）。接続先は「Dify Cloud」「社内セルフホスト」「顧客 A（中国拠点）」のような**種類**で書く。URL は `${VAR}` の名前すら書かなくてよい
3. **「確認状態」は 2 値**：`確認済`（**その環境で実際にアプリを動かし、モデルが呼べたことを人が見た**）／`未確認`。推測で `確認済` にしない。`確認日` は確認した日、`根拠` は Issue / PR のコメント URL か本設計書の節番号
4. モデルを**入れ替えたら確認状態は `未確認` に戻す**（同じ環境でも別モデルは別の話）
5. 機械検査でできるのは「`env.yml` に必須キーがある」「秘密・URL の直値が無い」まで（`tools/verify.mjs` §12）。**台帳と `env.yml` の値が一致しているかは reviewer が目で照合する**（§10）
6. 環境を足したら台帳に 1 行足す（`env.yml` を足す手順の 6 番目として明記）

### 2-5. DP-40（新設。`decisions-pending.md` の A 節末尾にこの 1 行を足す）

```md
| DP-40 | **`cloud-master` でリランクを有効にするか** | 現状 `models.rerank` は空＝`reranking_enable: false`。**実測（DI-005）**：UI で作った KB の Rerank 既定 ON（Cohere Rerank / OpenRouter 経由）が **HTTP 429** になり、KN-01 の検索が 0 件になった。Rerank を OFF にして回避済み。有効化するなら別プロバイダ（SiliconFlow `BAAI/bge-reranker-v2-m3` 等）の契約が要る | KN-01 KN-02 KN-03 GN-01（KB を引く 4 本）、PC-08 | 本設計 §2-1・`dify/KNOWN_ISSUES.md` DI-005、`2026-09-07-repo-layout-v2.md` §4-1 R3 | **有効化しない**（`rerank` は空のまま、`kb_upload.py` は `reranking_enable: false` を固定＝章 D）。精度が足りないときはまず `top_k` とチャンク設定で詰める（DI-006・DI-007） | PM |
```

### 2-6. 文書の更新（差し込む文案。この通りに入れる）

| # | ファイル | 変更 |
|---|---|---|
| A-1 | `dify/env/README.md` | 冒頭 3 行目の「`api.dify.ai / gpt-4o-mini` の既定値で動く 1 本」→「**`api.dify.ai / openrouter・qwen/qwen3.8-max` の既定値で動く 1 本**」。「書いてよい値／書いてはいけない値」表の「`cloud-master` の `api.dify.ai`・`gpt-4o-mini` など」→「`cloud-master` の `api.dify.ai`・`qwen/qwen3.8-max` など」。<br>**§2-4 の環境台帳を新設**。<br>「モデル用途 4 種の意味」表の下に追加：「**既定プロバイダは cloud-master が OpenRouter**（`langgenius/openrouter/openrouter`）。`chat` = `qwen/qwen3.8-max`、`reasoning` = `moonshotai/kimi-k3`。アプリ単位で振り替えるための追加 role **`kimi`**（kimi-k3）と **`qwen_small`**（`qwen/qwen3.6-35b-a3b`）を全 env に定義してある（**`overrides` の role がその env に無いと、警告も出ずにマスタの既定モデルのまま動く**ので、role は必ず全 env に置く）。`overrides` が効くのは `llm` ノードだけ。<br>OpenRouter プラグインは **customizable-model 対応**なので、一覧に無いモデル id もモデル設定画面で手入力して使える。<br>**API キーとベース URL は Dify の「設定 → モデルプロバイダー」に入れるもので、`env.yml` にも DSL にも書かない**（`CLAUDE.md` §2-10）。`env.yml` に URL を書くと `tools/verify.mjs` §12 が FAIL する。<br>`embedding` は `cloud-master` だけ空（KB 作成時のモデル指定はワークスペース既定に任せる）。**Rerank は有効にしない**（DP-40・DI-005）」 |
| A-2 | `dify/README.md` | 「規約」の「モデルは `openai / gpt-4o-mini` を既定で書き…」の行を差し替え：「モデルは **OpenRouter `qwen/qwen3.8-max`**（生成）を既定で書く。分類・抽出ノードを足すときは **`moonshotai/kimi-k3`**（`models.reasoning`）。既定値は `dify/env/cloud-master/env.yml` の `models` が正で、**変えるときは env とマスタを同時に**（`render.py --env cloud-master --all --check` が 12 本とも `[OK]` になること）。`dependencies` は空」<br>「インポート後にやること」表の 1 行目：「LLM ノードの**モデル**が DSL の指定（`openrouter / qwen/qwen3.8-max`）どおり選ばれているか確認する。選べない場合は**プロバイダー未設定**（設定 → モデルプロバイダーで OpenRouter を追加）」<br>KB の行に追記：「**ナレッジの「検索設定」で Rerank を OFF にする**（既定 ON のままだと OpenRouter 経由の Rerank が 429 になり検索 0 件。`dify/KNOWN_ISSUES.md` DI-005）。チャンクの区切りは `\n\n`・最大 1024 字（DI-006）」 |
| A-3 | `dify/DEPLOY.md` §0 前提 | 1 項追加：「- Dify Cloud の **設定 → モデルプロバイダー**で **OpenRouter プラグインを追加**し、API キーを登録済み。キーは画面に入れるもので、リポジトリにも環境変数にも置かない。**プラグイン定義に載っていることと、そのアカウントで実際に呼べることは別**なので、初回は LLM ノードのモデル一覧に `qwen/qwen3.8-max` と `moonshotai/kimi-k3` が出るかを目で確認する（出なければ止めて `KNOWN_ISSUES.md` に起票）。OpenRouter は customizable-model 対応なので、一覧に無い id は手入力もできる」 |
| A-4 | `dify/DEPLOY.md` §1-① 手順 3 | 「LLM ノードを開き、**モデルが `openrouter / qwen/qwen3.8-max` になっているか確認**する（DSL の指定どおり入っていれば変更不要）。空欄・エラーならプロバイダー未設定。**勝手に別のモデルに変えない**（変えるなら env とマスタを同時に直す＝`CLAUDE.md` §2-12）」 |
| A-5 | `dify/DEPLOY.md` §1 に **④「既存アプリを更新する（再インポート）」を新設** | 「マスタを直したあと、Cloud 上の既存アプリに反映する手順。<br>1. Studio でそのアプリを開く → 右上「…」→ **「DSL をインポート」**（既存アプリを上書き更新できるかは**版によるため確認要**。2026-09-07 時点で未確認）<br>2. 上書きできない版だった場合は、**新規アプリとして作成し、旧アプリの名前に `(old)` を付けて残す**（`/dify-deploy` の既定動作と同じ）。API キーは新アプリで再発行し、環境変数を差し替える<br>3. どちらの場合も **再インポート後に「公開」**し、KN-01 系は**知識検索ノードの KB 紐づけをやり直す**（`dataset_ids` は空で入るため）<br>4. 反映できたら `python3 scripts/dify/run_tests.py --env $DIFY_ENV <番号...>` を回し、結果を `dify/results/<env>/` に commit する」 |
| A-6 | `dify/DEPLOY.md` §4 トラブル表 | 「モデルのエラー（provider not found 等）」行を差し替え：原因「`openrouter` プラグイン未導入、またはそのアカウントで当該モデルが未提供」／対処「設定 → モデルプロバイダーで OpenRouter を追加。モデルが一覧に無ければ手入力（customizable-model）を試し、それでも駄目なら `KNOWN_ISSUES.md` に `DI-xxx` で起票して止まる」 |
| A-7 | `docs/dify/decisions-pending.md` | **DP-01 行末**に追記：「**決定（2026-09-07・PM）**：**cloud-master は OpenRouter**（PM の契約）で `chat` = `qwen/qwen3.8-max`、`reasoning` = `moonshotai/kimi-k3`。追加 role `kimi` / `qwen_small` を全 env に定義。**`inhouse` は Ollama 想定（未確認）**、**`customer-a` は SiliconFlow（未確認。型番を Qwen3.5-397B / Kimi-K2.6 に更新）**。(a) SiliconFlow への切替は中国拠点で使うときに行う（構成は `docs/handoff/2026-09-07-china-models-and-syncback.md` §2-7）。**環境ごとの確認状態は `dify/env/README.md` の環境台帳が正**」<br>**DP-04 行末**に追記：「**方針（2026-09-07・PM）**：日本語品質の第一候補は **`qwen/qwen3.8-max`**（OpenRouter 経由）。評価セット 20 件はこれを対象に採点する」<br>**A 節末尾に DP-40 を新設**（§2-5） |
| A-8 | `docs/handoff/2026-09-06-pm-decisions.md` | 末尾に §12 を新設（§2-8 の文案をそのまま） |
| A-9 | `CLAUDE.md` §2-12 | **PM が適用**。「どこで検出」の直前に 1 行追加：「・**既定モデルを変えるときは `dify/env/**/env.yml`・マスタ DSL・`dify/env/README.md` の環境台帳を同時に変える**（`render.py --env cloud-master --all --check` が全件 PASS すること）。手順は `docs/handoff/2026-09-07-china-models-and-syncback.md` §2-3」<br>あわせて §2-12 本文の例示「`langgenius/openai/openai` `gpt-4o-mini`」を「**`langgenius/openrouter/openrouter` `qwen/qwen3.8-max`**」に差し替える（`dataset_ids: []` はそのまま） |
| A-10 | `.claude/commands/dify-deploy.md` | **PM が適用**（`CLAUDE.md` §4 により architect も implementer も `.claude/**` を触らない）。文案は §2-9 |

### 2-7. 代替案（中国拠点で使うときの構成。今は切り替えない）

| | **採用（cloud-master）**：OpenRouter 1 契約 | 代替 1：SiliconFlow 1 契約（中国拠点・customer-a の既定） | 代替 2：Tongyi 直 ＋ Moonshot 直 |
|---|---|---|---|
| `models.chat` | `langgenius/openrouter/openrouter` `qwen/qwen3.8-max` | `langgenius/siliconflow/siliconflow` `Qwen/Qwen3.5-397B-A17B` | `langgenius/tongyi/tongyi` `qwen3.8-max` |
| `models.reasoning` | `…/openrouter` `moonshotai/kimi-k3` | `…/siliconflow` `Pro/moonshotai/Kimi-K2.6` | `langgenius/moonshot/moonshot` `kimi-k3` |
| `embedding` / `rerank` | 無し（ワークスペース既定 / Rerank OFF） | `BAAI/bge-m3` / `BAAI/bge-reranker-v2-m3`（同一プロバイダで完結） | どちらにも無い。別途 3 系統目が要る |
| 中国拠点からの到達 | **不可前提**（海外 API） | 可（`api.siliconflow.cn`） | 可 |
| 契約 | 1 系統（PM の現契約） | 1 系統 | 2〜3 系統 |
| 切替の手間 | — | **`env.yml` の `models` ブロックを差し替え**、§2-3 案 B でマスタを合わせる（`render --check` PASS まで） | 同上 |
| リスク | 中国拠点では使えない。Rerank が 429（DI-005） | 日本語品質の実測がまだ（DP-04） | 契約・請求・レート制限が分散 |

**この表は `dify/env/README.md` に転記しない**（設計書へのリンク 1 行に留め、README は運用手順と環境台帳に集中させる）。

### 2-8. `docs/handoff/2026-09-06-pm-decisions.md` に足す §12（この通り）

```md
## 12. 既定 LLM を Qwen / Kimi（OpenRouter）にする・環境台帳・不具合台帳（`2026-09-07-china-models-and-syncback.md`）の PM 判断 — 2026-09-07

- 要望：「LLM は中国で使える LLM にして欲しい。個人的には Qwen と KIMI の新しいやつを使いたい」「**僕の契約は OpenRouter なので SiliconFlow はまだ切り替えなくて良い**」「社内セルフホストは Ollama とかだと思う（未確認）」「基盤の各種環境の違いもメンテナンスしないといけないね」
- 事実確認：2026-09-07 に PM が `langgenius/dify-official-plugins` main の `models/<provider>` を取得（openrouter 0.1.7 / siliconflow 0.0.59 / moonshot 0.1.12 / tongyi 0.2.18 / ollama 1.0.1）

| # | 決定 |
|---|---|
| D-1 | **cloud-master は OpenRouter**（`langgenius/openrouter/openrouter`）。SiliconFlow には切り替えない |
| D-2 | `models.chat` = `qwen/qwen3.8-max`（temperature 0.2 維持）／`models.reasoning` = `moonshotai/kimi-k3` |
| D-3 | 追加 role **`kimi`**（kimi-k3）と **`qwen_small`**（`qwen/qwen3.6-35b-a3b`）を**全 env に**定義（role の定義漏れは警告なしでマスタの値のまま動くため） |
| D-4 | **`inhouse` は Ollama 想定・未確認**。モデル名は `${INHOUSE_*_MODEL}` の環境変数で渡し、`env.example` に変数を足す |
| D-5 | **`customer-a` は SiliconFlow のまま・未確認**。型番だけ現行の `Qwen/Qwen3.5-397B-A17B` / `Pro/moonshotai/Kimi-K2.6` に更新 |
| D-6 | **環境台帳を `dify/env/README.md` に新設**（env / edition / 接続先の種類 / プロバイダ / モデル 4 種 / 外部到達 / 確認状態 / 確認日 / 根拠）。`env.yml` を変えたら同じ PR で台帳も更新。実名・実 URL は書かない |
| D-7 | `embedding` は cloud-master のみ空。**Rerank は有効にしない**（OpenRouter 経由の Rerank が 429 で検索 0 件になった実測。DP-40） |
| D-8 | マスタ 12 本も同じ値に揃える。手順は「env を直す → render で期待値を確認 → `model:` ブロックの 2 行と先頭コメントを直す → `render --check` 全件 `[OK]`」（render 出力のコピーは prompt の block scalar を壊すため採らない） |
| D-9 | Cloud で調整した DSL は **`scripts/dify/sync_back.py` で Git のマスタへ戻す**（Cloud は編集場所、Git がマスタ）。他 env からの逆流は非対応。別セルフホストへは `release.py --env inhouse` で配る |
| D-10 | 実装で出た不具合は **`dify/KNOWN_ISSUES.md`**（`DI-xxx` 連番）に残す。初期行は **PM の Mac で実際に観測した 6 件＋コード実測 3 件の計 9 件**。`docs/dify/usecases/<番号>.md` §10 には要約を書かずリンクだけ |
| D-11 | 観測された不具合のうち直せるもの（DC-01 の出力言語・社外秘・番号生成、KN-01 の top_k、KB のチャンクと Rerank）は **PR-4「第 1 弾 DSL 修正」**でまとめて直し、PR 本文で `DI-xxx` を参照する（この運用の初回例にする） |

- `docs/dify/templates/*.yml` の `gpt-4o-mini` は触らない（外部出典・無改変）
- **確認要**：既存アプリへの上書きインポートが Cloud の版でできるか（できなければ新規作成＋旧を `(old)`）
- `CLAUDE.md` §2-12 の追記と `.claude/commands/dify-deploy.md` の更新は **PM が適用**
```

### 2-9. `.claude/commands/dify-deploy.md` の更新文案（**PM が適用**）

§1 の Chrome 依頼文（`>` 引用ブロック）を次に差し替える：

> Dify Cloud の Studio で「アプリを作成 → DSL ファイルをインポート → URL」を開き、`https://raw.githubusercontent.com/shoulang0729/dify/main/dify/apps/<ファイル名>.yml` を貼って作成。古いバージョンの警告はそのまま続行。**LLM ノードを開き、モデルが DSL の指定どおり `openrouter / qwen/qwen3.8-max`（分類・抽出ノードがあれば `moonshotai/kimi-k3`）になっているか確認する。空欄・エラー、またはモデル一覧に該当モデルが無い場合は、勝手に別のモデルを選ばずそこで止めて報告する**（設定 → モデルプロバイダーで OpenRouter の追加が要る。OpenRouter は id の手入力も可）。確認できたら公開。「API アクセス」で API キーを新規作成して表示。

§2（ナレッジ投入）の末尾に追加：

> KB を作ったら Chrome で**「検索設定」の Rerank を OFF** にする（既定 ON のままだと OpenRouter 経由の Rerank が 429 になり検索 0 件。`dify/KNOWN_ISSUES.md` DI-005）。チャンクの区切りは `\n\n`・最大 1024 字（DI-006）。

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

終了コード：`0` 正常 ／ `1` 正規化後に `render --check` 相当が通らない・逆置換が曖昧・モデルが env と食い違う ／ `2` 引数・環境不備。**ネットワークは一切呼ばない。**

### 3-2. 処理（順に実行。1 つでも決まらなければ止まる）

| # | 処理 | 詳細 |
|---|---|---|
| S1 | 管理番号の判定 | `--code` → `app.name` 先頭の `^([A-Z]{2}-\d{2})\b` → 入力ファイル名の `^([A-Z]{2}-\d{2})-`。決まらなければ **exit 2**（「`--code KN-01` を付けて再実行」と案内） |
| S2 | 対応するマスタの特定 | `dify/apps/<番号>-*.yml`。**0 件なら exit 2**（新規アプリの初登録は対象外。`<slug>` は人が決めるため） |
| S3 | 正規化（逆適用） | §3-3 の N1〜N5 |
| S4 | 書き出し | §3-4 |
| S5 | 差分要約を stdout へ | §3-4 |
| S6 | 自己検証 | 書き出したファイルを読み直し、`render_app()` が**恒等**（`rendered == data`）になることを確認。ならなければ **exit 1** し、どのルール（R1〜R9）で差が出たかを表示する（＝ `render.py --env cloud-master --check <番号>` と同じ判定を**同一コードで**行う） |

**実装方針**：`scripts/dify/render.py` から `load_env_raw` / `expand_env` / `build_replace_table` / `render_app` / `extract_header` / `dump_with_header` を **import して再利用**する（`release.py` が `console_api` を import しているのと同じ `sys.path.insert` の作法）。置換ロジックを二重実装しない。`build_replace_table` は 2 引数版が有効（F6）。

### 3-3. 正規化ルール

| # | 対象 | 戻し方 | 根拠 |
|---|---|---|---|
| N1 | `knowledge-retrieval` の `data.dataset_ids` | **常に `[]`。** env の `knowledge.<論理名>.id` と一致した id は黙って除去。一致しない id は **件数だけ warn**（`未知の dataset id を n 件除去しました（値は表示しません）`）。**値はログに出さない** | `CLAUDE.md` §2-12・§2-10。PM 指示「env と一致した分のみ、他は warn」を「除去はするが件数のみ warn・値はマスク」として具体化（マスタに環境固有 id を残さないことを優先） |
| N2 | `brand.replace` の語彙（`app.name` / `app.description` / ノードの `title` / `desc` / `prompt_template[].text`） | env の `replace` を **`to` → `from`** の向きで逆適用。`to` が空ならスキップ。**同じ `to` に複数の `from` が対応する（逆写像が一意でない）場合は置換せず warn して exit 1**。`cloud-master` は `replace: []` なので実質 no-op | R7 |
| N3 | `version` | env の `dify.dsl_version`（`0.6.0`）に強制 | R9・`dify/README.md` 規約 |
| N4 | `dependencies` | **`[]` に戻す**（Cloud の export はプラグイン識別子とハッシュを詰めてくる） | `dify/README.md` 規約・R10 |
| N5 | モデル（`llm` / 分類器の `data.model`・`reranking_model`） | **触らない**。S6 の自己検証で env と食い違えば **exit 1**（Cloud で人がモデルを変えていたら、env を直すかモデルを戻すかを人に決めさせる。sync_back が黙って上書きしない） | §2-1 の決定を道具が覆さないため |

**それ以外（ノードの追加・削除・座標・プロンプト本文・変数・`top_k`・`reranking_enable`）はそのまま通す。** それが「Cloud で調整した内容を戻す」ということ。
未知の付加フィールド（Cloud の版が増やしたキー）は v1 では**そのまま通し**、差分要約に「マスタに無いキー」として列挙する。恒常的に出るものが判明したら `KNOWN_ISSUES.md` に起票し、正規化ルール追加は別 PR（**確認要**：Cloud の export が何を付けるかは実機未確認）。

### 3-4. 書き出しと差分要約

- 既定の書き出し先は **マスタ `dify/apps/<番号>-<slug>.yml` を上書き**。`--dry-run` なら書かない、`--out` で別ディレクトリに出せる
- ダンパーは `render.py` の `dump_with_header()` を使い、**マスタ先頭の `#` コメントブロックを保つ**。ただし **複数行文字列を block scalar（`|-`）で出す representer を追加**した薄いラッパー `dump_master()` を使う（§1-5 の実測どおり、素の `safe_dump` は System プロンプトを 1 行に潰すため）。**生成バナー行は入れない**（マスタは生成物ではない）
- 上書き前に `git status --porcelain dify/apps/` を見て、対象ファイルに未コミットの変更があれば **warn**（止めはしない）
- 差分要約（stdout。**プロンプト本文は出さない**）：

```
sync_back: KN-01 ← ~/Downloads/KN-01 技術ナレッジQA.yml (env=cloud-master)
  ノード: 4 → 5  (+1 追加: llm 'ノード名' / -0 削除)
  モデル: llm 'LLM（根拠付き回答）' openrouter qwen/qwen3.8-max (変更なし)
  プロンプト: llm 'LLM（根拠付き回答）' system 1,240 → 1,388 字 (+148)
  version: 0.6.0 (N3 で強制)  dependencies: 3 件 → [] (N4)
  dataset_ids: 1 件 → [] (N1。env の KN-01 と一致)
  brand 逆置換: 0 件 (cloud-master は replace 空)
  マスタに無いキー: workflow.graph.nodes[3].data.retry_config
  [OK] render --env cloud-master --check 相当: 恒等（マスタとバイト一致）
  [WROTE] dify/apps/KN-01-tech-knowledge-qa.yml
```

### 3-5. 非対応と、その理由（DEPLOY.md にも 1 段落で書く）

- **`--env inhouse` / `--env customer-a` からの逆流は非対応**（exit 2）。理由：それらの DSL には env が入れた KB id・顧客ブランド語・環境固有モデルが焼き込まれており、**逆写像が一意でない**（複数の `from` が同じ `to` に潰れうる。N2）。マスタに顧客の実名や id が混入する事故を、道具の側で不可能にしておく
- **別のセルフホストへ展開するときは、エクスポートしたファイルを直接持ち込まない。** Git のマスタから `python3 scripts/dify/release.py --env inhouse --all` で作る。理由：env 差分（モデル・KB id・ブランド語・Start 変数の既定・フラグ）は `render.py` が入れるものなので、ある環境の完成品を別環境に貼ると**その環境の値が混ざったまま**になる

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

不具合・詰まりは `KNOWN_ISSUES.md` に `DI-xxx` で残す（§7）。
````

（`dify/DEPLOY.md` の導入部にも §6・§7 を足す。）

### 3-7. テスト `scripts/dify/tests/test_sync_back.py`

既存の `scripts/dify/tests/` は pytest ではなく単体で走るスクリプト（`mock_server.py`）なので、それに合わせる。

```
python3 scripts/dify/tests/test_sync_back.py     # exit 0 で全件 PASS。ネットワークを呼ばない。dify/apps は書き換えない
```

| # | 検査 | 内容 |
|---|---|---|
| T1 | **往復**（本命） | **マスタ 12 本すべて**について、`render --env cloud-master` 相当の出力を一時ディレクトリに置き `sync_back --out <tmp>` に通す → 出力の `yaml.safe_load` が**マスタの `safe_load` と dict として一致** |
| T2 | N1 | `dataset_ids` に `["dummy-id-1"]` を入れた擬似 export → 出力が `[]`。stdout に id の値が**出ていない** |
| T3 | N3・N4 | `version: 0.7.0` / `dependencies: [{...}]` の擬似 export → `0.6.0` / `[]` |
| T4 | N5 | `model.name` を別の値にした擬似 export → **exit 1**、メッセージに R1 が出る |
| T5 | 可読性 | 出力の `prompt_template[].text` が **block scalar（`text: \|-`）**で書かれている（`text: "…\n…"` になっていない）。§1-5 の退行防止 |
| T6 | 非対応 env | `--env customer-a` → **exit 2**、`dify/apps/` に書き込みが無い |
| T7 | 番号判定 | `app.name` が `KN-01 技術ナレッジQA` のファイルから `KN-01` が判定できる／判定できないファイルは exit 2 |
| T8 | 複数 llm | `LG-01`（`llm` 2 ノード）でも往復が成立する |

**テストは `dify/apps/` を書き換えない**（必ず `--out <tmpdir>`）。CI（`npm test`）には**入れない**（`CLAUDE.md` §3 のコマンド集合を変えない）。実行は implementer と reviewer が手で行い、結果を PR 本文に貼る。

### 3-8. `docs/dify/implementation-guide.md` への 1 行

- §7-1 手順 3 の末尾：「export し直したものを正とする → **`python3 scripts/dify/sync_back.py <export>.yml` でマスタ `dify/apps/` に書き戻す**（`dify/DEPLOY.md` §6）」
- §7-3 の末尾：「Cloud → git の**手動 export 経路**は `scripts/dify/sync_back.py` で正規化して取り込む（Issue #3 に残るのは Console API による**自動**取得のみ）」

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
- DSL・スクリプトを直す PR は本文に `DI-xxx` を書く。`/dify-deploy` の完了報告にも「KNOWN_ISSUES 追記: DI-xxx」を出す
- 秘密（API キー・Cookie・dataset id・顧客の実名）は書かない（`CLAUDE.md` §2-10）。エラー文は必要な範囲だけ引用する
- **自分が観測していない事象を伝聞で書かない**（症状・原因の精度が落ちると台帳の価値が消える）

| ID | 日付 | env | 管理番号 | 症状（1 行） | 原因 | 対処 | 状態 | Issue/PR |
|---|---|---|---|---|---|---|---|---|
```

### 4-2. 初期行 9 件（**実際に観測された事実のみ**。DI-004〜009 は PM の Mac での実測）

| ID | 日付 | env | 管理番号 | 症状（1 行） | 原因 | 対処 | 状態 | Issue/PR |
|---|---|---|---|---|---|---|---|---|
| DI-001 | 2026-09-07 | inhouse / customer-a | — | `env.yml` の `models.embedding` を指定しても KB 作成時に反映されず、ワークスペース既定の埋め込みモデルが使われる | `scripts/dify/kb_upload.py` が dataset 作成時に `embedding_model` / `embedding_model_provider` を Datasets API に渡していない | 当面は KB 作成時に画面で選ぶ。スクリプト対応は別 Issue（cloud-master は `embedding` が空なので実害なし） | open | 本設計書 §1-2 |
| DI-002 | 2026-09-07 | cloud-master | — | `render.py` の出力をマスタ `dify/apps/` にコピーすると、System プロンプトの block scalar が 1 行の `"…\n…"` に潰れてレビュー不能になる | `dump_with_header()` の `yaml.safe_dump` が複数行文字列を block scalar で出さない | マスタ更新は `model:` の 2 行だけ手で直し `render --check` で機械検証する（§2-3 案 B）。`sync_back.py` は block scalar representer を持つ（§3-4） | open | 本設計書 §1-5 |
| DI-003 | 2026-09-07 | — | — | `scripts/dify/render.py` に `build_replace_table` が 2 つ定義されている（L157 の 1 引数版・L363 の 2 引数版）。後者が有効で動作に影響は無いが、import して使うときに紛らわしい | 実装時の消し忘れ | 掃除は別 PR。sync_back からは 2 引数版を使う | open | 本設計書 §1-3 F6 |
| **DI-004** | 2026-09-07 | cloud-master | KN-01 DC-01 | `kb_upload.py` / `run_tests.py` が `api.dify.ai` に対して **HTTP 403（Cloudflare error code 1010）**。ブラウザからは同じキーで通る | 前段の Cloudflare が Python 標準の User-Agent（`Python-urllib/3.x`）をブラウザ署名で拒否する | 独自 UA（`dify-scripts/1.0 (+…)`）を付けて解消。curl で UA だけ変えて 403 → 200 を確認 | **fixed（PR #96。ただし基準コミット `8e08b80` では未マージ）** | [#82 コメント](https://github.com/shoulang0729/dify/issues/82#issuecomment-5572221151) / PR #96 |
| **DI-005** | 2026-09-07 | cloud-master | KN-01 | UI で作った KB の **Rerank が既定 ON**（Cohere Rerank / OpenRouter 経由）で **HTTP 429**、知識検索が **0 件**になり回答が定型文だけになる | Rerank モデルのレート制限。OpenRouter 経由の Rerank は実用に耐えなかった | ナレッジの検索設定で **Rerank を OFF** にして回避。恒久対応は `kb_upload.py` で `reranking_enable: false` を固定（章 D / PR-4）。`models.rerank` は空のまま（DP-40） | open | [#82 コメント](https://github.com/shoulang0729/dify/issues/82#issuecomment-5572221151) |
| **DI-006** | 2026-09-07 | cloud-master | KN-01 | UI 既定の区切り（`\n`）でインデックスすると **1 行 1 チャンク**になり、条件表・箇条書きが分断されて検索がほぼ効かない | Dify の既定チャンク設定が Markdown の表・箇条書きに合わない | 区切りを **`\n\n`・最大 1024 字**に変えて再索引したところ改善。恒久対応は `kb_upload.py` の `process_rule` を custom で固定（章 D / PR-4） | open | [#82 コメント](https://github.com/shoulang0729/dify/issues/82#issuecomment-5572221151) |
| **DI-007** | 2026-09-07 | cloud-master | KN-01 | `KN-01 T01`（ja）：推奨条件表のチャンクが `top_k: 4` に入らず、**類似条件の別文書から誤った条件を回答**した | 検索の取りこぼし（`top_k` が小さい／表チャンクに見出しが無く類似度が上がらない） | `top_k` を **4 → 8**、KB 文書の条件表チャンクに見出しを付ける（章 D / PR-4） | open | [#82 コメント](https://github.com/shoulang0729/dify/issues/82#issuecomment-5572221151) |
| **DI-008** | 2026-09-07 | cloud-master | DC-01 | `DC-01 T02`（zh）：入力 `lang: zh` でも**日本語で出力**され、期待する中国語見出し（`实绩` `课题` `对策`）が出ない | System の「成果物の言語は『出力言語』」が弱く、出力形式の指定（日本語の見出し）に負けている | System と User に**出力言語と中国語見出しを明示**する（章 D / PR-4） | open | [#82 コメント](https://github.com/shoulang0729/dify/issues/82#issuecomment-5572221151) |
| **DI-009** | 2026-09-07 | cloud-master | DC-01 | `DC-01 T06`（安全）：社外秘の単価を**丸ごと省略**して `※社外秘` が出ず、さらに**入力に無い参照番号 `CL-25-0907` `CL-25-0908` を生成**した | ルールの優先順位が読み取れず「社外秘は書かない」と解釈。`ref_ids` に入力外の番号を作る歯止めが無い | System でルールの優先順位を再掲し、社外秘は「値＋`※社外秘`」で残すこと・`ref_ids` は**入力に現れた番号だけ**に制約（章 D / PR-4） | open | [#82 コメント](https://github.com/shoulang0729/dify/issues/82#issuecomment-5572221151) |

**`dify/DEPLOY.md` §4 のトラブル表は KNOWN_ISSUES に移さない（architect 判断）。** §4 は「症状 → 原因の目安 → 対処」の**一般ガイド**（まだ起きていないことも含む予防表）、KNOWN_ISSUES は**実際に観測した記録**。役割が違うものを混ぜるとどちらも信用できなくなる。代わりに §4 の末尾に 1 行足す：

```md
実際に起きた不具合とその後の顛末は [`KNOWN_ISSUES.md`](./KNOWN_ISSUES.md)（`DI-xxx`）に残す。
```

### 4-3. 運用（各所に 1 行ずつ）

| 場所 | 追記 |
|---|---|
| `dify/README.md` の「ファイル」表 | `| KNOWN_ISSUES.md | 投入・テスト・Cloud 調整で**実際に出た**不具合の記録（`DI-xxx` 連番。設計時点のリスクは `docs/dify/usecases/<番号>.md` §10） |`（`CHANGELOG.md` の行の隣） |
| `docs/dify/usecases/README.md` の「読み方」表の下 | 「**実装で出た不具合は各ファイル §10 に書かず、`dify/KNOWN_ISSUES.md`（`DI-xxx`）に残す**。§10 は設計時点の未確定・リスク専用。§10 から参照するときはリンクだけ書き、症状の要約を二重に持たない」 |
| `docs/dify/usecases/_TEMPLATE.md` §10 | 「（実装・投入で**実際に出た**不具合は `../../../dify/KNOWN_ISSUES.md` の `DI-xxx`。ここには書かない）」 |
| `.claude/commands/dify-deploy.md` §3・§4 | **PM が適用**。§2-9 の文案 |

**既存 43 本の `usecases/*.md` は 1 バイトも触らない**（README と `_TEMPLATE.md` にルールを置けば足りる）。

---

## 5. 章 D — 第 1 弾で観測された不具合の修正（PR-4）

**この PR は `DI-005`〜`DI-009` を直す。** PR 本文に「`DI-005` `DI-006` `DI-007` `DI-008` `DI-009` に対応」と書く（`DI-xxx` 参照運用の初回例）。
**PR #96（User-Agent）のマージ後に出す**（`kb_upload.py` と `DEPLOY.md` が重なる。§1-6）。

### 5-1. `scripts/dify/kb_upload.py`（DI-005・DI-006）

| # | 変更 | 内容 |
|---|---|---|
| K1 | 文書アップロード時の `process_rule` を **custom 固定**にする | 現在の `{"indexing_technique": "high_quality", "process_rule": {"mode": "automatic"}}` を、区切り `\n\n`・最大 1024 字・`remove_extra_spaces` 有効の custom ルールに変える。値は**モジュール先頭の定数**（`CHUNK_SEPARATOR = "\n\n"` / `CHUNK_MAX_TOKENS = 1024`）で持ち、`--separator` / `--max-tokens` で上書きできるようにする |
| K2 | dataset 作成時に **Rerank を無効**にする | `POST /datasets` の本文に `retrieval_model`（`reranking_enable: false`・`search_method` は既定のまま・`top_k` は DSL 側が持つので送らない）を足す。**このフィールドを Datasets API が受け付けるかは実機未確認（確認要）**。受け付けない版だった場合は **(a) 400 の本文をそのまま表示して止まる のではなく (b) 警告を出して従来どおり作成し、「画面で Rerank を OFF にする」手順を最後に表示する**（KB が作れないほうが困るため） |
| K3 | `--dry-run` の出力を拡張 | KB 名に加えて **送信予定の `process_rule` と `retrieval_model` を表示**する（ネットワークは呼ばない）。reviewer がこれで設定値を確認できる |
| K4 | 既存 KB の扱い | 既存 KB を再利用する経路では `retrieval_model` を**変更しない**（既に作られた KB の設定を勝手に書き換えない）。代わりに「既存 KB の Rerank 設定は画面で確認すること（DI-005）」と 1 行ログを出す |

**`models.embedding` の受け渡し（DI-001）は本 PR では直さない。** cloud-master は `embedding` が空で実害が無く、`inhouse` / `customer-a` は未確認環境のため、直しても検証できない。DI-001 は `open` のまま残す。

### 5-2. `dify/apps/KN-01-tech-knowledge-qa.yml`（DI-007）

| # | 変更 | 内容 |
|---|---|---|
| M1 | `multiple_retrieval_config.top_k` | **4 → 8** |
| M2 | System プロンプト | 変更しない。**ルール 8「言語：ユーザーの入力言語で答える。日本語なら日本語、中国語なら中国語」は既に存在する**（実測）ので、「回答言語は質問の言語」の追記は**不要**。※ PM 指示にあった「KN-01 System に明記」は、実測の結果**既に満たされていた**ため対象外とした |

- `KN-02`・`GN-01` も `top_k: 4`、`KN-03` は `6` だが、**この PR では変えない**（それらの失敗はまだ観測されていない。観測してから DI を起票して直す）
- KB 文書側（`dify/kb/KN-01/*.md`）の**条件表チャンクに見出しを付ける**のも DI-007 の対処に含む。どの文書のどの表かは implementer が `dify/kb/KN-01/` を読んで判断し、**表の直前に `### <材質> <加工> 推奨条件` のような見出し行を足す**（数値は変えない。`data/world/` の値と食い違わせない＝`CLAUDE.md` §2-13。`npm run world` で確認）

### 5-3. `dify/apps/DC-01-hq-report-draft.yml`（DI-008・DI-009）

| # | 変更 | 内容 |
|---|---|---|
| M3（DI-008） | System の言語ルールを強くする | 現在の「- 成果物の言語は「出力言語」（ja／zh）。ja なら日本語の本社フォーマット、zh なら同じ章立ての中国語対照版を書く。」を次に差し替える：<br>「- **成果物の言語は「出力言語」が絶対。** 入力メモが中国語でも日本語でも、`ja` なら全文日本語、`zh` なら全文中国語で書く。<br>- **`zh` のときは見出しも中国語にする**：「## 1. 要旨」→「## 1. 要点」、「## 2. 実績」→「## 2. 实绩」、「## 3. 課題」→「## 3. 课题」、「## 4. 対策・見通し」→「## 4. 对策与展望」。指標名も中国語（生産数→产量、不良率→不良率、設備稼働率→稼动率、残業時間→加班）にする。<br>- ただし JSON 側の `name_ja` は**常に日本語の指標名**にする（本社の集計キーのため）。」 |
| M4（DI-008） | User プロンプトの末尾に 1 行 | 「**出力言語 `{{#1757240000001.lang#}}` で全文を書くこと（見出しを含む）。**」（変数参照は実ファイルの Start ノード id に合わせる） |
| M5（DI-009） | System のルール順を明示 | 「守るルール：」の直後に 1 行足す：「**ルールが衝突したら次の順で優先する：(1) 個人情報を書かない (2) 入力に無い数値・番号を作らない (3) 社外秘は値を残して `※社外秘` を付ける (4) 出力形式。**」 |
| M6（DI-009） | 社外秘の扱いを言い直す | 「- 社内単価・顧客契約額など社外秘の数値がメモに含まれる場合は、その数値の直後に「※社外秘」を付ける。」→「- 社内単価・顧客契約額など社外秘の数値がメモに含まれる場合は、**値を省略せずそのまま書き、直後に「※社外秘」を付ける**（省略・伏字にしない。読み手は本社の経営会議で、社外には配らない）。」 |
| M7（DI-009） | `ref_ids` の制約 | 「- 管理番号（CL-／ECR-／NC- など）は入力どおりに書く。新しい番号を作らない。」→「- 管理番号（CL-／ECR-／NC- など）は**入力メモに現れた文字列だけ**を書く。**JSON の `ref_ids` に入れてよいのは入力メモに現れた番号だけで、連番の推測・補完をしない**（例：`CL-25-0906` があっても `CL-25-0907` を作らない）。番号が無い課題は `ref_ids: []` にする。」 |

**プロンプト以外（ノード・変数・id・モデル）は触らない。** `app.description` も触らない。

### 5-4. 検証（PR-4 の受け入れ条件は §8 に。実機テストの扱い）

- **本 PR で機械的に検証できるのは「DSL が壊れていないこと」まで**：`python3 dify/check.py` OK ／ `render --env cloud-master --all --check` 全件 `[OK]`（プロンプト本文の変更は R7 の対象外なので恒等のまま）／`node tools/verify.mjs` PASS
- **実際に直ったかは Cloud での再テストでしか分からない**。PR-4 マージ後に `/dify-deploy` で **KN-01 と DC-01 を再インポート（§2-6 A-5 の手順）→ KB を作り直し → `run_tests.py --env cloud-master KN-01 DC-01`** を回し、`dify/results/cloud-master/` の結果を commit する。**その結果を見て `KNOWN_ISSUES.md` の DI-005〜009 を `fixed` に更新する PR を別途出す**（記録は「直した」ではなく「直って動いた」で閉じる）
- KB 文書を変えるので `npm run world`（`check-world.mjs`）を回し、**新しい数字・名前を増やしていない**ことを確認する（warn のみ。CI には入れない）

---

## 6. 変更ファイル一覧（章 → PR 割当）

| # | ファイル | 章 | 変更 | PR |
|---|---|---|---|---|
| 1 | `dify/env/cloud-master/env.yml` | A | `models:` を §2-2 に差し替え（OpenRouter） | PR-1 |
| 2 | `dify/env/inhouse/env.yml` | A | 同上（Ollama ＋ `${INHOUSE_*}`） | PR-1 |
| 3 | `dify/env/customer-a/env.yml` | A | 同上（SiliconFlow 型番更新・`kimi`/`qwen_small` 追加・`node_title` の実タイトル確認） | PR-1 |
| 4 | `dify/apps/*.yml`（**12 本**） | A | `llm` ノードの `name`/`provider`（計 13 か所）＋ 先頭コメント 1 行ずつ | PR-1 |
| 5 | `scripts/dify/env.example` | A | `INHOUSE_CHAT_MODEL` / `INHOUSE_REASON_MODEL` / `INHOUSE_SMALL_MODEL` / `INHOUSE_EMBED_MODEL` を追加 | PR-1 |
| 6 | `dify/env/README.md` | A | **環境台帳**（§2-4）＋ A-1 の文案 | PR-1 |
| 7 | `dify/README.md` | A | A-2 の文案 | PR-1 |
| 8 | `dify/DEPLOY.md` | A | §0 前提・§1-① 手順 3・**§1-④ 再インポート（新設）**・§4 トラブル表（A-3〜A-6） | PR-1 |
| 9 | `docs/dify/decisions-pending.md` | A | DP-01 / DP-04 に決定、A 節末尾に **DP-40** | PR-1 |
| 10 | `docs/handoff/2026-09-06-pm-decisions.md` | A | §12 を新設（§2-8） | PR-1 |
| 11 | `scripts/dify/sync_back.py` | B | **新規** | PR-2 |
| 12 | `scripts/dify/tests/test_sync_back.py` | B | **新規** | PR-2 |
| 13 | `dify/DEPLOY.md` | B | §6 を追記（§3-6） | PR-2 |
| 14 | `docs/dify/implementation-guide.md` | B | §7-1 手順 3・§7-3 に各 1 行（§3-8） | PR-2 |
| 15 | `dify/KNOWN_ISSUES.md` | C | **新規**（§4-1 の書式 ＋ §4-2 の 9 行） | PR-3 |
| 16 | `dify/README.md` | C | ファイル表に `KNOWN_ISSUES.md` の行 | PR-3 |
| 17 | `dify/DEPLOY.md` | C | §4 末尾に 1 行 | PR-3 |
| 18 | `docs/dify/usecases/README.md` / `_TEMPLATE.md` | C | 各 1 行（§4-3） | PR-3 |
| 19 | `scripts/dify/kb_upload.py` | D | K1〜K4（`process_rule` custom・`reranking_enable: false`・dry-run 拡張） | PR-4 |
| 20 | `dify/apps/KN-01-tech-knowledge-qa.yml` | D | `top_k` 4 → 8 | PR-4 |
| 21 | `dify/kb/KN-01/*.md` | D | 条件表チャンクに見出しを足す（数値は変えない） | PR-4 |
| 22 | `dify/apps/DC-01-hq-report-draft.yml` | D | System / User プロンプト（M3〜M7） | PR-4 |
| 23 | `dify/DEPLOY.md` | D | §2（KB 投入）に「Rerank OFF・チャンク `\n\n`/1024」の注記 | PR-4 |
| 24 | `CLAUDE.md` §2-12 | A | **PM が適用**（§2-6 A-9） | — |
| 25 | `.claude/commands/dify-deploy.md` | A・C | **PM が適用**（§2-9） | — |

---

## 7. 触らない範囲（reviewer の diff 監査の基準）

- **`mock/**` は 1 バイトも変えない**。`node tools/regress.mjs` の差分 **0**（`--update` 禁止）。データ層（8 分類 / 17 中分類 / 43 サービス / タグ）の件数・id 一覧は不変
- **`tools/verify.mjs` を変えない**（新 role は既存の §12 を通る。§1-4）／**`tools/regress.baseline.json`** を変えない
- **`scripts/dify/render.py` / `release.py` / `console_api.py` / `run_tests.py` を変えない**（sync_back は import して使うだけ。DI-002・DI-003 の修正は別 Issue）
  - ※ **`scripts/dify/kb_upload.py` は PR-4 の対象**（章 D。DI-005・DI-006）。PR-1〜PR-3 では触らない
- **PR-1 の `dify/apps/*.yml` の変更は `name` / `provider` / 先頭コメントだけ**。プロンプト・ノード・id・`app.description`・`version`・`dependencies`・`dataset_ids`・`reranking_*`・`top_k` は触らない（`top_k` とプロンプトは PR-4）
- **`dify/env/*/env.yml` の変更は `models:` ブロックだけ**。`dify` / `knowledge` / `brand` / `flags` / `variables` は触らない
- **`docs/dify/templates/*.yml`**（外部出典・無改変）・**`docs/dify/usecases/*.md` の 43 本**・`platform-components.md`・`feasibility-33-services.md`・既存の `docs/handoff/*.md`（本書と pm-decisions §12 を除く）
- **`.claude/agents/**`・`.claude/commands/**`・`CLAUDE.md`**（§2-6 A-9・§2-9 の文案は **PM が適用**）
- **`.github/workflows/*`**・`package.json`（`npm test` の中身を変えない）
- **秘密**：OpenRouter / SiliconFlow / Ollama の API キー・ベース URL・エンドポイントを `dify/env/**`・`dify/apps/**`・環境台帳・PR 本文・コミットメッセージに書かない
- **`dify/results/**` の既存ファイルを書き換えない**（テスト結果は追記のみ）

---

## 8. 受け入れ条件（機械検証できる形）

**全 PR 共通**：`node tools/verify.mjs` PASS ／ `node tools/regress.mjs` 差分 0 ／ `npm test` 緑。

**PR-1（モデル既定 ＋ 環境台帳）**

1. `python3 scripts/dify/render.py --env cloud-master --all --check` が **12 本すべて `[OK] マスタとバイト一致`** で **exit 0**
2. `git diff --numstat dify/apps/` が **11 本 `3 3`・`LG-01` だけ `5 5`**（先頭コメント 1 行 ＋ `llm` ノードごとに `name`/`provider` の 2 行）。それ以上変わっていたら不合格
3. `grep -rn "gpt-4o-mini" dify/` が **0 件**（`docs/dify/templates/**` は対象外＝残っていて正常）
4. `grep -c openrouter dify/env/cloud-master/env.yml` が **4**（chat / reasoning / kimi / qwen_small）。`grep -c ollama dify/env/inhouse/env.yml` が **5**（＋ embedding）。`grep -c siliconflow dify/env/customer-a/env.yml` が **6**
5. `grep -nE "https?://" dify/env/*/env.yml` が **cloud-master の既知 2 URL 以外 0 件**（verify §12 の URL 検査も PASS）
6. `python3 dify/check.py` が 12 本とも OK
7. `INHOUSE_*` を与えずに `python3 scripts/dify/render.py --env inhouse --all --strict` が **exit 1** で `INHOUSE_CHAT_MODEL` 等の**変数名だけ**を列挙（値は出ない）。ダミー値を与えれば **exit 0**
8. `python3 scripts/dify/render.py --env customer-a --all --strict`（ダミー環境変数あり）が **exit 0**。`models.overrides` の `KN-03` の `node_title` が実ノードと一致している（一致しなければ exit 1 になるので、この PASS 自体が証拠）
9. `dify/env/README.md` に**環境台帳**（3 行・確認状態列に `確認済` 1 / `未確認` 2）と、更新ルール 6 項がある
10. `docs/dify/decisions-pending.md` に **DP-40** があり、DP-01・DP-04 に「決定（2026-09-07・PM）」が入っている。`docs/handoff/2026-09-06-pm-decisions.md` に §12（D-1〜D-11）がある
11. `scripts/dify/env.example` に `INHOUSE_CHAT_MODEL` / `INHOUSE_REASON_MODEL` / `INHOUSE_SMALL_MODEL` / `INHOUSE_EMBED_MODEL` がある（値は空）

**PR-2（`sync_back.py`）**

12. `python3 scripts/dify/tests/test_sync_back.py` が **exit 0**（T1〜T8 全 PASS。T1 は**マスタ 12 本すべて**）。実行後 `git status --porcelain dify/apps/` が**空**
13. `python3 scripts/dify/sync_back.py dify/apps/KN-01-tech-knowledge-qa.yml --dry-run` が差分要約を出し、**何も書き込まない**。要約に `[OK] render --env cloud-master --check 相当: 恒等` が出る
14. `python3 scripts/dify/sync_back.py <任意の export> --env customer-a` が **exit 2**（非対応）で書き込まない
15. `grep -n "^import\|^from" scripts/dify/sync_back.py` に `render` からの import があり、置換ロジック（R1〜R9 相当）を**再実装していない**。`socket` / `urllib` / `http` の import が無い
16. `dify/DEPLOY.md` に §6 があり、(a) エクスポート → sync_back → `check.py` → `render --check` → PR の 5 手順 (b) 他 env 非対応の理由 (c) 別セルフホストは `release.py` で作る理由 が書かれている

**PR-3（`KNOWN_ISSUES.md`）**

17. `dify/KNOWN_ISSUES.md` が 9 列の表で始まり、**DI-001〜DI-009 の 9 行**がある。ID の重複・欠番が無い
18. DI-004〜DI-009 の「Issue/PR」列に `#82` のコメント URL がある。DI-004 の状態が `fixed` で、備考に「PR #96・基準コミットでは未マージ」が書かれている
19. `KNOWN_ISSUES.md` に `sk-` で始まる文字列・32 文字以上の英数字連続・顧客実名・dataset id が**無い**
20. `dify/README.md` のファイル表と `dify/DEPLOY.md` §4 末尾から `KNOWN_ISSUES.md` へのリンクがあり、リンク先が実在する。`docs/dify/usecases/*.md`（43 本）の diff が **0**（README と `_TEMPLATE.md` のみ）

**PR-4（第 1 弾 DSL 修正 ＋ kb_upload）**

21. `python3 scripts/dify/kb_upload.py --env cloud-master --dry-run KN-01` が **KB 名 ＋ 送信予定の `process_rule`（`separator: "\n\n"` / `max_tokens: 1024`）＋ `retrieval_model.reranking_enable: false`** を表示し、**ネットワークを呼ばない**
22. `git diff dify/apps/KN-01-tech-knowledge-qa.yml` が **`top_k: 4` → `top_k: 8` の 1 行だけ**
23. `git diff dify/apps/DC-01-hq-report-draft.yml` が **System / User の `text:` ブロック内だけ**（ノード・変数・id・モデル・`app.description` が動いていない）
24. `python3 dify/check.py` が 12 本とも OK ／ `python3 scripts/dify/render.py --env cloud-master --all --check` が **12 本すべて `[OK]`**（プロンプト変更後も恒等）
25. `node tools/check-world.mjs`（`npm run world`）で、`dify/kb/KN-01/` の変更によって**新規の人名・品番・数値が増えていない**（W1・W7・W8 の新規 warn がゼロ）
26. PR 本文に **`DI-005` `DI-006` `DI-007` `DI-008` `DI-009` に対応**と書かれている。**KNOWN_ISSUES の状態は `open` のまま**（実機で直ったのを確認してから別 PR で `fixed` にする）

---

## 9. implementer が実行するコマンド列

```bash
# --- 共通の起点 ---
git switch main && git pull --ff-only          # 8e08b80 以降
node tools/verify.mjs && node tools/regress.mjs

# ================= PR-1: モデル既定（OpenRouter）＋ 環境台帳 =================
git switch -c feat/<issue>-openrouter-models
# 1) dify/env/{cloud-master,inhouse,customer-a}/env.yml の models: を §2-2 に差し替え
#    customer-a の overrides は実タイトルを確認してから
grep -n "title: " dify/apps/KN-03-internal-rules-qa.yml | head
# 2) 期待値を render の出力で確認する（コピーはしない）
python3 scripts/dify/render.py --env cloud-master --all
grep -n -A5 "^        model:" dify/build/cloud-master/*.yml | head -40
# 3) マスタ 12 本の model ブロック（13 か所）と先頭コメント（12 行）を直す
grep -rn "gpt-4o-mini" dify/apps/            # 直す場所の一覧（25 行出る）
# 4) 機械検証
python3 scripts/dify/render.py --env cloud-master --all --check    # 12 本 [OK] / exit 0
git diff --numstat dify/apps/                                      # 11 本 "3 3"、LG-01 "5 5"
grep -rn "gpt-4o-mini" dify/                                       # 0 件
grep -nE "https?://" dify/env/*/env.yml                            # cloud-master の 2 URL のみ
python3 dify/check.py
python3 scripts/dify/render.py --env inhouse --all --strict        # exit 1（INHOUSE_* を列挙）
INHOUSE_CHAT_MODEL=x INHOUSE_REASON_MODEL=x INHOUSE_SMALL_MODEL=x INHOUSE_EMBED_MODEL=x \
  DIFY_BASE_URL=https://example.invalid DIFY_CONSOLE_URL=https://example.invalid \
  DIFY_DATASET_ID_KN01=x \
  python3 scripts/dify/render.py --env inhouse --all --strict      # exit 0（ダミー値。実キーは使わない）
# 5) 文書（§2-4 の環境台帳・§2-6 A-1〜A-8）
node tools/verify.mjs && node tools/regress.mjs && npm test
git add -A && git commit && git push -u origin HEAD

# ================= PR-2: sync_back.py =================
git switch main && git pull --ff-only && git switch -c feat/<issue>-sync-back
# scripts/dify/sync_back.py と scripts/dify/tests/test_sync_back.py を書く（§3）
python3 scripts/dify/tests/test_sync_back.py                       # exit 0（12 本の往復）
python3 scripts/dify/sync_back.py dify/apps/KN-01-tech-knowledge-qa.yml --dry-run
git status --porcelain dify/apps/                                  # 空
python3 scripts/dify/render.py --env cloud-master --all --check
node tools/verify.mjs && node tools/regress.mjs && npm test
git add -A && git commit && git push -u origin HEAD

# ================= PR-3: KNOWN_ISSUES.md =================
git switch main && git pull --ff-only && git switch -c feat/<issue>-known-issues
# dify/KNOWN_ISSUES.md（§4-1・§4-2 の 9 行）＋ 参照 3 か所（§4-3）
git diff --stat docs/dify/usecases/                                # README.md と _TEMPLATE.md だけ
node tools/verify.mjs && node tools/regress.mjs && npm test
git add -A && git commit && git push -u origin HEAD

# ================= PR-4: 第 1 弾 DSL 修正 ＋ kb_upload（PR #96 マージ後） =================
git switch main && git pull --ff-only && git switch -c feat/<issue>-first-wave-fixes
# scripts/dify/kb_upload.py（K1〜K4）／KN-01 top_k／dify/kb/KN-01 見出し／DC-01 プロンプト（M3〜M7）
python3 scripts/dify/kb_upload.py --env cloud-master --dry-run KN-01   # process_rule と retrieval_model が出る
python3 dify/check.py
python3 scripts/dify/render.py --env cloud-master --all --check     # 12 本 [OK]
npm run world                                                       # 新規 warn がゼロ
node tools/verify.mjs && node tools/regress.mjs && npm test
git add -A && git commit && git push -u origin HEAD
```

**やらないこと**：`node tools/regress.mjs --update`（データ層は変わらない）／`dify/build/**` の commit（`.gitignore` 済み）／実 API キーを使った実行（本 Issue の検証は**すべてネットワーク無し**で完結する。実機テストは PR-4 マージ後の `/dify-deploy`）。

---

## 10. reviewer の照合点

| # | 見るもの | 合格の形 |
|---|---|---|
| 1 | `git diff dify/apps/`（PR-1） | 先頭コメント 12 行 ＋ `name`/`provider` 26 行**だけ**。プロンプト・ノード・id・`app.description`・`version`・`dependencies`・`top_k` が動いていない |
| 2 | `git diff dify/env/` | `models:` ブロック**だけ**。`knowledge` / `brand` / `flags` / `variables` / `dify` が動いていない。URL・キーが入っていない |
| 3 | **環境台帳と `env.yml` の突き合わせ**（機械検査できない範囲） | 台帳 3 行の provider / chat / reasoning / embedding / rerank が `env.yml` の値と**一致**。確認状態が `cloud-master` = 確認済、`inhouse` / `customer-a` = 未確認。実名・実 URL が無い |
| 4 | `python3 scripts/dify/render.py --env cloud-master --all --check` | 自分の手で実行して **12 本 `[OK]` / exit 0**（PR 本文の主張を信じない） |
| 5 | `node tools/regress.mjs` / `node tools/verify.mjs` | 差分 0 ／ PASS。`regress.baseline.json` と `tools/**` が diff に**入っていない** |
| 6 | `scripts/dify/sync_back.py`（PR-2） | `render.py` から import して再利用／ネットワーク系の import が無い／`--env cloud-master` 以外は exit 2 ／`--dry-run` が書き込まない |
| 7 | `python3 scripts/dify/tests/test_sync_back.py` | 自分の手で実行して exit 0。実行後 `git status` が空 |
| 8 | `dify/KNOWN_ISSUES.md`（PR-3） | 9 行が**実在する事実**（DI-001・DI-003 は grep で、DI-002 は `safe_dump` の挙動で、DI-004〜009 は #82 コメントで確認できる）。秘密・顧客実名・dataset id が無い。DI-004 の「PR #96 未マージ」の但し書きがある |
| 9 | `git diff scripts/dify/kb_upload.py`（PR-4） | `process_rule` が custom 固定（`\n\n` / 1024）／dataset 作成に `reranking_enable: false`／**既存 KB の設定を書き換えていない**／`--dry-run` がネットワークを呼ばない |
| 10 | `git diff dify/apps/DC-01-hq-report-draft.yml`（PR-4） | `text:` ブロック内だけ。M3〜M7 の 5 点が入っている。**日本語・中国語の見出し対応が §5-3 の表どおり**（`要点` / `实绩` / `课题` / `对策与展望`） |
| 11 | `npm run world`（PR-4） | `dify/kb/KN-01/` の変更で新規の人名・品番・数値が増えていない |
| 12 | `.claude/**` と `CLAUDE.md` | **diff が空**（PM が適用する範囲。PR に入っていたら差し戻す） |
| 13 | PR 本文 | 設計書パス・実行した検証コマンドの出力・触っていない範囲。PR-4 は `DI-005`〜`DI-009` を参照。`--update` を使っていない |

---

## 11. verify / regress への影響

| ツール | 影響 | 根拠 |
|---|---|---|
| `tools/verify.mjs` §12 | **変更不要。** `REQUIRED_MODELS` は 4 キーの存在検査のみで、未知キー（`kimi` / `qwen_small` / `local` / `overrides`）を禁止していない | §1-4 V1 |
| 同 §12 の URL 検査 | **制約になる。** `cloud-master` は既知 2 URL 以外を許さず、他 env は生 URL を一切許さない（**コメント行も対象**）。OpenRouter / SiliconFlow / Ollama の URL を env.yml に書かない | §1-4 V2 |
| 同 §12 の秘密検出 | 影響なし（モデル名は 32 字連続を作らない。`${VAR}` 行は除外される） | §1-4 V3 |
| 同 §11（索引の鮮度） | 影響なし。`SVCS` も `docs/dify/usecases/*.md` の本数も変わらないので `npm run index` は不要 | — |
| `tools/regress.mjs` | **差分 0 のまま**（`mock/js/data/**` を触らない）。**`--update` は禁止** | `CLAUDE.md` §2-9・§3 |
| `tools/check-world.mjs` | PR-4 で `dify/kb/KN-01/` を触るので **`npm run world` を回す**（warn のみ。CI には入れない）。新規 warn を増やさないことが受け入れ条件 25 | `CLAUDE.md` §2-13 |
| `npm test` / CI `verify` | 内容も定義も変えない。`test_sync_back.py` は CI に入れない | `CLAUDE.md` §3 |

---

## 12. 今後アプリを足すときの手順（Wave 2 は #100 でマージ済み）

Wave 2（#98）は **PR #100 で main にマージ済み**（`8e08b80`。10 本追加で計 12 本）。本設計の PR-1 はその 12 本を対象にする。以降、アプリを足すときは：

```bash
python3 scripts/dify/render.py --env cloud-master --all           # 期待値を dify/build/cloud-master/ に出す
python3 scripts/dify/render.py --env cloud-master --all --check   # [DIFF] が出たファイルが直す対象
#   → [DIFF] のファイルだけ model ブロックを build 側の値に合わせる
python3 scripts/dify/render.py --env cloud-master --all --check   # 全件 [OK] / exit 0 になるまで
python3 dify/check.py
```

- **新しいアプリは最初から `openrouter / qwen/qwen3.8-max` で書く**（`dify/README.md` の規約。先頭コメントの「# モデル」行も同じ値に）
- **`question-classifier` / `parameter-extractor` を持つアプリ**は `--check` が R2 で `[DIFF]` を出す。そのノードのモデルを **`moonshotai/kimi-k3` / `langgenius/openrouter/openrouter`** に合わせる（`models.reasoning`）
- `--check` はファイルごとに `[OK]` / `[DIFF]` を出すので、何本になっても手順は同じ。**30 本を超えて手作業が辛くなったら §2-3 案 C（`render.py --emit-master`）を別 Issue で検討**

---

## 13. PM 判断待ち・確認要

| # | 論点 | 状態 | 既定（回答が無ければこれで進む） |
|---|---|---|---|
| **確認要 1** | §1-1 (a) のモデルが **PM の OpenRouter アカウントで実際に呼べるか** | **未確認**。初回 `/dify-deploy` で実機確認 | 呼べなければ止めて `KNOWN_ISSUES.md` に起票。OpenRouter は customizable-model 対応なので id 手入力も試す |
| **確認要 2** | **既存アプリへの上書きインポート**が Cloud の版でできるか（§2-6 A-5） | **未確認** | できなければ新規作成＋旧アプリに `(old)`。手順は両方 DEPLOY.md に書く |
| **確認要 3** | `POST /datasets` が `retrieval_model.reranking_enable` を受け付けるか（K2） | **未確認** | 受け付けない版なら警告を出して従来どおり作成し、「画面で Rerank を OFF」の手順を表示する |
| **確認要 4** | `inhouse` の実体（本当に Ollama か・外部 API に出られるか・どのモデルが入っているか） | **未確認**（PM 談） | env は `${INHOUSE_*}` のまま。台帳は「未確認」。実機が分かった時点で台帳＋`env.yml` を同じ PR で更新 |
| **確認要 5** | `customer-a` の実体（SiliconFlow の契約・エンドポイント・到達性） | **未確認** | 同上。DP-01 (a) の想定のまま |
| **確認要 6** | Cloud の export が付ける未知フィールド（`retry_config` など） | **未確認** | sync_back v1 はそのまま通し、差分要約に「マスタに無いキー」として出す |
| **判断 1** | §2-3 の手順を **案 B**（マスタの行を手で直し `render --check` で機械検証）にした。§1-5 の実測（プロンプトの block scalar が潰れる）による | **PM 確認待ち（軽微・技術的理由）** | 案 B で進める。検証強度は案 A と同じ（F3） |
| **判断 2** | §3-3 N1：env と一致しない dataset id も**除去**し、**件数のみ warn**（値は出さない） | **PM 確認待ち（軽微）** | この形で進める |
| **判断 3** | §4-2：`DEPLOY.md` §4 のトラブル表は KNOWN_ISSUES に**移さない**（予防ガイドと観測記録は役割が違う） | architect 判断（報告） | 移さない。§4 末尾にリンク 1 行 |
| **判断 4** | §5-2：PM 指示「KN-01 System に『回答言語は質問の言語』を明記」は、**実測の結果ルール 8 に既にある**ため対象外にした（DI-008 は DC-01 の事象） | architect 判断（報告） | KN-01 は `top_k` と KB 見出しのみ |
| **判断 5** | §5-2：`KN-02` `GN-01`（`top_k: 4`）・`KN-03`（`6`）は**変えない**（失敗が観測されていない） | architect 判断（報告） | 観測してから DI を立てて直す |
| **判断 6** | DP-40：`cloud-master` の Rerank は**有効化しない**（DI-005） | **PM 判断待ち**（`decisions-pending.md` に起票） | 有効化しない |
| **判断 7** | PR-4 では `models.embedding` の受け渡し（DI-001）を直さない（cloud-master で実害が無く、他 env は未確認で検証できない） | architect 判断（報告） | DI-001 は `open` のまま |

---

## 14. Issue 案（`gh` が使えないため、PM がこの内容で起票する）

**タイトル**

```
既定 LLM を OpenRouter の Qwen / Kimi にする ＋ 環境台帳 ＋ Cloud 調整の Git 戻し ＋ 不具合台帳 ＋ 第 1 弾 DSL 修正
```

**本文**

````md
設計書: docs/handoff/2026-09-07-china-models-and-syncback.md（改訂 2）
レーン: M/L（architect → implementer → reviewer）
基準コミット: 8e08b80（main。#100 で Wave 2 の 10 本がマージ済み＝マスタ 12 本）
関連: #84（env・render）・#82（第 1 弾と実機の観測記録）・#98 / #100（第 2 弾）・**#96（未マージ。User-Agent）**・#3（export 方向）

## 何をするか

**A. 既定 LLM を OpenRouter の Qwen / Kimi にする ＋ 環境台帳**（PM 決定 2026-09-07）
- cloud-master は **OpenRouter**（PM の契約。SiliconFlow には切り替えない）。`chat` = `qwen/qwen3.8-max`、`reasoning` = `moonshotai/kimi-k3`
- 追加 role `kimi` / `qwen_small` を**全 env に**定義（role の定義漏れは警告なしでマスタの値のまま動くため。render.py の変更は不要）
- `inhouse` は **Ollama 想定・未確認**（モデル名は `${INHOUSE_*_MODEL}`、`env.example` に変数追加）。`customer-a` は **SiliconFlow・未確認**（型番のみ現行に更新）
- **`dify/env/README.md` に環境台帳を新設**（env / edition / 接続先の種類 / プロバイダ / モデル 4 種 / 外部到達 / 確認状態 / 確認日 / 根拠）。`env.yml` を変えたら同じ PR で台帳も更新。実名・実 URL は書かない
- マスタ **12 本 13 ノード**も同じ値に揃える。**`render.py --env cloud-master --all --check` が 12 本すべて `[OK]`**（CLAUDE.md §2-12）
- Rerank は有効にしない（OpenRouter 経由の Rerank が 429 だった実測 → **DP-40** を起票）

**B. `scripts/dify/sync_back.py`（Cloud → Git）**
- export した YAML を正規化してマスタに書き戻す（`dataset_ids` → `[]` / `dependencies` → `[]` / `version` → `0.6.0` / ブランド語彙の逆置換）
- モデルは戻さず、env と食い違えば exit 1 で止まる。差分要約を出し、`render --check` 相当を自分で確認。ネットワークを呼ばない
- `--env cloud-master` 以外は非対応（exit 2）。マスタ 12 本の往復テスト付き

**C. `dify/KNOWN_ISSUES.md`（`DI-xxx` 連番）— 初期行 9 件**
- DI-001〜003：コードの実測（kb_upload の embedding 未指定 / render 出力の block scalar 潰れ / render.py の関数二重定義）
- **DI-004〜009：PM の Mac で実際に観測**（Cloudflare 403 error 1010 ／ KB の Rerank 既定 ON が 429 で検索 0 件 ／ 既定チャンク `\n` で 1 行チャンク ／ KN-01 T01 の誤答 ／ DC-01 T02 が zh 指定でも日本語 ／ DC-01 T06 の社外秘省略と番号生成）。出典は #82 のコメント

**D. 第 1 弾 DSL 修正（PR-4。`DI-005`〜`DI-009` に対応）**
- `kb_upload.py`：`process_rule` を custom 固定（区切り `\n\n`・最大 1024 字）、dataset 作成時に `reranking_enable: false`、`--dry-run` で送信内容を表示
- `KN-01`：`top_k` 4 → 8、KB 文書の条件表チャンクに見出し
- `DC-01`：出力言語の絶対化と中国語見出しの明示、ルール優先順位の再掲、社外秘は「値＋※社外秘」、`ref_ids` は入力に現れた番号だけ

## 受け入れ条件（抜粋。全文は設計書 §8）

- `python3 scripts/dify/render.py --env cloud-master --all --check` が **12 本すべて `[OK]` / exit 0**
- `git diff --numstat dify/apps/` が **11 本 `3 3`・LG-01 だけ `5 5`**
- `grep -rn "gpt-4o-mini" dify/` が **0 件**（`docs/dify/templates/**` は対象外＝残していい）
- `grep -nE "https?://" dify/env/*/env.yml` が cloud-master の既知 2 URL 以外 **0 件**
- `INHOUSE_*` 未設定で `render --env inhouse --all --strict` が **exit 1**（変数名だけ列挙・値は出ない）
- `python3 scripts/dify/tests/test_sync_back.py` が **exit 0**（マスタ 12 本の往復）、実行後 `git status --porcelain dify/apps/` が空
- `kb_upload.py --dry-run KN-01` が `process_rule` と `retrieval_model.reranking_enable: false` を表示し、ネットワークを呼ばない
- `node tools/verify.mjs` PASS ／ `node tools/regress.mjs` **差分 0**（`--update` 禁止）／ `npm test` 緑 ／ PR-4 は `npm run world` で新規 warn ゼロ

## 触らない範囲

- `mock/**`（regress 差分 0・`regress.baseline.json` を変えない）／`tools/**`（verify §12 は変更不要）
- `scripts/dify/{render,release,console_api,run_tests}.py`（sync_back は import して使うだけ）。**`kb_upload.py` は PR-4 のみ対象**
- PR-1 の `dify/apps/*.yml` は先頭コメント ＋ `name` / `provider` だけ（プロンプト・`top_k` は PR-4）
- `dify/env/*/env.yml` は `models:` ブロックだけ
- `docs/dify/templates/*.yml`（外部出典・無改変）、`docs/dify/usecases/*.md` の 43 本
- `.claude/**` と `CLAUDE.md`（§2-12 の追記と `/dify-deploy` の更新は **PM が適用**。文案は設計書 §2-6 A-9・§2-9）
- API キー・ベース URL を env.yml・台帳・PR 本文に書かない

## PR の分割案（直列。`dify/DEPLOY.md` で 4 本とも重なる）

1. **PR-1 モデル既定（OpenRouter）＋ 環境台帳** — `dify/env/*/env.yml` ×3・`dify/apps/*.yml` ×12・`env.example`・`dify/env/README.md`（台帳）・`dify/README.md`・`dify/DEPLOY.md`・`decisions-pending.md`（DP-01/DP-04/DP-40）・`pm-decisions.md` §12
2. **PR-2 `sync_back.py`** — `scripts/dify/sync_back.py`・`tests/test_sync_back.py`・`DEPLOY.md` §6・`implementation-guide.md` §7
3. **PR-3 `KNOWN_ISSUES.md`** — `dify/KNOWN_ISSUES.md`（9 行）・`dify/README.md` ファイル表・`DEPLOY.md` §4 末尾・`usecases/README.md` / `_TEMPLATE.md`
4. **PR-4 第 1 弾 DSL 修正 ＋ kb_upload** — `scripts/dify/kb_upload.py`・`dify/apps/KN-01…yml`（top_k）・`dify/kb/KN-01/*.md`・`dify/apps/DC-01…yml`（プロンプト）・`DEPLOY.md` §2。**PR #96 のマージ後**（同じファイルを触る）

PR-4 マージ後に `/dify-deploy` で KN-01・DC-01 を再インポート → KB 作り直し → `run_tests.py` を回し、**直って動いたのを確認してから** KNOWN_ISSUES の DI-005〜009 を `fixed` にする PR を別途出す。

## PM 判断待ち

- **確認要**：OpenRouter で当該モデルが実際に呼べるか／既存アプリへの上書きインポートの可否／`POST /datasets` が `retrieval_model` を受け付けるか／`inhouse`・`customer-a` の実体
- **判断 1**：マスタ更新は「render 出力のコピー」ではなく「行を直して `render --check` で機械検証」（`safe_dump` が System プロンプトの block scalar を潰す実測による）
- **判断 2**：sync_back の `dataset_ids` は env と一致しない id も除去し件数のみ warn（値は出さない）
- **判断 4**：KN-01 の「回答言語は質問の言語」は**既に System ルール 8 にある**ため追記しない
- **DP-40**：`cloud-master` の Rerank は有効化しない
- `CLAUDE.md` §2-12 の追記と `.claude/commands/dify-deploy.md` の更新は PM が適用
````
