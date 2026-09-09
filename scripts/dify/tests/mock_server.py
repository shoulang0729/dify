#!/usr/bin/env python3
"""release.py / console_api.py / kb_upload.py / run_tests.py を **ネットワーク無しの砂箱で通す**ためのモック
Dify サーバー（標準ライブラリのみ。開発・検証用。CI には組み込まない）。

    python3 scripts/dify/tests/mock_server.py --port 8765

以下を返す：
  POST /console/api/login                                    → access_token（認証不要）
  POST /console/api/apps/imports                              → app_id（新規 or 上書き）。
      yaml_content に "MOCK_FORCE_PENDING" を含めると status: pending を返し、
      続く POST …/imports/{id}/confirm で確定させる必要がある（Issue #114 C2・C3 の往復確認用）。
      app_id に "MOCK_FORCE_IMPORT_FAIL" を指定すると status: failed を返す（cloud_deploy.py の
      P1〔全件インポート成功後にまとめて公開〕を機械確認するため。Issue #121 W4-4）
  POST /console/api/apps/imports/{id}/confirm                  → pending だった import を確定
  GET  /console/api/apps                                       → 一覧
  POST /console/api/apps/{id}/workflows/publish                → 成功（呼ばれた回数を
      /__test__/stats の "publish" に記録。P1 の機械確認に使う）
  GET  /console/api/apps/{id}/workflows/draft                  → 下書き（無ければ空の既定値）
  POST /console/api/apps/{id}/workflows/draft                  → 下書きを保存して返す
  GET  /v1/datasets, POST /v1/datasets                         → KB 一覧・作成
  GET  /v1/datasets/{id}/documents                              → 実際にアップロード・更新された文書の
      id/name 一覧を返す（kb_upload.py の --refresh / --replace が同名突き合わせに使うため。Issue #121 W4-1）
  POST /v1/datasets/{id}/document/create-by-file                → 成功（インデックス即完了）。
      アップロードするファイル名に "MOCK_FAIL_UPLOAD" を含めると 500 を返す（T7 の再投入失敗を再現する用）
  PATCH /v1/datasets/{id}/documents/{document_id}                → 文書のファイル差し替え（削除しない。
      kb_upload.py --refresh が使う canonical エンドポイント）。同じ MOCK_FAIL_UPLOAD 規約で 500 を再現できる
  POST /v1/datasets/{id}/documents/{document_id}/update-by-text  → 文書の本文差し替え（削除しない。
      --refresh が PATCH の 404/405 を受けたときのフォールバック先）
  DELETE /v1/datasets/{id}/documents/{document_id}               → 204（kb_upload.py --replace が使う唯一の削除経路）
  GET  /v1/datasets/{id}/documents/{batch}/indexing-status      → completed
  POST /v1/chat-messages, POST /v1/workflows/run                → dify/tests/<番号>.json の
      expect（配列は先頭の候補を採用）を連結した回答を返す。expect_not を含まないことを起動時に自己検査する。
      リクエスト body の response_mode が "streaming" のときは Content-Type: text/event-stream の
      SSE で返す（回答を 3 分割 ＋ ping 1 フレームを挟む）。それ以外（未指定・"blocking"）は今までどおり JSON。

**401 モード（レガシー・Bearer-only）**：`/console/api/login` 以外の `console/api/*` は
`Authorization: Bearer <token>`（または Cookie の `access_token`）を要求する。無い、または token が
`"expired-token"` のときは 401（`{"code": "unauthorized", ...}`）を返す（`console_api.ConsoleAuthError`
の往復確認用。test_console_api.py が使う）。**`STATE["sessions"]` に登録されていないトークン**
（selfhost の `/login` が返す `mock-token` や `DIFY_CONSOLE_TOKEN` で直接 `set_token()` された値）は
この従来どおりの経路（CSRF 不要）。

**refresh-token 経由のセッション（Cloud 認証層。Issue #121 W4-3）**：
  POST /console/api/refresh-token                               → Cookie の refresh_token を検証し、
      成功すれば Set-Cookie ×3（access_token・csrf_token・refresh_token）を返す。無い／期限切れ
      （`EXPIRED_REFRESH_TOKEN`）／既に使用済みなら 401（G6）。**login_required でも CSRF 必須でもない**
      （S9 の再現。認証ヘッダ・Cookie 一切不要）。同じ値は 1 回しか使えない（rotate。S10 の再現）
  このフローで発行された access_token（`STATE["sessions"]` に登録される）を使う認証済みリクエストは、
      `X-CSRF-Token` ヘッダと Cookie の `csrf_token` の**両方**が、発行した csrf 値と一致しないと 401
      （G4 の再現）
  POST /__test__/expire-access-token  body: {"access_token": "..."}     → 指定した access_token を
      「期限切れ」として扱うようにする（60 分超えの mid-job 401 を時間を待たずに再現するテスト専用 API）
  POST /console/api/logout                                       → 認証済みの access_token（と、
      refresh-token 経由で発行されていれば対になる refresh_token）を無効化する（B3。Issue #121 W4-4）。
      未認証なら 401（他の console/api/* と同じ）。以後、同じ access_token での認証済みリクエストは
      すべて 401 になる

**テスト専用エンドポイント**（`/console/api/*` でも `/v1/*` でもないため、上記の認証は要らない）：
  GET  /__test__/stats                                          → {"DELETE": n, "PATCH": n, "update_by_text": n}
      test_kb_upload.py が「意図しない削除・更新を呼んでいないか」を差分で確認するためのカウンタ
  POST /__test__/expire-access-token                            → 上記参照（test_console_api.py 専用）

このスクリプトは検証専用。生成物（dify/results/** や dify/CHANGELOG.md の検証行）はコミットに含めない。
"""
import argparse
import base64
import glob
import http.server
import json
import os
import re
import sys
import threading
import time
import uuid

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
# datasets の要素: {"name": str, "documents": {doc_id: name}}（Issue #121 W4-1。id ⇄ name の突き合わせに使うため辞書にした）
STATE = {
    "apps": {}, "datasets": {}, "next_app": 1, "next_ds": 1, "next_doc": 1,
    "pending_imports": {}, "next_import": 1, "drafts": {},
    "calls": {"DELETE": 0, "PATCH": 0, "update_by_text": 0},  # /__test__/stats が返すカウンタ
    # Issue #121 W4-3: refresh-token 経由で発行したセッション。access_token -> csrf_token。
    # ここに登録されているトークンだけ CSRF 一致を要求する（レガシー Bearer-only との共存。G4）
    "sessions": {},
    "used_refresh_tokens": set(),   # 1 回使ったリフレッシュトークンの値（再利用させない。S10）
    "expired_access_tokens": set(),  # /__test__/expire-access-token で「期限切れ」にした access_token
    # Issue #121 W4-4: refresh-token 経由で発行した access_token -> その時点の refresh_token。
    # logout() が「対になる refresh_token」も一緒に無効化する（revoke_token_pair の再現。B3）ために使う。
    "access_to_refresh": {},
}
LOCK = threading.Lock()
EXPIRED_TOKEN = "expired-token"  # DIFY_CONSOLE_TOKEN にこの値を入れると 401 を再現できる（レガシー経路）
EXPIRED_REFRESH_TOKEN = "expired-refresh-token"  # refresh() にこの値を渡すと常に 401 を再現できる（G6）
MOCK_FORCE_IMPORT_FAIL = "MOCK_FORCE_IMPORT_FAIL"  # --app-id にこの値を渡すと import が status: failed になる（P1 検証用）
MOCK_FAIL_UPLOAD_MARKER = "MOCK_FAIL_UPLOAD"  # ファイル名に含めるとアップロード/更新が 500 で失敗する（T7 用）


def _parse_multipart(body, headers):
    """multipart/form-data の body から (fields, file_field, filename, content) を取り出す簡易パーサ。
    検証用途に限定（境界条件を厳密には扱わない）。"""
    ctype = headers.get("Content-Type", "")
    m = re.search(r"boundary=([^;]+)", ctype)
    if not m:
        return {}, None, None, b""
    boundary = m.group(1).strip().strip('"').encode("utf-8")
    fields, file_field, filename, content = {}, None, None, b""
    for raw_part in body.split(b"--" + boundary):
        part = raw_part.strip(b"\r\n")
        if not part or part == b"--":
            continue
        if b"\r\n\r\n" not in part:
            continue
        head, data = part.split(b"\r\n\r\n", 1)
        data = data[:-2] if data.endswith(b"\r\n") else data
        head_text = head.decode("utf-8", "replace")
        name_m = re.search(r'name="([^"]*)"', head_text)
        if not name_m:
            continue
        fname_m = re.search(r'filename="([^"]*)"', head_text)
        if fname_m:
            file_field, filename, content = name_m.group(1), fname_m.group(1), data
        else:
            fields[name_m.group(1)] = data.decode("utf-8", "replace")
    return fields, file_field, filename, content


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

    def _parse_cookie_header(self):
        """Cookie ヘッダを {name: value} に分解する簡易パーサ（検証用途に限定）。"""
        raw = self.headers.get("Cookie", "") or ""
        out = {}
        for part in raw.split(";"):
            part = part.strip()
            if "=" in part:
                k, v = part.split("=", 1)
                out[k.strip()] = v.strip()
        return out

    def _cookie_lookup(self, cookies, name_suffix):
        """__Host- プレフィックスの有無を問わず名前の末尾一致で拾う（console_api._cookie_value と同じ考え方）。"""
        for k, v in cookies.items():
            if k == name_suffix or k.endswith(name_suffix):
                return v
        return None

    def _extract_bearer(self):
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            return auth[len("Bearer "):]
        return None

    def _console_auth_ok(self):
        """console API の認証。Authorization: Bearer か Cookie の access_token のどちらかが要る
        （extract_access_token() の再現。S1）。`"expired-token"` は常に無効。
        `STATE["sessions"]` に登録されているトークン（refresh-token 経由）だけ、
        X-CSRF-Token ヘッダと Cookie の csrf_token の一致を追加で要求する（G4。Issue #121 W4-3）。
        登録されていないトークン（selfhost の /login・DIFY_CONSOLE_TOKEN 直指定）はレガシー扱いで
        CSRF 不要（従来どおり。後方互換）。"""
        cookies = self._parse_cookie_header()
        token = self._extract_bearer() or self._cookie_lookup(cookies, "access_token")
        if not token or token == EXPIRED_TOKEN:
            return False
        with LOCK:
            if token in STATE["expired_access_tokens"]:
                return False
            session_csrf = STATE["sessions"].get(token)
        if session_csrf is None:
            return True  # レガシー Bearer-only（selfhost の access_token・DIFY_CONSOLE_TOKEN 相当）
        header_csrf = self.headers.get("X-CSRF-Token", "")
        cookie_csrf = self._cookie_lookup(cookies, "csrf_token")
        return bool(header_csrf) and header_csrf == cookie_csrf and header_csrf == session_csrf

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

        # テスト専用（/console/api/* でも /v1/* でもないため認証不要。Issue #121 W4-3）
        if path == "/__test__/expire-access-token":
            with LOCK:
                STATE["expired_access_tokens"].add(payload.get("access_token", ""))
            return self._json(200, {"ok": True})

        if path == "/console/api/login":
            # G3: password は base64 化されている前提（サーバがデコードする。libs/encryption.py）。
            # デコードできない値は AuthenticationFailedError 相当として 401 を返す
            pw_field = payload.get("password", "")
            try:
                base64.b64decode(pw_field, validate=True)
            except Exception:
                return self._json(401, {"code": "unauthorized", "message": "mock: password is not base64-encoded (G3)"})
            return self._json(200, {"result": "success", "data": {"access_token": "mock-token", "refresh_token": "mock-refresh"}})

        if path == "/console/api/refresh-token":
            # G6: login_required でも CSRF 必須でもない（S9）。Cookie の refresh_token だけを見る
            cookies = self._parse_cookie_header()
            refresh_val = self._cookie_lookup(cookies, "refresh_token")
            with LOCK:
                if not refresh_val or refresh_val == EXPIRED_REFRESH_TOKEN or refresh_val in STATE["used_refresh_tokens"]:
                    return self._unauthorized()
                STATE["used_refresh_tokens"].add(refresh_val)  # 1 回使ったら無効化（rotate。S10）
                new_access = f"acc-{uuid.uuid4()}"
                new_csrf = f"csrf-{uuid.uuid4()}"
                new_refresh = f"ref-{uuid.uuid4()}"
                STATE["sessions"][new_access] = new_csrf
                STATE["access_to_refresh"][new_access] = new_refresh  # logout() が対で無効化するため（B3）
            payload_bytes = json.dumps({"result": "success"}, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload_bytes)))
            self.send_header("Set-Cookie", f"access_token={new_access}; Path=/; HttpOnly")
            self.send_header("Set-Cookie", f"csrf_token={new_csrf}; Path=/")
            self.send_header("Set-Cookie", f"refresh_token={new_refresh}; Path=/; HttpOnly")
            self.end_headers()
            self.wfile.write(payload_bytes)
            return

        if path.startswith("/console/api/") and not self._console_auth_ok():
            return self._unauthorized()

        if path == "/console/api/logout":
            # B3（Issue #121 W4-4）: 認証済みの access_token（ここまでの _console_auth_ok() で確認済み）
            # と、refresh-token 経由で発行されていれば対になる refresh_token の両方を無効化する
            # （revoke_token_pair の再現）。レガシー Bearer（selfhost の /login・DIFY_CONSOLE_TOKEN 直指定）
            # でも同じ token 値を無効化するので、以後その値では 401 になる。
            cookies = self._parse_cookie_header()
            token = self._extract_bearer() or self._cookie_lookup(cookies, "access_token")
            with LOCK:
                STATE["sessions"].pop(token, None)
                STATE["expired_access_tokens"].add(token)
                refresh_val = STATE["access_to_refresh"].pop(token, None)
                if refresh_val:
                    STATE["used_refresh_tokens"].add(refresh_val)
            return self._json(200, {"result": "success"})

        if path == "/console/api/apps/imports":
            if payload.get("app_id") == MOCK_FORCE_IMPORT_FAIL:
                # P1（Issue #121 W4-4）の機械確認用: このアプリだけインポートを failed にする。
                return self._json(200, {"id": "imp-forced-fail", "status": "failed", "error": "mock: forced import failure (P1 test)"})
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
            with LOCK:
                STATE["calls"]["publish"] = STATE["calls"].get("publish", 0) + 1
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
                # 実機同様の UUID 形式にする（Issue #121 W4-1 T6: kb_upload.py の id マスクを end-to-end で検査するため）
                ds_id = str(uuid.uuid4())
                STATE["next_ds"] += 1
                STATE["datasets"][ds_id] = {"name": name, "documents": {}}
            return self._json(200, {"id": ds_id, "name": name})

        if path.endswith("/document/create-by-file"):
            m = re.match(r"^/v1/datasets/([^/]+)/document/create-by-file$", path)
            ds_id = m.group(1) if m else "ds-unknown"
            _fields, _file_field, filename, content = _parse_multipart(body, self.headers)
            # ファイル名 or 中身のどちらかに MOCK_FAIL_UPLOAD_MARKER を含めると 500 を返す。
            # T7（削除直後の再投入失敗）はファイル名を固定したまま中身だけ差し替えて再現するため、両方を見る
            if (filename and MOCK_FAIL_UPLOAD_MARKER in filename) or MOCK_FAIL_UPLOAD_MARKER in content.decode("utf-8", "replace"):
                return self._json(500, {"error": "mock: forced upload failure"})
            with LOCK:
                doc_id = str(uuid.uuid4())
                STATE["next_doc"] += 1
                ds = STATE.setdefault("datasets", {}).setdefault(ds_id, {"name": ds_id, "documents": {}})
                ds.setdefault("documents", {})[doc_id] = filename or doc_id
            return self._json(200, {"document": {"id": doc_id, "name": filename or doc_id, "indexing_status": "completed"}, "batch": f"batch-{doc_id}"})

        m = re.match(r"^/v1/datasets/([^/]+)/documents/([^/]+)/update-by-text$", path)
        if m:
            ds_id, doc_id = m.group(1), m.group(2)
            with LOCK:
                STATE["calls"]["update_by_text"] = STATE["calls"].get("update_by_text", 0) + 1
                ds = STATE["datasets"].get(ds_id)
                if not ds or doc_id not in ds.get("documents", {}):
                    return self._json(404, {"error": f"mock: unknown document {doc_id}"})
                name = payload.get("name") or ds["documents"][doc_id]
                ds["documents"][doc_id] = name
            return self._json(200, {"document": {"id": doc_id, "name": name, "indexing_status": "completed"}, "batch": f"batch-{doc_id}"})

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
        if path == "/__test__/stats":
            with LOCK:
                return self._json(200, dict(STATE.get("calls", {})))
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
            ds_id = m.group(1)
            with LOCK:
                ds = STATE["datasets"].get(ds_id) or {"documents": {}}
                data = [{"id": doc_id, "name": name} for doc_id, name in ds.get("documents", {}).items()]
            return self._json(200, {"data": data, "has_more": False})

        m = re.match(r"^/v1/datasets/([^/]+)/documents/([^/]+)/indexing-status$", path)
        if m:
            return self._json(200, {"data": [{"indexing_status": "completed", "completed_segments": 1, "total_segments": 1, "error": None}]})

        return self._json(404, {"error": f"mock: unknown path {path}"})

    # -- PATCH（--refresh のファイル差し替え） -----------------------
    def do_PATCH(self):
        path = self._path()
        body = self._body()
        if path.startswith("/console/api/") and not self._console_auth_ok():
            return self._unauthorized()

        m = re.match(r"^/v1/datasets/([^/]+)/documents/([^/]+)$", path)
        if m:
            ds_id, doc_id = m.group(1), m.group(2)
            _fields, _file_field, filename, content = _parse_multipart(body, self.headers)
            with LOCK:
                STATE["calls"]["PATCH"] = STATE["calls"].get("PATCH", 0) + 1
                ds = STATE["datasets"].get(ds_id)
                if not ds or doc_id not in ds.get("documents", {}):
                    return self._json(404, {"error": f"mock: unknown document {doc_id}"})
                if (filename and MOCK_FAIL_UPLOAD_MARKER in filename) or MOCK_FAIL_UPLOAD_MARKER in content.decode("utf-8", "replace"):
                    return self._json(500, {"error": "mock: forced update failure"})
                name = filename or ds["documents"][doc_id]
                ds["documents"][doc_id] = name
            return self._json(200, {"document": {"id": doc_id, "name": name, "indexing_status": "completed"}, "batch": f"batch-{doc_id}"})

        return self._json(404, {"error": f"mock: unknown path {path}"})

    # -- DELETE（--replace が使う唯一の削除経路の相手側） -------------
    def do_DELETE(self):
        path = self._path()
        if path.startswith("/console/api/") and not self._console_auth_ok():
            return self._unauthorized()

        m = re.match(r"^/v1/datasets/([^/]+)/documents/([^/]+)$", path)
        if m:
            ds_id, doc_id = m.group(1), m.group(2)
            with LOCK:
                STATE["calls"]["DELETE"] = STATE["calls"].get("DELETE", 0) + 1
                ds = STATE["datasets"].get(ds_id)
                if not ds or doc_id not in ds.get("documents", {}):
                    return self._json(404, {"error": f"mock: unknown document {doc_id}"})
                del ds["documents"][doc_id]
            self.send_response(204)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return

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
