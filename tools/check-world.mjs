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
 *   node tools/check-world.mjs --all      W6/W7 のような件数が多い検査も全件表示する（既定は先頭 10 件＋「ほか N 件」）
 *   npm run world                          = node tools/check-world.mjs
 *
 * 業種は mfg / fin / both の 3 バケットで回す（Issue #182）。
 * 走査対象の振り分け:
 *   - mock/js/data/scenarios/**（台本）: パスに `/scenarios/fin/` を含むものが fin、それ以外は mfg
 *     （`scenarios/mfg/`・`scenarios/fin/` それぞれのディレクトリ配下が丸ごとそのまま対応する業種の
 *      走査対象になる。台本データ本体は `window.SCENARIOS[業種][svcId]` の 2 階層で、構造化データ
 *      （W1/W2/W3/W9 の persona 走査）はこのディレクトリ分けと対で `data.SCENARIOS[ind]` を直接
 *      参照する。Issue #133 コメント2）。両業種のサービス（`industries: ['mfg','fin']`）でも台本は
 *      mfg 側・fin 側それぞれのディレクトリに別々の実例として置かれる（1 つのサービスに mfg 用と
 *      fin 用の 2 つの台本がある）ので、台本は常にどちらか一方に正しく属し、both バケットには
 *      台本が存在しない
 *   - dify/kb/**・dify/tests/**・docs/dify/usecases/**・dify/samples/**（Issue #205 で追加。
 *     台本と違い業種ディレクトリに分かれておらず、1 管理番号につき 1 ディレクトリ／1 ファイルしか無い）:
 *     ファイルパスから管理番号（`[A-Z]{2}-\d+`）を抜き、
 *     CLAUDE.md §2-11 の逆変換（大文字接頭辞 → 内部 id の小文字化＋ゼロ埋め解除。例 `KN-06` → `kn6`）
 *     で SVCS の該当エントリを引き、その `industries`（正本）で mfg 専用／fin 専用／両業種の
 *     3 バケットに振り分ける（分類コードのハードコード集合は使わない）。
 *     SVCS に無い管理番号（欠番・README.md・_TEMPLATE.md のような番号を含まないファイル等）は
 *     従来どおり既定で mfg 扱いにする（走査対象から漏らさないため。§7-2 の「不明なものは mfg」と同じ既定）
 *
 * both バケット（業種横断サービスの kb/tests/usecases/samples）の扱い（Issue #182 のやり直し。
 * PM 指摘：「両方の pass に入れる」＝両方の world master に登録されていることを要求する形は
 * 誤りだった。両業種サービスの実例は普通どちらか一方の世界の語彙で書かれる。正しくは
 * 「mfg と fin の world master の和集合のどちらかに載っていればよい」）:
 *   - W1（人名）・W2（役職）・W3（拠点）・W9（カバレッジ）は台本（SCENARIOS）が入力で、
 *     both バケットには台本が無い（上記のとおり常にどちらかの業種ディレクトリに属する）ため、
 *     対象データが無く skip する（黙って飛ばさず理由を出力する）
 *   - W4（社名の出現回数）・W5（取引先記号）は台本本体（mock/js/data 配下）のテキストが入力で、
 *     both バケット（kb/tests/usecases/samples）にはその入力が無いため skip する
 *   - W8（KPI）は「基準値と一致するか」を見る検査で、mfg と fin は指標体系そのものが違う
 *     （不良率・稼働率 vs 延滞率）ため和集合にする意味が無く skip する
 *   - W6（文書番号）・W7（品番・設備）は「登録済みの集合に含まれるか」を見る検査なので、
 *     mfg と fin の calendar.md／documents.csv／products.csv／equipment.csv を**和集合**にして
 *     判定する（すでに mfg/fin バケットの実行で解析済みの正規表現・集合を再利用する。calendar.md の
 *     パース警告を two重に出さないため、W6 の再パースはしない）
 *
 * 入力: data/world/<業種>/ 配下の csv/md ＋ 上記の走査対象 4 系統
 *
 * 検査（すべて warn。FAIL にしない）:
 *   W1 人名：走査対象に出る人名が people.csv にあるか
 *   W2 役職：台本の役職（persona.role）が people.csv の主務（title_*）または兼務
 *      （alt_title_*。`;` 区切り）のいずれかと 3 言語すべて一致するか（Issue #153 PR-3 §6-2・§7-3。
 *      旧実装は「同じ人名に複数の役職があること」自体を warn にしていたが、正本に兼務を
 *      登録できるようにしたため「正本に無い役職」だけを検出する形に変えた）
 *   W3 拠点：company.md の拠点表にない拠点表記
 *   W4 社名：正式名称（ja/zh/en）の表記が company.md と一致するか。英名が使われていない
 *   W5 取引先記号：partners.csv / clients.csv に無い記号、表記ゆれ
 *   W6 文書番号：calendar.md の「文書番号の体系」表をパースして得た書式（knownPatterns）に
 *      合わない書式、および表に登録の無い接頭辞（Issue #133）。パース規則は
 *      parseCalendarPatterns()/segToRegexFrag() のコメントを参照。
 *      判定順序（Issue #153 PR-1 §7-2。正本の明示的な登録がツールの一般則より優先）：
 *      ① 数字を含まない → 対象外 ／ ② calendar.md の書式に一致 → OK ／
 *      ③ documents.csv の doc_id に実在 → OK（PR-2 で新設。無ければこの段はスキップ） ／
 *      ④ 管理番号形式 ^[A-Z]{2}-\d{1,2}$ → 対象外 ／
 *      ⑤ 品番・設備接頭辞（products.csv/equipment.csv 由来） → 対象外 ／
 *      ⑥ 単独英字で calendar.md 未登録 → 対象外 ／ ⑦ それ以外 → warn。
 *      あわせて、calendar.md に `^[A-Z]{2}-NN$` 形の書式を登録するとき、その接頭辞が
 *      分類コード（CATS[].id の大文字化。§2-11）と衝突していないかも検査する
 *   W7 品番・設備：products.csv/equipment.csv に無いコード（fin は設備を持たないため skip）。
 *      候補の接頭辞はハードコードせず products.csv の part_no・equipment.csv の equip_id の
 *      先頭セグメントから組み立てる（Issue #153 PR-1 §5-3）。管理番号形式（^[A-Z]{2}-\d{2}$）と
 *      衝突するコード
 *   W8 KPI：kpi.csv の全指標（name_ja/name_zh。ハードコードしない）が出ているのに値が
 *      基準値・目標・前月のどれとも一致しない。表記ゆれ（稼働率/稼動率/稼动率 等。
 *      KPI_LABEL_CONFUSABLES）と隣接の崩し（括弧・コロン・助詞を挟む。KPI_ADJACENCY_RE）
 *      を両方吸収したうえで判定する（tools/check-world.mjs の W8 ヘルパーのコメント参照）
 *   W9 カバレッジ：people.csv にあるがどこにも出てこない人物
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMock } from './lib/load.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORLD = resolve(ROOT, 'data/world');
const strict = process.argv.includes('--strict');
const showAll = process.argv.includes('--all');

const warnCounts = { mfg: 0, fin: 0, both: 0 };
let currentInd = 'mfg';
const section = (t) => console.log(`\n── ${t} ──`);
const report = (m) => { warnCounts[currentInd]++; console.log('⚠️ ', m); };
const ok = (m) => console.log('✅', m);
// 対象データが無い／和集合にすると意味が薄れる検査を明示的に飛ばすときに使う。
// warnCounts は増やさない（skip は不一致の報告ではない）が、黙って飛ばさず必ず 1 行出す
const skip = (m) => console.log('⏭️ ', m);

// 件数が多い検査（W6/W7）用。集計は常に全件（items.length）、表示だけ既定 showMax 件に絞る。
// 旧実装は表示キャップ（`if (n <= 10) report(...)`）の内側で集計していたため、
// 11 件目以降は表示からも合計からも消えていた（Issue #153 PR-1 §7-1）。
// --all を付けると表示も全件になる（「ほか N 件」の行は出ない）。
function reportMany(label, items, showMax = 10) {
  warnCounts[currentInd] += items.length; // 集計は全件
  if (!items.length) return;
  console.log('⚠️ ', `${label} ${items.length} 件`);
  const shown = showAll ? items : items.slice(0, showMax);
  for (const it of shown) console.log('    -', it);
  if (items.length > shown.length) {
    console.log(`    … ほか ${items.length - shown.length} 件（全件は --all）`);
  }
}

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

/* ---------- W6: calendar.md の「文書番号の体系」表 → knownPatterns（Issue #133） ---------- */
/*
 * data/world/<業種>/calendar.md の「## 文書番号の体系」表が正本（CLAUDE.md §2-13）。
 * 表の 1 列目（書式）はバックティック `...` で囲まれた文字列（1 セルに「または」で複数の
 * 書式が入っていることがある。例: `RFQ-YYYY-NNN` または `RFQ-YY-NNN`）。
 *
 * 書式文字列は '-' で分割し、最初のセグメント（先頭の '-' より前）は常に接頭辞として
 * 文字どおり扱う（例: `TR`・`8D`・`C`）。2 セグメント目以降は、同じ文字が連続する
 * 「ラン」単位でプレースホルダを解決する：
 *   - `Y` / `M` / `D` / `N` の連続 n 文字 → `\d{n}`（年・月・日・通番などの数字プレースホルダ。
 *     例: `YYYY`→`\d{4}`、`NNN`→`\d{3}`、`YYMM`→`\d{2}\d{2}`、`MMDD`→`\d{2}\d{2}`）
 *   - `X` の連続 n 文字 → `[A-Z]{n}`（英大文字プレースホルダ。例: `WS-XX-NNN` の `XX`）
 *   - `Q` / `L` の 1 文字 → リテラル文字として扱う（プレースホルダではなく、書式そのものの一部。
 *     `QR-YYYY-QN-NN` の `Q` は「四半期」の頭文字、`PC-LN-YYYY-NNN` の `L` は「ライン」の頭文字。
 *     実例 `QR-2026-Q2-05` / `PC-L3-2026-014` で確認済み。この 2 文字は現時点の表で実際に
 *     使われている literal marker を明示的に列挙したもの。表に新しい 1 文字マーカーが増えたら
 *     ここに追記する）
 *   - `<N 桁>`（例: `<4 桁>`） → `\d{N}`
 *   - `<A〜Z>`（英字範囲） → `[A-Z]`
 *   - 数字はそのままリテラル（例: `C-26NN-X` の `26`）
 *   - 上記のどれにも当てはまらない文字（未知のプレースホルダ）が出てきたら、黙って無視せず
 *     warn する（該当セグメントはリテラル扱いにフォールバックしつつ報告する）
 *   - 表の行としてパースできない行（バックティックのセグメントが 1 つしかない等）も同様に warn する
 */
function escLit(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function segToRegexFrag(seg, patStr, warn) {
  let m;
  if ((m = seg.match(/^<(\d+)\s*桁>$/))) return `\\d{${m[1]}}`;
  if ((m = seg.match(/^<([A-Za-z])〜([A-Za-z])>$/))) return `[${m[1]}-${m[2]}]`;
  let out = '';
  let i = 0;
  while (i < seg.length) {
    const c = seg[i];
    let j = i;
    while (j < seg.length && seg[j] === c) j++;
    const n = j - i;
    if (/[0-9]/.test(c)) {
      out += escLit(seg.slice(i, j));
    } else if (c === 'X') {
      out += n > 1 ? `[A-Z]{${n}}` : '[A-Z]';
    } else if ('YMDN'.includes(c)) {
      out += n > 1 ? `\\d{${n}}` : '\\d';
    } else if (n === 1 && 'QL'.includes(c)) {
      out += escLit(c);
    } else {
      warn(`calendar.md の書式 "${patStr}" に規則にない文字 '${c}' を含むセグメント "${seg}"（リテラル扱いにフォールバック）`);
      out += escLit(seg.slice(i, j));
    }
    i = j;
  }
  return out;
}

function patternStrToRegex(patStr, warn) {
  const segs = patStr.split('-');
  if (segs.length < 2) { warn(`calendar.md の書式 "${patStr}" をパースできなかった（セグメントが1つしかない）`); return null; }
  const prefix = escLit(segs[0]);
  const rest = segs.slice(1).map(s => segToRegexFrag(s, patStr, warn));
  return { prefix: segs[0], re: new RegExp(`^${prefix}-${rest.join('-')}$`) };
}

// calendar.md の「## 文書番号の体系」表を走査し { patterns: RegExp[] } を返す。
// 見出しのある表だけを対象にする（「世界の今日」節などの本文中のバックティックは拾わない）。
//
// categoryCodes が渡されたときは、歯止めの検査も行う（Issue #153 PR-1 §7-2）：
// `^[A-Z]{2}-NN$` 形（2 文字接頭 ＋ 2 桁の書式プレースホルダそのまま）の書式を登録するとき、
// その 2 文字が分類コード（CATS[].id を大文字化したもの。§2-11 の管理番号の接頭辞）と
// 一致していたら warn する。正本が「これは文書番号の書式である」と宣言した接頭辞が、
// 別の体系（管理番号 KN-01 等）の接頭辞と将来衝突しないようにするため
function parseCalendarPatterns(md, warn, categoryCodes) {
  const idx = md.indexOf('## 文書番号の体系');
  const body = idx >= 0 ? md.slice(idx) : '';
  const patterns = [];
  for (const line of body.split('\n')) {
    const m = line.match(/^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/);
    if (!m) continue;
    const col0 = m[1];
    if (!col0.includes('`')) continue; // ヘッダ行・区切り行
    const patStrs = [...col0.matchAll(/`([^`]+)`/g)].map(x => x[1]);
    if (!patStrs.length) { warn(`calendar.md の表の行をパースできなかった: ${line.trim()}`); continue; }
    for (const patStr of patStrs) {
      if (categoryCodes && /^[A-Z]{2}-NN$/.test(patStr)) {
        const pfx = patStr.slice(0, 2);
        if (categoryCodes.has(pfx)) {
          warn(`calendar.md の書式 "${patStr}" の接頭辞 "${pfx}" は分類コード（CATS[].id を大文字化したもの）と衝突している。管理番号（${pfx}-01 等）と紛らわしいので別の接頭辞にする`);
        }
      }
      const parsed = patternStrToRegex(patStr, warn);
      if (parsed) patterns.push(parsed);
    }
  }
  if (!patterns.length) warn('calendar.md の「文書番号の体系」表から書式を1件も抽出できなかった');
  return patterns;
}

/* ---------- W8: KPI 語のラベル・数値マッチング用ヘルパー ---------- */
/*
 * kpi.csv の指標名（name_ja/name_zh）を数語だけハードコードせず全件対象にする
 * （2 件の見落とし事故の再発防止。PR #223（差し戻し済み）・PR #222（マージ済み）参照）。
 * ラベルと数値の間には次の 2 種類の崩れが起こりうるため、両方を吸収してから
 * 基準値（target/current/prev）と突き合わせる：
 *   ① 表記ゆれ：同じ語の中で文字が簡体字・繁体字・異体字に入れ替わる
 *      （「稼働率」の「働」が「動」「动」になる等）。KPI_LABEL_CONFUSABLES に
 *      確認済みのグループを列挙し、ラベルの正規表現化（kpiLabelToRegexFrag）で
 *      その文字位置だけを文字クラスに展開する（他の文字は通常どおりリテラル）。
 *      name_ja と name_zh が同じ語の表記違いに過ぎない場合（稼働率/稼动率）は
 *      このグループ 1 つで両方を拾えるので、ラベル自体は name_ja／name_zh を
 *      別々に検索する（名前がそもそも異なる語のとき。例: 生産数／产量）
 *   ② 隣接の崩し：ラベルと数値の間にコロン・空白・括弧・助詞が挟まる
 *      （「稼働率（89.1%）」「稼働率は89.1%」「稼働率: 89.1%」等）。
 *      KPI_ADJACENCY_RE で吸収するが、無関係な数値まで拾わないよう長さの
 *      上限を設ける（{0,6}）
 * 単位（kpi.csv の unit 列。「個/件」のように複数ありうる）が数値の直後に
 * 続くことも要求し、的外れな数字（日付・番号など）を拾わないようにする
 * （誤検知を増やしすぎない、という制約への対応。実際に走らせて、単位を
 * 要求しない場合に増える warn が的外れかどうかを確認したうえでこの形にした）。
 */
const KPI_LABEL_CONFUSABLES = [
  ['働', '動', '动'], // 稼働率(ja) ⇔ 稼動率(異体) ⇔ 稼动率(zh 簡体)。PR #223 で実際に混同された
];
const KPI_CONFUSABLE_GROUP_OF = new Map();
for (const g of KPI_LABEL_CONFUSABLES) for (const ch of g) KPI_CONFUSABLE_GROUP_OF.set(ch, g);

function kpiLabelToRegexFrag(label) {
  let out = '';
  for (const ch of label) {
    const g = KPI_CONFUSABLE_GROUP_OF.get(ch);
    out += g ? `[${g.join('')}]` : escLit(ch);
  }
  return out;
}

// ラベルと数値の間に入りうる「隣接の崩し」。全角コロン・半角コロン・読点・カンマ・
// 開き括弧（全角/半角）・強調のアスタリスク・助詞（は/の/が）・全角空白を許し、
// 上限 6 文字までとする（際限なく離れた無関係の数値を拾わないため）。
// 「を」は入れない：「稟議処理日数を 1 日程度短縮」のように、その指標を目的語に
// とって差分・改善量を述べる言い回しでほぼ使われ、実際の値の記述では使われて
// いなかった（誤検知になることを実測で確認したため除外。fin/rs.js 相当の記述）
const KPI_ADJACENCY_RE = '[\\s\\u3000：:、，,（(*はのが]{0,6}';

function kpiUnitToRegexFrag(unit) {
  const alts = (unit || '').split('/').map(u => u.trim()).filter(Boolean).map(escLit);
  return alts.length ? `(?:${alts.join('|')})` : '';
}

// ラベル・単位から W8 の候補抽出用正規表現を組み立てる。数値は 3 桁区切りカンマ・
// 小数を許容し、直後（空白・アスタリスクのみ挟んでよい）に単位が続くことを要求する
function buildKpiValueRegex(label, unit) {
  const labelFrag = kpiLabelToRegexFrag(label);
  const unitFrag = kpiUnitToRegexFrag(unit);
  return new RegExp(`${labelFrag}${KPI_ADJACENCY_RE}\\**([0-9][0-9,]*(?:\\.[0-9]+)?)\\**\\s?${unitFrag}`, 'g');
}

// W6 の候補抽出（mfg/fin/both で共用）。候補抽出：末尾セグメントが 1 文字のものも拾う
// （`{2,4}` → `{1,4}`。Issue #133 コメント2。`C-2509-A` のような `-A` 1 文字セグメントを
// 見落とさないため）。境界は `\b` ではなく否定先読み／後読みにする：
// `VST-2026-021_v3_ja.pdf` のようなアンダースコア結合のファイル名で `\b` がバックトラックし、
// `VST-2026` のように途中で切り詰められた偽の候補を拾ってしまうのを防ぐ
const CANDIDATE_RE = /(?<![A-Za-z0-9_])[A-Z]{1,4}(?:-[A-Za-z0-9]{1,4}){1,3}(?![A-Za-z0-9_-])/g;

/* ---------- 走査対象の準備（全体を 1 回だけ読み、業種ごとに振り分ける） ---------- */
const mock = loadMock(ROOT);

// 分類コード（§2-11 の管理番号の接頭辞。CATS[].id を大文字化）。W6 の歯止め検査で使う
// （Issue #153 PR-1 §7-2）。現時点: KN RS CV FA QA DC LG NM EN GN PT PO EG
const categoryCodes = new Set((mock.data.CATS || []).map(c => (c.id || '').toUpperCase()).filter(Boolean));

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
  const m = pathStr.match(/\b([A-Z]{2}-\d+)\b/);
  return m ? m[1] : null;
}

// 管理番号（例 "KN-06"）→ SVCS の内部 id（例 "kn6"）。CLAUDE.md §2-11 の逆変換
// （内部 id を大文字化し通番を 2 桁ゼロ埋め＝順変換）の逆：接頭辞を小文字化し、
// 通番のゼロ埋めを解く（"06" → 6）。
function mgmtCodeToId(code) {
  const m = code.match(/^([A-Z]{2})-(\d+)$/);
  if (!m) return null;
  return m[1].toLowerCase() + String(parseInt(m[2], 10));
}

// SVCS[].id → SVCS エントリ。業種判定の正本（Issue #182）
const svcById = new Map((mock.data.SVCS || []).map(s => [s.id, s]));

// 管理番号 → 3 バケット（'mfg' | 'fin' | 'both'）。SVCS[].industries が正本。
// PM 指摘（Issue #182 やり直し）：両業種のサービスを「mfg と fin 両方の pass に入れる」と、
// 両方の world master に登録されていることを要求する形になってしまい、実態（両業種サービスの
// 実例は普通どちらか一方の世界の語彙で書かれる）と合わない。両業種のファイルは第 3 のバケット
// （both）にまとめ、mfg と fin の world master の和集合と突き合わせる
function bucketOf(code) {
  if (!code) return 'mfg'; // 不明なもの（コード自体が無い）は既定で mfg 扱い（従来どおりの検査対象）
  const svc = svcById.get(mgmtCodeToId(code) || '');
  // SVCS に無い管理番号（欠番・将来の追加・README.md/_TEMPLATE.md のような番号を
  // 含まないファイル等）も従来どおり既定で mfg 扱いにする（走査対象から漏らさないため）
  if (!svc) return 'mfg';
  const inds = svc.industries || [];
  if (inds.includes('mfg') && inds.includes('fin')) return 'both';
  if (inds.includes('fin')) return 'fin';
  return 'mfg';
}

const kbFiles = walkFiles(resolve(ROOT, 'dify/kb'), ['.md'])
  .map(p => ({ src: p.replace(ROOT + '/', ''), text: readFileSync(p, 'utf8') }));
const usecaseFiles = walkFiles(resolve(ROOT, 'docs/dify/usecases'), ['.md'])
  .map(p => ({ src: p.replace(ROOT + '/', ''), text: readFileSync(p, 'utf8') }));
const testFiles = walkFiles(resolve(ROOT, 'dify/tests'), ['.json'])
  .map(p => ({ src: p.replace(ROOT + '/', ''), text: readFileSync(p, 'utf8') }));
// dify/samples/**（Issue #205。デモ投入用の入力サンプル）。dify/kb/**・dify/tests/**・
// docs/dify/usecases/** と同じ扱い（1 管理番号 1 ディレクトリ。build/ は生成物なので除外）
const sampleFiles = walkFiles(resolve(ROOT, 'dify/samples'), ['.md'])
  .filter(p => !p.replace(ROOT + '/', '').startsWith('dify/samples/build/'))
  .map(p => ({ src: p.replace(ROOT + '/', ''), text: readFileSync(p, 'utf8') }));
const allKbTestUsecaseFiles = [...kbFiles, ...usecaseFiles, ...testFiles, ...sampleFiles];

function filesForBucket(bucket) {
  return allKbTestUsecaseFiles.filter(f => bucketOf(extractCode(f.src)) === bucket);
}

// mfg/fin バケットの走査対象。both バケットの kb/tests/usecases はここには含めない
// （both バケットで一度だけ、和集合の world master と突き合わせて検査する。Issue #182）
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
  const others = filesForBucket(ind).map(f => ({ src: f.src, text: f.text }));
  return { texts: [...nonScenario, ...scenarioOnly, ...others] };
}

// mfg/fin それぞれの解析済みデータ（calendar.md の regex・documents.csv の doc_id・
// products/equipment の集合）を both バケットが再利用するためのキャッシュ。
// calendar.md の再パースを避けることで、パース警告（未知のプレースホルダ等）が
// both バケットでも二重に report() されるのを防ぐ
const worldCache = {};

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
  const documents = readCSV(dir, 'documents.csv'); // PR-2 で新設。無ければ常に []（readCSV が existsSync で吸収）
  const docIds = new Set(documents.map(d => d.doc_id).filter(Boolean));

  // 品番・設備の接頭辞（W6 の除外・W7 の候補抽出で共用）。ハードコードせず products.csv の
  // part_no と equipment.csv の equip_id の先頭セグメント（'-' より前）から組み立てる
  // （Issue #153 PR-1 §5-3）。マスタに新しい接頭辞（例: HT）が増えれば自動で反映される
  const partPrefixes = new Set([
    ...products.map(p => (p.part_no || '').split('-')[0]),
    ...equipment.map(e => (e.equip_id || '').split('-')[0]),
  ].filter(Boolean));
  // both バケット（W7 の和集合）で使うため、fin でも knownParts/knownEquip は計算しておく
  // （fin 側の W7 セクション自体は従来どおり skip のまま。§7-2）
  const knownParts = new Set(products.map(p => p.part_no));
  const knownEquip = new Set(equipment.map(e => e.equip_id));

  const { texts } = scanTextsFor(ind);
  const allText = texts.map(f => f.text).join('\n');
  // 台本本体（mock/js/data 配下）だけのテキスト。W4（社名）・W5（取引先記号）は
  // 台本ベースの実測と突き合わせるため、こちらを使う
  const mockOnlyText = texts.filter(f => f.src.startsWith('js/data/')).map(f => f.text).join('\n');

  const { data } = mock;

  // SCENARIOS は業種切替（#120）で SCENARIOS[業種][svcId] の 2 階層になっている
  // （mock/js/data/scenarios/<業種>/<分類>.js が window.SCENARIOS[業種] に直接登録する。
  // Issue #133 コメント2）。台本ファイルの置き場所そのものが業種の正なので、
  // id の先頭コードによる推定（旧 scenarioIdCode/codeBelongsTo）は不要。
  function scenariosFor() {
    return (data.SCENARIOS && data.SCENARIOS[ind]) || {};
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
  section(`[${ind}] W2. 役職：台本の役職が people.csv（主務＋兼務）に登録されているか`);
  {
    // 役職の正本は people.csv。台本の persona.role は、主務（title_*）または
    // 兼務（alt_title_*。`;` 区切りで複数、3 列とも同じ順序）のいずれかと
    // 3 言語すべて一致すること（Issue #153 PR-3 §6-2・§7-3）。
    // alt_title_* 列が無い CSV（列は用意されているが値が無い行を含む）でも
    // 空として扱われるため、そのまま動く（後方互換）。
    const rolesByName = new Map(); // name_ja → Array<{ja,zh,en}>
    for (const p of people) {
      if (!p.name_ja) continue;
      const set = [];
      if (p.title_ja || p.title_zh || p.title_en) {
        set.push({ ja: p.title_ja || '', zh: p.title_zh || '', en: p.title_en || '' });
      }
      const altJa = (p.alt_title_ja || '').split(';').filter(Boolean);
      const altZh = (p.alt_title_zh || '').split(';').filter(Boolean);
      const altEn = (p.alt_title_en || '').split(';').filter(Boolean);
      const n = Math.max(altJa.length, altZh.length, altEn.length);
      for (let i = 0; i < n; i++) {
        set.push({ ja: altJa[i] || '', zh: altZh[i] || '', en: altEn[i] || '' });
      }
      rolesByName.set(p.name_ja, set);
    }

    // warn は人物ごとに 1 件（メッセージ中に未登録の役職を列挙する。§7-3）
    const unregisteredByName = new Map(); // name_ja → Map(role_ja → ids[])
    for (const id in scenarios) {
      const p = scenarios[id].persona;
      if (!p || !p.name || !p.role) continue;
      const key = p.name.ja;
      const registered = rolesByName.get(key) || [];
      const matched = registered.some(r => r.ja === p.role.ja && r.zh === p.role.zh && r.en === p.role.en);
      if (!matched) {
        if (!unregisteredByName.has(key)) unregisteredByName.set(key, new Map());
        const roles = unregisteredByName.get(key);
        if (!roles.has(p.role.ja)) roles.set(p.role.ja, []);
        roles.get(p.role.ja).push(id);
      }
    }
    let n = 0;
    for (const [name, roles] of unregisteredByName) {
      n++;
      const detail = [...roles.entries()].map(([role, ids]) => `${role}（${ids.join(',')}）`).join(' / ');
      report(`未登録の役職: ${name} — ${detail}`);
    }
    if (!n) ok('台本の役職はすべて people.csv（主務＋兼務）に登録済み');
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
  section(`[${ind}] W6. 文書番号：calendar.md の体系に合わない書式・未登録の接頭辞`);
  let w6Result; // both バケットに渡す（再パース不要）
  {
    // knownPatterns は calendar.md の「文書番号の体系」表から組み立てる（ハードコードしない。
    // Issue #133）。パース規則は parseCalendarPatterns() 付近のコメントを参照
    const parsed = parseCalendarPatterns(calendarMd, (msg) => report(msg), categoryCodes);
    const knownPatterns = parsed.map(p => p.re);
    // calendar.md に登録済みの単独英字接頭辞（現状 mfg の `C` のみ）。単独英字＋数字は
    // 大半が文書番号ではなく、金型・アラーム・様式番号などの別体系（下記 note 参照）なので、
    // 未登録として warn するのはこの許可集合に無いものだけに絞る
    const singleCharPrefixes = new Set(parsed.filter(p => p.prefix.length === 1).map(p => p.prefix));
    w6Result = { knownPatterns, singleCharPrefixes, docIds, partPrefixes };

    // 台本 JS ファイルのブロックコメント（ファイル冒頭の設計メタ情報）は架空世界の文書番号ではなく
    // 実際の設計 PR ラベル（例: `PR-4a`）を参照することがあるため、W6 の走査対象からは除く
    const w6Text = texts
      .map(f => (f.src && f.src.endsWith('.js')) ? f.text.replace(/\/\*[\s\S]*?\*\//g, '') : f.text)
      .join('\n');

    const candidates = new Set(w6Text.match(CANDIDATE_RE) || []);
    // 判定順序（Issue #153 PR-1 §7-2。正本の明示的な登録がツールの一般則より優先）：
    //   ① 数字を含まない → 対象外
    //   ② calendar.md の書式に一致 → OK（正本が明示的に宣言した書式を最優先。CM-NN/QC-NN 等）
    //   ③ documents.csv の doc_id に実在 → OK（規程・社内 ID の台帳。PR-2 で新設。無ければ常にスキップ）
    //   ④ 管理番号形式 ^[A-Z]{2}-\d{1,2}$ → 対象外（§2-11 の管理番号／PT-3・PT-8 のような
    //      1 桁の PM 決定ラベルも拾わないよう \d{2} ではなく \d{1,2} にしている）
    //   ⑤ 品番・設備接頭辞（products.csv/equipment.csv 由来） → 対象外（W7 の管轄）
    //   ⑥ 単独英字で calendar.md 未登録 → 対象外（金型・アラーム・様式の別体系）
    //   ⑦ それ以外 → warn
    const unknownList = [];
    for (const c of candidates) {
      if (!/\d/.test(c)) continue; // ①
      if (knownPatterns.some(re => re.test(c))) continue; // ②
      if (docIds.has(c)) continue; // ③
      if (/^[A-Z]{2}-\d{1,2}$/.test(c)) continue; // ④
      const prefix = c.split('-')[0];
      if (partPrefixes.has(prefix)) continue; // ⑤
      if (prefix.length === 1 && !singleCharPrefixes.has(prefix)) continue; // ⑥
      unknownList.push(c); // ⑦
    }
    reportMany('calendar.md のどの書式にも一致しない文書番号らしき文字列（未登録の接頭辞の可能性）', unknownList);
    if (!unknownList.length) ok('文書番号は calendar.md の体系に一致（該当なしを含む）');
  }

  /* ---------------------------------------------------------- */
  if (ind === 'mfg') {
    section(`[${ind}] W7. 品番・設備：products.csv / equipment.csv に無いコード。管理番号形式との衝突`);
    // 候補の接頭辞はハードコードせず partPrefixes（products.csv/equipment.csv 由来）から組み立てる
    // （Issue #153 PR-1 §5-3）。長い接頭辞を先に試す（DO と D のように前方一致するものがあるため）
    const prefixAlt = [...partPrefixes].sort((a, b) => b.length - a.length).map(escLit).join('|');
    const candidateRe = prefixAlt ? new RegExp(`\\b(${prefixAlt})-[A-Za-z0-9]{2,5}(-[A-Za-z0-9]+)?\\b`, 'g') : null;
    const candidates = new Set(candidateRe ? (allText.match(candidateRe) || []) : []);
    const unknownList = [];
    for (const c of candidates) {
      if (knownParts.has(c) || knownEquip.has(c)) continue;
      const base = c.replace(/-[A-Z]$/, '');
      if (knownParts.has(base) || knownEquip.has(base)) continue;
      unknownList.push(c);
    }
    reportMany('products.csv / equipment.csv に無いコード', unknownList);
    if (!unknownList.length) ok('品番・設備コードはすべて登録済み');

    const mgmtLike = new Set((allText.match(/\b[A-Z]{2}-\d{2}\b/g) || []).filter(c => !/^(RG|CL|WS|CM|QC|QR)-/.test(c)));
    if (mgmtLike.size) console.log(`   参考: 管理番号形式（[A-Z]{2}-\\d{2}）と同じ見た目のコード ${mgmtLike.size} 種（うち SVCS 管理番号と紛らわしいものは data/world/README.md の「未統一」#4 を参照）`);
  } else {
    section(`[${ind}] W7. 品番・設備：金融は設備マスタを持たないため skip`);
    ok('金融は equipment.csv を置かない設計（設計書 §7-2）。products.csv（取扱商品）は W1〜W6 と別軸のため単体チェックなし');
  }

  /* ---------------------------------------------------------- */
  section(`[${ind}] W8. KPI：kpi.csv の値と一致しない指標`);
  {
    // kpi.csv の全行を対象にする（従来は不良率・稼働率／延滞率のみのハードコードで、
    // それ以外の指標語・表記ゆれ・隣接の崩しは素通りしていた）
    let anyLabel = false;
    let anyMismatch = false;
    for (const row of kpi) {
      const labels = [...new Set([row.name_ja, row.name_zh].filter(Boolean))];
      if (!labels.length) continue;
      anyLabel = true;
      const known = new Set(
        [row.target, row.current, row.prev]
          .map(v => (v || '').trim())
          .filter(v => /^[0-9]+(?:\.[0-9]+)?$/.test(v.replace(/,/g, '')))
          .map(v => v.replace(/,/g, ''))
      );
      const found = new Set();
      for (const label of labels) {
        for (const m of allText.matchAll(buildKpiValueRegex(label, row.unit))) {
          found.add(m[1].replace(/,/g, ''));
        }
      }
      const mismatch = [...found].filter(v => !known.has(v));
      if (mismatch.length) {
        anyMismatch = true;
        const unitSuffix = row.unit ? row.unit.split('/')[0] : '';
        report(`${row.name_ja || row.name_zh}: kpi.csv の基準値（${[...known].join('/') || '未設定'}）と一致しない値 ${mismatch.join('、')}${unitSuffix}`);
      }
    }
    if (!anyLabel) ok('kpi.csv に検査対象の指標が無い');
    else if (!anyMismatch) ok('KPI の値は kpi.csv の基準値と一致（該当なしを含む）');
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

  worldCache[ind] = { ...w6Result, knownParts, knownEquip };
}

/* ============================================================ */
// both バケット（industries: ['mfg','fin'] のサービスの kb/tests/usecases）。
// PM 指摘（Issue #182 やり直し）のとおり、mfg/fin 個別ではなく mfg と fin の world master の
// 和集合と突き合わせる。台本（SCENARIOS）や台本本体テキスト（mock/js/data）を入力に使う検査
// （W1〜W5・W9）と、業種ごとに基準値の体系が違う検査（W8）は対象データが無い／和集合にすると
// 意味が薄れるため skip し、その理由を必ず出力する
function runBothChecks() {
  currentInd = 'both';
  const bothFiles = filesForBucket('both');
  const bothTexts = bothFiles.map(f => ({ src: f.src, text: f.text }));
  const allText = bothTexts.map(f => f.text).join('\n');

  section('[both] W1. 人名：業種横断バケットは台本（SCENARIOS）を持たないため skip');
  skip('台本は常に scenarios/mfg または scenarios/fin のどちらかのディレクトリに属し（両業種サービスも mfg 用・fin 用それぞれの実例が別々に存在する）、both バケット自体には台本が無い。人名検査の対象データが無い');

  section('[both] W2. 役職：業種横断バケットは台本を持たないため skip');
  skip('W1 と同じ理由（台本を持たない）');

  section('[both] W3. 拠点：業種横断バケットは台本を持たないため skip');
  skip('W1 と同じ理由（台本を持たない）');

  section('[both] W4. 社名：業種横断バケットは台本本体（mock/js/data）を持たないため skip');
  skip('社名の出現回数チェックは台本本体（mock/js/data 配下）のテキストが入力で、both バケット（kb/tests/usecases）にはその入力が無い。加えて mfg/fin で社名自体が異なるため、和集合にしても比較対象を一意に決められない');

  section('[both] W5. 取引先記号：業種横断バケットは台本本体（mock/js/data）を持たないため skip');
  skip('W4 と同じ理由（台本本体テキストが入力で、both バケットにはその入力が無い）');

  section('[both] W6. 文書番号：mfg と fin の calendar.md 書式・documents.csv の和集合で判定');
  {
    const m = worldCache.mfg, f = worldCache.fin;
    const knownPatterns = [...m.knownPatterns, ...f.knownPatterns];
    const singleCharPrefixes = new Set([...m.singleCharPrefixes, ...f.singleCharPrefixes]);
    const docIds = new Set([...m.docIds, ...f.docIds]);
    const partPrefixes = new Set([...m.partPrefixes, ...f.partPrefixes]);

    const w6Text = bothTexts
      .map(t => (t.src && t.src.endsWith('.js')) ? t.text.replace(/\/\*[\s\S]*?\*\//g, '') : t.text)
      .join('\n');
    const candidates = new Set(w6Text.match(CANDIDATE_RE) || []);
    const unknownList = [];
    for (const c of candidates) {
      if (!/\d/.test(c)) continue;
      if (knownPatterns.some(re => re.test(c))) continue;
      if (docIds.has(c)) continue;
      if (/^[A-Z]{2}-\d{1,2}$/.test(c)) continue;
      const prefix = c.split('-')[0];
      if (partPrefixes.has(prefix)) continue;
      if (prefix.length === 1 && !singleCharPrefixes.has(prefix)) continue;
      unknownList.push(c);
    }
    reportMany('mfg・fin いずれの calendar.md の書式にも documents.csv にも一致しない文書番号らしき文字列（和集合で判定）', unknownList);
    if (!unknownList.length) ok('文書番号は mfg・fin いずれかの calendar.md／documents.csv の体系に一致（該当なしを含む）');
  }

  section('[both] W7. 品番・設備：mfg と fin の products.csv / equipment.csv の和集合で判定');
  {
    const m = worldCache.mfg, f = worldCache.fin;
    const knownParts = new Set([...m.knownParts, ...f.knownParts]);
    const knownEquip = new Set([...m.knownEquip, ...f.knownEquip]); // fin は equipment.csv を持たないため常に空集合
    const partPrefixes = new Set([...m.partPrefixes, ...f.partPrefixes]);
    const prefixAlt = [...partPrefixes].sort((a, b) => b.length - a.length).map(escLit).join('|');
    const candidateRe = prefixAlt ? new RegExp(`\\b(${prefixAlt})-[A-Za-z0-9]{2,5}(-[A-Za-z0-9]+)?\\b`, 'g') : null;
    const candidates = new Set(candidateRe ? (allText.match(candidateRe) || []) : []);
    const unknownList = [];
    for (const c of candidates) {
      if (knownParts.has(c) || knownEquip.has(c)) continue;
      const base = c.replace(/-[A-Z]$/, '');
      if (knownParts.has(base) || knownEquip.has(base)) continue;
      unknownList.push(c);
    }
    reportMany('products.csv / equipment.csv に無いコード（mfg・fin の和集合で判定）', unknownList);
    if (!unknownList.length) ok('品番・設備コードはすべて mfg・fin いずれかに登録済み（該当なしを含む）');
  }

  section('[both] W8. KPI：業種横断は基準値の比較対象を一意に決められないため skip');
  skip('KPI は mfg（不良率・稼働率・生産数など）と fin（延滞率・貸出残高など）で指標体系そのものが異なり、和集合にすると意味が薄れる');

  section('[both] W9. カバレッジ：業種横断は「どちらの people.csv と比較するか」を一意に決められないため skip');
  skip('people.csv は mfg/fin で別々の人物台帳であり、both バケットの狭いテキスト量に和集合の人物リストを当てると大半が「未出現」と誤検出される。各業種本来のカバレッジは mfg/fin 側の W9 で検査済み');
}

for (const ind of ['mfg', 'fin']) runIndustryChecks(ind);
runBothChecks();

/* ---------- 結果 ---------- */
const total = warnCounts.mfg + warnCounts.fin + warnCounts.both;
console.log(`\n製造業（mfg）: ${warnCounts.mfg} 件 ／ 金融（fin）: ${warnCounts.fin} 件 ／ 業種横断（both）: ${warnCounts.both} 件 ／ 合計 ${total} 件`);
console.log(`${total ? `⚠️  合計 ${total} 件の食い違いを報告` : '✅ 食い違いなし'}（このツールは報告のみ。CI には入れない）`);
process.exit(strict && total ? 1 : 0);
