#!/usr/bin/env node
/**
 * tools/check-world.mjs — 架空世界マスタ（data/world/）との食い違いを報告する
 *
 * 設計書 docs/handoff/2026-09-07-repo-layout-v2.md §2-6（PR-1）。
 * 業種対応は docs/handoff/2026-09-08-finance-catalog.md §7-2（PR-2）。
 * 報告するだけ（--strict 以外は常に exit 0）。CI には入れない（npm test に足さない）。
 *
 * 使い方:
 *   node tools/check-world.mjs            報告のみ。常に exit 0
 *   node tools/check-world.mjs --strict   1 件でも不一致なら exit 1（食い違いを潰す PR で使う）
 *   npm run world                          = node tools/check-world.mjs
 *
 * 業種（mfg / fin）ごとに data/world/<業種>/ のマスタと走査対象を対にして回す。
 * 走査対象の振り分け:
 *   - mock/js/data/scenarios/**（台本）: パスに `/scenarios/fin/` を含むものが fin、それ以外は mfg
 *     （現時点では fin 側の台本ディレクトリが無いため、fin の走査対象は 0 件になる。
 *      PR-1 で `scenarios/mfg/` `scenarios/fin/` に分かれたら自動的に効くようになる）
 *   - dify/kb/**・dify/tests/**・docs/dify/usecases/**: ファイルパスから管理番号
 *     （`[A-Z]{2}-\d+`）を抜き、FIN_ONLY_CODES（金融専用の分類コード）に含まれれば fin、
 *     それ以外は mfg。PO/EG のような業種横断コードは、現時点ではまだ実ファイルが
 *     存在しないため mfg 側の既定分類に留めている（両業種化は該当ファイルが増える PR で見直す）
 *
 * 入力: data/world/<業種>/ 配下の csv/md ＋ 上記の走査対象 4 系統
 *
 * 検査（すべて warn。FAIL にしない）:
 *   W1 人名：走査対象に出る人名が people.csv にあるか
 *   W2 役職ゆれ：同じ人名に複数の役職
 *   W3 拠点：company.md の拠点表にない拠点表記
 *   W4 社名：正式名称（ja/zh/en）の表記が company.md と一致するか。英名が使われていない
 *   W5 取引先記号：partners.csv / clients.csv に無い記号、表記ゆれ
 *   W6 文書番号：calendar.md の体系に合わない書式
 *   W7 品番・設備：products.csv/equipment.csv に無いコード（fin は設備を持たないため skip）。
 *      管理番号形式（^[A-Z]{2}-\d{2}$）と衝突するコード
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

// 金融専用の分類コード（設計書 2026-09-08-finance-catalog.md §3-1）。
// PO / EG は業種横断だが、現時点で実ファイル（dify/kb・dify/tests・docs/dify/usecases・台本）が
// 存在しないため、ここでは mfg 側の既定分類のままにしている。
const FIN_ONLY_CODES = new Set(['RS', 'CV', 'FA']);

const warnCounts = { mfg: 0, fin: 0 };
let currentInd = 'mfg';
const section = (t) => console.log(`\n── ${t} ──`);
const report = (m) => { warnCounts[currentInd]++; console.log('⚠️ ', m); };
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

function readCSV(dir, name) {
  const p = resolve(WORLD, dir, name);
  return existsSync(p) ? parseCSV(readFileSync(p, 'utf8')) : [];
}
function readMd(dir, name) {
  const p = resolve(WORLD, dir, name);
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

/* ---------- 走査対象の準備（全体を 1 回だけ読み、業種ごとに振り分ける） ---------- */
const mock = loadMock(ROOT);

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

function extractCode(pathStr) {
  const m = pathStr.match(/\b([A-Z]{2})-\d+/);
  return m ? m[1] : null;
}
function scenarioIdCode(svcId) {
  const m = svcId.match(/^([a-z]+)/);
  return m ? m[1].toUpperCase() : null;
}
function codeBelongsTo(code, ind) {
  if (!code) return ind === 'mfg'; // 不明なものは既定で mfg 扱い（従来どおりの検査対象）
  return ind === 'fin' ? FIN_ONLY_CODES.has(code) : !FIN_ONLY_CODES.has(code);
}

const kbFiles = walkFiles(resolve(ROOT, 'dify/kb'), ['.md'])
  .map(p => ({ src: p.replace(ROOT + '/', ''), text: readFileSync(p, 'utf8') }));
const usecaseFiles = walkFiles(resolve(ROOT, 'docs/dify/usecases'), ['.md'])
  .map(p => ({ src: p.replace(ROOT + '/', ''), text: readFileSync(p, 'utf8') }));
const testFiles = walkFiles(resolve(ROOT, 'dify/tests'), ['.json'])
  .map(p => ({ src: p.replace(ROOT + '/', ''), text: readFileSync(p, 'utf8') }));

function scanTextsFor(ind) {
  // mock.dataSources には scenarios 以外（ui.js/catalog.js/home.js/style.js）も含まれる。
  // これらは業種を問わず両方の検査対象に含める（社名・部署名などは業種ごとに書き分けられていないため）。
  const nonScenario = mock.dataSources
    .filter(f => !f.path.includes('/scenarios/'))
    .map(f => ({ src: f.path, text: f.src }));
  const scenarioOnly = mock.dataSources
    .filter(f => f.path.includes('/scenarios/'))
    .filter(f => ind === 'fin' ? f.path.includes('/scenarios/fin/') : !f.path.includes('/scenarios/fin/'))
    .map(f => ({ src: f.path, text: f.src }));
  const others = [...kbFiles, ...usecaseFiles, ...testFiles]
    .filter(f => codeBelongsTo(extractCode(f.src), ind));
  return { texts: [...nonScenario, ...scenarioOnly, ...others] };
}

/* ============================================================ */
function runIndustryChecks(ind) {
  currentInd = ind;
  const dir = ind;
  const people = readCSV(dir, 'people.csv');
  const products = readCSV(dir, 'products.csv');
  const equipment = ind === 'mfg' ? readCSV(dir, 'equipment.csv') : [];
  const partners = ind === 'mfg' ? readCSV(dir, 'partners.csv') : [...readCSV(dir, 'clients.csv'), ...readCSV(dir, 'vendors.csv')];
  const kpi = readCSV(dir, 'kpi.csv');
  const companyMd = readMd(dir, 'company.md');
  const calendarMd = readMd(dir, 'calendar.md');

  const { texts } = scanTextsFor(ind);
  const allText = texts.map(f => f.text).join('\n');
  // 台本本体（mock/js/data 配下）だけのテキスト。W4（社名）・W5（取引先記号）は
  // 台本ベースの実測と突き合わせるため、こちらを使う
  const mockOnlyText = texts.filter(f => f.src.startsWith('js/data/')).map(f => f.text).join('\n');

  const { data } = mock;

  // このデータ層（SCENARIOS/FEED）はまだ業種で分かれていない（PR-1 の作業）。
  // サービス id の先頭コードで業種を推定して振り分ける。
  function scenariosFor() {
    const out = {};
    if (data.SCENARIOS) {
      for (const id in data.SCENARIOS) {
        const code = scenarioIdCode(id);
        if (codeBelongsTo(code, ind)) out[id] = data.SCENARIOS[id];
      }
    }
    return out;
  }
  const scenarios = scenariosFor();
  // FEED は現時点で単一（業種別に分かれていない）。fin 側にはまだ無いものとして扱う
  const feedPersona = (ind === 'mfg' && data.FEED && data.FEED.persona) ? data.FEED.persona : null;

  /* ---------------------------------------------------------- */
  section(`[${ind}] W1. 人名：走査対象の人名が people.csv にあるか`);
  {
    const known = new Set();
    for (const p of people) { if (p.name_ja) known.add(p.name_ja); if (p.name_zh) known.add(p.name_zh); }
    const personas = [];
    for (const id in scenarios) personas.push(scenarios[id].persona);
    if (feedPersona) personas.push(feedPersona);
    const unregistered = new Set();
    for (const p of personas) {
      if (!p || !p.name) continue;
      if (p.name.ja && !known.has(p.name.ja)) unregistered.add(p.name.ja);
      if (p.name.zh && !known.has(p.name.zh)) unregistered.add(p.name.zh);
    }
    if (unregistered.size) report(`未登録の人名 ${unregistered.size} 件: ${[...unregistered].join('、')}`);
    else ok('SCENARIOS / FEED の人名はすべて people.csv に登録済み');
  }

  /* ---------------------------------------------------------- */
  section(`[${ind}] W2. 役職ゆれ：同じ人名に複数の役職`);
  {
    const byName = new Map();
    for (const id in scenarios) {
      const p = scenarios[id].persona;
      if (!p || !p.name || !p.role) continue;
      const key = p.name.ja;
      if (!byName.has(key)) byName.set(key, new Map());
      const roles = byName.get(key);
      if (!roles.has(p.role.ja)) roles.set(p.role.ja, []);
      roles.get(p.role.ja).push(id);
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

  /* ---------------------------------------------------------- */
  section(`[${ind}] W3. 拠点：company.md の拠点表にない拠点表記`);
  {
    const knownSites = new Set();
    for (const m of companyMd.matchAll(/^\|\s*(\w+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/gm)) {
      knownSites.add(m[2].trim()); knownSites.add(m[3].trim()); knownSites.add(m[4].trim());
    }
    const seen = new Set();
    for (const id in scenarios) {
      const s = scenarios[id].persona && scenarios[id].persona.site;
      if (s) { seen.add(s.ja); seen.add(s.zh); if (s.en) seen.add(s.en); }
    }
    const unknown = [...seen].filter(s => s && ![...knownSites].some(k => k.includes(s) || s.includes(k)));
    if (unknown.length) report(`company.md の拠点表に無い表記: ${unknown.join('、')}`);
    else ok('拠点表記は company.md と整合');
  }

  /* ---------------------------------------------------------- */
  section(`[${ind}] W4. 社名：正式名称（ja/zh/en）の出現回数（台本 mock/js/data 配下）`);
  {
    const m = companyMd.match(/## 社名[\s\S]*?\n\|[^\n]*\|\s*ja\s*\|\s*zh\s*\|\s*en\s*\|\s*\n\|[-\s|]*\n\|\s*[^|]+\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/);
    const strip = (s) => (s || '').trim().replace(/(株式会社|有限公司|股份有限公司)$/, '').replace(/,?\s*Ltd\.\s*$/, '').trim();
    const tokens = m ? { ja: strip(m[1]), zh: strip(m[2]), en: strip(m[3]).split(/\s+/).slice(0, 2).join(' ') } : null;
    if (!tokens) { report('company.md から社名（ja/zh/en）の表を抽出できなかった'); }
    else {
      const jaCount = (mockOnlyText.match(new RegExp(tokens.ja, 'g')) || []).length;
      const zhCount = (mockOnlyText.match(new RegExp(tokens.zh, 'g')) || []).length;
      const enCount = tokens.en ? (mockOnlyText.match(new RegExp(tokens.en, 'g')) || []).length : 0;
      if (jaCount || zhCount || enCount) {
        report(`表記の出現回数: ja「${tokens.ja}」${jaCount} 回 / zh「${tokens.zh}」${zhCount} 回 / en「${tokens.en}」${enCount} 回（company.md の正本と突合。英名がほぼ使われていない）`);
      } else {
        ok(`社名表記「${tokens.ja}／${tokens.zh}」は台本にまだ出現しない（台本未投入のため想定どおり）`);
      }
      if (!companyMd.includes(tokens.ja) || !companyMd.includes(tokens.zh)) {
        report('company.md に ja/zh いずれかの社名表記が無い');
      }
    }
  }

  /* ---------------------------------------------------------- */
  section(`[${ind}] W5. 取引先記号：${ind === 'mfg' ? 'partners.csv' : 'clients.csv'} に無い記号・表記ゆれ（台本 mock/js/data 配下）`);
  {
    const knownCodes = new Set(partners.map(p => p.code));
    if (ind === 'mfg') {
      const withSpace = new Map(), noSpace = new Map();
      for (const m of mockOnlyText.matchAll(/([KSTWABUVJ])(\s?)社/g)) {
        const letter = m[1], sp = m[2] === ' ';
        const map = sp ? withSpace : noSpace;
        map.set(letter, (map.get(letter) || 0) + 1);
      }
      for (const [letter, n] of noSpace) {
        report(`空白ゆれ: 「${letter}社」（半角スペースなし） ${n} 件。正は「${letter} 社」（partners.csv）`);
      }
      for (const letter of new Set([...withSpace.keys(), ...noSpace.keys()])) {
        const code = `${letter} 社`;
        if (!knownCodes.has(code)) report(`partners.csv に無い取引先記号: ${code}`);
      }
      if (!noSpace.size) ok('空白ゆれなし');
    } else {
      // fin: 甲社〜戊社（空白なしが正。data/world/fin/clients.csv 参照）
      const found = new Map();
      for (const m of mockOnlyText.matchAll(/([甲乙丙丁戊])\s?社/g)) {
        found.set(m[1], (found.get(m[1]) || 0) + 1);
      }
      let unknown = 0;
      for (const letter of found.keys()) {
        const code = `${letter}社`;
        if (!knownCodes.has(code)) { unknown++; report(`clients.csv に無い取引先記号: ${code}`); }
      }
      if (!found.size) ok('clients.csv 記号はまだ台本に出現しない（台本未投入のため想定どおり）');
      else if (!unknown) ok('取引先記号はすべて clients.csv に登録済み');
    }
  }

  /* ---------------------------------------------------------- */
  section(`[${ind}] W6. 文書番号：calendar.md の体系に合わない書式`);
  {
    const knownPatterns = ind === 'mfg' ? [
      /^TR-\d{4}-\d{3}$/, /^NC-\d{4}-\d{4}$/, /^8D-\d{2}-\d{4}$/, /^ECR-\d{2}-\d{4}$/,
      /^RFQ-\d{4}-\d{3}$/, /^RFQ-\d{2}-\d{3}$/, /^PO-\d{4}-\d{3}$/, /^C-\d{4}-\d{3}$/,
      /^C-\d{4}-[A-Z]$/, /^RG-\d{2}-\d{4}$/, /^CL-\d{2}-\d{4}$/, /^QR-\d{4}-Q\d-\d{2}$/,
      /^WS-[A-Z]{2}-\d{3}$/, /^PC-L\d-\d{4}-\d{3}$/, /^CM-\d{2}$/, /^QC-\d{2}$/,
      /^VST-\d{4}-\d{3}$/
    ] : [
      /^RNG-\d{4}-\d{4}$/, /^CRD-\d{2}-\d{4}$/, /^NTF-\d{4}-\d{3}$/,
      /^MTG-\d{4}-\d{4}$/, /^CLM-\d{2}-\d{4}$/, /^IRR-\d{4}-\d{3}$/,
      /^VST-\d{4}-\d{3}$/
    ];
    const docPrefixes = ind === 'mfg'
      ? /^(TR|NC|8D|ECR|RFQ|PO|C|RG|CL|QR|WS|CM|QC)-|^PC-L\d-/
      : /^(RNG|CRD|NTF|MTG|CLM|IRR)-/;
    const candidates = new Set((allText.match(/\b[A-Z]{1,4}(-[A-Za-z0-9]{2,4}){1,3}\b/g) || []));
    let unknown = 0;
    for (const c of candidates) {
      if (!docPrefixes.test(c)) continue;
      if (!/\d/.test(c)) continue;
      if (!knownPatterns.some(re => re.test(c))) { unknown++; if (unknown <= 10) report(`calendar.md のどの書式にも一致しない文書番号らしき文字列: ${c}`); }
    }
    if (unknown > 10) console.log(`   ほか ${unknown - 10} 件`);
    if (!unknown) ok('文書番号は calendar.md の体系に一致（該当なしを含む）');
  }

  /* ---------------------------------------------------------- */
  if (ind === 'mfg') {
    section(`[${ind}] W7. 品番・設備：products.csv / equipment.csv に無いコード。管理番号形式との衝突`);
    const knownParts = new Set(products.map(p => p.part_no));
    const knownEquip = new Set(equipment.map(e => e.equip_id));
    const candidates = new Set((allText.match(/\b(SK|PX|DO|ASSY|QS|J|D)-[A-Za-z0-9]{2,5}(-[A-Za-z0-9]+)?\b/g) || []));
    let n = 0;
    for (const c of candidates) {
      if (knownParts.has(c) || knownEquip.has(c)) continue;
      const base = c.replace(/-[A-Z]$/, '');
      if (knownParts.has(base) || knownEquip.has(base)) continue;
      n++;
      if (n <= 15) report(`products.csv / equipment.csv に無いコード: ${c}`);
    }
    if (n > 15) console.log(`   ほか ${n - 15} 件`);
    if (!n) ok('品番・設備コードはすべて登録済み');

    const mgmtLike = new Set((allText.match(/\b[A-Z]{2}-\d{2}\b/g) || []).filter(c => !/^(RG|CL|WS|CM|QC|QR)-/.test(c)));
    if (mgmtLike.size) console.log(`   参考: 管理番号形式（[A-Z]{2}-\\d{2}）と同じ見た目のコード ${mgmtLike.size} 種（うち SVCS 管理番号と紛らわしいものは data/world/README.md の「未統一」#4 を参照）`);
  } else {
    section(`[${ind}] W7. 品番・設備：金融は設備マスタを持たないため skip`);
    ok('金融は equipment.csv を置かない設計（設計書 §7-2）。products.csv（取扱商品）は W1〜W6 と別軸のため単体チェックなし');
  }

  /* ---------------------------------------------------------- */
  section(`[${ind}] W8. KPI：kpi.csv の値と一致しない指標`);
  {
    const kpiChecks = ind === 'mfg'
      ? [
          { id: 'defect_rate', label: '不良率' },
          { id: 'uptime', label: '稼働率' },
        ]
      : [
          { id: 'delinquency_rate', label: '延滞率' },
        ];
    let anyMismatch = false;
    for (const { id, label } of kpiChecks) {
      const row = kpi.find(k => k.kpi_id === id);
      const known = row ? new Set([row.target, row.current, row.prev].filter(Boolean)) : new Set();
      const found = new Set((allText.match(new RegExp(`${label}[：:\\s]*\\**([0-9]+\\.[0-9]+)%`, 'g')) || []).map(s => s.match(/([0-9]+\.[0-9]+)/)[1]));
      const mismatch = [...found].filter(v => !known.has(v));
      if (mismatch.length) { anyMismatch = true; report(`${label}: kpi.csv の基準値（${[...known].join('/')}）と一致しない値 ${mismatch.join('、')}%`); }
    }
    if (!anyMismatch) ok(`${ind === 'mfg' ? '不良率・稼働率' : '延滞率'}は kpi.csv の基準値と一致（該当なしを含む）`);
  }

  /* ---------------------------------------------------------- */
  section(`[${ind}] W9. カバレッジ：people.csv にあるがどこにも出てこない人物`);
  {
    const unused = people.filter(p => p.name_ja && !allText.includes(p.name_ja));
    if (unused.length === people.length && people.length) {
      console.log(`   （台本・KB・テストが未投入のため、${ind} の人物 ${people.length} 名は全員「未出現」— 想定どおり）`);
    } else if (unused.length) {
      report(`どこにも出てこない人物 ${unused.length} 名: ${unused.map(p => p.name_ja).join('、')}`);
    } else {
      ok('people.csv の全員が走査対象に出現');
    }
  }
}

for (const ind of ['mfg', 'fin']) runIndustryChecks(ind);

/* ---------- 結果 ---------- */
const total = warnCounts.mfg + warnCounts.fin;
console.log(`\n製造業（mfg）: ${warnCounts.mfg} 件 ／ 金融（fin）: ${warnCounts.fin} 件`);
console.log(`${total ? `⚠️  合計 ${total} 件の食い違いを報告` : '✅ 食い違いなし'}（このツールは報告のみ。CI には入れない）`);
process.exit(strict && total ? 1 : 0);
