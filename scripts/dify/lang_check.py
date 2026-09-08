#!/usr/bin/env python3
"""応答言語の判定（純関数）。ネットワーク・ファイル I/O を持たない。

設計: docs/handoff/2026-09-08-response-language-contract.md §4-3（判定ロジック）。
`scripts/dify/run_tests.py` から `judge_lang()` を import して使う。

手順（§4-3 のとおり）
  1. 除外領域を落として「地の文」を作る（コードブロック → インラインコード →
     引用ブロック → 表の区切り行 → URL/メール → 引用符の中 → 括弧の中 →
     lang_allow → ASCII・数字・記号・空白・絵文字）
  2. 残った文字列で かな／CJK 漢字／JA_ONLY_HAN／ZH_MARKER を数える
  3. expect_lang ごとに判定する（§4-3 手順3 の表のとおり）

表の区切り行について（実装上の注記）
  設計書 §4-3 の除外 #4 は「表の行」を落とす理由として、NM-03 のような
  KPI 集計表で入力の値ラベル（`产量`・`计划`）が地の文に紛れ込むことを挙げている。
  一方 DC-02・LG-01 のように、表のセルに完全な文（決定事項・宿題など）を書く
  アプリがある。表の行を丸ごと落とすと、そういうアプリの mixed 判定
  （§4-7 #14 DC-02 T02＝OK が期待値）に必要な「両言語が地の文に存在する」証拠まで
  消えてしまう（実機ログで確認済み）。そのため、ここで落とすのは罫線だけの区切り行
  （`|---|---|` の類）に限り、セルの中身（文章）は残す。ラベル 1〜2 語だけの
  KPI 表のラベルは数文字にとどまり、地の文全体は日本語が主体になるため、
  `ja` の FAIL 条件（かな比率 < 10%）に届かない（NM-03 T01 の実測：かな 48・漢字 82、
  かな比率 ≒ 37%）。短文ガード（han < 20）が効いているのではない。
"""
import re
import unicodedata

# 文字集合（観測済みの字だけを足す運用。§4-3「文字集合（初期値）」）
JA_ONLY_HAN = set(
    "順拠説現実対発産経検図価変応総単収営続険験覧済気転売読訳"
    "圧労権従帰帳達録認議課連絡確準拡増戻緊練級給齢頼顧難額類"
    "題頻働込畑峠"
)
ZH_MARKER = set(
    "这个们说请应确时关无为该须处结员议认计报产电长门问间见"
    "货质费资车东马农汉观边达运连进远还过"
)

# 除外領域（§4-3 手順1。上から順に適用する）
_FENCE_RE = re.compile(r"```.*?```", re.S)                       # 1: フェンス付きコードブロック
_INLINE_CODE_RE = re.compile(r"`[^`\n]*`")                       # 2: インラインコード
_BLOCKQUOTE_RE = re.compile(r"^[ \t]{0,3}>.*$", re.M)             # 3: 引用ブロック（行頭 >）
_TABLE_RULE_RE = re.compile(r"^[ \t]{0,3}\|[\s\-:|]*$", re.M)     # 4: 表の区切り行（罫線のみ。上のコメント参照）
_URL_RE = re.compile(r"https?://\S+")                             # 5: URL
_EMAIL_RE = re.compile(r"[\w.+-]+@[\w.-]+\.\w+")                  # 5: メールアドレス
_QUOTE_RE = re.compile(                                           # 6: 引用符の中（行をまたがない・非貪欲）
    r"「[^\n「」]*」|『[^\n『』]*』|《[^\n《》]*》|"
    r"\"[^\n\"]*\"|“[^\n”]*”|'[^\n']*'"
)
_PAREN_RE = re.compile(                                            # 7: 括弧の中（行をまたがない・非貪欲・入れ子非対応）
    r"（[^\n（）]*）|\([^\n()]*\)|〔[^\n〔〕]*〕"
)

_KANA_RANGES = ((0x3041, 0x309F), (0x30A1, 0x30FA), (0x30FC, 0x30FF))  # U+30FB（・）は除く
_HAN_RANGE = (0x4E00, 0x9FFF)

VALID_EXPECT_LANG = ("ja", "zh", "mixed", "none")


def _strip_excluded(text, lang_allow):
    """除外領域を落として「地の文」を作る（§4-3 手順1）。"""
    s = text or ""
    s = _FENCE_RE.sub("", s)
    s = _INLINE_CODE_RE.sub("", s)
    s = _BLOCKQUOTE_RE.sub("", s)
    s = _TABLE_RULE_RE.sub("", s)
    s = _URL_RE.sub("", s)
    s = _EMAIL_RE.sub("", s)
    s = _QUOTE_RE.sub("", s)
    s = _PAREN_RE.sub("", s)
    for w in lang_allow or []:
        if w:
            s = s.replace(w, "")
    # 9: ASCII・数字・記号・空白・絵文字を落とす（Unicode の「文字」カテゴリだけ残す）
    return "".join(c for c in s if unicodedata.category(c).startswith("L"))


def _is_kana(ch):
    cp = ord(ch)
    return any(lo <= cp <= hi for lo, hi in _KANA_RANGES)


def _is_han(ch):
    return _HAN_RANGE[0] <= ord(ch) <= _HAN_RANGE[1]


def _counts(body):
    """§4-3 手順2：かな／漢字／JA_ONLY_HAN／ZH_MARKER を数える。"""
    kana = sum(1 for c in body if _is_kana(c))
    han = sum(1 for c in body if _is_han(c))
    ja_only = [c for c in body if c in JA_ONLY_HAN]
    zh_mark = [c for c in body if c in ZH_MARKER]
    return kana, han, ja_only, zh_mark


def _snippet(body, idx, before=10, after=6):
    s = body[max(0, idx - before): idx + after].replace("\n", " ")
    return s


def judge_lang(text, expect_lang, lang_allow=None):
    """地の文の言語を判定する（§4-3 手順3）。

    戻り値: (ok: bool, detail: str)
      ok=True かつ detail="—"                 … expect_lang が none（検査しない）
      ok=True かつ detail="—（地の文なし）"    … 除外後に地の文が空（判定不能。PASS+warn 扱い）
      ok=True かつ detail="OK"                 … 判定した上で合格
      ok=False かつ detail="NG: …"             … 判定した上で不合格（理由つき）
    """
    if not expect_lang or expect_lang == "none":
        return True, "—"

    body = _strip_excluded(text, lang_allow)
    if not body.strip():
        return True, "—（地の文なし）"

    kana, han, ja_only, zh_mark = _counts(body)

    if expect_lang == "zh":
        if kana >= 1:
            idx = next(i for i, c in enumerate(body) if _is_kana(c))
            return False, f"NG: 地の文にかな {kana} 字（例「{_snippet(body, idx)}」）"
        if ja_only:
            uniq = "・".join(sorted(set(ja_only)))
            return False, f"NG: 日本語の字 {len(ja_only)} 件（{uniq}）"
        return True, "OK"

    if expect_lang == "ja":
        if han >= 20 and (kana / (kana + han)) < 0.10:
            ratio = kana / (kana + han)
            return False, f"NG: 地の文が中国語寄り（漢字 {han} 字・かな比率 {ratio:.0%}）"
        return True, "OK"

    if expect_lang == "mixed":
        if kana >= 1 and zh_mark:
            return True, "OK"
        return False, f"NG: 両言語が揃っていない（かな {kana} 字・簡体字 {len(zh_mark)} 字）"

    # 未知の値。--dry-run のスキーマ検査（run_tests.py）が別途弾く想定
    return True, "—"
