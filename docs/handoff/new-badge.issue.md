# Issue 追記案 — #74 NEW 表示（`SVCS[].added` から ①バッジ / ②新着帯 / ③お知らせを自動生成）

> この環境に `gh` が無いため本文をファイルで渡す。PM が Issue #74 にコメント（または本文差し替え）として貼ってください。

## タイトル

```
feat(catalog): SVCS[].added（追加日）から ①カードバッジ / ②新着帯 / ③お知らせを自動表示
```

## ラベル案

`lane:M` `area:mock` `area:tools` `area:i18n`

## 設計書

- **`docs/handoff/2026-09-07-new-badge.md`**（implementer は文言・コード片をここからそのまま転記する）
- 併読：`docs/handoff/2026-09-06-design-pass.md` §13（① への回帰の許容範囲の書き方）

## 概要

サービスを足しても、レビュー参加者には「どれが増えたのか」が見えない。**サービスに追加日を 1 つ持たせ、そこから 3 パターンすべての新着表示を自動で生やす**。新着リストを手書きしない（必ず更新が漏れて古い新着が居座るため）。

- `SVCS[].added: 'YYYY-MM-DD'` は**任意**。既存 41 件には付けない（＝NEW にしない）。**`dc8`（DC-08）と `gn6`（GN-06）に `'2026-09-07'`** だけ付ける
- `NEW_DAYS = 30` / `DEMO_DATE`（`null` なら実際の今日。`'2026-09-20'` のように固定すればデモ当日に NEW を出し続けられる）/ 判定は `isNew(x)`
- ① カード（`cardHTML`）と詳細ヘッダー：管理番号の隣に **NEW** バッジ。トークン `--badge-new-bg` / `--badge-new-fg` を light / dark **同時**に追加（`--ntt-turquoise` 由来）
- ② ダッシュボード：統計の直下に「新しく追加されたエージェント」の帯（`added` 降順で最新 3 件・追加日・`cardHTML` 再利用）。**新着 0 件なら帯ごと出ない**
- ③ 業務フィード：「お知らせ」の先頭に自動生成の `notify` 行（「新しいエージェント DC-08 が使えます」）。`.sec-count` は自動行を含む（2 → **4**）
- **`state` / `data-act` / `view` は増やさない。`HOME` / `FEED` には 1 件も書かない**

## 変更するもの

| ファイル | 変更 | 設計書 |
|---|---|---|
| `mock/catalog.html` | `SVCS` の `dc8` / `gn6` に `added: '2026-09-07'` | §2-1 |
| `mock/catalog.html` | `T` に 6 キー（`newBadge` / `dashNew` / `dashNewNote` / `addedOn` / `feedNewWhen` / `feedNewAgent`、3 言語全文） | §2-2 |
| `mock/catalog.html` | 1 つ目 `<style>`：`--badge-new-bg` / `--badge-new-fg`（light・dark） | §2-3 |
| `mock/catalog.html` | 2 つ目 `<style>`：`.badge-new` / `.card .c-top .c-code` / `.dash-new .new-item` / `.dash-new .new-date` | §2-4 |
| `mock/catalog.html` | §4 ヘルパー：`NEW_DAYS` / `DEMO_DATE` / `today()` / `daysSince()` / `isNew()` / `newSvcs()` | §2-5 |
| `mock/catalog.html` | `newBadgeHTML()` ＋ `cardHTML` の `.c-top` ＋ 詳細 `.d-code` | §2-6 / §2-7 |
| `mock/catalog.html` | `dashSectionsHTML()` に新着帯、`return` の先頭に連結 | §2-8 |
| `mock/catalog.html` | `newFeedItems()` ＋ `feedSectionsHTML()` の `notice` 1 行 | §2-9 |
| `tools/verify.mjs` | §6「`added` があれば `/^\d{4}-\d{2}-\d{2}$/`」・§7「`DEMO_DATE` 固定は warn」・冒頭コメント | §2-10 |
| `tools/regress.baseline.json` | `node tools/regress.mjs --update`（`T` キー +6 のみ） | §5-2 |
| `mock/index.html` | §7 の直後に「8. 更新履歴」（ja / zh 各 1 行・手書き） | §2-11 |

3 言語の文言・CSS・JS のコード片は**すべて設計書に書いてある**。implementer は翻訳・言い換え・設計判断をしない。

## 触らない範囲（reviewer の diff 監査基準。設計書 §3）

- 既存 41 件の `SVCS`（`name`/`desc`/`st`/`tags`/並び順）・`CATS`・`TAGS`・`PATTERNS`・`TEMPLATES`・`SCENARIOS`・`CAT_STYLE`
- **`HOME`（`frequent` / `recommended`）**・**`FEED`（`persona` / `mine` / `recent` / `items` 7 件）** — 新着をここに手書きしない
- `state` の形・`data-act` の一覧・`view` の値域・`renderSidebar` / `filtered` / `bindHomeSearch` / `gridHTML` / `feedItemHTML` / イベントハンドラ
- `renderDash` / `renderFeed` の本体（ヒーロー・統計・ヘッダー・サイド）
- `--ntt-*` と既存トークンの値、既存 CSS 規則（`.card .c-top .code` は残す）、`@media`、`prefers-reduced-motion`
- チャット / デモ画面のヘッダー（`.chat-hdr .code` に NEW を付けない）、② のランキング行 `.use-name .code`
- `tools/regress.mjs` のコード、`CLAUDE.md`（§7 の追記は **PM が実施**）、`.claude/**`、`.github/**`、`docs/**`、`mock/top.html`

## 受け入れ条件

1. `node tools/verify.mjs` → **ALL PASS**、warn は**既存の 1 件（`未使用キー: all`）のみ**
   - §2：`T=79`・3 言語一致・`en` にかな無し
   - §3：未定義キー参照なし・未使用キーなし
   - §5：`var()` すべて定義済み（`--badge-new-*` 含む）／**コンポーネント CSS に色の直値なし**／`--ntt-*` 不変
   - §6：`SVCS 43 件の cat/sub/st/tags 整合 OK`・`管理番号 43 件の重複なし OK`・`added` 形式検査 PASS
   - §7：`DEMO_DATE = null（実際の今日で判定）`・`state 必須キー 10 件 OK`・`data-act 13 種 OK`
2. `node tools/regress.mjs` の差分が**次の 7 行だけ**（`svcs` 系の行が 1 行でも出たら事故）

```
   - counts.ui: 73 → 79
   - T(UI キー) 追加: addedOn
   - T(UI キー) 追加: dashNew
   - T(UI キー) 追加: dashNewNote
   - T(UI キー) 追加: feedNewAgent
   - T(UI キー) 追加: feedNewWhen
   - T(UI キー) 追加: newBadge
```

   → `--update` で `{"cats":8,"subs":17,"svcs":43,"tags":43,"ui":79}`。PR 本文に「設計書 §2-2 の `T` 追加に伴う基準更新」と明記

3. Playwright（設計書 §5-3 の V-1〜V-13）。`DEMO_DATE` を `'2026-09-07'` に固定して確認し、**最後に `null` に戻して再度 verify**
   - ① 一覧で `.badge-new` が **DC-08・GN-06 の 2 個だけ**。他 41 件に無い／管理番号の右端が全カードで揃う
   - ② 統計の直下に帯、カード 2 枚（DC-08 → GN-06）、各カード下に `2026-09-07 追加`
   - ③「お知らせ」`.sec-count` が **4**、先頭 2 行が自動行。「対応が必要」3 件・「定例の業務」2 件は不変
   - 日 / 中 / 英・dark・幅 1100px で崩れない。`{n}` `{d}` `{code}` が生のまま出ていない
   - **`DEMO_DATE` を `'2026-12-01'` にすると ① の NEW が全部消え、② は帯ごと消え、③ は 2 件に戻る**
   - `mock/index.html` の §7 の下に「8. 更新履歴 / 8. 更新记录」

4. 設計書 §5-4 の「① への意図した回帰」の表に載っている変化だけが diff に出ている

## PR の分割案

**1 本**（`feat/74-new-badge`）。コミットは 3 つ（各コミット単体で verify PASS）：

1. `SVCS[].added` ＋ `T` 6 キー ＋ トークン ＋ ヘルパー ＋ `verify.mjs`
2. `.badge-new` / `.c-code` CSS ＋ `newBadgeHTML` ＋ `cardHTML` ＋ 詳細ヘッダー（①）
3. ② の帯 ＋ ③ の自動行 ＋ `.dash-new` CSS ＋ `regress --update` ＋ `mock/index.html`

**順序：#77（P2 ファイル分割）より先に入れる。** 本 PR は `catalog.html` の 7 か所に触るため、分割後だと設計書の引用位置と合わなくなる。`T` 末尾 / `cardHTML` / `dash*` / `feed*` に触る他 Issue とは**直列**。

## PM 判断待ち（設計書 §8。既定案のまま進めてよい）

- **A. NEW の文言** — 推奨：3 言語とも `NEW` 固定（幅が言語で変わると管理番号が折り返す）。`T.newBadge` にあるので後から変更可
- **B. ② 帯の位置** — 推奨：統計の直下（おすすめ・よく使うの上）。「よく使う」の上に動かすなら `newHTML` を `dash-col` の先頭に移すだけ
- **C. ③ 自動行の `kind` と期間** — 推奨：`notify`・期間は `NEW_DAYS`（30 日）と共通。①②③ で NEW の期間が食い違うと比較モックとして説明できない

## PM 作業（implementer には出さない）

- `CLAUDE.md` §2-3 データの `SVCS` 項に `added?` を追記（文面は設計書 §7 に用意済み）
