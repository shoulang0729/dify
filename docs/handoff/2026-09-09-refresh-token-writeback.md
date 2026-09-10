# 2026-09-09 リフレッシュトークンの自動更新（rotate した新しい値をジョブが Environment secret に書き戻す）

対象 Issue：本設計書で新規に立てる（`run:cloud`）。前提 Issue：#121（W4-3・W4-4）
前設計：`docs/handoff/2026-09-08-cloud-auth-and-w4.md` §8（Cookie 案）・§8-3（R-a/R-b/R-c）・§8-7（B1〜B6）・§9-4（秘密が増えることの評価）
関連実装：`scripts/dify/console_api.py`・`scripts/dify/cloud_deploy.py`・`scripts/dify/inspect_rerank.py`・`.github/workflows/dify-ops.yml`・`dify/DEPLOY.md` §8・§9

---

## §0 要約（先に結論）

1. **前設計の決定を 1 つひっくり返す。** `2026-09-08-cloud-auth-and-w4.md` §8-3 は **R-b（書き戻し）を「採らない」**と判定していた。2026-09-09 の実測（run #11 の `inspect` と run #12 の `deploy` が同じ日に 2 回トークンを消費し、後者が exit 3 で落ちた）と PM 判断により、**R-b を採る**。本設計書は §8-3 の表の「R-b＝採らない」を**上書きする**（前設計書は書き換えない。追記もしない。ここが新しい版）。
2. **書き戻す権限**：`GITHUB_TOKEN` では**書けない**（`permissions:` に secrets スコープが存在しない）。**このリポジトリだけに絞った fine-grained PAT**（`Secrets: Read and write`）を Environment secret `GH_SECRETS_PAT` に置く。GitHub App は却下（PM の手数が増え、危険は下がらない。§3 D1）。
3. **暗号化**：**新しい pip 依存は入れない。** Python 標準ライブラリだけでは libsodium の sealed box は作れない（X25519 と XSalsa20-Poly1305 が無い）。PyNaCl も入れない。**ランナー同梱の `gh secret set` に封をさせる**（GitHub 公式 CLI・`ubuntu-latest` に同梱・third-party action も追加しない）。**依存の増加は 0**（§3 D2）。
4. **いつ書き戻すか**：**rotate が起きたら、ジョブの成否・キャンセルを問わず必ず**。`console_api.refresh()` が rotate のたびに**ランナーの一時ファイル（sink）を上書き**し、workflow の書き戻しステップが `if: always()` で最後の 1 個を送る。`_req()` の 401 自動再取得で複数回 rotate しても、最後の 1 個になる（§4-2）。
5. **`logout`（B3）とは正面から矛盾する。** `logout` は対になるリフレッシュトークンをサーバ側で殺すので、**書き戻した値も同時に死ぬ**。**書き戻し運用のときは B3 を止める**（`safe_logout()` を sink 有効時にスキップ）。B3 が担っていた「実行後は漏れても無価値」という性質は**失われる**。代わりに **`op: token_revoke`（手動キルスイッチ）** を用意する（§4-4・§6）。
6. **最悪ケース**：書き戻しが失敗すると、secret には**死んだ値**が残る。**この状態は自動では直らない。** そのため、失敗時は「もう使えない・PM が取り直す必要がある」ことを `::error::`・標準出力・Job Summary の 3 か所に**確定した文言**（§5-2 に原文）で出し、ジョブを失敗させる。**degrade 先は「今日の運用（R-a）」であって、今日より悪くはならない**。
7. **PAT が未設定なら、自動で従来の R-a 運用に戻る**（sink を設定しない → B3 の `logout` が復活する）。半分だけ壊れた状態を作らない（§4-5）。
8. **`CLAUDE.md` §7 の秘密の記述と衝突する。** architect は書き換えない。**§7 に変更提案の原文を置き、PM 承認後に別 PR で入れる**（PR-5）。なお現行 §7 の記述は **`DIFY_CONSOLE_REFRESH` を置いた時点（W4-3）ですでに実態と合っていない**。

---

## §1 目的 / 変更する範囲 / 触らない範囲

### 1-1 目的

**PM がリフレッシュトークンの運び屋をやめる。** `op: deploy` / `op: inspect` を回すたびにブラウザから Cookie を取って GitHub の secret に貼り直す作業（1 回あたり約 3 分）を、**最初の 1 回だけ**にする。

前設計 §8-5 は「月に数回なら許容」と評価していたが、実測は**同じ日に 2 回消費**（`inspect` 1 回・**失敗した `deploy` でも 1 回**）だった。**「失敗しても 1 回消える」**のが体感を悪くしている中心なので、成否に関わらず書き戻す設計にする。

### 1-2 変更する範囲

| # | ファイル | 変更内容 |
|---|---|---|
| C1 | `scripts/dify/console_api.py` | sink（`DIFY_REFRESH_SINK`）への rotate 値書き出し。`_absorb_session_cookies()` の refresh 取得順の確定。`_MASK_PATTERNS` に PAT 形を追加 |
| C2 | `scripts/dify/cloud_deploy.py` | `safe_logout()` を sink 有効時にスキップ（B3 の条件化） |
| C3 | `scripts/dify/console_session.py`（新規） | `op: token_refresh` / `op: token_revoke` の実体。Dify に書き込む API は呼ばない |
| C4 | `.github/workflows/dify-ops.yml` | 書き戻しステップ（`deploy`・`inspect`・`token_refresh`）、`op` の選択肢追加、`concurrency`、PAT 有無による自動フォールバック |
| C5 | `scripts/dify/tests/test_console_api.py`・`test_cloud_deploy.py` | §9 の機械確認 |
| C6 | `dify/DEPLOY.md` | **§10 を新設**（§8・§9 は使用中。実物で確認済み） |
| C7 | `docs/handoff/2026-09-09-refresh-token-writeback.md` | 本書 |

### 1-3 触らない範囲（明示）

- **`mock/**` は 1 バイトも触らない。** UI・多言語辞書・トークン・データ層（`CATS`/`SVCS`/`TAGS`）に変更なし → **`tools/regress.mjs` の基準は更新しない**（`--update` を打たない）。**多言語の追加も無い**（本件に顧客向け文言は無い）
- **`tools/verify.mjs` を触らない。** 特に §15（`DELETE` を送る関数は `kb_upload.py` の `delete_document` のみ）は**そのまま**。本設計は `DELETE` を 1 つも増やさない（`gh secret delete` は Python の HTTP 呼び出しではないので §15 の検査対象外。§4-4 参照）
- `dify/apps/**`・`dify/kb/**`・`dify/tests/**`・`dify/env/**`・`dify/state/**`・`dify/results/**` は変更しない（本件は投入する中身に関係しない）
- `dify-ops.yml` の **`kb` / `tests` / `probe` ジョブは触らない**（コンソールセッションを使わない。`concurrency` グループにも入れない＝無関係な直列化で待たせない）
- `console_api.py` の `login()` / `import_dsl()` / `publish()` / `list_apps()` の**シグネチャと戻り値は変えない**（`release.py` の selfhost 経路が使っている）
- **`CLAUDE.md` は architect が直接書き換えない**（§7 に提案の原文だけ置く）
- `.claude/agents/**`・`.claude/commands/**`

---

## §2 前提の事実確認（実測・ソース根拠）

| # | 確認したこと | 結果 | 根拠 |
|---|---|---|---|
| F1 | `DIFY_CONSOLE_REFRESH` の置き場 | Environment `dify-cloud-master` の secret。`deploy` / `inspect` ジョブが `environment:` を宣言して読む | `.github/workflows/dify-ops.yml`（`deploy`・`inspect` の `env:` ブロック） |
| F2 | rotate は 1 ジョブに 1 回とは限らない | **限らない。** `_req()` は 401 のとき `_retried` フラグで**1 回だけ**自動再取得する。したがって **1 ジョブで最大 2 回 rotate しうる**（初回の `client_from_env` ＋ 60 分超えの自動再取得）。`refresh()` は毎回 `_absorb_session_cookies()` で `self._refresh_token` を更新する | `console_api.py` `_req()` / `refresh()` |
| F3 | `logout()` は何を殺すか | **対になるリフレッシュトークンも殺す。** `revoke_token_pair` 相当。モックサーバも同じ挙動を再現している（`logout` 時に `used_refresh_tokens` へ追加） | `console_api.py` `logout()` の docstring／`scripts/dify/tests/mock_server.py`（`access_token -> その時点の refresh_token` の対応表を持ち、logout で両方無効化）／`dify/DEPLOY.md` §8 手順 5「そのブラウザではログアウトしない（…貼ったばかりの secret も同時に死ぬ）」 |
| F4 | `safe_logout()` を呼んでいるのは | `cloud_deploy.py` の `main()` の `finally`。`client._auth_mode == "refresh"` のときだけ実行 | `cloud_deploy.py:399, 569` |
| F5 | `inspect_rerank.py` は logout するか | **しない**（`logout` の呼び出しが無い）。つまり run #11 の `inspect` は rotate した新しい値をメモリに持ったまま捨てていた | `scripts/dify/inspect_rerank.py`（`client_from_env()` のみ） |
| F6 | ワークフローの `permissions` | トップレベル `contents: read`。`deploy`・`inspect` は job で `contents: read` を明示 | `dify-ops.yml:104`・`618`・`deploy` ジョブ |
| F7 | `concurrency` の有無 | **無い。** 現状 2 つの run が同時に走りうる | `dify-ops.yml` 全体に `concurrency` キーが存在しない |
| F8 | `DEPLOY.md` の空き節番号 | §8（コンソール認証）・§9（`op: deploy`）まで使用中 → **新設は §10** | `dify/DEPLOY.md` の見出し一覧 |
| F9 | 既存ジョブの依存導入 | 各ジョブに `- name: Install Python dependencies / run: pip install pyyaml` の 1 行だけ。**他の pip 依存は無い** | `dify-ops.yml`（`tests`・`inspect`・`kb`・`deploy` の同名ステップ） |
| F10 | `verify.mjs` に workflow の秘密一覧を検査する仕組みはあるか | **無い**（§12 は `dify/env/**` の秘密検査、§15 は `DELETE` 検査）。新しい secret を足しても verify は落ちない＝**人（reviewer）と `CLAUDE.md` §7 だけが歯止め** | `tools/verify.mjs` |

---

## §3 決めたこと（D1〜D9）

### D1 書き戻す権限 → **このリポジトリだけに絞った fine-grained PAT**（推奨・採用）

**まず `GITHUB_TOKEN` では書けない。** GitHub Actions の `permissions:` には secrets のスコープが**存在しない**（`actions` / `contents` / `deployments` / `id-token` / `issues` / `packages` / `pages` / `pull-requests` / `repository-projects` / `security-events` / `statuses`）。secret の作成・更新 API は `GITHUB_TOKEN` を受け付けない。前設計 §8-3 の R-b 行の記述と一致する。

| 案 | 中身 | 判定 |
|---|---|---|
| `GITHUB_TOKEN` | — | **不可能**（スコープが存在しない） |
| **fine-grained PAT（採用）** | 個人アカウント所有・**このリポジトリのみ**・`Secrets: Read and write` のみ・期限 1 年 | **推奨。** PM の設定は 1 画面で終わる。権限の粒度が明示的で、**Contents（コード）・Actions（ワークフロー）・Variables を一切与えない**。失効は画面から Delete で即時 |
| GitHub App | App を作る → このリポジトリにインストール → App ID と秘密鍵の 2 つを secret に置く → `actions/create-github-app-token` でランタイムに 1 時間トークンを鋳造 | **却下。** 理論上は「実行時トークンが短命」だが、**リポジトリに置く静的資格情報（秘密鍵）は結局 1 つ**で、鍵が漏れたときにできることは PAT と同じ。**PM の手数が 3 倍**（App 作成・インストール・2 つの secret）で、**action への依存が 1 つ増える**。危険が下がらないのに複雑さだけ増える |
| classic PAT | `repo` スコープ | **却下。** コードの書き換えまで含む広すぎる権限 |
| deploy key / SSH | secrets API を叩けない | **却下** |

**secret 名**：`GH_SECRETS_PAT`。**置き場は Environment `dify-cloud-master` の secret**（repository secret にしない）。理由：`environment:` を宣言したジョブ以外からは読めず、Required reviewers を戻したときに同じゲートが自動的に効くため。

**確認要 V-A**：Environment secret の更新に fine-grained PAT が要求する権限が `Secrets: Read and write` **だけ**か、`Environments` も要るかは**実測で確定する**（PR-1 の自己テスト）。`Secrets` のみで 403 が返るなら `Environments: Read and write` を足す。**足した場合は environment の保護ルール（Required reviewers・deployment branches）まで書き換えられる強い権限になる**ので、§6 の危険評価と `DEPLOY.md` §10-2 を**必ず同時に更新する**。

### D2 暗号化 → **`gh secret set` に封をさせる。新しい依存は入れない**（推奨・採用）

GitHub の secret 更新 API は **libsodium sealed box**（X25519 ＋ XSalsa20-Poly1305 ＋ Blake2b）で公開鍵封印した値を要求する。

| 案 | 判定 | 理由 |
|---|---|---|
| Python 標準ライブラリだけで実装 | **不可能に近い（却下）** | `hashlib.blake2b` はあるが、**X25519 のスカラー倍も XSalsa20-Poly1305 も標準ライブラリに無い**。純 Python で書けなくはないが、**暗号の自作**であり、供給網リスクを回避する代わりに「自作暗号の実装ミス」という**より当たりやすい事故**を招く。レビューも重い |
| `pip install pynacl` | **却下** | GitHub 公式ドキュメントの例はこれ。だが **C 拡張入りの新しい PyPI 依存が 1 つ増える**。この依存は**リポジトリのすべての secret を書き換えられる PAT と同じプロセスに載る**ので、供給網の事故がそのまま PAT の漏洩になる。`--require-hashes` で固定すれば緩和できるが、`pip install pyyaml` だけで済んでいる今の運用（F9）に固定ハッシュ管理を持ち込むのは割に合わない |
| `pip install cryptography` | **却下** | X25519 は持つが **sealed box（XSalsa20-Poly1305）を持たない**ため、結局自作部分が残る。上の 2 つの悪いところ取り |
| **`gh secret set`（採用）** | **推奨** | `gh` は **GitHub 公式 CLI で `ubuntu-latest` ランナーイメージに同梱**。公開鍵の取得と封印を `gh` 側が行うので、**こちらは平文の値を stdin に流すだけ**。**新しい pip 依存 0・新しい action 依存 0**。供給網の増分は「すでにランナーに入っているものを使う」ぶんだけ＝**実質 0** |

**供給網リスクの評価（結論）**：**増えない。** ランナーイメージそのものを信頼する前提は、`actions/checkout` や `python3` を使っている時点ですでに置いている。`gh` はそれと同じ信頼境界の内側にある。**third-party action は 1 つも足さない。**

**注意（実装契約）**：値は `--body` で渡さない（プロセス引数に出る）。**必ず stdin（ファイルリダイレクト）で渡す**。`gh` は値を出力しない。

### D3 いつ書き戻すか → **rotate したら、成否・キャンセルを問わず必ず。最後の 1 個**

- `console_api.ConsoleClient.refresh()` が、成功のたびに sink ファイルを**上書き**する（追記しない）。F2 のとおり 1 ジョブで 2 回起きうるが、**最後の書き込みが最後の rotate** になる
- 「プロセス終了時にまとめて書く」方式は**採らない**（タイムアウトや強制終了で書き損ねる）。**rotate した瞬間にディスクへ**置くのがいちばん壊れにくい
- workflow の書き戻しステップは `if: always()`（**成功・失敗・キャンセルのいずれでも走る**）
- **sink が空／存在しないときは何もしない**（rotate していない＝ secret は今も有効）。`exit 0`

### D4 失敗したときの出口 → **§5 に全文。ジョブは必ず赤くする**

要点だけ：**リトライ 3 回 → それでも失敗したら「secret はもう死んでいる。PM が取り直す必要がある」と 3 か所に出して `exit 1`**。degrade 先は今日の運用（R-a）。

### D5 同時実行 → **job 単位の `concurrency`（`cancel-in-progress: false`）**

```yaml
concurrency:
  group: dify-console-${{ inputs.env }}
  cancel-in-progress: false
```

- 付ける対象：**`deploy`・`inspect`・`token_refresh`・`token_revoke`**（コンソールセッションを使う 4 つ）。`kb`・`tests`・`probe` には付けない
- **`cancel-in-progress: false` は load-bearing**。`true` にすると「rotate 済み・書き戻し前」の実行を殺しうる＝ secret が死ぬ。**絶対に `true` にしない**
- 待たされた 2 本目は、1 本目の書き戻し完了後に**新しい値**で走る（ジョブ開始時に secret を読むのは `env:` 展開のタイミング＝そのジョブが実際に開始した時点）
- **確認要 V-C**：`environment:` を持つジョブの `secrets.*` 展開が「ジョブ開始時点の値」であることは実測で確認する（PR-3 の実機検証。2 本連続実行で 2 本目が成功すれば確定）。もし「run 作成時点の値」で固定されるなら、直列化しても 2 本目は必ず落ちる → その場合は **`concurrency` で待たせるのではなく、2 本目を即座に落とす**方針に変える（§12 判断 3）

### D6 `logout`（B3）との関係 → **矛盾する。書き戻し運用では B3 を止める**

§4-4 に詳述。判定は「**両立しない**」。

### D7 sink の置き場 → **`${{ runner.temp }}` 配下。リポジトリ配下は Python が拒否する**

`DIFY_REFRESH_SINK` が**リポジトリの作業ツリー配下**を指していたら、`console_api` は**値を書かずに `ConsoleAPIError`** を投げる。コミット事故を機械で止める（`git add` の事故は `CLAUDE.md` §2-10 の一発アウト）。

### D8 `_mask()` に PAT を足すか → **足す（保険）**

PAT は設計上 Python プロセスに渡らない（workflow の shell ステップだけが `GH_TOKEN` として持つ）。**足す必要は無い**が、**1 行 2 パターンで将来の事故を潰せる**ので足す：

```python
(re.compile(r"\bghp_[A-Za-z0-9]{20,}"), "ghp_***"),
(re.compile(r"\bgithub_pat_[A-Za-z0-9_]{20,}"), "github_pat_***"),
```

### D9 実機検証は別 Issue（`run:*` は 1 つだけ）

本 Issue は **`run:cloud`**（コード・ワークフロー・文書・モックサーバによる単体テストまで。ネットワーク不要）。**PAT を作って実機で 1 回回す**のは `run:runner`（＋ PM の GitHub 画面操作）なので、**PR-3 の中で別 Issue を起票する**（`CLAUDE.md` §7「2 つ付くのは Issue を分割する合図」）。

---

## §4 詳細設計

### 4-1 全体の流れ

```
   ┌─────────────────────── job: deploy / inspect / token_refresh ───────────────────────┐
   │                                                                                     │
   │ [1] Preflight（PAT の有無を見る。値は出さない）                                        │
   │      GH_SECRETS_PAT が空  → WRITEBACK=0。DIFY_REFRESH_SINK を **設定しない**            │
   │                             （＝従来の R-a 運用。B3 の logout が復活する）              │
   │      GH_SECRETS_PAT あり  → WRITEBACK=1。DIFY_REFRESH_SINK=$RUNNER_TEMP/dify-refresh.new│
   │                                                                                     │
   │ [2] 本体（python3 cloud_deploy.py / inspect_rerank.py / console_session.py）           │
   │      client_from_env() → refresh()  ──rotate①──▶ sink へ書き出し（0600・改行なし）      │
   │      …作業…                                                                          │
   │      60 分超えなら _req() が 1 回だけ再取得 ──rotate②──▶ sink を **上書き**             │
   │      finally: safe_logout() → **sink 有効ならスキップ**（§4-4）                         │
   │                                                                                     │
   │ [3] Write back（if: always()。成功・失敗・キャンセルのいずれでも走る）                    │
   │      sink が無い/空          → 「rotate していない」旨を出して exit 0                    │
   │      形式検査 NG            → §5-2 の異常終了（書き込まない）                            │
   │      gh secret set（stdin） → 3 回までリトライ                                          │
   │      成功                  → sink を消す。updatedAt を表示（名前と時刻だけ）              │
   │      失敗                  → §5-2 の異常終了                                           │
   └─────────────────────────────────────────────────────────────────────────────────────┘
```

### 4-2 `console_api.py` の変更（C1）

```python
REFRESH_SINK_ENV = "DIFY_REFRESH_SINK"

# 書き戻す値として許すかたち（値そのものはログに出さない。長さと文字種だけを見る）
_REFRESH_VALUE_RE = re.compile(r"\A[A-Za-z0-9._~+/=-]{20,4096}\Z")
```

**a. rotate のたびに sink へ書く**

`refresh()` の末尾（`_absorb_session_cookies()` と access/csrf の存在検査を通ったあと、`self._auth_mode = "refresh"` の直後）で `self._write_refresh_sink()` を呼ぶ。

`_write_refresh_sink()` の契約：

1. `path = os.environ.get(REFRESH_SINK_ENV, "").strip()`。空なら**何もせず `False`**（既存の挙動・ローカル実行・selfhost に影響しない）
2. `path` を `os.path.realpath()` で解決し、**リポジトリの作業ツリー（`Path(__file__).resolve().parents[2]`）配下なら `ConsoleAPIError`**（D7）。メッセージに値は入れない
3. `self._refresh_token` が `_REFRESH_VALUE_RE` に**一致しなければ `ConsoleAPIError`**（形が想定と違う＝実装の不具合。ゴミを書かない）
4. `os.open(path + ".tmp", O_CREAT|O_WRONLY|O_TRUNC, 0o600)` に**末尾改行なし**で書き、`os.replace()` で原子的に差し替える
5. `log("新しいリフレッシュトークンを書き出しました（値は表示しません。rotate 通算 N 回目）")`

**b. 書き戻す値の取り方を確定させる（V-B。load-bearing）**

`_cookie_value()` は cookiejar を**順不同**で走査し、`name == suffix or name.endswith(suffix)` の**最初の一致**を返す。`refresh_token` と `__Host-refresh_token` が同時に jar にいると、**どちらが返るかが不定**になる。ふだんは同じ値なので害が無いが、**書き戻しでは「古い方を書いて secret を殺す」事故になりうる**唯一の箇所。

→ `_absorb_session_cookies()` の refresh 取得だけ、**`__Host-refresh_token` を優先し、無ければ `refresh_token`** という**明示の優先順**に変える（access/csrf の取り方は変えない）。

**c. `_MASK_PATTERNS` に PAT の形を 2 つ足す**（D8）

### 4-3 `cloud_deploy.py` の変更（C2）

`safe_logout()` の先頭に 1 段足す：

```python
if os.environ.get(console_api.REFRESH_SINK_ENV, "").strip():
    log("[logout] スキップ（書き戻し運用：このセッションのリフレッシュトークンを次回に引き継ぐため。"
        "設計書 docs/handoff/2026-09-09-refresh-token-writeback.md §4-4。"
        "手動で失効させたいときは op: token_revoke）")
    return
```

**`ConsoleClient.logout()` 自体は変えない**（`op: token_revoke` が明示的に呼ぶため）。止めるのは**自動で呼ばれる経路（B3）だけ**。

### 4-4 B3（ジョブ末尾の `logout`）との矛盾 —— 判定と結論

**判定：両立しない。書き戻しを入れるなら B3 は止めるしかない。**

根拠（F3）：`logout` は `revoke_token_pair` 相当で、**アクセストークンと対のリフレッシュトークンの両方**を無効化する。書き戻す値は**まさにその対のリフレッシュトークン**（`_absorb_session_cookies()` が最後の `refresh` 応答から取ったもの）なので、

```
rotate → sink に新トークン → logout（サーバ側で新トークンが死ぬ） → secret に死体を書き戻す
→ 次の実行は 100% exit 3
```

となり、**書き戻し機能は「毎回必ず失敗する」形で無効化される**。モックサーバがこの挙動をすでに再現している（`access_token -> refresh_token` の対応表を持ち、`logout` で `used_refresh_tokens` に入れる）ので、**この矛盾は実機を待たずに単体テストで証明できる**（§9 の t6）。

**失うもの（正直に）**：前設計 §8-7 の B3 は「**実行後は漏れても無価値**」という性質を作っていた。書き戻しは**その正反対に、意図的に生きたセッションを次回まで持ち越す**機能なので、この性質は**完全に失われる**。「B3 を残したまま書き戻す」うまい方法は無い（`logout` の直前にもう 1 回 rotate しても、`logout` は同じアカウントのそのセッションを潰す）。

**代わりに置く歯止め（B3 の代替）**：

| # | 歯止め | 効果 |
|---|---|---|
| **B3'** | **`op: token_revoke`（新設）**：`logout` を呼んでサーバ側のセッションを殺し、続けて `gh secret delete DIFY_CONSOLE_REFRESH` で secret も消す。**PM が Actions の画面から 1 クリックで「今すぐ無効化」できる** | B3 の「使い終わったら殺す」を**自動から手動**に移す。異変時の即時失効（§8-7 B6）が 1 分から**数十秒**になる |
| **B7** | **PAT が無ければ書き戻し運用に入らない**（§4-5）。sink を設定しない＝ B3 が自動的に復活する | 「書き戻せないのに logout もしない」という最悪の中間状態を作らない |
| **B8** | 既存の B1（Environment）・B2（保存するのは 1 個だけ）・B4（値をログに出さない）・B5（`DELETE` を増やさない機械検査）は**そのまま維持** | 変更なし |

**`op: token_revoke` と `verify.mjs` §15 の関係**：`gh secret delete` は **GitHub の CLI に対する操作**であって、`scripts/dify/**.py` の中の HTTP メソッド `"DELETE"` ではない。§15 の検査（`_req("DELETE", …)` / `method="DELETE"` のリテラル走査）には**一切かからない**。**Dify に対する削除 API は 1 つも増やさない**（`console_session.py` が呼ぶのは `POST /console/api/refresh-token` と `POST /console/api/logout` だけ）。

### 4-5 PAT が無いときのフォールバック（B7。load-bearing）

`GH_SECRETS_PAT` が未設定・空のとき、**`DIFY_REFRESH_SINK` を設定しない**。結果：

- `console_api` は sink を書かない（従来どおり）
- `safe_logout()` は従来どおり `logout` する（B3 復活）
- 書き戻しステップは「sink が無い」ので何もせず `exit 0`
- **つまり、今日とまったく同じ R-a 運用に戻るだけ**。半分だけ危険な状態（「logout もしないし書き戻しもしない」＝セッションを野放しにする）を作らない

Preflight ステップは**値を出さず** `set` / `unset` だけを出し、`unset` のときは Job Summary に

> `GH_SECRETS_PAT` が未設定のため、**従来どおりの使い切り運用**で実行します（実行後にリフレッシュトークンは無効化されます。次回は取り直しが必要です）。自動更新を有効にする手順は `dify/DEPLOY.md` §10-2。

と出す。

### 4-6 `console_session.py`（C3。新規）

`--env <env>` で `dify/env/<env>/env.yml` の `dify.console_url` を読む（`cloud_deploy.py` と同じ読み方を再利用）。サブコマンド 2 つ：

| コマンド | 動作 | 終了コード |
|---|---|---|
| `refresh`（既定） | `client_from_env()` → （sink は `console_api` が自動で書く）→ **`list_apps()` を 1 回だけ**呼んで「セッションが本当に使えること」を確かめ、**件数だけ**出す → `logout` は**しない** | 0 / 2 / 3 / 4（`console_api._print_and_exit_for_error` と同じ表） |
| `revoke` | `client_from_env()` → `client.logout()` → **sink ファイルがあれば削除**（死んだ値を書き戻させない） | 同上 |

**`revoke` は Dify のアプリ・KB を一切触らない。**

### 4-7 `dify-ops.yml` の変更（C4）

- `op` の選択肢に **`token_refresh`・`token_revoke`** を追加。`validate` の `case` にも追加。**この 2 つは `codes` を要求しない**（`probe` と同じ扱い）。`token_revoke` は**書き込み（無効化）なので `confirm` に固定文字列 `revoke` を要求する**
- ジョブ 2 つを追加（`token_refresh`・`token_revoke`）。どちらも `environment: dify-cloud-master`、`permissions: contents: read`、`timeout-minutes: 10`
- `deploy`・`inspect`・`token_refresh` に **Preflight → 本体 → Write back（`if: always()`）** の 3 ステップ構成を入れる
- `token_revoke` には**書き戻しステップを付けない**（代わりに `gh secret delete`）
- 4 ジョブに D5 の `concurrency`
- **`permissions` は上げない。** 書き戻しは `GITHUB_TOKEN` ではなく PAT で行うため、`contents: read` のまま（`CLAUDE.md` の「最小」を守る）

書き戻しステップ（実装の骨。**`TARGET_SECRET` は固定文字列。`inputs.*` から作らない**）：

```yaml
- name: Write back the rotated refresh token
  if: always()
  env:
    GH_TOKEN: ${{ secrets.GH_SECRETS_PAT }}
    GH_REPO: ${{ github.repository }}
    SINK: ${{ runner.temp }}/dify-refresh.new
    TARGET_ENV: dify-cloud-master        # 固定
    TARGET_SECRET: DIFY_CONSOLE_REFRESH  # 固定
  run: |
    set -euo pipefail            # set -x は禁止
    ...
```

順序（すべて値を出さない）：

1. `[ -s "$SINK" ]` でなければ「rotate していないため書き戻し不要」→ `exit 0`
2. `GH_TOKEN` が空 → §5-2 の異常終了（本来 Preflight で sink を作らないので到達しないが、保険）
3. 形式検査：`LC_ALL=C grep -qE '^[A-Za-z0-9._~+/=-]{20,4096}$' "$SINK"` かつ **行数が 1 で末尾改行が無い**こと。外れたら §5-2 の異常終了（**書き込まない**）
4. `for i in 1 2 3; do gh secret set "$TARGET_SECRET" --env "$TARGET_ENV" < "$SINK" && ok=1 && break; sleep $((i*5)); done`
5. `rm -f "$SINK"`（成否に関わらず。ランナーは破棄されるが明示的に消す）
6. `ok` が立っていなければ §5-2 の異常終了
7. 立っていれば `gh secret list --env "$TARGET_ENV" --json name,updatedAt` の**名前と時刻だけ**を出し、`DIFY_CONSOLE_REFRESH` の `updatedAt` がジョブ開始時刻より後であることを確認。**後になっていなければ §5-2 の異常終了**（`gh` が 0 を返したのに反映されていない、を捕まえる）
   - `--json` が使えない `gh` の版なら `gh secret list --env "$TARGET_ENV"`（名前と更新日だけが出る）にフォールバックしてよい。**どちらも値は出ない**
8. Job Summary に `🔑 リフレッシュトークンを更新しました（updated_at: …）。次回もそのまま実行できます。`

---

## §5 書き戻しに失敗したときの出口（いちばん丁寧に）

### 5-1 何が起きているのか（事実の整理）

| | 状態 |
|---|---|
| Dify サーバ側 | 古いリフレッシュトークンは**すでに失効**（rotate 済み）。新しいものが有効 |
| Environment secret | **古い＝死んだ値**のまま |
| 新しい値 | **ランナーの中にしか無い。ランナーは破棄されるので失われる** |
| Dify のアプリ・KB | **壊れていない**（deploy 本体の結果は別欄のとおり） |
| 次回の実行 | **必ず exit 3（認証エラー）**。既存の `MSG_SESSION_EXPIRED` が出る |

**自動では直らない。PM が取り直すしかない。** ここを曖昧にしないことが本節の目的。

### 5-2 出す文言（**確定。implementer はこの原文をそのまま使う**）

**(a) `::error::` 行（1 行。Actions の赤い注釈に出る）**

```
::error::[要対応] リフレッシュトークンの書き戻しに失敗しました。Environment secret DIFY_CONSOLE_REFRESH はもう使えません（この実行で rotate 済み＝古い値は失効しています）。次回の実行は必ず認証エラー（exit 3）になります。dify/DEPLOY.md §10-4 の手順で取り直してください。
```

**(b) 標準出力（`[WB]` 接頭辞。原因の切り分け用。値は出さない）**

失敗の直前に、該当する 1 行だけを出す：

```
[WB] PAT 未設定（Environment secret GH_SECRETS_PAT が空）
[WB] 形式検査に失敗（実装の不具合。secret には書き込んでいません）
[WB] gh secret set 失敗（3 回リトライ後）
[WB] 反映が確認できない（gh は成功を返したが updatedAt が更新されていない）
```

**(c) Job Summary（そのままコピーして使う）**

```markdown
## ⚠️ リフレッシュトークンの書き戻しに失敗しました（要対応）

**いま何が起きているか**

- この実行はリフレッシュトークンを 1 回使いました（rotate）。**Environment secret `DIFY_CONSOLE_REFRESH` に入っている値は、もう死んでいます。**
- 新しい値はこのランナーの中にだけありましたが、**GitHub の secret に書き戻せませんでした**。ランナーは実行後に破棄されるため、**新しい値は失われました**。
- **Dify 側は壊れていません**（この実行の結果は上の欄のとおりです）。次回の実行が認証エラー（exit 3）になるだけです。

**PM がすること（3 分。1 回だけ）**

1. `dify/DEPLOY.md` §10-4「取り直し」の手順でリフレッシュトークンを取り直す
2. Environment `dify-cloud-master` の `DIFY_CONSOLE_REFRESH` を **Update** で貼り直す
3. `op: token_refresh` を 1 回だけ回して、書き戻しが直っているかを確かめる（**Dify には何も書き込みません**）

**原因の切り分け（上のログの `[WB]` 行を見る）**

| `[WB]` の行 | 原因 | 直し方 |
|---|---|---|
| `PAT 未設定` | Environment secret `GH_SECRETS_PAT` が無い／空 | `dify/DEPLOY.md` §10-2 |
| `gh secret set 失敗` かつ HTTP 403 | PAT の権限不足、または期限切れ | §10-2 の権限表を確認。期限切れなら作り直す |
| `gh secret set 失敗` かつ HTTP 404 | PAT のリポジトリ選択違い／Environment 名の綴り違い | §10-2 の手順 7・10 |
| `形式検査に失敗` | 実装の不具合（secret には**書き込んでいません**） | Issue を立てる。取り直しでは直らない |
| `反映が確認できない` | GitHub 側の一時障害の可能性 | もう一度 `op: token_refresh` を試す |
```

### 5-3 ジョブの見え方

- 書き戻しステップが失敗したら **`exit 1`**（ジョブは赤）。**deploy 本体が成功していても赤くする**（「成功した」と誤解させない。次回が確実に落ちるため）
- ただし **deploy 本体の結果と書き戻しの結果は Job Summary の別項目に分けて書く**（PM が「Dify は壊れていない」と即座に判別できるようにする。§5-2 (c) の冒頭がそれ）

### 5-4 なぜこの設計で「今日より悪くならない」と言えるか

書き戻しが失敗したときの状態は、**今日の運用（R-a：毎回 PM が貼り直す）とまったく同じ**である。増えるのは「赤いジョブと、何をすればよいかが書かれた Job Summary」だけ。**したがって最悪ケースの損失は「PM の 3 分」であり、今日は毎回それを払っている。**

唯一「今日より悪い」点は **B3 を失うこと**（§4-4）。生きたセッションが次の実行まで Environment secret の中に残る。これは §6 で評価する。

---

## §6 危険の評価（`2026-09-08-cloud-auth-and-w4.md` §9-4 の作法）

### 6-1 秘密の増分

| | W4-3/W4-4（いま） | 書き戻し導入後 |
|---|---|---|
| 置く秘密 | `DIFY_DATASET_KEY`（1）＋ `DIFY_APP_KEY_*`（12）＋ `DIFY_CONSOLE_REFRESH`（1） | ＋ **`GH_SECRETS_PAT`（1）** |
| スコープ | Dify アカウント全体（`DIFY_CONSOLE_REFRESH`） | ＋ **この GitHub リポジトリの secret の書き換え** |
| 生存期間 | リフレッシュトークンは**実行のたびに死ぬ**（B3） | **実行をまたいで生き続ける**（B3 を止めるため）／PAT は**最長 1 年** |
| 失効のしやすさ | ブラウザでログアウト＋ secret 削除 | 同左（＋ `op: token_revoke` で数十秒）／PAT は github.com の画面から Delete で即時 |
| 漏れたときの最悪 | Dify のアプリ・KB の削除、課金設定の変更 | ＋ **リポジトリのすべての secret を*すり替え*られる** |

### 6-2 PAT が漏れたら何が起きるか（正直に）

**できること**

| # | できること | 影響 |
|---|---|---|
| P-1 | `DIFY_CONSOLE_REFRESH`・`DIFY_DATASET_KEY`・`DIFY_APP_KEY_*`（12 本）・`GH_SECRETS_PAT` 自身を**別の値に書き換える** | ワークフローが動かなくなる（**DoS**）。PM は各キーを貼り直すことになる |
| P-2 | `DIFY_CONSOLE_REFRESH` を**攻撃者のワークスペースのトークン**にすり替える → その後 PM が `op: deploy` を回すと、**このリポジトリの DSL が攻撃者のワークスペースに投入される** | 投入されるのは `dify/apps/**`（**公開リポジトリにあるものと同じ架空世界のマスタ**）。**機密の流出にはならない**が、気持ちの悪い事態ではある |
| P-3 | `GH_SECRETS_PAT` 自身を書き換えて**締め出す** | PM は github.com の PAT 画面から作り直す（5 分） |
| P-4 | **（V-A 確認済み・危険評価の更新）** `Environments` の権限を持つため、**Environment `dify-cloud-master` の保護ルール**（Required reviewers・deployment branches 等）に対して GitHub が同じ権限カテゴリで括っている操作が可能になる可能性がある | **GitHub がこの権限カテゴリで実際にどの操作まで許可するかは未確認**（推測で書かない）。**ただし現状の実害は小さい**：Required reviewers は PR #199 で既に外してあり、`dify-cloud-master` に戻すべき保護ルールが現状ない。リポジトリの所有者は PM 1 人のみで、環境の保護ルールを設定・変更できる人の集合はもともと PM だけ（他に「奪える」権限者がいない） |

**できないこと（重要）**

| # | できないこと | 理由 |
|---|---|---|
| N-1 | **secret の値を読む** | GitHub の API は secret の値を返さない。`Secrets: Read and write` でも読めるのは**名前と更新日時だけ**。**「盗み見」は原理的にできない** |
| N-2 | **コードの書き換え**（`main` への push・ワークフローの改変） | PAT に `Contents` / `Actions` / `Workflows` を**与えない**ため。**ワークフローを書き換えて秘密を印字させる**という古典的な攻撃経路が塞がれている |
| N-3 | ~~Environment の保護ルールの変更（Required reviewers を外す等）~~ **→ この行は成立しない（V-A 確認済み：2026-09-10、GitHub Actions run #13。`Secrets: Read and write` だけでは Environment secret の public key 取得が 403 になり、`Environments: Read and write` が必須と判明した）。危険評価は上の P-4 に移した** | — |
| N-4 | 他のリポジトリへの操作 | `Only select repositories` で `shoulang0729/dify` **1 つだけ**を選ぶため |
| N-5 | Actions の実行（`workflow_dispatch` の起動） | `Actions` 権限を与えないため |

**漏れうる経路と対策**

| 経路 | 対策 |
|---|---|
| Actions のログ（**公開リポジトリなので誰でも読める**） | `gh` は値を出力しない。`set -x` 禁止・`env`/`printenv` 禁止（既存の作法）。`_MASK_PATTERNS` に PAT 形を追加（D8） |
| third-party action の侵害 | **1 つも足さない**（D2） |
| PyPI 依存の侵害 | **1 つも足さない**（D2） |
| ランナーの侵害 | GitHub ホストランナー（使い捨て）。セルフホストは使わない |
| PM の画面・クリップボード | 生成直後の 1 回だけ表示。**スクショを撮らない・チャットに貼らない**（`CLAUDE.md` §2-10）。貼ったらクリップボードを別の文字列で上書きする |

### 6-3 B3 を失うことの評価

| | B3 あり（いま） | B3 なし（導入後） |
|---|---|---|
| 実行後のセッション | 死んでいる（漏れても無価値） | **生きている。次の実行まで有効** |
| 生きている値の置き場 | — | Environment secret（`dify-cloud-master`）1 か所のみ |
| 生きている値を読める人 | — | **GitHub の secret は誰にも読めない**（N-1）。読めるのは「このリポジトリのワークフローを書き換えられる人」＝ `main` への write 権限を持つ人。それは**今日 `DIFY_APP_KEY_*` 13 本を読める人と同じ集合** |
| 最長の生存期間 | 1 ジョブ | **リフレッシュトークンの寿命 30 日**（使うたびに更新されるので、回し続ける限り実質無期限） |
| 止め方 | 自動 | **`op: token_revoke` で手動**（B3'）。またはブラウザでログアウト |

**評価**：**危険は上がる。** 「実行後は無価値」という一番効いていた歯止め（前設計 §8-7 が「Cookie 案の危険の大半をここで消す」と書いていたもの）を、**利便性と引き換えに手放す**。ただし、生きた値の置き場は Environment secret 1 か所であり、**その中身を読める攻撃者はすでに `DIFY_APP_KEY_*` 13 本も読めている**（同じ場所・同じゲート）。**増える危険の実体は「Dify アカウント全体の権限が、実行の合間にも有効であること」**に絞られる。

### 6-4 PM が「やっぱりやめる」と判断するための材料

**やめる（現状維持＝ R-a）を選ぶべきなのは、次のいずれかに当てはまるとき**：

1. `dify-cloud-master` の Dify アカウントが、**架空世界以外のデータを持つワークスペース**（顧客の実データ・社内文書）にアクセスできる場合 → **生きたセッションを常時置く危険が跳ね上がる**。この場合は先に**ワークスペースを分ける**べき
2. `main` への write 権限を持つ人を**今後増やす予定**がある場合 → ワークフローを書き換えられる人＝実質すべての秘密を使える人なので、増える前に方針を決めるべき
3. **`op: deploy` / `op: inspect` を回す頻度が月 1 回程度に落ち着く**なら、R-a の 3 分は許容範囲。機構を増やさないほうが総合的に安い

**採る（本設計）を選ぶべきなのは**：

- 上の 1〜3 に当てはまらず、**「実行のたびに 3 分」が実際に運用の障害になっている**とき。実測（1 日 2 回消費・うち 1 回は失敗した deploy）はこちらを支持する

**中間案（本設計に含める）**：PAT を置かなければ自動で R-a に戻る（§4-5 B7）。**つまり、機構だけ先に入れて、PAT を置くかどうかは後から決められる。**「PR-1・PR-2 をマージしても、PAT を置くまで挙動は今日と 1 ミリも変わらない」——これが本設計の安全弁であり、PM が「やっぱりやめる」を**マージ後でも選べる**理由。

---

## §7 `CLAUDE.md` §7 の変更提案（**PM 承認が要る。architect は書き換えない**）

### 7-1 何が衝突しているか

現行 `CLAUDE.md` §7 の記述：

> **秘密**：GitHub に置いてよいのは `cloud-master` の Service / Datasets API キーだけ（Environment secret `dify-cloud-master`）。**Dify のログイン情報・セッション Cookie は Mac から出さない**（§2-10）

- 本設計は `GH_SECRETS_PAT` を置くので**衝突する**
- **さらに、この記述は現時点ですでに実態と合っていない**：W4-3 で `DIFY_CONSOLE_REFRESH`（＝セッション Cookie の値そのもの）を GitHub に置いた時点で「Service / Datasets API キーだけ」も「セッション Cookie は出さない」も破られている。**本設計とは無関係に、いずれ直す必要がある**

### 7-2 提案する差し替え文（原文。PR-5 でこのとおりに置き換える）

```markdown
- **秘密**：GitHub の Environment secret `dify-cloud-master` に置いてよいのは次の 3 種だけ。
  ① `cloud-master` の Service / Datasets API キー（`DIFY_APP_KEY_*`・`DIFY_DATASET_KEY`）
  ② Dify Console のリフレッシュトークン `DIFY_CONSOLE_REFRESH`（#121 W4-3。1 回使うと rotate される。
     取り方・失効は `dify/DEPLOY.md` §8）
  ③ 書き戻し用の fine-grained PAT `GH_SECRETS_PAT`（このリポジトリのみ・`Secrets: Read and write` のみ・
     期限 1 年。用途は ② の自動更新だけ。`dify/DEPLOY.md` §10・設計書
     `docs/handoff/2026-09-09-refresh-token-writeback.md` §6）
  **Dify のログイン情報（メール・パスワード）と、② 以外のセッション情報は Mac から出さない**（§2-10）。
  ③ は**このリポジトリのすべての secret を書き換えられる**強い資格情報である（値は読めない）。
  **4 つ目を足すのは PM 判断**で、足したらこの一覧を同時に更新する。
```

**この差し替えは PM の承認を得てから、単独の PR（PR-5）で入れる。** 本設計の PR-1〜PR-4 は `CLAUDE.md` を触らない。

---

## §8 PM の手作業（`dify/DEPLOY.md` §10 の原稿）

**`DEPLOY.md` は §8・§9 まで使用中なので、新設は §10**（実物で確認済み）。以下をそのまま `dify/DEPLOY.md` の末尾に足す（implementer は文面を変えない。`【…】` は実測後に埋める）。

---

### §10-1 何が変わるか

**これまで**：`op: deploy` / `op: inspect` を回すたびに、ブラウザから `__Host-refresh_token` を取って GitHub の secret に貼り直していた（§8）。

**これから**：**ジョブが自分で新しい値を書き戻す。** PM の手作業は **PAT を 1 回作るだけ**になる。

**注意（トレードオフ）**：この運用では、ジョブの後も Dify のセッションが**生きたまま**残る（従来は毎回 `logout` して殺していた）。今すぐ無効化したいときは **§10-5** を使う。

### §10-2 最初の 1 回：書き戻し用の PAT を作る（10 分）

**値を画面に出したまま共有しない。スクリーンショットを撮らない。チャットに貼らない**（`CLAUDE.md` §2-10）。

1. GitHub の右上のアバター → **Settings**（リポジトリの Settings ではなく**アカウントの** Settings）
2. 左メニューのいちばん下 **Developer settings**
3. **Personal access tokens** → **Fine-grained tokens**（classic ではない）
4. **Generate new token**
5. **Token name**：`dify-ops refresh writeback`
6. **Expiration**：**Custom** → **1 年後の日付**（最長 366 日）。※ **期限が切れたら、この §10-2 をもう一度やる。それが唯一の定期作業**
7. **Resource owner**：`shoulang0729`（自分のアカウント）
8. **Repository access**：**Only select repositories** → **`shoulang0729/dify` の 1 つだけ**を選ぶ
9. **Repository permissions**：**`Secrets`** を **Read and write** にする。**それ以外は触らない**（`Metadata: Read-only` は自動で付く）
   - 【V-A で `Environments: Read and write` も必要と判明した場合は、ここに 1 行足す】
10. **Generate token** → 値が 1 度だけ表示される。**このページを離れると二度と表示されない**
11. **別のタブ**で：リポジトリ → **Settings** → **Environments** → **`dify-cloud-master`** → **Environment secrets** → **Add secret**
    - **Name**：`GH_SECRETS_PAT`（**綴りを間違えると書き戻しが動かない**）
    - **Secret**：手順 10 の値を貼る（手で打たない）
    - **Add secret**
12. PAT のタブに戻って閉じる。**クリップボードを別の文字列で上書きする**（適当な語をコピーする）

### §10-3 動作確認（1 回だけ・Dify には何も書き込まない）

1. Actions タブ → `dify-ops` → **Run workflow**
2. `op`：**`token_refresh`** ／ `codes`：空のまま ／ `env`：`cloud-master`
3. 緑になり、Job Summary に **`🔑 リフレッシュトークンを更新しました`** が出れば成功
4. **もう一度**同じ `op: token_refresh` を回す。**2 回目も緑になれば、書き戻しが本当に効いている**（従来なら 2 回目は必ず認証エラーだった）

赤くなったら Job Summary の **原因の切り分け表**を見る。

### §10-4 取り直し（書き戻しに失敗したとき・30 日以上回さなかったとき）

**推奨：Dify のふだん使いのタブとは別に、シークレット（プライベート）ウィンドウで取る。**
理由：リフレッシュトークンは**先に使ったほうが勝つ**。ふだん使いのタブと同じ値を CI に渡すと、**タブを開いた瞬間に CI 側が死ぬ**（またはその逆でタブがログアウトする）。

1. **シークレットウィンドウ**で `https://cloud.dify.ai` を開き、**そこで新しくログイン**する
2. 開発者ツール（⌥⌘I）→ **Application** → **Cookies** → `https://cloud.dify.ai`
3. **`__Host-refresh_token` の Value** を右クリック → **Copy value**
4. GitHub → **Settings → Environments → `dify-cloud-master` → `DIFY_CONSOLE_REFRESH` → Update** に貼る
5. **シークレットウィンドウを、ログアウトせずにそのまま閉じる**（ログアウトすると貼った値も死ぬ）
6. §10-3 の動作確認を 1 回だけ回す

### §10-5 今すぐセッションを無効化したいとき（異変時）

**`op: token_revoke`**（`confirm` に固定文字列 `revoke`）を回す。ジョブは
`POST /console/api/logout`（Dify 側のセッションを殺す）→ `DIFY_CONSOLE_REFRESH` の削除、の順に行う。
次回の実行は「未設定」で `exit 2` になるので、事故的な再利用が起きない。

急いでいる／Actions が使えないときの手動手順（§8 の「異変時の即時失効手順」と同じ）：
Dify のブラウザでログアウト → GitHub で `DIFY_CONSOLE_REFRESH` を削除。
**PAT も止めたいときは** github.com → Settings → Developer settings → Fine-grained tokens → 当該トークン → **Delete**。

### §10-6 やってはいけないこと

- **`Cancel workflow` を押して `deploy` / `inspect` を途中で止める**：rotate 済み・書き戻し前だと、secret が死ぬ（書き戻しステップは `always()` なのでたいていは走るが、強制終了の猶予内に間に合わない可能性がある）。止めたいときは終わるまで待つ
- **同じリフレッシュトークンを Mac のローカル実行（`~/.config/dify/cloud-master.env`）と CI の両方に置く**：先に使ったほうが勝ち、もう一方が死ぬ。**ローカルで Console API を触るときは §10-4 の手順で別のセッションを取る**
- **PAT を repository secret に置く**：Environment のゲートが効かなくなる。必ず Environment `dify-cloud-master` の secret に置く

---

## §9 受け入れ条件

### 9-1 機械で確かめる（すべて `npm test` とは別に、`python3 -m pytest scripts/dify/tests/` 相当で走ること）

| # | 確認 | 期待 |
|---|---|---|
| t1 | `DIFY_REFRESH_SINK` 未設定で `refresh()` | ファイルを 1 つも作らない。既存テストが全部通る |
| t2 | sink 設定で `refresh()` 1 回 | ファイルが**存在・パーミッション 0600・末尾改行なし**・中身が mock が返した新トークンと一致 |
| t3 | `_req()` の 401 自動再取得を誘発して **2 回 rotate** | sink の中身が**2 回目**の値。かつ**その値でモックに `refresh` が通る**（＝生きている） |
| t4 | sink パスがリポジトリ作業ツリー配下 | `ConsoleAPIError`。**ファイルを作らない** |
| t5 | rotate 値が `_REFRESH_VALUE_RE` に合わない（モックに細工） | `ConsoleAPIError`。**ファイルを作らない** |
| **t6** | **sink 設定時に `safe_logout()`** | **`logout` を呼ばない**（モックの呼び出しカウンタが 0）。**さらに sink の値でモックに `refresh` が通る**＝ §4-4 の矛盾が解けていることの証明 |
| t7 | sink 未設定時に `safe_logout()` | **従来どおり `logout` を呼ぶ**（既存挙動の維持）。**その後 sink の値は使えない**（B3 の性質が残っていること） |
| t8 | `console_session.py revoke` | `logout` を呼び、**sink ファイルを削除する** |
| t9 | `_mask()` に `ghp_…` / `github_pat_…` を通す | 伏せられる |

### 9-2 目で確かめる（reviewer の diff 監査）

| # | 確認 |
|---|---|
| r1 | `dify-ops.yml` の `permissions` が **どのジョブも `contents: read` のまま**（上がっていない） |
| r2 | `concurrency` の **`cancel-in-progress` が `false`**。グループに `kb`/`tests`/`probe` が入っていない |
| r3 | 書き戻しステップの `TARGET_SECRET` / `TARGET_ENV` が**固定文字列**で、`inputs.*` から作られていない |
| r4 | `gh secret set` が **`--body` ではなく stdin** で値を受けている |
| r5 | ワークフローに `set -x` / `env` / `printenv` / `echo "$GH_TOKEN"` が**無い** |
| r6 | `mock/**`・`tools/verify.mjs`・`dify/env/**`・`dify/apps/**` の diff が **0 行** |
| r7 | §5-2 の 3 つの文言が**原文どおり**入っている |
| r8 | `CLAUDE.md` の diff が **0 行**（PR-5 を除く） |
| r9 | 新しい pip 依存・新しい action が**足されていない**（`Install Python dependencies` は `pip install pyyaml` のまま） |
| r10 | `verify.mjs` §15 が引き続き PASS（`DELETE` は `kb_upload.delete_document` の 1 か所のまま） |

### 9-3 リポジトリ共通

- `npm test`（`tools/verify.mjs` ＋ `tools/regress.mjs`）が **PASS**。**`regress --update` は打たない**（データ層を触らないため）
- `npm run index` は不要（サービスを足さない）

---

## §10 PR 分割

**ファイル集合が重なるので直列**（PR-1 → PR-2 → PR-3 → PR-4）。PR-5 は独立（PM 承認後）。

| PR | 中身 | 触るファイル | 完了条件 |
|---|---|---|---|
| **PR-0** | **本設計書のみ**（コード変更なし） | `docs/handoff/2026-09-09-refresh-token-writeback.md` | `npm test` PASS |
| **PR-1** | **危険を確かめてから本番に触る回。** ① `console_api.py` の sink（C1 の a/b/c）＋ t1〜t5・t9 ② `op: token_selftest` を workflow に追加：**Dify を一切呼ばず**、固定のダミー値を **`DIFY_CONSOLE_REFRESH_SELFTEST`（捨て用の別 secret）** に `gh secret set` するだけ。**本物のトークンを 1 回も消費せずに、PAT の権限（V-A）・`gh` の封印・Environment の綴りを実測できる** ③ `DEPLOY.md` §10-2 の骨子 | `scripts/dify/console_api.py`・`scripts/dify/tests/test_console_api.py`・`.github/workflows/dify-ops.yml`・`dify/DEPLOY.md` | 単体テスト緑。**`op: token_selftest` が緑になり、V-A の答え（`Secrets` だけで足りるか）が確定して `DEPLOY.md` §10-2 手順 9 に反映されている** |
| **PR-2** | **本番経路。** ① `safe_logout()` の条件化（C2）＋ t6・t7 ② `deploy`・`inspect` に Preflight／書き戻しステップ（§4-7）③ `concurrency`（D5）④ §5-2 の文言 | `scripts/dify/cloud_deploy.py`・`scripts/dify/tests/test_cloud_deploy.py`・`.github/workflows/dify-ops.yml` | t6 が「logout しない＋書き戻した値が生きている」を証明。r1〜r10 |
| **PR-3** | ① `console_session.py`（C3。`refresh` のみ）＋ `op: token_refresh` ② `DEPLOY.md` §10 の完成（§10-1〜§10-4・§10-6）③ **実機検証の Issue を `run:runner` で起票**（PM が PAT を置いたあと、`op: token_refresh` を 2 回連続で緑にする。V-C の確認も兼ねる）④ `op: token_selftest` と `DIFY_CONSOLE_REFRESH_SELFTEST` の後始末（残すか消すかを PR 本文で明示） | `scripts/dify/console_session.py`・`.github/workflows/dify-ops.yml`・`dify/DEPLOY.md` | `op: token_refresh` を 2 回連続で回して 2 回とも緑（実機。別 Issue） |
| **PR-4** | `op: token_revoke`（B3'。`console_session.py revoke` ＋ `gh secret delete`）＋ t8 ＋ `DEPLOY.md` §10-5 | `scripts/dify/console_session.py`・`.github/workflows/dify-ops.yml`・`dify/DEPLOY.md` | `verify.mjs` §15 が PASS のまま。異変時の手順が §10-5 に載っている |
| **PR-5** | **`CLAUDE.md` §7 の秘密の記述を §7-2 の原文に差し替える。PM 承認が前提** | `CLAUDE.md` | PM の明示的な承認コメントが Issue にある |

**PR-1 と PR-2 をマージしても、`GH_SECRETS_PAT` を置くまで挙動は今日と変わらない**（§4-5 B7）。**PM は PR-3 まで進んだ時点で「PAT を置かない」＝現状維持を選べる。**

---

## §11 未確認の前提と、確かめ方

| # | 未確認 | 確かめ方 | いつ |
|---|---|---|---|
| **V-A** | ~~Environment secret の更新に fine-grained PAT が要求する権限（`Secrets` だけか、`Environments` も要るか）~~ | **確認済み（2026-09-10、GitHub Actions run #13）：`Secrets: Read and write` だけでは足りない。**`op: token_selftest` が 3 回リトライしてすべて `HTTP 403: Resource not accessible by personal access token`（エンドポイント `.../environments/dify-cloud-master/secrets/public-key`）。**`Environments: Read and write` も必要。** `DEPLOY.md` §10-2 手順 9・§6-2 N-3／P-4 に反映済み | 済み |
| **V-B** | 実機の Set-Cookie が `__Host-refresh_token` か無印 `refresh_token` か（両方来るか） | PR-2 の実機ログ（**名前だけ**を出す。値は出さない） | PR-3 の実機検証。§4-2 b の優先順で**どちらでも正しく動く**ようにしてあるが、事実は記録する |
| **V-C** | `environment:` を持つジョブの `secrets.*` が「ジョブ開始時点の値」で展開されるか（`concurrency` で待たせた 2 本目が新しい値を読むか） | `op: token_refresh` を 2 本ほぼ同時に投げ、2 本目が緑になるか | PR-3 の実機検証。**赤なら D5 の方針を「待たせる」から「2 本目を即座に落とす」へ変える**（§12 判断 3） |
| **V-D** | `gh secret list --json name,updatedAt` がランナー同梱の `gh` の版で使えるか | PR-1 の `op: token_selftest` の出力 | PR-1。使えなければ `--json` なしにフォールバック |
| **V-E** | Dify Cloud のリフレッシュトークンの寿命が本当に 30 日か（前設計 V4 のまま未確認） | 30 日回さずに放置して試す、はコストが高い。**`op: token_refresh` を月 1 回回せば実務上どうでもよくなる** | §12 判断 2 |

---

## §12 PM が判断すべき点（推奨つき）

| # | 判断 | 選択肢 | architect の推奨 |
|---|---|---|---|
| **1** | **B3（実行後に必ずセッションを殺す）を手放すか** | (a) 手放して書き戻しを入れる ／ (b) やめて R-a のまま | **(a)。ただし §6-4 の 1（架空世界以外のデータを持つワークスペースに繋がっていないか）を PM に確認したい。** 繋がっているなら (b) か、先にワークスペース分離 |
| **2** | **月 1 回の自動延命（`schedule:` cron で `token_refresh`）を入れるか** | (a) 入れない（手動 `op: token_refresh` だけ） ／ (b) 月 1 回の cron を入れる | **(a) から始める。** 理由：cron は「誰も見ていないときに rotate し、書き戻しに失敗して静かに死ぬ」経路を作る。まず手動で回して信頼できてから (b) を検討する。**ただし「30 日以上まったく回さない」期間があるなら (b)** |
| **3** | **V-C が赤だった場合の同時実行の扱い** | (a) 待たせる（`concurrency`） ／ (b) 2 本目を即座に落とす | **実測してから決める。** 落ちるなら (b)（黙って認証エラーになるより、理由が明示される） |
| **4** | **PAT の期限** | (a) 1 年（366 日） ／ (b) 90 日 | **(a)。** PM が定期作業を嫌う前提を優先する。危険は「時間」より「漏洩」に支配されており、失効は画面から即時にできる |
| **5** | **`CLAUDE.md` §7 の差し替え**（§7-2 の原文） | 承認 ／ 修正 ／ 却下 | **承認を求める。** 現行 §7 は `DIFY_CONSOLE_REFRESH` を置いた時点ですでに実態と食い違っており、本設計と無関係に直す必要がある |

---

## §13 参照

- `docs/handoff/2026-09-08-cloud-auth-and-w4.md` §8-1（保存するのは 1 個だけ）・**§8-3（R-a/R-b/R-c。本書が R-b の判定を上書きする）**・§8-4（終了コード表）・§8-7（B1〜B6）・§9-4（秘密が増えることの評価）
- `docs/handoff/2026-09-08-execution-split-and-runner.md` §1-1（操作表 O1〜O10）・§4-2（ランナーの歯止め）
- `dify/DEPLOY.md` §8（リフレッシュトークンの取り方）・§9（`op: deploy`）・**§10（本設計で新設）**
- `CLAUDE.md` §2-10（シークレットを置かない）・§7（実行場所と秘密。**§7-2 で差し替えを提案**）
- 実測：GitHub Actions run #11（`op: inspect`）・run #12（`op: deploy`、exit 3）
