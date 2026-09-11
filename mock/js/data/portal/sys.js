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
   PSYS — システム台帳 9 件（data/world/it/systems.csv の写し）
   kind: 'customer'（顧客のシステム）/ 'internal'（自社の社内システム）。
   ownerId: data/world/it/people.csv の id（mock/js/data/portal/mgmt.js の PPEOPLE と同一人物）。
   dept は担当者が個人でなく部署のとき（社内システムの一部）。
   hours / batch はそれぞれ systems.csv の service_hours / batch_window をそのまま持つ
   （導出の入力。§6-4。月次バッチ「月初 3 営業日」は本デモの 3 プリセットのどれにも該当しないため
   js/portal/app.js の pSysParseBatch() は '月次' を対象外にする＝簡略化。§8-4 と同じ考え方）。
   ============================================================ */
const PSYS = [
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
];

/* ============================================================
   PSYSST — 状態語彙 7 つ（設計書 §6-3。3 言語。lv は色の段階だけ：
   g=緑（使える）／y=黄（制限あり）／r=赤（使えない）／n=灰（止まっているが予定どおり））
   ============================================================ */
const PSYSST = {
  normal:   { lv: 'g', ja: '定常運転中',         zh: '正常运行中',   en: 'Operating normally' },
  incident: { lv: 'r', ja: '障害発生中',         zh: '故障发生中',   en: 'Incident in progress' },
  degraded: { lv: 'y', ja: '縮退運転中',         zh: '降级运行中',   en: 'Running degraded' },
  blocked:  { lv: 'y', ja: 'システム閉塞中',     zh: '系统封闭中',   en: 'Closed to users' },
  maint:    { lv: 'n', ja: '計画停止中',         zh: '计划停机中',   en: 'Planned outage' },
  batch:    { lv: 'n', ja: '夜間バッチ処理中',   zh: '夜间批处理中', en: 'Night batch running' },
  offhours: { lv: 'n', ja: 'サービス時間対象外', zh: '服务时间外',   en: 'Outside service hours' }
};

/* ============================================================
   PSYSEV — イベント履歴 12 件（追記のみの想定。§6-8 の system_events の写し。
   kind: alert（アラート）/ recover（復旧）/ block（閉塞）/ unblock（閉塞解除）/
         maint_start（計画停止開始）/ maint_end（計画停止終了）。
   severity: high / critical（→ incident）・warn（→ degraded）・info（状態には効かない）。
   occurred_at は 'YYYY-MM-DD HH:MM'（すべて CST・上海の壁時計。§6-4）。
   INC-2026-014 は SYS-01 の 2026-09-11 22:05 検知（data/world/it/documents.csv の番号。§8-2）。
   ============================================================ */
const PSYSEV = [
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
];

/* ============================================================
   PSYSNOW — デモの時刻プリセット 3 つ（設計書 §6-9。自動送りにしない。実時計を使わない）。
   date は 'YYYY-MM-DD HH:MM'（CST・上海）。label は .mockbar のチップ文言（足場。常に日本語）。
   ============================================================ */
const PSYSNOW = [
  { id: 'day',     label: '平日 10:20', date: '2026-09-11 10:20' },
  { id: 'night',   label: '平日 22:40', date: '2026-09-11 22:40' },
  { id: 'holiday', label: '休日 03:10', date: '2026-09-13 03:10' }
];
