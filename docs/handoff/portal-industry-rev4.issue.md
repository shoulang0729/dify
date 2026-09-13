# 部門ポータルの業種対応（rev4）—— 業種ごとに会社が替わる 3 つのポータルにする

- 設計書: **`docs/handoff/2026-09-12-portal-industry-rev4.md`**
- 前段（調査提案書・#293）: `docs/handoff/2026-09-12-portal-industry-fronts.md`
- 改訂する設計書: `docs/handoff/2026-09-11-portal-mock-pages.md` **§16（1 段落の参照）と §14 の注記 1 行だけ**
- レーン: **M/L** ／ 実行場所ラベル: **`run:cloud`**
- 基準: `origin/main` `d484ff7`（`SVCS` 82 件・`PSCREENS` 16 件・`PT` 73 キー）

PM 決定（2026-09-12）で #293 の推奨をすべて採用した。(a)(b) と Q1〜Q4 は決定済み。**PM 判断待ちはゼロ。**

---

## やること（8 行）

1. ポータルを「翠雲システムズ 1 社」から **業種ごとに会社が替わる 3 つの部門ポータル**にする。
   業種チップ（`.mockbar`・足場）で **会社・部門・ログイン中の人・見える画面・行データ・「この画面の AI」**がまとめて替わる。
2. **画面 id は 16 → 20。新設 4 枚（`qual` / `order` / `cred` / `reg`）、消える画面 0。**
   見えるのは 製造 17 枚 / 金融 16 枚 / IT 16 枚。
3. **`cust` を「顧客」→「取引先」に作り替え、全業種テンプレートにする**（PM 決定 (b)）。
   `watch`・`vend` は**フロント → 共通**へ移す。
4. **`sys` を業種テンプレートにし、製造では「設備の稼働状況」として出す**（PM 決定 Q3）。金融では出さない。
5. **`SVCS[].place` を 27 件付け替える。`'out'` は 18 件 → 0 件。**`industries` は 1 件も変えない。
6. **規則 1・規則 2 を撤回する**（PM 決定 Q1）。49 マス中 **11 マス**が「この画面の AI：0 本」になり、
   `PT.noScreenAi`（3 言語）で正直に出す。
7. **世界マスタに 49 行を先に足す**（PM 決定 Q4）。新しい番号体系は 1 つも作らない。
8. **`INDUSTRIES.mfg.dept`「情報システム部」を「製造二課」に直す**（`data/world/mfg/org.csv` に存在しないため）。

## 画面構成

| 区分 | 画面 id | 製造 mfg | 金融 fin | IT it |
|---|---|---|---|---|
| — | `home` | ● | ● | ● |
| フロント | `cust` 取引先 | ● 3 件 | ● 5 件 | ● 4 件 |
| フロント | `proj` 案件 | — | — | ● 10 件 |
| フロント | `qual` 品質・不具合 **新設** | ● 8＋4 | — | — |
| フロント | `order` 受注・出荷 **新設** | ● 5＋2 | — | — |
| フロント | `cred` 与信・審査 **新設** | — | ● 7 | — |
| フロント | `reg` 当局対応・レポート **新設** | — | ● 10＋4 | — |
| 共通 | `act` `sys` `meet` `know` `watch` `vend` `ai` | ●（`sys` は設備 6 件） | ●（`sys` なし） | ● |
| マネジメント | `kpi` `goal` `ppl` | ● | ● | ● |
| バック | `exp` `req` `trn` | ● | ● | ● |
| | **見える枚数** | **17** | **16** | **16** |

## 受け入れ条件（要点。全 46 件は設計書 §16）

- **AC-05 / AC-42** `npm run world` の warn が **12 件のまま**（増えない・減らない）
- **AC-12** 業種化した 23 定数の **`.it` の中身が `origin/main` と要素単位で一致**（IT の見え方を変えない）
- **AC-13** **`PKNOW` / `PKPITOPIC` / `PGOAL.topics` の diff がゼロ**
  （`tools/verify.mjs` §19-c が `data/world/it/*.csv` とバイト一致を見ている。業種化すると即 FAIL する）
- **AC-15** `INDUSTRIES.mfg.dept` を直しても `regress` に差分ゼロ
- **AC-29 / AC-30** `mock/js/data/catalog.js` の diff が **`place:` の 27 行だけ**。
  `regress` の差分も **27 行だけ**で **`counts` は 1 つも変わらない**
- **AC-31 / AC-32** 「この画面の AI」の件数が設計書 §11-3 の 49 マスと一致し、
  0 本の 11 マスで `PT.noScreenAi` が出る
- **AC-36** `pscn()` と `js/portal/demo.js` に `pstate.ind` が 1 つも無い（業種の解決は `pworldOf()` 1 か所）
- **AC-46** Playwright：**3 業種 × 49 画面 × 3 言語 × 2 テーマ = 294 通りで console error 0**、
  各画面の行数が設計書の表と一致、業種を替えて戻すと **AI の戻りが残っている**

## 触らない範囲（設計書 §1-3）

- `mock/js/data/scenarios/**`（台本 95 本）—— **1 バイトも触らない**（読むだけ）
- `mock/catalog.html`・`mock/js/{app,render,events}.js`・`mock/css/components.css` —— カタログの見え方は 1 ピクセルも変えない
- `mock/css/tokens.css` —— `--ntt-*` も dark ブロックも触らない。**新しいトークンを足さない**
- `mock/css/portal.css` —— **新しいクラスを足さない**（新画面 4 枚は既存クラスの組み合わせだけで作る）
- **`PKNOW` / `PKPITOPIC` / `PGOAL.topics`** —— verify §19-c のバイト一致（上記 AC-13）
- `portal/**`（⑤ポータル・NocoBase）—— **業種を DB の列にしない**。`npm run portal:test` は回さない
- `localStorage` —— `mock.lang` / `mock.theme` の 2 つのまま。**業種は保存しない**
- `dify/**`・`scripts/**`・`.github/workflows/**`・`CLAUDE.md`・`.claude/**`
- `docs/handoff/2026-09-11-portal-mock-pages.md` の §0〜§15 の本文（§16 の 1 段落と §14 の注記 1 行だけ）

## PR の分割案（7 本）

| PR | 題 | 大きさ | 主な受け入れ条件 |
|---|---|---|---|
| **PR-0** | 世界マスタへの追加（新 CSV 5 本・追記 1 本・**49 行**）：製造＝品質/受注の記録 19・取引先担当者 6／金融＝当局通達 10・与信案件 7・取引先担当者 5・仕入先 2 | **M** | AC-01〜AC-06 |
| **PR-A** | 画面台帳の業種化（`PSCREENS[].ind`/`lbl`/`ct`）＋`watch`/`vend` を共通へ＋ナビ絞り込み＋新 4 画面の殻＋`PT` 8 キー | **S** | AC-07〜AC-11 |
| **PR-B** | 行データ 23 定数の業種化＋`PCOMPANY`＋`pd()`＋`pstate` の業種別＋業種チップで `renderAll()`＋`INDUSTRIES.mfg.dept` | **L** | AC-12〜AC-19 |
| **PR-C** | `cust` を「取引先」テンプレートへ（`PPART`/`PQTR`/`PCONTACT`/`PHIST`） | **M** | AC-20〜AC-23 |
| **PR-D** | 新画面 4 枚の中身（`PQUAL`/`PORDER`/`PCRED`/`PREG`・`PCTXDEF` 4 キー・`PT` 14 キー） | **M** | AC-24〜AC-28 |
| **PR-E** | `place` 27 件＋オブジェクト形 4 件＋規則 1 撤回＋`V.ai` 作り直し＋`regress --update` 1 回 | **M** | AC-29〜AC-35 |
| **PR-F** | `pworldOf` の fallback＋規則 5・6 の文言＋`.mockbar` の `indNote` | **S** | AC-36〜AC-40b |

```
PR-0 ──> PR-A ──> PR-B ──┬──> PR-C ──┐
                          └──> PR-D ──┴──> PR-E ──> PR-F
                          （C と D だけ並列可）
```

- **PR-B が最大。**`mock/js/data/portal/**` のほぼ全ファイルに触るので他と並列にしない
- **`tools/verify.mjs` を触る PR は常に直列**（`CLAUDE.md` §5）。迷ったら全部直列でよい
- **`regress --update` は PR-E で 1 回だけ。**PR 本文に「設計書 §11-2 のデータ変更に伴う基準更新」と書く

## `tools/verify.mjs` §17 の改訂（設計書 §14-1）

- **改訂**：17-c（`place` のオブジェクト形）・17-e（`PORTAL_ONLY_KEYS`）・17-g（行 AI の id 実在）・
  17-l（**`pscreenAiIds`/`pcrossAiIds` に `industries` が「無い」→「ある」に反転**。`demo.js` の検査は維持）
- **新設**：17-m（`PSCREENS[].ind` の値域と `V[id]` の実在）・17-n（業種キーの揃い）・
  17-o（`PCOMPANY` と `FEED[].persona`）・17-p（**世界の混ざりの検出**）・17-q（列数の一致）
- **改訂不要**：17-a / 17-b / 17-d / 17-f / 17-h / 17-i / 17-j / 17-k

## 残課題（本件では直さない。別 Issue の候補）

- **R-1** IT の担当者 6 名が `data/world/{mfg,fin}/people.csv` の人物で、`CLAUDE.md` §2-13 の
  「跨いでよいのは社名と拠点名だけ」を越えている（rev4 が作った問題ではない）
- **R-2** `scenarios/mfg/pt.js` の 2026 年の日付（既知の未統一）
- **R-3** `goal` が 3 業種とも AI 0 本（カタログの穴）
- **R-4** LG-01 / GN-05 の `industries` が `['mfg']` のため金融・IT のホームに横断 AI が 0 本

---

## 進捗（2026-09-13 更新）

**PR-0 #299（`8227b78`）・PR-A #300（`5c48eff`）・PR-B #301（`62d619a`）マージ済み。PR-C・PR-D は未マージ。**
PR-B の reviewer 申し送りを設計書に **§18 追補**として記録した（本文 §0〜§17 は書き換えていない）。要点 3 つ：
① **§14-1 の「17-a 改訂不要」は誤りだった** —— §5-3 が `FEED[業種].persona` の流用を指示しているのに
`mock/portal.html` が `js/data/home.js` を読んでいなかったため、同 html への 1 行追加（`catalog.js` の後・`style.js` の前。
`CLAUDE.md` §2-3 の読み込み順と整合）と、verify §17-a の期待並び・`tools/lib/load.mjs` の `PORTAL_DATA_KEYS`（`FEED`）の
追随を #301 で行った（§1-2 の「変更する範囲」に `mock/portal.html` と `tools/lib/load.mjs` を読み替えで加える）。
② **`PORTAL_DATA_KEYS` に `PSYS`/`PSYSEV`/`PSYSST`/`PSYSNOW` が漏れていた**（#272 由来の既存バグ。§17-n の実装に必要なため #301 で修正）
—— **PR-C・PR-D は新設定数を `PORTAL_DATA_KEYS` と `PORTAL_ONLY_KEYS` の両方に足すこと**（片方だけだと検査が静かに素通りし、
AC-20〜AC-28 が機械で効かない）。③ **`cust` の `PQTR`/`PCUST` は PR-C まで業種化されない**ため、
製造・金融チップで `cust` に他世界の社名が残る（**設計どおりの中間状態**。§17-p は適用範囲外で FAIL しない。
解消の確認は PR-C の AC-20〜AC-23）。**受け入れ条件の本数は 46 件のまま変えていない。**

**進捗（2026-09-13 第 2 版）**：PR-C **#304** は差し戻し対応中（**18-5** `PPART.it` の `head`/`ai` を main と同じ値に戻す＝AC-22 優先、**18-7** 17-g の id 実在検査を 1 ブロックで実装）、PR-D **#303** は条件付き可（**18-6** AC-26 は PR-D では満たせないため **PR-E へ移す**。`app.js` の `pctxRow` に 4 分岐が要る）。**マージ順は #304 → #303**（どちらも `tools/verify.mjs` を触る）。詳細は設計書 **§18-5〜18-10**（進捗表の最新は **§18-9**）。受け入れ条件の本数は 46 件のまま。
