# portal/env/ — 環境レイヤー（`dify/env/` と同じ作法）

`shoulang0729/dify` の `CLAUDE.md` §2-12 は「マスタ DSL にプレースホルダを入れない」と決めているが、
これは **Dify Cloud への URL インポートを壊さないため**の制約であり、一般則ではない。**`portal/` には
URL インポートが無いので、`portal/nocobase/export/**` と `portal/env/prod/portal.yml` に `${VAR}` を
書いてよい**（設計書 `docs/handoff/2026-09-11-repo-layout-v3.md` §2-4）。

適用するのは 3 つ：

1. **マスタ 1 本 ＋ 環境差分 1 枚。** NocoBase の定義（`portal/nocobase/export/**`）は環境間で共通、
   データソース名・閾値のキー名・既定値だけを `portal/env/<env>/portal.yml` に書く
2. **秘密は `${VAR}` でリポジトリの外**（`~/.config/portal/<env>.env`）
3. **環境台帳（この節）を env 定義と同じ PR で必ず更新する**

## 環境台帳

| env | 用途 | 接続先の種類 | 確認状態 |
|---|---|---|---|
| `demo` | `shoulang0729/dify` の `data/world/`（架空世界）を見るデモ・意識合わせ用インスタンス | ローカル docker（`run:mac`） | 未構築（PR-N2 は定義のみ） |
| `prod` | 部門内の実運用 | 社内サーバ ＋ 外部データソース（人事・勤怠・研修） | 未構築 |

## 書いてよい値／書いてはいけない値（`dify/env/README.md` と同じ表）

| 置く | 置かない |
|---|---|
| 構造・キー名・公開しても困らない既定値（`demo` はデータソース名・閾値のキー名を直値で書いてよい） | **実在の従業員・顧客の氏名、実際の勤怠・年休・研修データ** |
| データソース名（`hr` 等）・テーブル名・ロール名 | 本番の接続文字列・API キー・パスワード（`${VAR}` にする） |
| `demo` 環境の架空世界の値（`shoulang0729/dify` の `data/world/` 由来） | 顧客環境で採番された id を直値で書くこと |

`portal.yml` の値に `${NAME}` があれば流し込みスクリプトがプロセス環境変数で置換する（`--strict` で
未定義なら exit 1。`dify` 側 `render.py --strict` と同じ考え方）。変数名の一覧は `.env.example`。
