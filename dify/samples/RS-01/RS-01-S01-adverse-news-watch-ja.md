---
id: RS-01 S01
app: RS-01
type: normal
lang: ja
industry: fin
mode: workflow
persona: 徐 涛
world:
  - fin/company.md
  - fin/clients.csv
  - fin/org.csv
inputs:
  target: 戊社
  industry: サービス業
  keywords: "@body"
  mode: ネガティブ情報のみ
  frequency: 週次
  distribution: コンプライアンス部
points:
  - 該当記事が無ければ「該当なし」と明示され、収集自体の失敗と区別される
  - ネガティブ情報のみモードで一般的な好意的記事が混入しない
  - 出力ファイル名が対象先ごとに生成される
---

訴訟・行政処罰・資金繰り悪化・環境事故に関する情報を対象にしてください。
