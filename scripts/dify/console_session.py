#!/usr/bin/env python3
"""Dify Cloud のコンソールセッションを単体で操作する CLI（`op: token_refresh` / `op: token_revoke` の実体）。

    python3 scripts/dify/console_session.py --env cloud-master refresh   # 既定。本 PR（PR-3）で実装
    python3 scripts/dify/console_session.py --env cloud-master revoke    # PR-4 で追加予定（未実装）

`refresh`（既定）：`console_api.client_from_env()` で `DIFY_CONSOLE_REFRESH` を使ってセッションを
確立する（rotate した値は `DIFY_REFRESH_SINK` が設定されていれば `console_api.py` が自動で
書き出す。このモジュールは sink を意識しない）。続けて `list_apps()` を **1 回だけ** 呼んで
「セッションが本当に使えること」を確かめ、件数だけを出す。**`logout()` は呼ばない**
（次回の実行でもこのセッションを引き継ぐため。書き戻し運用の本体。設計書 §4-6）。

Dify のアプリ・KB を書き換える API は一切呼ばない（`list_apps()` の GET のみ）。

`revoke` はこの PR ではまだ実装しない（PR-4 で `client.logout()` ＋ sink ファイルの削除を追加する）。

終了コード（`console_api._print_and_exit_for_error` と同じ表。0/2/3/4）:
    0 セッションが有効（`list_apps()` まで成功）
    2 引数・環境・認証情報の不備（`DIFY_CONSOLE_REFRESH` 未設定等）
    3 認証エラー（401/403。セッション期限切れ・CSRF 不一致）
    4 Cloudflare に弾かれた（403 かつ本文に `error code: 1010`）

値をログに出さない：本モジュールの出力はすべて `console_api.log()`（`_mask()` を通す）を使う
（`CLAUDE.md` §2-10）。

設計: docs/handoff/2026-09-09-refresh-token-writeback.md §4-6（Issue #212 PR-3）
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import console_api  # noqa: E402  (scripts/dify/console_api.py。上の sys.path.insert が必要)
import cloud_deploy  # noqa: E402  (env.yml の読み方・console_url 解決を再利用するだけ。書き換えない)


def resolve_console_url(env_name):
    """cloud_deploy.py の preflight/main() と同じ読み方（優先順）:
    DIFY_CONSOLE_URL（環境変数）> dify/env/<env>/env.yml の dify.console_url。"""
    _, env_raw = cloud_deploy.load_env_raw(env_name)
    return os.environ.get("DIFY_CONSOLE_URL", "").strip() or cloud_deploy.expand(
        (env_raw.get("dify") or {}).get("console_url") or ""
    )


def _exit_code_for_error(e):
    """例外を終了コード表（0/2/3/4）に変換する。TOKEN_HELP は認証エラーのときだけ表示する。"""
    console_api.log(str(e))
    if isinstance(e, console_api.ConsoleCloudflareBlockedError):
        return 4
    if isinstance(e, console_api.ConsoleAuthError):
        console_api.log(console_api.TOKEN_HELP)
        return 3
    return 2


def cmd_refresh(console_url, timeout):
    """DIFY_CONSOLE_REFRESH でセッションを確立し、list_apps() が通ることだけを確認する。
    logout はしない（設計書 §4-6）。戻り値: 終了コード（int）。"""
    try:
        client = console_api.client_from_env(console_url, timeout=timeout)
    except console_api.ConsoleAPIError as e:
        return _exit_code_for_error(e)

    try:
        apps = client.list_apps()
    except console_api.ConsoleAPIError as e:
        return _exit_code_for_error(e)

    console_api.log(
        f"token_refresh: セッションは有効です（アプリ {len(apps)} 件を確認）。logout はしません"
        "（次回の実行でもこのセッションを引き継ぎます）。"
    )
    return 0


def cmd_revoke(console_url, timeout):
    """PR-4 で実装予定（client.logout() ＋ sink ファイルの削除）。本 PR では未実装。"""
    console_api.log("console_session.py revoke はまだ実装されていません（PR-4 で追加予定）。")
    return 2


def build_arg_parser():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("action", nargs="?", default="refresh", choices=["refresh", "revoke"],
                     help="refresh（既定。本 PR で実装）。revoke は PR-4 で追加予定（現時点では未実装）")
    ap.add_argument("--env", default=os.environ.get("DIFY_ENV") or "cloud-master",
                     help="dify/env/<env>/env.yml（既定 $DIFY_ENV、無ければ cloud-master）")
    ap.add_argument("--timeout", type=int, default=60, help="Console API 呼び出しのタイムアウト秒（既定 60）")
    return ap


def main():
    args = build_arg_parser().parse_args()
    try:
        console_url = resolve_console_url(args.env)
    except cloud_deploy.CloudDeployError as e:
        console_api.log(f"[STOP] {e}")
        return 2
    if args.action == "refresh":
        return cmd_refresh(console_url, args.timeout)
    return cmd_revoke(console_url, args.timeout)


if __name__ == "__main__":
    sys.exit(main())
