# 顧客版カタログ 33 サービス × Dify 実現性 突合

- 対象：`docs/handoff/2026-09-06-customer-catalog-data.md` §3-4（SVCS 33 件）と `docs/handoff/2026-09-06-demo-scenarios.md` §3-3（テンプレート割当）・§6（台本）
- 前提環境：**Dify 1.15.x（DSL 0.6.0）**、セルフホスト想定、中国工場（蘇州）＋日本本社。モデルは中国側 SiliconFlow を既定
- 突合の材料：公式プラグイン（[dify-official-plugins](https://github.com/langgenius/dify-official-plugins)）、Dify リリースノート、コミュニティ DSL（`templates/`）、事例記事。詳細は `plugins-and-references.md`
- **承認済み設計書は書き換えていない。** 設計を変えるべき点は §0-3 に PM 判断待ちとして列挙

---

## 0. 結論（PM はここだけ読めばよい）

### 0-1. 実現性集計

| 評価 | 件数 | サービス id |
|---|---|---|
| **◎** 標準機能＋公式プラグインで今日作れる | **11** | kn1 kn2 dc1 dc2 dc3 dc4 lg1 lg3 lg4 nm3 gn5 |
| **○** データ整備（ナレッジ化・台帳・ルール）をすれば作れる | **16** | kn3 kn4 kn5 qa1 qa2 qa3 qa4 dc5 dc6 dc7 lg2 nm2 en1 gn1 gn2 gn3 |
| **△** 部分的。HTTP 連携・外部処理が本体の一部 | **6** | nm1 nm4 nm5 en2 en3 gn4 |
| **×** Dify 単体では困難 | **0** | — |

- **× は無い**。「Dify で作れない」サービスはカタログに無い。ただし △ 6 件は「Dify は対話・生成の皮で、本体は ERP/DB/カレンダー/原価テーブル/CAD 検索」という位置づけを顧客に説明する必要がある
- テンプレート別：qa 5 件＝◎ 2／○ 2／△ 1（gn4）、upload 15 件＝◎ 5／○ 9／△ 1（en3）、form 8 件＝◎ 4／○ 3／△ 1（nm1）、diff 2 件＝○ 2、**lookup 3 件＝全部 △**（照会先システムの API が無いと動かない）

### 0-2. 台本（§6）との整合

**修正推奨 5 件**（台本の文言をこの構成では返せない／入力できない）：

| id | 箇所 | 理由 | 推奨修正 |
|---|---|---|---|
| kn2 | Q2「同じアラームが今月何回出た？」 | マニュアル KB には稼働・アラーム履歴が無い。MES/設備ログの KB 投入か API 照会が要る | 「再発時の連絡先と、部品交換の手配方法は？」に差し替え（st1 の範囲に収まる）。履歴照会を残すなら「データ前提：アラーム履歴 CSV を月次で KB へ」を detail に注記 |
| lg2 | Q0 入力ファイル `議事録_2025-06〜08.zip` | Document Extractor／dify_extractor は **zip 非対応**（対応形式に無い） | `議事録_2025-06〜08（84 件・複数選択）` のように file-list で表現。または「SharePoint フォルダを指定」 |
| qa2 | Q2「この内容で ECR を起票して」 | 起票＝変更管理システムへの書き込み。HTTP 連携が無いと「ドラフト出力」まで | 「この内容で ECR 申請書のドラフトを作って」 |
| lg1 | Q2「『技術連絡書』を用語集に登録して」 | 用語集 KB への書き込みは Knowledge API 経由（`http-request`）で可能だが初期構成には無い | 「用語集に登録する形式（ja/zh/en・定義・出典）で出して」。書き込みを残すなら detail に「用語集 API 連携」を前提として注記 |
| gn3 | Q2「登録できる 4 行を登録して」 | 基幹システムへの登録＝HTTP 連携。無ければ CSV 出力まで | 「登録できる 4 行を基幹システム取込用の CSV で出して」 |

**データ前提の明記推奨 12 件**（台本は妥当だが、答えるためのデータがナレッジ／照会 API に無いと返せない。detail か実装前提書に「必要なデータ」を明示する）：

| id | 台本の箇所 | 必要なデータ |
|---|---|---|
| kn3 | 版ズレ指摘 | 就業規則の ja 版・zh 版を**版日付メタデータ付き**で KB へ |
| kn4 | 「担当部署へ引き継ぎ・履歴分類」 | 引き継ぎ先（WeCom 群／メール）と履歴の保存先（简道云・Excel 365・DB）を決める |
| qa3 | 「過去 12 か月で 3 件目」 | クレーム台帳（KB か DB） |
| dc1 | 「前月比は 7 月報告の値を参照」 | 前月報告を KB へ（または入力欄に前月値） |
| dc5 | 「円換算も併記」「承認ルート B」 | 社内為替レート・承認ルート規程（KB か Code の定数） |
| dc6 | 「手冊の輸出残量が 700 個」 | 加工貿易手冊台帳（Excel か API）。書類間整合だけなら不要 |
| dc7 | 「他のサプライヤーとはどう結んでいる」 | 過去契約 KB |
| nm2 | 「タングステン高騰から +5.4% が妥当」 | 材料市況（入力欄か Web 検索ツール） |
| en1 | 「現行工程の実力値 18〜24 µm」「何%が外れる」 | 工程能力（SPC）データ。無ければ Q1 を「影響のある社内文書は？」に |
| gn1 | 「年 2 回目に到達」「毎月同じ人が繰り返している」 | 精算履歴 DB |
| gn3 | 「本社の過去メールで同じ書き方をしていた？」 | メール履歴の KB（Outlook 連携か定期エクスポート） |
| gn4 | 「8 名の空き状況」「会議室を押さえて」 | 両拠点のカレンダー基盤（M365 なら `tools/outlook`。WeCom/DingTalk 予定表は公式プラグイン無し → HTTP） |

（nm4・en2・nm5 の lookup 3 件は「テンプレートそのものが照会 API 前提」なので個別には挙げない。§3 参照）

### 0-3. 成熟度（st）の異議と PM 判断待ち

**異議 3 件（変更を推奨）**

| id | 現在 → 提案 | 理由 |
|---|---|---|
| **nm5** データ分析アシスタント | st1 → **st2** | 台本（直近 6 か月×ライン×残業×不良率×昼夜）は **DB/DWH 接続と Text-to-SQL（スキーマ整備）が前提**。Excel をアップロードして集計するだけなら st1 だが、その姿は nm3 と重なる。「提供中」と書くと顧客の期待値（自然言語で何でも集計）と実態が乖離する |
| **gn4** スケジュール調整 | st1 → **st2** | **両拠点のカレンダー連携（M365 Graph 権限、中国側の予定表基盤）が前提**で、Dify 側は Agent＋`tools/outlook` の薄い層。連携が無いと「候補を 3 つ提案」も空き状況を見ずに答えることになる |
| **lg2** 用語揺れ検出 | st1 → **st2** | 84 文書＋3,120 行の**横断バッチ処理**（iteration・トークンコスト・同一物判定の精度検証）と用語集 KB の整備が要る。1 文書内の揺れ検出なら st1 |

変更すると内訳は **st1 = 12 / st2 = 18 / st3 = 3**（現在 15/15/3）。

**参考意見 4 件（変えなくてもよい）**

| id | 現在 → 案 | 理由 |
|---|---|---|
| qa2 4M 変更影響予測 | st3 →（st2 でも可） | 技術的には「ECR 履歴＋不具合記録の RAG → 類似変更の要約」で ○。st3 は「予測」という言葉と履歴データ蓄積の壁によるもの。**「構想」枚数を 3 件維持するなら現状どおり** |
| dc3 教育資料作成 | st2 →（st1 でも可） | アップロード文書だけで動き、KB 不要。st2 の根拠「作業標準書の整備」は他の st1（dc4 等）と同程度 |
| gn1 経費精算チェック | st1 →（st2 でも可） | 規程ルールのコード化と精算履歴参照が前提。**単票チェック（1 申請＋1 発票）に絞れば st1 のまま**で成立 |
| gn2 発票処理 | st1 →（st2 でも可） | 三点照合は発注・入庫データの取り込み、仕訳候補は勘定科目マスタ、発票真偽は税務 API が前提。**OCR＋抽出だけなら st1** |

**PM 判断待ち（推奨つき）**

| # | 論点 | 選択肢 | **推奨** |
|---|---|---|---|
| F-1 | 成熟度 3 件（nm5 gn4 lg2）の変更 | (a) 変更する（設計書 A の改訂版を architect が追記し、`regress` で「成熟度」差分 3 行が出るのを reviewer が照合）／(b) 変えない | **(a)**。カタログは顧客への約束。「提供中」の 3 件が初回デモで動かないリスクを避ける |
| F-2 | 台本修正 5 件（kn2 lg2 qa2 lg1 gn3） | (a) 設計書 B の改訂版で修正（B-2 実装前）／(b) 実装後に S レーンで文言修正 | **(a)**。B-2 の `SCENARIOS` 実装前なら差分が最小 |
| F-3 | 「データ前提」の見せ方 | (a) モックには出さず実装フェーズの前提条件書（本ディレクトリ）に置く／(b) detail 画面に「必要なデータ」欄を追加（M/L レーン・T キー追加） | **(a)**。モックの目的（見せ方の比較）から外れる。顧客説明資料には本書 §0-2 の表を転記 |
| F-4 | モデル方針 | (a) 中国拠点は SiliconFlow 中国版（`api.siliconflow.cn`）、日本語品質が要る dc1/lg4/kn3/gn5 は Qwen3-235B／DeepSeek-V3.x を評価して決める／(b) 全部 Azure OpenAI（日本）で統一／(c) オンプレ Qwen（越境ゼロ） | **(a)**。ただし**データが中国インフラに流れる点は顧客法務の確認事項**。(c) は kn3 kn4 gn1（人事・経費）で選択肢 |
| F-5 | 権限（ACL） | (a) 全社公開文書のみ KB 化＋部門帯で KB 分割（kn3 kn4 は HR 帯）／(b) External Knowledge API で自前 ACL 実装 | **(a)** で開始。Dify のメタデータフィルタは「タグ」であり企業 ACL をそのまま表現できない |
| F-6 | 参照資産の取り込み範囲 | (a) ライセンス明記（MIT/Apache）の 8 本のみ保存、dsl-skill examples と dify-for-dsl は URL のみ／(b) 全部保存 | **(a)**。本書のとおり実施済み |
| F-7 | 実装基盤 | (a) セルフホスト（Trigger・WeCom Bot・Langfuse・越境制御）／(b) Cloud | **(a)**。Cloud は Console API が壊れやすい（PM 前提）。Trigger の Cloud 可否も未確認 |
| F-8 | shamspias/awesome-dify-agents の扱い | — | PM 前提のリストにあるが **DSL 本体が無い**（README のみ）。参照先から外す |

`CLAUDE.md` への影響：**なし**（本書はドキュメントのみ。load-bearing に触れない）。F-1 を採ると設計書 A §5-3 の st 表と `tools/regress.baseline.json` の更新が発生する（implementer 作業・reviewer 照合）。

---

## 1. 前提と凡例

### 1-1. Dify 側の事実（PM 提示。URL は実在確認）

| 事実 | 根拠 |
|---|---|
| 顧客環境 DSL `0.6.0` ≒ Dify 1.15.x。1.16.x は `0.7.0`（Agent v2 / Agent App は 0.7.0 専用） | [dsl-skill README](https://github.com/yzmw123/dify-workflow-dsl-skill)、[1.16.0 release](https://github.com/langgenius/dify/releases/tag/1.16.0)。GitHub タグ列に 1.15.0 / 1.16.0 / 1.16.1 / 1.17.0 / 2.0.0-beta を確認 |
| Trigger（Schedule / Webhook / SaaS イベント）は 1.10.0〜 | [1.10.0 release](https://github.com/langgenius/dify/releases/tag/1.10.0)「A trigger is a type of Start node…」 |
| Knowledge Pipeline（Data Source プラグイン、Q&A チャンク、PDF 画像抽出）は 1.9.0〜 | [1.9.0 release](https://github.com/langgenius/dify/releases/tag/1.9.0) |
| ナレッジのメタデータフィルタは 1.1.0〜 | [1.1.0 release](https://github.com/langgenius/dify/releases/tag/1.1.0) |
| マルチモーダル検索（画像⇄テキスト、jina-clip / Vertex / Bedrock 埋め込み）は 1.11.0〜 | [1.11.0 release](https://github.com/langgenius/dify/releases/tag/1.11.0) |
| Human-in-the-loop（一時停止フォームに選択・ファイル）は 1.15.0 で拡張 | [1.15.0 release](https://github.com/langgenius/dify/releases/tag/1.15.0) |
| 公式プラグイン：`tools/` 150 超・`models/` 70 超・`datasources/` 17・`triggers/` 17・`extensions/` 7（wecom_bot 含む） | `dify-official-plugins` ディレクトリ数（2026-09-06） |

### 1-2. 凡例

- **アプリ種別**：Chatflow（`advanced-chat`：多輪・`sys.query`・ファイル添付）／Workflow（`workflow`：1 回実行・構造化出力）／Agent（Agent ノード＋`cot_agent` 戦略。0.6.0 では Workflow/Chatflow 内の Agent ノード）
- **定番パターン**：翻訳／要約／文書QA(RAG)／レポート生成／分類・振り分け／データ照会／差分比較。顧客に「これは Dify の定番です」と言える対応
- **モデル**：既定＝SiliconFlow（`models/siliconflow`）の Qwen3-235B-A22B-Instruct または DeepSeek-V3.x。埋め込み `bge-m3`、リランク `bge-reranker-v2-m3`（いずれも同プラグインに定義あり）。**日本語品質**が効く箇所は行内に明記
- **テンプレ**：設計書 B §3-3 の割当（qa / upload / form / diff / lookup）
- **参照**：`templates/NN` は本ディレクトリの保存 DSL。事例 URL は `plugins-and-references.md` §11

---

## 2. 突合表（33 行）

| id | サービス | テンプレ | 定番パターン | アプリ種別 | 実現性 | st 設計→意見 | 台本 | 主なプラグイン／ノード | 参照 |
|---|---|---|---|---|---|---|---|---|---|
| kn1 | 技術ナレッジQA | qa | 文書QA(RAG) | Chatflow | **◎** | 1 ✓ | ✓ | knowledge-retrieval（引用 ON）・bge-m3・dify_extractor | T03・aismiley |
| kn2 | 設備マニュアル検索 | qa | 文書QA(RAG) | Chatflow | **◎** | 1 ✓ | **修正**（Q2） | 同上＋MinerU/PaddleOCR（スキャン）・wecom_bot | T03・T08 |
| kn3 | 社内規程・就業規則QA | qa | 文書QA(RAG)＋差分比較 | Chatflow | **○** | 1 ✓ | 前提 | KB×2（ja/zh・版メタデータ）・LLM 突合 | T03・T04 |
| kn4 | 労務・総務ヘルプデスク | qa | 文書QA＋分類・振り分け | Chatflow | **○** | 2 ✓ | 前提 | question-classifier・qa_chunk・wecom_bot・wecom/email・简道云 | T03・dsl-skill 05/08 |
| kn5 | 当局通達の影響分析 | upload | 要約＋文書QA＋レポート生成 | Workflow | **○** | 2 ✓ | ✓ | MinerU・knowledge-retrieval（規程 KB）・Schedule＋firecrawl/rsshub（任意） | T02・T08 |
| qa1 | 8D 作成 | upload | 文書QA＋レポート生成 | Workflow | **○** | 2 ✓ | ✓ | document-extractor・MinerU・knowledge-retrieval（不具合台帳）・Code（数値判定） | T07・T08・該当事例なし |
| qa2 | 4M 変更影響予測 | diff | 文書QA＋データ照会 | Workflow | **○** | 3 →（2 可） | **修正**（Q2） | LLM 構造化・knowledge-retrieval（ECR/不具合 KB、メタデータ）・http-request（起票、任意） | T03 |
| qa3 | クレーム一次回答・分類 | form | 分類・振り分け＋レポート生成 | Workflow | **○** | 2 ✓ | 前提 | parameter-extractor・knowledge-retrieval（台帳）・if-else→wecom/email・outlook_trigger（任意） | T05・dsl-skill 05 |
| qa4 | 工程監査 対応資料 | upload | 文書QA＋分類 | Workflow | **○** | 2 ✓ | ✓ | document-extractor・iteration×knowledge-retrieval（管理文書 KB、メタデータ）・Code 集計 | T07・T08 |
| dc1 | 本社報告資料 | form | レポート生成（翻訳込み） | Workflow | **◎** | 1 ✓ | 前提 | LLM（**日本語品質**）・knowledge-retrieval（前月報告、任意） | T01・difyhub 要約 |
| dc2 | 議事録・次回論点 | upload | 要約 | Workflow | **◎** | 1 ✓ | ✓ | document-extractor・Vision LLM（Qwen2.5-VL）・STT（SenseVoice / funasr）（音声時） | dify-for-dsl 52・火山引擎記事 |
| dc3 | 教育・OJT 資料 | upload | レポート生成 | Workflow | **◎** | 2 →（1 可） | ✓ | 抽出→LLM×4 分岐・slidespeak（pptx、任意） | T07 |
| dc4 | 安全衛生・5S 中国語化 | upload | 翻訳 | Workflow | **◎** | 1 ✓ | ✓ | document-extractor・LLM×2 | T01 |
| dc5 | 稟議・申請書 | form | レポート生成＋分類（ルート判定） | Workflow | **○** | 2 ✓ | 前提 | Code（金額ルート）・knowledge-retrieval（規程・書式）・human-input（承認、任意） | T05・dsl-skill 08 |
| dc6 | 輸出入・通関書類 | upload | 差分比較＋データ照会 | Workflow | **○** | 2 ✓ | 前提 | document-extractor・MinerU・LLM 抽出→Code 照合・HS コード KB・手冊台帳（Excel/API） | T07・T08・該当事例なし |
| dc7 | サプライヤー契約ドラフト | form | レポート生成＋差分比較 | Workflow | **○** | 2 ✓ | 前提 | knowledge-retrieval（標準条項・過去契約）・LLM×3 | T02・dify-for-dsl 合同审查 |
| lg1 | 日中翻訳（社内用語） | form | 翻訳 | Workflow | **◎** | 1 ✓ | **修正**（Q2） | knowledge-retrieval（用語集）・LLM 2 段・baidu_translate（任意）・Knowledge API（登録） | **T01**・T04 |
| lg2 | 用語揺れ検出 | upload | 分類＋差分比較（用語抽出） | Workflow | **○** | 1 → **2** | **修正**（Q0 zip） | file-list→iteration×LLM 抽出→Code 集計→knowledge-retrieval（用語集） | T04 |
| lg3 | 手順の中国語書き下し | form | 翻訳＋レポート生成 | Workflow | **◎** | 2 ✓ | ✓ | LLM・knowledge-retrieval（手順書、任意） | T01 |
| lg4 | ビジネスメール | form | レポート生成（翻訳） | Workflow | **◎** | 1 ✓ | ✓ | LLM×2（**日本語敬語品質**） | T01 |
| nm1 | 見積・原価計算 | form | データ照会＋レポート生成 | Workflow | **△** | 3 ✓ | ✓ | Code（原価テーブル積み上げ）・knowledge-retrieval（類似見積）・LLM | 該当事例なし |
| nm2 | 購買見積比較 | upload | データ照会（正規化） | Workflow | **○** | 2 ✓ | 前提 | MinerU/document-extractor・LLM 抽出→Code 正規化・前回価格 KB | T07 |
| nm3 | 日報・実績集計 | upload | 要約＋データ照会 | Workflow | **◎** | 1 ✓ | ✓ | document-extractor・Code 集計・LLM（**日本語**）・Schedule＋wecom（配信、任意） | **T07**・dsl-skill 03 |
| nm4 | 在庫・納期照会 | lookup | データ照会 | Chatflow | **△** | 2 ✓ | 前提（API） | parameter-extractor・**http-request（ERP/WMS）**・LLM | **T06**・知乎 ERP 事例 |
| nm5 | データ分析アシスタント | lookup | データ照会＋可視化 | Workflow | **△** | 1 → **2** | 前提（DB） | LLM（SQL）・http-request/DB ツール・Code（相関）・echarts | **T06**・T07・Awesome 数据分析 |
| en1 | 仕様改訂の差分検出 | diff | 差分比較＋翻訳（用語） | Workflow | **○** | 2 ✓ | 前提 | MinerU×2・Code（difflib）・LLM 影響判定・knowledge-retrieval（用語対応・社内文書一覧） | T04・該当事例なし |
| en2 | BOM 逆引き | lookup | データ照会 | Workflow | **△** | 2 ✓ | 前提（API） | **http-request（ERP/MES トレース）**・Code 展開・LLM | T06 |
| en3 | 図面の類似検索 | upload | 検索（マルチモーダル RAG） | Workflow | **△** | 3 ✓ | ✓（注記済） | PaddleOCR-VL/MinerU/SoMark・Vision LLM 特徴抽出・KB（特徴テキスト or マルチモーダル埋め込み） | T08・53AI 1.11 記事 |
| gn1 | 経費精算チェック | upload | データ照会＋分類（照合） | Workflow | **○** | 1 →（2 可） | 前提 | **PaddleOCR**（発票）・iteration・Code 照合・knowledge-retrieval（規程）・Excel 365（出力） | T07・T08・百度記事 |
| gn2 | 請求書（発票）処理 | upload | データ照会（三点照合） | Workflow | **○** | 1 →（2 可） | ✓ | PaddleOCR・Code 三点照合・LLM 仕訳・Code CSV 出力 | T07・dify-for-dsl 61 |
| gn3 | 受注・発注書 読み取り | upload | データ照会（抽出） | Workflow | **○** | 2 ✓ | **修正**（Q2） | document-extractor・LLM 構造化・Code（品番マスタ照合）・http-request（基幹、任意） | T07 |
| gn4 | スケジュール調整 | qa | データ照会（予定表） | Agent（Chatflow 内 Agent ノード） | **△** | 1 → **2** | 前提（カレンダー） | Agent（cot_agent FC）・**tools/outlook**／google_calendar・祝日 KB・LLM 招集メール | 該当事例なし |
| gn5 | 文書要約 | upload | 要約 | Workflow | **◎** | 1 ✓ | ✓ | MinerU/document-extractor・Code 分割→iteration→LLM（**日本語**） | **T02**・difyhub 要約 |

台本列：✓＝1 往復目を含め台本どおり返せる／**修正**＝台本文言の修正推奨（§0-2）／前提＝データ前提の明記推奨（§0-2）。

---

## 3. サービス別の詳細

各項目：ノード構成／プラグイン・モデル／データ前提／台本の整合／成熟度／参照／リスク。

<details><summary><b>kn1 技術ナレッジQA</b> — ◎ / Chatflow / 文書QA(RAG)</summary>

- **ノード**：start → knowledge-retrieval（技術報告 KB＋不具合記録 KB、ハイブリッド検索＋リランク、top-k 5〜8）→ llm（context ON、「根拠の文書番号を必ず引用」）→ answer。Chatflow の引用表示（Citation）で根拠箇所が出る
- **プラグイン**：`dify_extractor`（KB 投入。PDF はページ単位レコード）、スキャン PDF は `mineru`。データソースは SharePoint/OneDrive か `tencent_cos_storage`
- **モデル**：SiliconFlow Qwen3-235B / DeepSeek-V3.x。埋め込み `bge-m3`、リランク `bge-reranker-v2-m3`（zh→ja クロスリンガル）。精度不足なら「質問を相手言語へ翻訳して再検索」ノードを追加
- **データ前提**：技術報告（TR-xxxx）・トラブル対応記録（NC-xxxx）を文書番号・拠点・ライン・年のメタデータ付きで KB 化
- **台本**：Q0（TR 3 件から条件）＝引用付き回答で可。Q1（折損事例）＝NC 記録が KB にあれば可。Q2（条件表）＝生成のみ。**整合 ✓**
- **成熟度**：st1 に同意
- **参照**：`templates/03`（分類→複数 KB）。事例：[aismiley 13 選](https://aismiley.co.jp/ai_news/dify-usage-example-13/) の「過去トラブル DB から原因候補・対応履歴を提示」（製造業）
- **リスク**：ACL（技術報告は全社公開か？ 部門帯で KB 分割）。クロスリンガル検索の精度検証が要る
</details>

<details><summary><b>kn2 設備マニュアル・取扱説明書の検索</b> — ◎ / Chatflow / 文書QA(RAG)</summary>

- **ノード**：kn1 と同型。KB＝設備別マニュアル（型式メタデータ）＋アラームコード表（Q&A チャンクが向く）
- **プラグイン**：`mineru` または `paddleocr`（PP-StructureV3）でスキャン PDF の表（アラームコード表）を Markdown 化。ページ番号は抽出結果に残す（「7-12 ページ」引用）。現場入口は `extensions/wecom_bot`
- **モデル**：kn1 と同じ。回答言語は入力言語に合わせる（`detectLang` 相当をプロンプトで）
- **データ前提**：マニュアル PDF（ja）。アラームコード表は表→Q&A 形式が理想
- **台本**：Q0（E-47 の意味と復旧手順、ページ引用）＝可。Q1（原点復帰ボタン）＝可。**Q2「同じアラームが今月何回出た？」＝マニュアル KB では答えられない**（設備稼働記録・アラームログが要る）→ **修正推奨**（§0-2）
- **成熟度**：st1 に同意（Q2 を外せば）
- **参照**：`templates/03`、`templates/08`（MinerU）
- **リスク**：メーカーマニュアルの二次利用（著作権・NDA）。ページ引用の精度
</details>

<details><summary><b>kn3 社内規程・就業規則QA</b> — ○ / Chatflow / 文書QA(RAG)＋差分比較</summary>

- **ノード**：start → knowledge-retrieval（ja 版 KB）＋ knowledge-retrieval（zh 版 KB）→ llm（両版の該当条文を並べ、版日付が異なれば「版ズレ」を明示）→ answer。または 1 KB でメタデータ `lang` / `version_date` をフィルタ
- **プラグイン**：`dify_extractor`。版比較は LLM の判断（`templates/04` の言語別チェックと同じ発想）
- **モデル**：日本語・中国語の条文読解 → Qwen3-235B / DeepSeek-V3.x
- **データ前提**：規程の ja/zh 両版を**版日付・条番号のメタデータ付き**で KB 化。条単位のチャンク分割
- **台本**：Q0（第 23 条 3 項の引用と版ズレ指摘）＝両版が KB にあれば可。Q1・Q2＝可。**データ前提の明記推奨**
- **成熟度**：st1 に同意（版ズレは「併記」から始め、判定精度は運用で上げる）
- **参照**：`templates/03`、`templates/04`
- **リスク**：**HR データ（就業規則は全社公開だが、個人の休暇残などに踏み込まない設計）**。ACL は「規程 KB は全社公開」で回避
</details>

<details><summary><b>kn4 労務・総務の社内問い合わせ対応</b> — ○ / Chatflow / 文書QA＋分類・振り分け</summary>

- **ノード**：start → question-classifier（入社／保険／休暇／証明書／IT／その他）→ knowledge-retrieval（FAQ KB：`qa_chunk`）→ llm → answer。「回答不能」分岐 → tool（`wecom` 群 bot か `email` で担当部署へ）＋ 記録（`jiandaoyun`／`microsoft_excel_365`／`http-request` で台帳へ）
- **プラグイン**：`extensions/wecom_bot`（スマホから中国語で質問）、`tools/wecom`、`tools/email`、`tools/jiandaoyun`（履歴）。履歴分類は Dify 会話ログ＋Langfuse でも可
- **モデル**：Qwen3 系（中国語主体）
- **データ前提**：社内 FAQ（Q&A 形式）・申請手順・窓口一覧。引き継ぎ先と履歴保存先の決定
- **台本**：Q0（証明書発行の手順）＝FAQ にあれば可。Q1（入学用の追加書類）＝FAQ 次第。Q2（期限）＝所要日数から一般回答可。**引き継ぎ・履歴の前提明記**
- **成熟度**：st2 に同意
- **参照**：`templates/03`、dsl-skill `05-question-classifier` / `08-human-approval`（URL のみ）、[Dify on WeChat（legacy docs）](https://legacy-docs.dify.ai/zh-hans/learn-more/use-cases/dify-on-wechat)
- **リスク**：個人情報（身分証番号）を会話に入れさせない注意書き。WeCom Bot は公開 URL が要る
</details>

<details><summary><b>kn5 当局通達の影響分析・マニュアル反映</b> — ○ / Workflow / 要約＋文書QA＋レポート生成</summary>

- **ノード**：start（file：通達 PDF、file：マニュアル docx）→ mineru（通達。スキャンなら OCR）＋ document-extractor（マニュアル）→ llm（要旨・対象業務・期限・必要対応を JSON）→ knowledge-retrieval（社内規程 KB。アップロードしたマニュアル本文でも可）→ llm（該当箇所の特定＋改訂ドラフト）→ template-transform → end。定期監視は Schedule トリガー＋`firecrawl_datasource`／`rsshub_trigger`（任意）
- **プラグイン**：`mineru`、`dify_extractor`、（任意）`firecrawl_datasource`・`rsshub_trigger`
- **モデル**：中国語長文の読解 → DeepSeek-V3.x / Qwen3-235B。本社向け要約は日本語品質
- **データ前提**：社内規程・マニュアルの KB 化（該当箇所特定のため）。通達はその場のアップロードで足りる
- **台本**：Q0（12 ページから影響 3 件・期限）＝可。Q1（§5.3 改訂案）＝マニュアルがアップロード済みなので可。Q2（5 行要約）＝可。**整合 ✓**
- **成熟度**：st2 に同意
- **参照**：`templates/02`（長文分割）、`templates/08`
- **リスク**：**法的判断の誤り**（期限・対象の読み違え）→ 必ず原文ページ引用＋人のレビュー。海外クロールサービスから中国当局サイトへの到達性
</details>

<details><summary><b>qa1 不具合原因分析・8D 作成</b> — ○ / Workflow / 文書QA＋レポート生成</summary>

- **ノード**：start（file-list）→ document-extractor（xlsx/csv）＋ mineru/paddleocr（検査記録 PDF）→ code（塗装条件 CSV の基準外判定：3.8% < 4.0%）→ knowledge-retrieval（不具合台帳・過去 8D の KB）→ llm（類似不具合の照合＋なぜなぜ）→ llm（8D D1〜D5 を JSON）→ template-transform（ja）＋ llm（zh 版）→ end
- **プラグイン**：`dify_extractor`、`mineru`／`paddleocr`、`json_process`（任意）
- **モデル**：Qwen3-235B / DeepSeek-V3.x。日本語 8D は本社提出用なので日本語品質確認
- **データ前提**：**不具合台帳（NC 番号・現象・原因・対策）と過去 8D を KB 化**。塗装条件の基準値（4.0〜5.0%）を KB か Code の定数に
- **台本**：Q0（類似 2 件、原因候補、D1〜D5）＝可。Q1（D5 の妥当性）＝可。Q2（ja/zh 出力）＝可。**整合 ✓**
- **成熟度**：st2 に同意
- **参照**：`templates/07`（Excel 入口）、`templates/08`。**Dify で 8D を作る公開 DSL・記事は見つからず（該当なし）**
- **リスク**：数値の読み違え（表の Markdown 化の崩れ）。8D は顧客提出物 → 人の承認を挟む（human-input）
</details>

<details><summary><b>qa2 変更点影響予測（4M）</b> — ○ / Workflow / 文書QA＋データ照会</summary>

- **ノード**：start（before / after のテキスト）→ llm（変更を 4M 種別・対象部品・パラメータへ構造化）→ knowledge-retrieval（ECR 履歴 KB＋不具合 KB。部品番号メタデータでフィルタ）→ knowledge-retrieval（顧客承認ルール：PPAP 提出レベル表）→ llm（影響 5 項目の表＋承認要否）→ end。「起票」は `http-request` で変更管理システムへ（任意）
- **プラグイン**：なし（標準ノード）。起票連携時 `http-request`／`jiandaoyun`
- **データ前提**：**ECR 履歴と不具合記録が部品番号で紐づいた形で蓄積**されていること。PPAP 提出レベル表
- **台本**：Q0（過去 ECR 2 件と影響 5 項目、承認必須）＝可。Q1（切替時期）＝KB のリードタイム（6 週間）から可。**Q2「ECR を起票して」＝書き込み連携が要る → 修正推奨**
- **成熟度**：st3 に同意（「予測」の言葉と履歴蓄積の壁）。技術的には st2 相当なので、構想枚数の維持が不要なら st2 でも可（§0-3 参考）
- **参照**：`templates/03`。事例：該当なし
- **リスク**：「予測」の過信。過去に無い変更には答えられないことを UI で明示
</details>

<details><summary><b>qa3 顧客クレーム一次回答・分類</b> — ○ / Workflow / 分類・振り分け＋レポート生成</summary>

- **ノード**：start（顧客・部品・原文・回答言語）→ parameter-extractor（要約・重要度・区分・担当部門）→ knowledge-retrieval（クレーム台帳 KB → 同種の傾向）→ llm（一次回答文 zh）→ if-else（重大）→ tool（`wecom` 群通知／`email`）→ end。受付自動化は `outlook_trigger`／Webhook トリガー
- **プラグイン**：`wecom`、`email`、`outlook_trigger`（任意）、`jiandaoyun`（台帳書き込み、任意）
- **モデル**：商務中文と日本語報告の両方 → Qwen3-235B。日本語の本社報告は品質確認
- **データ前提**：クレーム台帳（KB か DB）。部品→担当部門の対応表
- **台本**：Q0（重大判定・担当・一次回答・「12 か月で 3 件目」）＝台帳があれば可。Q1（8D 提出日の約束可否）＝8D リードタイム規程が KB にあれば可。Q2（本社報告）＝可。**台帳の前提明記**
- **成熟度**：st2 に同意（傾向集計を外せば st1 相当）
- **参照**：`templates/05`（form UX）、dsl-skill `05-question-classifier`（URL）
- **リスク**：顧客宛の文面を無確認送信しない（送信は人）。顧客名・部品番号の外部モデル送信は法務確認
</details>

<details><summary><b>qa4 完成車メーカー工程監査 対応資料</b> — ○ / Workflow / 文書QA＋分類</summary>

- **ノード**：start（xlsx チェックリスト、pdf 前回指摘）→ document-extractor → code（86 行に分解）→ iteration（並列）[ knowledge-retrieval（管理文書 KB：文書番号・種別メタデータ）→ llm（証拠あり／不足・該当文書）] → code（区分別集計）→ llm（不足項目の解説・優先度）→ end
- **プラグイン**：`dify_extractor`（Excel は行レコード）、`mineru`（前回指摘 PDF）、`sharepoint_datasource`（文書管理が SharePoint なら）
- **データ前提**：**社内管理文書（手順書・記録様式・SPC 等）の体系的な KB 化とメタデータ**。ECR 顧客承認記録（メール）は KB 外 → 「不足」と出るのは正しい挙動
- **台本**：Q0（79/7、前回指摘 3 件の是正確認）＝可。Q1（担当・期限の割り振り）＝組織表が KB にあれば可。Q2（提出資料一覧）＝可。**整合 ✓**
- **成熟度**：st2 に同意
- **参照**：`templates/07`、`templates/08`
- **リスク**：86 回の検索＋LLM で数分・コスト。取り漏れ（recall）は人が最終確認
</details>

<details><summary><b>dc1 日本本社への報告資料作成</b> — ◎ / Workflow / レポート生成</summary>

- **ノード**：start（対象月・実績（zh 貼り付け）・トピックス・出力言語）→ llm（中国語実績の読み取り＋本社フォーマット 4 章の日本語ドラフト）→ end。前月比は knowledge-retrieval（前月報告 KB）か入力欄（任意）
- **プラグイン**：なし
- **モデル**：**日本語の経営会議向け文体**が要る → Qwen3-235B / DeepSeek-V3.x を評価。不足なら本社側で Azure OpenAI 等（F-4）
- **データ前提**：本社フォーマット（プロンプト内）。前月報告（前月比を出すなら）
- **台本**：Q0（4 章ドラフト、年間影響額試算）＝可。「前月比は 7 月報告を参照」は前月報告が要る → **前提明記**。Q1・Q2＝可
- **成熟度**：st1 に同意
- **参照**：`templates/01`（多段 LLM）、difyhub `basic-text-summarizer`
- **リスク**：数字の転記ミス → 「数字は入力値をそのまま使う」をプロンプトで固定し、計算は Code に
</details>

<details><summary><b>dc2 議事録作成と次回論点整理</b> — ◎ / Workflow / 要約</summary>

- **ノード**：start（txt 文字起こし、jpg ホワイトボード）→ document-extractor（txt）＋ llm（Vision：Qwen2.5-VL でホワイトボードを文字化）→ llm（決定・担当・期限・未決を構造化、発言者不明は「要確認」）→ llm（次回論点）→ llm（zh 版）→ end。音声から始めるなら speech2text（SiliconFlow `sense-voice-small` か自前 `funasr`。日中混在に対応）
- **プラグイン**：`models/siliconflow`（VL・STT）、`models/funasr`（音声を外部に出さない構成）
- **モデル**：Qwen3-235B（日中混在テキスト）
- **データ前提**：なし（その場の入力のみ）
- **台本**：Q0（決定 3・ToDo 4・未決 2・論点 4）＝可。Q1（誰が確認すると言ったか）＝文字起こしに発言者があれば可、無ければ「要確認」で整合。Q2（zh 版）＝可。**整合 ✓**
- **成熟度**：st1 に同意
- **参照**：dify-for-dsl 52「三步实现音视频转文字会议纪要」（URL）、[火山引擎記事](https://developer.volcengine.com/articles/7535837708368183334)
- **リスク**：会議音声の外部送信（SaaS STT）→ 自前 FunASR で回避可
</details>

<details><summary><b>dc3 教育・OJT 資料作成</b> — ◎ / Workflow / レポート生成</summary>

- **ノード**：start（pdf/xlsx/docx）→ 抽出（document-extractor／mineru）→ llm（不具合 17 件から新人向け 3 件を選定）→ 並列 llm×4（スライド構成 zh／確認テスト zh／OJT チェックリスト／監督者向け ja）→ template-transform → end。pptx が要るなら `slidespeak`
- **プラグイン**：`dify_extractor`、`slidespeak`（任意）
- **モデル**：Qwen3-235B（中国語主）＋日本語副
- **データ前提**：なし（アップロードのみ）
- **台本**：Q0・Q1・Q2 すべて生成で可。**整合 ✓**
- **成熟度**：st2 → 参考として st1 でも成立（KB 不要）。§0-3 参考
- **参照**：`templates/07`
- **リスク**：スライドは「構成案」までが Dify の範囲。画像付き資料は人が作る
</details>

<details><summary><b>dc4 安全衛生・5S 掲示物・改善提案の中国語化</b> — ◎ / Workflow / 翻訳</summary>

- **ノード**：start（docx ルール、xlsx 改善提案）→ document-extractor → llm（掲示に向く 3 テーマを選び、1 行 15 字以内の中国語掲示文＋図解見出し）→ llm（改善提案 3 件を本社様式の日本語に整形）→ end
- **プラグイン**：なし（`baidu_translate` で 1 段目を機械翻訳にしてトークン節約も可）
- **モデル**：Qwen3 系。日本語整形は本社提出用 → 品質確認
- **台本**：Q0・Q1・Q2＝可。**整合 ✓**
- **成熟度**：st1 に同意
- **参照**：`templates/01`
- **リスク**：掲示物の最終レイアウトは人（Dify は文言まで）
</details>

<details><summary><b>dc5 稟議・申請書の作成と記載漏れ検出</b> — ○ / Workflow / レポート生成＋分類</summary>

- **ノード**：start（件名・金額・目的・見積）→ code（金額基準で承認ルート判定：>RMB 1,000,000 → B）→ knowledge-retrieval（稟議規程・書式・必須項目一覧）→ llm（5 章ドラフト＋記載漏れ・添付漏れ）→ llm（本社向け ja 版、円換算は Code）→ end。承認フロー化するなら human-input（1.15 で選択・添付対応）
- **プラグイン**：なし。為替は `http-request`（社内レート API）か固定値
- **データ前提**：承認ルート規程・稟議書式・必須項目・社内為替レート
- **台本**：Q0（5 章、ルート B、漏れ 3 件、回収 11.7 年の助言）＝可。Q1（据付時の生産影響の書き方）＝可。**Q2「円換算も併記」＝レートの前提明記**
- **成熟度**：st2 に同意
- **参照**：`templates/05`、dsl-skill `08-human-approval`（URL）
- **リスク**：投資回収計算は Code で（LLM に計算させない）
</details>

<details><summary><b>dc6 輸出入・通関書類の確認</b> — ○ / Workflow / 差分比較＋データ照会</summary>

- **ノード**：start（xlsx INV、xlsx PL、pdf 契約）→ document-extractor×2 ＋ mineru（契約）→ llm×3（品名・数量・原産地・単価・HS コード等を JSON 抽出）→ code（3 書類＋手冊登録名の 8 項目照合）→ llm（判定理由と修正案、通関業者向けメール）→ end。手冊残量は Excel 台帳（`microsoft_excel_365`）か API（`http-request`）
- **プラグイン**：`dify_extractor`、`mineru`、`regex`（HS コード）、`microsoft_excel_365`（任意）
- **データ前提**：手冊登録名・HS コードの正（KB）。**加工貿易手冊の残量台帳**（Q0 の「残量 700 個」を出すなら必須）
- **台本**：Q0（品名不一致の検出）＝可。「手冊残量が足りない」＝**台帳の前提明記**。Q1（手冊増量の手続き）＝規程 KB があれば可。Q2（修正版インボイス＋メール）＝Excel 出力は Code か Excel 365 で可
- **成熟度**：st2 に同意
- **参照**：`templates/07`、`templates/08`。事例：該当なし
- **リスク**：通関判断の誤りの影響が大きい → 「差し戻されやすい点の指摘」に留め、最終判断は人／通関業者
</details>

<details><summary><b>dc7 サプライヤー契約書ドラフト支援</b> — ○ / Workflow / レポート生成＋差分比較</summary>

- **ノード**：start（類型・相手・条件・相手方案文）→ knowledge-retrieval（社内標準条項 KB、過去契約 KB）→ llm（12 条構成の中国語ドラフト）→ llm（日本語対訳）→ llm（相手方案文との相違点＋法務レビュー依頼のポイント）→ end
- **プラグイン**：なし
- **モデル**：法律文の中国語・日本語 → Qwen3-235B / DeepSeek-V3.x。用語の正確性は人（法務）がレビュー
- **データ前提**：**社内標準条項（類型別）**。過去契約（Q1 の「他社とはどう結んでいる」に必要）
- **台本**：Q0（12 条・対訳・相違 3 件）＝可。**Q1＝過去契約 KB の前提明記**。Q2（法務宛メール）＝可
- **成熟度**：st2 に同意
- **参照**：`templates/02`（長文）、dify-for-dsl「通用合同审查助手」（URL）、[AI Native 契約書リスクチェック](https://www.ai-native.jp/dify/workflows/contract-review)（本文未取得）
- **リスク**：契約文の外部モデル送信 → 法務確認。desc に「最終判断は法務レビュー前提」と既に明記されている
</details>

<details><summary><b>lg1 日中翻訳（社内の言い方に揃える）</b> — ◎ / Workflow / 翻訳</summary>

- **ノード**：start（方向・用途・原文）→ knowledge-retrieval（用語集 KB＋過去対訳）→ llm（用語集を context に翻訳）→ llm（用語チェック：別訳候補と根拠の併記、未登録語の抽出）→ end。登録は `http-request`（Knowledge API で用語集 KB に追記）
- **プラグイン**：（任意）`baidu_translate`／`deepl` を 1 段目に（`Awesome` の「DuckDuckGo翻译+LLM二次翻译」方式）
- **モデル**：Qwen3-235B（日中双方向）
- **データ前提**：用語集（ja/zh/en・定義・避ける訳語）の KB。過去対訳
- **台本**：Q0（用語集 v3.4 準拠訳・候補併記・登録候補）＝可。Q1（口語版）＝可。**Q2「用語集に登録して」＝Knowledge API 連携が要る → 修正推奨**
- **成熟度**：st1 に同意
- **参照**：**`templates/01`**（翻訳→レビュー→改善）、`templates/04`
- **リスク**：用語集の版管理は Dify 外（Excel/简道云）に正を置く
</details>

<details><summary><b>lg2 社内用語・呼称の統一（用語集）</b> — ○ / Workflow / 分類＋差分比較</summary>

- **ノード**：start（file-list：議事録・チャットログ・作業標準書一覧）→ iteration（並列）[ document-extractor → llm（部品名・工程名・略語の候補を JSON 抽出）] → code（出現数集計・正規化）→ knowledge-retrieval（用語集 KB）→ llm（同一物の判定・標準呼称案・根拠）→ end
- **プラグイン**：`dify_extractor`。**zip は非対応**
- **モデル**：Qwen3-235B。大量文書 → コスト見積が要る
- **データ前提**：用語集 KB。文書は都度アップロード（zip ではなく複数選択）
- **台本**：**Q0 の入力 `議事録_2025-06〜08.zip` は Document Extractor で読めない → 修正推奨**。Q1・Q2＝可
- **成熟度**：**st1 → st2 を提案**（横断バッチ処理と判定精度の検証、用語集整備が前提）
- **参照**：`templates/04`
- **リスク**：3,120 行のチャットログの個人情報。同一物判定の誤り → 人の承認を挟む
</details>

<details><summary><b>lg3 現地スタッフとの認識合わせ（手順の中国語書き下し）</b> — ◎ / Workflow / 翻訳＋レポート生成</summary>

- **ノード**：start（相手・指示・背景）→ knowledge-retrieval（手順書・復旧手順 KB。任意）→ llm（番号付き中国語指示・確認点・よくある誤解・理解確認 3 問）→ end
- **プラグイン**：なし
- **モデル**：Qwen3-235B（口語日本語 → 現場中国語）
- **データ前提**：なし。KB があれば「40℃ の基準を補完」のような補強が可能
- **台本**：Q0（5 項目の書き下し、KB 補完）＝可。Q1（勝手に足していいのか → 選択肢提示）＝可。Q2（A4 1 枚）＝Markdown まで（PDF 化は人か Code）。**整合 ✓**
- **成熟度**：st2 に同意（KB 補完を含めるなら）。生成だけなら st1 相当
- **参照**：`templates/01`
- **リスク**：LLM が指示に無い数値を補うことの是非 → 台本どおり「補った箇所を明示」をプロンプトで固定
</details>

<details><summary><b>lg4 ビジネスメール作成（日中往復）</b> — ◎ / Workflow / レポート生成</summary>

- **ノード**：start（受信メール・趣旨・関係・返信言語）→ llm（受信メールの日本語要約）→ llm（商務中文の返信案＋文面のポイント）→ end
- **モデル**：**日本語敬語**と商務中文の両方 → Qwen3-235B / DeepSeek-V3.x を評価。本社 CC 用日本語は品質確認
- **台本**：Q0・Q1・Q2＝可。**整合 ✓**
- **成熟度**：st1 に同意
- **参照**：`templates/01`
- **リスク**：顧客名・数量の外部送信 → 法務確認（F-4）
</details>

<details><summary><b>nm1 見積り・原価計算</b> — △ / Workflow / データ照会＋レポート生成</summary>

- **ノード**：start（図面番号・材質・数量・特記）→ knowledge-retrieval（類似品の見積・原価テーブル）→ **code（材料費・加工費・金型償却・物流費の積み上げ、感度計算）** → llm（見積書ドラフト＋類似品比較＋気づき）→ end
- **プラグイン**：`e2b`（複雑計算）か Dify Code ノード
- **データ前提**：**原価テーブル（材料単価・工賃・償却ルール）が構造化**されていること。工程（加工時間）の見積は人か CAM
- **評価理由**：計算自体は Code で決定的に出せるが、「図面・仕様から工程と時間を決める」判断が本体で Dify 外。LLM は説明と気づき（桁の乖離指摘）が担当 → **△**
- **台本**：Q0（積み上げ・USD 換算・桁の乖離の指摘）＝原価テーブル入力があれば可。Q1・Q2＝可。**整合 ✓**（構想としての台本として妥当）
- **成熟度**：st3 に同意
- **参照**：該当なし
- **リスク**：見積の誤りは商売に直結 → 「ドラフト・参考値」の明示
</details>

<details><summary><b>nm2 購買見積の比較</b> — ○ / Workflow / データ照会（正規化）</summary>

- **ノード**：start（pdf・xlsx・txt）→ mineru（PDF 見積）＋ document-extractor → llm×3（単価・MOQ・納期・支払・通貨・単位を JSON）→ code（RMB／本・税抜・年間数量に正規化、前回価格との差）→ knowledge-retrieval（前回発注価格、社内の値上げ妥当性ルール）→ llm（比較表・妥当性・交渉ポイント）→ end
- **プラグイン**：`mineru`、`dify_extractor`、`json_process`
- **データ前提**：前回発注価格。**材料市況（タングステン）は入力欄か Web 検索ツール** → 前提明記
- **台本**：Q0（正規化比較・+7.5% は +5.4% が妥当）＝市況入力があれば可。Q1・Q2＝可
- **成熟度**：st2 に同意
- **参照**：`templates/07`
- **リスク**：為替レートの日付。単位換算の誤り → Code で決定的に
</details>

<details><summary><b>nm3 日報・実績の集計と要約</b> — ◎ / Workflow / 要約＋データ照会</summary>

- **ノード**：start（xlsx×2、csv）→ document-extractor（Excel は行レコード）→ code（ライン別に生産数・不良率・稼働率を集計、異常値検出）→ llm（日本語週報＋異常値コメント）→ end。定期化：Schedule トリガー → `tencent_cos_storage`/SharePoint から取得 → `wecom` へ配信
- **プラグイン**：`dify_extractor`、`microsoft_excel_365`（出力）、`wecom`（配信）
- **モデル**：日本語週報 → Qwen3-235B / DeepSeek-V3.x
- **データ前提**：日報のテンプレートが**一定**であること（形式が揺れると Code 集計が壊れる → LLM 抽出に切替）
- **台本**：Q0（合計・異常値 2 つ）＝可。Q1（L3 の不良内訳）＝品質日報に明細があれば可。Q2（3 行）＝可。**整合 ✓**
- **成熟度**：st1 に同意
- **参照**：**`templates/07`**、dsl-skill `03-excel-markdown-analysis`（URL）
- **リスク**：Excel の結合セル・日中混在ヘッダ。計算は必ず Code
</details>

<details><summary><b>nm4 在庫・納期の問い合わせ回答</b> — △ / Chatflow / データ照会</summary>

- **ノード**：start（sys.query）→ parameter-extractor（品番・数量・希望日）→ **http-request（ERP/WMS API：引当可能在庫・仕掛・生産計画・入荷予定・保留）** → code（合算・前提条件の判定：船便締切・通い箱）→ llm（返信文＋前提条件）→ answer
- **プラグイン**：`http-request`（本体）。DB 直結なら `sqlite`／`snowflake`／`oracle_ai_db` 等（顧客 DB 製品による）。MySQL/PostgreSQL 汎用は公式に無い（コミュニティ `hjlarry/database` 等は未確認）
- **データ前提**：**ERP/WMS に照会 API があること**（無ければ薄い API を自作。`templates/06` の Flask 方式）。船便締切・通い箱ルールは KB
- **評価理由**：Dify は「質問理解＋回答文」の皮。照会 API が無いと成立しない → **△**
- **台本**：Q0（4,420 の内訳と前提 2 つ）＝API があれば可。Q1・Q2（5,000 個なら）＝可。**API 前提**
- **成熟度**：st2 に同意
- **参照**：**`templates/06`**、[知乎：Dify+MCP 予知保全（ERP 在庫照会）](https://zhuanlan.zhihu.com/p/1893970010654897869)
- **リスク**：在庫数の鮮度（照会時刻を回答に必ず入れる：台本の「08:30 時点」は良い例）
</details>

<details><summary><b>nm5 データ分析アシスタント</b> — △ / Workflow / データ照会＋可視化</summary>

- **ノード**：start（自然言語）→ llm（スキーマを与えて SQL 生成）→ http-request（自前 SQL 実行 API）または DB ツール → code（相関係数・昼夜比較などの統計）→ llm（示唆コメント）→ `echarts`（bar/line/pie）または LLM が ECharts JSON を生成 → end
- **プラグイン**：`echarts`／`chart`、`vanna`（SaaS Text-to-SQL。中国では非推奨）、DB ツール群
- **データ前提**：**生産・品質・残業・勤務帯が結合可能な DB/DWH**。Excel だけの工場では nm3 の延長（アップロード集計）になる
- **評価理由**：Text-to-SQL の精度はスキーマ整備・少数の定型クエリに依存。Dify は組み立てとして最適だが本体は DB → **△**
- **台本**：Q0（6 か月×ライン×残業×不良率×昼夜）＝DB 前提。Q1・Q2＝可。**DB 前提明記**
- **成熟度**：**st1 → st2 を提案**（§0-3）
- **参照**：**`templates/06`**、`templates/07`、`Awesome` の `数据分析.7z`・`chart_demo.yml`、[apconw/sanic-web](https://github.com/apconw/sanic-web)（未確認）
- **リスク**：LLM 生成 SQL の安全性（読み取り専用ユーザー、許可テーブルのみ。dsl-skill `database-tools.md` の SQL 安全チェック）
</details>

<details><summary><b>en1 仕様改訂の差分検出・取引先用語対応</b> — ○ / Workflow / 差分比較＋翻訳（用語）</summary>

- **ノード**：start（file 旧、file 新）→ mineru×2（42 ページ、表・図番を保持）→ code（章単位に分割し `difflib` で変更箇所抽出）→ llm（変更の意味づけ：管理項目・検査方法・記録様式への影響）→ knowledge-retrieval（K 社用語→社内呼称の対応表、社内文書一覧）→ llm（差分表＋対応文書）→ end
- **プラグイン**：`mineru`、`dify_extractor`
- **モデル**：中国語仕様書の読解 → Qwen3-235B / DeepSeek-V3.x
- **データ前提**：用語対応表 KB、社内文書一覧（対応文書列のため）。**工程能力データ（Q1 の「何%が外れる」）**
- **台本**：Q0（6 か所・影響・用語対応）＝可。**Q1「塗膜厚 20 µm、今の工程で何%が外れる？」＝SPC データが無いと答えられない → 前提明記（または Q1 を「改訂が必要な社内文書は？」に）**。Q2（起票リスト）＝可
- **成熟度**：st2 に同意
- **参照**：`templates/04`。Dify での文書 diff 事例：該当なし（一般 diff ツールのみ）
- **リスク**：PDF→Markdown の揺れが「差分」として誤検出される → 章単位・正規化してから比較
</details>

<details><summary><b>en2 BOM 逆引き</b> — △ / Workflow / データ照会</summary>

- **ノード**：start（材料ロット／部品番号／サプライヤー）→ regex（キー種別判定）→ **http-request（ERP/MES ロットトレース API：生産ロット→製品→上位 ASSY→出荷先・出荷日・在庫）** → code（展開・集計）→ llm（表＋すぐ動くべき 3 点）→ end
- **プラグイン**：`http-request`、`regex`、DB ツール（DWH 製品次第）
- **データ前提**：**BOM とロットトレースが ERP/MES に存在し API で引けること**。RAG（KB）には向かない（表の結合が要る）
- **評価理由**：nm4 と同じく照会 API が本体 → **△**
- **台本**：Q0（3 生産ロット・4,750 個・出荷先・在庫）＝API 前提。Q1（顧客への言い方）＝可。Q2（1.16〜1.21 は良品か）＝規格（t1.2 の許容差）が KB にあれば可
- **成熟度**：st2 に同意
- **参照**：`templates/06`。事例：該当なし
- **リスク**：ロット紐付けの欠落（現場の手書き）→ 「トレース不能」を明示する分岐
</details>

<details><summary><b>en3 図面の類似検索</b> — △ / Workflow / 検索（マルチモーダル RAG）</summary>

- **ノード**：start（pdf 図面）→ paddleocr（PaddleOCR-VL）／mineru／somark（表題欄・寸法・材質・注記のテキスト化）＋ llm（Vision：Qwen2.5-VL で形状・曲げ数・穴の特徴を JSON）→ knowledge-retrieval（過去図面 KB：特徴テキスト。または 1.11 のマルチモーダル埋め込みで画像⇄画像）→ llm（上位 3 件・一致要素・相違点・工程・原価・不具合履歴）→ end。過去 1,240 図面の特徴化は Knowledge Pipeline で一括
- **プラグイン**：`paddleocr`、`mineru`、`somark`（製造業図面を明示）、マルチモーダル埋め込みは `models/jina`（jina-clip）／Vertex／Bedrock（**SiliconFlow には無い**）
- **データ前提**：過去図面 PDF と、図面番号→工程・原価・不具合・金型保管場所の紐付け
- **評価理由**：「形状類似度 87%」は CAD 形状検索の領域。Dify で出せるのは**テキスト特徴と画像埋め込みの近似**。台本が「類似度は形状特徴の機械的な一致率」と注記しているのは適切 → **△**
- **台本**：Q0・Q1・Q2＝構想としての台本として整合（注記済み）
- **成熟度**：st3 に同意
- **参照**：`templates/08`、[Dify v1.11.0 多模态検索（53AI）](https://www.53ai.com/news/dify/2025122535862.html)
- **リスク**：図面の外部送信（海外埋め込み API）は NDA 上ほぼ不可 → 自前 VL モデル（Ollama Qwen2.5-VL）で特徴化
</details>

<details><summary><b>gn1 経費精算チェック</b> — ○ / Workflow / データ照会＋分類（照合）</summary>

- **ノード**：start（xlsx 精算一覧、pdf 発票 60 枚）→ document-extractor（一覧）＋ **paddleocr（発票：抬頭・税号・金額・日付。ページ範囲で分割）** → iteration[ llm（発票 JSON）] → code（申請と照合：金額一致・抬頭・上限・事前承認・社内レート換算）→ knowledge-retrieval（経費規程・出張規程）→ llm（検出事項の説明＋差し戻し文 zh）→ code（Excel/CSV 出力）→ end
- **プラグイン**：**`paddleocr`**（中国発票に強い）、`dify_extractor`、`microsoft_excel_365`／`jiandaoyun`（結果保存）、`email`（差し戻し送信）
- **モデル**：Qwen3 系（中国語）。OCR は PaddleOCR、判定は Code
- **データ前提**：規程ルールのコード化（上限額・事前承認基準）。**精算履歴 DB**（「年 2 回目」「毎月同じ人」）
- **台本**：Q0（49/11、差し戻し 3 件）＝可。「年 2 回目に到達」＝**履歴の前提明記**。Q1（差し戻し文）＝可。**Q2「毎月同じ人が繰り返している？」＝履歴 DB 前提**
- **成熟度**：st1 → 参考として st2 でも可（§0-3）。単票チェックに絞れば st1 維持
- **参照**：`templates/07`、`templates/08`、[百度智能云：Dify 票据识别](https://cloud.baidu.com/article/3690560)（本文未取得）、dify-for-dsl 61（発票批量→Excel）
- **リスク**：個人情報（氏名・身分証）。発票画像の外部 OCR 送信（PaddleOCR API は Baidu）→ 顧客法務
</details>

<details><summary><b>gn2 請求書（発票）処理</b> — ○ / Workflow / データ照会（三点照合）</summary>

- **ノード**：start（pdf 発票 40 枚、xlsx 発注、xlsx 入庫）→ paddleocr（発票 40 枚を分割・JSON）＋ document-extractor×2 → code（発票×発注×入庫の三点照合：数量差・発注なし・税率・税号）→ knowledge-retrieval（勘定科目マスタ・支払条件）→ llm（仕訳候補・支払期日・不一致の説明）→ code（会計システム取込 CSV）→ end。発票真偽確認は税務総局の照会（`http-request`、任意）
- **プラグイン**：`paddleocr`、`dify_extractor`、`json_process`
- **データ前提**：発注・入庫データ（Excel か API）、勘定科目マスタ、サプライヤー税号マスタ
- **台本**：Q0（36/4 と不一致内訳）＝可。Q1（返品記録はあるか）＝返品記録が入庫データにあれば可。Q2（CSV 出力）＝可。**整合 ✓**
- **成熟度**：st1 → 参考として st2 でも可（§0-3）。OCR＋抽出のみなら st1
- **参照**：`templates/07`、`templates/08`、dify-for-dsl 61、[博報堂 DY ONE：請求書処理の自動化](https://oneder.hakuhodody-one.co.jp/blog/dify-usecase-invoice-automation)
- **リスク**：金額判定は必ず Code。会計システム登録は人の承認後
</details>

<details><summary><b>gn3 受注・発注書の読み取りと登録支援</b> — ○ / Workflow / データ照会（抽出）</summary>

- **ノード**：start（xlsx 確定注文、pdf 内示、txt メール）→ document-extractor／mineru → llm（品番・数量・納期を JSON、日中混在対応）→ code（品番マスタ照合：存在しない品番の検出、前回受注との差分）→ llm（要確認事項）→ code（基幹取込 CSV）→ end。登録連携は `http-request`（任意）。受付自動化は `outlook_trigger`／Webhook
- **プラグイン**：`dify_extractor`、`mineru`、`outlook_trigger`（任意）
- **データ前提**：品番マスタ、受注履歴（前月同期比）。**過去メール KB**（Q1）
- **台本**：Q0（7 行、要確認 3 件）＝マスタと履歴があれば可。**Q1「本社の過去メールで同じ書き方をしていた？」＝メール履歴 KB の前提明記**。**Q2「登録して」＝基幹連携が無いと CSV まで → 修正推奨**
- **成熟度**：st2 に同意
- **参照**：`templates/07`
- **リスク**：内示と確定の混同 → 区分を必ず出力（台本どおり）
</details>

<details><summary><b>gn4 スケジュール調整</b> — △ / Agent（Chatflow 内 Agent ノード）/ データ照会（予定表）</summary>

- **ノード**：start（sys.query）→ agent（`cot_agent` Function Calling。ツール：`tools/outlook` list_events／create_event（日本本社 M365）、中国側も M365 なら同じ、WeCom/DingTalk 予定表なら `http-request` の自作ツール）→ knowledge-retrieval（両国の祝日・会議室一覧）→ llm（候補 3 つ＋日中 2 言語の招集メール）→ answer
- **プラグイン**：`tools/outlook`（メール・予定・下書き送信まで）、`google_calendar`／`feishu_calendar`（基盤次第）、`agent-strategies/cot_agent`。**WeCom・DingTalk の予定表プラグインは公式に無い**
- **データ前提**：**8 名の空き状況が取れるカレンダー権限**（Graph の delegated/application 権限。テナント管理者承認）。会議室はリソースカレンダー
- **評価理由**：Dify 側は薄く、本体はカレンダー基盤と権限 → **△**
- **台本**：Q0（8 名の空き・祝日・候補 3 つ）＝カレンダー連携前提。Q1（会議室確保・招集）＝create_event 可。Q2（田中部長の変更）＝再照会で可。**前提明記**
- **成熟度**：**st1 → st2 を提案**（§0-3）
- **参照**：該当なし（DSL・事例とも見つからず）
- **リスク**：他人の予定を読む権限＝プライバシー方針。両国祝日は毎年更新
</details>

<details><summary><b>gn5 文書要約</b> — ◎ / Workflow / 要約</summary>

- **ノード**：start（pdf、指示文）→ mineru／document-extractor（ページ番号を保持）→ code（長文を章単位に分割）→ iteration[ llm（章ごとの要点・当社関連箇所の抽出）] → llm（日本語 1 枚：要点・影響・期限・担当部署案・原文の重要箇所 p.xx）→ end
- **プラグイン**：`mineru`、`dify_extractor`
- **モデル**：中国語 38 ページの読解と日本語 1 枚 → Qwen3-235B / DeepSeek-V3.x（日本語品質確認）
- **データ前提**：なし。「当社への影響中心」の判断には社内の工程情報（塗装外注・接着工程）を KB か指示文で与える
- **台本**：Q0（1 枚要約・罰則 p.31）＝可。Q1（「小規模」の基準は原文のどこか）＝ページ保持で可。Q2（転送メール ja/zh）＝可。**整合 ✓**
- **成熟度**：st1 に同意
- **参照**：**`templates/02`**、difyhub `basic-text-summarizer`
- **リスク**：要約の脱落 → 章単位の中間要約を残す（iteration の出力を保存）
</details>

---

## 4. 横断リスクと対処（全サービス共通）

| リスク | 影響するサービス | 対処 |
|---|---|---|
| **権限（ACL）** — Dify のアクセス制御は KB 単位の公開範囲（自分／全員／一部メンバー）とメタデータフィルタ（v1.1.0〜）。企業の実 ACL（人×文書のグラフ）はそのまま表現できない | kn1 kn3 kn4 qa4 dc7（人事・契約・顧客別文書） | 全社公開文書のみ KB 化 → 部門帯で KB 分割（HR 帯・品質帯・購買帯）→ 必要なら External Knowledge API で自前 ACL（F-5）。Knowledge API キーはアカウント配下の全 KB に効く点に注意 |
| **データ所在・越境** — SiliconFlow（中国インフラ）、PaddleOCR API（Baidu）、MinerU API、海外 SaaS（firecrawl/vanna/e2b） | 全部。特に kn3 kn4 gn1（人事・経費）、dc7 qa3（契約・顧客）、en3（図面） | 中国側は中国版エンドポイントで完結させる／人事・図面は自前モデル（Ollama Qwen、自前 MinerU/FunASR）／日本本社側は別アプリで海外モデル。**顧客法務の確認事項として明示**（F-4） |
| **日本語品質** — 本社向け成果物 | dc1 lg4 kn3 gn5 nm3 qa1（8D 日本語版） | Qwen3-235B / DeepSeek-V3.x を評価セットで比較。不足なら本社側アプリを Azure OpenAI 等に |
| **クロスリンガル検索**（zh 質問 → ja 文書） | kn1 kn2 kn3 | `bge-m3`＋`bge-reranker-v2-m3`。不足時は質問翻訳ノードを追加 |
| **コスト** — iteration で数十〜数百回 LLM を呼ぶもの | qa4（86 項目）lg2（84 文書）gn1 gn2（40〜60 枚）en3（1,240 図面の初回特徴化） | 小型モデル（Qwen3-32B）で抽出、大型で統合。Langfuse でコスト監視 |
| **Cloud 制限** | Trigger・WeCom Bot（公開 URL）・Langfuse ホスト・`.env` 調整（`CODE_MAX_STRING_LENGTH`、sandbox 依存追加） | セルフホスト（F-7） |
| **書き込み系の期待値** — 「起票」「登録」「用語集に登録」 | qa2 lg1 gn3（＋kn4 の履歴、qa3 の台帳） | 初期は「ドラフト／CSV 出力」まで。書き込みは `http-request`／简道云／Excel 365 で第 2 段階（§0-2 の修正推奨） |
| **DSL バージョン** — 参照 DSL は 0.1.x〜0.4.0、dsl-skill 既定は 0.7.0 | 実装全般 | dsl-skill に `--target-version 0.6.0` を明示。import 後の export を正にする |

## 5. 「よくある Dify ユースケース」への対応（顧客説明用）

| 定番パターン | 該当サービス | 顧客への一言 |
|---|---|---|
| 翻訳 | lg1 dc4（lg3 lg4 dc1 の一部） | Dify の最初期からの定番。用語集を KB に置くのが社内仕様化のコツ |
| 要約 | dc2 gn5 kn5 nm3 | 長文は「分割→反復→統合」の型（`templates/02`） |
| 文書QA（RAG） | kn1 kn2 kn3 kn4 qa1 qa4 dc7 | ナレッジ機能そのもの。引用付き回答が標準 |
| レポート生成 | dc1 dc3 dc5 dc7 lg3 lg4 qa1 qa3 nm1 | フォーム入力→多段 LLM→テンプレート整形 |
| 分類・振り分け | kn4 qa3 dc5 lg2 qa4 | question-classifier／parameter-extractor＋通知ツール |
| データ照会 | nm4 nm5 en2 gn1 gn2 gn3 nm2 dc6 gn4 | Dify は「聞き方と答え方」、データは HTTP/DB/カレンダー連携（△ の理由） |
| 差分比較 | en1 qa2 dc6（dc7 kn3 の一部） | Code で機械的に差分→LLM で意味づけ、の 2 段 |
