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
  industry: 'mfg',        // 'mfg' | 'fin' | 'it'。localStorage には保存しない（§4-5：pattern と同じ足場の一時状態）
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
  fav: { mfg: [], fin: [], it: [] },   // 業種ごとのお気に入り（SVCS[].id の配列。localStorage 'mock.fav' に保存。設計書 2026-09-08-favorites.md §2-2）
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
/** 台本と汎用発話の両方で、回答待ちを再描画後も保持する。 */
let demoPending = false;
let demoPendingFreeform = false;
let chatSessionEpoch = 0;
const chatCompose = { text: '', selectionStart: 0, selectionEnd: 0, attachmentVisible: false };
let chatComposeOwner = null;
let sentAttachments = new Map();
let extraChatHistory = [];
let extraChatSequence = 0;
const chatContextKey = () => `${state.industry}/${state.selSvc}`;
function chatCaptureDraft() {
  const input = document.getElementById('chat-input');
  if (!input || chatComposeOwner !== chatContextKey()) return;
  chatCompose.text = input.value;
  chatCompose.selectionStart = input.selectionStart ?? input.value.length;
  chatCompose.selectionEnd = input.selectionEnd ?? chatCompose.selectionStart;
}
function chatClearDraft() {
  chatCompose.text = ''; chatCompose.selectionStart = 0; chatCompose.selectionEnd = 0;
  const input = document.getElementById('chat-input');
  if (input) input.value = '';
}
function chatSetAttachmentVisible(visible) {
  chatCompose.attachmentVisible = visible; qaAttachmentVisible = visible;
}
function chatResetSession() {
  chatSessionEpoch++;
  if (demoReplyTimer) clearTimeout(demoReplyTimer);
  demoReplyTimer = null; demoPending = false; demoPendingFreeform = false;
  upPreviewClose(false); nmSummaryClose(false); upClear();
  for (const files of sentAttachments.values()) upRevokeFiles(files);
  sentAttachments = new Map(); extraChatHistory = []; extraChatSequence = 0;
  chatClearDraft(); chatComposeOwner = null; chatSetAttachmentVisible(false);
}
function chatAcceptAttachments(messageKey) {
  if (upFiles.length) {
    if (upPreview.open && upPreview.source === 'pending') upPreviewClose(false);
    sentAttachments.set(messageKey, upFiles);
    upFiles = [];
  }
  chatSetAttachmentVisible(false);
  chatClearDraft();
}
const scnOf = (id) => (SCENARIOS[state.industry] || {})[id] || null;
/** サービス id → LIVE のエントリ（あれば返す・無ければ null。設計書 2026-09-08-live-links.md §5-5） */
const liveOf = (id) => LIVE[id] || null;
/** 台本は ja / zh のみ。UI が en のときは ja の台本を使う（§2-5：エージェント本体は日中） */
const scriptLang = (l) => (l === 'zh' ? 'zh' : 'ja');
/** 次に消費する台本ターン（尽きていれば null） */
const nextTurn = (scn, lang) => scn.script[lang][state.log.length] || null;
/** 台本の回答が画面に出た数。汎用回答待ちは、完了済みの台本段階を戻さない。 */
const completedScriptTurns = () => Math.max(0, state.log.length - (demoPending && !demoPendingFreeform ? 1 : 0));

function consume(lang, qOverride) {
  const scn = scnOf(state.selSvc); if (!scn) return false;
  const turn = nextTurn(scn, lang); if (!turn) return false;
  state.log.push({ lang, q: qOverride ?? turn.q, a: turn.a });
  return true;
}

/* QA-01だけは依頼と回答を対応させる。logの形を保ち、A/Bの工程は別メタで追う。 */
let qaTurnMeta = [];
let qaAttachmentVisible = false;
const QA_CURRENT_NC = 'NC-2025-0912';
const QA_KNOWN_NCS = [QA_CURRENT_NC, 'NC-2024-0331', 'NC-2023-0207'];
const isQaChat = () => state.industry === 'mfg' && state.selSvc === 'qa1' && state.view === 'demo';
function qaResetConversation() { qaTurnMeta = []; gn2TurnMeta = []; gn2EntryRoute = null; chatResetSession(); }
function qaCompletedEntries() {
  const count = completedScriptTurns();
  return qaTurnMeta.slice(0, count).map((meta, index) => ({ meta, index, turn: state.log[index] }));
}
function qaLatestCompleted(route) {
  return qaCompletedEntries().filter(entry => !route || entry.meta.route === route).at(-1) || null;
}
const qaRecordStage = () => (qaLatestCompleted('record') || { meta: {} }).meta.step || 0;
function qaResultEntries() {
  const latest = new Map();
  for (const entry of qaCompletedEntries()) {
    if (entry.meta.route === 'record') latest.set('record', entry);
    else if (entry.meta.route === 'history') latest.set(`history-${entry.meta.step}`, entry);
  }
  return Array.from(latest.values()).sort((a, b) => b.index - a.index);
}
function qaValueMatches(text) {
  return {
    concentration: /(?:脱脂液)?(?:濃度|浓度)(?:\s|\*|は|を|が|[:：=]|(?:確定(?:値)?|确定)(?:は|为)?)*(\d+(?:\.\d+)?)(?![\d.])(?:\s|\*)*%?/.exec(text),
    stirring: /(?:撹拌(?:時間)?|搅拌(?:时间)?)(?:\s|\*|は|を|が|[:：=]|(?:確定(?:値)?|确定)(?:は|为)?)*(\d+(?:\.\d+)?)(?![\d.])(?:\s|\*)*(?:分|分钟)?/.exec(text),
    checker: /王(?:主任|磊|主管)/.exec(text)
  };
}
/** 確認用の対応例は2つの値だけ。訂正や別の数値を含む説明を最初の値で確定しない。 */
function qaConfirmationValuesAreClear(text) {
  if (/誤り|間違い|訂正|修正|更正|错误|纠正(?:为|成|后|数值|数字|浓度|时间)|否定|ではない|ではなく|不是|未確定|未確認|未确定|未确认|不明|待確認|待确认|要確認|要确认|わから|分から|不清楚|不确定|候補|候选/.test(text)) return false;
  const valueText = text.replace(/NC-\d{4}(?:-\d+)?/gi, '')
    .replace(/\b(?:\d{4}[-/])?\d{1,2}[-/]\d{1,2}\b/g, '')
    .replace(/\bD[1-8]\b/gi, '');
  const numbers = Array.from(valueText.matchAll(/\d+(?:\.\d+)?/g), match => Number(match[0]));
  return numbers.length === 2 && numbers.includes(3.8) && numbers.includes(12);
}
/** 人名の出現だけで確認者を決めない。原票の確認行為に結び付く対応表現に限定する。 */
function qaConfirmationCheckerIsClear(text) {
  const names = text.match(/王(?:主任|磊|主管)/g) || [];
  if (names.length !== 1 || /記入者|記入した|書いた|填写人|填写的|(?:不是|并非|不由)\s*王|していない|未確認|未确认|没有确认|はず|かもしれ|確認する予定|確認を依頼|确认计划|计划确认|准备确认|打算确认|请\s*王(?:主管|磊|主任)(?:确认|核对|查看)(?!了)/.test(text)) return false;
  const completedExpressions = [
    /王(?:主任|磊|主管)に原票を(?:見て|確認して|確かめて)もら(?:いました|った)(?:[。！？\n、]|$)/,
    /王(?:主任|磊|主管)が(?:\d{4}[/\-])?(?:\d{1,2}[/\-]\d{1,2}に)?(?:NC-\d{4}-\d{4}の)?原票(?:を|で)(?:確認(?:しました|した|済みです|済み)|確かめ(?:ました|た)|見(?:ました|た))(?:[。！？\n、]|$)/,
    /王(?:主任|磊|主管)が(?:\d{4}[/\-])?(?:\d{1,2}[/\-]\d{1,2}に)?(?:NC-\d{4}-\d{4}の)?原票(?:を|で)確認(?:[。！？\n]|$)/,
    /(?:请\s*)?王(?:主管|磊|主任)(?:已)?(?:看了|查看了|确认了|核对了)原始记录(?:[，。！？\n]|$)/,
    /王(?:主管|磊|主任)(?:已)?对照原始记录(?:确认了|核对了)(?:[，。！？\n]|$)/,
    /王(?:主管|磊|主任)(?:已)?对照原始记录确认(?:[。！？\n]|$)/,
    /(?:原票の)?確認者(?:は|[:：]|\s)*王(?:主任|磊|主管)(?:です|でした)?(?:[。！？\n、]|$)/,
    /(?:原始记录)?确认人(?:是|为|[:：]|\s)*王(?:主任|磊|主管)(?:[，。！？\n]|$)/
  ];
  const proof = completedExpressions.map(expression => expression.exec(text)).find(Boolean);
  if (!proof) return false;
  const afterProof = text.slice(proof.index + proof[0].length);
  if (/(?:確認者|确认人)/.test(proof[0]) && /^\s*(?:か|と|または|和|或|[／/])/.test(afterProof)) return false;
  const remaining = text.slice(0, proof.index) + text.slice(proof.index + proof[0].length);
  return !/主任|主管|係長|组长|課長|科长|確認者|确认人|確認したの|確認|确认|核对|查看|見てもら|見た|見ました|看了|看过/.test(remaining);
}
function qaInputPhrases(text, lang) {
  const scn = scnOf('qa1'), values = qaValueMatches(text);
  const phrases = (scn.inputHighlights[lang] || []).filter(phrase => text.includes(phrase));
  for (const match of text.matchAll(/記録したい|登録したい|記録して|登録して|记录|登记/g)) phrases.push(match[0]);
  for (const match of text.matchAll(/NC-\d{4}(?:-\d+)?/gi)) phrases.push(match[0]);
  for (const match of Object.values(values)) if (match) phrases.push(match[0].trimEnd());
  return Array.from(new Set(phrases));
}
function qaHistoryAnswer(scn, step, variant, lang) {
  const source = scn.historyScript[lang][step - 1];
  const suffix = source.variants && source.variants[variant];
  return source.a + (suffix ? ' ' + suffix.aSuffix : '');
}
function qaHistoryResult(scn, meta, lang) {
  const source = scn.historyScript[lang][meta.step - 1];
  const result = { ...source.result };
  if (result.rows) result.rows = result.rows.map(row => [...row]);
  if (result.items) result.items = result.items.map(item => ({ ...item }));
  const suffix = source.variants && source.variants[meta.variant];
  if (suffix && result.rows && result.rows[1]) result.rows[1][2] += ' ' + suffix.rowSuffix;
  return result;
}
function qaAppendRequest(q, lang, meta, a) {
  const entry = { route: meta.route, step: meta.step ?? null, action: meta.action,
    targetNc: meta.targetNc || null, variant: meta.variant || null,
    inputPhrases: qaInputPhrases(q, lang), outputRef: meta.outputRef };
  state.log.push({ lang, q, a }); qaTurnMeta.push(entry);
  demoPending = true; demoPendingFreeform = false;
  return true;
}
/** 対応例だけを扱うローカル規則。未対応の条件は確認し、次の台本へ勝手に進めない。 */
function qaSubmitRequest(q, lang) {
  if (!isQaChat() || demoPending || !q.trim()) return false;
  lang = scriptLang(lang);
  const scn = scnOf('qa1'), text = q.trim();
  const ncs = Array.from(text.matchAll(/NC-\d{4}(?:-\d+)?/gi), match => match[0].toUpperCase());
  const previous = qaLatestCompleted();
  const contextNc = previous && previous.meta.targetNc === QA_CURRENT_NC ? QA_CURRENT_NC : null;
  const targetNc = ncs.includes(QA_CURRENT_NC) ? QA_CURRENT_NC : ncs.length ? null : contextNc;
  const record = qaLatestCompleted('record');
  const recordTargetNc = ncs.includes(QA_CURRENT_NC) ? QA_CURRENT_NC : ncs.length ? null : record && record.meta.targetNc;
  const clarify = (key, action, target = targetNc) => qaAppendRequest(q, lang,
    { route: 'clarify', action, targetNc: target, outputRef: `clarify:${key}` }, scn.qaClarify[lang][key]);
  if (ncs.some(nc => !QA_KNOWN_NCS.includes(nc))) return clarify('unknown', 'unknown', ncs.find(nc => !QA_KNOWN_NCS.includes(nc)));
  const unsupportedDefect = /打痕|碰伤|ねじ|螺纹|割れ|开裂|膜厚|厚度不足/.test(text);
  if (/比較|比べ|照合|分析|比较|对比/.test(text)) {
    chatSetAttachmentVisible(false);
    if (unsupportedDefect || targetNc !== QA_CURRENT_NC) return clarify('compare', 'compare');
    const variant = qaRecordStage() >= 2 ? 'confirmed' : 'unconfirmed';
    return qaAppendRequest(q, lang, { route: 'history', step: 2, action: 'compare', targetNc, variant, outputRef: 'history:2' }, qaHistoryAnswer(scn, 2, variant, lang));
  }
  if (/探|検索|見つ|查找|搜索|检索|找/.test(text)) {
    chatSetAttachmentVisible(false);
    if (unsupportedDefect || (!ncs.length && !/塗装|ブツ|颗粒|涂装|脱脂液|フィルター|过滤器/.test(text) && !targetNc)) return clarify('search', 'search');
    return qaAppendRequest(q, lang, { route: 'history', step: 1, action: 'search', targetNc, outputRef: 'history:1' }, qaHistoryAnswer(scn, 1, null, lang));
  }
  if (/次に.*(?:資料|確認)|根拠.*確認|当時.*対策|下一步|要看的资料|依据.*确认|当时.*措施/.test(text)) {
    chatSetAttachmentVisible(false);
    if (!qaLatestCompleted('history') && !targetNc) return clarify('search', 'next');
    return qaAppendRequest(q, lang, { route: 'history', step: 3, action: 'next', targetNc, outputRef: 'history:3' }, qaHistoryAnswer(scn, 3, null, lang));
  }
  const confirm = /原票|原始记录|王主任|王磊|王主管/.test(text) && /確定|確認済|見てもら|確かめ|确定|确认|確認/.test(text);
  if (confirm) {
    const values = qaValueMatches(text);
    if (!qaRecordStage() || recordTargetNc !== QA_CURRENT_NC || !values.concentration || !values.stirring || !values.checker ||
      !qaConfirmationValuesAreClear(text) || !qaConfirmationCheckerIsClear(text) ||
      Number(values.concentration[1]) !== 3.8 || Number(values.stirring[1]) !== 12) return clarify('confirm', 'confirm', recordTargetNc);
    chatSetAttachmentVisible(true);
    return qaAppendRequest(q, lang, { route: 'record', step: 2, action: 'confirm', targetNc: recordTargetNc, outputRef: 'record:2' }, scn.script[lang][1].a);
  }
  if (/日中|中国語版|日本語版|双语|中文版|日文版|中日版本/.test(text)) {
    if (qaRecordStage() < 2 || recordTargetNc !== QA_CURRENT_NC) return clarify('confirm', 'bilingual', recordTargetNc);
    return qaAppendRequest(q, lang, { route: 'record', step: 3, action: 'bilingual', targetNc: recordTargetNc, outputRef: 'record:3' }, scn.script[lang][2].a);
  }
  if (/(?:写真|照片|画像|手書き).*(?:記録|记录|草案|報告|报告)|記録草案|不良记录草案|(?:記録|登録)(?:したい|して|を作|を残)|(?:制作|登记).*(?:记录|不良)|アップロード|上传/.test(text)) {
    chatSetAttachmentVisible(true);
    if (ncs.length && !ncs.includes(QA_CURRENT_NC)) return clarify('unknown', 'record', ncs[0]);
    if (!upFiles.some(file => file.kind === 'image')) return clarify('photos', 'record', targetNc);
    return qaAppendRequest(q, lang, { route: 'record', step: 1, action: 'record', targetNc: QA_CURRENT_NC, outputRef: 'record:1' }, scn.script[lang][0].a);
  }
  return clarify('purpose', 'unknown');
}

/* GN-02の受領発票と集金予定表は、同じlogの外でそれぞれの工程を追う。 */
let gn2TurnMeta = [];
let gn2EntryRoute = null;
const isGn2Chat = () => state.industry === 'mfg' && state.selSvc === 'gn2' && state.view === 'demo';
/** 集金予定表の入口は、送信前の依頼と既知のサンプル2件をまとめて用意する。 */
function gn2PrepareCollectionDemo() {
  if (!isGn2Chat()) return;
  const scn = scnOf('gn2'), lang = scriptLang(state.lang);
  gn2EntryRoute = 'ar';
  const q = scn.collectionSchedule.script[lang][0].q;
  chatCompose.text = q; chatCompose.selectionStart = q.length; chatCompose.selectionEnd = q.length;
  upUseSample(scn, lang);
  chatSetAttachmentVisible(true);
}
function gn2CompletedEntries() {
  return gn2TurnMeta.slice(0, completedScriptTurns()).map((meta, index) => ({ meta, index, turn: state.log[index] }));
}
function gn2LatestCompleted(route) {
  return gn2CompletedEntries().filter(entry => route ? entry.meta.route === route : entry.meta.route !== 'clarify').at(-1) || null;
}
const gn2RouteStage = route => (gn2LatestCompleted(route) || { meta: {} }).meta.step || 0;
function gn2RouteIntent(text) {
  const scn = scnOf('gn2');
  const canonicalAP = ['ja', 'zh'].some(lang => scn.script[lang].some(turn => turn.q === text.trim()));
  const ar = /集金|回収予定|入金予定|納品書を集計|收款计划|回款计划|INV-D\d+/i.test(text);
  const ap = canonicalAP || /受領発票|発注|入庫|三点照合|仕訳|会計登録|进项发票|采购订单|入库|三单匹配|记账|财务系统|支払予定|付款/.test(text);
  return ar && ap ? 'ambiguous' : ar ? 'ar' : ap ? 'ap' : null;
}
function gn2InputForDraft(scn, lang) {
  const intent = gn2RouteIntent(chatCompose.text), previous = gn2LatestCompleted();
  return intent === 'ap' || (!intent && previous && previous.meta.route === 'ap') ? scn.input[lang] : scn.collectionSchedule.input[lang];
}
function gn2CollectionSampleMatches(files) {
  const collection = scnOf('gn2').collectionSchedule;
  const assets = collection.input.ja.assets;
  return files.length === assets.length && assets.every(asset => files.some(file => file.kind === 'doc' && file.src === asset.file && file.sampleId === collection.sampleId));
}
function gn2CollectionConfirmationIsClear(raw) {
  const text = raw.replace(/\*\*/g, '').trim();
  const ids = Array.from(text.matchAll(/INV-D\d+\b/gi), match => match[0].toUpperCase());
  if (!ids.length || ids.some(id => id !== 'INV-D04')) return false;
  const years = new Set(Array.from(text.matchAll(/(?:^|[^\d])((?:19|20)\d{2})(?!\d)/g), match => Number(match[1])));
  if (years.size > 1 || Array.from(years).some(year => year !== 2025)) return false;
  const dates = Array.from(text.matchAll(/(?:(\d{4})(?:年|[/-]))?(\d{1,2})(?:月|[/-])(\d{1,2})(?:日|号)?/g));
  if (!dates.length || dates.some(match => (match[1] && Number(match[1]) !== 2025) || Number(match[2]) !== 9 || Number(match[3]) !== 30)) return false;
  if (/未確認|未確定|確認できません|確認できない|確認する予定|確認予定|確認するつもり|かもしれ|ではない|ではありません|訂正|誤り|尚未|未确认|未确定|无法确认|不能确认|准备确认|计划确认|不是|并非|是否|降順|金額順|請求番号順|按金额|按编号|降序|USD|JPY|ドル|人民元以外|円建て|取消.*(?:含め|入れ)|重複.*(?:含め|残して)/.test(text)) return false;
  if (/金額(?:の|が|を|で)?(?:大きい|小さい|多い|少ない|高い|低い|昇順|降順|順)|(?:按|依|以)金额|金额(?:从大到小|从小到大|大小|降序|升序|排序)|(?:入金予定日|日付)(?:の|が)?(?:新しい|遅い|後|降順)|(?:日期|预计收款日).*(?:从晚到早|倒序|降序)|まとめ(?:ない|ず)|集約しない|不(?:要|用)?(?:合并|汇总)|无需合并|按账单|(?:日付順|入金予定日順).*(?:または|どちら|それとも)|日期.*(?:还是|或者)/.test(text)) return false;
  if (/(?:金額|金额|amount)[^。！？!?.\n]*?(?:順|排序|sort|高い|大きい|小さい|降順|昇順|升序|降序|从大|从小|最大|最小|高|低)/i.test(text)) return false;
  if (/間違(?:い|って)(?:でした|いた|います)|確認(?:結果)?(?:は|が)?(?:間違|誤)|確認(?:結果)?(?:を|は|が)(?:取り消|撤回|無効)|确认结果(?:有误|错误|不正确)|(?:撤销|撤回|取消)(?:了)?(?:该|这一|此)?确认|确认(?:结果)?(?:已|要|被|予以)?(?:撤销|撤回|取消)|没有(?:完成)?确认|未曾确认|確認していません|確認していない|確認したわけでは|確認できたわけでは/.test(text)) return false;
  if (/(?:順|排序|sort|highest|lowest)[^。！？!?.\n]*?(?:金額|金额|amount)|(?:金額|金额|amount)[^。！？!?.\n]*?(?:highest|lowest)/i.test(text)) return false;
  const date = '(?:2025(?:年|[/-]))?0?9(?:月|[/-])30(?:日|号)?';
  const completed = [
    new RegExp('INV-D04\\b\\s*(?:の\\s*入金予定日|の\\s*日付)?\\s*(?:は|が|を)?\\s*' + date + '(?:で|と|に|だと)?(?:確認できました|確認しました|確認済みです|確認済み|照合しました|照合済みです|確定しました)(?:[。！\\n、]|$)'),
    new RegExp('INV-D04\\b\\s*(?:的\\s*(?:预计收款日|日期))?\\s*(?:已确认|已核对)(?:是|为)\\s*' + date + '(?:[。！\\n，]|$)'),
    new RegExp('INV-D04\\b\\s*(?:的\\s*(?:预计收款日|日期))?\\s*(?:是|为)\\s*' + date + '[，,]\\s*(?:已确认|已核对)(?:[。！\\n，]|$)')
  ];
  return completed.some(pattern => pattern.test(text));
}
function gn2AppendRequest(q, lang, route, step, outputRef, sampleId, a) {
  state.log.push({ lang, q, a });
  gn2TurnMeta.push({ route, step, outputRef, sampleId: sampleId || null });
  demoPending = true; demoPendingFreeform = false;
  return true;
}
function gn2SubmitRequest(q, lang) {
  if (!isGn2Chat() || demoPending || upReading || !q.trim()) return false;
  lang = scriptLang(lang);
  const scn = scnOf('gn2'), collection = scn.collectionSchedule;
  const intent = gn2RouteIntent(q), previous = gn2LatestCompleted();
  const route = intent || (previous && previous.meta.route);
  const clarify = (key, target = route) => gn2AppendRequest(q, lang, 'clarify', null, `clarify:${target || 'unknown'}-${key}`, null, collection.clarify[lang][key]);
  if (!route || route === 'ambiguous') return clarify('purpose');
  if (route === 'ap') {
    if (gn2CollectionSampleMatches(upFiles)) return clarify('purpose');
    const step = gn2RouteStage('ap') + 1, turn = scn.script[lang][step - 1];
    if (!turn) return clarify('done');
    return gn2AppendRequest(q, lang, 'ap', step, `ap:${step}`, null, turn.a);
  }
  const stage = gn2RouteStage('ar');
  if (upFiles.length && !gn2CollectionSampleMatches(upFiles)) return clarify('sample');
  if (!stage) {
    if (!gn2CollectionSampleMatches(upFiles)) return clarify('sample');
    if (/INV-D\d+|確認|核对|确认/.test(q)) return clarify('confirm');
    return gn2AppendRequest(q, lang, 'ar', 1, 'ar:1', collection.sampleId, collection.script[lang][0].a);
  }
  if (stage >= 2) return clarify('done');
  if (!gn2CollectionConfirmationIsClear(q)) return clarify('confirm');
  return gn2AppendRequest(q, lang, 'ar', 2, 'ar:2', collection.sampleId, collection.script[lang][1].a);
}

/* ---- アップロード部品（設計書 2026-09-16-showcase-demo.md §10）----
   載っているファイルの表示用メタ。state には入れない（§2-3：state の必須キー一覧を動かさないため）。
   言語切替の再描画では作り直されないので、会話ログ（state.log）と同じくそのまま復元される。
   読み取り（OCR/STT）はしない。実行結果は台本（SCENARIOS[].result）から出す。 */
let upFiles = [];
let upReadEpoch = 0;
let upReading = 0;
const upOwnedURLs = new Set();
/* 対象バッチは未送信か、発話に対応する送信済み参照から解決する。 */
const upPreview = {
  open: false, index: -1, originIndex: -1, zoom: 100, origin: null, service: null,
  source: 'pending', messageKey: null, status: 'loading', background: null
};
const UP_PREVIEW_ZOOMS = [100, 150, 200, 300, 400];
const upPreviewFiles = () => upPreview.source === 'sent' ? (sentAttachments.get(upPreview.messageKey) || []) : upFiles;
function upPreviewImageIndices() {
  return upPreviewFiles().map((f, i) => f.kind === 'image' ? i : -1).filter(i => i >= 0);
}
function upPreviewValidIndex(index) {
  const files = upPreviewFiles();
  return Number.isInteger(index) && index >= 0 && index < files.length && files[index].kind === 'image';
}
function upPreviewOpen(index, origin, source = 'pending', messageKey = null) {
  if (upPreview.open) return;
  upPreview.source = source === 'sent' ? 'sent' : 'pending'; upPreview.messageKey = messageKey;
  if (!upPreviewValidIndex(index) || upPreview.open) return;
  chatCaptureDraft();
  nmSummaryClose(false);
  upPreview.index = index; upPreview.originIndex = index; upPreview.zoom = 100; upPreview.origin = origin;
  upPreview.service = state.selSvc; upPreview.status = 'loading';
  upPreview.background = {
    bodyOverflow: document.body.style.overflow,
    rootOverflow: document.documentElement.style.overflow,
    x: window.scrollX, y: window.scrollY
  };
  const dialog = upPreviewEnsureDialog();
  upPreview.open = true;
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  dialog.showModal();
  upPreviewRenderImage();
  dialog.querySelector('[data-up="preview-close"]').focus({ preventScroll: true });
}
/** close / Esc / 外部からの dialog.close() に共通の復帰。消える入力パネルへは戻さない。 */
function upPreviewFinish(restoreFocus = true) {
  if (!upPreview.open) return;
  const { origin, originIndex, source, messageKey, background } = upPreview;
  upPreview.open = false; upPreview.index = -1; upPreview.originIndex = -1; upPreview.origin = null; upPreview.service = null;
  upPreview.zoom = 100; upPreview.status = 'loading'; upPreview.background = null;
  const image = document.querySelector('#up-preview .up-preview-image');
  if (image) { image.removeAttribute('src'); image.hidden = true; }
  if (background) {
    document.body.style.overflow = background.bodyOverflow;
    document.documentElement.style.overflow = background.rootOverflow;
  }
  if (restoreFocus) {
    const targets = [origin, document.querySelector(`[data-up="preview"][data-up-source="${source}"][data-up-key="${messageKey || ''}"][data-up-index="${originIndex}"]`),
      document.querySelector('[data-up="qa-attach"]'),
      document.querySelector('.panel [data-up="sample"], .panel [data-up="clear"], .panel .upzone')];
    const target = targets.find(element => element && element.isConnected && !element.closest('[hidden]'));
    if (target) target.focus({ preventScroll: true });
  }
  if (background) window.scrollTo(background.x, background.y);
}
function upPreviewClose(restoreFocus = true) {
  const dialog = document.getElementById('up-preview');
  if (dialog && dialog.open) dialog.close();
  upPreviewFinish(restoreFocus);
}
function upPreviewMove(delta) {
  if (!upPreview.open) return;
  const indices = upPreviewImageIndices();
  const next = indices[indices.indexOf(upPreview.index) + delta];
  if (!upPreviewValidIndex(next)) return;
  upPreview.index = next; upPreview.zoom = 100; upPreview.status = 'loading';
  upPreviewRenderImage();
}
function upPreviewZoom(delta) {
  if (!upPreview.open || upPreview.status !== 'ready') return;
  const next = UP_PREVIEW_ZOOMS[UP_PREVIEW_ZOOMS.indexOf(upPreview.zoom) + delta];
  if (!next) return;
  upPreview.zoom = next;
  upPreviewRenderSize();
  upPreviewRenderLabels();
}
function upPreviewFit() {
  if (!upPreview.open) return;
  upPreview.zoom = 100;
  upPreviewRenderSize(true);
  upPreviewRenderLabels();
}
/** ファイル名の拡張子から表示用の種別を推定する（image / audio / doc）。未知の拡張子は doc 扱い */
function upKindOf(name) {
  const n = String(name).toLowerCase();
  if (/\.(jpe?g|png|gif|webp)$/.test(n)) return 'image';
  if (/\.(wav|mp3|m4a|ogg)$/.test(n)) return 'audio';
  return 'doc';
}
/** 載せたファイルを全部外す。作成済みの objectURL は破棄する（§10-1） */
function upRevokeFiles(files) {
  files.forEach(f => {
    if (f.objectUrl && upOwnedURLs.delete(f.objectUrl)) URL.revokeObjectURL(f.objectUrl);
  });
}
function upClear() {
  if (upPreview.open && upPreview.source === 'pending') upPreviewClose(false);
  upReadEpoch++; upReading = 0;
  upRevokeFiles(upFiles);
  upFiles = [];
}
/** ユーザーが選んだ FileList を upFiles に積む。画像は FileReader で DataURL、音声は
    URL.createObjectURL、それ以外は名前だけのチップにする（fetch() は使わない＝§2-8。送らない・保存しない＝§2-6）。
    非同期の読み込みがすべて終わったら done() を呼ぶ（呼び出し側の events.js が再描画する） */
function upAddFiles(fileList, done) {
  if (demoPending) return;
  const files = Array.from(fileList || []);
  if (!files.length) { done(); return; }
  const epoch = upReadEpoch, batch = upFiles;
  upReading += files.length;
  let remaining = files.length;
  const current = () => epoch === upReadEpoch && batch === upFiles;
  const settle = () => {
    if (!current()) return;
    upReading--; remaining--;
    if (remaining === 0) done();
  };
  files.forEach((file) => {
    const kind = upKindOf(file.name);
    if (kind === 'image') {
      const reader = new FileReader();
      reader.onload = () => { if (current()) { batch.push({ name: file.name, kind, src: String(reader.result) }); settle(); } };
      reader.onerror = () => { if (current()) { batch.push({ name: file.name, kind: 'doc', src: '' }); settle(); } };
      reader.readAsDataURL(file);
    } else if (kind === 'audio') {
      const url = URL.createObjectURL(file);
      upOwnedURLs.add(url);
      batch.push({ name: file.name, kind, src: url, objectUrl: url });
      settle();
    } else {
      upFiles.push({ name: file.name, kind: 'doc', src: '' });
      settle();
    }
  });
}
/** 「サンプルを使う」：台本の input[lang].assets のパスをそのまま upFiles に積む（相対パスのまま。fetch() は使わない） */
function upUseSample(scn, lang) {
  if (demoPending) return;
  chatCaptureDraft();
  const inp = isGn2Chat() ? gn2InputForDraft(scn, lang) : scn && scn.input && scn.input[lang];
  if (!inp || !Array.isArray(inp.assets)) return;
  upClear();
  inp.assets.forEach((a, i) => {
    upFiles.push({ name: (inp.files && inp.files[i]) || a.file.split('/').pop(), kind: a.kind, src: a.file,
      ...(a.download ? { download: a.download } : {}), ...(a.sampleId ? { sampleId: a.sampleId } : {}) });
  });
}

/* NM-05まとめは画面表示のみ。台本の最終回答が表示された後に開く。 */
const nmSummary = { open: false, origin: null, background: null };
function nmSummaryCanOpen() {
  if (state.industry !== 'mfg' || state.selSvc !== 'nm5' || state.view !== 'demo' || demoPending) return false;
  const scn = scnOf(state.selSvc);
  return scn && scn.summary && state.log.some(turn => {
    const turns = scn.script[turn.lang];
    return turns && turns.length && turns[turns.length - 1].a === turn.a;
  });
}
function nmSummaryOpen(origin) {
  if (!nmSummaryCanOpen() || nmSummary.open) return;
  upPreviewClose(false);
  const dialog = nmSummaryEnsureDialog();
  nmSummary.origin = origin;
  nmSummary.background = {
    bodyOverflow: document.body.style.overflow,
    rootOverflow: document.documentElement.style.overflow,
    x: window.scrollX, y: window.scrollY
  };
  nmSummary.open = true;
  document.body.style.overflow = 'hidden';
  document.documentElement.style.overflow = 'hidden';
  nmSummaryRenderContent();
  dialog.showModal();
  dialog.querySelector('[data-nm-summary="close"]').focus({ preventScroll: true });
}
function nmSummaryFinish(restoreFocus = true) {
  if (!nmSummary.open) return;
  const { origin, background } = nmSummary;
  nmSummary.open = false; nmSummary.origin = null; nmSummary.background = null;
  if (background) {
    document.body.style.overflow = background.bodyOverflow;
    document.documentElement.style.overflow = background.rootOverflow;
  }
  if (restoreFocus) {
    const target = (origin && origin.isConnected && origin) || document.querySelector('[data-nm-summary="open"]');
    if (target) target.focus({ preventScroll: true });
  }
  if (background) window.scrollTo(background.x, background.y);
}
function nmSummaryClose(restoreFocus = true) {
  const dialog = document.getElementById('nm-summary');
  if (dialog && dialog.open) dialog.close();
  nmSummaryFinish(restoreFocus);
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
    if (raw === null) {
      state.fav.mfg = ['qa1', 'nm5'];
      localStorage.setItem('mock.fav', JSON.stringify(state.fav));
    } else if (raw) {
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

