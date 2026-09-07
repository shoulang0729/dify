#!/usr/bin/env python3
"""scripts/dify/run_tests.py の単体検証（pytest ではなく、単体で走るスクリプト。test_sync_back.py と同じ作法）。

    python3 scripts/dify/tests/test_run_tests.py     # exit 0 で全件 PASS。mock_server.py を子プロセスで起動する

設計: docs/handoff/2026-09-08-thinking-budget-and-streaming.md §3-6（T1〜T7）

CI（`npm test`）には入れない（`CLAUDE.md` §3 のコマンド集合を変えない）。実行は implementer と reviewer が手で行う。
結果ファイルは tempfile.mkdtemp() に出し、終わったら消す（`dify/results/**` を汚さない）。
"""
import json
import os
import re
import shutil
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
RUN_TESTS = os.path.join(SCRIPTS_DIR, "run_tests.py")
MOCK_SERVER = os.path.join(TESTS_DIR, "mock_server.py")

sys.path.insert(0, TESTS_DIR)
import mock_server  # noqa: E402  split_n() を直接検証するため

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
        [sys.executable, RUN_TESTS, *args],
        cwd=ROOT, capture_output=True, text=True, timeout=60, env=env,
    )


def find_result_md(out_dir, env_name, code):
    d = os.path.join(out_dir, env_name)
    if not os.path.isdir(d):
        return None
    files = sorted(f for f in os.listdir(d) if f.startswith(code + "-"))
    if not files:
        return None
    return os.path.join(d, files[-1])


def main():
    check("前提: run_tests.py が存在する", os.path.isfile(RUN_TESTS))
    check("前提: mock_server.py が存在する", os.path.isfile(MOCK_SERVER))

    before_status = subprocess.run(["git", "status", "--porcelain", "dify/results"], cwd=ROOT,
                                    capture_output=True, text=True).stdout

    # split_n の単体検証（T5 の前提: chunk 境界をまたいでも連結すれば元の文字列に戻る）
    sample = "TR-2024-007 0.06 18-20 2.0 MPa ステップ 3D 24"
    parts3 = mock_server.split_n(sample, 3)
    check("T5-precondition: split_n(3) が元の文字列に復元できる", "".join(parts3) == sample, str(parts3))
    parts2 = mock_server.split_n(sample, 2)
    check("T5-precondition: split_n(2) が元の文字列に復元できる", "".join(parts2) == sample, str(parts2))

    port = free_port()
    base = f"http://127.0.0.1:{port}/v1"
    proc = subprocess.Popen(
        [sys.executable, MOCK_SERVER, "--port", str(port)],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    try:
        ready = wait_ready(base)
        check("前提: mock サーバーが起動した", ready)

        with tempfile.TemporaryDirectory(prefix="run_tests_test_") as tmpdir:
            # ---- T1: --dry-run ----
            r1 = run_cli(["--dry-run", "--out", tmpdir, "--env", "dryenv", "KN-01"])
            check("T1: --dry-run が exit 0", r1.returncode == 0, f"stdout={r1.stdout} stderr={r1.stderr}")
            md1 = find_result_md(tmpdir, "dryenv", "KN-01")
            check("T1: 結果ファイルができている", md1 is not None)
            if md1:
                text1 = open(md1, encoding="utf-8").read()
                check("T1: 結果ファイルに (dry-run) が出る", "(dry-run)" in text1)

            key_env = {"DIFY_APP_KEY_KN01": "dummy-kn01-key", "DIFY_APP_KEY_DC01": "dummy-dc01-key"}

            # ---- T2: streaming（既定）で KN-01（chat） ----
            r2 = run_cli(["--base-url", base, "--out", tmpdir, "--env", "streamenv", "KN-01"], key_env)
            check("T2: streaming の KN-01 が exit 0", r2.returncode == 0, f"stdout={r2.stdout} stderr={r2.stderr}")
            check("T2: 4/4 合格", "合計: 4 / 4 合格" in r2.stdout, r2.stdout)
            md2 = find_result_md(tmpdir, "streamenv", "KN-01")
            check("T2: 結果ファイルができている", md2 is not None)
            text2 = open(md2, encoding="utf-8").read() if md2 else ""
            check("T2: 結果ファイルに `- 受信: streaming` がある", "- 受信: streaming" in text2)

            # ---- T3: streaming で DC-01（workflow） ----
            r3 = run_cli(["--base-url", base, "--out", tmpdir, "--env", "streamenv", "DC-01"], key_env)
            check("T3: streaming の DC-01 が exit 0", r3.returncode == 0, f"stdout={r3.stdout} stderr={r3.stderr}")
            check("T3: 4/4 合格", "合計: 4 / 4 合格" in r3.stdout, r3.stdout)
            md3 = find_result_md(tmpdir, "streamenv", "DC-01")
            text3 = open(md3, encoding="utf-8").read() if md3 else ""
            check("T3: 結果ファイルに `- 受信: streaming` がある", "- 受信: streaming" in text3)

            # ---- T4: --blocking で KN-01 / DC-01 ----
            r4 = run_cli(["--blocking", "--base-url", base, "--out", tmpdir, "--env", "blockenv",
                          "KN-01", "DC-01"], key_env)
            check("T4: --blocking の KN-01/DC-01 が exit 0", r4.returncode == 0, f"stdout={r4.stdout} stderr={r4.stderr}")
            check("T4: 8/8 合格", "合計: 8 / 8 合格" in r4.stdout, r4.stdout)
            md4kn = find_result_md(tmpdir, "blockenv", "KN-01")
            text4kn = open(md4kn, encoding="utf-8").read() if md4kn else ""
            check("T4: 結果ファイルに `- 受信: blocking` がある", "- 受信: blocking" in text4kn)

            # ---- T5: chunk 境界をまたいでも回答が連結されて 1 本になる ----
            check("T5: streaming（T2）が chunk 分割後も判定 PASS", "合計: 4 / 4 合格" in r2.stdout)

            # ---- T6: ping フレームがあっても落ちない（T2/T3 に含まれる） ----
            check("T6: ping を挟んだ streaming（T2/T3）が両方 exit 0",
                  r2.returncode == 0 and r3.returncode == 0)

            # ---- T7: 結果表にトークン列があり streaming で数値が入る ----
            row2 = next((ln for ln in text2.splitlines() if ln.startswith("| KN-01 T01")), "")
            row3 = next((ln for ln in text3.splitlines() if ln.startswith("| DC-01")), "")
            check("T7: KN-01 の結果表にトークン列見出しがある", "| トークン |" in text2)
            check("T7: KN-01 T01 の行にトークン数値が入っている（`—` でない）",
                  bool(re.search(r"\|\s*\d+\s*\|\s*(PASS|FAIL)\s*\|\s*$", row2)), row2)
            check("T7: DC-01 の結果表にトークン列見出しがある", "| トークン |" in text3)
            check("T7: DC-01 の行にトークン数値が入っている（`—` でない）",
                  bool(re.search(r"\|\s*\d+\s*\|\s*(PASS|FAIL)\s*\|\s*$", row3)), row3)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait(timeout=5)

    after_status = subprocess.run(["git", "status", "--porcelain", "dify/results"], cwd=ROOT,
                                   capture_output=True, text=True).stdout
    check("後始末: dify/results/ に書き込みが残っていない（git status --porcelain が空のまま）",
          before_status == after_status, f"before={before_status!r} after={after_status!r}")

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
