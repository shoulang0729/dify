# Issue 下書き — DC-08 週報・報告のレビューと論点指摘（データ層に 1 件追加）

> `gh` が使えない環境のため本文をファイルで渡す。PM が Issue 化したら、本ファイル冒頭に Issue 番号を追記してください。

## タイトル

```
feat(catalog): DC-08 週報・報告のレビューと論点指摘 を追加（SVCS / SCENARIOS のデータ層のみ）
```

## ラベル案

`lane:M` `area:mock-data` `area:docs-dify`

## 設計書

- **`docs/handoff/2026-09-07-report-critique-service.md`**（実装者はここのリテラルをそのまま転記する）
- 併せて読む：`docs/dify/usecases/DC-08.md`（architect が作成済み。Dify 実装リファレンス。今回の PR では**触らない**）

## 概要

Notion 2 本（「報告ツッコミエージェント 指示書」＋「週報改善レビューAI：Dify 実装指示書」）を、製造業 2 拠点（青嶺精工・蘇州工場）のユースケース 1 本にした。
課長 → 工場長の週報を読み、**曖昧さ・数字の不整合・打ち手の不足**を、責めない質問と改善案に変える。目標との差を打ち手でつなぐ**数字のブリッジ**と、**前回の指摘・回答台帳との照合**（未回答・期限超過・再発）が特徴。

- 内部 id `dc8` ／ 管理番号 **`DC-08`** ／ 分類 `dc`（文書・資料作成）／ 中分類 `report`（報告・会議）／ 成熟度 `st: 2`（試行版）／ デモ画面テンプレート `upload`
- **UI・描画ロジックには一切触らない**。`CLAUDE.md` §2-9 と同じ「データ層だけ」の変更

## 変更するもの

| ファイル | 変更 | 設計書 |
|---|---|---|
| `mock/catalog.html` | `SVCS` に `dc8` 1 件（`dc7` の直後） | §2-1 |
| `mock/catalog.html` | `SCENARIOS` に `dc8` 1 件（`dc7` の直後、`lg1` の直前） | §2-2 |
| `tools/regress.baseline.json` | `node tools/regress.mjs --update` | §2-3 |
| `docs/handoff/service-index.md` | DC-08 行の追加、見出しの件数 41 → 42 | §2-4 |
| `docs/dify/usecases/README.md` | 一覧に DC-08 行（依存 PC 列の末尾は **`PC-17`**）、集計・逆引き（**`PC-17` の行を追加**）・波の更新 | §2-5 ＋ **§11-1** |
| `docs/dify/outline-wiki-usecases.md` | §2 に DC-08 行、集計・件数 | §2-6 |
| `docs/dify/README.md` / `docs/dify/implementation-guide.md` | 「41 件／41 サービス」→ 42（数値のみ） | §2-7 |

3 言語（ja / zh / en）の文言と台本（ja / zh）は**すべて設計書に書いてある**。implementer は翻訳・言い換え・数字の作り直しをしない。

> **先に設計書 §11 追補（2026-09-07・PM 判断 D-1 確定後）を読むこと。** `PC-17 指摘・回答台帳` の新設に伴い、§2-5 の `usecases/README.md` の記述だけが §11-1 で上書きされている（`mock/catalog.html` の指示は 1 文字も変わっていない）。

## 触らない範囲（reviewer の diff 監査基準。設計書 §3）

- `CATS` / `TAGS`（43 キーのまま。**新タグを作らない**）/ `T`（73 キー）/ `PATTERNS` / `TEMPLATES` / `HOME` / `FEED` / `CAT_STYLE` / `state` / `data-act`
- **`HOME.frequent` `HOME.recommended` `FEED.recent` `FEED.items` に `dc8` を足さない**
- 描画関数・イベントハンドラ・1 つ目と 2 つ目の `<style>`・`<head>`
- 既存 41 件の `SVCS` / `SCENARIOS` リテラル（**追加のみ。既存行の変更・削除は 0 行**）
- `tools/verify.mjs` / `tools/regress.mjs` のコード、`CLAUDE.md`、`.claude/**`、`.github/**`
- `docs/dify/usecases/DC-08.md`（**architect 成果物**。PC-17 確定に伴う更新も済んでいる。読むだけで 1 文字も変更しない。PR には既存ファイルとして含まれる）
- `docs/dify/platform-components.md`（**PM 判断 D-1 により architect が `PC-17 指摘・回答台帳` を追加済み**。implementer は触らず、**PR にも含めない**。reviewer は本 PR にこのファイルの差分が無いことを確認する）
- `docs/dify/feasibility-33-services.md`（33 件時点の資料として据え置き）

## 受け入れ条件（設計書 §4）

1. `node tools/verify.mjs` → **ALL PASS**、warn は既存の `未使用キー: all` のみ
   - §2 `SVCS=42`、§6 `SVCS 42 件` `管理番号 42 件の重複なし`、§9 `SCENARIOS 42 件の整合 OK`
   - 「台本の無い SVCS」warn が**出ない**
2. `node tools/regress.mjs`（`--update` 前）の差分が**この 2 行だけ**
   ```
   - counts.svcs: 41 → 42
   - SVCS 追加: dc8
   ```
   `CATS` / `TAGS` / `PATTERNS` / `T(UI キー)` の行が出たら設計外
3. `node tools/regress.mjs --update` → PASS（`counts.svcs` が 42）。PR 本文に「設計書 §2-3 のデータ変更に伴う基準更新」と書く
4. `git diff mock/catalog.html` が**追加のみ**
5. Playwright／目視
   - P1：文書・資料作成の一覧に **8 件目のカード**が末尾に出る（`DC-08`・試行版・タグ「報告資料」「実績集計」）。中分類「報告・会議」は 3 件
   - 詳細 → デモ → 「実行」で結果パネル **9 行**（要旨／良い点／指摘 1〜3／数字のブリッジ／台帳照合／改善後の報告案／次回確認）
   - `zh` でも同じ操作で中国語の 9 行。`en` UI では台本・結果は ja（既存仕様）
   - P2：統計が **42 / 提供中 12 / 試行版 22 / 構想 8**。**「よく使う」「おすすめ」は変わらない**
   - P3：表示が**まったく変わらない**

> architect は設計書のリテラルを `catalog.html` の写しに挿入して 1〜3 を実行済み（verify ALL PASS / regress 差分 2 行）。違う出力が出たら転記ミスか挿入位置の誤りを疑うこと。

## PR の分割案

**1 PR**（分割しない）。データ層の 2 ブロックと台帳・ドキュメントの件数は同時にマージしないとずれる。

| # | ブランチ | 内容 |
|---|---|---|
| 1 | `feat/<issue>-dc8-report-critique` | `SVCS.dc8` ／ `SCENARIOS.dc8` ／ `regress --update` ／ ドキュメント 5 ファイルの更新 |

- **並列不可**：`mock/catalog.html` を触る他のお題すべて（同一ファイル・同一関数域）
- 並列可：`docs/dify/usecases/*.md` の他サービス執筆（`usecases/README.md` の集計行のみ衝突しうる）

## PM 判断（設計書 §9 → **D-1〜D-6 すべて推奨どおりで確定**。2026-09-07。詳細は設計書 §11-3）

| # | 論点 | 推奨 |
|---|---|---|
| D-1 | 指摘・回答台帳の PC 上の位置づけ | **確定：新 `PC-17 指摘・回答台帳`**。architect が `platform-components.md` に追加済み（2026-09-07）。期限つき指摘のみ PC-01 に `due` で併載 |
| D-2 | DC-01（月次報告ドラフト）を DC-08 に通すか | **通す**（第 2 段階。モックには導線を作らない） |
| D-3 | 週報の提出経路（Excel アップロード／WeCom／専用フォーム） | **Excel アップロード**で開始 |
| D-4 | 指摘台帳を Outline に置くか | **置かない**（台帳は構造化データ、Outline は改善後の報告案の下書きのみ） |
| D-5 | 月次品質レビューの公開範囲 | **工場長室のみ**。個人評価に使わないことを運用ルールに明記 |
| D-6 | 名称の「ツッコミ」表現 | **「週報・報告のレビューと論点指摘」**（zh は「要点追问」。中国語の「指摘」は非難の意味になるため） |
