# AIエージェント 画面案モック ／ AI智能体界面方案

AIエージェント・ポータルの **UI/UX コンセプト確認用モック**（静的 HTML/CSS/JS、ビルド不要）。
GitHub Pages で公開しています。

🔗 **公開URL: https://shoulang0729.github.io/dify/**

> ⚠️ これは本番システムではありません。チャット応答はダミー（LLM 未接続）です。

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
