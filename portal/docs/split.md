# portal/docs/split.md — GitLab へ切り出す手順（`git subtree split`）

設計書: `docs/handoff/2026-09-11-repo-layout-v3.md` §4-1・§4-2 S-7。

**いつ使うか**：本番に実データを入れる日（フェーズ 2）。`portal/` の正本を
`shoulang0729/dify` から GitLab Self-Managed の独立リポジトリへ移すとき。**それまでは使わない
（`portal/` の正本は `shoulang0729/dify` の `portal/` のまま）。**

## 手順

`shoulang0729/dify` のクローン（`main` が最新の状態）で実行する。

```bash
# 1. portal/** に触れたコミットだけを抜き出した新しいブランチを作る
git subtree split --prefix=portal -b portal-only

# 2. 抜き出した履歴の中身を確認する（コミット数・最新ツリー）
git log --oneline portal-only | wc -l
git ls-tree -r --name-only portal-only | head -20

# 3. 新しいリポジトリ（GitLab）を作り、そこへ push する
git remote add gitlab-portal <GitLab の portal リポジトリ URL>
git push gitlab-portal portal-only:main

# 4. 切り出し先で単体で動くことを確認する（S-1 の担保）
git clone <GitLab の portal リポジトリ URL> /tmp/portal-check
cd /tmp/portal-check
npm ci
npm test   # check-nodata.mjs は通る。check-seed-fresh.mjs は「正本が無い」で skip（FAIL ではない）

# 5. dify 側の portal/ を凍結する（README.md の先頭に「正本は GitLab へ移った」の 1 行を足す。
#    以後 dify 側の portal/ は変更しない）
```

## dry-run（PR-N2 の受け入れ条件。§9-1）

**取り込み PR（PR-N2）の時点で 1 回 dry-run し、結果を PR 本文に貼る。**

```bash
git subtree split --prefix=portal -b portal-split-dryrun
git log --oneline portal-split-dryrun | wc -l          # コミット数
git branch -D portal-split-dryrun                       # dry-run 用ブランチは残さない
```

記録する内容：① コミット数 ② 生成ブランチの最新コミット sha ③ `portal/` 単体で `npm ci && npm test`
が通ったか（`git worktree add` で `portal-split-dryrun` を別ディレクトリにチェックアウトし、
`portal/` の中身だけで `npm ci && npm test` を回して確認する）。

## 切り出し後、GitHub に public ミラーを戻すか

**推奨は「戻さない」**（PM 判断 6。`shoulang0729/dify` `docs/handoff/2026-09-11-repo-layout-v3.md`
§10）。`shoulang0729/portal` は archive のまま残し、将来ミラーが要るときの器にする（§4-3・§7）。
