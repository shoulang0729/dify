#!/usr/bin/env python3
"""scripts/dify/console_session.py の単体検証（pytest ではなく、単体で走るスクリプト。
test_console_api.py / test_cloud_deploy.py と同じ作法。mock_server.py を子プロセスで起動して往復させる）。

    python3 scripts/dify/tests/test_console_session.py     # exit 0 で全件 PASS。ネットワークは 127.0.0.1 のみ

設計: docs/handoff/2026-09-09-refresh-token-writeback.md §4-4・§4-6（Issue #212 PR-3・PR-4）
site_probe（Issue #124）: `console_session.py` の docstring・PR 本文を参照。

CI（`npm test`）には入れない（`CLAUDE.md` §3 のコマンド集合を変えない。他の scripts/dify テストと同じ扱い）。
実行は implementer と reviewer が手で行う。本 PR（PR-4）で `revoke`（t8）を追加した。
site_probe のテスト（Issue #124）は、`list_apps()` の応答 1 件目を見る実装のため、
他のテストと apps の挿入順が混ざらないよう**専用の mock サーバー・プロセス**を使う
（`start_mock_server()` / `stop_mock_server()`）。
"""
import json
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
CONSOLE_SESSION = os.path.join(SCRIPTS_DIR, "console_session.py")
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
            return True
        except Exception:
            time.sleep(0.2)
    return False


def start_mock_server():
    """専用の mock サーバー・プロセスを起動して (proc, base) を返す（Issue #124: site_probe は
    list_apps() の応答 1 件目〔apps[0]〕を見る実装のため、他のテストと apps の挿入順が
    混ざらないよう、site_probe のテストだけは共有 fixture ではなく専用プロセスを使う）。"""
    port = free_port()
    base = f"http://127.0.0.1:{port}"
    proc = subprocess.Popen(
        [sys.executable, MOCK_SERVER, "--port", str(port)],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    ready = wait_ready(base)
    check("前提: site_probe 専用の mock サーバーが起動した", ready)
    return proc, base


def stop_mock_server(proc):
    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()


def _post_json(base, path, payload):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(base.rstrip("/") + path, data=data, method="POST",
                                  headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())


def run_cli(args, env_extra=None, timeout=30):
    env = dict(os.environ)
    env.update(env_extra or {})
    return subprocess.run(
        [sys.executable, CONSOLE_SESSION, *args],
        cwd=ROOT, capture_output=True, text=True, timeout=timeout, env=env,
    )


def test_refresh_success_exit0(base):
    """refresh: DIFY_CONSOLE_REFRESH があれば exit 0。値は出ない。logout は呼ばれない。"""
    seed = "cs-refresh-success-seed-token"
    r = run_cli(["--env", "cloud-master", "refresh"],
                {"DIFY_CONSOLE_URL": base, "DIFY_CONSOLE_REFRESH": seed, "DIFY_CONSOLE_TOKEN": ""})
    combined = r.stdout + r.stderr
    check("refresh: exit 0", r.returncode == 0, combined)
    check("refresh: セッション有効のメッセージが出る", "セッションは有効です" in combined, combined)
    check("refresh: logout はしないと明示される", "logout はしません" in combined, combined)
    check("refresh: 実際に logout 完了ログは出ない（呼んでいない証拠）", "logout 完了" not in combined, combined)
    check("refresh: 出力にリフレッシュトークン文字列が現れない", seed not in combined, combined)


def test_refresh_unset_exit2():
    """refresh: 認証情報が何も無ければ exit 2（ネットワークを呼ぶ前に preflight 相当で止まる）。"""
    r = run_cli(
        ["--env", "cloud-master", "refresh"],
        {"DIFY_CONSOLE_URL": "http://127.0.0.1:1", "DIFY_CONSOLE_REFRESH": "",
         "DIFY_CONSOLE_TOKEN": "", "DIFY_CONSOLE_EMAIL": "", "DIFY_CONSOLE_PASSWORD": ""},
    )
    check("refresh(未設定): exit 2", r.returncode == 2, f"exit={r.returncode} {r.stdout} {r.stderr}")


def test_refresh_auth_error_exit3(base):
    """refresh: 期限切れ/使用済みのリフレッシュトークンは exit 3。値は出ない。"""
    r = run_cli(["--env", "cloud-master", "refresh"],
                {"DIFY_CONSOLE_URL": base, "DIFY_CONSOLE_REFRESH": mock_server.EXPIRED_REFRESH_TOKEN, "DIFY_CONSOLE_TOKEN": ""})
    combined = r.stdout + r.stderr
    check("refresh(期限切れ): exit 3", r.returncode == 3, f"exit={r.returncode} {combined}")
    check("refresh(期限切れ): 取り直し手順が出る", "DIFY_CONSOLE_REFRESH" in combined, combined)
    check("refresh(期限切れ): 出力にリフレッシュトークン文字列が現れない",
          mock_server.EXPIRED_REFRESH_TOKEN not in combined, combined)


def test_refresh_writes_sink_and_value_stays_alive(base, tmpdir):
    """refresh: DIFY_REFRESH_SINK 設定時、rotate 後の値が sink に書かれ、
    logout していないのでその値がそのまま別クライアントの refresh に使える（生きている）。"""
    sink_path = os.path.join(tmpdir, "dify-refresh-session-test.new")
    seed = "cs-sink-seed-refresh-token"
    r = run_cli(["--env", "cloud-master", "refresh"],
                {"DIFY_CONSOLE_URL": base, "DIFY_CONSOLE_REFRESH": seed, "DIFY_CONSOLE_TOKEN": "",
                 "DIFY_REFRESH_SINK": sink_path})
    combined = r.stdout + r.stderr
    check("refresh(sink): exit 0", r.returncode == 0, combined)
    check("refresh(sink): sink ファイルが作られる", os.path.isfile(sink_path))
    sink_value = open(sink_path, encoding="ascii").read()

    fresh_client = console_api.ConsoleClient(base, timeout=10)
    ok = fresh_client.refresh(sink_value)
    check("refresh(sink): sink の値でモックに refresh が通る（生きている＝logout していない証拠）", ok is True)


def test_revoke_unset_exit2():
    """revoke: 認証情報が何も無ければ exit 2（refresh と同じ preflight 相当）。"""
    r = run_cli(
        ["--env", "cloud-master", "revoke"],
        {"DIFY_CONSOLE_URL": "http://127.0.0.1:1", "DIFY_CONSOLE_REFRESH": "",
         "DIFY_CONSOLE_TOKEN": "", "DIFY_CONSOLE_EMAIL": "", "DIFY_CONSOLE_PASSWORD": ""},
    )
    check("revoke(未設定): exit 2", r.returncode == 2, f"exit={r.returncode} {r.stdout} {r.stderr}")


def test_revoke_calls_logout_and_removes_sink(base, tmpdir):
    """t8（設計書 §4-4・§4-6・§9-1。Issue #212 PR-4）: console_session.py revoke は
    client.logout() を呼び（B3'。Dify サーバ側のセッションを無効化する）、DIFY_REFRESH_SINK が
    設定されていれば（client_from_env() の refresh() 呼び出しで自動的に書かれた）sink ファイルを
    削除する（死んだ値を後続の書き戻しステップに渡させないため）。値は出力に現れない。"""
    sink_path = os.path.join(tmpdir, "dify-refresh-revoke-test.new")
    seed = "cs-revoke-seed-refresh-token"
    r = run_cli(["--env", "cloud-master", "revoke"],
                {"DIFY_CONSOLE_URL": base, "DIFY_CONSOLE_REFRESH": seed, "DIFY_CONSOLE_TOKEN": "",
                 "DIFY_REFRESH_SINK": sink_path})
    combined = r.stdout + r.stderr
    check("revoke: exit 0", r.returncode == 0, combined)
    check("revoke: logout 完了のログが出る（サーバ側のセッションを無効化した証拠）",
          "logout 完了" in combined, combined)
    check("revoke: sink ファイルを削除したログが出る", "sink ファイルを削除しました" in combined, combined)
    check("revoke: sink ファイルが（自動生成後に）削除され、残っていない",
          not os.path.isfile(sink_path))
    check("revoke: 出力にリフレッシュトークン文字列が現れない", seed not in combined, combined)


# ---------------------------------------------------------------------------
# site_probe（Issue #124）: それぞれ専用の mock サーバーで、apps[0] を確実に制御する。
# ---------------------------------------------------------------------------

SITE_PROBE_SECRET_MARKERS = ("SHOULD-NOT-LEAK-SITE-ACCESS-TOKEN", "SHOULD-NOT-LEAK-APP-API-KEY")


def test_site_probe_unset_exit2():
    """site_probe: 認証情報が何も無ければ exit 2（refresh/revoke と同じ preflight 相当）。"""
    r = run_cli(
        ["--env", "cloud-master", "site_probe"],
        {"DIFY_CONSOLE_URL": "http://127.0.0.1:1", "DIFY_CONSOLE_REFRESH": "",
         "DIFY_CONSOLE_TOKEN": "", "DIFY_CONSOLE_EMAIL": "", "DIFY_CONSOLE_PASSWORD": ""},
    )
    check("site_probe(未設定): exit 2", r.returncode == 2, f"exit={r.returncode} {r.stdout} {r.stderr}")


def test_site_probe_finds_site_fields_and_url_without_leaking_secrets(base):
    """要件 1〜4（PR 本文参照）: site らしきフィールドがある応答で、キー名と URL が出て、
    api_key/token/secret を名前に含むキーの値（本体・site 配下のどちらも）が一切出ないこと。"""
    client = console_api.ConsoleClient(base, timeout=10)
    client.set_token("site-probe-found-token")
    yaml_text = "app:\n  name: 'site-probe-app-found'\n  description: t\nkind: app\nversion: 0.6.0\n" \
                "dependencies: []\nworkflow:\n  graph:\n    nodes: []\n    edges: []\n"
    app_id = client.import_dsl(yaml_text)
    _post_json(base, "/__test__/set-app-fields", {"app_id": app_id, "fields": {
        "enable_site": True,
        "site": {
            "code": "abc12345",
            "app_base_url": "https://udify.app",
            "access_token": SITE_PROBE_SECRET_MARKERS[0],  # site 配下の secret 系キー。配下ごと読まない
        },
        "api_key": SITE_PROBE_SECRET_MARKERS[1],  # トップレベルの secret 系キー。値は出ない
    }})

    r = run_cli(["--env", "cloud-master", "site_probe"], {
        "DIFY_CONSOLE_URL": base, "DIFY_CONSOLE_TOKEN": "site-probe-found-token", "DIFY_CONSOLE_REFRESH": "",
    })
    out = r.stdout + r.stderr
    check("site_probe(found): exit 0", r.returncode == 0, out)
    check("site_probe(found): トップレベルキー一覧に 'site' が出る", "'site'" in out, out)
    check("site_probe(found): トップレベルキー一覧に 'enable_site' が出る", "'enable_site'" in out, out)
    check("site_probe(found): 'site' 配下のキー名 'code' が出る", "'code'" in out, out)
    check("site_probe(found): 'site' 配下のキー名 'app_base_url' が出る", "'app_base_url'" in out, out)
    check("site_probe(found): URL が値ごと出る", "https://udify.app" in out, out)
    for marker in SITE_PROBE_SECRET_MARKERS:
        check(f"site_probe(found): 値 {marker!r} が出力に現れない（secret 系キーの値）", marker not in out, out)
    check("site_probe(found): 出力にトークン文字列が現れない", "site-probe-found-token" not in out, out)


def test_site_probe_not_found_reports_explicitly(base):
    """要件 5: site らしきフィールドが無い応答では「見つからなかった」と明示すること
    （黙って空を出さない）。"""
    client = console_api.ConsoleClient(base, timeout=10)
    client.set_token("site-probe-notfound-token")
    yaml_text = "app:\n  name: 'site-probe-app-notfound'\n  description: t\nkind: app\nversion: 0.6.0\n" \
                "dependencies: []\nworkflow:\n  graph:\n    nodes: []\n    edges: []\n"
    client.import_dsl(yaml_text)  # 追加フィールドは注入しない（id/name のみの素の応答）

    r = run_cli(["--env", "cloud-master", "site_probe"], {
        "DIFY_CONSOLE_URL": base, "DIFY_CONSOLE_TOKEN": "site-probe-notfound-token", "DIFY_CONSOLE_REFRESH": "",
    })
    out = r.stdout + r.stderr
    check("site_probe(not found): exit 0（見つからないこと自体は失敗ではない）", r.returncode == 0, out)
    check("site_probe(not found): 'site' を含むキーが無いと明示する",
          "'site' を名前に含むキーがありません" in out, out)
    check("site_probe(not found): https:// の値が無いと明示する",
          "https:// で始まる値がありません" in out, out)


def test_site_probe_no_secret_named_key_values_leak_regex(base):
    """機械確認（PM 依頼）: api_key/token/secret を含むキーの**値**が出力のどこにも現れないことを、
    正規表現で汎用的に検査する（上のテストの固定マーカーに依存しない別角度の検査）。
    一方、secret 系キーの**兄弟**にある URL（例: site.app_base_url）は secret 系キーの配下では
    ないので、通常どおり見つかって値ごと出ること（配下ごと隠すのは secret 系キー自身の下だけ）も
    合わせて確認する。"""
    client = console_api.ConsoleClient(base, timeout=10)
    client.set_token("site-probe-regex-token")
    yaml_text = "app:\n  name: 'site-probe-app-regex'\n  description: t\nkind: app\nversion: 0.6.0\n" \
                "dependencies: []\nworkflow:\n  graph:\n    nodes: []\n    edges: []\n"
    app_id = client.import_dsl(yaml_text)
    secret_value = "REGEX-CHECK-SECRET-VALUE-0001"
    _post_json(base, "/__test__/set-app-fields", {"app_id": app_id, "fields": {
        "site": {"code": "zzz999", "app_base_url": "https://udify.app/regex-check", "secret_key": secret_value},
        "refresh_token": secret_value,
    }})

    r = run_cli(["--env", "cloud-master", "site_probe"], {
        "DIFY_CONSOLE_URL": base, "DIFY_CONSOLE_TOKEN": "site-probe-regex-token", "DIFY_CONSOLE_REFRESH": "",
    })
    out = r.stdout + r.stderr
    check("site_probe(regex): exit 0", r.returncode == 0, out)
    check("site_probe(regex): secret 値そのものが出力に現れない", secret_value not in out, out)
    check("site_probe(regex): secret 系キーの兄弟にある URL は通常どおり値ごと出る",
          "https://udify.app/regex-check" in out, out)


def test_revoke_removes_stale_sink_even_if_absent():
    """revoke: DIFY_REFRESH_SINK が設定されていてもファイルが存在しない場合はエラーにならない
    （sink 削除は「あれば消す」であり必須ではない）。"""
    r = run_cli(["--env", "cloud-master", "revoke"],
                {"DIFY_CONSOLE_URL": "http://127.0.0.1:1", "DIFY_CONSOLE_REFRESH": "",
                 "DIFY_CONSOLE_TOKEN": "", "DIFY_CONSOLE_EMAIL": "", "DIFY_CONSOLE_PASSWORD": "",
                 "DIFY_REFRESH_SINK": "/tmp/this-sink-does-not-exist-console-session-test.new"})
    check("revoke(sink 無し): exit 2 のまま（sink 未存在で例外にならない）", r.returncode == 2,
          f"exit={r.returncode} {r.stdout} {r.stderr}")


def main():
    check("前提: console_session.py が存在する", os.path.isfile(CONSOLE_SESSION))
    check("前提: mock_server.py が存在する", os.path.isfile(MOCK_SERVER))

    test_refresh_unset_exit2()
    test_revoke_unset_exit2()
    test_revoke_removes_stale_sink_even_if_absent()
    test_site_probe_unset_exit2()

    port = free_port()
    base = f"http://127.0.0.1:{port}"
    proc = subprocess.Popen(
        [sys.executable, MOCK_SERVER, "--port", str(port)],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    try:
        ready = wait_ready(base)
        check("前提: mock サーバーが起動した", ready)

        test_refresh_success_exit0(base)
        test_refresh_auth_error_exit3(base)
        with tempfile.TemporaryDirectory(prefix="console_session_test_") as tmpdir:
            test_refresh_writes_sink_and_value_stays_alive(base, tmpdir)
        with tempfile.TemporaryDirectory(prefix="console_session_revoke_test_") as tmpdir2:
            test_revoke_calls_logout_and_removes_sink(base, tmpdir2)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

    # site_probe（Issue #124）: list_apps() の応答 1 件目（apps[0]）を見る実装のため、
    # 上の共有 base とは apps の挿入順を混ぜない専用の mock サーバーを 1 テストにつき 1 つ使う。
    for test_fn in (
        test_site_probe_finds_site_fields_and_url_without_leaking_secrets,
        test_site_probe_not_found_reports_explicitly,
        test_site_probe_no_secret_named_key_values_leak_regex,
    ):
        proc2, base2 = start_mock_server()
        try:
            test_fn(base2)
        finally:
            stop_mock_server(proc2)

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
