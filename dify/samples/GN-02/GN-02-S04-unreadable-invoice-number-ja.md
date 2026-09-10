---
id: GN-02 S04
app: GN-02
type: edge
lang: ja
industry: mfg
mode: workflow
persona: 銭 芳
world:
  - mfg/company.md
inputs:
  invoice_text: "@body"
  invoice_file: null
points:
  - 発票番号が不明な場合は「発票番号：不明」と正直に出力し、推測で埋めない
  - 読み取れた金額欄は正しく抽出される
  - 中国語で同じ状況を伝えても同じ挙動になる（GN-02 T04 に対応）
---

発票の一部が破損しており、発票番号が読み取れません。金額欄のみ RMB 2,850.00 と読めます。
