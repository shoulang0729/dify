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
  }
};
