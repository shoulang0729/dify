<!-- gh issue create --title "..." --label "run:cloud" --body-file docs/handoff/demo-assets-en03-qa01.issue.md -->
# EN-03 引合図面（朱書きあり）の資産 2 点と、QA-01 塗装条件記録の訂正欄（空欄）

**ラベル**：`run:cloud`
**レーン**：M
**設計書**：`docs/handoff/2026-09-24-demo-assets-en03-qa01.md`
**起点**：PM 決定 2026-09-24（Cowork メモ `2026-09-23-dc03-en03-input-entry.md` §3-1、`2026-09-23-qa01-handwritten-input.md` §4 の提案を OK）

## やること

1. `tools/gen-demo-assets.mjs` を拡張する（設計書 §3-4 の差分をそのまま当てる）
   - EN-03：`en3-rfq-2025-118.pdf`（A4 横 1 ページ、図枠・表題欄・正面図と側面図、朱書き 2 か所＝①「M6 タップ ×2 追加」は読める／② 右下余白の走り書きは読めない）と `en3-rfq-2025-118-photo.jpg`（印刷して机の上で撮った風、傾き 1〜2°）
   - QA-01：`qa1-paint-cond-0905.jpg` に「訂正印／訂正日」の 2 列（空欄）を刷る。乱数を消費しない関数で足すので、手書きの値・線・撮影の傾きは不変
2. `mock/assets/demo/README.md` に追記する（設計書 §7）
3. `en3.input.{ja,zh}` に `assets: [{ file: 'assets/demo/en3-rfq-2025-118.pdf', kind: 'doc' }]` を足す（`files` は 1 件のまま。写真は台本から参照しない。設計書 §5）

## 受け入れ条件（詳細は設計書 §8）

- [ ] `node tools/verify.mjs` ALL PASS。§20 の 20-a〜20-h すべて ✅（PR-2 後は 20-e が 6 件）。warn 件数は変更前と同数
- [ ] `node tools/regress.mjs` PASS（**基準更新なし**。データ層の件数・id は不変）
- [ ] `NODE_PATH=$(npm root -g) node tools/gen-demo-assets.mjs --check` を 2 回実行し、2 回とも 7 点一致（出力を PR 本文に貼る）
- [ ] サイズ：PDF ≤ 200KB、JPEG ≤ 300KB（architect の実測：PDF 80,057 B／写真 225,055 B／塗装条件記録 186,508 B）
- [ ] **バイト不変**：`qa1-inspection-0905.jpg`・`qa1-inspection-0906.jpg`・`kn11-*` が差分に出ない
- [ ] 目視：PDF は 1 ページ・朱書き①は読める・朱書き②は文字として読めない／写真は傾き 1〜2°＋影・かすれ／塗装条件記録は訂正欄が空欄で、3.8・12 の線と他の値が前と同じ位置
- [ ] QA-01 の台本（`qa.js`）は 1 文字も変わらない
- [ ] `file://` で EN-03 → デモ開始 →「サンプルを使う」で `assets/demo/en3-rfq-2025-118.pdf` へのリンクが出る（ja・zh とも）。QA-01 は前と同じ画像 3 点

## 触らない範囲

- `tools/verify.mjs`（§20 にファイル名の許可集合は無いので変更不要）・`tools/regress.mjs`・`package.json`
- `mock/js/data/scenarios/mfg/qa.js`、`en.js` の `en3` のうち `input` 以外、`catalog.js`・`ui.js`
- `mock/js/render.js`・`app.js`・`events.js`・`mock/js/portal/**`・`mock/css/**`
- 再生成しない資産：`qa1-inspection-*.jpg`・`kn11-*`（PDF・wav・txt）
- `data/world/**`・`docs/demo/**`（EN-03 はデモの幕に入っていない）・`docs/handoff/2026-09-16-showcase-demo.md`・`portal/**`・`CLAUDE.md`・`.claude/**`

## PR の分割案（直列）

1. **PR-1**：`tools/gen-demo-assets.mjs`＋資産 3 点（新規 2・再生成 1）＋`mock/assets/demo/README.md`
2. **PR-2**：`mock/js/data/scenarios/mfg/en.js` の `en3.input.assets`（PR-1 のマージ後。verify §20-e が資産の実在を求めるため）

（PR-0 の verify 変更は不要。`en.js` や `gen-demo-assets.mjs` を触る別のお題とは直列にする）

## PM 判断待ち（推奨どおりなら設計書のまま実装可。設計書 §11）

- Q1 朱書き②は特定の字形を使わない走り書き → 推奨：このまま
- Q2 表題欄に当社品番 SK-3310-C を書かない → 推奨：書かない
- Q3 写真は台本から参照しない（`files` は 1 件のまま）→ 推奨：参照しない
- Q4 朱書き①は「印刷済みの穴へのタップ追加指示」にする → 推奨：このまま
- Q5 QA-01 の筋が「欄はあったのに空いていた」に変わる（台本は変えない）→ 推奨：このまま
