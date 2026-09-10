'use strict';
/* mock/js/app.js — state / 定数ヘルパー / detectLang / デモ制御 / 設定の永続化
   出所: mock/catalog.html（分割前）。設計書 docs/handoff/2026-09-07-split-catalog.md §1・§9-1（PR-C）。
   値は 1 バイトも変えていない（抽出コマンドの再実行で diff ゼロを確認）。
   例外: このファイル冒頭の起動時 assert のみ新規コード（設計書 §2-4）。 */

/* 読み込み順の保険。<script src> が 1 つでも欠けた／順序が入れ替わったときに、
   白画面ではなく「どのファイルが来ていないか」を画面に出す。
   注：このメッセージは T（多言語辞書）に置かない。T 自体が来ていない場合に使うため、
       §2-1（3 言語同時）の対象外とする ―― 開発者向けの起動失敗表示であって UI 文言ではない */
(function () {
  var missing = [];
  if (typeof T === 'undefined' || typeof INDUSTRIES === 'undefined')
                                         missing.push('js/data/ui.js (T/PATTERNS/TAGS/TEMPLATES/INDUSTRIES)');
  if (typeof CATS === 'undefined' || typeof SVCS === 'undefined') missing.push('js/data/catalog.js (CATS/SVCS)');
  if (typeof HOME === 'undefined' || typeof FEED === 'undefined') missing.push('js/data/home.js (HOME/FEED)');
  if (typeof CAT_STYLE === 'undefined')  missing.push('js/data/style.js (CAT_STYLE)');
  if (typeof SCENARIOS === 'undefined' || Object.keys(SCENARIOS).length === 0)
                                         missing.push('js/data/scenarios/*.js (SCENARIOS)');
  if (!missing.length) return;
  var el = document.getElementById('main');
  if (el) el.innerHTML = '<pre style="padding:24px;white-space:pre-wrap">'
    + 'データファイルが読み込まれていません / Data files are not loaded:\n  - '
    + missing.join('\n  - ')
    + '\n\ncatalog.html の &lt;script src&gt; の並びを確認してください（設計書 2026-09-07-split-catalog.md §2-1）。'
    + '\nCheck the &lt;script src&gt; order in catalog.html.</pre>';
  throw new Error('mock: data files missing — ' + missing.join(', '));
})();

/* ============================================================
   3. 状態（共通レイヤー）
   pattern を切り替えても選択位置は保持され、直接比較できる
   ============================================================ */
const state = {
  industry: 'mfg',        // 'mfg' | 'fin'。localStorage には保存しない（§4-5：pattern と同じ足場の一時状態）
  pattern: 'nav',
  lang: 'ja',
  theme: 'light',
  openCats: { kn: true },
  selCat: null,
  selSub: null,
  lastCat: 'kn',
  selSvc: null,
  view: 'list',          // 'list' | 'detail' | 'chat' | 'demo'
  query: '',
  fav: { mfg: [], fin: [] },   // 業種ごとのお気に入り（SVCS[].id の配列。localStorage 'mock.fav' に保存。設計書 2026-09-08-favorites.md §2-2）
  favOnly: false,              // list ビューで「お気に入りだけ」を表示中か（保存しない＝リロードでホームに戻る）
  log: []                // デモで消費した台本ターン [{ lang: 'ja'|'zh', q: string, a: string }]
};

/* ============================================================
   4. ヘルパー
   ============================================================ */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** 多言語オブジェクトから現在言語の文字列を取り出す */
const L = (obj) => (obj && (obj[state.lang] ?? obj.ja)) || '';
const t = (key) => L(T[key]);
const tag = (key) => L(TAGS[key]) || key;

/* ---- 業種（.mockbar の業種切替。§1・§4-4）----
   業種は「どのデータを読むか」だけを変え、描画の分岐は増やさない（§2-3 を維持）。
   svcOf(id) だけは全件（visSvcs() ではなく SVCS 全体）から引く（§4-4）。 */
const ind = () => INDUSTRIES.find(i => i.id === state.industry);
const inInd = (x) => x.industries.includes(state.industry);
const visCats = () => CATS.filter(inInd).map(c => Object.assign({}, c, { subs: c.subs.filter(inInd) }));
const visSvcs = () => SVCS.filter(inInd);
const home = () => HOME[state.industry];
const feed = () => FEED[state.industry];

const catOf = (id) => visCats().find(c => c.id === id);
const subOf = (catId, subId) => { const c = catOf(catId); return c && c.subs.find(b => b.id === subId); };
const svcOf = (id) => SVCS.find(x => x.id === id);
const countSub = (subId) => visSvcs().filter(x => x.sub === subId).length;
const countCat = (catId) => visSvcs().filter(x => x.cat === catId).length;
/* st: 1 提供中 / 2 試行版 / 3 構想 */
const statusText = (st) => st === 1 ? t('statusLive') : st === 2 ? t('statusTrial') : t('statusConcept');
const statusClass = (st) => st === 1 ? 'live' : st === 2 ? 'trial' : 'concept';

const pad2 = (n) => String(n).padStart(2, '0');
/** サービス id → 管理番号（kn2 → KN-02）。表示のためだけの変換。データには持たせない */
const svcCode = (id) => {
  const m = /^([a-z]+)(\d+)$/.exec(id);
  return m ? `${m[1].toUpperCase()}-${pad2(m[2])}` : String(id).toUpperCase();
};

/* ---- NEW 表示（SVCS[].added。§2-3：state もデータも増やさず、その場で計算する） ----
   DEMO_DATE に 'YYYY-MM-DD' を入れるとその日を「今日」として固定できる（デモ当日に
   30 日を過ぎていても NEW を出し続けたいとき）。null なら実際の今日。
   コミットする既定値は null。固定したまま main に入れないこと（verify §7 が warn する） */
const NEW_DAYS = 30;
const DEMO_DATE = null;   // 例: '2026-09-20'
/** 今日（ローカル時刻）の 'YYYY-MM-DD'。DEMO_DATE があればそれを返す */
const today = () => {
  if (DEMO_DATE) return DEMO_DATE;
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
/** 追加日からの経過日数。added が無い / 解釈できないときは null */
const daysSince = (added) => {
  if (typeof added !== 'string') return null;
  const a = Date.parse(added + 'T00:00:00Z'), n = Date.parse(today() + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(n)) return null;
  return Math.floor((n - a) / 86400000);
};
/** NEW を出すか（追加日から NEW_DAYS 日以内。未来日も NEW 扱い） */
const isNew = (x) => { const d = daysSince(x && x.added); return d !== null && d < NEW_DAYS; };
/** 新着サービスを added の新しい順に返す（同日は SVCS の並び順を保つ＝安定ソート） */
const newSvcs = () => visSvcs().filter(isNew).sort((a, b) => (a.added < b.added ? 1 : a.added > b.added ? -1 : 0));

/** 分類アイコン。size は 'ic-sm'(16) / ''(20) / 'ic-lg'(24) / 'ic-xl'(28)
    未知の分類 id でも _fallback で必ず描ける（§2-9） */
const catIcon = (id, size) => `<svg class="ic ${size || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${(CAT_STYLE[id] || CAT_STYLE._fallback).icon}</svg>`;
/** 分類アクセント色を要素に載せるクラス。未定義分類は空文字＝既定色（--cat-accent）のまま */
const catClass = (id) => (CAT_STYLE[id] ? `cat-${id}` : '');

/** 現在の業種のヘッダーロゴ（会社ロゴ・PM 追加要件。currentColor で着色するため
    呼び出し側の CSS が色を決める。IND_LOGO に無い業種でも空の <svg> で壊れない） */
const indLogo = () => `<svg viewBox="0 0 32 24" aria-hidden="true" focusable="false">${(IND_LOGO[state.industry] || {}).icon || ''}</svg>`;

/** 入力テキストの言語を判定（ひらがな/カタカナ→ja、漢字のみ→zh、それ以外→UI言語）
    エージェントは UI 言語と無関係に日本語・中国語どちらの入力も受け付ける */
function detectLang(s) {
  if (/[぀-ヿ]/.test(s)) return 'ja';
  if (/[一-鿿]/.test(s)) return 'zh';
  return state.lang;
}
const countText = (n) => state.lang === 'en' ? (n + t('countUnit')) : (n + t('countUnit'));

/* ---- お気に入り（設計書 2026-09-08-favorites.md §2）----
   利用者ごとの状態。js/data/** には置かない（SVCS/HOME/FEED を汚さない＝added と同じ流儀）。
   業種をまたがない（state.fav[state.industry]）。表示順は常に SVCS のカタログ順（favList() の 1 本に集約）。 */
const favIds = () => state.fav[state.industry] || (state.fav[state.industry] = []);
const isFav = (id) => favIds().includes(id);
/** 現在業種で見えるお気に入りサービスをカタログ順で返す。件数・①一覧・②帯・③レールはすべてこれ 1 本を使う */
const favList = () => visSvcs().filter(x => favIds().includes(x.id));
/** あれば取り除き、無ければ末尾に足す。savePrefs() は呼び出し側（events.js）で呼ぶ */
function toggleFav(id) {
  const ids = favIds();
  const i = ids.indexOf(id);
  if (i >= 0) ids.splice(i, 1); else ids.push(id);
}

function filtered() {
  let list = visSvcs();
  if (state.favOnly) list = list.filter(x => isFav(x.id));
  if (state.selSub) list = list.filter(x => x.sub === state.selSub);
  else if (state.selCat) list = list.filter(x => x.cat === state.selCat);
  const q = state.query.trim().toLowerCase();
  if (q) {
    list = list.filter(x => {
      const hay = [x.name.ja, x.name.zh, x.name.en, x.desc.ja, x.desc.zh, x.desc.en,
                   ...x.tags.map(k => [TAGS[k].ja, TAGS[k].zh, TAGS[k].en].join(''))].join('');
      return hay.toLowerCase().indexOf(q) >= 0;
    });
  }
  return list;
}

/* ---- デモ（業務デモ画面）ヘルパー（§2-4） ---- */
/** demo view の agent 返答遅延タイマー。renderMain() 再実行時に消し忘れると
    連打・言語切替で古い #msgs へ二重に addMsg してしまうため保持する */
let demoReplyTimer = null;
/** Issue #39：エージェントが「処理している」感を出すための返答遅延パラメータ。
    delay = base + perChar*文字数 を min〜max にクランプ。PM が体感を見て調整してよい */
const DEMO_REPLY_MS = { base: 1200, perChar: 25, min: 1500, max: 3500 };
const demoDelay = (text) => Math.min(DEMO_REPLY_MS.max,
  Math.max(DEMO_REPLY_MS.min, DEMO_REPLY_MS.base + (text ? text.length : 0) * DEMO_REPLY_MS.perChar));
/** true の間、agent の返答は表示待ち（考え中）。send/chip/run はこの間無視して二重消費を防ぐ。
    scripted（state.log に積んだ台本ターン）の pending は renderMain() 再実行後も保持して再スケジュールするが、
    freeform（台本が尽きた後の汎用返答）の pending は再描画されたら諦める（msgs 自体が作り直されるため） */
let demoPending = false;
let demoPendingFreeform = false;
const scnOf = (id) => (SCENARIOS[state.industry] || {})[id] || null;
/** サービス id → LIVE のエントリ（あれば返す・無ければ null。設計書 2026-09-08-live-links.md §5-5） */
const liveOf = (id) => LIVE[id] || null;
/** 台本は ja / zh のみ。UI が en のときは ja の台本を使う（§2-5：エージェント本体は日中） */
const scriptLang = (l) => (l === 'zh' ? 'zh' : 'ja');
/** 次に消費する台本ターン（尽きていれば null） */
const nextTurn = (scn, lang) => scn.script[lang][state.log.length] || null;

function consume(lang, qOverride) {
  const scn = scnOf(state.selSvc); if (!scn) return false;
  const turn = nextTurn(scn, lang); if (!turn) return false;
  state.log.push({ lang, q: qOverride ?? turn.q, a: turn.a });
  return true;
}

/* ============================================================
   5. 設定の永続化（言語 / テーマ）
   ============================================================ */
function loadPrefs() {
  try {
    const lang = localStorage.getItem('mock.lang');
    const theme = localStorage.getItem('mock.theme');
    if (lang && ['ja', 'zh', 'en'].includes(lang)) state.lang = lang;
    if (theme && ['light', 'dark'].includes(theme)) state.theme = theme;
  } catch (e) { /* プライベートモード等では既定値のまま */ }

  /* ---- mock.fav（お気に入り。設計書 2026-09-08-favorites.md §2-5）----
     既存 2 キーの try とは別ブロックにする：mock.fav が壊れていても mock.lang / mock.theme の読み込みに影響させない */
  try {
    const raw = localStorage.getItem('mock.fav');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const indIds = new Set(INDUSTRIES.map(i => i.id));
        for (const key of Object.keys(parsed)) {
          if (!indIds.has(key)) continue;      // 業種キーは INDUSTRIES の id のみ受け入れる
          const arr = parsed[key];
          if (!Array.isArray(arr)) continue;   // 形が違えば何もしない（既定の空リストのまま）
          state.fav[key] = arr.filter(v => typeof v === 'string').slice(0, 200); // 1 業種 200 件で切る（安全弁）
        }
      }
    }
  } catch (e) { /* 壊れていても例外を投げず既定の空リストで起動する */ }
}
function savePrefs() {
  try {
    localStorage.setItem('mock.lang', state.lang);
    localStorage.setItem('mock.theme', state.theme);
    localStorage.setItem('mock.fav', JSON.stringify(state.fav));
  } catch (e) { /* 保存できなくても動作に影響なし */ }
}
function applyPrefs() {
  const root = document.documentElement;
  root.setAttribute('data-theme', state.theme);
  root.setAttribute('data-lang', state.lang);
  root.setAttribute('lang', state.lang);
  document.getElementById('lang-select').value = state.lang;
  const btn = document.getElementById('theme-btn');
  btn.textContent = state.theme === 'dark' ? '☀' : '☾';
  btn.title = state.theme === 'dark' ? t('themeToLight') : t('themeToDark');
}

