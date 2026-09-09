#!/usr/bin/env python3
"""scripts/dify/inspect_rerank.py の単体検証（pytest ではなく、単体で走るスクリプト。
test_console_api.py と同じ作法。mock_server.py を子プロセスで起動して往復させる）。

    python3 scripts/dify/tests/test_inspect_rerank.py     # exit 0 で全件 PASS。ネットワークは 127.0.0.1 のみ

設計: docs/handoff/2026-09-09-rerank-decision.md §8 PR-1b・§9-1（Issue #195）

CI（`npm test`）には入れない（`CLAUDE.md` §3 のコマンド集合を変えない。test_console_api.py と同じ扱い）。
実行は implementer と reviewer が手で行う。
"""
import glob
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
INSPECT_PY = os.path.join(SCRIPTS_DIR, "inspect_rerank.py")
MOCK_SERVER = os.path.join(TESTS_DIR, "mock_server.py")

sys.path.insert(0, SCRIPTS_DIR)
sys.path.insert(0, TESTS_DIR)
import console_api  # noqa: E402
import inspect_rerank  # noqa: E402
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
        [sys.executable, INSPECT_PY, *args],
        cwd=ROOT, capture_output=True, text=True, timeout=30, env=env,
    )


SAMPLE_LLM_PROMPT = (
    "これはダミーのプロンプト本文です。" * 5
    + "機密扱いにすべき長文の一例（実際は業務指示・KPI 定義などが入る想定）。"
)
SAMPLE_DATASET_UUID = "12345678-90ab-cdef-1234-567890abcdef"


# ---------------------------------------------------------------------------
# T1: 再帰走査（ネットワーク不要）。トップレベルのキー形が違っても拾えること（§9-1）。
# ---------------------------------------------------------------------------

def _mrc(enable=False, provider="", model="", mode="reranking_model", top_k=8, score_threshold=None):
    return {
        "reranking_enable": enable,
        "reranking_mode": mode,
        "reranking_model": {"provider": provider, "model": model},
        "score_threshold": score_threshold,
        "top_k": top_k,
    }


def test_t1_recursive_walk_shapes():
    # A: 実機と同じ形（dify/apps/*.yml で確認済み）: graph.nodes[].data.multiple_retrieval_config
    shape_a = {"graph": {"nodes": [
        {"id": "1", "data": {"type": "start"}},
        {"id": "2", "data": {"type": "knowledge-retrieval", "multiple_retrieval_config": _mrc()}},
    ], "edges": []}}
    hits_a = inspect_rerank.find_retrieval_configs(shape_a)
    check("T1a: graph.nodes[].data 形で 1 件見つかる", len(hits_a) == 1, hits_a)

    # B: もう一段深い（data.graph.nodes[].data）。#114 C5 が未確認なので、この形でも壊れないこと
    shape_b = {"data": {"graph": {"nodes": [
        {"id": "2", "data": {"type": "knowledge-retrieval", "multiple_retrieval_config": _mrc(enable=True)}},
    ]}}}
    hits_b = inspect_rerank.find_retrieval_configs(shape_b)
    check("T1b: data.graph.nodes[].data 形でも 1 件見つかる", len(hits_b) == 1, hits_b)

    # C: まったく未知のキー名・配置（workflow.definition.graph.blocks[].config）
    shape_c = {"workflow": {"definition": {"graph": {"blocks": [
        {"kind": "retrieval", "config": {"multiple_retrieval_config": _mrc(enable=True, provider="p", model="m")}},
    ]}}}}
    hits_c = inspect_rerank.find_retrieval_configs(shape_c)
    check("T1c: 未知のキー配置でも multiple_retrieval_config だけを頼りに見つかる", len(hits_c) == 1, hits_c)

    # D: 複数件（今回のマスタは 1 ノードだが、複数あっても全部拾えること）
    shape_d = {"graph": {"nodes": [
        {"data": {"type": "knowledge-retrieval", "multiple_retrieval_config": _mrc()}},
        {"data": {"type": "knowledge-retrieval", "multiple_retrieval_config": _mrc(enable=True)}},
    ]}}
    hits_d = inspect_rerank.find_retrieval_configs(shape_d)
    check("T1d: 複数ノードをすべて拾う", len(hits_d) == 2, hits_d)


def test_t2_no_node_found():
    empty_draft = {"graph": {"nodes": [], "edges": []}, "features": {}, "environment_variables": []}
    hits = inspect_rerank.find_retrieval_configs(empty_draft)
    check("T2: knowledge-retrieval ノードが無いアプリは空リスト", hits == [])


# ---------------------------------------------------------------------------
# T3: 6 項目だけを抜くこと（§9-1「出す値は 6 項目だけ」）
# ---------------------------------------------------------------------------

def test_t3_extract_six_only_six_keys():
    mrc = dict(_mrc(enable=True, provider="langgenius/openrouter/openrouter", model="cohere/rerank-4-pro"))
    mrc["dataset_ids"] = [SAMPLE_DATASET_UUID]  # 6 項目に含めてはいけない値が紛れていても漏れないこと
    six = inspect_rerank.extract_six(mrc)
    check("T3a: extract_six が 6 キーちょうどを返す",
          set(six.keys()) == set(inspect_rerank.SIX_KEYS), six.keys())
    check("T3b: extract_six の戻り値に dataset_ids が含まれない", "dataset_ids" not in six, six)
    check("T3c: provider/model が正しく取れる",
          six["reranking_model.provider"] == "langgenius/openrouter/openrouter"
          and six["reranking_model.model"] == "cohere/rerank-4-pro", six)


def test_t4_reranking_enable_false_is_explicit():
    """PM 指摘: reranking_enable=false は黙って空を出さず、明示的に「未設定」と分かる出力にする。
    2026-09-08 に 12 本の再インポートが完了しているため、実機でこの結果が返る可能性が高い
    （設計書 §9-1 末尾）。実装の不具合ではないことが分かる文言が要る。"""
    six = inspect_rerank.extract_six(_mrc(enable=False))
    text = inspect_rerank.format_six(six)
    check("T4: reranking_enable=False のとき明示メッセージが出る",
          "Rerank は未設定です" in text and "reranking_enable=False" in text, text)


def test_t5_reranking_enable_missing_key():
    """multiple_retrieval_config はあるが reranking_enable キー自体が無い場合も落ちずに報告する。"""
    six = inspect_rerank.extract_six({"reranking_mode": "reranking_model"})
    text = inspect_rerank.format_six(six)
    check("T5: reranking_enable が None のとき別メッセージが出る（落ちない）",
          "reranking_enable が取得できません" in text, text)


# ---------------------------------------------------------------------------
# T6: app_name_for_code（APPS_DIR を一時ディレクトリに差し替えて実マスタと切り離す）
# ---------------------------------------------------------------------------

def test_t6_app_name_for_code(tmpdir):
    original_apps_dir = inspect_rerank.APPS_DIR
    try:
        inspect_rerank.APPS_DIR = tmpdir
        with open(os.path.join(tmpdir, "ZZ-01-fixture.yml"), "w", encoding="utf-8") as fh:
            fh.write("app:\n  name: 'ZZ-01 フィクスチャ'\n")
        name = inspect_rerank.app_name_for_code("ZZ-01")
        check("T6a: app.name を読める", name == "ZZ-01 フィクスチャ", name)

        try:
            inspect_rerank.app_name_for_code("ZZ-99")
            check("T6b: 存在しない管理番号は InspectError", False)
        except inspect_rerank.InspectError as e:
            check("T6b: 存在しない管理番号は InspectError", "見つかりません" in str(e), str(e))

        with open(os.path.join(tmpdir, "ZZ-02-empty-name.yml"), "w", encoding="utf-8") as fh:
            fh.write("app:\n  name: ''\n")
        try:
            inspect_rerank.app_name_for_code("ZZ-02")
            check("T6c: app.name が空なら InspectError", False)
        except inspect_rerank.InspectError as e:
            check("T6c: app.name が空なら InspectError", "空です" in str(e), str(e))
    finally:
        inspect_rerank.APPS_DIR = original_apps_dir


# ---------------------------------------------------------------------------
# T7〜: end-to-end（mock_server 経由）。実在する管理番号（dify/apps/KN-01・KN-02）の
# app.name をそのまま使う（フィクスチャを別途作らずに済むため。値そのものはテストのアサーション
# には使わず「読めた値と一致するか」だけを見るので、将来 PR-2 が app.name の周辺を変えても壊れない）。
# ---------------------------------------------------------------------------

def _real_app_name(code):
    apps_dir = os.path.join(ROOT, "dify", "apps")
    matches = sorted(glob.glob(os.path.join(apps_dir, f"{code}-*.yml")))
    assert matches, f"fixture prerequisite missing: dify/apps/{code}-*.yml"
    import yaml
    with open(matches[0], encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    return data["app"]["name"]


def test_t7_end_to_end_reports_six_items_and_no_leak(base):
    """KN-01 を模した下書きを用意し、CLI が 6 項目だけを出力し、プロンプト本文・dataset_ids の
    生 UUID・秘密（トークン）がいずれも標準出力に現れないことを確認する。"""
    name_kn01 = _real_app_name("KN-01")

    client = console_api.ConsoleClient(base, timeout=10)
    client.set_token("inspect-test-token")
    yaml_text = f"app:\n  name: '{name_kn01}'\n  description: test\nkind: app\nversion: 0.6.0\n" \
                "dependencies: []\nworkflow:\n  graph:\n    nodes: []\n    edges: []\n"
    app_id = client.import_dsl(yaml_text)

    draft = {
        "graph": {
            "nodes": [
                {"id": "1", "data": {"type": "start"}},
                {"id": "2", "data": {
                    "type": "knowledge-retrieval",
                    "dataset_ids": [SAMPLE_DATASET_UUID],
                    "multiple_retrieval_config": _mrc(enable=False),
                }},
                {"id": "3", "data": {
                    "type": "llm",
                    "prompt_template": [{"role": "system", "text": SAMPLE_LLM_PROMPT}],
                }},
            ],
            "edges": [],
        },
    }
    client.update_draft(app_id, draft)

    r = run_cli(["--env", "cloud-master", "KN-01"], {
        "DIFY_CONSOLE_URL": base, "DIFY_CONSOLE_TOKEN": "inspect-test-token", "DIFY_CONSOLE_REFRESH": "",
    })
    out = r.stdout + r.stderr
    check("T7: exit 0（Rerank 未設定は失敗ではない）", r.returncode == 0, f"exit={r.returncode} {out}")
    for key in inspect_rerank.SIX_KEYS:
        check(f"T7: 出力に {key} が含まれる", key in out, out)
    check("T7: reranking_enable=False の明示メッセージが出る", "Rerank は未設定です" in out, out)
    check("T7: プロンプト本文が出力に現れない", SAMPLE_LLM_PROMPT not in out, out)
    check("T7: dataset_ids の生 UUID が出力に現れない", SAMPLE_DATASET_UUID not in out, out)
    check("T7: トークン文字列が出力に現れない", "inspect-test-token" not in out, out)


def test_t8_app_not_found_reports_and_exits_nonzero(base):
    """Cloud に該当名のアプリが無いとき、落ちずに NOT FOUND と報告して exit 1 になること。"""
    r = run_cli(["--env", "cloud-master", "KN-02"], {
        "DIFY_CONSOLE_URL": base, "DIFY_CONSOLE_TOKEN": "inspect-test-token-2", "DIFY_CONSOLE_REFRESH": "",
    })
    out = r.stdout + r.stderr
    check("T8: アプリが見つからないとき exit 1", r.returncode == 1, f"exit={r.returncode} {out}")
    check("T8: NOT FOUND と報告する", "NOT FOUND" in out, out)


def test_t9_no_knowledge_retrieval_node_reports_and_exits_zero(base):
    """knowledge-retrieval ノードが 1 つも無いアプリでも落ちずに「無い」と報告し、exit 0 になること
    （見つからない＝失敗、ではなく、正常な観測結果として扱う）。"""
    name_kn02 = _real_app_name("KN-02")
    client = console_api.ConsoleClient(base, timeout=10)
    client.set_token("inspect-test-token-3")
    yaml_text = f"app:\n  name: '{name_kn02}'\n  description: test\nkind: app\nversion: 0.6.0\n" \
                "dependencies: []\nworkflow:\n  graph:\n    nodes: []\n    edges: []\n"
    client.import_dsl(yaml_text)  # draft は更新しない → 既定の空 graph のまま

    r = run_cli(["--env", "cloud-master", "KN-02"], {
        "DIFY_CONSOLE_URL": base, "DIFY_CONSOLE_TOKEN": "inspect-test-token-3", "DIFY_CONSOLE_REFRESH": "",
    })
    out = r.stdout + r.stderr
    check("T9: ノードが無くても exit 0", r.returncode == 0, f"exit={r.returncode} {out}")
    check("T9: 「見つかりません」と報告する", "見つかりません" in out, out)


def test_t10_auth_error_exit3(base):
    r = run_cli(["--env", "cloud-master", "KN-01"], {
        "DIFY_CONSOLE_URL": base,
        "DIFY_CONSOLE_REFRESH": mock_server.EXPIRED_REFRESH_TOKEN, "DIFY_CONSOLE_TOKEN": "",
    })
    out = r.stdout + r.stderr
    check("T10: セッション期限切れで exit 3", r.returncode == 3, f"exit={r.returncode} {out}")
    check("T10: 出力にリフレッシュトークン文字列が現れない",
          mock_server.EXPIRED_REFRESH_TOKEN not in out, out)


def test_t11_no_write_calls_in_module_source():
    """§9-1: inspect_rerank.py が update_draft / publish / import_dsl を呼ばないこと
    （get_draft() 以外の書き込み系 API を呼ばない、という設計上の要求をソース上でも検査する）。
    docstring の説明文（`update_draft()` のようにメソッド名だけを挙げている箇所）は
    実際の呼び出しではないので誤検知しないよう、`.<name>(` の形（レシーバ経由の呼び出し）だけを見る。"""
    import re
    with open(INSPECT_PY, encoding="utf-8") as fh:
        src = fh.read()
    for forbidden in ("update_draft", "publish", "import_dsl", "confirm_import"):
        pattern = re.compile(r"\." + re.escape(forbidden) + r"\(")
        check(f"T11: inspect_rerank.py は .{forbidden}( を呼ばない（レシーバ経由の実呼び出し）",
              not pattern.search(src), pattern.findall(src))
    # tools/verify.mjs §15 と同じ判定（HTTP メソッドとして "DELETE" が実際に渡されている箇所だけを見る）
    delete_lit_re = re.compile(r'_req\(\s*(["\'])DELETE\1|method\s*=\s*(["\'])DELETE\2', re.IGNORECASE)
    check("T11: inspect_rerank.py に \"DELETE\" を渡す HTTP 呼び出しが無い", not delete_lit_re.search(src))


def main():
    check("前提: inspect_rerank.py が存在する", os.path.isfile(INSPECT_PY))
    check("前提: mock_server.py が存在する", os.path.isfile(MOCK_SERVER))

    test_t1_recursive_walk_shapes()
    test_t2_no_node_found()
    test_t3_extract_six_only_six_keys()
    test_t4_reranking_enable_false_is_explicit()
    test_t5_reranking_enable_missing_key()
    test_t11_no_write_calls_in_module_source()

    with tempfile.TemporaryDirectory(prefix="inspect_rerank_apps_") as tmpdir:
        test_t6_app_name_for_code(tmpdir)

    port = free_port()
    base = f"http://127.0.0.1:{port}"
    proc = subprocess.Popen(
        [sys.executable, MOCK_SERVER, "--port", str(port)],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    try:
        ready = wait_ready(base)
        check("前提: mock サーバーが起動した", ready)

        test_t7_end_to_end_reports_six_items_and_no_leak(base)
        test_t8_app_not_found_reports_and_exits_nonzero(base)
        test_t9_no_knowledge_retrieval_node_reports_and_exits_zero(base)
        test_t10_auth_error_exit3(base)
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
