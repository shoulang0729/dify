#!/usr/bin/env bash
#
# ship.sh — v1(ソロ運用)向け 一括リリースフロー
#
#   作業ブランチ作成 → add → commit → push → PR作成 → squashマージ → ブランチ削除 → main最新化
# を 1 コマンドで実行します。
#
# 使い方:
#   scripts/ship.sh "feat: add customer-support app DSL"          # ブランチ名は自動採番
#   scripts/ship.sh "fix: tweak prompt" work/tweak-prompt          # ブランチ名を指定
#
# 前提:
#   - git と GitHub CLI(gh) が使えること( `gh auth login` 済み )
#   - カレントが main で、未コミットの変更がある状態で実行するのが基本
#
# ロールバック:
#   - 1 PR = 1 squash コミットなので、`scripts/rollback.sh` で 1 コミット戻せます。
#
set -euo pipefail

BASE="main"

MSG="${1:-}"
if [[ -z "$MSG" ]]; then
  echo "エラー: コミットメッセージを指定してください。" >&2
  echo '  例: scripts/ship.sh "feat: add ... DSL" [branch-name]' >&2
  exit 1
fi

# ブランチ名(第2引数)。未指定なら日時で自動採番。
BRANCH="${2:-work/$(date +%Y%m%d-%H%M%S)}"

# リポジトリのルートで動かす
cd "$(git rev-parse --show-toplevel)"

# 変更が無ければ何もしない
if git diff --quiet && git diff --cached --quiet && [[ -z "$(git status --porcelain)" ]]; then
  echo "変更がありません。終了します。"
  exit 0
fi

echo "▶ 作業ブランチを作成: $BRANCH"
git switch -c "$BRANCH"

echo "▶ ステージ & コミット"
git add -A
git commit -m "$MSG"

echo "▶ push"
git push -u origin "$BRANCH"

echo "▶ PR 作成"
gh pr create --base "$BASE" --head "$BRANCH" --title "$MSG" \
  --body "Automated ship via scripts/ship.sh (v1 solo flow)."

echo "▶ squash マージ + リモートブランチ削除"
gh pr merge "$BRANCH" --squash --delete-branch

echo "▶ main を最新化"
git switch "$BASE"
git pull origin "$BASE"
git branch -d "$BRANCH" 2>/dev/null || true

echo "✅ Shipped: $MSG"
