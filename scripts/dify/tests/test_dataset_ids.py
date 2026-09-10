#!/usr/bin/env python3
"""scripts/dify/dataset_ids.py の単体検証（T1〜T9。設計書 docs/handoff/2026-09-09-dataset-ids-in-ci.md §11-2。
Issue #209 PR-1）。

    python3 scripts/dify/tests/test_dataset_ids.py     # exit 0 で全件 PASS。ネットワークは 127.0.0.1 のみ

CI（`npm test`）には入れない（`CLAUDE.md` §3 のコマンド集合を変えない）。実行は implementer と reviewer が
手で行う（test_cloud_deploy.py / test_kb_upload.py と同じ作法）。

`dify/apps/**`（T1 のみ）は読むだけ。`dify/env/**` は一切読み書きしない——このテストは
`dataset_ids.ENV_DIR` を一時ディレクトリへ差し替えて完結させる（`test_kb_upload.py` が `KB_DIR` を
差し替える手口と同じ）。
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
MOCK_SERVER = os.path.join(TESTS_DIR, "mock_server.py")

sys.path.insert(0, SCRIPTS_DIR)
import dataset_ids  # noqa: E402

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


def get_stats(base):
    with urllib.request.urlopen(base.rstrip("/") + "/__test__/stats", timeout=10) as r:
        return json.loads(r.read())


def list_datasets(base):
    with urllib.request.urlopen(base.rstrip("/") + "/v1/datasets?page=1&limit=100000", timeout=10) as r:
        return json.loads(r.read())["data"]


def v1_base(base):
    """mock_server.py の Datasets API は /v1/datasets に生えている（kb_upload.py の DIFY_BASE_URL 既定と同じ
    /v1 サフィックス規約）。dataset_ids.resolve() の base_url にはこちらを渡す。"""
    return base.rstrip("/") + "/v1"


def create_dataset(base, name):
    req = urllib.request.Request(
        base.rstrip("/") + "/v1/datasets", method="POST",
        data=json.dumps({"name": name}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


@contextlib.contextmanager
def temp_env(env_name, env_yaml_text):
    """dataset_ids.ENV_DIR を一時ディレクトリへ差し替えて <env_name>/env.yml を書く。
    本物の dify/env/** は一切変更しない（test_kb_upload.py の KB_DIR 差し替えと同じ手口）。"""
    tmp_root = tempfile.mkdtemp(prefix="dataset_ids_test_env_")
    env_dir = os.path.join(tmp_root, env_name)
    os.makedirs(env_dir, exist_ok=True)
    with open(os.path.join(env_dir, "env.yml"), "w", encoding="utf-8") as fh:
        fh.write(env_yaml_text)
    original = dataset_ids.ENV_DIR
    dataset_ids.ENV_DIR = tmp_root
    try:
        yield
    finally:
        dataset_ids.ENV_DIR = original
        shutil.rmtree(tmp_root, ignore_errors=True)


# ---------------------------------------------------------------------------
# T1: kb_codes()（ネットワーク不要。実物の dify/apps/*.yml を読む）
# ---------------------------------------------------------------------------

def test_t1_kb_codes_from_real_apps():
    """kb_codes() が KN-01/KN-02/KN-03/GN-01 の 4 件だけを返す（番号のハードコードではなく
    DSL の knowledge-retrieval ノードから導出していること。8 本は返らない）。"""
    all_codes = sorted({
        f.split("-", 2)[0] + "-" + f.split("-", 2)[1]
        for f in os.listdir(dataset_ids.APPS_DIR) if f.endswith(".yml")
    })
    check("T1（前提）: dify/apps/*.yml から 12 件の管理番号が読める", len(all_codes) == 12, all_codes)
    result = dataset_ids.kb_codes(all_codes)
    check(
        "T1: kb_codes() が KN-01/KN-02/KN-03/GN-01 の 4 件だけを返す",
        sorted(result) == ["GN-01", "KN-01", "KN-02", "KN-03"],
        result,
    )


# ---------------------------------------------------------------------------
# T9: assert_bound()（ネットワーク不要）
# ---------------------------------------------------------------------------

def test_t9_assert_bound():
    tmp_dir = tempfile.mkdtemp(prefix="dataset_ids_test_build_")
    try:
        with open(os.path.join(tmp_dir, "ZZ-01-empty.yml"), "w", encoding="utf-8") as fh:
            fh.write(
                "workflow:\n  graph:\n    nodes:\n"
                "      - id: n1\n        data: { type: knowledge-retrieval, title: '知識検索', dataset_ids: [] }\n"
            )
        with open(os.path.join(tmp_dir, "ZZ-02-baked.yml"), "w", encoding="utf-8") as fh:
            fh.write(
                "workflow:\n  graph:\n    nodes:\n"
                "      - id: n1\n        data: { type: knowledge-retrieval, title: '知識検索', "
                "dataset_ids: ['11111111-1111-1111-1111-111111111111'] }\n"
            )

        raised = False
        try:
            dataset_ids.assert_bound(tmp_dir, ["ZZ-01"])
        except dataset_ids.DatasetResolveError:
            raised = True
        check("T9: dataset_ids: [] を含む DSL で例外", raised)

        raised2 = False
        try:
            dataset_ids.assert_bound(tmp_dir, ["ZZ-02"])
        except dataset_ids.DatasetResolveError:
            raised2 = True
        check("T9: UUID 1 件入りの DSL で正常終了（例外を投げない）", not raised2)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# T2〜T7: resolve()（mock サーバー相手）
# ---------------------------------------------------------------------------

ENV_YAML = """schema: 1
knowledge:
  ZZ-01: { name: 'ZZ-01 サンプルKB（単一一致）', id: '${DS_TEST_ZZ01}' }
  ZZ-04: { name: 'ZZ-04 重複KB', id: '${DS_TEST_ZZ04}' }
  ZZ-05: { name: 'ZZ-05 存在しないKB', id: '${DS_TEST_ZZ05}' }
  ZZ-06: { name: 'ZZ-06 環境変数設定済み', id: '${DS_TEST_ZZ06}' }
  ZZ-07: { name: 'ZZ-07 ページ跨ぎKB', id: '${DS_TEST_ZZ07}' }
  ZZ-08: { name: 'ZZ-08 GETのみ確認用KB', id: '${DS_TEST_ZZ08}' }
"""


def test_t3_name_match_and_pagination(base):
    create_dataset(base, "ZZ-01 サンプルKB（単一一致）")
    # ページ跨ぎ（T3 後半）: limit（100）を超える埋め草を作ってから対象を作り、
    # has_more を跨いだ 2 ページ目でも引けることを確かめる。
    for i in range(dataset_ids.PAGE_LIMIT):
        create_dataset(base, f"ZZ-FILLER-{i:04d}")
    create_dataset(base, "ZZ-07 ページ跨ぎKB")

    with temp_env("ds-test-env", ENV_YAML):
        result = dataset_ids.resolve(
            "ds-test-env", ["ZZ-01", "ZZ-07"], environ={}, base_url=v1_base(base), key="test-dataset-key",
        )
    check("T3: 名前完全一致 1 件を引ける", "DS_TEST_ZZ01" in result, result)
    check("T3: has_more を跨いだ 2 ページ目の KB も引ける", "DS_TEST_ZZ07" in result, result)


def test_t4_duplicate_name(base):
    create_dataset(base, "ZZ-04 重複KB")
    create_dataset(base, "ZZ-04 重複KB")
    with temp_env("ds-test-env", ENV_YAML):
        raised = None
        try:
            dataset_ids.resolve("ds-test-env", ["ZZ-04"], environ={}, base_url=v1_base(base), key="test-dataset-key")
        except dataset_ids.DatasetResolveError as e:
            raised = e
    check("T4: 同名 KB が 2 件あると DatasetResolveError（どちらも採らない）", raised is not None, raised)


def test_t5_zero_match(base):
    with temp_env("ds-test-env", ENV_YAML):
        raised = None
        try:
            dataset_ids.resolve("ds-test-env", ["ZZ-05"], environ={}, base_url=v1_base(base), key="test-dataset-key")
        except dataset_ids.DatasetResolveError as e:
            raised = e
    check("T5: 名前 0 件で DatasetResolveError", raised is not None, raised)


def test_t6_env_preset_skips_api():
    """環境変数が既に設定されている番号は API を 1 度も呼ばない（R0-a）。
    誰も listen していないポートを指しても成功することで証明する（test_cloud_deploy.py T9 と同じ手口）。"""
    dead_port = free_port()
    dead_base = f"http://127.0.0.1:{dead_port}"
    with temp_env("ds-test-env", ENV_YAML):
        environ = {"DS_TEST_ZZ06": "preset-dataset-id-0000"}
        try:
            result = dataset_ids.resolve(
                "ds-test-env", ["ZZ-06"], environ=environ, base_url=dead_base, key="",
            )
            ok = result == {"DS_TEST_ZZ06": "preset-dataset-id-0000"}
            detail = result
        except dataset_ids.DatasetResolveError as e:
            ok, detail = False, f"予期せぬ例外（API を呼びに行った証拠の疑い）: {e}"
    check(
        "T6: 環境変数が既に設定されていれば API を呼ばずにその値を採る"
        "（誰も listen していないポートでも成功する＝ネットワークを呼んでいない証拠）",
        ok, detail,
    )


def test_t7_no_uuid_leak(base):
    """成功時・失敗時のどちらでも、標準出力・例外文字列に完全な UUID が現れない（KB 名は出てよい）。"""
    UUID_RE = re.compile(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b")

    with temp_env("ds-test-env", ENV_YAML):
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            result = dataset_ids.resolve("ds-test-env", ["ZZ-01"], environ={}, base_url=v1_base(base), key="test-dataset-key")
        check("T7: 成功時の標準出力に UUID が現れない", not UUID_RE.search(buf.getvalue()), buf.getvalue())
        check("T7: 戻り値には実際の dataset id が入っている（マスクは呼び出し側の責務。前提確認）", bool(result))

        create_dataset(base, "ZZ-04 重複KB")
        create_dataset(base, "ZZ-04 重複KB")
        raised = None
        try:
            dataset_ids.resolve("ds-test-env", ["ZZ-04"], environ={}, base_url=v1_base(base), key="test-dataset-key")
        except dataset_ids.DatasetResolveError as e:
            raised = e
        check(
            "T7: 例外文字列に完全な UUID が現れない（先頭 8 文字までに短縮されている）",
            raised is not None and not UUID_RE.search(str(raised)), str(raised),
        )


def test_t2_only_get_is_sent(base):
    """resolve() が GET 以外の HTTP メソッドを 1 度も送らない。POST（データセット作成）・PATCH・DELETE の
    いずれも呼ばれていないことを、mock サーバーの状態（件数・累計カウンタ）の前後差分で確認する。
    加えてソースコードに POST/PATCH/PUT/DELETE のメソッドリテラルが無いことも静的に確認する
    （tools/verify.mjs §15 が kb_upload.py に対して行っているのと同じ考え方）。"""
    create_dataset(base, "ZZ-08 GETのみ確認用KB")  # このテスト専用の一意な名前（他テストのフィクスチャと衝突しない）
    before_count = len(list_datasets(base))
    before_stats = get_stats(base)

    with temp_env("ds-test-env", ENV_YAML):
        dataset_ids.resolve("ds-test-env", ["ZZ-08"], environ={}, base_url=v1_base(base), key="test-dataset-key")

    after_count = len(list_datasets(base))
    after_stats = get_stats(base)
    check(
        "T2: resolve() の前後でデータセット件数が変わらない（POST でデータセットを作っていない証拠）",
        after_count == before_count, (before_count, after_count),
    )
    check(
        "T2: DELETE/PATCH/update_by_text の累計カウンタが変わらない",
        after_stats.get("DELETE", 0) == before_stats.get("DELETE", 0)
        and after_stats.get("PATCH", 0) == before_stats.get("PATCH", 0)
        and after_stats.get("update_by_text", 0) == before_stats.get("update_by_text", 0),
        (before_stats, after_stats),
    )

    src_path = os.path.join(SCRIPTS_DIR, "dataset_ids.py")
    with open(src_path, encoding="utf-8") as fh:
        src = fh.read()
    method_lit_re = re.compile(r'method\s*=\s*["\'](POST|PATCH|PUT|DELETE)["\']', re.IGNORECASE)
    check(
        "T2: dataset_ids.py のソースに POST/PATCH/PUT/DELETE の HTTP メソッドリテラルが無い",
        not method_lit_re.search(src),
    )


def test_t8_environ_unchanged():
    """resolve() の前後で os.environ のキー集合が不変（C2。M5：resolve() は environ を読むだけ）。
    誰も listen していないポートを指した状態で確認する（preset 済みのためネットワークも呼ばない）。"""
    before_keys = set(os.environ.keys())
    with temp_env("ds-test-env", ENV_YAML):
        environ_copy = dict(os.environ)
        environ_copy["DS_TEST_ZZ06"] = "preset-for-t8"
        try:
            dataset_ids.resolve(
                "ds-test-env", ["ZZ-06"], environ=environ_copy, base_url="http://127.0.0.1:1", key="",
            )
            raised = False
        except dataset_ids.DatasetResolveError:
            raised = True
    after_keys = set(os.environ.keys())
    check("T8（前提）: preset 済みのため例外を投げない", not raised)
    check(
        "T8: resolve() の前後で os.environ のキー集合が不変",
        before_keys == after_keys,
        (before_keys - after_keys, after_keys - before_keys),
    )
    check(
        "T8: 呼び出し側が渡した environ dict に値を混ぜても、実プロセスの os.environ には現れない",
        "DS_TEST_ZZ06" not in os.environ,
    )


def main():
    check("前提: scripts/dify/dataset_ids.py が存在する", os.path.isfile(os.path.join(SCRIPTS_DIR, "dataset_ids.py")))
    check("前提: mock_server.py が存在する", os.path.isfile(MOCK_SERVER))

    test_t1_kb_codes_from_real_apps()
    test_t9_assert_bound()
    test_t8_environ_unchanged()

    port = free_port()
    base = f"http://127.0.0.1:{port}"
    proc = subprocess.Popen(
        [sys.executable, MOCK_SERVER, "--port", str(port)],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    try:
        ready = wait_ready(base)
        check("前提: mock サーバーが起動した", ready)

        test_t3_name_match_and_pagination(base)
        test_t4_duplicate_name(base)
        test_t5_zero_match(base)
        test_t6_env_preset_skips_api()
        test_t7_no_uuid_leak(base)
        test_t2_only_get_is_sent(base)
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
