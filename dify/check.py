#!/usr/bin/env python3
"""dify/apps/*.yml の構造チェック（PyYAML が必要: pip install pyyaml）。

確認すること
- version / kind / app.mode
- edges の source / target が nodes[].id に存在し、sourceType / targetType がノードの type と一致
- LLM ノードの prompt_template に system と user がある
- 変数参照 {{#xxx.yyy#}} の xxx が sys / context / 既存ノード id のいずれか。
  start ノードなら yyy が variables[].variable に、llm なら text、knowledge-retrieval なら result に限る
- knowledge-retrieval の context 参照（LLM の context.variable_selector）が存在するノードを指す
- 参照 DSL（docs/dify/templates/*.yml）に無いキーの一覧（情報。Cloud の最新版で名称が変わっている可能性の目安）

使い方: python3 dify/check.py            # dify/apps/*.yml をすべて
        python3 dify/check.py path.yml  # 指定ファイルだけ
終了コード: エラーが 1 つでもあれば 1
"""
import glob
import os
import re
import sys

try:
    import yaml
except ImportError:  # pragma: no cover
    print("PyYAML がありません: pip install pyyaml")
    sys.exit(2)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF_GLOB = os.path.join(ROOT, "docs", "dify", "templates", "*.yml")
VAR_RE = re.compile(r"\{\{#([A-Za-z0-9_.\-]+)#\}\}")
NODE_OUTPUTS = {
    "llm": {"text", "usage", "finish_reason"},
    "knowledge-retrieval": {"result"},
    "document-extractor": {"text"},
}


def walk_keys(obj, acc):
    if isinstance(obj, dict):
        for k, v in obj.items():
            acc.add(str(k))
            walk_keys(v, acc)
    elif isinstance(obj, list):
        for v in obj:
            walk_keys(v, acc)


def walk_strings(obj):
    if isinstance(obj, dict):
        for v in obj.values():
            yield from walk_strings(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from walk_strings(v)
    elif isinstance(obj, str):
        yield obj


def ref_keys():
    acc = set()
    for f in glob.glob(REF_GLOB):
        with open(f, encoding="utf-8") as fh:
            try:
                walk_keys(yaml.safe_load(fh), acc)
            except yaml.YAMLError:
                pass
    return acc


def check(path, refkeys):
    errors, warns, infos = [], [], []
    with open(path, encoding="utf-8") as fh:
        try:
            d = yaml.safe_load(fh)
        except yaml.YAMLError as e:
            return [f"YAML parse error: {e}"], [], []

    if d.get("version") != "0.6.0":
        errors.append(f"version が 0.6.0 ではない: {d.get('version')!r}")
    if d.get("kind") != "app":
        errors.append(f"kind が app ではない: {d.get('kind')!r}")
    mode = (d.get("app") or {}).get("mode")
    if mode not in ("advanced-chat", "workflow"):
        errors.append(f"app.mode が想定外: {mode!r}")
    for k in ("name", "description", "icon", "icon_background"):
        if k not in (d.get("app") or {}):
            errors.append(f"app.{k} が無い")

    wf = d.get("workflow") or {}
    for k in ("features", "graph", "conversation_variables", "environment_variables"):
        if k not in wf:
            errors.append(f"workflow.{k} が無い")
    graph = wf.get("graph") or {}
    nodes = graph.get("nodes") or []
    edges = graph.get("edges") or []
    by_id = {}
    for n in nodes:
        nid = n.get("id")
        if not isinstance(nid, str):
            errors.append(f"node id が文字列でない: {nid!r}")
        if nid in by_id:
            errors.append(f"node id 重複: {nid}")
        by_id[nid] = n
        if n.get("type") != "custom":
            errors.append(f"node {nid}: type が custom でない")
        if "type" not in (n.get("data") or {}):
            errors.append(f"node {nid}: data.type が無い")

    types = [n["data"]["type"] for n in nodes if "type" in (n.get("data") or {})]
    if "start" not in types:
        errors.append("start ノードが無い")
    if mode == "advanced-chat" and "answer" not in types:
        errors.append("advanced-chat なのに answer ノードが無い")
    if mode == "workflow" and "end" not in types:
        errors.append("workflow なのに end ノードが無い")

    # edges
    edge_ids = set()
    for e in edges:
        eid = e.get("id")
        if eid in edge_ids:
            errors.append(f"edge id 重複: {eid}")
        edge_ids.add(eid)
        for side in ("source", "target"):
            if e.get(side) not in by_id:
                errors.append(f"edge {eid}: {side}={e.get(side)!r} が nodes に無い")
        data = e.get("data") or {}
        if e.get("source") in by_id and data.get("sourceType") != by_id[e["source"]]["data"]["type"]:
            errors.append(f"edge {eid}: sourceType {data.get('sourceType')!r} != {by_id[e['source']]['data']['type']!r}")
        if e.get("target") in by_id and data.get("targetType") != by_id[e["target"]]["data"]["type"]:
            errors.append(f"edge {eid}: targetType {data.get('targetType')!r} != {by_id[e['target']]['data']['type']!r}")
    # every non-start node must have an incoming edge; every non-terminal node an outgoing edge
    incoming = {e.get("target") for e in edges}
    outgoing = {e.get("source") for e in edges}
    for nid, n in by_id.items():
        t = n["data"]["type"]
        if t != "start" and nid not in incoming:
            errors.append(f"node {nid} ({t}): 入力エッジが無い")
        if t not in ("end", "answer") and nid not in outgoing:
            errors.append(f"node {nid} ({t}): 出力エッジが無い")

    # start variables
    start_vars = {}
    for n in nodes:
        if n["data"]["type"] == "start":
            for v in n["data"].get("variables") or []:
                start_vars[v.get("variable")] = v
                for k in ("label", "type", "required", "variable"):
                    if k not in v:
                        errors.append(f"start 変数 {v.get('variable')!r}: {k} が無い")
                if v.get("type") == "select" and not v.get("options"):
                    errors.append(f"start 変数 {v.get('variable')!r}: select なのに options が空")

    # LLM prompt roles / context / model
    for n in nodes:
        dt = n["data"]
        if dt["type"] == "llm":
            roles = [p.get("role") for p in dt.get("prompt_template") or []]
            if "system" not in roles:
                errors.append(f"llm {n['id']}: system プロンプトが無い")
            if "user" not in roles:
                errors.append(f"llm {n['id']}: user プロンプトが無い")
            m = dt.get("model") or {}
            for k in ("provider", "name", "mode", "completion_params"):
                if k not in m:
                    errors.append(f"llm {n['id']}: model.{k} が無い")
            ctx = dt.get("context") or {}
            if ctx.get("enabled"):
                sel = ctx.get("variable_selector") or []
                if len(sel) != 2 or sel[0] not in by_id:
                    errors.append(f"llm {n['id']}: context.variable_selector {sel!r} が不正")
                elif by_id[sel[0]]["data"]["type"] != "knowledge-retrieval" or sel[1] != "result":
                    warns.append(f"llm {n['id']}: context は knowledge-retrieval.result 以外を指している {sel!r}")
            else:
                texts = " ".join(p.get("text", "") for p in dt.get("prompt_template") or [])
                if "{{#context#}}" in texts:
                    errors.append(f"llm {n['id']}: context が無効なのに {{#context#}} を参照")
        if dt["type"] == "knowledge-retrieval":
            q = dt.get("query_variable_selector") or []
            if q != ["sys", "query"] and (len(q) != 2 or q[0] not in by_id):
                errors.append(f"knowledge-retrieval {n['id']}: query_variable_selector {q!r} が不正")
            if dt.get("retrieval_mode") not in ("single", "multiple"):
                errors.append(f"knowledge-retrieval {n['id']}: retrieval_mode が不正")
            if not dt.get("dataset_ids"):
                infos.append(f"knowledge-retrieval {n['id']}: dataset_ids が空（インポート後に UI で KB を紐づける）")
        if dt["type"] == "end":
            for o in dt.get("outputs") or []:
                sel = o.get("value_selector") or []
                if len(sel) != 2 or sel[0] not in by_id:
                    errors.append(f"end {n['id']}: value_selector {sel!r} が不正")
                elif sel[1] not in NODE_OUTPUTS.get(by_id[sel[0]]["data"]["type"], {sel[1]}):
                    errors.append(f"end {n['id']}: {sel[0]} に出力 {sel[1]!r} は無い")

    # variable references in all strings
    for s in walk_strings(graph):
        for ref in VAR_RE.findall(s):
            if ref == "context":
                continue
            head, _, rest = ref.partition(".")
            if head == "sys":
                if rest not in ("query", "files", "user_id", "conversation_id", "dialogue_count", "app_id", "workflow_id", "workflow_run_id"):
                    errors.append(f"変数参照 {{{{#{ref}#}}}}: sys.{rest} は未知")
                continue
            if head not in by_id:
                errors.append(f"変数参照 {{{{#{ref}#}}}}: ノード {head!r} が無い")
                continue
            t = by_id[head]["data"]["type"]
            if t == "start":
                if rest not in start_vars:
                    errors.append(f"変数参照 {{{{#{ref}#}}}}: start に変数 {rest!r} が無い")
            elif t in NODE_OUTPUTS and rest not in NODE_OUTPUTS[t]:
                errors.append(f"変数参照 {{{{#{ref}#}}}}: {t} に出力 {rest!r} は無い")

    # keys not present in reference DSLs (information only)
    mine = set()
    walk_keys(d, mine)
    novel = sorted(k for k in mine - refkeys)
    if novel:
        infos.append("参照 DSL に無いキー: " + ", ".join(novel))
    return errors, warns, infos


def main(argv):
    files = argv[1:] or sorted(glob.glob(os.path.join(ROOT, "dify", "apps", "*.yml")))
    refkeys = ref_keys()
    fail = False
    for f in files:
        errors, warns, infos = check(f, refkeys)
        status = "FAIL" if errors else "OK"
        print(f"[{status}] {os.path.relpath(f, ROOT)}")
        for e in errors:
            print("  ERROR:", e)
        for w in warns:
            print("  WARN :", w)
        for i in infos:
            print("  INFO :", i)
        fail = fail or bool(errors)
    return 1 if fail else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
