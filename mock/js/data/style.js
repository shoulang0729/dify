'use strict';
/* mock/js/data/style.js — CAT_STYLE（分類アイコンの SVG path）
   出所: mock/catalog.html（分割前）。設計書 docs/handoff/2026-09-07-split-catalog.md §1・§9-1（PR-B）。
   値は 1 バイトも変えていない（抽出コマンドの再実行で diff ゼロを確認）。 */

/* ============================================================
   2e. 分類の見た目（アイコン）。色は CSS の --cat-<id> 側にある
   SVCS / CATS に埋め込まない（§2-9：顧客版の差し替えはデータ層だけ）。
   ここに無い分類 id は _fallback と既定色 --cat-accent で描画される＝壊れない
   アイコンは本リポジトリで書き起こしたもの。外部アイコン集は使っていない（帰属表記不要）
   viewBox 0 0 24 24 / fill none / stroke currentColor / stroke-width 1.75
   ============================================================ */
const CAT_STYLE = {
  kn: { icon: '<path d="M4 4.5h5.5A2.5 2.5 0 0 1 12 7v12a2.5 2.5 0 0 0-2.5-2.5H4z"/><path d="M20 4.5h-5.5A2.5 2.5 0 0 0 12 7v12a2.5 2.5 0 0 1 2.5-2.5H20z"/>' },
  qa: { icon: '<path d="M12 3.2l7 2.8v5.2c0 4.3-2.9 7.9-7 9.6-4.1-1.7-7-5.3-7-9.6V6z"/><path d="M8.8 12.1l2.3 2.3 4.1-4.6"/>' },
  dc: { icon: '<path d="M13.5 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8.5z"/><path d="M13.5 3.5v5h5"/><path d="M9 13h6"/><path d="M9 16.5h4"/>' },
  lg: { icon: '<path d="M5.5 4.5h8a2 2 0 0 1 2 2v3.5a2 2 0 0 1-2 2h-4l-3.5 2.7v-2.7h-.5a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z"/><path d="M18.5 9.5a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H18v2.6L14.5 17h-3.2"/>' },
  nm: { icon: '<path d="M3.5 20h17"/><path d="M7 20v-6.5"/><path d="M12 20V5.5"/><path d="M17 20v-9.5"/>' },
  en: { icon: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.5"/><path d="M3.5 9h17"/><path d="M9 9v11.5"/><circle cx="15" cy="15" r="2.5"/>' },
  gn: { icon: '<rect x="4" y="4.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4.5" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>' },
  pt: { icon: '<circle cx="9" cy="8" r="3.5"/><path d="M2.8 20v-1a4.7 4.7 0 0 1 4.7-4.7h3a4.7 4.7 0 0 1 4.7 4.7v1"/><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4"/><path d="M17.6 14.6A4.7 4.7 0 0 1 21.2 19v1"/>' },
  /* ---- 金融カタログ新設 5 分類。設計書 2026-09-08-finance-catalog.md §4-10 ---- */
  rs: { icon: '<circle cx="11" cy="11" r="6.5"/><path d="M15.8 15.8 20.5 20.5"/><path d="M8 11h6"/><path d="M11 8v6"/>' },
  cv: { icon: '<circle cx="8.5" cy="8" r="3"/><path d="M3.2 19.5v-1a4.3 4.3 0 0 1 4.3-4.3h2a4.3 4.3 0 0 1 4.3 4.3v1"/><path d="M15 5.5h6"/><path d="M15 9.5h6"/><path d="M15 13.5h4"/>' },
  fa: { icon: '<circle cx="12" cy="12" r="8.2"/><path d="M12 7.3v9.4"/><path d="M15 9.3c0-1.1-1.3-2-3-2s-3 .9-3 2 1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2-3-.9-3-2"/>' },
  po: { icon: '<circle cx="7" cy="7" r="2.6"/><circle cx="17" cy="7" r="2.6"/><circle cx="12" cy="17" r="2.6"/><path d="M8.9 8.9 15.1 15.1"/><path d="M15.1 8.9 8.9 15.1"/>' },
  eg: { icon: '<path d="M14.5 3.5 9.5 20.5"/><path d="M7 8 3 12l4 4"/><path d="M17 8l4 4-4 4"/>' },
  /* ---- IT カタログ新設 1 分類。設計書 2026-09-11-it-industry.md §4-8 ---- */
  so: { icon: '<rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M8.5 20h7"/><path d="M12 16.5V20"/><path d="M6.5 10.5h2.2l1.6-3.2 2.2 6 1.5-2.8h2.5"/>' },
  sl: { icon: '<path d="M3.5 20h17"/><path d="M4.5 16.5 9.5 11l3.5 3.5 6.5-8"/><path d="M15.5 6.5h4v4"/>' },
  _fallback: { icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="2.5"/>' }
};

/* ============================================================
   2f. 業種ロゴ（ヘッダーの会社名の左に置くマーク。PM 追加要件・Issue #120 コメント）
   実在企業のロゴに似せない幾何マーク。色は呼び出し側で currentColor を指定する
   （mock/js/app.js の indLogo()）。SVCS/CATS には持たせない（§2-9 と同じ流儀）
   viewBox は呼び出し側で 0 0 32 24 を指定する
   ============================================================ */
const IND_LOGO = {
  /* 青嶺精工＝「青い稜線」。精密加工の角度を思わせる稜線を二重に重ねた幾何マーク */
  mfg: { icon: '<path d="M2 19 8.5 8 13 14.5 19.5 4 30 19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 22 9 14 13.5 18 20 10 30 22" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>' },
  /* 碧洋銀行＝「碧い海」。水平線（水平線）と左右対称の波の弧 2 本 */
  fin: { icon: '<path d="M3 19h26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M5 13c2-4 6-4 8 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M19 13c2-4 6-4 8 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' },
  /* 翠雲システムズ（IT）＝「N」字のストロークと、右に伸びる通信線 3 本。
     設計書 docs/handoff/2026-09-11-it-industry.md §4-8 */
  it: { icon: '<path d="M5 19V5l11 13V5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 8.5h8M21 12h8M21 15.5h5" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" opacity="0.5"/>' }
};
