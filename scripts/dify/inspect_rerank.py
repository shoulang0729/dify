#!/usr/bin/env python3
"""下書き（workflow draft）から Rerank 関連の 6 項目だけを読み取り専用で採取して表示する。

    python3 scripts/dify/inspect_rerank.py KN-01 KN-02 KN-03 GN-01
    python3 scripts/dify/inspect_rerank.py --env cloud-master KN-01

設計: docs/handoff/2026-09-09-rerank-decision.md §8 PR-1b・§9 E1・§9-1（Issue #195・#121）

やること（これだけ）
  1. `console_api.client_from_env()` で Cloud にログインする（`DIFY_CONSOLE_REFRESH` を使う）
  2. マスタ DSL（`dify/apps/<番号>-*.yml` の `app.name`）でアプリ名を引き、
     `find_app_id_by_name()` で app_id を解決する
  3. `get_draft(app_id)`（GET のみ）で下書きを取得する
  4. 応答を**再帰的に走査**し、`multiple_retrieval_config` を持つ dict（knowledge-retrieval
     ノードの `data`）を**すべて**拾う。`graph.nodes[]` のような特定のパスを決め打ちにしない
     （下書き応答のトップレベルキー形は #114 C5 として未確認。§9-1）
  5. 見つかった `multiple_retrieval_config` から **6 項目だけ**（`reranking_enable` /
     `reranking_model.provider` / `.model` / `reranking_mode` / `top_k` / `score_threshold`）
     を抜いて表示する

やらないこと（重要）
  - 下書き全体を出力・ログしない（プロンプト本文・`dataset_ids` が入るため。`CLAUDE.md` §2-10）
  - 書き込み系 API を一切呼ばない（`get_draft()` は GET のみ。`update_draft()` / `publish()` /
    `import_dsl()` は使わない）。DELETE / POST（読み取り以外）/ PATCH / PUT は送らない
    （`tools/verify.mjs` §15 の「DELETE を送る関数は `kb_upload.py` の `delete_document` のみ」を破らない）
  - 何も commit しない（`.github/workflows/dify-ops.yml` の `inspect` ジョブ側で担保）

終了コード: 0 全件で app_id が解決できた（Rerank が未設定でも 0。それ自体は正常な観測結果） /
          1 いずれかの管理番号でアプリが見つからない、または API エラー / 2 環境・引数不備 / 3 認証エラー

値をログに出さない：console_api の `client_from_env()` / `log()` の慣習に従う。
本モジュール自身は app_id・下書き全体を一切 print しない（アプリ名・6 項目・ノードの経路のみ）。
"""
import argparse
import glob
import os
import sys

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cloud_deploy  # noqa: E402  (env.yml 読み込み・${VAR} 展開の再利用。load_env_raw/expand は変更していない)
import console_api  # noqa: E402  (scripts/dify/console_api.py。get_draft() をそのまま呼ぶだけ。このファイルは触らない)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
APPS_DIR = os.path.join(ROOT, "dify", "apps")

# 出してよい 6 項目（これ以外は下書きから抜き出さない。§9-1）
SIX_KEYS = (
    "reranking_enable",
    "reranking_model.provider",
    "reranking_model.model",
    "reranking_mode",
    "top_k",
    "score_threshold",
)


class InspectError(RuntimeError):
    """管理番号の解決・マスタ DSL 読み込みに失敗（app_id の解決失敗は別扱い＝found=False で返す）。"""


def log(msg):
    # console_api._mask() を通す（万一 app_id 等が紛れても伏せられるように。cloud_deploy.log() と同じ考え方）
    print(console_api._mask(str(msg)), flush=True)


def app_name_for_code(code):
    """dify/apps/<code>-*.yml の app.name を返す（マスタ DSL の名前でしかアプリを引けないため。§9-1）。"""
    if yaml is None:
        raise InspectError("PyYAML がありません: pip3 install pyyaml")
    matches = sorted(glob.glob(os.path.join(APPS_DIR, f"{code}-*.yml")))
    if not matches:
        raise InspectError(f"マスタ DSL が見つかりません: dify/apps/{code}-*.yml")
    with open(matches[0], encoding="utf-8") as fh:
        data = yaml.safe_load(fh) or {}
    name = ((data.get("app") or {}).get("name") or "").strip()
    if not name:
        raise InspectError(f"{code}: app.name が空です（{os.path.relpath(matches[0], ROOT)}）")
    return name


def find_retrieval_configs(node, path=""):
    """draft 応答を任意の深さで再帰的に走査し、`multiple_retrieval_config` を持つ dict を
    すべて拾う（`graph.nodes[]` のようなパスを決め打ちにしない。#114 C5 に依存しない実装。§9-1）。

    知識検索ノードの実際の形（dify/apps/*.yml で確認済み）は
    `node.data == {type: 'knowledge-retrieval', multiple_retrieval_config: {...}, ...}` であり、
    `multiple_retrieval_config` キーの有無だけで判定すれば `type` キーの有無・置き場所のゆれを
    問わずに拾える（#114 C5＝下書き応答のトップレベルキー形が未確認、という不確実性を吸収する）。

    戻り値: [{"path": "a.b[2].c", "multiple_retrieval_config": {...}}, ...]
    """
    hits = []
    if isinstance(node, dict):
        mrc = node.get("multiple_retrieval_config")
        if isinstance(mrc, dict):
            hits.append({"path": path or "(root)", "multiple_retrieval_config": mrc})
        for key, value in node.items():
            hits.extend(find_retrieval_configs(value, f"{path}.{key}" if path else str(key)))
    elif isinstance(node, list):
        for i, value in enumerate(node):
            hits.extend(find_retrieval_configs(value, f"{path}[{i}]"))
    return hits


def extract_six(mrc):
    """multiple_retrieval_config から 6 項目だけを抜く（下書き全体・dataset_ids は返さない。§9-1）。"""
    reranking_model = mrc.get("reranking_model")
    reranking_model = reranking_model if isinstance(reranking_model, dict) else {}
    return {
        "reranking_enable": mrc.get("reranking_enable"),
        "reranking_model.provider": reranking_model.get("provider"),
        "reranking_model.model": reranking_model.get("model"),
        "reranking_mode": mrc.get("reranking_mode"),
        "top_k": mrc.get("top_k"),
        "score_threshold": mrc.get("score_threshold"),
    }


def format_six(six):
    """6 項目を表示用の行に整形する。Rerank 未設定（reranking_enable: false）は
    黙って空を出さず、明示的にその旨を書く（PM 指摘：build 版の再インポート後は
    実際にこの状態になっているはずで、これは実装の不具合ではない。§9-1 順序の制約）。"""
    lines = [f"    {k}: {six[k]!r}" for k in SIX_KEYS]
    if six.get("reranking_enable") is False:
        lines.append(
            "    → Rerank は未設定です（reranking_enable=False）。"
            "build 版（dataset_ids 焼き込み）を再インポートした後は下書きがこの状態で上書きされます"
            "（設計書 §9-1 の順序の制約）。実機で Rerank を選び直した直後でなければ、これは想定される結果です。"
        )
    elif six.get("reranking_enable") is None:
        lines.append("    → reranking_enable が取得できません（キーが無い）。ノードの形が想定と異なる可能性があります。")
    return "\n".join(lines)


def inspect_code(client, code):
    """1 件の管理番号を調べてレポート文字列を返す。戻り値: (report: str, ok: bool)。
    ok=False は「アプリが見つからない」（実際の失敗）。Rerank 未設定・ノード無しは ok=True
    （それ自体は正常な観測結果であり、失敗ではない）。"""
    name = app_name_for_code(code)
    app_id = client.find_app_id_by_name(name)
    if not app_id:
        return f"== {code}（{name}）==\n  [NOT FOUND] Cloud にこの名前のアプリが見つかりません\n", False

    draft = client.get_draft(app_id)  # GET のみ（読み取り専用。§9-1）
    hits = find_retrieval_configs(draft)

    lines = [f"== {code}（{name}）=="]
    if not hits:
        lines.append("  知識検索ノード（multiple_retrieval_config）が見つかりません")
        return "\n".join(lines) + "\n", True

    for i, hit in enumerate(hits):
        lines.append(f"  knowledge-retrieval ノード {i + 1}/{len(hits)} 件目（path: {hit['path']}）")
        lines.append(format_six(extract_six(hit["multiple_retrieval_config"])))
    return "\n".join(lines) + "\n", True


def build_arg_parser():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("codes", nargs="+", help="管理番号（例 KN-01 KN-02 KN-03 GN-01）")
    ap.add_argument("--env", default=os.environ.get("DIFY_ENV") or "cloud-master",
                     help="dify/env/<env>/env.yml の dify.console_url を使う（既定 $DIFY_ENV または cloud-master）")
    ap.add_argument("--timeout", type=int, default=60, help="Console API 呼び出しのタイムアウト秒（既定 60）")
    return ap


def main():
    args = build_arg_parser().parse_args()

    if yaml is None:
        log("PyYAML がありません: pip3 install pyyaml")
        return 2

    try:
        _, env_raw = cloud_deploy.load_env_raw(args.env)
    except cloud_deploy.CloudDeployError as e:
        log(f"[STOP] {e}")
        return 2

    console_url = os.environ.get("DIFY_CONSOLE_URL", "").strip() \
        or cloud_deploy.expand((env_raw.get("dify") or {}).get("console_url") or "")

    try:
        client = console_api.client_from_env(console_url, timeout=args.timeout)
    except console_api.ConsoleAuthError as e:
        log(str(e))
        log(console_api.TOKEN_HELP)
        return 3
    except console_api.ConsoleAPIError as e:
        log(str(e))
        return 2

    not_found = 0
    for raw_code in args.codes:
        code = raw_code.upper()
        try:
            report, ok = inspect_code(client, code)
        except InspectError as e:
            log(f"== {code} ==\n  [STOP] {e}\n")
            not_found += 1
            continue
        except console_api.ConsoleAuthError as e:
            log(str(e))
            log(console_api.TOKEN_HELP)
            return 3
        except console_api.ConsoleAPIError as e:
            log(f"== {code} ==\n  [FAIL] {e}\n")
            not_found += 1
            continue
        log(report)
        if not ok:
            not_found += 1

    return 1 if not_found else 0


if __name__ == "__main__":
    sys.exit(main())
