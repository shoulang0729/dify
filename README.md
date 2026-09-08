# AIエージェント 画面案モック ／ AI智能体界面方案

AIエージェント・ポータルの **UI/UX コンセプト確認用モック**（静的 HTML/CSS/JS、ビルド不要）。
GitHub Pages で公開しています。

🔗 **公開URL: https://shoulang0729.github.io/dify/**

> ⚠️ これは本番システムではありません。チャット応答はダミー（LLM 未接続）です。

## このリポジトリの歩き方（4 区分）

| | 区分 | 置き場 | 入口 | 何が入っているか |
|---|---|---|---|---|
| ① | **デモ** | [`mock/`](./mock/) | [`mock/index.html`](./mock/index.html) | 顧客に見せる UI モック（GitHub Pages で公開）。カタログ・詳細・チャット・デモ 5 テンプレート |
| ② | **実装ソース** | [`dify/apps`](./dify/apps/) [`dify/env`](./dify/env/) [`scripts/dify`](./scripts/dify/) [`tools`](./tools/) | [`dify/README.md`](./dify/README.md) | Dify に入れるマスタ DSL、環境ごとの差分、投入・テスト・リリースのスクリプト、モックの検証ハーネス |
| ③ | **ユースケース・シナリオ** | [`docs/dify/usecases`](./docs/dify/usecases/) [`docs/handoff`](./docs/handoff/) [`mock/js/data/scenarios`](./mock/js/data/scenarios/) | [`docs/dify/usecases/README.md`](./docs/dify/usecases/README.md) | 67 サービスの詳細ユースケース、設計書、デモ台本（台本はコードなので `mock/` の下） |
| ④ | **ダミーデータ** | [`data/world`](./data/world/) [`dify/kb`](./dify/kb/) [`dify/tests`](./dify/tests/) | [`data/world/README.md`](./data/world/README.md) | 架空世界のマスタ（会社・人・品番・設備・KPI）、KB 用のダミー文書、テスト入力 |

**管理番号（`KN-02` など）から ①②③④ を横断する索引** → [`docs/service-map.md`](./docs/service-map.md)（生成物。`npm run index` で更新）
**マスタ → 社内・顧客環境へのリリース** → [`dify/env/README.md`](./dify/env/README.md) と [`dify/DEPLOY.md`](./dify/DEPLOY.md)

## 収録モック

| | ファイル | 公開URL | 内容 |
|---|---|---|---|
| デモガイド | `mock/index.html` | https://shoulang0729.github.io/dify/ | `catalog.html` の見方を説明するガイドページ |
| モックA | `mock/catalog.html` | https://shoulang0729.github.io/dify/catalog.html | AIエージェントカタログ（左ナビ3案・一覧→詳細→チャット起動） |

> `mock/` フォルダがサイトのルートとして公開されるため、URL に `/mock/` は含まれません。

詳細は [`mock/README.md`](./mock/README.md) を参照してください。

## 公開の仕組み

`.github/workflows/pages.yml` が `mock/` フォルダを GitHub Pages へデプロイします
（`main` への push で自動更新）。

## ローカルで確認

`mock/index.html`（または各 HTML）をブラウザで直接開くだけで動作します。サーバー不要。

## 関連プロジェクト

Dify アプリの DSL 版管理・SwingAnalist の設計は、別リポジトリ
**`shoulang0729/Dify.SwingTrainer`（Private）** に分離しました。

## 開発の始め方

Node.js（`.nvmrc` 記載のバージョン、`nvm use` 推奨）が必要です。依存パッケージはありません。

```bash
npm test   # tools/verify.mjs と tools/regress.mjs をまとめて実行
```

作業ブランチの切り方・PR の出し方・検証コマンドの詳細は [`CLAUDE.md`](./CLAUDE.md) を参照してください。
