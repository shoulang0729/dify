# mock/assets/demo — デモ用のダミー資産

**この帳票・音声・PDF はすべて架空です。** 実在の会社・人物・製品とは関係ありません。
実在の人の手書きも、実在の人の声も使っていません。

設計書: `docs/handoff/2026-09-16-showcase-demo.md` §9（PR-0）。

## ファイル一覧

| ファイル | 種類 | 使う台本 | 生成方法 |
|---|---|---|---|
| `qa1-inspection-0905.jpg` | JPEG | QA-01 | `tools/gen-demo-assets.mjs`（決定的） |
| `qa1-inspection-0906.jpg` | JPEG | QA-01（備考欄が判読不能） | 同上 |
| `qa1-paint-cond-0905.jpg` | JPEG | QA-01（脱脂液濃度・撹拌時間に訂正あり） | 同上 |
| `kn11-ws-l3-04-revC.pdf` | PDF | KN-11（現行 Rev.C） | 同上 |
| `kn11-ws-l3-04-revA.pdf` | PDF | KN-11（旧版 Rev.A） | 同上 |
| `kn11-interview-ja.wav` / `.txt` | WAV / テキスト | KN-11（日本語） | `tools/gen-demo-audio.py`（オフライン TTS） |
| `kn11-interview-zh.wav` / `.txt` | WAV / テキスト | KN-11（中国語） | 同上 |

## 画像・PDF（tools/gen-demo-assets.mjs）

- 帳票は SVG を JS で組み立て、Chromium（Playwright）でスクリーンショット / PDF 化した生成物です。
- **手書きらしさ**：値の 1 文字ごとに回転（±4〜7°）・基線の緩いうねり・字間のばらつき・線の
  太さの揺れを付けています。数字も等幅ではなく 1 文字ずつ別々に描画。一部の値には
  「消してから書き直した」跡（薄い塗り＋うっすら残る前の筆跡の上に本来の値を重ね書き）や、
  罫線からのはみ出しを付けています。判読不能な備考欄は、線の束ではなく「ペンで塗りつぶした・
  こすれた」見た目（にじみのぼかし＋太いペンの往復）にしています。
- **写真らしさ**：CSS の 3D transform（`perspective`）でわずかな台形の歪み（スマホで斜めから
  撮った見た目）を、照明のムラ（片側が暗い・斜めのグラデーション）・蛍光灯の反射（白いにじみ）・
  軽いボケ（`filter: blur()`）・四隅の影（ビネット）・紙の折り目や指跡/油じみ・背景の
  暗色の作業台を重ねて出しています。角度・明るさ・反射の位置はファイルごとに違えてあります
  （3 枚を見比べると撮り方が微妙に異なります）。帳票の見出し・欄名は印刷のまま
  （手書きの揺らぎを付けていない）にして、印字とペン書きの差をはっきり出しています。
- これらの見た目の演出は**すべて決定的な乱数**（`mulberry32`。ファイルごとに固定シード）で
  作っています。`Date.now()` / `Math.random()` は使っていません。**内容（値・項目・
  読めない箇所・確信度が低い箇所の位置）は変えていません**（見た目の演出のみの変更）。
- 使った Chromium のバージョン: **141.0.7390.37**（Playwright 1.56.1 にバンドルされたもの）
- 再生成:
  ```
  NODE_PATH=$(npm root -g) node tools/gen-demo-assets.mjs
  ```
  検査（直前の生成物とバイト一致するか。CI には入れない）:
  ```
  NODE_PATH=$(npm root -g) node tools/gen-demo-assets.mjs --check
  ```
  この 5 ファイル（JPEG 3・PDF 2）は 2 回連続実行してバイト一致することを確認済みです
  （PDF は Chromium が埋め込む生成時刻 `/CreationDate`・`/ModDate` を固定値に正規化しています。
  桁数が変わらない置換なので PDF 内部のバイトオフセットは壊れません）。
  ただし **Chromium のバージョンが変わると一致しなくなる可能性があります**。

## 音声（tools/gen-demo-audio.py）— オフライン TTS で生成

PM 決定（2026-09-16、Issue #311）により、**この環境で実際に動くオフライン音声合成**を使って
合成音声を生成しています。外部の読み上げサービスへは 1 バイトも送信していません（すべて
ローカルの推論）。

- **日本語**: [pyopenjtalk](https://github.com/r9y9/pyopenjtalk)（OSS の日本語 TTS）
- **中国語**: [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) の VITS モデル
  `sherpa-onnx-vits-zh-ll`（話者 id 2 を使用）
- 声は実在の人物のものではありません（学習済み OSS モデルの合成音声）
- 16kHz・モノラル・16bit PCM の WAV です
- 実際の聞き取りは「32 分 14 秒」という設定ですが、この音声は要点を書き起こした
  **抜粋**（日本語 約 54 秒・中国語 約 39 秒）です。読み上げているテキストは同名の `.txt` と
  同じ内容で、`docs/handoff/2026-09-16-showcase-demo.md` §7-2 の勘所・判断基準と食い違いません

### 再現性についての注記

日本語（pyopenjtalk）は 2 回生成してバイト一致を確認済みです（決定的）。
**中国語（sherpa-onnx の VITS）は 2 回生成してもバイトが完全には一致しませんでした**
（生成のたびに発話の長さがわずかに変わります。モデル内部の確率的な処理によるもので、
このツール側では制御できません）。内容（読み上げるテキスト）は同じで、聞いた印象も
変わりません。

### 再生成の手順

```
python3 -m venv .venv-tts
source .venv-tts/bin/activate
SSL_CERT_FILE=/root/.ccr/ca-bundle.crt PIP_CERT=/root/.ccr/ca-bundle.crt \
  pip install "numpy<2" pyopenjtalk-prebuilt sherpa-onnx

python3 tools/gen-demo-audio.py
# 中国語モデル（約118MB）は初回だけ自動取得して tools/.cache/ に置きます（.gitignore 対象）。
# 既に展開済みのモデルディレクトリがあるなら --zh-model で指定できます:
python3 tools/gen-demo-audio.py --zh-model /path/to/sherpa-onnx-vits-zh-ll
```

`npm test` / `npm run ci` からは呼ばれません（Python の TTS 依存はルート `package.json` にも
`requirements.txt` にも足していません）。

### PM が別途用意した音声に差し替える場合

`kn11-interview-ja.wav` / `kn11-interview-zh.wav` を同じファイル名で置き換えるだけで構いません
（`SCENARIOS[].input.assets` のパスは変わらないため）。例えば macOS の `say` コマンドで作る場合:

```
# 日本語（Kyoko）
say -v Kyoko -o kn11-interview-ja.aiff -f kn11-interview-ja.txt
afconvert -f WAVE -d LEI16@16000 -c 1 kn11-interview-ja.aiff kn11-interview-ja.wav

# 中国語（Tingting）
say -v Tingting -o kn11-interview-zh.aiff -f kn11-interview-zh.txt
afconvert -f WAVE -d LEI16@16000 -c 1 kn11-interview-zh.aiff kn11-interview-zh.wav
```

`.txt`（文字起こし）は差し替え不要です（読み上げるテキストは変わらない前提のため）。
外部のオンライン読み上げサービスへは送信しないでください（架空の台本テキストとはいえ、
CLAUDE.md §2-10 の方針に沿って、この資産は環境内 / ローカルで完結する方法だけを使っています）。

## 値の出どころ

帳票・文書に書かれた値はすべて `data/world/mfg/`（`records.csv`・`products.csv`・
`equipment.csv`・`people.csv`）または既存台本（`mock/js/data/scenarios/mfg/qa.js`）・
本設計書にある値だけです。新しい数字・名前は作っていません。

- 品番 `SK-3310-A`、ロット `250905-L3`、ライン `L3`、抜取 `n=32`：`products.csv`・既存 `qa1` 台本
- 検査員 `陈静`（陳 静）・`周敏`（周 敏）、記入者 `王磊`（王 磊）：`people.csv`
- 不良内容「涂装颗粒 0.3〜0.5mm」、脱脂液濃度 `3.8`、撹拌時間 `12`、フィルター交換日 `7/20`：
  既存 `qa1` 台本（`mock/js/data/scenarios/mfg/qa.js` の D2・D4）および本設計書 §8-2・§9-2
- 乾燥炉 `DO-3200` の「基準内（むら±8℃）」：`equipment.csv` の DO-3200 行の記述をそのまま使用
  （新しい温度の実数値は作っていません）
- KN-11 の勘所・判断基準（予熱 40℃・空打ち 3 回・ボルスタの切りくず・ガイドの当たり音・
  芯出しの順序）：本設計書 §7-2 の `result` と同じ内容
- 文書番号 `WS-L3-04`、版 `Rev.A`（2019-06-01）/ `Rev.C`（2024-11-25）、`NC-2024-0118`：
  `documents.csv`（PR-1 で追加）・`records.csv`

## 読めない項目・確信度が低い項目（QA-01 の演出）

- **読めない（1 項目）**：`qa1-inspection-0906.jpg` の備考欄。斜線と重ね書きの走り書きで
  判読不能にしています（テキストではなく乱雑な曲線で描画）
- **確信度が低い（2 項目）**：`qa1-paint-cond-0905.jpg` の
  - 前処理脱脂液濃度「3.8」（取り消し線での訂正があり「3.6」とも読める見た目にしています）
  - 塗料撹拌時間「12」（同様に「17」とも読める見た目にしています）

## このモックについて

**このモックは読み取り（OCR・文字起こし）を行いません。** 読み取り結果は台本
（`mock/js/data/scenarios/`）から出しています。ここに置いた画像・PDF・音声は、
実際にブラウザで表示・再生・ダウンロードできる「本物のファイル」ですが、その中身を
読み取る処理は行っていません。
