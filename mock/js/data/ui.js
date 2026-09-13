'use strict';
/* mock/js/data/ui.js — T / PATTERNS / TAGS / TEMPLATES（UI 文言・パターン定義・タグ辞書・デモテンプレート辞書）
   出所: mock/catalog.html（分割前）。設計書 docs/handoff/2026-09-07-split-catalog.md §1・§9-1（PR-B）。
   値は 1 バイトも変えていない（抽出コマンドの再実行で diff ゼロを確認）。 */

/* ============================================================
   1. UI 辞書（画面固定文言）
   ============================================================ */
const T = {
  mockLabel:    { ja: 'CONCEPT MOCK — 社内検討用', zh: 'CONCEPT MOCK — 内部讨论用', en: 'CONCEPT MOCK — Internal review' },
  indLabel:     { ja: '業種:', zh: '行业:', en: 'Industry:' },
  segLabel:     { ja: 'パターン:', zh: '方案:', en: 'Pattern:' },
  appTitle:     { ja: 'AIエージェントカタログ', zh: 'AI智能体服务目录', en: 'AI Agent Catalog' },
  allServices:  { ja: 'すべてのサービス', zh: '全部服务', en: 'All Services' },
  home:         { ja: 'ホーム', zh: '首页', en: 'Home' },
  searchPh:     { ja: 'サービスを検索', zh: '搜索服务', en: 'Search services' },
  countUnit:    { ja: '件のサービス', zh: '项服务', en: ' services' },
  noResults:    { ja: '該当するサービスがありません。', zh: '没有符合条件的服务。', en: 'No matching services found.' },
  backToList:   { ja: '一覧へ戻る', zh: '返回列表', en: 'Back to list' },
  backToDetail: { ja: '詳細へ戻る', zh: '返回详情', en: 'Back to details' },
  overview:     { ja: '概要', zh: '概述', en: 'Overview' },
  startUse:     { ja: '利用開始する', zh: '开始使用', en: 'Start using' },
  mockNote:     { ja: '※ 本画面はコンセプト確認用のモックです', zh: '※ 本页面为概念验证演示', en: '* This screen is a concept mock.' },
  statusLive:   { ja: '提供中', zh: '已上线', en: 'Available' },
  statusTrial:  { ja: '試行版', zh: '试用版', en: 'Trial' },
  statusConcept:{ ja: '構想', zh: '构想', en: 'Concept' },
  chatPh:       { ja: 'メッセージを入力（日本語・中文どちらでも）', zh: '请输入消息（中文・日文均可）', en: 'Type a message (Japanese or Chinese)' },
  send:         { ja: '送信', zh: '发送', en: 'Send' },
  chatHello:    { ja: 'こんにちは。「{name}」エージェントです。日本語・中国語どちらでも入力できます。',
                  zh: '您好，这里是「{name}」智能体。中文或日文均可输入。',
                  en: 'Hello. This is the "{name}" agent. You can write in Japanese or Chinese.' },
  chatReply:    { ja: '（モック応答）ご入力ありがとうございます。実際のサービスでは、「{name}」がここで回答を生成します。',
                  zh: '（模拟回复）感谢您的输入。正式版中，「{name}」将在此生成回答。',
                  en: '(Mock reply) Thank you. In the live service, "{name}" would generate an answer here.' },
  todoEyebrow:  { ja: 'PHASE 2', zh: 'PHASE 2', en: 'PHASE 2' },
  todoTitle:    { ja: 'このパターンは準備中です', zh: '此方案正在准备中', en: 'This pattern is in progress' },
  themeToLight: { ja: 'ライトモードへ', zh: '切换到浅色', en: 'Switch to light' },
  themeToDark:  { ja: 'ダークモードへ', zh: '切换到深色', en: 'Switch to dark' },

  /* ---- B: 担当者シナリオ・業務デモ（22 キー） ---- */
  personaLabel: { ja: '担当者', zh: '使用者', en: 'Persona' },
  scenarioLabel:{ ja: '利用シナリオ', zh: '使用场景', en: 'Scenario' },
  screenType:   { ja: '画面タイプ', zh: '界面类型', en: 'Screen type' },
  nativeLabel:  { ja: '母語', zh: '母语', en: 'Native language' },
  nativeJa:     { ja: '日本語', zh: '日语', en: 'Japanese' },
  nativeZh:     { ja: '中国語', zh: '中文', en: 'Chinese' },
  startDemo:    { ja: 'デモを見る', zh: '查看演示', en: 'View demo' },
  inputPanel:   { ja: '入力', zh: '输入', en: 'Input' },
  resultPanel:  { ja: '結果', zh: '结果', en: 'Result' },
  run:          { ja: '実行', zh: '执行', en: 'Run' },
  runDone:      { ja: '実行済み', zh: '已执行', en: 'Done' },
  restart:      { ja: '最初から', zh: '重新开始', en: 'Restart' },
  dropHint:     { ja: 'ファイルをここにドロップ（モックのため操作不要）', zh: '将文件拖到此处（演示无需操作）', en: 'Drop files here (no action needed in this mock)' },
  beforeLabel:  { ja: '旧', zh: '旧版', en: 'Before' },
  afterLabel:   { ja: '新', zh: '新版', en: 'After' },
  chipsLabel:   { ja: '次の質問例', zh: '接下来可以问', en: 'Try asking' },
  chipJa:       { ja: '日', zh: '日', en: 'JA' },
  chipZh:       { ja: '中', zh: '中', en: 'ZH' },
  runHint:      { ja: '左の「実行」を押すとデモが始まります', zh: '点击左侧「执行」开始演示', en: 'Press "Run" on the left to start the demo' },
  demoDone:     { ja: '台本はここまでです。自由に入力すると汎用のモック応答が返ります。「最初から」でやり直せます。',
                  zh: '演示脚本到此结束。可继续自由输入（返回通用模拟回复），或点击「重新开始」。',
                  en: 'End of the scripted demo. Free input returns a generic mock reply; use "Restart" to replay.' },
  tplBadge:     { ja: 'テンプレート', zh: '模板', en: 'Template' },
  stepPrefix:   { ja: '手順', zh: '步骤', en: 'Step' },

  /* ---- ② ダッシュボード（12 キー） ---- */
  dashWelcome:  { ja: 'AIエージェント ホーム', zh: 'AI智能体 首页', en: 'AI Agent Home' },
  dashLead:     { ja: '{c} 分類 {n} 件のエージェントを用意しています。よく使われているものから試せます。',
                  zh: '共 {c} 个分类 {n} 个智能体，可以从常用的开始试用。',
                  en: '{n} agents in {c} categories. Start with the ones most people use.' },
  statAll:      { ja: 'サービス総数', zh: '服务总数', en: 'All services' },
  dashFreq:     { ja: 'よく使われているエージェント', zh: '常用智能体', en: 'Most used agents' },
  dashFreqNote: { ja: '社内の利用実績（デモ用のサンプル値）', zh: '公司内使用情况（演示用示例数据）', en: 'Company-wide usage (sample figures for this demo)' },
  usesUnit:     { ja: '今月 {n} 件', zh: '本月 {n} 次', en: '{n} runs this month' },
  dashReco:     { ja: 'おすすめ', zh: '推荐', en: 'Recommended' },
  dashRecoNote: { ja: '初めての方はここから', zh: '初次使用可从这里开始', en: 'A good place to start' },
  recoWhy:      { ja: 'おすすめの理由', zh: '推荐理由', en: 'Why' },
  dashCats:     { ja: '分類から見る', zh: '按分类查看', en: 'Browse by category' },
  dashCatsNote: { ja: 'バーは成熟度の内訳（提供中／試行版／構想）', zh: '柱状条显示成熟度构成（已上线／试用版／构想）', en: 'The bar shows the maturity mix (available / trial / concept)' },
  backHome:     { ja: 'ホームへ戻る', zh: '返回首页', en: 'Back to home' },

  /* ---- ③ 業務フィード（12 キー） ---- */
  feedEyebrow:  { ja: 'MY WORK', zh: 'MY WORK', en: 'MY WORK' },
  feedTitle:    { ja: '今日の業務', zh: '今日工作', en: 'Today at work' },
  feedLead:     { ja: '期限・通知・定例から入ります。担当している業務だけが並びます。',
                  zh: '从期限、通知、例行工作进入，只显示与您相关的业务。',
                  en: 'Enter from deadlines, notices and routines. Only your own work is listed.' },
  feedAction:   { ja: '対応が必要', zh: '需要处理', en: 'Needs action' },
  feedRoutine:  { ja: '定例の業務', zh: '例行工作', en: 'Routine work' },
  feedNotice:   { ja: 'お知らせ', zh: '通知事项', en: 'Notices' },
  kindDue:      { ja: '期限', zh: '期限', en: 'Due' },
  kindNotify:   { ja: '通知', zh: '通知', en: 'Notice' },
  kindRoutine:  { ja: '定例', zh: '例行', en: 'Routine' },
  feedOpen:     { ja: '開く', zh: '打开', en: 'Open' },
  feedMine:     { ja: '担当分類', zh: '负责分类', en: 'My categories' },
  feedRecent:   { ja: '最近使った', zh: '最近使用', en: 'Recently used' },

  /* ---- NEW 表示（SVCS[].added から自動。6 キー） ---- */
  newBadge:     { ja: 'NEW', zh: 'NEW', en: 'NEW' },
  dashNew:      { ja: '新しく追加されたエージェント', zh: '新增的智能体', en: 'Newly added agents' },
  dashNewNote:  { ja: '追加から {n} 日間ここに表示されます', zh: '添加后 {n} 天内显示在此处', en: 'Shown here for {n} days after being added' },
  addedOn:      { ja: '{d} 追加', zh: '{d} 添加', en: 'Added {d}' },
  feedNewWhen:  { ja: '新着', zh: '最新', en: 'New' },
  feedNewAgent: { ja: '新しいエージェント {code} が使えます。詳細を開くとデモを試せます。',
                  zh: '新智能体 {code} 已可使用。打开详情即可查看演示。',
                  en: 'A new agent, {code}, is available. Open the details to try the demo.' },

  /* ---- お気に入り（設計書 2026-09-08-favorites.md §5。9 キー） ---- */
  favTitle:      { ja: 'お気に入り', zh: '收藏', en: 'Favorites' },
  favAdd:        { ja: 'お気に入りに追加', zh: '添加到收藏', en: 'Add to favorites' },
  favRemove:     { ja: 'お気に入りから外す', zh: '取消收藏', en: 'Remove from favorites' },
  favAddAria:    { ja: '{name} をお気に入りに追加',
                   zh: '将「{name}」添加到收藏',
                   en: 'Add {name} to favorites' },
  favRemoveAria: { ja: '{name} をお気に入りから外す',
                   zh: '将「{name}」从收藏中移除',
                   en: 'Remove {name} from favorites' },
  favEmpty:      { ja: 'お気に入りはまだありません。',
                   zh: '还没有收藏的服务。',
                   en: 'No favorites yet.' },
  favEmptyHint:  { ja: 'カード右上の星印を押すと、ここに集まります。',
                   zh: '点击卡片右上角的星标，即可收藏到这里。',
                   en: 'Press the star at the top right of a card to collect it here.' },
  favSeeAll:     { ja: 'すべて見る（{n}）', zh: '查看全部（{n}）', en: 'See all ({n})' },
  favNote:       { ja: '自分で選んだエージェント',
                   zh: '您自己收藏的智能体',
                   en: 'Agents you picked yourself' },

  /* ---- 本番リンク（設計書 2026-09-08-live-links.md §5-3。5 キー） ---- */
  liveOpen:      { ja: '本番を開く', zh: '打开正式版', en: 'Open live app' },
  liveMark:      { ja: 'いま使える', zh: '已可使用', en: 'Live now' },
  liveMarkAria:  { ja: '「{name}」は Dify 上で実際に使えます',
                   zh: '「{name}」已在 Dify 上实际可用',
                   en: '"{name}" is live on Dify and usable now' },
  liveOpenTitle: { ja: 'Dify 上の本番アプリを新しいタブで開きます（{updated} 時点で動作確認済み）',
                   zh: '在新标签页中打开 Dify 上的正式应用（截至 {updated} 已确认可用）',
                   en: 'Opens the live app on Dify in a new tab (verified working as of {updated})' },
  liveNote:      { ja: '※ 本番アプリは架空データのデモ環境です',
                   zh: '※ 正式应用运行在使用虚构数据的演示环境上',
                   en: '* The live app runs on a demo environment that contains fictional data only.' }
};

/* ============================================================
   1a. 業種定義（`.mockbar` の業種切替＝レビュー用の足場。§4-1・§4-3）
   会社名・部署名はここに置く（T には置かない）。CATS/subs/SVCS の
   `industries` で参照する業種 id は必ずこの配列の id と一致すること
   ============================================================ */
const INDUSTRIES = [
  { id: 'mfg',
    name:     { ja: '製造',   zh: '制造',   en: 'Manufacturing' },
    desc:     { ja: '在中日系製造業（中国工場）', zh: '在华日资制造业（中国工厂）', en: 'Japanese-affiliated manufacturer in China' },
    wordmark: { ja: '青嶺精工', zh: '青岭精工', en: 'SEIREI SEIKO' },
    /* dept は 2026-09-12 に PM 判断で「情報システム部」→「製造二課」へ是正
       （data/world/mfg/org.csv に情報システム部は存在せず、seizo2＝製造二課が実在する。
       FEED.mfg.persona〔李 強／製造二課 課長〕の所属と一致させる。
       設計書 docs/handoff/2026-09-12-portal-industry-rev4.md §5-1） */
    dept:     { ja: '製造二課', zh: '制造二科', en: 'Manufacturing Section 2' } },
  { id: 'fin',
    name:     { ja: '金融', zh: '金融', en: 'Finance' },
    desc:     { ja: '在中日系銀行（中国拠点）', zh: '在华日资银行（中国网点）', en: 'Japanese-affiliated bank in China' },
    /* 銀行名は 2026-09-08 に PM 判断で「碧洋銀行 / 碧洋银行 / Hekiyo Bank, Ltd.」へ確定
       （data/world/fin/company.md 参照。当初案「瑞央銀行」は実在の邦銀「瑞穂」と頭文字が
       紛らわしいため差し替え。§9 #4）。世界マスタの正本と一致させる */
    wordmark: { ja: '碧洋銀行', zh: '碧洋银行', en: 'HEKIYO BANK' },
    dept:     { ja: '事務統括部', zh: '事务统筹部', en: 'Operations Planning Dept.' } },
  { id: 'it',
    name:     { ja: 'IT', zh: 'IT', en: 'IT Services' },
    desc:     { ja: '日系 SIer の中国拠点（上海）',
                zh: '日资系统集成商中国分公司（上海）',
                en: 'Japanese-affiliated systems integrator in China (Shanghai)' },
    /* 会社名は 2026-09-11 に PM 判断で「翠雲システムズ / 翠云系统 / Suiun Systems, Ltd.」へ確定
       （data/world/it/company.md 参照。設計書 docs/handoff/2026-09-11-it-industry.md §3-4-3・§10 ⑤）。
       「N 社」は mfg の取引先記号（K 社・S 社など）と同形で誤読されるため不採用。
       世界マスタの正本と一致させる */
    wordmark: { ja: '翠雲システムズ', zh: '翠云系统', en: 'SUIUN SYSTEMS' },
    dept:     { ja: 'ソリューション本部', zh: '解决方案本部', en: 'Solutions Division' } }
];

/* パターン定義（表示レイヤーの選択肢） */
const PATTERNS = [
  { id: 'nav',  ready: true,
    name: { ja: '① 階層ナビ', zh: '① 层级导航', en: '① Hierarchy' },
    desc: { ja: '分類から辿って探す。目的が明確な利用者向け。',
            zh: '按分类逐层查找，适合目标明确的用户。',
            en: 'Browse by category. For users who know what they need.' } },
  { id: 'dash', ready: true,
    name: { ja: '② ダッシュボード', zh: '② 仪表盘', en: '② Dashboard' },
    desc: { ja: 'よく使う・おすすめを前面に出すホーム。初めて使う利用者向け。',
            zh: '以常用与推荐为主的首页，适合初次使用的用户。',
            en: 'A home surfacing frequent and recommended agents. For first-time users.' } },
  { id: 'feed', ready: true,
    name: { ja: '③ 業務フィード', zh: '③ 业务动态', en: '③ Work Feed' },
    desc: { ja: '自分の業務・タスク起点で入る。日常的に使う利用者向け。',
            zh: '从自身业务与任务出发，适合日常高频使用的用户。',
            en: 'Enter from your own tasks and workflow. For daily heavy users.' } }
];

/* タグ辞書 */
const TAGS = {
  search:     { ja: '検索', zh: '检索', en: 'Search' },
  faq:        { ja: '問い合わせ対応', zh: '咨询应答', en: 'Inquiry' },
  equipment:  { ja: '設備', zh: '设备', en: 'Equipment' },
  regulation: { ja: '社内規程', zh: '公司规章', en: 'Policies' },
  hr:         { ja: '労務', zh: '劳务人事', en: 'HR & Labor' },
  authority:  { ja: '当局・法規', zh: '监管法规', en: 'Regulators' },
  defect:     { ja: '不具合', zh: '不良', en: 'Defects' },
  rootcause:  { ja: '原因分析', zh: '原因分析', en: 'Root cause' },
  report8d:   { ja: '8D報告', zh: '8D报告', en: '8D report' },
  change4m:   { ja: '4M変更', zh: '4M变更', en: '4M change' },
  claim:      { ja: 'クレーム', zh: '客诉', en: 'Claims' },
  audit:      { ja: '監査', zh: '审核', en: 'Audits' },
  report:     { ja: '報告資料', zh: '汇报资料', en: 'Reports' },
  meeting:    { ja: '会議', zh: '会议', en: 'Meetings' },
  education:  { ja: '教育・OJT', zh: '培训・OJT', en: 'Training' },
  safety:     { ja: '安全・5S', zh: '安全・5S', en: 'Safety & 5S' },
  approval:   { ja: '稟議・申請', zh: '审批申请', en: 'Approvals' },
  trade:      { ja: '輸出入・通関', zh: '进出口・报关', en: 'Trade & customs' },
  contract:   { ja: '契約', zh: '合同', en: 'Contracts' },
  legal:      { ja: '法務・リスク', zh: '法务与风险', en: 'Legal & risk' },
  translate:  { ja: '翻訳', zh: '翻译', en: 'Translation' },
  glossary:   { ja: '用語集', zh: '术语表', en: 'Glossary' },
  procedure:  { ja: '手順書', zh: '作业指导', en: 'Procedures' },
  mail:       { ja: 'メール', zh: '邮件', en: 'Email' },
  costing:    { ja: '原価', zh: '成本', en: 'Costing' },
  purchase:   { ja: '購買', zh: '采购', en: 'Procurement' },
  kpi:        { ja: '実績集計', zh: '实绩汇总', en: 'KPIs' },
  inventory:  { ja: '在庫・納期', zh: '库存・交期', en: 'Inventory & lead time' },
  analysis:   { ja: 'データ分析', zh: '数据分析', en: 'Data analysis' },
  spec:       { ja: '仕様書', zh: '规格书', en: 'Specifications' },
  bom:        { ja: 'BOM', zh: 'BOM', en: 'BOM' },
  drawing:    { ja: '図面', zh: '图纸', en: 'Drawings' },
  finance:    { ja: '経理', zh: '财务', en: 'Finance' },
  order:      { ja: '受発注', zh: '订单', en: 'Orders' },
  calendar:   { ja: '日程', zh: '日程', en: 'Scheduling' },
  summary:    { ja: '要約', zh: '摘要', en: 'Summaries' },
  partner_infovendor: { ja: '情報ベンダ',       zh: '信息服务商',   en: 'Info vendor' },
  partner_archive:    { ja: '記事アーカイブ',   zh: '文章档案',     en: 'Article archive' },
  partner_salarydb:   { ja: '給与DB',           zh: '薪酬数据库',   en: 'Salary DB' },
  partner_recruit:    { ja: '採用エージェント', zh: '招聘代理',     en: 'Recruiting agent' },
  partner_procure:    { ja: '購買エージェント', zh: '采购代理',     en: 'Procurement agent' },
  partner_training:   { ja: '研修ベンダ',       zh: '培训服务商',   en: 'Training vendor' },
  credit:             { ja: '与信・リスク',     zh: '信用与风险',   en: 'Credit & risk' },
  market:             { ja: '市況・業界',       zh: '行情与行业',   en: 'Market intel' },

  /* ---- 金融カタログ新設タグ 13 個（設計書 2026-09-08-finance-catalog.md §3-6） ---- */
  news:        { ja: 'ニュース収集',     zh: '新闻收集',     en: 'News monitoring' },
  disclosure:  { ja: '開示・IR',         zh: '信息披露・IR', en: 'Disclosure & IR' },
  screening:   { ja: 'KYC・スクリーニング', zh: 'KYC与筛查',  en: 'KYC & screening' },
  valuation:   { ja: 'バリュエーション', zh: '估值',         en: 'Valuation' },
  modeling:    { ja: '財務モデル',       zh: '财务模型',     en: 'Financial modeling' },
  closing:     { ja: '決算・クローズ',   zh: '结账・决算',   en: 'Close & reconciliation' },
  proposal:    { ja: '提案・ピッチ',     zh: '提案与路演',   en: 'Proposals & pitches' },
  client:      { ja: '顧客対応',         zh: '客户对接',     en: 'Client coverage' },
  survey:      { ja: 'アンケート',       zh: '问卷调查',     en: 'Surveys' },
  idea:        { ja: 'アイデア',         zh: '创意提案',     en: 'Ideas' },
  workload:    { ja: '稼働・工数',       zh: '工时与稼动',   en: 'Workload & effort' },
  dashboard:   { ja: 'ダッシュボード',   zh: '仪表盘',       en: 'Dashboards' },
  datasource:  { ja: '外部データ源',     zh: '外部数据源',   en: 'External data sources' },

  /* ---- 業種横断タグ（設計書 2026-09-08-exec-visit-attend.md §2-3） ---- */
  travel:      { ja: '出張・来訪',       zh: '出差与来访',   en: 'Travel & visits' },

  /* ---- IT カタログ新設タグ 7 個（設計書 2026-09-11-it-industry.md §4-3） ---- */
  ocr:         { ja: '読み取り・OCR', zh: '识别与OCR',     en: 'OCR & extraction' },
  pipeline:    { ja: '引合・案件',     zh: '商机与项目',   en: 'Pipeline' },
  winloss:     { ja: '受失注分析',     zh: '赢单失单分析', en: 'Win–loss analysis' },
  leave:       { ja: '休暇・年休',     zh: '休假与年假',   en: 'Leave' },
  taxonomy:    { ja: '分類・振り分け', zh: '分类与归集',   en: 'Taxonomy' },
  governance:  { ja: '規程整合',       zh: '规章一致性',   en: 'Policy alignment' },
  effect:      { ja: '効果測定',       zh: '效果测算',     en: 'Impact measurement' },

  /* ---- システム運用の新設タグ 2 個（設計書 2026-09-11-sysops-usecase.md §5-3） ---- */
  monitor:     { ja: '運用監視',       zh: '运维监控',     en: 'Monitoring' },
  incident:    { ja: '障害対応',       zh: '故障处置',     en: 'Incident response' }
};

/* ============================================================
   2a. デモテンプレート辞書（画面タイプ名。UI 表示用・3 言語）
   ============================================================ */
const TEMPLATES = {
  qa:     { name: { ja: 'QAチャット型',          zh: '问答对话型',       en: 'Q&A chat' },
            desc: { ja: '聞いて、根拠付きの答えを受け取る', zh: '提问后获得附依据的回答', en: 'Ask and get a sourced answer' } },
  upload: { name: { ja: 'アップロード→結果型',    zh: '上传→结果型',      en: 'Upload → result' },
            desc: { ja: 'ファイルを渡して、整理された結果を受け取る', zh: '上传文件后获得整理好的结果', en: 'Hand over files and get a structured result' } },
  form:   { name: { ja: 'フォーム入力→ドラフト生成型', zh: '表单输入→草案生成型', en: 'Form → draft' },
            desc: { ja: '条件を埋めて、ドラフトを受け取る', zh: '填写条件后获得草案', en: 'Fill in the terms and get a draft' } },
  diff:   { name: { ja: '差分比較型',            zh: '差异比较型',       en: 'Diff comparison' },
            desc: { ja: '新旧 2 版を比べて、変更点と影響を受け取る', zh: '比较新旧两版，获得变更点与影响', en: 'Compare two versions and get changes and impact' } },
  lookup: { name: { ja: '照会（データ引き）型',   zh: '查询（数据检索）型', en: 'Lookup' },
            desc: { ja: 'キーを入れて、システムのデータを引く', zh: '输入关键字，检索系统数据', en: 'Enter a key and pull system data' } }
};
