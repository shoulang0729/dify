# システム運用監視（カタログ 4 サービス）／システム稼働状況（ポータル 1 画面）を取り込む

> `gh` が使えない環境のため、Issue 本文をファイルに出す（`CLAUDE.md` §4 architect の作法）。
> **PM が起票したら、番号を設計書 §0 の冒頭に追記する。**

- **設計書**：`docs/handoff/2026-09-11-sysops-usecase.md`（rev1）
- **レーン**：**M/L**（データ層・多言語辞書・トークン・ポータルの画面に触る）
- **ラベル**：`run:cloud`
- **関連**：`docs/handoff/2026-09-11-it-industry.md` ／ `docs/handoff/2026-09-11-portal-mock-pages.md` ／
  `docs/handoff/2026-09-10-portal-nocobase.md`（rev3・§4-13 F-8） ／ `docs/handoff/2026-09-11-bp-usecases.md`

---

## 何をするか（1 段落）

個別システムを運用監視しているソフトウェア（**運用監視ツール**）から状況を取り込み、**アプリ（カタログ）では
「システム運用監視」、ポータルでは「システム稼働状況」**として見せる。**同じ 1 つの機能の裏表**であり、
運用担当は従来どおり運用監視ツールを見て、**ユーザー・システム担当・CIO・CEO はポータルを見る**。
カタログに **4 サービス（SO-01〜SO-04）** を新設し、ポータルに **1 画面**を足す。

> **⚠️ 実在の運用監視製品名を、Issue・PR・コミットメッセージ・コード・データのどこにも書かない**
> （`CLAUDE.md` §2-10・PM 方針）。呼び方は「運用監視ツール」で統一する。

---

## 決めたこと（設計書 §0 の要約）

| | 結論 |
|---|---|
| 既存 77 件への統合 | **0 件**（最有力 3 件はいずれも 5 軸 2/5。SO-04 のみ QA-01 と 3/5 → ★PM 判断） |
| 新規サービス | **4 件**：SO-01 障害アラートの要約と初動案／SO-02 稼働状況の自然言語照会／SO-03 障害・稼働の定期報告／SO-04 障害報告・再発防止策のドラフト。すべて `st:3`・`industries:['it']` |
| 分類 | **新設 `so` システム運用・障害対応**（中分類 `so/incident`・`so/avail`）。14 分類 33 中分類 → **15 分類 35 中分類** |
| ポータル | **共通業務に 1 画面（`sys`）**。役割別は画面を分けずスコープで出し分け、CIO・CEO 向けの数字は **KPI K5** に足す |
| 状態の語彙 | **7 つ**。うち「サービス時間対象外」「夜間バッチ処理中」は**人が入力せずカレンダーから導出**。色は 4 つだけ |
| 取り込み | **Schedule ポーリング 5 分（無料）**を本命。重大度が高いものだけ **Auth: API keys ＋ REST 直書き**を任意併用。**Webhook トリガー（Professional+）は使わない** |
| 架空世界 | `data/world/it/systems.csv`（9 件）を新設。**新しい固有名詞 0 件**。障害番号 `INC-YYYY-NNN` を追加 |

---

## 受け入れ条件（詳細は設計書 §12）

**全 PR 共通**

- [ ] 実在の運用監視製品名が diff のどこにも現れない
- [ ] `CLAUDE.md`・`.claude/**`・`.github/workflows/**`・`dify/**`・`scripts/**` の diff が 0 行
- [ ] `npm test`（verify ＋ regress）が PASS

**PR-2（世界マスタ）**

- [ ] `data/world/it/systems.csv` 9 行。**新しい会社名・人名・拠点名が 0 件**（既存マスタと `PDEALS` の値だけ）
- [ ] `documents.csv` に `INC-YYYY-NNN`、`calendar.md` に「サービス時間とバッチ窓」の節
- [ ] `npm run world` の warn 件数が変わらない（12 件）

**PR-3（カタログのデータ層）** — architect が作業用コピーで実走した期待値

- [ ] `node tools/verify.mjs` が `✅ ALL PASS / ⚠️ 18 warn`（増える warn は「置き場所を決めていない: SO-01〜SO-04」の 1 件だけ）
- [ ] `node tools/regress.mjs --update` 後の counts が
      `{"cats":15,"subs":35,"svcs":81,"tags":66,"ui":91,"byIndustry":{"mfg":{"svcs":49,"cats":10},"fin":{"svcs":29,"cats":8},"it":{"svcs":25,"cats":7}},"svcsMulti":11}`
- [ ] `npm run index` で `docs/service-map.md` を再生成
- [ ] IT 業で「システム運用・障害対応」が出て、**製造業・金融業では 1 件も出ない**
- [ ] `--cat-so` を light と dark の**両方**に足した（`--ntt-*` は不変・dark ブロックは 1 つのまま）

**PR-4（ポータルの画面）**

- [ ] 共通業務の 2 番目に「システム稼働状況」（3 言語）。`portal.html` の `<script src>` は **37 本**（`sys.js` は `back.js` の後ろ）
- [ ] 状態が 7 種類出る。`offhours`／`batch` は**保存されていない**（導出）
- [ ] 時刻プリセット（平日 10:20／平日 22:40／休日 03:10）で**同じ 9 行の状態だけ**が変わる
- [ ] 「この画面の AI」に SO-01・SO-02・SO-04（`place` から自動生成）、KPI 画面に SO-03
- [ ] `portal.css` に色の直値 0 件・**新トークン 0 個**（既存 `--rag-*`／`--badge-concept-*` を使う）
- [ ] `PKPITOPIC` の diff は **K5 の 1 要素だけ**
- [ ] `regress` の差分が `SVCS.so1〜so4 place: (なし) → sys/kpi` の 4 行だけ

**PR-5（台本）**

- [ ] `scenarios/it/so.js` に 4 本（ja/zh）。`mfg`／`fin` の台本の diff は 0 行（逆流禁止）

---

## 触らない範囲（reviewer の diff 監査の基準。設計書 §2-2）

- `CLAUDE.md`・`.claude/**`
- `mock/catalog.html`・`mock/js/app.js`・`mock/js/render.js`・`mock/js/events.js`・`mock/css/components.css`
- `mock/css/tokens.css` の `--ntt-*`（dark ブロックは 1 つのまま）
- `mock/js/data/home.js`・`live.js`・`scenarios/mfg/**`・`scenarios/fin/**`
- 既存 77 件の `id`／`cat`／`sub`／`st`／`industries`／`tags`／`name`／`desc`／`place`／`added`
- `mock/js/data/portal/front.js`・`common.js`・`back.js`・`org.js`（`mgmt.js` は K5 の 1 要素だけ）
- `tools/verify.mjs`・`tools/regress.mjs`・`tools/gen-index.mjs`・`tools/check-world.mjs`（`regress.baseline.json` だけが変わる）
- `.github/workflows/**`・`dify/**`・`scripts/**`・`docs/demo/**`
- `docs/handoff/` の既存設計書（申し送りは本設計書 §14 に書くだけ）
- `docs/handoff/service-index.md`（既に 67 件表記のままずれている。**別の S レーン Issue**へ）
- `localStorage`（`mock.lang`／`mock.theme`／`mock.fav` の 3 つ。4 つ目を作らない）

---

## PR の分割案

| PR | 題 | 依存 |
|---|---|---|
| **PR-1** | 設計書と Issue 本文（`docs/handoff/**` のみ） | — |
| **PR-2** | `data/world/it/systems.csv` 新設＋`documents.csv`／`calendar.md`／`data/world/README.md` | PM 判断 Q8 |
| **PR-3** | カタログのデータ層（分類 `so`＋SO-01〜04＋タグ 2＋`--cat-so`＋`service-map` 再生成＋`regress --update` 1 回目） | **PM 判断 Q1・Q2・Q3** |
| **PR-4** | ポータルに「システム稼働状況」（画面・データ・導出・`place` 4 語＋`regress --update` 2 回目） | PR-2・PR-3 ／ **ポータル PR-3（台本ドロワー）のマージ後** |
| **PR-5** | IT の台本 4 本（`scenarios/it/so.js`） | PR-3・PR-4 |
| 後続（別 Issue） | 実装リファレンス `docs/dify/usecases/SO-01〜04.md` ／ `portal-nocobase` rev4 への反映 | PR-3 |

- **PR-2 と PR-3 は並列可**（ファイル集合が重ならない）。**PR-4 は `mock/js/data/catalog.js` を触るので PR-3 と直列**。
- **`regress --update` が 2 回になる理由**：`place` の値域は `PSCREENS` の画面 id で、`sys` 画面は PR-4 で初めて
  存在する。PR-3 で `place:'sys'` と書くと verify §17-c が **FAIL** する（設計書 §11-1）。
  **両 PR 本文に「設計書 §10-3 のデータ変更に伴う基準更新」と期待差分を書く。**

---

## ★PM 判断（着手前に要るのは 3 つ）

| # | 判断 | 推奨 |
|---|---|---|
| **Q1** | 分類 `so` を新設してよいか。コードは `so` か `sy` か（**承認した時点で SO-01〜04 が永久欠番になる**） | 新設する／`so` |
| **Q2** | SO-04 を新規採番するか（QA-01 と 5 軸 3/5 のため規則上 PM 判断） | 採番する |
| **Q4** | ポータルの画面は 1 枚か 2 枚か | **1 枚（共通業務）＋ホームの 1 ブロック＋KPI K5 の指標追加** |

（以下は「推奨のまま進めてよい」と言ってもらえれば止まらない：Q3 `industries` は `['it']` のみ／
Q5 状態は 7 つ・3 言語／Q6 デモは時刻プリセット 3 つ／Q7 SO-03 の `place` は `kpi`／
Q8 `systems.csv` を足す／Q9 `service-index.md` と `PSCREENS.ai.ct` のずれは別 S レーン Issue）
