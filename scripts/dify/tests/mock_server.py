#!/usr/bin/env python3
"""release.py / console_api.py / kb_upload.py / run_tests.py を **ネットワーク無しの砂箱で通す**ためのモック
Dify サーバー（標準ライブラリのみ。開発・検証用。CI には組み込まない）。

    python3 scripts/dify/tests/mock_server.py --port 8765

以下を返す：
  POST /console/api/login                                    → access_token（認証不要）
  POST /console/api/apps/imports                              → app_id（新規 or 上書き）。
      yaml_content に "MOCK_FORCE_PENDING" を含めると status: pending を返し、
      続く POST …/imports/{id}/confirm で確定させる必要がある（Issue #114 C2・C3 の往復確認用）
  POST /console/api/apps/imports/{id}/confirm                  → pending だった import を確定
  GET  /console/api/apps                                       → 一覧
  POST /console/api/apps/{id}/workflows/publish                → 成功
  GET  /console/api/apps/{id}/workflows/draft                  → 下書き（無ければ空の既定値）
  POST /console/api/apps/{id}/workflows/draft                  → 下書きを保存して返す
  GET  /v1/datasets, POST /v1/datasets                         → KB 一覧・作成
  GET  /v1/datasets/{id}/documents                              → 空（毎回アップロード対象にする）
  POST /v1/datasets/{id}/document/create-by-file                → 成功（インデックス即完了）
  GET  /v1/datasets/{id}/documents/{batch}/indexing-status      → completed
  POST /v1/chat-messages, POST /v1/workflows/run                → dify/tests/<番号>.json の
      expect（配列は先頭の候補を採用）を連結した回答を返す。expect_not を含まないことを起動時に自己検査する。
      リクエスト body の response_mode が "streaming" のときは Content-Type: text/event-stream の
      SSE で返す（回答を 3 分割 ＋ ping 1 フレームを挟む）。それ以外（未指定・"blocking"）は今までどおり JSON。

**401 モード**：`/console/api/login` 以外の `console/api/*` は `Authorization: Bearer <token>` を要求する。
ヘッダが無い、または token が `"expired-token"` のときは 401（`{"code": "unauthorized", ...}`）を返す
（`console_api.ConsoleAuthError` の往復確認用。test_console_api.py が使う）。

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
STATE = {
    "apps": {}, "datasets": {}, "next_app": 1, "next_ds": 1, "next_doc": 1,
    "pending_imports": {}, "next_import": 1, "drafts": {},
}
LOCK = threading.Lock()
EXPIRED_TOKEN = "expired-token"  # DIFY_CONSOLE_TOKEN にこの値を入れると 401 を再現できる


def split_n(text, n):
    """text を n 個にほぼ均等分割する（連結処理を実際に通すため。空文字なら空要素を n 個返す）。"""
    length = len(text)
    if length == 0:
        return [""] * n
    step = max(1, -(-length // n))  # ceil(length / n)
    parts = [text[i:i + step] for i in range(0, length, step)]
    while len(parts) < n:
        parts.append("")
    return parts[:n]


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

    def _console_auth_ok(self):
        """/console/api/login 以外の console API が要求する Bearer 認証。無い・"expired-token" なら False。"""
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return False
        token = auth[len("Bearer "):]
        return bool(token) and token != EXPIRED_TOKEN

    def _unauthorized(self):
        return self._json(401, {"code": "unauthorized", "message": "Invalid or expired token."})

    def _sse(self, frames):
        """SSE で frames（dict の列）を data: 行として送る。HTTP/1.0 既定なので Content-Length 無しで書いて閉じる。"""
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        for frame in frames:
            self.wfile.write(("data: " + json.dumps(frame, ensure_ascii=False) + "\n\n").encode("utf-8"))
        self.wfile.flush()

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

        if path.startswith("/console/api/") and not self._console_auth_ok():
            return self._unauthorized()

        if path == "/console/api/apps/imports":
            with LOCK:
                app_id = payload.get("app_id")
                name = app_name_from_yaml(payload.get("yaml_content") or "") or "unnamed"
                if not app_id:
                    app_id = f"app-{STATE['next_app']}"
                    STATE["next_app"] += 1
                if "MOCK_FORCE_PENDING" in (payload.get("yaml_content") or ""):
                    import_id = f"imp-pending-{STATE['next_import']}"
                    STATE["next_import"] += 1
                    STATE["pending_imports"][import_id] = {"app_id": app_id, "name": name}
                    return self._json(200, {"id": import_id, "status": "pending", "app_id": app_id, "app_mode": "workflow"})
                STATE["apps"][app_id] = name
            return self._json(200, {"id": f"imp-{app_id}", "status": "completed", "app_id": app_id, "app_mode": "workflow"})

        m = re.match(r"^/console/api/apps/imports/([^/]+)/confirm$", path)
        if m:
            import_id = m.group(1)
            with LOCK:
                pending = STATE["pending_imports"].pop(import_id, None)
                if not pending:
                    return self._json(404, {"error": f"mock: unknown import_id {import_id}"})
                STATE["apps"][pending["app_id"]] = pending["name"]
            return self._json(200, {"app_id": pending["app_id"], "status": "completed"})

        if re.match(r"^/console/api/apps/[^/]+/workflows/publish$", path):
            return self._json(200, {"result": "success"})

        m = re.match(r"^/console/api/apps/([^/]+)/workflows/draft$", path)
        if m:
            app_id = m.group(1)
            with LOCK:
                STATE["drafts"][app_id] = payload
            return self._json(200, dict(payload, app_id=app_id, result="success"))

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
            if payload.get("response_mode") == "streaming":
                c1, c2, c3 = split_n(answer, 3)
                return self._sse([
                    {"event": "message", "task_id": "t1", "message_id": "m1", "conversation_id": "c1",
                     "answer": c1, "created_at": 0},
                    {"event": "ping"},
                    {"event": "message", "task_id": "t1", "message_id": "m1", "conversation_id": "c1",
                     "answer": c2, "created_at": 0},
                    {"event": "message", "task_id": "t1", "message_id": "m1", "conversation_id": "c1",
                     "answer": c3, "created_at": 0},
                    {"event": "message_end", "task_id": "t1", "id": "m1", "message_id": "m1", "conversation_id": "c1",
                     "metadata": {"usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30}}},
                ])
            return self._json(200, {"answer": answer})

        if path == "/v1/workflows/run":
            kpi = (payload.get("inputs") or {}).get("kpi_notes", "")
            answer = ANSWERS["by_kpi_notes"].get(kpi, "入力してください")
            if payload.get("response_mode") == "streaming":
                c1, c2 = split_n(answer, 2)
                return self._sse([
                    {"event": "workflow_started", "task_id": "t1", "workflow_run_id": "w1",
                     "data": {"id": "w1", "workflow_id": "wf1", "created_at": 0}},
                    {"event": "ping"},
                    {"event": "text_chunk", "task_id": "t1", "workflow_run_id": "w1",
                     "data": {"text": c1, "from_variable_selector": ["1", "text"]}},
                    {"event": "text_chunk", "task_id": "t1", "workflow_run_id": "w1",
                     "data": {"text": c2, "from_variable_selector": ["1", "text"]}},
                    {"event": "workflow_finished", "task_id": "t1", "workflow_run_id": "w1",
                     "data": {"id": "w1", "workflow_id": "wf1", "status": "succeeded",
                              "outputs": {"output": answer}, "error": None, "elapsed_time": 1.23,
                              "total_tokens": 45, "total_steps": 3, "created_at": 0, "finished_at": 1}},
                ])
            return self._json(200, {"data": {"outputs": {"output": answer}}})

        return self._json(404, {"error": f"mock: unknown path {path}"})

    def do_GET(self):
        path = self._path()
        if path.startswith("/console/api/") and not self._console_auth_ok():
            return self._unauthorized()

        if path == "/console/api/apps":
            with LOCK:
                data = [{"id": k, "name": v} for k, v in STATE["apps"].items()]
            return self._json(200, {"data": data, "has_more": False})

        m = re.match(r"^/console/api/apps/([^/]+)/workflows/draft$", path)
        if m:
            app_id = m.group(1)
            with LOCK:
                draft = STATE["drafts"].get(app_id) or {"graph": {"nodes": [], "edges": []}, "features": {}, "environment_variables": []}
            return self._json(200, dict(draft, app_id=app_id))

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
