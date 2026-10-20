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

/* ---- 本番リンク（設計書 2026-09-08-live-links.md §5-5）----
   LIVE にエントリが無ければ空文字を返す（呼び出し側に分岐を書かない＝newBadgeHTML と同じ作法）。
   成熟度バッジ（塗り）とは形（枠線＋外部リンク矢印）で区別する。色だけに頼らない。 */
const liveArrowSvg = '<svg class="ic-live" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 17L17 7M9 7h8v8" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
/** カード／`.d-meta`／`.use-row`／`.feed-item` の「いま使える」印（クリックできない <span>） */
function liveMarkHTML(x) {
  const live = liveOf(x.id);
  if (!live) return '';
  const aria = t('liveMarkAria').replace('{name}', L(x.name));
  return `<span class="live-mark" title="${esc(aria)}" aria-label="${esc(aria)}">${liveArrowSvg}${esc(t('liveMark'))}</span>`;
}
/** 詳細画面の「本番を開く」ボタン（新しいタブで開く通常のリンク。data-act は持たない） */
function liveBtnHTML(x) {
  const live = liveOf(x.id);
  if (!live) return '';
  const title = t('liveOpenTitle').replace('{updated}', live.updated);
  return `<a class="btn-live" href="${esc(live.url)}" target="_blank" rel="noopener noreferrer" title="${esc(title)}">${liveArrowSvg}${esc(t('liveOpen'))}</a>`;
}

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
    ${favBtnHTML(x)}
    <div class="c-top">
      <span class="c-tile">${catIcon(x.cat)}</span>
      <div class="c-head">
        <div class="c-crumb">${esc(L(c.name))}・${esc(L(sb.name))}</div>
        <div class="c-name">${esc(L(x.name))}</div>
      </div>
      <span class="c-code">${newBadgeHTML(x)}<span class="code">${esc(svcCode(x.id))}</span></span>
    </div>
    <div class="c-desc">${esc(L(x.desc))}</div>
    <div class="c-meta">
      <span class="status"><span class="dot ${statusClass(x.st)}"></span>${esc(statusText(x.st))}</span>
      ${liveMarkHTML(x)}
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

/** ②③ お気に入りが 6 件を超えるときの「すべて見る」。0 件では呼ばれない（呼び出し側で分岐） */
const favSeeAllHTML = (n) => n > 6
  ? `<button class="sec-more" data-act="favlist">${esc(t('favSeeAll').replace('{n}', n))}</button>` : '';

/** ② ダッシュボード：`dash-duo` の上に出す全幅のお気に入り帯（設計書 2026-09-08-favorites.md §3-3）。
    0 件なら帯ごと出さない（新着帯と同じ規則）。カードを使うので星の付け外しがその場でできる
    （.use-row は <button> のため中に星ボタンを置けない＝§3-1 の入れ子ボタン問題を避ける） */
function favBandHTML() {
  const fav = favList();
  if (!fav.length) return '';
  return `
    <div class="dash-sec dash-fav">
      <div class="sec-h">
        <h2>${esc(t('favTitle'))}</h2>
        <span class="sec-note">${esc(t('favNote'))}</span>
        ${favSeeAllHTML(fav.length)}
      </div>
      <div class="grid">
        ${fav.slice(0, 6).map(cardHTML).join('')}
      </div>
    </div>`;
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
                <span class="status"><span class="dot ${statusClass(x.st)}"></span>${esc(statusText(x.st))}</span>${liveMarkHTML(x)}</span>
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

  return `${favBandHTML()}${newHTML}<div class="dash-duo">${recoHTML}<div class="dash-col">${freqHTML}${catsHTML}</div></div>`;
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
        ${liveMarkHTML(x)}
        <span class="fi-open">${esc(t('feedOpen'))} ›</span>
      </span>
    </span>
  </button>`;
}

/** ③ 業務フィード：右レール最上段のお気に入りボックス（設計書 2026-09-08-favorites.md §3-4）。
    0 件ならボックスごと出さない。行は catIcon＋名前だけ（.side-link は <button> のため
    星ボタンは行に置かない。§3-1）。付け外しは詳細画面か「すべて見る」→カード一覧（favlist）で行う */
function favSideBoxHTML() {
  const fav = favList();
  if (!fav.length) return '';
  return `
    <div class="side-box fav-box">
      <h3><svg class="ic ic-sm" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${favStarPath(true)}</svg>${esc(t('favTitle'))}</h3>
      ${fav.slice(0, 6).map(x => `
        <button class="side-link ${catClass(x.cat)}" data-act="svc" data-arg="${x.id}">
          ${catIcon(x.cat, 'ic-sm')}<span>${esc(L(x.name))}</span>
        </button>`).join('')}
      ${fav.length > 6 ? `<button class="side-link side-more" data-act="favlist">${esc(t('favSeeAll').replace('{n}', fav.length))}</button>` : ''}
    </div>`;
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
      ${favSideBoxHTML()}
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

/** 指定セルや短い引用だけを安全なDOMで強調する。一般サービスの描画は変更しない。 */
function markedResultHTML(result, phrases = [], cellRules = []) {
  const container = document.createElement('div');
  const title = document.createElement('div'); title.className = 'kv';
  const heading = document.createElement('div'); heading.className = 'k'; heading.textContent = result.title;
  title.appendChild(heading); container.appendChild(title);
  if (result.columns) {
    const table = document.createElement('table'); table.className = 'tbl';
    const head = document.createElement('thead'), headRow = document.createElement('tr');
    result.columns.forEach(column => { const th = document.createElement('th'); th.textContent = column; headRow.appendChild(th); });
    head.appendChild(headRow); table.appendChild(head);
    const body = document.createElement('tbody');
    result.rows.forEach((values, rowIndex) => {
      const row = document.createElement('tr');
      values.forEach((text, columnIndex) => {
        const cell = document.createElement('td');
        const rule = cellRules.find(entry => entry.row === rowIndex && entry.column === columnIndex);
        appendMarkedText(cell, text, rule ? rule.phrases : phrases); row.appendChild(cell);
      });
      body.appendChild(row);
    });
    table.appendChild(body); container.appendChild(table);
  } else {
    result.items.forEach(item => {
      const row = document.createElement('div'); row.className = 'kv';
      const key = document.createElement('div'); key.className = 'k'; appendMarkedText(key, item.k, phrases);
      const value = document.createElement('div'); value.className = 'v'; appendMarkedText(value, item.v, phrases);
      row.appendChild(key); row.appendChild(value); container.appendChild(row);
    });
  }
  if (result.note) {
    const note = document.createElement('p'); note.className = 'qa-history-note';
    appendMarkedText(note, result.note, phrases); container.appendChild(note);
  }
  return container.innerHTML;
}

/** QA-01草案は原resultを複製し、完了段階までの表示用差分だけ適用する。 */
function qaDraftResultHTML(scn, completed, lang) {
  const stages = scn.draftStages[lang];
  const count = Math.min(3, stages.length, completed);
  if (!count) return '';
  const result = scn.result[lang], items = result.items.map(item => ({ ...item }));
  const highlights = new Map();
  for (const stage of stages.slice(0, count)) {
    for (const replacement of stage.replaceItems) {
      if (Number.isInteger(replacement.itemIndex) && items[replacement.itemIndex]) items[replacement.itemIndex].v = replacement.v;
    }
    for (const item of stage.appendItems) items.push({ ...item });
    for (const entry of stage.highlights) highlights.set(entry.itemIndex, entry.phrases);
  }
  const current = stages[count - 1], container = document.createElement('div');
  container.className = 'qa-draft';
  const header = document.createElement('div'); header.className = 'qa-draft-header';
  const label = document.createElement('strong');
  label.textContent = [t('qaDraftInitial'), t('qaDraftConfirmed'), t('qaDraftBilingual')][count - 1];
  const caution = document.createElement('span'); caution.textContent = t('qaDraftUnconfirmed');
  header.appendChild(label); header.appendChild(caution); container.appendChild(header);
  if (current.changes.length) {
    const changes = document.createElement('div'); changes.className = 'qa-draft-changes';
    const heading = document.createElement('div'); heading.className = 'qa-draft-changes-title';
    heading.textContent = t('qaDraftChanges'); changes.appendChild(heading);
    for (const change of current.changes) {
      const row = document.createElement('div'); row.className = 'qa-draft-change';
      const before = document.createElement('div'); before.className = 'qa-draft-before';
      before.textContent = `${t('qaDraftBefore')}: ${change.before}`;
      const arrow = document.createElement('span'); arrow.className = 'qa-draft-arrow';
      arrow.textContent = '→'; arrow.setAttribute('aria-hidden', 'true');
      const after = document.createElement('div'); after.className = 'qa-draft-after';
      after.appendChild(document.createTextNode(`${t('qaDraftAfter')}: `));
      appendMarkedText(after, change.after, [change.after]);
      row.appendChild(before); row.appendChild(arrow); row.appendChild(after); changes.appendChild(row);
    }
    container.appendChild(changes);
  }
  const title = document.createElement('div'); title.className = 'kv';
  const titleText = document.createElement('div'); titleText.className = 'k';
  titleText.textContent = result.title; title.appendChild(titleText); container.appendChild(title);
  items.forEach((item, index) => {
    const row = document.createElement('div'); row.className = 'kv';
    const key = document.createElement('div'); key.className = 'k'; key.textContent = item.k;
    const value = document.createElement('div'); value.className = 'v';
    appendMarkedText(value, item.v, highlights.get(index) || []);
    row.appendChild(key); row.appendChild(value); container.appendChild(row);
  });
  return container.outerHTML;
}

/** 載せた 1 ファイルぶんの表示。種類ごとにプレビューを出し分ける（設計書 §10-1）。
    ユーザーが選んだ doc（src が空）はチップのみ、サンプルの doc（src が実パス）は開けるリンクにする */
function upItemHTML(f, index, source = 'pending', messageKey = '') {
  if (f.kind === 'image') {
    let nameHTML = `<span class="file">🖼 ${esc(f.name)}</span>`;
    if (isQaChat()) {
      const scn = scnOf('qa1');
      const quotes = [...scn.inputHighlights.ja, ...scn.inputHighlights.zh].filter(phrase => /\.jpe?g$/i.test(phrase) && phrase === f.name);
      const name = document.createElement('span'); name.className = 'file';
      name.appendChild(document.createTextNode('🖼 '));
      appendMarkedText(name, f.name, quotes, false);
      nameHTML = name.outerHTML;
    }
    return `<div class="upitem"><button type="button" class="upimage" data-up="preview" data-up-source="${source}" data-up-key="${esc(messageKey)}" data-up-index="${index}" aria-label="${esc(t('upPreviewOpen').replace('{name}', () => f.name))}">${nameHTML}<img class="upthumb" src="${esc(f.src)}" alt=""></button></div>`;
  }
  if (f.kind === 'audio') {
    return `<div class="upitem"><span class="file">🔊 ${esc(f.name)}</span><audio class="upaudio" controls src="${esc(f.src)}"></audio></div>`;
  }
  const collection = (SCENARIOS.mfg.gn2 || {}).collectionSchedule;
  const downloadable = collection && collection.input.ja.assets.some(asset => asset.file === f.src && asset.download === f.download && asset.sampleId === f.sampleId);
  if (downloadable) return `<div class="upitem"><a class="file" href="${esc(f.src)}" download="${esc(f.download)}">📄 ${esc(f.name)}</a></div>`;
  return f.src
    ? `<div class="upitem"><a class="file" href="${esc(f.src)}" target="_blank" rel="noopener">📄 ${esc(f.name)} ${esc(t('feedOpen'))}</a></div>`
    : `<div class="upitem"><span class="file">📄 ${esc(f.name)}</span></div>`;
}

/** body 上に一度だけ作る。再描画・画像切替・ズームでコントロールの DOM を置き換えない。 */
function upPreviewEnsureDialog() {
  let dialog = document.getElementById('up-preview');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'up-preview'; dialog.className = 'up-preview';
  dialog.setAttribute('aria-labelledby', 'up-preview-title');
  dialog.setAttribute('aria-describedby', 'up-preview-note');
  dialog.innerHTML = `
    <div class="up-preview-header"><h2 id="up-preview-title"></h2><button type="button" class="upbtn" data-up="preview-close"></button></div>
    <div class="up-preview-meta"><div id="up-preview-name"></div><output id="up-preview-position" aria-live="polite"></output></div>
    <div class="up-preview-toolbar">
      <div class="up-preview-nav"><button type="button" class="upbtn" data-up="preview-prev"></button><button type="button" class="upbtn" data-up="preview-next"></button></div>
      <div class="up-preview-zoom"><button type="button" class="upbtn" data-up="preview-zoom-out">−</button><button type="button" class="upbtn" data-up="preview-fit"></button><button type="button" class="upbtn" data-up="preview-zoom-in">＋</button><output id="up-preview-zoom" aria-live="polite"></output></div>
    </div>
    <div class="up-preview-stage" tabindex="0" role="region" aria-labelledby="up-preview-name"><div class="up-preview-canvas"><img class="up-preview-image" alt=""><p class="up-preview-error" role="status" hidden></p></div></div>
    <div class="up-preview-note" id="up-preview-note"></div>`;
  document.body.appendChild(dialog);
  return dialog;
}
function upPreviewRenderLabels() {
  if (!upPreview.open) return;
  const dialog = document.getElementById('up-preview');
  const indices = upPreviewImageIndices(), position = indices.indexOf(upPreview.index);
  dialog.querySelector('#up-preview-title').textContent = t('upPreviewTitle');
  dialog.querySelector('#up-preview-name').textContent = upPreviewFiles()[upPreview.index].name;
  dialog.querySelector('#up-preview-position').textContent = t('upPreviewPosition')
    .replace('{current}', position + 1).replace('{total}', indices.length);
  dialog.querySelector('#up-preview-note').textContent = t('upNote');
  dialog.querySelector('.up-preview-error').textContent = t('upPreviewError');
  const labels = { 'preview-close': t('upPreviewClose'), 'preview-prev': t('upPreviewPrev'),
    'preview-next': t('upPreviewNext'), 'preview-fit': t('upPreviewFit'),
    'preview-zoom-in': t('upPreviewZoomIn'), 'preview-zoom-out': t('upPreviewZoomOut') };
  for (const [action, label] of Object.entries(labels)) {
    const button = dialog.querySelector(`[data-up="${action}"]`);
    button.setAttribute('aria-label', label);
    if (!action.startsWith('preview-zoom-')) button.textContent = label;
  }
  dialog.querySelector('.up-preview-nav').hidden = indices.length < 2;
  dialog.querySelector('[data-up="preview-prev"]').disabled = position <= 0;
  dialog.querySelector('[data-up="preview-next"]').disabled = position >= indices.length - 1;
  dialog.querySelector('[data-up="preview-zoom-out"]').disabled = upPreview.status !== 'ready' || upPreview.zoom === UP_PREVIEW_ZOOMS[0];
  dialog.querySelector('[data-up="preview-zoom-in"]').disabled = upPreview.status !== 'ready' || upPreview.zoom === UP_PREVIEW_ZOOMS[UP_PREVIEW_ZOOMS.length - 1];
  dialog.querySelector('[data-up="preview-fit"]').disabled = upPreview.status !== 'ready';
  const zoom = dialog.querySelector('#up-preview-zoom');
  zoom.textContent = `${upPreview.zoom}%`;
  zoom.setAttribute('aria-label', t('upPreviewZoom').replace('{percent}', upPreview.zoom));
  zoom.title = t('upPreviewZoom').replace('{percent}', upPreview.zoom);
}
function upPreviewRenderImage() {
  if (!upPreview.open || !upPreviewValidIndex(upPreview.index)) return;
  const dialog = document.getElementById('up-preview');
  const image = dialog.querySelector('.up-preview-image');
  image.hidden = true; image.style.width = ''; image.style.height = '';
  image.alt = upPreviewFiles()[upPreview.index].name;
  image.src = upPreviewFiles()[upPreview.index].src;
  dialog.querySelector('.up-preview-error').hidden = true;
  const stage = dialog.querySelector('.up-preview-stage');
  stage.scrollLeft = 0; stage.scrollTop = 0;
  upPreviewRenderLabels();
}
/** 実際の幅・高さを増やし、拡大した画像の全ての端をスクロール可能にする。 */
function upPreviewRenderSize(resetScroll = false) {
  if (!upPreview.open || upPreview.status !== 'ready') return;
  const dialog = document.getElementById('up-preview');
  const image = dialog.querySelector('.up-preview-image');
  const stage = dialog.querySelector('.up-preview-stage');
  const canvas = dialog.querySelector('.up-preview-canvas');
  const style = getComputedStyle(canvas);
  const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const stageStyle = getComputedStyle(stage);
  const horizontalBorder = parseFloat(stageStyle.borderLeftWidth) + parseFloat(stageStyle.borderRightWidth);
  const verticalBorder = parseFloat(stageStyle.borderTopWidth) + parseFloat(stageStyle.borderBottomWidth);
  // 拡大時のスクロールバーに左右されない、全体表示時の表示領域を基準にする。
  const fit = Math.min((stage.offsetWidth - horizontalBorder - horizontalPadding) / image.naturalWidth,
    (stage.offsetHeight - verticalBorder - verticalPadding) / image.naturalHeight);
  if (!(fit > 0)) return;
  image.style.width = `${image.naturalWidth * fit * upPreview.zoom / 100}px`;
  image.style.height = `${image.naturalHeight * fit * upPreview.zoom / 100}px`;
  image.hidden = false;
  if (resetScroll) { stage.scrollLeft = 0; stage.scrollTop = 0; }
}

function nmSummaryEnsureDialog() {
  let dialog = document.getElementById('nm-summary');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'nm-summary'; dialog.className = 'nm-summary-dialog';
  dialog.setAttribute('aria-labelledby', 'nm-summary-title');
  dialog.setAttribute('aria-describedby', 'nm-summary-source');
  dialog.innerHTML = `<div class="nm-summary-header"><div><h2 id="nm-summary-title"></h2><div id="nm-summary-period"></div></div><button type="button" class="upbtn" data-nm-summary="close"></button></div><div class="nm-summary-body" tabindex="0" role="region" aria-labelledby="nm-summary-title"></div>`;
  document.body.appendChild(dialog);
  return dialog;
}
function nmSummaryRenderContent() {
  if (!nmSummary.open) return;
  const dialog = document.getElementById('nm-summary'), summary = scnOf('nm5').summary;
  dialog.querySelector('#nm-summary-title').textContent = t('nmSummaryTitle');
  dialog.querySelector('#nm-summary-period').textContent = t('nmSummaryPeriod');
  dialog.querySelector('[data-nm-summary="close"]').textContent = t('upPreviewClose');
  const shiftLabels = { day: t('nmSummaryDay'), night: t('nmSummaryNight') };
  const defectLabels = { particles: t('nmSummaryParticles'), thinCoat: t('nmSummaryThinCoat'),
    dents: t('nmSummaryDents'), other: t('nmSummaryOther') };
  const maxRate = Math.max(...summary.shifts.map(shift => shift.defectRate));
  const punctuation = state.lang === 'en' ? '. ' : '。';
  const footnote = [t('nmSummaryPeriod'), t('nmSummarySampleNote'), t('nmSummaryCorrelationNote')].join(punctuation) + punctuation.trim();
  dialog.querySelector('.nm-summary-body').innerHTML = `
    <div class="nm-summary-sheet">
      <div class="nm-summary-kicker">${esc(t('nmSummaryNumbers'))}</div>
      <div class="nm-summary-figures">
        <section class="nm-summary-lines"><h3>${esc(t('nmSummaryLines'))}</h3>
          <div class="nm-summary-table-wrap"><table class="nm-summary-table"><thead><tr><th scope="col">${esc(t('nmSummaryLine'))}</th><th scope="col">${esc(t('nmSummaryOvertime'))}</th><th scope="col">${esc(t('nmSummaryDefectRate'))}</th><th scope="col">${esc(t('nmSummaryCorrelation'))}</th></tr></thead><tbody>
          ${summary.lines.map(line => `<tr${line.line === 'L2' ? ' class="nm-summary-focus-line"' : ''}><th scope="row">${esc(line.line)}</th><td>${esc(line.overtime.toFixed(1))}</td><td>${esc(line.defectRate.toFixed(2))}</td><td>${esc((line.correlation >= 0 ? '+' : '') + line.correlation.toFixed(2))}</td></tr>`).join('')}
          </tbody></table></div>
        </section>
        <div class="nm-summary-charts"><section><h3>${esc(t('nmSummaryShifts'))}</h3>
          <div class="nm-summary-shifts">${summary.shifts.map(shift => `<div class="nm-summary-shift"><span>${esc(shiftLabels[shift.key])}</span><div class="nm-summary-bar-track" aria-hidden="true"><div class="nm-summary-bar nm-summary-bar-${esc(shift.key)}" style="width:${shift.defectRate / maxRate * 100}%"></div></div><strong>${esc(shift.defectRate.toFixed(2))}%</strong></div>`).join('')}</div>
        </section><section class="nm-summary-defects"><h3>${esc(t('nmSummaryDefects'))}</h3>
          <div class="nm-summary-stack" aria-hidden="true">${summary.defects.map(defect => `<span class="nm-summary-segment nm-summary-segment-${esc(defect.key)}" style="width:${defect.share}%"></span>`).join('')}</div>
          <ul class="nm-summary-legend">${summary.defects.map(defect => `<li><span class="nm-summary-legend-dot nm-summary-segment-${esc(defect.key)}" aria-hidden="true"></span><span>${esc(defectLabels[defect.key])}</span><strong>${esc(defect.share)}%</strong></li>`).join('')}</ul>
        </section></div>
      </div>
      <div class="nm-summary-actions"><section><h3>${esc(t('nmSummaryChecks'))}</h3><ul>${L(summary.checks).map(item => `<li>${esc(item)}</li>`).join('')}</ul></section><section><h3>${esc(t('nmSummaryOptions'))}</h3><ul>${L(summary.options).map(item => `<li>${esc(item)}</li>`).join('')}</ul></section></div>
      <footer class="nm-summary-footnote" id="nm-summary-source"><p>${esc(footnote)}</p></footer>
    </div>`;
}

/** 未送信に実際に選択されたファイルだけを表示する。
    「サンプルを使う」は inp.assets が files と同じ長さのときだけ出す。 */
function uploadPanelHTML(scn, inp) {
  const hasSample = Array.isArray(inp.assets) && inp.assets.length === inp.files.length;
  const disabled = demoPending ? ' disabled' : '';
  const filesHTML = upFiles.map((file, index) => upItemHTML(file, index)).join('');
  const actions = (hasSample ? `<button type="button" class="upbtn" data-up="sample"${disabled}>${esc(t('upSample'))}</button>` : '') +
    (upFiles.length ? `<button type="button" class="upbtn" data-up="clear"${disabled}>${esc(t('upClear'))}</button>` : '');
  return `
    <div class="drop upzone" data-up="pick" tabindex="${demoPending ? '-1' : '0'}" role="button" aria-disabled="${demoPending}" aria-label="${esc(t('upDrop'))}">${esc(t('upDrop'))}</div>
    <input type="file" class="upinput" data-up="input" multiple hidden${disabled}>
    ${actions ? `<div class="upactions">${actions}</div>` : ''}
    <div class="upfiles">${filesHTML}</div>
    <div class="upnote">${esc(t('upNote'))}</div>`;
}

function qaAttachmentsHTML(scn) {
  return `<div class="qa-attachments panel" id="qa-attachments"${chatCompose.attachmentVisible ? '' : ' hidden'}><div class="panel-h">${esc(t('qaPhotoAdd'))}</div>${uploadPanelHTML(scn, scn.input[scriptLang(state.lang)])}</div>`;
}
function gn2InputPreviewHTML(scn) {
  if (!gn2CollectionSampleMatches(upFiles)) return '';
  return scn.collectionSchedule.input[scriptLang(state.lang)].previewTables.map(table => `<details class="gn2-input-preview"><summary>${esc(table.title)}</summary><div class="gn2-table-scroll">${resultHTML(table)}</div></details>`).join('');
}
function gn2AttachmentsHTML(scn) {
  const inp = gn2InputForDraft(scn, scriptLang(state.lang));
  return `<div class="chat-attachments panel"${chatCompose.attachmentVisible ? '' : ' hidden'}><div class="panel-h">${esc(t('upAttachOpen'))}</div>${uploadPanelHTML(scn, inp)}${gn2InputPreviewHTML(scn)}</div>`;
}
function gn2ResultEntries() {
  const latest = new Map();
  for (const entry of gn2CompletedEntries()) {
    if (entry.meta.route === 'ap') latest.set('ap', entry);
    else if (entry.meta.route === 'ar') latest.set(`ar:${entry.meta.step}`, entry);
  }
  return Array.from(latest.values()).sort((a, b) => b.index - a.index);
}
function gn2CollectionResultHTML(scn, entry) {
  const collection = scn.collectionSchedule, stage = entry.meta.step;
  const rules = stage === 1 ? [{ row: 3, column: 4, phrases: [entry.turn.lang === 'zh' ? '待确认' : '未確認'] }] : [
    { row: 0, column: 3, phrases: ['150,000'] }, { row: 1, column: 0, phrases: ['2025-09-30'] }, { row: 2, column: 3, phrases: ['100,000'] }
  ];
  const artifact = collection.artifacts.find(item => item.stage === stage);
  const expected = stage === 1 ? 'assets/demo/gn2-collection-draft.xlsx' : 'assets/demo/gn2-collection-reviewed.xlsx';
  const link = artifact && artifact.file === expected ? `<a class="upbtn gn2-download" href="${esc(artifact.file)}" download="${esc(artifact.name)}">${esc(t('gn2DownloadExcel'))} · ${esc(artifact.name)}</a>` : '';
  return `<div class="gn2-collection-result"><div class="gn2-table-scroll">${markedResultHTML(collection.results[entry.turn.lang][stage - 1], [], rules)}</div>${link}</div>`;
}
function gn2ResultsHTML(scn) {
  const entries = gn2ResultEntries();
  if (!entries.length) return '';
  const artifacts = entries.map(entry => {
    const ar = entry.meta.route === 'ar', result = ar ? scn.collectionSchedule.results[entry.turn.lang][entry.meta.step - 1] : scn.result[entry.turn.lang];
    const rules = scn.resultHighlights && scn.resultHighlights[entry.turn.lang];
    return { title: result.title, body: ar ? gn2CollectionResultHTML(scn, entry) : rules ? markedResultHTML(result, [], rules) : resultHTML(result) };
  });
  return `<div class="panel result"><div class="panel-h">${esc(t('resultPanel'))}</div>${demoPending ? pendingHTML() : ''}${artifacts[0].body}${artifacts.slice(1).map(artifact => `<details class="gn2-previous-result"><summary>${esc(artifact.title)}</summary>${artifact.body}</details>`).join('')}</div>`;
}
function gn2ChipsHTML(scn) {
  if (demoPending) return '';
  const lang = scriptLang(state.lang), previous = gn2LatestCompleted();
  const routes = previous ? [previous.meta.route] : ['ap', 'ar'];
  const options = routes.map(route => {
    const stage = gn2RouteStage(route), turns = route === 'ar' ? scn.collectionSchedule.script[lang] : scn.script[lang];
    return turns[stage] ? { route, step: stage + 1, q: turns[stage].q } : null;
  }).filter(Boolean);
  return options.length ? `<span>${esc(t('chipsLabel'))}</span>${options.map(option => `<button class="chip" data-act="chip" data-arg="${lang}" data-gn2-route="${option.route}" data-gn2-step="${option.step}"><span class="cl">${esc(lang === 'zh' ? t('chipZh') : t('chipJa'))}</span>${markedTextHTML(option.q, scn.apQuestionHighlights?.[lang] || [])}</button>`).join('')}` : '';
}
function qaResultsHTML(scn) {
  const entries = qaResultEntries();
  if (!entries.length) return '';
  const artifacts = entries.map(entry => {
    if (entry.meta.route === 'record') {
      const firstRecord = qaTurnMeta.findIndex(meta => meta.route === 'record');
      const lang = entry.meta.step === 3 ? scriptLang(state.lang) : state.log[firstRecord].lang;
      return { title: scn.result[lang].title, body: qaDraftResultHTML(scn, entry.meta.step, lang) };
    }
    const result = qaHistoryResult(scn, entry.meta, entry.turn.lang);
    return { title: result.title, body: `<div class="qa-history-result">${markedResultHTML(result, scn.outputHighlights[entry.turn.lang])}</div>` };
  });
  return `<div class="panel result"><div class="panel-h">${esc(t('resultPanel'))}</div>${demoPending && !demoPendingFreeform ? pendingHTML() : ''}${artifacts[0].body}${artifacts.slice(1).map(artifact => `<details class="qa-previous-result"><summary>${esc(artifact.title)}</summary>${artifact.body}</details>`).join('')}</div>`;
}
function qaChipsHTML(scn) {
  if (demoPending) return '';
  const lang = scriptLang(state.lang), latest = qaLatestCompleted();
  const progress = qaCompletedEntries().filter(entry => entry.meta.route !== 'clarify').at(-1);
  let options = [];
  if (latest && latest.meta.route === 'clarify' && latest.meta.outputRef === 'clarify:photos') options = [{ action: 'record', q: scn.qaPrompts[lang].record }];
  else if (!progress) options = ['record', 'search'].map(action => ({ action, q: scn.qaPrompts[lang][action] }));
  else if (progress && progress.meta.route === 'record' && progress.meta.step < 3) options = [{ step: progress.meta.step + 1, q: scn.script[lang][progress.meta.step].q }];
  else if (progress && progress.meta.route === 'history' && progress.meta.step < 3) {
    const action = progress.meta.step === 1 ? 'compare' : 'next';
    options = [{ action, q: scn.qaPrompts[lang][action] }];
  }
  return options.length ? `<span>${esc(t('chipsLabel'))}</span>${options.map(option => `<button class="chip" data-act="chip" data-arg="${lang}"${option.step ? ` data-qa-record-step="${option.step}"` : ` data-qa-prompt="${option.action}"`}><span class="cl">${esc(lang === 'zh' ? t('chipZh') : t('chipJa'))}</span>${esc(option.q)}</button>`).join('')}` : '';
}

/** work-pane の中身（入力パネル＋結果パネル）。テンプレートごとに入力 UI だけ分岐する */
function panelHTML(scn) {
  const done = state.log.length > 0;
  const lang0 = done ? state.log[0].lang : scriptLang(state.lang);
  const completed = completedScriptTurns();
  if (scn.qaPrompts && isQaChat()) return qaResultsHTML(scn);
  if (scn.collectionSchedule && isGn2Chat()) return gn2ResultsHTML(scn);
  if (scn.startMode === 'chat') {
    return completed ? `<div class="panel result"><div class="panel-h">${esc(t('resultPanel'))}</div>${demoPending && !demoPendingFreeform ? pendingHTML() : ''}${scn.resultHighlights ? markedResultHTML(scn.result[lang0], [], scn.resultHighlights[lang0]) : resultHTML(scn.result[lang0])}</div>` : '';
  }
  const inp = scn.input[lang0];
  let inputInner = '';
  if (scn.template === 'upload') {
    inputInner = uploadPanelHTML(scn, inp);
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
    <div class="panel${done ? ' done' : ''}${scn.template === 'upload' ? ' pending-attachments' : ''}"${scn.template === 'upload' && done && !chatCompose.attachmentVisible ? ' hidden' : ''}>
      <div class="panel-h">${esc(t('inputPanel'))}</div>
      ${inputInner}
      <div class="run-row"><button class="btn-primary" data-act="run"${done || demoPending || upReading ? ' disabled' : ''}>${esc(done ? t('runDone') : t('run'))}</button></div>
    </div>
    ${done ? `<div class="panel result"><div class="panel-h">${esc(t('resultPanel'))}</div>${scn.draftStages ?
      (demoPending && !demoPendingFreeform ? pendingHTML() : '') + qaDraftResultHTML(scn, completed, completed >= 3 ? scriptLang(state.lang) : lang0) :
      (demoPending ? pendingHTML() : resultHTML(scn.result[lang0]))}</div>` : ''}`;
}

/** 遅延回答完了時は結果パネルと列構成だけを更新し、チャット入力・会話は保つ。 */
function updateDemoPanels(scn) {
  const pane = document.querySelector('.work-pane');
  if (pane) pane.innerHTML = panelHTML(scn);
  if (pane && scn.startMode === 'chat') {
    pane.hidden = scn.qaPrompts ? qaResultEntries().length === 0 : scn.collectionSchedule ? gn2ResultEntries().length === 0 : completedScriptTurns() === 0;
    const body = document.querySelector('.demo-body');
    if (body) body.classList.toggle('demo-chat-only', pane.hidden);
  }
  const chips = document.getElementById('chips');
  if (chips) chips.innerHTML = chipsHTML(scn);
  chatRefreshControls();
}

/** チップ行（質問例）。qa 型 または 実行後は台本の次ターン、それ以外（実行前）は誘導文 */
function chipsHTML(scn) {
  if (scn.qaPrompts && isQaChat()) return qaChipsHTML(scn);
  if (scn.collectionSchedule && isGn2Chat()) return gn2ChipsHTML(scn);
  if (demoPending) return '';
  const lang = scriptLang(state.lang), turn = nextTurn(scn, lang);
  if (!turn) return `<span>${esc(t('demoDone'))}</span>`;
  return `<span>${esc(t('chipsLabel'))}</span><button class="chip" data-act="chip" data-arg="${lang}"><span class="cl">${esc(lang === 'zh' ? t('chipZh') : t('chipJa'))}</span>${esc(turn.q)}</button>`;
}

function chatAutosize(input) {
  if (!input) return;
  input.style.height = '64px';
  const height = Math.max(64, Math.min(160, input.scrollHeight));
  input.style.height = `${height}px`;
  input.style.overflowY = input.scrollHeight > 160 ? 'auto' : 'hidden';
}
function chatRestoreDraft(focus = true) {
  const input = document.getElementById('chat-input');
  if (!input) return;
  chatComposeOwner = chatContextKey();
  input.value = chatCompose.text;
  input.setSelectionRange(Math.min(chatCompose.selectionStart, input.value.length), Math.min(chatCompose.selectionEnd, input.value.length));
  chatAutosize(input);
  if (focus && !upPreview.open && !nmSummary.open) input.focus({ preventScroll: true });
}
function chatSetDraft(text) {
  if (demoPending) return;
  chatCompose.text = text; chatCompose.selectionStart = text.length; chatCompose.selectionEnd = text.length;
  chatRestoreDraft();
}
function chatRefreshControls() {
  const send = document.querySelector('[data-act="send"]');
  if (send) send.disabled = demoPending || upReading > 0;
  for (const button of document.querySelectorAll('[data-up="qa-attach"], [data-up="attach"], [data-up="sample"], [data-up="clear"], [data-up="input"]')) button.disabled = demoPending;
  for (const zone of document.querySelectorAll('.upzone')) {
    zone.setAttribute('aria-disabled', String(demoPending));
    zone.setAttribute('tabindex', demoPending ? '-1' : '0');
  }
}
function chatComposerHTML(scn) {
  const canAttach = !scn || scn.template === 'upload';
  const attach = canAttach ? `<button type="button" class="upbtn${scn && scn.qaPrompts ? ' qa-photo-add' : ''}" data-up="${scn && scn.qaPrompts ? 'qa-attach' : 'attach'}"${demoPending ? ' disabled' : ''}>${esc(t(scn && scn.qaPrompts ? 'qaPhotoAdd' : 'upAttachOpen'))}</button>` : '';
  return `<div class="chat-input-row">${attach}<textarea class="chat-input" id="chat-input" rows="2" placeholder="${esc(t('chatPh'))}"></textarea><button class="btn-send" data-act="send"${demoPending || upReading ? ' disabled' : ''}>${esc(t('send'))}</button></div>`;
}
function chatScheduleReply(turn, meta, extra = null) {
  showTyping();
  const epoch = chatSessionEpoch, context = chatContextKey();
  demoReplyTimer = setTimeout(() => {
    if (epoch !== chatSessionEpoch || context !== chatContextKey() || !['demo', 'chat'].includes(state.view)) return;
    hideTyping();
    addMsg('agent', turn.a, turn.lang, meta);
    if (extra) extra.pending = false;
    demoPending = false; demoPendingFreeform = false; demoReplyTimer = null;
    const scn = state.view === 'demo' ? scnOf(state.selSvc) : null;
    if (scn) updateDemoPanels(scn);
    else chatRefreshControls();
  }, demoDelay(turn.a));
}
function chatRenderHistory(scn) {
  state.log.forEach((turn, index) => {
    const meta = scn && scn.qaPrompts ? qaTurnMeta[index] : scn && scn.collectionSchedule ? gn2TurnMeta[index] : null;
    addMsg('user', turn.q, turn.lang, meta, `log:${index}`);
    if (index === state.log.length - 1 && demoPending && !demoPendingFreeform) chatScheduleReply(turn, meta);
    else addMsg('agent', turn.a, turn.lang, meta);
  });
  extraChatHistory.forEach(turn => {
    addMsg('user', turn.q, turn.lang, null, turn.key);
    if (turn.pending) {
      demoPending = true; demoPendingFreeform = true;
      chatScheduleReply(turn, null, turn);
    } else addMsg('agent', turn.a, turn.lang);
  });
}

function renderMain() {
  chatCaptureDraft();
  if (nmSummary.open) {
    if (state.industry !== 'mfg' || state.selSvc !== 'nm5' || state.view !== 'demo' || !state.log.length) nmSummaryClose(false);
    else nmSummaryRenderContent();
  }
  if (upPreview.open) {
    if (!['demo', 'chat'].includes(state.view) || state.selSvc !== upPreview.service) upPreviewClose(false);
    else { upPreviewRenderLabels(); upPreviewRenderSize(); }
  }
  const el = document.getElementById('main');

  /* 台本／汎用の回答待ちは下の発話履歴から再スケジュールする。 */
  if (demoReplyTimer) { clearTimeout(demoReplyTimer); demoReplyTimer = null; }
  if (!['demo', 'chat'].includes(state.view)) { demoPending = false; demoPendingFreeform = false; }

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
          ${liveMarkHTML(x)}
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
        </ol>${scn.collectionSchedule ? `<div class="sec-label">${esc(t('gn2CollectionSteps'))}</div><ol class="steps" aria-label="${esc(t('stepPrefix'))}">${scn.collectionSchedule.steps[state.lang].map(step => `<li>${esc(step)}</li>`).join('')}</ol>` : ''}` : ''}
        <div class="cta-row">
          <button class="btn-primary" data-act="start">${esc(scn ? t('startDemo') : t('startUse'))}</button>
          ${liveBtnHTML(x)}
          ${favToggleHTML(x)}
          <span class="cta-note">${esc(t('mockNote'))}</span>
          ${liveOf(x.id) ? `<span class="cta-note cta-note-live">${esc(t('liveNote'))}</span>` : ''}
        </div>
      </div>
    </div>`;

  } else if (state.view === 'demo') {
    const x = svcOf(state.selSvc);
    const scn = scnOf(state.selSvc);
    const chatOnly = scn.startMode === 'chat' && (scn.qaPrompts ? qaResultEntries().length === 0 : scn.collectionSchedule ? gn2ResultEntries().length === 0 : completedScriptTurns() === 0);
    el.innerHTML = `
    <div class="demo-wrap${scn.qaPrompts ? ' qa-chat-demo' : ''}${scn.collectionSchedule ? ' gn2-chat-demo' : ''}" data-screen-label="業務デモ">
      <div class="chat-hdr">
        <button class="backlink" data-act="backdetail"><span class="arrow"></span>${esc(t('backToDetail'))}</button>
        <div class="vline"></div>
        <span class="code">${esc(svcCode(x.id))}</span>
        <div class="ct1">${esc(L(x.name))}</div>
        ${scn.qaPrompts ? '' : `<span class="tpl-badge" title="${esc(t('tplBadge'))}">${esc(L(TEMPLATES[scn.template].name))}</span>`}
        <span class="who">${esc(L(scn.persona.name))}・${esc(L(scn.persona.site))}</span>
        <span class="status"><span class="dot ${statusClass(x.st)}"></span>${esc(statusText(x.st))}</span>
        <button class="backlink restart" data-act="restart">${esc(t('restart'))}</button>
      </div>
      <div class="demo-body${chatOnly ? ' demo-chat-only' : ''}">
        ${scn.template !== 'qa' ? `<div class="work-pane"${chatOnly ? ' hidden' : ''}>${panelHTML(scn)}</div>` : ''}
        <div class="chat-pane">
          <div class="msgs" id="msgs"></div>
          <div class="chips" id="chips">${chipsHTML(scn)}</div>
          ${scn.qaPrompts ? qaAttachmentsHTML(scn) : ''}
          ${scn.collectionSchedule ? gn2AttachmentsHTML(scn) : ''}
          ${chatComposerHTML(scn)}
        </div>
      </div>
      ${scn.qaPrompts ? `<div class="qa-demo-note">${esc(t('qaDemoNote'))}</div>` : ''}
    </div>`;
    const sl = scriptLang(state.lang);
    addMsg('agent', T.chatHello[sl].replace('{name}', x.name[sl]));
    chatRenderHistory(scn);
    chatRestoreDraft();

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
      <div class="chat-attachments panel"${chatCompose.attachmentVisible ? '' : ' hidden'}><div class="panel-h">${esc(t('upAttachOpen'))}</div>${uploadPanelHTML(null, { files: [] })}</div>
      ${chatComposerHTML(null)}
    </div>`;
    addMsg('agent', t('chatHello').replace('{name}', L(x.name)));
    chatRenderHistory(null);
    chatRestoreDraft();
  }
  el.scrollTop = 0;
}

/** QA-01 / NM-05の既存回答だけを、HTML解釈せず短い引用の完全一致で強調する。 */
function appendQaHighlights(target, text, lang, meta) {
  if (state.industry !== 'mfg' || !['qa1', 'nm5'].includes(state.selSvc) || state.view !== 'demo') return false;
  const scn = scnOf(state.selSvc);
  if (state.selSvc === 'qa1' && meta && meta.route === 'history' && qaHistoryAnswer(scn, meta.step, meta.variant, lang) === text) {
    appendMarkedText(target, text, scn.outputHighlights[lang]); return true;
  }
  const phrases = scn.highlights && scn.highlights[lang];
  const turns = scn.script && scn.script[lang];
  if (!Array.isArray(phrases) || !Array.isArray(turns) || !turns.some(turn => turn.a === text)) return false;
  appendMarkedText(target, text, phrases);
  return true;
}
function appendMarkedText(target, text, phrases, stripEmphasis = true) {
  const displayText = stripEmphasis ? text.replace(/\*\*/g, '') : text;
  let cursor = 0;
  while (cursor < displayText.length) {
    let found = null;
    for (const phrase of phrases) {
      if (typeof phrase !== 'string' || !phrase.length) continue;
      const index = displayText.indexOf(phrase, cursor);
      if (index >= 0 && (!found || index < found.index || (index === found.index && phrase.length > found.phrase.length))) {
        found = { index, phrase };
      }
    }
    if (!found) { target.appendChild(document.createTextNode(displayText.slice(cursor))); break; }
    if (found.index > cursor) target.appendChild(document.createTextNode(displayText.slice(cursor, found.index)));
    const mark = document.createElement('mark');
    mark.className = 'qa-highlight'; mark.textContent = found.phrase;
    target.appendChild(mark);
    cursor = found.index + found.phrase.length;
  }
}

function markedTextHTML(text, phrases) {
  const container = document.createElement('span');
  appendMarkedText(container, text, phrases, false);
  return container.innerHTML;
}

function nmSummaryIsFinalReply(text, lang) {
  if (state.industry !== 'mfg' || state.selSvc !== 'nm5' || state.view !== 'demo') return false;
  const scn = scnOf(state.selSvc), turns = scn.script[lang];
  return !!(scn.summary && turns && turns.length && turns[turns.length - 1].a === text);
}

function addMsg(who, text, replyLang, meta, messageKey) {
  const box = document.getElementById('msgs');
  if (!box) return;
  const row = document.createElement('div');
  row.className = 'msg-row ' + who;
  const b = document.createElement('div');
  b.className = 'bubble';
  const scn = state.view === 'demo' && state.industry === 'mfg' ? scnOf(state.selSvc) : null;
  const collection = isGn2Chat() && scn && scn.collectionSchedule;
  const ar = meta && (meta.route === 'ar' || meta.outputRef.startsWith('clarify:ar-'));
  if (collection && ar && replyLang && (who === 'user' || meta.route === 'ar')) {
    appendMarkedText(b, text, who === 'user' ? collection.inputHighlights[replyLang] : collection.outputHighlights[replyLang], who !== 'user');
  } else if (collection && who === 'user' && replyLang && scn.apQuestionHighlights?.[replyLang]) {
    appendMarkedText(b, text, scn.apQuestionHighlights[replyLang], false);
  } else if (who === 'user' && scn && scn.inputHighlights && replyLang) {
    appendMarkedText(b, text, meta ? meta.inputPhrases : scn.inputHighlights[replyLang], false);
  } else if (who !== 'agent' || !appendQaHighlights(b, text, replyLang, meta)) b.textContent = text;
  if (who === 'agent' && nmSummaryIsFinalReply(text, replyLang)) {
    const action = document.createElement('div'); action.className = 'nm-summary-action';
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'upbtn'; button.dataset.nmSummary = 'open';
    button.textContent = t('nmSummaryOpen'); action.appendChild(button); b.appendChild(action);
  }
  const files = who === 'user' && messageKey ? sentAttachments.get(messageKey) : null;
  if (files && files.length) {
    const gallery = document.createElement('div'); gallery.className = 'sent-attachments';
    const label = document.createElement('div'); label.className = 'sent-attachments-label'; label.textContent = t('upSentFiles');
    const items = document.createElement('div'); items.className = 'sent-attachments-items';
    items.innerHTML = files.map((file, index) => upItemHTML(file, index, 'sent', messageKey)).join('');
    gallery.appendChild(label); gallery.appendChild(items); b.appendChild(gallery);
  }
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
function scheduleFreeReply(text, lang, q) {
  const turn = { key: `extra:${++extraChatSequence}`, lang: scriptLang(lang), q, a: text, pending: true };
  extraChatHistory.push(turn);
  chatAcceptAttachments(turn.key);
  demoPending = true;
  demoPendingFreeform = true;
  renderMain();
}

function sendChat() {
  if (demoPending || upReading) return;
  const input = document.getElementById('chat-input');
  if (!input) return;
  const raw = input.value;
  const v = raw.trim();
  if (!v && !upFiles.length) return;
  const x = svcOf(state.selSvc);
  const lang = v ? scriptLang(detectLang(v)) : scriptLang(state.lang);
  const scn = state.view === 'demo' ? scnOf(state.selSvc) : null;
  const turn = scn && !isQaChat() && !isGn2Chat() ? nextTurn(scn, lang) : null;
  const gn2Default = isGn2Chat() ? gn2CollectionSampleMatches(upFiles) ? scn.collectionSchedule.script[lang][0].q : (scn.script[lang][gn2RouteStage('ap')] || {}).q : null;
  const q = v ? raw : isQaChat() ? scn.qaPrompts[lang].record : gn2Default || (turn ? turn.q : t('upSentFiles'));
  if (isQaChat()) {
    if (qaSubmitRequest(q, lang)) { chatAcceptAttachments(`log:${state.log.length - 1}`); renderMain(); }
    return;
  }
  if (isGn2Chat()) {
    if (gn2SubmitRequest(q, lang)) { chatAcceptAttachments(`log:${state.log.length - 1}`); renderMain(); }
    return;
  }
  if (state.view === 'demo') {
    if (consume(lang, q)) {
      chatAcceptAttachments(`log:${state.log.length - 1}`);
      demoPending = true; demoPendingFreeform = false; renderMain(); return;
    }
    scheduleFreeReply(T.chatReply[lang].replace('{name}', x.name[lang]), lang, q);
    return;
  }
  scheduleFreeReply(T.chatReply[lang].replace('{name}', x.name[lang]), lang, q);
}

/* ============================================================
   10. イベント（遷移ロジック — 全パターン共通）
   ============================================================ */
function renderAll() { renderChrome(); renderIndSeg(); renderSeg(); renderSidebar(); renderMain(); }
