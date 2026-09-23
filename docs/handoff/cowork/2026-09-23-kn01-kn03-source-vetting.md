# KN-03 社内規程 QA と KN-01 技術ナレッジ QA — 「悪いデータから悪い答えを出さない」見極めの磨き上げ（Cowork 手渡しメモ）

- 目的：有識者の指摘「情報が残らない・間違っている・派生版が多い」「データ自体を見極める仕組み」に対し、提供中の 2 本（KN-03・KN-01）の台本と実装リファレンスを、世間の見せ方と比べて強くする
- 触ったファイル：
  - `mock/js/data/scenarios/mfg/kn.js` の `kn1`（`steps`[2] ja/zh/en、`script` ja/zh の [0]）と `kn3`（`steps`[2] ja/zh/en、`script` ja/zh の [0]）。他のターン・`persona`・他サービスは触っていない
  - `docs/dify/usecases/KN-03.md`・`KN-01.md`（末尾に §11 の追記案。既存の §1〜§10 は触っていない）
  - 本メモ
  - 触っていない：`dify/apps/**`（実機 DSL）・`dify/kb/**`・`data/world/**`・`docs/demo/**`
- 変更の要約：KN-03・KN-01／`qa`／ターン数は 3 のまま
  1. **「日付が新しいから正」をやめた。**旧 kn1 は「日付の新しい現行版（Rev.D）を正として採用」と書いていた。KN-11 の台本（いちばん新しいのは発言だが、正は審査を通った Rev.C）と主張が逆になり、デモの筋として矛盾していた。新台本は**文書に書かれた根拠**（旧版の冒頭「現行版は Rev.D。実務の判断には使用しない」）で正を決め、理由を言う
  2. kn1 で旧版の文書番号 **WS-QC-031** を名指しし（`calendar.md` と `dify/kb/KN-01/` に既存）、**条件は技術報告から、測り方は作業標準書から**と根拠の役割を分けた
  3. kn3 で **3 つの版**（中国語版 現行 2025-01／日本語版 2023-07／中国語版 旧版 2023-07・参考保管。どれも `dify/kb/KN-03/` に実在）を並べ、正とした理由を 3 点（改定履歴・正本言語の注記・旧版の冒頭）で示した
  4. kn3 で **「文書からは確認できないこと」**を言わせた：現行版の承認・周知（公示）の記録は KB の文書に無い（版日付と管理部門だけ）。正式回答の前に周知済みか確認を、と促す。**分からないことを分からないと言う**実演
  5. 規程番号 `RULE-01`（`documents.csv`）・文書番号 `WS-QC-031` 以外の新しい番号は無い
- 画面案：なし（KN-03.md §11-2 の「根拠カード」は、実装時に `qa` テンプレートの応答表示の案になる。M/L レーン）
- 提案（新サービス候補）：なし。**実機プロンプトの改善案**は §3
- 検証：`node tools/verify.mjs` → PASS（ALL PASS / 17 warn。変更前と同数）

## 1. 比べてわかったこと

| 見せる要素 | kn3（変更前） | kn1（変更前） | 世間の例 | 足したもの |
|---|---|---|---|---|
| 版・日付 | ○（ja/zh の版日付） | △（Rev のみ、文書番号なし） | 検証済みバッジ・検証者・検証日を出す［3］［4］ | 文書番号・3 版の並記 |
| **正とした理由** | △（「中国語版が正」のみ） | ×（「日付が新しいから」） | 誤った文書を渡すと LLM は正しい知識を 60% 超の割合で捨てる。**微妙な誤りほど採用されやすい**［5］ | 文書に書かれた根拠で理由を言う |
| 承認状態 | × | × | 状態（下書き／公開／廃止）と施行日・失効日がいちばん大事なメタデータ［8］。検索の前に状態で絞る［1］［7］ | kn3 で「承認・周知の記録なし」と明言。実装は KN-03.md §11-1 |
| 旧版・重複の扱い | ○（日本語版の遅れ） | ○（旧版は過去記録用） | 旧版は論理削除で残し、`version_id`・ハッシュで重複を防ぐ［7］ | 旧版を**消さずに状態で分ける**契約（§11-5） |
| 分からないとき | 定型文あり（実機） | — | 規程にない質問に作り話をしなくなった事例［9］。行政ガイドラインも「出力の適切さは人が判断」［11］ | 「承認済みの規程に無い／一般の法令で補わない」定型文 |
| 出典の開き方 | 引用文 | 報告書番号 | 本文中の番号 → 原典をサイドで開く［10］ | 実装 UI の案（KN-03.md §11-2） |

**誤答の責任**：航空会社のチャットボットが規程と違う案内をし、会社の責任が認められた例［12］、行政のチャットボットが違法な助言をした例［13］がある。どちらも「正しいページへのリンクを添えていた」「免責文があった」では済んでいない。**リンクを付けるだけでなく、どの版を正とし、何が確認できていないかを文で言う**のが今回の変更の主眼。

## 2. 実装リファレンスの「KB の鮮度・重複の扱い」は実務に足りるか

- **KN-03**：`version_date`・`archived=true`・ja/zh 突合（`PC-12` 軽量版）はある。**足りないのは** ① 下書きの区別（`status`）② 施行日 ③ 承認・周知 ④ 正本言語を列で持つこと（いまは System に「中国語版を正」と固定で書いてある）⑤ 理由が決まらないときに選ばない規則。→ KN-03.md §11
- **KN-01**：版と状態のメタデータが**無い**（`doc_no` `year` 等のみ）。技術報告に見直し期限が無く、古い報告が新しい報告と同じ重みで出る。→ KN-01.md §11
- **`PC-05`（Outline 連携）**：同期時に旧版を消すと「旧版も残っていました」が言えなくなる。`status=superseded` へ移す規則が要る
- **`PC-12`（差分検出）**：ja/zh の数値差に加え、「現行なのに承認・周知が空」「施行日が未来」を定期的に一覧にする（検証済みカードの再検証キュー［3］［4］と同じ発想）

## 3. 実機プロンプトの改善案（`dify/apps/**` は Cowork では触らない。取り込み時に architect が判断）

KN-03 System（`docs/dify/usecases/KN-03.md` §5-1 と同じ内容が実機にある前提）への差分案：

- ルール 3 の「現地スタッフへの回答は中国語版を正とする」を、`<meta>` で渡す `authoritative_lang` を見る形に変える
- 追加：「正とした版と、その理由を書く。理由は『旧版に置き換えの記載がある』『正本言語』『承認済みの新しい版』のいずれか。**改訂日が新しいことだけを理由にしない**。どれにも当たらないときは両方を並べ、どちらも採らない」
- 追加：「承認日・周知日が <meta> に無い版は『承認：記録なし』『周知：記録なし』と書く。空欄を承認済みと読み替えない」
- 追加（KN-01）：「条件の数値の根拠と、手順・測り方の根拠を分けて書く。技術報告どうしで値が違うときは合成せず並べる」
- テスト：KN-03.md §11-6・KN-01.md §11-4 の T11〜T13

## 4. docs/demo/faq.md を強くする材料（**本文は書き換えていない**）

- **Q1（間違っていたら）**に足す一文案：「根拠の文書名・版・日付に加えて、**なぜその版を正としたか**も書きます。『日付が新しいから』だけでは決めません。古い版や下書きが混ざっていても取り違えないためです。」
- **Q2（情報が足りないとき）**に足す一文案：「文書に書かれていないこと——たとえば、その版が承認・周知済みかどうか——は、**書かれていないと答えます**。一般的な法令の説明で補うこともしません。」
- **Q29（古い版が残っていたら）**との整合：Q29 の答えは KN-03 の「版ズレを示す」までで止まっているはず。上の Q1 の文と揃える（取り込み時に確認）
- 口頭で使える例（顧客資料には書かない）：チャットボットの誤った案内で会社の責任が認められた海外の例［12］。「リンクを添えていても、利用者に照合までは求められない」と判断された

## 5. PM 判断が要る点

1. **kn1 の出典番号が世界マスタと食い違っている（重要。まさに「悪いデータ」）**：
   - `NC-2024-0118` は `records.csv` では「2024-11-18・金型 D-118・冷間時の位置ずれ」（KN-11 はこちら）。kn1 と dc3 では「2024/3・ライン 2・ドリル折損」として使われている。**幕 2 の KN-11 と同じ番号が別の不具合を指す**
   - `TR-2023-041`（生産終了品の金型保管方針）・`TR-2024-102`（塗装治具の寸法流用検討）は、kn1 では SUS304 深穴ドリルの条件の根拠として引かれている。`dify/kb/KN-01/作業標準書_寸法検査.md` は TR-2024-102 を「工具交換基準」としていて、3 か所で意味が違う
   - `check-world.mjs` は番号の書式しか見ないので検出されない。**推奨**：深穴ドリル用の技術報告・不具合を `records.csv` に新しい番号で足し（例：`TR-2024-0NN`・`NC-2024-0NNN`。採番は取り込み時）、kn1・dc3・`dify/kb/KN-01/**`・`dify/tests/KN-01.json` を差し替える。KB とテストに及ぶので `run:cloud` の別 Issue にする。**今回の台本では番号を触っていない**
   - あわせて `check-world.mjs` に「同じ番号の件名が台本間で違う」検査（W10）を足すかどうか
2. `dify/kb/KN-01/作業標準書_寸法検査.md` の Rev.D の日付が **2026-06-25**、世界の「今日」は 2025 年 9 月前後（`calendar.md`）。実機 KB は 2026 年で書かれている可能性があるので、どちらに揃えるか。台本には日付を出さないでおいた
3. kn3 の 2 往復目「法定基準（日給の 200%）」：中国の年休の未消化手当は「日給の 300%（通常の賃金を含む）」と説明されることが多い。KB（`员工手册_摘录_中文版.md` 第 23 条 4 項）どおりなので台本は変えていないが、**顧客が労務の専門家だと突っ込まれる**。架空の社内規程として「会社独自の精算」にするか、法令の言い方に合わせるか（弁護士・労務の確認事項。私の結論ではない）
4. kn3 が「周知の記録なし」と言う形にしたので、KB の规程に周知日を書き足して「周知：2025-01-xx」と言わせる版にするか（KB 側の変更は別 Issue）

## 参照（取得日はすべて 2026-09-23）

1. AWS「Amazon Bedrock Knowledge Bases now supports metadata filtering」 https://aws.amazon.com/blogs/machine-learning/amazon-bedrock-knowledge-bases-now-supports-metadata-filtering-to-improve-retrieval-accuracy
2. Microsoft Learn「Azure AI Search: Scoring profiles with semantic ranking」 https://learn.microsoft.com/azure/search/semantic-how-to-enable-scoring-profiles
3. Glean Help「How Verification Works」 https://docs.glean.com/user-guide/knowledge/verification/how-verification-works
4. Guru「How Content is Verified in Guru」 https://help.getguru.com/docs/verifying-and-unverifying-cards
5. ClashEval（arXiv 2404.10198） https://arxiv.org/abs/2404.10198v2
6. Seeing through the Conflict: Transparent Knowledge Conflict Handling in RAG https://arxiv.org/html/2601.06842v1
7. JavaGuide「RAG 知识库文档如何更新」 https://javaguide.cn/ai/rag/rag-knowledge-update.html
8. 53AI「企业知识库里的元数据，到底应该怎么用？」 https://www.53ai.com/news/zhishiguanli/2026052737860.html
9. DIVX「RAG で答えます！社内規程を活用した AI チャットボットの改善」 https://www.divx.co.jp/media/238
10. Microsoft Support「Control and review sources of Copilot Chat's responses」 https://support.microsoft.com/en-us/microsoft-365-copilot/control-review-sources-copilot-chat
11. デジタル庁「生成 AI の調達・利活用に係るガイドライン（DS-920）」 https://www.digital.go.jp/assets/contents/node/basic_page/field_ref_resources/e2a06143-ed29-4f1d-9c31-0f06fca67afc/80419aea/20250527_resources_standard_guidelines_guideline_01.pdf
12. ABA「BC Tribunal Confirms Companies Remain Liable for Information Provided by AI Chatbot」 https://www.americanbar.org/groups/business_law/resources/business-law-today/2024-february/bc-tribunal-confirms-companies-remain-liable-information-provided-ai-chatbot/
13. The Markup「NYC's AI Chatbot Tells Businesses to Break the Law」 https://themarkup.org/artificial-intelligence/2024/03/29/nycs-ai-chatbot-tells-businesses-to-break-the-law
14. 厚生労働省「就業規則の周知（Q8）」 https://www.startup-roudou.mhlw.go.jp/qa/zigyonushi/syuugyoukisoku/q8.html
15. 江苏云崖律师事务所「劳动合同法第四条关于规章制度的要求」 https://www.yunya.com.cn/news/352.html
