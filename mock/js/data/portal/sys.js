'use strict';
/* mock/js/data/portal/sys.js — PSYS（システム台帳）/ PSYSST（状態語彙 7 つ）/
   PSYSEV（イベント履歴）/ PSYSNOW（時刻プリセット 3 つ）
   設計書 docs/handoff/2026-09-11-sysops-usecase.md §6-3・§6-8・§6-9。

   PSYS は data/world/it/systems.csv（9 行）の写し。表示に要る列だけを持つ（同設計書 §6-8）。
   会社・人・拠点・案件・番号はすべて data/world/it/ にある値（同 §8-1）。

   base_state（normal/incident/degraded/blocked/maint）だけが「人と監視ツールが決めた事実」で、
   offhours（サービス時間対象外）と batch（夜間バッチ処理中）はここには保存しない。表示のたびに
   js/portal/app.js が PSYS.hours / PSYS.batch と PSYSNOW の「いま」から導出する（§6-4）。

   純粋なリテラル宣言のみ（document・localStorage・関数呼び出しを書かない。CLAUDE.md §2-3）。 */

/* ============================================================
   PSYS — システム／設備台帳（rev4 §7-1・§10 で業種化。金融は sys 画面を持たない
   〔PSCREENS.sys.ind = ['mfg','it']〕ので fin キーは無い（正しい。verify §17-n）。
   mfg 6 件は data/world/mfg/equipment.csv の写し（PM 決定 Q3）。kind は IT の
   customer/internal に対し製造は line（ラインの設備）/ tool（金型・治具）。
   it 9 件は data/world/it/systems.csv の写し（origin/main の現行データを移しただけ。§7-4）。

   hours / batch は「導出の入力」（§6-4）。base_state 以外（offhours・batch）は保存しない。
   ============================================================ */
const PSYS = {
  mfg: [
    { id: 'PX-200', name: 'プレス機（L2）', kind: 'line', client: '蘇州工場 L2', project: 'SK-3310-A',
      ownerId: 'liu-yang', owner: '劉 洋', dept: '', criticality: '高',
      hours: '平日 08:00-20:00; 土 08:00-13:00', batch: '日次 07:30-08:00' },
    { id: 'PX-300', name: 'NC 旋盤（L3）', kind: 'line', client: '蘇州工場 L3', project: 'SK-3310-A',
      ownerId: 'wang-lei', owner: '王 磊', dept: '', criticality: '中',
      hours: '平日 08:00-20:00', batch: '日次 07:30-08:00' },
    { id: 'DO-3200', name: '乾燥炉（塗装ライン）', kind: 'line', client: '蘇州工場 塗装', project: 'SK-3310-A',
      ownerId: 'liu-yang', owner: '劉 洋', dept: '', criticality: '高',
      hours: '平日 07:00-22:00', batch: '日次 06:00-07:00' },
    { id: 'D-118', name: '金型（SK-3310-A 段取り用）', kind: 'tool', client: '蘇州工場 L3', project: 'SK-3310-A',
      ownerId: 'liu-yang', owner: '劉 洋', dept: '', criticality: '中',
      hours: '平日 08:00-20:00', batch: '' },
    { id: 'J-3310', name: '塗装治具（ラック）', kind: 'tool', client: '蘇州工場 塗装', project: 'SK-3310-A',
      ownerId: 'wang-lei', owner: '王 磊', dept: '', criticality: '中',
      hours: '平日 07:00-22:00', batch: '' },
    { id: 'D-092', name: '金型（SK-1190 用・倉庫 T-2 保管）', kind: 'tool', client: '蘇州工場 倉庫 T-2', project: '',
      ownerId: '', owner: '設備保全課', dept: 'hozen', criticality: '低',
      hours: '', batch: '' }
  ],
  it: [
    { id: 'SYS-01', name: '生産管理（MES）', kind: 'customer', client: '青嶺精工 蘇州', project: 'P-2411',
      ownerId: 'shinozaki-yuma', owner: '篠崎 悠真', dept: '', criticality: '高',
      hours: '平日 07:00-22:00; 土 07:00-13:00', batch: '日次 01:00-04:00' },
    { id: 'SYS-02', name: '品質管理（QMS）', kind: 'customer', client: '青嶺精工 蘇州', project: 'P-2411',
      ownerId: 'cai-wenbo', owner: '蔡 文博', dept: '', criticality: '中',
      hours: '平日 08:00-20:00', batch: '日次 02:00-03:00' },
    { id: 'SYS-03', name: '勘定系 照会 API', kind: 'customer', client: '碧洋銀行 上海', project: 'P-2425',
      ownerId: 'huang-sihan', owner: '黄 思涵', dept: '', criticality: '高',
      hours: '平日 08:30-19:00', batch: '日次 23:00-02:00' },
    { id: 'SYS-04', name: '与信ワークフロー', kind: 'customer', client: '碧洋銀行 上海', project: 'P-2418',
      ownerId: 'huang-sihan', owner: '黄 思涵', dept: '', criticality: '高',
      hours: '平日 09:00-18:00', batch: '日次 22:00-23:30' },
    { id: 'SYS-05', name: '受発注 EDI', kind: 'customer', client: '碧洋銀行 上海', project: 'P-2398',
      ownerId: 'huang-sihan', owner: '黄 思涵', dept: '', criticality: '中',
      hours: '24 時間', batch: '日次 00:30-01:30' },
    { id: 'SYS-06', name: 'AI エージェント基盤', kind: 'customer', client: '青嶺精工 蘇州', project: 'P-2402',
      ownerId: 'cai-wenbo', owner: '蔡 文博', dept: '', criticality: '中',
      hours: '平日 08:00-20:00', batch: '' },
    { id: 'SYS-07', name: '部門ポータル', kind: 'internal', client: '自社（上海）', project: '',
      ownerId: 'kishimoto-natsu', owner: '岸本 奈津', dept: '', criticality: '中',
      hours: '24 時間', batch: '日次 03:00-03:30' },
    { id: 'SYS-08', name: '勤怠システム', kind: 'internal', client: '自社（上海）', project: '',
      ownerId: '', owner: '管理部', dept: 'kanri', criticality: '中',
      hours: '24 時間', batch: '日次 02:00-02:30' },
    { id: 'SYS-09', name: '会計システム', kind: 'internal', client: '自社（上海）', project: '',
      ownerId: '', owner: '管理部', dept: 'kanri', criticality: '高',
      hours: '平日 09:00-18:00', batch: '月次 月初3営業日 20:00-24:00' }
  ]
};

/* ============================================================
   PSYSST — 状態語彙（rev4 §7-1・§10-2 で業種化。金融キーは無い〔sys 画面が無いため〕。
   lv は色の段階だけ：g=緑（使える）／y=黄（制限あり）／r=赤（使えない）／n=灰（止まっているが予定どおり）。
   ============================================================ */
const PSYSST = {
  mfg: {
    normal:   { lv: 'g', ja: '稼働中',                 zh: '运行中',       en: 'Running' },
    incident: { lv: 'r', ja: '故障停止中',             zh: '故障停机中',   en: 'Down due to a fault' },
    degraded: { lv: 'y', ja: '能力低下（単能運転）',   zh: '产能下降（单机运行）', en: 'Running at reduced capacity' },
    blocked:  { lv: 'y', ja: '段取り中',               zh: '换型中',       en: 'Changeover in progress' },
    maint:    { lv: 'n', ja: '計画保全中',             zh: '计划保养中',   en: 'Planned maintenance' },
    batch:    { lv: 'n', ja: '立上げ・暖機中',         zh: '启动预热中',   en: 'Warming up' },
    offhours: { lv: 'n', ja: '非稼働時間帯',           zh: '非运行时段',   en: 'Outside operating hours' }
  },
  it: {
    normal:   { lv: 'g', ja: '定常運転中',         zh: '正常运行中',   en: 'Operating normally' },
    incident: { lv: 'r', ja: '障害発生中',         zh: '故障发生中',   en: 'Incident in progress' },
    degraded: { lv: 'y', ja: '縮退運転中',         zh: '降级运行中',   en: 'Running degraded' },
    blocked:  { lv: 'y', ja: 'システム閉塞中',     zh: '系统封闭中',   en: 'Closed to users' },
    maint:    { lv: 'n', ja: '計画停止中',         zh: '计划停机中',   en: 'Planned outage' },
    batch:    { lv: 'n', ja: '夜間バッチ処理中',   zh: '夜间批处理中', en: 'Night batch running' },
    offhours: { lv: 'n', ja: 'サービス時間対象外', zh: '服务时间外',   en: 'Outside service hours' }
  }
};

/* ============================================================
   PSYSEV — イベント履歴（rev4 §7-1・§10-4 で業種化。金融キーは無い。
   kind: alert（アラート）/ recover（復旧）/ block（閉塞）/ unblock（閉塞解除）/
         maint_start（計画停止開始）/ maint_end（計画停止終了）。
   severity: high / critical（→ incident）・warn（→ degraded）・info（状態には効かない）。
   at は 'YYYY-MM-DD HH:MM'（すべて壁時計。§6-4）。it は origin/main の現行データを移しただけ（§7-4）。
   ============================================================ */
const PSYSEV = {
  mfg: [
    { id: 'EV-2509-01', sys: 'PX-200', at: '2025-09-11 22:05', kind: 'alert', sev: 'high',
      summary: 'アラーム E-47（スライド下死点位置ずれ）。D-118 の冷間時に発生' },
    { id: 'EV-2509-02', sys: 'PX-200', at: '2025-09-12 00:15', kind: 'recover', sev: 'info',
      summary: '復旧。金型を 40℃ まで予熱して再開（金型予熱基準）' },
    { id: 'EV-2509-03', sys: 'DO-3200', at: '2025-09-11 07:30', kind: 'alert', sev: 'warn',
      summary: '炉内の温度ムラ ±8℃。塗装ブツの一因として調査中' },
    { id: 'EV-2509-04', sys: 'DO-3200', at: '2025-09-11 09:45', kind: 'recover', sev: 'info',
      summary: '復旧。送風量を調整して ±4℃ に収束' },
    { id: 'EV-2509-05', sys: 'PX-300', at: '2025-09-11 21:00', kind: 'block', sev: 'info',
      summary: '品番切替のため段取りを開始（SK-3310-A → SK-2207-B）' },
    { id: 'EV-2509-06', sys: 'PX-300', at: '2025-09-12 06:00', kind: 'unblock', sev: 'info',
      summary: '段取り完了。初品検査へ' },
    { id: 'EV-2509-07', sys: 'J-3310', at: '2025-09-13 02:00', kind: 'maint_start', sev: 'info',
      summary: '治具の洗浄と寸法確認のため計画停止を開始' },
    { id: 'EV-2509-08', sys: 'J-3310', at: '2025-09-13 04:00', kind: 'maint_end', sev: 'info',
      summary: '計画停止終了' }
  ],
  it: [
    { id: 'INC-2026-014', sys: 'SYS-01', at: '2026-09-11 22:05', kind: 'alert', sev: 'high',
      summary: '蘇州工場ラインとの接続が断続的に切れ、生産管理（MES）が応答しない' },
    { id: 'EV-2026-101', sys: 'SYS-01', at: '2026-09-12 00:15', kind: 'recover', sev: 'info',
      summary: '復旧。ネットワーク機器の一時的な過負荷が原因' },
    { id: 'EV-2026-090', sys: 'SYS-01', at: '2026-08-14 23:40', kind: 'alert', sev: 'high',
      summary: 'ライン切替時に MES がタイムアウト' },
    { id: 'EV-2026-091', sys: 'SYS-01', at: '2026-08-15 00:50', kind: 'recover', sev: 'info',
      summary: '復旧。切替手順を見直し' },
    { id: 'EV-2026-102', sys: 'SYS-02', at: '2026-09-11 07:30', kind: 'alert', sev: 'warn',
      summary: '品質管理（QMS）、検査帳票の出力が一部遅延' },
    { id: 'EV-2026-103', sys: 'SYS-02', at: '2026-09-11 09:45', kind: 'recover', sev: 'info',
      summary: '復旧。バッチジョブの再起動で解消' },
    { id: 'EV-2026-104', sys: 'SYS-04', at: '2026-09-11 21:00', kind: 'block', sev: 'info',
      summary: '夜間の一斉データレビューのため、運用担当が意図的に閉塞' },
    { id: 'EV-2026-105', sys: 'SYS-04', at: '2026-09-12 18:00', kind: 'unblock', sev: 'info',
      summary: '閉塞解除' },
    { id: 'EV-2026-106', sys: 'SYS-06', at: '2026-09-13 02:00', kind: 'maint_start', sev: 'info',
      summary: 'モデル更新のための計画停止を開始' },
    { id: 'EV-2026-107', sys: 'SYS-06', at: '2026-09-13 04:00', kind: 'maint_end', sev: 'info',
      summary: '計画停止終了' },
    { id: 'EV-2026-092', sys: 'SYS-03', at: '2026-07-22 20:10', kind: 'alert', sev: 'warn',
      summary: '勘定系 照会 API、応答遅延' },
    { id: 'EV-2026-093', sys: 'SYS-03', at: '2026-07-22 21:05', kind: 'recover', sev: 'info',
      summary: '復旧' },
    { id: 'EV-2026-108', sys: 'SYS-03', at: '2026-09-11 20:00', kind: 'alert', sev: 'warn',
      summary: '勘定系 照会 API、夜間バッチ前に応答が遅くなっている（一部機能のみ）' },
    { id: 'EV-2026-109', sys: 'SYS-03', at: '2026-09-12 06:00', kind: 'recover', sev: 'info',
      summary: '復旧' }
  ]
};

/* ============================================================
   PSYSNOW — デモの時刻プリセット 3 つ（設計書 §6-9。自動送りにしない。実時計を使わない）。
   date は 'YYYY-MM-DD HH:MM'（CST・上海）。label は .mockbar のチップ文言（足場。常に日本語）。
   ============================================================ */
const PSYSNOW = [
  { id: 'day',     label: '平日 10:20', date: '2026-09-11 10:20' },
  { id: 'night',   label: '平日 22:40', date: '2026-09-11 22:40' },
  { id: 'holiday', label: '休日 03:10', date: '2026-09-13 03:10' }
];
