# docs/demo — デモ資材の地図（③ユースケース・シナリオ）

`docs/demo/` は、デモの**運用**資材を置く場所です。モックのコード（`mock/**`）でも設計書（`docs/handoff/**`）
でもありません。設計は `docs/handoff/2026-09-09-demo-assets.md`（Issue #205）を参照してください。

## 1. このディレクトリは何か

顧客の前で実機（Dify Cloud）を動かす司会者のための進行台本と、顧客に配る説明資料を置きます。
コードではなく人が読む文書です。

## 2. A/B/C/D の対応表

| # | 資材 | 置き場 | 状態 |
|---|---|---|---|
| A | 入力サンプル | [`dify/samples/`](../../dify/samples/) | KN-01 の 4 本を投入済み（PR-2〜PR-4 で製造・金融の残りを追加） |
| B | KB 文書 | [`dify/kb/`](../../dify/kb/) | 既存 11 本（PR-5・PR-6 で +20 本の予定） |
| C | 実機デモ進行台本 | `runbook-mfg.md`（製造）・`runbook-fin.md`（金融） | 未作成（PR-7 で追加予定） |
| D | 顧客提示資料 | `briefing-catalog.md`・`briefing-coverage.md`・`faq.md` | 未作成（PR-8 で追加予定） |

## 3. モックの `SCENARIOS` との違い

C（実機デモ進行台本）は、モックの `mock/js/data/scenarios/**`（`SCENARIOS`）とは別物です。混ぜないでください。

| | モックの `SCENARIOS`（`mock/js/data/scenarios/**`） | C 実機デモ台本（`docs/demo/runbook-*.md`） |
|---|---|---|
| 何 | **画面に表示される会話データ**（コード） | **人が読み上げる司会進行の手順書**（文書） |
| 誰が読む | ブラウザ（`renderDemo`） | デモの司会者 |
| 対象 | 73 サービス（LLM 未接続のダミー応答） | 実機 12 本（Dify Cloud の本物の応答） |
| 言語 | `script` は ja/zh（`steps` は ja/zh/en） | 読み上げ文を ja/zh 併記 |
| 置き場 | ③（`mock/` 配下＝コード） | ③（`docs/demo/`） |
| 依存 | `TEMPLATES`・`state` | `dify/samples/`・`LIVE`（`mock/js/data/live.js`）・`dify/KNOWN_ISSUES.md` |

## 4. 金融の非対称

**金融には投入先の Dify アプリが 1 本も無い。** `docs/dify/implementation-guide.md` §3 の **W4 が金融第一陣
（KN-06・KN-08・DC-09・RS-01・RS-03）** で未着手です。したがって金融側の資材は「実装済み」と同じ見え方にしません。

| | 製造（mfg） | 金融（fin） |
|---|---|---|
| A 入力サンプルの用途 | **実機 12 本にそのまま投入する**（デモ当日に使う） | ① モックのデモ（`catalog.html`）で口頭・画面に出す素材 ② W4 実装時にそのまま `dify/tests/` と DSL の Start 変数へ移せる素材 |
| A の検証 | `inputs` のキーが `dify/tests/<番号>.json` と一致すること（FAIL 判定） | 対応する DSL が無いので warn（`docs/dify/usecases/<番号>.md` §4 の変数名に合わせる） |
| B KB の用途 | 実機 KB に投入して検索デモの母数を増やす | W4 で投入する素材。今回は Git に置くだけで実機には投入しない |
| C デモ台本 | `runbook-mfg.md`＝実機の司会台本 | `runbook-fin.md`＝モック中心の司会台本。冒頭に「実機は W4 で用意する」と明記する |
| D 顧客資料 | カバレッジ表で「実装済み」と表示 | カバレッジ表で「素材あり・実機未実装（W4）」と表示。実装済みと同じ見え方にしない |

## 5. デモ当日の持ち物チェックリスト（案。PR-7 で `runbook-*.md` に詳細化）

- [ ] `mock/js/data/live.js`（`LIVE`）の URL が開くか事前確認済み
- [ ] 投入する `dify/samples/<番号>/<番号>-S01-….md` を手元にコピーしておく
- [ ] `dify/KNOWN_ISSUES.md` に載っている既知の不具合を確認済み
- [ ] 顧客の実データ・実名を入力しない（`CLAUDE.md` §2-10）

## 6. 資材を足すときの手順

1. 入力サンプルを足すときは [`dify/samples/README.md`](../../dify/samples/README.md) の手順に従う
2. 書きたい人名・品番・設備・文書番号・KPI・企業が `data/world/` に無いときは、まず `data/world/` に足す
   （このディレクトリの文書だけで新しい値を作らない）
3. 追加後は `node tools/verify.mjs`・`node tools/regress.mjs`・`npm run world` を実行し、warn が増えていないことを確認する
