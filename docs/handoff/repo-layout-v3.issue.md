# リポジトリ構成 v3 —— NocoBase ポータルを 1 リポに取り込む判断と、リファクタリングの棚卸し

- **設計書**: [`docs/handoff/2026-09-11-repo-layout-v3.md`](./2026-09-11-repo-layout-v3.md)
- **ラベル**: `run:cloud`
- **種別**: M/L
- **関連**: #84（構成 v2）・#242（ポータル分離）／設計書 `2026-09-10-portal-nocobase.md`・`2026-09-11-nocobase-research.md`・`2026-09-11-it-industry.md`・`2026-09-11-portal-mock-pages.md`

---

## 1. 結論（3 行）

- **`shoulang0729/portal` を `shoulang0729/dify` の `portal/` に取り込む（1 リポ）ことを推奨。**
- 分けた決定的理由 **R1（ランタイム境界）は「同じ `npm test` / 同じ `package.json`」の問題**であり、独立 npm プロジェクト＋独立ワークフローで境界は引ける。
- **代償は GitLab へ出す日の `git subtree split --prefix=portal` 1 回だけ。** 恒常コスト（3 本の手コピー・文書の二重管理・Issue 番号の 2 系統）を一回コストに替える取引。

**2 リポに戻すべき分岐条件は 2 つだけ**（設計書 §1-2）：
- **X-1** `portal/` を独立 npm プロジェクトにできない → 設計で満たせる
- **X-2** **GitLab 移行が半年以内に確実** → **PM しか判断できない。確実なら 2 リポのまま**

---

## 2. 受け入れ条件

### 本 Issue の PR-0（設計書のみ。本 PR）
- `node tools/verify.mjs` PASS（warn 16 件で不変）
- `node tools/regress.mjs` PASS（**差分ゼロ。`--update` 不要**）
- `npm run world` warn 11 件で不変
- diff は `docs/handoff/2026-09-11-repo-layout-v3.md` と `docs/handoff/repo-layout-v3.issue.md` の**新規追加 2 ファイルのみ**

### 後続 PR の受け入れ条件（設計書 §8・§9 に対応）
| PR | 受け入れ条件 |
|---|---|
| **PR-R1** | `tools/**` の業種ハードコード **8 か所**が `INDUSTRIES` 駆動になる／`regress.baseline.json` の `counts` が業種 map になる（**件数の値は不変**：cats 13・subs 29・svcs 67・mfg 49・fin 29・both 11・catsMfg 10・catsFin 8）／`npm run index` を再生成し verify §11-a PASS／`--update` は 1 回で PR 本文に理由を書く |
| **PR-R2** | `data/world/README.md` の人数が実数（mfg **20**／fin **17**）／「未統一」が **11 件**／`npm run world` の warn 件数は不変 |
| **PR-R3** | `CLAUDE.md` §6 の棚卸し（`top.html` 削除済み・`?v=` は存在しない・`bundle.mjs` は目的消滅・`scenarios/` 分割は閾値付きで先送り）／件数の手書き 4 ファイルを `docs/service-map.md` 参照に置換 |
| **PR-R4** | `verify.mjs` §17（17-a〜17-d）新設（`portal/` が無ければ skip）／節番号の採番規則を冒頭に明記（**§13 は永久欠番**）／CI 契約のずれを解消（`CLAUDE.md` §3 の記述 or `npm run ci` 新設） |
| **PR-N1** | `CLAUDE.md` 4 区分 → **5 区分**／`README.md` の見出しと表／**`tools/verify.mjs` §11-b のリテラル `## このリポジトリの歩き方（4 区分）`** の 3 つを**同じ PR で**。verify PASS |
| **PR-N2** | `portal/` 取り込み／`check-nodata.mjs` の走査範囲を `portal/**` に読み替え／`portal/scripts/gen-seed.mjs` と `portal/tools/check-seed-fresh.mjs`／`portal-verify.yml`（`paths: portal/**`）／**`portal/docs/split.md` の dry-run 結果を記録**／ルート `npm test` PASS かつ `npm run portal:test` PASS |
| **PR-N3** | `shoulang0729/portal` の PR #1 を close・リポジトリを archive（GitHub 操作） |

---

## 3. 触らない範囲（reviewer の diff 監査の基準）

**本 PR（設計書のみ）で触らないもの：**
- `mock/**`（データ層 `CATS`/`SVCS`/`TAGS`/`SCENARIOS`/`HOME`/`FEED`/`LIVE` を含む。**regress 差分ゼロ**）
- `tools/**`・`tools/regress.baseline.json`・`scripts/**`
- `dify/**`・`data/world/**`
- `.github/workflows/**`（特に `pages.yml` の `path: mock`。`CLAUDE.md` §2-8）
- `CLAUDE.md`・`README.md`・`.claude/**`（§6 は**提案**。適用は PM 承認後の PR-N1／PR-R3／PR-R4）
- **他 architect が並行編集中の 7 ファイル**：`2026-09-10-portal-nocobase.md` / `2026-09-11-nocobase-research.md` / `portal-nocobase.issue.md` / `2026-09-11-it-industry.md` / `it-industry.issue.md` / `2026-09-11-portal-mock-pages.md` / `portal-mock-pages.issue.md`

**後続 PR で触らないもの（共通）：**
- `mock/css/tokens.css` の `--ntt-*`（§2-2）・`localStorage` の許可集合（§2-6）・`SVCS[].id` の改名（§2-9/§2-11）・`pages.yml` の `path: mock`（§2-8）
- `portal/` を足しても **ルート `package.json` の `dependencies` はゼロ・`scripts.test` は `verify + regress` のまま**（§2-3 の「ビルド不要」の土台）

---

## 4. PR の分割案（流す順。設計書 §9）

```
PR-R1 (tools 業種ハードコード + baseline)  ─┐
PR-R2 (data/world/README 数値)             ─┴─ 並列可。IT 業 PR より前
      ↓
IT 業 PR-1 … PR-6（別 Issue。直列）
      ↓
ポータルモック Pages PR（別 Issue） ／ PR-R3（CLAUDE.md §6 棚卸し・件数参照化）
      ↓
PR-R4（verify §17 新設・節番号規則・CI 契約）   ← 取り込みの前に必ず
      ↓
PR-N1（CLAUDE.md 5 区分。※ PM 承認）
      ↓
PR-N2（portal/ 取り込み）
      ↓
PR-N3（portal リポ archive・PR #1 close）
```

**2 度手間になる逆順**（設計書 §9-1）：
- IT 業 PR を PR-R1 より先に流すと、`['mfg','fin','it']` を 8 か所書き足して直後に全部消すことになり、**途中で `regress` の検算（`svcsMfg + svcsFin − svcsBoth === svcs`）が FAIL する**
- 取り込み PR を PR-R4 より先に流すと、`portal-verify.yml` の欠落を検出できないまま数 PR 進む
- 取り込み PR に `CLAUDE.md`（PM 承認要）を混ぜると reviewer が load-bearing を照合できない

---

## 5. PM 判断待ち（推奨つき。設計書 §10）

| # | 論点 | 推奨 |
|---|---|---|
| 1 | 1 リポにするか | **する**（分岐条件 X-2＝GitLab 移行が半年以内に確実なら 2 リポのまま） |
| 2 | 4 区分 → 5 区分 | **⑤ポータルを増やす** |
| 3 | `CLAUDE.md` §2-14 を足すか | **足す（4 点だけ）** |
| 4 | CI 契約のずれの直し方 | **`npm run ci` を新設して YAML を数行にする** |
| 5 | ポータルモック Pages PR と IT 業 PR を並列にしてよいか | **両者が `mock/index.html` を触るかで決まる。触るなら直列** |
| 6 | 切り出し後 GitHub に public ミラーを戻すか | **戻さない。`shoulang0729/portal` は archive のまま残す** |
| 7 | `run:*` ラベルの 4 つ目 | **作らない。`run:mac` の定義文を広げる** |

---

## 6. 他 architect への申し送り（設計書 §11）

1. **rev2 §4-11 の「Professional ＋ 方式 (b)」が PM 判断（Community 確定）で成り立たない。** 連鎖：認証（LDAP）・定義移送（Migration Manager）・§8-5 のブロッカー
2. rev2 §7-4-3 N1 の「31 名（mfg 17 ＋ fin 14）」は**実数 37 名（20 ＋ 17）**とずれている
3. rev2 §6-1／§6-7 の「手コピー ＋ 出典行」は 1 リポで「**生成物 ＋ 鮮度検査**」に置き換わる
4. IT 業設計書：**`tools/**` の業種ハードコードは 5 か所ではなく 8 か所**（`gen-index.mjs` の 2 列固定・`check-world.mjs` のバケット固定を追加）
5. IT 業設計書：`gen-index.mjs` の列を動的にすると **`docs/service-map.md` の列構成が変わる**（`npm run index` の再生成が要る）
6. ポータルモック設計書：**`mock/index.html:265` の件数記述**を IT 業 PR も触る可能性がある
