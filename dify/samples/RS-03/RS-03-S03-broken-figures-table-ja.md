---
id: RS-03 S03
app: RS-03
type: edge
lang: ja
industry: fin
mode: workflow
persona: 石田 由美
world:
  - fin/company.md
  - fin/clients.csv
inputs:
  files: null
  client_id: 乙社
  document_text: "@body"
  peer_avg: null
points:
  - 数値が判読できない箇所は推測で埋めず「開示情報からは判断できません」等の定型で答える
  - 判読できるテキスト情報だけから言える範囲に要約を限定する
  - 与信先の信用力への影響を断定しない
---

決算短信（抜粋、OCR結果）：セグメント情報の表が文字化けしており数値が判読できません。
売上高 ■■■億円、営業利益 ■■億円、中国事業 ―――。注記本文のみ判読可：
「中国現地法人の物流機能拡充について記載あり」。
