---
id: GN-02 S05
app: GN-02
type: normal
lang: zh
industry: mfg
mode: workflow
persona: 銭 芳
world:
  - mfg/company.md
  - mfg/partners.csv
inputs:
  invoice_text: ""
  invoice_file: null
  invoice_image: "assets/GN-02-S05-fapiao-photo.png"
points:
  - 発票の写真 1 枚から、発票番号・販売元・税抜/税込金額が抽出される（テキストを貼らずに済む）
  - 読み取れなかった項目は warnings に日本語で出る（埋めない）
  - 画像の書き起こしは中国語のまま、担当者向けの warnings は日本語（CLAUDE.md §2-5）
---

（本文：この発票の写真から項目を抽出し、基幹取込用 CSV を作ってください。）
