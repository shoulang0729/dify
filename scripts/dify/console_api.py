#!/usr/bin/env python3
"""セルフホスト Dify（Community 1.15.x 想定）の Console API クライアント（標準ライブラリのみ）。

    from scripts.dify import console_api
    client = console_api.ConsoleClient(console_url)
    client.login(email, password)          # DIFY_CONSOLE_EMAIL / DIFY_CONSOLE_PASSWORD から呼ぶのは呼び出し側の責務
    app_id = client.import_dsl(yaml_text)  # 新規作成。既存 app_id を渡せば上書きインポート
    client.publish(app_id)
    client.list_apps()

設計: docs/handoff/2026-09-07-repo-layout-v2.md §4-4・§5-1

**注意（1.15.x で確認要）**：以下のエンドポイント・レスポンス形は Dify の公開ソース・一般的な Console API の
慣習から推定したもの。本設計書の時点では実機（顧客・社内のセルフホスト 1.15.x）で確認していない。
差異が見つかった場合は **このファイルだけ** を直せばよいように、HTTP 呼び出しをこのモジュールに閉じ込めてある。

Cloud（`edition: cloud`）では使わない：Console API は Cloudflare / Cookie 認証で壊れやすい（Issue #3・CLAUDE.md §6）。
`release.py` は env の `dify.edition` を見て、cloud なら本モジュールを一切呼ばず、URL インポートの手順（`IMPORT.md`）を
出力する側に切り替える。

エンドポイント（想定）
  POST {console_url}/console/api/login
    body: {"email": ..., "password": ..., "remember_me": true}
    resp: {"result": "success", "data": {"access_token": "...", "refresh_token": "..."}}
  POST {console_url}/console/api/apps/imports
    body: {"mode": "yaml-content", "yaml_content": "...", "app_id": <既存appなら>}
    resp: {"id": "...", "status": "completed" | "pending" | "pending_variable" | "failed", "app_id": "...", "error": "..."}
    pending 系は POST {console_url}/console/api/apps/imports/{id}/confirm で確定させる（未確認。1.15.x で確認要）
  GET  {console_url}/console/api/apps?page=1&limit=100
    resp: {"data": [{"id": "...", "name": "..."}], "has_more": bool}
  POST {console_url}/console/api/apps/{app_id}/workflows/publish
    resp: {"result": "success"} 相当

値をログに出さない：access_token・email・password は log() に渡さない。
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

DEFAULT_TIMEOUT = 60


def log(msg):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


class ConsoleAPIError(RuntimeError):
    pass


class ConsoleClient:
    """1 インスタンス = 1 env の Console API セッション。"""

    def __init__(self, console_url, timeout=DEFAULT_TIMEOUT):
        if not console_url:
            raise ConsoleAPIError("console_url が空です（dify/env/<env>/env.yml の dify.console_url）")
        self.base = console_url.rstrip("/")
        self.timeout = timeout
        self._token = None

    # -- 低レベル ------------------------------------------------------
    def _req(self, method, path, body=None, auth=True):
        url = self.base + path
        headers = {}
        if auth:
            if not self._token:
                raise ConsoleAPIError("login() が未実行です（access token がありません）")
            headers["Authorization"] = "Bearer " + self._token
        data = None
        if body is not None:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                raw = r.read()
                return r.status, (json.loads(raw) if raw else {})
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8", "replace")
            raise ConsoleAPIError(f"HTTP {e.code} {method} {path}: {raw[:500]}") from None
        except urllib.error.URLError as e:
            raise ConsoleAPIError(f"接続失敗 {method} {path}: {e.reason}") from None

    # -- API ------------------------------------------------------------
    def login(self, email, password):
        """/console/api/login。email・password は呼び出し側が環境変数
        DIFY_CONSOLE_EMAIL / DIFY_CONSOLE_PASSWORD から読んで渡す。ログには出さない。"""
        if not email or not password:
            raise ConsoleAPIError(
                "DIFY_CONSOLE_EMAIL / DIFY_CONSOLE_PASSWORD が未設定です（selfhost の Console ログインに必須）"
            )
        _, res = self._req(
            "POST", "/console/api/login",
            {"email": email, "password": password, "remember_me": True}, auth=False,
        )
        data = res.get("data") or res
        token = data.get("access_token")
        if not token:
            raise ConsoleAPIError("login: access_token がレスポンスにありません（API 形が想定と違う可能性。1.15.x で確認要）")
        self._token = token
        log("Console API ログイン成功（token は表示しません）")
        return True

    def list_apps(self):
        """/console/api/apps を全ページ取得して返す（[{'id':..., 'name':...}, ...]）。"""
        items, page = [], 1
        while True:
            _, res = self._req("GET", f"/console/api/apps?page={page}&limit=100")
            items.extend(res.get("data") or [])
            if not res.get("has_more"):
                return items
            page += 1

    def find_app_id_by_name(self, name):
        for app in self.list_apps():
            if app.get("name") == name:
                return app.get("id")
        return None

    def import_dsl(self, yaml_text, app_id=None):
        """/console/api/apps/imports。app_id が None なら新規作成、指定すれば既存 app への上書きインポート。
        戻り値: app_id（str）"""
        body = {"mode": "yaml-content", "yaml_content": yaml_text}
        if app_id:
            body["app_id"] = app_id
        _, res = self._req("POST", "/console/api/apps/imports", body)
        status = res.get("status")
        import_id = res.get("id")
        result_app_id = res.get("app_id") or app_id
        if status in ("pending", "pending_variable") and import_id:
            # 1.15.x で確認要：バージョン差異などで確認が要る場合、confirm を叩いて確定させる想定
            _, confirm_res = self._req("POST", f"/console/api/apps/imports/{import_id}/confirm", {})
            result_app_id = confirm_res.get("app_id") or result_app_id
            status = confirm_res.get("status", "completed")
        if status == "failed":
            raise ConsoleAPIError(f"import_dsl 失敗: {res.get('error', '(詳細不明。1.15.x で確認要)')}")
        if not result_app_id:
            raise ConsoleAPIError("import_dsl: app_id がレスポンスから取得できません（API 形が想定と違う可能性）")
        log(f"DSL インポート完了: app_id={result_app_id}（status={status}）")
        return result_app_id

    def publish(self, app_id):
        """/console/api/apps/{id}/workflows/publish。"""
        self._req("POST", f"/console/api/apps/{app_id}/workflows/publish", {})
        log(f"公開完了: app_id={app_id}")
        return True


# ---------------------------------------------------------------------------
# release.py から使う高水準ヘルパー
# ---------------------------------------------------------------------------

def login_from_env(console_url, timeout=DEFAULT_TIMEOUT):
    """DIFY_CONSOLE_EMAIL / DIFY_CONSOLE_PASSWORD を読んでログイン済みクライアントを返す。"""
    email = os.environ.get("DIFY_CONSOLE_EMAIL", "").strip()
    password = os.environ.get("DIFY_CONSOLE_PASSWORD", "").strip()
    client = ConsoleClient(console_url, timeout=timeout)
    client.login(email, password)
    return client


def import_and_publish(client, code, app_name, yaml_text):
    """既存 app（同名）があれば上書き、無ければ新規作成 → 公開。戻り値: app_id。"""
    existing_id = client.find_app_id_by_name(app_name)
    app_id = client.import_dsl(yaml_text, app_id=existing_id)
    client.publish(app_id)
    return app_id


if __name__ == "__main__":  # pragma: no cover
    import argparse

    ap = argparse.ArgumentParser(description="セルフホスト Dify Console API の疎通確認（一覧のみ）")
    ap.add_argument("--console-url", required=True, help="例 http://localhost/  (dify/env/<env>/env.yml の dify.console_url)")
    args = ap.parse_args()
    c = login_from_env(args.console_url)
    apps = c.list_apps()
    print(f"アプリ {len(apps)} 件:")
    for a in apps:
        print(f"  {a.get('id')}: {a.get('name')}")
