/**
 * tools/lib/load.mjs — mock/ の分割ファイルを読み込む共通ローダー
 *
 * 設計書 docs/handoff/2026-09-07-split-catalog.md §3・§4-1（PR-B）。
 * verify.mjs / regress.mjs はここを経由してデータを取得する（grab() の正規表現抽出は廃止）。
 *
 * loadMock(ROOT) は node:vm の 1 つのコンテキストで、catalog.html に書かれた
 * <script src> の順どおりに mock/js/data/** を実行し、ブラウザと同じ実行順・
 * スコープ規則でデータ定数を取り出す。
 *
 * 制約（load-bearing）：mock/js/data/** は純粋なリテラル宣言のみ。
 * document / localStorage / 関数呼び出しを書かない（vm で実行するため）。
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const DATA_KEYS = ['T', 'PATTERNS', 'TAGS', 'TEMPLATES', 'INDUSTRIES', 'CATS', 'SVCS', 'CAT_STYLE', 'HOME', 'FEED', 'LIVE'];

export function loadMock(ROOT) {
  const MOCK = resolve(ROOT, 'mock');
  const HTML_PATH = resolve(MOCK, 'catalog.html');
  const INDEX_PATH = resolve(MOCK, 'index.html');
  const TOKENS_CSS_PATH = resolve(MOCK, 'css/tokens.css');
  const COMPONENTS_CSS_PATH = resolve(MOCK, 'css/components.css');

  const html = existsSync(HTML_PATH) ? readFileSync(HTML_PATH, 'utf8') : '';
  const indexHtml = existsSync(INDEX_PATH) ? readFileSync(INDEX_PATH, 'utf8') : '';
  const tokenCss = existsSync(TOKENS_CSS_PATH) ? readFileSync(TOKENS_CSS_PATH, 'utf8') : '';
  const componentCss = existsSync(COMPONENTS_CSS_PATH) ? readFileSync(COMPONENTS_CSS_PATH, 'utf8') : '';

  const cssLinks = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)">/g)].map(m => m[1]);
  const scriptSrcs = [...html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)].map(m => m[1]);

  // インライン <script>（src なし）。PR-B 時点ではアプリ層（state 以降）がここに残る。
  // PR-C でアプリ層も js/app.js / js/render.js / js/events.js に分割されると空になる。
  const inlineMatch = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/);
  const appInline = inlineMatch ? inlineMatch[1] : '';

  const jsSources = scriptSrcs.map(src => {
    const path = resolve(MOCK, src);
    return { path: src, src: existsSync(path) ? readFileSync(path, 'utf8') : '' };
  });

  const dataSources = jsSources.filter(f => f.path.startsWith('js/data/'));
  const appSourcesFromFiles = jsSources.filter(f => !f.path.startsWith('js/data/'));
  // アプリ層の検査対象（§7）：分割済みアプリ JS（あれば）＋ catalog.html のインライン <script>
  const appSources = [
    ...appSourcesFromFiles,
    ...(appInline ? [{ path: 'catalog.html (inline <script>)', src: appInline }] : [])
  ];

  // ---- node:vm の 1 コンテキストで js/data/** を <script src> の順に実行 ----
  const ctx = vm.createContext({});
  vm.runInContext('var window = globalThis;', ctx);
  const vmErrors = [];
  for (const f of dataSources) {
    try {
      new vm.Script(f.src, { filename: f.path }).runInContext(ctx);
    } catch (e) {
      vmErrors.push(`${f.path}: ${e.message}`);
    }
  }

  const readVar = (name) => {
    try {
      return vm.runInContext(`typeof ${name} !== 'undefined' ? ${name} : undefined`, ctx);
    } catch {
      return undefined;
    }
  };
  const data = {};
  for (const k of DATA_KEYS) data[k] = readVar(k);
  data.SCENARIOS = vm.runInContext(`(typeof window !== 'undefined' && window.SCENARIOS) || undefined`, ctx);

  return {
    html, indexHtml,
    cssLinks, scriptSrcs,
    tokenCss, componentCss,
    jsSources, dataSources, appSources,
    data,
    vmErrors
  };
}

/**
 * loadPortal(ROOT) — mock/portal.html を同じ作法で読む。loadMock() は 1 バイトも変えていない
 * （設計書 docs/handoff/2026-09-11-portal-mock-pages.md §9-1）。
 *
 * portal.html が無い（この PR がマージされる前の main など）ときは null を返す。呼び出し側
 * （verify.mjs §17）はこれで節ごと skip する（§16 と同じ作法）。
 */
const PORTAL_DATA_KEYS = [
  // 共有データ層（catalog と同じ。js/data/ui.js・catalog.js・style.js）
  'T', 'PATTERNS', 'TAGS', 'TEMPLATES', 'INDUSTRIES', 'CATS', 'SVCS', 'CAT_STYLE',
  // ポータル固有データ層（js/data/portal/**）
  'PT', 'PGRP', 'PSCREENS', 'PHOW', 'PHOWLONG', 'PST',
  'PSVC', 'PLACE', 'PNEW', 'PSTAGE_AI',
  'PORG',
  'PSTAGE', 'PDEALS', 'PCUST', 'PCONTACT', 'PHIST', 'PNEWS', 'PVENDOR',
  'PACT', 'PCAND', 'PMEET', 'PKNOW', 'PKNOWACT',
  'PPEOPLE', 'PATT', 'PKPI', 'PKPITOPIC', 'PSRC', 'PGOAL', 'PQTR', 'PCUR_Q',
  'PEXP', 'PREQ', 'PTRAIN', 'PMYTRAIN', 'PMYITEM', 'PTODO_STATE', 'PSURVEY', 'PMYSURVEY'
];

export function loadPortal(ROOT) {
  const MOCK = resolve(ROOT, 'mock');
  const HTML_PATH = resolve(MOCK, 'portal.html');
  if (!existsSync(HTML_PATH)) return null;

  const html = readFileSync(HTML_PATH, 'utf8');
  const cssLinks = [...html.matchAll(/<link\s+rel="stylesheet"\s+href="([^"]+)">/g)].map(m => m[1]);
  const scriptSrcs = [...html.matchAll(/<script\s+src="([^"]+)"\s*><\/script>/g)].map(m => m[1]);
  const inlineScriptCount = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)].length;
  const styleCount = [...html.matchAll(/<style[\s>]/g)].length;
  const portalCssPath = resolve(MOCK, 'css/portal.css');
  const portalCss = existsSync(portalCssPath) ? readFileSync(portalCssPath, 'utf8') : '';

  const jsSources = scriptSrcs.map(src => {
    const path = resolve(MOCK, src);
    return { path: src, src: existsSync(path) ? readFileSync(path, 'utf8') : '' };
  });
  const dataSources = jsSources.filter(f => f.path.startsWith('js/data/'));
  const appSources = jsSources.filter(f => f.path.startsWith('js/portal/'));

  const ctx = vm.createContext({});
  vm.runInContext('var window = globalThis;', ctx);
  const vmErrors = [];
  for (const f of dataSources) {
    try {
      new vm.Script(f.src, { filename: f.path }).runInContext(ctx);
    } catch (e) {
      vmErrors.push(`${f.path}: ${e.message}`);
    }
  }
  const readVar = (name) => {
    try {
      return vm.runInContext(`typeof ${name} !== 'undefined' ? ${name} : undefined`, ctx);
    } catch {
      return undefined;
    }
  };
  const data = {};
  for (const k of PORTAL_DATA_KEYS) data[k] = readVar(k);
  data.SCENARIOS = vm.runInContext(`(typeof window !== 'undefined' && window.SCENARIOS) || undefined`, ctx);

  return {
    html, cssLinks, scriptSrcs, inlineScriptCount, styleCount,
    portalCss,
    jsSources, dataSources, appSources,
    data,
    vmErrors
  };
}
