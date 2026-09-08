'use strict';
/* mock/js/render.js — renderChrome 〜 renderMain / *HTML / renderAll（描画）
   出所: mock/catalog.html（分割前）。設計書 docs/handoff/2026-09-07-split-catalog.md §1・§9-1（PR-C）。
   値は 1 バイトも変えていない（抽出コマンドの再実行で diff ゼロを確認）。 */

/* ============================================================
   6. 描画 — 固定文言
   ============================================================ */
function renderChrome() {
  document.getElementById('mock-label').textContent = t('mockLabel');
  document.getElementById('ind-label').textContent = t('indLabel');
  document.getElementById('seg-label').textContent = t('segLabel');
  document.getElementById('wordmark').textContent = L(ind().wordmark);
  const brandMark = document.getElementById('brand-mark');
  if (brandMark) brandMark.innerHTML = indLogo();
  document.getElementById('app-title').textContent = t('appTitle');
  document.getElementById('dept').textContent = L(ind().dept);
  document.title = T.appTitle.ja + ' ／ ' + T.appTitle.zh + ' ／ ' + T.appTitle.en;
}

/* ============================================================
   7. 描画 — 業種・パターン選択（モック用の足場）
   業種セグメントは「その業種の SVCS が 1 件以上あるか」で有効/無効を決める
   （§4-1・§6 PR-1：金融は 0 件のうちは disabled のまま。PR-3 でデータが入ると
   コードを変えずに自動で有効化される）
   ============================================================ */
function renderIndSeg() {
  document.getElementById('ind-seg').innerHTML = INDUSTRIES.map(i => {
    const ready = SVCS.some(x => x.industries.includes(i.id));
    return `<button class="${state.industry === i.id ? 'on' : ''}"${ready ? '' : ' disabled'}
       data-act="industry" data-arg="${i.id}" title="${esc(L(i.desc))}">${esc(L(i.name))}</button>`;
  }).join('');
}

function renderSeg() {
  document.getElementById('seg').innerHTML = PATTERNS.map(p =>
    `<button class="${state.pattern === p.id ? 'on' : ''}"${p.ready ? '' : ' disabled'}
       data-act="pattern" data-arg="${p.id}" title="${esc(L(p.desc))}">${esc(L(p.name))}</button>`
  ).join('');
}

/* ============================================================
   8. 描画 — サイドバー（① 階層ナビ型）
   ============================================================ */
function renderSidebar() {
  const el = document.getElementById('sidebar');
  if (state.pattern !== 'nav') { el.innerHTML = ''; return; }
  el.innerHTML = `
  <nav class="side" data-screen-label="階層ナビ">
    <button class="nav-item ${!state.selCat && !state.selSub && !state.favOnly ? 'on' : ''}" data-act="all">
      <span class="n-label">${esc(t('allServices'))}</span>
      <span class="cnt">${visSvcs().length}</span>
    </button>
    <button class="nav-item fav-nav ${state.favOnly ? 'on' : ''}" data-act="favlist">
      <svg class="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${favStarPath(true)}</svg>
      <span class="n-label">${esc(t('favTitle'))}</span>
      <span class="cnt">${favList().length}</span>
    </button>
    <div class="nav-divider"></div>
    ${visCats().map(c => {
      const open = !!state.openCats[c.id];
      const on = state.selCat === c.id && !state.selSub;
      return `
      <button class="nav-item ${on ? 'on' : ''} ${catClass(c.id)}" data-act="cat" data-arg="${c.id}">
        ${catIcon(c.id)}
        <span class="n-label">${esc(L(c.name))}</span>
        <span class="chev ${open ? 'open' : ''}"></span>
      </button>
      ${open ? c.subs.map(sb => `
        <button class="nav-sub ${state.selSub === sb.id ? 'on' : ''}" data-act="sub" data-arg="${c.id}:${sb.id}">
          <span class="n-label">${esc(L(sb.name))}</span>
          <span class="cnt">${countSub(sb.id)}</span>
        </button>`).join('') : ''}`;
    }).join('')}
  </nav>`;
}

/* ============================================================
   9. 描画 — 右ペイン
   ============================================================ */
/** NEW バッジ 1 個。新着でなければ空文字（呼び出し側に分岐を書かない） */
const newBadgeHTML = (x) => isNew(x) ? `<span class="badge-new">${esc(t('newBadge'))}</span>` : '';

/* ---- お気に入り（星）ボタン（設計書 2026-09-08-favorites.md §3-1・§3-5・§3-6） ----
   塗り/輪郭という「形」で on/off を区別する（色だけに頼らない）。既存トークンのみ使用（--action-primary / --text-secondary）。
   toggleFav 後の書き換えは syncFavButtons() が担い、renderAll()/renderMain() は呼ばない（§3-8：一覧のスクロール位置を飛ばさない）。 */
const favStarPath = (on) => `<path d="M12 3.5l2.6 5.6 6.1.6-4.6 4.2 1.3 6-5.4-3.1-5.4 3.1 1.3-6-4.6-4.2 6.1-.6z"
    fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"></path>`;
/** カード右上のアイコンのみの星ボタン（28×28、中の SVG 18×18） */
function favBtnHTML(x) {
  const on = isFav(x.id), label = on ? t('favRemove') : t('favAdd');
  const aria = (on ? t('favRemoveAria') : t('favAddAria')).replace('{name}', L(x.name));
  return `
  <button class="fav-btn ${on ? 'on' : ''}" data-act="fav" data-arg="${x.id}"
    aria-pressed="${on}" aria-label="${esc(aria)}" title="${esc(label)}">
    <svg class="ic-star" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${favStarPath(on)}</svg>
  </button>`;
}
/** 詳細画面用：文字ラベル付きのトグル（.btn-ghost。§3-5） */
function favToggleHTML(x) {
  const on = isFav(x.id), label = on ? t('favRemove') : t('favAdd');
  const aria = (on ? t('favRemoveAria') : t('favAddAria')).replace('{name}', L(x.name));
  return `
  <button class="btn-ghost fav-toggle ${on ? 'on' : ''}" data-act="fav" data-arg="${x.id}"
    aria-pressed="${on}" aria-label="${esc(aria)}" title="${esc(label)}">
    <svg class="ic-star" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${favStarPath(on)}</svg>
    <span class="fav-label">${esc(label)}</span>
  </button>`;
}
/** toggleFav 後、画面上のすべての星ボタン（カード・詳細）を書き換える。renderAll()/renderMain() は呼ばない（§3-8） */
function syncFavButtons(id) {
  const x = svcOf(id);
  const on = isFav(id);
  const label = on ? t('favRemove') : t('favAdd');
  const aria = (on ? t('favRemoveAria') : t('favAddAria')).replace('{name}', L(x.name));
  document.querySelectorAll(`[data-act="fav"][data-arg="${id}"]`).forEach((btn) => {
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', aria);
    btn.setAttribute('title', label);
    const svg = btn.querySelector('svg');
    if (svg) svg.innerHTML = favStarPath(on);
    const labelEl = btn.querySelector('.fav-label');
    if (labelEl) labelEl.textContent = label;
  });
}

function cardHTML(x) {
  const c = catOf(x.cat), sb = subOf(x.cat, x.sub);
  return `
  <div class="card ${catClass(x.cat)}" data-act="svc" data-arg="${x.id}">
    <div class="c-top">
      <span class="c-tile">${catIcon(x.cat)}</span>
      <div class="c-head">
        <div class="c-crumb">${esc(L(c.name))}・${esc(L(sb.name))}</div>
        <div class="c-name">${esc(L(x.name))}</div>
      </div>
      <span class="c-top-tail">
        <span class="c-code">${newBadgeHTML(x)}<span class="code">${esc(svcCode(x.id))}</span></span>
        ${favBtnHTML(x)}
      </span>
    </div>
    <div class="c-desc">${esc(L(x.desc))}</div>
    <div class="c-meta">
      <span class="status"><span class="dot ${statusClass(x.st)}"></span>${esc(statusText(x.st))}</span>
      ${x.tags.map(k => `<span class="tag">${esc(tag(k))}</span>`).join('')}
    </div>
  </div>`;
}

/** ① お気に入り一覧が 0 件・検索語なしのときの専用の空状態（noResults とは別物。§3-6） */
const favEmptyHTML = () => `
  <div class="empty fav-empty">
    <div class="fav-empty-title">${esc(t('favEmpty'))}</div>
    <div class="fav-empty-hint">${esc(t('favEmptyHint'))}</div>
  </div>`;
/** list ビューの #grid-holder 用：favOnly かつ検索語なしで 0 件のときだけ favEmptyHTML() を差し込む。
    検索語がある状態で 0 件のときは既存の noResults のまま（§3-6） */
const listEmptyOverride = (list) => (state.favOnly && !state.query.trim() && !list.length) ? favEmptyHTML() : undefined;

/** サービスカードのグリッド。emptyHTML は任意（渡さなければ既定の noResults。§3-6 の実装メモ） */
function gridHTML(list, emptyHTML) {
  if (!list.length) return emptyHTML || `<div class="empty">${esc(t('noResults'))}</div>`;
  return `<div class="grid">${list.map(cardHTML).join('')}</div>`;
}

/** ②③ 未実装パターンの説明プレースホルダ */
function todoHTML(p) {
  return `
  <div class="todo-wrap" data-screen-label="準備中">
    <div class="todo-card">
      <div class="t-eyebrow">${esc(t('todoEyebrow'))}</div>
      <h2>${esc(L(p.name))} — ${esc(t('todoTitle'))}</h2>
      <p>${esc(L(p.desc))}</p>
    </div>
  </div>`;
}

/* ============================================================
   9a. 描画 — ② ダッシュボード（ホーム）
   ============================================================ */
/** ②③ ホームの検索欄を束ねる。sectionsFn() はホーム本体の HTML を返す関数（§3-5）
    renderMain() を呼ばないので IME 変換中のフォーカス/キャレットが保持される */
function bindHomeSearch(sectionsFn) {
  const s = document.getElementById('search');
  const h = document.getElementById('home-holder');
  if (!s || !h) return;
  s.addEventListener('input', () => {
    state.query = s.value;
    const q = state.query.trim();
    if (!q) { h.innerHTML = sectionsFn(); return; }      // 空に戻したらホームを復元
    const list = filtered();
    h.innerHTML = `<div class="home-count">${esc(countText(list.length))}</div>` + gridHTML(list);
  });
}

/** ② ダッシュボード：ホーム本体（検索で差し替える範囲） */
function dashSectionsHTML() {
  const maxUses = Math.max(...home().frequent.map(f => f.uses));
  const freqHTML = `
    <div class="dash-sec">
      <div class="sec-h">
        <h2>${esc(t('dashFreq'))}</h2>
        <span class="sec-note">${esc(t('dashFreqNote'))}</span>
      </div>
      <div class="use-list">
        ${home().frequent.map((f, i) => {
          const x = svcOf(f.id), c = catOf(x.cat);
          const w = Math.round(f.uses / maxUses * 100);
          return `
          <button class="use-row ${catClass(x.cat)}" data-act="svc" data-arg="${x.id}">
            <span class="use-rank">${i + 1}</span>
            <span class="use-main">
              <span class="use-name">${catIcon(x.cat, 'ic-sm')}${esc(L(x.name))}
                <span class="code">${esc(svcCode(x.id))}</span></span>
              <span class="use-sub">${esc(L(c.name))}
                <span class="status"><span class="dot ${statusClass(x.st)}"></span>${esc(statusText(x.st))}</span></span>
            </span>
            <span class="use-bar"><span class="use-fill" style="width:${w}%"></span></span>
            <span class="use-n">${esc(t('usesUnit').replace('{n}', f.uses))}</span>
            <span class="cat-chev"></span>
          </button>`;
        }).join('')}
      </div>
    </div>`;

  const recoHTML = `
    <div class="dash-sec reco-panel">
      <div class="sec-h">
        <h2>${esc(t('dashReco'))}</h2>
        <span class="sec-note">${esc(t('dashRecoNote'))}</span>
      </div>
      <div class="reco-grid">
        ${home().recommended.map(r => {
          const x = svcOf(r.id);
          return `
          <div class="reco-item ${catClass(x.cat)}">
            ${cardHTML(x)}
            <div class="r-why"><span class="r-why-l">${esc(t('recoWhy'))}</span>${esc(L(r.why))}</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  const legendHTML = `
    <span class="legend" title="${esc(t('dashCatsNote'))}">
      <span class="lg-i"><span class="dot live"></span>${esc(t('statusLive'))}</span>
      <span class="lg-i"><span class="dot trial"></span>${esc(t('statusTrial'))}</span>
      <span class="lg-i"><span class="dot concept"></span>${esc(t('statusConcept'))}</span>
    </span>`;

  const catsHTML = `
    <div class="dash-sec">
      <div class="sec-h">
        <h2>${esc(t('dashCats'))}</h2>
        ${legendHTML}
      </div>
      ${visCats().map(c => {
        const list = visSvcs().filter(x => x.cat === c.id);
        const maxCat = Math.max(...visCats().map(cc => visSvcs().filter(x => x.cat === cc.id).length));
        const cn1 = list.filter(x => x.st === 1).length;
        const cn2 = list.filter(x => x.st === 2).length;
        const cn3 = list.filter(x => x.st === 3).length;
        const total = list.length || 1;
        return `
        <button class="cat-row ${catClass(c.id)}" data-act="gocat" data-arg="${c.id}">
          <span class="cat-tile">${catIcon(c.id, 'ic-lg')}</span>
          <span class="c-nm">${esc(L(c.name))}</span>
          <span class="cat-mix">${esc(countText(list.length))}</span>
          <span class="cat-bar-track"><span class="cat-bar" style="width:${Math.round(list.length / maxCat * 100)}%">
            ${cn1 ? `<span class="s-live" style="width:${(cn1 / total * 100)}%"></span>` : ''}
            ${cn2 ? `<span class="s-trial" style="width:${(cn2 / total * 100)}%"></span>` : ''}
            ${cn3 ? `<span class="s-concept" style="width:${(cn3 / total * 100)}%"></span>` : ''}
          </span></span>
          <span class="cat-mix">${cn1} / ${cn2} / ${cn3}</span>
          <span class="cat-chev"></span>
        </button>`;
      }).join('')}
    </div>`;

  /* 新しく追加されたエージェント（added 降順で最新 3 件）。新着 0 件なら帯ごと出さない。
     HOME には書かない＝データは SVCS[].added が唯一の出どころ */
  const nw = newSvcs().slice(0, 3);
  const newHTML = !nw.length ? '' : `
    <div class="dash-sec dash-new">
      <div class="sec-h">
        <h2>${esc(t('dashNew'))}</h2>
        <span class="sec-note">${esc(t('dashNewNote').replace('{n}', NEW_DAYS))}</span>
      </div>
      <div class="grid">
        ${nw.map(x => `
          <div class="new-item">
            ${cardHTML(x)}
            <div class="new-date">${esc(t('addedOn').replace('{d}', x.added))}</div>
          </div>`).join('')}
      </div>
    </div>`;

  return `${newHTML}<div class="dash-duo">${recoHTML}<div class="dash-col">${freqHTML}${catsHTML}</div></div>`;
}

function renderDash(el) {
  const n1 = visSvcs().filter(x => x.st === 1).length;
  const n2 = visSvcs().filter(x => x.st === 2).length;
  const n3 = visSvcs().filter(x => x.st === 3).length;
  el.innerHTML = `
  <div class="dash-wrap" data-screen-label="ダッシュボード">
    <section class="hero">
      <svg class="hero-bg" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g opacity="0.3">
          <line class="h-line" x1="0" y1="64" x2="1200" y2="64"></line>
          <line class="h-line" x1="0" y1="150" x2="1200" y2="150"></line>
          <line class="h-line" x1="0" y1="236" x2="1200" y2="236"></line>
        </g>
        <g opacity="0.55">
          <line class="h-belt" x1="0" y1="64" x2="1200" y2="64"></line>
          <line class="h-belt" x1="0" y1="236" x2="1200" y2="236" style="animation-delay:-3.2s"></line>
        </g>
        <rect class="h-node" x="220" y="60" width="8" height="8"></rect>
        <rect class="h-node" x="640" y="146" width="8" height="8" style="animation-delay:.8s"></rect>
        <rect class="h-node" x="980" y="232" width="8" height="8" style="animation-delay:1.6s"></rect>
      </svg>
      <div class="hero-flex">
        <div class="hero-copy">
          <div class="hero-eyebrow">AI AGENT CATALOG — ${esc(L(ind().wordmark))}</div>
          <h1>${esc(t('dashWelcome'))}</h1>
          <p>${esc(t('dashLead').replace('{c}', visCats().length).replace('{n}', visSvcs().length))}</p>
          <input class="search" id="search" placeholder="${esc(t('searchPh'))}" value="${esc(state.query)}">
        </div>
        <div class="stat-strip">
          <div class="stat-total">
            <div class="stat-n">${visSvcs().length}</div><div class="stat-l">${esc(t('statAll'))}</div>
          </div>
          <div class="stat-col">
            <div class="stat-row s-live"><span class="stat-n">${n1}</span><span class="stat-l">${esc(t('statusLive'))}</span></div>
            <div class="stat-row s-trial"><span class="stat-n">${n2}</span><span class="stat-l">${esc(t('statusTrial'))}</span></div>
            <div class="stat-row s-concept"><span class="stat-n">${n3}</span><span class="stat-l">${esc(t('statusConcept'))}</span></div>
          </div>
        </div>
      </div>
    </section>
    <div class="dash-body"><div id="home-holder">${dashSectionsHTML()}</div></div>
  </div>`;
  bindHomeSearch(dashSectionsHTML);
  el.scrollTop = 0;
}

/* ============================================================
   9a-2. 描画 — ③ 業務フィード（ホーム）
   design-pass §9 の適用：ヒーロー帯は置かず薄いヘッダー。フィード項目には
   分類アイコン・色（catIcon/catClass）を付け、期限バッジは専用トークンで彩色する。
   管理番号は出さない（PM 判断 D-14）。
   ============================================================ */
/** kind → ラベル文言。verify.mjs は `t('...')` のリテラル引数しか参照追跡しないため、
    分岐で個別に呼ぶ（`t(KIND_LABEL[kind])` のような間接参照にしない） */
const kindLabel = (kind) => kind === 'due' ? t('kindDue') : kind === 'notify' ? t('kindNotify') : t('kindRoutine');

/** ③「お知らせ」に自動で足す新着行。FEED.items には書かない（データの出どころは SVCS[].added だけ）。
    FEED.items に同じ id が既にあるものは二重表示になるので除く */
const newFeedItems = () => {
  const listed = new Set(feed().items.map(i => i.id));
  return newSvcs().filter(x => !listed.has(x.id)).map(x => {
    const code = svcCode(x.id);
    const fill = (o) => ({ ja: o.ja.replace('{code}', code), zh: o.zh.replace('{code}', code), en: o.en.replace('{code}', code) });
    return { id: x.id, kind: 'notify', when: fill(T.feedNewWhen), note: fill(T.feedNewAgent) };
  });
};

/** ③ フィード項目 1 件。左ボーダー色は種別（緊急度）で決める。管理番号は出さない（D-14） */
function feedItemHTML(it) {
  const x = svcOf(it.id), c = catOf(x.cat);
  return `
  <button class="feed-item ${it.kind} ${catClass(x.cat)}" data-act="svc" data-arg="${x.id}">
    <span class="fi-tile">${catIcon(x.cat, 'ic-lg')}</span>
    <span class="fi-body">
      <span class="fi-h">
        <span class="fi-kind ${it.kind}">${esc(kindLabel(it.kind))}</span>
        <span class="fi-when">${esc(L(it.when))}</span>
      </span>
      <span class="fi-title">${esc(L(x.name))}</span>
      <span class="fi-note">${esc(L(it.note))}</span>
      <span class="fi-foot">
        <span class="fi-cat">${esc(L(c.name))}</span>
        <span class="status"><span class="dot ${statusClass(x.st)}"></span>${esc(statusText(x.st))}</span>
        <span class="fi-open">${esc(t('feedOpen'))} ›</span>
      </span>
    </span>
  </button>`;
}

/** ③ フィード：ホーム本体（検索で差し替える範囲） */
function feedSectionsHTML() {
  const sec = (items, title) => {
    if (!items.length) return '';
    return `
    <div class="feed-sec">
      <div class="sec-h">
        <h2>${esc(title)}</h2>
        <span class="sec-count">${items.length}</span>
      </div>
      ${items.map(feedItemHTML).join('')}
    </div>`;
  };
  const action  = feed().items.filter(i => i.kind === 'due');
  const routine = feed().items.filter(i => i.kind === 'routine');
  const notice  = newFeedItems().concat(feed().items.filter(i => i.kind === 'notify'));

  const mineHTML = `
    <div class="side-box">
      <h3>${esc(t('feedMine'))}</h3>
      ${feed().mine.map(id => {
        const c = catOf(id);
        return `
        <button class="side-link ${catClass(id)}" data-act="gocat" data-arg="${id}">
          ${catIcon(id, 'ic-sm')}<span>${esc(L(c.name))}</span>
          <span class="cnt">${countCat(id)}</span>
        </button>`;
      }).join('')}
    </div>`;

  const recentHTML = `
    <div class="side-box">
      <h3>${esc(t('feedRecent'))}</h3>
      ${feed().recent.map(id => {
        const x = svcOf(id);
        return `
        <button class="side-link ${catClass(x.cat)}" data-act="svc" data-arg="${x.id}">
          ${catIcon(x.cat, 'ic-sm')}<span>${esc(L(x.name))}</span>
        </button>`;
      }).join('')}
    </div>`;

  return `
  <div class="feed-body">
    <div class="feed-main">
      ${sec(action, t('feedAction'))}
      ${sec(routine, t('feedRoutine'))}
      ${sec(notice, t('feedNotice'))}
    </div>
    <div class="feed-side">
      ${mineHTML}
      ${recentHTML}
    </div>
  </div>`;
}

function renderFeed(el) {
  el.innerHTML = `
  <div class="feed-wrap" data-screen-label="業務フィード">
    <div class="feed-head">
      <div>
        <div class="crumb">${esc(t('feedEyebrow'))}</div>
        <h1>${esc(t('feedTitle'))}</h1>
        <p>${esc(t('feedLead'))}</p>
        <div class="feed-who">
          <div class="avatar">${esc(L(feed().persona.name).charAt(0))}</div>
          <span>${esc(L(feed().persona.name))} ／ ${esc(L(feed().persona.role))}・${esc(L(feed().persona.site))}</span>
          <span class="cta-note">${esc(t('mockNote'))}</span>
        </div>
      </div>
      <input class="search" id="search" placeholder="${esc(t('searchPh'))}" value="${esc(state.query)}">
    </div>
    <div id="home-holder">${feedSectionsHTML()}</div>
  </div>`;
  bindHomeSearch(feedSectionsHTML);
  el.scrollTop = 0;
}

/* ============================================================
   9b. 描画 — 業務デモ（work-pane / chat-pane の部品）
   ============================================================ */
/** 「考え中」インジケータ（3 点脈打つドット）。文言は使わない（§2-2/Issue #39） */
const dotsHTML = () => `<span class="think-dots"><span></span><span></span><span></span></span>`;
/** 結果パネルが pending のときの処理中プレースホルダ */
const pendingHTML = () => `<div class="processing">${dotsHTML()}</div>`;

/** 結果パネルの中身。items（縦積み）か columns+rows（表）のどちらか一方 */
function resultHTML(r) {
  const titleHTML = `<div class="kv"><div class="k">${esc(r.title)}</div></div>`;
  if (r.columns) {
    return titleHTML + `
      <table class="tbl">
        <thead><tr>${r.columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>
        <tbody>${r.rows.map(row => `<tr>${row.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>`;
  }
  return titleHTML + r.items.map(it => `<div class="kv"><div class="k">${esc(it.k)}</div><div class="v">${esc(it.v)}</div></div>`).join('');
}

/** work-pane の中身（入力パネル＋結果パネル）。テンプレートごとに入力 UI だけ分岐する */
function panelHTML(scn) {
  const done = state.log.length > 0;
  const lang0 = done ? state.log[0].lang : scriptLang(state.lang);
  const inp = scn.input[lang0];
  let inputInner = '';
  if (scn.template === 'upload') {
    inputInner = `<div class="drop">${esc(t('dropHint'))}</div>` +
      inp.files.map(f => `<span class="file">📄 ${esc(f)}</span>`).join('');
  } else if (scn.template === 'form') {
    inputInner = inp.fields.map(f => `
      <div class="field"><label>${esc(f.label)}</label><div class="val">${esc(f.value)}</div></div>`).join('');
  } else if (scn.template === 'diff') {
    inputInner = `
      <div class="diff-in">
        <span class="file">📄 ${esc(t('beforeLabel'))}：${esc(inp.left)}</span>
        <span>⇄</span>
        <span class="file">📄 ${esc(t('afterLabel'))}：${esc(inp.right)}</span>
      </div>`;
  } else if (scn.template === 'lookup') {
    inputInner = `<div class="field"><div class="val">🔍 ${esc(inp.query)}</div></div>`;
  }
  return `
    <div class="panel${done ? ' done' : ''}">
      <div class="panel-h">${esc(t('inputPanel'))}</div>
      ${inputInner}
      <div class="run-row"><button class="btn-primary" data-act="run"${done ? ' disabled' : ''}>${esc(done ? t('runDone') : t('run'))}</button></div>
    </div>
    ${done ? `<div class="panel result"><div class="panel-h">${esc(t('resultPanel'))}</div>${demoPending ? pendingHTML() : resultHTML(scn.result[lang0])}</div>` : ''}`;
}

/** チップ行（質問例）。qa 型 または 実行後は台本の次ターン、それ以外（実行前）は誘導文 */
function chipsHTML(scn) {
  const tJa = nextTurn(scn, 'ja'), tZh = nextTurn(scn, 'zh');
  if (scn.template !== 'qa' && state.log.length === 0) return `<span>${esc(t('runHint'))}</span>`;
  if (!tJa && !tZh) return `<span>${esc(t('demoDone'))}</span>`;
  return `<span>${esc(t('chipsLabel'))}</span>` +
    (tJa ? `<button class="chip" data-act="chip" data-arg="ja"><span class="cl">${esc(t('chipJa'))}</span>${esc(tJa.q)}</button>` : '') +
    (tZh ? `<button class="chip" data-act="chip" data-arg="zh"><span class="cl">${esc(t('chipZh'))}</span>${esc(tZh.q)}</button>` : '');
}

function renderMain() {
  const el = document.getElementById('main');

  /* 保留中の返答タイマーはいったん止める。demo view の scripted pending（state.log の最終ターン）
     だけは下の復元処理で同じ遅延を再スケジュールする。それ以外（freeform の pending や demo 以外の
     view）は #msgs 自体が作り直されるため諦めて pending を解除する（§2-3：表示は state を読むだけ） */
  if (demoReplyTimer) { clearTimeout(demoReplyTimer); demoReplyTimer = null; }
  if (state.view !== 'demo' || demoPendingFreeform) { demoPending = false; demoPendingFreeform = false; }

  const pat = PATTERNS.find(p => p.id === state.pattern);
  if (pat && !pat.ready) { el.innerHTML = todoHTML(pat); return; }

  /* ▼ 追加：ホーム（絞り込みなしの list）だけパターンで描き分ける。favOnly（お気に入り一覧）は
     分類でも中分類でもない横断ビューなので、②③ の home-holder ではなく通常の list-view で描く */
  const atHome = !state.selCat && !state.selSub && !state.query.trim() && !state.favOnly;
  if (state.view === 'list' && atHome && state.pattern === 'dash') { renderDash(el); return; }
  if (state.view === 'list' && atHome && state.pattern === 'feed') { renderFeed(el); return; }
  /* ▲ 追加ここまで */

  if (state.view === 'list') {
    let title = t('allServices'), crumb = 'AI AGENT CATALOG';
    if (state.favOnly) {
      title = t('favTitle');
      crumb = t('home') + ' ／ ' + t('favTitle');
    } else if (state.selSub) {
      const c = catOf(state.selCat), sb = subOf(state.selCat, state.selSub);
      title = L(sb.name);
      crumb = t('home') + ' ／ ' + L(c.name) + ' ／ ' + L(sb.name);
    } else if (state.selCat) {
      const c = catOf(state.selCat);
      title = L(c.name);
      crumb = t('home') + ' ／ ' + L(c.name);
    }
    const list = filtered();
    el.innerHTML = `
    <div class="list-wrap" data-screen-label="サービス一覧">
      ${state.pattern !== 'nav' ? `<button class="backlink" data-act="all"><span class="arrow"></span>${esc(t('backHome'))}</button>` : ''}
      <div class="list-head">
        <div>
          <div class="crumb">${esc(crumb)}</div>
          <div class="list-title"><h1>${esc(title)}</h1></div>
          <div class="count" id="count">${esc(countText(list.length))}</div>
        </div>
        <input class="search" id="search" placeholder="${esc(t('searchPh'))}" value="${esc(state.query)}">
      </div>
      <div id="grid-holder">${gridHTML(list, listEmptyOverride(list))}</div>
    </div>`;
    const search = document.getElementById('search');
    search.addEventListener('input', () => {
      state.query = search.value;
      const l = filtered();
      document.getElementById('grid-holder').innerHTML = gridHTML(l, listEmptyOverride(l));
      document.getElementById('count').textContent = countText(l.length);
    });

  } else if (state.view === 'detail') {
    const x = svcOf(state.selSvc);
    const c = catOf(x.cat), sb = subOf(x.cat, x.sub);
    const scn = scnOf(x.id);
    el.innerHTML = `
    <div class="detail-wrap" data-screen-label="サービス詳細">
      <button class="backlink" data-act="back"><span class="arrow"></span>${esc(t('backToList'))}</button>
      <div class="detail-card ${catClass(x.cat)}">
        <div class="d-crumb">${catIcon(x.cat)}${esc(L(c.name))}・${esc(L(sb.name))}</div>
        <div class="code d-code">${esc(svcCode(x.id))}${newBadgeHTML(x)}</div>
        <h1>${esc(L(x.name))}</h1>
        <div class="d-meta">
          <span class="badge ${statusClass(x.st)}">${esc(statusText(x.st))}</span>
          ${x.tags.map(k => `<span class="tag">${esc(tag(k))}</span>`).join('')}
        </div>
        <div class="keyline"></div>
        <div class="sec-label">${esc(t('overview'))}</div>
        <p class="d-desc">${esc(L(x.desc))}</p>
        ${scn ? `
        <div class="d-two">
          <div>
            <div class="sec-label">${esc(t('personaLabel'))}</div>
            <div class="persona">
              <div class="avatar">${esc(L(scn.persona.name).charAt(0))}</div>
              <div>
                <div class="p-name">${esc(L(scn.persona.name))}</div>
                <div class="p-role">${esc(L(scn.persona.role))} ／ ${esc(L(scn.persona.site))}</div>
                <div class="p-native">${esc(t('nativeLabel'))}：${esc(scn.persona.native === 'ja' ? t('nativeJa') : t('nativeZh'))}</div>
              </div>
            </div>
          </div>
          <div>
            <div class="sec-label">${esc(t('screenType'))}</div>
            <span class="tpl-badge" title="${esc(t('tplBadge'))}">${esc(L(TEMPLATES[scn.template].name))}</span>
          </div>
        </div>
        <div class="sec-label">${esc(t('scenarioLabel'))}</div>
        <ol class="steps" aria-label="${esc(t('stepPrefix'))}">
          ${scn.steps[state.lang].map(s => `<li>${esc(s)}</li>`).join('')}
        </ol>` : ''}
        <div class="cta-row">
          <button class="btn-primary" data-act="start">${esc(scn ? t('startDemo') : t('startUse'))}</button>
          ${favToggleHTML(x)}
          <span class="cta-note">${esc(t('mockNote'))}</span>
        </div>
      </div>
    </div>`;

  } else if (state.view === 'demo') {
    const x = svcOf(state.selSvc);
    const scn = scnOf(state.selSvc);
    el.innerHTML = `
    <div class="demo-wrap" data-screen-label="業務デモ">
      <div class="chat-hdr">
        <button class="backlink" data-act="backdetail"><span class="arrow"></span>${esc(t('backToDetail'))}</button>
        <div class="vline"></div>
        <span class="code">${esc(svcCode(x.id))}</span>
        <div class="ct1">${esc(L(x.name))}</div>
        <span class="tpl-badge" title="${esc(t('tplBadge'))}">${esc(L(TEMPLATES[scn.template].name))}</span>
        <span class="who">${esc(L(scn.persona.name))}・${esc(L(scn.persona.site))}</span>
        <span class="status"><span class="dot ${statusClass(x.st)}"></span>${esc(statusText(x.st))}</span>
        <button class="backlink restart" data-act="restart">${esc(t('restart'))}</button>
      </div>
      <div class="demo-body">
        ${scn.template !== 'qa' ? `<div class="work-pane">${panelHTML(scn)}</div>` : ''}
        <div class="chat-pane">
          <div class="msgs" id="msgs"></div>
          <div class="chips" id="chips">${chipsHTML(scn)}</div>
          <div class="chat-input-row">
            <input class="chat-input" id="chat-input" placeholder="${esc(t('chatPh'))}">
            <button class="btn-send" data-act="send">${esc(t('send'))}</button>
          </div>
        </div>
      </div>
    </div>`;
    const sl = scriptLang(state.lang);
    addMsg('agent', T.chatHello[sl].replace('{name}', x.name[sl]));
    /* log の復元。最後の 1 ターンだけ agent 返答を遅らせ（考え中インジケータを出す）、
       それ以前は即時描画する。demoPending が立っている（=最終ターンの返答がまだ未表示）間は
       renderMain() が再実行されても pending のまま同じ遅延で再スケジュールする（言語/テーマ切替対応） */
    state.log.forEach((turn, i) => {
      addMsg('user', turn.q);
      const isLast = i === state.log.length - 1;
      if (isLast && demoPending) {
        showTyping();
        demoReplyTimer = setTimeout(() => {
          hideTyping();
          addMsg('agent', turn.a);
          demoPending = false;
          demoReplyTimer = null;
          if (scn.template !== 'qa') {
            const wp = document.querySelector('.work-pane');
            if (wp) wp.innerHTML = panelHTML(scn);
          }
        }, demoDelay(turn.a));
      } else {
        addMsg('agent', turn.a);
      }
    });
    const input = document.getElementById('chat-input');
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
    input.focus();

  } else {
    const x = svcOf(state.selSvc);
    el.innerHTML = `
    <div class="chat-wrap" data-screen-label="チャット画面">
      <div class="chat-hdr">
        <button class="backlink" data-act="backdetail"><span class="arrow"></span>${esc(t('backToDetail'))}</button>
        <div class="vline"></div>
        <span class="code">${esc(svcCode(x.id))}</span>
        <div class="ct1">${esc(L(x.name))}</div>
        <span class="status"><span class="dot ${statusClass(x.st)}"></span>${esc(statusText(x.st))}</span>
      </div>
      <div class="msgs" id="msgs"></div>
      <div class="chat-input-row">
        <input class="chat-input" id="chat-input" placeholder="${esc(t('chatPh'))}">
        <button class="btn-send" data-act="send">${esc(t('send'))}</button>
      </div>
    </div>`;
    addMsg('agent', t('chatHello').replace('{name}', L(x.name)));
    const input = document.getElementById('chat-input');
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });
    input.focus();
  }
  el.scrollTop = 0;
}

function addMsg(who, text) {
  const box = document.getElementById('msgs');
  if (!box) return;
  const row = document.createElement('div');
  row.className = 'msg-row ' + who;
  const b = document.createElement('div');
  b.className = 'bubble';
  b.textContent = text;
  row.appendChild(b);
  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}

/** agent 側の「考え中」バブル（3 点ドット）。文言は使わない（Issue #39） */
function showTyping() {
  const box = document.getElementById('msgs');
  if (!box || document.getElementById('typing-row')) return;
  const row = document.createElement('div');
  row.className = 'msg-row agent';
  row.id = 'typing-row';
  const b = document.createElement('div');
  b.className = 'bubble typing';
  b.innerHTML = dotsHTML();
  row.appendChild(b);
  box.appendChild(row);
  box.scrollTop = box.scrollHeight;
}
function hideTyping() {
  const row = document.getElementById('typing-row');
  if (row) row.remove();
}

/** 台本が尽きた後の汎用返答（T.chatReply）。demo / chat どちらの view でも同じ遅延・インジケータにする */
function scheduleFreeReply(text) {
  demoPending = true;
  demoPendingFreeform = true;
  showTyping();
  demoReplyTimer = setTimeout(() => {
    hideTyping();
    addMsg('agent', text);
    demoPending = false;
    demoPendingFreeform = false;
    demoReplyTimer = null;
  }, demoDelay(text));
}

function sendChat() {
  if (demoPending) return; // 返答待ちの間は二重送信を無視（Issue #39）
  const input = document.getElementById('chat-input');
  const v = input.value.trim();
  if (!v) return;
  const x = svcOf(state.selSvc);
  /* 返答は「入力された言語」に合わせる（メニュー表示言語とは独立） */
  const lang = detectLang(v);
  if (state.view === 'demo') {
    const sl = scriptLang(lang);
    input.value = '';
    if (consume(sl, v)) { demoPending = true; renderMain(); return; }  // 台本があれば台本の a を返す（q は入力文で置換）
    addMsg('user', v);                                                  // 台本が尽きたら従来の汎用返答
    scheduleFreeReply(T.chatReply[sl].replace('{name}', x.name[sl]));
    return;
  }
  /* --- 以下は既存のまま（chat view） --- */
  addMsg('user', v); input.value = '';
  scheduleFreeReply(T.chatReply[lang].replace('{name}', x.name[lang]));
}

/* ============================================================
   10. イベント（遷移ロジック — 全パターン共通）
   ============================================================ */
function renderAll() { renderChrome(); renderIndSeg(); renderSeg(); renderSidebar(); renderMain(); }
