#!/usr/bin/env python3
"""render → import → KB 投入 → test → tag → CHANGELOG まで通しでやる。

    python3 scripts/dify/release.py --env cloud-master --all --dry-run
    python3 scripts/dify/release.py --env customer-a KN-01 DC-01
    python3 scripts/dify/release.py --env inhouse --all --no-tag

設計: docs/handoff/2026-09-07-repo-layout-v2.md §4-4・§5

手順（失敗したらどの段で止まったかを表示し、以降は実行しない）
  0. 前提チェック   dify/env/<env>/env.yml の存在。git のワーキングツリーが汚れていれば警告のみ
  1. render         scripts/dify/render.py --env <env> --strict → dify/build/<env>/
  2. ガード         G1 cross_border: deny なら models.* の provider が国内許可の目安に合うか（警告のみ。
                       DP-02 の越境マトリクスを env に持たせるまでは exit 1 にしない）
                    G2 pipl_mask: on なら PIPL マスクノード（PC-10）の存在を警告付きで確認
                    G3 partner_mode: mock なら http-request ノードの宛先が実 API でないか警告付きで確認
  3. import         edition: selfhost → console_api.py（login → apps/import → publish）
                    edition: cloud    → IMPORT.md を生成（証跡・手動フォールバック用）。
                       DIFY_CONSOLE_TOKEN が set かつ --no-console-import でなければ、続けて
                       scripts/dify/cloud_deploy.py の関数を import して自動インポート・公開まで進む
                       （成功すれば止まらず後続の KB・test へ進む。失敗すれば stage=3-import で停止）。
                       未設定／--no-console-import 指定のときは、従来どおり手動インポート待ちとして
                       **ここで止まる**（設計: docs/handoff/2026-09-08-cloud-console-deploy.md §5）
  4. KB             kb_upload.py --env <env> <code>（dify/kb/<code>/ があるものだけ）
  5. test           run_tests.py --env <env> <code...> → dify/results/<env>/<番号>-<YYYYMMDD-HHMM>.md
  6. 記録           全件合格のときだけ dify/CHANGELOG.md に 1 行追記
  7. tag            全件合格のときだけ git tag release/<env>/<YYYYMMDD>（同日 2 回目以降は -2, -3, ...）を
                    **ローカルに作る**（push は人）。`--no-tag` で抑止

`--dry-run`：1 (render) ・2 (ガード) ・3 (cloud なら IMPORT.md 生成) は実際に行うが、ネットワークは一切呼ばない
（selfhost の login/import/publish、cloud の Console API 自動インポートのどちらもしない。DIFY_CONSOLE_TOKEN が
set でも --dry-run では呼ばない）。4・5・6・7 は実行予定のコマンド・タグ名を表示するだけで、
何も書き込まない（`dify/results/**` にも `dify/CHANGELOG.md` にも書かない。tag も作らない）。

`--no-console-import`：cloud edition でも Console API を使わず、常に従来どおり IMPORT.md を書いて
手動インポート待ちで止まる（DIFY_CONSOLE_TOKEN の有無に関係なく）。

終了コード: 0 成功（cloud 経路で手動待ちのため途中で止まる場合も含む）/ 1 いずれかの段で失敗 / 2 引数・環境不備
"""
import argparse
import datetime as dt
import glob
import os
import re
import subprocess
import sys

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import console_api  # noqa: E402  (scripts/dify/console_api.py。上の sys.path.insert が必要)
import cloud_deploy  # noqa: E402  (scripts/dify/cloud_deploy.py。cloud 経路の自動インポートで関数を呼ぶだけ。§5)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
APPS_DIR = os.path.join(ROOT, "dify", "apps")
ENV_DIR = os.path.join(ROOT, "dify", "env")
BUILD_DIR = os.path.join(ROOT, "dify", "build")
RESULTS_DIR = os.path.join(ROOT, "dify", "results")
KB_DIR = os.path.join(ROOT, "dify", "kb")
CHANGELOG_PATH = os.path.join(ROOT, "dify", "CHANGELOG.md")
VAR_RE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")
GITHUB_RAW = "https://raw.githubusercontent.com/shoulang0729/dify/main"

# G1 の目安（DP-02 の越境マトリクスを env に持たせるまでの簡易ヒューリスティック。警告のみ）
FOREIGN_PROVIDER_HINTS = ("openai", "anthropic", "google", "azure")
DOMESTIC_PROVIDER_HINTS = ("siliconflow", "ollama", "qwen", "zhipu", "baidu", "tongyi")


class ReleaseError(RuntimeError):
    pass


def log(msg):
    print(msg, flush=True)


def expand(s):
    if not isinstance(s, str) or "${" not in s:
        return s
    return VAR_RE.sub(lambda m: os.environ.get(m.group(1), ""), s)


# ---------------------------------------------------------------------------
# 0. env・対象コードの解決
# ---------------------------------------------------------------------------

def load_env_raw(env_name):
    if yaml is None:
        raise ReleaseError("PyYAML がありません: pip3 install pyyaml")
    path = os.path.join(ENV_DIR, env_name, "env.yml")
    if not os.path.isfile(path):
        raise ReleaseError(f"env が見つかりません: {os.path.relpath(path, ROOT)}")
    with open(path, encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def resolve_codes(args):
    all_files = sorted(glob.glob(os.path.join(APPS_DIR, "*.yml")))
    if args.all:
        codes = []
        for f in all_files:
            base = os.path.basename(f)
            parts = base.split("-", 2)
            codes.append(parts[0] + "-" + parts[1] if len(parts) > 1 else base)
        return codes
    if not args.codes:
        raise ReleaseError("対象アプリを指定してください（--all か管理番号を 1 つ以上）")
    codes = []
    for c in args.codes:
        c = c.upper()
        if not any(os.path.basename(f).startswith(c + "-") for f in all_files):
            raise ReleaseError(f"アプリが見つかりません: {c}（dify/apps/{c}-*.yml）")
        codes.append(c)
    return codes


def preflight(env_name):
    path = os.path.join(ENV_DIR, env_name, "env.yml")
    if not os.path.isfile(path):
        raise ReleaseError(f"env が見つかりません: {os.path.relpath(path, ROOT)}")
    try:
        res = subprocess.run(["git", "status", "--porcelain"], cwd=ROOT, capture_output=True, text=True, timeout=20)
        dirty = [l for l in res.stdout.splitlines() if l.strip()]
        if dirty:
            log(f"WARN: git のワーキングツリーに未コミットの変更が {len(dirty)} 件あります（リリースの証跡が曖昧になります）")
    except Exception as e:  # pragma: no cover
        log(f"WARN: git status の確認に失敗しました: {e}")


# ---------------------------------------------------------------------------
# 1. render
# ---------------------------------------------------------------------------

def run_render(env_name, codes, all_flag):
    cmd = [sys.executable, os.path.join(ROOT, "scripts", "dify", "render.py"), "--env", env_name, "--strict"]
    cmd += ["--all"] if all_flag else codes
    log(f"[render] {' '.join(cmd[1:])}")
    res = subprocess.run(cmd, cwd=ROOT, env=os.environ.copy(), capture_output=True, text=True)
    sys.stdout.write(res.stdout)
    sys.stderr.write(res.stderr)
    if res.returncode != 0:
        raise ReleaseError(f"render.py が失敗しました（exit {res.returncode}）")
    return os.path.join(BUILD_DIR, env_name)


def build_file_for(out_dir, code):
    matches = sorted(glob.glob(os.path.join(out_dir, f"{code}-*.yml")))
    if not matches:
        raise ReleaseError(f"render の出力が見つかりません: dify/build/.../{code}-*.yml")
    return matches[0]


def app_name_of(build_path):
    with open(build_path, encoding="utf-8") as fh:
        in_app = False
        for line in fh:
            if line.startswith("app:"):
                in_app = True
                continue
            if in_app and not line.startswith(" "):
                break
            m = re.match(r"^  name:\s*(.+?)\s*$", line) if in_app else None
            if m:
                return m.group(1).strip().strip("'\"")
    return None


# ---------------------------------------------------------------------------
# 2. ガード（すべて警告のみ。v1 では release を止めない）
# ---------------------------------------------------------------------------

def guard_g1(env_raw, warnings):
    flags = env_raw.get("flags") or {}
    if flags.get("cross_border") != "deny":
        return
    models = env_raw.get("models") or {}
    for role, spec in models.items():
        if role in ("overrides",) or not isinstance(spec, dict):
            continue
        provider = str(spec.get("provider") or "").lower()
        if not provider:
            continue
        if any(h in provider for h in FOREIGN_PROVIDER_HINTS) and not any(h in provider for h in DOMESTIC_PROVIDER_HINTS):
            warnings.append(
                f"G1: flags.cross_border=deny なのに models.{role}.provider={spec.get('provider')!r} が海外系の可能性"
                "（DP-02 の越境マトリクスを env に持たせるまでは警告のみ。手動確認してください）"
            )


def guard_g2(env_raw, out_dir, codes, warnings):
    flags = env_raw.get("flags") or {}
    if flags.get("pipl_mask") != "on":
        return
    for code in codes:
        try:
            path = build_file_for(out_dir, code)
        except ReleaseError:
            continue
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        if "pipl" not in text.lower():
            warnings.append(f"G2: {code} に PIPL マスクノード（PC-10）が見当たりません（flags.pipl_mask: on）。手動確認してください")


def guard_g3(env_raw, out_dir, codes, warnings):
    flags = env_raw.get("flags") or {}
    if flags.get("partner_mode") != "mock":
        return
    for code in codes:
        try:
            path = build_file_for(out_dir, code)
        except ReleaseError:
            continue
        with open(path, encoding="utf-8") as fh:
            text = fh.read()
        if "type: http-request" not in text:
            continue
        urls = re.findall(r'url:\s*[\'"]?([^\s\'"\n]+)', text)
        for u in urls:
            if not any(h in u for h in ("mock", "localhost", "127.0.0.1", "example.")):
                warnings.append(f"G3: {code} の http-request が実 API らしき宛先を指しています（partner_mode: mock）: {u}")


def run_guards(env_raw, out_dir, codes):
    warnings = []
    guard_g1(env_raw, warnings)
    guard_g2(env_raw, out_dir, codes, warnings)
    guard_g3(env_raw, out_dir, codes, warnings)
    for w in warnings:
        log("WARN: " + w)
    if not warnings:
        log("[guard] 警告なし")
    return warnings


# ---------------------------------------------------------------------------
# 3. import
# ---------------------------------------------------------------------------

def write_import_md(env_name, edition, out_dir, codes):
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "IMPORT.md")
    lines = [f"# IMPORT — env={env_name} edition={edition}", ""]
    if env_name == "cloud-master":
        lines.append("`cloud-master` は render が恒等（マスタとバイト一致）。マスタの raw URL をそのまま貼れます。")
        lines.append("")
        lines.append("## (i) Studio →「アプリを作成」→「DSL ファイルをインポート」→ URL タブ")
        for code in codes:
            master = sorted(glob.glob(os.path.join(APPS_DIR, f"{code}-*.yml")))
            if master:
                base = os.path.basename(master[0])
                lines.append(f"- {GITHUB_RAW}/dify/apps/{base}")
    else:
        lines.append("この env はマスタと異なるため、Studio →「アプリを作成」→「DSL ファイルをインポート」→")
        lines.append("**ローカルファイル** タブで、次のファイルをファイル選択でアップロードしてください。")
        lines.append("")
        lines.append("## (i) アップロードするファイル")
        for code in codes:
            try:
                p = build_file_for(out_dir, code)
                lines.append(f"- `{os.path.relpath(p, ROOT)}`")
            except ReleaseError as e:
                lines.append(f"- （未生成: {e}）")
    lines += [
        "",
        "## (ii) インポート後にやること",
        "1. LLM ノードのモデルをこの env で使えるものに選び直す（`models.chat` を参考に）",
        "2. ナレッジベースを作成・投入して Knowledge Retrieval ノードに紐づける"
        "（`python3 scripts/dify/kb_upload.py --env " + env_name + " <管理番号>`）",
        "3. 右上「公開」",
        "4. 「API アクセス」で API キーを発行し、`DIFY_APP_KEY_<番号>` に設定する",
        "",
        "## (iii) 対象アプリ",
    ]
    lines += [f"- {c}" for c in codes]
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
    log(f"[import] cloud 経路: {os.path.relpath(path, ROOT)} を生成しました。手動インポート待ちです")
    return path


def do_import_selfhost(env_raw, out_dir, codes, dry_run):
    console_url = expand((env_raw.get("dify") or {}).get("console_url") or "")
    if dry_run:
        log(f"[import] (dry-run) selfhost 経路: login({console_url or '<DIFY_CONSOLE_URL 未設定>'}) の予定")
        for code in codes:
            log(f"[import] (dry-run) import_dsl({code}) → publish({code}) の予定")
        return {}
    client = console_api.login_from_env(console_url)
    app_ids = {}
    for code in codes:
        path = build_file_for(out_dir, code)
        with open(path, encoding="utf-8") as fh:
            yaml_text = fh.read()
        name = app_name_of(path) or code
        app_id = console_api.import_and_publish(client, code, name, yaml_text)
        app_ids[code] = app_id
    return app_ids


def do_import_cloud_console(env_raw, out_dir, codes):
    """cloud edition で DIFY_CONSOLE_TOKEN が使える（かつ --no-console-import でない）ときの自動インポート経路。
    scripts/dify/cloud_deploy.py の関数を **サブプロセスではなく import して**呼ぶ（設計 §5）。
    cloud_deploy.py 自体は変更しない（触らない範囲）。

    戻り値: (app_ids, failures)。failures が空でなければ呼び出し側は ReleaseError を投げて
    stage=3-import で停止する（従来どおり後続の KB・test には進まない）。
    """
    console_url = (
        os.environ.get("DIFY_CONSOLE_URL", "").strip()
        or expand((env_raw.get("dify") or {}).get("console_url") or "")
    )
    try:
        client = console_api.client_from_env(console_url, timeout=120)
    except console_api.ConsoleAuthError as e:
        log(str(e))
        log(console_api.TOKEN_HELP)
        raise ReleaseError("Console API 認証エラー（トークン期限切れの可能性）") from None
    except console_api.ConsoleAPIError as e:
        raise ReleaseError(f"Console API に到達できません: {e}") from None

    apps_cache = {"apps": None}
    results = []
    failures = []
    warnings = []
    adopt_by_name = True

    for code in codes:
        try:
            _, yaml_text, name = cloud_deploy.load_build(out_dir, code)
            app_id, source = cloud_deploy.resolve_app_id(
                client, code, name, {}, env_raw, adopt_by_name, apps_cache,
            )
            route_label = "新規作成" if source == "new" else "上書き"
            log(f"[import] [{code}] app_id={app_id or '(none)'}（{source}） → {route_label}インポート中…")
            result_app_id, status, _import_id = client.import_dsl(yaml_text, app_id=app_id, return_details=True)
            client.publish(result_app_id)
            results.append({"code": code, "route": route_label, "app_id": result_app_id, "new": source == "new"})
            log(f"[import] [{code}] 完了: app_id={result_app_id}（status={status}）→ 公開")
        except console_api.ConsoleAuthError as e:
            # 認証エラーは即座に停止する（Issue #114 §2-4 と同じ）
            log(str(e))
            log(console_api.TOKEN_HELP)
            raise ReleaseError("Console API 認証エラー（トークン期限切れの可能性）") from None
        except console_api.ConsoleAPIError as e:
            msg = str(e)
            if "接続失敗" in msg:
                raise ReleaseError(f"この環境から Cloud に到達できません: {msg}") from None
            log(f"[import] [{code}] [FAIL] {msg}")
            failures.append((code, msg))
        except cloud_deploy.CloudDeployError as e:
            log(f"[import] [{code}] [FAIL] {e}")
            failures.append((code, str(e)))

    for w in warnings:
        log("WARN: " + w)

    cloud_deploy.print_report(
        [{"code": r["code"], "route": r["route"], "app_id": r["app_id"], "published": True} for r in results],
        failures,
    )

    new_ids = {r["code"]: r["app_id"] for r in results if r["new"]}
    if new_ids:
        cloud_deploy.print_write_env_fragment(new_ids)

    app_ids = {r["code"]: r["app_id"] for r in results}
    return app_ids, failures


# ---------------------------------------------------------------------------
# 4. KB
# ---------------------------------------------------------------------------

def kb_codes(codes):
    return [c for c in codes if os.path.isdir(os.path.join(KB_DIR, c)) and
            any(os.path.splitext(f)[1].lower() in (".md", ".txt", ".pdf") for f in os.listdir(os.path.join(KB_DIR, c)))]


def run_kb_upload(env_name, codes, dry_run):
    targets = kb_codes(codes)
    if not targets:
        log("[kb] KB を持つアプリはありません")
        return True
    for code in targets:
        cmd = [sys.executable, os.path.join(ROOT, "scripts", "dify", "kb_upload.py"), "--env", env_name, code]
        if dry_run:
            log(f"[kb] (dry-run) 実行予定: {' '.join(cmd[1:])}")
            continue
        log(f"[kb] {' '.join(cmd[1:])}")
        res = subprocess.run(cmd, cwd=ROOT, env=os.environ.copy(), capture_output=True, text=True)
        sys.stdout.write(res.stdout)
        sys.stderr.write(res.stderr)
        if res.returncode != 0:
            raise ReleaseError(f"kb_upload.py {code} が失敗しました（exit {res.returncode}）")
    return True


# ---------------------------------------------------------------------------
# 5. test
# ---------------------------------------------------------------------------

def run_tests_step(env_name, codes, dry_run):
    cmd = [sys.executable, os.path.join(ROOT, "scripts", "dify", "run_tests.py"), "--env", env_name] + codes
    if dry_run:
        log(f"[test] (dry-run) 実行予定: {' '.join(cmd[1:])}")
        return None
    log(f"[test] {' '.join(cmd[1:])}")
    res = subprocess.run(cmd, cwd=ROOT, env=os.environ.copy(), capture_output=True, text=True)
    sys.stdout.write(res.stdout)
    sys.stderr.write(res.stderr)
    m = re.search(r"合計:\s*(\d+)\s*/\s*(\d+)\s*合格", res.stdout)
    summary = f"{m.group(1)}/{m.group(2)}" if m else "?"
    return {"returncode": res.returncode, "summary": summary}


# ---------------------------------------------------------------------------
# 6. CHANGELOG
# ---------------------------------------------------------------------------

def summarize_render_report(out_dir):
    path = os.path.join(out_dir, "render-report.md")
    if not os.path.isfile(path):
        return "render レポートなし"
    with open(path, encoding="utf-8") as fh:
        lines = [l for l in fh if l.startswith("|") and not l.startswith("| 番号") and not l.startswith("|---")]
    counts = {}
    for l in lines:
        cols = [c.strip() for c in l.strip("|\n").split("|")]
        if len(cols) < 2:
            continue
        rule = cols[1]
        if rule in ("—",):
            continue
        counts[rule] = counts.get(rule, 0) + 1
    if not counts:
        return "変更なし（env がマスタと同一）"
    return ", ".join(f"{k}×{v}" for k, v in sorted(counts.items()))


def append_changelog(env_name, codes, tag_name, summary, note):
    header = (
        "# dify/CHANGELOG.md — リリース履歴\n\n"
        "`scripts/dify/release.py` が合格したリリースごとに 1 行追記する（既存行は書き換えない）。\n"
        "設計: docs/handoff/2026-09-07-repo-layout-v2.md §4-4\n\n"
        "| 日付 | env | アプリ | tag | テスト | 備考 |\n"
        "|---|---|---|---|---|---|\n"
    )
    if not os.path.isfile(CHANGELOG_PATH):
        with open(CHANGELOG_PATH, "w", encoding="utf-8") as fh:
            fh.write(header)
    date = dt.datetime.now().strftime("%Y-%m-%d")
    row = f"| {date} | {env_name} | {' '.join(codes)} | {tag_name or '—'} | {summary} | {note} |\n"
    with open(CHANGELOG_PATH, "a", encoding="utf-8") as fh:
        fh.write(row)
    log(f"[changelog] {os.path.relpath(CHANGELOG_PATH, ROOT)} に追記しました: {row.strip()}")


# ---------------------------------------------------------------------------
# 7. tag
# ---------------------------------------------------------------------------

def next_tag_name(env_name):
    date = dt.datetime.now().strftime("%Y%m%d")
    base = f"release/{env_name}/{date}"
    res = subprocess.run(["git", "tag", "-l", base + "*"], cwd=ROOT, capture_output=True, text=True)
    existing = set(l.strip() for l in res.stdout.splitlines() if l.strip())
    if base not in existing:
        return base
    n = 2
    while f"{base}-{n}" in existing:
        n += 1
    return f"{base}-{n}"


def create_tag(name):
    res = subprocess.run(["git", "tag", name], cwd=ROOT, capture_output=True, text=True)
    if res.returncode != 0:
        raise ReleaseError(f"git tag {name} に失敗しました: {res.stderr.strip()}")
    log(f"[tag] ローカルにタグを作成しました: {name}（push は手動で）")


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("codes", nargs="*", help="管理番号（例 KN-01 DC-01）。--all と併用不可")
    ap.add_argument("--env", required=True, help="dify/env/<env>/env.yml")
    ap.add_argument("--all", action="store_true", help="dify/apps/*.yml すべて")
    ap.add_argument("--dry-run", action="store_true",
                     help="render・ガード・(cloud なら)IMPORT.md 生成だけ実行し、他はコマンド表示のみ。ネットワークを呼ばない")
    ap.add_argument("--no-tag", action="store_true", help="合格しても git tag を作らない")
    ap.add_argument("--no-console-import", action="store_true",
                     help="cloud edition でも Console API を使わず、常に IMPORT.md による手動インポート待ちにする"
                          "（DIFY_CONSOLE_TOKEN の有無に関係なく）")
    args = ap.parse_args()

    env_name = args.env
    log(f"== release.py --env {env_name} {'--all' if args.all else ' '.join(args.codes)} "
        f"{'--dry-run' if args.dry_run else ''} {'--no-tag' if args.no_tag else ''} ==".replace("  ", " "))

    stage = "0-preflight"
    try:
        preflight(env_name)
        env_raw = load_env_raw(env_name)
        codes = resolve_codes(args)
        log(f"対象: {', '.join(codes)}")

        stage = "1-render"
        out_dir = run_render(env_name, codes, args.all)

        stage = "2-guard"
        run_guards(env_raw, out_dir, codes)

        stage = "3-import"
        edition = (env_raw.get("dify") or {}).get("edition")
        if edition == "cloud":
            # IMPORT.md は自動経路でも証跡・手動フォールバック用に必ず生成する（設計 §5）
            write_import_md(env_name, edition, out_dir, codes)
            token_set = bool(os.environ.get("DIFY_CONSOLE_TOKEN", "").strip())

            if args.dry_run:
                # --dry-run はトークンの有無に関係なく、ここでネットワークを一切呼ばずに終わる（受け入れ条件 A5）
                log("[import] (dry-run) cloud 経路: IMPORT.md 生成のみ。ネットワークは呼びません")
                log("[STOP] --dry-run のため、ここで終了します（--dry-run を外すと DIFY_CONSOLE_TOKEN の"
                    "有無で自動 import / 手動インポートのどちらに進むかが決まります）")
                log("実行予定（参考）:")
                log(f"  python3 scripts/dify/kb_upload.py --env {env_name} <対象>")
                log(f"  python3 scripts/dify/run_tests.py --env {env_name} {' '.join(codes)}")
                log(f"  git tag {next_tag_name(env_name)}   # 全件合格後")
                return 0

            use_console_api = token_set and not args.no_console_import
            if not use_console_api:
                reason = "--no-console-import 指定" if args.no_console_import else "DIFY_CONSOLE_TOKEN 未設定"
                log(f"[import] cloud 経路: 手動（IMPORT.md）（{reason}）")
                log("[STOP] cloud 経路は自動 import しません。IMPORT.md の手順で Chrome から手動インポートしてから、"
                    "続き（KB・テスト）を人が判断して実行してください。")
                log("実行予定（参考。手動インポート後に）:")
                log(f"  python3 scripts/dify/kb_upload.py --env {env_name} <対象>")
                log(f"  python3 scripts/dify/run_tests.py --env {env_name} {' '.join(codes)}")
                log(f"  git tag {next_tag_name(env_name)}   # 全件合格後")
                return 0

            log("[import] cloud 経路: Console API（DIFY_CONSOLE_TOKEN: set）")
            _app_ids, failures = do_import_cloud_console(env_raw, out_dir, codes)
            if failures:
                failed_codes = ", ".join(c for c, _ in failures)
                raise ReleaseError(
                    f"Console API 経由の import/publish が {len(failures)} 件失敗しました（{failed_codes}）。"
                    f"{os.path.join('dify', 'build', env_name, 'IMPORT.md')} の手動手順に切り替えてください"
                )
            log("[import] Console API 経由のインポート・公開が完了しました。続けて KB・テストへ進みます。")
        elif edition != "selfhost":
            raise ReleaseError(f"dify.edition が不明です: {edition!r}（cloud/selfhost のいずれか）")
        else:
            do_import_selfhost(env_raw, out_dir, codes, args.dry_run)

        stage = "4-kb"
        run_kb_upload(env_name, codes, args.dry_run)

        stage = "5-test"
        test_result = run_tests_step(env_name, codes, args.dry_run)

        if args.dry_run:
            log("[STOP] --dry-run のため、ここで終了します（記録・tag は行いません）")
            log(f"実行予定タグ名: {next_tag_name(env_name)}")
            return 0

        stage = "6-changelog / 7-tag"
        summary = summarize_render_report(out_dir)
        if test_result is None or test_result["returncode"] != 0:
            log(f"[STOP] テストが全件合格ではありません（{stage} の手前で停止）。"
                "結果は dify/results/{}/ を確認してください。tag・CHANGELOG は書きません。".format(env_name))
            return 1

        tag_name = None
        if not args.no_tag:
            tag_name = next_tag_name(env_name)
            create_tag(tag_name)
        else:
            log("[tag] --no-tag のためタグは作成しません")

        append_changelog(env_name, codes, tag_name, test_result["summary"], f"render: {summary}")
        log("== release.py 完了 ==")
        return 0

    except ReleaseError as e:
        log(f"[STOP] stage={stage}: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
