#!/usr/bin/env node
/**
 * tools/gen-sample-assets.mjs — dify/samples/<番号>/assets/** の画像サンプルを生成する
 *
 * 設計書: docs/handoff/2026-09-21-gn02-ocr-input.md §9-1（PR-1）
 *
 * このツールは tools/gen-demo-assets.mjs と同じ方式（SVG/HTML を組み立てて Chromium
 * (playwright) でスクリーンショットを撮る）。次の点を引き継ぐ：
 *   1) playwright をリポジトリの依存にしない（CLAUDE.md §2-14 18-b：ルート package.json の
 *      dependencies はゼロのまま）。import('playwright') → 駄目なら `npm root -g` から解決 →
 *      駄目なら「グローバルに入れてください」と出して exit 1
 *   2) package.json の scripts に足さない（npm test / npm run ci / CI から呼ばれない）
 *   3) 決定的に再現できること（乱数は固定シードの mulberry32。Date.now()・Math.random() は使わない）
 *   4) --check で再生成してバイト比較できること（CI には入れない）
 *
 * 記載する値は data/world/mfg（青嶺精工・S 社・銭 芳）の語彙と、既存の dify/tests/GN-02.json・
 * dify/samples/GN-02/ の架空番号の体系だけを使う。実在企業名・実在発票番号・実在税番は書かない。
 *
 * 使い方:
 *   node tools/gen-sample-assets.mjs           生成（既存ファイルを上書き）
 *   node tools/gen-sample-assets.mjs --check   再生成してバイト一致を検査（CI には入れない）
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const CHECK = args.includes('--check');

/* ---------- playwright の解決（ルートの依存にしない） ---------- */
async function resolvePlaywright() {
  try {
    const mod = await import('playwright');
    return mod.default ?? mod;
  } catch { /* 1) 失敗したら 2) へ */ }
  try {
    const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
    const req = createRequire(join(globalRoot, 'x.js'));
    return req('playwright');
  } catch (e) {
    console.error(
      'playwright が見つかりません。このツールはリポジトリの依存にしません（CLAUDE.md §2-14 18-b）。\n' +
      'グローバルに `npm install -g playwright` を実行してから、もう一度実行してください。\n' +
      `詳細: ${e && e.message}`
    );
    process.exit(1);
  }
}

/* ---------- 決定的乱数（mulberry32。ファイルごとに固定シード） ---------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---------- 紙の質感（ノイズ矩形。決定的） ---------- */
function paperNoise(rng, w, h, count) {
  const rects = [];
  for (let i = 0; i < count; i++) {
    const rx = rng() * w, ry = rng() * h;
    const rw = 1 + rng() * 2, rh = 1 + rng() * 2;
    const op = 0.015 + rng() * 0.035;
    rects.push(`<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" fill="#6a6a6a" opacity="${op.toFixed(3)}"/>`);
  }
  return rects.join('');
}

/* ---------- 発票（增値税専用発票）1 枚。GN-02-S05 用 ---------- */
// 値は dify/tests/GN-02.json T09・dify/samples/GN-02/GN-02-S05-fapiao-photo-zh.md と揃える。
function buildFapiaoSvgInner(rng) {
  const W = 900, H = 620;
  const rows = [
    ['发票号码', '0250903…08'],
    ['开票日期', '2025-09-03'],
    ['购买方', '青岭精工（苏州）有限公司'],
    ['销售方', 'S公司'],
    ['货物或应税劳务名称', 'SPCC钢板'],
    ['金额（不含税）', 'RMB 12,300.00'],
    ['税率', '13%'],
    ['税额', 'RMB 1,599.00'],
    ['价税合计（大写略）', 'RMB 13,899.00'],
  ];
  let body = '';
  const top = 150, rowH = 46, labelX = 50, valX = 340;
  rows.forEach(([label, val], i) => {
    const y = top + i * rowH;
    body += `<line x1="30" y1="${y + 14}" x2="${W - 30}" y2="${y + 14}" stroke="#c9c9c9" stroke-width="1"/>`;
    body += `<text x="${labelX}" y="${y}" font-family="WenQuanYi Zen Hei, sans-serif" font-size="19" fill="#222">${escXml(label)}</text>`;
    body += `<text x="${valX}" y="${y}" font-family="WenQuanYi Zen Hei, sans-serif" font-size="19" fill="#000">${escXml(val)}</text>`;
  });
  const noise = paperNoise(rng, W, H, 700);
  return {
    w: W,
    h: H,
    inner: `
      <rect x="0" y="0" width="${W}" height="${H}" fill="#fdfdf9"/>
      <rect x="14" y="14" width="${W - 28}" height="${H - 28}" fill="none" stroke="#b8433f" stroke-width="2"/>
      <text x="${W / 2}" y="70" text-anchor="middle" font-family="WenQuanYi Zen Hei, sans-serif" font-size="30" font-weight="bold" fill="#b8433f">增值税专用发票</text>
      <line x1="30" y1="100" x2="${W - 30}" y2="100" stroke="#b8433f" stroke-width="2"/>
      ${body}
      ${noise}
      <rect x="0" y="0" width="${W}" height="${H}" fill="none" stroke="#c9bd9e" stroke-width="4"/>
    `,
  };
}

// 「撮影・スキャンしたもの」らしさ：わずかな傾き（1〜2 度）・薄いグレーの背景・軽いノイズ。
// 読めなくなるほどは崩さない（第 1 段階はまず読めることを確かめる。設計書 §9-1）。
function renderPhoto(paperSvgInner, w, h, rng) {
  const pad = 60;
  const outerW = w + pad * 2, outerH = h + pad * 2;
  const rotZ = 1 + rng() * 1.0; // 1〜2 度
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;}
    .desk{width:${outerW}px;height:${outerH}px;position:relative;overflow:hidden;background:#c9c9c9;}
    .stage{position:absolute;left:${pad}px;top:${pad}px;width:${w}px;height:${h}px;
      transform:rotate(${rotZ.toFixed(2)}deg);box-shadow:0 10px 24px rgba(0,0,0,0.28);}
  </style></head><body>
    <div class="desk">
      <div class="stage">
        <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${paperSvgInner}</svg>
      </div>
    </div>
  </body></html>`;
  return { html, outerW, outerH };
}

/* ---------- 資産の一覧と生成（{name: {dir, buf}} を返すだけ。書き込みは呼び出し側） ---------- */
async function generateAll() {
  const results = new Map(); // name -> { dir, buf }

  const pw = await resolvePlaywright();
  const browser = await pw.chromium.launch();
  const version = browser.version();
  const page = await browser.newPage({ deviceScaleFactor: 1.5 });

  const shots = [
    {
      name: 'GN-02-S05-fapiao-photo.png',
      dir: resolve(ROOT, 'dify/samples/GN-02/assets'),
      seed: 250903,
      build: (rng) => buildFapiaoSvgInner(rng),
    },
  ];

  for (const shot of shots) {
    const rng = mulberry32(shot.seed);
    const paper = shot.build(rng);
    const { html, outerW, outerH } = renderPhoto(paper.inner, paper.w, paper.h, rng);
    await page.setViewportSize({ width: outerW, height: outerH });
    await page.setContent(html, { waitUntil: 'load' });
    const buf = await page.screenshot({ type: 'png' });
    results.set(shot.name, { dir: shot.dir, buf });
  }

  await browser.close();
  return { results, version };
}

async function main() {
  const { results, version } = await generateAll();

  if (CHECK) {
    let mismatches = 0;
    for (const [name, { dir, buf }] of results) {
      const dst = resolve(dir, name);
      if (!existsSync(dst)) { console.error(`❌ ${name}: 既存ファイルが無い（先に node tools/gen-sample-assets.mjs を実行してください）`); mismatches++; continue; }
      const existing = readFileSync(dst);
      if (!existing.equals(buf)) { console.error(`❌ ${name}: バイトが既存ファイルと一致しない（既存 ${existing.length} bytes / 再生成 ${buf.length} bytes）`); mismatches++; }
      else console.log(`✅ ${name}: バイト一致（${buf.length} bytes）`);
    }
    console.log(`\n使用した Chromium: ${version}`);
    if (mismatches) { console.error(`\n--check FAIL: ${mismatches} 件のファイルが再現しない`); process.exit(1); }
    console.log('\n--check PASS: 全ファイルがバイト一致（再現性あり）');
    return;
  }

  for (const [name, { dir, buf }] of results) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, name), buf);
    console.log(`生成: ${name} (${buf.length} bytes) -> ${dir}`);
  }
  console.log(`\n使用した Chromium: ${version}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
