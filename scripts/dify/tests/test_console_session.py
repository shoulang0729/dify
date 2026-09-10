#!/usr/bin/env python3
"""scripts/dify/console_session.py の単体検証（pytest ではなく、単体で走るスクリプト。
test_console_api.py / test_cloud_deploy.py と同じ作法。mock_server.py を子プロセスで起動して往復させる）。

    python3 scripts/dify/tests/test_console_session.py     # exit 0 で全件 PASS。ネットワークは 127.0.0.1 のみ

設計: docs/handoff/2026-09-09-refresh-token-writeback.md §4-4・§4-6（Issue #212 PR-3・PR-4）

CI（`npm test`）には入れない（`CLAUDE.md` §3 のコマンド集合を変えない。他の scripts/dify テストと同じ扱い）。
実行は implementer と reviewer が手で行う。本 PR（PR-4）で `revoke`（t8）を追加した。
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
