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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HTML = resolve(ROOT, 'mock/catalog.html');
const BASE = resolve(ROOT, 'tools/regress.baseline.json');
const update = process.argv.includes('--update');

const html = readFileSync(HTML, 'utf8');
const script = (html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/) || [, ''])[1];
function grab(name) {
  const m = script.match(new RegExp(`const ${name} = (\\[[\\s\\S]*?\\n\\]|\\{[\\s\\S]*?\\n\\});`));
  return m ? Function(`"use strict"; return (${m[1]});`)() : null;
}

const CATS = grab('CATS') || [], SVCS = grab('SVCS') || [], TAGS = grab('TAGS') || {}, PATTERNS = grab('PATTERNS') || [], T = grab('T') || {};

/** 比較対象のスナップショット（順序も含める：メニューの並びは意味がある） */
const snapshot = {
  cats: CATS.map(c => ({ id: c.id, subs: c.subs.map(s => s.id) })),
  svcs: SVCS.map(s => ({ id: s.id, cat: s.cat, sub: s.sub, st: s.st, tags: [...s.tags] })),
  tags: Object.keys(TAGS).sort(),
  patterns: PATTERNS.map(p => ({ id: p.id, ready: !!p.ready })),
  uiKeys: Object.keys(T).sort(),
  counts: { cats: CATS.length, subs: CATS.reduce((n, c) => n + c.subs.length, 0), svcs: SVCS.length, tags: Object.keys(TAGS).length, ui: Object.keys(T).length }
};

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

/* 件数 */
for (const k of Object.keys(snapshot.counts)) {
  if (base.counts[k] !== snapshot.counts[k]) diffs.push(`counts.${k}: ${base.counts[k]} → ${snapshot.counts[k]}`);
}
/* 分類 */
{
  const b = idsOf(base.cats), n = idsOf(snapshot.cats);
  for (const id of b) if (!n.has(id)) diffs.push(`CATS 削除: ${id}`);
  for (const id of n) if (!b.has(id)) diffs.push(`CATS 追加: ${id}`);
  for (const c of snapshot.cats) {
    const bc = base.cats.find(x => x.id === c.id);
    if (bc && JSON.stringify(bc.subs) !== JSON.stringify(c.subs)) diffs.push(`CATS.${c.id}.subs: [${bc.subs}] → [${c.subs}]`);
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
