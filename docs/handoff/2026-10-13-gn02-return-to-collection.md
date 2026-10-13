# GN-02を集金予定表デモへ戻す

2026-10-13／M/L／ロールバック設計・実装・独立レビュー済み。Issueは未投稿。PR反映前の検証記録。

## 目的

GN-02を直前の集金予定表デモへ戻す。ローカル起動後の入口は `http://127.0.0.1:4173/gn2-collection-slide.html`。今回外すのは、後から加わった発票PDF・発注Excel・入庫Excelの添付サンプルとその表示処理だけ。先行して追加された集金予定表、既存APの40枚台本、QA/NM、ステータス、お気に入り、共通添付処理は残す。これ以降の追加分は対象が特定されていないため、この変更には含めない。

## 根拠と復元方法

`origin/main` は `956a8ef9692dc4d115ef51bddb4a11aaf0c85d6e`（PR #358 の squash merge）。チェックアウト中のfeature branchも同じコミットで、作業ツリーはclean。`parent/ap-samples-implementation.diff` は `app.js`、`render.js`、`events.js`、`components.css` のAP実装差分。`parent/ap-samples-before/hashes.json` はAP追加直前の8ファイルの基準値。

4ファイルは保存済みAP専用diffを逆適用する。`gn.js` はファイル全体をスナップショットで上書きしない。`apSamples` subtreeだけを除き、旧 `input` / `script` / `result` と `collectionSchedule` を保つ。`tools/verify.mjs` はxlsx許可集合を集金予定表の4冊へ戻す。`docs/artifacts/2026-10-13-demo-assets.json` からAP4資産の項目とAP集計を除き、集金予定表4冊とスライドの記録を残す。

削除前に次の4ファイルをリポジトリ外の兄弟ディレクトリ（実際の保管先：`work/qa01-paper-preview/gn02-return-before/`）へコピーし、manifestのbytes/hashと一致させる。その後、公開対象から同名ファイルだけを外す。

- `mock/assets/demo/gn2-ap-invoices.pdf`
- `mock/assets/demo/gn2-ap-orders.xlsx`
- `mock/assets/demo/gn2-ap-receipts.xlsx`
- `mock/assets/demo/gn2-ap-invoice-preview.png`

AP設計handoffは経緯資料として保持する。Git履歴・既存branchはそのままにし、reset、force-push、branch削除は行わない。実装は最新 `origin/main` から新しいfeature branchで進め、PRは既存のsquash merge方針に従う。

## 影響範囲

- `mock/js/app.js`、`mock/js/render.js`、`mock/js/events.js`、`mock/css/components.css`：保存済みdiffのAP追加分だけを取り除く。
- `mock/js/data/scenarios/mfg/gn.js`：`apSamples` だけを取り除き、既存AP台本と集金予定表metadataを保持。
- `tools/verify.mjs`：許可xlsxを `gn2-collection-{invoices,template,draft,reviewed}.xlsx` の4冊に戻す。
- `mock/assets/demo/gn2-ap-*` の上記4資産：hash照合後、公開ツリーから除去。
- `docs/artifacts/2026-10-13-demo-assets.json`：公開中のcollection資産と整合するようAP資産記録だけを除去。

それ以外のファイルは変更しない。特に collectionの4冊・`mock/gn2-collection-slide.html`・QA/NMの各変更・`ui.js`・regress baseline・state/log/localStorage契約は維持する。

## 受け入れ条件

1. 指定URLから集金予定表デモが開き、初期候補2件、ARサンプル2件、初稿・修正版、4冊のExcelリンクが以前どおり動く。
2. GN-02のAP既存入力を選ぶと、旧APの依頼と40枚台本の応答が使われる。AP専用PDF/Excel選択肢、preview、PNGが表示されず、AP資産への参照も残らない。
3. QA/NMのチャット、画像preview、status、favorites、共通添付の送信・再開が現状どおり動く。
4. `tools/verify.mjs` の例外はcollectionのxlsx4冊のみ。collection asset manifestの列挙とhashが実ファイルに一致する。
5. 保存済みAP差分を除いた後の変更一覧が上記影響範囲に収まり、GNの旧APデータとcollection metadataが削除・改変されていない。

## Issue草案（外部未投稿）

**タイトル**：GN-02を集金予定表デモへ戻し、後付けAP添付サンプルを取り下げる  
**ラベル**：`run:mac`

GN-02に後から追加した発票PDF・発注Excel・入庫Excelの添付サンプルを取り下げ、直前の集金予定表デモへ戻す。APの既存40枚台本と集金予定表の初稿・修正版、QA/NM・共通添付機能を保持する。実装は保存済みAP差分を4 UIファイルに限って逆適用し、GN metadataとvalidatorはAP専用部分だけを選択的に戻す。AP4資産はhashを記録してリポジトリ外へ保管後、公開ツリーから除く。`docs/handoff/2026-10-13-gn02-return-to-collection.md` の受け入れ条件を確認し、レビュー後にPR化する。

## 実施結果

- 保存済みAP追加前の8ファイルとSHA-256がすべて一致。集金予定表4冊とスライドのbytes/hashもmanifestと一致。公開ツリーから外したAP4資産は保管先とSHA-256が一致。
- 独立レビューで `review-gn2.cjs`（GN-02／QA／NM／共通チャット）と `npm run verify` がPASS。差分の範囲と参照残りを確認。
- `npm run ci`、`npm run index:check`、`git diff --check` がPASS。18件の既存警告は継続。DSLのdry-runは49/49 PASS。
- ローカルブラウザでスライドからデモへ進み、請求データと完成見本の2点添付、送信後の添付パネル閉鎖、6明細の初稿、追加指示を入力欄へ選択してから送信、4行の修正版と3セルの黄色表示、4冊のExcelリンクを確認。
- 一度目のローカル遷移ではデータ読込の一時的な不整合で起動せず、復元済みファイルを再読み込みした後に上記の流れを完走。公開先での確認は反映後に行う。
