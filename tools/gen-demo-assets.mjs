#!/usr/bin/env node
/**
 * tools/gen-demo-assets.mjs — mock/assets/demo/** の画像・PDF のダミー資産を生成する
 *
 * 設計書: docs/handoff/2026-09-16-showcase-demo.md §9（PR-0）
 *
 * 音声（kn11-interview-{ja,zh}.wav/.txt）はこのツールでは作らない。PM 決定
 * （2026-09-16、Issue #311）により、この環境で動くオフライン TTS を使って
 * tools/gen-demo-audio.py が別途生成する（README・§9-4 参照）。このツールが作るのは
 * 決定的に再現できる画像（JPEG）と PDF だけ。
 *
 * このツールは playwright をリポジトリの依存にしない（CLAUDE.md §2-14 18-b：ルート
 * package.json の dependencies はゼロのまま）。次の順に解決し、見つからなければ
 * 「グローバルに playwright を入れてから実行してください」と出して exit 1 する。
 *   1) import('playwright')
 *   2) createRequire で `npm root -g` のパスから解決
 * npm test / npm run ci / CI からは絶対に呼ばない（tools/verify.mjs §20-h が検査する）。
 *
 * 使い方:
 *   node tools/gen-demo-assets.mjs                 生成（既存ファイルを上書き）
 *   node tools/gen-demo-assets.mjs --check          再生成してバイト一致を検査（CI には入れない）
 *
 * 再現性: 乱数はファイルごとに固定シードの mulberry32。Date.now()・Math.random() は使わない。
 * ただし Chromium のバージョンが変わると screenshot/pdf のバイトは一致しなくなりうる。
 * --check は「生成した本人が確認する」ためのものであり CI には組み込まない
 * （tools/verify.mjs §20-h が package.json の scripts から呼ばれていないことを検査する）。
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'mock/assets/demo');

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

/* ---------- 手書き風 SVG 文字列の組み立て ---------- */
// CJK・全角記号は 1 文字ぶん広めに送る。半角英数・記号は狭め。
function isWide(ch) {
  return /[　-鿿＀-￯]/.test(ch);
}

// rng: mulberry32 の関数。text: 書く文字列。x/y: 開始位置（ベースライン）。
// opts: fontFamily / fontSize / color / overflow（末尾に向けて罫線の下へはみ出させる量 px）
function handwritten(rng, text, x, y, opts = {}) {
  const fontFamily = opts.fontFamily || 'IPAGothic, sans-serif';
  const fontSize = opts.fontSize || 26;
  const color = opts.color || '#22345c';
  const overflow = opts.overflow || 0;
  const chars = [...text];
  const phase = rng() * Math.PI * 2; // 基線のうねり（緩い波）の位相。文字ごとに毎回変えない
  let cx = x;
  const spans = [];
  chars.forEach((ch, i) => {
    const wBase = isWide(ch) ? fontSize * 1.05 : fontSize * 0.62;
    const w = wBase * (1 + (rng() * 2 - 1) * 0.16); // 字間のばらつき
    const mag = 4 + rng() * 3; // 回転 ±4〜7°
    const rot = (rng() < 0.5 ? -1 : 1) * mag;
    const wave = Math.sin(i * 0.85 + phase) * 2.6; // 基線の緩いうねり（手の震え・筆圧の波）
    const jitter = (rng() * 2 - 1) * 1.9; // 1 文字ごとの上下ずれ
    const overflowDy = overflow * (i / Math.max(1, chars.length - 1));
    const dx = (rng() * 2 - 1) * 1.4;
    const dy = wave + jitter + overflowDy;
    const fs = fontSize * (1 + (rng() * 2 - 1) * 0.11);
    const sw = 0.5 + rng() * 1.2; // 線の太さのばらつきを大きく
    const midX = cx + w / 2;
    const midY = y + dy;
    spans.push(
      `<text x="${(cx + dx).toFixed(2)}" y="${midY.toFixed(2)}" ` +
      `font-family="${fontFamily}" font-size="${fs.toFixed(2)}" fill="${color}" ` +
      `stroke="${color}" stroke-width="${sw.toFixed(2)}" ` +
      `transform="rotate(${rot.toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)})">${escXml(ch)}</text>`
    );
    cx += w;
  });
  return { svg: spans.join(''), endX: cx };
}

function escXml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// 判読不能な箇所を「ペンで塗りつぶした・こすれた」見た目にする（線の束ではなく、にじみ＋
// 塗りの束）。ぼかしフィルタでインクのにじみを、その上に太いペンの往復で塗りつぶしを重ねる。
function inkBlotIllegible(rng, x, y, w, h, filterId) {
  const parts = [];
  parts.push(`<filter id="${filterId}" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="1.15"/></filter>`);
  // 下地のにじみ（不定形の塗り、ぼかし済み）
  const blotCount = 3 + Math.floor(rng() * 2);
  for (let i = 0; i < blotCount; i++) {
    const bw = w * (0.32 + rng() * 0.28), bh = h * (0.6 + rng() * 0.35);
    const bx = x + rng() * (w - bw);
    const by = y + rng() * (h - bh) * 0.4;
    parts.push(`<ellipse cx="${(bx + bw / 2).toFixed(1)}" cy="${(by + bh / 2).toFixed(1)}" rx="${(bw / 2).toFixed(1)}" ry="${(bh / 2).toFixed(1)}" fill="#182540" opacity="${(0.45 + rng() * 0.25).toFixed(2)}" filter="url(#${filterId})"/>`);
  }
  // 上から重ねる、太いペンの往復（塗りつぶし・こすれ）
  const passCount = 9 + Math.floor(rng() * 4);
  for (let i = 0; i < passCount; i++) {
    const t = i / (passCount - 1);
    const yy = y + h * (0.15 + t * 0.7) + (rng() * 2 - 1) * 3;
    const midY = yy + (rng() * 2 - 1) * 7;
    const endY = yy + (rng() * 2 - 1) * 5;
    parts.push(
      `<path d="M ${x.toFixed(1)} ${yy.toFixed(1)} Q ${(x + w * 0.5).toFixed(1)} ${midY.toFixed(1)}, ${(x + w).toFixed(1)} ${endY.toFixed(1)}" ` +
      `fill="none" stroke="#101a2c" stroke-width="${(2.1 + rng() * 1.6).toFixed(2)}" stroke-linecap="round" opacity="${(0.72 + rng() * 0.22).toFixed(2)}"/>`
    );
  }
  return `<g>${parts.join('')}</g>`;
}

// 取り消した跡に書き直した見た目（値そのものは変えない）。薄い消し跡（用紙に近い色の不定形の
// 塗り）とうっすら残る前の筆跡を重ねてから、本来の値を handwritten() で上書きする。
function rewriteSmudge(rng, x, y, w, h) {
  const parts = [];
  const smudgeCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < smudgeCount; i++) {
    const ew = w * (0.55 + rng() * 0.3), eh = h * (0.55 + rng() * 0.3);
    const ex = x + rng() * (w - ew), ey = y + rng() * (h - eh);
    parts.push(`<ellipse cx="${(ex + ew / 2).toFixed(1)}" cy="${(ey + eh / 2).toFixed(1)}" rx="${(ew / 2).toFixed(1)}" ry="${(eh / 2).toFixed(1)}" fill="#f7f0e1" opacity="${(0.5 + rng() * 0.3).toFixed(2)}"/>`);
  }
  const ghostCount = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < ghostCount; i++) {
    const x1 = x + rng() * w, y1 = y + rng() * h, x2 = x + rng() * w, y2 = y + rng() * h;
    parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#9c8f70" stroke-width="1" opacity="${(0.14 + rng() * 0.14).toFixed(2)}"/>`);
  }
  return parts.join('');
}

// 紙そのものの汚れ（折り目・指跡/油じみ）。決定的（rng 消費）。
function paperDefects(rng, w, h) {
  const parts = [];
  const x1 = rng() * w * 0.3, y1 = h * (0.55 + rng() * 0.3);
  const x2 = w * (0.7 + rng() * 0.25), y2 = y1 - (rng() * 40 - 20);
  parts.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="#ffffff" stroke-width="2.4" opacity="0.22"/>`);
  parts.push(`<line x1="${x1.toFixed(1)}" y1="${(y1 + 2.2).toFixed(1)}" x2="${x2.toFixed(1)}" y2="${(y2 + 2.2).toFixed(1)}" stroke="#5b4c33" stroke-width="1.6" opacity="0.18"/>`);
  const stainCount = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < stainCount; i++) {
    const sx = w * (0.1 + rng() * 0.8), sy = h * (0.1 + rng() * 0.8);
    const sr = 16 + rng() * 24;
    parts.push(`<circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="${sr.toFixed(1)}" fill="#8a6d3b" opacity="${(0.05 + rng() * 0.05).toFixed(3)}"/>`);
  }
  return parts.join('');
}

// 取り消し線での訂正（元の値の上に線を引き、近くに読みにくい書き直しを重ねる）。
// 3.8 と書きつつ、8 の下側ループに重ね書きの一筆を足して 6 とも読める見た目にする。
function correctionOverlay(rng, x, y, w, h) {
  const strokes = [];
  strokes.push(`<line x1="${(x - 2).toFixed(1)}" y1="${(y - h * 0.4).toFixed(1)}" x2="${(x + w + 2).toFixed(1)}" y2="${(y - h * 0.55).toFixed(1)}" stroke="#22345c" stroke-width="1.3" opacity="0.65"/>`);
  const cx1 = x + w * (0.3 + rng() * 0.2);
  const cy1 = y - h * (0.7 + rng() * 0.2);
  strokes.push(`<path d="M ${(x + w * 0.15).toFixed(1)} ${(y - h * 0.55).toFixed(1)} Q ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${(x + w * 0.85).toFixed(1)} ${(y - h * 0.5).toFixed(1)}" fill="none" stroke="#22345c" stroke-width="1.4" opacity="0.55"/>`);
  return strokes.join('');
}

/* ---------- 紙の質感（ノイズ矩形。決定的） ---------- */
function paperNoise(rng, w, h, count) {
  const rects = [];
  for (let i = 0; i < count; i++) {
    const rx = rng() * w, ry = rng() * h;
    const rw = 1 + rng() * 2, rh = 1 + rng() * 2;
    const op = 0.02 + rng() * 0.05;
    rects.push(`<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${rh.toFixed(1)}" fill="#7a6a4f" opacity="${op.toFixed(3)}"/>`);
  }
  return rects.join('');
}

/* ---------- 帳票 1: 外観検査記録（手書き・9/5 or 9/6） ---------- */
function buildInspectionSheetHtml(rng, { date, lot, inspector, remarkIllegible }) {
  const W = 720, H = 960;
  const rows = [
    { ja: '検査日', zh: '检验日期', val: date },
    { ja: '品番', zh: '零件号', val: 'SK-3310-A' },
    { ja: 'ロット', zh: '批次', val: lot },
    { ja: 'ライン', zh: '产线', val: 'L3' },
    { ja: '抜取数(n)', zh: '抽样数', val: 'n=32' },
    { ja: '不良内容', zh: '不良内容', val: '涂装颗粒 0.3〜0.5mm' },
    { ja: '判定', zh: '判定', val: '合格' },
    { ja: '検査員', zh: '检验员', val: inspector },
  ];
  const top = 210, rowH = 84, labelX = 40, valX = 280;
  let body = '';
  rows.forEach((r, i) => {
    const y = top + i * rowH;
    body += `<line x1="30" y1="${y + 20}" x2="${W - 30}" y2="${y + 20}" stroke="#b9ad8f" stroke-width="1"/>`;
    body += `<text x="${labelX}" y="${y}" font-family="IPAGothic, sans-serif" font-size="17" fill="#333">${escXml(r.ja)}</text>`;
    body += `<text x="${labelX}" y="${y + 22}" font-family="WenQuanYi Zen Hei, sans-serif" font-size="14" fill="#666">${escXml(r.zh)}</text>`;
    // ロット欄は罫線の下へわずかにはみ出させる（9/6 分。手が滑った跡の演出。値は変えない）
    const overflow = (r.ja === 'ロット' && remarkIllegible) ? 14 : 0;
    const { svg } = handwritten(rng, r.val, valX, y + 8, { fontSize: 26, overflow });
    body += svg;
  });
  // 備考欄（9/6 分だけ判読不能にする。9/5 分は「特になし」を書き直した跡つきで書く）
  const remY = top + rows.length * rowH + 20;
  body += `<line x1="30" y1="${remY + 20}" x2="${W - 30}" y2="${remY + 20}" stroke="#b9ad8f" stroke-width="1"/>`;
  body += `<text x="${labelX}" y="${remY}" font-family="IPAGothic, sans-serif" font-size="17" fill="#333">備考</text>`;
  body += `<text x="${labelX}" y="${remY + 22}" font-family="WenQuanYi Zen Hei, sans-serif" font-size="14" fill="#666">备注</text>`;
  if (remarkIllegible) {
    body += inkBlotIllegible(rng, valX, remY - 24, 360, 46, 'inkblur0906');
  } else {
    body += rewriteSmudge(rng, valX - 6, remY - 24, 150, 40);
    const { svg } = handwritten(rng, '特になし', valX, remY + 8, { fontSize: 24 });
    body += svg;
  }

  const noise = paperNoise(rng, W, H, 900);
  const defects = paperDefects(rng, W, H);
  return paperGroup(W, H, `
    <text x="${W / 2}" y="70" text-anchor="middle" font-family="IPAGothic, sans-serif" font-size="30" font-weight="bold" fill="#1a1a1a">外観検査記録</text>
    <text x="${W / 2}" y="102" text-anchor="middle" font-family="WenQuanYi Zen Hei, sans-serif" font-size="20" fill="#444">外观检验记录</text>
    <line x1="30" y1="130" x2="${W - 30}" y2="130" stroke="#333" stroke-width="2"/>
    ${body}
    ${noise}
    ${defects}
  `);
}

/* ---------- 帳票 2: 塗装条件記録（手書き・9/5） ---------- */
function buildPaintConditionHtml(rng) {
  const W = 720, H = 900;
  const top = 210, rowH = 96, labelX = 40, valX = 300;
  let body = '';
  const rowsPlain = [
    { ja: '日付', zh: '日期', val: '2025-09-05' },
  ];
  let y = top;
  rowsPlain.forEach((r) => {
    body += `<line x1="30" y1="${y + 20}" x2="${W - 30}" y2="${y + 20}" stroke="#b9ad8f" stroke-width="1"/>`;
    body += `<text x="${labelX}" y="${y}" font-family="IPAGothic, sans-serif" font-size="17" fill="#333">${escXml(r.ja)}</text>`;
    body += `<text x="${labelX}" y="${y + 22}" font-family="WenQuanYi Zen Hei, sans-serif" font-size="14" fill="#666">${escXml(r.zh)}</text>`;
    const { svg } = handwritten(rng, r.val, valX, y + 8, { fontSize: 24 });
    body += svg;
    y += rowH;
  });

  // 前処理脱脂液濃度（訂正あり。3.8 と 3.6 の両方に読める）
  body += `<line x1="30" y1="${y + 20}" x2="${W - 30}" y2="${y + 20}" stroke="#b9ad8f" stroke-width="1"/>`;
  body += `<text x="${labelX}" y="${y}" font-family="IPAGothic, sans-serif" font-size="17" fill="#333">前処理脱脂液濃度(%)</text>`;
  body += `<text x="${labelX}" y="${y + 22}" font-family="WenQuanYi Zen Hei, sans-serif" font-size="14" fill="#666">前处理脱脂液浓度(%)</text>`;
  { const { svg, endX } = handwritten(rng, '3.8', valX, y + 8, { fontSize: 30 });
    body += svg;
    body += correctionOverlay(rng, valX, y + 8, endX - valX, 26); }
  y += rowH;

  // 塗料撹拌時間（訂正あり。12 と 17 の両方に読める）
  body += `<line x1="30" y1="${y + 20}" x2="${W - 30}" y2="${y + 20}" stroke="#b9ad8f" stroke-width="1"/>`;
  body += `<text x="${labelX}" y="${y}" font-family="IPAGothic, sans-serif" font-size="17" fill="#333">塗料撹拌時間(分)</text>`;
  body += `<text x="${labelX}" y="${y + 22}" font-family="WenQuanYi Zen Hei, sans-serif" font-size="14" fill="#666">涂料搅拌时间(分)</text>`;
  { const { svg, endX } = handwritten(rng, '12', valX, y + 8, { fontSize: 30 });
    body += svg;
    body += correctionOverlay(rng, valX, y + 8, endX - valX, 26); }
  y += rowH;

  // ブース吸気フィルター交換日
  body += `<line x1="30" y1="${y + 20}" x2="${W - 30}" y2="${y + 20}" stroke="#b9ad8f" stroke-width="1"/>`;
  body += `<text x="${labelX}" y="${y}" font-family="IPAGothic, sans-serif" font-size="17" fill="#333">ブース吸気フィルター交換日</text>`;
  body += `<text x="${labelX}" y="${y + 22}" font-family="WenQuanYi Zen Hei, sans-serif" font-size="14" fill="#666">喷房进气过滤器更换日</text>`;
  { const { svg } = handwritten(rng, '7/20', valX, y + 8, { fontSize: 26 }); body += svg; }
  y += rowH;

  // 乾燥炉（DO-3200）— 数値は新規に作らず、既存の設備台帳の記述（温度ムラ ±8℃）だけを書く
  body += `<line x1="30" y1="${y + 20}" x2="${W - 30}" y2="${y + 20}" stroke="#b9ad8f" stroke-width="1"/>`;
  body += `<text x="${labelX}" y="${y}" font-family="IPAGothic, sans-serif" font-size="17" fill="#333">乾燥炉(DO-3200)</text>`;
  body += `<text x="${labelX}" y="${y + 22}" font-family="WenQuanYi Zen Hei, sans-serif" font-size="14" fill="#666">烘干炉(DO-3200)</text>`;
  { const { svg } = handwritten(rng, '基準内(むら±8℃)', valX, y + 8, { fontSize: 20 }); body += svg; }
  y += rowH;

  // 記入者
  body += `<line x1="30" y1="${y + 20}" x2="${W - 30}" y2="${y + 20}" stroke="#b9ad8f" stroke-width="1"/>`;
  body += `<text x="${labelX}" y="${y}" font-family="IPAGothic, sans-serif" font-size="17" fill="#333">記入者</text>`;
  body += `<text x="${labelX}" y="${y + 22}" font-family="WenQuanYi Zen Hei, sans-serif" font-size="14" fill="#666">填写人</text>`;
  { const { svg } = handwritten(rng, '王磊', valX, y + 8, { fontSize: 26 }); body += svg; }

  const noise = paperNoise(rng, W, H, 900);
  const defects = paperDefects(rng, W, H);
  return paperGroup(W, H, `
    <text x="${W / 2}" y="70" text-anchor="middle" font-family="IPAGothic, sans-serif" font-size="30" font-weight="bold" fill="#1a1a1a">塗装条件記録</text>
    <text x="${W / 2}" y="102" text-anchor="middle" font-family="WenQuanYi Zen Hei, sans-serif" font-size="20" fill="#444">涂装条件记录</text>
    <line x1="30" y1="130" x2="${W - 30}" y2="130" stroke="#333" stroke-width="2"/>
    ${body}
    ${noise}
    ${defects}
  `);
}

// 用紙そのもの（罫線・印字・手書き）を返す。傾き・撮影感は renderPhoto() 側で
// 1 枚の SVG にまとめて描く（要素スクリーンショット＋ CSS 3D transform は
// Chromium のバウンディングボックス計算が不安定になるため使わない）。
function paperGroup(w, h, inner) {
  return `<rect x="0" y="0" width="${w}" height="${h}" fill="#f4ecd8"/>
    ${inner}
    <rect x="0" y="0" width="${w}" height="${h}" fill="none" stroke="#c9bd9e" stroke-width="6"/>`;
}

// 紙を「スマホで斜めから撮った写真ふう」に仕上げる。CSS の 3D transform（perspective）で
// 台形の歪みを、明るさムラ・蛍光灯の反射・軽いボケ・四隅の影・作業台の背景を重ねて出す。
// 決定的（rng 消費。ファイルごとの固定シードから）。
// 要素スクリーンショット（el.screenshot）は使わない。CSS 3D transform を掛けた要素の
// バウンディングボックス計算が Chromium で不安定になるため、ページ全体を
// page.screenshot() でそのまま撮る（clip 計算に頼らないので再現性が安定する）。
function renderPhoto(paperSvgInner, w, h, rng) {
  const pad = 130;
  const outerW = w + pad * 2, outerH = h + pad * 2;
  // 傾き・台形歪み（スマホで斜めから撮った見た目）。ファイルごとに rng で変える
  const rotZ = (rng() * 2 - 1) * 2.4;
  const rotX = 3 + rng() * 5.5;
  const rotY = (rng() * 2 - 1) * 4.5;
  const persp = 1050 + rng() * 350;
  // 照明のムラ（斜めのグラデーション。角度・濃さをファイルごとに変える）
  const lightAngle = Math.floor(rng() * 360);
  const lightOpacity = (0.22 + rng() * 0.16).toFixed(2);
  // 蛍光灯の反射（白いにじみ）の位置
  const glareX = 10 + rng() * 45, glareY = 5 + rng() * 35;
  // 全体のわずかなボケ・明るさ
  const blurPx = (0.35 + rng() * 0.35).toFixed(2);
  const brightness = (0.9 + rng() * 0.12).toFixed(2);

  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;}
    .desk{width:${outerW}px;height:${outerH}px;position:relative;overflow:hidden;
      background:#22262f;
      background-image:
        repeating-linear-gradient(115deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 2px, transparent 2px, transparent 11px),
        radial-gradient(ellipse at 28% 18%, rgba(255,255,255,0.05), transparent 60%);
    }
    .stage{position:absolute;left:${pad}px;top:${pad}px;width:${w}px;height:${h}px;perspective:${persp.toFixed(0)}px;}
    .tilt{position:relative;width:100%;height:100%;transform-style:preserve-3d;
      transform:rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) rotateZ(${rotZ.toFixed(2)}deg);
      box-shadow:0 30px 58px rgba(0,0,0,0.55);
      filter:blur(${blurPx}px) brightness(${brightness});
    }
    .light{position:absolute;inset:0;
      background:linear-gradient(${lightAngle}deg, rgba(0,0,0,${lightOpacity}), transparent 45%, transparent 60%, rgba(255,255,255,0.10));
      mix-blend-mode:multiply;pointer-events:none;}
    .glare{position:absolute;left:${glareX.toFixed(1)}%;top:${glareY.toFixed(1)}%;width:46%;height:30%;
      background:radial-gradient(circle, rgba(255,255,255,0.20), transparent 70%);
      mix-blend-mode:screen;pointer-events:none;}
    .vignette{position:absolute;inset:0;
      background:radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,0.4) 100%);
      pointer-events:none;}
  </style></head><body>
    <div class="desk">
      <div class="stage"><div class="tilt">
        <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${paperSvgInner}</svg>
        <div class="light"></div>
        <div class="glare"></div>
      </div></div>
      <div class="vignette"></div>
    </div>
  </body></html>`;
  return { html, outerW, outerH };
}

/* ---------- PDF: 段取り作業標準書（Rev.C / Rev.A） ---------- */
function buildStandardHtml({ rev, revDate, preheat }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:'IPAGothic', sans-serif;color:#111;margin:40px;}
    h1{font-size:22px;border-bottom:2px solid #333;padding-bottom:8px;}
    table.meta{border-collapse:collapse;margin:16px 0;font-size:13px;}
    table.meta td{border:1px solid #999;padding:4px 10px;}
    h2{font-size:16px;margin-top:24px;border-left:6px solid #556;padding-left:8px;}
    .rev-table{border-collapse:collapse;width:100%;margin-top:20px;font-size:12px;}
    .rev-table td, .rev-table th{border:1px solid #999;padding:5px 8px;}
    .note{color:#555;font-size:12px;}
  </style></head><body>
    <h1>段取り作業標準書 ライン3 金型D-118 / 换型作业标准书 3号线 模具D-118</h1>
    <table class="meta">
      <tr><td>文書番号</td><td>WS-L3-04</td><td>版</td><td>${rev}</td><td>改訂日</td><td>${revDate}</td></tr>
      <tr><td>発行部門</td><td colspan="5">設備保全課 / 设备保全科</td></tr>
    </table>
    <h2>§1 目的</h2>
    <p>ライン3・プレス機PX-200における金型D-118（品番SK-3310-A用）の段取り手順を定める。</p>
    <h2>§2 適用範囲</h2>
    <p>ライン3（L3）の金型交換作業に適用する。</p>
    <h2>§3 段取り手順・予熱条件</h2>
    <p>${preheat}</p>
    <h2>改訂履歴</h2>
    <table class="rev-table">
      <tr><th>版</th><th>改訂日</th><th>改訂内容</th></tr>
      <tr><td>Rev.A</td><td>2019-06-01</td><td>初版制定</td></tr>
      ${rev === 'Rev.C' ? '<tr><td>Rev.C</td><td>2024-11-25</td><td>NC-2024-0118（冷間時の位置ずれによる不適合）の是正として金型予熱基準を追加</td></tr>' : ''}
    </table>
    <p class="note">本設計 docs/handoff/2026-09-16-showcase-demo.md §5-2 に基づくダミー文書。架空の会社・架空の記録です。</p>
  </body></html>`;
}

// Chromium の page.pdf() は生成時刻を /CreationDate・/ModDate に埋め込むため、そのままでは
// 2 回連続実行してもバイトが一致しない。再現性のため固定日時に置き換える。
// "D:YYYYMMDDHHMMSS+00'00'" は常に同じ桁数なので、桁数を変えずに置換すれば
// PDF のバイトオフセット（xref）を壊さない。
function normalizePdfDates(buf) {
  let s = buf.toString('latin1');
  s = s.replace(/(CreationDate \(D:)\d{14}([+-]\d{2}'\d{2}'\))/g, `$120260101000000$2`);
  s = s.replace(/(ModDate \(D:)\d{14}([+-]\d{2}'\d{2}'\))/g, `$120260101000000$2`);
  return Buffer.from(s, 'latin1');
}

/* ---------- 資産の一覧と生成（{name: Buffer} を返すだけ。書き込みは呼び出し側） ---------- */
async function generateAll() {
  const results = new Map(); // name -> Buffer

  const pw = await resolvePlaywright();
  const browser = await pw.chromium.launch();
  const version = browser.version();
  const page = await browser.newPage({ deviceScaleFactor: 2 });

  const shots = [
    {
      name: 'qa1-inspection-0905.jpg', w: 720, h: 960, seed: 190501,
      build: (rng) => buildInspectionSheetHtml(rng, { date: '2025-09-05', lot: '250905-L3', inspector: '陈静', remarkIllegible: false }),
    },
    {
      name: 'qa1-inspection-0906.jpg', w: 720, h: 960, seed: 190601,
      build: (rng) => buildInspectionSheetHtml(rng, { date: '2025-09-06', lot: '250905-L3', inspector: '周敏', remarkIllegible: true }),
    },
    {
      name: 'qa1-paint-cond-0905.jpg', w: 720, h: 900, seed: 190502,
      build: (rng) => buildPaintConditionHtml(rng),
    },
  ];

  for (const shot of shots) {
    const rng = mulberry32(shot.seed);
    const paper = shot.build(rng);
    const { html, outerW, outerH } = renderPhoto(paper, shot.w, shot.h, rng);
    await page.setViewportSize({ width: outerW, height: outerH });
    await page.setContent(html, { waitUntil: 'load' });
    // ページ全体をそのまま撮る（要素の bounding box に頼らない＝再現性が安定する）
    const buf = await page.screenshot({ type: 'jpeg', quality: 82 });
    results.set(shot.name, buf);
  }

  const pdfs = [
    { name: 'kn11-ws-l3-04-revC.pdf', rev: 'Rev.C', revDate: '2024-11-25', preheat: '金型は使用前に**40℃以上**に予熱すること。NC-2024-0118（2024-11-18、冷間時の位置ずれによる不適合）の是正として設備保全課が追加した規定である。' },
    { name: 'kn11-ws-l3-04-revA.pdf', rev: 'Rev.A', revDate: '2019-06-01', preheat: '段取り後、暖機運転を10分間行うこと。金型の予熱に関する規定は無い。' },
  ];
  for (const pdf of pdfs) {
    const html = buildStandardHtml(pdf);
    await page.setContent(html, { waitUntil: 'load' });
    const buf = await page.pdf({ format: 'A4', printBackground: true });
    results.set(pdf.name, normalizePdfDates(buf));
  }

  await browser.close();

  // 音声（kn11-interview-*.wav/.txt）はここでは作らない。tools/gen-demo-audio.py が担当する
  // （PM 決定 2026-09-16、Issue #311：オフライン TTS で実際の合成音声を生成する）。

  return { results, version };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const { results, version } = await generateAll();

  if (CHECK) {
    let mismatches = 0;
    for (const [name, buf] of results) {
      const dst = resolve(OUT_DIR, name);
      if (!existsSync(dst)) { console.error(`❌ ${name}: 既存ファイルが無い（先に node tools/gen-demo-assets.mjs を実行してください）`); mismatches++; continue; }
      const existing = readFileSync(dst);
      if (!existing.equals(buf)) { console.error(`❌ ${name}: バイトが既存ファイルと一致しない（既存 ${existing.length} bytes / 再生成 ${buf.length} bytes）`); mismatches++; }
      else console.log(`✅ ${name}: バイト一致（${buf.length} bytes）`);
    }
    console.log(`\n使用した Chromium: ${version}`);
    if (mismatches) { console.error(`\n--check FAIL: ${mismatches} 件のファイルが再現しない`); process.exit(1); }
    console.log('\n--check PASS: 全ファイルがバイト一致（再現性あり）');
    return;
  }

  for (const [name, buf] of results) {
    writeFileSync(resolve(OUT_DIR, name), buf);
    console.log(`生成: ${name} (${buf.length} bytes)`);
  }
  console.log(`\n使用した Chromium: ${version}`);
  console.log('README.md の「使った Chromium のバージョン」がこの値と合っているか確認してください。');
}

main().catch((e) => { console.error(e); process.exit(1); });
