#!/usr/bin/env python3
"""Dify Cloud のコンソールセッションを単体で操作する CLI
（`op: token_refresh` / `op: token_revoke` / `op: site_probe` の実体）。

    python3 scripts/dify/console_session.py --env cloud-master refresh      # 既定。PR-3 で実装
    python3 scripts/dify/console_session.py --env cloud-master revoke      # PR-4 で実装
    python3 scripts/dify/console_session.py --env cloud-master site_probe  # 本 PR（Issue #124）で実装

`refresh`（既定）：`console_api.client_from_env()` で `DIFY_CONSOLE_REFRESH` を使ってセッションを
確立する（rotate した値は `DIFY_REFRESH_SINK` が設定されていれば `console_api.py` が自動で
書き出す。このモジュールは sink を意識しない）。続けて `list_apps()` を **1 回だけ** 呼んで
「セッションが本当に使えること」を確かめ、件数だけを出す。**`logout()` は呼ばない**
（次回の実行でもこのセッションを引き継ぐため。書き戻し運用の本体。設計書 §4-6）。

`revoke`（手動キルスイッチ。B3'。設計書 §4-4・§4-6）：`console_api.client_from_env()` でセッションを
確立し、`client.logout()` で **Dify サーバ側のセッションを無効化する**。続けて、
`DIFY_REFRESH_SINK` が設定されていてファイルが存在すれば**削除する**（このセッションはもう
死んでいるので、後続の書き戻しステップに死んだ値を渡させないため）。
**`logout()` に失敗しても sink の削除は試みる**（安全側＝次回の実行を確実に止める。
サーバ側を殺せたかどうかに関わらず、少なくとも「死んだ値を書き戻させない」ことだけは保証する）。
**`DIFY_CONSOLE_REFRESH` 自体の削除は、この Python プロセスの中では行わない**（`gh secret delete`
は workflow のシェル側が行う。`CLAUDE.md` §2-10・`tools/verify.mjs` §15 に抵触しないため）。

`site_probe`（読み取り専用の実機プローブ。Issue #124）：`console_api.client_from_env()` で
セッションを確立し、`list_apps()`（**変更なしでそのまま呼ぶだけ**）の応答 1 件目を調べる。
まだ公開 Web アプリの URL（サイトコード）がどのフィールドに入るか実機で確認できていないため、
**特定のフィールドを決め打ちで読まない**。代わりに (1) 1 件目のトップレベルのキー名一覧、
(2) 名前に "site" を含むキーがあればその配下のキー名一覧、(3) `https://` で始まる文字列値が
あればキー経路と値、の 3 点だけを出す。名前に `api_key`/`token`/`secret` を含むキーは
**配下ごと読まない**（値はおろか、その下に隠れた URL も対象にしない。安全側）。
見つからなければ「見つからなかった」と明示する（黙って空を出さない）。

Dify のアプリ・KB を書き換える API は一切呼ばない（`refresh` は `list_apps()` の GET のみ、
`revoke` は `logout()` の POST のみ、`site_probe` も `list_apps()` の GET のみ）。

終了コード（`console_api._print_and_exit_for_error` と同じ表。0/2/3/4）:
    0 セッションが有効（`refresh`：`list_apps()` まで成功／`revoke`：`logout()` まで成功／
      `site_probe`：`list_apps()` まで成功。URL が見つかったかどうかは終了コードに含めない＝
      見つかる・見つからないのどちらも正常な観測結果）
    2 引数・環境・認証情報の不備（`DIFY_CONSOLE_REFRESH` 未設定等）
    3 認証エラー（401/403。セッション期限切れ・CSRF 不一致）
    4 Cloudflare に弾かれた（403 かつ本文に `error code: 1010`）

値をログに出さない：本モジュールの出力はすべて `console_api.log()`（内部で `_mask()` を通し、
UUID 形式の値は `masking.mask_ids()` 経由で先頭 8 文字に丸められる）を使う（`CLAUDE.md` §2-10）。
`site_probe` が出す `https://` の URL だけは値ごと出す（公開 Web アプリの URL は公開されるべき
値であり、`CLAUDE.md` §2-10 は架空データのみの環境の URL を公開 Pages に載せてよいと明示している。
`cloud-master` の 12 本は PM が架空データのみと確認済み）。

設計: docs/handoff/2026-09-09-refresh-token-writeback.md §4-4・§4-6（Issue #212 PR-3・PR-4）
"""
import argparse
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import console_api  # noqa: E402  (scripts/dify/console_api.py。上の sys.path.insert が必要。list_apps() は変更せずそのまま呼ぶ)
import cloud_deploy  # noqa: E402  (env.yml の読み方・console_url 解決を再利用するだけ。書き換えない)
# masking.py はここでは直接 import しない：site_probe の出力はすべて console_api.log() を通し、
# その内部の _mask() が masking.mask_ids() を既に適用する（UUID 形式の値が紛れていれば丸められる）。
# console_api.py・kb_upload.py と同じ二重 import を避けるための整理（Issue #178 の設計方針どおり）。

# site_probe: 名前にこれを含むキーの配下は一切読まない（値はもちろん、その下に隠れた
# https:// の値も対象にしない。安全側。Issue #124）。
_SECRET_LIKE_KEY_RE = re.compile(r"(api_key|token|secret)", re.IGNORECASE)


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
    """手動キルスイッチ（B3'。設計書 §4-4・§4-6）：DIFY_CONSOLE_REFRESH でセッションを確立し、
    client.logout() で Dify サーバ側のセッションを無効化する。続けて、DIFY_REFRESH_SINK が
    設定されていてファイルが存在すれば削除する（このセッションはもう死んでいるので、後続の
    書き戻しステップに死んだ値を渡させないため）。

    logout() に失敗しても sink の削除は試みる（安全側。サーバ側を殺せなくても、少なくとも
    「死んだ値を次回の書き戻しに使わせない」ことだけは保証する）。
    DIFY_CONSOLE_REFRESH（GitHub の Environment secret）自体の削除はここでは行わない
    （workflow のシェル側が `gh secret delete` で行う。§4-4）。

    戻り値: 終了コード（int）。client_from_env() / logout() の失敗はそれぞれ通常の終了コード表
    （0/2/3/4）に従う。"""
    try:
        client = console_api.client_from_env(console_url, timeout=timeout)
    except console_api.ConsoleAPIError as e:
        rc = _exit_code_for_error(e)
    else:
        try:
            client.logout()
            console_api.log(
                "token_revoke: logout 完了（Dify 側のセッションを無効化しました）。"
            )
            rc = 0
        except console_api.ConsoleAPIError as e:
            rc = _exit_code_for_error(e)

    # logout の成否に関わらず、sink ファイルが残っていれば削除する（安全側。設計書 §4-6）。
    sink_path = os.environ.get(console_api.REFRESH_SINK_ENV, "").strip()
    if sink_path and os.path.isfile(sink_path):
        os.remove(sink_path)
        console_api.log("token_revoke: sink ファイルを削除しました（死んだ値を書き戻させないため）。")

    return rc


# ---------------------------------------------------------------------------
# site_probe（Issue #124）：公開 Web アプリの URL が /console/api/apps の応答に
# 含まれるかを、実機で確かめる読み取り専用プローブ。
# ---------------------------------------------------------------------------

def _top_level_key_names(d):
    """dict のトップレベルのキー名だけを返す（値は見ない）。dict でなければ空リスト。"""
    return sorted(d.keys()) if isinstance(d, dict) else []


def _find_https_values(node, path=""):
    """node を再帰的に走査し、`https://` で始まる文字列値を (キー経路, 値) の一覧で返す。

    名前が `_SECRET_LIKE_KEY_RE`（api_key/token/secret を含む）に一致するキーは、
    **配下ごと**走査の対象から外す（そのキーの値そのものだけでなく、その下にネストして
    隠れている https:// の値も対象にしない。安全側。Issue #124 の要件 4）。"""
    hits = []
    if isinstance(node, dict):
        for key, value in node.items():
            if _SECRET_LIKE_KEY_RE.search(str(key)):
                continue
            hits.extend(_find_https_values(value, f"{path}.{key}" if path else str(key)))
    elif isinstance(node, list):
        for i, value in enumerate(node):
            hits.extend(_find_https_values(value, f"{path}[{i}]"))
    elif isinstance(node, str) and node.startswith("https://"):
        hits.append((path or "(root)", node))
    return hits


def cmd_site_probe(console_url, timeout):
    """DIFY_CONSOLE_REFRESH でセッションを確立し、list_apps()（変更なし・GET のみ）の応答
    1 件目を読み取り専用で調べる。出す情報は 3 点だけ（docstring 参照）。

    戻り値: 終了コード（int）。URL が見つかったかどうかは終了コードに含めない（0 は
    「list_apps() までは成功した」という意味。見つかる／見つからないのどちらも正常な観測結果）。"""
    try:
        client = console_api.client_from_env(console_url, timeout=timeout)
    except console_api.ConsoleAPIError as e:
        return _exit_code_for_error(e)

    try:
        apps = client.list_apps()
    except console_api.ConsoleAPIError as e:
        return _exit_code_for_error(e)

    console_api.log(f"site_probe: アプリ {len(apps)} 件を取得しました（list_apps() は変更していません）")

    if not apps:
        console_api.log("site_probe: 見つかりませんでした（アプリが 1 件もありません）")
        return 0

    first = apps[0]
    if not isinstance(first, dict):
        console_api.log(f"site_probe: 見つかりませんでした（1 件目が dict ではありません。型: {type(first).__name__}）")
        return 0

    top_keys = _top_level_key_names(first)
    console_api.log(f"site_probe: 1 件目のトップレベルキー名一覧: {top_keys}")

    site_like_keys = [k for k in top_keys if "site" in k.lower()]
    if not site_like_keys:
        console_api.log("site_probe: 見つかりませんでした（'site' を名前に含むキーがありません）")
    for key in site_like_keys:
        value = first.get(key)
        if isinstance(value, dict):
            console_api.log(f"site_probe: '{key}' 配下のキー名一覧: {_top_level_key_names(value)}")
        elif isinstance(value, list) and value and isinstance(value[0], dict):
            console_api.log(f"site_probe: '{key}'（リストの 1 件目）配下のキー名一覧: {_top_level_key_names(value[0])}")
        else:
            console_api.log(f"site_probe: '{key}' は dict／dict のリストではありません（型: {type(value).__name__}。値は出しません）")

    urls = _find_https_values(first)
    if not urls:
        console_api.log("site_probe: 見つかりませんでした（https:// で始まる値がありません）")
    for path, value in urls:
        # ここだけ値ごと出す（公開 Web アプリの URL は公開されるべき値。CLAUDE.md §2-10。
        # docstring 参照）。masking.mask_ids() は console_api.log() 内の _mask() 経由で
        # 適用される（URL に UUID 形式の値が紛れていればそこだけ丸められる）。
        console_api.log(f"site_probe: https:// の値を発見: {path} = {value}")

    return 0


def build_arg_parser():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("action", nargs="?", default="refresh", choices=["refresh", "revoke", "site_probe"],
                     help="refresh（既定。セッションを維持したまま有効性だけ確認）。"
                          "revoke（手動キルスイッチ。logout してセッションを無効化する。B3'）。"
                          "site_probe（読み取り専用。list_apps() の応答に公開 Web アプリの URL らしき"
                          "値が含まれるかを調べる。Issue #124）")
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
    if args.action == "site_probe":
        return cmd_site_probe(console_url, args.timeout)
    return cmd_revoke(console_url, args.timeout)


if __name__ == "__main__":
    sys.exit(main())
