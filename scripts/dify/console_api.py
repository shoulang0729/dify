#!/usr/bin/env python3
"""Dify の Console API 共通クライアント（標準ライブラリのみ）。セルフホスト・Cloud 両方で使う。

    from scripts.dify import console_api

    # セルフホスト（email/password ログイン。既存のまま・シグネチャ不変）
    client = console_api.ConsoleClient(console_url)
    client.login(email, password)          # DIFY_CONSOLE_EMAIL / DIFY_CONSOLE_PASSWORD から呼ぶのは呼び出し側の責務
    app_id = client.import_dsl(yaml_text)  # 新規作成。既存 app_id を渡せば上書きインポート
    client.publish(app_id)
    client.list_apps()

    # Cloud（ブラウザの console_token を使うトークン認証）
    client = console_api.client_from_env(console_url)   # DIFY_CONSOLE_TOKEN があればそれを使う
    client.confirm_import(import_id)
    client.get_draft(app_id)
    client.update_draft(app_id, draft)

設計: docs/handoff/2026-09-07-repo-layout-v2.md §4-4・§5-1／docs/handoff/2026-09-08-cloud-console-deploy.md §1・§4-2（Issue #114）

**注意（確認要）**：`ENDPOINTS` 以下のエンドポイント・レスポンス形は Dify の公開ソース・一般的な Console API の
慣習から推定したもの。実機（Cloud・セルフホスト 1.15.x）では確認していないものがある（下記 ENDPOINTS のコメント、
Issue #114 の C1〜C9・確認手順 N1〜N6）。差異が見つかった場合は **`ENDPOINTS` とこのファイルだけ** を直せばよいように、
HTTP 呼び出しをこのモジュールに閉じ込めてある。

Cloud（`edition: cloud`）でも使う：認証は `DIFY_CONSOLE_TOKEN`（ブラウザの localStorage `console_token` を人が 1 回
貼る）によるトークン認証に切り替える（`client_from_env()`）。Cloudflare 対策として独自 User-Agent
（`CONSOLE_USER_AGENT`）を全リクエストに付ける（F1 と同一の仕組み。`run_tests.py` の `USER_AGENT` 参照）。
`release.py` の selfhost 経路（email/password ログイン）は変更しない。

値をログに出さない：access_token・console_token・email・password は log() に渡さない。例外メッセージは
`Bearer <token>` / `app-<id>` らしき文字列を `***` に置換してから出す（`_mask()`）。
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

DEFAULT_TIMEOUT = 60

# Service API と同じ独自 User-Agent（Cloudflare の error 1010 対策。run_tests.py の USER_AGENT と同一文字列）
CONSOLE_USER_AGENT = "dify-scripts/1.0 (+https://github.com/shoulang0729/dify)"

# エンドポイントのパスは 1 か所にまとめる。Cloud の実パスは未確認（Issue #114 §1-2 C1〜C9）のものがある。
# 実機で違っていたらこの表だけ直せばよい形にする。
ENDPOINTS = {
    "login": "/console/api/login",  # 確認済み: selfhost（F5）。Cloud は未確認（確認要: Issue #114 N1・C1・C8）
    "apps": "/console/api/apps",  # ページング一覧。確認済み: selfhost（F5・F7）
    "apps_imports": "/console/api/apps/imports",
    # 確認要（Issue #114 N2 で確定）: body（mode/yaml_content/app_id）・response（id/status/app_id）が
    # Cloud の版でも同じ形か（C2）
    "apps_imports_confirm": "/console/api/apps/imports/{import_id}/confirm",
    # 確認要（Issue #114 N2 で確定）: pending 系の確定パス・呼び出し条件（C3）
    "workflows_publish": "/console/api/apps/{app_id}/workflows/publish",
    # 確認要（Issue #114 N3 で確定）: チャットボット系（非 workflow）は別パスの可能性（C4）
    "workflows_draft": "/console/api/apps/{app_id}/workflows/draft",
    # 確認要（Issue #114 N4 で確定）: GET/POST の body・response のトップレベルキー形（C5）
    "api_keys": "/console/api/apps/{app_id}/api-keys",
    # 確認要（Issue #114 N6 で確定）: 発行応答に平文 token が入るか（C7）。PR-4 で使用予定。PR-1 では未使用
}

# ブラウザからトークンを取り直す手順（値そのものは含めない。401/403 のときにこの手順を表示して停止する）
TOKEN_HELP = (
    "DIFY_CONSOLE_TOKEN が無効、または期限切れの可能性があります。ブラウザから取り直してください:\n"
    "  1. Chrome 等で Dify Cloud（例 https://cloud.dify.ai）にログイン\n"
    "  2. 開発者ツール → Application → Local Storage → 該当オリジン\n"
    "  3. キー console_token の値をコピー\n"
    "  4. ~/.config/dify/<env>.env の DIFY_CONSOLE_TOKEN= に貼って保存（リポジトリの中には置かない）"
)

# 例外メッセージ・ログからトークン/キーらしき値を消す（CLAUDE.md §2-10）
# re.IGNORECASE: "bearer"（小文字）や "App-"（先頭大文字）も素通りさせない（PR-1 レビュー指摘・Issue #114 PR-2）
_MASK_PATTERNS = (
    (re.compile(r"Bearer\s+\S+", re.IGNORECASE), "Bearer ***"),
    (re.compile(r"app-[A-Za-z0-9]+", re.IGNORECASE), "app-***"),
)


def _mask(text):
    if not text:
        return text
    for pattern, repl in _MASK_PATTERNS:
        text = pattern.sub(repl, text)
    return text


def log(msg):
    print(time.strftime("%H:%M:%S"), _mask(str(msg)), flush=True)


class ConsoleAPIError(RuntimeError):
    pass


class ConsoleAuthError(ConsoleAPIError):
    """401 / 403（認証エラー）。呼び出し側はこれを見て exit 3 とし、TOKEN_HELP を表示して停止する。"""


class ConsoleClient:
    """1 インスタンス = 1 env の Console API セッション。"""

    def __init__(self, console_url, timeout=DEFAULT_TIMEOUT):
        if not console_url:
            raise ConsoleAPIError("console_url が空です（dify/env/<env>/env.yml の dify.console_url）")
        self.base = console_url.rstrip("/")
        self.timeout = timeout
        self._token = None

    # -- 低レベル ------------------------------------------------------
    def set_token(self, token):
        """ブラウザ由来の console_token を直接セットする（Cloud のトークン認証）。値はログに出さない。"""
        if not token:
            raise ConsoleAPIError("token が空です")
        self._token = token

    def _req(self, method, path, body=None, auth=True):
        url = self.base + path
        headers = {"User-Agent": CONSOLE_USER_AGENT}
        if auth:
            if not self._token:
                raise ConsoleAPIError("認証していません（login() か set_token() を先に呼んでください）")
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
            raw = _mask(e.read().decode("utf-8", "replace"))
            msg = f"HTTP {e.code} {method} {path}: {raw[:500]}"
            if e.code in (401, 403):
                raise ConsoleAuthError(msg) from None
            raise ConsoleAPIError(msg) from None
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
            "POST", ENDPOINTS["login"],
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
            _, res = self._req("GET", f"{ENDPOINTS['apps']}?page={page}&limit=100")
            items.extend(res.get("data") or [])
            if not res.get("has_more"):
                return items
            page += 1

    def find_app_id_by_name(self, name):
        for app in self.list_apps():
            if app.get("name") == name:
                return app.get("id")
        return None

    def import_dsl(self, yaml_text, app_id=None, return_details=False):
        """/console/api/apps/imports。app_id が None なら新規作成、指定すれば既存 app への上書きインポート。
        戻り値: 既定では app_id（str）のみ（release.py の selfhost 経路が使う現行契約）。
        return_details=True のときは (app_id, status, import_id) のタプルを返す（cloud_deploy.py 用）。"""
        body = {"mode": "yaml-content", "yaml_content": yaml_text}
        if app_id:
            body["app_id"] = app_id
        _, res = self._req("POST", ENDPOINTS["apps_imports"], body)
        status = res.get("status")
        import_id = res.get("id")
        result_app_id = res.get("app_id") or app_id
        if status in ("pending", "pending_variable") and import_id:
            confirmed_app_id, status = self.confirm_import(import_id)
            result_app_id = confirmed_app_id or result_app_id
        if status == "failed":
            raise ConsoleAPIError(f"import_dsl 失敗: {res.get('error', '(詳細不明。確認要: Issue #114 C2)')}")
        if not result_app_id:
            raise ConsoleAPIError("import_dsl: app_id がレスポンスから取得できません（API 形が想定と違う可能性）")
        log(f"DSL インポート完了: app_id={result_app_id}（status={status}）")
        if return_details:
            return result_app_id, status, import_id
        return result_app_id

    def confirm_import(self, import_id):
        """/console/api/apps/imports/{id}/confirm。pending 系の import を確定させる（確認要: Issue #114 C3）。
        戻り値: (app_id, status) のタプル。"""
        _, res = self._req("POST", ENDPOINTS["apps_imports_confirm"].format(import_id=import_id), {})
        return res.get("app_id"), res.get("status", "completed")

    def get_draft(self, app_id):
        """GET /console/api/apps/{id}/workflows/draft。ワークフロー下書きを取得する
        （確認要: Issue #114 C5）。戻り値: レスポンス dict（graph・features 等）。"""
        _, res = self._req("GET", ENDPOINTS["workflows_draft"].format(app_id=app_id))
        return res

    def update_draft(self, app_id, draft):
        """POST /console/api/apps/{id}/workflows/draft。ワークフロー下書きを更新する
        （確認要: Issue #114 C5）。draft は get_draft() が返す形に準じた dict。"""
        _, res = self._req("POST", ENDPOINTS["workflows_draft"].format(app_id=app_id), draft)
        return res

    def publish(self, app_id):
        """/console/api/apps/{id}/workflows/publish。"""
        self._req("POST", ENDPOINTS["workflows_publish"].format(app_id=app_id), {})
        log(f"公開完了: app_id={app_id}")
        return True


# ---------------------------------------------------------------------------
# release.py / cloud_deploy.py から使う高水準ヘルパー
# ---------------------------------------------------------------------------

def login_from_env(console_url, timeout=DEFAULT_TIMEOUT):
    """DIFY_CONSOLE_EMAIL / DIFY_CONSOLE_PASSWORD を読んでログイン済みクライアントを返す（selfhost。既存のまま）。"""
    email = os.environ.get("DIFY_CONSOLE_EMAIL", "").strip()
    password = os.environ.get("DIFY_CONSOLE_PASSWORD", "").strip()
    client = ConsoleClient(console_url, timeout=timeout)
    client.login(email, password)
    return client


def client_from_env(console_url, timeout=DEFAULT_TIMEOUT):
    """DIFY_CONSOLE_TOKEN があればトークン認証（Cloud）、無ければ
    DIFY_CONSOLE_EMAIL / DIFY_CONSOLE_PASSWORD でログイン（selfhost）。どちらも無ければ ConsoleAPIError。
    値はログに出さない。401/403 は ConsoleAuthError（呼び出し側で TOKEN_HELP を表示して停止する）。"""
    client = ConsoleClient(console_url, timeout=timeout)
    token = os.environ.get("DIFY_CONSOLE_TOKEN", "").strip()
    if token:
        client.set_token(token)
        log("Console API: トークン認証（DIFY_CONSOLE_TOKEN）")
        return client
    email = os.environ.get("DIFY_CONSOLE_EMAIL", "").strip()
    password = os.environ.get("DIFY_CONSOLE_PASSWORD", "").strip()
    if email and password:
        client.login(email, password)
        return client
    raise ConsoleAPIError(
        "DIFY_CONSOLE_TOKEN、または DIFY_CONSOLE_EMAIL / DIFY_CONSOLE_PASSWORD のいずれも未設定です"
    )


def import_and_publish(client, code, app_name, yaml_text):
    """既存 app（同名）があれば上書き、無ければ新規作成 → 公開。戻り値: app_id。"""
    existing_id = client.find_app_id_by_name(app_name)
    app_id = client.import_dsl(yaml_text, app_id=existing_id)
    client.publish(app_id)
    return app_id


if __name__ == "__main__":  # pragma: no cover
    import argparse

    ap = argparse.ArgumentParser(
        description="Console API の疎通確認（一覧のみ）。DIFY_CONSOLE_TOKEN があればトークン認証、無ければ email/password。"
    )
    ap.add_argument("--console-url", required=True, help="例 http://localhost/ や https://cloud.dify.ai （dify/env/<env>/env.yml の dify.console_url）")
    args = ap.parse_args()

    try:
        c = client_from_env(args.console_url)
    except ConsoleAuthError as e:
        print(_mask(str(e)))
        print(TOKEN_HELP)
        sys.exit(3)
    except ConsoleAPIError as e:
        print(_mask(str(e)))
        sys.exit(2)

    try:
        apps = c.list_apps()
    except ConsoleAuthError as e:
        print(_mask(str(e)))
        print(TOKEN_HELP)
        sys.exit(3)
    except ConsoleAPIError as e:
        print(_mask(str(e)))
        sys.exit(1)
    print(f"アプリ {len(apps)} 件:")
    for a in apps:
        print(f"  {a.get('id')}: {a.get('name')}")
    sys.exit(0)
