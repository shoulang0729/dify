#!/usr/bin/env python3
"""scripts/dify/masking.py の単体検証（pytest ではなく、単体で走るスクリプト。test_lang_check.py と同じ作法）。

    python3 scripts/dify/tests/test_masking.py     # exit 0 で全件 PASS。ネットワーク・ファイル I/O 無し

設計根拠: Issue #178（app_id の UUID が公開ログに出ないようにする）。
kb_upload.py にあった short_id()/mask_ids()（PR #177）を masking.py へ切り出したこと、
console_api._mask() が masking.mask_ids() を通すようになったことの回帰検証。

CI（`npm test`）には入れない（`CLAUDE.md` §3 のコマンド集合を変えない）。実行は implementer と reviewer が手で行う。
"""
import os
import sys

TESTS_DIR = os.path.dirname(os.path.abspath(__file__))
SCRIPTS_DIR = os.path.dirname(TESTS_DIR)
sys.path.insert(0, SCRIPTS_DIR)
import masking  # noqa: E402
import console_api  # noqa: E402

RESULTS = []

UUID_1 = "1a2b3c4d-5e6f-7089-90ab-1234567890ab"
UUID_2 = "deadbeef-0000-4000-8000-abcdefabcdef"


def check(name, cond, detail=""):
    RESULTS.append((name, bool(cond), detail))
    mark = "PASS" if cond else "FAIL"
    print(f"[{mark}] {name}" + (f" — {detail}" if detail and not cond else ""))


def test_short_id():
    check("short_id: UUID を先頭 8 文字+…に落とす", masking.short_id(UUID_1) == "1a2b3c4d…", masking.short_id(UUID_1))
    check("short_id: 8 文字以下の短い文字列はそのまま", masking.short_id("kn2") == "kn2", masking.short_id("kn2"))
    check("short_id: ちょうど 8 文字はそのまま", masking.short_id("12345678") == "12345678", masking.short_id("12345678"))
    check("short_id: None は空文字", masking.short_id(None) == "", repr(masking.short_id(None)))


def test_mask_ids_uuid():
    text = f"app_id={UUID_1}"
    masked = masking.mask_ids(text)
    check("mask_ids: UUID を含む文字列から完全な UUID が消える", UUID_1 not in masked, masked)
    check("mask_ids: 先頭 8 文字は残る", masked.startswith("app_id=1a2b3c4d"), masked)


def test_mask_ids_two_uuids():
    text = f"DSL インポート完了: app_id={UUID_1}（confirm={UUID_2}）"
    masked = masking.mask_ids(text)
    check("mask_ids: 2 個の UUID を含む文字列から 1 個目が消える", UUID_1 not in masked, masked)
    check("mask_ids: 2 個の UUID を含む文字列から 2 個目が消える", UUID_2 not in masked, masked)
    check("mask_ids: 両方とも先頭 8 文字は残る",
          "1a2b3c4d" in masked and "deadbeef" in masked, masked)


def test_mask_ids_none_and_short():
    check("mask_ids: None は空文字", masking.mask_ids(None) == "", repr(masking.mask_ids(None)))
    check("mask_ids: UUID を含まない短い文字列はそのまま", masking.mask_ids("kn2") == "kn2", masking.mask_ids("kn2"))
    check("mask_ids: UUID を含まない文はそのまま",
          masking.mask_ids("公開完了: app_id=kn2") == "公開完了: app_id=kn2", masking.mask_ids("公開完了: app_id=kn2"))


def test_console_api_mask_extends_uuid():
    """console_api._mask() が masking.mask_ids() を通し、既存の Bearer / app- パターンも壊れていないこと。"""
    msg = f"公開完了: app_id={UUID_1}"
    masked = console_api._mask(msg)
    check("console_api._mask: UUID の app_id がマスクされる", UUID_1 not in masked, masked)

    msg2 = "HTTP 401 POST /console/api/login: Authorization: Bearer abcdef123456 app-XyZ09aaaaaaaaaaaaaaaa leaked"
    masked2 = console_api._mask(msg2)
    check("console_api._mask: Bearer の値は従来どおりマスクされる",
          "abcdef123456" not in masked2 and "Bearer ***" in masked2, masked2)
    check("console_api._mask: app-... の値は従来どおりマスクされる",
          "XyZ09aaaaaaaaaaaaaaaa" not in masked2 and "app-***" in masked2, masked2)

    msg3 = f"DSL インポート完了: app_id={UUID_1}（status=completed）"
    masked3 = console_api._mask(msg3)
    check("console_api._mask: 実際の DSL インポート完了メッセージから UUID が消える", UUID_1 not in masked3, masked3)

    msg4 = f"公開完了: app_id={UUID_1}"
    masked4 = console_api._mask(msg4)
    check("console_api._mask: 公開完了メッセージから UUID が消える", UUID_1 not in masked4, masked4)


def main():
    test_short_id()
    test_mask_ids_uuid()
    test_mask_ids_two_uuids()
    test_mask_ids_none_and_short()
    test_console_api_mask_extends_uuid()

    failed = [name for name, ok, _ in RESULTS if not ok]
    print()
    print(f"{len(RESULTS) - len(failed)}/{len(RESULTS)} PASS")
    if failed:
        print("FAILED:")
        for name in failed:
            print(f"  - {name}")
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
