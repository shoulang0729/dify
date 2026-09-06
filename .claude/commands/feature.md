---
description: architect → implementer → reviewer を順に回して、お題を設計・実装・検証・マージまで進める。M/L レーン用。
---

お題: $ARGUMENTS

以下のパイプラインを順に実行する。各ステップの結果を短く報告しながら進め、**停止条件に当たったら止まって PM（ユーザー）に判断を求める**。

## 0. レーン判定（PM 代行）

お題が **S**（文言・余白・要素の削除/移動のみで、データ層・多言語辞書・トークン・共通レイヤー・Pages 設定に触らない）か **M/L**（それ以外）かを判定して宣言する。
- **S** → architect を飛ばす。受け入れ条件を1〜3行で書き、ステップ2へ
- **M/L** → ステップ1へ
- 迷ったら M/L

## 1. 設計（architect）

`architect` サブエージェントに依頼：
> お題「$ARGUMENTS」の設計をして。`docs/handoff/YYYY-MM-DD-<slug>.md` に設計書を書き、Issue を立てて（`gh` が無ければ `.issue.md` に）、設計書パス・Issue 番号・PR 分割案を報告して。プロダクト判断が要る点は決めずに列挙して。

**停止条件**：architect が「PM 判断待ち」を返したら、その点をユーザーに提示して止まる。

## 1.5 モック承認（UI の見せ方を変えるお題のみ）

画面構成・レイアウト・パターンの見せ方を変えるなら、実装前に**設計書の要点（レイアウト図・変更点）をユーザーに提示して承認を得る**。承認されるまでステップ2に進まない。S レーンでは省略。

## 2. 実装（implementer）

`implementer` サブエージェントに依頼：
> Issue #<番号> を実装して。設計書 `<パス>` と `CLAUDE.md` の load-bearing を守り、`feat/<issue>-<slug>` ブランチで作業。`node tools/verify.mjs` と `node tools/regress.mjs` を PASS させて PR を出し、PR 番号と検証結果を報告して。

**停止条件**：implementer が「設計書と矛盾」「load-bearing を破らないと実装不可」を返したら止まる。

## 3. 検証・マージ（reviewer）

`reviewer` サブエージェントに依頼：
> PR #<番号> を検証して。`verify.mjs` / `regress.mjs` を実行し、diff を設計書と load-bearing に照合。全 PASS かつ逸脱なしなら squash マージしてブランチを削除し、Pages 反映を確認して報告して。reject なら理由を具体的に。

**停止条件**：reject されたら、理由をユーザーに報告し、**自動で再実装ループに入らずに**指示を待つ。

## 並列実行（PM 判断）

- ファイル集合が重ならないお題は別ブランチで同時に進めてよい
- 同じファイル（例：`mock/catalog.html` の同じ関数）を触るお題は直列
- お題 N が実装中でも、お題 N+1 の architect は先に走らせてよい（設計書は衝突しない）

## 完了報告

```
レーン: S / M/L
設計書: <パス>（S は「なし」）
Issue: #<番号>
PR: #<番号> → squash マージ済み / reject（理由）
verify: PASS / FAIL   regress: PASS / 差分（設計書と一致・不一致）
公開: https://shoulang0729.github.io/dify/ 反映確認 済 / 未
```
