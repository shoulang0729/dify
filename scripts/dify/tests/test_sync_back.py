#!/usr/bin/env python3
"""scripts/dify/sync_back.py の単体検証（pytest ではなく、単体で走るスクリプト。mock_server.py に合わせる）。

    python3 scripts/dify/tests/test_sync_back.py     # exit 0 で全件 PASS。ネットワークを呼ばない。dify/apps は書き換えない

設計: docs/handoff/2026-09-07-china-models-and-syncback.md §3-7（T1〜T8）／T9 は DI-015 対応（本 PR で追加）

CI（`npm test`）には入れない（`CLAUDE.md` §3 のコマンド集合を変えない）。実行は implementer と reviewer が手で行う。
"""
import copy
import glob
import os
import shutil
import subprocess
import sys
import tempfile

try:
    import yaml
except ImportError:  # pragma: no cover
    print("PyYAML がありません: pip3 install pyyaml")
    sys.exit(2)

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS_DIR = os.path.dirname(TESTS_DIR)
ROOT = os.path.dirname(os.path.dirname(SCRIPTS_DIR))
APPS_DIR = os.path.join(ROOT, "dify", "apps")
SYNC_BACK = os.path.join(SCRIPTS_DIR, "sync_back.py")

RESULTS = []


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond), detail))
    mark = "PASS" if cond else "FAIL"
    print(f"[{mark}] {name}" + (f" — {detail}" if detail and not cond else ""))


def run(args, cwd=None):
    return subprocess.run(
        [sys.executable, SYNC_BACK, *args],
        cwd=cwd or ROOT, capture_output=True, text=True, timeout=30,
    )


def all_masters():
    return sorted(glob.glob(os.path.join(APPS_DIR, "*.yml")))


def write_yaml(path, data):
    with open(path, "w", encoding="utf-8") as fh:
        yaml.safe_dump(data, fh, allow_unicode=True, sort_keys=False, default_flow_style=False, width=4096)


def load(path):
    with open(path, encoding="utf-8") as fh:
        return yaml.safe_load(fh)


# ---------------------------------------------------------------------------
# T1: 往復（マスタ 12 本すべて）
# ---------------------------------------------------------------------------

def test_t1_roundtrip_all_masters(tmpdir):
    masters = all_masters()
    check("T1-precondition: マスタが 12 本ある", len(masters) == 12, f"実際: {len(masters)} 本")
    ok = True
    detail = ""
    for m in masters:
        code = None
        base = os.path.basename(m)
        # <CODE>-<slug>.yml の CODE を使う（--code で明示。ファイル名判定に頼らない検証）
        parts = base.split("-", 2)
        code = f"{parts[0]}-{parts[1]}"
        out_dir = os.path.join(tmpdir, "t1", code)
        os.makedirs(out_dir, exist_ok=True)
        # render --env cloud-master 相当の出力 = cloud-master は恒等なのでマスタ自身と同じ内容
        exported = os.path.join(out_dir, "export.yml")
        shutil.copyfile(m, exported)
        result = run(["--code", code, "--out", out_dir, exported])
        if result.returncode != 0:
            ok = False
            detail = f"{code}: exit={result.returncode} stderr/stdout={result.stdout}{result.stderr}"
            break
        out_path = os.path.join(out_dir, base)
        if not os.path.isfile(out_path):
            ok = False
            detail = f"{code}: 出力ファイルが無い: {out_path}"
            break
        if load(out_path) != load(m):
            ok = False
            detail = f"{code}: 往復後の dict がマスタと不一致"
            break
    check("T1: マスタ 12 本すべての往復が恒等（dict 一致）", ok, detail)


# ---------------------------------------------------------------------------
# T2: N1（dataset_ids）
# ---------------------------------------------------------------------------

def test_t2_dataset_ids(tmpdir):
    master = os.path.join(APPS_DIR, "KN-01-tech-knowledge-qa.yml")
    data = load(master)
    hit = False
    for n in data["workflow"]["graph"]["nodes"]:
        d = n.get("data") or {}
        if d.get("type") == "knowledge-retrieval":
            d["dataset_ids"] = ["dummy-id-1"]
            hit = True
    check("T2-precondition: knowledge-retrieval ノードが見つかる", hit)

    out_dir = os.path.join(tmpdir, "t2")
    os.makedirs(out_dir, exist_ok=True)
    exported = os.path.join(out_dir, "export.yml")
    write_yaml(exported, data)

    result = run(["--code", "KN-01", "--out", out_dir, exported])
    check("T2: exit 0", result.returncode == 0, f"stdout={result.stdout} stderr={result.stderr}")

    out_path = os.path.join(out_dir, "KN-01-tech-knowledge-qa.yml")
    written = load(out_path) if os.path.isfile(out_path) else {}
    ds_empty = all(
        (n.get("data") or {}).get("dataset_ids") == []
        for n in (written.get("workflow", {}).get("graph", {}).get("nodes", []))
        if (n.get("data") or {}).get("type") == "knowledge-retrieval"
    )
    check("T2: dataset_ids が [] になる", ds_empty)

    leaked = "dummy-id-1" in (result.stdout + result.stderr)
    check("T2: stdout/stderr に id の値が出ていない", not leaked)


# ---------------------------------------------------------------------------
# T3: N3・N4（version・dependencies）
# ---------------------------------------------------------------------------

def test_t3_version_dependencies(tmpdir):
    master = os.path.join(APPS_DIR, "KN-01-tech-knowledge-qa.yml")
    data = load(master)
    data["version"] = "0.7.0"
    data["dependencies"] = [{"type": "marketplace", "value": {"plugin_unique_identifier": "x"}}]

    out_dir = os.path.join(tmpdir, "t3")
    os.makedirs(out_dir, exist_ok=True)
    exported = os.path.join(out_dir, "export.yml")
    write_yaml(exported, data)

    result = run(["--code", "KN-01", "--out", out_dir, exported])
    check("T3: exit 0", result.returncode == 0, f"stdout={result.stdout} stderr={result.stderr}")

    out_path = os.path.join(out_dir, "KN-01-tech-knowledge-qa.yml")
    written = load(out_path) if os.path.isfile(out_path) else {}
    check("T3: version が 0.6.0 に強制される", written.get("version") == "0.6.0", str(written.get("version")))
    check("T3: dependencies が [] に戻る", written.get("dependencies") == [], str(written.get("dependencies")))


# ---------------------------------------------------------------------------
# T4: N5（モデルは戻さない。env と食い違えば exit 1）
# ---------------------------------------------------------------------------

def test_t4_model_mismatch(tmpdir):
    master = os.path.join(APPS_DIR, "KN-01-tech-knowledge-qa.yml")
    data = load(master)
    changed = False
    for n in data["workflow"]["graph"]["nodes"]:
        d = n.get("data") or {}
        if d.get("type") == "llm":
            d["model"]["name"] = "some-other-model-name"
            changed = True
    check("T4-precondition: llm ノードが見つかる", changed)

    out_dir = os.path.join(tmpdir, "t4")
    os.makedirs(out_dir, exist_ok=True)
    exported = os.path.join(out_dir, "export.yml")
    write_yaml(exported, data)

    result = run(["--code", "KN-01", "--out", out_dir, exported])
    check("T4: exit 1", result.returncode == 1, f"exit={result.returncode}")
    check("T4: メッセージに R1 が出る", "R1" in (result.stdout + result.stderr))
    out_path = os.path.join(out_dir, "KN-01-tech-knowledge-qa.yml")
    check("T4: 書き込まれていない", not os.path.isfile(out_path))


# ---------------------------------------------------------------------------
# T5: 可読性（block scalar）
# ---------------------------------------------------------------------------

def test_t5_block_scalar(tmpdir):
    master = os.path.join(APPS_DIR, "KN-01-tech-knowledge-qa.yml")
    out_dir = os.path.join(tmpdir, "t5")
    os.makedirs(out_dir, exist_ok=True)
    exported = os.path.join(out_dir, "export.yml")
    shutil.copyfile(master, exported)

    result = run(["--code", "KN-01", "--out", out_dir, exported])
    check("T5: exit 0", result.returncode == 0, f"stdout={result.stdout} stderr={result.stderr}")

    out_path = os.path.join(out_dir, "KN-01-tech-knowledge-qa.yml")
    text = open(out_path, encoding="utf-8").read() if os.path.isfile(out_path) else ""
    has_block = "text: |-" in text or "text: |" in text
    has_flattened = 'text: "' in text
    check("T5: prompt_template[].text が block scalar（|- ）で出る", has_block and not has_flattened,
          f"block={has_block} flattened={has_flattened}")


# ---------------------------------------------------------------------------
# T6: 非対応 env
# ---------------------------------------------------------------------------

def test_t6_unsupported_env(tmpdir):
    master = os.path.join(APPS_DIR, "KN-01-tech-knowledge-qa.yml")
    out_dir = os.path.join(tmpdir, "t6")
    os.makedirs(out_dir, exist_ok=True)
    exported = os.path.join(out_dir, "export.yml")
    shutil.copyfile(master, exported)

    before = subprocess.run(["git", "status", "--porcelain", "dify/apps/"], cwd=ROOT,
                             capture_output=True, text=True).stdout

    result = run(["--code", "KN-01", "--env", "customer-a", exported])
    check("T6: exit 2", result.returncode == 2, f"exit={result.returncode}")

    after = subprocess.run(["git", "status", "--porcelain", "dify/apps/"], cwd=ROOT,
                            capture_output=True, text=True).stdout
    check("T6: dify/apps/ に書き込みが無い", before == after)


# ---------------------------------------------------------------------------
# T7: 番号判定
# ---------------------------------------------------------------------------

def test_t7_code_detection(tmpdir):
    out_dir = os.path.join(tmpdir, "t7")
    os.makedirs(out_dir, exist_ok=True)

    ok_path = os.path.join(out_dir, "anything.yml")
    write_yaml(ok_path, {
        "app": {"name": "KN-01 技術ナレッジQA", "description": "x"},
        "dependencies": [], "kind": "app", "version": "0.6.0",
        "workflow": {"graph": {"edges": [], "nodes": []}},
    })
    result_ok = run(["--out", out_dir, ok_path])
    check("T7: app.name の先頭から KN-01 と判定できる", result_ok.returncode == 0,
          f"exit={result_ok.returncode} stdout={result_ok.stdout} stderr={result_ok.stderr}")

    bad_path = os.path.join(out_dir, "random-file-name.yml")
    write_yaml(bad_path, {
        "app": {"name": "名前だけでは番号が分からないアプリ", "description": "x"},
        "dependencies": [], "kind": "app", "version": "0.6.0",
        "workflow": {"graph": {"edges": [], "nodes": []}},
    })
    result_bad = run(["--out", out_dir, bad_path])
    check("T7: 判定できないファイルは exit 2", result_bad.returncode == 2, f"exit={result_bad.returncode}")


# ---------------------------------------------------------------------------
# T8: 複数 llm（LG-01）
# ---------------------------------------------------------------------------

def test_t8_multi_llm(tmpdir):
    master = os.path.join(APPS_DIR, "LG-01-ja-zh-translation.yml")
    check("T8-precondition: LG-01 がある", os.path.isfile(master))
    llm_count = sum(
        1 for n in load(master)["workflow"]["graph"]["nodes"]
        if (n.get("data") or {}).get("type") == "llm"
    )
    check("T8-precondition: llm ノードが 2 つ", llm_count == 2, str(llm_count))

    out_dir = os.path.join(tmpdir, "t8")
    os.makedirs(out_dir, exist_ok=True)
    exported = os.path.join(out_dir, "export.yml")
    shutil.copyfile(master, exported)

    result = run(["--code", "LG-01", "--out", out_dir, exported])
    check("T8: exit 0", result.returncode == 0, f"stdout={result.stdout} stderr={result.stderr}")
    out_path = os.path.join(out_dir, "LG-01-ja-zh-translation.yml")
    check("T8: 往復後の dict がマスタと一致", os.path.isfile(out_path) and load(out_path) == load(master))


# ---------------------------------------------------------------------------
# T9: DI-015 — completion_params の食い違いでも自己検証の前に差分要約が出る
# ---------------------------------------------------------------------------

def test_t9_completion_params_summary_before_exit(tmpdir):
    """自己検証（S6）で不一致（exit 1）になっても、差分要約（completion_params の
    マスタ／export 両方の値）を先に stdout へ出す（DI-015）。マスタは無変更のまま。"""
    master = os.path.join(APPS_DIR, "KN-01-tech-knowledge-qa.yml")
    data = load(master)
    changed = False
    for n in data["workflow"]["graph"]["nodes"]:
        d = n.get("data") or {}
        if d.get("type") == "llm":
            # Cloud 側だけ max_tokens が古い値のまま、という擬似エクスポートを作る
            d["model"]["completion_params"]["max_tokens"] = 4096
            changed = True
    check("T9-precondition: llm ノードが見つかる", changed)

    out_dir = os.path.join(tmpdir, "t9")
    os.makedirs(out_dir, exist_ok=True)
    exported = os.path.join(out_dir, "export.yml")
    write_yaml(exported, data)

    before = load(master)
    result = run(["--code", "KN-01", "--out", out_dir, "--dry-run", exported])
    combined = result.stdout + result.stderr

    check("T9: exit 1", result.returncode == 1, f"exit={result.returncode}")
    check("T9: stdout に差分要約（モデル差分の行）が出る", "モデル差分:" in combined, combined)
    check("T9: completion_params.max_tokens の両方の値が出る（マスタ 8192 / export 4096）",
          "マスタ=8192" in combined and "export=4096" in combined, combined)
    check("T9: 「差が出たルール」が要約に出る", "差が出たルール:" in combined, combined)
    out_path = os.path.join(out_dir, "KN-01-tech-knowledge-qa.yml")
    check("T9: 書き込まれていない（--dry-run）", not os.path.isfile(out_path))
    check("T9: マスタは無変更", load(master) == before)


def main():
    check("前提: sync_back.py が存在する", os.path.isfile(SYNC_BACK))
    before_status = subprocess.run(["git", "status", "--porcelain", "dify/apps/"], cwd=ROOT,
                                    capture_output=True, text=True).stdout

    with tempfile.TemporaryDirectory(prefix="sync_back_test_") as tmpdir:
        test_t1_roundtrip_all_masters(tmpdir)
        test_t2_dataset_ids(tmpdir)
        test_t3_version_dependencies(tmpdir)
        test_t4_model_mismatch(tmpdir)
        test_t5_block_scalar(tmpdir)
        test_t6_unsupported_env(tmpdir)
        test_t7_code_detection(tmpdir)
        test_t8_multi_llm(tmpdir)
        test_t9_completion_params_summary_before_exit(tmpdir)

    after_status = subprocess.run(["git", "status", "--porcelain", "dify/apps/"], cwd=ROOT,
                                   capture_output=True, text=True).stdout
    check("後始末: dify/apps/ に書き込みが残っていない（git status --porcelain が空のまま）",
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
