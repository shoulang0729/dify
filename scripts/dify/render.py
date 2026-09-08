#!/usr/bin/env python3
"""dify/env/<env>/env.yml をマスタ DSL（dify/apps/*.yml）に流し込む。

    python3 scripts/dify/render.py --env cloud-master --all
    python3 scripts/dify/render.py --env customer-a KN-01 DC-01 --strict
    python3 scripts/dify/render.py --env cloud-master --all --check   # 書き込まずマスタとのバイト一致だけ確認
    python3 scripts/dify/render.py --env inhouse --all --diff         # 置換レポートを標準出力にも表示

設計: docs/handoff/2026-09-07-repo-layout-v2.md §3・§4-1〜§4-3

置換ルール（DSL のパス。詳細は設計書 §4-1）
  R1 llm ノードの model                          ← models.chat（models.overrides で個別に models.<role>）
  R2 question-classifier / parameter-extractor   ← models.reasoning（completion_params も env から）
  R3 knowledge-retrieval の reranking_model       ← models.rerank（空なら reranking_enable: false）
  R4 knowledge-retrieval の single_retrieval_config.model ← models.reasoning
  R5 knowledge-retrieval の dataset_ids           ← knowledge.<論理KB名>.id（null/未設定は「未解決」警告のみ。exit 1 にしない）
  R6 start ノードの variables[].{default,options} ← brand.replace の語彙置換
  R7 app.name/description・node の title/desc・prompt_template[].text ← brand.replace の語彙置換
  R8 workflow.environment_variables               ← v1 では注入しない（触らない）
  R9 version                                      ← dify.dsl_version
  R10 dependencies                                ← 触らない

恒等性：置換の結果がマスタと**意味的に同一**なら、マスタの生バイトをそのままコピーする（YAML 再シリアライズの整形差を出さない）。
`--env cloud-master` は `brand.replace` が空・`models.chat` がマスタと同じ値なので、`--all` の出力は常にマスタとバイト一致する。

`${VAR}` 展開：env.yml の文字列に `${NAME}` があればプロセス環境変数で置換する。`--strict` で未定義なら**exit 1**（値は出さず名前だけ列挙）。
ただし `knowledge.<論理名>.id` は例外（§4-2）：`dataset_ids: []` は「未解決」を表す正規の状態なので、
`${VAR}` が未定義でも `--strict` の対象にしない（render-report.md に「未解決・警告」として出るだけ）。

終了コード: 0 正常 / 1 --strict 違反・--check の不一致 / 2 PyYAML が無い・env が無い等の環境不備
"""
import argparse
import copy
import datetime as dt
import glob
import os
import re
import sys

try:
    import yaml
except ImportError:  # pragma: no cover
    print("PyYAML がありません: pip3 install pyyaml")
    sys.exit(2)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ENV_DIR = os.path.join(ROOT, "dify", "env")
APPS_DIR = os.path.join(ROOT, "dify", "apps")
RENDER_VERSION = 1
VAR_RE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")
MASK = "***"


def log(msg):
    print(msg, flush=True)


# ---------------------------------------------------------------------------
# env.yml の読み込みと ${VAR} 展開
# ---------------------------------------------------------------------------

def load_env_raw(env_name):
    path = os.path.join(ENV_DIR, env_name, "env.yml")
    if not os.path.isfile(path):
        log(f"env が見つかりません: {os.path.relpath(path, ROOT)}")
        sys.exit(2)
    with open(path, encoding="utf-8") as fh:
        raw = yaml.safe_load(fh) or {}
    return path, raw


def expand_str(s, environ, undefined_out):
    """文字列中の ${NAME} をプロセス環境変数で置換する。戻り値は (展開後の値, マスク対象か)。"""
    if not isinstance(s, str) or "${" not in s:
        return s, False
    masked = bool(VAR_RE.search(s))

    def repl(m):
        name = m.group(1)
        if name in environ:
            return environ[name]
        undefined_out.add(name)
        return ""

    return VAR_RE.sub(repl, s), masked


def expand_marked(node, environ, undefined_out):
    """dict/list/str を再帰的に展開する。戻り値は (展開後の値, 同じ形のマスクフラグ)。"""
    if isinstance(node, dict):
        out, mask = {}, {}
        for k, v in node.items():
            out[k], mask[k] = expand_marked(v, environ, undefined_out)
        return out, mask
    if isinstance(node, list):
        outs, masks = [], []
        for v in node:
            o, m = expand_marked(v, environ, undefined_out)
            outs.append(o)
            masks.append(m)
        return outs, masks
    if isinstance(node, str):
        return expand_str(node, environ, undefined_out)
    return node, False


def expand_knowledge(know_raw, environ):
    """knowledge.<論理名>.id は ${VAR} 未定義でも --strict の対象にしない（未解決＝正規の状態）。"""
    out = {}
    for logical, spec in (know_raw or {}).items():
        spec = spec or {}
        id_raw = spec.get("id")
        name_raw = spec.get("name")
        name_val, name_masked = expand_str(name_raw, environ, set())
        id_val, id_masked = None, False
        if id_raw not in (None, "", "null"):
            if isinstance(id_raw, str) and VAR_RE.search(id_raw):
                names = VAR_RE.findall(id_raw)
                if any(n not in environ for n in names):
                    id_val = None  # 未解決（正規の状態。exit 1 にしない）
                else:
                    id_val = VAR_RE.sub(lambda m: environ[m.group(1)], id_raw)
                    id_masked = True
            else:
                id_val = id_raw
        out[logical] = {"name": name_val, "name_masked": name_masked, "id": id_val, "id_masked": id_masked}
    return out


def expand_env(env_raw, environ):
    """env.yml 全体を展開する。knowledge.*.id だけ別扱い。
    戻り値: (env dict, masked dict（同じ形）, undefined var 名の集合, issues のリスト)
    """
    undefined = set()
    env = {}
    masked = {}
    for key in ("dify", "models", "brand", "variables"):
        env[key], masked[key] = expand_marked(env_raw.get(key) or {}, environ, undefined)
    env["knowledge"] = expand_knowledge(env_raw.get("knowledge") or {}, environ)
    env["flags"] = env_raw.get("flags") or {}
    env["schema"] = env_raw.get("schema")
    env["name"] = env_raw.get("name")

    issues = []
    if env_raw.get("schema") != 1:
        issues.append(f"schema が未知: {env_raw.get('schema')!r}")
    chat = (env.get("models") or {}).get("chat") or {}
    if not chat.get("provider") or not chat.get("name"):
        issues.append("models.chat が空")
    return env, masked, undefined, issues


# ---------------------------------------------------------------------------
# 語彙置換（R6・R7）
# ---------------------------------------------------------------------------

def apply_replace(text, table_expanded, table_masked):
    """table_expanded: [(from, to)]。table_masked: from -> bool（to が ${VAR} 由来か）。
    戻り値: (置換後テキスト, [(word, count, masked), ...])"""
    if not isinstance(text, str) or not text:
        return text, []
    hits = []
    for frm, to in table_expanded:
        if frm in text:
            n = text.count(frm)
            text = text.replace(frm, to)
            hits.append((frm, n, table_masked.get(frm, False)))
    return text, hits


# ---------------------------------------------------------------------------
# DSL への適用
# ---------------------------------------------------------------------------

def fmt_model(m):
    return f"provider={m.get('provider','')} name={m.get('name','')} mode={m.get('mode','')}"


def render_app(code, data, env, env_masked, replace_table, replace_masked, strict, warnings):
    """data（yaml.safe_load 済み）を env に基づいて書き換えた深いコピーを返す。
    戻り値: (out, rows)。rows は render-report.md の行 (rule, path, before, after)。"""
    out = copy.deepcopy(data)
    rows = []
    graph = ((out.get("workflow") or {}).get("graph")) or {}
    nodes = graph.get("nodes") or []

    models = env.get("models") or {}
    models_masked = env_masked.get("models") or {}

    # models.overrides の当て方（node_title で一致するノードを探す）
    override_map = {}
    for ov in models.get("overrides") or []:
        if ov.get("app") != code:
            continue
        title = ov.get("node_title")
        role = ov.get("role")
        matched = [n for n in nodes if (n.get("data") or {}).get("title") == title]
        if not matched:
            msg = f"{code}: models.overrides の node_title {title!r} に一致するノードが無い"
            if strict:
                log("ERROR: " + msg)
                sys.exit(1)
            warnings.append(msg)
            continue
        for n in matched:
            override_map[n["id"]] = role

    for n in nodes:
        d = n.get("data") or {}
        t = d.get("type")
        title = d.get("title", "")
        nid = n.get("id")

        if t == "llm":
            role = override_map.get(nid, "chat")
            m = models.get(role) or {}
            m_masked = models_masked.get(role) or {}
            if m.get("provider") and m.get("name"):
                before = dict(d.get("model") or {})
                after = {
                    "provider": m.get("provider"),
                    "name": m.get("name"),
                    "mode": m.get("mode", before.get("mode", "chat")),
                    "completion_params": m.get("completion_params", before.get("completion_params", {})),
                }
                d["model"] = after
                if after != before:
                    is_masked = bool(m_masked.get("provider") or m_masked.get("name"))
                    rows.append(("R1", f"llm:{title}.model", fmt_model(before),
                                 MASK if is_masked else fmt_model(after)))
            elif not m and role == "chat":
                warnings.append(f"{code}: models.chat が空のため llm:{title} のモデルは変更していない")

        if t in ("question-classifier", "parameter-extractor"):
            m = models.get("reasoning") or {}
            if m.get("provider") and m.get("name"):
                before = dict(d.get("model") or {})
                after = {**before, "provider": m.get("provider"), "name": m.get("name"),
                         "mode": m.get("mode", before.get("mode", "chat")),
                         "completion_params": m.get("completion_params", before.get("completion_params", {}))}
                d["model"] = after
                if after != before:
                    rows.append(("R2", f"{t}:{title}.model", fmt_model(before), fmt_model(after)))

        if t == "knowledge-retrieval":
            mrc = d.get("multiple_retrieval_config")
            if mrc is not None:
                rerank = models.get("rerank") or {}
                before_rm = dict(mrc.get("reranking_model") or {})
                before_enable = mrc.get("reranking_enable")
                after_rm = {"model": rerank.get("name", ""), "provider": rerank.get("provider", "")}
                after_enable = bool(after_rm["model"] and after_rm["provider"])
                mrc["reranking_model"] = after_rm
                mrc["reranking_enable"] = after_enable
                if after_rm != before_rm or after_enable != before_enable:
                    rows.append(("R3", f"knowledge-retrieval:{title}.reranking_model",
                                 f"provider={before_rm.get('provider','')} model={before_rm.get('model','')} enable={before_enable}",
                                 f"provider={after_rm['provider']} model={after_rm['model']} enable={after_enable}"))

            src = d.get("single_retrieval_config")
            if src is not None:
                m = models.get("reasoning") or {}
                if m.get("provider") and m.get("name"):
                    before = dict(src.get("model") or {})
                    after = {**before, "provider": m.get("provider"), "name": m.get("name")}
                    src["model"] = after
                    if after != before:
                        rows.append(("R4", f"knowledge-retrieval:{title}.single_retrieval_config.model",
                                     fmt_model(before), fmt_model(after)))

            logical_keys = [k for k in env["knowledge"] if k == code or k.startswith(code + "/")]
            before_ds = list(d.get("dataset_ids") or [])
            if not logical_keys:
                msg = f'{code}: knowledge に論理KB "{code}" が無い（knowledge-retrieval ノードが要求）'
                if strict:
                    log("ERROR: " + msg)
                    sys.exit(1)
                warnings.append(msg)
                rows.append(("R5", f"knowledge-retrieval:{title}.dataset_ids", str(before_ds),
                             "未解決・警告（knowledge に論理KB定義なし）"))
            else:
                kb = env["knowledge"][logical_keys[0]]
                if kb["id"] is None:
                    rows.append(("R5", f"knowledge-retrieval:{title}.dataset_ids", str(before_ds),
                                 "未解決・警告（id 未設定）"))
                else:
                    after_ds = [kb["id"]]
                    d["dataset_ids"] = after_ds
                    if after_ds != before_ds:
                        rows.append(("R5", f"knowledge-retrieval:{title}.dataset_ids", str(before_ds),
                                     MASK if kb["id_masked"] else str(after_ds)))

        if t == "start":
            for v in d.get("variables") or []:
                vname = v.get("variable", "")
                before_opts = list(v.get("options") or [])
                if before_opts:
                    new_opts, all_hits = [], []
                    for opt in before_opts:
                        newval, hits = apply_replace(opt, replace_table, replace_masked)
                        new_opts.append(newval)
                        all_hits += hits
                    if new_opts != before_opts:
                        v["options"] = new_opts
                        for word, cnt, is_masked in all_hits:
                            rows.append(("R6", f"start.{vname}.options", word,
                                         (MASK if is_masked else "") + f"（{cnt} か所）"))
                before_def = v.get("default", "")
                if isinstance(before_def, str) and before_def:
                    new_def, hits = apply_replace(before_def, replace_table, replace_masked)
                    if new_def != before_def:
                        v["default"] = new_def
                        for word, cnt, is_masked in hits:
                            rows.append(("R6", f"start.{vname}.default", word,
                                         (MASK if is_masked else "") + f"（{cnt} か所）"))

        # R7 語彙置換：node の title / desc、llm の prompt_template[].text
        for field in ("desc",):
            if field in d and isinstance(d.get(field), str):
                newval, hits = apply_replace(d[field], replace_table, replace_masked)
                if newval != d[field]:
                    d[field] = newval
                    for word, cnt, is_masked in hits:
                        rows.append(("R7", f"{t}:{title}.{field}", word,
                                     (MASK if is_masked else "") + f"（{cnt} か所）"))
        if t == "llm":
            for p in d.get("prompt_template") or []:
                txt = p.get("text", "")
                newval, hits = apply_replace(txt, replace_table, replace_masked)
                if newval != txt:
                    p["text"] = newval
                    for word, cnt, is_masked in hits:
                        rows.append(("R7", f"llm:{title}.prompt_template[{p.get('role')}]", word,
                                     (MASK if is_masked else "") + f"（{cnt} か所）"))

    # R7: app.name / app.description
    app = out.get("app") or {}
    for field in ("name", "description"):
        val = app.get(field, "")
        newval, hits = apply_replace(val, replace_table, replace_masked)
        if newval != val:
            app[field] = newval
            for word, cnt, is_masked in hits:
                rows.append(("R7", f"app.{field}", word, (MASK if is_masked else "") + f"（{cnt} か所）"))

    # R9: version
    dsl_version = (env.get("dify") or {}).get("dsl_version")
    if dsl_version and out.get("version") != dsl_version:
        rows.append(("R9", "version", str(out.get("version")), str(dsl_version)))
        out["version"] = dsl_version

    return out, rows


def build_replace_table(env_raw, env):
    """(word_table, masked_map) を返す。masked は env.yml 側の `to` が ${VAR} 由来かどうか（raw を見る）。"""
    raw_items = ((env_raw.get("brand") or {}).get("replace")) or []
    expanded_items = ((env.get("brand") or {}).get("replace")) or []
    table, masked = [], {}
    for i, item in enumerate(raw_items):
        frm = item.get("from")
        to_raw = item.get("to")
        if not frm or to_raw is None:
            continue
        to_expanded = expanded_items[i].get("to") if i < len(expanded_items) else to_raw
        table.append((frm, to_expanded))
        masked[frm] = isinstance(to_raw, str) and "${" in to_raw
    return table, masked


# ---------------------------------------------------------------------------
# 出力（恒等性：意味的に同一ならマスタの生バイトをそのままコピー）
# ---------------------------------------------------------------------------

def extract_header(raw_text):
    lines = raw_text.splitlines(keepends=True)
    header = []
    for line in lines:
        if line.startswith("#"):
            header.append(line)
        else:
            break
    return "".join(header)


def dump_with_header(data, raw_text, env_name):
    header = extract_header(raw_text)
    banner = (
        f"# ---- render.py: env={env_name}, "
        f"generated={dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}, "
        f"render_version={RENDER_VERSION} ----\n"
    )
    body = yaml.safe_dump(data, sort_keys=False, allow_unicode=True, default_flow_style=False, width=4096)
    return header + banner + body


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def target_files(codes, all_flag):
    all_files = sorted(glob.glob(os.path.join(APPS_DIR, "*.yml")))
    if all_flag:
        return all_files
    out = []
    for code in codes:
        code = code.upper()
        matches = [f for f in all_files if os.path.basename(f).startswith(code + "-")]
        if not matches:
            log(f"アプリが見つかりません: {code}（dify/apps/{code}-*.yml）")
            sys.exit(2)
        out.extend(matches)
    return out


def code_of(path):
    base = os.path.basename(path)
    return base.split("-", 2)[0] + "-" + base.split("-", 2)[1] if "-" in base else base


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("codes", nargs="*", help="管理番号（例 KN-01 DC-01）。--all と併用不可")
    ap.add_argument("--env", required=True, help="dify/env/<env>/env.yml")
    ap.add_argument("--all", action="store_true", help="dify/apps/*.yml すべて")
    ap.add_argument("--strict", action="store_true", help="${VAR} 未定義・schema 不正等で exit 1")
    ap.add_argument("--out", default=os.path.join("dify", "build"), help="出力先（既定 dify/build）")
    ap.add_argument("--check", action="store_true", help="書き込まず、マスタとのバイト一致だけ確認して exit")
    ap.add_argument("--diff", action="store_true", help="置換レポートを標準出力にも表示")
    args = ap.parse_args()

    env_path, env_raw = load_env_raw(args.env)
    if env_raw.get("name") != args.env:
        msg = f"env.yml の name={env_raw.get('name')!r} がディレクトリ名 {args.env!r} と不一致"
        if args.strict:
            log("ERROR: " + msg)
            sys.exit(1)
        log("WARN: " + msg)

    environ = dict(os.environ)
    env, env_masked, undefined, issues = expand_env(env_raw, environ)

    if undefined:
        names = ", ".join(sorted(undefined))
        if args.strict:
            log(f"ERROR: 未定義の環境変数（値は表示しません）: {names}")
            sys.exit(1)
        log(f"WARN: 未定義の環境変数（空文字として扱います）: {names}")

    for issue in issues:
        if args.strict:
            log("ERROR: " + issue)
        else:
            log("WARN: " + issue)
    if issues and args.strict:
        sys.exit(1)

    replace_table, replace_masked = build_replace_table(env_raw, env)

    files = target_files(args.codes, args.all)
    warnings = []
    all_rows = []
    out_dir = os.path.join(ROOT, args.out, args.env)
    check_fail = False

    for f in files:
        code = code_of(f)
        with open(f, encoding="utf-8") as fh:
            raw_text = fh.read()
        data = yaml.safe_load(raw_text)
        rendered, rows = render_app(code, data, env, env_masked, replace_table, replace_masked, args.strict, warnings)
        identical = rendered == data
        if identical:
            out_bytes = raw_text
        else:
            out_bytes = dump_with_header(rendered, raw_text, args.env)

        if args.check:
            master_bytes = raw_text  # 比較対象は常にそのマスタ自身
            if out_bytes == master_bytes:
                log(f"[OK]   {code}: マスタとバイト一致")
            else:
                log(f"[DIFF] {code}: マスタと不一致（--env {args.env} の想定どおりなら OK）")
                check_fail = True
        else:
            os.makedirs(out_dir, exist_ok=True)
            out_path = os.path.join(out_dir, os.path.basename(f))
            with open(out_path, "w", encoding="utf-8") as fh:
                fh.write(out_bytes)
            log(f"[WROTE] {os.path.relpath(out_path, ROOT)}" + (" (恒等)" if identical else ""))

        all_rows.extend((code, *row) for row in rows)

    for w in warnings:
        log("WARN: " + w)

    if args.check:
        sys.exit(1 if check_fail else 0)

    report_path = os.path.join(out_dir, "render-report.md")
    os.makedirs(out_dir, exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as fh:
        fh.write(f"# render-report — env={args.env}\n\n")
        fh.write(f"生成: {dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}\n\n")
        fh.write("| 番号 | ルール | パス | 変更前 | 変更後 |\n|---|---|---|---|---|\n")
        for code, rule, path, before, after in all_rows:
            fh.write(f"| {code} | {rule} | {path} | {before} | {after} |\n")
        if not all_rows:
            fh.write("| — | — | — | 変更なし（env の値がマスタと同一） | — |\n")
    log(f"[WROTE] {os.path.relpath(report_path, ROOT)}")

    if args.diff:
        log("\n置換レポート:")
        log("| 番号 | ルール | パス | 変更前 | 変更後 |")
        for code, rule, path, before, after in all_rows:
            log(f"| {code} | {rule} | {path} | {before} | {after} |")
        if not all_rows:
            log("（置換なし）")

    sys.exit(0)


if __name__ == "__main__":
    main()
