---
id: KN-01 S04
app: KN-01
type: edge
lang: zh
industry: mfg
mode: chat
persona: 王 磊
world:
  - mfg/company.md
  - mfg/products.csv
query: "@body"
points:
  - KB に無い材質・加工方式の質問には推測で埋めず「該当する記録が見つかりません」と答える
  - 中国語で聞いても同じ挙動になる（ja 版は dify/tests/KN-01.json の T05 で確認済み）
  - 関連しそうな別文書（工程条件書など）があれば参考として案内する
---

钛合金的放电加工条件是什么？
