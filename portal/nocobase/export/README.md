# portal/nocobase/export/ — 定義エクスポート（画面・コレクション・ロール・ワークフロー）

**NocoBase 固有の層。NocoBase をやめたら捨てる**（`portal/schema/` との違いは設計書
`docs/handoff/2026-09-11-repo-layout-v3.md` §2-2）。

NocoBase Community には Migration Manager が無いため、定義の移送はここへエクスポートした JSON を
git に置く以外に手段が無い（`docs/handoff/2026-09-10-portal-nocobase.md` §2-4・§10-1 N-a）。

**現時点は空。** 実機（docker で起動した NocoBase）から画面・コレクション・ロール・ワークフローの定義を
エクスポートするのは PR-N2 の範囲外（この PR は「定義とファイルだけ」。docker を実際に動かすのは
`run:mac` の別 Issue）。`.gitkeep` はディレクトリを空のままコミットするためのプレースホルダで、実機の
エクスポートが入ったら削除する。
