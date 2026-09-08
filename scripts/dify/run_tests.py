#!/usr/bin/env python3
"""dify/tests/<管理番号>.json のテストを Dify Service API で実行し、結果を dify/results/<env>/ に Markdown で書く。

    python3 scripts/dify/run_tests.py KN-01 DC-01                    # 既定 env=cloud-master・streaming 受信
    python3 scripts/dify/run_tests.py --env customer-a KN-01 DC-01
    python3 scripts/dify/run_tests.py --dry-run KN-01   # API を呼ばず JSON の形だけ検証
    python3 scripts/dify/run_tests.py --blocking KN-01  # 従来の blocking 受信（セルフホスト・504 の再現確認に使う）

環境変数
  DIFY_APP_KEY_<番号のハイフン無し>  例 DIFY_APP_KEY_KN01（アプリの Service API キー。ログに出さない）
  DIFY_BASE_URL                     未設定時は dify/env/<env>/env.yml の dify.base_url を使う（既定 https://api.dify.ai/v1）
  DIFY_ENV                          --env 未指定時の既定（さらに未指定なら cloud-master）

接続先の優先順位: --base-url > dify/env/<env>/env.yml の dify.base_url > DIFY_BASE_URL > 既定 https://api.dify.ai/v1

--env <env>
  接続先は dify/env/<env>/env.yml の dify.base_url（${VAR} はプロセス環境変数で展開）。
  env.yml が無い、または展開結果が空（${VAR} 未定義）なら DIFY_BASE_URL（無ければ既定 URL）にフォールバックする。
  結果の出力先は <--out（既定 dify/results）>/<env>/。

受信モード
  既定は response_mode: "streaming"。Dify Cloud の Service API 前段が blocking を 120 秒前後で
  HTTP 504 にすることがあるため（DI-010）、SSE を読んで answer / outputs を組み立てる。
  --blocking を付けると従来どおり response_mode: "blocking" の 1 発 POST → JSON で受ける
  （セルフホストや、504 の再現確認用の退避経路）。

テスト JSON の形（1 件）
  {"id": "KN-01 T01", "kind": "正常 ja", "mode": "chat" | "workflow",
   "inputs": {...}, "query": "...",
   "expect":     ["含まれるべき語", ["どれか 1 つ含まれればよい語", "..."]],
   "expect_not": ["含まれてはいけない語"]}
chat は POST /chat-messages、workflow は POST /workflows/run。
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

from lang_check import judge_lang  # 同ディレクトリ。sys.path はスクリプト自身の場所で解決される

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
DEFAULT_TIMEOUT = 600
USER_AGENT = "dify-scripts/1.0 (+https://github.com/shoulang0729/dify)"  # Cloudflare が Python-urllib 既定 UA を 403 (1010) で弾くため


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
    """blocking 受信。1 発の POST → JSON。戻り値: (status, res_dict)"""
    req = urllib.request.Request(
        base.rstrip("/") + path,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json", "User-Agent": USER_AGENT},
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


def call_streaming(base, key, path, body, timeout, mode, t0):
    """streaming 受信（SSE）。戻り値: (status, out, tokens, error)
    status == 200 かつ error is None なら成功。tokens は取れなければ None。
    t0 は呼び出し開始時刻（--timeout を超えたら打ち切る全体タイムアウトの基準）。
    """
    body = dict(body)
    body["response_mode"] = "streaming"
    req = urllib.request.Request(
        base.rstrip("/") + path,
        data=json.dumps(body, ensure_ascii=False).encode("utf-8"),
        method="POST",
        headers={
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "Accept": "text/event-stream",
            "User-Agent": USER_AGENT,
        },
    )
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
    except urllib.error.HTTPError as e:
        return e.code, "", None, e.read().decode("utf-8", "replace")[:800]
    except urllib.error.URLError as e:
        return 0, "", None, f"接続失敗: {e.reason}"
    except (TimeoutError, OSError) as e:
        return 0, "", None, f"タイムアウト/通信エラー: {e}"

    try:
        content_type = resp.headers.get("Content-Type", "") or ""
        if "text/event-stream" not in content_type:
            # 後方互換：SSE でない応答（古い mock・blocking しか返さない実装）は本文全体を JSON として読む
            try:
                res = json.loads(resp.read() or b"{}")
            except Exception as e:
                return 0, "", None, f"JSON 解析失敗: {e}"
            return 200, extract_output(mode, res), None, None

        answer_parts, fallback_parts = [], []
        tokens = None
        for raw_line in resp:
            if time.time() - t0 > timeout:
                return 0, "", tokens, f"タイムアウト（streaming、{timeout} 秒）"
            try:
                line = raw_line.decode("utf-8", "replace").rstrip("\r\n")
            except Exception:
                continue  # パース失敗行は握りつぶす
            if not line.startswith("data:"):
                continue  # event: 行・コメント行・空行はここで無視
            payload = line[len("data:"):].strip()
            if not payload:
                continue
            try:
                obj = json.loads(payload)
            except Exception:
                continue  # JSON パース失敗は握りつぶす

            event = obj.get("event")
            if event in ("message", "agent_message"):
                answer_parts.append(obj.get("answer") or "")
            elif event == "message_replace":
                answer_parts = [obj.get("answer") or ""]
            elif event == "message_end":
                tokens = ((obj.get("metadata") or {}).get("usage") or {}).get("total_tokens")
                return 200, "".join(answer_parts), tokens, None
            elif event == "text_chunk":
                fallback_parts.append(((obj.get("data") or {}).get("text")) or "")
            elif event == "workflow_finished":
                data = obj.get("data") or {}
                tokens = data.get("total_tokens")
                if data.get("status") == "succeeded":
                    out = extract_output("workflow", {"data": {"outputs": data.get("outputs") or {}}})
                    if not out and fallback_parts:
                        out = "".join(fallback_parts)
                    return 200, out, tokens, None
                return 0, "", tokens, data.get("error") or "workflow が succeeded 以外で終了"
            elif event == "error":
                return 0, "", tokens, obj.get("message") or json.dumps(obj, ensure_ascii=False)[:400]
            else:
                continue  # ping・未知イベントは無視

        # ループが正常終了イベント無しで終わった（接続が閉じた）
        if mode == "chat" and answer_parts:
            return 200, "".join(answer_parts), tokens, None
        if fallback_parts:
            return 200, "".join(fallback_parts), tokens, None
        return 0, "", tokens, "終了イベント（message_end / workflow_finished）を受信せずに接続が終了した"
    finally:
        resp.close()


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


def check_lang_schema(c):
    """§4-4 のスキーマ検査（--dry-run 用）。expect_lang の欠落・値域外・
    mixed/none なのに lang_note が空、を NG にする。戻り値: (ok: bool, detail: str)"""
    lang = c.get("expect_lang")
    if lang not in ("ja", "zh", "mixed", "none"):
        return False, f"expect_lang が不正または欠落（{lang!r}）"
    if lang in ("mixed", "none"):
        note = c.get("lang_note")
        if not isinstance(note, str) or not note.strip():
            return False, f"expect_lang={lang} には lang_note が必須"
    allow = c.get("lang_allow", []) or []
    if not isinstance(allow, list) or not all(isinstance(x, str) for x in allow):
        return False, "lang_allow は文字列の配列であること"
    return True, "OK"


def cell(s, limit=160):
    s = (s or "").replace("|", "\\|").replace("\n", " ")
    return s if len(s) <= limit else s[:limit] + "…"


def run_suite(code, base, timeout, dry, blocking, results_dir):
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
            lang_schema_ok, lang_schema_detail = check_lang_schema(c)
            ok = mode in ("chat", "workflow") and isinstance(c.get("expect", []), list) and lang_schema_ok
            lang_cell = "(dry-run)" if lang_schema_ok else f"NG: {lang_schema_detail}"
            rows.append((cid, c.get("kind", ""), c.get("query") or json.dumps(c.get("inputs", {}), ensure_ascii=False),
                         "(dry-run)", f"{len(c.get('expect', []))} 語", "", lang_cell, 0.0, "—", "OK" if ok else "NG"))
            passed += 1 if ok else 0
            continue

        t0 = time.time()
        tokens = None
        if blocking:
            if mode == "chat":
                status, res = call(base, key, "/chat-messages",
                                   {"inputs": c.get("inputs") or {}, "query": c.get("query", ""),
                                    "response_mode": "blocking", "user": "dify-tests"}, timeout)
            else:
                status, res = call(base, key, "/workflows/run",
                                   {"inputs": c.get("inputs") or {}, "response_mode": "blocking", "user": "dify-tests"}, timeout)
            sec = time.time() - t0
            if status != 200:
                err = res.get("error") or json.dumps(res, ensure_ascii=False)[:800]
                out, error = "", f"HTTP {status}: {err}"
            else:
                out, error = extract_output(mode, res), None
        else:
            if mode == "chat":
                status, out, tokens, error = call_streaming(
                    base, key, "/chat-messages",
                    {"inputs": c.get("inputs") or {}, "query": c.get("query", ""), "user": "dify-tests"},
                    timeout, mode, t0)
            else:
                status, out, tokens, error = call_streaming(
                    base, key, "/workflows/run",
                    {"inputs": c.get("inputs") or {}, "user": "dify-tests"},
                    timeout, mode, t0)
            sec = time.time() - t0

        tokens_cell = str(tokens) if tokens is not None else "—"
        input_cell = c.get("query") or json.dumps(c.get("inputs", {}), ensure_ascii=False)
        if error:
            row_out = error
            rows.append((cid, c.get("kind", ""), input_cell, row_out, "—", "—", "—", sec, tokens_cell, "ERROR"))
            print(f"  {cid}: ERROR {row_out[:120]}")
            continue

        hit, missing, forbidden = judge(out, c.get("expect", []), c.get("expect_not", []))
        lang_ok, lang_detail = judge_lang(out, c.get("expect_lang"), c.get("lang_allow") or [])
        ok = not missing and not forbidden and lang_ok
        passed += 1 if ok else 0
        rows.append((cid, c.get("kind", ""), input_cell, out,
                     f"{hit}/{len(c.get('expect', []))}" + (f"（不足: {'; '.join(missing)}）" if missing else ""),
                     ("検出: " + ", ".join(forbidden)) if forbidden else "なし", lang_detail, sec, tokens_cell,
                     "PASS" if ok else "FAIL"))
        print(f"  {cid}: {'PASS' if ok else 'FAIL'} ({sec:.1f}s) 期待語 {hit}/{len(c.get('expect', []))}"
              + (f" 不足={missing}" if missing else "") + (f" 禁止語={forbidden}" if forbidden else "")
              + (f" 応答言語={lang_detail}" if not lang_ok else ""))

    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M")
    os.makedirs(results_dir, exist_ok=True)
    out_path = os.path.join(results_dir, f"{code}-{stamp}{'-dryrun' if dry else ''}.md")
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(f"# {code} テスト結果 {dt.datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n")
        fh.write(f"- 定義: `dify/tests/{code}.json`（{suite.get('source', '')}）\n")
        fh.write(f"- 接続先: `{base}`{'（dry-run: API 未呼び出し）' if dry else ''}\n")
        if not dry:
            fh.write(f"- 受信: {'blocking' if blocking else 'streaming'}\n")
        fh.write(f"- 合否: **{passed} / {len(cases)} 合格**\n\n")
        fh.write("| ID | 種別 | 入力 | 出力（先頭） | 期待語の一致 | 禁止語 | 応答言語 | 所要秒 | トークン | 判定 |\n"
                  "|---|---|---|---|---|---|---|---|---|---|\n")
        for r in rows:
            fh.write(f"| {r[0]} | {r[1]} | {cell(r[2], 80)} | {cell(r[3])} | {cell(r[4], 120)} | {cell(r[5], 60)} | {cell(r[6], 100)} | {r[7]:.1f} | {r[8]} | {r[9]} |\n")
        fh.write("\n## 出力全文\n")
        for r in rows:
            fh.write(f"\n### {r[0]}（{r[9]}）\n\n入力:\n\n```\n{r[2]}\n```\n\n出力:\n\n```\n{r[3]}\n```\n")
    print(f"結果: {os.path.relpath(out_path, ROOT)}  合格 {passed}/{len(cases)}")
    return passed, len(cases)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("codes", nargs="+", help="管理番号（例 KN-01 DC-01）")
    ap.add_argument("--env", default=os.environ.get("DIFY_ENV", "cloud-master"),
                     help="dify/env/<env>/env.yml の dify.base_url を接続先に使う（既定 $DIFY_ENV または cloud-master）")
    ap.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT,
                     help=f"1 件あたりの上限秒（既定 {DEFAULT_TIMEOUT}。streaming は受信全体の上限）")
    ap.add_argument("--dry-run", action="store_true", help="API を呼ばず JSON の形だけ検証")
    ap.add_argument("--blocking", action="store_true",
                     help="response_mode: blocking の従来経路を使う（既定は streaming）")
    ap.add_argument("--base-url", default=None,
                     help="接続先を直接指定する（dify/env/<env>/env.yml の dify.base_url より優先）")
    ap.add_argument("--out", default=None, help="結果の出力先ディレクトリ（既定 dify/results）")
    args = ap.parse_args()
    env_name = args.env
    base = args.base_url or resolve_base_url(env_name)
    results_dir = os.path.join(args.out or RESULTS_DIR, env_name)

    total_pass = total = 0
    config_error = False
    for code in args.codes:
        code = code.upper()
        print(f"== {code} ==")
        r = run_suite(code, base, args.timeout, args.dry_run, args.blocking, results_dir)
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
