# dify/env/ — 環境レイヤー（マスタ DSL → 各環境の差分）

`dify/apps/<番号>-<slug>.yml` は **マスタ**（PM の Dify Cloud、`api.dify.ai / openrouter・qwen/qwen3.8-max` の既定値で動く 1 本）。
社内環境・顧客ごとの環境差分（モデル・KB・社名・拠点・フラグ）は、この `dify/env/<env>/env.yml` **1 枚だけ**に閉じ込める。
マスタを環境ごとに fork しない。`scripts/dify/render.py --env <env>` がマスタに env を流し込み、`dify/build/<env>/` に出力する
（詳しい仕組みは `docs/handoff/2026-09-07-repo-layout-v2.md` §4）。

## 環境を足す手順

1. `dify/env/<新しい env 名>/` ディレクトリを作る
2. `dify/env/customer-a/env.yml` を丸ごとコピーして `dify/env/<新しい env 名>/env.yml` に置く
3. 先頭の `name:` をディレクトリ名と同じ値に変える（`render.py --strict` が照合する）
4. 新しく `${VAR}` を使ったら、`scripts/dify/env.example` にその変数名を追記する
5. `python3 scripts/dify/render.py --env <新しい env 名> --all --strict` が通ることを確認する

**アプリ側（`dify/apps/*.yml`）は増えない。** 顧客が増えても env を 1 枚足すだけ。

## 書いてよい値／書いてはいけない値

| 置く | 置かない |
|---|---|
| 構造・キー名・**公開しても困らない既定値**（`cloud-master` の `api.dify.ai`・`qwen/qwen3.8-max` など） | **顧客の実名・実 URL・dataset id・API キー・メール・パスワード** |
| モデルの用途別割り当て（provider / name） | モデルの API キー（`provider` の資格情報は Dify 側の設定） |
| 論理 KB 名 → 環境の KB 名（`id` は任意・既定 `null`） | 顧客環境で採番された id を**直値で**書くこと（`${VAR}` にする） |
| ブランド語彙の置換表（架空世界の語 → 環境の語） | 顧客社名そのもの（`${BRAND_COMPANY_JA}`） |
| フラグ（越境・パートナー・PIPL マスク） | フラグの根拠となる法務判断の文書（`docs/dify/decisions-pending.md` を参照するだけ） |

`env.yml` の値に `${NAME}` があれば `render.py` がプロセス環境変数で置換する。`--strict` で未定義なら **exit 1**（黙って空文字にしない）。

## 環境変数の一覧と設定ファイルの置き方

一覧は [`scripts/dify/env.example`](../../scripts/dify/env.example)。環境ごとに 1 ファイルを **リポジトリの外** に置く：

```bash
mkdir -p ~/.config/dify
cp scripts/dify/env.example ~/.config/dify/customer-a.env
# ~/.config/dify/customer-a.env を編集して値を入れたら
export DIFY_ENV=customer-a
set -a; source ~/.config/dify/$DIFY_ENV.env; set +a
```

## 環境台帳（この表と `env.yml` は同じ PR で必ず一緒に更新する）

| env | edition | 接続先の種類 | モデルプロバイダ | chat | reasoning | embedding | rerank | 外部到達 | 確認状態 | 確認日 | 根拠 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `cloud-master` | cloud | Dify Cloud（PM のワークスペース） | `langgenius/openrouter/openrouter` | `qwen/qwen3.8-max` | `moonshotai/kimi-k3` | （空＝ワークスペース既定） | （空＝無効） | OpenRouter に出られる | **確認済**（PM の契約） | 2026-09-07 | Issue #82 のコメント／`docs/handoff/2026-09-07-china-models-and-syncback.md` §1-1 |
| `inhouse` | selfhost | 社内セルフホスト（Community 1.15.x 想定） | `langgenius/ollama/ollama` | `${INHOUSE_CHAT_MODEL}` | `${INHOUSE_REASON_MODEL}` | `${INHOUSE_EMBED_MODEL}` | （空＝無効） | 外部 API に出られるか**未確認** | **未確認** | — | PM 談（2026-09-07）「Ollama とかだと思う」 |
| `customer-a` | selfhost | 顧客 A（中国拠点） | `langgenius/siliconflow/siliconflow` | `Qwen/Qwen3.5-397B-A17B` | `Pro/moonshotai/Kimi-K2.6` | `BAAI/bge-m3` | `BAAI/bge-reranker-v2-m3` | 越境 `deny`（`flags.cross_border`）。国外 API へは出さない前提 | **未確認** | — | DP-01 (a)／`decisions-pending.md` |

**台帳の書き方・更新ルール**

1. **`env.yml` を変えたら、同じ PR で台帳の行も更新する。** 片方だけの PR は reviewer が差し戻す
2. **顧客の実名・実 URL・dataset id・API キー・メールを書かない**（`CLAUDE.md` §2-10）。接続先は「Dify Cloud」「社内セルフホスト」「顧客 A（中国拠点）」のような**種類**で書く。URL は `${VAR}` の名前すら書かなくてよい
3. **「確認状態」は 2 値**：`確認済`（**その環境で実際にアプリを動かし、モデルが呼べたことを人が見た**）／`未確認`。推測で `確認済` にしない。`確認日` は確認した日、`根拠` は Issue / PR のコメント URL か設計書の節番号
4. モデルを**入れ替えたら確認状態は `未確認` に戻す**（同じ環境でも別モデルは別の話）
5. 機械検査でできるのは「`env.yml` に必須キーがある」「秘密・URL の直値が無い」まで（`tools/verify.mjs` §12）。**台帳と `env.yml` の値が一致しているかは reviewer が目で照合する**
6. 環境を足したら台帳に 1 行足す（上の「環境を足す手順」の 6 番目として実施する）

## モデル用途 4 種の意味

| 用途 | 何に使うか |
|---|---|
| `chat` | 生成（Answer を返す LLM ノード） |
| `reasoning` | 分類・抽出・判定（question-classifier / parameter-extractor / single_retrieval_config の判定モデル） |
| `embedding` | KB の索引作成（`kb_upload.py` が dataset 作成時に使う） |
| `rerank` | 検索結果の再ランク（空なら `reranking_enable: false`） |

**既定プロバイダは cloud-master が OpenRouter**（`langgenius/openrouter/openrouter`）。`chat` = `qwen/qwen3.8-max`、`reasoning` = `moonshotai/kimi-k3`。アプリ単位で振り替えるための追加 role **`kimi`**（kimi-k3）と **`qwen_small`**（`qwen/qwen3.6-35b-a3b`）を全 env に定義してある（**`overrides` の role がその env に無いと、警告も出ずにマスタの既定モデルのまま動く**ので、role は必ず全 env に置く）。`overrides` が効くのは `llm` ノードだけ。

OpenRouter プラグインは **customizable-model 対応**なので、一覧に無いモデル id もモデル設定画面で手入力して使える。

**API キーとベース URL は Dify の「設定 → モデルプロバイダー」に入れるもので、`env.yml` にも DSL にも書かない**（`CLAUDE.md` §2-10）。`env.yml` に URL を書くと `tools/verify.mjs` §12 が FAIL する。

`embedding` は `cloud-master` だけ空（KB 作成時のモデル指定はワークスペース既定に任せる）。**Rerank は有効にしない**（DP-40・DI-005）。

**`embedding` を変えたら、既存 KB は作り直しが要る**（索引ベクトルの次元・意味が変わるため）。

## 環境を選んでリリースする

render だけでなく import・KB 投入・テスト・tag・CHANGELOG まで通しでやるなら `scripts/dify/release.py --env <env> --all`
（まず `--dry-run` で確認）。手順・環境変数は [`../DEPLOY.md` §5](../DEPLOY.md#5-環境を選んでリリースする)。
