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
  if (typeof FEED === 'undefined') missing.push('js/data/home.js (FEED)');
  if (typeof PT === 'undefined' || typeof PSCREENS === 'undefined') missing.push('js/data/portal/ui.js (PT/PSCREENS)');
  if (typeof PSVC === 'undefined' || typeof POUT === 'undefined') missing.push('js/data/portal/svc.js (PSVC/POUT)');
  if (typeof PORG === 'undefined' || typeof PCOMPANY === 'undefined') missing.push('js/data/portal/org.js (PORG/PCOMPANY)');
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
  /* .mockbar（レビュー用の足場）の表示/非表示。メモリのみ（localStorage には保存しない。
     §2-6 の許可集合は「mock」+「.」+「lang」/「theme」/「fav」の 3 つだけ。4 つ目を作らない）。
     リロードで再び表示に戻ってよい（PM 指示）。 */
  mockbar: true,
  pipeCu: '', pipeTeam: '',
  dealSort: { key: 'sg', dir: 'asc' },
  dealF: { cu: '', ow: '', sg: '', rag: '' },
  cuFilter: '',
  kindFilter: '',
  /* PCAND のクローン（採用/見送りの状態を持つ。js/data/portal/** は書き換えない）。
     rev4 §4-2：業種チップを往復しても採否が消えないよう、業種ごとに別のクローンを持つ
     （PCAND 自体は §4-2 の業種化で { mfg, fin, it } の形になっている）。 */
  cand: (typeof PCAND !== 'undefined'
    ? { mfg: (PCAND.mfg || []).map(c => Object.assign({}, c)),
        fin: (PCAND.fin || []).map(c => Object.assign({}, c)),
        it:  (PCAND.it  || []).map(c => Object.assign({}, c)) }
    : { mfg: [], fin: [], it: [] }),
  candSeq: { mfg: 960, fin: 960, it: 960 },
  /* 結果を行に残す（PR-4。設計書 §5-9）。back[業種][画面id][行id] = [{ svc, at, line }]（rev4 §4-2）。
     業種チップを往復しても消えない（§4-4）。メモリのみ。localStorage には書かない（§2-6。4 つ目のキーを作らない） */
  back: { mfg: {}, fin: {}, it: {} },
  /* システム稼働状況（sysops-usecase PR-4。設計書 §6-8）。now は PSYSNOW の id、sysScope は
     自分が使う/担当/全社の切替、sysCu/sysSt は顧客・状態の絞り込み。どれも localStorage には
     保存しない（§2-6。ポータルの許可集合は言語とテーマの 2 つだけ。新しいキーは作らない） */
  now: 'day',
  sysScope: 'all',
  sysCu: '',
  sysSt: ''
};

/* ============================================================
   ヘルパー
   ============================================================ */
const pesc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** 多言語オブジェクトから現在言語の文字列を取り出す（catalog の L() と同じ規則） */
const PL = (obj) => (obj && (obj[pstate.lang] ?? obj.ja)) || '';
const pt = (key) => PL(PT[key]);

/** 業種で行データを引く 1 つのヘルパー（rev4 §4-1。設計書 docs/handoff/2026-09-12-portal-industry-rev4.md）。
    その業種のキーが無いときは it に落とす（PSCREENS[].ind で画面自体を隠しているので通常は起きない）。
    描画側は「PACT.map(...)」ではなく「pd(PACT).map(...)」と、識別子をそのまま渡す形にする
    （js/data/portal/** は const 宣言なので window に載らず、'PACT' のような文字列渡しは使えない）。 */
const pd = (obj) => (obj && (obj[pstate.ind] ?? obj.it)) || [];

/** サービス id（内部 id。例 'kn2'）→ 管理番号（'KN-02'）。表示のためだけの変換（CLAUDE.md §2-11） */
const ppad2 = (n) => String(n).padStart(2, '0');
const psvcCode = (id) => {
  const m = /^([a-z]+)(\d+)$/.exec(id);
  return m ? `${m[1].toUpperCase()}-${ppad2(m[2])}` : String(id).toUpperCase();
};

/** SVCS[].place から、いまの業種で有効な置き場所を読む（rev4 §11-1。設計書
    docs/handoff/2026-09-12-portal-industry-rev4.md）。place が文字列ならそのまま、
    業種別オブジェクト（DC-08・DC-11・EG-01・KN-05 の 4 件だけ）ならその業種のキーを引く。
    キー自体が無ければ undefined（verify §17-c の warn と同じ「未配置」状態）。 */
const placeOf = (s, ind) => {
  const p = s && s.place;
  if (p === undefined) return undefined;
  return typeof p === 'string' ? p : p[ind];
};

/** why の汎用文（PSVC に個別の why が無いサービス用）。ポータル画面の解説文は v1 は日本語のみ（§7-1）だが、
    置き場所を表す画面名だけは PT から引く（SCRNAME を削除した設計に合わせる。設計書 §4-2）。
    置き場所は SVCS[].place が正本（PR-2。設計書 §4-3）。いまの業種（pstate.ind）で解決する（placeOf）。
    'out' の理由は POUT、未配置（キー無し）は「置き場所を決めていません」を返す（verify §17-c の warn と同じ状態）。 */
function pWhyGeneric(svc) {
  const place = placeOf(svc, pstate.ind);
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
    rev4 §2-1（規則 1 の撤回）：置き場所が一致し、かつそのサービスの industries にいまの業種
    （pstate.ind）を含むものだけを出す（自部門ポータルは 3 社に増えたので、他社向けのサービスは
    出さない）。並び順: st 昇順（提供中 → 試行版 → 構想） → 管理番号昇順。
    末尾に、その画面の PSCREENS[].newai（PNEW の未採番候補）があれば付け足す。 */
function pscreenAiIds(screenId) {
  const ind = pstate.ind;
  const placed = (typeof SVCS !== 'undefined' ? SVCS : [])
    .filter(s => placeOf(s, ind) === screenId && Array.isArray(s.industries) && s.industries.includes(ind))
    .sort((a, b) => a.st - b.st || psvcCode(a.id).localeCompare(psvcCode(b.id)))
    .map(s => s.id);
  const scr = (typeof PSCREENS !== 'undefined' ? PSCREENS : []).find(x => x.id === screenId);
  const newai = (scr && scr.newai) || [];
  return placed.concat(newai);
}

/** ホームの「横断で使う AI」（place === '*'）。rev4 §2-1：industries にいまの業種を含むものだけ。
    並び順は pscreenAiIds と同じ規則。 */
function pcrossAiIds() {
  const ind = pstate.ind;
  return (typeof SVCS !== 'undefined' ? SVCS : [])
    .filter(s => placeOf(s, ind) === '*' && Array.isArray(s.industries) && s.industries.includes(ind))
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
/** 行の世界：行の顧客がどの架空世界の会社かを PWORLD から引く。行が無い／行の顧客が世界を跨がないなら、
    いま見ているポータルの業種（＝その会社の世界。rev4 §2-3・§4）。pstate.ind を読むのはこの 1 関数だけ
    （verify §17-l が担保）。 */
const pworldOf = (ctx) => (ctx && PWORLD[ctx.cu]) || pstate.ind;

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

/** rev4 §18-6a（PR-E）。新設 4 画面（qual/order/cred/reg）の文脈カードのもと（PQUAL/PORDER/PCRED/PREG）。
    どれも 1 業種だけが持つ定数なので pd() は使わず直接引く（§18-8。pd() の it フォールバックは
    3 業種共通の定数のためのもので、1 業種限定の定数に使うと他業種の行が出るか [] を返して落ちる）。 */
const PCTXSRC = {
  qual:  () => (typeof PQUAL  !== 'undefined' ? PQUAL  : null),
  order: () => (typeof PORDER !== 'undefined' ? PORDER : null),
  cred:  () => (typeof PCRED  !== 'undefined' ? PCRED  : null),
  reg:   () => (typeof PREG   !== 'undefined' ? PREG   : null)
};
/** PQUAL/PORDER/PCRED/PREG は画面ごとに複数の表を持つ（qual: rows＋tr／order: rows＋ship／
    cred・reg: rows のみ。§9-1〜§9-4）。行の id（管理番号）はどの表からでも一意なので、この並びで
    順に探す。列は head の並びなので、PCTXDEF[scr] のキーごとに「何列目（head の何番目）か」を
    宣言する（設計書 §9-5 の対応。tr／ship はそもそも持たない列があり、その列は省く＝文脈カードに
    出ない。qa1・qa3・kn1 など主要テーブルの行では PCTXDEF.qual の全キーが揃う）。 */
const PCTXTABLES = {
  qual:  [{ arr: 'rows', cols: { no: 0, kind: 1, part: 3, equip: 4, cu: 5, due: 7, state: 8 } },
          { arr: 'tr',   cols: { no: 0, kind: 1, part: 3, equip: 4, state: 6 } }],
  order: [{ arr: 'rows', cols: { no: 0, kind: 1, part: 3, cu: 4, qty: 5, due: 6, state: 7 } },
          { arr: 'ship', cols: { no: 0, kind: 1, part: 3, state: 6 } }],
  cred:  [{ arr: 'rows', cols: { no: 0, ringi: 1, cu: 2, product: 3, amount: 4, stage: 5, due: 7 } }],
  reg:   [{ arr: 'rows', cols: { no: 0, issued: 1, authority: 2, topic: 3, dept: 4, due: 5, state: 6 } }]
};

/** 画面 id と行 id から、文脈カードに渡す「行」を引く（設計書 §5-4・rev4 §18-6a）。
    proj は PDEALS を id で引く（id/nm/cu/ow/sg/due/rag をそのまま持つ）。
    cust は顧客 id を渡すだけの軽い行（cu のみ。担当者テーブルの行から呼ぶときに使う）。
    qual/order/cred/reg は該当画面の定数から、PCTXDEF[scr] のキー順で行の値を組み立てる（rev4 新設）。
    対応していない画面／行が見つからなければ null（ブロックから呼んだときと同じ「行なし」扱いに落ちる）。 */
function pctxRow(scr, id) {
  if (!id) return null;
  if (scr === 'proj') return (typeof PDEALS !== 'undefined' ? PDEALS.find(d => d.id === id) : null) || null;
  if (scr === 'cust') return { cu: id };
  if (scr === 'sys') return pSysCtxRow(id);
  const tables = PCTXTABLES[scr];
  if (tables) {
    const srcObj = PCTXSRC[scr] && PCTXSRC[scr]();
    const d = srcObj && srcObj[pstate.ind];           // 業種限定。it フォールバックを掛けない（§18-8）
    if (!d) return null;
    const keys = (typeof PCTXDEF !== 'undefined' && PCTXDEF[scr]) || [];
    for (const t of tables) {
      const arr = d[t.arr];
      if (!Array.isArray(arr)) continue;
      const row = arr.find(r => r[0] === id);
      if (!row) continue;
      return keys.reduce((o, k) => { const i = t.cols[k]; if (i != null && row[i] !== undefined) o[k] = row[i]; return o; }, {});
    }
    return null;
  }
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
/** 「この画面の AI」ブロックの本体。rev4 §2-1：0 件なら空マスとして PT.noScreenAi を 1 行出す
    （ブロックそのものは消さない。「これから作ります」の会話の材料にする。設計書 §11-4）。
    既存クラスの組み合わせだけで作る（新しいクラスは足さない。CLAUDE.md §2-2・設計書 §1-3）。 */
function paiScreenBlock(screenId) {
  const ids = pscreenAiIds(screenId);
  if (!ids.length) return '<div class="ai"><span style="color:var(--text-muted)">' + pesc(pt('noScreenAi')) + '</span></div>';
  return paiRow(ids);
}
/** ホームの「横断で使う AI」ブロックの本体。0 件なら PT.noCrossAi（rev4 §2-1・§11-4）。 */
function paiCrossBlock() {
  const ids = pcrossAiIds();
  if (!ids.length) return '<div class="ai"><span style="color:var(--text-muted)">' + pesc(pt('noCrossAi')) + '</span></div>';
  return paiRow(ids);
}
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
  if (scr === 'sys') return row.sys;
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
/** 戻りを記録する（同じ行・同じサービスなら上書き。重複を積まない）。
    rev4 §4-2・§4-4：業種ごとに別の入れ物を持つ（back[業種][画面id][行id]）ので、
    業種チップを往復しても消えない。 */
function pbackKeep(scr, id, svc, line) {
  const bucket = pstate.back[pstate.ind] = pstate.back[pstate.ind] || {};
  bucket[scr] = bucket[scr] || {};
  const list = bucket[scr][id] = bucket[scr][id] || [];
  const at = pnow();
  const existing = list.find(b => b.svc === svc);
  if (existing) { existing.at = at; existing.line = line; }
  else list.push({ svc, at, line });
}
/** 行の下に描く戻りの一覧（無ければ空文字＝何も出さない） */
function pbackHTML(scr, id) {
  const bucket = pstate.back[pstate.ind] || {};
  const list = (bucket[scr] && bucket[scr][id]) || [];
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
   システム稼働状況（sysops-usecase PR-4。設計書 §6-4・§6-8・§6-9）。
   「サービス時間対象外」「夜間バッチ処理中」は保存せず、PSYS（台帳）と PSYSEV（イベント）と
   PSYSNOW（時刻プリセット）から毎回導出する。実時計 new Date() は使わない
   （PSYSNOW/PSYSEV の literal な 'YYYY-MM-DD HH:MM' 文字列だけを解釈する。CLAUDE.md 禁止事項）。
   ============================================================ */

/** 'YYYY-MM-DD HH:MM'（CST・上海の壁時計）を比較可能な数値に変換する。Date.UTC() はその年月日時分を
    「UTC の値として」変換するだけで、実行環境の実タイムゾーンに依存しない（設計書 §6-4：時刻はすべて CST）。 */
function pSysDT(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(s || '');
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : NaN;
}
/** 曜日（0=日〜6=土）。y/m/d の組から機械的に決まるので、pSysDT と同じく実時計に依存しない。 */
function pSysDow(ms) { return new Date(ms).getUTCDay(); }
/** その日の 0 時からの分。 */
function pSysHM(ms) { const d = new Date(ms); return d.getUTCHours() * 60 + d.getUTCMinutes(); }

/** サービス時間の文字列（例 '平日 07:00-22:00; 土 07:00-13:00' / '24 時間'）を解析する。 */
function pSysParseHours(spec) {
  if (spec === '24 時間') return { all: true };
  const wd = /平日\s*(\d{2}):(\d{2})-(\d{2}):(\d{2})/.exec(spec || '');
  const sat = /土\s*(\d{2}):(\d{2})-(\d{2}):(\d{2})/.exec(spec || '');
  return {
    all: false,
    wd: wd ? [+wd[1] * 60 + +wd[2], +wd[3] * 60 + +wd[4]] : null,
    sat: sat ? [+sat[1] * 60 + +sat[2], +sat[3] * 60 + +sat[4]] : null
  };
}
/** dow（曜日）・hm（分）がサービス時間の中かどうか（土のみ定義があるとき日曜は対象外＝offhours）。 */
function pSysInHours(spec, dow, hm) {
  const p = pSysParseHours(spec);
  if (p.all) return true;
  if (dow >= 1 && dow <= 5) return !!p.wd && hm >= p.wd[0] && hm < p.wd[1];
  if (dow === 6) return !!p.sat && hm >= p.sat[0] && hm < p.sat[1];
  return false;
}
/** バッチ窓の文字列（例 '日次 01:00-04:00'）を解析する。'月次 月初3営業日 …' は営業日カレンダーが要るため
    対象外とする（デモの 3 プリセットはいずれも月初 3 営業日に当たらない。設計書 §8-4 と同じ簡略化）。 */
function pSysParseBatch(spec) {
  if (!spec || spec.indexOf('日次') !== 0) return null;
  const m = /(\d{2}):(\d{2})-(\d{2}):(\d{2})/.exec(spec);
  return m ? [+m[1] * 60 + +m[2], +m[3] * 60 + +m[4]] : null;
}
/** hm がバッチ窓の中か（日をまたぐ窓 '23:00-02:00' にも対応）。 */
function pSysInBatch(spec, hm) {
  const w = pSysParseBatch(spec);
  if (!w) return false;
  const [s, e] = w;
  return s <= e ? (hm >= s && hm < e) : (hm >= s || hm < e);
}
/** バッチ窓の「開始」を hm と同じ日基準の分に直す（日をまたぐ窓で、いまが日付をまたいだ後なら前日開始扱い）。 */
function pSysBatchStart(spec, hm) {
  const w = pSysParseBatch(spec);
  if (!w) return null;
  const [s] = w;
  return hm >= s ? s : s - 1440;
}

/** その時刻（nowMs）までに起きた、system_id・kind に一致する最新のイベント時刻（ms）。無ければ null。
    rev4 §7-1・§10：PSYSEV は業種化された（金融は sys 画面が無いので fin キーは無い）。 */
function pSysLastAt(sysId, kind, nowMs) {
  const list = pd(PSYSEV).filter(e => e.sys === sysId && e.kind === kind && pSysDT(e.at) <= nowMs);
  if (!list.length) return null;
  return Math.max(...list.map(e => pSysDT(e.at)));
}
/** on/off の 2 種類のイベント（alert系はseverityで判定するため専用。block/unblock・maint_start/maint_end 用）
    から、nowMs 時点で「開いている（on の後に off が来ていない）」かどうかを返す。 */
function pSysOpenFlag(sysId, nowMs, onKind, offKind) {
  const evs = pd(PSYSEV).filter(e => e.sys === sysId && (e.kind === onKind || e.kind === offKind) && pSysDT(e.at) <= nowMs)
    .sort((a, b) => pSysDT(a.at) - pSysDT(b.at));
  let open = false;
  evs.forEach(e => { open = e.kind === onKind; });
  return open;
}
/** nowMs 時点で開いている alert の重大度（'high'/'critical'/'warn'）。閉じていれば null。 */
function pSysOpenSeverity(sysId, nowMs) {
  const evs = pd(PSYSEV).filter(e => e.sys === sysId && (e.kind === 'alert' || e.kind === 'recover') && pSysDT(e.at) <= nowMs)
    .sort((a, b) => pSysDT(a.at) - pSysDT(b.at));
  let sev = null;
  evs.forEach(e => { sev = e.kind === 'alert' ? e.sev : null; });
  return sev;
}

/** 表示状態を導出する（設計書 §6-4 の 7 段。上ほど強い）。base_state 相当（incident/degraded/maint/blocked）は
    イベントから、batch/offhours は台帳とカレンダーから、どちらでもなければ normal。 */
function pSysState(sys, nowMs, dow, hm) {
  const sev = pSysOpenSeverity(sys.id, nowMs);
  if (sev === 'high' || sev === 'critical') return 'incident';
  if (sev === 'warn') return 'degraded';
  if (pSysOpenFlag(sys.id, nowMs, 'maint_start', 'maint_end')) return 'maint';
  if (pSysOpenFlag(sys.id, nowMs, 'block', 'unblock')) return 'blocked';
  if (pSysInBatch(sys.batch, hm)) return 'batch';
  if (!pSysInHours(sys.hours, dow, hm)) return 'offhours';
  return 'normal';
}

/** 継続時間の表示（分／時間／日）。 */
function pSysDurLabel(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return min + '分';
  const h = Math.floor(min / 60), m2 = min % 60;
  if (h < 24) return m2 ? h + '時間' + m2 + '分' : h + '時間';
  return Math.floor(h / 24) + '日';
}
/** 「継続」列。イベント駆動の状態（incident/degraded/blocked/maint）はそのイベントからの経過、
    batch はバッチ窓の開始からの経過。offhours/normal は導出の起点があいまいなため '—'（設計書に明記が
    無い簡略化。デモの表示上の見せ方であり base_state・システムの状態そのものには影響しない）。 */
function pSysSince(sys, state, nowMs, hm) {
  if (state === 'incident' || state === 'degraded') {
    const t = pSysLastAt(sys.id, 'alert', nowMs); return t != null ? pSysDurLabel(nowMs - t) : '—';
  }
  if (state === 'blocked') { const t = pSysLastAt(sys.id, 'block', nowMs); return t != null ? pSysDurLabel(nowMs - t) : '—'; }
  if (state === 'maint') { const t = pSysLastAt(sys.id, 'maint_start', nowMs); return t != null ? pSysDurLabel(nowMs - t) : '—'; }
  if (state === 'batch') {
    const start = pSysBatchStart(sys.batch, hm);
    return start != null ? pSysDurLabel((hm - start) * 60000) : '—';
  }
  return '—';
}
/** 「直近の出来事」列。nowMs までに起きた最新のイベントを 1 件表示する（無ければ '—'）。 */
function pSysLatestEvent(sysId, nowMs) {
  const list = pd(PSYSEV).filter(e => e.sys === sysId && pSysDT(e.at) <= nowMs)
    .sort((a, b) => pSysDT(b.at) - pSysDT(a.at));
  return list[0] || null;
}
const PSYSEVLABEL = { alert: '検知', recover: '復旧', maint_start: '計画停止開始', maint_end: '計画停止終了', block: '閉塞', unblock: '閉塞解除' };
function pSysEventText(ev) {
  if (!ev) return '—';
  const tag = /^INC-/.test(ev.id) ? ev.id + ' ' : '';
  return tag + (PSYSEVLABEL[ev.kind] || ev.kind) + '：' + ev.summary;
}

/** システム 9 件を、いまのプリセット（pstate.now）で状態つきに展開する。
    lastEventKind は「直近の出来事」列の中の行内 AI（SO-04）の出し分けに使う（設計書 §15-2 決定 D）。 */
function pSysRows() {
  const now = (typeof PSYSNOW !== 'undefined' ? PSYSNOW : []).find(p => p.id === pstate.now) || PSYSNOW[0];
  const nowMs = pSysDT(now.date), dow = pSysDow(nowMs), hm = pSysHM(nowMs);
  return pd(PSYS).map(s => {
    const state = pSysState(s, nowMs, dow, hm);
    const ev = pSysLatestEvent(s.id, nowMs);
    return Object.assign({}, s, {
      state, since: pSysSince(s, state, nowMs, hm),
      lastEvent: pSysEventText(ev),
      lastEventKind: ev ? ev.kind : null
    });
  });
}

/* ============================================================
   行内 AI（システム稼働状況。sysops-usecase PR-5。設計書 §15-2 決定 D）。
   「直近の出来事」列の中に置く（列は増やさない）。incident/degraded の行 → SO-01（初動案）、
   直近のイベントが recover の行 → SO-04（障害報告）。どちらにも該当しなければ空配列
   （その行には AI ボタンを出さない）。
   ============================================================ */
function pSysRowAiIds(row) {
  const list = [];
  if (row.state === 'incident' || row.state === 'degraded') list.push('so1');
  if (row.lastEventKind === 'recover') list.push('so4');
  return list;
}

/** PSYS.client（例 '青嶺精工 蘇州'）から PWORLD のキー（例 '青嶺精工'）を引く。社内システム
    （'自社（上海）'）はどの PWORLD キーにも一致せず ''（pworldOf が表示中の業種（pstate.ind）に落ちる。
    rev4 §2-3・§4）。 */
function pSysClientCode(client) {
  return (typeof PWORLD !== 'undefined' ? Object.keys(PWORLD) : []).find(k => (client || '').indexOf(k) === 0) || '';
}
/** 行内 AI の文脈カードに渡す行（PCTXDEF.sys。設計書 §15-2 決定 D。値は data/world/it/ にある語だけ）。
    cu は PCTXDEF.sys には含めない（カードには出さない）が、pworldOf（js/portal/app.js）が
    「行の世界」を決めるのに使う（既存の pscn() の規則にそのまま乗せる。§15-2 決定 D）。
    青嶺精工／碧洋銀行の顧客システムは世界が mfg／fin になり、so1・so4 の台本は SCENARIOS.it に
    しかないため代用表示が出る（既存規則どおり。決定 D で明示的に許容）。
    inc は、いまの時刻までに検知した直近の INC- 番号つきアラートの id（障害番号）。復旧後も同じ
    障害番号を持ち回る（SO-04 の障害報告がどの障害に対するものか分かるように。§8-2）。
    見つからなければ空文字（その行に紐づく障害番号が無い＝縮退等の軽微なアラートのみ）。 */
function pSysCtxRow(id) {
  const row = pSysRows().find(r => r.id === id);
  if (!row) return null;
  const nowP = (typeof PSYSNOW !== 'undefined' ? PSYSNOW : []).find(p => p.id === pstate.now) || PSYSNOW[0];
  const nowMs = pSysDT(nowP.date);
  const inc = pd(PSYSEV).filter(e => e.sys === id && e.kind === 'alert' && /^INC-/.test(e.id) && pSysDT(e.at) <= nowMs)
    .sort((a, b) => pSysDT(b.at) - pSysDT(a.at))[0];
  return {
    sys: row.id, name: row.name, client: row.client, criticality: row.criticality, inc: inc ? inc.id : '',
    cu: pSysClientCode(row.client)
  };
}
/** スコープで絞る（設計書 §15-2 決定 A。§6-5 からの訂正）。'mine'＝内製の社内システム（自社スタッフが使う。
    ② 担当案件〔PDEALS で ow が自分〕のシステムは現ペルソナ〔kishimoto-natsu〕では 0 件のため実装しない）／
    'own'＝担当システム（owner_person_id が自分）／'all'＝全社（台帳 9 行すべて。重大障害は絞り込まず、
    一覧の先頭固定と赤の強調・本番のロール既定フィルタの条件として使う。§15-2 決定 A-1・A-2）。
    デモの固定ペルソナは topbar のアバターと同じ 岸本 奈津（kishimoto-natsu・PMO）。 */
const PSYS_VIEWER = 'kishimoto-natsu';
function pSysInScope(row, scope) {
  if (scope === 'own') return row.ownerId === PSYS_VIEWER;
  if (scope === 'mine') return row.kind === 'internal';
  return true; // 'all'：台帳 9 行すべて（§15-2 決定 A-1）
}
/** 重大障害（criticality === '高' && state === 'incident'）かどうか。一覧の先頭固定・赤強調・
    「本番との違いを表示」の注記・状態フィルタでの絞り込みに共通で使う条件（§15-2 決定 A-1・A-2）。 */
function pSysIsMajor(row) { return row.criticality === '高' && row.state === 'incident'; }

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
