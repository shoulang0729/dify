# Claude Design 引き渡しメモ — AIエージェント カタログ モック

**目的**：`mock/catalog.html` の**見え方**を良くする。構造・データ・遷移・検証は確定済みで変えない。
**公開先**：https://shoulang0729.github.io/dify/catalog.html（`main` への push で自動デプロイ）
**PM の現状評価**：機能は揃ったが「ダサい」。フラットで情報に強弱がなく、企業ポータルの見本のように見える。工場長に見せるデモとして「触ってみたい」と思わせる画面にしたい。

---

## 1. 何のモックか（30 秒版）

在中日系製造業（仮社名 **青嶺精工／青岭精工／SEIREI SEIKO**、蘇州工場）向けの **AIエージェント カタログ**。8 分類 41 サービス。
利用者は現場の担当者、デモを見る相手は工場長。メニューは日／中／英、エージェント本体は日中どちらの入力も受ける。
Dify で実装する前の**画面案**であり、応答は台本・数字はサンプル。

画面は 3 つの入口 ＋ 共通の奥：

| 入口（`.mockbar` で切替） | 誰向け | 中身 |
|---|---|---|
| ① 階層ナビ `nav` | 目的が明確な人 | 左サイドバー（分類→中分類）＋カードグリッド |
| ② ダッシュボード `dash` | 初めて使う人・工場長 | ヒーロー帯＋統計 4 枚、よく使う 6（横棒ランキング）、おすすめ 3、分類 8 行（成熟度バー） |
| ③ 業務フィード `feed` | 担当者の「今日の仕事」 | 対応が必要 3／定例 2／お知らせ 2、右レールに担当分類 3・最近使った 4 |
| 共通：詳細 `detail` | | ペルソナ・利用の流れ・画面タイプ・「デモを見る」 |
| 共通：デモ `demo` | | 5 テンプレート（QA／アップロード→結果／フォーム→ドラフト／差分比較／照会）。左に作業パネル、右にチャット。返答は「考え中」のあと 1.5〜3.5 秒で出る |

**`.mockbar`（最上部のグレー帯）はレビュー用の足場**で本番には無い。ヘッダー右の言語・テーマ切替は本番機能。ここを混ぜないこと。

---

## 2. ファイル構成と「層」

```
mock/
├── index.html      デモガイド（日／中）。catalog.html のトークン定義をコピーして使っている
├── catalog.html    本体。1 ファイル完結（外部 CSS/JS/画像なし、ビルドなし、約 520 KB）
└── README.md
tools/
├── verify.mjs      静的検査（i18n 一致・トークン・共通レイヤー・データ整合）
└── regress.mjs     データ層スナップショット比較（+ regress.baseline.json）
```

`catalog.html` は上から次の順で、**層ごとに触ってよい／いけないが決まっている**：

| 位置 | 層 | 触ってよいか |
|---|---|---|
| 1 つ目 `<style>`（約 290 行） | **トークン層**：`--ntt-*` ブランドパレット → セマンティックトークン（light）→ `:root[data-theme="dark"]` で上書き → `data-lang` 別フォント | セマンティックトークンの**値**は変えてよい。名前は変えない。`--ntt-*` は**名前も値も不変**。新トークンは light と dark を**同時に**定義 |
| 2 つ目 `<style>`（約 625 行、139 クラス） | **コンポーネント CSS** | 自由に変えてよい。ただし色は `var(--…)` のみ、`#RRGGBB` 直値は書かない（verify が FAIL にする） |
| `<script>` 前半 | **データ層**：`T`（UI 文言 73 キー）/ `PATTERNS` / `TAGS` / `CATS` / `SVCS` / `TEMPLATES` / `SCENARIOS` / `HOME` / `FEED` / `CAT_STYLE` | **触らない**（`CAT_STYLE` の SVG path だけは差し替え可） |
| `<script>` 中盤 | **状態と遷移**：`state`、`data-act` の click ハンドラ、`detectLang`、localStorage | **触らない** |
| `<script>` 後半 | **描画**：`renderChrome / renderSeg / renderSidebar / cardHTML / gridHTML / renderDash / dashSectionsHTML / renderFeed / feedSectionsHTML / feedItemHTML / panelHTML / resultHTML / chipsHTML / renderMain / addMsg / showTyping` | マークアップ・クラス名は変えてよい。**`data-act` / `data-arg` / `id="search" #msgs #chat-input #home-holder` は残す**（遷移とテストが依存） |

---

## 3. 触ってはいけないもの（`CLAUDE.md` §2 load-bearing の抜粋）

1. **多言語辞書のキー集合**：`T`・`TAGS`・`CATS`・`SVCS`・`TEMPLATES` は ja/zh/en 揃い。表示文言を変えたいときも 3 言語同時、`en` にかな残りなし
2. **`--ntt-*` 不変**。ダーク対応はセマンティック層だけ。dark ブロックは 1 つだけ
3. **`state` の形、`view` の 4 値、`data-act` 13 種**（`pattern/all/cat/sub/svc/back/backdetail/start/send/run/chip/restart/gocat`）
4. **`.mockbar`＝足場、ヘッダーの言語・テーマ＝製品**
5. **`localStorage` キー `mock.lang` / `mock.theme`**
6. **成熟度 `st` 1/2/3**（提供中／試行版／構想）とそのバッジ・ドット・トークン
7. **管理番号** `KN-02` は id からの変換（`svcCode`）。表示位置はカード右上・詳細・chat/demo ヘッダー。フィード項目には出さない
8. IME：②③ の検索は `renderMain()` を呼ばず `#home-holder` だけ差し替える（日本語変換を壊さない）。この仕組みは残す

---

## 4. トークン一覧（名前は固定。値を調整する対象）

| グループ | 個数 | 名前 |
|---|---|---|
| `--ntt-*`（**不変**） | 19 | future-blue / future-blue-150 / future-blue-50 / smart-navy / text-grey / grey-100 / black / white / grey-700 / grey-300 / grey-200 / grey-100-bg / grey-50 / green / turquoise / yellow / orange / orange-100 / orange-150 |
| `--surface-*` | 11 | canvas / card / sunken / inverse / brand / header / hover / selected / rail / hero / hero-chip |
| `--text-*` | 10 | heading / body / secondary / muted / on-brand / on-inverse / link / link-hover / on-hero / on-hero-soft |
| `--border-*` | 7 | subtle / default / card / strong / brand / hero / hero-accent |
| `--action-*` | 3 | primary / primary-hover / primary-active |
| `--status-*` | 13 | success / info / warning / danger / danger-strong / concept / danger-text / live-text / trial-text / concept-text / live-hero / trial-hero / concept-hero |
| `--badge-*` | 7 | live-bg / live-fg / trial-bg / trial-fg / concept-bg / concept-fg / due-bg |
| `--cat-*` | 18 | kn / qa / dc / lg / nm / en / gn / pt（各 `-bg` あり）＋ accent / accent-bg（フォールバック） |
| その他 | | `--focus-ring`、`--shadow-sm/-md/-focus`、`--radius-*`、`--space-*`、`--font-ui`（`data-lang` 別） |

分類色の現在値（light / dark）：KN 青 `#0071BC/#5AACEE`、QA アンバー `#B45309/#F0A64A`（PM 指定。赤は不可）、DC ティール `#00707C/#3FC9D8`、LG 紫 `#6A3FB5/#B79BFF`、NM オリーブ `#547000/#A8C93F`、EN スレート `#3D4A57/#A9BACB`、GN 緑 `#1F7A46/#52C98A`、PT マゼンタ `#A8347A/#F07AC0`。文字に使う色は白カード・ダークカード双方で **4.5:1 以上**を維持する。

---

## 5. 期待していること（デザインの論点）

PM の言葉は「ダサすぎる」。architect の見立てと合わせると論点は：

- **強弱**：見出し・数字・本文が同じ調子で並ぶ。何を最初に見るべきかが 1 秒で伝わらない
- **余白とリズム**：カードとセクションの間隔が均一で、面の切り替わりが弱い
- **色の使い方**：分類色はついたが「装飾」に見える。色が意味（この分類はこういう業務）を運ぶ使い方に
- **ヒーロー帯**：濃紺グラデ＋大きな数字は「よくあるダッシュボード」。青嶺精工という会社の現場感（製造・蘇州・日中）が出ていない
- **カード**：白地・細線・小タグの繰り返し。41 枚並んだとき目が滑る
- **デモ画面**：作業パネル（左）とチャット（右）の関係がフラット。「AI が処理して結果を返した」感が薄い（返答遅延と考え中ドットは入れた）

やってほしくないこと：ブランド色を NTT DATA パレット外に持ち出す／装飾のために構造を変える／英語だけ整えて日中を崩す／ライトだけ良くしてダークを置き去りにする。

---

## 6. 作業の進め方（戻し方）

1. **ブランチ**：`feat/<issue>-design-<slug>` を `main` から切る。`main` 直コミット禁止
2. **変更範囲**：§2 の「触ってよい」層だけ。`data-act`・`id` を保つ
3. **検証**（PR 前に必ず）：
   ```bash
   node tools/verify.mjs     # ALL PASS が条件。warn は「未使用キー all」1 件が既知（別 Issue で解消予定）
   node tools/regress.mjs    # PASS が条件。--update は使わない（データ層を触っていないなら差分は出ない）
   ```
4. **目視**：日／中／英 × ライト／ダーク × ①②③・詳細・デモ 5 テンプレート。幅 1100px と 375px で横スクロールなし。Playwright は `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`（この開発環境の場合）
5. **PR**：本文に「触った層／触っていない層」「verify・regress の結果」「スクリーンショット（before/after、ライト・ダーク）」。reviewer が diff 監査してから squash マージ
6. `index.html`（デモガイド）はトークン定義をコピーしているので、**トークンの値を変えたら同じ値を `index.html` にも反映**する

---

## 7. 参考資料

- `CLAUDE.md`：ルール全文（§2 load-bearing が本体）
- `docs/handoff/2026-09-06-patterns-dash-feed.md`：②③ の設計（レイアウト図・データ定数・遷移）
- `docs/handoff/2026-09-06-design-pass.md`：直近のデザインパス（トークン追加・アイコン・ヒーロー・ランキング）。**「ここまでやってもダサい」の出発点**
- `docs/handoff/2026-09-06-demo-scenarios.md`：詳細・デモ画面の設計（5 テンプレート）
- `docs/handoff/2026-09-06-pm-decisions.md`：PM 判断の履歴（§7 D-1〜14、§8 デザインパス）
- `docs/handoff/service-index.md`：管理番号の台帳（フィードバックは `KN-02` のように番号で）
- 参考デッキ：Scope B 構想資料（PM 保管、Dify で開発するサービスの位置づけ）
