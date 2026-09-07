#!/usr/bin/env python3
"""dify/kb/<管理番号>/ 配下の文書を Dify のナレッジベースへ投入する（Datasets API、標準ライブラリのみ）。

    python3 scripts/dify/kb_upload.py KN-01

環境変数
  DIFY_DATASET_KEY  ナレッジ API キー（必須。ログには出さない）
  DIFY_BASE_URL     既定 https://api.dify.ai/v1

動作（冪等）
  1. KB 名 "<管理番号> <サービス名>" の KB を探す。無ければ作成（indexing_technique: high_quality）
  2. dify/kb/<管理番号>/ の .md / .txt / .pdf を、同名文書が無いものだけアップロード
     （POST /datasets/{id}/document/create-by-file、process_rule.mode: automatic）
  3. アップロードした文書のインデックス完了を待つ（最長 --timeout 秒、既定 600）

終了コード: 0 成功 / 1 設定不備・API エラー / 2 インデックス未完了（タイムアウト）
"""
import argparse
import json
import mimetypes
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KB_DIR = os.path.join(ROOT, "dify", "kb")
APPS_DIR = os.path.join(ROOT, "dify", "apps")
ALLOWED_EXT = {".md", ".txt", ".pdf"}
# アプリ DSL が見つからないときの予備（KB 名の後半）
FALLBACK_NAMES = {
    "KN-01": "技術ナレッジQA",
    "DC-01": "日本本社への報告資料作成",
}


def log(msg):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def service_name(code):
    """dify/apps/<code>-*.yml の app.name を読む（PyYAML 不要の簡易パース）。"""
    for f in sorted(os.listdir(APPS_DIR)) if os.path.isdir(APPS_DIR) else []:
        if f.startswith(code + "-") and f.endswith(".yml"):
            with open(os.path.join(APPS_DIR, f), encoding="utf-8") as fh:
                in_app = False
                for line in fh:
                    if line.startswith("app:"):
                        in_app = True
                        continue
                    if in_app and not line.startswith(" "):
                        break
                    m = re.match(r"^  name:\s*(.+?)\s*$", line) if in_app else None
                    if m:
                        name = m.group(1).strip().strip("'\"")
                        return name[len(code):].strip() if name.startswith(code) else name
    return FALLBACK_NAMES.get(code, "")


class Api:
    def __init__(self, base, key, timeout=120):
        self.base = base.rstrip("/")
        self.key = key
        self.timeout = timeout

    def _req(self, method, path, body=None, headers=None):
        url = self.base + path
        h = {"Authorization": "Bearer " + self.key}
        if headers:
            h.update(headers)
        data = None
        if body is not None and not isinstance(body, (bytes, bytearray)):
            data = json.dumps(body).encode("utf-8")
            h["Content-Type"] = "application/json"
        elif body is not None:
            data = body
        req = urllib.request.Request(url, data=data, method=method, headers=h)
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                raw = r.read()
                return r.status, (json.loads(raw) if raw else {})
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8", "replace")
            raise RuntimeError(f"HTTP {e.code} {method} {path}: {raw[:500]}") from None
        except urllib.error.URLError as e:
            raise RuntimeError(f"接続失敗 {method} {path}: {e.reason}") from None

    def get(self, path):
        return self._req("GET", path)[1]

    def post(self, path, body):
        return self._req("POST", path, body)[1]

    def post_multipart(self, path, fields, file_field, filename, content, content_type):
        boundary = "----DifyUpload" + uuid.uuid4().hex
        parts = []
        for k, v in fields.items():
            parts.append(
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n"
                f"Content-Type: text/plain; charset=utf-8\r\n\r\n{v}\r\n".encode("utf-8")
            )
        parts.append(
            (
                f"--{boundary}\r\nContent-Disposition: form-data; name=\"{file_field}\"; "
                f"filename=\"{filename}\"\r\nContent-Type: {content_type}\r\n\r\n"
            ).encode("utf-8")
            + content
            + b"\r\n"
        )
        parts.append(f"--{boundary}--\r\n".encode("utf-8"))
        body = b"".join(parts)
        return self._req(
            "POST", path, body, {"Content-Type": f"multipart/form-data; boundary={boundary}"}
        )[1]


def list_all(api, path):
    items, page = [], 1
    while True:
        res = api.get(f"{path}{'&' if '?' in path else '?'}page={page}&limit=100")
        items.extend(res.get("data") or [])
        if not res.get("has_more"):
            return items
        page += 1


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("code", help="管理番号（例 KN-01）")
    ap.add_argument("--timeout", type=int, default=600, help="インデックス完了待ちの上限秒（既定 600）")
    ap.add_argument("--no-wait", action="store_true", help="インデックス完了を待たない")
    args = ap.parse_args()

    key = os.environ.get("DIFY_DATASET_KEY", "").strip()
    if not key:
        print("環境変数 DIFY_DATASET_KEY が未設定です（ナレッジ API キー）。dify/DEPLOY.md を参照。")
        return 1
    base = os.environ.get("DIFY_BASE_URL", "https://api.dify.ai/v1").strip()

    code = args.code.upper()
    src = os.path.join(KB_DIR, code)
    if not os.path.isdir(src):
        print(f"文書フォルダが見つかりません: {os.path.relpath(src, ROOT)}")
        return 1
    files = sorted(f for f in os.listdir(src) if os.path.splitext(f)[1].lower() in ALLOWED_EXT)
    if not files:
        print(f"投入対象（.md/.txt/.pdf）がありません: {os.path.relpath(src, ROOT)}")
        return 1

    kb_name = f"{code} {service_name(code)}".strip()
    api = Api(base, key)
    log(f"接続先 {base} / KB 名 '{kb_name}' / 文書 {len(files)} 件")

    try:
        datasets = list_all(api, "/datasets")
        ds = next((d for d in datasets if d.get("name") == kb_name), None)
        if ds:
            log(f"既存 KB を再利用: id={ds['id']}")
        else:
            ds = api.post(
                "/datasets",
                {"name": kb_name, "indexing_technique": "high_quality", "permission": "only_me",
                 "description": f"{code} 用ナレッジ（dify/kb/{code}/ から scripts/dify/kb_upload.py が投入）"},
            )
            log(f"KB を作成: id={ds['id']}")
        ds_id = ds["id"]

        existing = {d.get("name") for d in list_all(api, f"/datasets/{ds_id}/documents")}
        uploaded = []  # (name, doc_id, batch)
        for fname in files:
            if fname in existing:
                log(f"スキップ（同名文書あり）: {fname}")
                continue
            path = os.path.join(src, fname)
            with open(path, "rb") as fh:
                content = fh.read()
            ctype = mimetypes.guess_type(fname)[0] or "application/octet-stream"
            if fname.lower().endswith(".md"):
                ctype = "text/markdown"
            data = json.dumps(
                {"indexing_technique": "high_quality", "process_rule": {"mode": "automatic"}},
                ensure_ascii=False,
            )
            res = api.post_multipart(
                f"/datasets/{ds_id}/document/create-by-file", {"data": data}, "file", fname, content, ctype
            )
            doc = res.get("document") or {}
            uploaded.append((fname, doc.get("id"), res.get("batch")))
            log(f"アップロード: {fname} ({len(content)} bytes) -> document id={doc.get('id')} status={doc.get('indexing_status')}")

        if not uploaded:
            log("新規アップロードなし（すべて既存）。")
            return 0
        if args.no_wait:
            return 0

        log("インデックス完了を待機 ...")
        deadline = time.time() + args.timeout
        pending = {b for _, _, b in uploaded if b}
        while pending and time.time() < deadline:
            for batch in sorted(pending):
                res = api.get(f"/datasets/{ds_id}/documents/{batch}/indexing-status")
                statuses = [(d.get("indexing_status"), d.get("completed_segments"), d.get("total_segments"), d.get("error"))
                            for d in res.get("data") or []]
                if statuses and all(s[0] in ("completed", "error", "paused") for s in statuses):
                    pending.discard(batch)
                    for s in statuses:
                        log(f"batch {batch}: {s[0]} ({s[1]}/{s[2]} segments){' error=' + str(s[3]) if s[3] else ''}")
            if pending:
                time.sleep(5)
        if pending:
            log(f"タイムアウト: {len(pending)} batch がまだ完了していません。Dify のナレッジ画面で状態を確認してください。")
            return 2
        log(f"完了: KB '{kb_name}' (id={ds_id})。Studio で {code} の Knowledge Retrieval ノードにこの KB を選び、再公開してください。")
        return 0
    except RuntimeError as e:
        print("エラー:", e)
        print("ヒント: 401=キー違い（ナレッジ API キーか確認） / 404=URL か dataset id / 4xx の本文をそのまま報告")
        return 1


if __name__ == "__main__":
    sys.exit(main())
