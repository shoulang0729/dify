# ② ダッシュボード デザインパス（A 分類の顔 ＋ B ヒーローとデータ表現 ＋ C 密度と階層）

- 日付：2026-09-06（採番は既存の設計書群に合わせる。起票は 2026-09-07）
- 作成：architect
- レーン：**M/L**（セマンティックトークンを新設し light/dark 同時に定義、`cardHTML` / `renderSidebar` という 3 パターン共通の描画に触る → §2-2 / §2-3 / §2-7 に接触）
- 対象：`mock/catalog.html`、`tools/verify.mjs`（検査の追加のみ）
- 前提：`main = 7742ee8`。② は #47（PR-1）でマージ済み・③ は未実装（`PATTERNS.feed.ready === false`）
- 関連設計書：`docs/handoff/2026-09-06-patterns-dash-feed.md`（§6 が ② の現レイアウト、§7 が ③、§8 が CSS）
- Issue 下書き：`docs/handoff/design-pass.issue.md`

---

## 0. 目的 / 背景

PM 評価：**「正しいが地味。デザイン性に欠ける」**。原因の見立て（PM 提示、architect も同意）：

| # | 症状 | 本設計での手当て |
|---|---|---|
| 1 | ブルー1色＋グレーのフラットで情報に「顔」がない | **A**：8 分類にアクセント色＋アイコンを与える |
| 2 | 統計 4 枚が同じ大きさ・同色で強弱がない | **B**：ヒーロー帯に統合、総数 44px 白／内訳 36px 成熟度色 |
| 3 | 分類に手がかりがなく文字だけ | **A**：分類行・サイドバー・カードにアイコンと色 |
| 4 | 「よく使う」が順位バッジ＋カードの繰り返しで実績差が見えない | **B**：カード 6 枚をやめ、**共通ベースラインの横棒ランキング**に置換 |

**ねらいは「見た目を派手にする」ことではなく、「1 画面の中に読む順番を作る」こと。**
ヒーロー（全体像）→ よく使う（実績の差）→ おすすめ（入口）→ 分類（網羅）の 4 段に、
サイズ・色・余白で明確な段差をつける。

③ 業務フィードは本設計の視覚言語を前提に PR-2 で実装する（§9 に適用ルールを書く）。

---

## 1. 決定サマリ（PM「推奨で進めてよい」に基づき architect が確定）

| 論点 | 決定 | 理由（1 行） |
|---|---|---|
| 分類の色・アイコンの置き場所 | **`CATS` に足さず別定数 `CAT_STYLE`**（＋未知 id へのフォールバック） | §2-9「顧客版差し替えはデータ層だけ」を守るため。分類 id が入れ替わっても描画は壊れない |
| アイコンの出所 | **本設計書で path を全部書き下ろす**（Lucide / Tabler を使わない） | 1 ファイル完結のモックに外部資産・ライセンス表記を持ち込まない。**帰属表記は不要** |
| 統計 4 枚の位置 | **ヒーロー帯の中（下段）** | 「重ねる」は検索時に `#home-holder` が差し替わると帯下に空白が出る。帯内なら検索中も全体像が残る |
| 「よく使う」の見せ方 | **6 件の横棒ランキング（リスト）**。カードは使わない | 共通ベースラインでないと 312 と 132 の差が読めない。縦も詰まりおすすめ／分類が上がる |
| 「おすすめ」1 件目の拡大 | **しない**。代わりに節全体を沈めた面（`--surface-sunken`）に置く | 3 件は対等な提案。1 件だけ大きいと「一番おすすめ」の意味が生まれ、`HOME.recommended` の順序が仕様化してしまう |
| 分類バーの凡例 | 節見出し右に `.dot` ＋ 既存 3 キーで置く。**`T` 追加なし** | 既存 `statusLive/Trial/Concept` を再利用。`dashCatsNote` は凡例の `title=` に移して未使用キー化を防ぐ |
| 詳細画面への波及 | **`.d-crumb` にも分類色＋アイコンを入れる** | 一覧 → 詳細 → デモが顧客の視線導線。詳細で色が消えると「装飾だった」と見える |
| ③ のヒーロー帯 | **③ は帯を置かない（薄いヘッダー）** | ③ は毎日使う担当者向け。縦を食う訴求帯は邪魔。§9 に代案 |

---

## 2. 変更する範囲

| ファイル | 箇所 | 変更 |
|---|---|---|
| `mock/catalog.html` | 1 つ目 `<style>` の `:root` | **セマンティックトークン 27 個を追加**（§4-1・§5-1）。`--ntt-*` は 1 行も触らない |
| `mock/catalog.html` | 1 つ目 `<style>` の `:root[data-theme="dark"]` | **同じ意味のトークン 24 個を追加**（§4-1・§5-1）。**既存のたった 1 つの dark ブロックの中に追記**（ブロックを増やさない） |
| `mock/catalog.html` | 2 つ目 `<style>` | `.ic` / `.cat-*`（8 クラス）/ `.hero*` / `.stat*` 差し替え / `.use-*` / `.reco-*` / `.cat-row` 強化 / `.card` 影 / `@media` 追記（§7） |
| `mock/catalog.html` | `HOME` の直後 | 新定数 **`CAT_STYLE`** を追加（アイコン path のみ。色は CSS 側）（§4-2） |
| `mock/catalog.html` | ヘルパー（`svcCode` の近く） | `catIcon(id, sizeCls)` / `catClass(id)` を追加（§4-3） |
| `mock/catalog.html` | `cardHTML` | ルート要素に `catClass(x.cat)` を付与、`.c-top` の先頭に 16px アイコン（§4-4-1）。**①②③ 共通の見た目変更** |
| `mock/catalog.html` | `renderSidebar` | 大分類 `.nav-item` の先頭に 18px アイコン（§4-4-2）。① のみ |
| `mock/catalog.html` | `renderMain` の `detail` 分岐 | `.detail-card` に `catClass`、`.d-crumb` の先頭に 18px アイコン（§4-4-5）。3 パターン共通 |
| `mock/catalog.html` | `renderDash` | ヒーロー帯（`.hero`）に置換。統計はここへ移す（§5-2） |
| `mock/catalog.html` | `dashSectionsHTML` | 統計を外し、「よく使う」をランキングリストへ、「おすすめ」「分類」を強化（§5-3 / §5-4 / §5-5） |
| `tools/verify.mjs` | §5 CSS トークン | `--cat-*` の light/dark 対称検査・dark ブロックが 1 つだけである検査・`CATS` id と `--cat-*` の対応（warn）を追加（§10） |

### 2-1. 触らない範囲（reviewer の diff 監査基準）

**以下に diff が出たら、それだけで差し戻し。**

- `--ntt-*` のブランドパレット（値・名前・並び）。**dark ブロックに `--ntt-*` を 1 行も書かない**
- 既存セマンティックトークンの**値**（`--surface-*` / `--text-*` / `--border-*` / `--action-*` / `--status-success|info|warning|danger|concept` / `--badge-*`）。**追加はするが既存値は変えない**。例外は dark の `--shadow-sm` / `--shadow-md` のみ（§5-6 に理由と値を明記）
- `T` の**キー集合と値**（61 キー。追加も削除も変更もしない。§8）
- `CATS` / `SVCS` / `TAGS` / `TEMPLATES` / `SCENARIOS` / `HOME` の**中身**（1 バイトも変えない）
- `state` の形・`data-act` の集合（`pattern`/`all`/`cat`/`sub`/`svc`/`back`/`backdetail`/`start`/`send`/`run`/`chip`/`restart`/`gocat` の 13 種のまま。**追加も削除もしない**）
- `PATTERNS`（`feed.ready` は `false` のまま。③ は PR-2）
- `bindHomeSearch` の仕組み（`#home-holder` を差し替える方式、IME 対策）と `filtered()` / `countText()`
- `renderMain` の `list` / `chat` / `demo` 分岐、デモの台本消費（`consume` / `nextTurn` / `demoDelay` / `demoPending`）
- `.mockbar` の構造、ヘッダーの言語切替・テーマ切替（§2-4）
- `localStorage` キー `mock.lang` / `mock.theme`（§2-6）
- `.github/workflows/pages.yml` / `mock/.nojekyll`（§2-8）
- `docs/handoff/**`（implementer は設計書を書き換えない）
- `renderFeed` は**まだ書かない**（PR-2）

---

## 3. 全体レイアウト（② ダッシュボード・幅 1181px 以上）

```
┌ .mockbar  [① 階層ナビ][② ダッシュボード][③ 業務フィード]              ← 足場（不変）┐
├ .hdr      青嶺精工 │ AIエージェントカタログ         情報システム部 [日▾][◐]        ┤
├ .body ─────────────────────────────────────────────────────────────────────────────┤
│┌ .hero   background: var(--surface-hero)  ＝ navy → blue の斜めグラデ ─────────────┐│
││  padding: 40px 36px 32px                                                         ││
││                                                                                  ││
││  AI AGENT CATALOG            ← .hero-eyebrow 11px/700 tracking .14em soft         ││
││  AIエージェント ホーム         ← h1 30px/700 --text-on-hero    ┌ .search 320px ──┐││
││  8 分類 41 件のエージェントを   ← p 14px --text-on-hero-soft    │ サービスを検索  │││
││  用意しています。よく使われて     max-width 54ch                └─────────────────┘││
││  いるものから試せます。                                                           ││
││                                                                                  ││
││ ┌ .stat-strip  grid 1.35fr 1fr 1fr 1fr / 各セルの左に 1px --border-hero ────────┐ ││
││ │   41           │  ● 12          │  ● 21          │  ● 8                     │ ││
││ │   44px/700 白   │  36px/700 緑    │  36px/700 黄    │  36px/700 灰            │ ││
││ │   サービス総数   │  提供中         │  試行版         │  構想                    │ ││
││ └──────────────────────────────────────────────────────────────────────────────┘ ││
│└═══ 下端 3px  var(--border-hero-accent)（ブランド turquoise）════════════════════┘│
│┌ .dash-body   padding: 40px 36px 48px ───────────────────────────────────────────┐│
││┌ #home-holder （検索時はここだけ差し替わる。帯と統計は残る）───────────────────┐││
│││ ▎よく使われているエージェント          社内の利用実績（デモ用のサンプル値）    │││
│││ ┌ .use-list  ─────────────────────────────────────────────────────────────┐  │││
│││ │ 1 [◧] 技術ナレッジQA              KN-01 │███████████████████│ 今月 312 件│  │││
│││ │       ナレッジ検索・問い合わせ ● 提供中   │                   │            │  │││
│││ ├────────────────────────────────────────────────────────────────────────┤  │││
│││ │ 2 [◧] 日中翻訳（社内文書）         LG-01 │████████████████   │ 今月 268 件│  │││
│││ ├────────────────────────────────────────────────────────────────────────┤  │││
│││ │ 3 … 4 … 5 … 6 …                          （バーの色 = 分類アクセント色）  │  │││
│││ └────────────────────────────────────────────────────────────────────────┘  │││
│││                                                                              │││
│││ ┌ .reco-panel  背景 --surface-sunken / 上下 1px --border-subtle ────────────┐ │││
│││ │ ▎おすすめ                                        初めての方はここから      │ │││
│││ │ ┌ .reco-item ────────┐┌ .reco-item ────────┐┌ .reco-item ────────┐        │ │││
│││ │ │ ┌──┐ 文書・資料作成 ││ ┌──┐ ナレッジ検索  ││ ┌──┐ 品質・不具合  │        │ │││
│││ │ │ │◧ │ 44px タイル   ││ │◧ │              ││ │◧ │              │        │ │││
│││ │ │ └──┘ --cat-*-bg   ││ └──┘              ││ └──┘              │        │ │││
│││ │ │ ┌ .card（共通）──┐ ││ ┌ .card ────────┐ ││ ┌ .card ────────┐ │        │ │││
│││ │ │ └────────────────┘ ││ └───────────────┘ ││ └───────────────┘ │        │ │││
│││ │ │ おすすめの理由 現場の││ …                 ││ …                 │        │ │││
│││ │ │ 数字から本社向け…   ││                   ││                   │        │ │││
│││ │ └────────────────────┘└───────────────────┘└───────────────────┘        │ │││
│││ └──────────────────────────────────────────────────────────────────────────┘ │││
│││                                                                              │││
│││ ▎分類から見る              ● 提供中  ● 試行版  ● 構想   ← 凡例（節見出し右） │││
│││ ┌ .cat-row  data-act="gocat" data-arg="kn" ────────────────────────────────┐ │││
│││ │ ┌──┐                                                                     │ │││
│││ │ │◧ │ ナレッジ検索・問い合わせ   5件のサービス  ███████░░░░░  3 / 2 / 0   › │ │││
│││ │ └──┘ 36px タイル --cat-kn-bg                  12px 高のバー              │ │││
│││ └──────────────────────────────────────────────────────────────────────────┘ │││
│││ （…CATS の順に 8 行。行間は 1px --border-subtle）                            │││
││└──────────────────────────────────────────────────────────────────────────────┘││
│└─────────────────────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 3-1. カード 1 枚の拡大（`cardHTML`。①②③ 共通）

```
┌ .card.cat-kn ─────────────────────────────────── box-shadow: var(--shadow-sm) ┐
│ ┌ .c-top   display:flex; align-items:center; gap:6px ────────────────────────┐ │
│ │ ┌──┐                                                                       │ │
│ │ │◧ │ ナレッジ検索・問い合わせ・技術・設備ナレッジ              KN-01       │ │
│ │ └──┘  16px アイコン        10.5px/700 tracking .08em          11px mono     │ │
│ │  color: var(--cat-accent)  color: var(--cat-accent)      --text-muted       │ │
│ └────────────────────────────────────────────────────────────────────────────┘ │
│ 技術ナレッジQA                       15.5px/700 --text-heading  line-height 1.4 │
│ 過去の設計書・不具合報告・作業標準…    12.5px --text-body  2 行クランプ           │
│ ● 提供中   [検索]  [ナレッジ]         11px                                      │
└═ border-bottom 2px --border-card  →  :hover で var(--cat-accent) ══════════════┘
```

**① で変わるのは 4 点だけ**（§13 の許容範囲）：
1. パンくずの前に 16px の分類アイコンが増える
2. パンくずの色が `--action-primary` → `--cat-accent`（分類ごとの色）
3. カードに `--shadow-sm` が乗る
4. hover の下辺色が `--action-primary` → `--cat-accent`

---

## 4. A：分類に顔をつける

### 4-1. 追加するトークン（分類アクセント 8 色 × light/dark）

`:root`（1 つ目の `<style>`、`--badge-concept-fg` の直後）に追加：

```css
  /* --- 分類アクセント（① サイドバー / ①②③ カード / ② 分類行・ランキング / ③ フィード） ---
     テキストにも使うため light は白・キャンバス上で 4.5:1 以上、dark はカード上で 4.5:1 以上。
     ブランドパレットと一致する 3 色は --ntt-* を参照する（kn / qa / en）。 */
  --cat-kn:      var(--ntt-future-blue);   /* #0071BC */
  --cat-kn-bg:   rgba(0, 113, 188, 0.12);
  --cat-qa:      var(--ntt-orange-150);    /* #B22000 */
  --cat-qa-bg:   rgba(178, 32, 0, 0.12);
  --cat-dc:      #00707C;
  --cat-dc-bg:   rgba(0, 112, 124, 0.12);
  --cat-lg:      #6A3FB5;
  --cat-lg-bg:   rgba(106, 63, 181, 0.12);
  --cat-nm:      #547000;
  --cat-nm-bg:   rgba(84, 112, 0, 0.12);
  --cat-en:      var(--ntt-grey-700);      /* #3D4A57 */
  --cat-en-bg:   rgba(61, 74, 87, 0.12);
  --cat-gn:      #1F7A46;
  --cat-gn-bg:   rgba(31, 122, 70, 0.12);
  --cat-pt:      #A8347A;
  --cat-pt-bg:   rgba(168, 52, 122, 0.12);

  /* 既定値。CAT_STYLE / --cat-<id> が無い分類 id が来ても壊れないためのフォールバック（§2-9） */
  --cat-accent:    var(--action-primary);
  --cat-accent-bg: var(--surface-selected);
```

`:root[data-theme="dark"]`（**既存の 1 ブロックの中**、`--badge-concept-fg` の後）に追加：

```css
  --cat-kn:      #5AACEE;  --cat-kn-bg: rgba(90, 172, 238, 0.18);
  --cat-qa:      #FF8F70;  --cat-qa-bg: rgba(255, 143, 112, 0.18);
  --cat-dc:      #3FC9D8;  --cat-dc-bg: rgba(63, 201, 216, 0.18);
  --cat-lg:      #B79BFF;  --cat-lg-bg: rgba(183, 155, 255, 0.18);
  --cat-nm:      #A8C93F;  --cat-nm-bg: rgba(168, 201, 63, 0.18);
  --cat-en:      #A9BACB;  --cat-en-bg: rgba(169, 186, 203, 0.18);
  --cat-gn:      #52C98A;  --cat-gn-bg: rgba(82, 201, 138, 0.18);
  --cat-pt:      #F07AC0;  --cat-pt-bg: rgba(240, 122, 192, 0.18);
```

`--cat-accent` / `--cat-accent-bg` は **dark で上書き不要**（参照先の `--action-primary` / `--surface-selected` が dark で差し替わる）。

**コントラスト実測**（WCAG 2.1、architect が計算。reviewer は数値を再計算して照合できる）

| 分類 | light 値 | 白カード | キャンバス #F6F8FA | dark 値 | dark カード #111C30 | dark キャンバス #0A1220 |
|---|---|---|---|---|---|---|
| kn ナレッジ | `#0071BC` | 5.14 | 4.83 | `#5AACEE` | 6.95 | 7.65 |
| qa 品質 | `#B22000` | 6.78 | 6.36 | `#FF8F70` | 7.64 | 8.40 |
| dc 文書 | `#00707C` | 5.82 | 5.47 | `#3FC9D8` | 8.57 | 9.42 |
| lg 日中 | `#6A3FB5` | 7.02 | 6.59 | `#B79BFF` | 7.42 | 8.16 |
| nm 数字 | `#547000` | 5.68 | 5.34 | `#A8C93F` | 9.00 | 9.90 |
| en 図面 | `#3D4A57` | 9.07 | 8.52 | `#A9BACB` | 8.58 | 9.44 |
| gn 汎用 | `#1F7A46` | 5.34 | 5.02 | `#52C98A` | 8.18 | 9.00 |
| pt 連携 | `#A8347A` | 6.11 | 5.74 | `#F07AC0` | 6.69 | 7.36 |

**全 16 色が 4.5:1 以上**（テキスト用途 OK。装飾の 3:1 は当然クリア）。

> **制約（守ること）**：分類アクセント色は **`--surface-card` と `--surface-canvas` の上でだけ**使う。
> `--surface-sunken`（#EEF1F3）の上に載せてよいのは**バーの塗り（装飾 3:1）まで**。
> 沈めた面の上にアクセント色の**文字**を置かない（nm が light で 5.01 と余裕が小さいため）。
> `.reco-panel` は sunken だが、その中の `.card` は `--surface-card` なので問題ない。

### 4-2. `CAT_STYLE`（新定数・アイコンだけを持つ）

**置き場所**：`HOME` の閉じ `};` の直後、`/* 3. 状態（共通レイヤー） */` の前。
**書式の約束**（`verify.mjs` / `regress.mjs` の `grab()` を壊さないため）：閉じ `};` は行頭（インデント 0）、
リテラルの途中に行頭 `}` や `]` を作らない、文字列に `'`（U+0027）を使わない。

```js
/* ============================================================
   2e. 分類の見た目（アイコン）。色は CSS の --cat-<id> 側にある
   SVCS / CATS に埋め込まない（§2-9：顧客版の差し替えはデータ層だけ）。
   ここに無い分類 id は _fallback と既定色 --cat-accent で描画される＝壊れない
   アイコンは本リポジトリで書き起こしたもの。外部アイコン集は使っていない（帰属表記不要）
   viewBox 0 0 24 24 / fill none / stroke currentColor / stroke-width 1.75
   ============================================================ */
const CAT_STYLE = {
  kn: { icon: '<path d="M4 4.5h5.5A2.5 2.5 0 0 1 12 7v12a2.5 2.5 0 0 0-2.5-2.5H4z"/><path d="M20 4.5h-5.5A2.5 2.5 0 0 0 12 7v12a2.5 2.5 0 0 1 2.5-2.5H20z"/>' },
  qa: { icon: '<path d="M12 3.2l7 2.8v5.2c0 4.3-2.9 7.9-7 9.6-4.1-1.7-7-5.3-7-9.6V6z"/><path d="M8.8 12.1l2.3 2.3 4.1-4.6"/>' },
  dc: { icon: '<path d="M13.5 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8.5z"/><path d="M13.5 3.5v5h5"/><path d="M9 13h6"/><path d="M9 16.5h4"/>' },
  lg: { icon: '<path d="M5.5 4.5h8a2 2 0 0 1 2 2v3.5a2 2 0 0 1-2 2h-4l-3.5 2.7v-2.7h-.5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z"/><path d="M18.5 9.5a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H18v2.6L14.5 17h-3.2"/>' },
  nm: { icon: '<path d="M3.5 20h17"/><path d="M7 20v-6.5"/><path d="M12 20V5.5"/><path d="M17 20v-9.5"/>' },
  en: { icon: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 9h17"/><path d="M9 9v11.5"/><circle cx="15" cy="15" r="2.5"/>' },
  gn: { icon: '<rect x="4" y="4.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4.5" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>' },
  pt: { icon: '<circle cx="9" cy="8" r="3.5"/><path d="M2.8 20v-1a4.7 4.7 0 0 1 4.7-4.7h3a4.7 4.7 0 0 1 4.7 4.7v1"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4"/><path d="M17.6 14.6A4.7 4.7 0 0 1 21.2 19v1"/>' },
  _fallback: { icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="2.5"/>' }
};
```

**図柄の意図**：kn = 開いた本 / qa = 盾＋チェック / dc = 折り返しのある書類 / lg = 2 つの吹き出し /
nm = 棒グラフ / en = 図面枠＋寸法丸 / gn = 4 分割グリッド / pt = 2 人。

**implementer の裁量**：24px グリッド上でストロークが破綻する場合、**形の微調整はしてよい**。
ただし **viewBox・`stroke-width: 1.75`・`fill="none"`・`stroke="currentColor"`・図柄の意味**は変えない。
外部アイコンライブラリ（Lucide / Tabler 等）からの転記は**しない**（1 ファイル完結を崩さないため）。

### 4-3. ヘルパー 2 つ（`svcCode` の直後に置く）

```js
/** 分類アイコン。size は 'ic-sm'(16) / ''(20) / 'ic-lg'(24) / 'ic-xl'(28)
    未知の分類 id でも _fallback で必ず描ける（§2-9） */
const catIcon = (id, size) => `<svg class="ic ${size || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${(CAT_STYLE[id] || CAT_STYLE._fallback).icon}</svg>`;
/** 分類アクセント色を要素に載せるクラス。未定義分類は空文字＝既定色（--cat-accent）のまま */
const catClass = (id) => (CAT_STYLE[id] ? `cat-${id}` : '');
```

> `catIcon` の戻り値は **`esc()` に通さない**（HTML を返す関数）。
> 引数は `CAT_STYLE` のキー参照だけで、ユーザー入力は一切通らないので XSS 経路にならない。

### 4-4. アイコン／色を載せる場所

| # | 場所 | 関数 | サイズ | 具体 |
|---|---|---|---|---|
| 1 | カード（①②③ 共通） | `cardHTML` | 16px（`ic-sm`） | ルート `class="card ${catClass(x.cat)}"`、`.c-top` の先頭に `catIcon(x.cat, 'ic-sm')`。`.c-crumb` の色を `--cat-accent` に |
| 2 | ① サイドバーの大分類 | `renderSidebar` | 20px | `.nav-item`（`data-act="cat"` の方だけ）に `catClass(c.id)`、`.n-label` の前に `catIcon(c.id)`。**「すべてのサービス」行と中分類 `.nav-sub` には入れない** |
| 3 | ② 分類行 | `dashSectionsHTML` | 24px（`ic-lg`）＋ 36px タイル | `.cat-row` に `catClass(c.id)`、先頭に `<span class="cat-tile">${catIcon(c.id,'ic-lg')}</span>` |
| 4 | ② ランキング行 | `dashSectionsHTML` | 16px（`ic-sm`） | `.use-row` に `catClass(x.cat)`、名前の前にアイコン、バーの塗りも `--cat-accent` |
| 5 | ② おすすめ | `dashSectionsHTML` | 28px（`ic-xl`）＋ 44px タイル | `.reco-item` に `catClass`、カードの上に `.reco-head`（タイル＋分類名） |
| 6 | 詳細画面（3 パターン共通） | `renderMain` detail 分岐 | 20px | `.detail-card` に `catClass(x.cat)`、`.d-crumb` の先頭に `catIcon(x.cat)`。`.d-crumb` の色を `--cat-accent` に |

**① のサイドバーで選択中（`.nav-item.on`）のラベル色は `--action-primary` のまま**にする
（選択＝ブランド色、分類＝アクセント色、と役割を分ける）。

---

## 5. B：ヒーローとデータ表現

### 5-1. 追加するトークン（ヒーロー・統計）

`:root` に追加：

```css
  /* --- ② ヒーロー帯（ライト/ダークとも常に暗い面。文字は白で固定） --- */
  --surface-hero:        linear-gradient(104deg, #070F26 0%, #0C2647 46%, #124E80 100%);
  --surface-hero-chip:   rgba(255, 255, 255, 0.10);
  --border-hero:         rgba(255, 255, 255, 0.16);
  --border-hero-accent:  var(--ntt-turquoise);   /* 帯の下端 3px */
  --text-on-hero:        var(--ntt-white);
  --text-on-hero-soft:   rgba(255, 255, 255, 0.82);

  /* --- 大きな数字用の成熟度色 ---
     --status-success 等は 40px の数字にすると白地で 1.9:1 しかなく読めない。
     テキスト用に別トークンを立てる（§2-7：成熟度に手を入れるときは light/dark 同時） */
  --status-live-text:      #00733A;
  --status-trial-text:     #8A5300;
  --status-concept-text:   #5A6B78;
  /* ヒーロー帯（常に暗い面）の上に置く数字用。テーマで変えない */
  --status-live-hero:      #5BE79B;
  --status-trial-hero:     #FFD34D;
  --status-concept-hero:   #C3CDD6;
```

`:root[data-theme="dark"]` に追加：

```css
  --surface-hero:      linear-gradient(104deg, #050B1A 0%, #08192E 46%, #0E3A60 100%);
  --surface-hero-chip: rgba(255, 255, 255, 0.08);
  --border-hero:       rgba(255, 255, 255, 0.12);

  --status-live-text:    #5BE79B;
  --status-trial-text:   #FFD34D;
  --status-concept-text: #B8C3CC;
```

**コントラスト実測**

| 用途 | 前景 | 背景 | 比 |
|---|---|---|---|
| 見出し・数字（白） | `#FFFFFF` | 帯の最明部 `#124E80` | **8.65** |
| リード文（白 82%） | 実効 `#CDD9E4` | 帯の最明部 `#124E80` | **約 6.2** |
| 帯の統計 提供中 | `#5BE79B` | `#124E80` | **5.50** |
| 帯の統計 試行版 | `#FFD34D` | `#124E80` | **6.05** |
| 帯の統計 構想 | `#C3CDD6` | `#124E80` | **5.37** |
| light 本文の成熟度色 | `#00733A` / `#8A5300` / `#5A6B78` | 白カード | 5.98 / 6.33 / 5.51 |
| dark 本文の成熟度色 | `#5BE79B` / `#FFD34D` / `#B8C3CC` | `#111C30` | 10.83 / 11.91 / 9.51 |

グラデーションの最明部（`#124E80`）を基準に測ってあるので、帯のどこに文字が来ても 4.5:1 を割らない。
**ブランド Future Blue（#0071BC）は白文字で 5.14 とギリギリなので、帯の塗りには使わず、
下端 3px の turquoise キーラインでブランド感を出す。**

### 5-2. `renderDash` の新しい骨格

```js
function renderDash(el) {
  const n1 = SVCS.filter(x => x.st === 1).length;
  const n2 = SVCS.filter(x => x.st === 2).length;
  const n3 = SVCS.filter(x => x.st === 3).length;
  el.innerHTML = `
  <div class="dash-wrap" data-screen-label="ダッシュボード">
    <section class="hero">
      <div class="hero-top">
        <div class="hero-copy">
          <div class="hero-eyebrow">AI AGENT CATALOG</div>
          <h1>${esc(t('dashWelcome'))}</h1>
          <p>${esc(t('dashLead').replace('{c}', CATS.length).replace('{n}', SVCS.length))}</p>
        </div>
        <input class="search" id="search" placeholder="${esc(t('searchPh'))}" value="${esc(state.query)}">
      </div>
      <div class="stat-strip">
        <div class="stat stat-total">
          <div class="stat-n">${SVCS.length}</div><div class="stat-l">${esc(t('statAll'))}</div></div>
        <div class="stat"><div class="stat-n s-live"><span class="dot live"></span>${n1}</div>
          <div class="stat-l">${esc(t('statusLive'))}</div></div>
        <div class="stat"><div class="stat-n s-trial"><span class="dot trial"></span>${n2}</div>
          <div class="stat-l">${esc(t('statusTrial'))}</div></div>
        <div class="stat"><div class="stat-n s-concept"><span class="dot concept"></span>${n3}</div>
          <div class="stat-l">${esc(t('statusConcept'))}</div></div>
      </div>
    </section>
    <div class="dash-body"><div id="home-holder">${dashSectionsHTML()}</div></div>
  </div>`;
  bindHomeSearch(dashSectionsHTML);
  el.scrollTop = 0;
}
```

- `#home-holder` は **`.dash-body` の中**。検索するとその中だけが件数＋グリッドに差し替わり、**帯と統計は残る**
  （全体像は検索中も意味を持つ数字なので残して良い。レイアウトの飛びも起きない）
- 検索欄の `id="search"` と `bindHomeSearch` の契約は**変えない**（IME 対策の §3-5 をそのまま維持）
- `.crumb`（`--action-primary` 前提）は帯の上では使わず、専用の `.hero-eyebrow` を使う

### 5-3. 「よく使われている」＝横棒ランキング（`.use-list`）

```js
  const maxUses = Math.max(...HOME.frequent.map(f => f.uses));
  const freqHTML = `
    <div class="dash-sec">
      <div class="sec-h">
        <h2>${esc(t('dashFreq'))}</h2>
        <span class="sec-note">${esc(t('dashFreqNote'))}</span>
      </div>
      <div class="use-list">
        ${HOME.frequent.map((f, i) => {
          const x = svcOf(f.id), c = catOf(x.cat);
          const w = Math.round(f.uses / maxUses * 100);
          return `
          <button class="use-row ${catClass(x.cat)}" data-act="svc" data-arg="${x.id}">
            <span class="use-rank">${i + 1}</span>
            <span class="use-main">
              <span class="use-name">${catIcon(x.cat, 'ic-sm')}${esc(L(x.name))}
                <span class="code">${esc(svcCode(x.id))}</span></span>
              <span class="use-sub">${esc(L(c.name))}
                <span class="status"><span class="dot ${statusClass(x.st)}"></span>${esc(statusText(x.st))}</span></span>
            </span>
            <span class="use-bar"><span class="use-fill" style="width:${w}%"></span></span>
            <span class="use-n">${esc(t('usesUnit').replace('{n}', f.uses))}</span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
```

- **インライン `style` は `width:NN%` だけ**。色は絶対にインラインに書かない（§2-2、`verify.mjs` §5）
- バーの塗りは `var(--cat-accent)`＝その行の分類色。6 本が色違いになり「どの分野が使われているか」が一目で分かる
- `maxUses` 基準の相対長。件数の数字を必ず併記するので、色・長さだけが情報の担い手にならない（アクセシビリティ）
- 行全体が `data-act="svc"` のボタン。**`data-act` は増やさない**

### 5-4. 「おすすめ」（`.reco-panel`）

```js
  const recoHTML = `
    <div class="dash-sec reco-panel">
      <div class="sec-h">
        <h2>${esc(t('dashReco'))}</h2>
        <span class="sec-note">${esc(t('dashRecoNote'))}</span>
      </div>
      <div class="reco-grid">
        ${HOME.recommended.map(r => {
          const x = svcOf(r.id), c = catOf(x.cat);
          return `
          <div class="reco-item ${catClass(x.cat)}">
            <div class="reco-head">
              <span class="reco-tile">${catIcon(x.cat, 'ic-xl')}</span>
              <span class="reco-cat">${esc(L(c.name))}</span>
            </div>
            ${cardHTML(x)}
            <div class="r-why"><span class="r-why-l">${esc(t('recoWhy'))}</span>${esc(L(r.why))}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
```

- **1 件目を大きくしない**（§1 の理由）。3 件は対等
- 節を `--surface-sunken` の面に沈めて前後の節と分ける
- `.r-why-l` の色は **`--action-primary` のまま**（sunken 上にアクセント色の文字を置かない＝§4-1 の制約）

### 5-5. 「分類から見る」（凡例つき・バー 12px）

```js
  const legendHTML = `
    <span class="legend" title="${esc(t('dashCatsNote'))}">
      <span class="lg-i"><span class="dot live"></span>${esc(t('statusLive'))}</span>
      <span class="lg-i"><span class="dot trial"></span>${esc(t('statusTrial'))}</span>
      <span class="lg-i"><span class="dot concept"></span>${esc(t('statusConcept'))}</span>
    </span>`;
```

`.sec-h` の `.sec-note` の位置にこの `.legend` を置く。
**`dashCatsNote` は `title` 属性として参照が残る**ので、`verify.mjs` §4 の「未使用キー」warn が出ず、
`regress` の `uiKeys` も動かない。

分類行：

```js
        <button class="cat-row ${catClass(c.id)}" data-act="gocat" data-arg="${c.id}">
          <span class="cat-tile">${catIcon(c.id, 'ic-lg')}</span>
          <span class="c-nm">${esc(L(c.name))}</span>
          <span class="cat-mix">${esc(countText(list.length))}</span>
          <span class="cat-bar">…（既存のまま。0 件のセグメントは出さない）…</span>
          <span class="cat-mix">${cn1} / ${cn2} / ${cn3}</span>
          <span class="cat-chev"></span>
        </button>
```

- `.cat-bar` の高さ 8px → **12px**、セグメント間に 2px の隙間（`gap: 2px`）を入れて区切る
- 右端に `›` 相当の `.cat-chev`（既存 `.chev` と同じ作り方の CSS 三角。`--text-muted`）
- 行間は `border-top: 1px solid var(--border-subtle)`（既存どおり）

### 5-6. dark の影トークン（既存値の変更が必要な唯一の箇所）

`--shadow-sm` / `--shadow-md` は `rgba(7, 15, 38, …)`＝ネイビーの薄い影で、
dark の面（#111C30）ではほぼ見えず、カードが背景に溶ける。**dark ブロックでのみ**上書きする：

```css
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow-md: 0 6px 18px rgba(0, 0, 0, 0.55);
```

`--shadow-focus` は**変えない**（フォーカスリングの見え方が変わるため）。
これは「既存トークンの dark 上書き」なので **§2-2 の許容範囲内**（セマンティック層のみ・`--ntt-*` 不変）だが、
`--shadow-*` に触るのはこの 2 行だけであることを PR 本文に明記すること。

---

## 6. C：密度と階層

### 6-1. タイプスケール（この画面での確定値）

| 役割 | サイズ / ウェイト | 色 | 備考 |
|---|---|---|---|
| ヒーロー eyebrow | 11px / 700 / tracking .14em | `--text-on-hero-soft` | 大文字ラテン |
| ヒーロー h1 | **30px**（`--text-h1`）/ 700 / line-height 1.25 | `--text-on-hero` | |
| ヒーロー リード | 14px / 400 / line-height 1.65 | `--text-on-hero-soft` | `max-width: 54ch` |
| 統計 総数 | **44px** / 700 / line-height 1.0 / tracking -0.02em | `--text-on-hero` | |
| 統計 内訳 | **36px** / 700 / line-height 1.0 | `--status-*-hero` | ドットを 8px に |
| 統計 ラベル | 12px / 400 | `--text-on-hero-soft` | |
| 節見出し h2 | **16px** / 700 | `--text-heading` | 左に 3px `--action-primary` キーライン |
| 節の補足 / 凡例 | 11.5px | `--text-muted` | `margin-left: auto` |
| ランキング 順位 | 13px / 700 | `--text-muted` | 幅 22px 右揃え。丸バッジはやめる |
| ランキング サービス名 | **14.5px** / 700 | `--text-heading` | |
| ランキング 分類・成熟度 | 11.5px | `--text-secondary` | |
| ランキング 件数 | 12.5px / 700 | `--text-body` | 数字を等幅に（`font-variant-numeric: tabular-nums`） |
| カード名 | 15.5px / 700 | `--text-heading` | 既存のまま |
| カード説明 | 12.5px / 1.65 / 2 行クランプ | `--text-body` | 既存のまま |
| 分類行 名前 | 14px / 700 | `--text-heading` | 13.5 → 14 |
| おすすめ 分類名 | 12px / 700 | `--cat-accent` | |

### 6-2. 影・余白・区切り

- **影**：`.card` に `--shadow-sm`、hover で `--shadow-md`＋`translateY(-1px)`。`.stat` は帯の中なので影なし（`--surface-hero-chip` と `--border-hero` で分ける）。`.use-row` / `.cat-row` は影なし（リストなので線で分ける）
- **既存トークンを流用**。`--shadow-*` を新規追加しない（dark の値だけ §5-6 で上書き）
- **余白**：帯 `padding: var(--space-10) 36px var(--space-8)` / 本文 `padding: var(--space-10) 36px var(--space-12)`
- **節間**：`.dash-sec { margin-bottom: var(--space-12); }` ＋ `.dash-sec + .dash-sec { border-top: 1px solid var(--border-subtle); padding-top: var(--space-10); }`。ただし `.reco-panel` は自前の面を持つので `border-top` を打ち消す
- **リズム**：見出し→中身は `var(--space-4)`、行間は 1px 罫、カード間は `var(--space-4)`

### 6-3. 1180px 以下（既存 `@media` ブロックの末尾に追記）

```
┌ .hero  padding 32px 20px 24px ──────────┐
│ AI AGENT CATALOG                        │
│ AIエージェント ホーム                     │   ← .hero-top が縦積み
│ 8 分類 41 件の…                          │
│ ┌ .search width:100% ─────────────────┐ │
│ └─────────────────────────────────────┘ │
│ ┌ 41   ┐┌ ● 12 ┐                        │   ← .stat-strip は 2 列（縦罫は消す）
│ └──────┘└──────┘                        │
│ ┌ ● 21 ┐┌ ● 8  ┐                        │
│ └──────┘└──────┘                        │
└═════════════════════════════════════════┘
┌ .dash-body  padding 32px 20px 48px ─────┐
│ ▎よく使われているエージェント             │
│ ┌ .use-row（2 段組み）─────────────────┐ │
│ │ 1 [◧] 技術ナレッジQA        KN-01    │ │
│ │       ナレッジ検索 ● 提供中           │ │
│ │ ██████████████████████  今月 312 件  │ │   ← バーは 2 行目に全幅で回り込む
│ └──────────────────────────────────────┘ │
│ ▎おすすめ（1 列）                         │
│ ▎分類から見る                             │
│ ┌ .cat-row ────────────────────────────┐ │
│ │ [◧] ナレッジ検索・問い合わせ   5件     │ │
│ │ ███████░░░░░░  3 / 2 / 0            › │ │
│ └──────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

追記する CSS（既存 2 行 ＋ #47 で入った 3 行は触らない）：

```css
    /* ▼ デザインパス（#42 PR-3）で追記 */
    .hero { padding: var(--space-8) var(--space-5) var(--space-6); }
    .hero-top { flex-direction: column; align-items: stretch; }
    .hero .search { width: 100%; }
    .hero h1 { font-size: var(--text-h2); }
    .stat-strip { grid-template-columns: 1fr 1fr; gap: var(--space-3); }
    .stat { border-left: none; padding-left: 0; }
    .stat-total .stat-n { font-size: 36px; }
    .stat .stat-n { font-size: 30px; }
    .dash-body { padding: var(--space-8) var(--space-5) var(--space-12); }
    .use-row { grid-template-columns: 22px minmax(0, 1fr) auto; row-gap: var(--space-2); }
    .use-bar { grid-column: 1 / -1; }
    .cat-row { grid-template-columns: 36px 1fr auto; row-gap: var(--space-2); }
    .cat-bar { grid-column: 1 / -1; }
```

**横スクロールを出さないための鉄則**：`.use-list` / `.cat-row` の 1fr カラムはすべて `minmax(0, 1fr)`。
テキストには `min-width: 0`。バーの `width:NN%` は親幅に対する % なので固定 px を混ぜない。

---

## 7. 追加・変更する CSS（すべてトークン参照。`#RRGGBB` は 1 つも書かない）

2 つ目の `<style>` の「② ダッシュボード（ホーム）」節を置き換える。**色の直値を書いたら `verify.mjs` §5 が FAIL する。**

| クラス | 役割 | 主なトークン / 値 |
|---|---|---|
| `.ic` | アイコン共通 | `width:20px; height:20px; flex-shrink:0; display:block` |
| `.ic-sm` / `.ic-lg` / `.ic-xl` | サイズ | `16px` / `24px` / `28px` |
| `.cat-kn` … `.cat-pt`（8 個） | 分類色の受け渡し | `.cat-kn { --cat-accent: var(--cat-kn); --cat-accent-bg: var(--cat-kn-bg); }` を 8 分類ぶん |
| `.dash-wrap` | 画面枠 | `padding: 0`（帯を全幅にするため。**旧 `var(--space-8) 36px …` を廃止**） |
| `.hero` | 帯 | `background: var(--surface-hero); border-bottom: var(--border-accent) solid var(--border-hero-accent); padding: var(--space-10) 36px var(--space-8)` |
| `.hero-top` | 見出し＋検索 | `display:flex; align-items:flex-end; justify-content:space-between; gap:var(--space-6); flex-wrap:wrap; margin-bottom:var(--space-8)` |
| `.hero-eyebrow` | 小見出し | `font-size:var(--text-overline); letter-spacing:var(--tracking-overline); font-weight:var(--weight-bold); color:var(--text-on-hero-soft); margin-bottom:var(--space-2)` |
| `.hero h1` | 見出し | `margin:0 0 var(--space-2); font-size:var(--text-h1); font-weight:var(--weight-bold); color:var(--text-on-hero); line-height:var(--leading-snug)` |
| `.hero p` | リード | `margin:0; max-width:54ch; font-size:14px; line-height:var(--leading-relaxed); color:var(--text-on-hero-soft)` |
| `.hero .search` | 検索 | `width:320px; border-color:transparent; box-shadow:var(--shadow-sm)` |
| `.stat-strip` | 統計 | `display:grid; grid-template-columns:1.35fr 1fr 1fr 1fr; gap:0; background:var(--surface-hero-chip); border:1px solid var(--border-hero); border-radius:var(--radius-sm)` |
| `.stat` | 各枠 | `padding:var(--space-4) var(--space-5); border-left:1px solid var(--border-hero)` （`:first-child` は `border-left:none`） |
| `.stat-n` | 数字 | `display:flex; align-items:center; gap:var(--space-2); font-size:36px; font-weight:var(--weight-bold); line-height:1; font-variant-numeric:tabular-nums; color:var(--text-on-hero)` |
| `.stat-total .stat-n` | 総数 | `font-size:44px; letter-spacing:var(--tracking-tight)` |
| `.stat-n.s-live` / `.s-trial` / `.s-concept` | 内訳 | `color: var(--status-live-hero)` / `var(--status-trial-hero)` / `var(--status-concept-hero)` |
| `.stat-n .dot` | ドット | `width:8px; height:8px` |
| `.stat-l` | ラベル | `margin-top:var(--space-2); font-size:12px; color:var(--text-on-hero-soft)` |
| `.dash-body` | 本文枠 | `padding: var(--space-10) 36px var(--space-12)` |
| `.dash-sec` | 節 | `margin-bottom: var(--space-12)` |
| `.dash-sec + .dash-sec` | 節の区切り | `border-top:1px solid var(--border-subtle); padding-top:var(--space-10)` |
| `.sec-h h2` | 節見出し | `font-size:16px`（既存 15px から） |
| `.legend` | 凡例 | `display:flex; gap:var(--space-3); margin-left:auto; font-size:11.5px; color:var(--text-muted)` |
| `.lg-i` | 凡例 1 項目 | `display:inline-flex; align-items:center; gap:5px` |
| `.use-list` | ランキング | `border-top:1px solid var(--border-subtle)` |
| `.use-row` | 1 行（ボタン） | `display:grid; grid-template-columns:22px minmax(0,1fr) minmax(120px,26%) auto; align-items:center; gap:var(--space-4); width:100%; text-align:left; padding:var(--space-3) var(--space-2); border:none; border-bottom:1px solid var(--border-subtle); background:transparent; font-family:inherit; cursor:pointer` |
| `.use-row:hover` | | `background: var(--surface-hover)` |
| `.use-rank` | 順位 | `font-size:13px; font-weight:var(--weight-bold); color:var(--text-muted); text-align:right; font-variant-numeric:tabular-nums` |
| `.use-main` | 中央 | `display:flex; flex-direction:column; gap:3px; min-width:0` |
| `.use-name` | 名前行 | `display:flex; align-items:center; gap:6px; font-size:14.5px; font-weight:var(--weight-bold); color:var(--text-heading); min-width:0` |
| `.use-name .ic` | アイコン | `color: var(--cat-accent)` |
| `.use-name .code` | 管理番号 | `margin-left:var(--space-2)`（既存 `.code` の見た目を継承） |
| `.use-sub` | 補足行 | `display:flex; align-items:center; gap:var(--space-2); font-size:11.5px; color:var(--text-secondary)` |
| `.use-bar` | バー枠 | `height:10px; background:var(--surface-sunken); border-radius:var(--radius-pill); overflow:hidden` |
| `.use-fill` | 塗り | `display:block; height:100%; background:var(--cat-accent); border-radius:var(--radius-pill)` |
| `.use-n` | 件数 | `font-size:12.5px; font-weight:var(--weight-bold); color:var(--text-body); white-space:nowrap; font-variant-numeric:tabular-nums` |
| `.reco-panel` | おすすめの面 | `background:var(--surface-sunken); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:var(--space-6)`。`.dash-sec + .dash-sec` の区切り罫と二重にならないよう `.dash-sec + .dash-sec.reco-panel { padding-top: var(--space-6); }` で打ち消す（`!important` は使わない） |
| `.reco-grid` | 並び | 既存のまま（`auto-fill minmax(300px,1fr)`） |
| `.reco-item` | 1 件 | `display:flex; flex-direction:column; gap:var(--space-3)` |
| `.reco-head` | 見出し行 | `display:flex; align-items:center; gap:var(--space-3)` |
| `.reco-tile` | アイコンタイル | `width:44px; height:44px; display:flex; align-items:center; justify-content:center; background:var(--cat-accent-bg); color:var(--cat-accent); border-radius:var(--radius-sm)` |
| `.reco-cat` | 分類名 | `font-size:12px; font-weight:var(--weight-bold); color:var(--cat-accent)` |
| `.r-why` | 理由 | 既存のまま（背景は `--surface-card` に変更：sunken の上に sunken を重ねないため） |
| `.cat-row` | 分類行 | `grid-template-columns: 36px minmax(180px,1.1fr) auto minmax(160px,1fr) auto 12px`（タイル・名前・件数・バー・内訳・chev） |
| `.cat-tile` | タイル | `width:36px; height:36px; display:flex; align-items:center; justify-content:center; background:var(--cat-accent-bg); color:var(--cat-accent); border-radius:var(--radius-sm)` |
| `.cat-row .c-nm` | 名前 | `font-size:14px`（13.5 から） |
| `.cat-bar` | 成熟度バー | `height:12px; gap:2px`（トラックの `background: var(--surface-sunken)` は**そのまま残す**。セグメント合計は常に 100% なので、見えるのは 2px の隙間だけ） |
| `.cat-chev` | 右の山括弧 | `.chev` と同じ作り（`border-right/bottom: 2px solid var(--text-muted); transform: rotate(-45deg)`） |
| `.card` | カード | `box-shadow: var(--shadow-sm)` を追加。`transition` に `box-shadow`・`transform` を追加 |
| `.card:hover` | | `border-bottom-color: var(--cat-accent); box-shadow: var(--shadow-md); transform: translateY(-1px)` |
| `.card .c-top` | | `align-items:center`（`baseline` から。アイコンが入るため） |
| `.card .c-top .ic` | | `color: var(--cat-accent)` |
| `.card .c-crumb` | | `color: var(--cat-accent)`（`--action-primary` から）／`min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap` |
| `.nav-item .ic` | ① サイドバー | `color: var(--cat-accent); margin-right: var(--space-2)` |
| `.detail-card .d-crumb` | 詳細 | `display:flex; align-items:center; gap:var(--space-2); color: var(--cat-accent)` |

**`@media (prefers-reduced-motion: reduce)`** に `.card:hover { transform: none; }` を追記する。

---

## 8. 多言語（§2-1）

**`T` へのキー追加・削除・値の変更は 0 件。** 使う文言はすべて既存キー：

| 表示 | 使うキー | ja | zh | en |
|---|---|---|---|---|
| ヒーロー見出し | `dashWelcome` | AIエージェント ホーム | AI智能体 首页 | AI Agent Home |
| ヒーロー リード | `dashLead` | {c} 分類 {n} 件のエージェントを用意しています。… | （既存値） | （既存値） |
| 統計 総数 | `statAll` | サービス総数 | 服务总数 | All services |
| 統計 内訳・凡例 | `statusLive` / `statusTrial` / `statusConcept` | 提供中 / 試行版 / 構想 | 已上线 / 试用版 / 构想 | Available / Trial / Concept |
| 節見出し | `dashFreq` / `dashReco` / `dashCats` | （既存値） | （既存値） | （既存値） |
| 節の補足 | `dashFreqNote` / `dashRecoNote` | （既存値） | （既存値） | （既存値） |
| 凡例の tooltip | `dashCatsNote` | バーは成熟度の内訳（提供中／試行版／構想） | 柱状条显示成熟度构成（已上线／试用版／构想） | The bar shows the maturity mix (available / trial / concept) |
| 利用件数 | `usesUnit` | 今月 {n} 件 | 本月 {n} 次 | {n} runs this month |
| おすすめの理由 | `recoWhy` | おすすめの理由 | 推荐理由 | Why |
| 件数 | `countUnit` 経由の `countText()` | 件のサービス | 项服务 | services |
| 検索 | `searchPh` | サービスを検索 | 搜索服务 | Search services |

`AI AGENT CATALOG` は 3 言語共通のラテン表記として**ハードコードのまま**（現状 `renderDash` と `renderMain` の
`.crumb` で既にそうなっている。変えない）。

> **implementer への指示**：ラベルが足りないと感じたら**勝手に日本語を書かない**。
> 手を止めて PM に返す（3 言語を書き下ろすのは architect の仕事）。

---

## 9. ③ 業務フィードへの適用ルール（PR-2 の implementer 向け）

`docs/handoff/2026-09-06-patterns-dash-feed.md` §7 / §8 を**下記の差分で読み替える**。それ以外は §7 のまま。

### 9-1. ヒーロー帯 → 置かない（薄いヘッダーにする）

- ③ は「実装後に毎日使う担当者」向け。訴求用の帯は縦を食うだけで邪魔になる
- `.feed-head` は `background: var(--surface-card); border-bottom: 1px solid var(--border-subtle); padding: var(--space-6) 36px;` の**薄いヘッダー**にする。ヒーローのトークン（`--surface-hero` など）は使わない
- ②③ の差（訴求 vs 業務）が視覚的に説明できるので、モックレビューでの比較価値も上がる
- 統計 4 枚（`.stat-strip`）は ③ に**出さない**。③ の数字は「対応が必要 3 / 定例 2 / お知らせ 2」という節ごとの `.sec-count`

### 9-2. フィード項目（`.feed-item`）に分類の顔を足す

```
┌ .feed-item.due.cat-qa   左ボーダー 3px = 種別（期限=danger）─────────────┐
│ ┌──┐  [期限] 本日 17:00 まで                                            │
│ │◧ │  不具合原因分析・報告書（8D）作成                    QA-01         │
│ │36│  ライン3 の寸法不良。顧客への提出は明日 10:00。                     │
│ └──┘  品質・不具合対応   ● 試行版                          開く ›        │
│  ↑ .fi-tile（--cat-accent-bg / --cat-accent）                            │
└──────────────────────────────────────────────────────────────────────────┘
```

- **左ボーダー＝種別（緊急度）のまま**。担当者はまず「急ぎか」で走査するため、ここを分類色に置き換えない
- 項目の先頭に `.fi-tile`（36px、`--cat-accent-bg` ＋ 24px アイコン）を追加。`.feed-item` に `catClass(x.cat)` を付ける
- `.fi-cat`（分類名）の色を `--action-primary` → **`--cat-accent`**
- `.feed-item` に `box-shadow: var(--shadow-sm)`、hover で `--shadow-md`（② のカードと同じ挙動）
- レイアウトは `display:grid; grid-template-columns: 36px minmax(0,1fr); gap: var(--space-4) var(--space-3); align-items:start`

### 9-3. 期限バッジ（`.fi-kind`）の色 — PR-2 でトークンを 2 個追加

`--status-danger`（#E42600）は白地で 4.59、キャンバス上で 4.31 と余裕がない。**専用トークンを立てる**：

```css
/* :root */
  --status-danger-text: #B32100;                 /* 白地 6.70 / キャンバス 6.28 */
  --badge-due-bg:       rgba(228, 38, 0, 0.12);
/* :root[data-theme="dark"] */
  --status-danger-text: #FF9A80;                 /* dark カード 8.26 */
  --badge-due-bg:       rgba(255, 154, 128, 0.18);
```

| kind | 背景 | 文字 |
|---|---|---|
| `due`（期限） | `var(--badge-due-bg)` | `var(--status-danger-text)` |
| `routine`（定例） | `var(--badge-trial-bg)` | `var(--badge-trial-fg)` |
| `notify`（お知らせ） | `var(--badge-concept-bg)` | `var(--badge-concept-fg)` |

`.fi-when` は `due` のときだけ `color: var(--status-danger-text); font-weight: var(--weight-bold)`。

### 9-4. `.feed-side`（右レール）

- `.side-box h3` は ② の `.sec-h h2` と同じ言語に揃える：**左に 3px `--action-primary` のキーライン ＋ 13px/700**
- 「担当分類」の行：先頭に 16px の分類アイコン（`--cat-accent`）、行に `catClass(id)`
- 「最近使った」の行：汎用の `.dot` をやめ、**16px の分類アイコン**に置き換える（何のエージェントか色で分かる）
- `.side-box` に `box-shadow: var(--shadow-sm)`

### 9-5. ③ で守ること

- **`data-act` は増やさない**（`svc` / `gocat` のみ）。`state` の形も変えない
- `.hero*` 系クラス・`--surface-hero*` トークンは ③ で使わない
- ③ の `T` キー 12 個は `docs/handoff/2026-09-06-patterns-dash-feed.md` §4-2 のまま（本設計で増減しない）

---

## 10. `tools/verify.mjs` への追記（§5 CSS トークンの中）

既存の検査は 1 つも消さない。以下を **§5 の末尾**に足す。

```js
  // 5-a. dark ブロックはちょうど 1 つ（複数あると --ntt-* 上書き検査が素通りする）
  const darkCount = [...tokenCss.matchAll(/:root\[data-theme="dark"\]\s*\{/g)].length;
  if (darkCount !== 1) fail(`:root[data-theme="dark"] ブロックが ${darkCount} 個ある（1 個にする）`);
  else ok('dark ブロックは 1 つ');

  // 5-b. 分類アクセント --cat-<id> / --cat-<id>-bg は light と dark の両方に必要（§2-2 / §2-7）
  const lightRoot = (tokenCss.match(/:root\s*\{([\s\S]*?)\n\}/) || [, ''])[1];
  const darkRoot  = (tokenCss.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/) || [, ''])[1];
  const catTok = (css) => new Set([...css.matchAll(/(--cat-[a-z]{2}(?:-bg)?)\s*:/g)].map(m => m[1]));
  const lc = catTok(lightRoot), dc = catTok(darkRoot);
  const asym = [...lc].filter(v => !dc.has(v)).concat([...dc].filter(v => !lc.has(v)));
  if (asym.length) fail(`--cat-* が light/dark 非対称: ${asym.sort().join(', ')}`);
  else ok(`--cat-* ${lc.size} 個が light/dark 両方に定義済み`);
  for (const base of [...lc].filter(v => !v.endsWith('-bg'))) {
    if (!lc.has(base + '-bg')) fail(`${base} に対応する ${base}-bg が無い`);
  }
  // 5-c. CATS の分類 id に色トークンが無い場合は warn（顧客版差し替えを FAIL にしない。§2-9）
  if (CATS) for (const c of CATS) {
    if (!lc.has(`--cat-${c.id}`)) warn(`CATS.${c.id}: --cat-${c.id} が未定義（既定色 --cat-accent で描画される）`);
  }
```

- `CATS` は §2 で先に `grab()` 済み。§5 の位置からそのまま参照できる（`const` の巻き上げに注意し、
  §5 の中で再取得しないこと）
- **`CAT_STYLE` のキーと `CATS` の id の突き合わせは JS 側で行われない**（`_fallback` があるため）。
  verify では上記 warn で気づける形にとどめる

---

## 11. `regress.mjs` の期待差分

**差分ゼロ。`node tools/regress.mjs` は `--update` なしで PASS すること。**

| 項目 | 変更前 | 変更後 |
|---|---|---|
| `counts.cats` | 8 | **8** |
| `counts.subs` | 17 | **17** |
| `counts.svcs` | 41 | **41** |
| `counts.tags` | 43 | **43** |
| `counts.ui`（`T` キー） | 61 | **61** |
| `patterns` | nav=true / dash=true / feed=false | **同じ** |
| `cats` / `svcs` の id・並び・`cat`/`sub`/`st`/`tags` | — | **すべて同じ** |

`CAT_STYLE` は `regress.mjs` の `snapshot` 対象外（`grab()` されない）ので基準に影響しない。
**`node tools/regress.mjs --update` を実行したら、それ自体が設計違反。**

---

## 12. 受け入れ条件

### 12-1. 機械検証（implementer が PR 前、reviewer がレビュー時に再実行）

1. `node tools/verify.mjs` → **ALL PASS**（warn は「台本の無い SVCS」など既存のもののみ。**新しい warn を増やさない**）
   - §5 に `--cat-* 16 個が light/dark 両方に定義済み` が出る
   - §5 の「コンポーネント CSS に色の直値なし」が PASS（＝2 つ目の `<style>` に `#RRGGBB` が 1 つも無い）
   - §5 の「dark ブロックあり・`--ntt-*` は不変」が PASS
   - §3/§4 で未定義キー 0・**未使用キーの warn が増えない**（`dashCatsNote` は `title=` で参照が残る）
2. `node tools/regress.mjs` → **PASS**（`--update` なし。§11）
3. `git diff main -- tools/regress.baseline.json` → **空**
4. `git diff main --stat` の対象ファイルが `mock/catalog.html` と `tools/verify.mjs` の **2 つだけ**

### 12-2. Playwright（reviewer も同じ手順で再実行）

前提：`mock/catalog.html` を `file://` で開く。既定は ja / light / `pattern=nav`。

| # | 手順 | 期待 |
|---|---|---|
| P-1 | 初期表示（① nav）でカードを 1 枚スクリーンショット | パンくずの前に SVG アイコンが 1 個。`.card` に `catClass` 由来のクラス（`cat-kn` 等）が付いている |
| P-2 | ① の `.card` を全部数え、`querySelectorAll('.card .c-top svg.ic').length === .card の枚数` | 一致（全カードにアイコン） |
| P-3 | ① サイドバーの `[data-act="cat"]` 8 個それぞれに `svg.ic` が 1 個 | 一致。`[data-act="all"]` と `.nav-sub` にはアイコンが**無い** |
| P-4 | ② に切替（`.mockbar` の 2 番目） | `.hero` が 1 個・`.stat-strip` が `.hero` の子孫・`.stat` が 4 枚。`.stat-total .stat-n` の `font-size` が 44px |
| P-5 | ② で `.use-row` を数える | **6 行**。各行に `.use-fill` があり、`style.width` が `100%` → 降順で単調減少（312/268/214/186/147/132 → 100/86/69/60/47/42%） |
| P-6 | ② で `.reco-item` を数える | **3 件**。各件に `.reco-tile svg` と `.r-why` |
| P-7 | ② で `.cat-row` を数える | **8 行**。各行に `.cat-tile svg`。`.cat-bar` の `height` が 12px |
| P-8 | ② で `.legend .lg-i` を数える | **3 個**（提供中／試行版／構想）。`.legend` の `title` が `dashCatsNote` の ja 文言 |
| P-9 | ② の検索欄に「翻訳」と入力 | `#home-holder` が件数＋グリッドに差し替わる。**`.hero` と `.stat-strip` は残っている**。入力欄のフォーカスが外れない |
| P-10 | 検索欄を空に戻す | 元の 3 節（ランキング／おすすめ／分類）が復元される |
| P-11 | ② の `.use-row` を 1 つクリック | `view === 'detail'` の詳細画面。`.d-crumb` の先頭に SVG アイコン |
| P-12 | ② の `.cat-row` を 1 つクリック | その分類の一覧（`.list-wrap`）＋「ホームへ戻る」ボタン |
| P-13 | テーマを dark にして ② を再表示 | `.hero` の背景が dark 用グラデ。`getComputedStyle` で `.card .c-crumb` の色が light と**異なる**（dark の `--cat-*` に切替わっている） |
| P-14 | dark で `.stat-n.s-live` / `.s-trial` / `.s-concept` の色を取得し、`.hero` 背景（最明部 `#124E80`）とのコントラストを計算 | すべて **4.5 以上** |
| P-15 | light / dark それぞれで `.card .c-crumb` 8 分類ぶんの色と `--surface-card` のコントラストを計算 | すべて **4.5 以上**（§4-1 の表と一致） |
| P-16 | ビューポート幅 **1100px** で ②（ホーム）を表示 | `document.documentElement.scrollWidth <= 1100`（横スクロールなし）。`.stat-strip` が 2 列 |
| P-17 | 同 1100px で ①（一覧）と詳細も確認 | 横スクロールなし |
| P-18 | 言語を **中文** にして ② を表示し、`.dash-body` と `.hero` のテキストを取得 | ひらがな・カタカナ（`[぀-ヿ]`）が **0 件** |
| P-19 | 言語を **English** にして同上 | ひらがな・カタカナが **0 件**。`AI AGENT CATALOG` はラテンなので可 |
| P-20 | ② → ③ セグメント | **`disabled` のまま**（PR-2 未実施）。押しても何も起きない |
| P-21 | ② でサービス → 詳細 → デモ開始 → 2 往復 → 言語切替 | 会話が復元される（`state.log`）。デモ画面の見た目は**この PR で変わっていない** |

### 12-3. 目視での load-bearing 照合（reviewer）

- `git diff main -- mock/catalog.html` に **`--ntt-` の追加・変更行が無い**
- 2 つ目の `<style>` の diff に `#` で始まる色リテラルが**無い**
- `T` / `CATS` / `SVCS` / `TAGS` / `SCENARIOS` / `HOME` の diff が**無い**
- `state = {` と `act === '` の diff が**無い**
- `.mockbar` / `#lang-select` / `#theme-btn` の diff が**無い**
- `renderFeed` が**まだ実装されていない**（PR-2 のスコープ）

---

## 13. 回帰の許容範囲（① と 詳細画面が変わることの明示）

`cardHTML` は ①②③ 共通、詳細画面は 3 パターン共通なので、**② 以外の画面も見た目が変わる**。
以下は **本設計で意図した変更**であり、reviewer は「① が変わった」を理由に差し戻さない。

| 画面 | 変わること | 変わらないこと |
|---|---|---|
| ① 一覧のカード | ①アイコン追加 ②パンくずの色が分類色に ③影 ④hover の下辺色が分類色に | 文言・並び・件数・クリック先・カードの寸法とグリッド |
| ① サイドバー | 大分類 8 行にアイコン追加（左に 20px ぶん寄る） | 中分類・「すべてのサービス」・件数・開閉・選択色（`--action-primary`） |
| 詳細画面 | `.d-crumb` にアイコン＋分類色 | 管理番号・見出し・バッジ・タグ・概要・担当者・手順・「デモを開始」ボタン |
| ③ | （未実装なので影響なし） | — |
| デモ / チャット画面 | **何も変わらない** | すべて |

**PM が「① は今のままがよい」と言った場合**は、`cardHTML` への適用をやめて ② 専用のカードラッパーを作る
必要があり、設計をやり直す（§15 の判断待ち 1）。

---

## 14. PR 分割案 / 並列可否

### 14-1. 分割 — **1 PR（`feat/42-design-pass`）にまとめる**

A（分類の顔）・B（ヒーロー）・C（密度）を分けると、
`:root`・dark ブロック・`.card`・`.dash-*` CSS・`dashSectionsHTML` が 3 回衝突し、
中間状態（アイコンだけ入って色が無い等）でモックが中途半端になりレビューできない。
**A → B → C の順に 3 コミットに分け、PR は 1 本**にする。

| コミット | 内容 | 単体で verify PASS |
|---|---|---|
| 1 | `--cat-*` トークン（light/dark）＋ `CAT_STYLE` ＋ `catIcon`/`catClass` ＋ `.ic`/`.cat-*` CSS ＋ `cardHTML`/`renderSidebar`/detail への適用 ＋ verify §5-a/5-b/5-c | ○ |
| 2 | ヒーロー帯トークン ＋ `renderDash` の帯化 ＋ `.stat-*` の作り替え ＋ ランキング（`.use-*`）＋ おすすめ（`.reco-*`）＋ 分類行の強化 | ○ |
| 3 | タイプスケール・影・余白・節区切り・`@media` 追記 | ○ |

### 14-2. 並列可否 — **PR-2（③ 業務フィード）とは直列**

重なるファイル集合：`mock/catalog.html` の 1 つ目 `<style>`（トークン）・2 つ目 `<style>`・`cardHTML`・
`@media` ブロック・`tools/verify.mjs` §5。**同時に走らせると必ず衝突する。**

```
#47（② 実装・マージ済み）
      ↓
本 PR「デザインパス」 feat/42-design-pass   ← 今回
      ↓（マージ後、§9 を読んで）
PR-2「③ 業務フィード」 feat/42-feed
```

③ の設計書（`2026-09-06-patterns-dash-feed.md` §7）は**そのまま生きている**。
PR-2 の implementer は §7 を読んだうえで、本書 §9 の差分を上書き適用する。

---

## 15. PM 判断待ち（各項に architect 推奨を 1 行）

「推奨で進めてよい」を受けて **1〜6 は推奨のまま実装に出す**。異論があればこの節に返答をもらう。

| # | 論点 | architect 推奨 |
|---|---|---|
| 1 | `cardHTML` に触るので **① のカードも見た目が変わる**（アイコン・分類色・影） | **変える**。3 パターンで同じ視覚言語を使えることが比較レビューの前提。① だけ旧デザインだと「② が特別扱い」に見える |
| 2 | 詳細画面のパンくずにも分類色＋アイコンを入れるか | **入れる**。一覧 → 詳細 → デモが顧客の視線導線で、詳細で色が切れると装飾に見える |
| 3 | 「よく使う」をカード 6 枚 → 横棒ランキングに変えること | **変える**。共通ベースラインでないと利用実績の差が読めない（PM 指摘 4 の直接の答え） |
| 4 | おすすめ 1 件目を大きくするか | **しない**。3 件は対等な提案。順位の意味が生まれると `HOME.recommended` の並びが仕様になる |
| 5 | ヒーロー帯の色 | **Smart Navy → 濃紺ブルーのグラデ＋下端 3px turquoise**。Future Blue 単色は白文字 5.14 と余裕が無く、大面積だと彩度が強すぎる |
| 6 | ③ にヒーロー帯を置くか | **置かない**（薄いヘッダー）。②＝訴求 / ③＝業務、という差が説明できる |
| 7 | **分類の色と意味の対応**（kn=青 / qa=赤 / dc=ティール / lg=紫 / nm=オリーブ / en=スレート / gn=緑 / pt=マゼンタ） | 顧客に見せる色なので**ここだけは PM に確認したい**。特に **qa=赤** は「品質＝不具合＝赤」で自然だが、「品質が悪いように見える」と取られる可能性がある。差し替えるなら `--cat-qa` を `#B45309`（アンバー）に変えれば済む（白地 5.02 / キャンバス 4.72 / dark は `#F0A64A` で 8.32） |
| 8 | `HOME.frequent[].uses` の注記 | 現行の `dashFreqNote`「社内の利用実績（デモ用のサンプル値）」を**そのまま**。数字が大きく出るぶん誤解されやすいので、文言を強めたい場合は 3 言語を architect が書き直す |

**判断待ちは 7 と 8 のみ。7 に回答が無い場合は表のとおり（qa=赤）で実装に出す。**
