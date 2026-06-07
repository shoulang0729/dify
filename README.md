# Dify アプリ設定リポジトリ

Dify アプリの設定を **DSL(YAML)** としてバージョン管理するためのリポジトリです。

- 現在は **Dify Cloud** で運用しています。
- 将来は **香港のセルフホスト環境** へ、この DSL ごと移行する想定です。
- Dify は DSL を **ファイル** または **raw GitHub の URL** からインポートできます。

## ディレクトリ構成

```
.
├── apps/        # Dify アプリの DSL(*.yml) を置く
├── knowledge/   # ナレッジ元文書（空なら .gitkeep を置く）
├── README.md
├── CLAUDE.md    # このリポジトリでの作業ルール
└── .gitignore
```

## 基本フロー

1. **作る** … Dify 上でアプリを作成・編集する。
2. **Export DSL** … Dify のアプリ画面から「Export DSL」で `*.yml` を書き出し、`apps/` に置く。
3. **Import** … 別環境（セルフホスト等）で、ファイル or raw GitHub URL から DSL をインポートする。

```
作る  →  Export DSL  →  Import
(Dify)    (apps/*.yml)    (別環境 / セルフホスト)
```

### raw GitHub URL からインポートする例

`apps/example-chat-assistant.yml` を例にすると、raw URL は以下の形式になります。

```
https://raw.githubusercontent.com/<owner>/<repo>/<branch>/apps/example-chat-assistant.yml
```

この URL を Dify の「Import from URL」に貼り付けます。

## DSL に API キーは含まれません

エクスポートした DSL には **モデルプロバイダーの API キーは含まれません**。
そのため、**インポートした後** に各環境で改めて以下を設定し直してください。

- 使用するモデル（プロバイダー・モデル名）の選択
- そのプロバイダーの API キーの登録

## GitHub への push / clone コマンド例

### clone する

```bash
git clone https://github.com/<owner>/<repo>.git
cd <repo>
```

### 変更を push する

```bash
git add apps/<app-name>.yml
git commit -m "feat: add <app-name> app DSL"
git push -u origin <branch-name>
```
