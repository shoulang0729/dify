# 有識者の「磨きをかけたい 3 点」をデモで見せる（KN-11 新設・ダミー資産・アップロード操作）

- 設計書：**`docs/handoff/2026-09-16-showcase-demo.md`**
- 親 Issue：**#244**（親設計書 `docs/handoff/2026-09-10-expert-feedback.md`。本 Issue はその **P-2** を決着させる）
- レーン：**M/L**
- 実行場所ラベル：**`run:cloud`**
- PM 決定（2026-09-16）：①「まずデモを作る」（実機 P-1 より先）②「**デモは入力もきちんと見せる。画像・音声のダミーファイルを準備し、アップロードする操作も作る**」

---

## 1. 何をするか（3 行）

1. 製造（青嶺精工 蘇州工場）で 1 本のストーリーにする：**手書き点検記録の写真（QA-01）→ ベテランの聞き取り音声（KN-11＝新設）→ ナレッジへの登録提案**。
2. **ダミーファイルを実体として `mock/assets/demo/` に置き**（手書き帳票 3 枚・音声 2 本＋文字起こし・作業標準書 PDF 2 版）、**アップロード操作（ドラッグ＆ドロップ／ファイル選択／プレビュー／音声再生／「サンプルを使う」）を本当に動くようにする**。
3. **読み取り（OCR・文字起こし）はしない。**結果は台本から出す。それを UI の注記とデモ台本に**正直に書く**。

## 2. どこまで本物か（顧客にそのまま説明する表）

| 要素 | 本物か |
|---|---|
| アップロードするファイル（写真・音声・PDF） | **本物のファイル**（Pages 上に実体がある。中身は架空） |
| アップロードの操作・プレビュー・音声再生 | **本物**（ブラウザで実際に動く） |
| 選んだファイルの行き先 | **どこにも行かない**（送らない・保存しない） |
| 読み取り（OCR・文字起こし） | **していない**（実機の仕事。実機は未実装） |
| 読み取り結果の「見せ方」 | **設計としては本物**（実機でもこの返し方にする） |
| エージェントの応答 | **本物ではない**（モック全体が台本） |

## 3. 受け入れ条件（要点。全文は設計書 §16）

### 全 PR 共通
- [ ] `npm test`（verify＋regress）が PASS
- [ ] `node tools/check-world.mjs` の warn が **12 件**に戻っている（PR-1 単体の例外あり）
- [ ] 実在の製品名・OCR/STT のベンダ名・実 URL が 1 つも無い
- [ ] `package.json` を触っていない（`dependencies` ゼロのまま＝`CLAUDE.md` §2-14）

### データ層（reviewer が `regress.mjs` と照合）
- [ ] `SVCS` **82 → 83**（追加は `kn11` の 1 件のみ。改名・削除ゼロ）
- [ ] `T` **91 → 95**（アップロード UI の 4 キー）
- [ ] `CATS` 15・`subs` 35・`TAGS` 67・`svcsMulti` 12 は**不変**
- [ ] 業種別 mfg **50 → 51** / fin 30 / it 26、成熟度 st3 **41 → 42**
- [ ] `--update` を使うのは PR-2 と PR-3 だけ。PR 本文に理由を書く
- [ ] `npm run index` で `docs/service-map.md` を再生成（PR-2）

### 契約を壊さない
- [ ] **`state` に新しいキーを足さない**（アップロードの保持はモジュールスコープ）
- [ ] **`data-act` の値を増やさない**（`data-up` / `data-pup` を使う）
- [ ] **`localStorage` は `mock.lang` / `mock.theme` / `mock.fav` の 3 つのまま**
- [ ] **`catalog.html` / `portal.html` の `<script src>` の並びと本数を変えない**
- [ ] **`TEMPLATES` は 5 種のまま**・**新しいタグを作らない**
- [ ] **`fetch(` を 1 か所も使わない**（`file://` で開ける＝§2-8）
- [ ] CSS に `#RRGGBB` の直値を書かない（§2-2）
- [ ] 資産サイズ：画像 ≤ 300 KB／音声 ≤ 1 MB／PDF ≤ 200 KB
- [ ] 画像に**実在の人の手書きが 1 文字も入っていない**／音声に**実在の人の声が入っていない**

## 4. 触らない範囲（全文は設計書 §14）

`mock/js/data/catalog.js` の既存 82 件・`CATS`／`ui.js` の `T` 末尾 4 キー以外／`tokens.css`／`mock/js/portal/{app,render}.js`／`js/data/portal/**`（`svc.js` の `PSVC` 1 件と `ui.js` の `PT` 4 キー以外）／`scenarios/` の `mfg/kn.js`・`mfg/qa.js` 以外（**`kn3`・`kn1` は絶対に触らない**）／`data/world/` の §5 の 3 か所以外（「未統一」の節を含む）／`dify/**`・`docs/dify/**` 全体／`docs/demo/{faq,briefing-*,runbook-fin}.md`／親設計書／`package.json`・`.github/**`・`.claude/**`・`CLAUDE.md`／リポジトリ直下の `portal/**`

## 5. PR の分割案

| PR | 内容 | 主なファイル | 依存 |
|---|---|---|---|
| **PR-0** | ダミー資産の生成ツールと生成物、verify §20 | `tools/gen-demo-assets.mjs`（新）・`mock/assets/demo/**`（新 10 件）・`tools/verify.mjs` | なし |
| **PR-1** | 世界マスタに人物 1（郭 徳明）・文書 1（WS-L3-04） | `data/world/mfg/{people,documents}.csv`・`data/world/README.md` | なし（PR-0 と並列可） |
| **PR-2** | KN-11 をカタログに採番＋`PSVC`＋基準・索引 | `mock/js/data/catalog.js`・`js/data/portal/svc.js`・`tools/regress.baseline.json`・`docs/service-map.md`・`docs/handoff/service-index.md` | PR-1 |
| **PR-3** | アップロード部品（カタログ＋ポータル）＋`T`/`PT` 4 キー＋CSS＋基準 | `js/data/ui.js`・`js/data/portal/ui.js`・`js/{app,render,events}.js`・`js/portal/{demo,events}.js`・`css/{components,portal}.css`・`tools/regress.baseline.json` | PR-2（基準が重なる） |
| **PR-4** | QA-01 の台本を手書き写真入力に差し替え | `js/data/scenarios/mfg/qa.js` | PR-0・PR-3 |
| **PR-5** | KN-11 の台本を新規投入 | `js/data/scenarios/mfg/kn.js` | PR-0・PR-2・PR-3 |
| **PR-6** | デモ進行台本 | `docs/demo/runbook-showcase-mfg.md`（新）ほか | PR-4・PR-5 |

PR-4 と PR-5 は別ファイルなので並列可。それ以外は上の順に直列。

## 6. PM 判断待ち（設計書 §17）

| # | 論点 | 推奨 |
|---|---|---|
| **Q1** | KN-11 を採番してよいか（**永久欠番**。`SVCS` 82→83） | **はい**（5 軸判定 最大 2/5） |
| **Q6** | **音声ダミーの作り方。** この環境に TTS が無い（`espeak`・`ffmpeg`・`sox` 不在。PyPI は到達可） | **② オフライン合成（声を入れない）＋文字起こし `.txt` を併置。** ① オンライン TTS を使うなら「架空の台本テキストを外部サービスへ送ってよい」という明示承認が要る。③ PM の録音は採らない |
| Q2 | `industries` を `['mfg']` に留めてよいか | はい |
| Q3 | 見せ方の筋は「製造 1 本」でよいか | はい |
| Q4 | デモ台本を新規ファイルにしてよいか（`runbook-mfg.md` は実機用） | はい |
| Q5 | `st: 3`（構想）でよいか | はい |
| Q7 | `mock/assets/` を新設してよいか | はい（`CLAUDE.md` の変更は不要） |
| Q8 | verify の新節を §20 にしてよいか | はい |

**Q1 と Q6 が決まるまで PR-0 の音声部分と PR-2 以降は着手しない。**
