#!/usr/bin/env node
/**
 * tools/check-world.mjs — 架空世界マスタ（data/world/）との食い違いを報告する
 *
 * 設計書 docs/handoff/2026-09-07-repo-layout-v2.md §2-6（PR-1）。
 * 報告するだけ（--strict 以外は常に exit 0）。CI には入れない（npm test に足さない）。
 *
 * 使い方:
 *   node tools/check-world.mjs            報告のみ。常に exit 0
 *   node tools/check-world.mjs --strict   1 件でも不一致なら exit 1（食い違いを潰す PR で使う）
 *   npm run world                          = node tools/check-world.mjs
 *
 * 入力: data/world 配下の csv/md ＋ 走査対象 4 系統
 *   - mock/js/data 配下（tools/lib/load.mjs の data と生テキストの両方）
 *   - dify/kb 配下の md
 *   - dify/tests 配下の json
 *   - docs/dify/usecases 配下の md
 *
 * 検査（すべて warn。FAIL にしない）:
 *   W1 人名：走査対象に出る人名が people.csv にあるか
 *   W2 役職ゆれ：同じ人名に複数の役職
 *   W3 拠点：company.md の拠点表にない拠点表記
 *   W4 社名：青嶺精工／青岭精工／英名 の表記が company.md と一致するか。英名が使われていない
 *   W5 取引先記号：partners.csv にない記号、空白ゆれ（K社 と K 社）
 *   W6 文書番号：calendar.md の体系に合わない書式
 *   W7 品番・設備：products.csv/equipment.csv にないコード。管理番号形式（^[A-Z]{2}-\d{2}$）と衝突するコード
 *   W8 KPI：kpi.csv の指標名が出ているのに値が基準値・目標・前月のどれとも一致しない
 *   W9 カバレッジ：people.csv にあるがどこにも出てこない人物
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMock } from './lib/load.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORLD = resolve(ROOT, 'data/world');
const strict = process.argv.includes('--strict');

let warns = 0;
const section = (t) => console.log(`\n── ${t} ──`);
const report = (m) => { warns++; console.log('⚠️ ', m); };
const ok = (m) => console.log('✅', m);

/* ---------- CSV パーサ（簡易。ダブルクォート内のカンマ・改行に対応） ---------- */
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift() || [];
  return rows.filter(r => r.some(v => v !== '')).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] || ''])));
}

function readCSV(name) {
  const p = resolve(WORLD, name);
  return existsSync(p) ? parseCSV(readFileSync(p, 'utf8')) : [];
}
function readMd(name) {
  const p = resolve(WORLD, name);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

const people = readCSV('people.csv');
const products = readCSV('products.csv');
const equipment = readCSV('equipment.csv');
const partners = readCSV('partners.csv');
const kpi = readCSV('kpi.csv');
const companyMd = readMd('company.md');
const calendarMd = readMd('calendar.md');

/* ---------- 走査対象テキストを 1 本に連結（出典タグ付き） ---------- */
const mock = loadMock(ROOT);
const scanTexts = [];
for (const f of mock.dataSources) scanTexts.push({ src: f.path, text: f.src });

function walkFiles(dir, exts) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, name.name);
    if (name.isDirectory()) out.push(...walkFiles(p, exts));
    else if (exts.includes(extname(name.name))) out.push(p);
  }
  return out;
}
for (const p of walkFiles(resolve(ROOT, 'dify/kb'), ['.md'])) {
  scanTexts.push({ src: p.replace(ROOT + '/', ''), text: readFileSync(p, 'utf8') });
}
for (const p of walkFiles(resolve(ROOT, 'docs/dify/usecases'), ['.md'])) {
  scanTexts.push({ src: p.replace(ROOT + '/', ''), text: readFileSync(p, 'utf8') });
}
for (const p of walkFiles(resolve(ROOT, 'dify/tests'), ['.json'])) {
  scanTexts.push({ src: p.replace(ROOT + '/', ''), text: readFileSync(p, 'utf8') });
}

const allText = scanTexts.map(f => f.text).join('\n');
// 台本本体（mock/js/data 配下）だけのテキスト。W4（社名）・W5（取引先記号）は
// 設計書 §2-3 の実測（台本ベース）と突き合わせるため、こちらを使う
const mockOnlyText = mock.dataSources.map(f => f.src).join('\n');

/* ============================================================ */
section('W1. 人名：走査対象の人名が people.csv にあるか');
{
  const known = new Set();
  for (const p of people) { if (p.name_ja) known.add(p.name_ja); if (p.name_zh) known.add(p.name_zh); }
  const { data } = mock;
  const personas = [];
  if (data.SCENARIOS) for (const id in data.SCENARIOS) personas.push(data.SCENARIOS[id].persona);
  if (data.FEED && data.FEED.persona) personas.push(data.FEED.persona);
  const unregistered = new Set();
  for (const p of personas) {
    if (!p || !p.name) continue;
    if (p.name.ja && !known.has(p.name.ja)) unregistered.add(p.name.ja);
    if (p.name.zh && !known.has(p.name.zh)) unregistered.add(p.name.zh);
  }
  if (unregistered.size) report(`未登録の人名 ${unregistered.size} 件: ${[...unregistered].join('、')}`);
  else ok('SCENARIOS / FEED の人名はすべて people.csv に登録済み');
}

/* ============================================================ */
section('W2. 役職ゆれ：同じ人名に複数の役職');
{
  const { data } = mock;
  const byName = new Map();
  if (data.SCENARIOS) {
    for (const id in data.SCENARIOS) {
      const p = data.SCENARIOS[id].persona;
      if (!p || !p.name || !p.role) continue;
      const key = p.name.ja;
      if (!byName.has(key)) byName.set(key, new Map());
      const roles = byName.get(key);
      if (!roles.has(p.role.ja)) roles.set(p.role.ja, []);
      roles.get(p.role.ja).push(id);
    }
  }
  let n = 0;
  for (const [name, roles] of byName) {
    if (roles.size > 1) {
      n++;
      const detail = [...roles.entries()].map(([role, ids]) => `${role}（${ids.join(',')}）`).join(' / ');
      report(`役職ゆれ: ${name} — ${detail}`);
    }
  }
  if (!n) ok('役職ゆれなし');
  else console.log(`   計 ${n} 名`);
}

/* ============================================================ */
section('W3. 拠点：company.md の拠点表にない拠点表記');
{
  const { data } = mock;
  const knownSites = new Set();
  for (const m of companyMd.matchAll(/^\|\s*(\w+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/gm)) {
    knownSites.add(m[2].trim()); knownSites.add(m[3].trim()); knownSites.add(m[4].trim());
  }
  const seen = new Set();
  if (data.SCENARIOS) for (const id in data.SCENARIOS) {
    const s = data.SCENARIOS[id].persona && data.SCENARIOS[id].persona.site;
    if (s) { seen.add(s.ja); seen.add(s.zh); if (s.en) seen.add(s.en); }
  }
  const unknown = [...seen].filter(s => s && ![...knownSites].some(k => k.includes(s) || s.includes(k)));
  if (unknown.length) report(`company.md の拠点表に無い表記: ${unknown.join('、')}`);
  else ok('拠点表記は company.md と整合');
}

/* ============================================================ */
section('W4. 社名：青嶺精工／青岭精工／英名 の出現回数（台本 mock/js/data 配下）');
{
  const jaCount = (mockOnlyText.match(/青嶺精工/g) || []).length;
  const zhCount = (mockOnlyText.match(/青岭精工/g) || []).length;
  const enCount = (mockOnlyText.match(/Seirei Seiko/g) || []).length;
  report(`表記の出現回数: ja「青嶺精工」${jaCount} 回 / zh「青岭精工」${zhCount} 回 / en「Seirei Seiko」${enCount} 回（company.md の正本と突合。英名がほぼ使われていない）`);
  if (!companyMd.includes('青嶺精工') || !companyMd.includes('青岭精工') || !companyMd.includes('Seirei Seiko')) {
    report('company.md に ja/zh/en いずれかの社名表記が無い');
  }
}

/* ============================================================ */
section('W5. 取引先記号：partners.csv に無い記号・空白ゆれ（台本 mock/js/data 配下）');
{
  const withSpace = new Map(), noSpace = new Map();
  for (const m of mockOnlyText.matchAll(/([KSTWABUVJ])(\s?)社/g)) {
    const letter = m[1], sp = m[2] === ' ';
    const map = sp ? withSpace : noSpace;
    map.set(letter, (map.get(letter) || 0) + 1);
  }
  const knownCodes = new Set(partners.map(p => p.code));
  for (const [letter, n] of noSpace) {
    report(`空白ゆれ: 「${letter}社」（半角スペースなし） ${n} 件。正は「${letter} 社」（partners.csv）`);
  }
  for (const letter of new Set([...withSpace.keys(), ...noSpace.keys()])) {
    const code = `${letter} 社`;
    if (!knownCodes.has(code)) report(`partners.csv に無い取引先記号: ${code}`);
  }
  if (!noSpace.size) ok('空白ゆれなし');
}

/* ============================================================ */
section('W6. 文書番号：calendar.md の体系に合わない書式');
{
  const knownPatterns = [
    /^TR-\d{4}-\d{3}$/, /^NC-\d{4}-\d{4}$/, /^8D-\d{2}-\d{4}$/, /^ECR-\d{2}-\d{4}$/,
    /^RFQ-\d{4}-\d{3}$/, /^RFQ-\d{2}-\d{3}$/, /^PO-\d{4}-\d{3}$/, /^C-\d{4}-\d{3}$/,
    /^C-\d{4}-[A-Z]$/, /^RG-\d{2}-\d{4}$/, /^CL-\d{2}-\d{4}$/, /^QR-\d{4}-Q\d-\d{2}$/,
    /^WS-[A-Z]{2}-\d{3}$/, /^PC-L\d-\d{4}-\d{3}$/, /^CM-\d{2}$/, /^QC-\d{2}$/
  ];
  const candidates = new Set((allText.match(/\b[A-Z]{1,4}(-[A-Za-z0-9]{2,4}){1,3}\b/g) || []));
  // PC-NN（platform-components.md の共通部品番号。docs/dify/usecases が多用）は別の採番体系なので対象外。
  // PC-L<N>-YYYY-NNN（工程条件書）だけ対象にする
  const docPrefixes = /^(TR|NC|8D|ECR|RFQ|PO|C|RG|CL|QR|WS|CM|QC)-|^PC-L\d-/;
  let unknown = 0;
  for (const c of candidates) {
    if (!docPrefixes.test(c)) continue;
    if (!/\d/.test(c)) continue; // 「NC-YYYY-NNNN」のような書式説明の引用（数字を含まない）は対象外
    if (!knownPatterns.some(re => re.test(c))) { unknown++; if (unknown <= 10) report(`calendar.md のどの書式にも一致しない文書番号らしき文字列: ${c}`); }
  }
  if (unknown > 10) console.log(`   ほか ${unknown - 10} 件`);
  if (!unknown) ok('文書番号は calendar.md の体系に一致');
}

/* ============================================================ */
section('W7. 品番・設備：products.csv / equipment.csv に無いコード。管理番号形式との衝突');
{
  const knownParts = new Set(products.map(p => p.part_no));
  const knownEquip = new Set(equipment.map(e => e.equip_id));
  const candidates = new Set((allText.match(/\b(SK|PX|DO|ASSY|QS|J|D)-[A-Za-z0-9]{2,5}(-[A-Za-z0-9]+)?\b/g) || []));
  let n = 0;
  for (const c of candidates) {
    if (knownParts.has(c) || knownEquip.has(c)) continue;
    // 枝番なしの正規化も試す（例 SK-3318-A の -A を除いた SK-3318 が登録済みか）
    const base = c.replace(/-[A-Z]$/, '');
    if (knownParts.has(base) || knownEquip.has(base)) continue;
    n++;
    if (n <= 15) report(`products.csv / equipment.csv に無いコード: ${c}`);
  }
  if (n > 15) console.log(`   ほか ${n - 15} 件`);
  if (!n) ok('品番・設備コードはすべて登録済み');

  // 管理番号形式 ^[A-Z]{2}-\d{2}$ と衝突するコード（DC-02 等）
  const mgmtLike = new Set((allText.match(/\b[A-Z]{2}-\d{2}\b/g) || []).filter(c => !/^(RG|CL|WS|CM|QC|QR)-/.test(c)));
  if (mgmtLike.size) console.log(`   参考: 管理番号形式（[A-Z]{2}-\\d{2}）と同じ見た目のコード ${mgmtLike.size} 種（うち SVCS 管理番号と紛らわしいものは data/world/README.md の「未統一」#4 を参照）`);
}

/* ============================================================ */
section('W8. KPI：kpi.csv の値と一致しない指標');
{
  const defectRow = kpi.find(k => k.kpi_id === 'defect_rate');
  const knownDefectValues = defectRow ? new Set([defectRow.target, defectRow.current, defectRow.prev].filter(Boolean)) : new Set();
  const foundDefect = new Set((allText.match(/不良率[：:\s]*\**([0-9]+\.[0-9]+)%/g) || []).map(s => s.match(/([0-9]+\.[0-9]+)/)[1]));
  const mismatchDefect = [...foundDefect].filter(v => !knownDefectValues.has(v));
  if (mismatchDefect.length) report(`不良率: kpi.csv の基準値（${[...knownDefectValues].join('/')}）と一致しない値 ${mismatchDefect.join('、')}%（週報の別集計・改善事例など別文脈の可能性。data/world/README.md の「未統一」#9 参照）`);

  const uptimeRow = kpi.find(k => k.kpi_id === 'uptime');
  const knownUptimeValues = uptimeRow ? new Set([uptimeRow.current, uptimeRow.prev].filter(Boolean)) : new Set();
  const foundUptime = new Set((allText.match(/稼働率[：:\s]*\**([0-9]+\.[0-9]+)%/g) || []).map(s => s.match(/([0-9]+\.[0-9]+)/)[1]));
  const mismatchUptime = [...foundUptime].filter(v => !knownUptimeValues.has(v));
  if (mismatchUptime.length) report(`稼働率: kpi.csv の基準値（${[...knownUptimeValues].join('/')}）と一致しない値 ${mismatchUptime.join('、')}%`);

  if (!mismatchDefect.length && !mismatchUptime.length) ok('不良率・稼働率は kpi.csv の基準値と一致');
}

/* ============================================================ */
section('W9. カバレッジ：people.csv にあるがどこにも出てこない人物');
{
  const unused = people.filter(p => p.name_ja && !allText.includes(p.name_ja));
  if (unused.length) report(`どこにも出てこない人物 ${unused.length} 名: ${unused.map(p => p.name_ja).join('、')}`);
  else ok('people.csv の全員が走査対象に出現');
}

/* ---------- 結果 ---------- */
console.log(`\n${warns ? `⚠️  ${warns} 件の食い違いを報告` : '✅ 食い違いなし'}（このツールは報告のみ。CI には入れない）`);
process.exit(strict && warns ? 1 : 0);
