# NM05の数値強調とまとめ表示と初回のお気に入り

- 2026-10-12。M/L、`run:mac`。ユーザー追加依頼に基づくローカルレビュー用試作。
- 基準：`CLAUDE.md`の共通レイヤー・3言語・セマンティックトークン・既存localStorage契約を維持する。
- 対象は、NM-05会話の黄色マーカー、最後に開く画面内のまとめ1枚、保存値のない初回だけのQA-01／NM-05お気に入り設定。
- 既存の `2026-10-12-image-preview.md` の機能は保つ。QA-01の台本文と原画像、完成済みB草案は変更しない。
- Issue／PR／push／merge／GitHub Pages反映はこの設計・試作の対象外。

## 1. 会話の黄色マーカー

QA-01の安全なDOM描画を、`mfg/qa1`と`mfg/nm5`の2サービスにだけ適用する。任意の `highlights: {ja: string[], zh: string[]}` と、元台本回答の完全一致による限定を維持する。ユーザー入力・挨拶・汎用回答は対象外。回答言語は `turn.lang` を使う。表示用の既存 `**` だけを除き、通常文字はtext node、強調はmark.textContentで追加し、生文字列をinnerHTMLへ挿入しない。

既存 `.qa-highlight` を両サービスで再利用し、背景 `var(--status-warning)`、文字 `var(--surface-inverse)`を保つ。QA-01の既存引用は変更しない。NM-05には次を追加する（§2の修正後回答に完全一致）。

| ja | zh |
|---|---|
| L2 が +0.78 | L2 的相关系数为 +0.78 |
| 夜勤 0.61% vs 昼勤 0.34% | 夜班0.61% vs 白班0.34% |
| 相関は原因の証明ではありません | 相关性不能证明因果关系 |
| 塗装ブツ 46%、塗膜厚不足 22%、打痕 18%、その他 14% | 涂装颗粒46%、涂膜厚度不足22%、碰伤18%、其他14% |
| 人員配置・フィルター差圧・濃度チェック頻度 | 人员配置、过滤器压差、浓度检查频率 |
| 原因はまだ確定していません | 原因尚未确定 |
| まとめの1枚を表示 | 显示一页摘要 |

## 2. NM-05台本文の最小修正

`nm.js`の **nm5だけ**を対象とし、q・persona・input・steps・数値は変えない。修正は、相関からの因果断定と未生成ファイルの出力表現を取り除く範囲に限る。

### 最初の回答を次の文に置換

ja：

> 2025 年 3〜8 月のサンプルをライン別に比較しました（結果の表）。相関は L2 が +0.78、L1 が +0.21、L3 が +0.12 です。L2 の不良率は夜勤 0.61% vs 昼勤 0.34% です。相関は原因の証明ではありません。L2 の夜勤条件を優先して確認します。

zh：

> 已按线比较2025年3〜8月的示例数据（见结果表格）。L2 的相关系数为 +0.78，L1 为 +0.21，L3 为 +0.12。L2不良率为夜班0.61% vs 白班0.34%。相关性不能证明因果关系。优先确认L2夜班的条件。

### 2番目の回答は末尾だけ置換

不良内訳、人員、設備、工程の既存説明と数値は保ち、「示唆／洞察」以降を次に置換する。

ja：

> 確認事項は、人員配置・フィルター差圧・濃度チェック頻度です。夜勤条件の重なりは調査の手掛かりですが、原因はまだ確定していません。条件を確かめたうえで、夜勤の管理方法を見直す案を検討します。

zh：

> 需要确认的是人员配置、过滤器压差、浓度检查频率。夜班条件的重叠可作为调查线索，但原因尚未确定。确认条件后，再考虑调整夜班管理方式。

### 最後の回答を次の文に置換

ja：

> 下の「まとめの1枚を表示」から、本社説明用の画面を大きく開けます。左はライン別の平均残業・平均不良率・相関の比較表、右上はL2の昼勤と夜勤の不良率、右下はL2夜勤の不良内訳です。確認事項と対策案を分け、相関は原因の証明ではないことを添えます。このデモの架空サンプルを使った画面表示です。

zh：

> 点击下方「显示一页摘要」，可放大查看总部说明用的页面。左侧比较各线的平均加班、平均不良率和相关系数；右上显示L2白班与夜班不良率，右下显示L2夜班不良明细。确认事项与措施方案分别列示，并说明相关性不能证明因果关系。这是使用本演示虚构示例数据的页面展示。

末尾にPNG／PowerPointを出力可能・出力済みとする文言は残さない。18月次点の実数は今回の読取範囲で確認できず、形式例の18行から散布図を作らない。

result表の数値セルは保持し、因果を言い切る「示唆」セルだけ以下に変更する（ja／zh）。L2行の既存の昼夜数値は別の数値セルやsummaryへ移さず、そのまま維持する。

| 行 | ja | zh |
|---|---|---|
| L1 | 相関は弱い。5月の立上げ条件は要確認 | 相关较弱。5月复产条件需确认 |
| L2 | 相関は強い。夜勤条件を要確認（夜勤 0.61% vs 昼勤 0.34%） | 相关较强。需确认夜班条件（夜班0.61% vs 白班0.34%） |
| L3 | 相関は弱い。条件切替との関係は要確認 | 相关较弱。需确认与条件切换的关系 |
| 全体 | L2の夜勤条件を優先して確認 | 优先确认L2夜班条件 |

## 3. まとめの1枚のデータと文言

nm5に任意の `summary` メタデータを追加する。データ層はリテラルだけ。以下の数値を既存サンプルから転記し、画面はこのメタデータを正本として描く。実データを抽出した、相関を再計算した、18点の月次データを持っているとは表現しない。

```text
summary: {
  period: {from:'2025-03', to:'2025-08'}, correlationPoints:6,
  lines:[
    {line:'L1', overtime:18.2, defectRate:0.33, correlation:0.21},
    {line:'L2', overtime:31.5, defectRate:0.46, correlation:0.78},
    {line:'L3', overtime:26.8, defectRate:0.39, correlation:0.12}
  ],
  shifts:[{key:'day', defectRate:0.34},{key:'night', defectRate:0.61}],
  defects:[{key:'particles',share:46},{key:'thinCoat',share:22},
           {key:'dents',share:18},{key:'other',share:14}],
  checks:{ja:[...],zh:[...],en:[...]},
  options:{ja:[...],zh:[...],en:[...]}
}
```

数値単位は、残業が月平均h/人、不良率が%、内訳がL2夜勤不良の構成比%、相関は各ラインの月次6点。期間は2025年3〜8月。月次実数を補間・捏造して散布図や折れ線にしない。内訳の合計は100%。グラフは相対的な棒の長さと既存の値ラベルで描き、別の実測値や目標値は追加しない。

summary.checks／optionsには、次の3言語の配列をそのまま入れる。

| 種類 | ja | zh | en |
|---|---|---|---|
| checks 1 | 夜勤の人員配置と経験を確認 | 确认夜班人员配置与经验 | Check night-shift staffing and experience |
| checks 2 | フィルター差圧と交換時点を確認 | 确认过滤器压差与更换时点 | Check filter pressure and replacement timing |
| checks 3 | 濃度チェック頻度と実施記録を確認 | 确认浓度检查频率与执行记录 | Check concentration-check frequency and records |
| options 1 | 夜勤の濃度チェック頻度の見直し | 调整夜班浓度检查频率 | Review night-shift concentration-check frequency |
| options 2 | フィルター交換タイミングの見直し | 调整过滤器更换时点 | Review filter replacement timing |
| options 3 | 夜勤へのベテラン支援 | 由熟练人员支援夜班 | Add experienced-worker support on the night shift |

UI文言はTへ以下の21キーを追加する。Closeは既存 `upPreviewClose` を再利用する。英語UIではまとめの文言を英語表示し、会話本体は既存の日本語台本フォールバックを保つ。

| Tキー | ja | zh | en |
|---|---|---|---|
| nmSummaryOpen | まとめの1枚を表示 | 显示一页摘要 | Show one-page summary |
| nmSummaryTitle | 残業と不良率の比較 | 加班与不良率比较 | Overtime and defect rates |
| nmSummaryNumbers | サンプルの数値 | 示例数值 | Sample figures |
| nmSummaryChecks | 次の確認事項 | 下一步确认事项 | Next checks |
| nmSummaryOptions | 対策案 未決定 | 措施方案 尚未决定 | Proposed actions Not decided |
| nmSummaryLines | ライン別の平均と相関 | 各线平均值与相关系数 | Line averages and correlations |
| nmSummaryLine | ライン | 线 | Line |
| nmSummaryOvertime | 月平均残業 h/人 | 月均加班 h/人 | Monthly overtime h/person |
| nmSummaryDefectRate | 平均不良率 % | 平均不良率 % | Mean defect rate % |
| nmSummaryCorrelation | 相関 月次6点 | 相关系数 月度6点 | Correlation 6 monthly points |
| nmSummaryShifts | L2 昼勤と夜勤の不良率 | L2 白班与夜班不良率 | L2 day and night defect rates |
| nmSummaryDay | 昼勤 | 白班 | Day shift |
| nmSummaryNight | 夜勤 | 夜班 | Night shift |
| nmSummaryDefects | L2夜勤の不良内訳 | L2夜班不良明细 | L2 night-shift defect mix |
| nmSummaryParticles | 塗装ブツ | 涂装颗粒 | Paint particles |
| nmSummaryThinCoat | 塗膜厚不足 | 涂膜厚度不足 | Insufficient coating thickness |
| nmSummaryDents | 打痕 | 碰伤 | Dents |
| nmSummaryOther | その他 | 其他 | Other |
| nmSummaryPeriod | 2025年3〜8月 | 2025年3〜8月 | March–August 2025 |
| nmSummarySampleNote | 出典 このデモの架空サンプル 実システムから抽出した数値ではありません | 来源 本演示的虚构示例数据 并非从实际系统提取的数值 | Source Fictional scenario data for this demo Not extracted from a live system |
| nmSummaryCorrelationNote | 相関は原因の証明ではありません | 相关性不能证明因果关系 | Correlation does not prove causation |

Tは紙プレビュー込みの105から126キーへ変更。baselineはこの21キーの追加だけを更新し、CATS／SVCS／TAGS／PATTERNSの件数とidは変えない。

## 4. まとめ表示のレイアウトと操作

NM-05の最後の台本回答が実際に描画された後だけ、その回答の下に `nmSummaryOpen` ボタンを出す。ボタンは既存の見た目に合わせ、`data-nm-summary="open"`／`"close"` で操作する。data-actを追加しない。

```text
┌ 残業と不良率の比較   2025年3〜8月       [閉じる] ┐
│ サンプルの数値                                   │
│ ライン別平均と相関の表 │ L2 昼勤／夜勤の棒        │
│ L1 18.2 0.33 +0.21     │ 0.34%／0.61%            │
│ L2 31.5 0.46 +0.78     ├─────────────────────────┤
│ L3 26.8 0.39 +0.12     │ L2夜勤の100%横棒        │
│                       │ 46／22／18／14%          │
├───────────────────────┴─────────────────────────┤
│ 次の確認事項          │ 対策案 未決定            │
│ 人員／差圧／濃度記録  │ 頻度／交換時点／支援      │
│ 相関は原因の証明ではありません                  │
│ 出典 このデモの架空サンプル …                    │
└─────────────────────────────────────────────────┘
```

- まとめ本文は16:9に近い横長（基準1280×720）。dialog外枠は画面の各辺16px内側、上限1280px。画像ではなくHTMLとして文字・表・棒を描き、PPTやPNGは生成しない。
- 小画面では列を縦へ並べ、本文をスクロールできるようにし、閉じる操作を常に確保する。読めなくなるほど全体を縮小しない。
- 既存の字体・余白・ボタン・セマンティック色のみ使用。黄色マーカーは会話に限定し、まとめの数値欄は表と棒で区別する。棒は既存トークン色を使い、文字と数値のラベルで種類を示す。
- native dialog、close／Esc、Tab／Shift+Tab、背景操作抑止、元ボタンへのフォーカスとスクロール復帰。表示・終了でconsumeや会話の再実行をしない。
- 表示状態はapp.jsの一時変数に保持し、state必須キーやlocalStorageを増やさない。業種／サービス離脱・restart時は閉じる。通常の再描画ではサービスが同じならラベルを更新して維持し、起点DOMが再生成されたら対応する表示ボタンに復帰する。

## 5. 初回のお気に入り

`loadPrefs()` のmock.fav読取で **raw === null** の場合だけ、`state.fav.mfg`を`['qa1','nm5']`でseedし、同じ既存mock.favキーへ保存する。fin／itは既存の空配列。状態宣言の初期値は空配列のままにする。

保存済み `{mfg:[]}`／別の選択／未登録業種だけの値／壊れたJSON／空文字があっても再seedしない。読取が例外になった場合も既存の空リストで続行する。ユーザーが星を外したら既存toggleFav／savePrefsで保存し、reloadで追加し直さない。既存の業種検査・文字列フィルタ・200件上限・mock.langとmock.themeの独立読取を保つ。

既存localStorageはmock.lang／mock.theme／mock.favの3キーだけ。現在のブラウザの選択を変更するのは親が既存UIから行う作業であり、コードから既存利用者の値を上書きしない。

## 6. 編集範囲と検証

編集許可は `mock/js/app.js`（summary一時状態と初回seed）、`render.js`（既存マーカーの対象拡張とsummary描画）、`events.js`（summary操作）、`data/ui.js`（21キー）、`css/components.css`（横長summary）、`data/scenarios/mfg/nm.js`（nm5の§1〜3だけ）、`tools/regress.baseline.json`（21UIキー）。共通ファイルが重なるため実装は直列、1つのローカル試作としてレビューする。

**保持範囲**：QA-01の生台本文と引用、原画像とassets、他のNM台本、data/world、dify実装／KB／tests、portal、tokens、CLAUDE、.claude、.github、package、script読込み順。B草案はrepo外の完成版を維持する。

最小受け入れ条件：

1. QA-01とNM-05で指定した短い引用だけが日中両方で黄色になる。入力・他サービス・原画像は変わらず、文字列をHTMLとして解釈しない。
2. NM-05の最終応答の前にはsummaryボタンがなく、応答後に表示。開くと3ライン表・昼夜棒・100%横棒が正しい値と単位で出る。散布図や18点の捏造がない。
3. 期間、相関の月次6点、架空サンプル出典、因果の留保、確認事項と未決定の対策案が同じ画面に表示される。ファイル生成を示唆する文言がない。
4. 日中英×light/dark、1366×768と390×844で読み、閉じる／Esc／Tab／フォーカス復帰／再描画／restartを確認。台本進行は変わらない。
5. 保存値なしで2件をseedする。保存済み空配列、片方を外した保存値、別の選択、不正値ではseedしない。外す→reloadで復活しない。mock.lang／themeを巻き込まない。
6. `npm test`がPASS。baseline差分は21UIキーだけ。数値メタデータと既存result数値が一致し、原画像ハッシュとQA-01生台本文が変わらない。NM-05変更は§2の断定・出力表現の是正だけと差分監査する。

Issue／PR／公開操作は行わず、ローカル画面をPMへ提示して確認する。


## 7. PM確認後の補正

2026-10-12、PMの確認指示に基づく補正。中文の最初の回答と黄色引用は「L2 的相关系数为 +0.78」に一致させる。

まとめ画面には制作メモ、候補原文、制作経緯の説明を入れない。期間、架空サンプルの出典、実システムからの抽出値ではないこと、月次6点の相関は原因を証明しないことを、下部の**1つの脚注段落**へまとめる。例えば日本語は「2025年3〜8月。このデモの架空サンプルに基づく数値で、実システムから抽出した数値ではありません。月次6点の相関は原因の証明ではありません。」とする。各文言は§3の21キーを必要な場所で使い、見出しや脚注をラベルの断片の羅列にしない。書体、余白、表、棒は元のmockの平面構成を継承する。

§2の数値保持は、既存の数値を別の値へ書き換えないことを指す。裏付けのない月次描写や因果の断定は、指定した置換文の通り省く。summaryへ新しい数値は追加しない。
