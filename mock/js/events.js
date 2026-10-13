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
    qaResetConversation();
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
  else if (act === 'svc') { state.selSvc = arg; state.view = 'detail'; state.log = []; qaResetConversation(); renderMain(); }
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
    // 再描画で #grid-holder / #home-holder ごと作り直すため、押した星の DOM ノード自体は
    // 作り直されて別物になる。同じサービスの星が残っていればそこへフォーカスを戻す
    // （PM 指摘 2026-09-08 #2：Tab をやり直さなくても連続してお気に入りを付け外せるようにする。
    //   favOnly の一覧から外して対象が消えた場合など、見つからなければ何もしない＝自然な挙動）
    const same = document.querySelector(`[data-act="fav"][data-arg="${arg}"]`);
    // { preventScroll: true }: 素の focus() は画面外の要素を可視範囲に自動スクロールしてしまい、
    // 「一覧のスクロール位置が飛ばない」という既存の工夫（§3-8）を壊す。フォーカスだけ移し、スクロールはさせない
    if (same) same.focus({ preventScroll: true });
  }
  else if (act === 'favlist') {
    state.favOnly = true; state.selCat = null; state.selSub = null; state.query = ''; state.view = 'list';
    renderAll();
  }
  else if (act === 'back') { state.view = 'list'; renderAll(); }
  else if (act === 'backdetail') { state.view = 'detail'; renderMain(); }
  else if (act === 'start') {
    state.log = []; qaResetConversation();
    if (scnOf(state.selSvc)) { state.view = 'demo'; }
    else { state.view = 'chat'; }
    renderMain();
  }
  else if (act === 'run') {
    if (demoPending || upReading) return;
    if (isQaChat()) return;
    if (isGn2Chat()) {
      const lang = scriptLang(state.lang);
      if (!gn2RouteStage('ap') && gn2SubmitRequest(scnOf('gn2').script[lang][0].q, lang)) {
        chatAcceptAttachments(`log:${state.log.length - 1}`); renderMain();
      }
      return;
    }
    if (state.log.length === 0 && consume(scriptLang(state.lang))) {
      chatAcceptAttachments(`log:${state.log.length - 1}`);
      demoPending = true; demoPendingFreeform = false; renderMain();
    }
  }
  else if (act === 'chip') {
    if (demoPending) return; // 返答待ちの間は二重消費を無視（Issue #39）
    if (isGn2Chat()) {
      const scn = scnOf('gn2'), lang = scriptLang(arg), step = Number(btn.dataset.gn2Step);
      const turns = btn.dataset.gn2Route === 'ar' ? scn.collectionSchedule.script[lang] : scn.script[lang];
      if (turns[step - 1]) {
        chatSetDraft(turns[step - 1].q);
        if (btn.dataset.gn2Route === 'ar' && step === 1) {
          gn2EntryRoute = 'ar';
          if (!upFiles.length) upUseSample(scn, lang);
          chatSetAttachmentVisible(true); renderMain();
        }
      }
      return;
    }
    if (isQaChat()) {
      const scn = scnOf('qa1'), lang = scriptLang(arg);
      const step = Number(btn.dataset.qaRecordStep);
      const q = step === 2 || step === 3 ? scn.script[lang][step - 1].q : (scn.qaPrompts[lang][btn.dataset.qaPrompt] || '');
      if (q) chatSetDraft(q);
      return;
    }
    const scn = scnOf(state.selSvc), turn = scn && nextTurn(scn, scriptLang(arg));
    if (turn) chatSetDraft(turn.q);
  }
  else if (act === 'restart') {
    const collectionEntry = isGn2Chat() && gn2EntryRoute === 'ar';
    state.log = []; qaResetConversation();
    if (collectionEntry) gn2PrepareCollectionDemo();
    renderMain();
  }
  else if (act === 'send') { sendChat(); }
});

/* ---------- アップロード部品（data-act とは別属性。§10-3。設計書 2026-09-16-showcase-demo.md） ---------- */
document.addEventListener('click', (e) => {
  const upEl = e.target.closest('[data-up]');
  if (!upEl || upEl.disabled) return;
  const kindU = upEl.dataset.up;
  if (demoPending && ['qa-attach', 'attach', 'pick', 'sample', 'clear'].includes(kindU)) return;
  const panel = upEl.closest('.panel');
  const fileInput = panel && panel.querySelector('.upinput');
  if (kindU === 'qa-attach' || kindU === 'attach') { chatSetAttachmentVisible(true); renderMain(); }
  else if (kindU === 'pick') { if (fileInput) fileInput.click(); }
  else if (kindU === 'sample') {
    const scn = scnOf(state.selSvc); if (!scn) return;
    upUseSample(scn, scriptLang(state.lang));
    renderMain();
  } else if (kindU === 'clear') { upClear(); renderMain(); }
  else if (kindU === 'preview') { upPreviewOpen(Number(upEl.dataset.upIndex), upEl, upEl.dataset.upSource, upEl.dataset.upKey || null); }
  else if (kindU === 'preview-close') { upPreviewClose(); }
  else if (kindU === 'preview-prev') { upPreviewMove(-1); }
  else if (kindU === 'preview-next') { upPreviewMove(1); }
  else if (kindU === 'preview-zoom-in') { upPreviewZoom(1); }
  else if (kindU === 'preview-zoom-out') { upPreviewZoom(-1); }
  else if (kindU === 'preview-fit') { upPreviewFit(); }
});

/* dialog は body に一度作るため、非バブリングイベントは capture で受ける。 */
document.addEventListener('cancel', (e) => {
  if (e.target.id !== 'up-preview' && e.target.id !== 'nm-summary') return;
  e.preventDefault();
  if (e.target.id === 'up-preview') upPreviewClose();
  else nmSummaryClose();
}, true);
document.addEventListener('close', (e) => {
  if (e.target.id === 'up-preview' && !e.target.open) upPreviewFinish();
  if (e.target.id === 'nm-summary' && !e.target.open) nmSummaryFinish();
}, true);
document.addEventListener('load', (e) => {
  if (!upPreview.open || !e.target.classList || !e.target.classList.contains('up-preview-image')) return;
  upPreview.status = 'ready';
  upPreviewRenderSize(true);
  upPreviewRenderLabels();
}, true);
document.addEventListener('error', (e) => {
  if (!upPreview.open || !e.target.classList || !e.target.classList.contains('up-preview-image')) return;
  upPreview.status = 'error';
  e.target.hidden = true;
  document.querySelector('#up-preview .up-preview-error').hidden = false;
  upPreviewRenderLabels();
}, true);
document.addEventListener('keydown', (e) => {
  if ((!upPreview.open && !nmSummary.open) || e.key !== 'Tab') return;
  const dialog = document.getElementById(upPreview.open ? 'up-preview' : 'nm-summary');
  const controls = Array.from(dialog.querySelectorAll('button:not(:disabled), [tabindex="0"]'))
    .filter(el => !el.closest('[hidden]'));
  const first = controls[0], last = controls[controls.length - 1];
  if ((e.shiftKey && document.activeElement === first) || (!e.shiftKey && document.activeElement === last) || !dialog.contains(document.activeElement)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus({ preventScroll: true });
  }
});
document.addEventListener('click', (e) => {
  const button = e.target.closest('[data-nm-summary]');
  if (!button || button.disabled) return;
  if (button.dataset.nmSummary === 'open') nmSummaryOpen(button);
  else if (button.dataset.nmSummary === 'close') nmSummaryClose();
});
let upPreviewResizeFrame = 0;
window.addEventListener('resize', () => {
  if (!upPreview.open) return;
  cancelAnimationFrame(upPreviewResizeFrame);
  upPreviewResizeFrame = requestAnimationFrame(() => upPreviewFit());
});

/** ドロップゾーンを Enter / Space でも開けるようにする（role="button" tabindex="0"） */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const zone = e.target.closest && e.target.closest('.upzone');
  if (!zone) return;
  e.preventDefault();
  if (demoPending) return;
  const panel = zone.closest('.panel');
  const fileInput = panel && panel.querySelector('.upinput');
  if (fileInput) fileInput.click();
});

document.addEventListener('change', (e) => {
  const upInput = e.target.closest('[data-up="input"]');
  if (!upInput || demoPending) return;
  upAddFiles(upInput.files, () => renderMain());
  upInput.value = '';
  renderMain();
});

document.addEventListener('dragover', (e) => {
  const zone = e.target.closest && e.target.closest('.upzone');
  if (!zone) return;
  e.preventDefault();
  if (demoPending) return;
  zone.classList.add('dragover');
});
document.addEventListener('dragleave', (e) => {
  const zone = e.target.closest && e.target.closest('.upzone');
  if (!zone) return;
  zone.classList.remove('dragover');
});
document.addEventListener('drop', (e) => {
  const zone = e.target.closest && e.target.closest('.upzone');
  if (!zone) return;
  e.preventDefault();
  zone.classList.remove('dragover');
  if (demoPending) return;
  const files = e.dataTransfer && e.dataTransfer.files;
  if (files && files.length) { upAddFiles(files, () => renderMain()); renderMain(); }
});

document.addEventListener('input', (e) => {
  if (e.target.id !== 'chat-input') return;
  chatCaptureDraft(); chatAutosize(e.target);
});
for (const event of ['select', 'keyup', 'click']) document.addEventListener(event, (e) => {
  if (e.target.id === 'chat-input') chatCaptureDraft();
});
document.addEventListener('selectionchange', () => {
  if (document.activeElement && document.activeElement.id === 'chat-input') chatCaptureDraft();
});
document.addEventListener('keydown', (e) => {
  if (e.target.id !== 'chat-input' || e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
  e.preventDefault(); sendChat();
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
if (new URLSearchParams(window.location.search).get('demo') === 'gn2-collection') {
  state.industry = 'mfg'; state.selSvc = 'gn2'; state.view = 'demo'; state.log = [];
  qaResetConversation();
  gn2PrepareCollectionDemo();
}
renderAll();
