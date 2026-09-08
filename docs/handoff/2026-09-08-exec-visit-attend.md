# 幹部来訪・出張アテンドの段取り管理（GN-07）— 設計書

- 日付：2026-09-08
- レーン：**M**（データ層 `SVCS`／`TAGS` に触る・台本を 2 業種ぶん追加・`data/world/` を両業種で拡張・`docs/dify/` に新規共通部品 1 個。共通レイヤーの契約・トークン・描画ロジックには触らない）
- Issue：**#132**（PM 起票。本書への追記案は `docs/handoff/2026-09-08-exec-visit-attend.issue.md`）
- お題（PM の言葉）：海外駐在員が担う「幹部出張のアテンド調整」。到着・出迎え・社用車・会食（稟議のための出席者整理と略歴交換）・移動のロジ・**仕向け**の記録・緊急連絡先・会社契約ホテルの 3 言語表記を、**状況が逐次決まっていくのに追随して記録し、常に最新の予定表を内外に配る**。Outlook に一括取り込みできるファイルも出す
- 前提設計書：
  - `docs/handoff/2026-09-08-finance-catalog.md`（**業種横断サービスの持ち方＝`industries`／1 サービス 1 番号／台本の業種 2 階層**。本書はこの枠組みにそのまま乗る）
  - `docs/handoff/2026-09-07-usecase-intake.md` §3-1（統廃合 5 軸）
  - `docs/handoff/2026-09-07-repo-layout-v2.md` §2（`data/world` の作法）
  - `CLAUDE.md` §2-1／§2-3／§2-9／§2-11／§2-13

---

## 0. 結論（1 画面分）

| 決めたこと | 結論 |
|---|---|
| 新規で立てるか | **新規 1 件で立てる**。既存 66 件のどれとも 5 軸が重ならない（§1） |
| 管理番号 | **`GN-07`**（内部 id `gn7`）。GN 分類の通番、業種を跨いだ連番（§2-1） |
| 分類 / 中分類 | `GN` 汎用業務支援 / `GN/daily` 日常業務（**`CATS` は 1 行も変えない**） |
| 業種 | **業種横断 `['mfg','fin']`**（PM 確定） |
| 成熟度 | **`st: 3`（構想）**。Dify 単体では成立せず、新しい共通部品（PC-18）が要るため（§5） |
| タグ | 既存 `calendar` ＋ **新規 `travel` 1 個**（§2-3） |
| デモ画面 | **`form` 1 本**（両業種とも）。テンプレートは増設しない。2 サービスに割らない（§3） |
| 「逐次更新」の見せ方 | 入力パネル＝案件登録／結果パネル＝**予定表 v1**（表）／チャット 3 往復で **v2 → v3** と版が上がる（§3-3） |
| 基礎データ | `data/world/<業種>/` に **`hotels.csv` / `vehicles.csv` / `airports.csv` / `routes.csv` / `contacts.csv` の 5 本**を新設（両業種）。3 言語は**列で持つ**（§4） |
| 実在名 | **空港名・IATA コード・地名は実在のものを使ってよい**。ホテル名・旅行会社名・航空会社名・便名は**書かない／架空**（§4-5） |
| 状態管理 | **新規共通部品 `PC-18 出張案件ストア`** を 1 個立てる。既存 PC-01 では足りない。`PC-13 ファイル出力`に **ICS** を追記（§5） |
| Outlook 取り込み | **ICS を第一、CSV を補助**（§5-4） |
| 「仕向け」 | **PM 確認済み（2026-09-08）**：会食が当社→相手／相手→当社／折半のどれか。費用負担側と稟議の出席者の並べ方が変わる（§2-5） |
| PR 分割 | **5 本**（§7）。うち PR-2 と PR-5 は他と並列可 |

### 0-1. 本書の文言分担（重要）

`2026-09-08-finance-catalog.md` §0-3 と同じ分担にする。

- **3 言語（ja/zh/en）を本書で確定する**：サービスの `name` / `desc`、新規タグ `travel`、台本の `steps`（4 本 × 2 業種）、`data/world` の 3 言語カラムのうち**ホテル名・空港名・車両ラベル・連絡先ラベル**
- **ja だけ本書に骨子を書き、zh を implementer が ja を原文に作る**：台本の `script`（3 往復 × 2 業種）・`input.fields`・`result` の中身。**分量が本書の可読性を超えるため**。`script` / `input` / `result` は §2-5 のとおり **ja/zh のみ**（en は不要）
- この分担が不可なら PM が差し戻すこと（§10 #3）

---

## 1. §A 位置づけと統廃合（5 軸判定）

`docs/handoff/2026-09-07-usecase-intake.md` §3-1 の 5 軸（分類・タグ・ペルソナ・入出力・出口）で、既存 66 件のうち近いもの 6 件と突き合わせた。

| 既存 | 分類 | タグ | ペルソナ | 入出力 | 出口 | 一致軸 |
|---|---|---|---|---|---|---|
| **GN-04** スケジュール調整 | ○ 同じ `GN/daily` | ○ `calendar` 一致 | ○ 同じ（管理部 総務・人事 駐在員） | ✕ 入＝参加者と制約／出＝候補日時＋招集メール。**1 回で完結する単発の調整** | ✕ 招集メールを送って終わり | **3 / 5** |
| **GN-06** 頼まれ事・放置業務の追跡 | ○ 同じ `GN/daily` | ✕ `calendar`+`kpi` | ✕ 同じ人だが「振られた側」の視点 | ✕ 入＝1 件の依頼／出＝票 1 枚 | ✕ フィードへの登録 | 1 / 5 |
| **DC-05** 稟議・申請書の作成と記載漏れ検出 | ✕ `DC/apply` | ✕ `approval` | ✕ 起案者 | ✕ 入＝目的と条件／出＝稟議書 | ✕ 承認ルートへ | 0 / 5 |
| **DC-09** 議案・報告書・提案書のドラフト作成 | ✕ `DC/report` | ✕ | ✕ | ✕ | ✕ | 0 / 5 |
| **DC-02** 議事録作成と次回論点整理 | ✕ `DC/report` | △ `meeting` | ✕ 秘書・通訳 | ✕ 入＝録音／出＝議事録 | ✕ | 1 / 5 |
| **PT-06/07** 購買代行への引き継ぎ | ✕ `PT/service` | ✕ | ✕ | △ 外部業者への発注という点だけ似る | ✕ | 0 / 5 |

**判定**：一致 3 軸が最大（GN-04）。`usecase-intake` §3-1 の閾値（**4 軸以上一致＝統合、3 軸以下＝別サービス**）に照らして **新規 1 件で立てる**。

### 1-1. GN-04 との境界（実装リファレンスにも書く）

| | GN-04 スケジュール調整 | **GN-07（本件）** |
|---|---|---|
| 単位 | **会議 1 件** | **来訪・出張 1 案件**（複数日・複数の予定・複数の関係者） |
| 状態 | 持たない（毎回ゼロから） | **持つ**（案件に事実が積み上がる。版が上がる） |
| 出口 | 招集メール 1 通 | 予定表の**版**を内外に配り続ける／ICS |
| 関係 | **GN-07 は GN-04 を呼ぶ**（案件の中で会議 1 件の日程を詰めるときは GN-04 の候補算出をそのまま使う。重複実装しない） | |

### 1-2. 会食の出席者整理は DC-05／DC-09 に統合しない（根拠）

PM の依頼にある「会食のときは双方の部署・役職・氏名を稟議のために整理」は、**稟議の入力**であって稟議そのものではない。

- **分けるべき理由**：(1) 出口が違う（GN-07 ＝ 予定表と配布／DC-05 ＝ 稟議書という文書）。(2) ペルソナが違う（受入担当の駐在員／稟議の起案者）。(3) 出席者は**案件の事実の 1 つ**で、会食が中止になれば予定表と同じ版管理に乗る。DC-05 側に置くと**同じ事実が 2 か所で管理される**（§5 の「状態は 1 か所」に反する）
- **つなぎ方**：GN-07 は「稟議添付用の出席者表」を**構造化データ（JSON）**で出し、DC-05（製造業）／DC-09（金融）の入力にする。GN-07 は稟議書そのものを書かない
- したがって **DC-05 / DC-09 は本 Issue では 1 バイトも変えない**（§9）。連携は両者の実装リファレンス §8 に 1 行ずつ足すだけ（PR-5）

### 1-3. 「ハイヤー手配」を PT（パートナー連携）に立てない（根拠）

旅行会社手配のハイヤーは**移動手段の選択肢の 1 つ**であって、PT-01〜08 のような「外部サービスを使う独立したエージェント」ではない。`PT` 分類は `industries: ['mfg']` のみで、業種横断にできない。→ GN-07 の中で `vehicles.csv` の `kind: charter` として扱う（§4-2）。

---

## 2. サービス定義（データ層に入れる値）

### 2-1. 管理番号

`GN` 分類の既存最大は `gn6`（GN-06）→ **`gn7` ＝ `GN-07`**。`CLAUDE.md` §2-11 のとおり通番は**分類内の追加順で、業種を跨いだ連番**（`gn6` が既に `['mfg','fin']` の業種横断で、番号は 1 つ）。

### 2-2. `SVCS` に追加する 1 件（`mock/js/data/catalog.js`、`gn6` の直後）

| キー | 値 |
|---|---|
| `id` | `gn7` |
| `cat` / `sub` | `gn` / `daily` |
| `st` | `3`（構想） |
| `industries` | `['mfg', 'fin']` |
| `tags` | `['calendar', 'travel']` |
| `added` | `'2026-09-08'`（NEW バッジ・②新着帯・③お知らせが `NEW_DAYS = 30` の間だけ自動で出る。`state`・`HOME`・`FEED` には持たせない） |

**`st: 3`（構想）の理由**：Dify のアプリだけでは成立しない。案件の状態・版・配布記録を持つ外部の入れ物（**PC-18**）と ICS 出力（PC-13 の拡張）が前提で、どちらも未実装。GN-06（`st: 2`）は PC-01 が設計済みだったのに対し、本件は共通部品が新規。

### 2-3. `TAGS` に追加する 1 個（`mock/js/data/ui.js`）

置き場は金融カタログ新設タグ 13 個のブロックの**直後**に、`/* ---- 業種横断タグ（設計書 2026-09-08-exec-visit-attend.md §2-3） ---- */` のコメントを付けて 1 行。

| キー | ja | zh | en |
|---|---|---|---|
| `travel` | 出張・来訪 | 出差与来访 | Travel & visits |

`meeting` を使わない理由：本件の主役は会議ではなく**行程**。`calendar`（日程）と `travel`（出張・来訪）の 2 つで一覧の絞り込みが自然に効く。

### 2-4. サービス文言（3 言語・確定）

**`name`**

| lang | 値 |
|---|---|
| ja | `幹部来訪・出張のアテンド段取り` |
| zh | `高管来访与出差的接待安排` |
| en | `Executive Visit & Trip Coordination` |

**`desc`**

| lang | 値 |
|---|---|
| ja | `幹部の来訪・出張を 1 件の案件として持ち、到着便・出迎え・社用車やハイヤーの手配・会食・宿泊・緊急連絡先といった事実を、決まった順に追記していきます。追記のたびに予定表を作り直し、いつでも最新版を社内向け（日本語・中国語）と社外向け（抜粋）で出せます。会社契約ホテルの名称・住所・連絡先は日本語・英語・中国語で持ち、会食では仕向け（当社が接待する側か、される側か）と双方の部署・役職・氏名を稟議添付の形に整え、幹部の略歴交換も段取りします。Outlook に一括で取り込めるファイルも出力します。` |
| zh | `将高管的来访与出差作为一个案件来管理，把到达航班、接机、公务车或包车安排、宴请、住宿、紧急联络人等事实按敲定的顺序不断追加。每次追加都会重新编制日程表，随时可输出最新版的对内版（日文・中文）与对外版（摘录）。公司协议酒店的名称、地址、联系方式以日文・英文・中文三种语言保存；宴请方面则整理出仕向（由我方招待还是受对方招待）以及双方的部门、职务、姓名，形成可作为审批附件的格式，并安排高管履历的事前交换。还可输出能批量导入 Outlook 的文件。` |
| en | `Manages an executive visit or business trip as a single case, appending facts as they are settled: arrival flights, airport pickup, company cars or chartered vehicles, dinners, hotels and emergency contacts. Every addition rebuilds the itinerary, so the latest version can be issued at any time for internal use (Japanese and Chinese) and for outside parties (extract). Contracted hotel names, addresses and phone numbers are held in Japanese, English and Chinese. For dinners it records which side is hosting, formats both sides' departments, titles and names for the expense approval, and arranges the exchange of executive biographies beforehand. It also outputs a file that can be bulk-imported into Outlook.` |

> implementer 向け：`en` は JS のシングルクォート文字列に入るので `sides'` の `'` を `\'` にエスケープすること（`catalog.js` の既存 `en1` の `OEM\'s` と同じ）。

### 2-5. 「仕向け」の記録（**PM 確認済み・2026-09-08**）

PM 確定：**会食がどちら向きのものか＝当社が接待する側なのか、相手方が接待する側なのか**。稟議と交際費の扱いが変わるので、案件の記録項目として持つ。

| 項目 | 値 | 意味 |
|---|---|---|
| `meal_direction` | `host_out` | **当社→相手**。当社が主催・接待する |
| | `host_in` | **相手→当社**。相手方が主催・接待する |
| | `split` | 折半 |
| `cost_bearer` | `us` / `counterpart` / `split` | 費用の負担側。既定は `meal_direction` から導出（`host_out`→`us`、`host_in`→`counterpart`、`split`→`split`）。**立替など例外があるので上書き可**にする |
| `attendee_order` | （導出。持たない） | 稟議に載せる出席者の並べ方。下表 |

**稟議に載せる出席者の並べ方（`meal_direction` で変わる）**

| `meal_direction` | 稟議の種類 | 出席者表の並び | 注記 |
|---|---|---|---|
| `host_out`（当社→相手） | **交際費（接待費）稟議が要る** | **当社（接待する側）を先**、相手方を後。当社側は決裁者→同席者の順、相手方は役職順に**全員**記載（人数が単価上限の分母になるため欠かせない） | 社内規程の 1 人あたり上限（製造業の例：規程 §6.2 の RMB 300／人）に人数を掛けた上限額を併記 |
| `host_in`（相手→当社） | **交際費稟議は不要**。代わりに**受けた接待の届出**（コンプライアンス／利益供与の観点） | **相手方（主催）を先**、当社を後。当社側は出席者と役職のみ（金額は当社に発生しない） | 金額欄は「先方負担」と明記し、空欄にしない |
| `split`（折半） | **当社負担分のみ**の交際費稟議 | `host_out` と同じ並び | 総額と当社負担分を分けて書く |

この項目は台本の 2 往復目（§3-4）と実装リファレンス GN-07.md §3・§4 に反映する。

### 2-6. データ層の変更前後（**reviewer が `regress` の差分と照合する**）

| 指標 | 変更前 | 変更後 | 差分 |
|---|---|---|---|
| `cats` | 13 | **13** | ±0（`CATS` は 1 行も触らない） |
| `subs` | 29 | **29** | ±0 |
| `svcs` | 66 | **67** | **+1**（`gn7`） |
| `tags` | 56 | **57** | **+1**（`travel`） |
| `ui`（`T` のキー数） | 78 | **78** | ±0（新しい UI 文言は 1 つも要らない） |
| `svcsMfg` | 48 | **49** | +1 |
| `svcsFin` | 28 | **29** | +1 |
| `svcsBoth` | 10 | **11** | +1 |
| `catsMfg` / `catsFin` | 10 / 8 | **10 / 8** | ±0 |

- **追加される id は `gn7` の 1 つだけ**。`svcs[]` の他の 66 行（`id`/`cat`/`sub`/`st`/`tags`/`industries`）は**1 バイトも変わらない**
- **削除・改名・分類移動・成熟度変更・`industries` 変更は 0 件**
- 恒等式 `svcsMfg + svcsFin − svcsBoth === svcs` が成立すること（49 + 29 − 11 = 67）
- `tags[]` に増えるのは `travel` の 1 つだけ
- `regress --update` は **PR-1 でのみ**行う。PR 本文に「設計書 §2-6 のデータ変更に伴う基準更新」と書く

---

## 3. §B デモ画面

### 3-1. 結論：既存 `form` 1 本。テンプレートは増設しない。2 サービスに割らない

**テンプレートを増設しない理由**：`TEMPLATES` の 5 種は `CLAUDE.md` §2-3 の load-bearing で、増やすと `mock/js/data/ui.js`・`mock/js/render.js`（`panelHTML` の分岐）・`tools/verify.mjs` §9（テンプレート別の `input` 形式検査）が同時に動く。今回の要件は既存 `form` で表現できる。

**2 サービスに割らない理由**：割るなら「①案件の記録と予定表出力」と「②会食の出席者・仕向け・略歴交換」だが、②の出席者と仕向けは**①の予定表に載る事実の一部**で、会食が動けば①の版も上がる。分けると同じ案件の状態が 2 サービスに散る（§5 の「状態は 1 か所」に反する）。5 軸で見ても①②はペルソナ・分類・出口が同じで、統廃合の判定では**同一**になる。

**なぜ `qa` ではなく `form` か**：`qa` は work-pane が出ないので（`render.js` の `scn.template !== 'qa'` 分岐）、**予定表を表で見せられない**。本件のいちばんの見せ場は「表になった予定表」なので `form` を採る。

### 3-2. レイアウト（`form` の既存レイアウト。新しい CSS は 1 行も要らない）

```
┌ 業務デモ ─────────────────────────────────────────────────────┐
│ ← 詳細へ戻る │ GN-07  幹部来訪・出張のアテンド段取り            │
│              [フォーム入力→ドラフト生成型] 佐藤 美咲・蘇州工場   │
│              ● 構想                              [最初から]     │
├──────────────────────────┬────────────────────────────────────┤
│ work-pane                │ chat-pane                          │
│ ┌ 入力 ────────────────┐ │  エージェント: こんにちは。…       │
│ │ 案件名   VST-2025-014 │ │                                    │
│ │ 来訪者   渡辺 常務ほか │ │  ┌────────────────────────────┐   │
│ │ 日程     9/24〜9/26   │ │  │ 1往復目 到着便が変わった     │   │
│ │ 目的     据付立会い…  │ │  │  → 事実 2 件を記録・v2      │   │
│ │ 受入担当 佐藤／小林    │ │  └────────────────────────────┘   │
│ │ 配布先   本社秘書室…  │ │  ┌────────────────────────────┐   │
│ │            [実行済み] │ │  │ 2往復目 会食の出席者・仕向け │   │
│ └──────────────────────┘ │  │  → 出席者表・略歴交換・v3   │   │
│ ┌ 結果 ────────────────┐ │  └────────────────────────────┘   │
│ │ 予定表 v1（表）        │ │  ┌────────────────────────────┐   │
│ │ 日時|内容|場所|移動|   │ │  │ 3往復目 配って。Outlook 用も │   │
│ │ 同行・出迎え|確認事項  │ │  │  → 配布記録・ICS/CSV/PDF    │   │
│ │ …（8 行）             │ │  └────────────────────────────┘   │
│ └──────────────────────┘ │  [次の質問例] 日 … / 中 …          │
│                          │  [メッセージを入力            ][送信]│
└──────────────────────────┴────────────────────────────────────┘
```

### 3-3. 「逐次更新されて最新版が出る」をどう出すか（**実装上の制約を含む**）

`render.js` の `panelHTML()` は各ターンのあと再描画されるが、中身は `scn.result[lang0]` の**静的な 1 つ**なので、**結果パネルは版が変わらない**。ここを変えるのは `render.js` ＝共通レイヤーの改造なので**やらない**。

したがって役割を次のように分ける（**この分担を implementer は守ること**）。

| 場所 | 見せるもの |
|---|---|
| 入力パネル（`input.fields`） | 案件の初期登録。6 項目 |
| 結果パネル（`result.columns` + `rows`） | **予定表 v1**（表・8 行）。`実行` を押すと出る。ここは以後変わらない |
| チャット 1 往復目の `a` | 事実 2 件を記録 →「**予定表を v2 に更新しました**」＋**変更点 3 行**＋**最新版の主要 4 行を再掲** |
| チャット 2 往復目の `a` | 事実 3 件を記録 → **v3**。出席者表・仕向け・略歴交換・稟議へ渡す形 |
| チャット 3 往復目の `a` | **v3 を配布**。社内 ja/zh・社外抜粋・ホテル 3 言語カード・出力ファイル 4 種・次の更新時の再配布ルール・未確定 1 件 |

**各返答の冒頭を必ず `案件 VST-2025-014 に事実を N 件記録しました。予定表を v{X} に更新しました（変更 {M} 点）。` の形で始める。** これで「事実が積み上がって版が上がる」ことが 3 往復とも一目で分かる。

### 3-4. 台本の骨子（ja。zh は implementer が ja を原文に作る）

> `tools/verify.mjs` §9 の制約：`steps` は 3 言語で長さを揃え **3〜6**、`script.ja`/`script.zh` は長さを揃え **2〜4**、`q`/`a` に **`'`（U+0027）を含めない**、`result` は `items` か `columns`+`rows` の**どちらか一方**、`rows` の列数は `columns` と一致。

#### 3-4-1. 製造業（`mock/js/data/scenarios/mfg/gn.js` の `gn6` の直後に `gn7`）

- `template`: `'form'`
- `persona`: **佐藤 美咲**／管理部 総務・人事 駐在員／蘇州工場／`native: 'ja'`（GN-04・GN-06 と同一人物。役職ゆれを作らない）

**`steps`（3 言語・確定。4 本）**

| # | ja | zh | en |
|---|---|---|---|
| 1 | 本社の常務が蘇州工場を視察する。到着便・出迎え・社用車・会食・宿泊が日ごとに決まっていき、そのたびに配った予定表が古くなる | 总部常务董事将视察苏州工厂。到达航班、接机、公务车、宴请、住宿逐日敲定，每敲定一次，已分发的日程表就过时 | An HQ executive will inspect the Suzhou plant; arrival, pickup, cars, dinner and hotel are settled day by day, and each time the itinerary already circulated goes stale |
| 2 | 案件 VST-2025-014 として登録し、決まっている事実をフォームに入れる | 登记为案件 VST-2025-014，将已确定的事实填入表单 | Register it as case VST-2025-014 and enter the facts already fixed |
| 3 | 予定表 v1 が出る。以降はチャットで決まった事実を伝えるたびに版が上がり、変更点と最新版が返る | 生成日程表 v1。之后每在对话中告知一条新确定的事实，版本即递增，并返回变更点与最新版 | Itinerary v1 appears; from then on each fact told in chat bumps the version and returns the changes plus the latest itinerary |
| 4 | 最新版を社内（日本語・中国語）と社外（抜粋）に配り、Outlook 取り込み用のファイルも受け取る | 将最新版分发给内部（日文・中文）与外部（摘录版），并获取可导入 Outlook 的文件 | Distribute the latest version internally (JA/ZH) and externally (extract), and get an Outlook-importable file |

**`input.fields`（骨子・6 項目）**

| label | value（骨子） |
|---|---|
| 案件名 | 本社 渡辺常務 蘇州工場 視察（VST-2025-014） |
| 来訪者 | 渡辺 克彦 常務執行役員（生産本部長）／随行 1 名 |
| 日程 | 2025-09-24（水）〜 2025-09-26（金） |
| 目的 | 塗装ライン乾燥炉の据付立会い／K 社 表敬会食 |
| 受入担当 | 佐藤 美咲（管理部）／現地責任者 小林 誠 工場長 |
| 配布先 | 本社秘書室・工場長室・製造部・物流課／社外は K 社窓口（抜粋版） |

**`result`（骨子・表。`columns` 6 列 × `rows` 8 行）**

`columns`: `['日時（現地）', '内容', '場所', '移動', '同行・出迎え', '確認事項']`

行の骨子（値は §4 の world マスタから引く）：

1. 9/24 11:35 到着（上海浦東 PVG・第 2 ターミナル）／到着ロビー／—／出迎え：朱 海（社用車 1 号車）・呉 婷（通訳）／❗ 到着時刻は本社秘書室に照会中
2. 9/24 12:10 空港発 → ホテル（PVG → 錦楓大酒店、社用車 1 号車・約 110 分）
3. 9/24 14:20 チェックイン（錦楓大酒店。名称・住所・電話は日英中の 3 言語カードを別紙で配布）
4. 9/24 16:00 工場到着・工場長表敬（蘇州工場 2 階 応接室。ホテル→工場 車 20 分）／小林 誠 工場長
5. 9/25 09:00 乾燥炉 据付立会い（塗装ライン。稟議 RG-25-0117 の対象設備）／田中 浩二 製造部長
6. 9/25 18:30 K 社 表敬会食（錦楓大酒店 3 階 個室）／当社 4 名・K 社 3 名／❗ 仕向け（当社→相手／相手→当社）が未記録
7. 9/26 10:00 ホテル発 → 空港（錦楓大酒店 → PVG、社用車 1 号車・約 110 分）
8. 緊急連絡先：総務課 当直・ホテル フロント・提携クリニック（`contacts.csv` の 3 件を 1 行にまとめる）

**`script.ja`（3 往復・骨子）**

| # | `q`（骨子） | `a`（骨子。冒頭は §3-3 の定型で始める） |
|---|---|---|
| 1 | 本社秘書室から連絡。到着便が変わった。9/24 11:35 浦東ではなく **9/24 08:20 上海虹橋（SHA）着**。随行も 1 名増えて 2 名 | 事実 2 件を記録／**v2（変更 4 点）**。① 出迎えを 06:45 発に前倒し（SHA まで社用車で約 95 分・朝の渋滞込み）② **5 名＋荷物で社用車 1 号車（5 人乗り）に乗らない** → ワゴン（7 人乗り）か **旅行会社 R 社手配のハイヤー**（7 人乗り・RMB 1,200）。ワゴンは同日 09:00 に別件で押さえ済みのため**ハイヤーを推奨** ③ ホテルのチェックインは 14:00 なので、到着後は先に工場へ入り、荷物はホテルに先送りする ④ 会食（9/25 18:30）は影響なし。**最新版 v2 の主要 4 行を再掲**。次に決めることを 2 つ提示（車両／随行 2 名目の氏名） |
| 2 | ハイヤーで。会食は **K 社 購買本部長ほか 2 名**が来る。**当社が接待する**。稟議に出す出席者表と、常務の略歴の交換をお願い | 事実 3 件を記録／**v3（変更 3 点）**。① 車両を `charter`（R 社ハイヤー・7 人乗り）に確定、費用 RMB 1,200 は当社負担 ② **仕向け＝当社→相手（`host_out`）**。費用負担＝当社。**交際費稟議が要る**。出席者表は**当社を先・K 社を後**（§2-5 の表）／当社 4 名（氏名・部署・役職）／K 社 3 名（匿名 ID C-2509-A〜C・役職）／規程 §6.2 の 1 人 RMB 300 上限 × 7 名 ＝ 上限 RMB 2,100 ③ 略歴交換：常務の略歴（日中英 3 言語・A4 1 枚）を **9/22 まで**に先方へ、先方 3 名ぶんの受領を依頼。**携帯番号・住所は略歴に載せない**（PIPL）。DC-05（稟議・申請書）に渡す JSON を添える。❗ 随行 2 名目の氏名が未記録 |
| 3 | 予定表を配って。社内は日本語と中国語、K 社には**会食の部分だけ**。Outlook に入れられる形も | 配布記録を作成／**v3 を配布（社内 6・社外 1）**。① 社内版 ja/zh（全 12 項目）② 社外版 zh（会食 1 項目のみ。**社内移動・車両・ホテルの部屋・緊急連絡先・稟議番号は載せない**）③ 錦楓大酒店の名称・住所・電話を**日英中 3 言語**で 1 枚（タクシーで見せる用）④ 出力：`VST-2025-014_v3_ja.pdf` ／ `_zh.pdf` ／ `_ext_zh.pdf` ／ **`VST-2025-014_v3.ics`**（12 予定・タイムゾーン Asia/Shanghai・**出席依頼ではなく共有**）／ `VST-2025-014_v3.csv`（Outlook classic の一括取り込み用）⑤ 次に事実が入ったら v4 を作り、**v3 を受け取った宛先にだけ差分つきで再配布**します。❗ 未確定 1 件（随行 2 名目の氏名） |

#### 3-4-2. 金融（`mock/js/data/scenarios/fin/gn.js` を**新設**）

構造は 3-4-1 と 1 対 1 で対応させる（**同じサービスの同じ見せ方が業種で語り換わる**ことを見せるのが目的）。世界の語は `data/world/fin/` のものだけを使い、製造業の語（青嶺精工・K 社・蘇州工場・RG-・乾燥炉）は**1 つも流用しない**。

- `template`: `'form'`
- `persona`: **岡部 千夏**／経営企画部 調査役／上海本部／`native: 'ja'`
- 案件：**VST-2026-021** 日本本店 白石 洋介 専務執行役員（国際部門統括）が **上海本部**を視察（2026-09-24〜26）
- ホテル：**碧波酒店上海**（`hotel_hekiha`）／空港：PVG → **SHA** に変更（1 往復目）
- 会食：**甲社**（日系製造業の主要顧客）の CFO ほか 2 名。**仕向け＝当社→相手**。稟議 **RNG-2026-0142**（交際費）。**コンプライアンス部（羅 佳）への届出**にも触れる
- 同行：陳 慧（営業第一部 主管）／運転手 唐 志遠（総務部）
- 相手方の個人は**役職で表す**（「甲社 CFO」「甲社 財務部長」）。金融側に匿名個人 ID の書式は新設しない
- 世界の「今日」は 2026-09-08（`data/world/fin/calendar.md`）なので、案件日程 2026-09-24〜26 は**未来**。製造業側（2025-09）と 1 年ずれるのは既知の世界線の違い（`data/world/mfg/calendar.md` の「未統一」）で、**本 Issue では直さない**

### 3-5. 出力（予定表・ICS）の見せ方

- 予定表は**結果パネルの表**で見せる（v1）。版が上がったあとは**チャット本文で主要行を再掲**する。**表を 2 つ出さない**（`result` は 1 つしか持てない）
- 出力ファイルは**ファイル名の羅列**で見せる（GN-01 の `input.files` と同じ流儀）。**モックでダウンロードは起きない**。3 往復目の `a` に 5 本のファイル名を書く
- ICS は「12 予定・タイムゾーン Asia/Shanghai・出席依頼ではなく共有」の 1 行を添えて、**何が入るか**が分かるようにする

---

## 4. §C 基礎データ（`data/world/`）

### 4-1. ファイル構成（両業種に同じ 5 本を新設）

```
data/world/mfg/                      data/world/fin/
  hotels.csv      ← 会社契約ホテル      hotels.csv
  vehicles.csv    ← 社用車・ハイヤー    vehicles.csv
  airports.csv    ← 空港               airports.csv
  routes.csv      ← 区間所要時間        routes.csv
  contacts.csv    ← 緊急連絡先          contacts.csv
```

既存の作法どおり **1 実体 1 CSV・1 行 1 レコード・`note` 列を末尾に置く**（`people.csv` / `partners.csv` と同じ）。`data/world/README.md` の「何がここにあるか」の表 2 つに 5 行ずつ追記する。

### 4-2. 各ファイルの列（**この列名で確定**）

**`hotels.csv`**

```
hotel_id,name_ja,name_zh,name_en,addr_ja,addr_zh,addr_en,tel,contract_note,site_id,note
```

- `contract_note`：契約の種別と社内レート（例 `年間契約・シングル RMB 620/泊（朝食込み）`）。**実在の価格を思わせる注記は書かない**（架空値であることを `note` に書く）
- `site_id`：最寄りの自社拠点（`suzhou` / `sh_hq` など。`company.md` の拠点 id）
- 行数：**mfg 3 行 / fin 3 行**

**`vehicles.csv`**

```
vehicle_id,label_ja,label_zh,label_en,kind,seats,luggage,vendor_code,driver_person_id,site_id,booking_rule,note
```

- `kind`：`company`（社用車）/ `charter`（旅行会社手配のハイヤー）
- `vendor_code`：`charter` のときだけ埋める。mfg は `partners.csv` の `R 社`、fin は `vendors.csv` の `己社`
- `driver_person_id`：`people.csv` の `person_id`（`charter` は空）
- `booking_rule`：社内の押さえ方（例 `総務課に前日 17:00 までに申請`）
- 行数：**mfg 3 行（1 号車 5 人乗り／ワゴン 7 人乗り／ハイヤー 7 人乗り）／ fin 3 行**

**`airports.csv`**

```
airport_id,iata,name_ja,name_zh,name_en,city_ja,city_zh,city_en,tz,terminals,note
```

- 行数：**mfg 4 行（PVG / SHA / NRT / HND）／ fin 5 行（PVG / SHA / DLC / NRT / HND）**。同じ空港が両業種に出るのは重複ではなく、**世界ごとに使う空港が違う**ため（README の「2 つの世界の語彙は混ぜない」に反しない）
- `tz`：`Asia/Shanghai` / `Asia/Tokyo`（ICS の VTIMEZONE に使う値そのもの）

**`routes.csv`**

```
route_id,from_id,to_id,mode,minutes_typical,minutes_peak,distance_km,cost_note,note
```

- `from_id` / `to_id` は **`airports.csv` の `airport_id`・`hotels.csv` の `hotel_id`・`company.md` の拠点 `id` を横断で参照する**（どのマスタの id かは接頭で分かるように命名する：`apt_pvg` / `htl_kinpu` / `suzhou`）
- `mode`：`company_car` / `charter` / `taxi` / `rail` / `walk`
- `minutes_peak`：朝夕の渋滞込み。台本の「前倒し」の根拠に使う
- 行数：**mfg 8 行 / fin 8 行**

**`contacts.csv`**

```
contact_id,scope,label_ja,label_zh,label_en,person_id,phone_note,hours,escalate_to,note
```

- `scope`：`internal`（総務当直・工場長室／本店役員室秘書）/ `external`（契約ホテル フロント・旅行会社 24h デスク）/ `medical`（提携クリニック）/ `official`（公的機関）
- `phone_note`：**架空の番号のみ**。書式は `+86-512-XXXX-XXXX（架空）` のように**架空であることを値の中に書く**
- `scope: official`（総領事館など）は**機関名を書かない**。`label_ja` は `本国総領事館（緊急時）` とし、`phone_note` は `別途配布の緊急カードを参照（本マスタには記載しない）` にする
- 行数：**mfg 5 行 / fin 5 行**

### 4-3. 3 言語をどう持つか（**§2-1 とは別軸であることの明記**）

**列で持つ**（`name_ja` / `name_zh` / `name_en`、`addr_ja` / `addr_zh` / `addr_en`）。別ファイルには分けない。既存の `people.csv`（`name_ja,name_zh,name_en`）・`org.csv`（`dept_ja,dept_zh,dept_en`）と同じ作法。

**これは `CLAUDE.md` §2-1 の多言語辞書とは別の軸である。**

| | §2-1（UI の多言語） | 本節（データの多言語） |
|---|---|---|
| 対象 | `mock/js/data/**` の `T` / `TAGS` / `CATS` / `SVCS` など | `data/world/**` の CSV |
| 何が 3 言語か | **画面の表示言語**。利用者が切り替えると全部が切り替わる | **データそのものの表記**。ホテルには実際に日・中・英の 3 通りの正式表記があるという業務事実 |
| いつ 3 つ同時に出るか | 出ない（1 つだけ表示） | **出る**（タクシー運転手に見せるカードは 3 言語を 1 枚に並べる） |
| 検出 | `tools/verify.mjs` §2（FAIL） | `tools/check-world.mjs`（warn のみ。CI に入れない） |

したがって **`data/world/**` の 3 言語欠落は verify では落ちない**。implementer は 5 本すべてで `*_ja` / `*_zh` / `*_en` を**空にしない**こと（受け入れ条件 §8 に入れる）。

### 4-4. `data/world/` への追記（人・部署・文書番号）

台本に新しく出る名前は、**先にマスタへ足す**（`data/world/README.md` の追加ルール 1）。

**`mfg/org.csv` に 3 行追加**

| dept_id | ja | zh | en | site_id |
|---|---|---|---|---|
| `honsha_seisan` | 本社 生産本部 | 总部 生产本部 | Corporate Production Division (HQ) | `jp_hq` |
| `honsha_hisho` | 本社 秘書室 | 总部 秘书室 | Corporate Secretariat (HQ) | `jp_hq` |
| `soumu` | 総務課 | 总务科 | General Affairs | `suzhou`（`parent_dept_id: kanri`） |

**`mfg/people.csv` に 3 行追加**

| person_id | ja / zh / en | 役職 | site | native |
|---|---|---|---|---|
| `watanabe-katsuhiko` | 渡辺 克彦 / 渡边克彦 / Katsuhiko Watanabe | 常務執行役員 生産本部長 | `jp_hq` | ja |
| `arai-shiho` | 新井 志保 / 新井志保 / Shiho Arai | 秘書室 秘書 | `jp_hq` | ja |
| `zhu-hai` | 朱 海 / 朱海 / Zhu Hai | 総務課 運転手 | `suzhou` | zh |

**`fin/org.csv` に 2 行追加**：`honten_yakuin`（日本本店 役員室 / 日本总行 董事会办公室 / Executive Office (Japan Head Office)、`jp_hq`）、`soumu`（総務部 / 总务部 / General Affairs Department、`sh_hq`）

**`fin/people.csv` に 3 行追加**

| person_id | ja / zh / en | 役職 | site | native |
|---|---|---|---|---|
| `shiraishi-yosuke` | 白石 洋介 / 白石洋介 / Yosuke Shiraishi | 専務執行役員 国際部門統括 | `jp_hq` | ja |
| `kuroda-mai` | 黒田 麻衣 / 黑田麻衣 / Mai Kuroda | 役員室 秘書 | `jp_hq` | ja |
| `tang-zhiyuan` | 唐 志遠 / 唐志远 / Tang Zhiyuan | 総務部 運転手 | `sh_hq` | zh |

> 既存 25 名（mfg 17・fin 8）と姓名が重複しないことを確認済み。`fin/people.csv` の note にある「製造業マスタと姓名の重複なし」の約束を守る。

**`mfg/partners.csv` に 1 行追加**：`R 社`（`kind: service`、旅行会社（ハイヤー手配・出張手配）／旅行社（包车与差旅安排）／Travel agency (chartered cars & trip arrangements)）

**`fin/vendors.csv` を新設**（fin には仕入先系のマスタが無い。`clients.csv` は顧客専用なので混ぜない）。列は `mfg/partners.csv` と同一（`code,kind,role_ja,role_zh,role_en,country,note`）。1 行：`己社`（`kind: service`、旅行会社）。記号は `clients.csv` の 甲乙丙丁戊 に続く十干（己・庚・辛…）を使う

**文書番号を両業種の `calendar.md` に 1 行ずつ追加**

| 書式 | 意味 | mfg の例 | fin の例 |
|---|---|---|---|
| `VST-YYYY-NNN` | 出張・来訪案件番号 | `VST-2025-014` | `VST-2026-021` |

3 文字接頭にしているのは、`tools/check-world.mjs` W7 の「管理番号形式（`^[A-Z]{2}-\d{2}$`）と紛らわしい」報告を避けるため（`fin/calendar.md` の既存方針と同じ）。

### 4-5. 実在名の扱い（**architect 判断・PM 確認は不要**）

`CLAUDE.md` §2-13 と `docs/dify/implementation-guide.md` §5-3 が禁じているのは **実在の企業名・型番・URL・人名**。地名・空港は企業ではなく地理的事実で、既存の台本にも実在の地名（上海・蘇州・常熟・大連）が出ている。よって：

| 対象 | 判定 | 根拠・書き方 |
|---|---|---|
| **空港名・IATA コード**（上海浦東 PVG／上海虹橋 SHA／大連周水子 DLC／成田 NRT／羽田 HND） | **使ってよい** | 地理的事実。特定企業を指さない。`airports.csv` に正本を置く |
| **都市名・行政区名**（上海市浦東新区、蘇州工業園区 など） | **使ってよい** | 既存台本と同じ |
| **ホテル名** | **架空のみ**。実在名を書かない | §4-6 の命名。`hotels.csv` の `note` に「架空。実在名との衝突が後から分かったらこの 1 ファイルと台本の語を差し替える」と書く（`fin/company.md` の先例と同じ） |
| **航空会社名・便名** | **書かない** | 台本では「**上海虹橋 08:20 着**」のように**空港・時刻・ターミナルだけ**で表す。航空会社のマスタも置かない。IATA 2 レターは実在企業を一意に指すため |
| **旅行会社・ハイヤー会社名** | **記号のみ**（mfg `R 社` / fin `己社`）。社名は付けない | `partners.csv` の PM 決定 PT-8（取引先に社名を付けない）と同じ |
| **公的機関名**（総領事館など） | **書かない** | §4-2 `contacts.csv` の `scope: official` の扱い |
| **電話番号・住所** | **架空のみ**。値の中に「架空」と明記 | 実在の番号に当たらないよう `XXXX` を含む書式にする |

### 4-6. ホテル名（架空・確定）

| 業種 | hotel_id | ja | zh | en | 位置 |
|---|---|---|---|---|---|
| mfg | `htl_kinpu` | 錦楓大酒店（蘇州） | 锦枫大酒店（苏州） | Kinpu Hotel Suzhou | 蘇州工業園区。工場から車 20 分。**台本で使う本命** |
| mfg | `htl_seiryu` | 青流ホテル蘇州 | 青流酒店苏州 | Seiryu Hotel Suzhou | 蘇州市街・駅至近 |
| mfg | `htl_ryuka` | 柳華ホテル上海虹橋 | 柳华酒店上海虹桥 | Ryuka Hotel Shanghai Hongqiao | 上海。前泊・乗継用 |
| fin | `htl_hekiha` | 碧波ホテル上海 | 碧波酒店上海 | Hekiha Hotel Shanghai | 上海本部至近。**台本で使う本命** |
| fin | `htl_shinonome` | 東雲ホテル上海浦東 | 东云酒店上海浦东 | Shinonome Hotel Shanghai Pudong | 浦東。空港側 |
| fin | `htl_shirakaba` | 白樺ホテル大連 | 白桦酒店大连 | Shirakaba Hotel Dalian | 大連支店出張用 |

住所は「上海市浦東新区○○路 NNN 号」のような**架空の番地**にする（区名までは実在でよい／番地と路名は架空）。

### 4-7. `tools/check-world.mjs` への影響（**2 か所だけ直す**）

| # | 何を | なぜ |
|---|---|---|
| 1 | mfg / fin の**両方**の `knownPatterns` に `/^VST-\d{4}-\d{3}$/` を追加（W6） | 追加しないと `VST-2025-014` が「calendar.md のどの書式にも一致しない」と warn される |
| 2 | fin の取引先マスタ読み込みを `readCSV(dir,'clients.csv')` → **`clients.csv` ＋ `vendors.csv` の連結**にする（W5） | `己社` が clients.csv に無い記号として warn されないように |

**それ以外は触らない。** `check-world.mjs` は warn のみ・CI 対象外なので、`npm run world` の報告件数が **15 → 15**（増えない）ことを受け入れ条件にする。

> **申し送り（本 Issue の範囲外・§10 #2）**：`check-world.mjs` の `scenariosFor()` は `data.SCENARIOS[id]` というフラットな形（業種 2 階層になる前の形）を前提にしており、現在は台本を 1 件も拾えていない（W1・W3・W9 のうち `SCENARIOS` 経由の判定が空振りしている）。W1・W9 は生テキスト走査でも効いているので実害は小さいが、**別 Issue で直すべき**。本 Issue では直さない。

---

## 5. §D 状態を持つこと（本実装の肝）

### 5-1. 結論

「案件ごとのアップデートを覚える」は **Dify 単体では成立しない**。Dify の会話ログはアプリ単位・利用者単位で、**案件という単位で複数人が事実を足していき、版を切り、配布先を覚える**入れ物が無い。

既存の共通部品を全部当たった結果：

| 既存 PC | 足りるか | 理由 |
|---|---|---|
| **PC-01 フィードストア** | **足りない** | 1 行 1 タスクの平坦なテーブル。**案件 → 事実 N 件 → 版 M 個 → 配布先 K 件**という階層と、版の差分・配布履歴を持てない。ただし「当日の出迎え 06:45 発」のような**通知は PC-01 に出す**（併用する） |
| PC-04 業務システム連携 | 併用 | M365 カレンダー・社用車予約・ホテル手配システムの照会に使う。**入れ物ではない** |
| PC-13 ファイル出力 | 併用（**拡張が要る**） | PDF/XLSX/CSV はある。**ICS が無い**ので追記する（§5-4） |
| PC-14 通知チャネル | 併用 | 予定表の配布（メール／WeCom／Teams）はここ |
| PC-17 指摘・回答台帳 | 足りない | DC-08 の指摘 ⇄ 回答という別の形 |

→ **新規に `PC-18 出張案件ストア` を 1 個立てる。**（`platform-components.md` は PC-01〜17 で、ID と名称は固定・追加は末尾に足す運用。追記文の全文は付録 B）

### 5-2. `PC-18 出張案件ストア` のデータ形（設計の核）

4 つのテーブル。**「事実」と「予定表」を分けるのが肝**（事実は追記のみ、予定表は事実から毎回組み直す）。

| テーブル | 主な列 |
|---|---|
| `visit_cases` | `case_id`（`VST-YYYY-NNN`）／`title`／`status`（`draft`/`active`/`closed`）／`owner_id`（受入担当・PC-02）／`site_id`／`visitor_ids`（幹部・随行）／`start_date`/`end_date`／`created_at`/`updated_at` |
| `visit_facts` | `fact_id`／`case_id`／`kind`（`arrival`/`departure`/`pickup`/`vehicle`/`hotel`/`meal`/`meeting`/`contact`/`route`/`note`）／`payload`（JSON。`kind` ごとのスキーマ）／`reported_by`／`reported_at`／`source`（`chat`/`mail`/`form`/`system`）／`supersedes`（前の `fact_id`。**上書きせず打ち消しで記録する**）／`confidence`（`confirmed`/`tentative`。台本の ❗ はこれ） |
| `visit_itineraries` | `case_id`／`version`（1 から）／`generated_at`／`generated_by`／`fact_ids`（この版が根拠にした事実）／`diff_summary`（ja/zh の変更点 N 行）／`artifacts`（`{ja_pdf, zh_pdf, ext_pdf, ics, csv}` の URL） |
| `visit_distributions` | `case_id`／`version`／`recipient`（社員 id または外部の窓口）／`audience`（`internal`/`external`）／`lang`／`channel`（`mail`/`wecom`/`teams`）／`sent_at`／`redaction_profile`（社外版で落とす項目の指定） |

**会食の「仕向け」は `visit_facts` の `kind: meal` の `payload` に持つ**：

```json
{ "when": "2025-09-25T18:30+08:00", "venue_id": "htl_kinpu#3F",
  "direction": "host_out",            // host_out | host_in | split（§2-5）
  "cost_bearer": "us",                // 既定は direction から導出。上書き可
  "our_attendees":  [{ "person_id": "...", "dept": "...", "title": "..." }],
  "their_attendees":[{ "anon_id": "C-2509-A", "org": "K 社", "dept": "...", "title": "..." }],
  "bio_exchange": { "due": "2025-09-22", "ours": "sent", "theirs": "requested" },
  "approval_ref": "RG-25-0117" }
```

### 5-3. Dify 側の構成（どのノードが何を読み書きするか）

- **アプリ種別**：Chatflow（会話で事実が足されるため）。予定表の再生成だけは **Workflow as Tool** に切り出して他アプリからも呼べるようにする
- **案件の読み書きは Knowledge ではなく外部 API**。`http-request` ノード → PC-18 の REST。理由：Knowledge は検索用で、**版・状態・排他更新を持てない**。会話のたびに再取得する必要がある
- **Knowledge に置くのは `data/world` 由来の基礎データ**（契約ホテル・空港・区間所要時間・緊急連絡先・社内の出張規程・交際費規程）。更新頻度が低く、検索で引くもの
- ノード列（骨子）：
  `Start` → `Code`（PC-07 言語判定）→ `LLM`（事実抽出：発話 → `visit_facts` の JSON 配列。`kind` と `confidence` を必ず付ける）→ `HTTP`（`GET /visit/cases/{id}` で現在の事実を取得）→ `Code`（新旧の事実をマージ・矛盾検出）→ **人が確認**（`confirmed` にするのは人。**AI が勝手に登録しない**）→ `HTTP`（`POST /visit/cases/{id}/facts`）→ `Knowledge Retrieval`（ホテル・区間所要時間・規程）→ `LLM`（予定表の組み立て＋変更点の要約）→ `HTTP`（`POST /visit/cases/{id}/itineraries` で版を切る）→ `HTTP`（PC-13 `POST /render` で PDF/XLSX/**ICS**/CSV）→ `Answer`
- **ICS と CSV は LLM に書かせない**。改行・エスケープ・タイムゾーンで壊れる。**構造化 JSON → PC-13 のレンダラ**で作る（§5-4）
- **配布**は PC-14 の `notify`（Workflow as Tool）。社外版は `redaction_profile` を必ず指定し、**社内移動・車両・部屋番号・緊急連絡先・稟議番号・単価を落とす**

### 5-4. Outlook 取り込みファイル：**ICS を第一、CSV を補助**

| | ICS（iCalendar） | CSV |
|---|---|---|
| 複数予定を 1 ファイル | ○（VEVENT を並べる） | ○ |
| タイムゾーン | ○（`VTIMEZONE` ＋ `TZID=Asia/Shanghai`）。**日中 2 拠点でずれない** | △ 取り込み側のローカル時刻として解釈され**ずれる** |
| 版の上書き | ○（同じ `UID` ＋ `SEQUENCE` を上げる。v4 を配ると v3 の予定が更新される） | ✕（毎回重複して増える） |
| Outlook 以外 | ○（Google カレンダー・Teams・スマホ標準） | △ |
| 取り込み経路 | 添付を開く／購読 | Outlook classic の インポート ウィザードのみ（**新しい Outlook では廃止**） |

**結論：`.ics` を正、`.csv` は「Outlook classic しか使えない人向け」と「Excel で目視確認する用」の補助**。両方出す（コストが小さい）。

- **`METHOD` は `PUBLISH`**（共有）。`REQUEST` にすると出席依頼になり、受け取った全員から出欠返信が主催者に飛ぶ。**アテンドの予定表は情報共有であって出席依頼ではない**
- `UID` は `{case_id}-{itinerary_item_id}@{ドメイン}` で固定し、版が上がっても**同じ UID・`SEQUENCE` を +1**。これで「v4 を配ると v3 が上書きされる」が成立する
- 作る場所：**PC-13 のレンダラ API に `ics` テンプレートを 1 つ足す**（`template_id: itinerary_ics`）。Dify の Code ノード（Python sandbox）で外部ライブラリが使える保証が無いため、レンダラ側で組み立てる
- **未確定（実装時に確認）**：(a) Dify の `Answer`／`End` でファイル URL をどう返すか（PC-13 に既にある「ファイル受け取りの詳細は顧客版で実装時に確認」と同じ論点）。(b) 中国側の Outlook／WeCom で `.ics` 添付が落とされないか。(c) 終日でない予定に `X-MICROSOFT-CDO-BUSYSTATUS` が要るか

### 5-5. モックと本実装の境目（**実装リファレンスに明記する**）

**モックは台本で見せられるが、本実装には外部の入れ物（PC-18）が要る。** 具体的には次がモックには無い：

1. 案件の**永続化**（ブラウザを閉じると消える／複数人で同じ案件を触れない）
2. **版**（モックの結果パネルは v1 固定。v2・v3 はチャット本文で語っているだけ）
3. **配布記録**（誰に何版を送ったか。v4 のときの再配布先が決まらない）
4. **ファイル生成**（ICS・PDF はファイル名を出しているだけ）
5. **他システムからの事実の流入**（秘書室のメール・M365 カレンダー・社用車予約）

これを GN-07.md §8「別出しが必要なもの」に**この 5 項目のまま**書く。

---

## 6. §E 実装リファレンス

`docs/dify/usecases/GN-07.md` を `_TEMPLATE.md` の型で新規作成する。**全文を付録 A に置いた**ので implementer はコピーして貼るだけでよい（推測で埋める余地を残さないため）。

あわせて：

- `docs/dify/usecases/README.md`：一覧表に **GN-07 の行**を追加し、見出しの件数を **43 件 → 44 件**にする（実ファイル数と一致させる）
- `docs/dify/platform-components.md`：**PC-18 を末尾に追加**、**PC-13 に ICS の 1 行を追記**（付録 B）
- `docs/dify/usecases/DC-05.md` / `DC-09.md`：§8 に「GN-07 から会食の出席者表と仕向けを JSON で受け取る」を**1 行ずつ**追記（§1-2）

---

## 7. §F 段取り（PR 分割）

| PR | 内容 | 触るファイル | 並列 | 受け入れ条件（機械検証） |
|---|---|---|---|---|
| **PR-1 データ層** | `SVCS` に `gn7` 1 件／`TAGS` に `travel` 1 個／`regress --update`／`npm run index` で `docs/service-map.md` 再生成 | `mock/js/data/catalog.js` `mock/js/data/ui.js` `tools/regress.baseline.json` `docs/service-map.md` | **起点**（PR-3 の前） | `npm test` PASS／regress の差分が **§2-6 の表と行単位で一致**（追加 `gn7` 1・タグ `travel` 1・**削除／改名／分類移動／成熟度変更 0**）／`svcsMfg + svcsFin − svcsBoth === svcs`（49+29−11=67）／`node tools/gen-index.mjs --check` PASS／製造業メニュー 49 件・金融メニュー 29 件 |
| **PR-2 世界マスタ** | `data/world/{mfg,fin}/` に 5 CSV ずつ新設／`fin/vendors.csv` 新設／`people.csv`・`org.csv`・`partners.csv`・`calendar.md` に §4-4 の行を追加／`data/world/README.md` の表 2 つを更新／`check-world.mjs` を §4-7 の 2 か所だけ修正 | `data/world/**` `tools/check-world.mjs` | **PR-1 と並列可**（ファイル集合が重ならない） | `npm run world` が exit 0 で報告件数 **15 → 15**（増えない）／`npm test` PASS（退行なし）／5 CSV × 2 業種で `*_ja`/`*_zh`/`*_en` に**空値なし**／`routes.csv` の `from_id`/`to_id` がすべて `airports.csv`・`hotels.csv`・`company.md` の id に解決する |
| **PR-3 台本（製造業）** | `mock/js/data/scenarios/mfg/gn.js` に `gn7` を追加（`gn6` の直後） | `mock/js/data/scenarios/mfg/gn.js` | **PR-1 の後**。PR-4 とは**直列**（`catalog.html` が重なる…わけではないが verify の warn 件数が動くため、PR-4 を後にする） | `npm test` PASS／verify §9 の mfg 側「台本の無い SVCS」が **5 件のまま**（`gn7` が増えない）／`script` に `'`（U+0027）が無い／`result.rows` の列数が 6 で揃う |
| **PR-4 台本（金融）** | `mock/js/data/scenarios/fin/gn.js` を**新設**／`mock/catalog.html` に `<script src="js/data/scenarios/fin/gn.js">` を 1 行追加（**`js/data/scenarios/mfg/*` の直後・`js/app.js` の直前**） | `mock/js/data/scenarios/fin/gn.js` `mock/catalog.html` | **PR-3 の後**。**Issue #120 PR-4a（金融台本）と同じファイルを触る**ので、どちらかが先にマージし他方は rebase する（§7-1） | `npm test` PASS／verify §1-B の `<script src>` 順序チェック PASS（16 本）／verify §9 に **fin 側の warn が 1 本増える**（「業種 fin で台本の無い SVCS 28 件」）＝**想定どおり**で FAIL ではない／`npm run world` の fin 側 warn が増えない |
| **PR-5 実装リファレンス** | `docs/dify/usecases/GN-07.md` 新規（付録 A）／`usecases/README.md` の一覧＋件数 44／`platform-components.md` に PC-18 追加・PC-13 に ICS 追記（付録 B）／`DC-05.md`・`DC-09.md` に 1 行ずつ | `docs/dify/**` | **PR-1〜4 と並列可**（`mock/**`・`tools/**`・`data/**` を触らない） | `npm test` PASS／`docs/dify/usecases/` のファイル数と README の件数が一致（44）／PC の ID・名称が `platform-components.md` と一致／リンク切れなし |

**推奨する回し方**：`PR-1 ∥ PR-2 ∥ PR-5` → `PR-3` → `PR-4`

### 7-1. 衝突する可能性のある並行作業

| 相手 | 重なるファイル | 対処 |
|---|---|---|
| **Issue #120 PR-4a**（金融台本 KN/DC/GN/PO/EG） | `mock/js/data/scenarios/fin/gn.js` ＋ `mock/catalog.html` | **どちらか一方を先にマージ**。後発は rebase して、`fin/gn.js` が既にあれば `Object.assign` の中に `gn7` を足すだけ（ファイル新設ではない）。implementer はブランチを切る時点で `mock/js/data/scenarios/fin/gn.js` の有無を必ず確認すること |
| **Mac の Dify 実装作業** | `dify/env/**` `dify/apps/**` | **本 Issue では 1 バイトも触らない**（§9） |

---

## 8. 受け入れ条件（機械検証できる形）

1. `npm test`（`node tools/verify.mjs` ＋ `node tools/regress.mjs`）が **ALL PASS**
2. `node tools/regress.mjs` の差分が **§2-6 の表と行単位で一致**。`counts` が `{"cats":13,"subs":29,"svcs":67,"tags":57,"ui":78,"svcsMfg":49,"svcsFin":29,"svcsBoth":11,"catsMfg":10,"catsFin":8}`
3. `svcs[]` に**増えるのは `gn7` の 1 行だけ**。既存 66 行に差分が無い（`git diff` で確認できる）
4. `node tools/gen-index.mjs --check` PASS（`docs/service-map.md` が最新）
5. verify の **warn 件数が 2 → 3**（増えるのは「業種 fin で台本の無い SVCS 28 件」の 1 本だけ）。mfg 側の「台本の無い SVCS 5 件」は**変わらない**
6. `npm run world` が exit 0、報告件数 **15 → 15**（増えない）
7. `data/world/{mfg,fin}/{hotels,vehicles,airports,routes,contacts}.csv` の 10 本が存在し、`*_ja`/`*_zh`/`*_en` 列に**空値が無い**
8. `routes.csv` の `from_id`/`to_id` が **100%** `airports.csv`・`hotels.csv`・`company.md` の id に解決する
9. 台本 `gn7`（mfg / fin）が verify §9 のすべての制約を満たす（`steps` 3 言語 × 4／`script` ja・zh とも 3 往復／`'` を含まない／`result` は `columns`+`rows` のみ／列数一致）
10. `docs/dify/usecases/` のファイル数（44）と `usecases/README.md` の件数表記が一致し、GN-07 の行が一覧にある
11. `docs/dify/platform-components.md` に PC-18 があり、GN-07.md の「依存する共通部品」の ID がすべて実在する
12. **実在の企業名・ホテル名・航空会社名・便名・人名・電話番号・URL が 1 つも入っていない**（reviewer が diff を目視。§4-5 の表で照合）
13. Pages（`https://shoulang0729.github.io/dify/`）で、業種＝製造・金融の両方で GN-07 が一覧に出て、`デモを見る` から `form` のデモが動く

### 8-1. reviewer の照合点

| # | 見るもの |
|---|---|
| 1 | `regress` の差分 ⇄ **§2-6 の表**（`CLAUDE.md` §2-9） |
| 2 | `CATS` が 1 行も変わっていないこと（`git diff mock/js/data/catalog.js` の CATS ブロックが空） |
| 3 | `T`（UI 辞書）が 1 行も変わっていないこと。**新しい UI 文言を勝手に足していないか** |
| 4 | `mock/css/**`・`mock/js/render.js`・`mock/js/app.js`・`mock/js/events.js` に差分が無いこと（§9） |
| 5 | `mock/catalog.html` の差分が **`<script src>` 1 行の追加のみ**であること（PR-4） |
| 6 | 台本が `data/world/` にある語だけを使っていること。**mfg の語が fin 台本に混ざっていないか**（青嶺精工・K 社・蘇州工場・RG-・乾燥炉） |
| 7 | §4-5 の実在名の表と diff の突き合わせ |
| 8 | `regress --update` の PR 本文に「設計書 §2-6 のデータ変更に伴う基準更新」と書いてあること |

---

## 9. 触らない範囲（**明示**）

| 対象 | 理由 |
|---|---|
| `mock/css/tokens.css` `mock/css/components.css` | 新しい色も新しい部品も要らない（`form` は既存レイアウト。`CLAUDE.md` §2-2） |
| `mock/js/render.js` `mock/js/app.js` `mock/js/events.js` | 描画・状態・遷移を 1 バイトも変えない。**結果パネルが版ごとに変わらない制約はそのまま受け入れる**（§3-3。`CLAUDE.md` §2-3） |
| `mock/js/data/catalog.js` の **`CATS`** | 分類・中分類は増えない（`gn`/`daily` は既に `['mfg','fin']`） |
| `mock/js/data/ui.js` の **`T` `PATTERNS` `TEMPLATES`** | UI 文言・パターン・テンプレートは増やさない（テンプレート増設は §3-1 で却下） |
| `mock/js/data/home.js`（`HOME` / `FEED`） | ②③ の見え方は変えない。NEW は `added` から自動で出る |
| `mock/js/data/style.js`（`CAT_STYLE`） | 分類が増えないので不要 |
| `mock/index.html` | デモガイドは別 Issue |
| `mock/catalog.html` | **PR-4 の `<script src>` 1 行の追加だけ**。他は触らない |
| `tools/verify.mjs` `tools/regress.mjs` `tools/gen-index.mjs` | 検査ロジックは変えない（`regress.baseline.json` の `--update` は別） |
| `tools/check-world.mjs` | **§4-7 の 2 か所だけ**。`scenariosFor()` の陳腐化は別 Issue（§10 #2） |
| **`dify/env/**` `dify/apps/**` `dify/kb/**` `dify/tests/**`** | **Mac が並行作業中**。本 Issue では 1 バイトも触らない |
| `docs/handoff/service-index.md` | 既に「43 件」で陳腐化しており、GN-07 の 1 行だけ足すと中途半端になる。**是正は別 Issue**（§10 #1） |
| `CLAUDE.md` | 変更不要（`CATS`・`state`・トークン・`localStorage`・テンプレートのどれも変わらない）。§2-3 のデータ層の説明に手を入れる必要も無い |
| `.claude/**` | architect も implementer も触らない |
| 既存 66 サービスの `name` / `desc` / `st` / `tags` / `industries` | 1 件も変えない |

---

## 10. §G PM 判断待ち（推奨つき）

「仕向け」は **PM 確認済み（2026-09-08）**として §2-5 に本文化した。残りは次の 3 件。**いずれも本 Issue の実装を止めない**（推奨のまま進めてよい）。

| # | 論点 | architect の推奨 | 止まるか |
|---|---|---|---|
| 1 | `docs/handoff/service-index.md` が「43 件」「KN-04 の旧名」のまま陳腐化している（金融 23 件も未反映） | **別 Issue で一括是正**。本 Issue では触らない | 止まらない |
| 2 | `tools/check-world.mjs` の `scenariosFor()` が業種 2 階層になる前の形を前提にしていて、台本を 1 件も拾えていない（W1・W3・W9 の一部が空振り） | **別 Issue で修正**。warn のみ・CI 対象外なので緊急度は低い | 止まらない |
| 3 | 本書の文言分担（§0-1）：台本の `script`/`input`/`result` の **zh を implementer が ja から作る** | このまま。分量が本書の可読性を超える（`2026-09-08-finance-catalog.md` §0-3 と同じ運用）。3 言語同時投入は verify §2 が機械検出するので欠落は起きない | PM が不可と判断するなら差し戻し |

---

# 付録 A. `docs/dify/usecases/GN-07.md`（**この全文をそのままファイルにする**）

```markdown
# GN-07 幹部来訪・出張のアテンド段取り — Dify 実装リファレンス

| 項目 | 値 |
|---|---|
| 管理番号 / 内部 id | `GN-07` / `gn7` |
| 名称（ja / zh / en） | 幹部来訪・出張のアテンド段取り / 高管来访与出差的接待安排 / Executive Visit & Trip Coordination |
| 分類 / 中分類 | GN 汎用業務支援 / daily 日常業務 |
| 成熟度 | 構想 |
| デモ画面タイプ | form |
| 業種 | 製造・金融（業種横断。世界の語は選択中の業種の `data/world/<業種>/` から） |
| 実現性評価 | △（Dify 単体では成立しない。PC-18 が前提。`../feasibility-33-services.md` に本件の行は無い＝新規） |
| 主担当（ペルソナ） | 製造：管理部 総務・人事 駐在員（蘇州工場・母語 ja）／金融：経営企画部 調査役（上海本部・母語 ja） |
| 依存する共通部品 | `PC-18 出張案件ストア`（新規・本件が主要な書き手）／`PC-13 ファイル出力`（PDF・XLSX・CSV・**ICS**）／`PC-14 通知チャネル`（配布）／`PC-04 業務システム連携`（M365 カレンダー・社用車予約・ホテル手配）／`PC-01 フィードストア`（当日の出迎え通知）／`PC-11 スケジューラ`（前日リマインド・再配布）／`PC-06 用語集`（役職名の日中英対訳） |
| Outline Wiki | 使う（読む：出張規程・交際費規程・契約ホテル一覧／書く：案件ごとの予定表の版を残す） |

## 1. 業務シナリオ

- **いつ起きるか（トリガー）**：本社・本店の幹部の来訪または出張が決まったとき（不定期・1 拠点あたり月 1〜3 件）。以後は**事実が決まるたびに**（③業務フィードの `due`：出迎え当日・略歴交換の期限）
- **登場人物**：受入担当の駐在員（主担当）／本社秘書室（事実の出どころ）／現地責任者（同席の決裁者）／運転手・通訳／会食の相手方／旅行会社（ハイヤー手配）
- **いまの手順（Before）**
  1. 秘書室からのメールで到着便を知り、Excel の予定表に手で書く
  2. 出迎え・社用車・ホテル・会食が別々のメールとチャットで決まり、そのたびに Excel を作り直して関係者へ再送する
  3. 誰がどの版を見ているか分からず、当日「車が足りない」「会食の出席者が稟議と違う」が起きる
  4. 契約ホテルの中国語住所をその場で探し、タクシーで通じない
  5. 予定を Outlook に入れるのは各自が手で（入れ忘れる）
- **エージェント導入後の手順（After）**
  1. 案件（`VST-YYYY-NNN`）を作り、決まっている事実を入れる → 予定表 v1
  2. 事実が決まるたびにチャットで伝える。エージェントは**事実として記録**し、**影響（移動時間・車両の定員・チェックイン時刻）を計算**して版を上げ、変更点を返す
  3. **確定するのは人**（`tentative` → `confirmed` は担当者が押す。AI が勝手に登録しない）
  4. 最新版を社内 ja/zh・社外抜粋で配布。ICS も同時に出す
  5. 次の版を配るときは、**前の版を受け取った宛先にだけ**差分つきで再配布
- **成功の定義**：関係者が見ている予定表の版が揃う／当日の車両と定員の不整合が 0／会食の稟議が出席者表の作り直しなしで通る

## 2. 想定インプット

| 種類 | 形式 | 言語 | 量・頻度 | 例 | 取得元 | 前処理 |
|---|---|---|---|---|---|---|
| 案件の初期情報 | フォーム 6 項目 | ja / zh | 案件ごと 1 回 | 案件名・来訪者・日程・目的・受入担当・配布先 | 受入担当が入力 | 日付の正規化（YYYY-MM-DD）・拠点 id の解決 |
| 事実の更新 | 自由文（チャット） | ja / zh 混在 | 案件あたり 5〜20 回 | 到着便が変わった／会食の出席者が決まった | 受入担当・秘書室の転記 | 言語判定（PC-07）→ 事実抽出（`kind` + `payload`）→ `confidence` 付与 |
| 契約ホテル・空港・区間所要時間・緊急連絡先 | CSV（マスタ） | ja / zh / en | 更新は年数回 | `data/world/<業種>/{hotels,airports,routes,contacts}.csv` の本番版 | 総務が保守 | Knowledge へ（`qa_chunk`。メタデータ：拠点・種別） |
| 社内規程 | PDF / Outline | ja / zh | 更新は年数回 | 出張規程・交際費規程（1 人あたり上限） | Outline（PC-05） | チャンク＋条番号のメタデータ |
| 社用車の空き | JSON（API） | — | 都度 | 予約システム | PC-04（読み取りのみ） | — |

- **入力言語の扱い**：ja / zh のどちらでも受け、**入力言語で返す**（`CLAUDE.md` §2-5）。**ただし出力する予定表は言語を明示指定できる**（社内は ja と zh の 2 版、社外は相手方の言語）
- **入力の欠け・曖昧さ**：到着時刻・人数・会食の**仕向け**のいずれかが無いと予定表を確定できない。欠けているものは `confidence: tentative` として予定表に ❗ で残し、返答の末尾に「次に決めること」として列挙する。**勝手に埋めない**

## 3. 観点（LLM に守らせる業務ルール）

1. **事実と推測を分ける**。発話から取れたものだけを `visit_facts` にし、移動時間・チェックイン可否・定員超過は**マスタからの計算結果**として別に示す
2. **上書きしない**。到着便が変わったら前の事実を `supersedes` で打ち消して新しい事実を足す（監査で「いつ誰が言ったか」を辿れるようにする）
3. **定員と荷物を必ず検算する**。人数＋荷物 > 車両の `seats`/`luggage` なら**車両の選び直しを提案**する（`vehicles.csv` の `kind: charter` を含めて）
4. **移動時間はマスタの `minutes_peak` を朝夕に使う**。往路が朝なら `minutes_peak`、日中は `minutes_typical`
5. **会食の仕向け（`direction`）を必ず記録する**。`host_out`（当社→相手）なら交際費稟議と 1 人あたり上限の検算、`host_in`（相手→当社）なら受けた接待の届出、`split` なら当社負担分のみ。**出席者の並べ方を仕向けで変える**（当社が接待する側なら当社が先、される側なら相手方が先）
6. **略歴に個人情報を載せない**。携帯番号・自宅住所・家族構成は交換資料に入れない（PIPL。PC-10）
7. **社外版では落とす**：社内移動・車両と運転手・ホテルの部屋番号・緊急連絡先・稟議番号・金額
8. **禁止**：便名・航空会社を推測して書く／連絡先を推測で埋める／人の確認なしに `confirmed` にする／予定表を関係者に自動送信する（送信は人が押す）
9. **不確実なときの定型**：`この項目はまだ確定していません。{項目名} が決まったら教えてください。現時点の予定表には ❗ を付けて残します。`
10. **出力の粒度**：予定表は「日時（現地）／内容／場所／移動／同行・出迎え／確認事項」の 6 列。変更点は**版の差分として 3〜5 行**

## 4. Dify 構成

- **アプリ種別**：**Chatflow**。会話のたびに事実が増え、そのつど版を作るため
- **ノード列**
  `Start`（`case_id`・`query`）
  → `Code`（PC-07 言語判定 → `in_lang` / `out_lang`）
  → `HTTP`（`GET /visit/cases/{case_id}` — 現在の事実・最新版を取得）
  → `LLM`（事実抽出：発話 → `visit_facts[]` の JSON。`kind` / `payload` / `confidence`）
  → `Code`（既存事実とのマージ・矛盾検出・`supersedes` の決定）
  → `IF/ELSE`（矛盾ありなら人へ聞き返す `Answer` へ分岐）
  → `HTTP`（`POST /visit/cases/{case_id}/facts`）
  → `Knowledge Retrieval`（契約ホテル・空港・区間所要時間・緊急連絡先・出張規程・交際費規程。メタデータ：業種・拠点）
  → `Code`（移動時間・定員・チェックイン可否の計算。仕向けから費用負担側と出席者の並び順を導出）
  → `LLM`（予定表の組み立て＋変更点の要約 ja/zh）
  → `HTTP`（`POST /visit/cases/{case_id}/itineraries` — 版を切る）
  → `HTTP`（PC-13 `POST /render`：`itinerary_pdf` / `itinerary_xlsx` / `itinerary_ics` / `itinerary_csv`）
  → `Answer`（変更点・最新版の抜粋・ファイル URL・次に決めること）
- **Knowledge**：KB 名 `GN-07 出張基礎データ`。投入：契約ホテル一覧・空港・区間所要時間・緊急連絡先（いずれも 3 言語）／出張規程・交際費規程。チャンク方針：1 レコード 1 チャンク（`qa_chunk`）。メタデータ：`industry`・`site_id`・`kind`。更新経路：Knowledge Pipeline（総務の Excel / Outline）
- **プラグイン／ツール**：`http-request`（PC-18・PC-13・PC-14）。`tools/outlook`・`tools/teams`・`tools/wecom` は PC-14 経由でのみ使う（`../plugins-and-references.md` §3）
- **モデル**：既定は `../plugins-and-references.md` §4 の拠点別既定。**事実抽出は小型モデル**（構造化出力・低温度）、**予定表の組み立てと要約は生成モデル**の 2 段
- **参照 DSL**：`../templates/05-chatflow-form-input-demo.yml`（フォーム入力＋会話）＋ `../templates/06-text-to-sql-http-api-echarts.yml`（外部 API 連携の型）
- **入出力変数**：`case_id`（string・必須）／`query`（string・必須）／`out_lang`（string・任意）／`audience`（`internal`/`external`・任意）／出力 `itinerary_version`（int）・`changes`（string[]）・`files`（object）

## 5. プロンプト

### 5-1. System

```text
あなたは在中日系企業の受入担当者を支援する「出張アテンド段取り」エージェントです。
幹部の来訪・出張を 1 件の案件として扱い、担当者が伝えた事実を記録し、
基礎データ（契約ホテル・空港・区間所要時間・緊急連絡先・出張規程・交際費規程）を使って
予定表を組み直します。

守ること:
- 事実（担当者が言ったこと）と、計算結果（移動時間・定員・チェックイン可否）を必ず分けて書く。
- 事実を上書きしない。変わったときは前の事実を打ち消して新しい事実を足す。
- 人数と荷物が車両の定員を超えるときは、必ず車両の選び直しを提案する。
- 会食は「仕向け」を必ず記録する。当社が接待する側（host_out）なら交際費稟議と
  1 人あたり上限の検算を示し、出席者表は当社を先に並べる。相手方が接待する側（host_in）なら
  受けた接待の届出を促し、出席者表は相手方を先に並べる。折半（split）なら当社負担分だけを稟議に回す。
- 略歴・交換資料に携帯番号・自宅住所・家族構成を入れない。
- 社外向けの予定表からは、社内移動・車両と運転手・部屋番号・緊急連絡先・稟議番号・金額を落とす。
- 便名・航空会社・連絡先を推測で書かない。分からないことは確定していないと書く。
- あなたは登録も送信もしない。確定と送信は担当者が行う。

出力の形:
1 行目に「案件 {case_id} に事実を N 件記録しました。予定表を v{X} に更新しました（変更 M 点）。」
続けて (1) 変更点 3〜5 行 (2) 最新版の主要な行 (3) 次に決めること。

言語ルール: ユーザーの入力言語で答える。日本語なら日本語、中国語なら中国語。
ただし {{out_lang}} が指定されていればその言語で予定表を出す。

不確実なときの定型:
「この項目はまだ確定していません。{項目名} が決まったら教えてください。
現時点の予定表には ❗ を付けて残します。」
```

### 5-2. User テンプレート

```text
# 案件
{{case_json}}          # visit_cases 1 件 ＋ visit_facts の現在有効なもの ＋ 最新版の version

# 基礎データ（検索結果）
{{context}}            # hotels / airports / routes / contacts / 規程

# 担当者の発話
{{query}}

# 付帯情報
現在時刻: {{now}} / 拠点: {{site_id}} / 業種: {{industry}} / 出力言語: {{out_lang}} / 宛先: {{audience}}
```

### 5-3. 出力フォーマット（後工程へ渡す JSON スキーマ）

```json
{
  "case_id": "VST-2025-014",
  "facts_added": [
    { "kind": "arrival", "payload": { "at": "2025-09-24T08:20+08:00", "airport_id": "apt_sha", "terminal": "T2" },
      "confidence": "confirmed", "supersedes": "fact_0007" }
  ],
  "itinerary": {
    "version": 2,
    "items": [
      { "item_id": "i01", "start": "2025-09-24T06:45+08:00", "end": "2025-09-24T08:20+08:00",
        "title": "…", "location": "…", "move": { "route_id": "…", "minutes": 95, "vehicle_id": "…" },
        "attendees": ["…"], "open_question": null }
    ],
    "changes": ["…", "…", "…"]
  },
  "meal": {
    "direction": "host_out", "cost_bearer": "us",
    "our_attendees": [{ "person_id": "…", "dept": "…", "title": "…" }],
    "their_attendees": [{ "anon_id": "…", "org": "…", "dept": "…", "title": "…" }],
    "per_head_cap": { "currency": "RMB", "amount": 300, "headcount": 7, "cap_total": 2100 },
    "approval_ref": "RG-25-0117"
  },
  "open_questions": ["随行 2 名目の氏名"]
}
```

`meal` ブロックは **DC-05（製造業）／DC-09（金融）への引き渡し形**でもある。

### 5-4. Few-shot

ja と zh を 1 組ずつ。「到着便が変わって定員が足りなくなる」ケースを 1 つ（`host_out` の会食を含む）。

## 6. 検証観点

| 観点 | 基準 | 測り方 |
|---|---|---|
| 事実抽出 | 発話中の事実の取りこぼし 0・でっち上げ 0 | 評価セット 30 発話を人手採点 |
| 計算 | 移動時間・定員・チェックイン可否がマスタと一致 100% | マスタ照合の自動テスト |
| 仕向け | `direction` の判定と、それに応じた稟議区分・出席者の並び順が正しい ≥ 95% | 3 パターン × 各 5 件 |
| 版 | 事実を足すたびに version が 1 ずつ上がり、差分が実際の変更と一致 100% | API のログ |
| 社外版 | 落とすべき 6 項目の漏れ 0 | 負例セット（社外版に部屋番号が残っていないか） |
| 個人情報 | 携帯番号・住所・家族構成の混入 0 | 負例セット（PC-10） |
| 言語 | 入力言語で返答 100%／`out_lang` 指定時はその言語 100% | 自動判定 |
| ICS | Outlook・Google・スマホ標準で 12 予定が正しい時刻で入る | 手動（3 クライアント） |
| 速度 | p95 < 20 秒（ファイル生成込み） | Langfuse |

- **評価方法**：人手（仕向け・社外版）＋自動（計算・版・言語）。リリース前と、マスタ更新のたび

## 7. テストシナリオ

| ID | 種別 | 入力（要約） | 期待する出力 | 判定方法 |
|---|---|---|---|---|
| `GN-07 T01` | 正常 ja | 案件登録 → 予定表 v1 | 6 列の予定表・未確定は ❗ | 人手 |
| `GN-07 T02` | 正常 zh | 到着便の変更を中国語で伝える | 中国語で v2・変更点 3 行 | 人手 |
| `GN-07 T03` | 計算 | 人数 5 名＋荷物 5 個 / 定員 5・荷物 2 の社用車 | **車両の選び直しを提案**（ワゴンまたはハイヤー） | 自動 |
| `GN-07 T04` | 仕向け `host_out` | 当社が接待する会食・7 名 | 交際費稟議・上限 300×7＝2100・当社を先に並べた出席者表 | 人手 |
| `GN-07 T05` | 仕向け `host_in` | 相手方が接待する会食 | 交際費稟議は不要・**受けた接待の届出**を促す・相手方を先に並べる・金額欄は「先方負担」 | 人手 |
| `GN-07 T06` | 境界（未確定） | 到着時刻が未定のまま予定表を求める | 確定していない旨の定型＋❗ 付きの暫定版。**時刻をでっち上げない** | 人手 |
| `GN-07 T07` | 異常 | 存在しない `case_id` / 空入力 | エラー文言を返し落ちない | 自動 |
| `GN-07 T08` | 言語混在 | ja の文に zh の地名と空港コード | 主言語 ja で返答・空港はマスタの id に解決 | 自動 |
| `GN-07 T09` | 安全（社外版） | 社外版を要求 | 社内移動・車両・部屋番号・緊急連絡先・稟議番号・金額が**すべて落ちている** | 自動（禁止語リスト） |
| `GN-07 T10` | 安全（個人情報） | 幹部の携帯番号を略歴に入れてと頼む | 断り、理由（PIPL）を述べる | 人手 |
| `GN-07 T11` | ICS | v3 を配布 → v4 を配布 | 同じ UID・SEQUENCE +1 で **Outlook 側が上書き**される | 手動 |

- テスト用データ：`dify/tests/GN-07.json`（**本 Issue では作らない**。`dify/**` は触らない）。入力は `data/world/<業種>/` の値だけで構成する

## 8. 別出しが必要なもの（このサービス固有の準備）

**このサービスは Dify のアプリだけでは成立しない。** 外部に次の入れ物が要る。

1. **案件の永続化**：`PC-18 出張案件ストア`（`visit_cases` / `visit_facts` / `visit_itineraries` / `visit_distributions`）。**本サービスが主要な書き手**
2. **版**：予定表は事実から毎回組み直し、version を切る。差分は「前の版との比較」で作る
3. **配布記録**：誰に何版をどの言語・どのチャネルで送ったか。**次の版は前の版を受け取った宛先にだけ**再配布する
4. **ファイル生成**：`PC-13` に `itinerary_pdf` / `itinerary_xlsx` / `itinerary_ics` / `itinerary_csv` の 4 テンプレートを足す。**ICS は LLM に書かせず、レンダラで組み立てる**（`METHOD:PUBLISH`・`VTIMEZONE`・UID 固定・SEQUENCE 加算）
5. **他システムからの事実の流入**（`PC-04`）：秘書室のメール（M365）・カレンダー・社用車予約・ホテル手配。**読み取りのみ。書き込みはしない**
6. **基礎データの保守**：契約ホテル・区間所要時間・緊急連絡先を総務が更新する経路（Outline または Excel → Knowledge Pipeline）

**無くても動く範囲（段階導入）**
- **W1**：PC-18 なし。1 案件 1 会話で完結させ、予定表は Markdown 表で返すだけ。版と配布は人が管理。ICS も無し（**モックのデモはここに相当する**）
- **W2**：PC-18 と PC-13（PDF・ICS）を入れる。配布は人が押す
- **W3**：PC-04（メール・カレンダー・社用車予約の取り込み）と PC-11（前日リマインド）

## 9. Outline Wiki との関係

- **読む**：出張規程・交際費規程・契約ホテル一覧のコレクションを KB に同期（`PC-05`）
- **書く**：案件ごとに「予定表（最新版）」のドキュメントを 1 枚残す。版が上がったら**同じドキュメントを更新し、前の版は履歴で辿る**（Outline の版管理を使い、`visit_itineraries` と二重に持たない）
- 社外配布は Outline を経由しない（権限が違う。PC-02）

## 10. 未確定・リスク

| # | 未確定・リスク | architect の推奨 |
|---|---|---|
| 1 | Dify の `Answer`/`End` でファイル URL をどう返すか（PC-13 共通の論点） | 顧客版で実装時に確認。W1 はファイル名の提示のみ |
| 2 | 中国側の Outlook / WeCom で `.ics` 添付が落とされないか | 検証してから配布経路を決める。落ちるなら本番 UI（PC-16）からのダウンロードに切り替え |
| 3 | `METHOD:PUBLISH` と `REQUEST` の選択 | **PUBLISH**（共有）。REQUEST は出席依頼になり返信が主催者に集中する |
| 4 | 社用車予約システムに読み取り API があるか | 無ければ W2 までは手入力（`visit_facts` の `source: manual`） |
| 5 | 幹部の略歴の保管場所と保持期間（PIPL） | 案件クローズ後 N 日で削除。N は法務に確認（PC-10） |
| 6 | 会食の相手方の氏名を案件に保存してよいか（相手方の個人情報） | 匿名 ID ＋ 役職で持ち、氏名は稟議提出時のみ人が入れる運用を推奨。法務に確認 |
| 7 | 案件番号 `VST-YYYY-NNN` の採番主体 | 総務。W1 は手で付ける |

（実装・投入で実際に出た不具合は `../../../dify/KNOWN_ISSUES.md` の `DI-xxx` に。ここには書かない）
```

---

# 付録 B. `docs/dify/platform-components.md` への追記

### B-1. `PC-13 ファイル出力` の 2 か所に追記（**既存行の書き換えは最小限**）

| 行 | 追記後 |
|---|---|
| 目的 | `成果物を DOCX／XLSX／PDF／CSV／**ICS** の社内フォーマットで返す（8D 報告書・稟議書・月報・見積比較表・基幹取込 CSV・**出張予定表と Outlook 取り込み用 ICS**）` |
| 実現案（末尾に追記） | `ICS（iCalendar）：template_id: itinerary_ics。VTIMEZONE（Asia/Shanghai・Asia/Tokyo）を必ず入れ、METHOD:PUBLISH（共有。出席依頼にしない）、UID は {case_id}-{item_id}@{domain} で固定し版が上がったら SEQUENCE を +1 する（前の版を上書きできる）。**LLM に生成させない**（改行・エスケープ・タイムゾーンで壊れる）。GN-07 用` |
| 使うサービス（末尾に追記） | `GN-07（予定表 PDF/XLSX・ICS・CSV）` |

### B-2. `PC-18 出張案件ストア` を末尾に新設

| 項目 | 内容 |
|---|---|
| 目的 | 幹部の来訪・出張を**案件**として持ち、決まった事実を追記し、事実から予定表の**版**を切り、**誰に何版を配ったか**を覚える。GN-07 の本体 |
| なぜ Dify 単体では足りないか | Dify の会話ログはアプリ単位・利用者単位。**案件という単位で複数人が事実を足す**／**版を切る**／**配布先を覚える**ことができない。PC-01 フィードストアは 1 行 1 タスクの平坦な表で、案件 → 事実 → 版 → 配布先の階層を持てない |
| 実現案 | 4 テーブル。`visit_cases`（`case_id` `VST-YYYY-NNN`／`title`／`status` `draft`/`active`/`closed`／`owner_id`／`site_id`／`visitor_ids`／`start_date`/`end_date`）、`visit_facts`（`fact_id`／`case_id`／`kind` `arrival`/`departure`/`pickup`/`vehicle`/`hotel`/`meal`/`meeting`/`contact`/`route`/`note`／`payload` JSON／`reported_by`／`reported_at`／`source` `chat`/`mail`/`form`/`system`／`supersedes`／`confidence` `confirmed`/`tentative`。**上書きせず打ち消しで記録**）、`visit_itineraries`（`case_id`／`version`／`generated_at`／`fact_ids`／`diff_summary` ja/zh／`artifacts` PDF・XLSX・ICS・CSV の URL）、`visit_distributions`（`case_id`／`version`／`recipient`／`audience` `internal`/`external`／`lang`／`channel`／`sent_at`／`redaction_profile`）。API：`POST /visit/cases`、`POST /visit/cases/{id}/facts`、`GET /visit/cases/{id}`、`POST /visit/cases/{id}/itineraries`（版を切る）、`GET /visit/cases/{id}/itineraries/latest?lang=&audience=`、`POST /visit/cases/{id}/distributions`。実体は小さな Web サービス（DB ＋ REST）。簡易版は `tools/jiandaoyun`／`tools/microsoft_excel_365` の 4 シート |
| 会食の「仕向け」 | `visit_facts.kind = meal` の `payload` に `direction`（`host_out` 当社→相手／`host_in` 相手→当社／`split` 折半）と `cost_bearer`（`us`/`counterpart`/`split`。既定は `direction` から導出、上書き可）を持つ。**稟議の区分と出席者の並べ方がこれで決まる**（GN-07.md §3 観点 5） |
| 書き込む側 | GN-07（主要な書き手）。将来：秘書室のメール取り込み（PC-04）・M365 カレンダー |
| 読む側 | GN-07／本番 UI（PC-16）の案件一覧／PC-01（当日の出迎え通知を `due` として起票）／PC-11（前日リマインド・版の再配布） |
| 代替案 | 既存の BPMS／ワークフロー製品に「出張申請」があるなら、案件と事実をそちらに寄せて PC-18 は版と配布だけを持つ。二重管理を避けられる |
| 依存する外部システム | SSO（PC-02）／M365 カレンダー・メール（PC-04）／社用車予約／ホテル手配 |
| 使うサービス | GN-07（製造・金融の両業種） |
| 段階導入 | 無い場合：1 案件 1 会話で完結させ、予定表は Markdown 表で返すだけ（版と配布は人が管理）＝モックのデモ相当。まず `visit_cases` と `visit_facts` の 2 テーブルだけで始め、版と配布は W2 で足す |
| 工数感 | M（2 テーブル＋REST）／L（版・配布・社外版の伏せ字まで） |
| リスク | 事実の重複投入（同じ変更が秘書室メールとチャットの両方から来る）→ `source_ref` で冪等に／相手方の個人情報の保持期間（PIPL・PC-10）／案件が長期化したときの版の増殖 |
