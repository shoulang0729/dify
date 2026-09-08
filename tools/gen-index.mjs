#!/usr/bin/env node
/**
 * tools/gen-index.mjs — docs/service-map.md を生成する
 *
 * 設計書 docs/handoff/2026-09-07-repo-layout-v2.md §1-3（PR-1）。
 *
 * 入力: tools/lib/load.mjs の data.SVCS / data.CATS / data.SCENARIOS（#77 の共通ローダーに乗る）
 *       ＋ 実ファイルの存在:
 *         docs/dify/usecases/<番号>.md
 *         dify/apps/<番号>-*.yml
 *         dify/kb/<番号>/
 *         dify/tests/<番号>.json
 * 出力: docs/service-map.md（1 行 = 1 サービス。先頭に「生成物・手で編集しない」の注記）
 *
 * 使い方:
 *   node tools/gen-index.mjs            生成して docs/service-map.md に書き込む
 *   node tools/gen-index.mjs --check    生成結果と現行ファイルが一致するか検査（不一致なら exit 1）
 *   npm run index / npm run index:check も同じ
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMock } from './lib/load.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'docs/service-map.md');
const APPS_DIR = resolve(ROOT, 'dify/apps');
const KB_DIR = resolve(ROOT, 'dify/kb');
const TESTS_DIR = resolve(ROOT, 'dify/tests');
const USECASES_DIR = resolve(ROOT, 'docs/dify/usecases');

const check = process.argv.includes('--check');

const { data } = loadMock(ROOT);
const SVCS = data.SVCS || [];
const SCENARIOS = data.SCENARIOS || {};

/** 内部 id（例 kn2）→ 管理番号（例 KN-02）。tools/verify.mjs §6 と同じ変換規則 */
function mgmtCode(id) {
  return id.replace(/^([a-z]+)(\d+)$/, (_, a, b) => a.toUpperCase() + '-' + String(b).padStart(2, '0'));
}

const statusText = { 1: '提供中', 2: '試行版', 3: '構想' };
/** 業種 id → 表示ラベル（設計書 2026-09-08-finance-catalog.md §4-8） */
const industryLabel = { mfg: '製造', fin: '金融' };
/** SVCS[].industries（['mfg']/['fin']/['mfg','fin']）→ 「製造」/「金融」/「製造・金融」 */
function industryText(industries) {
  return (industries || []).map(i => industryLabel[i] || i).join('・');
}

const appsFiles = existsSync(APPS_DIR) ? readdirSync(APPS_DIR).filter(f => f.endsWith('.yml')) : [];
const testsFiles = existsSync(TESTS_DIR) ? readdirSync(TESTS_DIR).filter(f => f.endsWith('.json')) : [];

/** KB のファイル数（再帰）。業種横断アプリは dify/kb/<code>/mfg/・fin/ のサブディレクトリに分ける
    想定（設計書 §5-3）。サブディレクトリの有無に関わらず、配下のファイルをすべて数える */
function countFilesRecursive(dir) {
  if (!existsSync(dir)) return 0;
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isDirectory()) n += countFilesRecursive(resolve(dir, entry.name));
    else n++;
  }
  return n;
}

let cDemoMfg = 0, cDemoFin = 0, cDsl = 0, cUsecase = 0, cKb = 0, cTest = 0;

const rows = SVCS.map(s => {
  const code = mgmtCode(s.id);
  const cat = (s.cat || '').toUpperCase();
  const sub = s.sub || '';
  const st = statusText[s.st] || String(s.st);
  const industry = industryText(s.industries);
  const prefix = (s.id.match(/^[a-z]+/) || [''])[0];

  // ①デモ台本（業種ごとに列を分ける。§4-8）
  const demoCellFor = (indId) => {
    const scn = (SCENARIOS[indId] || {})[s.id];
    if (!scn) return '—';
    return `[${indId}/${prefix}.js](../mock/js/data/scenarios/${indId}/${prefix}.js) ${scn.template}`;
  };
  const demoMfgCell = demoCellFor('mfg');
  const demoFinCell = demoCellFor('fin');
  if (demoMfgCell !== '—') cDemoMfg++;
  if (demoFinCell !== '—') cDemoFin++;

  // ②DSL
  const dslFile = appsFiles.find(f => f.startsWith(`${code}-`));
  let dslCell = '—';
  if (dslFile) {
    dslCell = `[${dslFile}](../dify/apps/${dslFile})`;
    cDsl++;
  }

  // ③ユースケース
  const usecasePath = resolve(USECASES_DIR, `${code}.md`);
  let usecaseCell = '—';
  if (existsSync(usecasePath)) {
    usecaseCell = `[${code}.md](./dify/usecases/${code}.md)`;
    cUsecase++;
  }

  // ④KB（再帰カウント。業種横断アプリの mfg/fin サブディレクトリにも対応）
  const kbDir = resolve(KB_DIR, code);
  let kbCell = '—';
  if (existsSync(kbDir)) {
    const n = countFilesRecursive(kbDir);
    if (n > 0) { kbCell = `[${n} 件](../dify/kb/${code}/)`; cKb++; }
  }

  // ④テスト
  const testFile = testsFiles.find(f => f === `${code}.json`);
  let testCell = '—';
  if (testFile) {
    try {
      const parsed = JSON.parse(readFileSync(resolve(TESTS_DIR, testFile), 'utf8'));
      const n = Array.isArray(parsed.cases) ? parsed.cases.length : 0;
      testCell = `[${n} 件](../dify/tests/${testFile})`;
      cTest++;
    } catch {
      testCell = `[?](../dify/tests/${testFile})`;
      cTest++;
    }
  }

  return `| ${code} | ${s.name && s.name.ja} | ${cat}/${sub} | ${industry} | ${st} | ${demoMfgCell} | ${demoFinCell} | ${dslCell} | ${usecaseCell} | ${kbCell} | ${testCell} |`;
});

const header = [
  '<!-- 生成物。手で編集しない。生成コマンド: npm run index （= node tools/gen-index.mjs） -->',
  '',
  '# 管理番号索引',
  '',
  '管理番号（`KN-02` など）から 業種 ①デモ台本（製造・金融） ②DSL ③ユースケース ④KB ④テスト を横断する索引。',
  '`—` は未着手・未投入（欠落が見える設計。設計書 `docs/handoff/2026-09-07-repo-layout-v2.md` §1-3）。',
  '',
];

const tableHeader = [
  '| 管理番号 | サービス | 分類 | 業種 | 成熟度 | ①台本(製造) | ①台本(金融) | ②DSL | ③ユースケース | ④KB | ④テスト |',
  '|---|---|---|---|---|---|---|---|---|---|---|',
];

const summaryRow = `| 集計 | — | — | — | — | ①製造 ${cDemoMfg} | ①金融 ${cDemoFin} | ②${cDsl} | ③${cUsecase} | ④KB ${cKb} | ④テスト ${cTest} |`;

const content = [...header, ...tableHeader, ...rows, summaryRow, ''].join('\n');

if (check) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;
  if (current === content) {
    console.log('✅ docs/service-map.md は最新（gen-index --check）');
    process.exit(0);
  } else {
    console.log('❌ docs/service-map.md が古い、または存在しない。`npm run index` を実行してください。');
    process.exit(1);
  }
} else {
  writeFileSync(OUT, content);
  console.log(`🆕 docs/service-map.md を生成: ${SVCS.length} サービス（①製造${cDemoMfg} ①金融${cDemoFin} ②${cDsl} ③${cUsecase} ④KB${cKb} ④テスト${cTest}）`);
}
