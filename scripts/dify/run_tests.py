#!/usr/bin/env python3
"""dify/tests/<管理番号>.json のテストを Dify Service API で実行し、結果を dify/results/<env>/ に Markdown で書く。

    python3 scripts/dify/run_tests.py KN-01 DC-01                    # 既定 env=cloud-master
    python3 scripts/dify/run_tests.py --env customer-a KN-01 DC-01
    python3 scripts/dify/run_tests.py --dry-run KN-01   # API を呼ばず JSON の形だけ検証

環境変数
  DIFY_APP_KEY_<番号のハイフン無し>  例 DIFY_APP_KEY_KN01（アプリの Service API キー。ログに出さない）
  DIFY_BASE_URL                     未設定時は dify/env/<env>/env.yml の dify.base_url を使う（既定 https://api.dify.ai/v1）
  DIFY_ENV                          --env 未指定時の既定（さらに未指定なら cloud-master）

--env <env>
  接続先は dify/env/<env>/env.yml の dify.base_url（${VAR} はプロセス環境変数で展開）。
  env.yml が無い、または展開結果が空（${VAR} 未定義）なら DIFY_BASE_URL（無ければ既定 URL）にフォールバックする。
  結果の出力先は dify/results/<env>/。

テスト JSON の形（1 件）
  {"id": "KN-01 T01", "kind": "正常 ja", "mode": "chat" | "workflow",
   "inputs": {...}, "query": "...",
   "expect":     ["含まれるべき語", ["どれか 1 つ含まれればよい語", "..."]],
   "expect_not": ["含まれてはいけない語"]}
chat は POST /chat-messages（blocking）、workflow は POST /workflows/run（blocking）。
失敗しても全件実行し、最後に合否を集計する。終了コード: 全件合格 0 / 不合格あり 1 / 設定不備 2
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TESTS_DIR = os.path.join(ROOT, "dify", "tests")
RESULTS_DIR = os.path.join(ROOT, "dify", "results")
ENV_DIR = os.path.join(ROOT, "dify", "env")
VAR_RE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")
DEFAULT_BASE_URL = "https://api.dify.ai/v1"


def env_key_name(code):
    return "DIFY_APP_KEY_" + re.sub(r"[^A-Za-z0-9]", "", code).upper()


def expand(s):
    if not isinstance(s, str) or "${" not in s:
        return s
    return VAR_RE.sub(lambda m: os.environ.get(m.group(1), ""), s)


def resolve_base_url(env_name):
    """dify/env/<env>/env.yml の dify.base_url（${VAR} 展開）。無い／空なら DIFY_BASE_URL か既定 URL。"""
    if yaml is not None:
        path = os.path.join(ENV_DIR, env_name, "env.yml")
        if os.path.isfile(path):
            with open(path, encoding="utf-8") as fh:
                env = yaml.safe_load(fh) or {}
            base = expand(((env.get("dify") or {}).get("base_url") or "").strip())
            if base:
                return base
    return os.environ.get("DIFY_BASE_URL", DEFAULT_BASE_URL).strip()


def call(base, key, path, body, timeout):
    req = urllib.request.Request(
        base.rstrip("/") + path,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode("utf-8", "replace")[:800]}
    except urllib.error.URLError as e:
        return 0, {"error": f"接続失敗: {e.reason}"}
    except (TimeoutError, OSError) as e:
        return 0, {"error": f"タイムアウト/通信エラー: {e}"}


def extract_output(mode, res):
    if mode == "chat":
        return res.get("answer") or ""
    data = res.get("data") or {}
    outputs = data.get("outputs") or {}
    if isinstance(outputs, dict):
        if "output" in outputs and isinstance(outputs["output"], str):
            return outputs["output"]
        return "\n".join(v if isinstance(v, str) else json.dumps(v, ensure_ascii=False) for v in outputs.values())
    return json.dumps(outputs, ensure_ascii=False)


def judge(out, expect, expect_not):
    missing, hit = [], 0
    for item in expect:
        alts = item if isinstance(item, list) else [item]
        if any(a in out for a in alts):
            hit += 1
        else:
            missing.append(" / ".join(alts))
    forbidden = [w for w in expect_not if w in out]
    return hit, missing, forbidden


def cell(s, limit=160):
    s = (s or "").replace("|", "\\|").replace("\n", " ")
    return s if len(s) <= limit else s[:limit] + "…"


def run_suite(code, base, timeout, dry, results_dir):
    path = os.path.join(TESTS_DIR, f"{code}.json")
    if not os.path.exists(path):
        print(f"テスト定義がありません: {os.path.relpath(path, ROOT)}")
        return None
    with open(path, encoding="utf-8") as fh:
        suite = json.load(fh)
    cases = suite.get("cases") or []
    default_mode = suite.get("mode", "chat")

    key = os.environ.get(env_key_name(code), "").strip()
    if not dry and not key:
        print(f"環境変数 {env_key_name(code)} が未設定です（{code} の Service API キー）。dify/DEPLOY.md を参照。")
        return None

    rows, passed = [], 0
    for c in cases:
        mode = c.get("mode", default_mode)
        cid = c.get("id", "?")
        if dry:
            ok = mode in ("chat", "workflow") and isinstance(c.get("expect", []), list)
            rows.append((cid, c.get("kind", ""), c.get("query") or json.dumps(c.get("inputs", {}), ensure_ascii=False),
                         "(dry-run)", f"{len(c.get('expect', []))} 語", "", 0.0, "OK" if ok else "NG"))
            passed += 1 if ok else 0
            continue
        t0 = time.time()
        if mode == "chat":
            status, res = call(base, key, "/chat-messages",
                               {"inputs": c.get("inputs") or {}, "query": c.get("query", ""),
                                "response_mode": "blocking", "user": "dify-tests"}, timeout)
        else:
            status, res = call(base, key, "/workflows/run",
                               {"inputs": c.get("inputs") or {}, "response_mode": "blocking", "user": "dify-tests"}, timeout)
        sec = time.time() - t0
        if status != 200:
            out = f"HTTP {status}: {res.get('error') or json.dumps(res, ensure_ascii=False)[:800]}"
            rows.append((cid, c.get("kind", ""), c.get("query") or json.dumps(c.get("inputs", {}), ensure_ascii=False),
                         out, "—", "—", sec, "ERROR"))
            print(f"  {cid}: ERROR {out[:120]}")
            continue
        out = extract_output(mode, res)
        hit, missing, forbidden = judge(out, c.get("expect", []), c.get("expect_not", []))
        ok = not missing and not forbidden
        passed += 1 if ok else 0
        rows.append((cid, c.get("kind", ""), c.get("query") or json.dumps(c.get("inputs", {}), ensure_ascii=False),
                     out, f"{hit}/{len(c.get('expect', []))}" + (f"（不足: {'; '.join(missing)}）" if missing else ""),
                     ("検出: " + ", ".join(forbidden)) if forbidden else "なし", sec, "PASS" if ok else "FAIL"))
        print(f"  {cid}: {'PASS' if ok else 'FAIL'} ({sec:.1f}s) 期待語 {hit}/{len(c.get('expect', []))}"
              + (f" 不足={missing}" if missing else "") + (f" 禁止語={forbidden}" if forbidden else ""))

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M")
    os.makedirs(results_dir, exist_ok=True)
    out_path = os.path.join(results_dir, f"{code}-{stamp}{'-dryrun' if dry else ''}.md")
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(f"# {code} テスト結果 {dt.datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n")
        fh.write(f"- 定義: `dify/tests/{code}.json`（{suite.get('source', '')}）\n")
        fh.write(f"- 接続先: `{base}`{'（dry-run: API 未呼び出し）' if dry else ''}\n")
        fh.write(f"- 合否: **{passed} / {len(cases)} 合格**\n\n")
        fh.write("| ID | 種別 | 入力 | 出力（先頭） | 期待語の一致 | 禁止語 | 所要秒 | 判定 |\n|---|---|---|---|---|---|---|---|\n")
        for r in rows:
            fh.write(f"| {r[0]} | {r[1]} | {cell(r[2], 80)} | {cell(r[3])} | {cell(r[4], 120)} | {cell(r[5], 60)} | {r[6]:.1f} | {r[7]} |\n")
        fh.write("\n## 出力全文\n")
        for r in rows:
            fh.write(f"\n### {r[0]}（{r[7]}）\n\n入力:\n\n```\n{r[2]}\n```\n\n出力:\n\n```\n{r[3]}\n```\n")
    print(f"結果: {os.path.relpath(out_path, ROOT)}  合格 {passed}/{len(cases)}")
    return passed, len(cases)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("codes", nargs="+", help="管理番号（例 KN-01 DC-01）")
    ap.add_argument("--env", default=os.environ.get("DIFY_ENV", "cloud-master"),
                     help="dify/env/<env>/env.yml の dify.base_url を接続先に使う（既定 $DIFY_ENV または cloud-master）")
    ap.add_argument("--timeout", type=int, default=180, help="1 件あたりの API タイムアウト秒（既定 180）")
    ap.add_argument("--dry-run", action="store_true", help="API を呼ばず JSON の形だけ検証")
    args = ap.parse_args()
    env_name = args.env
    base = resolve_base_url(env_name)
    results_dir = os.path.join(RESULTS_DIR, env_name)

    total_pass = total = 0
    config_error = False
    for code in args.codes:
        code = code.upper()
        print(f"== {code} ==")
        r = run_suite(code, base, args.timeout, args.dry_run, results_dir)
        if r is None:
            config_error = True
            continue
        total_pass += r[0]
        total += r[1]
    print(f"\n合計: {total_pass} / {total} 合格")
    if config_error:
        return 2
    return 0 if total_pass == total else 1


if __name__ == "__main__":
    sys.exit(main())
