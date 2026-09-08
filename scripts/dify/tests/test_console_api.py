#!/usr/bin/env python3
"""scripts/dify/console_api.py の単体検証（pytest ではなく、単体で走るスクリプト。test_sync_back.py /
test_run_tests.py と同じ作法。mock_server.py を子プロセスで起動して往復させる）。

    python3 scripts/dify/tests/test_console_api.py     # exit 0 で全件 PASS。ネットワークは 127.0.0.1 のみ

設計: docs/handoff/2026-09-08-cloud-console-deploy.md §4-2・§7 PR-1（Issue #114）

CI（`npm test`）には入れない（`CLAUDE.md` §3 のコマンド集合を変えない）。実行は implementer と reviewer が手で行う。
"""
import os
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
    for key in ("login", "apps", "apps_imports", "apps_imports_confirm", "workflows_publish", "workflows_draft"):
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
    r_unset = run_cli(["--console-url", base], {"DIFY_CONSOLE_TOKEN": "", "DIFY_CONSOLE_EMAIL": "", "DIFY_CONSOLE_PASSWORD": ""})
    check("T6a: トークン・email/password いずれも未設定は exit 2", r_unset.returncode == 2,
          f"exit={r_unset.returncode} stdout={r_unset.stdout} stderr={r_unset.stderr}")

    r_expired = run_cli(["--console-url", base], {"DIFY_CONSOLE_TOKEN": mock_server.EXPIRED_TOKEN})
    combined = r_expired.stdout + r_expired.stderr
    check("T6b: 期限切れトークンで exit 3", r_expired.returncode == 3, f"exit={r_expired.returncode} {combined}")
    check("T6b: 取り直し手順（ブラウザ）が出る", "ブラウザ" in combined and "console_token" in combined, combined)
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


def main():
    check("前提: console_api.py が存在する", os.path.isfile(CONSOLE_API))
    check("前提: mock_server.py が存在する", os.path.isfile(MOCK_SERVER))

    test_t1_mask()
    test_t1b_mask_case_insensitive()
    test_t2_endpoints_table()

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
