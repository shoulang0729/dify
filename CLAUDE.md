# CLAUDE.md — このリポジトリでの作業ルール

`shoulang0729/dify` は **AIエージェントカタログの UI モック**（`mock/`、GitHub Pages で公開）と、
**Dify 開発ツール群**（`scripts/`、`tools/`）を置くリポジトリ。
（SwingTrainer アプリ本体は別リポ `shoulang0729/Dify.SwingTrainer`。）

作業は **architect → implementer → reviewer** の3エージェント分業で進める（`/feature <お題>`）。
このファイルは3エージェント全員が読む。**特に「§2 load-bearing」が本体。**

---

## §1 レーン判定（PM が最初に決める）

| レーン | 基準 | 流れ |
|---|---|---|
| **S** | 文言・余白・要素の削除/移動のみ。データ層・多言語辞書・トークン・共通レイヤー・Pages 設定に**触らない** | PM が受け入れ条件を書く → implementer → reviewer（軽量。ただし §2 と verify は省かない） |
| **M/L** | それ以外すべて。特にデータ層・多言語・トークン・共通レイヤーに触るもの | architect（設計書＋Issue）→（UI なら PM がモック承認）→ implementer → reviewer |

迷ったら **M/L**。複数の小さな S は1つの Issue にまとめてよい。

---

## §2 load-bearing —— 勝手に変えない（壊れると困るもの）

各項目：**何を** / **なぜ** / **どこで検出するか**。

### 2-1. 多言語辞書のキー集合は ja / zh / en で完全一致
- 対象：`mock/catalog.html` 内の `T`（UI 文言）・`TAGS`・`PATTERNS[].name/desc`・`CATS[].name/abbr/subs[].name`・`SVCS[].name/desc`
- なぜ：言語切替で一部だけ別言語が残る事故を防ぐ。`L(obj)` は `obj[lang] ?? obj.ja` にフォールバックするので**欠落は静かに日本語が出て気づけない**
- 検出：`tools/verify.mjs`（キー欠落・空値・`en` にかな残り）
- ルール：**追加は3言語同時**。英語はモック用ドラフトでよいが**空にしない**

### 2-2. 色はセマンティックトークンのみ。ブランドパレットは不変
- 対象：2つ目の `<style>`（コンポーネント CSS）に **`#RRGGBB` の直値を書かない**。必ず `var(--surface-*|--text-*|--border-*|--action-*|--status-*|--badge-*)`
- `--ntt-*`（NTT DATA ブランドパレット）は**変更禁止**。ダーク対応は `:root[data-theme="dark"]` で**セマンティック層だけ**上書き
- なぜ：直値が1つ入ると、その箇所だけダークで浮く／ブランド色がズレる
- 検出：`tools/verify.mjs`（直値検出・`var()` 未定義検出・dark ブロック存在）

### 2-3. 共通レイヤーの契約（パターンを増やすときの土台）
- **データ**：`CATS`（大分類→中分類）/ `SVCS`（サービス、`cat`/`sub`/`st`/`tags`/`name`/`desc`）/ `TAGS` / `TEMPLATES`（デモ画面テンプレート 5 種 `qa`/`upload`/`form`/`diff`/`lookup` の名称・説明、3 言語）/ `SCENARIOS`（サービス id → `{ template, persona{name,role,site,native}, steps{ja,zh,en}, input?, result?, script{ja,zh} }`。**台本 `script` と `input`/`result` は ja/zh のみ**＝§2-5 の実装。`SVCS` に埋め込まず別定数）/ `HOME`（② ダッシュボード用：`frequent`〔よく使う 6 件・サンプル利用件数〕・`recommended`〔おすすめ 3 件・理由 3 言語〕。**`SVCS` に埋め込まず別定数**。参照 id は `SVCS`/`CATS` に存在すること）
- **状態**：`state = { pattern, lang, theme, openCats, selCat, selSub, lastCat, selSvc, view, query, log }`。`view` は `list` / `detail` / `chat` / `demo`。`log` はデモで消費した台本ターン `[{lang,q,a}]`（`log.length` が次に消費する index。言語切替後の再描画で会話を復元）
- **遷移**：`document` の `click` ハンドラの `data-act`（`pattern`/`all`/`cat`/`sub`/`svc`/`back`/`backdetail`/`start`/`send`/`run`/`chip`/`restart`/`gocat`）。`gocat` は分類タイルから直接その分類の一覧へ（`cat` と違いトグルしない）。`start` は `SCENARIOS` にあれば `demo`、なければ従来の `chat` へ（フォールバックを残す）
- **ホーム**：`view === 'list'` かつ `selCat`/`selSub`/`query` が全部空の状態。ここだけ `pattern` で描き分ける（① グリッド / ② `renderDash` / ③ `renderFeed`）。`detail`/`chat`/`demo` は 3 パターン完全共通
- ルール：**表示レイヤー（`renderSidebar` / `renderMain` 内のパターン分岐）は `state` を読んで描くだけ**。パターン固有の都合で `state` の形・データ形・遷移を変えない
- なぜ：**パターンを切り替えても選択位置が保持され、同じ業務を別の見せ方で直接比較できる**のはこの契約のおかげ。②③（ダッシュボード / 業務フィード）はこの上に乗せる
- 検出：`tools/verify.mjs`（`state` の必須キー・`data-act` 一覧・§9 シナリオ整合：`SCENARIOS` の id が `SVCS` に存在／`template` が `TEMPLATES` に存在／型の形式。台本の無い `SVCS` は warn／§10 `HOME`・`FEED` の参照 id と 3 言語）＋ reviewer の diff 監査

### 2-4. 「モックの足場」と「プロダクト機能」を混ぜない
- `.mockbar`（パターン選択セグメント）＝**レビュー用の足場**。本番 UI には存在しない
- ヘッダー右の **言語切替（日/中/英）と テーマ切替** ＝**プロダクト機能**。本番にも残る
- なぜ：顧客に「上のグレー帯は検討用、実画面はその下」と説明できる構成を保つ
- 検出：reviewer の diff 監査

### 2-5. 言語切替はメニュー表示のみ。エージェント本体は日中どちらの入力も受ける
- 言語切替が変えるのは**メニュー・ラベルの表示言語だけ**
- チャット入力は `detectLang()` で **入力言語（ja/zh）を判定し、UI 言語と無関係にその言語で返答**する
- 「日中対応」を**サービスの区別タグにしない**（全サービスの前提だから）
- 検出：`tools/verify.mjs`（`detectLang` の存在）＋ reviewer

### 2-6. `localStorage` キーは `mock.lang` / `mock.theme`
- 変えるとレビュー参加者の設定が飛ぶ。変更禁止
- 検出：`tools/verify.mjs`

### 2-7. 成熟度 `st` は 1 / 2 / 3（提供中 / 試行版 / 構想）
- 追加するなら `statusText` / `statusClass` / `.dot.*` / `.badge.*` / トークン（light・dark）を**同時に**
- 検出：`tools/verify.mjs`（`st` の値域）

### 2-8. Pages の公開方式
- `.github/workflows/pages.yml` は **`path: mock`** で `mock/` を**サイトのルート**として公開。URL に `/mock/` は**含まれない**（`https://shoulang0729.github.io/dify/`）
- `mock/.nojekyll` 必須
- 検出：`tools/verify.mjs`

### 2-9. 顧客版カタログへの差し替えは「データ層だけ」
- 顧客向けメニュー（分類・サービス）の差し替えは `CATS` / `SVCS` / `TAGS` の**データだけ**を変える。描画ロジックは触らない
- 変更前後の**件数と id 一覧を設計書に書く**（reviewer が `regress.mjs` の差分と照合）
- `SVCS[].id` は管理番号（§2-11、例 `KN-02`）として**顧客に見える**。差し替え時も **id を改名しない**（不要になったら欠番、新規は新 id）
- 検出：`tools/regress.mjs`

### 2-10. シークレットを置かない
- Dify のトークン／Cookie／API キーは**環境変数渡し**。コミット・チャット貼り付け禁止
- `.gitignore` で `.env*`・`*.key`・`*.pem`・`secrets/` を除外済み

### 2-11. 管理番号（サービスの呼び名）
- サービスは **`<分類コード>-<2桁通番>`** で呼ぶ：内部 id を大文字化し通番を 2 桁ゼロ埋め（`kn2` → `KN-02`、`pt8` → `PT-08`）。**変換のみ**で別データは持たない。台帳は `docs/handoff/service-index.md`
- 大分類は `KN` / 中分類は `KN/rule` / 台本ターンは `KN-02 ja#2` / 手順は `KN-02 step3` / 表示パターンは `P1`（nav）`P2`（dash）`P3`（feed）
- **通番は分類内の追加順、永久欠番**（削除しても再利用しない）。中分類を移しても番号は変えない。顧客実名版に差し替えても番号は不変（§2-9）
- なぜ：設計書・Issue・PR・チャットで「KN-05 の中国語台本 3 往復目」と言えば一意に決まる
- 検出：`tools/verify.mjs`（`SVCS[].id` が `/^[a-z]{2}\d+$/`・変換後の番号が重複しない）＋ `tools/regress.mjs` の id 一覧（欠番の台帳）

---

## §3 検証コマンド（implementer は PR 前、reviewer はレビュー時に必ず実行）

```bash
node tools/verify.mjs     # 構文 / i18n 一致 / 未定義・未使用キー / CSS トークン / データ整合 / 共通レイヤー / Pages 設定 / シナリオ整合
node tools/regress.mjs    # データ層スナップショット比較（件数・id）。FAIL = 意図しない増減
node tools/regress.mjs --update   # 設計書に書かれた意図的なデータ変更のときだけ基準を更新
```

**1つでも FAIL、または §2 の逸脱があればマージしない。**
`regress` を `--update` するときは、PR 本文に「設計書 §X のデータ変更に伴う基準更新」と書く。

---

## §4 エージェントの分業と禁止事項（要約。詳細は `.claude/agents/*.md`）

| | やる | やらない |
|---|---|---|
| **PM（ユーザー）** | レーン判定・プロダクト判断・モック承認・並列/直列の判断 | — |
| **architect** | 設計書（`docs/handoff/`）・Issue・S 判定 | アプリコードを書く／設計後に設計書を黙って変える／`.claude/` を触る |
| **implementer** | feature ブランチで設計通りに実装・verify/regress・PR | `docs/handoff/` を変える／設計判断／main 直 commit |
| **reviewer** | verify/regress・diff 監査・load-bearing 照合・squash マージ・Pages 確認 | 検証 FAIL のまま承認／PR の主張を信じて diff を見ない／自分で直す |

---

## §5 Git 運用

- `main` 直 commit 禁止。`feat/<issue>-<slug>` 等で作業 → PR → **squash マージ** → ブランチ削除
- コミットメッセージは意味のあるものに。PR 本文に設計書パス・変更要約・検証結果・触っていない範囲
- 並列は**ファイル集合が重ならないときだけ**。`mock/catalog.html` の同じ関数を触るお題は直列
- 設計書は機能ごとに `docs/handoff/YYYY-MM-DD-<slug>.md`

---

## §6 バックログ（v2 以降）

- **Dify Export / Import 自動化（git ⇄ Dify 同期）**：Cloud は Cloudflare／Cookie 認証で壊れやすい。本格運用はセルフホスト後（Issue #3）
- **モック ②ダッシュボード / ③業務フィード**：§2-3 の共通レイヤー上に実装。**直列**（`T` 末尾・`renderMain` ホーム分岐・`PATTERNS`・verify §10・`regress.baseline.json` が重なる）。設計書 `docs/handoff/2026-09-06-patterns-dash-feed.md`。② は実装済み（#42 PR-1）、③ は PR-2
- **顧客版カタログ（製造業・日中2拠点）**：シナリオ粒度で **7 分類 33 サービス**に再編し、A-1（#30）でデータ層を差し替え済み（§2-9）。残：A-2 パートナー連携 6 者の追加・B-1 デモ遷移テンプレート・B-2 台本投入。設計書は `docs/handoff/2026-09-06-*.md`、実現性は `docs/dify/`
- **`top.html` の扱い**：バンドル済みで手編集不可。②③ を `catalog.html` 側に実装したら削除候補
