# 2026-09-09 `op: deploy` が KB の紐づけを消さないようにする（dataset id を CI で解決する）

Issue: （本設計書の Issue）／親: #121（W4）／**前提: #208（W4-4 `op: deploy`。先にマージ）**
関連: #114（Console 認証の実機観測）・#84（構成 v2）・#124（本番リンク）
レーン: **M/L**（architect が設計 → implementer が実装 → reviewer）
実行場所: **`run:cloud`**（設計・実装・単体テスト・verify はすべてネットワーク不要。実機確認だけを別 Issue `run:runner` に切り出す。`CLAUDE.md` §7）
データ層（`CATS` / `SVCS` / `TAGS`）: **変更 0 件**（§10）
多言語（ja/zh/en）: **該当なし**（UI 文言・辞書に触らない）

---

## §0 要約（先に結論）

1. **PM の見立ては正しい。** dataset id は **Datasets API から名前で機械的に引ける**（`GET /v1/datasets` が `id` と `name` を返し、`kb_upload.py` が既にこの経路で名前一致を取っている）。**新しい secret は 1 つも要らない**（`DIFY_DATASET_KEY` は W1 で Environment `dify-cloud-master` に登録済み。`deploy` ジョブは同じ Environment を宣言しているので、ステップの `env:` に 1 行足すだけで読める）。**PM の手作業は 1 つも増えない。**
2. **`render.py` は 1 バイトも変えない。** 解決した id は `cloud_deploy.py` が **render サブプロセスの環境変数にだけ**渡す（`subprocess.run(..., env=...)`）。親プロセスの `os.environ` にも、`$GITHUB_ENV` にも、ジョブの `env:` にも入れない。したがって **`render.py --env cloud-master --all --check` の 12/12 バイト一致は「差分ゼロ」で保たれる**（§5）。
3. **`dify/state/` は今回作らない。** 作ると W2（#121 PR-2。`render.py --state`・`cloud_deploy.py --write-state`・`verify.mjs` §13・`.gitignore`）と正面衝突する。そして **実行時に API から引ける以上、state は本件の解には要らない**。W2 が来たとき state は「記録」であって「解決の入力」にはしない（古い id で黙って紐づく事故を作らないため。§8）。
4. **止まり方を先に決める。** dataset id が引けない・重複する・API が落ちている——どの場合も **Dify に 1 バイトも書かずに `exit 2` で止まる**。解決は import より前・render より前に全番号ぶんまとめて行い、1 件でも欠けたら全体を止める（§7）。
5. **#208 の暫定歯止めは捨てずに昇格させる。** 「render 後の DSL に空の `dataset_ids` が残っていたら止める」という検査（本書の **G-KB2**）は、恒久対応が入った後も**そのまま残す**。恒久対応が壊れたときの最後の砦になる。ただし**歯止めは 1 か所（`cloud_deploy.py`）に集約**し、`dify-ops.yml` の shell 側には置かない。
6. 名前の一意性は **fail closed**。同名 dataset が 2 件以上あったら選ばずに止める（`kb_upload.py` は先頭を黙って採る。本件では採らない。§6）。

---

## §1 いま何が起きるか（事実。行番号つき）

| # | 事実 | 根拠 |
|---|---|---|
| F1 | マスタ DSL 4 本（`KN-01` / `KN-02` / `KN-03` / `GN-01`）に `knowledge-retrieval` ノードがあり、**`dataset_ids: []`** で出荷されている | `dify/apps/KN-01-tech-knowledge-qa.yml:130`・`KN-02-…:135`・`KN-03-…:136`・`GN-01-expense-check.yml:196` |
| F2 | `render.py` R5 は `knowledge.<番号>.id` を `dataset_ids` に焼き込む。**`${VAR}` が未定義なら `id=None`＝「未解決」で焼き込まず、`--strict` でも exit 1 にしない**（`expand_knowledge()` が `${VAR}` を strict の対象から明示的に外している） | `scripts/dify/render.py` `expand_knowledge()` |
| F3 | `dify/env/cloud-master/env.yml` の `knowledge:` は 4 件とも `id: '${DIFY_DATASET_ID_KN01}'` 形式 | `dify/env/cloud-master/env.yml` |
| F4 | **`DIFY_DATASET_ID_*` は GitHub の secret / variable に存在しない。** `dify-ops.yml` のどのジョブにも現れない | `.github/workflows/dify-ops.yml` 全文 |
| F5 | `cloud_deploy.py` は `run_render()` で `env=os.environ.copy()` のまま `render.py --strict` を呼ぶ | `scripts/dify/cloud_deploy.py:190-198` |
| F6 | `--bind-kb` の既定は `dsl`＝「render 済み DSL に焼き込まれている前提で、紐づけ操作を何もしない」 | `scripts/dify/cloud_deploy.py:351` |
| F7 | Dify のインポートは `dataset_ids` を `decrypt_dataset_id()` に通し、**素の UUID はそのまま通す**。空配列は空配列のまま入る | `docs/handoff/2026-09-08-cloud-auth-and-w4.md` §5-1 |
| F8 | `dify/state/` は**ディレクトリごと存在しない**。`verify.mjs` §13 は W2 用に予約されたまま空 | `tools/verify.mjs:824` のコメント |

**したがって**：F4 → F2 → F5 → F6 → F7 の連鎖で、`op: deploy` を KN-01/02/03・GN-01 に流すと **`dataset_ids: []` のまま上書きインポートされ、公開まで進んだ時点で実機の紐づけが消える。** `render.py` は「未解決・警告」を 1 行出すだけで exit 0 を返すため、**警告を読まない限り誰も気づかない。**

---

## §2 PM の見立ての検証（鵜呑みにせず確かめた結果）

### 2-1 「Datasets API から名前引きできる」→ **正しい**

`kb_upload.py` が現に使っている経路がそのまま使える。

```
GET /v1/datasets?page=<n>&limit=100      →  {"data": [{"id": ..., "name": ...}, ...], "has_more": bool}
```

- 一覧は `kb_upload.py` の `list_all()` が `has_more` を見て**全ページ**を取る（1 ページ目で打ち切らない）。
- 名前一致は `next(d for d in datasets if d.get("name") == kb_name)`。**`kb_name` の出どころは `env.yml` の `knowledge.<番号>.name`**（`kb_name_from_env()`）。
- つまり **KB を作った側（`kb_upload.py`）と、id を引く側が同じ 1 つの名前定義を見る**。名前は構造的に一致する。ここが本設計の土台になる（§6）。
- 実物：`dify/env/cloud-master/env.yml` の `knowledge.KN-01.name = 'KN-01 技術ナレッジQA'` 等の 4 件。

### 2-2 「新しい secret は要らない」→ **正しい**

- `DIFY_DATASET_KEY` は Environment secret `dify-cloud-master` に登録済み（`dify-ops.yml` の `kb` ジョブが `secrets.DIFY_DATASET_KEY` で読んでいる。`dify/DEPLOY.md` §7・§10 にも記載）。
- #208 が追加する `deploy` ジョブは **`environment: dify-cloud-master` を宣言している**。よって同じ secret がそのまま読める。**ステップの `env:` に 1 行足すだけ。**
- Datasets API キーはワークスペース単位（`GET /v1/datasets` がワークスペース全体を返している事実から確定）なので、4 本ぶんを個別に持つ必要もない。

### 2-3 「`--check` の 12/12 を壊さずにできるか」→ **できる。ただし条件は「render.py を触らないこと」**

- **`--check` が DIFF になる条件は 1 つだけ**：`render.py` のプロセス環境に `DIFY_DATASET_ID_*` が入っていること。入ると R5 が焼き込み、`rendered != data` になり `dump_with_header()` を通るので**必ず**バイト不一致になる。
- **`--check` は 2 か所で走る**（両方とも本件と別のジョブ／別のワークフロー）。ここに `DIFY_DATASET_ID_*` を持ち込まないことが唯一の条件：
  1. `.github/workflows/verify.yml` の `Run render.py --check` ステップ
  2. **`tools/verify.mjs` §12** が内部で `render.py --env cloud-master --all --check` を実行している（`npm run verify` にも含まれる）
- 本設計は **`render.py` に 1 バイトも触らない**。解決した値は `cloud_deploy.py` が組み立てる**サブプロセス専用の env dict** にしか入らない。よって上の 2 か所は今日と完全に同じ環境で走る。→ §5 に load-bearing ルール C1〜C3 として書く。

### 2-4 「`dify/state/` を先に作るべきか」→ **作らない方がよい**（§8）

- W2（`docs/handoff/2026-09-08-execution-split-and-runner.md` §6）は `dify/state/` を**設計済み**で、`render.py --state` の追加・`verify.mjs` §13 の新設・`.gitignore` の変更を含む。ここを今回半分だけ実装すると W2 の PR-2 と同じ行で衝突する。
- `CLAUDE.md` §6 と同設計書 §12-11 は「**W2 は #98 の投入が終わってから**」と決めている。
- そして **API から引ける以上、state は本件の必要条件ではない。**

### 2-5 見立てとの相違点（1 つだけ）

PM の報告は「Mac の `~/.config/dify/env` に 4 つ書き込んだ」。**これは今後も無駄にならない**——本設計は「**環境変数が既に設定されていればそれを尊重し、API を呼ばない**」（R0-a）ので、Mac のローカル手順は今日のまま動く。CI では未設定なので API 経路に落ちる。**Mac と CI で挙動を分けるフラグは要らない。**

---

## §3 決定（PM の 7 つの問いへの回答）

| # | 問い | **決定** | 理由 |
|---|---|---|---|
| **D1** | dataset id をどこから得るか | **(a) 実行時に Datasets API から名前引き** | 秘密ゼロ・PM 手作業ゼロ・常に実機の現在値。(b) state は「書く仕組み」と「人が PR をマージする」工程が先に要り、かつ**古くなると黙って壊れる**。(c) 4 つの secret は PM を運び屋にし、KB 付きアプリが増えるたびに増える（今 4 本、`knowledge:` は増える前提） |
| **D2** | `--check` のバイト一致 | **`render.py` を 1 バイトも変えない。id は render サブプロセスの env にだけ渡す** | 「差分ゼロ」が最強の保証。加えて C1（ワークフローに `DIFY_DATASET_ID_` の文字列を置かない）を verify §12-f で機械検査する（§5） |
| **D3** | 名前の一意性 | **完全一致 1 件だけを採る。0 件も 2 件以上も `exit 2` で停止**（先頭を採らない） | 「別の KB に紐づけて公開する」は「紐づけが消える」より復旧が難しい。KB が増えても壊れない（対象は `knowledge:` に定義がある番号だけ） |
| **D4** | `dify/state/` を今回作るか | **作らない。W2 に残す** | §2-4・§8 |
| **D5** | 失敗時の挙動 | **解決 → render → G-KB2 検査 → はじめて import。どこで失敗しても Dify に 1 バイトも書かずに `exit 2`** | §7。`op: deploy` は `validate` → `deploy` の 2 ジョブで、`deploy` が失敗すれば公開も走らない（#208 の P1 と直交して効く） |
| **D6** | PM の手作業 | **増えない（0）** | §2-2。`deploy` ジョブは既に `environment: dify-cloud-master` を宣言済み。ワークフローの `env:` に 1 行足すのは implementer の作業 |
| **D7** | PR 分割と #208 との順序 | **#208 マージ → PR-1（新モジュール・並列可）→ PR-2（配線）→ PR-3（ワークフロー＋文書）** | §12 |

---

## §4 設計

### 4-1 全体の流れ（`cloud_deploy.py` の段番号を 1 つ増やす）

```
0 preflight     env.yml / PyYAML / 認証情報               （既存）
0.5 datasets ★  対象番号のうち KB 付きのものの dataset id を解決する（新規。GET のみ）
1 render        render.py --strict（★ で解決した値だけを env に足したサブプロセス）
1.5 G-KB2 ★     render 出力の knowledge-retrieval ノードに dataset_ids が入っているか検査（新規）
2 resolve       app_id を決める                            （既存）
3 import        POST /console/api/apps/imports             （既存）
4 confirm       pending の自動 confirm                     （既存）
5 kb            --bind-kb draft のときだけ                 （既存。既定 dsl は何もしない）
6 publish       P1：全件 import 成功後にまとめて公開        （#208）
7 report        番号 → app_id の表                         （既存）
8 logout        B3                                        （#208）
```

**★ の 2 つが本件。3（import）より前に完結する。**

### 4-2 新モジュール `scripts/dify/dataset_ids.py`（新規・標準ライブラリのみ）

**なぜ `kb_upload.py` に足さないか**：`kb_upload.py` は **`DELETE` を送る唯一の関数 `delete_document` を持つファイル**（`tools/verify.mjs` §15 が機械検査している）。`cloud_deploy.py` がそれを import すると、投入経路のプロセスに削除コードが載る。`masking.py` を切り出したときと同じ判断（Issue #178）。**新モジュールは HTTP メソッド `GET` しか書かない。**

```python
# 公開する関数（シグネチャは設計。実装時に細部は implementer の裁量）

class DatasetResolveError(RuntimeError): ...

def kb_codes(codes) -> list[str]:
    """dify/apps/<番号>-*.yml に knowledge-retrieval ノードがある番号だけを返す。
    「KB 付きアプリ」の定義はマスタ DSL が唯一の正（番号のハードコードをしない）。"""

def planned_vars(env_raw, code) -> list[tuple[str, str, str]]:
    """[(論理KB名, 環境変数名, KB 名)] を返す。
    - env.yml の knowledge から k == code or k.startswith(code + '/') で拾う（render.py R5 と同じ規則）
    - id は '${NAME}' 1 個ちょうどの形であること。null・直値・前後に文字がある形は DatasetResolveError
    - name が空なら DatasetResolveError"""

def resolve(env_name, codes, *, environ, base_url, key, timeout=30) -> dict[str, str]:
    """{環境変数名: dataset id} を返す。GET しか送らない。
    - environ に既にその変数があれば **API を呼ばずにその値を採る**（R0-a。Mac のローカル手順を壊さない）
    - 1 つでも API 解決が要るなら GET /v1/datasets を全ページ取得し、name 完全一致で引く
    - 0 件 → DatasetResolveError / 2 件以上 → DatasetResolveError（先頭を採らない）
    - HTTP/接続エラー → DatasetResolveError（masking.mask_ids() を通した本文）"""

def assert_bound(build_dir, codes) -> None:
    """G-KB2。dify/build/<env>/<番号>-*.yml を読み、type == 'knowledge-retrieval' の
    全ノードについて dataset_ids が「空でない文字列のリスト」であることを検査する。
    1 件でも空なら DatasetResolveError（＝ import に進ませない）。"""
```

**実装上の約束（load-bearing）**

| # | 約束 | なぜ |
|---|---|---|
| **M1** | HTTP メソッドは `GET` のみ。`POST` / `PATCH` / `DELETE` を 1 行も書かない | 「id を引くだけ」の経路が KB を作ったり消したりしないことを、読めば分かる形にする |
| **M2** | `User-Agent` は `kb_upload.py` と同じ `dify-scripts/1.0 (+https://github.com/shoulang0729/dify)` | Cloudflare が Python-urllib 既定 UA を 403 (1010) で弾く（DI-004） |
| **M3** | ログ・例外に出す id は必ず `masking.short_id()` / `masking.mask_ids()` を通す | `CLAUDE.md` §2-10。公開リポジトリの Actions ログは誰でも読める |
| **M4** | KB 名（`knowledge.<番号>.name`）は**そのままログに出してよい**。dataset id は出さない | KB 名は `dify/env/**` に既にコミットされている架空世界の語。突き合わせに要る |
| **M5** | `resolve()` は `os.environ` を書き換えない（引数の `environ` を読むだけ・戻り値を返すだけ） | §5 C2 |

**ログの形（例）**

```
[dataset] KN-01: KB 名 'KN-01 技術ナレッジQA' → id=1a2b3c4d…（Datasets API 名前引き）
[dataset] KN-02: KB 名 'KN-02 設備マニュアル・取扱説明書の検索' → id=5e6f7a8b…（環境変数 DIFY_DATASET_ID_KN02 が設定済み）
[dataset] 4 件すべて解決しました（DC-01 等 8 本は KB を持たないため対象外）
```

### 4-3 `cloud_deploy.py` 側の配線

```python
# 0.5 段
targets = dataset_ids.kb_codes(codes)
if targets:
    if args.dry_run:
        # ネットワークを呼ばない。静的検査（planned_vars）だけ行い、予定を表示する
        ...
    else:
        key = os.environ.get("DIFY_DATASET_KEY", "").strip()
        if not key and 未設定の変数が残る:
            raise CloudDeployError("...")            # G-KB1 → exit 2
        resolved = dataset_ids.resolve(env_name, targets, environ=os.environ,
                                       base_url=base_url, key=key)

# 1 段（既存 run_render にキーワード引数を 1 つ足すだけ）
out_dir = run_render(env_name, codes, args.all, extra_env=resolved)
    #  内部: sub_env = os.environ.copy(); sub_env.update(extra_env or {})
    #        subprocess.run(cmd, env=sub_env, ...)

# 1.5 段
dataset_ids.assert_bound(out_dir, targets)           # G-KB2 → 失敗なら exit 2
```

**`base_url` の決め方**：`DIFY_BASE_URL` があればそれ、無ければ `env.yml` の `dify.base_url`（`cloud-master` は `https://api.dify.ai/v1`）。`kb_upload.py` の既定と揃える。

**新しい CLI フラグ**：`--no-resolve-datasets`（既定 off）。付けると 0.5 段の API 呼び出しを丸ごと飛ばす（環境変数が設定済みならそれは使う）。**G-KB2 は飛ばさない**——つまりこのフラグを付けて `dataset_ids` が空のままなら、やはり止まる。Mac で「意図的に空のまま入れたい」ときの逃げ道は用意しない（それこそが今回消したい事故だから）。

### 4-4 `--dry-run` はネットワークを呼ばない（既存の契約を守る）

`--dry-run` では 0.5 段の API 呼び出しを行わず、**静的検査（`planned_vars`）と予定表示だけ**にする。G-KB2 も `--dry-run` では**警告**に落とす（焼き込みが起きていないのは当然のため）。`cloud_deploy.py --dry-run` / `release.py --dry-run` の「ネットワークを一切呼ばない」は既存の受け入れ条件（A5）なので壊さない。

### 4-5 `.github/workflows/dify-ops.yml`（`deploy` ジョブ）

差分は 2 か所だけ。

```yaml
      - name: Check secrets presence (values are never printed)
        env:
          DIFY_CONSOLE_REFRESH: ${{ secrets.DIFY_CONSOLE_REFRESH }}
          DIFY_DATASET_KEY: ${{ secrets.DIFY_DATASET_KEY }}      # ← 追加
        run: |
          ...
          [ -n "${DIFY_DATASET_KEY:-}" ] && echo "DIFY_DATASET_KEY: set" \
            || echo "DIFY_DATASET_KEY: unset（KB 付きの番号〔KN-01/KN-02/KN-03/GN-01〕を deploy するときに必須）"

      - name: "Run cloud_deploy.py (op: deploy)"
        env:
          CODES: ${{ inputs.codes }}
          ENV_NAME: ${{ inputs.env }}
          DIFY_CONSOLE_REFRESH: ${{ secrets.DIFY_CONSOLE_REFRESH }}
          DIFY_DATASET_KEY: ${{ secrets.DIFY_DATASET_KEY }}      # ← 追加
```

**書かないもの（load-bearing。C1）**：`DIFY_DATASET_ID_*` という名前を、`.github/workflows/**` のどこにも——`env:` にも `run:` にも `$GITHUB_ENV` への追記にも**コメントにも**——書かない。

**成果物**：`deploy` ジョブは今日どおり何も commit / push しない（`permissions: contents: read` のまま）。**`dify/build/**` を artifact に上げない**（焼き込み済み DSL には dataset id が入るため）。

---

## §5 `--check` のバイト一致をどう保つか（`CLAUDE.md` §2-12）

| # | ルール | 検出 |
|---|---|---|
| **C1** | `.github/workflows/**` に `DIFY_DATASET_ID_` という文字列を書かない（コメントも含む） | **`tools/verify.mjs` §12 に 12-f を追加**（新しい節番号を取らない＝ §13 の W2 予約・§16 の #205 予定を侵さない）。節見出しは `12. 環境レイヤー（dify/env/** ・ワークフローの環境変数）` に改める |
| **C2** | `dataset_ids.resolve()` も `cloud_deploy.py` も **親プロセスの `os.environ` を書き換えない**。解決値は `subprocess.run(env=...)` に渡す dict にだけ入れる | 単体テスト（`resolve()` 呼び出し前後で `os.environ` のキー集合が不変。`run_render` に渡った env dict にだけ入っていること） |
| **C3** | `render.py` を変更しない | reviewer の diff 監査（`git diff` に `scripts/dify/render.py` が出たら差し戻し） |

**受け入れ条件は今日と同じ文言のまま**：

```
DIFY_DATASET_ID_* を source していない素の shell で
  python3 scripts/dify/render.py --env cloud-master --all --check
が 12/12 [OK]
```

**採らなかった案**：「`--check` のときは R5 の焼き込みを常に無効化する」。`--check` が環境に依らず必ず 12/12 になるので一見よいが、**`render.py`（§2-12 の load-bearing）を変えることになる**。今回は「差分ゼロ」の方が保証として強い。将来 `--check` の頑健化をやるなら独立の Issue で（`dify/env/README.md` の「export した shell では DIFF になる＝正しい挙動」という既存の説明も同時に書き換える必要がある）。

---

## §6 名前の一意性（KB が増えたときに壊れないか）

**名前の唯一の定義は `dify/env/<env>/env.yml` の `knowledge.<番号>.name`。**
KB を作る側（`kb_upload.py` の `kb_name_from_env()`）と、id を引く側（本設計の `planned_vars()`）が**同じ 1 行**を読む。

| 状況 | 挙動 |
|---|---|
| 完全一致 1 件 | 採用 |
| **0 件** | `exit 2`。「KB '<名前>' が Dify に見つかりません。先に `op: kb_upload` を流してください」 |
| **2 件以上** | `exit 2`。候補を `short_id()` で列挙して停止。**先頭を採らない** |
| Dify の画面で KB 名を変えた | 0 件になって止まる（**黙って空で上書きするより良い**） |
| KB 付きアプリが増えた | `dify/apps/<新番号>-*.yml` に `knowledge-retrieval` ノードがあれば `kb_codes()` が自動で拾う。**番号のハードコードは無い**。`env.yml` に `knowledge.<新番号>: { name: …, id: '${DIFY_DATASET_ID_<新番号>}' }` の 1 行が無ければ `exit 2` で止まり、何をすればよいかをメッセージに出す |
| `id: null` のまま新しい KB 付きアプリを足した | `exit 2`（`${VAR}` 形式でないため）。メッセージに書くべき 1 行を提示する |

> **既知の別件（本件では直さない）**：`kb_upload.py` は同名 dataset が複数あると `next(...)` で**先頭を黙って採る**。本設計の `resolve()` は採らない。`kb_upload.py` 側を揃えるかは別 Issue（`KNOWN_ISSUES.md` に DI 起票を推奨）。

---

## §7 失敗したときの挙動（「何もせず止まる」の担保）

**原則**：Dify への**書き込みは 1 つも起きない位置で**すべての判定を終える。

```
[GET のみ]  0.5 解決 ──┐
[ローカル]  1   render │  ここまでで失敗 → exit 2。Dify は 1 バイトも変わっていない
[ローカル]  1.5 G-KB2 ─┘
─────────────────────────────────────────────
[書き込み]  3   import（ここから先が #208 の P1 の担当領域）
[書き込み]  6   publish（P1: import が 1 本でも失敗したら 1 本も公開しない）
```

| 失敗 | 判定する場所 | 終了コード | Dify 側の副作用 |
|---|---|---|---|
| `DIFY_DATASET_KEY` 未設定なのに KB 付きの番号が対象（**G-KB1**） | 0.5（API を呼ぶ前） | **2** | **なし** |
| `env.yml` に `knowledge.<番号>` が無い／`id` が `${VAR}` 形式でない | 0.5（API を呼ぶ前） | **2** | **なし** |
| Datasets API が 401 / 403（キー失効） | 0.5 | **2**（設定不備。`exit 3` は Console のセッション期限切れ専用のまま） | **なし** |
| Datasets API に到達できない／タイムアウト（既定 30 秒） | 0.5 | **2** | **なし**。再試行はしない（**fail closed**。運用者が再実行する） |
| KB 名が 0 件／2 件以上 | 0.5 | **2** | **なし** |
| 何らかの理由で render 出力の `dataset_ids` が空（**G-KB2**） | 1.5 | **2** | **なし** |
| import が 1 本でも失敗 | 3 | 1（#208） | 公開は 1 本も行われない（P1） |

**G-KB2 が最後の砦である理由**：0.5 段の解決規則をどれだけ丁寧に書いても、`env.yml` の書き換え・`render.py` の将来の変更・想定外の DSL 構造で焼き込みが落ちる可能性は残る。**実際に import する直前のバイト列を見て空でないことを確かめる**検査は、原因に依らず全部を捕まえる。**これは #208 の暫定歯止めと同じもの**なので、恒久対応後も削除しない（§12 で「昇格」と呼んでいるのはこれ）。

---

## §8 `dify/state/`（W2）との関係

**今回は作らない。**

| 論点 | 判断 |
|---|---|
| 作るとどうなるか | W2 の PR-2（`dify/state/cloud-master.yml`・`.gitignore`・`render.py --state`・`cloud_deploy.py --write-state`・`verify.mjs` §13）と同じファイル・同じ節番号で衝突する。`CLAUDE.md` §6 と `2026-09-08-execution-split-and-runner.md` §12-11 は「W2 は #98 が一段落してから」と決めている |
| 作らないと困るか | **困らない。** 実行時に API から引けるので、解決の入力としての state は要らない |
| W2 が来たときの関係 | **state は「記録」であって「解決の入力」にしない。** 解決の順序は **① 明示的な環境変数 → ② Datasets API 名前引き** の 2 段のままにする。state を③のフォールバックにすると、KB を作り直して id が変わったときに **古い id で紐づけて公開する**（＝今回消したい事故の別バージョン）ことになる |
| state に何を書くか | W2 が `cloud_deploy.py --write-state` を実装したら、**その回に解決した dataset id を「事実」として記録する**のはよい（`cloud-master` は直値可＝ `2026-09-08-execution-split-and-runner.md` §6-4 の PM 決定）。読む側には使わない |

**本設計書からの W2 への申し送り**：`docs/handoff/2026-09-08-execution-split-and-runner.md` §6-5 の表にある「R5 の `dataset_ids` 解決順を `${VAR}` 環境変数 → state → env.yml に」という 1 行は、**本書の §8 の判断に置き換わる**（state を解決の入力にしない）。W2 の実装時に設計書を更新すること。**本書では `2026-09-08-execution-split-and-runner.md` を書き換えない**（`CLAUDE.md` §4：設計後に設計書を黙って変えない）。

---

## §9 変更する範囲 / 触らない範囲

### 9-1 変更する範囲

| ファイル | 変更 | PR |
|---|---|---|
| `scripts/dify/dataset_ids.py` | **新規**。§4-2 | PR-1 |
| `scripts/dify/tests/test_dataset_ids.py` | **新規**。§11 の T1〜T9 | PR-1 |
| `scripts/dify/tests/mock_server.py` | `GET /v1/datasets` の `page` / `limit` / `has_more` を実装（現在は 1 ページで `has_more: False` 固定）。**既存の挙動は 1 ページに収まる限り変わらない** | PR-1 |
| `tools/verify.mjs` | **§12 に 12-f を追加**（C1）。節見出しを 1 語広げる。**新しい節番号は取らない** | PR-1 |
| `scripts/dify/cloud_deploy.py` | 0.5 段・1.5 段の配線／`run_render(..., extra_env=)`／`--no-resolve-datasets`／docstring の段番号 | PR-2 |
| `scripts/dify/tests/test_cloud_deploy.py` | T10〜T13 を追加 | PR-2 |
| `.github/workflows/dify-ops.yml` | `deploy` ジョブの 2 ステップに `DIFY_DATASET_KEY` を足す（§4-5） | PR-3 |
| `dify/DEPLOY.md` §9 | #208 が書いた「既知の制限」節を**恒久対応の説明に差し替える**（`codes` から 4 番号を除く回避策は不要になる） | PR-3 |
| `dify/env/README.md` | `knowledge:` の節に「`cloud-master` の `id` は `${VAR}` 形式にする。CI は KB 名から Datasets API で引く」を 2 行 | PR-3 |
| `scripts/dify/env.example` | `DIFY_DATASET_ID_*` の 4 行にコメントを 1 行（「CI では自動解決。ローカルで固定したいときだけ設定」） | PR-3 |
| `dify/KNOWN_ISSUES.md` | 本件の記録を 1 行（`DI-5xx` 帯＝コード上の発見。`2026-09-08-execution-split-and-runner.md` §7-1 の採番帯） | PR-3 |

### 9-2 触らない範囲（明示）

- **`scripts/dify/render.py`（1 バイトも変えない。§5 C3）**
- **`dify/apps/*.yml`（12 本。1 バイトも変えない。`dataset_ids: []` のまま出荷し続ける）**
- **`dify/env/**/env.yml`（3 環境とも変更なし。`cloud-master` の `knowledge:` は今の `${DIFY_DATASET_ID_*}` のまま）**
- **`dify/state/`（作らない。§8）**・**`tools/verify.mjs` の §13（W2 予約）・§16（#205 予定）・§14・§15**
- `mock/**`（デモ。データ層 `CATS`/`SVCS`/`TAGS` は **0 件**）・`data/world/**`・`mock/js/data/**`
- `tools/regress.mjs`・`tools/regress.baseline.json`（`--update` しない）
- `scripts/dify/kb_upload.py`（同名重複の扱いは別 Issue。§6 の注）・`console_api.py`・`sync_back.py`・`release.py`（§13 D-1 参照）・`masking.py`（import するだけ）
- `.github/workflows/verify.yml`・`pages.yml`
- `.claude/**`
- `CLAUDE.md`（**文案は §13 D-3 に置く。適用は PM**）
- `dify/kb/**`・`dify/tests/*.json`・`dify/results/**`

---

## §10 データ層（`CATS` / `SVCS` / `TAGS`）

**変更 0 件。** `tools/regress.mjs` は `--update` しない。

| | 変更前 | 変更後 |
|---|---|---|
| `cats` | 13 | **13** |
| `subs` | 29 | **29** |
| `svcs` | 67 | **67** |
| `tags` | 57 | **57** |
| `ui` | 86 | **86** |
| `svcsMfg` / `svcsFin` / `svcsBoth` | 49 / 29 / 11 | **49 / 29 / 11** |
| id 一覧 | — | **増減なし**（本件は `mock/**` に触らない） |

reviewer は `node tools/regress.mjs` が `PASS — データ層は基準と一致` を出すこと、および `git diff` に `mock/` と `tools/regress.baseline.json` が 1 行も出ないことを確認する。

---

## §11 受け入れ条件

### 11-1 機械検証（全 PR 共通・必須）

- [ ] `npm test`（`node tools/verify.mjs && node tools/regress.mjs`）が **ALL PASS**（warn は現状と同じ 2 件のまま）
- [ ] **`python3 scripts/dify/render.py --env cloud-master --all --check` が 12/12 `[OK]`**（`DIFY_DATASET_ID_*` を source していない素の shell）
- [ ] `git diff` に **`scripts/dify/render.py` が 1 行も出ない**（C3）
- [ ] `git diff` に **`dify/apps/**`・`dify/env/**/env.yml`・`mock/**`・`tools/regress.baseline.json` が 1 行も出ない**
- [ ] 既存テストが全件 PASS：`test_kb_upload.py` / `test_cloud_deploy.py` / `test_console_api.py` / `test_run_tests.py` / `test_sync_back.py` / `test_masking.py` / `test_lang_check.py` / `test_inspect_rerank.py`
- [ ] `dify-ops.yml` のトリガが `workflow_dispatch` のみ

### 11-2 `test_dataset_ids.py`（PR-1）

- [ ] **T1** `kb_codes()` が `KN-01` / `KN-02` / `KN-03` / `GN-01` の 4 件だけを返す（**番号のハードコードではなく DSL の `knowledge-retrieval` ノードから導出**していること。8 本は返らない）
- [ ] **T2** `resolve()` が **`GET` 以外の HTTP メソッドを 1 度も送らない**（モックサーバが `POST`/`PATCH`/`DELETE` を受けたら即失敗）
- [ ] **T3** 名前完全一致 1 件を引ける。**`has_more` を跨いだ 2 ページ目**にある KB も引ける
- [ ] **T4** 同名 KB が 2 件あると **`DatasetResolveError`**（どちらも採らない）
- [ ] **T5** 名前 0 件で `DatasetResolveError`
- [ ] **T6** 環境変数が既に設定されている番号は **API を 1 度も呼ばずに**その値を採る（R0-a。モックサーバへの GET が 0 回）
- [ ] **T7** **標準出力・例外文字列に完全な UUID が現れない**（`kb_upload.py` の T6 と同じ正規表現）。KB 名は出てよい
- [ ] **T8** `resolve()` の前後で **`os.environ` のキー集合が不変**（C2）
- [ ] **T9** `assert_bound()` が、`dataset_ids: []` を含む DSL で例外、UUID 1 件入りの DSL で正常終了

### 11-3 `test_cloud_deploy.py` 追加分（PR-2）

- [ ] **T10** 0.5 段で解決した値が **`run_render` に渡る env dict にだけ**入り、**親プロセスの `os.environ` には入らない**（C2）
- [ ] **T11** dataset の解決に失敗すると **`exit 2` で、Console API に 1 リクエストも飛ばない**（import も publish も 0 回。モックサーバのアクセスログで確認）
- [ ] **T12** render 出力の `dataset_ids` が空のまま 1.5 段に来ると **`exit 2`。import 0 回**（G-KB2。#208 の暫定歯止めがこの位置に一本化されていること）
- [ ] **T13** `--dry-run` が **Datasets API にも Console API にも 1 リクエストも送らない**（既存 A5 の維持）
- [ ] **T14** KB を持たない 8 本だけを対象にしたとき、`DIFY_DATASET_KEY` が未設定でも **正常に動く**（G-KB1 が過剰に止めない）

### 11-4 ワークフロー・文書（PR-3）

- [ ] `verify.mjs` §12-f が **`.github/workflows/**` に `DIFY_DATASET_ID_` が無い**ことを検査し PASS（意図的に 1 行入れると FAIL することを実装者が手元で確認）
- [ ] `dify/DEPLOY.md` §9 から「`codes` にこの 4 番号を含めない」という回避策が消え、**恒久対応の説明と、失敗時に何が起きるか（何も起きない）**が書かれている
- [ ] `dify/DEPLOY.md` に **`op: deploy` の前に `op: kb_upload` が済んでいる必要がある**（KB が無いと id が引けない）ことが 1 行ある

### 11-5 実機（**この Issue では実施しない。別 Issue `run:runner`**）

- [ ] `op: deploy` に `KN-02` 1 本を流し、**公開後に Studio の知識検索ノードで KB が選択済み**であること
- [ ] 続けて `op: run_tests` で `KN-02` が合格（検索が効いている）
- [ ] `DIFY_DATASET_KEY` を一時的に外した状態で `op: deploy KN-02` を流し、**`exit 2` で止まり、Cloud 側の紐づけが変わっていない**こと
- [ ] ジョブログ・Job Summary に **dataset id の完全な UUID が出ていない**

---

## §12 PR 分割と #208 との順序

```
#208（W4-4 op: deploy ＋ 暫定歯止め）  ── マージ ──┐
                                                   │
PR-1  dataset_ids.py ＋ テスト ＋ verify §12-f      │  ← #208 と並列可（ファイル集合が重ならない）
                                                   ▼
PR-2  cloud_deploy.py 配線 ＋ G-KB2 一本化 ────────  #208 の後（同じファイル）
                                                   ▼
PR-3  dify-ops.yml ＋ DEPLOY.md §9 ＋ 文書 ────────  PR-2 の後（同じファイル・文書が対応する）
                                                   ▼
別 Issue（run:runner）  実機 1 本で確認
```

| PR | 中身 | 触るファイル | 依存 |
|---|---|---|---|
| **PR-1** | `scripts/dify/dataset_ids.py`（新規）／`scripts/dify/tests/test_dataset_ids.py`（新規）／`scripts/dify/tests/mock_server.py`（`GET /v1/datasets` のページング）／`tools/verify.mjs`（§12-f） | 上記 4 本のみ | **#208 と並列可。** 単体で `npm test` と `render --check` が通る |
| **PR-2** | `scripts/dify/cloud_deploy.py`（0.5 段・1.5 段・`extra_env`・`--no-resolve-datasets`）／`scripts/dify/tests/test_cloud_deploy.py` | 上記 2 本のみ | **#208 マージ後・PR-1 の後**（同じ `cloud_deploy.py`／新モジュールに依存） |
| **PR-3** | `.github/workflows/dify-ops.yml`／`dify/DEPLOY.md` §9／`dify/env/README.md`／`scripts/dify/env.example`／`dify/KNOWN_ISSUES.md` | 上記 5 本のみ | **PR-2 の後**（#208 も `dify-ops.yml`・`DEPLOY.md` を触るため直列。`CLAUDE.md` §5） |
| **PR-4（任意・後続）** | `scripts/dify/release.py` の `run_render` にも同じ経路を通す | `release.py`・`test_*` | PR-2 の後。§13 D-1 |

**#208 の暫定歯止めの扱い**：
- #208 の歯止めが **`cloud_deploy.py` にある**なら → PR-2 で **G-KB2 として残す**（位置を 1.5 段に移すだけ）。削除しない。
- #208 の歯止めが **`dify-ops.yml` の shell にある**なら → PR-2 で `cloud_deploy.py` の G-KB2 に移し、**PR-3 で shell 側を削る**。**歯止めを 2 か所に置かない**（片方だけ直る事故を作らないため）。

---

## §13 PM が判断すべき点（推奨つき）

| # | 判断 | 選択肢 | **推奨** | 理由 |
|---|---|---|---|---|
| **D-1** | `release.py` にも同じ経路を通すか | 今回入れる / 後続 PR-4 に回す | **後続 PR-4** | `release.py` は自前の `run_render` を持つが、cloud 経路の実運用は `op: deploy`（＝`cloud_deploy.py`）。今は `release.py` を `run:mac` で使う場面が残っているだけで、そこでは環境変数が設定済み（R0-a で動く）。PR を小さく保つ |
| **D-2** | `render.py --check` 自体を「R5 を無視する」形に頑健化するか | する / しない | **しない（今回は）** | §2-12 の load-bearing に触ることになる。今回は「render.py の差分ゼロ」の方が保証として強い。やるなら独立の Issue（`dify/env/README.md` の説明も同時に書き換える） |
| **D-3** | `CLAUDE.md` に 1 行足すか | 足す / 足さない | **足す（W4-5 完了時に 1 行）**。文案 → 「§2-12 に：`op: deploy` の `dataset_ids` は実行時に Datasets API から KB 名で引く（`scripts/dify/dataset_ids.py`）。**`DIFY_DATASET_ID_*` をワークフローに書かない**（`verify.mjs` §12-f が機械検査）」 | load-bearing の追加は最小に。**適用は PM** |
| **D-4** | `verify.mjs` の節番号を §12-f にするか、新しい §17 にするか | §12-f / §17 | **§12-f** | §13（W2 予約）・§14（#124）・§15（W4-1）・§16（#205 予定）が埋まっており、新番号を取ると #205 と競る。§12 の見出しを 1 語広げるだけで済む |
| **D-5** | Datasets API の失敗を再試行するか | 再試行しない / 1 回だけ再試行 | **再試行しない** | 「何もせず止まる」を最優先にする。運用者がワークフローを押し直せばよい（30 秒） |
| **D-6** | 実機確認を同じ Issue に含めるか | 含める / 別 Issue | **別 Issue（`run:runner`）** | `CLAUDE.md` §7「`run:*` は 1 つだけ。2 つ付くのは Issue を分割する合図」 |

---

## §14 参照

- **前提の PR**：#208（W4-4 `op: deploy`。`cloud_deploy.py` の P1・B3、`dify-ops.yml` の `deploy` ジョブ、`dify/DEPLOY.md` §9）
- `docs/handoff/2026-09-08-cloud-auth-and-w4.md` §5（`dataset_ids` 焼き込み）・§5-3（`--check` の条件）・§11「W4-4」
- `docs/handoff/2026-09-08-execution-split-and-runner.md` §6（`dify/state/<env>.yml` の設計）・§6-4（`cloud-master` は直値可）・§12-11（W2 の着手時期）
- `docs/handoff/2026-09-07-repo-layout-v2.md` §3・§4-1（R1〜R10。R5 が本件）
- `scripts/dify/render.py`（`expand_knowledge()`・`render_app()` の R5・`--check`）
- `scripts/dify/kb_upload.py`（`list_all()`・`kb_name_from_env()`・`USER_AGENT`・`MAX_DELETE`）
- `scripts/dify/cloud_deploy.py:190-198`（`run_render`）・`scripts/dify/masking.py`
- `tools/verify.mjs` §12（env レイヤー。`render --check` を内部実行）・§15（削除系 API の機械検査）
- `dify/env/README.md`（`apps:` の節・`--check` は素の shell で、の注意）・`dify/DEPLOY.md` §7・§9
- `CLAUDE.md` §2-9（データ層の差し替え）・§2-10（秘密）・§2-12（環境差分と `--check`）・§3（検証）・§5（Git 運用）・§7（実行場所）
