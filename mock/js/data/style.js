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
  _fallback: { icon: '<rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="2.5"/>' }
};
