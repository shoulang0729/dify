#!/usr/bin/env python3
"""Dify Cloud で「DSL をエクスポート」して落としたファイルを正規化し、マスタ dify/apps/ に書き戻す。

    python3 scripts/dify/sync_back.py ~/Downloads/KN-01*.yml --env cloud-master
    python3 scripts/dify/sync_back.py ~/Downloads/KN-01*.yml --dry-run
    python3 scripts/dify/sync_back.py ~/Downloads/KN-01*.yml --code KN-01 --out /tmp/out

設計: docs/handoff/2026-09-07-china-models-and-syncback.md §3（章 B）

考え方：マスタは Git、Cloud は編集場所。Cloud の画面で直したプロンプト・ノードは、この道具で
正規化してからでないとマスタへ戻さない（環境固有の id・語彙・生成物由来のフィールドを持ち込まないため）。

正規化ルール（詳細は設計書 §3-3）
  N1 knowledge-retrieval の dataset_ids   → 常に []。env と一致した id は黙って除去、一致しない id は
                                             件数だけ warn（値はログに出さない）
  N2 brand.replace の語彙                 → env の replace を to → from の向きで逆適用（cloud-master は
                                             replace: [] なので実質 no-op）。逆写像が一意でないなら exit 1
  N3 version                              → env の dify.dsl_version に強制
  N4 dependencies                         → [] に戻す（Cloud の export はプラグイン識別子を詰めてくる）
  N5 モデル（llm / 分類器 の model・reranking_model） → 触らない。自己検証（S6）で env と食い違えば exit 1

それ以外（ノードの追加・削除・座標・プロンプト本文・変数・top_k・reranking_enable）はそのまま通す。
未知の付加フィールド（Cloud の版が増やしたキー）は v1 ではそのまま通し、差分要約に「マスタに無いキー」として列挙する。

実装方針：scripts/dify/render.py の load_env_raw / expand_env / build_replace_table（2 引数版）/ render_app /
extract_header を import して再利用する。置換ロジックを二重実装しない。ネットワークは一切呼ばない。

終了コード: 0 正常 / 1 正規化後に render --check 相当が通らない・逆置換が曖昧・モデルが env と食い違う / 2 引数・環境不備
"""
import argparse
import copy
import glob
import os
import re
import subprocess
import sys

try:
    import yaml
except ImportError:  # pragma: no cover
    print("PyYAML がありません: pip3 install pyyaml")
    sys.exit(2)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render  # noqa: E402  (scripts/dify/render.py。上の sys.path.insert が必要)

SUPPORTED_ENVS = ("cloud-master",)
CODE_IN_NAME_RE = re.compile(r"^([A-Z]{2}-\d{2})\b")
CODE_IN_FILE_RE = re.compile(r"^([A-Z]{2}-\d{2})-")


def log(msg):
    print(msg, flush=True)


# ---------------------------------------------------------------------------
# ダンパー（block scalar representer 付き。生成バナー行は入れない）
# ---------------------------------------------------------------------------

class MasterDumper(yaml.SafeDumper):
    """yaml.SafeDumper のサブクラス。add_representer はこのクラスだけに効く
    （render.py 側の yaml.safe_dump に影響しないよう、グローバルな SafeDumper は書き換えない）。"""


def _str_presenter(dumper, data):
    if "\n" in data:
        return dumper.represent_scalar("tag:yaml.org,2002:str", data, style="|")
    return dumper.represent_scalar("tag:yaml.org,2002:str", data)


MasterDumper.add_representer(str, _str_presenter)


def dump_master(data, master_raw_text):
    """マスタ先頭の # コメントブロックを保ち、複数行文字列は block scalar（|-）で出す。生成バナーは入れない。"""
    header = render.extract_header(master_raw_text)
    body = yaml.dump(
        data, Dumper=MasterDumper, sort_keys=False, allow_unicode=True,
        default_flow_style=False, width=4096,
    )
    return header + body


# ---------------------------------------------------------------------------
# S1: 管理番号の判定 / S2: 対応するマスタの特定
# ---------------------------------------------------------------------------

def determine_code(explicit_code, data, exported_path):
    if explicit_code:
        return explicit_code.strip().upper()
    name = ((data or {}).get("app") or {}).get("name") or ""
    m = CODE_IN_NAME_RE.match(name.strip())
    if m:
        return m.group(1)
    base = os.path.basename(exported_path)
    m2 = CODE_IN_FILE_RE.match(base)
    if m2:
        return m2.group(1)
    return None


def find_master(code):
    pattern = os.path.join(render.APPS_DIR, f"{code}-*.yml")
    return sorted(glob.glob(pattern))


# ---------------------------------------------------------------------------
# S3: 正規化（逆適用）
# ---------------------------------------------------------------------------

def workflow_nodes(data):
    graph = ((data.get("workflow") or {}).get("graph")) or {}
    return graph.get("nodes") or []


def normalize_dataset_ids(data, code, env):
    """N1。戻り値: (総件数, 未知件数)。dataset_ids は常に [] にする。値はログに出さない。"""
    known_ids = set()
    for logical, spec in (env.get("knowledge") or {}).items():
        if logical == code or logical.startswith(code + "/"):
            if spec.get("id"):
                known_ids.add(spec["id"])
    total = 0
    unknown = 0
    for n in workflow_nodes(data):
        d = n.get("data") or {}
        if d.get("type") != "knowledge-retrieval":
            continue
        ids = list(d.get("dataset_ids") or [])
        total += len(ids)
        unknown += sum(1 for i in ids if i not in known_ids)
        d["dataset_ids"] = []
    return total, unknown


def build_reverse_table(env_raw, env):
    """N2 用。env の replace を to → from に反転する。同じ to に複数の from があれば ambiguous に積む。"""
    forward, _ = render.build_replace_table(env_raw, env)
    reverse = {}
    ambiguous = set()
    for frm, to in forward:
        if not to:
            continue
        if to in reverse and reverse[to] != frm:
            ambiguous.add(to)
            continue
        reverse[to] = frm
    return reverse, ambiguous


def apply_reverse(text, reverse_map):
    if not isinstance(text, str) or not text:
        return text, 0
    hits = 0
    for to, frm in reverse_map.items():
        if to and to in text:
            hits += text.count(to)
            text = text.replace(to, frm)
    return text, hits


def normalize_brand(data, reverse_map):
    """N2。app.name/description・ノードの title/desc・llm の prompt_template[].text に逆適用する。"""
    hits_total = 0
    app = data.get("app") or {}
    for field in ("name", "description"):
        val = app.get(field, "")
        newval, hits = apply_reverse(val, reverse_map)
        if hits:
            app[field] = newval
            hits_total += hits

    for n in workflow_nodes(data):
        d = n.get("data") or {}
        for field in ("title", "desc"):
            val = d.get(field)
            if isinstance(val, str) and val:
                newval, hits = apply_reverse(val, reverse_map)
                if hits:
                    d[field] = newval
                    hits_total += hits
        if d.get("type") == "llm":
            for p in d.get("prompt_template") or []:
                text = p.get("text", "")
                newval, hits = apply_reverse(text, reverse_map)
                if hits:
                    p["text"] = newval
                    hits_total += hits
    return hits_total


def normalize_version(data, target_version):
    before = data.get("version")
    if target_version:
        data["version"] = target_version
    return before


def normalize_dependencies(data):
    before = list(data.get("dependencies") or [])
    data["dependencies"] = []
    return before


# ---------------------------------------------------------------------------
# S6: 自己検証（render_app が恒等になるか）
# ---------------------------------------------------------------------------

def self_verify(code, normalized, env, env_masked, replace_table, replace_masked):
    warnings = []
    rendered, rows = render.render_app(
        code, normalized, env, env_masked, replace_table, replace_masked, False, warnings,
    )
    identical = rendered == normalized
    rules = sorted({r[0] for r in rows}) if not identical else []
    return identical, rules, warnings, rendered


# ---------------------------------------------------------------------------
# 差分要約（S5）
# ---------------------------------------------------------------------------

def prompt_len(node_data, role):
    for p in node_data.get("prompt_template") or []:
        if p.get("role") == role:
            return len(p.get("text") or "")
    return None


def fmt_model_short(m):
    provider = (m or {}).get("provider", "")
    short = provider.split("/")[-1] if provider else ""
    return f"{short} {(m or {}).get('name', '')}".strip()


def extra_keys_vs_master(master_data, normalized):
    """マスタに無いキー（node.data 直下のみ、既存ノードを id で突き合わせる。簡易チェック）。"""
    master_nodes = {n.get("id"): n for n in workflow_nodes(master_data)}
    out = []
    for n in workflow_nodes(normalized):
        nid = n.get("id")
        mn = master_nodes.get(nid)
        if mn is None:
            continue
        d_keys = set((n.get("data") or {}).keys())
        m_keys = set((mn.get("data") or {}).keys())
        for k in sorted(d_keys - m_keys):
            title = (n.get("data") or {}).get("title", "")
            out.append(f"workflow.graph.nodes[data].{k}（node {nid!r} '{title}'）")
    return out


def fmt_completion_params(cp):
    cp = cp or {}
    if not cp:
        return "{}"
    return "{" + ", ".join(f"{k}={v}" for k, v in sorted(cp.items())) + "}"


def fmt_model_full(m):
    """モデル差分の表示用（fmt_model と違い completion_params まで出す。秘密ではなくパラメータなので隠さない）。"""
    m = m or {}
    return (f"provider={m.get('provider','')} name={m.get('name','')} mode={m.get('mode','')} "
            f"completion_params={fmt_completion_params(m.get('completion_params'))}")


def diff_model_lines(normalized, rendered):
    """DI-015: 自己検証（S6）が不一致のとき、モデル／completion_params の差をキーごとに
    「マスタ=… / export=…」で並べる（マスタ＝env が要求する値＝rendered 側、export＝Cloud から
    落ちてきたそのままの値＝normalized 側）。R1/R2（llm・分類器の model）と R3（Rerank）だけを見る。
    dataset id（R5）は値を出さない方針のまま（既存の件数表示のみ）。"""
    lines = []
    exp_nodes = {n.get("id"): n for n in workflow_nodes(normalized)}
    ren_nodes = {n.get("id"): n for n in workflow_nodes(rendered)}
    for nid, en in exp_nodes.items():
        rn = ren_nodes.get(nid)
        if rn is None:
            continue
        ed = en.get("data") or {}
        rd = rn.get("data") or {}
        t = ed.get("type")
        title = ed.get("title", "")

        if t in ("llm", "question-classifier", "parameter-extractor"):
            em = ed.get("model") or {}
            rm = rd.get("model") or {}
            if em != rm:
                lines.append(
                    f"  モデル差分: {t} '{title}'  マスタ={fmt_model_full(rm)} / export={fmt_model_full(em)}"
                )
                ecp = em.get("completion_params") or {}
                rcp = rm.get("completion_params") or {}
                for key in sorted(set(ecp) | set(rcp)):
                    ev, rv = ecp.get(key), rcp.get(key)
                    if ev != rv:
                        lines.append(f"    completion_params.{key}: マスタ={rv!r} / export={ev!r}")

        elif t == "knowledge-retrieval":
            emrc = ed.get("multiple_retrieval_config")
            rmrc = rd.get("multiple_retrieval_config")
            if emrc is not None and rmrc is not None:
                erm = emrc.get("reranking_model") or {}
                rrm = rmrc.get("reranking_model") or {}
                if erm != rrm or emrc.get("reranking_enable") != rmrc.get("reranking_enable"):
                    lines.append(
                        "  Rerank 差分: knowledge-retrieval '{}'  マスタ=provider={} name={} enable={} / "
                        "export=provider={} name={} enable={}".format(
                            title,
                            rrm.get("provider", ""), rrm.get("model", ""), rmrc.get("reranking_enable"),
                            erm.get("provider", ""), erm.get("model", ""), emrc.get("reranking_enable"),
                        )
                    )
    return lines


def build_summary(code, exported_path, env_name, master_data, normalized,
                   ds_total, ds_unknown, brand_hits, brand_note,
                   dep_before, ver_before, ver_after, extra_keys,
                   identical=True, rules=None, model_diff_lines=None):
    lines = []
    lines.append(f"sync_back: {code} ← {exported_path} (env={env_name})")

    before_nodes = {n.get("id"): n for n in workflow_nodes(master_data)}
    after_nodes = {n.get("id"): n for n in workflow_nodes(normalized)}
    added = [nid for nid in after_nodes if nid not in before_nodes]
    removed = [nid for nid in before_nodes if nid not in after_nodes]
    add_desc = "" if not added else "  +{} 追加: {}".format(
        len(added), ", ".join(f"{after_nodes[i].get('data', {}).get('type')} '{after_nodes[i].get('data', {}).get('title', '')}'" for i in added))
    rm_desc = "" if not removed else "  -{} 削除: {}".format(
        len(removed), ", ".join(f"{before_nodes[i].get('data', {}).get('type')} '{before_nodes[i].get('data', {}).get('title', '')}'" for i in removed))
    lines.append(f"  ノード: {len(before_nodes)} → {len(after_nodes)}{add_desc}{rm_desc}")

    for nid, n in after_nodes.items():
        d = n.get("data") or {}
        if d.get("type") == "llm":
            title = d.get("title", "")
            note = "(新規ノード)" if nid not in before_nodes else "(env と一致・変更なし)"
            lines.append(f"  モデル: llm '{title}' {fmt_model_short(d.get('model'))} {note}")

    for nid, n in after_nodes.items():
        if nid not in before_nodes:
            continue
        d = n.get("data") or {}
        bd = (before_nodes[nid].get("data") or {})
        if d.get("type") != "llm":
            continue
        title = d.get("title", "")
        for role in ("system", "user"):
            before_len = prompt_len(bd, role)
            after_len = prompt_len(d, role)
            if before_len is None and after_len is None:
                continue
            if before_len != after_len:
                delta = (after_len or 0) - (before_len or 0)
                sign = "+" if delta >= 0 else ""
                lines.append(f"  プロンプト: llm '{title}' {role} {before_len or 0:,} → {after_len or 0:,} 字 ({sign}{delta})")

    lines.append(f"  version: {ver_before} → {ver_after} (N3 で強制)  dependencies: {len(dep_before)} 件 → [] (N4)")
    if ds_unknown:
        ds_note = f"未知の id を {ds_unknown} 件除去（値は表示しません）"
    elif ds_total:
        ds_note = f"env の {code} と一致"
    else:
        ds_note = "変更なし"
    lines.append(f"  dataset_ids: {ds_total} 件 → [] (N1。{ds_note})")
    lines.append(f"  brand 逆置換: {brand_hits} 件 ({brand_note})")
    lines.append("  マスタに無いキー: " + ("、".join(extra_keys) if extra_keys else "なし"))
    if identical:
        lines.append(f"  [OK] render --env {env_name} --check 相当: 恒等（マスタとバイト一致）")
    else:
        lines.append(f"  差が出たルール: {', '.join(rules) if rules else '不明'}")
        for l in (model_diff_lines or []):
            lines.append(l)
        lines.append(f"  [NG] render --env {env_name} --check 相当: 不一致（上記のモデル／Rerank 差分を参照）")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# git status（warn のみ。止めない）
# ---------------------------------------------------------------------------

def warn_if_dirty(master_path):
    try:
        rel = os.path.relpath(master_path, render.ROOT)
        result = subprocess.run(
            ["git", "status", "--porcelain", rel], cwd=render.ROOT,
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0 and result.stdout.strip():
            log(f"WARN: {rel} に未コミットの変更があります（このまま上書きします）")
    except Exception:
        pass


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("exported", help="Dify の「DSL をエクスポート」で落としたファイル")
    ap.add_argument("--env", default="cloud-master", help="既定 cloud-master。v1 は cloud-master のみ対応")
    ap.add_argument("--code", help="管理番号を明示（自動判定を上書き）例: KN-01")
    ap.add_argument("--dry-run", action="store_true", help="書き込まない。差分要約だけを出す")
    ap.add_argument("--out", default=None, help="書き込み先ディレクトリ（既定 dify/apps）")
    args = ap.parse_args()

    if args.env not in SUPPORTED_ENVS:
        log(
            f"sync_back: --env {args.env} は v1 では非対応です（{'/'.join(SUPPORTED_ENVS)} のみ）。"
            "他 env の DSL には KB id・ブランド語彙・環境固有モデルが焼き込まれていて逆写像が一意にならないため、"
            "マスタへは戻せません。別のセルフホストへ展開するときは release.py --env <env> --all を使ってください。"
        )
        sys.exit(2)

    if not os.path.isfile(args.exported):
        log(f"sync_back: エクスポートファイルが見つかりません: {args.exported}")
        sys.exit(2)

    with open(args.exported, encoding="utf-8") as fh:
        exported_raw = fh.read()
    try:
        data = yaml.safe_load(exported_raw)
    except yaml.YAMLError as e:
        log(f"sync_back: YAML の読み込みに失敗しました: {e}")
        sys.exit(2)
    if not isinstance(data, dict):
        log("sync_back: エクスポートファイルの中身が DSL（dict）ではありません")
        sys.exit(2)

    code = determine_code(args.code, data, args.exported)
    if not code:
        log(
            "sync_back: 管理番号を判定できません（app.name の先頭にも、ファイル名の先頭にも "
            "`AB-99` の形が見つかりません）。--code KN-01 を付けて再実行してください。"
        )
        sys.exit(2)

    masters = find_master(code)
    if not masters:
        log(f"sync_back: {code} に対応するマスタが dify/apps/ にありません（新規アプリの初登録は対象外）")
        sys.exit(2)
    master_path = masters[0]
    master_basename = os.path.basename(master_path)
    with open(master_path, encoding="utf-8") as fh:
        master_raw_text = fh.read()
    master_data = yaml.safe_load(master_raw_text)

    env_path, env_raw = render.load_env_raw(args.env)
    environ = dict(os.environ)
    env, env_masked, undefined, issues = render.expand_env(env_raw, environ)
    if undefined:
        log(f"WARN: 未定義の環境変数（空文字として扱います）: {', '.join(sorted(undefined))}")
    for issue in issues:
        log("WARN: " + issue)
    replace_table, replace_masked = render.build_replace_table(env_raw, env)

    reverse_map, ambiguous = build_reverse_table(env_raw, env)
    if ambiguous:
        log(
            "sync_back: brand.replace の逆写像が一意になりません（同じ to に複数の from が対応）: "
            + ", ".join(sorted(ambiguous))
        )
        sys.exit(1)

    normalized = copy.deepcopy(data)
    dep_before = normalize_dependencies(normalized)
    ver_before = normalize_version(normalized, (env.get("dify") or {}).get("dsl_version"))
    ds_total, ds_unknown = normalize_dataset_ids(normalized, code, env)
    if ds_unknown:
        log(f"WARN: {code}: 未知の dataset id を {ds_unknown} 件除去しました（値は表示しません）")
    brand_hits = normalize_brand(normalized, reverse_map)
    brand_note = "cloud-master は replace 空" if not replace_table else (
        f"{brand_hits} 件を逆置換" if brand_hits else "一致なし"
    )

    identical, rules, verify_warnings, rendered = self_verify(
        code, normalized, env, env_masked, replace_table, replace_masked,
    )
    for w in verify_warnings:
        log("WARN: " + w)

    # DI-015: 差分要約は自己検証の合否に関わらず必ず先に出す（--dry-run でも通常実行でも）。
    extra_keys = extra_keys_vs_master(master_data, normalized)
    model_diff_lines = diff_model_lines(normalized, rendered) if not identical else []

    summary = build_summary(
        code, args.exported, args.env, master_data, normalized,
        ds_total, ds_unknown, brand_hits, brand_note,
        dep_before, ver_before, normalized.get("version"), extra_keys,
        identical=identical, rules=rules, model_diff_lines=model_diff_lines,
    )
    log(summary)

    if not identical:
        log(
            f"ERROR: sync_back: {code}: 正規化後も render --env {args.env} --check 相当が通りません "
            f"（差が出たルール: {', '.join(rules) if rules else '不明'}。詳細は上の要約を参照）。"
            "Cloud で人がモデルを変えていた場合は、dify/env/cloud-master/env.yml を直すか、"
            "Cloud 側を DSL の指定に戻すかを人が決めてください（CLAUDE.md §2-12）。sync_back はモデルを戻しません。"
        )
        sys.exit(1)

    if args.dry_run:
        log("  [DRY-RUN] 書き込みなし")
        sys.exit(0)

    out_dir = os.path.abspath(args.out) if args.out else render.APPS_DIR
    out_path = os.path.join(out_dir, master_basename)

    if os.path.abspath(out_dir) == os.path.abspath(render.APPS_DIR):
        warn_if_dirty(master_path)

    os.makedirs(out_dir, exist_ok=True)
    out_bytes = dump_master(normalized, master_raw_text)
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(out_bytes)
    log(f"  [WROTE] {os.path.relpath(out_path, render.ROOT) if out_path.startswith(render.ROOT) else out_path}")

    sys.exit(0)


if __name__ == "__main__":
    main()
