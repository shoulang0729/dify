#!/usr/bin/env python3
"""
dify-export-all.py — Dify の全アプリ DSL を一括エクスポート（jq・bash 不要 / 標準ライブラリのみ）

⚠️ 注意:
  - Dify の Console API（Web UI 内部API・非公式/未ドキュメント）を叩きます。
  - Cloud では規約面グレー＆仕様変更で壊れやすい。個人利用・自己責任で。
  - アクセストークンは短命（数十分で失効）。失効したら取り直す。
  - トークン/Cookie は自分のログインそのもの。人に渡さない・コミットしない・チャットに貼らない。

使い方（どちらか一方の認証を設定）:
  Windows PowerShell:
    $env:DIFY_BASE="https://cloud.dify.ai"
    $env:DIFY_TOKEN="eyJ..."              # __Host-access_token の値
    python scripts/dify-export-all.py

  Git Bash / macOS / Linux:
    export DIFY_BASE="https://cloud.dify.ai"
    export DIFY_TOKEN="eyJ..."
    python scripts/dify-export-all.py

  Bearer が 401 になる場合は Cookie 方式:
    export DIFY_COOKIE="__Host-access_token=eyJ...; __Host-csrf_token=..."
"""
import json
import os
import re
import sys
import urllib.error
import urllib.request

BASE = (os.environ.get("DIFY_BASE") or "https://cloud.dify.ai").strip().rstrip("/")
TOKEN = (os.environ.get("DIFY_TOKEN") or "").strip()
COOKIE = (os.environ.get("DIFY_COOKIE") or "").strip()
API = BASE + "/console/api"
OUT = "apps"

if not TOKEN and not COOKIE:
    sys.exit("エラー: DIFY_TOKEN か DIFY_COOKIE のどちらかを設定してください")


# Cloud は前段の Cloudflare が「ブラウザっぽくない」リクエストを 403 で弾くため、
# 実ブラウザ相当の User-Agent を付ける。
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36"
)


def req(path):
    headers = {
        "Accept": "application/json",
        "User-Agent": os.environ.get("DIFY_UA", UA),
        "Referer": BASE + "/apps",
        "Origin": BASE,
    }
    if TOKEN:
        headers["Authorization"] = "Bearer " + TOKEN
    if COOKIE:
        headers["Cookie"] = COOKIE
    r = urllib.request.Request(API + path, headers=headers)
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read().decode("utf-8"))


def slug(name):
    s = re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")
    return s or "app"


def main():
    os.makedirs(OUT, exist_ok=True)
    count, page = 0, 1
    while True:
        try:
            data = req(f"/apps?page={page}&limit=100")
        except urllib.error.HTTPError as e:
            sys.exit(f"エラー: 一覧取得 HTTP {e.code}（トークン失効 or エンドポイント要確認）")
        except urllib.error.URLError as e:
            sys.exit(f"エラー: 接続失敗（{e.reason}）")

        apps = data.get("data", [])
        if not apps:
            break

        for app in apps:
            aid = app["id"]
            name = app.get("name", aid)
            try:
                export = req(f"/apps/{aid}/export?include_secret=false")
            except urllib.error.HTTPError as e:
                print(f"  skip: {name}（export HTTP {e.code}）")
                continue
            path = os.path.join(OUT, slug(name) + ".yml")
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(export.get("data", ""))
            print(f"export: {name} -> {path}")
            count += 1

        if not data.get("has_more"):
            break
        page += 1

    print(f"\nOK: {count} 件を {OUT}/ にエクスポートしました")
    print('  次: git add apps && scripts/ship.sh "chore: export dify templates"')


if __name__ == "__main__":
    main()
