# Issue #77 追記案 — リファクタリング P2：`catalog.html` を層ごとにファイル分割（ビルド不要）

> `gh` が使えない環境のため、Issue 本文はここに書き出す。PM が #77 にコメントとして貼るか、本文を置き換える。

## 設計書

`docs/handoff/2026-09-07-split-catalog.md`（基準コミット `e94afc7`）

## 目的

Claude Design（CSS・描画）／台本 writer（データ）／PM（文言）が同じ 572 KB の 1 ファイルで衝突する状態を解消する。あわせて `mock/index.html` のトークン手コピー（現時点で既に 74 行分が catalog 側と食い違っている）をなくす。
**維持**：静的 HTML/CSS/JS・ビルド不要・`file://` でも Pages でも動く・**検査項目を 1 つも減らさない**・データの中身は 1 バイトも変えない。

## 前提

- **#74（NEW 表示）のマージ後に着手**（`T`・コンポーネント CSS・`cardHTML` が重なるため）
- Claude Design の次の戻りより**前**に完了させる（戻りが巨大 diff だと衝突する）
- 3 つの PR は**直列**（すべて `catalog.html` と `tools/verify.mjs` を触る）

## 分割後の構成（17 ファイル）

```
mock/catalog.html          殻（<link> 2 + <script src> 15。100 行未満）
mock/css/tokens.css        現 1 つ目 <style>（287 行）
mock/css/components.css    現 2 つ目 <style>（674 行）
mock/js/data/ui.js         T / PATTERNS / TAGS / TEMPLATES
mock/js/data/catalog.js    CATS / SVCS
mock/js/data/home.js       HOME / FEED
mock/js/data/style.js      CAT_STYLE（Claude Design が触ってよい唯一のデータ）
mock/js/data/scenarios/{kn,qa,dc,lg,nm,en,gn,pt}.js   SCENARIOS を大分類 8 ファイルに
mock/js/app.js             state / ヘルパー / detectLang / デモ制御 / 設定永続化（触らない層）
mock/js/render.js          renderChrome〜renderAll（Claude Design が触る層）
mock/js/events.js          click ハンドラ / listener / 起動（触らない層）
mock/index.html            トークンのコピーを <link href="css/tokens.css"> に置換
```

読み込み順（`catalog.html` の `<script src>` の並びが唯一の正）：
`data/ui → data/catalog → data/home → data/style → data/scenarios/*（8） → app → render → events`

- **古典的スクリプト**（`type="module"` にしない＝`file://` の CORS 回避）。`defer`/`async`/`integrity` も付けない
- `SCENARIOS` は `window.SCENARIOS = window.SCENARIOS || {}; Object.assign(window.SCENARIOS, { …元のブロックをそのまま… });` で登録。他は `const` のまま
- `js/app.js` 冒頭で `typeof T === 'undefined'` 形式のデータ存在 assert（欠落時は白画面ではなく欠落ファイル名を表示）

## PR の分割案

| PR | 内容 | 主な受け入れ条件 |
|---|---|---|
| **PR-A** CSS 分離 | `css/tokens.css`・`css/components.css` 新規、`catalog.html` を `<link>` 2 本に、`index.html` のトークンコピーを `<link>` に置換、verify §5 の対象を CSS ファイルへ、検査 5-A・1-B⑤ 追加 | 抽出コマンド再実行で CSS **差分ゼロ**／`catalog.html` の `<style>` が 0 個／`index.html` にトークン定義行 0 個／verify・regress PASS／`file://` と Pages で light・dark × ja/zh/en がピクセル同等 |
| **PR-B** データ分離 | データ 12 ファイル新規、`<script src>` 12 本追加（アプリはインラインのまま＝この中間状態も動く）、`tools/lib/load.mjs` 新規、verify/regress を新ローダーへ | 抽出再実行で 12 ファイル**差分ゼロ**／全 10 定数の**正規化 JSON が base と完全一致**／`regress` 差分 0（`--update` 禁止）／verify の出力項目が新規追加分以外は同一／**わざと壊して落ちる確認**（タグ削除・二重宣言・順序入替）／zh の文字化けなし |
| **PR-C** アプリ分離 | `js/{app,render,events}.js` 新規、インライン `<script>` 削除、assert 追加、verify §7 の対象変更、Claude Design 引き渡しメモ §2 の表を新パスに、`mock/README.md` 更新 | 抽出再実行で 3 ファイル**差分ゼロ**（assert は先頭にのみ追加）／`catalog.html` にインライン `<script>` 0 個・100 行未満／verify §7（`state` 10 キー・`data-act` 13 種・`detectLang`・localStorage）PASS／assert の動作スクショ／IME・デモタイマー・言語切替後の会話復元を実機確認 |

各 PR 共通：`node tools/verify.mjs` と `node tools/regress.mjs` が PASS、Playwright で全画面（P1/P2/P3 × light/dark × ja/zh/en、詳細、chat、demo 5 テンプレート）。
**PR 本文に抽出コマンド（`sed -n 'A,Bp'` の一覧）を貼る**。reviewer は base コミットに対して再実行し、生成物と PR のファイルを `diff` して差分ゼロを確認する（バイト同一性の証明）。

## 触らない範囲（明示）

- **データの中身**（`T`/`PATTERNS`/`TAGS`/`TEMPLATES`/`CATS`/`SVCS`/`SCENARIOS`/`HOME`/`FEED`/`CAT_STYLE`）は 1 バイトも変えない。`regress.baseline.json` は**変更しない**
- **CSS の中身**（値・セレクタ・並び・コメント）。`--ntt-*` はもちろんセマンティックトークンの値も触らない。dark ブロックは 1 つのまま
- **描画・遷移**：`render*` / `*HTML` / `data-act` / `data-arg` / `id="search" #msgs #chat-input #home-holder` / `state` の形 / `view` 4 値 / `detectLang` / `mock.lang` `mock.theme`
- `catalog.html` の body マークアップ（`.mockbar`・ヘッダーの言語/テーマ切替）、`<template id="__bundler_thumbnail">`
- `.github/workflows/pages.yml`（`path: mock` のままで `mock/css` `mock/js` は公開される）、`mock/.nojekyll`
- `.claude/agents/**`・`.claude/commands/**`、`CLAUDE.md`（§2 の表記置き換えは**設計書 §6 の案を PM が適用**）

## verify / regress の改修（検査は 1 つも減らさない）

- `tools/lib/load.mjs`（新規）に共通ローダー。**`node:vm` の 1 コンテキストで `catalog.html` に書かれた順に `js/data/**` を実際に実行**してデータを取り出す（現行の脆い `grab()` 正規表現を廃止）。前提として `js/data/**` は純粋なリテラル宣言のみ（`document`・`localStorage`・関数呼び出しを書かない）＝新しい load-bearing
- CSS 検査（§5）は `css/tokens.css`・`css/components.css` を直接読む。**dark ブロック 1 つ・`#` 直値なし・`var()` 未定義なし・`--cat-*` の light/dark 対称の各検査はロジック不変**
- §7（`state`/`data-act`/`detectLang`/localStorage）は `js/app.js`＋`js/render.js`＋`js/events.js` の連結が対象。`.mockbar`・`#lang-select`・`#theme-btn` は `catalog.html` が対象
- **追加検査**：1-A 全 JS 連結の `node --check`（**二重宣言**検出）／1-B 読み込み契約（実ファイル存在・相対パスのみ・**`scenarios/` のタグ集合＝ファイル集合**・順序・`catalog.html` に `<style>` 0 個）／5-A `index.html` にトークンのコピーが無い＋インライン CSS の `var()` 未定義・色直値ゼロ／§8 `mock/` に `_` 始まりディレクトリ無し／§9 シナリオ id の接頭 2 文字＝ファイル名
- `regress.mjs` はデータ取得だけ差し替え。スナップショットと比較ロジックは不変＝**分割だけなら差分 0 が受け入れ条件**

## PM 判断待ち（推奨つき）

1. `scenarios/` の粒度 → **推奨：大分類 8 ファイル**（サービス追加で殻を触らない／中国からの回線でリクエストを増やさない／後から 1 サービス 1 ファイルにしても契約は不変）
2. `?v=` キャッシュスタンプ → **推奨：P2 では付けない**。運用で「Pages 確認は初回だけ強制リロード」。P3 で `tools/stamp.mjs` ＋ verify 検証としてまとめて入れる
3. `tools/bundle.mjs` → **推奨：作らない**（`file://` で動くのでフォルダ zip で足りる。必要なら P3、生成物は `.gitignore`）
4. アプリ層を 3 分割するか → **推奨：3 分割**（`app.js`/`render.js`/`events.js`。既存コメントに切れ目があり追加コストゼロ、「触ってよい層」がファイル境界と一致）
5. `.claude/agents/architect.md`・`.claude/commands/feature.md` の言い換え → **PM が PR-C 後に更新**（architect は触れない）
6. 実施タイミング → **#74 マージ後、Claude Design の次の戻りの前**。先に Design に「次の戻りは分割後の `css/components.css` + `js/render.js` に対して」と伝えるのが望ましい
7. `CLAUDE.md` §2 の書き換え（設計書 §6 の表）→ **PR-C 直後に PM が適用**。この設計で唯一 load-bearing の文言を変える提案なので PM 承認が必要
