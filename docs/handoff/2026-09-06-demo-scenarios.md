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

<!-- CONTINUE -->
