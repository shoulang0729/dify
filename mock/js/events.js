'use strict';
/* mock/js/events.js — click ハンドラ / 言語・テーマの listener / 起動
   出所: mock/catalog.html（分割前）。設計書 docs/handoff/2026-09-07-split-catalog.md §1・§9-1（PR-C）。
   値は 1 バイトも変えていない（抽出コマンドの再実行で diff ゼロを確認）。 */


document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn || btn.disabled) return;
  const act = btn.dataset.act, arg = btn.dataset.arg;

  if (act === 'industry') {
    state.industry = arg;
    const firstCat = (visCats()[0] || {}).id || null;
    state.openCats = firstCat ? { [firstCat]: true } : {};
    state.selCat = null; state.selSub = null; state.selSvc = null;
    state.lastCat = firstCat;
    state.view = 'list'; state.query = ''; state.log = []; state.favOnly = false;
    renderAll();
  }
  else if (act === 'pattern') { state.pattern = arg; renderAll(); }
  else if (act === 'all') { state.selCat = null; state.selSub = null; state.favOnly = false; state.view = 'list'; renderAll(); }
  else if (act === 'cat') {
    const open = !!state.openCats[arg];
    state.openCats[arg] = !open;
    state.favOnly = false;
    if (!open) { state.selCat = arg; state.selSub = null; state.lastCat = arg; state.view = 'list'; }
    renderAll();
  }
  else if (act === 'gocat') {
    state.selCat = arg; state.selSub = null; state.lastCat = arg;
    state.openCats[arg] = true; state.view = 'list'; state.query = ''; state.favOnly = false;
    renderAll();
  }
  else if (act === 'sub') {
    const [c, sb] = arg.split(':');
    state.selCat = c; state.selSub = sb; state.lastCat = c; state.openCats[c] = true; state.view = 'list';
    state.favOnly = false;
    renderAll();
  }
  else if (act === 'svc') { state.selSvc = arg; state.view = 'detail'; state.log = []; renderMain(); }
  else if (act === 'fav') {
    toggleFav(arg);
    savePrefs();
    syncFavButtons(arg);      // 押した星（カード・詳細）を書き換える
    renderSidebar();          // ① の件数を更新（nav 以外のパターンでは既存どおり即 return）
    const homeHolder = document.getElementById('home-holder');
    const gridHolder = document.getElementById('grid-holder');
    if (homeHolder) {
      // ②③ のホーム（お気に入り帯・レールは PR-2）。ここでは既存の home 描画のみ更新する
      homeHolder.innerHTML = state.pattern === 'feed' ? feedSectionsHTML() : dashSectionsHTML();
    } else if (gridHolder) {
      // list ビュー（favOnly のときは外した項目がその場で消える）。renderAll()/renderMain() は呼ばない（§3-8）
      const l = filtered();
      gridHolder.innerHTML = gridHTML(l, listEmptyOverride(l));
      const count = document.getElementById('count');
      if (count) count.textContent = countText(l.length);
    }
  }
  else if (act === 'favlist') {
    state.favOnly = true; state.selCat = null; state.selSub = null; state.query = ''; state.view = 'list';
    renderAll();
  }
  else if (act === 'back') { state.view = 'list'; renderAll(); }
  else if (act === 'backdetail') { state.view = 'detail'; renderMain(); }
  else if (act === 'start') {
    if (scnOf(state.selSvc)) { state.log = []; state.view = 'demo'; }
    else { state.view = 'chat'; }
    renderMain();
  }
  else if (act === 'run') {
    if (demoPending) return; // 返答待ちの間は二重消費を無視（Issue #39）
    if (state.log.length === 0 && consume(scriptLang(state.lang))) { demoPending = true; renderMain(); }
  }
  else if (act === 'chip') {
    if (demoPending) return; // 返答待ちの間は二重消費を無視（Issue #39）
    if (consume(arg)) { demoPending = true; renderMain(); }
  }
  else if (act === 'restart') { state.log = []; demoPending = false; demoPendingFreeform = false; renderMain(); }
  else if (act === 'send') { sendChat(); }
});

document.getElementById('lang-select').addEventListener('change', (e) => {
  state.lang = e.target.value;
  savePrefs(); applyPrefs(); renderAll();
});

document.getElementById('theme-btn').addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  savePrefs(); applyPrefs();
});

/* ================= 起動 ================= */
loadPrefs();
applyPrefs();
renderAll();
