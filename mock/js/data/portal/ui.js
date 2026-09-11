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
  /* ---- ナビ（画面ラベル。画面数は PSCREENS が正本） ---- */
  home: { ja: 'ホーム', zh: '首页', en: 'Home' },
  cust: { ja: '顧客', zh: '客户', en: 'Customers' },
  proj: { ja: '案件', zh: '项目', en: 'Projects' },
  act:  { ja: 'To Do', zh: '待办', en: 'To Do' },
  sys:  { ja: 'システム稼働状況', zh: '系统运行状况', en: 'System Status' },
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
  allScreens: { ja: '全画面', zh: '全部画面', en: 'All screens' },

  /* ---- 実行ドロワー（台本の再生。PR-3。設計書 §5・付録 B。rev2 §14-7 で borrowed → scriptWorldRow/Plain） ---- */
  ctxHead:      { ja: 'この画面から渡す文脈', zh: '本画面传递的上下文', en: 'Context passed from this screen' },
  ctxNote:      { ja: '画面の行から自動で入ります。打ち直しは要りません', zh: '自动取自画面中的行，无需重新输入', en: 'Filled in automatically from the row — no retyping' },
  ctxNoRow:     { ja: '行から呼ぶと、案件 id と顧客名も一緒に渡ります', zh: '从行调用时，项目编号与客户名称也会一并传递', en: 'Call it from a row and the project id and customer name are passed too' },
  autoFilled:   { ja: 'この画面から', zh: '来自本画面', en: 'From this screen' },
  inputHead:    { ja: '入力', zh: '输入', en: 'Input' },
  runLive:      { ja: 'この内容で実行', zh: '按此内容执行', en: 'Run with this' },
  runMock:      { ja: '想定の動きを見る', zh: '查看预期的动作', en: 'See the intended behaviour' },
  runDone:      { ja: '実行しました', zh: '已执行', en: 'Done' },
  resultHead:   { ja: '結果', zh: '结果', en: 'Result' },
  keepResult:   { ja: 'この結果を画面に残す', zh: '将此结果留在画面上', en: 'Keep this result on the screen' },
  kept:         { ja: '画面に残しました', zh: '已留在画面上', en: 'Kept on the screen' },
  rowBack:      { ja: 'AI の戻り', zh: 'AI 的返回', en: 'AI result' },
  rowBackOpen:  { ja: '開く', zh: '打开', en: 'Open' },
  askHead:      { ja: '続けて聞く', zh: '继续提问', en: 'Ask more' },
  chipsLabel:   { ja: '質問例', zh: '提问示例', en: 'Examples' },
  chipJa:       { ja: '日本語', zh: '日语', en: 'Japanese' },
  chipZh:       { ja: '中文', zh: '中文', en: 'Chinese' },
  send:         { ja: '送信', zh: '发送', en: 'Send' },
  chatPh:       { ja: '日本語でも中国語でも入力できます', zh: '日文中文均可输入', en: 'Type in Japanese or Chinese' },
  demoDone:     { ja: '台本はここまでです', zh: '脚本到此结束', en: 'End of the script' },
  scriptLangNote:{ ja: '台本は日本語と中国語だけです。エージェント本体は入力した言語で返します', zh: '脚本仅有日文与中文。智能体会按输入的语言回复', en: 'Scripts exist in Japanese and Chinese only; the agent replies in the language you type' },
  scriptWorldRow:{ ja: 'この台本は{from}の世界のものです。この行の顧客（{cu}）は{want}なので、会話と結果に出る会社名・拠点・品番は台本の世界のものになります',
                   zh: '此脚本取自{from}的虚构世界。本行客户（{cu}）属于{want}，因此对话与结果中出现的公司名称、厂区与品号均来自脚本所在的世界',
                   en: "This script comes from the {from} world. The customer on this row ({cu}) is {want}, so the company names, sites and part numbers in the conversation and result belong to the script's world" },
  scriptWorldPlain:{ ja: 'この台本は{from}の世界のものです。会話と結果に出る会社名・拠点・品番は台本の世界のものです',
                   zh: '此脚本取自{from}的虚构世界。对话与结果中出现的公司名称、厂区与品号均来自该世界',
                   en: "This script comes from the {from} world. The company names, sites and part numbers in the conversation and result belong to that world" },
  noScript:     { ja: 'このサービスには台本を用意していません。渡すもの・返るものだけを出します', zh: '此服务尚未准备脚本，仅展示输入与输出的设想', en: 'No script for this service — only the intended input and output are shown' },
  noPlace:      { ja: '置き場所を決めていない', zh: '尚未确定放置位置', en: 'No screen assigned yet' },
  uploadNote:   { ja: '本番では、この行に付いている添付をそのまま渡します', zh: '正式环境下将直接传递此行的附件', en: 'In production the attachment on this row is passed as-is' },
  openCatalog:  { ja: 'カタログを開く', zh: '打开服务目录', en: 'Open the catalog' },
  screenAi:     { ja: 'この画面の AI', zh: '本画面的 AI', en: 'AI on this screen' },
  crossAi:      { ja: '横断で使う AI', zh: '跨画面使用的 AI', en: 'AI used across screens' },

  /* ---- 文脈カードの行ラベル（PCTXDEF の proj/cust に対応。付録 B の 29 キーには無いが、
     §5-4「ラベルは PT の 3 言語」の要求を満たすために必要な最小限を追加。§7-2 の「半端な 3 言語を
     作らない」ルールに従い ja/zh/en を同時に埋める） ---- */
  ctxProject:   { ja: '案件', zh: '项目', en: 'Project' },
  ctxCustomer:  { ja: '顧客', zh: '客户', en: 'Customer' },
  ctxOwner:     { ja: '担当', zh: '负责人', en: 'Owner' },
  ctxStage:     { ja: 'ステージ', zh: '阶段', en: 'Stage' },
  ctxDue:       { ja: '期限', zh: '截止日期', en: 'Due date' },
  ctxState:     { ja: '状態', zh: '状态', en: 'Status' }
};

/* ============================================================
   PGRP — ナビのグループ順（renderNav の見出し切り替え判定に使う）
   ============================================================ */
const PGRP = ['gFront', 'gCommon', 'gMgmt', 'gBack'];

/* ============================================================
   PSCREENS — 画面台帳（画面数は PSCREENS.length が正本。件数を書かない）。
   「この画面の AI」ブロックは SVCS[].place から自動生成する（手書きの ai: リストは持たない。
   設計書 §4-4。生成は js/portal/app.js の pscreenAiIds() / pcrossAiIds()）。
   newai: は PNEW（未採番の追加候補）のうち、この画面の末尾に「提案」として出すもの
   （place を持てないため。設計書 §4-4）。
   ============================================================ */
const PSCREENS = [
  { grp: '', id: 'home', icon: 'M3 9l7-6 7 6v8a1 1 0 01-1 1h-4v-5H8v5H4a1 1 0 01-1-1z' },
  { grp: 'gFront', id: 'cust', icon: 'M2 16v-1a4 4 0 014-4h2a4 4 0 014 4v1M7 4a3 3 0 110 6 3 3 0 010-6zM13 16v-1a4 4 0 00-3-3.87', ct: '4' },
  { grp: 'gFront', id: 'proj', icon: 'M3 5h5l1.5 2H17v9H3z', ct: '10' },
  { grp: 'gFront', id: 'watch', icon: 'M10 4c-4 0-6.5 3-7 5 .5 2 3 5 7 5s6.5-3 7-5c-.5-2-3-5-7-5zM10 11a2 2 0 100-4 2 2 0 000 4z', ct: '12' },
  { grp: 'gFront', id: 'vend', icon: 'M4 7l6-3 6 3v7l-6 3-6-3zM10 4v13', ct: '3' },
  { grp: 'gCommon', id: 'act', icon: 'M4 10l4 4 8-9', ct: '10' },
  { grp: 'gCommon', id: 'sys', icon: 'M3 4.5h14v9H3zM8.5 16h3M10 13.5V16M6.5 9h1.8l1.2-2.6 1.6 4.8 1.2-2.2h2', ct: '9' },
  { grp: 'gCommon', id: 'meet', icon: 'M4 4h12v12H4zM4 8h12M8 2v3M12 2v3', ct: '4' },
  { grp: 'gCommon', id: 'know', icon: 'M4 3h9a2 2 0 012 2v12H6a2 2 0 01-2-2z M6 3v14', ct: '12' },
  { grp: 'gCommon', id: 'ai', icon: 'M10 3l2 4 4 2-4 2-2 4-2-4-4-2 4-2z' },
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
