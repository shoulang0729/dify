# CLAUDE.md — このリポジトリでの作業ルール

このリポジトリは Dify アプリの設定を DSL(YAML) で版管理するためのものです。
今後のセッションでは、必ず以下のルールに従って作業してください。

## 1. 新規 DSL を作るときは既存の Export 済み DSL を雛形にする

新しい Dify アプリの DSL を作るときは、**まず `apps/` にある「Dify から
エクスポート済みの既存 DSL」を雛形** にして、スキーマ（`version` フィールドを
含む）を合わせること。

- **雛形が無い場合は、勝手に DSL を作らないこと。**
  ユーザーに「**Dify から Export DSL したファイルを1枚貼ってください**」と
  依頼してから作成する。
- 理由: DSL のスキーマは Dify のバージョンに紐づいており、古いバージョンの
  スキーマで作るとインポート時に警告が出るため。

## 2. シークレットは絶対にコミットしない

- API キー・トークン・シークレットの類いは **絶対にコミットしない**。
- `.env` 系、`*.key`、`*.pem`、`secrets/` などは `.gitignore` で除外済み。
- DSL 内にもキーを直接書かない（Dify の DSL にキーは含まれない前提）。

## 3. アプリ DSL の命名規則

- アプリ DSL のファイル名は **`apps/<app-name>.yml`** とする。

## 4. コミット

- 変更後は、**意味のあるメッセージで `git commit`** すること。
  （例: `feat: add customer-support chat assistant DSL`）

## 5. Git 運用フロー（v1 = ソロ運用）

> v1 はひとり運用が前提。レビュー目的ではなく、**変更を 1 PR=1 コミットに揃え、
> いつでも元に戻せる履歴** を作ることが目的。**v2（セルフホスト＋コラボ）になったら
> このルールは変更する**（PR レビュー必須・直接 push 禁止など）。

- **main へ直接 commit しない。** 作業ブランチを切り、PR 経由で main に入れる。
- **マージは squash** に統一する（1 PR = 1 コミット → revert も 1 コミットで済む）。
- **マージ後は作業ブランチを削除** する（リモート・ローカルとも）。
- 上記の「ブランチ作成 → commit → push → PR → squash マージ → ブランチ削除 →
  main 最新化」は **`scripts/ship.sh "<message>" [branch]`** で一括実行できる。
- **ロールバック** は履歴を消さない `revert` で行う。`scripts/rollback.sh [commit]`
  で直前（または指定）コミットを打ち消せる。
- どうしても特定時点へ戻したいときは、過去コミットに **タグ**（例: `v2026-06-07`）を
  打っておくと参照しやすい。

### 手動でやる場合（スクリプトを使わないとき）

```bash
git switch -c work/<topic>          # 作業ブランチ
git add -A && git commit -m "feat: ..."
git push -u origin work/<topic>
gh pr create --base main --fill     # PR 作成
gh pr merge work/<topic> --squash --delete-branch
git switch main && git pull origin main
```
