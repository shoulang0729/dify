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

## 運用フロー（v1 = ソロ運用）

ひとり運用の間は「**いつでも元に戻せる履歴**」を最優先にします。
main へ直接コミットせず、すべて作業ブランチ → PR → **squash マージ** → ブランチ削除、
の流れに統一します。これを 1 コマンドで実行するスクリプトを用意しています。

```bash
# ブランチ作成→commit→push→PR作成→squashマージ→ブランチ削除→main最新化 を一括実行
scripts/ship.sh "feat: add customer-support app DSL"

# 直前の変更を打ち消して元に戻す（履歴は残す revert 方式）
scripts/rollback.sh
```

- 前提: `git` と GitHub CLI（`gh auth login` 済み）。
- 1 PR = 1 squash コミットなので、`rollback.sh` で 1 コミット戻すだけで復旧できます。
- 詳細・手動手順は [`CLAUDE.md`](./CLAUDE.md) の「Git 運用フロー」を参照。

> **v2（セルフホスト＋コラボ運用）になったらルールを変更します**
> （PR レビュー必須・直接 push 禁止・revert も PR 経由など）。それまでは本フローで運用します。

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
