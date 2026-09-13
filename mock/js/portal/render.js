'use strict';
/* mock/js/portal/render.js — renderRail / renderScreen / V.*（画面数は PSCREENS が正本）/ drawer / フィルタ
   出所: scratchpad/portal-mock/portal.html（PM が作り込んだ単一 HTML のコンセプトモック）。
   設計書 docs/handoff/2026-09-11-portal-mock-pages.md §3-1・§5-3。動きと見た目は変えていない
   （移設のみ。§12-1 AC-7・AC-8）。画面本文（見出し・表ヘッダ・解説）は v1 は日本語のまま（§7-1）。

   §2-10 対応・§5-10（PR-4）：AI サービス画面の外部リンクは、移植元の絶対 URL（target="_blank"）と
   iframe の破線枠プレースホルダを外し、catalog.html への同じタブの相対リンク（.ai-catalog-card）に
   作り直している（verify §17-j：生 URL 禁止）。 */

const V = {};

V.home = () => `
<div class="grid g-main">
 <div class="grid">
  <section class="block">
   <header><h2>今月の数字</h2><span class="sub">FY2026 上期 ／ 2026-09-11 時点</span></header>
   <div class="body"><div class="tiles">
    <div class="tile"><div class="lbl">受注残</div><div class="num">${BACKLOG.toFixed(1)}<small>百万円</small></div><div class="delta">受注後の 5 件</div></div>
    <div class="tile"><div class="lbl">パイプライン</div><div class="num">${PIPE_TOTAL.toFixed(1)}<small>百万円</small></div><div class="delta">受注前 5 件 ／ 確度加重 ${PIPE_W.toFixed(1)}</div></div>
    <div class="tile alarm"><div class="lbl">期限超過 To Do</div><div class="num">2<small>件</small></div><div class="delta">最長 13 日</div></div>
    <div class="tile"><div class="lbl">要員稼働率</div><div class="num">94.4<small>%</small></div><div class="delta">目標 90.0</div></div>
   </div>
   <div class="pn blk">本番：数字の元は実データ。テーブルの形（スキーマ）はデモと同一で、中身だけが入れ替わる</div>
   </div>
  </section>

  <section class="block">
   <header><h2>いま止まっているシステム</h2><span class="sub">障害・縮退・閉塞のみ</span></header>
   <div class="body">
   ${(() => {
     const stopped = pSysRows().filter(r => r.state === 'incident' || r.state === 'degraded' || r.state === 'blocked');
     if (!stopped.length) return '<div class="note">すべて定常運転中です</div>';
     return '<ul class="list">' + stopped.map(r =>
       '<li><div><b>' + pesc(r.name) + '</b> ' + pSysChip(r.state) +
       '<span class="m">' + pesc(r.client) + ' ／ ' + r.id + '</span></div></li>').join('') + '</ul>';
   })()}
   </div>
  </section>

  <section class="block">
   <header><h2>手当てが要る案件</h2><span class="sub">Red / Yellow</span><span class="sp"></span>
    <span class="sub">行から直接 AI を呼べる →</span></header>
   <div class="body flush">
   ${ptbl([{t:'案件'},{t:'顧客'},{t:'ステージ'},{t:'状態'},{t:'次のアクション'},{t:'この行で使う AI'}],
     PDEALS.filter(d => d.rag && d.rag !== 'g').map(d => '<tr>' +
       '<td><b>' + d.nm + '</b><span class="m">' + d.id + ' ／ ' + d.ow + '</span></td>' +
       '<td class="nw">' + d.cu + '</td><td class="nw">' + pstageName(d.sg) + '</td><td>' + pragChip(d.rag) + '</td>' +
       '<td>' + d.nx + '</td>' +
       '<td>' + prowAi(PSTAGE_AI[d.sg], { scr: 'proj', id: d.id }) + pbackContainer('proj', d.id) + '</td></tr>').join(''))}
   </div>
  </section>

  <section class="block blk-ai">
   <header><h2>${pesc(pt('crossAi'))}</h2><span class="sub">どの画面からでも開く</span></header>
   <div class="body">
    ${paiRow(pcrossAiIds())}
    <div class="pn blk">本番：呼び先が Dify Enterprise（社内）に替わる。ポータル側で変わるのは接続先とキーだけ（<code>${'${DIFY_BASE_URL}'}</code>）</div>
   </div>
  </section>
 </div>

 <div class="grid">
  <section class="block">
   <header><h2>期限超過 To Do</h2><span class="sub">自分と配下</span></header>
   <div class="body"><ul class="list">
    ${PACT.filter(a => a[5].startsWith('超過')).map(a => '<li><span class="k">' + a[0] + '</span><div><b>' + a[2] + '</b><span class="m">' + a[3] + ' ／ 期限 ' + a[4] + '</span></div><span style="flex:1 1 auto"></span><span class="due">' + a[5] + '</span></li>').join('')}
   </ul></div>
  </section>

  <section class="block">
   <header><h2>お知らせ</h2></header>
   <div class="body"><ul class="list">
    <li><span class="k">09-10</span><div>中秋節・国慶節の休暇届の締切は 09-19</div></li>
    <li><span class="k">09-08</span><div>部門月次の資料を掲載（ナレッジ）</div></li>
    <li><span class="k">09-05</span><div>AI カタログに 2 サービスを追加</div></li>
   </ul>
   <div class="pn blk">本番：社内の掲示と接続。デモは架空のお知らせ 3 件をテーブルに直接持つ</div>
   </div>
  </section>

  <section class="block">
   <header><h2>関連ナレッジ</h2><span class="sub">文書は Outline 側</span></header>
   <div class="body">
    <ul class="list">
     <li><span class="k">議事録</span><div>部門月次 2026-09-08</div></li>
     <li><span class="k">提案</span><div>青嶺精工 MES 更改 第2期 提案書</div></li>
    </ul>
    <div class="note" style="margin-top:10px"><b>デモには Outline がありません。</b>リンク先は同じ画面内のダミーです。ポータルが持つのは「どの案件がどの文書に紐づくか」だけで、文書の中身は持ちません。</div>
    <div class="pn blk">本番：Outline Self-Hosted へのリンクになる。紐づけ（document_links）の形はデモと同一</div>
   </div>
  </section>
 </div>
</div>`;

V.cust = () => {
  const q = (r, i) => i < PCUR_Q ? { v: r.act[i], kind: '実績' } : { v: r.fc[i - PCUR_Q], kind: '見込' };
  const tot = k => [0, 1, 2, 3].map(i => PQTR.reduce((t, r) => t + (k === 'plan' ? r.plan[i] : q(r, i).v), 0));
  const tp = tot('plan'), tv = tot('v');
  const qrows = PQTR.map(r => {
    const cells = [0, 1, 2, 3].map(i => {
      const o = q(r, i), d = o.v - r.plan[i];
      const cls = d < -0.05 ? ' style="color:var(--status-danger-text);font-weight:700"' : '';
      const nw = i === 1 ? ' qnow' : '';
      return '<td class="num qsep' + nw + '">' + r.plan[i].toFixed(1) + '</td>' +
        '<td class="num' + nw + '"' + cls + '>' + o.v.toFixed(1) + '</td>';
    }).join('');
    const sp = r.plan.reduce((a, b) => a + b, 0), sv = [0, 1, 2, 3].reduce((t, i) => t + q(r, i).v, 0);
    return '<tr><td class="nw"><b>' + r.cu + '</b></td>' + cells +
      '<td class="num qsep">' + sp.toFixed(1) + '</td><td class="num"><b>' + sv.toFixed(1) + '</b></td></tr>';
  }).join('') +
  '<tr style="background:var(--surface-sunken)"><td class="nw"><b>合計</b></td>' +
    [0, 1, 2, 3].map(i => '<td class="num qsep' + (i === 1 ? ' qnow' : '') + '">' + tp[i].toFixed(1) + '</td><td class="num' + (i === 1 ? ' qnow' : '') + '"><b>' + tv[i].toFixed(1) + '</b></td>').join('') +
    '<td class="num qsep">' + tp.reduce((a, b) => a + b, 0).toFixed(1) + '</td>' +
    '<td class="num"><b>' + tv.reduce((a, b) => a + b, 0).toFixed(1) + '</b></td></tr>';

  return `
<div class="grid">
 <section class="block">
  <header><h2>今期の売上 — 計画・実績・見込</h2><span class="sub">FY2026（4 月〜3 月）／ 単位：百万円</span><span class="sp"></span>
   <span class="sub">いまは <b style="color:var(--action-primary)">Q2</b>（7–9 月）</span></header>
  <div class="body flush"><div class="tw"><table>
   <thead>
    <tr><th rowspan="2" style="vertical-align:bottom">顧客</th>
     <th class="qh qsep" colspan="2">Q1<span class="qs">4–6 月 ／ 実績</span></th>
     <th class="qh now qsep" colspan="2">Q2<span class="qs">7–9 月 ／ 実績・進行中</span></th>
     <th class="qh qsep" colspan="2">Q3<span class="qs">10–12 月 ／ 見込</span></th>
     <th class="qh qsep" colspan="2">Q4<span class="qs">1–3 月 ／ 見込</span></th>
     <th class="qh tot qsep" colspan="2">通期<span class="qs">FY2026</span></th></tr>
    <tr><th class="num qsub qsep">計画</th><th class="num qsub">実績</th>
     <th class="num qsub qsep qnow2">計画</th><th class="num qsub qnow2">実績</th>
     <th class="num qsub qsep">計画</th><th class="num qsub">見込</th>
     <th class="num qsub qsep">計画</th><th class="num qsub">見込</th>
     <th class="num qsub qsep">計画</th><th class="num qsub">着地</th></tr>
   </thead>
   <tbody>${qrows}</tbody>
  </table></div></div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note">計画を割っている四半期は<b>赤で出ます</b>。四半期は会計年度（4 月〜3 月）から機械的に決まるので、テーブルには <code>fiscal_year</code> と <code>quarter</code> を持たせ、<b>画面には絶対日付を持たせません</b>。</div>
   <div class="pn blk">本番：計画は経営企画から、実績は会計システムから取り込む。デモは 4 顧客 × 4 四半期を直接持つ</div>
  </div>
 </section>

 <section class="block">
  <header><h2>顧客</h2><span class="sub">4 件</span></header>
  <div class="body flush">
  ${ptbl([{t:'顧客'},{t:'拠点'},{t:'受注後'},{t:'受注前'},{t:'受注残',n:1},{t:'この行で使う AI'}], PCUST.map(c => {
    const mine = PDEALS.filter(d => d.cu === c.id);
    const post = mine.filter(d => !pinPre(d)), pre = mine.filter(pinPre);
    return '<tr><td><button class="culink" type="button" data-cu="' + c.id + '">' + c.full + '</button>' +
      '<span class="m">担当者を見る</span></td><td class="nw">' + c.site + '</td>' +
      '<td class="nw">' + post.length + ' 件</td><td class="nw">' + pre.length + ' 件</td>' +
      '<td class="num">' + psum(post, d => d.amt).toFixed(1) + '</td>' +
      '<td>' + prowAi(['rs3', 'rs1'], { scr: 'cust', id: c.id }) + pbackContainer('cust', c.id) + '</td></tr>';
  }).join(''))}
  </div>
 </section>

 <section class="block">
  <header><h2>担当者</h2><span class="sub" id="ctCount">名刺から取り込み ／ 6 名</span><span class="sp"></span>
   <span class="chips" id="cuChips">
    <button class="chip" type="button" data-cu="" aria-pressed="true">すべて</button>
    ${PCUST.map(c => '<button class="chip" type="button" data-cu="' + c.id + '">' + c.id + '</button>').join('')}
   </span></header>
  <div class="body flush">
  ${ptbl([{t:'氏名'},{t:'名刺'},{t:'役職（名刺の原文）'},{t:'役職（社内表記）'},{t:'顧客'},{t:'拠点'},{t:'最終接触'},{t:'名刺取得'},{t:'この行で使う AI'}],
    PCONTACT.slice().sort((a, b) => a[6] < b[6] ? -1 : 1).map(c => {
      const stale = c[6] < '2026-08-01';
      const same = c[2] === c[3];
      return '<tr data-cu="' + c[4] + '"><td class="nw"><b>' + c[0] + '</b></td>' +
        '<td class="nw"><span class="st ' + (c[1] === 'zh' ? 'st2' : 'st1') + '">' + (c[1] === 'zh' ? '中' : '日') + '</span></td>' +
        '<td class="nw">' + c[2] + '</td>' +
        '<td class="nw">' + (same ? '<span class="m">原文と同じ</span>' : c[3]) + '</td>' +
        '<td class="nw">' + c[4] + '</td><td class="nw">' + c[5] + '</td>' +
        '<td class="nw">' + (stale ? '<span class="due">' + c[6] + '</span>' : c[6]) + '</td>' +
        '<td class="nw">' + c[7] + '</td>' +
        '<td><button class="aibtn" type="button" data-hist="' + c[0] + '" style="--cat-accent:var(--action-primary)">' +
          '<span class="nm">接触履歴</span><span class="how">' + PHIST.filter(h => h[0] === c[0]).length + ' 件</span></button> ' +
          prowAi(['gn8', 'cv2', 'lg4'], { scr: 'cust', id: c[4] }) + pbackContainer('cust', c[4]) + '</td></tr>';
    }).join(''))}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>氏名の右の「接触履歴」から、その人との往復が全部見られます。</b>最終接触が古い人を見つけて、そのまま何があったかを確かめる——という順で辿れるようにしています。履歴は会議・訪問・メール・To Do から自動で積まれ、人が書き足すものではありません。</div>
   <div class="note" style="margin-top:8px"><b>顧客を選ぶと担当者が絞られます。</b>上のチップか、顧客テーブルの社名を押してみてください。顧客 1 — n 担当者 の関連で持つので、入力フォームでも「顧客を選ぶと担当者の候補がその顧客のぶんだけになる」カスケード選択になります。案件 → 顧客 → 担当者 と 3 段にもできます。</div>
   <div class="note" style="margin-top:8px"><b>名刺管理そのものを NocoBase に持ちます。</b>外部の名刺管理システムは使いません。名刺の画像は添付フィールド（File manager・無料）に保存し、担当者・顧客は普通のテーブルです。撮る操作はモバイル画面から。</div>
   <div class="note" style="margin-top:8px"><b>OCR と項目抽出は Dify 側です。</b>NocoBase の公式ドキュメントにある読み取りは QR・バーコードだけで、<b>OCR の記載はありません</b>。名刺を読む部分は Dify のアプリが受け持ち、Workflow の HTTP request で呼びます（無料の範囲）。</div>
   <div class="note" style="margin-top:8px"><b>言語別に抽出します。</b>中国拠点の名刺は日本語・中国語・英語が混ざり、同じ肩書きでも表記が違います（主管／主任、部长／部長、经理／General Manager）。裏表で言語が違う名刺もあります。<b>名刺の原文はそのまま残し、社内表記を別の列で持ちます</b>——上の表の 3 列目と 4 列目です。片方だけ持つと、本人に確認するときに原文が分からなくなります。</div>
   <div class="note" style="margin-top:8px"><b>人物は架空世界マスタの実在レコードです。</b>青嶺精工 3 名は <code>data/world/mfg/people.csv</code>、碧洋銀行 3 名は <code>data/world/fin/people.csv</code>。マスタは元から <code>title_ja</code> / <code>title_zh</code> / <code>title_en</code> を持っているので、抽出先の列がそのまま用意されています。</div>
   <div class="pn blk">本番：呼び先が Dify Enterprise。添付の保存先はローカルから S3 / Aliyun OSS に替わりうるが、テーブルと Workflow は同一</div>
  </div>
 </section>

 <section class="block doc-dev">
  <header><h2>名刺 1 枚が担当者になるまで</h2><span class="sub">どこが NocoBase で、どこが Dify か</span></header>
  <div class="body flush">
  ${ptbl([{t:'手順'},{t:'やること'},{t:'どこ'},{t:'エディション'}], [
    ['0', '外部の名刺サービスの書き出し（CSV）を取り込む｜任意', 'NocoBase｜インポート', '無料'],
    ['1', 'モバイル画面で名刺を撮る（表・裏）', 'NocoBase｜添付フィールド', '無料'],
    ['2', '添付の保存をきっかけに Workflow が起動', 'NocoBase｜Workflow', '無料'],
    ['3', '画像を Dify に渡す', 'NocoBase｜HTTP request ノード', '無料'],
    ['4', '名刺の言語を判定（日／中／英。表裏で違えば両方）', 'Dify', '—'],
    ['5', '氏名・会社・部門・役職・拠点・電話・メールを抽出', 'Dify', '—'],
    ['6', '役職を社内表記に寄せる（主管 → 主任 など）', 'Dify｜用語集を参照', '—'],
    ['7', '同じ人が既にいないか候補を出す', 'NocoBase｜Workflow', '無料'],
    ['8', '人が確認して担当者レコードを確定', 'NocoBase｜画面', '無料']
  ].map(r => '<tr><td class="nw"><b>' + r[0] + '</b></td><td>' + r[1] + '</td><td class="nw">' + r[2] + '</td>' +
    '<td class="nw">' + (r[3] === '—' ? '<span class="m">—</span>' : r[3]) + '</td></tr>').join(''))}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>入口は 2 つあります。</b>その場で撮る（1〜）か、既に使っている名刺サービスの書き出しをまとめて入れる（0）か。既存の名刺サービスは会社名・部署・役職・氏名・連絡先を書き出せるものが多いので、<b>過去分は 0 で入れて、以後は 1 で増やす</b>のが素直です。ただし書き出しの項目は社内表記に寄っていないので、6 の正規化は両方の入口で通します。</div>
   <div class="note" style="margin-top:8px"><b>7 の重複判定を自動で確定させません。</b>同姓同名・異動・旧名刺があるので、候補を出すところで止めて人が決めます。誤って統合すると接触履歴が混ざり、元に戻せません。</div>
   <div class="note" style="margin-top:8px"><b>未確認が 1 つあります。</b>添付フィールドは多対多の中間テーブルを自動で作る仕組みなので、業務テーブルを外部データソース（NocoBase が触らない DB）に置いた場合に添付を付けられるかは、公式ドキュメントに記載がありません。名刺画像だけ NocoBase 側の DB に置く形が無難ですが、確認が要ります。</div>
  </div>
 </section>

 <section class="block blk-ai">
  <header><h2>${pesc(pt('screenAi'))}</h2></header>
  <div class="body">
   ${paiRow(pscreenAiIds('cust'))}
   <div class="note" style="margin-top:10px"><b>「名刺の読み取りと項目抽出（日中英）」はカタログに無いので新規です。</b>名刺管理そのものは NocoBase に持ち、AI が受け持つのは読み取りと項目抽出だけ、という切り分けです。製造業カタログにも金融カタログにもありません。分類と管理番号は実装時に採番します（CLAUDE.md §2-11 は分類コード＋2 桁通番）。</div>
   <div class="note" style="margin-top:8px"><b>ここがカタログとの接続点です。</b>顧客 = 青嶺精工・碧洋銀行にすると、自部門の顧客を見ている画面から、その顧客向けに作った AI カタログへ地続きになります（製造業 49 サービス／金融 29 サービス）。</div>
   <div class="note" style="margin-top:8px"><b>自社は架空の日系 SIerです（PM 確定）。α 社・β 社は顧客側の仮置きです。</b>新しい名前は <code>data/world/</code> に足してから使う決まり（CLAUDE.md §2-13）なので、実装前にマスタへ登録します。</div>
  </div>
 </section>
</div>`;
};

V.proj = () => {
  const board = PSTAGE.map(st => {
    const [key, label, color] = st;
    const cards = PDEALS.filter(d => d.sg === key);
    return '<div class="col" style="--stage:' + color + '">' +
      '<div class="ch"><b>' + label + '</b><span class="n" id="n-' + key + '">' + cards.length + '</span>' +
      '<span class="amt" id="a-' + key + '">' + psum(cards, d => d.amt).toFixed(1) + '</span></div>' +
      cards.map(d => '<article class="card" data-deal="' + d.id + '" data-cu2="' + d.cu + '" data-team="' + (PORG.team[d.ow] || '—') + '">' +
        '<b>' + d.nm + '</b>' +
        '<div class="cu">' + d.cu + '</div>' +
        '<div class="mt"><span class="big">' + d.amt.toFixed(1) + '</span>' +
        (pinPre(d) ? '<span class="prob">確度 ' + d.p + '%</span>' : (d.rag ? pragChip(d.rag) : '')) +
        '</div>' +
        '<div class="mt">' + d.id + '<span>' + d.ow + '</span><span>' + d.due + '</span></div>' +
        '<div class="rowai">' + prowAi(PSTAGE_AI[d.sg], { scr: 'proj', id: d.id }) + '</div>' +
        pbackContainer('proj', d.id) +
        '</article>').join('') +
      '</div>';
  }).join('');

  return `
<div class="grid">
 <section class="block">
  <header><h2>パイプライン</h2><span class="sub" id="pipeCount">引合から検収まで 10 件</span><span class="sp"></span>
   <span class="legend">
    <span>受注前 <b style="color:var(--text-heading)" id="pipePre">${PIPE_TOTAL.toFixed(1)}</b>（確度加重 <span id="pipeW">${PIPE_W.toFixed(1)}</span>）</span>
    <span>受注後 <b style="color:var(--text-heading)" id="pipePost">${BACKLOG.toFixed(1)}</b></span>
    <span>単位：百万円</span>
   </span></header>
  <div class="body" style="padding-bottom:0;display:flex;gap:14px;flex-wrap:wrap;align-items:center">
   <span style="font-size:11px;color:var(--text-muted);letter-spacing:.05em">顧客</span>
   <span class="chips" id="pipeCu">
    <button class="chip" type="button" data-pcu="" aria-pressed="true">すべて</button>
    ${PCUST.map(c => '<button class="chip" type="button" data-pcu="' + c.id + '">' + c.id + '</button>').join('')}
   </span>
   <span style="font-size:11px;color:var(--text-muted);letter-spacing:.05em">担当チーム</span>
   <span class="chips" id="pipeTeam">
    <button class="chip" type="button" data-pteam="" aria-pressed="true">すべて</button>
    <button class="chip" type="button" data-pteam="製造">製造</button>
    <button class="chip" type="button" data-pteam="金融">金融</button>
    <button class="chip" type="button" data-pteam="営業">営業</button>
   </span>
  </div>
  <div class="body flush"><div class="board">${board}</div></div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>顧客と担当チームで絞れます。</b>ボードも一覧も同時に絞られ、<b>ステージごとの件数・金額と、受注前後の合計も計算し直します</b>。合計が変わらないと「この顧客のパイプラインはいくらか」が分からないためです。チームは要員テーブルの所属から引いています（篠崎・蔡＝製造、黄＝金融、村井＝営業）。</div>
   <div class="note" style="margin-top:8px"><b>ステージごとに呼べる AI が変わります。</b>引合ではニュース収集、提案では提案書ドラフト、見積では原価計算、進行中では報告レビュー。カードのボタンは<b>そのステージに合ったものだけ</b>が出ます。「出す画面」ではなく「出すステージ」で決まる、という形です。</div>
   <div class="pn blk">本番：ステージの定義は PostgreSQL の <code>deal_stages</code> に置く。デモと本番で同じ DDL を流すので、ステージを増やしても両方に同時に入る</div>
  </div>
 </section>

 <section class="block">
  <header><h2>一覧</h2><span class="sub" id="dealCount">同じデータを表で見る</span></header>
  <div class="body flush"><div class="tw" id="dealList"></div></div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>見出しを押すと並べ替わります</b>（もう一度押すと逆順）。<b>見出しの下の選択で、その列だけで絞れます。</b>顧客・担当・ステージ・状態の 4 列に付けました。上のチップとは別に効きます——チップは「この顧客のパイプライン全体」を見るため、見出しの絞り込みは「一覧の中で探す」ためです。</div>
  </div>
 </section>

 <section class="block blk-ai">
  <header><h2>${pesc(pt('screenAi'))}</h2></header>
  <div class="body">
   ${paiRow(pscreenAiIds('proj'))}
   <div class="note" style="margin-top:10px"><b>行の文脈を渡すのがポイントです。</b>「報告レビュー」を Dify の画面で単体で開くと、案件名も期間も自分で打ち込むことになります。案件カードのボタンから呼べば、案件 id・顧客・ステージ・前回報告が自動で載ります。<b>これが「メニューの背後に置く」ことの中身です。</b></div>

   <div style="margin-top:14px">
    <div style="font-size:11px;color:var(--text-secondary);margin-bottom:7px">カタログに無い — 追加候補</div>
    <div class="ai">
     <span class="cand"><span class="tag">候補</span>引合の確度を過去案件から推定する</span>
     <span class="cand"><span class="tag">候補</span>失注理由を蓄積して傾向を出す</span>
     <span class="cand"><span class="tag">候補</span>過去提案を横断検索して再利用する</span>
    </div>
    <div class="note" style="margin-top:9px">パイプラインを並べると、<b>カタログ 67 件がカバーしていない業務</b>が見えます。この 3 つは自部門（SIer）固有で、製造業カタログにも金融カタログにもありません。<b>ユースケースの追加候補</b>として置いています。押しても何も起きません。</div>
   </div>
  </div>
 </section>
</div>`;
};

V.act = () => `
<div class="grid g-main">
 <section class="block">
  <header><h2>Action</h2><span class="sub">5 件（超過 2）</span></header>
  <div class="body flush">
  ${ptbl([{t:'Action'},{t:'案件'},{t:'担当'},{t:'期限'},{t:'残'},{t:'優先'},{t:'この行で使う AI'}],
    PACT.map(a => '<tr><td><b>' + a[2] + '</b><span class="m">' + a[0] + '</span></td><td>' + a[1] + '</td><td>' + a[3] + '</td>' +
      '<td>' + a[4] + '</td><td>' + (a[5].startsWith('超過') ? '<span class="due">' + a[5] + '</span>' : a[5]) + '</td>' +
      '<td>' + a[6] + '</td><td>' + prowAi(['lg4', 'gn5']) + '</td></tr>').join(''))}
  </div>
 </section>

 <div class="grid">
  <section class="block blk-ai">
   <header><h2>${pesc(pt('screenAi'))}</h2></header>
   <div class="body">
    ${paiRow(pscreenAiIds('act'))}
    <div class="note" style="margin-top:10px"><b>GN-06 はこの画面の相棒です。</b>メール・チャット・議事録から「頼まれたまま放置されている仕事」を拾い、To Do 候補として起票します。裏で回して結果をテーブルに書く型（Workflow の HTTP request）。</div>
   </div>
  </section>
  <section class="block">
   <header><h2>AI が拾った To Do 候補</h2><span class="sub" id="candCount">未確認 3 件</span></header>
   <div class="body">
    <ul class="list" id="candList"></ul>
    <div class="note" style="margin-top:10px"><b>拾ったものは、そのままでは To Do になりません。</b>「採用」を押して初めて起票され、番号が付きます。誤検出がそのまま仕事にならないようにするためです。</div>
    <div class="note" style="margin-top:8px"><b>「見送り」も残します。</b>消さずに見送りとして残すのは、<b>同じものを来週また拾ってくるのを止めるため</b>です。見送りの記録が無いと、AI は毎週同じ候補を出し続けます。</div>
   </div>
  </section>
 </div>
</div>`;

/* ---------- システム稼働状況（sysops-usecase PR-4。設計書 §6） ---------- */
/** 状態チップ（.rag。lv=g/y/r/n の 4 色だけ。7 状態はラベルの文字で区別する。§6-3） */
function pSysChip(state) {
  const st = PSYSST[state];
  return '<span class="rag ' + st.lv + '">' + pesc(PL(st)) + '</span>';
}
V.sys = () => {
  const nowP = (typeof PSYSNOW !== 'undefined' ? PSYSNOW : []).find(p => p.id === pstate.now) || PSYSNOW[0];
  const rows = pSysRows();
  /* スコープで絞ったあと、「重大障害 → それ以外」の 2 段に安定ソートする（§15-2 決定 A-1 の 2。
     Array#sort は仕様上 stable なので、段の中は PSYS の宣言順＝rows の元の順が保たれる。
     並べ替え UI は足さない） */
  const scoped = rows.filter(r => pSysInScope(r, pstate.sysScope))
    .sort((a, b) => (pSysIsMajor(a) ? 0 : 1) - (pSysIsMajor(b) ? 0 : 1));
  const clients = [...new Set(rows.map(r => r.client))];
  const filtered = scoped.filter(r => (!pstate.sysCu || r.client === pstate.sysCu) && (!pstate.sysSt || r.state === pstate.sysSt));
  const cnt = { incident: 0, warn: 0, planned: 0 };
  scoped.forEach(r => {
    if (r.state === 'incident') cnt.incident++;
    else if (r.state === 'degraded' || r.state === 'blocked') cnt.warn++;
    else if (r.state === 'maint' || r.state === 'batch' || r.state === 'offhours') cnt.planned++;
  });
  const availRate = '99.42'; // 当月の稼働率（デモの代表値。本番は §6-7 の式で system_events から集計する）

  const scopeBtn = (val, label) => '<button class="chip" type="button" data-act="sysscope" data-val="' + val +
    '" aria-pressed="' + (pstate.sysScope === val) + '">' + label + '</button>';

  const rowsHTML = filtered.length ? filtered.map(r => {
    /* 行内 AI（設計書 §15-2 決定 D）。列は増やさず「直近の出来事」列の中に置く。 */
    const rowAiIds = pSysRowAiIds(r);
    const rowAiHTML = (rowAiIds.length ? prowAi(rowAiIds, { scr: 'sys', id: r.id }) : '') + pbackContainer('sys', r.id);
    return '<tr' + (pSysIsMajor(r) ? ' class="sev"' : '') + '>' +
    '<td>' + pSysChip(r.state) + '</td>' +
    '<td class="nw"><b>' + pesc(r.name) + '</b><span class="m">' + r.id + '</span></td>' +
    '<td class="nw">' + pesc(r.client) + '</td>' +
    '<td class="nw">' + (r.project ? r.project : '<span class="m">—</span>') + '</td>' +
    '<td class="nw">' + pesc(r.owner) + '</td>' +
    '<td class="nw">' + r.criticality + '</td>' +
    '<td class="nw">' + pesc(r.hours) + '</td>' +
    '<td class="num">' + r.since + '</td>' +
    '<td>' + pesc(r.lastEvent) + rowAiHTML + '</td></tr>';
  }).join('')
    : '<tr><td colspan="9" class="m">該当するシステムはありません</td></tr>';

  return `
<div class="grid">
 <section class="block">
  <header><h2>システムの状態</h2><span class="sub">${pesc(nowP.label)}（上海）</span></header>
  <div class="body">
   <div class="sysbar">
    <span class="chips" id="sysScopeSw" aria-label="スコープ">
     ${scopeBtn('mine', '自分が使う')}${scopeBtn('own', '担当')}${scopeBtn('all', '全社')}
    </span>
    <span class="pn">このセグメントは本番では出ません（ロールで決まります）。CIO・CEO には「障害発生中」の絞り込みが既定で当たります。</span>
    <select class="selctl" data-act="sysf" data-key="cu">
     <option value="">顧客（すべて）</option>
     ${clients.map(c => '<option value="' + pesc(c) + '"' + (pstate.sysCu === c ? ' selected' : '') + '>' + pesc(c) + '</option>').join('')}
    </select>
    <select class="selctl" data-act="sysf" data-key="st">
     <option value="">状態（すべて）</option>
     ${Object.keys(PSYSST).map(k => '<option value="' + k + '"' + (pstate.sysSt === k ? ' selected' : '') + '>' + pesc(PL(PSYSST[k])) + '</option>').join('')}
    </select>
   </div>
   <div class="tiles" style="margin-top:12px">
    <div class="tile${cnt.incident ? ' alarm' : ''}"><div class="lbl">障害発生中</div><div class="num">${cnt.incident}<small>件</small></div></div>
    <div class="tile"><div class="lbl">縮退・閉塞</div><div class="num">${cnt.warn}<small>件</small></div></div>
    <div class="tile"><div class="lbl">予定どおり停止</div><div class="num">${cnt.planned}<small>件</small></div></div>
    <div class="tile"><div class="lbl">当月の稼働率</div><div class="num">${availRate}<small>%</small></div></div>
   </div>
  </div>
 </section>

 <section class="block">
  <header><h2>システム一覧</h2><span class="sub">${filtered.length} 件</span></header>
  <div class="body flush">
   <div class="tw systbl"><table><thead><tr>
    <th>状態</th><th>システム</th><th>顧客／自社</th><th>案件</th><th>担当</th><th>重要度</th>
    <th>サービス時間</th><th class="num">継続</th><th>直近の出来事</th>
   </tr></thead><tbody>${rowsHTML}</tbody></table></div>
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note">「サービス時間対象外」と「夜間バッチ処理中」は台帳に保存していません。表示のたびに、システム台帳のサービス時間・バッチ窓と、いまの時刻から導いています。</div>
   <div class="pn blk">本番：状態は運用監視ツールからのポーリング（5 分間隔）で system_events に積み、この一覧はそこから導出します</div>
  </div>
 </section>

 <section class="block blk-ai">
  <header><h2>${pesc(pt('screenAi'))}</h2></header>
  <div class="body">
   ${paiRow(pscreenAiIds('sys'))}
  </div>
 </section>
</div>`;
};

V.ppl = () => {
  const attRows = PATT.map(a => {
    const rate = a[5] / a[4] * 100, low = rate < 30;
    return '<tr><td class="nw"><b>' + a[0] + '</b></td><td class="nw">' + a[1] + '</td>' +
      '<td class="num">' + a[2] + '</td>' +
      '<td class="num"' + (a[3] >= 15 ? ' style="color:var(--status-danger-text)"' : '') + '>' + a[3] + '</td>' +
      '<td class="num">' + a[4] + '</td><td class="num">' + a[5] + '</td><td class="num">' + (a[4] - a[5]) + '</td>' +
      '<td class="num">' + (low ? '<span class="due">' + rate.toFixed(0) + '%</span>' : rate.toFixed(0) + '%') + '</td>' +
      '<td class="num">' + (a[7] < 5 ? '<span class="due">' + a[7] + ' / 5</span>' : a[7] + ' / 5') + '</td>' +
      '<td>' + (a[6] ? a[6] : '<span class="m">—</span>') + '</td></tr>';
  }).join('');

  const trRows = PTRAIN.map(t => {
    const pct = t[2] / 5 * 100;
    return '<tr><td class="nw">' + t[0] + '</td><td><b>' + t[1] + '</b></td>' +
      '<td style="min-width:120px"><span class="bar"><i style="background:' +
        (t[0] === '必須' && pct < 100 ? 'var(--rag-y)' : 'var(--action-primary)') + ';width:' + pct + '%"></i></span></td>' +
      '<td class="num">' + t[2] + ' / 5</td>' +
      '<td class="nw">' + (t[3] ? (t[2] < 5 ? '<span class="due">' + t[3] + '</span>' : t[3]) : '<span class="m">—</span>') + '</td>' +
      '<td>' + prowAi(['po3', 'po1']) + '</td></tr>';
  }).join('');

  return `
<div class="grid">
 <section class="block">
  <header><h2>稼働</h2><span class="sub">5 名</span></header>
  <div class="body flush">
  ${ptbl([{t:'氏名'},{t:'Role'},{t:'担当案件'},{t:'稼働',n:1},{t:'Skill'}],
    PPEOPLE.map(p => '<tr><td class="nw"><b>' + p[0] + '</b></td><td class="nw">' + p[1] + '</td><td>' + p[2] + '</td>' +
      '<td class="num">' + p[3] + '%</td><td>' + p[4] + '</td></tr>').join(''))}
  </div>
 </section>

 <section class="block">
  <header><h2>勤怠・年休</h2><span class="sub">2026 年 9 月分 ／ 所定 160 時間</span><span class="sp"></span>
   <span class="sub">残業 15 時間以上・年休取得率 30% 未満は赤</span></header>
  <div class="body flush">
  ${ptbl([{t:'氏名'},{t:'Role'},{t:'実働',n:1},{t:'残業',n:1},{t:'年休 付与',n:1},{t:'取得',n:1},{t:'残',n:1},{t:'取得率',n:1},{t:'必須研修',n:1},{t:'備考'}], attRows)}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>篠崎 悠真の年休取得率が 21% です。</b>P-2411 が Red で、要員の欠員を本人が埋めています。<b>案件の状態と勤怠が同じポータルにあるので、原因が並んで見えます</b>——これが分かれたシステムだと気づけません。</div>
   ${paiRow(['kn3'])}
   <div class="note" style="margin-top:8px">年休の規程（付与日数・繰越・消化義務）は <b>KN-03 が稼働中</b>なので、この画面から直接聞けます。</div>
   <div class="pn blk">本番：勤怠システムから日次で取り込む（片方向）。ポータルは集計済みの値だけを持ち、打刻の生データは持たない</div>
  </div>
 </section>

 <section class="block">
  <header><h2>個人別の KPI 達成</h2><span class="sub">本人と上長だけが見られる</span><span class="sp"></span>
   <span class="sub">個人に割り当てられる指標だけを置く</span></header>
  <div class="body flush">
  ${ptbl([{t:'氏名'},{t:'必須研修',n:1},{t:'サーベイ回答',n:1},{t:'期限超過 To Do',n:1},{t:'担当案件の納期遵守',n:1},{t:'年休取得',n:1}],
    PKPI.map(k => {
      const c = (v, lim) => v < lim ? '<span class="due">' + v + '%</span>' : v + '%';
      return '<tr><td class="nw"><b>' + k[0] + '</b></td>' +
        '<td class="num">' + c(k[1], 100) + '</td>' +
        '<td class="num">' + c(k[2], 100) + '</td>' +
        '<td class="num">' + (k[3] > 0 ? '<span class="due">' + k[3] + '</span>' : '0') + '</td>' +
        '<td class="num">' + c(k[4], 100) + '</td>' +
        '<td class="num">' + c(k[5], 30) + '</td></tr>';
    }).join(''))}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>置いた指標は 5 つだけです。</b>KPI 9 観点のうち、<b>本人の行動で動くもの</b>に絞りました。売上・粗利・案件の R/Y/G は案件単位の指標で、個人に割り付けると「Red 案件の PM が低く出る」——本人のせいとは限らないのに——ということが起きます。</div>
   <div class="note" style="margin-top:8px"><b>勤怠と同じ表に並べていません。</b>並べると「残業が多い人＝頑張っている」「年休を取る人＝……」という読み方を誘発します。同じ人の話でも、<b>評価に近い数字と労務の数字は別のブロックに置きます</b>。</div>
   <div class="note" style="margin-top:8px"><b>閲覧範囲を先に決める必要があります。</b>個人別の達成率は人事評価に近い情報です。本人と上長のみ（PMO は集計のみ）を既定にしていますが、ここは決めてから公開する項目です。無料版でもロールとデータスコープで実現できます。</div>
   <div class="pn blk">本番：評価制度との関係を人事と詰める。ポータルは「評価そのもの」は持たない</div>
  </div>
 </section>

 <section class="block">
  <header><h2>研修の実施状況</h2><span class="sub">部門 5 名 ／ 必須 5・任意 5</span><span class="sp"></span>
   <span class="sub">必須で未了があるものは期限を赤で出す</span></header>
  <div class="body flush">
  ${ptbl([{t:'区分'},{t:'研修'},{t:'受講率'},{t:'受講',n:1},{t:'期限'},{t:'この行で使う AI'}], trRows)}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>必須研修 3 本に未了が残っています。</b>期限 09-30 の 2 本（コンプライアンス基礎・情報セキュリティ）は、<b>To Do に自動で起票する</b>のが自然です。研修テーブルから To Do を作る——画面をまたいで 1 本につながります。</div>
   <div class="pn blk">本番：研修システム（LMS）から受講実績を取り込む。個人の成績は持たず、受講済/未受講だけを持つ</div>
  </div>
 </section>

 <section class="block blk-ai">
  <header><h2>${pesc(pt('screenAi'))}</h2></header>
  <div class="body">
   ${paiRow(pscreenAiIds('ppl'))}
   <div style="margin-top:14px">
    <div style="font-size:11px;color:var(--text-secondary);margin-bottom:7px">カタログに無い — 追加候補</div>
    <div class="ai">
     <span class="cand"><span class="tag">候補</span>年休の取り残しを検知して取得計画を促す</span>
     <span class="cand"><span class="tag">候補</span>残業の偏りから要員リスクを早期に出す</span>
    </div>
   </div>
  </div>
 </section>
</div>`;
};

V.trn = () => {
  const badge = st =>
    st === '未受講' || st === '未回答' ? '<span class="due">' + st + '</span>' :
    st === '受講中' ? '<span class="st st2">受講中</span>' :
    st === '推奨' ? '<span class="st stn">推奨</span>' :
    '<span class="st st1">' + st + '</span>';
  const rows = PMYITEM.map(m =>
    '<tr data-kind="' + m[0] + '"><td class="nw">' + m[0] + '</td>' +
    '<td><b>' + m[1] + '</b></td>' +
    '<td class="nw">' + badge(m[2]) + '</td>' +
    '<td class="nw">' + m[3] + '</td>' +
    '<td>' + (m[4] ? m[4] : '<span class="m">—</span>') + '</td>' +
    '<td class="nw">' + (m[5] ? '<span class="no">' + m[5] + '</span>' : '<span class="m">—</span>') + '</td>' +
    '<td>' + (PTODO_STATE.includes(m[2]) ? prowAi(m[0] === 'サーベイ' ? ['po1'] : ['pt8']) : '<span class="m">—</span>') + '</td></tr>').join('');
  const todo = PMYITEM.filter(m => PTODO_STATE.includes(m[2])).length;
  const done = PMYITEM.filter(m => m[2] === '受講済' || m[2] === '回答済').length;
  const reco = PMYITEM.filter(m => m[2] === '推奨').length;

  return `
<div class="grid">
<div class="grid g-main">
 <section class="block">
  <header><h2>自分の研修・サーベイ</h2><span class="sub" id="trnCount">${PMYITEM.length} 件</span><span class="sp"></span>
   <span class="chips" id="kindChips">
    <button class="chip" type="button" data-kind="" aria-pressed="true">すべて</button>
    <button class="chip" type="button" data-kind="必須研修">必須研修</button>
    <button class="chip" type="button" data-kind="任意研修">任意研修</button>
    <button class="chip" type="button" data-kind="サーベイ">サーベイ</button>
   </span></header>
  <div class="body flush">
  ${ptbl([{t:'区分'},{t:'名称'},{t:'状態'},{t:'期限・受講日'},{t:'備考'},{t:'To Do'},{t:'この行で使う AI'}], rows)}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>研修とサーベイを 1 本の一覧にしました。</b>本人から見ればどちらも「会社から来ていて、やると消えるもの」で、別々に置くと片方を見落とします。区分で絞れるようにしてあります。</div>
   <div class="note" style="margin-top:8px"><b>To Do 列があるものは、To Do 画面にも同じものが出ています</b>（A-0930・A-0931・A-0940・A-0941）。未受講・受講中・未回答の 4 件です。<b>推奨は To Do にしません</b>——受けると決める前のものまで積むと、本当にやるべきものが埋もれるためです。申し込んだ時点で To Do に変わります。</div>
   <div class="note" style="margin-top:8px">推奨の 2 本は担当案件から出しています。P-2425 なら PostgreSQL 設計、P-2402 なら Dify / RAG 実装。要員テーブルの担当案件と Skill を見て並べるので、人が選ばなくても出ます。</div>
   <div class="pn blk">本番：受講申込は LMS へ、サーベイの回収はポータル内（Public forms）。一覧の形は同じ</div>
  </div>
 </section>

 <div class="grid">
  <section class="block">
   <header><h2>自分の状況</h2></header>
   <div class="body"><div class="tiles">
    <div class="tile alarm"><div class="lbl">To Do に出ている</div><div class="num">${todo}<small>件</small></div><div class="delta">未受講 1 ／ 受講中 1 ／ 未回答 2</div></div>
    <div class="tile"><div class="lbl">完了</div><div class="num">${done}<small>件</small></div><div class="delta">今年度</div></div>
    <div class="tile"><div class="lbl">推奨</div><div class="num">${reco}<small>件</small></div><div class="delta">To Do には出さない</div></div>
   </div></div>
  </section>

  <section class="block blk-ai">
   <header><h2>${pesc(pt('screenAi'))}</h2></header>
   <div class="body">
    ${paiRow(pscreenAiIds('trn'))}
    <div class="note" style="margin-top:10px"><b>どれも構想段階です。</b>実機はまだありません。押すと「何を渡して何が返るか」だけが出ます。</div>
   </div>
  </section>
 </div>
</div>

 <section class="block">
  <header><h2>サーベイの種類と実施状況</h2><span class="sub">6 種 ／ 部門</span><span class="sp"></span>
   <span class="sub">回収率 60% 未満は赤</span></header>
  <div class="body flush">
  ${ptbl([{t:'種類'},{t:'頻度'},{t:'対象'},{t:'回収率'},{t:'回収',n:1},{t:'つながる KPI'},{t:'この行で使う AI'}],
    PSURVEY.map(v => {
      const low = v[4] < 60;
      return '<tr><td class="nw"><span class="no">' + v[0] + '</span> <b>' + v[1] + '</b></td>' +
        '<td class="nw">' + v[2] + '</td><td class="nw">' + v[3] + '</td>' +
        '<td style="min-width:110px"><span class="bar"><i style="background:' + (low ? 'var(--rag-r)' : 'var(--action-primary)') + ';width:' + v[4] + '%"></i></span></td>' +
        '<td class="num">' + (low ? '<span class="due">' + v[4] + '%</span>' : v[4] + '%') + '</td>' +
        '<td class="nw">' + v[5] + '</td>' +
        '<td>' + prowAi(['po1', 'gn5']) + '</td></tr>';
    }).join(''))}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>サーベイは KPI の入口です。</b>K7 チームビルディングと K8 社内施策を KPI 画面で「測っていない」と出しましたが、測る手段がこれです。SV1 がエンゲージメント、SV5 が改善提案、SV6 が 1on1 の実施率。<b>サーベイを置いて初めて K7・K8 の数字が立ちます。</b></div>
   <div class="note" style="margin-top:8px"><b>SV4 顧客満足度の回収率が 38% です。</b>社内サーベイと違って To Do に積めない相手なので、依頼の出し方を変えないと上がりません。検収の連絡に同送する、担当者一覧から直接送る、などが要ります。</div>
   <div class="note" style="margin-top:8px"><b>自由記述をどう扱うかが山です。</b>集計はできても読み切れないのが普通で、そこが放置されると次回の回収率が落ちます（答えても何も変わらない、と思われるため）。</div>
   <div style="margin-top:14px">
    <div style="font-size:11px;color:var(--text-secondary);margin-bottom:7px">カタログに無い — 追加候補</div>
    <div class="ai">
     <span class="cand"><span class="tag">候補</span>自由記述を論点ごとにまとめ、前回との差を出す</span>
     <span class="cand"><span class="tag">候補</span>サーベイの結果から施策を起こして To Do に落とす</span>
    </div>
   </div>
   <div class="pn blk">本番：配布・回収もポータル内（Public forms・無料）。回答を匿名にするかを先に決める</div>
  </div>
 </section>

 <section class="block">
  <header><h2>研修の実施状況（部門）</h2><span class="sub">要員画面にあります</span></header>
  <div class="body">
   <div class="note">部門全体の受講率は<b>「要員」画面</b>に置いています。ここは自分の一覧、あちらは部下と部門の状況、という分け方です。<b>見る人が違うと、同じデータでも置き場所が変わります。</b></div>
  </div>
 </section>
</div>`;
};

V.meet = () => `
<div class="grid">
 <section class="block">
  <header><h2>会議</h2><span class="sub">4 件</span></header>
  <div class="body flush">
  ${ptbl([{t:'会議'},{t:'日付'},{t:'出席'},{t:'議事録'},{t:'この行で使う AI'}],
    PMEET.map(m => '<tr><td><b>' + m[1] + '</b><span class="m">' + m[0] + '</span></td><td>' + m[2] + '</td><td>' + m[3] + '</td>' +
      '<td>' + (m[4].includes('未') ? '<span class="due">' + m[4] + '</span>' : m[4]) + '</td>' +
      '<td>' + prowAi(m[1].includes('来訪') ? ['gn7', 'gn4'] : ['dc2', 'gn4']) + '</td></tr>').join(''))}
  </div>
 </section>
 <section class="block blk-ai">
  <header><h2>${pesc(pt('screenAi'))}</h2></header>
  <div class="body">
   ${paiRow(pscreenAiIds('meet'))}
   <div class="note" style="margin-top:10px"><b>DC-02 は稼働中です。</b>議事録から返ってくる「次回論点」と「To Do 候補」を、そのまま To Do テーブルに落とします。<b>会議 → To Do → 案件が 1 本につながる</b>のがポータルに置く意味です。</div>
  </div>
 </section>
</div>`;

V.know = () => {
  const row = (k, stale) => '<tr><td class="nw"><span class="no">' + k[0] + '</span> <b>' + k[1] + '</b>' +
    (k[5] ? '<span class="m">着任時に読む</span>' : '') + '</td>' +
    '<td>' + k[2].map(x => '<span class="chip" style="cursor:default">' + x + '</span>').join(' ') + '</td>' +
    '<td class="num">' + k[3] + '</td>' +
    '<td class="nw">' + k[4] + ' 日</td>' +
    '<td class="nw">' + (stale.includes(k[0]) ? '<span class="due">要見直し ' + (k[0] === 'C1' ? 4 : k[0] === 'D2' ? 6 : 3) + ' 件</span>' : '<span class="m">—</span>') + '</td></tr>';
  const head = [{t:'大分類'},{t:'中分類'},{t:'文書',n:1},{t:'見直しの目安'},{t:'鮮度'}];
  return `
<div class="grid">
 <section class="block doc-user">
  <header><h2>ナレッジの分類（案）</h2><span class="sub">全社 6 ＋ 部門 6 の大分類 ／ 中分類 46</span><span class="sp"></span>
   <span class="sub">文書の中身は Outline 側。ポータルは分類とリンクだけを持つ</span></header>
  <div class="body">
   <div class="note"><b>並びは「基本動作 → 制度 → 個別」です。</b>着任した人が最初に読むもの（C1・C2・C3・C4・D1・D2）を上に置いています。分類を業務の重要度順ではなく<b>読む順</b>で並べると、新しく来た人が迷いません。</div>
  </div>
 </section>

 <section class="block">
  <header><h2>全社ナレッジ</h2><span class="sub">正本は本社 ／ 部門は参照のみ</span><span class="sp"></span>
   <span class="sub">121 文書</span>
   <button class="actbtn sub perm" type="button" data-know="req-fix">修正を依頼する</button>
   <span class="permnote">閲覧のみ</span></header>
  <div class="body flush">
   ${ptbl(head, PKNOW.corp.map(k => row(k, ['C1'])).join(''))}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>ボタンは権限がある人にだけ出ます。</b>全社ナレッジに出るのは「修正を依頼する」だけで、直接直すボタンはありません（正本が本社にあるため）。部門ナレッジには新規作成・修正・統廃合が出ます。上の帯の「編集権限あり」を押すと、権限が無い人の見え方に切り替わります。</div>
   <div class="note" style="margin-top:8px"><b>部門からは直せません。</b>取り込みは片方向・読み取り専用です。部門で「この規程はこう運用している」という注釈を足したくなりますが、<b>それは部門ナレッジ側に書いて全社文書へリンクします</b>。全社文書に部門の解釈を混ぜると、どれが正本か分からなくなります。</div>
   <div class="pn blk">本番：本社の Outline から取り込む。デモは分類と件数だけを持ち、リンク先はダミー</div>
  </div>
 </section>

 <section class="block">
  <header><h2>部門ナレッジ</h2><span class="sub">正本は部門 ／ 部門が直す</span><span class="sp"></span>
   <span class="sub">203 文書</span>
   <button class="actbtn perm" type="button" data-know="new">新規作成</button>
   <button class="actbtn sub perm" type="button" data-know="fix">修正</button>
   <button class="actbtn sub perm" type="button" data-know="merge">統廃合を提案</button>
   <span class="permnote">閲覧のみ</span></header>
  <div class="body flush">
   ${ptbl(head, PKNOW.dept.map(k => row(k, ['D2'])).join(''))}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>D3 顧客と案件は、案件テーブルと紐づきます。</b>案件画面から「この案件の議事録・提案・検収」へ辿れるのはこの分類です。ポータルが持つのは紐づけ（どの案件がどの文書か）だけで、文書そのものは Outline に置いたままです。</div>
   <div class="note" style="margin-top:8px"><b>D2 中国拠点の実務に「要見直し 6 件」が出ています。</b>現地の手続きは変わるのに更新されにくく、古い手順どおりにやって差し戻される、というのが実際に起きます。基本動作ほど古いと害が大きいので、見直しの目安を 90 日と短くしています。</div>
   <div class="pn blk">本番：部門の Outline。認証は AD →(LDAP)→ GitLab →(OIDC)→ Outline</div>
  </div>
 </section>

 <section class="block doc-dev">
  <header><h2>ポータルが持つもの・持たないもの</h2></header>
  <div class="body flush">
  ${ptbl([{t:'項目'},{t:'ポータル'},{t:'Outline'}], [
    ['文書の本文', '持たない', '持つ'],
    ['大分類・中分類', '持つ', '—'],
    ['タイトルとリンク', '持つ', '持つ'],
    ['最終更新日・持ち主', '持つ', '持つ'],
    ['案件・顧客との紐づけ', '持つ', '—'],
    ['鮮度の判定（要見直し）', '持つ', '—'],
    ['閲覧権限', '画面の出し分け', '文書の権限']
  ].map(r => '<tr><td class="nw"><b>' + r[0] + '</b></td>' +
    '<td class="nw">' + (r[1] === '持たない' ? '<span class="m">持たない</span>' : r[1] === '—' ? '<span class="m">—</span>' : r[1]) + '</td>' +
    '<td class="nw">' + (r[2] === '—' ? '<span class="m">—</span>' : r[2]) + '</td></tr>').join(''))}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>分類は Outline の階層を写しません。</b>ポータル側の台帳で持ちます。Outline のコレクション構成は運用で変わるので、そのまま画面の構造にすると、あちらを動かすたびにこちらが壊れます。取り込みのときに「この文書はどの中分類か」を対応づける形にします。</div>
   <div class="note" style="margin-top:8px"><b>未確認が 1 つあります。</b>Outline 側で文書が移動・削除されたときに、ポータルの紐づけをどう追従させるか（定期的に洗い替えるか、リンク切れを検出して出すか）は決めていません。</div>
  </div>
 </section>

 <section class="block blk-ai">
  <header><h2>${pesc(pt('screenAi'))}</h2></header>
  <div class="body">
   ${paiRow(pscreenAiIds('know'))}
   <div class="note" style="margin-top:10px"><b>KN-03 は稼働中</b>で、全社ナレッジの C3 制度・規程を読みます。日本語でも中国語でも、聞いた言語で返ります。KN-04 は部門ナレッジ側で、答えられなかった質問が FAQ の候補として溜まります——<b>溜まった FAQ が、次に足すべき中分類を教えてくれます</b>。</div>
   <div style="margin-top:14px">
    <div style="font-size:11px;color:var(--text-secondary);margin-bottom:7px">カタログに無い — 追加候補</div>
    <div class="ai">
     <span class="cand"><span class="tag">候補</span>取り込んだ文書を中分類に自動で振り分ける</span>
     <span class="cand"><span class="tag">候補</span>全社規程と部門の運用メモの食い違いを検出する</span>
    </div>
   </div>
  </div>
 </section>
</div>`;
};

V.ai = () => {
  const IND = { mfg: '製造業', fin: '金融業', it: 'IT 業' };
  const base = pstate.ind === 'it' ? SVCS : SVCS.filter(s => s.industries.includes(pstate.ind));
  /* place は mock/js/data/catalog.js の SVCS[].place が正本（PR-2。設計書 §4-3）。
     キーが無いもの（未配置）は「置き場所を決めていない」として別集計する（verify §17-c の warn と対）。 */
  const out = base.filter(s => s.place === 'out');
  const inn = base.filter(s => s.place && s.place !== 'out');
  const unplaced = base.filter(s => !s.place);
  const live = base.filter(s => s.st === 1).length;
  const mfgN = SVCS.filter(s => s.industries.includes('mfg')).length;
  const finN = SVCS.filter(s => s.industries.includes('fin')).length;
  const byCat = {};
  out.forEach(s => { (byCat[s.cat] = byCat[s.cat] || []).push(s); });
  const outRows = Object.keys(byCat).map(k => {
    const list = byCat[k];
    const reasons = [...new Set(list.map(s => POUT[s.id] || ''))];
    const cat = CATS.find(c => c.id === k);
    return '<tr><td class="nw"><span class="no" style="color:var(--cat-' + k + ')">' + k.toUpperCase() + '</span> <b>' + pesc(cat ? PL(cat.name) : k) + '</b></td>' +
      '<td class="num">' + list.length + '</td>' +
      '<td>' + list.map(s => '<span class="chip" style="cursor:default">' + psvcCode(s.id) + '</span>').join(' ') + '</td>' +
      '<td>' + reasons.join(' ／ ') + '</td></tr>';
  }).join('');

  return `
<div class="grid">
 <section class="block">
  <header><h2>AI サービス</h2><span class="sub">カタログのサービスをそのまま読む ／ いまの業種：${IND[pstate.ind]}</span></header>
  <div class="body">
   <div class="tiles" style="margin-bottom:14px">
    <div class="tile"><div class="lbl">${IND[pstate.ind]}のサービス</div><div class="num">${pstate.ind === 'it' ? 0 : base.length}<small>件</small></div><div class="delta">${pstate.ind === 'it' ? 'カタログに IT 業種はまだありません' : 'カタログ全体は ' + SVCS.length + ' 件'}</div></div>
    <div class="tile"><div class="lbl">ポータルから辿れる</div><div class="num">${inn.length}<small>件</small></div><div class="delta">${pstate.ind === 'it' ? '製造業・金融業から流用中' : '13 画面のどこかに出る'}</div></div>
    <div class="tile alarm"><div class="lbl">ポータルからは辿れない</div><div class="num">${out.length}<small>件</small></div><div class="delta">顧客・管理部の業務</div></div>
    <div class="tile${unplaced.length ? ' alarm' : ''}"><div class="lbl">置き場所を決めていない</div><div class="num">${unplaced.length}<small>件</small></div><div class="delta">${unplaced.length ? unplaced.map(s => psvcCode(s.id)).join(' ') : 'いまは無し'}</div></div>
    <div class="tile"><div class="lbl">実機が稼働中</div><div class="num">${live}<small>件</small></div><div class="delta">残りは試行版・構想</div></div>
   </div>
   <div class="ai-catalog-card">
    <div class="eyebrow">AI エージェントカタログ</div>
    <div class="title">AI エージェントカタログ</div>
    <div class="meta">${CATS.length} 分類 ／ ${CATS.reduce((a, c) => a + (c.subs ? c.subs.length : 0), 0)} 中分類 ／ ${SVCS.length} サービス ／ ${(typeof PATTERNS !== 'undefined' ? PATTERNS.length : 3)} つの表示パターン</div>
    <a class="cta" href="catalog.html">${pesc(pt('openCatalog'))}</a>
   </div>

   <div class="note" style="margin-top:12px">分類・検索・お気に入り・デモ台本はカタログ側に揃っているので、<b>ここに別の一覧は作りません</b>。この画面がカタログに足すのは「ポータルから辿れるかどうか」だけです。</div>
   ${pstate.ind === 'it' ? `<div class="note"><b>カタログに「IT 業」がまだありません。</b>いまポータルが使っている ${inn.length} 件は、製造業（${mfgN} 件）と金融業（${finN} 件）向けに作ったサービスを流用しています。自部門は IT 業なので、<b>本来は IT 業として持つべき</b>です。追加候補に挙げた 10 件（名刺 OCR・引合の確度推定・失注理由の分析ほか）は、そのまま IT 業の最初のサービスになります。</div>` : `<div class="note"><b>${IND[pstate.ind]}のサービスは、その顧客（${pstate.ind === 'mfg' ? '青嶺精工' : '碧洋銀行'}）の業務向けです。</b>自部門のポータルに置く筋合いのものは少なく、顧客画面からカタログへ辿れれば足ります。</div>`}
  </div>
 </section>

 <section class="block doc-dev">
  <header><h2>ポータルからは辿れない ${out.length} 件</h2><span class="sub">分類ごとの内訳と理由</span><span class="sp"></span>
   <span class="ai" style="gap:6px">
    <span class="cand" style="border-style:solid;border-color:var(--badge-live-fg);color:var(--badge-live-fg)"><span class="tag" style="color:inherit">バッジ案</span>ポータルから使える</span>
    <span class="cand"><span class="tag">バッジ案</span>カタログのみ</span>
   </span></header>
  <div class="body flush">
   ${ptbl([{t:'分類'},{t:'件数',n:1},{t:'管理番号'},{t:'理由'}], outRows)}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>これは欠陥ではありません。</b>${out.length} 件は顧客自身の業務（青嶺精工の製造現場・碧洋銀行の窓口）と管理部の業務（経理の月次）で、自部門のポータルに置く筋合いのものではありません。顧客画面からカタログへ辿れれば足ります。</div>
   <div class="note">見ておく価値があるのは<b>「カタログに増えたのに、まだ画面を決めていないもの」</b>で、いまは ${unplaced.length} 件です${unplaced.length ? '（' + unplaced.map(s => psvcCode(s.id)).join(' ') + '）' : ''}。カタログにサービスが増えたときここが 0 でなくなり、それが「置き場所を決めていない」の合図になります。</div>
   <div class="note"><b>バッジはカタログのデータ層に持たせます。</b>サービスごとに「どのポータル画面・どのステージに出るか」を列で持てば、バッジも配置も同じ 1 か所から決まり、<b>1 行足すだけで画面のボタンが増えます</b>（画面側は直しません）。成熟度はカタログ側の値をそのまま使います。<b>顧客に見せるときはバッジを出しません</b>——ポータルに埋め込んだときだけ出す形を提案します。ここは PM 判断です。</div>
   <div class="pn blk">本番：埋め込み先が社内のカタログに替わる。管理番号（KN-02 など）は不変なので、対応表の値だけが入れ替わる</div>
  </div>
 </section>
</div>`;
};

V.kpi = () => {
  const post = PDEALS.filter(d => !pinPre(d));
  const cnt = { r: 0, y: 0, g: 0 };
  post.forEach(d => { if (d.rag) cnt[d.rag]++; });
  const n = post.length;
  const byCu = ['青嶺精工', '碧洋銀行'].map(c => [c, psum(post.filter(d => d.cu === c), d => d.amt)]);
  const mx = Math.max(...byCu.map(c => c[1]));
  const budget = 140.0, fcast = 137.1, rev = 62.6, gp = 18.4, op = 7.1;

  const topics = PKPITOPIC.map(t => {
    const sc = PSRC[t[6]];
    return '<tr><td class="nw"><span class="no">' + t[0] + '</span> <b>' + t[1] + '</b></td>' +
      '<td>' + t[2].map(x => '<span class="chip" style="cursor:default">' + x + '</span>').join(' ') + '</td>' +
      '<td class="nw">' + t[3] + '</td><td class="nw">' + t[4] + '</td><td class="nw">' + t[5] + '</td>' +
      '<td class="nw"><span class="st ' + sc[0] + '">' + sc[1] + '</span></td></tr>';
  }).join('');

  return `
<div class="grid">
 <section class="block">
  <header><h2>業績</h2><span class="sub">FY2026 上期（4–9 月）／ 単位：百万円</span></header>
  <div class="body">
   <div class="tiles">
    <div class="tile"><div class="lbl">売上（上期実績）</div><div class="num">${rev.toFixed(1)}</div><div class="delta">計画 64.5 に対し −1.9</div></div>
    <div class="tile"><div class="lbl">粗利</div><div class="num">${gp.toFixed(1)}</div><div class="delta">粗利率 ${(gp / rev * 100).toFixed(1)}%　目標 30.0%</div></div>
    <div class="tile"><div class="lbl">営業利益</div><div class="num">${op.toFixed(1)}</div><div class="delta">営業利益率 ${(op / rev * 100).toFixed(1)}%　目標 12.0%</div></div>
    <div class="tile"><div class="lbl">受注高</div><div class="num">${BACKLOG.toFixed(1)}</div><div class="delta">受注後の 5 件</div></div>
   </div>
   <div class="tiles" style="margin-top:10px">
    <div class="tile"><div class="lbl">通期 売上見込</div><div class="num">${fcast.toFixed(1)}</div><div class="delta">予算 ${budget.toFixed(1)} に対し ${(fcast / budget * 100).toFixed(1)}%</div></div>
    <div class="tile"><div class="lbl">パイプライン</div><div class="num">${PIPE_TOTAL.toFixed(1)}</div><div class="delta">確度加重 ${PIPE_W.toFixed(1)} ／ 受注前 5 件</div></div>
    <div class="tile alarm"><div class="lbl">期限超過 To Do</div><div class="num">2<small>件</small></div><div class="delta">目標 0</div></div>
    <div class="tile"><div class="lbl">要員稼働率</div><div class="num">94.4<small>%</small></div><div class="delta">目標 90.0%</div></div>
   </div>
   <div class="note" style="margin-top:12px"><b>受注高と売上は別物として出しています。</b>受注高は契約した金額、売上は今期に計上した金額。混ぜると「受注は積んだのに利益が出ていない」が見えなくなります。粗利・営業利益は会計システムから取る想定です。</div>
   <div class="pn blk">本番：売上・粗利・営業利益は会計システムから月次で取り込む。デモは上期の値を直接持つ</div>
  </div>
 </section>

 <section class="block">
  <header><h2>KPI の観点（案）</h2><span class="sub">9 観点 ／ 指標 46</span><span class="sp"></span>
   <span class="legend">
    <span><span class="st st1">今すぐ出せる</span> 4</span>
    <span><span class="st st2">繋げば出せる</span> 3</span>
    <span><span class="st st3">測っていない</span> 2</span>
   </span></header>
  <div class="body flush">
   ${ptbl([{t:'観点'},{t:'指標'},{t:'頻度'},{t:'出所'},{t:'誰が見る'},{t:'いまの状態'}], topics)}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>「出せる／出せない」を先に分けました。</b>KPI の一覧は作った瞬間はきれいですが、出所が無い指標が混ざっていると、最初の月末で半分が空欄になります。K2・K3・K5・K9 はこの画面のテーブルだけで今すぐ出せます。K1・K4・K6 は会計・勤怠・LMS に繋げば出せます。</div>
   <div class="note" style="margin-top:8px"><b>K7 チームビルディングと K8 社内施策は、いま誰も測っていません。</b>データが無いのではなく、取る仕組みが無い状態です。K7 はアンケートを回すところから、K8 は施策を To Do として登録するところから始まります。<b>やるなら「指標を決める」より先に「どこに記録するか」を決める</b>必要があります。</div>
   <div class="note" style="margin-top:8px"><b>個人の目標（MBO）は別の画面です。</b>ここの 9 観点は<b>組織の数字で、見るもの</b>。個人が自分で選んで期中に追いかけるものは「目標」画面にあります。数字の出どころは重なりますが、使い方が違います。</div>
   <div class="note" style="margin-top:8px"><b>K8 に「AI の利用者数・利用回数・削減時間」を入れました。</b>このポータルと AI カタログの効果そのものを測る指標です。誰も測っていないので、まさに新しく取り始める対象です。</div>
  </div>
 </section>

 <section class="block">
  <header><h2>今の数字</h2><span class="sub">K2・K3 は今すぐ出せる分</span></header>
  <div class="body">
   <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px">ステージ別の金額（百万円）</div>
   ${PSTAGE.map(st => {
     const cards = PDEALS.filter(d => d.sg === st[0]);
     const v = psum(cards, d => d.amt);
     const all = Math.max(...PSTAGE.map(x => psum(PDEALS.filter(d => d.sg === x[0]), d => d.amt)));
     return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:5px">' +
       '<span style="flex:0 0 86px;font-size:11.5px">' + st[1] + '</span>' +
       '<span class="bar" style="flex:1 1 auto"><i style="background:' + st[2] + ';width:' + (v / all * 100) + '%"></i></span>' +
       '<span style="flex:0 0 68px;text-align:right;font-family:var(--font-mono);font-size:11.5px">' + v.toFixed(1) +
       '<span style="color:var(--text-muted)"> /' + cards.length + '</span></span></div>';
   }).join('')}

   <div style="margin-top:16px">
    <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px">受注後の案件の状態（${n} 件）</div>
    <div class="bar">
     <i style="background:var(--rag-r);width:${cnt.r / n * 100}%"></i>
     <i style="background:var(--rag-y);width:${cnt.y / n * 100}%"></i>
     <i style="background:var(--rag-g);width:${cnt.g / n * 100}%"></i>
    </div>
    <div class="legend" style="margin-top:7px">
     <span><i class="sw" style="background:var(--rag-r)"></i>Red ${cnt.r} 件</span>
     <span><i class="sw" style="background:var(--rag-y)"></i>Yellow ${cnt.y} 件</span>
     <span><i class="sw" style="background:var(--rag-g)"></i>Green ${cnt.g} 件</span>
    </div>
   </div>

   <div style="margin-top:16px">
    <div style="font-size:11px;color:var(--text-secondary);margin-bottom:6px">顧客別 受注残（百万円）</div>
    ${byCu.map(c =>
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:5px">' +
      '<span style="flex:0 0 86px;font-size:11.5px">' + c[0] + '</span>' +
      '<span class="bar" style="flex:1 1 auto"><i style="background:var(--action-primary);width:' + (c[1] / mx * 100) + '%"></i></span>' +
      '<span style="flex:0 0 46px;text-align:right;font-family:var(--font-mono);font-size:11.5px">' + c[1].toFixed(1) + '</span></div>').join('')}
    <div class="note" style="margin-top:9px">上位 2 顧客で受注残の <b>100%</b> です。K3 の「上位顧客への集中度」はこの形で出ます。数字としては健全ではないので、指標に入れておく意味があります。</div>
   </div>
  </div>
 </section>

 <section class="block blk-ai">
  <header><h2>${pesc(pt('screenAi'))}</h2></header>
  <div class="body">
   ${paiRow(pscreenAiIds('kpi'))}
   <div class="note" style="margin-top:10px">NM-03 は<b>稼働中</b>。毎朝バッチで回して集計をテーブルに書き、この画面はその結果を描くだけにします（画面を開くたびに AI を呼ばない）。PO-01 は K7 のアンケートを回すところに効きますが構想段階です。</div>
   <div style="margin-top:14px">
    <div style="font-size:11px;color:var(--text-secondary);margin-bottom:7px">カタログに無い — 追加候補</div>
    <div class="ai">
     <span class="cand"><span class="tag">候補</span>計画と実績の差の理由を案件から書き起こす</span>
     <span class="cand"><span class="tag">候補</span>AI の利用ログから削減時間を見積もる</span>
    </div>
   </div>
   <div class="pn blk">本番：数字の元が実データに替わる。集計の呼び出し方・テーブルの形は同じ</div>
  </div>
 </section>
</div>`;
};

V.goal = () => {
  const wsum = PGOAL.mine.reduce((a, g) => a + g[7], 0);
  const rate = Math.round(PGOAL.mine.reduce((a, g) => {
    const t = parseFloat(g[3]), v = parseFloat(g[4]);
    return a + Math.min(v / t, 1) * g[7];
  }, 0));
  const topics = PGOAL.topics.map(t => {
    const m = { auto: ['st1', '自動で測れる'], mix: ['st2', '一部は手動'], man: ['st3', '本人が更新'] }[t[2]];
    const chips = l => l.map(x => '<span class="chip" style="cursor:default">' + x + '</span>').join(' ');
    return '<tr><td class="nw"><span class="no">' + t[0] + '</span> <b>' + t[1] + '</b><span class="m">' +
      '<span class="st ' + m[0] + '">' + m[1] + '</span></span></td>' +
      '<td>' + chips(t[3]) + '</td><td>' + chips(t[4]) + '</td><td>' + chips(t[5]) + '</td></tr>';
  }).join('');

  return `
<div class="grid">
 <section class="block">
  <header><h2>自分の目標</h2><span class="sub">FY2026 ／ 4 件 ／ ウェイト合計 ${wsum}%</span><span class="sp"></span>
   <span class="sub">社員は自分のぶんだけが見えます</span></header>
  <div class="body">
   <div class="tiles">
    <div class="tile"><div class="lbl">総合達成率</div><div class="num">${rate}<small>%</small></div><div class="delta">ウェイトで加重</div></div>
    <div class="tile"><div class="lbl">設定</div><div class="num">4<small>件</small></div><div class="delta">締切 2026-04-20 までに設定済</div></div>
    <div class="tile alarm"><div class="lbl">中間レビュー</div><div class="num">未提出</div><div class="delta">期限 2026-09-30 ／ あと 19 日</div></div>
   </div>
  </div>
  <div class="body flush">
  ${ptbl([{t:'番号'},{t:'観点'},{t:'目標'},{t:'目標値'},{t:'実績'},{t:'測り方'},{t:'期限'},{t:'ウェイト',n:1},{t:'進捗'}],
    PGOAL.mine.map(g => {
      const t0 = parseFloat(g[3]), v = parseFloat(g[4]), pc = Math.min(Math.round(v / t0 * 100), 100);
      return '<tr><td class="nw"><span class="no">' + g[0] + '</span></td>' +
        '<td class="nw">' + g[1] + '</td><td><b>' + g[2] + '</b></td>' +
        '<td class="num">' + g[3] + '</td><td class="num">' + g[4] + '</td>' +
        '<td class="nw">' + (g[5] === '自動' ? '<span class="st st1">自動</span>' : '<span class="st st3">手動</span>') + '</td>' +
        '<td class="nw">' + g[6] + '</td><td class="num">' + g[7] + '%</td>' +
        '<td style="min-width:120px"><span class="bar"><i style="background:' + (pc < 60 ? 'var(--rag-y)' : 'var(--action-primary)') + ';width:' + pc + '%"></i></span></td></tr>';
    }).join(''))}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>「測り方」の列がこの画面のかなめです。</b>自動の 2 件（G-01・G-02）はポータルのテーブルから毎月そのまま出ます。手動の 2 件（G-03・G-04）は本人が更新します。<b>手動ばかりにすると、期末にまとめて入力されて意味がなくなります</b>——だから設定時に「自動で測れるものを最低 1 つ入れる」を規則にすることを勧めます。</div>
   <div class="note"><b>中間レビュー未提出は To Do に出ます。</b>目標設定の締切も同じ扱いで、締切までに設定していない人には自動で To Do が立ちます。</div>
  </div>
 </section>

 <section class="block">
  <header><h2>観点と、役割ごとに選べる指標</h2><span class="sub">8 観点（うち 1 つは全員必須）</span><span class="sp"></span>
   <span class="sub">締切までに、ここから 3〜5 個を自分で選ぶ</span></header>
  <div class="body flush">
   ${ptbl([{t:'観点'},{t:'組織長'},{t:'営業'},{t:'社員'}], topics)}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>役割で選べる指標を変えています。</b>同じ「業績」でも、組織長は部門の予算比、営業は受注高、社員は担当案件への寄与。<b>自分の行動で動かせる指標だけを、その人のメニューに出します。</b>動かせないものを目標にすると、達成率が本人の努力と無関係になります。</div>
   <div class="note"><b>P0 は全員に自動で付きます。</b>必須研修・申請の期限遵守・年休取得・残業上限。選ぶ対象ではなく前提なので、選択メニューからは外してウェイトも小さく固定します。</div>
   <div class="note"><b>兼務者をどうするか決める必要があります。</b>営業もやる PM、組織長だが自分でも案件を持つ人がいます。「主たる役割で決めて、他の役割の指標も選べるようにする」を勧めますが、ここは運用の決めごとです。</div>
  </div>
 </section>

 <section class="block">
  <header><h2>配下の設定・達成状況</h2><span class="sub">組織長が見る画面 ／ 5 名</span><span class="sp"></span>
   <span class="sub">社員にはこの表は出ません</span></header>
  <div class="body flush">
  ${ptbl([{t:'氏名'},{t:'役割'},{t:'目標',n:1},{t:'設定'},{t:'設定日'},{t:'達成率',n:1},{t:'状況'},{t:'この行で使う AI'}],
    PGOAL.team.map(m => '<tr><td class="nw"><b>' + m[0] + '</b></td><td class="nw">' + m[1] + '</td>' +
      '<td class="num">' + m[2] + '</td>' +
      '<td class="nw"><span class="st st1">' + m[3] + '</span></td><td class="nw">' + m[4] + '</td>' +
      '<td style="min-width:110px"><span class="bar"><i style="background:' + (m[5] < 70 ? 'var(--rag-y)' : 'var(--action-primary)') + ';width:' + m[5] + '%"></i></span> ' +
      '<span style="font-family:var(--font-mono);font-size:11px">' + m[5] + '%</span></td>' +
      '<td>' + (m[6] ? '<span class="due">' + m[6] + '</span>' : '<span class="m">—</span>') + '</td>' +
      '<td>' + prowAi(['dc8']) + '</td></tr>').join(''))}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>見える範囲を 3 段にします。</b>社員は自分だけ。組織長は配下の一覧（達成率と設定状況まで。目標の中身も見える）。PMO は<b>集計だけ</b>で、個人名は出しません。無料版でもロールとデータスコープで実現できます。</div>
   <div class="note"><b>締切前に効くのは「設定」列です。</b>達成率より、まず全員が期限までに設定を終えているか。未設定の人がいれば組織長にここで見えて、本人には To Do が立っています。</div>
   <div class="pn blk">本番：評価制度との関係を人事と詰める。ポータルは達成状況までを持ち、評価そのものは持たない</div>
  </div>
 </section>

 <section class="block doc-user">
  <header><h2>1 年の流れ</h2></header>
  <div class="body flush">
  ${ptbl([{t:'時期'},{t:'やること'},{t:'誰が'},{t:'未了だと'}], [
    ['4 月上旬', '役割ごとのメニューから 3〜5 個を選び、目標値を決める', '本人', 'To Do が立つ'],
    ['4/20', '設定の締切', '—', '組織長の一覧に未設定として出る'],
    ['4 月下旬', '組織長が内容を確認（動かせる指標か・目標値が妥当か）', '組織長', '設定が確定しない'],
    ['毎月', '自動の指標は自動更新、手動の指標は本人が更新', 'ポータル／本人', '実績が古いまま残る'],
    ['9/30', '中間レビュー（達成見込みと軌道修正）', '本人・組織長', 'To Do が立つ'],
    ['3 月', '年度末の振り返り', '本人・組織長', '—']
  ].map(r => '<tr><td class="nw"><b>' + r[0] + '</b></td><td>' + r[1] + '</td><td class="nw">' + r[2] + '</td>' +
    '<td>' + (r[3] === '—' ? '<span class="m">—</span>' : r[3]) + '</td></tr>').join(''))}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>部門 KPI とは別物です。</b>KPI 画面の 9 観点は組織の数字で、見るもの。こちらは個人が<b>自分で選んで、期中に追いかけるもの</b>。数字の出どころは重なりますが、使い方が違うので画面を分けています。</div>
   <div class="note"><b>決めておくことが 3 つあります。</b>① 目標は何個までにするか（多いと追えません。3〜5 を推奨）② ウェイトを本人が決めるか固定か ③ 未達のときに何が起きるか（何も起きないなら、翌年から誰も真面目に設定しません）。</div>
  </div>
 </section>
</div>`;
};

V.exp = () => `
<div class="grid g-main">
 <section class="block">
  <header><h2>自分の精算</h2><span class="sub">3 件（差戻し 1）</span></header>
  <div class="body flush">
  ${ptbl([{t:'番号'},{t:'内容'},{t:'申請者'},{t:'金額',n:1},{t:'状態'},{t:'指摘'},{t:'この行で使う AI'}],
    PEXP.map(e => '<tr><td class="nw"><span class="no">' + e[0] + '</span></td><td><b>' + e[1] + '</b></td>' +
      '<td class="nw">' + e[2] + '</td><td class="num">' + e[3] + '</td>' +
      '<td class="nw">' + (e[4] === '差戻し' ? '<span class="due">差戻し</span>' : e[4] === '承認待ち' ? '<span class="st st2">承認待ち</span>' : '<span class="st st1">精算済</span>') + '</td>' +
      '<td>' + (e[5] === '—' ? '<span class="m">—</span>' : e[5]) + '</td>' +
      '<td>' + prowAi(['gn1', 'gn2']) + '</td></tr>').join(''))}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>ここは実際に動かせる画面です。</b>GN-01 経費精算チェックと GN-02 請求書（発票）処理は<b>どちらも稼働中</b>。出す前に自分で叩けるので、差戻しが減ります。E-0908 の「宿泊の発票が 1 枚不足」は GN-01 が出した指摘、という想定です。</div>
   <div class="pn blk">本番：精算の確定は会計システム側。ポータルは申請と事前チェックまでを持つ</div>
  </div>
 </section>
 <section class="block">
  <header><h2>月次クローズ</h2><span class="sub">FY2026 9 月度 ／ 提出期限 10-08</span><span class="sp"></span>
   <span class="sub">経理担当と PMO が見る</span></header>
  <div class="body flush">
  ${ptbl([{t:'工程'},{t:'やること'},{t:'担当'},{t:'期限'},{t:'状態'},{t:'この行で使う AI'}], [
    ['1', '費用計上の締め', '経理', '2026-09-30', '済', 'fa2'],
    ['2', 'GL のリコンシリエーション', '経理', '2026-10-02', '進行中', 'fa1'],
    ['3', '部門別の配賦', 'PMO', '2026-10-03', '未着手', 'po4'],
    ['4', '財務諸表のドラフト', '経理', '2026-10-06', '未着手', 'fa4'],
    ['5', '整合性のレビュー', '経理・組織長', '2026-10-07', '未着手', 'fa3'],
    ['6', '日本本社へ提出', '組織長', '2026-10-08', '未着手', 'dc1']
  ].map(r => '<tr><td class="nw"><b>' + r[0] + '</b></td><td>' + r[1] + '</td><td class="nw">' + r[2] + '</td>' +
    '<td class="nw">' + r[3] + '</td>' +
    '<td class="nw">' + (r[4] === '済' ? '<span class="st st1">済</span>' : r[4] === '進行中' ? '<span class="st st2">進行中</span>' : '<span class="m">未着手</span>') + '</td>' +
    '<td>' + prowAi([r[5]]) + '</td></tr>').join(''))}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>月次クローズは毎月同じ順番で回るので、工程をテーブルに持ちます。</b>誰がどこで止まっているかが見えれば、提出期限に間に合うかを月初に判断できます。工程 6 の「本社へ提出」は DC-01（稼働中）がそのまま使えます。</div>
   <div class="note"><b>経理を同じ画面に置いた理由。</b>経費精算・発票処理と月次クローズは、<b>同じお金の流れの前後</b>です。精算が遅れるとクローズが遅れるので、離すと原因が見えません。</div>
   <div class="pn blk">本番：仕訳と財務諸表そのものは会計システム。ポータルは工程の進み具合と提出物のリンクだけを持つ</div>
  </div>
 </section>

 <section class="block blk-ai">
  <header><h2>${pesc(pt('screenAi'))}</h2></header>
  <div class="body">
   ${paiRow(pscreenAiIds('exp'))}
   <div class="note">全員が毎月触る画面なので、<b>ポータルを開く習慣がここでつきます</b>。稼働中の AI が 2 本あるのはこの画面だけです（GN-01・GN-02）。</div>
   <div class="note">FA の 5 本はすべて構想段階です。実機はまだありません。</div>
  </div>
 </section>
</div>`;

V.req = () => `
<div class="grid g-main">
 <section class="block">
  <header><h2>申請</h2><span class="sub">4 件（自分の承認待ち 1）</span></header>
  <div class="body flush">
  ${ptbl([{t:'番号'},{t:'種類'},{t:'件名'},{t:'申請者'},{t:'状態'},{t:'期限'},{t:'この行で使う AI'}],
    PREQ.map(r => '<tr><td class="nw"><span class="no">' + r[0] + '</span></td><td class="nw">' + r[1] + '</td>' +
      '<td><b>' + r[2] + '</b></td><td class="nw">' + r[3] + '</td>' +
      '<td class="nw">' + (r[4] === '記載不備' ? '<span class="due">記載不備</span>' : r[4] === '承認済' ? '<span class="st st1">承認済</span>' : '<span class="st st2">' + r[4] + '</span>') + '</td>' +
      '<td class="nw">' + r[5] + '</td>' +
      '<td>' + prowAi(r[1] === '契約' ? ['dc7', 'dc5'] : ['dc5']) + '</td></tr>').join(''))}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>R-0910 は To Do の A-0912 と同じものです。</b>「要員補充の稟議を出す」が To Do で超過 3 日になっていて、こちらでは部長承認待ち。<b>同じ仕事を 2 つの画面から見ている</b>だけなので、状態は 1 か所（申請テーブル）に持ちます。</div>
   <div class="note" style="margin-top:8px">ナレッジ C5「申請と手続き」に規程があります。書き方で迷ったらそちらへ。</div>
   <div class="pn blk">本番：決裁のワークフローは NocoBase の Workflow（承認ノードは Professional+ なので、無料版では状態遷移で組む）</div>
  </div>
 </section>
 <section class="block blk-ai">
  <header><h2>${pesc(pt('screenAi'))}</h2></header>
  <div class="body">
   ${paiRow(pscreenAiIds('req'))}
   <div class="note" style="margin-top:10px">DC-05 は<b>記載漏れの検出</b>が本体です。R-0909 の「記載不備」は DC-05 が出した指摘、という想定。出す前に気づけば差戻しの往復が消えます。</div>
   <div class="note" style="margin-top:8px"><b>承認ノードは Professional+ です。</b>無料版では「状態を持つテーブル＋通知」で同じことをします。承認の履歴を残す Record history も Professional+ なので、履歴が要るなら買う理由になります。</div>
  </div>
 </section>
</div>`;

V.watch = () => `
<div class="grid g-main">
 <section class="block">
  <header><h2>今日のニュース</h2><span class="sub">5 件 ／ 毎朝 08:00 に配信</span><span class="sp"></span>
   <span class="sub">案件に効くものは印を付ける</span></header>
  <div class="body flush">
  ${ptbl([{t:'対象'},{t:'区分'},{t:'見出し'},{t:'日付'},{t:'効く先'},{t:'この行で使う AI'}],
    PNEWS.map(n => '<tr><td class="nw"><b>' + n[0] + '</b></td><td class="nw">' + n[1] + '</td>' +
      '<td>' + n[2] + '</td><td class="nw">' + n[3] + '</td>' +
      '<td>' + (n[4] === '—' ? '<span class="m">—</span>' : '<b>' + n[4] + '</b>') + '</td>' +
      '<td>' + prowAi(['gn5', 'rs3']) + '</td></tr>').join(''))}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>顧客画面に埋めなかった理由です。</b>ニュースは日々流れてくるもので、顧客を開いたときだけ見るものではありません。<b>溜まる場所と、溜まったものを捨てる仕組み</b>が要るので独立させました。</div>
   <div class="note" style="margin-top:8px"><b>「効く先」が付いたものだけ読めば済むようにします。</b>全部読ませると誰も読まなくなります。案件・顧客・仕入先のどれに関係するかを AI が付け、付かないものは既定で畳んでおきます。</div>
   <div class="pn blk">本番：外部の情報源に接続。取ってくる範囲と保存期間を先に決める（全部溜めない）</div>
  </div>
 </section>
 <section class="block blk-ai">
  <header><h2>${pesc(pt('screenAi'))}</h2><span class="sub">6 本。カタログでいちばん大きい塊</span></header>
  <div class="body">
   ${paiRow(pscreenAiIds('watch'))}
   <div class="note" style="margin-top:10px">RS-03（顧客 IR・決算の要約）は顧客画面からも呼べます。同じサービスを 2 か所に出すのは構いません——<b>出す画面をテーブルの列で持つので、1 行に複数書けば済みます</b>。</div>
  </div>
 </section>
</div>`;

V.vend = () => `
<div class="grid g-main">
 <section class="block">
  <header><h2>仕入先・パートナー</h2><span class="sub">3 社</span><span class="sp"></span>
   <span class="sub">与信の状態と契約期限</span></header>
  <div class="body flush">
  ${ptbl([{t:'会社'},{t:'区分'},{t:'常駐'},{t:'関わる案件'},{t:'与信'},{t:'契約期限'},{t:'この行で使う AI'}],
    PVENDOR.map(v => '<tr><td class="nw"><b>' + v[0] + '</b></td><td class="nw">' + v[1] + '</td>' +
      '<td class="nw">' + v[2] + '</td><td class="nw">' + v[3] + '</td>' +
      '<td class="nw">' + (v[4] === '注意' ? '<span class="due">注意</span>' : '<span class="st st1">良</span>') + '</td>' +
      '<td class="nw">' + v[5] + '</td>' +
      '<td>' + prowAi(['pt1', 'nm2']) + '</td></tr>').join(''))}
  </div>
  <div class="body" style="border-top:1px solid var(--border-subtle)">
   <div class="note"><b>PT-01 与信・リスク監視はここが正しい置き場所でした。</b>前の版では顧客画面に置いていましたが、あれは仕入先・サプライヤー向けのサービスです。顧客画面からは外しました。</div>
   <div class="note" style="margin-top:8px"><b>γ 社の契約期限が 09-30 です。</b>P-2411 が Red で要員が足りていないのに、その要員を出している会社の契約が切れます。<b>案件・要員・仕入先が同じポータルにあると、この重なりが見えます。</b></div>
   <div class="note" style="margin-top:8px"><b>γ 社・δ 社・ε 社は仮置きです。</b><code>data/world/</code> に無い名前なので、実装前にマスタへ登録します。</div>
   <div class="pn blk">本番：与信の情報源は外部サービス。契約・発注の確定は購買システム側</div>
  </div>
 </section>
 <section class="block blk-ai">
  <header><h2>${pesc(pt('screenAi'))}</h2></header>
  <div class="body">
   ${paiRow(pscreenAiIds('vend'))}
   <div class="note" style="margin-top:10px">購買まわり（見積比較・戦略購買・RFQ 起草・発注書の読み取り）はここにまとめました。**別メニューにするほどの量ではない**と判断しています。増えたら分けます。</div>
  </div>
 </section>
</div>`;

/* ============================================================
   新画面 4 枚の殻（qual/order/cred/reg。設計書 2026-09-12-portal-industry-rev4.md §9・§15-1 PR-A）。
   見出し・空の一覧・「この画面の AI」ブロックだけを持つ。行データ（PQUAL/PORDER/PCRED/PREG）と
   タイル・補助テーブル・解説は PR-D で足す。既存の .block / .tw table / ptbl() / paiRow() だけを使い、
   新しい CSS クラスは 1 つも足さない（§1-3・AC-27）。
   ============================================================ */
V.qual = () => `
<div class="grid g-main">
 <section class="block">
  <header><h2>${pesc(pt('qual'))}</h2></header>
  <div class="body flush">
  ${ptbl([{t:'番号'},{t:'区分'},{t:'発生日'},{t:'品番'},{t:'設備'},{t:'相手'},{t:'担当課'},{t:'期限'},{t:'状態'},{t:'この行で使う AI'}], '')}
  </div>
 </section>
 <section class="block blk-ai">
  <header><h2>${pesc(pt('screenAi'))}</h2></header>
  <div class="body">
   ${paiRow(pscreenAiIds('qual'))}
  </div>
 </section>
</div>`;

V.order = () => `
<div class="grid g-main">
 <section class="block">
  <header><h2>${pesc(pt('order'))}</h2></header>
  <div class="body flush">
  ${ptbl([{t:'番号'},{t:'区分'},{t:'受付日'},{t:'品番'},{t:'相手'},{t:'数量'},{t:'納期'},{t:'状態'},{t:'この行で使う AI'}], '')}
  </div>
 </section>
 <section class="block blk-ai">
  <header><h2>${pesc(pt('screenAi'))}</h2></header>
  <div class="body">
   ${paiRow(pscreenAiIds('order'))}
  </div>
 </section>
</div>`;

V.cred = () => `
<div class="grid g-main">
 <section class="block">
  <header><h2>${pesc(pt('cred'))}</h2></header>
  <div class="body flush">
  ${ptbl([{t:'審査番号'},{t:'稟議番号'},{t:'先'},{t:'商品'},{t:'金額（億元）',n:1},{t:'ステージ'},{t:'申請日'},{t:'期限'},{t:'審査担当'},{t:'この行で使う AI'}], '')}
  </div>
 </section>
 <section class="block blk-ai">
  <header><h2>${pesc(pt('screenAi'))}</h2></header>
  <div class="body">
   ${paiRow(pscreenAiIds('cred'))}
  </div>
 </section>
</div>`;

V.reg = () => `
<div class="grid g-main">
 <section class="block">
  <header><h2>${pesc(pt('reg'))}</h2></header>
  <div class="body flush">
  ${ptbl([{t:'通達番号'},{t:'発出日'},{t:'区分'},{t:'論点'},{t:'影響する部署'},{t:'対応期限'},{t:'状態'},{t:'この行で使う AI'}], '')}
  </div>
 </section>
 <section class="block blk-ai">
  <header><h2>${pesc(pt('screenAi'))}</h2></header>
  <div class="body">
   ${paiRow(pscreenAiIds('reg'))}
  </div>
 </section>
</div>`;

/* ============================================================
   .mockbar の時刻プリセット（sysops-usecase PR-4。設計書 §6-9）。
   portal.html は <script src> の 1 行しか変更しない（設計書 §11 PR-4 の触るファイル一覧）ため、
   .mockbar の #indSw（業種チップ）の直後に、ここから 1 回だけ挿入する。足場なので常に日本語
   （mockbar 本体の業種チップと同じ作法。§2-4）。起動時に 1 回呼ぶ（js/portal/events.js）。
   ============================================================ */
function renderNowSw() {
  const anchor = document.getElementById('indSw');
  if (!anchor || document.getElementById('nowSw')) return;
  const html = '<span class="chips" id="nowSw" aria-label="時刻">' +
    (typeof PSYSNOW !== 'undefined' ? PSYSNOW : []).map(p =>
      '<button class="chip" type="button" data-act="sysnow" data-val="' + p.id + '" aria-pressed="' +
      (pstate.now === p.id) + '">' + pesc(p.label) + '</button>').join('') + '</span>';
  anchor.insertAdjacentHTML('afterend', html);
}

/* ============================================================
   ナビ・タイトル・パンくずの描画
   ============================================================ */
/** その画面が現在の業種で見えるか（PSCREENS[].ind を省略＝全業種。rev4 §3-1）。 */
function pscreenVisible(s) { return !s.ind || s.ind.includes(pstate.ind); }
/** ナビ・タイトルに出すラベルキー（PSCREENS[].lbl の業種別上書きが無ければ画面 id そのもの。rev4 §3-1）。 */
function pscreenLabelKey(s) { return (s.lbl && s.lbl[pstate.ind]) || s.id; }

function renderRail() {
  const nav = document.getElementById('nav');
  let last = null;
  nav.innerHTML = PSCREENS.filter(pscreenVisible).map(s => {
    let head = '';
    if (s.grp && s.grp !== last) { head = '<div class="navgrp">' + pt(s.grp) + '</div>'; last = s.grp; }
    // 'ai'（AI サービス）だけは SVCS.length（カタログの正）から出す。他は業種別の固定件数（§4-4・rev4 §3-1）
    const ct = s.id === 'ai' ? String((typeof SVCS !== 'undefined' ? SVCS.length : 0)) :
      (s.ct && typeof s.ct === 'object' ? s.ct[pstate.ind] : s.ct);
    return head + '<button class="navbtn" type="button" data-scr="' + s.id + '"' + (s.id === pstate.scr ? ' aria-current="page"' : '') + '>' +
      '<svg class="ic" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + s.icon + '"/></svg>' +
      '<span>' + pt(pscreenLabelKey(s)) + '</span>' + (ct ? '<span class="ct">' + ct + '</span>' : '') + '</button>';
  }).join('');
}

function renderCanvas() {
  const canvas = document.getElementById('canvas');
  canvas.innerHTML = PSCREENS.map(s => '<section class="screen" id="scr-' + s.id + '" hidden>' + V[s.id]() + '</section>').join('');
}

function showScreen(id) {
  pstate.scr = id;
  PSCREENS.forEach(s => { document.getElementById('scr-' + s.id).hidden = (s.id !== id); });
  document.querySelectorAll('.navbtn').forEach(b => {
    if (b.dataset.scr === id) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  // 業種別のラベル上書き（PSCREENS[].lbl。rev4 §3-1・§10-1）。会社名・部門名（org）の置き換えは PR-B（§5-3）
  const scrDef = PSCREENS.find(s => s.id === id);
  const labelKey = scrDef ? pscreenLabelKey(scrDef) : id;
  document.getElementById('ttl').textContent = pt(labelKey);
  document.getElementById('crumb').textContent = pt('org').split(' ')[0] + ' ' + pt('brand') + ' ／ ' + pt(labelKey);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

/* 3 層に分類する。業務＝データを持つブロック／解説＝説明だけのブロック／AI＝入口のブロック。
   §3-5：AI ブロックは明示クラス blk-ai を先に付ける保険（見出し文字列一致は補助）。 */
const PORTAL_AI_HEADS = ['この画面の AI', '横断で使う AI', '聞く窓口'];
function classifyBlocks() {
  document.querySelectorAll('.block').forEach(b => {
    if (b.classList.contains('blk-ai')) return;
    const h = b.querySelector(':scope > header h2');
    const txt = h ? h.textContent.trim() : '';
    if (PORTAL_AI_HEADS.includes(txt)) { b.classList.add('blk-ai'); return; }
    if (b.classList.contains('doc-dev')) { b.classList.add('blk-doc'); return; }
    if (b.classList.contains('doc-user')) { b.classList.add('blk-doc', 'isuser'); return; }
    if (!b.querySelector('table, .tiles, .board, .list, .bar, .chips')) b.classList.add('blk-doc');
  });
  const DEVRE = /(テーブル|スキーマ|DDL|NocoBase|Dify|Workflow|iframe|無料版|無料|Professional|Standard|エディション|CLAUDE\.md|data\/world|記載なし|未確認|API|DB_|Outline|Public forms|データスコープ|Migration|実装|データ層|列で持|添付フィールド|管理番号|会計システム|勤怠システム|LMS|正本は|中間テーブル)/;
  document.querySelectorAll('.note').forEach(n => {
    const blk = n.closest('.block');
    if (blk && blk.classList.contains('doc-dev')) { n.classList.add('dev'); return; }
    if (blk && blk.classList.contains('doc-user')) { n.classList.add('user'); return; }
    n.classList.add(DEVRE.test(n.textContent) ? 'dev' : 'user');
  });
  document.querySelectorAll('.body').forEach(bd => {
    const kids = [...bd.children];
    if (kids.length && kids.every(k => k.classList.contains('note') || k.classList.contains('pn') ||
        (k.tagName === 'DIV' && k.querySelector('.cand')))) bd.classList.add('body-doc');
  });
}

/* ---------- 一覧（並べ替え・見出し絞り込み） ---------- */
const PDEALCOLS = [
  { k: 'nm', t: '案件' },
  { k: 'cu', t: '顧客', f: 'cu' },
  { k: 'ow', t: '担当', f: 'ow' },
  { k: 'sg', t: 'ステージ', f: 'sg' },
  { k: 'p', t: '確度' },
  { k: 'rag', t: '状態', f: 'rag' },
  { k: 'due', t: '期限' },
  { k: 'amt', t: '金額', n: 1 }
];
const PRAGORD = { r: 0, y: 1, g: 2 };
function pdealVal(d, k) {
  if (k === 'sg') return PSTAGE.findIndex(x => x[0] === d.sg);
  if (k === 'rag') return d.rag ? PRAGORD[d.rag] : 9;
  if (k === 'p') return pinPre(d) ? d.p : 100;
  if (k === 'amt') return d.amt;
  return String(d[k] || '');
}
function renderDealList() {
  const host = document.getElementById('dealList'); if (!host) return;
  const opts = { cu: [...new Set(PDEALS.map(d => d.cu))], ow: [...new Set(PDEALS.map(d => d.ow))],
    sg: PSTAGE.map(x => x[1]), rag: ['Red', 'Yellow', 'Green'] };
  const RAGNAME = { r: 'Red', y: 'Yellow', g: 'Green' };
  let list = PDEALS.filter(d =>
    (!pstate.pipeCu || d.cu === pstate.pipeCu) && (!pstate.pipeTeam || (PORG.team[d.ow] || '—') === pstate.pipeTeam) &&
    (!pstate.dealF.cu || d.cu === pstate.dealF.cu) && (!pstate.dealF.ow || d.ow === pstate.dealF.ow) &&
    (!pstate.dealF.sg || pstageName(d.sg) === pstate.dealF.sg) &&
    (!pstate.dealF.rag || RAGNAME[d.rag] === pstate.dealF.rag));
  const dir = pstate.dealSort.dir === 'asc' ? 1 : -1;
  list = list.slice().sort((x, y) => {
    const a = pdealVal(x, pstate.dealSort.key), b = pdealVal(y, pstate.dealSort.key);
    return (a < b ? -1 : a > b ? 1 : 0) * dir;
  });
  const th = PDEALCOLS.map(c => {
    const on = pstate.dealSort.key === c.k;
    const ar = on ? (pstate.dealSort.dir === 'asc' ? '▲' : '▼') : '▽';
    const sel = c.f ? '<select class="thf' + (pstate.dealF[c.f] ? ' act' : '') + '" data-df="' + c.f + '">' +
      '<option value="">すべて</option>' +
      opts[c.f].map(o => '<option value="' + o + '"' + (pstate.dealF[c.f] === o ? ' selected' : '') + '>' + o + '</option>').join('') +
      '</select>' : '';
    return '<th' + (c.n ? ' class="num"' : '') + '><button class="sortbtn' + (on ? ' on' : '') + '" type="button" data-ds="' + c.k + '">' +
      c.t + '<span class="ar">' + ar + '</span></button>' + sel + '</th>';
  }).join('') + '<th>この行で使う AI</th>';
  const body = list.map(d => '<tr data-deal2="' + d.id + '">' +
    '<td><b>' + d.nm + '</b><span class="m">' + d.id + '</span></td>' +
    '<td class="nw">' + d.cu + '</td>' +
    '<td class="nw">' + d.ow + '<span class="m">' + (PORG.team[d.ow] || '—') + 'チーム</span></td>' +
    '<td class="nw">' + pstageName(d.sg) + '</td>' +
    '<td class="nw">' + (pinPre(d) ? d.p + '%' : '<span class="m">—</span>') + '</td>' +
    '<td>' + (d.rag ? pragChip(d.rag) : '<span class="m">—</span>') + '</td>' +
    '<td class="nw">' + d.due + '</td><td class="num">' + d.amt.toFixed(1) + '</td>' +
    '<td>' + prowAi(PSTAGE_AI[d.sg], { scr: 'proj', id: d.id }) + pbackContainer('proj', d.id) + '</td></tr>').join('');
  host.innerHTML = '<table><thead><tr>' + th + '</tr></thead><tbody>' + body + '</tbody></table>';
  const lbl = document.getElementById('dealCount');
  if (lbl) lbl.textContent = list.length + ' 件' + (list.length === PDEALS.length ? '　同じデータを表で見る' : '（絞り込み中）');
}

/* ---------- 候補の描画 ---------- */
function renderCandList() {
  const host = document.getElementById('candList'); if (!host) return;
  host.innerHTML = pstate.cand.map(c => {
    const cls = c.state === 'ok' ? 'cand-row done' : c.state === 'ng' ? 'cand-row ng' : 'cand-row';
    const tag = c.state === 'ok' ? '<span class="st st1">採用</span>' :
                c.state === 'ng' ? '<span class="st st3">見送り</span>' : '<span class="k">候補</span>';
    const meta = '出所：' + c.src + (c.who !== '—' ? ' ／ 依頼者 ' + c.who : '') + ' ／ 放置 ' + c.days + ' 日' +
      (c.state === 'ok' ? ' ／ <b>' + c.no + ' として起票</b>' : c.state === 'ng' ? ' ／ 見送り（同じものは次回から出しません）' : '');
    return '<li class="' + cls + '"><span class="k" style="flex:0 0 52px">' + tag + '</span>' +
      '<div style="flex:1 1 auto"><b>' + c.txt + '</b><span class="m">' + meta + '</span></div>' +
      '<span class="sw2">' +
      '<button class="ok" type="button" data-cand="' + c.id + '" data-act2="ok" aria-pressed="' + (c.state === 'ok') + '">採用</button>' +
      '<button class="ng" type="button" data-cand="' + c.id + '" data-act2="ng" aria-pressed="' + (c.state === 'ng') + '">見送り</button>' +
      '</span></li>';
  }).join('');
  const n = pstate.cand.filter(c => c.state === 'new').length;
  const ok = pstate.cand.filter(c => c.state === 'ok').length;
  const lbl = document.getElementById('candCount');
  if (lbl) lbl.textContent = '未確認 ' + n + ' 件' + (ok ? ' ／ 採用 ' + ok + ' 件' : '');
}

function filterPipe() {
  const scr = document.getElementById('scr-proj'); if (!scr) return;
  const hit = d => (!pstate.pipeCu || d.cu === pstate.pipeCu) && (!pstate.pipeTeam || (PORG.team[d.ow] || '—') === pstate.pipeTeam);
  const keep = PDEALS.filter(hit).map(d => d.id);
  scr.querySelectorAll('[data-deal]').forEach(el => { el.hidden = !keep.includes(el.dataset.deal); });
  PSTAGE.forEach(st => {
    const c = PDEALS.filter(d => d.sg === st[0] && hit(d));
    const n = document.getElementById('n-' + st[0]), a = document.getElementById('a-' + st[0]);
    if (n) n.textContent = c.length;
    if (a) a.textContent = psum(c, d => d.amt).toFixed(1);
  });
  const pre = PDEALS.filter(d => pinPre(d) && hit(d)), post = PDEALS.filter(d => !pinPre(d) && hit(d));
  document.getElementById('pipePre').textContent = psum(pre, d => d.amt).toFixed(1);
  document.getElementById('pipeW').textContent = psum(pre, d => d.amt * d.p / 100).toFixed(1);
  document.getElementById('pipePost').textContent = psum(post, d => d.amt).toFixed(1);
  const lbl = [pstate.pipeCu, pstate.pipeTeam ? pstate.pipeTeam + 'チーム' : ''].filter(Boolean).join(' ／ ');
  document.getElementById('pipeCount').textContent = keep.length + ' 件' + (lbl ? '（' + lbl + '）' : '　引合から検収まで');
  scr.querySelectorAll('#pipeCu .chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pcu === pstate.pipeCu)));
  scr.querySelectorAll('#pipeTeam .chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pteam === pstate.pipeTeam)));
  renderDealList();
}

function filterContacts(cu) {
  const scr = document.getElementById('scr-cust'); if (!scr) return;
  pstate.cuFilter = cu;
  let n = 0;
  scr.querySelectorAll('tr[data-cu]').forEach(tr => {
    const hit = !cu || tr.dataset.cu === cu;
    tr.hidden = !hit; if (hit) n++;
  });
  scr.querySelectorAll('#cuChips .chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cu === cu)));
  const lbl = document.getElementById('ctCount');
  if (lbl) lbl.textContent = '名刺から取り込み ／ ' + n + ' 名' + (cu ? '（' + cu + '）' : '');
}

/* ---------- drawer ---------- */
let pScrim = null, pDrawer = null, pLastFocus = null;
function closeDrawer() {
  if (pScrim) { pScrim.remove(); pScrim = null; }
  if (pDrawer) { pDrawer.remove(); pDrawer = null; }
  if (pLastFocus) { pLastFocus.focus(); pLastFocus = null; }
}
function openBareDrawer() {
  closeDrawer();
  pLastFocus = document.activeElement;
  pScrim = document.createElement('button');
  pScrim.className = 'scrim'; pScrim.type = 'button'; pScrim.setAttribute('aria-label', pt('close'));
  pScrim.addEventListener('click', closeDrawer);
  pDrawer = document.createElement('aside');
  pDrawer.className = 'drawer'; pDrawer.setAttribute('role', 'dialog'); pDrawer.setAttribute('aria-modal', 'true');
  return pDrawer;
}
/** 台本なしの情報ドロワー（渡すもの・返るものだけの 4 セクション）。
    設計書 §5-6：PR-3 以降は js/portal/demo.js の openSvcDrawer() が pscn() で台本を探し、
    見つからなかったとき（＝台本なし）だけこの関数に落ちる。PT.noScript を先頭に出す。 */
function openDrawer(id) {
  const s = psvcOf(id); if (!s) return;
  const drawer = openBareDrawer();
  const st = PST[s.st] || PST[3];
  const code = s.isnew ? pt('unnumbered') : psvcCode(id);
  drawer.innerHTML =
    '<header><div><div class="no" style="color:var(--cat-' + s.cat + ')">' + pesc(code) + '</div>' +
    '<h2>' + pesc(s.name) + '</h2></div><span class="st ' + st[0] + '">' + pesc(st[1]) + '</span>' +
    '<button class="x" type="button" aria-label="' + pesc(pt('close')) + '">&times;</button></header>' +
    '<div class="sec"><div class="note">' + pesc(pt('noScript')) + '</div></div>' +
    (s.st === 1 ? '' : '<div class="sec"><div class="note"><b>' + pesc(st[1]) + 'です。</b>実機はまだありません。ここに出しているのは「何を渡して何が返る想定か」だけで、動くものとしては見せません。</div></div>') +
    '<div class="sec"><h3>この画面から渡す文脈</h3><div class="ctx">' + pesc(s.ctx) + '</div></div>' +
    '<div class="sec"><h3>返ってくるもの</h3><p>' + pesc(s.out) + '</p></div>' +
    '<div class="sec"><h3>置き方 — ' + pesc(PHOW[s.how]) + '</h3><p>' + pesc(PHOWLONG[s.how]) + '</p></div>' +
    '<div class="sec"><h3>ここに置く理由</h3><p>' + pesc(s.why) + '</p></div>' +
    '<div class="sec"><h3>デモと本番</h3><p>デモは Dify Cloud の稼働中アプリ。本番は Dify Enterprise。' +
    '<b>差し替わるのは接続先とキーだけ</b>で、管理番号（' + pesc(code) + '）とポータル側の呼び出し方は変わりません。</p></div>';
  drawer.querySelector('.x').addEventListener('click', closeDrawer);
  document.body.append(pScrim, drawer);
  drawer.querySelector('.x').focus();
}
function openKnowDrawer(k) {
  const a = PKNOWACT[k]; if (!a) return;
  const drawer = openBareDrawer();
  drawer.innerHTML =
    '<header><div><div class="no">' + a.tgt + '</div><h2>' + a.t + '</h2></div>' +
    '<button class="x" type="button" aria-label="' + pesc(pt('close')) + '">&times;</button></header>' +
    '<div class="sec"><h3>押せる人</h3><p>' + a.who + '</p></div>' +
    '<div class="sec"><h3>この後の流れ</h3><ul class="list">' +
    a.steps.map((x, i) => '<li><span class="k">' + (i + 1) + '</span><div>' + x + '</div></li>').join('') + '</ul></div>' +
    '<div class="sec"><h3>そうしている理由</h3><p>' + a.note + '</p></div>' +
    '<div class="sec"><h3>デモと本番</h3><p>デモでは押しても何も起きません。本番では Outline を開くか、依頼・提案のレコードが立ちます。<b>ポータルが持つのは依頼と提案の記録まで</b>で、文書そのものは Outline 側です。</p></div>';
  drawer.querySelector('.x').addEventListener('click', closeDrawer);
  document.body.append(pScrim, drawer);
  drawer.querySelector('.x').focus();
}
function openHistDrawer(name) {
  const c = PCONTACT.find(x => x[0] === name); if (!c) return;
  const rows = PHIST.filter(h => h[0] === name);
  const drawer = openBareDrawer();
  drawer.innerHTML =
    '<header><div><div class="no">接触履歴</div><h2>' + c[0] + '</h2>' +
    '<div style="font-size:11.5px;color:var(--text-secondary);margin-top:2px">' + c[4] + ' ／ ' + c[3] + '<br>' + c[2] + '</div></div>' +
    '<button class="x" type="button" aria-label="' + pesc(pt('close')) + '">&times;</button></header>' +
    '<div class="sec"><h3>往復 ' + rows.length + ' 件</h3><ul class="list">' +
    rows.map(h => '<li><span class="k">' + h[1] + '</span><div><b>' + h[2] + '</b>　' + h[3] +
      '<span class="m">' + (h[4] === '—' ? '関連なし' : '関連：' + h[4]) + '</span></div></li>').join('') +
    '</ul></div>' +
    '<div class="sec"><h3>どこから積まれるか</h3><p>会議（議事録の出席者）・訪問・メール・To Do から自動で積まれます。' +
    '<b>人が書き足すものにしません</b>——書く手間があると誰も書かなくなり、履歴が信用できなくなるためです。</p></div>' +
    '<div class="sec"><h3>最終接触</h3><p>この一覧のいちばん新しい日付が、顧客担当者テーブルの「最終接触」になります。別に持つと食い違います。</p></div>';
  drawer.querySelector('.x').addEventListener('click', closeDrawer);
  document.body.append(pScrim, drawer);
  drawer.querySelector('.x').focus();
}

/* ---------- テーマアイコン ---------- */
const P_MOON = 'M16 11.5A6.5 6.5 0 018.5 4a6.5 6.5 0 107.5 7.5z';
const P_SUN = 'M10 3v2M10 15v2M3 10h2M15 10h2M5.2 5.2l1.4 1.4M13.4 13.4l1.4 1.4M5.2 14.8l1.4-1.4M13.4 6.6l1.4-1.4M10 6.8a3.2 3.2 0 100 6.4 3.2 3.2 0 000-6.4z';
function paintThemeIcon() {
  const r = document.documentElement;
  const cur = r.getAttribute('data-theme');
  const dark = cur === 'dark' || (!cur && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const path = document.querySelector('#themeIcon path');
  if (path) path.setAttribute('d', dark ? P_SUN : P_MOON);
}

/* ---------- 全体再描画 ---------- */
function applyPortalPrefs() {
  const root = document.documentElement;
  root.setAttribute('data-theme', pstate.theme);
  root.setAttribute('data-lang', pstate.lang);
  root.setAttribute('lang', pstate.lang);
  document.getElementById('brandName').textContent = pt('brand');
  document.getElementById('brandOrg').textContent = pt('org');
  document.getElementById('brandSite').textContent = pt('site');
  document.getElementById('whoRole').textContent = pt('role');
  document.getElementById('whoName').textContent = PORG.persona.name;
  document.getElementById('avatar').textContent = PORG.persona.avatar;
  document.getElementById('prodLbl').textContent = pt('prod');
  document.getElementById('themeBtn').setAttribute('aria-label', pt('theme'));
  document.getElementById('envchip').textContent = pstate.prod ? pt('envOn') : pt('env');
  const sel = document.getElementById('langSel'); if (sel) sel.value = pstate.lang;
  document.getElementById('mockLabel').textContent = pt('mockLabel');
  document.getElementById('mockDesc').textContent = pt('mockDesc');
  document.getElementById('indSw').setAttribute('aria-label', pt('indLabel'));
  paintThemeIcon();
  renderMockbarFold();
}

/* ---------- .mockbar の折りたたみ（レビュー用の足場を表示/非表示。PM 指示）----------
   portal.html は変更範囲外なので、折りたたみボタンと隠したときの小タブは
   ここで一度だけ DOM に足す（以後は再利用）。状態は pstate.mockbar のメモリだけで持ち、
   localStorage には書かない（§2-6：ポータルの許可集合は「mock」+「.」+「lang」/「theme」の 2 つのまま）。
   .mockbar 自体はレビュー用の足場（§2-4）なので、ヘッダの言語・テーマ切替（プロダクト機能）
   や pstate.ind/now/prod 等の現在値には触れない（表示を消すだけ）。 */
function renderMockbarFold() {
  const bar = document.querySelector('.mockbar');
  if (!bar) return;
  let btn = document.getElementById('mockbarTgl');
  if (!btn) {
    btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'mockbarTgl';
    btn.className = 'tgl mockbar-fold';
    btn.setAttribute('data-act', 'mockbarfold');
    bar.appendChild(btn);
  }
  let tab = document.getElementById('mockbarTab');
  if (!tab) {
    tab = document.createElement('button');
    tab.type = 'button';
    tab.id = 'mockbarTab';
    tab.className = 'mocktab';
    tab.setAttribute('data-act', 'mockbarfold');
    bar.insertAdjacentElement('afterend', tab);
  }
  bar.hidden = !pstate.mockbar;
  tab.hidden = pstate.mockbar;
  btn.textContent = pt('mockbarHide');
  tab.textContent = pt('mockbarShow');
}

function renderAll() {
  renderRail();
  renderCanvas();
  classifyBlocks();
  renderCandList();
  showScreen(pstate.scr);
  const proj = document.getElementById('scr-proj');
  if (proj) filterPipe();
  const cust = document.getElementById('scr-cust');
  if (cust) filterContacts(pstate.cuFilter);
}
