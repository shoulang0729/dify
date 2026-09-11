# 🧪 AIエージェント 画面案モック ／ AI智能体界面方案（演示）

> ⚠️ **これは本番システムではありません。社内検討用のコンセプト確認モックです。**
> チャットの応答はダミー（モック応答）で、実際のLLM処理・データ連携は行っていません。

AIエージェントカタログの画面案（モック）一式です。`index.html` はデモガイド（日／中切替）で、`catalog.html` の見方を説明した上でカタログへ移動できます。`portal.html`（部門ポータル）は、同じカタログのデータ層（`CATS`/`SVCS`）を業務の画面から呼び出す側のモックです。

> このフォルダは **①デモ**（GitHub Pages 公開物）です。4 区分の全体像はトップ [`README.md`](../README.md)、管理番号から①〜④を横断する索引は [`docs/service-map.md`](../docs/service-map.md)、デモに使う架空世界の正本は [`data/world/`](../data/world/) を参照。

## 収録モック

| | 画面 | 内容 |
|---|------|------|
| **A** | `catalog.html` — AIエージェントカタログ | 表示パターン3案（① 階層ナビ／② ダッシュボード／③ 業務フィード。3案とも実装済み）を切替。同じカタログ・同じ詳細/デモ画面に、3通りの入口から入れる。業種3（製造・金融・IT）×大分類14×中分類33×77サービス（在中日系製造業 49 件／在中日系銀行 29 件／日系 SIer 21 件。うち 11 件は業種横断。パートナー連携8件を含む）。業種の切替は上部グレー帯（`.mockbar`）。一覧 → 詳細（担当者ペルソナ・利用シナリオ）→ **業務デモ**（QA／アップロード→結果／フォーム→ドラフト／差分比較／照会の5テンプレート。日本語・中国語どちらで入力しても入力言語で応答）。 |
| **B** | `portal.html` — 部門ポータル | 自部門（翠雲システムズ）の社内ポータルの概念モック（15 画面）。`catalog.html` と同じ `CATS`/`SVCS`（`mock/js/data/catalog.js`）・`SCENARIOS`/`TEMPLATES` を読み、業務の画面（案件・顧客・To Do・会議・ナレッジ・KPI・目標・経費・申請・研修・ニュース・仕入先ほか）からサービスを呼ぶ側の見せ方を確認する。カタログ 77 件のうちポータルに置くのは 49 件（`mock/js/data/catalog.js` の `SVCS[].place`）。台本の再生（右ドロワー）・行への戻りは後続 PR（詳細は設計書 `docs/handoff/2026-09-11-portal-mock-pages.md`）。 |

`catalog.html` / `portal.html` はいずれもメニュー表示を日本語／中文／English で切替でき、ライト／ダークテーマに対応（エージェント本体の入出力は日中）。`mock.lang` / `mock.theme` は両ページで共有される。純粋な静的 HTML/CSS/JS（ビルド不要）。

## ディレクトリ構成

`catalog.html` は層ごとにファイル分割されています（Issue #77。ビルド不要・静的な `<link>`/`<script src>` のみ）。

```
mock/
├── index.html            デモガイド（catalog.html / portal.html への導線、日／中切替。css/tokens.css を <link> で共有）
├── catalog.html          モックA：AIエージェントカタログ（殻。<link> 2 本と <script src> 31 本のみ）
├── portal.html           モックB：部門ポータル（殻。<link> 2 本と <script src> 36 本のみ）
├── css/
│   ├── tokens.css        デザイントークン層（ブランドパレット・セマンティックトークン・light/dark。両ページが共有）
│   ├── components.css    カタログ用コンポーネント CSS
│   └── portal.css        ポータル用コンポーネント CSS（components.css とは名前空間を分ける）
├── js/
│   ├── data/                          ← 両ページが共有するデータ層（純粋なリテラル宣言のみ）
│   │   ├── ui.js         T / PATTERNS / TAGS / TEMPLATES / INDUSTRIES（UI 文言・パターン定義・タグ・デモテンプレート辞書・業種定義）
│   │   ├── catalog.js    CATS / SVCS（分類・サービス台帳）
│   │   ├── home.js       HOME / FEED（② ダッシュボード・③ 業務フィードの疑似データ。カタログのみ）
│   │   ├── style.js      CAT_STYLE（分類アイコンの SVG path）
│   │   ├── live.js       LIVE（本番リンク。カタログのみ）
│   │   ├── scenarios/    SCENARIOS（デモ台本。業種ごとに大分類 1 ファイル。両ページが読む）
│   │   │   ├── mfg/       製造 10 ファイル: kn/qa/dc/lg/nm/en/gn/pt/po/eg
│   │   │   ├── fin/       金融 8 ファイル: kn/rs/cv/fa/dc/gn/po/eg
│   │   │   └── it/        IT 5 ファイル: kn/dc/gn/po/sl
│   │   └── portal/       ポータル固有データ（7 ファイル。純粋なリテラル宣言のみ）
│   │       ├── ui.js      PT / PGRP / PSCREENS / PHOW / PHOWLONG / PST（ラベル辞書・画面台帳）
│   │       ├── svc.js     PSVC / PLACE / PNEW / PSTAGE_AI（サービス別の説明・配置・ステージ別 AI）
│   │       ├── org.js     PORG（チーム所属・ログイン中の利用者）
│   │       ├── front.js   PSTAGE / PDEALS / PCUST / PCONTACT / PHIST / PNEWS / PVENDOR（フロント業務）
│   │       ├── common.js  PACT / PCAND / PMEET / PKNOW / PKNOWACT（共通業務）
│   │       ├── mgmt.js    PPEOPLE / PATT / PKPI / PKPITOPIC / PSRC / PGOAL / PQTR / PCUR_Q（マネジメント）
│   │       └── back.js    PEXP / PREQ / PTRAIN / PMYTRAIN / PMYITEM / PTODO_STATE / PSURVEY / PMYSURVEY（バック業務）
│   ├── app.js            カタログ：state / 定数ヘルパー / detectLang / デモ制御 / 設定の永続化（起動時 assert を含む）
│   ├── render.js         カタログ：renderChrome 〜 renderMain / *HTML / renderAll（描画）
│   ├── events.js         カタログ：click ハンドラ / 言語・テーマの listener / 起動
│   └── portal/           ポータルのアプリ層（3 ファイル。§2-3 の「読み込み順はその HTML の <script src> の並びが唯一の正」はここにも効く）
│       ├── app.js         pstate / ヘルパー（PL/pt/psvcOf など）/ 設定の永続化
│       ├── render.js      renderRail / renderScreen / V.*（15 画面）/ drawer / フィルタ
│       └── events.js      click ハンドラ / 言語・テーマの listener / 起動
├── .nojekyll             GitHub Pages の Jekyll 処理を無効化
└── README.md             このファイル
```

> データ層・アプリ層の分割方針は `docs/handoff/2026-09-07-split-catalog.md`（catalog.html）・
> `docs/handoff/2026-09-11-portal-mock-pages.md`（portal.html）を参照。
> 外部の画像ファイルへの依存はありません（アイコンはインライン SVG）。

## ローカルで確認

`index.html`（または各 HTML）をブラウザで直接開くだけで動作します。サーバー不要。

## GitHub Pages で公開（共有用）

このリポジトリでは **GitHub Actions によるデプロイ**を採用しています
（`.github/workflows/pages.yml`）。`main` への push で自動更新されます。

- ワークフローが `mock/` フォルダを**サイトのルートとして**公開するため、
  URL に `/mock/` は**含まれません**。
- 公開URL: **https://shoulang0729.github.io/dify/**

| 画面 | URL |
|------|-----|
| デモガイド（`index.html`） | https://shoulang0729.github.io/dify/ |
| モックA カタログ（`catalog.html`） | https://shoulang0729.github.io/dify/catalog.html |
| モックB 部門ポータル（`portal.html`） | https://shoulang0729.github.io/dify/portal.html |

> 別リポジトリで同じ構成を使う場合は、`Settings → Pages` の Source を
> **GitHub Actions** にしてください（"Deploy from a branch" ではありません）。
> Private リポジトリで Pages を公開するには GitHub Pro / Team / Enterprise が必要です。

## 位置づけ

| 項目 | 内容 |
|------|------|
| 種別 | コンセプト確認用モック（非本番） |
| 用途 | 社内レビュー・UI/UX方向性の検討 |
| データ | すべてダミー（サンプルのユースケース） |
| チャット | モック応答（LLM未接続） |
