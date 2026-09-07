<!-- 生成物。手で編集しない。生成コマンド: npm run index （= node tools/gen-index.mjs） -->

# 管理番号索引

管理番号（`KN-02` など）から ①デモ台本 ②DSL ③ユースケース ④KB ④テスト を横断する索引。
`—` は未着手・未投入（欠落が見える設計。設計書 `docs/handoff/2026-09-07-repo-layout-v2.md` §1-3）。

| 管理番号 | サービス | 分類 | 成熟度 | ①デモ台本 | ②DSL | ③ユースケース | ④KB | ④テスト |
|---|---|---|---|---|---|---|---|---|
| KN-01 | 技術ナレッジQA | KN/tech | 提供中 | [kn.js](../mock/js/data/scenarios/kn.js) qa | [KN-01-tech-knowledge-qa.yml](../dify/apps/KN-01-tech-knowledge-qa.yml) | [KN-01.md](./dify/usecases/KN-01.md) | [3 件](../dify/kb/KN-01/) | [4 件](../dify/tests/KN-01.json) |
| KN-02 | 設備マニュアル・取扱説明書の検索 | KN/tech | 提供中 | [kn.js](../mock/js/data/scenarios/kn.js) qa | — | [KN-02.md](./dify/usecases/KN-02.md) | — | — |
| KN-03 | 社内規程・就業規則QA | KN/rule | 提供中 | [kn.js](../mock/js/data/scenarios/kn.js) qa | — | [KN-03.md](./dify/usecases/KN-03.md) | — | — |
| KN-04 | 労務・総務の社内問い合わせ対応 | KN/rule | 試行版 | [kn.js](../mock/js/data/scenarios/kn.js) qa | — | [KN-04.md](./dify/usecases/KN-04.md) | — | — |
| KN-05 | 当局通達の影響分析・マニュアル反映（NFRA・地方当局等） | KN/rule | 試行版 | [kn.js](../mock/js/data/scenarios/kn.js) upload | — | [KN-05.md](./dify/usecases/KN-05.md) | — | — |
| QA-01 | 不具合原因分析・報告書（8D）作成 | QA/defect | 試行版 | [qa.js](../mock/js/data/scenarios/qa.js) upload | — | [QA-01.md](./dify/usecases/QA-01.md) | — | — |
| QA-02 | 変更点影響予測（4M変更管理） | QA/change | 構想 | [qa.js](../mock/js/data/scenarios/qa.js) diff | — | [QA-02.md](./dify/usecases/QA-02.md) | — | — |
| QA-03 | 顧客クレーム一次回答・分類 | QA/change | 試行版 | [qa.js](../mock/js/data/scenarios/qa.js) form | — | [QA-03.md](./dify/usecases/QA-03.md) | — | — |
| QA-04 | 完成車メーカー工程監査への対応資料 | QA/change | 試行版 | [qa.js](../mock/js/data/scenarios/qa.js) upload | — | [QA-04.md](./dify/usecases/QA-04.md) | — | — |
| DC-01 | 日本本社への報告資料作成 | DC/report | 提供中 | [dc.js](../mock/js/data/scenarios/dc.js) form | [DC-01-hq-report-draft.yml](../dify/apps/DC-01-hq-report-draft.yml) | [DC-01.md](./dify/usecases/DC-01.md) | — | [4 件](../dify/tests/DC-01.json) |
| DC-02 | 議事録作成と次回論点整理 | DC/report | 提供中 | [dc.js](../mock/js/data/scenarios/dc.js) upload | — | [DC-02.md](./dify/usecases/DC-02.md) | — | — |
| DC-03 | 教育・OJT資料作成 | DC/site | 試行版 | [dc.js](../mock/js/data/scenarios/dc.js) upload | — | [DC-03.md](./dify/usecases/DC-03.md) | — | — |
| DC-04 | 安全衛生・5S掲示物・改善提案の中国語化 | DC/site | 提供中 | [dc.js](../mock/js/data/scenarios/dc.js) upload | — | [DC-04.md](./dify/usecases/DC-04.md) | — | — |
| DC-05 | 稟議・申請書の作成と記載漏れ検出 | DC/apply | 試行版 | [dc.js](../mock/js/data/scenarios/dc.js) form | — | [DC-05.md](./dify/usecases/DC-05.md) | — | — |
| DC-06 | 輸出入・通関書類の確認 | DC/apply | 試行版 | [dc.js](../mock/js/data/scenarios/dc.js) upload | — | [DC-06.md](./dify/usecases/DC-06.md) | — | — |
| DC-07 | サプライヤー契約書ドラフト支援 | DC/apply | 試行版 | [dc.js](../mock/js/data/scenarios/dc.js) form | — | [DC-07.md](./dify/usecases/DC-07.md) | — | — |
| DC-08 | 報告レビュー（提出前チェック／受領後の論点整理） | DC/report | 試行版 | [dc.js](../mock/js/data/scenarios/dc.js) form | — | [DC-08.md](./dify/usecases/DC-08.md) | — | — |
| LG-01 | 日中翻訳（社内の言い方に揃える） | LG/trans | 提供中 | [lg.js](../mock/js/data/scenarios/lg.js) form | — | [LG-01.md](./dify/usecases/LG-01.md) | — | — |
| LG-02 | 社内用語・呼称の統一（用語集） | LG/trans | 試行版 | [lg.js](../mock/js/data/scenarios/lg.js) upload | — | [LG-02.md](./dify/usecases/LG-02.md) | — | — |
| LG-03 | 現地スタッフとの認識合わせ（手順の中国語書き下し） | LG/align | 試行版 | [lg.js](../mock/js/data/scenarios/lg.js) form | — | [LG-03.md](./dify/usecases/LG-03.md) | — | — |
| LG-04 | ビジネスメール作成（日中往復） | LG/align | 提供中 | [lg.js](../mock/js/data/scenarios/lg.js) form | — | [LG-04.md](./dify/usecases/LG-04.md) | — | — |
| NM-01 | 見積り・原価計算 | NM/cost | 構想 | [nm.js](../mock/js/data/scenarios/nm.js) form | — | [NM-01.md](./dify/usecases/NM-01.md) | — | — |
| NM-02 | 購買見積の比較 | NM/cost | 試行版 | [nm.js](../mock/js/data/scenarios/nm.js) upload | — | [NM-02.md](./dify/usecases/NM-02.md) | — | — |
| NM-03 | 日報・実績の集計と要約 | NM/actual | 提供中 | [nm.js](../mock/js/data/scenarios/nm.js) upload | — | [NM-03.md](./dify/usecases/NM-03.md) | — | — |
| NM-04 | 在庫・納期の問い合わせ回答 | NM/actual | 試行版 | [nm.js](../mock/js/data/scenarios/nm.js) lookup | — | [NM-04.md](./dify/usecases/NM-04.md) | — | — |
| NM-05 | データ分析アシスタント | NM/actual | 試行版 | [nm.js](../mock/js/data/scenarios/nm.js) lookup | — | [NM-05.md](./dify/usecases/NM-05.md) | — | — |
| EN-01 | 仕様改訂の差分検出・取引先用語対応 | EN/spec | 試行版 | [en.js](../mock/js/data/scenarios/en.js) diff | — | [EN-01.md](./dify/usecases/EN-01.md) | — | — |
| EN-02 | BOM逆引き | EN/bom | 試行版 | [en.js](../mock/js/data/scenarios/en.js) lookup | — | [EN-02.md](./dify/usecases/EN-02.md) | — | — |
| EN-03 | 図面の類似検索 | EN/bom | 構想 | [en.js](../mock/js/data/scenarios/en.js) upload | — | [EN-03.md](./dify/usecases/EN-03.md) | — | — |
| GN-01 | 経費精算チェック | GN/office | 提供中 | [gn.js](../mock/js/data/scenarios/gn.js) upload | — | [GN-01.md](./dify/usecases/GN-01.md) | — | — |
| GN-02 | 請求書（発票）処理 | GN/office | 提供中 | [gn.js](../mock/js/data/scenarios/gn.js) upload | — | [GN-02.md](./dify/usecases/GN-02.md) | — | — |
| GN-03 | 受注・発注書の読み取りと登録支援 | GN/office | 試行版 | [gn.js](../mock/js/data/scenarios/gn.js) upload | — | [GN-03.md](./dify/usecases/GN-03.md) | — | — |
| GN-04 | スケジュール調整 | GN/daily | 試行版 | [gn.js](../mock/js/data/scenarios/gn.js) qa | — | [GN-04.md](./dify/usecases/GN-04.md) | — | — |
| GN-05 | 文書要約 | GN/daily | 提供中 | [gn.js](../mock/js/data/scenarios/gn.js) upload | — | [GN-05.md](./dify/usecases/GN-05.md) | — | — |
| GN-06 | 頼まれ事・放置業務の追跡 | GN/daily | 試行版 | [gn.js](../mock/js/data/scenarios/gn.js) form | — | [GN-06.md](./dify/usecases/GN-06.md) | — | — |
| PT-01 | 取引先・サプライヤーの与信・リスク監視 | PT/data | 試行版 | [pt.js](../mock/js/data/scenarios/pt.js) lookup | — | [PT-01.md](./dify/usecases/PT-01.md) | — | — |
| PT-02 | 業界・材料相場リサーチ（本社報告の外部根拠） | PT/data | 試行版 | [pt.js](../mock/js/data/scenarios/pt.js) form | — | [PT-02.md](./dify/usecases/PT-02.md) | — | — |
| PT-03 | 業界誌・技術記事アーカイブの横断検索 | PT/data | 試行版 | [pt.js](../mock/js/data/scenarios/pt.js) qa | — | [PT-03.md](./dify/usecases/PT-03.md) | — | — |
| PT-04 | 現地給与水準の照会と給与改定の妥当性確認 | PT/data | 構想 | [pt.js](../mock/js/data/scenarios/pt.js) lookup | — | [PT-04.md](./dify/usecases/PT-04.md) | — | — |
| PT-05 | 現地技術者・管理職の採用支援（一次面談の要約・候補者サマリ） | PT/service | 構想 | [pt.js](../mock/js/data/scenarios/pt.js) upload | — | [PT-05.md](./dify/usecases/PT-05.md) | — | — |
| PT-06 | 戦略購買の立案（集約・複数年・代替サプライヤー） | PT/service | 構想 | [pt.js](../mock/js/data/scenarios/pt.js) upload | — | [PT-06.md](./dify/usecases/PT-06.md) | — | — |
| PT-07 | RFQ 起草と購買代行への引き継ぎ | PT/service | 構想 | [pt.js](../mock/js/data/scenarios/pt.js) form | — | [PT-07.md](./dify/usecases/PT-07.md) | — | — |
| PT-08 | 研修プログラム化と実施代行・受講管理 | PT/service | 構想 | [pt.js](../mock/js/data/scenarios/pt.js) form | — | [PT-08.md](./dify/usecases/PT-08.md) | — | — |
| 集計 | — | — | — | ①43 | ②2 | ③43 | ④KB 1 | ④テスト 2 |
