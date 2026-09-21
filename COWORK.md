# COWORK.md — Cowork でこのリポジトリを触るときの最初の一枚

> Cowork（Claude Desktop）でこのフォルダをアタッチしたら、**最初にこのファイルと `CLAUDE.md` §2（load-bearing）を読む。**
> Cowork は PM（ユーザー）の「作業台」であって、`CLAUDE.md` §4 のエージェント（architect / implementer / reviewer）ではない。
> Cowork にしかできないのは **ネット調査**。ここでやる仕事は「調査 → 画面案 → 台本ドラフト」までで、**成果物は実装ではなく設計の入力**。
> 運用の正本は `docs/handoff/2026-09-21-cowork-workflow.md`。

## 1. Cowork でやること／やらないこと

| やる | やらない |
|---|---|
| ネット調査（URL と取得日を残す。§5） | `git commit` / `git push`（サンドボックスから外へ出られない。手渡しは §7） |
| **台本**：`mock/js/data/scenarios/<業種>/<分類>.js` の既存サービスの `script`・`steps`・`input`・`result` の追加・修正（§3） | **新サービスの追加**（`mock/js/data/catalog.js` の `SVCS`/`CATS`、`ui.js` の辞書）。管理番号は永久欠番で `/usecase` が採番する（`CLAUDE.md` §2-11）。**候補は §6 の「提案」欄に書く** |
| **画面案**：`docs/artifacts/<slug>/index.html`（HTML アーティファクト）＋設計ドラフト（§4） | `render.js`・`components.css`・`tokens.css`・`app.js`・`events.js`・`js/portal/**`（画面案は architect が設計書に起こし、implementer が実装する） |
| `docs/**` の設計ドラフト・顧客提示資料・デモ進行台本 | `tools/**`・`CLAUDE.md`・`.claude/**`・`.github/**`・`tools/regress.baseline.json`・`docs/service-map.md`（生成物）。既存の設計書（`docs/handoff/YYYY-MM-DD-*.md`。architect が書いたもの）を書き換えない。修正案は手渡しメモに書く |
| `data/world/<業種>/**` の架空データの追加（§3 の世界ルール） | `dify/state/**`・`dify/results/**`（機械だけが書く）。実データ・秘密情報（§2-10）。Notion や調査結果の原文コミット |

迷ったら **触らずに §6 の手渡しメモに「提案」として書く**。

## 2. 作業中の約束（load-bearing の要約。正本は `CLAUDE.md` §2）

- 多言語辞書は **ja / zh / en 同時**。台本 `script` は ja/zh のみ（§3）
- `js/data/**` は **純粋なリテラル宣言だけ**
- 色は `var(--...)` のセマンティックトークン名で語る。`#RRGGBB` を書かない
- **同じファイルを Claude Code と同時に触らない**（ファイル集合が重ならなければ並列可。Cowork は `catalog.js`・`regress.baseline.json`・`service-map.md` を触らないので、通常は衝突しない）
- 作業を始める前に `main` を最新にしておく（PM が Mac で `git pull`）
- 検証が回るなら回す：`node tools/verify.mjs`（Node 22 が無ければ省略し、§6 の「検証」欄に未実行と書く）

## 3. 台本の書き方（地雷リスト）

手本：`mock/js/data/scenarios/mfg/qa.js` の **`qa1`**（upload 型。`persona` / `steps` / `input` / `result` / `script` が揃っている）。5 テンプレート（`qa` / `upload` / `form` / `diff` / `lookup`）の定義は `mock/js/data/ui.js` の `TEMPLATES`。

- **言語**：`script` は **ja/zh のみ**。`steps`・`persona.name/role/site`・`SVCS` の `name`/`desc` は **ja/zh/en 同時**（en はドラフトでよいが**空にしない**）
- **文字**：`q`/`a` の文字列に **`'`（U+0027）を使わない**（`’` か「」に置き換える）。リテラル内の `}` を**行頭に置かない**
- **構文**：`js/data/**` は純粋なリテラル。関数呼び出し・`document`・`localStorage` を書かない。**ファイル末尾の既存エントリには既に `,` が付いている**（追記時に二重にしない・欠かさない）
- **世界**：人名・設備・記録番号・数字は **`data/world/<業種>/**` にあるものだけ**使う。新しい名前・数字が要るときは**先に `data/world` に足す**。世界は混ぜない：製造＝青嶺精工／金融＝碧洋銀行／IT＝翠雲システムズ
- **表示**：`result` に **markdown の表を書かない**（描画側はエスケープするだけなので崩れる。箇条書きにする）
- **管理番号**：既存の `XX-NN` を変えない。台本は既存サービスの id にだけ付ける（新規は §1 の通り提案へ）

## 4. 画面案の出し方

- 画面案は **`docs/artifacts/<slug>/index.html`**（Pages には出ない。`pages.yml` は `path: mock`）に置き、あわせて **`docs/handoff/cowork/YYYY-MM-DD-<slug>.md` に 1 ページの設計ドラフト**を書く（§6 の雛形の「画面案」欄）
- ドラフトに必ず書くこと：
  1. **どの画面か**：`catalog.html` の `list` / `detail` / `chat` / `demo`（＋パターン ① `nav` ② `dash` ③ `feed`）、または `portal.html` の画面 id
  2. **何を変えたいか**（現状 → 案。レイアウト図か artifacts のスクリーンショット）
  3. **色はトークン名で**：`--surface-*` / `--text-*` / `--border-*` / `--action-*` / `--status-*` / `--badge-*`。`#RRGGBB` を書かない
  4. **`state` と `data-act` は変えない前提か**（変える案なら、その理由。M/L レーンになる）
- `render.js`・`components.css`・`tokens.css` は **Cowork では触らない**。ドラフトを architect が設計書に起こし、implementer が実装する（M/L レーン）
- 書式は既存の引き渡しメモ **`docs/handoff/2026-09-07-claude-design-handoff.md`** に揃える（「何のモックか」「層と触ってよい範囲」「変えたい点」の順）

## 5. ネット調査の扱い

- 調べた **URL と取得日**は手渡しメモの「参照」に必ず書く
- 実在の製品名・ベンダ名・企業名は **`docs/handoff/**` には書いてよい**が、**`mock/**`（台本・コメント含む）と `docs/demo/**` には書かない**（架空世界に置き換える）
- 調査結果の**原文はコミットしない**。要約と、架空世界への置き換えだけ

## 6. 終わったら「手渡しメモ」を必ず書く（これが無い変更は取り込まない）

`docs/handoff/cowork/YYYY-MM-DD-<slug>.md`：

```
# <お題>（Cowork 手渡しメモ）
- 目的：
- 触ったファイル：（パスを列挙。触っていない範囲も一言）
- 変更の要約：（台本なら 管理番号・テンプレート・追加したターン数）
- 画面案：（docs/artifacts/<slug>/index.html のパスと、対象画面・変更点・トークン名・state/data-act の扱い。無ければ「なし」）
- 提案（新サービス候補）：（仮タイトル／誰が使う（ペルソナ）／入力／出力／近い既存 3 件の管理番号。採番は /usecase に回す。無ければ「なし」）
- 検証：node tools/verify.mjs → PASS / FAIL（内容） / 未実行（理由）
- 参照：（URL と取得日、元にしたアーティファクト URL、Notion の場所）
- PM 判断が要る点：（あれば）
```

## 7. 手渡し（PM が Mac で行う）

```bash
git switch -c cowork/YYYYMMDD-<slug>
git add <触ったパス>            # -A は使わない（意図しないファイルを拾わない）
git commit -m "cowork: <slug>"
git push -u origin HEAD
```

取り込みはクラウドの Claude Code で **`/cowork-intake cowork/YYYYMMDD-<slug>`**。新サービス候補があれば別途 **`/usecase`** に回す。
