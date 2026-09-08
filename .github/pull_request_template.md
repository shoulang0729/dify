## 参照した設計書（S レーンは Issue）

<!-- docs/handoff/... のパスとセクション、または Issue 番号 -->

## 実行場所（`run:*`。CLAUDE.md §7・dify/DEPLOY.md §7）

<!-- 対応する Issue と同じものを 1 つだけ選ぶ。判定基準は
     docs/handoff/2026-09-08-execution-split-and-runner.md §1-1（O1〜O10） -->

- [ ] `run:cloud`（クラウドだけで完結）
- [ ] `run:runner`（GitHub ホストランナー。KB 投入・テスト実行）
- [ ] `run:mac`（PM の Mac。ブラウザのログイン済みセッションが要る）

## 変更内容

<!-- 何をどう変えたか -->

## 触った層／触っていない層

<!-- 触った層と、設計書の「触らない範囲」の再掲 -->

## 検証結果

<!-- verify / regress の実行結果の末尾を貼る。--update した場合は設計書の節を書く -->

```
$ npm run verify
（末尾を貼る）

$ npm run regress
（末尾を貼る）
```

## スクリーンショット（UI 変更時、ライト・ダーク）

<!-- UI 変更がない場合は「該当なし」 -->

## Closes #
