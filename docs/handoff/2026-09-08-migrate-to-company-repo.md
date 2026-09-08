# A（`shoulang0729/dify`）→ B（`toshioiinuma-ntt/ndit.dify`）移行手順

- 対象読者：**B 側の作業を行う人**（Mac の Claude Code／PM 本人）。この文書は A（このリポジトリ）側で用意した「A をアーカイブする準備」の一部としてコミットされたもので、実際の B 側の操作はこの文書の手順に沿って**B のマシン／権限**で行う
- レーン: **M/L**（Pages・Secrets・ブランチ保護など GitHub 設定を横断する。設計判断は含まない、手順書）
- 関連 PR：`chore/archive-and-redirect`（A 側。リダイレクトページへの置き換え・`css/**`・`js/**` の削除・`tools/verify.mjs`／`tools/regress.mjs` のアーカイブモード）
- 新 URL（Pages）: `https://toshioiinuma-ntt.github.io/ndit.dify/`
- 旧 URL（Pages・A。移行後はリダイレクトのみ）: `https://shoulang0729.github.io/dify/`

---

## 0. 前提・全体の順序

**リダイレクトを配信してから A をアーカイブする**。逆順（先にアーカイブ）にすると、アーカイブされたリポジトリでは GitHub Actions のワークフローが実行できなくなり（Pages の再デプロイもできない）、`mock/index.html` 等がリダイレクト無しの古い内容のまま固定されてしまう。

順序：

1. **B の作成・履歴の移送**（§1）
2. **B 側の設定**（Pages・メンバー・Secrets・ブランチ保護。§3）
3. **B で動作確認**（`npm test` が B でも ALL PASS、Pages が公開されている）
4. **A 側で `chore/archive-and-redirect` を PR → レビュー → マージ**（このリポジトリ側。リダイレクト 3 ページ・`mock/.archived` 一式。verify/regress はこの PR の時点で用意済み・アーカイブモードで ALL PASS）
5. マージ後、A の Pages が再デプロイされ、`https://shoulang0729.github.io/dify/` が B へ転送されるようになったことを確認
6. **確認できてから** A を Settings → Archive this repository でアーカイブする（§4）

3〜5 を飛ばして先にアーカイブすると、リダイレクトが配信されないまま止まる。

---

## 1. 履歴ごとの移送（git）

### 1-1. 手順

```bash
# 作業用の空きディレクトリで
git clone --bare https://github.com/shoulang0729/dify.git dify-bare-mirror
cd dify-bare-mirror
git push --mirror https://github.com/toshioiinuma-ntt/ndit.dify.git
```

- `toshioiinuma-ntt/ndit.dify` は**先に空のリポジトリとして作成**しておく（README 等の自動生成ファイルは追加しない。`--mirror` は空でないリポジトリに push すると衝突する）
- push 先の URL は HTTPS。SSH の場合は `git@github.com:toshioiinuma-ntt/ndit.dify.git`
- 認証は B に push 権限を持つアカウント（PAT または SSH 鍵）で行う

### 1-2. `--mirror` の注意（load-bearing）

**`git clone --bare` の対象は `https://github.com/shoulang0729/dify.git`（通常の clone URL）であって、ローカルの作業コピーではない。** また、`git clone --mirror`（`--bare` ではなく `--mirror` でクローンする方法）は **PR の内部 ref（`refs/pull/*/head` など）も丸ごと拾ってしまい**、それを `push --mirror` で B に送ろうとすると、GitHub 側は `refs/pull/*` への push を拒否するため **`push --mirror` が失敗する**。

- ○ `git clone --bare <url>` → `git push --mirror <new-url>`（本手順）
- ✕ `git clone --mirror <url>` → `git push --mirror <new-url>`（`refs/pull/*` で失敗しうる）

`--bare` は通常の refs（`refs/heads/*`・`refs/tags/*`）だけを持つミラーになるため、この失敗が起きない。

### 1-3. 確認

- B で `git log --oneline | wc -l` が A と同じコミット数
- B の全ブランチ・全タグが揃っている（`git branch -a`・`git tag`）
- B の最新コミットが A の `main` の最新コミットと一致

---

## 2. git では移らないもの（一覧と対処）

| 項目 | git で移るか | 対処 |
|---|---|---|
| コミット・ブランチ・タグ | ○（`push --mirror`） | 上記 §1 のとおり |
| **Issue・PR・コメント** | ✕ | GitHub は Issue/PR を他リポジトリへ移す標準機能を持たない。個別に「移管」する API/UI は無いため、**A の Issue/PR は A に残したまま参照用として保持**する（A はアーカイブ後も読み取り専用で閲覧できる）。B 側で新規に起票し直す場合は、旧 Issue/PR 番号を本文に `(旧 A #123)` のように書いて紐づける。全件移行が必要なら `gh issue list`/`gh api` でエクスポートし、B 側に手動 import するスクリプトを別途書く（本 PR の範囲外） |
| **Actions の Secrets・Environment** | ✕ | Secrets（Repository/Environment/Organization スコープ）は git に含まれず、API 越しにも値を読み出せない（GitHub の仕様上、書き込みのみ）。**B 側で値を再登録する必要がある**。A 側の値を知っている人（PM）から個別に渡してもらう。§3-3 に登録先の一覧 |
| **ブランチ保護・ルールセット** | ✕ | `Settings → Branches` の保護ルール、`Settings → Rules → Rulesets` は git に含まれない。B 側で作り直す（§3-4） |
| **Pages 設定** | ✕ | `Settings → Pages` の Source（GitHub Actions を使うか、ブランチから配信か）はリポジトリ設定であり git に含まれない。B 側で `Settings → Pages → Source: GitHub Actions` を選び直す（ワークフローファイル自体は `.github/workflows/pages.yml` として git で移るので、Source の選択だけで良い） |
| **「マージ後に head ブランチを自動削除」設定** | ✕ | `Settings → General → Pull Requests → Automatically delete head branches` のチェックボックス。A で有効化した経緯は Issue #59。B でも同じ運用（squash マージ → ブランチ削除）を続けるなら、B 側でも同じチェックを入れる（§3-4） |
| Webhook・連携アプリ（あれば） | ✕ | 個別に B 側で再設定 |
| Star・Watch・Fork 数 | ✕ | GitHub の統計値。移らない（実害なし） |

---

## 3. B 側の設定手順

### 3-1. リポジトリの可視性：**private のまま Pages を public にする**

- B は **private リポジトリ**として作成する（コード自体は非公開のまま）
- `Settings → Pages` で **Source: GitHub Actions** を選択すると、Pages の公開ページ自体は**誰でも閲覧できる public な URL**になる（private リポジトリでも Pages だけ公開できるのが GitHub Pro/Team/Enterprise の機能。A 側の `mock/README.md` にも同じ注記がある）
- 組織アカウント（`toshioiinuma-ntt`）が Pro/Team/Enterprise プランであることを確認してから作業する。プランが対象外だと Pages の Source に GitHub Actions が選べない、または公開できない
- 公開してよいのは**架空データしか入っていないデモだけ**（`CLAUDE.md` §2-10 と同じ判断基準。B でも踏襲する）

### 3-2. メンバー招待

- `Settings → Collaborators and teams` で、A で作業していたメンバー（PM・architect/implementer/reviewer を動かす人）を招待する
- 権限は用途に応じて Write（実装者）／Maintain または Admin（PM・レビュー承認者）を割り当てる

### 3-3. Secrets（Actions）

A 側で使っていた Secrets を洗い出し、同名で B 側に登録する。**値は git に無いので、A の Secrets 設定画面（`Settings → Secrets and variables → Actions`）でキー名だけ確認し、値は元の発行元（Dify のトークン発行画面など）から取り直すか、安全な経路（パスワードマネージャ等。チャットに貼らない。`CLAUDE.md` §2-10）で受け渡す。**

- Repository secrets：キー名の一覧を A の `Settings → Secrets and variables → Actions` からコピーし、B の同じ画面で登録
- Environment（`github-pages` など。`pages.yml` の `environment: name: github-pages` に対応）：B 側でも同名の Environment を作成する。Environment 保護ルール（reviewer 必須など）を使っていた場合はそれも作り直す
- `dify/env/**/env.yml` はプレースホルダ（`${VAR}`）で環境変数を参照する設計（`CLAUDE.md` §2-12）なので、実行時に必要な環境変数（Dify のトークン等）も同様に B 側の Secrets／Environment に登録する

### 3-4. ブランチ保護・ルールセット

- `main` への直接 push 禁止（`CLAUDE.md` §5 の運用と一致させる）
- PR 必須・レビュー必須（reviewer の承認を必須にするかは PM 判断）
- ステータスチェック必須：`verify` ワークフロー（`node tools/verify.mjs && node tools/regress.mjs` 相当）を必須チェックに追加
- `Settings → General → Pull Requests → Automatically delete head branches` を有効化（A の Issue #59 と同じ設定。§2 参照）

### 3-5. Pages 設定の最終確認

- `Settings → Pages` の Source が **GitHub Actions**（"Deploy from a branch" ではない）
- 初回は `main` に何かしら push（または `workflow_dispatch`）して `pages.yml` を走らせ、`https://toshioiinuma-ntt.github.io/ndit.dify/` が実際に開けることを確認する

---

## 4. B での動作確認（A をアーカイブする前に必ず行う）

1. B の作業コピーで `npm test`（`node tools/verify.mjs && node tools/regress.mjs`）が ALL PASS
2. `python3 dify/check.py`・`python3 scripts/dify/render.py --env cloud-master --all --check` が PASS
3. B の Pages（`https://toshioiinuma-ntt.github.io/ndit.dify/`・`/catalog.html`・`/scripts.html`）が実際に開き、カタログ・台本レビューが動く
4. B で `main` 直 commit 禁止・PR 必須が機能している（保護ルールのテスト）

すべて確認できたら、A 側で `chore/archive-and-redirect` を PR → マージする（§0 の 4〜5）。

---

## 5. A をアーカイブする（最後）

1. A の `chore/archive-and-redirect` がマージされ、A の Pages（`https://shoulang0729.github.io/dify/`）を開くと B へ転送されることを確認する
2. A の `Settings → General → Archive this repository` でアーカイブする
3. アーカイブ後の A は読み取り専用になる（Issue/PR のコメントも締め切られる）。**Pages の配信自体はアーカイブ後も継続される**（静的ファイルの配信であり、Actions の再実行は不要な限り止まらない）ため、リダイレクトは機能し続ける

---

## 6. 移行後にやること

- **`docs/handoff/2026-09-08-execution-split-and-runner.md` §9（セルフホストランナーの安全性）を更新する**：B が private リポジトリになることで、fork からの PR 経由でセルフホストランナー上のワークフローが動く経路が無くなる（private リポジトリは外部からの fork ベース PR を受け付けない）ため、同文書が前提にしていた「fork 経由の危険性」の評価が変わり、危険度は下がる。該当ファイルが無い場合は、セルフホストランナーの安全性を扱う設計書を新規に作るか、記載場所を PM に確認する
- A 側の未クローズ Issue・進行中 PR がある場合、B 側で起票し直すか、A に残したまま参照だけする方針を PM が決める（§2 の「移らないもの」参照）
- `CLAUDE.md` の記述は本 PR（`chore/archive-and-redirect`）で「A はアーカイブ、正本は B」に更新済み。B 側でこのファイルをコピーしたあとに古い記述が残っていないか、B 側の PR で最終確認する
