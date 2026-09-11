# CLAUDE.md — `portal/`（社内向けポータル。NocoBase Community）での作業ルール

**このファイルは切り出したときそのままルートの `CLAUDE.md` になる形で書いてある**（設計書
`shoulang0729/dify` `docs/handoff/2026-09-11-repo-layout-v3.md` §4-2 S-5）。`shoulang0729/dify` 側
`CLAUDE.md` の抜粋の丸写しはしない。重複する事項は「`shoulang0729/dify` の `CLAUDE.md` §X を見よ」とだけ
書く（同 S-4。二重管理を消すのが 1 リポの目的）。

## 0. `shoulang0729/dify` との関係（最初に読むこと）

**`portal/` は `shoulang0729/dify` の⑤ポータル**（同リポジトリ `CLAUDE.md` の 5 区分の 1 つ）であり、
別デプロイ単位である。別製品ではない。このポータルは `shoulang0729/dify` の
`docs/dify/platform-components.md` **PC-16 本番 UI (b)** の実装であり、サービスカタログ・管理番号・
env レイヤーと同じ製品に属する。設計の経緯は `shoulang0729/dify` の
`docs/handoff/2026-09-10-portal-nocobase.md`・`docs/handoff/2026-09-11-repo-layout-v3.md` にある
（**設計書はこのディレクトリには置かない。`shoulang0729/dify` の `docs/handoff/` だけに置く**）。

**共有するもの**（`shoulang0729/dify` が正本。`portal/` は従う側）：

| 資産 | 正本 | `portal/` での持ち方 |
|---|---|---|
| 管理番号（`KN-02` 形式）・サービスカタログ | `shoulang0729/dify` の `mock/js/data/catalog.js` | `seed/catalog.json`（**生成物**。§5） |
| 架空世界（`data/world/`。人名・部署・拠点・カレンダー等） | `shoulang0729/dify` の `data/world/`（mfg / fin / it の 3 世界） | `seed/world/`（**生成物**。§4） |
| 管理番号 → Dify アプリ id | `shoulang0729/dify` の `dify/env/cloud-master/env.yml` の `apps:` | `seed/apps.json`（**生成物**。§5） |
| ナレッジ・KPI・MBO の指標名 | `shoulang0729/dify` の `mock/js/data/portal/{common,mgmt}.js`（`PKNOW`／`PKPITOPIC`／`PGOAL`） | `seed/catalog.json`（**生成物**。§5） |

**方向は片方向（`shoulang0729/dify` → `portal/`）。逆流させない。** `portal/` 側で新しい人名・部署名・
数値・管理番号を発明しない。増やすときは `shoulang0729/dify` 側の正本に足してから、
`node scripts/gen-seed.mjs` で再生成する。理由は 2 つ：① 正本を 2 つにしない
（`shoulang0729/dify` `CLAUDE.md` §2-13 の精神）。② `shoulang0729/dify` 側には `verify.mjs`／
`regress.mjs`／`check-world.mjs` という語彙の検査があるが、このディレクトリの `seed/**` は
**手で直すと `check-seed-fresh.mjs` が次の CI で必ず落とす**（§5）。

**`shoulang0729/dify` 側 `CLAUDE.md` §2 load-bearing**（多言語辞書・CSS トークン・`mock/` 共通レイヤー・
`localStorage` の許可集合・Pages 設定・顧客版カタログ差し替え）は**このディレクトリには存在しない対象**
（`mock/` が無い）なので持ち込んでいない。持ち込んだもの・持ち込まなかったものの根拠は
`shoulang0729/dify` の設計書 `docs/handoff/2026-09-11-repo-layout-v3.md` §7 の表を参照。

---

## §1 このディレクトリの性質 —— 実データは 1 バイトも入らない

**いちばん大事なルール。** ここに入ってよいのは**「定義」**（画面・スキーマ・ロール・ワークフロー。
`nocobase/export/**`）と**「架空のデモデータ」**（`shoulang0729/dify` の `data/world/` 由来。
`seed/**`。**生成物**）と**設計書・構成・スクリプト**（`docs/**`・`env/**`・`nocobase/docker/**`・
`scripts/**`・`tools/**`）だけ。**実在の従業員・顧客・取引先の氏名、実際の勤怠・年休・研修データ、
本番の接続文字列・API キー・パスワードは 1 バイトも書かない。**

`shoulang0729/dify` は **public**。理由と背景は同リポジトリの設計書 §1・§7 を参照。public にする以上、
「実データが入らない」は運用のルールであるだけでなく**機械で見なければ破られる**。
→ `tools/check-nodata.mjs`（§3）。

**本番はこのディレクトリの定義から「空の定義」をデプロイし、中身（実データ）は別途投入する**（社内サーバ
への読み取り専用の外部データソース接続、または社内の流し込みスクリプト経由。`shoulang0729/dify` の
CI（`verify.yml`／`portal-verify.yml`）からは行わない。§6）。

---

## §2 `${VAR}` の作法

`shoulang0729/dify` 側 `CLAUDE.md` §2-12 は「マスタ DSL にプレースホルダ（`{{…}}`）を入れない」と
決めているが、これは **Dify Cloud への URL インポートを壊さないため**の制約であり、一般則ではない。

**`portal/` には URL インポートの制約が無い。** したがって**定義側（`nocobase/export/**`）に `${VAR}`
を書いてよい**。むしろ書くべき：

| 分類 | 例 | 書き方 |
|---|---|---|
| **秘密**（漏れると事故） | 人事・勤怠 DB の接続文字列、SSO のクライアントシークレット、Dify Service API キー、NocoBase の `APP_KEY`・DB パスワード | `${PORTAL_DSN_HR}` のように `${VAR}` で。値はリポジトリの外（`~/.config/portal/<env>.env`） |
| **秘密ではないが公開したくない値** | 年休取得率の通知閾値、所定労働時間・締め日 | 同上。`.env.example` に変数名だけを置く（値は入れない） |
| **公開してよい既定値** | データソース名 `hr`、テーブル名、ロール名、管理番号 | 直値で書いてよい（`${VAR}` にしない） |

`demo` 環境（`shoulang0729/dify` の `data/world/` の架空世界を見るインスタンス）の値は
`env/demo/portal.yml` に**直値で書いてよい**（架空だから）。**`prod`（本番）の値は書かない**
（`env/prod/portal.yml` は `${VAR}` だけ）。

変数名の一覧は `.env.example`・`nocobase/docker/.env.example`。実際の値は 1 つも書かない
（値はリポジトリの外）。未定義の `${VAR}` を黙って空文字にせず、流し込みスクリプトで exit 1 に
すること（`shoulang0729/dify` 側 `render.py --strict` と同じ考え方）。

---

## §3 Community（方式 (a)）の歯止め —— 初日に固定する 3 つ

**後から変えると DB の作り直しになる。** `portal/schema/README.md` と
`portal/nocobase/docker/.env.example` の**両方**に同じ値を書く（設計書 §2-3）：

| 設定 | 固定値 | 理由 |
|---|---|---|
| `DB_UNDERSCORED` | `true` | 後から変えると全テーブル作り直し |
| `DB_TABLE_PREFIX` | `nb_` | NocoBase のシステムテーブルと業務テーブルを名前で分離する唯一の見分け |
| 業務テーブルの主キー型 | `bigint GENERATED ALWAYS AS IDENTITY`（Flyway で明示） | NocoBase 既定の Snowflake ID を業務テーブルに持ち込まない。移行時に型が変わると FK が全部壊れる |

---

## §4 `data/world/` の扱い —— 正本は `shoulang0729/dify` 側。ここでは架空データを作らない

`shoulang0729/dify` 側 `CLAUDE.md` §2-13「架空データの正本は `data/world/`」をここ向けに読み替える：

> **正本は `shoulang0729/dify` の `data/world/`（mfg / fin / it の 3 世界）。`portal/` 側では新しい
> 人名・部署名・数値を作らない。** `seed/world/` は `node scripts/gen-seed.mjs` による**生成物**。

生成の作法・鮮度検査は §5・`seed/README.md` を参照。

---

## §5 `seed/` は生成物。手で編集しない

**2 リポで最も腐りやすかった「手コピー」を、`shoulang0729/dify` の `docs/service-map.md` と同じ型に
置き換えたもの。**

| | 旧設計（`shoulang0729/portal` PR #1） | **いま（このディレクトリ）** |
|---|---|---|
| 作り方 | 人が `data/world/**` を `seed/world/` へコピーし、`# source: … @ <sha>` を書き足す | `node scripts/gen-seed.mjs` が `data/world/**`・`mock/js/data/catalog.js`・
`mock/js/data/portal/{common,mgmt}.js`・`dify/env/cloud-master/env.yml` を読んで `seed/**` を**生成してコミット** |
| 鮮度の担保 | 無し（人が覚えている） | `node tools/check-seed-fresh.mjs` が再生成してバイト一致を見る。ずれたら FAIL |
| 正本の方向 | 規約（「逆流禁止」と書くだけ） | **機械。`seed/**` を手で直すと次の CI で必ず落ちる** |

**切り出し可能性との関係**：`gen-seed.mjs` はこのディレクトリの外（`../data/world/` 等）を読むが、
**生成物 `seed/**` はコミットされている**ので、`portal/` を切り出した後も単体で動く。切り出した時点で
`check-seed-fresh.mjs` は「正本が無い」として **skip**（FAIL ではない）に落ちる（設計書 §4-2 S-1）。

---

## §6 検証コマンド（PR 前に必ず実行）

```bash
npm ci
npm test                                # = check-nodata.mjs && check-seed-fresh.mjs
node scripts/gen-seed.mjs               # seed/** を再生成（コミットする）
node scripts/gen-seed.mjs --check       # 再生成して現行 seed/** とバイト一致するか（--update せず検査だけ）
node tools/check-nodata.mjs --strict    # warn（N1〜N3）も含めて 1 件でも FAIL（掃除の PR 用）
node tools/check-nodata.mjs --update    # 設計書に書かれた意図的な変更のときだけ baseline を更新
```

`tools/check-nodata.mjs` が何を検査するか（G1〜G5・N1〜N6・拾えるもの／拾えないもの）は同スクリプトの
冒頭コメントと `docs/nodata-known.md`（warn の台帳）を参照。**`shoulang0729/dify` 側の
`tools/check-world.mjs` と同じ allowlist 方式**（allowlist は `seed/world/` から機械生成。禁止語
リストは作らない）。

**1 つでも FAIL があればマージしない。** `--update` するときは PR 本文に理由を書く。

---

## §7 3 エージェント分業（`shoulang0729/dify` 側 `CLAUDE.md` §4 と同じ）

作業は **architect → implementer → reviewer** の3エージェント分業で進める。

| | やる | やらない |
|---|---|---|
| **PM（ユーザー）** | プロダクト判断・モック承認 | — |
| **architect** | 設計書（`shoulang0729/dify` の `docs/handoff/`）・Issue | アプリコードを書く／`.claude/` を触る |
| **implementer** | feature ブランチで設計通りに実装・検証・PR | `docs/handoff/` を変える／設計判断／`main` 直 commit |
| **reviewer** | 検証・diff 監査・load-bearing 照合・マージ | 検証 FAIL のまま承認／自分で直す |

設計判断に迷ったら architect に返す。**S/M-L のレーン判定は `shoulang0729/dify` 側と同じ考え方**
（文言・余白程度なら軽量、データ層・秘密・構造に触るなら重量）。

---

## §8 Git 運用（`shoulang0729/dify` 側 `CLAUDE.md` §5 と同じ）

- `main` 直 commit 禁止。`feat/<issue>-<slug>` 等でブランチを切る → PR → **squash マージ** → ブランチ削除
- 1 Issue = 1 ブランチ = 1 PR。コミットメッセージ・PR 本文は意味のあるものに
- **`portal/**` とそれ以外はファイル集合が重ならないので並列可**（`shoulang0729/dify` `CLAUDE.md` §5）。
  ただし `CLAUDE.md`・`README.md`・`tools/verify.mjs`（`shoulang0729/dify` 側）を触る PR は常に直列
- 設計書は `shoulang0729/dify` 側の `docs/handoff/YYYY-MM-DD-<slug>.md` に置く（**設計の正本は
  `shoulang0729/dify` 側にある**。このディレクトリの `docs/` には設計書を置かない。§0）
- 本番デプロイはこのディレクトリの CI（`portal-verify.yml`）からは行わない（§1）。社内サーバ側で
  `git pull` ＋ 流し込みスクリプトを回す

---

## §9 実行場所

`shoulang0729/dify` 側 `CLAUDE.md` §7 の `run:cloud`／`run:runner`／`run:mac` をそのまま使う
（**4 つ目のラベルは作らない**。PM 判断。設計書 §10 判断 7）。`portal/` の設計・実装・検査は
`run:cloud`、docker を実際に動かすのは `run:mac`（同 §7 の `run:mac` 定義文が「PM の手元でしか
動かせないもの（ブラウザのログイン済みセッション／ローカル docker）」に広がっている）。

---

## §10 このディレクトリでまだ作っていないもの

このディレクトリは骨組みの段階（PR-N2＝定義とファイルだけ）。NocoBase 本体を実際に起動しての
collection 定義・エクスポート、勤怠・年休・研修・お知らせの架空データの投入はまだ無い。段取りは
`shoulang0729/dify` の設計書 `docs/handoff/2026-09-10-portal-nocobase.md` §8・§12-2、
`docs/handoff/2026-09-11-repo-layout-v3.md` §10-1 を参照。
