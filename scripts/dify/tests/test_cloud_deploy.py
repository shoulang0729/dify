#!/usr/bin/env python3
"""scripts/dify/cloud_deploy.py の単体検証（pytest ではなく、単体で走るスクリプト。
test_console_api.py / test_run_tests.py と同じ作法。mock_server.py を子プロセスで起動して往復させる）。

    python3 scripts/dify/tests/test_cloud_deploy.py     # exit 0 で全件 PASS。ネットワークは 127.0.0.1 のみ

設計: docs/handoff/2026-09-08-cloud-console-deploy.md §2・§4-3・§7 PR-2（Issue #114）／
docs/handoff/2026-09-08-cloud-auth-and-w4.md §9-2・§9-3・§11「W4-4」（Issue #121。P1・B3）／
docs/handoff/2026-09-09-dataset-ids-in-ci.md §4-1〜§4-4・§11-3（Issue #209 PR-2。0.5 段の dataset id
解決・1.5 段の G-KB2 一本化。T10〜T14 は関数名 test_209_*）

CI（`npm test`）には入れない（`CLAUDE.md` §3 のコマンド集合を変えない）。実行は implementer と reviewer が手で行う。
`dify/env/cloud-master/env.yml`・`dify/apps/*.yml` は**読むだけ**（書き換えない）。生成物 `dify/build/cloud-master/**`
は gitignore 対象（`dify/build/`）。テストは --app-id での override や専用の管理番号を使って、
テスト同士が同じアプリ名で衝突しない（名前一致に巻き込まれない）ようにしてある。
"""
import contextlib
import glob
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
CLOUD_DEPLOY = os.path.join(SCRIPTS_DIR, "cloud_deploy.py")
MOCK_SERVER = os.path.join(TESTS_DIR, "mock_server.py")
BUILD_DIR = os.path.join(ROOT, "dify", "build", "cloud-master")

sys.path.insert(0, SCRIPTS_DIR)
sys.path.insert(0, TESTS_DIR)
import console_api  # noqa: E402
import cloud_deploy  # noqa: E402
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


def run_cli(args, env_extra=None, timeout=60):
    env = dict(os.environ)
    env.update(env_extra or {})
    return subprocess.run(
        [sys.executable, CLOUD_DEPLOY, *args],
        cwd=ROOT, capture_output=True, text=True, timeout=timeout, env=env,
    )


def list_apps_via_http(base, token):
    req = urllib.request.Request(
        base.rstrip("/") + "/console/api/apps?page=1&limit=100",
        headers={"Authorization": f"Bearer {token}"},
    )
    with urllib.request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())["data"]


def get_stats(base):
    """mock_server.py の /__test__/stats（DELETE/PATCH/update_by_text/publish の累計呼び出し回数）を取る。
    テストをまたいで累積するグローバル状態なので、P1 の検証は必ず前後の差分で見ること。"""
    with urllib.request.urlopen(base.rstrip("/") + "/__test__/stats", timeout=10) as r:
        return json.loads(r.read())


def cleanup_build():
    if os.path.isdir(BUILD_DIR):
        shutil.rmtree(BUILD_DIR, ignore_errors=True)


SAMPLE_YAML = """app:
  name: {name}
  description: test
kind: app
version: 0.6.0
dependencies: []
workflow:
  graph:
    nodes: []
    edges: []
"""


# ---------------------------------------------------------------------------
# 純粋関数のテスト（ネットワーク不要）
# ---------------------------------------------------------------------------

def test_t1_env_app_id_priority():
    """env.yml の apps.<番号>.id 解決: null / ${VAR}（未解決）/ ${VAR}（解決済み）/ 直値。"""
    env_raw = {"apps": {
        "KN-01": {"id": None},
        "KN-02": {"id": "${CLOUD_DEPLOY_TEST_UNDEFINED_VAR}"},
        "KN-03": {"id": "existing-uuid-0000"},
    }}
    check("T1: id が null なら None", cloud_deploy.env_app_id(env_raw, "KN-01") is None)
    check("T1: ${VAR} が未解決なら None（正規の未解決状態）", cloud_deploy.env_app_id(env_raw, "KN-02") is None)
    check("T1: 直値はそのまま返る", cloud_deploy.env_app_id(env_raw, "KN-03") == "existing-uuid-0000")

    os.environ["CLOUD_DEPLOY_TEST_UNDEFINED_VAR"] = "resolved-id-1234"
    try:
        check("T1: ${VAR} が解決されれば値が返る", cloud_deploy.env_app_id(env_raw, "KN-02") == "resolved-id-1234")
    finally:
        os.environ.pop("CLOUD_DEPLOY_TEST_UNDEFINED_VAR", None)

    check("T1: 定義の無い番号は None", cloud_deploy.env_app_id(env_raw, "ZZ-99") is None)


def test_t2_resolve_app_id_cli_and_env_priority():
    """優先順: --app-id（cli）> env.yml の apps.<番号>.id > 名前一致 > 新規作成。"""
    env_raw = {"apps": {"KN-01": {"id": "env-sourced-id"}}}
    app_id, source = cloud_deploy.resolve_app_id(
        None, "KN-01", "any-name", {"KN-01": "cli-sourced-id"}, env_raw, True, {"apps": None},
    )
    check("T2: --app-id が env より優先される", (app_id, source) == ("cli-sourced-id", "cli"), (app_id, source))

    app_id, source = cloud_deploy.resolve_app_id(
        None, "KN-01", "any-name", {}, env_raw, True, {"apps": None},
    )
    check("T2: cli 無指定なら env の id が使われる", (app_id, source) == ("env-sourced-id", "env"), (app_id, source))

    # env・cli とも無い場合、dry_run=True なら名前一致（ネットワーク）を試行せず新規作成扱い
    app_id, source = cloud_deploy.resolve_app_id(
        None, "KN-02", "any-name", {}, {"apps": {}}, True, {"apps": None}, dry_run=True,
    )
    check("T2: dry-run では名前一致を試行せず new 扱い", (app_id, source) == (None, "new"), (app_id, source))


def test_t3_write_env_null_only():
    """--write-env は `id: null` の行だけを書き換え、${VAR}・既存値の行は書き換えず例外を投げる。"""
    sample = (
        "apps:\n"
        "  KN-01: { id: null }        # comment\n"
        "  KN-02: { id: '${DIFY_APP_ID_KN02}' }\n"
        "  DC-01: { id: existing-uuid-1234 }\n"
    )
    tmp = tempfile.mktemp(suffix=".yml", prefix="cloud_deploy_write_env_test_")
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(sample)
    try:
        n = cloud_deploy.apply_write_env(tmp, {"KN-01": "new-app-id-0000"})
        content = open(tmp, encoding="utf-8").read()
        check("T3: null 行が 1 行書き換わる", n == 1, n)
        check("T3: 書き換え後に新 id が入っている", "KN-01: { id: new-app-id-0000 }" in content, content)
        check("T3: コメントが保持される", "# comment" in content, content)

        raised = False
        try:
            cloud_deploy.apply_write_env(tmp, {"KN-02": "should-not-write"})
        except cloud_deploy.CloudDeployError:
            raised = True
        check("T3: ${VAR} の行は書き換えず例外を投げる", raised)
        check("T3: ${VAR} の行が実際に無変更", "${DIFY_APP_ID_KN02}" in open(tmp, encoding="utf-8").read())

        raised = False
        try:
            cloud_deploy.apply_write_env(tmp, {"DC-01": "should-not-write"})
        except cloud_deploy.CloudDeployError:
            raised = True
        check("T3: 既存 UUID の行は書き換えず例外を投げる", raised)
        check("T3: 既存 UUID の行が実際に無変更", "existing-uuid-1234" in open(tmp, encoding="utf-8").read())
    finally:
        os.unlink(tmp)


# ---------------------------------------------------------------------------
# mock サーバー相手のテスト
# ---------------------------------------------------------------------------

def test_t4_ambiguous_name(base):
    """名前一致が 2 件以上ヒットしたら AmbiguousNameError（--app-id か env.yml の id で解決するよう促す）。"""
    client = console_api.ConsoleClient(base, timeout=10)
    client.set_token("test-console-token")
    name = "CLOUD-DEPLOY-TEST-AMBIGUOUS-NAME"
    client.import_dsl(SAMPLE_YAML.format(name=name), app_id="ambiguous-a")
    client.import_dsl(SAMPLE_YAML.format(name=name), app_id="ambiguous-b")

    raised = None
    try:
        cloud_deploy.resolve_app_id(client, "ZZ-99", name, {}, {"apps": {}}, True, {"apps": None})
    except cloud_deploy.AmbiguousNameError as e:
        raised = e
    check("T4: 同名 2 件で AmbiguousNameError", raised is not None, raised)
    if raised:
        check("T4: エラーメッセージに --app-id での解決手順がある", "--app-id" in str(raised), str(raised))


def test_t5_pending_confirm_roundtrip(base):
    """cloud_deploy が使う import_dsl(return_details=True) で pending → confirm の自動往復が起きること
    （console_api の既存機構。202/pending 系のインポートが completed に解決される）。"""
    client = console_api.ConsoleClient(base, timeout=10)
    client.set_token("test-console-token")
    name = "CLOUD-DEPLOY-TEST-PENDING"
    yaml_text = SAMPLE_YAML.format(name=name).replace("test", "test # MOCK_FORCE_PENDING")
    app_id, status, import_id = client.import_dsl(yaml_text, return_details=True)
    check("T5: pending が自動で confirm され completed になる", status == "completed", status)
    check("T5: app_id が取得できる", bool(app_id), app_id)
    check("T5: import_id も取得できる", bool(import_id), import_id)


def test_t6_new_creation_and_idempotent(base):
    """① 新規作成で app_id を得る／② 同じ番号を 2 回流してもアプリが増えない（名前一致による上書き）。
    DC-02 は他のテストで使っていない管理番号（cloud-master の apps.DC-02.id は null）で、
    KB 安全弁（5.5 節。Issue #121 W4-4）の対象外＝knowledge-retrieval ノードを持たない
    （KN-01/KN-02/KN-03/GN-01 は対象なので、KB と無関係なこのテストでは使わない）。"""
    token = "idempotent-test-token"
    before = list_apps_via_http(base, token)

    r1 = run_cli(["--env", "cloud-master", "DC-02"], {"DIFY_CONSOLE_TOKEN": token, "DIFY_CONSOLE_URL": base})
    check("T6: 1 回目が exit 0", r1.returncode == 0, r1.stdout + r1.stderr)
    check("T6: 1 回目は新規作成", "新規作成" in r1.stdout, r1.stdout)
    after1 = list_apps_via_http(base, token)
    check("T6: 1 回目でアプリが 1 件増える", len(after1) == len(before) + 1, (len(before), len(after1)))

    r2 = run_cli(["--env", "cloud-master", "DC-02"], {"DIFY_CONSOLE_TOKEN": token, "DIFY_CONSOLE_URL": base})
    check("T6: 2 回目が exit 0", r2.returncode == 0, r2.stdout + r2.stderr)
    check("T6: 2 回目は上書き（名前一致）", "上書き" in r2.stdout, r2.stdout)
    after2 = list_apps_via_http(base, token)
    check("T6: 2 回目を流してもアプリ件数が増えない（冪等）", len(after2) == len(after1), (len(after1), len(after2)))


def test_t7_app_id_override(base):
    """--app-id 明示で app_id 付きの上書きインポートになる（DC-01。数値・存在有無に関わらず必ず上書き扱い）。"""
    token = "override-test-token"
    r = run_cli(
        ["--env", "cloud-master", "DC-01", "--app-id", "DC-01=cd-test-override-1", "--no-adopt-by-name"],
        {"DIFY_CONSOLE_TOKEN": token, "DIFY_CONSOLE_URL": base},
    )
    check("T7: exit 0", r.returncode == 0, r.stdout + r.stderr)
    check("T7: --app-id 指定は上書き扱い", "上書き" in r.stdout, r.stdout)
    apps = list_apps_via_http(base, token)
    check("T7: 指定した app_id でアプリが作られている", any(a.get("id") == "cd-test-override-1" for a in apps), apps)


def test_t8_bind_kb_dsl_bakes_dataset_ids(base):
    """--bind-kb dsl（既定）: DIFY_DATASET_ID_KN02 を設定して render すると、
    送信される DSL（dify/build/cloud-master/KN-02-*.yml）に dataset_ids が焼き込まれること。"""
    token = "bindkb-test-token"
    env_extra = {
        "DIFY_CONSOLE_TOKEN": token, "DIFY_CONSOLE_URL": base,
        "DIFY_DATASET_ID_KN02": "ds-cloud-deploy-test-9999",
    }
    r = run_cli(
        ["--env", "cloud-master", "KN-02", "--app-id", "KN-02=cd-test-bindkb", "--no-adopt-by-name"],
        env_extra,
    )
    check("T8: exit 0", r.returncode == 0, r.stdout + r.stderr)
    matches = glob.glob(os.path.join(BUILD_DIR, "KN-02-*.yml"))
    check("T8: render 出力ファイルがある", bool(matches), matches)
    if matches:
        content = open(matches[0], encoding="utf-8").read()
        check("T8: dataset_ids に指定した id が焼き込まれている",
              "ds-cloud-deploy-test-9999" in content, content[:2000])


def test_t9_dry_run_no_network():
    """--dry-run はネットワークを一切呼ばない（誰も listen していないポートを指しても exit 0 で終わること）。"""
    dead_port = free_port()  # bind して即 close 済みなので、この時点で listen していない
    dead_base = f"http://127.0.0.1:{dead_port}"
    r = run_cli(
        ["--env", "cloud-master", "KN-01", "--dry-run"],
        {"DIFY_CONSOLE_TOKEN": "dry-run-test-token", "DIFY_CONSOLE_URL": dead_base},
    )
    check("T9: 誰も listen していないポートでも --dry-run は exit 0（ネットワークを呼んでいない証拠）",
          r.returncode == 0, f"exit={r.returncode} stdout={r.stdout} stderr={r.stderr}")
    check("T9: dry-run の出力に「ネットワークは呼んでいません」の表示がある",
          "ネットワークは呼んでいません" in r.stdout, r.stdout)


def test_t10_auth_error_exit3(base):
    """期限切れトークンで exit 3、かつ再取得手順が出て、トークン文字列が出力に現れないこと。
    LG-01 は knowledge-retrieval ノードを持たない番号（KB 安全弁の対象外。5.5 節）を使う。
    KN-01 だと KB 安全弁が client_from_env より先に判定して exit 2 になってしまい、
    このテストが確かめたい認証エラー（exit 3）の経路に到達できない。"""
    r = run_cli(["--env", "cloud-master", "LG-01"], {"DIFY_CONSOLE_TOKEN": mock_server.EXPIRED_TOKEN, "DIFY_CONSOLE_URL": base})
    combined = r.stdout + r.stderr
    check("T10: 期限切れトークンで exit 3", r.returncode == 3, f"exit={r.returncode} {combined}")
    # TOKEN_HELP は Issue #121 W4-3（G5）で DIFY_CONSOLE_REFRESH 前提の文言に書き直された
    # （旧 console_token の localStorage 手順は 1.17.0 に存在しないため廃止）。
    check("T10: 取り直し手順（ブラウザ）が出る", "ブラウザ" in combined and "DIFY_CONSOLE_REFRESH" in combined, combined)
    check("T10: 出力にトークン文字列が現れない", mock_server.EXPIRED_TOKEN not in combined, combined)


def test_t11_no_token_unset_exit2():
    """DIFY_CONSOLE_TOKEN も email/password も未設定なら exit 2（preflight。ネットワークを呼ぶ前に止まる）。"""
    r = run_cli(
        ["--env", "cloud-master", "KN-01"],
        {"DIFY_CONSOLE_TOKEN": "", "DIFY_CONSOLE_EMAIL": "", "DIFY_CONSOLE_PASSWORD": ""},
    )
    check("T11: 未設定は exit 2", r.returncode == 2, f"exit={r.returncode} {r.stdout} {r.stderr}")


def test_t12_no_token_leak_anywhere(base, tmpdir):
    """成功する 1 回の実行を通して、stdout/stderr/生成ファイルにトークンの値が一度も現れないこと。
    LG-04 は knowledge-retrieval ノードを持たない番号（KB 安全弁の対象外。5.5 節）を使う
    （GN-01 だと DIFY_DATASET_ID_GN01 未設定のため KB 安全弁が exit 2 で止め、
    この「成功する 1 回の実行」という前提が満たせない）。"""
    token = "yet-another-secret-cloud-deploy-token"
    r = run_cli(
        ["--env", "cloud-master", "LG-04", "--app-id", "LG-04=cd-test-leak-check", "--no-adopt-by-name"],
        {"DIFY_CONSOLE_TOKEN": token, "DIFY_CONSOLE_URL": base},
    )
    combined = r.stdout + r.stderr
    log_path = os.path.join(tmpdir, "combined.log")
    with open(log_path, "w", encoding="utf-8") as fh:
        fh.write(combined)
    check("T12: 実行が成功する（前提）", r.returncode == 0, combined)
    check("T12: 標準出力・標準エラーにトークンが現れない", token not in combined, combined)
    matches = glob.glob(os.path.join(BUILD_DIR, "LG-04-*.yml")) + glob.glob(os.path.join(ROOT, "dify", "build", "cloud-master", "render-report.md"))
    leaked_files = [p for p in matches if token in open(p, encoding="utf-8").read()]
    check("T12: 生成ファイル（render 出力・レポート）にトークンが現れない", not leaked_files, leaked_files)
    with open(log_path, encoding="utf-8") as fh:
        check("T12: 保存したログファイルにもトークンが現れない", token not in fh.read())


def test_p1_no_publish_on_partial_import_failure(base):
    """P1（設計書 §9-2・§11「W4-4」。Issue #121）: 2 番号のうち 1 本のインポートが失敗したら、
    もう 1 本が正常にインポートできていても公開を 1 件も行わない。mock_server の /__test__/stats
    で publish の呼び出し回数（グローバル累計）を前後で比較し、差分が 0 であることを機械確認する。
    DC-04・GN-02 は knowledge-retrieval ノードを持たない番号（KB 安全弁の対象外。5.5 節）を使う
    （KN-02・GN-01 だと DIFY_DATASET_ID_* 未設定のため KB 安全弁が Phase 1 に入る前に exit 2 で
    止めてしまい、このテストが確かめたい P1 の分岐〔インポートまでは進む〕に到達できない）。"""
    before = get_stats(base)
    token = "p1-test-token"
    ok_app_id = "p1-test-ok-app"
    r = run_cli(
        [
            "--env", "cloud-master", "DC-04", "GN-02",
            "--app-id", f"DC-04={ok_app_id}",
            "--app-id", f"GN-02={mock_server.MOCK_FORCE_IMPORT_FAIL}",
            "--no-adopt-by-name",
        ],
        {"DIFY_CONSOLE_TOKEN": token, "DIFY_CONSOLE_URL": base},
    )
    combined = r.stdout + r.stderr
    check("P1: 1 本失敗すると exit 1", r.returncode == 1, combined)
    check("P1: DC-04（成功した番号）のインポートは完了する", "[DC-04] インポート完了" in combined, combined)
    check("P1: GN-02（失敗させた番号）は [FAIL] と記録される", "[GN-02] [FAIL]" in combined, combined)
    check("P1: 「公開は 1 件も行いません」のログが出る", "公開は 1 件も行いません" in combined, combined)
    check("P1: 成功した番号の公開完了ログが出ない（公開していない証拠）",
          f"公開完了: app_id={ok_app_id}" not in combined, combined)

    after = get_stats(base)
    check("P1: publish が 1 回も呼ばれていない（mock_server の呼び出し回数を機械確認）",
          after.get("publish", 0) == before.get("publish", 0), (before, after))


def test_p1_all_succeed_publishes_all(base):
    """P1 の裏側: 全件インポートが成功すれば、まとめて公開されること
    （publish の呼び出し回数が対象の番号数ぶん増える）。DC-04・GN-02 の選定理由は上記と同じ
    （KB 安全弁の対象外）。"""
    before = get_stats(base)
    token = "p1-success-test-token"
    r = run_cli(
        [
            "--env", "cloud-master", "DC-04", "GN-02",
            "--app-id", "DC-04=p1-success-dc04",
            "--app-id", "GN-02=p1-success-gn02",
            "--no-adopt-by-name",
        ],
        {"DIFY_CONSOLE_TOKEN": token, "DIFY_CONSOLE_URL": base},
    )
    combined = r.stdout + r.stderr
    check("P1（成功系）: exit 0", r.returncode == 0, combined)
    check("P1（成功系）: 全件インポート成功のログが出る", "全件インポート成功" in combined, combined)
    check("P1（成功系）: DC-04 が公開される", "公開完了: app_id=p1-success-dc04" in combined, combined)
    check("P1（成功系）: GN-02 が公開される", "公開完了: app_id=p1-success-gn02" in combined, combined)

    after = get_stats(base)
    check("P1（成功系）: publish が対象の番号数ぶん（2 回）増える",
          after.get("publish", 0) - before.get("publish", 0) == 2, (before, after))


def test_b3_logout_called_for_refresh_auth(base):
    """B3（設計書 §8-7・§9-3。Issue #121 W4-4）: DIFY_CONSOLE_REFRESH で認証した実行は、
    ジョブ末尾で必ず logout を試みる（成功ログが出る）。値はどこにも現れない。
    NM-03 は knowledge-retrieval ノードを持たない番号（KB 安全弁の対象外。5.5 節）を使う。"""
    seed = "b3-cloud-deploy-seed-refresh-token"
    r = run_cli(
        ["--env", "cloud-master", "NM-03", "--app-id", "NM-03=b3-refresh-app", "--no-adopt-by-name"],
        {"DIFY_CONSOLE_REFRESH": seed, "DIFY_CONSOLE_TOKEN": "", "DIFY_CONSOLE_URL": base},
    )
    combined = r.stdout + r.stderr
    check("B3: exit 0", r.returncode == 0, combined)
    check("B3: logout 完了のログが出る", "logout 完了" in combined, combined)
    check("B3: seed のリフレッシュトークン値が出力に現れない", seed not in combined, combined)


def test_b3_logout_not_called_for_legacy_token(base):
    """B3 の対象外: 非推奨の DIFY_CONSOLE_TOKEN（レガシー）経路では logout を呼ばない
    （設計書 §8-7 B3 は Cookie 案＝リフレッシュトークンのセッションに限った歯止めのため）。
    GN-05 は knowledge-retrieval ノードを持たない番号（KB 安全弁の対象外。5.5 節）を使う。"""
    r = run_cli(
        ["--env", "cloud-master", "GN-05", "--app-id", "GN-05=b3-legacy-app", "--no-adopt-by-name"],
        {"DIFY_CONSOLE_TOKEN": "b3-legacy-token", "DIFY_CONSOLE_URL": base},
    )
    combined = r.stdout + r.stderr
    check("B3（レガシー）: exit 0", r.returncode == 0, combined)
    check("B3（レガシー）: logout 関連のログが出ない", "logout" not in combined, combined)


def test_t6_sink_enabled_skips_logout_and_value_stays_alive(base, tmpdir):
    """t6（設計書 §9-1・§4-4。Issue #212 PR-2）: DIFY_REFRESH_SINK が設定されている（書き戻し運用が
    有効）とき、safe_logout() は logout を呼ばない。かつ sink に書かれた rotate 後の値が
    （logout で殺されていないので）そのままモックへの refresh に使える＝生きている。

    §4-4 が「両立しない」とした矛盾のうち、書き戻し運用側（sink 有効）が正しく解決できていることの
    証明。cloud_deploy.safe_logout() を直接呼ぶ白箱テスト（test_kb_guard_unit_* と同じ作法）。"""
    sink_path = os.path.join(tmpdir, "dify-refresh-t6.new")
    os.environ["DIFY_REFRESH_SINK"] = sink_path
    try:
        client = console_api.ConsoleClient(base, timeout=10)
        client.refresh("t6-seed-refresh-token")  # rotate → sink に書かれる（DIFY_REFRESH_SINK 設定済み）
        check("T6(B3'): refresh 後に auth_mode が refresh になる", client._auth_mode == "refresh", client._auth_mode)
        check("T6(B3'): sink ファイルが作られている", os.path.isfile(sink_path))
        sink_value = open(sink_path, encoding="ascii").read()

        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            cloud_deploy.safe_logout(client)
        out = buf.getvalue()
        check("T6(B3'): logout をスキップするログが出る", "[logout] スキップ" in out, out)
        check("T6(B3'): logout 完了のログは出ない（実際に呼んでいない証拠）", "logout 完了" not in out, out)

        fresh_client = console_api.ConsoleClient(base, timeout=10)
        ok = fresh_client.refresh(sink_value)
        check("T6(B3'): sink に書かれた値でモックに refresh が通る（生きている＝矛盾が解けている証拠）",
              ok is True)
    finally:
        os.environ.pop("DIFY_REFRESH_SINK", None)


def test_t7_no_sink_logout_still_called_and_kills_rotated_value(base):
    """t7（設計書 §9-1。Issue #212 PR-2）: DIFY_REFRESH_SINK が未設定のときは従来どおり
    safe_logout() が logout を呼ぶ（B3 の既存挙動を維持）。かつ、その後は rotate 後の値で
    再認証しようとすると 401 になる（B3 の「実行後は無価値」という性質が残っていることの証明。
    設計書 §4-4 が「logout は対になるリフレッシュトークンも殺す」と述べている挙動そのもの）。"""
    os.environ.pop("DIFY_REFRESH_SINK", None)  # 未設定であることを明示する
    client = console_api.ConsoleClient(base, timeout=10)
    client.refresh("t7-seed-refresh-token")
    check("T7(B3'): refresh 後に auth_mode が refresh になる", client._auth_mode == "refresh", client._auth_mode)
    rotated_value = client._refresh_token
    check("T7(B3'): sink 未設定なので書き込みが起きない", client._sink_write_count == 0, client._sink_write_count)

    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        cloud_deploy.safe_logout(client)
    out = buf.getvalue()
    check("T7(B3'): logout 完了のログが出る（従来どおり呼ばれる）", "logout 完了" in out, out)
    check("T7(B3'): logout スキップのログは出ない", "[logout] スキップ" not in out, out)

    fresh_client = console_api.ConsoleClient(base, timeout=10)
    raised = False
    try:
        fresh_client.refresh(rotated_value)
    except console_api.ConsoleSessionExpiredError:
        raised = True
    check("T7(B3'): logout 後は rotate 済みの値で再認証すると 401（ConsoleSessionExpiredError）になる"
          "（B3『実行後は無価値』の性質が残っている証拠）", raised)


def test_kb_guard_unit_detects_empty_dataset_ids():
    """find_empty_kb_bindings() の単体検証（ネットワーク不要）: dataset_ids が空の
    knowledge-retrieval ノードだけを拾い、値が入っているものは拾わないこと。"""
    tmp_dir = tempfile.mkdtemp(prefix="cloud_deploy_kbguard_test_")
    try:
        with open(os.path.join(tmp_dir, "ZZ-01-empty.yml"), "w", encoding="utf-8") as fh:
            fh.write(
                "workflow:\n  graph:\n    nodes:\n"
                "      - id: n1\n        data: { type: knowledge-retrieval, title: '知識検索', dataset_ids: [] }\n"
            )
        with open(os.path.join(tmp_dir, "ZZ-02-baked.yml"), "w", encoding="utf-8") as fh:
            fh.write(
                "workflow:\n  graph:\n    nodes:\n"
                "      - id: n1\n        data: { type: knowledge-retrieval, title: '知識検索', dataset_ids: ['ds-abc'] }\n"
            )
        with open(os.path.join(tmp_dir, "ZZ-03-none.yml"), "w", encoding="utf-8") as fh:
            fh.write("workflow:\n  graph:\n    nodes:\n      - id: n1\n        data: { type: llm, title: LLM }\n")

        hits = cloud_deploy.find_empty_kb_bindings(tmp_dir, ["ZZ-01", "ZZ-02", "ZZ-03"])
        codes_hit = [c for c, _ in hits]
        check("KB安全弁(unit): dataset_ids が空のノードを持つ番号だけを拾う", codes_hit == ["ZZ-01"], hits)
        check("KB安全弁(unit): ノード名（タイトル）を含む", hits and "知識検索" in hits[0][1], hits)
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


def test_kb_guard_blocks_before_phase1(base):
    """KB 安全弁（Issue #121 W4-4 の暫定歯止め → Issue #209 PR-2 で恒久対応に統合）: KN-02 は
    knowledge-retrieval ノードを持つが、DIFY_DATASET_ID_KN02 も DIFY_DATASET_KEY も
    設定していない。この状態で deploy しようとすると、**render すら呼ばれる前（0.5 段。
    dataset_ids.resolve()）**に exit 2 で止まり、mock_server の publish カウンタ・
    アプリ一覧のどちらも動かない（import すら 1 回も呼んでいない証拠）ことを機械確認する。

    恒久対応前は「render 後に dataset_ids が空だったら止める」（G-KB2）だけがこの状況を
    捕まえていたが、恒久対応後はそれより早い 0.5 段で同じ状況を検出して止める
    （render にすら進まない）。G-KB2 は最後の砦として引き続き存在する
    （test_kb_guard_unit_detects_empty_dataset_ids・test_t12_gkb2_blocks_when_dataset_ids_still_empty
    を参照）。"""
    token = "kb-guard-test-token"
    before_stats = get_stats(base)
    before_apps = list_apps_via_http(base, token)

    r = run_cli(
        ["--env", "cloud-master", "KN-02", "--app-id", "KN-02=kb-guard-should-not-be-used", "--no-adopt-by-name"],
        {"DIFY_CONSOLE_TOKEN": token, "DIFY_CONSOLE_URL": base},
    )
    combined = r.stdout + r.stderr
    check("KB安全弁: exit 2", r.returncode == 2, combined)
    check("KB安全弁: 「なぜ」の説明が出る（DIFY_DATASET_KEY が未設定）",
          "DIFY_DATASET_KEY が未設定です" in combined, combined)
    check("KB安全弁: 対象番号 KN-02 が出る", "KN-02" in combined, combined)
    check("KB安全弁: 解決すべき KB 名が出る", "設備マニュアル" in combined, combined)

    force_opts = [opt for a in cloud_deploy.build_arg_parser()._actions for opt in a.option_strings if "force" in opt]
    check("KB安全弁: --force 相当の回避フラグをそもそも実装していない（PM 指示）", not force_opts, force_opts)
    check("KB安全弁: 指定した app_id（kb-guard-should-not-be-used）が使われていない",
          "kb-guard-should-not-be-used" not in combined, combined)

    after_stats = get_stats(base)
    after_apps = list_apps_via_http(base, token)
    check("KB安全弁: publish が 1 回も呼ばれていない（機械確認）",
          after_stats.get("publish", 0) == before_stats.get("publish", 0), (before_stats, after_stats))
    check("KB安全弁: アプリが増えていない（import すら呼んでいない証拠）",
          len(after_apps) == len(before_apps), (len(before_apps), len(after_apps)))


def test_kb_guard_allows_when_dataset_ids_baked(base):
    """KB 安全弁の裏側: DIFY_DATASET_ID_GN01 を設定して dataset_ids が焼き込まれていれば、
    KB 安全弁は反応せず通常どおり進む（誤検出しないことの確認。T8 とは別番号で確認する）。"""
    token = "kb-guard-baked-test-token"
    env_extra = {
        "DIFY_CONSOLE_TOKEN": token, "DIFY_CONSOLE_URL": base,
        "DIFY_DATASET_ID_GN01": "ds-kb-guard-baked-test",
    }
    r = run_cli(
        ["--env", "cloud-master", "GN-01", "--app-id", "GN-01=kb-guard-baked-app", "--no-adopt-by-name"],
        env_extra,
    )
    combined = r.stdout + r.stderr
    check("KB安全弁(裏側): dataset_ids が焼き込まれていれば exit 0", r.returncode == 0, combined)
    check("KB安全弁(裏側): KB 安全弁のブロックメッセージが出ない", "[STOP] KB を要求している" not in combined, combined)


# ---------------------------------------------------------------------------
# Issue #209 PR-2: 0.5 段（dataset id の解決）・1.5 段（G-KB2 一本化）の配線
# ---------------------------------------------------------------------------

def test_209_t10_extra_env_isolated_from_parent_environ():
    """T10（設計書 §11-3。Issue #209 PR-2）: run_render(..., extra_env=...) で渡した値は
    render サブプロセス専用の env にだけ入り、親プロセス（このテスト自身）の os.environ には
    決して入らない（C2）。render サブプロセスには実際に渡っていることも、焼き込み結果
    （GN-01 の dataset_ids）から確認する。ネットワーク不要（run_render() を直接呼ぶ）。"""
    marker_var = "DIFY_DATASET_ID_GN01"
    marker_val = "extra-env-isolation-test-0000"
    os.environ.pop(marker_var, None)
    try:
        out_dir = cloud_deploy.run_render("cloud-master", ["GN-01"], False, extra_env={marker_var: marker_val})
        check(
            "T10（#209）: run_render() 呼び出し後も親プロセスの os.environ に extra_env の変数が入らない",
            marker_var not in os.environ,
        )
        matches = glob.glob(os.path.join(out_dir, "GN-01-*.yml"))
        check("T10（#209・前提）: render 出力ファイルがある", bool(matches), matches)
        if matches:
            content = open(matches[0], encoding="utf-8").read()
            check(
                "T10（#209）: render サブプロセスには extra_env の値が実際に渡り、"
                "dataset_ids に焼き込まれている",
                marker_val in content, content[:2000],
            )
    finally:
        os.environ.pop(marker_var, None)
        cleanup_build()


def test_209_t11_resolve_failure_no_console_calls(base):
    """T11（設計書 §11-3）: 0.5 段の解決に失敗する（今回は名前 0 件＝Dify 側にまだ無い KB）と
    exit 2 になり、Console API に 1 リクエストも飛ばない（import も publish も 0 回）。
    KN-03 のダミー KB 名は他のテストで一度も作成していない前提（衝突しない）。"""
    token = "t11-resolve-fail-token"
    before_apps = list_apps_via_http(base, token)
    before_stats = get_stats(base)
    r = run_cli(
        ["--env", "cloud-master", "KN-03", "--app-id", "KN-03=t11-should-not-be-used", "--no-adopt-by-name"],
        {
            "DIFY_CONSOLE_TOKEN": token, "DIFY_CONSOLE_URL": base,
            "DIFY_DATASET_KEY": "t11-dataset-key", "DIFY_BASE_URL": base.rstrip("/") + "/v1",
        },
    )
    combined = r.stdout + r.stderr
    check("T11（#209）: exit 2", r.returncode == 2, combined)
    check("T11（#209）: KB が見つからない旨のメッセージが出る（0.5 段での失敗）",
          "見つかりません" in combined, combined)
    after_apps = list_apps_via_http(base, token)
    after_stats = get_stats(base)
    check("T11（#209）: アプリが増えていない（import すら呼んでいない証拠）",
          len(after_apps) == len(before_apps), (len(before_apps), len(after_apps)))
    check("T11（#209）: publish が 1 回も呼ばれていない",
          after_stats.get("publish", 0) == before_stats.get("publish", 0), (before_stats, after_stats))
    check("T11（#209）: 指定した app_id（t11-should-not-be-used）が使われていない",
          "t11-should-not-be-used" not in combined, combined)


def test_209_t12_gkb2_blocks_when_dataset_ids_still_empty(base):
    """T12（設計書 §11-3）: --no-resolve-datasets で 0.5 段の API 呼び出しを丸ごと飛ばし、
    かつ環境変数も未設定のまま render すると dataset_ids は空で焼き込まれる。この状態は
    1.5 段の G-KB2（dataset_ids.assert_bound()）が捕まえて exit 2 にする
    （#208 の暫定歯止めがこの位置に一本化されている証拠。import すら 0 回）。"""
    token = "t12-gkb2-token"
    before_apps = list_apps_via_http(base, token)
    r = run_cli(
        [
            "--env", "cloud-master", "GN-01", "--no-resolve-datasets",
            "--app-id", "GN-01=t12-should-not-be-used", "--no-adopt-by-name",
        ],
        {"DIFY_CONSOLE_TOKEN": token, "DIFY_CONSOLE_URL": base},
    )
    combined = r.stdout + r.stderr
    check("T12（#209）: exit 2", r.returncode == 2, combined)
    check("T12（#209）: G-KB2 のメッセージが出る（dataset_ids が空のまま）",
          "dataset_ids が空のままの" in combined, combined)
    check("T12（#209）: 対象番号 GN-01 が出る", "GN-01" in combined, combined)
    after_apps = list_apps_via_http(base, token)
    check("T12（#209）: アプリが増えていない（import すら呼んでいない証拠）",
          len(after_apps) == len(before_apps), (len(before_apps), len(after_apps)))


def test_209_t13_dry_run_no_dataset_api_call():
    """T13（設計書 §11-3。既存 A5 の維持）: --dry-run は Datasets API にも Console API にも
    1 リクエストも送らない。誰も listen していないポートを DIFY_CONSOLE_URL・DIFY_BASE_URL の
    両方に指定しても exit 0 で終わることで証明する（KN-01 は KB 付きの番号）。"""
    dead_port = free_port()
    dead_base = f"http://127.0.0.1:{dead_port}"
    r = run_cli(
        ["--env", "cloud-master", "KN-01", "--dry-run"],
        {"DIFY_CONSOLE_TOKEN": "t13-token", "DIFY_CONSOLE_URL": dead_base, "DIFY_BASE_URL": dead_base},
    )
    combined = r.stdout + r.stderr
    check("T13（#209）: 誰も listen していないポートでも --dry-run は exit 0", r.returncode == 0, combined)
    check("T13（#209）: 出力に「ネットワークは呼んでいません」の表示がある",
          "ネットワークは呼んでいません" in combined, combined)


def test_209_t14_non_kb_apps_work_without_dataset_key(base):
    """T14（設計書 §11-3）: KB を持たない番号だけを対象にしたとき、DIFY_DATASET_KEY が
    未設定でも正常に動く（0.5 段が KB を持たない番号にまで過剰反応しない）。"""
    token = "t14-non-kb-token"
    r = run_cli(
        ["--env", "cloud-master", "NM-03", "--app-id", "NM-03=t14-non-kb-app", "--no-adopt-by-name"],
        {"DIFY_CONSOLE_TOKEN": token, "DIFY_CONSOLE_URL": base},
    )
    combined = r.stdout + r.stderr
    check("T14（#209）: exit 0", r.returncode == 0, combined)
    check("T14（#209）: dataset 解決の対象と表示されない（KB を持たない番号のため 0.5 段は何もしない）",
          "[dataset] KB 付きの対象" not in combined, combined)


def main():
    check("前提: cloud_deploy.py が存在する", os.path.isfile(CLOUD_DEPLOY))
    check("前提: mock_server.py が存在する", os.path.isfile(MOCK_SERVER))

    cleanup_build()

    test_t1_env_app_id_priority()
    test_t2_resolve_app_id_cli_and_env_priority()
    test_t3_write_env_null_only()
    test_kb_guard_unit_detects_empty_dataset_ids()

    port = free_port()
    base = f"http://127.0.0.1:{port}"
    proc = subprocess.Popen(
        [sys.executable, MOCK_SERVER, "--port", str(port)],
        cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
    )
    try:
        ready = wait_ready(base)
        check("前提: mock サーバーが起動した", ready)

        test_t4_ambiguous_name(base)
        test_t5_pending_confirm_roundtrip(base)
        test_t6_new_creation_and_idempotent(base)
        test_t7_app_id_override(base)
        test_t8_bind_kb_dsl_bakes_dataset_ids(base)
        test_t9_dry_run_no_network()
        test_t10_auth_error_exit3(base)
        test_t11_no_token_unset_exit2()
        with tempfile.TemporaryDirectory(prefix="cloud_deploy_test_") as tmpdir:
            test_t12_no_token_leak_anywhere(base, tmpdir)
        test_p1_no_publish_on_partial_import_failure(base)
        test_p1_all_succeed_publishes_all(base)
        test_b3_logout_called_for_refresh_auth(base)
        test_b3_logout_not_called_for_legacy_token(base)
        with tempfile.TemporaryDirectory(prefix="cloud_deploy_sink_test_") as sink_tmpdir:
            test_t6_sink_enabled_skips_logout_and_value_stays_alive(base, sink_tmpdir)
        test_t7_no_sink_logout_still_called_and_kills_rotated_value(base)
        test_kb_guard_blocks_before_phase1(base)
        test_kb_guard_allows_when_dataset_ids_baked(base)
        test_209_t10_extra_env_isolated_from_parent_environ()
        test_209_t11_resolve_failure_no_console_calls(base)
        test_209_t12_gkb2_blocks_when_dataset_ids_still_empty(base)
        test_209_t13_dry_run_no_dataset_api_call()
        test_209_t14_non_kb_apps_work_without_dataset_key(base)
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
        cleanup_build()

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
