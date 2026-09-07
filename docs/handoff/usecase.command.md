---
description: Notion のページ／DB を読み込んでユースケース化する。統廃合を判定し、設計書・実装リファレンス・Issue を作り、モックのデータ層まで実装してマージし、Notion に書き戻す。
---

<!--
このファイルは architect の成果物（コマンド本文案）です。
配置は PM が行います：  cp docs/handoff/usecase.command.md .claude/commands/usecase.md
根拠となる段取りの設計書：docs/handoff/2026-09-07-usecase-intake.md
architect / implementer は .claude/** を触りません。
-->

対象: $ARGUMENTS

`$ARGUMENTS` は次のいずれか。

- **Notion ページ URL** … そのページ 1 本を候補にする
- **Notion DB URL** … その DB の**状態＝`候補`** の行を対象にする（`未処理を全部` を添えると全件）
- **候補カードのタイトル** … 既に「ユースケース候補」DB にある行を進める
- **口頭の要望文** … 元ページが無い候補（GN-06 がこの形）。S1 を飛ばして S2 から

段取りの正本は `docs/handoff/2026-09-07-usecase-intake.md`（S0〜S13）。**このコマンドはその実行手順**。
各ステップの結果を短く報告しながら進め、**★ の停止条件に当たったら必ず止まって PM（ユーザー）に判断を求める**。

---

## 0. 指定を確定する

- `$ARGUMENTS` を **ページ／DB／カード名／口頭要望** のどれかに分類し、宣言する
- DB 指定なら **状態＝`候補`** の行を一覧にする。**2 件以上なら「S1〜S2 を全件並列 → S3 以降は 1 件ずつ直列」**（設計書 §9-4）と宣言する
- 停止：URL が解決できない／権限が無い → PM に返す

## 1. 取得（Notion MCP）

- ページ本文・タイトル・最終更新日・親 DB のプロパティを取得し、scratchpad に `raw-<page>.md` として保存する
- **リポジトリに原文をコミットしない**（`CLAUDE.md` §2-10）。設計書に載せるのは要約と、製造業（青嶺精工・蘇州工場）の仮設定に置き換えた表現だけ
- 停止：本文が空／画像だけ／子ページに本体がある／**顧客実名・個人情報が含まれる** → PM に確認

## 2. 候補カードを作る

`raw-<page>.md` から 8 項目を埋める。**読めない欄は空のままにする（推測で埋めない）**。

1. 仮タイトル ／ 2. 誰が使うか ／ 3. 誰に出すか・どこへ渡すか ／ 4. 入力 ／ 5. 出力 ／ 6. 観点 ／ 7. 成功の定義 ／ 8. 既存 43 件で近いもの（管理番号 3 件まで）

- 8 は `docs/handoff/service-index.md` と `docs/dify/usecases/README.md` を読んで挙げる
- **1 ページから候補が 2 つ以上読めるときは、勝手に 2 枚にせず、分割案として次のステップで PM に出す**
- Notion に書き戻せるなら 状態を `候補` → `確認中` に上げる

## ★3. PM 確認（4 問）

空欄が 1 つでもあれば、**この形で 1 メッセージにまとめて PM に出し、回答が来るまで止まる**。

```
Notion「<ページタイトル>」を読みました。ユースケース候補 1 件として扱います。
読めた範囲：
  入力  … <ページから読めたこと>
  出力  … <ページから読めたこと>
  観点  … <ページから読めたこと>
読めなかった点を 4 つ確認させてください。（1 つでも空だと設計をやり直すことになります）

Q1 対象者：誰が使いますか。<候補A>／<候補B>／両方
Q2 目的  ：使った結果どうなればよいですか。<候補>／<候補>
Q3 観点  ：何を見てほしいですか。対象範囲はどこまでですか（種別・部署・拠点）
Q4 出口  ：出力はどこへ行きますか。記録に残しますか。人事評価に使いますか

（統廃合の見立ては次のメッセージで出します。既存では <管理番号> <管理番号> が近いです）
```

- **空欄が 0 個なら S3 を飛ばしてよい。ただし「4 問はページから読めたので確認を省いた」と報告する**
- 回答は「PM 決定（再検討不要の前提）」として設計書の冒頭に箇条書きで載せる
- 停止：2 つ以上が埋まらない → Notion カードを `保留` にして終了を報告する

## 4. 統廃合を判定する

既存 43 件のうち近い 3 件について、**5 軸（分類／タグ／ペルソナ／入出力／出口）の一致数**を表にする。

| 一致数 | 判定 |
|---|---|
| 5 / 4 | **統合**（既存サービスの差し替え。新規採番しない） |
| 3 | **モード化 or 目的別分割** ★PM に返す |
| 2 / 1 | **別サービス**（新規採番） |
| 0 | 別サービス。ただし**新分類の要否を PM に確認** |

分かれ目：**画面を分けないと使えないなら分割。フォームの 1 項目で切り替えられるならモード。**

- 判定と推奨を Q5 として PM に出す（一致数 3 のときは必ず。それ以外は推奨を宣言して進んでよい）
- 詳細は設計書 §3

## 5. 配置・採番

- 分類 `cat` ／ 中分類 `sub` ／ 成熟度 `st`（1 提供中 / 2 試行版 / 3 構想）／ デモテンプレート（`qa` `upload` `form` `diff` `lookup` の 5 種。**増やさない**）を決める
- 管理番号 ＝ **分類内の最大番号 +1、永久欠番、改名なし**（`CLAUDE.md` §2-11）。最大番号は `docs/handoff/service-index.md` ∪ **Notion カードで予約済みの番号**から取る
- 採番したら **即座に Notion カードの「管理番号」列に書く（予約）**
- 停止：既存 8 分類 17 中分類のどれにも入らない → **新分類は PM 判断**（`regress` の `cats`/`subs` が動く）

## 6. 設計（architect）

`architect` サブエージェントに依頼：

> 「<候補タイトル>」の設計をして。前提は次のとおり（PM 決定・再検討不要）：
> Q1 対象者＝… ／ Q2 目的＝… ／ Q3 観点＝… ／ Q4 出口＝… ／ 統廃合判定＝<統合|モード化|分割|新規>（Q5 の PM 回答）
> 配置＝分類 `<cat>` / 中分類 `<sub>` / 成熟度 `<st>` / テンプレート `<template>` / 管理番号 `<XX-NN>`（内部 id `<id>`）
>
> 成果物：
> 1. `docs/handoff/YYYY-MM-DD-<slug>.md` — 目的／変更する範囲／**触らない範囲（ファイル・関数の粒度で）**／受け入れ条件／**`SVCS.<id>` と `SCENARIOS.<id>` のリテラル全文（ja・zh・en の 3 言語すべて。implementer に翻訳させない）**／差し替え位置（行数と目印）／変更前後の件数と id 一覧／PR 分割案／PM 判断待ち（推奨つき）
> 2. `docs/dify/usecases/<XX-NN>.md` — `docs/dify/usecases/_TEMPLATE.md` の **10 節すべて**（書けない節は「未確定」と書いて残す）
> 3. 必要なら `docs/dify/platform-components.md` の PC 追記（**触る PC の行だけ**）
> 4. `docs/handoff/<slug>.issue.md`（`gh` が無いため Issue 本文はファイルに出す）
>
> **必須**：リテラルを scratchpad の作業用コピー（`cp -r <repo> <scratchpad>/verify-<slug>`）に差し込んで `node tools/verify.mjs` と `node tools/regress.mjs` を**先に実走**し、その出力を設計書の受け入れ条件に期待値として書くこと。**リポジトリの `mock/**`・`tools/**` は 1 文字も触らないこと。git は触らないこと。**
> 地雷：`q`/`a` に `'`（U+0027）を使わない／`SCENARIOS` リテラルの内側の `}` を行頭に置かない／3 言語同時／`st` は 1-3／`id` は `/^[a-z]{2}\d+$/`。
> 報告：設計書パス・Issue 本文パス・PR 分割案・PM 判断待ち。

**停止条件**：architect が「PM 判断待ち」を返し、かつ**「推奨案で進めてよい」と書いていない**項目があれば、PM に提示して止まる。

## 7. Issue

- `gh` があれば Issue を立てる。無ければ `docs/handoff/<slug>.issue.md` を PM に渡し、**PM が起票した番号を待つ**
- 既存 Issue に対する追記なら `docs/handoff/<slug>.issue.md` を「追記案」として出す

## ★8. PM 承認

- **UI の見せ方（画面構成・レイアウト・パターン）を変えるお題のみ**、設計書のレイアウト図と変更点を提示して承認を得る
- **データ層のみ（`SVCS`/`SCENARIOS` の追加・差し替え）なら省略**してよい
- PM 判断が確定したら、**設計書の末尾に「§N 追補（PM 判断確定後）」として追記**する。**§0〜の本文は 1 文字も書き換えない**
- Notion カードを `設計中` → `実装中` に上げる

## 9. PR-A（docs のみ）

git 操作は**このコマンド（親エージェント）**が行う。architect には git を触らせない。

```bash
git -C <repo> worktree add <scratchpad>/wt-docs-<slug> -b docs/<slug>
# architect の成果物を worktree にコピー（新規ファイルのみ）
git -C <scratchpad>/wt-docs-<slug> add docs/handoff/YYYY-MM-DD-<slug>.md docs/handoff/<slug>.issue.md docs/dify/usecases/<XX-NN>.md
# PC を触ったときだけ： git add docs/dify/platform-components.md
git -C <scratchpad>/wt-docs-<slug> commit -m "docs: <XX-NN> <名称> の設計書・実装リファレンス"
git -C <scratchpad>/wt-docs-<slug> push -u origin docs/<slug>
```

- **`git add -A` / `git commit -a` は禁止**。設計書の「変更する範囲」に挙がったパスだけを明示 add する
- **`mock/**`・`tools/**` の差分が 1 行でもあれば、その場で止める**
- コミットメッセージ末尾に、実行中のセッションで指示されている attribution（`Co-Authored-By:` と `Claude-Session:`）をそのまま付ける
- PR 本文の末尾に `🤖 Generated with [Claude Code](https://claude.com/claude-code)` と セッション URL を付ける

PR-A 本文の型：

```
## 概要
<XX-NN> <名称> の設計書と Dify 実装リファレンス。**docs のみ**。mock / tools は 1 行も触っていない。

## 元ネタ
Notion「<ページタイトル>」（原文はコミットしていない。要約と製造業への置き換えのみ）

## 統廃合の判定
5 軸一致 <n>/5 → <判定>。根拠表は設計書 §<n>

## 含むファイル
- docs/handoff/YYYY-MM-DD-<slug>.md（設計書。リテラル全文・受け入れ条件）
- docs/dify/usecases/<XX-NN>.md（_TEMPLATE.md の 10 節）
- docs/handoff/<slug>.issue.md
- （あれば）docs/dify/platform-components.md … PC-<nn> の <n> 行のみ

## 検証
node tools/verify.mjs → <貼り付け>
node tools/regress.mjs → <貼り付け>
（docs のみのため変更前と同一）

## 触っていない範囲
mock/** / tools/** / CLAUDE.md / .claude/** / 既存の設計書
```

## 10. PR-B（mock データ層＋件数追従）

`implementer` サブエージェントに依頼：

> Issue #<番号>（設計書 `docs/handoff/YYYY-MM-DD-<slug>.md`）を実装して。
> **作業は worktree で**：
> ```bash
> git -C <repo> worktree add <scratchpad>/wt-<issue> -b feat/<issue>-<slug>
> ```
> 以降のコマンドはすべて `-C <scratchpad>/wt-<issue>` を付けるか、そのディレクトリの絶対パスで実行する。**main には直接コミットしない。**
>
> 設計書 §<n> のリテラルを**そのまま転記**する。**翻訳・言い換え・数字の作り直しをしない。** 差し替え位置は設計書に行数と目印で書いてある。
> 触るのは設計書の「変更する範囲」の表に挙がったファイルだけ。「触らない範囲」のファイルは開かない。
>
> 検証：
> ```bash
> node tools/verify.mjs     # 設計書 §<n> の期待値と一致すること
> node tools/regress.mjs    # 差分が設計書 §<n> の件数・id 一覧と一致すること
> ```
> `regress` が FAIL し、かつ**設計書にそのデータ変更が書いてある**ときだけ `node tools/regress.mjs --update` を実行し、PR 本文に「設計書 §<n> のデータ変更に伴う基準更新」と書く。書いていない差分は意図しない破壊なので直す。
>
> コミットは **`git add -A` を使わず、変更したパスを明示** して add する。コミットメッセージ末尾にセッション指示の attribution を付ける。
> PR 本文に：設計書パスとセクション／変更要約／`verify` と `regress` の出力の貼り付け／`--update` の有無と理由／触っていない範囲（設計書の「触らない範囲」を再掲）／`🤖 Generated with [Claude Code]…`。
> 報告：PR 番号・検証結果・触ったファイル一覧。

**停止条件**：implementer が「設計書と矛盾」「設計書に無いデータ変更が必要」「load-bearing を破らないと実装不可」を返したら止まる。

**件数が動いたときの追従先（implementer に渡すチェックリスト）**

1. `mock/catalog.html`（`SVCS` / `SCENARIOS`）
2. `tools/regress.baseline.json`（`--update`。統合＝差し替えのときは**動かない**）
3. `docs/handoff/service-index.md`（見出しの件数 ＋ 行）
4. `docs/dify/usecases/README.md`（見出し・一覧行・**集計 4 行**・依存 PC 逆引き・実装の波）
5. `docs/dify/outline-wiki-usecases.md`（§2 の表・件数・集計）
6. `docs/dify/README.md`（件数）
7. `docs/dify/implementation-guide.md`（件数）
8. `CLAUDE.md` §6 → **触らない。PM が別途更新**

## 11. レビュー・マージ（reviewer）

`reviewer` サブエージェントに依頼：

> PR #<番号> を検証して。ブランチをチェックアウトして `node tools/verify.mjs` と `node tools/regress.mjs` を実行し、`gh pr diff`（無ければ `git diff main...<branch>`）で diff を設計書 `docs/handoff/YYYY-MM-DD-<slug>.md` と `CLAUDE.md` の load-bearing に照合して。
>
> **逐語照合（必須）**：
> - 設計書 §<n> のリテラルと diff を**文字単位で**突き合わせる（3 言語の `name`/`desc`/`steps`、`script` の数字、`persona`）
> - `regress` の差分行が設計書の「変更前後の件数と id 一覧」と**一字一句一致**するか
> - 設計書の「触らない範囲」に挙がったファイルが PR に**含まれていないこと**
> - 管理番号が `service-index.md` / `usecases/README.md` / `mock/catalog.html` の 3 か所で一致し、欠番・改名が無いこと
> - 多言語辞書に 1 言語だけ追加されていないこと、コンポーネント CSS に色の直値が増えていないこと、`--ntt-*` が不変であること、`localStorage` キー・`pages.yml` の `path: mock`・`mock/.nojekyll` が無事であること
>
> **Playwright 目視**：設計書の「目視」節の項目を、**P1 / P2 / P3 × ライト / ダーク × ja / zh / en** で確認する。
>
> 全 PASS かつ逸脱なしなら squash マージしてブランチを削除し、Pages 反映（`https://shoulang0729.github.io/dify/`）を確認して報告して。reject なら「何が・どこで・設計書のどの記述と食い違うか」を具体的に。**自分で直さないこと。**

**停止条件**：reject されたら理由を PM に報告し、**自動で再実装ループに入らずに指示を待つ**。

## 12. Pages 確認と `CLAUDE.md` §6

- reviewer の Pages 確認結果を報告する
- **`CLAUDE.md` §6 の件数（分類数・中分類数・サービス数・成熟度内訳）の更新は PM が行う**。更新すべき 1 行を、更新前後の文字列つきで PM に提示する
- worktree を片付ける：`git -C <repo> worktree remove <scratchpad>/wt-<issue>`

## 13. Notion 書き戻し

**自動で書く欄**（事実）：状態／管理番号／分類候補／判定／設計書 URL／PR URL／Issue URL／取込日／実装リファレンス URL
**PM が書く欄**（判断）：PM メモ／統合先／`保留` への遷移

URL は **main の blob URL**（`https://github.com/shoulang0729/dify/blob/main/docs/handoff/…`）。ブランチ URL は squash マージ後に消えるので使わない。

書き戻し文面：

```
状態：公開済み
管理番号：<XX-NN>
分類候補：<XX>
判定：<新規 | 統合 | 目的別分割 | モード化 | 保留>
設計書 URL：https://github.com/shoulang0729/dify/blob/main/docs/handoff/YYYY-MM-DD-<slug>.md
実装リファレンス：https://github.com/shoulang0729/dify/blob/main/docs/dify/usecases/<XX-NN>.md
PR URL：
  #<A> docs（設計書・実装リファレンス）
  #<B> mock（SVCS / SCENARIOS）
  #<C> CLAUDE.md §6 件数更新
PM メモ：
  Q1 対象者＝…／Q2 目的＝…／Q3 観点＝…／Q4 出口＝…
  デモ：https://shoulang0729.github.io/dify/ → <分類名> → <XX-NN>
```

書き込み権限が無ければ、上の文面を PM に渡して手動更新を依頼する。

---

## 並列・直列

| | ルール |
|---|---|
| **S1〜S5** | 何件でも並列可（ファイルを触らない） |
| **S6・S9（docs）** | slug・管理番号が違えば **2〜3 本まで並列可**。`docs/dify/platform-components.md` は**同じ PC を触るときだけ直列** |
| **S10（mock）** | **同時に 1 本まで**。`mock/catalog.html` の `SVCS`/`SCENARIOS`、`tools/regress.baseline.json`、`docs/dify/usecases/README.md`、`docs/handoff/service-index.md` が必ず衝突する。2 件目は 1 件目の squash マージ後に rebase して着手 |
| **採番** | S5 で採番したら即 Notion に予約を書く。次の候補は `service-index.md` ∪ 予約済み の最大 +1。保留になった番号は解放しない（永久欠番） |

`batch` の推奨：**S1〜S2 を全件並列 → PM が優先順位 → 1 件目 S3〜S13 → 2 件目 …**（2 件目の S3〜S9 は 1 件目の S10 と並行可）

---

## 停止条件の一覧（ここに当たったら必ず PM に返す）

1. Notion の URL が解決できない／権限が無い（S0・S1）
2. 原文に顧客実名・個人情報が含まれる（S1）
3. **4 問（対象者・目的・観点・出口）のうち 1 つでも読めない**（★S3）
4. 1 ページから候補が 2 つ以上読める（S2 → 分割案を出す）
5. 統廃合の 5 軸一致が **3 ちょうど**（モード化か分割かが割れる）（S4）
6. 既存 8 分類 17 中分類に入らない＝**新分類が要る**（S5）
7. architect が「PM 判断待ち」を返し、推奨案での続行が明記されていない（★S8）
8. UI の見せ方を変える（★S8 モック承認）
9. implementer が「設計書と矛盾」「設計書に無いデータ変更が必要」「load-bearing を破らないと実装不可」（S10）
10. `verify` / `regress` が FAIL、または reviewer が reject（S11）
11. `CLAUDE.md` の変更が必要（S12。**PM のみが触る**）

---

## 完了報告

```
対象:   Notion「<ページタイトル>」（<URL>）
候補:   <仮タイトル> → <XX-NN> <確定名称>
判定:   <新規 | 統合 | 目的別分割 | モード化 | 保留>（5 軸一致 <n>/5・根拠は設計書 §<n>）
設計書: docs/handoff/YYYY-MM-DD-<slug>.md
参照:   docs/dify/usecases/<XX-NN>.md
Issue:  #<番号>（または docs/handoff/<slug>.issue.md）
PR:     A #<番号> docs → squash マージ済み / B #<番号> mock → squash マージ済み
verify: PASS / FAIL   regress: PASS / 差分 <n> 行（設計書と一致・不一致）
件数:   <8 分類 17 中分類 N サービス（提供中 a／試行版 b／構想 c）>
公開:   https://shoulang0729.github.io/dify/ 反映確認 済 / 未
Notion: 書き戻し 済 / 文面を PM に提示
CLAUDE.md §6: PM 更新待ち（<変更前> → <変更後>）
PM判断待ち: （あれば）
```
