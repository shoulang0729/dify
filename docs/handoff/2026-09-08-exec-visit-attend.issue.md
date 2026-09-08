# Issue #132 への追記案（`gh` が無いので PM が貼り付け）

> タイトル案（変更する場合）：`GN-07 幹部来訪・出張のアテンド段取り — 業種横断で 1 件追加（データ層／台本 2 業種／世界マスタ 5 CSV ×2／PC-18 新設）`

## 設計書

`docs/handoff/2026-09-08-exec-visit-attend.md`

## 決まったこと（要約）

| | 結論 |
|---|---|
| 新規で立てるか | **新規 1 件**。5 軸判定で最大一致は GN-04 の 3 軸（閾値 4 軸未満）→ 別サービス（設計書 §1） |
| 管理番号 | **`GN-07`**（内部 id `gn7`）。`GN/daily`。**`CATS` は 1 行も変えない** |
| 業種 | **業種横断 `['mfg','fin']`** |
| 成熟度 | **構想（`st: 3`）**。Dify 単体では成立せず新規共通部品 PC-18 が前提 |
| タグ | 既存 `calendar` ＋ **新規 `travel`**（出張・来訪 / 出差与来访 / Travel & visits） |
| デモ画面 | **`form` 1 本**（両業種）。テンプレートは増設しない。2 サービスに割らない（§3-1） |
| 逐次更新の見せ方 | 入力＝案件登録／結果パネル＝**予定表 v1（6 列の表）**／チャット 3 往復で **v2 → v3**。各返答の 1 行目を「事実を N 件記録／v{X} に更新（変更 M 点）」で始める（§3-3） |
| 基礎データ | `data/world/{mfg,fin}/` に `hotels` `vehicles` `airports` `routes` `contacts` の **5 CSV ずつ**。3 言語は**列で持つ**（§4） |
| 実在名 | **空港名・IATA・地名は可**／**ホテル名・航空会社名・便名・旅行会社名は不可**（記号または架空）（§4-5） |
| 状態管理 | **新規 `PC-18 出張案件ストア`**（4 テーブル）。PC-01 では足りない。`PC-13` に **ICS** を追記（§5） |
| Outlook | **ICS が正・CSV は補助**。`METHOD:PUBLISH`／UID 固定＋SEQUENCE 加算で版を上書き（§5-4） |
| 会食の「仕向け」 | **PM 確認済み（2026-09-08）**：`host_out`（当社→相手）／`host_in`（相手→当社）／`split`。費用負担側と稟議の出席者の並べ方が変わる（§2-5） |
| 稟議との関係 | **DC-05／DC-09 に統合しない**。出席者表は JSON で渡すだけ。**DC-05/DC-09 のコードは触らない**（§1-2） |

## データ層の変更前後（reviewer が `regress` と照合）

| 指標 | 前 | 後 | 差分 |
|---|---|---|---|
| `cats` / `subs` | 13 / 29 | 13 / 29 | ±0 |
| `svcs` | 66 | **67** | **+1（`gn7` のみ）** |
| `tags` | 56 | **57** | **+1（`travel` のみ）** |
| `ui` | 78 | 78 | ±0 |
| `svcsMfg` / `svcsFin` / `svcsBoth` | 48 / 28 / 10 | **49 / 29 / 11** | +1 / +1 / +1 |
| `catsMfg` / `catsFin` | 10 / 8 | 10 / 8 | ±0 |

**削除・改名・分類移動・成熟度変更・既存 `industries` の変更は 0 件。** 恒等式 `49 + 29 − 11 = 67`。

## 受け入れ条件

1. `npm test` ALL PASS
2. `regress` の差分が設計書 §2-6 の表と**行単位で一致**（`counts` = `{"cats":13,"subs":29,"svcs":67,"tags":57,"ui":78,"svcsMfg":49,"svcsFin":29,"svcsBoth":11,"catsMfg":10,"catsFin":8}`）
3. `svcs[]` に増えるのは `gn7` の 1 行だけ。既存 66 行に差分なし
4. `node tools/gen-index.mjs --check` PASS
5. verify の **warn が 2 → 3**（増えるのは「業種 fin で台本の無い SVCS 28 件」の 1 本のみ）。mfg 側の warn 5 件は不変
6. `npm run world` exit 0・報告件数 **15 → 15**（増えない）
7. 新設 10 CSV の `*_ja`/`*_zh`/`*_en` に空値なし
8. `routes.csv` の `from_id`/`to_id` が 100% `airports.csv`・`hotels.csv`・`company.md` の id に解決
9. 台本 `gn7`（mfg/fin）が verify §9 の制約を満たす（`steps` 3 言語 ×4／`script` 3 往復／`'` U+0027 なし／`result` は `columns`+`rows` のみ・6 列）
10. `docs/dify/usecases/` のファイル数 44 と README の件数表記が一致し、GN-07 の行がある
11. `platform-components.md` に PC-18 があり、GN-07.md の依存 PC がすべて実在
12. **実在の企業名・ホテル名・航空会社名・便名・人名・電話番号・URL が 1 つも入っていない**（§4-5 の表と diff を照合）
13. Pages で製造・金融の両方に GN-07 が出て `form` のデモが動く

## 触らない範囲

`mock/css/**` ／ `mock/js/render.js`・`app.js`・`events.js` ／ `mock/js/data/catalog.js` の `CATS` ／ `mock/js/data/ui.js` の `T`・`PATTERNS`・`TEMPLATES` ／ `mock/js/data/home.js` ／ `mock/js/data/style.js` ／ `mock/index.html` ／ `mock/catalog.html`（PR-4 の `<script src>` 1 行追加のみ）／ `tools/verify.mjs`・`regress.mjs`・`gen-index.mjs` ／ `docs/handoff/service-index.md` ／ **`dify/env/**`・`dify/apps/**`・`dify/kb/**`・`dify/tests/**`（Mac が並行作業中）** ／ `CLAUDE.md`（変更不要）／ `.claude/**` ／ 既存 66 サービスの `name`/`desc`/`st`/`tags`/`industries`

## PR の分割案

| PR | 内容 | 並列 |
|---|---|---|
| **PR-1 データ層** | `SVCS` に `gn7`／`TAGS` に `travel`／`regress --update`／`npm run index` | 起点 |
| **PR-2 世界マスタ** | `data/world/{mfg,fin}/` に 5 CSV ずつ・`fin/vendors.csv`・people/org/partners/calendar への追記・README 更新・`check-world.mjs` の 2 か所 | **PR-1 と並列可** |
| **PR-3 台本（製造業）** | `scenarios/mfg/gn.js` に `gn7` | PR-1 の後 |
| **PR-4 台本（金融）** | `scenarios/fin/gn.js` を新設＋`catalog.html` に `<script src>` 1 行 | PR-3 の後。**Issue #120 PR-4a と同じファイル**なので先着優先・後発は rebase |
| **PR-5 実装リファレンス** | `usecases/GN-07.md`（設計書 付録 A の全文）／README 44 件／`platform-components.md` に PC-18・PC-13 に ICS（付録 B）／DC-05・DC-09 に 1 行 | **PR-1〜4 と並列可** |

推奨：`PR-1 ∥ PR-2 ∥ PR-5` → `PR-3` → `PR-4`

## PM 判断待ち（いずれも実装を止めない）

| # | 論点 | 推奨 |
|---|---|---|
| 1 | `docs/handoff/service-index.md` が「43 件」「KN-04 旧名」で陳腐化（金融 23 件も未反映） | **別 Issue で一括是正**。本 Issue では触らない |
| 2 | `tools/check-world.mjs` の `scenariosFor()` が業種 2 階層前の形を前提で、台本を 1 件も拾えていない（W1・W3・W9 の一部が空振り） | **別 Issue で修正**。warn のみ・CI 対象外で緊急度は低い |
| 3 | 台本の `script`/`input`/`result` の **zh を implementer が ja から作る**分担 | このまま（`2026-09-08-finance-catalog.md` §0-3 と同じ運用）。不可なら差し戻し |

> 「どちらの仕向けなのか」は **2026-09-08 に PM 確認済み**として設計書 §2-5 に本文化した。判断待ちから外している。
