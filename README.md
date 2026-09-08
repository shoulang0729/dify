# AIエージェント 画面案モック ／ AI智能体界面方案

> 📦 **このリポジトリ（A / `shoulang0729/dify`）はアーカイブです。デモと開発の正本は会社アカウントのリポジトリ B（[`toshioiinuma-ntt/ndit.dify`](https://github.com/toshioiinuma-ntt/ndit.dify)）へ移りました。**
> 公開 URL（`https://shoulang0729.github.io/dify/`）を開くと B の新 URL（`https://toshioiinuma-ntt.github.io/ndit.dify/`）へ自動で転送されます。手順は [`docs/handoff/2026-09-08-migrate-to-company-repo.md`](./docs/handoff/2026-09-08-migrate-to-company-repo.md)。

AIエージェント・ポータルの **UI/UX コンセプト確認用モック**（静的 HTML/CSS/JS、ビルド不要）。
GitHub Pages で公開しています（内容は上記のとおり B への転送のみ）。

🔗 **公開URL（A・転送のみ）: https://shoulang0729.github.io/dify/**
🔗 **公開URL（B・デモ本体）: https://toshioiinuma-ntt.github.io/ndit.dify/**

> ⚠️ これは本番システムではありません。チャット応答はダミー（LLM 未接続）です。

## このリポジトリの歩き方（4 区分）

| | 区分 | 置き場 | 入口 | 何が入っているか |
|---|---|---|---|---|
| ① | **デモ**（A はアーカイブ。正本は B） | [`mock/`](./mock/) | [`mock/index.html`](./mock/index.html) | A の `mock/` は B（`toshioiinuma-ntt/ndit.dify`）へのリダイレクトのみ。デモ本体（カタログ・詳細・チャット・デモ 5 テンプレート）は B にある |
| ② | **実装ソース** | [`dify/apps`](./dify/apps/) [`dify/env`](./dify/env/) [`scripts/dify`](./scripts/dify/) [`tools`](./tools/) | [`dify/README.md`](./dify/README.md) | Dify に入れるマスタ DSL、環境ごとの差分、投入・テスト・リリースのスクリプト、モックの検証ハーネス |
| ③ | **ユースケース・シナリオ** | [`docs/dify/usecases`](./docs/dify/usecases/) [`docs/handoff`](./docs/handoff/) [`mock/js/data/scenarios`](./mock/js/data/scenarios/) | [`docs/dify/usecases/README.md`](./docs/dify/usecases/README.md) | 43 サービスの詳細ユースケース、設計書、デモ台本（台本はコードなので `mock/` の下） |
| ④ | **ダミーデータ** | [`data/world`](./data/world/) [`dify/kb`](./dify/kb/) [`dify/tests`](./dify/tests/) | [`data/world/README.md`](./data/world/README.md) | 架空世界のマスタ（会社・人・品番・設備・KPI）、KB 用のダミー文書、テスト入力 |

**管理番号（`KN-02` など）から ①②③④ を横断する索引** → [`docs/service-map.md`](./docs/service-map.md)（生成物。`npm run index` で更新）
**マスタ → 社内・顧客環境へのリリース** → [`dify/env/README.md`](./dify/env/README.md) と [`dify/DEPLOY.md`](./dify/DEPLOY.md)

## 収録モック（アーカイブ後）

A の `mock/` には、B へのリダイレクトページ 3 枚だけが残っています。中身（データ層・CSS・JS）は削除済みで、B の git 履歴に引き継がれています。

| | ファイル | 公開URL（A） | 転送先（B） |
|---|---|---|---|
| デモガイド | `mock/index.html` | https://shoulang0729.github.io/dify/ | https://toshioiinuma-ntt.github.io/ndit.dify/ |
| モックA | `mock/catalog.html` | https://shoulang0729.github.io/dify/catalog.html | https://toshioiinuma-ntt.github.io/ndit.dify/catalog.html |
| 台本レビュー | `mock/scripts.html` | https://shoulang0729.github.io/dify/scripts.html | https://toshioiinuma-ntt.github.io/ndit.dify/scripts.html |

> `mock/` フォルダがサイトのルートとして公開されるため、URL に `/mock/` は含まれません（この構成は A・B とも同じ）。

詳細は [`mock/README.md`](./mock/README.md) を参照してください。

## 公開の仕組み

`.github/workflows/pages.yml` が `mock/` フォルダを GitHub Pages へデプロイします
（`main` への push で自動更新）。アーカイブ後もこのワークフローは**変更していません**（`path: mock` のまま）。リダイレクトページを配信し続けるために必要です。

## ローカルで確認

`mock/index.html`（または各 HTML）をブラウザで直接開くだけで動作します。サーバー不要（外部リソースを読み込まない単一ファイルです）。

## 関連プロジェクト

Dify アプリの DSL 版管理・SwingAnalist の設計は、別リポジトリ
**`shoulang0729/Dify.SwingTrainer`（Private）** に分離しました。

## 開発の始め方

Node.js（`.nvmrc` 記載のバージョン、`nvm use` 推奨）が必要です。依存パッケージはありません。

```bash
npm test   # tools/verify.mjs と tools/regress.mjs をまとめて実行
```

作業ブランチの切り方・PR の出し方・検証コマンドの詳細は [`CLAUDE.md`](./CLAUDE.md) を参照してください。
