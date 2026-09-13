'use strict';
/* mock/js/data/portal/org.js — PORG（自部門の架空データ：チーム所属）／ PCOMPANY（業種別の会社・部門・拠点）
   出所: scratchpad/portal-mock/portal.html。設計書 docs/handoff/2026-09-11-portal-mock-pages.md §3-1・§4-2。
   rev4（docs/handoff/2026-09-12-portal-industry-rev4.md §5）でポータルが「業種ごとに会社が替わる
   3 つの部門ポータル」になったのに合わせ、PORG.persona は削除（ログイン中の人は業種ごとに
   mock/js/data/home.js の FEED[業種].persona を読む。§5-3）。

   翠雲システムズは data/world/ に無い 3 つ目の架空世界（自部門）。v1 はこのファイルを正本とし、
   data/world/ への昇格は別 Issue（設計書 §13 Q4）。

   純粋なリテラル宣言のみ（document・localStorage・関数呼び出しを書かない）。 */

const PORG = {
  /* 氏名 → 所属チーム。案件パイプラインのチーム絞り込みに使う（proj は IT 専用画面のまま） */
  team: {
    '篠崎 悠真': '製造', '蔡 文博': '製造', '黄 思涵': '金融', '村井 拓也': '営業', '岸本 奈津': 'PMO'
  }
};

/* ============================================================
   PCOMPANY — 業種別の会社・部門・拠点（rev4 §5-2。新設）。
   会社名・部門名は INDUSTRIES[].wordmark / dept が正本（二重に持たない）。
   ここが持つのは「拠点と期」「閲覧範囲」「アバターの 2 文字」「担当者の最終接触の基準日
   （PCONTACT の鮮度判定。PR-C §8-3 で使う）」だけ。
   ============================================================ */
const PCOMPANY = {
  mfg: {
    av: 'LQ',
    fy: 'FY2025',
    site:  { ja: '蘇州工場 ／ 2025 年 9 月',   zh: '苏州工厂 ／ 2025 年 9 月',   en: 'Suzhou Plant / September 2025' },
    scope: { ja: '製造二課 ／ 自課の受注・品質を閲覧', zh: '制造二科 ／ 查看本科的订单与质量', en: 'Mfg. Sec. 2 / own orders and quality' },
    staleBefore: '2025-08-01'
  },
  fin: {
    av: 'HX',
    fy: 'FY2026',
    site:  { ja: '上海本部 ／ FY2026 上期',   zh: '上海总部 ／ FY2026 上半年',   en: 'Shanghai Head Office / FY2026 H1' },
    scope: { ja: '事務統括部 ／ 全行の事務を閲覧', zh: '事务统筹部 ／ 查看全行事务', en: 'Operations Planning / bank-wide' },
    staleBefore: '2026-08-01'
  },
  it: {
    av: 'KN',
    fy: 'FY2026',
    site:  { ja: '上海 ／ FY2026 上期',       zh: '上海 ／ FY2026 上半年',       en: 'Shanghai / FY2026 H1' },
    scope: { ja: 'PMO ／ 全案件 閲覧',        zh: 'PMO ／ 可查看全部项目',        en: 'PMO / all projects' },
    staleBefore: '2026-08-01'
  }
};

/* ============================================================
   PWORLD — 行の世界（顧客名 → 架空世界の業種 id）。設計書 §14-5。
   data/world/it/clients.csv の ref_world 列の写し（新しい世界の情報を足しているわけではない。
   CLAUDE.md §2-13）。キーは PDEALS[].cu と過不足なく一致する（verify §17-k）。
   ref_world が空（α 社・β 社）＝ IT 世界の内側なので 'it'。
   ============================================================ */
const PWORLD = { '青嶺精工': 'mfg', '碧洋銀行': 'fin', 'α 社': 'it', 'β 社': 'it' };
