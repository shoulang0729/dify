'use strict';
/* mock/js/data/portal/ui.js — PT（ラベル辞書）/ PSCREENS（画面台帳）/ PGRP（グループ順）/
   PHOW / PHOWLONG（置き方の説明）/ PST（成熟度バッジ）/ PSRC（KPI の出所ラベル）
   出所: scratchpad/portal-mock/portal.html（PM が作り込んだ単一 HTML のコンセプトモック）。
   設計書 docs/handoff/2026-09-11-portal-mock-pages.md §3-1・§4-2。
   純粋なリテラル宣言のみ（document・localStorage・関数呼び出しを書かない）。 */

/* ============================================================
   PT — ラベル辞書（ナビ・グループ見出し・ブランド・環境チップ・ロール・テーマ切替・業種チップ）
   ja/zh/en 完全一致（CLAUDE.md §2-1・verify §17-e）。
   画面本文（見出し・表ヘッダ・解説散文）は v1 では訳さない（設計書 §7-1・PM 判断 §13 Q1）。
   ============================================================ */
const PT = {
  /* ---- ナビ（画面ラベル。15 画面） ---- */
  home: { ja: 'ホーム', zh: '首页', en: 'Home' },
  cust: { ja: '顧客', zh: '客户', en: 'Customers' },
  proj: { ja: '案件', zh: '项目', en: 'Projects' },
  act:  { ja: 'To Do', zh: '待办', en: 'To Do' },
  ppl:  { ja: '要員', zh: '人员', en: 'People' },
  trn:  { ja: '研修・サーベイ', zh: '培训与调研', en: 'Training & Surveys' },
  meet: { ja: '会議', zh: '会议', en: 'Meetings' },
  exp:  { ja: '経費・経理', zh: '费用与财务', en: 'Expenses & Finance' },
  req:  { ja: '申請・承認', zh: '申请与审批', en: 'Requests' },
  watch:{ ja: 'ニュース・ウォッチ', zh: '资讯监控', en: 'News Watch' },
  vend: { ja: '仕入先・パートナー', zh: '供应商与合作伙伴', en: 'Suppliers' },
  know: { ja: 'ナレッジ', zh: '知识库', en: 'Knowledge' },
  kpi:  { ja: 'KPI', zh: 'KPI', en: 'KPI' },
  goal: { ja: '目標', zh: '目标', en: 'Goals' },
  ai:   { ja: 'AI サービス', zh: 'AI 服务', en: 'AI Services' },

  /* ---- グループ見出し ---- */
  gFront: { ja: 'フロント業務', zh: '前台业务', en: 'Front office' },
  gCommon:{ ja: '共通業務', zh: '共通业务', en: 'Shared' },
  gMgmt:  { ja: 'マネジメント', zh: '管理', en: 'Management' },
  gBack:  { ja: 'バック業務', zh: '后台业务', en: 'Back office' },

  /* ---- ブランド ---- */
  brand: { ja: '部門ポータル', zh: '部门门户', en: 'Department Portal' },
  org:   { ja: '翠雲システムズ ソリューション本部', zh: '翠云系统 解决方案本部', en: 'Suiun Systems, Solutions Division' },
  site:  { ja: '上海 ／ FY2026 上期', zh: '上海 ／ FY2026 上半年', en: 'Shanghai / FY2026 H1' },

  /* ---- 環境チップ・ロール・本番との違い・テーマ ---- */
  env:   { ja: 'デモ環境・架空データ', zh: '演示环境・虚构数据', en: 'Demo environment, fictional data' },
  envOn: { ja: 'デモ環境・架空データ（本番の違いを表示中）', zh: '演示环境・虚构数据（显示与生产环境的差异）', en: 'Demo environment (showing differences from production)' },
  role:  { ja: 'PMO ／ 全案件 閲覧', zh: 'PMO ／ 可查看全部项目', en: 'PMO / all projects' },
  prod:  { ja: '本番との違いを表示', zh: '显示与生产环境的差异', en: 'Show production differences' },
  theme: { ja: 'テーマ', zh: '主题', en: 'Theme' },

  /* ---- .mockbar の業種チップの aria-label（足場。§2-4）。チップ本体の文言
     （製造業／金融業／IT 業）は移植元と同じく常に日本語のまま（AC-8：4 トグルの挙動を変えない） ---- */
  indLabel: { ja: '業種', zh: '行业', en: 'Industry' },

  /* ---- .mockbar の見出し・説明（足場。catalog.html の mockbar と同じく言語切替に追随する） ---- */
  mockLabel:  { ja: '概念確認用モック', zh: '概念验证演示', en: 'Concept mock' },
  mockDesc:   { ja: 'NocoBase の実装ではありません。会社・人・数字はすべて架空。この帯はレビュー用の足場で、実画面には出ません。',
                zh: '这不是 NocoBase 的实现。公司・人物・数字均为虚构。此栏为评审用的脚手架，正式画面中不会出现。',
                en: 'This is not a NocoBase implementation. The company, people and numbers are all fictional. This bar is review scaffolding and does not appear in the real screens.' },

  /* ---- 生成した AI ボタンが使う一般フォールバック文言（PSVC に個別の説明が無いサービス用） ---- */
  ctxGeneric: { ja: 'この画面の行（案件 id・顧客・担当者など）', zh: '本画面所在行（项目 id・客户・负责人等）', en: 'The row on this screen (project id, customer, owner, etc.)' },
  outGeneric: { ja: 'カタログの説明を参照', zh: '请参见目录说明', en: 'See the catalog description' },

  /* ---- 閉じるボタンなど、部品としての最小限 ---- */
  close: { ja: '閉じる', zh: '关闭', en: 'Close' },
  /* ---- AI ドロワーの汎用ラベル ---- */
  unnumbered: { ja: '未採番', zh: '未编号', en: 'Unassigned' },
  allScreens: { ja: '全画面', zh: '全部画面', en: 'All screens' }
};

/* ============================================================
   PGRP — ナビのグループ順（renderNav の見出し切り替え判定に使う）
   ============================================================ */
const PGRP = ['gFront', 'gCommon', 'gMgmt', 'gBack'];

/* ============================================================
   PSCREENS — 画面台帳（15 画面）。
   「この画面の AI」ブロックは SVCS[].place から自動生成する（手書きの ai: リストは持たない。
   設計書 §4-4。生成は js/portal/app.js の pscreenAiIds() / pcrossAiIds()）。
   newai: は PNEW（未採番の追加候補）のうち、この画面の末尾に「提案」として出すもの
   （place を持てないため。設計書 §4-4）。
   ============================================================ */
const PSCREENS = [
  { grp: '', id: 'home', icon: 'M3 9l7-6 7 6v8a1 1 0 01-1 1h-4v-5H8v5H4a1 1 0 01-1-1z' },
  { grp: 'gFront', id: 'cust', icon: 'M2 16v-1a4 4 0 014-4h2a4 4 0 014 4v1M7 4a3 3 0 110 6 3 3 0 010-6zM13 16v-1a4 4 0 00-3-3.87', ct: '4',
    newai: ['new1'] },
  { grp: 'gFront', id: 'proj', icon: 'M3 5h5l1.5 2H17v9H3z', ct: '10' },
  { grp: 'gFront', id: 'watch', icon: 'M10 4c-4 0-6.5 3-7 5 .5 2 3 5 7 5s6.5-3 7-5c-.5-2-3-5-7-5zM10 11a2 2 0 100-4 2 2 0 000 4z', ct: '12' },
  { grp: 'gFront', id: 'vend', icon: 'M4 7l6-3 6 3v7l-6 3-6-3zM10 4v13', ct: '3' },
  { grp: 'gCommon', id: 'act', icon: 'M4 10l4 4 8-9', ct: '10' },
  { grp: 'gCommon', id: 'meet', icon: 'M4 4h12v12H4zM4 8h12M8 2v3M12 2v3', ct: '4' },
  { grp: 'gCommon', id: 'know', icon: 'M4 3h9a2 2 0 012 2v12H6a2 2 0 01-2-2z M6 3v14', ct: '12' },
  { grp: 'gCommon', id: 'ai', icon: 'M10 3l2 4 4 2-4 2-2 4-2-4-4-2 4-2z', ct: '67' },
  { grp: 'gMgmt', id: 'kpi', icon: 'M3 17V8M8 17V4M13 17v-6M18 17v-9', ct: '9' },
  { grp: 'gMgmt', id: 'goal', icon: 'M10 2v16M2 10h16M10 5a5 5 0 100 10 5 5 0 000-10z', ct: '4' },
  { grp: 'gMgmt', id: 'ppl', icon: 'M10 10a3 3 0 100-6 3 3 0 000 6zM3 17a7 7 0 0114 0', ct: '5' },
  { grp: 'gBack', id: 'exp', icon: 'M3 6h14v9H3zM3 9h14M6 12h3', ct: '9' },
  { grp: 'gBack', id: 'req', icon: 'M6 3h8v14H6zM8 7h4M8 10h4M8 13h2', ct: '4' },
  { grp: 'gBack', id: 'trn', icon: 'M10 4L3 7.5 10 11l7-3.5zM5.5 9v4c0 1 2 2 4.5 2s4.5-1 4.5-2V9', ct: '16' }
];

/* ============================================================
   PHOW / PHOWLONG — 置き方（btn=ボタンで呼ぶ / embed=画面を埋める / flow=裏で回す）。
   NocoBase 調査結果の要約文なので、調査結果が変われば PHOWLONG の 3 行だけを直す
   （設計書 §2-3 並行設計の関係）。v1 は日本語のみ（§7-1）。
   ============================================================ */
const PHOW = { btn: 'ボタンで呼ぶ', embed: '画面を埋める', flow: '裏で回す' };
const PHOWLONG = {
  btn: 'NocoBase の Custom request アクション。行の文脈（案件 id・顧客名など）を渡して、結果をこの画面に返す。調査では無料版の機能。',
  embed: 'iframe ブロックに Dify の画面をそのまま埋める。稼働中のアプリがそのまま使える一方、ポータルに埋まっている感じは薄い。ログイン状態の引き継ぎは公式ドキュメントに記載がない。',
  flow: 'NocoBase の Workflow から HTTP request ノードで呼び、結果をテーブルに書く。一括・定期処理向け。調査では無料版の機能。'
};

/* ============================================================
   PST — 成熟度バッジ（0=新規/未採番 / 1=提供中 / 2=試行版 / 3=構想）。
   [css クラス, ラベル]。SVCS[].st の値域は 1/2/3（CLAUDE.md §2-7）。
   0 は PNEW（未採番の追加候補）専用で SVCS には現れない。v1 は日本語のみ（§7-1）。
   ============================================================ */
const PST = { 0: ['stn', '新規'], 1: ['st1', '稼働中'], 2: ['st2', '試行版'], 3: ['st3', '構想'] };
