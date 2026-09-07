# 共通部品（別出しが必要なもの）PC-01〜PC-16

Dify のアプリ（Chatflow／Workflow）だけでは成立しない部分を、サービス横断の**共通部品**として切り出したもの。
`usecases/<管理番号>.md` の「依存する共通部品」「§8 別出しが必要なもの」はこの ID を参照する。**ID と名称は固定**（writer が既にこの ID で書いている）。

凡例：工数感 S＝数日／M＝1〜3 週／L＝1 か月超（1 名換算・目安）。「無くても動く範囲」＝その PC が無いときに、どのサービスがどこまで動くか。
プラグイン・URL は `plugins-and-references.md` に載っているものだけを使う。Outline の仕様は `outline-wiki-usecases.md` §1（ソース確認済み）。

---

## PC-01 フィードストア

| 項目 | 内容 |
|---|---|
| 目的 | ③ 業務フィードの `due`（期限つき）／`routine`（定例）／`notify`（お知らせ）を**担当者ごとに溜めて**本番 UI（PC-16）に出す。モックの `FEED.items` の本番版 |
| なぜ Dify 単体では足りないか | Dify の会話ログはアプリ単位・利用者単位で、**担当者横断の To-Do／通知の保存先が無い**。Trigger は Workflow を起動するだけで結果を溜めない |
| 実現案 | テーブル `feed_items`：`id`／`owner_id`（社員 ID、PC-02）／`svc_id`（内部 id `qa1`。表示は管理番号に変換）／`kind`（`due`/`routine`/`notify`）／`title`／`note`（ja/zh）／`due_at`（UTC、`routine` は次回実行時刻）／`status`（`open`/`done`/`dismissed`）／`source`（`qms`/`bpms`/`schedule`/`crawler`/`manual`）／`source_ref`（元システムの id。**冪等キー**）／`created_at`/`updated_at`。API：`POST /feed/items`（Dify の `http-request` から）、`GET /feed/items?owner=&status=open`、`PATCH /feed/items/{id}`（状態変更）。実体は小さな Web サービス（DB 1 テーブル＋REST）。簡易版は `tools/jiandaoyun`／`tools/hap`／`tools/microsoft_excel_365` の表を保存先にする |
| 書き込む側 | `due`：QMS 不具合票 → Webhook Trigger → Workflow → POST（QA-01）／BPMS 差し戻し → 同（DC-05）。`routine`：Schedule Trigger（PC-11）が実行前に POST（NM-03 LG-03）。`notify`：KN-05 の通達巡回・EN-01 の仕様更新検知（PC-12）が POST |
| 代替案 | **BPMS の通知・タスク一覧をそのままフィード源にする**（Dify は BPMS に書くだけ、PC-16 が BPMS API を読む）。BPMS が全拠点で使われているならこちらが正。二重通知を避けられる |
| 依存する外部システム | QMS（不具合票）、BPMS／稟議 WF（差し戻し・期限）、SSO（担当者 id） |
| 使うサービス | QA-01 DC-05 QA-02 NM-03 LG-03 KN-05 EN-01（モックの 7 件）＋ QA-03 GN-02 PT-01 PT-07 |
| 段階導入 | 無くても ①② は動く。第 1 段：手動登録＋Schedule 由来の `routine` のみ。第 2 段：QMS/BPMS Webhook。第 3 段：BPMS 統合（代替案） |
| 工数感 | M |
| リスク | BPMS と二重通知／担当者マッピング（部署→人）の保守／絶対日付とタイムゾーン（蘇州 UTC+8・日本 UTC+9）／管理番号をフィード項目に出さない（D-14） |

## PC-02 認証・ロール

| 項目 | 内容 |
|---|---|
| 目的 | 利用者（日本側・中国側）を SSO で識別し、**部署属性で「担当分類（③ `mine`）」「見える KB（HR 帯等）」を決める** |
| なぜ Dify 単体では足りないか | Dify のロールはワークスペース運用者向け（owner/admin/editor/normal）。KB の公開範囲は「自分／全員／一部メンバー」、メタデータフィルタは**タグ**であり企業 ACL（人×文書）を表現できない（`feasibility` §4）。WebApp 側の SSO・グループ連携は Dify Enterprise の機能とされるが**本環境から未確認** |
| 実現案 | 本番 UI（PC-16）が SSO（OIDC／Azure AD／WeCom ログイン）で認証 → 属性（社員 ID・部署・拠点・言語）を取得 → Dify Service API を呼ぶときに `user` に社員 ID を渡す（会話ログの主体になる）。権限は**前段で判定**：部署 → 帯（全社／技術／品質／HR／購買）→ 呼べるアプリ・KB を表で持つ。KB は帯ごとに分割（F-5 (a)）。HR 帯は Ollama 等の自前モデル（F-4 (c)）も選択肢 |
| 依存する外部システム | IdP（Azure AD／Okta／WeCom）、人事マスタ（部署属性） |
| 使うサービス | 全サービス。特に KN-03 KN-04（HR 帯）QA-04 DC-07（顧客別・契約）PT-04 PT-05 PT-08（個人情報） |
| 段階導入 | 無い場合：Dify WebApp を「メンバーのみ」で公開し、帯ごとに別アプリを配る。①②③ の出し分けは無し |
| 工数感 | M（IdP 設定込み） |
| リスク | 日本側と中国側で IdP が異なる／WeCom アカウントと社員 ID の突合／退職者のアクセス停止（IdP 側で止まることを確認） |

## PC-03 文書取込パイプライン

| 項目 | 内容 |
|---|---|
| 目的 | 文書（PDF・スキャン・DOCX・XLSX・Wiki）を **OCR → チャンク → メタデータ付与 → KB** に流し、更新を追いかける |
| なぜ Dify 単体では足りないか | 手動アップロードでは版管理・メタデータ・再取込が回らない。スキャン PDF と表は Document Extractor では崩れる（`plugins-and-references.md` §1） |
| 実現案 | Knowledge Pipeline（v1.9.0〜）：データソース（`datasources/sharepoint_datasource`／`onedrive`／`tencent_cos_storage`／`aws_s3_storage`）→ 抽出（`tools/dify_extractor`。スキャン・複雑レイアウトは `tools/mineru`（自前デプロイ推奨）、中国語帳票・図面は `tools/paddleocr`）→ チャンク（`tools/general_chunk`／`parent_child_chunk`／FAQ は `qa_chunk`）→ メタデータ（`svc`・`lang`・`version_date`・`doc_type`・`site`・`confidentiality`・`source_url`）→ KB。Outline はデータソース無し → PC-05 が Markdown を export して Knowledge API（`create-by-text`/`update-by-text`）で投入 |
| 更新経路 | 定期再取込（PC-11）＋差分検知（PC-12）。「ページ単位レコード」を保つ（引用に必要） |
| 依存する外部システム | ファイルサーバ／M365／COS、Outline、（OCR を API で使うなら Baidu・MinerU API＝越境確認） |
| 使うサービス | KN-01〜05 QA-01 QA-04 DC-06 DC-07 LG-02 EN-01 EN-03 GN-01 GN-02 GN-03 PT-03 PT-05 PT-06 |
| 段階導入 | 無い場合：手動アップロード（W1 はこれで動く）。OCR 無しはテキスト PDF のみ対応 |
| 工数感 | M（OCR 自前デプロイを含めると L） |
| リスク | OCR の中国語・日本語混在精度／表の崩れ／メタデータ付与の運用（誰が `version_date` を入れるか）／KB 再構築時の引用 id 変化 |

## PC-04 業務システム連携

| 項目 | 内容 |
|---|---|
| 目的 | QMS・BPMS・ERP・MES・WMS・稟議 WF と **読み取り（照会）・受信（イベント）・取込形式の出力**でつなぐ。**登録・承認はしない**（§2） |
| なぜ Dify 単体では足りないか | `http-request` ノードと Webhook Trigger は汎用であり、認証・冪等・レート制限・スキーマ差分の吸収は**外側**に要る。顧客システムに REST が無い場合は薄い API 層が必要（`templates/06` と同じ構成） |
| 実現案 | (1) 受け口：Webhook Trigger（1.10.0〜）の URL を公開せず、**アダプタ**（社内 API ゲートウェイ）経由で受ける。署名検証・`event_id` で冪等（PC-01 の `source_ref` と同じ）。(2) 照会：`http-request` → アダプタ → ERP/WMS/MES。読み取り専用アカウント。(3) 出力：CSV／JSON の「取込形式」をファイルで返す（PC-13）。(4) 認証：API キーは Dify の環境変数（Secret 型）、アダプタ側は mTLS か IP 制限。(5) システム別データ契約表（項目・型・更新頻度・主キー） |
| 依存する外部システム | QMS（不具合票・クレーム）、BPMS／稟議 WF（申請・差し戻し・承認ルート）、ERP（在庫・受発注・原価）、MES（ロット・工程）、WMS、加工貿易手冊台帳、カレンダー（M365） |
| 使うサービス | NM-04 EN-02 NM-05（lookup 3 件）DC-06 QA-01 QA-02 QA-03 DC-05 GN-01 GN-02 GN-03 GN-04 NM-01 NM-03 PT-07 |
| 段階導入 | 無い場合：lookup 型は「アップロード → 抽出」に落とす（`feasibility` §3）。書き込み系は CSV 出力まで |
| 工数感 | L（システム数に比例。1 システム M） |
| リスク | 顧客システムの API 有無／ベンダ保守契約／読み取り権限の申請に時間がかかる／MES のリアルタイム性と KB のずれ |

## PC-05 Outline Wiki 連携

| 項目 | 内容 |
|---|---|
| 目的 | Outline を**人が読む文書の正本**とし、(a) コレクション → KB の同期、(b) Dify の成果物を**下書き**として Outline に置く、(c) 更新イベントの受信 |
| なぜ Dify 単体では足りないか | Outline 用の Data Source プラグインは無い（`plugins-and-references.md` §5）。KB への書き込みは Knowledge API 経由で外側から行う |
| 実現案 | **同期ジョブ**（自前・Python）：マッピング表 `collection_id → dataset_id（帯）`。全量：`collections.documents` → `documents.export`（Markdown）→ Knowledge API `update-by-text`（メタデータ `outline_doc_id`・`collection`・`updatedAt`・`url`）。差分：Outline Webhook（`documents.publish`／`documents.update`／`documents.archive`、ヘッダ `Outline-Signature` で検証）→ Dify Webhook Trigger → 該当文書だけ再投入。**書き戻し**：`documents.create` を下書き（`publish: false`）で「AI ドラフト」コレクションへ。**公開（publish）は人が行う**。Dify は公開しない。API キーは Outline のスコープ `read`/`write`/`create` を最小に |
| 権限 | Outline のコレクション権限（read／read_write／admin）と Dify KB の公開範囲は別物。**1 コレクション＝1 KB＝1 帯**で揃え、Outline 側で読めない人は PC-02 の帯で KB も見えないようにする |
| 承認フロー | AI ドラフト → 担当者が編集 → レビュー担当が publish → Webhook で KB 更新。レビュー担当はコレクション単位で決める |
| 依存する外部システム | Outline（セルフホスト）、Dify Knowledge API |
| 使うサービス | 読む：KN-01〜05 QA-04 DC-07 LG-01 LG-02 EN-01 PT-03。書く：DC-02 DC-03 LG-02 LG-03 KN-04（FAQ）KN-05（改訂案）。詳細は `outline-wiki-usecases.md` §2 |
| 段階導入 | 無い場合：Outline から手動 export（Markdown zip）→ 手動アップロード。書き戻しは人がコピー |
| 工数感 | M |
| リスク | Outline の API レート制限（ルートにより 25〜100 回/分の制限がソースに存在）／Markdown 化で失われる表・添付／二重管理（PM 判断、`outline-wiki-usecases.md` §4） |

## PC-06 用語集・翻訳メモリ

| 項目 | 内容 |
|---|---|
| 目的 | 社内用語（ja/zh/en・定義・出典・所管）を 1 か所に持ち、翻訳・QA・差分の全サービスで**同じ訳語**を出す。LG-02 の検出結果の受け皿 |
| なぜ Dify 単体では足りないか | KB は検索用で「一覧・承認状態・所管」を持てない。複数アプリで同じ対応表を使う仕組みが無い |
| 実現案 | 用語テーブル：`term_id`／`ja`／`zh`／`en`／`definition`／`domain`（分類 id）／`status`（`approved`/`candidate`）／`source`／`owner`／`updated_at`。正本は Outline「用語集」コレクション（人が編集、`outline-wiki-usecases.md` OW-05）か 简道云／Excel 365。派生：(1) KB（`qa_chunk` で「用語→定義」）、(2) **プロンプト注入用 CSV**（`approved` のみ・分類でフィルタ・上限 200 語）を Code ノードで `{{glossary}}` に整形、(3) 翻訳メモリ：承認済み訳文ペア（LG-01 LG-04 DC-04 DC-01 の出力を人が承認したもの）を KB に |
| 更新責任 | 用語集オーナー（翻訳担当）。候補（`candidate`）は LG-01「登録形式で出す」／LG-02 の検出から。月次で承認 |
| 依存する外部システム | Outline または 简道云／Excel 365 |
| 使うサービス | LG-01 LG-02 LG-03 LG-04 DC-01 DC-04 EN-01 KN-03 DC-03 |
| 段階導入 | 無い場合：System プロンプトに 30〜50 語を直書き（W1）。サービスごとにずれるので早く PC-06 へ |
| 工数感 | S（表と注入）／M（翻訳メモリまで） |
| リスク | 用語の増加で注入上限を超える → 分類フィルタと検索併用／簡体・繁体・日本漢字の同形異義 |

## PC-07 言語判定・多言語出力

| 項目 | 内容 |
|---|---|
| 目的 | **入力言語（ja/zh）を判定し、UI 言語と無関係にその言語で返す**（`CLAUDE.md` §2-5、モックの `detectLang()` の本番版） |
| なぜ Dify 単体では足りないか | LLM に「入力言語で答えて」と頼むだけでは混在文・型番だけの入力で揺れる。全アプリで同じ判定を使う必要がある |
| 実現案 | Code ノードの共通スニペット（Python）：型式・品番・URL・数字を除いた本文で、かな含有 → `ja`、漢字のみ → `zh`、ラテン主体 → `en`。混在は文字数比で**主言語**。出力：`in_lang`（`ja`/`zh`/`en`）と `out_lang`（既定 `in_lang`。DC-01「日本語で」など明示指定があれば上書き）。System には `{{out_lang}}` を差し込む（§6-1）。**Workflow as Tool** として公開し各アプリから呼んでもよい |
| 決め事（PM 判断） | 簡体を既定とし繁体入力は簡体で返す／英語入力は英語で返す（業務上 ja/zh 固定が要るサービスは個別に定義）／ja と zh の**同じ意味の並行台本**をテストの正とする |
| 使うサービス | 全サービス（qa・form 型で必須） |
| 段階導入 | 無い場合：System の指示のみ。テスト種別「言語混在」の合格率で判断 |
| 工数感 | S |
| リスク | 日本漢字だけの短文（「型式確認」）を zh と誤判定 → 語彙リスト補正／英語 UI の利用者（`en`）の扱いが未定 |

## PC-08 モデル運用

| 項目 | 内容 |
|---|---|
| 目的 | 拠点ごとのモデル選定・フォールバック・コスト上限・越境ルールを 1 枚で管理し、変更時に回帰を回す |
| なぜ Dify 単体では足りないか | プロバイダ設定はワークスペース単位で、**どのアプリが海外 API を呼んでよいか**の統制やコスト上限の運用は外側の表と手順が要る |
| 実現案 | モデル表：中国側既定 `models/siliconflow`（`api.siliconflow.cn`）— 生成 Qwen3-235B／DeepSeek-V3.x、抽出・反復用の小型 Qwen3-32B、埋め込み `bge-m3`、リランク `bge-reranker-v2-m3`、STT `sense-voice-small`（自前なら `models/funasr`）。日本側：F-4 に従い Azure OpenAI 等を**別アプリ**で。人事・図面：`models/ollama` 等の自前（越境ゼロ）。フォールバック：Dify のモデル負荷分散（複数資格情報）を使う想定（顧客版で有効か実装時に確認）。コスト：Langfuse（PC-09）でサービス別月額を見て閾値超過を通知。**越境表**：アプリ × プロバイダの許可マトリクス（PC-10 と共通） |
| 依存する外部システム | SiliconFlow 契約、（日本側）海外モデル契約、自前 GPU |
| 使うサービス | 全サービス。日本語品質が効く DC-01 LG-04 KN-03 GN-05 NM-03 QA-01 は評価セットで比較してから決める |
| 段階導入 | W1 は SiliconFlow 1 系統で開始。日本側の別アプリ化は W2 以降 |
| 工数感 | S（設定）＋継続運用 |
| リスク | モデル名の改廃（SiliconFlow 側）／データが中国インフラに流れる点の法務確認／日本語品質の不足 |

## PC-09 評価・観測

| 項目 | 内容 |
|---|---|
| 目的 | 全アプリのトレース・コスト・品質スコアを **Langfuse** に集め、`implementation-guide.md` §5 の回帰テストを回す |
| なぜ Dify 単体では足りないか | Dify のログは会話の閲覧・アノテーションまで。データセット・スコア・実行比較・ダッシュボードは外部 |
| 実現案 | Langfuse セルフホスト（`plugins-and-references.md` §9）。各アプリ「監視 → トレース」で接続。データセット＝管理番号、項目＝`Txx`（§5-4）。スコア：`correctness`（人手／LLM-as-judge。judge は SiliconFlow の別モデル）、`language`（PC-07 で自動）、`schema`（バリデータ）、`safety`（禁止語＋judge）、`latency_p95`。ランナー：実装リポジトリのスクリプトが Dify Service API を叩き、`run_name` で版を分ける。ダッシュボード：サービス別 コスト／p95／失敗率／スコア推移。KN-04 の「回答できなかった質問」はここから抽出 |
| 依存する外部システム | Langfuse ホスト（中国国内に置けるかは顧客インフラ次第） |
| 使うサービス | 全サービス |
| 段階導入 | 無い場合：Dify のログと人手採点シートで回帰。W1 から Langfuse 接続だけは入れる |
| 工数感 | M |
| リスク | トレースに個人情報が残る（PC-10 のマスクを Langfuse 送信前に効かせる）／judge モデルの偏り／評価セットの陳腐化 |

## PC-10 個人情報・秘密管理

| 項目 | 内容 |
|---|---|
| 目的 | PIPL（個人情報保護法）への対応、マスキング、越境データの統制、監査ログ、保持期間、シークレットの置き場を全サービス共通で決める |
| なぜ Dify 単体では足りないか | Dify はマスキング・分類・越境判定を持たない。ログ保持・監査は運用設計が要る |
| 実現案 | (1) データ分類：公開／社内／機密（単価・図面・契約先）／個人情報／敏感個人情報（給与・身分証・健康）。(2) マスク：LLM の前に Code ノードで 身分証 18 桁・電話 11 桁・メール・銀行口座・氏名リストを `[ID]` 等に置換（共通スニペット、Workflow as Tool）。個人は匿名 ID（`C-2609-A` 体系）。(3) 越境：アプリ × プロバイダ × パートナーの許可表（PC-08・PC-15 と共通）。海外事業者へ個人情報を送らない設計を先に置く（PIPL 第 38 条の評価を避ける）。(4) 保持：Dify 会話ログ・Langfuse トレースの保持期間（例 90 日）と削除手順。個人情報を含む KB は HR 帯のみ、または KB 化しない。(5) 監査：誰が・どのアプリで・何を聞いたか（PC-02 の `user`）。(6) シークレット：環境変数／Dify Secret 型。コミット・チャット貼り付け禁止（`CLAUDE.md` §2-10） |
| 依存する外部システム | 法務（越境評価）、IdP、Langfuse |
| 使うサービス | 全サービス。重点 KN-03 KN-04 GN-01（人事・経費）QA-03 DC-07（顧客・契約）EN-03 NM-01（図面・単価）PT-04 PT-05 PT-08（給与・応募者・受講） |
| 段階導入 | W1 から (2) マスクと (6) シークレットは必須。(3)(4) は法務確認と並行 |
| 工数感 | M（法務調整を除く） |
| リスク | マスクの取りこぼし（氏名）／Dify のログ保持設定の可否は実装時に確認／PIPL は法的助言ではない旨の注記（§6-10） |

## PC-11 スケジューラ

| 項目 | 内容 |
|---|---|
| 目的 | 定例（日報集計・通達巡回・与信監視・週次書き下し）を **Schedule Trigger** で回し、失敗を通知する |
| なぜ Dify 単体では足りないか | Trigger は起動のみ。「どの定例が・いつ・誰宛に・失敗したらどうする」の台帳と、タイムゾーン・冪等の運用が外側に要る |
| 実現案 | 定例台帳 `jobs`：`job_id`／`svc_id`／`cron`／`tz`（`Asia/Shanghai` か `Asia/Tokyo`）／`owner`／`notify_on_fail`（PC-14 のチャネル）／`last_run`／`last_status`。Schedule Trigger（1.10.0〜、セルフホスト前提）→ Workflow 先頭で `run_key = <job_id>-<日付>` を作り PC-01 に `routine` を POST（冪等）→ 本処理 → 失敗時は `if-else` → `tools/wecom`／`tools/email`。祝日（両国）は KB か Code の定数（GN-04 と共用） |
| 依存する外部システム | 通知チャネル（PC-14）、日報の置き場（ファイルサーバ／COS） |
| 使うサービス | NM-03（毎日 8:30）LG-03（毎週月曜）KN-05（通達巡回）PT-01（週次与信）GN-02（月初）PT-08（受講管理の週次）PC-05 の夜間全量同期 |
| 段階導入 | 無い場合：担当者が手動実行（③ の `routine` は表示だけ） |
| 工数感 | S |
| リスク | Cloud での Trigger 可否は未確認（F-7 でセルフホスト）／両国のタイムゾーン差と祝日／二重起動 |

## PC-12 差分検出エンジン

| 項目 | 内容 |
|---|---|
| 目的 | 文書の**版管理**・機械的な **diff**・**影響範囲マッピング**（変わった箇所 → 影響する社内文書・工程）を共通化する。KN-05／EN-01／QA-02 の本体 |
| なぜ Dify 単体では足りないか | Dify に版管理は無い。diff は Code ノードでできるが、版の保持・索引・影響マッピング表は外側に要る |
| 実現案 | (1) 版管理：Outline は `revisions.create` イベントと版履歴、ファイルサーバは `version_date` メタデータ（PC-03）。版ペアを取り出す API。(2) diff：PDF は `tools/mineru` で Markdown 化 → Code ノード（`difflib`。表はセル単位、番号付き条項は条項単位）→ 変更点 JSON `{ section, before, after, kind }`。(3) 影響マッピング：`impact_index`（文書 id → 参照している規程・工程・図面・用語）を KB のメタデータと別表で持ち、変更点の条項番号・用語で照合 → LLM は**意味づけと影響の説明だけ**。(4) **Workflow as Tool** `diff-core` として公開し、KN-05／EN-01／QA-02／DC-06／KN-03（版ズレ）から呼ぶ |
| 依存する外部システム | Outline、ファイルサーバ、（QA-02）ECR・不具合履歴 |
| 使うサービス | EN-01 KN-05 QA-02 KN-03 DC-06 DC-07（過去契約との差） |
| 段階導入 | 無い場合：2 ファイルをアップロードして Code で diff（EN-01 の diff 型はこれで動く）。影響マッピングは LLM 推定＋【要確認】 |
| 工数感 | M |
| リスク | OCR 差による偽差分（同一文書でも改行・全角半角）→ 正規化ルール／影響索引の保守（誰が更新するか） |

## PC-13 ファイル出力

| 項目 | 内容 |
|---|---|
| 目的 | 成果物を **DOCX／XLSX／PDF／CSV** の社内フォーマットで返す（8D 報告書・稟議書・月報・見積比較表・基幹取込 CSV） |
| なぜ Dify 単体では足りないか | LLM の出力はテキスト／Markdown。帳票テンプレートへの流し込みと Office ファイル生成は外部処理が要る |
| 実現案 | 自前 **レンダラ API**（python-docx／openpyxl／PDF 生成）：`POST /render` に `{ template_id, data(JSON) }` → ファイル URL（期限付き）。Dify からは `http-request` で呼び、`files` 出力を Answer／End で返す（ファイル受け取りの詳細は顧客版で実装時に確認）。テンプレート台帳：`template_id`／様式名／言語（ja/zh/両）／版／所管。Excel は `tools/microsoft_excel_365`（M365 なら）、pptx は `tools/slidespeak`（SaaS。越境確認）も選択肢。LLM の出力 JSON スキーマ＝テンプレートの差し込み項目にする（§6-8） |
| 依存する外部システム | 社内様式（Word/Excel テンプレート）の提供、M365 |
| 使うサービス | QA-01（8D）DC-01（報告書）DC-03（教材）DC-05（稟議書）DC-07（契約ドラフト）NM-01 NM-02（見積表）NM-03（集計表）GN-01 GN-02 GN-03（CSV・照合表）LG-04（メール文）PT-02 PT-07（RFQ） |
| 段階導入 | 無い場合：Markdown／CSV テキストをそのまま表示（W1）。DOCX は W2 以降 |
| 工数感 | M |
| リスク | 様式の版違い／中国語フォント埋め込み／ファイル URL の権限（PC-02） |

## PC-14 通知チャネル

| 項目 | 内容 |
|---|---|
| 目的 | WeCom／DingTalk／Teams／メールへの**送信**と、WeCom bot からの**受信**を 1 つの窓口にまとめる（`plugins-and-references.md` §3 のもののみ） |
| なぜ Dify 単体では足りないか | 送信ツールはあるが「誰に・どのチャネルで・どの言語で・何を含めてよいか」のルーティングと文面テンプレは共通化が要る |
| 実現案 | **Workflow as Tool** `notify`：入力 `{ to(部署 or 担当者 id), svc_id, kind, title, body, link }` → ルーティング表（拠点／部門 → チャネル：中国側 `tools/wecom`（群 bot）または `tools/dingtalk`、日本側 `tools/teams`／`tools/outlook`／`tools/email`）→ 文面テンプレ（ja/zh）→ 送信。本文に個人情報・単価を入れない（PC-10）。リンクは本番 UI（PC-16）の該当サービスへ（管理番号付き）。受信：`extensions/wecom_bot` で KN-02 KN-04 をスマホから |
| 依存する外部システム | WeCom 管理者権限（bot 登録・公開 URL）、M365 Graph 権限、SMTP |
| 使うサービス | QA-03（エスカレーション）NM-03（配信）KN-05（新着）KN-04 GN-04（招集）GN-02 PT-01 PC-11 の失敗通知 |
| 段階導入 | 無い場合：結果は UI で見るだけ。WeCom 群 bot（送信のみ）が最小構成 |
| 工数感 | S（送信）／M（bot 受信込み） |
| リスク | WeCom bot は Dify が公開 URL を持つ必要／通知の氾濫（PC-01 との重複） |

## PC-15 パートナー連携ゲートウェイ

| 項目 | 内容 |
|---|---|
| 目的 | PT 系（情報ベンダ・記事アーカイブ・給与 DB・採用エージェント・購買エージェント・研修ベンダ）の外部 API を**1 か所**から呼び、契約条件・データ最小化・「送信していないもの」の明示を機械的に守る |
| なぜ Dify 単体では足りないか | `http-request` から直接呼ぶと、API キー・契約条件（保存期間・再配布・出典表示）・送信項目の統制がアプリごとにばらける。双方向（進捗の戻り）は受け口が要る |
| 実現案 | アウトバウンド プロキシ：`partner_id` ごとに 認証情報／許可エンドポイント／**送信項目の allowlist**（匿名 ID・集計値のみ）／出典表示文言／保存期間。すべての送受信を記録し、結果に `sent_fields` と `not_sent`（例「氏名・連絡先・個人の給与は送信していない」）を返す → 結果パネル「連携」行（PT-10）。インバウンド：パートナーからの進捗・結果を Webhook で受け Dify Webhook Trigger へ（PT-06 PT-07 PT-08）。契約前は「構想」バッジのまま、GW にはモック応答を置く |
| 依存する外部システム | 各パートナーの API・契約（`docs/handoff/2026-09-06-partner-usecases.md` §5-3）、法務（越境評価） |
| 使うサービス | PT-01〜PT-08、NM-02（PT-02 の市況を引く）、DC-07（PT-06 の代替サプライヤー） |
| 段階導入 | 無い場合：PT 系は「PDF レポートのアップロード → 抽出」で成立（PT-01 PT-02 PT-03） |
| 工数感 | M（GW 本体）＋パートナーごと S〜M |
| リスク | 海外事業者への越境（PIPL 第 38 条）／出典・再配布の契約違反／判断責任（発注・採用判断は当社）の明示 |

## PC-16 本番 UI

| 項目 | 内容 |
|---|---|
| 目的 | モックの **①②③・詳細・5 テンプレ（qa/upload/form/diff/lookup）・管理番号表示（D-14）**を本番で出す |
| なぜ Dify 単体では足りないか | Dify WebApp はアプリ単位の画面で、カタログ・ダッシュボード・フィード・管理番号・帯による出し分けが無い |
| 実現案（3 案） | (a) **Dify WebApp をそのまま**：最速。①②③ 無し。W1 のパイロット向け。(b) **自前フロント**（推奨）：モックの情報構造（`CATS`/`SVCS`/`TEMPLATES`/`HOME`/`FEED` 相当）を持ち、SSO（PC-02）→ Dify Service API。qa 型＝`POST /v1/chat-messages`（ストリーミング）、upload／diff 型＝`POST /v1/files/upload` → `POST /v1/workflows/run`、form／lookup 型＝`POST /v1/workflows/run`。結果パネルはモックの `Result` 型（`items` または `columns+rows`）を Workflow の End 出力の JSON 契約にする。フィードは PC-01。(c) **WeCom bot**：KN-02 KN-04 の現場入口（PC-14）。(a)→(b) へ移行し、(c) は並走 |
| 決め事 | 言語切替とテーマはプロダクト機能（`CLAUDE.md` §2-4）、`.mockbar` は出さない／ファイル上限（Dify の `UPLOAD_FILE_SIZE_LIMIT` 等 `.env`）／管理番号はカード右上・詳細ヘッダー・chat ヘッダー（D-14） |
| 依存する外部システム | IdP、Dify Service API、PC-01 |
| 使うサービス | 全サービス |
| 段階導入 | (a) で開始可。②③ は (b) が要る |
| 工数感 | L（(b)）／S（(a)） |
| リスク | モックの見え方（Claude Design 引き渡し予定）と本番の乖離／ストリーミングとファイル応答の実装差／中国からの到達性（CDN・フォント） |

---

## 部品 × 分類マトリクス

○＝分類内の多くのサービスが依存／△＝一部のサービスが依存／—＝原則不要。PC-02 PC-07 PC-08 PC-09 PC-10 PC-16 は全分類 ○ のため列を「共通 6」にまとめた。

| 分類 | 共通 6 | PC-01 フィード | PC-03 取込 | PC-04 業務連携 | PC-05 Outline | PC-06 用語 | PC-11 定例 | PC-12 差分 | PC-13 出力 | PC-14 通知 | PC-15 パートナー |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **KN** ナレッジ | ○ | △（KN-04 KN-05） | ○ | — | ○ | △（KN-03） | △（KN-05） | △（KN-03 KN-05） | — | △（KN-02 KN-04 KN-05） | — |
| **QA** 品質 | ○ | ○ | ○ | ○ | △（QA-04） | — | — | △（QA-02） | ○ | △（QA-03） | — |
| **DC** 文書 | ○ | △（DC-05） | ○ | △（DC-05 DC-06） | ○ | ○ | — | △（DC-06 DC-07） | ○ | — | — |
| **LG** 日中 | ○ | — | △（LG-02） | — | ○ | ○ | △（LG-03） | — | △（LG-04） | △（LG-04） | — |
| **NM** 数字 | ○ | △（NM-03） | ○ | ○ | — | — | △（NM-03） | — | ○ | △（NM-03） | △（NM-02） |
| **EN** 図面 | ○ | △（EN-01） | ○ | △（EN-02） | △（EN-01） | △（EN-01） | — | ○ | — | — | — |
| **GN** 汎用 | ○ | △（GN-02） | ○ | ○ | — | — | △（GN-02 GN-04） | — | ○ | △（GN-04） | — |
| **PT** パートナー | ○ | △（PT-01 PT-07） | △ | △（PT-07） | △（PT-03 PT-08） | — | △（PT-01 PT-08） | — | ○ | △（PT-01） | ○ |

---

## 先行して作る順

`implementation-guide.md` §3 の波（W1〜W5）に合わせる。左が先。

| 順 | PC | 最低限の形（この段階で用意するもの） | 効くサービス |
|---|---|---|---|
| 1 | **PC-08** モデル運用 | SiliconFlow 中国版の登録・モデル表 1 枚・越境表の初版 | 全部 |
| 2 | **PC-07** 言語判定 | Code スニペット＋System 差し込み | 全部 |
| 3 | **PC-10** 個人情報・秘密 | マスク スニペット・シークレットの置き場・ログ保持の方針 | 全部 |
| 4 | **PC-09** 評価・観測 | Langfuse 接続・データセット命名・ランナー雛形 | 全部 |
| 5 | **PC-03** 文書取込 | 手動アップロード＋メタデータ項目の定義（OCR は W2） | KN DC QA |
| 6 | **PC-06** 用語集 | 初期 100 語の表と注入 | LG DC KN |
| 7 | **PC-16** 本番 UI (a) | Dify WebApp で W1 をパイロット | 全部 |
| 8 | **PC-02** 認証・ロール | 帯の定義・KB 分割・SSO | KN-03 KN-04 GN-01 |
| 9 | **PC-13** ファイル出力 | CSV／XLSX（GN-01 GN-02 NM-03） | GN NM QA DC |
| 10 | **PC-11** スケジューラ | NM-03 の日次から | NM-03 KN-05 |
| 11 | **PC-14** 通知 | WeCom 群 bot 送信 | QA-03 NM-03 KN-05 |
| 12 | **PC-05** Outline 連携 | 同期ジョブ（読む）→ 下書き（書く） | KN DC LG |
| 13 | **PC-12** 差分 | `diff-core` Workflow as Tool | EN-01 KN-05 KN-03 |
| 14 | **PC-01** フィードストア | テーブル＋API、Schedule 由来から | ③ 全体 |
| 15 | **PC-04** 業務連携 | アダプタ 1 システム目（QMS か ERP） | QA NM EN GN |
| 16 | **PC-16** 本番 UI (b) | 自前フロントで ①②③ | 全部 |
| 17 | **PC-15** パートナー GW | 契約が決まったパートナーから | PT |

PC-04 と PC-15 は顧客側の API・契約に依存するため、**着手は早く（データ契約表の作成）、完成は後**でよい。
