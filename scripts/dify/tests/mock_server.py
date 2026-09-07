#!/usr/bin/env python3
"""release.py / console_api.py / kb_upload.py / run_tests.py を **ネットワーク無しの砂箱で通す**ためのモック
Dify サーバー（標準ライブラリのみ。開発・検証用。CI には組み込まない）。

    python3 scripts/dify/tests/mock_server.py --port 8765

以下を返す：
  POST /console/api/login                                    → access_token
  POST /console/api/apps/imports                              → app_id（新規 or 上書き）
  GET  /console/api/apps                                       → 一覧
  POST /console/api/apps/{id}/workflows/publish                → 成功
  GET  /v1/datasets, POST /v1/datasets                         → KB 一覧・作成
  GET  /v1/datasets/{id}/documents                              → 空（毎回アップロード対象にする）
  POST /v1/datasets/{id}/document/create-by-file                → 成功（インデックス即完了）
  GET  /v1/datasets/{id}/documents/{batch}/indexing-status      → completed
  POST /v1/chat-messages, POST /v1/workflows/run                → dify/tests/<番号>.json の
      expect（配列は先頭の候補を採用）を連結した回答を返す。expect_not を含まないことを起動時に自己検査する。

このスクリプトは検証専用。生成物（dify/results/** や dify/CHANGELOG.md の検証行）はコミットに含めない。
"""
import argparse
import glob
import http.server
import json
import os
import re
import sys
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
TESTS_DIR = os.path.join(ROOT, "dify", "tests")


def build_canned_answers():
    """dify/tests/*.json を読み、各ケースの expect を満たし expect_not を含まない回答文を作る。
    戻り値: {"by_query": {query: answer}, "by_kpi_notes": {kpi_notes: answer}}"""
    by_query, by_kpi = {}, {}
    for path in sorted(glob.glob(os.path.join(TESTS_DIR, "*.json"))):
        with open(path, encoding="utf-8") as fh:
            suite = json.load(fh)
        for c in suite.get("cases", []):
            parts = []
            for item in c.get("expect", []):
                parts.append(item[0] if isinstance(item, list) else item)
            answer = " ".join(parts) if parts else "OK"
            for forbidden in c.get("expect_not", []):
                if forbidden in answer:
                    raise SystemExit(f"mock_server: 生成回答に禁止語が混入: {c.get('id')} -> {forbidden!r}")
            if c.get("query"):
                by_query[c["query"]] = answer
            kpi = (c.get("inputs") or {}).get("kpi_notes")
            if kpi:
                by_kpi[kpi] = answer
    return {"by_query": by_query, "by_kpi_notes": by_kpi}


ANSWERS = build_canned_answers()
STATE = {"apps": {}, "datasets": {}, "next_app": 1, "next_ds": 1, "next_doc": 1}
LOCK = threading.Lock()


def app_name_from_yaml(text):
    in_app = False
    for line in text.splitlines():
        if line.startswith("app:"):
            in_app = True
            continue
        if in_app and not line.startswith(" "):
            break
        m = re.match(r"^  name:\s*(.+?)\s*$", line) if in_app else None
        if m:
            return m.group(1).strip().strip("'\"")
    return None


class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("[mock] " + (fmt % args) + "\n")

    def _body(self):
        length = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(length) if length else b""

    def _json(self, status, obj):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _path(self):
        return self.path.split("?", 1)[0]

    # -- Console API ------------------------------------------------
    def do_POST(self):
        path = self._path()
        body = self._body()
        try:
            payload = json.loads(body) if body and not path.endswith("document/create-by-file") else {}
        except Exception:
            payload = {}

        if path == "/console/api/login":
            return self._json(200, {"result": "success", "data": {"access_token": "mock-token", "refresh_token": "mock-refresh"}})

        if path == "/console/api/apps/imports":
            with LOCK:
                app_id = payload.get("app_id")
                name = app_name_from_yaml(payload.get("yaml_content") or "") or "unnamed"
                if not app_id:
                    app_id = f"app-{STATE['next_app']}"
                    STATE["next_app"] += 1
                STATE["apps"][app_id] = name
            return self._json(200, {"id": f"imp-{app_id}", "status": "completed", "app_id": app_id, "app_mode": "workflow"})

        if re.match(r"^/console/api/apps/[^/]+/workflows/publish$", path):
            return self._json(200, {"result": "success"})

        if path == "/v1/datasets":
            with LOCK:
                name = payload.get("name")
                ds_id = f"ds-{STATE['next_ds']}"
                STATE["next_ds"] += 1
                STATE["datasets"][ds_id] = {"name": name, "documents": []}
            return self._json(200, {"id": ds_id, "name": name})

        if path.endswith("/document/create-by-file"):
            m = re.match(r"^/v1/datasets/([^/]+)/document/create-by-file$", path)
            ds_id = m.group(1) if m else "ds-unknown"
            with LOCK:
                doc_id = f"doc-{STATE['next_doc']}"
                STATE["next_doc"] += 1
                STATE.setdefault("datasets", {}).setdefault(ds_id, {"name": ds_id, "documents": []})
                STATE["datasets"][ds_id]["documents"].append(doc_id)
            return self._json(200, {"document": {"id": doc_id, "indexing_status": "completed"}, "batch": f"batch-{doc_id}"})

        if path == "/v1/chat-messages":
            query = payload.get("query", "")
            answer = ANSWERS["by_query"].get(query, "該当する記録が見つかりません")
            return self._json(200, {"answer": answer})

        if path == "/v1/workflows/run":
            kpi = (payload.get("inputs") or {}).get("kpi_notes", "")
            answer = ANSWERS["by_kpi_notes"].get(kpi, "入力してください")
            return self._json(200, {"data": {"outputs": {"output": answer}}})

        return self._json(404, {"error": f"mock: unknown path {path}"})

    def do_GET(self):
        path = self._path()
        if path == "/console/api/apps":
            with LOCK:
                data = [{"id": k, "name": v} for k, v in STATE["apps"].items()]
            return self._json(200, {"data": data, "has_more": False})

        if path == "/v1/datasets":
            with LOCK:
                data = [{"id": k, "name": v["name"]} for k, v in STATE["datasets"].items()]
            return self._json(200, {"data": data, "has_more": False})

        m = re.match(r"^/v1/datasets/([^/]+)/documents$", path)
        if m:
            return self._json(200, {"data": [], "has_more": False})

        m = re.match(r"^/v1/datasets/([^/]+)/documents/([^/]+)/indexing-status$", path)
        if m:
            return self._json(200, {"data": [{"indexing_status": "completed", "completed_segments": 1, "total_segments": 1, "error": None}]})

        return self._json(404, {"error": f"mock: unknown path {path}"})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=8765)
    args = ap.parse_args()
    server = http.server.HTTPServer(("127.0.0.1", args.port), Handler)
    print(f"[mock] listening on http://127.0.0.1:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
