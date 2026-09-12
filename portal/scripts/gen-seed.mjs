#!/usr/bin/env node
/**
 * portal/scripts/gen-seed.mjs — portal/seed/** を生成する（生成物。手で編集しない）
 *
 * 設計書: docs/handoff/2026-09-11-repo-layout-v3.md §2-5・§4-2 S-1。
 *
 * 入力（すべて shoulang0729/dify 側。正本）:
 *   data/world/{mfg,fin,it}/{company.md,org.csv,people.csv}  … 架空世界（人名・部署・拠点）
 *   mock/js/data/catalog.js（CATS/SVCS）・ui.js（INDUSTRIES）                … サービスカタログ・管理番号
 *   mock/js/data/portal/{common,mgmt}.js（PKNOW/PKPITOPIC/PGOAL）           … ナレッジ 46・KPI 52・MBO 8 の名前（ja）・属性
 *   data/world/it/{knowledge_categories,kpi_topics,goal_topics}.csv        … 上記の名前の zh/en（ja はモックとバイト一致する前提。
 *                                                                             設計書 docs/handoff/2026-09-12-portal-indicators-i18n.md §2-3・§7）
 *   dify/env/cloud-master/env.yml の apps:                                  … 管理番号 → Dify アプリ id
 *
 * 出力: portal/seed/world/**・portal/seed/catalog.json・portal/seed/apps.json
 *
 * 使い方:
 *   node scripts/gen-seed.mjs            生成して portal/seed/** に書き込む
 *   node scripts/gen-seed.mjs --check    生成結果と現行 portal/seed/** がバイト一致するか検査（不一致なら exit 1）
 *
 * S-1（切り出し可能性）: このファイルはリポジトリ外（../）を読む数少ない例外の 1 つ。
 * 正本（../data/world 等）が見つからないとき（portal/ を切り出した後の単体チェックアウト）は
 * エラーにせず、呼び出し元（tools/check-seed-fresh.mjs）が skip する。このファイル自身は
 * 正本が無ければ「生成できない」旨を出して exit 1 にする（--check 以外での直接実行は正本がある前提のため）。
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PORTAL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIFY_ROOT = resolve(PORTAL_ROOT, '..');
const WORLD_DIR = resolve(DIFY_ROOT, 'data/world');
const SEED_DIR = resolve(PORTAL_ROOT, 'seed');
const check = process.argv.includes('--check');

const INDUSTRIES_ORDER = ['mfg', 'fin', 'it'];
const WORLD_FILES = ['company.md', 'org.csv', 'people.csv'];

function readIfExists(p) {
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

/** company.md / org.csv / people.csv に生成物の出典コメントを 1 行足す（元ファイルの中身は 1 バイトも変えない） */
function withSourceBanner(relSrcPath, text, isMarkdown) {
  const banner = isMarkdown
    ? `<!-- 生成物。手で編集しない。node portal/scripts/gen-seed.mjs で shoulang0729/dify の ${relSrcPath} から生成 -->\n`
    : `# 生成物。手で編集しない。node portal/scripts/gen-seed.mjs で shoulang0729/dify の ${relSrcPath} から生成\n`;
  return banner + text;
}

function buildWorldFiles() {
  const files = {};
  for (const ind of INDUSTRIES_ORDER) {
    for (const name of WORLD_FILES) {
      const srcPath = resolve(WORLD_DIR, ind, name);
      const text = readIfExists(srcPath);
      if (text == null) continue; // it/company.md 等、無いファイルは飛ばす（world 側の構成差はそのまま反映する）
      const rel = `world/${ind}/${name}`;
      files[rel] = withSourceBanner(`data/world/${ind}/${name}`, text, name.endsWith('.md'));
    }
  }
  return files;
}

/* ---- mock/js/data/** を vm で読む（tools/lib/load.mjs をそのまま使う。S-1 の例外） ---- */
async function loadMockData() {
  const { loadMock, loadPortal } = await import(pathToFileURL(resolve(DIFY_ROOT, 'tools/lib/load.mjs')));
  const mockOut = loadMock(DIFY_ROOT);
  const portalOut = loadPortal(DIFY_ROOT);
  return { mock: mockOut, portal: portalOut };
}

function mgmtCode(id) {
  return id.replace(/^([a-z]+)(\d+)$/, (_, a, b) => a.toUpperCase() + '-' + String(b).padStart(2, '0'));
}

const pad2 = (n) => String(n).padStart(2, '0');

/* 正本 CSV 3 本（data/world/it/{knowledge_categories,kpi_topics,goal_topics}.csv）を読み、
 * code → { name_zh, name_en, ... } の Map にする。ヘッダはクォート無し・ASCII カンマ無し前提
 * （設計書 §6-1）なので単純な split(',') で十分（tools/verify.mjs §19 と同じ作法）。 */
function parseI18nCsv(path) {
  const raw = readIfExists(path);
  if (raw == null) return null;
  const lines = raw.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  const header = lines[0].split(',');
  const rows = lines.slice(1).map(line => {
    const cols = line.split(',');
    const obj = {};
    header.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
    return obj;
  });
  return { header, rows, byCode: new Map(rows.map(r => [r.code, r])) };
}

function loadI18nMaps() {
  const files = {
    know: resolve(WORLD_DIR, 'it/knowledge_categories.csv'),
    kpi: resolve(WORLD_DIR, 'it/kpi_topics.csv'),
    goal: resolve(WORLD_DIR, 'it/goal_topics.csv'),
  };
  const out = {};
  for (const [key, path] of Object.entries(files)) {
    const parsed = parseI18nCsv(path);
    if (!parsed) {
      throw new Error(`${path} が見つからない（PR-1 #292 のマージ後に生成すること。data/world/it/{knowledge_categories,kpi_topics,goal_topics}.csv の 3 本が要る）`);
    }
    out[key] = parsed;
  }
  return out;
}

/** CSV の 1 行から name.{zh,en} を作る。code / kind / name_ja が期待どおりでなければ例外で止める（黙って空文字を書かない）。 */
function csvName(i18nFile, fileLabel, code, expectKind, expectParent, expectJa) {
  const row = i18nFile.byCode.get(code);
  if (!row) throw new Error(`${fileLabel}.csv: code "${code}" が見つからない（mock との食い違い）`);
  if (row.kind !== expectKind) throw new Error(`${fileLabel}.csv: code "${code}" の kind が "${row.kind}"（期待 "${expectKind}"）`);
  if ((row.parent || '') !== (expectParent || '')) throw new Error(`${fileLabel}.csv: code "${code}" の parent が "${row.parent}"（期待 "${expectParent || ''}"）`);
  if (row.name_ja !== expectJa) throw new Error(`${fileLabel}.csv: code "${code}" の name_ja "${row.name_ja}" が mock の "${expectJa}" と不一致`);
  return { ja: expectJa, zh: row.name_zh, en: row.name_en };
}

function buildCatalogJson(mockData, portalData, i18n) {
  const CATS = (mockData && mockData.CATS) || [];
  const SVCS = (mockData && mockData.SVCS) || [];
  const INDUSTRIES = (mockData && mockData.INDUSTRIES) || [];

  const svcs = [...SVCS]
    .map(s => ({
      code: mgmtCode(s.id),
      id: s.id,
      cat: s.cat,
      sub: s.sub,
      st: s.st,
      industries: s.industries,
      name: s.name,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const cats = [...CATS].map(c => ({
    id: c.id,
    industries: c.industries,
    name: c.name,
    subs: (c.subs || []).map(s => ({ id: s.id, industries: s.industries, name: s.name })),
  }));

  const PKNOW = (portalData && portalData.PKNOW) || { corp: [], dept: [] };
  const PKPITOPIC = (portalData && portalData.PKPITOPIC) || [];
  const PGOAL = (portalData && portalData.PGOAL) || { topics: [] };

  const knowledge = { corp: [], dept: [] };
  let knowledgeSubTotal = 0;
  let knowUsedCodes = 0;
  for (const scope of ['corp', 'dept']) {
    for (const row of PKNOW[scope] || []) {
      const [code, majorName, subs, , reviewDays] = row;
      const name = csvName(i18n.know, 'knowledge_categories', code, 'major', '', majorName);
      knowUsedCodes++;
      const subEntries = subs.map((subName, j) => {
        const subCode = `${code}-${pad2(j + 1)}`;
        const subNameI18n = csvName(i18n.know, 'knowledge_categories', subCode, 'minor', code, subName);
        knowUsedCodes++;
        return { code: subCode, name: subNameI18n };
      });
      knowledge[scope].push({ code, name, reviewDays, subs: subEntries });
      knowledgeSubTotal += subs.length;
    }
  }
  if (knowUsedCodes !== i18n.know.rows.length) {
    throw new Error(`knowledge_categories.csv の行数（${i18n.know.rows.length}）と mock から生成したコード数（${knowUsedCodes}）が食い違う`);
  }

  const kpi = { topics: [], measureTotal: 0 };
  let kpiUsedCodes = 0;
  for (const row of PKPITOPIC) {
    const [code, topicName, measures, frequency, source, viewers, srcState] = row;
    const name = csvName(i18n.kpi, 'kpi_topics', code, 'topic', '', topicName);
    kpiUsedCodes++;
    const measureEntries = measures.map((measureName, j) => {
      const mCode = `${code}-${pad2(j + 1)}`;
      const mNameI18n = csvName(i18n.kpi, 'kpi_topics', mCode, 'metric', code, measureName);
      kpiUsedCodes++;
      return { code: mCode, name: mNameI18n };
    });
    kpi.topics.push({ code, name, frequency, source, viewers, srcState, measures: measureEntries });
    kpi.measureTotal += measures.length;
  }
  if (kpiUsedCodes !== i18n.kpi.rows.length) {
    throw new Error(`kpi_topics.csv の行数（${i18n.kpi.rows.length}）と mock から生成したコード数（${kpiUsedCodes}）が食い違う`);
  }

  const goal = { topics: [] };
  for (const row of PGOAL.topics || []) {
    const [code, topicName, measureType] = row;
    const name = csvName(i18n.goal, 'goal_topics', code, 'topic', '', topicName);
    goal.topics.push({ code, name, measureType });
  }
  if (goal.topics.length !== i18n.goal.rows.length) {
    throw new Error(`goal_topics.csv の行数（${i18n.goal.rows.length}）と mock から生成したコード数（${goal.topics.length}）が食い違う`);
  }

  return {
    _comment: 'portal/scripts/gen-seed.mjs で生成。手で編集しない。正本は shoulang0729/dify の mock/js/data/catalog.js（CATS/SVCS）。ナレッジ／KPI／MBO の名前は data/world/it/{knowledge_categories,kpi_topics,goal_topics}.csv（zh/en）と mock/js/data/portal/{common,mgmt}.js（ja・属性）',
    industries: INDUSTRIES.map(i => ({ id: i.id, name: i.name })),
    cats,
    svcs,
    knowledge: { ...knowledge, majorTotal: knowledge.corp.length + knowledge.dept.length, subTotal: knowledgeSubTotal },
    kpi: { topics: kpi.topics, topicTotal: kpi.topics.length, measureTotal: kpi.measureTotal },
    goal: { ...goal, topicTotal: goal.topics.length },
  };
}

/* ---- dify/env/cloud-master/env.yml の apps: を読む（tools/verify.mjs §12-e と同じ正規表現） ---- */
function buildAppsJson() {
  const envPath = resolve(DIFY_ROOT, 'dify/env/cloud-master/env.yml');
  const raw = readIfExists(envPath);
  const apps = {};
  if (raw != null) {
    const lines = raw.split('\n');
    const startIdx = lines.findIndex(l => /^apps:\s*$/.test(l));
    if (startIdx !== -1) {
      for (let i = startIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (/^\S/.test(line)) break;
        if (line.trim() === '' || line.trim().startsWith('#')) continue;
        const m = line.match(/^\s+([A-Za-z0-9_-]+):\s*\{\s*id:\s*(.+?)\s*\}\s*(#.*)?$/);
        if (!m) continue;
        // id は null か ${VAR} のみを持ち出す。生の UUID は cloud-master に置かれない運用だが、
        // 念のため実 UUID らしき値は持ち出さない（実データを portal/ に持ち込まない。C-a）
        const idVal = m[2].replace(/^['"]|['"]$/g, '');
        apps[m[1]] = /^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(idVal) || idVal === 'null' ? null : null;
      }
    }
  }
  return {
    _comment: 'portal/scripts/gen-seed.mjs で生成。手で編集しない。正本は shoulang0729/dify の dify/env/cloud-master/env.yml の apps:。値は常に null（実 id は portal/ に持ち込まない。管理番号の一覧だけが目的）',
    'cloud-master': apps,
  };
}

function jsonStable(obj) {
  return JSON.stringify(obj, null, 2) + '\n';
}

function seedReadme() {
  return `# portal/seed/ — 生成物。手で編集しない

\`node portal/scripts/gen-seed.mjs\` が shoulang0729/dify の \`data/world/**\`（mfg/fin/it の 3 世界）・
\`mock/js/data/catalog.js\`（CATS/SVCS）・\`mock/js/data/portal/{common,mgmt}.js\`（ナレッジ 46・KPI 52・
MBO 8 の指標名）・\`dify/env/cloud-master/env.yml\` の \`apps:\` から生成する。

**手で直しても次の CI（\`node tools/check-seed-fresh.mjs\`）が必ず落とす。** 増やすときは正本
（\`shoulang0729/dify\` 側）に足してから、このディレクトリで \`node scripts/gen-seed.mjs\` を再実行する
（設計書 \`docs/handoff/2026-09-11-repo-layout-v3.md\` §2-5）。

| ファイル | 内容 |
|---|---|
| \`world/{mfg,fin,it}/{company.md,org.csv,people.csv}\` | 架空世界（\`data/world/\` の手コピーではなく生成物） |
| \`catalog.json\` | サービスカタログ（管理番号）・分類・ナレッジ／KPI／MBO の指標名 |
| \`apps.json\` | 管理番号 → Dify アプリ id（値は常に \`null\`。実 id は持ち込まない） |
`;
}

async function main() {
  if (!existsSync(WORLD_DIR)) {
    if (check) {
      console.log('⚠️  data/world/ が見つからない（portal/ を切り出した単体チェックアウト？）。--check は skip 扱いで exit 0');
      process.exit(0);
    }
    console.error('❌ data/world/ が見つからない。shoulang0729/dify のルートで実行しているか確認すること');
    process.exit(1);
  }

  const worldFiles = buildWorldFiles();
  const { mock, portal } = await loadMockData();
  const i18n = loadI18nMaps();
  const catalogJson = jsonStable(buildCatalogJson(mock && mock.data, portal && portal.data, i18n));
  const appsJson = jsonStable(buildAppsJson());

  const outputs = {
    'README.md': seedReadme(),
    'catalog.json': catalogJson,
    'apps.json': appsJson,
    ...worldFiles,
  };

  if (check) {
    let diffCount = 0;
    for (const [rel, content] of Object.entries(outputs)) {
      const p = resolve(SEED_DIR, rel);
      const cur = readIfExists(p);
      if (cur !== content) {
        diffCount++;
        console.log(`❌ 差分あり: seed/${rel}`);
      }
    }
    // 既存ファイルのうち、生成対象から漏れた（正本側で削除された）ものが残っていないかも見る
    const known = new Set(Object.keys(outputs));
    const walk = (dir, relBase) => {
      if (!existsSync(dir)) return [];
      const out = [];
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const rel = relBase ? `${relBase}/${e.name}` : e.name;
        if (e.isDirectory()) out.push(...walk(resolve(dir, e.name), rel));
        else out.push(rel);
      }
      return out;
    };
    for (const rel of walk(SEED_DIR, '')) {
      if (!known.has(rel)) {
        diffCount++;
        console.log(`❌ 生成対象に無いファイルが残っている: seed/${rel}`);
      }
    }
    if (diffCount) {
      console.log(`\n❌ FAIL: seed/** が正本と一致しない（${diffCount} 件）。node portal/scripts/gen-seed.mjs で再生成しコミットすること`);
      process.exit(1);
    }
    console.log('✅ PASS: portal/seed/** は正本から再生成した内容とバイト一致');
    process.exit(0);
  }

  for (const [rel, content] of Object.entries(outputs)) {
    const p = resolve(SEED_DIR, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  console.log(`📝 portal/seed/** を生成した（${Object.keys(outputs).length} ファイル）`);
}

main();
