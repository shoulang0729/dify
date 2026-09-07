# Issue #84 追記案 — リポジトリ構成 v2 の設計が出ました

> `gh` が使えない砂箱のため、Issue へのコメント本文をここに置く。**PM が #84 にそのまま貼る**（またはコメント欄にコピー）。

---

## 設計書

**`docs/handoff/2026-09-07-repo-layout-v2.md`**（727 行）

## 決めたこと（要点）

### 1. 4 区分の置き場 — `mock/` は改名しない

| 区分 | 置き場 | 入口 |
|---|---|---|
| **①デモ** | `mock/` | `mock/index.html` |
| **②実装ソース** | `dify/apps` `dify/env` `scripts/dify` `tools` | `dify/README.md` |
| **③ユースケース・シナリオ** | `docs/dify/usecases` `docs/handoff` `mock/js/data/scenarios` | `docs/dify/usecases/README.md` |
| **④ダミーデータ** | `data/world` `dify/kb/<番号>` `dify/tests` | `data/world/README.md` |

`mock/` → `demo/` の改名は **見送り推奨**。公開 URL は元々 `/mock/` を含まない（`path: mock` で mock/ がサイトのルート）ので**得るものはリポジトリ内の語感だけ**、失うものは **`mock/` を含む 322 か所の参照**・過去 Issue/PR の blob リンク・変更禁止の `localStorage` キー `mock.lang`/`mock.theme` との整合・進行中の #77 / #82 との全面衝突。代わりに**トップ `README.md` の地図で「`mock/` ＝ ①デモ」と明示**する（設計書 §1-2 / §1-4）。

**管理番号からの横断索引**は `tools/gen-index.mjs` で **`docs/service-map.md` を生成**する（`docs/handoff/service-index.md` に列を足さない ＝ 手で保守すると必ず実態とズレるため）。`npm run index` で更新、`tools/verify.mjs` §11 が鮮度を検査。

### 2. 架空世界マスタ `data/world/`（8 ファイル）

`company.md` `org.csv` `people.csv` `products.csv` `equipment.csv` `partners.csv` `kpi.csv` `calendar.md`。
**既存資産から実測した初版の中身**を設計書 §2-3 に全部書いた。ついでに**既にある食い違い**が見つかっている：

- 社名 `青岭精工`(zh) 14 回 / `青嶺精工`(ja) **2 回のみ** / **英名なし**
- **日本本社の英語表記が存在しない**（`Suzhou Plant` は 44 回ある）
- `K 社` 133 回 / `K社` **8 回**（空白ゆれ）
- 同一人物の役職ゆれ **5 名**（王 磊が「主任」「主任〈教育担当兼務〉」「主任〈用語集管理者〉」の 3 通り など）
- 会議室コード `DC-02` が管理番号 **DC-02（議事録作成）と衝突**

`tools/check-world.mjs` が W1〜W9 の検査を **warn だけ**出す（**CI には入れない**。初版で必ず warn が出るため）。**`data/world` から台本や KB を自動生成はしない**（正本だが反映は手作業）。

### 3. 環境レイヤー `dify/env/<env>/env.yml`

`dify.{base_url,console_url,edition,dsl_version}` / `models.{chat,reasoning,embedding,rerank,local,overrides}` / `knowledge` / `brand.{company,local_entity,sites,replace}` / `flags.{cross_border,partner_mode,pipl_mask}` / `variables`。
`cloud-master`（既定＝マスタ）・`inhouse`・`customer-a` の 3 枚を PR-2 で置く（**設計書 §3-3 に全文**）。
**顧客実名・実 URL・dataset id・キーは env.yml にも書かない**。`${VAR}` でプロセス環境変数から。顧客 B が増えても **env.yml 1 枚を足すだけ、アプリは増えない**。

### 4. render の方式 → **(b) マスタは Cloud の実値のまま、env で差し替え**

プレースホルダ方式 (a) は **#82 が確立した「raw URL を貼るだけ」のインポート運用を壊す**（`provider: {{MODEL_CHAT}}` は Dify に入らない）。(b) ならマスタは常に「実際に動く 1 本」で、`check.py` も export し直した DSL もそのまま回る。
**社名・拠点は、架空世界マスタの語（`青嶺精工`・`蘇州工場`）がそのままプレースホルダの役割**を果たす（`brand.replace` で環境の語に置換）。

置換対象は DSL のパスで機械的に決まる（実 DSL で特定済み・設計書 §4-1）：

| ルール | DSL のパス |
|---|---|
| R1 | `nodes[].data.model.{provider,name,mode,completion_params}`（`type: llm`）← `models.chat` |
| R2 | 同上（`question-classifier` / `parameter-extractor`）← `models.reasoning` |
| R3 | `nodes[].data.multiple_retrieval_config.reranking_model` ＋ `reranking_enable` ← `models.rerank` |
| R4 | `nodes[].data.single_retrieval_config.model` ← `models.reasoning` |
| R5 | `nodes[].data.dataset_ids`（`knowledge-retrieval`）← `knowledge.<論理名>.id` |
| R6 | `nodes[].data.variables[].{default,options}`（`start`）← `variables` ＋ `brand.sites` |
| R7 | `app.{name,description}` / `data.{title,desc}` / `data.prompt_template[].text` ← `brand.replace` |
| R9 | `version` ← `dify.dsl_version`（R8 `environment_variables`・R10 `dependencies` は触らない） |

**受け入れ条件の核**：`render.py --env cloud-master --all` の出力が `dify/apps/*.yml` と **バイト一致**。

### 5. `release.py` — マスタ → 各環境へのリリース

```
render(--strict) → ガード(越境/PIPL/partner) → import → KB 投入 → テスト
  → dify/results/<env>/ → dify/CHANGELOG.md 追記 → git tag release/<env>/<YYYYMMDD>
```
- **Cloud は自動 import しない**（Cloudflare / Cookie。Issue #3 の理由そのまま）。`IMPORT.md` と Chrome への依頼文を出して止まる
- **セルフホストは Console API**。エンドポイントは版依存で未確認なので `scripts/dify/console_api.py` 1 ファイルに閉じ込める
- `--dry-run` は**ネットワークを一切呼ばない**
- **Issue #3 の import 方向は本 Issue に統合**。export 方向（`pull.py`）のみ #3 に残す（セルフホスト後・v2.1）

### 6. ついでに見つかった不備（PR-2 で直す）

**`CLAUDE.md` §2-10 は「`.gitignore` で `.env*`・`*.key`・`*.pem`・`secrets/` を除外済み」と書いているが、実際の `.gitignore` には無い**（OS/Editor とログのみ）。#82 の `DEPLOY.md` はこれに気づいて「リポジトリ内に `.env` を作らない」という注意書きで回避している。PR-2 で `.gitignore` を実態に合わせる（＋ `dify/build/`）。

---

## 受け入れ条件（抜粋。全 20 項目は設計書 §8）

- 全 PR：`node tools/verify.mjs` PASS ／ `node tools/regress.mjs` **差分 0**（`--update` 禁止）
- PR-1：`npm run index` が冪等・`docs/service-map.md` は **46 行**（43 サービス＋ヘッダ 2＋集計 1）／②DSL 列にリンクが付くのは KN-01・DC-01 の 2 行だけ／`check-world` が **役職ゆれ 5 名・社名 ja 2 / zh 14 / en 0・`K社` 8 件**を検出／`people.csv` の人名が `SCENARIOS[].persona` の **17 名と完全一致**
- PR-2：`render.py --env cloud-master --all` の出力が **マスタとバイト一致**／`--env customer-a --strict` が未定義 `${VAR}` で exit 1（**値は出さない**）／`verify` §12 が env.yml に秘密・実名が無いことを検査／`git check-ignore dify/build/x.yml` が真
- PR-3：`release.py --dry-run` がネットワークを呼ばない／`--yes` 無しでは `git tag` を**実行しない**／`CHANGELOG.md` は既存行を書き換えず 1 行だけ追記

## 触らない範囲（reviewer の diff 監査の基準）

- **`mock/**` の中身は 1 バイトも変えない**（PR-1 で `mock/README.md` に 1 行足す以外）。データ層・CSS・`render*`・`state`・`data-act`・`detectLang`・`localStorage` キー
- **データ層の件数は不変**：8 分類 / 17 中分類 / **43 サービス** / タグ（`regress` の id 一覧も不変。`--update` 禁止）
- `tools/regress.baseline.json` ／ `.github/workflows/pages.yml`（`path: mock` のまま）／ `.github/workflows/verify.yml`（`world` を CI に足さない）
- **`dify/apps/*.yml` の中身**（環境差は env で吸収。DSL を直すのは別 Issue）
- `docs/handoff/**` の既存設計書 ／ `docs/dify/usecases/*.md` ／ `platform-components.md` ／ `decisions-pending.md` ／ `docs/dify/templates/*.yml`
- **`.claude/**` と `CLAUDE.md`**（§9 の案を PM が適用）
- 顧客の実名・URL・dataset id・API キー（`dify/env/**` にも `data/world/**` にも書かない）

---

## PR 分割案

| PR | 内容 | 主なファイル |
|---|---|---|
| **PR-0**（任意・非推奨） | `mock/` → `demo/` 改名 | 全域（322 参照）。Q1 で PM が「やる」と決めた場合のみ |
| **PR-1** 地図と索引・`data/world` | `README.md`（4 区分の表）・`docs/service-map.md`（生成）・`tools/gen-index.mjs`・`tools/check-world.mjs`・`data/world/**`（8 ファイル）・`docs/dify/implementation-guide.md` §7-2 改訂・`docs/dify/README.md`・`mock/README.md`（1 行）・`package.json`・`tools/verify.mjs` §11 |
| **PR-2** 環境レイヤー＋render | `dify/env/**`（README＋3 環境）・`scripts/dify/render.py`・`kb_upload.py`（`--env`）・`env.example`・`.gitignore`・`dify/README.md`・`tools/verify.mjs` §12 |
| **PR-3** release＋CHANGELOG | `scripts/dify/release.py`・`console_api.py`・`run_tests.py`（`--env`・`results/<env>/`）・`dify/CHANGELOG.md`・`dify/DEPLOY.md` §5 |

**並列不可（PR-1 → PR-2 → PR-3 の直列）**。3 本とも `tools/verify.mjs` か `scripts/dify/**` で重なる。
**着手条件：#77 PR-B / PR-C と #82 が両方 main に入ってから。** `mock/js/data/**`（gen-index・check-world が読む）と `dify/**`（render の対象）が無い状態では書けない。

---

## PM 判断待ち（推奨つき。設計書 §10 に詳細）

| # | 論点 | 推奨 |
|---|---|---|
| Q1 | `mock/` を `demo/` に改名するか | **改名しない** |
| Q2 | render の方式 (a) プレースホルダ / (b) 実値＋置換 | **(b)** |
| Q3 | `data/world` の粒度 | **8 ファイル。初版は既存資産からの抽出のみ。`check-world` は CI に入れない** |
| Q4 | リリースタグの命名 | **`release/<env>/<YYYYMMDD>`**（同日 2 回目は `-2`） |
| Q5 | 顧客環境の Dify 版 | **Community 1.15.x**（SSO は本番 UI 側 = PC-16 (b) で受ける。Enterprise は必須でない） |
| Q6 | 社名・拠点の英語表記 | **`Seirei Seiko Co., Ltd.` / `Japan HQ`**（モックに英語表記が無かったため新規。**顧客に見せる文言なので PM 確認が要る**。モックへの反映は本 Issue ではやらない） |
| Q7 | `docs/service-map.md` の鮮度検査 | **verify で FAIL**（`npm run index` 1 コマンドで直る） |
| Q8 | `CHANGELOG.md` の置き場 | **`dify/CHANGELOG.md`**（モックは常に main が公開される別軸） |
| Q9 | 顧客ごとにブランチを切るか | **切らない**（差分は `dify/env/` に閉じる） |
| Q10 | `.claude/commands/dify-deploy.md` を置くか | **置く（PM が配置）**。文案は設計書 §5-1 |

**Q6 は顧客に見せる文言なので、PM の返事が来るまで `data/world/company.md` の英名は確定しない**（PR-1 の着手自体は Q1・Q3 が決まれば可能）。

## `CLAUDE.md` への影響（PM が適用。設計書 §9 に差し替え文案）

- 冒頭 3 行を **4 区分**の書き方に
- §2-8：`mock/` は改名しない旨を追記（現行の `path: mock` は変更なし）
- §2-10：`.gitignore` の実態に合わせる ＋ **env.yml にも実名・キーを書かない**
- **§2-12 新設「環境差分は `dify/env/<env>/env.yml` に閉じる」**（検出：`render.py --env cloud-master` がマスタとバイト一致／`verify` §12／`render --strict`）
- **§2-13 新設（任意）「架空データの正本は `data/world/`」**（検出：`check-world.mjs`・warn のみ）
- §3：`npm run index` / `npm run world` を追記（`world` は CI に入れない）
- §5：`release/<env>/<YYYYMMDD>` タグ・顧客ごとにブランチを切らない
- §6：Issue #3 は **export 方向のみ残件**に書き換え ＋ 本 Issue を追記
