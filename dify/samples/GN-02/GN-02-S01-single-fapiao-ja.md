---
id: GN-02 S01
app: GN-02
type: normal
lang: ja
industry: mfg
mode: workflow
persona: 銭 芳
world:
  - mfg/company.md
  - mfg/partners.csv
inputs:
  invoice_text: "@body"
  invoice_file: null
points:
  - 発票番号・販売元・税抜/税込金額が構造化されて抽出される
  - 税率・税額の計算が整合していることが分かる
  - 中国語表記の発票でも同じ項目が抽出される（S02 と対）
---

発票：発票番号 0250901…12、販売元 S 工具、税抜金額 RMB 8,850.00、税率 13%、税額 RMB 1,150.50、
税込金額 RMB 10,000.50、日付 2025-09-01。
