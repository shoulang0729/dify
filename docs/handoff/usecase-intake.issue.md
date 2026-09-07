# Issue #76 への追記案 — ユースケース取り込みの段取りと `/usecase` コマンド

> `gh` が使えない環境のため本文をファイルで渡す。**Issue #76 は既存**なので、本ファイルは**コメント追記案**として使う（新規起票ではない）。
> PM が #76 に貼ったら、本ファイル冒頭にコメント URL を追記してください。

## タイトル（#76 のタイトルを変えるなら）

```
chore(process): Notion DB → ユースケース化（デモ + 実装リファレンス）の段取りと /usecase コマンド
```

## ラベル案

`lane:M` `area:process` `area:docs-handoff`

## 設計書

- **`docs/handoff/2026-09-07-usecase-intake.md`**（段取りの正本。S0〜S13 の 14 段）
- **`docs/handoff/usecase.command.md`**（`/usecase` コマンド本文案。**配置は PM が `.claude/commands/usecase.md` へ**）
- 一般化の元になった実例：`docs/handoff/2026-09-07-report-critique-service.md` → `2026-09-07-report-review-modes.md`（DC-08）／`docs/handoff/2026-09-07-small-task-tracker.md`（GN-06）／`docs/handoff/2026-09-06-pm-decisions.md` §9・§10

## 概要

お題（PM の言葉）：「Notion DB の場所を指定すればそこにあるドキュメントを読み込んでユースケース化してくれる段取り。ユースケース化＝デモのユースケース、および本格実装を検討するドキュメントづくり。用途被りがあれば統廃合やユースケース目的別分割を検討。観点ややりたいことが分からないときは確認して」

今日 2 回（DC-08・GN-06）手作業で回した流れを **14 段（S0〜S13）** に固定し、**止まる場所**と**判断する人**を決めた。

- **★S3 PM 確認 4 問**（対象者／目的／観点／出口）を**必須の停止点**にする。DC-08 はここを飛ばしたため 1 回作り直しになった（初版＝読み手向け／書き手向けを 1 本の Workflow に直列 → 改訂＝モード制）
- **S4 統廃合判定**：既存 43 件との重なりを **5 軸（分類／タグ／ペルソナ／入出力／出口）の一致数**で機械的に測り、**統合 / 目的別分割 / モード化 / 別サービス / 保留** の 5 判定に落とす
- 分かれ目を 1 行にした：**「画面を分けないと使えないなら分割。フォームの 1 項目で切り替えられるならモード。」** DC-08 は `template` を `upload` → `form` に変えただけでモード選択が表現でき、描画関数・CSS の変更は 0 だった
- **Notion 側は新 DB「ユースケース候補」**（9 必須列 ＋ 4 任意列、7 状態）。DC-08 が「Notion 2 本 → サービス 1 件」だったとおり、元ページと候補は 1:1 ではない
- **S13 Notion 書き戻し**：状態・管理番号・設計書 URL・PR URL を戻す。事実の欄は自動、判断の欄（PM メモ・統合先・保留）は PM

## 変更するもの（この Issue の PR）

| ファイル | 変更 |
|---|---|
| `docs/handoff/2026-09-07-usecase-intake.md` | **新規**（段取りの設計書） |
| `docs/handoff/usecase.command.md` | **新規**（`/usecase` コマンド本文案） |
| `docs/handoff/usecase-intake.issue.md` | **新規**（本ファイル） |

**`mock/**`・`tools/**`・`CLAUDE.md`・`.claude/**` の差分は 0 行。**

## 触らない範囲（reviewer の diff 監査基準）

- `mock/**` — 1 文字も触らない（データ変更なし）
- `tools/verify.mjs` / `tools/regress.mjs` / `tools/regress.baseline.json` — 変更なし
- `CLAUDE.md` — 変更なし。§1 レーン表・§6 への 2 行追記は **PM 判断 P-6** で、承認されたら **PM が別 PR で**行う
- `.claude/agents/**` / `.claude/commands/**` — architect は触らない。`usecase.md` の**配置は PM**
- 既存の設計書（`2026-09-07-report-review-modes.md`・`2026-09-07-small-task-tracker.md`・`2026-09-06-*.md`）— 参照するだけ
- `docs/handoff/2026-09-06-pm-decisions.md` — PM の記録
- `docs/dify/**` — 変更なし（サービスの追加ではない）

## 受け入れ条件

1. 設計書に **14 段（S0〜S13）** が、各段の **入力／出力／判断者／停止条件／所要目安**つきで書かれている
2. **PM 確認 4 問**（対象者・目的・観点・出口）が停止点として定義され、そのまま貼れる文例がある
3. **統廃合の 5 判定**に 5 軸一致数という機械的な基準があり、**DC-08（モード化）・GN-06（新規）・PT 分類新設（新分類）**の実例で埋まっている
4. 「モード化」と「目的別分割」の分かれ目が 1 行で言い切れている
5. Notion DB の **列一覧（9 必須 ＋ 4 任意）と状態遷移図**、書き戻し文面がある
6. `docs/handoff/usecase.command.md` が `/feature` と同じ書式（front-matter の `description` ／ `$ARGUMENTS` ／ ステップ ／ 停止条件 ／ 完了報告）で、
   **architect・implementer・reviewer への依頼文テンプレ**、**worktree の作り方**、**`git add -A` 禁止**、**attribution**、**PR 本文の型**、**逐語照合の指示**を含む
7. 件数が動いたときの**追従先 9 か所**（`mock/catalog.html` → `CLAUDE.md` §6 → Notion）が列挙されている
8. `node tools/verify.mjs` / `node tools/regress.mjs` が変更前と同じ結果（docs のみのため）
9. `git diff main...<branch> -- mock tools CLAUDE.md .claude` が**空**

## PR 分割案

| PR | ブランチ | 内容 | 前提 |
|---|---|---|---|
| **1** | `docs/76-usecase-intake` | `docs/handoff/2026-09-07-usecase-intake.md` ／ `docs/handoff/usecase.command.md` ／ `docs/handoff/usecase-intake.issue.md` | なし。**すべての作業と並列可** |
| **2**（PR ではなく PM 作業） | — | `cp docs/handoff/usecase.command.md .claude/commands/usecase.md` ＋ PM 判断 P-1〜P-8 の確定 ＋ Notion DB「ユースケース候補」の作成 | PR 1 マージ後 |
| **3**（任意） | `docs/76-claude-md-usecase` | `CLAUDE.md` §1 レーン表に `/usecase` を 1 行、§6 に本設計書への参照を 1 行 | **P-6 が「足す」のときだけ。PM が行う** |

## PM 判断待ち（推奨つき。設計書 §11 に全文）

**P-1・P-2・P-4 が決まらないと `/usecase` を配置できない。** それ以外は推奨案で進めてよい。

| # | 論点 | 推奨 |
|---|---|---|
| **P-1** | Notion DB を新設するか | **新 DB「ユースケース候補」を立てる**。元ページ 1 : 候補 1 が成立しない（DC-08 は 2:1）。GN-06 のようにチャット由来で元ページが無い候補も置ける |
| **P-2** | 状態の初期値 | **PM が `候補` の行を手で作る → `/usecase` が `確認中` に上げる**。`未処理を全部` ＝「状態＝`候補`」で定義が確定する |
| **P-3** | 書き戻しは自動か毎回確認か | **事実の欄は自動／判断の欄は PM**。自動＝状態・管理番号・設計書 URL・PR URL・Issue URL・取込日。手動＝PM メモ・統合先・`保留` への遷移 |
| **P-4** | Notion に「ユースケース化する」フラグ列を持つか | **持たない**。候補 DB に行があること自体がフラグ。フラグ列はチェック漏れで候補が沈む |
| **P-5** | `/usecase` と `/feature` の関係 | **`/usecase` は S0〜S5 を足した上位コマンド**。S6 以降は `/feature` の 1〜3 と同じ流れを内部で回す。停止点（★S3・★S8）は必ず PM に返す |
| **P-6** | `CLAUDE.md` に `/usecase` を書くか | **§1 レーン表に 1 行 ＋ §6 に参照 1 行**（load-bearing §2 には触らない）。**更新は PM** |
| **P-7** | 書き戻す URL の形式 | **main の blob URL**。ブランチ URL は squash マージ後に消える |
| **P-8** | Notion 原文の扱い | **要約と製造業への置き換え表現だけを設計書に書く**。原文はコミットしない（`CLAUDE.md` §2-10） |

## 補足：この Issue には実装（implementer）フェーズが無い

成果物が docs 3 ファイルだけで、`.claude/commands/usecase.md` への配置は **PM のみが行う**（architect も implementer も `.claude/**` を触らない）。
reviewer は PR 1 に対して **`mock/**`・`tools/**`・`CLAUDE.md`・`.claude/**` の差分が 0 行であること**と、`verify` / `regress` が変更前と同じ結果であることを確認すればよい。
