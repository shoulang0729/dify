---
id: LG-01 S01
app: LG-01
type: normal
lang: ja
industry: mfg
mode: workflow
persona: 呉 婷
world:
  - mfg/company.md
  - mfg/products.csv
inputs:
  source_text: "@body"
  direction: 日本語 → 中国語
  style: 現場掲示
  glossary: "#012 治具／治具（avoid: 夹具）；#041 仕掛品／在制品（avoid: 半成品）；#088 ポカヨケ／防错"
points:
  - 用語集どおりの訳語（在制品・治具・防错）が使われる
  - avoid 指定の語（半成品・夹具）が使われない
  - 品番・文書番号（SK-2207-B・TN-25-045）がそのまま保持される
---

技術連絡書 TN-25-045：SK-2207-B の仕掛品は、検査前に治具へ再度セットしポカヨケセンサーの反応を
確認すること。
