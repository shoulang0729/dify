#!/usr/bin/env node
/**
 * tools/verify.mjs — 静的検証ハーネス（CLAUDE.md §2 load-bearing の機械検出）
 *
 * 使い方:  node tools/verify.mjs
 * 終了コード: 0 = 全 PASS / 1 = 1つ以上 FAIL
 *
 * チェック項目:
 *   1. JS 構文（<script> を抽出して node --check）
 *   2. i18n キー集合の一致（T / TAGS / PATTERNS / CATS / SVCS が ja/zh/en を全て持ち、空でない。en にかな残りなし）
 *   3. 未定義キー参照（t('key') / T.key が T に存在するか）
 *   4. 未使用キー（T にあるがどこからも参照されない）※警告扱い（FAIL にしない）
 *   5. CSS トークン（var(--x) が定義済みか / dark ブロック存在 / コンポーネント CSS に色直値なし / --ntt-* が dark で上書きされていない）
 *   6. データ整合（SVCS の cat/sub が CATS に存在、tags が TAGS に存在、st ∈ {1,2,3}）
 *   7. 共通レイヤー契約（state の必須キー / data-act 一覧 / detectLang 存在 / localStorage キー）
 *   8. Pages 設定（pages.yml の path: mock / mock/.nojekyll）
 *   9. シナリオ整合（SCENARIOS の id が SVCS に存在／template が TEMPLATES に存在／台本の無い SVCS は warn）
 */
import { readFileSync, existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = resolve(ROOT, 'mock/catalog.html');
const LANGS = ['ja', 'zh', 'en'];

let fails = 0, warns = 0;
const ok   = (m) => console.log('✅', m);
const fail = (m) => { fails++; console.log('❌', m); };
const warn = (m) => { warns++; console.log('⚠️ ', m); };
const section = (t) => console.log(`\n── ${t} ──`);

if (!existsSync(HTML)) { fail(`not found: ${HTML}`); process.exit(1); }
const html = readFileSync(HTML, 'utf8');

/* ---------- 抽出 ---------- */
const scriptMatch = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/);
const script = scriptMatch ? scriptMatch[1] : '';
const styleBlocks = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]);
const tokenCss = styleBlocks[0] || '';       // トークン定義（:root 群）
const componentCss = styleBlocks[1] || '';   // コンポーネント CSS

/** ソース中の `const NAME = <literal>;` を安全に評価して取り出す */
function grab(name) {
  const re = new RegExp(`const ${name} = (\\[[\\s\\S]*?\\n\\]|\\{[\\s\\S]*?\\n\\});`);
  const m = script.match(re);
  if (!m) return null;
  try { return Function(`"use strict"; return (${m[1]});`)(); }
  catch (e) { fail(`${name}: リテラル評価に失敗 — ${e.message}`); return null; }
}

/* ---------- 1. JS 構文 ---------- */
section('1. JS 構文');
if (!script) fail('<script> ブロックが見つからない');
else {
  const tmp = resolve(ROOT, 'tools/.verify-tmp.js');
  writeFileSync(tmp, script);
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); ok('node --check PASS'); }
  catch (e) { fail('node --check FAIL\n' + String(e.stderr || e.message)); }
  finally { unlinkSync(tmp); }
}

/* ---------- 2. i18n キー集合 ---------- */
section('2. i18n キー集合（ja / zh / en）');
const T = grab('T'), TAGS = grab('TAGS'), PATTERNS = grab('PATTERNS'), CATS = grab('CATS'), SVCS = grab('SVCS');
const TEMPLATES = grab('TEMPLATES'), SCENARIOS = grab('SCENARIOS');
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
  for (const m of script.matchAll(/\bt\(\s*'([A-Za-z0-9_]+)'\s*\)/g)) refs.add(m[1]);
  for (const m of script.matchAll(/\bT\.([A-Za-z0-9_]+)\b/g)) refs.add(m[1]);
  const undef = [...refs].filter(k => !(k in T));
  if (undef.length) fail(`未定義キー参照: ${undef.join(', ')}`); else ok(`未定義キー参照なし（参照 ${refs.size} 件）`);
  const unused = Object.keys(T).filter(k => !refs.has(k));
  if (unused.length) warn(`未使用キー: ${unused.join(', ')}`); else ok('未使用キーなし');
}

/* ---------- 5. CSS トークン ---------- */
section('5. CSS トークン');
{
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
  const stateM = script.match(/const state = \{([\s\S]*?)\};/);
  const required = ['pattern', 'lang', 'theme', 'openCats', 'selCat', 'selSub', 'lastCat', 'selSvc', 'view', 'query'];
  if (!stateM) fail('const state = {…} が見つからない');
  else {
    const keys = new Set([...stateM[1].matchAll(/^\s*([a-zA-Z]+)\s*:/gm)].map(m => m[1]));
    const missing = required.filter(k => !keys.has(k));
    if (missing.length) fail(`state に必須キーが無い: ${missing.join(', ')}`); else ok(`state 必須キー ${required.length} 件 OK`);
  }
  const acts = new Set([...script.matchAll(/act === '([a-z]+)'/g)].map(m => m[1]));
  const requiredActs = ['pattern', 'all', 'cat', 'sub', 'svc', 'back', 'backdetail', 'start', 'send', 'run', 'chip', 'restart', 'gocat'];
  const missingActs = requiredActs.filter(a => !acts.has(a));
  if (missingActs.length) fail(`data-act ハンドラが無い: ${missingActs.join(', ')}`); else ok(`data-act ${requiredActs.length} 種 OK`);

  if (!/function detectLang\(/.test(script)) fail('detectLang() が無い（§2-5）'); else ok('detectLang() あり');
  for (const k of ['mock.lang', 'mock.theme']) {
    if (!script.includes(`'${k}'`)) fail(`localStorage キー '${k}' が見当たらない（§2-6）`);
  }
  if (script.includes(`'mock.lang'`) && script.includes(`'mock.theme'`)) ok('localStorage キー mock.lang / mock.theme OK');
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
  if (!existsSync(resolve(ROOT, 'mock/.nojekyll'))) fail('mock/.nojekyll が無い'); else ok('mock/.nojekyll あり');
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
} else {
  fail('SCENARIOS / SVCS / TEMPLATES のいずれかが取得できない');
}

/* ---------- 10. ホームデータ整合（HOME / FEED） ---------- */
section('10. ホームデータ整合（HOME / FEED）');
{
  const HOME = grab('HOME'), FEED = grab('FEED');
  const svcIds = SVCS ? new Set(SVCS.map(s => s.id)) : new Set();
  const catIds = CATS ? new Set(CATS.map(c => c.id)) : new Set();
  let bad = 0;

  if (!HOME) { fail('HOME が取得できない（grab() の正規表現に合わない書き方の可能性）'); bad++; }
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

  // FEED（③）は PR-2 で実装。存在すれば整合を検査する
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
