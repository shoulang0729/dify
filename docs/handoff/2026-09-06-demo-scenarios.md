# 顧客版カタログ B：担当者シナリオとデモ遷移 設計書

- 日付：2026-09-06
- 作成：architect
- レーン：**M/L**（`state.view` の値追加・`data-act` 追加・`T` キー追加・新データ `SCENARIOS`・CSS 追加。§2-1 / §2-3 に触る → §9 で PM 承認を求める）
- 対象：`mock/catalog.html`、`tools/verify.mjs`（検証の拡張のみ）、`tools/regress.baseline.json`
- 前提：**A（`2026-09-06-customer-catalog-data.md`）がマージ済み**。本書のサービス id（`kn1`…`gn5`）は A の id
- Issue 下書き：`docs/handoff/demo-scenarios.issue.md`

---

## 0. 目的 / 背景

現状の遷移は「一覧 → 詳細 → チャット（汎用モック返答）」で、どのサービスを開いても同じ返事が返る。顧客デモでは**担当者が自分の業務として想像できる**ことが要るので、

1. 各サービスに **担当者ペルソナ** と **利用シナリオ（3〜6 手順）** を持たせ、詳細画面に表示する
2. サービスごとに **画面遷移テンプレート**（5 種）を割り当て、「利用開始」で**そのテンプレートのデモ画面**を開く
3. デモ画面では **台本（ja / zh 各 3 往復）** に沿って、質問例チップのクリック or 自由入力で会話が進む

を実現する。§2-3 の共通レイヤー契約は壊さず、**`state.view` に `'demo'` を増やし、`state` にキーを 1 つ足し、`data-act` を 3 つ足す**形で乗せる。

PM 判断済み事項（前提）：

- エージェント本体（台本）は **ja / zh の 2 言語**。en 台本は作らない（§2-5：言語切替はメニュー表示のみ）。メニュー側の文言（テンプレート名・ペルソナの役職・手順・UI ラベル）は **3 言語**。
- テンプレートは 3〜5 種。本書は **5 種**を推奨（§8 P-1 で 4 種案も提示）。
- 会話内容は実在企業名・実在製品名を使わない。数字・部品番号・手順は具体的に。

---

## 1. 変更する範囲

| ファイル | 箇所 | 変更 |
|---|---|---|
| `mock/catalog.html` | `T` | UI キー **22 個追加**（§4-1）。既存キーは変えない |
| `mock/catalog.html` | `SVCS` の直後 | 新定数 **`TEMPLATES`**（5 種の名称辞書）と **`SCENARIOS`**（サービス id → シナリオ）を追加（§3） |
| `mock/catalog.html` | `state` | キー **`log: []`** を追加（§2-2）。既存キーは変えない |
| `mock/catalog.html` | ヘルパー | `scnOf(id)` / `scriptLang(l)` / `nextTurn(scn)` を追加（§2-4） |
| `mock/catalog.html` | `renderMain` | `detail` 分岐にペルソナ・手順・画面タイプの表示を追加。`view === 'demo'` の分岐を追加（§2-5, §3） |
| `mock/catalog.html` | `sendChat` | `view === 'demo'` のとき台本から返す（§2-4）。`chat` view の挙動は不変 |
| `mock/catalog.html` | click ハンドラ | `start` の分岐追加、`run` / `chip` / `restart` を追加（§2-3） |
| `mock/catalog.html` | 2 つ目の `<style>` | `.demo-*` `.panel*` `.chip*` `.persona*` `.steps` `.tpl-badge` 等を追加（§5）。**トークンのみ**、直値なし |
| `tools/verify.mjs` | §7 共通レイヤー契約 | `requiredActs` に `run` `chip` `restart` を追加。**新設 §9 シナリオ整合**（§6-2） |
| `tools/regress.baseline.json` | — | `T` キー追加に伴い `--update`（`counts.ui: 27 → 49`） |
| `mock/README.md` | A 行 | 「一覧 → 詳細 → チャット起動」→「一覧 → 詳細（ペルソナ・シナリオ）→ 業務デモ（5 テンプレート）」 |

### 1-1. 触らない範囲（reviewer の diff 監査基準）

- `CATS` / `SVCS` / `TAGS` / `PATTERNS`（A で確定したデータ。**`SVCS[].scenario` のようなフィールドも足さない**。シナリオは別定数 `SCENARIOS`）
- `state` の既存 10 キーとその意味。`view` の既存値 `list` / `detail` / `chat` の挙動
- 既存 `data-act`（`pattern` `all` `cat` `sub` `svc` `back` `backdetail` `start` `send`）の**ハンドラの意味**（`start` は分岐が 1 つ増えるだけ。`chat` へのフォールバックは残す）
- `renderSidebar` / `renderSeg` / `renderChrome` / `cardHTML` / `gridHTML` / `filtered` / `detectLang` / `L` / `t` / `tag`
- `T` の既存 27 キーの値
- 1 つ目の `<style>`（トークン）。`--ntt-*` 不変。dark 用トークンの**追加もしない**（既存セマンティックトークンだけで描く）
- `.mockbar` / 言語・テーマ切替 / `localStorage` キー
- `tools/regress.mjs` のロジック（baseline の更新のみ）
- `.github/workflows/pages.yml` / `mock/.nojekyll` / `mock/top.html` / `mock/index.html`

---

## 2. 全体設計

### 2-1. 画面遷移（全体）

```
 list ──svc──▶ detail ──start──▶ demo (log=[])  ──run/chip/send──▶ demo (log=[t0])  ──chip/send──▶ … ──▶ demo (台本尽きた)
  ▲              │  ▲                │                                                                       │
  └────back──────┘  └──backdetail────┴───────────────────────────────────────────────────────────────────────┘
                                                            ▲
                    detail ──start（SCENARIOS に無い id）──▶ chat（従来どおり。汎用モック返答）
                                                            └──backdetail──▶ detail

 demo 内:  restart ──▶ demo (log=[])
 言語切替（lang-select）: renderAll() → demo は state.log から会話を復元して再描画（進捗は保持）
```

- `svc` を押した時点で `state.log = []`（別サービスの会話が残らない）。`start` でも `[]` にする。
- `backdetail` では `log` を**消さない**（詳細を見てからデモに戻れる）。`start` で消える。

### 2-2. `state` の追加

```js
const state = {
  pattern: 'nav', lang: 'ja', theme: 'light',
  openCats: { kn: true }, selCat: null, selSub: null, lastCat: 'kn',
  selSvc: null,
  view: 'list',          // 'list' | 'detail' | 'chat' | 'demo'   ← 'demo' を追加
  query: '',
  log: []                // ← 追加。デモで消費した台本ターン [{ lang: 'ja'|'zh', q: string, a: string }]
};
```

- `log.length` が「次に消費する台本の index」。`log` があれば言語切替後の再描画で会話を復元できるので、`step` のような別カウンタは持たない。
- `log[i].lang` はその往復の**入力言語**（チップ or `detectLang`）。返答 `a` も同じ言語。
- verify の必須キー 10 個はそのまま。`log` は追加キー。

### 2-3. `data-act` の追加（3 つ）と `start` の分岐

| act | arg | 挙動 |
|---|---|---|
| `start`（既存） | — | `scnOf(state.selSvc)` が**あれば** `state.log = []; state.view = 'demo'`、**なければ**従来どおり `state.view = 'chat'`。`renderMain()` |
| `run` | — | テンプレート `upload` / `form` / `diff` / `lookup` の入力パネルの実行ボタン。`log.length === 0` のときだけ有効。`consume(scriptLang(state.lang))`（台本 0 番目を消費）→ `renderMain()` |
| `chip` | `'ja'` or `'zh'` | 質問例チップ。`consume(arg)` → `renderMain()` |
| `restart` | — | `state.log = []` → `renderMain()` |
| `send`（既存） | — | `sendChat()`。`view === 'demo'` のときは台本から返す（§2-4）。`view === 'chat'` のときは従来の汎用返答 |

**`consume(lang, qOverride?)`**：`scn.script[lang][state.log.length]` を取り出し、`{ lang, q: qOverride ?? turn.q, a: turn.a }` を `log` に push する。台本が尽きていれば何もしない（呼び出し側が判断）。

### 2-4. ヘルパー追加

```js
const scnOf = (id) => SCENARIOS[id] || null;
/** 台本は ja / zh のみ。UI が en のときは ja の台本を使う（§2-5：エージェント本体は日中） */
const scriptLang = (l) => (l === 'zh' ? 'zh' : 'ja');
/** 次に消費する台本ターン（尽きていれば null） */
const nextTurn = (scn, lang) => scn.script[lang][state.log.length] || null;

function consume(lang, qOverride) {
  const scn = scnOf(state.selSvc); if (!scn) return false;
  const turn = nextTurn(scn, lang); if (!turn) return false;
  state.log.push({ lang, q: qOverride ?? turn.q, a: turn.a });
  return true;
}
```

`sendChat()` の変更（`chat` view の分岐は**そのまま**）：

```js
function sendChat() {
  const input = document.getElementById('chat-input');
  const v = input.value.trim(); if (!v) return;
  const x = svcOf(state.selSvc);
  const lang = detectLang(v);                    // 既存：返答は入力言語に合わせる
  if (state.view === 'demo') {
    const sl = scriptLang(lang);
    input.value = '';
    if (consume(sl, v)) { renderMain(); return; }        // 台本があれば台本の a を返す（q は入力文で置換）
    addMsg('user', v);                                    // 台本が尽きたら従来の汎用返答
    setTimeout(() => addMsg('agent', T.chatReply[sl].replace('{name}', x.name[sl])), 700);
    return;
  }
  /* --- 以下は既存のまま --- */
  addMsg('user', v); input.value = '';
  setTimeout(() => addMsg('agent', T.chatReply[lang].replace('{name}', x.name[lang])), 700);
}
```

- `demo` の `renderMain()` は `log` を先頭から `addMsg` で復元する。ユーザー発話の直後に返答を出す演出（700ms 遅延）は、**最後の 1 ターンだけ** `setTimeout` で遅らせ、それ以前は即時描画する（言語切替時の復元がチカチカしない）。
- `detectLang` が `en` を返した（かな・漢字を含まない入力）場合も `scriptLang` で `ja` に寄せる。en 台本は存在しない。

### 2-5. `detail` view への追加

既存の `.detail-card` の `.d-desc` と `.cta-row` の間に 3 ブロックを挿入する（シナリオが無いサービスでは 3 ブロックとも出さない。CTA 文言も従来の `startUse`）。

```
┌ detail-card ──────────────────────────────────────────────────────┐
│ ナレッジ検索・問い合わせ・技術・設備ナレッジ                        │
│ 技術ナレッジQA                                                    │
│ [提供中] [検索]                                                    │
│ ━━                                                                │
│ 概要                                                              │
│ 過去の設計書・工程条件・…（既存 desc）                              │
│                                                                   │
│ 担当者                                   画面タイプ                │  ← 新規
│ ┌──────────────────────────────┐        ┌──────────────┐          │
│ │ (王) 王 磊                    │        │ QAチャット型  │          │
│ │ 生産技術課 主任 ／ 蘇州工場    │        └──────────────┘          │
│ │ 母語：中国語                  │                                  │
│ └──────────────────────────────┘                                  │
│                                                                   │
│ 利用シナリオ                                                      │  ← 新規
│  1. 現場で異音が出た設備の型式と症状を入力                          │
│  2. 過去の対応記録と推奨条件が根拠付きで返る                        │
│  3. …                                                             │
│                                                                   │
│ [ デモを見る ]  ※ 本画面はコンセプト確認用のモックです               │  ← CTA 文言を startDemo に
└───────────────────────────────────────────────────────────────────┘
```

- 担当者カード：アバター（`name` の 1 文字目、既存 `.avatar` と同じトークン）＋ `L(persona.name)` ＋ `L(persona.role)` ／ `L(persona.site)` ＋ `t('nativeLabel')` `t(native === 'ja' ? 'nativeJa' : 'nativeZh')`
- 画面タイプ：`.tpl-badge` に `L(TEMPLATES[scn.template].name)`。バッジの色は `--badge-trial-bg/fg`（既存トークン。テンプレート種別ごとに色は**変えない**）
- 利用シナリオ：`<ol class="steps">` に `scn.steps[state.lang]`（3 言語ある）

### 2-6. デモ画面（`view === 'demo'`）の共通骨格

```
┌ demo-wrap（main を縦いっぱい） ─────────────────────────────────────────────────┐
│ chat-hdr: ‹ 詳細へ戻る │ 技術ナレッジQA  [QAチャット型]  (王) 王 磊・蘇州工場   ●提供中 [最初から] │
├──────────────────────────────┬──────────────────────────────────────────────────┤
│ work-pane（qa 型では非表示）    │ chat-pane                                          │
│ ┌ panel: 入力 ─────────────┐  │ ┌ msgs ─────────────────────────────────────────┐ │
│ │ (テンプレートごとの入力UI)  │  │ │ [agent] こんにちは。「…」エージェントです…       │ │
│ │              [ 実行 ]     │  │ │                      [user] 不良報告_0905.xlsx ▶ │ │
│ └──────────────────────────┘  │ │ [agent] 解析しました。…                          │ │
│ ┌ panel: 結果（log≥1 で出る）┐  │ └───────────────────────────────────────────────┘ │
│ │ タイトル                   │  │ 次の質問例:  [日 ▸ 是正処置は妥当？] [中 ▸ 纠正措施…] │ ← chips
│ │ k: v / k: v / 表 …         │  │ ┌──────────────────────────────────┐ [送信]      │
│ └──────────────────────────┘  │ │ メッセージを入力（日本語・中文どちらでも） │            │
│                              │ └──────────────────────────────────┘            │
└──────────────────────────────┴──────────────────────────────────────────────────┘
```

- 寸法：`work-pane` は `flex: 0 0 46%; min-width: 360px; max-width: 560px; overflow-y: auto; border-right: 1px solid var(--border-subtle); padding: var(--space-5) var(--space-6)`。`chat-pane` は `flex: 1; min-width: 0; display: flex; flex-direction: column`（既存 `.chat-wrap` と同じ縦構成）。`main` の幅が 900px 未満なら `demo-body` を `flex-direction: column` に（`@media (max-width: 1180px)`：sidebar 264px 込み）。
- `qa` 型は `work-pane` を描かず `chat-pane` が全幅（既存チャットと同じ見え方 ＋ チップ）。
- **チップ**（`.chips`）：`nextTurn(scn,'ja')` と `nextTurn(scn,'zh')` を **両方**出す（`[日 ▸ …]` `[中 ▸ …]`）。入力言語が UI 言語と独立であること（§2-5）を、デモで見せるため。`upload/form/diff/lookup` 型で `log.length === 0` のときはチップを出さず、入力パネルの `[実行]` に誘導する（`t('runHint')` を chips の位置に表示）。台本が尽きたら `t('demoDone')` を表示（自由入力は引き続き可能・汎用返答）。
- **結果パネル**は `log.length >= 1` で表示。中身は `scn.result[lang0]`（`lang0 = log[0].lang`。実行時の言語で固定し、以降のチップ言語で切り替えない。言語切替（UI）でも固定。理由：結果は「その時生成された成果物」なので UI 言語に追従させない）。
- **入力パネル**は `log.length === 0` では編集可風（値は台本の既定値を入れて表示）、`log.length >= 1` では `disabled` 見せ（`opacity: .6`）にして「実行済み」を示す。実際の編集内容は使わない（モック）。
- 最初の agent 発話は既存 `chatHello`（`{name}` 置換）を流用。**言語は `scriptLang(state.lang)`**。

---

## 3. データ構造

### 3-1. 型（implementer 向け。JSDoc として `SCENARIOS` 直前に貼る）

```ts
type ML3 = { ja: string; zh: string; en: string };           // メニュー側：3 言語必須（§2-1）
type Turn = { q: string; a: string };                        // 台本 1 往復（担当者の入力 → エージェントの返答）
type Template = 'qa' | 'upload' | 'form' | 'diff' | 'lookup';

type Input = {                        // テンプレートごとに使うキーが決まる（他は無視）
  files?:  string[];                  // upload : 添付ファイル名（表示のみ）
  fields?: { label: string; value: string }[];   // form : 入力欄（label と既定値）
  left?:   string; right?: string;    // diff   : 比較する 2 版のラベル
  query?:  string;                    // lookup : 照会キー（既定値）
};
type Result = {                       // 結果パネル。items か columns+rows のどちらか一方
  title: string;
  items?:   { k: string; v: string }[];          // 見出し＋本文の縦積み（8D の各 D、報告書の章、KV 表）
  columns?: string[]; rows?: string[][];         // 表（比較表・照会結果・差分一覧）
};

type Scenario = {
  template: Template;
  persona: { name: ML3; role: ML3; site: ML3; native: 'ja' | 'zh' };
  steps:   { ja: string[]; zh: string[]; en: string[] };    // 利用シナリオ 3〜6 手順。3 言語同じ長さ
  input?:  { ja: Input;  zh: Input  };                      // qa 型では省略
  result?: { ja: Result; zh: Result };                      // qa 型では省略
  script:  { ja: Turn[]; zh: Turn[] };                      // 3 往復。ja / zh は同じ長さ・同じ意味（並行台本）
};
/** サービス id（SVCS[].id）→ Scenario。SVCS に無い id を書かない */
const SCENARIOS: Record<string, Scenario>;
```

**台本の約束**

- `upload` / `form` / `diff` / `lookup` 型は **`script[*][0]` が「実行」ターン**：`q` は入力の要約（ユーザー吹き出しに出る。例「【アップロード】不良報告_0905.xlsx」）、`a` は結果の説明。結果パネル本体は `result` に書く。`[1]` `[2]` が追い質問。
- `qa` 型は `[0]` `[1]` `[2]` すべて質問。
- `a` の中の改行は `\n`（`.bubble` は `white-space: pre-line`）。箇条書きは「・」。
- `q` `a` に `'` を使わない（JS 文字列の引用符と衝突）。引用は「」。

### 3-2. `TEMPLATES`（テンプレート名辞書。UI 表示用・3 言語）

```js
const TEMPLATES = {
  qa:     { name: { ja: 'QAチャット型',          zh: '问答对话型',       en: 'Q&A chat' },
            desc: { ja: '聞いて、根拠付きの答えを受け取る', zh: '提问后获得附依据的回答', en: 'Ask and get a sourced answer' } },
  upload: { name: { ja: 'アップロード→結果型',    zh: '上传→结果型',      en: 'Upload → result' },
            desc: { ja: 'ファイルを渡して、整理された結果を受け取る', zh: '上传文件后获得整理好的结果', en: 'Hand over files and get a structured result' } },
  form:   { name: { ja: 'フォーム入力→ドラフト生成型', zh: '表单输入→草案生成型', en: 'Form → draft' },
            desc: { ja: '条件を埋めて、ドラフトを受け取る', zh: '填写条件后获得草案', en: 'Fill in the terms and get a draft' } },
  diff:   { name: { ja: '差分比較型',            zh: '差异比较型',       en: 'Diff comparison' },
            desc: { ja: '新旧 2 版を比べて、変更点と影響を受け取る', zh: '比较新旧两版，获得变更点与影响', en: 'Compare two versions and get changes and impact' } },
  lookup: { name: { ja: '照会（データ引き）型',   zh: '查询（数据检索）型', en: 'Lookup' },
            desc: { ja: 'キーを入れて、システムのデータを引く', zh: '输入关键字，检索系统数据', en: 'Enter a key and pull system data' } }
};
```

`TEMPLATES` は 3 言語辞書なので **verify §2 の i18n チェック対象に追加**する（§6-2）。

### 3-3. テンプレート割り当て（33 件）

| template | 件数 | サービス id |
|---|---|---|
| `qa` | 5 | kn1 kn2 kn3 kn4 gn4 |
| `upload` | 15 | qa1 qa4 kn5 dc2 dc3 dc4 dc6 lg2 nm2 nm3 en3 gn1 gn2 gn3 gn5 |
| `form` | 8 | qa3 dc1 dc5 dc7 lg1 lg3 lg4 nm1 |
| `diff` | 2 | qa2 en1 |
| `lookup` | 3 | nm4 nm5 en2 |

### 3-4. テンプレートごとのワイヤー（work-pane の中身）と状態

work-pane の描画は `panelHTML(scn, lang0)` 1 関数に集約し、`scn.template` で入力 UI だけ分岐する。結果パネルは `resultHTML(r)` 1 関数（`r.columns` があれば表、なければ `items` の縦積み）。

#### T1 `qa` QAチャット型（work-pane なし）

```
┌ chat-pane（全幅） ─────────────────────────────────────────────┐
│ [agent] こんにちは。「技術ナレッジQA」エージェントです…            │
│                       [user] SUS304 の Φ8 深穴、推奨条件は？ ▶  │
│ [agent] 過去 3 件の記録から…（根拠：TR-2023-041 …）              │
│                                                                │
│ 次の質問例:  [日 ▸ 前にも同じ症状は？] [中 ▸ 以前有没有…]          │
│ ┌────────────────────────────────────────────┐ [送信]          │
└────────────────────────────────────────────────────────────────┘
状態: log=[] → chipsあり（[0] の ja/zh） → chip/send → log=[t0] → … → log=[t0,t1,t2] → demoDone 表示
```

#### T2 `upload` アップロード→結果型

```
┌ work-pane ───────────────────────────────┐
│ 入力                                      │
│ ┌ drop ───────────────────────────────┐   │
│ │  ⬆ ファイルをここにドロップ           │   │  ← t('dropHint')。クリックしても何も起きない（モック）
│ │  📄 不良報告_0905.xlsx               │   │  ← input.files を .file チップで列挙
│ │  📄 検査記録_L3_0905.pdf             │   │
│ └─────────────────────────────────────┘   │
│                              [ 実行 ]     │  ← data-act="run"（log.length===0 のときだけ有効）
│ 結果                                      │  ← log.length>=1 で表示
│ ┌ result ─────────────────────────────┐   │
│ │ 8D 報告書ドラフト（No. 8D-25-0912）  │   │  ← result.title
│ │ D1 チーム   品質保証課 陳・生産技術…   │   │  ← items[].k / v
│ │ D2 問題の記述  …                     │   │
│ └─────────────────────────────────────┘   │
└──────────────────────────────────────────┘
状態: log=[] → [実行] → consume(scriptLang(UI)) → log=[t0] 結果表示・chips 出現 → chip/send ×2
```

#### T3 `form` フォーム入力→ドラフト生成型

```
┌ work-pane ───────────────────────────────┐
│ 入力                                      │
│  件名        ┌ 塗装ライン 乾燥炉 更新 ┐    │  ← input.fields[].label / value（readonly の input 風）
│  金額        ┌ 1,850,000 元 ────────┐    │
│  目的        ┌ 温度ムラによる…（textarea 風）│
│                              [ 実行 ]     │
│ 結果                                      │
│ ┌ result ─────────────────────────────┐   │
│ │ 稟議書ドラフト（設備投資・B ルート） │   │
│ │ 1. 件名  …  / 2. 背景  …  / 記載漏れ … │   │
│ └─────────────────────────────────────┘   │
└──────────────────────────────────────────┘
状態: T2 と同じ
```

#### T4 `diff` 差分比較型

```
┌ work-pane ───────────────────────────────┐
│ 入力                                      │
│ ┌ 旧 ───────────┐ ⇄ ┌ 新 ───────────┐    │  ← t('beforeLabel') / t('afterLabel')、input.left / right
│ │ 📄 要求仕様 Rev.C │   │ 📄 要求仕様 Rev.D │    │
│ └───────────────┘   └───────────────┘    │
│                              [ 実行 ]     │
│ 結果                                      │
│ ┌ result（表） ────────────────────────┐   │
│ │ # │ 変更箇所   │ 旧 → 新    │ 影響    │   │  ← result.columns / rows
│ │ 1 │ §4.2 塗膜厚 │ 15 → 20µm │ 検査基準 │   │
│ └─────────────────────────────────────┘   │
└──────────────────────────────────────────┘
状態: T2 と同じ
```

#### T5 `lookup` 照会（データ引き）型

```
┌ work-pane ───────────────────────────────┐
│ 入力                                      │
│  🔍 ┌ P/N 48210-3C120 ───────────┐ [実行] │  ← input.query（readonly 風）＋ run
│ 結果                                      │
│ ┌ result（表） ────────────────────────┐   │
│ │ 品番 │ 使用製品 │ 上位 ASSY │ 出荷先 │…│   │
│ └─────────────────────────────────────┘   │
└──────────────────────────────────────────┘
状態: T2 と同じ
```

---

## 4. UI 文言の追加（`T`。3 言語）

### 4-1. 追加キー（22）

| key | ja | zh | en | 使う場所 |
|---|---|---|---|---|
| `personaLabel` | 担当者 | 使用者 | Persona | detail |
| `scenarioLabel` | 利用シナリオ | 使用场景 | Scenario | detail |
| `screenType` | 画面タイプ | 界面类型 | Screen type | detail / demo hdr |
| `nativeLabel` | 母語 | 母语 | Native language | detail persona |
| `nativeJa` | 日本語 | 日语 | Japanese | detail persona |
| `nativeZh` | 中国語 | 中文 | Chinese | detail persona |
| `startDemo` | デモを見る | 查看演示 | View demo | detail CTA（シナリオあり） |
| `inputPanel` | 入力 | 输入 | Input | work-pane 見出し |
| `resultPanel` | 結果 | 结果 | Result | work-pane 見出し |
| `run` | 実行 | 执行 | Run | work-pane ボタン |
| `runDone` | 実行済み | 已执行 | Done | 実行後のボタン表示（disabled） |
| `restart` | 最初から | 重新开始 | Restart | demo hdr |
| `dropHint` | ファイルをここにドロップ（モックのため操作不要） | 将文件拖到此处（演示无需操作） | Drop files here (no action needed in this mock) | upload |
| `beforeLabel` | 旧 | 旧版 | Before | diff |
| `afterLabel` | 新 | 新版 | After | diff |
| `chipsLabel` | 次の質問例 | 接下来可以问 | Try asking | chips 行 |
| `chipJa` | 日 | 日 | JA | chip 先頭ラベル |
| `chipZh` | 中 | 中 | ZH | chip 先頭ラベル |
| `runHint` | 左の「実行」を押すとデモが始まります | 点击左侧「执行」开始演示 | Press "Run" on the left to start the demo | chips 位置（実行前） |
| `demoDone` | 台本はここまでです。自由に入力すると汎用のモック応答が返ります。「最初から」でやり直せます。 | 演示脚本到此结束。可继续自由输入（返回通用模拟回复），或点击「重新开始」。 | End of the scripted demo. Free input returns a generic mock reply; use "Restart" to replay. | chips 位置（台本終了） |
| `tplBadge` | テンプレート | 模板 | Template | tpl-badge の title 属性 |
| `stepPrefix` | 手順 | 步骤 | Step | steps の aria-label |

- regress：`counts.ui: 27 → 49`。`T(UI キー) 追加` 22 件が上表と一致することを reviewer が照合。
- verify §4「未使用キー」warn を増やさない：22 キーすべてを `t('…')` で参照する（`tplBadge` は `title="${esc(t('tplBadge'))}"`、`stepPrefix` は `aria-label`）。

---

## 5. CSS 追加（2 つ目の `<style>`。トークンのみ）

| セレクタ | 役割 | 主要プロパティ |
|---|---|---|
| `.persona` | detail の担当者カード | `display:flex; gap:var(--space-3); align-items:center; padding:var(--space-4); border:1px solid var(--border-card); background:var(--surface-sunken)` |
| `.persona .avatar` | 既存 `.hdr .avatar` と同じ見た目（`.avatar` を `.hdr` スコープ外でも使えるよう、セレクタを `.avatar` に緩めるか、`.persona .avatar` に同じ宣言を複製） | — |
| `.persona .p-name` / `.p-role` / `.p-native` | 名前（bold, `--text-heading`）／役職・拠点（`--text-secondary`, 12.5px）／母語（`--text-muted`, overline） | — |
| `.d-two` | detail の「担当者｜画面タイプ」2 カラム | `display:grid; grid-template-columns: 1fr auto; gap: var(--space-6); margin-bottom: var(--space-6)` |
| `.tpl-badge` | 画面タイプバッジ | `.badge` と同寸。`background: var(--badge-trial-bg); color: var(--badge-trial-fg)` |
| `.steps` | 利用シナリオ ol | `margin:0 0 var(--space-8); padding-left: 1.4em; font-size:14px; line-height:1.9; color: var(--text-body)`。`li::marker { color: var(--action-primary); font-weight: var(--weight-bold) }` |
| `.demo-wrap` | main 直下 | `.chat-wrap` と同じ（`flex:1; min-height:0; display:flex; flex-direction:column`） |
| `.demo-body` | 2 ペイン | `flex:1; min-height:0; display:flex` |
| `.work-pane` | 左 | §2-6 の寸法。`background: var(--surface-canvas)` |
| `.chat-pane` | 右 | `flex:1; min-width:0; display:flex; flex-direction:column; background: var(--surface-card)` |
| `.panel` | 入力／結果ブロック | `background: var(--surface-card); border:1px solid var(--border-card); padding: var(--space-4); margin-bottom: var(--space-4)` |
| `.panel-h` | ブロック見出し | `.sec-label` と同じ |
| `.drop` | ドロップ領域 | `border: 1px dashed var(--border-default); padding: var(--space-4); text-align:center; color: var(--text-muted); font-size: 12.5px` |
| `.file` | ファイルチップ | `.tag` と同じ＋ `display:inline-flex; margin: 4px 4px 0 0` |
| `.field` / `.field label` / `.field .val` | フォーム行 | label: overline, `--text-secondary`／val: `.search` と同じ枕（`width:100%`）、`readonly` 風 |
| `.diff-in` | 旧⇄新 2 箱 | `display:grid; grid-template-columns: 1fr auto 1fr; gap: var(--space-2); align-items:center` |
| `.run-row` | 実行ボタン行 | `display:flex; justify-content:flex-end; margin-top: var(--space-3)`。ボタンは `.btn-primary` を流用し `padding: 9px 20px; font-size: 13.5px` |
| `.panel.done` | 実行後の入力パネル | `opacity: .6` |
| `.kv` / `.kv .k` / `.kv .v` | items 縦積み | k: 12px bold `--text-heading`／v: 13px `--text-body` `white-space: pre-line`。行間 `border-top: 1px solid var(--border-subtle)` |
| `.tbl` | 表 | `width:100%; border-collapse: collapse; font-size: 12.5px`。th: `--surface-sunken`／td: `border-top:1px solid var(--border-subtle)`。**横に長い表は `.panel` に `overflow-x:auto`** |
| `.chips` | チップ行 | `flex-shrink:0; display:flex; flex-wrap:wrap; gap: var(--space-2); align-items:center; padding: var(--space-2) 36px; border-top: 1px solid var(--border-subtle); font-size: 12px; color: var(--text-secondary)` |
| `.chip` | 質問例チップ | `border:1px solid var(--border-brand); color: var(--text-link); background: var(--surface-card); border-radius: var(--radius-pill); padding: 5px 12px; font-size: 12.5px; max-width: 420px; text-overflow: ellipsis; overflow:hidden; white-space:nowrap`。`:hover { background: var(--surface-selected) }` |
| `.chip .cl` | 先頭の 日／中 ラベル | `font-weight: var(--weight-bold); margin-right: 6px; color: var(--text-muted)` |
| `.chat-hdr .tpl-badge` / `.chat-hdr .who` | ヘッダー内のバッジとペルソナ | who: 12.5px `--text-secondary` |
| `.chat-hdr .restart` | 最初から | `.backlink` と同じ見た目。`margin-left: var(--space-3)` |
| `@media (max-width: 1180px)` | 2 ペインを縦積み | `.demo-body { flex-direction: column } .work-pane { flex: 0 0 auto; max-width: none; border-right: none; border-bottom: 1px solid var(--border-subtle) }` |

- 直値（`#RRGGBB`／`rgba`）禁止。すべて既存トークンで賄える（新トークンを足さない → dark ブロックも変更なし）。
- `data-screen-label="業務デモ"` を `.demo-wrap` に付ける（既存の慣習）。

---

## 6. `SCENARIOS` 全文（33 件）

> implementer はこの節を**そのまま転記**する（翻訳・要約・数字の変更をしない）。
> 共通設定：会社は仮社名「青嶺精工」、中国工場は「蘇州工場（苏州工厂）」、日本側は「日本本社」。顧客は「K 社（完成車メーカー）」、サプライヤーは「S 社」「T 社」。部品番号は `SK-` 始まり、不具合番号は `NC-`、8D は `8D-`、変更申請は `ECR-`。いずれも架空。
> ペルソナの `native` は ja / zh を混ぜ、**中国人スタッフが日本語資料を、日本人駐在員が中国語資料を扱う**場面を意図的に入れている。

```js
/* ============================================================
   2b. デモシナリオ（サービス id → Scenario）。型は設計書 §3-1 を参照。
   台本は ja / zh の 2 言語のみ（§2-5：エージェント本体は日中どちらの入力も受ける）
   ============================================================ */
const SCENARIOS = {

  /* ---------------- kn: ナレッジ検索・問い合わせ ---------------- */
  kn1: { template: 'qa',
    persona: { name: { ja: '王 磊', zh: '王磊', en: 'Wang Lei' },
               role: { ja: '生産技術課 主任', zh: '生产技术科 主管', en: 'Production Engineering Supervisor' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['ライン 3 で新材質の加工条件が決まらず、過去に同じ材質をやった記録を探したい', '材質・穴径・加工内容を中国語で質問する', '過去の技術報告 3 件から推奨条件が根拠付きで返る', '追い質問で過去の失敗事例を確認し、条件表を作成する'],
             zh: ['3号线新材质的加工条件定不下来，想找以前做过同材质的记录', '用中文提问材质、孔径与加工内容', '从3份历史技术报告中返回附依据的推荐条件', '追问过去的失败案例，据此制定条件表'],
             en: ['Line 3 cannot settle machining conditions for a new material; look for past records', 'Ask in Chinese with material, hole size and operation', 'Get recommended conditions with sources from 3 past technical reports', 'Ask about past failures and build the condition sheet'] },
    script: {
      ja: [
        { q: 'SUS304 の Φ8 深穴（深さ 60mm）ドリル加工、推奨条件を教えて', a: '過去の技術報告 3 件（TR-2023-041、TR-2024-007、TR-2024-102）から推奨条件をまとめました。\n・切削速度：18〜22 m/min（TR-2024-007 で 25 m/min にした際に工具寿命が 40% 低下）\n・送り：0.06 mm/rev\n・ステップ送り：深さ 3D ごとに一旦抜く（切りくず詰まり対策）\n・クーラント：内部給油 2.0 MPa 以上を推奨\n根拠の報告書はいずれも蘇州工場 ライン 2 の実績です。' },
        { q: '前にも切りくず詰まりで折損した事例はある？', a: 'あります。NC-2024-0118（2024/3、ライン 2）：ステップ送りなしで連続加工したところ、加工数 210 本目で工具折損。対策として「3D ごとのステップ送り」と「クーラント圧 1.5→2.0 MPa」を採用し、以降 6 か月再発なしと記録されています。' },
        { q: 'この条件を条件表の形にして', a: '条件表（ドラフト）\n・品目：SUS304 / Φ8 深穴 60mm\n・工具：超硬コーティングドリル Φ8（L/D=8）\n・Vc 20 m/min ／ f 0.06 mm/rev ／ ステップ 24 mm ごと\n・クーラント：内部給油 2.0 MPa\n・工具交換基準：200 本または摩耗幅 0.2 mm\n・参照：TR-2024-007、NC-2024-0118\n中国語版も同時に出力できます。必要なら「中国語で」と入力してください。' }
      ],
      zh: [
        { q: 'SUS304 Φ8 深孔（深60mm）钻孔加工，推荐条件是什么？', a: '根据3份历史技术报告（TR-2023-041、TR-2024-007、TR-2024-102）整理如下：\n・切削速度：18〜22 m/min（TR-2024-007 中提高到 25 m/min 时刀具寿命下降 40%）\n・进给：0.06 mm/rev\n・分段进给：每 3D 深度退刀一次（防止切屑堵塞）\n・冷却液：建议内冷 2.0 MPa 以上\n依据报告均为苏州工厂2号线的实绩。' },
        { q: '以前有没有因为切屑堵塞导致断刀的案例？', a: '有。NC-2024-0118（2024年3月，2号线）：未采用分段进给连续加工，第210件时刀具折断。对策为「每3D分段进给」及「冷却液压力 1.5→2.0 MPa」，记录显示之后6个月未再发生。' },
        { q: '把这些条件整理成条件表', a: '条件表（草案）\n・品目：SUS304 / Φ8 深孔 60mm\n・刀具：硬质合金涂层钻头 Φ8（L/D=8）\n・Vc 20 m/min ／ f 0.06 mm/rev ／ 每 24 mm 分段\n・冷却液：内冷 2.0 MPa\n・换刀基准：200件或磨损宽度 0.2 mm\n・参考：TR-2024-007、NC-2024-0118\n也可同时输出日文版，需要时请输入「日文版」。' }
      ] } },

  kn2: { template: 'qa',
    persona: { name: { ja: '劉 洋', zh: '刘洋', en: 'Liu Yang' },
               role: { ja: '設備保全課 技師', zh: '设备保全科 技师', en: 'Maintenance Technician' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['夜勤中にプレス機がアラームで停止。日本語マニュアルしか手元にない', '設備型式とアラームコードを中国語で入力', 'マニュアルの該当ページと復旧手順の要約が中国語で返る', '安全上の注意と再発時の連絡先を確認して復旧'],
             zh: ['夜班冲床报警停机，手头只有日文手册', '用中文输入设备型号与报警代码', '返回手册对应页与恢复步骤的中文摘要', '确认安全注意事项与再发时的联系人后恢复生产'],
             en: ['Press stops with an alarm on night shift; only the Japanese manual is at hand', 'Enter the model and alarm code in Chinese', 'Get the manual page and a Chinese summary of the recovery steps', 'Confirm safety notes and escalation contact, then recover'] },
    script: {
      ja: [
        { q: 'プレス機 PX-200 でアラーム E-47 が出て止まった。どうすればいい？', a: 'E-47 は「スライド下死点位置ずれ検出」です（取扱説明書 PX-200 第 7 章 7-12 ページ）。復旧手順：\n1. 非常停止を解除せず、金型内に異物・ワーク残りがないか確認\n2. 手動モードでスライドを上死点へ戻す（7-13 ページ 手順 B）\n3. 位置センサー S3 の汚れを拭き取り、原点復帰を実行\n4. 空打ち 3 回でアラームが再発しなければ運転再開\n再発する場合はセンサー交換が必要で、保全課長への連絡が手順化されています（7-14 ページ）。' },
        { q: '原点復帰の操作ボタンはどれ？', a: '操作パネル右下の「原点復帰（ORG）」ボタンです（7-13 ページ 図 7-5 の ⑥）。手動モード（MODE を MANUAL）にした状態で、両手で「ORG」と「運転」を同時に 2 秒押します。安全のため片手操作ではない仕様です。' },
        { q: '同じアラームが今月何回出た？', a: '設備稼働記録では PX-200 の E-47 は今月 3 回（9/2 夜勤、9/4 昼勤、本日）です。3 回中 2 回が同じ金型 D-118 使用時に出ているため、金型側のガイド摩耗も疑われます。保全依頼票のドラフトを作成しますか？' }
      ],
      zh: [
        { q: '冲床 PX-200 出现报警 E-47 停机了，该怎么处理？', a: 'E-47 是「滑块下死点位置偏差检测」（PX-200 使用说明书 第7章 第7-12页）。恢复步骤：\n1. 保持急停状态，确认模具内无异物、无残留工件\n2. 手动模式将滑块回到上死点（第7-13页 步骤B）\n3. 擦拭位置传感器 S3 并执行原点复归\n4. 空打3次不再报警即可恢复运行\n若再次发生需更换传感器，按流程需联系保全科长（第7-14页）。' },
        { q: '原点复归的按钮是哪个？', a: '操作面板右下角的「原点复归（ORG）」按钮（第7-13页 图7-5 的⑥）。将 MODE 切到 MANUAL 后，双手同时按住「ORG」和「运转」2秒。出于安全设计，不能单手操作。' },
        { q: '这个报警这个月出了几次？', a: '设备运行记录显示 PX-200 的 E-47 本月共3次（9/2 夜班、9/4 白班、今天）。其中2次都在使用模具 D-118 时发生，因此也怀疑模具导向磨损。是否需要生成保全申请单草案？' }
      ] } },

  kn3: { template: 'qa',
    persona: { name: { ja: '佐藤 美咲', zh: '佐藤美咲', en: 'Misaki Sato' },
               role: { ja: '管理部 総務・人事 駐在員', zh: '管理部 总务人事 驻在员', en: 'Admin & HR Expatriate' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'ja' },
    steps: { ja: ['現地スタッフから年休の繰越について質問され、中国語版就業規則の条文を確認したい', '日本語で質問する', '中国語版・日本語版の該当条文が引用付きで返り、版ズレが指摘される', 'スタッフへの回答文（中国語）を作成して返信'],
             zh: ['被现地员工问到年假结转，想确认中文版员工手册条款', '用日文提问', '返回中文版与日文版的对应条款并指出版本差异', '生成给员工的中文回复并发送'],
             en: ['A local employee asks about carrying over annual leave; check the Chinese work rules', 'Ask in Japanese', 'Get the clause from both editions with the version gap flagged', 'Draft the Chinese reply and send it'] },
    script: {
      ja: [
        { q: '年次有給休暇の翌年繰越は何日まで認められる？', a: '就業規則（中国語版 2025 年 1 月改定）第 23 条 3 項：「当年度未使用の年休は、翌年 3 月 31 日まで繰り越すことができ、繰越日数の上限は 5 日とする」。\n一方、日本語版（2023 年 7 月版）第 23 条は「上限 3 日」のままで、**日本語版が改定に追いついていません**。現地スタッフへの回答は中国語版（5 日）が正です。' },
        { q: '繰越分を使い切れなかったらどうなる？', a: '同 第 23 条 4 項：「繰越分を 3 月 31 日までに使用しなかった場合、会社は法定基準（日給の 200%）で未使用分を精算する」。精算対象は繰越分のみで、当年度分は翌年へ繰り越されます。関連の運用細則は「休暇管理細則」第 5 条にあります。' },
        { q: 'スタッフへの回答を中国語で作って', a: '回答文（中国語）：\n「您好，关于年假结转：根据《员工手册》（2025年1月修订版）第23条第3款，当年未使用的年假最多可结转5天至次年3月31日；未在期限内使用的结转部分，公司将按日工资200%进行结算（第23条第4款）。如需查询您的剩余天数，请联系人事窓口。」\n併せて、日本語版規程の第 23 条を改定する起票メモも作成できます。' }
      ],
      zh: [
        { q: '年假最多可以结转到下一年多少天？', a: '《员工手册》（中文版 2025年1月修订）第23条第3款：「当年度未使用的年假可结转至次年3月31日，结转天数上限为5天」。\n而日文版（2023年7月版）第23条仍为「上限3天」，**日文版尚未跟上修订**。对现地员工的回答应以中文版（5天）为准。' },
        { q: '结转的年假没用完会怎么样？', a: '同条第4款：「结转部分若未在3月31日前使用，公司按法定标准（日工资的200%）结算未使用部分」。结算仅针对结转部分，当年度部分可继续结转至次年。相关执行细则见《休假管理细则》第5条。' },
        { q: '帮我写一段给员工的回复', a: '回复文案：\n「您好，关于年假结转：根据《员工手册》（2025年1月修订版）第23条第3款，当年未使用的年假最多可结转5天至次年3月31日；未在期限内使用的结转部分，公司将按日工资200%进行结算（第23条第4款）。如需查询您的剩余天数，请联系人事窓口。」\n同时可为您生成修订日文版第23条的起票备忘。' }
      ] } },

  kn4: { template: 'qa',
    persona: { name: { ja: '張 小雨', zh: '张小雨', en: 'Zhang Xiaoyu' },
               role: { ja: '製造二課 作業者（入社 2 か月）', zh: '制造二科 作业员（入职2个月）', en: 'Operator, Manufacturing Sec. 2 (2 months in)' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['社会保険の加入証明が必要になったが、誰に頼めばよいか分からない', 'スマホから中国語で質問', '申請手順・必要書類・所要日数が返る', '解決しない場合は担当部署に引き継がれ、問い合わせが記録される'],
             zh: ['需要社保参保证明，但不知道找谁办', '用手机中文提问', '返回申请流程、所需材料与所需天数', '未解决时转交负责部门并记录咨询'],
             en: ['Needs a social-insurance certificate but does not know whom to ask', 'Asks in Chinese from a phone', 'Gets the procedure, documents and turnaround', 'Unresolved cases are handed to the owning team and logged'] },
    script: {
      ja: [
        { q: '社会保険の加入証明書はどこで貰える？', a: '社内 FAQ「証明書の発行」より：\n・申請先：人事窓口（管理部 2 階）または社内ポータル「証明書申請」\n・必要なもの：身分証番号、用途（例：住宅ローン・子女入学）\n・所要日数：3 営業日（急ぎは窓口で相談）\n・受け取り：窓口で本人受領\n住宅ローン用の場合、銀行指定書式があることが多いので、書式を先に人事へ渡すと一度で済みます。' },
        { q: '子どもの入学用なんだけど、他に会社から必要な書類ある？', a: '蘇州市の公立小学校入学（外来人員子女）では、一般に会社発行の「在職証明」と「社会保険納付証明（直近 6 か月）」が求められます。どちらも人事窓口で同時に申請できます。学校ごとに要件が違うため、学校の案内文をお持ちなら人事にお見せください。' },
        { q: 'いつまでに申請すれば間に合う？', a: '入学手続きの提出期限が分かれば逆算します。目安として、証明書 2 種は申請から 3 営業日で発行されるので、提出期限の 1 週間前までに申請すれば余裕があります。この問い合わせは人事窓口に引き継ぎ、担当者から明日中に連絡が入るよう記録しました（受付番号 HD-0906-014）。' }
      ],
      zh: [
        { q: '社保参保证明在哪里可以开？', a: '根据内部FAQ「证明开具」：\n・申请渠道：人事窗口（管理部2楼）或内部门户「证明申请」\n・所需信息：身份证号、用途（如房贷、子女入学）\n・所需时间：3个工作日（急件可到窗口协商）\n・领取方式：本人到窗口领取\n若用于房贷，银行常有指定格式，建议先把格式交给人事，可一次办好。' },
        { q: '是给孩子入学用的，公司这边还需要别的材料吗？', a: '苏州市公办小学（外来人员子女）入学一般还需要公司开具的「在职证明」和「社保缴纳证明（近6个月）」，两项都可在人事窗口同时申请。各学校要求不同，如有学校通知，请一并出示给人事。' },
        { q: '什么时候申请来得及？', a: '如告知入学材料提交期限，我可以倒推。一般两种证明自申请起3个工作日开具，建议在提交期限前1周申请。本次咨询已转交人事窗口，并记录为明天内由负责人联系您（受理编号 HD-0906-014）。' }
      ] } },

  kn5: { template: 'upload',
    persona: { name: { ja: '中村 大輔', zh: '中村大辅', en: 'Daisuke Nakamura' },
               role: { ja: '管理部 財務・法務 駐在員', zh: '管理部 财务法务 驻在员', en: 'Finance & Legal Expatriate' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'ja' },
    steps: { ja: ['銀行から NFRA の新通達（外貨口座・クロスボーダー資金）の PDF が届いたが、中国語の原文が長い', '通達 PDF と自社の資金管理マニュアルをアップロード', '自社への影響（対象業務・期限・対応）とマニュアルの改訂箇所が返る', '本社報告用の日本語要約と、改訂ドラフトを財務課長に回す'],
             zh: ['银行发来金融监管总局的新通知（外币账户・跨境资金）PDF，原文很长', '上传通知PDF与公司资金管理手册', '返回对本公司的影响（涉及业务、期限、应对）与手册修订位置', '将日文摘要报给总部，修订草案交给财务科长'],
             en: ['The bank forwards a long NFRA notice on FX accounts and cross-border funds', 'Upload the notice PDF and the company cash-management manual', 'Get the impact (affected work, deadlines, actions) and the manual sections to revise', 'Send a Japanese summary to HQ and the revision draft to the finance manager'] },
    input: { ja: { files: ['NFRA_通達_2026-31号.pdf', '資金管理マニュアル_v4.2.docx'] },
             zh: { files: ['金融监管总局_通知_2026-31号.pdf', '资金管理手册_v4.2.docx'] } },
    result: {
      ja: { title: '影響分析：NFRA 2026 年第 31 号通達（外貨口座・クロスボーダー資金管理）',
            items: [
              { k: '通達の要旨', v: '外資企業の外貨資本金口座からの人民元転換について、用途証明の事前提出を「支払前」に統一。月次の資金使途報告を四半期→月次に変更。施行 2026-11-01。' },
              { k: '自社への影響（3 件）', v: '① 本社からの増資分（残高 USD 1.2M）の人民元転換：転換前に用途証明を銀行へ提出する手順が必要\n② 資金使途報告：四半期→月次。財務課の月次締め業務に 1 タスク追加\n③ 既存の一括転換（月 1 回）は継続可。ただし 1 回あたりの用途証明が複数枚になる' },
              { k: '期限', v: '施行日 2026-11-01。初回の月次報告は 2026-12-10 まで。' },
              { k: 'マニュアル改訂箇所', v: '資金管理マニュアル v4.2 §5.3「外貨転換手続き」：手順 2 と 3 の順序を入れ替え（用途証明→転換）。§7.1「当局報告」：頻度を月次に、様式番号を追記。' },
              { k: '要確認', v: '取引銀行 2 行のうち B 行の所要日数（現行 2 営業日→通達後は 3 営業日の見込み）。10 月中に確認。' }
            ] },
      zh: { title: '影响分析：金融监管总局 2026年第31号通知（外币账户・跨境资金管理）',
            items: [
              { k: '通知要点', v: '外资企业外币资本金账户结汇，统一要求在「付款前」提交用途证明。资金用途报告由季度改为月度。2026-11-01 起施行。' },
              { k: '对本公司的影响（3项）', v: '① 总部增资款（余额 USD 1.2M）结汇：需增加结汇前向银行提交用途证明的步骤\n② 资金用途报告：季度→月度。财务科月结工作增加1项任务\n③ 现有每月1次的集中结汇可继续，但每次需提交多份用途证明' },
              { k: '期限', v: '施行日 2026-11-01。首次月度报告截止 2026-12-10。' },
              { k: '手册修订位置', v: '资金管理手册 v4.2 §5.3「外币结汇手续」：调换步骤2与3的顺序（用途证明→结汇）。§7.1「监管报告」：频率改为月度，补充表格编号。' },
              { k: '待确认', v: '两家合作银行中 B 行的处理天数（现行2个工作日→预计3个工作日）。10月内确认。' }
            ] } },
    script: {
      ja: [
        { q: '【アップロード】NFRA_通達_2026-31号.pdf、資金管理マニュアル_v4.2.docx', a: '通達 12 ページを読み、自社への影響を 3 件に整理しました（右の結果を参照）。最も影響が大きいのは「資金使途報告の月次化」で、財務課の月次締めに作業が 1 つ増えます。施行は 2026-11-01、初回報告期限は 2026-12-10 です。' },
        { q: 'マニュアル §5.3 の改訂案を書いて', a: '§5.3 外貨転換手続き（改訂案）\n1. 財務課は転換予定額と用途を「外貨転換申請書（様式 F-12）」に記入する\n2. **用途証明（契約書・請求書等）を申請書に添付し、取引銀行へ事前提出する**（改訂：旧手順 3 を前へ）\n3. 銀行の受理確認後に転換を実行する\n4. 転換完了後 5 営業日以内に「資金使途月次報告（様式 F-15、新設）」に記載する\n変更履歴：v4.3 / 2026-10 / NFRA 2026 年第 31 号対応。' },
        { q: '本社向けに日本語で 5 行に要約して', a: '本社向け要約：\n・NFRA 通達 2026 年第 31 号（11/1 施行）により、外貨資本金の人民元転換に用途証明の事前提出が必須化\n・資金使途報告が四半期→月次（初回 12/10 期限）\n・当社影響：増資分 USD 1.2M の転換手順変更、財務課の月次業務 1 件追加\n・対応：資金管理マニュアル v4.3 へ改訂（§5.3・§7.1）、10 月中に銀行と所要日数を確認\n・本社側の対応は不要。増資送金のタイミングは 10 月中を推奨' }
      ],
      zh: [
        { q: '【上传】金融监管总局_通知_2026-31号.pdf、资金管理手册_v4.2.docx', a: '已读取12页通知，将对本公司的影响整理为3项（见右侧结果）。影响最大的是「资金用途报告改为月度」，财务科月结增加1项工作。施行日 2026-11-01，首次报告截止 2026-12-10。' },
        { q: '写一下手册 §5.3 的修订案', a: '§5.3 外币结汇手续（修订案）\n1. 财务科在「外币结汇申请单（表格 F-12）」中填写拟结汇金额与用途\n2. **将用途证明（合同、发票等）附于申请单，事先提交合作银行**（修订：原步骤3前移）\n3. 银行确认受理后执行结汇\n4. 结汇完成后5个工作日内填写「资金用途月度报告（表格 F-15，新增）」\n修订记录：v4.3 / 2026-10 / 对应金融监管总局2026年第31号通知。' },
        { q: '给日本总部写一份5行的日文摘要', a: '本社向け要約（日文）：\n・NFRA 通達 2026 年第 31 号（11/1 施行）により、外貨資本金の人民元転換に用途証明の事前提出が必須化\n・資金使途報告が四半期→月次（初回 12/10 期限）\n・当社影響：増資分 USD 1.2M の転換手順変更、財務課の月次業務 1 件追加\n・対応：資金管理マニュアル v4.3 へ改訂（§5.3・§7.1）、10 月中に銀行と所要日数を確認\n・本社側の対応は不要。増資送金のタイミングは 10 月中を推奨' }
      ] } },

  /* ---------------- qa: 品質・不具合対応 ---------------- */
  qa1: { template: 'upload',
    persona: { name: { ja: '陳 静', zh: '陈静', en: 'Chen Jing' },
               role: { ja: '品質保証課 係長', zh: '品质保证科 组长', en: 'QA Team Leader' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['K 社から外観不良（塗装ブツ）の指摘。48 時間以内に 8D の D1〜D3 を提出する必要がある', '不良報告と検査記録をアップロード', '類似不具合 2 件と原因候補、8D ドラフト（D1〜D5）が返る', '是正処置の妥当性を確認し、日中 2 言語の 8D を K 社と本社へ提出'],
             zh: ['K公司指出外观不良（涂装颗粒），需在48小时内提交8D的D1〜D3', '上传不良报告与检验记录', '返回2件类似不良、原因假设与8D草案（D1〜D5）', '确认纠正措施合理性后，向K公司和总部提交中日双语8D'],
             en: ['Customer K reports paint particles; D1–D3 of the 8D are due within 48 hours', 'Upload the defect report and inspection records', 'Get 2 similar cases, root-cause hypotheses and an 8D draft (D1–D5)', 'Check corrective actions and submit the bilingual 8D to K and HQ'] },
    input: { ja: { files: ['不良報告_NC-2025-0912.xlsx', '外観検査記録_L3_0905-0906.pdf', '塗装条件記録_0905.csv'] },
             zh: { files: ['不良报告_NC-2025-0912.xlsx', '外观检验记录_L3_0905-0906.pdf', '涂装条件记录_0905.csv'] } },
    result: {
      ja: { title: '8D 報告書ドラフト 8D-25-0912（塗装ブツ／SK-3310-A ブラケット）',
            items: [
              { k: 'D1 チーム', v: 'リーダー：品質保証課 陳静／生産技術課 王磊／製造二課 李強／塗装 S 社 窓口' },
              { k: 'D2 問題の記述', v: 'K 社 受入検査にて SK-3310-A 表面に直径 0.3〜0.5 mm のブツ。ロット 250905-L3、出荷 1,200 個中 18 個（1.5%）。当社出荷検査（抜取 n=32）では未検出。' },
              { k: 'D3 暫定処置', v: '同ロット在庫 640 個を全数目視（9/6 完了、不良 9 個）。次ロットから抜取を n=32→n=125（AQL 0.65）に強化。K 社在庫はK 社側で選別中。' },
              { k: '類似不具合', v: 'NC-2024-0331（2024/6、同ライン）：塗装ブース吸気フィルター目詰まりで同種ブツ。NC-2023-0207：前処理脱脂液の濃度低下。' },
              { k: 'D4 原因候補（なぜなぜ）', v: '① 塗装ブース吸気フィルター：交換履歴 7/20、基準 60 日 → 9/5 時点で 47 日（基準内だが夏季で目詰まり進行の可能性）\n② 前処理脱脂液濃度：9/5 記録 3.8%（基準 4.0〜5.0%）**基準外**\n③ 塗料撹拌時間：記録上 異常なし\n→ 最有力は ②、①は寄与要因' },
              { k: 'D5 是正処置（案）', v: '脱脂液の濃度管理を 1 回/日→2 回/日、自動補給装置の校正（9/10）。フィルター交換基準を夏季 45 日に短縮。効果確認：3 ロット連続で外観不良 0.2% 以下。' }
            ] },
      zh: { title: '8D报告草案 8D-25-0912（涂装颗粒／SK-3310-A 支架）',
            items: [
              { k: 'D1 团队', v: '组长：品质保证科 陈静／生产技术科 王磊／制造二科 李强／涂装外协 S公司 窗口' },
              { k: 'D2 问题描述', v: 'K公司来料检验发现 SK-3310-A 表面有直径 0.3〜0.5 mm 颗粒。批次 250905-L3，出货1,200件中18件（1.5%）。本公司出货检验（抽样 n=32）未检出。' },
              { k: 'D3 临时措施', v: '同批次库存640件全数目视（9/6完成，不良9件）。下批起抽样由 n=32 加强为 n=125（AQL 0.65）。K公司库存由K方筛选中。' },
              { k: '类似不良', v: 'NC-2024-0331（2024年6月，同一线）：喷房进气过滤器堵塞导致同类颗粒。NC-2023-0207：前处理脱脂液浓度下降。' },
              { k: 'D4 原因假设（5Why）', v: '① 喷房进气过滤器：更换记录 7/20，基准60天 → 9/5 时为47天（基准内，但夏季堵塞可能加快）\n② 前处理脱脂液浓度：9/5 记录 3.8%（基准 4.0〜5.0%）**超出基准**\n③ 涂料搅拌时间：记录无异常\n→ 最可能为②，①为促成因素' },
              { k: 'D5 纠正措施（案）', v: '脱脂液浓度管理由1次/日改为2次/日，自动补液装置校准（9/10）。过滤器更换基准夏季缩短为45天。效果确认：连续3批外观不良 ≤0.2%。' }
            ] } },
    script: {
      ja: [
        { q: '【アップロード】不良報告_NC-2025-0912.xlsx、外観検査記録_L3_0905-0906.pdf、塗装条件記録_0905.csv', a: '3 ファイルを読み、類似不具合 2 件を照合して 8D の D1〜D5 ドラフトを作成しました（右の結果）。原因候補として最有力なのは前処理脱脂液の濃度低下（9/5 記録 3.8%、基準 4.0〜5.0%）で、2023 年の NC-2023-0207 と同じパターンです。D3 暫定処置までは K 社の 48 時間期限に対して提出可能な状態です。' },
        { q: 'D5 の是正処置は妥当？抜けはない？', a: '概ね妥当ですが 2 点補強を推奨します。\n・「なぜ濃度が下がったか」の根本原因（自動補給装置の故障か、点検漏れか）が D4 で確定していないため、D5 に「補給装置の故障原因調査（9/12 まで）」を追加\n・K 社は再発防止で「管理項目の帳票化」を求める傾向があるため、「脱脂液濃度チェックシート（様式 QC-27）の新設」を明記\nD6（効果確認）は 3 ロット連続 0.2% 以下、D7（水平展開）はライン 1・2 の脱脂槽も同基準に、を提案します。' },
        { q: 'D1〜D5 を中国語版と日本語版で出力して', a: '出力しました：\n・8D-25-0912_ja.docx（日本語、本社・K 社日本窓口向け）\n・8D-25-0912_zh.docx（中国語、現場・S 社共有向け）\n両版は同じ内容で、部品番号・数値・日付は共通です。用語は社内用語集に合わせています（「ブツ」→「颗粒」、「前処理脱脂」→「前处理脱脂」）。提出前に陳係長と王主任の確認欄にチェックを入れてください。' }
      ],
      zh: [
        { q: '【上传】不良报告_NC-2025-0912.xlsx、外观检验记录_L3_0905-0906.pdf、涂装条件记录_0905.csv', a: '已读取3个文件，对照2件类似不良，生成8D的D1〜D5草案（见右侧结果）。最可能的原因是前处理脱脂液浓度下降（9/5记录3.8%，基准4.0〜5.0%），与2023年的NC-2023-0207模式相同。D3临时措施部分已可在K公司48小时期限内提交。' },
        { q: 'D5 的纠正措施合理吗？有没有遗漏？', a: '总体合理，建议补强2点：\n・「浓度为什么会下降」的根本原因（自动补液装置故障还是点检遗漏）在D4尚未确定，建议D5增加「补液装置故障原因调查（9/12前）」\n・K公司在再发防止上倾向要求「管理项目表单化」，建议明确「新增脱脂液浓度检查表（表格 QC-27）」\nD6（效果确认）建议连续3批 ≤0.2%，D7（横向展开）建议1号线、2号线脱脂槽采用同一基准。' },
        { q: '把 D1〜D5 输出为中文版和日文版', a: '已输出：\n・8D-25-0912_zh.docx（中文，现场与S公司共享用）\n・8D-25-0912_ja.docx（日文，总部与K公司日本窗口用）\n两版内容一致，零件号、数值、日期相同。术语按公司术语表统一（「颗粒」↔「ブツ」、「前处理脱脂」↔「前処理脱脂」）。提交前请在陈组长与王主管的确认栏打勾。' }
      ] } },

  qa2: { template: 'diff',
    persona: { name: { ja: '李 強', zh: '李强', en: 'Li Qiang' },
               role: { ja: '製造二課 課長', zh: '制造二科 科长', en: 'Manufacturing Sec. 2 Manager' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['S 社の材料値上げで、ブラケットの鋼板をサプライヤー T 社に切り替えたい（4M：材料）', '変更前・変更後の条件を入力して比較', '過去の変更履歴から「同種の変更で起きたこと」と影響工程・顧客承認の要否が返る', '影響を踏まえて変更申請書（ECR）を起票する'],
             zh: ['因S公司材料涨价，想把支架钢板切换到供应商T公司（4M：材料）', '输入变更前后条件进行比较', '从历史变更记录返回「同类变更过去发生过什么」及受影响工序、是否需客户承认', '据此填写变更申请（ECR）'],
             en: ['Supplier S raised prices; switch the bracket steel to supplier T (4M: material)', 'Enter before/after conditions and compare', 'See what happened in similar past changes, affected processes and approval needs', 'Raise the change request (ECR) with the impact filled in'] },
    input: { ja: { left: '変更前：鋼板 SPCC t1.2 ／ S 社 ／ ロット幅 1,219', right: '変更後：鋼板 SPCC t1.2 ／ T 社 ／ ロット幅 1,250' },
             zh: { left: '变更前：钢板 SPCC t1.2 ／ S公司 ／ 卷宽 1,219', right: '变更后：钢板 SPCC t1.2 ／ T公司 ／ 卷宽 1,250' } },
    result: {
      ja: { title: '変更影響予測 ECR-25-0088（材料サプライヤー変更：SK-3310-A ブラケット）',
            columns: ['#', '影響項目', '過去の類似変更で起きたこと', '今回の予測', '対応'],
            rows: [
              ['1', 'プレス成形（割れ・しわ）', 'ECR-23-0041（S→U 社）：同じ SPCC でも降伏点が 15 MPa 高く、R 部に微小割れ', '中（T 社ミルシート：降伏点 +8 MPa）', '初回ロットで成形性評価 30 個'],
              ['2', '塗装密着性', 'ECR-24-0017：表面油の種類変更で密着不良 → 前処理条件を変更', '中', '碁盤目試験（QC-31）を初回ロットで実施'],
              ['3', '板取り・材料歩留', 'ロット幅 1,219→1,250 で歩留 +2.1%（過去実績）', '良（コスト削減 ▲1.8%）', 'NC プログラム変更（生産技術）'],
              ['4', '顧客承認', 'K 社の PPAP 要求：材料サプライヤー変更は「レベル 3 提出」対象', '**要**', 'K 社へ変更通知 → 承認まで平均 6 週間'],
              ['5', '在庫切替', 'S 社在庫 3,200 枚（約 2.5 か月分）', '—', '切替時期は 12 月ロットからを推奨']
            ] },
      zh: { title: '变更影响预测 ECR-25-0088（材料供应商变更：SK-3310-A 支架）',
            columns: ['#', '影响项目', '过去类似变更发生过什么', '本次预测', '应对'],
            rows: [
              ['1', '冲压成形（开裂・起皱）', 'ECR-23-0041（S→U公司）：同为SPCC但屈服点高15 MPa，R角出现微裂', '中（T公司材质单：屈服点 +8 MPa）', '首批做30件成形性评价'],
              ['2', '涂装附着力', 'ECR-24-0017：表面防锈油种类变更导致附着不良 → 修改前处理条件', '中', '首批实施划格试验（QC-31）'],
              ['3', '排样・材料利用率', '卷宽 1,219→1,250 利用率 +2.1%（历史实绩）', '好（成本 ▲1.8%）', '修改NC程序（生产技术）'],
              ['4', '客户承认', 'K公司PPAP要求：材料供应商变更属「等级3提交」', '**需要**', '向K公司发变更通知 → 承认平均需6周'],
              ['5', '库存切换', 'S公司库存3,200张（约2.5个月）', '—', '建议从12月批次开始切换']
            ] } },
    script: {
      ja: [
        { q: '【比較】変更前：S 社 SPCC t1.2 ⇄ 変更後：T 社 SPCC t1.2（ロット幅 1,250）', a: '過去の変更履歴 2 件（ECR-23-0041、ECR-24-0017）と不具合記録を照合し、影響 5 項目を予測しました（右の表）。注意点は 2 つ：① 同じ SPCC でも降伏点差で R 部割れが出た前例があるので初回ロットで成形性評価が必要、② K 社の PPAP 上「材料サプライヤー変更」はレベル 3 提出＝**顧客承認が必須**で、承認まで平均 6 週間かかります。' },
        { q: 'K 社の承認が要るなら、切替はいつからが現実的？', a: '逆算します。\n・ECR 起票・社内承認：9/15\n・T 社サンプル材入手・成形性評価・碁盤目試験：9/30\n・K 社へ変更通知＋レベル 3 提出：10/5\n・K 社承認（平均 6 週間）：11/16 ごろ\n・S 社在庫 3,200 枚は 11 月末で消化見込み\n→ **12 月ロットからの切替**が現実的です。K 社承認が遅れる場合に備え、S 社へ 1 か月分（1,300 枚）の追加発注をオプションとして残すことを推奨します。' },
        { q: 'この内容で ECR を起票して', a: 'ECR-25-0088 ドラフトを作成しました。\n・変更区分：4M－材料（サプライヤー変更）\n・対象：SK-3310-A ブラケット（K 社向け）\n・理由：S 社値上げ（+9%）。T 社切替でコスト ▲1.8%、歩留 +2.1%\n・影響評価：右表 5 項目を転記\n・検証計画：成形性評価 30 個、碁盤目試験、初品検査\n・顧客承認：要（PPAP レベル 3）\n・切替予定：2025-12 ロット\n承認ルート：製造二課長 → 品質保証課長 → 工場長（材料変更は工場長決裁）。添付に T 社ミルシートと過去 ECR 2 件のリンクを付けています。' }
      ],
      zh: [
        { q: '【比较】变更前：S公司 SPCC t1.2 ⇄ 变更后：T公司 SPCC t1.2（卷宽1,250）', a: '对照2件历史变更（ECR-23-0041、ECR-24-0017）与不良记录，预测了5项影响（见右表）。需注意2点：① 同为SPCC但曾因屈服点差异导致R角开裂，首批需做成形性评价；② 按K公司PPAP，「材料供应商变更」属等级3提交＝**必须客户承认**，承认平均需6周。' },
        { q: '既然需要K公司承认，什么时候切换比较现实？', a: '倒推如下：\n・ECR填写与内部审批：9/15\n・取得T公司样材、成形性评价、划格试验：9/30\n・向K公司发变更通知＋等级3提交：10/5\n・K公司承认（平均6周）：约11/16\n・S公司库存3,200张预计11月底用完\n→ **从12月批次开始切换**较为现实。为防K公司承认延迟，建议保留向S公司追加1个月用量（1,300张）的选项。' },
        { q: '按这个内容填写ECR', a: '已生成 ECR-25-0088 草案。\n・变更类别：4M－材料（供应商变更）\n・对象：SK-3310-A 支架（K公司用）\n・理由：S公司涨价（+9%）。切换T公司成本 ▲1.8%，利用率 +2.1%\n・影响评价：转录右表5项\n・验证计划：成形性评价30件、划格试验、首件检验\n・客户承认：需要（PPAP等级3）\n・切换预定：2025-12 批次\n审批路径：制造二科长 → 品质保证科长 → 厂长（材料变更由厂长决裁）。附件包含T公司材质单及2件历史ECR链接。' }
      ] } },

  qa3: { template: 'form',
    persona: { name: { ja: '高橋 亮', zh: '高桥亮', en: 'Ryo Takahashi' },
               role: { ja: '営業・顧客対応 駐在員', zh: '销售・客户对应 驻在员', en: 'Sales & Customer Liaison Expatriate' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'ja' },
    steps: { ja: ['K 社の中国工場から中国語のクレームメールが届いた。まず当日中に一次回答を返す必要がある', 'クレーム内容・顧客・部品番号をフォームに入力', '要約・重要度・担当部門の判定と一次回答文（中国語）が返る', '一次回答を送信し、社内エスカレーションと本社への日本語報告を行う'],
             zh: ['收到K公司中国工厂的中文投诉邮件，需当天先回复', '在表单中填写投诉内容、客户、零件号', '返回摘要、重要度、责任部门判定与中文初步回复', '发送初步回复，进行内部上报并向总部做日文汇报'],
             en: ['A Chinese-language claim email arrives from customer K; a same-day first reply is needed', 'Enter the claim, customer and part number in the form', 'Get a summary, severity, owning department and a Chinese first reply', 'Send the reply, escalate internally and report to HQ in Japanese'] },
    input: { ja: { fields: [
              { label: '顧客', value: 'K 社 常熟工場 品質部' },
              { label: '部品番号 / ロット', value: 'SK-2207-B ／ 250901-L1' },
              { label: 'クレーム内容（原文貼り付け）', value: '贵司9月1日批次的SK-2207-B，在我司装配线发现12件螺纹孔M6不通，导致停线25分钟。请于今日内回复原因及对策。' },
              { label: '回答言語', value: '中国語' } ] },
             zh: { fields: [
              { label: '客户', value: 'K公司 常熟工厂 品质部' },
              { label: '零件号 / 批次', value: 'SK-2207-B ／ 250901-L1' },
              { label: '投诉内容（粘贴原文）', value: '贵司9月1日批次的SK-2207-B，在我司装配线发现12件螺纹孔M6不通，导致停线25分钟。请于今日内回复原因及对策。' },
              { label: '回复语言', value: '中文' } ] } },
    result: {
      ja: { title: 'クレーム一次対応 CL-25-0906-02（K 社常熟／SK-2207-B ねじ穴 M6 不通）',
            items: [
              { k: '要約', v: 'ロット 250901-L1 のうち 12 個で M6 ねじ穴の貫通不良。顧客ライン停止 25 分。当日中の回答要求。' },
              { k: '重要度 / 区分', v: '**重大**（顧客ライン停止あり）／ 加工不良（タップ工程）／ 即時エスカレーション対象' },
              { k: '担当部門', v: '主担当：製造一課（タップ工程）／ 品質保証課（原因調査・8D）／ 営業（顧客窓口）' },
              { k: '同種クレームの傾向', v: '過去 12 か月で SK-2207 系のねじ不良は 3 件目（2 月・6 月・今回）。いずれもタップ折損後の復旧ロット。' },
              { k: '一次回答文（中国語）', v: '尊敬的K公司品质部：\n感谢贵司及时反馈。关于9月1日批次（250901-L1）SK-2207-B 螺纹孔M6不通问题，我司深表歉意。目前已采取以下措施：\n1. 立即对该批次我司库存（860件）进行全数螺纹通止检查，预计今日18:00前完成；\n2. 安排人员于明日上午到贵司协助筛选在库品；\n3. 原因初步判断为丝锥工序异常，正式原因及对策将于9月8日以8D报告形式提交。\n再次为造成贵司停线致以诚挚歉意。\n青岭精工（苏州）品质保证科 陈静 ／ 销售 高桥亮' }
            ] },
      zh: { title: '客诉初步应对 CL-25-0906-02（K公司常熟／SK-2207-B 螺纹孔M6不通）',
            items: [
              { k: '摘要', v: '批次 250901-L1 中12件M6螺纹孔不通。客户停线25分钟。要求当日回复。' },
              { k: '重要度 / 类别', v: '**重大**（客户停线）／ 加工不良（丝锥工序）／ 即时上报对象' },
              { k: '责任部门', v: '主责：制造一科（丝锥工序）／ 品质保证科（原因调查・8D）／ 销售（客户窗口）' },
              { k: '同类客诉趋势', v: '近12个月 SK-2207 系列螺纹不良已是第3件（2月、6月、本次）。均为丝锥折断后的恢复批次。' },
              { k: '初步回复（中文）', v: '尊敬的K公司品质部：\n感谢贵司及时反馈。关于9月1日批次（250901-L1）SK-2207-B 螺纹孔M6不通问题，我司深表歉意。目前已采取以下措施：\n1. 立即对该批次我司库存（860件）进行全数螺纹通止检查，预计今日18:00前完成；\n2. 安排人员于明日上午到贵司协助筛选在库品；\n3. 原因初步判断为丝锥工序异常，正式原因及对策将于9月8日以8D报告形式提交。\n再次为造成贵司停线致以诚挚歉意。\n青岭精工（苏州）品质保证科 陈静 ／ 销售 高桥亮' }
            ] } },
    script: {
      ja: [
        { q: '【フォーム送信】K 社常熟工場／SK-2207-B／ロット 250901-L1／ねじ穴 M6 不通 12 個・停線 25 分', a: 'クレームを要約し、**重大**（顧客ライン停止）と判定しました。担当は製造一課（タップ工程）と品質保証課で、即時エスカレーション対象です。中国語の一次回答文を作成しました（右の結果）。なお SK-2207 系のねじ不良は過去 12 か月で 3 件目で、いずれもタップ折損後の復旧ロットです。再発として扱う必要があります。' },
        { q: '一次回答で「8D を 9/8 提出」と約束して大丈夫？', a: 'K 社の品質協定では「重大クレームは 2 営業日以内に D1〜D3、10 日以内に完全版」が条件です。本日 9/6（土）起点で 2 営業日は 9/9（火）なので、**9/8 は協定より 1 日早い約束**になります。安全側にするなら「9月9日」に修正を推奨します。修正版の一文：「正式原因及对策将于9月9日以8D报告形式提交」。' },
        { q: '本社の品質保証部に日本語で状況報告を作って', a: '本社 品質保証部 御中\n件名：【重大】K 社常熟工場クレーム SK-2207-B ねじ穴不通（CL-25-0906-02）\n・発生：9/1 出荷ロット 250901-L1、K 社組立ラインで M6 ねじ穴不通 12 個、ライン停止 25 分\n・暫定処置：当社在庫 860 個 全数通止検査（本日 18:00 完了予定）、明朝 K 社で在庫選別支援\n・原因見込み：タップ工程（折損後の復旧ロット）。過去 12 か月で同系 3 件目のため再発扱い\n・今後：D1〜D3 を 9/9 提出、完全版 8D を 9/16 提出予定\n・要請：K 社日本本社窓口への一報をお願いします\n蘇州工場 営業 高橋' }
      ],
      zh: [
        { q: '【提交表单】K公司常熟工厂／SK-2207-B／批次 250901-L1／螺纹孔M6不通12件・停线25分钟', a: '已总结投诉并判定为**重大**（客户停线）。责任部门为制造一科（丝锥工序）与品质保证科，属即时上报对象。已生成中文初步回复（见右侧结果）。另外 SK-2207 系列螺纹不良近12个月已是第3件，均为丝锥折断后的恢复批次，需按再发处理。' },
        { q: '初步回复里承诺「9/8提交8D」没问题吗？', a: 'K公司质量协议规定「重大客诉2个工作日内提交D1〜D3，10日内提交完整版」。以今天9/6（周六）起算，2个工作日为9/9（周二），**9/8 比协议提前了1天**。若要留余量，建议改为「9月9日」。修改后的句子：「正式原因及对策将于9月9日以8D报告形式提交」。' },
        { q: '给日本总部品质保证部写一份日文情况汇报', a: '本社 品質保証部 御中\n件名：【重大】K 社常熟工場クレーム SK-2207-B ねじ穴不通（CL-25-0906-02）\n・発生：9/1 出荷ロット 250901-L1、K 社組立ラインで M6 ねじ穴不通 12 個、ライン停止 25 分\n・暫定処置：当社在庫 860 個 全数通止検査（本日 18:00 完了予定）、明朝 K 社で在庫選別支援\n・原因見込み：タップ工程（折損後の復旧ロット）。過去 12 か月で同系 3 件目のため再発扱い\n・今後：D1〜D3 を 9/9 提出、完全版 8D を 9/16 提出予定\n・要請：K 社日本本社窓口への一報をお願いします\n蘇州工場 営業 高橋' }
      ] } },

  qa4: { template: 'upload',
    persona: { name: { ja: '周 敏', zh: '周敏', en: 'Zhou Min' },
               role: { ja: '品質保証課 監査対応担当', zh: '品质保证科 审核对应担当', en: 'QA Audit Coordinator' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['K 社の工程監査が 3 週間後。チェックリスト 86 項目に対する提出資料を揃える必要がある', 'チェックリスト（Excel）をアップロード', '各項目に対応する社内文書・記録の紐づけと、証拠不足の項目が返る', '不足項目の担当を割り振り、提出資料一覧を作成する'],
             zh: ['K公司工艺审核在3周后，需针对检查表86项准备提交资料', '上传检查表（Excel）', '返回各项对应的内部文件、记录以及证据不足的项目', '分配不足项目的负责人，制作提交资料清单'],
             en: ['Customer K process audit in 3 weeks; evidence for 86 checklist items is needed', 'Upload the checklist (Excel)', 'Get each item mapped to internal documents and records, with evidence gaps flagged', 'Assign owners for the gaps and build the submission list'] },
    input: { ja: { files: ['K社_工程監査チェックリスト_2025.xlsx', '前回監査_指摘事項_2024.pdf'] },
             zh: { files: ['K公司_工艺审核检查表_2025.xlsx', '上次审核_指出事项_2024.pdf'] } },
    result: {
      ja: { title: '工程監査 対応状況（K 社 2025 年度／86 項目）',
            columns: ['区分', '項目数', '証拠あり', '証拠不足', '主な不足項目'],
            rows: [
              ['1. 品質マネジメント', '12', '12', '0', '—'],
              ['2. 工程管理（CP・作業標準）', '24', '21', '3', '2.7 作業標準書の改訂履歴（ライン 3）／2.11 検査員の資格更新記録／2.18 特殊特性の SPC データ（直近 3 か月）'],
              ['3. 設備・金型・治具', '14', '13', '1', '3.6 金型点検記録の承認印（7 月分）'],
              ['4. 変更管理・トレーサビリティ', '10', '8', '2', '4.3 ECR の顧客承認記録（ECR-25-0031）／4.7 ロット逆引きテスト結果'],
              ['5. 不適合・是正', '14', '14', '0', '前回指摘 3 件は是正完了・効果確認済み'],
              ['6. 物流・包装・識別', '12', '11', '1', '6.9 包装仕様書の最新版（K 社様式 Rev.B）']
            ] },
      zh: { title: '工艺审核 应对状况（K公司 2025年度／86项）',
            columns: ['类别', '项目数', '有证据', '证据不足', '主要不足项目'],
            rows: [
              ['1. 质量管理', '12', '12', '0', '—'],
              ['2. 工序管理（CP・作业标准）', '24', '21', '3', '2.7 作业标准书修订履历（3号线）／2.11 检验员资格更新记录／2.18 特殊特性SPC数据（近3个月）'],
              ['3. 设备・模具・治具', '14', '13', '1', '3.6 模具点检记录的批准签章（7月份）'],
              ['4. 变更管理・追溯', '10', '8', '2', '4.3 ECR客户承认记录（ECR-25-0031）／4.7 批次反查测试结果'],
              ['5. 不合格・纠正', '14', '14', '0', '上次指出3项已完成纠正并确认效果'],
              ['6. 物流・包装・标识', '12', '11', '1', '6.9 包装规格书最新版（K公司格式 Rev.B）']
            ] } },
    script: {
      ja: [
        { q: '【アップロード】K社_工程監査チェックリスト_2025.xlsx、前回監査_指摘事項_2024.pdf', a: '86 項目を社内の管理文書・記録と紐づけました。証拠が揃っているのは 79 項目、**不足は 7 項目**です（右の表）。前回指摘 3 件はすべて是正完了・効果確認済みで、証拠も揃っています。不足 7 項目のうち急ぐのは 2.18 の SPC データ（直近 3 か月分の抽出に生産技術の作業が要る）と 4.3 の ECR 顧客承認記録（K 社側からの返信メールを探す必要あり）です。' },
        { q: '不足 7 項目の担当と期限を割り振って', a: '割り振り案（監査 9/27 の 1 週間前＝9/20 を締切に）：\n・2.7 作業標準書 改訂履歴（L3）：生産技術課 王 → 9/13\n・2.11 検査員 資格更新記録：品質保証課 周 → 9/10\n・2.18 特殊特性 SPC データ：生産技術課 王 → 9/17（抽出に 3 日）\n・3.6 金型点検記録 承認印：設備保全課 劉 → 9/10\n・4.3 ECR-25-0031 顧客承認記録：営業 高橋 → 9/12（K 社に再送依頼）\n・4.7 ロット逆引きテスト：品質保証課 周 → 9/15（BOM 逆引きで実施・記録）\n・6.9 包装仕様書 Rev.B：物流課 → 9/12\n担当者への依頼メール（中国語）も作成できます。' },
        { q: '監査当日の提出資料一覧を作って', a: '提出資料一覧（K 社工程監査 2025-09-27）\n区分ごとにフォルダ分けし、ファイル名は「項目番号_文書名_版」で統一：\n・01_品質マニュアル_v6／01_品質目標実績_2025上期\n・02_コントロールプラン_SK-3310-A_RevE／02_作業標準書_L3_一覧と改訂履歴／02_検査員資格一覧_2025／02_SPC_特殊特性_2025-06〜08\n・03_設備点検記録_2025／03_金型点検記録_2025（7 月分 承認印済）\n・04_ECR 一覧_2025／04_ECR-25-0031_顧客承認／04_ロット逆引きテスト_2025-09\n・05_不適合一覧_2025／05_前回指摘_是正報告 3 件\n・06_包装仕様書_RevB／06_識別ラベル見本\n計 86 項目分・ファイル 41 件。日本語資料には中国語の表紙（項目対応表）を付けることを推奨します。' }
      ],
      zh: [
        { q: '【上传】K公司_工艺审核检查表_2025.xlsx、上次审核_指出事项_2024.pdf', a: '已将86项与内部管理文件、记录关联。证据齐全79项，**不足7项**（见右表）。上次指出的3项均已完成纠正并确认效果，证据齐全。7项不足中较紧急的是 2.18 SPC数据（提取近3个月数据需生产技术操作）和 4.3 ECR客户承认记录（需查找K公司的回复邮件）。' },
        { q: '把不足的7项分配负责人和期限', a: '分配方案（以审核9/27前1周＝9/20为截止）：\n・2.7 作业标准书修订履历（L3）：生产技术科 王 → 9/13\n・2.11 检验员资格更新记录：品质保证科 周 → 9/10\n・2.18 特殊特性SPC数据：生产技术科 王 → 9/17（提取需3天）\n・3.6 模具点检记录批准签章：设备保全科 刘 → 9/10\n・4.3 ECR-25-0031 客户承认记录：销售 高桥 → 9/12（请K公司重发）\n・4.7 批次反查测试：品质保证科 周 → 9/15（用BOM反查实施并记录）\n・6.9 包装规格书 Rev.B：物流科 → 9/12\n也可为您生成给各负责人的委托邮件。' },
        { q: '生成审核当天的提交资料清单', a: '提交资料清单（K公司工艺审核 2025-09-27）\n按类别分文件夹，文件名统一为「项目号_文件名_版本」：\n・01_质量手册_v6／01_质量目标实绩_2025上半年\n・02_控制计划_SK-3310-A_RevE／02_作业标准书_L3_清单与修订履历／02_检验员资格清单_2025／02_SPC_特殊特性_2025-06〜08\n・03_设备点检记录_2025／03_模具点检记录_2025（7月份已签章）\n・04_ECR清单_2025／04_ECR-25-0031_客户承认／04_批次反查测试_2025-09\n・05_不合格清单_2025／05_上次指出_纠正报告3件\n・06_包装规格书_RevB／06_标识标签样本\n共86项・41个文件。建议为日文资料加上中文封面（项目对应表）。' }
      ] } },

  /* ---------------- dc: 文書・資料作成 ---------------- */
  dc1: { template: 'form',
    persona: { name: { ja: '小林 誠', zh: '小林诚', en: 'Makoto Kobayashi' },
               role: { ja: '工場長', zh: '厂长', en: 'Plant Manager' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'ja' },
    steps: { ja: ['毎月 5 日の本社経営会議向けに月次報告を作る。現場の数字は中国語の日報・月報にしかない', '実績数字とトピックスをフォームに入力（中国語の貼り付け可）', '本社フォーマット（要旨・実績・課題・対策）の日本語ドラフトが返る', '数字の根拠を確認し、体裁を整えて提出'],
             zh: ['要为每月5日的总部经营会议制作月报，现场数据只有中文日报、月报', '在表单中填写实绩数字与要点（可粘贴中文）', '返回总部格式（要点・实绩・课题・对策）的日文草案', '确认数字依据、整理版式后提交'],
             en: ['Monthly report for HQ management meeting on the 5th; shop-floor figures exist only in Chinese', 'Enter figures and topics in the form (Chinese paste OK)', 'Get a Japanese draft in HQ format (summary, results, issues, actions)', 'Check the sources and submit'] },
    input: { ja: { fields: [
              { label: '対象月', value: '2025 年 8 月' },
              { label: '実績（中国語貼り付け可）', value: '产量 186,400件（计划 190,000）。不良率 0.42%（目标 0.40%）。稼动率 87.2%。加班 2,140h。安全：无事故（连续 412天）。' },
              { label: 'トピックス', value: 'K 社クレーム 1 件（塗装ブツ、8D 提出済）／材料 S 社 +9% 値上げ通知／新人 12 名入社' },
              { label: '出力言語', value: '日本語（本社フォーマット）' } ] },
             zh: { fields: [
              { label: '对象月份', value: '2025年8月' },
              { label: '实绩（可粘贴中文）', value: '产量 186,400件（计划 190,000）。不良率 0.42%（目标 0.40%）。稼动率 87.2%。加班 2,140h。安全：无事故（连续 412天）。' },
              { label: '要点', value: 'K公司客诉1件（涂装颗粒，8D已提交）／材料S公司涨价+9%通知／新员工12名入职' },
              { label: '输出语言', value: '日文（总部格式）' } ] } },
    result: {
      ja: { title: '蘇州工場 月次報告 2025 年 8 月（本社経営会議用ドラフト）',
            items: [
              { k: '1. 要旨', v: '生産は計画比 98.1%（K 社の需要調整による）。不良率 0.42% で目標未達（塗装ブツ 1 件が主因、是正処置実施中）。安全は無事故継続 412 日。材料値上げへの対応（サプライヤー切替）を 12 月切替目標で進行中。' },
              { k: '2. 実績', v: '・生産数：186,400 個（計画 190,000、達成率 98.1%）\n・不良率：0.42%（目標 0.40%、前月 0.38%）\n・設備稼働率：87.2%（前月 86.5%）\n・残業時間：2,140 h（前月比 ▲6%）\n・安全：無事故 412 日継続' },
              { k: '3. 課題', v: '① 塗装工程の外観不良（K 社クレーム 1 件、CL-25-0906）\n② 材料 S 社の値上げ +9%（年間影響 約 RMB 420 千）\n③ 新人 12 名の早期立ち上げ（教育計画）' },
              { k: '4. 対策・見通し', v: '① 脱脂液濃度管理強化・フィルター交換基準見直し、9 月中に効果確認\n② T 社への切替を ECR-25-0088 で申請、K 社承認を経て 12 月ロットから\n③ 9 月に OJT 資料を中国語で整備、10 月末に技能認定\n9 月見通し：生産 192,000 個、不良率 0.38% 以下' }
            ] },
      zh: { title: '苏州工厂 月度报告 2025年8月（总部经营会议用草案・日文内容的中文对照）',
            items: [
              { k: '1. 要点', v: '产量为计划的98.1%（K公司需求调整）。不良率0.42%未达目标（主因为涂装颗粒1件，纠正措施实施中）。安全无事故持续412天。应对材料涨价（切换供应商）以12月切换为目标推进中。' },
              { k: '2. 实绩', v: '・产量：186,400件（计划190,000，达成率98.1%）\n・不良率：0.42%（目标0.40%，上月0.38%）\n・设备稼动率：87.2%（上月86.5%）\n・加班时间：2,140 h（环比 ▲6%）\n・安全：无事故持续412天' },
              { k: '3. 课题', v: '① 涂装工序外观不良（K公司客诉1件，CL-25-0906）\n② 材料S公司涨价+9%（年影响约 RMB 420千）\n③ 新员工12名的快速上岗（培训计划）' },
              { k: '4. 对策・展望', v: '① 强化脱脂液浓度管理、修订过滤器更换基准，9月内确认效果\n② 以 ECR-25-0088 申请切换T公司，经K公司承认后从12月批次起\n③ 9月完善中文OJT资料，10月底技能认定\n9月展望：产量192,000件，不良率≤0.38%' }
            ] } },
    script: {
      ja: [
        { q: '【フォーム送信】2025 年 8 月／実績（中国語）／トピックス 3 件／日本語・本社フォーマット', a: '中国語の実績を読み取り、本社フォーマット 4 章（要旨・実績・課題・対策）の日本語ドラフトを作成しました（右の結果）。数字は入力値をそのまま使い、前月比は 7 月報告の値を参照しています。年間影響額 RMB 420 千は「S 社購入額 年 4.7M × 9%」で試算した参考値なので、財務課の確認をおすすめします。' },
        { q: '要旨をもう少し前向きな書き方にして。ただし不良率未達は隠さないで', a: '要旨（修正案）：\n「8 月は K 社の需要調整を受け計画比 98.1% の生産となりましたが、稼働率は 87.2% と前月から改善し、残業時間も 6% 削減しました。不良率は 0.42% と目標 0.40% に対し未達で、塗装工程の外観不良（K 社クレーム 1 件）が主因です。原因は特定済みで是正処置を実施中、9 月中に効果を確認します。安全は無事故 412 日を継続しています。材料値上げについては 12 月のサプライヤー切替でコスト影響を抑える計画です。」' },
        { q: '課題②の年間影響額の根拠を脚注で付けて', a: '脚注を追加しました：\n「※ 年間影響額 RMB 420 千は、S 社からの年間購入額 RMB 4.7M（2024 年度実績）に値上げ率 9% を乗じた試算値。T 社への切替（12 月〜）が計画どおり進んだ場合、2025 年度の実影響は RMB 105 千（1〜3 月分）に縮小する見込み。」\n財務課 中村さんへの確認依頼メモも併せて作成しますか？' }
      ],
      zh: [
        { q: '【提交表单】2025年8月／实绩（中文）／要点3件／日文・总部格式', a: '已读取中文实绩，生成总部格式4章（要点・实绩・课题・对策）的日文草案（右侧为中文对照）。数字直接使用输入值，环比参照7月报告。年影响额 RMB 420千 是按「S公司采购额 年4.7M × 9%」试算的参考值，建议请财务科确认。' },
        { q: '要点写得更积极一点，但不要回避不良率未达', a: '要点（修改案，日文原文的中文对照）：\n「8月受K公司需求调整影响，产量为计划的98.1%，但稼动率提升至87.2%，加班时间也减少6%。不良率0.42%，未达0.40%目标，主因为涂装工序外观不良（K公司客诉1件）。原因已确定并正在实施纠正措施，9月内确认效果。安全无事故持续412天。针对材料涨价，计划通过12月切换供应商控制成本影响。」' },
        { q: '给课题②的年影响额加上依据脚注', a: '已添加脚注：\n「※ 年影响额 RMB 420千 为S公司年采购额 RMB 4.7M（2024年度实绩）乘以涨价率9%的试算值。若切换T公司（12月起）按计划推进，2025年度实际影响预计缩小至 RMB 105千（1〜3月份）。」\n是否同时生成给财务科中村的确认委托备忘？' }
      ] } },

  dc2: { template: 'upload',
    persona: { name: { ja: '呉 婷', zh: '吴婷', en: 'Wu Ting' },
               role: { ja: '工場長室 秘書・通訳', zh: '厂长办公室 秘书・翻译', en: 'Plant Manager Office Secretary & Interpreter' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['毎週月曜の生産会議（日本語・中国語が混在）の議事録を当日中に配布したい', '録音の文字起こしとホワイトボード写真のメモをアップロード', '決定事項・担当・期限・未決事項の議事録と、次回論点リストが返る', '日本語版・中国語版を同時に出力し、参加者へ配布'],
             zh: ['每周一生产会议（中日混杂）的纪要想在当天分发', '上传录音转写与白板照片笔记', '返回含决议、负责人、期限、待定事项的纪要及下次议题清单', '同时输出中日双语版并分发给参会者'],
             en: ['Minutes for the Monday production meeting (mixed JA/ZH) must go out the same day', 'Upload the transcript and whiteboard notes', 'Get minutes with decisions, owners, deadlines and open items, plus next agenda', 'Output Japanese and Chinese versions and distribute'] },
    input: { ja: { files: ['生産会議_0908_文字起こし.txt', 'ホワイトボード_0908.jpg'] },
             zh: { files: ['生产会议_0908_转写.txt', '白板_0908.jpg'] } },
    result: {
      ja: { title: '議事録：週次生産会議 2025-09-08（月）09:00–09:50',
            items: [
              { k: '出席', v: '小林工場長、李（製造二課）、王（生産技術）、陳（品質保証）、劉（設備保全）、高橋（営業）、呉（記録）' },
              { k: '決定事項', v: '1. ライン 3 の SUS304 深穴加工は条件表（Vc 20／f 0.06／ステップ 24mm）で本日から量産適用 — 王\n2. K 社クレーム CL-25-0906 の 8D（D1〜D3）は 9/9 提出。以降ロットは抜取 n=125 — 陳\n3. PX-200 のアラーム E-47 再発対策として金型 D-118 のガイド点検を 9/10 に実施 — 劉' },
              { k: 'ToDo（担当／期限）', v: '・ECR-25-0088（材料 T 社切替）を 9/15 までに起票 — 李\n・9 月生産計画 192,000 個の人員配置案 — 李／9/11\n・新人 12 名の OJT 資料（中国語）— 王／9/19\n・K 社監査 不足 7 項目の収集 — 周／9/20' },
              { k: '未決事項', v: '・国慶節連休（10/1〜10/8）の稼働日数：K 社の納入計画待ち（高橋が 9/12 までに確認）\n・残業上限（月 36h）超過者 4 名の扱い：人事と協議' },
              { k: '次回論点（9/15）', v: '1. 国慶節の稼働計画と人員確保\n2. 8D の D4〜D7 進捗と K 社の反応\n3. ECR-25-0088 の社内承認\n4. 残業上限超過者への対応方針' }
            ] },
      zh: { title: '会议纪要：周生产会议 2025-09-08（周一）09:00–09:50',
            items: [
              { k: '出席', v: '小林厂长、李（制造二科）、王（生产技术）、陈（品质保证）、刘（设备保全）、高桥（销售）、吴（记录）' },
              { k: '决议事项', v: '1. 3号线 SUS304 深孔加工按条件表（Vc 20／f 0.06／分段24mm）自今日起量产适用 — 王\n2. K公司客诉 CL-25-0906 的8D（D1〜D3）9/9提交。后续批次抽样 n=125 — 陈\n3. 针对 PX-200 报警 E-47 再发，9/10 实施模具 D-118 导向点检 — 刘' },
              { k: '待办（负责人／期限）', v: '・9/15 前填写 ECR-25-0088（材料切换T公司）— 李\n・9月生产计划192,000件的人员配置案 — 李／9/11\n・新员工12名的OJT资料（中文）— 王／9/19\n・K公司审核不足7项的收集 — 周／9/20' },
              { k: '待定事项', v: '・国庆假期（10/1〜10/8）的开工天数：等K公司交货计划（高桥9/12前确认）\n・加班上限（月36h）超出者4名的处理：与人事协商' },
              { k: '下次议题（9/15）', v: '1. 国庆开工计划与人员保障\n2. 8D的D4〜D7进度与K公司反馈\n3. ECR-25-0088 的内部审批\n4. 加班上限超出者的应对方针' }
            ] } },
    script: {
      ja: [
        { q: '【アップロード】生産会議_0908_文字起こし.txt、ホワイトボード_0908.jpg', a: '50 分の文字起こし（日本語 6 割・中国語 4 割）とホワイトボードの写真から、決定事項 3 件・ToDo 4 件・未決事項 2 件を整理しました（右の結果）。次回論点は未決事項と ToDo の期限から 4 件を提案しています。発言者が特定できなかった箇所が 2 か所あり、「担当：要確認」としています。' },
        { q: '国慶節の稼働日数の話、誰が確認するって言ってた？', a: '文字起こし 09:31 付近で、高橋さんが「K 社の 10 月納入計画が来週前半に来るので、それを見て稼働日を決めましょう」と発言し、小林工場長が「じゃあ 12 日までに」と返しています。担当は高橋さん、期限 9/12 で記載済みです。ホワイトボードにも「国庆 → 高桥 9/12」と書かれていました。' },
        { q: '中国語版も出して、参加者に配れる形にして', a: '出力しました：\n・議事録_生産会議_20250908_ja.docx\n・会议纪要_生产会议_20250908_zh.docx\n両版とも A4 1 枚、決定事項→ToDo→未決→次回論点の順です。配布メール（件名「【議事録／会议纪要】週次生産会議 9/8」、本文は日中併記 3 行）も作成しました。担当者名の後ろに期限を太字にしています。' }
      ],
      zh: [
        { q: '【上传】生产会议_0908_转写.txt、白板_0908.jpg', a: '根据50分钟的转写（日文约6成、中文约4成）与白板照片，整理出决议3件、待办4件、待定2件（见右侧结果）。下次议题根据待定事项与待办期限提出4项。有2处无法确定发言人，标注为「负责人：待确认」。' },
        { q: '国庆开工天数那件事，是谁说要确认的？', a: '转写 09:31 附近，高桥说「K公司10月交货计划下周前半会来，看了再定开工日」，小林厂长回答「那就12日前」。已记录负责人为高桥、期限9/12。白板上也写有「国庆 → 高桥 9/12」。' },
        { q: '也输出中文版，做成可以直接发给参会者的形式', a: '已输出：\n・会议纪要_生产会议_20250908_zh.docx\n・議事録_生産会議_20250908_ja.docx\n两版均为A4一页，顺序为决议→待办→待定→下次议题。同时生成了分发邮件（主题「【会议纪要／議事録】周生产会议 9/8」，正文中日对照3行）。负责人后的期限已加粗。' }
      ] } },

  dc3: { template: 'upload',
    persona: { name: { ja: '王 磊', zh: '王磊', en: 'Wang Lei' },
               role: { ja: '生産技術課 主任（教育担当兼務）', zh: '生产技术科 主管（兼培训担当）', en: 'Production Engineering Supervisor (Training Lead)' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['新人 12 名がライン 3 に配属。作業標準書は日本語版が最新で、中国語の教育資料がない', '作業標準書・過去の不具合事例・安全ルールをアップロード', '中国語のスライド構成・確認テスト・OJT チェックリストが返る', '監督者向けに日本語の指導ポイントを添えて教育を実施'],
             zh: ['12名新员工分配到3号线。作业标准书最新版是日文，没有中文培训资料', '上传作业标准书、历史不良案例、安全规则', '返回中文课件结构、确认测试与OJT检查表', '附上日文的监督者指导要点后实施培训'],
             en: ['12 new hires join Line 3; the latest work standard is Japanese and no Chinese training material exists', 'Upload the work standard, past defects and safety rules', 'Get a Chinese deck outline, quiz and OJT checklist', 'Add Japanese coaching points for supervisors and run the training'] },
    input: { ja: { files: ['作業標準書_L3_深穴加工_RevD.pdf', '不具合事例_L3_2024-2025.xlsx', '安全ルール_機械加工.docx'] },
             zh: { files: ['作业标准书_L3_深孔加工_RevD.pdf', '不良案例_L3_2024-2025.xlsx', '安全规则_机械加工.docx'] } },
    result: {
      ja: { title: '教育資料セット：ライン 3 深穴加工 新人向け（中国語主・日本語副）',
            items: [
              { k: 'スライド構成（12 枚・中国語）', v: '1 ライン 3 の製品と顧客 ／ 2 安全：巻き込み・切りくず・保護具 ／ 3 作業標準の全体フロー ／ 4–6 段取り・加工・検査の要点 ／ 7 条件表の読み方（Vc・f・ステップ） ／ 8 過去の不具合 3 事例（折損・寸法外れ・バリ） ／ 9 異常時の止め方と報告 ／ 10 5S と日常点検 ／ 11 確認テスト ／ 12 OJT の進め方' },
              { k: '確認テスト（10 問・中国語）', v: '例：Q3「ステップ送りを省略すると何が起きるか」／Q6「クーラント圧の下限は」／Q9「寸法外れを見つけたら最初にすることは」— 正答率 80% で合格' },
              { k: 'OJT チェックリスト（3 週間）', v: '第 1 週：見学と段取り補助（10 項目）／第 2 週：監督下で加工（12 項目）／第 3 週：単独作業と検査（8 項目）。各項目に指導者サイン欄' },
              { k: '監督者向け指導ポイント（日本語）', v: '・新人が省略しがちな「3D ごとのステップ送り」は理由（NC-2024-0118 の折損）と一緒に教える\n・条件表の数字を暗記させず「見に行く」習慣を付ける\n・異常時は「止める→呼ぶ→待つ」の順を徹底' }
            ] },
      zh: { title: '培训资料包：3号线 深孔加工 新员工用（中文为主・日文为辅）',
            items: [
              { k: '课件结构（12页・中文）', v: '1 3号线的产品与客户 ／ 2 安全：卷入・切屑・防护用品 ／ 3 作业标准整体流程 ／ 4–6 换型・加工・检验要点 ／ 7 条件表的读法（Vc・f・分段） ／ 8 历史不良3案例（断刀・尺寸超差・毛刺） ／ 9 异常时的停机与报告 ／ 10 5S与日常点检 ／ 11 确认测试 ／ 12 OJT的进行方式' },
              { k: '确认测试（10题・中文）', v: '例：Q3「省略分段进给会发生什么」／Q6「冷却液压力下限是多少」／Q9「发现尺寸超差首先要做什么」— 正确率80%合格' },
              { k: 'OJT检查表（3周）', v: '第1周：观摩与换型辅助（10项）／第2周：监督下加工（12项）／第3周：独立作业与检验（8项）。每项设指导者签字栏' },
              { k: '监督者指导要点（日文）', v: '・新人が省略しがちな「3D ごとのステップ送り」は理由（NC-2024-0118 の折損）と一緒に教える\n・条件表の数字を暗記させず「見に行く」習慣を付ける\n・異常時は「止める→呼ぶ→待つ」の順を徹底' }
            ] } },
    script: {
      ja: [
        { q: '【アップロード】作業標準書_L3_深穴加工_RevD.pdf、不具合事例_L3_2024-2025.xlsx、安全ルール_機械加工.docx', a: '3 文書から、中国語 12 枚のスライド構成・10 問の確認テスト・3 週間の OJT チェックリストを作成しました（右の結果）。不具合事例は 2024〜2025 年の 17 件から新人に関係が深い 3 件（折損・寸法外れ・バリ）を選んでいます。監督者向けの指導ポイントは日本語で添えました。' },
        { q: '確認テストの Q3 と Q6 の全文と答えを見せて', a: 'Q3（中国語）：「深孔加工时省略每3D的分段进给，最可能发生什么？ A. 表面粗糙度变差 B. 切屑堵塞导致断刀 C. 孔径变大 D. 没有影响」— 正答 B（根拠：NC-2024-0118）\nQ6：「内冷冷却液压力的下限是多少？ A. 1.0 MPa B. 1.5 MPa C. 2.0 MPa D. 3.0 MPa」— 正答 C（根拠：条件表 Rev.D）\n日本語訳も同時に表示できます。' },
        { q: 'スライド 8 の不具合事例を写真付きにしたい。何を用意すればいい？', a: '3 事例それぞれに「不良品の写真」と「良品との比較」があると効果的です。準備リスト：\n・折損（NC-2024-0118）：折れた工具先端の写真（品質保証課 保管品あり）\n・寸法外れ（NC-2025-0203）：ノギス測定中の写真＋図面の該当寸法\n・バリ（NC-2025-0417）：バリ有／無の穴の拡大写真\n写真がない場合は、スライドに「撮影依頼：担当・期日」の付箋を入れた版を出力します。' }
      ],
      zh: [
        { q: '【上传】作业标准书_L3_深孔加工_RevD.pdf、不良案例_L3_2024-2025.xlsx、安全规则_机械加工.docx', a: '根据3份文件，生成了12页中文课件结构、10题确认测试与3周OJT检查表（见右侧结果）。不良案例从2024〜2025年的17件中选取了与新人关系最密切的3件（断刀・尺寸超差・毛刺）。监督者指导要点以日文附上。' },
        { q: '给我看确认测试 Q3 和 Q6 的全文和答案', a: 'Q3：「深孔加工时省略每3D的分段进给，最可能发生什么？ A. 表面粗糙度变差 B. 切屑堵塞导致断刀 C. 孔径变大 D. 没有影响」— 正确答案 B（依据：NC-2024-0118）\nQ6：「内冷冷却液压力的下限是多少？ A. 1.0 MPa B. 1.5 MPa C. 2.0 MPa D. 3.0 MPa」— 正确答案 C（依据：条件表 Rev.D）\n也可同时显示日文译文。' },
        { q: '第8页的不良案例想配照片，需要准备什么？', a: '3个案例各配「不良品照片」和「与良品的对比」效果最好。准备清单：\n・断刀（NC-2024-0118）：折断刀尖照片（品质保证科有保管品）\n・尺寸超差（NC-2025-0203）：卡尺测量中的照片＋图纸对应尺寸\n・毛刺（NC-2025-0417）：有／无毛刺孔的放大照片\n若暂无照片，可输出带「拍摄委托：负责人・期限」便签的版本。' }
      ] } },

  dc4: { template: 'upload',
    persona: { name: { ja: '田中 浩二', zh: '田中浩二', en: 'Koji Tanaka' },
               role: { ja: '製造部 部長（安全衛生委員長）', zh: '制造部 部长（安全卫生委员长）', en: 'Manufacturing Director (Safety Committee Chair)' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'ja' },
    steps: { ja: ['本社から新しい安全衛生ルール（日本語）が届いた。現場掲示用に中国語化したい', '日本語のルール文書と、現場から集まった中国語の改善提案 3 件をアップロード', '掲示用の短い中国語文と図解見出し、改善提案の日本語整形版が返る', '掲示物を印刷し、改善提案を本社の改善事例集へ提出'],
             zh: ['总部发来新的安全卫生规则（日文），想做成现场看板的中文版', '上传日文规则文件与现场收集的3件中文改善提案', '返回适合张贴的中文短句、图示标题，以及改善提案的日文整理版', '打印看板，并将改善提案提交至总部改善案例集'],
             en: ['HQ sent new safety rules in Japanese; they need Chinese posters for the floor', 'Upload the Japanese rules and 3 Chinese kaizen proposals from the floor', 'Get poster-ready Chinese lines, illustration captions and Japanese versions of the proposals', 'Print the posters and submit the proposals to the HQ kaizen collection'] },
    input: { ja: { files: ['安全衛生ルール_2025改定_本社.docx', '改善提案_L2_3件.xlsx'] },
             zh: { files: ['安全卫生规则_2025修订_总部.docx', '改善提案_L2_3件.xlsx'] } },
    result: {
      ja: { title: '掲示物ドラフト：安全衛生ルール 2025 改定（中国語）＋ 改善提案 3 件（日本語整形）',
            items: [
              { k: '掲示 1：巻き込まれ防止（A3・横）', v: '見出し：转动部位，手不靠近！\n本文：① 运转中禁止伸手取工件 ② 停机 → 确认停止 → 再作业 ③ 手套只在指定工序使用\n図解：回転部と手の距離を示すピクト（本社様式 S-03 を流用）' },
              { k: '掲示 2：切りくず・保護具（A3・横）', v: '見出し：切屑很锋利，护目镜和手套要戴好\n本文：① 清理切屑用钩子和刷子，不用手 ② 加工区域必须佩戴护目镜 ③ 受伤立即报告班长，哪怕是小伤' },
              { k: '掲示 3：ヒヤリハット報告（A4・縦）', v: '見出し：差一点就出事？请告诉我们\n本文：① 不追究个人责任 ② 用手机扫码30秒即可提交 ③ 每月评选「最有价值报告」\n二维码：ヒヤリハットフォームの URL（総務が発行）' },
              { k: '改善提案の日本語整形（本社提出用）', v: '① 治具置き台の高さ変更（腰痛対策）：作業姿勢の改善で 1 日あたり屈伸 120 回削減。提案者：張小雨（製造二課）\n② クーラントタンクの液面マーク：補給判断を目視化、補給忘れ 0 件（8 月）。提案者：劉洋（設備保全）\n③ 不良品箱の色分け：赤＝不良／黄＝保留／緑＝良品。混入 2 件→0 件。提案者：李強チーム（製造二課）' }
            ] },
      zh: { title: '看板草案：安全卫生规则 2025修订（中文）＋ 改善提案3件（日文整理）',
            items: [
              { k: '看板1：防卷入（A3・横）', v: '标题：转动部位，手不靠近！\n正文：① 运转中禁止伸手取工件 ② 停机 → 确认停止 → 再作业 ③ 手套只在指定工序使用\n图示：表示转动部位与手距离的图标（沿用总部格式 S-03）' },
              { k: '看板2：切屑・防护用品（A3・横）', v: '标题：切屑很锋利，护目镜和手套要戴好\n正文：① 清理切屑用钩子和刷子，不用手 ② 加工区域必须佩戴护目镜 ③ 受伤立即报告班长，哪怕是小伤' },
              { k: '看板3：险肇报告（A4・竖）', v: '标题：差一点就出事？请告诉我们\n正文：① 不追究个人责任 ② 用手机扫码30秒即可提交 ③ 每月评选「最有价值报告」\n二维码：险肇报告表单URL（由总务发布）' },
              { k: '改善提案的日文整理（提交总部用）', v: '① 治具置き台の高さ変更（腰痛対策）：作業姿勢の改善で 1 日あたり屈伸 120 回削減。提案者：張小雨（製造二課）\n② クーラントタンクの液面マーク：補給判断を目視化、補給忘れ 0 件（8 月）。提案者：劉洋（設備保全）\n③ 不良品箱の色分け：赤＝不良／黄＝保留／緑＝良品。混入 2 件→0 件。提案者：李強チーム（製造二課）' }
            ] } },
    script: {
      ja: [
        { q: '【アップロード】安全衛生ルール_2025改定_本社.docx、改善提案_L2_3件.xlsx', a: '本社ルール 14 項目のうち現場掲示に向く 3 テーマ（巻き込まれ・切りくず／保護具・ヒヤリハット）を選び、中国語の掲示文を作成しました。掲示文は 1 行 15 字以内・3 項目までに絞っています。改善提案 3 件は本社の改善事例集の様式（効果を数字で）に合わせて日本語に整形しました（右の結果）。' },
        { q: '掲示 1 の見出し、もっと現場で目を引く言い方はある？', a: '候補 3 案：\n・「手别伸！机器不等人」（口語・強め。若手に響く）\n・「转动中，手远离」（簡潔・標準的。本社様式に近い）\n・「一秒的疏忽，一辈子的后悔」（情緒的。ベテラン向け）\n現場の年齢層が 20〜30 代中心なら 1 案目を推奨します。本社の日本語原文「回転部に手を近づけない」の意味からは外れていません。' },
        { q: '改善提案②の効果「補給忘れ 0 件」は何と比べて 0 件？', a: '提案シートの記載では「7 月：補給忘れ 3 件（うち 1 件は加工面不良につながった）→ 8 月：0 件」です。日本語整形版に比較対象を追記します：「補給忘れ 3 件（7 月）→ 0 件（8 月）。不良の未然防止 1 件」。本社様式では Before/After を並べる欄があるので、そこに転記しました。' }
      ],
      zh: [
        { q: '【上传】安全卫生规则_2025修订_总部.docx、改善提案_L2_3件.xlsx', a: '从总部14条规则中选出适合现场张贴的3个主题（防卷入・切屑／防护用品・险肇报告），生成中文看板文案。文案控制在每行15字以内、每张3条。3件改善提案已按总部改善案例集格式（效果用数字表示）整理为日文（见右侧结果）。' },
        { q: '看板1的标题，有没有更吸引现场注意的说法？', a: '3个候选：\n・「手别伸！机器不等人」（口语・强调。对年轻人有效）\n・「转动中，手远离」（简洁・标准。接近总部格式）\n・「一秒的疏忽，一辈子的后悔」（情感型。适合老员工）\n若现场以20〜30岁为主，推荐第1个。均未偏离总部日文原文「回転部に手を近づけない」的含义。' },
        { q: '改善提案②的效果「补液遗忘0件」是和什么比较的？', a: '提案表记载为「7月：补液遗忘3件（其中1件导致加工面不良）→ 8月：0件」。已在日文整理版补充比较对象：「補給忘れ 3 件（7 月）→ 0 件（8 月）。不良の未然防止 1 件」。总部格式有 Before/After 并列栏，已转录至该栏。' }
      ] } },

  dc5: { template: 'form',
    persona: { name: { ja: '李 強', zh: '李强', en: 'Li Qiang' },
               role: { ja: '製造二課 課長', zh: '制造二科 科长', en: 'Manufacturing Sec. 2 Manager' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['塗装ラインの乾燥炉を更新したい。稟議書を書くのは年に 1 回程度で書式に慣れていない', '件名・金額・目的・見積の有無をフォームに入力', '社内フォーマットの稟議書ドラフトと、承認ルート・記載漏れ・添付漏れが返る', '漏れを埋めて工場長へ提出'],
             zh: ['想更新涂装线的烘干炉，审批单一年才写一次，不熟悉格式', '在表单中填写标题、金额、目的、有无报价', '返回公司格式的审批单草案、审批路径以及填写与附件缺漏', '补齐缺漏后提交厂长'],
             en: ['Wants to replace the paint-line drying oven; writes approval requests only once a year', 'Enter title, amount, purpose and whether quotes exist', 'Get a draft in the corporate format with the approval route and missing items', 'Fill the gaps and submit to the plant manager'] },
    input: { ja: { fields: [
              { label: '件名', value: '塗装ライン 乾燥炉 更新' },
              { label: '金額（税込）', value: 'RMB 1,850,000' },
              { label: '目的・背景', value: '現行炉は 2011 年導入。温度ムラ ±8℃（基準 ±5℃）で塗膜硬化不足が 8 月に 2 件。修理部品の供給終了。' },
              { label: '見積', value: 'メーカー 2 社から取得済み（A 社 1,850,000／B 社 2,020,000）' } ] },
             zh: { fields: [
              { label: '标题', value: '涂装线 烘干炉 更新' },
              { label: '金额（含税）', value: 'RMB 1,850,000' },
              { label: '目的・背景', value: '现有炉2011年导入。温度不均 ±8℃（基准 ±5℃），8月发生2件涂膜固化不足。维修配件停止供应。' },
              { label: '报价', value: '已取得2家厂商报价（A公司 1,850,000／B公司 2,020,000）' } ] } },
    result: {
      ja: { title: '稟議書ドラフト RG-25-0117（設備投資・ルート B：課長→部長→工場長→本社設備部）',
            items: [
              { k: '1. 件名', v: '塗装ライン 乾燥炉 更新（A 社製 DO-3200 型）' },
              { k: '2. 目的・背景', v: '現行乾燥炉（2011 年導入、14 年経過）の温度ムラが ±8℃ と基準 ±5℃ を超え、2025 年 8 月に塗膜硬化不足による不良 2 件（NC-2025-0812、0829）が発生。メーカーの修理部品供給が 2025 年末で終了するため、計画的な更新を申請する。' },
              { k: '3. 金額・比較', v: 'A 社 RMB 1,850,000（税込、据付・試運転含む）／B 社 RMB 2,020,000。A 社を選定（同等性能で 8.4% 安価、納期 10 週）。' },
              { k: '4. 効果', v: '温度ムラ ±3℃ 以内（メーカー保証）。硬化不足不良の撲滅（年間損失 約 RMB 96 千）。エネルギー消費 ▲18%（年間 RMB 62 千）。投資回収 約 11.7 年→**要確認**（回収期間が長いため、生産能力・品質リスク回避を主効果として記載することを推奨）。' },
              { k: '5. スケジュール', v: '承認 10 月中 → 発注 11/1 → 納入 1 月中旬 → 春節連休中に据付（2/16〜2/22）→ 2 月末 量産' },
              { k: '承認ルート判定', v: 'RMB 1,000,000 超の設備投資 → **ルート B**（製造二課長 → 製造部長 → 工場長 → 本社設備部 → 本社経営会議）。本社分は日本語版が必要。' },
              { k: '記載漏れ・添付漏れ', v: '❗ 見積書 2 社分の添付なし\n❗ 「予算区分」欄が未記入（2025 年度 設備予算に計上済みか）\n❗ 据付時の生産影響（塗装ライン停止 7 日）と代替手段の記載なし\n⚠ 効果欄の投資回収年数が長い。品質・供給リスクを主効果に' }
            ] },
      zh: { title: '审批单草案 RG-25-0117（设备投资・路径B：科长→部长→厂长→总部设备部）',
            items: [
              { k: '1. 标题', v: '涂装线 烘干炉 更新（A公司 DO-3200 型）' },
              { k: '2. 目的・背景', v: '现有烘干炉（2011年导入，已14年）温度不均 ±8℃，超出基准 ±5℃，2025年8月发生2件因涂膜固化不足导致的不良（NC-2025-0812、0829）。厂商维修配件将于2025年底停止供应，故申请计划性更新。' },
              { k: '3. 金额・比较', v: 'A公司 RMB 1,850,000（含税，含安装与试运行）／B公司 RMB 2,020,000。选定A公司（性能相当且便宜8.4%，交期10周）。' },
              { k: '4. 效果', v: '温度不均 ±3℃ 以内（厂商保证）。杜绝固化不足不良（年损失约 RMB 96千）。能耗 ▲18%（年 RMB 62千）。投资回收约11.7年→**待确认**（回收期较长，建议以产能与质量风险规避作为主要效果）。' },
              { k: '5. 日程', v: '10月内审批 → 11/1 下单 → 1月中旬到货 → 春节假期安装（2/16〜2/22）→ 2月底量产' },
              { k: '审批路径判定', v: '超过 RMB 1,000,000 的设备投资 → **路径B**（制造二科长 → 制造部长 → 厂长 → 总部设备部 → 总部经营会议）。总部部分需日文版。' },
              { k: '填写・附件缺漏', v: '❗ 未附2家报价单\n❗ 「预算类别」栏未填（是否已列入2025年度设备预算）\n❗ 未记载安装期间的生产影响（涂装线停机7天）及替代方案\n⚠ 效果栏投资回收期较长。建议以质量与供应风险为主要效果' }
            ] } },
    script: {
      ja: [
        { q: '【フォーム送信】塗装ライン乾燥炉更新／RMB 1,850,000／温度ムラ・部品供給終了／見積 2 社', a: '稟議書ドラフトを社内フォーマット 5 章で作成しました（右の結果）。金額が RMB 1,000,000 を超えるため承認ルートは **B（本社設備部・経営会議まで）**で、本社向けの日本語版が必要です。記載漏れが 3 件（見積添付・予算区分・据付時の生産影響）あります。効果欄の投資回収が 11.7 年と長いので、品質・供給リスク回避を主効果に書き換えることを推奨します。' },
        { q: '据付時の生産影響はどう書けばいい？塗装は 7 日止まる', a: '記載例（5. スケジュールの下に「6. 生産への影響と対策」として追加）：\n「据付期間 2026/2/16〜2/22 の 7 日間、塗装ラインを停止する。春節連休（2/15〜2/21）と重ねることで実質の稼働影響は 1 日。連休前の 2 月上旬に塗装工程を 1.5 日分前倒しし、K 社向け在庫を 5 日分確保する。万一据付が遅延した場合は、塗装外注 S 社への一時委託（単価 +12%、最大 3 日分）で対応する。」\n春節と重ねる案は工場カレンダーから拾いました。人事に連休中の据付立会い（2 名）の残業扱いを確認してください。' },
        { q: '本社向けの日本語版で、金額は円換算も併記して', a: '本社向け日本語版を作成しました。金額欄：「RMB 1,850,000（約 ¥38,850,000、1 RMB = ¥21.0 で換算、2025/9/5 社内レート）」。B 社比較も同様に併記しています。本社の稟議様式では「投資区分：更新投資」「償却年数：10 年」の欄があるため追記しました。工場長の押印後、本社設備部へ提出する送付状（日本語）も添えています。' }
      ],
      zh: [
        { q: '【提交表单】涂装线烘干炉更新／RMB 1,850,000／温度不均・配件停供／2家报价', a: '已按公司格式5章生成审批单草案（见右侧结果）。金额超过 RMB 1,000,000，审批路径为 **B（到总部设备部・经营会议）**，需要日文版。填写缺漏3项（报价附件・预算类别・安装期间生产影响）。效果栏投资回收11.7年偏长，建议改为以质量与供应风险规避为主要效果。' },
        { q: '安装期间的生产影响怎么写？涂装要停7天', a: '记载示例（在「5. 日程」下增加「6. 对生产的影响与对策」）：\n「安装期间 2026/2/16〜2/22 共7天涂装线停机。与春节假期（2/15〜2/21）重叠，实际稼动影响为1天。假期前的2月上旬将涂装工序提前1.5天，确保K公司用库存5天。若安装延迟，通过临时委托涂装外协S公司（单价+12%，最多3天）应对。」\n与春节重叠的方案取自工厂日历。请与人事确认假期中安装监督（2人）的加班处理。' },
        { q: '日文版给总部的话，金额并列标注日元换算', a: '已生成总部用日文版。金额栏：「RMB 1,850,000（約 ¥38,850,000、1 RMB = ¥21.0 で換算、2025/9/5 社内レート）」。B公司比较同样并列标注。总部审批格式有「投資区分：更新投資」「償却年数：10 年」栏，已补充。同时附上厂长签章后提交总部设备部的日文送付状。' }
      ] } },

  dc6: { template: 'upload',
    persona: { name: { ja: '孫 麗', zh: '孙丽', en: 'Sun Li' },
               role: { ja: '物流課 輸出入担当', zh: '物流科 进出口担当', en: 'Import/Export Coordinator, Logistics' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['日本本社向けの輸出（保税区経由）で、先月インボイスの品名不一致で通関が 2 日止まった', '今回のインボイス・パッキングリスト・契約書をアップロード', '書類間の不整合と、通関で差し戻されやすい点が返る', '修正して通関業者へ送付。加工貿易手冊の消し込み書類も確認'],
             zh: ['向日本总部出口（经保税区），上月因发票品名不一致报关被卡2天', '上传本次发票、装箱单、合同', '返回单证之间的不一致及易被退单的问题', '修正后发给报关行，同时确认加工贸易手册核销单证'],
             en: ['Exports to HQ via the bonded zone; last month customs held the shipment 2 days over a name mismatch', 'Upload the invoice, packing list and contract', 'Get cross-document inconsistencies and likely customs rejections', 'Fix and send to the broker; confirm processing-trade handbook documents'] },
    input: { ja: { files: ['INV-2025-0906.xlsx', 'PL-2025-0906.xlsx', '売買契約_本社_2025.pdf'] },
             zh: { files: ['INV-2025-0906.xlsx', 'PL-2025-0906.xlsx', '销售合同_总部_2025.pdf'] } },
    result: {
      ja: { title: '通関書類チェック：INV-2025-0906（蘇州 → 日本本社、保税区経由、加工貿易手冊 C-2025-118）',
            columns: ['#', '項目', 'インボイス', 'パッキングリスト', '契約書／手冊', '判定'],
            rows: [
              ['1', '品名（SK-3310-A）', 'Bracket, steel, painted', 'Bracket assy', '钢制支架（涂装）', '❗ 不一致：3 書類で表記が違う。先月の差し戻し原因と同じ。手冊登録名「钢制支架」に統一'],
              ['2', '数量', '2,400 PCS', '2,400 PCS（24 箱 × 100）', '契約：月 2,000〜3,000', '✅'],
              ['3', 'HS コード', '8708.29', '—', '手冊：8708.29', '✅'],
              ['4', '原産地', 'CN', 'CN', '—', '✅'],
              ['5', '単価 / 金額', 'USD 4.20 / 10,080.00', '—', '契約：USD 4.20', '✅'],
              ['6', '正味重量', '—', '1,296 kg', '手冊 単重 0.54 kg × 2,400 = 1,296', '✅'],
              ['7', 'インコタームズ', 'FOB Shanghai', '—', '契約：FOB Shanghai', '✅'],
              ['8', '手冊 残量', '—', '—', '手冊 C-2025-118 の輸出残量 3,100 個', '⚠ 今回 2,400 出荷後の残量 700。次回出荷（10 月 2,400 予定）前に手冊の延長／新規が必要']
            ] },
      zh: { title: '报关单证核对：INV-2025-0906（苏州 → 日本总部，经保税区，加工贸易手册 C-2025-118）',
            columns: ['#', '项目', '发票', '装箱单', '合同／手册', '判定'],
            rows: [
              ['1', '品名（SK-3310-A）', 'Bracket, steel, painted', 'Bracket assy', '钢制支架（涂装）', '❗ 不一致：3份单证写法不同，与上月退单原因相同。统一为手册登记名「钢制支架」'],
              ['2', '数量', '2,400 PCS', '2,400 PCS（24箱 × 100）', '合同：月 2,000〜3,000', '✅'],
              ['3', 'HS编码', '8708.29', '—', '手册：8708.29', '✅'],
              ['4', '原产地', 'CN', 'CN', '—', '✅'],
              ['5', '单价 / 金额', 'USD 4.20 / 10,080.00', '—', '合同：USD 4.20', '✅'],
              ['6', '净重', '—', '1,296 kg', '手册 单重 0.54 kg × 2,400 = 1,296', '✅'],
              ['7', '贸易术语', 'FOB Shanghai', '—', '合同：FOB Shanghai', '✅'],
              ['8', '手册余量', '—', '—', '手册 C-2025-118 出口余量 3,100件', '⚠ 本次出货2,400后余量700。下次出货（10月预定2,400）前需办理手册延期／新办']
            ] } },
    script: {
      ja: [
        { q: '【アップロード】INV-2025-0906.xlsx、PL-2025-0906.xlsx、売買契約_本社_2025.pdf', a: '3 書類と加工貿易手冊 C-2025-118 を照合し、8 項目をチェックしました（右の表）。**要修正は 1 件**：品名が 3 書類で異なります（先月の差し戻しと同じ原因）。手冊登録名の「钢制支架（涂装）」／英文「Steel bracket, painted」に統一してください。また手冊の輸出残量が今回出荷後 700 個になり、10 月の出荷分に足りません。' },
        { q: '手冊の残量が足りない場合、何をいつまでにすればいい？', a: '手冊の残量不足は 2 つの対応があります。\n・**延長・増量申請**（既存手冊 C-2025-118 の数量変更）：海関の審査 5〜7 営業日。10 月出荷（10/20 予定）に間に合わせるなら 10/8 までに申請\n・**新規手冊**：契約書・BOM・単耗表の再提出が要り、10〜15 営業日\n今回は数量変更で足りるので延長を推奨します。必要書類：数量変更申請書、変更後の契約書（本社と締結、月 2,000〜3,000 → 年間上限を明記）、直近 3 か月の輸出実績。国慶節連休（10/1〜8）は海関が休みなので、**9/26 までの提出**を強く推奨します。' },
        { q: 'インボイスの品名を修正した版を出して、通関業者へのメールも作って', a: 'INV-2025-0906_rev1.xlsx を出力しました。品名欄：「Steel bracket, painted（钢制支架（涂装））SK-3310-A」。パッキングリストも同じ表記に揃えた PL-2025-0906_rev1.xlsx を併せて出力しています。\n通関業者へのメール（中国語）：\n「王经理，您好：附上 INV-2025-0906 与 PL 的修订版（rev1），已将品名统一为手册登记名「钢制支架（涂装）」。请以此版本申报。另，手册 C-2025-118 出口余量在本次出货后为700件，我们将于9/26前提交数量变更申请，届时请协助办理。青岭精工 物流科 孙丽」' }
      ],
      zh: [
        { q: '【上传】INV-2025-0906.xlsx、PL-2025-0906.xlsx、销售合同_总部_2025.pdf', a: '已将3份单证与加工贸易手册 C-2025-118 对照，核对8项（见右表）。**需修正1项**：品名在3份单证中不一致（与上月退单原因相同）。请统一为手册登记名「钢制支架（涂装）」／英文「Steel bracket, painted」。另外，手册出口余量在本次出货后为700件，不足以覆盖10月出货。' },
        { q: '手册余量不够的话，需要做什么、什么时候之前？', a: '手册余量不足有2种对应：\n・**延期・增量申请**（变更现有手册 C-2025-118 的数量）：海关审核5〜7个工作日。要赶上10月出货（10/20预定）需在10/8前申请\n・**新办手册**：需重新提交合同、BOM、单耗表，10〜15个工作日\n本次数量变更即可，推荐延期。所需材料：数量变更申请书、变更后合同（与总部签订，月2,000〜3,000 → 明确年度上限）、近3个月出口实绩。国庆假期（10/1〜8）海关休息，**强烈建议9/26前提交**。' },
        { q: '输出修正品名后的发票，并写一封给报关行的邮件', a: '已输出 INV-2025-0906_rev1.xlsx。品名栏：「Steel bracket, painted（钢制支架（涂装））SK-3310-A」。装箱单也统一为相同写法，一并输出 PL-2025-0906_rev1.xlsx。\n给报关行的邮件：\n「王经理，您好：附上 INV-2025-0906 与 PL 的修订版（rev1），已将品名统一为手册登记名「钢制支架（涂装）」。请以此版本申报。另，手册 C-2025-118 出口余量在本次出货后为700件，我们将于9/26前提交数量变更申请，届时请协助办理。青岭精工 物流科 孙丽」' }
      ] } },

  dc7: { template: 'form',
    persona: { name: { ja: '中村 大輔', zh: '中村大辅', en: 'Daisuke Nakamura' },
               role: { ja: '管理部 財務・法務 駐在員', zh: '管理部 财务法务 驻在员', en: 'Finance & Legal Expatriate' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'ja' },
    steps: { ja: ['新サプライヤー T 社との取引開始に向け、品質保証協定を結ぶ。T 社から中国語の案文が届いた', '契約類型・相手・主要条件をフォームに入力（T 社案文の貼り付け可）', '社内標準条項ベースの中国語ドラフト・日本語対訳・T 社案文との相違点が返る', '法務レビュー依頼を本社法務へ送り、T 社と条件交渉'],
             zh: ['为与新供应商T公司开始交易，需签订质量保证协议。T公司发来了中文草案', '在表单中填写合同类型、对象、主要条件（可粘贴T公司草案）', '返回基于公司标准条款的中文草案、日文对照及与T公司草案的差异', '向总部法务发送审核委托，并与T公司协商条件'],
             en: ['A quality assurance agreement is needed with new supplier T, who sent a Chinese draft', 'Enter the contract type, counterparty and key terms (paste T draft)', 'Get a Chinese draft on standard clauses, Japanese parallel text and differences from T draft', 'Send for legal review at HQ and negotiate with T'] },
    input: { ja: { fields: [
              { label: '契約類型', value: '品質保証協定（サプライヤー）' },
              { label: '相手方', value: 'T 社（鋼板サプライヤー、江蘇省）' },
              { label: '主要条件', value: '対象：SPCC 鋼板。受入検査：ミルシート添付・抜取。不良時：24 時間以内に回答、代替品 5 営業日、責任範囲は直接損害＋ライン停止費用。' },
              { label: '相手方案文', value: 'T 社案文 第 8 条：「供方对质量问题的赔偿责任以该批次货款金额为限」' } ] },
             zh: { fields: [
              { label: '合同类型', value: '质量保证协议（供应商）' },
              { label: '对方', value: 'T公司（钢板供应商，江苏省）' },
              { label: '主要条件', value: '对象：SPCC钢板。来料检验：附材质单・抽检。不良时：24小时内回复，5个工作日内提供替代品，责任范围为直接损失＋停线费用。' },
              { label: '对方草案', value: 'T公司草案 第8条：「供方对质量问题的赔偿责任以该批次货款金额为限」' } ] } },
    result: {
      ja: { title: '品質保証協定 ドラフト（青嶺精工（蘇州） × T 社）— 中国語正・日本語対訳',
            items: [
              { k: '構成（12 条）', v: '1 目的／2 定義／3 品質基準・ミルシート／4 受入検査と合否／5 不適合時の通知・回答（24h）／6 代替品・返品（5 営業日）／7 是正処置・8D／8 損害賠償／9 変更管理（4M 変更の事前通知）／10 監査権／11 秘密保持／12 有効期間・準拠法・紛争解決' },
              { k: '第 8 条 損害賠償（当社標準）', v: '中文：「供方应赔偿因其供货质量问题给需方造成的直接损失，包括但不限于筛选费、返工费、报废损失及需方生产线停线费用（按需方实际停线时间 × 标准小时费率计算）。」\n日本語：「供給者は、供給品の品質問題により需要者に生じた直接損害（選別費・手直し費・廃却損失および需要者の生産ライン停止費用（実停止時間 × 標準時間レート）を含むがこれに限らない）を賠償する。」' },
              { k: 'T 社案文との相違点', v: '❗ 第 8 条：T 社案は「賠償上限＝当該ロットの貨款額」。当社標準は上限なし（直接損害＋停線費用）。**争点**。妥協案：上限を「当該ロット貨款額の 3 倍、または年間取引額の 20% のいずれか高い方」\n⚠ 第 5 条：T 社案は回答期限 48h。当社標準 24h。\n⚠ 第 9 条：T 社案に 4M 変更の事前通知条項なし。**必須で追加**（K 社の PPAP 要件に連動）' },
              { k: '法務レビュー依頼のポイント', v: '① 第 8 条の上限設定の可否と水準 ② 準拠法（中国法）・仲裁地（上海国際経済貿易仲裁委員会）の妥当性 ③ 中文正・日文参考の優先順位条項' }
            ] },
      zh: { title: '质量保证协议 草案（青岭精工（苏州） × T公司）— 中文为准・日文对照',
            items: [
              { k: '结构（12条）', v: '1 目的／2 定义／3 质量标准・材质单／4 来料检验与判定／5 不合格时的通知与回复（24h）／6 替代品・退货（5个工作日）／7 纠正措施・8D／8 损害赔偿／9 变更管理（4M变更事先通知）／10 审核权／11 保密／12 有效期・适用法律・争议解决' },
              { k: '第8条 损害赔偿（本公司标准）', v: '中文：「供方应赔偿因其供货质量问题给需方造成的直接损失，包括但不限于筛选费、返工费、报废损失及需方生产线停线费用（按需方实际停线时间 × 标准小时费率计算）。」\n日文：「供給者は、供給品の品質問題により需要者に生じた直接損害（選別費・手直し費・廃却損失および需要者の生産ライン停止費用（実停止時間 × 標準時間レート）を含むがこれに限らない）を賠償する。」' },
              { k: '与T公司草案的差异', v: '❗ 第8条：T公司草案「赔偿上限＝该批次货款金额」。本公司标准无上限（直接损失＋停线费用）。**争议点**。折中方案：上限为「该批次货款额的3倍，或年度交易额的20%，取较高者」\n⚠ 第5条：T公司草案回复期限48h。本公司标准24h。\n⚠ 第9条：T公司草案无4M变更事先通知条款。**必须增加**（与K公司PPAP要求联动）' },
              { k: '法务审核委托要点', v: '① 第8条上限设定的可否与水平 ② 适用法律（中国法）・仲裁地（上海国际经济贸易仲裁委员会）的合理性 ③ 中文为准・日文参考的优先顺序条款' }
            ] } },
    script: {
      ja: [
        { q: '【フォーム送信】品質保証協定／T 社／受入・不良対応・責任範囲／T 社案文 第 8 条', a: '社内標準条項をもとに 12 条構成の中国語ドラフトと日本語対訳を作成し、T 社案文との相違点を 3 件抽出しました（右の結果）。最大の争点は第 8 条の賠償上限（T 社：ロット貨款額まで／当社：上限なし）です。また T 社案文には 4M 変更の事前通知条項がなく、K 社の PPAP 要件に連動するため必須で追加する必要があります。' },
        { q: '第 8 条の妥協案、他のサプライヤーとはどう結んでいる？', a: '既存の品質保証協定 6 件を確認しました。\n・上限なし：S 社、U 社（いずれも 5 年以上の取引・当社主導で締結）\n・上限あり：V 社「年間取引額の 30%」、W 社「当該ロット貨款額の 5 倍」\n・その他 2 件は旧様式で条項なし\n新規取引の T 社に対しては W 社型「ロット貨款額の 5 倍」が社内実績として提示しやすく、T 社案（1 倍）との間で「3 倍」に落とすのが現実的です。停線費用を上限の外に置くかは、本社法務の判断を仰いでください。' },
        { q: '本社法務へのレビュー依頼メールを日本語で', a: '本社 法務部 御中\n件名：【レビュー依頼】T 社（鋼板）品質保証協定ドラフト（中文正・和訳付）\n・背景：材料サプライヤー切替（ECR-25-0088）に伴う新規取引。12 月ロットから供給開始予定\n・添付：協定ドラフト（中文）、日本語対訳、T 社案文、相違点一覧\n・確認いただきたい点：① 第 8 条 賠償上限（T 社案 1 倍／当社案 上限なし／妥協案 3 倍）の可否 ② 準拠法・仲裁地 ③ 言語優先条項\n・希望期限：9/19（金）。T 社との交渉を 9/24 に予定\n蘇州工場 管理部 中村' }
      ],
      zh: [
        { q: '【提交表单】质量保证协议／T公司／来料・不良应对・责任范围／T公司草案第8条', a: '基于公司标准条款生成12条结构的中文草案与日文对照，并提取了与T公司草案的3处差异（见右侧结果）。最大争议点是第8条赔偿上限（T公司：以批次货款为限／本公司：无上限）。另外T公司草案没有4M变更事先通知条款，因与K公司PPAP要求联动，必须增加。' },
        { q: '第8条的折中方案，和其他供应商是怎么签的？', a: '已核对现有6份质量保证协议：\n・无上限：S公司、U公司（均为5年以上交易，由本公司主导签订）\n・有上限：V公司「年度交易额的30%」，W公司「该批次货款额的5倍」\n・其余2份为旧版无此条款\n对新供应商T公司，以W公司型「批次货款额的5倍」作为公司实绩较易提出，与T公司草案（1倍）之间落到「3倍」较为现实。停线费用是否置于上限之外，请交由总部法务判断。' },
        { q: '用日文写一封给总部法务的审核委托邮件', a: '本社 法務部 御中\n件名：【レビュー依頼】T 社（鋼板）品質保証協定ドラフト（中文正・和訳付）\n・背景：材料サプライヤー切替（ECR-25-0088）に伴う新規取引。12 月ロットから供給開始予定\n・添付：協定ドラフト（中文）、日本語対訳、T 社案文、相違点一覧\n・確認いただきたい点：① 第 8 条 賠償上限（T 社案 1 倍／当社案 上限なし／妥協案 3 倍）の可否 ② 準拠法・仲裁地 ③ 言語優先条項\n・希望期限：9/19（金）。T 社との交渉を 9/24 に予定\n蘇州工場 管理部 中村' }
      ] } },

  /* ---------------- lg: 日中コミュニケーション ---------------- */
  lg1: { template: 'form',
    persona: { name: { ja: '呉 婷', zh: '吴婷', en: 'Wu Ting' },
               role: { ja: '工場長室 秘書・通訳', zh: '厂长办公室 秘书・翻译', en: 'Plant Manager Office Secretary & Interpreter' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['本社技術部から届いた日本語の技術連絡書を、現場向けに中国語化する。社内用語に揃えたい', '原文・方向・用途（現場掲示／メール）をフォームに入力', '社内用語集に揃えた訳文と、訳語候補が複数ある語の根拠付き併記が返る', '訳文を確認し、用語集への登録候補を承認'],
             zh: ['把总部技术部发来的日文技术联络书翻成给现场的中文，并统一为公司用语', '在表单中填写原文、方向、用途（现场张贴／邮件）', '返回按公司术语表统一的译文，以及多个译法候选的依据并列', '确认译文，批准术语表登记候选'],
             en: ['Translate a Japanese technical notice from HQ into Chinese for the floor, in company wording', 'Enter the source text, direction and purpose (poster / email)', 'Get a translation aligned to the glossary, with alternatives and rationale', 'Review and approve glossary additions'] },
    input: { ja: { fields: [
              { label: '方向', value: '日本語 → 中国語' },
              { label: '用途', value: '現場向け技術連絡（掲示＋朝礼で読み上げ）' },
              { label: '原文', value: '技術連絡書 TN-25-031：SK-3310-A の仕掛品は、塗装前に治具から外した状態で 30 分以上放置しないこと。放置した場合はポカヨケ用の赤札を付け、再脱脂工程へ戻すこと。' } ] },
             zh: { fields: [
              { label: '方向', value: '日文 → 中文' },
              { label: '用途', value: '面向现场的技术联络（张贴＋早会宣读）' },
              { label: '原文', value: '技術連絡書 TN-25-031：SK-3310-A の仕掛品は、塗装前に治具から外した状態で 30 分以上放置しないこと。放置した場合はポカヨケ用の赤札を付け、再脱脂工程へ戻すこと。' } ] } },
    result: {
      ja: { title: '訳文：技術連絡書 TN-25-031（社内用語集 v3.4 適用）',
            items: [
              { k: '訳文（中国語）', v: '技术联络书 TN-25-031：SK-3310-A 的在制品，涂装前从治具上取下后，放置时间不得超过30分钟。如已放置超时，须挂防错用红色标签，并退回至再脱脂工序。' },
              { k: '用語の対応（用語集準拠）', v: '仕掛品 → 在制品（用語集 #041。「半成品」は使わない）\n治具 → 治具（#012。「夹具」は設備保全課で別物を指す）\nポカヨケ → 防错（#088）\n赤札 → 红色标签（#102。「红牌」は 5S の赤札作戦と混同するため不可）\n再脱脂工程 → 再脱脂工序（#215）' },
              { k: '訳語候補が複数あった語', v: '「放置しない」：①放置时间不得超过（規定文向き・採用）②不要放置超过（口語）。掲示用途なので①。\n「戻す」：①退回至（工程を戻す・採用）②返回（人が戻る意）' },
              { k: '用語集への登録候補', v: '「技術連絡書」→「技术联络书」（現在未登録。本社文書の定訳として登録を推奨）' }
            ] },
      zh: { title: '译文：技术联络书 TN-25-031（适用公司术语表 v3.4）',
            items: [
              { k: '译文（中文）', v: '技术联络书 TN-25-031：SK-3310-A 的在制品，涂装前从治具上取下后，放置时间不得超过30分钟。如已放置超时，须挂防错用红色标签，并退回至再脱脂工序。' },
              { k: '术语对应（依据术语表）', v: '仕掛品 → 在制品（术语表 #041。不用「半成品」）\n治具 → 治具（#012。「夹具」在设备保全科指另一种东西）\nポカヨケ → 防错（#088）\n赤札 → 红色标签（#102。「红牌」易与5S红牌作战混淆，不可用）\n再脱脂工程 → 再脱脂工序（#215）' },
              { k: '存在多个译法候选的词', v: '「放置しない」：①放置时间不得超过（适合规定文・采用）②不要放置超过（口语）。用于张贴故选①。\n「戻す」：①退回至（工序退回・采用）②返回（人回去之意）' },
              { k: '术语表登记候选', v: '「技術連絡書」→「技术联络书」（目前未登记。建议作为总部文件的固定译法登记）' }
            ] } },
    script: {
      ja: [
        { q: '【フォーム送信】日→中／現場向け技術連絡／TN-25-031 原文', a: '社内用語集 v3.4 に揃えて翻訳しました（右の結果）。注意した点は 2 つ：「治具」は用語集どおり「治具」とし「夹具」を避けました（設備保全課で別物を指すため）。「赤札」は 5S の「红牌」と混同しないよう「红色标签」としています。「技術連絡書」が用語集に未登録なので登録候補に挙げました。' },
        { q: '朝礼で読み上げるので、もう少し口語にした版も', a: '読み上げ用（口語版）：\n「大家注意，技术联络书 TN-25-031：SK-3310-A 在涂装前，从治具上取下来以后，不能放超过30分钟。要是放过了30分钟，一定要挂上红色标签，送回去再脱脂。」\n掲示版と用語は同じ（在制品・治具・红色标签・再脱脂工序）にし、文末だけ話し言葉にしています。読み上げ時間は約 20 秒です。' },
        { q: '「技術連絡書」を用語集に登録して', a: '用語集 v3.4 への登録申請を作成しました：\n・#301 技術連絡書 ／ 技术联络书 ／ Technical Notice\n・分類：文書名（本社発行）\n・備考：本社技術部が発行する変更・注意喚起文書。「技术通知」「技术联系单」は使わない\n・申請者：呉婷（工場長室）、承認者：王磊（用語集管理者）\n承認されると翻訳・用語統一の両サービスに即時反映されます。' }
      ],
      zh: [
        { q: '【提交表单】日→中／面向现场的技术联络／TN-25-031 原文', a: '已按公司术语表 v3.4 统一翻译（见右侧结果）。注意了2点：「治具」按术语表译为「治具」，避免了「夹具」（设备保全科用于指另一种东西）。「赤札」为避免与5S的「红牌」混淆，译为「红色标签」。「技術連絡書」尚未登记术语表，已列为登记候选。' },
        { q: '早会要宣读，再给一个更口语的版本', a: '宣读用（口语版）：\n「大家注意，技术联络书 TN-25-031：SK-3310-A 在涂装前，从治具上取下来以后，不能放超过30分钟。要是放过了30分钟，一定要挂上红色标签，送回去再脱脂。」\n术语与张贴版一致（在制品・治具・红色标签・再脱脂工序），仅句尾改为口语。宣读约20秒。' },
        { q: '把「技術連絡書」登记到术语表', a: '已生成术语表 v3.4 登记申请：\n・#301 技術連絡書 ／ 技术联络书 ／ Technical Notice\n・分类：文件名（总部发行）\n・备注：总部技术部发行的变更、注意提醒文件。不使用「技术通知」「技术联系单」\n・申请人：吴婷（厂长办公室），批准人：王磊（术语表管理者）\n批准后将即时反映到翻译与术语统一两项服务。' }
      ] } },

  lg2: { template: 'upload',
    persona: { name: { ja: '王 磊', zh: '王磊', en: 'Wang Lei' },
               role: { ja: '生産技術課 主任（用語集管理者）', zh: '生产技术科 主管（术语表管理者）', en: 'Production Engineering Supervisor (Glossary Owner)' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['本社との会議で「同じ部品を 3 通りに呼んでいて話が噛み合わない」と指摘された', '直近 3 か月の議事録・チャットログ・作業標準書をアップロード', '呼称の揺れ一覧（同一物の別名）と社内標準の呼称・対訳案が返る', '標準呼称を決めて用語集を更新し、全員に周知'],
             zh: ['在与总部的会议上被指出「同一个零件有3种叫法，说不到一起」', '上传近3个月的会议纪要、聊天记录、作业标准书', '返回称谓不统一清单（同一事物的不同叫法）及公司标准称谓・对译方案', '确定标准称谓、更新术语表并通知全员'],
             en: ['HQ pointed out the same part is called three different names in meetings', 'Upload the last 3 months of minutes, chat logs and work standards', 'Get a list of naming inconsistencies with proposed standard terms and translations', 'Decide the standards, update the glossary and announce'] },
    input: { ja: { files: ['議事録_2025-06〜08.zip', 'チャットログ_生産技術_2025Q3.txt', '作業標準書_全ライン_一覧.xlsx'] },
             zh: { files: ['会议纪要_2025-06〜08.zip', '聊天记录_生产技术_2025Q3.txt', '作业标准书_全线_清单.xlsx'] } },
    result: {
      ja: { title: '呼称の揺れ検出：2025 年 6〜8 月（文書 84 件・チャット 3,120 行）',
            columns: ['#', '揺れている呼称（出現数）', '同一物', '標準呼称案（ja / zh / en）', '根拠'],
            rows: [
              ['1', 'ブラケット A（41）／SK-3310（27）／支架（63）／L 型支架（12）', 'SK-3310-A', 'ブラケット SK-3310-A ／ 支架 SK-3310-A ／ Bracket SK-3310-A', '図面名称＋品番。「L 型」は旧品番 SK-3310 の形状で新版に不適'],
              ['2', 'クーラント（38）／切削液（55）／冷却液（29）／切削油（6）', '水溶性切削液', 'クーラント ／ 切削液 ／ Coolant', '用語集 #077 で「切削液」が標準。「冷却液」は設備の冷却水と混同'],
              ['3', '治具（44）／夹具（31）／工装（9）', '加工用治具', '治具 ／ 治具 ／ Jig', '用語集 #012。「夹具」は保全課でクランプ器具を指す'],
              ['4', 'ライン 3（52）／3 号线（48）／深穴ライン（11）／新线（7）', '製造二課 ライン 3', 'ライン 3 ／ 3号线 ／ Line 3', '「新线」は 2023 年立上げ時の呼称。2 年経過し不適'],
              ['5', '首件（22）／初品（18）／初物（9）／ファーストピース（3）', '段取り後の最初の製品', '初品 ／ 首件 ／ First piece', '用語集 #133。日本語は「初品」が標準（「初物」は本社で別義）'],
              ['6', '不良率（71）／不合格率（14）／NG 率（9）', '出荷ベース不良率', '不良率 ／ 不良率 ／ Defect rate', '月次報告の定義に合わせる。「不合格率」は受入検査側で使用']
            ] },
      zh: { title: '称谓不统一检出：2025年6〜8月（文件84件・聊天3,120行）',
            columns: ['#', '不统一的称谓（出现次数）', '同一事物', '标准称谓方案（ja / zh / en）', '依据'],
            rows: [
              ['1', 'ブラケット A（41）／SK-3310（27）／支架（63）／L型支架（12）', 'SK-3310-A', 'ブラケット SK-3310-A ／ 支架 SK-3310-A ／ Bracket SK-3310-A', '图纸名称＋品号。「L型」为旧品号 SK-3310 的形状，不适用于新版'],
              ['2', 'クーラント（38）／切削液（55）／冷却液（29）／切削油（6）', '水溶性切削液', 'クーラント ／ 切削液 ／ Coolant', '术语表 #077 以「切削液」为标准。「冷却液」易与设备冷却水混淆'],
              ['3', '治具（44）／夹具（31）／工装（9）', '加工用治具', '治具 ／ 治具 ／ Jig', '术语表 #012。「夹具」在保全科指夹紧器具'],
              ['4', 'ライン 3（52）／3号线（48）／深穴ライン（11）／新线（7）', '制造二科 3号线', 'ライン 3 ／ 3号线 ／ Line 3', '「新线」为2023年投产时的叫法，已2年不再适用'],
              ['5', '首件（22）／初品（18）／初物（9）／ファーストピース（3）', '换型后的第一件产品', '初品 ／ 首件 ／ First piece', '术语表 #133。日文标准为「初品」（「初物」在总部有别义）'],
              ['6', '不良率（71）／不合格率（14）／NG率（9）', '出货口径不良率', '不良率 ／ 不良率 ／ Defect rate', '与月度报告定义一致。「不合格率」用于来料检验']
            ] } },
    script: {
      ja: [
        { q: '【アップロード】議事録_2025-06〜08.zip、チャットログ_生産技術_2025Q3.txt、作業標準書_全ライン_一覧.xlsx', a: '文書 84 件とチャット 3,120 行から、同一物を別の名前で呼んでいる語を 6 組検出しました（右の表）。本社との会議で問題になった「ブラケット」は 4 通りの呼び方があり、うち「L 型支架」は旧品番の形状に由来する呼称なので廃止を推奨します。6 組のうち 4 組は既に用語集に標準があるのに守られていない状態、2 組（#1・#4）は用語集に未登録です。' },
        { q: '#4 のライン 3 は「深穴ライン」の方が現場で通じてるけど、標準にしちゃダメ？', a: '「深穴ライン」を標準にするリスクは 2 つあります。① ライン 3 は 2026 年から深穴以外（ねじ加工）も担う計画（設備投資計画 v2）で、名前と実態がずれる。② 本社の生産管理システムは「Line 3」で登録済みで、変更にはマスタ改修が要る。\n推奨：正式名は「ライン 3／3号线」、用語集の備考に「通称：深穴ライン（現場での口語）」と記載して併存を認める。掲示物・文書では正式名を使う、というルールにすると現場の混乱が少ないです。' },
        { q: '用語集の更新案と周知文（中国語）を作って', a: '用語集 v3.5 更新案：\n・新規 #302 ブラケット SK-3310-A ／ 支架 SK-3310-A（廃止：L 型支架）\n・新規 #303 ライン 3 ／ 3号线（通称：深穴ライン。廃止：新线）\n・再周知 #077 切削液（廃止：冷却液・切削油）、#012 治具（廃止：夹具・工装）、#133 初品／首件（廃止：初物）、月次報告定義「不良率」\n周知文（中国語、朝礼・掲示用）：\n「关于统一叫法的通知：为避免与总部沟通时的误解，自9/15起请统一使用以下称谓：①「支架 SK-3310-A」（不再用 L型支架）②「3号线」（不再用 新线）③「切削液」（不再用 冷却液）④「治具」（不再用 夹具）⑤「首件」（不再用 初物）。详见术语表 v3.5。生产技术科 王磊」' }
      ],
      zh: [
        { q: '【上传】会议纪要_2025-06〜08.zip、聊天记录_生产技术_2025Q3.txt、作业标准书_全线_清单.xlsx', a: '从84件文件与3,120行聊天记录中，检出6组同一事物用不同名称的词（见右表）。与总部会议上出问题的「支架」有4种叫法，其中「L型支架」源于旧品号的形状，建议废止。6组中4组术语表已有标准但未被遵守，2组（#1・#4）未登记术语表。' },
        { q: '#4 的3号线，现场叫「深孔线」更顺口，不能定为标准吗？', a: '把「深孔线」定为标准有2个风险：① 3号线计划从2026年起也承担深孔以外（螺纹加工）的任务（设备投资计划v2），名称将与实际不符。② 总部生产管理系统已登记为「Line 3」，修改需要改主数据。\n建议：正式名为「3号线／ライン 3」，在术语表备注中写「俗称：深孔线（现场口语）」允许并存。规定看板与文件使用正式名，现场混乱会较少。' },
        { q: '生成术语表更新案和通知文（中文）', a: '术语表 v3.5 更新案：\n・新增 #302 支架 SK-3310-A ／ ブラケット SK-3310-A（废止：L型支架）\n・新增 #303 3号线 ／ ライン 3（俗称：深孔线。废止：新线）\n・再通知 #077 切削液（废止：冷却液・切削油）、#012 治具（废止：夹具・工装）、#133 首件／初品（废止：初物）、月度报告定义「不良率」\n通知文（早会・张贴用）：\n「关于统一叫法的通知：为避免与总部沟通时的误解，自9/15起请统一使用以下称谓：①「支架 SK-3310-A」（不再用 L型支架）②「3号线」（不再用 新线）③「切削液」（不再用 冷却液）④「治具」（不再用 夹具）⑤「首件」（不再用 初物）。详见术语表 v3.5。生产技术科 王磊」' }
      ] } },

  lg3: { template: 'form',
    persona: { name: { ja: '田中 浩二', zh: '田中浩二', en: 'Koji Tanaka' },
               role: { ja: '製造部 部長', zh: '制造部 部长', en: 'Manufacturing Director' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'ja' },
    steps: { ja: ['ライン 3 の班長（中国人）に段取り変更を口頭で伝えたが、翌日違うやり方をしていた', '伝えたい指示を日本語のまま（箇条書きでも口語でも）フォームに入力', '番号付きの中国語の指示文・確認すべき点・よくある誤解・理解確認の質問 3 問が返る', '班長に渡し、確認質問で理解を確かめる'],
             zh: ['口头向3号线班长交代了换型变更，第二天却用了不同的做法', '把想传达的指示用日文（要点或口语皆可）填入表单', '返回带编号的中文指示、需确认事项、常见误解及3道理解确认问题', '交给班长，用确认问题检查理解'],
             en: ['Told the Line 3 team leader about a setup change verbally; the next day it was done differently', 'Enter the instruction in Japanese (bullets or speech)', 'Get numbered Chinese steps, points to confirm, common misreadings and 3 check questions', 'Hand it over and confirm understanding with the questions'] },
    input: { ja: { fields: [
              { label: '相手', value: 'ライン 3 班長 趙（中国語母語、日本語は日常会話レベル）' },
              { label: '伝えたい指示（日本語のまま）', value: '来週から SK-3310-A の段取りは、金型 D-118 を先に温めてから治具を付け替える順番にしてほしい。今までと逆。それと初品は必ず 3 個測って、1 個でも外れたら止めて呉さんか私に連絡。夜勤も同じ。' },
              { label: '背景', value: 'D-118 の冷間時の位置ずれで E-47 アラームが多発（9 月 3 回）' } ] },
             zh: { fields: [
              { label: '对象', value: '3号线班长 赵（中文母语，日语为日常会话水平）' },
              { label: '想传达的指示（日文原样）', value: '来週から SK-3310-A の段取りは、金型 D-118 を先に温めてから治具を付け替える順番にしてほしい。今までと逆。それと初品は必ず 3 個測って、1 個でも外れたら止めて呉さんか私に連絡。夜勤も同じ。' },
              { label: '背景', value: 'D-118 冷态时位置偏差导致 E-47 报警频发（9月3次）' } ] } },
    result: {
      ja: { title: '作業指示（中国語書き下し）：SK-3310-A 段取り順の変更 — 2025/9/15 から',
            items: [
              { k: '指示文（中国語・番号付き）', v: '给3号线班长 赵：\n1. 从9/15（周一）起，SK-3310-A 的换型顺序改为：**先预热模具 D-118，再更换治具**（与以前的顺序相反）。\n2. 预热标准：模具温度达到 40℃ 以上（用红外测温枪测量模具导柱部位）。\n3. 换型后的首件必须测量 **3件**（不是1件）。\n4. 3件中只要有 **1件** 超差，立即停机，联系吴婷或田中部长。不要自行调整后继续生产。\n5. 以上同样适用于**夜班**。请传达给夜班班长 周。' },
              { k: '確認すべき点（伝える側のチェック）', v: '□ 「先に温める」の温度基準（40℃）と測定方法を伝えたか（口頭では抜けていた）\n□ 「1 個でも外れたら止める」の「止める」＝機械を止めて連絡、自分で調整しない、を伝えたか\n□ 夜勤の班長 周さんへの伝達ルート（趙さん経由か、直接か）を決めたか' },
              { k: 'よくある誤解', v: '・「今までと逆」だけでは、何と何が逆か曖昧 → 具体的に 2 手順を書いた\n・「3 個測る」を「3 個作ってから測る」と取られやすい → 「首件3件」と明記\n・「連絡」を「報告だけして続行」と解釈しがち → 「停机」を先に置いた' },
              { k: '理解確認の質問（3 問・中国語）', v: 'Q1 从9/15起，换型时先做什么、后做什么？（答：先预热 D-118 到 40℃，再换治具）\nQ2 首件要测几件？有1件超差怎么办？（答：3件；停机并联系吴婷或田中）\nQ3 夜班也要这样做吗？谁负责告诉夜班？（答：是；趙さん→周班长）' }
            ] },
      zh: { title: '作业指示（中文改写）：SK-3310-A 换型顺序变更 — 2025/9/15 起',
            items: [
              { k: '指示（中文・编号）', v: '给3号线班长 赵：\n1. 从9/15（周一）起，SK-3310-A 的换型顺序改为：**先预热模具 D-118，再更换治具**（与以前的顺序相反）。\n2. 预热标准：模具温度达到 40℃ 以上（用红外测温枪测量模具导柱部位）。\n3. 换型后的首件必须测量 **3件**（不是1件）。\n4. 3件中只要有 **1件** 超差，立即停机，联系吴婷或田中部长。不要自行调整后继续生产。\n5. 以上同样适用于**夜班**。请传达给夜班班长 周。' },
              { k: '需确认事项（传达方检查）', v: '□ 是否传达了「先预热」的温度基准（40℃）与测量方法（口头时遗漏）\n□ 是否传达了「有1件超差就停」＝停机并联系、不自行调整\n□ 是否确定了向夜班班长 周 的传达路径（经赵还是直接）' },
              { k: '常见误解', v: '・只说「与以前相反」不清楚是什么与什么相反 → 具体写出2个步骤\n・「测3件」易被理解为「做3件后再测」 → 明确写「首件3件」\n・「联系」易被理解为「报告后继续」 → 把「停机」放在前面' },
              { k: '理解确认问题（3题）', v: 'Q1 从9/15起，换型时先做什么、后做什么？（答：先预热 D-118 到 40℃，再换治具）\nQ2 首件要测几件？有1件超差怎么办？（答：3件；停机并联系吴婷或田中）\nQ3 夜班也要这样做吗？谁负责告诉夜班？（答：是；赵→周班长）' }
            ] } },
    script: {
      ja: [
        { q: '【フォーム送信】相手：班長 趙／指示：段取り順の変更・初品 3 個・夜勤も／背景：E-47 多発', a: '口頭指示を 5 項目の中国語指示文に書き下しました（右の結果）。元の指示に無かった「温めるの基準（40℃、測定方法）」を、設備保全課の PX-200 復旧手順から補って明記しています。誤解されやすいのは「今までと逆」「3 個測る」「連絡」の 3 か所で、それぞれ具体化しました。理解確認の質問 3 問を趙さんに口頭で聞いてください。' },
        { q: '40℃ って勝手に足していいの？私は言ってないけど', a: 'ご指摘のとおり、部長の指示には無い数字です。根拠は設備保全課の「PX-200 金型予熱基準（2024 年 11 月）」で D-118 を含む中型金型は 40℃ 以上と定めているためですが、**部長が確認していない数字を指示に載せるべきではありません**。2 つの選択肢：\n(a) 保全課 劉さんに 40℃ が現在も有効か確認してから載せる（推奨。「温める」だけでは班長が判断できない）\n(b) 「预热标准：按设备保全科的基准」とだけ書き、数字は現場に貼ってある基準を参照させる\n指示文の 2 項を (b) に差し替えた版も出力できます。' },
        { q: 'じゃあ (b) で。あと趙さんに渡す紙は A4 1 枚にして', a: '2 項を「预热标准：按设备保全科《PX-200 模具预热基准》执行（张贴在 PX-200 操作面板旁）」に差し替えました。A4 1 枚版（作業指示_SK-3310-A_段取り順変更_20250915.pdf）を出力：上段に指示 5 項（中国語・大きめの文字）、下段に確認質問 3 問と「理解確認：班長サイン／確認者サイン／日付」欄。裏面に日本語原文を付けています（部長の控え用）。' }
      ],
      zh: [
        { q: '【提交表单】对象：班长 赵／指示：换型顺序变更・首件3件・夜班同样／背景：E-47频发', a: '已将口头指示改写为5条中文指示（见右侧结果）。原指示中没有的「预热基准（40℃、测量方法）」，从设备保全科的 PX-200 恢复步骤中补充并明确。容易误解的是「与以前相反」「测3件」「联系」3处，均已具体化。请口头向赵询问3道理解确认问题。' },
        { q: '40℃ 可以随便加吗？我没说过这个数字', a: '您说得对，这个数字不在部长的指示中。依据是设备保全科《PX-200 模具预热基准（2024年11月）》中规定包括 D-118 的中型模具需 40℃ 以上，但**部长未确认的数字不应写入指示**。2个选项：\n(a) 先向保全科刘确认 40℃ 是否仍有效再写入（推荐。只说「预热」班长无法判断）\n(b) 只写「预热标准：按设备保全科的基准」，数字参照现场张贴的基准\n也可输出将第2条替换为 (b) 的版本。' },
        { q: '那就用 (b)。另外给赵的纸做成A4一页', a: '第2条已替换为「预热标准：按设备保全科《PX-200 模具预热基准》执行（张贴在 PX-200 操作面板旁）」。已输出A4一页版（作业指示_SK-3310-A_换型顺序变更_20250915.pdf）：上半部为5条指示（中文・较大字号），下半部为3道确认问题及「理解确认：班长签字／确认人签字／日期」栏。背面附日文原文（部长留底用）。' }
      ] } },

  lg4: { template: 'form',
    persona: { name: { ja: '高橋 亮', zh: '高桥亮', en: 'Ryo Takahashi' },
               role: { ja: '営業・顧客対応 駐在員', zh: '销售・客户对应 驻在员', en: 'Sales & Customer Liaison Expatriate' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'ja' },
    steps: { ja: ['K 社購買部から中国語で「10 月の納入数量を 20% 増やせるか」というメールが届いた。丁寧に、しかし条件付きで返したい', '受信メールの要約・返信の趣旨・相手との関係をフォームに入力', '日本語の要約と、商務中文の返信案が返る', '生産計画と照らして数字を確定し、返信'],
             zh: ['K公司采购部发来中文邮件问「10月交货量能否增加20%」。想礼貌但有条件地回复', '在表单中填写来信摘要、回复意图、与对方的关系', '返回日文摘要与商务中文回复草案', '对照生产计划确定数字后回复'],
             en: ['K purchasing asks in Chinese whether October volume can rise 20%; reply politely but with conditions', 'Enter the received mail, reply intent and relationship in the form', 'Get a Japanese summary and a business-Chinese reply draft', 'Confirm numbers against the production plan and send'] },
    input: { ja: { fields: [
              { label: '受信メール（中国語・貼り付け）', value: '高桥先生：您好。因我司10月产量上调，SK-3310-A 的10月交货量希望由 24,000 件增加至 28,800 件（+20%）。请于本周五前回复可行性。K公司 采购部 林' },
              { label: '返信の趣旨', value: '前向き。ただし材料（S 社在庫）と国慶節連休の制約から、10 月は +12%（26,900 個）まで。残り 1,900 個は 11 月上旬に前倒し納入で対応可。正式回答は生産会議（9/15）後。' },
              { label: '相手との関係', value: 'K 社購買 林さん：取引 3 年、月 1 回の定例あり。丁寧だが形式的すぎない' },
              { label: '返信言語', value: '中国語（日本語の要約も）' } ] },
             zh: { fields: [
              { label: '来信（中文・粘贴）', value: '高桥先生：您好。因我司10月产量上调，SK-3310-A 的10月交货量希望由 24,000 件增加至 28,800 件（+20%）。请于本周五前回复可行性。K公司 采购部 林' },
              { label: '回复意图', value: '积极。但受材料（S公司库存）与国庆假期限制，10月最多 +12%（26,900件）。其余1,900件可在11月上旬提前交付。正式回答在生产会议（9/15）后。' },
              { label: '与对方的关系', value: 'K公司采购 林：交易3年，每月1次例会。礼貌但不过于形式' },
              { label: '回复语言', value: '中文（附日文摘要）' } ] } },
    result: {
      ja: { title: '返信案：K 社購買部 林様（SK-3310-A 10 月増量依頼）',
            items: [
              { k: '受信メールの要約（日本語）', v: 'K 社の 10 月生産増に伴い、SK-3310-A の 10 月納入を 24,000 → 28,800 個（+20%）に増やせるかの照会。回答期限は今週金曜（9/12）。' },
              { k: '返信案（商務中文）', v: '林经理：您好。\n感谢贵司对我司产品的信任，也恭喜贵司10月产量上调。\n关于 SK-3310-A 10月交货量增加至 28,800 件的需求，我们已初步确认产能与材料情况：\n・10月可交付数量：**26,900 件（+12%）**。受材料到货节奏及国庆假期（10/1〜10/8）影响，暂难以在10月内全部达到 28,800 件；\n・差额 1,900 件：可安排在 **11月上旬（11/7前）提前交付**，不影响贵司11月的正常排产。\n以上为初步方案，我司将在 9/15 生产会议后正式回复确认。如贵司10月排产有优先顺序（例如上旬需求更集中），请告知，我们将据此调整周交付计划。\n再次感谢贵司的支持。\n青岭精工（苏州）销售 高桥 亮' },
              { k: '文面のポイント', v: '・冒頭で相手の増産を祝う（関係 3 年・定例ありに合わせた温度感）\n・できない理由を 2 つに絞り、言い訳に聞こえないよう数字で示す\n・「正式回答は 9/15 後」と明記し、金曜期限には「初步方案」で応える形\n・相手の判断材料（上旬集中か）を尋ねて、次のやり取りにつなげる' }
            ] },
      zh: { title: '回复草案：K公司采购部 林（SK-3310-A 10月增量请求）',
            items: [
              { k: '来信摘要（日文）', v: 'K 社の 10 月生産増に伴い、SK-3310-A の 10 月納入を 24,000 → 28,800 個（+20%）に増やせるかの照会。回答期限は今週金曜（9/12）。' },
              { k: '回复草案（商务中文）', v: '林经理：您好。\n感谢贵司对我司产品的信任，也恭喜贵司10月产量上调。\n关于 SK-3310-A 10月交货量增加至 28,800 件的需求，我们已初步确认产能与材料情况：\n・10月可交付数量：**26,900 件（+12%）**。受材料到货节奏及国庆假期（10/1〜10/8）影响，暂难以在10月内全部达到 28,800 件；\n・差额 1,900 件：可安排在 **11月上旬（11/7前）提前交付**，不影响贵司11月的正常排产。\n以上为初步方案，我司将在 9/15 生产会议后正式回复确认。如贵司10月排产有优先顺序（例如上旬需求更集中），请告知，我们将据此调整周交付计划。\n再次感谢贵司的支持。\n青岭精工（苏州）销售 高桥 亮' },
              { k: '文案要点', v: '・开头祝贺对方增产（符合交易3年・有例会的关系温度）\n・不能做到的理由限定为2个，用数字表达以免像借口\n・明确「正式回复在9/15后」，以「初步方案」回应周五期限\n・询问对方的判断材料（是否上旬集中），为下一轮沟通铺垫' }
            ] } },
    script: {
      ja: [
        { q: '【フォーム送信】K 社 林さんの増量依頼メール／+12% まで・残りは 11 月前倒し／正式回答は 9/15 後／中国語', a: '受信メールを日本語で要約し、商務中文の返信案を作成しました（右の結果）。ポイントは「+20% は無理」を先に言わず、「10 月 26,900 個＋11 月上旬 1,900 個」で**合計 28,800 個は満たす**構成にしたことです。金曜の期限には「初步方案」として応え、正式回答は 9/15 の生産会議後と明記しています。' },
        { q: '「国慶節のせい」って書くと、毎年のことなのに準備不足に見えない？', a: 'その懸念は妥当です。K 社も中国企業なので国慶節は織り込み済みで、理由として弱く見えます。修正案：国慶節の記述を外し、材料側に寄せます。\n「受材料（钢板）到货节奏影响，10月内暂难以全部达到 28,800 件」\nさらに一歩踏み込むなら「我司正在推进钢板供应商的增量安排（预计12月起）」と、根本対応をしていることを添えると、増量要請への継続的な対応姿勢が伝わります（ECR-25-0088 の T 社切替のこと。ただし具体名は出さない）。' },
        { q: 'その修正で本社の営業部にも CC する。日本語の 3 行サマリーを本文の上に付けて', a: '返信の冒頭に日本語サマリーを付けた版を作成しました（CC：本社営業部）：\n---\n【要約（社内向け）】K 社より SK-3310-A 10 月納入の +20%（28,800 個）増量依頼。10 月は材料制約により +12%（26,900 個）で回答、差分 1,900 個は 11 月上旬前倒しで合計は満たす。正式回答は 9/15 生産会議後。\n---\n以下、K 社への返信（中国語）… \n本社営業部には「材料制約＝S 社在庫、T 社切替を 12 月に計画中」と補足するメモも別途用意しています。' }
      ],
      zh: [
        { q: '【提交表单】K公司林的增量请求邮件／最多+12%・其余11月提前／正式回复9/15后／中文', a: '已用日文总结来信，并生成商务中文回复草案（见右侧结果）。要点是不先说「+20%做不到」，而是以「10月 26,900件＋11月上旬 1,900件」构成**合计满足 28,800件**。对周五期限以「初步方案」回应，并明确正式回复在9/15生产会议后。' },
        { q: '写「因为国庆」的话，每年都有的事，会不会显得准备不足？', a: '这个顾虑合理。K公司也是中国企业，国庆已在预期内，作为理由显得弱。修改方案：去掉国庆的表述，归因于材料。\n「受材料（钢板）到货节奏影响，10月内暂难以全部达到 28,800 件」\n若想更进一步，可加「我司正在推进钢板供应商的增量安排（预计12月起）」，表明正在做根本性应对，传达对增量请求的持续对应姿态（指 ECR-25-0088 的T公司切换，但不点名）。' },
        { q: '按这个修改后也CC总部销售部，正文上方加一个日文3行摘要', a: '已生成在回复开头附日文摘要的版本（CC：总部销售部）：\n---\n【要約（社内向け）】K 社より SK-3310-A 10 月納入の +20%（28,800 個）増量依頼。10 月は材料制約により +12%（26,900 個）で回答、差分 1,900 個は 11 月上旬前倒しで合計は満たす。正式回答は 9/15 生産会議後。\n---\n以下为给K公司的回复（中文）…\n另备有给总部销售部的补充备忘：「材料制约＝S公司库存，计划12月切换T公司」。' }
      ] } },

  /* ---------------- nm: 見積・数字 ---------------- */
  nm1: { template: 'form',
    persona: { name: { ja: '高橋 亮', zh: '高桥亮', en: 'Ryo Takahashi' },
               role: { ja: '営業・顧客対応 駐在員', zh: '销售・客户对应 驻在员', en: 'Sales & Customer Liaison Expatriate' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'ja' },
    steps: { ja: ['K 社から新規部品（ブラケット派生品）の見積依頼。図面と月産数量が来た', '図面番号・材質・数量・納期・特記事項をフォームに入力', '社内原価テーブルで積み上げた原価内訳・見積書ドラフト・類似品との比較・感度が返る', '生産技術と工程を確認し、利益率を決めて提出'],
             zh: ['K公司询价新零件（支架派生品），发来图纸与月产量', '在表单中填写图号、材质、数量、交期、特别事项', '返回按公司成本表累计的成本明细、报价单草案、与类似品比较及敏感度', '与生产技术确认工艺、确定利润率后提交'],
             en: ['Customer K requests a quote for a new bracket variant with drawing and monthly volume', 'Enter drawing no., material, volume, lead time and notes', 'Get a cost breakdown from company cost tables, a quote draft, comparison with similar parts and sensitivity', 'Confirm the process with engineering, set margin and submit'] },
    input: { ja: { fields: [
              { label: '図面番号 / 品名', value: 'SK-3310-C ／ ブラケット（補強リブ付き派生品）' },
              { label: '材質 / 板厚', value: 'SPCC t1.5（現行 A 品は t1.2）' },
              { label: '月産数量 / 期間', value: '18,000 個／月 × 36 か月' },
              { label: '特記事項', value: '塗装あり（現行と同色）。金型は新規。K 社希望単価 USD 4.60 以下。' } ] },
             zh: { fields: [
              { label: '图号 / 品名', value: 'SK-3310-C ／ 支架（带加强筋派生品）' },
              { label: '材质 / 板厚', value: 'SPCC t1.5（现行A品为 t1.2）' },
              { label: '月产量 / 期间', value: '18,000件／月 × 36个月' },
              { label: '特别事项', value: '有涂装（与现行同色）。模具新开。K公司期望单价 USD 4.60 以下。' } ] } },
    result: {
      ja: { title: '原価積み上げ・見積ドラフト：SK-3310-C（月産 18,000／36 か月）',
            columns: ['項目', '算出根拠', '単価（RMB）', '備考'],
            rows: [
              ['材料費', 'SPCC t1.5 展開寸法 210×135、歩留 82%、RMB 5.4/kg', '1.86', 'S 社現行価格。T 社切替後 ▲0.12'],
              ['プレス加工費', '4 工程（抜き・曲げ×2・リブ成形）、SPH 720、レート RMB 180/h', '1.00', '現行 A 品は 3 工程（0.75）'],
              ['塗装費', '外注 S 社、掛け数 24/ラック', '2.05', '現行 A 品と同一'],
              ['金型償却', '新規 4 型 RMB 620,000 ÷ 648,000 個（36 か月）', '0.96', 'K 社負担なら 0'],
              ['検査・包装・物流', '抜取検査 n=125、専用通い箱、FOB 上海', '0.58', '現行と同一'],
              ['製造原価 小計', '', '**6.45**', 'USD 0.90（1 USD = RMB 7.15）'],
              ['販管費・利益（15%）', '社内標準', '0.97', ''],
              ['見積単価', '', '**7.42 ＝ USD 1.04**', '—'],
              ['類似品 比較', 'SK-3310-A 現行 USD 4.20 ← 材料費・塗装費が同水準、金型は償却済', '—', '❗ K 社希望 USD 4.60 と当社試算 USD 1.04 に**桁の乖離**。入力の数量・通貨単位を再確認']
            ] },
      zh: { title: '成本累计・报价草案：SK-3310-C（月产18,000／36个月）',
            columns: ['项目', '计算依据', '单价（RMB）', '备注'],
            rows: [
              ['材料费', 'SPCC t1.5 展开尺寸 210×135，利用率82%，RMB 5.4/kg', '1.86', 'S公司现行价。切换T公司后 ▲0.12'],
              ['冲压加工费', '4道工序（落料・折弯×2・筋成形），SPH 720，费率 RMB 180/h', '1.00', '现行A品为3道工序（0.75）'],
              ['涂装费', '外协S公司，24件/挂架', '2.05', '与现行A品相同'],
              ['模具摊销', '新开4套 RMB 620,000 ÷ 648,000件（36个月）', '0.96', 'K公司承担则为0'],
              ['检验・包装・物流', '抽检 n=125，专用周转箱，FOB上海', '0.58', '与现行相同'],
              ['制造成本 小计', '', '**6.45**', 'USD 0.90（1 USD = RMB 7.15）'],
              ['销管费・利润（15%）', '公司标准', '0.97', ''],
              ['报价单价', '', '**7.42 ＝ USD 1.04**', '—'],
              ['类似品比较', 'SK-3310-A 现行 USD 4.20 ← 材料费、涂装费水平相当，模具已摊销完', '—', '❗ K公司期望 USD 4.60 与本公司试算 USD 1.04 **相差一个数量级**。请复核输入的数量、货币单位']
            ] } },
    script: {
      ja: [
        { q: '【フォーム送信】SK-3310-C／SPCC t1.5／18,000 個×36 か月／塗装あり・金型新規／K 社希望 USD 4.60', a: '社内原価テーブルで積み上げました（右の表）。製造原価 RMB 6.45、標準利益込みで RMB 7.42（USD 1.04）です。**ただし 1 点、必ず確認してください**：現行 A 品の販売単価 USD 4.20 と今回の試算 USD 1.04 に桁の乖離があります。塗装費 RMB 2.05 が現行 A 品と同じなら、A 品の原価は RMB 5.9 前後のはずで、USD 4.20（RMB 30）とは合いません。A 品の単価が「1 セット（8 個）」の価格である可能性があります。' },
        { q: 'あ、A 品の USD 4.20 はセット価格（8 個）だった。1 個あたりで比較して', a: 'A 品 USD 4.20 ÷ 8 = USD 0.525/個（RMB 3.75）。今回の C 品 USD 1.04/個との差 +USD 0.51 の内訳：\n・金型償却 +0.13（A 品は償却済）\n・材料費 +0.06（t1.2→1.5、展開寸法 +8%）\n・プレス工程 +1 工程 +0.03\n・**塗装費 RMB 2.05 → 実は A 品と同じ塗装費なら A 品原価が USD 0.525 に収まらない**。A 品の塗装は「8 個/ラック掛け」で単価 RMB 0.26 と推定されます。C 品も同条件なら塗装費は 2.05 → 0.26 に修正され、見積単価は **RMB 5.36 ＝ USD 0.75/個**（セット換算 USD 6.00/8 個）になります。塗装外注 S 社の掛け数を生産技術に確認してください。' },
        { q: 'K 社の希望 4.60 がセット価格なら 0.575/個。0.75 との差はどう埋める？', a: '差 USD 0.175/個（RMB 1.25）を埋める選択肢：\n1. 金型費 RMB 620,000 を K 社負担（型費別請求）→ ▲0.96 → **USD 0.62/個**。K 社は派生品では型費負担に応じる実績あり（2024 年 SK-2207-B）\n2. 材料を T 社に切替（12 月〜）→ ▲0.12\n3. 数量コミットを 48 か月に延長 → 償却 ▲0.24\n4. 利益率 15% → 12%（工場長決裁）→ ▲0.16\n1＋2 で USD 0.60/個（セット 4.80）、さらに 4 で 0.575 に届きます。推奨は「1 を第一提案、4 を交渉余地」。見積書ドラフト（型費別・USD 4.80/セット）を出力しますか？なお本サービスは構想段階のため、原価テーブルの数値は生産技術・財務の確認が必要です。' }
      ],
      zh: [
        { q: '【提交表单】SK-3310-C／SPCC t1.5／18,000件×36个月／有涂装・模具新开／K公司期望 USD 4.60', a: '已按公司成本表累计（见右表）。制造成本 RMB 6.45，含标准利润 RMB 7.42（USD 1.04）。**但有1点务必确认**：现行A品售价 USD 4.20 与本次试算 USD 1.04 相差一个数量级。若涂装费 RMB 2.05 与现行A品相同，A品成本应在 RMB 5.9 左右，与 USD 4.20（RMB 30）不符。A品单价可能是「1套（8件）」的价格。' },
        { q: '啊，A品的 USD 4.20 是套价（8件）。按单件比较', a: 'A品 USD 4.20 ÷ 8 = USD 0.525/件（RMB 3.75）。与本次C品 USD 1.04/件 的差额 +USD 0.51 构成：\n・模具摊销 +0.13（A品已摊销完）\n・材料费 +0.06（t1.2→1.5，展开尺寸+8%）\n・冲压多1道工序 +0.03\n・**涂装费 RMB 2.05 → 若与A品相同，A品成本不可能控制在 USD 0.525**。推测A品涂装为「8件/挂架」，单价约 RMB 0.26。C品若同条件，涂装费由 2.05 修正为 0.26，报价单价变为 **RMB 5.36 ＝ USD 0.75/件**（折合套价 USD 6.00/8件）。请向生产技术确认涂装外协S公司的挂架件数。' },
        { q: 'K公司期望的4.60若是套价就是0.575/件，与0.75的差怎么填？', a: '填补 USD 0.175/件（RMB 1.25）差额的选项：\n1. 模具费 RMB 620,000 由K公司承担（模具费另计）→ ▲0.96 → **USD 0.62/件**。K公司在派生品上有承担模具费的实绩（2024年 SK-2207-B）\n2. 材料切换T公司（12月起）→ ▲0.12\n3. 数量承诺延长至48个月 → 摊销 ▲0.24\n4. 利润率 15% → 12%（厂长决裁）→ ▲0.16\n1＋2 可到 USD 0.60/件（套价4.80），再加4可达0.575。建议「1为首选方案，4为谈判余地」。是否输出报价单草案（模具费另计・USD 4.80/套）？另，本服务处于构想阶段，成本表数值需生产技术与财务确认。' }
      ] } },

  nm2: { template: 'upload',
    persona: { name: { ja: '趙 偉', zh: '赵伟', en: 'Zhao Wei' },
               role: { ja: '購買課 担当', zh: '采购科 担当', en: 'Procurement Staff' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['切削工具（超硬ドリル）の年間契約更新で 3 社から見積が来た。形式・通貨・単位がばらばら', '3 社の見積書（PDF・Excel・メール本文）をアップロード', '同条件に正規化した比較表と、前回価格との差・値上げ理由の妥当性が返る', '推奨案を購買課長に報告し、交渉ポイントを整理'],
             zh: ['切削刀具（硬质合金钻头）年度合同更新，3家供应商报价格式、货币、单位各不相同', '上传3家报价单（PDF・Excel・邮件正文）', '返回归一到同一条件的比较表、与上次价格的差异及涨价理由的合理性', '向采购科长汇报推荐方案并整理谈判要点'],
             en: ['Annual carbide-drill contract renewal; 3 quotes arrive in different formats, currencies and units', 'Upload the three quotes (PDF, Excel, email body)', 'Get a normalized comparison, delta vs last price and a check of price-increase reasons', 'Report the recommendation and negotiation points to the manager'] },
    input: { ja: { files: ['見積_S工具_2026年度.pdf', 'Quotation_TC-Tools_FY2026.xlsx', 'メール_U刀具_报价.txt'] },
             zh: { files: ['报价_S刀具_2026年度.pdf', 'Quotation_TC-Tools_FY2026.xlsx', '邮件_U刀具_报价.txt'] } },
    result: {
      ja: { title: '購買見積比較：超硬コーティングドリル Φ8 L/D=8（年間 2,400 本）',
            columns: ['項目', 'S 工具（現行）', 'TC-Tools', 'U 刀具', '備考'],
            rows: [
              ['単価（正規化：RMB/本・税抜）', '**186.0**', '172.4（USD 24.10 × 7.15）', '178.0（表示は 10 本箱 1,780）', '通貨・箱単位を揃えた'],
              ['前回契約単価との差', '+7.5%（173.0 → 186.0）', '新規', '新規', 'S 工具は値上げ'],
              ['MOQ', '50 本', '100 本', '20 本', ''],
              ['納期', '2 週間（国内在庫）', '6 週間（輸入）', '3 週間', ''],
              ['支払条件', '月末締め 60 日', 'T/T 前払い 30%', '月末締め 30 日', ''],
              ['工具寿命（当社実績／カタログ）', '実績 210 本／再研磨 2 回', 'カタログ 250 本／実績なし', 'カタログ 200 本／2024 年試用 190 本', '寿命換算コスト：S 0.886 ／ TC 0.690（未検証）／ U 0.937 RMB/加工本'],
              ['年間総額（2,400 本）', 'RMB 446,400', 'RMB 413,760', 'RMB 427,200', 'TC が最安 ▲32,640'],
              ['値上げ理由の妥当性（S 工具）', 'タングステン価格 +18%（2025 上期）を理由に +7.5%', '—', '—', '⚠ 工具原価に占めるタングステンは約 30%。18% × 30% ≒ 5.4% が妥当。**+7.5% は約 2 ポイント過大**']
            ] },
      zh: { title: '采购报价比较：硬质合金涂层钻头 Φ8 L/D=8（年用量2,400支）',
            columns: ['项目', 'S刀具（现行）', 'TC-Tools', 'U刀具', '备注'],
            rows: [
              ['单价（归一：RMB/支・不含税）', '**186.0**', '172.4（USD 24.10 × 7.15）', '178.0（原标示为10支/盒 1,780）', '已统一货币与包装单位'],
              ['与上次合同单价差', '+7.5%（173.0 → 186.0）', '新供应商', '新供应商', 'S刀具涨价'],
              ['MOQ', '50支', '100支', '20支', ''],
              ['交期', '2周（国内库存）', '6周（进口）', '3周', ''],
              ['付款条件', '月结60天', 'T/T 预付30%', '月结30天', ''],
              ['刀具寿命（本公司实绩／样本）', '实绩210件／可重磨2次', '样本250件／无实绩', '样本200件／2024年试用190件', '寿命折算成本：S 0.886 ／ TC 0.690（未验证）／ U 0.937 RMB/加工件'],
              ['年度总额（2,400支）', 'RMB 446,400', 'RMB 413,760', 'RMB 427,200', 'TC最低 ▲32,640'],
              ['涨价理由合理性（S刀具）', '以钨价+18%（2025上半年）为由 +7.5%', '—', '—', '⚠ 钨在刀具成本中约占30%。18% × 30% ≒ 5.4% 为合理值。**+7.5% 约高出2个百分点**']
            ] } },
    script: {
      ja: [
        { q: '【アップロード】見積_S工具_2026年度.pdf、Quotation_TC-Tools_FY2026.xlsx、メール_U刀具_报价.txt', a: '3 社の見積を「RMB／本・税抜・年間 2,400 本」に正規化して比較しました（右の表）。単価最安は TC-Tools（172.4）ですが輸入で納期 6 週間・前払いが必要です。現行 S 工具の +7.5% 値上げは、理由のタングステン高騰から計算すると +5.4% 程度が妥当で、約 2 ポイント過大です。工具寿命を含めた「加工 1 本あたりコスト」では S 工具 0.886 に対し TC 0.690 ですが、TC は当社実績がなく未検証です。' },
        { q: 'S 工具に値上げ幅の見直しを頼むとき、どう言えばいい？', a: '交渉メモ（中国語で S 工具の営業へ）：\n「贵司报价中 +7.5% 的涨幅以钨价上涨18%为依据。据我们了解，钨材在硬质合金刀具成本中的占比约30%，据此推算合理涨幅约为5.4%。同时我们已收到两家同规格报价（RMB 172〜178），均低于贵司。考虑到贵司交期与售后的优势，如贵司能将涨幅调整至 +4% 以内（RMB 180 以下），我们愿意续签年度合同并维持现有采购量2,400支。」\nポイント：①根拠を数字で示す ②競合価格帯を出す（社名は出さない）③相手の強み（納期・実績）を認め、落としどころ（+4%）を先に提示。' },
        { q: 'TC-Tools を試したいなら、リスクを抑える買い方は？', a: '推奨：**S 工具を主（2,000 本）＋ TC-Tools を試用（400 本）**の並行購買。\n・TC は MOQ 100 本なので 400 本（4 箱）で試用可能。前払い 30% ＝ RMB 20,700\n・試用計画：ライン 3 の深穴加工で 3 か月、工具寿命と穴品質（寸法・面粗度）を S 工具と比較。判定基準「寿命 230 本以上・不良率同等」\n・納期 6 週間は初回だけ問題なので、9 月中に発注すれば 11 月から評価開始\n・S 工具には「今年度は 2,000 本」と伝え、値上げ交渉の材料にもする\n年間コストは S 2,000 本 × 180（交渉後）＋ TC 400 本 × 172.4 ＝ RMB 428,960。全量 S 工具（446,400）より ▲17,440。購買課長への報告資料（1 枚）を作成しますか？' }
      ],
      zh: [
        { q: '【上传】报价_S刀具_2026年度.pdf、Quotation_TC-Tools_FY2026.xlsx、邮件_U刀具_报价.txt', a: '已将3家报价归一为「RMB/支・不含税・年2,400支」进行比较（见右表）。单价最低为 TC-Tools（172.4），但为进口，交期6周且需预付。现行S刀具 +7.5% 的涨幅，按其钨价上涨的理由推算约 +5.4% 为合理，高出约2个百分点。含刀具寿命的「每加工件成本」S刀具0.886、TC 0.690，但TC无本公司实绩，未经验证。' },
        { q: '请S刀具重新考虑涨幅时该怎么说？', a: '谈判备忘（发给S刀具销售）：\n「贵司报价中 +7.5% 的涨幅以钨价上涨18%为依据。据我们了解，钨材在硬质合金刀具成本中的占比约30%，据此推算合理涨幅约为5.4%。同时我们已收到两家同规格报价（RMB 172〜178），均低于贵司。考虑到贵司交期与售后的优势，如贵司能将涨幅调整至 +4% 以内（RMB 180 以下），我们愿意续签年度合同并维持现有采购量2,400支。」\n要点：①用数字说明依据 ②给出竞品价格带（不点名）③承认对方优势（交期・实绩），先提出落点（+4%）。' },
        { q: '想试用 TC-Tools 的话，怎么买风险小？', a: '建议：**S刀具为主（2,000支）＋ TC-Tools 试用（400支）**并行采购。\n・TC的MOQ为100支，400支（4盒）即可试用。预付30% ＝ RMB 20,700\n・试用计划：在3号线深孔加工试用3个月，与S刀具比较刀具寿命与孔质量（尺寸・粗糙度）。判定基准「寿命≥230件・不良率相当」\n・6周交期仅首次有影响，9月内下单可从11月开始评价\n・向S刀具告知「本年度2,000支」，同时作为压价筹码\n年度成本：S 2,000支×180（谈判后）＋ TC 400支×172.4 ＝ RMB 428,960，比全量S刀具（446,400）▲17,440。是否生成给采购科长的汇报（1页）？' }
      ] } },

  nm3: { template: 'upload',
    persona: { name: { ja: '李 強', zh: '李强', en: 'Li Qiang' },
               role: { ja: '製造二課 課長', zh: '制造二科 科长', en: 'Manufacturing Sec. 2 Manager' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['毎週金曜、3 ラインの中国語日報 15 枚から日本語の週報を作るのに 2 時間かかっている', '当週の生産日報・品質日報・設備稼働記録をアップロード', 'ライン別の生産数・不良率・稼働率・主要トピックスの週次要約（日本語）と異常値コメントが返る', '数字を確認し、工場長と本社へ送付'],
             zh: ['每周五要从3条线的15张中文日报做日文周报，耗时2小时', '上传本周生产日报、质量日报、设备运行记录', '返回按线的产量、不良率、稼动率、主要事项的周摘要（日文）与异常值说明', '确认数字后发给厂长与总部'],
             en: ['Every Friday, turning 15 Chinese daily reports into a Japanese weekly takes 2 hours', 'Upload the week\'s production, quality and equipment logs', 'Get a Japanese weekly summary by line with outlier commentary', 'Check figures and send to the plant manager and HQ'] },
    input: { ja: { files: ['生産日報_L1-L3_0901-0905.xlsx', '品質日報_0901-0905.xlsx', '設備稼働記録_0901-0905.csv'] },
             zh: { files: ['生产日报_L1-L3_0901-0905.xlsx', '质量日报_0901-0905.xlsx', '设备运行记录_0901-0905.csv'] } },
    result: {
      ja: { title: '週報：製造二課 2025 年 第 36 週（9/1〜9/5）',
            columns: ['ライン', '生産数（計画）', '達成率', '不良率（目標 0.40%）', '稼働率', 'トピックス'],
            rows: [
              ['L1', '14,800（15,000）', '98.7%', '0.31%', '89.1%', '安定。9/3 に材料待ち 40 分'],
              ['L2', '12,200（12,500）', '97.6%', '0.44% ⚠', '86.4%', 'PX-200 E-47 アラーム 2 回（9/2・9/4）計 55 分停止。塗装ブツ NC-2025-0912'],
              ['L3', '9,600（9,000）', '106.7%', '0.52% ❗', '84.0%', '新条件表 9/1 適用。不良は 9/1〜2 に集中（条件切替直後 1.1%）、9/3 以降 0.28%'],
              ['合計', '36,600（36,500）', '100.3%', '0.42%', '86.5%', '残業 486h（前週 520h ▲6.5%）／安全：無事故継続 415 日']
            ] },
      zh: { title: '周报：制造二科 2025年 第36周（9/1〜9/5）',
            columns: ['线', '产量（计划）', '达成率', '不良率（目标0.40%）', '稼动率', '主要事项'],
            rows: [
              ['L1', '14,800（15,000）', '98.7%', '0.31%', '89.1%', '稳定。9/3 待料40分钟'],
              ['L2', '12,200（12,500）', '97.6%', '0.44% ⚠', '86.4%', 'PX-200 E-47 报警2次（9/2・9/4）共停机55分钟。涂装颗粒 NC-2025-0912'],
              ['L3', '9,600（9,000）', '106.7%', '0.52% ❗', '84.0%', '新条件表9/1适用。不良集中在9/1〜2（条件切换后1.1%），9/3以后0.28%'],
              ['合计', '36,600（36,500）', '100.3%', '0.42%', '86.5%', '加班486h（上周520h ▲6.5%）／安全：无事故持续415天']
            ] } },
    script: {
      ja: [
        { q: '【アップロード】生産日報_L1-L3_0901-0905.xlsx、品質日報_0901-0905.xlsx、設備稼働記録_0901-0905.csv', a: '15 枚の中国語日報と稼働記録を集計し、日本語の週報を作成しました（右の表）。合計は計画達成 100.3%、不良率 0.42% で目標をわずかに超過。異常値は 2 つ：L3 の不良率 0.52% は新条件表適用直後（9/1〜2）の 1.1% が原因で、9/3 以降は 0.28% に収束しています。L2 は PX-200 のアラーム停止 55 分と塗装ブツで不良率 0.44% です。' },
        { q: 'L3 の 9/1〜2 の不良、何が出てた？', a: '品質日報の内訳：9/1 不良 58 個（穴径小 41、バリ 12、その他 5）、9/2 不良 39 個（穴径小 27、バリ 9、その他 3）。「穴径小」が 7 割で、条件表の切替（Vc 20・ステップ 24mm）直後に工具の摩耗傾向が変わったためと日報にコメントがあります。9/3 朝に工具交換基準を 200 本→180 本に暫定変更し、以降 0.28% に低下。生産技術 王主任が 9/5 に「180 本で継続、10 月に再評価」と記載しています。' },
        { q: '本社向けに 3 行で。L3 の件は「対処済み」と分かるように', a: '本社向け週報サマリー（第 36 週）：\n・製造二課 計画達成 100.3%（36,600 個）、不良率 0.42%（目標 0.40%）、稼働率 86.5%、残業 ▲6.5%、無事故 415 日継続\n・L3：新加工条件の適用初日に穴径不良が集中（0.52%）したが、工具交換基準の見直しで 9/3 以降 0.28% に収束。対処済み、10 月に再評価\n・L2：プレス機アラーム停止 55 分（金型点検を 9/10 実施予定）、塗装ブツ 1 件は K 社 8D 対応中（別報告 CL-25-0906）' }
      ],
      zh: [
        { q: '【上传】生产日报_L1-L3_0901-0905.xlsx、质量日报_0901-0905.xlsx、设备运行记录_0901-0905.csv', a: '已汇总15张中文日报与运行记录，生成日文周报（右侧为中文对照）。合计计划达成100.3%，不良率0.42%略超目标。异常值2项：L3不良率0.52%源于新条件表适用初期（9/1〜2）的1.1%，9/3以后已收敛至0.28%。L2因 PX-200 报警停机55分钟及涂装颗粒，不良率0.44%。' },
        { q: 'L3 9/1〜2 的不良具体是什么？', a: '质量日报明细：9/1 不良58件（孔径偏小41、毛刺12、其他5），9/2 不良39件（孔径偏小27、毛刺9、其他3）。「孔径偏小」占7成，日报备注为条件表切换（Vc 20・分段24mm）后刀具磨损趋势变化所致。9/3早上将换刀基准由200件临时改为180件，之后降至0.28%。生产技术王主管9/5记载「按180件继续，10月再评价」。' },
        { q: '给总部3行。L3那件要让人看出「已处理」', a: '总部用周报摘要（第36周，日文）：\n・製造二課 計画達成 100.3%（36,600 個）、不良率 0.42%（目標 0.40%）、稼働率 86.5%、残業 ▲6.5%、無事故 415 日継続\n・L3：新加工条件の適用初日に穴径不良が集中（0.52%）したが、工具交換基準の見直しで 9/3 以降 0.28% に収束。対処済み、10 月に再評価\n・L2：プレス機アラーム停止 55 分（金型点検を 9/10 実施予定）、塗装ブツ 1 件は K 社 8D 対応中（別報告 CL-25-0906）' }
      ] } },

  nm4: { template: 'lookup',
    persona: { name: { ja: '孫 麗', zh: '孙丽', en: 'Sun Li' },
               role: { ja: '物流課 出荷・在庫担当', zh: '物流科 出货・库存担当', en: 'Shipping & Inventory Coordinator' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['日本本社の営業から「SK-2207-B、来週 3,000 個追加で出せる？」と日本語のチャットが来た', '品番を入力して在庫・生産計画・入荷予定を照会', '在庫・仕掛・計画と、回答に必要な前提条件が返る', '返信文（日本語）をそのまま本社へ送る'],
             zh: ['日本总部销售用日文发来聊天「SK-2207-B，下周能追加出3,000件吗？」', '输入品号查询库存、生产计划、到货预定', '返回库存、在制、计划及回答所需的前提条件', '把回复（日文）直接发给总部'],
             en: ['HQ sales asks in Japanese whether 3,000 extra SK-2207-B can ship next week', 'Enter the part number to query stock, plan and inbound', 'Get stock, WIP, plan and the assumptions needed for an answer', 'Send the Japanese reply to HQ as is'] },
    input: { ja: { query: 'SK-2207-B 在庫・納期' }, zh: { query: 'SK-2207-B 库存・交期' } },
    result: {
      ja: { title: '照会結果：SK-2207-B（ブラケット B、K 社・本社向け）— 2025/9/6 08:30 時点',
            columns: ['区分', '数量', '備考'],
            rows: [
              ['完成品在庫（良品）', '4,120 個', '倉庫 A-12。うち K 社 9/10 出荷予定 2,400 を引当済 → **引当可能 1,720**'],
              ['保留品', '860 個', 'ロット 250901-L1 全数検査中（CL-25-0906）。9/8 判定予定'],
              ['仕掛（L1）', '1,500 個', '9/8 完成予定（塗装 9/9 戻り）'],
              ['生産計画', '9/9〜9/12 各日 800 個', '週合計 3,200 個。うち本社定期分 2,000 引当済'],
              ['来週出荷可能量（試算）', '**1,720 ＋ 1,500 ＋ 1,200 ＝ 4,420**', '9/12 出荷なら。保留品 860 が良品判定なら +860'],
              ['材料', 'SPCC t1.0 コイル 3.2 t', '約 11,000 個分。制約なし'],
              ['要確認', '—', '① 9/12 出荷の船便（上海→大阪 週 2 便、金曜締切 木曜 15:00）② 追加分の通い箱 30 箱の空き']
            ] },
      zh: { title: '查询结果：SK-2207-B（支架B，K公司・总部用）— 2025/9/6 08:30 时点',
            columns: ['类别', '数量', '备注'],
            rows: [
              ['成品库存（良品）', '4,120件', '仓库 A-12。其中K公司9/10出货预定2,400已占用 → **可用 1,720**'],
              ['保留品', '860件', '批次 250901-L1 全数检验中（CL-25-0906）。9/8判定'],
              ['在制（L1）', '1,500件', '9/8完成预定（涂装9/9返回）'],
              ['生产计划', '9/9〜9/12 每日800件', '周合计3,200件。其中总部定期分2,000已占用'],
              ['下周可出货量（试算）', '**1,720 ＋ 1,500 ＋ 1,200 ＝ 4,420**', '按9/12出货。保留品860若判定良品则 +860'],
              ['材料', 'SPCC t1.0 卷料 3.2 t', '约11,000件用量。无制约'],
              ['待确认', '—', '① 9/12出货的船期（上海→大阪 每周2班，周五班截单周四15:00）② 追加分周转箱30箱是否有空']
            ] } },
    script: {
      ja: [
        { q: 'SK-2207-B 在庫・納期', a: '在庫・生産計画・入荷予定を照会しました（右の表）。来週 9/12 出荷なら追加 **3,000 個は対応可能**です（引当可能在庫 1,720 ＋ 仕掛 1,500 ＋ 来週生産の未引当分 1,200 ＝ 4,420）。前提条件は 2 つ：① 船便の締切（木曜 15:00）に合わせて 9/11 までに梱包完了 ② 通い箱 30 箱の確保。保留品 860 個（K 社クレームで検査中）は計算に入れていません。' },
        { q: '本社の営業にそのまま送れる日本語の返信を作って', a: '返信案：\n「お問い合わせの SK-2207-B 追加 3,000 個、来週 9/12（金）の上海発便で出荷可能です。\n・充当：完成品在庫 1,720 ＋ 9/8 完成の仕掛 1,500 ＋ 来週生産分 1,200（計 4,420 の範囲内）\n・条件：9/10 までに正式注文をいただけること（船便締切 9/11 木 15:00 のため）\n・K 社向け 9/10 出荷分 2,400 個への影響はありません\n・現在検査中の保留品 860 個は計算に含めていません\n通い箱の確保を物流で進めておきます。ご注文の可否を 9/10 中にご連絡ください。 蘇州工場 物流課 孫」' },
        { q: 'もし 5,000 個って言われたら？', a: '5,000 個は来週単独では**不可**です（上限 4,420、保留品が良品判定でも 5,280 でぎりぎり・リスク大）。代替案：\n・9/12 便で 4,400 個 ＋ 9/16（火）便で 600 個の**分納**（2 便目は翌週 9/15 の生産 800 個から充当）\n・または L1 に 9/13（土）の休日出勤 1 直（800 個）を入れれば 9/12 便は無理でも 9/16 便で 5,000 一括\n残業上限（月 36h）超過者が L1 に 2 名いるため、休日出勤は人事確認が必要です。本社にはまず分納案で打診することを推奨します。' }
      ],
      zh: [
        { q: 'SK-2207-B 库存・交期', a: '已查询库存、生产计划与到货预定（见右表）。若下周9/12出货，追加**3,000件可以对应**（可用库存1,720＋在制1,500＋下周生产未占用1,200＝4,420）。前提条件2项：①配合船期截单（周四15:00），9/11前完成包装 ②确保30个周转箱。保留品860件（K公司客诉检验中）未计入。' },
        { q: '写一份可以直接发给总部销售的日文回复', a: '回复案（日文）：\n「お問い合わせの SK-2207-B 追加 3,000 個、来週 9/12（金）の上海発便で出荷可能です。\n・充当：完成品在庫 1,720 ＋ 9/8 完成の仕掛 1,500 ＋ 来週生産分 1,200（計 4,420 の範囲内）\n・条件：9/10 までに正式注文をいただけること（船便締切 9/11 木 15:00 のため）\n・K 社向け 9/10 出荷分 2,400 個への影響はありません\n・現在検査中の保留品 860 個は計算に含めていません\n通い箱の確保を物流で進めておきます。ご注文の可否を 9/10 中にご連絡ください。 蘇州工場 物流課 孫」' },
        { q: '如果对方说要5,000件呢？', a: '5,000件下周单独**无法满足**（上限4,420，即使保留品判定良品也只有5,280，风险大）。替代方案：\n・9/12班 4,400件 ＋ 9/16（周二）班 600件**分批交付**（第2批从下周9/15的生产800件中充当）\n・或L1在9/13（周六）加1个班次（800件），虽赶不上9/12班，但可在9/16班一次交付5,000件\nL1有2名员工加班已超月36h上限，休息日出勤需人事确认。建议先向总部提出分批方案。' }
      ] } },

  nm5: { template: 'lookup',
    persona: { name: { ja: '小林 誠', zh: '小林诚', en: 'Makoto Kobayashi' },
               role: { ja: '工場長', zh: '厂长', en: 'Plant Manager' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'ja' },
    steps: { ja: ['本社から「残業が多いのに不良も減らないのはなぜか」と問われた。データで答えたい', '「ライン別に残業時間と不良率の関係を見せて」と自然言語で照会', '直近 6 か月の集計表と示唆コメントが返る', '深掘りの質問を重ね、本社報告の根拠にする'],
             zh: ['总部质问「加班多但不良也不减是为什么」，想用数据回答', '用自然语言查询「按线显示加班时间与不良率的关系」', '返回近6个月的汇总表与洞察说明', '追问深挖，作为总部汇报的依据'],
             en: ['HQ asks why defects are not falling despite heavy overtime; answer with data', 'Ask in plain language to show overtime vs defect rate by line', 'Get a 6-month table with written insights', 'Drill down and use it as the basis for the HQ report'] },
    input: { ja: { query: 'ライン別に、直近 6 か月の残業時間と不良率の関係を見せて' }, zh: { query: '按线显示近6个月加班时间与不良率的关系' } },
    result: {
      ja: { title: '集計：ライン別 残業時間 × 不良率（2025 年 3〜8 月）',
            columns: ['ライン', '月平均残業（h/人）', '不良率 平均', '相関（月次 6 点）', '不良率が最も高かった月', '示唆'],
            rows: [
              ['L1', '18.2', '0.33%', '+0.21（弱い）', '5 月 0.41%（大型連休後）', '残業と不良の関係は薄い。5 月は連休後の立上げ要因'],
              ['L2', '31.5', '0.46%', '**+0.78（強い）**', '7 月 0.58%（残業 38h）', '残業が 30h を超えた月に不良率が跳ねる。夜勤帯の塗装工程に不良が集中（夜勤 0.61% vs 昼勤 0.34%）'],
              ['L3', '26.8', '0.39%', '+0.12（ほぼなし）', '8 月 0.52%（新条件）', '8 月は条件切替の影響。残業とは無関係'],
              ['全体', '25.5', '0.40%', '+0.55', '7 月 0.47%', '**L2 が全体の相関を作っている**。L2 の夜勤・残業帯の塗装工程が焦点']
            ] },
      zh: { title: '汇总：按线 加班时间 × 不良率（2025年3〜8月）',
            columns: ['线', '月均加班（h/人）', '不良率 平均', '相关（月度6点）', '不良率最高的月份', '洞察'],
            rows: [
              ['L1', '18.2', '0.33%', '+0.21（弱）', '5月 0.41%（长假后）', '加班与不良关系弱。5月为长假后复产因素'],
              ['L2', '31.5', '0.46%', '**+0.78（强）**', '7月 0.58%（加班38h）', '加班超30h的月份不良率跳升。不良集中在夜班涂装工序（夜班0.61% vs 白班0.34%）'],
              ['L3', '26.8', '0.39%', '+0.12（几乎无）', '8月 0.52%（新条件）', '8月受条件切换影响，与加班无关'],
              ['全体', '25.5', '0.40%', '+0.55', '7月 0.47%', '**全体的相关由L2造成**。焦点在L2夜班・加班时段的涂装工序']
            ] } },
    script: {
      ja: [
        { q: 'ライン別に、直近 6 か月の残業時間と不良率の関係を見せて', a: '2025 年 3〜8 月の月次データをライン別に集計しました（右の表）。結論：**残業と不良の相関は L2 だけに強く出ています**（+0.78）。L1・L3 はほぼ無関係で、L3 の 8 月は条件切替の影響です。L2 は残業 30h/人を超えた月（6・7 月）に不良率が 0.5% を超え、不良は夜勤帯の塗装工程に集中しています（夜勤 0.61% vs 昼勤 0.34%）。' },
        { q: 'L2 の夜勤で何が起きてる？人？設備？', a: 'L2 夜勤の不良内訳（3〜8 月、計 412 個）：塗装ブツ 46%、塗膜厚不足 22%、打痕 18%、その他 14%。\n・人：夜勤の塗装担当は 3 名固定、うち 2 名が入社 1 年未満。昼勤は 5 名でベテラン 3 名。\n・設備：塗装ブースのフィルター差圧が夜勤終盤（4〜6 時）に上限に近づく記録が 6 月以降 14 回。昼勤前の交換で回復。\n・工程：夜勤は脱脂液の濃度チェックが 1 回/直（昼勤は 2 回）。\n示唆：「経験の浅い夜勤者 × フィルター末期 × チェック頻度半分」の重なりで、単純に残業が原因というより**夜勤帯の管理条件が薄い**ことが本質です。残業を減らしても夜勤条件を変えなければ改善しない可能性があります。' },
        { q: '本社に説明する 1 枚グラフ、どう作る？', a: '推奨構成（A4 横 1 枚）：\n・左：散布図「月平均残業（h/人）× 不良率」をライン別 3 色、6 か月 × 3 ライン ＝ 18 点。L2 だけ右上に伸びる形が見える\n・右上：L2 の昼勤／夜勤 不良率 棒グラフ（0.34% vs 0.61%）\n・右下：L2 夜勤 不良内訳 円グラフ（塗装ブツ 46%…）\n・下部 3 行のメッセージ：「①相関は L2 に限定 ②本質は夜勤帯の管理条件（人・フィルター・チェック頻度）③対策：夜勤の濃度チェック 2 回化・フィルター交換を夜勤前に・ベテラン 1 名を夜勤へ」\n画像（PNG）と PowerPoint 1 枚を出力できます。数値の出典は生産日報・品質日報・勤怠システムで、脚注に記載します。' }
      ],
      zh: [
        { q: '按线显示近6个月加班时间与不良率的关系', a: '已按线汇总2025年3〜8月的月度数据（见右表）。结论：**加班与不良的相关只在L2明显**（+0.78）。L1・L3几乎无关，L3的8月是条件切换影响。L2在加班超30h/人的月份（6・7月）不良率超过0.5%，不良集中在夜班涂装工序（夜班0.61% vs 白班0.34%）。' },
        { q: 'L2 夜班发生了什么？是人还是设备？', a: 'L2夜班不良明细（3〜8月，共412件）：涂装颗粒46%、涂膜厚度不足22%、碰伤18%、其他14%。\n・人：夜班涂装固定3人，其中2人入职不满1年。白班5人，老员工3人。\n・设备：喷房过滤器压差在夜班后段（4〜6点）接近上限的记录6月以来14次。白班前更换后恢复。\n・工艺：夜班脱脂液浓度检查1次/班（白班2次）。\n洞察：「经验不足的夜班人员 × 过滤器末期 × 检查频率减半」叠加，本质不是加班本身，而是**夜班时段管理条件薄弱**。仅减少加班而不改变夜班条件，可能不会改善。' },
        { q: '给总部解释的一页图表怎么做？', a: '建议构成（A4横 1页）：\n・左：散点图「月均加班（h/人）× 不良率」按线3色，6个月×3线＝18点。可见只有L2向右上延伸\n・右上：L2 白班／夜班 不良率 柱状图（0.34% vs 0.61%）\n・右下：L2 夜班不良明细 饼图（涂装颗粒46%…）\n・底部3行信息：「①相关仅限L2 ②本质是夜班时段管理条件（人・过滤器・检查频率）③对策：夜班浓度检查改为2次・过滤器在夜班前更换・调1名老员工到夜班」\n可输出图片（PNG）与1页PowerPoint。数据来源为生产日报、质量日报、考勤系统，写在脚注。' }
      ] } },

  /* ---------------- en: 図面・BOM・技術文書 ---------------- */
  en1: { template: 'diff',
    persona: { name: { ja: '周 敏', zh: '周敏', en: 'Zhou Min' },
               role: { ja: '品質保証課 顧客仕様担当', zh: '品质保证科 客户规格担当', en: 'QA Customer Specification Coordinator' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['K 社から要求仕様書の改訂版（Rev.D）が届いた。42 ページのどこが変わったか分からない', '旧版 Rev.C と新版 Rev.D を指定して比較', '変更箇所・影響（管理項目・検査方法・記録様式）・K 社用語→社内呼称の対応が一覧で返る', '影響のある作業標準書・検査基準書の改訂を起票'],
             zh: ['K公司发来要求规格书修订版（Rev.D），42页不知道哪里改了', '指定旧版 Rev.C 与新版 Rev.D 进行比较', '返回变更位置、影响（管理项目・检验方法・记录表单）及K公司术语→公司称谓对应', '起票修订受影响的作业标准书、检验基准书'],
             en: ['Customer K sent Rev.D of its requirement spec; unclear what changed across 42 pages', 'Select Rev.C and Rev.D to compare', 'Get changes, impact on control items, inspection methods and forms, plus K-to-internal term mapping', 'Raise revisions of affected work standards and inspection standards'] },
    input: { ja: { left: 'K 社 要求仕様書 SK-3310 系 Rev.C（2024-11）', right: 'K 社 要求仕様書 SK-3310 系 Rev.D（2025-09）' },
             zh: { left: 'K公司 要求规格书 SK-3310系 Rev.C（2024-11）', right: 'K公司 要求规格书 SK-3310系 Rev.D（2025-09）' } },
    result: {
      ja: { title: '差分一覧：K 社要求仕様書 SK-3310 系 Rev.C → Rev.D（変更 6 か所／42 ページ）',
            columns: ['#', '箇所', 'Rev.C → Rev.D', 'K 社用語 → 社内呼称', '影響', '対応文書'],
            rows: [
              ['1', '§4.2 塗膜厚', '15 µm 以上 → **20 µm 以上**', '涂层厚度 → 塗膜厚', '検査基準の変更。現行工程の実力値 18〜24 µm で下限側が外れる可能性', '検査基準書 QS-3310 改訂、塗装条件見直し（S 社協議）'],
              ['2', '§5.1 外観', '「目視」→「目視＋限度見本（K 社支給）」', '限度样件 → 限度見本', '検査方法の変更。限度見本の受領・管理が必要', '作業標準書 WS-L2-07、限度見本管理台帳 新設'],
              ['3', '§6.3 トレーサビリティ', 'ロット単位 → **ロット＋日付＋シフト**', '批次追溯 → ロット逆引き', '刻印・ラベル様式の変更', 'ラベル様式 LB-04 改訂、生産管理システム設定'],
              ['4', '§7 PPAP 提出', 'レベル 3 対象に「塗装サプライヤー変更」を追加', '外协变更 → 外注変更', '変更管理の対象拡大', '変更管理規定 CM-01 改訂'],
              ['5', '§8.2 記録保管', '5 年 → **10 年**', '记录保存 → 記録保管', '電子保管の容量・規程', '文書管理規定 DC-02 改訂'],
              ['6', '付録 B 用語', '「首件」の定義を「段取り後＋材料ロット切替後」に拡張', '首件 → 初品', '初品検査の回数増（材料ロット切替時も）', '作業標準書 全ライン、初品検査記録 QC-11']
            ] },
      zh: { title: '差异清单：K公司要求规格书 SK-3310系 Rev.C → Rev.D（变更6处／42页）',
            columns: ['#', '位置', 'Rev.C → Rev.D', 'K公司术语 → 公司称谓', '影响', '对应文件'],
            rows: [
              ['1', '§4.2 涂层厚度', '≥15 µm → **≥20 µm**', '涂层厚度 → 塗膜厚（涂膜厚）', '检验基准变更。现行工艺实力值18〜24 µm，下限侧可能超出', '检验基准书 QS-3310 修订、涂装条件调整（与S公司协商）'],
              ['2', '§5.1 外观', '「目视」→「目视＋限度样件（K公司提供）」', '限度样件 → 限度見本', '检验方法变更。需接收与管理限度样件', '作业标准书 WS-L2-07、新设限度样件管理台账'],
              ['3', '§6.3 追溯', '批次 → **批次＋日期＋班次**', '批次追溯 → ロット逆引き（批次反查）', '刻印、标签格式变更', '标签格式 LB-04 修订、生产管理系统设置'],
              ['4', '§7 PPAP 提交', '等级3对象增加「涂装供应商变更」', '外协变更 → 外注変更', '变更管理范围扩大', '变更管理规定 CM-01 修订'],
              ['5', '§8.2 记录保存', '5年 → **10年**', '记录保存 → 記録保管', '电子保存容量与规定', '文件管理规定 DC-02 修订'],
              ['6', '附录B 术语', '「首件」定义扩展为「换型后＋材料批次切换后」', '首件 → 初品', '首件检验次数增加（材料批次切换时也需）', '作业标准书 全线、首件检验记录 QC-11']
            ] } },
    script: {
      ja: [
        { q: '【比較】K 社要求仕様書 Rev.C（2024-11）⇄ Rev.D（2025-09）', a: '42 ページを比較し、変更 6 か所を抽出しました（右の表）。影響が大きいのは 2 つ：① §4.2 塗膜厚の下限が 15→20 µm に上がり、現行工程の実力値（18〜24 µm）では下限側が外れるロットが出ます。塗装外注 S 社との条件見直しが必要です。② 付録 B「首件（初品）」の定義が材料ロット切替時にも拡張され、初品検査の回数が増えます。K 社用語は社内呼称に対応づけて表記しています（「限度样件」→「限度見本」など）。' },
        { q: '塗膜厚 20 µm、今の工程で何%が外れる？', a: '直近 3 か月の塗膜厚測定記録（n=1,860、L2 塗装）を集計：平均 21.3 µm、標準偏差 1.9 µm。20 µm 未満は **実測で 12.4%**（231 個）でした。正規分布近似でも約 25% が 20 µm 未満となる分布なので、現状のままでは合格率が大きく落ちます。S 社に「膜厚目標を 21→24 µm に上げる（塗料使用量 +12%、単価 +RMB 0.15/個 見込み）」を打診する必要があります。K 社への適用開始日（Rev.D 表紙：2025-12-01）まで 3 か月です。' },
        { q: '改訂が必要な社内文書の起票リストを作って', a: '文書改訂 起票リスト（K 社 Rev.D 対応、適用 2025-12-01）：\n1. 検査基準書 QS-3310（塗膜厚 20 µm）— 品質保証 周／10/15\n2. 作業標準書 WS-L2-07（限度見本による外観検査）— 生産技術 王／10/31。※ K 社から限度見本の受領が前提（営業 高橋が 9/20 までに依頼）\n3. 限度見本管理台帳（新設）— 品質保証 周／10/31\n4. ラベル様式 LB-04（ロット＋日付＋シフト）— 生産管理／11/15。生産管理システムの設定変更を IT に依頼\n5. 変更管理規定 CM-01（塗装外注変更を PPAP 対象に）— 品質保証 陳／10/31\n6. 文書管理規定 DC-02（保管 10 年）— 管理部 中村／11/30\n7. 作業標準書 全ライン＋初品検査記録 QC-11（材料ロット切替時の初品）— 生産技術 王／11/15\n8. 塗装条件（S 社）— 生産技術 王／10/31。S 社見積の取得を購買 趙へ依頼\n各文書に「改訂理由：K 社要求仕様書 Rev.D §x.x」を記載します。' }
      ],
      zh: [
        { q: '【比较】K公司要求规格书 Rev.C（2024-11）⇄ Rev.D（2025-09）', a: '比较了42页，提取出6处变更（见右表）。影响大的有2处：① §4.2 涂层厚度下限由15提高到20 µm，按现行工艺实力值（18〜24 µm）会出现下限侧超差的批次，需与涂装外协S公司调整条件。② 附录B「首件」定义扩展到材料批次切换时，首件检验次数增加。K公司术语已对应到公司称谓（如「限度样件」→「限度見本」）。' },
        { q: '涂层厚度 20 µm，现在的工艺有百分之几会超出？', a: '汇总近3个月涂层厚度测量记录（n=1,860，L2涂装）：平均21.3 µm，标准差1.9 µm。低于20 µm的**实测占12.4%**（231件）。按正态近似约25%低于20 µm，维持现状合格率会大幅下降。需向S公司提出「膜厚目标由21提高到24 µm（涂料用量+12%，单价预计 +RMB 0.15/件）」。距K公司适用开始日（Rev.D封面：2025-12-01）还有3个月。' },
        { q: '列出需要修订的内部文件起票清单', a: '文件修订起票清单（对应K公司 Rev.D，适用 2025-12-01）：\n1. 检验基准书 QS-3310（涂层厚度20 µm）— 品质保证 周／10/15\n2. 作业标准书 WS-L2-07（限度样件外观检验）— 生产技术 王／10/31。※前提是从K公司取得限度样件（销售 高桥 9/20前申请）\n3. 限度样件管理台账（新设）— 品质保证 周／10/31\n4. 标签格式 LB-04（批次＋日期＋班次）— 生产管理／11/15。请IT修改生产管理系统设置\n5. 变更管理规定 CM-01（涂装外协变更纳入PPAP）— 品质保证 陈／10/31\n6. 文件管理规定 DC-02（保存10年）— 管理部 中村／11/30\n7. 作业标准书 全线＋首件检验记录 QC-11（材料批次切换时首件）— 生产技术 王／11/15\n8. 涂装条件（S公司）— 生产技术 王／10/31。请采购 赵 取得S公司报价\n各文件注明「修订理由：K公司要求规格书 Rev.D §x.x」。' }
      ] } },

  en2: { template: 'lookup',
    persona: { name: { ja: '陳 静', zh: '陈静', en: 'Chen Jing' },
               role: { ja: '品質保証課 係長', zh: '品质保证科 组长', en: 'QA Team Leader' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['S 社から「鋼板ロット H2508-17 に板厚不良の疑い」と連絡。どの製品にどれだけ使ったか即答が必要', '材料ロット番号を入力して逆引き', '使用した製品・上位アセンブリ・出荷先・出荷日・在庫状況が返る', '影響範囲を確定し、出荷先への連絡と在庫の隔離を指示'],
             zh: ['S公司通知「钢板批次 H2508-17 疑有板厚不良」。需要立即知道用在哪些产品、用了多少', '输入材料批次号反查', '返回所用产品、上级装配、出货对象、出货日与库存状态', '确定影响范围，指示通知出货对象并隔离库存'],
             en: ['Supplier S warns steel lot H2508-17 may have a thickness defect; need to know instantly where it went', 'Enter the material lot number for a reverse lookup', 'Get the products, parent assemblies, customers, ship dates and stock status', 'Fix the scope, notify customers and quarantine stock'] },
    input: { ja: { query: '材料ロット H2508-17（S 社 SPCC t1.2）' }, zh: { query: '材料批次 H2508-17（S公司 SPCC t1.2）' } },
    result: {
      ja: { title: 'BOM 逆引き：材料ロット H2508-17（S 社 SPCC t1.2、入荷 2025-08-19、2.4 t）',
            columns: ['製品（品番）', '上位アセンブリ', '生産ロット', '生産数', '出荷先', '出荷日', '当社在庫', '状態'],
            rows: [
              ['SK-3310-A ブラケット', 'K 社 ASSY-771（シート骨格）', '250825-L2', '1,200', 'K 社 常熟', '8/28', '0', '❗ 全数出荷済'],
              ['SK-3310-A ブラケット', 'K 社 ASSY-771', '250902-L2', '1,150', 'K 社 常熟', '9/5', '380', '⚠ 一部出荷（770）／在庫 380 は倉庫 A-12'],
              ['SK-3318 ステー', 'K 社 ASSY-771', '250827-L1', '2,400', '日本本社（K 社日本向け）', '9/2（船便、9/9 大阪着予定）', '0', '⚠ 洋上。到着前に本社へ連絡可'],
              ['SK-2207-B ブラケット B', '本社 経由 K 社 日本', '—', '—', '—', '—', '—', '✅ t1.0 材のため該当なし'],
              ['未使用材料', '—', '—', '—', '—', '—', '0.6 t（約 1,100 個分）', '❗ 材料倉庫 M-03。即隔離']
            ] },
      zh: { title: 'BOM反查：材料批次 H2508-17（S公司 SPCC t1.2，到货 2025-08-19，2.4 t）',
            columns: ['产品（品号）', '上级装配', '生产批次', '产量', '出货对象', '出货日', '本公司库存', '状态'],
            rows: [
              ['SK-3310-A 支架', 'K公司 ASSY-771（座椅骨架）', '250825-L2', '1,200', 'K公司 常熟', '8/28', '0', '❗ 全数已出货'],
              ['SK-3310-A 支架', 'K公司 ASSY-771', '250902-L2', '1,150', 'K公司 常熟', '9/5', '380', '⚠ 部分出货（770）／库存380在仓库 A-12'],
              ['SK-3318 支撑件', 'K公司 ASSY-771', '250827-L1', '2,400', '日本总部（K公司日本用）', '9/2（海运，9/9 预计到大阪）', '0', '⚠ 在途。可在到港前通知总部'],
              ['SK-2207-B 支架B', '经总部 至 K公司日本', '—', '—', '—', '—', '—', '✅ 为 t1.0 材料，不涉及'],
              ['未使用材料', '—', '—', '—', '—', '—', '0.6 t（约1,100件用量）', '❗ 材料仓库 M-03。立即隔离']
            ] } },
    script: {
      ja: [
        { q: '材料ロット H2508-17（S 社 SPCC t1.2）', a: '逆引きしました（右の表）。ロット H2508-17（2.4 t）は 3 生産ロットで使用、製品 2 品番・計 4,750 個に展開されています。出荷先は K 社常熟（1,970 個出荷済）と日本本社経由の K 社日本向け（2,400 個、洋上・9/9 大阪着予定）。当社在庫は完成品 380 個（倉庫 A-12）と未使用材料 0.6 t（M-03）です。**すぐ動くべきは 3 つ**：①未使用材料 0.6 t の隔離 ②在庫 380 個の保留 ③洋上分について本社へ先行連絡（到着前に受入保留の準備ができる）。' },
        { q: '板厚不良の程度が分からないと、K 社に何て言えばいい？', a: 'S 社の連絡内容は「板厚 t1.2 の下限（1.14）を下回る可能性、範囲・程度は調査中」です。K 社への一報は**事実と対応だけ**に絞ることを推奨します：\n「S 社より材料ロットの板厚に関する調査連絡を受領。当該材料を使用した貴社向け製品は SK-3310-A 1,970 個（8/28・9/5 出荷）と特定済み。当社在庫は隔離済み。板厚の実測を本日中に実施し、結果を 9/8 午前に報告する。貴社在庫の使用可否については実測結果をもって判断いただきたい」\n同時に当社在庫 380 個から 30 個を抜き取り、板厚を測れば、K 社に出荷したロットの状態を推定できます（同一コイル）。品質保証課で 2 時間程度の作業です。' },
        { q: '30 個測ったら全部 1.16〜1.21 だった。良品として扱っていい？', a: '実測 30 個が全数 1.16〜1.21（下限 1.14 に対して最小マージン 0.02）なら、当社に入った部分は規格内の可能性が高いです。ただし**「良品扱い」を確定する前に 2 点**：\n① S 社にコイルのどの位置（先頭／末尾）が疑わしいかを確認。コイル内で板厚は変動するため、当社在庫（コイル後半）が良くても、8/25 生産分（コイル前半）が良いとは限りません\n② K 社の要求仕様（Rev.D §3.1）では材料不具合の疑いがある場合「サプライヤーのミルシート再発行または第三者測定」が求められています\n推奨：K 社へは「当社在庫 30 個実測は全数規格内（1.16〜1.21）。S 社のコイル調査結果（9/9 予定）を待って最終判断」と報告。在庫 380 個の保留は S 社回答まで継続。未使用材料 0.6 t は S 社に返品または板厚全数測定のうえ使用可否判断。' }
      ],
      zh: [
        { q: '材料批次 H2508-17（S公司 SPCC t1.2）', a: '已反查（见右表）。批次 H2508-17（2.4 t）用于3个生产批次，展开为2个品号共4,750件。出货对象为K公司常熟（已出货1,970件）及经日本总部至K公司日本（2,400件，在途，9/9预计到大阪）。本公司库存为成品380件（仓库 A-12）与未使用材料0.6 t（M-03）。**应立即行动的3件事**：①隔离未使用材料0.6 t ②保留库存380件 ③就在途部分先行通知总部（可在到港前准备来料保留）。' },
        { q: '还不知道板厚不良的程度，该怎么跟K公司说？', a: 'S公司的通知内容是「板厚可能低于 t1.2 下限（1.14），范围与程度调查中」。建议对K公司的首次通报**只说事实与对应**：\n「已收到S公司关于材料批次板厚的调查通知。使用该材料的贵司产品已确定为 SK-3310-A 1,970件（8/28・9/5出货）。我司库存已隔离。今日内实施板厚实测，9/8上午报告结果。贵司库存是否可用请以实测结果判断」\n同时从我司库存380件中抽取30件测板厚，可推定出货给K公司批次的状态（同一卷料）。品质保证科约2小时可完成。' },
        { q: '测了30件全部在1.16〜1.21。可以当良品处理吗？', a: '实测30件全部在1.16〜1.21（相对下限1.14最小余量0.02），进入我司的部分很可能在规格内。但**确定「良品处理」前有2点**：\n① 向S公司确认卷料的哪个位置（头部／尾部）可疑。卷料内板厚会波动，我司库存（卷料后半）合格不代表8/25生产分（卷料前半）合格\n② K公司要求规格（Rev.D §3.1）规定材料疑有不良时需「供应商重新出具材质单或第三方测量」\n建议：向K公司报告「我司库存30件实测全部在规格内（1.16〜1.21）。等S公司卷料调查结果（预计9/9）后最终判断」。库存380件继续保留至S公司回复。未使用材料0.6 t 退回S公司，或全数测厚后判断可否使用。' }
      ] } },

  en3: { template: 'upload',
    persona: { name: { ja: '王 磊', zh: '王磊', en: 'Wang Lei' },
               role: { ja: '生産技術課 主任', zh: '生产技术科 主管', en: 'Production Engineering Supervisor' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['K 社から新規引合の図面が来た。似た部品を過去に作っていた気がするが、誰も正確に覚えていない', '引合図面（PDF）をアップロード', '形状・寸法・材質・加工要件が近い過去図面と、その工程・原価・不具合履歴が返る', '流用できる治具・金型を確認し、見積の初期検討に使う'],
             zh: ['K公司发来新询价图纸。感觉以前做过类似零件，但没人记得准确', '上传询价图纸（PDF）', '返回形状、尺寸、材质、加工要求相近的历史图纸及其工艺、成本、不良履历', '确认可沿用的治具、模具，用于报价初期评估'],
             en: ['A new inquiry drawing arrives from K; someone recalls a similar part but nobody is sure', 'Upload the inquiry drawing (PDF)', 'Get past drawings with similar geometry, size, material and machining, plus their process, cost and defects', 'Check reusable jigs and molds and use it for early quoting'] },
    input: { ja: { files: ['引合図面_K社_RFQ-2025-118.pdf'] }, zh: { files: ['询价图纸_K公司_RFQ-2025-118.pdf'] } },
    result: {
      ja: { title: '類似図面検索：RFQ-2025-118（L 型ブラケット、SPCC t1.5、曲げ 2 か所、M6 タップ ×2、塗装）',
            columns: ['順位', '過去図面', '類似度', '一致した要素', '相違点', '工程・原価・不具合履歴'],
            rows: [
              ['1', 'SK-3310-A（2022〜、K 社向け）', '**87%**', '外形 L 型 195×80、曲げ R3 ×2、塗装（同色系）', '板厚 t1.2 vs t1.5、タップ穴なし vs M6×2、リブなし', 'プレス 3 工程＋塗装。原価 RMB 5.9。不具合：塗装ブツ（2024・2025）'],
              ['2', 'SK-2207-B（2021〜、K 社日本向け）', '74%', 'M6 タップ ×2、SPCC、曲げ 2 か所', '板厚 t1.0、外形が小さい（150×60）', 'プレス 3 工程＋タップ＋塗装。原価 RMB 4.1。不具合：タップ不通（3 件）'],
              ['3', 'SK-1190（2019〜2023、旧 J 社向け・終了）', '69%', '外形寸法ほぼ同一（198×82）、t1.5、リブ 1 本', '曲げ角度 90° vs 85°、無塗装、タップなし', 'プレス 4 工程。原価 RMB 4.6（2023）。金型 D-092 は**保管中**（倉庫 T-2）。不具合：リブ割れ（2020、材料変更で解消）'],
              ['流用候補', '—', '—', '—', '—', '金型 D-092（SK-1190）の抜き型・リブ成形型は改造で流用可能性あり（生産技術 見積要）。タップ治具 J-2207 は穴ピッチが 5mm 違い、流用不可']
            ] },
      zh: { title: '相似图纸检索：RFQ-2025-118（L型支架，SPCC t1.5，折弯2处，M6螺纹×2，涂装）',
            columns: ['排名', '历史图纸', '相似度', '一致要素', '差异', '工艺・成本・不良履历'],
            rows: [
              ['1', 'SK-3310-A（2022〜，K公司用）', '**87%**', '外形L型 195×80，折弯 R3×2，涂装（同色系）', '板厚 t1.2 vs t1.5，无螺纹孔 vs M6×2，无加强筋', '冲压3工序＋涂装。成本 RMB 5.9。不良：涂装颗粒（2024・2025）'],
              ['2', 'SK-2207-B（2021〜，K公司日本用）', '74%', 'M6螺纹×2，SPCC，折弯2处', '板厚 t1.0，外形较小（150×60）', '冲压3工序＋螺纹＋涂装。成本 RMB 4.1。不良：螺纹不通（3件）'],
              ['3', 'SK-1190（2019〜2023，原J公司用・已停产）', '69%', '外形尺寸几乎相同（198×82），t1.5，加强筋1条', '折弯角 90° vs 85°，无涂装，无螺纹', '冲压4工序。成本 RMB 4.6（2023）。模具 D-092 **保管中**（仓库 T-2）。不良：筋部开裂（2020，材料变更后解决）'],
              ['沿用候选', '—', '—', '—', '—', '模具 D-092（SK-1190）的落料模、筋成形模有改造沿用可能（需生产技术评估）。螺纹治具 J-2207 孔距差5mm，无法沿用']
            ] } },
    script: {
      ja: [
        { q: '【アップロード】引合図面_K社_RFQ-2025-118.pdf', a: '図面から形状（L 型 195×80）・板厚 t1.5・曲げ 2 か所・M6 タップ ×2・塗装を読み取り、過去図面 1,240 件から類似上位 3 件を出しました（右の表）。最も近いのは現行の SK-3310-A（87%）ですが、**見積上で重要なのは 3 位の SK-1190**です：外形と板厚がほぼ同一で、2023 年に終了した製品の金型 D-092 が倉庫 T-2 に保管されています。抜き型とリブ成形型の改造流用ができれば、新規金型費（推定 RMB 620,000）を大幅に抑えられる可能性があります。※ 本サービスは構想段階で、類似度は形状特徴の機械的な一致率です。' },
        { q: 'D-092 の改造でどこまで安くなる？', a: '生産技術の過去の改造実績（金型 3 件）から推定：\n・抜き型：外形差 3mm（195 vs 198）は刃合わせ変更で対応可 → 改造費 RMB 45,000（新規 180,000）\n・リブ成形型：リブ本数 1→0（今回はリブなし）なので**この型は不要**。代わりに曲げ角度 85° の曲げ型が新規 → RMB 120,000\n・タップは機械加工で対応（金型不要）\n・塗装治具：SK-3310-A 用ラック J-3310 が寸法的に流用可（要確認）\n合計：改造 45,000 ＋ 新規曲げ型 120,000 ＋ 穴抜き型 新規 95,000 ＝ **RMB 260,000**（全新規 620,000 に対し ▲58%）。ただし D-092 は 2019 年製で総ショット 210 万、刃部の摩耗状態を金型倉庫で実物確認する必要があります（保全課 劉、半日）。' },
        { q: 'この 3 件の不具合履歴で、新規品で気を付けるべきことは？', a: '3 件の履歴から、新規品（RFQ-2025-118）で予防すべき不具合は 3 つ：\n① **塗装ブツ**（SK-3310-A、2024・2025）：同じ塗装外注 S 社・同色系なので再発リスクあり。8D-25-0912 の是正処置（脱脂液濃度 2 回/日チェック、フィルター 45 日交換）を新規品の工程条件に最初から組み込む\n② **タップ不通**（SK-2207-B、3 件）：M6 ×2 が共通。原因はいずれもタップ折損後の復旧ロットで、タップ交換基準（現行 500 穴）と折損時の全数通止検査をコントロールプランに明記\n③ **リブ割れ**（SK-1190、2020）：今回はリブなしのため直接は該当しないが、t1.5 の曲げ R3 は割れマージンが小さい。K 社に R3→R4 の図面変更を提案できるか、見積時に確認事項として挙げる\nこれらを見積書の「技術確認事項」欄に転記できます。' }
      ],
      zh: [
        { q: '【上传】询价图纸_K公司_RFQ-2025-118.pdf', a: '从图纸读取形状（L型 195×80）、板厚 t1.5、折弯2处、M6螺纹×2、涂装，在1,240张历史图纸中检出相似前3（见右表）。最接近的是现行 SK-3310-A（87%），但**对报价最重要的是第3位 SK-1190**：外形与板厚几乎相同，2023年停产产品的模具 D-092 保管在仓库 T-2。若落料模与筋成形模可改造沿用，有望大幅降低新模具费（估计 RMB 620,000）。※本服务处于构想阶段，相似度为形状特征的机械一致率。' },
        { q: '改造 D-092 能便宜多少？', a: '根据生产技术过去的模具改造实绩（3套）估算：\n・落料模：外形差3mm（195 vs 198）可通过修刃对应 → 改造费 RMB 45,000（新开180,000）\n・筋成形模：筋数1→0（本次无筋），**该模不需要**。改为新开85°折弯模 → RMB 120,000\n・螺纹用机加工（无需模具）\n・涂装治具：SK-3310-A 用挂架 J-3310 尺寸上可沿用（待确认）\n合计：改造45,000 ＋ 新折弯模120,000 ＋ 新冲孔模95,000 ＝ **RMB 260,000**（相比全新开620,000 ▲58%）。但 D-092 为2019年制造，累计210万冲次，需到模具仓库实物确认刃口磨损状态（保全科 刘，半天）。' },
        { q: '从这3件的不良履历看，新品要注意什么？', a: '根据3件履历，新品（RFQ-2025-118）应预防的不良有3项：\n① **涂装颗粒**（SK-3310-A，2024・2025）：同一涂装外协S公司、同色系，有再发风险。将 8D-25-0912 的纠正措施（脱脂液浓度2次/日检查、过滤器45天更换）从一开始就纳入新品工艺条件\n② **螺纹不通**（SK-2207-B，3件）：M6×2 相同。原因均为丝锥折断后的恢复批次，在控制计划中明确丝锥更换基准（现行500孔）及折断时的全数通止检验\n③ **筋部开裂**（SK-1190，2020）：本次无筋不直接涉及，但 t1.5 折弯 R3 开裂余量小。可在报价时列为确认事项，向K公司提议 R3→R4 的图纸变更\n以上可转录到报价单的「技术确认事项」栏。' }
      ] } },

  /* ---------------- gn: 汎用業務支援 ---------------- */
  gn1: { template: 'upload',
    persona: { name: { ja: '銭 芳', zh: '钱芳', en: 'Qian Fang' },
               role: { ja: '財務課 経費担当', zh: '财务科 费用担当', en: 'Finance Staff, Expenses' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['月末に精算申請が 60 件たまる。発票の記載不備や規程違反を 1 件ずつ目で見るのが限界', '精算申請一覧と発票画像（PDF まとめ）をアップロード', '規程違反・金額不一致・発票不備の一覧と、申請者への差し戻し文が返る', '問題のない申請を一括承認し、差し戻しを送信'],
             zh: ['月末积压60件报销申请，逐件目视核对发票缺陷与违规已到极限', '上传报销申请清单与发票图片（PDF合集）', '返回违规、金额不一致、发票缺陷的清单及给申请人的退回说明', '批量批准无问题的申请，发送退回通知'],
             en: ['60 expense claims pile up at month end; checking each fapiao by eye is unsustainable', 'Upload the claim list and fapiao images (PDF bundle)', 'Get a list of policy breaches, amount mismatches and fapiao defects with return notes', 'Bulk-approve clean claims and send the returns'] },
    input: { ja: { files: ['精算申請一覧_2025-08.xlsx', '発票画像_2025-08_60件.pdf'] }, zh: { files: ['报销申请清单_2025-08.xlsx', '发票图片_2025-08_60件.pdf'] } },
    result: {
      ja: { title: '経費精算チェック結果：2025 年 8 月分 60 件（問題なし 49／要確認 11）',
            columns: ['#', '申請者', '内容', '金額', '検出事項', '判定'],
            rows: [
              ['EX-0812', '李 強', '出張（上海、K 社訪問）宿泊', 'RMB 680', '発票の抬頭が「青岭精工（苏州）有限公司」ではなく個人名', '❗ 差し戻し（発票再発行）'],
              ['EX-0819', '高橋 亮', '接待（K 社購買部）', 'RMB 1,860', '接待費は 1 人 RMB 300 上限（規程 §6.2）。参加 5 名 → 上限 1,500', '❗ 差し戻し（超過 360 は自己負担 or 事前承認書添付）'],
              ['EX-0823', '王 磊', 'タクシー ×4', 'RMB 246', '発票 4 枚のうち 1 枚（RMB 58）が申請日と異なる日付（8/30 vs 申請 8/23）', '⚠ 確認'],
              ['EX-0831', '中村 大輔', '駐在員 一時帰国 航空券', '¥98,000（RMB 4,667）', '日本円建て。為替は社内レート 21.0 → RMB 4,667 で一致。規程上「年 2 回まで」の 2 回目', '✅（回数上限に到達、次回から不可の注記）'],
              ['EX-0835', '劉 洋', '工具購入（緊急）', 'RMB 3,200', '購買課を通さない直接購入。RMB 2,000 超は事前承認必要（規程 §4.1）', '❗ 差し戻し（事後承認書を添付すれば可）'],
              ['EX-0841', '張 小雨', '通勤交通費', 'RMB 320', '発票の税号（91320500…）が当社と一致。金額一致', '✅'],
              ['…', '（他 5 件）', '', '', '発票の税号相違 2、金額不一致 2、日付超過 1', '⚠ 一覧は Excel 出力']
            ] },
      zh: { title: '报销审核结果：2025年8月 60件（无问题49／待确认11）',
            columns: ['#', '申请人', '内容', '金额', '检出事项', '判定'],
            rows: [
              ['EX-0812', '李强', '出差（上海，拜访K公司）住宿', 'RMB 680', '发票抬头不是「青岭精工（苏州）有限公司」而是个人姓名', '❗ 退回（重开发票）'],
              ['EX-0819', '高桥亮', '招待（K公司采购部）', 'RMB 1,860', '招待费每人上限 RMB 300（规定 §6.2）。5人参加 → 上限1,500', '❗ 退回（超出360自行承担或附事前批准）'],
              ['EX-0823', '王磊', '出租车 ×4', 'RMB 246', '4张发票中1张（RMB 58）日期与申请不符（8/30 vs 申请8/23）', '⚠ 确认'],
              ['EX-0831', '中村大辅', '驻在员临时回国机票', '¥98,000（RMB 4,667）', '日元计价。按公司汇率21.0 → RMB 4,667 一致。规定「每年2次」的第2次', '✅（已达次数上限，注明下次不可）'],
              ['EX-0835', '刘洋', '工具购买（紧急）', 'RMB 3,200', '未经采购科直接购买。超 RMB 2,000 需事前批准（规定 §4.1）', '❗ 退回（附事后批准可通过）'],
              ['EX-0841', '张小雨', '通勤交通费', 'RMB 320', '发票税号（91320500…）与本公司一致。金额一致', '✅'],
              ['…', '（其他5件）', '', '', '发票税号不符2、金额不一致2、日期超期1', '⚠ 清单输出为Excel']
            ] } },
    script: {
      ja: [
        { q: '【アップロード】精算申請一覧_2025-08.xlsx、発票画像_2025-08_60件.pdf', a: '60 件を照合しました。**問題なし 49 件・要確認 11 件**です（右の表。全件は Excel で出力）。差し戻し確定は 3 件：発票の抬頭が個人名（EX-0812）、接待費の上限超過（EX-0819）、事前承認なしの RMB 2,000 超購入（EX-0835）。中村さんの一時帰国航空券は日本円建てで社内レート換算が一致、規程の年 2 回目に到達しています。' },
        { q: '差し戻し 3 件の申請者への連絡文を作って（中国語、丁寧に）', a: '差し戻し連絡（3 件、中国語）：\n【EX-0812 李强】「李科长：您好。8月报销 EX-0812（上海住宿 RMB 680）的发票抬头为个人姓名，按规定需为「青岭精工（苏州）有限公司」并注明税号。请联系酒店重开后重新提交，谢谢。财务科 钱芳」\n【EX-0819 高桥亮】「高桥先生：您好。8月报销 EX-0819（招待K公司采购部 RMB 1,860）超出招待费标准（每人 RMB 300 × 5人 = 1,500）。超出部分360元请选择：①自行承担 ②补附事前批准书（厂长签字）。请告知处理方式，谢谢。财务科 钱芳」\n【EX-0835 刘洋】「刘技师：您好。8月报销 EX-0835（工具 RMB 3,200）未经采购科且超过 RMB 2,000，按规定 §4.1 需事前批准。请补附事后批准书（设备保全科长签字）后重新提交。紧急采购的情况理解，之后请提前联系采购科，谢谢。财务科 钱芳」' },
        { q: '毎月同じ人が同じ不備を繰り返してる？', a: '直近 6 か月の差し戻し履歴を集計：\n・発票抬頭の不備：計 9 件、うち製造二課 4 件（李課長 2、班長 2）。出張先ホテルで会社名を伝えていないケース\n・接待費超過：計 4 件、うち営業 3 件（高橋さん 2）。K 社との接待が毎回 5 名以上\n・事前承認なし購入：計 5 件、うち設備保全課 4 件。夜勤・休日の緊急購入が実態\n示唆：個人の問題より**運用側の課題**が 2 つ見えます。①出張者向けに「発票抬頭・税号カード」（財布に入るサイズ）を配布 ②設備保全課に「緊急購入の事後承認フロー（RMB 5,000 まで課長決裁）」を規程に追加。財務課長への提案メモを作成しますか？' }
      ],
      zh: [
        { q: '【上传】报销申请清单_2025-08.xlsx、发票图片_2025-08_60件.pdf', a: '已核对60件。**无问题49件・待确认11件**（见右表，全部清单输出为Excel）。确定退回3件：发票抬头为个人（EX-0812）、招待费超标（EX-0819）、无事前批准的超 RMB 2,000 采购（EX-0835）。中村的临时回国机票为日元计价，按公司汇率换算一致，已达规定的每年第2次。' },
        { q: '给退回的3件申请人写通知（中文，礼貌）', a: '退回通知（3件）：\n【EX-0812 李强】「李科长：您好。8月报销 EX-0812（上海住宿 RMB 680）的发票抬头为个人姓名，按规定需为「青岭精工（苏州）有限公司」并注明税号。请联系酒店重开后重新提交，谢谢。财务科 钱芳」\n【EX-0819 高桥亮】「高桥先生：您好。8月报销 EX-0819（招待K公司采购部 RMB 1,860）超出招待费标准（每人 RMB 300 × 5人 = 1,500）。超出部分360元请选择：①自行承担 ②补附事前批准书（厂长签字）。请告知处理方式，谢谢。财务科 钱芳」\n【EX-0835 刘洋】「刘技师：您好。8月报销 EX-0835（工具 RMB 3,200）未经采购科且超过 RMB 2,000，按规定 §4.1 需事前批准。请补附事后批准书（设备保全科长签字）后重新提交。紧急采购的情况理解，之后请提前联系采购科，谢谢。财务科 钱芳」' },
        { q: '是不是每个月都是同样的人犯同样的错？', a: '汇总近6个月退回记录：\n・发票抬头缺陷：共9件，其中制造二科4件（李科长2、班长2）。多为出差时未向酒店告知公司名\n・招待费超标：共4件，其中销售3件（高桥2）。与K公司的招待每次5人以上\n・无事前批准采购：共5件，其中设备保全科4件。实际为夜班、休息日的紧急采购\n洞察：比起个人问题，更能看出2个**运营层面的课题**。①向出差人员发放「发票抬头・税号卡」（钱包大小）②在规定中为设备保全科增加「紧急采购事后批准流程（RMB 5,000以内科长决裁）」。是否生成给财务科长的提案备忘？' }
      ] } },

  gn2: { template: 'upload',
    persona: { name: { ja: '銭 芳', zh: '钱芳', en: 'Qian Fang' },
               role: { ja: '財務課 買掛担当', zh: '财务科 应付担当', en: 'Finance Staff, Accounts Payable' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['月初にサプライヤーから増値税発票が 40 枚届く。発注・入庫との照合と仕訳入力に 2 日かかる', '発票 PDF と当月の発注・入庫データをアップロード', '三点照合の結果・仕訳候補・支払期日一覧と、不一致の発票が返る', '不一致分をサプライヤーに連絡し、会計システムへ登録'],
             zh: ['月初收到供应商增值税发票40张，与订单、入库核对及记账要2天', '上传发票PDF与当月订单、入库数据', '返回三单匹配结果、记账科目建议、付款期限清单及不一致发票', '联系供应商处理不一致部分，录入财务系统'],
             en: ['40 VAT fapiao arrive at month start; matching to POs and receipts plus journal entry takes 2 days', 'Upload the fapiao PDFs and the month\'s PO and receipt data', 'Get three-way matching results, journal proposals, due dates and mismatches', 'Contact suppliers on mismatches and post to the accounting system'] },
    input: { ja: { files: ['增值税发票_2025-08_40枚.pdf', '発注データ_2025-08.xlsx', '入庫データ_2025-08.xlsx'] }, zh: { files: ['增值税发票_2025-08_40张.pdf', '采购订单_2025-08.xlsx', '入库数据_2025-08.xlsx'] } },
    result: {
      ja: { title: '請求書（発票）処理：2025 年 8 月 40 枚（一致 36／不一致 4）',
            columns: ['発票番号', 'サプライヤー', '金額（税込）', '発注 / 入庫 照合', '仕訳候補', '支払期日', '判定'],
            rows: [
              ['0250812…33', 'S 社（鋼板）', 'RMB 186,420', 'PO-2508-011 ／ 入庫 8/19 2.4 t 一致', '原材料 ／ 買掛金・仮払増値税 13%', '10/31（月末締め 60 日）', '✅'],
              ['0250815…07', 'S 工具', 'RMB 22,320', 'PO-2508-019 120 本 ／ 入庫 120 本 一致', '消耗工具費 ／ 買掛金', '10/31', '✅'],
              ['0250820…41', '塗装 S 社', 'RMB 48,600', 'PO-2508-024 24,000 個 ／ 入庫 23,400 個', '外注加工費', '—', '❗ 数量不一致：入庫 600 個少（不良返却分 600 が控除されていない）'],
              ['0250822…18', 'U 刀具', 'RMB 3,560', 'PO なし', '—', '—', '❗ 発注なし。設備保全課の緊急購入（EX-0835 関連）。PO 事後起票が必要'],
              ['0250826…52', 'T 社（サンプル材）', 'RMB 4,200', 'PO-2508-031 一致 ／ 入庫 8/28', '試験研究費', '9/30（月末締め 30 日）', '✅'],
              ['0250828…09', '物流 W 社', 'RMB 12,800', 'PO-2508-027 ／ 実績 8 便', '運賃 ／ 買掛金・仮払増値税 9%', '9/30', '⚠ 税率 9%（運輸）で正しいが、発票に 13% と記載 → 再発行依頼'],
              ['0250829…66', '電力会社', 'RMB 96,300', '契約 ／ メーター実績', '水道光熱費', '9/15', '✅'],
              ['0250830…21', 'K 社（有償支給材）', 'RMB 8,900', 'PO-2508-035 ／ 入庫 8/30', '原材料', '10/31', '❗ 発票の税号が K 社常熟ではなく K 社上海。取引先マスタと不一致']
            ] },
      zh: { title: '发票处理：2025年8月 40张（匹配36／不匹配4）',
            columns: ['发票号', '供应商', '金额（含税）', '订单 / 入库 匹配', '记账建议', '付款期限', '判定'],
            rows: [
              ['0250812…33', 'S公司（钢板）', 'RMB 186,420', 'PO-2508-011 ／ 入库 8/19 2.4 t 一致', '原材料 ／ 应付账款・进项税 13%', '10/31（月结60天）', '✅'],
              ['0250815…07', 'S刀具', 'RMB 22,320', 'PO-2508-019 120支 ／ 入库120支 一致', '低值易耗品 ／ 应付账款', '10/31', '✅'],
              ['0250820…41', '涂装S公司', 'RMB 48,600', 'PO-2508-024 24,000件 ／ 入库 23,400件', '外协加工费', '—', '❗ 数量不一致：入库少600件（不良退回600未扣除）'],
              ['0250822…18', 'U刀具', 'RMB 3,560', '无PO', '—', '—', '❗ 无订单。设备保全科紧急采购（与 EX-0835 相关）。需事后补PO'],
              ['0250826…52', 'T公司（样材）', 'RMB 4,200', 'PO-2508-031 一致 ／ 入库 8/28', '研发费用', '9/30（月结30天）', '✅'],
              ['0250828…09', '物流W公司', 'RMB 12,800', 'PO-2508-027 ／ 实绩8车次', '运费 ／ 应付账款・进项税 9%', '9/30', '⚠ 税率应为9%（运输），发票写13% → 申请重开'],
              ['0250829…66', '电力公司', 'RMB 96,300', '合同 ／ 电表实绩', '水电费', '9/15', '✅'],
              ['0250830…21', 'K公司（有偿供料）', 'RMB 8,900', 'PO-2508-035 ／ 入库 8/30', '原材料', '10/31', '❗ 发票税号为K公司上海而非K公司常熟。与供应商主数据不一致']
            ] } },
    script: {
      ja: [
        { q: '【アップロード】增值税发票_2025-08_40枚.pdf、発注データ_2025-08.xlsx、入庫データ_2025-08.xlsx', a: '40 枚を発注・入庫と三点照合しました。**一致 36 枚・不一致 4 枚**です（右の表は抜粋、全件は Excel 出力）。不一致の内訳：数量差（塗装 S 社、不良返却 600 個の未控除）、発注なし（U 刀具、緊急購入）、税率誤記（物流 W 社、9% のところ 13%）、税号相違（K 社上海 vs 常熟）。一致 36 枚は仕訳候補と支払期日を付けて会計システム登録用 CSV を出力できます。' },
        { q: '塗装 S 社の 600 個の件、S 社に何て言えばいい？返品の記録はある？', a: '返品記録を確認しました：8/22 に不良返却 600 個（返却伝票 RT-2508-04、理由「塗膜厚不足」、S 社受領サイン済み）。S 社の発票は返却前の納入数 24,000 個で発行されています。連絡文（中国語）：\n「S公司 财务部：您好。贵司发票 0250820…41（RMB 48,600、24,000件）中，包含8/22已退回的不良品600件（退货单 RT-2508-04，贵司已签收）。请按实际入库数 23,400件 开具红字发票冲减600件（RMB 1,215），或重新开具发票。在收到更正发票前，本张发票暂不安排付款。谢谢。青岭精工 财务科 钱芳」\n金額：600 個 × 単価 RMB 2.025（税込）= RMB 1,215 です。' },
        { q: '会計システムに登録する CSV を出して。不一致 4 枚は除いて', a: '会計システム登録用 CSV（36 枚・RMB 512,840 税込）を出力しました：AP_import_2025-08.csv。\n列：伝票日付／発票番号／取引先コード／勘定科目／税抜金額／税率／税額／支払期日／摘要（PO 番号）\n勘定科目の内訳：原材料 RMB 214,900／外注加工費 96,400／消耗工具費 38,200／運賃 22,800／水道光熱費 96,300／その他 44,240。\n不一致 4 枚は「保留リスト_2025-08.xlsx」に理由・連絡先・期限を付けて別出力しています。W 社の税率誤記は 9/12 までに再発行がないと月次締めに影響するので、先に連絡することを推奨します。' }
      ],
      zh: [
        { q: '【上传】增值税发票_2025-08_40张.pdf、采购订单_2025-08.xlsx、入库数据_2025-08.xlsx', a: '已将40张发票与订单、入库进行三单匹配。**匹配36张・不匹配4张**（右表为摘录，全部输出为Excel）。不匹配明细：数量差（涂装S公司，不良退回600件未扣除）、无订单（U刀具，紧急采购）、税率错误（物流W公司，应为9%写成13%）、税号不符（K公司上海 vs 常熟）。匹配的36张可附记账科目与付款期限，输出财务系统导入用CSV。' },
        { q: '涂装S公司600件那件，怎么跟S公司说？有退货记录吗？', a: '已确认退货记录：8/22 退回不良品600件（退货单 RT-2508-04，理由「涂膜厚度不足」，S公司已签收）。S公司发票按退货前的交货数24,000件开具。联系文案：\n「S公司 财务部：您好。贵司发票 0250820…41（RMB 48,600、24,000件）中，包含8/22已退回的不良品600件（退货单 RT-2508-04，贵司已签收）。请按实际入库数 23,400件 开具红字发票冲减600件（RMB 1,215），或重新开具发票。在收到更正发票前，本张发票暂不安排付款。谢谢。青岭精工 财务科 钱芳」\n金额：600件 × 单价 RMB 2.025（含税）= RMB 1,215。' },
        { q: '输出导入财务系统的CSV，排除不匹配的4张', a: '已输出财务系统导入用CSV（36张・RMB 512,840 含税）：AP_import_2025-08.csv。\n列：凭证日期／发票号／供应商代码／会计科目／不含税金额／税率／税额／付款期限／摘要（PO号）\n科目明细：原材料 RMB 214,900／外协加工费 96,400／低值易耗品 38,200／运费 22,800／水电费 96,300／其他 44,240。\n不匹配4张已另行输出为「保留清单_2025-08.xlsx」，附理由、联系人与期限。W公司税率错误若9/12前未重开会影响月结，建议先联系。' }
      ] } },

  gn3: { template: 'upload',
    persona: { name: { ja: '呉 婷', zh: '吴婷', en: 'Wu Ting' },
               role: { ja: '生産管理課 受注担当', zh: '生产管理科 订单担当', en: 'Production Control, Order Desk' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'zh' },
    steps: { ja: ['K 社から 10 月の確定注文書（Excel）と 11〜12 月の内示（PDF）、日本本社からメール注文が同じ日に届いた', '3 種の注文書類をアップロード', '基幹システム登録案（品番・数量・納期）と、前回との差分・要確認事項が返る', '差分を確認して登録し、生産計画へ引き渡す'],
             zh: ['同一天收到K公司10月确定订单（Excel）、11〜12月预示（PDF）及日本总部邮件订单', '上传3种订单文件', '返回核心系统录入草案（品号・数量・交期）及与上次的差异、待确认事项', '确认差异后录入，移交生产计划'],
             en: ['On one day: K\'s firm October PO (Excel), Nov–Dec forecast (PDF) and an HQ email order', 'Upload the three order documents', 'Get draft core-system entries (part, qty, date) with deltas vs last time and open points', 'Confirm deltas, post and hand over to planning'] },
    input: { ja: { files: ['K社_確定注文_2025-10.xlsx', 'K社_内示_2025-11-12.pdf', 'メール_本社注文_0906.txt'] }, zh: { files: ['K公司_确定订单_2025-10.xlsx', 'K公司_预示_2025-11-12.pdf', '邮件_总部订单_0906.txt'] } },
    result: {
      ja: { title: '受注登録案：2025-09-06 受領 3 件（確定 2／内示 1）',
            columns: ['区分', '顧客', '品番', '数量', '納期', '前回（前月同期）との差', '要確認'],
            rows: [
              ['確定', 'K 社 常熟', 'SK-3310-A', '26,900', '10/6, 13, 20, 27（各 6,725）', '**+2,900（+12%）**。9 月確定 24,000', '9/12 回答済の +12% と一致 ✅。単価 USD 0.525 変更なし'],
              ['確定', 'K 社 常熟', 'SK-3318', '9,600', '10/6, 20（各 4,800）', '±0', '—'],
              ['確定', 'K 社 常熟', 'SK-2207-B', '7,200', '10/13, 27', '**▲1,200（▲14%）**', '⚠ 減少。クレーム CL-25-0906 の影響か、営業に確認'],
              ['内示', 'K 社 常熟', 'SK-3310-A', '11 月 27,500／12 月 25,000', '—', '11 月 +14%、12 月 +4%（前回内示比）', '12 月は T 社材切替（ECR-25-0088）の初月。材料手配に反映'],
              ['内示', 'K 社 常熟', 'SK-3310-C（新規）', '12 月 5,000（試作）', '—', '新規', '❗ 見積 RFQ-2025-118 は未回答。内示のみで受注登録不可 → 営業へ'],
              ['確定', '日本本社', 'SK-2207-B', '3,000', '9/12 出荷（船便）', '追加分（9/6 チャット照会の件）', '✅ 在庫照会で対応可と回答済。通い箱 30 箱 手配中'],
              ['確定', '日本本社', 'SK-3318', '2,400', '10/3 出荷', '±0（定期）', '⚠ メール本文の品番が「SK-3318-A」。当社品番は「SK-3318」（枝番なし）。本社に確認']
            ] },
      zh: { title: '订单录入草案：2025-09-06 收到3件（确定2／预示1）',
            columns: ['类别', '客户', '品号', '数量', '交期', '与上次（上月同期）的差异', '待确认'],
            rows: [
              ['确定', 'K公司 常熟', 'SK-3310-A', '26,900', '10/6, 13, 20, 27（各6,725）', '**+2,900（+12%）**。9月确定24,000', '与9/12回复的+12%一致 ✅。单价 USD 0.525 无变化'],
              ['确定', 'K公司 常熟', 'SK-3318', '9,600', '10/6, 20（各4,800）', '±0', '—'],
              ['确定', 'K公司 常熟', 'SK-2207-B', '7,200', '10/13, 27', '**▲1,200（▲14%）**', '⚠ 减少。是否受客诉 CL-25-0906 影响，向销售确认'],
              ['预示', 'K公司 常熟', 'SK-3310-A', '11月 27,500／12月 25,000', '—', '11月+14%、12月+4%（较上次预示）', '12月是切换T公司材料（ECR-25-0088）的首月。反映到材料安排'],
              ['预示', 'K公司 常熟', 'SK-3310-C（新品）', '12月 5,000（试制）', '—', '新品', '❗ 报价 RFQ-2025-118 尚未回复。仅预示不能登记订单 → 转销售'],
              ['确定', '日本总部', 'SK-2207-B', '3,000', '9/12 出货（海运）', '追加分（9/6 聊天咨询那件）', '✅ 库存查询已回复可对应。周转箱30箱安排中'],
              ['确定', '日本总部', 'SK-3318', '2,400', '10/3 出货', '±0（定期）', '⚠ 邮件正文品号为「SK-3318-A」。本公司品号为「SK-3318」（无后缀）。向总部确认']
            ] } },
    script: {
      ja: [
        { q: '【アップロード】K社_確定注文_2025-10.xlsx、K社_内示_2025-11-12.pdf、メール_本社注文_0906.txt', a: '3 書類（Excel・PDF・日本語メール）を構造化し、基幹システム登録案 7 行を作成しました（右の表）。確定注文は K 社 3 品番・本社 2 品番で、そのまま登録できるのは 4 行です。要確認 3 件：① SK-2207-B の K 社注文が ▲14%（クレームの影響か営業に確認）② 本社メールの品番「SK-3318-A」は当社に存在しない（枝番の誤記と推定）③ 内示の SK-3310-C は見積未回答なので登録不可。' },
        { q: 'SK-3318-A の件、本社の過去メールで同じ書き方してた？', a: '本社からの過去 12 か月の注文メール（26 通）を確認：「SK-3318」と正しく書いているのが 23 通、「SK-3318-A」が 3 通（2025 年 3 月・6 月・今回）。3 通とも同じ発信者（本社営業 佐々木さん）で、いずれも実際の納入は SK-3318 でした。誤記の可能性が高いですが、K 社 Rev.D で SK-3310 系の派生品が増えているため念のため確認を推奨します。確認メール（日本語）：「佐々木様 いつもお世話になります。9/6 ご注文の品番「SK-3318-A」は、当社品番「SK-3318」（枝番なし）として承ってよろしいでしょうか。過去 3 月・6 月分と同じ品目と理解しております。 蘇州工場 生産管理 呉」' },
        { q: '登録できる 4 行を登録して、生産計画に渡す形で出して', a: '基幹システム登録用データ（4 行）を出力しました：SO_import_20250906.csv\n・SO-2510-001 K 社常熟 SK-3310-A 26,900（4 分納）\n・SO-2510-002 K 社常熟 SK-3318 9,600（2 分納）\n・SO-2509-018 本社 SK-2207-B 3,000（9/12 出荷）\n・SO-2510-003 本社 SK-3318 2,400（10/3 出荷）※ 品番確認の返事待ちなら保留に切替可\n生産計画向けの引き渡しメモ（中国語・日本語併記）：「10 月 SK-3310-A は +12%（26,900）で確定。週次 6,725 個 × 4 週。L2 の稼働計画を 9/15 の生産会議で確認要。SK-2207-B は K 社分が ▲1,200 のため 10 月 L1 の負荷は前月比 ▲8%」。内示 2 行は「参考」として生産計画の内示欄に別途出力しています。' }
      ],
      zh: [
        { q: '【上传】K公司_确定订单_2025-10.xlsx、K公司_预示_2025-11-12.pdf、邮件_总部订单_0906.txt', a: '已将3份文件（Excel・PDF・日文邮件）结构化，生成核心系统录入草案7行（见右表）。确定订单为K公司3个品号、总部2个品号，可直接录入4行。待确认3件：① SK-2207-B 的K公司订单 ▲14%（是否受客诉影响，向销售确认）② 总部邮件的品号「SK-3318-A」本公司不存在（推测为后缀误写）③ 预示的 SK-3310-C 报价尚未回复，不能录入。' },
        { q: 'SK-3318-A 这件，总部以前的邮件也是这么写的吗？', a: '核对了总部近12个月的订单邮件（26封）：正确写「SK-3318」的23封，「SK-3318-A」的3封（2025年3月、6月、本次）。3封均为同一发件人（总部销售 佐佐木），实际交货均为 SK-3318。误写可能性大，但因K公司 Rev.D 后 SK-3310 系派生品增多，建议还是确认一下。确认邮件（日文）：「佐々木様 いつもお世話になります。9/6 ご注文の品番「SK-3318-A」は、当社品番「SK-3318」（枝番なし）として承ってよろしいでしょうか。過去 3 月・6 月分と同じ品目と理解しております。 蘇州工場 生産管理 呉」' },
        { q: '把能录入的4行录入，并输出移交生产计划的形式', a: '已输出核心系统录入数据（4行）：SO_import_20250906.csv\n・SO-2510-001 K公司常熟 SK-3310-A 26,900（4批交付）\n・SO-2510-002 K公司常熟 SK-3318 9,600（2批交付）\n・SO-2509-018 总部 SK-2207-B 3,000（9/12出货）\n・SO-2510-003 总部 SK-3318 2,400（10/3出货）※若等待品号确认可切换为保留\n移交生产计划的备忘（中日对照）：「10月 SK-3310-A 按+12%（26,900）确定。每周6,725件×4周。L2稼动计划需在9/15生产会议确认。SK-2207-B K公司分 ▲1,200，10月L1负荷环比 ▲8%」。预示2行作为「参考」另行输出到生产计划的预示栏。' }
      ] } },

  gn4: { template: 'qa',
    persona: { name: { ja: '佐藤 美咲', zh: '佐藤美咲', en: 'Misaki Sato' },
               role: { ja: '管理部 総務・人事 駐在員', zh: '管理部 总务人事 驻在员', en: 'Admin & HR Expatriate' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'ja' },
    steps: { ja: ['本社設備部 2 名の来訪（乾燥炉の据付立会い）と K 社監査が近く、日中の関係者 8 名の日程を合わせる必要がある', '参加者・所要時間・制約を日本語で伝える', '時差・両国の祝日・各人の空きを踏まえた候補日時と、2 言語の招集メール案が返る', '候補を確定して招集を送信'],
             zh: ['总部设备部2人来访（烘干炉安装监督）与K公司审核临近，需协调中日8名相关人员的日程', '用日文告知参会者、所需时间、限制条件', '返回考虑时差、两国节假日、各人空闲的候选时间及双语邀请草案', '确定候选后发送邀请'],
             en: ['HQ equipment staff visit and the K audit are near; align schedules for 8 people across JP and CN', 'Describe attendees, duration and constraints in Japanese', 'Get candidate slots considering time difference, holidays and availability, plus a bilingual invitation', 'Confirm and send the invitation'] },
    script: {
      ja: [
        { q: '本社設備部の山田さん・鈴木さんと、こちらの小林工場長・田中部長・李課長・劉技師・王主任・私で、乾燥炉据付の事前打合せをオンラインで 90 分。9 月中に。', a: '8 名の空き状況と両国の祝日を照合しました。制約：中国側は 9/15（月）生産会議、日本側は 9/23（火・秋分の日）休日、9/22（月）は本社が休暇取得推奨日。時差 1 時間（中国 = 日本 −1h）。候補 3 つ：\n① **9/18（木）中国 14:00〜15:30 ／ 日本 15:00〜16:30** — 8 名全員空き。推奨\n② 9/19（金）中国 10:00〜11:30 ／ 日本 11:00〜12:30 — 劉技師が 10:00〜10:30 に保全会議（前半 30 分不在）\n③ 9/25（木）中国 14:00〜15:30 ／ 日本 15:00〜16:30 — 全員空きだが、稟議 RG-25-0117 の承認予定（10 月中）に近く、事前打合せとしては遅め\n①で招集メールを作成しますか？' },
        { q: '① で。会議室は中国側は 2 階 B 会議室を押さえて。招集は日中 2 言語で', a: '2 階 B 会議室を 9/18 13:45〜15:45 で予約しました（前後 15 分の準備込み。プロジェクター・スピーカーフォンあり）。オンライン会議 URL を発行済み。招集メール案：\n---\n件名：【打合せ】塗装ライン乾燥炉 据付事前打合せ ／【会议】涂装线烘干炉 安装事前协调会\n\n日時：2025 年 9 月 18 日（木）15:00〜16:30（日本時間）／ 中国時間 14:00〜15:30\n場所：本社 … オンライン ／ 蘇州工場 2 階 B 会議室＋オンライン\n参加：本社設備部 山田・鈴木 ／ 蘇州工場 小林・田中・李・劉・王・佐藤\n議題：1. 据付スケジュール（春節連休 2/16〜22）2. 事前工事（電源・排気）3. 立会い体制と安全 4. 稟議 RG-25-0117 の状況\n\n时间：2025年9月18日（周四）中国时间 14:00〜15:30 ／ 日本时间 15:00〜16:30\n地点：苏州工厂 2楼 B会议室＋线上 ／ 总部 线上\n参会：总部设备部 山田・铃木 ／ 苏州工厂 小林・田中・李・刘・王・佐藤\n议题：1. 安装日程（春节假期 2/16〜22）2. 前期工程（电源・排气）3. 监督体制与安全 4. 审批 RG-25-0117 进展\n---\n添付候補：稟議書ドラフト RG-25-0117、A 社 据付仕様書。送信しますか？' },
        { q: '田中部長が 18 日は午後から外出になったらしい。どうする？', a: '田中部長の予定を再確認しました：9/18 13:00〜17:00「K 社常熟 訪問」が新規に入っています。選択肢：\n(a) **9/18 のまま、田中部長は移動中にスマホで参加**（K 社常熟まで車で 1 時間。14:00 開始なら移動中 30 分はオンライン参加可、以降は李課長が代理）\n(b) 9/19（金）10:00 に変更 — 劉技師が前半 30 分不在。据付の電源・排気の話（議題 2）を後半に回せば実害なし\n(c) 9/25（木）に変更 — 全員参加可だが 1 週間遅れ\n推奨は **(b)**。据付の技術的な話は劉技師より田中部長（決裁者）の全時間参加を優先すべきで、議題順を「1→3→4→2」に組み替えれば劉技師の不在も吸収できます。変更する場合、招集メールに「※日程変更のお知らせ」を冒頭に付けた版を出します。' }
      ],
      zh: [
        { q: '总部设备部的山田、铃木，加上我们这边小林厂长、田中部长、李科长、刘技师、王主管和我，要开一个烘干炉安装的事前协调会，线上90分钟，9月内。', a: '已核对8人的空闲与两国节假日。限制：中方9/15（周一）生产会议，日方9/23（周二・秋分日）休息，9/22（周一）为总部建议休假日。时差1小时（中国 = 日本 −1h）。3个候选：\n① **9/18（周四）中国 14:00〜15:30 ／ 日本 15:00〜16:30** — 8人全部空闲。推荐\n② 9/19（周五）中国 10:00〜11:30 ／ 日本 11:00〜12:30 — 刘技师 10:00〜10:30 有保全会议（前30分钟缺席）\n③ 9/25（周四）中国 14:00〜15:30 ／ 日本 15:00〜16:30 — 全员空闲，但接近审批 RG-25-0117 的预定批准时间（10月内），作为事前协调偏晚\n是否按①生成邀请邮件？' },
        { q: '就①。中方会议室订2楼B会议室。邀请用中日双语', a: '已预订2楼B会议室 9/18 13:45〜15:45（含前后15分钟准备。有投影仪与会议电话）。线上会议链接已生成。邀请邮件草案：\n---\n主题：【会议】涂装线烘干炉 安装事前协调会 ／【打合せ】塗装ライン乾燥炉 据付事前打合せ\n\n时间：2025年9月18日（周四）中国时间 14:00〜15:30 ／ 日本时间 15:00〜16:30\n地点：苏州工厂 2楼 B会议室＋线上 ／ 总部 线上\n参会：总部设备部 山田・铃木 ／ 苏州工厂 小林・田中・李・刘・王・佐藤\n议题：1. 安装日程（春节假期 2/16〜22）2. 前期工程（电源・排气）3. 监督体制与安全 4. 审批 RG-25-0117 进展\n\n日時：2025 年 9 月 18 日（木）15:00〜16:30（日本時間）／ 中国時間 14:00〜15:30\n場所：本社 … オンライン ／ 蘇州工場 2 階 B 会議室＋オンライン\n参加：本社設備部 山田・鈴木 ／ 蘇州工場 小林・田中・李・劉・王・佐藤\n議題：1. 据付スケジュール（春節連休 2/16〜22）2. 事前工事（電源・排気）3. 立会い体制と安全 4. 稟議 RG-25-0117 の状況\n---\n附件候选：审批单草案 RG-25-0117、A公司安装规格书。是否发送？' },
        { q: '听说田中部长18日下午要外出。怎么办？', a: '已重新确认田中部长日程：9/18 13:00〜17:00 新增「拜访K公司常熟」。选项：\n(a) **保持9/18，田中部长在途中用手机参加**（到K公司常熟车程1小时。14:00开始的话途中30分钟可线上参加，之后由李科长代理）\n(b) 改为9/19（周五）10:00 — 刘技师前30分钟缺席。把安装的电源、排气（议题2）放到后半段即无实际影响\n(c) 改为9/25（周四）— 全员可参加但晚1周\n推荐 **(b)**。安装的技术内容上，应优先保证决策者田中部长全程参加而非刘技师，把议题顺序改为「1→3→4→2」即可吸收刘技师的缺席。若变更，将输出在邀请邮件开头加「※日程变更通知」的版本。' }
      ] } },

  gn5: { template: 'upload',
    persona: { name: { ja: '小林 誠', zh: '小林诚', en: 'Makoto Kobayashi' },
               role: { ja: '工場長', zh: '厂长', en: 'Plant Manager' },
               site: { ja: '蘇州工場', zh: '苏州工厂', en: 'Suzhou Plant' }, native: 'ja' },
    steps: { ja: ['蘇州市の環境保護局から 38 ページの中国語通知（VOC 排出管理の強化）が届いた。全部読む時間がない', 'PDF をアップロードし、「日本語で 1 枚に。当社への影響中心で」と指示', '要点・当社への影響・期限・担当部署案の 1 枚要約が返る', '関係者に転送し、詳細確認を指示'],
             zh: ['收到苏州市环保局38页的中文通知（加强VOC排放管理），没时间全部读完', '上传PDF，指示「日文一页，以对本公司的影响为中心」', '返回要点、对本公司的影响、期限、负责部门方案的一页摘要', '转发相关人员，指示详细确认'],
             en: ['A 38-page Chinese notice on stricter VOC emissions arrives from the Suzhou environmental bureau', 'Upload the PDF and ask for a one-page Japanese summary focused on company impact', 'Get key points, impact, deadlines and proposed owners on one page', 'Forward to stakeholders and assign detailed review'] },
    input: { ja: { files: ['苏州市环保局_VOC排放管理通知_2025-09.pdf'] }, zh: { files: ['苏州市环保局_VOC排放管理通知_2025-09.pdf'] } },
    result: {
      ja: { title: '要約（日本語 1 枚）：蘇州市環境保護局「VOC 排出管理強化に関する通知」2025 年 9 月（原文 38 ページ）',
            items: [
              { k: '通知の要点（3 点）', v: '① 塗装・印刷・接着工程を持つ工業企業に、VOC 排出の**オンライン監視装置**の設置を義務化（2026-06-30 まで）\n② 塗料・溶剤の**低 VOC 製品への切替**目標（VOC 含有量 ≤ 420 g/L）。2026-12-31 までに切替計画を提出\n③ 年 1 回の**第三者測定と報告**（初回 2026 年 3 月まで）' },
              { k: '当社への影響', v: '・当社の塗装は外注 S 社（工場外）だが、**社内に接着工程（SK-3318 のブッシュ圧入・接着）があり対象**。接着剤の年間使用量 1.2 t は「小規模」区分（監視装置は簡易型で可）\n・S 社は「塗装企業」として本通知の直接対象。S 社の対応遅れ＝当社の供給リスク\n・K 社 Rev.D の塗膜厚 20 µm 化（塗料使用量 +12%）と低 VOC 化が同時期に重なる' },
              { k: '期限', v: '2026-03-31 初回第三者測定報告／2026-06-30 監視装置設置／2026-12-31 低 VOC 切替計画提出' },
              { k: '担当部署案', v: '・設備保全課（監視装置の選定・設置）— 予算見込み RMB 80〜120 千\n・生産技術課（接着剤の低 VOC 品評価）\n・購買課（S 社への対応状況ヒアリング、9 月中）\n・管理部（第三者測定機関の選定、報告書提出）' },
              { k: '原文の重要箇所', v: 'p.7 対象企業の定義／p.12〜14 監視装置の技術要件／p.22 小規模事業者の簡易措置／p.31 罰則（未設置 RMB 20〜100 千）' }
            ] },
      zh: { title: '摘要（日文一页・中文对照）：苏州市环保局《关于加强VOC排放管理的通知》2025年9月（原文38页）',
            items: [
              { k: '通知要点（3点）', v: '① 拥有涂装、印刷、粘接工序的工业企业，须安装VOC排放**在线监测装置**（2026-06-30前）\n② 涂料、溶剂**切换低VOC产品**目标（VOC含量 ≤ 420 g/L）。2026-12-31前提交切换计划\n③ 每年1次**第三方检测与报告**（首次2026年3月前）' },
              { k: '对本公司的影响', v: '・本公司涂装为外协S公司（厂外），但**厂内有粘接工序（SK-3318 衬套压入・粘接）属于对象**。粘接剂年用量1.2 t 属「小规模」类别（监测装置可用简易型）\n・S公司作为「涂装企业」是本通知的直接对象。S公司应对滞后＝本公司供应风险\n・K公司 Rev.D 涂层厚度改为20 µm（涂料用量+12%）与低VOC化时间重叠' },
              { k: '期限', v: '2026-03-31 首次第三方检测报告／2026-06-30 安装监测装置／2026-12-31 提交低VOC切换计划' },
              { k: '负责部门方案', v: '・设备保全科（监测装置选型・安装）— 预算预计 RMB 80〜120千\n・生产技术科（粘接剂低VOC品评价）\n・采购科（了解S公司应对状况，9月内）\n・管理部（第三方检测机构选定、报告提交）' },
              { k: '原文重要位置', v: 'p.7 对象企业定义／p.12〜14 监测装置技术要求／p.22 小规模企业简易措施／p.31 罚则（未安装 RMB 20〜100千）' }
            ] } },
    script: {
      ja: [
        { q: '【アップロード】苏州市环保局_VOC排放管理通知_2025-09.pdf — 日本語で 1 枚に。当社への影響中心で', a: '38 ページを読み、日本語 1 枚に要約しました（右の結果）。当社に関わる結論は 2 つ：① 当社の塗装は外注ですが、**社内の接着工程が対象**になります（小規模区分なので簡易型監視装置で可、2026-06-30 まで）。② 塗装外注 S 社が直接対象で、S 社の対応遅れが当社の供給リスクになります。K 社 Rev.D の塗膜厚アップと時期が重なる点も注意です。罰則は未設置で RMB 20〜100 千（p.31）。' },
        { q: '「小規模」の基準は原文のどこに？当社が本当に小規模に入るか確認したい', a: '原文 p.22 第五章第 12 条：「年间VOC物料（涂料、油墨、胶粘剂、清洗剂等）使用量合计不足 5 吨的企业，可采用简易在线监测或定期手工监测替代」。当社の対象物料は接着剤 1.2 t ＋ 洗浄剤（設備洗浄用イソプロパノール）0.4 t ＝ 合計 1.6 t で、5 t 未満に該当します。ただし注意点：p.23 に「使用量は直近 1 年の購買実績で証明する」とあり、購買課の 2024/9〜2025/8 の購買記録が根拠になります。念のため財務課で購買実績を確認してください。また塗装を将来内製化する場合は塗料が加算され、5 t を超える可能性があります。' },
        { q: '関係者に転送するメール、日本語と中国語で。担当と期限を明記', a: '転送メール案（日中併記）：\n---\n件名：【要対応】蘇州市 VOC 排出管理通知（2025-09）— 当社の対応分担 ／【需应对】苏州市VOC排放管理通知 — 本公司应对分工\n\n各位\n蘇州市環境保護局の通知（38 ページ）を要約しました（添付 1 枚）。当社は接着工程が対象（小規模区分）です。以下の分担で進めてください。\n・劉（設備保全）：簡易型監視装置の候補と見積 — 10/31\n・王（生産技術）：接着剤 低 VOC 品の評価計画 — 10/31\n・趙（購買）：S 社の本通知への対応状況ヒアリング — 9/30\n・中村（管理部）：第三者測定機関の選定、購買実績の確認 — 10/15\n次回生産会議（9/15）で 5 分報告をお願いします。\n\n各位：\n已将苏州市环保局通知（38页）摘要为1页（附件）。本公司的粘接工序属于对象（小规模类别）。请按以下分工推进。\n・刘（设备保全）：简易型监测装置候选与报价 — 10/31\n・王（生产技术）：粘接剂低VOC品评价计划 — 10/31\n・赵（采购）：了解S公司对本通知的应对状况 — 9/30\n・中村（管理部）：第三方检测机构选定、采购实绩确认 — 10/15\n请在下次生产会议（9/15）用5分钟汇报。\n小林\n---' }
      ],
      zh: [
        { q: '【上传】苏州市环保局_VOC排放管理通知_2025-09.pdf — 日文一页，以对本公司的影响为中心', a: '已读完38页，摘要为日文一页（右侧为中文对照）。与本公司相关的结论2点：① 本公司涂装为外协，但**厂内粘接工序属于对象**（小规模类别，可用简易型监测装置，2026-06-30前）。② 涂装外协S公司为直接对象，S公司应对滞后将成为本公司的供应风险。与K公司 Rev.D 涂层厚度提高的时间重叠也需注意。罚则为未安装 RMB 20〜100千（p.31）。' },
        { q: '「小规模」的标准在原文哪里？想确认本公司是否真的属于小规模', a: '原文 p.22 第五章第12条：「年间VOC物料（涂料、油墨、胶粘剂、清洗剂等）使用量合计不足 5 吨的企业，可采用简易在线监测或定期手工监测替代」。本公司对象物料为粘接剂1.2 t ＋ 清洗剂（设备清洗用异丙醇）0.4 t ＝ 合计1.6 t，符合5吨以下。但注意：p.23 写明「使用量以近1年采购实绩证明」，需以采购科 2024/9〜2025/8 的采购记录为依据，请财务科确认采购实绩。另外若将来涂装内制化，涂料将计入，可能超过5吨。' },
        { q: '写一封转发给相关人员的邮件，中日双语，写明负责人和期限', a: '转发邮件草案（中日对照）：\n---\n主题：【需应对】苏州市VOC排放管理通知（2025-09）— 本公司应对分工 ／【要対応】蘇州市 VOC 排出管理通知 — 当社の対応分担\n\n各位：\n已将苏州市环保局通知（38页）摘要为1页（附件）。本公司的粘接工序属于对象（小规模类别）。请按以下分工推进。\n・刘（设备保全）：简易型监测装置候选与报价 — 10/31\n・王（生产技术）：粘接剂低VOC品评价计划 — 10/31\n・赵（采购）：了解S公司对本通知的应对状况 — 9/30\n・中村（管理部）：第三方检测机构选定、采购实绩确认 — 10/15\n请在下次生产会议（9/15）用5分钟汇报。\n\n各位\n蘇州市環境保護局の通知（38 ページ）を要約しました（添付 1 枚）。当社は接着工程が対象（小規模区分）です。以下の分担で進めてください。\n・劉（設備保全）：簡易型監視装置の候補と見積 — 10/31\n・王（生産技術）：接着剤 低 VOC 品の評価計画 — 10/31\n・趙（購買）：S 社の本通知への対応状況ヒアリング — 9/30\n・中村（管理部）：第三者測定機関の選定、購買実績の確認 — 10/15\n次回生産会議（9/15）で 5 分報告をお願いします。\n小林\n---' }
      ] } }
};
```

### 6-1. ペルソナ一覧（重複の意図）

同じ人物を複数サービスに登場させている（王磊 ×4、李強 ×3、高橋 ×3、中村 ×2、佐藤 ×2、呉婷 ×3、陳静 ×2、周敏 ×2、孫麗 ×2、小林 ×3、田中 ×2、銭芳 ×2、劉洋・張小雨・趙偉 ×1）。**意図的**：デモで「同じ担当者が別サービスでも困っている」と見せると、カタログが個人の業務全体を覆うことが伝わる。`persona.role` は文脈に合わせて微差がある（例：王磊「主任」／「主任（教育担当兼務）」／「主任（用語集管理者）」）。統一が必要なら PM 判断（§9 P-8）。

---

## 7. 受け入れ条件

### 7-1. 機械検証

1. `node tools/verify.mjs` → **ALL PASS**（warn は既存の `未使用キー: all` のみ）。新設 §9（下記 7-2）を含む
2. `node tools/regress.mjs`（`--update` 前）→ FAIL し、差分が **`counts.ui: 27 → 49` と `T(UI キー) 追加` 22 件（§4-1 の key 一覧と一致）のみ**。`CATS` / `SVCS` / `TAGS` / `PATTERNS` の行が**出ない**
3. `node tools/regress.mjs --update` 後 → PASS。baseline `counts.ui` が 49
4. `git diff`：`CATS` / `SVCS` / `TAGS` / `PATTERNS` リテラルに差分なし。`T` は追加のみ（既存 27 キーの値不変）。`state` は `log: []` 追加のみ。既存 9 つの `data-act` 分岐は `start` の分岐追加以外そのまま。1 つ目の `<style>` に差分なし

### 7-2. `tools/verify.mjs` の拡張（B-1 の範囲）

- §2 i18n：`TEMPLATES[*].name/desc` を `checkML` に追加
- §7 共通レイヤー：`requiredActs` に `'run', 'chip', 'restart'` を追加（12 種）
- **新設 §9 シナリオ整合**（`grab('SCENARIOS')` で取得。`grab` の正規表現は `\{[\s\S]*?\n\}` で `\n};` まで取るので、`SCENARIOS` リテラル末尾は `\n};` で閉じ、**内側の `}` を行頭に置かない**（インデントする）こと）：
  - `SCENARIOS` の全キーが `SVCS[].id` に存在する（無い id → FAIL）
  - `SVCS` の全 id に `SCENARIOS` がある（無い → **warn**。B-1 では 28 件 warn が出る想定、B-2 で 0 になる）
  - `template` が `TEMPLATES` のキーに含まれる
  - `persona.name/role/site` が 3 言語、`persona.native` ∈ {ja, zh}
  - `steps.ja/zh/en` が同じ長さで 3〜6
  - `script.ja` と `script.zh` が同じ長さで 2〜4、各 `q`/`a` が非空文字列
  - `template !== 'qa'` のとき `input.ja/zh` と `result.ja/zh` が存在し、`result` は `items` か `columns+rows` のどちらか一方を持つ。`rows[*].length === columns.length`
  - `template === 'upload'` → `input.files` 配列／`form` → `input.fields` 配列／`diff` → `input.left` と `input.right`／`lookup` → `input.query`
  - `q`/`a` に `'`（U+0027）が含まれていない（リテラル評価に失敗するため。評価に成功した時点でほぼ保証されるが、`\'` エスケープも禁止したいので明示チェック）

### 7-3. 目視（PM／reviewer）

5. 33 サービスすべての詳細画面に「担当者」「画面タイプ」「利用シナリオ」が出て、ja / zh / en で切り替わる。CTA が「デモを見る／查看演示／View demo」
6. **`qa` 型**（kn1）：デモ開始直後にチップ 2 本（日／中）。日チップ → ja の Q/A、中チップ → zh の Q/A。3 往復後に `demoDone`。途中で自由入力（ひらがな含む）→ 次の ja 台本で返る。en UI でも台本は ja
7. **`upload` 型**（qa1）：実行前はドロップ領域にファイル 3 件・チップなし・`runHint`。「実行」→ ユーザー吹き出し「【アップロード】…」→ 700ms 後に返答 → 結果パネル（items 6 行）→ チップ出現。実行ボタンは `runDone` で disabled
8. **`form` 型**（dc5）：フィールド 4 行が既定値入り・readonly 風。「実行」→ 結果 items 8 行（`❗` `⚠` が表示される）
9. **`diff` 型**（qa2）：旧⇄新 2 箱。「実行」→ 表 5 列 × 5 行。横スクロールが `.panel` 内で起きる（ページ全体は横スクロールしない）
10. **`lookup` 型**（nm4）：照会欄に既定値。「実行」→ 表 3 列 × 7 行
11. デモ途中で言語切替（ja → zh → en）しても `log` の会話と結果パネルが保持され、UI ラベル（見出し・チップ先頭・ボタン）だけ切り替わる。結果パネルは実行時の言語のまま
12. 「最初から」→ 会話が消え、入力パネルが再び有効、チップ状態が初期に戻る
13. 別サービスを開いて「デモを見る」→ 前サービスの会話が残っていない
14. `SCENARIOS` から一時的に 1 件外して読み込む → その詳細は従来表示（ペルソナ等なし・CTA「利用開始する」）→ `chat` view に落ちる
15. ダーク：`.demo-wrap` `.panel` `.chip` `.tbl` `.persona` で浮いた色がない。`❗` `⚠` `✅` は絵文字（色トークン不要）
16. ウィンドウ幅 1180px 未満で `work-pane` と `chat-pane` が縦積み。`chat-pane` の入力欄が画面下に固定されている

---

## 8. PR 分割案 / 並列可否

| PR | ブランチ | 内容 | 依存 / 並列 |
|---|---|---|---|
| **B-1** テンプレート実装 | `feat/demo-template` | §2〜§5 全部（`T` 22 キー、`TEMPLATES`、`state.log`、ヘルパー、`renderMain` detail 拡張＋`demo` 分岐、`sendChat`、`run`/`chip`/`restart`、CSS）＋ `verify.mjs` 拡張（§7-2）＋ regress `--update` ＋ **`SCENARIOS` は 5 件だけ**（kn1 qa／qa1 upload／dc5 form／qa2 diff／nm4 lookup。各テンプレート 1 件で動作確認できる最小集合） | A のマージ後。B-2 と直列 |
| **B-2** 台本投入 | `feat/demo-scripts` | 残り 28 件の `SCENARIOS` を §6 から転記。コード変更なし。verify §9 の warn が 0 になる | B-1 のマージ後。**B-2 内は分類単位（kn / qa / dc / lg / nm / en / gn）で並列可**：`SCENARIOS` の別ブロックを追記するだけなのでファイル集合は重なるが行範囲が重ならない。マージ順は任意。同じ id を 2 か所に書かないこと |

- B-1 を「テンプレート骨格（`qa` のみ）」と「残り 4 テンプレート」に分ける案も可能だが、`panelHTML` / `resultHTML` は 1 関数で 4 テンプレートを分岐するため分割の効果が薄い。**B-1 は 1 PR を推奨**。
- B-2 の PR 本文には「設計書 §6 の転記のみ。regress 変化なし」と書く。
- A と B-1 の並列：A（データ）と B-1（`T` 追加・関数・CSS）は触る行が異なるため技術的には並列可能だが、B-1 の 5 件の `SCENARIOS` が A の id を参照するため**A 先行を推奨**（§1 前提）。

---

## 9. PM 判断待ち（推奨案は各 1 つ）

| # | 論点 | 選択肢 | **推奨** |
|---|---|---|---|
| P-1 | テンプレート数 | (a) 5 種（本書）／(b) 4 種：`diff` を `upload` に統合（旧⇄新の 2 ファイルをアップロードする形。qa2・en1 の 2 件だけなので影響小）／(c) 3 種：さらに `lookup` を `form` に統合 | **(a)**。`diff` の「旧⇄新」の見え方は顧客に分かりやすく、実装コストは入力パネル 1 分岐（10 行程度） |
| P-2 | チップの出し方 | (a) 日／中 2 本を常時（本書）／(b) UI 言語側 1 本だけ／(c) UI 言語側を大きく・他方を小さく | **(a)**。§2-5「入力は日中どちらでも」を目で見せられる唯一の場所 |
| P-3 | 結果パネルの言語 | (a) 実行時の言語で固定（本書）／(b) UI 言語に追従 | **(a)**。「生成された成果物」の演出。ただし顧客に「切り替わらない」と誤解されるなら (b) |
| P-4 | `chat` view の存続 | (a) フォールバックとして残す（本書）／(b) 全件に `SCENARIOS` が揃った B-2 後に削除 | **(a)**。§2-3 の `start` の意味を変えないため。削除は別 Issue（S レーン不可、`data-act` に触るため M） |
| P-5 | CLAUDE.md §2-3 への追記 | `view` の値に `'demo'`、`state` に `log`、`data-act` に `run`/`chip`/`restart`、データに `TEMPLATES`/`SCENARIOS` を列挙に加える | **承認を求める**。architect は CLAUDE.md を変えないため、B-1 マージ時に PM が更新 |
| P-6 | 台本の固有名 | (a) 架空の K 社・S 社・T 社・青嶺精工・蘇州工場（本書）／(b) 「顧客 A」「サプライヤー B」など更に抽象化／(c) 顧客の実名に差し替える版を別途 | **(a)**。デモの臨場感を優先。実在企業と重ならないことは確認済み。顧客プレゼン直前に (c) を検討 |
| P-7 | B-2 の PR 粒度 | (a) 1 PR／(b) 分類ごと 7 PR（並列） | **(a)**。台本はコードではないのでレビュー負荷は低い。急ぐなら (b) |
| P-8 | ペルソナの役職表記の統一 | (a) サービス文脈で微差を許容（本書 §6-1）／(b) 人物ごとに 1 表記に統一 | **(a)**。担当者が「兼務」している現実感が出る |
| P-9 | 詳細画面の手順（`steps`）の en | (a) 3 言語（本書。§2-1 に従う）／(b) ja/zh のみにして en UI では ja を出す | **(a)**。verify §2 の一貫性を崩さない |

---

## 10. CLAUDE.md への影響（PM 承認事項）

- **§2-3**：「状態」に `log`、`view` の値に `demo`、「遷移」に `run` / `chip` / `restart`、「データ」に `TEMPLATES` / `SCENARIOS` を追記（P-5）。契約の**精神（表示レイヤーは state を読んで描くだけ）は不変**：`demo` view も `state.log` と `SCENARIOS` を読んで描くだけで、パターン固有の都合は持たない。②③（ダッシュボード／業務フィード）はこの上に乗せられる（`SCENARIOS` のペルソナ・手順は業務フィードの素材になる）。
- **§2-5**：変更なし。台本が ja/zh のみ・入力言語で返答、という本書の設計はこの条項の実装例。
- **§3**：`verify.mjs` の説明行に「§9 シナリオ整合」を追記。
- **§6 バックログ**：「顧客版カタログ」は A＋B で完了。「モック ②③」は残る。

