---
id: RS-01 S03
app: RS-01
type: edge
lang: zh
industry: fin
mode: workflow
persona: 徐 涛
world:
  - fin/company.md
  - fin/clients.csv
inputs:
  target: 丙社
  industry: 汽车零部件
  keywords: "@body"
  mode: 一般
  frequency: 每周
  distribution: 合规部
points:
  - キーワードを絞らない「一般」モードでは、件数が多くなり得ることを一次回答で明示する
  - 該当件数が多いときは、キーワードの絞り込みを提案する（推測で件数を作らない）
  - 除外すべき一般的な好意的記事を紛れ込ませない
---

请收集丙社相关的所有新闻，不限特定关键词，采集模式选择一般新闻即可。
