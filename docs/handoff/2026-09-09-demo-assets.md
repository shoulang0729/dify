# デモ資材一式（入力サンプル・KB 増量・実機デモ台本・顧客提示資料）

- レーン：**M/L**
- architect 成果物。**`mock/**`・`scripts/**`・`tools/**` のコードは書いていない**（実装は implementer）
- 関連：`docs/dify/implementation-guide.md` §3（Wave）§5-3（ダミーの作り方）／`data/world/README.md`／`dify/README.md`／`dify/DEPLOY.md` §5-6（KB 運用）／`CLAUDE.md` §2-8 §2-10 §2-11 §2-13 §7
- 並行作業：Issue #195（PR-1 文書 4 本・PR-1b `dify-ops.yml`＋`scripts/dify/`）。**本設計はそのファイル集合に一切触らない**（§10-3）

---

## 1. 目的と背景

PM の依頼：「アプリのデモのためにデモ用の資材もたくさん作ってもらいたい」。選択肢の確認の結果、**A〜D の 4 種すべて**・**製造と金融の両方**が対象と決まった。

| # | 資材 | いまの状態 | 本設計で作るもの |
|---|---|---|---|
| **A** | 入力サンプル | **置き場すら無い（0 件）** | `dify/samples/<管理番号>/` に **63 本**（製造 12 アプリ×4／金融 5 サービス×3） |
| **B** | KB 文書 | 4 アプリ・**11 本** | **+20 本 → 31 本**（製造 4 アプリを各 5〜6 本へ／金融 KN-06・KN-08 を新設） |
| **C** | 実機デモ進行台本 | 無い | `docs/demo/runbook-mfg.md`・`runbook-fin.md`（司会台本。ja/zh 併記） |
| **D** | 顧客提示資料 | 無い | `docs/demo/briefing-catalog.md`・`briefing-coverage.md`・`faq.md` |

### 1-1. いまの棚卸し（本設計で確認した事実）

- `dify/apps/` **12 本**：DC-01 DC-02 DC-04 GN-01 GN-02 GN-05 KN-01 KN-02 KN-03 LG-01 LG-04 NM-03。**すべて製造（`mfg`）**
- `dify/kb/` **11 本**：KN-01(3) KN-02(3) KN-03(3) GN-01(2)。KB を使うのはこの 4 本だけ（残り 8 本は Knowledge Retrieval を持たない Workflow）
- `dify/tests/` 12 ファイル × 4 件 ＝ **48 件**。`mode` は KN-01/02/03 が `chat`、残り 9 本が `workflow`
- `dify/samples/` **存在しない**
- `data/world/` mfg 14 ファイル・fin 13 ファイル。`npm run world` の warn は **10 件**（mfg 8／fin 2）で `data/world/README.md` の「未統一」表と 1 対 1
- `tools/verify.mjs` の節番号：§1〜§12・§14・§15 使用中、**§13 は #121 W2（`dify/state/`）用に予約**。→ 本設計は **§16** を使う

### 1-2. 金融側の非対称（この設計の中心的な前提）

**金融には投入先の Dify アプリが 1 本も無い。** `docs/dify/implementation-guide.md` §3 の **W4 が金融第一陣（KN-06・KN-08・DC-09・RS-01・RS-03）** で未着手。したがって：

| | 製造（mfg） | 金融（fin） |
|---|---|---|
| A 入力サンプルの用途 | **実機 12 本にそのまま投入する**（デモ当日に使う） | **① モックのデモ（`catalog.html`）で口頭・画面に出す素材 ② W4 実装時にそのまま `dify/tests/` と DSL の Start 変数へ移せる素材** |
| A の検証 | `inputs` のキーが `dify/tests/<番号>.json` と**一致**すること（FAIL 判定） | 対応する DSL が無いので**キー一致は検査できない → warn**（`docs/dify/usecases/<番号>.md` §4 の変数名に合わせる） |
| B KB の用途 | 実機 KB に投入して検索デモの母数を増やす | **W4 で投入する素材**。今回は Git に置くだけで**実機には投入しない** |
| C デモ台本 | `runbook-mfg.md`＝**実機の司会台本** | `runbook-fin.md`＝**モック中心の司会台本**。冒頭に「実機は W4 で用意する」と明記 |
| D 顧客資料 | カバレッジ表で「実装済み」と表示 | カバレッジ表で「**素材あり・実機未実装（W4）**」と表示。実装済みと同じ見え方にしない |

**この非対称は隠さず、`docs/demo/README.md`・`briefing-coverage.md`・`runbook-fin.md` §0 の 3 か所に明記する。**

---

## 2. 決定事項（D1〜D9）

### D1. 置き場と命名 — `dify/samples/<管理番号>/`

```
dify/samples/
  README.md                                 規約（フロントマターの仕様・種別・追加手順）
  KN-01/
    KN-01-S01-sus304-deep-hole-ja.md
    KN-01-S02-sus304-deep-hole-zh.md
    KN-01-S03-similar-symptom-history-ja.md
    KN-01-S04-out-of-kb-question-zh.md
  KN-02/ … GN-02/ …（製造 12）
  KN-06/ … RS-03/（金融 5）
  build/                                    生成物（.gitignore。D3。今回は作らない）
```

- **1 サンプル 1 ファイル**。ファイル名 `<管理番号>-S<2桁通番>-<slug>.md`（slug は英小文字・数字・ハイフン）
- **S 番号は追加順・永久欠番**（`CLAUDE.md` §2-11 の考え方をそのまま適用）。テストの `T<2桁>` と同じ体系で、`S` と `T` で用途が区別できる
- **id は改名しない**。管理番号（ディレクトリ名）は `SVCS[].id` から機械変換した値そのもの

**却下した案**：`dify/tests/` に混ぜる（テストは合否判定の資材で、デモ資材と目的が違う。`run_tests.py` が拾ってしまう）／`docs/demo/inputs/`（`docs/` は人が読む文書の場所で、`kb_upload.py` や将来の投入スクリプトから機械で参照しにくい）。

### D2. 4 区分での帰属 — `CLAUDE.md` 冒頭の定義側を直す提案

| 新しい置き場 | 属する区分 | `CLAUDE.md` 冒頭の変更 |
|---|---|---|
| `dify/samples/**` | **④ダミーデータ**（`data/world/`・`dify/kb/`・`dify/tests/` と同列。架空世界の値だけで作る、実データを置かない、`check-world` の走査対象） | **必要**（④の列挙に追加） |
| `docs/demo/**` | **③ユースケース・シナリオ**（`docs/` は既に③） | **推奨**（③の説明に `docs/demo/` を明示。無くても矛盾はしないが「デモ運用・顧客資料」は既存の「設計書・実装リファレンス」のどちらでもない） |
| `scripts/demo/**`（D3 で今回は作らない） | **②実装ソース**（`scripts/` は既に②） | 不要 |

**architect は `CLAUDE.md` を書き換えない。以下を PM 承認事項として提案する**（§11 PM 判断待ち P1）。承認後 **PR-1 で implementer が適用**する。

```diff
-③ユースケース・シナリオ＝`docs/`（設計書・実装リファレンス）・`mock/js/data/scenarios/`（デモ台本）
+③ユースケース・シナリオ＝`docs/`（設計書・実装リファレンス・`docs/demo/` のデモ進行台本と顧客提示資料）・`mock/js/data/scenarios/`（モックのデモ台本）
-④ダミーデータ＝`data/world/`（架空世界マスタ）・`dify/kb/`・`dify/tests/`
+④ダミーデータ＝`data/world/`（架空世界マスタ）・`dify/kb/`・`dify/tests/`・`dify/samples/`（デモ投入用の入力サンプル）
```

§2-13 の対象一覧にも 1 語だけ足す（新しい節は作らない。samples に課すルールは §2-13 と同一だから）：

```diff
-台本（`mock/js/data/scenarios/**`）・KB 用文書（`dify/kb/**`）・テスト（`dify/tests/**`）・ユースケース文書はここにある値だけを使う。
+台本（`mock/js/data/scenarios/**`）・KB 用文書（`dify/kb/**`）・テスト（`dify/tests/**`）・入力サンプル（`dify/samples/**`）・ユースケース文書はここにある値だけを使う。
```

トップ `README.md` の「4 区分」表も同じ 2 行を直す。**`tools/verify.mjs` §11-b が 4 区分節のリンク実在を検査するので、`dify/samples/` と `docs/demo/` は README を直す PR（PR-1）で同時に実在させる。**

### D3. バイナリ — **置かない。テキストが正本。画像生成は今回のスコープ外**

**結論：リポジトリに画像・PDF・Office ファイルを 1 つも置かない。サンプルはすべて UTF-8 の Markdown。**

理由（強い順）：

1. **実機の 12 本は現時点でファイル入力を使っていない。** `GN-01` の `claim_file`・`GN-02` の `invoice_file` は Start 変数としては存在するが、`dify/tests/GN-01.json`・`GN-02.json` の全ケースが `null` を渡して合格している（`GN-02.json` の `source` に「最小構成〔`invoice_text` のみ、三点照合の Code なし〕」と明記）。**発票デモは「OCR 済みテキストを貼る」経路で完結する。画像を置いても現状は誰も使えない**
2. **reviewer が diff を読めない資材は load-bearing の検査ができない**（`CLAUDE.md` §4：「PR の主張を信じて diff を見ない」を禁じている）。バイナリは §2-13 の「`data/world/` の値だけを使う」を人も機械も検査できない
3. リポジトリ肥大。`git clone` は 3 エージェント全員が毎回行う
4. `docs/dify/implementation-guide.md` §5-3 が既に「ファイルは生成スクリプトで作る…**スクリプトを残し、成果物はコミットしない**」と決めている。本設計はこの既存決定に従うだけ

**`file://` でのモック動作への影響：無い。** `mock/js/data/**` は純粋リテラル宣言のみで（§2-3）`dify/` を参照しない。Pages の公開対象は `mock/` だけ（§2-8）。`dify/samples/` に何を置いても公開サイトの挙動・サイズは変わらない。影響するのは clone サイズと diff 可読性だけ。

**将来 OCR 経路の実機デモが要るとき**は、別 Issue で `scripts/demo/render_samples.py`（フロントマターの `render:` ブロックから PNG/PDF を生成 → `dify/samples/build/` へ出力、`.gitignore` に追加）を作る。Pillow 等の新規 Python 依存が要るので **PM 判断**（§11 P3）。`dify/build/` と命名を揃えて `build/`（`_` 始まりにしない。§2-8 の禁止は `mock/` 配下だが紛らわしさを避ける）。

### D4. 量 — A 63 本 / B +20 本

**A 入力サンプル：63 本**

| 対象 | 件数/アプリ | 合計 | 種別の内訳（`type`） |
|---|---|---|---|
| 製造 12 アプリ（実機あり） | **4** | 48 | `normal` 2（ja 1・zh 1）／`volume` 1／`edge` 1 |
| 金融 5 サービス（W4 素材） | **3** | 15 | `normal` 2（ja 1・zh 1）／`edge` 1 |

- **必ず ja と zh を両方含む**（§2-5：エージェント本体は日中どちらの入力も受ける、を人前で見せるため）
- `volume` ＝ 長文・複数件（「効いている感」を出す。日報 3 日分・発票 5 枚分など）
- `edge` ＝ 情報不足・該当なし・KB 外（**推測で埋めない**ことを見せる。実機で最も評価される挙動）
- 上限を 4 に抑えた理由：PM の要望は「3〜5 件」。**1 PR あたり 20〜24 ファイルが reviewer の限界**（全ファイルを目で読み、`data/world/` と突き合わせる必要がある）

**B KB：11 → 31 本**

| 管理番号 | 現在 | 後 | 追加内容（3 類型を必ず 1 本ずつ） |
|---|---|---|---|
| KN-01 | 3 | **6** | ①隣接ノイズ ②横断根拠 ③版違い |
| KN-02 | 3 | **6** | 同上 |
| KN-03 | 3 | **6** | 同上 |
| GN-01 | 2 | **5** | 同上 |
| KN-06（金融・新設） | 0 | **4** | 手続マニュアル 2・FAQ 台帳 1・隣接ノイズ 1 |
| KN-08（金融・新設） | 0 | **4** | 当局通達 新版・旧版・要約台帳・隣接ノイズ |

追加の 3 類型（**検索デモで「効いている感」を出すための型**。単に本数を増やすのではない）：

1. **隣接ノイズ**：問いと同じ語を含むが答えではない文書。→ 検索が正しく外すことを見せる
2. **横断根拠**：答えが 2 文書にまたがる文書。→ 複数の根拠を引用して答えることを見せる
3. **版違い／別言語版**：新旧の版、または ja/zh の対。→ 版ズレの注意喚起（KN-03 の既存の売りと整合）を見せる

金融 KB を KN-06・KN-08 に限る理由：W4 の 5 件のうち KB（Knowledge Retrieval）が本体なのはこの 2 件だけ。DC-09（テンプレ選択）・RS-01（ニュース収集）・RS-03（IR 要約）は入力サンプルが本体で KB は要らない。

### D5. 機械検証 — `tools/verify.mjs` に **§16** を新設＋`check-world.mjs` の走査対象を拡張

**§13 は #121 W2 で予約済み、§14・§15 は使用中。→ §16 を使う。**

#### 16. デモ資材（`dify/samples/**`）の契約

`dify/samples/` が無ければ節ごと skip（PR-1 より前でも `npm test` が通る）。`dify/samples/build/` は `.gitignore` 対象なので走査から除外。

| # | 検査 | 判定 |
|---|---|---|
| 16-a | ディレクトリ名が `^[A-Z]{2}-\d{2}$` で、`SVCS` に実在する管理番号（§2-11 の逆変換 `KN-06`→`kn6`） | **FAIL** |
| 16-b | ファイル名が `^<管理番号>-S\d{2}-[a-z0-9-]+\.md$`。`S` 番号がディレクトリ内で重複しない | **FAIL** |
| 16-c | 先頭に `---` で囲まれたフロントマターがあり、必須キー `id` `app` `type` `lang` `industry` `mode` `world` `points` を持つ。`id` ＝ `<管理番号> S<2桁>`、`app` ＝ ディレクトリ名、`type` ∈ `{normal, volume, edge}`、`lang` ∈ `{ja, zh}`、`industry` ∈ `{mfg, fin}`、`mode` ∈ `{chat, workflow}`、`points` が 1 件以上 | **FAIL** |
| 16-d | `mode: chat` は `query` を持ち `inputs` を持たない。`mode: workflow` は `inputs` を持ち `query` を持たない。`inputs` の値のうち `@body`（本文を差す指示子）は高々 1 つ。`@body` があるとき本文が空でない | **FAIL** |
| 16-e | `dify/apps/<管理番号>-*.yml` が実在するとき：`mode` が `dify/tests/<管理番号>.json` の `mode` と一致し、**`inputs` のキー集合が `dify/tests/<管理番号>.json` に現れる `inputs` キーの集合と完全一致**（YAML パーサ不要。テスト JSON が Start 変数を写している） | **FAIL** |
| 16-f | `dify/apps/<管理番号>-*.yml` が実在しないとき（金融 5 件） | **warn**「実機 DSL 未実装（W4 で投入予定）」 |
| 16-g | `world:` に列挙したパスが `data/world/` に実在（例 `mfg/products.csv`）。1 件以上 | **FAIL** |
| 16-h | 本文・フロントマターに `https?://` の生 URL が無い（§2-10） | **FAIL** |
| 16-i | `dify/apps/*.yml` がある管理番号に `dify/samples/<管理番号>/` が無い、または 3 件未満 | **warn** |

**フロントマターのパーサは自前の最小実装**（`---` 行で挟まれた `key: value`／`key:` + `  - item` のリスト／`key:` + `  subkey: value` の 1 段ネスト）。YAML ライブラリは入れない（依存パッケージ 0 を維持する。`package.json` は変更しない）。

#### `tools/check-world.mjs` の拡張（**これが「`data/world/` の値だけを使っているか」の答え**）

**新しいツールは作らない。`check-world.mjs` の走査対象に `dify/samples/**` を 1 系統足すだけ。** 既存の振り分け（ファイルパスから管理番号を抜き、`SVCS[].industries` で mfg/fin/both に分ける）がそのまま効く（ヘッダのコメント：`dify/kb/**`・`dify/tests/**`・`docs/dify/usecases/**` と同じ扱い）。

- 検査 W1（人名）・W3（拠点）・W6（文書番号）・W7（品番・設備）・W8（KPI）・W9（カバレッジ）がサンプル本文に効く
- W2・W4・W5 は台本本体（`mock/js/data`）が入力なのでサンプルの追加では動かない
- **`--strict` は使わない**（`CLAUDE.md` §2-13：warn のみ・CI に入れない）。受け入れ条件は「**warn の総数を増やさない**」（§9）

**KB 側の追加文書に対する静的検査は増やさない。** 検討したが実データで成立しないことを確認した：
- 「テストの `expect` 語が KB 内でちょうど 1 文書に現れる」→ **現状で既に不成立**（KN-01 の `TR-2024-007` は 3 文書、`18`・`20` は 3 文書）
- 「KB に `expect_not` の語が現れない」→ **現状で既に不成立**（KN-01 に `m/min`・`mm/rev`・`150`、KN-02 に `スライドを上死点へ` が正当に存在する。`expect_not` は文脈依存の禁止語であって KB の禁止語ではない）

したがって KB 増量の安全性は **実機の回帰テスト**で担保する（D6・§12）。

### D6. KB 増量の副作用 — **削除ゼロで済む。歯止めには当たらない**

- `scripts/dify/kb_upload.py`（フラグ無し）は **同名文書をスキップして新規だけ追加する**。今回の増量は**既存文書を 1 本も書き換えない・消さない**ので、`op: kb_refresh`・`op: kb_replace` は**使わない**
- したがって **K1〜K8 の歯止め（`MAX_DELETE = 5` 等）には一切当たらない**（`delete_document()` を通らない）。`kb_replace` の「`codes` は 1 件のみ」制約も無関係
- 実行は `op: kb_upload` に `codes: KN-01 KN-02 KN-03 GN-01`（4 件同時可）

**`dify/tests/*.json` の期待語が壊れないか：静的には検査できない（D5）。以下の 3 段で守る。**

1. **設計上の歯止め**：追加文書は「隣接ノイズ」「横断根拠」「版違い」の 3 類型に限り、**既存文書がヒットしている問い（＝既存 4 ケースの `query`/`inputs`）に対して既存文書より上位に来る記述を書かない**。具体的には、既存の根拠 id（`TR-2024-007` 等）と同じ数値・条件を追加文書に**繰り返して書かない**（言及するときは「詳細は `TR-2024-007` を参照」と参照だけにする）
2. **実機の回帰**：投入後に `op: run_tests` を `KN-01 KN-02 KN-03 GN-01` で回し、結果を `dify/results/cloud-master/` に残す
3. **FAIL したときの直し方**：**期待語は緩めない・消さない。追加した文書のほうを直す**（表現を薄める／`edge` 寄りの記述を削る）。それでも直らなければ**その追加文書を取り下げる**

**2 と 3 は `run:runner` の作業なので、本 Issue（`run:cloud`）には含めない。** `CLAUDE.md` §7「`run:*` は 1 つだけ。2 つ付くのは Issue を分割する合図」に従い、**PR-5・PR-6 マージ後に PM が別 Issue（`run:runner`）を起票する**（§12 に文面案）。

### D7. C・D の体裁 — `docs/demo/` に 6 ファイル。`SCENARIOS` とは別物であることを明記

```
docs/demo/
  README.md               デモ資材の地図（A/B/C/D がどこにあるか・当日の持ち物・金融の非対称）
  runbook-mfg.md          C 製造：実機 12 本の司会台本（ja/zh 併記）
  runbook-fin.md          C 金融：モック中心の司会台本（ja/zh 併記）
  briefing-catalog.md     D カタログの見せ方（13 分類 29 中分類 67 サービス／P1・P2・P3／管理番号）
  briefing-coverage.md    D 実装済み 12 本のカバレッジと Wave（次に何を作るか）
  faq.md                  D 想定質問と答え
```

**C がモックの `SCENARIOS` と混ざらないための境界**（`docs/demo/README.md` 冒頭と各 runbook §0 に明記）：

| | モックの `SCENARIOS`（`mock/js/data/scenarios/**`） | C 実機デモ台本（`docs/demo/runbook-*.md`） |
|---|---|---|
| 何 | **画面に表示される会話データ**（コード） | **人が読み上げる司会進行の手順書**（文書） |
| 誰が読む | ブラウザ（`renderDemo`） | デモの司会者 |
| 対象 | 73 サービス（LLM 未接続のダミー応答） | 実機 12 本（Dify Cloud の本物の応答） |
| 言語 | `script` は ja/zh（`steps` は ja/zh/en） | 読み上げ文を ja/zh 併記 |
| 置き場 | ③（`mock/` 配下＝コード） | ③（`docs/demo/`） |
| 依存 | `TEMPLATES`・`state` | `dify/samples/`・`LIVE`（`mock/js/data/live.js`）・`dify/KNOWN_ISSUES.md` |

**`runbook-*.md` の見出し構成（両ファイル共通。implementer はこの順で書く）**

```
§0 このデモの前提
    - 所要時間 / 参加者 / 使う環境（cloud-master のみ）/ 見せる URL の範囲
    - 禁止事項：顧客の実データを入力しない・実名を口にしない（CLAUDE.md §2-10）
    - 【金融版のみ】実機アプリは未実装。今日はモック（catalog.html）で見せる。実機は W4 で用意する
§1 事前チェック（開始 15 分前）
    - チェックリスト（LIVE の URL が開くか／KB のインデックスが完了しているか／回答が定型文でないか）
    - 落ちていたときのフォールバック（モックの該当サービスの demo テンプレに切り替える）
§2 進行表（時間割）
    | 時刻 | 何を | 使うサンプル | 分 |
§3 各アプリのターン（1 アプリ 1 節。12 節 / 金融は 5 節）
    §3-N <管理番号> <サービス名>
      - 投入するサンプル：dify/samples/<番号>/<番号>-S01-….md（type: normal, lang: ja）
      - 読み上げ（ja）：「…」
      - 读稿（zh）：「…」
      - 見せどころ（サンプルの points をそのまま）
      - 想定質問と答え（2〜3 問。詳細は faq.md へ）
      - 所要：N 分
§4 うまくいかなかったときの逃げ道
      - 症状 → 原因 → その場の言い方 → 参照（dify/KNOWN_ISSUES.md の DI-xxx）の表
§5 片付け
      - 会話ログの扱い／顧客に URL を渡すかの判断基準（CLAUDE.md §2-10：架空データだけの環境か）
```

**`briefing-catalog.md`（D）の見出し**：①このカタログは何か ②13 分類の意味と 29 中分類 ③成熟度（提供中／試行版／構想）の定義 ④3 つの見せ方 P1 ナビ／P2 ダッシュボード／P3 業務フィード ⑤管理番号の読み方（`KN-02`）⑥言語切替とお気に入り ⑦顧客版への差し替え方（データ層だけ。§2-9）

**`briefing-coverage.md`（D）の見出し**：①実装済み 12 本の表（管理番号・できること・KB 有無・入力サンプル数・実機 URL の有無）②Wave 表 W1〜W7 の要約と現在地 ③**「今できること／まだできないこと」**（AI は登録しない＝`implementation-guide.md` §2）④金融の現在地（**素材あり・実機未実装**）⑤次に作るもの（W3・W4）

**`faq.md`（D）**：30 問前後。分類は 精度／言語／セキュリティ・越境（PIPL）／費用・モデル／導入手順／既存システム連携／運用（誰が KB を保守するか）。**回答に実在サービス名を書かない**（§2-10）。

### D8. 金融資材の置き場 — `dify/kb/` に置く。ただし「未投入」を README で明示

金融 KB を `dify/kb/KN-06/`・`dify/kb/KN-08/` に置く（`docs/service-map.md` の ④KB 列に件数が出る）。DSL 列は `—` のままなので「**KB 素材はあるが実機未実装**」と正しく読める。誤読を防ぐため **`dify/kb/README.md` を新設**し、管理番号ごとに `投入済み（cloud-master）` / `未投入（W4 待ち）` を書く。実機の事実の正本は `dify/state/<env>.yml`（#121 W2）であり、この README は**設計側の意図**を書く場所だと明記する（§7 の「設計値と実機の事実をファイルで分ける」）。

### D9. 並列可否 — サンプル PR 3 本は並列可。KB PR 2 本は直列

**`docs/service-map.md` に「入力サンプル」列を足さない。** 足すと `tools/gen-index.mjs` の変更に加え、サンプルを追加する **PR-2・PR-3・PR-4 が全部 `docs/service-map.md` で衝突し、並列が不可能になる**（`verify` §11 が鮮度を検査するため各 PR で再生成が必要になる）。サンプルの件数は §16-i が機械で見るので索引に出す必要が無い。**列の追加が欲しくなったら全 PR マージ後に別 Issue で行う。**

同じ理由で `dify/samples/README.md` には**件数の一覧表を持たせない**（規約と手順だけ）。

一方 **KB を増やす PR-5・PR-6 は `docs/service-map.md` の ④KB 列が変わるので再生成が必須**。両者が同じファイルを触るので **PR-5 → PR-6 の直列**とする。

---

## 3. 入力サンプルのファイル仕様

### 3-1. フロントマター

```
---
id: KN-01 S01                 # 必須。<管理番号> S<2桁>
app: KN-01                    # 必須。ディレクトリ名と一致
type: normal                  # 必須。normal | volume | edge
lang: ja                      # 必須。ja | zh（入力の言語。UI 言語ではない。§2-5）
industry: mfg                 # 必須。mfg | fin
mode: chat                    # 必須。chat | workflow（dify/tests/<番号>.json の mode と一致）
persona: 王 磊                 # 任意。data/world/<業種>/people.csv の name_ja
world:                        # 必須。使った正本のパス（data/world/ からの相対）。1 件以上
  - mfg/company.md
  - mfg/products.csv
  - mfg/documents.csv
query: "@body"                # mode: chat のとき必須（inputs は書かない）
points:                       # 必須。デモでどこを見せるか。1 件以上
  - 切削条件が数値で出る（速度・送り・ステップ・クーラント圧）
  - 根拠の技術報告番号が引用される
  - 同じ問いを中国語で聞いても同じ数値が返る（S02 と対にして見せる）
---

SUS304 の Φ8 深穴（深さ 60mm）ドリル加工、推奨条件を教えて
```

`mode: workflow` のときは `query` の代わりに：

```
inputs:
  invoice_text: "@body"       # @body は 1 サンプルに高々 1 つ。本文全体を差す
  invoice_file: null
```

- **`inputs` のキーは `dify/tests/<管理番号>.json` の `inputs` キーと完全一致させる**（§16-e。金融は `docs/dify/usecases/<番号>.md` §4 の変数名）
- 本文（`---` の後ろ）は**そのままコピーして貼れるテキスト**。装飾の Markdown を足さない
- **`https://`・`http://` を書かない**（§2-10・§16-h）

### 3-2. 種別ごとの書き方

| `type` | 何を見せるか | 書き方 |
|---|---|---|
| `normal` | 台本どおりに動くこと | `SCENARIOS` の該当サービスの `script` 1 往復目と同じ主題。`points` に「数値が出る」「根拠が引用される」 |
| `volume` | 量があっても崩れないこと | 日報 3 日分・発票 5 枚分・議事録 40 分など。**数値はすべて `data/world/` の登録値**。新しい数字を作らない |
| `edge` | 推測で埋めないこと | 情報不足・該当なし・KB 外。`points` に「聞き返す／該当なしと答える」ことを書く |

### 3-3. 割り当て（製造 12 アプリ × 4 ＝ 48）

`mode` は `dify/tests/<番号>.json` から確定済み。`inputs` キーも同じく確定済み。

| 管理番号 | mode | inputs キー | S01 normal ja | S02 normal zh | S03 volume | S04 edge |
|---|---|---|---|---|---|---|
| KN-01 | chat | （query） | 深穴加工条件 | 同じ問いを zh | 過去の類似症状を横断で聞く(ja) | KB 外の質問(zh) |
| KN-02 | chat | （query） | アラーム E-47 復旧手順 | 同内容を zh | 同時発生した 2 コードの優先順位(ja) | 未登録型式の質問(zh) |
| KN-03 | chat | （query） | 年次有給の条文 | 同内容を zh | ja 版・zh 版の版ズレ確認(ja) | 個別事情の判断を求める(zh) |
| DC-01 | workflow | period, site, kpi_notes, lang | 月次報告 ja | 同じメモで lang=zh | 3 か月分のメモをまとめて | KPI が 1 つも書かれていないメモ |
| DC-02 | workflow | transcript_text, meeting_title, lang | 会議の生メモ ja | 生メモ zh | 40 分・4 名の長い議事 | 決定事項が無い雑談メモ |
| DC-04 | workflow | source_text, kind, tone | 5S 掲示物 ja→zh | 改善提案 zh | 掲示物 5 枚分 | 出典不明の安全標語 |
| GN-01 | workflow | claim_text, claim_file, lang | 出張旅費の精算 ja | 接待費の精算 zh | 1 か月分 8 件 | 規程に条文が無い費目 |
| GN-02 | workflow | invoice_text, invoice_file | 発票 1 枚 ja | 発票 1 枚 zh | 発票 5 枚 | 発票番号が読めない |
| GN-05 | workflow | text, purpose, lang | 通達の要約 ja | 長文レポート zh | 3 文書の連結 | 中身が箇条書き 3 行だけ |
| LG-01 | workflow | source_text, direction, style, glossary | 手順書 ja→zh | 報告文 zh→ja | 用語集つき長文 | 社内用語が未登録 |
| LG-04 | workflow | purpose, recipient, points, lang, tone | 督促メール ja | 詫びメール zh | 論点 8 個の長いメール | 相手も目的も未記入 |
| NM-03 | workflow | text, lang | 日報 1 日分 ja | 日報 1 日分 zh | 週報（5 日分） | 数字が欠けた日報 |

### 3-4. 割り当て（金融 5 サービス × 3 ＝ 15）＋ `fin` W9 の解消

`mode` と `inputs` キーは `docs/dify/usecases/<番号>.md` §4 から取る（実機 DSL が無いため §16 は warn になる）。

| 管理番号 | サービス | S01 normal ja | S02 normal zh | S03 edge | 使うペルソナ（`data/world/fin/people.csv`） |
|---|---|---|---|---|---|
| KN-06 | 事務手続の照会 | 出張旅費の上限照会 | 同内容を zh | FAQ に無い個別事情 | **林 静**（営業第二部 主管）・韓 雪 |
| KN-08 | 当局通達・ガイドライン DB | 新旧通達の差分 | 同内容を zh | 通達番号の指定が誤り | **中野 隆**（リスク統括部 調査役） |
| DC-09 | 議案・報告書のドラフト | 稟議のドラフト | 報告書のドラフト zh | テンプレートに合わない依頼 | **鄭 麗華**（財務部 担当） |
| RS-01 | ニュース収集と配信 | 監視条件の登録 | 条件を zh で登録 | 条件が広すぎて件数過多 | **徐 涛**（システム部 担当） |
| RS-03 | 顧客 IR・決算の要約 | 決算資料の要約 | 同内容を zh | 数値表が壊れている | **潘 婷**（大連支店長）・**石田 由美**（経営企画部 日本本店担当） |

**この 6 名は `npm run world` の fin W9 warn（`data/world/README.md` の未統一 ⑩「どこにも出てこない人物 6 名」）そのもの。** サンプルにペルソナとして登場させることで **fin の warn が 2 件 → 1 件、合計 10 件 → 9 件に減る**。`data/world/README.md` の未統一表は**行数が warn 件数と一致する契約**なので、**PR-4 で ⑩ の行を削除する**（`fin — 2 件` の見出しを `fin — 1 件` に直す）。

---

## 4. KB 増量の目録（B）

各文書の冒頭に既存文書と同じ体裁のメタ表（項目｜内容：型式・出典・適用ライン・更新・区分）を置く。文書番号は `data/world/<業種>/calendar.md` の「文書番号の体系」に登録済みの書式だけを使う。**新しい書式が要るときは実装を止めて PM/architect に返す**（§8）。

| 管理番号 | 追加 3 本の役割 | 具体 |
|---|---|---|
| **KN-01** | ①隣接ノイズ ②横断根拠 ③版違い | ①別材質（SUS316）の工程条件書＝同じ語彙で違う条件 ②材料ロット受入記録（不具合報告と突き合わせて初めて答えが出る）③作業標準書の**旧版**（改訂前の寸法公差） |
| **KN-02** | 同上 | ①別型式（`PX-350`／`PX-100`）のアラームコード表 ②保全作業記録（アラーム発生履歴。手順書と突き合わせる）③取扱説明書 第 8 章（第 7 章と章違い） |
| **KN-03** | 同上 | ①出張旅費規程（就業規則と語彙が重なる別規程）②36 協定・時間外の運用細則（就業規則の条文と対で読む）③員工手册の**旧版**（改訂前の年次有給日数。KN-03 の売りである版ズレ検出の実演材料） |
| **GN-01** | 同上 | ①接待費の運用 Q&A（規程本体とは別文書）②精算の差戻し事例集（規程条文と対で読む）③经费规程 第 5 章（交通費。既存の 1-4 章・6 章の隙間） |
| **KN-06**（新設） | 手続 2・FAQ 1・ノイズ 1 | 事務手続マニュアル（申請フロー）／出張旅費の運用細則／社内 FAQ 台帳（`INQ-YY-NNNN`）／別支店の運用メモ（ノイズ） |
| **KN-08**（新設） | 新版・旧版・台帳・ノイズ | 当局通達 `NTF-2026-013` 新版／同 旧版／通達要約台帳／関連するが対象外の通達（ノイズ） |

**歯止め（D6-1 の具体化）**：追加文書には、既存 `dify/tests/<管理番号>.json` の `expect` に出る**数値・条件をそのまま繰り返して書かない**。触れる必要があるときは「詳細は `TR-2024-007` を参照」の形で**参照だけ**にする。

---

## 5. `docs/demo/README.md` の内容（地図）

1. このディレクトリは何か（デモの**運用**資材。モックのコードでも設計書でもない）
2. A/B/C/D の対応表（`dify/samples/`・`dify/kb/`・`runbook-*.md`・`briefing-*.md`）
3. **モックの `SCENARIOS` との違い**（D7 の表をそのまま）
4. **金融の非対称**（§1-2 の表をそのまま）
5. デモ当日の持ち物チェックリスト
6. 資材を足すときの手順（`dify/samples/README.md` へ・`data/world/` に無い値は足さない）

---

## 6. 変更する範囲

| ファイル | 変更 | PR |
|---|---|---|
| `CLAUDE.md` | 冒頭 4 区分の③④に 1 語ずつ・§2-13 に 1 語（**PM 承認後のみ**） | PR-1 |
| `README.md`（トップ） | 4 区分表の③④の「置き場」列に `docs/demo`・`dify/samples` を追加 | PR-1 |
| `tools/verify.mjs` | **§16 を新設**（冒頭コメントのチェック項目一覧にも追記） | PR-1 |
| `tools/check-world.mjs` | 走査対象に `dify/samples/**` を追加（冒頭コメントも） | PR-1 |
| `dify/samples/README.md` | 新規（規約） | PR-1 |
| `dify/samples/<管理番号>/*.md` | 新規 63 本 | PR-1(4) / PR-2(24) / PR-3(20) / PR-4(15) |
| `docs/demo/README.md` | 新規 | PR-1 |
| `data/world/README.md` | 未統一表 fin ⑩ の行を削除、件数を 2→1・10→9 に | PR-4 |
| `dify/kb/{KN-01,KN-02,KN-03,GN-01}/*.md` | 新規 12 本 | PR-5 |
| `dify/kb/README.md` | 新規（投入済み／未投入の台帳） | PR-5 |
| `dify/kb/{KN-06,KN-08}/*.md` | 新規 8 本 | PR-6 |
| `docs/service-map.md` | `npm run index` で再生成（KB 件数の変化） | PR-5・PR-6 |
| `docs/demo/runbook-mfg.md`・`runbook-fin.md` | 新規 | PR-7 |
| `docs/demo/briefing-catalog.md`・`briefing-coverage.md`・`faq.md` | 新規 | PR-8 |

---

## 7. 触らない範囲（reviewer はここを diff 監査の基準にする）

**1 行でも diff に出たら差し戻し。**

- **`mock/**` すべて**（`catalog.html`・`css/**`・`js/**`・`js/data/**`・`js/data/scenarios/**`・`index.html`）。デモ資材はモックの外にだけ作る
- **`dify/apps/*.yml`**（12 本すべて。#195 が KN-01・KN-02・KN-03・GN-01 を触っている）
- **`dify/env/**`**（`cloud-master/env.yml` を含む。#195）
- **`dify/tests/*.json`**（期待語は緩めない・消さない。§2-13／`CLAUDE.md`）
- **`dify/results/**`・`dify/state/**`**（機械だけが書く。§7）
- **`scripts/dify/**`・`.github/workflows/**`**（#195 PR-1b）
- **`dify/DEPLOY.md`・`dify/KNOWN_ISSUES.md`・`dify/env/README.md`・`docs/dify/decisions-pending.md`**（#195 PR-1）
- **`tools/regress.mjs`・`tools/regress.baseline.json`・`tools/gen-index.mjs`**（データ層は変えない。索引の列も足さない＝D9）
- **`package.json`**（新しい npm script も依存も足さない）
- **`.claude/**`**
- `data/world/` の**マスタ本体（csv・md）**。値の追加が要ると分かったら**止まって返す**（§8）。PR-4 が触るのは `README.md` の未統一表だけ

---

## 8. implementer への申し送り（止まる条件）

以下に当たったら**実装を続けず、PM と architect に返す**。

1. サンプル／KB に書きたい**人名・品番・設備・文書番号・KPI が `data/world/` に無い**（§2-13：まず正本に足す。正本の追加は別 PR・別レビュー）
2. `dify/tests/<番号>.json` の `inputs` キーと合わせるとサンプルが不自然になる（＝DSL の Start 変数が足りない可能性。DSL は触らない）
3. `npm run world` の warn が**増える**
4. `CLAUDE.md` の変更が PM 未承認（PR-1 の `CLAUDE.md` 差分だけを外して他を進める）

---

## 9. 受け入れ条件

### 全 PR 共通

- `npm test`：**ALL PASS**。warn は既知の 2 件（§9 台本の無い SVCS 5 件／§14 LIVE 未登録 12 本）に加え、**§16 由来の warn だけ**が増える
  - PR-1 直後：§16-i「`dify/apps/` があるのに samples が無い/3 件未満」11 件＋§16-f 0 件
  - PR-3 完了後：§16-i **0 件**
  - PR-4 完了後：§16-f **15 件**（金融 5 サービス。「実機 DSL 未実装（W4）」）。これは**恒久 warn**として `dify/samples/README.md` に理由を書く
- `npm run world`：**warn 合計が増えないこと**
  - PR-1〜PR-3・PR-5〜PR-8 後：**10 件**（mfg 8／fin 2）
  - **PR-4 後：9 件**（mfg 8／fin 1。W9 の 6 名が解消）。`data/world/README.md` の未統一表の行数が 9 になっていること
- `node tools/regress.mjs`：**PASS**（データ層は不変。`--update` は使わない）
- diff に §7「触らない範囲」のファイルが 1 つも無い

### PR ごと

| PR | 追加の受け入れ条件 |
|---|---|
| PR-1 | `tools/verify.mjs` 冒頭コメントに §16 の説明がある／`§13 は #121 W2 用に予約`のコメントが残っている／`dify/samples/` を消しても `npm test` が PASS する（skip が効く）／README 4 区分のリンク先が実在（§11-b PASS）／`package.json` 不変 |
| PR-2・PR-3 | 48−4＝44 本すべてが §16-a〜16-h を満たす／各アプリ 4 本に ja 1 以上・zh 1 以上・`edge` 1 本が含まれる／`inputs` キーが `dify/tests/` と完全一致（§16-e が FAIL しない） |
| PR-4 | 15 本すべてが §16-a〜16-d・16-g・16-h を満たす／§3-4 の 6 名が全員登場する／`npm run world` の fin warn が 1 件／`data/world/README.md` の件数表記を 2→1・10→9 に更新 |
| PR-5 | KB が KN-01 6・KN-02 6・KN-03 6・GN-01 5 本／追加 12 本のいずれも `dify/tests/` の `expect` の数値・条件を繰り返していない（PR 本文に 12 本 × 対応する `expect` 語の非重複チェック表を貼る）／`npm run index` 再生成済み（§11 PASS）／`dify/kb/README.md` に 6 管理番号の投入状態 |
| PR-6 | KN-06 4・KN-08 4 本／`dify/kb/README.md` に「未投入（W4 待ち）」と記載／`npm run index` 再生成済み |
| PR-7 | 12 節（mfg）・5 節（fin）が揃い、各節が `dify/samples/` の実在ファイルを指す／読み上げ文が ja/zh 併記／`runbook-fin.md` §0 に「実機未実装・W4」の明記／実在企業名・実在サービス名・生 URL が無い |
| PR-8 | `briefing-coverage.md` の 12 本の表が `docs/service-map.md` と矛盾しない／金融が「素材あり・実機未実装」と表示される／`faq.md` に実在サービス名が無い |

---

## 10. PR 分割と並列可否

### 10-1. 8 本

| PR | 内容 | 主なファイル | 概算 |
|---|---|---|---|
| **PR-1** | 骨組み：規約・機械検証・4 区分の更新・見本 4 本 | `CLAUDE.md` `README.md` `tools/verify.mjs` `tools/check-world.mjs` `dify/samples/README.md` `dify/samples/KN-01/*`(4) `docs/demo/README.md` | 10 |
| **PR-2** | 入力サンプル 製造①（KN-02 KN-03 GN-01 GN-02 GN-05 NM-03） | `dify/samples/{KN-02,KN-03,GN-01,GN-02,GN-05,NM-03}/` | 24 |
| **PR-3** | 入力サンプル 製造②（DC-01 DC-02 DC-04 LG-01 LG-04） | `dify/samples/{DC-01,DC-02,DC-04,LG-01,LG-04}/` | 20 |
| **PR-4** | 入力サンプル 金融（KN-06 KN-08 DC-09 RS-01 RS-03）＋`data/world/README.md` の未統一 ⑩ 解消 | `dify/samples/{KN-06,KN-08,DC-09,RS-01,RS-03}/` `data/world/README.md` | 16 |
| **PR-5** | KB 増量 製造 | `dify/kb/{KN-01,KN-02,KN-03,GN-01}/`(12) `dify/kb/README.md` `docs/service-map.md` | 14 |
| **PR-6** | KB 素材 金融 | `dify/kb/{KN-06,KN-08}/`(8) `dify/kb/README.md` `docs/service-map.md` | 10 |
| **PR-7** | C 実機デモ台本 | `docs/demo/runbook-mfg.md` `runbook-fin.md` | 2 |
| **PR-8** | D 顧客提示資料 | `docs/demo/briefing-catalog.md` `briefing-coverage.md` `faq.md` | 3 |

新規ファイル計 **約 99**（サンプル 63・KB 20・文書 8・README 3 ほか）。

### 10-2. 並列可否

```
PR-1（先行必須。規約と §16 が無いと後続がバラつく）
  │
  ├── PR-2 ─┐
  ├── PR-3 ─┤ 互いに別ディレクトリ → 並列可
  ├── PR-4 ─┘（PR-4 だけ data/world/README.md を触るが他 PR は触らない）
  │
  ├── PR-5 ──▶ PR-6      docs/service-map.md と dify/kb/README.md が重なる → 直列
  │
  ├── PR-7 ─┐
  └── PR-8 ─┘ 別ファイル → 並列可。ただし PR-2〜PR-6 の実ファイル名を参照するので
             【推奨】PR-2〜PR-6 のマージ後に着手（先行すると存在しないパスを書く）
```

- **PR-2/3/4 と PR-5/6 は完全に別ディレクトリ**（`dify/samples/` と `dify/kb/`）なので並列可
- PR-5/6 は `docs/service-map.md` を再生成するが、PR-2/3/4 は再生成しない（D9）ので衝突しない

### 10-3. Issue #195 との衝突（**ゼロ**）

| #195 が触るファイル | 本設計 |
|---|---|
| `dify/KNOWN_ISSUES.md` `docs/dify/decisions-pending.md` `dify/DEPLOY.md` `dify/env/README.md` | 触らない（§7） |
| `.github/workflows/dify-ops.yml` `scripts/dify/**` | 触らない（§7。生成スクリプトは D3 でスコープ外。作るときも `scripts/demo/`） |
| `dify/apps/{KN-01,KN-02,KN-03,GN-01}-*.yml` `dify/env/cloud-master/env.yml` | 触らない（§7） |

**逆方向も安全**：#195 は `dify/kb/**`・`dify/samples/**`・`docs/demo/**`・`tools/**`・`README.md`・`CLAUDE.md` を触らない。`docs/service-map.md` は KB・DSL・台本の件数で決まり、#195 は DSL ファイルの**中身**しか変えないので索引は動かない。

---

## 11. PM 判断待ち

| # | 論点 | 選択肢 | **architect の推奨** |
|---|---|---|---|
| **P1** | `CLAUDE.md` 冒頭 4 区分（③④）と §2-13 の 3 行を変えてよいか（load-bearing） | (a) 3 行とも変える (b) ④の `dify/samples/` だけ (c) 変えない（`dify/samples/` は④に属すると設計書だけに書く） | **(a)**。`docs/demo/` は「設計書でも実装リファレンスでもない第 3 の文書」で、③の説明を直さないと次の agent が `docs/handoff/` に置いてしまう |
| **P2** | 件数（A 63 本・B +20 本）でよいか | (a) このまま (b) A を各 5 件（＝78 本）に増やす (c) A を各 3 件（＝51 本）に減らす | **(a)**。4 件＝ja 正常／zh 正常／分量／際どい がデモの 1 ターンで見せられる上限。5 件目は当日使われない |
| **P3** | 発票・請求書の**画像／PDF 生成スクリプト**を今回作るか | (a) 作らない（今回スコープ外・別 Issue） (b) 今回 PR-9 として作る（Pillow 等の新規 Python 依存が発生） | **(a)**。実機 12 本は現状ファイル入力を使っておらず（`*_file: null` で全テスト合格）、画像を作っても投入先が無い |
| **P4** | 金融 KB（KN-06・KN-08）を `dify/kb/` に置くか | (a) 置く＋`dify/kb/README.md` で「未投入」と明示（D8） (b) W4 まで置かない | **(a)**。W4 の実装者がそのまま使える。索引の DSL 列が `—` なので「素材あり・未実装」と正しく読める |
| **P5** | C の日中併記の形 | (a) 1 ファイルに ja/zh 併記 (b) `runbook-mfg.ja.md` / `.zh.md` に分ける | **(a)**。分けると片方だけ更新されてズレる（§2-1 と同じ事故） |
| **P6** | D を Markdown だけにするか | (a) Markdown のみ（PowerPoint 化は PM が別途） (b) 資料の元データ（表）を CSV でも出す | **(a)**。§2-10・D3 と整合 |

---

## 12. 後続 Issue（本 Issue には含めない）

**`run:runner`：KB 増量分の実機投入と回帰**（PR-5 マージ後に PM が起票）

```
タイトル: KB 増量分（+12 本）を cloud-master に投入し、12 本の回帰テストを回す
run:runner
前提: 本設計 PR-5 がマージ済み
手順:
  1) dify-ops.yml を workflow_dispatch。op: kb_upload / codes: KN-01 KN-02 KN-03 GN-01
     （追加のみ。同名文書はスキップされる＝削除ゼロ。K1〜K8 の歯止めには当たらない）
  2) op: run_tests / codes: KN-01 KN-02 KN-03 GN-01
  3) 結果を dify/results/cloud-master/ に自動 PR（dify/results/** と dify/state/** 以外を書かない）
受け入れ: 4 本 × 4 ケース = 16 件が投入前と同じ合否。
         FAIL したら期待語を緩めず、追加した KB 文書のほうを直す（本設計 D6-3）
```

**別 Issue（優先度低）**：`docs/service-map.md` に「入力サンプル」列を足す（`tools/gen-index.mjs`）。**全サンプル PR がマージされてから**（D9）。

**別 Issue（P3 が (b) になった場合）**：`scripts/demo/render_samples.py` と `dify/samples/build/`。

---

## 13. 参照

- `CLAUDE.md` 冒頭（4 区分）・§1・§2-1・§2-8・§2-9・§2-10・§2-11・§2-13・§3・§5・§7
- `docs/dify/implementation-guide.md` §3（Wave W1〜W7）・§5-2（テスト 6 種別）・§5-3（ダミーの作り方）
- `data/world/README.md`（未統一 10 件・追加時のルール）
- `dify/README.md`（規約）・`dify/DEPLOY.md` §5-6（`kb_upload` / `kb_refresh` / `kb_replace`）
- `docs/handoff/2026-09-08-cloud-auth-and-w4.md` §4-2（K1〜K8）
- `docs/handoff/2026-09-07-repo-layout-v2.md` §1-3・§2（4 区分・`data/world`）
- `docs/handoff/2026-09-08-live-links.md`（`LIVE`。runbook が参照する）
