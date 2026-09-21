# GN-02（発票処理）に画像の入力経路を 1 つ足す（P-1 (b)）

> 起票済み：#330（run:cloud）・#331（run:mac）。PM が GitHub に立てるときはこのファイルの「## 以降」をそのまま貼る。
> ラベル：**`run:cloud`**（本体）。`run:mac`・`run:runner` は下の「Issue の分け方」のとおり**別 Issue に割る**（`CLAUDE.md` §7：`run:*` は 1 つだけ）。

## 背景

`docs/handoff/2026-09-10-expert-feedback.md` §2-2 の実測：**実機 12 本に `tool` ノードが 0 個**。GN-02 は発票の写真を読めず（`document-extractor` は画像の OCR をしない）、`dify/tests/GN-02.json` は全ケース `"invoice_file": null` で、**ファイル入力が一度も検証されていない**。有識者が「いちばん切実」と言った「きれいなインプットが無くても動く」を実演できるものが、実機側に 1 本も無い。

**PM 決定（2026-09-21）**：同設計書 §10 P-1 の **(b) GN-02 に OCR の入力経路を 1 つ足す**で進める。

## 設計書

**`docs/handoff/2026-09-21-gn02-ocr-input.md`**（v1）

## 何をするか（要点）

- **方式は案 B（画像対応モデル＝ vision ノード）を推奨**。案 A（`tools/paddleocr` の tool ノード）は、プラグイン追加の可否（PM 未確認）以前に、**マスタ DSL の `dependencies` に版固定のプラグイン識別子が要り、その値はプラグインを入れた環境から export しないと得られない**（クラウド側では 1 行も書けない）＋ `render.py` R10 が `dependencies` を env で出し分けないため `CLAUDE.md` §2-12 と衝突する。**案 A は DP-41 決着後の第 2 段階**（設計書 §2・§3-6）
- DSL は **Start に `invoice_image` を 1 本追加 ＋ vision の LLM ノードを 1 個直列に挿す**だけ。既存ノード・System プロンプト・Code・End は変えない（設計書 §3）
- **`dify/env/**` に `vision` role ＋ `models.overrides` 1 行**を 3 env とも足す。`cloud-master` の値はマスタ DSL と同値にして `render.py --check` のバイト一致を保つ（設計書 §4）
- テストは **T09（画像 1 枚）を 1 件**。`run_tests.py` は現状ファイルを 1 バイトも送れないので、**`@file` 指示子 ＋ `POST /files/upload`** の拡張を入れる。駄目なら `run:mac` で手動 1 回（設計書 §5）
- 画像サンプルは **`dify/samples/GN-02/assets/`**（直下に置くと `tools/verify.mjs` §16-b が FAIL する）。生成は `tools/gen-sample-assets.mjs`（新規、`gen-demo-assets.mjs` と同じ SVG→Chromium・playwright は依存にしない・`npm test` から呼ばない）

## 受け入れ条件（要約。全文は設計書 §11 AC-1〜AC-19）

- [ ] `node tools/verify.mjs` FAIL 0（**§16-b／16-e** を含む。既存 4 サンプルに `invoice_image: null` を足すこと）
- [ ] `node tools/regress.mjs` PASS（**`--update` を使わない**。データ層は触らない＝`cats 15 / subs 36 / svcs 87 / tags 67` のまま）
- [ ] `python3 scripts/dify/render.py --env cloud-master --all --check` が**バイト一致**／`--env customer-a GN-02 --strict`・`--env inhouse GN-02 --strict` が exit 0
- [ ] GN-02 の DSL が YAML として読め、**ノード 6・エッジ 5**。**`tool` ノード 0 個・`dependencies: []` のまま・プレースホルダ `{{…}}` 無し**
- [ ] `python3 scripts/dify/run_tests.py --dry-run GN-02` が全 5 ケース OK（ネットワークを呼ばない）
- [ ] サンプル画像 300KB 以下／`package.json` の `scripts` に新ツールを足さない・`dependencies` はゼロのまま
- [ ] `npm run world` の warn が 12 件のまま（新しい固有名詞を作っていない）
- [ ] （`run:runner` 側）`op: deploy` 成功 → `op: run_tests` で **T01・T02・T04・T06 が従来どおり PASS**、**T09 が PASS**
- [ ] （PR-3）T09 が PASS したときだけ、`docs/demo/faq.md` Q32・`runbook-showcase-mfg.md` §4 ⑤・§0-1 の表を設計書 §8 の文に差し替え。**顧客文言にモデル名・ベンダ名を書かない**

## 触らない範囲（全文は設計書 §10）

**`mock/**` 全体**（カタログのデータ層・台本・`desc`・`st`・87 サービスの件数と id は 1 つも変えない）／**`tools/**` の既存ファイル全部**（`verify.mjs`・`regress.mjs`・`regress.baseline.json` を含む。新規 `gen-sample-assets.mjs` を足すだけ）／`package.json`／**GN-02 以外の `dify/apps/**`・`dify/tests/**`・`dify/samples/**`**／`dify/kb/**`・`dify/results/**`・`dify/state/**`（機械が書く）／`data/world/**`／`docs/dify/decisions-pending.md`（DP-41 は PM 判断待ち）／`docs/demo/**`（PR-3 まで）／`.github/workflows/**`／`CLAUDE.md`・`.claude/**`

## PR の分割案

1. **PR-1（`run:cloud`）** DSL＋env（`vision` role）＋`dify/env/README.md` 台帳＋`dify/tests/GN-02.json` T09＋サンプル（S05 新規・既存 4 件に 1 行）＋`tools/gen-sample-assets.mjs`＋`scripts/dify/run_tests.py` の `@file` 拡張
2. **PR-2（`run:runner`・機械）** `op: deploy`（`codes: GN-02`／`confirm: deploy`／`env: cloud-master`）→ `op: run_tests`。結果は `dify/results/cloud-master/**` に機械だけが書く
3. **PR-3（`run:cloud`）** デモ文言の差し替え（設計書 §8）。**T09 が PASS したときだけ出す**

## Issue の分け方（`run:*` は 1 つだけ）

| Issue | ラベル | 中身 |
|---|---|---|
| 本 Issue | `run:cloud` | PR-1・PR-3 |
| 別 Issue A | `run:mac` | ① **DP-41**：Cloud に tool プラグインを追加できるか ② **C-1**：画像対応モデルの正確な名前（設定 → モデルプロバイダー画面＝O10） ③ 必要なら手動 1 回のファイル入力確認（設計書 §5-5） |
| 別 Issue B | `run:runner` | PR-2（deploy → run_tests） |

## PM 判断待ち（設計書 §12）

1. **方式 → **B で確定**（PM 2026-09-21。GitHub Issue #330 と同文
2. **C-1：DSL と env に書く画像対応モデルの正確な名前**（`run:mac` で確認。**返るまで PR-1 をマージしない**）
3. **DP-41 を `docs/dify/decisions-pending.md` に足すか**（推奨：足す。文案は設計書 §12-1。**architect は書き足さない**）
4. 顧客文言に確認日を入れるか（推奨：入れず「別途ご案内します」）
5. 空打ちの vision ノードを許容するか（推奨：許容。if-else は第 2 段階）
6. `dify/samples/<番号>/assets/` を verify §16 の検査対象にするか（推奨：当面しない）

## 未確認（設計書 §6。推測で「できる」と書かない）

C-1 画像対応モデルの実在／C-2 `vision.configs.variable_selector` で Start の file 変数を指せるか（リポジトリ内に実例が無い）／C-3 画像なしで vision ノードが落ちないか／C-4 Service API のファイルアップロードの形（`POST /files/upload`・`upload_file_id`・`transfer_method`）／C-5 GN-02 が `op: deploy` の KB 安全弁に掛からないこと
