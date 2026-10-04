---
description: Cowork で作られた cowork/<branch> を取り込む。手渡しメモを起点に許可範囲の照合・検証・レーン判定を行い、台本/docs/world なら PR、画面案なら architect へ。新サービス提案は /usecase へ回す。
---

対象ブランチ: $ARGUMENTS

Cowork（PM の作業台）の成果を `CLAUDE.md` の流れに壊さず合流させる。**手渡しメモが無ければ何もせず止まる。** 各ステップの結果を短く報告し、停止条件に当たったら PM（ユーザー）に判断を求める。

## 0. 取得と前提確認

```bash
git fetch origin
git switch -c intake/<slug> origin/$ARGUMENTS   # $ARGUMENTS は cowork/YYYYMMDD-<slug>
git log --oneline origin/main..HEAD
git diff --name-only origin/main...HEAD
```

- ブランチ名が `cowork/` で始まらない → 停止
- `docs/handoff/cowork/YYYY-MM-DD-<slug>.md` が diff に無い → **停止**。「手渡しメモがありません。`COWORK.md` §6 の形式で追加してから再実行してください」

## 1. 手渡しメモを読む

8 欄（目的／触ったファイル／変更の要約／画面案／提案／検証／参照／PM 判断が要る点）を読み、**「触ったファイル」と `git diff --name-only` が一致するか**照合する。不一致（メモに無いファイルが変わっている）は停止して報告。

## 2. 許可範囲の照合（`COWORK.md` §1・設計書 §3）

diff に次のいずれかが含まれていたら **停止**（Cowork が触ってはいけない範囲。PM 判断で別 Issue に切り出す）:
`mock/js/data/catalog.js`・`mock/js/data/ui.js`・`mock/js/data/home.js`・`mock/js/data/style.js`・`mock/js/app.js`・`mock/js/render.js`・`mock/js/events.js`・`mock/js/portal/**`・`mock/css/**`・`mock/*.html`・`tools/**`・`CLAUDE.md`・`.claude/**`・`.github/**`・`docs/service-map.md`・`dify/state/**`・`dify/results/**`・`dify/apps/**`・`dify/env/**`

許可されるのは `mock/js/data/scenarios/**`・`docs/**`（`service-map.md` 除く）・`docs/artifacts/**`・`data/world/**` のみ。

## 3. 検証

```bash
node tools/verify.mjs
node tools/regress.mjs
npm run index:check
```

- `regress` が FAIL → **停止**（許可範囲の変更では件数は変わらない。`--update` はしない）
- `verify` の FAIL のうち、次だけは直してよい：多言語辞書の欠落（`steps`/`persona` の `en` 空を**モック用ドラフトの英語で補う**。`CLAUDE.md` §2-1）／`js/data/**` に紛れた関数呼び出し・`document` 参照をリテラルへ／`q`/`a` 内の `'`（U+0027）を `’` へ。それ以外の FAIL は停止
- `index:check` が FAIL → `npm run index` を実行してコミットに含める

## 4. 台本のセルフチェック（`COWORK.md` §3）

`scenarios/**` に変更があれば：`script` が ja/zh のみ／`result` に markdown 表が無い／人名・設備・番号が `data/world/<業種>/**` に存在する（無ければ **停止**して「world に追加が要る」と報告）／世界の混在が無い（青嶺精工＝mfg、碧洋銀行＝fin、翠雲システムズ＝it）／`mock/**` に実在の製品名・企業名が無い。

## 5. 振り分け

- **台本・docs・world のみ** → **S レーン**。受け入れ条件を 1〜3 行書いて 6 へ
- **画面案（`docs/artifacts/**` と設計ドラフト）を含む** → 画面案は実装しない。`architect` サブエージェントに依頼：
  > Cowork の画面案 `docs/artifacts/<slug>/index.html` と設計ドラフト `docs/handoff/cowork/<memo>.md` を読み、`docs/handoff/YYYY-MM-DD-<slug>.md` に設計書を起こして Issue を立てて。`state`・`data-act` を変える案なら M/L として PM 判断待ちにして。
  台本や docs の変更が同じブランチに同居していれば、それらだけを S として 6 へ進め、画面案は architect の設計書に委ねる旨を PR 本文に書く
- **「提案（新サービス候補）」が空でない** → 採番・追加はしない。PM に「`/usecase` に回す候補」として仮タイトル・ペルソナ・入出力・近い既存 3 件を列挙して報告する

## 6. PR 作成

`intake/<slug>` を push し、`origin/main` 向けに PR。ラベルは **`run:cloud` のみ**。本文テンプレ：

```
## 出所
- Cowork 手渡しメモ: docs/handoff/cowork/YYYY-MM-DD-<slug>.md
- 元ブランチ: cowork/YYYYMMDD-<slug>

## 変更要約
（メモの「変更の要約」を転記。台本は 管理番号・テンプレート・追加ターン数）

## 取り込み時に直したこと
（3 で直した内容。無ければ「なし」）

## 画面案 / 提案の扱い
- 画面案: architect へ（設計書パス or 「なし」）
- 新サービス候補: /usecase へ（件数 or 「なし」）

## 検証
- verify: PASS / regress: PASS（基準更新なし） / index:check: PASS

## 触っていない範囲
catalog.js, ui.js, app/render/events.js, css/**, tools/**, CLAUDE.md, .claude/**, .github/**, regress.baseline.json, service-map.md（再生成のみ）
```

`gh` が使えない環境では PR 本文を `docs/handoff/cowork/<slug>.pr.md` に書いて止まり、PM に push と PR 作成を依頼する。

## 7. reviewer へ

`reviewer` サブエージェントに依頼：
> PR #<番号> を検証して。`verify.mjs` / `regress.mjs` を実行し、diff を手渡しメモ `docs/handoff/cowork/...md` と `CLAUDE.md` の load-bearing に照合。全 PASS かつ逸脱なしなら squash マージしてブランチ（`intake/` と `cowork/` の両方）を削除し、Pages 反映を確認して報告して。reject なら理由を具体的に。

**停止条件**：reject されたら理由を PM に報告し、自動で再実装ループに入らず指示を待つ。
