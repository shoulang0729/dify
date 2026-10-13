# GN-02の発票照合に3種類のサンプルを添付する

2026-10-13／M/L。制作前半はローカル試作。現在のPR・マージ・公開確認の承認範囲は§8に記録する。Issueは末尾の未投稿草案。設計担当は本書だけを作成し、コードと資産は変更していない。

親による実装確認：未添付3種一覧→PDF＋Excel2冊の選択→発票画像と2表の展開→送信後の会話内3リンク、添付panel非表示、再開時0件まで実ブラウザで確認した。PDF第3ページ画像は実読み込み済み、発注24,000個／入庫23,400個とUのPO空欄は保存資料と一致。画面から保存したExcel2冊のSHA-256は資産manifestと一致。ja/zh/en×light/dark切替とAP2の候補入力→送信でも送信済み3件を保持した。全リポジトリのnpm run ci（dry-run49/49を含む）はPASS。独立app/素材/scope監査もPASS、残る指摘なし。ネイティブExcel/PowerPoint起動とDify実機の操作は未実施。

## 1. 目的と確定方針

GN-02のAP（受領発票・発注・入庫の三点照合）で、3種類の実在サンプルをまとめて添付・送信し、中身を確認できるようにする。親PMが確定した範囲は**既存結果表8件の抜粋サンプル**。未取得の残り32件を作って40件全データとして扱わない。結果の40枚／一致36／不一致4と既存3往復は台本の値として保持する。

既存GN-02のname、inputの40枚ファイル名、AP script ja/zhの全q/a、resultの8行と数値をバイト保持する。新しいサンプルは別apSamples metadataに8件と名乗って置く。SVCS88件、id集合、st/fav、T139キー、localStorage3キー、state/log契約、AR2ターンと4Excel、query入口、QA/NM/画像/原本、Dify実機は保持する。リポジトリへの反映は§8の最新承認に従う。

## 2. 読取で確認した値と資料の限界

根拠はmock/js/data/scenarios/mfg/gn.jsのgn2 result/scriptとdocs/dify/usecases/GN-02.md。dify/samples/GN-02/S01〜S04は9月の単票／5件等の別入力で、8月40枚の完全な内訳ではない。40枚の実発票、発注・入庫全データは未取得。CSV36枚のRMB512,840や科目内訳も全件台本の値で、以下8件の合計とは区別する。

| 表順 | 発票番号（表示用） | 取引先 | 税込金額RMB | 発注・入庫で既知の内容 | 台本判定 |
|---|---|---|---:|---|---|
| 1 | 0250812…33 | S 社（鋼板） | 186,420 | PO-2508-011、入庫8/19・2.4t、一致 | 一致 |
| 2 | 0250815…07 | S 工具 | 22,320 | PO-2508-019・発注120本／入庫120本 | 一致 |
| 3 | 0250820…41 | 塗装 S 社 | 48,600 | PO-2508-024・24,000個／入庫23,400個、返却600個 | 数量不一致 |
| 4 | 0250822…18 | U 刀具 | 3,560 | POなし、設備保全課の緊急購入 | 発注なし |
| 5 | 0250826…52 | T 社（サンプル材） | 4,200 | PO-2508-031、一致、入庫8/28 | 一致 |
| 6 | 0250828…09 | 物流 W 社 | 12,800 | PO-2508-027、実績8便。元台本の税率表9%に対し発票13% | 税率誤記 |
| 7 | 0250829…66 | 電力会社 | 96,300 | 契約／メーター実績。数量・実績値は未提示 | 一致 |
| 8 | 0250830…21 | K 社（有償支給材） | 8,900 | PO-2508-035、入庫8/30。発票税号の所属が上海、マスタは常熟 | 税号相違 |

この抜粋は一致4／不一致4、税込合計RMB383,100（一致4件309,240／不一致4件73,860）。40枚の36／4や一致36枚512,840を8件から計算したと表示しない。省略記号入り発票番号は表示用のまま保持し、完全な税務番号を補完しない。

塗装S社は既存AP第2回答に8/22・返品600個・RT-2508-04・単価RMB2.025（税込）・差額RMB1,215がある。usecaseの例にも同値がある。ただしworld/records.csvの同番号には別の返品内容が記載されているため、今回はAP台本の説明用抜粋として扱い、既存worldを改変・統合しない。実物の返品証憑を取得したとは名乗らない。

未提示の発票日、発注日、数量、単価、取引先正式名、税号の実数、口座、契約番号は空欄または「未提示」とする。発票番号から日付を逆算しない。実在登録情報、完全な発票番号、残り32件、正式POを新設しない。UはPO番号空欄／メモ「元台本：POなし」、電力はPO番号空欄／「契約・メーター実績（番号・値は未提示）」で、8対象の参照行を保つ。

## 3. 実ファイルとプレビューの契約

資産ownerは親から依頼を受ける担当。以下は制作開始前に親が確定し、生成済みと報告した実ファイル名である。3件を添付用、PNG1件を表示専用とする。表示名はja/zhとも同名で8件抜粋と分かる名前を使い、既存inputの40枚名を変更しない。

| 役割 | mock/からの相対src | ja表示名 | zh表示名 |
|---|---|---|---|
| 発票PDF・8ページ | assets/demo/gn2-ap-invoices.pdf | 発票サンプル_8枚抜粋.pdf | 発票サンプル_8枚抜粋.pdf |
| 発注Excel・8対象 | assets/demo/gn2-ap-orders.xlsx | 発注データ_8件抜粋.xlsx | 発注データ_8件抜粋.xlsx |
| 入庫Excel・8対象 | assets/demo/gn2-ap-receipts.xlsx | 入庫データ_8件抜粋.xlsx | 入庫データ_8件抜粋.xlsx |
| PDF第3ページ由来の画像、添付しない | assets/demo/gn2-ap-invoice-preview.png | 塗装S社の発票サンプル | 涂装S公司发票示例 |

PDFは新しく作る模擬票で、8ページの順番と番号・相手・税込金額を上表へ合わせる。各票に「デモ用・台本抜粋」を表示し、実発票や原本取得を装わない。第3ページは24,000個・48,600の発票側情報を示す。入庫側23,400と600差は入庫表・元台本メモで照合できるようにする。架空の税号実数・税務局登録情報を描かない。PNGは必ず完成PDFの第3ページからレンダリングし、別票を描き起こさない。

発注・入庫表のcolumns/rowsは資産担当のfinal metadata JSONを正本として採用し、親がその実パス・hashをmanifestに記録する。画面とExcelは同じ8対象・既知値・未提示空欄で一致させる。「対応発票税込額(RMB)」等の列がある場合は対応する発票金額であり、注文額・入庫金額を実取得した値と表示しない。数量等は§2で明示された分だけ書き、未知を一致値で埋めない。POにも入庫にもUの参照行を残すが、実際のPO/入庫記録が存在するとは言わない。旧提案の列構成に合わせて生成済み資産を作り直さない。

確定JSONはrepoの親作業フォルダap-assets/ap-app-metadata.json。発注8列は[発票番号（台本表記）,サプライヤー,発注・契約,発注数量,単位,対応発票税込額(RMB),確認区分,備考]、入庫9列は[発票番号（台本表記）,サプライヤー,発注・契約,入庫日,実入庫・実績数量,単位,対応発票税込額(RMB),確認区分,備考]とする。「発注・契約」で電力の「契約」を保持し、契約番号は未提示、Uはnull。単価を算出して追加しない。

JSONの入庫日serial値はExcelの日付型を表す。UIは同じrecordのdataRows.received（ISO文字列）を日付表示へ使い、金額は桁区切りで表示する。値の意味を変えず表示だけを合わせる処理で、Excelの実セル・型・columnを変更しない。previewTablesへ渡す文字列は親がfinal JSONから純リテラルとして用意し、data内の関数化や資産再制作をしない。

## 4. AP/ARの入口と送信

```
?demo=gn2-collection（AR依頼のdraftだけ。初期候補2）
 → AP候補クリック（旧AP qがdraftに入る。送信/添付消費なし）
 → 添付を開く（未添付のサンプル3種一覧）
 → サンプルを使う（PDF＋発注＋入庫、upFiles3件）
 → プレビュー3を展開（PDF第3ページ画像/全8pリンク、PO表、入庫表）
 → 送信（発話下に送信済み3件、panelを閉じる）
 → 旧AP1返答 → 旧AP2 → 旧AP3（候補0）
```

GN-02の初期候補2、AP/ARの段階分離と意図判定を保持する。gn2InputForDraftのAP返却先だけ新apSamples.input[lang]へ替える。queryは既定AR文を入れるだけなので、AP候補・明示AP手入力でAPサンプルに切替できる。開いているpanelもGN限定の再描画で候補のrouteに合わせ、draft/caretを維持する。新しいA/B menuやモードstateは足さない。

候補や本文変更だけでupFilesを置換しない。AR2件が未送信で残るときは、APの「サンプルを使う」操作で既存upClear→AP3件へ置換する。AR添付のままAP送信、混在、AP一部だけなら段階を進めず確認へ。AP3件をAR初稿の入力と誤認しない。既存送信済みAR/成果物は保持する。

AP sample判定は3件のkind:'doc'＋src＋sampleId:'gn2-ap-excerpt'完全一致。filenameだけの実uploadをこのサンプルの読取結果として扱わない。初回APで任意file／部分sampleを渡した場合は未解析の確認応答へ。以前の0file AP台本開始は維持し、固定台本の注記を表示する。AP2/3は完了AP1の証跡を使い、upFiles0でも再添付を要求しない。AR発話をAP3ターンの進行に数えない。

本文ありはraw、本文空＋AP3件は旧APの次qを表示文にする。空本文＋添付0は送信せず、読込中/pendingも送信不可。受理したバッチだけchatAcceptAttachmentsへ渡し、3件をlog:indexの発話下へ移し、未送信panelを閉じる。新規添付の再開は0件。PNGはupFilesへ追加しない。日中入力、言語/theme、sample/clear/redrawを跨いでdraftを保持する。

## 5. 表示と純リテラルmetadata

gn2へapSamples:{sampleId,input:{ja,zh},labels:{ja,zh,en},note:{ja,zh,en},clarify:{ja,zh}}を追加する。input[lang]は{files:[3表示名],assets:[3doc],previewTables:[発注8行,入庫8行],invoicePreview:{title,file,pdfFile,page:3,caption}}。assetsは{file,kind:'doc',download:実filename,sampleId:'gn2-ap-excerpt'}。関数/DOM/API呼出をdataへ書かない。旧AP input/script/resultは編集しない。

このshapeをfreezeする。labelsは§5の「サンプルの内容（未添付）」の3言語文字列を直接持つmap、noteは下表の3言語文字列map。previewTablesは{title,columns,rows}を2件、invoicePreview.fileはPNG相対path、pdfFileは全8ページPDFの相対path、titleは既定summary、captionは短いPDF3ページ目の出典文字列とする。UIのenは入力previewだけ既存scriptLangでja、labels/noteはLで3言語を表示する。任意placeholderデータのままpreview/解析結果を表示せず、apSamples未登録時は旧scn.inputへ安全に戻る。

PM補足によりclarifyはAPのfile負例専用のログ応答として追加する。AP partial/mixed/unknownでは、元データ・見本2件を求める既存AR clarify.sampleを使わず、このja/zh文字列を使ってAP段階と前結果を保持する。UIキーではなく業務応答metadataなのでT139不変。ARの確認文・判定、添付0件の既存AP台本開始は保持する。

| clarify.ja | clarify.zh |
|---|---|
| 発票・発注・入庫のサンプル3件を選択してください。このモックは任意のファイルを解析しないため、照合結果を確定できません。 | 请选择发票、采购订单、入库数据这3个示例文件。本模拟不解析任意文件，因此无法确定核对结果。 |

panelを開いた直後は「サンプルの内容（未添付）」／「示例内容（尚未附加）」／「Sample contents (not attached)」と3種の名前を静かな一覧で表示する。未選択をupFilesのファイルchipと混同させない。sample選択後は実際のupFiles3件を表示し、collapsed details3つを置く。

- 発票：「サンプルの発票（8件抜粋）」／「示例发票（8项摘录）」をsummaryにする。中に第3ページ画像、短い出典「塗装S社の発票サンプル（PDF3ページ目）」／「涂装S公司发票示例（PDF第3页）」と、全8ページPDFを開く既存feedOpenリンク。
- 発注：「サンプルの発注データ（8対象）」／「示例采购订单数据（8个对象）」、8行表。
- 入庫：「サンプルの入庫データ（8対象）」／「示例入库数据（8个对象）」、8行表。

sample src3件が完全一致したときだけプレビューを表示する。clear/添付0/任意file/name一致だけでは出さない。送信後はpanelごと閉じ、送信済みPDFリンクから全8ページを開ける。Excel2件は既存doc downloadを使う。元PDF画像を見せるのはGN専用detailsだけで、共通QA画像dialogは変更しない。

注記はpanelとAP結果に表示する。metadata3言語で管理し、Tの追加は0、baseline139のまま。

| ja | zh | en |
|---|---|---|
| 抜粋サンプル（8件）です。照合結果は40枚の台本です。選択したファイルを解析する処理はありません。 | 这是摘录示例（8项）。核对结果使用40张发票的预设演示脚本，不会解析所选文件。 | These are excerpt samples (8 items). Matching results use a scripted 40-invoice scenario. Selected files are not parsed. |

既存gn2-input-preview／gn2-table-scrollを使い、表660px最小幅と横スクロールを維持する。PNGはGN専用classでwidth:100%、max-height:480px、object-fit:contain。添付panel既存max-height320px/内部スクロール、字体、余白、テーマを保持。文字はescまたはtext node、パスは固定metadataの相対assetのみ。選択していない画像・別ファイルの内容を静的表示しない。

## 6. 変更対象と所有者

1. **親・資産担当**：§3のPDF8ページ＋Excel2冊＋PDF由来PNG＋manifestを先に作る。数値・8対象・未知空欄・PDFページ順・画像一致を検証し、ファイルパス/hashを実装者へ渡す。新しいworld値・32件の全件データを追加しない。
2. **親のmetadata owner**：資産担当の既知8行JSON/画像の実pathを受領後、mock/js/data/scenarios/mfg/gn.jsへ§5の確定shapeを純リテラルとして直列挿入する。空placeholderをサンプルと名乗って公開せず、元input/script/resultはバイト保持。親はtools/verify.mjsの指定6xlsxへの許可追加も所有する。
3. **implementer 1名**：shape確定後はgn.jsを編集せず、app.jsのAP input返却/sample判定/確認、render.jsのAP3preview・doc許可・note、events.jsのGN候補後panel局所更新、必要なGN画像selectorだけcomponents.cssを担当できる。素材制作とコードはファイルが重ならないので並行可。metadata未挿入時は旧inputを使う安全なfallbackとし、素材/metadata完成後に一体検証する。既存upUseSampleのdownload/sampleId転送とchatAcceptAttachmentsを再利用する。新data-act、T、storage、dependenciesは追加しない。
4. **tools/verify.mjs（親所有）**：既存GN4冊の許可は維持し、gn2-ap-orders.xlsx、gn2-ap-receipts.xlsxの指定2冊だけ既存200KB上限付きの例外集合へ追加する。全xlsx拡張子の一般許可はしない。PDF≤200KB、PNG≤300KBを守る。既存verifyは拡張子・サイズ検査であり、ZIP/XML/全セル/数式/型は資産担当と独立reviewerが別途検証する。
5. **reviewer→親UI→リポジトリ反映**：共通app/render/eventsとverifyは直列owner。npm test/index:check、before比較、入力3件・preview3・送信済み3件の実表示を確認。catalog/service-map/baselineの変更は不要。PR・検査・squashマージ・Pages確認は§8の承認範囲で進め、Dify実機は変更しない。

## 7. 受け入れ条件

- AR query入口→AP候補はdraftだけ。添付を開くとAPの未添付3種が見え、sampleでPDF+2xlsxの3件だけ、preview3が見える。PDF全8ページと第3ページPNG、PO/入庫の8対象・既知値・未知空欄が一致する。
- 送信で3件が発話下へ移りpanelが閉じ、再開は0件。送信済みdoc3リンク、locale/theme/redraw、AP2/3後も添付と結果を保持。PNGは添付されない。
- AP3件→AR、AR2件→AP、部分sample、混在、filenameだけ一致/任意file、未選択sample、空送信、pending二重送信を負例として確認。初期候補/ログ/段階を壊さず、未知データを解析済みとしない。
- AP1→AR1→AP2→AR2→AP3とAR先行を再確認。既存AP input/script/resultのバイト一致、AR2ターン/4Excel/黄色3cell、query既定、QA/NM/画像/fav/st保持。3lang×2theme、draft/raw改行/**/<文字>、restart/resetを確認。
- npm test、npm run index:check、diff scope、既存T139/baseline、xlsx指定2冊例外・サイズ/ZIP・PDF/PNGサイズをPASS。資産実在と独立検証、親ブラウザのPASS前に実装済みと記録しない。

## 8. PM判断による確定変更と反映承認

親は資産制作開始前に§3の物理名を担当へ確定しており、その4ファイルは生成済みである。設計の旧提案名へ重複制作・改名しない。表示名はja/zh同名の「発票サンプル_8枚抜粋.pdf」「発注データ_8件抜粋.xlsx」「入庫データ_8件抜粋.xlsx」に統一し、表はfinal metadata JSONを採用する。既知の根拠は既存AP表・台本に限り、未提示数量・日付・単価・実税号は空欄を維持する。対応発票金額を注文額に読み替えず、8件抜粋と40枚台本を混同しない。

PMの列補足により発注8列／入庫9列とdataRows.received（ISO文字列）の表示契約を§3へ確定した。資産担当から8件の合計・既知値/未知空欄・全8PDFページ・xlsxのZIP/XML/式/型・PNGの監査とhash保存を受領した。PDF87,492bytes、表示専用PNG118,581bytesで上限内、既存AR4xlsxのhash保持も資産担当の監査PASS。詳細はap-assets/ap-app-metadata.jsonとmanifest.jsonを参照し、これをapp統合／ブラウザの最終PASSと混同しない。

PMの追加判断として、AP添付の一部不足・混在・任意fileへの応答をapSamples.clarify:{ja,zh}へ分離した。APに必要な発票・発注・入庫3件を案内し、AR用の2件確認を誤って出さない。固定文は§5に記載し、親がmetadataへ挿入、既定implementerがAP file負例だけに使用する。T139と旧AP0file開始、AR側の確認は保持する。

ユーザーの最新の直接指示「difyリポジトリにマージまでやりたいけどやってる？」により、現在の一連の変更をPR→検査→squashマージ→Pages確認まで進める承認を受領した。以前のローカル限定／外部PR・公開なしは制作期間の指示であり、今後の反映作業はこの承認で置き換える。独立検証と親UI確認を完了してから、既存リポジトリ契約のfeature branch・PR・検査・squashマージに従って反映し、Pagesの実表示を確認する。Difyアプリ・DSL・KB・実機state・実機公開の変更は承認範囲に含めず保持する。

app/render/events/CSSの実装ownerは既定のimplementerで、親はmetadata・validator・統合・公開確認を担当する。本書の更新は設計だけであり、PR作成・マージ・Pages確認を実施済みと報告するものではない。

## Issue草案（外部未投稿）

**タイトル**：GN-02の発票照合で3種類の抜粋サンプルを一括添付する

**ラベル**：run:mac

現行GN-02のAPには発票・発注・入庫の3名が台本にあるが実サンプルがなく、AR入口からAPへ切替えて資料を見せる操作ができない。設計書docs/handoff/2026-10-13-gn02-ap-samples.mdに従い、既存結果表8件の模擬発票PDF・発注/入庫Excelを一括添付し、PDF由来1ページ画像と2表を展開してから送信できるようにする。8件抜粋と40枚台本を明示的に区別し、旧AP3往復・input名・結果/数値は保持する。

素材制作→app1名→独立レビュー→親UIの1変更単位で直列に進める。§7のAP/AR切替、draftのみ、3添付/preview/送信済み、未知空欄、T139/ログ/設定/原本保持と指定xlsx2冊の検証を行う。全40件を作らず、任意uploadの実解析とDify実機変更は含めない。検証後のPR・squashマージ・Pages確認は§8の最新承認に従う。
