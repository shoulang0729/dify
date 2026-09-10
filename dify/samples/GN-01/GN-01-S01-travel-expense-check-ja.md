---
id: GN-01 S01
app: GN-01
type: normal
lang: ja
industry: mfg
mode: workflow
persona: 銭 芳
world:
  - mfg/company.md
  - mfg/documents.csv
inputs:
  claim_text: "@body"
  claim_file: null
  lang: ja
points:
  - 出張旅費規程（FIN-TRV-01）の該当条文が引用される
  - 金額が実費精算の範囲内であることが判定される（差し戻しにならない）
  - 同じ内容を中国語で聞いても同じ判定になる（S02 と対で確認）
---

精算 EX-0851：出張旅費（上海、S 社訪問）交通費 RMB 180、宿泊 RMB 420。事前承認番号 RG-25-0142 添付。
申請者：中村 大輔。
