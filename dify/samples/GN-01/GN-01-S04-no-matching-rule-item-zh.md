---
id: GN-01 S04
app: GN-01
type: edge
lang: zh
industry: mfg
mode: workflow
persona: 銭 芳
world:
  - mfg/company.md
  - mfg/documents.csv
inputs:
  claim_text: "@body"
  claim_file: null
  lang: zh
points:
  - 費用管理規程・出張旅費規程のいずれにも該当条文が無いことを認める
  - 推測で承認・却下を判断せず財務課長の判断に回すと案内する
  - 中国語で聞いても同じ挙動になる（GN-01 T03 の日本語版に対応）
---

报销：个人手机话费补贴 RMB 100。申请人：赵伟。
