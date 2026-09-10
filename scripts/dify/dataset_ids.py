#!/usr/bin/env python3
"""KB 付きアプリの dataset id を実行時に Datasets API から名前で解決する（標準ライブラリのみ・GET のみ）。

    import dataset_ids
    targets = dataset_ids.kb_codes(["KN-01", "KN-02", "DC-01", ...])   # -> ["KN-01", "KN-02", ...]
    resolved = dataset_ids.resolve("cloud-master", targets, environ=os.environ,
                                    base_url="https://api.dify.ai/v1", key=os.environ["DIFY_DATASET_KEY"])
    dataset_ids.assert_bound(build_dir, targets)   # G-KB2（render 後の最終確認）

設計: docs/handoff/2026-09-09-dataset-ids-in-ci.md §4-2〜§4-3（Issue #209 PR-1）

**なぜ `kb_upload.py` に足さないか**：`kb_upload.py` は `DELETE` を送る唯一の関数 `delete_document` を持つ
ファイル（`tools/verify.mjs` §15 が機械検査している）。このモジュールを `cloud_deploy.py` が import しても
削除コードを一切持ち込まないよう、**このファイルは `GET` しか送らない**（`masking.py` を切り出したときと
同じ判断。Issue #178）。

load-bearing（設計書 §4-2 の実装上の約束）：
  M1 HTTP メソッドは GET のみ。POST / PATCH / DELETE を 1 行も書かない
  M2 User-Agent は kb_upload.py と同じ（Cloudflare が既定 UA を 403 で弾くため。DI-004）
  M3 ログ・例外に出す id は必ず masking.short_id() / masking.mask_ids() を通す（CLAUDE.md §2-10）
  M4 KB 名（knowledge.<番号>.name）はそのままログに出してよい（dataset id は出さない）
  M5 resolve() は os.environ を書き換えない（引数の environ を読むだけ・戻り値を返すだけ）

終了コード相当：呼び出し側（cloud_deploy.py）が DatasetResolveError を捕まえて exit 2 にする
（このモジュール自体は CLI を持たない）。
"""
import glob
import json
import os
import re
import sys
import urllib.error
import urllib.request

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import masking  # noqa: E402  (scripts/dify/masking.py。CLAUDE.md §2-10。Issue #178 と同じ切り出し方針)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
APPS_DIR = os.path.join(ROOT, "dify", "apps")
ENV_DIR = os.path.join(ROOT, "dify", "env")
USER_AGENT = "dify-scripts/1.0 (+https://github.com/shoulang0729/dify)"  # M2（DI-004）
VAR_ONLY_RE = re.compile(r"^\$\{([A-Za-z_][A-Za-z0-9_]*)\}$")  # id が '${NAME}' 1 個ちょうどの形か
PAGE_LIMIT = 100


class DatasetResolveError(RuntimeError):
    """名前が引けない・重複する・API に到達できない・env.yml の形が不正、のいずれか。
    呼び出し側は「Dify に 1 バイトも書き込む前」にこれを捕まえて exit 2 にすること（設計書 §7）。"""


# ---------------------------------------------------------------------------
# env.yml / dify/apps/*.yml の読み込み（kb_upload.py・cloud_deploy.py への依存を持たない自己完結の実装）
# ---------------------------------------------------------------------------

def load_env_raw(env_name):
    """dify/env/<env>/env.yml を辞書で返す。PyYAML が無い／ファイルが無いなら DatasetResolveError。"""
    if yaml is None:
        raise DatasetResolveError("PyYAML がありません: pip3 install pyyaml")
    path = os.path.join(ENV_DIR, env_name, "env.yml")
    if not os.path.isfile(path):
        raise DatasetResolveError(f"env が見つかりません: {os.path.relpath(path, ROOT)}")
    with open(path, encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def _app_file(code):
    matches = sorted(glob.glob(os.path.join(APPS_DIR, f"{code}-*.yml")))
    return matches[0] if matches else None


def _nodes_of(data):
    return (((data or {}).get("workflow") or {}).get("graph") or {}).get("nodes") or []


def _has_knowledge_retrieval(path):
    if yaml is None or not path or not os.path.isfile(path):
        return False
    with open(path, encoding="utf-8") as fh:
        data = yaml.safe_load(fh.read()) or {}
    return any((n.get("data") or {}).get("type") == "knowledge-retrieval" for n in _nodes_of(data))


def kb_codes(codes):
    """渡された番号のうち、dify/apps/<番号>-*.yml に knowledge-retrieval ノードを持つものだけを返す
    （順序は codes の並び順を保つ）。「KB 付きアプリ」の定義はマスタ DSL が唯一の正
    （番号のハードコードをしない。設計書 §4-2）。"""
    return [code for code in codes if _has_knowledge_retrieval(_app_file(code))]


def planned_vars(env_raw, code):
    """[(論理KB名, 環境変数名, KB 名)] を返す（設計書 §4-2）。

    - env.yml の knowledge から k == code or k.startswith(code + '/') で拾う（render.py R5 と同じ規則）
    - id は '${NAME}' 1 個ちょうどの形であること。null・直値・前後に文字がある形は DatasetResolveError
    - name が空なら DatasetResolveError
    - 該当する論理KBが 1 つも無ければ DatasetResolveError（knowledge-retrieval ノードが要求しているのに
      env.yml に定義が無い状態）
    """
    knowledge = (env_raw or {}).get("knowledge") or {}
    out = []
    for logical, spec in knowledge.items():
        if logical != code and not logical.startswith(code + "/"):
            continue
        spec = spec or {}
        name = spec.get("name")
        if not name:
            raise DatasetResolveError(f"{code}: env.yml の knowledge.{logical}.name が空です")
        id_raw = spec.get("id")
        m = VAR_ONLY_RE.match(id_raw) if isinstance(id_raw, str) else None
        if not m:
            raise DatasetResolveError(
                f"{code}: env.yml の knowledge.{logical}.id が '${{VAR}}' 1 個ちょうどの形ではありません"
                f"（現在値: {id_raw!r}）。id: '${{DIFY_DATASET_ID_...}}' の形にしてください"
            )
        out.append((logical, m.group(1), name))
    if not out:
        raise DatasetResolveError(
            f'{code}: env.yml の knowledge に論理KB "{code}" が定義されていません'
            "（knowledge-retrieval ノードが要求しています）"
        )
    return out


# ---------------------------------------------------------------------------
# Datasets API（GET のみ。M1）
# ---------------------------------------------------------------------------

def _http_get(base_url, path, key, timeout):
    url = base_url.rstrip("/") + path
    req = urllib.request.Request(
        url, method="GET",
        headers={"Authorization": "Bearer " + key, "User-Agent": USER_AGENT},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        raise DatasetResolveError(masking.mask_ids(f"HTTP {e.code} GET {path}: {raw[:500]}")) from None
    except urllib.error.URLError as e:
        raise DatasetResolveError(masking.mask_ids(f"接続失敗 GET {path}: {e.reason}")) from None


def _list_all_datasets(base_url, key, timeout):
    """GET /v1/datasets を has_more が尽きるまで全ページ取得する（kb_upload.py の list_all() と同じ考え方）。"""
    items, page = [], 1
    while True:
        res = _http_get(base_url, f"/datasets?page={page}&limit={PAGE_LIMIT}", key, timeout)
        items.extend(res.get("data") or [])
        if not res.get("has_more"):
            return items
        page += 1


def resolve(env_name, codes, *, environ, base_url, key, timeout=30):
    """{環境変数名: dataset id} を返す（設計書 §4-2）。GET しか送らない。

    - environ に既にその変数があれば **API を呼ばずにその値を採る**（R0-a。Mac のローカル手順を壊さない）
    - 1 つでも API 解決が要るなら GET /v1/datasets を全ページ取得し、name 完全一致で引く
    - 0 件 → DatasetResolveError / 2 件以上 → DatasetResolveError（先頭を採らない）
    - HTTP/接続エラー → DatasetResolveError（masking.mask_ids() を通した本文）
    - M5: environ を書き換えない（読むだけ）
    """
    env_raw = load_env_raw(env_name)

    planned = []  # [(code, logical, var_name, kb_name)]
    for code in codes:
        for logical, var_name, kb_name in planned_vars(env_raw, code):
            planned.append((code, logical, var_name, kb_name))

    result = {}
    need_lookup = []
    for code, logical, var_name, kb_name in planned:
        if var_name in environ:
            result[var_name] = environ[var_name]
        else:
            need_lookup.append((code, logical, var_name, kb_name))

    if not need_lookup:
        return result

    if not key:
        pending = ", ".join(f"{c}:{n!r}" for c, _, _, n in need_lookup)
        raise DatasetResolveError(
            "DIFY_DATASET_KEY が未設定です（ナレッジ API キー）。次の KB 名を Datasets API で"
            f"解決する必要があります: {pending}"
        )

    datasets = _list_all_datasets(base_url, key, timeout)
    by_name = {}
    for d in datasets:
        by_name.setdefault(d.get("name"), []).append(d.get("id"))

    for code, logical, var_name, kb_name in need_lookup:
        matches = by_name.get(kb_name) or []
        if len(matches) == 0:
            raise DatasetResolveError(
                f"{code}: KB '{kb_name}' が Dify に見つかりません。先に `op: kb_upload` を流してください。"
            )
        if len(matches) >= 2:
            shown = ", ".join(masking.short_id(m) for m in matches)
            raise DatasetResolveError(
                f"{code}: KB '{kb_name}' が {len(matches)} 件あり、どれを使うか機械では決められません"
                f"（{shown}）。Dify の画面で重複を解消してから再実行してください。"
            )
        result[var_name] = matches[0]

    return result


# ---------------------------------------------------------------------------
# G-KB2（render 後の最終確認。最後の砦）
# ---------------------------------------------------------------------------

def _build_file_for(build_dir, code):
    matches = sorted(glob.glob(os.path.join(build_dir, f"{code}-*.yml")))
    return matches[0] if matches else None


def assert_bound(build_dir, codes):
    """G-KB2。dify/build/<env>/<番号>-*.yml を読み、type == 'knowledge-retrieval' の
    全ノードについて dataset_ids が「空でない文字列のリスト」であることを検査する（設計書 §4-2）。
    1 件でも空なら DatasetResolveError（＝ import に進ませない）。

    ビルド出力そのものが見つからない番号はここでは無視する（render.py 呼び出し側で別途エラーになっているはず。
    cloud_deploy.py の load_build() と同じ方針）。dataset id の値そのものはログに出さない（M3。空かどうかの
    判定だけを行う）。
    """
    if yaml is None:
        raise DatasetResolveError("PyYAML がありません: pip3 install pyyaml")

    problems = []
    for code in codes:
        path = _build_file_for(build_dir, code)
        if not path:
            continue
        with open(path, encoding="utf-8") as fh:
            data = yaml.safe_load(fh.read()) or {}
        empty_titles = []
        for n in _nodes_of(data):
            d = n.get("data") or {}
            if d.get("type") != "knowledge-retrieval":
                continue
            ids = d.get("dataset_ids")
            if not (isinstance(ids, list) and ids and all(isinstance(x, str) and x for x in ids)):
                empty_titles.append(d.get("title") or n.get("id") or "(無題)")
        if empty_titles:
            problems.append((code, empty_titles))

    if problems:
        lines = [
            "[STOP] レンダ後も dataset_ids が空のままの knowledge-retrieval ノードがあります"
            "（G-KB2。恒久対応が入った後も残す最後の砦。設計書 §7）。"
            "このまま import すると Dify 上の既存の KB 紐づけが空にリセットされる可能性があります。",
            "",
            "対象（管理番号: knowledge-retrieval ノード名）:",
        ]
        for code, titles in problems:
            lines.append(f"  - {code}: {', '.join(titles)}")
        lines += [
            "",
            "0.5 段（dataset id の解決）は完了しているはずなので、ここに来る場合は env.yml の knowledge 定義と"
            "render.py の対応関係、または render.py 自体の想定外の変更を確認してください。",
        ]
        raise DatasetResolveError("\n".join(lines))
