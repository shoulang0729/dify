'use strict';
/* mock/js/data/portal/org.js — PORG（自部門の架空データ：チーム所属・ログイン中の利用者）
   出所: scratchpad/portal-mock/portal.html。設計書 docs/handoff/2026-09-11-portal-mock-pages.md §3-1・§4-2。

   翠雲システムズは data/world/ に無い 3 つ目の架空世界（自部門）。v1 はこのファイルを正本とし、
   data/world/ への昇格は別 Issue（設計書 §13 Q4）。

   純粋なリテラル宣言のみ（document・localStorage・関数呼び出しを書かない）。 */

const PORG = {
  /* 氏名 → 所属チーム。案件パイプラインのチーム絞り込みに使う */
  team: {
    '篠崎 悠真': '製造', '蔡 文博': '製造', '黄 思涵': '金融', '村井 拓也': '営業', '岸本 奈津': 'PMO'
  },
  /* ログイン中の利用者（ポータルの主語）。§5-3：ヘッダの主語はこのログイン中の利用者 */
  persona: { name: '岸本 奈津', avatar: 'KN' }
};
