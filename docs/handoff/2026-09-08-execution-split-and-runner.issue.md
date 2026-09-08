# Issue #121 への追記案（PM が貼る。Issue 本体はまだ更新していない）

> `gh` がこの環境に無いため、追記本文をここに置く。PM が #121 にコメントとして貼る。

---

## 設計しました：往復をなくす道筋（設計書 `docs/handoff/2026-09-08-execution-split-and-runner.md`）

ブランチ `docs/execution-split-design`。PR は PM が作成。

### 分かったこと（結論から）

**Mac が本当に必要なのは「ブラウザのログイン済みセッション」が要る操作だけです。KB 投入とテスト実行は、Mac を必要としていません。**

「Mac でしかできないこと」を操作単位で 10 個に分解すると、理由が 3 種類に割れました。

| 種別 | 操作 | 本当に Mac 固有か |
|---|---|---|
| **(a) ブラウザセッション** | O1 新規インポート／O2 上書きインポート／O3 公開／O4 KB 紐づけ／O7 API キー発行／O8 DSL エクスポート／O10 モデル設定の確認 | **Mac 固有**。Cloud 1.17.0 のコンソール API は httpOnly セッション Cookie ＋ `X-CSRF-Token` で、`console_token` が存在しない（#114 N1 の実機観測）。ブラウザの外から認証できない |
| **(b) 秘密がローカルにしかない** | O5 KB 投入（`kb_upload.py`）／O6 テスト実行（`run_tests.py`） | **Mac 固有ではない**。API キー認証なのでブラウザは不要 |
| **(c) 実行環境から Dify に到達できない** | O5・O6 | **Mac 固有ではない**。GitHub のホストランナーは外に出られる |

つまり実行環境は 2 つではなく **3 つ**あります。本文の表は 2 つを前提にしていたので、そこを更新しました。

| 実行環境 | Dify 到達 | 秘密 | ブラウザ | 常時稼働 |
|---|---|---|---|---|
| クラウド（Claude Code on the web） | ✗ | ✗ | ✗ | ○ |
| **GitHub ホストランナー** | **○**（要実証） | **○**（Environment secret） | ✗ | **○** |
| Mac | ○ | ○ | **○** | ✗ |

### 3 案（＋追加案）の比較と推奨

| | A. Mac にセルフホストランナー | B. Playwright にログインさせブラウザの文脈で API | C. 自動化を inhouse に寄せる | **D. GitHub ホストランナー＋Environment secret（追加案）** |
|---|---|---|---|---|
| 何を解くか | 起動と結果回収 | (a) 認証 | (a) の回避 | **(b) 秘密・(c) 到達性** |
| 解かないもの | (a)。中で結局ブラウザが要る | 起動（人のまま） | Cloud のマスタは手作業のまま | (a)。投入・公開はできない |
| 秘密 | 追加なし。ただし**乗っ取られると Mac のローカル資産が全部読める** | 追加なし（Cookie は取り出さない） | selfhost の email/password＝ Cloud より強い秘密 | `cloud-master` の API キーだけを Environment secret に複製 |
| Mac 常駐 | **要る** | 要る | 要らない | **要らない** |
| 壊れやすさ | 中 | **高**（UI 変更・N2/N4 の body が未取得） | 低（ただし inhouse は未構築・台帳で `未確認`） | **低**（スクリプト無変更） |
| 実装量 | 中 | 大 | 特大 | **小** |
| 失敗時 | 最悪 Mac の資産が読まれる／通常は queued のまま | 投入が止まるだけ | 二重管理になる | テストが流れないだけ。**Dify 側に副作用なし** |

**推奨：D →（設計と事実の分離）→ A＋B の順。C は採らない。**

- **D は今日入れられて往復の半分（O5・O6）を消す**。実装量が最小、失敗しても副作用が無く、公開リポジトリの危険を持ち込まない。DI-007〜DI-022 でくり返した「直す → 再テスト」の待ちがそのまま消えます
- **A は「起動」を解くが「認証」を解かない**。A だけ入れても Mac 上で結局ブラウザが要る。**A は B とセットでしか完成しない**
- **C は順序が逆**。顧客デモは Cloud で回っており（台帳で `cloud-master` だけが `確認済`）、`inhouse` は未構築。ただし将来の逃げ道としては残す（`console_api.py` の email/password 経路は無傷）

### セルフホストランナーの安全性（ここは曖昧にしていません）

**このリポジトリは public です。** したがってセルフホストランナーは既定で危険です。誰でも fork してワークフローを書き換えた PR を出せ、それが Mac 上で **PM の権限で走ります**（`~/.config/dify/**` の API キー、ログイン済みブラウザプロファイル、SSH 鍵、キーチェーン）。

入れるなら **S1〜S7 を全部満たすことを必須条件**にします（設計書 §4-2）。

1. **S1** `pull_request` / `pull_request_target` でセルフホストのジョブを定義しない。**`workflow_dispatch` 限定**
2. **S2** `runs-on: [self-hosted, macOS, dify-mac]`（`self-hosted` 単独にしない）
3. **S3** `--ephemeral` で 1 ジョブごとに登録解除。作業ディレクトリを消す
4. **S4** **専用の macOS ユーザー**で動かし、PM の通常アカウントのホーム・キーチェーン・SSH 鍵を読めなくする（被害を「再発行で回復できる範囲」に閉じ込める）
5. **S5** checkout する ref を入力で受けない（`github.ref` を使う）
6. **S6** Settings → Actions → **Require approval for all outside collaborators**
7. **S7** `permissions:` 最小。既定 `contents: read`

満たせないなら W3 は採用せず、**このコメントの案 1（Mac 側からのポーリング）に落とします**（inbound の実行経路が無いので危険ゼロ、代償は最大 1 時間の待ち）。

### ラベル規約

**2 分類ではなく 3 分類**にします。2 分類だと O5・O6 が `for:mac` に落ちて、上の発見が運用に反映されないためです。

| ラベル | 意味 |
|---|---|
| `run:cloud` | クラウドだけで完結 |
| `run:runner` | (b)(c) だけが要る（KB 投入・テスト）。ホストランナーで回せる |
| `run:mac` | (a) ブラウザセッションが要る |
| `blocked:mac` / `blocked:cloud` | 相手待ち |

- **`for:` ではなく `run:`**：「宛先」ではなく「実行場所の属性」だから（宛先は assignee で表す）。`for:` を選ぶなら rename 5 個で済みます
- 付ける主体：Issue は立てた人、PR は implementer。**`run:*` は 1 つだけ。2 つ付くのは分割の合図**
- `run:mac` の Issue は本文に「Mac が要る操作」を O 番号で列挙する。列挙できないなら `run:mac` ではない

### 設計と実機の事実を分ける（本文の主題）

`dify/state/<env>.yml` は **要ります**。

| | `dify/env/<env>/env.yml`（設計値） | `dify/state/<env>.yml`（実機の事実） |
|---|---|---|
| 意味 | こうしたい | こうなっている |
| 書く主体 | 人（クラウド可） | **機械のみ**。手で編集しない |
| 例 | モデル・KB 論理名・ブランド語・フラグ・`apps:` の**番号一覧** | app id・dataset id・公開時刻・投入した DSL の SHA-256・KB の文書一覧・最終テスト結果 |
| 無いとき | render が exit 2 | **render は成功する**（未解決＝警告） |

- **持たないもの**：API キーの値・トークン・Cookie・顧客の実名・実 URL・メール・人名（`updated_by` は `mac` / `hosted-runner` の 2 値だけ）
- **`cloud-master` だけ git 追跡**、他 env は `.gitignore`（顧客環境の id は §2-10 が禁止）
- `dsl_sha256` を持たせることで **DI-013（Cloud の下書きが Git と乖離していたのに誰も気づかなかった）に Git 側から答えられる**ようになります
- **`dify/env/*/env.yml` は変更不要**（`cloud-master` は既に全件 `id: null`）。Mac の並行作業と衝突しません

### 段階導入と PR 分割

| | 中身 | 触るファイル | 並列 |
|---|---|---|---|
| **W1 / PR-1** | `.github/workflows/dify-ops.yml`（新規・`workflow_dispatch` 限定・`ubuntu-latest`・Environment 承認・入力検証・変更パスガード・結果ブランチ→自動 PR）／PR テンプレート／`dify/DEPLOY.md` §7／設計書／CLAUDE.md §7 文案 | `.github/workflows/dify-ops.yml`・`.github/pull_request_template.md`・`dify/DEPLOY.md`・`docs/handoff/**` | PR-4 と並列可 |
| **W2 / PR-2** | `dify/state/cloud-master.yml`・`.gitignore`・`render.py --state`・`cloud_deploy.py --write-state`・`verify.mjs` §12-e 緩和＋§13 新設 | `scripts/dify/{render,cloud_deploy}.py`・`tools/verify.mjs`・`dify/state/**`・`dify/env/README.md` | **不可**。#98 が一段落してから |
| **W3 / PR-3** | セルフホストランナー経路（S1〜S7 必須）＋ `DEPLOY.md` §8 | `.github/workflows/dify-ops.yml`・`dify/DEPLOY.md` | PR-1 の後。PR-2 とは並列可 |
| **W4 / PR-4** | Playwright 認証ブリッジ（#114 案 2） | `scripts/dify/console_api.py` | PR-1・PR-2 と並列可 |

**触らない範囲（全体）**：`mock/**`・`data/world/**`・`dify/apps/*.yml`・**`dify/env/**/env.yml`**（Mac が並行作業中）・`dify/kb/**`・`dify/tests/*.json`・`.github/workflows/{verify,pages}.yml`・`.claude/**`・`tools/regress.*`・`CLAUDE.md`（文案のみ、適用は PM）

### W1 の受け入れ条件（抜粋）

- トリガが `workflow_dispatch` のみ（`pull_request` / `pull_request_target` / `schedule` を含まない）
- **A1（実証）**：ホストランナーから `run_tests.py --env cloud-master KN-01` を 1 回流し、**Cloudflare 1010 も 401 も出ずに結果ファイルが生成される**
- push 直前の変更パスガードが働き、`dify/results/**`・`dify/state/**` 以外が混ざると **push せずに失敗**する
- ログ・サマリ・結果ファイル・PR 本文に API キーの値が出ない
- `npm test` PASS。`verify.yml`・`pages.yml` に差分が無い。`DEPLOY.md` の従来手順が削られていない

---

## PM に判断していただきたいこと

| # | 判断 | **推奨** | ひとこと |
|---|---|---|---|
| 1 | `cloud-master` の API キーを GitHub Environment secret に複製してよいか | **可** | 効果が最大。1 アプリ／1 ナレッジのスコープで、画面から 1 分で再発行できる。架空データのみ。**不可なら W1 は実施できません** |
| 2 | ラベル名 | **`run:cloud` / `run:runner` / `run:mac` の 3 分類** | `for:` を選ぶなら rename 5 個 |
| 3 | Mac のセルフホストランナー（W3） | **W1・W2 を入れてから再判断**。入れるなら S1〜S7 を全部満たす | 公開リポジトリなので残余リスクがある |
| 4 | ランナーを常駐させるか | **常駐**（S1〜S7 の前提で） | 常駐しないと効果が半減する |
| 5 | `dify/state/` の git 追跡範囲 | **`cloud-master` のみ** | 他 env は `.gitignore`（§2-10） |
| 6 | `dify/state/` に dataset id を直値で書いてよいか | **`cloud-master` に限り可** | `${VAR}` のままだと DI-013 対策の目的を果たさない |
| 7 | `cloud_deploy.py --write-env` | **1 版だけ非推奨警告付きで残す**（書き先は state） | 手順書の移行猶予 |
| 8 | `KNOWN_ISSUES.md` の分離 | **帯分け（実機 DI-001〜499／コード DI-500〜）＋節分け** | 1 系列を保ち、既存 DI-001〜022 を動かさない |
| 9 | 自動 PR の範囲 | **PR 作成まで自動・マージは人** | main 直 push はしない（§5） |
| 10 | `CLAUDE.md` §7 の追記（文案は設計書 §9） | **採用** | 3 エージェント全員が読む場所に無いと機能しない |
| 11 | W2 の着手 | **#98 が一段落してから** | 本文の指示どおり |

## 実装前に潰す未確認

| # | 未確認 | 影響 |
|---|---|---|
| U1 | ホストランナーから `api.dify.ai` に到達できるか（Cloudflare が弾かないか） | **W1 が成立するか**。A1 で実証 |
| U2 | `POST /console/api/apps/imports` と `/workflows/draft` のリクエスト body | W4 の実装形。#114 N2・N4 で **body が保存できず未取得** |
| U3 | サーバ側が publish のチェックリスト検証をするか | W4 で公開まで自動化できるか |
| U4 | `dataset_ids` を焼いた DSL で KB が最初から紐づくか（C6） | 真なら O4 が消え、W3・W4 の価値が大きく上がる。**#114 N5 は未実施** |
| U5 | Environment の required reviewers が `workflow_dispatch` で期待どおり止まるか | §4-1 の前提 |
