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
# 使い方（どちらか一方の認証を設定）:
#   export DIFY_BASE="https://cloud.dify.ai"     # セルフホストなら自分の URL
#
#   # 方式A: アクセストークン（Bearer）
#   export DIFY_TOKEN="eyJ..."                   # __Host-access_token の値
#
#   # 方式B: Cookie 丸ごと（A が 401 のときはこちら）
#   export DIFY_COOKIE="__Host-access_token=eyJ...; __Host-csrf_token=..."
#
#   scripts/dify-export-all.sh                   # apps/*.yml に書き出す
#
# トークンの取り方（今の Cloud は Cookie 方式）:
#   1. ブラウザで Dify にログイン
#   2. DevTools(F12) → Application タブ → Storage → Cookies → https://cloud.dify.ai
#   3. `__Host-access_token` の Value(eyJ... の長い文字列)をコピー → DIFY_TOKEN へ
#   ※ うまくいかない場合は、その行＋他の Cookie をまとめて DIFY_COOKIE へ。
#   ⚠️ トークン/Cookie は自分のログインそのもの。人に渡さない・コミットしない・チャットに貼らない。
#
# エクスポート後:
#   git add apps && scripts/ship.sh "chore: export dify templates"
#
set -euo pipefail

BASE="${DIFY_BASE:-https://cloud.dify.ai}"
API="${BASE%/}/console/api"
OUT="apps"

# 認証ヘッダーを組み立て（Bearer か Cookie のどちらか）
AUTH_ARGS=()
if [ -n "${DIFY_TOKEN:-}" ]; then
  AUTH_ARGS=(-H "Authorization: Bearer ${DIFY_TOKEN}")
elif [ -n "${DIFY_COOKIE:-}" ]; then
  AUTH_ARGS=(-H "Cookie: ${DIFY_COOKIE}")
else
  echo "エラー: DIFY_TOKEN か DIFY_COOKIE のどちらかを設定してください" >&2
  exit 1
fi

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
  resp="$(curl -fsS "${AUTH_ARGS[@]}" "$API/apps?page=${page}&limit=100")" || {
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
    curl -fsS "${AUTH_ARGS[@]}" "$API/apps/${id}/export?include_secret=false" \
      | jq -r '.data' > "$file"
    count=$((count + 1))
  done <<< "$rows"

  [ "$(echo "$resp" | jq -r '.has_more // false')" = "true" ] || break
  page=$((page + 1))
done

echo "✅ ${count} 件を ${OUT}/ にエクスポートしました"
echo "   差分を確認して: git add ${OUT} && scripts/ship.sh \"chore: export dify templates\""
