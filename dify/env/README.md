# dify/env/ — 環境レイヤー（マスタ DSL → 各環境の差分）

`dify/apps/<番号>-<slug>.yml` は **マスタ**（PM の Dify Cloud、`api.dify.ai / gpt-4o-mini` の既定値で動く 1 本）。
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
| 構造・キー名・**公開しても困らない既定値**（`cloud-master` の `api.dify.ai`・`gpt-4o-mini` など） | **顧客の実名・実 URL・dataset id・API キー・メール・パスワード** |
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

## モデル用途 4 種の意味

| 用途 | 何に使うか |
|---|---|
| `chat` | 生成（Answer を返す LLM ノード） |
| `reasoning` | 分類・抽出・判定（question-classifier / parameter-extractor / single_retrieval_config の判定モデル） |
| `embedding` | KB の索引作成（`kb_upload.py` が dataset 作成時に使う） |
| `rerank` | 検索結果の再ランク（空なら `reranking_enable: false`） |

**`embedding` を変えたら、既存 KB は作り直しが要る**（索引ベクトルの次元・意味が変わるため）。
