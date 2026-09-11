#!/usr/bin/env node
/**
 * tools/check-nodata.mjs — 「実データが入っていない」ことを機械で見る（public リポジトリの防壁）
 *
 * 設計書: shoulang0729/dify `docs/handoff/2026-09-10-portal-nocobase.md` §7-4（G1〜G5・N1〜N6）・
 * `docs/handoff/2026-09-11-repo-layout-v3.md` §7（C-c。走査範囲を `portal/**` に読み替え）・§4-2
 * （S-1〜S-7。切り出し可能性）。
 * `shoulang0729/dify` の `tools/check-world.mjs` と**同じ allowlist 方式**：
 * 手書きの禁止語リストは作らない（禁止語リスト自体が実名の一覧になり、public に置くのは本末転倒）。
 * allowlist は `seed/world/`（`shoulang0729/dify` 側 `data/world/` から `scripts/gen-seed.mjs` が
 * 生成した架空データ）から機械で生成する。
 *
 * このファイルは `portal/tools/check-nodata.mjs` に置かれているため、`ROOT` は自動的に `portal/` に
 * なる（このスクリプトの位置から `..` を 1 回たどるだけ）。「走査範囲を portal/** に限定する」読み替え
 * （設計書 §7 C-c）はディレクトリ配置そのもので実現している。
 *
 * 使い方:
 *   node tools/check-nodata.mjs            構造(G1〜G5・S-1)は必ず検査。内容(N1〜N6)のうち N4/N5/N6 は
 *                                           必ず FAIL。N1〜N3 は baseline 超過またはハッシュ不一致で FAIL、
 *                                           それ以外は warn（exit 0 のまま）
 *   node tools/check-nodata.mjs --strict   N1〜N3 の warn も 1 件でもあれば FAIL（掃除の PR 用。
 *                                           check-world.mjs --strict と同じ作法）
 *   node tools/check-nodata.mjs --update   tools/nodata.baseline.json を今の結果で更新する
 *                                           （regress.mjs --update と同じ作法。設計書に書かれた
 *                                           意図的な変更のときだけ使う）
 *   npm test                                このスクリプトを含む（公開の防壁なので CI に入れる）
 *
 * ---------------------------------------------------------------------------------------------
 * 何を拾って、何を拾わないか
 * ---------------------------------------------------------------------------------------------
 *
 * 拾う対象は次に固定する。増やすときは設計書を改訂する。
 *
 * 【構造（G1〜G5・S-1。必ず FAIL）】
 *   G1 トップレベルに置いてよいディレクトリ・ファイルは決まった集合だけ（schema/nocobase/seed/env/scripts/tools/docs）
 *   G2 *.sql / *.dump / *.bak / *.xlsx / *.db / *.sqlite を置かない（schema/ の DDL は例外。下記参照）
 *   G3 *.csv は seed/ の下にしか置けない
 *   G4 .env（.env.example を除く）・*.key・*.pem・secrets/ を置かない
 *   G5 seed/ 以外に 1 MB を超えるファイルを置かない
 *   S-1 portal/** の .mjs/.sh/.yml に「../」（portal/ の外へ出る相対パス）が現れるのは
 *       scripts/gen-seed.mjs・tools/check-seed-fresh.mjs の 2 ファイルだけ（設計書 §4-2 S-1）
 *
 * 【内容（N1〜N6）】走査対象は nocobase/**・seed/**・docs/**・env/**・.env.example・schema/**・
 * scripts/**・tools/** の系統だけ。**README.md・CLAUDE.md・package.json はこの内容走査の対象に
 * 含めない**（構造検査 G1 の対象ではある）。
 *
 *   N1 氏名らしき文字列（warn・baseline）：役職・敬称語に隣接する漢字 2〜4 字で allowlist に無いもの
 *   N2 社員番号らしきパターン（warn・baseline）：`[A-Z]{1,3}-?\d{4,8}` / 連続数字 `\d{6,10}` で
 *      allowlist に無いもの
 *   N3 部署名・拠点名（warn・baseline）：「部/課/室/センター/工場/支店/本部/事業部」で終わる語で
 *      allowlist に無いもの
 *   N4 メールアドレス（FAIL）：RFC 2606/6761 予約ドメインと seed/world 由来の allowlist を除く
 *   N5 電話番号（FAIL）：日本・中国の書式。架空とわかるダミー（全桁同一・明示ダミー）を除く
 *   N6 実在ドメイン・生 IP（FAIL）：URL の allowlist とプライベート IP を除く
 *
 * G2 の例外（schema/*.sql）：`portal/schema/**` は Flyway の DDL を置く場所と設計で決めている
 * （`docs/handoff/2026-09-11-repo-layout-v3.md` §2-2）。DDL のみ（INSERT 文を含まない）ことは
 * reviewer が diff で見る。機械では「schema/ の外の *.sql」だけを G2 の対象にする。
 *
 * 【防げないこと】
 *   - schema そのものの機微（列名から自社が何を測っているかが読めること）→ この検査では拾えない。
 *     PM が一覧で見る側
 *   - 意味を変えずに書き換えられた実データ（実在の数字を 1 だけずらす等）→ 機械では原理的に無理。
 *     C-a（そもそも実データを持ち込まない）で塞ぐ
 *   - N1〜N3 は「誤検知が必ず出る」種類なので warn 止まり。個々の warn は `docs/nodata-known.md` に
 *     理由付きで記録し、`tools/nodata.baseline.json` で「増えたら FAIL・すり替わったら FAIL」を機械で見る
 *
 * ---------------------------------------------------------------------------------------------
 * baseline の「中身のハッシュ」について
 * ---------------------------------------------------------------------------------------------
 * 件数の基準だけだと、既存の warn 1 件が別の実名にすり替わっても件数が変わらず検知できない。そこで
 * baseline には各 N1〜N3 ごとに
 *   { count: <件数>, hash: sha256(重複排除・ソート済みの警告文字列一覧を改行結合したもの) }
 * を持たせ、**件数が増えた場合と、件数が同じでもハッシュが変わった場合の両方を FAIL にする**。
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'node:fs';
import { resolve, dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');
const update = process.argv.includes('--update');

let failCount = 0;
let warnCount = 0;
const fail = (m) => { failCount++; console.log('❌', m); };
const warnMsg = (m) => { warnCount++; console.log('⚠️ ', m); };
const ok = (m) => console.log('✅', m);
const section = (t) => console.log(`\n── ${t} ──`);

/* ================================================================================
 * ファイル走査ユーティリティ
 * ================================================================================ */
const ALWAYS_EXCLUDE_DIRS = new Set(['node_modules', '.git', 'dist']);

function walk(dir, { excludeTop = false } = {}) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (ALWAYS_EXCLUDE_DIRS.has(name.name)) continue;
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function relPath(p) {
  return relative(ROOT, p).split('\\').join('/');
}

/* ================================================================================
 * G1〜G5・S-1: 構造の検査（FAIL）
 * ================================================================================ */

// G1: トップレベルに置いてよい名前の集合（設計書 §2-1 のツリー）
const ALLOWED_TOP_DIRS = new Set(['schema', 'nocobase', 'seed', 'env', 'scripts', 'tools', 'docs']);
const ALLOWED_TOP_FILES = new Set([
  'README.md', 'CLAUDE.md', 'package.json', 'package-lock.json',
  '.gitignore', '.env.example', '.nvmrc',
]);

function checkG1() {
  section('G1. トップレベルの構造');
  const entries = readdirSync(ROOT, { withFileTypes: true });
  let violation = false;
  for (const e of entries) {
    if (ALWAYS_EXCLUDE_DIRS.has(e.name)) continue;
    if (e.isDirectory()) {
      if (!ALLOWED_TOP_DIRS.has(e.name)) {
        fail(`G1: トップレベルに許可されていないディレクトリ: ${e.name}/`);
        violation = true;
      }
    } else if (!ALLOWED_TOP_FILES.has(e.name)) {
      fail(`G1: トップレベルに許可されていないファイル: ${e.name}`);
      violation = true;
    }
  }
  if (!violation) ok('トップレベルは許可された集合のみ');
}

// G2: DB dump・表計算ファイルを一切置かない。ただし schema/ の下の *.sql（Flyway の DDL）は例外
const FORBIDDEN_EXTS = new Set(['.sql', '.dump', '.bak', '.xlsx', '.db', '.sqlite']);
function checkG2(allFiles) {
  section('G2. DB dump・表計算ファイルを置かない（schema/*.sql は DDL として例外）');
  const hits = allFiles.filter(p => {
    const ext = extname(p).toLowerCase();
    if (!FORBIDDEN_EXTS.has(ext)) return false;
    if (ext === '.sql' && relPath(p).startsWith('schema/')) return false; // Flyway DDL の置き場
    return true;
  });
  if (hits.length) hits.forEach(p => fail(`G2: 禁止拡張子のファイル: ${relPath(p)}`));
  else ok('禁止拡張子（.sql/.dump/.bak/.xlsx/.db/.sqlite）は schema/ の DDL 以外に無い');
}

// G3: *.csv は seed/ の下にしか置けない
function checkG3(allFiles) {
  section('G3. *.csv は seed/ の下にしか置けない');
  const hits = allFiles.filter(p => extname(p).toLowerCase() === '.csv' && !relPath(p).startsWith('seed/'));
  if (hits.length) hits.forEach(p => fail(`G3: seed/ の外にある CSV: ${relPath(p)}`));
  else ok('CSV はすべて seed/ の下');
}

// G4: 秘密ファイル・secrets/ ディレクトリを置かない
function checkG4(allFiles) {
  section('G4. 秘密ファイル・secrets/ を置かない');
  let violation = false;
  for (const p of allFiles) {
    const rel = relPath(p);
    const base = p.split('/').pop();
    if (rel.split('/').includes('secrets')) { fail(`G4: secrets/ ディレクトリ配下: ${rel}`); violation = true; continue; }
    if (/^\.env(\..+)?$/.test(base) && base !== '.env.example') { fail(`G4: .env 系ファイル: ${rel}`); violation = true; continue; }
    if (/\.(key|pem)$/i.test(base)) { fail(`G4: 秘密鍵らしきファイル: ${rel}`); violation = true; continue; }
  }
  if (!violation) ok('.env（.env.example 除く）・*.key・*.pem・secrets/ は無い');
}

// G5: seed/ 以外に 1 MB を超えるファイルを置かない
const ONE_MB = 1024 * 1024;
function checkG5(allFiles) {
  section('G5. seed/ 以外に 1 MB を超えるファイルを置かない');
  const hits = [];
  for (const p of allFiles) {
    if (relPath(p).startsWith('seed/')) continue;
    let size = 0;
    try { size = statSync(p).size; } catch { continue; }
    if (size > ONE_MB) hits.push(p);
  }
  if (hits.length) hits.forEach(p => fail(`G5: 1 MB 超のファイル（seed/ の外）: ${relPath(p)}（${statSync(p).size} bytes）`));
  else ok('seed/ の外に 1 MB 超のファイルは無い');
}

// S-1: portal/** の .mjs/.sh/.yml に「../」が現れるのは allowlist の 2 ファイルだけ
// （tools/check-nodata.mjs 自身はこの検査の実装として文字列リテラル "../" を持つので自己参照除外）
const S1_ALLOWLIST = new Set(['scripts/gen-seed.mjs', 'tools/check-seed-fresh.mjs']);
const S1_SELF_EXCLUDE = new Set(['tools/check-nodata.mjs']);
function checkS1(allFiles) {
  section('S-1. 切り出し可能性：portal/ の外への相対参照は allowlist の 2 ファイルだけ');
  const targets = allFiles.filter(p => /\.(mjs|sh|yml|yaml)$/.test(p));
  let violation = false;
  for (const p of targets) {
    const rel = relPath(p);
    if (S1_ALLOWLIST.has(rel)) continue;
    if (S1_SELF_EXCLUDE.has(rel)) continue;
    const text = readTextSafe(p);
    if (text == null) continue;
    if (text.includes('../')) {
      fail(`S-1: ${rel} に "../"（portal/ の外へ出る相対パス）がある。許されるのは ${[...S1_ALLOWLIST].join(' / ')} だけ`);
      violation = true;
    }
  }
  if (!violation) ok('portal/ の .mjs/.sh/.yml に "../" は allowlist の 2 ファイル以外に無い');
}

/* ================================================================================
 * allowlist の生成（seed/world/ から機械で作る。手書きの禁止語リストは作らない）
 * ================================================================================ */
const WORLD_INDUSTRIES = ['mfg', 'fin', 'it'];

function parseCSV(text) {
  const lines = text.split(/\r?\n/);
  while (lines.length && lines[0].trim().startsWith('#')) lines.shift();
  const body = lines.join('\n');
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (inQuotes) {
      if (c === '"') { if (body[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; } }
      else field += c;
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

function readIfExists(p) {
  return existsSync(p) ? readFileSync(p, 'utf8') : '';
}

function buildAllowlist() {
  const names = new Set();
  const depts = new Set();
  const worldDir = resolve(ROOT, 'seed/world');
  for (const ind of WORLD_INDUSTRIES) {
    for (const row of parseCSV(readIfExists(resolve(worldDir, ind, 'people.csv')))) {
      for (const k of ['name_ja', 'name_zh', 'name_en']) if (row[k]) names.add(row[k].trim());
    }
    for (const row of parseCSV(readIfExists(resolve(worldDir, ind, 'org.csv')))) {
      for (const k of ['dept_ja', 'dept_zh', 'dept_en']) if (row[k]) depts.add(row[k].trim());
    }
    // company.md の拠点表（shoulang0729/dify 側 check-world.mjs W3 と同じ表の読み方）
    const companyMd = readIfExists(resolve(worldDir, ind, 'company.md'));
    for (const m of companyMd.matchAll(/^\|\s*(\w+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|/gm)) {
      depts.add(m[2].trim()); depts.add(m[3].trim()); depts.add(m[4].trim());
    }
  }
  return { names, depts };
}

// N3 の一般語除外リスト（tools/nodata-common-words.txt）。1 行 1 語 + 理由コメント必須、上限 50 語
const COMMON_WORDS_MAX = 50;
function loadCommonWords() {
  const p = resolve(ROOT, 'tools/nodata-common-words.txt');
  const text = readIfExists(p);
  const words = new Set();
  const badLines = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(\S+)\s*#\s*(.+)$/);
    if (!m) { badLines.push(raw); continue; }
    words.add(m[1]);
  }
  if (badLines.length) {
    fail(`tools/nodata-common-words.txt: 理由コメント（# ...）の無い行が ${badLines.length} 件`);
  }
  if (words.size > COMMON_WORDS_MAX) {
    fail(`tools/nodata-common-words.txt: 語数が上限 ${COMMON_WORDS_MAX} を超えている（${words.size} 語）。設計書の改訂が要る`);
  }
  return words;
}

/* ================================================================================
 * N1〜N6: 内容の検査
 * ================================================================================ */
const SCAN_DIRS = ['schema', 'nocobase', 'seed', 'docs', 'env', 'scripts', 'tools'];
const SCAN_EXTRA_FILES = ['.env.example'];
const BINARY_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.gz', '.woff', '.woff2', '.ttf']);

// docs/nodata-known.md は N1〜N3 の warn を「理由付きで転記する」台帳そのものなので、自己参照を避けるため
// 内容走査から除く（G1〜S-1 の構造検査は通常どおり対象）
const CONTENT_SCAN_EXCLUDE = new Set(['docs/nodata-known.md']);

function readTextSafe(p) {
  try {
    const buf = readFileSync(p);
    if (buf.includes(0)) return null; // NUL バイトを含む＝バイナリとみなし読まない
    return buf.toString('utf8');
  } catch { return null; }
}

function collectScanFiles() {
  const files = [];
  for (const d of SCAN_DIRS) files.push(...walk(resolve(ROOT, d)));
  for (const f of SCAN_EXTRA_FILES) {
    const p = resolve(ROOT, f);
    if (existsSync(p)) files.push(p);
  }
  return files
    .filter(p => !BINARY_EXTS.has(extname(p).toLowerCase()))
    .filter(p => !CONTENT_SCAN_EXCLUDE.has(relPath(p)));
}

function sha256(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

/* ---- N1: 氏名らしき文字列（warn・baseline） ---- */
const TITLE_WORDS = ['氏', '様', 'さん', '主任', '課長', '部長', '次長', '係長', '総経理', '経理'];
const TITLE_ALT = TITLE_WORDS.join('|');
const N1_RE = new RegExp(
  `([\\u4E00-\\u9FFF]{2,4})\\s?(?:${TITLE_ALT})|(?:${TITLE_ALT})\\s?([\\u4E00-\\u9FFF]{2,4})`,
  'g'
);
function checkN1(files, allow) {
  const hits = new Set();
  for (const f of files) {
    const text = readTextSafe(f.path);
    if (text == null) continue;
    for (const m of text.matchAll(N1_RE)) {
      const cand = m[1] || m[2];
      if (!cand) continue;
      if (allow.names.has(cand)) continue;
      const isDeptFragment = [...allow.depts].some(d => d && (d.includes(cand) || cand.includes(d)));
      if (isDeptFragment) continue;
      hits.add(`${cand}（${relPath(f.path)}）`);
    }
  }
  return [...hits].sort();
}

/* ---- N2: 社員番号らしきパターン（warn・baseline） ---- */
const MGMT_CODE_RE = /^(KN|QA|DC|LG|NM|EN|GN|PT|RS|CV|FA|PO|EG|SO)-\d{2}$/;
const DATE_RE = /^(19|20)\d{2}[-/]?(0[1-9]|1[0-2])[-/]?(0[1-9]|[12]\d|3[01])$/;
const VERSION_RE = /^v?\d+\.\d+\.\d+$/;
const N2_RE = /\b[A-Z]{1,3}-?\d{4,8}\b|\b\d{6,10}\b/g;
function checkN2(files) {
  const hits = new Set();
  for (const f of files) {
    const text = readTextSafe(f.path);
    if (text == null) continue;
    for (const m of text.matchAll(N2_RE)) {
      const cand = m[0];
      if (MGMT_CODE_RE.test(cand)) continue;
      if (DATE_RE.test(cand)) continue;
      if (VERSION_RE.test(cand)) continue;
      hits.add(`${cand}（${relPath(f.path)}）`);
    }
  }
  return [...hits].sort();
}

/* ---- N3: 部署名・拠点名（warn・baseline） ---- */
const DEPT_SUFFIX_RE = /[\u4E00-\u9FFF0-9A-Za-z]{2,10}(?:部|課|室|センター|工場|支店|本部|事業部)/g;
function checkN3(files, allow, commonWords) {
  const hits = new Set();
  for (const f of files) {
    const text = readTextSafe(f.path);
    if (text == null) continue;
    for (const m of text.matchAll(DEPT_SUFFIX_RE)) {
      const cand = m[0];
      if (allow.depts.has(cand)) continue;
      if (commonWords.has(cand)) continue;
      if ([...allow.depts].some(d => d && d.includes(cand))) continue;
      hits.add(`${cand}（${relPath(f.path)}）`);
    }
  }
  return [...hits].sort();
}

/* ---- N4: メールアドレス（FAIL） ---- */
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const RESERVED_EMAIL_DOMAIN_RE = /(^|\.)(example\.com|example\.org|example\.net|example|invalid|test|localhost)$/i;
function checkN4(files, allow) {
  const hits = [];
  for (const f of files) {
    const text = readTextSafe(f.path);
    if (text == null) continue;
    for (const m of text.matchAll(EMAIL_RE)) {
      const addr = m[0];
      const domain = addr.split('@')[1] || '';
      if (RESERVED_EMAIL_DOMAIN_RE.test(domain)) continue;
      if (allow.emails && allow.emails.has(addr)) continue;
      hits.push(`${addr}（${relPath(f.path)}）`);
    }
  }
  return hits;
}

/* ---- N5: 電話番号（FAIL） ---- */
const PHONE_JP_RE = /0\d{1,4}-\d{1,4}-\d{4}/g;
const PHONE_CN_MOBILE_RE = /1[3-9]\d{9}/g;
const PHONE_CN_PLUS_RE = /\+86[\d-]{9,}/g;
function isDummyPhone(s) {
  const digits = s.replace(/\D/g, '');
  if (/^(\d)\1+$/.test(digits)) return true;
  if (/^\+?81-?3-?0000-?0000$/.test(s)) return true;
  return false;
}
function checkN5(files) {
  const hits = [];
  for (const f of files) {
    const text = readTextSafe(f.path);
    if (text == null) continue;
    for (const re of [PHONE_JP_RE, PHONE_CN_MOBILE_RE, PHONE_CN_PLUS_RE]) {
      for (const m of text.matchAll(re)) {
        const num = m[0];
        if (isDummyPhone(num)) continue;
        hits.push(`${num}（${relPath(f.path)}）`);
      }
    }
  }
  return hits;
}

/* ---- N6: 実在ドメイン・生 IP（FAIL） ---- */
const URL_HOST_RE = /https?:\/\/([^/\s"'<>]+)/g;
const IP_RE = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
const ALLOWED_HOSTS = new Set([
  'dify.ai', 'cloud.dify.ai', 'api.dify.ai', 'github.com',
  'nocobase.com', 'docs.nocobase.com', 'registry.npmjs.org',
  'shoulang0729.github.io', 'localhost', '127.0.0.1',
]);
function hostAllowed(host) {
  const h = host.split(':')[0].split('/')[0];
  if (ALLOWED_HOSTS.has(h)) return true;
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return isPrivateOrZeroIp(h);
  return [...ALLOWED_HOSTS].some(a => h.endsWith(`.${a}`));
}
function isPrivateOrZeroIp(ip) {
  if (ip === '0.0.0.0') return true;
  const parts = ip.split('.').map(Number);
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 127) return true;
  return false;
}
function checkN6(files) {
  const hits = [];
  for (const f of files) {
    const text = readTextSafe(f.path);
    if (text == null) continue;
    for (const m of text.matchAll(URL_HOST_RE)) {
      const host = m[1];
      if (!hostAllowed(host)) hits.push(`URL のホスト ${host}（${relPath(f.path)}）`);
    }
    for (const m of text.matchAll(IP_RE)) {
      if (!isPrivateOrZeroIp(m[0])) hits.push(`生 IP ${m[0]}（${relPath(f.path)}）`);
    }
  }
  return hits;
}

/* ================================================================================
 * baseline（N1〜N3）
 * ================================================================================ */
const BASELINE_PATH = resolve(ROOT, 'tools/nodata.baseline.json');

function summarize(list) {
  return { count: list.length, hash: sha256([...list].sort().join('\n')) };
}

function loadBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  try { return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')); } catch { return null; }
}

function writeBaseline(summaries) {
  mkdirSync(dirname(BASELINE_PATH), { recursive: true });
  const payload = {
    _comment: 'tools/check-nodata.mjs --update で生成。手で編集しない。count は件数、hash は重複排除・ソート済み一覧の sha256（同じ件数でも中身がすり替わったら hash が変わり FAIL になる）',
    generatedAt: new Date().toISOString(),
    checks: summaries,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n');
}

function reportWithBaseline(key, label, list, baseline, baselineExists) {
  const cur = summarize(list);
  if (list.length) {
    console.log(`⚠️  ${label} ${list.length} 件`);
    list.slice(0, 20).forEach(x => console.log('    -', x));
    if (list.length > 20) console.log(`    … ほか ${list.length - 20} 件`);
  } else {
    ok(`${label}：該当なし`);
  }
  warnCount += list.length;

  if (strict && list.length) {
    fail(`${key}: --strict モードにつき warn 1 件以上は FAIL 扱い（${list.length} 件）`);
  } else if (baselineExists && !update) {
    const base = (baseline && baseline.checks && baseline.checks[key]) || { count: 0, hash: sha256('') };
    if (cur.count > base.count) {
      fail(`${key}: baseline（${base.count} 件）より増えている（${cur.count} 件）。意図した追加なら --update で基準を更新し、PR に理由を書く`);
    } else if (cur.hash !== base.hash) {
      fail(`${key}: 件数は baseline と同じ（${cur.count} 件）だが中身が変わっている（別の実名にすり替わった可能性）。意図した変更なら --update で基準を更新し、PR に理由を書く`);
    }
  }
  return cur;
}

/* ================================================================================
 * 実行
 * ================================================================================ */
console.log('tools/check-nodata.mjs — 実データが入っていないことの機械検査（走査範囲: portal/**）\n');
console.log(strict ? 'モード: --strict（warn も FAIL 扱い）' : update ? 'モード: --update（baseline を更新）' : 'モード: 通常');

const allFiles = walk(ROOT);

checkG1();
checkG2(allFiles);
checkG3(allFiles);
checkG4(allFiles);
checkG5(allFiles);
checkS1(allFiles);

const allow = buildAllowlist();
allow.emails = new Set();
const commonWords = loadCommonWords();

const scanFiles = collectScanFiles().map(p => ({ path: p }));

section('N1. 氏名らしき文字列（役職・敬称語に隣接する漢字 2〜4 字）');
const n1 = checkN1(scanFiles, allow);

section('N3. 部署名・拠点名（部/課/室/センター/工場/支店/本部/事業部 で終わる語）');
const n3 = checkN3(scanFiles, allow, commonWords);

section('N2. 社員番号らしきパターン');
const n2 = checkN2(scanFiles);

const baseline = loadBaseline();
const baselineExists = existsSync(BASELINE_PATH);
section('baseline との突き合わせ（N1〜N3）');
const summaries = {};
summaries.N1 = reportWithBaseline('N1', 'N1 未登録の氏名らしき文字列', n1, baseline, baselineExists);
summaries.N2 = reportWithBaseline('N2', 'N2 未登録の社員番号らしきパターン', n2, baseline, baselineExists);
summaries.N3 = reportWithBaseline('N3', 'N3 未登録の部署名・拠点名らしき文字列', n3, baseline, baselineExists);

section('N4. メールアドレス（FAIL）');
const n4 = checkN4(scanFiles, allow);
if (n4.length) n4.forEach(x => fail(`N4: ${x}`)); else ok('メールアドレスの混入なし');

section('N5. 電話番号（FAIL）');
const n5 = checkN5(scanFiles);
if (n5.length) n5.forEach(x => fail(`N5: ${x}`)); else ok('電話番号の混入なし');

section('N6. 実在ドメイン・生 IP（FAIL）');
const n6 = checkN6(scanFiles);
if (n6.length) n6.forEach(x => fail(`N6: ${x}`)); else ok('allowlist に無いドメイン・生 IP の混入なし');

if (update) {
  writeBaseline(summaries);
  console.log(`\n📝 tools/nodata.baseline.json を更新した（N1=${summaries.N1.count} / N2=${summaries.N2.count} / N3=${summaries.N3.count}）`);
  console.log('   ※ PR 本文に「設計書 §X のデータ変更に伴う基準更新」と書くこと');
} else if (!baselineExists || !baseline) {
  writeBaseline(summaries);
  console.log('\n📝 tools/nodata.baseline.json が無かった（または壊れていた）ので今の結果で新規作成した（初回実行。この回は比較 FAIL を出さない）');
}

console.log(`\n合計: FAIL ${failCount} 件 / warn ${warnCount} 件`);
console.log(failCount ? '❌ FAIL' : '✅ PASS');
process.exit(failCount ? 1 : 0);
