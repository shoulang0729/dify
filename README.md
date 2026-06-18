# AIエージェント 画面案モック ／ AI智能体界面方案

AIエージェント・ポータルの **UI/UX コンセプト確認用モック**（静的 HTML/CSS/JS、ビルド不要）。
GitHub Pages で公開しています。

🔗 **公開URL: https://shoulang0729.github.io/Dify/**

> ⚠️ これは本番システムではありません。チャット応答はダミー（LLM 未接続）です。

## 収録モック

| | ファイル | 内容 |
|---|---|---|
| ランディング | `mock/index.html` | 2つのモックを見比べる比較ページ |
| モックA | `mock/catalog.html` | AIエージェントカタログ（左ナビ3案・一覧→詳細→チャット起動） |
| モックB | `mock/top.html` | トップページ（レイアウト3案・カテゴリ→業務画面） |

詳細は [`mock/README.md`](./mock/README.md) を参照してください。

## 公開の仕組み

`.github/workflows/pages.yml` が `mock/` フォルダを GitHub Pages へデプロイします
（`main` への push で自動更新）。

## ローカルで確認

`mock/index.html`（または各 HTML）をブラウザで直接開くだけで動作します。サーバー不要。

## 関連プロジェクト

Dify アプリの DSL 版管理・SwingAnalist の設計は、別リポジトリ
**`shoulang0729/Dify.SwingTrainer`（Private）** に分離しました。
