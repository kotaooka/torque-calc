// 画面処理：入力の読み取り、トルクと軸力の図・トルクの内訳、結果とトルク表の表示、テーマ、オフライン対応
(function () {
  'use strict';
  const TC = window.TorqueCalc;
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  // 3 桁区切りで d 桁に丸める
  const fmt = (v, d = 0) => !Number.isFinite(v) ? '―' : (Math.abs(v) < 0.5 * 10 ** -d ? 0 : v).toLocaleString('ja-JP', { minimumFractionDigits: d, maximumFractionDigits: d });
  // 有効数字 3 桁（100 以上は整数）
  const sig = v => fmt(v, Math.abs(v) >= 100 ? 0 : Math.abs(v) >= 10 ? 1 : 2);
  const pct = v => fmt(v * 100, 1);
  function toast(m) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => { t.hidden = true; }, 2200); }
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 保存できない環境 */ } } };
  const KEY = 'torque-calc-inputs';
  const num = s => { const t = String(s ?? '').trim().replace(/[０-９．－]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/,/g, ''); return t === '' ? NaN : Number(t); };

  // ---- 状態 ----
  const CALC_DEF = { thr: 'M10', d: '', P: '', gr: '8.8', Rp: '', head: 'hex', dw: '', hole: '1', dh: '', fr: 'B', mu0: '0.08', mu1: '0.16', nu: '90', sc: '5', mode: 'target' };
  const TAB_DEF = { kind: 'M', series: 'coarse', gr: '8.8', hole: '1', nu: '90' };
  let st = store.get(KEY);
  if (!st || !st.c || !st.t) st = { mode: 'calc', c: { ...CALC_DEF }, t: { ...TAB_DEF } };
  st.c = { ...CALC_DEF, ...st.c }; st.t = { ...TAB_DEF, ...st.t };
  const save = () => store.set(KEY, st);

  // ---- 選択肢 ----
  const opt = (v, t, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(t)}</option>`;
  const thrOpts = withCustom =>
    `<optgroup label="並目">${TC.THREADS.filter(t => t.coarse).map(t => opt(t.id, `${t.id}（P${t.P}）`)).join('')}</optgroup>` +
    `<optgroup label="細目">${TC.THREADS.filter(t => !t.coarse).map(t => opt(t.id, t.id.replace('x', '×'))).join('')}</optgroup>` +
    (withCustom ? `<optgroup label="その他">${opt('custom', '呼び径とピッチを入れる')}</optgroup>` : '');
  const grOpts = withCustom =>
    `<optgroup label="鋼（ISO 898-1）">${TC.GRADES.filter(g => g.mat === 'steel').map(g => opt(g.id, g.id)).join('')}</optgroup>` +
    `<optgroup label="ステンレス（ISO 3506-1）">${TC.GRADES.filter(g => g.mat === 'stainless').map(g => opt(g.id, g.id)).join('')}</optgroup>` +
    (withCustom ? `<optgroup label="その他">${opt('custom', '降伏点を入れる')}</optgroup>` : '');
  $('cThr').innerHTML = thrOpts(true);
  $('cGr').innerHTML = grOpts(true);
  $('tGr').innerHTML = grOpts(false);
  $('cFr').innerHTML = TC.FRICTION.map(f => opt(f.id, `VDI 2230 の${f.ja}`)).join('') + opt('custom', '直接入れる');

  // ---- 入力と状態の対応 ----
  const CALC_IN = { cThr: 'thr', cD: 'd', cP: 'P', cGr: 'gr', cRp: 'Rp', cHead: 'head', cDw: 'dw', cHole: 'hole', cDh: 'dh', cFr: 'fr', cMu0: 'mu0', cMu1: 'mu1', cNu: 'nu', cSc: 'sc' };
  const TAB_IN = { tGr: 'gr', tHole: 'hole', tNu: 'nu' };
  // 呼び径（ねじの選択か直接入力）
  const curD = () => { if (st.c.thr === 'custom') return num(st.c.d); const t = TC.findThread(st.c.thr); return t ? t.d : NaN; };
  // 規格の座面の径・穴径を入れ直す（六角ボルト・等級を選んでいるとき）
  function syncSeat() {
    const c = st.c, seat = TC.seatOf(curD(), c.hole === 'custom' ? 1 : +c.hole);
    if (c.head === 'hex') c.dw = seat ? String(seat.dw) : '';
    if (c.hole !== 'custom') c.dh = seat ? String(seat.dh) : '';
  }
  function syncFriction() {
    const f = TC.FRICTION.find(x => x.id === st.c.fr);
    if (f) { st.c.mu0 = String(f.lo); st.c.mu1 = String(f.hi); }
  }
  function fillInputs() {
    Object.entries(CALC_IN).forEach(([id, k]) => { $(id).value = st.c[k] ?? ''; });
    Object.entries(TAB_IN).forEach(([id, k]) => { $(id).value = st.t[k] ?? ''; });
    $('cDf').hidden = $('cPf').hidden = st.c.thr !== 'custom';
    $('cRpf').hidden = st.c.gr !== 'custom';
  }
  Object.entries(CALC_IN).forEach(([id, k]) => $(id).addEventListener($(id).tagName === 'SELECT' ? 'change' : 'input', () => {
    st.c[k] = $(id).value;
    if (k === 'thr' || k === 'd' || k === 'head' || k === 'hole') syncSeat();
    if (k === 'dw') st.c.head = 'custom';
    if (k === 'dh') st.c.hole = 'custom';
    if (k === 'fr') syncFriction();
    if (k === 'mu0' || k === 'mu1') st.c.fr = 'custom';
    // 入力中の欄は書き換えない（カーソルが飛ぶため）
    if ($(id).tagName === 'SELECT') fillInputs();
    else { $('cHead').value = st.c.head; $('cHole').value = st.c.hole; $('cFr').value = st.c.fr; if (k === 'd') { $('cDw').value = st.c.dw; $('cDh').value = st.c.dh; } }
    save(); render();
  }));
  Object.entries(TAB_IN).forEach(([id, k]) => $(id).addEventListener($(id).tagName === 'SELECT' ? 'change' : 'input', () => { st.t[k] = $(id).value; save(); render(); }));
  $('cReset').addEventListener('click', () => { st.c = { ...CALC_DEF }; syncSeat(); fillInputs(); save(); render(); });

  function segs(id, get, set) {
    document.querySelectorAll(`#${id} button`).forEach(b => b.addEventListener('click', () => { set(b.dataset.v); save(); render(); }));
    return () => document.querySelectorAll(`#${id} button`).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === get())));
  }
  // モードのタブ（ヘッダーの nav.tabs。ほかのツールと同じ形）
  const tabBtns = document.querySelectorAll('nav.tabs button');
  tabBtns.forEach(b => b.addEventListener('click', () => { st.mode = b.dataset.tab; save(); render(); window.scrollTo(0, 0); }));
  const tabUpd = () => tabBtns.forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === st.mode)));
  const segUpd = [
    tabUpd,
    segs('cMode', () => st.c.mode, v => { st.c.mode = v; }),
    segs('tKind', () => st.t.kind, v => { st.t.kind = v; }),
    segs('tSeries', () => st.t.series, v => { st.t.series = v; })
  ];

  // ---- SVG の共通部品 ----
  const svgOpen = (W, H, label) => `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(label)}" font-family="${esc(css('--f-ui'))}">`;
  function niceTicks(lo, hi, nt = 5) {
    const span = hi - lo || 1, raw = span / nt, p = 10 ** Math.floor(Math.log10(raw));
    const m = [1, 2, 2.5, 5, 10].find(v => v * p >= raw) * p;
    const t = []; for (let v = Math.ceil(lo / m) * m; v <= hi + m * 1e-9; v += m) t.push(+v.toFixed(10));
    return { t, step: m };
  }
  const NUMF = () => esc(css('--f-num'));
  const tickD = step => (step >= 1 ? 0 : step >= 0.1 ? 1 : 2);

  // ================= 計算 =================
  let res = null; const cCopy = [];
  function readCalc() {
    const c = st.c, bad = new Set(), o = {};
    if (c.thr === 'custom') {
      o.d = num(c.d); o.P = num(c.P);
      if (!(o.d > 0)) bad.add('cD'); if (!(o.P > 0)) bad.add('cP');
    } else o.thread = c.thr;
    if (c.gr === 'custom') { o.Rp = num(c.Rp); if (!(o.Rp > 0)) bad.add('cRp'); } else o.grade = c.gr;
    o.dw = num(c.dw); o.dh = num(c.dh);
    if (!(o.dw > 0)) bad.add('cDw'); if (!(o.dh > 0)) bad.add('cDh');
    if (o.dw > 0 && o.dh > 0 && o.dh >= o.dw) { bad.add('cDw'); bad.add('cDh'); }
    const m0 = num(c.mu0), m1 = String(c.mu1).trim() === '' ? m0 : num(c.mu1);
    if (!(m0 > 0)) bad.add('cMu0'); if (!(m1 > 0) || m1 < m0) bad.add('cMu1');
    o.mu = [m0, m1];
    o.nu = String(c.nu).trim() === '' ? 0.9 : num(c.nu) / 100;
    if (!(o.nu > 0 && o.nu <= 1)) bad.add('cNu');
    o.scatter = String(c.sc).trim() === '' ? 0 : num(c.sc) / 100;
    if (!(o.scatter >= 0 && o.scatter < 0.5)) bad.add('cSc');
    o.mode = c.mode;
    Object.keys(CALC_IN).forEach(id => $(id).classList.toggle('bad', bad.has(id)));
    return { o, bad };
  }

  function renderCalc() {
    const { o, bad } = readCalc();
    const g = st.c.gr === 'custom' ? null : TC.findGrade(st.c.gr);
    const dNow = curD();
    $('cGrNote').textContent = g ? `${g.id}：${g.note} の最小 ${fmt(g.Rp(dNow > 0 ? dNow : 10), 0)} MPa${g.mat === 'stainless' ? '（オーステナイト系）' : ''}` : '';
    const fr = TC.FRICTION.find(f => f.id === st.c.fr);
    $('cFrNote').textContent = fr ? `例：${fr.ex}（目安）。実際の値は締付け試験（JIS B 1084）で確かめるのが確実です。` : 'ねじ面と座面の摩擦係数を同じ値として入れてください。分かっているばらつきの範囲を最小〜最大に入れます。';
    cCopy.length = 0;
    const msgs = [];
    if (bad.size) {
      res = null;
      msgs.push(['err', '赤い欄の値を確かめてください。']);
      if (o.dh >= o.dw) msgs.push(['err', 'ボルト穴径が座面の径以上です。座面が当たらないので計算できません。']);
      if (st.c.head === 'hex' && !TC.seatOf(curD())) msgs.push(['err', 'この呼び径は六角ボルトの寸法を持っていません。「座面」で「径を入れる」を選び、座面の径を入れてください。']);
      if (st.c.hole !== 'custom' && !TC.seatOf(curD())) msgs.push(['err', 'この呼び径はボルト穴径の表にありません。「ボルト穴」で「径を入れる」を選び、穴径を入れてください。']);
      showMsgs(msgs); $('cKpi').innerHTML = ''; $('cFig').innerHTML = ''; $('cSplit').innerHTML = ''; $('cRes').innerHTML = '';
      return;
    }
    const r = TC.calc(o); res = r;
    if (r.errors.length) {
      r.errors.forEach(e => msgs.push(['err', e])); showMsgs(msgs);
      $('cKpi').innerHTML = ''; $('cFig').innerHTML = ''; $('cSplit').innerHTML = ''; $('cRes').innerHTML = '';
      return;
    }
    r.warns.forEach(w => msgs.push(['warn', w]));
    r.infos.forEach(w => msgs.push(['info', w]));
    if (g && g.id === '12.9') msgs.push(['warn', '12.9 に電気めっきをすると、水素ぜい化で締めてから数時間〜数日後に破断することがあります。めっきの種類とベーキングの有無を確かめてください。']);
    if (g && g.mat === 'stainless' && r.muMin < 0.15) msgs.push(['info', 'ステンレスは潤滑しないとかじりやすく、摩擦係数が 0.2〜0.35 程度まで大きくなります。最小の摩擦係数が潤滑した状態の値か確かめてください。']);
    if (r.ratioF > 1.8) msgs.push(['info', `軸力の最大と最小の比が ${fmt(r.ratioF, 2)} あります。必要な軸力（最小）が足りるかは、設計の条件（外力・すべり・座面の面圧）で確かめてください。`]);
    showMsgs(msgs);
    const tId = st.c.thr === 'custom' ? `M${fmt(r.g.d, r.g.d % 1 ? 1 : 0)}×${r.g.P}` : st.c.thr.replace('x', '×');
    const gId = g ? g.id : `Rp ${fmt(r.Rp, 0)} MPa`;
    $('cTitle').textContent = `推奨締付けトルク（${tId}・${gId}）`;
    const range = (a, b, d) => r.scatter > 0 ? `${fmt(a, d)}〜${fmt(b, d)}` : '';
    const mD = r.Mnom / 1000 >= 100 ? 0 : r.Mnom / 1000 >= 10 ? 1 : 2;
    $('cKpi').innerHTML = [
      ['main', r.mode === 'upper' ? '指示するトルク（上限が推奨トルク）' : '推奨締付けトルク', `${sig(r.Mnom / 1000)}<small> N·m</small>`, r.scatter > 0 ? `±${fmt(r.scatter * 100, 1)}%：${range(r.Mmin / 1000, r.Mmax / 1000, mD)}` : 'トルクのばらつきなし'],
      ['', '許容締付け軸力', `${sig(r.FMzul / 1000)}<small> kN</small>`, `μ ${r.muMin} で降伏点の ${fmt(r.nu * 100, 0)}%`],
      ['', '軸力の範囲', `${sig(r.Fmin / 1000)}〜${sig(r.Fmax / 1000)}<small> kN</small>`, `最大 ÷ 最小 = ${fmt(r.ratioF, 2)}`],
      [r.useMax > 1 ? 'ng' : '', '降伏点の利用率', `${pct(r.useMin)}〜${pct(r.useMax)}<small> %</small>`, '締付け時の相当応力 ÷ 降伏点'],
      ['', 'トルク係数 K', `${fmt(r.Kmin, 3)}〜${fmt(r.Kmax, 3)}`, 'JIS B 1083 の T = K·F·d'],
      ['', '降伏する軸力', `${sig(r.FyMin / 1000)}<small> kN</small>`, `μ ${r.muMin} のとき（μ ${r.muMax} は ${sig(r.FyMax / 1000)}）`]
    ].map(([cls, lab, val, sub]) => `<div class="${cls}"><span>${esc(lab)}</span><b>${val}</b><small>${esc(sub)}</small></div>`).join('');
    drawCurve(r); drawSplit(r); drawResTable(r, tId, gId);
  }

  function showMsgs(list) {
    $('cMsgs').innerHTML = list.map(([k, t]) => `<div class="msg ${k}">${k === 'err' ? '× ' : k === 'warn' ? '! ' : ''}${esc(t)}</div>`).join('');
  }

  // トルクと軸力の図
  function drawCurve(r) {
    const el = $('cFig'), narrow = el.clientWidth && el.clientWidth < 480;
    const W = narrow ? 420 : 600, H = narrow ? 300 : 320, L = 54, R = 16, T = 18, Bm = 38;
    const kN = v => v / 1000, Nm = v => v / 1000;
    const xmaxRaw = Nm(r.Mmax) * 1.35, yt0 = niceTicks(0, kN(r.FyMin) * 1.12, 5), xt0 = niceTicks(0, xmaxRaw, 5);
    const xmax = xt0.t[xt0.t.length - 1] < xmaxRaw ? xt0.t[xt0.t.length - 1] + xt0.step : xt0.t[xt0.t.length - 1];
    const ymaxRaw = kN(r.FyMin) * 1.12, ymax = yt0.t[yt0.t.length - 1] < ymaxRaw ? yt0.t[yt0.t.length - 1] + yt0.step : yt0.t[yt0.t.length - 1];
    const X = v => L + v / xmax * (W - L - R), Y = v => T + (ymax - v) / ymax * (H - T - Bm);
    const ink = css('--ink'), ink2 = css('--ink2'), mut = css('--muted'), gr = css('--grid'), nf = NUMF(), ng = css('--ng');
    let s = svgOpen(W, H, 'トルクと軸力の関係の図');
    s += `<rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - Bm}" fill="${css('--surface')}" stroke="${css('--line')}"/>`;
    // 締付けトルクの範囲
    if (r.scatter > 0) s += `<rect x="${X(Nm(r.Mmin))}" y="${T}" width="${Math.max(2, X(Nm(r.Mmax)) - X(Nm(r.Mmin)))}" height="${H - T - Bm}" fill="${css('--accent-weak')}"/>`;
    // 目盛り
    niceTicks(0, ymax, 5).t.forEach(v => { const y = Y(v); s += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="${gr}"/><text x="${L - 6}" y="${y + 4}" font-size="11" fill="${ink2}" text-anchor="end" font-family="${nf}">${esc(fmt(v, tickD(yt0.step)))}</text>`; });
    niceTicks(0, xmax, 5).t.forEach(v => { const x = X(v); s += `<line x1="${x}" x2="${x}" y1="${T}" y2="${H - Bm}" stroke="${gr}" stroke-opacity=".7"/><text x="${x}" y="${H - Bm + 15}" font-size="11" fill="${ink2}" text-anchor="middle" font-family="${nf}">${esc(fmt(v, tickD(xt0.step)))}</text>`; });
    s += `<text x="${L - 6}" y="12" font-size="10.5" fill="${ink2}" text-anchor="end">kN</text>`;
    s += `<text x="${W - R}" y="${H - 4}" font-size="11" fill="${ink2}" text-anchor="end">締付けトルク [N·m]</text>`;
    s += `<text x="${L + 6}" y="${T + 14}" font-size="11" fill="${ink2}">軸力</text>`;
    // 降伏する軸力（摩擦が最小・最大で値が違う）
    [[r.FyMin, r.muMin], [r.FyMax, r.muMax]].forEach(([F, m], i) => {
      if (i === 1 && Math.abs(r.FyMax - r.FyMin) < 1) return;
      const y = Y(kN(F));
      s += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" stroke="${ng}" stroke-dasharray="5 3" stroke-opacity="${i ? 0.6 : 1}"/>`;
      s += `<text x="${W - R - 4}" y="${y - 4}" font-size="10.5" fill="${ng}" text-anchor="end">降伏（μ ${m}）</text>`;
    });
    // トルクと軸力の線（降伏する軸力で止める）
    [[r.muMin, '--s1'], [r.muMax, '--s2']].forEach(([m, c]) => {
      const Fy = kN(r.Fy(m)), Mend = Math.min(xmax, Nm(r.M(r.Fy(m), m)));
      const Fend = kN(r.F(Mend * 1000, m));
      s += `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(Mend)}" y2="${Y(Fend)}" stroke="${css(c)}" stroke-width="2.4"/>`;
      if (Fend >= Fy - 1e-6) s += `<circle cx="${X(Mend)}" cy="${Y(Fend)}" r="4" fill="${ng}"/>`;
      // 線の名前（右端の少し手前）
      const xl = Math.min(Mend, xmax * 0.92), yl = kN(r.F(xl * 1000, m));
      s += `<text x="${X(xl) - 6}" y="${Y(yl) + (c === '--s1' ? -8 : 16)}" font-size="11" fill="${css(c)}" text-anchor="end" font-family="${nf}">μ ${m}</text>`;
    });
    // 軸力の範囲（縦の帯と線が交わるところ）を左の目盛りの横に示す
    const yA = Y(kN(r.Fmax)), yB = Y(kN(r.Fmin));
    s += `<rect x="${L + 2}" y="${yA}" width="6" height="${Math.max(2, yB - yA)}" fill="${css('--accent')}" rx="2"/>`;
    s += `<line x1="${L + 8}" x2="${X(Nm(r.Mmax))}" y1="${yA}" y2="${yA}" stroke="${css('--accent')}" stroke-dasharray="2 3"/>`;
    s += `<line x1="${L + 8}" x2="${X(Nm(r.Mmin))}" y1="${yB}" y2="${yB}" stroke="${css('--accent')}" stroke-dasharray="2 3"/>`;
    // 推奨トルクの点
    const xa = X(Nm(r.MA)), ya = Y(kN(r.FMzul));
    s += `<line x1="${xa}" x2="${xa}" y1="${ya}" y2="${H - Bm}" stroke="${mut}" stroke-dasharray="4 3"/>`;
    s += `<circle cx="${xa}" cy="${ya}" r="5" fill="${css('--surface')}" stroke="${css('--s1')}" stroke-width="2.4"/>`;
    const right = xa < W - 190;
    s += `<text x="${xa + (right ? 9 : -9)}" y="${ya + 18}" font-size="11.5" font-weight="700" fill="${ink}" text-anchor="${right ? 'start' : 'end'}">推奨 ${esc(sig(Nm(r.MA)))} N·m・${esc(sig(kN(r.FMzul)))} kN</text>`;
    el.innerHTML = s + '</svg>';
  }

  // トルクの内訳（摩擦が最小・最大）
  function drawSplit(r) {
    const el = $('cSplit'), narrow = el.clientWidth && el.clientWidth < 480;
    const W = narrow ? 420 : 600, L = narrow ? 64 : 76, R = 12, bh = 24, gap = 16, T = 10, H = T + 2 * bh + gap + 12;
    const ink2 = css('--ink2'), nf = NUMF(), onC = '#ffffff';
    let s = svgOpen(W, H, 'トルクの内訳の図');
    [[r.splitMin, r.muMin], [r.splitMax, r.muMax]].forEach(([sp, m], i) => {
      const y = T + i * (bh + gap);
      s += `<text x="${L - 8}" y="${y + bh / 2 + 4}" font-size="11.5" fill="${ink2}" text-anchor="end" font-family="${nf}">μ ${m}</text>`;
      let x = L;
      [[sp.pitch, '--s3'], [sp.thread, '--s1'], [sp.head, '--s2']].forEach(([f, c]) => {
        const w = f * (W - L - R);
        s += `<rect x="${x}" y="${y}" width="${w}" height="${bh}" fill="${css(c)}"/>`;
        if (w > 38) s += `<text x="${x + w / 2}" y="${y + bh / 2 + 4}" font-size="11.5" font-weight="700" fill="${onC}" text-anchor="middle" font-family="${nf}">${fmt(f * 100, 0)}%</text>`;
        x += w;
      });
    });
    el.innerHTML = s + '</svg>';
  }

  // 結果の表
  function drawResTable(r, tId, gId) {
    const rows = [
      ['ねじ', `${tId}`, '', `ピッチ ${r.g.P} mm`],
      ['強度区分', gId, '', `降伏点 ${fmt(r.Rp, 0)} MPa`],
      ['有効径 d2', fmt(r.g.d2, 3), 'mm', ''],
      ['応力断面積 As', fmt(r.g.AS, 1), 'mm²', 'ISO 898-1'],
      ['座面の摩擦の有効径 DKm', fmt(r.DKm, 2), 'mm', `(dw ${r.dw} + dh ${r.dh}) ÷ 2`],
      ['摩擦係数 μ', `${r.muMin}〜${r.muMax}`, '', 'ねじ面 = 座面'],
      ['降伏点の利用率 ν', fmt(r.nu * 100, 0), '%', ''],
      ['推奨締付けトルク MA', fmt(r.MA / 1000, 2), 'N·m', `μ ${r.muMin} で許容締付け軸力になるトルク`],
      ['指示するトルク', fmt(r.Mnom / 1000, 2), 'N·m', r.mode === 'upper' ? '上限を MA にした狙い値' : 'MA を狙い値'],
      ['トルクの範囲', `${fmt(r.Mmin / 1000, 2)}〜${fmt(r.Mmax / 1000, 2)}`, 'N·m', `±${fmt(r.scatter * 100, 1)}%`],
      ['許容締付け軸力 FMzul', fmt(r.FMzul / 1000, 2), 'kN', ''],
      ['軸力の範囲', `${fmt(r.Fmin / 1000, 2)}〜${fmt(r.Fmax / 1000, 2)}`, 'kN', `最大 ÷ 最小 ${fmt(r.ratioF, 2)}`],
      ['降伏点の利用率', `${pct(r.useMin)}〜${pct(r.useMax)}`, '%', ''],
      ['降伏する軸力', `${fmt(r.FyMin / 1000, 2)}〜${fmt(r.FyMax / 1000, 2)}`, 'kN', `μ ${r.muMin}〜${r.muMax}`],
      ['トルク係数 K', `${fmt(r.Kmin, 3)}〜${fmt(r.Kmax, 3)}`, '', 'JIS B 1083']
    ];
    $('cRes').innerHTML = `<table class="res"><tbody>${rows.map(([a, b, u, n]) => `<tr><th>${esc(a)}${n ? `<small>${esc(n)}</small>` : ''}</th><td>${esc(b)}${u ? `<span class="u">${esc(u)}</span>` : ''}</td></tr>`).join('')}</tbody></table>`;
    cCopy.push(['項目', '値', '単位', '備考']);
    rows.forEach(rw => cCopy.push(rw));
  }

  // ================= トルク表 =================
  const MUS = [0.08, 0.10, 0.12, 0.14, 0.16, 0.20, 0.24, 0.30];
  const tCopy = [];
  function renderTable() {
    const t = st.t, nu = String(t.nu).trim() === '' ? 0.9 : num(t.nu) / 100;
    const nuBad = !(nu > 0 && nu <= 1);
    $('tNu').classList.toggle('bad', nuBad);
    const g = TC.findGrade(t.gr);
    $('tTitle').textContent = `トルク表（${g.id}・${t.kind === 'M' ? '締付けトルク N·m' : '締付け軸力 kN'}）`;
    tCopy.length = 0;
    if (nuBad) { $('tTable').innerHTML = '<div class="msg err">× 降伏点の利用率は 0 を超え 100 以下で入れてください。</div>'; return; }
    const list = TC.THREADS.filter(x => x.coarse === (t.series === 'coarse'));
    const head = ['ねじ', ...MUS.map(m => `μ ${m.toFixed(2)}`)];
    tCopy.push([`${g.id}・${t.kind === 'M' ? '締付けトルク [N·m]' : '締付け軸力 [kN]'}・ν ${fmt(nu * 100, 0)}%・ボルト穴 ${['1級', '2級', '3級'][+t.hole]}`]);
    tCopy.push(head);
    const body = list.map(x => {
      const seat = TC.seatOf(x.d, +t.hole);
      const out = g.dMax && x.d > g.dMax;
      const vals = MUS.map(m => {
        const r = TC.calc({ thread: x.id, grade: g.id, mu: [m, m], nu, dw: seat.dw, dh: seat.dh });
        return r.errors.length ? NaN : (t.kind === 'M' ? r.MA : r.FMzul) / 1000;
      });
      tCopy.push([x.id, ...vals.map(v => sig(v).replace(/,/g, ''))]);
      const cur = st.c.thr === x.id ? ' class="cur"' : '';
      return `<tr data-thr="${esc(x.id)}"${cur}><th>${esc(x.id.replace('x', '×'))}${out ? '<small>範囲外</small>' : ''}</th>${vals.map(v => `<td${out ? ' class="na"' : ''}>${esc(sig(v))}</td>`).join('')}</tr>`;
    }).join('');
    $('tTable').innerHTML = `<table class="tq"><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>` +
      (g.dMax ? `<p class="hint">「範囲外」は、${g.id} の規定（呼び径 ${g.dMax} mm 以下）を超える径です。参考値として灰色で示しています。</p>` : '');
    $('tTable').querySelectorAll('tbody tr').forEach(tr => tr.addEventListener('click', () => {
      st.c.thr = tr.dataset.thr; st.c.gr = t.gr; st.c.hole = t.hole; st.c.head = 'hex'; st.c.nu = t.nu; syncSeat();
      st.mode = 'calc'; fillInputs(); save(); render(); window.scrollTo(0, 0);
    }));
  }

  // ---- 表示の切り替え ----
  function render() {
    segUpd.forEach(f => f());
    if (!['calc', 'table', 'explain'].includes(st.mode)) st.mode = 'calc';
    $('calcPanel').hidden = st.mode !== 'calc'; $('tablePanel').hidden = st.mode !== 'table'; $('explainPanel').hidden = st.mode !== 'explain';
    if (st.mode === 'calc') renderCalc(); else if (st.mode === 'table') renderTable();
  }

  function copyRows(rows) {
    if (!rows.length) { toast('先に正しい値を入れてください'); return; }
    const text = rows.map(r => r.join('\t')).join('\n');
    const done = () => toast('コピーしました。Excel に貼り付けられます');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
    function fallback() {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* 失敗 */ }
      ta.remove(); toast(ok ? 'コピーしました。Excel に貼り付けられます' : 'コピーできませんでした。表を選んでコピーしてください');
    }
  }
  $('cCopy').addEventListener('click', () => copyRows(cCopy));
  $('tCopy').addEventListener('click', () => copyRows(tCopy));

  // ---- テーマ（QC Workbench の全ツールで共通のキー） ----
  const THEMES = ['auto', 'light', 'dark'], THEME_LABEL = { auto: '表示：自動', light: '表示：ライト', dark: '表示：ダーク' }, THEME_KEY = 'qc-workbench-theme';
  const readTheme = () => { try { const t = localStorage.getItem(THEME_KEY); return THEMES.includes(t) ? t : 'auto'; } catch (e) { return 'auto'; } };
  let theme = readTheme();
  function applyTheme(t) {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t;
    $('themeBtn').textContent = THEME_LABEL[t];
  }
  $('themeBtn').addEventListener('click', () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % 3];
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* 保存できない環境 */ }
    applyTheme(theme);
  });
  window.addEventListener('storage', e => { if (e.key === THEME_KEY || e.key === null) { theme = readTheme(); applyTheme(theme); } });
  applyTheme(theme);
  // テーマが変わったら図の色を描き直す
  new MutationObserver(() => render()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => render());
  let rz = 0; window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(render, 150); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => render());

  // ---- 初期表示 ----
  if (st.c.head === 'hex' || st.c.hole !== 'custom') syncSeat();
  fillInputs(); render();

  // ---- オフライン対応 ----
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
          const w = reg.installing; if (!w) return;
          w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) toast('新しい版を取り込みました。開き直すと反映されます'); });
        });
      }).catch(() => { /* 登録できない環境 */ });
    });
  }
})();
