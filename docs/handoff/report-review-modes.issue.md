# DC-08 を「目的・相手別のレビューモード」を持つ 1 サービスに改める

> `gh` が使えない環境用の Issue 本文の下書き。Issue を立てたら、この本文をそのまま貼る。
> ラベル案：`mock` `data` `M`

## 概要

DC-08 を「週報を読んで論点を出すサービス」から、**「どの報告種別を、誰が誰に出す場面で、何のために読むか」を選べるサービス**に改める。
読み手向け／書き手向けで**サービスを分けない**。**1 サービス `dc8` の中でモードを切り替える**（PM 決定）。

```
モード ＝ 報告種別（15 種） × 誰が誰に出すか（書き手 → 読み手） × 目的（提出前セルフチェック / 受領後の論点整理）
```

モックでは `SCENARIOS.dc8.template` を `upload` → **`form`** に変え、フォームの 5 項目でモード選択を表す。
**UI・CSS・描画関数は 1 文字も触らない**（既存の `form` テンプレートをそのまま使う）。

## 設計書

- **`docs/handoff/2026-09-07-report-review-modes.md`**（本件の正本。§2 にリテラル全文）
- 実装リファレンス：`docs/dify/usecases/DC-08.md`（**architect が全面改訂済み。implementer は読むだけ**）
- 初版（記録として残す・触らない）：`docs/handoff/2026-09-07-report-critique-service.md`

## 変更する範囲

| ファイル | 変更 |
|---|---|
| `mock/catalog.html` | `SVCS.dc8` の `name` / `desc`（3 言語）差し替え（設計書 §2-1）／`SCENARIOS.dc8` をブロックごと差し替え（§2-2） |
| `docs/handoff/service-index.md` | DC-08 行：名称と台本欄 `upload` → `form`（§2-3） |
| `docs/dify/usecases/README.md` | DC-08 行：名称と画面欄 `upload` → `form`／集計「画面タイプ」を upload 18→**17**、form 11→**12**（§2-4） |
| `docs/dify/outline-wiki-usecases.md` | DC-08 行の記述をモード制に（§2-5） |

**`tools/regress.baseline.json` は更新しない**（`SVCS[].name/desc` と `SCENARIOS` はスナップショット対象外。差分 0 行。設計書 §2-6 で検証済み）。

## 触らない範囲（reviewer の diff 監査基準）

- `CATS` / `TAGS`（43） / `PATTERNS` / `T`（73） / `TEMPLATES`（5 種の文言） / `HOME` / `FEED` / `CAT_STYLE` / `state` / `data-act`
- `SVCS.dc8` の `id` / `cat` / `sub` / `st` / `tags`（**不変**）
- 既存 41 件の `SVCS` と `SCENARIOS` のリテラル
- 描画関数（`panelHTML` / `resultHTML` / `renderMain` ほか）・イベントハンドラ・両方の `<style>`・`<head>`
- `tools/**`・`CLAUDE.md`・`.claude/**`・`.github/**`
- `docs/dify/usecases/DC-08.md`（architect 成果物）／`docs/handoff/2026-09-07-report-critique-service.md`（初版）／`docs/handoff/2026-09-06-pm-decisions.md`（PM の記録。§9 の追記は PM が行う）
- `docs/dify/platform-components.md`（PC-17 の `kind` 追加は PM 判断 R-4 の後、architect が別途）
- `docs/dify/README.md` / `implementation-guide.md`（件数が変わらないので変更なし）

詳細は設計書 §3。

## 受け入れ条件

**機械検証**

1. `node tools/verify.mjs` → **ALL PASS / warn 1**（既存の `未使用キー: all` のみ）
   - §9：`SCENARIOS 42 件の整合 OK`。`template: 'form'` なので `input.ja/zh.fields` が配列、`result` は `items` のみ、`steps` 3 言語とも 5、`script.ja/zh` 各 3、`q`/`a` に `'` なし
   - §2：`全辞書 3 言語一致（T=73 TAGS=43 PATTERNS=3 CATS=8 SVCS=42 TEMPLATES=5）`
2. `node tools/regress.mjs`（**`--update` なし**）→ **PASS**、差分 0 行、`{"cats":8,"subs":17,"svcs":42,"tags":43,"ui":73}`
3. `git diff mock/catalog.html` が `SVCS` の name/desc 4 行 ＋ `SCENARIOS.dc8` の 1 ブロックのみ

> architect が作業用コピーで 1・2 を実行済み（2026-09-07）。**違う出力が出たら転記ミスか差し替え位置の誤り**。

**目視（Playwright / PM）**

4. 詳細画面の画面タイプが「**フォーム入力→ドラフト生成型**」になっている
5. デモの入力パネルに**ラベル付き 5 項目**（報告種別／読み手・提出先／目的／報告本文・添付／前回のやり取り台帳）。ドロップ枠とファイルチップは出ない
6. 「実行」→ 結果パネルに **10 行**（0. 適用モード ／ 1. 要旨 ／ 2. 良い点 ／ 3〜5. 論点 1〜3 ／ 6. 数字のブリッジ ／ 7. 台帳照合 ／ 8. 改善後の報告案 ／ 9. 次回確認事項）
7. チップで台本を最後まで進めると、ターン 2 が**提出前セルフチェック**、ターン 3 が**障害報告**になっている（3 往復＝3 モード）
8. `zh` でタイトルが「汇报评审［收到后的要点梳理］组织长周报：制造二科 W36…」、10 行が中国語
9. P2 の統計は **42 / 12 / 22 / 8** のまま。「よく使う」「おすすめ」も不変。P3 は完全に不変
10. `grep -c "指摘" mock/catalog.html` が **31 → 12**（残りは他サービスの正当な用例）。「ツッコミ」は 0 件

全 15 項目は設計書 §4。

## PR の分割案

**1 PR**（分割しない）。名称と台本は同じ内容を指しており、片方だけ入ると名称とデモが食い違う。

| PR | ブランチ | 内容 |
|---|---|---|
| 1 | `feat/<issue>-dc8-review-modes` | 設計書 §2-1 `SVCS.dc8` ／ §2-2 `SCENARIOS.dc8` ／ §2-3〜2-5 のドキュメント 3 ファイル |

- PR 本文に：設計書パス、`verify` / `regress` の結果、**「`regress --update` は実行していない（設計書 §2-6：スナップショット対象外のため差分なし）」**、触っていない範囲
- **並列不可**：`mock/catalog.html` を触る他の作業すべて
- **並列可**：`docs/dify/usecases/*.md` の他サービス執筆（`usecases/README.md` の集計行だけ衝突しうる）

## PM 判断（2026-09-07・**R-1〜R-6 すべて推奨どおり確定**。台本順「受領後 → 提出前 → 障害」も了承）

| # | 論点 | 決定 | 実装への影響 |
|---|---|---|---|
| R-1 | 最低 5 モード以外（10 種）の成熟度 | **すべて構想**。`SVCS.dc8.st` は 2 のまま、モード単位の成熟度は `usecases/DC-08.md` §1-2 の表にだけ持つ | なし |
| R-2 | モードマスタの正本の置き場 | **Outline のページ（人が読む）＋ 同期 JSON** | なし |
| R-3 | `pre_submit` の結果を台帳（PC-17）に残すか | **残さない**（D-5「個人評価に使わない」と衝突するため） | なし |
| R-4 | `PC-17` の API に `kind`（報告種別）を足すか | **足す**。承認後 architect が `platform-components.md` に追記（本 PR には含めない） | なし |
| R-5 | 導入順 | **`pre_submit` から**（書き手が身構えない）。ただしデモは `post_receipt` で見せる | なし |
| R-6 | PM 記録の更新 | `docs/handoff/2026-09-06-pm-decisions.md` §9 に本改訂の 1 行を **PM が**追記（`form` 型・名称変更・モード制） | なし |

詳細と選択肢は設計書 §9、確定の記録は設計書 **§11 追補**。

**R-4 対応済み**：architect が `docs/dify/platform-components.md` の PC-17 に `kind`（報告種別）と「再発判定の範囲」の行を追加済み（PC-01〜PC-16 は不変）。`docs/dify/usecases/DC-08.md` も確定内容に合わせて更新済み。**この 2 ファイルは implementer の PR に含めない**（architect の変更として別に main に入る）。
