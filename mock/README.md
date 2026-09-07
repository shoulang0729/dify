# 🧪 AIエージェント 画面案モック ／ AI智能体界面方案（演示）

> ⚠️ **これは本番システムではありません。社内検討用のコンセプト確認モックです。**
> チャットの応答はダミー（モック応答）で、実際のLLM処理・データ連携は行っていません。

AIエージェントカタログの画面案（モック）一式です。`index.html` はデモガイド（日／中切替）で、`catalog.html` の見方を説明した上でカタログへ移動できます。

> このフォルダは **①デモ**（GitHub Pages 公開物）です。4 区分の全体像はトップ [`README.md`](../README.md)、管理番号から①〜④を横断する索引は [`docs/service-map.md`](../docs/service-map.md)、デモに使う架空世界の正本は [`data/world/`](../data/world/) を参照。

## 収録モック

| | 画面 | 内容 |
|---|------|------|
| **A** | `catalog.html` — AIエージェントカタログ | 表示パターン3案（① 階層ナビ／② ダッシュボード／③ 業務フィード。3案とも実装済み）を切替。同じカタログ・同じ詳細/デモ画面に、3通りの入口から入れる。大分類8×中分類17×41サービス（在中日系製造業向け、パートナー連携8件を含む）。一覧 → 詳細（担当者ペルソナ・利用シナリオ）→ **業務デモ**（QA／アップロード→結果／フォーム→ドラフト／差分比較／照会の5テンプレート。日本語・中国語どちらで入力しても入力言語で応答）。 |

`catalog.html` はメニュー表示を日本語／中文／English で切替でき、ライト／ダークテーマに対応（エージェント本体の入出力は日中）。純粋な静的 HTML/CSS/JS（ビルド不要）。

## ディレクトリ構成

`catalog.html` は層ごとにファイル分割されています（Issue #77。ビルド不要・静的な `<link>`/`<script src>` のみ）。

```
mock/
├── index.html            デモガイド（catalog.html への導線、日／中切替。css/tokens.css を <link> で共有）
├── catalog.html          モックA：AIエージェントカタログ（殻。<link> 2 本と <script src> 15 本のみ）
├── css/
│   ├── tokens.css        デザイントークン層（ブランドパレット・セマンティックトークン・light/dark）
│   └── components.css    コンポーネント CSS
├── js/
│   ├── data/
│   │   ├── ui.js         T / PATTERNS / TAGS / TEMPLATES（UI 文言・パターン定義・タグ・デモテンプレート辞書）
│   │   ├── catalog.js    CATS / SVCS（分類・サービス台帳）
│   │   ├── home.js       HOME / FEED（② ダッシュボード・③ 業務フィードの疑似データ）
│   │   ├── style.js      CAT_STYLE（分類アイコンの SVG path）
│   │   └── scenarios/    SCENARIOS（デモ台本。大分類 8 ファイル: kn/qa/dc/lg/nm/en/gn/pt）
│   ├── app.js            state / 定数ヘルパー / detectLang / デモ制御 / 設定の永続化（起動時 assert を含む）
│   ├── render.js         renderChrome 〜 renderMain / *HTML / renderAll（描画）
│   └── events.js         click ハンドラ / 言語・テーマの listener / 起動
├── .nojekyll             GitHub Pages の Jekyll 処理を無効化
└── README.md             このファイル
```

> データ層・アプリ層の分割方針は `docs/handoff/2026-09-07-split-catalog.md` を参照。
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
