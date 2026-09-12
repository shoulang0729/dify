#!/usr/bin/env node
/**
 * portal/scripts/gen-seed.mjs — portal/seed/** を生成する（生成物。手で編集しない）
 *
 * 設計書: docs/handoff/2026-09-11-repo-layout-v3.md §2-5・§4-2 S-1。
 *
 * 入力（すべて shoulang0729/dify 側。正本）:
 *   data/world/{mfg,fin,it}/{company.md,org.csv,people.csv}  … 架空世界（人名・部署・拠点）
 *   mock/js/data/catalog.js（CATS/SVCS）・ui.js（INDUSTRIES）                … サービスカタログ・管理番号
 *   mock/js/data/portal/{common,mgmt}.js（PKNOW/PKPITOPIC/PGOAL）           … ナレッジ 46・KPI 52・MBO 8 の指標名
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

function buildCatalogJson(mockData, portalData) {
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
  for (const scope of ['corp', 'dept']) {
    for (const row of PKNOW[scope] || []) {
      const [code, majorName, subs, , reviewDays] = row;
      knowledge[scope].push({ code, majorName, subs, reviewDays });
      knowledgeSubTotal += subs.length;
    }
  }

  const kpi = { topics: [], measureTotal: 0 };
  for (const row of PKPITOPIC) {
    const [code, topicName, measures, frequency, source, viewers, srcState] = row;
    kpi.topics.push({ code, topicName, measures, frequency, source, viewers, srcState });
    kpi.measureTotal += measures.length;
  }

  const goal = { topics: [] };
  for (const row of PGOAL.topics || []) {
    const [code, topicName, measureType] = row;
    goal.topics.push({ code, topicName, measureType });
  }

  return {
    _comment: 'portal/scripts/gen-seed.mjs で生成。手で編集しない。正本は shoulang0729/dify の mock/js/data/catalog.js（CATS/SVCS）・mock/js/data/portal/{common,mgmt}.js（PKNOW/PKPITOPIC/PGOAL）',
    industries: INDUSTRIES.map(i => ({ id: i.id, name: i.name })),
    cats,
    svcs,
    knowledge: { ...knowledge, subTotal: knowledgeSubTotal },
    kpi,
    goal,
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
  const catalogJson = jsonStable(buildCatalogJson(mock && mock.data, portal && portal.data));
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
