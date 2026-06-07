#!/usr/bin/env bash
#
# rollback.sh — v1(ソロ運用)向け 安全なロールバック
#
# 履歴を消さずに「打ち消しコミット(revert)」で元に戻します。
# 1 PR = 1 squash コミットなので、基本は直前の 1 コミットを戻すだけで OK です。
#
# 使い方:
#   scripts/rollback.sh                 # 直前のコミット(HEAD)を打ち消す
#   scripts/rollback.sh <commit-ish>    # 指定コミットを打ち消す(例: a1b2c3d)
#
# 注意:
#   - これは緊急用に main へ直接 revert を push します(ソロ運用前提)。
#   - v2(コラボ運用)では revert も PR 経由に切り替えてください。
#
set -euo pipefail

BASE="main"
TARGET="${1:-HEAD}"

cd "$(git rev-parse --show-toplevel)"

echo "▶ main を最新化"
git switch "$BASE"
git pull origin "$BASE"

echo "▶ revert: $TARGET"
git revert --no-edit "$TARGET"

echo "▶ push"
git push origin "$BASE"

echo "✅ Reverted: $TARGET"
