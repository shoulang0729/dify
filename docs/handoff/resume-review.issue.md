# [usecase] 履歴書のレビュー（PT-09）—— オープンポスト照合・違和感と書類の漏れ・書面の深掘り質問・役職別の面接チェック項目

ラベル：`run:cloud`

> `gh` が使えない環境のため、Issue 本文をファイルに書き出した。PM がこの内容で起票する。

## 設計書

- `docs/handoff/2026-09-23-resume-review.md`
- 実装リファレンス：`docs/dify/usecases/PT-09.md`
- 同時に書き換え済み：`docs/dify/platform-components.md` の PC-02・PC-03・PC-10「使うサービス」行（3 行）

## 何をするか（1 行）

届いた履歴書を社内のオープンポスト全件と突き合わせ、違和感（時系列・記載の食い違い）と書類の漏れを拾い、採用エージェント・応募者本人への書面の質問と、面接で人が確かめる項目（役職の段階別）を下書きする。**氏名と保護属性は読む前に伏せ、合否は人が決める。**

## 決めたこと（設計書 §0-4・§2・§3）

- 新規採番は **PT-09**（`pt9`、`pt/service`、`industries: ['mfg']`、`st: 3`、`upload`、`place: 'ppl'`、`tags: ['partner_recruit','hr']`、`added: '2026-09-23'`）の 1 件
- 有名ユースケース③「面接メモの構造化」は **PT-09 の `mode=debrief`** に含め、**PT-10 は採番しない**（Notion の仮予約カードは「統合（PT-09 のモード）」で閉じる）
- PT-05 とは 5 軸 3/5 だが、個人情報の前提が逆（PT-05＝原本はエージェント側、PT-09＝当社が受け取る）なので別サービス。**`pt5` は 1 文字も変えない**
- 架空の応募者 2 名（`C-25-031`・`C-25-032`。**氏名列なし**）・オープンポスト 3 件（`JP-25-011`〜`013`）・採用書類規程 `RULE-11`・記号会社 `P 社`・`Q 社`・`Y 社` を `data/world/mfg/` に足す

## 受け入れ条件（設計書 §10。実走済みの期待値）

- [ ] `node tools/verify.mjs` → `✅ ALL PASS / ⚠️ 17 warn`（warn の中身は変更前と同じ）
- [ ] `node tools/regress.mjs`（`--update` 後）→ `{"cats":15,"subs":36,"svcs":88,"tags":67,"ui":94,"byIndustry":{"mfg":{"svcs":56,"cats":10},"fin":{"svcs":31,"cats":8},"it":{"svcs":27,"cats":7}},"svcsMulti":13}`（変更前 `svcs` 87・`mfg` 55。差分は `SVCS 追加: pt9` だけ）
- [ ] `node tools/check-world.mjs` → **合計 12 件**（製造 10／金融 1／IT 1。変更前と同じ）
- [ ] `npm run index` 後 `node tools/gen-index.mjs --check` → `✅ docs/service-map.md は最新`（差分は PT-09 の 1 行と集計行 `①製造 56`・`③73`）
- [ ] `node portal/scripts/gen-seed.mjs` → `npm run portal:test` が PASS（変わる seed は `portal/seed/catalog.json` の 1 本だけ）
- [ ] `docs/dify/usecases/PT-09.md` が `_TEMPLATE.md` の 10 節すべてを持つ
- [ ] `pt9` の台本・結果に：応募者の氏名 0／希望給与の金額 0／合否の語（不採用・見送り・落とす・推奨しない）と決めつけの語（虚偽・詐称・疑わしい）0／`**` 0／`q`・`a` の中の `'` 0。保護属性の語は「読む前に伏せた」「質問に入れていない」「聞かないこと」の文脈だけ
- [ ] `pt5`（`SVCS`・`SCENARIOS`）が 1 文字も変わっていない
- [ ] Pages：製造業の「パートナー連携 › 代行・エージェント」に PT-09 が NEW つきで出て、デモが ja・zh で 3 往復最後まで進む。ポータルの要員の画面に PT-09 のボタンが出る

## 触らない範囲（設計書 §9）

- `tools/**`・`mock/js/{app,render,events}.js`・`mock/css/**`・`mock/*.html`・`mock/assets/**`
- `mock/js/data/ui.js`（**`TAGS`・`TEMPLATES` を増やさない**）・`home.js`・`style.js`・`portal/**` の `svc.js` 以外（`PSCREENS[].ct` を含む）
- `mock/js/data/scenarios/**` の `mfg/pt.js` 以外。`catalog.js` の既存 87 エントリ（特に `pt5.desc`）
- `data/world/mfg/people.csv`・`org.csv` ほか設計書 §4 に無いファイル／`data/world/fin/**`・`data/world/it/**`
- `docs/dify/build-or-buy.md`・`docs/dify/usecases/PT-05.md`・`outline-wiki-usecases.md`・`feasibility-33-services.md`・`docs/demo/**`
- `dify/**`（`dify/tests/PT-09.json` は作らない）・`portal/` の seed 以外
- `CLAUDE.md`・`.claude/**`・`.github/**`

## PR 分割案（設計書 §11）

**PR-B → PR-A → PR-C の直列**（PR-A と PR-B は並列でも成立。PR-C は必ず最後）

1. **PR-B（世界マスタ）**：`data/world/mfg/{postings,candidates}.csv`（新規）・`documents.csv`（1 行）・`partners.csv`（3 行）・`calendar.md`（2 行）・`data/world/README.md`（設計書 §4-6）。検証：`npm test`／`check-world` 12 件／`portal:test`（seed の差分なし）
2. **PR-A（docs）**：設計書・本ファイル・`docs/dify/usecases/PT-09.md`・`docs/dify/platform-components.md`（3 行）。検証：`npm test`／`gen-index --check`
3. **PR-C（データ層）**：`catalog.js`（`pt9`）・`scenarios/mfg/pt.js`（`pt8` の閉じに `,` ＋ `pt9`）・`portal/svc.js`（`dc12` の閉じに `,` ＋ `pt9`）＋ `regress --update`・`npm run index`・`gen-seed` ＋ `docs/handoff/service-index.md`（1 行）・`docs/dify/usecases/README.md`（設計書 §7-3）・`docs/dify/implementation-guide.md` §3（§7-4。PT-09 を W6 に）。PR 本文に「設計書 §8 のデータ変更に伴う基準更新」

## PM 判断待ち（設計書 §12。推奨で進めてよいものは ✅）

- ✅ Q1 配置は `pt/service`（`po/staff` の PO-08 案は採らない）
- ✅ Q2 PT-10 を採番せず PT-09 の `mode=debrief` に含める（5 軸 3/5 の線なので確認だけ欲しい。保留にするなら `desc` の 1 文を削る）
- ✅ Q3 世界の年は 2025 年／✅ Q4 応募者の匿名 ID は新体系 `C-YY-NNN`
- ⚠️ **Q5 役職の段階から「駐在員」を外し「担当・主任」を入れた**（依頼時の例と違う）
- ✅／⚠️ Q6 PT-09 は当社が履歴書の原文を受け取る経路。デモは推奨で進めてよい、実装着手は顧客法務の確認が条件
- ⚠️ **Q7 `CLAUDE.md` §6 の件数（既に main とずれている。本件で 88・製造 56）は本 Issue で触らない**（別の S レーンの PR）
- ✅ Q8 希望給与は金額で出さない（PT-05 は変えない）／✅ Q9 実装の波は W6／✅ Q10 有名ユースケースのネット裏取りは任意（Cowork）
