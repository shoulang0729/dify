#!/usr/bin/env node
/**
 * tools/verify.mjs — 静的検証ハーネス（CLAUDE.md §2 load-bearing の機械検出）
 *
 * 使い方:  node tools/verify.mjs
 * 終了コード: 0 = 全 PASS / 1 = 1つ以上 FAIL
 *
 * チェック項目（設計書 docs/handoff/2026-09-07-split-catalog.md §4-2。PR-C でアプリ層も分割対応）:
 *   1.   JS 構文（各 JS ファイルを個別に node --check）
 *   1-A. （新規）二重宣言：全 JS（データ層＋アプリ層）を <script src> の順に連結して node --check
 *   1-B. （新規）読み込み契約：実ファイル存在／相対パスのみ／scenarios タグ集合＝ディレクトリの *.js 集合／
 *        読み込み順が data/ui → data/catalog → data/home → data/style → data/scenarios/* → app → render → events／
 *        <script src> 15 本・インライン <script> 0 個／catalog.html に <style> が 0 個
 *   2.   i18n キー集合の一致（T / TAGS / PATTERNS / CATS / SVCS / TEMPLATES が ja/zh/en を全て持ち、空でない。en にかな残りなし）
 *   3.   未定義キー参照（t('key') / T.key が T に存在するか。全 JS ファイルの連結テキストを対象）
 *   4.   未使用キー（T にあるがどこからも参照されない）※警告扱い（FAIL にしない）
 *   5.   CSS トークン（mock/css/tokens.css・mock/css/components.css を直接読む。var(--x) が定義済みか / dark ブロック存在 / コンポーネント CSS に色直値なし / --ntt-* が dark で上書きされていない）
 *   5-A. index.html のトークン非コピー（mock/index.html が css/tokens.css を <link> し、トークン定義のコピーを持たない）
 *   6.   データ整合（SVCS の cat/sub が CATS に存在、tags が TAGS に存在、st ∈ {1,2,3}、added は YYYY-MM-DD、管理番号重複なし）
 *   7.   共通レイヤー契約（state の必須キー / data-act 一覧 / detectLang 存在 / localStorage キー）。
 *        対象は js/app.js + js/render.js + js/events.js の連結（PR-C：アプリ層はすべてファイル分割済み。
 *        インライン <script> が残っていれば loadMock() がそれも拾う＝退行時も検査は効く）
 *   8.   Pages 設定（pages.yml の path: mock / mock/.nojekyll / mock/ 直下に _ 始まりディレクトリが無い）
 *   9.   シナリオ整合（SCENARIOS の id が SVCS に存在／template が TEMPLATES に存在／id 接頭＝ファイル名／台本の無い SVCS は warn）
 *   10.  ホームデータ整合（HOME / FEED）
 *   11.  索引の鮮度（docs/service-map.md が tools/gen-index.mjs --check と一致）＋
 *        トップ README.md の「4 区分」地図のリンク先が実在すること
 *        （設計書 docs/handoff/2026-09-07-repo-layout-v2.md §1-3・§10 Q7）
 *   12.  環境レイヤー（dify/env/**）：schema: 1 と必須キー／秘密・実名の直値が無いこと（sk- 文字列・32 文字以上の
 *        16 進 or base64 らしき文字列・cloud-master の既知 2 URL 以外の生 http(s):// URL）／
 *        `render.py --env cloud-master --all --check` が通ること（python3 が無ければ warn で skip）
 *        （設計書 docs/handoff/2026-09-07-repo-layout-v2.md §3-2・§4-2・§8 PR-2）
 *   12-e.（新規）apps: の管理番号一覧が dify/apps/*.yml と過不足なく一致し、id が null/${VAR}/UUID 形のいずれかで、
 *        cloud-master 以外に生 UUID が無いこと（設計書 docs/handoff/2026-09-08-cloud-console-deploy.md §3-4・Issue #114 PR-2）
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
const { T, PATTERNS, TAGS, TEMPLATES, INDUSTRIES, CATS, SVCS, CAT_STYLE, HOME, FEED, SCENARIOS } = data;
const INDUSTRY_ORDER = ['mfg', 'fin'];
const industryIds = new Set((INDUSTRIES || []).map(i => i.id));
/* 分類の表示順（業種ごと。§4-3。台本ディレクトリの期待順序にも使う） */
const CAT_ORDER_BY_INDUSTRY = {
  mfg: ['kn', 'qa', 'dc', 'lg', 'nm', 'en', 'gn', 'pt', 'po', 'eg'],
  fin: ['kn', 'rs', 'cv', 'fa', 'dc', 'gn', 'po', 'eg']
};

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

  // ③ js/data/scenarios/<業種>/ のタグ集合＝ディレクトリの *.js 集合（業種ごと）。
  //    scenarios/ 直下に .js が残っていたら移動漏れとして FAIL（設計書 §4-6）
  const scenDir = resolve(MOCK, 'js/data/scenarios');
  let scenarioIndustryDirs = [];
  if (!existsSync(scenDir)) { fail('mock/js/data/scenarios/ が無い'); bad++; }
  else {
    const entries = readdirSync(scenDir, { withFileTypes: true });
    const looseFiles = entries.filter(e => e.isFile() && e.name.endsWith('.js')).map(e => e.name);
    if (looseFiles.length) { fail(`scenarios/ 直下に .js が残っている（<業種>/ への移動漏れ）: ${looseFiles.join(', ')}`); bad++; }
    scenarioIndustryDirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    let scenBad = 0;
    for (const indId of scenarioIndustryDirs) {
      const dirFiles = new Set(readdirSync(resolve(scenDir, indId)).filter(f => f.endsWith('.js')));
      const taggedFiles = new Set(scriptSrcs.filter(s => s.startsWith(`js/data/scenarios/${indId}/`)).map(s => basename(s)));
      const missingFromTags = [...dirFiles].filter(f => !taggedFiles.has(f));
      const missingFromDir = [...taggedFiles].filter(f => !dirFiles.has(f));
      if (missingFromTags.length) { fail(`scenarios/${indId}/ にあるが <script src> に無い: ${missingFromTags.join(', ')}`); scenBad++; }
      if (missingFromDir.length) { fail(`<script src> にあるが scenarios/${indId}/ に無い: ${missingFromDir.join(', ')}`); scenBad++; }
    }
    bad += scenBad;
    if (!scenBad && !looseFiles.length) {
      const total = scenarioIndustryDirs.reduce((n, d) => n + readdirSync(resolve(scenDir, d)).filter(f => f.endsWith('.js')).length, 0);
      ok(`scenarios/<業種>/ の *.js 合計 ${total} 個（業種 ${scenarioIndustryDirs.join(', ')}） ＝ <script src> のタグ集合`);
    }
  }

  // ④ 読み込み順が data/ui → data/catalog → data/home → data/style → data/scenarios/mfg/* → data/scenarios/fin/* → app → render → events
  //    （設計書 2026-09-08-finance-catalog.md §4-3。業種ディレクトリは実ディレクトリから、ファイル順は CAT_ORDER_BY_INDUSTRY から計算する）
  const presentIndustries = INDUSTRY_ORDER.filter(i => scenarioIndustryDirs.includes(i));
  const scenarioExpectedTags = presentIndustries.flatMap(indId => {
    const dirFiles = new Set(readdirSync(resolve(scenDir, indId)).filter(f => f.endsWith('.js')));
    const ordered = (CAT_ORDER_BY_INDUSTRY[indId] || []).filter(code => dirFiles.has(`${code}.js`));
    const extra = [...dirFiles].filter(f => !ordered.includes(basename(f, '.js'))).sort();
    return [...ordered, ...extra.map(f => basename(f, '.js'))].map(code => `js/data/scenarios/${indId}/${code}.js`);
  });
  const expectedOrder = [
    'js/data/ui.js', 'js/data/catalog.js', 'js/data/home.js', 'js/data/style.js',
    ...scenarioExpectedTags,
    'js/app.js', 'js/render.js', 'js/events.js'
  ];
  if (JSON.stringify(scriptSrcs) !== JSON.stringify(expectedOrder)) {
    fail(`<script src> の順序が設計書 §4-3 と異なる:\n   期待: ${expectedOrder.join(' → ')}\n   実際: ${scriptSrcs.join(' → ')}`);
    bad++;
  } else ok('<script src> の順序が設計書 §4-3 と一致（data/ui → … → data/scenarios/<業種>/* → app → render → events）');

  // ⑤ <script> タグすべてが src 付き（インライン <script> が 0 個）。本数は実ディレクトリから計算
  //    （4 = data/ui+catalog+home+style／業種ごとの台本ファイル数／3 = app+render+events）
  const scriptTagCount = [...html.matchAll(/<script\b/g)].length;
  const expectedCount = 4 + scenarioExpectedTags.length + 3;
  if (scriptTagCount !== scriptSrcs.length) {
    fail(`catalog.html の <script> タグ ${scriptTagCount} 個のうち src 無しが ${scriptTagCount - scriptSrcs.length} 個ある（インライン <script> は禁止）`);
    bad++;
  } else if (scriptSrcs.length !== expectedCount) {
    fail(`<script src> が ${scriptSrcs.length} 本（期待 ${expectedCount} 本 = data 4 + scenarios ${scenarioExpectedTags.length} + app/render/events 3）`);
    bad++;
  } else ok(`<script src> ${expectedCount} 本すべてに src があり、インライン <script> は 0 個`);

  // ⑥ catalog.html に <style> ブロックが 0 個（PR-A の帰結。PR-B/PR-C でも維持を再確認）
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
if (INDUSTRIES) for (const i of INDUSTRIES) {
  checkML(i.name, `INDUSTRIES.${i.id}.name`); checkML(i.desc, `INDUSTRIES.${i.id}.desc`);
  checkML(i.wordmark, `INDUSTRIES.${i.id}.wordmark`); checkML(i.dept, `INDUSTRIES.${i.id}.dept`);
}
if (CATS) for (const c of CATS) {
  checkML(c.name, `CATS.${c.id}.name`); checkML(c.abbr, `CATS.${c.id}.abbr`);
  for (const s of c.subs) checkML(s.name, `CATS.${c.id}.subs.${s.id}.name`);
}
if (SVCS) for (const s of SVCS) { checkML(s.name, `SVCS.${s.id}.name`); checkML(s.desc, `SVCS.${s.id}.desc`); }
if (TEMPLATES) for (const k in TEMPLATES) { checkML(TEMPLATES[k].name, `TEMPLATES.${k}.name`); checkML(TEMPLATES[k].desc, `TEMPLATES.${k}.desc`); }
if (SCENARIOS) for (const indId in SCENARIOS) for (const id in SCENARIOS[indId]) {
  const scn = SCENARIOS[indId][id];
  checkML(scn.persona.name, `SCENARIOS.${indId}.${id}.persona.name`);
  checkML(scn.persona.role, `SCENARIOS.${indId}.${id}.persona.role`);
  checkML(scn.persona.site, `SCENARIOS.${indId}.${id}.persona.site`);
  for (const l of LANGS) {
    if (!Array.isArray(scn.steps[l]) || !scn.steps[l].length) { fail(`SCENARIOS.${indId}.${id}.steps.${l}: 欠落/空`); i18nBad++; }
  }
}
if (i18nBad === 0 && T && TAGS && PATTERNS && INDUSTRIES && CATS && SVCS && TEMPLATES && SCENARIOS)
  ok(`全辞書 3 言語一致（T=${Object.keys(T).length} TAGS=${Object.keys(TAGS).length} PATTERNS=${PATTERNS.length} INDUSTRIES=${INDUSTRIES.length} CATS=${CATS.length} SVCS=${SVCS.length} TEMPLATES=${Object.keys(TEMPLATES).length}）`);

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

  // 業種（industries）：CATS / subs / SVCS すべてで必須。値は ['mfg']/['fin']/['mfg','fin']（順序固定）のみ
  // （設計書 2026-09-08-finance-catalog.md §1-2）
  const checkIndustries = (arr, label) => {
    if (!Array.isArray(arr) || !arr.length) { fail(`${label}: industries が無い/空`); bad++; return; }
    for (const v of arr) if (!industryIds.has(v)) { fail(`${label}: industries に未知の業種 "${v}"`); bad++; }
    if (JSON.stringify(arr) !== JSON.stringify(INDUSTRY_ORDER.filter(v => arr.includes(v)))) {
      fail(`${label}: industries の順序が ['mfg','fin'] 固定でない: [${arr}]`); bad++;
    }
  };
  for (const c of CATS) {
    checkIndustries(c.industries, `CATS.${c.id}`);
    for (const s of c.subs) checkIndustries(s.industries, `CATS.${c.id}.subs.${s.id}`);
  }
  for (const s of SVCS) checkIndustries(s.industries, `SVCS.${s.id}`);

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
    // SVCS.industries ⊆ その cat と sub の industries（設計書 §1-2）
    if (Array.isArray(s.industries)) {
      const c = CATS.find(x => x.id === s.cat), sb = c && c.subs.find(x => x.id === s.sub);
      if (c && !s.industries.every(v => c.industries.includes(v))) {
        fail(`SVCS.${s.id}: industries [${s.industries}] が cat "${s.cat}" の industries [${c.industries}] の部分集合でない`); bad++;
      }
      if (sb && !s.industries.every(v => sb.industries.includes(v))) {
        fail(`SVCS.${s.id}: industries [${s.industries}] が sub "${s.sub}" の industries [${sb.industries}] の部分集合でない`); bad++;
      }
    }
  }

  // 各業種で、サービス 0 件の分類・中分類が無いこと（設計書 §1-2）
  for (const indId of industryIds) {
    for (const c of CATS.filter(c => c.industries.includes(indId))) {
      if (!SVCS.some(s => s.cat === c.id && s.industries.includes(indId))) {
        fail(`CATS.${c.id}: 業種 "${indId}" で見えるサービスが 0 件（分類が空でメニューに出る）`); bad++;
      }
      for (const sb of c.subs.filter(sb => sb.industries.includes(indId))) {
        if (!SVCS.some(s => s.sub === sb.id && s.industries.includes(indId))) {
          fail(`CATS.${c.id}.subs.${sb.id}: 業種 "${indId}" で見えるサービスが 0 件`); bad++;
        }
      }
    }
  }

  const usedTags = new Set(SVCS.flatMap(s => s.tags));
  const unusedTags = Object.keys(TAGS).filter(k => !usedTags.has(k));
  if (unusedTags.length) warn(`未使用タグ: ${unusedTags.join(', ')}`);
  if (!bad) ok(`SVCS ${SVCS.length} 件の cat/sub/st/tags/industries 整合 OK`);

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
  const required = ['industry', 'pattern', 'lang', 'theme', 'openCats', 'selCat', 'selSub', 'lastCat', 'selSvc', 'view', 'query', 'fav', 'favOnly'];
  if (!stateM) fail('const state = {…} が見つからない');
  else {
    const keys = new Set([...stateM[1].matchAll(/^\s*([a-zA-Z]+)\s*:/gm)].map(m => m[1]));
    const missing = required.filter(k => !keys.has(k));
    if (missing.length) fail(`state に必須キーが無い: ${missing.join(', ')}`); else ok(`state 必須キー ${required.length} 件 OK`);
  }
  const acts = new Set([...appText.matchAll(/act === '([a-z]+)'/g)].map(m => m[1]));
  const requiredActs = ['industry', 'pattern', 'all', 'cat', 'sub', 'svc', 'back', 'backdetail', 'start', 'send', 'run', 'chip', 'restart', 'gocat', 'fav', 'favlist'];
  const missingActs = requiredActs.filter(a => !acts.has(a));
  if (missingActs.length) fail(`data-act ハンドラが無い: ${missingActs.join(', ')}`); else ok(`data-act ${requiredActs.length} 種 OK`);

  if (!/function detectLang\(/.test(appText)) fail('detectLang() が無い（§2-5）'); else ok('detectLang() あり');
  const demoDate = appText.match(/const DEMO_DATE = ([^;]+);/);
  if (!demoDate) fail('DEMO_DATE が無い（NEW 表示の基準日）');
  else if (demoDate[1].trim() !== 'null') warn(`DEMO_DATE が ${demoDate[1].trim()} に固定されている（デモ後は null に戻す）`);
  else ok('DEMO_DATE = null（実際の今日で判定）');
  // localStorage キーの許可集合は mock.lang / mock.theme / mock.fav の 3 つだけ（設計書 2026-09-08-favorites.md §2-1・§7-1）。
  // 3 キーすべてが存在すること、かつアプリ層に現れる 'mock.…' リテラルがこの 3 つの部分集合であること（4 つ目を機械的に止める）
  const ALLOWED_MOCK_KEYS = ['mock.lang', 'mock.theme', 'mock.fav'];
  const missingMockKeys = ALLOWED_MOCK_KEYS.filter(k => !appText.includes(`'${k}'`));
  if (missingMockKeys.length) fail(`localStorage キーが見当たらない: ${missingMockKeys.join(', ')}（§2-6）`);
  const mockKeyLiterals = new Set([...appText.matchAll(/'(mock\.[a-zA-Z]+)'/g)].map(m => m[1]));
  const extraMockKeys = [...mockKeyLiterals].filter(k => !ALLOWED_MOCK_KEYS.includes(k));
  if (extraMockKeys.length) fail(`localStorage キーが許可集合の外にある: ${extraMockKeys.join(', ')}（許可は ${ALLOWED_MOCK_KEYS.join(' / ')} の 3 つだけ。§2-6）`);
  if (!missingMockKeys.length && !extraMockKeys.length) ok(`localStorage キー ${ALLOWED_MOCK_KEYS.join(' / ')} の 3 つだけ OK`);
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

/* ---------- 9. シナリオ整合（SCENARIOS ⇔ SVCS ⇔ TEMPLATES。業種ごと） ---------- */
section('9. シナリオ整合');
if (SCENARIOS && SVCS && TEMPLATES) {
  const tplKeys = new Set(Object.keys(TEMPLATES));
  let bad = 0;
  let scenarioCount = 0;
  for (const indId in SCENARIOS) {
    // その業種で見える SVCS の id 集合（§1-4：SCENARIOS[industry][id] は同じ業種で見えるサービスであること）
    const svcIdsInInd = new Set(SVCS.filter(s => s.industries.includes(indId)).map(s => s.id));
    for (const id in SCENARIOS[indId]) {
      scenarioCount++;
      const label = `SCENARIOS.${indId}.${id}`;
      if (!svcIdsInInd.has(id)) { fail(`${label}: 業種 "${indId}" で見える SVCS に存在しない id`); bad++; continue; }
      const scn = SCENARIOS[indId][id];

      if (!tplKeys.has(scn.template)) { fail(`${label}: template "${scn.template}" が TEMPLATES に無い`); bad++; }

      if (!['ja', 'zh'].includes(scn.persona && scn.persona.native)) { fail(`${label}.persona.native: "${scn.persona && scn.persona.native}" は ja/zh 以外`); bad++; }

      const stepLens = LANGS.map(l => (scn.steps && Array.isArray(scn.steps[l])) ? scn.steps[l].length : -1);
      if (new Set(stepLens).size !== 1 || stepLens[0] < 3 || stepLens[0] > 6) { fail(`${label}.steps: 3 言語の長さ不一致 or 3〜6 の範囲外（${stepLens.join('/')}）`); bad++; }

      const ja = scn.script && scn.script.ja, zh = scn.script && scn.script.zh;
      if (!Array.isArray(ja) || !Array.isArray(zh) || ja.length !== zh.length || ja.length < 2 || ja.length > 4) {
        fail(`${label}.script: ja/zh の長さ不一致 or 2〜4 の範囲外`); bad++;
      } else {
        for (const [lbl, arr] of [['ja', ja], ['zh', zh]]) {
          for (let i = 0; i < arr.length; i++) {
            const turn = arr[i];
            if (typeof turn.q !== 'string' || !turn.q.trim() || typeof turn.a !== 'string' || !turn.a.trim()) {
              fail(`${label}.script.${lbl}[${i}]: q/a が非空文字列でない`); bad++;
            }
            if (turn.q && turn.q.includes("'")) { fail(`${label}.script.${lbl}[${i}].q: '（U+0027）を含む`); bad++; }
            if (turn.a && turn.a.includes("'")) { fail(`${label}.script.${lbl}[${i}].a: '（U+0027）を含む`); bad++; }
          }
        }
      }

      if (scn.template !== 'qa') {
        if (!scn.input || !scn.input.ja || !scn.input.zh) { fail(`${label}.input: ja/zh が無い（template=${scn.template}）`); bad++; }
        if (!scn.result || !scn.result.ja || !scn.result.zh) { fail(`${label}.result: ja/zh が無い（template=${scn.template}）`); bad++; }
        else {
          for (const l of ['ja', 'zh']) {
            const r = scn.result[l];
            const hasItems = Array.isArray(r.items), hasTable = Array.isArray(r.columns) && Array.isArray(r.rows);
            if (hasItems === hasTable) { fail(`${label}.result.${l}: items か columns+rows のどちらか一方が必要`); bad++; }
            if (hasTable && r.rows.some(row => row.length !== r.columns.length)) { fail(`${label}.result.${l}: rows の列数が columns と不一致`); bad++; }
          }
        }
        if (scn.input) {
          for (const l of ['ja', 'zh']) {
            const inp = scn.input[l]; if (!inp) continue;
            if (scn.template === 'upload' && !Array.isArray(inp.files)) { fail(`${label}.input.${l}.files: 配列が必要（upload）`); bad++; }
            if (scn.template === 'form' && !Array.isArray(inp.fields)) { fail(`${label}.input.${l}.fields: 配列が必要（form）`); bad++; }
            if (scn.template === 'diff' && !(typeof inp.left === 'string' && typeof inp.right === 'string')) { fail(`${label}.input.${l}: left/right が必要（diff）`); bad++; }
            if (scn.template === 'lookup' && typeof inp.query !== 'string') { fail(`${label}.input.${l}.query: 文字列が必要（lookup）`); bad++; }
          }
        }
      }
    }
  }
  // 台本の無い SVCS は業種ごとに warn（FAIL にしない。§1-4）
  for (const indId in SCENARIOS) {
    const noScript = SVCS.filter(s => s.industries.includes(indId) && !(SCENARIOS[indId] || {})[s.id]).map(s => s.id);
    if (noScript.length) warn(`業種 "${indId}" で台本の無い SVCS ${noScript.length} 件: ${noScript.join(', ')}`);
  }
  if (!bad) ok(`SCENARIOS ${scenarioCount} 件（業種 ${Object.keys(SCENARIOS).join(', ')}）の整合 OK`);

  // 9-A: 各シナリオ id の接頭＝配置先ファイル名（js/data/scenarios/<業種>/<接頭>.js）。
  //      dirname が業種 id・basename が分類コードであること（設計書 §4-6）
  let prefixBad = 0;
  for (const f of dataSources) {
    if (!f.path.startsWith('js/data/scenarios/')) continue;
    const parts = f.path.split('/'); // js, data, scenarios, <ind>, <code>.js
    const dirInd = parts[3];
    const expectedPrefix = basename(f.path, '.js');
    if (!industryIds.has(dirInd)) { fail(`${f.path}: 配置ディレクトリ "${dirInd}" が業種 id でない`); prefixBad++; }
    for (const m of f.src.matchAll(/^\s*([a-z]+)\d+:\s*\{/gm)) {
      if (m[1] !== expectedPrefix) { fail(`${f.path}: id 接頭 "${m[1]}" がファイル名 "${expectedPrefix}" と不一致`); prefixBad++; }
    }
  }
  if (!prefixBad) ok('シナリオの配置先が dirname=業種・basename=分類コードで一致');
} else {
  fail('SCENARIOS / SVCS / TEMPLATES のいずれかが取得できない');
}

/* ---------- 10. ホームデータ整合（HOME / FEED。業種キー。§1-5） ---------- */
section('10. ホームデータ整合（HOME / FEED）');
{
  let bad = 0;
  // HOME/FEED は「その業種のサービスが 1 件以上あるとき」だけ必須にする。
  // まだサービス 0 件の業種（PR-1 時点の fin）にダッシュボード/フィードのサンプルは要らない
  const readyIndustries = [...industryIds].filter(id => SVCS && SVCS.some(s => s.industries.includes(id)));

  for (const indId of readyIndustries) {
    // 参照 id は「その業種で見える」SVCS / CATS であること（設計書 §1-5）
    const svcIds = SVCS ? new Set(SVCS.filter(s => s.industries.includes(indId)).map(s => s.id)) : new Set();
    const catIds = CATS ? new Set(CATS.filter(c => c.industries.includes(indId)).map(c => c.id)) : new Set();

    const home = HOME && HOME[indId];
    if (!home) { fail(`HOME.${indId} が取得できない`); bad++; }
    else {
      if (!Array.isArray(home.frequent) || home.frequent.length < 1) { fail(`HOME.${indId}.frequent: 1件以上必要`); bad++; }
      else {
        const seen = new Set();
        for (const f of home.frequent) {
          if (!svcIds.has(f.id)) { fail(`HOME.${indId}.frequent.${f.id}: 業種 "${indId}" で見える SVCS に存在しない`); bad++; }
          if (seen.has(f.id)) { fail(`HOME.${indId}.frequent: id 重複 ${f.id}`); bad++; } seen.add(f.id);
          if (!Number.isInteger(f.uses) || f.uses < 1) { fail(`HOME.${indId}.frequent.${f.id}.uses: 1以上の整数が必要`); bad++; }
        }
        const usesDesc = home.frequent.every((f, i) => i === 0 || home.frequent[i - 1].uses >= f.uses);
        if (!usesDesc) warn(`HOME.${indId}.frequent: uses が降順でない`);
      }
      if (!Array.isArray(home.recommended) || home.recommended.length < 1) { fail(`HOME.${indId}.recommended: 1件以上必要`); bad++; }
      else {
        for (const r of home.recommended) {
          if (!svcIds.has(r.id)) { fail(`HOME.${indId}.recommended.${r.id}: 業種 "${indId}" で見える SVCS に存在しない`); bad++; }
          checkML(r.why, `HOME.${indId}.recommended.${r.id}.why`);
        }
      }
    }

    // FEED（③）
    const fd = FEED && FEED[indId];
    if (fd) {
      if (!Array.isArray(fd.mine) || fd.mine.some(id => !catIds.has(id))) { fail(`FEED.${indId}.mine: 業種 "${indId}" で見える CATS に存在しない id を含む`); bad++; }
      if (!Array.isArray(fd.recent)) { fail(`FEED.${indId}.recent: 配列が必要`); bad++; }
      else {
        const seen = new Set();
        for (const id of fd.recent) {
          if (!svcIds.has(id)) { fail(`FEED.${indId}.recent.${id}: 業種 "${indId}" で見える SVCS に存在しない`); bad++; }
          if (seen.has(id)) { fail(`FEED.${indId}.recent: id 重複 ${id}`); bad++; } seen.add(id);
        }
      }
      checkML(fd.persona && fd.persona.name, `FEED.${indId}.persona.name`);
      checkML(fd.persona && fd.persona.role, `FEED.${indId}.persona.role`);
      checkML(fd.persona && fd.persona.site, `FEED.${indId}.persona.site`);
      if (!Array.isArray(fd.items) || fd.items.length < 1) { fail(`FEED.${indId}.items: 1件以上必要`); bad++; }
      else {
        for (const it of fd.items) {
          if (!svcIds.has(it.id)) { fail(`FEED.${indId}.items.${it.id}: 業種 "${indId}" で見える SVCS に存在しない`); bad++; }
          if (!['due', 'notify', 'routine'].includes(it.kind)) { fail(`FEED.${indId}.items.${it.id}.kind: "${it.kind}" は due/notify/routine 以外`); bad++; }
          checkML(it.when, `FEED.${indId}.items.${it.id}.when`);
          checkML(it.note, `FEED.${indId}.items.${it.id}.note`);
        }
      }
    }
  }

  if (!bad) ok('HOME / FEED の整合 OK（業種ごと）');
}

/* ---------- 11. 索引の鮮度（docs/service-map.md）＋ README の 4 区分地図のリンク実在 ---------- */
section('11. 索引の鮮度・README の 4 区分地図');
{
  // 11-a: docs/service-map.md が gen-index の出力と一致するか（設計書 §1-3・§10 Q7＝FAIL）
  const genIndex = resolve(ROOT, 'tools/gen-index.mjs');
  if (!existsSync(genIndex)) {
    fail('tools/gen-index.mjs が無い');
  } else {
    try {
      execFileSync(process.execPath, [genIndex, '--check'], { cwd: ROOT, stdio: 'pipe' });
      ok('docs/service-map.md は最新（gen-index --check）');
    } catch {
      fail('docs/service-map.md が古い、または存在しない。`npm run index` を実行して再生成してください');
    }
  }

  // 11-b: トップ README.md の「4 区分」表（表の行のみ。設計書 §1-4 の表の下 2 行は
  // dify/env/README.md など PR-2 以降で作る想定のファイルへのリンクを含むため対象外）のリンク先が実在すること。
  // 表内のリンクのうち、末尾が `/` の区分カテゴリ（例 `./dify/env/`）はロードマップ上まだ無い場合があるため warn、
  // 具体的な入口ファイル（例 `./mock/index.html`）は fail とする
  const readmePath = resolve(ROOT, 'README.md');
  if (!existsSync(readmePath)) {
    fail('README.md（トップ）が無い');
  } else {
    const readme = readFileSync(readmePath, 'utf8');
    const mapSection = readme.match(/## このリポジトリの歩き方（4 区分）[\s\S]*?(?=\n## |\n---|\s*$)/);
    if (!mapSection) {
      fail('README.md に「## このリポジトリの歩き方（4 区分）」節が無い');
    } else {
      const tableLines = mapSection[0].split('\n').filter(l => l.trim().startsWith('|'));
      const links = [...tableLines.join('\n').matchAll(/\]\(\.\/([^)]+)\)/g)].map(m => m[1]);
      const missingDirs = links.filter(l => l.endsWith('/') && !existsSync(resolve(ROOT, l)));
      const missingFiles = links.filter(l => !l.endsWith('/') && !existsSync(resolve(ROOT, l)));
      if (links.length === 0) fail('README.md の 4 区分節にリンクが 1 つも無い');
      else if (missingFiles.length) fail(`README.md の 4 区分節の入口ファイルへのリンクが実在しない: ${missingFiles.join(', ')}`);
      else {
        if (missingDirs.length) warn(`README.md の 4 区分節のディレクトリリンクで未作成のもの（後続 PR で作る想定）: ${missingDirs.join(', ')}`);
        ok(`README.md の 4 区分節のリンク先 ${links.length - missingDirs.length}/${links.length} 件が実在（残りは後続 PR で作成予定のディレクトリ）`);
      }
    }
  }
}

/* ---------- 12. 環境レイヤー（dify/env/**） ---------- */
section('12. 環境レイヤー（dify/env/**）');
{
  const ENV_ROOT = resolve(ROOT, 'dify/env');
  const REQUIRED_ENVS = ['cloud-master', 'inhouse', 'customer-a'];
  const KNOWN_CLOUD_MASTER_URLS = ['https://api.dify.ai/v1', 'https://cloud.dify.ai'];

  if (!existsSync(ENV_ROOT)) {
    fail('dify/env/ が無い');
  } else {
    const envDirs = readdirSync(ENV_ROOT, { withFileTypes: true })
      .filter(d => d.isDirectory()).map(d => d.name).sort();
    const missing = REQUIRED_ENVS.filter(e => !envDirs.includes(e));
    if (missing.length) fail(`dify/env/ に無い環境: ${missing.join(', ')}`);
    else ok(`dify/env/ に 3 環境が揃っている: ${envDirs.join(', ')}`);

    // 12-a: README
    if (!existsSync(resolve(ENV_ROOT, 'README.md'))) fail('dify/env/README.md が無い');
    else ok('dify/env/README.md あり');

    const REQUIRED_TOP = ['schema', 'name', 'description', 'dify', 'models', 'knowledge', 'brand', 'flags', 'variables', 'apps'];
    const REQUIRED_DIFY = ['base_url', 'console_url', 'edition', 'dsl_version'];
    const REQUIRED_MODELS = ['chat', 'reasoning', 'embedding', 'rerank'];
    const REQUIRED_BRAND = ['company', 'local_entity', 'sites', 'replace'];
    const REQUIRED_FLAGS = ['cross_border', 'partner_mode', 'pipl_mask'];

    // 秘密・実名らしき値の直値検出（12-b）。対象は dify/env/**/env.yml の生テキスト全体
    const SECRET_KEY_RE = /sk-[A-Za-z0-9_-]{6,}/;
    const HEXB64_RE = /\b[0-9a-fA-F]{32,}\b|\b[A-Za-z0-9+]{32,}={0,2}\b/;
    const URL_RE = /https?:\/\/[^\s"'\)]+/g;
    let schemaOk = true, secretsOk = true;

    for (const envName of envDirs) {
      const p = resolve(ENV_ROOT, envName, 'env.yml');
      if (!existsSync(p)) { fail(`${envName}/env.yml が無い`); schemaOk = false; continue; }
      const raw = readFileSync(p, 'utf8');

      // schema / 必須キー（YAML を厳密に解釈せず、行頭キーの存在で確認。verify.mjs は JS のみで完結させるため）
      const hasKey = (re) => re.test(raw);
      if (!/^schema:\s*1\s*$/m.test(raw)) { fail(`${envName}/env.yml の schema が 1 でない`); schemaOk = false; }
      for (const k of REQUIRED_TOP) {
        if (!new RegExp(`^${k}:`, 'm').test(raw)) { fail(`${envName}/env.yml に必須キー ${k} が無い`); schemaOk = false; }
      }
      for (const k of REQUIRED_DIFY) {
        if (!hasKey(new RegExp(`^\\s+${k}:`, 'm'))) { fail(`${envName}/env.yml の dify.${k} が無い`); schemaOk = false; }
      }
      for (const k of REQUIRED_MODELS) {
        if (!hasKey(new RegExp(`^\\s+${k}:`, 'm'))) { fail(`${envName}/env.yml の models.${k} が無い`); schemaOk = false; }
      }
      for (const k of REQUIRED_BRAND) {
        if (!hasKey(new RegExp(`^\\s+${k}:`, 'm'))) { fail(`${envName}/env.yml の brand.${k} が無い`); schemaOk = false; }
      }
      for (const k of REQUIRED_FLAGS) {
        if (!hasKey(new RegExp(`\\b${k}:`, 'm'))) { fail(`${envName}/env.yml の flags.${k} が無い`); schemaOk = false; }
      }
      if (envName !== 'cloud-master' && !new RegExp(`^name:\\s*${envName}\\s*$`, 'm').test(raw)) {
        fail(`${envName}/env.yml の name がディレクトリ名と不一致`);
        schemaOk = false;
      }

      // 秘密・実名の直値
      if (SECRET_KEY_RE.test(raw)) { fail(`${envName}/env.yml に sk- で始まる文字列がある（秘密の直値）`); secretsOk = false; }
      // ${VAR} 由来のトークン自体はハイフンを含み HEXB64_RE に基本ヒットしないが、誤検知を避けるため
      // '${' を含む行は対象から除外する
      const bodyForHex = raw.split('\n').filter(l => !l.includes('${')).join('\n');
      if (HEXB64_RE.test(bodyForHex)) {
        fail(`${envName}/env.yml に 32 文字以上の 16 進／base64 らしき文字列がある（秘密の直値の疑い）`);
        secretsOk = false;
      }
      const urls = [...raw.matchAll(URL_RE)].map(m => m[0].replace(/[,\s]+$/, ''));
      const badUrls = envName === 'cloud-master'
        ? urls.filter(u => !KNOWN_CLOUD_MASTER_URLS.includes(u))
        : urls; // cloud-master 以外は生 URL があってはいけない（${DIFY_BASE_URL} 等で渡す）
      if (badUrls.length) {
        fail(`${envName}/env.yml に想定外の生 URL がある: ${badUrls.join(', ')}`);
        secretsOk = false;
      }
    }
    if (schemaOk) ok('全環境の env.yml が schema: 1 と必須キーを満たす');
    if (secretsOk) ok('dify/env/**/env.yml に秘密・実名の直値なし（sk- / 32+ hex-base64 / 想定外 URL）');

    // 12-e: apps:（Cloud/セルフホストのアプリ id。管理番号は dify/apps/*.yml と 1:1。Issue #114 PR-2）
    const APPS_DIR = resolve(ROOT, 'dify/apps');
    const appCodesOnDisk = existsSync(APPS_DIR)
      ? [...new Set(readdirSync(APPS_DIR).filter(f => f.endsWith('.yml')).map(f => f.split('-').slice(0, 2).join('-')))].sort()
      : [];
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let appsOk = true;
    for (const envName of envDirs) {
      const p = resolve(ENV_ROOT, envName, 'env.yml');
      if (!existsSync(p)) continue; // 既に上で fail 済み
      const raw = readFileSync(p, 'utf8');
      const lines = raw.split('\n');
      const startIdx = lines.findIndex(l => /^apps:\s*$/.test(l));
      if (startIdx === -1) { fail(`${envName}/env.yml に apps: ブロックが無い`); appsOk = false; continue; }

      const entries = {};
      for (let i = startIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (/^\S/.test(line)) break; // 次のトップレベルキーでブロック終端
        if (line.trim() === '' || line.trim().startsWith('#')) continue;
        const m = line.match(/^\s+([A-Za-z0-9_-]+):\s*\{\s*id:\s*(.+?)\s*\}\s*(#.*)?$/);
        if (!m) { fail(`${envName}/env.yml の apps: に解釈できない行がある: ${line.trim()}`); appsOk = false; continue; }
        entries[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
      }

      const codes = Object.keys(entries);
      const badCode = codes.filter(c => !/^[A-Z]{2}-\d{2}$/.test(c));
      if (badCode.length) { fail(`${envName}/env.yml の apps: に管理番号の形式でないキーがある: ${badCode.join(', ')}`); appsOk = false; }

      const missing = appCodesOnDisk.filter(c => !codes.includes(c));
      const extra = codes.filter(c => !appCodesOnDisk.includes(c));
      if (missing.length) { fail(`${envName}/env.yml の apps: に無い管理番号（dify/apps/*.yml にはある）: ${missing.join(', ')}`); appsOk = false; }
      if (extra.length) { fail(`${envName}/env.yml の apps: に dify/apps/*.yml に無い管理番号がある: ${extra.join(', ')}`); appsOk = false; }

      for (const [code, idVal] of Object.entries(entries)) {
        const isNull = idVal === 'null';
        const isVar = /^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(idVal);
        const isUuid = UUID_RE.test(idVal);
        if (!isNull && !isVar && !isUuid) {
          fail(`${envName}/env.yml の apps.${code}.id が null / \${VAR} / UUID のいずれでもない: ${idVal}`);
          appsOk = false;
        }
        if (envName !== 'cloud-master' && isUuid) {
          fail(`${envName}/env.yml の apps.${code}.id に生の UUID が書かれている（顧客環境の値は \${VAR} にする）: ${idVal}`);
          appsOk = false;
        }
      }
    }
    if (appsOk) ok('全環境の env.yml の apps: が dify/apps/*.yml と一致し、id が null/${VAR}/UUID のいずれか（12-e）');
  }

  // 12-c: .gitignore（Secrets / Build）
  const gi = existsSync(resolve(ROOT, '.gitignore')) ? readFileSync(resolve(ROOT, '.gitignore'), 'utf8') : '';
  const giNeeds = ['.env', '.env.*', '*.key', '*.pem', 'secrets/', 'dify/build/'];
  const giMissing = giNeeds.filter(n => !gi.includes(n));
  if (giMissing.length) fail(`.gitignore に無いパターン: ${giMissing.join(', ')}`);
  else ok('.gitignore に Secrets / dify/build/ の除外パターンあり');

  // 12-d: render.py --env cloud-master --all --check（python3 が無ければ warn で skip）
  const renderPy = resolve(ROOT, 'scripts/dify/render.py');
  if (!existsSync(renderPy)) {
    fail('scripts/dify/render.py が無い');
  } else {
    try {
      execFileSync('python3', [renderPy, '--env', 'cloud-master', '--all', '--check'], { cwd: ROOT, stdio: 'pipe' });
      ok('render.py --env cloud-master --all --check が PASS（マスタとバイト一致）');
    } catch (e) {
      if (e && e.code === 'ENOENT') {
        warn('python3 が無いため render.py --check を skip しました');
      } else {
        fail('render.py --env cloud-master --all --check が FAIL（マスタとバイト不一致、または実行エラー）: '
          + String((e && e.stderr && e.stderr.toString()) || e.message || e).split('\n')[0]);
      }
    }
  }
}

/* ---------- 結果 ---------- */
console.log(`\n${fails === 0 ? '✅ ALL PASS' : `❌ ${fails} FAIL`}${warns ? ` / ⚠️ ${warns} warn` : ''}`);
process.exit(fails ? 1 : 0);
