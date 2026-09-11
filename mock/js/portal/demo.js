'use strict';
/* mock/js/portal/demo.js — 台本（SCENARIOS）の実行ドロワー（PR-3）。
   設計書 docs/handoff/2026-09-11-portal-mock-pages.md §5・§14（rev2：業種フィルタの矛盾の解消と、
   台本の業種の規則）。

   共有するのはデータ（SCENARIOS / TEMPLATES）だけで、描画はこのファイルが持つ（§5-2）。
   台本は 1 バイトも書き換えない（mock/js/data/scenarios/** は読むだけ。AC-22）。
   カタログの state / js/app.js / js/render.js は一切触らない。ポータルは別の pstate（js/portal/app.js）
   と、この描画層を持つ。

   §14 の 3 つの規則をこのファイルで守る（verify §17-l が機械的に検査する）：
     規則 1：「この画面の AI」は業種で絞らない（js/portal/app.js の pscreenAiIds/pcrossAiIds の話。
              ここでは何もしない）
     規則 3：台本の業種は「行の世界」（pworldOf/pscn。js/portal/app.js）が決める。
              このファイルは pstate.ind を一切参照しない。 */

/* ============================================================
   ドロワーの実行時状態（pstate とは別。閉じるたびに捨てる一時状態）
   ============================================================ */
let dCtx = null;

/** 行から呼んだときの文脈カード（設計書 §5-4）。proj / cust は具体的な行の組み立て方を持ち、
    それ以外の画面は PCTXDEF の宣言（フィールド名リスト）から汎用に組み立てる（配線していない画面では
    実行時に到達しないが、壊れずに動くようにしておく）。戻り値は [ラベル, 値] の配列。 */
const PCTX_ROW_BUILDERS = {
  proj: (row) => {
    const rows = [];
    if (row.id || row.nm) rows.push([pt('ctxProject'), [row.id, row.nm].filter(Boolean).join('　')]);
    if (row.cu) rows.push([pt('ctxCustomer'), row.cu]);
    if (row.ow) rows.push([pt('ctxOwner'), row.ow]);
    if (row.sg) rows.push([pt('ctxStage'), pstageName(row.sg) + (row.due ? ' ／ ' + pt('ctxDue') + ' ' + row.due : '')]);
    else if (row.due) rows.push([pt('ctxDue'), row.due]);
    if (row.rag) rows.push([pt('ctxState'), PRAGNAME[row.rag] || row.rag]);
    return rows;
  },
  cust: (row) => {
    const rows = [];
    if (row.cu) rows.push([pt('ctxCustomer'), row.cu]);
    if (row.own) rows.push([pt('ctxOwner'), row.own]);
    if (row.stage) rows.push([pt('ctxStage'), row.stage]);
    return rows;
  }
};
function dCtxRows(scr, row) {
  if (!row) return [];
  const builder = PCTX_ROW_BUILDERS[scr];
  if (builder) return builder(row);
  const fields = (typeof PCTXDEF !== 'undefined' && PCTXDEF[scr]) || [];
  return fields.filter(k => row[k] !== undefined && row[k] !== '').map(k => [k, row[k]]);
}
function dFldHTML(label, val) {
  return '<div class="fld auto"><label>' + pesc(label) + '</label>' +
    '<div class="val"><span>' + pesc(val) + '</span><span class="autotag">' + pesc(pt('autoFilled')) + '</span></div></div>';
}

/* ============================================================
   台本ターンの消費（catalog の js/app.js の consume()/nextTurn() と同じ規則。§5-7）
   ============================================================ */
function dNextTurn(lang) {
  if (!dCtx || !dCtx.pr) return null;
  return dCtx.pr.scn.script[lang][dCtx.log.length] || null;
}
function dConsume(lang, qOverride) {
  if (!dCtx || !dCtx.pr) return false;
  const turn = dNextTurn(lang);
  if (!turn) return false;
  dCtx.log.push({ lang, q: qOverride ?? turn.q, a: turn.a });
  return true;
}

/* ============================================================
   結果パネル（catalog の js/render.js の resultHTML と同じ形。items 縦積み or columns+rows 表）
   ============================================================ */
function dResultHTML(r) {
  const titleHTML = '<div class="kv"><div class="k">' + pesc(r.title) + '</div></div>';
  if (r.columns) {
    return titleHTML + '<div class="tw"><table><thead><tr>' +
      r.columns.map(c => '<th>' + pesc(c) + '</th>').join('') + '</tr></thead>' +
      '<tbody>' + r.rows.map(row => '<tr>' + row.map(c => '<td>' + pesc(c) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></div>';
  }
  return titleHTML + r.items.map(it => '<div class="kv"><div class="k">' + pesc(it.k) + '</div><div class="v">' + pesc(it.v) + '</div></div>').join('');
}

/* ============================================================
   各セクションの組み立て
   ============================================================ */
function dHeaderHTML() {
  const s = dCtx.s;
  const stv = PST[s.st] || PST[3];
  return '<header><div><div class="no" style="color:var(--cat-' + s.cat + ')">' + pesc(dCtx.code) + '</div>' +
    '<h2>' + pesc(s.name) + '</h2></div><span class="st ' + stv[0] + '">' + pesc(stv[1]) + '</span>' +
    '<button class="x" type="button" aria-label="' + pesc(pt('close')) + '">&times;</button></header>';
}

/** 台本あり・st !== 1 のときの冒頭の注意。いまのモック（openDrawer）と同じ文言を維持する（AC-26） */
function dMaturityNoteHTML() {
  const s = dCtx.s;
  if (s.st === 1) return '';
  const stv = PST[s.st] || PST[3];
  return '<div class="sec"><div class="note"><b>' + pesc(stv[1]) + 'です。</b>実機はまだありません。' +
    'ここに出しているのは「何を渡して何が返る想定か」だけで、動くものとしては見せません。</div></div>';
}

/** ① この画面から渡す文脈。行から呼んだ（dCtx.row あり）なら行の実値、ブロックから呼んだなら
    PT.ctxNoRow の案内だけ（設計書 §5-4） */
function dCtxSectionHTML() {
  const rows = dCtx.row ? dCtxRows(dCtx.scr, dCtx.row) : [];
  const body = rows.length
    ? rows.map(([label, val]) => dFldHTML(label, val)).join('') +
      '<div class="note" style="margin-top:8px">' + pesc(pt('ctxNote')) + '</div>'
    : '<div class="note">' + pesc(pt('ctxNoRow')) + '</div>';
  return '<div class="sec"><h3>' + pesc(pt('ctxHead')) + '</h3>' + body + '</div>';
}

/** 代用の明示（設計書 §14-7・規則 6）。台本の世界（from）と行の世界（want）が一致していれば何も出さない */
function dWorldNoteHTML() {
  const { from, want } = dCtx.pr;
  if (from === want) return '';
  const indName = (id) => { const i = (typeof INDUSTRIES !== 'undefined' ? INDUSTRIES : []).find(x => x.id === id); return i ? PL(i.name) : id; };
  const key = dCtx.row ? 'scriptWorldRow' : 'scriptWorldPlain';
  let text = pt(key).replace(/\{from\}/g, indName(from)).replace(/\{want\}/g, indName(want));
  if (dCtx.row && dCtx.row.cu) text = text.replace(/\{cu\}/g, dCtx.row.cu);
  return '<div class="sec"><div class="note">' + pesc(text) + '</div></div>';
}

/** ② 入力（テンプレート 5 種の出し分け。設計書 §5-5）。qa は別扱い（dQaRunHTML） */
function dInputSectionHTML() {
  const scn = dCtx.pr.scn;
  const lang0 = dCtx.log.length ? dCtx.log[0].lang : pscriptLang(pstate.lang);
  const doneRun = dCtx.log.length > 0;
  const autoRows = dCtx.row ? dCtxRows(dCtx.scr, dCtx.row).map(([l, v]) => dFldHTML(l, v)).join('') : '';
  let tplInner = '';
  const inp = scn.input ? scn.input[lang0] : null;
  if (scn.template === 'form' && inp) {
    tplInner = inp.fields.map(f => '<div class="fld"><label>' + pesc(f.label) + '</label><div class="val">' + pesc(f.value) + '</div></div>').join('');
  } else if (scn.template === 'upload' && inp) {
    tplInner = inp.files.map(f => '<span class="dfile">📄 ' + pesc(f) + '</span>').join('') +
      '<div class="note" style="margin-top:8px">' + pesc(pt('uploadNote')) + '</div>';
  } else if (scn.template === 'diff' && inp) {
    tplInner = '<div class="diffrow"><span class="dfile">📄 ' + pesc(inp.left) + '</span><span>⇄</span>' +
      '<span class="dfile">📄 ' + pesc(inp.right) + '</span></div>';
  } else if (scn.template === 'lookup' && inp) {
    tplInner = '<div class="fld"><div class="val">🔍 ' + pesc(inp.query) + '</div></div>';
  }
  const runLabel = doneRun ? pt('runDone') : (dCtx.s.st === 1 ? pt('runLive') : pt('runMock'));
  const btn = '<div class="run-row"><button class="btn-primary" type="button" data-drun' + (doneRun ? ' disabled' : '') + '>' + pesc(runLabel) + '</button></div>';
  return '<div class="sec"><h3>' + pesc(pt('inputHead')) + '</h3>' + autoRows + tplInner + btn + '</div>';
}

/** qa テンプレートは入力パネルを出さず、文脈カードの直下に相当する場所に実行ボタンだけを置く
    （台本 1 ターン目の消費がそのまま最初の会話になる。設計書 §5-5） */
function dQaRunHTML() {
  if (dCtx.log.length > 0) return '';
  const label = dCtx.s.st === 1 ? pt('runLive') : pt('runMock');
  return '<div class="sec"><div class="run-row" style="justify-content:flex-start">' +
    '<button class="btn-primary" type="button" data-drun>' + pesc(label) + '</button></div></div>';
}

/** ③ 結果パネル。qa（scn.result を持たない）は会話だけで完結するので出さない（設計書 §5-5） */
function dResultSectionHTML() {
  const scn = dCtx.pr.scn;
  if (!scn.result || dCtx.log.length === 0) return '';
  const lang0 = dCtx.log[0].lang;
  return '<div class="sec"><h3>' + pesc(pt('resultHead')) + '</h3>' + dResultHTML(scn.result[lang0]) + '</div>';
}

/** ④ 続けて聞く。会話ログ全体（qa は台本 1 ターン目も含む）＋質問チップ（ja/zh 常時両方）＋自由入力
    （設計書 §5-9・§2-5・§5-8） */
function dAskSectionHTML() {
  const msgs = dCtx.log.map(turn =>
    '<div class="dmsg user"><div class="dbubble">' + pesc(turn.q) + '</div></div>' +
    '<div class="dmsg"><div class="dbubble">' + pesc(turn.a) + '</div></div>'
  ).join('');
  const tJa = dNextTurn('ja'), tZh = dNextTurn('zh');
  let chips = '';
  if (tJa || tZh) {
    chips = '<div class="dchips">' +
      (tJa ? '<button class="chip" type="button" data-dchip="ja">' + pesc(pt('chipJa')) + '：' + pesc(tJa.q) + '</button>' : '') +
      (tZh ? '<button class="chip" type="button" data-dchip="zh">' + pesc(pt('chipZh')) + '：' + pesc(tZh.q) + '</button>' : '') +
      '</div>';
  } else if (dCtx.log.length) {
    chips = '<div class="note" style="margin-top:10px">' + pesc(pt('demoDone')) + '</div>';
  }
  const langNote = pstate.lang === 'en'
    ? '<div class="note" style="margin-bottom:8px">' + pesc(pt('scriptLangNote')) + '</div>' : '';
  return '<div class="sec"><h3>' + pesc(pt('askHead')) + '</h3>' + langNote +
    (msgs ? '<div class="dmsgs">' + msgs + '</div>' : '') + chips +
    '<div class="dinrow"><input class="dinput" type="text" id="dChatInput" placeholder="' + pesc(pt('chatPh')) + '">' +
    '<button class="dsend" type="button" data-dsend>' + pesc(pt('send')) + '</button></div></div>';
}

/** ⑤ 置き方 ／ ここに置く理由 ／ デモと本番。開発メモトグルの対象（note dev。設計書 §5-3 違い #6） */
function dPlacementSectionHTML() {
  const s = dCtx.s;
  return '<div class="sec"><h3>置き方 — ' + pesc(PHOW[s.how]) + '</h3><p class="note dev">' + pesc(PHOWLONG[s.how]) + '</p></div>' +
    '<div class="sec"><h3>ここに置く理由</h3><p class="note dev">' + pesc(s.why) + '</p></div>' +
    '<div class="sec"><h3>デモと本番</h3><p class="note dev">デモは Dify Cloud の稼働中アプリ。本番は Dify Enterprise。' +
    '<b>差し替わるのは接続先とキーだけ</b>で、管理番号（' + pesc(dCtx.code) + '）とポータル側の呼び出し方は変わりません。</p></div>';
}

function dBodyHTML() {
  const tplBody = dCtx.pr.scn.template === 'qa'
    ? dQaRunHTML()
    : (dInputSectionHTML() + dResultSectionHTML());
  return dMaturityNoteHTML() +
    dCtxSectionHTML() +
    dWorldNoteHTML() +
    tplBody +
    dAskSectionHTML() +
    dPlacementSectionHTML();
}

/* ============================================================
   再描画・イベント接続
   ============================================================ */
function dRenderBody() {
  if (!dCtx || !pDrawer) return;
  pDrawer.innerHTML = dHeaderHTML() + dBodyHTML();
  pDrawer.querySelector('.x').addEventListener('click', closeDrawer);
  const input = pDrawer.querySelector('#dChatInput');
  if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') dSend(); });
}

function dRun() {
  if (!dCtx || !dCtx.pr || dCtx.log.length > 0) return;
  dConsume(pscriptLang(pstate.lang));
  dRenderBody();
}
function dChip(lang) {
  if (!dCtx || !dCtx.pr) return;
  if (dConsume(lang)) dRenderBody();
}
function dSend() {
  if (!dCtx || !dCtx.pr) return;
  const input = document.getElementById('dChatInput');
  if (!input) return;
  const v = input.value.trim();
  if (!v) return;
  const lang = pDetectLang(v);
  const sl = pscriptLang(lang);
  input.value = '';
  dConsume(sl, v);   // 台本が尽きていれば何も起きない（§5-9 の範囲では汎用フォールバック返答は持たない）
  dRenderBody();
  const again = document.getElementById('dChatInput');
  if (again) again.focus();
}

/** サービス id と呼び出し元の文脈（scr・row）から、実行ドロワーまたは台本なしの情報ドロワーを開く。
    js/portal/events.js の唯一の入口（設計書 §5・§14-4）。 */
function openSvcDrawer(svcId, scr, row) {
  const s = psvcOf(svcId); if (!s) return;
  const pr = pscn(svcId, row || null);
  if (!pr) { openDrawer(svcId); return; }   // 台本なし（§5-6）。render.js の情報ドロワーに委ねる
  dCtx = { svcId, s, pr, scr: scr || null, row: row || null,
    code: s.isnew ? pt('unnumbered') : psvcCode(svcId), log: [] };
  openBareDrawer();
  pDrawer.classList.add('exec');
  dRenderBody();
  document.body.append(pScrim, pDrawer);
  pDrawer.querySelector('.x').focus();
}
