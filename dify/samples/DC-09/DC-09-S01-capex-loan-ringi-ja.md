---
id: DC-09 S01
app: DC-09
type: normal
lang: ja
industry: fin
mode: workflow
persona: 鄭 麗華
world:
  - fin/company.md
  - fin/products.csv
  - fin/clients.csv
  - fin/calendar.md
inputs:
  doc_type: 議案
  title: 丁社 設備資金貸出 新規実行の件
  amount: "1,500万元"
  currency: CNY
  term: 3年
  ref_doc: RNG-2026-0089
  note: "@body"
  revise_note: null
points:
  - 決裁ルートが規程の金額基準に基づき機械判定される（LLM が自分で判定しない）
  - 添付予定の決算書が無いことが「要記入」として明示される
  - 参照した類似稟議（RNG-2026-0089）の構成に沿ったドラフトになる
---

丁社（現地国有企業・素材）向けに、華東地区の新工場建設に伴う生産設備購入のための設備資金貸出を
新規に実行したい。金額は1,500万元、期間は3年。担保は新工場の土地使用権を予定している。
参照する類似稟議はRNG-2026-0089（丙社 設備資金貸出 新規）。決算書はまだ未着手のため、
要記入として扱ってほしい。
