#!/usr/bin/env bash
#
# dify-export-all.sh — Dify の全アプリ DSL を一括エクスポート
#
# ⚠️ 注意（必読）:
#   - これは Dify の **Console API（Web UI 内部API・非公式/未ドキュメント）** を叩きます。
#   - Cloud では規約面グレー＆仕様変更で壊れやすい。**個人利用・自己責任**の範囲で。
#   - console アクセストークンは **短命（数十分で失効）**。失効したら取り直す。
#   - 公式の Service API では DSL の export はできないため、現状これが唯一の手段。
#   - 本格運用はセルフホスト移行後に（Issue #3 / CLAUDE.md「v2 バックログ」参照）。
#
# 必要: curl, jq
#
# 使い方:
#   export DIFY_BASE="https://cloud.dify.ai"     # セルフホストなら自分の URL
#   export DIFY_TOKEN="<console access token>"   # 下記の手順で取得
#   scripts/dify-export-all.sh                   # apps/*.yml に書き出す
#
# トークンの取り方（Cloud）:
#   1. ブラウザで Dify にログイン
#   2. DevTools(F12) → Network タブ → `console/api/...` のリクエストを1つ選ぶ
#   3. Request Headers の `Authorization: Bearer xxxxx` の xxxxx をコピー
#      （または Application → Local Storage の console_token）
#
# エクスポート後:
#   git add apps && scripts/ship.sh "chore: export dify templates"
#
set -euo pipefail

: "${DIFY_TOKEN:?DIFY_TOKEN(console access token) を設定してください}"
BASE="${DIFY_BASE:-https://cloud.dify.ai}"
API="${BASE%/}/console/api"
OUT="apps"
AUTH="Authorization: Bearer ${DIFY_TOKEN}"

command -v jq >/dev/null 2>&1 || { echo "エラー: jq が必要です（brew install jq 等）" >&2; exit 1; }

# リポジトリのルートへ（git 管理下なら）
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
mkdir -p "$OUT"

# アプリ名 → ファイル名スラッグ
slug() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g'
}

page=1
count=0
while : ; do
  resp="$(curl -fsS -H "$AUTH" "$API/apps?page=${page}&limit=100")" || {
    echo "エラー: アプリ一覧の取得に失敗。トークン失効 or エンドポイント要確認。" >&2
    exit 1
  }

  rows="$(echo "$resp" | jq -r '.data[]? | "\(.id)\t\(.name)"')"
  [ -z "$rows" ] && break

  while IFS=$'\t' read -r id name; do
    [ -z "$id" ] && continue
    file="$OUT/$(slug "$name").yml"
    echo "▶ export: $name -> $file"
    # include_secret=false: 念のためシークレットを含めない（DSL に鍵は載らない前提）
    curl -fsS -H "$AUTH" "$API/apps/${id}/export?include_secret=false" \
      | jq -r '.data' > "$file"
    count=$((count + 1))
  done <<< "$rows"

  [ "$(echo "$resp" | jq -r '.has_more // false')" = "true" ] || break
  page=$((page + 1))
done

echo "✅ ${count} 件を ${OUT}/ にエクスポートしました"
echo "   差分を確認して: git add ${OUT} && scripts/ship.sh \"chore: export dify templates\""
