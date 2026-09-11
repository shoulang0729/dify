'use strict';
/* mock/js/data/portal/svc.js — PSVC（サービス別の説明）/ POUT（'out' の理由）/
   PNEW（未採番の追加候補）/ PSTAGE_AI（案件ステージ→AI）
   出所: scratchpad/portal-mock/portal.html。設計書 docs/handoff/2026-09-11-portal-mock-pages.md §3-1・§4-2・§4-3。

   キーはすべて SVCS[].id（内部 id。例 'kn2'）。管理番号（'KN-02'）への変換は
   js/portal/app.js の psvcCode() が行う（別データを持たない。CLAUDE.md §2-11）。

   「サービス → ポータル画面」の対応表は mock/js/data/catalog.js の SVCS[].place に移した（PR-2。
   設計書 §4-3・§11）。ここに残すのは 'out'（ポータルには置かない）のときの理由文だけ（POUT）。

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
  gn8: { short: { ja: '名刺OCR', zh: '名片OCR', en: 'Business card OCR' }, how: 'flow',
    ctx: '名刺の画像（表・裏）', out: '言語判定＋氏名・会社・部門・役職・拠点・連絡先。役職は原文と社内表記の両方',
    why: '名刺管理は NocoBase 側に持ち、AI は読み取りと抽出だけを担う（IT 業のカタログに GN-08 として採番済み。設計書 §14-8）' },
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
    why: 'KPI 画面から。構想段階' },
  so1: { short: { ja: '初動案', zh: '初期处置', en: 'First response' }, how: 'flow',
    ctx: 'アラート（システム id・重大度・本文の要約）', out: '影響範囲・関係者・初動手順・過去の類似障害',
    why: '障害の行から。取り込んだ直後に裏で走り、結果を行に書く。構想段階' },
  so2: { short: { ja: '稼働照会', zh: '运行查询', en: 'Status lookup' }, how: 'embed',
    ctx: '質問文（日/中どちらでも）', out: '対象システムの一覧と、その状態がいつから続いているか',
    why: 'この画面の常設窓口。サービス時間外・夜間バッチは障害と区別して答える。構想段階' },
  so3: { short: { ja: '稼働報告', zh: '运行报告', en: 'Availability report' }, how: 'btn',
    ctx: '期間・対象システム（顧客単位でも社内単位でも）', out: '稼働率・障害件数・MTTR の報告ドラフト（顧客版／社内版）',
    why: 'KPI の K5 から。月次報告の下書きを画面の中で出す。構想段階' },
  so4: { short: { ja: '障害報告', zh: '故障报告', en: 'Incident report' }, how: 'btn',
    ctx: '障害番号（アラート・対応記録・連絡履歴が紐づく）', out: '時系列・原因・暫定/恒久対策・再発防止策の下書き',
    why: '復旧した障害の行から。下書きは DC-08 の提出前レビューへ、確定版は部門ナレッジ D5 へ。構想段階' }
};

/* ============================================================
   POUT — SVCS[].place === 'out' のサービスの理由文（18 件・日本語のみ）。
   置き場所そのもの（画面 id ／ '*' ／ 'out'）は mock/js/data/catalog.js の SVCS[].place が正本（設計書 §4-3）。
   ここが持つのは「なぜポータルに置かないか」という、ポータルの解説レイヤーの文だけ（§4-3）。
   ============================================================ */
const POUT = {
  kn1: '顧客の業務（青嶺精工の技術ナレッジ）', kn2: '顧客の業務（設備マニュアル）',
  kn5: '顧客の業務（当局通達の反映）', kn6: '顧客の業務（銀行の事務手続）',
  kn7: '顧客の業務（行内営業情報）', kn8: '顧客の業務（当局通達DB）',
  cv3: '顧客の業務（審査コメント）', cv4: '顧客の業務（KYC）',
  qa1: '顧客の業務（製造の品質）', qa2: '顧客の業務（4M 変更管理）',
  qa3: '顧客の業務（クレーム対応）', qa4: '顧客の業務（工程監査）',
  dc4: '顧客の業務（工場の掲示物）', dc6: '顧客の業務（通関書類）',
  nm4: '顧客の業務（在庫・納期）',
  en1: '顧客の業務（仕様改訂）', en2: '顧客の業務（BOM）', en3: '顧客の業務（図面）'
};

/* ============================================================
   PNEW — 未採番の追加候補（PSVC の外。SVCS には存在しない仮 id。
   ここに挙げた id は「SVCS に実在すること」の検査から除外される。verify §17-g）
   'new1'（名刺 OCR）は GN-08 として採番されたため空にした（設計書 §14-8）。
   ============================================================ */
const PNEW = [];

/* ============================================================
   PSTAGE_AI — 案件ステージ → この段階で使う AI（SVCS の内部 id）。
   SL-01（引合の受注確度推定。sl1）は IT 業のマージ（#255〜#259）で place: 'proj' が付いた 10 件の 1 つ
   （設計書 §14-8）。受注前（lead/prop/quote）のどの段階でも「この案件は決まりそうか」を聞く場面がある
   ため、受注前の 3 段階すべてに置く（PR-3。行から呼ぶ動作の配線）。
   ============================================================ */
const PSTAGE_AI = {
  lead: ['rs1', 'gn5', 'sl1'], prop: ['dc9', 'dc8', 'sl1'], quote: ['nm1', 'dc8', 'sl1'],
  won: ['dc1', 'gn5'], deliv: ['dc8', 'dc1'], acc: ['dc8', 'lg4']
};

/* ============================================================
   PCTXDEF — 画面ごとに「行から何を渡すか」を宣言する（設計書 §5-4）。
   行から AI を呼んだとき、この画面の行の実値のうちどのフィールドを
   「この画面から渡す文脈」に差し込むかのフィールド名リスト。
   値そのものはここには置かない（js/portal/app.js の pctxRow() が該当画面の
   データ（PDEALS など）から引く）。ブロックから呼んだ場合（行が無い場合）は
   使わない（PT.ctxNoRow の案内だけを出す）。
   ============================================================ */
const PCTXDEF = {
  proj: ['id', 'nm', 'cu', 'ow', 'sg', 'due', 'rag'],
  cust: ['cu', 'own', 'stage'],
  act:  ['id', 'tgt', 'ttl', 'ow', 'due'],
  vend: ['nm', 'kind', 'credit', 'until'],
  watch:['date', 'src', 'ttl', 'deal'],
  meet: ['id', 'ttl', 'date', 'att'],
  exp:  ['id', 'kind', 'amt', 'state'],
  req:  ['id', 'kind', 'applicant', 'state'],
  ppl:  ['nm', 'role', 'deals', 'util'],
  trn:  ['id', 'kind', 'ttl', 'due'],
  know: ['grp', 'ttl', 'owner', 'updated'],
  kpi:  ['topic', 'metric', 'value'],
  /* sys: システム稼働状況（sysops-usecase PR-5。設計書 §15-2 決定 D）。
     incident/degraded の行 → SO-01、直近のイベントが recover の行 → SO-04 に渡す文脈。
     値は js/portal/app.js の pSysCtxRow() が PSYS／PSYSEV（data/world/it/systems.csv・
     documents.csv の写し）から組み立てる。 */
  sys:  ['sys', 'name', 'client', 'criticality', 'inc'],
  home: []
};
