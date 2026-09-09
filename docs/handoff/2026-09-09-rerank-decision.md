# 2026-09-09 Rerank の扱いを決着させる（Issue #195）

- レーン：**M/L**（architect → PM 承認 → implementer → reviewer）
- 実行場所：**設計・実装は `run:cloud`／実機確認だけ `run:mac`**（`run:*` は Issue ごとに 1 つ。§8 で PR を分けている理由）
- 関連：#195・#121（W4-2 の実機確認で発覚）・#82・#114・DI-005・DI-012・DI-015・DI-016・DP-40
- 依存：本件が決着しないと **W4-4（`op: deploy`）の受け入れ条件「12 本を 1 回で投入 → 公開」** が KB 付き 4 本で止まる（`docs/handoff/2026-09-08-cloud-auth-and-w4.md` §11 W4-4）

---

## §0 この設計の出口（1 行）

**KB 付き 4 本（KN-01・KN-02・KN-03・GN-01）を `dify/build/cloud-master/` の render 出力から、人が画面で何も選ばずに投入・公開できる状態にする。**
そのために **マスタ DSL と `cloud-master` の env に Rerank を明示的に書く**（`cloud-master` の「render 恒等＝バイト一致」は保ったまま）。

---

## §1 Issue #195 の問い 1〜5 への回答

### Q1. DI-005 は「Rerank 全般が使えない」だったのか「OpenRouter 経由の Rerank が使えない」だったのか

**原文（`dify/KNOWN_ISSUES.md` DI-005 の「症状」「原因」列をそのまま引用）**：

> 症状：UI で作った KB の **Rerank が既定 ON**（Cohere Rerank / OpenRouter 経由）で **HTTP 429**、知識検索が **0 件**になり回答が定型文だけになる
> 原因：Rerank モデルのレート制限。OpenRouter 経由の Rerank は実用に耐えなかった

**architect の読み（言い切り）：DI-005 は「Rerank 全般が使えない」の根拠にはならない。** 記録されているのは
**「OpenRouter 経由の Cohere Rerank が、その時点で 429（レート制限）を返した」という 1 回の観測**である。理由は 3 つ：

1. 症状・原因の両方が経路（`OpenRouter 経由`）とモデル（`Cohere Rerank`）を名指ししている。Rerank という機能一般の話として書かれていない
2. **429 は容量・レート起因の一時エラーであって、非互換ではない**。「実用に耐えなかった」は同日の 1 回の観測に対する評価
3. **同じ経路・同じモデルで、翌日 429 が再現していない**（DI-012 の「今回は Rerank ON のまま検索は成功（429 は再現せず）」／PR #157 の 24/24 全合格）

**ただし、ここから「Cohere を直接使う構成なら別物だから安全」という結論は出さない。**
本設計が推す構成は **DI-005 が名指ししたのと同じ「OpenRouter 経由の Cohere Rerank」そのもの**である。
安全側の根拠は「経路が違うから」ではなく「**同じ経路で 429 が再現せず 24/24 が通った**」という後続の実測である。
Cohere を直接契約する案（別プロバイダを増やす）は、契約・キー管理・env 追加が増えるわりに、
いま観測できている問題を 1 つも解いていないので**採らない**（§3 案 C）。

**断定できない部分**：429 が「一過性だったのか」「無料枠の日次上限で、使用量が閾値を超えると再発するのか」は
git のどこにも記録が無く、**実機で使い続けないと分からない**。したがって §7 の受け入れ条件に「16 件のテストで 429 が出ないこと」を、
§10 にロールバック手順を置く。

### Q2. 24/24 が通ったときの Rerank 設定は何だったのか

**結論：git には残っていない。** 以下は推測ではなく、リポジトリを検索した結果である。

| 調べたもの | 結果 |
|---|---|
| `grep -ril rerank dify/results/cloud-master/` | **0 件**（結果ファイル 46 本のうち 1 本も Rerank に言及していない） |
| 結果ファイルのヘッダが記録している項目 | `定義` / `接続先`（`https://api.dify.ai/v1`）/ `受信`（streaming）/ `合否` の 4 つだけ。**アプリ側の DSL・知識検索ノードの設定・KB の検索設定は一切記録していない** |
| 「24/24」の実体 | コミット `7b43f1a`（PR #157）。`dify/results/cloud-master/` の **2026-09-08 20:45〜20:51 の 6 本**（KN-01 4/4・KN-02 4/4・KN-03 4/4・GN-01 4/4・GN-05 4/4・NM-03 4/4 ＝ 24/24）。このうち KB 付きは KN-01・KN-02・KN-03・GN-01 の 4 本 |
| `dify/state/` | **ディレクトリ自体が存在しない**（`docs/handoff/2026-09-08-execution-split-and-runner.md` が「実機の事実は `dify/state/<env>.yml` に置く」と定めているが、まだ 1 度も書かれていない） |

**したがって「24/24 は Rerank ON で通った」は現時点で PM の証言だけが根拠であり、機械が読める形では git に無い。**

**状況証拠は強いが、断定はしない**：DI-012（2026-09-08）が「UI で KB を紐づけた時点で `reranking_enable` が `true`
（`openrouter / cohere/rerank-4-pro`、top_k 8）に置き換わる」を実機で確認しており、`DEPLOY.md` §1-④ 手順 3 は
再インポート後に UI で KB を紐づけ直すことを求めている。20:45 の batch はその手順の後に走っているので、
**ノードが Rerank ON だった可能性はきわめて高い**。だが「20:45 時点のノード設定を記録したファイル」は存在しないので、
**本設計はこれを「証拠」ではなく「状況証拠」として扱い、§9 E1 で実機から採取し直す。**

**所見（Issue の問い 2 が求めているもの）：これは Rerank 固有の問題ではなく、テスト結果の記録様式の穴である。**
`dify/results/**` は「何を送って何が返ったか」しか残していないため、**合格したときの実機構成が誰にも再現できない**。
本設計では最小限の手当てとして §5-4 を置く（`dify/state/` の本格導入は #114 系の別 Issue に残す。ここでスコープを広げない）。

### Q3. DP-40 で何が決まっているか。その判断は今も有効か

`docs/dify/decisions-pending.md` DP-40（**`cloud-master` でリランクを有効にするか**）の決定欄：

> **2026-09-08・PM 決定（案 c）**：**cloud-master は UI 既定の Rerank ON を許容する**（`rerank` は空のまま、DSL の
> `multiple_retrieval_config` は変更しない）。外部 Rerank 依存を外す `weighted_score` 案（案 a）は…**別 Issue で検討**

**読み方**：DP-40 は「Rerank を有効にしない」とは決めていない。決めたのは
**「実機は Rerank ON（UI 既定）で動かす。git は何も書かない」** である。つまり **git を実機に合わせない、と決めた**のが DP-40 案 c である。

**その前提は W4-2 で崩れた**。案 c が「手数ゼロ」だったのは、**UI で KB を紐づける操作のついでに Rerank が自動で入る**からだった。
`dataset_ids` を焼き込んだ build 版を使うと **UI で KB を紐づける操作自体が消える**ので、Rerank も自動で入らない。
結果、公開チェックリストが「Rerank モデル は必須です」で止まり、**消したはずの手作業 1 手が別の場所に戻ってくる**（PM の #195 コメントの表のとおり）。

**したがって DP-40 案 c は「前提が変わったので再決定が要る」状態にある。** 本設計は DP-40 に
**案 d（マスタ DSL に明示する）** を追記し、PM の再決定を求める（§11 P-1）。

**あわせて、いま git にある 2 か所の記述は事実と食い違っているので直す**：

| 場所 | 現在の記述 | 何が誤りか |
|---|---|---|
| `dify/env/cloud-master/env.yml` 15 行目 | `# 空＝reranking_enable: false。Rerank は有効にしない（DI-005 / DP-40）` | DP-40 は「有効にしない」と決めていない（「git に書かない」と決めた）。**DI-005 を「Rerank 全般が危険」の根拠として引いているのも Q1 のとおり誤り** |
| `dify/env/README.md` 118 行目 | `**Rerank は有効にしない**（DP-40・DI-005）` | 同上。かつ `customer-a` は `BAAI/bge-reranker-v2-m3` を入れているので、この 1 文は既に全 env の説明になっていない |

### Q4. KB 付き 4 本のマスタ DSL に Rerank を入れるべきか

**入れる（推奨案＝§3 案 D）。** 具体値・影響範囲・機械検証は §4〜§7。

### Q5. 入れない場合、公開のたびに人が手で Rerank を選ぶ運用でよいか

**「よい」とはしない。ただし、決定が下りるまでの間は手順書に明記して露出させる**（§8 PR-1）。
理由：いま `dify/DEPLOY.md` には **build 版を使うと公開チェックリストで止まる**ことがどこにも書かれておらず、
次に投入する人が同じ場所で必ず詰まる。**この 1 手の明記は、案 D を採る／採らないに関わらず要る**（案 D が入るまでの期間、
および案 D をロールバックした場合の手順として）。だから PR-1 は PM の決定を待たずに出せる。

---

## §2 いま起きていること（整理）

| 層 | 誰が設定するか | いまの値 | 効くところ |
|---|---|---|---|
| **KB（dataset）の検索設定** | `scripts/dify/kb_upload.py` の `build_retrieval_model()`（DI-016 で完全な形に修正） | `reranking_enable: false`（＋ `search_method: semantic_search` / `top_k: 8`） | dataset 単位の既定。`retrieval_mode: single` や KB 単体の検索で効く |
| **アプリの知識検索ノード** | マスタ DSL の `multiple_retrieval_config`／UI での KB 紐づけ | DSL は `false`、UI で紐づけると `true`（DI-012） | **`retrieval_mode: multiple` の実行時はこちらが効く。公開チェックリストが見ているのもこちら** |

**DI-005 は前者（UI で作った KB の dataset 設定）、DI-012 と #195 は後者（ノード設定）の話**である。
2 つの層が KNOWN_ISSUES の中で 1 つの話として読まれてきたことが、今回の混乱の一因になっている。
本設計は **後者だけを変える**（前者＝`kb_upload.py` は触らない。§6）。

---

## §3 選択肢と推奨

| | 案 | 手数（KB 付き 4 本の公開） | 副作用 | 判定 |
|---|---|---|---|---|
| **A** | 現状維持。公開のたび人が UI で Rerank を選ぶ | **4 手（毎回）** | W4-2 の効果が相殺される。W4-4 の「投入→公開」を CI で完結できない | ✗（ただし手順は書く＝PR-1） |
| **B** | ノードの検索モードを `weighted_score`（ベクトル＋全文の重み付け）に変えて Rerank 依存を外す | 0 手 | **DSL スキーマ・空文字許容の実機確認 3 点が未了**（`2026-09-08-thinking-budget-and-streaming.md` §11-C1）。検索品質が変わるので 24/24 の再取得が要る。`customer-a` の `bge-reranker-v2-m3` 前提とも噛み合わない | ✗（今回は採らない。別 Issue に残す） |
| **C** | Cohere を直接プロバイダ契約して Rerank に使う | 0 手 | プロバイダ・API キー・env が 1 つ増える。**いま観測できている問題を 1 つも解いていない**（429 の再現すらしていない）。§2-10 の秘密が 1 つ増える | ✗ |
| **D** | **マスタ DSL の `multiple_retrieval_config` に Rerank を明示し、`cloud-master` env の `models.rerank` にも同じ値を書く** | **0 手** | DP-40 案 c の「`multiple_retrieval_config` は変更しない」を覆す（＝PM の再決定が要る）。マスタが OpenRouter 前提の Rerank モデル名を 1 つ持つ | **◎ 推奨** |

### なぜ案 D か（4 つ）

1. **git を実機に合わせる方向の修正である。** DI-012 が観測した実機の状態（`openrouter / cohere/rerank-4-pro`、`top_k: 8`）を
   そのまま git に書くだけで、**新しい構成を導入していない**。24/24 が通ったときの状態（状況証拠）を再現する方向でもある
2. **W4-2 と W4-4 が両方成立する。** build 版に `dataset_ids` と Rerank の両方が入るので、UI 経路でも API 経路でも
   「インポート → 公開」で止まらない。**U3/V8（Console API の publish がサーバ側でチェックリストを検証するか）の答えがどちらでも壊れない**
   （検証するなら通る。検証しないなら元から通るが、そのとき公開されるアプリは実機と同じ Rerank 設定になる）
3. **DI-015 の雑音が減る。** `sync_back.py` の N5（R3）が Cloud エクスポートとマスタの Rerank 差分を毎回「モデルの食い違い」として出し、
   差分要約を読みづらくしていた。マスタが実機と一致すれば **この差分は出なくなる**（DI-012 が「別途確認」として残した §11-C2 の宿題がここで片付く）
4. **顧客環境の自由度を落とさない。** `render.py` の R3 は env の `models.rerank` で上書きするので、
   `customer-a` は `BAAI/bge-reranker-v2-m3` に、`inhouse` は空＝無効に、それぞれ**マスタを触らずに**振り替わる（§5-2 で実測確認済み）

---

## §4 決めた内容（実装が写す値）

### 4-1. マスタ DSL（4 本）

対象：`dify/apps/KN-01-tech-knowledge-qa.yml`・`KN-02-equipment-manual-search.yml`・`KN-03-internal-rules-qa.yml`・`GN-01-expense-check.yml`
の `knowledge-retrieval` ノード `data.multiple_retrieval_config`。

```yaml
# 変更前（4 本とも同じ）
        multiple_retrieval_config:
          reranking_enable: false
          reranking_mode: reranking_model
          reranking_model:
            model: ''
            provider: ''
          score_threshold: null
          top_k: 8

# 変更後
        multiple_retrieval_config:
          reranking_enable: true
          reranking_mode: reranking_model
          reranking_model:
            model: <E1 で採取した model 文字列>
            provider: <E1 で採取した provider 文字列>
          score_threshold: null
          top_k: 8
```

- **変えるのは `reranking_enable` と `reranking_model` の 2 つだけ。** `reranking_mode` / `score_threshold` / `top_k` は触らない
- **`model` / `provider` の文字列は実機から採取した値をそのまま使う（§9 E1）。推測で書かない。**
  現時点の**見込み**は `model: cohere/rerank-4-pro`（DI-012 が記録した表示名）、`provider: langgenius/openrouter/openrouter`
  （マスタの `llm` ノードが使っているプラグイン完全 id と同形）だが、**プラグイン完全 id の表記は git のどこにも実測として残っていない**。
  ここを取り違えると「インポートは通るがモデルが解決できず公開でまた止まる」ので、**E1 を PR-2 の前提条件にする**
- モデル名・プロバイダ名は秘密ではない（`CLAUDE.md` §2-10 の対象は URL・キー・dataset id・顧客実名）ので、そのまま書いてよい

### 4-2. `dify/env/cloud-master/env.yml`

```yaml
# 変更前（15 行目）
  rerank:     { provider: '', name: '' }        # 空＝reranking_enable: false。Rerank は有効にしない（DI-005 / DP-40）

# 変更後
  rerank:     { provider: <E1 の provider>, name: <E1 の model> }   # マスタ DSL と同値。Cloud の KB 付き 4 本は Rerank 必須（#195・DI-033）。空にすると render が enable:false に書き換えてマスタと不一致になる
```

**これは「cloud-master を『何も変えない env』でなくする」変更ではない。**
`models.chat`（`qwen/qwen3.8-max`）がすでにそうであるように、**env にマスタと同じ値を書くから恒等になる**。
`render.py` の R3 は env の値で**無条件に**上書きするので、**env を空のままマスタだけ `true` にすると `--check` が落ちる**（§5-1・§5-2 で実測）。

### 4-3. `dify/env/inhouse/env.yml`・`customer-a/env.yml`

**どちらも変更しない。**

- `customer-a`：すでに `BAAI/bge-reranker-v2-m3` が入っており、R3 で正しく置き換わる（§5-2 で実測）
- `inhouse`：空のままにする。**Ollama で使える Rerank モデル名を推測で書かない**（`CLAUDE.md` §2-12 の「実機で通ることを確かめてから入れる」に従う）。
  空のままだと `inhouse` の build 版は `reranking_enable: false` で出るので、**セルフホスト側で同じ公開チェックリストに当たる可能性がある**。
  これは `inhouse` が **未確認**環境である以上いま解けないので、`dify/env/README.md` の台帳に注記として残す（§11 P-2）

### 4-4. 台帳・記録の更新（同じ PR で必ず一緒に）

| ファイル | 変更 |
|---|---|
| `dify/env/README.md` 台帳 | `cloud-master` 行の `rerank` 列を「（空＝無効）」→ 採取した provider/model に。**同ルール 4 に従い `確認状態` を `未確認` に戻す**（実機確認 E2/E3 が済んだら PR-3 で `確認済`＋日付＋根拠に戻す） |
| `dify/env/README.md` 118 行目 | 「**Rerank は有効にしない**（DP-40・DI-005）」を削除し、**「KB 付き 4 本は Rerank が必須（#195）。`cloud-master` はマスタ DSL と同値を持つ。`inhouse` は空＝無効のまま（未確認）」**に置き換える |
| `dify/env/README.md` 用途表 | `rerank` の行「空なら `reranking_enable: false`」に **「＝ マスタで有効にしていても env が空なら無効化される」**を追記 |
| `docs/dify/decisions-pending.md` DP-40 | 行を消さず、**2026-09-09 の追記**として「W4-2（`dataset_ids` 焼き込み）で案 c の前提（UI 紐づけのついでに Rerank が入る）が消えた。案 d＝マスタ DSL に明示、を #195 で提案。PM 再決定待ち／決定後は決定日と PR 番号を追記」 |
| `dify/KNOWN_ISSUES.md` DI-005 | 行を消さず「対処」列に **2026-09-09 追記**：「本行は **OpenRouter 経由の Cohere Rerank が 429 を返した 1 回の観測**であり、『Rerank 全般が使えない』の根拠ではない（#195 §1 Q1）。同経路で 2026-09-08 に 429 は再現せず 24/24 全合格」 |
| `dify/KNOWN_ISSUES.md` DI-012 | 行を消さず「対処」列に **2026-09-09 追記**：「案 c の前提は W4-2 で消えた。#195 で案 d（マスタに明示）へ移行。`sync_back.py` の R3 差分（§11-C2 の宿題）はマスタと実機が一致することで解消」。状態は `wontfix` のまま |
| `dify/KNOWN_ISSUES.md` に **新規 DI-033** | 症状「`dataset_ids` を焼き込んだ build 版をインポートすると、UI での KB 紐づけが起きないため Rerank も自動 ON にならず、**公開チェックリストが『Rerank モデル は必須です』で止まる**（KB 付き 4 本すべて）」／原因「Dify は KB 付きアプリの公開に Rerank モデルの指定を要求する。従来は UI の KB 紐づけが副作用で入れていた」／対処「マスタ DSL と `cloud-master` env に Rerank を明示（#195 PR-2）」／状態「実機確認まで `open`、E2/E3 が通ったら `fixed`」／Issue「#195」。**PM の実測（V2）に基づく行なので、伝聞にならないよう「PM が Cloud の画面で確認」と明記する**（KNOWN_ISSUES の冒頭ルール） |
| `dify/DEPLOY.md` | §5-3 のとおり |

### 4-5. 多言語文言

**なし。** 本件は `mock/**` を一切触らないので、`T`/`TAGS`/`CATS`/`SVCS` の ja/zh/en は無変更。
`CATS`/`SVCS`/`TAGS` の件数・id も無変更なので、**`tools/regress.mjs` の基準更新（`--update`）は不要**（`CLAUDE.md` §2-9）。

---

## §5 機械検証との整合（コードを読んで確認した内容）

### 5-1. `scripts/dify/render.py` の R3 を読んだ結果

`render_app()` の該当箇所（244〜257 行目）は次のとおり：

```python
if t == "knowledge-retrieval":
    mrc = d.get("multiple_retrieval_config")
    if mrc is not None:
        rerank = models.get("rerank") or {}
        before_rm = dict(mrc.get("reranking_model") or {})
        before_enable = mrc.get("reranking_enable")
        after_rm = {"model": rerank.get("name", ""), "provider": rerank.get("provider", "")}
        after_enable = bool(after_rm["model"] and after_rm["provider"])
        mrc["reranking_model"] = after_rm
        mrc["reranking_enable"] = after_enable
```

読み取った事実（**architect が実際にコードを読んで確認した**）：

- **R3 は無条件で上書きする。** `llm` ノードの R1 は `if m.get("provider") and m.get("name")` で守られている（env が空ならマスタの値を残す）が、
  **R3 にはこのガードが無い**。したがって env の `models.rerank` が空なら、マスタが何であろうと `reranking_enable: false` ＋ 空の `reranking_model` に書き換わる
- `after_rm` のキーは **`model` と `provider` の 2 つだけ**。マスタの `reranking_model` も同じ 2 キーなので、値さえ一致すれば**辞書として完全一致する**
- `reranking_mode` / `top_k` / `score_threshold` は R3 の対象外（触らない）
- `--check` の判定は 472 行目 `identical = rendered == data` → 一致なら `out_bytes = raw_text`（マスタの生バイトをそのままコピー）→ バイト比較。
  **つまり「意味的に同一」であればキーの並び順や引用符の差は問題にならない**

**結論：案 D で `--check` 12/12 バイト一致は保てる。ただし「マスタと `cloud-master` env を同時に変える」ことが必須条件**であり、
片方だけを変えると落ちる。落ちる場所は **2 か所**：`tools/verify.mjs` §12-d（803〜815 行目。`npm test` の中で `render.py --env cloud-master --all --check` を実行している）と、
`.github/workflows/verify.yml` の独立ステップ `Run render.py --check`。**つまり `npm test` だけでこの不変条件は検出できる。**

### 5-2. 実際に流して確かめた（worktree 上の一時変更。commit していない）

| 実験 | 内容 | 結果 |
|---|---|---|
| 基準 | 現状のまま `render.py --env cloud-master --all --check` | **12/12 `[OK]`、exit 0** |
| **A** | マスタ 4 本だけ `reranking_enable: true` ＋ provider/model を入れ、env は空のまま | **`[DIFF]` が GN-01・KN-01・KN-02・KN-03 の 4 本、exit 1**（＝R3 が false に戻すため） |
| **B** | A に加えて `cloud-master` env の `models.rerank` に同じ値を入れる | **12/12 `[OK]`、exit 0**（案 D が成立する） |
| **C** | B の状態で `--env inhouse --all` を実行 | R3 が 4 本とも `provider= model= enable=False` に戻す（**env で無効化できる**） |
| **D** | B の状態で `--env customer-a --all` を実行 | R3 が 4 本とも `langgenius/siliconflow/siliconflow` / `BAAI/bge-reranker-v2-m3` / `enable=True` に置換（**顧客環境は影響を受けない**） |

実験後は `git checkout -- dify/apps dify/env` で戻し、`--check` が 12/12 に復帰することを確認済み。**この設計書の PR には一切含まれていない。**

### 5-3. `scripts/dify/kb_upload.py` の `build_retrieval_model()`（DI-016）との整合

`build_retrieval_model()` は **dataset（KB）作成時の既定検索設定**を送るもので、`reranking_enable: False` を含む。
**これは変更しない。** 理由：

1. **層が違う**（§2）。`retrieval_mode: multiple` のノードは `multiple_retrieval_config` で動くので、dataset 既定は実行時に効かない
2. DI-016 で「`retrieval_model` の部分指定は 400 になる。完全な形なら 200」を実測して直したばかりの箇所であり、
   ここを触ると `POST /datasets` の 400 リスクを再び開ける。**Rerank を有効にする目的（公開チェックリストを通す）とは無関係**
3. dataset 既定を Rerank ON にすると、**DI-005 で 429 を出した層がまさにそこ**なので、わざわざ戻す理由が無い

**ただし「dataset 既定 OFF ＋ ノード ON」で検索が正しく動くことは、E3（16 件のテスト）で確かめる。**
状況証拠としては、KN-02・KN-03・GN-01 の KB は `kb_upload.py` 経由（＝dataset 既定 OFF）で作られ、
DI-012 の環境（ノード Rerank ON）で 24/24 が通っているので、**すでに一度この組み合わせで動いている可能性が高い**（§1 Q2 のとおり断定はしない）。

### 5-4. 「実機の事実が git に残らない」への最小の手当て

`dify/results/**` の様式は今回変えない（`run_tests.py` は Service API キーしか持たず、アプリのノード設定を読めない＝ここでは直せない）。
代わりに **PR-3 で、E1〜E3 の実測値を `dify/env/README.md` の台帳の `根拠` 列と `dify/KNOWN_ISSUES.md` DI-033 に日付つきで書く**。
`dify/state/<env>.yml`（機械が書く実機の事実）の導入は本 Issue のスコープ外とし、#114 系の別 Issue に残す（§12）。

---

## §6 変更する範囲 / 触らない範囲

### 変更する（これ以外を触ったら reviewer は差し戻す）

```
dify/apps/KN-01-tech-knowledge-qa.yml        multiple_retrieval_config の 2 キーのみ
dify/apps/KN-02-equipment-manual-search.yml  同上
dify/apps/KN-03-internal-rules-qa.yml        同上
dify/apps/GN-01-expense-check.yml            同上
dify/env/cloud-master/env.yml                models.rerank の 1 行のみ
dify/env/README.md                           台帳 cloud-master 行 / 118 行目 / 用途表の rerank 行 / inhouse の注記
dify/KNOWN_ISSUES.md                         DI-005 追記・DI-012 追記・DI-033 新規
docs/dify/decisions-pending.md               DP-40 に追記（行は消さない）
dify/DEPLOY.md                               §1-①4 / §1-②の Rerank 記述 / §1-④3 / §3 の文面例
docs/handoff/2026-09-09-rerank-decision.md   本書（PR-0 で追加済み）
```

### 触らない（明示）

- **`mock/**` 全部**（`CATS` / `SVCS` / `TAGS` / `T` / CSS トークン / `scenarios/**`）。本件は UI に一切関係しない
- **`tools/verify.mjs`・`tools/regress.mjs`・`tools/regress.baseline.json`**。`verify.mjs` §12-d が既に `render.py --check` を回して不変条件を守っているので、
  Rerank 用の新しい機械検査は**足さない**（検査の二重化はコストだけ増える）
- **`scripts/dify/render.py`**。R3 のロジックは変更不要（§5-1・§5-2 で確認済み）。「空なら触らない」に変えると
  **顧客環境が意図せず OpenRouter の Rerank を引き継ぐ**ので、むしろ現状のセマンティクスが正しい
- **`scripts/dify/kb_upload.py`**（`build_retrieval_model()` は現状維持。§5-3）
- **`scripts/dify/sync_back.py`**（N5/R3 のロジックは変えない。マスタが実機に一致することで差分が自然に消える）
- **`scripts/dify/cloud_deploy.py`・`.github/workflows/dify-ops.yml`**（W4-4 の実装は #121 側の PR。本件はその前提条件を整えるだけ）
- **`dify/env/inhouse/env.yml`・`dify/env/customer-a/env.yml`**（`models.rerank` の値は変えない。§4-3）
- **`dify/apps/` の残り 8 本**（KB を引かないので `knowledge-retrieval` ノードが無い）
- **`dify/tests/**`・`dify/results/**` の既存ファイル**（新しい結果の追加は E3 の産物であって、本設計の変更対象ではない）
- **`CLAUDE.md`**（§2-12 の load-bearing はそのまま。本設計は §2-12 を守る側の変更である）
- **`.claude/**`**

---

## §7 受け入れ条件

### 機械で確認するもの（クラウドで回る）

- [ ] `python3 scripts/dify/render.py --env cloud-master --all --check` が **12/12 `[OK]`、exit 0**（`npm test` の `verify.mjs` §12-d でも同じものが走る）
- [ ] `python3 scripts/dify/render.py --env inhouse --all --strict` / `--env customer-a --all --strict` が exit 0 で、
      `render-report.md` の R3 行が **inhouse＝`enable=False`／customer-a＝`bge-reranker-v2-m3` `enable=True`** になっている
- [ ] `npm test`（`tools/verify.mjs` ＋ `tools/regress.mjs`）**ALL PASS**。**`regress` の `--update` は行わない**（データ層は無変更）
- [ ] `python3 -m pytest scripts/dify/tests`（または既存のテスト実行方法）が従来どおり PASS
- [ ] `git diff --name-only` が §6「変更する」の一覧の部分集合であること

### 文書として確認するもの

- [ ] `dify/env/README.md` の台帳と `dify/env/cloud-master/env.yml` の値が一致している（台帳ルール 1・5）
- [ ] 台帳の `cloud-master` 行の `確認状態` が、E2/E3 の前は **`未確認`**、後は **`確認済`＋日付＋根拠**（台帳ルール 3・4）
- [ ] `dify/DEPLOY.md` に **「build 版を使うときの Rerank」** が書かれている（案 D 適用後は「手作業は不要」、適用前は「1 手が要る」）
- [ ] DI-005 が「Rerank 全般の禁止根拠」として読めない状態になっている
- [ ] `dify/env/**/env.yml` に秘密・実名・実 URL・dataset id が増えていない（`verify.mjs` §12。モデル名は対象外）

### 実機で確認するもの（`run:mac`。§9）

- [ ] **E2**：`dify/build/cloud-master/` の 4 本をインポート → **UI で何も選ばずに公開できる**（チェックリストが止まらない）
- [ ] **E3**：公開後 `python3 scripts/dify/run_tests.py --env cloud-master KN-01 KN-02 KN-03 GN-01` が **16/16 合格**（2026-09-08 20:45 の batch と同じ合否）。**429 が 1 件も出ない**
- [ ] E3 の結果ファイルが `dify/results/cloud-master/` に commit されている

---

## §8 PR 分割

| PR | 内容 | 触るファイル | 前提 | 実行場所 |
|---|---|---|---|---|
| **PR-0** | **本設計書の追加のみ**（コード変更なし） | `docs/handoff/2026-09-09-rerank-decision.md` | なし | `run:cloud` |
| **PR-1** | **記録の訂正と手順の明記**（案 D の採否に関わらず要る分） | `dify/KNOWN_ISSUES.md`（DI-005 追記・DI-012 追記・DI-033 新規）／`docs/dify/decisions-pending.md`（DP-40 追記）／`dify/DEPLOY.md`（build 版を使うと Rerank で止まること、暫定の 1 手）／`dify/env/README.md`（118 行目の誤った 1 文の訂正） | PR-0 マージ。**PM の案 D 承認は不要**（事実の訂正と手順の明記だけ） | `run:cloud` |
| **PR-2** | **案 D の適用**（マスタ 4 本＋`cloud-master` env＋台帳） | `dify/apps/{KN-01,KN-02,KN-03,GN-01}-*.yml`／`dify/env/cloud-master/env.yml`／`dify/env/README.md`（台帳行・用途表） | **PM の案 D 承認（§11 P-1）** ＋ **E1 の採取結果**（provider/model の正確な文字列） | `run:cloud`（値の入手だけ `run:mac`） |
| **PR-3** | **実機確認の反映** | `dify/env/README.md`（`確認状態` を `確認済`＋日付＋根拠へ）／`dify/KNOWN_ISSUES.md`（DI-033 を `fixed`、DI-005/DI-012 に実測日を追記）／`dify/results/cloud-master/*.md`（E3 の結果） | PR-2 マージ＋E2/E3 実施 | `run:mac`（結果の commit は自動 PR の許可パス `dify/results/**` に収まる。**台帳と KNOWN_ISSUES は人が別 PR で**） |

**並列可否**：PR-1 と PR-2 は**直列**（どちらも `dify/env/README.md`・`dify/KNOWN_ISSUES.md` を触る）。
**#121（W4-2）・#121 系の W4-4 の PR とは並列可**（触るファイルが違う）。ただし **W4-4 の実機受け入れ（12 本投入→公開）は PR-2 のマージ後**に回すこと。

**PR-3 の注意**：`docs/handoff/2026-09-08-execution-split-and-runner.md` の「実機側の自動 PR は `dify/results/**` と `dify/state/**` 以外を書かない」に反しないよう、
**結果ファイルの commit と、台帳・KNOWN_ISSUES の更新は別 PR にする**（結果は自動 PR、台帳更新は人の PR）。

---

## §9 実機で確認する項目（`run:mac`。PR-2 の前提）

| # | 何を | どうやって | なぜ要るか |
|---|---|---|---|
| **E1** | **Rerank の provider / model の正確な文字列** | Cloud で KN-01 を開く → 知識検索ノードで KB を紐づけて Rerank が自動で入った状態にする → 「DSL をエクスポート」→ `multiple_retrieval_config` の `reranking_model.provider` / `.model` / `reranking_mode` / `top_k` / `score_threshold` を**そのまま**転記する（値は秘密ではない） | **PR-2 の値を推測で書かないため。**「`langgenius/openrouter/openrouter` だろう」という見込みは git のどこにも実測がない |
| **E2** | **build 版が手作業ゼロで公開できるか** | PR-2 のブランチで `python3 scripts/dify/render.py --env cloud-master --all` → `dify/build/cloud-master/` の KB 付き 4 本を「DSL をインポート → 上書き」→ **画面で何も選ばずに公開**を押す | #195 の本丸。ここが通らなければ案 D は無意味 |
| **E3** | **合否が退行していないか／429 が出ないか** | `python3 scripts/dify/run_tests.py --env cloud-master KN-01 KN-02 KN-03 GN-01` → 16/16。結果を commit | DI-005 の 429 が「一過性」か「上限」かを、いま分かる範囲で確かめる唯一の手段（§1 Q1） |
| **E4**（任意・ついで） | **Console API の publish がサーバ側でチェックリストを検証するか**（#114 U3／W4 §11 V8） | W4-4 の `op: deploy` を回すときに、Rerank 未指定の 1 本で `POST /console/api/apps/{id}/workflows/publish` の応答を見る | **案 D の採否には影響しない**（§3 の理由 2）。W4-4 の設計精度のために取れるなら取る |

**E1 が取れないとき**：PR-2 を止める。見込み値で先に入れて「インポートは通るが公開でまた止まる」を作るくらいなら、
PR-1（手順の明記）で運用しながら待つほうが安い。

---

## §10 ロールバック

E3 で **429 が再発した**、または合否が退行した場合：

1. **PR-2 の 1 コミットを revert する**（マスタ 4 本と `cloud-master` env は同じ PR にあるので、revert で必ず同時に戻る＝ `--check` も 12/12 に戻る）
2. `dify/KNOWN_ISSUES.md` DI-033 を `open` のまま残し、**429 の再現条件（何件目・どの時間帯・どのテスト）を追記**する。
   ここで初めて「DI-005 の 429 は一過性ではなくレート上限だった」という事実が git に残る
3. 運用は PR-1 の手順（人が 1 手 Rerank を選ぶ）に戻す。W4-4 の受け入れ条件は「公開の 1 手は手作業」に読み替えて PM に再判断を仰ぐ
4. 次の候補は **案 B（`weighted_score`）**。その時点で `2026-09-08-thinking-budget-and-streaming.md` §11-C1 の実機確認 3 点から始める

**「マスタと env を同じ PR に入れる」ことがロールバックの安全装置でもある**ので、PR-2 を分割しないこと。

---

## §11 PM が決めること（選択肢と architect 推奨）

| # | 判断 | 選択肢 | **architect 推奨** | 理由 |
|---|---|---|---|---|
| **P-1** | **DP-40 を案 c から案 d（マスタ DSL に Rerank を明示）へ変更するか** | (a) 案 d に変更する（＝本設計の PR-2 を実行）／(b) 案 c のまま。公開のたびに人が 1 手（＝PR-1 だけ実行）／(c) 案 B（`weighted_score`）を先に検証する | **(a)** | W4-2 の前提が変わった以上、案 c は「手数ゼロ」ではなくなった。案 d は**新しい構成を入れず、実機の状態を git に写すだけ**で、W4-4 の受け入れ条件をそのまま満たせる。(c) は未確認事項が 3 点残っており、いま W4-4 を止める理由にならない |
| **P-2** | **`inhouse` の `models.rerank` をどうするか** | (a) 空のまま（本設計の既定）／(b) Ollama の Rerank モデル名を入れる | **(a)** | `inhouse` は台帳で **未確認**環境。実機で通ることを確かめずにモデル名を書くのは §2-12 の「入れる前に実機で確かめる」に反する。セルフホストで同じチェックリストに当たったら、その時点で実測して入れる |
| **P-3** | **`kb_upload.py` の dataset 既定（Rerank OFF）を変えるか** | (a) 変えない（本設計の既定）／(b) ノードと同じく ON にそろえる | **(a)** | 層が違う（§2）。DI-016 で直したばかりの `POST /datasets` の body を触る利益が無い。DI-005 で 429 を出した層をわざわざ戻すことになる |
| **P-4** | **DI-005 の行そのものを書き換えるか、追記にとどめるか** | (a) 追記のみ（本設計の既定）／(b) 症状・原因の文面も直す | **(a)** | `KNOWN_ISSUES.md` の冒頭ルールが「直したら行を消さず状態と対処に書く」。観測記録そのものは書き換えない方が台帳の価値が保てる |

---

## §12 本 Issue のスコープ外（別 Issue に残す）

- **`dify/state/<env>.yml` の導入**（実機の事実を機械が書く場所）。§1 Q2 で見つかった「合格時の実機構成が git に残らない」問題の恒久対応。#114 系
- **案 B（`weighted_score`）の検証**。DI-012 が「別 Issue で検討」として残したもの。実機確認 3 点は `2026-09-08-thinking-budget-and-streaming.md` §11-C1
- **`sync_back.py` の N5 対象の見直し**（DI-015 の恒久対応）。案 D で R3 の雑音は消えるが、`completion_params` 由来の R1 差分は残る
- **W4-4 の `op: deploy` の実装**（#121）。本設計はその前提条件を整えるだけで、ワークフローには触らない
