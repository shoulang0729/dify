#!/usr/bin/env python3
"""scripts/dify/console_api.py の単体検証（pytest ではなく、単体で走るスクリプト。test_sync_back.py /
test_run_tests.py と同じ作法。mock_server.py を子プロセスで起動して往復させる）。

    python3 scripts/dify/tests/test_console_api.py     # exit 0 で全件 PASS。ネットワークは 127.0.0.1 のみ

設計: docs/handoff/2026-09-08-cloud-console-deploy.md §4-2・§7 PR-1（Issue #114）／
docs/handoff/2026-09-08-cloud-auth-and-w4.md §8・§11「W4-3 PR-4」（Issue #121。G1〜G7・refresh・CSRF）

CI（`npm test`）には入れない（`CLAUDE.md` §3 のコマンド集合を変えない）。実行は implementer と reviewer が手で行う。
"""
import contextlib
import io
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS_DIR = os.path.dirname(TESTS_DIR)
ROOT = os.path.dirname(os.path.dirname(SCRIPTS_DIR))
CONSOLE_API = os.path.join(SCRIPTS_DIR, "console_api.py")
MOCK_SERVER = os.path.join(TESTS_DIR, "mock_server.py")

sys.path.insert(0, SCRIPTS_DIR)
sys.path.insert(0, TESTS_DIR)
import console_api  # noqa: E402
import mock_server  # noqa: E402

RESULTS = []


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond), detail))
    mark = "PASS" if cond else "FAIL"
    print(f"[{mark}] {name}" + (f" — {detail}" if detail and not cond else ""))


def free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def wait_ready(base, timeout=10):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            urllib.request.urlopen(base.rstrip("/") + "/v1/datasets", timeout=1)
            return True
        except urllib.error.HTTPError:
            return True  # 404 でもサーバーは起きている
        except Exception:
            time.sleep(0.2)
    return False


def run_cli(args, env_extra=None):
    env = dict(os.environ)
    env.update(env_extra or {})
    return subprocess.run(
        [sys.executable, CONSOLE_API, *args],
        cwd=ROOT, capture_output=True, text=True, timeout=30, env=env,
    )


SAMPLE_YAML = """app:
  name: KN-99 テストアプリ
  description: test
kind: app
version: 0.6.0
dependencies: []
workflow:
  graph:
    nodes: []
    edges: []
"""


def test_t1_mask():
    msg = "HTTP 401 POST /console/api/login: Authorization: Bearer abcdef123456 app-XyZ09aaaaaaaaaaaaaaaa leaked"
    masked = console_api._mask(msg)
    check("T1: Bearer の値がマスクされる", "abcdef123456" not in masked and "Bearer ***" in masked, masked)
    check("T1: app-... の値がマスクされる", "XyZ09aaaaaaaaaaaaaaaa" not in masked and "app-***" in masked, masked)


def test_t1b_mask_case_insensitive():
    """PR-1 レビュー指摘: bearer（小文字）・App-（先頭大文字）も素通りしないこと（Issue #114 PR-2）。"""
    msg = "leak: bearer lowercasetoken123456 and App-UpperCaseId0000000000"
    masked = console_api._mask(msg)
    check("T1b: 小文字 bearer もマスクされる",
          "lowercasetoken123456" not in masked and "bearer ***" in masked.lower(), masked)
    check("T1b: 先頭大文字 App-... もマスクされる",
          "UpperCaseId0000000000" not in masked and "app-***" in masked.lower(), masked)


def test_t2_endpoints_table():
    for key in ("login", "refresh_token", "apps", "apps_imports", "apps_imports_confirm",
                "workflows_publish", "workflows_draft", "logout"):
        check(f"T2: ENDPOINTS['{key}'] が定義されている", key in console_api.ENDPOINTS, str(console_api.ENDPOINTS.keys()))


def test_t3_selfhost_login_unchanged(base):
    """既存の email/password 経路（login_from_env / import_and_publish）が壊れていないこと。"""
    os.environ["DIFY_CONSOLE_EMAIL"] = "tester@example.com"
    os.environ["DIFY_CONSOLE_PASSWORD"] = "dummy-password"
    try:
        client = console_api.login_from_env(base, timeout=10)
        check("T3: login_from_env が ConsoleClient を返す", isinstance(client, console_api.ConsoleClient))
        app_id = console_api.import_and_publish(client, "KN-99", "KN-99 テストアプリ", SAMPLE_YAML)
        check("T3: import_dsl の戻り値が str のまま", isinstance(app_id, str), repr(app_id))
        apps = client.list_apps()
        check("T3: import 済みアプリが一覧に出る", any(a.get("id") == app_id for a in apps))
    finally:
        os.environ.pop("DIFY_CONSOLE_EMAIL", None)
        os.environ.pop("DIFY_CONSOLE_PASSWORD", None)


def test_t4_token_auth_and_ua(base):
    """DIFY_CONSOLE_TOKEN によるトークン認証。ヘッダに Authorization: Bearer と独自 UA が付くこと。"""
    os.environ["DIFY_CONSOLE_TOKEN"] = "test-console-token"
    try:
        client = console_api.client_from_env(base, timeout=10)
        check("T4: set_token 済みでトークンが保持される", client._token == "test-console-token")
        app_id = client.import_dsl(SAMPLE_YAML)
        check("T4: トークン認証で import_dsl が成功する", isinstance(app_id, str) and app_id, repr(app_id))
        client.publish(app_id)
    finally:
        os.environ.pop("DIFY_CONSOLE_TOKEN", None)

    # User-Agent の確認: urllib.request.Request の実際のヘッダは検証しにくいので、
    # 独自 UA が定数として run_tests.py と同一であることを確認する（実際の付与は _req 内で必ず行われる）。
    run_tests_path = os.path.join(SCRIPTS_DIR, "run_tests.py")
    ua_line = None
    with open(run_tests_path, encoding="utf-8") as fh:
        for line in fh:
            if line.strip().startswith("USER_AGENT ="):
                ua_line = line.split("=", 1)[1].strip().split("#")[0].strip().strip('"')
                break
    check("T4: CONSOLE_USER_AGENT が run_tests.USER_AGENT と同一文字列",
          ua_line is not None and console_api.CONSOLE_USER_AGENT == ua_line,
          f"console={console_api.CONSOLE_USER_AGENT!r} run_tests={ua_line!r}")


def test_t5_confirm_and_draft_roundtrip(base):
    """confirm_import / get_draft / update_draft の往復。
    import_dsl() は pending を自動で confirm するので（実装の意図どおり）、confirm_import() 単体の
    往復を確かめるにはインポート応答を直接見る必要がある（低レベル _req を使う）。"""
    client = console_api.ConsoleClient(base, timeout=10)
    client.set_token("test-console-token")

    pending_yaml = SAMPLE_YAML.replace("test", "test # MOCK_FORCE_PENDING")
    _, res = client._req("POST", console_api.ENDPOINTS["apps_imports"],
                          {"mode": "yaml-content", "yaml_content": pending_yaml})
    check("T5: pending を返す DSL で status が pending", res.get("status") == "pending", res)
    app_id = res.get("app_id")
    import_id = res.get("id")
    check("T5: import_id が取れる", bool(import_id))

    confirmed_app_id, confirmed_status = client.confirm_import(import_id)
    check("T5: confirm_import で app_id が返る", confirmed_app_id == app_id, f"{confirmed_app_id} vs {app_id}")
    check("T5: confirm_import で status が completed になる", confirmed_status == "completed", confirmed_status)

    draft = client.get_draft(app_id)
    check("T5: get_draft が dict を返す（既定値）", isinstance(draft, dict) and "graph" in draft, draft)

    new_draft = {"graph": {"nodes": [{"id": "n1"}], "edges": []}, "features": {}, "environment_variables": []}
    res = client.update_draft(app_id, new_draft)
    check("T5: update_draft が成功応答を返す", isinstance(res, dict), res)

    draft2 = client.get_draft(app_id)
    check("T5: update_draft 後に get_draft へ反映される",
          draft2.get("graph", {}).get("nodes") == [{"id": "n1"}], draft2)

    # import_dsl() 自体も pending を自動で confirm し、最終的に completed へ解決すること
    auto_app_id, auto_status, auto_import_id = client.import_dsl(pending_yaml, return_details=True)
    check("T5: import_dsl の自動 confirm で status が completed になる", auto_status == "completed", auto_status)
    check("T5: import_dsl の自動 confirm で app_id が取れる", bool(auto_app_id), auto_app_id)


def test_t6_auth_error_exit3(base):
    """401（未設定・期限切れ）で exit 3、かつ再取得手順が出ること。"""
    r_unset = run_cli(["--console-url", base], {
        "DIFY_CONSOLE_REFRESH": "", "DIFY_CONSOLE_TOKEN": "", "DIFY_CONSOLE_EMAIL": "", "DIFY_CONSOLE_PASSWORD": "",
    })
    check("T6a: 秘密（REFRESH/TOKEN/email+password）いずれも未設定は exit 2", r_unset.returncode == 2,
          f"exit={r_unset.returncode} stdout={r_unset.stdout} stderr={r_unset.stderr}")
    check("T6a: DIFY_CONSOLE_REFRESH が未設定です、と出る",
          "DIFY_CONSOLE_REFRESH が未設定です" in (r_unset.stdout + r_unset.stderr), r_unset.stdout + r_unset.stderr)

    # 非推奨だが引き続き使える DIFY_CONSOLE_TOKEN（レガシー）経路の 401
    r_expired = run_cli(["--console-url", base], {"DIFY_CONSOLE_REFRESH": "", "DIFY_CONSOLE_TOKEN": mock_server.EXPIRED_TOKEN})
    combined = r_expired.stdout + r_expired.stderr
    check("T6b: 期限切れトークンで exit 3", r_expired.returncode == 3, f"exit={r_expired.returncode} {combined}")
    check("T6b: 取り直し手順（ブラウザ）が出る",
          "ブラウザ" in combined and "DIFY_CONSOLE_REFRESH" in combined, combined)
    check("T6b: 出力にトークン文字列が現れない", mock_server.EXPIRED_TOKEN not in combined, combined)


def test_t7_success_exit0(base):
    r = run_cli(["--console-url", base], {"DIFY_CONSOLE_TOKEN": "another-valid-token"})
    check("T7: 疎通確認が exit 0", r.returncode == 0, f"exit={r.returncode} stdout={r.stdout} stderr={r.stderr}")
    check("T7: トークン文字列が出力に現れない", "another-valid-token" not in (r.stdout + r.stderr))


def test_t8_no_token_leak_anywhere(base, tmpdir):
    """全テストを通して、トークンの値がこのプロセスの stdout/stderr に一度も現れないことを最終確認する。"""
    log_path = os.path.join(tmpdir, "combined.log")
    # 主要な操作をもう一度、出力をキャプチャして grep する
    r = run_cli(["--console-url", base], {"DIFY_CONSOLE_TOKEN": "yet-another-secret-token-value"})
    with open(log_path, "w", encoding="utf-8") as fh:
        fh.write(r.stdout + r.stderr)
    with open(log_path, encoding="utf-8") as fh:
        content = fh.read()
    check("T8: 生成ファイルにトークンの値が現れない", "yet-another-secret-token-value" not in content, content)


def test_g3_password_base64_helper():
    """G3: password は base64 化して送る（Cloud・selfhost 共通）。ヘルパー単体の検証。"""
    import base64
    encoded = console_api._b64_password("hello-world")
    check("G3: _b64_password が base64 エンコードした値を返す",
          encoded == base64.b64encode(b"hello-world").decode("ascii"), encoded)
    check("G3: エンコード結果は平文と異なる", encoded != "hello-world", encoded)


def test_g7_mask_patterns_cover_cookie_csrf_refresh():
    """G7: _mask() が Cookie・Set-Cookie・X-CSRF-Token ヘッダ・アクセス/CSRF/リフレッシュトークンの
    JSON エコー・JWT らしき文字列を伏せること（正規表現で検査）。"""
    sample = (
        "HTTP 401 GET /console/api/apps: "
        "Cookie: access_token=abc123secret; csrf_token=def456secret; refresh_token=ghi789secret "
        "X-CSRF-Token: def456secret "
        "Set-Cookie: __Host-access_token=zzz999secret; Path=/; HttpOnly "
        '{"access_token": "abc123secret", "refresh_token": "ghi789secret"} '
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
    )
    masked = console_api._mask(sample)
    for secret in ("abc123secret", "def456secret", "ghi789secret", "zzz999secret"):
        check(f"G7: マスク後に {secret!r} が残らない", secret not in masked, masked)
    check("G7: JWT らしき文字列がマスクされる（<jwt>*** に置換）", "eyJhbGciOiJIUzI1NiJ9" not in masked, masked)


def test_g8_import_dsl_masks_error_field():
    """レビュー指摘1: import_dsl が status: failed を返したとき、応答の error フィールドを
    そのまま例外メッセージへ埋めず _mask() を通すこと（console_api.py L41 の docstring どおり）。
    サーバ応答に秘密らしき文字列（JWT・__Host-refresh_token）が紛れ込んでいても、例外の str() に
    生の値が現れないことを確認する（実サーバ不要。_req をスタブして status: failed を直接作る）。"""
    client = console_api.ConsoleClient("http://127.0.0.1:1", timeout=10)
    client.set_token("dummy-token")
    leaked_refresh = "__Host-refresh_token=leaked-refresh-secret-value"
    leaked_jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
    secret_error = f"internal error: {leaked_refresh}; token={leaked_jwt}"

    def fake_req(method, path, body=None, auth=True, _retried=False):
        return 200, {"status": "failed", "error": secret_error}

    client._req = fake_req
    try:
        client.import_dsl(SAMPLE_YAML)
        check("G8: status=failed で ConsoleAPIError が上がる", False)
    except console_api.ConsoleAPIError as e:
        msg = str(e)
        check("G8: 例外メッセージに __Host-refresh_token の生値が現れない",
              "leaked-refresh-secret-value" not in msg, msg)
        check("G8: 例外メッセージに JWT らしき値の生値が現れない",
              "eyJhbGciOiJIUzI1NiJ9" not in msg, msg)


def test_t9_refresh_and_csrf_flow(base):
    """G1・G4・G6: refresh-token で access/csrf/refresh の 3 点を取得し、以降のリクエストに
    X-CSRF-Token ヘッダと Cookie の csrf_token が付いて一致すること（一致しなければ list_apps は
    401 で例外になるので、成功すること自体が一致の証拠になる）。"""
    client = console_api.ConsoleClient(base, timeout=10)
    seed = "t9-seed-refresh-token"
    ok = client.refresh(seed)
    check("T9: refresh() が成功する", ok is True)
    check("T9: refresh 後に access token が保持される", bool(client._token), client._token)
    check("T9: refresh 後に csrf token が保持される", bool(client._csrf), client._csrf)
    check("T9: refresh 後に refresh token がローテートされて保持される（seed と異なる）",
          bool(client._refresh_token) and client._refresh_token != seed, client._refresh_token)

    apps = client.list_apps()
    check("T9: refresh 後の list_apps が成功する（CSRF ヘッダ／Cookie 一致の証拠）", isinstance(apps, list))


def test_t10_refresh_reuse_fails(base):
    """G6: 同じリフレッシュトークンを 2 回使うと 2 回目は 401（rotate。S10）。"""
    client = console_api.ConsoleClient(base, timeout=10)
    seed = "t10-seed-refresh-token"
    client.refresh(seed)
    try:
        client.refresh(seed)
        check("T10: 使用済みリフレッシュトークンの再利用は失敗する", False)
    except console_api.ConsoleSessionExpiredError:
        check("T10: 使用済みリフレッシュトークンの再利用は失敗する", True)


def test_t11_refresh_401_exit3_session_expired(base):
    """§8-4 1 行目: refresh-token が 401 → exit 3、かつ「セッション期限切れ」のメッセージ。"""
    r = run_cli(["--console-url", base],
                {"DIFY_CONSOLE_REFRESH": mock_server.EXPIRED_REFRESH_TOKEN, "DIFY_CONSOLE_TOKEN": ""})
    combined = r.stdout + r.stderr
    check("T11: refresh 401 で exit 3", r.returncode == 3, f"exit={r.returncode} {combined}")
    check("T11: セッション期限切れのメッセージが出る（DEPLOY.md §8 の案内込み）",
          "セッションが期限切れ" in combined and "DIFY_CONSOLE_REFRESH" in combined and "DEPLOY.md" in combined,
          combined)
    check("T11: 出力にリフレッシュトークン文字列が現れない", mock_server.EXPIRED_REFRESH_TOKEN not in combined, combined)


def test_t12_midjob_401_auto_refresh_once(base):
    """§8-4 4 行目: ジョブ途中で 401（60 分超え）になったら、メモリの最新リフレッシュトークンで
    1 回だけ自動再取得して継続する。"""
    client = console_api.ConsoleClient(base, timeout=10)
    client.refresh("t12-seed-refresh-token")
    old_access = client._token

    req = urllib.request.Request(
        base + "/__test__/expire-access-token", method="POST",
        data=json.dumps({"access_token": old_access}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=5) as r:
        r.read()

    apps = client.list_apps()  # 内部で 401 → 自動 refresh → 再試行 → 成功するはず
    check("T12: 期限切れ後も 1 回だけの自動再取得で継続する", isinstance(apps, list), apps)
    check("T12: 自動再取得で access token が入れ替わる", client._token != old_access, (old_access, client._token))


def test_t13_csrf_mismatch_when_already_retried(base):
    """§8-4 2 行目: refresh は 200 だったのに、その後の API が 401（CSRF の組み立て誤り）
    → ConsoleCSRFMismatchError（exit 3・専用メッセージ）。自動リトライは csrf を都度正しく
    取り直すため、この分岐は「既に 1 回リトライした後もなお 401」というケースでしか起きない
    （実装のバグの再現）。`_retried=True` を直接渡して分岐そのものを検査する（白箱テスト）。"""
    client = console_api.ConsoleClient(base, timeout=10)
    client.refresh("t13-seed-refresh-token")
    client._csrf = "deliberately-wrong-csrf-value"  # わざと壊す
    try:
        client._req("GET", console_api.ENDPOINTS["apps"] + "?page=1&limit=100", auth=True, _retried=True)
        check("T13: CSRF 不一致は例外になる", False)
    except console_api.ConsoleCSRFMismatchError as e:
        check("T13: ConsoleCSRFMismatchError が上がる", True)
        check("T13: メッセージに「CSRF」が含まれる", "CSRF" in str(e), str(e))
        check("T13: 壊した csrf 値が例外メッセージに現れない", "deliberately-wrong-csrf-value" not in str(e), str(e))


def test_t14_no_delete_function_in_console_api():
    """§9-1: console_api.py に DELETE を送る関数が 1 つも無い（tools/verify.mjs §15 と同じ検査）。"""
    with open(CONSOLE_API, encoding="utf-8") as fh:
        src = fh.read()
    pattern = re.compile(r'_req\(\s*(["\'])DELETE\1|method\s*=\s*(["\'])DELETE\2', re.IGNORECASE)
    check("T14: console_api.py に \"DELETE\" を渡す HTTP 呼び出しが無い", not pattern.search(src))


def test_t15_no_secret_leak_in_normal_flow(base):
    """G7: 通常の refresh → list_apps → publish の流れで、標準出力に
    access/csrf/refresh トークンの値が一度も現れないこと。"""
    client = console_api.ConsoleClient(base, timeout=10)
    seed = "t15-seed-refresh-token-xyz"
    client.refresh(seed)
    access, csrf, refresh_after = client._token, client._csrf, client._refresh_token

    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        client.list_apps()
        try:
            client.publish("app-1")
        except console_api.ConsoleAPIError:
            pass
    out = buf.getvalue()
    for secret, label in (
        (access, "access_token"), (csrf, "csrf_token"),
        (refresh_after, "refresh_token（rotate 後）"), (seed, "seed refresh_token"),
    ):
        check(f"T15: 標準出力に {label} の値が現れない", secret not in out, out)


def test_t16_selfhost_still_uses_legacy_no_csrf(base):
    """T3・T4 の後方互換をもう一段直接確認する: selfhost の /login で得たトークンは
    STATE["sessions"] に登録されない（レガシー扱い）ため、X-CSRF-Token 無しでも通ること。"""
    c = console_api.ConsoleClient(base, timeout=10)
    c.login("tester2@example.com", "another-dummy-password")
    check("T16: selfhost ログインは csrf を持たない（レガシー経路）", c._csrf is None, c._csrf)
    apps = c.list_apps()
    check("T16: csrf 無しでも selfhost 経路の list_apps は成功する", isinstance(apps, list))


def test_w17_logout_invalidates_session(base):
    """B3（設計書 §8-7・§9-3。Issue #121 W4-4）: refresh 経由のセッションで logout() を呼ぶと、
    以後その access_token では認証済みリクエストが 401 になること。"""
    client = console_api.ConsoleClient(base, timeout=10)
    client.refresh("w17-seed-refresh-token")
    check("W17: refresh 直後は list_apps が成功する", isinstance(client.list_apps(), list))

    ok = client.logout()
    check("W17: logout() が True を返す", ok is True)

    try:
        client.list_apps()
        check("W17: logout 後は同じセッションで list_apps が失敗する", False)
    except console_api.ConsoleAuthError:
        check("W17: logout 後は同じセッションで list_apps が失敗する", True)


def test_w18_logout_skips_when_unauthenticated():
    """未認証（_token が無い）の logout() は例外を投げず False を返す（ネットワークも呼ばない）。"""
    client = console_api.ConsoleClient("http://127.0.0.1:1", timeout=10)
    ok = client.logout()
    check("W18: 未認証の logout() は False", ok is False)


def test_w19_auth_mode_tracks_route(base):
    """_auth_mode が認証経路ごとに正しく記録される（cloud_deploy.py の B3 ゲートが使う値）。"""
    c1 = console_api.ConsoleClient(base, timeout=10)
    c1.set_token("w19-legacy-token")
    check("W19: set_token 後は _auth_mode == 'token'", c1._auth_mode == "token", c1._auth_mode)

    c2 = console_api.ConsoleClient(base, timeout=10)
    c2.refresh("w19-seed-refresh-token")
    check("W19: refresh() 後は _auth_mode == 'refresh'", c2._auth_mode == "refresh", c2._auth_mode)

    c3 = console_api.ConsoleClient(base, timeout=10)
    c3.login("w19@example.com", "dummy-password")
    check("W19: login() 後は _auth_mode == 'password'", c3._auth_mode == "password", c3._auth_mode)


def test_w20_logout_no_delete_and_no_leak(base):
    """logout() は POST のみを使い（tools/verify.mjs §15 の許可外に触れない）、
    リフレッシュ/アクセス/CSRF トークンの値が logout の呼び出し前後で標準出力に現れないこと。"""
    with open(CONSOLE_API, encoding="utf-8") as fh:
        src = fh.read()
    m = re.search(r"    def logout\(self\):.*?(?=\n    def |\Z)", src, re.DOTALL)
    logout_func = m.group(0) if m else ""
    check("W20: logout() の関数本体が見つかる", bool(logout_func), src[:0])
    check("W20: logout() は _req に \"POST\" を渡している", '_req("POST", ENDPOINTS["logout"]' in logout_func, logout_func)
    check("W20: logout() は \"DELETE\" を渡していない", '"DELETE"' not in logout_func, logout_func)

    client = console_api.ConsoleClient(base, timeout=10)
    seed = "w20-seed-refresh-token-xyz"
    client.refresh(seed)
    access, csrf, refresh_after = client._token, client._csrf, client._refresh_token
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        client.logout()
    out = buf.getvalue()
    for secret, label in ((access, "access_token"), (csrf, "csrf_token"), (refresh_after, "refresh_token"), (seed, "seed refresh_token")):
        check(f"W20: logout() の出力に {label} の値が現れない", secret not in out, out)


def test_sink_t1_unset_no_file(base):
    """t1（設計書 §9-1。Issue #212 PR-1）: DIFY_REFRESH_SINK 未設定なら refresh() は
    ファイルを 1 つも作らない（既存の挙動）。"""
    client = console_api.ConsoleClient(base, timeout=10)
    os.environ.pop(console_api.REFRESH_SINK_ENV, None)
    ok = client.refresh("sink-t1-seed-refresh-token")
    check("SINK t1: refresh() 自体は成功する", ok is True)
    check("SINK t1: sink 未設定時は書き込みが起きない（_sink_write_count が 0）", client._sink_write_count == 0)


def test_sink_t2_write_once(base, tmpdir):
    """t2: sink 設定で refresh() 1 回 → ファイルが存在・パーミッション 0600・末尾改行なし・
    中身が rotate 後の新トークンと一致する。"""
    sink_path = os.path.join(tmpdir, "dify-refresh.new")
    os.environ[console_api.REFRESH_SINK_ENV] = sink_path
    try:
        client = console_api.ConsoleClient(base, timeout=10)
        client.refresh("sink-t2-seed-refresh-token")
        check("SINK t2: sink ファイルが作られる", os.path.isfile(sink_path))
        mode = os.stat(sink_path).st_mode & 0o777
        check("SINK t2: パーミッションが 0600", mode == 0o600, oct(mode))
        with open(sink_path, "rb") as fh:
            content = fh.read()
        check("SINK t2: 末尾改行が無い", not content.endswith(b"\n"), content)
        check("SINK t2: 中身が rotate 後の refresh token と一致する",
              content.decode("ascii") == client._refresh_token, content)
        check("SINK t2: .tmp の残骸が残らない", not os.path.exists(sink_path + ".tmp"))
    finally:
        os.environ.pop(console_api.REFRESH_SINK_ENV, None)


def test_sink_t3_two_rotates_keeps_last(base, tmpdir):
    """t3: _req() の 401 自動再取得を誘発して 2 回 rotate → sink の中身は 2 回目（最後）の値。
    かつその値でモックに refresh が通る（＝生きている＝最後の書き込みが最後の rotate になっている証拠）。"""
    sink_path = os.path.join(tmpdir, "dify-refresh-t3.new")
    os.environ[console_api.REFRESH_SINK_ENV] = sink_path
    try:
        client = console_api.ConsoleClient(base, timeout=10)
        client.refresh("sink-t3-seed-refresh-token")  # rotate 1 回目
        check("SINK t3: 1 回目の rotate で sink が書かれる", client._sink_write_count == 1, client._sink_write_count)
        first_sink_value = open(sink_path, encoding="ascii").read()

        old_access = client._token
        req = urllib.request.Request(
            base + "/__test__/expire-access-token", method="POST",
            data=json.dumps({"access_token": old_access}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as r:
            r.read()

        client.list_apps()  # 内部で 401 → 自動 refresh（rotate 2 回目）→ 再試行 → 成功
        check("SINK t3: 2 回目の rotate でも sink が上書きされる", client._sink_write_count == 2, client._sink_write_count)

        second_sink_value = open(sink_path, encoding="ascii").read()
        check("SINK t3: sink の中身が 1 回目から変わっている（上書きされた証拠）",
              second_sink_value != first_sink_value)
        check("SINK t3: sink の中身が最終的な self._refresh_token と一致する（最後の書き込み＝最後の rotate）",
              second_sink_value == client._refresh_token, (second_sink_value, client._refresh_token))

        # sink の値（2 回目＝最後）が本当に生きている（まだ使われていない）ことを、
        # 別クライアントでそのまま refresh に使って確認する。
        fresh_client = console_api.ConsoleClient(base, timeout=10)
        ok = fresh_client.refresh(second_sink_value)
        check("SINK t3: sink に書かれた最後の値でモックに refresh が通る（生きている）", ok is True)
    finally:
        os.environ.pop(console_api.REFRESH_SINK_ENV, None)


def test_sink_t4_repo_path_rejected(base):
    """t4: sink パスがリポジトリ作業ツリー配下 → ConsoleAPIError。ファイルを作らない（D7）。"""
    bad_path = os.path.join(ROOT, "dify-refresh-sink-t4-should-not-exist.tmp")
    os.environ[console_api.REFRESH_SINK_ENV] = bad_path
    try:
        client = console_api.ConsoleClient(base, timeout=10)
        raised = False
        try:
            client.refresh("sink-t4-seed-refresh-token")
        except console_api.ConsoleAPIError as e:
            raised = True
            check("SINK t4: エラーメッセージに値が含まれない", "sink-t4-seed-refresh-token" not in str(e), str(e))
        check("SINK t4: リポジトリ配下の sink パスは ConsoleAPIError になる", raised)
        check("SINK t4: ファイルを作らない", not os.path.exists(bad_path))
    finally:
        os.environ.pop(console_api.REFRESH_SINK_ENV, None)
        if os.path.exists(bad_path):
            os.unlink(bad_path)


def test_sink_t5_bad_format_rejected(base, tmpdir):
    """t5: rotate 値が _REFRESH_VALUE_RE に合わない → ConsoleAPIError。書かない
    （直接 _write_refresh_sink() を呼ぶ白箱テスト。t13 と同じ作法で _refresh_token を意図的に壊す）。"""
    sink_path = os.path.join(tmpdir, "dify-refresh-t5.new")
    os.environ[console_api.REFRESH_SINK_ENV] = sink_path
    try:
        client = console_api.ConsoleClient(base, timeout=10)
        client.refresh("sink-t5-seed-refresh-token")  # 正常な 1 回目（sink に正しい値が書かれる）
        good_value = open(sink_path, encoding="ascii").read()

        client._refresh_token = "too-short"  # わざと形式違反にする（20 文字未満）
        raised = False
        try:
            client._write_refresh_sink()
        except console_api.ConsoleAPIError:
            raised = True
        check("SINK t5: 形式が合わない値は ConsoleAPIError になる", raised)

        still = open(sink_path, encoding="ascii").read()
        check("SINK t5: 形式違反では sink が上書きされない（直前の正しい値のまま）", still == good_value, (still, good_value))
    finally:
        os.environ.pop(console_api.REFRESH_SINK_ENV, None)


def test_sink_t9_mask_pat_patterns():
    """t9（D8）: _mask() が ghp_… / github_pat_… を伏せること。"""
    msg = "leaked PAT: ghp_abcdefghijklmnopqrst0123 and github_pat_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    masked = console_api._mask(msg)
    check("SINK t9: ghp_ の値がマスクされる",
          "ghp_abcdefghijklmnopqrst0123" not in masked and "ghp_***" in masked, masked)
    check("SINK t9: github_pat_ の値がマスクされる",
          "github_pat_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789" not in masked and "github_pat_***" in masked, masked)


def test_sink_vb_prefers_host_prefixed_refresh_cookie(base):
    """V-B（設計書 §4-2 b。load-bearing）: __Host-refresh_token と無印 refresh_token が
    同時に cookiejar にいる場合、__Host-refresh_token を優先して self._refresh_token に取り込む。
    ConsoleClient は通常どちらか一方しか受け取らないため、cookiejar を直接操作する白箱テスト。"""
    import http.cookiejar

    client = console_api.ConsoleClient(base, timeout=10)
    client._cookiejar.set_cookie(http.cookiejar.Cookie(
        version=0, name="refresh_token", value="legacy-unprefixed-value",
        port=None, port_specified=False, domain="127.0.0.1", domain_specified=False,
        domain_initial_dot=False, path="/", path_specified=True, secure=False,
        expires=None, discard=True, comment=None, comment_url=None, rest={},
    ))
    client._cookiejar.set_cookie(http.cookiejar.Cookie(
        version=0, name="__Host-refresh_token", value="host-prefixed-value",
        port=None, port_specified=False, domain="127.0.0.1", domain_specified=False,
        domain_initial_dot=False, path="/", path_specified=True, secure=False,
        expires=None, discard=True, comment=None, comment_url=None, rest={},
    ))
    client._absorb_session_cookies()
    check("V-B: __Host-refresh_token が優先される", client._refresh_token == "host-prefixed-value", client._refresh_token)


def main():
    check("前提: console_api.py が存在する", os.path.isfile(CONSOLE_API))
    check("前提: mock_server.py が存在する", os.path.isfile(MOCK_SERVER))

    test_t1_mask()
    test_t1b_mask_case_insensitive()
    test_t2_endpoints_table()
    test_g3_password_base64_helper()
    test_g7_mask_patterns_cover_cookie_csrf_refresh()
    test_g8_import_dsl_masks_error_field()
    test_t14_no_delete_function_in_console_api()
    test_sink_t9_mask_pat_patterns()

    port = free_port()
    base = f"http://127.0.0.1:{port}"
    proc = subprocess.Popen(
        [sys.executable, MOCK_SERVER, "--port", str(port)],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    try:
        ready = wait_ready(base)
        check("前提: mock サーバーが起動した", ready)

        test_t3_selfhost_login_unchanged(base)
        test_t4_token_auth_and_ua(base)
        test_t5_confirm_and_draft_roundtrip(base)
        test_t6_auth_error_exit3(base)
        test_t7_success_exit0(base)
        with tempfile.TemporaryDirectory(prefix="console_api_test_") as tmpdir:
            test_t8_no_token_leak_anywhere(base, tmpdir)
        test_t9_refresh_and_csrf_flow(base)
        test_t10_refresh_reuse_fails(base)
        test_t11_refresh_401_exit3_session_expired(base)
        test_t12_midjob_401_auto_refresh_once(base)
        test_t13_csrf_mismatch_when_already_retried(base)
        test_t15_no_secret_leak_in_normal_flow(base)
        test_t16_selfhost_still_uses_legacy_no_csrf(base)
        test_w17_logout_invalidates_session(base)
        test_w18_logout_skips_when_unauthenticated()
        test_w19_auth_mode_tracks_route(base)
        test_w20_logout_no_delete_and_no_leak(base)

        # 書き戻し（sink）関連（設計書 docs/handoff/2026-09-09-refresh-token-writeback.md §9-1。Issue #212 PR-1）
        test_sink_t1_unset_no_file(base)
        with tempfile.TemporaryDirectory(prefix="console_api_sink_test_") as sink_tmpdir:
            test_sink_t2_write_once(base, sink_tmpdir)
            test_sink_t3_two_rotates_keeps_last(base, sink_tmpdir)
            test_sink_t5_bad_format_rejected(base, sink_tmpdir)
        test_sink_t4_repo_path_rejected(base)
        test_sink_vb_prefers_host_prefixed_refresh_cookie(base)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

    failed = [name for name, ok, _ in RESULTS if not ok]
    print()
    print(f"{len(RESULTS) - len(failed)}/{len(RESULTS)} PASS")
    if failed:
        print("FAILED:")
        for name in failed:
            print(f"  - {name}")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
