# 🧪 AIエージェント 画面案モック ／ AI智能体界面方案（演示）

> 📦 **アーカイブ済み。デモ本体の正本は会社アカウントのリポジトリ B（[`toshioiinuma-ntt/ndit.dify`](https://github.com/toshioiinuma-ntt/ndit.dify)）に移りました。** このフォルダに残る `index.html`・`catalog.html`・`scripts.html` は B の対応ページへの**リダイレクトのみ**（`css/**`・`js/**` は削除済み）。手順は [`docs/handoff/2026-09-08-migrate-to-company-repo.md`](../docs/handoff/2026-09-08-migrate-to-company-repo.md)。

> ⚠️ **これは本番システムではありません。社内検討用のコンセプト確認モックです。**
> チャットの応答はダミー（モック応答）で、実際のLLM処理・データ連携は行っていません（※記述はアーカイブ前のデモの説明。実物は B を参照）。

アーカイブ前は AIエージェントカタログの画面案（モック）一式でした。`index.html` はデモガイド（日／中切替）で、`catalog.html` の見方を説明した上でカタログへ移動できました。現在はいずれも B へのリダイレクトです。

> このフォルダは **①デモ**（GitHub Pages 公開物）の置き場という位置づけです。4 区分の全体像はトップ [`README.md`](../README.md)、管理番号から①〜④を横断する索引は [`docs/service-map.md`](../docs/service-map.md)、デモに使う架空世界の正本は [`data/world/`](../data/world/) を参照。

## 収録モック（アーカイブ前・参考）

| | 画面 | 内容 |
|---|------|------|
| **A** | `catalog.html` — AIエージェントカタログ | 表示パターン3案（① 階層ナビ／② ダッシュボード／③ 業務フィード。3案とも実装済み）を切替。同じカタログ・同じ詳細/デモ画面に、3通りの入口から入れる。一覧 → 詳細（担当者ペルソナ・利用シナリオ）→ **業務デモ**（QA／アップロード→結果／フォーム→ドラフト／差分比較／照会の5テンプレート。日本語・中国語どちらで入力しても入力言語で応答）。 |

上記の実物・最新版は B（[`toshioiinuma-ntt/ndit.dify`](https://github.com/toshioiinuma-ntt/ndit.dify)）で公開されています。以下のディレクトリ構成・公開設定の説明もアーカイブ前（B へ移す前）の構成の記録です。

## ディレクトリ構成（アーカイブ前・参考。現在は 3 ファイルのみ）

`catalog.html` は層ごとにファイル分割されていました（Issue #77。ビルド不要・静的な `<link>`/`<script src>` のみ）。

```
mock/（アーカイブ前）
├── index.html            デモガイド（catalog.html への導線、日／中切替。css/tokens.css を <link> で共有）
├── catalog.html          モックA：AIエージェントカタログ（殻。<link> 2 本と <script src> 本のみ）
├── css/
│   ├── tokens.css        デザイントークン層（ブランドパレット・セマンティックトークン・light/dark）
│   └── components.css    コンポーネント CSS
├── js/
│   ├── data/
│   │   ├── ui.js         T / PATTERNS / TAGS / TEMPLATES（UI 文言・パターン定義・タグ・デモテンプレート辞書）
│   │   ├── catalog.js    CATS / SVCS（分類・サービス台帳）
│   │   ├── home.js       HOME / FEED（② ダッシュボード・③ 業務フィードの疑似データ）
│   │   ├── style.js      CAT_STYLE（分類アイコンの SVG path）
│   │   └── scenarios/    SCENARIOS（デモ台本）
│   ├── app.js            state / 定数ヘルパー / detectLang / デモ制御 / 設定の永続化（起動時 assert を含む）
│   ├── render.js         renderChrome 〜 renderMain / *HTML / renderAll（描画）
│   └── events.js         click ハンドラ / 言語・テーマの listener / 起動
├── .nojekyll             GitHub Pages の Jekyll 処理を無効化
└── README.md             このファイル
```

アーカイブ後の `mock/`（現在）：

```
mock/（アーカイブ後・A の現状）
├── index.html            B（デモガイド）へのリダイレクト（単一ファイル・外部リソースなし）
├── catalog.html          B（AIエージェントカタログ）へのリダイレクト（単一ファイル・外部リソースなし）
├── scripts.html          B（台本レビュー）へのリダイレクト（単一ファイル・外部リソースなし）
├── .archived             アーカイブモードのマーカー（tools/verify.mjs・tools/regress.mjs が検出）。
│                         中身は移行先ベース URL（各リダイレクトページの <meta refresh> と一致させる）
├── .nojekyll             GitHub Pages の Jekyll 処理を無効化（引き続き必須）
└── README.md             このファイル
```

> データ層・アプリ層の分割方針（アーカイブ前）は `docs/handoff/2026-09-07-split-catalog.md` を参照。
> 移行手順は `docs/handoff/2026-09-08-migrate-to-company-repo.md` を参照。

## ローカルで確認

`index.html`（または各 HTML）をブラウザで直接開くだけで動作します。サーバー不要（外部リソースを読み込まない単一ファイルです）。B への転送はネットワーク接続が必要です。

## GitHub Pages で公開（共有用）

このリポジトリでは **GitHub Actions によるデプロイ**を採用しています
（`.github/workflows/pages.yml`）。`main` への push で自動更新されます。**アーカイブ後もこのワークフローは変更していません**（`path: mock` のまま。リダイレクトページを配信し続けるために必要）。

- ワークフローが `mock/` フォルダを**サイトのルートとして**公開するため、
  URL に `/mock/` は**含まれません**。
- 公開URL（A・転送のみ）: **https://shoulang0729.github.io/dify/**
- 公開URL（B・デモ本体）: **https://toshioiinuma-ntt.github.io/ndit.dify/**

| 画面 | URL（A・転送のみ） | 転送先（B） |
|------|-----|-----|
| デモガイド（`index.html`） | https://shoulang0729.github.io/dify/ | https://toshioiinuma-ntt.github.io/ndit.dify/ |
| モックA カタログ（`catalog.html`） | https://shoulang0729.github.io/dify/catalog.html | https://toshioiinuma-ntt.github.io/ndit.dify/catalog.html |
| 台本レビュー（`scripts.html`） | https://shoulang0729.github.io/dify/scripts.html | https://toshioiinuma-ntt.github.io/ndit.dify/scripts.html |

> 別リポジトリで同じ構成を使う場合は、`Settings → Pages` の Source を
> **GitHub Actions** にしてください（"Deploy from a branch" ではありません）。
> Private リポジトリで Pages を公開するには GitHub Pro / Team / Enterprise が必要です（B はこの構成。`docs/handoff/2026-09-08-migrate-to-company-repo.md` 参照）。

## 位置づけ

| 項目 | 内容 |
|------|------|
| 種別 | コンセプト確認用モック（非本番）。**A はアーカイブ、B が正本** |
| 用途 | 社内レビュー・UI/UX方向性の検討 |
| データ | すべてダミー（サンプルのユースケース） |
| チャット | モック応答（LLM未接続） |
