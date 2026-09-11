#!/usr/bin/env node
/**
 * tools/verify.mjs — 静的検証ハーネス（CLAUDE.md §2 load-bearing の機械検出）
 *
 * 使い方:  node tools/verify.mjs
 * 終了コード: 0 = 全 PASS / 1 = 1つ以上 FAIL
 *
 * チェック項目（設計書 docs/handoff/2026-09-07-split-catalog.md §4-2。PR-C でアプリ層も分割対応）:
 *   1.   JS 構文（各 JS ファイルを個別に node --check）
 *   1-A. （新規）二重宣言：全 JS（データ層＋アプリ層）を <script src> の順に連結して node --check
 *   1-B. （新規）読み込み契約：実ファイル存在／相対パスのみ／scenarios タグ集合＝ディレクトリの *.js 集合／
 *        読み込み順が data/ui → data/catalog → data/home → data/style → data/live → data/scenarios/* → app → render → events／
 *        <script src> の本数は実ディレクトリから計算（data 5 + scenarios <業種ごとの台本ファイル数> + app/render/events 3）・
 *        インライン <script> 0 個／catalog.html に <style> が 0 個
 *   2.   i18n キー集合の一致（T / TAGS / PATTERNS / CATS / SVCS / TEMPLATES が ja/zh/en を全て持ち、空でない。en にかな残りなし）
 *   3.   未定義キー参照（t('key') / T.key が T に存在するか。全 JS ファイルの連結テキストを対象）
 *   4.   未使用キー（T にあるがどこからも参照されない）※警告扱い（FAIL にしない）
 *   5.   CSS トークン（mock/css/tokens.css・mock/css/components.css を直接読む。var(--x) が定義済みか / dark ブロック存在 / コンポーネント CSS に色直値なし / --ntt-* が dark で上書きされていない）
 *   5-A. index.html のトークン非コピー（mock/index.html が css/tokens.css を <link> し、トークン定義のコピーを持たない）
 *   6.   データ整合（SVCS の cat/sub が CATS に存在、tags が TAGS に存在、st ∈ {1,2,3}、added は YYYY-MM-DD、管理番号重複なし）
 *   7.   共通レイヤー契約（state の必須キー / data-act 一覧 / detectLang 存在 / localStorage キー）。
 *        対象は js/app.js + js/render.js + js/events.js の連結（PR-C：アプリ層はすべてファイル分割済み。
 *        インライン <script> が残っていれば loadMock() がそれも拾う＝退行時も検査は効く）
 *   8.   Pages 設定（pages.yml の path: mock / mock/.nojekyll / mock/ 直下に _ 始まりディレクトリが無い）
 *   9.   シナリオ整合（SCENARIOS の id が SVCS に存在／template が TEMPLATES に存在／id 接頭＝ファイル名／台本の無い SVCS は warn）
 *   10.  ホームデータ整合（HOME / FEED）
 *   11.  索引の鮮度（docs/service-map.md が tools/gen-index.mjs --check と一致）＋
 *        トップ README.md の「4 区分」地図のリンク先が実在すること
 *        （設計書 docs/handoff/2026-09-07-repo-layout-v2.md §1-3・§10 Q7）
 *   12.  環境レイヤー（dify/env/** ・ワークフローの環境変数）：schema: 1 と必須キー／秘密・実名の直値が
 *        無いこと（sk- 文字列・32 文字以上の 16 進 or base64 らしき文字列・cloud-master の既知 2 URL 以外の
 *        生 http(s):// URL）／`render.py --env cloud-master --all --check` が通ること（python3 が無ければ
 *        warn で skip）
 *        （設計書 docs/handoff/2026-09-07-repo-layout-v2.md §3-2・§4-2・§8 PR-2）
 *   12-e.（新規）apps: の管理番号一覧が dify/apps/*.yml と過不足なく一致し、id が null/${VAR}/UUID 形のいずれかで、
 *        cloud-master 以外に生 UUID が無いこと（設計書 docs/handoff/2026-09-08-cloud-console-deploy.md §3-4・Issue #114 PR-2）
 *   12-f.（新規）.github/workflows/** に "DIFY_DATASET_ID_" という文字列が無いこと（コメントも含む。C1）。
 *        dataset id は scripts/dify/dataset_ids.py が実行時に Datasets API から名前で解決し、render.py の
 *        サブプロセス専用の env にだけ渡す（render.py 自体・ワークフローには置かない。§2-12 のバイト一致を守るため）
 *        （設計書 docs/handoff/2026-09-09-dataset-ids-in-ci.md §4-2・§5・§6。Issue #209 PR-1。新しい節番号は
 *        取らない＝§12 の枝番として追加する。§13 は #121 W2 用に予約済みのため使わない）
 *   14.  （新規）本番リンク（LIVE）の契約：mock/js/data/live.js が存在しオブジェクトとして読める（{} でもよい）／
 *        各キーが SVCS[].id に存在／各値が url・env・updated の 3 キーちょうど（url は https:// 始まり、
 *        env は 'cloud-master' のみ、updated は YYYY-MM-DD）／各キーの管理番号に対応する dify/apps/<番号>-*.yml が実在／
 *        url のホストが udify.app のみ／url に重複が無いこと。dify/apps/ にあるが LIVE に無い管理番号は warn。
 *        dify/state/cloud-master.yml との鮮度不一致も warn（FAIL にしない）
 *        （設計書 docs/handoff/2026-09-08-live-links.md §6。Issue #124 PR-1。§13 は #121 W2 用に予約済み、
 *        §15 は #121 W4-1 が先に使っているため、この検査は §14 を使う）
 *   15.  （新規）削除系 API 呼び出しの機械検査：scripts/dify/**.py を走査し、"DELETE" を渡す HTTP 呼び出しが
 *        scripts/dify/kb_upload.py の delete_document() だけであること（他ファイルに現れたら FAIL）
 *        （設計書 docs/handoff/2026-09-08-cloud-auth-and-w4.md §4-2・§9-1。Issue #121 W4-1 K8。
 *        設計書は §14 としているが §14 は Issue #124 が先に取ったため §15 を使う。§13 は #121 W2 用に予約済み）
 *   16.  （新規）デモ資材（dify/samples/**）の契約：dify/samples/ が無ければ節ごと skip。
 *        16-a ディレクトリ名が ^[A-Z]{2}-\d{2}$ で SVCS に実在する管理番号（FAIL）／
 *        16-b ファイル名が ^<管理番号>-S\d{2}-[a-z0-9-]+\.md$ で S 番号がディレクトリ内で重複しない（FAIL）／
 *        16-c フロントマター必須キー id/app/type/lang/industry/mode/world/points と値域（FAIL）／
 *        16-d mode: chat は query のみ・mode: workflow は inputs のみを持ち、@body（本文を差す指示子）は
 *        高々 1 つで、あるとき本文が空でない（FAIL）／
 *        16-e dify/apps/<番号>-*.yml が実在するとき mode と inputs キー集合が dify/tests/<番号>.json と
 *        完全一致（FAIL）／16-f 実在しないとき「実機 DSL 未実装（W4 で投入予定）」（warn）／
 *        16-g world: のパスが data/world/ に実在（FAIL）／16-h 生 URL が無い（FAIL）／
 *        16-i dify/apps/ にある管理番号に dify/samples/<番号>/ が無い、または 3 件未満（warn）
 *        （設計書 docs/handoff/2026-09-09-demo-assets.md §D5。Issue #205 PR-1。
 *        §13 は #121 W2 用に予約済み・§14 は Issue #124・§15 は Issue #121 W4-1 が先に使っているため §16 を使う）
 *   17.  （新規）部門ポータル（mock/portal.html）の契約。mock/portal.html が無ければ節ごと skip（§16 と同じ作法）。
 *        17-a <script src> の順・本数が実ディレクトリから計算した期待値と一致（data/ui・data/catalog・data/style
 *        ＋ scenarios の実ファイル数 ＋ js/data/portal/** ＋ js/portal/**）・すべて実在・すべて相対パス／
 *        17-b インライン <script> 0 個・<style> 0 個、<link> は css/tokens.css → css/portal.css の 2 本、
 *        トークン定義（--ntt-* の定義行）のコピーが無い／
 *        17-c（PR-2）SVCS[].place の値域が PSCREENS の画面 id ／ '*' ／ 'out' のいずれか（値域外は FAIL）。
 *        キー自体が無いもの（未配置）は warn／
 *        17-d mock/css/portal.css に色の直値（#RGB/#RRGGBB）が無く、var(--x) がすべて tokens.css で定義済み／
 *        17-e PT が ja/zh/en を全部持ち空でなく en にかな残りなし。js/data/portal/** に現れる
 *        `{ja:…}` 形のオブジェクトはすべて同じ検査（PSVC[].short を含む）／
 *        17-f js/portal/*.js に現れる mock.* のリテラルが mock.lang / mock.theme の部分集合／
 *        17-g（PR-2）PSVC / PSTAGE_AI / PSCREENS[].newai の管理番号が SVCS（または PNEW）に存在し、
 *        POUT のキーが SVCS[].place === 'out' の管理番号と過不足なく一致する／
 *        17-h portal.html に class="mockbar"・id="langSel"・id="themeBtn" がある／
 *        17-i PSVC が st / name / cat を持たない／
 *        17-j portal.html・portal.css・js/portal/**・js/data/portal/** に生 URL（http(s)://）が無い／
 *        17-k（PR-3）PWORLD のキーが PDEALS[].cu と過不足なく一致し、値が INDUSTRIES の id のいずれか。
 *        data/world/it/clients.csv の ref_world と矛盾しない／
 *        17-l（PR-3）js/portal/demo.js に pstate.ind の参照が無い（§14-4 規則 3）。
 *        pscreenAiIds/pcrossAiIds の本体に industries の参照が無い（§14-2 規則 1）
 *        （設計書 docs/handoff/2026-09-11-portal-mock-pages.md §9-2・§14-9）
 *   18.  （新規）portal/（NocoBase。リポジトリ直下の新設ディレクトリ ⑤ポータル）を取り込んだときに壊れうる
 *        4 点だけを見る。portal/ が無ければ節ごと skip（§16・§17 と同じ作法）：
 *        18-a .github/workflows/portal-verify.yml が実在し paths: に portal/** を含む／
 *        18-b ルート package.json に dependencies が無く、scripts.test が
 *        "node tools/verify.mjs && node tools/regress.mjs" のまま／
 *        18-c portal/package.json が実在し、ルートの package.json を参照していない（S-2）／
 *        18-d pages.yml の path: が mock のまま（既存の §8 と同じ検査）＋ mock/** の中に
 *        先頭が "portal/" の相対リンクが無いこと（Pages に出ない範囲＝リポジトリ直下の portal/ を
 *        参照しない。mock/portal.html・js/portal/**・js/data/portal/**・css/portal.css は
 *        別物＝①デモの一部なので誤検知しない書き方にする）
 *        （設計書 docs/handoff/2026-09-11-repo-layout-v3.md §5-3・§9 PR-R4）
 *
 * 節番号の採番規則（設計書 docs/handoff/2026-09-11-repo-layout-v3.md §8-4・R-P3。
 * docs/handoff/README.md にも明記）：設計書は節番号を予約しない。実装時に「実装済みの最大 ＋ 1」を
 * 採番する。§13 は永久欠番（Issue #121 W2 用に予約されたまま使われなかった）。個々の節が §12-f／14／15／16
 * のヘッダで「設計書は §X としているが…」と書いている経緯（#124・#121 W4-1 との衝突）は、この採番規則の
 * 具体例であり、各節の記述はそのまま残す（既存 §1〜§17 は無改変）。
 *
 * データの取り出しは tools/lib/load.mjs（node:vm で js/data/** を実行順に評価）を使う。
 * grab()（正規表現抽出）は廃止。
 */
import { readFileSync, existsSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMock, loadPortal } from './lib/load.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MOCK = resolve(ROOT, 'mock');
const HTML = resolve(MOCK, 'catalog.html');
const LANGS = ['ja', 'zh', 'en'];

let fails = 0, warns = 0;
const ok   = (m) => console.log('✅', m);
const fail = (m) => { fails++; console.log('❌', m); };
const warn = (m) => { warns++; console.log('⚠️ ', m); };
const section = (t) => console.log(`\n── ${t} ──`);

if (!existsSync(HTML)) { fail(`not found: ${HTML}`); process.exit(1); }

const mock = loadMock(ROOT);
const { html, indexHtml, cssLinks, scriptSrcs, tokenCss, componentCss, jsSources, dataSources, appSources, data, vmErrors } = mock;
const { T, PATTERNS, TAGS, TEMPLATES, INDUSTRIES, CATS, SVCS, CAT_STYLE, HOME, FEED, LIVE, SCENARIOS } = data;
// 業種の一覧と表示順は mock/js/data/ui.js の INDUSTRIES が正本（設計書
// docs/handoff/2026-09-11-repo-layout-v3.md §8-2 R-I1）。tools/** に業種を
// ハードコードしない＝業種を足すときに tools/** を触らずに済む状態がゴール
const INDUSTRY_ORDER = (INDUSTRIES || []).map(i => i.id);
const industryIds = new Set(INDUSTRY_ORDER);
/* 分類の表示順（業種ごと。§4-3。台本ディレクトリの期待順序にも使う）。
   CATS の宣言順のうち、その業種を industries に含むものだけを残して導出する */
const CAT_ORDER_BY_INDUSTRY = Object.fromEntries(
  INDUSTRY_ORDER.map(ind => [ind, (CATS || [])
    .filter(c => Array.isArray(c.industries) && c.industries.includes(ind))
    .map(c => c.id)])
);

// 全 JS（データ層 + アプリ層）の連結テキスト。§3/4（未定義・未使用キー参照）と §1-A（二重宣言）で使う
const allJsInOrder = [...dataSources, ...appSources];
const allJsText = allJsInOrder.map(f => f.src).join('\n');
// アプリ層（state/data-act/detectLang/localStorage）だけの連結テキスト。§7 で使う
const appText = appSources.map(f => f.src).join('\n');

/* ---------- 1. JS 構文（ファイルごと） ---------- */
section('1. JS 構文（ファイルごと）');
if (vmErrors.length) { for (const e of vmErrors) fail(`js/data/**: ${e}`); }
{
  let bad = 0;
  for (const f of allJsInOrder) {
    const isRealFile = existsSync(resolve(MOCK, f.path));
    const tmp = isRealFile ? resolve(MOCK, f.path) : resolve(ROOT, 'tools/.verify-tmp-inline.js');
    if (!isRealFile) writeFileSync(tmp, f.src);
    try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
    catch (e) { fail(`node --check FAIL: ${f.path}\n` + String(e.stderr || e.message)); bad++; }
    finally { if (!isRealFile && existsSync(tmp)) unlinkSync(tmp); }
  }
  if (!bad && allJsInOrder.length) ok(`node --check PASS（${allJsInOrder.length} ファイル）`);
  if (!allJsInOrder.length) fail('JS ファイルが 1 つも見つからない');
}

/* ---------- 1-A. 二重宣言（全 JS を連結して node --check） ---------- */
section('1-A. 二重宣言（全 JS 連結）');
{
  const tmp = resolve(ROOT, 'tools/.verify-tmp-concat.js');
  writeFileSync(tmp, allJsText);
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); ok('全 JS 連結 node --check PASS（二重宣言なし）'); }
  catch (e) { fail('全 JS 連結 node --check FAIL（二重宣言などの可能性）\n' + String(e.stderr || e.message)); }
  finally { if (existsSync(tmp)) unlinkSync(tmp); }
}

/* ---------- 1-B. 読み込み契約 ---------- */
section('1-B. 読み込み契約');
{
  let bad = 0;
  // ① 実ファイルが存在
  for (const src of scriptSrcs) {
    if (!existsSync(resolve(MOCK, src))) { fail(`<script src="${src}">: 実ファイルが無い`); bad++; }
  }
  // ② パスが相対（先頭 / も ../ も禁止）
  for (const src of scriptSrcs) {
    if (src.startsWith('/') || src.includes('../')) { fail(`<script src="${src}">: 相対パスでない`); bad++; }
  }
  if (!bad) ok(`<script src> ${scriptSrcs.length} 本すべて実ファイル・相対パス`);

  // ③ js/data/scenarios/<業種>/ のタグ集合＝ディレクトリの *.js 集合（業種ごと）。
  //    scenarios/ 直下に .js が残っていたら移動漏れとして FAIL（設計書 §4-6）
  const scenDir = resolve(MOCK, 'js/data/scenarios');
  let scenarioIndustryDirs = [];
  if (!existsSync(scenDir)) { fail('mock/js/data/scenarios/ が無い'); bad++; }
  else {
    const entries = readdirSync(scenDir, { withFileTypes: true });
    const looseFiles = entries.filter(e => e.isFile() && e.name.endsWith('.js')).map(e => e.name);
    if (looseFiles.length) { fail(`scenarios/ 直下に .js が残っている（<業種>/ への移動漏れ）: ${looseFiles.join(', ')}`); bad++; }
    scenarioIndustryDirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
    let scenBad = 0;
    for (const indId of scenarioIndustryDirs) {
      const dirFiles = new Set(readdirSync(resolve(scenDir, indId)).filter(f => f.endsWith('.js')));
      const taggedFiles = new Set(scriptSrcs.filter(s => s.startsWith(`js/data/scenarios/${indId}/`)).map(s => basename(s)));
      const missingFromTags = [...dirFiles].filter(f => !taggedFiles.has(f));
      const missingFromDir = [...taggedFiles].filter(f => !dirFiles.has(f));
      if (missingFromTags.length) { fail(`scenarios/${indId}/ にあるが <script src> に無い: ${missingFromTags.join(', ')}`); scenBad++; }
      if (missingFromDir.length) { fail(`<script src> にあるが scenarios/${indId}/ に無い: ${missingFromDir.join(', ')}`); scenBad++; }
    }
    bad += scenBad;
    if (!scenBad && !looseFiles.length) {
      const total = scenarioIndustryDirs.reduce((n, d) => n + readdirSync(resolve(scenDir, d)).filter(f => f.endsWith('.js')).length, 0);
      ok(`scenarios/<業種>/ の *.js 合計 ${total} 個（業種 ${scenarioIndustryDirs.join(', ')}） ＝ <script src> のタグ集合`);
    }
  }

  // ④ 読み込み順が data/ui → data/catalog → data/home → data/style → data/live → data/scenarios/mfg/* → data/scenarios/fin/* → app → render → events
  //    （設計書 2026-09-08-finance-catalog.md §4-3／2026-09-08-live-links.md §3-1。業種ディレクトリは実ディレクトリから、
  //    ファイル順は CAT_ORDER_BY_INDUSTRY から計算する）
  const presentIndustries = INDUSTRY_ORDER.filter(i => scenarioIndustryDirs.includes(i));
  const scenarioExpectedTags = presentIndustries.flatMap(indId => {
    const dirFiles = new Set(readdirSync(resolve(scenDir, indId)).filter(f => f.endsWith('.js')));
    const ordered = (CAT_ORDER_BY_INDUSTRY[indId] || []).filter(code => dirFiles.has(`${code}.js`));
    const extra = [...dirFiles].filter(f => !ordered.includes(basename(f, '.js'))).sort();
    return [...ordered, ...extra.map(f => basename(f, '.js'))].map(code => `js/data/scenarios/${indId}/${code}.js`);
  });
  const expectedOrder = [
    'js/data/ui.js', 'js/data/catalog.js', 'js/data/home.js', 'js/data/style.js', 'js/data/live.js',
    ...scenarioExpectedTags,
    'js/app.js', 'js/render.js', 'js/events.js'
  ];
  if (JSON.stringify(scriptSrcs) !== JSON.stringify(expectedOrder)) {
    fail(`<script src> の順序が設計書 §4-3 と異なる:\n   期待: ${expectedOrder.join(' → ')}\n   実際: ${scriptSrcs.join(' → ')}`);
    bad++;
  } else ok('<script src> の順序が設計書 §4-3 と一致（data/ui → … → data/live → data/scenarios/<業種>/* → app → render → events）');

  // ⑤ <script> タグすべてが src 付き（インライン <script> が 0 個）。本数は実ディレクトリから計算
  //    （5 = data/ui+catalog+home+style+live／業種ごとの台本ファイル数／3 = app+render+events）
  const scriptTagCount = [...html.matchAll(/<script\b/g)].length;
  const expectedCount = 5 + scenarioExpectedTags.length + 3;
  if (scriptTagCount !== scriptSrcs.length) {
    fail(`catalog.html の <script> タグ ${scriptTagCount} 個のうち src 無しが ${scriptTagCount - scriptSrcs.length} 個ある（インライン <script> は禁止）`);
    bad++;
  } else if (scriptSrcs.length !== expectedCount) {
    fail(`<script src> が ${scriptSrcs.length} 本（期待 ${expectedCount} 本 = data 5 + scenarios ${scenarioExpectedTags.length} + app/render/events 3）`);
    bad++;
  } else ok(`<script src> ${expectedCount} 本すべてに src があり、インライン <script> は 0 個`);

  // ⑥ catalog.html に <style> ブロックが 0 個（PR-A の帰結。PR-B/PR-C でも維持を再確認）
  const styleCount = [...html.matchAll(/<style>/g)].length;
  if (styleCount !== 0) { fail(`catalog.html に <style> ブロックが ${styleCount} 個残っている`); bad++; }

  // js/data/** に document・localStorage・関数呼び出し（純粋なリテラル以外）が無いこと
  for (const f of dataSources) {
    const body = f.src;
    if (/\bdocument\./.test(body)) { fail(`${f.path}: document 参照がある（純粋なリテラルのみの制約に違反）`); bad++; }
    if (/\blocalStorage\b/.test(body)) { fail(`${f.path}: localStorage 参照がある（純粋なリテラルのみの制約に違反）`); bad++; }
  }
  if (!bad) ok('js/data/** は純粋なリテラル宣言のみ（document / localStorage なし）');
}

/* ---------- 2. i18n キー集合 ---------- */
section('2. i18n キー集合（ja / zh / en）');
const kana = /[぀-ヿ]/;
let i18nBad = 0;
const checkML = (obj, label) => {
  for (const l of LANGS) {
    if (!obj || typeof obj[l] !== 'string' || !obj[l].trim()) { fail(`${label}: ${l} が欠落/空`); i18nBad++; }
  }
  if (obj && obj.en && kana.test(obj.en)) { fail(`${label}: en にかなが残っている → "${obj.en}"`); i18nBad++; }
};
if (T) for (const k in T) checkML(T[k], `T.${k}`);
if (TAGS) for (const k in TAGS) checkML(TAGS[k], `TAGS.${k}`);
if (PATTERNS) for (const p of PATTERNS) { checkML(p.name, `PATTERNS.${p.id}.name`); checkML(p.desc, `PATTERNS.${p.id}.desc`); }
if (INDUSTRIES) for (const i of INDUSTRIES) {
  checkML(i.name, `INDUSTRIES.${i.id}.name`); checkML(i.desc, `INDUSTRIES.${i.id}.desc`);
  checkML(i.wordmark, `INDUSTRIES.${i.id}.wordmark`); checkML(i.dept, `INDUSTRIES.${i.id}.dept`);
}
if (CATS) for (const c of CATS) {
  checkML(c.name, `CATS.${c.id}.name`); checkML(c.abbr, `CATS.${c.id}.abbr`);
  for (const s of c.subs) checkML(s.name, `CATS.${c.id}.subs.${s.id}.name`);
}
if (SVCS) for (const s of SVCS) { checkML(s.name, `SVCS.${s.id}.name`); checkML(s.desc, `SVCS.${s.id}.desc`); }
if (TEMPLATES) for (const k in TEMPLATES) { checkML(TEMPLATES[k].name, `TEMPLATES.${k}.name`); checkML(TEMPLATES[k].desc, `TEMPLATES.${k}.desc`); }
if (SCENARIOS) for (const indId in SCENARIOS) for (const id in SCENARIOS[indId]) {
  const scn = SCENARIOS[indId][id];
  checkML(scn.persona.name, `SCENARIOS.${indId}.${id}.persona.name`);
  checkML(scn.persona.role, `SCENARIOS.${indId}.${id}.persona.role`);
  checkML(scn.persona.site, `SCENARIOS.${indId}.${id}.persona.site`);
  for (const l of LANGS) {
    if (!Array.isArray(scn.steps[l]) || !scn.steps[l].length) { fail(`SCENARIOS.${indId}.${id}.steps.${l}: 欠落/空`); i18nBad++; }
  }
}
if (i18nBad === 0 && T && TAGS && PATTERNS && INDUSTRIES && CATS && SVCS && TEMPLATES && SCENARIOS)
  ok(`全辞書 3 言語一致（T=${Object.keys(T).length} TAGS=${Object.keys(TAGS).length} PATTERNS=${PATTERNS.length} INDUSTRIES=${INDUSTRIES.length} CATS=${CATS.length} SVCS=${SVCS.length} TEMPLATES=${Object.keys(TEMPLATES).length}）`);

/* ---------- 3. 未定義キー / 4. 未使用キー ---------- */
section('3. 未定義キー参照 / 4. 未使用キー');
if (T) {
  const refs = new Set();
  for (const m of allJsText.matchAll(/\bt\(\s*'([A-Za-z0-9_]+)'\s*\)/g)) refs.add(m[1]);
  for (const m of allJsText.matchAll(/\bT\.([A-Za-z0-9_]+)\b/g)) refs.add(m[1]);
  const undef = [...refs].filter(k => !(k in T));
  if (undef.length) fail(`未定義キー参照: ${undef.join(', ')}`); else ok(`未定義キー参照なし（参照 ${refs.size} 件）`);
  const unused = Object.keys(T).filter(k => !refs.has(k));
  if (unused.length) warn(`未使用キー: ${unused.join(', ')}`); else ok('未使用キーなし');
}

/* ---------- 5. CSS トークン ---------- */
section('5. CSS トークン');
{
  const TOKENS_CSS = resolve(MOCK, 'css/tokens.css');
  const COMPONENTS_CSS = resolve(MOCK, 'css/components.css');
  if (!existsSync(TOKENS_CSS)) fail(`not found: ${TOKENS_CSS}`);
  if (!existsSync(COMPONENTS_CSS)) fail(`not found: ${COMPONENTS_CSS}`);

  const defined = new Set([...tokenCss.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(m => m[1]));
  const used = new Set([...(tokenCss + componentCss).matchAll(/var\((--[a-z0-9-]+)/gi)].map(m => m[1]));
  const undef = [...used].filter(v => !defined.has(v));
  if (undef.length) fail(`未定義の CSS 変数: ${undef.join(', ')}`); else ok(`var() 参照 ${used.size} 件すべて定義済み`);

  const darkBlock = tokenCss.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\}/);
  if (!darkBlock) fail(':root[data-theme="dark"] ブロックがない');
  else {
    const brandOverridden = [...darkBlock[1].matchAll(/(--ntt-[a-z0-9-]+)\s*:/g)].map(m => m[1]);
    if (brandOverridden.length) fail(`dark でブランドパレットを上書きしている: ${brandOverridden.join(', ')}`);
    else ok('dark ブロックあり・--ntt-* は不変');
  }

  // コンポーネント CSS の色直値（コメント除去後）
  const stripped = componentCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const hex = [...stripped.matchAll(/#[0-9a-f]{3,8}\b/gi)].map(m => m[0]);
  if (hex.length) fail(`コンポーネント CSS に色の直値: ${[...new Set(hex)].join(', ')}`); else ok('コンポーネント CSS に色の直値なし');

  for (const l of LANGS) {
    if (!new RegExp(`:root\\[data-lang="${l}"\\]`).test(tokenCss)) fail(`data-lang="${l}" のフォント切替が無い`);
  }

  // 5-a. dark ブロックはちょうど 1 つ（複数あると --ntt-* 上書き検査が素通りする）
  const darkCount = [...tokenCss.matchAll(/:root\[data-theme="dark"\]\s*\{/g)].length;
  if (darkCount !== 1) fail(`:root[data-theme="dark"] ブロックが ${darkCount} 個ある（1 個にする）`);
  else ok('dark ブロックは 1 つ');

  // 5-b. 分類アクセント --cat-<id> / --cat-<id>-bg は light と dark の両方に必要（§2-2 / §2-7）
  const lightRoot = (tokenCss.match(/:root\s*\{([\s\S]*?)\n\}/) || [, ''])[1];
  const darkRoot  = (tokenCss.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/) || [, ''])[1];
  const catTok = (css) => new Set([...css.matchAll(/(--cat-[a-z]{2}(?:-bg)?)\s*:/g)].map(m => m[1]));
  const lc = catTok(lightRoot), dc = catTok(darkRoot);
  const asym = [...lc].filter(v => !dc.has(v)).concat([...dc].filter(v => !lc.has(v)));
  if (asym.length) fail(`--cat-* が light/dark 非対称: ${asym.sort().join(', ')}`);
  else ok(`--cat-* ${lc.size} 個が light/dark 両方に定義済み`);
  for (const base of [...lc].filter(v => !v.endsWith('-bg'))) {
    if (!lc.has(base + '-bg')) fail(`${base} に対応する ${base}-bg が無い`);
  }
  // 5-c. CATS の分類 id に色トークンが無い場合は warn（顧客版差し替えを FAIL にしない。§2-9）
  if (CATS) for (const c of CATS) {
    if (!lc.has(`--cat-${c.id}`)) warn(`CATS.${c.id}: --cat-${c.id} が未定義（既定色 --cat-accent で描画される）`);
  }

  // 5-d. catalog.html に <style> ブロックが 0 個
  const styleCount = [...html.matchAll(/<style>/g)].length;
  if (styleCount !== 0) fail(`catalog.html に <style> ブロックが ${styleCount} 個残っている（css/*.css に分離すること）`);
  else ok('catalog.html に <style> ブロックなし');

  // 5-e. <link rel="stylesheet"> 2 本が tokens → components の順で実在ファイルを相対パスで指す
  const expectedHrefs = ['css/tokens.css', 'css/components.css'];
  if (cssLinks.join(',') !== expectedHrefs.join(',')) {
    fail(`catalog.html の <link rel="stylesheet"> が想定と異なる: [${cssLinks.join(', ')}]（期待: [${expectedHrefs.join(', ')}]）`);
  } else {
    let linkBad = 0;
    for (const href of cssLinks) {
      if (href.startsWith('/') || href.includes('../')) { fail(`<link href="${href}">: 相対パスでない（先頭 / や ../ を含む）`); linkBad++; }
      if (!existsSync(resolve(MOCK, href))) { fail(`<link href="${href}">: 実ファイルが無い`); linkBad++; }
    }
    if (!linkBad) ok('catalog.html の <link rel="stylesheet"> 2 本（tokens → components）が実在ファイルを相対パスで指している');
  }
}

/* ---------- 5-A. index.html のトークン非コピー ---------- */
section('5-A. index.html のトークン非コピー');
{
  const INDEX_HTML = resolve(MOCK, 'index.html');
  if (!existsSync(INDEX_HTML)) fail(`not found: ${INDEX_HTML}`);
  else {
    if (!/<link\s+rel="stylesheet"\s+href="css\/tokens\.css">/.test(indexHtml)) {
      fail('index.html に <link rel="stylesheet" href="css/tokens.css"> が無い');
    } else ok('index.html が css/tokens.css を <link> している');
    if (/--ntt-[a-z0-9-]+\s*:/i.test(indexHtml)) {
      fail('index.html にトークン定義のコピー（--ntt-* の定義行）が残っている');
    } else ok('index.html にトークン定義のコピーなし');
  }
}

/* ---------- 6. データ整合 ---------- */
section('6. データ整合');
if (CATS && SVCS && TAGS) {
  const catIds = new Set(CATS.map(c => c.id));
  const subIds = new Set(CATS.flatMap(c => c.subs.map(s => s.id)));
  const svcIds = new Set();
  let bad = 0;

  // 業種（industries）：CATS / subs / SVCS すべてで必須。値は INDUSTRY_ORDER（mock/js/data/ui.js の
  // INDUSTRIES が正本）の部分列（順序固定）のみ（設計書 2026-09-08-finance-catalog.md §1-2）
  const checkIndustries = (arr, label) => {
    if (!Array.isArray(arr) || !arr.length) { fail(`${label}: industries が無い/空`); bad++; return; }
    for (const v of arr) if (!industryIds.has(v)) { fail(`${label}: industries に未知の業種 "${v}"`); bad++; }
    if (JSON.stringify(arr) !== JSON.stringify(INDUSTRY_ORDER.filter(v => arr.includes(v)))) {
      fail(`${label}: industries の順序が [${INDUSTRY_ORDER}] 固定でない: [${arr}]`); bad++;
    }
  };
  for (const c of CATS) {
    checkIndustries(c.industries, `CATS.${c.id}`);
    for (const s of c.subs) checkIndustries(s.industries, `CATS.${c.id}.subs.${s.id}`);
  }
  for (const s of SVCS) checkIndustries(s.industries, `SVCS.${s.id}`);

  for (const s of SVCS) {
    if (svcIds.has(s.id)) { fail(`SVCS id 重複: ${s.id}`); bad++; } svcIds.add(s.id);
    if (!catIds.has(s.cat)) { fail(`SVCS.${s.id}: cat "${s.cat}" が CATS に無い`); bad++; }
    if (!subIds.has(s.sub)) { fail(`SVCS.${s.id}: sub "${s.sub}" が CATS に無い`); bad++; }
    if (![1, 2, 3].includes(s.st)) { fail(`SVCS.${s.id}: st=${s.st} は 1/2/3 以外`); bad++; }
    // added（任意）：あるなら YYYY-MM-DD で、実在する日付であること（NEW 表示の入力）
    if ('added' in s) {
      if (typeof s.added !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.added)) {
        fail(`SVCS.${s.id}: added "${s.added}" が YYYY-MM-DD 形式でない`); bad++;
      } else if (Number.isNaN(Date.parse(s.added + 'T00:00:00Z'))) {
        fail(`SVCS.${s.id}: added "${s.added}" は実在しない日付`); bad++;
      }
    }
    for (const tg of s.tags) if (!(tg in TAGS)) { fail(`SVCS.${s.id}: tag "${tg}" が TAGS に無い`); bad++; }
    // SVCS.industries ⊆ その cat と sub の industries（設計書 §1-2）
    if (Array.isArray(s.industries)) {
      const c = CATS.find(x => x.id === s.cat), sb = c && c.subs.find(x => x.id === s.sub);
      if (c && !s.industries.every(v => c.industries.includes(v))) {
        fail(`SVCS.${s.id}: industries [${s.industries}] が cat "${s.cat}" の industries [${c.industries}] の部分集合でない`); bad++;
      }
      if (sb && !s.industries.every(v => sb.industries.includes(v))) {
        fail(`SVCS.${s.id}: industries [${s.industries}] が sub "${s.sub}" の industries [${sb.industries}] の部分集合でない`); bad++;
      }
    }
  }

  // 各業種で、サービス 0 件の分類・中分類が無いこと（設計書 §1-2）
  for (const indId of industryIds) {
    for (const c of CATS.filter(c => c.industries.includes(indId))) {
      if (!SVCS.some(s => s.cat === c.id && s.industries.includes(indId))) {
        fail(`CATS.${c.id}: 業種 "${indId}" で見えるサービスが 0 件（分類が空でメニューに出る）`); bad++;
      }
      for (const sb of c.subs.filter(sb => sb.industries.includes(indId))) {
        if (!SVCS.some(s => s.sub === sb.id && s.industries.includes(indId))) {
          fail(`CATS.${c.id}.subs.${sb.id}: 業種 "${indId}" で見えるサービスが 0 件`); bad++;
        }
      }
    }
  }

  const usedTags = new Set(SVCS.flatMap(s => s.tags));
  const unusedTags = Object.keys(TAGS).filter(k => !usedTags.has(k));
  if (unusedTags.length) warn(`未使用タグ: ${unusedTags.join(', ')}`);
  if (!bad) ok(`SVCS ${SVCS.length} 件の cat/sub/st/tags/industries 整合 OK`);

  // 管理番号（§7B）
  const codeSeen = new Map();
  for (const s of SVCS) {
    if (!/^[a-z]{2}\d+$/.test(s.id)) { fail(`SVCS.${s.id}: id が /^[a-z]{2}\\d+$/ に一致しない（管理番号を作れない）`); bad++; }
    const code = s.id.replace(/^([a-z]+)(\d+)$/, (_, a, b) => a.toUpperCase() + '-' + String(b).padStart(2, '0'));
    if (codeSeen.has(code)) { fail(`管理番号の重複: ${code}（${codeSeen.get(code)} と ${s.id}）`); bad++; }
    codeSeen.set(code, s.id);
  }
  if (!bad) ok(`管理番号 ${codeSeen.size} 件の重複なし OK`);
}

/* ---------- 7. 共通レイヤー契約 ---------- */
section('7. 共通レイヤー契約');
{
  const stateM = appText.match(/const state = \{([\s\S]*?)\};/);
  const required = ['industry', 'pattern', 'lang', 'theme', 'openCats', 'selCat', 'selSub', 'lastCat', 'selSvc', 'view', 'query', 'fav', 'favOnly'];
  if (!stateM) fail('const state = {…} が見つからない');
  else {
    const keys = new Set([...stateM[1].matchAll(/^\s*([a-zA-Z]+)\s*:/gm)].map(m => m[1]));
    const missing = required.filter(k => !keys.has(k));
    if (missing.length) fail(`state に必須キーが無い: ${missing.join(', ')}`); else ok(`state 必須キー ${required.length} 件 OK`);
  }
  const acts = new Set([...appText.matchAll(/act === '([a-z]+)'/g)].map(m => m[1]));
  const requiredActs = ['industry', 'pattern', 'all', 'cat', 'sub', 'svc', 'back', 'backdetail', 'start', 'send', 'run', 'chip', 'restart', 'gocat', 'fav', 'favlist'];
  const missingActs = requiredActs.filter(a => !acts.has(a));
  if (missingActs.length) fail(`data-act ハンドラが無い: ${missingActs.join(', ')}`); else ok(`data-act ${requiredActs.length} 種 OK`);

  if (!/function detectLang\(/.test(appText)) fail('detectLang() が無い（§2-5）'); else ok('detectLang() あり');
  const demoDate = appText.match(/const DEMO_DATE = ([^;]+);/);
  if (!demoDate) fail('DEMO_DATE が無い（NEW 表示の基準日）');
  else if (demoDate[1].trim() !== 'null') warn(`DEMO_DATE が ${demoDate[1].trim()} に固定されている（デモ後は null に戻す）`);
  else ok('DEMO_DATE = null（実際の今日で判定）');
  // localStorage キーの許可集合は mock.lang / mock.theme / mock.fav の 3 つだけ（設計書 2026-09-08-favorites.md §2-1・§7-1）。
  // 3 キーすべてが存在すること、かつアプリ層に現れる 'mock.…' リテラルがこの 3 つの部分集合であること（4 つ目を機械的に止める）
  const ALLOWED_MOCK_KEYS = ['mock.lang', 'mock.theme', 'mock.fav'];
  const missingMockKeys = ALLOWED_MOCK_KEYS.filter(k => !appText.includes(`'${k}'`));
  if (missingMockKeys.length) fail(`localStorage キーが見当たらない: ${missingMockKeys.join(', ')}（§2-6）`);
  const mockKeyLiterals = new Set([...appText.matchAll(/'(mock\.[a-zA-Z]+)'/g)].map(m => m[1]));
  const extraMockKeys = [...mockKeyLiterals].filter(k => !ALLOWED_MOCK_KEYS.includes(k));
  if (extraMockKeys.length) fail(`localStorage キーが許可集合の外にある: ${extraMockKeys.join(', ')}（許可は ${ALLOWED_MOCK_KEYS.join(' / ')} の 3 つだけ。§2-6）`);
  if (!missingMockKeys.length && !extraMockKeys.length) ok(`localStorage キー ${ALLOWED_MOCK_KEYS.join(' / ')} の 3 つだけ OK`);
  if (!/class="mockbar"/.test(html)) fail('.mockbar（レビュー用足場）が無い（§2-4）');
  if (!/id="lang-select"/.test(html) || !/id="theme-btn"/.test(html)) fail('ヘッダーの言語/テーマ切替が無い（§2-4）');
  if (/class="mockbar"/.test(html) && /id="lang-select"/.test(html)) ok('足場（.mockbar）とプロダクト機能（言語/テーマ）が両方存在');
}

/* ---------- 8. Pages 設定 ---------- */
section('8. Pages 設定');
{
  const wf = resolve(ROOT, '.github/workflows/pages.yml');
  if (!existsSync(wf)) fail('pages.yml が無い');
  else if (!/path:\s*mock\b/.test(readFileSync(wf, 'utf8'))) fail('pages.yml の upload path が mock ではない（§2-8）');
  else ok('pages.yml: path: mock');
  if (!existsSync(resolve(MOCK, '.nojekyll'))) fail('mock/.nojekyll が無い'); else ok('mock/.nojekyll あり');

  // mock/ 配下（サブディレクトリ含む）に _ 始まりのディレクトリが無いこと
  const underscoreDirs = [];
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.name.startsWith('_')) underscoreDirs.push(childRel);
      walk(resolve(dir, entry.name), childRel);
    }
  };
  walk(MOCK, '');
  if (underscoreDirs.length) fail(`mock/ 配下に _ 始まりのディレクトリ: ${underscoreDirs.join(', ')}`);
  else ok('mock/ 配下に _ 始まりのディレクトリなし');
}

/* ---------- 9. シナリオ整合（SCENARIOS ⇔ SVCS ⇔ TEMPLATES。業種ごと） ---------- */
section('9. シナリオ整合');
if (SCENARIOS && SVCS && TEMPLATES) {
  const tplKeys = new Set(Object.keys(TEMPLATES));
  let bad = 0;
  let scenarioCount = 0;
  for (const indId in SCENARIOS) {
    // その業種で見える SVCS の id 集合（§1-4：SCENARIOS[industry][id] は同じ業種で見えるサービスであること）
    const svcIdsInInd = new Set(SVCS.filter(s => s.industries.includes(indId)).map(s => s.id));
    for (const id in SCENARIOS[indId]) {
      scenarioCount++;
      const label = `SCENARIOS.${indId}.${id}`;
      if (!svcIdsInInd.has(id)) { fail(`${label}: 業種 "${indId}" で見える SVCS に存在しない id`); bad++; continue; }
      const scn = SCENARIOS[indId][id];

      if (!tplKeys.has(scn.template)) { fail(`${label}: template "${scn.template}" が TEMPLATES に無い`); bad++; }

      if (!['ja', 'zh'].includes(scn.persona && scn.persona.native)) { fail(`${label}.persona.native: "${scn.persona && scn.persona.native}" は ja/zh 以外`); bad++; }

      const stepLens = LANGS.map(l => (scn.steps && Array.isArray(scn.steps[l])) ? scn.steps[l].length : -1);
      if (new Set(stepLens).size !== 1 || stepLens[0] < 3 || stepLens[0] > 6) { fail(`${label}.steps: 3 言語の長さ不一致 or 3〜6 の範囲外（${stepLens.join('/')}）`); bad++; }

      const ja = scn.script && scn.script.ja, zh = scn.script && scn.script.zh;
      if (!Array.isArray(ja) || !Array.isArray(zh) || ja.length !== zh.length || ja.length < 2 || ja.length > 4) {
        fail(`${label}.script: ja/zh の長さ不一致 or 2〜4 の範囲外`); bad++;
      } else {
        for (const [lbl, arr] of [['ja', ja], ['zh', zh]]) {
          for (let i = 0; i < arr.length; i++) {
            const turn = arr[i];
            if (typeof turn.q !== 'string' || !turn.q.trim() || typeof turn.a !== 'string' || !turn.a.trim()) {
              fail(`${label}.script.${lbl}[${i}]: q/a が非空文字列でない`); bad++;
            }
            if (turn.q && turn.q.includes("'")) { fail(`${label}.script.${lbl}[${i}].q: '（U+0027）を含む`); bad++; }
            if (turn.a && turn.a.includes("'")) { fail(`${label}.script.${lbl}[${i}].a: '（U+0027）を含む`); bad++; }
          }
        }
      }

      if (scn.template !== 'qa') {
        if (!scn.input || !scn.input.ja || !scn.input.zh) { fail(`${label}.input: ja/zh が無い（template=${scn.template}）`); bad++; }
        if (!scn.result || !scn.result.ja || !scn.result.zh) { fail(`${label}.result: ja/zh が無い（template=${scn.template}）`); bad++; }
        else {
          for (const l of ['ja', 'zh']) {
            const r = scn.result[l];
            const hasItems = Array.isArray(r.items), hasTable = Array.isArray(r.columns) && Array.isArray(r.rows);
            if (hasItems === hasTable) { fail(`${label}.result.${l}: items か columns+rows のどちらか一方が必要`); bad++; }
            if (hasTable && r.rows.some(row => row.length !== r.columns.length)) { fail(`${label}.result.${l}: rows の列数が columns と不一致`); bad++; }
          }
        }
        if (scn.input) {
          for (const l of ['ja', 'zh']) {
            const inp = scn.input[l]; if (!inp) continue;
            if (scn.template === 'upload' && !Array.isArray(inp.files)) { fail(`${label}.input.${l}.files: 配列が必要（upload）`); bad++; }
            if (scn.template === 'form' && !Array.isArray(inp.fields)) { fail(`${label}.input.${l}.fields: 配列が必要（form）`); bad++; }
            if (scn.template === 'diff' && !(typeof inp.left === 'string' && typeof inp.right === 'string')) { fail(`${label}.input.${l}: left/right が必要（diff）`); bad++; }
            if (scn.template === 'lookup' && typeof inp.query !== 'string') { fail(`${label}.input.${l}.query: 文字列が必要（lookup）`); bad++; }
          }
        }
      }
    }
  }
  // 台本の無い SVCS は業種ごとに warn（FAIL にしない。§1-4）
  for (const indId in SCENARIOS) {
    const noScript = SVCS.filter(s => s.industries.includes(indId) && !(SCENARIOS[indId] || {})[s.id]).map(s => s.id);
    if (noScript.length) warn(`業種 "${indId}" で台本の無い SVCS ${noScript.length} 件: ${noScript.join(', ')}`);
  }
  if (!bad) ok(`SCENARIOS ${scenarioCount} 件（業種 ${Object.keys(SCENARIOS).join(', ')}）の整合 OK`);

  // 9-A: 各シナリオ id の接頭＝配置先ファイル名（js/data/scenarios/<業種>/<接頭>.js）。
  //      dirname が業種 id・basename が分類コードであること（設計書 §4-6）
  let prefixBad = 0;
  for (const f of dataSources) {
    if (!f.path.startsWith('js/data/scenarios/')) continue;
    const parts = f.path.split('/'); // js, data, scenarios, <ind>, <code>.js
    const dirInd = parts[3];
    const expectedPrefix = basename(f.path, '.js');
    if (!industryIds.has(dirInd)) { fail(`${f.path}: 配置ディレクトリ "${dirInd}" が業種 id でない`); prefixBad++; }
    for (const m of f.src.matchAll(/^\s*([a-z]+)\d+:\s*\{/gm)) {
      if (m[1] !== expectedPrefix) { fail(`${f.path}: id 接頭 "${m[1]}" がファイル名 "${expectedPrefix}" と不一致`); prefixBad++; }
    }
  }
  if (!prefixBad) ok('シナリオの配置先が dirname=業種・basename=分類コードで一致');
} else {
  fail('SCENARIOS / SVCS / TEMPLATES のいずれかが取得できない');
}

/* ---------- 10. ホームデータ整合（HOME / FEED。業種キー。§1-5） ---------- */
section('10. ホームデータ整合（HOME / FEED）');
{
  let bad = 0;
  // HOME/FEED は「その業種のサービスが 1 件以上あるとき」だけ必須にする。
  // まだサービス 0 件の業種（PR-1 時点の fin）にダッシュボード/フィードのサンプルは要らない
  const readyIndustries = [...industryIds].filter(id => SVCS && SVCS.some(s => s.industries.includes(id)));

  for (const indId of readyIndustries) {
    // 参照 id は「その業種で見える」SVCS / CATS であること（設計書 §1-5）
    const svcIds = SVCS ? new Set(SVCS.filter(s => s.industries.includes(indId)).map(s => s.id)) : new Set();
    const catIds = CATS ? new Set(CATS.filter(c => c.industries.includes(indId)).map(c => c.id)) : new Set();

    const home = HOME && HOME[indId];
    if (!home) { fail(`HOME.${indId} が取得できない`); bad++; }
    else {
      if (!Array.isArray(home.frequent) || home.frequent.length < 1) { fail(`HOME.${indId}.frequent: 1件以上必要`); bad++; }
      else {
        const seen = new Set();
        for (const f of home.frequent) {
          if (!svcIds.has(f.id)) { fail(`HOME.${indId}.frequent.${f.id}: 業種 "${indId}" で見える SVCS に存在しない`); bad++; }
          if (seen.has(f.id)) { fail(`HOME.${indId}.frequent: id 重複 ${f.id}`); bad++; } seen.add(f.id);
          if (!Number.isInteger(f.uses) || f.uses < 1) { fail(`HOME.${indId}.frequent.${f.id}.uses: 1以上の整数が必要`); bad++; }
        }
        const usesDesc = home.frequent.every((f, i) => i === 0 || home.frequent[i - 1].uses >= f.uses);
        if (!usesDesc) warn(`HOME.${indId}.frequent: uses が降順でない`);
      }
      if (!Array.isArray(home.recommended) || home.recommended.length < 1) { fail(`HOME.${indId}.recommended: 1件以上必要`); bad++; }
      else {
        for (const r of home.recommended) {
          if (!svcIds.has(r.id)) { fail(`HOME.${indId}.recommended.${r.id}: 業種 "${indId}" で見える SVCS に存在しない`); bad++; }
          checkML(r.why, `HOME.${indId}.recommended.${r.id}.why`);
        }
      }
    }

    // FEED（③）
    const fd = FEED && FEED[indId];
    if (fd) {
      if (!Array.isArray(fd.mine) || fd.mine.some(id => !catIds.has(id))) { fail(`FEED.${indId}.mine: 業種 "${indId}" で見える CATS に存在しない id を含む`); bad++; }
      if (!Array.isArray(fd.recent)) { fail(`FEED.${indId}.recent: 配列が必要`); bad++; }
      else {
        const seen = new Set();
        for (const id of fd.recent) {
          if (!svcIds.has(id)) { fail(`FEED.${indId}.recent.${id}: 業種 "${indId}" で見える SVCS に存在しない`); bad++; }
          if (seen.has(id)) { fail(`FEED.${indId}.recent: id 重複 ${id}`); bad++; } seen.add(id);
        }
      }
      checkML(fd.persona && fd.persona.name, `FEED.${indId}.persona.name`);
      checkML(fd.persona && fd.persona.role, `FEED.${indId}.persona.role`);
      checkML(fd.persona && fd.persona.site, `FEED.${indId}.persona.site`);
      if (!Array.isArray(fd.items) || fd.items.length < 1) { fail(`FEED.${indId}.items: 1件以上必要`); bad++; }
      else {
        for (const it of fd.items) {
          if (!svcIds.has(it.id)) { fail(`FEED.${indId}.items.${it.id}: 業種 "${indId}" で見える SVCS に存在しない`); bad++; }
          if (!['due', 'notify', 'routine'].includes(it.kind)) { fail(`FEED.${indId}.items.${it.id}.kind: "${it.kind}" は due/notify/routine 以外`); bad++; }
          checkML(it.when, `FEED.${indId}.items.${it.id}.when`);
          checkML(it.note, `FEED.${indId}.items.${it.id}.note`);
        }
      }
    }
  }

  if (!bad) ok('HOME / FEED の整合 OK（業種ごと）');
}

/* ---------- 11. 索引の鮮度（docs/service-map.md）＋ README の 4 区分地図のリンク実在 ---------- */
section('11. 索引の鮮度・README の 5 区分地図');
{
  // 11-a: docs/service-map.md が gen-index の出力と一致するか（設計書 §1-3・§10 Q7＝FAIL）
  const genIndex = resolve(ROOT, 'tools/gen-index.mjs');
  if (!existsSync(genIndex)) {
    fail('tools/gen-index.mjs が無い');
  } else {
    try {
      execFileSync(process.execPath, [genIndex, '--check'], { cwd: ROOT, stdio: 'pipe' });
      ok('docs/service-map.md は最新（gen-index --check）');
    } catch {
      fail('docs/service-map.md が古い、または存在しない。`npm run index` を実行して再生成してください');
    }
  }

  // 11-b: トップ README.md の「4 区分」表（表の行のみ。設計書 §1-4 の表の下 2 行は
  // dify/env/README.md など PR-2 以降で作る想定のファイルへのリンクを含むため対象外）のリンク先が実在すること。
  // 表内のリンクのうち、末尾が `/` の区分カテゴリ（例 `./dify/env/`）はロードマップ上まだ無い場合があるため warn、
  // 具体的な入口ファイル（例 `./mock/index.html`）は fail とする
  const readmePath = resolve(ROOT, 'README.md');
  if (!existsSync(readmePath)) {
    fail('README.md（トップ）が無い');
  } else {
    const readme = readFileSync(readmePath, 'utf8');
    const mapSection = readme.match(/## このリポジトリの歩き方（5 区分）[\s\S]*?(?=\n## |\n---|\s*$)/);
    if (!mapSection) {
      fail('README.md に「## このリポジトリの歩き方（5 区分）」節が無い');
    } else {
      const tableLines = mapSection[0].split('\n').filter(l => l.trim().startsWith('|'));
      const links = [...tableLines.join('\n').matchAll(/\]\(\.\/([^)]+)\)/g)].map(m => m[1]);
      const missingDirs = links.filter(l => l.endsWith('/') && !existsSync(resolve(ROOT, l)));
      const missingFiles = links.filter(l => !l.endsWith('/') && !existsSync(resolve(ROOT, l)));
      if (links.length === 0) fail('README.md の 4 区分節にリンクが 1 つも無い');
      else if (missingFiles.length) fail(`README.md の 4 区分節の入口ファイルへのリンクが実在しない: ${missingFiles.join(', ')}`);
      else {
        if (missingDirs.length) warn(`README.md の 4 区分節のディレクトリリンクで未作成のもの（後続 PR で作る想定）: ${missingDirs.join(', ')}`);
        ok(`README.md の 4 区分節のリンク先 ${links.length - missingDirs.length}/${links.length} 件が実在（残りは後続 PR で作成予定のディレクトリ）`);
      }
    }
  }
}

/* ---------- 12. 環境レイヤー（dify/env/**） ---------- */
section('12. 環境レイヤー（dify/env/** ・ワークフローの環境変数）');
{
  const ENV_ROOT = resolve(ROOT, 'dify/env');
  const REQUIRED_ENVS = ['cloud-master', 'inhouse', 'customer-a'];
  const KNOWN_CLOUD_MASTER_URLS = ['https://api.dify.ai/v1', 'https://cloud.dify.ai'];

  if (!existsSync(ENV_ROOT)) {
    fail('dify/env/ が無い');
  } else {
    const envDirs = readdirSync(ENV_ROOT, { withFileTypes: true })
      .filter(d => d.isDirectory()).map(d => d.name).sort();
    const missing = REQUIRED_ENVS.filter(e => !envDirs.includes(e));
    if (missing.length) fail(`dify/env/ に無い環境: ${missing.join(', ')}`);
    else ok(`dify/env/ に 3 環境が揃っている: ${envDirs.join(', ')}`);

    // 12-a: README
    if (!existsSync(resolve(ENV_ROOT, 'README.md'))) fail('dify/env/README.md が無い');
    else ok('dify/env/README.md あり');

    const REQUIRED_TOP = ['schema', 'name', 'description', 'dify', 'models', 'knowledge', 'brand', 'flags', 'variables', 'apps'];
    const REQUIRED_DIFY = ['base_url', 'console_url', 'edition', 'dsl_version'];
    const REQUIRED_MODELS = ['chat', 'reasoning', 'embedding', 'rerank'];
    const REQUIRED_BRAND = ['company', 'local_entity', 'sites', 'replace'];
    const REQUIRED_FLAGS = ['cross_border', 'partner_mode', 'pipl_mask'];

    // 秘密・実名らしき値の直値検出（12-b）。対象は dify/env/**/env.yml の生テキスト全体
    const SECRET_KEY_RE = /sk-[A-Za-z0-9_-]{6,}/;
    const HEXB64_RE = /\b[0-9a-fA-F]{32,}\b|\b[A-Za-z0-9+]{32,}={0,2}\b/;
    const URL_RE = /https?:\/\/[^\s"'\)]+/g;
    let schemaOk = true, secretsOk = true;

    for (const envName of envDirs) {
      const p = resolve(ENV_ROOT, envName, 'env.yml');
      if (!existsSync(p)) { fail(`${envName}/env.yml が無い`); schemaOk = false; continue; }
      const raw = readFileSync(p, 'utf8');

      // schema / 必須キー（YAML を厳密に解釈せず、行頭キーの存在で確認。verify.mjs は JS のみで完結させるため）
      const hasKey = (re) => re.test(raw);
      if (!/^schema:\s*1\s*$/m.test(raw)) { fail(`${envName}/env.yml の schema が 1 でない`); schemaOk = false; }
      for (const k of REQUIRED_TOP) {
        if (!new RegExp(`^${k}:`, 'm').test(raw)) { fail(`${envName}/env.yml に必須キー ${k} が無い`); schemaOk = false; }
      }
      for (const k of REQUIRED_DIFY) {
        if (!hasKey(new RegExp(`^\\s+${k}:`, 'm'))) { fail(`${envName}/env.yml の dify.${k} が無い`); schemaOk = false; }
      }
      for (const k of REQUIRED_MODELS) {
        if (!hasKey(new RegExp(`^\\s+${k}:`, 'm'))) { fail(`${envName}/env.yml の models.${k} が無い`); schemaOk = false; }
      }
      for (const k of REQUIRED_BRAND) {
        if (!hasKey(new RegExp(`^\\s+${k}:`, 'm'))) { fail(`${envName}/env.yml の brand.${k} が無い`); schemaOk = false; }
      }
      for (const k of REQUIRED_FLAGS) {
        if (!hasKey(new RegExp(`\\b${k}:`, 'm'))) { fail(`${envName}/env.yml の flags.${k} が無い`); schemaOk = false; }
      }
      if (envName !== 'cloud-master' && !new RegExp(`^name:\\s*${envName}\\s*$`, 'm').test(raw)) {
        fail(`${envName}/env.yml の name がディレクトリ名と不一致`);
        schemaOk = false;
      }

      // 秘密・実名の直値
      if (SECRET_KEY_RE.test(raw)) { fail(`${envName}/env.yml に sk- で始まる文字列がある（秘密の直値）`); secretsOk = false; }
      // ${VAR} 由来のトークン自体はハイフンを含み HEXB64_RE に基本ヒットしないが、誤検知を避けるため
      // '${' を含む行は対象から除外する
      const bodyForHex = raw.split('\n').filter(l => !l.includes('${')).join('\n');
      if (HEXB64_RE.test(bodyForHex)) {
        fail(`${envName}/env.yml に 32 文字以上の 16 進／base64 らしき文字列がある（秘密の直値の疑い）`);
        secretsOk = false;
      }
      const urls = [...raw.matchAll(URL_RE)].map(m => m[0].replace(/[,\s]+$/, ''));
      const badUrls = envName === 'cloud-master'
        ? urls.filter(u => !KNOWN_CLOUD_MASTER_URLS.includes(u))
        : urls; // cloud-master 以外は生 URL があってはいけない（${DIFY_BASE_URL} 等で渡す）
      if (badUrls.length) {
        fail(`${envName}/env.yml に想定外の生 URL がある: ${badUrls.join(', ')}`);
        secretsOk = false;
      }
    }
    if (schemaOk) ok('全環境の env.yml が schema: 1 と必須キーを満たす');
    if (secretsOk) ok('dify/env/**/env.yml に秘密・実名の直値なし（sk- / 32+ hex-base64 / 想定外 URL）');

    // 12-e: apps:（Cloud/セルフホストのアプリ id。管理番号は dify/apps/*.yml と 1:1。Issue #114 PR-2）
    const APPS_DIR = resolve(ROOT, 'dify/apps');
    const appCodesOnDisk = existsSync(APPS_DIR)
      ? [...new Set(readdirSync(APPS_DIR).filter(f => f.endsWith('.yml')).map(f => f.split('-').slice(0, 2).join('-')))].sort()
      : [];
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let appsOk = true;
    for (const envName of envDirs) {
      const p = resolve(ENV_ROOT, envName, 'env.yml');
      if (!existsSync(p)) continue; // 既に上で fail 済み
      const raw = readFileSync(p, 'utf8');
      const lines = raw.split('\n');
      const startIdx = lines.findIndex(l => /^apps:\s*$/.test(l));
      if (startIdx === -1) { fail(`${envName}/env.yml に apps: ブロックが無い`); appsOk = false; continue; }

      const entries = {};
      for (let i = startIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (/^\S/.test(line)) break; // 次のトップレベルキーでブロック終端
        if (line.trim() === '' || line.trim().startsWith('#')) continue;
        const m = line.match(/^\s+([A-Za-z0-9_-]+):\s*\{\s*id:\s*(.+?)\s*\}\s*(#.*)?$/);
        if (!m) { fail(`${envName}/env.yml の apps: に解釈できない行がある: ${line.trim()}`); appsOk = false; continue; }
        entries[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
      }

      const codes = Object.keys(entries);
      const badCode = codes.filter(c => !/^[A-Z]{2}-\d{2}$/.test(c));
      if (badCode.length) { fail(`${envName}/env.yml の apps: に管理番号の形式でないキーがある: ${badCode.join(', ')}`); appsOk = false; }

      const missing = appCodesOnDisk.filter(c => !codes.includes(c));
      const extra = codes.filter(c => !appCodesOnDisk.includes(c));
      if (missing.length) { fail(`${envName}/env.yml の apps: に無い管理番号（dify/apps/*.yml にはある）: ${missing.join(', ')}`); appsOk = false; }
      if (extra.length) { fail(`${envName}/env.yml の apps: に dify/apps/*.yml に無い管理番号がある: ${extra.join(', ')}`); appsOk = false; }

      for (const [code, idVal] of Object.entries(entries)) {
        const isNull = idVal === 'null';
        const isVar = /^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/.test(idVal);
        const isUuid = UUID_RE.test(idVal);
        if (!isNull && !isVar && !isUuid) {
          fail(`${envName}/env.yml の apps.${code}.id が null / \${VAR} / UUID のいずれでもない: ${idVal}`);
          appsOk = false;
        }
        if (envName !== 'cloud-master' && isUuid) {
          fail(`${envName}/env.yml の apps.${code}.id に生の UUID が書かれている（顧客環境の値は \${VAR} にする）: ${idVal}`);
          appsOk = false;
        }
      }
    }
    if (appsOk) ok('全環境の env.yml の apps: が dify/apps/*.yml と一致し、id が null/${VAR}/UUID のいずれか（12-e）');
  }

  // 12-c: .gitignore（Secrets / Build）
  const gi = existsSync(resolve(ROOT, '.gitignore')) ? readFileSync(resolve(ROOT, '.gitignore'), 'utf8') : '';
  const giNeeds = ['.env', '.env.*', '*.key', '*.pem', 'secrets/', 'dify/build/'];
  const giMissing = giNeeds.filter(n => !gi.includes(n));
  if (giMissing.length) fail(`.gitignore に無いパターン: ${giMissing.join(', ')}`);
  else ok('.gitignore に Secrets / dify/build/ の除外パターンあり');

  // 12-d: render.py --env cloud-master --all --check（python3 が無ければ warn で skip）
  const renderPy = resolve(ROOT, 'scripts/dify/render.py');
  if (!existsSync(renderPy)) {
    fail('scripts/dify/render.py が無い');
  } else {
    try {
      execFileSync('python3', [renderPy, '--env', 'cloud-master', '--all', '--check'], { cwd: ROOT, stdio: 'pipe' });
      ok('render.py --env cloud-master --all --check が PASS（マスタとバイト一致）');
    } catch (e) {
      if (e && e.code === 'ENOENT') {
        warn('python3 が無いため render.py --check を skip しました');
      } else {
        fail('render.py --env cloud-master --all --check が FAIL（マスタとバイト不一致、または実行エラー）: '
          + String((e && e.stderr && e.stderr.toString()) || e.message || e).split('\n')[0]);
      }
    }
  }

  // 12-f: DIFY_DATASET_ID_ という文字列が .github/workflows/** に無いこと（C1。設計書
  // docs/handoff/2026-09-09-dataset-ids-in-ci.md §5・§4-5。Issue #209 PR-1）。
  // dataset id は実行時に Datasets API から名前で解決し、render.py のサブプロセス専用の env dict にだけ
  // 渡す（scripts/dify/dataset_ids.py・cloud_deploy.py）。ワークフロー側にこの名前の変数を 1 つでも
  // 置くと、render.py --check のバイト一致（§2-12）が壊れる経路が生まれてしまうため、機械で検出する。
  const WORKFLOWS_DIR = resolve(ROOT, '.github/workflows');
  const FORBIDDEN_DATASET_ID_STR = 'DIFY_DATASET_ID_';
  if (!existsSync(WORKFLOWS_DIR)) {
    warn('.github/workflows/ が無いため 12-f（DIFY_DATASET_ID_ の不在検査）を skip しました');
  } else {
    const wfFiles = readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    const hits = wfFiles.filter(f => readFileSync(resolve(WORKFLOWS_DIR, f), 'utf8').includes(FORBIDDEN_DATASET_ID_STR));
    if (hits.length) {
      fail(`.github/workflows/** に "${FORBIDDEN_DATASET_ID_STR}" という文字列がある`
        + `（コメントも含め書かない。dataset id は render.py のプロセス環境にだけ渡す。C1）: ${hits.join(', ')}`);
    } else {
      ok(`.github/workflows/** に "${FORBIDDEN_DATASET_ID_STR}" という文字列が無い（12-f。C1）`);
    }
  }
}

/* ---------- 14. 本番リンク（LIVE）の契約 ---------- */
// 設計書 docs/handoff/2026-09-08-live-links.md §6（Issue #124 PR-1）。
// §13 は #121 W2（dify/state/）用に予約済み、§15 は #121 W4-1 が先に使っているため、この検査は §14 を使う。
// 14-h（LIVE と dify/state/cloud-master.yml の鮮度比較。D6=warn）は tools/gen-live.mjs（PR-4）導入後に実装する。
section('14. 本番リンク（LIVE）の契約');
{
  const LIVE_PATH = resolve(MOCK, 'js/data/live.js');
  if (!existsSync(LIVE_PATH)) {
    fail('mock/js/data/live.js が無い');
  } else if (!LIVE || typeof LIVE !== 'object' || Array.isArray(LIVE)) {
    fail('LIVE がオブジェクトとして読めない（{} でもよい）');
  } else {
    let bad = 0;
    const svcIds = new Set((SVCS || []).map(s => s.id));
    const managementCode = (id) => id.replace(/^([a-z]+)(\d+)$/, (_, a, b) => a.toUpperCase() + '-' + String(b).padStart(2, '0'));
    const seenUrls = new Map();
    const APPS_DIR = resolve(ROOT, 'dify/apps');
    const appFiles = existsSync(APPS_DIR) ? readdirSync(APPS_DIR).filter(f => f.endsWith('.yml')) : [];
    const ALLOWED_HOSTS = ['udify.app'];

    for (const [id, entry] of Object.entries(LIVE)) {
      // 14-b: キーが SVCS[].id に存在
      if (!svcIds.has(id)) { fail(`LIVE.${id}: SVCS に存在しない id`); bad++; continue; }

      // 14-c: url / env / updated の 3 キーちょうど・形式
      const keys = Object.keys(entry || {}).sort();
      const expectedKeys = ['env', 'updated', 'url'];
      if (!entry || typeof entry !== 'object' || JSON.stringify(keys) !== JSON.stringify(expectedKeys)) {
        fail(`LIVE.${id}: url/env/updated の 3 キーちょうどではない（実際: ${keys.join(', ') || '(なし)'}）`);
        bad++;
        continue;
      }
      if (typeof entry.url !== 'string' || !entry.url.startsWith('https://')) {
        fail(`LIVE.${id}: url が https:// で始まる文字列でない: ${entry.url}`); bad++;
      }
      if (entry.env !== 'cloud-master') {
        fail(`LIVE.${id}: env が 'cloud-master' でない: ${entry.env}`); bad++;
      }
      if (typeof entry.updated !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(entry.updated)) {
        fail(`LIVE.${id}: updated が YYYY-MM-DD 形式でない: ${entry.updated}`); bad++;
      }

      // 14-d: dify/apps/<管理番号>-*.yml が実在
      const code = managementCode(id);
      if (!appFiles.some(f => f.startsWith(`${code}-`))) {
        fail(`LIVE.${id}: dify/apps/${code}-*.yml が無い`); bad++;
      }

      // 14-e: ホストが許可集合のみ
      if (typeof entry.url === 'string' && entry.url.startsWith('https://')) {
        let host = null;
        try { host = new URL(entry.url).hostname; } catch { /* noop */ }
        if (!host || !ALLOWED_HOSTS.includes(host)) {
          fail(`LIVE.${id}: url のホストが許可集合 [${ALLOWED_HOSTS.join(', ')}] に無い: ${entry.url}`); bad++;
        }
      }

      // 14-f: url の重複
      if (typeof entry.url === 'string') {
        if (seenUrls.has(entry.url)) { fail(`LIVE.${id}: url が ${seenUrls.get(entry.url)} と重複している: ${entry.url}`); bad++; }
        else seenUrls.set(entry.url, id);
      }
    }

    if (!bad) ok(`LIVE ${Object.keys(LIVE).length} 件すべて id/url/env/updated/DSL の整合 OK`);

    // 14-g: dify/apps/ にあるが LIVE に無い管理番号は warn
    const liveCodes = new Set(Object.keys(LIVE).map(managementCode));
    const appCodesOnDisk = [...new Set(appFiles.map(f => f.split('-').slice(0, 2).join('-')))].sort();
    const unlinked = appCodesOnDisk.filter(c => !liveCodes.has(c));
    if (unlinked.length) warn(`dify/apps/ の DSL ${appCodesOnDisk.length} 本中 ${unlinked.length} 本に LIVE のリンクが無い: ${unlinked.join(', ')}`);
    else if (appCodesOnDisk.length) ok(`dify/apps/ の DSL ${appCodesOnDisk.length} 本すべてに LIVE のリンクあり`);
  }
}

/* ---------- 15. 削除系 API 呼び出しの機械検査（scripts/dify/**.py） ---------- */
// 設計書 docs/handoff/2026-09-08-cloud-auth-and-w4.md §4-2・§9-1（Issue #121 W4-1 K8）は
// この検査を「§14」としているが、§14 は Issue #124（本番リンク）が先に取った（2026-09-08 時点）。
// §13 は #121 W2（dify/state/）用に予約済みのため、削除系検査はここ §15 に置く（設計書は変更しない）。
section('15. 削除系 API 呼び出しの機械検査（scripts/dify/**.py）');
{
  const SCRIPTS_DIFY = resolve(ROOT, 'scripts/dify');
  const ALLOWED_FILE = 'scripts/dify/kb_upload.py';
  const ALLOWED_FUNCS = new Set(['delete_document']);
  // このリポジトリの HTTP 呼び出しの慣用形（console_api.py / kb_upload.py とも）は
  //   <obj>._req("<METHOD>", ...) / urllib.request.Request(..., method="<METHOD>")
  // なので、"DELETE" が実際に HTTP メソッドとして渡されている箇所だけを拾う。
  // dict のキー（STATE["calls"]["DELETE"] 等。mock_server.py / テストのカウンタ）や
  // 文字列比較はここでは対象にしない（false positive を避けるため）。
  // 大文字小文字は区別しない（i フラグ）。"delete" / "Delete" のような書き方でも urllib は
  // メソッド名を大文字化せずそのまま送るため、見逃すと実際に削除が飛ぶ（reviewer 指摘。
  // console_api.py の _MASK_PATTERNS が "bearer" 小文字を見逃していた過去の穴と同種）。
  //
  // 【この検査の限界（正直に書く）】ここで捕まえられるのは、HTTP メソッドを
  // 文字列リテラルで直接渡している呼び出しだけ。`m = "DELETE"; api._req(m, ...)` のように
  // 変数に入れてから渡す形は正規表現では追えず検出できない。この検査は「うっかり」削除系の
  // 呼び出しを増やすことを止めるためのものであり、意図的な回避を防ぐものではない。
  // 削除系 API を新しく使うときは、この検査に通ることではなく、設計書
  // docs/handoff/2026-09-08-cloud-auth-and-w4.md §4-2 の歯止め K1〜K7 を満たすことで担保する。
  const DELETE_LIT_RE = /_req\(\s*(["'])DELETE\1|method\s*=\s*(["'])DELETE\2/i;

  function listPyFiles(dir) {
    let out = [];
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, entry.name);
      if (entry.isDirectory()) out = out.concat(listPyFiles(p));
      else if (entry.name.endsWith('.py')) out.push(p);
    }
    return out;
  }

  let sawAllowed = false;
  const bad = [];
  for (const file of listPyFiles(SCRIPTS_DIFY)) {
    const rel = file.slice(ROOT.length + 1).split('\\').join('/');
    const lines = readFileSync(file, 'utf8').split('\n');
    let currentFunc = null;
    for (let i = 0; i < lines.length; i++) {
      const defm = lines[i].match(/^\s*def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
      if (defm) currentFunc = defm[1];
      if (DELETE_LIT_RE.test(lines[i])) {
        const isAllowed = rel === ALLOWED_FILE && currentFunc && ALLOWED_FUNCS.has(currentFunc);
        if (isAllowed) sawAllowed = true;
        else bad.push(`${rel}:${i + 1}（関数: ${currentFunc || '(トップレベル)'}）`);
      }
    }
  }
  if (bad.length) {
    fail(`削除系 API 呼び出し（"DELETE"）が許可されていない箇所にある（許可は ${ALLOWED_FILE} の ${[...ALLOWED_FUNCS].join('/')} のみ）: ${bad.join(', ')}`);
  } else if (!sawAllowed) {
    fail(`削除系 API 呼び出し（"DELETE"）が 1 件も見つからない。${ALLOWED_FILE} の ${[...ALLOWED_FUNCS].join('/')} が実装されているか確認してください`);
  } else {
    ok(`削除系 API 呼び出し（"DELETE"）は ${ALLOWED_FILE} の ${[...ALLOWED_FUNCS].join('/')} 1 か所のみ`);
  }
}

/* ---------- 16. デモ資材（dify/samples/**）の契約 ---------- */
// 設計書 docs/handoff/2026-09-09-demo-assets.md §D5（Issue #205 PR-1）。
// §13 は #121 W2（dify/state/）用に予約済み、§14 は Issue #124、§15 は Issue #121 W4-1 が
// 先に使っているため、この検査は §16 を使う。
// dify/samples/ が無ければ節ごと skip（PR-1 より前でも npm test が通る）。
// dify/samples/build/ は .gitignore 対象なので走査から除外する。
section('16. デモ資材（dify/samples/**）の契約');
{
  const SAMPLES_ROOT = resolve(ROOT, 'dify/samples');
  if (!existsSync(SAMPLES_ROOT)) {
    ok('dify/samples/ が無いため §16 は skip');
  } else {
    const svcIds = new Set((SVCS || []).map(s => s.id));
    const APPS_DIR = resolve(ROOT, 'dify/apps');
    const TESTS_DIR = resolve(ROOT, 'dify/tests');
    const WORLD_DIR = resolve(ROOT, 'data/world');
    const appFiles = existsSync(APPS_DIR) ? readdirSync(APPS_DIR).filter(f => f.endsWith('.yml')) : [];
    // dify/apps/ にある管理番号一覧（重複除去。§14 と同じ抽出方法）
    const appCodes = [...new Set(appFiles.map(f => f.split('-').slice(0, 2).join('-')))].sort();

    // 管理番号（KN-01）⇄ 内部 id（kn1）の相互変換（CLAUDE.md §2-11）
    const dirToInternalId = (dir) => {
      const m = dir.match(/^([A-Z]{2})-(\d{2})$/);
      if (!m) return null;
      return m[1].toLowerCase() + String(parseInt(m[2], 10));
    };

    // フロントマターの自前パーサ（YAML ライブラリは使わない。設計書 §D5）
    // 対応: `---` で挟まれた `key: value` ／ `key:` + 字下げ `- item` のリスト／
    //       `key:` + 字下げ `subkey: value` の 1 段ネスト
    const stripQuotes = (s) => {
      s = s.trim();
      if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
      return s;
    };
    function parseFrontmatter(raw) {
      const lines = raw.split(/\r?\n/);
      if (!lines[0] || lines[0].trim() !== '---') return null;
      let end = -1;
      for (let i = 1; i < lines.length; i++) { if (lines[i].trim() === '---') { end = i; break; } }
      if (end === -1) return null;
      const fm = {};
      let currentKey = null;
      for (const line of lines.slice(1, end)) {
        if (!line.trim()) continue;
        const top = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
        if (top) {
          currentKey = top[1];
          const val = top[2];
          fm[currentKey] = val === '' ? undefined : stripQuotes(val);
          continue;
        }
        const listItem = line.match(/^\s+-\s?(.*)$/);
        if (listItem && currentKey) {
          if (!Array.isArray(fm[currentKey])) fm[currentKey] = [];
          fm[currentKey].push(stripQuotes(listItem[1]));
          continue;
        }
        const nested = line.match(/^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
        if (nested && currentKey) {
          if (typeof fm[currentKey] !== 'object' || fm[currentKey] === null || Array.isArray(fm[currentKey])) fm[currentKey] = {};
          fm[currentKey][nested[1]] = stripQuotes(nested[2]);
          continue;
        }
      }
      const body = lines.slice(end + 1).join('\n');
      return { frontmatter: fm, body };
    }

    const URL_RE_16 = /https?:\/\//;
    const dirEntries = readdirSync(SAMPLES_ROOT, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== 'build')
      .map(d => d.name)
      .sort();

    let bad16 = 0;
    const dirsWithValidSamples = new Map(); // 管理番号 -> 有効ファイル数（16-i 用）

    for (const dir of dirEntries) {
      // 16-a: ディレクトリ名の形式 と SVCS 実在
      if (!/^[A-Z]{2}-\d{2}$/.test(dir)) {
        fail(`dify/samples/${dir}: ディレクトリ名が ^[A-Z]{2}-\\d{2}$ に一致しない`); bad16++;
        continue;
      }
      const internalId = dirToInternalId(dir);
      if (!svcIds.has(internalId)) {
        fail(`dify/samples/${dir}: SVCS に実在しない管理番号（変換後 id: ${internalId}）`); bad16++;
        continue;
      }

      const dirPath = resolve(SAMPLES_ROOT, dir);
      const files = readdirSync(dirPath, { withFileTypes: true })
        .filter(f => f.isFile() && f.name !== 'README.md')
        .map(f => f.name)
        .sort();

      const seenS = new Set();
      let validCount = 0;

      for (const fname of files) {
        // 16-b: ファイル名の形式・S 番号の重複
        const m = fname.match(new RegExp(`^${dir}-S(\\d{2})-[a-z0-9-]+\\.md$`));
        if (!m) {
          fail(`dify/samples/${dir}/${fname}: ファイル名が ^${dir}-S\\d{2}-[a-z0-9-]+\\.md$ に一致しない`); bad16++;
          continue;
        }
        const sNum = m[1];
        if (seenS.has(sNum)) {
          fail(`dify/samples/${dir}/${fname}: S 番号 ${sNum} がディレクトリ内で重複している`); bad16++;
          continue;
        }
        seenS.add(sNum);

        const filePath = resolve(dirPath, fname);
        const raw = readFileSync(filePath, 'utf8');
        const rel = `dify/samples/${dir}/${fname}`;

        // 16-h: 生 URL が無いこと（本文・フロントマター全体）
        if (URL_RE_16.test(raw)) {
          fail(`${rel}: 生 URL（http:// または https://）が含まれている（CLAUDE.md §2-10）`); bad16++;
        }

        const parsed = parseFrontmatter(raw);
        if (!parsed) {
          fail(`${rel}: フロントマター（先頭の --- ... ---）が見つからない`); bad16++;
          continue;
        }
        const { frontmatter: fm, body } = parsed;

        // 16-c: 必須キーと値域
        const REQUIRED_KEYS = ['id', 'app', 'type', 'lang', 'industry', 'mode', 'world', 'points'];
        const missingKeys = REQUIRED_KEYS.filter(k => fm[k] === undefined || fm[k] === null);
        if (missingKeys.length) {
          fail(`${rel}: フロントマター必須キーが無い: ${missingKeys.join(', ')}`); bad16++;
          continue;
        }
        const expectedId = `${dir} S${sNum}`;
        if (fm.id !== expectedId) { fail(`${rel}: id が "${expectedId}" ではない（実際: "${fm.id}"）`); bad16++; }
        if (fm.app !== dir) { fail(`${rel}: app が ディレクトリ名 "${dir}" と一致しない（実際: "${fm.app}"）`); bad16++; }
        if (!['normal', 'volume', 'edge'].includes(fm.type)) { fail(`${rel}: type "${fm.type}" は normal/volume/edge のいずれでもない`); bad16++; }
        if (!['ja', 'zh'].includes(fm.lang)) { fail(`${rel}: lang "${fm.lang}" は ja/zh のいずれでもない`); bad16++; }
        if (!industryIds.has(fm.industry)) { fail(`${rel}: industry "${fm.industry}" は [${INDUSTRY_ORDER}] のいずれでもない`); bad16++; }
        if (!['chat', 'workflow'].includes(fm.mode)) { fail(`${rel}: mode "${fm.mode}" は chat/workflow のいずれでもない`); bad16++; }
        if (!Array.isArray(fm.points) || fm.points.length < 1) { fail(`${rel}: points が 1 件以上の配列でない`); bad16++; }
        if (!Array.isArray(fm.world) || fm.world.length < 1) { fail(`${rel}: world が 1 件以上の配列でない`); bad16++; }
        else {
          // 16-g: world: のパスが data/world/ に実在
          const missingWorld = fm.world.filter(p => !existsSync(resolve(WORLD_DIR, p)));
          if (missingWorld.length) { fail(`${rel}: world: のパスが data/world/ に無い: ${missingWorld.join(', ')}`); bad16++; }
        }

        // 16-d: mode ごとの query/inputs の排他と @body の個数
        const hasQuery = Object.prototype.hasOwnProperty.call(fm, 'query');
        const hasInputs = Object.prototype.hasOwnProperty.call(fm, 'inputs');
        let bodyRefCount = 0;
        if (fm.mode === 'chat') {
          if (!hasQuery) { fail(`${rel}: mode: chat なのに query が無い`); bad16++; }
          if (hasInputs) { fail(`${rel}: mode: chat なのに inputs を持っている`); bad16++; }
          if (hasQuery && fm.query === '@body') bodyRefCount++;
        } else if (fm.mode === 'workflow') {
          if (!hasInputs || typeof fm.inputs !== 'object' || Array.isArray(fm.inputs)) { fail(`${rel}: mode: workflow なのに inputs が無い`); bad16++; }
          if (hasQuery) { fail(`${rel}: mode: workflow なのに query を持っている`); bad16++; }
          if (hasInputs && fm.inputs && typeof fm.inputs === 'object') {
            bodyRefCount = Object.values(fm.inputs).filter(v => v === '@body').length;
          }
        }
        if (bodyRefCount > 1) { fail(`${rel}: @body（本文を差す指示子）が 2 つ以上ある（高々 1 つ）`); bad16++; }
        if (bodyRefCount === 1 && !body.trim()) { fail(`${rel}: @body があるのに本文が空`); bad16++; }

        // 16-e / 16-f: 実機 DSL・テストとの整合
        const testPath = resolve(TESTS_DIR, `${dir}.json`);
        if (appFiles.some(f => f.startsWith(`${dir}-`))) {
          if (!existsSync(testPath)) {
            warn(`${rel}: dify/apps/${dir}-*.yml はあるが dify/tests/${dir}.json が無いため 16-e を検査できない`);
          } else {
            try {
              const testJson = JSON.parse(readFileSync(testPath, 'utf8'));
              if (testJson.mode !== fm.mode) {
                fail(`${rel}: mode "${fm.mode}" が dify/tests/${dir}.json の mode "${testJson.mode}" と一致しない`); bad16++;
              }
              if (fm.mode === 'workflow') {
                const testInputKeys = new Set();
                for (const c of testJson.cases || []) {
                  for (const k of Object.keys(c.inputs || {})) testInputKeys.add(k);
                }
                const sampleInputKeys = new Set(Object.keys(fm.inputs || {}));
                const onlyInSample = [...sampleInputKeys].filter(k => !testInputKeys.has(k));
                const onlyInTest = [...testInputKeys].filter(k => !sampleInputKeys.has(k));
                if (onlyInSample.length || onlyInTest.length) {
                  fail(`${rel}: inputs キー集合が dify/tests/${dir}.json と一致しない（サンプルのみ: ${onlyInSample.join(',') || 'なし'} / テストのみ: ${onlyInTest.join(',') || 'なし'}）`);
                  bad16++;
                }
              }
            } catch (e) {
              fail(`${rel}: dify/tests/${dir}.json の解析に失敗: ${e.message}`); bad16++;
            }
          }
        } else {
          // 16-f: 実機 DSL が無い（金融など。W4 で投入予定）
          warn(`${rel}: dify/apps/${dir}-*.yml が無い（実機 DSL 未実装。W4 で投入予定）`);
        }

        validCount++;
      }

      dirsWithValidSamples.set(dir, validCount);
    }

    // 16-i: dify/apps/ にある管理番号に dify/samples/<番号>/ が無い、または 3 件未満は warn
    const under3 = [];
    for (const code of appCodes) {
      const count = dirsWithValidSamples.has(code) ? dirsWithValidSamples.get(code) : 0;
      if (count < 3) under3.push(`${code}(${count})`);
    }
    if (under3.length) warn(`dify/apps/ にある管理番号のうち dify/samples/ が無い/3 件未満: ${under3.join(', ')}`);

    if (!bad16) ok(`dify/samples/ 配下 ${dirEntries.length} ディレクトリすべてが §16-a〜16-h を満たす`);
  }
}

/* ---------- 17. 部門ポータル（mock/portal.html）の契約 ---------- */
section('17. 部門ポータル（mock/portal.html）契約');
{
  const portal = loadPortal(ROOT);
  if (!portal) {
    ok('mock/portal.html が無いため §17 は skip');
  } else {
    const PORTAL_HTML = resolve(MOCK, 'portal.html');
    let bad17 = 0;

    /* 17-a: <script src> の順・本数（実ディレクトリから期待値を計算） */
    const scenDirP = resolve(MOCK, 'js/data/scenarios');
    const scenDirsP = existsSync(scenDirP)
      ? readdirSync(scenDirP, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()
      : [];
    const presentIndP = INDUSTRY_ORDER.filter(i => scenDirsP.includes(i));
    const scenarioTagsP = presentIndP.flatMap(indId => {
      const dirFiles = new Set(readdirSync(resolve(scenDirP, indId)).filter(f => f.endsWith('.js')));
      const ordered = (CAT_ORDER_BY_INDUSTRY[indId] || []).filter(code => dirFiles.has(`${code}.js`));
      const extra = [...dirFiles].filter(f => !ordered.includes(basename(f, '.js'))).sort();
      return [...ordered, ...extra.map(f => basename(f, '.js'))].map(code => `js/data/scenarios/${indId}/${code}.js`);
    });
    const portalDataDir = resolve(MOCK, 'js/data/portal');
    const portalDataFiles = existsSync(portalDataDir) ? new Set(readdirSync(portalDataDir).filter(f => f.endsWith('.js'))) : new Set();
    const PORTAL_DATA_ORDER = ['ui.js', 'svc.js', 'org.js', 'front.js', 'common.js', 'mgmt.js', 'back.js'];
    const portalDataOrdered = PORTAL_DATA_ORDER.filter(f => portalDataFiles.has(f));
    const portalDataExtra = [...portalDataFiles].filter(f => !PORTAL_DATA_ORDER.includes(f)).sort();
    const portalDataTags = [...portalDataOrdered, ...portalDataExtra].map(f => `js/data/portal/${f}`);
    const portalAppDir = resolve(MOCK, 'js/portal');
    const portalAppFiles = existsSync(portalAppDir) ? new Set(readdirSync(portalAppDir).filter(f => f.endsWith('.js'))) : new Set();
    const PORTAL_APP_ORDER = ['app.js', 'render.js', 'demo.js', 'events.js'];
    const portalAppOrdered = PORTAL_APP_ORDER.filter(f => portalAppFiles.has(f));
    const portalAppExtra = [...portalAppFiles].filter(f => !PORTAL_APP_ORDER.includes(f)).sort();
    const portalAppTags = [...portalAppOrdered, ...portalAppExtra].map(f => `js/portal/${f}`);
    const expectedOrderP = ['js/data/ui.js', 'js/data/catalog.js', 'js/data/style.js', ...scenarioTagsP, ...portalDataTags, ...portalAppTags];

    if (JSON.stringify(portal.scriptSrcs) !== JSON.stringify(expectedOrderP)) {
      fail(`portal.html の <script src> の順序が期待と異なる:\n   期待: ${expectedOrderP.join(' → ')}\n   実際: ${portal.scriptSrcs.join(' → ')}`);
      bad17++;
    } else ok(`portal.html の <script src> ${expectedOrderP.length} 本が期待どおりの順序`);
    for (const src of portal.scriptSrcs) {
      if (!existsSync(resolve(MOCK, src))) { fail(`portal.html <script src="${src}">: 実ファイルが無い`); bad17++; }
      if (src.startsWith('/') || src.includes('../')) { fail(`portal.html <script src="${src}">: 相対パスでない`); bad17++; }
    }

    /* 17-b: インライン <script>/<style> 0 個、<link> は tokens→portal の 2 本、トークン定義のコピーなし */
    if (portal.inlineScriptCount !== 0) { fail(`portal.html にインライン <script> が ${portal.inlineScriptCount} 個ある`); bad17++; }
    if (portal.styleCount !== 0) { fail(`portal.html に <style> ブロックが ${portal.styleCount} 個ある`); bad17++; }
    const expectedLinksP = ['css/tokens.css', 'css/portal.css'];
    if (JSON.stringify(portal.cssLinks) !== JSON.stringify(expectedLinksP)) {
      fail(`portal.html の <link rel="stylesheet"> が想定と異なる: [${portal.cssLinks.join(', ')}]（期待: [${expectedLinksP.join(', ')}]）`);
      bad17++;
    } else {
      for (const href of portal.cssLinks) {
        if (href.startsWith('/') || href.includes('../')) { fail(`portal.html <link href="${href}">: 相対パスでない`); bad17++; }
        if (!existsSync(resolve(MOCK, href))) { fail(`portal.html <link href="${href}">: 実ファイルが無い`); bad17++; }
      }
    }
    if (/--ntt-[a-z0-9-]+\s*:/i.test(portal.html)) { fail('portal.html にトークン定義のコピー（--ntt-* の定義行）が残っている'); bad17++; }
    if (!bad17) ok('portal.html: インライン <script>/<style> 0 個・<link> 2 本（tokens → portal）・トークンのコピーなし');

    /* 17-c: SVCS[].place の値域（PSCREENS の画面 id ／ '*' ／ 'out'）。キー自体が無いものは warn（未配置） */
    const screenIds17 = new Set((portal.data.PSCREENS || []).map(s => s.id));
    const managementCode17 = (id) => id.replace(/^([a-z]+)(\d+)$/, (_, a, b) => a.toUpperCase() + '-' + String(b).padStart(2, '0'));
    const placeless17 = [];
    let placeBad17 = 0;
    for (const s of portal.data.SVCS || []) {
      const place = s.place;
      if (place === undefined) { placeless17.push(s.id); continue; }
      if (place === '*' || place === 'out' || screenIds17.has(place)) continue;
      fail(`SVCS.${s.id}.place の値が値域外: "${place}"（PSCREENS の画面 id ／ '*' ／ 'out' のいずれかであること）`);
      placeBad17++;
    }
    if (!placeBad17) {
      const placedCount = (portal.data.SVCS || []).length - placeless17.length;
      ok(`SVCS[].place ${placedCount} 件がすべて値域内（画面 id ／ '*' ／ 'out'）`);
    }
    bad17 += placeBad17;
    if (placeless17.length) warn(`置き場所を決めていない: ${placeless17.map(managementCode17).join(', ')}`);

    /* 17-d: portal.css に色の直値が無く、var(--x) がすべて tokens.css で定義済み */
    const portalCssStripped = portal.portalCss.replace(/\/\*[\s\S]*?\*\//g, '');
    const hexP = [...portalCssStripped.matchAll(/#[0-9a-f]{3,8}\b/gi)].map(m => m[0]);
    if (hexP.length) { fail(`portal.css に色の直値: ${[...new Set(hexP)].join(', ')}`); bad17++; }
    else ok('portal.css に色の直値なし');
    const definedTokensP = new Set([...tokenCss.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map(m => m[1]));
    const usedTokensP = new Set([...portal.portalCss.matchAll(/var\((--[a-z0-9-]+)/gi)].map(m => m[1]));
    const undefTokensP = [...usedTokensP].filter(v => !definedTokensP.has(v));
    if (undefTokensP.length) { fail(`portal.css の未定義 CSS 変数: ${undefTokensP.join(', ')}`); bad17++; }
    else ok(`portal.css の var() 参照 ${usedTokensP.size} 件すべて tokens.css で定義済み`);

    /* 17-e: PT と js/data/portal/** に現れる {ja:…} 形のオブジェクトがすべて 3 言語 */
    const PORTAL_ONLY_KEYS = [
      'PT', 'PGRP', 'PSCREENS', 'PHOW', 'PHOWLONG', 'PST',
      'PSVC', 'POUT', 'PNEW', 'PSTAGE_AI', 'PORG',
      'PSTAGE', 'PDEALS', 'PCUST', 'PCONTACT', 'PHIST', 'PNEWS', 'PVENDOR',
      'PACT', 'PCAND', 'PMEET', 'PKNOW', 'PKNOWACT',
      'PPEOPLE', 'PATT', 'PKPI', 'PKPITOPIC', 'PSRC', 'PGOAL', 'PQTR', 'PCUR_Q',
      'PEXP', 'PREQ', 'PTRAIN', 'PMYTRAIN', 'PMYITEM', 'PTODO_STATE', 'PSURVEY', 'PMYSURVEY'
    ];
    let ml17 = 0;
    const foundML = [];
    (function collect(v, path) {
      if (!v || typeof v !== 'object') return;
      if (!Array.isArray(v) && typeof v.ja === 'string') { foundML.push({ path, obj: v }); return; }
      if (Array.isArray(v)) { v.forEach((x, i) => collect(x, `${path}[${i}]`)); return; }
      for (const k of Object.keys(v)) collect(v[k], `${path}.${k}`);
    })(Object.fromEntries(PORTAL_ONLY_KEYS.map(k => [k, portal.data[k]])), '');
    for (const { path, obj } of foundML) {
      for (const l of LANGS) {
        if (typeof obj[l] !== 'string' || !obj[l].trim()) { fail(`${path}: ${l} が欠落/空`); ml17++; }
      }
      if (obj.en && kana.test(obj.en)) { fail(`${path}: en にかなが残っている → "${obj.en}"`); ml17++; }
    }
    if (!ml17 && portal.data.PT) ok(`PT（${Object.keys(portal.data.PT).length} キー）と js/data/portal/** の {ja:…} 形のオブジェクト（${foundML.length} 件）がすべて 3 言語一致`);
    bad17 += ml17;

    /* 17-f: js/portal/*.js に現れる mock.* が mock.lang / mock.theme の部分集合 */
    const appTextP = portal.appSources.map(f => f.src).join('\n');
    const mockKeysP = new Set([...appTextP.matchAll(/mock\.([A-Za-z0-9_]+)/g)].map(m => `mock.${m[1]}`));
    const allowedP = new Set(['mock.lang', 'mock.theme']);
    const disallowedP = [...mockKeysP].filter(k => !allowedP.has(k));
    if (disallowedP.length) { fail(`js/portal/**: 許可されていない localStorage キー: ${disallowedP.join(', ')}`); bad17++; }
    else ok(`js/portal/** の localStorage キーは許可集合の部分集合（${[...mockKeysP].join(', ') || 'なし'}）`);

    /* 17-g: PSVC / PSTAGE_AI / PSCREENS[].newai に出てくる管理番号が SVCS に存在する（PNEW の id は除く）。
       PCTXDEF のキーが PSCREENS の id に存在する（PCTXDEF は PR-3 で導入。無ければ skip）。
       POUT のキーが place === 'out' の管理番号と過不足なく一致する。 */
    const svcIds17 = new Set((portal.data.SVCS || []).map(s => s.id));
    const pnewIds17 = new Set(portal.data.PNEW || []);
    let refBad17 = 0;
    for (const id of Object.keys(portal.data.PSVC || {})) {
      if (pnewIds17.has(id)) continue;
      if (!svcIds17.has(id)) { fail(`PSVC.${id}: SVCS に存在しない id`); refBad17++; }
    }
    for (const [stage, ids] of Object.entries(portal.data.PSTAGE_AI || {})) {
      for (const id of (ids || [])) {
        if (!svcIds17.has(id)) { fail(`PSTAGE_AI.${stage}: SVCS に存在しない id "${id}"`); refBad17++; }
      }
    }
    for (const scr of portal.data.PSCREENS || []) {
      for (const id of (scr.newai || [])) {
        if (pnewIds17.has(id) || svcIds17.has(id)) continue;
        fail(`PSCREENS.${scr.id}.newai: SVCS にも PNEW にも存在しない id "${id}"`); refBad17++;
      }
    }
    if (portal.data.PCTXDEF) {
      for (const key of Object.keys(portal.data.PCTXDEF)) {
        if (!screenIds17.has(key)) { fail(`PCTXDEF.${key}: PSCREENS に存在しない画面 id`); refBad17++; }
      }
    }
    const outIds17 = new Set((portal.data.SVCS || []).filter(s => s.place === 'out').map(s => s.id));
    const poutIds17 = new Set(Object.keys(portal.data.POUT || {}));
    const missingPout17 = [...outIds17].filter(id => !poutIds17.has(id));
    const extraPout17 = [...poutIds17].filter(id => !outIds17.has(id));
    if (missingPout17.length) { fail(`POUT に理由文が無い（SVCS[].place === 'out'）: ${missingPout17.join(', ')}`); refBad17++; }
    if (extraPout17.length) { fail(`POUT に place !== 'out' のキーがある: ${extraPout17.join(', ')}`); refBad17++; }
    if (!refBad17) {
      ok(`PSVC / PSTAGE_AI / PSCREENS[].newai の管理番号は SVCS（または PNEW）に存在し、POUT（${poutIds17.size} 件）は place: 'out'（${outIds17.size} 件）と過不足なく一致`);
    }
    bad17 += refBad17;

    /* 17-h: 足場（mockbar）とプロダクト機能（言語・テーマ切替）の存在 */
    if (!/class="mockbar"/.test(portal.html)) { fail('portal.html に class="mockbar" が無い'); bad17++; }
    if (!/id="langSel"/.test(portal.html)) { fail('portal.html に id="langSel" が無い'); bad17++; }
    if (!/id="themeBtn"/.test(portal.html)) { fail('portal.html に id="themeBtn" が無い'); bad17++; }
    if (/class="mockbar"/.test(portal.html) && /id="langSel"/.test(portal.html) && /id="themeBtn"/.test(portal.html)) {
      ok('portal.html に mockbar（足場）と langSel/themeBtn（プロダクト機能）がある');
    }

    /* 17-i: PSVC は st / name / cat を持たない（SVCS からの二重持ちの再発を止める） */
    if (portal.data.PSVC) {
      let dupBad = 0;
      for (const id of Object.keys(portal.data.PSVC)) {
        const forbidden = ['st', 'name', 'cat'].filter(k => Object.prototype.hasOwnProperty.call(portal.data.PSVC[id], k));
        if (forbidden.length) { fail(`PSVC.${id}: SVCS と二重持ちのキーがある: ${forbidden.join(', ')}`); dupBad++; }
      }
      if (!dupBad) ok('PSVC は st / name / cat を持たない（SVCS からの二重持ちなし）');
      bad17 += dupBad;
    }

    /* 17-j: 生 URL（http(s)://）が無い（catalog.html への相対リンクは可） */
    const urlRe17 = /https?:\/\//;
    const urlBad = [];
    if (urlRe17.test(portal.html)) urlBad.push('portal.html');
    if (urlRe17.test(portal.portalCss)) urlBad.push('mock/css/portal.css');
    for (const f of [...portal.appSources, ...portal.dataSources]) {
      if (f.path.startsWith('js/portal/') || f.path.startsWith('js/data/portal/')) {
        if (urlRe17.test(f.src)) urlBad.push(f.path);
      }
    }
    if (urlBad.length) { fail(`生 URL（http(s)://）が含まれている（CLAUDE.md §2-10）: ${urlBad.join(', ')}`); bad17++; }
    else ok('portal.html / portal.css / js/portal/** / js/data/portal/** に生 URL なし');

    /* 17-k（PR-3・§14-9）: PWORLD のキーが PDEALS[].cu と過不足なく一致し、値が INDUSTRIES の id のいずれか。
       かつ data/world/it/clients.csv の code 列に全キーが存在し、ref_world が空でないものは PWORLD の値と一致する */
    {
      const pworld = portal.data.PWORLD || {};
      const dealsCu = new Set((portal.data.PDEALS || []).map(d => d.cu));
      const pworldKeys = new Set(Object.keys(pworld));
      const missingInPworld = [...dealsCu].filter(cu => !pworldKeys.has(cu));
      const extraInPworld = [...pworldKeys].filter(cu => !dealsCu.has(cu));
      let bad17k = 0;
      if (missingInPworld.length) { fail(`PWORLD にキーが無い（PDEALS[].cu に存在）: ${missingInPworld.join(', ')}`); bad17k++; }
      if (extraInPworld.length) { fail(`PWORLD に PDEALS[].cu に無いキーがある: ${extraInPworld.join(', ')}`); bad17k++; }
      for (const [cu, ind] of Object.entries(pworld)) {
        if (!industryIds.has(ind)) { fail(`PWORLD.${cu}: 値 "${ind}" が INDUSTRIES の id ではない`); bad17k++; }
      }
      const clientsCsvPath = resolve(ROOT, 'data/world/it/clients.csv');
      if (existsSync(clientsCsvPath)) {
        const rows = readFileSync(clientsCsvPath, 'utf8').trim().split('\n').slice(1)
          .map(line => line.split(','));
        for (const cols of rows) {
          const code = cols[0], refWorld = cols[2];
          if (!(code in pworld)) { fail(`data/world/it/clients.csv の code "${code}" が PWORLD に無い`); bad17k++; continue; }
          if (refWorld && refWorld !== pworld[code]) {
            fail(`PWORLD.${code} = "${pworld[code]}" が clients.csv の ref_world "${refWorld}" と矛盾する`); bad17k++;
          }
        }
      } else warn('data/world/it/clients.csv が無いため PWORLD との突き合わせを skip');
      if (!bad17k) ok(`PWORLD（${pworldKeys.size} 件）が PDEALS[].cu と過不足なく一致し、data/world/it/clients.csv の ref_world と矛盾しない`);
      bad17 += bad17k;
    }

    /* 17-l（PR-3・§14-9）: js/portal/demo.js に pstate.ind の参照が無い（規則 3）／
       pscreenAiIds・pcrossAiIds の関数本体に industries の参照が無い（規則 1） */
    {
      const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
      let bad17l = 0;
      const demoFile = portal.appSources.find(f => f.path === 'js/portal/demo.js');
      if (demoFile) {
        const demoStripped = stripComments(demoFile.src);
        if (/pstate\s*\.\s*ind\b|pstate\s*\[\s*['"]ind['"]\s*\]/.test(demoStripped)) {
          fail('js/portal/demo.js が pstate.ind を参照している（設計書 §14-4 規則 3 違反）'); bad17l++;
        }
      } else warn('js/portal/demo.js が無いため 17-l の pstate.ind 検査を skip');
      const extractFnBody = (src, name) => {
        const m = new RegExp(`function\\s+${name}\\s*\\(`).exec(src);
        if (!m) return null;
        let i = m.index + m[0].length, depthParen = 1;
        while (depthParen > 0 && i < src.length) { if (src[i] === '(') depthParen++; else if (src[i] === ')') depthParen--; i++; }
        while (i < src.length && src[i] !== '{') i++;
        const start = i; let depth = 0;
        do { if (src[i] === '{') depth++; else if (src[i] === '}') depth--; i++; } while (depth > 0 && i < src.length);
        return src.slice(start, i);
      };
      const appAllStripped = stripComments(portal.appSources.map(f => f.src).join('\n'));
      for (const fn of ['pscreenAiIds', 'pcrossAiIds']) {
        const body = extractFnBody(appAllStripped, fn);
        if (body === null) { fail(`${fn}() が js/portal/** に見つからない`); bad17l++; continue; }
        if (/industries/.test(body)) { fail(`${fn}() の本体が industries を参照している（設計書 §14-2 規則 1 違反）`); bad17l++; }
      }
      if (!bad17l) ok('js/portal/demo.js に pstate.ind の参照が無く、pscreenAiIds/pcrossAiIds に industries の参照が無い（§14 規則 1・3）');
      bad17 += bad17l;
    }

    if (portal.vmErrors.length) { for (const e of portal.vmErrors) { fail(`portal js/data/**: ${e}`); bad17++; } }
    else ok('portal の js/data/** が vm で読める（vmErrors 0 件）');
  }
}

/* ---------- 18. portal/（NocoBase。⑤ポータル）取り込みの前提契約 ---------- */
section('18. portal/（NocoBase）取り込みの前提契約');
{
  const PORTAL_ROOT = resolve(ROOT, 'portal');
  if (!existsSync(PORTAL_ROOT)) {
    ok('portal/ が無いため §18 は skip');
  } else {
    // 18-a: .github/workflows/portal-verify.yml が実在し、paths: に portal/** を含む
    const portalWf = resolve(ROOT, '.github/workflows/portal-verify.yml');
    if (!existsSync(portalWf)) {
      fail('portal/ があるのに .github/workflows/portal-verify.yml が無い（S-1〜S-3）');
    } else {
      const portalWfRaw = readFileSync(portalWf, 'utf8');
      if (!/paths:[\s\S]*?portal\/\*\*/.test(portalWfRaw)) {
        fail('.github/workflows/portal-verify.yml の paths: に portal/** が無い');
      } else ok('.github/workflows/portal-verify.yml が実在し paths: に portal/** を含む');
    }

    // 18-b: ルート package.json に dependencies が無く、scripts.test が既定のまま（§2-14 の土台）
    const rootPkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
    if (rootPkg.dependencies && Object.keys(rootPkg.dependencies).length) {
      fail('ルート package.json に dependencies がある（portal/ の依存をルートに足さない＝§2-14）');
    } else if (rootPkg.scripts?.test !== 'node tools/verify.mjs && node tools/regress.mjs') {
      fail(`ルート package.json の scripts.test が既定と異なる（実際: "${rootPkg.scripts?.test}"）`);
    } else ok('ルート package.json: dependencies が空・scripts.test が既定のまま');

    // 18-c: portal/package.json が実在し、ルートの package.json を参照していない（S-2）
    const portalPkgPath = resolve(PORTAL_ROOT, 'package.json');
    if (!existsSync(portalPkgPath)) {
      fail('portal/package.json が無い（S-2：独立 npm プロジェクトであること）');
    } else {
      const portalPkgRaw = readFileSync(portalPkgPath, 'utf8');
      if (/\.\.\/package\.json/.test(portalPkgRaw)) {
        fail('portal/package.json がルートの ../package.json を参照している（S-2 違反）');
      } else ok('portal/package.json が実在し、ルートの package.json を参照していない');
    }

    // 18-d: pages.yml の path: が mock のまま（§8 と同じ検査）＋ mock/** に先頭が portal/ の相対リンクが無い
    const pagesWf = resolve(ROOT, '.github/workflows/pages.yml');
    if (!existsSync(pagesWf) || !/path:\s*mock\b/.test(readFileSync(pagesWf, 'utf8'))) {
      fail('pages.yml の path: が mock ではない（§2-8）');
    } else ok('pages.yml: path: mock のまま（portal/ は Pages に出ない）');

    // mock/**（*.html/*.js/*.css）のテキストの中に、先頭が "portal/" の相対リンクが無いこと。
    // "portal" という語だけを拾うと mock/portal.html・js/portal/**・js/data/portal/**・css/portal.css で
    // 必ず誤検知するため、直前の文字が「引用符／丸括弧／=／行頭・空白」で始まる "portal/" だけを対象にする
    // （js/data/portal/ui.js のように "/portal/" の手前が "/" のものは対象外）
    const mockTextFiles = [];
    const walkMockText = (dir, rel) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const childRel = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) { walkMockText(resolve(dir, entry.name), childRel); continue; }
        if (/\.(html|js|css)$/.test(entry.name)) mockTextFiles.push({ abs: resolve(dir, entry.name), rel: `mock/${childRel}` });
      }
    };
    walkMockText(MOCK, '');
    const PORTAL_LINK_RE = /(^|[\s"'(=])portal\//m;
    const offenders18d = mockTextFiles.filter(f => PORTAL_LINK_RE.test(readFileSync(f.abs, 'utf8'))).map(f => f.rel);
    if (offenders18d.length) {
      fail(`mock/** の中に先頭が "portal/" の相対リンクがある（Pages に出ない ⑤ポータルを参照している）: ${offenders18d.join(', ')}`);
    } else ok('mock/** に先頭が "portal/" の相対リンクが無い（mock/portal.html 等の誤検知なし）');
  }
}

/* ---------- 結果 ---------- */
console.log(`\n${fails === 0 ? '✅ ALL PASS' : `❌ ${fails} FAIL`}${warns ? ` / ⚠️ ${warns} warn` : ''}`);
process.exit(fails ? 1 : 0);
