# デモのステータス変更

2026-10-12。M/L、run:mac。ユーザーの明示指示により、QA-01とNM-05を「提供中」にし、現在の他の「提供中」をすべて「試行版」にする。お気に入りQA-01／NM-05は保持する。値は確定しており、追加の承認質問は不要。以下は現物のSVCSを読んだ値で、CLAUDE.mdの古い件数は使わない。

## 変更内容

- qa1、nm5：st=2→1。
- kn1, kn2, kn3, dc1, dc2, dc4, lg1, lg4, nm3, gn1, gn2, gn5：st=1→2（12件）。
- その他の既存st=2（27件）とst=3（47件）は保持。変更は14件のstだけ。
- dc2とgn5はmfg／fin／it共通サービスなので、finとit側の表示にも同じ変更が反映される。業種ごとに別のstは持たない。

## 全件数

全体は88件のまま。IDと掲載順、分類、業種、台本、名称、タグは変えない。

| ステータス | 変更前 | 変更後 |
|---|---|---|
| 提供中 st=1 | 12 | 2 |
| 試行版 st=2 | 29 | 39 |
| 構想 st=3 | 47 | 47 |

業種別の列は「提供中 / 試行版 / 構想」。複数業種のサービスを各業種へ数えるため、業種別合計は全体88件と単純合算しない。

| 業種 | 全件数 | 変更前 | 変更後 |
|---|---|---|---|
| mfg | 56 | 12 / 23 / 21 | 2 / 33 / 21 |
| fin | 31 | 2 / 10 / 19 | 0 / 12 / 19 |
| it | 27 | 2 / 4 / 21 | 0 / 6 / 21 |

## 変更前の全id一覧

一覧はcatalog.jsの内部idを掲載順で示す。顧客表示の番号変換は既存どおり。

- 提供中 12件：kn1, kn2, kn3, dc1, dc2, dc4, lg1, lg4, nm3, gn1, gn2, gn5
- 試行版 29件：kn4, kn5, qa1, qa3, qa4, dc3, dc5, dc6, dc7, dc8, lg2, lg3, nm2, nm4, nm5, en1, en2, gn3, gn4, gn6, pt1, pt2, pt3, kn6, kn8, dc9, rs1, rs3, rs4
- 構想 47件：kn11, kn12, qa2, qa5, dc12, nm1, nm6, en3, gn7, gn8, pt4, pt5, pt6, pt7, pt8, pt9, kn7, kn9, kn10, dc10, dc11, rs2, rs5, cv1, cv2, cv3, cv4, fa1, fa2, fa3, fa4, fa5, po1, po2, po3, po4, po5, po6, po7, eg1, sl1, sl2, sl3, so1, so2, so3, so4

## 変更後の全id一覧

- 提供中 2件：qa1, nm5
- 試行版 39件：kn1, kn2, kn3, kn4, kn5, qa3, qa4, dc1, dc2, dc3, dc4, dc5, dc6, dc7, dc8, lg1, lg2, lg3, lg4, nm2, nm3, nm4, en1, en2, gn1, gn2, gn3, gn4, gn5, gn6, pt1, pt2, pt3, kn6, kn8, dc9, rs1, rs3, rs4
- 構想 47件：kn11, kn12, qa2, qa5, dc12, nm1, nm6, en3, gn7, gn8, pt4, pt5, pt6, pt7, pt8, pt9, kn7, kn9, kn10, dc10, dc11, rs2, rs5, cv1, cv2, cv3, cv4, fa1, fa2, fa3, fa4, fa5, po1, po2, po3, po4, po5, po6, po7, eg1, sl1, sl2, sl3, so1, so2, so3, so4

## 編集範囲と検証

編集許可は `mock/js/data/catalog.js` の対象14サービスのstのみ、`docs/service-map.md` の生成更新、`tools/regress.baseline.json` の対象14サービスのstのみ。service-mapは手編集せず `npm run index` で生成する。baseline更新は本設計の意図したデータ変更として行い、UI135キー・件数・id・分類・業種・タグ・掲載順は保持する。

app／render／events／ui／components、シナリオ、原画像、資料原本、LIVE、localStorageとお気に入り設定、NMまとめ、QA草案と検索、CLAUDE／.claude／.githubはこの追加変更で触らない。現在の作業ツリーには先のUI改修があるため、差分照合は本変更直前を基準にし、以前の変更と混ぜない。

実装後に `npm run index:check` と `npm test` をPASSさせる。現物SVCSを再読取し、全体2／39／47と全id一覧、業種別件数、14件のst差分を照合する。生成service-mapとbaselineも同じstになっていることを確認。UIではQA-01／NM-05が提供中、以前の12件が試行版、お気に入り2件が保持されることを確認する。設計作成時点ではコード変更と検証実行は行っていない。

## Issue草案 外部未投稿

**タイトル**：QA-01とNM-05を提供中にし、他の提供中を試行版へ変更

**ラベル**：run:mac

ユーザー指定に合わせ、現在は試行版のqa1／nm5を提供中へ変更し、現在の提供中12件をすべて試行版へ変更する。対象14件のstだけを編集し、その他の試行版・構想、掲載順とid、QA-01／NM-05のお気に入りを保持する。設計書は `docs/handoff/2026-10-12-demo-statuses.md`。

catalog.jsのst、生成service-map、baselineのstを1つの変更として実装・レビューし、上記の全件数とid一覧、`npm test`、`index:check`、変更直前からのdiffを照合する。外部Issue／PRへは投稿せず、公開はこの設計の対象外。

## 6. 関連表示の整合に関する追加設計

ステータス変更後にも旧「提供中」の説明が残る2箇所を整える。ステータス表示を変更する指示に伴う整合修正であり、追加の承認質問は不要。元の編集範囲に以下だけを追加する。コードはこの設計追記では変更しない。

### ITのDC02推薦理由

`mock/js/data/home.js` の `HOME.it.recommended` 内dc2のwhyだけを変更する。第1文の機能説明をそのまま残し、第2文の「すでに提供中／今日から使える」を3言語で削除する。確定後の文は以下。

| 言語 | why |
|---|---|
| ja | 日中が混ざる案件レビューの議事録を、その場で両言語に起こせます。 |
| zh | 中日混合的项目评审纪要可当场生成双语版本。 |
| en | Turns a mixed Japanese/Chinese project review into minutes in both languages on the spot. |

HOMEの他サービス、recommendedのidと順序、frequent、FEEDは保持する。

### デモガイドの注記

`mock/index.html` の「6. 成熟度」内のja／zh注記2段落だけを次へ置き換える。

ja：

> デモはステータスにかかわらず各サービスから開けます。現在「提供中」はQA-01とNM-05の2件です。画面の応答は台本または汎用のモックです。

zh：

> 无论服务处于何种状态，都可从各服务打开演示。当前标注为「已提供」的是QA-01和NM-05，共2项。界面中的回答来自预设脚本或通用模拟回复。

この注記から「82件すべて」「提供中12件」「2026-09-08の実機投入」と現在の表示ステータスを結び付けた記述、および「試行版・構想はDify実装対象外」という記述を除く。実機stateと過去の投入記録の原本は保持する。成熟度のenumラベル、定義欄、他の段落、CSSは変更しない。

### 追加の編集契約と検証

追加許可はhome.jsのdc2 why3文とindex.htmlの該当2段落だけ。変更前の3ファイル保存は親が追加する。元のcatalog st14件、生成service-map、baseline st14件の契約は維持する。UIキー追加はなく135のまま。お気に入りとst以外のサービス属性も保持する。

差分で削除した第2文と新しい2段落を照合し、変更後のIT推薦とデモガイドに古い提供中12件の結び付きが残らないことを確認する。3言語キー集合、enum、CSS、実機stateに変更がないこと、`npm test`と`npm run index:check`のPASSも確認する。Issue草案にはこの表示整合の範囲を含めるが、外部Issue／PR投稿と公開は行わない。

## 7. ステータス変更の検証完了

2026年10月12日。独立reviewer、npm test、index:checkのPASSを受領。ローカル作業は完了し、外部公開は未実施。

親のブラウザで、QA-01／NM-05のお気に入り2件が提供中であること、日中英×light/dark、両サービスの詳細とdemoヘッダー、旧提供中12件が一覧で試行版となることを確認。dashboardの件数はmfg=2／33／21、fin=0／12／19、it=0／6／21で一致した。IT推薦理由には古い「提供中／今日から使える」の断定がない。元資料・画像・台本・お気に入りは保持した。

画面記録qa01-nm05-live-favorites.jpgは親が保存・目視済み。この追記は受領した検証記録のみで、コードや外部公開環境は変更していない。
