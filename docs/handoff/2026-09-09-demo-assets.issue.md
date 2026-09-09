# デモ資材一式（入力サンプル・KB 増量・実機デモ台本・顧客提示資料）

設計書: `docs/handoff/2026-09-09-demo-assets.md`
レーン: **M/L** ／ ラベル: `run:cloud`

## 背景

デモで使える資材が足りていない。

- **入力サンプルは 0 件**（置き場すら無い）。実機 12 本のデモで何を投入するかが毎回その場しのぎ
- **KB は 4 アプリ・11 本だけ**（KN-01 3・KN-02 3・KN-03 3・GN-01 2）。検索デモの母数が小さく「効いている感」が出ない
- **実機を人前で回すときの司会台本が無い**（モックの `SCENARIOS` は画面に出る会話データで、司会台本ではない）
- **顧客に配る資料が無い**（13 分類 29 中分類 67 サービスの位置づけ、実装済み 12 本がどこに当たるか）

## 金融の非対称（この Issue の前提。実装者は必ず読む）

**金融には投入先の Dify アプリが 1 本も無い。** `docs/dify/implementation-guide.md` §3 の **W4 が金融第一陣（KN-06・KN-08・DC-09・RS-01・RS-03）** で未着手。

したがって金融側の入力サンプル・KB は **① モックのデモで使う素材 ② W4 実装時にそのまま移せる素材** という位置づけで、**製造側（実機にそのまま投入する）と同じ扱いに見せない**。
`docs/demo/README.md`・`briefing-coverage.md`・`runbook-fin.md` §0 の 3 か所に明記すること。

## やること

| # | 資材 | 量 | 置き場 |
|---|---|---|---|
| A | 入力サンプル | **63 本**（製造 12 アプリ×4／金融 5 サービス×3） | `dify/samples/<管理番号>/<管理番号>-S<2桁>-<slug>.md` |
| B | KB 増量 | **+20 本 → 31 本**（製造 4 アプリを各 5〜6／金融 KN-06・KN-08 を新設） | `dify/kb/<管理番号>/` |
| C | 実機デモ進行台本 | 2 本（ja/zh 併記） | `docs/demo/runbook-mfg.md` `runbook-fin.md` |
| D | 顧客提示資料 | 3 本 | `docs/demo/briefing-catalog.md` `briefing-coverage.md` `faq.md` |

機械検証は `tools/verify.mjs` に **§16**（§13 は #121 W2 で予約済み・§14/§15 は使用中）を新設し、`tools/check-world.mjs` の走査対象に `dify/samples/**` を足す。仕様は設計書 §D5。

**バイナリは置かない**（設計書 D3）。発票・請求書も OCR 済みテキストで書く。実機 12 本は現状ファイル入力を使っておらず（`dify/tests/` の全ケースが `*_file: null` で合格）、画像を置いても投入先が無い。

## PR 分割（8 本）

| PR | 内容 | 主なファイル | 概算ファイル数 |
|---|---|---|---|
| **PR-1** | 骨組み：規約・機械検証・4 区分の更新・見本 4 本 | `CLAUDE.md` `README.md` `tools/verify.mjs` `tools/check-world.mjs` `dify/samples/README.md` `dify/samples/KN-01/*` `docs/demo/README.md` | 10 |
| **PR-2** | 入力サンプル 製造①（KN-02 KN-03 GN-01 GN-02 GN-05 NM-03） | `dify/samples/{KN-02,KN-03,GN-01,GN-02,GN-05,NM-03}/` | 24 |
| **PR-3** | 入力サンプル 製造②（DC-01 DC-02 DC-04 LG-01 LG-04） | `dify/samples/{DC-01,DC-02,DC-04,LG-01,LG-04}/` | 20 |
| **PR-4** | 入力サンプル 金融（KN-06 KN-08 DC-09 RS-01 RS-03）＋ `data/world/README.md` 未統一 ⑩ の解消 | `dify/samples/{KN-06,KN-08,DC-09,RS-01,RS-03}/` `data/world/README.md` | 16 |
| **PR-5** | KB 増量 製造（+12） | `dify/kb/{KN-01,KN-02,KN-03,GN-01}/` `dify/kb/README.md` `docs/service-map.md` | 14 |
| **PR-6** | KB 素材 金融（+8） | `dify/kb/{KN-06,KN-08}/` `dify/kb/README.md` `docs/service-map.md` | 10 |
| **PR-7** | C 実機デモ台本 | `docs/demo/runbook-mfg.md` `runbook-fin.md` | 2 |
| **PR-8** | D 顧客提示資料 | `docs/demo/briefing-catalog.md` `briefing-coverage.md` `faq.md` | 3 |

### 並列可否

```
PR-1（先行必須）
  ├── PR-2 ┐
  ├── PR-3 ┤ 別ディレクトリ → 並列可
  ├── PR-4 ┘
  ├── PR-5 ──▶ PR-6   docs/service-map.md・dify/kb/README.md が重なる → 直列
  ├── PR-7 ┐ 別ファイル → 並列可。ただし PR-2〜PR-6 の実ファイル名を参照するので
  └── PR-8 ┘ マージ後の着手を推奨
```

**Issue #195（PR-1／PR-1b／PR-2）とのファイル衝突はゼロ。** 本 Issue は `dify/apps/**`・`dify/env/**`・`scripts/dify/**`・`.github/workflows/**`・`dify/DEPLOY.md`・`dify/KNOWN_ISSUES.md`・`dify/env/README.md`・`docs/dify/decisions-pending.md` を一切触らない。

## 受け入れ条件

### 全 PR 共通

- `npm test` **ALL PASS**。warn は既知の 2 件（§9 台本の無い SVCS 5 件／§14 LIVE 未登録 12 本）＋ §16 由来のみ
  - PR-1 直後：§16-i（samples が無い/3 件未満）11 件
  - PR-3 完了後：§16-i **0 件**
  - PR-4 完了後：§16-f **15 件**（金融＝実機 DSL 未実装。恒久 warn として `dify/samples/README.md` に理由を書く）
- `npm run world` の warn 合計が**増えない**
  - PR-1〜3・5〜8 後：**10 件**（mfg 8／fin 2）
  - **PR-4 後：9 件**（fin W9 の「どこにも出てこない人物 6 名」が解消。`data/world/README.md` の未統一表の行数も 9 にする）
- `node tools/regress.mjs` **PASS**（データ層は不変。`--update` は使わない）
- 下の「触らない範囲」のファイルが diff に 1 つも無い

### PR ごと

- **PR-1**：`verify.mjs` 冒頭コメントに §16 を追記／`§13 は #121 W2 用に予約` のコメントを残す／`dify/samples/` が無くても `npm test` が PASS（skip が効く）／§11-b（README 4 区分のリンク実在）PASS／**`package.json` 不変**
- **PR-2/PR-3**：44 本が §16-a〜16-h を満たす／各アプリ 4 本に ja 1 以上・zh 1 以上・`edge` 1 本／`inputs` キーが `dify/tests/<番号>.json` と完全一致
- **PR-4**：15 本／設計書 §3-4 の 6 名（林 静・中野 隆・鄭 麗華・徐 涛・潘 婷・石田 由美）が全員登場／`npm run world` の fin warn が 1 件
- **PR-5**：KN-01 6・KN-02 6・KN-03 6・GN-01 5 本／追加 12 本が `dify/tests/` の `expect` の数値・条件を繰り返していないこと（PR 本文に非重複チェック表を貼る）／`npm run index` 再生成
- **PR-6**：KN-06 4・KN-08 4 本／`dify/kb/README.md` に「未投入（W4 待ち）」／`npm run index` 再生成
- **PR-7**：12 節（mfg）・5 節（fin）が `dify/samples/` の実在ファイルを指す／読み上げ文 ja/zh 併記／`runbook-fin.md` §0 に「実機未実装・W4」／実在企業名・実在サービス名・生 URL なし
- **PR-8**：`briefing-coverage.md` の表が `docs/service-map.md` と矛盾しない／金融が「素材あり・実機未実装」と表示される／`faq.md` に実在サービス名なし

## 触らない範囲（reviewer の diff 監査基準。1 行でも出たら差し戻し）

- **`mock/**` すべて**（`catalog.html`・`css/**`・`js/**`・`js/data/**`・`js/data/scenarios/**`・`index.html`）
- **`dify/apps/*.yml`**（12 本すべて。#195 が 4 本を触っている）
- **`dify/env/**`**（`cloud-master/env.yml` を含む）
- **`dify/tests/*.json`**（期待語は緩めない・消さない）
- **`dify/results/**`・`dify/state/**`**（機械だけが書く）
- **`scripts/dify/**`・`.github/workflows/**`**
- **`dify/DEPLOY.md`・`dify/KNOWN_ISSUES.md`・`dify/env/README.md`・`docs/dify/decisions-pending.md`**
- **`tools/regress.mjs`・`tools/regress.baseline.json`・`tools/gen-index.mjs`**（索引に列を足さない＝設計書 D9。足すと PR-2/3/4 が並列できなくなる）
- **`package.json`**（npm script も依存も足さない）
- **`.claude/**`**
- `data/world/` のマスタ本体（csv・md）。値の追加が要ると分かったら**止まって PM/architect に返す**（PR-4 が触るのは `README.md` の未統一表だけ）

## implementer が止まる条件

1. 書きたい人名・品番・設備・文書番号・KPI が `data/world/` に無い（`CLAUDE.md` §2-13：まず正本に足す＝別 PR）
2. `dify/tests/<番号>.json` の `inputs` キーに合わせるとサンプルが不自然（＝DSL の Start 変数不足の疑い。DSL は触らない）
3. `npm run world` の warn が増える
4. `CLAUDE.md` の変更が PM 未承認（PR-1 の `CLAUDE.md` 差分だけ外して他を進める）

## PM 判断待ち

| # | 論点 | architect の推奨 |
|---|---|---|
| P1 | `CLAUDE.md` 冒頭 4 区分（③④）と §2-13 の 3 行を変えてよいか | **変える**（`docs/demo/` の帰属が曖昧なままだと次の agent が `docs/handoff/` に置く） |
| P2 | 件数 A 63 本・B +20 本でよいか | **このまま** |
| P3 | 発票・請求書の画像／PDF 生成スクリプトを今回作るか | **作らない**（実機は現状ファイル入力を使っていない。別 Issue） |
| P4 | 金融 KB を `dify/kb/` に置くか | **置く**＋`dify/kb/README.md` で「未投入（W4 待ち）」と明示 |
| P5 | C の日中併記の形 | **1 ファイルに ja/zh 併記**（分けると片方だけ更新されてズレる） |
| P6 | D を Markdown だけにするか | **Markdown のみ**（PowerPoint 化は PM が別途） |

## 後続 Issue（この Issue には含めない）

- **`run:runner`**：PR-5 マージ後、`op: kb_upload`（`KN-01 KN-02 KN-03 GN-01`。**追加のみ＝削除ゼロ。K1〜K8 の歯止めには当たらない**）→ `op: run_tests` で 16 件の回帰。FAIL したら**期待語を緩めず追加した KB 文書のほうを直す**
- `docs/service-map.md` に「入力サンプル」列を足す（全サンプル PR のマージ後）
- P3 が「作る」になった場合の `scripts/demo/render_samples.py` と `dify/samples/build/`
