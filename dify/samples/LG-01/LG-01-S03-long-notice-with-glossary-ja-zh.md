---
id: LG-01 S03
app: LG-01
type: volume
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
  glossary: "#012 治具／治具（avoid: 夹具）；#041 仕掛品／在制品（avoid: 半成品）；#088 ポカヨケ／防错；#102 赤札／红色标签（avoid: 红牌）；#215 再脱脂工程／再脱脂工序"
points:
  - 長文でも用語集の 5 語すべてが一貫して置換される
  - 用語集にない語は無理に統一せず原文の意味を保つ
  - 文書番号・品番がすべて保持される
---

技術連絡書 TN-25-046：SK-3310-A の仕掛品は、塗装前に治具から外した状態で 30 分以上放置しないこと。
放置した場合はポカヨケ用の赤札を付け、再脱脂工程へ戻すこと。夜勤帯でも同じ基準を適用し、治具の
番号（例：J-3310）を赤札に記入すること。判断に迷う場合は仕掛品を止めて班長へ確認すること。
