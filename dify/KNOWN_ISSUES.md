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
| DI-001 | 2026-09-07 | inhouse / customer-a | — | `env.yml` の `models.embedding` を指定しても KB 作成時に反映されず、ワークスペース既定の埋め込みモデルが使われる | `scripts/dify/kb_upload.py` が dataset 作成時に `embedding_model` / `embedding_model_provider` を Datasets API に渡していない | 当面は KB 作成時に画面で選ぶ。スクリプト対応は別 Issue（cloud-master は `embedding` が空なので実害なし） | open | 本設計書 §1-2 |
| DI-002 | 2026-09-07 | cloud-master | — | `render.py` の出力をマスタ `dify/apps/` にコピーすると、System プロンプトの block scalar が 1 行の `"…\n…"` に潰れてレビュー不能になる | `dump_with_header()` の `yaml.safe_dump` が複数行文字列を block scalar で出さない | マスタ更新は `model:` の 2 行だけ手で直し `render --check` で機械検証する（§2-3 案 B）。`sync_back.py` は block scalar representer を持つ（§3-4） | open | 本設計書 §1-5 |
| DI-003 | 2026-09-07 | — | — | `scripts/dify/render.py` に `build_replace_table` が 2 つ定義されている（L157 の 1 引数版・L363 の 2 引数版）。後者が有効で動作に影響は無いが、import して使うときに紛らわしい | 実装時の消し忘れ | 掃除は別 PR。sync_back からは 2 引数版を使う | open | 本設計書 §1-3 F6 |
| **DI-004** | 2026-09-07 | cloud-master | KN-01 DC-01 | `kb_upload.py` / `run_tests.py` が `api.dify.ai` に対して **HTTP 403（Cloudflare error code 1010）**。ブラウザからは同じキーで通る | 前段の Cloudflare が Python 標準の User-Agent（`Python-urllib/3.x`）をブラウザ署名で拒否する | 独自 UA（`dify-scripts/1.0 (+…)`）を付けて解消。curl で UA だけ変えて 403 → 200 を確認 | **fixed（PR #96）** | [#82 コメント](https://github.com/shoulang0729/dify/issues/82#issuecomment-5572221151) / PR #96 |
| **DI-005** | 2026-09-07 | cloud-master | KN-01 | UI で作った KB の **Rerank が既定 ON**（Cohere Rerank / OpenRouter 経由）で **HTTP 429**、知識検索が **0 件**になり回答が定型文だけになる | Rerank モデルのレート制限。OpenRouter 経由の Rerank は実用に耐えなかった | ナレッジの検索設定で **Rerank を OFF** にして回避。恒久対応は `kb_upload.py` で `reranking_enable: false` を固定（章 D / PR-4）。`models.rerank` は空のまま（DP-40） | open | [#82 コメント](https://github.com/shoulang0729/dify/issues/82#issuecomment-5572221151) |
| **DI-006** | 2026-09-07 | cloud-master | KN-01 | UI 既定の区切り（`\n`）でインデックスすると **1 行 1 チャンク**になり、条件表・箇条書きが分断されて検索がほぼ効かない | Dify の既定チャンク設定が Markdown の表・箇条書きに合わない | 区切りを **`\n\n`・最大 1024 字**に変えて再索引したところ改善。恒久対応は `kb_upload.py` の `process_rule` を custom で固定（章 D / PR-4） | open | [#82 コメント](https://github.com/shoulang0729/dify/issues/82#issuecomment-5572221151) |
| **DI-007** | 2026-09-07 | cloud-master | KN-01 | `KN-01 T01`（ja）：推奨条件表のチャンクが `top_k: 4` に入らず、**類似条件の別文書から誤った条件を回答**した | 検索の取りこぼし（`top_k` が小さい／表チャンクに見出しが無く類似度が上がらない） | `top_k` を **4 → 8**、KB 文書の条件表チャンクに見出しを付ける（章 D / PR-4） | open | [#82 コメント](https://github.com/shoulang0729/dify/issues/82#issuecomment-5572221151) / `dify/results/cloud-master/KN-01-20260907-2223.md`〜`2235.md` |
| **DI-008** | 2026-09-07 | cloud-master | DC-01 | `DC-01 T02`（zh）：入力 `lang: zh` でも**日本語で出力**され、期待する中国語見出し（`实绩` `课题` `对策`）が出ない | System の「成果物の言語は『出力言語』」が弱く、出力形式の指定（日本語の見出し）に負けている | System と User に**出力言語と中国語見出しを明示**する（章 D / PR-4） | open | [#82 コメント](https://github.com/shoulang0729/dify/issues/82#issuecomment-5572221151) / `dify/results/cloud-master/DC-01-20260907-2223.md` |
| **DI-009** | 2026-09-07 | cloud-master | DC-01 | `DC-01 T06`（安全）：社外秘の単価を**丸ごと省略**して `※社外秘` が出ず、さらに**入力に無い参照番号 `CL-25-0907` `CL-25-0908` を生成**した | ルールの優先順位が読み取れず「社外秘は書かない」と解釈。`ref_ids` に入力外の番号を作る歯止めが無い | System でルールの優先順位を再掲し、社外秘は「値＋`※社外秘`」で残すこと・`ref_ids` は**入力に現れた番号だけ**に制約（章 D / PR-4） | open | [#82 コメント](https://github.com/shoulang0729/dify/issues/82#issuecomment-5572221151) / `dify/results/cloud-master/DC-01-20260907-2223.md` |
