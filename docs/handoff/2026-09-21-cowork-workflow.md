# 設計書 — Cowork を PM の作業台として組み込む（v2）

- 起票：2026-09-21（v2：クラウド Claude Code のレビュー反映）　レーン：**M**（`CLAUDE.md` §4・§5・§7 に触るため直列）
- 目的：**ネット調査 → 画面案（HTML アーティファクト）→ 台本ドラフト** を Cowork（Claude Desktop）で行い、成果を既存の architect → implementer → reviewer の流れに **壊さずに** 合流させる
- 関連：`docs/handoff/2026-09-08-execution-split-and-runner.md`（実行場所の切り分け）、`docs/handoff/2026-09-07-claude-design-handoff.md`（画面案の書式）、`COWORK.md`（Cowork 向けの一枚）

## §1 前提（事実）

| 項目 | 事実 | 帰結 |
|---|---|---|
| クラウドの Claude Code | 外部サイトに出られない。GitHub 上の clone で動き、Mac のローカルフォルダは見えない | **調査は Cowork でしかできない**。Cowork の成果は branch を push してから取り込む |
| Cowork の実行環境 | Mac 上の隔離 VM。アタッチしたローカルフォルダは読み書き可 | ローカル clone を作業台にできる |
| Cowork の外部通信 | 許可リスト制。ホストの git 資格情報は使えない | `git push` は Cowork からできない。手渡しが要る |
| Cowork のツール | ファイル操作・シェル（Node/Python の有無は版に依存）・ネット検索・アーティファクト | `verify.mjs` は回れば回す、回らなければ取り込み側で回す |
| Cowork とスキル | フォルダ内の `.claude/**` は自動では読まない | `COWORK.md` と `CLAUDE.md` §2 を**タスク冒頭で明示的に読ませる** |
| 管理番号 | 永久欠番。Notion DB「ユースケース候補」で予約し `/usecase` が採番（`CLAUDE.md` §2-11） | **Cowork は `SVCS`/`CATS` を触らない**。新サービスは「提案」として渡す |
| Pages | `pages.yml` は `path: mock` | `docs/artifacts/` は公開されない（確認済み） |

## §2 「run:cowork」は文書上の用語（GitHub ラベルは作らない）

Cowork は Issue も PR も持たず、成果は**手渡しメモ**で渡す。ラベル `run:*` は取り込み後の Issue/PR に `run:cloud` を 1 つ付けるだけ（`CLAUDE.md` §7 の「1 つだけ」規則はそのまま）。`CLAUDE.md` §7 の表に足す行は「実行場所としての Cowork」を説明するためのもので、ラベル運用を増やさない。

## §3 Cowork の許可範囲（`COWORK.md` §1 と同じ。intake が機械的に照合する）

| 許可 | 禁止（diff にあれば intake は停止） |
|---|---|
| `mock/js/data/scenarios/<業種>/<分類>.js`（既存 id の台本） | `mock/js/data/catalog.js`・`ui.js`・`home.js`・`style.js`、`mock/js/app.js`・`render.js`・`events.js`・`portal/**`、`mock/css/**`、`mock/*.html` |
| `docs/**`（`docs/service-map.md` を除く）、`docs/artifacts/**` | `tools/**`・`tools/regress.baseline.json`、`CLAUDE.md`、`.claude/**`、`.github/**` |
| `data/world/<業種>/**` | `dify/state/**`・`dify/results/**`、`dify/apps/**`・`dify/env/**`（実装レイヤー。`/usecase`・implementer の領域） |

`regress.baseline.json` の更新は **intake でも行わない**（Cowork の許可範囲では件数が変わらないため、regress が FAIL したら禁止範囲への変更が混ざっている合図として停止する）。

## §4 流れ（S0〜S7）

| 段 | 誰が | 何を |
|---|---|---|
| S0 | PM | `git pull` → Cowork のタスクにローカル clone をアタッチ。冒頭で「`COWORK.md` と `CLAUDE.md` §2 を読んでから始めて」 |
| S1 | Cowork | ネット調査（URL・取得日を控える） |
| S2 | Cowork | 画面案：`docs/artifacts/<slug>/index.html` ＋ 設計ドラフト（`COWORK.md` §4） |
| S3 | Cowork | 台本ドラフト：`scenarios/**` の既存 id（`COWORK.md` §3）。新サービス候補は「提案」欄へ |
| S4 | Cowork | 手渡しメモ `docs/handoff/cowork/YYYY-MM-DD-<slug>.md`（`COWORK.md` §6）。回るなら `node tools/verify.mjs` |
| S5 | PM（Mac） | `git switch -c cowork/YYYYMMDD-<slug>` → `git add <触ったパス>` → commit → push |
| S6 | クラウドの Claude Code | `/cowork-intake cowork/YYYYMMDD-<slug>`：メモ照合 → 許可範囲照合 → verify / regress / index:check → 台本・docs・world のみなら **S** で PR、画面案が含まれれば **architect に渡す**（M/L）。新サービス提案は `/usecase` へ回すよう PM に報告 |
| S7 | reviewer / PM | 従来通り squash マージ → Pages 確認 → Mac で `git pull` |

## §5 衝突を起こさないための規則

1. **同じファイルを同時に触らない**（`CLAUDE.md` §5 の並列規則と同じ。ファイル集合が重ならなければ Claude Code と並列可）。Cowork は `catalog.js`・`regress.baseline.json`・`service-map.md` を触らないので、通常は衝突しない
2. **Cowork は `main` を汚さない**：常に `cowork/` ブランチ。作業前に `main` を最新にする
3. **`docs/service-map.md` は生成物**：Cowork は触らない。必要なら S6 で `npm run index`

## §6 画面案の位置づけ

Cowork の画面案は**設計の入力**であり実装ではない。取り込み側は `docs/artifacts/<slug>/index.html` と設計ドラフトを architect に渡し、architect が `docs/handoff/YYYY-MM-DD-<slug>.md` の設計書に起こす（M/L）。`render.js`・`components.css`・`tokens.css` の変更は implementer だけが行う。書式は `docs/handoff/2026-09-07-claude-design-handoff.md` に揃える。

## §7 ネット調査の扱い

`COWORK.md` §5 の通り。URL・取得日を「参照」に残す／実名は `docs/handoff/**` まで、`mock/**`・`docs/demo/**` には書かない／原文はコミットしない。

## §8 `/cowork-intake`（本文は本バンドルの `for-pm/.claude/commands/cowork-intake.md`。**配置は PM が Mac で `.claude/commands/` に行う**）

`CLAUDE.md` §4 の通り architect・implementer は `.claude/**` を触らないため、コマンド本文は `for-pm/` に置き、PM が Mac でコピーして通常の PR に含める（`/usecase` のときと同じ段取り）。

## §9 受け入れ条件

- `COWORK.md` がルートにある。`CLAUDE.md` 冒頭・§4・§5・§7 に Cowork の記述が入っている（`CLAUDE.md.additions.md` A〜D）
- `docs/handoff/cowork/README.md`・`docs/artifacts/README.md` がある
- `node tools/verify.mjs`・`node tools/regress.mjs`・`npm run index:check` が PASS（データ層は触らないので regress は変化なし）
- `.github/workflows/**`・`tools/**`・`.claude/**` の変更なし（コマンドは PM が別途配置）
- PR のラベルは `run:cloud` のみ

## §10 PM 判断が要る点

1. Cowork サンドボックスで Node 22 が動くか（動けば S4 で verify を回す。動かなければ intake で回す）
2. `docs/artifacts/` の肥大化対策（HTML アーティファクトは 300KB 前後。増えたら世代管理か Git LFS を検討）
