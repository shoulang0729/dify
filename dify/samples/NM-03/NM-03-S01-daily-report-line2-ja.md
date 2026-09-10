---
id: NM-03 S01
app: NM-03
type: normal
lang: ja
industry: mfg
mode: workflow
persona: 李 強
world:
  - mfg/company.md
  - mfg/equipment.csv
inputs:
  text: "@body"
  lang: ja
points:
  - 生産数・不良数・稼働状況・残業などの数値が構造化されて抽出される
  - PX-200 のアラーム停止など特記事項が要約に反映される
  - 中国語で同じ内容を伝えても同じ結果になる（S02 と対）
---

本日（9/9）L2 ラインの状況：生産数 6,200 個、不良 26 個、稼働状況は普段どおり、残業 1.5 時間。
備考：PX-200 で E-47 が発生し 20 分停止（金型 D-118 のガイド点検を保全課へ依頼済み）。
