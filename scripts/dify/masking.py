#!/usr/bin/env python3
"""ログ・例外メッセージから UUID/ID を伏せる共通ヘルパー（標準ライブラリのみ）。

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import masking
    masking.short_id(app_id)   # 1 個の id を先頭 8 文字だけにする
    masking.mask_ids(text)     # 文字列中の UUID をすべて先頭 8 文字に落とす

dataset id / document id / app_id は dify/env/**/env.yml に直値で書くことを禁じている値
（CLAUDE.md §2-10・§2-12）。kb_upload.py・console_api.py・cloud_deploy.py・release.py は
GitHub Actions（公開リポジトリ）からも動くので、完全な値を標準出力に出すと Actions のログに
残り続ける。突き合わせに使えるだけの長さは残しつつ、そのまま API を叩けない形にする。

置き場所: 元は kb_upload.py 単独の実装だった（PR #177）。console_api.py（延いては
cloud_deploy.py / release.py）でも app_id の UUID を落とす必要が出たため、認証まわりの
依存（console_api）を持ち込まずに済むよう、ここへ切り出した（Issue #178）。
kb_upload.py・console_api.py はどちらもこのモジュールだけを import する（相互 import しない）。
"""
import re

_UUID_RE = re.compile(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b")


def short_id(v):
    """UUID・ID を先頭 8 文字だけにする（CLAUDE.md §2-10）。"""
    v = "" if v is None else str(v)
    return v if len(v) <= 8 else v[:8] + "…"


def mask_ids(text):
    """文字列中の UUID をすべて先頭 8 文字に落とす（CLAUDE.md §2-10）。

    成功時のログより、**エラー時のほうが漏れやすい**。HTTP エラーの message には
    リクエストパス（/datasets/<dataset id>/... や /console/api/apps/<app id>/...）が入り、
    応答本文にも id が入りうる。公開リポジトリの Actions ログに残るため、raise する前に
    ここを通す。
    """
    return _UUID_RE.sub(lambda m: m.group(0)[:8] + "…", "" if text is None else str(text))
