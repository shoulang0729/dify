#!/usr/bin/env python3
"""scripts/dify/kb_upload.py の --refresh / --replace の単体検証（pytest ではなく、単体で走るスクリプト。
test_console_api.py / test_cloud_deploy.py と同じ作法。mock_server.py を子プロセスで起動して往復させる）。

    python3 scripts/dify/tests/test_kb_upload.py     # exit 0 で全件 PASS。ネットワークは 127.0.0.1 のみ

設計: docs/handoff/2026-09-08-cloud-auth-and-w4.md §4-2・§9-1・§9-5・§11（Issue #121 W4-1 PR-1）。
節番号の注記: 設計書は削除系検査を tools/verify.mjs §14 としているが、§14 は Issue #124（本番リンク）が
先に取ったため、実装は §15 を使う（§13 は #121 W2 用に予約済み）。

CI（`npm test`）には入れない（`CLAUDE.md` §3 のコマンド集合を変えない）。実行は implementer と reviewer が手で行う。

このテストは kb_upload.py を **サブプロセスではなく同一プロセス内で import して呼ぶ**（test_console_api.py /
test_cloud_deploy.py の CLI サブプロセス方式と異なる）。理由：K2（MAX_DELETE 超過）・K1（dify/kb/<番号>/ に
実在するファイル名との一致）を確かめるには、本物の dify/kb/** を書き換えずに任意のファイル集合を用意する
必要があるため、テストごとに kb_upload.KB_DIR を一時ディレクトリへ差し替える（本番の dify/kb/** は一切変更しない）。
"""
import contextlib
import io
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
KB_UPLOAD = os.path.join(SCRIPTS_DIR, "kb_upload.py")
MOCK_SERVER = os.path.join(TESTS_DIR, "mock_server.py")

sys.path.insert(0, SCRIPTS_DIR)
import kb_upload  # noqa: E402

RESULTS = []
UUID_RE = re.compile(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b")
TMP_DIRS = []


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


def stats(base):
    """/__test__/stats（mock_server.py）から DELETE / PATCH / update_by_text の呼び出し回数を取る。"""
    with urllib.request.urlopen(base.rstrip("/") + "/__test__/stats", timeout=5) as r:
        return json.loads(r.read())


def make_kb_dir(code, files):
    """一時 KB_DIR を作り、<tmp>/<code>/ 配下に files（{filename: content_str}）を書く。
    本物の dify/kb/** には一切触れない。"""
    tmp = tempfile.mkdtemp(prefix="kb_upload_test_")
    TMP_DIRS.append(tmp)
    d = os.path.join(tmp, code)
    os.makedirs(d, exist_ok=True)
    for fname, content in files.items():
        with open(os.path.join(d, fname), "w", encoding="utf-8") as fh:
            fh.write(content)
    return tmp


def run_kb_upload(kb_dir, argv, base, dataset_key="test-key"):
    """kb_upload.main() を同一プロセス内で呼ぶ（KB_DIR を差し替えるため）。戻り値: (exit_code, stdout_text)。"""
    kb_upload.KB_DIR = kb_dir
    os.environ["DIFY_DATASET_KEY"] = dataset_key
    os.environ["DIFY_BASE_URL"] = base.rstrip("/") + "/v1"
    old_argv = sys.argv
    sys.argv = ["kb_upload.py", *argv]
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            rc = kb_upload.main()
    finally:
        sys.argv = old_argv
    return rc, buf.getvalue()


# ---------------------------------------------------------------------------
# T1〜T7（設計書 §11 の受け入れ条件）
# ---------------------------------------------------------------------------

def test_t1_default_skip_unchanged(base):
    """T1: フラグ無しの既定挙動が現状と同一（同名はスキップ・削除も更新もしない）。"""
    code = "ZT1-01"
    tmp = make_kb_dir(code, {"a.md": "hello", "b.md": "world"})

    rc1, out1 = run_kb_upload(tmp, [code, "--env", "cloud-master", "--no-wait"], base)
    check("T1: 初回アップロードが exit 0", rc1 == 0, out1)

    before = stats(base)
    rc2, out2 = run_kb_upload(tmp, [code, "--env", "cloud-master", "--no-wait"], base)
    after = stats(base)
    check("T1: 2 回目（フラグ無し）も exit 0", rc2 == 0, out2)
    check("T1: 2 回目は同名文書をスキップする（a.md）", "スキップ（同名文書あり）: a.md" in out2, out2)
    check("T1: 2 回目は同名文書をスキップする（b.md）", "スキップ（同名文書あり）: b.md" in out2, out2)
    check("T1: フラグ無しでは DELETE を呼ばない", after["DELETE"] == before["DELETE"], (before, after))
    check("T1: フラグ無しでは PATCH を呼ばない", after["PATCH"] == before["PATCH"], (before, after))
    check("T1: フラグ無しでは update-by-text を呼ばない", after["update_by_text"] == before["update_by_text"], (before, after))


def test_t2_refresh_never_deletes(base):
    """T2: --refresh が DELETE を 1 回も呼ばない（モックサーバが DELETE を受けたらカウンタが増える）。"""
    code = "ZT2-01"
    tmp = make_kb_dir(code, {"a.md": "v1"})
    run_kb_upload(tmp, [code, "--env", "cloud-master", "--no-wait"], base)

    before = stats(base)
    rc, out = run_kb_upload(tmp, [code, "--env", "cloud-master", "--refresh", "--no-wait"], base)
    after = stats(base)
    check("T2: --refresh が exit 0", rc == 0, out)
    check("T2: --refresh が更新のログを出す（a.md）", "更新: a.md" in out, out)
    check("T2: --refresh は DELETE を 1 回も呼ばない", after["DELETE"] == before["DELETE"], (before, after))


def test_t3_replace_respects_k1(base):
    """T3: --replace が dify/kb/<番号>/ に無い名前の文書を削除しない（K1。KB 側に余分な文書を置いたモックで確認）。"""
    code = "ZT3-01"
    tmp = make_kb_dir(code, {"a.md": "v1"})
    run_kb_upload(tmp, [code, "--env", "cloud-master", "--no-wait"], base)

    # KB 側に、dify/kb/<code>/ に存在しない名前の文書を直接投入する（K1 の検証対象）
    api = kb_upload.Api(base.rstrip("/") + "/v1", "test-key")
    datasets = kb_upload.list_all(api, "/datasets")
    ds = next(d for d in datasets if d.get("name") == code)
    data = json.dumps({"indexing_technique": "high_quality", "process_rule": {}})
    api.post_multipart(f"/datasets/{ds['id']}/document/create-by-file", {"data": data},
                        "file", "OLD-STRAY-FILE.md", b"stray content", "text/markdown")

    rc, out = run_kb_upload(tmp, [code, "--env", "cloud-master", "--replace", "--dry-run"], base)
    check("T3: --replace --dry-run が exit 0", rc == 0, out)
    check("T3: 削除予定に a.md が含まれる", "a.md" in out, out)
    check("T3: dify/kb/<番号>/ に無い文書（OLD-STRAY-FILE.md）は削除予定に出ない（K1）",
          "OLD-STRAY-FILE.md" not in out, out)


def test_t4_max_delete_exceeded(base):
    """T4: 削除対象が MAX_DELETE を超えると 1 件も削除せず exit 1（K2）。"""
    code = "ZT4-01"
    files = {f"doc{i}.md": f"content {i}" for i in range(1, kb_upload.MAX_DELETE + 2)}  # MAX_DELETE + 1 件
    tmp = make_kb_dir(code, files)
    run_kb_upload(tmp, [code, "--env", "cloud-master", "--no-wait"], base)

    before = stats(base)
    rc, out = run_kb_upload(tmp, [code, "--env", "cloud-master", "--replace", "--no-wait"], base)
    after = stats(base)
    check("T4: MAX_DELETE 超過は exit 1", rc == 1, out)
    check("T4: MAX_DELETE 超過のエラーメッセージが出る", f"MAX_DELETE={kb_upload.MAX_DELETE}" in out, out)
    check("T4: 1 件も削除していない（DELETE カウンタが増えない）", after["DELETE"] == before["DELETE"], (before, after))


def test_t5_replace_dry_run_lists_only(base):
    """T5: --replace --dry-run が削除予定を列挙するだけで DELETE を呼ばない（K5）。"""
    code = "ZT5-01"
    tmp = make_kb_dir(code, {"a.md": "v1", "b.md": "v2"})
    run_kb_upload(tmp, [code, "--env", "cloud-master", "--no-wait"], base)

    before = stats(base)
    rc, out = run_kb_upload(tmp, [code, "--env", "cloud-master", "--replace", "--dry-run"], base)
    after = stats(base)
    check("T5: --replace --dry-run が exit 0", rc == 0, out)
    check("T5: 削除予定に a.md が列挙される", "a.md" in out, out)
    check("T5: 削除予定に b.md が列挙される", "b.md" in out, out)
    check("T5: 「DELETE は呼びません」の表示がある", "DELETE は呼びません" in out, out)
    check("T5: DELETE は実際に呼ばれない（カウンタ不変）", after["DELETE"] == before["DELETE"], (before, after))


def test_t6_no_uuid_leak(base):
    """T6: 標準出力に dataset id / document id の完全な UUID が出ない（正規表現で検査。§9-5）。"""
    code = "ZT6-01"
    tmp = make_kb_dir(code, {"a.md": "v1"})
    rc1, out1 = run_kb_upload(tmp, [code, "--env", "cloud-master", "--no-wait"], base)
    rc2, out2 = run_kb_upload(tmp, [code, "--env", "cloud-master", "--refresh", "--no-wait"], base)
    combined = out1 + out2
    check("T6: 初回・--refresh とも exit 0（前提）", rc1 == 0 and rc2 == 0, combined)
    check("T6: 標準出力に完全な UUID が現れない", not UUID_RE.search(combined), combined)


def test_t7_delete_then_upload_failure_stops(base):
    """T7: 削除直後にアップロードが失敗しても、次の文書の削除に進まない（K3）。"""
    code = "ZT7-01"
    tmp = make_kb_dir(code, {"a.md": "ok content", "b.md": "ok content 2"})
    run_kb_upload(tmp, [code, "--env", "cloud-master", "--no-wait"], base)

    # a.md はそのままだが、中身だけ書き換えて再アップロード（＝ --replace の再投入）を失敗させる
    # （mock_server.py: ファイル内容に MOCK_FAIL_UPLOAD を含めると create-by-file が 500 を返す）
    with open(os.path.join(tmp, code, "a.md"), "w", encoding="utf-8") as fh:
        fh.write("MOCK_FAIL_UPLOAD trigger")

    before = stats(base)
    rc, out = run_kb_upload(tmp, [code, "--env", "cloud-master", "--replace", "--no-wait"], base)
    after = stats(base)
    check("T7: 再投入失敗は exit 1", rc == 1, out)
    check("T7: エラーメッセージが出る", "エラー:" in out, out)
    check("T7: 削除は a.md の 1 件だけで止まる（b.md の削除には進まない。K3）",
          after["DELETE"] - before["DELETE"] == 1, (before, after))


def main():
    check("前提: kb_upload.py が存在する", os.path.isfile(KB_UPLOAD))
    check("前提: mock_server.py が存在する", os.path.isfile(MOCK_SERVER))

    port = free_port()
    base = f"http://127.0.0.1:{port}"
    proc = subprocess.Popen(
        [sys.executable, MOCK_SERVER, "--port", str(port)],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    try:
        ready = wait_ready(base)
        check("前提: mock サーバーが起動した", ready)

        test_t1_default_skip_unchanged(base)
        test_t2_refresh_never_deletes(base)
        test_t3_replace_respects_k1(base)
        test_t4_max_delete_exceeded(base)
        test_t5_replace_dry_run_lists_only(base)
        test_t6_no_uuid_leak(base)
        test_t7_delete_then_upload_failure_stops(base)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        for d in TMP_DIRS:
            shutil.rmtree(d, ignore_errors=True)
        os.environ.pop("DIFY_DATASET_KEY", None)
        os.environ.pop("DIFY_BASE_URL", None)

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
