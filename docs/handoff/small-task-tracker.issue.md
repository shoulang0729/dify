# Issue 下書き — GN-06 頼まれ事・放置業務の追跡（データ層に 1 件追加）

> `gh` が使えない環境のため本文をファイルで渡す。PM が Issue 化したら、本ファイル冒頭に Issue 番号を追記してください。

## タイトル

```
feat(catalog): GN-06 頼まれ事・放置業務の追跡 を追加（SVCS / SCENARIOS のデータ層のみ）
```

## ラベル案

`lane:M` `area:mock-data` `area:docs-dify`

## 設計書

- **`docs/handoff/2026-09-07-small-task-tracker.md`**（実装者はここのリテラルをそのまま転記する）
- 併せて読む：`docs/dify/usecases/GN-06.md`（architect が作成済み。Dify 実装リファレンス。今回の PR では**触らない**）

## 概要

お題「**基本動作をどこまでもトレースするエージェント**」。**報告や催促をいちいちしなくても見過ごされるが、チリツモでダメージが積もる業務**を 1 件ずつ票にして追う。

- 対象は (a) 定型（デスクの整理・週次の報告提出）／(b) ふと頼まれた小さい業務／(c) 放置されがちな低優先業務（PC 在庫・固定資産・倉庫整理）
- 管理手法は**一般に通じるもの 5 つだけ**：GTD の捕捉／2 分ルール／アイゼンハワー（重要だが緊急でない）／WIP 制限（同時着手 3 件）／エイジング（14 日・30 日）。根拠は設計書 §0-4
- **3 視点**：振られた側（今週の残件・期限）／振った側（頼んだ件の進捗・止まる理由）／上長・四半期棚卸し（完了率・放置延べ日数・種別別滞留）＋ **上長への相談メモ**（間に合わないとき、催促を待たず自分から出す。送信は人）
- 数字を**個人評価に直結させない**注記を台本に入れてある（DC-08 の D-5 と同じ思想）
- 内部 id `gn6` ／ 管理番号 **`GN-06`** ／ 分類 `gn`（汎用業務支援）／ 中分類 `daily`（日常業務）／ 成熟度 `st: 2`（試行版）／ デモ画面テンプレート **`form`**
- **UI・描画ロジックには一切触らない**。`CLAUDE.md` §2-9 と同じ「データ層だけ」の変更

## 変更するもの

| ファイル | 変更 | 設計書 |
|---|---|---|
| `mock/catalog.html` | `SVCS` に `gn6` 1 件（`gn5` の直後、`/* ---- pt: ... */` コメントの直前） | §2-1 |
| `mock/catalog.html` | `SCENARIOS` に `gn6` 1 件（`gn5` の直後、`pt1` の直前） | §2-2 |
| `tools/regress.baseline.json` | `node tools/regress.mjs --update` | §2-3 |
| `docs/handoff/service-index.md` | GN-06 行の追加、見出しの件数 42 → 43 | §2-4 |
| `docs/dify/usecases/README.md` | 一覧に GN-06 行、集計・逆引き・波の更新 | §2-5 |
| `docs/dify/outline-wiki-usecases.md` | §2 に GN-06 行、集計・件数 | §2-6 |
| `docs/dify/README.md` / `docs/dify/implementation-guide.md` | 「42 件／42 サービス」→ 43（数値のみ・行番号つき） | §2-7 |

3 言語（ja / zh / en）の文言と台本（ja / zh）は**すべて設計書に書いてある**。implementer は翻訳・言い換え・**数字の作り直しをしない**（台本内で 79.5% / 1,642 日 / 43.1% などが相互に整合している）。

## 触らない範囲（reviewer の diff 監査基準。設計書 §3）

- `CATS`（8 分類 17 中分類）・`TAGS`（**43 キーのまま。新タグを作らない**）・`PATTERNS`・`T`（73 キー）・`TEMPLATES`・**`HOME`**・**`FEED`**・`CAT_STYLE`・`state` の形・`data-act` の一覧
- **`HOME.frequent` / `HOME.recommended` / `FEED.recent` / `FEED.items` に `gn6` を足さない**（本サービスが ③ の主要な書き手になるのは**本番**の話。モックの `FEED` 改修は別 Issue）
- 描画関数・イベントハンドラ・両方の `<style>`・`<head>`
- 既存 42 件の `SVCS` / `SCENARIOS` リテラル
- `tools/verify.mjs` / `tools/regress.mjs` のコード、`CLAUDE.md`、`.claude/**`、`.github/**`
- **`docs/dify/platform-components.md`**（PC-01 の「使うサービス」への GN-06 追記は PM 判断 D-5 待ち。別 PR で architect が行う）
- `docs/dify/feasibility-33-services.md`（33 件時点の資料として据え置き）

## 受け入れ条件

1. `node tools/verify.mjs` → **ALL PASS**、**warn は既存の 1 件（`未使用キー: all`）のみ**
   - §2 i18n：`SVCS.gn6.name/desc`・`persona`・`steps` が 3 言語そろい、`en` にかなが無い
   - §6：`SVCS 43 件の cat/sub/st/tags 整合 OK` / `管理番号 43 件の重複なし OK`
   - §9：`SCENARIOS 43 件の整合 OK`（`steps` 3 言語とも **6**、`script` 各 **3**、`form` なので `input.*.fields` が配列、`result` は `items` のみ、`q`/`a` に `'` なし）
2. `node tools/regress.mjs` の差分が**次の 2 行だけ**

```
   - counts.svcs: 42 → 43
   - SVCS 追加: gn6
```

   → `node tools/regress.mjs --update` → 再実行で PASS（`{"cats":8,"subs":17,"svcs":43,"tags":43,"ui":73}`）。PR 本文に「設計書 §2-3 のデータ変更に伴う基準更新」と書く
3. Playwright（設計書 §4-2 の V-1〜V-10）
   - ① 汎用業務支援 › 日常業務が **3 件**（GN-04・GN-05・**GN-06**）
   - 詳細 → デモ → 実行 → 結果（票ドラフト **TK-25-0087** の 7 ブロック）→ 2 往復目に**相談メモ** → 3 往復目に四半期の数字
   - 中文に切替：メニュー・手順・台本が中国語、**数字は日本語版と同じ**
   - ② 統計 **43**・提供中 **12**・試行版 **23**・構想 **8**。「よく使う」「おすすめ」は不変
   - ③ 業務フィードは**一切変化なし**

## PR の分割案

**1 本**（分割しない）。データ層 2 リテラル ＋ `regress --update` ＋ docs の件数・一覧はレビュー単位として分けられない（分けると基準更新が宙に浮く）。

ブランチ名：`feat/<issue>-small-task-tracker`

**並列可否**：`mock/catalog.html` の `SVCS` / `SCENARIOS` を触る他のお題とは**直列**。描画・`T`・CSS を触るお題（デザインパス）とは並列可だが同一ファイルなので後発が rebase する。`docs/dify/usecases/README.md` と `service-index.md` は他の新サービス追加と衝突する。

## PM 判断待ち（設計書 §9。推奨案で実装してよい）

| # | 論点 | 推奨 |
|---|---|---|
| D-1 | 定型の自動起票を PC-11 で回すか | **回す**（第 1 段階から）。WeCom／メール取り込みは第 2 段階 |
| D-2 | 棚卸しの周期と評価への反映 | **四半期・数字は出すが評価は人**。個人別は本人と直属の上長のみ |
| D-3 | 放置の閾値 | **14 日で本人／30 日で依頼者**（設定値にする） |
| D-4 | 票を誰でも登録できるか（振る権限） | **全員が振れる ＋ 受け側は WIP 上限・相談メモで守る**（匿名の依頼は不可） |
| D-5 | `platform-components.md` PC-01 に GN-06 を足すか | **足す。ただし別 PR**（本 PR には含めない） |
| D-6 | サービス名（顧客に見える文言） | **「頼まれ事・放置業務の追跡」**。変えるなら 3 言語まとめて差し替え |

## メモ

- `CLAUDE.md` §6 バックログの「42 サービス（提供中 12／試行版 22／構想 8）」→「43 サービス（提供中 12／試行版 23／構想 8）」の更新は **load-bearing のため implementer は触らない**。マージ後に PM が 1 行更新する
