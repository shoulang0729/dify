---
id: GN-02 S02
app: GN-02
type: normal
lang: zh
industry: mfg
mode: workflow
persona: 銭 芳
world:
  - mfg/company.md
  - mfg/partners.csv
inputs:
  invoice_text: "@body"
  invoice_file: null
points:
  - 中文发票也能正确提取发票号码、供应商、金额等项目
  - 购买方名称与本公司一致会被确认
  - 与日文示例（S01）提取的字段结构一致
---

增值税专用发票 发票号码：0250903…27 购买方：青岭精工（苏州）有限公司 销售方（供应商）：T公司
金额（不含税）：RMB 12,000.00 税率：13% 税额：RMB 1,560.00 价税合计：RMB 13,560.00 开票日期：2025-09-03
