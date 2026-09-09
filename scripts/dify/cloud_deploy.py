#!/usr/bin/env python3
"""dify/apps/*.yml を Dify Cloud（または Console API が使えるセルフホスト）へ、ブラウザを使わず
新規／上書きインポート・公開する。

    python3 scripts/dify/cloud_deploy.py --env cloud-master --all --dry-run
    python3 scripts/dify/cloud_deploy.py --env cloud-master KN-01 DC-01
    python3 scripts/dify/cloud_deploy.py --env cloud-master --all --write-env

設計: docs/handoff/2026-09-08-cloud-console-deploy.md §2・§4-3（Issue #114 PR-2）

流れ（§2-1。P1〔全件インポート成功後にまとめて公開〕は 3〜6 の並びに反映済み。Issue #121 W4-4）
  0 preflight   env.yml / PyYAML / DIFY_CONSOLE_TOKEN（か email/password）の有無 → 無ければ exit 2
                （値は出さない。"set"/"unset" だけ表示）
  1 render      render.py --env <env> --strict <番号...> → dify/build/<env>/*.yml
  1.5 kb-guard  **KB 紐づけの安全弁**（PM 報告に基づく追加。§9-2 相当・Issue #121 W4-4）：
                render 結果に knowledge-retrieval ノードを持つのに dataset_ids が空の番号が
                1 本でもあれば、Phase 2（resolve 以降）に入る前に exit 2 で全体を停止する
                （--dry-run では警告のみ表示して停止しない。ネットワークは呼ばない）
  2 resolve     app_id を決める（優先順: --app-id → env の apps.<番号>.id → 名前一致 → 新規作成）
  3 import      対象番号すべてに POST /console/api/apps/imports（app_id 付きなら上書き）。
                401/403 は exit 3 で即停止。それ以外の失敗は記録して次の番号へ進む（--stop-on-error で中断）
  4 confirm     console_api.import_dsl() が pending を自動で confirm する（既存実装）
  5 kb          --bind-kb draft のときだけ get_draft/update_draft で dataset_ids を差し替える
                （既定は dsl＝render 済み DSL に knowledge.*.id が焼き込まれている前提。何もしない）
  6 publish     **P1**: 3〜5 で 1 件でも失敗していたら、6 は 1 件も実行しない（§9-2）。
                全件成功していれば POST …/workflows/publish をまとめて実行（--no-publish で飛ばす）
  7 report      番号 → app_id の表と、env.yml へ書き戻す断片を表示（--write-env のときだけファイルを書く）
  8 logout      **B3**（§8-7・§9-3）: 本番実行でセッションを確立できていた場合
                （DIFY_CONSOLE_REFRESH 経由の "refresh" 認証のときだけ）、3〜7 の成否によらず
                最後に必ず POST /console/api/logout を試みる（失敗しても deploy 全体の終了コードは変えない）。
                DIFY_CONSOLE_TOKEN（非推奨）・selfhost の email/password 認証では何もしない
                （設計書 §8-7 B3 は Cookie 案＝リフレッシュトークンのセッションに限った歯止めのため）

冪等性の核（§2-2）：同じ番号を 2 回流してもアプリが増えないこと。
  1. --app-id <番号>=<id>
  2. env.yml の apps.<番号>.id（${VAR} 展開。未解決は「無し」扱い）
  3. 名前一致（GET /console/api/apps を全ページ）。1 件 → 採用／2 件以上 → 失敗として記録（--stop-on-error で中断）
     --no-adopt-by-name で無効化
  4. 新規作成 → 書き戻し断片を出す

終了コード: 0 全件成功（--dry-run 正常終了含む） / 1 1 件以上の失敗（インポートまたは公開） /
           2 引数・環境不備・到達不可・**KB 紐づけの安全弁に抵触**（1.5 kb-guard。新しい意味の
           終了コードを増やさず、既存の「実行前の設定不備」区分〔2〕を再利用した。KB 安全弁は
           まだセッションすら確立していない preflight 段階の停止であり、401/403〔3〕でも
           import/publish の実行時失敗〔1〕でもないため） / 3 認証エラー（401/403）

値をログに出さない：DIFY_CONSOLE_TOKEN・Authorization ヘッダ・API キーの値。本モジュールの log() は
console_api._mask() を必ず通す（CLAUDE.md §2-10）。

**注意（確認要）**：--bind-kb draft の draft ノード構造・KB 紐づけ経路（C5・C6）は実機未確認
（docs/handoff/2026-09-08-cloud-console-deploy.md §1-2）。既定の --bind-kb dsl は確認要の経路を通らない。
"""
import argparse
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

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
APPS_DIR = os.path.join(ROOT, "dify", "apps")
ENV_DIR = os.path.join(ROOT, "dify", "env")
BUILD_DIR = os.path.join(ROOT, "dify", "build")
RENDER_PY = os.path.join(ROOT, "scripts", "dify", "render.py")

VAR_RE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")
APP_ID_ARG_RE = re.compile(r"^([A-Za-z]{2}-\d{2})=(.+)$")


class CloudDeployError(RuntimeError):
    """引数・環境不備、または個別番号の処理失敗。"""


class AmbiguousNameError(CloudDeployError):
    def __init__(self, code, name, ids):
        super().__init__(
            f"{code}: 同名アプリが {len(ids)} 件あり、どれに上書きすべきか機械では決められません"
            f"（name={name!r}）。--app-id {code}=<id> で明示するか、"
            f"env.yml の apps.{code}.id にアプリ id を入れて再実行してください"
        )
        self.code = code


def log(msg):
    # console_api._mask() を必ず通す（万一 app_id 以外の文字列が紛れてもマスクされるように二重化）
    print(console_api._mask(str(msg)), flush=True)


# ---------------------------------------------------------------------------
# env.yml の読み・${VAR} 展開（render.py の expand_knowledge と同じ考え方の簡易版）
# ---------------------------------------------------------------------------

def expand(s):
    """${VAR} を展開する。未定義変数は空文字（表示用途のみに使う）。"""
    if not isinstance(s, str) or "${" not in s:
        return s
    return VAR_RE.sub(lambda m: os.environ.get(m.group(1), ""), s)


def expand_resolved(s):
    """${VAR} を展開する。未定義変数が 1 つでもあれば None（「無し」扱い＝正規の未解決状態）。"""
    if not isinstance(s, str):
        return s
    if "${" not in s:
        return s
    names = VAR_RE.findall(s)
    if any(n not in os.environ for n in names):
        return None
    return VAR_RE.sub(lambda m: os.environ[m.group(1)], s)


def load_env_raw(env_name):
    if yaml is None:
        raise CloudDeployError("PyYAML がありません: pip3 install pyyaml")
    path = os.path.join(ENV_DIR, env_name, "env.yml")
    if not os.path.isfile(path):
        raise CloudDeployError(f"env が見つかりません: {os.path.relpath(path, ROOT)}")
    with open(path, encoding="utf-8") as fh:
        return path, (yaml.safe_load(fh) or {})


def env_app_id(env_raw, code):
    """env.yml の apps.<番号>.id を解決する。無い／null／${VAR} 未解決なら None。"""
    apps = env_raw.get("apps") or {}
    spec = apps.get(code) or {}
    raw_id = spec.get("id")
    if raw_id in (None, "", "null"):
        return None
    return expand_resolved(raw_id)


def resolve_knowledge_id(env_raw, code):
    """env.yml の knowledge.<論理KB>.id を解決する（<番号> 一致・<番号>/xxx 一致の先頭）。
    render.py の render_app() と同じ探し方（Issue #114 §2-3 A）。"""
    knowledge = env_raw.get("knowledge") or {}
    for key, spec in knowledge.items():
        if key == code or key.startswith(code + "/"):
            raw_id = (spec or {}).get("id")
            if raw_id in (None, "", "null"):
                return None
            return expand_resolved(raw_id)
    return None


# ---------------------------------------------------------------------------
# 0. preflight / 対象コード解決
# ---------------------------------------------------------------------------

def resolve_codes(all_flag, codes_arg):
    all_files = sorted(glob.glob(os.path.join(APPS_DIR, "*.yml")))
    if all_flag:
        out = []
        for f in all_files:
            base = os.path.basename(f)
            parts = base.split("-", 2)
            out.append(parts[0] + "-" + parts[1] if len(parts) > 1 else base)
        return out
    if not codes_arg:
        raise CloudDeployError("対象アプリを指定してください（--all か管理番号を 1 つ以上）")
    out = []
    for c in codes_arg:
        c = c.upper()
        if not any(os.path.basename(f).startswith(c + "-") for f in all_files):
            raise CloudDeployError(f"アプリが見つかりません: {c}（dify/apps/{c}-*.yml）")
        out.append(c)
    return out


def preflight(env_name):
    """env.yml / PyYAML / 認証情報（DIFY_CONSOLE_REFRESH〔推奨。Cloud〕／DIFY_CONSOLE_TOKEN〔非推奨〕／
    email+password〔selfhost〕のいずれか）の有無を確認する。値は出さない。

    Issue #121 W4-4 で修正：以前は DIFY_CONSOLE_REFRESH を見ていなかった
    （console_api.client_from_env() の優先順〔refresh → token → email/password〕と食い違っており、
    `dify-ops.yml` の `deploy` ジョブが Environment secret に登録する想定の DIFY_CONSOLE_REFRESH
    だけを設定した場合に、ここで「未設定」として弾かれてしまうバグだった）。"""
    if yaml is None:
        raise CloudDeployError("PyYAML がありません: pip3 install pyyaml")
    env_path = os.path.join(ENV_DIR, env_name, "env.yml")
    if not os.path.isfile(env_path):
        raise CloudDeployError(f"env が見つかりません: {os.path.relpath(env_path, ROOT)}")
    refresh_set = bool(os.environ.get("DIFY_CONSOLE_REFRESH", "").strip())
    token_set = bool(os.environ.get("DIFY_CONSOLE_TOKEN", "").strip())
    email_pw_set = bool(
        os.environ.get("DIFY_CONSOLE_EMAIL", "").strip() and os.environ.get("DIFY_CONSOLE_PASSWORD", "").strip()
    )
    return env_path, refresh_set, token_set, (refresh_set or token_set or email_pw_set)


def parse_app_id_args(values):
    out = {}
    for v in values or []:
        m = APP_ID_ARG_RE.match(v)
        if not m:
            raise CloudDeployError(f"--app-id は <番号>=<id> の形式で指定してください: {v!r}")
        out[m.group(1).upper()] = m.group(2)
    return out


# ---------------------------------------------------------------------------
# 1. render（サブプロセス。release.py の run_render と同じ作法）
# ---------------------------------------------------------------------------

def run_render(env_name, codes, all_flag):
    cmd = [sys.executable, RENDER_PY, "--env", env_name, "--strict"]
    cmd += ["--all"] if all_flag else codes
    log(f"[render] {' '.join(cmd[1:])} → dify/build/{env_name}/")
    res = subprocess.run(cmd, cwd=ROOT, env=os.environ.copy(), capture_output=True, text=True, timeout=120)
    sys.stdout.write(res.stdout)
    sys.stderr.write(res.stderr)
    if res.returncode != 0:
        raise CloudDeployError(f"render.py が失敗しました（exit {res.returncode}）")
    return os.path.join(BUILD_DIR, env_name)


def build_file_for(out_dir, code):
    matches = sorted(glob.glob(os.path.join(out_dir, f"{code}-*.yml")))
    if not matches:
        raise CloudDeployError(f"render の出力が見つかりません: dify/build/.../{code}-*.yml")
    return matches[0]


def load_build(out_dir, code):
    path = build_file_for(out_dir, code)
    with open(path, encoding="utf-8") as fh:
        yaml_text = fh.read()
    data = yaml.safe_load(yaml_text) or {}
    name = ((data.get("app")) or {}).get("name") or code
    return path, yaml_text, name


# ---------------------------------------------------------------------------
# 2. app_id の解決（冪等性の核。§2-2）
# ---------------------------------------------------------------------------

def resolve_app_id(client, code, name, cli_app_ids, env_raw, adopt_by_name, apps_cache, dry_run=False):
    """戻り値: (app_id または None, source)。source は 'cli' / 'env' / 'name' / 'new'。
    dry_run のときは名前一致（ネットワーク）を試行しない。"""
    if code in cli_app_ids:
        return cli_app_ids[code], "cli"
    env_id = env_app_id(env_raw, code)
    if env_id:
        return env_id, "env"
    if dry_run:
        return None, "new"
    if adopt_by_name:
        if apps_cache.get("apps") is None:
            apps_cache["apps"] = client.list_apps()
        matches = [a for a in apps_cache["apps"] if a.get("name") == name]
        if len(matches) == 1:
            return matches[0].get("id"), "name"
        if len(matches) >= 2:
            raise AmbiguousNameError(code, name, [a.get("id") for a in matches])
    return None, "new"


# ---------------------------------------------------------------------------
# 5. KB 紐づけ（--bind-kb draft のときだけ。確認要: Issue #114 C5・C6）
# ---------------------------------------------------------------------------

def _patch_dataset_ids(node, new_ids):
    """draft の graph を再帰的に walk し、dataset_ids を持つノードを見つけたら差し替える
    （draft の実スキーマは未確認のため、キー名一致で汎用的に探す）。"""
    changed = False
    if isinstance(node, dict):
        if isinstance(node.get("dataset_ids"), list):
            node["dataset_ids"] = list(new_ids)
            changed = True
        for v in node.values():
            if _patch_dataset_ids(v, new_ids):
                changed = True
    elif isinstance(node, list):
        for v in node:
            if _patch_dataset_ids(v, new_ids):
                changed = True
    return changed


def bind_kb_draft(client, app_id, code, env_raw, warnings):
    """確認要（Issue #114 C5・C6）: get_draft/update_draft の実スキーマ。
    knowledge.<論理KB>.id が未解決なら何もしない（警告のみ）。"""
    ds_id = resolve_knowledge_id(env_raw, code)
    if not ds_id:
        warnings.append(f"{code}: --bind-kb draft ですが knowledge.<論理KB>.id が未解決のため何もしません")
        return False
    draft = client.get_draft(app_id)
    if not _patch_dataset_ids(draft, [ds_id]):
        warnings.append(f"{code}: draft に dataset_ids を持つノードが見つかりません（確認要: Issue #114 C5）")
        return False
    client.update_draft(app_id, draft)
    return True


# ---------------------------------------------------------------------------
# 5.5 KB 紐づけの安全弁（Phase 1 の前。PM 報告での追加指示。Issue #121 W4-4）
# ---------------------------------------------------------------------------
#
# 判定材料を「レンダ済み DSL の knowledge-retrieval ノードに dataset_ids が入っているか」に
# した理由（設計書には無い、実装時に見つかった歯止め。PM 指示で追加）：
#
#   - PM が最初に挙げた候補は「dify/kb/<番号>/ ディレクトリの有無」だったが、これは
#     「文書を置く場所」という運用上の慣習であり、DSL の実際のノード構造と機械的に
#     同期している保証が無い（ディレクトリはあるがノードが無い／ノードはあるが
#     ディレクトリが無い、という食い違いが将来起きても検出できない）。
#   - 一方 cloud_deploy.py が実際にインポートするのは「レンダ済み DSL そのもの」。
#     この DSL の knowledge-retrieval ノードに dataset_ids が入っているかどうかが、
#     上書きインポートで Cloud 側の既存の KB 紐づけを空で潰してしまうかどうかを
#     直接・確実に決める。したがって「これからアップロードする物そのもの」を
#     見るのがもっとも確実（render.py 自身が R5 でこの同じノード構造を書き換えている
#     こととも整合する）。
#   - 副次的な利点：恒久対応（実行時に Datasets API から id を引く。architect が設計中）が
#     入れば、dataset_ids は自動的に空でなくなるため、この関数は改修なしで
#     ブロックしなくなる（判定ロジックの寿命が短くならない）。
#
# 1 本でも該当したら Phase 1（インポート）に入る前に実行全体を停止する（P1 と同じ思想。
# --force のような回避フラグは意図的に用意しない。恒久対応が入るまではこの状態が正しい）。

def find_empty_kb_bindings(out_dir, codes):
    """レンダ済み DSL（dify/build/<env>/<番号>-*.yml）を読み、knowledge-retrieval ノードを
    1 つ以上持つのに dataset_ids が空（[] または未設定）のままの番号を集める。
    戻り値: [(code, [node_title, ...]), ...]（該当が無ければ空リスト）。

    render.py の render_app() と同じ場所（workflow.graph.nodes[].data）を見る（§ 参照）。
    ノード自体が読めない（build ファイルが無い等）番号はここでは無視する
    （そちらは run_render() / load_build() 側で別途エラーになっているはず）。"""
    hits = []
    for code in codes:
        try:
            path = build_file_for(out_dir, code)
        except CloudDeployError:
            continue
        with open(path, encoding="utf-8") as fh:
            data = yaml.safe_load(fh.read()) or {}
        nodes = (((data.get("workflow") or {}).get("graph")) or {}).get("nodes") or []
        empty_titles = []
        for n in nodes:
            d = n.get("data") or {}
            if d.get("type") == "knowledge-retrieval" and not d.get("dataset_ids"):
                empty_titles.append(d.get("title") or n.get("id") or "(無題)")
        if empty_titles:
            hits.append((code, empty_titles))
    return hits


def format_kb_binding_guard_message(hits):
    """find_empty_kb_bindings() の戻り値から、なぜ止めたか／どうすればよいかが分かるメッセージを作る。
    dataset id の値は（そもそも空なので）出さない。将来この関数が値を扱うようになった場合は
    masking.short_id() を必ず通すこと（CLAUDE.md §2-10）。"""
    lines = [
        "[STOP] KB を要求しているのに dataset_ids が空のままのアプリがあります。"
        "このまま上書きインポート・公開すると、Dify 上で既に紐づいている知識ベースの"
        "紐づけが空にリセットされる可能性があります（PM 報告に基づく追加の歯止め。Issue #121 W4-4）。",
        "",
        "対象（管理番号: knowledge-retrieval ノード名）:",
    ]
    for code, titles in hits:
        lines.append(f"  - {code}: {', '.join(titles)}")
    lines += [
        "",
        "どうすればよいか（どちらか）:",
        "  1. これらの番号を codes から外して再実行する（KB を持たないアプリだけを deploy する）",
        "  2. DIFY_DATASET_ID_<番号>（例 DIFY_DATASET_ID_KN01）を設定して dataset_ids を焼き込んでから"
        " 再実行する（dify/DEPLOY.md §1-④・§9「既知の制限」を参照）",
        "",
        "恒久対応（実行時に Datasets API から id を引く）は architect が設計中です（Issue #121）。"
        "それが入るまで --force のような回避フラグはありません。"
        "1 本でも該当したら実行全体を停止します（P1 と同じ思想。半分だけ危険な状態で進めない）。",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# 7. report / env.yml 書き戻し（§4-5）
# ---------------------------------------------------------------------------

def print_report(results, failures):
    log("\n== 結果 ==")
    log("| 番号 | 経路 | app_id | 公開 |")
    log("|---|---|---|---|")
    for r in results:
        log(f"| {r['code']} | {r['route']} | {r['app_id']} | {'OK' if r['published'] else '—'} |")
    for code, msg in failures:
        log(f"| {code} | 失敗 | — | — |")
    log(f"成功 {len(results)} / 失敗 {len(failures)}")
    if failures:
        log("失敗の詳細:")
        for code, msg in failures:
            log(f"  [{code}] {msg}")


def safe_logout(client):
    """B3（設計書 §8-7・§9-3。Issue #121 W4-4）: ジョブの最後に必ずセッションの無効化を試みる。
    `client._auth_mode == "refresh"`（DIFY_CONSOLE_REFRESH 経由。Cookie 案。§8-1）のときだけ実行する
    ——非推奨の DIFY_CONSOLE_TOKEN・selfhost の email/password 認証は対象外（設計書 §8-7 B3 は
    Cookie 案のセッションに限った歯止めのため。既存のテスト・運用〔レガシートークンの再利用〕を壊さない）。

    logout 自体が失敗しても deploy 全体の終了コードには影響させない（既にインポート・公開の結果で
    決まっているため）。失敗はログに残す（値は console_api.log() が _mask() を通すので出ない）。
    呼び出し元は try/finally で「import/publish の成否によらず必ず呼ばれる」ことを保証する。"""
    if getattr(client, "_auth_mode", None) != "refresh":
        return
    try:
        client.logout()
    except console_api.ConsoleAPIError as e:
        log(f"[logout] 失敗しました（無視して続行。手動での即時失効手順は dify/DEPLOY.md §9 を参照）: {e}")


def print_write_env_fragment(new_ids):
    log("\nenv.yml に書き戻す差分（--write-env を付けると自動で書きます）:")
    log("  apps:")
    for code, app_id in sorted(new_ids.items()):
        log(f"    {code}: {{ id: {app_id} }}")


def apply_write_env(env_path, updates):
    """apps.<番号>.id が `null` の行だけを実 id に書き換える。YAML の再 dump はしない（§4-5）。
    現在値が null 以外（${VAR} や既存 UUID、キー自体が無い）なら 1 件でも該当すれば何も書かず例外を投げる。"""
    with open(env_path, encoding="utf-8") as fh:
        lines = fh.readlines()

    problems = []
    changes = {}
    for code, app_id in sorted(updates.items()):
        null_pattern = re.compile(rf"^(\s*{re.escape(code)}:\s*\{{\s*id:\s*)null(\s*\}}.*)$")
        found_idx = None
        for i, line in enumerate(lines):
            new_line, n = null_pattern.subn(rf"\g<1>{app_id}\g<2>", line, count=1)
            if n:
                found_idx = i
                changes[i] = new_line
                break
        if found_idx is None:
            problems.append(code)

    if problems:
        raise CloudDeployError(
            "env.yml の apps.<番号>.id が `id: null` の形ではないため書き換えられません（手で直してください）: "
            + ", ".join(problems)
        )

    for i, new_line in changes.items():
        lines[i] = new_line
    with open(env_path, "w", encoding="utf-8") as fh:
        fh.writelines(lines)
    return len(changes)


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def build_arg_parser():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("codes", nargs="*", help="管理番号（例 KN-01 DC-01）。--all と併用不可")
    ap.add_argument("--env", default=os.environ.get("DIFY_ENV") or "cloud-master",
                     help="dify/env/<env>/env.yml（既定 $DIFY_ENV、無ければ cloud-master）")
    ap.add_argument("--all", action="store_true", help="dify/apps/*.yml すべて")
    ap.add_argument("--app-id", action="append", default=[], metavar="<番号>=<id>",
                     help="app_id を明示（複数指定可）")
    ap.add_argument("--bind-kb", choices=["dsl", "draft", "none"], default="dsl",
                     help="既定 dsl（render 済み DSL に dataset_ids が焼き込まれている前提。何もしない）")
    ap.add_argument("--dry-run", action="store_true",
                     help="render まで実行し、以降は実行予定を表示するだけ。ネットワークを呼ばない")
    ap.add_argument("--no-publish", action="store_true", help="インポートまでで止める（公開しない）")
    ap.add_argument("--no-adopt-by-name", action="store_true",
                     help="名前一致による既存アプリ採用を無効化（必ず新規作成）")
    ap.add_argument("--write-env", action="store_true",
                     help="env.yml の apps.<番号>.id が null の行だけを実 id に書き換える")
    ap.add_argument("--stop-on-error", action="store_true", help="最初の失敗で中断（既定は残りを続行）")
    ap.add_argument("--timeout", type=int, default=120, help="Console API 呼び出しのタイムアウト秒（既定 120）")
    return ap


def main():
    args = build_arg_parser().parse_args()
    env_name = args.env

    log(f"== cloud_deploy.py --env {env_name} "
        f"{'--all' if args.all else ' '.join(args.codes)} "
        f"{'--dry-run' if args.dry_run else ''} ==".replace("  ", " "))

    try:
        cli_app_ids = parse_app_id_args(args.app_id)
        env_path, refresh_set, token_set, creds_available = preflight(env_name)
        _, env_raw = load_env_raw(env_name)
        codes = resolve_codes(args.all, args.codes)
    except CloudDeployError as e:
        log(f"[STOP] {e}")
        return 2

    console_url = os.environ.get("DIFY_CONSOLE_URL", "").strip() or expand((env_raw.get("dify") or {}).get("console_url") or "")
    log(f"DIFY_CONSOLE_REFRESH: {'set' if refresh_set else 'unset'}   "
        f"DIFY_CONSOLE_TOKEN: {'set' if token_set else 'unset'}   DIFY_CONSOLE_URL: {console_url or '(未設定)'}")
    log(f"対象: {', '.join(codes)}")

    if not creds_available:
        log("DIFY_CONSOLE_REFRESH、DIFY_CONSOLE_TOKEN、または DIFY_CONSOLE_EMAIL / DIFY_CONSOLE_PASSWORD のいずれも未設定です。")
        log(console_api.TOKEN_HELP)
        return 2

    try:
        out_dir = run_render(env_name, codes, args.all)
    except CloudDeployError as e:
        log(f"[STOP] {e}")
        return 2

    adopt_by_name = not args.no_adopt_by_name

    if args.dry_run:
        log("-- dry-run: 以降はネットワークを呼ばず、実行予定のみ表示します --")
        apps_cache = {"apps": None}
        for code in codes:
            try:
                _, _, name = load_build(out_dir, code)
            except CloudDeployError as e:
                log(f"[{code}] [STOP] {e}")
                continue
            app_id, source = resolve_app_id(
                None, code, name, cli_app_ids, env_raw, adopt_by_name, apps_cache, dry_run=True,
            )
            if app_id:
                log(f"[{code}] (dry-run) app_id={app_id}（{source}） → 上書きインポート予定")
            else:
                log(f"[{code}] (dry-run) 新規作成予定（名前一致の判定は実行時にのみ行います）")
            if not args.no_publish:
                log(f"[{code}] (dry-run) 公開予定")
        kb_hits = find_empty_kb_bindings(out_dir, codes)
        if kb_hits:
            log("")
            log(format_kb_binding_guard_message(kb_hits))
            log("\n(dry-run のため停止しません。本番実行〔--dry-run 無し〕ではこのまま exit 2 で停止します)")
        log("\n== dry-run 完了（ネットワークは呼んでいません） ==")
        return 0

    # KB 紐づけの安全弁（5.5 節）: Phase 1（インポート）どころか、セッション確立（client_from_env）
    # より前に判定する。実行を伴わない dry-run では判定しない（上のブロックで警告のみ表示する）。
    # ネットワークを一切呼ばずに判定できるため、ここで止めれば DIFY_CONSOLE_REFRESH の
    # 1 回使い切りのリフレッシュトークンも消費しない（無駄打ちしない）。
    kb_hits = find_empty_kb_bindings(out_dir, codes)
    if kb_hits:
        log(format_kb_binding_guard_message(kb_hits))
        return 2

    # ---- 本番実行 ----
    try:
        client = console_api.client_from_env(console_url, timeout=args.timeout)
    except console_api.ConsoleAuthError as e:
        log(str(e))
        log(console_api.TOKEN_HELP)
        return 3
    except console_api.ConsoleAPIError as e:
        log(str(e))
        return 2

    # B3（§8-7・§9-3。Issue #121 W4-4）：import/publish の成否によらず、必ず logout を試みる。
    # ここから下で return する経路（認証エラーの即時停止・失敗の記録）はすべて try のスコープ内なので、
    # finally は例外・return のどちらでも実行される。
    try:
        return run_deploy(client, codes, out_dir, cli_app_ids, env_raw, adopt_by_name, args, env_path)
    finally:
        safe_logout(client)


def run_deploy(client, codes, out_dir, cli_app_ids, env_raw, adopt_by_name, args, env_path):
    """本番実行のフェーズ 1（全件インポート）とフェーズ 2（公開）。P1（§9-2）：
    フェーズ 1 で 1 件でも失敗したら、フェーズ 2（公開）は 1 件も実行しない。"""
    apps_cache = {"apps": None}
    results = []
    warnings = []
    failures = []

    # -- フェーズ 1: インポート（＋ --bind-kb draft のときだけ KB 紐づけ） --------------------
    for code in codes:
        try:
            _, yaml_text, name = load_build(out_dir, code)
            app_id, source = resolve_app_id(client, code, name, cli_app_ids, env_raw, adopt_by_name, apps_cache)
            route_label = "新規作成" if source == "new" else "上書き"
            if app_id:
                log(f"[{code}] app_id={app_id}（{source}） → {route_label}インポート中…")
            else:
                log(f"[{code}] 名前一致なし → 新規作成")

            result_app_id, status, _import_id = client.import_dsl(yaml_text, app_id=app_id, return_details=True)

            if args.bind_kb == "draft":
                bind_kb_draft(client, result_app_id, code, env_raw, warnings)

            results.append({
                "code": code, "route": route_label, "app_id": result_app_id,
                "published": False, "new": source == "new",
            })
            log(f"[{code}] インポート完了: app_id={result_app_id}（status={status}）")

        except console_api.ConsoleAuthError as e:
            # 認証エラーは §2-4 のとおり即座に停止する（以降の番号には進まない）
            log(str(e))
            log(console_api.TOKEN_HELP)
            return 3
        except console_api.ConsoleAPIError as e:
            msg = str(e)
            if "接続失敗" in msg:
                log(f"[{code}] [STOP] {msg}")
                log("この環境から Cloud に到達できません（砂箱では実行しない）。")
                return 2
            log(f"[{code}] [FAIL] {msg}")
            failures.append((code, msg))
            if args.stop_on_error:
                break
        except CloudDeployError as e:
            log(f"[{code}] [FAIL] {e}")
            failures.append((code, str(e)))
            if args.stop_on_error:
                break

    for w in warnings:
        log("WARN: " + w)

    # -- フェーズ 2: 公開（P1。§9-2） --------------------------------------------------------
    if args.no_publish:
        log("[publish] --no-publish のため公開はスキップします")
    elif failures:
        log(
            "[publish] [STOP] インポートに失敗した番号があるため、公開は 1 件も行いません（P1・§9-2）: "
            + ", ".join(code for code, _ in failures)
        )
    elif not results:
        log("[publish] 公開対象がありません（インポートが完了した番号が 0 件）")
    else:
        log(f"[publish] 全件インポート成功。{len(results)} 件をまとめて公開します（P1）")
        for r in results:
            try:
                client.publish(r["app_id"])
                r["published"] = True
                log(f"[{r['code']}] 公開完了: app_id={r['app_id']}")
            except console_api.ConsoleAuthError as e:
                log(str(e))
                log(console_api.TOKEN_HELP)
                return 3
            except console_api.ConsoleAPIError as e:
                msg = str(e)
                log(f"[{r['code']}] [FAIL] 公開に失敗しました: {msg}")
                failures.append((r["code"], f"公開失敗: {msg}"))
                if args.stop_on_error:
                    break

    print_report(results, failures)

    new_ids = {r["code"]: r["app_id"] for r in results if r["new"]}
    if new_ids:
        print_write_env_fragment(new_ids)
        if args.write_env:
            try:
                n = apply_write_env(env_path, new_ids)
                log(f"[write-env] {n} 行を更新しました。"
                    f"git diff {os.path.relpath(env_path, ROOT)} で確認してから commit してください。")
            except CloudDeployError as e:
                log(f"[write-env] [STOP] {e}")
                return 1

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
