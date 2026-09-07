# 2026-09-08 — 思考量の制御（completion_params）と Service API の streaming 化

基準コミット: `55b11d0`（main。PR #107 マージ直後）
関連: Issue #82 / `dify/KNOWN_ISSUES.md` DI-007・DI-010・DI-011・DI-012 / `docs/handoff/2026-09-07-china-models-and-syncback.md`（**この設計書はその追補。既存ファイルは変えない**）

---

## 0. 目的

2026-09-08 の実機再テストで、Dify Cloud の Service API が **120.5 秒で HTTP 504** を返し（DI-010）、返ってきた回答には **`<think>…</think>` の推論文がそのまま混入**していた（DI-011）。原因は「モデルが遅い」ではなく **思考（reasoning）に時間とトークンを使いすぎていること**と、**テストが blocking で受けていること**の 2 つ。

この設計書は次の 3 つを決める。

| # | 何を | 何のために |
|---|---|---|
| 1 | **`completion_params` で思考量を絞る**（`reasoning_effort` / `exclude_reasoning_tokens` / `max_tokens`）。env とマスタ 13 ノードを同時に直す | 応答時間とトークンを減らす（DI-010）／`<think>` を出さない（DI-011） |
| 2 | **`run_tests.py` を `response_mode: streaming` にする**（`--blocking` で退避を残す） | Cloud 前段の 120 秒ゲートウェイを構造的に回避する（DI-010） |
| 3 | **DI-012（UI で KB を紐づけると Rerank が強制 ON）の方針を 3 案から選ぶ** | 外部 Rerank（Cohere via OpenRouter）への依存を切る／許容する判断を明文化する |

**モデルは替えない。** 既定は OpenRouter の `qwen/qwen3.8-max`（chat）/ `moonshotai/kimi-k3`（reasoning）のまま（PM 決定。再検討しない）。

---

## 1. 事実

### 1-1. 実機で観測されたこと（PM の Mac、2026-09-08）

出典: `dify/KNOWN_ISSUES.md` DI-010〜012、`dify/results/cloud-master/KN-01-20260908-0007.md`・`DC-01-20260908-0009.md`、[Issue #82 コメント](https://github.com/shoulang0729/dify/issues/82#issuecomment-5573272767)

| 事実 | 値 |
|---|---|
| Service API（blocking）の 504 | KN-01 T01/T02、DC-01 T01/T02/T06 の **5 件**。いずれも **120.5 秒** |
| Dify 側ログでの同じ実行 | **SUCCESS**。DC-01 T01 **343.3 s / 16,480 トークン**、T02 **222.1 s / 10,999 トークン** |
| 返ってきた短い応答 | KN-01 T05 78.6 s、T09 21.5 s、DC-01 T04 8.7 s。**いずれも本文先頭に `<think>…</think>`（英語）** |
| DI-007（KN-01 T01 の検索取りこぼし） | Dify ログ上の回答に期待語（TR-2024-007／0.06 mm/rev／18〜22 m/min／2.0 MPa／3D）が**すべて含まれる**。API が 504 なので判定は ERROR のまま |
| DI-012 | DSL の `reranking_enable: false` が、UI で KB を紐づけた時点で `true`（`openrouter / cohere/rerank-4-pro`、top_k 8）に置き換わる。ノードの検索設定に ON/OFF スイッチが出ない。**今回は Rerank ON のまま検索は成功**（429 は出なかった） |
| 付随（Cloud 側の乖離） | 再インポート前の DC-01 の Cloud 下書きが **`gpt-4o-mini`** だった（Git に無い Cloud 側の変更）。前回 22:23 の所要秒はマスタのモデルの値ではない |
| 付随（キー露出） | シェル式の誤りで API キーの値がツール出力に表示された。コミット・Issue には無し |

### 1-2. プラグイン定義（PM が今日確認。`langgenius/dify-official-plugins` main、`models/openrouter/models/llm/*.yaml`）

| モデル | `parameter_rules` に**ある**もの |
|---|---|
| `qwen3.8-max` / `kimi-k3` | `temperature` / `top_p` / `max_tokens`（default 4096, max 131072）/ `response_format`（text\|json_object\|json_schema）/ `json_schema` / **`reasoning_effort`**（string: `xhigh`\|`high`\|`medium`\|`low`\|`minimal`、required false）/ **`exclude_reasoning_tokens`**（boolean、default true、「思考過程を隠す」） |
| `qwen3.7-plus` | 上記に加えて **`enable_thinking`**（boolean）。context 1M |

### 1-3. リポジトリ側の事実（**この設計セッションで機械確認した**）

| # | 事実 | 確認方法 |
|---|---|---|
| F1 | `dify/apps/*.yml` は **12 ファイル / `llm` ノード 13 個**（LG-01 だけ 2 個）。全ノードの `completion_params` は **`temperature: 0.2` の 1 項目だけ** | `grep -c "type: llm" dify/apps/*.yml`、`grep -n -A4 completion_params` |
| F2 | `max_tokens` / `reasoning_effort` / `exclude_reasoning_tokens` は **マスタに 1 件も無い**（全 12 ファイルで 0） | `grep -c` |
| F3 | **`question-classifier` / `parameter-extractor` ノードは 0 個**、`single_retrieval_config` は 0 個。`knowledge-retrieval` は 4 個（KN-01/KN-02/KN-03/GN-01） | `grep -n "type: ..."` |
| F4 | **`render.py` の R1 は既に env の `completion_params` を DSL に流し込む**。該当行は `scripts/dify/render.py` L233：<br>`"completion_params": m.get("completion_params", before.get("completion_params", {}))`<br>→ **R1 に `completion_params` を足す変更は不要** | コードを読み、さらに §1-4 の実験で確認 |
| F5 | `render.py` の **R2**（`question-classifier` / `parameter-extractor`）は `{**before, provider, name, mode}` で、**`completion_params` を env から取らない**。**R4**（`single_retrieval_config.model`）も同様 | `scripts/dify/render.py` L243-251 / L253-278 |
| F6 | `render.py --check` の恒等判定は **`rendered == data` の dict 比較**（キー順に依存しない）。一致すればマスタの生バイトをそのまま出す | L479-481 |
| F7 | **`tools/verify.mjs` §12 は `render.py --env cloud-master --all --check` を実行して合否を出す**（`npm run verify` / CI の `verify` ワークフローに入っている） | 実行して確認（§1-4） |
| F8 | `dify/check.py` は `llm` ノードに `model.completion_params` があることだけ見る。**未知のキーは INFO 扱いで exit 0 のまま** | 実行して確認（§1-4） |
| F9 | `run_tests.py` は `response_mode: "blocking"`、`--timeout` 既定 **180 秒**。`urllib` で 1 発の POST → JSON | `scripts/dify/run_tests.py` L145-153, L193 |
| F10 | `scripts/dify/tests/mock_server.py` は **JSON を返すだけで SSE 非対応**。`scripts/dify/tests/test_sync_back.py` は **単体実行のスクリプト**（`npm test` に入れない）という前例がある | 両ファイル |
| F11 | `dify/tests/*.json` は **12 スイート × 4 ケース = 48 ケース**。`mode` は `chat`（KN-01/02/03）と `workflow`（他 9） | 各ファイル |
| F12 | `docs/dify/templates/*.yml` に **`weighted_score` / `weights` / `vector_setting` の実例は無い**（テンプレートは `version: 0.1.0` の古い出典で、`multiple_retrieval_config` は `reranking_model` と `top_k` しか持たない） | `grep -rn` |

### 1-4. この設計セッションで実行した実験（scratchpad の複製上。リポジトリは変更していない）

1. `dify/env/cloud-master/env.yml` の `models.chat.completion_params` に `max_tokens: 4096, reasoning_effort: low, exclude_reasoning_tokens: true` を足し、マスタ 13 ノードの `completion_params` に同じ 4 項目を（アルファベット順で）足した
2. `python3 scripts/dify/render.py --env cloud-master --all --check` → **12 本すべて `[OK] マスタとバイト一致`**
3. `python3 dify/check.py` → **全件 `[OK]`**。増えたのは `INFO : 参照 DSL に無いキー: exclude_reasoning_tokens, max_tokens, reasoning_effort` だけ
4. `node tools/verify.mjs` → **ALL PASS**（`models.reasoning` / `kimi` / `qwen_small` にも `completion_params` を足した状態で確認済み）
5. 逆に **env だけ直してマスタを直さない**と、`verify.mjs` §12 が
   `❌ render.py --env cloud-master --all --check が FAIL（マスタとバイト不一致…）` で落ちる
   → **env とマスタを同時に直すことが CI で強制される**（`CLAUDE.md` §2-12 の「同時に変える」が機械検証済みということ）

### 1-5. 未確認（推測で埋めない。§11 に一覧）

- DSL の `completion_params` に書いた `reasoning_effort` / `exclude_reasoning_tokens` が、**OpenRouter プラグイン経由で実際に API リクエストに乗るか**
- `reasoning_effort: low` で **DC-01（本社向け日本語）の品質が落ちないか**
- `exclude_reasoning_tokens: true` で **`<think>` が消えるか**
- `multiple_retrieval_config.reranking_mode: weighted_score` が **Dify 1.15 系の DSL スキーマで受理されるか**、そのとき `reranking_enable` を `true`/`false` どちらにするか、`embedding_provider_name`/`embedding_model_name` を空文字にできるか
- `max_tokens: 4096` で DC-01 の報告書ドラフトが**途中で切れないか**

---

## 2. 章 A — `completion_params` で思考量を絞る

### 2-1. 決定（PM 決定。再検討しない）

| 項目 | 決定 |
|---|---|
| 既定モデル | **変えない**（`qwen/qwen3.8-max` / `moonshotai/kimi-k3`、OpenRouter） |
| 手段 | **`completion_params` で思考を抑える**。モデル切替はしない |
| 対象 env | **`cloud-master` だけ**。`inhouse`（Ollama）・`customer-a`（SiliconFlow）は**現状維持**（これらのプロバイダで同じパラメータ名が通るか未確認のため。§2-6） |
| マスタ | 12 本 13 ノードの `completion_params` を env と**同じ値**に揃える（`render --check` の恒等性を保つ＝`CLAUDE.md` §2-12） |
| 手順 | PR #102 と同じ**案 B**：マスタは `render.py` の出力をコピーせず**行を手で直し、`--check` で機械検証**する（DI-002 のため。`docs/handoff/2026-09-07-china-models-and-syncback.md` §2-3） |

### 2-2. `dify/env/cloud-master/env.yml` の確定内容

**`models:` ブロックの 4 行だけを差し替える。** `dify` / `knowledge` / `brand` / `flags` / `variables` と `embedding` / `rerank` / `overrides` は **1 バイトも変えない**。

置き換え前（現状 L10-13）:

```yaml
  chat:       { provider: langgenius/openrouter/openrouter, name: qwen/qwen3.8-max, mode: chat, completion_params: { temperature: 0.2 } }
  reasoning:  { provider: langgenius/openrouter/openrouter, name: moonshotai/kimi-k3, mode: chat }
  kimi:       { provider: langgenius/openrouter/openrouter, name: moonshotai/kimi-k3, mode: chat }        # overrides から role: kimi
  qwen_small: { provider: langgenius/openrouter/openrouter, name: qwen/qwen3.6-35b-a3b, mode: chat }      # 軽量・高速用
```

置き換え後（**この通り**。行末コメントは残す）:

```yaml
  chat:       { provider: langgenius/openrouter/openrouter, name: qwen/qwen3.8-max, mode: chat, completion_params: { temperature: 0.2, max_tokens: 4096, reasoning_effort: low, exclude_reasoning_tokens: true } }          # 生成。思考は low（DI-010 / DI-011）
  reasoning:  { provider: langgenius/openrouter/openrouter, name: moonshotai/kimi-k3, mode: chat, completion_params: { temperature: 0.2, max_tokens: 4096, reasoning_effort: minimal, exclude_reasoning_tokens: true } }    # 分類・抽出。思考は minimal
  kimi:       { provider: langgenius/openrouter/openrouter, name: moonshotai/kimi-k3, mode: chat, completion_params: { temperature: 0.2, max_tokens: 4096, reasoning_effort: low, exclude_reasoning_tokens: true } }        # overrides から role: kimi
  qwen_small: { provider: langgenius/openrouter/openrouter, name: qwen/qwen3.6-35b-a3b, mode: chat, completion_params: { temperature: 0.2, max_tokens: 4096, reasoning_effort: minimal, exclude_reasoning_tokens: true } }  # 軽量・高速用（短文分類・整形）
```

**役割ごとの `reasoning_effort` の決め方**（architect 判断。PM が変えたければ §11-P1）:

| role | 値 | 理由 |
|---|---|---|
| `chat` | `low` | 生成。ゼロにはしない（DC-01 の報告書ドラフトは多少の推論が要る）。**`minimal` に落とすかは実機の品質を見て決める** |
| `reasoning` | `minimal` | 分類・抽出・判定。長い思考は不要（PM 決定） |
| `kimi` | `low` | `overrides` で生成側を Kimi に振る用途なので `chat` と同じ |
| `qwen_small` | `minimal` | 用途が「短文分類・整形」（`dify/env/README.md`）なので `reasoning` と同じ |

`max_tokens: 4096` はプラグイン定義の default と同じ値を**明示的に書く**（DSL に書かないと API リクエストに乗らない可能性があるため。§1-5）。

### 2-3. マスタ `dify/apps/*.yml` の確定内容（13 ノード）

各 `llm` ノードの

```yaml
          completion_params:
            temperature: 0.2
```

を、**アルファベット順**で次に置き換える（既存の YAML の並びに合わせる。インデントは 10 スペース / 12 スペース）:

```yaml
          completion_params:
            exclude_reasoning_tokens: true
            max_tokens: 4096
            reasoning_effort: low
            temperature: 0.2
```

**対象は 12 ファイル・13 か所**（LG-01 のみ 2 か所）:

| ファイル | `llm` ノード数 | 現在の行（`completion_params:` の行番号） |
|---|---|---|
| `DC-01-hq-report-draft.yml` | 1 | L182 付近 |
| `DC-02-meeting-minutes.yml` | 1 | — |
| `DC-04-site-notice-zh.yml` | 1 | — |
| `GN-01-expense-check.yml` | 1 | — |
| `GN-02-invoice-fapiao.yml` | 1 | — |
| `GN-05-document-summary.yml` | 1 | — |
| `KN-01-tech-knowledge-qa.yml` | 1 | L176 |
| `KN-02-equipment-manual-search.yml` | 1 | — |
| `KN-03-internal-rules-qa.yml` | 1 | — |
| `LG-01-ja-zh-translation.yml` | **2** | L177 / L240 |
| `LG-04-business-email.yml` | 1 | — |
| `NM-03-daily-report-summary.yml` | 1 | — |

（行番号は目安。**`grep -n -A2 "completion_params:"` で位置を出して置換する**。`temperature: 0.2` は `completion_params` の直下にしか出ない）

**`reasoning_effort` はマスタでは全ノード `low` に統一する。** マスタは `models.chat` を写した姿であり、`chat` role が `low` だから（`reasoning` の `minimal` はマスタに該当ノードが無い＝F3）。

### 2-4. `render.py` の R1 は変更不要（実測済み）

PM の指示は「`render.py` が `completion_params` を R1 で env から上書きするか確認し、していなければ R1 の対象に含める変更を設計に入れる」だった。

**確認結果: 既に上書きしている**（F4。`scripts/dify/render.py` L233）。§1-4 の実験で、env とマスタの両方を直せば `--check` が 12 本すべて `[OK]` になることを確認した。
→ **R1 のための `render.py` 変更は行わない。**

### 2-5. `render.py` の R2 だけ 1 行変える（採用）

env の `models.reasoning` に `completion_params` を書くのに、**R2（`question-classifier` / `parameter-extractor`）がそれを読まない**（F5）。このまま放置すると「env に書いたのに黙って効かない」という、`CLAUDE.md` が最も嫌う静かな乖離になる。

`scripts/dify/render.py` L246-249 の

```python
                after = {**before, "provider": m.get("provider"), "name": m.get("name"),
                         "mode": m.get("mode", before.get("mode", "chat"))}
```

を、R1（L229-234）と同じ形に揃える:

```python
                after = {**before, "provider": m.get("provider"), "name": m.get("name"),
                         "mode": m.get("mode", before.get("mode", "chat")),
                         "completion_params": m.get("completion_params", before.get("completion_params", {}))}
```

あわせて docstring の R2 の行に `（completion_params も env から）` を足す。

- **今日の差分はゼロ**：該当ノードは 12 本に 1 つも無い（F3）。`render --check` は 12 本 `[OK]` のまま
- **R4（`single_retrieval_config.model`）は今回触らない**。該当ノードも 0 個で、`mode` すら入れていない別の設計判断が混ざっているため。**残課題として §11-R1 に記録する**

### 2-6. 他 env（`inhouse` / `customer-a`）は現状維持

| env | 扱い | 理由 |
|---|---|---|
| `inhouse` | **変えない** | プロバイダが `langgenius/ollama/ollama`。Ollama プラグインの `parameter_rules` に `reasoning_effort` / `exclude_reasoning_tokens` があるかは**未確認**。無いパラメータを送るとインポート・実行が壊れうる。台帳の確認状態も `未確認` のまま |
| `customer-a` | **変えない** | プロバイダが `langgenius/siliconflow/siliconflow`。同上、**未確認** |

これらは `render.py` が env の値で DSL を上書きするので、env に書かなければマスタの値（＝`low` / `true` / `4096` 入り）がそのまま残る点に注意。**マスタの値が Ollama / SiliconFlow で通らない可能性がある**ので、§11-C4 に「他 env での render 出力を実機に入れる前に確認する」を残す。

### 2-7. 代替（`reasoning_effort` が効かなかったとき。**今は採らない**）

| | 採用 | 代替 1 | 代替 2 |
|---|---|---|---|
| モデル | `qwen/qwen3.8-max` のまま | **`qwen/qwen3.7-plus`** に替える | `qwen/qwen3.8-max` のまま |
| 思考の止め方 | `reasoning_effort: low` ＋ `exclude_reasoning_tokens: true` | **`enable_thinking: false`** ＋ `exclude_reasoning_tokens: true`（`qwen3.7-plus` は `enable_thinking` を持つ＝§1-2） | `reasoning_effort: minimal` |
| 影響範囲 | env 4 行 ＋ マスタ 13 か所 | env 4 行 ＋ マスタ 13 か所 ＋ **`dify/env/README.md` の環境台帳のモデル名 ＋ 確認状態を `未確認` に戻す**（台帳ルール 4） | env 1 行 ＋ マスタ 13 か所 |
| リスク | 効かなければ何も変わらない | モデルが変わるので日本語品質を再評価（DP-04） | 品質低下 |

判断の順番: **`low` で実機 → 効かない／遅いままなら `minimal` → それでも駄目なら `qwen3.7-plus` ＋ `enable_thinking: false`**。

---

## 3. 章 B — `run_tests.py` を streaming にする

### 3-1. 決定（PM 決定）

- `response_mode: "streaming"` を既定にする。SSE を読んで `answer` / `outputs` を組み立てる
- **`--blocking` で従来の blocking 経路を残す**（Cloud 以外・比較検証用）
- `--timeout` の既定を **180 → 600 秒**
- 所要秒とトークン数は **`message_end` / `workflow_finished` の `metadata.usage` / `data.total_tokens`** から取る
- `mock_server.py` を SSE 対応にし、**テストを 1 本足す**

### 3-2. SSE の受け方

Dify Service API の streaming は `Content-Type: text/event-stream` で、1 フレームが `data: {JSON}\n\n`。JSON の `event` フィールドで種別が決まる。

**chat（`POST /chat-messages`、`mode: "chat"`）**

| `event` | やること |
|---|---|
| `message` | `data["answer"]` を**連結**して回答本文にする |
| `agent_message` | 同上（現構成では出ないが、来たら同じ扱い） |
| `message_replace` | それまでの本文を `data["answer"]` で**置き換える**（モデレーションによる差し替え） |
| `message_end` | `data["metadata"]["usage"]["total_tokens"]` をトークン数として記録し、**受信を終える** |
| `error` | `data["message"]` / `data["code"]` / `data["status"]` を ERROR 行にして終える |
| `ping` | 無視（Cloud が 10 秒おきに送る keep-alive。**これがあるので socket timeout に掛からない**） |
| 上記以外（`workflow_started` / `node_started` / `node_finished` / `workflow_finished` / `tts_message` / `message_file` …） | **無視**（advanced-chat では workflow 系イベントも混ざる） |

**workflow（`POST /workflows/run`、`mode: "workflow"`）**

| `event` | やること |
|---|---|
| `workflow_finished` | `data["status"]` が `succeeded` なら `data["outputs"]` を**既存の `extract_output("workflow", {"data": {...}})` にそのまま渡す**（形が一致する）。`data["total_tokens"]` / `data["elapsed_time"]` を記録。**受信を終える** |
| `workflow_finished` で `status != "succeeded"` | `data["error"]` を ERROR 行にして終える |
| `text_chunk` | `data["text"]` を連結して**フォールバック本文**にする（`workflow_finished` の `outputs` が空だったときだけ使う） |
| `error` | ERROR 行にして終える |
| `ping` | 無視 |
| 上記以外（`workflow_started` / `node_started` / `node_finished` / `iteration_*` / `loop_*` …） | **無視** |

**実装上の注意（設計として必須）**

1. **未知の `event` は握りつぶす**（Dify の版が上がってイベントが増えても壊れないように）
2. **JSON パースに失敗した行も握りつぶす**（`event:` 行・コメント行 `:` が来ても落ちない）
3. `urlopen(timeout=N)` の `N` は **1 回の recv のタイムアウト**であって全体ではない。**別に `t0` からの経過を見て `--timeout` を超えたら打ち切る**（打ち切りは ERROR 行「タイムアウト（streaming、N 秒）」）
4. **SSE でない応答が返ってきたら、本文全体を JSON として読む**（後方互換。古い mock サーバー・blocking しか返さない実装に当たっても動く）
5. `Accept: text/event-stream` を送る。`User-Agent` は既存の `USER_AGENT` 定数のまま（DI-004）

### 3-3. CLI の変更

| オプション | 変更 |
|---|---|
| `--timeout` | 既定 **180 → 600**。ヘルプを「1 件あたりの上限秒（既定 600。streaming は受信全体の上限）」に |
| `--blocking` | **新規**。`response_mode: blocking` の従来経路を使う |
| `--base-url` | **新規**。接続先を直接指定する（`env.yml` の `dify.base_url` より優先）。**テストから mock サーバーに向けるために必要** |
| `--out` | **新規**。結果の出力先ディレクトリ（既定 `dify/results`）。**テストが `dify/results/` を汚さないために必要** |
| 既存の `--env` / `--dry-run` / `codes` | 変えない |

接続先の優先順位（docstring にも書く）: **`--base-url` > `dify/env/<env>/env.yml` の `dify.base_url` > `DIFY_BASE_URL` > 既定 `https://api.dify.ai/v1`**

### 3-4. 結果 Markdown の変更

`dify/results/<env>/<番号>-<YYYYMMDD-HHMM>.md` の表に **「トークン」列を 1 つ足す**（`所要秒` の右）。

```
| ID | 種別 | 入力 | 出力（先頭） | 期待語の一致 | 禁止語 | 所要秒 | トークン | 判定 |
```

- 値が取れないとき（ERROR・blocking・dry-run）は `—`
- ヘッダー行に受信モードを 1 行足す: `- 受信: streaming`（`--blocking` なら `blocking`）
- 既存の「出力全文」節は変えない

`dify/results/**` は**生成物**なので、過去のファイルは書き換えない。

### 3-5. `mock_server.py` の SSE 対応

`POST /v1/chat-messages` と `POST /v1/workflows/run` で、リクエスト body の `response_mode == "streaming"` のときだけ SSE を返す（それ以外は**今のまま JSON**）。

- `BaseHTTPRequestHandler` の既定は HTTP/1.0 なので **`Content-Length` を付けずに書いて閉じればよい**（chunked 不要）。ヘッダは `Content-Type: text/event-stream`
- **回答は 3 つに分割して送る**（連結処理を実際に通すため）
- `ping` を 1 フレーム挟む（無視されることを確かめるため）

chat:

```
data: {"event": "message", "task_id": "t1", "message_id": "m1", "conversation_id": "c1", "answer": "<chunk1>", "created_at": 0}

data: {"event": "ping"}

data: {"event": "message", "task_id": "t1", "message_id": "m1", "conversation_id": "c1", "answer": "<chunk2>", "created_at": 0}

data: {"event": "message", "task_id": "t1", "message_id": "m1", "conversation_id": "c1", "answer": "<chunk3>", "created_at": 0}

data: {"event": "message_end", "task_id": "t1", "id": "m1", "message_id": "m1", "conversation_id": "c1", "metadata": {"usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30}}}

```

workflow:

```
data: {"event": "workflow_started", "task_id": "t1", "workflow_run_id": "w1", "data": {"id": "w1", "workflow_id": "wf1", "created_at": 0}}

data: {"event": "ping"}

data: {"event": "text_chunk", "task_id": "t1", "workflow_run_id": "w1", "data": {"text": "<chunk1>", "from_variable_selector": ["1", "text"]}}

data: {"event": "text_chunk", "task_id": "t1", "workflow_run_id": "w1", "data": {"text": "<chunk2>", "from_variable_selector": ["1", "text"]}}

data: {"event": "workflow_finished", "task_id": "t1", "workflow_run_id": "w1", "data": {"id": "w1", "workflow_id": "wf1", "status": "succeeded", "outputs": {"output": "<answer 全文>"}, "error": null, "elapsed_time": 1.23, "total_tokens": 45, "total_steps": 3, "created_at": 0, "finished_at": 1}}

```

回答文の作り方（`build_canned_answers()`）は**今のまま**。分割は「文字数を 3 等分」でよい。

### 3-6. `scripts/dify/tests/test_run_tests.py`（新規 1 ファイル）

`test_sync_back.py` と**同じ作法**（F10）:
- 単体で走るスクリプト。`python3 scripts/dify/tests/test_run_tests.py` で exit 0 なら全件 PASS
- **`npm test` / CI には入れない**（`CLAUDE.md` §3 のコマンド集合を変えない）
- 生成物（結果 Markdown）は **`tempfile.mkdtemp()`** に出し、終わったら消す。`dify/results/**` を汚さない
- `mock_server.py` を `subprocess` で起動し、終了時に必ず kill する

| # | 検査 |
|---|---|
| T1 | `--dry-run` が exit 0、結果ファイルに `(dry-run)` が出る（既存の振る舞いを壊していない） |
| T2 | mock 相手に **streaming（既定）** で `KN-01`（chat）が **4/4 合格・exit 0**。結果 Markdown に `- 受信: streaming` がある |
| T3 | mock 相手に **streaming** で `DC-01`（workflow）が **4/4 合格・exit 0** |
| T4 | `--blocking` で `KN-01` `DC-01` がどちらも **4/4 合格・exit 0**（退避経路が生きている） |
| T5 | chat の `message` を 3 分割して送っても回答が**連結されて 1 本になる**（T2 が通ればよいが、期待語が chunk 境界をまたぐケースを 1 つ mock 側で作る） |
| T6 | `ping` フレームがあっても落ちない（mock が必ず 1 つ送るので T2/T3 に含まれる） |
| T7 | 結果 Markdown の表に **「トークン」列**があり、streaming のとき数値が入っている |

---

## 4. 章 C — DI-012（UI で KB を紐づけると Rerank が強制 ON）の 3 案

### 前提

- DSL に `reranking_enable: false` と書いてあっても、**UI で KB を紐づけた時点で `true`（`openrouter / cohere/rerank-4-pro`）に置き換わる**。ノードの検索設定に ON/OFF スイッチが出ない（DI-012）
- **今回は Rerank ON のまま検索は成功した**（DI-005 の 429 は再現しなかった）
- `docs/dify/templates/*.yml` に `weighted_score` の実例は無い（F12）→ **DSL スキーマの確認は実機（PM）**

### 案 (a) — `weighted_score` にする（**推奨**）

`multiple_retrieval_config` を「外部 Rerank モデルを使わない再ランク方式」に変える。ベクトル重み 1.0・キーワード重み 0.0 なら**意味的にはリランク無しのベクトル検索**と同じで、UI が Rerank モデルを差し込む余地が無くなる。

```yaml
        multiple_retrieval_config:
          reranking_enable: true          # ← 確認要：weighted_score のとき true / false どちらが正か
          reranking_mode: weighted_score
          reranking_model:
            model: ''
            provider: ''
          score_threshold: null
          top_k: 8
          weights:
            keyword_setting:
              keyword_weight: 0.0
            vector_setting:
              embedding_model_name: ''    # ← 確認要：空文字が許されるか（cloud-master の embedding はワークスペース既定＝空）
              embedding_provider_name: ''
              vector_weight: 1.0
```

- 対象 4 ノード（KN-01 top_k 8 / KN-02 top_k 4 / KN-03 top_k 6 / GN-01 top_k 4。**`top_k` は変えない**）
- **`render.py` の R3 と衝突する**：R3 は `models.rerank` が空だと `reranking_enable: false` を**書き戻す**（`scripts/dify/render.py` L253-266）。案 (a) を採るなら **R3 に「`reranking_mode: weighted_score` のときは `reranking_enable` を触らない」という分岐が要る**。→ **render.py の追加変更が発生する**
- **確認要が 3 つある**（`reranking_enable` の真偽・空文字の可否・そもそも 1.15 が `weights` を受理するか）ので、**この PR では入れない**。§11-C1 で PM が実機確認してから別 PR

### 案 (b) — 紐づけ後に UI で Rerank モデルを外す

KB を紐づけたあと、ナレッジ側（Studio → ナレッジ → 該当 KB → 検索設定）で Rerank を OFF にし、ノードを保存し直す。

- DI-005 で実際に効いた回避策と同じ道具立て
- **弱点**：ノードの検索設定に ON/OFF スイッチが出ない（DI-012 の観測）ので、**ナレッジ側で外してもノード側の `reranking_enable: true` が残るかは未確認**。手順が「毎回・人が・忘れずに」に依存する

### 案 (c) — Rerank ON を許容する（**(a) が無理ならこれ**）

- 実測で**動いている**（検索成功・429 なし）
- `dify/KNOWN_ISSUES.md` DI-012 の状態を `wontfix`（仕様）にし、`docs/dify/decisions-pending.md` の **DP-40 の結論を「cloud-master は UI 既定に従う（Rerank は UI が入れるものを使う）」に修正**する
- `sync_back.py` を掛けると `reranking_enable: true` / `reranking_model` の差分が出る。**モデル差分は sync_back が exit 1 で止める設計**（`scripts/dify/sync_back.py` N5）なので、`reranking_model` を N5 の対象から外すか、人が env を直すかの判断が要る → **§11-C2**
- **DP-40 の結論を変えるのはプロダクト判断なので PM 決定**（DP-40 の「決める人」は PM）

### この設計書での扱い

**3 案の比較を書くところまで。採択は PM**（§11-C1）。**PR-A / PR-B のどちらでも `multiple_retrieval_config` は 1 バイトも触らない。**

DI-012 の再発を早く見つけるために、**手順書に「KB 紐づけ後にノードの検索設定を確認する」を足す**（§5）ことだけは今回入れる。

---

## 5. 章 D — 手順書・コマンドの更新文案

### 5-1. `dify/DEPLOY.md`（implementer が編集する）

**D-1. §0 の末尾に「秘密の扱い」小節を新設**

```markdown
### 環境変数の確認のしかた（値を出さない）

キーが入っているかを確かめるときは **設定の有無だけ**を見る。

    [ -n "${DIFY_APP_KEY_KN01:-}" ] && echo set || echo unset

**禁止**：`echo $DIFY_APP_KEY_KN01` / `env` / `printenv` / `set` / `cat ~/.config/dify/*` /
`export -p`。値がツール出力・ログ・チャットに 1 度でも出たら**そのキーは漏れたものとして扱う**
（Dify の画面で再発行する。手順は §4 の表の最終行）。
```

**D-2. §1-③ の 3 番の文を差し替え**（モデルに加えてパラメータも見る）

```markdown
3. LLM ノードを開き、**モデルが `openrouter / qwen/qwen3.8-max` になっているか確認**する。あわせて
   モデル設定のパラメータが **`temperature 0.2` / `max_tokens 4096` / `reasoning_effort low` /
   `exclude_reasoning_tokens ON`** になっているかを見る（DSL の `completion_params` の指定どおりなら変更不要。
   DI-010 / DI-011 の対処）。空欄・エラーならプロバイダー未設定。
   **勝手に別のモデル・別の値に変えない**（変えるなら env とマスタを同時に直す＝`CLAUDE.md` §2-12）
```

**D-3. §1-② の末尾に 1 行追加**（DI-012）

```markdown
- **KB を紐づけたら、その場で「知識検索」ノードの検索設定を開いて確認する**。Rerank が勝手に ON になり
  Rerank モデル（`openrouter / cohere/rerank-4-pro` など）が入っていることがある（DI-012）。
  入っていたら **消さずに、その状態を `KNOWN_ISSUES.md` DI-012 の観測として報告する**（方針は
  `docs/handoff/2026-09-08-thinking-budget-and-streaming.md` §4 で PM が採択する）
```

**D-4. §1-④（再インポート）の 1 番の前に新しい 0 番を挿す**（Cloud 側の乖離検知）

```markdown
0. **再インポートの前に、Cloud 側が Git と乖離していないか見る。**
   Chrome で対象アプリを「DSL をエクスポート」→ 落ちたファイルを

       python3 scripts/dify/sync_back.py ~/Downloads/<番号>*.yml --dry-run

   に掛け、差分要約を読む。**モデル・プロンプトに身に覚えのない差分があれば、そこで止めて報告する**
   （2026-09-08 に DC-01 の Cloud 下書きが `gpt-4o-mini` になっていた。Git に無い変更＝ DI-013）。
   差分が `dataset_ids` / `dependencies` / `version` / Rerank 設定だけなら、そのまま 1 番へ進んでよい
```

**D-5. §1-③（テスト実行）の説明を streaming に合わせる**

```markdown
- 受信は **streaming**（`response_mode: streaming`）が既定。Dify Cloud の前段が blocking を
  **120 秒で HTTP 504** にするため（DI-010）。`--timeout` の既定は 600 秒
- 従来の blocking で試したいときは `--blocking`（セルフホストや、504 の再現確認に使う）
- 結果の表には **所要秒とトークン数**が入る（`message_end` / `workflow_finished` の usage 由来）
- 接続先を直接指定したいときは `--base-url`、結果の出力先を変えたいときは `--out`
```

**D-6. §4 の表に 1 行追加**

```markdown
| `HTTP 504`（本文 `error code: 504`）が 120 秒前後で返る | blocking 受信で Cloud 前段のゲートウェイに掛かった（DI-010） | 既定の streaming を使う（`--blocking` を外す）。それでも遅いときはモデルの `reasoning_effort` を見直す（`docs/handoff/2026-09-08-thinking-budget-and-streaming.md` §2-7） |
| API キーの値が画面・ログ・チャットに出てしまった | `echo $VAR` などで値を展開した（§0） | **そのキーを漏れたものとして扱う**。Dify の該当アプリ → 「API アクセス」→ 旧キーを削除 → 新規作成し、`~/.config/dify/<env>.env` の該当行を差し替えて `set -a; source ...; set +a` し直す。リポジトリ・Issue・PR に値が残っていないことを `git log -p` で確認する |
```

### 5-2. `dify/env/README.md`（implementer が編集する）

**E-1. 「モデル用途 4 種の意味」の表の直後に、次の小節を新設**

```markdown
## モデルパラメータ（`completion_params`）

`env.yml` の `models.<role>.completion_params` は、`render.py` の R1（`llm` ノード）と R2
（`question-classifier` / `parameter-extractor`）で DSL に流し込まれる。**マスタ DSL の
`completion_params` は `cloud-master` の値と一致させる**（一致していないと
`render.py --env cloud-master --all --check` が落ち、`tools/verify.mjs` §12 も落ちる）。

| role | temperature | max_tokens | reasoning_effort | exclude_reasoning_tokens | 実機確認 |
|---|---|---|---|---|---|
| `chat` | 0.2 | 4096 | `low` | `true` | **未確認**（2026-09-08 時点） |
| `reasoning` | 0.2 | 4096 | `minimal` | `true` | **未確認** |
| `kimi` | 0.2 | 4096 | `low` | `true` | **未確認** |
| `qwen_small` | 0.2 | 4096 | `minimal` | `true` | **未確認** |

**なぜ入れたか**：`qwen/qwen3.8-max` が思考込みで 200〜340 秒かかり Service API が 504 になった
（DI-010）、回答本文に `<think>…</think>` が混入した（DI-011）。`reasoning_effort` で思考量を、
`exclude_reasoning_tokens` で思考文の露出を抑える。値の根拠と代替案は
`docs/handoff/2026-09-08-thinking-budget-and-streaming.md` §2。

**`inhouse`（Ollama）・`customer-a`（SiliconFlow）には入れていない。** これらのプラグインが
`reasoning_effort` / `exclude_reasoning_tokens` を持つか未確認のため。**入れる前に、その環境で
`render.py --env <env> --all` の出力を実機にインポートして通ることを確かめる。**
```

**E-2. 環境台帳の `cloud-master` 行の「根拠」欄の末尾に追記**

```
／`completion_params` は 2026-09-08 追加（`docs/handoff/2026-09-08-thinking-budget-and-streaming.md` §2）。**パラメータの実機確認は未了**
```

（**「確認状態」は `確認済` のまま**にする。台帳ルール 4 が `未確認` に戻せと言っているのは「モデルを入れ替えたら」であって、モデルは替えていないため。パラメータの未確認は根拠欄に明記する）

### 5-3. `dify/KNOWN_ISSUES.md`（implementer が編集する）

**K-1. DI-013 を 1 行足す**（表の末尾）

```markdown
| **DI-013** | 2026-09-08 | cloud-master | DC-01 | 再インポート前の **Cloud 上の下書きが Git のマスタと乖離**していた（LLM ノードのモデルが `gpt-4o-mini`。Git のマスタは `qwen/qwen3.8-max`）。Cloud だけで行われた変更が誰にも気づかれず、前回のテスト結果（所要秒・トークン数）がマスタの値ではなかった | Dify Cloud は画面で自由に編集でき、Git に戻す経路が人の運用（`sync_back.py`）に依存している。再インポート前に乖離を見る手順が無かった | **再インポートの前に `python3 scripts/dify/sync_back.py <エクスポートしたファイル> --dry-run` で差分を見る**手順を `DEPLOY.md` §1-④ に追加（本設計書 §5-1 D-4）。モデル差分が出たら止めて報告する | open | 本設計書 §5-1 D-4 |
```

**K-2. DI-010 / DI-011 の「対処」欄の末尾に追記**（**状態は `open` のまま変えない**）

- DI-010 に: `**2026-09-08 設計**：(1) completion_params で思考量を絞る（reasoning_effort: low / exclude_reasoning_tokens: true / max_tokens: 4096）、(2) run_tests.py を streaming 受信にし --timeout 既定を 600 秒に。設計書 docs/handoff/2026-09-08-thinking-budget-and-streaming.md §2・§3。**実機での再テストは未了**`
- DI-011 に: `**2026-09-08 設計**：exclude_reasoning_tokens: true をマスタ 13 ノードに入れる。消えない場合の保険（Answer/End の前で <think>…</think> を除去する Code ノード）は同設計書 §11-T1 の代替として保留`

**K-3. DI-007 は今回触らない。** streaming 化後の再テストで期待語が揃ったら `fixed` にする（PM 決定 7）。

**K-4. DI-012 も今回触らない。** §4 の採択後に別 PR。

### 5-4. `.claude/commands/dify-deploy.md`（**PM が適用**。`CLAUDE.md` §4 により architect も implementer も `.claude/**` を触らない）

**C-1. §0 の箇条書きの 2 つ目の末尾に追記**

```
**値の確認は `[ -n "${VAR:-}" ] && echo set || echo unset` の形だけを使う。`echo $VAR`・`env`・`printenv`・`set`・`export -p`・`cat ~/.config/dify/*` は禁止**（値が 1 度でも出力に出たら、そのキーは漏れたものとして扱い、Dify で再発行してから続ける）。
```

**C-2. §1 の Chrome 依頼文の「モデルが DSL の指定どおり…」の直後に挿入**

```
あわせてモデル設定のパラメータが `temperature 0.2` / `max_tokens 4096` / `reasoning_effort low` / `exclude_reasoning_tokens ON` になっているかを見る（DSL どおりなら変更不要。DI-010 / DI-011）。違っていたら**直さずに報告する**。
```

**C-3. §1 の末尾に「再インポートのとき」を 1 段落追加**

```
**既存アプリを再インポートするときは、先に Cloud 側の乖離を見る。** Chrome で対象アプリを「DSL をエクスポート」→ 落ちたファイルを `python3 scripts/dify/sync_back.py ~/Downloads/<番号>*.yml --dry-run` に掛け、差分要約を読む。**モデル・プロンプトに身に覚えのない差分があれば、そこで止めて報告する**（DI-013）。
```

**C-4. §2 の「KB を作ったら…」の段落を差し替え**

```
KB を作ったら Chrome で**「検索設定」の Rerank を OFF** にする（既定 ON のままだと OpenRouter 経由の Rerank が 429 になり検索 0 件。DI-005）。チャンクの区切りは `\n\n`・最大 1024 字（DI-006）。
**KB をノードに紐づけたら、その場で「知識検索」ノードの検索設定を開いて確認する。** DSL が `reranking_enable: false` でも、UI が Rerank を強制 ON にして Rerank モデルを入れることがある（DI-012）。**入っていても消さず、その状態をそのまま報告する**（方針は `docs/handoff/2026-09-08-thinking-budget-and-streaming.md` §4 で PM が決める）。
```

**C-5. §3 のコード直後に 2 行追加**

```
受信は streaming が既定（Cloud の blocking は 120 秒で 504。DI-010）。`--timeout` 既定は 600 秒。blocking を試すときだけ `--blocking`。
結果の表には所要秒とトークン数が入る。504 が出たら `--blocking` を付けていないか確認する。
```

### 5-5. `CLAUDE.md` §2-12（**load-bearing。PM 承認が要る。PM が適用**）

現在の §2-12 の「何を」の 1 文目:

> **何を**：モデル（provider/name、用途 `chat`/`reasoning`/`embedding`/`rerank`）・KB id・社名と拠点の表記・…

**提案**（`completion_params` を明示に加える。1 語の追加）:

> **何を**：モデル（provider/name/**`completion_params`**、用途 `chat`/`reasoning`/`embedding`/`rerank`）・KB id・社名と拠点の表記・…

**理由**：現行の文は「provider/name」だけを列挙しているため、`completion_params` を env に置く根拠が読み取れない。実際には `render.py` R1 が既に env の `completion_params` を DSL に流し込んでおり（F4）、`verify.mjs` §12 がその一致を機械検証している（F7）。**文言が実装より狭い**状態を直すだけで、挙動は何も変わらない。

**PM が承認しないなら適用しない。** その場合も §2 の他の項目・実装は変わらない（§11-P2）。

---

## 6. 変更ファイル一覧と PR 分割

### PR-A — 思考量の制御（env ＋ マスタ ＋ render R2 ＋ 文書）

| ファイル | 変更 |
|---|---|
| `dify/env/cloud-master/env.yml` | `models` の 4 行を §2-2 の通りに（`chat` / `reasoning` / `kimi` / `qwen_small`）。他は 1 バイトも触らない |
| `dify/apps/*.yml`（12 ファイル） | `llm` ノード **13 か所**の `completion_params` を §2-3 の 4 項目に。**他の行は 1 バイトも触らない** |
| `scripts/dify/render.py` | **R2 に 1 行**（`completion_params` を env から取る。§2-5）＋ docstring の R2 行に注記。**R1・R3・R4・R5〜R10 は触らない** |
| `dify/env/README.md` | §5-2 E-1（新小節）・E-2（台帳の根拠欄 1 行） |
| `dify/DEPLOY.md` | §5-1 D-1・D-2・D-3・D-4・D-6 |
| `dify/KNOWN_ISSUES.md` | §5-3 K-1（DI-013 追加）・K-2（DI-010/011 の対処欄追記） |

### PR-B — Service API の streaming 化

| ファイル | 変更 |
|---|---|
| `scripts/dify/run_tests.py` | §3-2〜§3-4（SSE 受信・CLI 4 項目・結果表にトークン列） |
| `scripts/dify/tests/mock_server.py` | §3-5（SSE 応答。`response_mode: streaming` のときだけ） |
| `scripts/dify/tests/test_run_tests.py` | **新規**。§3-6 の T1〜T7 |
| `dify/DEPLOY.md` | §5-1 D-5（§1-③ の streaming 説明） |

### 直列 / 並列

**直列。PR-A → PR-B。**
理由: **両方が `dify/DEPLOY.md` を触る**（`CLAUDE.md` §5「同じファイルを触るお題は直列」）。PR-A のほうが load-bearing（env ＋ マスタ ＋ `verify` §12）なので先。PR-B は PR-A のマージ後に `main` から切り直す。

- `scripts/dify/render.py`（PR-A）と `scripts/dify/run_tests.py`（PR-B）は別ファイルなので、そこは衝突しない
- PM が順序を逆にしたいなら（＝先に streaming で現状の所要秒を測りたいなら）、**PR-B の `DEPLOY.md` 変更を PR-A へ寄せて PR-B を `scripts/**` だけにする**ことで逆順も可能。その場合 PR-A の §1-③ に streaming の説明を先に書くことになる（実装より文書が先行する）

---

## 7. 触らない範囲（reviewer はここを diff 監査の基準にする）

**この設計（PR-A / PR-B の両方）で 1 バイトも変えてはいけないもの:**

| 対象 | 補足 |
|---|---|
| `mock/**` 一式 | UI モックは無関係。`CATS` / `SVCS` / `TAGS` / `SCENARIOS` / `HOME` / `FEED` / CSS / `render.js` すべて |
| `data/world/**` | 架空世界マスタは無関係 |
| `docs/handoff/2026-09-07-china-models-and-syncback.md` | **既存の設計書。追補は本ファイル**（`docs/handoff/README.md` の作法） |
| `docs/handoff/2026-09-07-repo-layout-v2.md` ほか既存の設計書・`*.issue.md` | 同上 |
| `.claude/agents/**` ・ `.claude/commands/**` | `CLAUDE.md` §4。§5-4 は**文案**であって、適用するのは PM |
| `CLAUDE.md` | §5-5 は**提案**。適用するのは PM（承認後） |
| `tools/verify.mjs` ・ `tools/regress.mjs` ・ `tools/gen-index.mjs` ・ `tools/check-world.mjs` | 検証側は変えない。**変えずに通ることが受け入れ条件**（§1-4 で確認済み） |
| `package.json` の `scripts` | `CLAUDE.md` §3 のコマンド集合を変えない。新テストは**手で実行**する |
| `.github/workflows/**` | CI は変えない |
| `dify/apps/*.yml` の `completion_params` 以外の全行 | プロンプト・ノード構成・`multiple_retrieval_config`・`top_k`・`dataset_ids`・`version`・`dependencies`・`app.name/description`・`edges` すべて |
| `dify/apps/*.yml` の `model.provider` / `model.name` / `model.mode` | **モデルは替えない**（PM 決定 1） |
| `multiple_retrieval_config`（4 ノード） | **DI-012 の 3 案は §4 で PM が採択するまで実装しない** |
| `dify/env/inhouse/env.yml` ・ `dify/env/customer-a/env.yml` | §2-6 |
| `dify/env/cloud-master/env.yml` の `dify` / `knowledge` / `brand` / `flags` / `variables` / `models.embedding` / `models.rerank` / `models.overrides` | §2-2 |
| `scripts/dify/render.py` の R1 / R3 / R4 / R5〜R10・恒等性判定・`--check`・`dump_with_header` | 変えるのは **R2 の 1 か所と docstring だけ** |
| `scripts/dify/sync_back.py` ・ `release.py` ・ `console_api.py` ・ `kb_upload.py` ・ `env.example` | 今回は触らない |
| `dify/check.py` | INFO が増えるだけ（F8）。ファイルは変えない |
| `dify/results/**` の既存ファイル | 生成物。過去の記録は書き換えない |
| `dify/tests/*.json`（12 スイート 48 ケース） | 期待語・入力は変えない。**streaming 化で判定結果が変わってはいけない** |
| `dify/CHANGELOG.md` | リリースしていないので書かない |
| `docs/dify/templates/**` | 外部出典・無改変 |
| `docs/dify/decisions-pending.md` の DP-40 | §4 案 (c) を採るときだけ、別 PR で変える |
| `docs/service-map.md` | サービスを足していないので再生成不要 |
| `dify/KNOWN_ISSUES.md` の DI-007 / DI-012 の行、DI-010 / DI-011 の**状態欄** | K-2/K-3/K-4。状態は `open` のまま |

---

## 8. 受け入れ条件（機械検証できる形）

### 8-1. PR-A

| # | コマンド | 期待 |
|---|---|---|
| A1 | `python3 scripts/dify/render.py --env cloud-master --all --check` | **12 行すべて `[OK]   <番号>: マスタとバイト一致`、exit 0** |
| A2 | `node tools/verify.mjs` | **ALL PASS**（§12 に `✅ render.py --env cloud-master --all --check が PASS`） |
| A3 | `node tools/regress.mjs` | **PASS**（`mock/js/data/**` を触らないので差分ゼロ。`--update` は**しない**） |
| A4 | `python3 dify/check.py` | **12 本すべて `[OK]`、exit 0**（`INFO : 参照 DSL に無いキー` に `exclude_reasoning_tokens, max_tokens, reasoning_effort` が増えるのは想定どおり） |
| A5 | `grep -o "reasoning_effort" dify/apps/*.yml \| wc -l` | **13** |
| A6 | `grep -o "exclude_reasoning_tokens" dify/apps/*.yml \| wc -l` | **13** |
| A7 | `grep -o "max_tokens" dify/apps/*.yml \| wc -l` | **13** |
| A8 | `grep -o "temperature: 0.2" dify/apps/*.yml \| wc -l` | **13**（増減なし） |
| A9 | `grep -l "reasoning_effort" dify/apps/*.yml \| wc -l` | **12**（全ファイル） |
| A10 | `grep -o "reasoning_effort" dify/env/cloud-master/env.yml \| wc -l` | **4**（`chat` / `reasoning` / `kimi` / `qwen_small`） |
| A11 | `grep -c "reasoning_effort" dify/env/inhouse/env.yml dify/env/customer-a/env.yml` | **どちらも 0** |
| A12 | `grep -o "reasoning_effort: minimal" dify/env/cloud-master/env.yml \| wc -l` | **2**（`reasoning` / `qwen_small`） |
| A13 | `grep -c "qwen/qwen3.8-max" dify/apps/*.yml` | **各ファイル 1**（LG-01 は 2）＝モデル名を変えていない |
| A14 | `git diff --stat main -- dify/apps` | **12 ファイル。追加 39 行 / 削除 0 行**（13 か所 × 3 行追加。architect が複製上で実測） |
| A15 | `git diff main -- dify/apps \| grep "^-" \| grep -v "^---" \| wc -l` | **0**（既存行を 1 行も消していない） |
| A16 | `git diff --name-only main` | §6 の PR-A の表にあるファイルだけ |
| A17 | `git diff main -- scripts/dify/render.py \| grep -c "^+"` | **5 以下**（R2 の 1 行 ＋ docstring ＋ diff ヘッダ） |
| A18 | `grep -c "completion_params" scripts/dify/render.py` | **3**（**変更前は 1**。R1 の 1 か所 ＋ 新設した R2 の 1 か所 ＋ docstring の R2 行に足す注記 1） |

### 8-2. PR-B

| # | コマンド | 期待 |
|---|---|---|
| B1 | `python3 scripts/dify/tests/test_run_tests.py` | **全件 PASS、exit 0**（T1〜T7） |
| B2 | `python3 scripts/dify/tests/test_sync_back.py` | **全件 PASS、exit 0**（壊していない） |
| B3 | `python3 scripts/dify/run_tests.py --dry-run KN-01 DC-01` | **exit 0**、`合計: 8 / 8 合格` |
| B4 | `node tools/verify.mjs && node tools/regress.mjs` | **ALL PASS**（`scripts/**` は verify の対象外だが、壊していないことを確認する） |
| B5 | `python3 scripts/dify/render.py --env cloud-master --all --check` | **12 本 `[OK]`**（PR-B はマスタを触らない） |
| B6 | `grep -c '"streaming"' scripts/dify/run_tests.py` | **1 以上** |
| B7 | `grep -c "blocking" scripts/dify/run_tests.py` | **`--blocking` 経路が残っている**（0 でない） |
| B8 | `python3 scripts/dify/run_tests.py --help` | `--blocking` / `--base-url` / `--out` が出る。`--timeout` の既定が **600** |
| B9 | `git status --porcelain dify/results` | **空**（テストが結果ファイルを残していない） |
| B10 | `git diff --name-only main` | §6 の PR-B の表にあるファイルだけ |

### 8-3. 実機（**PM が行う。PR のマージ条件にはしない**）

| # | 手順 | 期待 |
|---|---|---|
| M1 | `sync_back.py --dry-run` で Cloud の乖離を確認 → マスタを再インポート → 公開 | モデル差分が無いこと（DI-013） |
| M2 | LLM ノードのパラメータを目視 | `reasoning_effort low` / `exclude_reasoning_tokens ON` が入っている（§1-5 の最大の確認要） |
| M3 | `python3 scripts/dify/run_tests.py KN-01 DC-01` | **504 が 0 件**（DI-010） |
| M4 | 結果 Markdown の出力全文 | **`<think>` が 0 件**（DI-011） |
| M5 | KN-01 T01 / DC-01 T02・T06 | 期待語が揃う（DI-007 / DI-008 / DI-009 の判定） |
| M6 | DC-01 T01 の日本語ドラフト | 品質が落ちていない（`reasoning_effort: low` の妥当性。§11-C3） |
| M7 | 所要秒・トークン数 | 前回（343 s / 16,480 tok）から**大きく下がっている** |

---

## 9. implementer のコマンド列

### PR-A

```bash
git fetch origin main && git switch -c feat/<issue>-thinking-budget origin/main

# 1) env（4 行）。§2-2 の通り
$EDITOR dify/env/cloud-master/env.yml

# 2) マスタ 13 か所。位置を出してから置換する
grep -n -A2 "completion_params:" dify/apps/*.yml
#    § 2-3 の 4 行に置き換える（temperature: 0.2 は completion_params の直下にしか出ない）

# 3) render.py の R2（1 行）＋ docstring
$EDITOR scripts/dify/render.py

# 4) 文書
$EDITOR dify/env/README.md dify/DEPLOY.md dify/KNOWN_ISSUES.md

# 5) 検証（§8-1 の A1〜A18 を上から順に）
python3 scripts/dify/render.py --env cloud-master --all --check
python3 dify/check.py
node tools/verify.mjs
node tools/regress.mjs
grep -o "reasoning_effort" dify/apps/*.yml | wc -l          # 13
grep -o "exclude_reasoning_tokens" dify/apps/*.yml | wc -l  # 13
grep -o "max_tokens" dify/apps/*.yml | wc -l                # 13
grep -o "temperature: 0.2" dify/apps/*.yml | wc -l          # 13
git diff main -- dify/apps | grep "^-" | grep -v "^---" | wc -l   # 0

git add -A && git commit && gh pr create   # PR 本文に設計書パス・DI-010/011/013・§8-1 の結果を貼る
```

**`node tools/regress.mjs --update` は実行しない**（データ層を触っていない）。

### PR-B（PR-A のマージ後に `main` から切り直す）

```bash
git fetch origin main && git switch -c feat/<issue>-run-tests-streaming origin/main

$EDITOR scripts/dify/run_tests.py
$EDITOR scripts/dify/tests/mock_server.py
$EDITOR scripts/dify/tests/test_run_tests.py     # 新規
$EDITOR dify/DEPLOY.md                            # §5-1 D-5 だけ

python3 scripts/dify/tests/test_run_tests.py
python3 scripts/dify/tests/test_sync_back.py
python3 scripts/dify/run_tests.py --dry-run KN-01 DC-01
python3 scripts/dify/run_tests.py --help
node tools/verify.mjs && node tools/regress.mjs
git status --porcelain dify/results                # 空であること

git add -A && git commit && gh pr create
```

---

## 10. reviewer の照合点

| # | 見るところ |
|---|---|
| R-1 | **`dify/apps/*.yml` の diff が `+` 39 行だけで `-` が 0 行**（A14/A15）。プロンプト 1 文字も動いていないこと。**`git diff main -- dify/apps` を全部読む** |
| R-2 | 13 か所すべてが同じ 4 項目・同じ値・同じ並び（アルファベット順）。**LG-01 だけ 2 か所**あることを確認 |
| R-3 | `dify/env/cloud-master/env.yml` の diff が `models` の 4 行だけ。`embedding` / `rerank` / `overrides` / `knowledge` / `brand` / `flags` / `variables` が無傷 |
| R-4 | **`reasoning_effort` が `reasoning` と `qwen_small` だけ `minimal`、`chat` と `kimi` は `low`**（A12）。マスタ側は全部 `low` |
| R-5 | `inhouse` / `customer-a` の env.yml が**無傷**（A11） |
| R-6 | `scripts/dify/render.py` の diff が **R2 の 1 か所と docstring だけ**。R1・R3・R4・恒等性判定・`--check` に手が入っていないこと（A17/A18） |
| R-7 | `multiple_retrieval_config` / `top_k` / `dataset_ids` / `reranking_*` が**どこも変わっていない**（§4 は未採択） |
| R-8 | `model.provider` / `model.name` / `model.mode` が変わっていない（A13） |
| R-9 | §8-1 A1〜A18 / §8-2 B1〜B10 の**実行結果が PR 本文に貼られている**。貼られていない項目は自分で実行する |
| R-10 | `dify/KNOWN_ISSUES.md` で **DI-010/011 の状態欄が `open` のまま**、DI-007/DI-012 の行が無傷、DI-013 が 1 行増えているだけ |
| R-11 | `dify/env/README.md` の環境台帳の **「確認状態」列が `確認済` のまま**で、根拠欄に「パラメータの実機確認は未了」がある（§5-2 E-2） |
| R-12 | `mock/**` ・ `data/world/**` ・ `tools/**` ・ `package.json` ・ `.github/**` ・ `.claude/**` ・ `CLAUDE.md` ・ 既存の `docs/handoff/*.md` に **1 バイトも変更が無い**（§7） |
| R-13 | PR-B で **`dify/tests/*.json` が無傷**（48 ケースの期待語が変わっていない）。streaming 化で判定が変わっていないこと |
| R-14 | PR-B で **`dify/results/**` に新しいファイルが commit されていない**（テストの生成物が temp に出ている。B9） |
| R-15 | `package.json` の `scripts` が無傷（新テストは CI に入れない） |
| R-16 | PR 本文に「設計書 `docs/handoff/2026-09-08-thinking-budget-and-streaming.md` §X」と、`DI-010` `DI-011` `DI-013` の記載がある（`CLAUDE.md` KNOWN_ISSUES の運用） |

---

## 11. PM 判断待ち・確認要

### PM 判断（**止まる**）

| # | 論点 | architect の推奨 |
|---|---|---|
| **P1** | **`chat` の `reasoning_effort` を `low` にするか `minimal` にするか。** DC-01（本社向け日本語の報告書ドラフト）の品質に効く。`minimal` のほうが速くて安いが、構成の練り込みが落ちるおそれ | **`low` で出す。** 実機（M6）で品質を見て、遅ければ `minimal` に落とす（env 1 行 ＋ マスタ 13 か所の再編集で済む） |
| **P2** | **`CLAUDE.md` §2-12 の 1 語追加（`completion_params` を明示）を承認するか**（§5-5）。load-bearing の文言変更 | **承認を推奨。** 実装（`render.py` R1 ＋ `verify.mjs` §12）が既にそうなっていて、文言だけが狭い。挙動は変わらない。承認しない場合も PR-A はそのまま出せる |
| **P3** | **DI-012 の 3 案の採択**（§4）。(a) `weighted_score` / (b) UI で Rerank モデルを外す / (c) Rerank ON を許容 | **(a) を第一候補。ただし確認要が 3 つあるので、まず実機で確認（C1）してから別 PR。** 確認が取れないなら **(c)**（DP-40 の結論を「cloud-master は UI 既定に従う」に修正。**これは DP-40 の変更＝ PM 決定**） |
| **P4** | **PR-A / PR-B の順序。** 既定は PR-A → PR-B（§6）。先に streaming で現状の所要秒を測りたいなら逆順にできる（`DEPLOY.md` の分け方を変える） | **PR-A → PR-B。** 修正が先のほうが、1 回の再インポート＋再テストで両方の効果を測れる |
| **P5** | **露出した API キーの再発行**（背景の付随事項）。PM が検討中 | **再発行を推奨。** 手順は §5-1 D-6 の追加行に書いた。再発行したら `~/.config/dify/<env>.env` を差し替える |

### 確認要（**推測で埋めていない。実機・実装で確かめる**）

| # | 何を | いつ・誰が |
|---|---|---|
| **C1** | `multiple_retrieval_config.reranking_mode: weighted_score` を Dify 1.15 系の DSL が受理するか。そのとき `reranking_enable` は `true` / `false` どちらか。`weights.vector_setting.embedding_provider_name` / `embedding_model_name` を**空文字**にできるか（cloud-master の embedding はワークスペース既定＝空） | **PM が実機で**（UI で weighted_score を選んで DSL をエクスポートし、生の形を見るのが確実）。C1 の結果が §4 の採択（P3）を決める |
| **C2** | §4 案 (c) を採る場合、`sync_back.py` の N5（モデル差分で exit 1）が `reranking_model` の差分で止まるか。止まるなら N5 の対象から `reranking_model` を外すか、env を直すか | (c) 採択後に architect が再設計 |
| **C3** | DSL の `completion_params` に書いた `reasoning_effort` / `exclude_reasoning_tokens` が **OpenRouter プラグイン経由で実際に API リクエストに乗るか**。プラグイン定義の default は「UI で設定したときに入る値」であって、DSL に書かなければ乗らない可能性がある（PM の推測。**未確認**） | **PM が実機で**（M2：LLM ノードを開いてパラメータ欄に値が入っているかを見る。M3/M4：504 と `<think>` が消えるか） |
| **C4** | `inhouse`（Ollama）・`customer-a`（SiliconFlow）のプラグインが `reasoning_effort` / `exclude_reasoning_tokens` を持つか。持たない場合、**マスタの値がそのまま render 出力に残る**ので、その環境でインポート・実行が通るか | その環境を初めて立てるとき。§5-2 E-1 に注意書きを入れる |
| **C5** | `max_tokens: 4096` で DC-01 の報告書ドラフトが途中で切れないか | M6 と同時（結果 Markdown の出力全文を読む） |
| **C6** | Dify Cloud の SSE イベント名（§3-2 の表）が 1.15 系の実装と一致するか。**実装は未知イベントを握りつぶす方針**なので、名前が違っても致命傷にはならないが、`message_end` / `workflow_finished` の名前が違うと**トークン数が取れない**（`—` になる） | PR-B のマージ後、M3 の実行時に結果表のトークン列が埋まるかで判る |

### 残課題（今回は入れない）

| # | 内容 |
|---|---|
| **R1** | `render.py` の **R4**（`single_retrieval_config.model`）が env の `completion_params` も `mode` も取らない（F5）。該当ノードが 0 個なので今回は触らない。`single_retrieval_config` を使うアプリを足すときに直す |
| **T1** | `<think>` が `exclude_reasoning_tokens` で消えなかった場合の保険：**Answer / End ノードの前に `<think>…</think>` を除去する Code ノードを足す**。**今は入れない**（ノード構成を変えると 12 本の差分が大きく、プロンプト差分レビューの負荷も上がる）。M4 で消えなければ別設計書 |
| **T2** | DI-007 / DI-008 / DI-009 の `fixed` 判定。streaming 化後の再テスト（M5）で期待語が揃ってから |
| **T3** | DI-001（`kb_upload.py` が `embedding_model` を渡さない）・DI-002（block scalar）・DI-003（`build_replace_table` の重複定義）は今回の範囲外 |

---

## 12. Issue 案（`gh` が無い環境なので本文をここに置く。PM が投稿する）

**タイトル**

```
fix(dify): 思考量の制御（completion_params）と Service API の streaming 化 — DI-010 / DI-011 / DI-013
```

**ラベル**: `dify`（既存のラベル運用に合わせる）／**関連**: #82

**本文**

```markdown
## 背景

2026-09-08 の実機再テスト（PR #107 で記録）で 2 つ出た。

- **DI-010** Service API（blocking）が **120.5 秒で HTTP 504**。Dify 側ログでは同じ実行が SUCCESS
  （DC-01 T01 **343 s / 16,480 トークン**、T02 222 s / 10,999 トークン）
- **DI-011** 回答本文の先頭に **`<think>…</think>`**（英語の推論文）が混入

原因は「モデルが遅い」ではなく **思考に時間とトークンを使いすぎていること** と **テストが blocking で受けていること**。
**モデルは替えない**（`qwen/qwen3.8-max` / `moonshotai/kimi-k3` のまま。PM 決定）。

## 設計書

`docs/handoff/2026-09-08-thinking-budget-and-streaming.md`
（`docs/handoff/2026-09-07-china-models-and-syncback.md` の追補。既存の設計書は変えない）

## PR 分割（直列。PR-A → PR-B）

**PR-A — 思考量の制御**
- `dify/env/cloud-master/env.yml` の `models` 4 行に
  `max_tokens: 4096` / `reasoning_effort`（`chat`・`kimi` は `low`、`reasoning`・`qwen_small` は `minimal`）/
  `exclude_reasoning_tokens: true` を足す（設計書 §2-2）
- `dify/apps/*.yml` 12 ファイル **13 か所**の `completion_params` を同じ値に揃える（§2-3）
- `scripts/dify/render.py` の **R2 に 1 行**（`completion_params` を env から取る。今日の差分はゼロ。§2-5）
- `dify/env/README.md` / `dify/DEPLOY.md` / `dify/KNOWN_ISSUES.md`（DI-013 追加）

**PR-B — Service API の streaming 化**
- `scripts/dify/run_tests.py` を `response_mode: streaming` に。`--blocking` で退避を残す。
  `--timeout` 既定 180 → **600**。`--base-url` / `--out` を追加。結果表に**トークン列**（§3）
- `scripts/dify/tests/mock_server.py` を SSE 対応に
- `scripts/dify/tests/test_run_tests.py`（新規。`npm test` には入れない）
- `dify/DEPLOY.md` §1-③ の説明

直列の理由: **両方が `dify/DEPLOY.md` を触る**（CLAUDE.md §5）。

## 受け入れ条件（機械検証）

PR-A
- [ ] `python3 scripts/dify/render.py --env cloud-master --all --check` → **12 本 `[OK]`**
- [ ] `node tools/verify.mjs` → **ALL PASS**（§12 に render --check PASS が出る）
- [ ] `node tools/regress.mjs` → PASS（`--update` はしない）
- [ ] `python3 dify/check.py` → 12 本 `[OK]`
- [ ] `grep -o "reasoning_effort" dify/apps/*.yml | wc -l` → **13**（`exclude_reasoning_tokens` / `max_tokens` も 13）
- [ ] `grep -o "temperature: 0.2" dify/apps/*.yml | wc -l` → **13**（増減なし）
- [ ] `git diff main -- dify/apps` が **`+` 39 行 / `-` 0 行**
- [ ] `grep -c "reasoning_effort" dify/env/inhouse/env.yml dify/env/customer-a/env.yml` → **どちらも 0**

PR-B
- [ ] `python3 scripts/dify/tests/test_run_tests.py` → 全件 PASS
- [ ] `python3 scripts/dify/tests/test_sync_back.py` → 全件 PASS
- [ ] `python3 scripts/dify/run_tests.py --dry-run KN-01 DC-01` → `合計: 8 / 8 合格`
- [ ] `--help` に `--blocking` / `--base-url` / `--out`、`--timeout` 既定 600
- [ ] `git status --porcelain dify/results` が空
- [ ] `node tools/verify.mjs && node tools/regress.mjs` → ALL PASS

（全項目は設計書 §8）

## 触らない範囲

`mock/**` ／ `data/world/**` ／ `tools/**` ／ `package.json` ／ `.github/**` ／ `.claude/**` ／ `CLAUDE.md` ／
既存の `docs/handoff/*.md` ／ `dify/apps/*.yml` の `completion_params` 以外の全行（**プロンプトを 1 文字も動かさない**）／
`model.provider` `name` `mode`（**モデルは替えない**）／ `multiple_retrieval_config`・`top_k`・`dataset_ids`（DI-012 は未採択）／
`dify/env/inhouse` `customer-a` ／ `dify/tests/*.json` ／ `dify/results/**` の既存ファイル ／
`render.py` の R1・R3・R4 と恒等性判定 ／ `sync_back.py` `release.py` `console_api.py` `kb_upload.py`
（全表は設計書 §7）

## PM 判断待ち

- **P1** `chat` の `reasoning_effort` を `low` にするか `minimal` にするか（推奨: `low` で出して実機で見る）
- **P2** `CLAUDE.md` §2-12 に `completion_params` を明示する 1 語追加を承認するか（load-bearing。推奨: 承認）
- **P3** DI-012 の 3 案の採択（推奨: (a) `weighted_score`、確認が取れなければ (c) Rerank ON 許容 ＋ DP-40 修正）
- **P4** PR の順序（既定 PR-A → PR-B）
- **P5** 露出した API キーの再発行

## 確認要（実機。PR のマージ条件にはしない）

- **C3** DSL の `completion_params` が OpenRouter プラグイン経由で実際に API に乗るか（**最大の未確認**）
- **C1** `reranking_mode: weighted_score` の DSL スキーマ（`reranking_enable` の真偽・空文字の可否）
- **C4** Ollama / SiliconFlow で同じパラメータ名が通るか
- **C5** `max_tokens: 4096` で DC-01 のドラフトが切れないか
- **C6** SSE イベント名が 1.15 系と一致するか（不一致でもトークン列が `—` になるだけ）

マージ後に PM が実機で: 再インポート（**前に `sync_back.py --dry-run` で乖離確認＝ DI-013**）→ 公開 →
`run_tests.py KN-01 DC-01` → **504 が 0 件 / `<think>` が 0 件**を確認 → 結果を `dify/results/cloud-master/` に commit →
DI-007 / DI-008 / DI-009 / DI-010 / DI-011 の状態を更新。
```
