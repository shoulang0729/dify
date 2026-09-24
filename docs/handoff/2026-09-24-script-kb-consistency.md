# 台本・KB・テスト・ポータルの「同じ番号・同じ値」をそろえる（Cowork 取り込み #340〜#343 の PM 決定の実装）

- 日付：2026-09-24
- 作成：architect
- 出所：Cowork 手渡しメモ 4 本（`docs/handoff/cowork/2026-09-23-qa01-handwritten-input.md`・`…-kn11-tacit-capture.md`・`…-kn01-kn03-source-vetting.md`・`…-dc03-en03-input-entry.md`）と、その取り込み PR #340〜#343。PM 決定は 2026-09-24
- レーン：**M/L**（データ層 `SVCS[].desc`・台本・架空世界マスタ・KB・テスト・`tools/check-world.mjs` に触る）
- Issue 本文：`docs/handoff/script-kb-consistency.issue.md`
- 検証は作業用コピー（`scratchpad/verify-consist`。本設計の変更をすべて入れた状態）で実走した。出力は §7

---

## §0. PM 決定（2026-09-24）と、この設計書で決めたこと

| # | 項目 | PM 決定 | この設計書で決めたこと（architect 判断） |
|---|---|---|---|
| 1 | 出典番号の食い違い | 推奨どおり。深穴ドリルは**新しい番号**に分ける。`NC-2025-0912`／`8D-25-0912` は**幕 1（塗装ブツ）を優先**し、寸法ばらつきは**別の NC に分ける**。W10 を足す | 新番号は `NC-2024-0321`・`TR-2023-063`・`TR-2024-064`・`NC-2025-0904` の 4 件（§2-1）。**`TR-2024-007` は番号を変えず、`records.csv` の件名のほうを直す**（§2-2。調べたら `records.csv` の件名だけが他のすべてと食い違っていた）。W10 は語彙を `data/world/mfg/record_terms.csv`（新設）に置き、ツールに語をハードコードしない（§2-7） |
| 2 | KN-03 の年休未消化の精算 | 法令の言い方（日給の 300%、うち 100% は通常の賃金）に合わせる | 中国語版の**旧版**（2023-07）にも同じ条があるので同時に直す。テストに `KN-03 T03` を 1 件足して値を固定する（§3） |
| 3 | showcase 設計書 §20 追補 | 推奨どおり | 本設計書と同時に `docs/handoff/2026-09-16-showcase-demo.md` の末尾に §20 を追記した（PR-0）。§20-4 にポータルの設備列の変更（本設計 §2-3 の結果）を 1 項足した |
| 4 | `desc` 3 件（DC-03・KN-11・EN-03） | OK | 3 言語のリテラルを §4 に全文で書いた。`regress` の件数は不変（実走で確認） |
| 5 | 運用 | 推奨どおり | runbook 2 文は本 PR-0 で書いた（§5-1）。**KN-01 の Rev.D の日付だけを変える案は、そのままだと版の順序が壊れる**ことが分かったので、案を 3 つに分けて PM 判断に戻す（§5-2・§9 Q1）。KN-03 の周知日は足さない（§5-3） |

**PM 判断待ちは §9 に 3 件**（Q1 が必須、Q2・Q3 は軽い）。Q1 が決まらなくても PR-1〜PR-3 は進められる（Q1 の対象ファイルの差分は PR-1 に後から足せる形にしてある）。

---

## §1. 事実（`main` = `80491a1` 時点。行番号つき）

### 1-1. 記録番号と件名の対応（`data/world/mfg/records.csv`）

| 番号 | `records.csv` の件名（行） | 実際の使われ方 |
|---|---|---|
| `NC-2024-0118` | 冷間時の位置ずれによる不適合（2024-11-18・金型 D-118。3 行目） | **位置ずれ**：`kn.js` KN-11（181・192・200・201・205・206 行）・KN-12（234〜259 行）、`front.js` 223 行、`tools/gen-demo-assets.mjs` 415・468 行、`documents.csv` 12 行、`mock/assets/demo/README.md` 127 行<br>**深穴の折損（2024/3・ライン 2）**：`kn.js` KN-01（55・56・60・61 行）、`dc.js` DC-03（156・164・170・171・175・176 行）、`pt.js` PT-03（115〜117・120〜122 行）・PT-08（325・335 行）、`dify/kb/KN-01/` の 3 文書（11 か所）、`docs/dify/usecases/KN-01.md`・`DC-03.md`・`PT-03.md`・`PT-08.md` |
| `TR-2023-041` | 生産終了品の金型保管方針（13 行目） | **金型保管**：`front.js` 52・232 行（J 社・D-092）<br>**深穴の条件検討**：`kn.js` KN-01（54・59 行）、`eg.js` EG-01（24・29 行）、`dify/kb/KN-01/工程条件書_旋盤ライン3.md`（5 か所）、`docs/dify/usecases/KN-01.md`（4）、`dify/README.md` 76 行。`records.csv` の note「台本既出（en.js）」は**誤り**（`en.js` に使用例なし） |
| `TR-2024-102` | 塗装治具の寸法流用検討（12 行目） | **塗装治具**：`front.js` 117・231 行<br>**深穴の工具交換基準**：`kn.js` KN-01（54・59 行）、`dify/kb/KN-01/` の 4 文書（13 か所）、`docs/dify/usecases/KN-01.md`（2）、`dify/README.md` 76 行。note「台本既出（en.js）」は**誤り** |
| `TR-2024-007` | **E-47 アラームの原因調査**（PX-200。11 行目） | **全使用例が「SUS304 Φ8 深穴 60 mm 切削速度・クーラント条件の最適化【社外秘】」**：`kn.js` KN-01、`pt.js` PT-03・PT-08、`eg.js` EG-01、`dify/kb/KN-01/**`（11 か所）、**`dify/tests/KN-01.json` の T01・T02・T09 の期待値**、`dify/apps/*.yml` 12 本の言語契約の例示、`dify/KNOWN_ISSUES.md`・`DEPLOY.md`。**E-47 の意味で使っている箇所は 1 つも無い**。`records.csv` の件名だけが孤立している（Cowork メモには無い 4 件目の食い違い） |
| `NC-2025-0912` | **初品の寸法ばらつき**（PX-200。2 行目） | **塗装ブツ**：`qa.js` QA-01（13〜15・47・52 行）、`nm.js` NM-06（168・176・244〜268 行）、showcase 幕 1<br>**寸法ばらつき**：`mock/js/data/portal/common.js` 12 行（PACT `A-0912`「初品の寸法ばらつきの 8D を出す」）のみ。`common.js` 54 行（PCAND `C-01`「金型予熱の基準温度…」の出所）も中身は予熱＝寸法側 |
| `8D-25-0912` | **8D 報告（寸法ばらつき）**（4 行目） | **塗装ブツ**：`qa.js` QA-01（25・35・49・54 行）、`en.js`（119・124 行。脱脂液濃度の是正） |

- **台本で「寸法ばらつき」を参照している箇所は 0 件**（`mock/js/data/scenarios/**` を `寸法ばらつき|尺寸波动|dimensional variation` で検索）。寸法ばらつきの意味は `records.csv` と `common.js` の 2 行だけにある
- ポータルの設備列：`front.js` 218・219 行が `NC-2025-0912`・`8D-25-0912` の設備を `PX-200` とし、230 行が `TR-2024-007` を `SK-3310-A`／`PX-200` としている
- `portal/seed/**` の入力は `data/world/{mfg,fin,it}/{company.md,org.csv,people.csv}`・`catalog.js`（CATS/SVCS。`desc` は含まない）・`common.js`／`mgmt.js` の `PKNOW`/`PKPITOPIC`/`PGOAL`（`portal/scripts/gen-seed.mjs` 8〜11 行）。**`records.csv`・`PACT`・`PCAND`・`front.js` は入力ではない**

### 1-2. KN-03 の精算の値

| ファイル | 行 | 現在の文言 |
|---|---|---|
| `dify/kb/KN-03/就業規則_抜粋_日本語版.md` | 49 | 会社は法定基準（日給の 200%）により未使用分を精算する |
| `dify/kb/KN-03/员工手册_摘录_中文版.md` | 49 | 公司按法定标准（日工资的200%）对未使用部分进行结算 |
| `dify/kb/KN-03/员工手册_旧版_2023年7月版_中文.md` | 27 | 同上（旧版） |
| `mock/js/data/scenarios/mfg/kn.js` kn3 | 93・94・98・99 | `script.ja[1]`・`ja[2]`（回答文の中の中国語）・`zh[1]`・`zh[2]` の 4 か所 |
| `dify/tests/KN-03.json` | — | **200% の期待値は無い**（T01・T02・T04・T08 の 4 件。精算を問う T03 が未収録） |
| `docs/dify/usecases/KN-03.md` | 150 | T03 の期待「第 23 条 4 項、休暇管理細則 第 5 条を引く」（値は書いていない） |

- `scripts/dify/tests/test_lang_check.py` 106 行と `dify/results/cloud-master/KN-03-*.md` にも 200% があるが、前者は**過去の実機応答を固定した言語判定の入力**、後者は**実機の記録（機械だけが書く。CLAUDE.md §7）**なので触らない

### 1-3. KN-01 の版の日付（§5-2 の根拠）

| ファイル | 行 | 値 |
|---|---|---|
| `dify/kb/KN-01/作業標準書_寸法検査.md` | 8・79 | Rev.D **2026-06-25** |
| 同 | 78 | Rev.C **2025-11-10** |
| `…_旧版.md` | 11・39・46 | Rev.B 2025-04-02 |
| `…_旧版.md` | 30・40／41 | Rev.C 2025-11-10／Rev.D 2026-06-25 |
| `工程条件書_旋盤ライン3.md` | 5・8・72・73 | `PC-L3-2026-014`、Rev.A **2026-05-12**・Rev.B **2026-06-20** |
| `不具合報告_2026-Q2_抜粋.md` | 5・18・24・29・71 | `QR-2026-Q2-05`、`NC-2026-0412`／`0507`／`0619`、Rev.A 2026-07-08 |

- KN-01 の KB は**全体が 2026 年 4〜7 月の出来事として一貫して書かれている**（6 ファイルで `2026` が 45 回）。Rev.D の本文は `PC-L3-2026-014`（§1）と `NC-2026-0619`（§5）と `QR-2026-Q2-05`（§8）を参照している
- 世界の「今日」は 2025-09 前後（`calendar.md` 13〜21 行）。`pt.js` の 2026 年表記は既に「未統一」として記録済み
- `dify/tests/KN-01.json` に日付の期待値は無い。`kn1` の台本は日付を出さない（#342 のメモ §5-2）

---

## §2. 項目 1：出典番号の食い違いを分ける

### 2-1. 新設する番号（`data/world/mfg/records.csv` の末尾に 4 行追加）

採番の根拠：書式は `calendar.md` の `NC-YYYY-NNNN`・`TR-YYYY-NNN`。**リポジトリ全体（`.git`・`node_modules` を除く）で 4 件とも出現 0 回**を確認済み。TR の通番は同じ年の既存番号と日付の前後が矛盾しない値にした（`TR-2023-041`〔4 月〕→ `063`〔9 月〕、`TR-2024-007`〔7 月〕→ `064`〔9 月〕→ `102`〔12 月〕）。

| 新番号 | 何か | 置き換える旧番号（深穴の意味の箇所だけ） |
|---|---|---|
| **`NC-2024-0321`** | 深穴加工 工具折損（ライン 2、2024-03-21） | `NC-2024-0118` |
| **`TR-2023-063`** | SUS304 深穴ドリル加工 条件検討（Φ6〜Φ8） | `TR-2023-041` |
| **`TR-2024-064`** | 深穴ドリルの工具交換基準の設定 | `TR-2024-102` |
| **`NC-2025-0904`** | 初品の寸法ばらつき（PX-200・E-47 停止後） | `NC-2025-0912` の旧件名（§2-3） |

追加する 4 行（全文。ASCII のカンマは区切りだけ。本文中は全角「、」「・」を使う）：

```csv
NC-2024-0321,nc,2024-03-21,,,,,hinshitsu,closed,深穴加工 工具折損（ライン 2）,深孔加工断刀（2号线）,Drill breakage in deep-hole drilling (Line 2),SUS304 Φ8 深穴 60 mm。ステップ送りなし・クーラント 1.5 MPa で 210 本目に折損。対策（3D ごとのステップ送り・クーラント 2.0 MPa）後 6 か月再発なし。台本（kn.js KN-01・dc.js DC-03・pt.js PT-03／PT-08）と dify/kb/KN-01/** が使用。2026-09-24 に NC-2024-0118 から番号を分離（docs/handoff/2026-09-24-script-kb-consistency.md §2-1）
TR-2023-063,tr,2023-09-14,,,,,gijutsu,closed,SUS304 深穴ドリル加工 条件検討（Φ6〜Φ8）,SUS304 深孔钻削条件研究（Φ6〜Φ8）,Drilling condition study for SUS304 deep holes (Φ6 to Φ8),蘇州工場 ライン 2。Vc 18〜22 m/min・f 0.06 mm/rev で安定。Φ6 は f 0.05。dify/kb/KN-01/**・kn.js KN-01・eg.js EG-01 が使用。2026-09-24 に TR-2023-041 から番号を分離（同 §2-1）
TR-2024-064,tr,2024-09-20,,,,,gijutsu,closed,深穴ドリルの工具交換基準の設定,深孔钻头换刀基准的设定,Tool-change criteria for deep-hole drills,蘇州工場 ライン 2。超硬コーティングドリル Φ8（L/D = 8）で 200 本または摩耗幅 0.2 mm のいずれか早い方。NC-2024-0321 の効果確認（2024 年 4〜9 月）の実績から設定。dify/kb/KN-01/**・kn.js KN-01 が使用。2026-09-24 に TR-2024-102 から番号を分離（同 §2-1）
NC-2025-0904,nc,2025-09-04,,SK-3310-A,,PX-200,hinshitsu,closed,初品の寸法ばらつき,首件尺寸波动,First-article dimensional variation,PX-200 の E-47 停止（9/4 昼勤）後の初品。全数確認で流出なし。原因調査メモで金型 D-118 の予熱確認の抜けを指摘（ポータル PCAND の C-01 の出所）。2026-09-24 に NC-2025-0912 から分離（同 §2-3）
```

- `NC-2025-0904` の日付 9/4 は、既存台本の「PX-200 の E-47 は 9/2・9/4」（`kn.js` kn2・`nm.js` 168 行）に合わせた。状態は `closed`（ポータルの「未クローズ 5 件」の数字を動かさないため。ポータルの品質表にも**行を足さない**）
- `NC-2024-0321`・`TR-2023-063`・`TR-2024-064` は `part_no`・`equip_id` を空にする（材質 SUS304 の棒材で、`products.csv` の品番にも `equipment.csv` にも対応が無い。ライン 2 の設備はマスタに無い）

### 2-2. 既存行の書き換え（`records.csv` の 11・12・13 行）

`TR-2024-007` は**番号を変えない**（`dify/tests/KN-01.json` の期待値・実機 DSL 12 本・過去の実機結果がすべてこの番号を「深穴の条件」として使っているため。番号を動かすと実機テストが落ちる）。件名を実態に合わせる。

```csv
TR-2024-007,tr,2024-07-03,,,,,gijutsu,closed,SUS304 Φ8 深穴 60 mm 切削速度・クーラント条件の最適化,SUS304 Φ8 深孔 60 mm 切削速度与冷却液条件优化,Cutting speed and coolant optimization for SUS304 Φ8 60 mm deep holes,台本既出（kn.js KN-01・pt.js・eg.js）・dify/kb/KN-01/**・dify/tests/KN-01.json。社外秘。蘇州工場 ライン 2 の実績。2026-09-24 に件名を KB に合わせて訂正（同 §2-2）
TR-2024-102,tr,2024-12-11,,SK-3310-A,,J-3310,gijutsu,closed,塗装治具の寸法流用検討,涂装治具尺寸沿用研究,Paint-jig dimension reuse study,ポータル既出（mock/js/data/portal/front.js の技術報告表・取引履歴）。深穴ドリルの工具交換基準は別番号 TR-2024-064（2026-09-24 に分離。同 §2-1）
TR-2023-041,tr,2023-04-19,,SK-1190,J 社,D-092,gijutsu,closed,生産終了品の金型保管方針,停产品的模具保管方针,Mold retention policy for discontinued part,ポータル既出（mock/js/data/portal/front.js の技術報告表・取引先 J 社）。深穴ドリルの条件検討は別番号 TR-2023-063（2026-09-24 に分離。同 §2-1）
```

- `TR-2024-007` は `part_no`（SK-3310-A）・`equip_id`（PX-200）を**空にする**（KB の実体は SUS304 の深穴加工で、プレス部品 SK-3310-A にもプレス機 PX-200 にも関係しない）
- `TR-2024-102`・`TR-2023-041` は note だけを直す（件名・日付・品番・設備は不変）

### 2-3. `NC-2025-0912`／`8D-25-0912` を塗装ブツに（`records.csv` の 2・4 行）

```csv
NC-2025-0912,nc,2025-09-12,2025-09-19,SK-3310-A,K 社,,hinshitsu,open,塗装ブツによる不適合,涂装颗粒导致的不合格,Nonconformance from paint specks,台本既出（qa.js QA-01・nm.js NM-06）。K 社の受入検査で見つかった塗装ブツ（クレーム CL-25-0906）の不適合。2026-09-24 に件名と設備を訂正し旧件名の不具合は NC-2025-0904 に分離（docs/handoff/2026-09-24-script-kb-consistency.md §2-3）
8D-25-0912,nc,2025-09-12,2025-09-26,SK-3310-A,K 社,,hinshitsu,open,8D 報告（塗装ブツ）,8D 报告（涂装颗粒）,8D report for paint specks,台本既出（qa.js QA-01・en.js）。NC-2025-0912 の 8D。2026-09-24 に件名と設備を訂正（同 §2-3）
```

- 設備を `PX-200` から**空**にする（塗装ブツはプレス機の不具合ではない。塗装ラインの設備で `equipment.csv` にあるのは乾燥炉 `DO-3200` だけで、QA-01 の D4 はこれを「否定寄り（保留）」としている。設備を入れると原因を決めつけることになるので空にする）
- **note に旧件名の語（「寸法ばらつき」）を書かない**。W10 は note を照合に使わないが、人が読んで取り違えないため

#### ポータルの差し替え（PR-2。4 行）

`mock/js/data/portal/common.js`：

```diff
-    ['A-0912', 'NC-2025-0912', '初品の寸法ばらつきの 8D を出す', '陳 静', '2025-09-09', '超過 3 日', '高'],
+    ['A-0912', 'NC-2025-0912', '塗装ブツの 8D を出す', '陳 静', '2025-09-09', '超過 3 日', '高'],
-    { id: 'C-01', txt: '金型予熱の基準温度を作業標準書に反映する', src: 'NC-2025-0912 の原因調査メモ', who: '王 磊', days: 7, state: 'new', no: '' },
+    { id: 'C-01', txt: '金型予熱の基準温度を作業標準書に反映する', src: 'NC-2025-0904 の原因調査メモ', who: '王 磊', days: 7, state: 'new', no: '' },
```

`mock/js/data/portal/front.js`（列の桁揃えの空白も含めてこのとおり）：

```diff
-    ['NC-2025-0912',  '不具合',   '2025-09-12', 'SK-3310-A', 'PX-200', 'K 社', '品質保証課', '2025-09-19', '対応中'],
-    ['8D-25-0912',    '8D 報告',  '2025-09-12', 'SK-3310-A', 'PX-200', 'K 社', '品質保証課', '2025-09-26', '対応中'],
+    ['NC-2025-0912',  '不具合',   '2025-09-12', 'SK-3310-A', '—',      'K 社', '品質保証課', '2025-09-19', '対応中'],
+    ['8D-25-0912',    '8D 報告',  '2025-09-12', 'SK-3310-A', '—',      'K 社', '品質保証課', '2025-09-26', '対応中'],
-    ['TR-2024-007', '技術報告', '2024-07-03', 'SK-3310-A', 'PX-200',  '生産技術課', '完了'],
+    ['TR-2024-007', '技術報告', '2024-07-03', '—',         '—',       '生産技術課', '完了'],
```

- `—` は U+2014（既存行と同じ文字）。`PACT`・`PCAND` は ja のみのデータ（zh/en の対は無い）なので 3 言語の追加は発生しない
- 影響：ポータル「品質・不具合」から QA-01 を呼んだときの**文脈カードの設備が `PX-200` → `—` になる**（`mock/js/portal/demo.js` 108 行 `ctxEquip`）。showcase §2-2 の「文脈カードに番号・品番・設備」はこの読み替えが要る（showcase §20-4 に記載）。`front.js` 237 行の注記「設備の列は空でも構いません」がこの状態を既に説明している
- `mgmt.js` 14 行の「寸法検査・8D」は陳 静の**担当業務**の列で記録の件名ではないので触らない

#### 寸法ばらつきを参照している箇所（影響範囲）

| 箇所 | 対応 |
|---|---|
| `records.csv` 2・4 行（件名） | §2-3 で塗装ブツに訂正。寸法ばらつきは `NC-2025-0904` へ |
| `common.js` 12 行（PACT `A-0912`） | 「塗装ブツの 8D を出す」に訂正（番号は `NC-2025-0912` のまま） |
| `common.js` 54 行（PCAND `C-01` の出所） | `NC-2025-0904` へ付け替え（中身が予熱＝寸法側だから） |
| `front.js` 218・219 行（設備 PX-200） | `—` に |
| 台本（`mock/js/data/scenarios/**`） | **0 件**（変更なし） |
| KB・テスト・`docs/dify/usecases/**` | **0 件**（変更なし） |

### 2-4. 深穴の番号の差し替え（台本・KB・実装リファレンス）

置換は**「旧番号 → 新番号」の完全一致の文字列置換**で、**下表の行に限る**（同じファイルに位置ずれの意味の `NC-2024-0118` があるため。特に `kn.js` は KN-11・KN-12 の行を触らない）。

| 旧 | 新 |
|---|---|
| `NC-2024-0118` | `NC-2024-0321` |
| `TR-2023-041` | `TR-2023-063` |
| `TR-2024-102` | `TR-2024-064` |

| ファイル | 対象行（1 始まり） | 置換数（実測） | PR |
|---|---|---|---|
| `mock/js/data/scenarios/mfg/kn.js`（kn1） | 54・55・56・59・60・61 | 8（NC 4・TR-2023-041 2・TR-2024-102 2） | PR-2 |
| `mock/js/data/scenarios/mfg/dc.js`（dc3） | 156・164・170・171・175・176 | 6（NC のみ） | PR-2 |
| `mock/js/data/scenarios/mfg/pt.js`（pt3・pt8） | 115・116・117・120・121・122・325・335 | 8（NC のみ） | PR-2 |
| `mock/js/data/scenarios/mfg/eg.js`（eg1） | 24・29 | 2（TR-2023-041 のみ） | PR-2 |
| `dify/kb/KN-01/不具合報告_2026-Q2_抜粋.md` | 全行 | 6 | PR-1 |
| `dify/kb/KN-01/作業標準書_寸法検査.md` | 全行 | 6 | PR-1 |
| `dify/kb/KN-01/作業標準書_寸法検査_旧版.md` | 全行 | 1 | PR-1 |
| `dify/kb/KN-01/工程条件書_旋盤ライン3.md` | 全行 | 16 | PR-1 |
| `docs/dify/usecases/KN-01.md` | 全行 | 10 | PR-1 |
| `docs/dify/usecases/DC-03.md` | 全行 | 5 | PR-1 |
| `docs/dify/usecases/PT-03.md` | 全行 | 3 | PR-1 |
| `docs/dify/usecases/PT-08.md` | 全行 | 1 | PR-1 |
| `dify/README.md` | 76 | 2 | PR-1 |

- `dify/tests/KN-01.json`：**変更なし**（期待値にあるのは `TR-2024-007` だけで、番号は変えない。`NC-2024-0118`・`TR-2023-041`・`TR-2024-102` は期待値に無い）
- 台本の行番号は `main` = `80491a1` の値。実装前に `grep -n` で同じ行にあることを確かめてから置換する（`kn.js` の 54〜61 行が kn1 のブロック＝45〜62 行の中であること）
- 実装は「行を限定した文字列置換」で機械的に行い、**台本の他の文字を 1 文字も変えない**（行頭 `}`・末尾カンマ・U+0027 の事故を起こさないため）

`dify/kb/KN-01/**` の差分（全文。`git diff -U0` の実出力）：

```diff
--- a/dify/kb/KN-01/不具合報告_2026-Q2_抜粋.md
+++ b/dify/kb/KN-01/不具合報告_2026-Q2_抜粋.md
@@ -14 +14 @@
-あわせて、ライン 3 の SUS304 深穴加工の立ち上げにあたり参照頻度が高い過去事例 NC-2024-0118 を §3 に再掲する。
+あわせて、ライン 3 の SUS304 深穴加工の立ち上げにあたり参照頻度が高い過去事例 NC-2024-0321 を §3 に再掲する。
@@ -37 +37 @@
-### 3-1. NC-2024-0118 深穴加工 工具折損（ライン 2、2024 年 3 月）
+### 3-1. NC-2024-0321 深穴加工 工具折損（ライン 2、2024 年 3 月）
@@ -40 +40 @@
-| 文書番号 | NC-2024-0118 |
+| 文書番号 | NC-2024-0321 |
@@ -49 +49 @@
-| 関連文書 | TR-2024-007（対策条件の標準化）、TR-2024-102（工具交換基準） |
+| 関連文書 | TR-2024-007（対策条件の標準化）、TR-2024-064（工具交換基準） |
@@ -56 +56 @@
-- ライン 3 の深穴加工立ち上げでは、NC-2024-0118 の再発防止条件（ステップ送り・クーラント 2.0 MPa）が工程条件書 PC-L3-2026-014 に反映されていることを確認した。
+- ライン 3 の深穴加工立ち上げでは、NC-2024-0321 の再発防止条件（ステップ送り・クーラント 2.0 MPa）が工程条件書 PC-L3-2026-014 に反映されていることを確認した。
@@ -63 +63 @@
-| NC-2024-0118 | 2024-03 | ライン 2 | SUS304 Φ8 深穴 60 mm | 工具折損（210 本目） | 完了（6 か月再発なし） |
+| NC-2024-0321 | 2024-03 | ライン 2 | SUS304 Φ8 深穴 60 mm | 工具折損（210 本目） | 完了（6 か月再発なし） |
--- a/dify/kb/KN-01/作業標準書_寸法検査.md
+++ b/dify/kb/KN-01/作業標準書_寸法検査.md
@@ -15 +15 @@
-本書は工程条件書 PC-L3-2026-014（旋盤ライン 3）および技術報告 TR-2024-102（工具交換基準）と対で運用する。
+本書は工程条件書 PC-L3-2026-014（旋盤ライン 3）および技術報告 TR-2024-064（工具交換基準）と対で運用する。
@@ -46 +46 @@
-- 工具交換基準は TR-2024-102（2024 年、蘇州工場 ライン 2）に基づき、**200 本 または 摩耗幅 0.2 mm のいずれか早い方**とする。
+- 工具交換基準は TR-2024-064（2024 年、蘇州工場 ライン 2）に基づき、**200 本 または 摩耗幅 0.2 mm のいずれか早い方**とする。
@@ -55 +55 @@
-5. 過去の類似事例（穴径オーバー：NC-2026-0412、工具折損：NC-2024-0118）を参照し、同じ対策で解決するかを確認する。
+5. 過去の類似事例（穴径オーバー：NC-2026-0412、工具折損：NC-2024-0321）を参照し、同じ対策で解決するかを確認する。
@@ -70 +70 @@
-| TR-2024-102 | 深穴ドリルの工具交換基準の設定 | 工具交換基準の根拠 |
+| TR-2024-064 | 深穴ドリルの工具交換基準の設定 | 工具交換基準の根拠 |
@@ -72 +72 @@
-| NC-2024-0118 | 深穴加工 工具折損（ライン 2、2024 年 3 月） | 規格外時の参照事例 |
+| NC-2024-0321 | 深穴加工 工具折損（ライン 2、2024 年 3 月） | 規格外時の参照事例 |
@@ -79 +79 @@
-| D | 2026-06-25 | ライン 3 を適用範囲に追加、§5 工具摩耗の確認を TR-2024-102 に合わせて改訂 | 陳 / 王 |
+| D | 2026-06-25 | ライン 3 を適用範囲に追加、§5 工具摩耗の確認を TR-2024-064 に合わせて改訂 | 陳 / 王 |
--- a/dify/kb/KN-01/作業標準書_寸法検査_旧版.md
+++ b/dify/kb/KN-01/作業標準書_寸法検査_旧版.md
@@ -41 +41 @@
-- Rev.D（2026-06-25、現行）：旋盤ライン 3 を適用範囲に追加、工具摩耗の確認を TR-2024-102 に合わせて改訂。
+- Rev.D（2026-06-25、現行）：旋盤ライン 3 を適用範囲に追加、工具摩耗の確認を TR-2024-064 に合わせて改訂。
--- a/dify/kb/KN-01/工程条件書_旋盤ライン3.md
+++ b/dify/kb/KN-01/工程条件書_旋盤ライン3.md
@@ -14 +14 @@
-本条件書は、旋盤ライン 3 で新たに立ち上げる SUS304 系材質の深穴ドリル加工について、蘇州工場 ライン 2 の実績（技術報告 TR-2023-041、TR-2024-007、TR-2024-102）を転用して暫定条件を定めるものである。
+本条件書は、旋盤ライン 3 で新たに立ち上げる SUS304 系材質の深穴ドリル加工について、蘇州工場 ライン 2 の実績（技術報告 TR-2023-063、TR-2024-007、TR-2024-064）を転用して暫定条件を定めるものである。
@@ -32,6 +32,6 @@
-| 1 | 切削速度 Vc | 18〜22 m/min（標準 20 m/min） | TR-2023-041、TR-2024-007 |
-| 2 | 送り f | 0.06 mm/rev | TR-2023-041、TR-2024-102 |
-| 3 | ステップ送り | 深さ 3D（24 mm）ごとに一旦抜く | TR-2024-007、NC-2024-0118 |
-| 4 | クーラント | 内部給油 2.0 MPa 以上（水溶性、濃度 8〜10%） | TR-2024-007、NC-2024-0118 |
-| 5 | 工具 | 超硬コーティングドリル Φ8（L/D = 8、TiAlN） | TR-2024-102 |
-| 6 | 工具交換基準 | 200 本 または 摩耗幅 0.2 mm のいずれか早い方 | TR-2024-102 |
+| 1 | 切削速度 Vc | 18〜22 m/min（標準 20 m/min） | TR-2023-063、TR-2024-007 |
+| 2 | 送り f | 0.06 mm/rev | TR-2023-063、TR-2024-064 |
+| 3 | ステップ送り | 深さ 3D（24 mm）ごとに一旦抜く | TR-2024-007、NC-2024-0321 |
+| 4 | クーラント | 内部給油 2.0 MPa 以上（水溶性、濃度 8〜10%） | TR-2024-007、NC-2024-0321 |
+| 5 | 工具 | 超硬コーティングドリル Φ8（L/D = 8、TiAlN） | TR-2024-064 |
+| 6 | 工具交換基準 | 200 本 または 摩耗幅 0.2 mm のいずれか早い方 | TR-2024-064 |
@@ -42 +42 @@
-- ステップ送りなしの連続加工で工具折損が発生した記録がある（NC-2024-0118、2024 年 3 月、ライン 2、加工数 210 本目）。ステップ送りは省略しない。
+- ステップ送りなしの連続加工で工具折損が発生した記録がある（NC-2024-0321、2024 年 3 月、ライン 2、加工数 210 本目）。ステップ送りは省略しない。
@@ -48,2 +48,2 @@
-| SUS304 / Φ6 / 深さ 45 mm | TR-2023-041 §4 | 20〜24 m/min | 0.05 mm/rev | 径が異なる。Φ8 にはそのまま使わない |
-| SUS304 / Φ10 / 深さ 50 mm | TR-2024-102 §5 | 18〜20 m/min | 0.08 mm/rev | 径が異なる。L/D = 5 |
+| SUS304 / Φ6 / 深さ 45 mm | TR-2023-063 §4 | 20〜24 m/min | 0.05 mm/rev | 径が異なる。Φ8 にはそのまま使わない |
+| SUS304 / Φ10 / 深さ 50 mm | TR-2024-064 §5 | 18〜20 m/min | 0.08 mm/rev | 径が異なる。L/D = 5 |
@@ -62 +62 @@
-| TR-2023-041 | SUS304 深穴ドリル加工 条件検討（Φ6〜Φ8） | 蘇州工場 / ライン 2 | 2023 | Vc 18〜22 m/min、f 0.06 mm/rev で安定。Φ6 は f 0.05 |
+| TR-2023-063 | SUS304 深穴ドリル加工 条件検討（Φ6〜Φ8） | 蘇州工場 / ライン 2 | 2023 | Vc 18〜22 m/min、f 0.06 mm/rev で安定。Φ6 は f 0.05 |
@@ -64,2 +64,2 @@
-| TR-2024-102 | 深穴ドリルの工具交換基準の設定 | 蘇州工場 / ライン 2 | 2024 | 超硬コーティングドリル Φ8（L/D = 8）で 200 本 または 摩耗幅 0.2 mm を交換基準に |
-| NC-2024-0118 | 深穴加工 工具折損（ライン 2） | 蘇州工場 / ライン 2 | 2024 | ステップ送りなし・クーラント 1.5 MPa で 210 本目に折損。対策後 6 か月再発なし |
+| TR-2024-064 | 深穴ドリルの工具交換基準の設定 | 蘇州工場 / ライン 2 | 2024 | 超硬コーティングドリル Φ8（L/D = 8）で 200 本 または 摩耗幅 0.2 mm を交換基準に |
+| NC-2024-0321 | 深穴加工 工具折損（ライン 2） | 蘇州工場 / ライン 2 | 2024 | ステップ送りなし・クーラント 1.5 MPa で 210 本目に折損。対策後 6 か月再発なし |
@@ -73 +73 @@
-| B | 2026-06-20 | §4 参考条件を追加、工具交換基準を TR-2024-102 に合わせて明記 | 王 / 李 |
+| B | 2026-06-20 | §4 参考条件を追加、工具交換基準を TR-2024-064 に合わせて明記 | 王 / 李 |
```

- KB のファイル名は**変えない**（実機への反映は `kb_refresh`＝同名文書の中身だけ差し替え。§8 PR-1r）

### 2-5. 世界マスタの付帯更新（PR-1）

`data/world/mfg/calendar.md` 30・31 行（例の列だけ。書式の列は変えない＝W6 の判定は不変）：

```diff
-| `TR-YYYY-NNN` | 技術報告 | `TR-2024-007`(10) `TR-2023-041`(2) `TR-2024-102`(2) |
-| `NC-YYYY-NNNN` | 不具合（Nonconformance） | `NC-2024-0118`(18) `NC-2025-0912`(2) ほか |
+| `TR-YYYY-NNN` | 技術報告 | `TR-2024-007`(10) `TR-2023-041`(2) `TR-2024-102`(2) `TR-2023-063` `TR-2024-064`（深穴ドリル。2026-09-24 に分離） |
+| `NC-YYYY-NNNN` | 不具合（Nonconformance） | `NC-2024-0118`(18) `NC-2025-0912`(2) `NC-2024-0321`（深穴の折損）`NC-2025-0904`（初品の寸法ばらつき）ほか。件名の正本は `records.csv`、件名の固定語は `record_terms.csv`（W10） |
```

`data/world/README.md` 33 行（件数が既に古い＝実数 35 件。本設計で 39 件）：

```diff
-| `records.csv` | 品質・受注出荷の案件台帳 19 件（不具合・クレーム・変更要求・技術報告・引合・受注・出荷/通関。`docs/handoff/2026-09-12-portal-industry-rev4.md` §6-2 で新設） |
+| `records.csv` | 品質・受注出荷の案件台帳 39 件（不具合・クレーム・変更要求・技術報告・引合・受注・出荷/通関・ヒヤリハット・巡回・修理・棚卸・購買申請。`docs/handoff/2026-09-12-portal-industry-rev4.md` §6-2 で新設。2026-09-24 に深穴ドリルの 3 件と初品の寸法ばらつき 1 件を追加し、`TR-2024-007`・`NC-2025-0912`・`8D-25-0912` の件名を訂正＝`docs/handoff/2026-09-24-script-kb-consistency.md` §2） |
```

### 2-6. `portal/seed` の再生成は**要らない**

- 理由：`records.csv`・`PACT`・`PCAND`・`front.js`・`SVCS[].desc` はいずれも `gen-seed.mjs` の入力ではない（§1-1）
- 実走：全変更を入れた作業用コピーで `node portal/tools/check-seed-fresh.mjs` → `✅ PASS: portal/seed/** は正本から再生成した内容とバイト一致`
- `portal/**` は 1 バイトも触らない（CLAUDE.md §2-14）。`npm run portal:test` は不要

### 2-7. W10「同じ記録番号が台本・KB・テスト・ポータルで別の件名を指していないか」（PR-3）

#### 方式（緩い照合）

1. **件名の正本**は `records.csv`。**件名の固定語**を新設の `data/world/mfg/record_terms.csv` に置く（`record_id,terms_ja,terms_zh`。語は `;` 区切り）。**ツールに語彙も業種もハードコードしない**（#251 の方針）。`records.csv` と `record_terms.csv` の両方がある業種だけ検査し、無い業種は理由を出して skip（いまは `mfg` のみ）
2. **W10-a**：`record_terms.csv` のどの語も `title_ja`／`title_zh` に出てこない番号を warn（件名か語のどちらかが誤っている。今回の `TR-2024-007`〔件名 E-47〕を捕まえる）
3. **W10-b**：走査対象の中で番号が出るたびに、**近傍（前 30 字・後 60 字。改行・JS 文字列内の `\n`・「。」・別の番号で打ち切る）**を取り、語彙（全番号の語の和集合）が出ていて、**そのどれもが当の番号の語でない**ときだけ warn。当の番号の語＝その番号の `record_terms.csv` の語 ＋ 件名（`title_*`）に含まれる語彙。**note は使わない**（訂正の経緯として旧件名を note に書くと、その語が「自分の語」になり食い違いを隠すため）
4. 走査対象：`mock/js/data/scenarios/<業種>/**`・`mock/js/data/portal/**`・`dify/kb/**`・`dify/tests/**`。JS のブロックコメントは除く（W6 と同じ）。**`docs/**` は対象外**（過去の設計書・手渡しメモは旧番号を記録として残すため）。`scripts/**`・`dify/results/**` も対象外（固定の入力・実機の記録）
5. warn のみ・CI に入れない（`check-world.mjs` の既存方針。`--strict` では exit 1）

#### `data/world/mfg/record_terms.csv`（新設。全文）

```csv
record_id,terms_ja,terms_zh
NC-2025-0912,塗装ブツ;ブツ,涂装颗粒
8D-25-0912,塗装ブツ;ブツ,涂装颗粒
CL-25-0906,塗装ブツ;ブツ,涂装颗粒
CL-25-0906-02,タップ不通,丝锥不通
NC-2025-0904,寸法ばらつき;予熱,尺寸波动;预热
NC-2024-0118,位置ずれ;予熱;D-118,定位偏移;预热
NC-2024-0321,折損;ステップ送り;切りくず詰まり,断刀;分段进给;切屑堵塞
TR-2024-007,切削速度;クーラント;深穴,切削速度;冷却液;深孔
TR-2023-063,条件検討;深穴,条件研究;深孔
TR-2024-064,工具交換;交換基準,换刀
TR-2024-102,塗装治具;治具;J-3310,涂装治具;治具
TR-2023-041,金型保管;D-092;生産終了,模具保管;停产
```

- 対象は「件名の取り違えが起きた／起きやすい」12 番号だけ（全 39 件ではない）。語の無い番号は W10 の対象外
- `NC-2025-0904` に `予熱` を入れるのは、ポータル `PCAND C-01`（金型予熱…）がこの番号を出所にしているため（原因が予熱の確認抜け＝note どおり）

#### `tools/check-world.mjs` への追加（全文。`runIndustryChecks()` の末尾、`worldCache[ind] = { ...w6Result, knownParts, knownEquip };` の**直前**に挿入）

```js
  /* ---------------------------------------------------------- */
  // W10（docs/handoff/2026-09-24-script-kb-consistency.md §2-7）：同じ記録番号が台本・KB・テスト・
  // ポータルで別の件名を指していないか。records.csv（件名の正本）と record_terms.csv（件名の固定語）が
  // 両方ある業種だけ検査する（業種・語彙をこのファイルにハードコードしない）。
  // 照合は緩い：番号の近傍（前 30 字・後 60 字。改行・「\n」・「。」・別の記録番号で打ち切る）に
  // 語彙（record_terms.csv の全語の和集合）のどれかが出ていて、そのどれもが当の番号の語
  // （record_terms.csv の語 ＋ 件名 title_* に含まれる語）でないときだけ warn にする（W10-b）。
  {
    const records = readCSV(dir, 'records.csv');
    const termsRows = readCSV(dir, 'record_terms.csv');
    if (!records.length || !termsRows.length) {
      section(`[${ind}] W10. 記録番号の件名：records.csv / record_terms.csv が無いため skip`);
      skip('records.csv と record_terms.csv の両方がある業種だけ検査する');
    } else {
      section(`[${ind}] W10. 記録番号の件名：台本・KB・テスト・ポータルで同じ番号が別の件名を指していないか`);
      const recById = new Map(records.map(r => [r.record_id, r]));
      const termsById = new Map();
      const unknownIds = [];
      for (const t of termsRows) {
        if (!recById.has(t.record_id)) { unknownIds.push(t.record_id); continue; }
        const words = [t.terms_ja, t.terms_zh].join(';').split(';').map(s => s.trim()).filter(Boolean);
        termsById.set(t.record_id, words);
      }
      if (unknownIds.length) report(`record_terms.csv に records.csv に無い番号: ${unknownIds.join('、')}`);
      const vocab = [...new Set([...termsById.values()].flat())];
      // 当の番号の語＝record_terms.csv の語 ＋ 件名（title_*）に含まれる語彙。note は含めない
      // （訂正の経緯として旧件名を note に書くと、その語が「自分の語」になり食い違いを隠すため）
      const ownOf = (id) => {
        const r = recById.get(id);
        const hay = [r.title_ja, r.title_zh, r.title_en].join(' ');
        return new Set([...(termsById.get(id) || []), ...vocab.filter(w => hay.includes(w))]);
      };
      // W10-a：record_terms.csv の語が 1 つも件名に出てこない番号（件名と語のどちらかが誤っている）
      const titleMiss = [...termsById.entries()]
        .filter(([id, words]) => { const r = recById.get(id); const t = [r.title_ja, r.title_zh].join(' '); return !words.some(w => t.includes(w)); })
        .map(([id, words]) => `${id}: 件名「${recById.get(id).title_ja}」に record_terms.csv の語（${words.join('／')}）が 1 つも無い`);
      reportMany('W10-a 件名と record_terms.csv の語が合わない', titleMiss);
      const idAlt = [...recById.keys()].sort((a, b) => b.length - a.length).map(escLit).join('|');
      const idRe = new RegExp(`(?<![A-Za-z0-9-])(${idAlt})(?![A-Za-z0-9-])`, 'g');
      const anyIdRe = /(?<![A-Za-z0-9])[A-Z0-9]{1,4}-\d{2,4}(?:-[A-Z0-9]{1,4})?(?![A-Za-z0-9])/g;
      const cut = (s, fromEnd) => {
        // 改行・「\n」（JS 文字列内のエスケープ）・「。」・別の番号で打ち切る
        const parts = s.split(/\n|\\n|。/);
        let w = fromEnd ? parts[parts.length - 1] : parts[0];
        const ids = [...w.matchAll(anyIdRe)];
        if (ids.length) w = fromEnd ? w.slice(ids[ids.length - 1].index + ids[ids.length - 1][0].length) : w.slice(0, ids[0].index);
        return w;
      };
      const portalFiles = walkFiles(resolve(ROOT, 'mock/js/data/portal'), ['.js'])
        .map(p => ({ src: p.replace(ROOT + '/', ''), text: readFileSync(p, 'utf8') }));
      const w10Texts = [
        ...mock.dataSources.filter(f => f.path.includes(`/scenarios/${ind}/`)).map(f => ({ src: 'mock/' + f.path, text: f.src })),
        ...portalFiles, ...kbFiles, ...testFiles,
      ].map(f => ({ src: f.src, text: f.src.endsWith('.js') ? f.text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')) : f.text }));
      const hits = [];
      for (const f of w10Texts) {
        for (const m of f.text.matchAll(idRe)) {
          const id = m[1];
          if (!termsById.has(id)) continue;
          const before = cut(f.text.slice(Math.max(0, m.index - 30), m.index), true);
          const after = cut(f.text.slice(m.index + id.length, m.index + id.length + 60), false);
          const win = before + ' ' + after;
          const found = vocab.filter(w => win.includes(w));
          if (!found.length) continue;
          const own = ownOf(id);
          if (found.some(w => own.has(w))) continue;
          const line = f.text.slice(0, m.index).split('\n').length;
          hits.push(`${id} @ ${f.src}:${line} 近傍に「${found.join('／')}」— records.csv の件名は「${recById.get(id).title_ja}」`);
        }
      }
      const uniq = [...new Set(hits)];
      reportMany('W10-b 番号の近傍の語が records.csv の件名・record_terms.csv の語と合わない', uniq);
      if (!uniq.length) ok(`記録番号 ${termsById.size} 件の近傍の語はすべて records.csv の件名と一致（該当なしを含む）`);
    }
  }
```

あわせて同ファイル冒頭コメントの検査一覧（84 行 `W9 カバレッジ…` の次）に 1 項を足す：

```js
 *   W10 記録番号の件名：records.csv の件名と record_terms.csv の固定語を正として、台本・ポータル・KB・テストで
 *      番号の近傍に別の番号の語だけが出ていないか（緩い照合。docs/handoff/2026-09-24-script-kb-consistency.md §2-7）。
 *      records.csv と record_terms.csv の両方がある業種だけ。docs/** は対象外
```

`data/world/README.md` の 186 行「W1〜W9 の検査を行い」→「W1〜W10 の検査を行い」、33 行の表の直後に 1 行：

```md
| `record_terms.csv` | 記録番号ごとの「件名の固定語」（ja/zh。`;` 区切り）。`tools/check-world.mjs` W10 が、台本・ポータル・KB・テストで番号の近くに別の番号の語だけが出ていないかを見るのに使う（`docs/handoff/2026-09-24-script-kb-consistency.md` §2-7）。全件ではなく取り違えやすい番号だけを載せる |
```

#### 実走件数（作業用コピー）

| 状態 | W10-a | W10-b | その他 | mfg 合計 | 全体合計 |
|---|---|---|---|---|---|
| `main` のまま（W10 と `record_terms.csv` だけ入れた） | 3 | 12 | 1（`record_terms.csv` に `records.csv` に無い番号 4 件） | 26 | 28 |
| `main` ＋ 新番号 4 行だけ入れた（**修正前の実力**） | **3** | **30** | 0 | 43 | **45** |
| 本設計の全変更後 | **0** | **0** | 0 | **10** | **12** |

- 修正前 33 件の内訳：W10-a 3 件（`NC-2025-0912`・`8D-25-0912`・`TR-2024-007` の件名）、W10-b 30 件（`NC-2024-0118` を折損の意味で使う台本 15 か所〔`kn.js` 2・`dc.js` 5・`pt.js` 8〕、`NC-2025-0912` の `common.js` 54 行 1、KB 14 か所）
- **拾えないもの（緩い照合の限界）**：番号が語を伴わずに並ぶだけの箇所（例：kn1 の「過去の技術報告 3 件（TR-2023-041、TR-2024-007、TR-2024-102）から推奨条件…」）。この種は §2-4 の行指定置換で潰し、W10 には頼らない
- **全変更後の合計 12 件は `CLAUDE.md` §2-13 の「現状 12 件（製造 10／金融 1／IT 1）」と一致**。したがって **PR-3 は PR-1・PR-2 のマージ後に出す**（先に入れると合計が 12 を超え、§2-13 の記述と食い違う）

---

## §3. 項目 2：KN-03 の年休未消化の精算を「日給の 300%（うち 100% は通常の賃金）」に

**法令の条文番号・官庁名は書かない。**架空の社内規程が「法定基準」を参照している体のまま、数値の言い方だけを揃える。

### 3-1. KB（PR-1。3 ファイル・各 1 か所）

`dify/kb/KN-03/就業規則_抜粋_日本語版.md` 49 行：

```diff
-4. 繰越分を翌年度中に使用しなかった場合、会社は法定基準（日給の 200%）により未使用分を精算する。精算対象は繰越分のみとし、当年度の新規付与分は対象としない。
+4. 繰越分を翌年度中に使用しなかった場合、会社は法定基準により、未使用分を日給の 300%（うち 100% は通常の賃金として支払済み）で精算する。精算対象は繰越分のみとし、当年度の新規付与分は対象としない。
```

`dify/kb/KN-03/员工手册_摘录_中文版.md` 49 行：

```diff
-4. 结转部分若在次年度内未使用完毕，公司按法定标准（日工资的200%）对未使用部分进行结算。结算仅针对结转部分，当年度新授予部分不适用。
+4. 结转部分若在次年度内未使用完毕，公司按法定标准，以日工资的300%（其中100%已作为正常工资支付）对未使用部分进行结算。结算仅针对结转部分，当年度新授予部分不适用。
```

`dify/kb/KN-03/员工手册_旧版_2023年7月版_中文.md` 27 行（旧版も同じ条。直さないと「精算の率も版で違う」という**意図しない版ズレ**が生まれ、KN-03 の「差分は繰越上限 3→5 日だけ」という筋が崩れる）：

```diff
-4. 结转部分若在次年度内未使用完毕，公司按法定标准（日工资的200%）对未使用部分进行结算。
+4. 结转部分若在次年度内未使用完毕，公司按法定标准，以日工资的300%（其中100%已作为正常工资支付）对未使用部分进行结算。
```

### 3-2. 台本（PR-2。`mock/js/data/scenarios/mfg/kn.js` の kn3。`script` は ja/zh のみ）

| 箇所 | 旧（完全一致で 1 回） | 新 |
|---|---|---|
| `script.ja[1].a`（93 行） | `会社は法定基準（日給の 200%）で未使用分を精算する` | `会社は法定基準により、未使用分を日給の 300%（うち 100% は通常の賃金として支払済み）で精算する` |
| `script.zh[1].a`（98 行） | `公司按法定标准（日工资的200%）结算未使用部分` | `公司按法定标准，以日工资的300%（其中100%已作为正常工资支付）结算未使用部分` |
| `script.ja[2].a`（94 行）と `script.zh[2].a`（99 行）の回答文（中国語） | `公司将按日工资200%进行结算（第23条第4款）`（**2 回**） | `公司将按日工资的300%进行结算（其中100%已作为正常工资支付；第23条第4款）` |

- `steps`（ja/zh/en）は精算に触れていないので変更なし。`en` の文言は発生しない

### 3-3. テスト（PR-1。`dify/tests/KN-03.json`）

`KN-03 T02` の直後に 1 件追加し、`source` を更新する（値を実機テストで固定する。「KB と台本とテストは同じ値」）：

```json
    {
      "id": "KN-03 T03",
      "kind": "正常 ja（追い質問）",
      "mode": "chat",
      "inputs": {},
      "query": "繰越分を使い切れなかったらどうなる？",
      "expect": [
        [
          "第23条",
          "第 23 条"
        ],
        "300",
        [
          "通常の賃金",
          "100%"
        ]
      ],
      "expect_not": [
        "日給の 200%",
        "日給の200%"
      ],
      "expect_lang": "ja",
      "lang_allow": [],
      "lang_note": ""
    },
```

```diff
-  "source": "docs/dify/usecases/KN-03.md §7（T01 正常 ja / T02 正常 zh / T04 境界（版ズレなし） / T08 安全（PIPL））",
+  "source": "docs/dify/usecases/KN-03.md §7（T01 正常 ja / T02 正常 zh / T03 正常 ja（追い質問） / T04 境界（版ズレなし） / T08 安全（PIPL））",
```

- テストを足すと `docs/service-map.md` の KN-03 行（テスト件数）が変わる → **PR-1 で `npm run index` を実行**（しないと verify §11 が FAIL する。作業用コピーで確認済み）
- 実機の T03 は **KB を差し替えるまで落ちる**（実機の KB はまだ 200%）。§8 の PR-1r（`run:runner`）で `kb_refresh` → `run_tests` の順に回す

### 3-4. 実装リファレンス（PR-1。`docs/dify/usecases/KN-03.md` 150 行）

```diff
-| `KN-03 T03` | 正常 ja（追い質問） | 「繰越分を使い切れなかったらどうなる？」 | 第 23 条 4 項、休暇管理細則 第 5 条を引く | 人手 |
+| `KN-03 T03` | 正常 ja（追い質問） | 「繰越分を使い切れなかったらどうなる？」 | 第 23 条 4 項（日給の 300%、うち 100% は通常の賃金として支払済み）、休暇管理細則 第 5 条を引く | 人手＋自動 |
```

---

## §4. 項目 4：`desc` の更新 3 件（PR-2。`mock/js/data/catalog.js`。3 言語同時・implementer は翻訳しない）

- `en` に U+0027（`'`）を**新たに入れない**（既存の `veteran\'s` はそのまま）。`en` の文末に `document.` を作らない（verify §1-B）。かな・漢字を `en` に入れない
- `regress` は `desc` を数えない → 件数不変（§7 で実走確認）。`portal/seed` も `desc` を持たない（§2-6）

### 4-1. DC-03（`dc3`。最終文だけ差し替え）

| 言語 | 旧（最終文） | 新（最終文） |
|---|---|---|
| ja | 文書として残っていないベテランの手順や勘所は、聞き取りの音声を取り込んで教材と手順書のドラフトに起こすことを想定しています。 | 文書として残っていないベテランの手順や勘所は、聞き取りから記録化するサービス（KN-11）で本人の確認を経た技術メモを取り込んで、教材に反映します。 |
| zh | 对于尚未形成文档的资深员工的操作要领与经验，设想通过导入访谈录音，生成教材与作业指导书草案。 | 对于尚未形成文档的资深员工的操作要领与经验，导入经访谈记录化服务（KN-11）整理并经本人确认的技术备忘，反映到教材中。 |
| en | Where a veteran\'s know-how exists only in their head, recorded interviews are expected to be taken in and turned into draft training material and work instructions. | Know-how that veterans have never written down comes in as technical memos from the interview capture service (KN-11), already checked by the veteran, and is reflected in the training material. |

差し替え後の `desc` 全文：

```js
    desc: { ja: '作業標準書・過去の不具合事例・安全ルールから、新人・異動者向けの教育資料（スライド・確認テスト・OJT チェックリスト）を作成します。作業者の母語に合わせて中国語版を主にし、監督者向けに日本語版を添えるといった出し分けができます。文書として残っていないベテランの手順や勘所は、聞き取りから記録化するサービス（KN-11）で本人の確認を経た技術メモを取り込んで、教材に反映します。',
            zh: '基于作业标准书、历史不良案例与安全规则，生成面向新人与调岗人员的培训资料（课件、确认测试、OJT检查表）。可按对象区分输出：作业者用中文版，监督者附日文版。对于尚未形成文档的资深员工的操作要领与经验，导入经访谈记录化服务（KN-11）整理并经本人确认的技术备忘，反映到教材中。',
            en: 'Creates training decks, quizzes and OJT checklists for new and transferred staff from work standards, past defects and safety rules. Outputs Chinese for operators and Japanese for supervisors as needed. Know-how that veterans have never written down comes in as technical memos from the interview capture service (KN-11), already checked by the veteran, and is reflected in the training material.' } },
```

### 4-2. KN-11（`kn11`。「聞き取れなかった箇所…」の文の直後に 1 文追加）

| 言語 | 追加する 1 文 |
|---|---|
| ja | 判断の手がかりが聞けていない所は「次の聞き取りで聞くこと」として返し、登録は本人の確認を経てから行います。 |
| zh | 尚未问到判断依据的部分作为「下次访谈要问的问题」返回，登记须经本人确认后再进行。 |
| en | Where the cues behind a judgment were not captured, they come back as questions for the next interview, and nothing is registered until the veteran has checked it. |

- 語は台本に合わせた（`kn.js` kn11 の `次の聞き取りで聞くこと`／`下次访谈要问的问题`）

差し替え後の `desc` 全文：

```js
    desc: { ja: '文書に残っていないベテランの手順・勘所・判断基準を、聞き取りの音声から文字起こしして構造化し、手順書のドラフトに起こします。同じ作業について現行の標準・旧版の標準・本人の発言の 3 つを日付つきで並べ、改訂の経緯からどれを正とするかを人が決められる形で示します。発言が現行の標準と食い違う場合は、勝手に上書きせず改訂の候補として残します。聞き取れなかった箇所は推測で埋めず、位置を残したまま聞き直しの対象として返します。判断の手がかりが聞けていない所は「次の聞き取りで聞くこと」として返し、登録は本人の確認を経てから行います。出力はナレッジへの登録提案（新規作成、または既存文書への修正依頼）まで作ります。',
            zh: '将尚未形成文档的资深员工的操作步骤、要领与判断标准，通过访谈录音转写并结构化，生成作业指导书草案。针对同一项作业，把现行标准、旧版标准与本人口述三者按日期并列呈现，依据修订经过让人来判断以哪一个为准。若口述与现行标准不一致，不擅自覆盖，而是作为修订候选保留。未能听清的部分不做推测填补，保留其位置并作为需要回访确认的对象返回。尚未问到判断依据的部分作为「下次访谈要问的问题」返回，登记须经本人确认后再进行。输出可一直做到知识库的登记提案（新建，或对既有文档提出修改申请）。',
            en: 'Turns a veteran\'s undocumented steps, knacks and judgment criteria into a draft work instruction by transcribing and structuring a recorded interview. For the same task it lines up the current standard, the superseded standard and the veteran\'s own words with their dates, so that a person can decide which one governs from the revision history. Where the veteran contradicts the current standard, it is kept as a candidate revision rather than silently overwriting it. Passages that could not be heard are left in place for a follow-up question instead of being guessed at. Where the cues behind a judgment were not captured, they come back as questions for the next interview, and nothing is registered until the veteran has checked it. The output goes as far as a proposal to register the result in the knowledge base — either a new entry or a change request against the existing standard.' } },
```

### 4-3. EN-03（`en3`。最終文に「手書きの朱書きがある図面」を足す）

| 言語 | 旧（最終文） | 新（最終文） |
|---|---|---|
| ja | 入力は CAD から出力した図面ファイルに限らず、紙図面のスキャンや現場で撮影した写真からの読み取りも想定しています。 | 入力は CAD から出力した図面ファイルに限らず、紙図面のスキャンや現場で撮影した写真、手書きの朱書きがある図面からの読み取りも想定しています。 |
| zh | 输入不限于从CAD导出的图纸文件，也设想支持纸质图纸扫描件与现场拍摄照片的读取。 | 输入不限于从CAD导出的图纸文件，也设想支持纸质图纸扫描件、现场拍摄照片以及带有手写红笔批注的图纸的读取。 |
| en | Inputs are not limited to CAD drawing files: scanned paper drawings and photos taken on site are also in scope. | Inputs are not limited to CAD drawing files: scanned paper drawings, photos taken on site and drawings with handwritten red-pen markups are also in scope. |

- 語は台本に合わせた（`en.js` en3 の `朱書き`／`手写红笔批注`）

差し替え後の `desc` 全文：

```js
    desc: { ja: '新規引合の図面を入力すると、形状・寸法・材質・加工要件が近い過去の図面を検索し、その製品の工程・原価・不具合履歴を提示します。見積の初期検討や、既存治具・金型の流用可否判断に使います。入力は CAD から出力した図面ファイルに限らず、紙図面のスキャンや現場で撮影した写真、手書きの朱書きがある図面からの読み取りも想定しています。',
            zh: '输入新询价的图纸后，检索形状、尺寸、材质、加工要求相近的历史图纸，并给出该产品的工艺、成本与不良履历。用于报价初期评估以及既有治具、模具能否沿用的判断。输入不限于从CAD导出的图纸文件，也设想支持纸质图纸扫描件、现场拍摄照片以及带有手写红笔批注的图纸的读取。',
            en: 'Given a drawing from a new inquiry, finds past drawings with similar geometry, dimensions, material and machining requirements and shows their process, cost and defect history. Supports early quoting and jig/mold reuse decisions. Inputs are not limited to CAD drawing files: scanned paper drawings, photos taken on site and drawings with handwritten red-pen markups are also in scope.' } },
```

---

## §5. 項目 5：運用

### 5-1. runbook の口上 2 文（**PR-0 で architect が書いた**）

`docs/demo/runbook-showcase-mfg.md`：

- 幕 1（57 行の直後）：`- 言う：「AI が迷った所だけ、書いた本人に聞きます」`
- 幕 2（70 行の直後）：`- 言う：「聞き手は直属の上司ではなく、教育担当の王主任です」`

他の行は触っていない。**57 行「確信度の低い 1 項目を人が原票で確定」は #340 の後では誤り（2 項目・記入者本人）**だが、PM の指示範囲（各 1 文の追加）を超えるので直していない → §9 Q2。

### 5-2. `作業標準書_寸法検査.md` の Rev.D の日付 —— **「日付だけ」は版の順序を壊す。PM 判断に戻す（§9 Q1）**

指示どおり Rev.D（2026-06-25）だけを世界の「今日」（2025-09 前後）より前に動かすと、**Rev.C（2025-11-10）が Rev.D より後になる**。さらに Rev.D の本文は 2026 年の文書（`PC-L3-2026-014` Rev.A 2026-05-12、`NC-2026-0619`、`QR-2026-Q2-05`）を参照しているので、**日付だけを 2025 年に下げると「2025 年 8 月の版が 2026 年の文書を引く」**になり、現状（KN-01 の KB 全体が 2026 年で一貫、世界の今日とだけ 1 年ずれ）より悪くなる。

| 案 | 差分 | 結果 |
|---|---|---|
| **A'（日付だけ＋Rev.C）** | `作業標準書_寸法検査.md` 8・79 行 `2026-06-25`→`2025-08-25`、78 行 `2025-11-10`→`2025-06-10`。`…_旧版.md` 30・40 行 `2025-11-10`→`2025-06-10`、41 行 `2026-06-25`→`2025-08-25`（計 6 か所） | 版の順序（B 2025-04-02 → C 2025-06-10 → D 2025-08-25）は保てる。**Rev.D が 2026 年の文書 3 件を参照する矛盾が新たに生まれる** |
| B（KN-01 の KB 全体を 1 年前倒し） | 6 ファイルの `2026`→`2025`（45 か所）＋番号 `PC-L3-2026-014`→`PC-L3-2025-014`・`QR-2026-Q2-05`→`QR-2025-Q2-05`・`NC-2026-0412/0507/0619`→`NC-2025-…`、ファイル名 `不具合報告_2026-Q2_抜粋.md` の改名（実機 KB の文書名が変わる＝`kb_replace` が要る）、`eg.js` eg1 の `PC-L3-2026-014`、`calendar.md` の例。Rev.C・Rev.B も 1 年前倒し | 世界の今日と一致する。**規模が大きく、実機 KB の文書を削除して入れ直す**（`kb_replace` は 1 件ずつ・歯止めあり） |
| **C（変えない。未統一として記録）** 推奨 | `data/world/mfg/calendar.md` の「世界の『今日』」の未統一の段落（18〜21 行）に 1 文を足す：「`dify/kb/KN-01/**` は 2026 年 4〜7 月の出来事として一貫して書かれている（Rev.D 2026-06-25・`PC-L3-2026-014`・`QR-2026-Q2-05`）。実機デモ（Dify Cloud）は現実の日付で行うため、KB は現実の日付に近い方が不自然さが少ない。台本（kn1）は日付を出さないので矛盾は表に出ない。」 | 矛盾は記録として残る。実機のデモ（現実の今日＝2026-09）では KB の日付がむしろ自然 |

- `dify/tests/KN-01.json` に日付の期待値は無いので、どの案でもテストは変わらない
- **推奨は C**。理由：実機の KN-01 は現実の日付（2026 年）で動いている相手に見せるもので、KB の「最近の版」が 2026 年 6 月であることが自然。モックの台本は日付を出さない（#342 で意図的にそうした）。A' は矛盾を増やし、B は実機 KB の入れ直しを伴う割に見える効果が無い

### 5-3. KN-03 の規程に周知日を足すか —— **足さない**

**理由（1 行）**：kn3 の「承認・周知の記録は文書に無い。正式回答の前に確認を」は、AI が**分からないことを分からないと言う**実演そのもので、周知日を書き足すとこの見せ場が消えるため。`dify/kb/KN-03/**` の版情報は変更しない（§3 の精算の値だけを変える）。

---

## §6. 触らない範囲（明示）

- **`NC-2024-0118` を位置ずれの意味で使う箇所すべて**：`kn.js` の kn11・kn12（181 行以降）、`front.js` 223 行、`tools/gen-demo-assets.mjs`、`mock/assets/demo/**`（PDF の本文も）、`data/world/mfg/documents.csv`・`equipment.csv`
- `mock/js/data/portal/front.js` 52・117・231・232 行（`TR-2023-041`／`TR-2024-102` の金型保管・塗装治具の意味。`records.csv` と一致している）
- `mock/js/data/portal/mgmt.js`（14 行「寸法検査・8D」は担当業務の列）
- `dify/tests/KN-01.json`（変更なし。§2-4）・`dify/apps/**`（言語契約の例示の `TR-2024-007` は番号不変）・`dify/env/**`・`dify/state/**`
- **`dify/results/**`**（実機の記録。旧番号・200% が残るのは正しい。CLAUDE.md §7「手で編集しない」）
- `scripts/dify/tests/test_lang_check.py`（過去の実機応答を固定した言語判定の入力。値は検査対象ではない）
- `docs/handoff/**` の既存の設計書・手渡しメモ（旧番号は当時の記録として残す。showcase 設計書は §20 の**追記だけ**）
- `docs/dify/usecases/QA-02.md` 38 行（`NC-2024-0118 …（ECR-24-0017 起因）` は「変更起因の不具合記録」の**書式の例**。W10 の走査対象外。直すなら別途 S レーン）
- `docs/demo/runbook-showcase-mfg.md` の 57 行（§9 Q2）と §5-1 の 2 文以外
- `dc3` の `NC-2025-0203`・`NC-2025-0417`、KN-01 KB の `NC-2026-*`・`NC-2023-0207`・`TR-2022-118`（`records.csv` に無い番号。今回の食い違いではない）
- `common.js` の `PACT A-0912` の期限 `2025-09-09`（NC の起票日 9/12 より前という既存の不整合。今回は件名だけ直す）
- `kn12`（KN-12）の台本：`NC-2025-0904`（9/4 の寸法ばらつき）を過去記録の一覧に足すかは本設計では扱わない（§9 Q3）
- `mock/**` の描画・イベント・CSS、`T`/`TAGS`/`CATS`/`HOME`/`FEED`、`localStorage`、`portal/**`、`CLAUDE.md`、`.claude/**`、`.github/**`
- 件数：`CATS` 15・`subs` 36・`SVCS` 87・`TAGS` 67・`T` 94 は**すべて不変**（`SVCS[].id` の追加・改名・削除なし＝§2-9・§2-11）

---

## §7. 受け入れ条件（作業用コピーでの実走出力）

作業用コピー：`/home/user/Dify` を `scratchpad/verify-consist` に丸ごと複製し、本設計の PR-1＋PR-2＋PR-3 の変更（§5-2 の Q1 を除く）をすべて入れた状態。

| # | 条件 | 実走結果 |
|---|---|---|
| 1 | `node tools/verify.mjs` が ALL PASS、warn 数が変わらない | `✅ ALL PASS / ⚠️ 17 warn`（`main` と同数）。**`npm run index` 前は `❌ docs/service-map.md が古い` で 1 FAIL**（KN-03 のテスト件数 4→5）→ PR-1 で `npm run index` 必須 |
| 2 | `node tools/regress.mjs` が PASS・件数不変（`--update` 不要） | `✅ regress PASS — データ層は基準と一致 {"cats":15,"subs":36,"svcs":87,"tags":67,"ui":94,"byIndustry":{"mfg":{"svcs":55,"cats":10},"fin":{"svcs":31,"cats":8},"it":{"svcs":27,"cats":7}},"svcsMulti":13}` |
| 3 | `node tools/check-world.mjs` の合計が 12 件のまま（W10 は 0 件） | `✅ 記録番号 12 件の近傍の語はすべて records.csv の件名と一致（該当なしを含む）`／`製造（mfg）: 10 件 ／ 金融（fin）: 1 件 ／ IT（it）: 1 件 ／ 業種横断（multi）: 0 件 ／ 合計 12 件`。fin・it は `W10. …records.csv / record_terms.csv が無いため skip` |
| 4 | W10 が修正前の食い違いを検出する | `main`＋新番号 4 行だけの状態で `W10-a … 3 件`・`W10-b … 30 件`、合計 45 件（§2-7 の表） |
| 5 | `python3 dify/check.py` | exit 0、`[OK]` 12 本（DSL は触っていない） |
| 6 | `python3 scripts/dify/run_tests.py --dry-run KN-01 KN-03` | `KN-01 … 合格 4/4`／`KN-03 … 合格 5/5`／`合計: 9 / 9 合格`（`main` は 8/8。T03 追加で +1） |
| 7 | `npm run ci` | exit 0。dry-run 全体 `合計: 49 / 49 合格`（`main` は 48/48） |
| 8 | `portal/seed` が新鮮 | `node portal/tools/check-seed-fresh.mjs` → `✅ PASS: portal/seed/** は正本から再生成した内容とバイト一致`（再生成不要） |
| 9 | 台本の置換数が §2-4 の表と一致 | kn1 8・dc3 6・pt3/pt8 8・eg1 2（行指定置換の実測） |
| 10 | 3 言語の同時更新 | `desc` 3 件 × ja/zh/en。verify §1（キー一致・空値なし・`en` にかな無し）PASS |

**注意（dry-run の出力先）**：`run_tests.py --dry-run` を `--out` なしで実行すると `dify/results/cloud-master/` に結果ファイルを書く。implementer・reviewer は `--out "$(mktemp -d)"` を付けること（`npm run ci` は付けている）。

各 PR の受け入れ条件は §8 に PR ごとに書く。

---

## §8. PR 分割

| PR | 中身 | 触るファイル | ラベル | 並列可否 |
|---|---|---|---|---|
| **PR-0** | 本設計書・Issue 本文・showcase §20 追補・runbook 2 文 | `docs/handoff/2026-09-24-script-kb-consistency.md`（新）・`docs/handoff/script-kb-consistency.issue.md`（新）・`docs/handoff/2026-09-16-showcase-demo.md`（末尾追記のみ）・`docs/demo/runbook-showcase-mfg.md`（2 行追加） | `run:cloud` | 最初にマージ（他 PR が参照する） |
| **PR-1** | 世界マスタ＋KB＋テスト＋実装リファレンス | `data/world/mfg/records.csv`・`calendar.md`・`data/world/README.md`（33 行）・`dify/kb/KN-01/`（4 ファイル）・`dify/kb/KN-03/`（3 ファイル）・`dify/tests/KN-03.json`・`docs/dify/usecases/{KN-01,KN-03,DC-03,PT-03,PT-08}.md`・`dify/README.md`・`docs/service-map.md`（`npm run index`） | `run:cloud` | PR-2 と**並列可**（ファイル集合が重ならない）。マージは PR-2 より先（§2-13「まずマスタに足す」） |
| **PR-1r**（別 Issue） | 実機 KB の差し替えとテスト | なし（`dify-ops.yml` を `op: kb_refresh`・`codes: KN-01 KN-03` → `op: run_tests`・同 codes。結果の自動 PR は `dify/results/**` だけ） | `run:runner` | PR-1 マージ後 |
| **PR-2** | 台本＋`desc`＋ポータル | `mock/js/data/scenarios/mfg/{kn,dc,pt,eg}.js`・`mock/js/data/catalog.js`・`mock/js/data/portal/{common,front}.js` | `run:cloud` | PR-1 と並列可。`portal/seed` 再生成は**不要**（§2-6） |
| **PR-3** | check-world W10 | `tools/check-world.mjs`・`data/world/mfg/record_terms.csv`（新）・`data/world/README.md`（W10 の説明 2 か所） | `run:cloud` | **PR-1・PR-2 の両方のマージ後**（先に入れると合計が 12 件を超え CLAUDE.md §2-13 と食い違う）。`tools/**` なので直列 |

- `data/world/README.md` を PR-1（33 行）と PR-3（行追加・186 行）の両方が触る → **PR-3 は PR-1 のマージ後に rebase してから**出す（上の順序で自然に満たす）
- Q1 で案 A' か B が選ばれたら、その差分は **PR-1 に同梱**（`dify/kb/KN-01/**` は PR-1 の範囲）。案 C なら `calendar.md` の 1 文を PR-1 に同梱

### PR ごとの受け入れ条件

**PR-0**
- [ ] `docs/handoff/2026-09-16-showcase-demo.md` の差分が**末尾への追記だけ**（`git diff` の削除行 0）
- [ ] `docs/demo/runbook-showcase-mfg.md` の差分が追加 2 行だけ
- [ ] `npm test` PASS（docs のみ。verify の索引・リンク検査に引っかからない）

**PR-1**
- [ ] `records.csv` が §2-1（4 行追加）・§2-2（3 行）・§2-3（2 行）のとおり。行数 36 → 40（ヘッダ込み）
- [ ] `grep -c 'NC-2024-0118\|TR-2023-041\|TR-2024-102' dify/kb/KN-01/*.md` がすべて 0
- [ ] `grep -c '200%' dify/kb/KN-03/*.md` がすべて 0、`grep -c '300%'` が中国語版・旧版・日本語版で各 1
- [ ] `dify/tests/KN-03.json` の cases が 5 件（T01・T02・T03・T04・T08）
- [ ] `npm run index` 済み（verify §11 PASS）。`npm run ci` exit 0、dry-run 合計 49/49
- [ ] PR 本文に「`regress --update` なし（件数不変）」と「PR-1r（`run:runner`）が続く」と書く

**PR-1r**（`run:runner`）
- [ ] `kb_refresh`（KN-01 KN-03）成功。`kb_replace` は使わない（ファイル名を変えていないため）
- [ ] `run_tests`（KN-01 KN-03）で KN-01 4/4・KN-03 5/5。KN-03 T03 が落ちたら**応答の文面を `dify/results/**` で確かめてから** PM に返す（期待値を緩めない）

**PR-2**
- [ ] 台本の置換数が §2-4 の表どおり（kn1 8・dc3 6・pt3/pt8 8・eg1 2）。`git diff` で台本の他の文字が変わっていない
- [ ] `kn.js` の kn11・kn12 の `NC-2024-0118` は残る（`grep -c NC-2024-0118 mock/js/data/scenarios/mfg/kn.js`＝該当行数が 20 → 16、`grep -o … | wc -l`＝出現数が 22 → 18。kn1 の 4 行・4 か所だけ減る）
- [ ] kn3 の `200%` が 0 件（`grep -c '200%' mock/js/data/scenarios/mfg/kn.js`）
- [ ] `desc` 3 件が §4 の全文と一致
- [ ] ポータル 5 行が §2-3 のとおり
- [ ] `npm test` PASS（ALL PASS / 17 warn、regress 件数不変）。`node portal/tools/check-seed-fresh.mjs` PASS

**PR-3**
- [ ] `node tools/check-world.mjs` の合計 12 件（W10 0 件、fin・it は skip の理由を出す）
- [ ] 検出力の確認：PR 本文に「`records.csv` の `NC-2025-0912` の件名を一時的に旧件名に戻すと W10-a と W10-b が出る」手元確認の結果を 1 行書く（コミットはしない）
- [ ] `npm test` PASS（`check-world.mjs` は CI に入れない）

---

## §9. PM 判断待ち（推奨つき）

### Q1（必須）KN-01 の Rev.D の日付 —— **推奨：C（変えずに未統一として記録）**

§5-2 のとおり「日付だけ」は版の順序と参照先の年が壊れる。A'（日付だけ＋Rev.C。Rev.D が 2026 年の文書を引く矛盾が残る）／B（KB 全体を 1 年前倒し。実機 KB の入れ直しを伴う）／C（変えない。`calendar.md` の未統一に 1 文）。**決まるまで PR-1 は Q1 の差分を含めずに進めてよい。**

### Q2（軽）runbook 57 行「確信度の低い 1 項目を人が原票で確定」を直すか —— **推奨：直す（S レーン）**

#340 で台本は「確信度が低い 2 項目を記入者本人が確定」になったので、57 行は誤り。今回の指示は「各 1 文の追加」だったので触っていない。直すなら文言は「要点：確信度の低い 2 項目を、記入者本人が原票で確定して次のターンへ＝ AI が迷った所だけ人が入る」（S レーンで PR-0 に同梱してよい）。

### Q3（軽）KN-12 の台本に `NC-2025-0904` を過去記録として足すか —— **推奨：足さない**

`NC-2025-0904`（9/4 の初品の寸法ばらつき）は PX-200 の E-47 と同じ系統の記録で、KN-12（E-47 の再々発の原因候補）の「過去の記録」に並べる余地がある。ただし KN-12 の台本は 3 往復で完結しており、足すと ② 以降の説明を組み直す必要がある。今回は `records.csv` とポータルの分離だけに留める。
