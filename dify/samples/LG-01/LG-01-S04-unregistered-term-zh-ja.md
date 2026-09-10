---
id: LG-01 S04
app: LG-01
type: edge
lang: zh
industry: mfg
mode: workflow
persona: 呉 婷
world:
  - mfg/company.md
  - mfg/equipment.csv
inputs:
  source_text: "@body"
  direction: 中国語 → 日本語
  style: 社内文書
  glossary: "#012 治具／治具（avoid: 夹具）"
points:
  - 用語集に無い語（品質全数検査など）は無理に統一訳を作らず自然な日本語にする
  - 用語集にある語（治具）は指定どおりに訳される
  - 訳文と原文の対応が明確（品番・治具番号はそのまま）
---

这次的新治具编号是J-3310，第一次使用要先做首件确认，然后再交给品质做全数检查。
