# docs/dify/templates — 参照 DSL（外部出典・無改変）

顧客版カタログ 33 サービスに近い Dify DSL を、コミュニティ／公式リポジトリから **8 本**選んで raw のまま保存した。
各 yml の冒頭にコメント（出典 URL・ライセンス・雛形候補サービス・メモ）だけを追記している。**本文は無改変。**
`python3 -c "import yaml; yaml.safe_load(open(f))"` で 8 本すべて YAML として読めることを確認済み（2026-09-06）。

取得方法：本環境では `api.github.com` への直接アクセスがプロキシで遮断されたため、各リポジトリを `git clone --depth 1`（公開リポジトリの匿名 read）して該当ファイルをコピーした（内容の同一性は git 側で保証）。

## 保存した 8 本

| # | ファイル | 出典（リポジトリ / 元ファイル） | ライセンス | `version` | mode | 雛形候補サービス | 何が参考になるか |
|---|---|---|---|---|---|---|---|
| 01 | `01-translation-reflection-workflow.yml` | [svcvit/Awesome-Dify-Workflow](https://github.com/svcvit/Awesome-Dify-Workflow) `DSL/translation_workflow.yml` | MIT | `0.1.0` | workflow | **lg1** lg4 dc4 lg3 | 直訳 → 専門家提案 → 改善訳の 3 段（Andrew Ng translation-agent 移植）。`if-else` と `variable-aggregator` の使い方 |
| 02 | `02-long-document-chunk-iteration-translate.yml` | 同 `DSL/全书翻译.yml`（原典は Dify 公式 Explore テンプレート） | MIT | `0.1.2` | workflow | **gn5** kn5 dc6 dc7 | 長文を `code` で分割 → `iteration` 内で LLM 4 段 → `template-transform` で結合。長文 PDF（通達・契約）の標準形 |
| 03 | `03-document-chat-classifier-multi-kb.yml` | 同 `DSL/Document_chat_template.yml`（原典 Winson-030/dify-DSL） | MIT | `0.1.0` | workflow | **kn1 kn2 kn3 kn4** | `question-classifier` → 分類ごとに別 `knowledge-retrieval` → LLM。**権限帯で KB を分ける**構成の雛形にもなる |
| 04 | `04-trilingual-consistency-checker.yml` | 同 `DSL/LanguageConsistencyChecker.yml`（原典 stvlynn/langfixer） | MIT | `0.1.3` | workflow | **kn3**（版ズレ）**lg2** en1 | 3 言語版の同一文書を取得 → 言語別に LLM で不一致を列挙。URL 取得を file 入力に置き換えれば日中版規程の突合に使える |
| 05 | `05-chatflow-form-input-demo.yml` | 同 `DSL/Form表单聊天Demo.yml` | MIT | `0.1.3` | advanced-chat | **form 型 8 件**（qa3 dc1 dc5 dc7 lg1 lg3 lg4 nm1） | チャット内にフォームを描いて入力を受け、会話変数に保持する。Dify 1.x では Human Input ノードでも同等のことができる |
| 06 | `06-text-to-sql-http-api-echarts.yml` | [difyhub/workflows](https://github.com/difyhub/workflows) `data-analysis/text-to-sql-en/workflow.yml` | MIT | `0.4.0` | workflow | **nm5 nm4 en2**（lookup 型） | 自然言語 → LLM で SQL → `http-request` で自前 SQL API → LLM 解説＋ECharts。**SiliconFlow（Kimi-K2）依存の実例** |
| 07 | `07-excel-document-extractor-echarts.yml` | 同 `data-analysis/smart-chart-generator-en/workflow.yml` | MIT | `0.4.0` | workflow | **nm3 nm2 gn1 gn2 gn3**（upload 型） | `start(file-list, select)` → `document-extractor` → LLM。upload 型の最小骨子 |
| 08 | `08-mineru-pdf-parse-demo.yml` | [langgenius/dify-official-plugins](https://github.com/langgenius/dify-official-plugins) `tools/mineru/_assets/mineru_demo.yml` | Apache-2.0 | `0.1.5` | advanced-chat | **qa4 dc6 kn5 gn1 gn2 en3**（複雑 PDF） | 公式 MinerU プラグインの tool ノード呼び出しと `iteration` での結果処理。依存は `langgenius/mineru:0.0.3`（現行 0.5.7） |

### `version` と 0.6.0 の差について

- 8 本とも **0.6.0 より古い**（0.1.0〜0.4.0）。dsl-skill の `references/official-0.6-target.md` によれば、Dify は import 時にサーバ側 DSL バージョンと比較し、**古いマイナー版は警告付きで import 可**、メジャー差や新しい版は確認／移行が要る。つまり 8 本は 1.15.x に import できる見込みだが、次の差し替えが必ず要る：
  - **モデル**：`deepseek/deepseek-chat`、`openai/gpt-4o`、`openai_api_compatible/...` 等 → 顧客環境のプロバイダ（SiliconFlow 等）に置き換える。0.1.x 世代はプロバイダ表記が `provider/model` で、1.x は `langgenius/siliconflow/siliconflow/<model>` 形式（06・07 が 1.x 形式の実例）
  - **依存プラグイン**：0.1.x 世代は `dependencies: []`（プラグイン化前）。1.x では tool ノードごとに `dependencies` に marketplace 識別子が要る（06〜08 参照）。dsl-skill は「顧客環境から最小 export を取って識別子をコピーする」ことを推奨
  - **ナレッジ ID**：`knowledge-retrieval` の `dataset_ids` は環境固有。import 後に選び直す
- 新規に書くときは、これらを**そのまま import して直す**のではなく、[dsl-skill](https://github.com/yzmw123/dify-workflow-dsl-skill) に「`--target-version 0.6.0` で生成」させ、構成の参考として 8 本を読む使い方を推奨する（`plugins-and-references.md` §8）

## URL のみ記録したもの（取り込まない理由つき）

| 出典 | 対象 | 雛形候補 | 取り込まない理由 |
|---|---|---|---|
| [yzmw123/dify-workflow-dsl-skill](https://github.com/yzmw123/dify-workflow-dsl-skill) `examples/dify-1.16.0/` | `03-excel-markdown-analysis.yml`（start(file)→document-extractor→code→llm→end）、`05-question-classifier.yml`、`08-human-approval.yml`（human-input ノード）、`02-multiturn-chat-assistant.yml`。すべて `version: "0.7.0"` | nm3 gn1 gn2（03）／qa3 kn4（05）／dc5 kn4 のエスカレーション（08） | リポジトリに **LICENSE ファイルが無い**（2026-09-06 時点）。また 0.7.0 は 1.15.x に import 不可。構成の参考としてのみ参照 |
| [wwwzhouhui/dify-for-dsl](https://github.com/wwwzhouhui/dify-for-dsl) `dsl/` | 「52-…三步实现音视频转文字会议纪要…」（dc2）、「61-…批量识别PDF电子发票信息生成excle表格」（gn1 gn2）、「通用合同审查助手」「软件开发类合同审查chatflow」（dc7）、「用 Dify 实现多语言 PDF 文档原格式翻译」（lg1 gn5）。README の一覧に対象 Dify 版（1.6〜1.9）が書かれている | dc2 gn1 gn2 dc7 lg1 | **ライセンス未表記**。ファイル名が中国語で長い。中国語圏の実務パターン（発票・会議紀要）の参考として URL 参照 |
| [svcvit/Awesome-Dify-Workflow](https://github.com/svcvit/Awesome-Dify-Workflow) | `chart_demo.yml`（answer 内 ECharts 描画、0.1.3）、`数据分析.7z`（DB 照会＋Flask サービス同梱）、`Deep Researcher On Dify .yml`（0.1.5、100KB）、`DuckDuckGo翻译+LLM二次翻译.yml`（機械翻訳→LLM 2 段） | nm5／nm5／kn5／lg1 | 8 本に絞ったため。MIT なので必要なら追加取り込み可 |
| [difyhub/workflows](https://github.com/difyhub/workflows) `vision/smart-recipe-recognition/workflow.yml` | 画像 OCR → JSON → Excel 出力（`version: 0.5.0`、advanced-chat） | gn1 gn2（発票画像→Excel） | 料理メニュー題材で業務から遠いため URL のみ。**OCR→JSON→Excel の出力パターン**は同じ |

## 使い方（implementer 向け）

1. Dify の「アプリを作成 → DSL ファイルをインポート」で yml を読み込む。冒頭コメントは YAML として無視される
2. import 直後に：モデルプロバイダを顧客環境のものに変更／tool ノードの認可を再設定／`knowledge-retrieval` の KB を選び直す
3. 動いたら **export し直して**、その export を dsl-skill の入力（tool ノード識別子の正）にする
4. 改変版は本ディレクトリに置かない（実装リポ側へ）
