'use strict';
/* mock/js/data/portal/svc.js — PSVC（サービス別の説明）/ PLACE（サービス→画面の対応表）/
   PNEW（未採番の追加候補）/ PSTAGE_AI（案件ステージ→AI）
   出所: scratchpad/portal-mock/portal.html。設計書 docs/handoff/2026-09-11-portal-mock-pages.md §3-1・§4-2・§4-3。

   キーはすべて SVCS[].id（内部 id。例 'kn2'）。管理番号（'KN-02'）への変換は
   js/portal/app.js の psvcCode() が行う（別データを持たない。CLAUDE.md §2-11）。

   PLACE は「サービス → ポータル画面」の対応表。この PR（PR-1）ではまだ mock/js/data/catalog.js の
   SVCS[].place へは移していない（PR-2 でやる。設計書 §4-3・§11）。値は画面 id ／ '*'（全画面）／
   'out'（ポータルには置かない） + 理由（'out' のときだけ）。

   PSVC は st / name / cat を持たない（SVCS からの二重持ちを避ける。verify §17-i）。
   short だけ 3 言語（ja/zh/en）。ctx / out / why / how は v1 では日本語のみ（設計書 §7-1）。
   純粋なリテラル宣言のみ（document・localStorage・関数呼び出しを書かない）。 */

/* ============================================================
   PSVC — サービス別の説明（カタログの説明に対して、ポータルに置いたときだけの補足）
   ============================================================ */
const PSVC = {
  po1: { short: { ja: 'アンケート', zh: '问卷调查', en: 'Survey' }, how: 'flow',
    ctx: '対象者・設問', out: '回収と集計',
    why: '研修の事後アンケート。構想段階' },
  po2: { short: { ja: '意見集約', zh: '意见汇总', en: 'Idea intake' }, how: 'flow',
    ctx: 'テーマ・対象者', out: '集まった案と投票結果',
    why: '改善提案とサーベイの自由記述をまとめる。構想段階' },
  po3: { short: { ja: '小テスト', zh: '小测验', en: 'Quiz' }, how: 'flow',
    ctx: '研修 id・対象者', out: '出題・採点・未了者の一覧',
    why: '必須研修の理解度確認。構想段階' },
  pt8: { short: { ja: '研修設計', zh: '培训设计', en: 'Training design' }, how: 'btn',
    ctx: '対象者のスキル・担当案件', out: '研修メニューと受講計画',
    why: '個人向けメニューの中身を作る。構想段階' },
  rs1: { short: { ja: 'ニュース', zh: '资讯', en: 'News' }, how: 'flow',
    ctx: '顧客 id・キーワード', out: '関連ニュースの要約（日次）',
    why: '引合ステージ。相手先の動きを拾って営業に配る' },
  dc9: { short: { ja: '提案書', zh: '提案书', en: 'Proposal draft' }, how: 'btn',
    ctx: '案件 id・提案の型・過去の類似提案', out: '提案書のドラフト',
    why: '提案ステージ。テンプレートを選んで下書きを出す' },
  nm1: { short: { ja: '原価', zh: '成本', en: 'Costing' }, how: 'btn',
    ctx: '案件 id・要員構成・期間', out: '積算と、その根拠',
    why: '見積ステージ。構想段階' },
  cv2: { short: { ja: '面談ブリーフ', zh: '会谈简报', en: 'Meeting brief' }, how: 'btn',
    ctx: '担当者 id・顧客・前回議事録・直近ニュース', out: '面談前の論点整理',
    why: '担当者一覧から。構想段階' },
  new1: { short: { ja: '名刺OCR', zh: '名片OCR', en: 'Business card OCR' },
    title: { ja: '名刺の読み取りと項目抽出（日中英）', zh: '名片读取与信息提取（日中英）', en: 'Business card OCR & field extraction (JA/ZH/EN)' },
    how: 'flow', isnew: true,
    ctx: '名刺の画像（表・裏）', out: '言語判定＋氏名・会社・部門・役職・拠点・連絡先。役職は原文と社内表記の両方',
    why: 'カタログに無い。PM 指示で追加するユースケース。名刺管理は NocoBase 側に持ち、AI は読み取りと抽出だけを担う。分類と管理番号は実装時に採番する' },
  gn5: { short: { ja: '要約', zh: '摘要', en: 'Summary' }, how: 'btn',
    ctx: '選択した文書 or 貼り付けたテキスト', out: '要点・決定事項・次のアクション',
    why: 'どの画面からでも呼ぶ。稼働中で、いちばん使われる想定' },
  kn4: { short: { ja: '問い合わせ', zh: '咨询受理', en: 'Inquiry desk' }, how: 'embed',
    ctx: '質問文（日/中どちらでも）', out: '回答＋出典。未解決は FAQ 候補として溜まる',
    why: 'ポータル横断の「まず聞く窓口」。Dify の画面をそのまま埋める' },
  kn3: { short: { ja: '規程QA', zh: '规章问答', en: 'Policy Q&A' }, how: 'embed',
    ctx: '質問文', out: '該当条項の引用＋回答',
    why: 'ナレッジ画面の常設窓口。稼働中' },
  dc1: { short: { ja: '報告作成', zh: '汇报制作', en: 'Report drafting' }, how: 'btn',
    ctx: '案件 id・期間・前回報告', out: '報告資料のドラフト（日本語）',
    why: '案件行から直接。月次報告の下書きが画面の中で出る' },
  dc2: { short: { ja: '議事録', zh: '会议纪要', en: 'Meeting minutes' }, how: 'btn',
    ctx: '会議 id・出席者・録音/メモ', out: '議事録＋決定事項＋次回論点＋To Do 候補',
    why: '会議画面の本体。返ってきた To Do 候補を To Do テーブルに落とす' },
  dc8: { short: { ja: 'レビュー', zh: '审阅', en: 'Review' }, how: 'btn',
    ctx: '案件 id・報告書・相手（担当週報/組織長週報/月次）', out: '指摘とツッコミどころ、抜けている観点',
    why: '案件行から。出す前に自分で叩けるのが訴求点' },
  lg1: { short: { ja: '翻訳', zh: '翻译', en: 'Translation' }, how: 'btn',
    ctx: '選択したテキスト＋用語集', out: '訳文（社内の言い方に統一）',
    why: '全画面共通。中国拠点なので常時使う' },
  lg2: { short: { ja: '用語ゆれ', zh: '术语统一', en: 'Terminology check' }, how: 'flow',
    ctx: 'ナレッジ・議事録の本文', out: 'ゆれている語の一覧と推奨表記',
    why: '裏で回して、ナレッジ画面に「表記ゆれ」を出す' },
  lg4: { short: { ja: 'メール', zh: '邮件', en: 'Email drafting' }, how: 'btn',
    ctx: 'To Do id・宛先・用件', out: 'メール文面（日中）',
    why: 'To Do 行から。催促・依頼がその場で書ける' },
  nm3: { short: { ja: '集計', zh: '汇总', en: 'Tally' }, how: 'flow',
    ctx: '期間・対象部署', out: '集計表＋要約',
    why: 'KPI 画面の数字の裏。毎朝バッチで回して結果をテーブルに書く' },
  gn4: { short: { ja: '日程調整', zh: '日程协调', en: 'Scheduling' }, how: 'btn',
    ctx: '出席者・期間・所要時間', out: '候補日時と調整文面',
    why: '会議画面から。参加者は要員テーブルの行を渡す' },
  gn6: { short: { ja: '放置検出', zh: '遗留检测', en: 'Stale-task detection' }, how: 'flow',
    ctx: 'メール・チャット・議事録の本文', out: 'To Do 候補（依頼者・期限・放置日数）',
    why: 'To Do 画面の相棒。拾った候補を To Do テーブルに起票する' },
  gn7: { short: { ja: '段取り', zh: '接待安排', en: 'Visit arrangement' }, how: 'btn',
    ctx: '来訪者・日程・拠点', out: '送迎・宿泊・会食・移動の段取り表',
    why: '会議／来客画面から。構想段階' },
  pt1: { short: { ja: 'リスク', zh: '风险监控', en: 'Risk monitoring' }, how: 'flow',
    ctx: '顧客 id', out: '外部情報からのリスク兆候',
    why: '顧客画面。裏で回して顧客行に印を付ける' },
  pt4: { short: { ja: '給与相場', zh: '薪酬行情', en: 'Salary benchmark' }, how: 'btn',
    ctx: '職種・拠点・経験年数', out: '相場レンジと出典',
    why: '要員画面。構想段階' },
  po4: { short: { ja: '稼働集計', zh: '工时汇总', en: 'Utilization tally' }, how: 'flow',
    ctx: '期間・要員・案件', out: '稼働集計と配分案',
    why: '要員／KPI 画面。構想段階' },
  rs3: { short: { ja: '決算要約', zh: '决算摘要', en: 'Earnings summary' }, how: 'flow',
    ctx: '顧客 id', out: '決算の要約と前期比較',
    why: '顧客画面。金融カタログ由来' },
  rs5: { short: { ja: '気づき', zh: '洞察分析', en: 'Insight analysis' }, how: 'btn',
    ctx: '表示中のグラフのデータ', out: '気づきと確認すべき点',
    why: 'KPI 画面から。構想段階' }
};

/* ============================================================
   PLACE — サービス → ポータル画面の対応表（67 件・全件）。
   'out' はポータルには置かない（理由つき）。'*' は全画面共通（ホームの「横断で使う AI」にだけ出す）。
   PR-2 で mock/js/data/catalog.js の SVCS[].place へ移す（設計書 §4-3）。
   ============================================================ */
const PLACE = {
  kn1: ['out', '顧客の業務（青嶺精工の技術ナレッジ）'], kn2: ['out', '顧客の業務（設備マニュアル）'],
  kn3: ['know', ''], kn4: ['know', ''],
  kn5: ['out', '顧客の業務（当局通達の反映）'], kn6: ['out', '顧客の業務（銀行の事務手続）'],
  kn7: ['out', '顧客の業務（行内営業情報）'], kn8: ['out', '顧客の業務（当局通達DB）'],
  rs1: ['watch', ''], rs2: ['watch', ''], rs3: ['watch', ''], rs4: ['watch', ''], rs5: ['kpi', ''],
  cv1: ['proj', ''], cv2: ['cust', ''],
  cv3: ['out', '顧客の業務（審査コメント）'], cv4: ['out', '顧客の業務（KYC）'],
  fa1: ['exp', ''], fa2: ['exp', ''], fa3: ['exp', ''],
  fa4: ['exp', ''], fa5: ['exp', ''],
  qa1: ['out', '顧客の業務（製造の品質）'], qa2: ['out', '顧客の業務（4M 変更管理）'],
  qa3: ['out', '顧客の業務（クレーム対応）'], qa4: ['out', '顧客の業務（工程監査）'],
  dc1: ['proj', ''], dc2: ['meet', ''], dc3: ['trn', ''],
  dc4: ['out', '顧客の業務（工場の掲示物）'], dc5: ['req', ''],
  dc6: ['out', '顧客の業務（通関書類）'], dc7: ['req', ''], dc8: ['proj', ''], dc9: ['proj', ''],
  lg1: ['*', '全画面で使う'], lg2: ['know', ''], lg3: ['know', ''], lg4: ['act', ''],
  nm1: ['proj', ''], nm2: ['vend', ''], nm3: ['kpi', ''],
  nm4: ['out', '顧客の業務（在庫・納期）'], nm5: ['kpi', ''],
  en1: ['out', '顧客の業務（仕様改訂）'], en2: ['out', '顧客の業務（BOM）'], en3: ['out', '顧客の業務（図面）'],
  gn1: ['exp', ''], gn2: ['exp', ''], gn3: ['vend', ''], gn4: ['meet', ''],
  gn5: ['*', '全画面で使う'], gn6: ['act', ''], gn7: ['meet', ''],
  pt1: ['vend', ''], pt2: ['watch', ''], pt3: ['watch', ''], pt4: ['ppl', ''], pt5: ['ppl', ''],
  pt6: ['vend', ''], pt7: ['vend', ''], pt8: ['trn', ''],
  po1: ['trn', ''], po2: ['trn', ''], po3: ['trn', ''], po4: ['ppl', ''],
  eg1: ['proj', '']
};

/* ============================================================
   PNEW — 未採番の追加候補（PSVC の外。SVCS には存在しない仮 id。
   ここに挙げた id は「SVCS に実在すること」の検査から除外される。verify §17-g）
   ============================================================ */
const PNEW = ['new1'];

/* ============================================================
   PSTAGE_AI — 案件ステージ → この段階で使う AI（SVCS の内部 id）
   ============================================================ */
const PSTAGE_AI = {
  lead: ['rs1', 'gn5'], prop: ['dc9', 'dc8'], quote: ['nm1', 'dc8'],
  won: ['dc1', 'gn5'], deliv: ['dc8', 'dc1'], acc: ['dc8', 'lg4']
};
