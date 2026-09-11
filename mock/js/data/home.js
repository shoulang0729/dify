'use strict';
/* mock/js/data/home.js — HOME / FEED（② ダッシュボード・③ 業務フィードの疑似データ）
   出所: mock/catalog.html（分割前）。設計書 docs/handoff/2026-09-07-split-catalog.md §1・§9-1（PR-B）。
   値は 1 バイトも変えていない（抽出コマンドの再実行で diff ゼロを確認）。 */

/* ============================================================
   2c. ② ダッシュボードのホーム用データ
   frequent[].uses は「社内利用実績のサンプル値」。実データではない（画面に注記を出す）。
   SVCS に埋め込まず別定数にする（§2-3 の流儀。SCENARIOS と同じ）
   業種キーで持つ（HOME[industry]。§1-5）
   ============================================================ */
const HOME = {
  mfg: {
    frequent: [
      { id: 'kn1', uses: 312 },
      { id: 'lg1', uses: 268 },
      { id: 'dc2', uses: 214 },
      { id: 'nm3', uses: 186 },
      { id: 'qa1', uses: 147 },
      { id: 'kn3', uses: 132 }
    ],
    recommended: [
      { id: 'dc1',
        why: { ja: '現場の数字から本社向け報告の下書きまで一気に作れます。効果が最初に見えやすい業務です。',
               zh: '可以从现场数据一口气生成给总部的汇报草案，是最容易先看到效果的业务。',
               en: 'Turns plant figures into a draft report for headquarters in one step. The easiest place to see value first.' } },
      { id: 'kn2',
        why: { ja: '止まった設備の型式と症状を入れるだけ。紙のマニュアルを探す時間がなくなります。',
               zh: '只需输入停机设备的型号和现象，不必再翻纸质手册。',
               en: 'Just enter the model and symptom of the stopped machine. No more hunting through paper manuals.' } },
      { id: 'qa3',
        why: { ja: '顧客からの一報に、その日のうちに一次回答を返せます。分類も記録に残ります。',
               zh: '客户来函当天即可给出初步答复，分类结果也会留存记录。',
               en: 'Send a first reply to a customer complaint the same day, with the classification kept on record.' } }
    ]
  },
  /* ---- 金融（碧洋銀行）。世界マスタは data/world/fin/**（設計書 §7-2）。
     台本は未投入（PR-4）なので、ここで挙げるサービスも start は chat フォールバックになる（§1-4） ---- */
  fin: {
    frequent: [
      { id: 'kn6', uses: 258 },
      { id: 'dc9', uses: 221 },
      { id: 'gn6', uses: 196 },
      { id: 'rs1', uses: 174 },
      { id: 'kn4', uses: 151 },
      { id: 'dc2', uses: 129 }
    ],
    recommended: [
      { id: 'kn6',
        why: { ja: '窓口や事務の定型的な問い合わせに、根拠となる条番号つきで即答できます。まず試す 1 本目に向いています。',
               zh: '柜面与事务的常见咨询可即刻附条款依据作答，适合作为最先尝试的一个。',
               en: 'Answers routine front- and back-office questions instantly with the clause number cited. A good first agent to try.' } },
      { id: 'dc9',
        why: { ja: '議案・報告書・提案書のどれも、最低限の情報を入れるだけで骨子ができます。作成に時間がかかる文書から効果が見えます。',
               zh: '无论议案、报告还是提案书，只需输入最少信息即可生成骨架，最耗时的文书类工作最先看到效果。',
               en: 'Drafts proposals, reports and pitches alike from the minimum facts. The documents that take longest to write show the benefit first.' } },
      { id: 'rs1',
        why: { ja: '取引先・業界のニュースを毎回手作業で集める必要がなくなります。設定は 1 度だけです。',
               zh: '不必再每次手动收集客户与行业新闻，只需设定一次。',
               en: 'No more manually collecting client and industry news every time. Set it up once.' } }
    ]
  },
  /* ---- IT（日系 SIer 上海拠点）。世界マスタは data/world/it/**（設計書 §3-4）。
     台本は未投入（PR-4）なので、ここで挙げるサービスも start は chat フォールバックになる ---- */
  it: {
    frequent: [
      { id: 'dc2', uses: 241 },
      { id: 'eg1', uses: 188 },
      { id: 'po4', uses: 163 },
      { id: 'gn6', uses: 141 },
      { id: 'kn4', uses: 126 },
      { id: 'dc8', uses: 104 }
    ],
    recommended: [
      { id: 'eg1',
        why: { ja: '仕様書の読解と顧客からの質問対応は、どの案件でも立ち上がりに必ず起きます。最初に効果が見える 1 本です。',
               zh: '规格书的解读与客户提问应对，在任何项目的启动期都必然发生，是最先见效的一个。',
               en: 'Reading the spec and answering the client\'s questions happens at the start of every project. The quickest place to see value.' } },
      { id: 'dc2',
        why: { ja: '日中が混ざる案件レビューの議事録を、その場で両言語に起こせます。すでに提供中で、今日から使えます。',
               zh: '中日混合的项目评审纪要可当场生成双语版本。已在提供中，今天即可使用。',
               en: 'Turns a mixed Japanese/Chinese project review into minutes in both languages on the spot. Already in service — usable today.' } },
      { id: 'po6',
        why: { ja: '負荷が 1 人に寄っていることは、遅れになって初めて分かることが多い業務です。案件の状態と突き合わせて早く出します。',
               zh: '负荷集中于一人往往要等到出现延期才被发现。本服务结合项目状态提前呈现。',
               en: 'Load concentrating on one person usually only becomes visible once something slips. This surfaces it early by reading it against project status.' } }
    ]
  }
};

/* ============================================================
   2d. ③ 業務フィードのホーム用データ
   items は「担当者の今日の仕事」を表す疑似イベント。すべてデモ用のサンプル。
   絶対日付は書かない（デモ日が変わっても古びないよう相対表現だけにする）
   kind: 'due'（期限あり）/ 'routine'（定例）/ 'notify'（お知らせ）
   タイトル・成熟度・分類は SVCS から引くので、ここには持たせない
   業種キーで持つ（FEED[industry]。§1-5）
   ============================================================ */
const FEED = {
  mfg: {
    persona: { name: { ja: '李 強', zh: '李强', en: 'Li Qiang' },
               role: { ja: '製造二課 課長', zh: '制造二科 科长', en: 'Manufacturing Sec. 2 Manager' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' } },
    mine:   ['qa', 'dc', 'nm'],
    recent: ['lg1', 'dc2', 'kn1', 'gn5'],
    items: [
      { id: 'qa1', kind: 'due',
        when: { ja: '本日 17:00 まで', zh: '今天 17:00 前', en: 'Today, by 17:00' },
        note: { ja: 'ライン3 の寸法不良。顧客への提出は明日 10:00。',
                zh: '3号线尺寸不良，明天 10:00 前需提交给客户。',
                en: 'Dimensional defect on line 3. Due to the customer tomorrow at 10:00.' } },
      { id: 'dc5', kind: 'due',
        when: { ja: '明日まで', zh: '明天前', en: 'By tomorrow' },
        note: { ja: '乾燥炉の更新稟議。金額区分が変わり差し戻しになっています。',
                zh: '烘干炉更新审批。金额档次变更后被退回。',
                en: 'Approval request for the drying oven. Returned because the amount tier changed.' } },
      { id: 'qa2', kind: 'due',
        when: { ja: '今週中', zh: '本周内', en: 'This week' },
        note: { ja: '治具の切り替えを来週に予定。先に影響範囲を確認します。',
                zh: '计划下周更换治具，需先确认影响范围。',
                en: 'The jig changeover is planned for next week. Check the impact first.' } },
      { id: 'nm3', kind: 'routine',
        when: { ja: '毎日 8:30', zh: '每天 8:30', en: 'Daily at 8:30' },
        note: { ja: '前日の生産実績と不良件数を朝会用にまとめます。',
                zh: '把前一天的产量与不良件数整理成早会材料。',
                en: 'Summarise output and defect counts from the previous day for the morning meeting.' } },
      { id: 'lg3', kind: 'routine',
        when: { ja: '毎週月曜', zh: '每周一', en: 'Every Monday' },
        note: { ja: '今週の作業変更点を現場向けの中国語に書き下します。',
                zh: '把本周作业变更点写成现场用中文。',
                en: 'Rewrite the changes for this week into Chinese for the shop floor.' } },
      { id: 'kn5', kind: 'notify',
        when: { ja: '新着', zh: '最新', en: 'New' },
        note: { ja: '地方当局の排水基準通達が公布されました。該当手順の確認依頼が来ています。',
                zh: '地方主管部门发布了排水标准通知，已收到相关作业确认请求。',
                en: 'A local authority notice on wastewater limits was issued. A review of the related procedures is requested.' } },
      { id: 'en1', kind: 'notify',
        when: { ja: '新着', zh: '最新', en: 'New' },
        note: { ja: '取引先の仕様書が Rev.C に更新されました。差分の確認をおすすめします。',
                zh: '客户规格书已更新为 Rev.C，建议确认差异。',
                en: 'A customer specification moved to Rev.C. Reviewing the differences is recommended.' } }
    ]
  },
  /* ---- 金融（碧洋銀行）。persona は data/world/fin/people.csv の韓雪（事務統括部 主管）。
     部署・拠点・文書番号の書式は data/world/fin/**（org.csv・calendar.md）の正本に合わせる。
     絶対日付・実在の稟議番号等は書かない（すべて相対表現・架空の例） ---- */
  fin: {
    persona: { name: { ja: '韓 雪', zh: '韩雪', en: 'Han Xue' },
               role: { ja: '事務統括部 主管', zh: '事务统筹部 主管', en: 'Operations Planning Dept. Supervisor' },
               site: { ja: '上海本部', zh: '上海总部', en: 'Shanghai Head Office' } },
    mine:   ['kn', 'dc', 'gn'],
    recent: ['dc2', 'kn6', 'dc9', 'gn6'],
    items: [
      { id: 'dc9', kind: 'due',
        when: { ja: '本日 17:00 まで', zh: '今天 17:00 前', en: 'Today, by 17:00' },
        note: { ja: '月次報告のドラフト。経営企画部への提出前レビューが残っています。',
                zh: '月度报告草案。提交经营企划部前的评审尚未完成。',
                en: 'Draft of the monthly report. The pre-submission review for Corporate Planning is still open.' } },
      { id: 'kn6', kind: 'due',
        when: { ja: '明日まで', zh: '明天前', en: 'By tomorrow' },
        note: { ja: '甲社からの送金手続に関する照会。根拠条番号つきで回答する必要があります。',
                zh: '甲社关于汇款手续的咨询，需要附条款依据作答。',
                en: 'An inquiry from 甲社 about a remittance procedure. The reply needs the clause number cited.' } },
      { id: 'gn6', kind: 'due',
        when: { ja: '今週中', zh: '本周内', en: 'This week' },
        note: { ja: '営業第一部から頼まれた資料取りまとめが止まっています。期限が近いので声掛けが必要です。',
                zh: '受营业第一部委托整理的资料仍未完成，期限将近，需要提醒。',
                en: 'A document collation asked for by Corporate Banking Division I is stalled. The deadline is close and needs a nudge.' } },
      { id: 'dc2', kind: 'routine',
        when: { ja: '毎週月曜', zh: '每周一', en: 'Every Monday' },
        note: { ja: '週次の部内会議の議事録を作成し、未決事項を次回への論点として整理します。',
                zh: '整理每周部门例会纪要，并把未决事项列为下次的议题。',
                en: 'Write up minutes for the weekly department meeting and list the open items as next week\'s agenda.' } },
      { id: 'rs1', kind: 'routine',
        when: { ja: '毎日 8:30', zh: '每天 8:30', en: 'Daily at 8:30' },
        note: { ja: '主要取引先のニュース配信を確認し、必要なものだけ営業部へ転送します。',
                zh: '查看主要客户的新闻推送，仅将需要的内容转发给营业部门。',
                en: 'Check the news feed for key clients and forward only what matters to the coverage teams.' } },
      { id: 'kn8', kind: 'notify',
        when: { ja: '新着', zh: '最新', en: 'New' },
        note: { ja: '当局通達が更新されました。事務手続書への反映要否の確認を求められています。',
                zh: '监管通知已更新，需要确认是否要反映到事务手册中。',
                en: 'A regulatory notice was updated. A check on whether the procedure manual needs revising has been requested.' } },
      { id: 'dc8', kind: 'notify',
        when: { ja: '新着', zh: '最新', en: 'New' },
        note: { ja: '報告レビューの対象に「当局報告」の種別が加わりました。台帳との照合ルールを確認してください。',
                zh: '报告评审新增「当局报告」种类，请确认与台账的核对规则。',
                en: 'Report review now covers the regulatory-report type as well. Check the reconciliation rule against the log.' } }
    ]
  },
  /* ---- IT（日系 SIer 上海拠点）。persona は data/world/it/people.csv の岸本奈津（PMO室 主任）。
     部署・拠点・文書番号の書式は data/world/it/**（org.csv・calendar.md）の正本に合わせる ---- */
  it: {
    persona: { name: { ja: '岸本 奈津', zh: '岸本奈津', en: 'Natsu Kishimoto' },
               role: { ja: 'PMO室 主任', zh: 'PMO室 主管', en: 'PMO Office Lead' },
               site: { ja: '上海拠点', zh: '上海分公司', en: 'Shanghai Office' } },
    mine:   ['po', 'dc', 'kn'],
    recent: ['dc2', 'po4', 'eg1', 'gn6'],
    items: [
      { id: 'po4', kind: 'due',
        when: { ja: '本日 17:00 まで', zh: '今天 17:00 前', en: 'Today, by 17:00' },
        note: { ja: '先月分の稼働を案件別に配分します。管理部への提出は明日です。',
                zh: '将上月的稼动按项目分摊，明天需提交管理部。',
                en: 'Allocate last month\'s utilization by project. Due to Administration tomorrow.' } },
      { id: 'dc8', kind: 'due',
        when: { ja: '明日まで', zh: '明天前', en: 'By tomorrow' },
        note: { ja: '月次の進捗報告。提出前に数字と本文の食い違いを見ておきます。',
                zh: '月度进度报告。提交前需检查数字与正文是否一致。',
                en: 'The monthly progress report. Check the figures against the text before it goes out.' } },
      { id: 'gn6', kind: 'due',
        when: { ja: '今週中', zh: '本周内', en: 'This week' },
        note: { ja: '営業部から頼まれた要員表の更新が止まっています。期限が近いので声掛けが必要です。',
                zh: '受营业部委托的人员表更新仍未完成，期限将近，需要提醒。',
                en: 'The staffing sheet asked for by Sales is stalled. The deadline is close and it needs a nudge.' } },
      { id: 'dc2', kind: 'routine',
        when: { ja: '毎週月曜', zh: '每周一', en: 'Every Monday' },
        note: { ja: '週次の案件レビューの議事録を作り、未決事項を次回の論点として整理します。',
                zh: '整理每周项目评审的纪要，并把未决事项列为下次的议题。',
                en: 'Write up the weekly project review and carry the open items over as next week\'s agenda.' } },
      { id: 'po5', kind: 'routine',
        when: { ja: '毎月 1 日', zh: '每月 1 日', en: 'The 1st of each month' },
        note: { ja: '年休の残日数を確認し、期限までに消化できない人に取得時期の候補を出します。',
                zh: '确认年假余额，并为到期前无法消化的人员提出休假时间候选。',
                en: 'Check remaining annual leave and suggest when to take it for anyone who cannot use it before it expires.' } },
      { id: 'kn5', kind: 'notify',
        when: { ja: '新着', zh: '最新', en: 'New' },
        note: { ja: '個人情報の取り扱いに関する通達が更新されました。受託案件の手順書への影響を確認してください。',
                zh: '个人信息处理相关通知已更新，请确认对受托项目作业手册的影响。',
                en: 'A notice on handling personal data was updated. Check the impact on the procedures for client projects.' } },
      { id: 'sl2', kind: 'notify',
        when: { ja: '新着', zh: '最新', en: 'New' },
        note: { ja: '先月の失注 3 件の理由が登録されました。四半期の傾向に反映されています。',
                zh: '上月 3 件失单的原因已登记，已反映到季度趋势中。',
                en: 'Reasons for last month\'s three lost deals were recorded and are reflected in the quarterly trend.' } }
    ]
  }
};
