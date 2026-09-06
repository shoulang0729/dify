# docs/handoff — 設計書置き場（architect → implementer の受け渡し）

architect が書き、implementer が読み、reviewer が照合する。**implementer は変更しない。**

## 命名
```
docs/handoff/YYYY-MM-DD-<slug>.md          設計書（機能ごとに1ファイル）
docs/handoff/<slug>.issue.md               gh が使えないときの Issue 本文の下書き
```

## 設計書に必ず書くこと
1. 目的 / 背景（お題そのまま + 解釈）
2. **変更する範囲**（ファイル・関数・データ）
3. **触らない範囲**（明示。reviewer はここを diff 監査の基準にする）
4. 受け入れ条件（機械検証できる形で。`verify.mjs` / `regress.mjs` の期待結果を含む）
5. 多言語が絡むなら **ja / zh / en の文言をすべて**（implementer に翻訳させない）
6. データ層（`CATS` / `SVCS` / `TAGS`）を変えるなら **変更前後の件数と id 一覧**
7. UI 変更ならレイアウト図（ASCII 可）・状態遷移
8. PR 分割案 / 並列可否（ファイル集合が重なるか）
9. PM 判断待ちの点（あれば。決めずに列挙）

## レーン
- **S**：文言・余白・要素の削除/移動のみ → 設計書不要。PM が Issue に受け入れ条件を書く
- **M/L**：それ以外 → 設計書必須

詳細は `CLAUDE.md` §1〜§4 と `.claude/agents/*.md`。
