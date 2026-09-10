# dify/samples — デモ投入用の入力サンプル（④ダミーデータ）

`dify/samples/` は、デモ当日に実機（Dify Cloud）へそのまま貼り付けて投入する入力サンプルの正本です。
設計書 `docs/handoff/2026-09-09-demo-assets.md`（D1・D4・§3）に基づく規約をまとめます。

**この会社・人物・数値はすべて架空です。** 実在の企業・製品とは関係ありません。中身は `data/world/` に
登録済みの値だけを使います（`CLAUDE.md` §2-13）。新しい人名・品番・設備・文書番号・KPI が要るときは、
まず `data/world/` に足してください（別 PR）。

## 置き場と命名

```
dify/samples/
  README.md                                 このファイル
  <管理番号>/
    <管理番号>-S<2桁>-<slug>.md
  build/                                     生成物置き場（.gitignore 対象。現時点では未使用）
```

- **1 サンプル 1 ファイル**。ディレクトリ名は管理番号（`^[A-Z]{2}-\d{2}$`。`CLAUDE.md` §2-11）
- ファイル名は `<管理番号>-S<2桁>-<slug>.md`（`slug` は英小文字・数字・ハイフンのみ）
- **`S` 番号は追加順・永久欠番**。ディレクトリ内で重複しない
- **`id` は改名しない**。管理番号はディレクトリ名と一致させる

## フロントマター

```yaml
---
id: KN-01 S01                 # 必須。<管理番号> S<2桁>
app: KN-01                    # 必須。ディレクトリ名と一致
type: normal                  # 必須。normal | volume | edge
lang: ja                      # 必須。ja | zh（入力の言語。UI 言語ではない。CLAUDE.md §2-5）
industry: mfg                 # 必須。mfg | fin
mode: chat                    # 必須。chat | workflow（dify/tests/<番号>.json の mode と一致）
persona: 王 磊                 # 任意。data/world/<業種>/people.csv の name_ja
world:                        # 必須。使った正本のパス（data/world/ からの相対）。1 件以上
  - mfg/company.md
  - mfg/products.csv
query: "@body"                # mode: chat のとき必須（inputs は書かない）
points:                       # 必須。デモでどこを見せるか。1 件以上
  - 切削条件が数値で出る（速度・送り・ステップ・クーラント圧）
---

SUS304 の Φ8 深穴（深さ 60mm）ドリル加工、推奨条件を教えて
```

`mode: workflow` のときは `query` の代わりに `inputs:`（値のうち `@body` は 1 サンプルに高々 1 つ。本文全体を差す）を書きます。
`inputs` のキーは `dify/tests/<管理番号>.json` の `inputs` キーと完全一致させること（金融は実機 DSL が無いため
`docs/dify/usecases/<番号>.md` §4 の変数名に合わせる）。

- 本文（`---` の後ろ）は**そのままコピーして貼れるテキスト**。装飾の Markdown を足さない
- **`https://`・`http://` を書かない**（`CLAUDE.md` §2-10）
- 実在の企業・ホテル・航空会社・旅行代理店・人物の名前、実在サービス名を書かない

## 種別（`type`）

| `type` | 何を見せるか |
|---|---|
| `normal` | 台本どおりに動くこと（ja と zh を必ずペアで用意する） |
| `volume` | 長文・複数件があっても崩れないこと。新しい数字を作らず `data/world/` の登録値だけを使う |
| `edge` | 情報不足・該当なし・KB 外の質問に、推測で埋めず正直に答えること |

## 機械検証

`tools/verify.mjs` §16 が構造（16-a〜16-d・16-g・16-h）と実機テストとの整合（16-e・16-f）を検査し、
`tools/check-world.mjs` が `data/world/` との食い違いを報告します（warn のみ）。

- `dify/apps/<管理番号>-*.yml` が実在する管理番号（製造）は、`mode`・`inputs` キーが
  `dify/tests/<管理番号>.json` と一致しないと **FAIL** します
- `dify/apps/<管理番号>-*.yml` が実在しない管理番号（金融。W4 で実装予定）は、
  実機 DSL が無いことを **warn**「実機 DSL 未実装（W4 で投入予定）」として報告するだけです。
  金融の入力サンプルは①モックのデモ（`catalog.html`）で使う素材、②W4 実装時にそのまま
  `dify/tests/` と DSL の Start 変数へ移せる素材という位置づけで、この warn は**恒久的**に残ります
  （`docs/dify/implementation-guide.md` §3 の W4 が完了するまで）
- `dify/apps/*.yml` があるのに `dify/samples/<管理番号>/` が無い、または 3 件未満の管理番号は **warn** します
- `dify/samples/` そのものが無い場合は §16 を丸ごと skip します（このディレクトリが無くても `npm test` は通ります）

## 追加するときの手順

1. 書きたい人名・品番・設備・文書番号・KPI が `data/world/` に無いか確認する。無ければ**先に**`data/world/`
   へ追加する別 PR を出す（このリポジトリでは新しい名前・数字を先にマスタへ足す）
2. `dify/tests/<管理番号>.json` があれば `mode`・`inputs` キーをそこから確定する（無ければ
   `docs/dify/usecases/<番号>.md` §4 を見る）
3. `<管理番号>-S<2桁>-<slug>.md` を追加し、フロントマターと本文を書く
4. `node tools/verify.mjs`・`node tools/regress.mjs`・`npm run world` を実行し、warn が増えていないことを確認する
