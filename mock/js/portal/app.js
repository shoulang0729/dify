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
  candSeq: 960,
  /* 結果を行に残す（PR-4。設計書 §5-9）。back[画面id][行id] = [{ svc, at, line }]。
     メモリのみ。localStorage には書かない（§2-6。4 つ目のキーを作らない） */
  back: {}
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

/* ============================================================
   台本の実行ドロワー（PR-3）が使うヘルパー。設計書 §14-4〜§14-7。
   ============================================================ */
/** 行の世界：行の顧客がどの架空世界の会社かを PWORLD から引く。行が無い／IT 世界の内側なら 'it'（§14-4・§14-5） */
const pworldOf = (ctx) => (ctx && PWORLD[ctx.cu]) || 'it';

/** サービス id と呼び出しの文脈（行。無ければ null）から、どの業種の台本を引くかを決める。
    候補の順番：① 行の世界 → ② そのサービスが属する業種（宣言順） → ③ INDUSTRIES の宣言順。
    pstate.ind（業種チップ）は一切見ない（規則 3。verify §17-l が機械的に担保）。 */
function pscn(svcId, ctx) {
  const svc = (typeof SVCS !== 'undefined' ? SVCS : []).find(s => s.id === svcId);
  if (!svc) return null;
  const want = pworldOf(ctx);
  const order = [...new Set([want, ...(svc.industries || []), ...INDUSTRIES.map(i => i.id)])];
  for (const k of order) {
    const s = (window.SCENARIOS[k] || {})[svcId];
    if (s) return { scn: s, from: k, want };
  }
  return null; // 台本なし（§5-6 の分岐へ）
}

/** 台本は ja / zh のみ。UI が en のときは ja の台本を使う（catalog の js/app.js の scriptLang と同じ規則。§2-5・§5-8） */
const pscriptLang = (l) => (l === 'zh' ? 'zh' : 'ja');

/** 入力テキストの言語を判定（catalog の js/app.js の detectLang と同じ規則。§2-5・§8）。
    エージェント本体は UI 言語と無関係に日本語・中国語どちらの入力も受け付ける */
function pDetectLang(s) {
  if (/[぀-ヿ]/.test(s)) return 'ja';
  if (/[一-鿿]/.test(s)) return 'zh';
  return pstate.lang;
}

/** 画面 id と行 id から、文脈カードに渡す「行」を引く（設計書 §5-4）。
    proj は PDEALS を id で引く（id/nm/cu/ow/sg/due/rag をそのまま持つ）。
    cust は顧客 id を渡すだけの軽い行（cu のみ。担当者テーブルの行から呼ぶときに使う）。
    対応していない画面／行が見つからなければ null（ブロックから呼んだときと同じ「行なし」扱いに落ちる）。 */
function pctxRow(scr, id) {
  if (!id) return null;
  if (scr === 'proj') return (typeof PDEALS !== 'undefined' ? PDEALS.find(d => d.id === id) : null) || null;
  if (scr === 'cust') return { cu: id };
  return null;
}

/** RAG（案件の状態）の表示名。架空の業務データなので登録された言語のまま（§2-5 と同じ考え方） */
const PRAGNAME = { r: 'Red', y: 'Yellow', g: 'Green' };

/* ---- AI 入口の描画 ----
   rowCtx（{scr, id}）を渡すと、押したボタンに data-ctx-scr / data-ctx-id が付き、
   実行ドロワー（js/portal/demo.js）が押された行の実値を「この画面から渡す文脈」として拾える
   （設計書 §5-4。行の無いブロック呼び出しはこれまでどおり ctx なし＝PT.ctxNoRow の案内に落ちる）。 */
function psvcBtn(id, opt) {
  const s = psvcOf(id); if (!s) return '';
  const stv = PST[s.st] || PST[3];
  const code = s.isnew ? pt('unnumbered') : psvcCode(id);
  const label = (opt && opt.label) ? opt.label : s.name;
  const ctxAttr = (opt && opt.ctxScr && opt.ctxId != null)
    ? ' data-ctx-scr="' + pesc(opt.ctxScr) + '" data-ctx-id="' + pesc(String(opt.ctxId)) + '"' : '';
  return '<button class="aibtn" type="button" data-svc="' + id + '"' + ctxAttr + ' style="--cat-accent:var(--cat-' + s.cat + ')">' +
    '<span class="no">' + pesc(code) + '</span>' +
    '<span class="nm">' + pesc(label) + '</span>' +
    (opt && opt.plain ? '' : '<span class="st ' + stv[0] + '">' + pesc(stv[1]) + '</span>') +
    (opt && opt.bare ? '' : '<span class="how">' + pesc(PHOW[s.how]) + '</span>') +
    '</button>';
}
function paiRow(list, opt) { return '<div class="ai">' + list.map(n => psvcBtn(n, opt)).join('') + '</div>'; }
/** rowCtx: 呼び出し元の行の文脈。{ scr: 'proj'|'cust', id: 行の id } を渡すと行から渡す文脈が有効になる。
    省略すると（画面の他の場所と同じく）ブロックから呼んだ扱いになる。 */
function prowAi(list, rowCtx) {
  return '<span class="rowai">' + list.map(n => {
    const v = psvcOf(n); if (!v) return '';
    const opt = { bare: true, label: v.short };
    if (rowCtx) { opt.ctxScr = rowCtx.scr; opt.ctxId = rowCtx.id; }
    return psvcBtn(n, opt);
  }).join('') + '</span>';
}

/* ============================================================
   結果を行に残す（PR-4。設計書 §5-9）。
   pstate.back[画面id][行id] = [{ svc, at, line }]（メモリのみ。§2-6）。
   行の下に「✦ <管理番号> <AI の戻り>  <line>  <時刻> [開く]」を 1 行残す。
   ============================================================ */
/** いまの時刻の 'HH:MM'（ポータルに DEMO_DATE 相当の固定日付が無いため new Date() を使う。設計書 §5-9） */
function pnow() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
/** 呼び出し元の行 id（rowCtx として渡した id と同じ規則。proj は行の id、cust は顧客名）。
    行が無い（ブロックからの呼び出し）なら null（§5-4 と同じ「行なし」判定）。 */
function pbackRowId(scr, row) {
  if (!row) return null;
  if (scr === 'proj') return row.id;
  if (scr === 'cust') return row.cu;
  return null;
}
/** scn.result[lang].title と items[0].k（表なら rows[0][0]）から 1 行要約を作る。新しい文言は作らない（§5-9） */
function pbackLine(r) {
  if (!r) return '';
  const title = r.title || '';
  const head = title.length > 24 ? title.slice(0, 23) + '…' : title;
  let first = '';
  if (r.items && r.items[0]) first = r.items[0].k;
  else if (r.columns && r.rows && r.rows[0]) first = String(r.rows[0][0]);
  return first ? head + ' ／ ' + first : head;
}
/** 戻りを記録する（同じ行・同じサービスなら上書き。重複を積まない） */
function pbackKeep(scr, id, svc, line) {
  pstate.back[scr] = pstate.back[scr] || {};
  const list = pstate.back[scr][id] = pstate.back[scr][id] || [];
  const at = pnow();
  const existing = list.find(b => b.svc === svc);
  if (existing) { existing.at = at; existing.line = line; }
  else list.push({ svc, at, line });
}
/** 行の下に描く戻りの一覧（無ければ空文字＝何も出さない） */
function pbackHTML(scr, id) {
  const list = (pstate.back[scr] && pstate.back[scr][id]) || [];
  if (!list.length) return '';
  return list.map(b => {
    const code = psvcCode(b.svc);
    return '<div class="pback-item"><span class="pback-mark">&#10022;</span>' +
      '<span class="pback-tag">' + pesc(code) + ' ' + pesc(pt('rowBack')) + '</span>' +
      '<span class="pback-line">' + pesc(b.line) + '</span>' +
      '<span class="pback-at">' + pesc(b.at) + '</span>' +
      '<button class="pback-open" type="button" data-backopen="' + pesc(scr) + '|' + pesc(String(id)) + '|' + pesc(b.svc) + '">' +
      pesc(pt('rowBackOpen')) + '</button></div>';
  }).join('');
}
/** 行の描画に埋め込む戻りのコンテナ。data-scr/data-id を持たせ、キープ後は pbackRefresh() でここだけ差し替える
    （§2-3 の fav と同じ考え方：全体を描き直すとスクロール位置が飛ぶため）。 */
function pbackContainer(scr, id) {
  return '<div class="pback" data-scr="' + pesc(scr) + '" data-id="' + pesc(String(id)) + '">' + pbackHTML(scr, id) + '</div>';
}
/** キープ／再描画のあとで、対応するコンテナだけを差し替える */
function pbackRefresh(scr, id) {
  const sid = String(id).replace(/"/g, '\\"');
  document.querySelectorAll('.pback[data-scr="' + scr + '"][data-id="' + sid + '"]').forEach(el => {
    el.innerHTML = pbackHTML(scr, id);
  });
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
