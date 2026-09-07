# dify/ — Dify Cloud に実際にインポートする DSL とテスト資材

`docs/dify/usecases/<管理番号>.md` の設計を、Dify Cloud（`cloud.dify.ai`）に **「DSL をインポート → URL から」** で取り込める YAML にしたもの。
モック（`mock/`）とは独立。ここにあるものは Dify に入れて動かすための資材だけ。

Mac から全自動で投入・テストする手順は [`DEPLOY.md`](./DEPLOY.md)。ここでは **何があるか・手でインポートする手順・規約** だけ書く。

環境ごとの差分（モデル・KB・社名・拠点・フラグ）は `dify/apps/*.yml` に直接書かず [`dify/env/<env>/env.yml`](./env/) **1 枚**に閉じ込める。マスタは常に 1 本で、社内・顧客環境へは [`scripts/dify/render.py`](../scripts/dify/render.py) が流し込む（[`dify/env/README.md`](./env/README.md)）。

## ファイル

| パス | 内容 |
|---|---|
| `apps/KN-01-tech-knowledge-qa.yml` | **KN-01 技術ナレッジQA**。Chatflow（`advanced-chat`）。Start → Knowledge Retrieval → LLM → Answer |
| `apps/DC-01-hq-report-draft.yml` | **DC-01 日本本社への報告資料作成**。Workflow。Start（フォーム 4 変数）→ LLM → End |
| `env/<env>/env.yml` | **環境レイヤー**（`cloud-master` / `inhouse` / `customer-a`）。モデル・KB・社名・拠点・フラグの環境差分（[`env/README.md`](./env/README.md)） |
| `kb/KN-01/*.md` | KN-01 用のダミー文書 3 本（架空・青嶺精工 蘇州工場。台本 `SCENARIOS.kn1` の数値と一致） |
| `tests/<管理番号>.json` | Service API で流すテスト（`docs/dify/usecases/*.md` §7 から正常 ja／正常 zh／境界／安全の 4 件） |
| `results/` | `scripts/dify/run_tests.py` の出力先（`<管理番号>-<YYYYMMDD-HHMM>.md`） |
| `build/<env>/` | `render.py` の生成物（**`.gitignore` 対象。commit しない**） |
| `check.py` | DSL の構造チェック（砂箱用。PyYAML 必要。`dify/apps/*.yml` だけでなく `dify/build/<env>/*.yml` にも使える） |
| `../scripts/dify/render.py` | `env/<env>/env.yml` をマスタ DSL に流し込み `build/<env>/` に出力（[下記「環境を選んでインポートする」](#環境を選んでインポートする)） |
| `../scripts/dify/release.py` | render → import → KB → test → tag → CHANGELOG を通しで実行（[`DEPLOY.md` §5](./DEPLOY.md#5-環境を選んでリリースする)） |
| `../scripts/dify/console_api.py` | セルフホストの Console API（login / import_dsl / list_apps / publish）を閉じ込めたクライアント。`release.py` の selfhost 経路から呼ばれる |
| `../scripts/dify/kb_upload.py` | `kb/<管理番号>/` を Datasets API で KB に投入（標準ライブラリのみ。`--env` 対応） |
| `../scripts/dify/run_tests.py` | `tests/<管理番号>.json` を Service API で実行し `results/<env>/` に書く（`--env` 対応） |
| `../scripts/dify/env.example` | 環境変数の雛形（値は空） |
| `CHANGELOG.md` | `release.py` が合格リリースごとに 1 行追記するリリース履歴 |
| `KNOWN_ISSUES.md` | 投入・テスト・Cloud 調整で**実際に出た**不具合の記録（`DI-xxx` 連番。設計時点のリスクは `docs/dify/usecases/<番号>.md` §10） |

## 環境を選んでインポートする

`dify/apps/*.yml` は **マスタ**（PM の Dify Cloud、`cloud-master` の既定値で動く 1 本）。社内環境・顧客環境へ配るときは、
その環境の差分を `dify/env/<env>/env.yml` に置き、`render.py` でマスタに流し込んでから使う（詳しくは [`env/README.md`](./env/README.md)）。

```bash
# マスタと同じ内容が出る（cloud-master は render しなくても動く。以下は確認用）
python3 scripts/dify/render.py --env cloud-master --all --check

# 社内・顧客環境向けに実際にファイルを生成する（dify/build/<env>/ へ。.gitignore 対象）
export DIFY_ENV=customer-a
set -a; source ~/.config/dify/$DIFY_ENV.env; set +a
python3 scripts/dify/render.py --env $DIFY_ENV --all --strict
```

- **`cloud-master`**：render は恒等（出力＝マスタとバイト一致）。マスタの raw URL をそのまま貼ってインポートできる（下記）。ビルドは不要
- **その他の env × Cloud**：Dify の「DSL ファイルをインポート」は**ローカルファイルのアップロード**にも対応しているので、`dify/build/<env>/*.yml` をファイル選択で入れる
- **その他の env × セルフホスト**：`scripts/dify/console_api.py`（`release.py` から呼ばれる）または画面から `dify/build/<env>/*.yml` をインポートする
- `--strict` を付けると `${VAR}` の未定義・`models.overrides` の不一致などを exit 1 で検出する（値はログに出さない）
- **`render` から先（import・KB・test・tag・CHANGELOG）まで通しでやるなら** `scripts/dify/release.py --env <env> --all`（まず `--dry-run` で確認。[`DEPLOY.md` §5](./DEPLOY.md#5-環境を選んでリリースする)）

## インポート手順（手動・cloud-master）

1. Dify Cloud → **Studio** → 「アプリを作成」→ **「DSL ファイルをインポート」**
2. **URL** タブを選び、raw URL を貼る → 「作成」
   ```
   https://raw.githubusercontent.com/shoulang0729/dify/main/dify/apps/KN-01-tech-knowledge-qa.yml
   https://raw.githubusercontent.com/shoulang0729/dify/main/dify/apps/DC-01-hq-report-draft.yml
   ```
   `version: 0.6.0` は Cloud より古いため「古いバージョン」の警告が出ることがある。警告なら続行してよい

### インポート後にやること

| # | KN-01 | DC-01 |
|---|---|---|
| 1 | LLM ノードの**モデル**が DSL の指定（`openrouter / qwen/qwen3.8-max`）どおり選ばれているか確認する。選べない場合は**プロバイダー未設定**（設定 → モデルプロバイダーで OpenRouter を追加） | 同じ |
| 2 | **ナレッジベースを作成**し `kb/KN-01/` の 3 本をアップロード → 「知識検索」ノードの **ナレッジを追加** で紐づける（DSL の `dataset_ids` は空で入っている）。スクリプトなら `python3 scripts/dify/kb_upload.py KN-01`。**ナレッジの「検索設定」で Rerank を OFF にする**（既定 ON のままだと OpenRouter 経由の Rerank が 429 になり検索 0 件。`dify/KNOWN_ISSUES.md` DI-005）。チャンクの区切りは `\n\n`・最大 1024 字（DI-006） | — |
| 3 | 右上「公開」 | 右上「公開」 |

## 動作確認（台本 kn1 / dc1 から各 1 問）

| アプリ | 言語 | 入力 | 期待 |
|---|---|---|---|
| KN-01 | ja | `SUS304 の Φ8 深穴（深さ 60mm）ドリル加工、推奨条件を教えて` | 切削速度 18〜22 m/min／送り 0.06 mm/rev／ステップ 3D／クーラント 2.0 MPa と、根拠 TR-2023-041・TR-2024-007・TR-2024-102 |
| KN-01 | zh | `SUS304 Φ8 深孔（深60mm）钻孔加工，推荐条件是什么？` | 同内容を中国語で |
| DC-01 | ja | 対象月 `2025 年 8 月`／拠点 `蘇州工場`／メモ `产量 186,400件（计划 190,000）。不良率 0.42%（目标 0.40%）。稼动率 87.2%。加班 2,140h。安全：无事故（连续 412天）。 トピックス：K 社クレーム 1 件（塗装ブツ、8D 提出済）／材料 S 社 +9% 値上げ通知／新人 12 名入社`／出力言語 `ja` | 「1. 要旨／2. 実績／3. 課題／4. 対策・見通し」の Markdown。数値は入力どおり、達成率は計算しない |
| DC-01 | zh | 同じメモで出力言語 `zh` | 同じ章立ての中国語版 |

自動で流すなら `python3 scripts/dify/run_tests.py KN-01 DC-01`（[`DEPLOY.md`](./DEPLOY.md) §1-③）。

## うまくいかないとき

- **エラー文をそのまま**（画面のメッセージ、または HTTP ステータス＋本文）Issue かチャットに貼る。API キーは貼らない
- インポートが**エラー**で止まる場合：`version` の互換か、フィールド名の変更が疑われる。エラー文に出るノード名・キー名を報告する
- 回答が定型文（「該当する記録が見つかりません」）だけ：KB が未紐づけかインデックス未完了。[`DEPLOY.md`](./DEPLOY.md) §4

## 任意：MCP サーバーとして公開 → claude.ai コネクタ

Dify Cloud はアプリを MCP サーバーとして公開できる（アプリ → 「公開」→ 「MCP サーバーとして公開」）。
表示された URL を claude.ai の **設定 → コネクタ → カスタムコネクタを追加** に登録すると、Claude から KN-01 / DC-01 をツールとして呼べる。
入力スキーマ（DC-01 の `period` `site` `kpi_notes` `lang`）は Dify 側が Start 変数から生成する。Cloud の版で画面名が変わっている可能性があるので、見つからなければ「MCP」で画面内検索する。

## 規約

- 置き場所：`dify/apps/<管理番号>-<slug>.yml`。**1 サービス 1 ファイル**。管理番号は `docs/handoff/service-index.md`（`CLAUDE.md` §2-11）
- `version` は **`0.6.0`**（顧客環境 Dify 1.15 系に合わせる。Cloud には古い版として警告付きで入る）。`kind: app`
- 参照 DSL（`docs/dify/templates/*.yml`）に無いフィールドは原則使わない。使ったものはファイル冒頭コメントか PR に書く
- System プロンプトは `docs/dify/usecases/<管理番号>.md` §5-1 を写す。共通ルールは `docs/dify/implementation-guide.md` §6
- モデルは **OpenRouter `qwen/qwen3.8-max`**（生成）を既定で書く。分類・抽出ノードを足すときは **`moonshotai/kimi-k3`**（`models.reasoning`）。既定値は `dify/env/cloud-master/env.yml` の `models` が正で、**変えるときは env とマスタを同時に**（`render.py --env cloud-master --all --check` が 12 本とも `[OK]` になること）。`dependencies` は空
- Knowledge Retrieval の `dataset_ids` は空で置き、KB は環境側で紐づける（環境固有 id を DSL に入れない）
- KB 用文書は `dify/kb/<管理番号>/`。架空データのみ（仮社名 青嶺精工、ペルソナは `SCENARIOS` の範囲、実在企業名・実データ禁止）
- テストは `dify/tests/<管理番号>.json`（ID は `<管理番号> T<2 桁>`、`docs/dify/implementation-guide.md` §5）。結果は `dify/results/`
- **環境差分は `dify/env/<env>/env.yml` に閉じる**（`CLAUDE.md` §2-12）。DSL には Cloud で動く既定値（`openrouter / qwen/qwen3.8-max`・`dataset_ids: []`）だけを書く。`python3 scripts/dify/render.py --env cloud-master --all` の出力は常にマスタとバイト一致すること（`--check` で確認できる）
- 秘密（API キー・Cookie）は置かない。設定ファイルはリポジトリの外（`~/.config/dify/<env>.env`）に置く（`.gitignore` は `.env` `.env.*` `*.key` `*.pem` `secrets/` `dify/build/` を除外済み）
