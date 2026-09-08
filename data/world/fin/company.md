# 架空世界マスタ（金融）— 会社

この会社・人物・数値はすべて架空です。実在の企業・製品とは関係ありません。
本公司、人物及数据均为虚构，与实际企业、产品无关。
This company, its people and all figures are fictional and unrelated to any real organization.

出典：`docs/handoff/2026-09-08-finance-catalog.md` §7-2（PM 確定値）。
このファイルは正本。台本・KB 文書・テストはここにある値だけを使う（`data/world/README.md` のルール）。
**製造業マスタ（`data/world/company.md` ほか）の語は 1 つも流用しない**（独立した語彙）。

## 社名

| | ja | zh | en |
|---|---|---|---|
| 銀行 | 瑞央銀行株式会社 | 瑞央银行股份有限公司 | Zuio Bank, Ltd. |
| 現地法人 | 瑞央銀行（中国）有限公司 | 瑞央银行（中国）有限公司 | Zuio Bank (China) Co., Ltd. |

> **実在名との衝突確認（`docs/handoff/2026-09-08-finance-catalog.md` §9 #4）**：「瑞央」を冠する実在の銀行は
> implementer が確認できた範囲では見当たらない。ただし邦銀の雅称「瑞穂」（みずほ）と頭文字（瑞）が共通するため、
> 紛らわしいと感じる場合は代替候補「碧洋銀行 / 碧洋银行 / Hekiyo Bank」への差し替えを検討すること。
> **最終判断は PM**（本ファイルは PM 確定稿「瑞央銀行」で作成している）。

## 拠点

| id | ja | zh | en | 国 | 時差（UTC） |
|---|---|---|---|---|---|
| sh_hq | 上海本部 | 上海总部 | Shanghai Head Office | 中国 | +8 |
| dalian | 大連支店 | 大连分行 | Dalian Branch | 中国 | +8 |
| jp_hq | 日本本店 | 日本总行 | Japan Head Office | 日本 | +9 |

## 親子関係

日本本店（`jp_hq`）⇄ 上海本部（`sh_hq`、現地法人の統括拠点）⇄ 大連支店（`dalian`）。
日本人駐在員（§ `people.csv`）は上海本部に駐在し、日本本店への報告・当局報告の取りまとめを担当する。

## 事業内容

| ja | zh | en |
|---|---|---|
| 日系企業向け法人取引・現地企業取引・市場業務 | 面向日资企业的法人业务・本地企业业务・市场业务 | Corporate banking for Japanese-affiliated clients, local corporate banking, and markets business |

## 規模（顧客に見せてよい説明・架空値）

- 上海本部を中心に、日系法人取引（営業第一部）と現地企業取引（営業第二部）の 2 本立て
- 主要顧客：`data/world/fin/clients.csv`（記号のみ、社名は付けない。製造業マスタの `partners.csv` と同じ流儀）

## 顧客に見せてよい説明（3 行）

1. 瑞央銀行は中国に進出した日系企業と現地企業の双方を顧客とする在中日系銀行です。
2. 上海本部を中心に、日本本店と連携した審査・リスク管理・当局対応の体制を敷いています。
3. 本資料に登場する会社・人物・数値・文書番号はすべて架空のデモ用データです。
