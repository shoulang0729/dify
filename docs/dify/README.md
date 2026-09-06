# docs/dify — Dify 実装可能性の突合と参照資料

顧客版カタログ（7 分類・33 サービス、`docs/handoff/2026-09-06-customer-catalog-data.md`）と
担当者デモ台本（`docs/handoff/2026-09-06-demo-scenarios.md`）について、
**「その業務シナリオは Dify で実際に作れるか」** を Dify の公式機能・公式プラグイン・コミュニティ資産と突合した結果と、
以後の実装フェーズで**積極的に使う**プラグイン・事例・参照 DSL を置く場所。

architect（設計）成果物。**アプリコード（`mock/**` `tools/**`）には触れていない。承認済み設計書も書き換えていない。**
設計変更が必要と判断した点は `feasibility-33-services.md` §0 に「PM 判断待ち」として列挙してある。

## ファイル

| ファイル | 内容 | まず読む人 |
|---|---|---|
| [`feasibility-33-services.md`](./feasibility-33-services.md) | 33 サービスの実現性突合表（◎○△×）・台本との整合・成熟度の妥当性・**PM 判断待ち** | PM・architect |
| [`plugins-and-references.md`](./plugins-and-references.md) | 目的別の公式プラグイン／データソース／モデル／観測／DSL 生成支援／事例のカタログ（どのサービス id で使うか付き） | implementer |
| [`templates/README.md`](./templates/README.md) | 保存した参照 DSL 8 本の一覧（出典・ライセンス・`version`・雛形候補サービス）と、URL のみ記録したもの | implementer |
| `templates/*.yml` | 参照 DSL 本体（外部出典・無改変。冒頭にコメントで出典・ライセンス・雛形候補を追記） | implementer |

## 読み方

1. **PM**：`feasibility-33-services.md` の §0（集計と PM 判断待ち）だけ読めば「実装に進めるか」を判断できる。個別サービスの根拠は §3 の折りたたみ。
2. **implementer**：実装対象サービスの行（§3）→ 使うプラグイン（`plugins-and-references.md`）→ 近い参照 DSL（`templates/`）の順。DSL を新規に書くときは `plugins-and-references.md` §8 の dsl-skill を標準手段にする。
3. **reviewer**：本ディレクトリは `tools/verify.mjs` / `tools/regress.mjs` の検証対象外（ドキュメントのみ）。diff 監査では「`docs/handoff/` が変わっていないこと」「`templates/*.yml` が出典と同一（冒頭コメント以外）であること」を見る。

## 前提（PM 提示。再調査していないが URL は実在確認済み）

- 顧客環境の DSL は `version: 0.6.0` ≒ **Dify 1.15.x**（対応表は [yzmw123/dify-workflow-dsl-skill](https://github.com/yzmw123/dify-workflow-dsl-skill) README。Dify 1.16.x → 0.7.0）
- Trigger（Schedule / Webhook / SaaS イベント）は [v1.10.0](https://github.com/langgenius/dify/releases/tag/1.10.0)〜、Knowledge Pipeline（Data Source プラグイン）は [v1.9.0](https://github.com/langgenius/dify/releases/tag/1.9.0)〜、ナレッジのメタデータフィルタは [v1.1.0](https://github.com/langgenius/dify/releases/tag/1.1.0)〜、マルチモーダル検索（画像⇄テキスト）は [v1.11.0](https://github.com/langgenius/dify/releases/tag/1.11.0)〜 → いずれも 1.15.x で利用可
- 公式プラグインの実在確認は [langgenius/dify-official-plugins](https://github.com/langgenius/dify-official-plugins) のディレクトリと `manifest.yaml`（2026-09-06 時点の `main`）で行った。`marketplace.dify.ai` と `docs.dify.ai` は本環境からプロキシで到達不可のため、**ドキュメント URL は検索結果で実在を確認したものだけ**を載せ、本文未取得のものはその旨を注記した

## 更新ルール

- **実在しないプラグイン・URL・事例を書かない。** 確認できないものは「未確認」と明記する。マーケットプレイスの表示名ではなく GitHub のディレクトリ名（`tools/paddleocr` 等）で書く
- 参照 DSL（`templates/*.yml`）は**無改変**で置く。追記は冒頭コメントのみ。改変して使うときは別ディレクトリ（実装リポ側）へコピーしてから
- ライセンスが明記されていない出典（例：dsl-skill の examples、dify-for-dsl）は **URL のみ記録**し、ファイルは取り込まない
- `version` フィールドの値は必ず記録する（0.6.0 との差 = import 時の警告／確認の有無）
- 設計書（`docs/handoff/`）の結論を変える必要が出たら、本ディレクトリに書くのではなく **PM 判断待ちとして列挙**する（architect は承認済み設計書を黙って変えない）
- 秘密情報（API キー・Cookie・顧客データ）は置かない（`CLAUDE.md` §2-10）
