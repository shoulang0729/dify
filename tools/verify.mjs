#!/usr/bin/env node
/**
 * tools/verify.mjs — 静的検証ハーネス（CLAUDE.md §2 load-bearing の機械検出）
 *
 * 使い方:  node tools/verify.mjs
 * 終了コード: 0 = 全 PASS / 1 = 1つ以上 FAIL
 *
 * チェック項目（設計書 docs/handoff/2026-09-07-split-catalog.md §4-2。PR-B でファイル分割対応）:
 *   1.   JS 構文（各 JS ファイルを個別に node --check）
 *   1-A. （新規）二重宣言：全 JS を <script src> の順に連結して node --check
 *   1-B. （新規）読み込み契約：実ファイル存在／相対パスのみ／scenarios タグ集合＝ディレクトリの *.js 集合／
 *        読み込み順／catalog.html に <style> が 0 個
 *   2.   i18n キー集合の一致（T / TAGS / PATTERNS / CATS / SVCS / TEMPLATES が ja/zh/en を全て持ち、空でない。en にかな残りなし）
 *   3.   未定義キー参照（t('key') / T.key が T に存在するか。全 JS ファイルの連結テキストを対象）
 *   4.   未使用キー（T にあるがどこからも参照されない）※警告扱い（FAIL にしない）
 *   5.   CSS トークン（mock/css/tokens.css・mock/css/components.css を直接読む。var(--x) が定義済みか / dark ブロック存在 / コンポーネント CSS に色直値なし / --ntt-* が dark で上書きされていない）
 *   5-A. index.html のトークン非コピー（mock/index.html が css/tokens.css を <link> し、トークン定義のコピーを持たない）
 *   6.   データ整合（SVCS の cat/sub が CATS に存在、tags が TAGS に存在、st ∈ {1,2,3}、added は YYYY-MM-DD、管理番号重複なし）
 *   7.   共通レイヤー契約（state の必須キー / data-act 一覧 / detectLang 存在 / localStorage キー）。
 *        対象は js/app.js + js/render.js + js/events.js（あれば）＋ catalog.html のインライン <script>（PR-C 前提）
 *   8.   Pages 設定（pages.yml の path: mock / mock/.nojekyll / mock/ 直下に _ 始まりディレクトリが無い）
 *   9.   シナリオ整合（SCENARIOS の id が SVCS に存在／template が TEMPLATES に存在／id 接頭＝ファイル名／台本の無い SVCS は warn）
 *   10.  ホームデータ整合（HOME / FEED）
 *
 * データの取り出しは tools/lib/load.mjs（node:vm で js/data/** を実行順に評価）を使う。
 * grab()（正規表現抽出）は廃止。
 */
import { readFileSync, existsSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMock } from './lib/load.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MOCK = resolve(ROOT, 'mock');
const HTML = resolve(MOCK, 'catalog.html');
const LANGS = ['ja', 'zh', 'en'];

let fails = 0, warns = 0;
const ok   = (m) => console.log('✅', m);
const fail = (m) => { fails++; console.log('❌', m); };
const warn = (m) => { warns++; console.log('⚠️ ', m); };
const section = (t) => console.log(`\n── ${t} ──`);

if (!existsSync(HTML)) { fail(`not found: ${HTML}`); process.exit(1); }

const mock = loadMock(ROOT);
const { html, indexHtml, cssLinks, scriptSrcs, tokenCss, componentCss, jsSources, dataSources, appSources, data, vmErrors } = mock;
const { T, PATTERNS, TAGS, TEMPLATES, CATS, SVCS, CAT_STYLE, HOME, FEED, SCENARIOS } = data;

// 全 JS（データ層 + アプリ層）の連結テキスト。§3/4（未定義・未使用キー参照）と §1-A（二重宣言）で使う
const allJsInOrder = [...dataSources, ...appSources];
const allJsText = allJsInOrder.map(f => f.src).join('\n');
// アプリ層（state/data-act/detectLang/localStorage）だけの連結テキスト。§7 で使う
const appText = appSources.map(f => f.src).join('\n');

/* ---------- 1. JS 構文（ファイルごと） ---------- */
section('1. JS 構文（ファイルごと）');
if (vmErrors.length) { for (const e of vmErrors) fail(`js/data/**: ${e}`); }
{
  let bad = 0;
  for (const f of allJsInOrder) {
    const isRealFile = existsSync(resolve(MOCK, f.path));
    const tmp = isRealFile ? resolve(MOCK, f.path) : resolve(ROOT, 'tools/.verify-tmp-inline.js');
    if (!isRealFile) writeFileSync(tmp, f.src);
    try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
    catch (e) { fail(`node --check FAIL: ${f.path}\n` + String(e.stderr || e.message)); bad++; }
    finally { if (!isRealFile && existsSync(tmp)) unlinkSync(tmp); }
  }
  if (!bad && allJsInOrder.length) ok(`node --check PASS（${allJsInOrder.length} ファイル）`);
  if (!allJsInOrder.length) fail('JS ファイルが 1 つも見つからない');
}

/* ---------- 1-A. 二重宣言（全 JS を連結して node --check） ---------- */
section('1-A. 二重宣言（全 JS 連結）');
{
  const tmp = resolve(ROOT, 'tools/.verify-tmp-concat.js');
  writeFileSync(tmp, allJsText);
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); ok('全 JS 連結 node --check PASS（二重宣言なし）'); }
  catch (e) { fail('全 JS 連結 node --check FAIL（二重宣言などの可能性）\n' + String(e.stderr || e.message)); }
  finally { if (existsSync(tmp)) unlinkSync(tmp); }
}

/* ---------- 1-B. 読み込み契約 ---------- */
section('1-B. 読み込み契約');
{
  let bad = 0;
  // ① 実ファイルが存在
  for (const src of scriptSrcs) {
    if (!existsSync(resolve(MOCK, src))) { fail(`<script src="${src}">: 実ファイルが無い`); bad++; }
  }
  // ② パスが相対（先頭 / も ../ も禁止）
  for (const src of scriptSrcs) {
    if (src.startsWith('/') || src.includes('../')) { fail(`<script src="${src}">: 相対パスでない`); bad++; }
  }
  if (!bad) ok(`<script src> ${scriptSrcs.length} 本すべて実ファイル・相対パス`);

  // ③ js/data/scenarios/ のタグ集合＝ディレクトリの *.js 集合
  const scenDir = resolve(MOCK, 'js/data/scenarios');
  if (!existsSync(scenDir)) { fail('mock/js/data/scenarios/ が無い'); bad++; }
  else {
    const dirFiles = new Set(readdirSync(scenDir).filter(f => f.endsWith('.js')));
    const taggedFiles = new Set(scriptSrcs.filter(s => s.startsWith('js/data/scenarios/')).map(s => basename(s)));
    const missingFromTags = [...dirFiles].filter(f => !taggedFiles.has(f));
    const missingFromDir = [...taggedFiles].filter(f => !dirFiles.has(f));
    if (missingFromTags.length) { fail(`scenarios/ にあるが <script src> に無い: ${missingFromTags.join(', ')}`); bad++; }
    if (missingFromDir.length) { fail(`<script src> にあるが scenarios/ に無い: ${missingFromDir.join(', ')}`); bad++; }
    if (!missingFromTags.length && !missingFromDir.length) ok(`scenarios/ の *.js ${dirFiles.size} 個 ＝ <script src> のタグ集合`);
  }

  // ④ 読み込み順が data/ui → data/catalog → data/home → data/style → data/scenarios/*（設計順）→（app/render/events。PR-C 以降）
  const scenarioOrder = ['kn', 'qa', 'dc', 'lg', 'nm', 'en', 'gn', 'pt'];
  const expectedDataOrder = [
    'js/data/ui.js', 'js/data/catalog.js', 'js/data/home.js', 'js/data/style.js',
    ...scenarioOrder.map(p => `js/data/scenarios/${p}.js`)
  ];
  const actualDataOrder = scriptSrcs.filter(s => s.startsWith('js/data/'));
  if (JSON.stringify(actualDataOrder) !== JSON.stringify(expectedDataOrder)) {
    fail(`<script src> の順序が設計書 §2-1 と異なる:\n   期待: ${expectedDataOrder.join(' → ')}\n   実際: ${actualDataOrder.join(' → ')}`);
    bad++;
  } else ok('<script src> の順序が設計書 §2-1 と一致（data/ui → data/catalog → data/home → data/style → data/scenarios/*）');
  // app/render/events が存在する場合（PR-C 以降）は data/* の後ろに来ていること
  const appTags = scriptSrcs.filter(s => !s.startsWith('js/data/'));
  const lastDataIdx = Math.max(...expectedDataOrder.map(s => scriptSrcs.indexOf(s)));
  for (const s of appTags) {
    if (scriptSrcs.indexOf(s) < lastDataIdx) { fail(`<script src="${s}">: データ層より前に読み込まれている`); bad++; }
  }

  // ⑤ catalog.html に <style> ブロックが 0 個（PR-A の帰結。PR-B でも維持を再確認）
  const styleCount = [...html.matchAll(/<style>/g)].length;
  if (styleCount !== 0) { fail(`catalog.html に <style> ブロックが ${styleCount} 個残っている`); bad++; }

  // js/data/** に document・localStorage・関数呼び出し（純粋なリテラル以外）が無いこと
  for (const f of dataSources) {
    const body = f.src;
    if (/\bdocument\./.test(body)) { fail(`${f.path}: document 参照がある（純粋なリテラルのみの制約に違反）`); bad++; }
    if (/\blocalStorage\b/.test(body)) { fail(`${f.path}: localStorage 参照がある（純粋なリテラルのみの制約に違反）`); bad++; }
  }
  if (!bad) ok('js/data/** は純粋なリテラル宣言のみ（document / localStorage なし）');
}

/* ---------- 2. i18n キー集合 ---------- */
section('2. i18n キー集合（ja / zh / en）');
const kana = /[぀-ヿ]/;
let i18nBad = 0;
const checkML = (obj, label) => {
  for (const l of LANGS) {
    if (!obj || typeof obj[l] !== 'string' || !obj[l].trim()) { fail(`${label}: ${l} が欠落/空`); i18nBad++; }
  }
  if (obj && obj.en && kana.test(obj.en)) { fail(`${label}: en にかなが残っている → "${obj.en}"`); i18nBad++; }
};
if (T) for (const k in T) checkML(T[k], `T.${k}`);
if (TAGS) for (const k in TAGS) checkML(TAGS[k], `TAGS.${k}`);
if (PATTERNS) for (const p of PATTERNS) { checkML(p.name, `PATTERNS.${p.id}.name`); checkML(p.desc, `PATTERNS.${p.id}.desc`); }
if (CATS) for (const c of CATS) {
  checkML(c.name, `CATS.${c.id}.name`); checkML(c.abbr, `CATS.${c.id}.abbr`);
  for (const s of c.subs) checkML(s.name, `CATS.${c.id}.subs.${s.id}.name`);
}
if (SVCS) for (const s of SVCS) { checkML(s.name, `SVCS.${s.id}.name`); checkML(s.desc, `SVCS.${s.id}.desc`); }
if (TEMPLATES) for (const k in TEMPLATES) { checkML(TEMPLATES[k].name, `TEMPLATES.${k}.name`); checkML(TEMPLATES[k].desc, `TEMPLATES.${k}.desc`); }
if (SCENARIOS) for (const id in SCENARIOS) {
  const scn = SCENARIOS[id];
  checkML(scn.persona.name, `SCENARIOS.${id}.persona.name`);
  checkML(scn.persona.role, `SCENARIOS.${id}.persona.role`);
  checkML(scn.persona.site, `SCENARIOS.${id}.persona.site`);
  for (const l of LANGS) {
    if (!Array.isArray(scn.steps[l]) || !scn.steps[l].length) { fail(`SCENARIOS.${id}.steps.${l}: 欠落/空`); i18nBad++; }
  }
}
if (i18nBad === 0 && T && TAGS && PATTERNS && CATS && SVCS && TEMPLATES && SCENARIOS)
  ok(`全辞書 3 言語一致（T=${Object.keys(T).length} TAGS=${Object.keys(TAGS).length} PATTERNS=${PATTERNS.length} CATS=${CATS.length} SVCS=${SVCS.length} TEMPLATES=${Object.keys(TEMPLATES).length}）`);

/* ---------- 3. 未定義キー / 4. 未使用キー ---------- */
section('3. 未定義キー参照 / 4. 未使用キー');
if (T) {
  const refs = new Set();
  for (const m of allJsText.matchAll(/\bt\(\s*'([A-Za-z0-9_]+)'\s*\)/g)) refs.add(m[1]);
  for (const m of allJsText.matchAll(/\bT\.([A-Za-z0-9_]+)\b/g)) refs.add(m[1]);
  const undef = [...refs].filter(k => !(k in T));
  if (undef.length) fail(`未定義キー参照: ${undef.join(', ')}`); else ok(`未定義キー参照なし（参照 ${refs.size} 件）`);
  const unused = Object.keys(T).filter(k => !refs.has(k));
  if (unused.length) warn(`未使用キー: ${unused.join(', ')}`); else ok('未使用キーなし');
}

/* ---------- 5. CSS トークン ---------- */
section('5. CSS トークン');
{
  const TOKENS_CSS = resolve(MOCK, 'css/tokens.css');
  const COMPONENTS_CSS = resolve(MOCK, 'css/components.css');
  if (!existsSync(TOKENS_CSS)) fail(`not found: ${TOKENS_CSS}`);
  if (!existsSync(COMPONENTS_CSS)) fail(`not found: ${COMPONENTS_CSS}`);

  const defined = new Set([...tokenCss.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(m => m[1]));
  const used = new Set([...(tokenCss + componentCss).matchAll(/var\((--[a-z0-9-]+)/gi)].map(m => m[1]));
  const undef = [...used].filter(v => !defined.has(v));
  if (undef.length) fail(`未定義の CSS 変数: ${undef.join(', ')}`); else ok(`var() 参照 ${used.size} 件すべて定義済み`);

  const darkBlock = tokenCss.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\}/);
  if (!darkBlock) fail(':root[data-theme="dark"] ブロックがない');
  else {
    const brandOverridden = [...darkBlock[1].matchAll(/(--ntt-[a-z0-9-]+)\s*:/g)].map(m => m[1]);
    if (brandOverridden.length) fail(`dark でブランドパレットを上書きしている: ${brandOverridden.join(', ')}`);
    else ok('dark ブロックあり・--ntt-* は不変');
  }

  // コンポーネント CSS の色直値（コメント除去後）
  const stripped = componentCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const hex = [...stripped.matchAll(/#[0-9a-f]{3,8}\b/gi)].map(m => m[0]);
  if (hex.length) fail(`コンポーネント CSS に色の直値: ${[...new Set(hex)].join(', ')}`); else ok('コンポーネント CSS に色の直値なし');

  for (const l of LANGS) {
    if (!new RegExp(`:root\\[data-lang="${l}"\\]`).test(tokenCss)) fail(`data-lang="${l}" のフォント切替が無い`);
  }

  // 5-a. dark ブロックはちょうど 1 つ（複数あると --ntt-* 上書き検査が素通りする）
  const darkCount = [...tokenCss.matchAll(/:root\[data-theme="dark"\]\s*\{/g)].length;
  if (darkCount !== 1) fail(`:root[data-theme="dark"] ブロックが ${darkCount} 個ある（1 個にする）`);
  else ok('dark ブロックは 1 つ');

  // 5-b. 分類アクセント --cat-<id> / --cat-<id>-bg は light と dark の両方に必要（§2-2 / §2-7）
  const lightRoot = (tokenCss.match(/:root\s*\{([\s\S]*?)\n\}/) || [, ''])[1];
  const darkRoot  = (tokenCss.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/) || [, ''])[1];
  const catTok = (css) => new Set([...css.matchAll(/(--cat-[a-z]{2}(?:-bg)?)\s*:/g)].map(m => m[1]));
  const lc = catTok(lightRoot), dc = catTok(darkRoot);
  const asym = [...lc].filter(v => !dc.has(v)).concat([...dc].filter(v => !lc.has(v)));
  if (asym.length) fail(`--cat-* が light/dark 非対称: ${asym.sort().join(', ')}`);
  else ok(`--cat-* ${lc.size} 個が light/dark 両方に定義済み`);
  for (const base of [...lc].filter(v => !v.endsWith('-bg'))) {
    if (!lc.has(base + '-bg')) fail(`${base} に対応する ${base}-bg が無い`);
  }
  // 5-c. CATS の分類 id に色トークンが無い場合は warn（顧客版差し替えを FAIL にしない。§2-9）
  if (CATS) for (const c of CATS) {
    if (!lc.has(`--cat-${c.id}`)) warn(`CATS.${c.id}: --cat-${c.id} が未定義（既定色 --cat-accent で描画される）`);
  }

  // 5-d. catalog.html に <style> ブロックが 0 個
  const styleCount = [...html.matchAll(/<style>/g)].length;
  if (styleCount !== 0) fail(`catalog.html に <style> ブロックが ${styleCount} 個残っている（css/*.css に分離すること）`);
  else ok('catalog.html に <style> ブロックなし');

  // 5-e. <link rel="stylesheet"> 2 本が tokens → components の順で実在ファイルを相対パスで指す
  const expectedHrefs = ['css/tokens.css', 'css/components.css'];
  if (cssLinks.join(',') !== expectedHrefs.join(',')) {
    fail(`catalog.html の <link rel="stylesheet"> が想定と異なる: [${cssLinks.join(', ')}]（期待: [${expectedHrefs.join(', ')}]）`);
  } else {
    let linkBad = 0;
    for (const href of cssLinks) {
      if (href.startsWith('/') || href.includes('../')) { fail(`<link href="${href}">: 相対パスでない（先頭 / や ../ を含む）`); linkBad++; }
      if (!existsSync(resolve(MOCK, href))) { fail(`<link href="${href}">: 実ファイルが無い`); linkBad++; }
    }
    if (!linkBad) ok('catalog.html の <link rel="stylesheet"> 2 本（tokens → components）が実在ファイルを相対パスで指している');
  }
}

/* ---------- 5-A. index.html のトークン非コピー ---------- */
section('5-A. index.html のトークン非コピー');
{
  const INDEX_HTML = resolve(MOCK, 'index.html');
  if (!existsSync(INDEX_HTML)) fail(`not found: ${INDEX_HTML}`);
  else {
    if (!/<link\s+rel="stylesheet"\s+href="css\/tokens\.css">/.test(indexHtml)) {
      fail('index.html に <link rel="stylesheet" href="css/tokens.css"> が無い');
    } else ok('index.html が css/tokens.css を <link> している');
    if (/--ntt-[a-z0-9-]+\s*:/i.test(indexHtml)) {
      fail('index.html にトークン定義のコピー（--ntt-* の定義行）が残っている');
    } else ok('index.html にトークン定義のコピーなし');
  }
}

/* ---------- 6. データ整合 ---------- */
section('6. データ整合');
if (CATS && SVCS && TAGS) {
  const catIds = new Set(CATS.map(c => c.id));
  const subIds = new Set(CATS.flatMap(c => c.subs.map(s => s.id)));
  const svcIds = new Set();
  let bad = 0;
  for (const s of SVCS) {
    if (svcIds.has(s.id)) { fail(`SVCS id 重複: ${s.id}`); bad++; } svcIds.add(s.id);
    if (!catIds.has(s.cat)) { fail(`SVCS.${s.id}: cat "${s.cat}" が CATS に無い`); bad++; }
    if (!subIds.has(s.sub)) { fail(`SVCS.${s.id}: sub "${s.sub}" が CATS に無い`); bad++; }
    if (![1, 2, 3].includes(s.st)) { fail(`SVCS.${s.id}: st=${s.st} は 1/2/3 以外`); bad++; }
    // added（任意）：あるなら YYYY-MM-DD で、実在する日付であること（NEW 表示の入力）
    if ('added' in s) {
      if (typeof s.added !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.added)) {
        fail(`SVCS.${s.id}: added "${s.added}" が YYYY-MM-DD 形式でない`); bad++;
      } else if (Number.isNaN(Date.parse(s.added + 'T00:00:00Z'))) {
        fail(`SVCS.${s.id}: added "${s.added}" は実在しない日付`); bad++;
      }
    }
    for (const tg of s.tags) if (!(tg in TAGS)) { fail(`SVCS.${s.id}: tag "${tg}" が TAGS に無い`); bad++; }
  }
  const usedTags = new Set(SVCS.flatMap(s => s.tags));
  const unusedTags = Object.keys(TAGS).filter(k => !usedTags.has(k));
  if (unusedTags.length) warn(`未使用タグ: ${unusedTags.join(', ')}`);
  if (!bad) ok(`SVCS ${SVCS.length} 件の cat/sub/st/tags 整合 OK`);

  // 管理番号（§7B）
  const codeSeen = new Map();
  for (const s of SVCS) {
    if (!/^[a-z]{2}\d+$/.test(s.id)) { fail(`SVCS.${s.id}: id が /^[a-z]{2}\\d+$/ に一致しない（管理番号を作れない）`); bad++; }
    const code = s.id.replace(/^([a-z]+)(\d+)$/, (_, a, b) => a.toUpperCase() + '-' + String(b).padStart(2, '0'));
    if (codeSeen.has(code)) { fail(`管理番号の重複: ${code}（${codeSeen.get(code)} と ${s.id}）`); bad++; }
    codeSeen.set(code, s.id);
  }
  if (!bad) ok(`管理番号 ${codeSeen.size} 件の重複なし OK`);
}

/* ---------- 7. 共通レイヤー契約 ---------- */
section('7. 共通レイヤー契約');
{
  const stateM = appText.match(/const state = \{([\s\S]*?)\};/);
  const required = ['pattern', 'lang', 'theme', 'openCats', 'selCat', 'selSub', 'lastCat', 'selSvc', 'view', 'query'];
  if (!stateM) fail('const state = {…} が見つからない');
  else {
    const keys = new Set([...stateM[1].matchAll(/^\s*([a-zA-Z]+)\s*:/gm)].map(m => m[1]));
    const missing = required.filter(k => !keys.has(k));
    if (missing.length) fail(`state に必須キーが無い: ${missing.join(', ')}`); else ok(`state 必須キー ${required.length} 件 OK`);
  }
  const acts = new Set([...appText.matchAll(/act === '([a-z]+)'/g)].map(m => m[1]));
  const requiredActs = ['pattern', 'all', 'cat', 'sub', 'svc', 'back', 'backdetail', 'start', 'send', 'run', 'chip', 'restart', 'gocat'];
  const missingActs = requiredActs.filter(a => !acts.has(a));
  if (missingActs.length) fail(`data-act ハンドラが無い: ${missingActs.join(', ')}`); else ok(`data-act ${requiredActs.length} 種 OK`);

  if (!/function detectLang\(/.test(appText)) fail('detectLang() が無い（§2-5）'); else ok('detectLang() あり');
  const demoDate = appText.match(/const DEMO_DATE = ([^;]+);/);
  if (!demoDate) fail('DEMO_DATE が無い（NEW 表示の基準日）');
  else if (demoDate[1].trim() !== 'null') warn(`DEMO_DATE が ${demoDate[1].trim()} に固定されている（デモ後は null に戻す）`);
  else ok('DEMO_DATE = null（実際の今日で判定）');
  for (const k of ['mock.lang', 'mock.theme']) {
    if (!appText.includes(`'${k}'`)) fail(`localStorage キー '${k}' が見当たらない（§2-6）`);
  }
  if (appText.includes(`'mock.lang'`) && appText.includes(`'mock.theme'`)) ok('localStorage キー mock.lang / mock.theme OK');
  if (!/class="mockbar"/.test(html)) fail('.mockbar（レビュー用足場）が無い（§2-4）');
  if (!/id="lang-select"/.test(html) || !/id="theme-btn"/.test(html)) fail('ヘッダーの言語/テーマ切替が無い（§2-4）');
  if (/class="mockbar"/.test(html) && /id="lang-select"/.test(html)) ok('足場（.mockbar）とプロダクト機能（言語/テーマ）が両方存在');
}

/* ---------- 8. Pages 設定 ---------- */
section('8. Pages 設定');
{
  const wf = resolve(ROOT, '.github/workflows/pages.yml');
  if (!existsSync(wf)) fail('pages.yml が無い');
  else if (!/path:\s*mock\b/.test(readFileSync(wf, 'utf8'))) fail('pages.yml の upload path が mock ではない（§2-8）');
  else ok('pages.yml: path: mock');
  if (!existsSync(resolve(MOCK, '.nojekyll'))) fail('mock/.nojekyll が無い'); else ok('mock/.nojekyll あり');

  // mock/ 配下（サブディレクトリ含む）に _ 始まりのディレクトリが無いこと
  const underscoreDirs = [];
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.name.startsWith('_')) underscoreDirs.push(childRel);
      walk(resolve(dir, entry.name), childRel);
    }
  };
  walk(MOCK, '');
  if (underscoreDirs.length) fail(`mock/ 配下に _ 始まりのディレクトリ: ${underscoreDirs.join(', ')}`);
  else ok('mock/ 配下に _ 始まりのディレクトリなし');
}

/* ---------- 9. シナリオ整合（SCENARIOS ⇔ SVCS ⇔ TEMPLATES） ---------- */
section('9. シナリオ整合');
if (SCENARIOS && SVCS && TEMPLATES) {
  const svcIds = new Set(SVCS.map(s => s.id));
  const tplKeys = new Set(Object.keys(TEMPLATES));
  let bad = 0;
  for (const id in SCENARIOS) {
    if (!svcIds.has(id)) { fail(`SCENARIOS.${id}: SVCS に存在しない id`); bad++; continue; }
    const scn = SCENARIOS[id];

    if (!tplKeys.has(scn.template)) { fail(`SCENARIOS.${id}: template "${scn.template}" が TEMPLATES に無い`); bad++; }

    if (!['ja', 'zh'].includes(scn.persona && scn.persona.native)) { fail(`SCENARIOS.${id}.persona.native: "${scn.persona && scn.persona.native}" は ja/zh 以外`); bad++; }

    const stepLens = LANGS.map(l => (scn.steps && Array.isArray(scn.steps[l])) ? scn.steps[l].length : -1);
    if (new Set(stepLens).size !== 1 || stepLens[0] < 3 || stepLens[0] > 6) { fail(`SCENARIOS.${id}.steps: 3 言語の長さ不一致 or 3〜6 の範囲外（${stepLens.join('/')}）`); bad++; }

    const ja = scn.script && scn.script.ja, zh = scn.script && scn.script.zh;
    if (!Array.isArray(ja) || !Array.isArray(zh) || ja.length !== zh.length || ja.length < 2 || ja.length > 4) {
      fail(`SCENARIOS.${id}.script: ja/zh の長さ不一致 or 2〜4 の範囲外`); bad++;
    } else {
      for (const [lbl, arr] of [['ja', ja], ['zh', zh]]) {
        for (let i = 0; i < arr.length; i++) {
          const turn = arr[i];
          if (typeof turn.q !== 'string' || !turn.q.trim() || typeof turn.a !== 'string' || !turn.a.trim()) {
            fail(`SCENARIOS.${id}.script.${lbl}[${i}]: q/a が非空文字列でない`); bad++;
          }
          if (turn.q && turn.q.includes("'")) { fail(`SCENARIOS.${id}.script.${lbl}[${i}].q: '（U+0027）を含む`); bad++; }
          if (turn.a && turn.a.includes("'")) { fail(`SCENARIOS.${id}.script.${lbl}[${i}].a: '（U+0027）を含む`); bad++; }
        }
      }
    }

    if (scn.template !== 'qa') {
      if (!scn.input || !scn.input.ja || !scn.input.zh) { fail(`SCENARIOS.${id}.input: ja/zh が無い（template=${scn.template}）`); bad++; }
      if (!scn.result || !scn.result.ja || !scn.result.zh) { fail(`SCENARIOS.${id}.result: ja/zh が無い（template=${scn.template}）`); bad++; }
      else {
        for (const l of ['ja', 'zh']) {
          const r = scn.result[l];
          const hasItems = Array.isArray(r.items), hasTable = Array.isArray(r.columns) && Array.isArray(r.rows);
          if (hasItems === hasTable) { fail(`SCENARIOS.${id}.result.${l}: items か columns+rows のどちらか一方が必要`); bad++; }
          if (hasTable && r.rows.some(row => row.length !== r.columns.length)) { fail(`SCENARIOS.${id}.result.${l}: rows の列数が columns と不一致`); bad++; }
        }
      }
      if (scn.input) {
        for (const l of ['ja', 'zh']) {
          const inp = scn.input[l]; if (!inp) continue;
          if (scn.template === 'upload' && !Array.isArray(inp.files)) { fail(`SCENARIOS.${id}.input.${l}.files: 配列が必要（upload）`); bad++; }
          if (scn.template === 'form' && !Array.isArray(inp.fields)) { fail(`SCENARIOS.${id}.input.${l}.fields: 配列が必要（form）`); bad++; }
          if (scn.template === 'diff' && !(typeof inp.left === 'string' && typeof inp.right === 'string')) { fail(`SCENARIOS.${id}.input.${l}: left/right が必要（diff）`); bad++; }
          if (scn.template === 'lookup' && typeof inp.query !== 'string') { fail(`SCENARIOS.${id}.input.${l}.query: 文字列が必要（lookup）`); bad++; }
        }
      }
    }
  }
  const noScript = SVCS.filter(s => !SCENARIOS[s.id]).map(s => s.id);
  if (noScript.length) warn(`台本の無い SVCS ${noScript.length} 件: ${noScript.join(', ')}`);
  if (!bad) ok(`SCENARIOS ${Object.keys(SCENARIOS).length} 件の整合 OK`);

  // 9-A（新規）: 各シナリオ id の接頭 2 文字＝置かれているファイル名（js/data/scenarios/<接頭>.js）
  let prefixBad = 0;
  for (const f of dataSources) {
    if (!f.path.startsWith('js/data/scenarios/')) continue;
    const expectedPrefix = basename(f.path, '.js');
    for (const m of f.src.matchAll(/^\s*([a-z]+)\d+:\s*\{/gm)) {
      if (m[1] !== expectedPrefix) { fail(`${f.path}: id 接頭 "${m[1]}" がファイル名 "${expectedPrefix}" と不一致`); prefixBad++; }
    }
  }
  if (!prefixBad) ok('シナリオ id の接頭 2 文字がすべて配置先ファイル名と一致');
} else {
  fail('SCENARIOS / SVCS / TEMPLATES のいずれかが取得できない');
}

/* ---------- 10. ホームデータ整合（HOME / FEED） ---------- */
section('10. ホームデータ整合（HOME / FEED）');
{
  const svcIds = SVCS ? new Set(SVCS.map(s => s.id)) : new Set();
  const catIds = CATS ? new Set(CATS.map(c => c.id)) : new Set();
  let bad = 0;

  if (!HOME) { fail('HOME が取得できない'); bad++; }
  else {
    if (!Array.isArray(HOME.frequent) || HOME.frequent.length < 1) { fail('HOME.frequent: 1件以上必要'); bad++; }
    else {
      const seen = new Set();
      for (const f of HOME.frequent) {
        if (!svcIds.has(f.id)) { fail(`HOME.frequent.${f.id}: SVCS に存在しない`); bad++; }
        if (seen.has(f.id)) { fail(`HOME.frequent: id 重複 ${f.id}`); bad++; } seen.add(f.id);
        if (!Number.isInteger(f.uses) || f.uses < 1) { fail(`HOME.frequent.${f.id}.uses: 1以上の整数が必要`); bad++; }
      }
      const usesDesc = HOME.frequent.every((f, i) => i === 0 || HOME.frequent[i - 1].uses >= f.uses);
      if (!usesDesc) warn('HOME.frequent: uses が降順でない');
    }
    if (!Array.isArray(HOME.recommended) || HOME.recommended.length < 1) { fail('HOME.recommended: 1件以上必要'); bad++; }
    else {
      for (const r of HOME.recommended) {
        if (!svcIds.has(r.id)) { fail(`HOME.recommended.${r.id}: SVCS に存在しない`); bad++; }
        checkML(r.why, `HOME.recommended.${r.id}.why`);
      }
    }
  }

  // FEED（③）
  if (FEED) {
    if (!Array.isArray(FEED.mine) || FEED.mine.some(id => !catIds.has(id))) { fail('FEED.mine: CATS に存在しない id を含む'); bad++; }
    if (!Array.isArray(FEED.recent)) { fail('FEED.recent: 配列が必要'); bad++; }
    else {
      const seen = new Set();
      for (const id of FEED.recent) {
        if (!svcIds.has(id)) { fail(`FEED.recent.${id}: SVCS に存在しない`); bad++; }
        if (seen.has(id)) { fail(`FEED.recent: id 重複 ${id}`); bad++; } seen.add(id);
      }
    }
    checkML(FEED.persona && FEED.persona.name, 'FEED.persona.name');
    checkML(FEED.persona && FEED.persona.role, 'FEED.persona.role');
    checkML(FEED.persona && FEED.persona.site, 'FEED.persona.site');
    if (!Array.isArray(FEED.items) || FEED.items.length < 1) { fail('FEED.items: 1件以上必要'); bad++; }
    else {
      for (const it of FEED.items) {
        if (!svcIds.has(it.id)) { fail(`FEED.items.${it.id}: SVCS に存在しない`); bad++; }
        if (!['due', 'notify', 'routine'].includes(it.kind)) { fail(`FEED.items.${it.id}.kind: "${it.kind}" は due/notify/routine 以外`); bad++; }
        checkML(it.when, `FEED.items.${it.id}.when`);
        checkML(it.note, `FEED.items.${it.id}.note`);
      }
    }
  }

  if (!bad) ok('HOME' + (FEED ? ' / FEED' : '') + ' の整合 OK');
}

/* ---------- 結果 ---------- */
console.log(`\n${fails === 0 ? '✅ ALL PASS' : `❌ ${fails} FAIL`}${warns ? ` / ⚠️ ${warns} warn` : ''}`);
process.exit(fails ? 1 : 0);
