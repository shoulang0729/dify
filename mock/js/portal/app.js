'use strict';
/* mock/js/portal/app.js — pstate（部門ポータルの状態）/ ヘルパー / 設定の永続化
   出所: scratchpad/portal-mock/portal.html。設計書 docs/handoff/2026-09-11-portal-mock-pages.md §3-1・§5-2。

   catalog.html の state / js/app.js とは別物（両ページが同時に読み込まれることは無いためグローバルの
   衝突は起きない）。カタログの CATS/SVCS/SCENARIOS/TEMPLATES は読むだけで書き換えない。 */

/* 読み込み順の保険（catalog.html の js/app.js と同じ作法）。*/
(function () {
  var missing = [];
  if (typeof INDUSTRIES === 'undefined') missing.push('js/data/ui.js (INDUSTRIES)');
  if (typeof CATS === 'undefined' || typeof SVCS === 'undefined') missing.push('js/data/catalog.js (CATS/SVCS)');
  if (typeof PT === 'undefined' || typeof PSCREENS === 'undefined') missing.push('js/data/portal/ui.js (PT/PSCREENS)');
  if (typeof PSVC === 'undefined' || typeof POUT === 'undefined') missing.push('js/data/portal/svc.js (PSVC/POUT)');
  if (typeof PORG === 'undefined') missing.push('js/data/portal/org.js (PORG)');
  if (typeof PDEALS === 'undefined') missing.push('js/data/portal/front.js (PDEALS)');
  if (typeof PACT === 'undefined') missing.push('js/data/portal/common.js (PACT)');
  if (typeof PPEOPLE === 'undefined') missing.push('js/data/portal/mgmt.js (PPEOPLE)');
  if (typeof PEXP === 'undefined') missing.push('js/data/portal/back.js (PEXP)');
  if (!missing.length) return;
  var el = document.getElementById('canvas');
  if (el) el.innerHTML = '<pre style="padding:24px;white-space:pre-wrap">'
    + 'データファイルが読み込まれていません / Data files are not loaded:\n  - '
    + missing.join('\n  - ')
    + '\n\nportal.html の &lt;script src&gt; の並びを確認してください（設計書 2026-09-11-portal-mock-pages.md §3-2）。</pre>';
  throw new Error('portal: data files missing — ' + missing.join(', '));
})();

/* ============================================================
   状態（pstate）。catalog.html の state とは別物。
   ind は .mockbar の業種切替（足場）。mfg/fin に加えて自部門固有の 'it' を持つ（設計書 §5-7）
   ============================================================ */
const pstate = {
  ind: 'it',
  lang: 'ja',
  theme: 'light',
  scr: 'home',
  perm: true,   // 編集権限あり
  dev: true,    // 開発メモを表示
  usr: true,    // 使い方を表示
  prod: false,  // 本番との違いを表示
  pipeCu: '', pipeTeam: '',
  dealSort: { key: 'sg', dir: 'asc' },
  dealF: { cu: '', ow: '', sg: '', rag: '' },
  cuFilter: '',
  kindFilter: '',
  /* PCAND のクローン（採用/見送りの状態を持つ。js/data/portal/** は書き換えない） */
  cand: (typeof PCAND !== 'undefined' ? PCAND.map(c => Object.assign({}, c)) : []),
  candSeq: 960
};

/* ============================================================
   ヘルパー
   ============================================================ */
const pesc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** 多言語オブジェクトから現在言語の文字列を取り出す（catalog の L() と同じ規則） */
const PL = (obj) => (obj && (obj[pstate.lang] ?? obj.ja)) || '';
const pt = (key) => PL(PT[key]);

/** サービス id（内部 id。例 'kn2'）→ 管理番号（'KN-02'）。表示のためだけの変換（CLAUDE.md §2-11） */
const ppad2 = (n) => String(n).padStart(2, '0');
const psvcCode = (id) => {
  const m = /^([a-z]+)(\d+)$/.exec(id);
  return m ? `${m[1].toUpperCase()}-${ppad2(m[2])}` : String(id).toUpperCase();
};

/** why の汎用文（PSVC に個別の why が無いサービス用）。ポータル画面の解説文は v1 は日本語のみ（§7-1）だが、
    置き場所を表す画面名だけは PT から引く（SCRNAME を削除した設計に合わせる。設計書 §4-2）。
    置き場所は SVCS[].place が正本（PR-2。設計書 §4-3）。'out' の理由は POUT、未配置（キー無し）は
    「置き場所を決めていません」を返す（verify §17-c の warn と同じ状態）。 */
function pWhyGeneric(svc) {
  const place = svc && svc.place;
  if (!place) return '置き場所を決めていません。';
  if (place === 'out') return 'ポータルには置きません。' + (POUT[svc.id] || '');
  const label = place === '*' ? pt('allScreens') : pt(place);
  return '「' + (label || pt('allScreens')) + '」に置きます。';
}

/** サービス id → 表示用の情報（短いラベル・分類・成熟度・置き方・文脈・返り値・理由）。
    SVCS を正本にし、PSVC は補足の上書きだけを持つ（st/name/cat は持たない。verify §17-i）。
    'new1' のような PNEW の id は SVCS に存在しないので、PSVC 側の記述だけで完結させる。 */
function psvcOf(id) {
  const isNew = typeof PNEW !== 'undefined' && PNEW.includes(id);
  const ov = PSVC[id];
  if (isNew) {
    if (!ov) return null;
    return {
      short: PL(ov.short), name: PL(ov.title), cat: 'cv', st: 0, how: ov.how,
      ctx: ov.ctx, out: ov.out, why: ov.why, isnew: true, generic: false
    };
  }
  const svc = (typeof SVCS !== 'undefined' ? SVCS : []).find(x => x.id === id);
  if (!svc) return null;
  const o = ov || {};
  const name = PL(svc.name);
  const short = o.short ? PL(o.short) : (name.length > 8 ? name.slice(0, 7) + '…' : name);
  return {
    short, name, cat: svc.cat, st: svc.st, how: o.how || 'btn',
    ctx: o.ctx || pt('ctxGeneric'),
    out: o.out || pt('outGeneric'),
    why: o.why || pWhyGeneric(svc),
    generic: !o.how
  };
}

/** 「この画面の AI」ブロックを SVCS[].place から作る（手書きリストを持たない。設計書 §4-4）。
    並び順: st 昇順（提供中 → 試行版 → 構想） → 管理番号昇順。
    末尾に、その画面の PSCREENS[].newai（PNEW の未採番候補）があれば付け足す。 */
function pscreenAiIds(screenId) {
  const placed = (typeof SVCS !== 'undefined' ? SVCS : [])
    .filter(s => s.place === screenId)
    .sort((a, b) => a.st - b.st || psvcCode(a.id).localeCompare(psvcCode(b.id)))
    .map(s => s.id);
  const scr = (typeof PSCREENS !== 'undefined' ? PSCREENS : []).find(x => x.id === screenId);
  const newai = (scr && scr.newai) || [];
  return placed.concat(newai);
}

/** ホームの「横断で使う AI」（place === '*'）。並び順は pscreenAiIds と同じ規則。 */
function pcrossAiIds() {
  return (typeof SVCS !== 'undefined' ? SVCS : [])
    .filter(s => s.place === '*')
    .sort((a, b) => a.st - b.st || psvcCode(a.id).localeCompare(psvcCode(b.id)))
    .map(s => s.id);
}

/* ---- 架空データの導出値（計算するもの。データ層には置かない。設計書 §4-2） ---- */
const psum = (a, f) => a.reduce((t, d) => t + f(d), 0);
const PRE_STAGES = ['lead', 'prop', 'quote'];
const pinPre = (d) => PRE_STAGES.includes(d.sg);
const PIPE_TOTAL = psum(PDEALS.filter(pinPre), d => d.amt);
const PIPE_W = psum(PDEALS.filter(pinPre), d => d.amt * d.p / 100);
const BACKLOG = psum(PDEALS.filter(d => !pinPre(d)), d => d.amt);

const pstageName = (k) => { const s = PSTAGE.find(x => x[0] === k); return s ? s[1] : k; };
const pragChip = (v) => { const m = { r: 'Red', y: 'Yellow', g: 'Green' }; return '<span class="rag ' + v + '">' + m[v] + '</span>'; };

function ptbl(head, rows) {
  return '<div class="tw"><table><thead><tr>' + head.map(h => '<th' + (h.n ? ' class="num"' : '') + '>' + h.t + '</th>').join('') +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

/* ---- AI 入口の描画 ---- */
function psvcBtn(id, opt) {
  const s = psvcOf(id); if (!s) return '';
  const stv = PST[s.st] || PST[3];
  const code = s.isnew ? pt('unnumbered') : psvcCode(id);
  const label = (opt && opt.label) ? opt.label : s.name;
  return '<button class="aibtn" type="button" data-svc="' + id + '" style="--cat-accent:var(--cat-' + s.cat + ')">' +
    '<span class="no">' + pesc(code) + '</span>' +
    '<span class="nm">' + pesc(label) + '</span>' +
    (opt && opt.plain ? '' : '<span class="st ' + stv[0] + '">' + pesc(stv[1]) + '</span>') +
    (opt && opt.bare ? '' : '<span class="how">' + pesc(PHOW[s.how]) + '</span>') +
    '</button>';
}
function paiRow(list, opt) { return '<div class="ai">' + list.map(n => psvcBtn(n, opt)).join('') + '</div>'; }
function prowAi(list) {
  return '<span class="rowai">' + list.map(n => {
    const v = psvcOf(n); return v ? psvcBtn(n, { bare: true, label: v.short }) : '';
  }).join('') + '</span>';
}

/* ============================================================
   設定の永続化（言語 / テーマ）。§2-6：mock.lang / mock.theme だけを読み書きする。
   キーごとに別の try（§2-6 の作法。壊れた値が他の設定を巻き添えにしない）
   ============================================================ */
function ploadPrefs() {
  try {
    const lang = localStorage.getItem('mock.lang');
    if (lang && ['ja', 'zh', 'en'].includes(lang)) pstate.lang = lang;
  } catch (e) { /* プライベートモード等では既定値のまま */ }
  try {
    const theme = localStorage.getItem('mock.theme');
    if (theme && ['light', 'dark'].includes(theme)) pstate.theme = theme;
  } catch (e) { /* 同上 */ }
}
function psavePrefs() {
  try { localStorage.setItem('mock.lang', pstate.lang); } catch (e) { /* 保存できなくても動作に影響なし */ }
  try { localStorage.setItem('mock.theme', pstate.theme); } catch (e) { /* 同上 */ }
}
