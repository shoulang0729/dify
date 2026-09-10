---
id: RS-01 S02
app: RS-01
type: normal
lang: zh
industry: fin
mode: workflow
persona: 徐 涛
world:
  - fin/company.md
  - fin/clients.csv
  - fin/org.csv
inputs:
  target: 戊社
  industry: 服务业
  keywords: "@body"
  mode: 仅负面信息
  frequency: 每周
  distribution: 合规部
points:
  - S01（日本語設定）と同じ対象・キーワードを中国語で設定しても同じ挙動になる
  - 情報源が1系統のみのときはその旨が明記される
  - 取引継続の可否は判断せず、他の与信情報と合わせて評価するよう促す
---

请针对诉讼、行政处罚、资金周转恶化、环境事故等信息进行监测。
