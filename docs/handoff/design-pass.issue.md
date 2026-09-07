# ② ダッシュボード デザインパス（分類に顔 ＋ ヒーローとデータ表現 ＋ 密度と階層）

> `gh` が使えない環境のため Issue 本文の下書き。PM がそのまま `gh issue create` に貼れる形にしてある。
> ラベル案：`enhancement` / `mock` / `design`  マイルストーン：#42（表示パターン ②③）

## 設計書

**`docs/handoff/2026-09-06-design-pass.md`**（implementer はこれを読む。reviewer はこれを照合基準にする）

関連：`docs/handoff/2026-09-06-patterns-dash-feed.md`（§6 ② の現レイアウト・§7 ③ の設計・§8 CSS）

## 背景

#47 で ② ダッシュボードがマージされたが、PM 評価は**「正しいが地味。デザイン性に欠ける」**。

1. ブルー1色＋グレーのフラットで情報に「顔」がない
2. 統計 4 枚が同じ大きさ・同色で強弱がない
3. 分類にアイコン・色の手がかりがなく文字だけ
4. 「よく使う」が順位バッジ＋カードの繰り返しで実績差が見えない

A（分類に顔）＋ B（ヒーローとデータ表現）＋ C（密度と階層）を**一括で**入れる（PM 決定）。

## やること（要約。詳細は設計書）

### A. 分類に顔をつける
- セマンティック層に **`--cat-<id>` / `--cat-<id>-bg` を 8 分類ぶん、light / dark 同時**に追加（設計書 §4-1 に 16 色の実値とコントラスト実測表）
- 未知の分類 id 用に `--cat-accent` / `--cat-accent-bg` の既定値を置く（§2-9：顧客版差し替えで壊れないため）
- 新定数 **`CAT_STYLE`**（アイコン path のみ。`CATS` には足さない）＋ ヘルパー `catIcon()` / `catClass()`
- アイコンは**本設計書で書き起こした自前のインライン SVG**（24px / stroke 1.75 / `currentColor`）。外部アイコン集は使わない＝**帰属表記不要**
- 適用：`cardHTML`（①②③ 共通）・① サイドバーの大分類・② 分類行 / ランキング / おすすめ・詳細画面のパンくず

### B. ヒーローとデータ表現
- ② 上部を **`--surface-hero`（Smart Navy → 濃紺ブルーのグラデ、下端 3px turquoise）の帯**にし、白抜き見出し＋リード＋検索欄
- **統計 4 枚は帯の中**に入れる（重ねない）。総数 44px 白 ／ 提供中・試行版・構想は 36px で `--status-*-hero` 着色
- **「よく使う」6 件をカード → 共通ベースラインの横棒ランキングに置換**（`HOME.frequent[].uses` を最大値比で。CSS の `width:%` のみ、ライブラリなし）
- 分類バーを 8px → **12px**・セグメント間 2px・節見出し右に**凡例**（`T` 追加なしで既存キーを再利用）
- おすすめ 3 件は分類アイコンタイル 44px ＋ 理由文。**1 件目は大きくしない**

### C. 密度と階層
- タイプスケールを確定（設計書 §6-1 に px 表）
- 影は既存 `--shadow-sm` / `--shadow-md` を流用（**dark でのみ値を上書き**。それ以外の既存トークンの値は変えない）
- 節間に 1px 罫 ＋ `--space-10` の余白
- 1180px 以下の崩し方を明記（横スクロールを出さない）

### 検証の拡張
- `tools/verify.mjs` §5 に追加：dark ブロックが 1 つだけ／`--cat-*` の light/dark 対称／`CATS` id に色トークンが無ければ warn（FAIL にしない）

## 受け入れ条件

- [ ] `node tools/verify.mjs` → **ALL PASS**。新しい warn を増やさない（`dashCatsNote` は凡例の `title=` で参照が残る）
- [ ] `node tools/regress.mjs` → **PASS（`--update` なし）**。`cats 8 / subs 17 / svcs 41 / tags 43 / ui 61` が不変
- [ ] `git diff main -- tools/regress.baseline.json` が**空**
- [ ] 変更ファイルは `mock/catalog.html` と `tools/verify.mjs` の **2 つだけ**
- [ ] 2 つ目の `<style>` に `#RRGGBB` の直値が**ゼロ**
- [ ] `--ntt-*` の追加・変更行が**ゼロ**
- [ ] `T` / `CATS` / `SVCS` / `TAGS` / `SCENARIOS` / `HOME` / `state` / `data-act` に diff が**ゼロ**
- [ ] Playwright P-1〜P-21（設計書 §12-2）：① のカードにアイコン・② の `.use-row` 6 行と単調減少するバー・`.cat-row` 8 行・検索しても帯が残る・**dark で全 16 分類色が 4.5:1 以上**・**1100px で横スクロールなし**・**中文 / English にかな残りゼロ**・③ セグメントは `disabled` のまま

## 触らない範囲（reviewer の diff 監査基準）

- `--ntt-*`（ブランドパレット）／既存セマンティックトークンの**値**（例外は dark の `--shadow-sm` / `--shadow-md` の 2 行のみ）
- `T` のキーと値（**61 キーのまま。追加も変更もしない**）
- `CATS` / `SVCS` / `TAGS` / `TEMPLATES` / `SCENARIOS` / `HOME` の中身
- `state` の形・`data-act` 13 種の集合・`PATTERNS`（`feed.ready` は `false` のまま）
- `bindHomeSearch` の仕組み・`filtered()` / `countText()`
- `renderMain` の `list` / `chat` / `demo` 分岐・デモの台本消費まわり
- `.mockbar` / 言語切替 / テーマ切替 / `localStorage` キー / `pages.yml` / `.nojekyll`
- `docs/handoff/**`・`.claude/**`
- `renderFeed` は書かない（PR-2）

## 意図した回帰（① と詳細画面も変わる。これを理由に差し戻さない）

| 画面 | 変わること |
|---|---|
| ① 一覧のカード | アイコン追加・パンくずが分類色・影・hover の下辺色が分類色 |
| ① サイドバー | 大分類 8 行にアイコン（中分類と「すべてのサービス」には付けない） |
| 詳細画面 | パンくずにアイコン＋分類色 |
| デモ / チャット | **変わらない** |

## PR の分割案

**1 PR（`feat/42-design-pass`）／コミット 3 本**。A・B・C を別 PR に割ると `:root`・dark ブロック・`.card`・`.dash-*` CSS が 3 回衝突し、中間状態がレビュー不能になる。

1. `--cat-*` トークン（light/dark）＋ `CAT_STYLE` ＋ ヘルパー ＋ `.ic` / `.cat-*` CSS ＋ `cardHTML` / サイドバー / 詳細への適用 ＋ verify 拡張
2. ヒーロー帯 ＋ 統計の作り替え ＋ 横棒ランキング ＋ おすすめ ＋ 分類行
3. タイプスケール・影・余白・節区切り・`@media` 追記

各コミット単体で `verify` / `regress` が PASS すること。

## 並列可否

**PR-2（③ 業務フィード）とは直列。** `mock/catalog.html` の両方の `<style>`・`cardHTML`・`@media`・`tools/verify.mjs` §5 が重なる。

```
#47（②）→ 本 PR（デザインパス）→ PR-2（③ 業務フィード）
```

③ の implementer は `2026-09-06-patterns-dash-feed.md` §7 を読んだうえで、本設計書 **§9（③ への適用ルール）** を上書き適用する（分類タイル・期限バッジのトークン 2 個追加・`.feed-side` の見出し・**③ にヒーロー帯は置かない**）。

## PM 判断待ち（2 件。回答が無ければ推奨で進める）

1. **分類色の割り当て**（kn=青 / qa=**赤** / dc=ティール / lg=紫 / nm=オリーブ / en=スレート / gn=緑 / pt=マゼンタ）。qa を赤にすると「品質が悪そう」と取られる懸念があるなら `--cat-qa` をアンバー `#B45309`（dark `#F0A64A`）に差し替えるだけで済む
2. `dashFreqNote`「社内の利用実績（デモ用のサンプル値）」の文言。数字が大きく出るぶん誤解されやすい。強めるなら architect が 3 言語を書き直す
