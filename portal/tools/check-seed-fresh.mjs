#!/usr/bin/env node
/**
 * portal/tools/check-seed-fresh.mjs — portal/seed/** が正本（shoulang0729/dify 側）から
 * 再生成した内容とバイト一致するか検査する（設計書 docs/handoff/2026-09-11-repo-layout-v3.md §2-5）。
 *
 * S-1（切り出し可能性）: このファイルはリポジトリ外（../）を読む数少ない例外の 1 つ
 * （正本の有無を確認するためだけに ../data/world を見る）。
 * 正本が見つからない（portal/ を切り出した後の単体チェックアウト）ときは FAIL ではなく skip する。
 */
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const PORTAL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORLD_DIR = resolve(PORTAL_ROOT, '..', 'data/world'); // S-1 の例外：正本の有無を見るためだけの参照

if (!existsSync(WORLD_DIR)) {
  console.log('⚠️  shoulang0729/dify の data/world/ が見つからない（portal/ を切り出した単体チェックアウト）。skip（PASS 扱い）');
  process.exit(0);
}

const genSeed = resolve(PORTAL_ROOT, 'scripts/gen-seed.mjs');
const result = spawnSync(process.execPath, [genSeed, '--check'], { stdio: 'inherit' });
process.exit(result.status ?? 1);
