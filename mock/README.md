# 🧪 AIエージェントカタログ ＜モック＞ ／ AI智能体服务目录（演示）

> ⚠️ **これは本番システムではありません。社内検討用のコンセプト確認モックです。**
> チャットの応答はダミー（モック応答）で、実際のLLM処理・データ連携は行っていません。

NTT DATA デザインシステム準拠の、社内向けAIエージェントサービスのカタログ画面モック。

- 左ナビ3案を画面上部のバーで切替（A アコーディオン / B カテゴリレール / C 全展開ツリー）
- 大分類6 × 中分類12 × 33サービス（日本語・中国語併記）
- 一覧 → サービス詳細 → チャット起動（モック）

純粋な静的HTML/CSS/JS（ビルド不要）。

## ディレクトリ構成（モック）

```
mock/
├── index.html              モック画面のエントリーポイント
├── .nojekyll               GitHub Pages の Jekyll 処理を無効化（静的配信）
├── README.md               このファイル
├── assets/
│   └── ntt-data-logo-blue.png
└── styles/tokens/          NTT DATA デザイントークン（モック用に同梱）
    ├── colors.css
    ├── typography.css
    ├── spacing.css
    └── base.css
```

## ローカルで確認

`index.html` をブラウザで直接開くだけで動作します（パスはすべて相対参照、サーバー不要）。

## GitHub Pages で公開（モックの共有用）

1. この `mock/` フォルダをリポジトリに配置
2. リポジトリ **Settings → Pages**
3. **Source: Deploy from a branch** → Branch `main` / フォルダ `/(root)` か `/docs`
4. 数分後、`https://<org>.github.io/<repo>/mock/` で公開

> Private リポジトリで Pages を公開するには GitHub Pro / Team / Enterprise が必要です。

## 位置づけ

| 項目 | 内容 |
|------|------|
| 種別 | コンセプト確認用モック（非本番） |
| 用途 | 社内レビュー・UI/UX方向性の検討 |
| データ | すべてダミー（サンプルの33ユースケース） |
| チャット | モック応答（LLM未接続） |
