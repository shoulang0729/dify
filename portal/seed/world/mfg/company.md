<!-- 生成物。手で編集しない。node portal/scripts/gen-seed.mjs で shoulang0729/dify の data/world/mfg/company.md から生成 -->
# 架空世界マスタ — 会社

この会社・人物・数値はすべて架空です。実在の企業・製品とは関係ありません。
本公司、人物及数据均为虚构，与实际企业、产品无关。
This company, its people and all figures are fictional and unrelated to any real organization.

出典：`docs/handoff/2026-09-07-repo-layout-v2.md` §2-3・§2-4（既存資産からの実測・PM 確定値）。
このファイルは正本。台本・KB 文書・テストはここにある値だけを使う（`data/world/README.md` のルール）。

## 社名

| | ja | zh | en |
|---|---|---|---|
| 親会社 | 青嶺精工株式会社 | 青岭精工株式会社 | Seirei Seiko Co., Ltd. |
| 現地法人 | 青嶺精工（蘇州）有限公司 | 青岭精工（苏州）有限公司 | Seirei Seiko (Suzhou) Co., Ltd. |

## 拠点

| id | ja | zh | en | 国 | 時差（UTC） |
|---|---|---|---|---|---|
| suzhou | 蘇州工場 | 苏州工厂 | Suzhou Plant | 中国 | +8 |
| jp_hq | 日本本社 | 日本总部 | Japan HQ | 日本 | +9 |

`jp_hq` の英語表記 `Japan HQ` と親会社・現地法人の英語表記は、モックに英語表記が存在しなかったため
本 PR で新規に確定した値（設計書 §2-4・§10 Q6）。`蘇州工場` の英語表記 `Suzhou Plant` は台本に既出（44 か所）。
**モックへの反映は本 Issue ではやらない**（`mock/**` 不可侵）。

## 親子関係

日本本社（`jp_hq`）⇄ 蘇州工場（`suzhou`、現地法人）。管理部・工場長室の日本人駐在員（§ `people.csv`）は
蘇州工場に駐在し、日本本社への報告・連絡を担当する（台本 DC-01・DC-07 ほか）。

## 事業内容

| ja | zh | en |
|---|---|---|
| 自動車向け精密機械部品の製造（切削・プレス・組立） | 汽车用精密机械零部件的制造（切削・冲压・组装） | Precision machined components for the automotive industry (machining, pressing, assembly) |

## 規模（顧客に見せてよい説明・架空値）

- 蘇州工場：製造二課ほか複数課体制、生産ライン L1〜L3（旋盤・プレス・組立の複数工程）
- 主要顧客：`data/world/mfg/partners.csv` の `kind: customer`（記号のみ、社名は付けない。PM 決定 PT-8）

## 顧客に見せてよい説明（3 行）

1. 青嶺精工は自動車部品メーカー向けに精密機械部品（切削・プレス・組立）を製造する日系企業です。
2. 蘇州工場を中心に、日本本社と連携した品質管理・技術継承の体制を敷いています。
3. 本資料に登場する会社・人物・数値・型番はすべて架空のデモ用データです。
