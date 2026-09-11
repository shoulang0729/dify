'use strict';
/* mock/js/portal/events.js — click ハンドラ / 言語・テーマの listener / 起動
   出所: scratchpad/portal-mock/portal.html。設計書 docs/handoff/2026-09-11-portal-mock-pages.md §3-1。
   動きは変えていない（移設のみ）。 */

document.addEventListener('click', (e) => {
  const n = e.target.closest('.navbtn');
  if (n) { showScreen(n.dataset.scr); return; }

  const hb = e.target.closest('[data-hist]');
  if (hb) { openHistDrawer(hb.dataset.hist); return; }

  const ib = e.target.closest('#indSw .chip');
  if (ib) {
    pstate.ind = ib.dataset.ind;
    document.querySelectorAll('#indSw .chip').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.ind === pstate.ind)));
    const sc = document.getElementById('scr-ai');
    if (sc) { sc.innerHTML = V.ai(); classifyBlocks(); }
    return;
  }

  const kb = e.target.closest('[data-know]');
  if (kb) { openKnowDrawer(kb.dataset.know); return; }

  const cb = e.target.closest('[data-cand]');
  if (cb) {
    const c = pstate.cand.find(x => x.id === cb.dataset.cand); if (!c) return;
    const want = cb.dataset.act2;
    if (c.state === want) { c.state = 'new'; c.no = ''; }
    else { c.state = want; if (want === 'ok' && !c.no) { pstate.candSeq += 1; c.no = 'A-0' + pstate.candSeq; } }
    renderCandList(); return;
  }

  const sb = e.target.closest('[data-ds]');
  if (sb) {
    const k = sb.dataset.ds;
    if (pstate.dealSort.key === k) pstate.dealSort.dir = pstate.dealSort.dir === 'asc' ? 'desc' : 'asc';
    else pstate.dealSort = { key: k, dir: 'asc' };
    renderDealList(); return;
  }

  const pc = e.target.closest('#pipeCu .chip'), pt2 = e.target.closest('#pipeTeam .chip');
  if (pc || pt2) {
    if (pc) { pstate.pipeCu = pc.dataset.pcu; }
    if (pt2) { pstate.pipeTeam = pt2.dataset.pteam; }
    filterPipe(); return;
  }

  const kd = e.target.closest('#kindChips .chip');
  if (kd) {
    const k = kd.dataset.kind, scr = document.getElementById('scr-trn');
    pstate.kindFilter = k;
    let c = 0;
    scr.querySelectorAll('tr[data-kind]').forEach(tr => { const hit = !k || tr.dataset.kind === k; tr.hidden = !hit; if (hit) c++; });
    scr.querySelectorAll('#kindChips .chip').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.kind === k)));
    const l = document.getElementById('trnCount'); if (l) l.textContent = c + ' 件' + (k ? '（' + k + '）' : '');
    return;
  }

  const cu = e.target.closest('[data-cu]');
  if (cu && (cu.classList.contains('chip') || cu.classList.contains('culink'))) { filterContacts(cu.dataset.cu); return; }

  const svcBtnEl = e.target.closest('[data-svc]');
  if (svcBtnEl) { openDrawer(svcBtnEl.dataset.svc); return; }
});

document.addEventListener('change', (e) => {
  const f = e.target.closest('[data-df]');
  if (f) { pstate.dealF[f.dataset.df] = f.value; renderDealList(); }
});

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });

/* ---------- .mockbar のトグル（足場） ---------- */
document.getElementById('prodTgl').addEventListener('click', () => {
  pstate.prod = !pstate.prod;
  document.getElementById('prodTgl').setAttribute('aria-pressed', String(pstate.prod));
  document.body.classList.toggle('showprod', pstate.prod);
  document.getElementById('envchip').textContent = pstate.prod ? pt('envOn') : pt('env');
});
document.body.classList.add('canedit');
document.getElementById('permTgl').addEventListener('click', () => {
  pstate.perm = !pstate.perm;
  document.getElementById('permTgl').setAttribute('aria-pressed', String(pstate.perm));
  document.body.classList.toggle('canedit', pstate.perm);
  document.getElementById('permLbl').textContent = pstate.perm ? '編集権限あり' : '編集権限なし';
});
document.getElementById('devTgl').addEventListener('click', () => {
  pstate.dev = !pstate.dev;
  document.getElementById('devTgl').setAttribute('aria-pressed', String(pstate.dev));
  document.body.classList.toggle('hidedev', !pstate.dev);
});
document.getElementById('usrTgl').addEventListener('click', () => {
  pstate.usr = !pstate.usr;
  document.getElementById('usrTgl').setAttribute('aria-pressed', String(pstate.usr));
  document.body.classList.toggle('hideusr', !pstate.usr);
});

/* ---------- 言語・テーマ（プロダクト機能。§2-4） ---------- */
document.getElementById('langSel').addEventListener('change', (ev) => {
  pstate.lang = ev.target.value;
  psavePrefs();
  applyPortalPrefs();
  renderAll();
});
document.getElementById('themeBtn').addEventListener('click', () => {
  pstate.theme = pstate.theme === 'dark' ? 'light' : 'dark';
  psavePrefs();
  applyPortalPrefs();
});

/* ================= 起動 ================= */
ploadPrefs();
applyPortalPrefs();
renderAll();
