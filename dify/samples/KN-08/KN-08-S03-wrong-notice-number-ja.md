---
id: KN-08 S03
app: KN-08
type: edge
lang: ja
industry: fin
mode: chat
persona: 中野 隆
world:
  - fin/company.md
  - fin/calendar.md
query: "@body"
points:
  - 未登録の通達番号を指定すると「指定された通達が登録されていません。まず登録してください」と定型で返す
  - 片方（NTF-2025-041）が登録済みでも、もう片方が未登録なら比較を実行せず推測で差分を作らない
  - 中国語で聞いても同じ挙動になる
---

NTF-2025-041 と NTF-2026-099 を比較して、変更点を教えてください
