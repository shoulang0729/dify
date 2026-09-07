# Claude Code 引き渡しメモ — デザインパス2（design-pass-2）

**元文書**：`docs/handoff/2026-09-07-claude-design-handoff.md`
**成果物**：`mock/catalog.html`（本ファイルと同梱）、`mock/index.html`（トークン同期のみ）
**PM 決定**：ヒーローは A改「製造ライン」（統計右列）／カードは分類色アイコンタイル案／モーションはしっかり／両テーマ同比重／プロジェクター前提

---

## 触った層

### トークン層（値のみ。名前・`--ntt-*` は不変）
| トークン | light | dark | 理由 |
|---|---|---|---|
| `--surface-hero` | グラデ → `var(--ntt-smart-navy)` | グラデ → `#050B1A` | A案はフラットな深紺。`.hero::after` のグラデ端点にも使うため単色化 |
| `--font-display` | 末尾に `"Songti SC", SimSun` 追加 | 同左（テーマ共通） | ヒーロー h1 を Georgia 系にしたため zh の明朝フォールバックを追加 |

`mock/index.html` にも `--font-display` の同値を反映済み。

### コンポーネント CSS（すべて `var(--…)`、hex 直値なし）
- **mockbar**：下線を dashed に（足場感）、ラベルを muted に
- **① サイドバー**：`.nav-item.on` / `.nav-sub.on` に左 3px インセットアクセント（分類色／プライマリ）
- **② ヒーロー**：A改を実装。`.hero-top`→`.hero-flex`（左：見出し 42px `--font-display`＋リード＋検索、右：`.stat-strip`＝総数 80px＋成熟度 3 段 `.stat-row`）。SVG 背景 `.hero-bg`（`.h-line`=`--status-info`、`.h-belt`=`--border-hero-accent` が流れる、`.h-node` が明滅）、`.hero::after` に左からのフェード
- **① カード**：`.c-tile`（40px、`--cat-accent-bg`/`--cat-accent`）＋ `.c-head`（クラム＋サービス名 16px）。ホバー -2px
- **② おすすめ**：`.reco-head`/`.reco-tile`/`.reco-cat` を削除（カード自体がタイルを持つため重複解消）
- **詳細**：`.detail-card` に分類色の下線 3px
- **デモ**：結果パネル `.panel.result` に上線 3px＋shadow-md＋rise-in（AI が返した感）
- **② ホーム2列化**（PMレビュー反映）：`.dash-duo`（左：おすすめ 280–360px 縦積み／右：`.dash-col`＝ランキング＋分類一覧）。1180px 以下は1列
- **分類バー**（PMレビュー反映）：`.cat-bar-track`（地）＋ `.cat-bar`（幅＝サービス数の相対長、中の色分け＝成熟度内訳）
- **バー位置揃え**（PMレビュー反映）：`.use-row`・`.cat-row` のグリッド右側を同一構成（バー `minmax(120px, 26%)`＋数値 `6.5em`＋シェブロン `12px`）に統一し、両セクションでバーの開始・終了位置が縦に一致。ランキング行にもシェブロン追加
- **デモ画面**（PMレビュー反映）：`.work-pane` を 50% 固定（max-width 撤廃）で左右均等
- **モーション**（新規 keyframes：`belt-run` `node-pulse` `rise-in` `grow-x`）：セクション/カード/フィードの段階フェードイン、ランキング横棒・分類内訳バーの伸長。`prefers-reduced-motion` で全停止
- **1180px メディアクエリ**：旧 `.hero-top`/`.stat` 規則を新クラスに置換

### 描画（マークアップのみ。`data-act`/`data-arg`/`id` は全て維持）
- `renderDash`：ヒーロー新マークアップ（SVG＋`.hero-flex`）。eyebrow に既存キー `t('wordmark')` を連結（新規文言なし）
- `cardHTML`：タイル＋ヘッドの新構造
- `dashSectionsHTML`：おすすめの `reco-head` 削除、`dash-duo`/`dash-col` の2列構造、分類バーに `cat-bar-track` 導入（幅＝件数比例）、ランキング行にシェブロン追加
- `panelHTML`：結果パネルに `result` クラス追加

## 触っていない層
データ層（`T`/`CATS`/`SVCS`/`SCENARIOS`/`HOME`/`FEED`/`CAT_STYLE`）、状態・遷移、`detectLang`、localStorage、IME 対応（`bindHomeSearch`）、成熟度 3 値、管理番号。

## 検証観点（PR 前に必ず）
1. `node tools/verify.mjs` → ALL PASS（既知 warn「未使用キー all」のみ）
2. `node tools/regress.mjs` → PASS（データ層は無変更、`--update` 不要）
3. 目視：日／中／英 × ライト／ダーク × ①②③・詳細・デモ 5 テンプレート。1100px / 375px で横スクロールなし
4. zh でヒーロー h1 の明朝表示（Songti SC / SimSun フォールバック）
5. `prefers-reduced-motion` でアニメーション停止
