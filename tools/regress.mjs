#!/usr/bin/env node
/**
 * tools/regress.mjs — データ層スナップショット回帰（CLAUDE.md §2-9）
 *
 * mock/catalog.html のデータ層（CATS / SVCS / TAGS / PATTERNS / T のキー）の
 * 「件数と id 一覧」を基準ファイルと比較する。
 * 意図しない増減・改名・分類移動を FAIL として検出する。
 *
 *   node tools/regress.mjs            比較（差分があれば FAIL, exit 1）
 *   node tools/regress.mjs --update   基準を現状で更新（設計書に書かれた意図的変更のときだけ）
 *
 * 基準: tools/regress.baseline.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMock } from './lib/load.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = resolve(ROOT, 'tools/regress.baseline.json');
const update = process.argv.includes('--update');

const { data } = loadMock(ROOT);
const CATS = data.CATS || [], SVCS = data.SVCS || [], TAGS = data.TAGS || {}, PATTERNS = data.PATTERNS || [], T = data.T || {};
const INDUSTRIES = data.INDUSTRIES || [];

const hasInd = (x, id) => Array.isArray(x.industries) && x.industries.includes(id);
// 業種の一覧は mock/js/data/ui.js の INDUSTRIES が正本（tools/** に業種をハードコードしない。
// 設計書 docs/handoff/2026-09-11-repo-layout-v3.md §8-2 R-I1・R-I2）
const industryIds = INDUSTRIES.map(i => i.id);
const byIndustry = Object.fromEntries(industryIds.map(id => [id, {
  svcs: SVCS.filter(s => hasInd(s, id)).length,
  cats: CATS.filter(c => hasInd(c, id)).length
}]));
const svcsMulti = SVCS.filter(s => Array.isArray(s.industries) && s.industries.length > 1).length;

/** 比較対象のスナップショット（順序も含める：メニューの並びは意味がある） */
const snapshot = {
  industries: INDUSTRIES.map(i => i.id),
  cats: CATS.map(c => ({ id: c.id, industries: [...(c.industries || [])],
                         subs: c.subs.map(s => ({ id: s.id, industries: [...(s.industries || [])] })) })),
  svcs: SVCS.map(s => ({ id: s.id, cat: s.cat, sub: s.sub, st: s.st, industries: [...(s.industries || [])], tags: [...s.tags], place: s.place })),
  tags: Object.keys(TAGS).sort(),
  patterns: PATTERNS.map(p => ({ id: p.id, ready: !!p.ready })),
  uiKeys: Object.keys(T).sort(),
  counts: {
    cats: CATS.length, subs: CATS.reduce((n, c) => n + c.subs.length, 0), svcs: SVCS.length,
    tags: Object.keys(TAGS).length, ui: Object.keys(T).length,
    byIndustry, svcsMulti
  }
};

// 検算：全サービスが少なくとも 1 つの既知業種に属すること（設計書 §4-7・
// docs/handoff/2026-09-11-repo-layout-v3.md §8-2 R-I1 item 5）。
// 3 業種以上では包除原理（svcsMfg + svcsFin − svcsBoth）が破綻するため、
// 「業種に属さないサービスが無い」ことの直接検査に置き換える
{
  const line = industryIds.map(id => `${id}=${byIndustry[id].svcs}`).join(' ');
  console.log(`   業種別 svcs: ${line} ／ svcsMulti(2 業種以上)=${svcsMulti}（svcs=${snapshot.counts.svcs}）`);
  const orphans = SVCS.filter(s => !(Array.isArray(s.industries) && s.industries.some(i => industryIds.includes(i)))).map(s => s.id);
  if (orphans.length) {
    console.log(`❌ 業種に属さない SVCS があります（industries の付け間違いの疑い）: ${orphans.join(', ')}`);
    process.exit(1);
  }
}

if (update || !existsSync(BASE)) {
  writeFileSync(BASE, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`${existsSync(BASE) && update ? '🔄 基準を更新' : '🆕 基準を作成'}: tools/regress.baseline.json`);
  console.log('   counts:', JSON.stringify(snapshot.counts));
  if (update) console.log('   ※ PR 本文に「設計書 §X のデータ変更に伴う基準更新」と書くこと');
  process.exit(0);
}

const base = JSON.parse(readFileSync(BASE, 'utf8'));
const diffs = [];
const idsOf = (arr) => new Set(arr.map(x => x.id));

/* 件数（byIndustry は業種 id をキーにした map なのでキー集合ごと個別に比較する） */
for (const k of Object.keys(snapshot.counts)) {
  if (k === 'byIndustry') {
    const bBy = base.counts.byIndustry || {};
    const nBy = snapshot.counts.byIndustry;
    for (const id of new Set([...Object.keys(bBy), ...Object.keys(nBy)])) {
      if (JSON.stringify(bBy[id]) !== JSON.stringify(nBy[id])) {
        diffs.push(`counts.byIndustry.${id}: ${JSON.stringify(bBy[id])} → ${JSON.stringify(nBy[id])}`);
      }
    }
    continue;
  }
  if (base.counts[k] !== snapshot.counts[k]) diffs.push(`counts.${k}: ${base.counts[k]} → ${snapshot.counts[k]}`);
}
/* 分類 */
{
  const b = idsOf(base.cats), n = idsOf(snapshot.cats);
  for (const id of b) if (!n.has(id)) diffs.push(`CATS 削除: ${id}`);
  for (const id of n) if (!b.has(id)) diffs.push(`CATS 追加: ${id}`);
  for (const c of snapshot.cats) {
    const bc = base.cats.find(x => x.id === c.id);
    if (!bc) continue;
    const bcSubIds = bc.subs.map(s => (typeof s === 'string' ? s : s.id));
    const cSubIds = c.subs.map(s => s.id);
    if (JSON.stringify(bcSubIds) !== JSON.stringify(cSubIds)) diffs.push(`CATS.${c.id}.subs: [${bcSubIds}] → [${cSubIds}]`);
    if (bc.industries && JSON.stringify(bc.industries) !== JSON.stringify(c.industries)) {
      diffs.push(`CATS.${c.id} industries: [${bc.industries}] → [${c.industries}]`);
    }
    for (const s of c.subs) {
      const bs = bc.subs.find(x => (typeof x === 'string' ? x : x.id) === s.id);
      if (bs && typeof bs !== 'string' && bs.industries && JSON.stringify(bs.industries) !== JSON.stringify(s.industries)) {
        diffs.push(`CATS.${c.id}.subs.${s.id} industries: [${bs.industries}] → [${s.industries}]`);
      }
    }
  }
}
/* サービス */
{
  const b = idsOf(base.svcs), n = idsOf(snapshot.svcs);
  for (const id of b) if (!n.has(id)) diffs.push(`SVCS 削除: ${id}`);
  for (const id of n) if (!b.has(id)) diffs.push(`SVCS 追加: ${id}`);
  for (const s of snapshot.svcs) {
    const bs = base.svcs.find(x => x.id === s.id);
    if (!bs) continue;
    if (bs.cat !== s.cat || bs.sub !== s.sub) diffs.push(`SVCS.${s.id} 分類移動: ${bs.cat}/${bs.sub} → ${s.cat}/${s.sub}`);
    if (bs.st !== s.st) diffs.push(`SVCS.${s.id} 成熟度: ${bs.st} → ${s.st}`);
    if (JSON.stringify(bs.tags) !== JSON.stringify(s.tags)) diffs.push(`SVCS.${s.id} tags: [${bs.tags}] → [${s.tags}]`);
    if (bs.industries && JSON.stringify(bs.industries) !== JSON.stringify(s.industries)) {
      diffs.push(`SVCS.${s.id} industries: [${bs.industries}] → [${s.industries}]`);
    }
    /* rev4（docs/handoff/2026-09-12-portal-industry-rev4.md §11-1・§14-2）：place は文字列のほか
       業種別オブジェクト（{ mfg, fin, it }）も取りうるため、厳密等価ではなく JSON 文字列で比較する */
    if (JSON.stringify(bs.place) !== JSON.stringify(s.place)) {
      diffs.push(`SVCS.${s.id} place: ${JSON.stringify(bs.place ?? null)} → ${JSON.stringify(s.place ?? null)}`);
    }
  }
  if (!diffs.some(d => d.startsWith('SVCS')) && JSON.stringify(base.svcs.map(x => x.id)) !== JSON.stringify(snapshot.svcs.map(x => x.id)))
    diffs.push('SVCS の並び順が変わっている');
}
/* タグ / パターン / UI キー */
const setDiff = (label, b, n) => {
  const B = new Set(b), N = new Set(n);
  for (const x of B) if (!N.has(x)) diffs.push(`${label} 削除: ${x}`);
  for (const x of N) if (!B.has(x)) diffs.push(`${label} 追加: ${x}`);
};
if (base.industries) setDiff('INDUSTRIES', base.industries, snapshot.industries);
setDiff('TAGS', base.tags, snapshot.tags);
setDiff('T(UI キー)', base.uiKeys, snapshot.uiKeys);
setDiff('PATTERNS', base.patterns.map(p => p.id), snapshot.patterns.map(p => p.id));
for (const p of snapshot.patterns) {
  const bp = base.patterns.find(x => x.id === p.id);
  if (bp && bp.ready !== p.ready) diffs.push(`PATTERNS.${p.id}.ready: ${bp.ready} → ${p.ready}`);
}

if (diffs.length) {
  console.log('❌ データ層に基準との差分があります:');
  for (const d of diffs) console.log('   -', d);
  console.log('\n   設計書に書かれた意図的な変更なら:  node tools/regress.mjs --update');
  console.log('   書かれていない変更なら、それは意図しない破壊です。');
  process.exit(1);
}
console.log('✅ regress PASS — データ層は基準と一致', JSON.stringify(snapshot.counts));
