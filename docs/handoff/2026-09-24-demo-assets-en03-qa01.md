# EN-03 引合図面（朱書きあり）の資産 2 点と、QA-01 塗装条件記録の訂正欄 —— 設計書

- 日付：2026-09-24
- 起点：PM 決定（2026-09-24、Cowork メモの提案 5 を OK）
  - `docs/handoff/cowork/2026-09-23-dc03-en03-input-entry.md` §3-1・§5-2（EN-03 の資産 2 点）
  - `docs/handoff/cowork/2026-09-23-qa01-handwritten-input.md` §4（塗装条件記録 9/5 を「訂正欄が空いている様式」で再生成）
- 前提の設計書：`docs/handoff/2026-09-16-showcase-demo.md` §9（資産の制約）・§19-7〜19-9（読み替え）
- レーン：**M**（`mock/assets/demo/**`・`mock/js/data/scenarios/**`・`tools/gen-demo-assets.mjs` に触る）／ラベル `run:cloud`
- 検証：architect が作業用コピーで実際に生成し、目視・verify・`--check` を済ませた（§8）。**§3・§4 のコードはそのまま貼れば同じバイトが出る**（Chromium 141.0.7390.37 の場合）

---

## §0. 結論

1. **EN-03**：`en3-rfq-2025-118.pdf`（A4 横 1 ページ、朱書き 2 か所）と `en3-rfq-2025-118-photo.jpg`（それを印刷して机の上で撮った風）を `tools/gen-demo-assets.mjs` で作る
2. **台本から参照するのは PDF だけ**。`en3.input.{ja,zh}.files` は 1 件のまま変えず、`assets` に PDF を 1 件足す。写真は置くだけで台本からは参照しない（README に「無くてもよい」と書く）（§5）
3. **QA-01**：`qa1-paint-cond-0905.jpg` の右側に「訂正印／訂正日」の 2 列（空欄）を刷る。**乱数を消費しない関数で足す**ので、手書きの値・取り消し線・紙の汚れ・撮影の傾きはすべて前と同じ位置のまま。画素差分で確かめ済み（§4-3）。外観検査記録 2 枚と KN-11 の PDF 2 点は**バイト不変**
4. **`tools/verify.mjs` は変えない**。§20 にファイル名の許可集合は無く、拡張子とサイズだけを見る。`en3-*` はそのまま通る（§6）。したがって PR-0 は不要
5. PR は 2 本を**直列**で出す：PR-1 生成コード＋資産 3 点＋README、PR-2 `en.js` の `assets`（§10）

---

## §1. 目的

- EN-03（図面の類似検索・手書きメモの読み取り）の「サンプルを使う」で、**朱書きの入った本物の図面 PDF** を開けるようにする。台本の「朱書き 2 か所のうち 1 か所は読めた／1 か所は判読不能で空欄のまま確認事項へ」を、顧客が画面で確かめられるようにする
- QA-01 の塗装条件記録で「線の重なった 3.8・12 の横に、**訂正印・訂正日の欄があるのに空いている**」ことを見せる。台本の「訂正者・日付の記入もありません」と、D5 の「訂正は二重線と訂正者・日付で行う」が絵と噛み合うようにする

## §2. 変更する範囲／触らない範囲

### 2-1. 変更する範囲（ファイル単位）

| PR | ファイル | 変更 |
|---|---|---|
| PR-1 | `tools/gen-demo-assets.mjs` | §3・§4 の差分（関数の追加、`renderPhoto` に省略可能な引数、`generateAll` の末尾に 2 ブロック） |
| PR-1 | `mock/assets/demo/en3-rfq-2025-118.pdf` | **新規**（生成物） |
| PR-1 | `mock/assets/demo/en3-rfq-2025-118-photo.jpg` | **新規**（生成物） |
| PR-1 | `mock/assets/demo/qa1-paint-cond-0905.jpg` | **再生成**（訂正欄を追加） |
| PR-1 | `mock/assets/demo/README.md` | §7 の追記 |
| PR-2 | `mock/js/data/scenarios/mfg/en.js` | `en3.input` に `assets` を追加（§5） |

### 2-2. 触らない範囲（明示）

- **生成物のうち再生成しないもの（バイト不変）**：`qa1-inspection-0905.jpg`・`qa1-inspection-0906.jpg`・`kn11-ws-l3-04-revC.pdf`・`kn11-ws-l3-04-revA.pdf`・`kn11-interview-{ja,zh}.{wav,txt}`
- `mock/js/data/scenarios/mfg/qa.js`（QA-01 の台本は 1 文字も変えない。§4-4 で整合を確認済み）
- `mock/js/data/scenarios/mfg/en.js` の `en3` のうち `input` 以外（`steps`・`result`・`script`・`persona`）。`files` のファイル名も変えない
- `mock/js/render.js`・`app.js`・`events.js`・`mock/js/portal/**`・`mock/css/**`（「サンプルを使う」の描画は既存のまま動く。§8-5）
- `mock/js/data/catalog.js`（EN-03 の `desc`。Cowork メモ §5-4 は別件）・`ui.js`（`T` を増やさない）
- `tools/verify.mjs`・`tools/regress.mjs`・`tools/gen-demo-audio.py`・`package.json`
- `data/world/**`（新しい名前・数字を作らないので、マスタに足すものは無い）
- `docs/demo/**`（`runbook-showcase-mfg.md` の幕に EN-03 は入っていない。`grep -n "EN-03\|en3" docs/demo/*.md` は 0 件。§5 の逃げ道にも触れない）・`docs/dify/usecases/EN-03.md`・`docs/handoff/2026-09-16-showcase-demo.md`（§9-2 の「9 件」は本書で読み替える。§9 に後述）
- `portal/**`、`CLAUDE.md`、`.claude/**`、`.github/**`

---

## §3. EN-03 の図面（PDF と写真）

### 3-1. 何を描くか（描画仕様）

座標は A4 横を 96dpi の px にしたもの（1123 × 794。1mm ≒ 3.78px）。図形は 1mm = 2.4px で描く（**尺度は表題欄に書かない**＝新しい値を作らない）。**印刷された線と文字は揺らさず、揺らすのは朱書きだけ**。

```
 ┌─1────────2────────3────────4────────5────────6─┐  ← 外枠（x=20）と区域の目盛り
 │┌──────────────────────────────────────────────┐│  ← 図枠（内枠 x=38、太線）
A││                                   M6 タップ ×2 追加  ← 朱書き①（読める。手書き・朱）
 ││   ┌╮                                  ╲         ││
 ││ 80│ │                          ┌──────╲─┐      ││
B││   │ │                          │ (◯)  (◯)│ ← 印刷の穴 2 つ（丸＋中心線のみ）を朱で囲む
 ││   │ │  曲げ R3（2 か所）      t1.5    │        │      ││
 ││   ╰───────────────────────   └────────┘      ││
C││   |<──────── 195 ────────>|                    〰〰〰〰┼〰 ← 朱書き②（読めない走り書き。
 ││        正面図 FRONT VIEW       側面図 SIDE VIEW   〰〰〰 │     図枠の右の線と外枠をまたぐ）
D││                                 ┌──────┬─────────────┐│
 ││                                 │図番  │RFQ-2025-118 ││
 ││                                 │顧客  │K 社          ││
 ││                                 │品名  │L 型ブラケット││
 ││                                 │材質 SPCC t1.5│表面処理 塗装│
 ││                                 │作成  │検図  │承認   ││  ← 枠と欄名だけ（空欄）
 │└──────────────────────────────────────────────┘│
 └─1────────2────────3────────4────────5────────6─┘
  デモ用のダミー図面（架空の会社・架空の引合）。docs/handoff/2026-09-24-demo-assets-en03-qa01.md   ← 灰色 8px
```

| 要素 | 仕様 | 値の出どころ |
|---|---|---|
| 図枠 | 外枠（細線・余白 20px）、内枠（1.8px・余白 38px）。上下に区域 1〜6、左右に A〜D | 形式のみ（値ではない） |
| 表題欄 | 右下 380×140px、5 行。図番 `RFQ-2025-118`／顧客 `K 社`／品名 `L 型ブラケット`／材質 `SPCC t1.5`・表面処理 `塗装`／作成・検図・承認（**枠と欄名だけ。名前・日付は描かない**）。欄名は和文＋小さく英文 | `records.csv`（RFQ-2025-118）、`partners.csv`（K 社）、既存 `en3` 台本 `result.title` |
| 正面図 | L 型の断面形状：底辺 195・立ち上がり 80・板厚 t1.5（二重線）・左下と左上の 2 か所の曲げ（R3）・立ち上がり上端の短い返し（**長さの寸法は入れない**）。寸法線 `195`（下）・`80`（左）、注記「曲げ R3（2 か所）」「t1.5」（引出線つき） | 既存 `en3` 台本（外形 L 型 195×80、曲げ R3 ×2、t1.5）、`products.csv` SK-3310-A の note |
| 側面図 | 立ち上がり面（矩形）と曲げ位置の細線 2 本、**穴 2 つ（丸と中心線だけ。穴径・ピッチ・タップ指示は印刷しない）** | 形状のみ。**側面図の幅・穴位置・穴径は寸法を入れない**（新しい数値を作らない） |
| 朱書き①（読める） | 穴 2 つを朱の手描きの丸で囲み、引出線（矢印つき）の先に手書き「**M6 タップ ×2 追加**」（`handwritten()`、22px、朱 `#c8322b`）。区域 **5-A〜5-B** | 既存 `en3` 台本 `script[0]` |
| 朱書き②（読めない） | 右下の余白（表題欄の上、区域 **6-C**）に、**文字ではない**続け書きの走り書き 2 行（上へ戻るループ・山・谷をつないだ線、右上がりの癖、語の切れ目つき）と、上から重ねた 2 本の書き足し。図枠の右の線と外枠をまたがせる。**中身を決めない**（特定の字形を使わない＝推測の余地を残さない） | 既存 `en3` 台本 `script[0]`「2 か所目（1 ページ右下の余白）は判読できず」 |
| 架空の注記 | 図枠の外、左下に灰色 8px で「デモ用のダミー図面（架空の会社・架空の引合）。docs/handoff/…」 | KN-11 の PDF と同じ作法 |

**描かないもの（意図的）**：尺度・日付・作成者名・曲げ角度（台本の `85°` は相違点の説明にしか出てこないので図には書かない）・当社品番（`records.csv` は RFQ-2025-118 を `SK-3310-C` に紐づけているが、**顧客図面に当社品番は載らない**。`en3` 台本も SK-3310-C に触れない）・実在企業名・実在図番・実在製品名。

**朱書き①を印刷の穴の「追加指示」にした理由**：Cowork メモ §3-1 は「M6 タップ ×2」を 2 面図の中身に並べているが、台本 `script[0]` は「1 か所目『M6 タップ ×2 追加』は読み取れたので**条件に入れています**」と言う。タップ指示が印刷済みなら、朱書きを読めたかどうかは条件に影響しない。そこで **穴は印刷済み・タップ指示は朱書きだけ**にした（メモの「穴の近くに」とも合う）。結果表の「M6 タップ ×2」は、朱書きを読んだ結果として説明がつく。

### 3-2. 写真版

- PDF と**同じシード（230118）から同じ図面を組む**ので、朱書きの形は 2 点で同じになる
- 図面の上に、印刷のかすれ（白い帯 3〜4 本、`tonerFade`）→ 紙のノイズ（`paperNoise`、700 個）→ 折り目・指跡（`paperDefects`）を重ね、既存の `renderPhoto()` で撮影風にする（傾き・台形歪み・照明ムラ・反射・ボケ・四隅の影・暗色の作業台）
- **傾き（Z 回転）は 1〜2°** に収める（Cowork メモの指定）。`renderPhoto` に省略可能な引数 `opts.rotZ = [最小, 最大]` を足す。**乱数の消費回数と順番は引数の有無で変えない**ので、既存 3 枚の出力は変わらない（§8-2 で外観検査記録 2 枚のバイト一致を確認済み）
- JPEG 品質は **80**（既存 3 枚は 82）。画素数が大きい（2766×2108）ため、300KB 上限に余裕を持たせる

### 3-3. 生成順（既存のバイトを動かさないため）

EN-03 の 2 点は **`generateAll()` の最後（KN-11 の PDF 2 点の後）** に作る。既存 5 点の生成順とビューポートの履歴を変えないため。PDF → 写真の順（写真でビューポートを変えるので、PDF を先に）。

### 3-4. `tools/gen-demo-assets.mjs` の差分（全文。implementer はこのまま当てる）

`git apply` で当たることを確認済み（元ファイルは `main` の `80491a1` 時点）。§4 の訂正欄の差分も含む。

```diff
--- a/tools/gen-demo-assets.mjs
+++ b/tools/gen-demo-assets.mjs
@@ -3,6 +3,7 @@
  * tools/gen-demo-assets.mjs — mock/assets/demo/** の画像・PDF のダミー資産を生成する
  *
  * 設計書: docs/handoff/2026-09-16-showcase-demo.md §9（PR-0）
+ *         docs/handoff/2026-09-24-demo-assets-en03-qa01.md（EN-03 引合図面 2 点・QA-01 塗装条件記録の訂正欄）
  *
  * 音声（kn11-interview-{ja,zh}.wav/.txt）はこのツールでは作らない。PM 決定
  * （2026-09-16、Issue #311）により、この環境で動くオフライン TTS を使って
@@ -305,6 +306,9 @@
   body += `<text x="${labelX}" y="${y + 22}" font-family="WenQuanYi Zen Hei, sans-serif" font-size="14" fill="#666">填写人</text>`;
   { const { svg } = handwritten(rng, '王磊', valX, y + 8, { fontSize: 26 }); body += svg; }
 
+  // 訂正印・訂正日の欄（様式に刷られた欄。空欄のまま）。rng を消費しない
+  body += correctionColumns(W, top);
+
   const noise = paperNoise(rng, W, H, 900);
   const defects = paperDefects(rng, W, H);
   return paperGroup(W, H, `
@@ -317,6 +321,36 @@
   `);
 }
 
+// 塗装条件記録の右側に刷られた「訂正印／訂正日」の 2 列（設計書 2026-09-24-demo-assets-en03-qa01.md §4）。
+// 見出しは日付の行の右側、欄は脱脂液濃度〜乾燥炉の 4 行ぶん。記入者の行には付けない。
+// **rng を消費しない**（引数に rng を取らない）。したがって手書きの値・取り消し線・紙の汚れ・
+// 撮影の傾きは、この欄を足す前とまったく同じ位置に出る。中身は描かない（空欄）。
+function correctionColumns(W, top) {
+  const x0 = 500, x1 = 590, x2 = W - 30;
+  const headTop = top - 34;                 // 176：見出し枠の上端
+  const lineY = [0, 1, 2, 3, 4].map(i => top + i * 96 + 20); // 230, 326, 422, 518, 614（既存の行の罫線）
+  const bottom = lineY[4];
+  const parts = [];
+  parts.push(`<line x1="${x0}" y1="${headTop}" x2="${x2}" y2="${headTop}" stroke="#b9ad8f" stroke-width="1"/>`);
+  for (const x of [x0, x1, x2]) {
+    parts.push(`<line x1="${x}" y1="${headTop}" x2="${x}" y2="${bottom}" stroke="#b9ad8f" stroke-width="1"/>`);
+  }
+  const heads = [
+    { cx: (x0 + x1) / 2, ja: '訂正印', zh: '更正章' },
+    { cx: (x1 + x2) / 2, ja: '訂正日', zh: '更正日期' },
+  ];
+  for (const h of heads) {
+    parts.push(`<text x="${h.cx}" y="${headTop + 22}" text-anchor="middle" font-family="IPAGothic, sans-serif" font-size="14" fill="#333">${h.ja}</text>`);
+    parts.push(`<text x="${h.cx}" y="${headTop + 42}" text-anchor="middle" font-family="WenQuanYi Zen Hei, sans-serif" font-size="12" fill="#666">${h.zh}</text>`);
+  }
+  // 訂正印の欄には、押印位置の目安として薄い丸枠だけを刷る（印影は描かない）
+  for (let i = 0; i < 4; i++) {
+    const cy = (lineY[i] + lineY[i + 1]) / 2;
+    parts.push(`<circle cx="${(x0 + x1) / 2}" cy="${cy}" r="22" fill="none" stroke="#cfc4a6" stroke-width="1" stroke-dasharray="3 3"/>`);
+  }
+  return parts.join('');
+}
+
 // 用紙そのもの（罫線・印字・手書き）を返す。傾き・撮影感は renderPhoto() 側で
 // 1 枚の SVG にまとめて描く（要素スクリーンショット＋ CSS 3D transform は
 // Chromium のバウンディングボックス計算が不安定になるため使わない）。
@@ -332,11 +366,16 @@
 // 要素スクリーンショット（el.screenshot）は使わない。CSS 3D transform を掛けた要素の
 // バウンディングボックス計算が Chromium で不安定になるため、ページ全体を
 // page.screenshot() でそのまま撮る（clip 計算に頼らないので再現性が安定する）。
-function renderPhoto(paperSvgInner, w, h, rng) {
+// opts.rotZ = [最小, 最大]（度。省略時は従来どおり ±2.4°）。rng の消費回数・順番は opts の
+// 有無で変えない（既存 3 枚のバイトを動かさない。設計書 2026-09-24-demo-assets-en03-qa01.md §3-4）。
+function renderPhoto(paperSvgInner, w, h, rng, opts = {}) {
   const pad = 130;
   const outerW = w + pad * 2, outerH = h + pad * 2;
   // 傾き・台形歪み（スマホで斜めから撮った見た目）。ファイルごとに rng で変える
-  const rotZ = (rng() * 2 - 1) * 2.4;
+  const rotZRaw = (rng() * 2 - 1) * 2.4;
+  const rotZ = opts.rotZ
+    ? (rotZRaw < 0 ? -1 : 1) * (opts.rotZ[0] + (Math.abs(rotZRaw) / 2.4) * (opts.rotZ[1] - opts.rotZ[0]))
+    : rotZRaw;
   const rotX = 3 + rng() * 5.5;
   const rotY = (rng() * 2 - 1) * 4.5;
   const persp = 1050 + rng() * 350;
@@ -418,6 +457,250 @@
   </body></html>`;
 }
 
+/* ---------- EN-03: 引合図面 RFQ-2025-118（K 社の朱書きあり。A4 横 1 ページ） ---------- */
+// 設計書: docs/handoff/2026-09-24-demo-assets-en03-qa01.md §3
+// 座標は A4 横を 96dpi の px にしたもの（297mm × 210mm ≒ 1123 × 794。1mm ≒ 3.78px）。
+// 図形の縮尺は 1mm = 2.4px（印刷上の尺度は表題欄に書かない＝新しい値を作らない）。
+// 印刷された線・文字は揺らさない。揺らすのは朱書き（K 社の手書き）だけ。
+const RFQ_W = 1123, RFQ_H = 794;
+const RFQ_PX_PER_MM = 2.4;
+const RFQ_RED = '#c8322b';         // 朱色のペン（図面の印刷は黒、朱書きだけこの色）
+const RFQ_PHOTO_QUALITY = 80;      // 写真版の JPEG 品質（300KB 上限に収めるため既存 3 枚の 82 より下げる）
+const RFQ_FONT = 'IPAGothic, sans-serif';
+
+// 図枠（外枠・内枠）と区域（上下に 1〜6、左右に A〜D）
+function rfqFrame() {
+  const o = 20, i = 38;
+  const iw = RFQ_W - i * 2, ih = RFQ_H - i * 2;
+  const parts = [];
+  parts.push(`<rect x="${o}" y="${o}" width="${RFQ_W - o * 2}" height="${RFQ_H - o * 2}" fill="none" stroke="#222" stroke-width="0.8"/>`);
+  parts.push(`<rect x="${i}" y="${i}" width="${iw}" height="${ih}" fill="none" stroke="#111" stroke-width="1.8"/>`);
+  for (let c = 0; c < 6; c++) {
+    const x0 = i + (iw * c) / 6, xm = x0 + iw / 12;
+    if (c > 0) {
+      parts.push(`<line x1="${x0.toFixed(1)}" y1="${o}" x2="${x0.toFixed(1)}" y2="${i}" stroke="#222" stroke-width="0.8"/>`);
+      parts.push(`<line x1="${x0.toFixed(1)}" y1="${RFQ_H - i}" x2="${x0.toFixed(1)}" y2="${RFQ_H - o}" stroke="#222" stroke-width="0.8"/>`);
+    }
+    for (const y of [o + 13, RFQ_H - o - 5]) {
+      parts.push(`<text x="${xm.toFixed(1)}" y="${y}" text-anchor="middle" font-family="${RFQ_FONT}" font-size="11" fill="#222">${c + 1}</text>`);
+    }
+  }
+  for (let r = 0; r < 4; r++) {
+    const y0 = i + (ih * r) / 4, ym = y0 + ih / 8 + 4;
+    if (r > 0) {
+      parts.push(`<line x1="${o}" y1="${y0.toFixed(1)}" x2="${i}" y2="${y0.toFixed(1)}" stroke="#222" stroke-width="0.8"/>`);
+      parts.push(`<line x1="${RFQ_W - i}" y1="${y0.toFixed(1)}" x2="${RFQ_W - o}" y2="${y0.toFixed(1)}" stroke="#222" stroke-width="0.8"/>`);
+    }
+    for (const x of [o + 9, RFQ_W - o - 9]) {
+      parts.push(`<text x="${x}" y="${ym.toFixed(1)}" text-anchor="middle" font-family="${RFQ_FONT}" font-size="11" fill="#222">${'ABCD'[r]}</text>`);
+    }
+  }
+  return parts.join('');
+}
+
+// 表題欄（右下）。値は既存台本・data/world/mfg の値だけ。作成・検図・承認は枠だけ（空欄）
+function rfqTitleBlock() {
+  const x = 705, y = 616, w = 380, rowH = 28, labW = 110;
+  const parts = [];
+  const cell = (cx, cy, cw, ch) => parts.push(`<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" fill="#fff" stroke="#111" stroke-width="1"/>`);
+  const label = (tx, ty, ja, en) => {
+    parts.push(`<text x="${tx}" y="${ty}" font-family="${RFQ_FONT}" font-size="11" fill="#222">${escXml(ja)}</text>`);
+    parts.push(`<text x="${tx}" y="${ty + 10}" font-family="${RFQ_FONT}" font-size="7" fill="#555">${escXml(en)}</text>`);
+  };
+  const value = (tx, ty, v, size) => parts.push(`<text x="${tx}" y="${ty}" font-family="${RFQ_FONT}" font-size="${size}" fill="#111">${escXml(v)}</text>`);
+  const rows = [
+    { ja: '図番', en: 'DWG. NO.', v: 'RFQ-2025-118', size: 17 },
+    { ja: '顧客', en: 'CUSTOMER', v: 'K 社', size: 14 },
+    { ja: '品名', en: 'TITLE', v: 'L 型ブラケット', size: 14 },
+  ];
+  rows.forEach((r, k) => {
+    const ry = y + rowH * k;
+    cell(x, ry, labW, rowH); cell(x + labW, ry, w - labW, rowH);
+    label(x + 6, ry + 13, r.ja, r.en);
+    value(x + labW + 10, ry + 20, r.v, r.size);
+  });
+  // 4 行目：材質／表面処理
+  { const ry = y + rowH * 3, half = w / 2, lw = 70;
+    cell(x, ry, lw, rowH); cell(x + lw, ry, half - lw, rowH);
+    cell(x + half, ry, lw, rowH); cell(x + half + lw, ry, half - lw, rowH);
+    label(x + 6, ry + 13, '材質', 'MATERIAL'); value(x + lw + 8, ry + 19, 'SPCC t1.5', 13);
+    label(x + half + 6, ry + 13, '表面処理', 'FINISH'); value(x + half + lw + 8, ry + 19, '塗装', 13); }
+  // 5 行目：作成／検図／承認（枠と欄名だけ。名前・日付は描かない）
+  { const ry = y + rowH * 4, cw = w / 3;
+    ['作成', '検図', '承認'].forEach((t, k) => {
+      cell(x + cw * k, ry, cw, rowH);
+      parts.push(`<text x="${(x + cw * k + 5).toFixed(1)}" y="${ry + 11}" font-family="${RFQ_FONT}" font-size="9" fill="#555">${t}</text>`);
+    }); }
+  return parts.join('');
+}
+
+// 寸法線（水平・垂直）。矢印は小さな三角
+function rfqDimH(x1, x2, yBase, yDim, text) {
+  const a = 7;
+  return `<line x1="${x1}" y1="${yBase + 4}" x2="${x1}" y2="${yDim + 6}" stroke="#222" stroke-width="0.7"/>` +
+    `<line x1="${x2}" y1="${yBase + 4}" x2="${x2}" y2="${yDim + 6}" stroke="#222" stroke-width="0.7"/>` +
+    `<line x1="${x1}" y1="${yDim}" x2="${x2}" y2="${yDim}" stroke="#222" stroke-width="0.7"/>` +
+    `<path d="M ${x1} ${yDim} l ${a} -2.5 l 0 5 z M ${x2} ${yDim} l ${-a} -2.5 l 0 5 z" fill="#222"/>` +
+    `<text x="${(x1 + x2) / 2}" y="${yDim - 5}" text-anchor="middle" font-family="${RFQ_FONT}" font-size="14" fill="#111">${text}</text>`;
+}
+function rfqDimV(y1, y2, xBase, xDim, text) {
+  const a = 7, ym = (y1 + y2) / 2;
+  return `<line x1="${xBase - 4}" y1="${y1}" x2="${xDim - 6}" y2="${y1}" stroke="#222" stroke-width="0.7"/>` +
+    `<line x1="${xBase - 4}" y1="${y2}" x2="${xDim - 6}" y2="${y2}" stroke="#222" stroke-width="0.7"/>` +
+    `<line x1="${xDim}" y1="${y1}" x2="${xDim}" y2="${y2}" stroke="#222" stroke-width="0.7"/>` +
+    `<path d="M ${xDim} ${y1} l -2.5 ${a} l 5 0 z M ${xDim} ${y2} l -2.5 ${-a} l 5 0 z" fill="#222"/>` +
+    `<text x="${xDim - 6}" y="${ym}" text-anchor="middle" font-family="${RFQ_FONT}" font-size="14" fill="#111" transform="rotate(-90 ${xDim - 6} ${ym})">${text}</text>`;
+}
+
+// 正面図（L 型の断面形状：底辺 195・立ち上がり 80・曲げ R3 ×2・板厚 t1.5）と側面図（立ち上がり面と穴 2 つ）。
+// 立ち上がり上端の返しの長さ・側面図の幅・穴位置は寸法を入れない（新しい数値を作らない）。
+function rfqViews() {
+  const k = RFQ_PX_PER_MM;
+  const L = 195 * k, H = 80 * k, t = Math.max(3, 1.5 * k), r = 3 * k, lip = 10 * k;
+  const x0 = 150, yb = 420;                 // 正面図の左下（外側の角）
+  const xr = x0 + L, yt = yb - H;
+  const parts = [];
+  // 外側の輪郭（左下の曲げ・左上の曲げ）と内側の輪郭（板厚ぶん内側）
+  const outer = `M ${xr} ${yb} L ${x0 + r} ${yb} Q ${x0} ${yb} ${x0} ${yb - r} L ${x0} ${yt + r} Q ${x0} ${yt} ${x0 + r} ${yt} L ${x0 + lip} ${yt}`;
+  const inner = `M ${xr} ${yb - t} L ${x0 + t + r} ${yb - t} Q ${x0 + t} ${yb - t} ${x0 + t} ${yb - t - r} L ${x0 + t} ${yt + t + r} Q ${x0 + t} ${yt + t} ${x0 + t + r} ${yt + t} L ${x0 + lip} ${yt + t}`;
+  parts.push(`<path d="${outer}" fill="none" stroke="#111" stroke-width="1.6"/>`);
+  parts.push(`<path d="${inner}" fill="none" stroke="#111" stroke-width="1.6"/>`);
+  parts.push(`<line x1="${xr}" y1="${yb}" x2="${xr}" y2="${yb - t}" stroke="#111" stroke-width="1.6"/>`);
+  parts.push(`<line x1="${x0 + lip}" y1="${yt}" x2="${x0 + lip}" y2="${yt + t}" stroke="#111" stroke-width="1.6"/>`);
+  // 寸法：195（下）・80（左）
+  parts.push(rfqDimH(x0, xr, yb, yb + 46, '195'));
+  parts.push(rfqDimV(yt, yb, x0, x0 - 46, '80'));
+  // 注記：曲げ R3（2 か所）・板厚 t1.5（引出線つき）
+  parts.push(`<line x1="${x0 + t + r * 0.6}" y1="${yb - t - r * 0.6}" x2="${x0 + 70}" y2="${yb - 60}" stroke="#222" stroke-width="0.7"/>`);
+  parts.push(`<text x="${x0 + 74}" y="${yb - 62}" font-family="${RFQ_FONT}" font-size="14" fill="#111">曲げ R3（2 か所）</text>`);
+  parts.push(`<line x1="${x0 + L * 0.7}" y1="${yb - t / 2}" x2="${x0 + L * 0.7 + 30}" y2="${yb - 40}" stroke="#222" stroke-width="0.7"/>`);
+  parts.push(`<text x="${x0 + L * 0.7 + 34}" y="${yb - 42}" font-family="${RFQ_FONT}" font-size="14" fill="#111">t1.5</text>`);
+  parts.push(`<text x="${x0 + L / 2}" y="${yb + 84}" text-anchor="middle" font-family="${RFQ_FONT}" font-size="14" fill="#111">正面図　FRONT VIEW</text>`);
+
+  // 側面図（右側面から見た立ち上がり面。三角法の配置で正面図の右）
+  const sx = 740, sw = 60 * k;
+  parts.push(`<rect x="${sx}" y="${yt}" width="${sw}" height="${H}" fill="none" stroke="#111" stroke-width="1.6"/>`);
+  parts.push(`<line x1="${sx}" y1="${yt + t + r}" x2="${sx + sw}" y2="${yt + t + r}" stroke="#111" stroke-width="0.7"/>`);
+  parts.push(`<line x1="${sx}" y1="${yb - t - r}" x2="${sx + sw}" y2="${yb - t - r}" stroke="#111" stroke-width="0.7"/>`);
+  // 穴 2 つ（印刷は丸と中心線だけ。穴径・ピッチの寸法は入れない＝タップ指示は朱書き①で追加される）
+  const hy = yt + H * 0.5, hr = 3 * k;
+  const holes = [sx + sw * 0.28, sx + sw * 0.72];
+  for (const hx of holes) {
+    parts.push(`<circle cx="${hx}" cy="${hy}" r="${hr}" fill="none" stroke="#111" stroke-width="1.2"/>`);
+    parts.push(`<line x1="${hx - hr - 7}" y1="${hy}" x2="${hx + hr + 7}" y2="${hy}" stroke="#222" stroke-width="0.6" stroke-dasharray="8 2 2 2"/>`);
+    parts.push(`<line x1="${hx}" y1="${hy - hr - 7}" x2="${hx}" y2="${hy + hr + 7}" stroke="#222" stroke-width="0.6" stroke-dasharray="8 2 2 2"/>`);
+  }
+  parts.push(`<text x="${sx + sw / 2}" y="${yb + 84}" text-anchor="middle" font-family="${RFQ_FONT}" font-size="14" fill="#111">側面図　SIDE VIEW</text>`);
+  return { svg: parts.join(''), holes, hy, hr };
+}
+
+// 朱書きの丸（手で描いた、少し行き過ぎて閉じる丸）
+function penCircle(rng, cx, cy, r, color) {
+  const n = 16, start = rng() * Math.PI * 2, pts = [];
+  for (let j = 0; j <= n + 2; j++) {
+    const a = start + (j / n) * Math.PI * 2;
+    const rr = r * (1 + (rng() * 2 - 1) * 0.07) * (1 + j * 0.006);
+    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9]);
+  }
+  let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
+  for (let j = 1; j < pts.length - 1; j++) {
+    const mx = (pts[j][0] + pts[j + 1][0]) / 2, my = (pts[j][1] + pts[j + 1][1]) / 2;
+    d += ` Q ${pts[j][0].toFixed(1)} ${pts[j][1].toFixed(1)}, ${mx.toFixed(1)} ${my.toFixed(1)}`;
+  }
+  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${(1.5 + rng() * 0.5).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round"/>`;
+}
+
+// 判読できない走り書き（朱書き②）。**文字にしない**：筆記体の続け字に似せた単位（上へ戻るループ・山・谷）を
+// つないだ線を 2 行ぶん描き、ところどころ語の切れ目を空け、上から 2 本の書き足しを重ねる。
+// 図枠の右の線と外枠をまたがせる。中身を決めない（推測の余地を残さない）。
+function illegibleScribble(rng, x, y, w, h, color) {
+  const parts = [];
+  for (let line = 0; line < 2; line++) {
+    const baseY = y + h * (0.42 + line * 0.46);
+    const endX = x + w * (line === 0 ? 1 : 0.6);
+    let px = x + (line === 0 ? 0 : w * 0.05);
+    let d = `M ${px.toFixed(1)} ${baseY.toFixed(1)}`;
+    while (px < endX) {
+      const s = 9 + rng() * 7;                      // 1 単位の幅
+      const A = 8 + rng() * 7;                      // 高さ
+      const bY = baseY + (rng() * 2 - 1) * 2.5 - (px - x) * 0.04; // 右上がりの癖
+      const kind = rng();
+      if (kind < 0.42) {
+        const hh = (rng() < 0.3 ? 1.9 : 1) * A;     // ときどき背の高いループ
+        d += ` C ${(px + s * 0.9).toFixed(1)} ${(bY - hh * 0.2).toFixed(1)}, ${(px + s * 0.9).toFixed(1)} ${(bY - hh).toFixed(1)}, ${(px + s * 0.45).toFixed(1)} ${(bY - hh).toFixed(1)}`;
+        d += ` C ${px.toFixed(1)} ${(bY - hh).toFixed(1)}, ${(px + s * 0.2).toFixed(1)} ${bY.toFixed(1)}, ${(px + s).toFixed(1)} ${bY.toFixed(1)}`;
+      } else if (kind < 0.8) {
+        d += ` Q ${(px + s / 2).toFixed(1)} ${(bY - A * 1.1).toFixed(1)}, ${(px + s).toFixed(1)} ${bY.toFixed(1)}`;
+      } else {
+        d += ` Q ${(px + s / 2).toFixed(1)} ${(bY + A * 0.6).toFixed(1)}, ${(px + s).toFixed(1)} ${bY.toFixed(1)}`;
+      }
+      px += s;
+      if (rng() < 0.12 && px < endX - 20) {         // 語の切れ目
+        px += 7 + rng() * 5;
+        d += ` M ${px.toFixed(1)} ${(baseY - (px - x) * 0.04).toFixed(1)}`;
+      }
+    }
+    parts.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${(1.6 + rng() * 0.5).toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>`);
+  }
+  for (let j = 0; j < 2; j++) {
+    const x1 = x + rng() * w * 0.3, x2 = x + w * (0.6 + rng() * 0.4);
+    const y1 = y + h * (0.2 + rng() * 0.6), y2 = y + h * (0.2 + rng() * 0.6);
+    parts.push(`<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${((x1 + x2) / 2).toFixed(1)} ${(y + rng() * h).toFixed(1)}, ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${color}" stroke-width="1.4" opacity="0.85" stroke-linecap="round"/>`);
+  }
+  return parts.join('');
+}
+
+// 図面 1 枚ぶんの SVG の中身（白い用紙・図枠・2 面図・表題欄・朱書き 2 か所・架空の注記）。
+// rng の消費順：朱書き①の丸 2 つ → 朱書き①の文字 → 朱書き②の走り書き（PDF と写真で同じ）
+function buildRfqDrawingSvgInner(rng) {
+  const views = rfqViews();
+  const red = [];
+  // 朱書き①：穴 2 つを丸で囲み、引出線の先に「M6 タップ ×2 追加」（読める）
+  for (const hx of views.holes) red.push(penCircle(rng, hx, views.hy, views.hr + 11, RFQ_RED));
+  const tx = 770, ty = 170;
+  const note = handwritten(rng, 'M6 タップ ×2 追加', tx, ty, { fontSize: 22, color: RFQ_RED });
+  red.push(note.svg);
+  const lx = views.holes[1] + 6, ly = views.hy - views.hr - 12;
+  red.push(`<path d="M ${tx + 60} ${ty + 8} Q ${lx + 30} ${(ty + ly) / 2}, ${lx} ${ly}" fill="none" stroke="${RFQ_RED}" stroke-width="1.5" stroke-linecap="round"/>`);
+  red.push(`<path d="M ${lx} ${ly} l 2 -9 M ${lx} ${ly} l 8 -5" fill="none" stroke="${RFQ_RED}" stroke-width="1.5" stroke-linecap="round"/>`);
+  // 朱書き②：右下の余白（表題欄の上）。図枠の右の線と区域 C/D の境をまたぐ走り書き（読めない）
+  red.push(illegibleScribble(rng, 925, 520, 180, 70, RFQ_RED));
+  const footnote = `<text x="38" y="788" font-family="${RFQ_FONT}" font-size="8" fill="#888">デモ用のダミー図面（架空の会社・架空の引合）。docs/handoff/2026-09-24-demo-assets-en03-qa01.md</text>`;
+  return `<rect x="0" y="0" width="${RFQ_W}" height="${RFQ_H}" fill="#fff"/>` +
+    rfqFrame() + views.svg + rfqTitleBlock() + red.join('') + footnote;
+}
+
+// PDF 用の HTML（A4 横・余白 0 の 1 ページ）
+function buildRfqDrawingPdfHtml(rng) {
+  const inner = buildRfqDrawingSvgInner(rng);
+  return `<!doctype html><html><head><meta charset="utf-8"><style>
+    @page{size:A4 landscape;margin:0;}
+    html,body{margin:0;padding:0;background:#fff;}
+    .sheet{width:297mm;height:209.5mm;overflow:hidden;}
+    svg{display:block;width:297mm;height:209.5mm;}
+  </style></head><body><div class="sheet"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${RFQ_W} ${RFQ_H}" preserveAspectRatio="xMidYMid meet">${inner}</svg></div></body></html>`;
+}
+
+// 印刷のかすれ（トナーの薄い帯）。決定的（rng 消費）
+function tonerFade(rng, w, h) {
+  const parts = [];
+  const bands = 3 + Math.floor(rng() * 2);
+  for (let j = 0; j < bands; j++) {
+    const by = rng() * h, bh = 2 + rng() * 5;
+    parts.push(`<rect x="0" y="${by.toFixed(1)}" width="${w}" height="${bh.toFixed(1)}" fill="#ffffff" opacity="${(0.35 + rng() * 0.25).toFixed(2)}"/>`);
+  }
+  return parts.join('');
+}
+
+// 写真版の用紙（PDF と同じ図面 → かすれ → 紙のノイズ → 折り目・指跡）
+function buildRfqPhotoPaper(rng) {
+  const drawing = buildRfqDrawingSvgInner(rng);
+  const fade = tonerFade(rng, RFQ_W, RFQ_H);
+  const noise = paperNoise(rng, RFQ_W, RFQ_H, 700);
+  const defects = paperDefects(rng, RFQ_W, RFQ_H);
+  return `${drawing}${fade}${noise}${defects}<rect x="0" y="0" width="${RFQ_W}" height="${RFQ_H}" fill="none" stroke="#d8d4c8" stroke-width="3"/>`;
+}
+
 // Chromium の page.pdf() は生成時刻を /CreationDate・/ModDate に埋め込むため、そのままでは
 // 2 回連続実行してもバイトが一致しない。再現性のため固定日時に置き換える。
 // "D:YYYYMMDDHHMMSS+00'00'" は常に同じ桁数なので、桁数を変えずに置換すれば
@@ -475,6 +758,25 @@
     results.set(pdf.name, normalizePdfDates(buf));
   }
 
+  // EN-03 引合図面 2 点（設計書 2026-09-24-demo-assets-en03-qa01.md §3）。既存 5 点の**後**に作る
+  // （既存の生成順とビューポートを変えない＝既存ファイルのバイトを動かさない）。
+  // PDF と写真は同じシードから図面を組むので、朱書きの形は 2 点で同じになる。
+  {
+    const rng = mulberry32(230118);
+    await page.setContent(buildRfqDrawingPdfHtml(rng), { waitUntil: 'load' });
+    const buf = await page.pdf({ format: 'A4', landscape: true, printBackground: true });
+    results.set('en3-rfq-2025-118.pdf', normalizePdfDates(buf));
+  }
+  {
+    const rng = mulberry32(230118);
+    const paper = buildRfqPhotoPaper(rng);
+    const { html, outerW, outerH } = renderPhoto(paper, RFQ_W, RFQ_H, rng, { rotZ: [1, 2] });
+    await page.setViewportSize({ width: outerW, height: outerH });
+    await page.setContent(html, { waitUntil: 'load' });
+    const buf = await page.screenshot({ type: 'jpeg', quality: RFQ_PHOTO_QUALITY });
+    results.set('en3-rfq-2025-118-photo.jpg', buf);
+  }
+
   await browser.close();
 
   // 音声（kn11-interview-*.wav/.txt）はここでは作らない。tools/gen-demo-audio.py が担当する
```

当て方の例：上のブロックを `/tmp/gen.diff` に保存して `git apply /tmp/gen.diff`。当たらなければ（`main` が先に進んでいたら）**手で同じ内容を入れる**。関数の中身は変えない。

---

## §4. QA-01 塗装条件記録（`qa1-paint-cond-0905.jpg`）の訂正欄

### 4-1. 変更の中身

```
 塗装条件記録 / 涂装条件记录
 ─────────────────────────────────────────────
                                         ┌───────┬────────┐  ← y=176（見出し枠の上端）
 日付        2025-09-05                   │訂正印 │ 訂正日 │
                                         │更正章 │更正日期│
 ────────────────────────────────────────┼───────┼────────┤  ← y=230（既存の罫線）
 前処理脱脂液濃度(%)  3̶.̶8̶（線の重なり）  │ ( ◌ ) │        │  ← 空欄（押印の目安の点線丸だけ）
 ────────────────────────────────────────┼───────┼────────┤
 塗料撹拌時間(分)     1̶2̶（線の重なり）   │ ( ◌ ) │        │
 ────────────────────────────────────────┼───────┼────────┤
 ブース吸気フィルター交換日  7/20         │ ( ◌ ) │        │
 ────────────────────────────────────────┼───────┼────────┤
 乾燥炉(DO-3200)  基準内(むら±8℃)       │ ( ◌ ) │        │
 ────────────────────────────────────────┴───────┴────────┘  ← y=614
 記入者      王磊                     （この行には欄を付けない）
```

- 列：訂正印 x=500〜590、訂正日 x=590〜690（用紙幅 720 の右端 30px まで）。線の色は既存の行の罫線と同じ `#b9ad8f`
- 見出し：和文 14px（IPAGothic）＋中文 12px（WenQuanYi Zen Hei）。**和文「訂正印／訂正日」、中文「更正章／更正日期」**
- 欄の対象は脱脂液濃度・撹拌時間・フィルター交換日・乾燥炉の 4 行（様式として全測定行に刷る。訂正のあった 2 行だけに付けると、様式ではなく後付けに見えるため）
- 訂正印の欄には押印位置の目安として点線の丸（半径 22px、`#cfc4a6`）だけを刷る。**印影・日付・文字は何も描かない**

### 4-2. 変えないこと（決定的に保証される理由）

`correctionColumns(W, top)` は **引数に `rng` を取らない**（乱数を 1 回も消費しない）。`buildPaintConditionHtml` の中で `body` に文字列を**追記するだけ**なので、その後の `paperNoise`・`paperDefects`・`renderPhoto` が受け取る乱数の列は前と同じになる。したがって次は前の画像と同じ位置・同じ形で出る：

- 記載値（2025-09-05／3.8／12／7/20／基準内(むら±8℃)／王磊）、手書きの揺らぎ
- 3.8 と 12 に重なる線（`correctionOverlay`）＝「3.6／17 とも読める」演出
- 紙の汚れ・折り目、撮影の傾き・照明・反射
- 外観検査記録 9/6 の備考欄の判読不能（別ファイル。再生成しても**バイト一致**）

→ 設計書 `2026-09-16-showcase-demo.md` §8-4 の **31／1／2**（読み取れた 31・読み取れなかった 1・確信度が低い 2）は変わらない。訂正欄は空欄なので「読み取る項目」を増やさない（空欄の欄を項目として数えない。台本の「34 項目」も不変）。

### 4-3. 画素での確認結果（architect が実施）

元の画像と再生成後の画像をグレースケールで比べた：

| 差分の閾値 | 差のある画素の範囲 |
|---|---|
| > 40 | x 1308〜1572、y 656〜726（＝見出しの文字だけ） |
| > 12 | x 1254〜1628、y 632〜1496（＝訂正欄の範囲だけ） |
| 値の領域（x < 1150） | **差分 0** |

（画像は 1960×2320。`deviceScaleFactor: 2` と撮影風の余白・傾きを含む座標）

### 4-4. QA-01 の台本との整合（台本は変えない）

- `result` 読み取り結果「…書き損じか訂正かを画像からは判別できません。**訂正者・日付の記入もありません**」→ 欄があって空いている絵と一致する（前は「欄が無いから書かれていない」とも読めた）
- `script`［D5］「…脱脂液濃度チェックシート（**様式 QC-27**）の新設…訂正は二重線と訂正者・日付で行う欄も設ける」→ **新しく作る QC-27 の話**なので、今の塗装条件記録に欄があっても矛盾しない。ただし話の筋は「欄が無かった」から「**欄はあったのに使われていなかった**」に変わる（PM 判断 Q5）
- `steps`・`input.files`・`assets` のパスは変えない（ファイル名が同じなので）

---

## §5. `en3.input` の変更（PR-2）

### 5-1. 決定：`files` は 1 件のまま、`assets` に PDF を 1 件

verify §20-e は `assets.length === files.length` を求め、「サンプルを使う」ボタンもこの一致を条件に出る（`render.js` の `uploadPanelHTML`）。選択肢：

| 案 | 中身 | 判断 |
|---|---|---|
| **A（採用）** | `files` 1 件のまま、`assets` は PDF の 1 件。写真は置くだけで台本から参照しない | 台本 `script[0].q`「【アップロード】引合図面_K社_RFQ-2025-118_朱書きあり.pdf」・`steps[1]`「引合図面（PDF…）をアップロード」と一致したまま。台本の文言を 1 文字も変えずに済む |
| B | `files` を 2 件にし、写真も `assets` に入れる | `files` を足すと `script[0].q` と `steps` が 1 ファイル前提なので食い違う。写真と PDF は同じ図面の別の形で、同時に上げる理由が無い |

写真の使い道は司会が「CAD データでなくても、印刷を撮った写真でもよい」と口で言うときに**直接 URL で開く**こと（`https://shoulang0729.github.io/dify/assets/demo/en3-rfq-2025-118-photo.jpg`）。README に「台本からは参照しない。無くてもよい」と書く。

### 5-2. 差し替えリテラル（`mock/js/data/scenarios/mfg/en.js`、97 行目の 1 行を 4 行に）

変更前：
```js
    input: { ja: { files: ['引合図面_K社_RFQ-2025-118_朱書きあり.pdf'] }, zh: { files: ['询价图纸_K公司_RFQ-2025-118_带红笔批注.pdf'] } },
```
変更後：
```js
    input: { ja: { files: ['引合図面_K社_RFQ-2025-118_朱書きあり.pdf'],
                   assets: [{ file: 'assets/demo/en3-rfq-2025-118.pdf', kind: 'doc' }] },
             zh: { files: ['询价图纸_K公司_RFQ-2025-118_带红笔批注.pdf'],
                   assets: [{ file: 'assets/demo/en3-rfq-2025-118.pdf', kind: 'doc' }] } },
```

- ja・zh とも同じ PDF（図面は 1 枚。QA-01・KN-11 の PDF も ja/zh で同じファイルを指している）
- `en` は `input` を持たない（§2-3：`input` は ja/zh のみ）ので足さない
- データ層（`CATS`/`SVCS`/`TAGS`/`T`）は変わらない → **regress の基準更新は不要**（件数・id とも不変。§8-4）

---

## §6. `tools/verify.mjs` §20 —— 変更不要

`tools/verify.mjs` §20 を読んだ結果：

- 20-b は**拡張子**（`jpg/png/wav/pdf/txt/md`）だけを見る。**ファイル名の許可集合は無い**
- 20-c のサイズ上限は jpg ≤ 300KB・pdf ≤ 200KB
- 20-e は `assets` と `files` の長さの一致・実在・相対パス・`kind`

→ `en3-*` はそのまま通る。**`tools/**` の verify は触らない＝PR-0 は不要**。

---

## §7. `mock/assets/demo/README.md` への追記（PR-1。そのまま貼る）

### 7-1. 「ファイル一覧」の表

`qa1-paint-cond-0905.jpg` の行を次に置き換える：
```
| `qa1-paint-cond-0905.jpg` | JPEG | QA-01（脱脂液濃度・撹拌時間に訂正あり。訂正印・訂正日の欄は空欄） | 同上 |
```
`kn11-ws-l3-04-revA.pdf` の行の直後に 2 行を足す：
```
| `en3-rfq-2025-118.pdf` | PDF | EN-03（引合図面。K 社の朱書き 2 か所、うち 1 か所は判読不能） | 同上 |
| `en3-rfq-2025-118-photo.jpg` | JPEG | EN-03（上の図面を印刷して机の上で撮った風。**台本からは参照しない。無くてもよい**） | 同上 |
```

### 7-2. 「画像・PDF」節の再現性の段落

「この 5 ファイル（JPEG 3・PDF 2）は 2 回連続実行してバイト一致することを確認済みです」を次に置き換える：
```
この 7 ファイル（JPEG 4・PDF 3）は 2 回連続実行してバイト一致することを確認済みです
（2026-09-24 の EN-03 追加時は、同じ Chromium 141.0.7390.37 で**別プロセスの 2 回実行**でも 7 点がバイト一致しました）
```

### 7-3. 「値の出どころ」節の末尾に追記

```
- EN-03 の引合図面：図番 `RFQ-2025-118`（`records.csv`）、顧客 `K 社`（`partners.csv`）、
  品名「L 型ブラケット」・外形 195×80・曲げ R3（2 か所）・`SPCC t1.5`・塗装・「M6 タップ ×2 追加」：
  既存 `en3` 台本（`mock/js/data/scenarios/mfg/en.js`）。尺度・日付・作成者・穴径・穴ピッチ・
  側面図の幅・曲げ角度は**書いていません**（新しい数値を作らないため）
- QA-01 の塗装条件記録の「訂正印・訂正日」の欄：様式の欄名だけで、中身は空欄です
```

### 7-4. 「読めない項目・確信度が低い項目（QA-01 の演出）」節の直後に新しい節

```
## 朱書き（EN-03 の演出）

- **読める（1 か所）**：`en3-rfq-2025-118.pdf` の側面図の穴 2 つを朱の丸で囲み、引出線の先に
  手書きで「M6 タップ ×2 追加」（区域 5-A〜5-B）。穴は印刷済みで、タップの指示は朱書きだけにあります
- **読めない（1 か所）**：右下の余白（表題欄の上、区域 6-C）の走り書き。**文字ではなく**、続け書きに
  似せた線を図枠の線にまたがせて描いています。中身は決めていません（何と書いてあるかの正解はありません）
- 写真版（`-photo.jpg`）は同じ図面を同じ乱数から描き、印刷のかすれ・紙の汚れ・撮影の傾き（1〜2°）を
  重ねたものです。台本の「サンプルを使う」は PDF だけを使います。写真は司会が「印刷を撮った写真でも」
  と言うときに直接開く用で、**無くても台本は成立します**
```

---

## §8. 受け入れ条件

### 8-1. PR-1（生成コード＋資産＋README）

1. `node tools/verify.mjs` → ALL PASS。**§20 は 20-a〜20-h すべて ✅**（architect の実測：20-b「12 ファイル」、20-e「6 件」は PR-2 後の値。PR-1 単独では 20-b「12 ファイル」、20-e「4 件」）。warn 件数は変更前と同数（2026-09-24 時点 17）
2. `node tools/regress.mjs` → PASS（**基準更新なし**）
3. `NODE_PATH=$(npm root -g) node tools/gen-demo-assets.mjs --check` を**2 回**実行し、2 回とも 7 点 ✅（PR 本文に出力を貼る）
4. **バイト不変**：`git diff --stat main -- mock/assets/demo/` に出る `mock/assets/demo/**` のファイルが **`en3-rfq-2025-118.pdf`（新規）・`en3-rfq-2025-118-photo.jpg`（新規）・`qa1-paint-cond-0905.jpg`・`README.md` の 4 つだけ**。`qa1-inspection-0905.jpg`・`qa1-inspection-0906.jpg`・`kn11-*` は差分に出ない
5. サイズ：PDF ≤ 200KB、JPEG ≤ 300KB。architect の実測（Chromium 141.0.7390.37）：

   | ファイル | バイト | sha256（参考。Chromium が同じなら一致するはず） |
   |---|---|---|
   | `en3-rfq-2025-118.pdf` | 80,057 | `26ac584e6a20a6a507f0b8931b3e6eaef9a45d339f618e2a03c6566439f0ee64` |
   | `en3-rfq-2025-118-photo.jpg` | 225,055 | `2d692a281bcbff06af633748ecefa32d045589a2bb74740ed225fa2ae07e2cd1` |
   | `qa1-paint-cond-0905.jpg` | 186,508（前 178,328） | `598170c3fbec6491a1e76ec34d413b5a8936d51be6bff9fea822bf65be028ead` |

   sha が一致しなくても、サイズ上限内・`--check` 2 回一致・目視（下の 6〜8）が通れば可（`showcase-demo.md` §19-8）
6. **PDF の目視**：A4 横 1 ページ（`/Count 1`、MediaBox 842.88×595.92pt）。埋め込みフォントは IPAGothic だけ。図枠の区域 1〜6／A〜D、表題欄 5 行の値が §3-1 のとおり。朱書き①が読める。朱書き②が**文字として読めない**
7. **写真の目視**：暗い作業台の上の白い紙。傾きが 1〜2°、影・かすれ・折り目がある。朱書きの形が PDF と同じ
8. **塗装条件記録の目視**：訂正印・訂正日の 2 列が空欄。3.8／12 の線の重なり・7/20・基準内(むら±8℃)・王磊が前と同じ位置。乾燥炉の値の末尾「)」が列の線に掛からない
9. `package.json` の `dependencies` はゼロのまま、`scripts` は `gen-demo-assets` を呼ばない（verify 20-h）
10. 生成物に実在企業名・実在図番・実在製品名が無い（値は §3-1 の表の出どころだけ）

### 8-2. PR-2（`en.js`）

1. `node tools/verify.mjs` → ALL PASS。§20-e が「**6 件**」（qa1 ja/zh・kn11 ja/zh・en3 ja/zh）で ✅
2. `node tools/regress.mjs` → PASS（基準更新なし）
3. `git diff main -- mock/js/data/scenarios/mfg/en.js` が §5-2 の 1 か所（-1 行 / +4 行）だけ
4. **Playwright（または手動）**：`mock/catalog.html` を `file://` で開き、EN-03 → デモ開始 →「サンプルを使う」が出る → 押すと入力欄に `📄 引合図面_K社_RFQ-2025-118_朱書きあり.pdf 開く` のリンク（`href="assets/demo/en3-rfq-2025-118.pdf"`）。言語を中文にすると `询价图纸_K公司_RFQ-2025-118_带红笔批注.pdf 打开`。ページエラー 0。architect の確認結果：
   ```
   ja sampleBtn 1 [["assets/demo/en3-rfq-2025-118.pdf","📄 引合図面_K社_RFQ-2025-118_朱書きあり.pdf 開く"]]
   zh sampleBtn 1 [["assets/demo/en3-rfq-2025-118.pdf","📄 询价图纸_K公司_RFQ-2025-118_带红笔批注.pdf 打开"]]
   qa1 imgs [ 'assets/demo/qa1-inspection-0905.jpg', 'assets/demo/qa1-inspection-0906.jpg', 'assets/demo/qa1-paint-cond-0905.jpg' ]
   errors []
   ```
5. QA-01 の「サンプルを使う」が前と同じ画像 3 点（パス不変）
6. マージ後、Pages で `https://shoulang0729.github.io/dify/assets/demo/en3-rfq-2025-118.pdf` が開く

### 8-3. architect が作業用コピーで済ませた検証（参考）

- 変更前の `--check`：既存 5 点がこの環境でバイト一致（Chromium 141.0.7390.37）
- 変更後の `--check` を別プロセスで 2 回：**7 点すべてバイト一致**
- 既存 4 点（`qa1-inspection-*`・`kn11-*.pdf`）は元リポジトリのファイルと `cmp` で一致
- verify §20 全 PASS（20-b 12 ファイル・20-e 6 件）、全体 ALL PASS / 17 warn、regress PASS
- PDF は PyMuPDF で画像化して目視。テキスト層は印刷の文字と朱書き①（`M6 タップ ×2 追加`）を含み、朱書き②は線（パス）だけなので文字として出てこない

### 8-4. データ層の件数（regress 照合用）

**変化なし**：cats 15／subs 36／svcs 87／tags 67／ui 94（mfg 55・fin 31・it 27／複数業種 13）。`SVCS`・`CATS`・`TAGS` の id は 1 件も増減しない。

---

## §9. 既存の設計書の読み替え（本書が優先）

- `2026-09-16-showcase-demo.md` §9-2「ファイル一覧（9 件）」→ **11 件**（＋ `en3-rfq-2025-118.pdf`・`en3-rfq-2025-118-photo.jpg`。README は別）。`qa1-paint-cond-0905.jpg` の中身に「訂正印・訂正日の欄（空欄）」が加わる
- 同 §9-2 の「帳票に入れる値は…既存台本にあるものだけ」は本書の資産にもそのまま効く
- 既存の設計書は書き換えない（本書を追加するだけ）

---

## §10. PR 分割

| 順 | PR | ブランチ例 | 中身 | 依存 |
|---|---|---|---|---|
| — | ~~PR-0 verify~~ | — | **不要**（§6） | — |
| 1 | **PR-1** | `feat/<issue>-en3-qa1-assets` | `tools/gen-demo-assets.mjs`（§3-4 の差分）、資産 3 点（新規 2・再生成 1）、`mock/assets/demo/README.md`（§7） | なし |
| 2 | **PR-2** | `feat/<issue>-en3-assets-ref` | `mock/js/data/scenarios/mfg/en.js`（§5-2） | PR-1 のマージ後（verify §20-e は `assets` のファイルが実在することを求める） |

- **直列**。PR-1 と PR-2 はファイル集合が重ならないが、PR-2 は PR-1 の生成物を前提にする
- 1 本にまとめてもよい（小さいので）。分けるのは、資産の目視レビュー（PR-1）と台本の参照（PR-2）を別々に承認できるようにするため
- 並列の衝突に注意：`mock/js/data/scenarios/mfg/en.js` を触る別のお題（Cowork の EN-03 台本の磨き上げ等）とは直列。`tools/gen-demo-assets.mjs` を触る別のお題とも直列

---

## §11. PM 判断待ち（推奨つき。すべて「推奨どおり」なら本書のまま実装できる）

- **Q1（軽）朱書き②の形**：筆記体の続け書きに似せた走り書き（特定の字形を使わない）。**推奨：このまま**。ラテン文字の筆記体に少し似て見えるが、中身を決めていない（何と書いてあるかの正解が無い）ので、台本の「判読不能」と矛盾しない。漢字を崩した風にもできるが、字形を選んだ時点で「本当は何と書いてあるか」を作ることになる
- **Q2（軽）表題欄に当社品番 SK-3310-C を書かない**：`records.csv` は RFQ-2025-118 を SK-3310-C に紐づけているが、顧客の図面に当社品番は載らず、`en3` 台本も触れていない。**推奨：書かない**
- **Q3（軽）写真を台本から参照しない（§5-1 案 A）**：**推奨：案 A**。台本を 1 文字も変えずに済む
- **Q4（軽）朱書き①を「印刷済みの穴へのタップ追加指示」にする（§3-1）**：Cowork メモでは 2 面図の中身に M6 タップが並んでいるが、台本の「読めたので条件に入れた」と噛み合わせるため。**推奨：このまま**
- **Q5（中）QA-01 の話の筋が「訂正欄が無かった」から「訂正欄はあったのに空いていた」に変わる**：台本の文言（「訂正者・日付の記入もありません」・D5 の QC-27 に欄を設ける）はどちらの筋でも成立するので、台本は変えない。司会の言い方は「欄はあるのに、現場では使われていなかった」になる。**推奨：このまま**（PM 決定の「訂正欄が空いている様式」どおり）。気になる場合は `runbook-showcase-mfg.md` 幕 1 の台詞に 1 行足すのを別の S レーンで

## §12. 既知の性質（対応しない）

- PDF のテキスト層に朱書き①の文字（`M6 タップ ×2 追加`）が入っている（`handwritten()` が `<text>` で描くため）。モックは読み取りをしないので影響は無い。**将来 P-1 で実機の読み取りにこの PDF を投げる場合**は、テキスト層から朱書きを読めてしまい手書きの読み取りの試験にならない。そのときは写真版を使うか、朱書きを線（パス）にする別 Issue を立てる
- Chromium のバージョンが変わるとバイトは一致しなくなりうる（`showcase-demo.md` §19-8 と同じ）
