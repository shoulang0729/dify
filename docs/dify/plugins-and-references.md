# Dify 実装で積極活用するプラグイン・事例・参照資料（目的別）

対象：顧客版カタログ 33 サービス（`docs/handoff/2026-09-06-customer-catalog-data.md` §3-4）を **Dify 1.15.x（DSL 0.6.0）** で実装するとき。
実在確認は [langgenius/dify-official-plugins](https://github.com/langgenius/dify-official-plugins)（`main`、2026-09-06）のディレクトリと `manifest.yaml` で行った。
`marketplace.dify.ai` / `docs.dify.ai` は本環境から到達不可のため、**マーケットプレイスの表示名ではなく GitHub ディレクトリ名**で書く。バージョンは manifest の値。

凡例：**対象 id** = どのサービスで使うか（太字＝主用途）。「未確認」= 検索結果で存在は確認したが本文を取得できなかったもの。

---

## 1. 文書抽出・OCR（upload 型 15 件の入口）

| 名称（ディレクトリ） | 版 | 何に使えるか | 対象 id | 注意点 |
|---|---|---|---|---|
| **Document Extractor ノード**（Dify 本体） | — | txt / md / pdf / docx / xlsx / csv 等を文字列化する組み込みノード。upload 型の第一選択 | **全 upload 型** | 表構造は Markdown 化される程度。スキャン PDF・複雑レイアウトは下記へ。zip は不可（lg2 の台本参照） |
| `tools/dify_extractor` | 0.1.0 | Knowledge Pipeline 用の公式抽出器。PDF/DOCX/PPTX/XLS(X)/MD/HTML/CSV/JSON/YAML/テキスト。`documents`（CSV/Excel は行、PDF はページ単位のレコード）と埋め込み画像を出す | **KB 投入全般**（kn1 kn2 kn3 kn5 qa4 dc7） | ページ単位レコード＝「7-12 ページ」のような引用に必要 |
| `tools/paddleocr` | 0.3.0 | PaddleOCR 公式 API。テキスト認識（PP-OCRv5/v6）、文書解析（PP-StructureV3）、大規模モデル文書解析（PaddleOCR-VL）。Dify のアップロード画像/PDF を直接渡せる。ページ範囲指定・DOCX 併出力 | **gn1 gn2**（発票 OCR）**en3**（図面の文字・表題欄）dc6（スキャン契約）qa1（検査記録） | Baidu AI Studio のトークンが要る（中国側で取得しやすい）。中国語帳票に強い |
| `tools/mineru` | 0.5.7 | MinerU。PDF/DOC/DOCX/PPT/PPTX/PNG/JPG → Markdown/JSON。表は HTML、数式は LaTeX、スキャン PDF は自動 OCR（84 言語）。**公式 API（mineru.net）と自前デプロイ**の両対応。`_assets/mineru_demo.yml` あり（`templates/08`） | **kn5 qa4 dc6 en1**（長文・複雑レイアウト PDF）gn5 | 自前デプロイなら越境なし。API 利用時はデータが MinerU 側に出る |
| `tools/unstructured` | 0.0.11 | Unstructured API で Markdown/JSON 化＋RAG 前処理 | 代替候補 | SaaS。中国からの到達性・データ所在を確認 |
| `tools/llama_parse` | 0.0.9 | LlamaParse | 代替候補 | 同上 |
| `tools/somark` | 0.1.4 | SoMark DocAI。README で **製造業（帳票・工業マニュアル・エンジニアリング図面）**を明示。私有デプロイは RTX 3090 1 枚から | **en3**（図面）kn2（設備マニュアル） | 中国系ベンダー。ライセンス・費用未確認 |
| `tools/general_chunk` / `tools/parent_child_chunk` / `tools/qa_chunk` | 0.0.13 | Knowledge Pipeline のチャンク処理（一般／親子／Q&A）。kn4 の FAQ は **Q&A チャンク**が向く | **kn4**（FAQ）kn1 kn2 kn3 | Knowledge Pipeline（v1.9.0〜）前提 |
| `tools/json_process` | 0.0.7 | jsonpath で JSON の抽出・挿入・置換・削除。LLM 出力 JSON の後処理 | qa1 gn1 gn2 gn3 nm2 | Code ノードでも可。ノーコードで済ませたいとき |
| `tools/regex` | 0.0.8 | 正規表現抽出（品番・ロット番号・HS コード） | en2 dc6 gn3 | — |

## 2. 検索・クロール（当局サイト・Web 情報）

| 名称 | 版 | 何に使えるか | 対象 id | 注意点 |
|---|---|---|---|---|
| `datasources/firecrawl_datasource` / `jina_datasource` / `tavily_datasource` | 0.2.13 / 0.0.10 / 0.1.10 | Knowledge Pipeline の Web クロール入口。当局（NFRA・税務・海関・蘇州市）の通達ページを定期取り込み | **kn5** gn5 | いずれも海外 SaaS。中国当局サイトへの到達性と、対象サイトの利用規約を確認。国内サイトは `http-request` で直接取得する方が確実な場合あり |
| `datasources/brightdata_datasource` | 0.1.10 | 反 bot 対策込みのスクレイプ | kn5（代替） | 同上 |
| `tools/searxng` | — | 自前ホストのメタ検索（`Awesome-Dify-Workflow` の「搜索大师」が使用） | kn5 nm2（市況） | 自前運用が要る |
| `tools/google` / `bing` / `duckduckgo` / `perplexity` | — | Web 検索 | nm2（市況の裏取り） | 中国本土からの到達性 |
| `triggers/rsshub_trigger` | 0.1.0 | RSS 更新をトリガに Workflow 起動 | **kn5**（通達の新着監視） | RSSHub の自前運用が要る |

## 3. 中国向け通知・チャット窓口（現場が触る入口）

| 名称 | 版 | 何に使えるか | 対象 id | 注意点 |
|---|---|---|---|---|
| **`extensions/wecom_bot`** | 0.0.8 | **企業微信（WeCom）の bot として Dify のチャットアプリを受信・応答**させる Extension。Token / EncodingAESKey を設定し、生成 URL を WeCom 側に登録 | **kn4**（スマホからの問い合わせ）**kn2**（夜勤の設備 QA）kn1 kn3 nm4 | Slack Bot と同型。WeCom 管理者権限が要る。Dify がインターネット到達可能な URL を持つ必要（セルフホスト時は要 公開エンドポイント） |
| `tools/wecom` | 0.0.10 | WeCom **群 bot**（Webhook）へメッセージ／ファイル送信 | **qa3**（重大クレームの即時エスカレーション）nm3（週報配信）kn5 gn4 | 送信のみ |
| `tools/dingtalk` | 0.0.9 | DingTalk 群 bot へ送信 | 同上（顧客が DingTalk の場合） | 送信のみ。予定表・文書の DingTalk API は公式プラグイン無し → `http-request` |
| `tools/feishu_*` / `lark_*` | 各 0.0.x | 飛書/Lark の文書・表・予定・メッセージ・タスク | 顧客が飛書利用なら gn4 dc2 に有用 | 本顧客は WeCom/DingTalk 想定のため優先度低 |
| `tools/email` | 0.0.16 | SMTP 送信（添付・CC・BCC・一括） | **qa3 gn1 lg4 dc6**（差し戻し・回答メール） | 顧客 SMTP |
| `tools/outlook` / `tools/teams` / `tools/gmail` | — | M365 メール・予定・Teams | **gn4**（日本本社側の予定）lg4 qa3 | M365 の Graph 権限（テナント管理者承認） |
| `triggers/outlook_trigger` / `gmail_trigger` | 1.0.1 / 0.1.1 | メール受信をトリガに Workflow 起動 | **qa3**（クレームメール自動受付）gn3（注文メール） | — |
| コミュニティ：[luolin-ai/Dify-Enterprise-WeChat-bot](https://github.com/luolin-ai/Dify-Enterprise-WeChat-bot) | — | WeCom クライアントに常駐して Dify API へ中継（Windows exe、★644、2025-03 更新） | kn4 の代替 | 公式 `wecom_bot` があるので基本は不要。私聊・群聊の両対応が要るときの参考 |
| 公式チュートリアル：[Dify を WeChat 生態に接続する（legacy docs）](https://legacy-docs.dify.ai/zh-hans/learn-more/use-cases/dify-on-wechat) | — | 企業微信アプリ／客服への接続手順 | kn4 | 検索結果で実在確認。本文未取得 |

## 4. モデル（中国工場前提）

| 名称 | 版 | 何に使えるか | 対象 id | 注意点 |
|---|---|---|---|---|
| **`models/siliconflow`** | 0.0.59 | SiliconFlow（硅基流动）。LLM／埋め込み／リランク／STT／TTS を 1 プロバイダで。`use_international_endpoint` 資格情報で **`api.siliconflow.cn`（既定）と `api.siliconflow.com`** を切替。LLM 定義ファイルに DeepSeek-V3.x/R1/V4、Qwen3/3.5/3.6（235B, 32B, VL）、GLM-4.5/4.6/5、Kimi-K2/K2.5、MiniMax-M2 等。埋め込み **`bge-m3` / `bge-m3-pro` / `qwen3-embedding-*`**、リランク **`bge-reranker-v2-m3`**、STT **`sense-voice-small`（FunAudioLLM）** | **全サービス**（中国拠点の既定プロバイダ） | 登録リージョンとエンドポイントを一致させる。**データが中国インフラに流れる**（顧客法務確認）。日本語品質が要る箇所（dc1 lg4 kn3 gn5）は Qwen3-235B / DeepSeek-V3.x で評価してから決める。公式手順：[docs.siliconflow.cn – Use SiliconCloud in Dify](https://docs.siliconflow.cn/en/usercases/use-siliconcloud-in-dify)（検索結果で実在確認・本文未取得） |
| `models/deepseek` / `tongyi`（DashScope）/ `zhipuai` / `moonshot` / `hunyuan` / `volcengine_maas`（火山方舟）/ `baichuan` / `minimax` / `stepfun` | 各 | 中国ベンダー直契約 | SiliconFlow の代替・冗長化 | 契約先が増える |
| `models/openai_api_compatible` | — | OpenAI 互換 API（自前 vLLM、社内ゲートウェイ）を登録 | 自前ホスト時 | — |
| `models/ollama` / `xinference` / `gpustack` / `localai` | — | オンプレ推論（Qwen 等）。**越境ゼロ**の構成 | kn3 kn4 gn1（人事・経費データ） | GPU 調達・運用 |
| `models/openrouter` / `azure_openai` / `bedrock` / `anthropic` / `openai` / `gemini` | — | 日本本社側（dc1 の日本語報告、lg4 の敬語）を海外モデルで作る選択肢 | dc1 lg4（HQ 側） | 中国本土からは到達不可前提。拠点で使い分けるならアプリを分ける |
| `models/funasr` | 0.1.2 | **自前 FunASR（SenseVoice）**を OpenAI 互換 API で。中国語・広東語・英語・**日本語**・韓国語 | **dc2**（日中混在の会議録音） | 音声を外部に出さない構成。GPU 推奨 |
| `models/jina` / Vertex / Bedrock のマルチモーダル埋め込み | — | 画像⇄テキスト検索（v1.11.0〜） | **en3**（図面類似） | SiliconFlow にはマルチモーダル埋め込み無し（2026-09-06 のディレクトリ確認）。海外 API 前提 |

**埋め込み方針（日中クロスリンガル）**：kn1 kn2 kn3 は「中国語で聞いて日本語文書を引く」が前提。`bge-m3`（多言語・8k トークン）＋ `bge-reranker-v2-m3` を SiliconFlow から使うのが最短。精度が足りなければ「質問を LLM で相手言語に翻訳してから検索」のノードを 1 つ足す。

## 5. データソース（Knowledge Pipeline の入口）

| 名称 | 版 | 対象 id | 注意点 |
|---|---|---|---|
| `datasources/sharepoint_datasource` / `onedrive` | 1.0.0 / 1.0.0 | **kn1 kn2 kn3 qa4 dc7**（日本本社が M365 なら文書は大半ここ） | Graph 権限 |
| `datasources/tencent_cos_storage` | 0.3.9 | 中国側ファイルサーバが騰訊雲 COS なら **kn1 kn2 nm3**（日報の定期投入） | — |
| `datasources/aws_s3_storage` / `azure_blob` / `google_cloud_storage` | 0.3.12 / 0.2.14 / 0.2.13 | 同上（クラウド別） | — |
| `datasources/confluence_datasource` / `notion_datasource` | 0.2.9 / 0.1.21 | 社内 Wiki が Confluence/Notion なら kn1 kn3 | — |
| `datasources/box_datasource` / `dropbox_datasource` / `github` / `gitlab_datasource` | 各 | 補助 | — |
| **無いもの** | — | **Outline**、**企業微信文書**、**DingTalk 文書**、**社内ファイルサーバ（SMB）** | `http-request` か、定期エクスポート → COS/S3 → 上記データソース、で代替。Zabbix/Datadog/PagerDuty/ServiceNow/Splunk も専用プラグイン無し（PM 前提どおり） |

## 6. データ照会・業務システム連携（lookup 型 3 件と「台帳」を持つサービス）

| 名称 | 版 | 何に使えるか | 対象 id | 注意点 |
|---|---|---|---|---|
| **HTTP リクエストノード**（Dify 本体） | — | ERP/MES/WMS の REST API を呼ぶ。GET/POST、ヘッダ・ボディに変数差し込み | **nm4 en2 nm5 dc6**（手冊台帳）qa2（ECR 起票）gn3（基幹登録） | 顧客システム側に API が無ければ **自前の薄い API（Flask 等）**を置く（`templates/06` と Awesome の `数据分析.7z` が同じ構成） |
| `tools/vanna` | 0.0.8 | Vanna.ai の Text-to-SQL（SaaS） | nm5 | DB 接続情報が SaaS に出る。中国では使いにくい |
| `tools/sqlite` / `snowflake` / `supabase` / `oracle_ai_db` / `nocodb` / `baserow` | 各 | DB 直接照会 | nm5 en2（DWH が該当製品なら） | MySQL/PostgreSQL の**公式**汎用プラグインは無い。コミュニティに `hjlarry/database`（sql_execute）、`spance/db_client_node`（PostgreSQL）が dsl-skill の `references/database-tools.md` に実例つきで載る（**本環境から未確認**。実装時にマーケットプレイスで確認） |
| **`tools/jiandaoyun`（简道云）** | 0.0.8 | 中国のノーコード DB。レコード作成・取得・更新・削除 | **kn4**（問い合わせ履歴）**qa3**（クレーム台帳）gn1（精算結果）lg2（用語集） | 顧客が導入していれば「台帳の書き込み先」に最適。未導入なら Excel 365 か DB |
| `tools/hap`（明道云 HAP） | 0.1.6 | 同上（ワークシート・ロール・ワークフロー起動まで） | 同上 | — |
| `tools/microsoft_excel_365` | 0.1.6 | Excel Online の読み書き（ワークシート検索・書込） | **nm3 gn1 gn2 gn3**（結果を Excel に出す）lg2（用語集が Excel） | M365 前提 |
| **Knowledge（Dataset）API** | — | 用語集・FAQ をアプリから追記する（lg1 の「用語集に登録して」、kn4 の FAQ 育成） | lg1 lg2 kn4 | API キーはアカウント配下の全 KB に効く（[Discussion #27667](https://github.com/langgenius/dify/discussions/27667)）。書き込みは Workflow 内の `http-request` から |
| **External Knowledge API** | — | 自前検索サーバを KB として接続。**企業 ACL を自前で実装**するときの出口 | kn3 kn4（人事情報）qa4（顧客別文書） | [docs（en）](https://docs.dify.ai/en/guides/knowledge-base/external-knowledge-api)／[legacy docs](https://legacy-docs.dify.ai/guides/knowledge-base/external-knowledge-api-documentation)（検索結果で実在確認・本文未取得）。検索のみ対応（KB 側の編集は不可） |

## 7. 可視化・出力・実行

| 名称 | 版 | 何に使えるか | 対象 id | 注意点 |
|---|---|---|---|---|
| `tools/echarts` | 0.0.7 | bar / line / pie の ECharts を返し、チャットに描画 | **nm5 nm3** | 3 種のみ。散布図（残業×不良の相関）は LLM に ECharts JSON を直接書かせる（`templates/06` の方式）か `chart` |
| `tools/chart` | 0.0.8 | 静止画の統計チャート | nm5 nm3 | — |
| `tools/e2b` | 0.0.7 | サンドボックスでコード実行・ファイル入出力 | nm1 nm5（相関係数・原価計算）gn2（CSV 生成） | SaaS。中国から使うなら Dify 本体の Code ノード（サンドボックス）で代替。pandas 等は `python-requirements.txt` で追加（Awesome README FAQ） |
| `tools/slidespeak` | 1.0.5 | pptx 生成 | **dc3**（教育スライド）dc1 | SaaS |
| **Code ノード**（Dify 本体） | — | Python/JS で照合・集計・差分（`difflib`）・正規化 | **dc6 gn1 gn2 en1 nm2 nm3 qa4** | 文字列長上限（`CODE_MAX_STRING_LENGTH`）は `.env` で拡張 |
| `tools/baidu_translate` / `deepl` / `google_translate` | 0.0.8 / 0.1.5 / — | 機械翻訳 1 段目 → LLM で社内用語に揃える 2 段構成（Awesome の「DuckDuckGo翻译+LLM二次翻译」） | lg1 dc4 | トークン節約。用語統一は LLM 側 |
| `agent-strategies/cot_agent`（ReAct / Function Calling）| — | Agent ノードの推論戦略 | **gn4**（予定表ツールを自律呼び出し）nm4 | 固定手順なら通常の tool ノードの方が安定（dsl-skill の指針） |

## 8. DSL 生成支援 — `yzmw123/dify-workflow-dsl-skill`（実装フェーズの標準手段）

- URL：<https://github.com/yzmw123/dify-workflow-dsl-skill>（README に「Dify 1.16.x → DSL `0.7.0`、**Dify 1.15.x → `0.6.0`（互換生成・検証）**」の対応表。2026-07-21 時点で 1.16.0 を最新と記載）
- 位置づけ：**33 サービスの DSL を新規に書くときは、人手で YAML を書かず、この Skill を AI エージェント（Claude Code / Codex 等）に読み込ませて生成 → 付属バリデータで検証 → Dify に import → export を正として修正**、を標準手順にする
- 導入手順（README より）
  ```bash
  git clone https://github.com/yzmw123/dify-workflow-dsl-skill.git
  cd dify-workflow-dsl-skill
  bash install.sh --platform claude     # ~/.claude/skills/dify-workflow-dsl に配置（codex / openclaw / hermes / opencode / all も可）
  python -m pip install -r requirements-dev.txt
  ```
- 呼び方（1.15.x 向け）：`Use $dify-workflow-dsl to create this workflow for Dify 1.15.0 using DSL 0.6.0.`
  検証：`python3 scripts/validate_dsl.py --strict --target-version 0.6.0 workflow.yml`（JSON 出力は `--format json`）
- 中身：`SKILL.md`（Workflow / Chatflow / Agent の選び方、Human Input、LLM ノードは `context` 必須 等）、`references/official-0.6-target.md`（0.6.0 の export 形・import 互換ルール・依存の書式）、`references/usecase-node-selection.md`（**業務要件 → ノード構成の対応表**。RAG／要約／フォーム検証／ファイル処理／通知）、`references/plugin-marketplace-tools.md`（顧客環境から最小 export を取って tool ノード識別子をコピーする手順。**識別子を捏造しない**）、`references/database-tools.md`（SQL ツールの安全な使い方）、`examples/dify-1.16.0/`（10 本、すべて 0.7.0）
- 注意：**LICENSE ファイルが無い**（2026-09-06）。Skill として手元で使うのは問題ないが、examples をこのリポジトリに取り込むのは避ける（`templates/README.md`）。Agent v2 / Agent App は 0.7.0（1.16）専用で、顧客環境（1.15.x）では使えない

## 9. 観測・運用

| 名称 | 何に使えるか | 注意点 |
|---|---|---|
| **Langfuse** | Dify の各アプリ「監視 → アプリ性能のトレース」に Secret/Public Key と Host を入れる（[Dify docs: Integrate with Langfuse](https://docs.dify.ai/en/use-dify/monitor/integrations/integrate-langfuse)、[legacy](https://legacy-docs.dify.ai/guides/monitoring/integrate-external-ops-tools/integrate-langfuse)。検索結果で実在確認・本文未取得）。セルフホスト可（GitHub タグ v4.30.0 まで確認）。回答品質のレビュー・コスト把握・kn4 の「問い合わせ履歴の分類」の元データに使える | ホスト先を中国国内に置けるかは顧客インフラ次第 |
| LangSmith / Phoenix | 同じ画面から選択可（[1.15.0 release](https://github.com/langgenius/dify/releases/tag/1.15.0) で Phoenix の trace session ID 対応に言及） | SaaS |
| OpenTelemetry / Prometheus `/v1/metrics` | PM 前提。本環境から docs 未到達のため URL 未記載 | — |
| Dify 会話ログ・アノテーション | kn4 の「回答できなかった質問」の抽出とFAQ 育成 | Cloud/セルフホスト共通 |

## 10. トリガー・スケジュール（1.10.0〜）

| 名称 | 対象 id | 用途 |
|---|---|---|
| Schedule トリガー（本体） | **nm3**（毎週金曜に日報フォルダを集計→WeCom 配信）**kn5**（当局サイト巡回）gn2（月初の発票処理） | セルフホスト前提。Cloud での Trigger 利用可否は未確認 |
| Webhook トリガー（本体） | **qa3**（顧客ポータル／メールゲートウェイからの投入）**gn3**（EDI/注文メールの転送） | 受信 URL を公開する必要 |
| `triggers/outlook_trigger` `gmail_trigger` `slack_trigger` `notion_trigger` `github_trigger` 等 | qa3 gn3 | SaaS イベント |

## 11. コミュニティ DSL 集・事例（実在確認の結果）

| 出典 | 中身 | ライセンス | 使いどころ |
|---|---|---|---|
| [svcvit/Awesome-Dify-Workflow](https://github.com/svcvit/Awesome-Dify-Workflow) | `DSL/` に **45 本**（version 0.1.0〜0.3.0）。翻訳 5 本、Document chat、三語一致性検査、chart、json_translate、Deep Researcher、Agent 系。README の FAQ（sandbox に pandas を入れる、文字列長上限、PDF 文字化けは Markdown 化してから 等）も有用 | MIT | `templates/01〜05` の出典 |
| [difyhub/workflows](https://github.com/difyhub/workflows) | **11 本**（version 0.4.0 / 0.5.0）。Text-to-SQL、Excel→ECharts、要約、画像認識（Qwen2.5-VL via SiliconFlow）、OCR→Excel | MIT | `templates/06〜07` の出典。**SiliconFlow 依存の 1.x 形式 DSL の実例** |
| [wwwzhouhui/dify-for-dsl](https://github.com/wwwzhouhui/dify-for-dsl) | 中国語の実務 DSL 多数（`dsl/` 配下、会议纪要・発票批量識別・合同审查・PDF 原格式翻訳・RSS 集約 等。README に対象 Dify 版 1.6〜1.9 を記載） | **未表記** | URL 参照のみ。dc2 gn1 gn2 dc7 の構成の参考 |
| [shamspias/awesome-dify-agents](https://github.com/shamspias/awesome-dify-agents) | **README とディレクトリの雛形のみで DSL 本体は無い**（2026-09-06 clone で確認） | MIT | 参照価値なし。PM 前提のリストにあるが**注意** |
| [langgenius/dify-official-plugins `tools/mineru/_assets/mineru_demo.yml`](https://github.com/langgenius/dify-official-plugins/blob/main/tools/mineru/_assets/mineru_demo.yml) | 公式プラグイン付属デモ | Apache-2.0 | `templates/08` |
| Awesome README 掲載の関連プロジェクト：[apconw/sanic-web](https://github.com/apconw/sanic-web)（Dify を DB 問答のサービス層に）、[leochen-g/dify-schedule](https://github.com/leochen-g/dify-schedule)（旧来の定時実行。1.10 の Trigger で不要）、[svcvit/dify-sandbox-py](https://github.com/svcvit/dify-sandbox-py)（pandas/matplotlib が動く代替 sandbox） | — | **本環境から未確認**（README 記載のみ） | nm5 / nm3 |

### 事例記事（検索結果で実在確認。本文はプロキシ遮断で未取得のものが多い）

| 記事 | 関係するサービス | 要点（検索スニペットから） |
|---|---|---|
| [Dify の活用事例 13 選（aismiley）](https://aismiley.co.jp/ai_news/dify-usage-example-13/) | **kn1 kn2 qa1** | 製造業で「設備異常コード・不良内容を入れると過去トラブル DB から原因候補と対応履歴を提示」→ ライン停止時間 約 40% 減、夜勤の初動を支援 |
| [Dify 事例 15 選（Sun*）](https://sun-asterisk.com/service/development/topics/ai/5162/) | gn1 dc2 | 経費精算・議事録の自動化事例 |
| [Dify 活用事例：請求書処理の自動化（博報堂 DY ONE）](https://oneder.hakuhodody-one.co.jp/blog/dify-usecase-invoice-automation) | **gn2** | Power Automate と組み合わせ、請求書から番号・日付・金額を JSON 抽出 |
| [Dify 活用事例：データ突合・レポート・承認（zeroka）](https://zeroka.jp/column/dify-ops-automation-use-cases) | gn2 dc5 | 突合・承認フローの事例 |
| [三步实现音视频转文字会议纪要（火山引擎 開発者コミュニティ）](https://developer.volcengine.com/articles/7535837708368183334)／[同 53AI](https://www.53ai.com/news/LargeLanguageModel/2025090871809.html) | **dc2** | 音声抽出 → STT（FunAudioLLM/SenseVoiceSmall）→ LLM（DeepSeek）→ Word 出力。dify-for-dsl 52 番と同著者 |
| [Dify 工作流赋能财务自动化：票据识别（百度智能云）](https://cloud.baidu.com/article/3690560) | **gn1 gn2** | 中堅製造業で月 2,000 枚超の増値税発票・1,500 件の精算を対象にした票据識別フロー（本文未取得） |
| [Dify+MCP 泵类设备预测性维护（知乎）](https://zhuanlan.zhihu.com/p/1893970010654897869) | **nm4 en2** | Agent が `get_erp_stock` ツールで ERP 在庫を照会する実例（HTTP/MCP 連携の型） |
| [Dify v1.11.0 知识库支持多模态检索（53AI）](https://www.53ai.com/news/dify/2025122535862.html) | **en3** | 画像をクエリにして文書中の図・部品図を召回 |
| [Dify 契約書リスクチェックワークフロー（AI Native）](https://www.ai-native.jp/dify/workflows/contract-review) | dc7 | 契約テンプレに対する条項漏れ・業界ルールチェック→指摘一覧（本文未取得） |
| [Dify Marketplace: SiliconFlow](https://marketplace.dify.ai/plugin/langgenius/siliconflow) | 全般 | 到達不可のため未確認（検索結果に存在） |

**該当なし（探したが見つからなかったもの）**：Dify で 8D 報告書を生成する公開 DSL／記事（8D 一般の記事のみ）、新旧仕様書の差分比較（en1）の Dify 事例、BOM 逆引き（en2）の Dify 事例、図面類似検索（en3）の Dify 事例、通関書類照合（dc6）、稟議ルート判定（dc5）。これらは**汎用パターン（抽出→Code 照合→LLM）の組み合わせ**で作る前提とし、事例は捏造しない。
