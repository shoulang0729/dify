#!/usr/bin/env python3
"""dify/kb/<管理番号>/ 配下の文書を Dify のナレッジベースへ投入する（Datasets API、標準ライブラリのみ）。

    python3 scripts/dify/kb_upload.py KN-01
    python3 scripts/dify/kb_upload.py --env customer-a KN-01
    python3 scripts/dify/kb_upload.py --env cloud-master --dry-run KN-01   # KB 名だけ確認。ネットワークを呼ばない

環境変数
  DIFY_DATASET_KEY  ナレッジ API キー（必須。ログには出さない。--dry-run では不要）
  DIFY_BASE_URL     既定 https://api.dify.ai/v1
  DIFY_ENV          --env 未指定時の既定（さらに未指定なら cloud-master）

--env <env>
  dify/env/<env>/env.yml の knowledge.<管理番号>.name を KB 名として使う（${VAR} はプロセス環境変数で展開）。
  env.yml が無い／論理 KB 名の定義が無い場合は、従来どおり dify/apps/<管理番号>-*.yml の app.name から作る。

動作（冪等）
  1. KB 名 "<管理番号> <サービス名>"（または env の論理名）の KB を探す。無ければ作成
     （indexing_technique: high_quality。新規作成時のみ retrieval_model を完全な形で送り Rerank を無効化する。DI-005 / DI-016）
  2. dify/kb/<管理番号>/ の .md / .txt / .pdf を、同名文書が無いものだけアップロード
     （POST /datasets/{id}/document/create-by-file、process_rule は custom 固定：区切り \n\n・最大 1024 字。DI-006）
  3. アップロードした文書のインデックス完了を待つ（最長 --timeout 秒、既定 600）

既存 KB を再利用する経路では process_rule・retrieval_model の設定は変更しない（DI-005 は画面で確認）。

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

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KB_DIR = os.path.join(ROOT, "dify", "kb")
APPS_DIR = os.path.join(ROOT, "dify", "apps")
ENV_DIR = os.path.join(ROOT, "dify", "env")
ALLOWED_EXT = {".md", ".txt", ".pdf"}
VAR_RE = re.compile(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}")
USER_AGENT = "dify-scripts/1.0 (+https://github.com/shoulang0729/dify)"  # Cloudflare が Python-urllib 既定 UA を 403 (1010) で弾くため
# チャンク設定の既定（DI-006）。UI 既定の改行区切りだと条件表・箇条書きが 1 行 1 チャンクに分断されるため custom 固定にする
CHUNK_SEPARATOR = "\n\n"
CHUNK_MAX_TOKENS = 1024
# アプリ DSL が見つからないときの予備（KB 名の後半）
FALLBACK_NAMES = {
    "KN-01": "技術ナレッジQA",
    "DC-01": "日本本社への報告資料作成",
}


def expand(s):
    if not isinstance(s, str) or "${" not in s:
        return s
    return VAR_RE.sub(lambda m: os.environ.get(m.group(1), ""), s)


def embedding_from_env(env_name):
    """dify/env/<env>/env.yml の models.embedding を (provider, name) で返す（未設定なら (None, None)）。

    cloud-master は空（ワークスペース既定に任せる）。inhouse / customer-a のように
    値が入っている環境では、KB 作成時に埋め込みモデルを明示する（DI-001）。
    """
    if yaml is None:
        return None, None
    path = os.path.join(ENV_DIR, env_name, "env.yml")
    if not os.path.isfile(path):
        return None, None
    with open(path, encoding="utf-8") as fh:
        env = yaml.safe_load(fh) or {}
    emb = ((env.get("models") or {}).get("embedding")) or {}
    provider, name = expand(emb.get("provider") or ""), expand(emb.get("name") or "")
    if provider and name:
        return provider, name
    return None, None


def kb_name_from_env(env_name, code):
    """dify/env/<env>/env.yml の knowledge.<code>.name を返す（無ければ None）。"""
    if yaml is None:
        return None
    path = os.path.join(ENV_DIR, env_name, "env.yml")
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as fh:
        env = yaml.safe_load(fh) or {}
    spec = (env.get("knowledge") or {}).get(code)
    if not spec or not spec.get("name"):
        return None
    return expand(spec["name"])


def build_process_rule(separator, max_tokens):
    """custom 固定の process_rule（DI-006）。UI 既定の automatic（改行区切り）は条件表・箇条書きを 1 行ずつに分断する。"""
    return {
        "mode": "custom",
        "rules": {
            "pre_processing_rules": [
                {"id": "remove_extra_spaces", "enabled": True},
                {"id": "remove_urls_emails", "enabled": False},
            ],
            "segmentation": {"separator": separator, "max_tokens": max_tokens},
        },
    }


def build_retrieval_model():
    """新規 dataset 作成時に Rerank を無効化する（DI-005）。

    Datasets API は retrieval_model の部分指定を受け付けない（reranking_enable だけ送ると
    search_method / top_k が Field required で invalid_param になる。DI-016）。
    そのため既定値を明示した完全な形で送る。
    """
    return {
        "search_method": "semantic_search",
        "reranking_enable": False,
        "reranking_model": {"reranking_provider_name": "", "reranking_model_name": ""},
        "top_k": 8,
        "score_threshold_enabled": False,
        "score_threshold": 0,
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
        h = {"Authorization": "Bearer " + self.key, "User-Agent": USER_AGENT}
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
    ap.add_argument("--env", default=os.environ.get("DIFY_ENV", "cloud-master"),
                     help="dify/env/<env>/env.yml の knowledge.<管理番号>.name を KB 名に使う（既定 $DIFY_ENV または cloud-master）")
    ap.add_argument("--timeout", type=int, default=600, help="インデックス完了待ちの上限秒（既定 600）")
    ap.add_argument("--no-wait", action="store_true", help="インデックス完了を待たない")
    ap.add_argument("--dry-run", action="store_true", help="KB 名・process_rule・retrieval_model だけ表示して終了する。ネットワークを呼ばない")
    ap.add_argument("--separator", default=CHUNK_SEPARATOR, help=f"チャンク区切り（既定 {CHUNK_SEPARATOR!r}。DI-006）")
    ap.add_argument("--max-tokens", type=int, default=CHUNK_MAX_TOKENS, help=f"チャンク最大字数（既定 {CHUNK_MAX_TOKENS}。DI-006）")
    args = ap.parse_args()

    code = args.code.upper()
    kb_name = kb_name_from_env(args.env, code) or f"{code} {service_name(code)}".strip()
    process_rule = build_process_rule(args.separator, args.max_tokens)
    retrieval_model = build_retrieval_model()

    if args.dry_run:
        print(f"[dry-run] env={args.env} code={code} KB 名 '{kb_name}'")
        print(f"[dry-run] process_rule（新規・既存とも文書アップロード時に送信） = {json.dumps(process_rule, ensure_ascii=False)}")
        print(f"[dry-run] retrieval_model（新規 KB 作成時のみ送信。受付確認要＝DI-005） = {json.dumps(retrieval_model, ensure_ascii=False)}")
        print("（ネットワークは呼びません）")
        return 0

    key = os.environ.get("DIFY_DATASET_KEY", "").strip()
    if not key:
        print("環境変数 DIFY_DATASET_KEY が未設定です（ナレッジ API キー）。dify/DEPLOY.md を参照。")
        return 1
    base = os.environ.get("DIFY_BASE_URL", "https://api.dify.ai/v1").strip()

    src = os.path.join(KB_DIR, code)
    if not os.path.isdir(src):
        print(f"文書フォルダが見つかりません: {os.path.relpath(src, ROOT)}")
        return 1
    files = sorted(f for f in os.listdir(src) if os.path.splitext(f)[1].lower() in ALLOWED_EXT)
    if not files:
        print(f"投入対象（.md/.txt/.pdf）がありません: {os.path.relpath(src, ROOT)}")
        return 1

    api = Api(base, key)
    log(f"接続先 {base} / env={args.env} / KB 名 '{kb_name}' / 文書 {len(files)} 件")

    try:
        datasets = list_all(api, "/datasets")
        ds = next((d for d in datasets if d.get("name") == kb_name), None)
        if ds:
            log(f"既存 KB を再利用: id={ds['id']}")
            log("既存 KB の Rerank 設定は画面で確認すること（DI-005。retrieval_model は変更しません）")
        else:
            create_body = {
                "name": kb_name, "indexing_technique": "high_quality", "permission": "only_me",
                "description": f"{code} 用ナレッジ（dify/kb/{code}/ から scripts/dify/kb_upload.py が投入）",
                "retrieval_model": retrieval_model,
            }
            emb_provider, emb_name = embedding_from_env(args.env)
            if emb_provider and emb_name:
                create_body["embedding_model_provider"] = emb_provider
                create_body["embedding_model"] = emb_name
                log(f"埋め込みモデルを指定: {emb_provider} / {emb_name}（env.yml の models.embedding。DI-001）")
            try:
                ds = api.post("/datasets", create_body)
            except RuntimeError as e:
                if "HTTP 400" in str(e):
                    log(f"警告: POST /datasets が retrieval_model を受け付けませんでした（{e}）。retrieval_model 無しで作成します。")
                    log("Dify の画面で「ナレッジ → 該当 KB → 検索設定」から Rerank を OFF にしてください（DI-005）。")
                    create_body.pop("retrieval_model", None)
                    ds = api.post("/datasets", create_body)
                else:
                    raise
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
                {"indexing_technique": "high_quality", "process_rule": process_rule},
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
