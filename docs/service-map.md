<!-- 生成物。手で編集しない。生成コマンド: npm run index （= node tools/gen-index.mjs） -->

# 管理番号索引

管理番号（`KN-02` など）から 業種 ①デモ台本（製造・金融・IT） ②DSL ③ユースケース ④KB ④テスト を横断する索引。
`—` は未着手・未投入（欠落が見える設計。設計書 `docs/handoff/2026-09-07-repo-layout-v2.md` §1-3）。

| 管理番号 | サービス | 分類 | 業種 | 成熟度 | ①台本(製造) | ①台本(金融) | ①台本(IT) | ②DSL | ③ユースケース | ④KB | ④テスト |
|---|---|---|---|---|---|---|---|---|---|---|---|
| KN-01 | 技術ナレッジQA | KN/tech | 製造 | 提供中 | [mfg/kn.js](../mock/js/data/scenarios/mfg/kn.js) qa | — | — | [KN-01-tech-knowledge-qa.yml](../dify/apps/KN-01-tech-knowledge-qa.yml) | [KN-01.md](./dify/usecases/KN-01.md) | [6 件](../dify/kb/KN-01/) | [4 件](../dify/tests/KN-01.json) |
| KN-02 | 設備マニュアル・取扱説明書の検索 | KN/tech | 製造 | 提供中 | [mfg/kn.js](../mock/js/data/scenarios/mfg/kn.js) qa | — | — | [KN-02-equipment-manual-search.yml](../dify/apps/KN-02-equipment-manual-search.yml) | [KN-02.md](./dify/usecases/KN-02.md) | [6 件](../dify/kb/KN-02/) | [4 件](../dify/tests/KN-02.json) |
| KN-03 | 社内規程・就業規則QA | KN/rule | 製造 | 提供中 | [mfg/kn.js](../mock/js/data/scenarios/mfg/kn.js) qa | — | — | [KN-03-internal-rules-qa.yml](../dify/apps/KN-03-internal-rules-qa.yml) | [KN-03.md](./dify/usecases/KN-03.md) | [6 件](../dify/kb/KN-03/) | [4 件](../dify/tests/KN-03.json) |
| KN-04 | 社内問い合わせ受付とFAQ蓄積 | KN/rule | 製造・金融・IT | 試行版 | [mfg/kn.js](../mock/js/data/scenarios/mfg/kn.js) qa | [fin/kn.js](../mock/js/data/scenarios/fin/kn.js) qa | — | — | [KN-04.md](./dify/usecases/KN-04.md) | — | — |
| KN-05 | 当局通達の影響分析・マニュアル反映 | KN/rule | 製造・金融・IT | 試行版 | [mfg/kn.js](../mock/js/data/scenarios/mfg/kn.js) upload | [fin/kn.js](../mock/js/data/scenarios/fin/kn.js) qa | — | — | [KN-05.md](./dify/usecases/KN-05.md) | — | — |
| QA-01 | 不具合原因分析・報告書（8D）作成 | QA/defect | 製造 | 試行版 | [mfg/qa.js](../mock/js/data/scenarios/mfg/qa.js) upload | — | — | — | [QA-01.md](./dify/usecases/QA-01.md) | — | — |
| QA-02 | 変更点影響予測（4M変更管理） | QA/change | 製造 | 構想 | [mfg/qa.js](../mock/js/data/scenarios/mfg/qa.js) diff | — | — | — | [QA-02.md](./dify/usecases/QA-02.md) | — | — |
| QA-03 | 顧客クレーム一次回答・分類 | QA/change | 製造 | 試行版 | [mfg/qa.js](../mock/js/data/scenarios/mfg/qa.js) form | — | — | — | [QA-03.md](./dify/usecases/QA-03.md) | — | — |
| QA-04 | 完成車メーカー工程監査への対応資料 | QA/change | 製造 | 試行版 | [mfg/qa.js](../mock/js/data/scenarios/mfg/qa.js) upload | — | — | — | [QA-04.md](./dify/usecases/QA-04.md) | — | — |
| DC-01 | 日本本社への報告資料作成 | DC/report | 製造 | 提供中 | [mfg/dc.js](../mock/js/data/scenarios/mfg/dc.js) form | — | — | [DC-01-hq-report-draft.yml](../dify/apps/DC-01-hq-report-draft.yml) | [DC-01.md](./dify/usecases/DC-01.md) | — | [4 件](../dify/tests/DC-01.json) |
| DC-02 | 議事録作成と次回論点整理 | DC/report | 製造・金融・IT | 提供中 | [mfg/dc.js](../mock/js/data/scenarios/mfg/dc.js) upload | [fin/dc.js](../mock/js/data/scenarios/fin/dc.js) upload | — | [DC-02-meeting-minutes.yml](../dify/apps/DC-02-meeting-minutes.yml) | [DC-02.md](./dify/usecases/DC-02.md) | — | [4 件](../dify/tests/DC-02.json) |
| DC-03 | 教育・OJT資料作成 | DC/site | 製造 | 試行版 | [mfg/dc.js](../mock/js/data/scenarios/mfg/dc.js) upload | — | — | — | [DC-03.md](./dify/usecases/DC-03.md) | — | — |
| DC-04 | 安全衛生・5S掲示物・改善提案の中国語化 | DC/site | 製造 | 提供中 | [mfg/dc.js](../mock/js/data/scenarios/mfg/dc.js) upload | — | — | [DC-04-site-notice-zh.yml](../dify/apps/DC-04-site-notice-zh.yml) | [DC-04.md](./dify/usecases/DC-04.md) | — | [4 件](../dify/tests/DC-04.json) |
| DC-05 | 稟議・申請書の作成と記載漏れ検出 | DC/apply | 製造 | 試行版 | [mfg/dc.js](../mock/js/data/scenarios/mfg/dc.js) form | — | — | — | [DC-05.md](./dify/usecases/DC-05.md) | — | — |
| DC-06 | 輸出入・通関書類の確認 | DC/apply | 製造 | 試行版 | [mfg/dc.js](../mock/js/data/scenarios/mfg/dc.js) upload | — | — | — | [DC-06.md](./dify/usecases/DC-06.md) | — | — |
| DC-07 | サプライヤー契約書ドラフト支援 | DC/apply | 製造 | 試行版 | [mfg/dc.js](../mock/js/data/scenarios/mfg/dc.js) form | — | — | — | [DC-07.md](./dify/usecases/DC-07.md) | — | — |
| DC-08 | 報告レビュー（提出前チェック／受領後の論点整理） | DC/report | 製造・金融・IT | 試行版 | [mfg/dc.js](../mock/js/data/scenarios/mfg/dc.js) form | [fin/dc.js](../mock/js/data/scenarios/fin/dc.js) form | — | — | [DC-08.md](./dify/usecases/DC-08.md) | — | — |
| LG-01 | 日中翻訳（社内の言い方に揃える） | LG/trans | 製造 | 提供中 | [mfg/lg.js](../mock/js/data/scenarios/mfg/lg.js) form | — | — | [LG-01-ja-zh-translation.yml](../dify/apps/LG-01-ja-zh-translation.yml) | [LG-01.md](./dify/usecases/LG-01.md) | — | [4 件](../dify/tests/LG-01.json) |
| LG-02 | 社内用語・呼称の統一（用語集） | LG/trans | 製造 | 試行版 | [mfg/lg.js](../mock/js/data/scenarios/mfg/lg.js) upload | — | — | — | [LG-02.md](./dify/usecases/LG-02.md) | — | — |
| LG-03 | 現地スタッフとの認識合わせ（手順の中国語書き下し） | LG/align | 製造 | 試行版 | [mfg/lg.js](../mock/js/data/scenarios/mfg/lg.js) form | — | — | — | [LG-03.md](./dify/usecases/LG-03.md) | — | — |
| LG-04 | ビジネスメール作成（日中往復） | LG/align | 製造 | 提供中 | [mfg/lg.js](../mock/js/data/scenarios/mfg/lg.js) form | — | — | [LG-04-business-email.yml](../dify/apps/LG-04-business-email.yml) | [LG-04.md](./dify/usecases/LG-04.md) | — | [4 件](../dify/tests/LG-04.json) |
| NM-01 | 見積り・原価計算 | NM/cost | 製造 | 構想 | [mfg/nm.js](../mock/js/data/scenarios/mfg/nm.js) form | — | — | — | [NM-01.md](./dify/usecases/NM-01.md) | — | — |
| NM-02 | 購買見積の比較 | NM/cost | 製造 | 試行版 | [mfg/nm.js](../mock/js/data/scenarios/mfg/nm.js) upload | — | — | — | [NM-02.md](./dify/usecases/NM-02.md) | — | — |
| NM-03 | 日報・実績の集計と要約 | NM/actual | 製造 | 提供中 | [mfg/nm.js](../mock/js/data/scenarios/mfg/nm.js) upload | — | — | [NM-03-daily-report-summary.yml](../dify/apps/NM-03-daily-report-summary.yml) | [NM-03.md](./dify/usecases/NM-03.md) | — | [4 件](../dify/tests/NM-03.json) |
| NM-04 | 在庫・納期の問い合わせ回答 | NM/actual | 製造 | 試行版 | [mfg/nm.js](../mock/js/data/scenarios/mfg/nm.js) lookup | — | — | — | [NM-04.md](./dify/usecases/NM-04.md) | — | — |
| NM-05 | データ分析アシスタント | NM/actual | 製造 | 試行版 | [mfg/nm.js](../mock/js/data/scenarios/mfg/nm.js) lookup | — | — | — | [NM-05.md](./dify/usecases/NM-05.md) | — | — |
| EN-01 | 仕様改訂の差分検出・取引先用語対応 | EN/spec | 製造 | 試行版 | [mfg/en.js](../mock/js/data/scenarios/mfg/en.js) diff | — | — | — | [EN-01.md](./dify/usecases/EN-01.md) | — | — |
| EN-02 | BOM逆引き | EN/bom | 製造 | 試行版 | [mfg/en.js](../mock/js/data/scenarios/mfg/en.js) lookup | — | — | — | [EN-02.md](./dify/usecases/EN-02.md) | — | — |
| EN-03 | 図面の類似検索 | EN/bom | 製造 | 構想 | [mfg/en.js](../mock/js/data/scenarios/mfg/en.js) upload | — | — | — | [EN-03.md](./dify/usecases/EN-03.md) | — | — |
| GN-01 | 経費精算チェック | GN/office | 製造 | 提供中 | [mfg/gn.js](../mock/js/data/scenarios/mfg/gn.js) upload | — | — | [GN-01-expense-check.yml](../dify/apps/GN-01-expense-check.yml) | [GN-01.md](./dify/usecases/GN-01.md) | [5 件](../dify/kb/GN-01/) | [4 件](../dify/tests/GN-01.json) |
| GN-02 | 請求書（発票）処理 | GN/office | 製造 | 提供中 | [mfg/gn.js](../mock/js/data/scenarios/mfg/gn.js) upload | — | — | [GN-02-invoice-fapiao.yml](../dify/apps/GN-02-invoice-fapiao.yml) | [GN-02.md](./dify/usecases/GN-02.md) | — | [4 件](../dify/tests/GN-02.json) |
| GN-03 | 受注・発注書の読み取りと登録支援 | GN/office | 製造 | 試行版 | [mfg/gn.js](../mock/js/data/scenarios/mfg/gn.js) upload | — | — | — | [GN-03.md](./dify/usecases/GN-03.md) | — | — |
| GN-04 | スケジュール調整 | GN/daily | 製造 | 試行版 | [mfg/gn.js](../mock/js/data/scenarios/mfg/gn.js) qa | — | — | — | [GN-04.md](./dify/usecases/GN-04.md) | — | — |
| GN-05 | 文書要約 | GN/daily | 製造 | 提供中 | [mfg/gn.js](../mock/js/data/scenarios/mfg/gn.js) upload | — | — | [GN-05-document-summary.yml](../dify/apps/GN-05-document-summary.yml) | [GN-05.md](./dify/usecases/GN-05.md) | — | [4 件](../dify/tests/GN-05.json) |
| GN-06 | 頼まれ事・放置業務の追跡 | GN/daily | 製造・金融・IT | 試行版 | [mfg/gn.js](../mock/js/data/scenarios/mfg/gn.js) form | [fin/gn.js](../mock/js/data/scenarios/fin/gn.js) form | — | — | [GN-06.md](./dify/usecases/GN-06.md) | — | — |
| GN-07 | 幹部来訪・出張のアテンド段取り | GN/daily | 製造・金融・IT | 構想 | [mfg/gn.js](../mock/js/data/scenarios/mfg/gn.js) form | [fin/gn.js](../mock/js/data/scenarios/fin/gn.js) form | — | — | [GN-07.md](./dify/usecases/GN-07.md) | — | — |
| GN-08 | 名刺の読み取りと項目抽出 | GN/daily | IT | 構想 | — | — | — | — | — | — | — |
| PT-01 | 取引先・サプライヤーの与信・リスク監視 | PT/data | 製造 | 試行版 | [mfg/pt.js](../mock/js/data/scenarios/mfg/pt.js) lookup | — | — | — | [PT-01.md](./dify/usecases/PT-01.md) | — | — |
| PT-02 | 業界・材料相場リサーチ（本社報告の外部根拠） | PT/data | 製造 | 試行版 | [mfg/pt.js](../mock/js/data/scenarios/mfg/pt.js) form | — | — | — | [PT-02.md](./dify/usecases/PT-02.md) | — | — |
| PT-03 | 業界誌・技術記事アーカイブの横断検索 | PT/data | 製造 | 試行版 | [mfg/pt.js](../mock/js/data/scenarios/mfg/pt.js) qa | — | — | — | [PT-03.md](./dify/usecases/PT-03.md) | — | — |
| PT-04 | 現地給与水準の照会と給与改定の妥当性確認 | PT/data | 製造 | 構想 | [mfg/pt.js](../mock/js/data/scenarios/mfg/pt.js) lookup | — | — | — | [PT-04.md](./dify/usecases/PT-04.md) | — | — |
| PT-05 | 現地技術者・管理職の採用支援（一次面談の要約・候補者サマリ） | PT/service | 製造 | 構想 | [mfg/pt.js](../mock/js/data/scenarios/mfg/pt.js) upload | — | — | — | [PT-05.md](./dify/usecases/PT-05.md) | — | — |
| PT-06 | 戦略購買の立案（集約・複数年・代替サプライヤー） | PT/service | 製造 | 構想 | [mfg/pt.js](../mock/js/data/scenarios/mfg/pt.js) upload | — | — | — | [PT-06.md](./dify/usecases/PT-06.md) | — | — |
| PT-07 | RFQ 起草と購買代行への引き継ぎ | PT/service | 製造 | 構想 | [mfg/pt.js](../mock/js/data/scenarios/mfg/pt.js) form | — | — | — | [PT-07.md](./dify/usecases/PT-07.md) | — | — |
| PT-08 | 研修プログラム化と実施代行・受講管理 | PT/service | 製造 | 構想 | [mfg/pt.js](../mock/js/data/scenarios/mfg/pt.js) form | — | — | — | [PT-08.md](./dify/usecases/PT-08.md) | — | — |
| KN-06 | 事務手続の照会 | KN/rule | 金融 | 試行版 | — | [fin/kn.js](../mock/js/data/scenarios/fin/kn.js) qa | — | — | [KN-06.md](./dify/usecases/KN-06.md) | — | — |
| KN-07 | 行内営業情報の検索（日誌・接触履歴） | KN/bizlog | 金融 | 構想 | — | [fin/kn.js](../mock/js/data/scenarios/fin/kn.js) qa | — | — | [KN-07.md](./dify/usecases/KN-07.md) | — | — |
| KN-08 | 当局通達・ガイドラインDB（照会・過去比較） | KN/rule | 金融 | 試行版 | — | [fin/kn.js](../mock/js/data/scenarios/fin/kn.js) diff | — | — | [KN-08.md](./dify/usecases/KN-08.md) | — | — |
| KN-09 | 取込文書の分類自動振り分け | KN/ops | IT | 構想 | — | — | — | — | — | — | — |
| KN-10 | 規程と現場運用の食い違い検出 | KN/ops | IT | 構想 | — | — | — | — | — | — | — |
| DC-09 | 議案・報告書・提案書のドラフト作成（テンプレート選択） | DC/report | 金融 | 試行版 | — | [fin/dc.js](../mock/js/data/scenarios/fin/dc.js) form | — | — | [DC-09.md](./dify/usecases/DC-09.md) | — | — |
| DC-10 | 予実差の理由の書き起こし | DC/report | IT | 構想 | — | — | — | — | — | — | — |
| RS-01 | 企業・業界ニュースの自動収集と配信 | RS/news | 金融 | 試行版 | — | [fin/rs.js](../mock/js/data/scenarios/fin/rs.js) form | — | — | [RS-01.md](./dify/usecases/RS-01.md) | — | — |
| RS-02 | セクター・発行体のモニタリング | RS/news | 金融 | 構想 | — | [fin/rs.js](../mock/js/data/scenarios/fin/rs.js) form | — | — | [RS-02.md](./dify/usecases/RS-02.md) | — | — |
| RS-03 | 顧客IR・決算の収集と日本語要約・比較 | RS/disc | 金融 | 試行版 | — | [fin/rs.js](../mock/js/data/scenarios/fin/rs.js) upload | — | — | [RS-03.md](./dify/usecases/RS-03.md) | — | — |
| RS-04 | 市場・企業データの照会（金融情報端末・契約データベース） | RS/data | 金融 | 試行版 | — | [fin/rs.js](../mock/js/data/scenarios/fin/rs.js) lookup | — | — | [RS-04.md](./dify/usecases/RS-04.md) | — | — |
| RS-05 | ダッシュボード出力からの気づき分析 | RS/data | 金融 | 構想 | — | [fin/rs.js](../mock/js/data/scenarios/fin/rs.js) upload | — | — | [RS-05.md](./dify/usecases/RS-05.md) | — | — |
| CV-01 | 提案・ピッチ資料の作成（候補先選定・比較企業分析） | CV/pitch | 金融 | 構想 | — | [fin/cv.js](../mock/js/data/scenarios/fin/cv.js) form | — | — | [CV-01.md](./dify/usecases/CV-01.md) | — | — |
| CV-02 | 面談前ブリーフの作成 | CV/pitch | 金融 | 構想 | — | [fin/cv.js](../mock/js/data/scenarios/fin/cv.js) form | — | — | [CV-02.md](./dify/usecases/CV-02.md) | — | — |
| CV-03 | 審査コメントのドラフト作成 | CV/credit | 金融 | 構想 | — | [fin/cv.js](../mock/js/data/scenarios/fin/cv.js) upload | — | — | [CV-03.md](./dify/usecases/CV-03.md) | — | — |
| CV-04 | KYCスクリーニングとエスカレーション整理 | CV/kyc | 金融 | 構想 | — | [fin/cv.js](../mock/js/data/scenarios/fin/cv.js) upload | — | — | [CV-04.md](./dify/usecases/CV-04.md) | — | — |
| FA-01 | GL勘定のリコンシリエーション | FA/close | 金融 | 構想 | — | [fin/fa.js](../mock/js/data/scenarios/fin/fa.js) upload | — | — | [FA-01.md](./dify/usecases/FA-01.md) | — | — |
| FA-02 | 月次クローズの実行と報告 | FA/close | 金融 | 構想 | — | [fin/fa.js](../mock/js/data/scenarios/fin/fa.js) form | — | — | [FA-02.md](./dify/usecases/FA-02.md) | — | — |
| FA-03 | 財務諸表のレビュー（整合性・監査対応） | FA/close | 金融 | 構想 | — | [fin/fa.js](../mock/js/data/scenarios/fin/fa.js) upload | — | — | [FA-03.md](./dify/usecases/FA-03.md) | — | — |
| FA-04 | 財務モデルの作成と決算反映 | FA/model | 金融 | 構想 | — | [fin/fa.js](../mock/js/data/scenarios/fin/fa.js) upload | — | — | [FA-04.md](./dify/usecases/FA-04.md) | — | — |
| FA-05 | バリュエーションのレビュー | FA/model | 金融 | 構想 | — | [fin/fa.js](../mock/js/data/scenarios/fin/fa.js) upload | — | — | [FA-05.md](./dify/usecases/FA-05.md) | — | — |
| PO-01 | アンケート・インタビュー収集 | PO/collect | 製造・金融・IT | 構想 | [mfg/po.js](../mock/js/data/scenarios/mfg/po.js) qa | [fin/po.js](../mock/js/data/scenarios/fin/po.js) qa | — | — | [PO-01.md](./dify/usecases/PO-01.md) | — | — |
| PO-02 | アイデアの募集・蓄積・投票集計 | PO/collect | 製造・金融・IT | 構想 | [mfg/po.js](../mock/js/data/scenarios/mfg/po.js) form | [fin/po.js](../mock/js/data/scenarios/fin/po.js) form | — | — | [PO-02.md](./dify/usecases/PO-02.md) | — | — |
| PO-03 | 小テスト・コンプライアンスチェックの実施と集計 | PO/collect | 製造・金融・IT | 構想 | [mfg/po.js](../mock/js/data/scenarios/mfg/po.js) form | [fin/po.js](../mock/js/data/scenarios/fin/po.js) form | — | — | [PO-03.md](./dify/usecases/PO-03.md) | — | — |
| PO-04 | 稼働の集計とコスト配分の提案 | PO/mgmt | 製造・金融・IT | 構想 | [mfg/po.js](../mock/js/data/scenarios/mfg/po.js) upload | [fin/po.js](../mock/js/data/scenarios/fin/po.js) upload | — | — | [PO-04.md](./dify/usecases/PO-04.md) | — | — |
| PO-05 | 年休の取り残し検知と取得計画 | PO/staff | IT | 構想 | — | — | — | — | — | — | — |
| PO-06 | 残業の偏りからの要員リスク検知 | PO/staff | IT | 構想 | — | — | — | — | — | — | — |
| PO-07 | AI利用実績からの削減時間の見積 | PO/collect | IT | 構想 | — | — | — | — | — | — | — |
| EG-01 | 上流工程の仕様支援（読解・質問回答・エラー対処） | EG/sysspec | 製造・金融・IT | 構想 | [mfg/eg.js](../mock/js/data/scenarios/mfg/eg.js) qa | [fin/eg.js](../mock/js/data/scenarios/fin/eg.js) qa | — | — | [EG-01.md](./dify/usecases/EG-01.md) | — | — |
| SL-01 | 引合の受注確度推定 | SL/pipe | IT | 構想 | — | — | — | — | — | — | — |
| SL-02 | 失注理由の蓄積と傾向分析 | SL/pipe | IT | 構想 | — | — | — | — | — | — | — |
| SL-03 | 過去提案の横断検索と再利用 | SL/prop | IT | 構想 | — | — | — | — | — | — | — |
| 集計 | — | — | — | — | ①製造 49 | ①金融 29 | ①IT 0 | ②12 | ③67 | ④KB 4 | ④テスト 12 |
