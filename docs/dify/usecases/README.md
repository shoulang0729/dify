# docs/dify/usecases — サービス別 Dify 実装リファレンス（42 件）

**1 サービス 1 ファイル。ファイル名＝管理番号**（`KN-02.md`）。雛形は [`_TEMPLATE.md`](./_TEMPLATE.md)、全体方針は [`../implementation-guide.md`](../implementation-guide.md)、共通部品は [`../platform-components.md`](../platform-components.md)、Outline は [`../outline-wiki-usecases.md`](../outline-wiki-usecases.md)。
一覧の元：`docs/handoff/service-index.md`（管理番号・成熟度・デモ画面タイプ）、`../feasibility-33-services.md` §2（実現性 ◎○△）、`docs/handoff/2026-09-06-partner-usecases.md` §5（PT 系の実現性）。

## 読み方

| 読む人 | 使い方 |
|---|---|
| **implementer** | 担当サービスのファイル → §4 Dify 構成 と §5 プロンプト を dsl-skill に渡す → §7 テストシナリオ を Langfuse データセットへ（`../implementation-guide.md` §5） |
| **reviewer** | §6 検証観点 と §7 の結果を PR で照合。§3 観点 が `../implementation-guide.md` §6 の共通ルールを弱めていないか。依存 PC の ID・名称が `../platform-components.md` と一致するか |
| **PM** | 各ファイルの §10 未確定・リスク と、下表の「依存 PC」から先行して作る部品を決める（`../platform-components.md` 末尾）。Outline 列は `../outline-wiki-usecases.md` §2 と同じ |

## 一覧

依存 PC は**固有のもの**だけ（PC-02 認証・PC-07 言語判定・PC-08 モデル・PC-09 評価・PC-10 個人情報・PC-16 本番 UI は全件共通のため省略）。
Outline：読＝KB ソース、書＝下書きを残す、（任意）＝各ファイル §9 で任意扱い、（候補）＝各ファイル §9 で「候補・未確定」、—＝使わない。各ファイル冒頭の「Outline Wiki」行と §9 を正として 2026-09-07 に突合済み。デモ画面タイプはモックの `TEMPLATES`（qa／upload／form／diff／lookup）。
ファイルへのリンクは writer の執筆完了前でも一覧を保つため先に置いてある（未作成のリンクは 404 になる）。

| 管理番号 | 名称 | 分類 | 成熟度 | 画面 | 実現性 | 依存 PC（固有） | Outline |
|---|---|---|---|---|---|---|---|
| [KN-01](./KN-01.md) | 技術ナレッジQA | KN/tech | 提供中 | qa | ◎ | PC-03 PC-05 PC-06 | 読 |
| [KN-02](./KN-02.md) | 設備マニュアル・取扱説明書の検索 | KN/tech | 提供中 | qa | ◎ | PC-03（OCR） PC-05 PC-11 PC-14（WeCom bot） | 読 |
| [KN-03](./KN-03.md) | 社内規程・就業規則QA | KN/rule | 提供中 | qa | ○ | PC-03 PC-05 PC-12（版ズレ） | 読・書（任意） |
| [KN-04](./KN-04.md) | 労務・総務の社内問い合わせ対応 | KN/rule | 試行版 | qa | ○ | PC-03 PC-04 PC-05 PC-14 | 読・書（FAQ） |
| [KN-05](./KN-05.md) | 当局通達の影響分析・マニュアル反映 | KN/rule | 試行版 | upload | ○ | PC-01 PC-03 PC-05 PC-11 PC-12 PC-13 PC-14 | 読・書（改訂案） |
| [QA-01](./QA-01.md) | 不具合原因分析・報告書（8D）作成 | QA/defect | 試行版 | upload | ○ | PC-01 PC-03 PC-04（QMS） PC-05 PC-06 PC-13 | 読 |
| [QA-02](./QA-02.md) | 変更点影響予測（4M変更管理） | QA/change | 構想 | diff | ○ | PC-01 PC-03 PC-04 PC-05 PC-12 PC-13 | 読 |
| [QA-03](./QA-03.md) | 顧客クレーム一次回答・分類 | QA/change | 試行版 | form | ○ | PC-01 PC-03 PC-04（Webhook／メール） PC-05 PC-11 PC-13 PC-14 | 読 |
| [QA-04](./QA-04.md) | 完成車メーカー工程監査への対応資料 | QA/change | 試行版 | upload | ○ | PC-01 PC-03 PC-04 PC-05 PC-13 PC-14 | 読・書（任意） |
| [DC-01](./DC-01.md) | 日本本社への報告資料作成 | DC/report | 提供中 | form | ◎ | PC-05 PC-13 | 読・書 |
| [DC-02](./DC-02.md) | 議事録作成と次回論点整理 | DC/report | 提供中 | upload | ◎ | PC-03 PC-05 PC-13 PC-14 | 読・書 |
| [DC-03](./DC-03.md) | 教育・OJT資料作成 | DC/site | 試行版 | upload | ◎ | PC-03 PC-05 PC-06 PC-13 | 読・書 |
| [DC-04](./DC-04.md) | 安全衛生・5S掲示物・改善提案の中国語化 | DC/site | 提供中 | upload | ◎ | PC-03 PC-05 PC-06 PC-13 | 読・書 |
| [DC-05](./DC-05.md) | 稟議・申請書の作成と記載漏れ検出 | DC/apply | 試行版 | form | ○ | PC-01 PC-04（BPMS） PC-05 PC-13 | 読・書 |
| [DC-06](./DC-06.md) | 輸出入・通関書類の確認 | DC/apply | 試行版 | upload | ○ | PC-03（OCR） PC-04（手冊台帳） PC-06 PC-12 PC-13 PC-14 | 読 |
| [DC-07](./DC-07.md) | サプライヤー契約書ドラフト支援 | DC/apply | 試行版 | form | ○ | PC-05 PC-06 PC-12 PC-13 PC-14 | 読・書 |
| [DC-08](./DC-08.md) | 週報・報告のレビューと論点指摘 | DC/report | 試行版 | upload | ○ | PC-01（`routine`/`due`） PC-03 PC-05 PC-06 PC-11 PC-13 PC-14 PC-17 | 読・書 |
| [LG-01](./LG-01.md) | 日中翻訳（社内の言い方に揃える） | LG/trans | 提供中 | form | ◎ | PC-05 PC-06 | 読（用語集）・書（登録候補） |
| [LG-02](./LG-02.md) | 社内用語・呼称の統一（用語集） | LG/trans | 試行版 | upload | ○ | PC-03 PC-05 PC-06 PC-13 | 読・書 |
| [LG-03](./LG-03.md) | 現地スタッフとの認識合わせ（手順の中国語書き下し） | LG/align | 試行版 | form | ◎ | PC-01 PC-05 PC-06 PC-11 PC-13 | 読・書 |
| [LG-04](./LG-04.md) | ビジネスメール作成（日中往復） | LG/align | 提供中 | form | ◎ | PC-06 PC-14（メール） | — |
| [NM-01](./NM-01.md) | 見積り・原価計算 | NM/cost | 構想 | form | △ | PC-04（原価テーブル） PC-06 PC-13 | 読 |
| [NM-02](./NM-02.md) | 購買見積の比較 | NM/cost | 試行版 | upload | ○ | PC-03 PC-04 PC-06 PC-13 | 読 |
| [NM-03](./NM-03.md) | 日報・実績の集計と要約 | NM/actual | 提供中 | upload | ◎ | PC-03 PC-06 PC-11 PC-13 PC-14 | 読・書（候補） |
| [NM-04](./NM-04.md) | 在庫・納期の問い合わせ回答 | NM/actual | 試行版 | lookup | △ | PC-04（ERP/WMS） PC-05 PC-14 | 読 |
| [NM-05](./NM-05.md) | データ分析アシスタント | NM/actual | 試行版 | lookup | △ | PC-04（DB） PC-05 PC-13 | 読 |
| [EN-01](./EN-01.md) | 仕様改訂の差分検出・取引先用語対応 | EN/spec | 試行版 | diff | ○ | PC-03（MinerU） PC-05 PC-06 PC-12 PC-13 | 読・書（候補） |
| [EN-02](./EN-02.md) | BOM逆引き | EN/bom | 試行版 | lookup | △ | PC-04（ERP/MES） PC-05 PC-13 PC-14 | 読 |
| [EN-03](./EN-03.md) | 図面の類似検索 | EN/bom | 構想 | upload | △ | PC-03（図面 OCR） PC-04 | 読 |
| [GN-01](./GN-01.md) | 経費精算チェック | GN/office | 提供中 | upload | ○ | PC-03（OCR） PC-04（履歴） PC-05 PC-13 PC-14 | 読 |
| [GN-02](./GN-02.md) | 請求書（発票）処理 | GN/office | 提供中 | upload | ○ | PC-03 PC-04 PC-05 PC-11 PC-13 | 読 |
| [GN-03](./GN-03.md) | 受注・発注書の読み取りと登録支援 | GN/office | 試行版 | upload | ○ | PC-01 PC-03 PC-04 PC-05 PC-06 PC-11 PC-13 | 読 |
| [GN-04](./GN-04.md) | スケジュール調整 | GN/daily | 試行版 | qa | △ | PC-04（カレンダー） PC-05 PC-14 | 読 |
| [GN-05](./GN-05.md) | 文書要約 | GN/daily | 提供中 | upload | ◎ | PC-03 PC-05 PC-06 PC-13 | 読・書（候補） |
| [PT-01](./PT-01.md) | 取引先・サプライヤーの与信・リスク監視 | PT/data | 試行版 | lookup | ○ | PC-01 PC-05 PC-11 PC-12 PC-14 PC-15 | 読・書 |
| [PT-02](./PT-02.md) | 業界・材料相場リサーチ（本社報告の外部根拠） | PT/data | 試行版 | form | ○ | PC-05 PC-06 PC-11 PC-13 PC-15 | 読・書 |
| [PT-03](./PT-03.md) | 業界誌・技術記事アーカイブの横断検索 | PT/data | 試行版 | qa | ○ | PC-05（任意） PC-06 PC-13 PC-15 | 読・書 |
| [PT-04](./PT-04.md) | 現地給与水準の照会と給与改定の妥当性確認 | PT/data | 構想 | lookup | △ | PC-04 PC-05 PC-13 PC-15（PIPL 設計が本体） | 読 |
| [PT-05](./PT-05.md) | 現地技術者・管理職の採用支援 | PT/service | 構想 | upload | △ | PC-01 PC-03 PC-04 PC-13 PC-14 PC-15（PIPL） | 読・書（求人票のみ） |
| [PT-06](./PT-06.md) | 戦略購買の立案 | PT/service | 構想 | upload | △ | PC-01 PC-03 PC-04 PC-05 PC-06 PC-13 PC-14 PC-15 | 読・書 |
| [PT-07](./PT-07.md) | RFQ 起草と購買代行への引き継ぎ | PT/service | 構想 | form | △ | PC-01 PC-04 PC-05 PC-06 PC-11 PC-13 PC-14 PC-15 | 読・書 |
| [PT-08](./PT-08.md) | 研修プログラム化と実施代行・受講管理 | PT/service | 構想 | form | ○ | PC-01 PC-03 PC-04 PC-05（教材） PC-11 PC-13 PC-14 PC-15 | 読・書 |

### 集計

| 軸 | 内訳 |
|---|---|
| 成熟度 | 提供中 **12**／試行版 **22**／構想 **8** |
| 画面タイプ | qa 6／upload 18／form 11／diff 2／lookup 5 |
| 実現性 | ◎ 11／○ 21（33 件中 16 ＋ PT 4 ＋ DC-08）／△ 10（33 件中 6 ＋ PT 4）／× 0 |
| Outline | 読 41／書 24（確定 19・任意 2〔KN-03 QA-04〕・候補 3〔NM-03 EN-01 GN-05〕）／使わない 1（LG-04） |
| 依存の多い PC（固有分） | PC-05 Outline 35、PC-13 ファイル出力 32、PC-03 文書取込 26、PC-04 業務連携 22、PC-06 用語集 21、PC-14 通知 20 |

## 依存 PC の逆引き（どの部品が何件を解放するか）

`../platform-components.md` 末尾「先行して作る順」の根拠。共通 6（PC-02 07 08 09 10 16）は全 42 件。

| PC | 件数 | サービス |
|---|---|---|
| PC-01 フィードストア | 14 | KN-05 QA-01〜04 DC-05 LG-03 GN-03 PT-01 PT-05〜08 DC-08 |
| PC-03 文書取込パイプライン | 26 | KN-01〜05 QA-01〜04 DC-02〜04 DC-06 LG-02 NM-02 NM-03 EN-01 EN-03 GN-01〜03 GN-05 PT-05 PT-06 PT-08 DC-08 |
| PC-04 業務システム連携 | 22 | KN-04 QA-01〜04 DC-05 DC-06 NM-01 NM-02 NM-04 NM-05 EN-02 EN-03 GN-01〜04 PT-04〜08 |
| PC-05 Outline Wiki 連携 | 35 | KN-01〜05 QA-01〜04 DC-01〜05 DC-07 LG-01〜03 NM-04 NM-05 EN-01 EN-02 GN-01〜05 PT-01〜04 PT-06〜08 DC-08 |
| PC-06 用語集・翻訳メモリ | 21 | KN-01 QA-01 DC-03 DC-04 DC-06 DC-07 LG-01〜04 NM-01〜03 EN-01 GN-03 GN-05 PT-02 PT-03 PT-06 PT-07 DC-08 |
| PC-11 スケジューラ | 12 | KN-02 KN-05 QA-03 LG-03 NM-03 GN-02 GN-03 PT-01 PT-02 PT-07 PT-08 DC-08 |
| PC-12 差分検出エンジン | 7 | KN-03 KN-05 QA-02 DC-06 DC-07 EN-01 PT-01 |
| PC-13 ファイル出力 | 32 | KN-05 QA-01〜04 DC-01〜07 LG-02 LG-03 NM-01〜03 NM-05 EN-01 EN-02 GN-01〜03 GN-05 PT-02〜08 DC-08 |
| PC-14 通知チャネル | 20 | KN-02 KN-04 KN-05 QA-03 QA-04 DC-02 DC-06 DC-07 LG-04 NM-03 NM-04 EN-02 GN-01 GN-04 PT-01 PT-05〜08 DC-08 |
| PC-15 パートナー連携ゲートウェイ | 8 | PT-01〜08 |
| PC-17 指摘・回答台帳 | 1 | DC-08 |

## 実装の波（`../implementation-guide.md` §3）との対応

| 波 | 管理番号 | 先に要る PC |
|---|---|---|
| W1 提供中・KB のみ | KN-01 KN-02 GN-05 LG-01 DC-04 LG-04 DC-01 DC-02 | 共通 6 の最低限 ＋ PC-03（手動）PC-06（初期用語） |
| W2 提供中・データ整備 | KN-03 NM-03 GN-01 GN-02 | ＋ PC-02（HR 帯）PC-03（OCR）PC-11 PC-13 |
| W3 試行版・文書系 | KN-04 KN-05 QA-01 QA-04 DC-03 DC-05 DC-08 DC-07 LG-02 LG-03 EN-01 NM-02 GN-03 | ＋ PC-05 PC-12 PC-14 PC-01 |
| W4 試行版・システム連携 | QA-03 DC-06 NM-04 NM-05 EN-02 GN-04 PT-01 PT-02 PT-03 | ＋ PC-04 PC-15 |
| W5 構想 | QA-02 NM-01 EN-03 PT-04 PT-05 PT-06 PT-07 PT-08 | ＋ 顧客判断・契約（DSL は雛形まで） |

## 分類別の共通事項（writer 向け）

同じ分類のファイル間で食い違いやすい点。`_TEMPLATE.md` の §3 観点・§8 別出し・§9 Outline を書く前に確認する。

| 分類 | KB の帯（PC-02） | 分類で共通の観点（§3） | 分類で共通の別出し（§8） |
|---|---|---|---|
| **KN** ナレッジ | 技術／HR（KN-03 KN-04）／全社 | 根拠の文書番号・版・ページを必ず引く。版が違えば両方を示す。クロスリンガル（zh 質問 → ja 文書）は `bge-m3`＋リランク | Outline 同期（PC-05）、版メタデータ（PC-03）、WeCom bot（PC-14） |
| **QA** 品質 | 品質 | 顧客名・不良数値は入力から転記のみ。原因は「仮説」と明示。8D・ECR は**ドラフト** | QMS Webhook（PC-04）、フィード `due`（PC-01）、8D 様式（PC-13） |
| **DC** 文書 | 全社／購買（DC-07） | 社内様式に合わせた見出し。日本語品質（DC-01）。契約は法的助言ではない注記 | 様式テンプレート（PC-13）、議事録・教材の下書き先（PC-05）、BPMS（PC-04） |
| **LG** 日中 | 全社 | 用語集を最優先（PC-06）。敬語・現場語のレジスタ指定。原文の数値・型番は改変しない | 用語集の正本と更新責任（PC-06）、翻訳メモリ |
| **NM** 数字 | 購買／製造 | **数値は Code で計算**、LLM は説明のみ。出典（日報・見積・DB）と取得時点を表示 | 日報の置き場と定例（PC-11）、ERP/DB API（PC-04）、Excel 出力（PC-13） |
| **EN** 図面 | 技術 | 差分は機械的に取り、影響は「候補」として提示。図面・BOM は社外秘（PC-10） | `diff-core`（PC-12）、MinerU／図面 OCR（PC-03）、ERP/MES（PC-04） |
| **GN** 汎用 | 全社／経理（GN-01 GN-02） | 発票・経費は個人情報を含む（PC-10）。基幹への登録は CSV 出力まで | PaddleOCR（PC-03）、精算履歴・基幹 API（PC-04）、カレンダー（GN-04） |
| **PT** パートナー | 購買／HR（PT-04 PT-05 PT-08） | 「送信したもの／送信していないもの」を結果に明示（PT-10）。発注・採用判断は当社。出典・取得時点を表示 | パートナー GW（PC-15）、契約前はモック応答、PIPL 設計（PC-10） |

## 画面タイプ → Dify 構成の定石

`_TEMPLATE.md` §4 を書くときの出発点。詳細は `../feasibility-33-services.md` §2 と `../templates/README.md`。

| 画面 | アプリ種別 | 骨子 | 参照 DSL | 本番 UI（PC-16）の呼び方 |
|---|---|---|---|---|
| qa | Chatflow | Start → 言語判定（PC-07）→ Knowledge Retrieval（帯 KB・メタデータ）→ LLM（引用付き）→ Answer | `templates/03` | `POST /v1/chat-messages`（ストリーミング） |
| upload | Workflow | Start(file-list) → Document Extractor／MinerU／PaddleOCR → （iteration）→ LLM → Code 整形 → End(JSON) | `templates/07` `08` `02` | `POST /v1/files/upload` → `POST /v1/workflows/run` |
| form | Workflow | Start(inputs) → Code 検証 → Knowledge Retrieval（書式・規程・用語）→ LLM×n → Template → End | `templates/01` `05` | `POST /v1/workflows/run` |
| diff | Workflow | Start(file×2) → 抽出×2 → Code diff（PC-12）→ Knowledge Retrieval（影響索引）→ LLM 意味づけ → End(表) | `templates/04` | `POST /v1/files/upload`×2 → `POST /v1/workflows/run` |
| lookup | Workflow／Chatflow | Start(query) → Parameter Extractor → http-request（PC-04／PC-15）→ Code → LLM 解説 → End(表) | `templates/06` | `POST /v1/workflows/run` |

End の JSON はモックの `Result` 型（`title` ＋ `items[]` または `columns[]+rows[][]`）に合わせる。

## 追加・変更のルール

1. **管理番号＝ファイル名**。採番は `docs/handoff/service-index.md`「次に採番するとき」に従う（分類内の最大番号 +1、永久欠番）。管理番号は PM 承認後に付ける（Outline 由来の案は `../outline-wiki-usecases.md` の `OW-xx` のまま置く）
2. 新規は `_TEMPLATE.md` をコピーし、**10 節すべて**を残す（書けない節は「未確定」と書く。節を消さない）
3. プラグイン・URL は `../plugins-and-references.md` に載っているものだけ。共通部品は `../platform-components.md` の **PC-01〜16 の ID と名称**で参照する（新しい PC が要るときは architect が `platform-components.md` に追加してから）
4. テストシナリオの ID は `<管理番号> T<2 桁>`、6 種別（正常 ja／正常 zh／境界／異常／言語混在／安全）を各 1 件以上（`../implementation-guide.md` §5）
5. **実データ・実名・顧客名・秘密情報を書かない**（仮社名は 青嶺精工。`CLAUDE.md` §2-10）。パートナーは役割名のみ（PT-8）
6. 成熟度・名称・分類を変えるのは**モックのデータ層（`SVCS`）が正**。このディレクトリで先に変えない。モック側の変更が squash マージされたら本表を追従させる
7. このディレクトリは `tools/verify.mjs`／`tools/regress.mjs` の検証対象外。reviewer は「`docs/handoff/**` が変わっていないこと」「PC の ID・名称が `platform-components.md` と一致すること」を diff で見る

## writer／reviewer チェックリスト（1 ファイルにつき）

- [ ] 表頭の 管理番号／内部 id／名称 3 言語／分類／成熟度／画面 が `docs/handoff/service-index.md` と一致
- [ ] §1 に ③ の `kind`（due／routine／notify）のどれで始まるかが書いてある
- [ ] §2 の各インプットに 取得元 と 前処理（PC-03／PC-04 のどちらに頼むか）がある
- [ ] §3 に「根拠を引く」「推測で数値を作らない」「登録しない」が**弱められていない**
- [ ] §4 のプラグインが `../plugins-and-references.md` にある名前（GitHub ディレクトリ名）で書かれている
- [ ] §5 の System に `implementation-guide.md` §6 の共通ルール（言語・根拠・数値・定型文・PIPL）が含まれる
- [ ] §7 が 5 件以上、6 種別を網羅、ID が `<管理番号> Txx`
- [ ] §8 の PC が本表の「依存 PC」と一致（違うなら本表を直す PR を別に出す）
- [ ] §9 の Outline の扱いが本表・`../outline-wiki-usecases.md` §2 と一致
- [ ] 実データ・実名・URL の捏造・秘密情報が無い
