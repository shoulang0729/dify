#!/usr/bin/env python3
"""Dify の Console API 共通クライアント（標準ライブラリのみ）。セルフホスト・Cloud 両方で使う。

    from scripts.dify import console_api

    # セルフホスト（email/password ログイン。既存のまま・シグネチャ不変。password は base64 化して送る＝G3）
    client = console_api.ConsoleClient(console_url)
    client.login(email, password)          # DIFY_CONSOLE_EMAIL / DIFY_CONSOLE_PASSWORD から呼ぶのは呼び出し側の責務
    app_id = client.import_dsl(yaml_text)  # 新規作成。既存 app_id を渡せば上書きインポート
    client.publish(app_id)
    client.list_apps()

    # Cloud（リフレッシュトークンによる Cookie 認証。§8-1）
    client = console_api.client_from_env(console_url)   # DIFY_CONSOLE_REFRESH があればそれを使う
    client.import_dsl(yaml_text)
    client.list_apps()
    client.logout()   # B3（§8-7）: refresh 経路のセッションは使い終えたら無効化する（cloud_deploy.py が呼ぶ）

設計: docs/handoff/2026-09-08-cloud-auth-and-w4.md §2・§8・§9（Issue #121 W4-3 PR-4・W4-4 PR-6）
前設計: docs/handoff/2026-09-07-repo-layout-v2.md §4-4・§5-1／docs/handoff/2026-09-08-cloud-console-deploy.md §1・§4-2（Issue #114）

**Cloud 認証の形（§8-1・G1〜G7 の是正）**：保存するのは **リフレッシュトークン 1 個だけ**
（`DIFY_CONSOLE_REFRESH`）。ジョブの冒頭で `POST /console/api/refresh-token` を Cookie
（`refresh_token=<値>`）だけを載せて叩く（`login_required` でも CSRF 必須でもない＝S9）。成功すると
Set-Cookie で access / csrf / refresh の 3 点セットが返るので、それをこのプロセスの中でだけ保持し、
以降のリクエストに **`Authorization: Bearer <access>`・`X-CSRF-Token: <csrf>` ヘッダ・`Cookie` の
両方**（`http.cookiejar` で自動的に運ばれる。G1）を載せる。アクセストークンが 60 分で切れても、
保持しているリフレッシュトークンで **1 回だけ**自動的に取り直して続行する（§8-4）。

セルフホストの email/password ログイン（`login()` / `login_from_env()`）は**そのまま残す**。ただし
サーバは password を base64 デコードする前提（Dify `libs/encryption.py`）のため、**password は
base64 化して送る**（G3。selfhost にも適用）。

`DIFY_CONSOLE_TOKEN`（旧 `console_token` 前提のトークン認証）は **非推奨**（G5）。1.17.0 に
`console_token` は存在しない（Issue #114 N1）ため Cloud には使えないが、`cloud_deploy.py` などの
既存呼び出し側との互換のため `client_from_env()` に**フォールバックとして残す**。新規は
`DIFY_CONSOLE_REFRESH` を使うこと。

値をログに出さない：access_token・csrf_token・refresh_token・Cookie ヘッダ・email・password は
log() に渡さない。例外メッセージは `Bearer <token>` / `app-<id>` / `Cookie: ...` / `X-CSRF-Token: ...` /
`__Host-*=...` / JWT らしき文字列を `***` に置換し、UUID 形式の `app_id` は先頭 8 文字に落として
から出す（`_mask()`。UUID の丸め処理は `masking.mask_ids()` に委譲。Issue #178・#121 G7）。

**注意（確認要）**：`ENDPOINTS` 以下のエンドポイント・レスポンス形は Dify の公開ソース・一般的な Console API の
慣習から推定したもの。実機（Cloud 1.17.0）では確認していないものがある（Issue #114・#121 §13 V1・V7・V8）。
差異が見つかった場合は **`ENDPOINTS` とこのファイルだけ** を直せばよいように、HTTP 呼び出しをこのモジュールに
閉じ込めてある。**このファイルに `DELETE` を送る関数を作らない**（設計書 §9-1・tools/verify.mjs §15）。
"""
import base64
import http.cookiejar
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import masking  # noqa: E402  (scripts/dify/masking.py。上の sys.path.insert が必要)

DEFAULT_TIMEOUT = 60

# Service API と同じ独自 User-Agent（Cloudflare の error 1010 対策。run_tests.py の USER_AGENT と同一文字列）
CONSOLE_USER_AGENT = "dify-scripts/1.0 (+https://github.com/shoulang0729/dify)"

# エンドポイントのパスは 1 か所にまとめる。Cloud の実パスは未確認（Issue #114 §1-2 C1〜C9）のものがある。
# 実機で違っていたらこの表だけ直せばよい形にする。
ENDPOINTS = {
    "login": "/console/api/login",  # 確認済み: selfhost（F5）。Cloud は未確認（確認要: Issue #114 N1・C1・C8）
    "refresh_token": "/console/api/refresh-token",  # G6（Issue #121 W4-3）。login_required でも CSRF 必須でもない（S9）
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
    "logout": "/console/api/logout",  # B3（Issue #121 W4-4）。POST。確認要: 実パス・応答形（§13。実機は W4-4 実機投入で確認）
}

# refresh-token に載せる Cookie 名の候補（Cloud は __Host- プレフィックス。selfhost・mock は無印のことがある。
# どちらの名でも読めるように両方 Cookie ヘッダへ積む。値は 1 つだけなので漏れは増えない）。
REFRESH_COOKIE_CANDIDATES = ("__Host-refresh_token", "refresh_token")

# 応答 Cookie から access/csrf/refresh を拾うときの照合サフィックス（__Host- の有無を問わない。§8-1）
_ACCESS_COOKIE_SUFFIX = "access_token"
_CSRF_COOKIE_SUFFIX = "csrf_token"
_REFRESH_COOKIE_SUFFIX = "refresh_token"

# dify-ops.yml の probe（op: probe）が使う照合と揃える（設計書 §8-4・§10。単純な "1010" 部分一致は
# 無関係な 403 を誤検出するため、Cloudflare のブロック本文特有の表記に絞る）
_CLOUDFLARE_1010_RE = re.compile(r"error\s*code\s*:\s*1010", re.IGNORECASE)

# 終了コード表（設計書 §8-4）のメッセージ。値は一切含めない。
MSG_SESSION_EXPIRED = (
    "Dify Cloud のセッションが期限切れです（または既に使用済み）。"
    "dify/DEPLOY.md §8 の手順でリフレッシュトークンを取り直し、"
    "Environment secret DIFY_CONSOLE_REFRESH を更新してください。"
)
MSG_CSRF_MISMATCH = "CSRF ヘッダ／Cookie の不一致。実装の不具合として報告してください（V1 の再確認が要る）"
MSG_CLOUDFLARE_BLOCKED = "Cloudflare に弾かれました。独自 User-Agent が付いているか確認してください（DI-004）"
MSG_REFRESH_UNSET = (
    "DIFY_CONSOLE_REFRESH が未設定です"
    "（selfhost の場合は DIFY_CONSOLE_EMAIL / DIFY_CONSOLE_PASSWORD を設定してください。"
    "旧来の DIFY_CONSOLE_TOKEN も動作しますが非推奨です）"
)

# ブラウザからリフレッシュトークンを取り直す手順（値そのものは含めない。§8-6 方法 1 の要約）
TOKEN_HELP = (
    "Dify Cloud のセッションを取り直してください（値はログ・チャットに出さないこと）:\n"
    "  1. ブラウザで Dify Cloud にログイン済みのタブを開く\n"
    "  2. 開発者ツール → Application → Cookies → https://cloud.dify.ai\n"
    "  3. __Host-refresh_token の Value をコピー（画面に出したまま共有しない）\n"
    "  4. GitHub → Settings → Environments → dify-cloud-master → Secrets →\n"
    "     DIFY_CONSOLE_REFRESH を Update で貼り直す\n"
    "  手順の詳細: dify/DEPLOY.md §8\n"
    "  （DIFY_CONSOLE_TOKEN は非推奨です。DIFY_CONSOLE_REFRESH への移行を推奨します）"
)

# 例外メッセージ・ログからトークン/キーらしき値を消す（CLAUDE.md §2-10）
# re.IGNORECASE: "bearer"（小文字）や "App-"（先頭大文字）も素通りさせない（PR-1 レビュー指摘・Issue #114 PR-2）
# G7（Issue #121 W4-3）: Cookie ヘッダ・X-CSRF-Token ヘッダ・__Host-* の Cookie 値・
# access/csrf/refresh トークンの JSON エコー・JWT らしき文字列も伏せる。
_MASK_PATTERNS = (
    (re.compile(r"Bearer\s+\S+", re.IGNORECASE), "Bearer ***"),
    (re.compile(r"app-[A-Za-z0-9]+", re.IGNORECASE), "app-***"),
    (re.compile(r"Set-Cookie\s*:\s*[^\r\n]+", re.IGNORECASE), "Set-Cookie: ***"),
    (re.compile(r"Cookie\s*:\s*[^\r\n]+", re.IGNORECASE), "Cookie: ***"),
    (re.compile(r"X-CSRF-Token\s*:?\s*\S+", re.IGNORECASE), "X-CSRF-Token: ***"),
    (re.compile(r"__Host-[A-Za-z_]+\s*=\s*[^;\s\"']+", re.IGNORECASE), "__Host-***=***"),
    (re.compile(r"\b(access_token|refresh_token|csrf_token)\s*=\s*[^;\s\"'&]+", re.IGNORECASE), r"\1=***"),
    (re.compile(r'"(access_token|refresh_token|csrf_token)"\s*:\s*"[^"]*"', re.IGNORECASE), r'"\1": "***"'),
    (re.compile(r"\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]*\b"), "<jwt>***"),
)


def _mask(text):
    if not text:
        return text
    text = masking.mask_ids(str(text))  # UUID 形式の app_id 等を先頭 8 文字に落とす（Issue #178）
    for pattern, repl in _MASK_PATTERNS:
        text = pattern.sub(repl, text)
    return text


def log(msg):
    print(time.strftime("%H:%M:%S"), _mask(str(msg)), flush=True)


def _b64_password(password):
    """password を base64 化して送る（G3。Cloud・selfhost 共通）。
    サーバは base64 デコードする（Dify 本体 `libs/encryption.py` の `decrypt_password_field`）。

    設計書 docs/handoff/2026-09-08-cloud-auth-and-w4.md §13 V6 は「Cloud だけに限る」案も
    挙げていたが、本 PR（#121 W4-3 PR-4）で **selfhost にも共通適用する**ことに確定した。
    根拠は上記のとおりサーバ側が decrypt_password_field でデコードする前提であること。
    将来 inhouse（selfhost）環境を実際に立てて Console ログインが 401 で失敗するようなら、
    その版の Dify がこのデコードをしていない可能性があるため、まずこの base64 化を疑うこと。"""
    return base64.b64encode(password.encode("utf-8")).decode("ascii")


class ConsoleAPIError(RuntimeError):
    pass


class ConsoleAuthError(ConsoleAPIError):
    """401 / 403（認証エラー全般）。呼び出し側はこれを見て exit 3 とし、必要なら TOKEN_HELP を表示して停止する。"""


class ConsoleSessionExpiredError(ConsoleAuthError):
    """POST /refresh-token が 401（セッション期限切れ、または既に 1 回使われた）。§8-4 の 1 行目。exit 3。"""


class ConsoleCSRFMismatchError(ConsoleAuthError):
    """refresh は 200 だったのに、その後の API が 401（CSRF ヘッダ／Cookie の組み立て誤り）。§8-4 の 2 行目。exit 3。"""


class ConsoleCloudflareBlockedError(ConsoleAPIError):
    """403 かつ本文に Cloudflare の 1010 シグネチャ。§8-4 の 3 行目。exit 4。"""


class ConsoleClient:
    """1 インスタンス = 1 env の Console API セッション。"""

    def __init__(self, console_url, timeout=DEFAULT_TIMEOUT):
        if not console_url:
            raise ConsoleAPIError("console_url が空です（dify/env/<env>/env.yml の dify.console_url）")
        self.base = console_url.rstrip("/")
        self.timeout = timeout
        self._token = None
        self._csrf = None
        self._refresh_token = None
        # 認証経路の記録（"refresh" / "token" / "password" / None）。値そのものではなく経路の種別だけ。
        # cloud_deploy.py の B3（ジョブ末尾の logout）は "refresh"（DIFY_CONSOLE_REFRESH。Cookie 案。
        # §8）のときだけ意味を持つ。selfhost の password 経路・非推奨の DIFY_CONSOLE_TOKEN 経路は
        # 対象にしない（設計書 §8-7 B3 は Cookie 案のセッションに限った歯止め。Issue #121 W4-4）。
        self._auth_mode = None
        # Cookie を保持する（G1）。Set-Cookie は自動的にここへ溜まり、以降のリクエストへ自動的に載る。
        self._cookiejar = http.cookiejar.CookieJar()
        self._opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self._cookiejar))

    # -- 低レベル ------------------------------------------------------
    def set_token(self, token):
        """Bearer トークンを直接セットする（非推奨経路 DIFY_CONSOLE_TOKEN・セルフホストのテスト用）。
        Cookie／CSRF は伴わない（レガシー扱い。§4-3 のクライアント側実装）。値はログに出さない。"""
        if not token:
            raise ConsoleAPIError("token が空です")
        self._token = token
        self._auth_mode = "token"

    def _cookie_value(self, name_suffix):
        """Cookie ジャーから名前が name_suffix と一致・または末尾一致する Cookie の値を返す
        （`__Host-` プレフィックスの有無を問わない。§8-1）。無ければ None。"""
        for cookie in self._cookiejar:
            if cookie.name == name_suffix or cookie.name.endswith(name_suffix):
                return cookie.value
        return None

    def _absorb_session_cookies(self):
        """直近のレスポンスで Set-Cookie された access/csrf/refresh をインスタンスへ取り込む（§8-1）。"""
        access = self._cookie_value(_ACCESS_COOKIE_SUFFIX)
        if access:
            self._token = access
        csrf = self._cookie_value(_CSRF_COOKIE_SUFFIX)
        if csrf:
            self._csrf = csrf
        refresh = self._cookie_value(_REFRESH_COOKIE_SUFFIX)
        if refresh:
            self._refresh_token = refresh

    def _raise_for_error_body(self, e, context):
        """HTTPError の本文を読み、Cloudflare の 1010 シグネチャを最優先で判定する（§8-4・§10）。
        呼び出し側はこの戻り値（raw_body）を使って残りの分岐を行う。"""
        raw_body = e.read().decode("utf-8", "replace")
        if e.code == 403 and _CLOUDFLARE_1010_RE.search(raw_body):
            raise ConsoleCloudflareBlockedError(MSG_CLOUDFLARE_BLOCKED) from None
        return raw_body

    def _req(self, method, path, body=None, auth=True, _retried=False):
        url = self.base + path
        headers = {"User-Agent": CONSOLE_USER_AGENT}
        if auth:
            if not self._token:
                raise ConsoleAPIError("認証していません（login() か refresh() を先に呼んでください）")
            headers["Authorization"] = "Bearer " + self._token
            if self._csrf:
                # G4: ヘッダと Cookie の両方に同じ値を載せる。Cookie 側は self._cookiejar が
                # HTTPCookieProcessor 経由で自動的に付ける（refresh()/login() で受け取った csrf_token Cookie）。
                headers["X-CSRF-Token"] = self._csrf
        data = None
        if body is not None:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with self._opener.open(req, timeout=self.timeout) as r:
                raw = r.read()
                return r.status, (json.loads(raw) if raw else {})
        except urllib.error.HTTPError as e:
            raw_body = self._raise_for_error_body(e, f"{method} {path}")
            # §8-4 4 行目: ジョブ途中で 401（60 分超え）→ メモリの最新リフレッシュトークンで
            # 1 回だけ自動再取得して継続する。refresh() 自体は _req() を経由しないため無限再帰しない。
            if e.code == 401 and auth and not _retried and self._refresh_token:
                log("アクセストークンが失効した可能性があるため、リフレッシュトークンで 1 回だけ再取得します")
                self.refresh()  # 失敗すれば ConsoleSessionExpiredError がそのまま伝播する（§8-4 の 1 行目と同じ扱い）
                return self._req(method, path, body=body, auth=auth, _retried=True)
            masked = _mask(raw_body)
            msg = f"HTTP {e.code} {method} {path}: {masked[:500]}"
            if e.code == 401 and _retried:
                # refresh に成功した直後なのに 401 → CSRF の組み立てが誤っている（§8-4 の 2 行目）
                raise ConsoleCSRFMismatchError(MSG_CSRF_MISMATCH) from None
            if e.code in (401, 403):
                raise ConsoleAuthError(msg) from None
            raise ConsoleAPIError(msg) from None
        except urllib.error.URLError as e:
            raise ConsoleAPIError(f"接続失敗 {method} {path}: {e.reason}") from None

    # -- API ------------------------------------------------------------
    def login(self, email, password):
        """/console/api/login。email・password は呼び出し側が環境変数
        DIFY_CONSOLE_EMAIL / DIFY_CONSOLE_PASSWORD から読んで渡す。ログには出さない。
        password は base64 化して送る（G3。selfhost にも適用）。
        selfhost は応答本文に access_token が入る（従来どおり）。Cloud/main は本文にトークンを
        返さず Set-Cookie で返す（S5・G2）ため、本文に無ければ Cookie から拾う。"""
        if not email or not password:
            raise ConsoleAPIError(
                "DIFY_CONSOLE_EMAIL / DIFY_CONSOLE_PASSWORD が未設定です（selfhost の Console ログインに必須）"
            )
        _, res = self._req(
            "POST", ENDPOINTS["login"],
            {"email": email, "password": _b64_password(password), "remember_me": True}, auth=False,
        )
        data = res.get("data") or res
        token = data.get("access_token")
        if token:
            self._token = token
            refresh = data.get("refresh_token")
            if refresh:
                self._refresh_token = refresh
        else:
            # Cloud/main の形（G2）: 本文にトークンが無く、Set-Cookie（access/csrf/refresh）で返る
            self._absorb_session_cookies()
        if not self._token:
            raise ConsoleAPIError(
                "login: access_token がレスポンスにも Cookie にもありません（API 形が想定と違う可能性）"
            )
        self._auth_mode = "password"
        log("Console API ログイン成功（値は表示しません）")
        return True

    def refresh(self, refresh_token=None):
        """POST /console/api/refresh-token。Cookie にリフレッシュトークンだけを載せる
        （login_required でも CSRF 必須でもない。S9）。成功すると Set-Cookie ×3（access/csrf/refresh）
        が返り、このインスタンスに保持する（保存するのは呼び出し側の責務。§8-1）。
        401 は ConsoleSessionExpiredError（呼び出し側は exit 3・§8-4 のメッセージ）。
        refresh_token を省略すると、直近に保持している値（自動再取得・§8-4）を使う。"""
        token = refresh_token or self._refresh_token
        if not token:
            raise ConsoleAPIError(MSG_REFRESH_UNSET)
        cookie_header = "; ".join(f"{name}={token}" for name in REFRESH_COOKIE_CANDIDATES)
        url = self.base + ENDPOINTS["refresh_token"]
        headers = {"User-Agent": CONSOLE_USER_AGENT, "Cookie": cookie_header}
        req = urllib.request.Request(url, data=b"", method="POST", headers=headers)
        try:
            with self._opener.open(req, timeout=self.timeout) as r:
                r.read()
        except urllib.error.HTTPError as e:
            self._raise_for_error_body(e, "POST refresh-token")
            if e.code == 401:
                raise ConsoleSessionExpiredError(MSG_SESSION_EXPIRED) from None
            raise ConsoleAPIError(f"HTTP {e.code} POST {ENDPOINTS['refresh_token']}") from None
        except urllib.error.URLError as e:
            raise ConsoleAPIError(f"接続失敗 POST {ENDPOINTS['refresh_token']}: {e.reason}") from None

        self._absorb_session_cookies()
        if not self._token or not self._csrf:
            raise ConsoleAPIError(
                "refresh-token: 応答から access_token / csrf_token の Cookie が取得できません"
                "（API 形が想定と違う可能性。V1 の再確認が要る）"
            )
        self._auth_mode = "refresh"
        log("Console API: リフレッシュトークンで新しいセッションを取得しました（値は表示しません）")
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
            err = _mask(res.get("error", "(詳細不明。確認要: Issue #114 C2)"))
            raise ConsoleAPIError(f"import_dsl 失敗: {err}")
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

    def logout(self):
        """POST /console/api/logout。いま保持しているセッションをサーバ側で無効化する
        （B3。設計書 §8-7・§9-3。Issue #121 W4-4）。`revoke_token_pair` 相当で access/refresh の
        両方が Redis 側から消える想定（実機のレスポンス形は未確認。§13）。

        未認証（`_token` が無い）なら何もせず False を返す（まだセッションを確立していないのに
        呼ばれた場合。エラーにはしない）。それ以外は通常の `_req` と同じく失敗時に
        `ConsoleAPIError`（またはそのサブクラス）を送出する。**呼び出し側（cloud_deploy.py）が
        deploy 全体の成否に影響させないよう、この呼び出しは必ず try/except で包むこと**
        （このメソッド自身は握りつぶさない。他の API メソッドと形を揃えるため）。

        `DELETE` は使わない（`POST`。tools/verify.mjs §15・console_api.py の docstring の歯止めに抵触しない）。"""
        if not self._token:
            log("Console API: logout をスキップしました（未認証）")
            return False
        self._req("POST", ENDPOINTS["logout"], {})
        log("Console API: logout 完了（セッションを無効化しました）")
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
    """優先順（G5）: DIFY_CONSOLE_REFRESH（新・Cloud のリフレッシュトークン。§8-1）
    → DIFY_CONSOLE_TOKEN（旧・非推奨のトークン認証。互換のため残す）
    → DIFY_CONSOLE_EMAIL / DIFY_CONSOLE_PASSWORD（selfhost ログイン）。
    どれも無ければ ConsoleAPIError（exit 2）。値はログに出さない。
    401/403 は ConsoleAuthError 系（呼び出し側で §8-4 のメッセージを表示して停止する）。"""
    client = ConsoleClient(console_url, timeout=timeout)
    refresh_token = os.environ.get("DIFY_CONSOLE_REFRESH", "").strip()
    if refresh_token:
        client.refresh(refresh_token)
        log("Console API: Cookie 認証（DIFY_CONSOLE_REFRESH）")
        return client
    token = os.environ.get("DIFY_CONSOLE_TOKEN", "").strip()
    if token:
        client.set_token(token)
        log("Console API: トークン認証（DIFY_CONSOLE_TOKEN。非推奨。DIFY_CONSOLE_REFRESH への移行を推奨）")
        return client
    email = os.environ.get("DIFY_CONSOLE_EMAIL", "").strip()
    password = os.environ.get("DIFY_CONSOLE_PASSWORD", "").strip()
    if email and password:
        client.login(email, password)
        return client
    raise ConsoleAPIError(MSG_REFRESH_UNSET)


def import_and_publish(client, code, app_name, yaml_text):
    """既存 app（同名）があれば上書き、無ければ新規作成 → 公開。戻り値: app_id。"""
    existing_id = client.find_app_id_by_name(app_name)
    app_id = client.import_dsl(yaml_text, app_id=existing_id)
    client.publish(app_id)
    return app_id


def _print_and_exit_for_error(e, default_exit):
    """例外を §8-4 の終了コード表のとおりに変換して終了する（値は一切出さない）。"""
    print(_mask(str(e)))
    if isinstance(e, ConsoleCloudflareBlockedError):
        sys.exit(4)
    if isinstance(e, (ConsoleSessionExpiredError, ConsoleCSRFMismatchError)):
        sys.exit(3)
    if isinstance(e, ConsoleAuthError):
        print(TOKEN_HELP)
        sys.exit(3)
    sys.exit(default_exit)


if __name__ == "__main__":  # pragma: no cover
    import argparse

    ap = argparse.ArgumentParser(
        description="Console API の疎通確認（一覧のみ）。"
        "DIFY_CONSOLE_REFRESH があれば Cookie 認証、無ければ DIFY_CONSOLE_TOKEN（非推奨）、"
        "それも無ければ email/password。"
    )
    ap.add_argument("--console-url", required=True, help="例 http://localhost/ や https://cloud.dify.ai （dify/env/<env>/env.yml の dify.console_url）")
    args = ap.parse_args()

    try:
        c = client_from_env(args.console_url)
    except ConsoleAPIError as e:
        _print_and_exit_for_error(e, default_exit=2)

    try:
        apps = c.list_apps()
    except ConsoleAPIError as e:
        _print_and_exit_for_error(e, default_exit=1)
    print(f"アプリ {len(apps)} 件:")
    for a in apps:
        print(_mask(f"  {a.get('id')}: {a.get('name')}"))
    sys.exit(0)
