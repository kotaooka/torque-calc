// ボルトの締付けトルクの計算（VDI 2230 Blatt 1:2015 の許容締付け軸力と締付けトルク）。Node でも読み込み可
// 長さは mm、力は N（画面では kN）、トルクは N·mm（画面では N·m）、応力は MPa で扱う
(function (root) {
  'use strict';

  // ================= ねじと座面の寸法 =================
  // 並目ねじ（ISO 261 / JIS B 0205）：呼び径、ピッチ
  // dw：六角ボルト（ISO 4014 / ISO 4017）の座面の径の最小（M24 以下は部品等級 A、M27 以上は B）
  // hole：ボルト穴径（ISO 273 / JIS B 1001）の 1 級（精）・2 級（中）・3 級（粗）
  const SIZES = {
    3: { P: 0.5, dw: 4.57, s: 5.5, hole: [3.2, 3.4, 3.6] },
    4: { P: 0.7, dw: 5.88, s: 7, hole: [4.3, 4.5, 4.8] },
    5: { P: 0.8, dw: 6.88, s: 8, hole: [5.3, 5.5, 5.8] },
    6: { P: 1, dw: 8.88, s: 10, hole: [6.4, 6.6, 7] },
    8: { P: 1.25, dw: 11.63, s: 13, hole: [8.4, 9, 10] },
    10: { P: 1.5, dw: 14.63, s: 16, hole: [10.5, 11, 12] },
    12: { P: 1.75, dw: 16.63, s: 18, hole: [13, 13.5, 14.5] },
    14: { P: 2, dw: 19.64, s: 21, hole: [15, 15.5, 16.5] },
    16: { P: 2, dw: 22.49, s: 24, hole: [17, 17.5, 18.5] },
    18: { P: 2.5, dw: 25.34, s: 27, hole: [19, 20, 21] },
    20: { P: 2.5, dw: 28.19, s: 30, hole: [21, 22, 24] },
    22: { P: 2.5, dw: 31.71, s: 34, hole: [23, 24, 26] },
    24: { P: 3, dw: 33.61, s: 36, hole: [25, 26, 28] },
    27: { P: 3, dw: 38.0, s: 41, hole: [28, 30, 32] },
    30: { P: 3.5, dw: 42.75, s: 46, hole: [31, 33, 35] },
    33: { P: 3.5, dw: 46.55, s: 50, hole: [34, 36, 38] },
    36: { P: 4, dw: 51.11, s: 55, hole: [37, 39, 42] },
    39: { P: 4, dw: 55.86, s: 60, hole: [40, 42, 45] }
  };
  // 細目ねじ（ISO 262 の選択）。座面とボルト穴は同じ呼び径の並目と同じ（ISO 8765 は ISO 4014 と同じ頭部）
  const FINE = [[8, 1], [10, 1.25], [10, 1], [12, 1.5], [12, 1.25], [14, 1.5], [16, 1.5], [18, 1.5], [20, 1.5], [22, 1.5], [24, 2], [27, 2], [30, 2], [33, 2], [36, 3], [39, 3]];

  const THREADS = [];
  Object.keys(SIZES).map(Number).sort((a, b) => a - b).forEach(d => THREADS.push({ id: `M${d}`, d, P: SIZES[d].P, coarse: true }));
  FINE.forEach(([d, P]) => THREADS.push({ id: `M${d}x${P}`, d, P, coarse: false }));
  const findThread = id => THREADS.find(t => t.id === id) || null;

  // ねじの基本寸法（ISO 724）と、VDI 2230 で使う応力断面積
  function threadGeom(d, P) {
    const d2 = d - 0.649519 * P;     // 有効径
    const d3 = d - 1.226869 * P;     // おねじの谷の径
    const dS = (d2 + d3) / 2;        // 応力断面積の径
    const AS = Math.PI / 4 * dS * dS; // 応力断面積
    return { d, P, d2, d3, dS, AS };
  }

  // ================= 強度区分 =================
  // Rp：下降伏点 ReL、0.2% 耐力 Rp0.2、または Rpf の最小値 [MPa]
  // 鋼：ISO 898-1:2013（JIS B 1051:2014）。ステンレス：ISO 3506-1:2020
  const GRADES = [
    { id: '4.6', mat: 'steel', Rp: () => 240, note: '下降伏点 ReL' },
    { id: '4.8', mat: 'steel', Rp: () => 340, note: 'Rpf' },
    { id: '5.6', mat: 'steel', Rp: () => 300, note: '下降伏点 ReL' },
    { id: '5.8', mat: 'steel', Rp: () => 420, note: 'Rpf' },
    { id: '6.8', mat: 'steel', Rp: () => 480, note: 'Rpf' },
    { id: '8.8', mat: 'steel', Rp: d => (d <= 16 ? 640 : 660), note: '0.2% 耐力 Rp0.2（16 mm 以下 640、超える 660）' },
    { id: '9.8', mat: 'steel', Rp: () => 720, note: '0.2% 耐力 Rp0.2', dMax: 16 },
    { id: '10.9', mat: 'steel', Rp: () => 940, note: '0.2% 耐力 Rp0.2' },
    { id: '12.9', mat: 'steel', Rp: () => 1100, note: '0.2% 耐力 Rp0.2' },
    { id: 'A2-50', mat: 'stainless', Rp: () => 210, note: '0.2% 耐力 Rp0.2', dMax: 39 },
    { id: 'A2-70', mat: 'stainless', Rp: () => 450, note: '0.2% 耐力 Rp0.2', dMax: 24 },
    { id: 'A2-80', mat: 'stainless', Rp: () => 600, note: '0.2% 耐力 Rp0.2', dMax: 24 },
    { id: 'A4-50', mat: 'stainless', Rp: () => 210, note: '0.2% 耐力 Rp0.2', dMax: 39 },
    { id: 'A4-70', mat: 'stainless', Rp: () => 450, note: '0.2% 耐力 Rp0.2', dMax: 24 },
    { id: 'A4-80', mat: 'stainless', Rp: () => 600, note: '0.2% 耐力 Rp0.2', dMax: 24 }
  ];
  const findGrade = id => GRADES.find(g => g.id === id) || null;

  // ================= 摩擦係数 =================
  // VDI 2230 Blatt 1 表 A5 の摩擦係数の区分（ねじ面・座面）。例は目安
  const FRICTION = [
    { id: 'A', lo: 0.04, hi: 0.10, ja: '区分A 0.04〜0.10', ex: '固体潤滑剤（MoS₂ペーストなど）や潤滑剤を塗った面' },
    { id: 'B', lo: 0.08, hi: 0.16, ja: '区分B 0.08〜0.16', ex: '量産ボルトで多い組み合わせ。りん酸塩皮膜＋油、潤滑剤入りの亜鉛めっき・亜鉛フレークなど' },
    { id: 'C', lo: 0.14, hi: 0.24, ja: '区分C 0.14〜0.24', ex: '潤滑しない亜鉛めっき・黒染め、潤滑剤を塗ったステンレスなど' },
    { id: 'D', lo: 0.20, hi: 0.35, ja: '区分D 0.20〜0.35', ex: '潤滑しないステンレス・アルミとの組み合わせなど。かじりやすく、ばらつきが大きい' }
  ];

  // ================= 計算 =================
  // トルクと軸力の関係（VDI 2230 式 (R11)、JIS B 1083 と同じ形）：M = F (0.16 P + 0.58 d2 μG + DKm/2 μK)
  const torqueFactor = (g, mu, DKm) => 0.16 * g.P + 0.58 * g.d2 * mu + DKm / 2 * mu;   // [mm]
  // 締付け時の相当応力の係数（VDI 2230 式 (R7)、ねじり応力の係数 kτ = 0.5 込み）
  const stressFactor = (g, mu) => Math.sqrt(1 + 3 * Math.pow(1.5 * g.d2 / g.dS * (g.P / (Math.PI * g.d2) + 1.155 * mu), 2));
  // 許容締付け軸力（降伏点の ν 倍まで使う軸力）
  const preloadAt = (g, Rp, nu, mu) => g.AS * nu * Rp / stressFactor(g, mu);

  // 入力：thread（id）または d・P、grade（id）または Rp、mu: [最小, 最大]、nu（0〜1）、
  //       dw（座面の径）、dh（ボルト穴径）、scatter（トルクのばらつき ±、割合）、mode（'target' | 'upper'）
  function calc(o) {
    const errors = [];
    let d = o.d, P = o.P;
    if (o.thread) { const t = findThread(o.thread); if (!t) errors.push('ねじが見つかりません。'); else { d = t.d; P = t.P; } }
    if (!(d > 0) || !(P > 0)) errors.push('呼び径とピッチを入れてください。');
    let Rp = o.Rp, grade = null;
    if (o.grade) { grade = findGrade(o.grade); if (!grade) errors.push('強度区分が見つかりません。'); else if (d > 0) Rp = grade.Rp(d); }
    if (!(Rp > 0)) errors.push('降伏点（耐力）を入れてください。');
    const mu = o.mu || [];
    const muMin = mu[0], muMax = mu.length > 1 ? mu[1] : mu[0];
    if (!(muMin > 0) || !(muMax > 0)) errors.push('摩擦係数を入れてください。');
    else if (muMin > muMax) errors.push('摩擦係数は最小 ≦ 最大で入れてください。');
    const nu = o.nu == null ? 0.9 : o.nu;
    if (!(nu > 0 && nu <= 1)) errors.push('降伏点の利用率は 0 を超え 100% 以下で入れてください。');
    const dw = o.dw, dh = o.dh;
    if (!(dw > 0) || !(dh > 0)) errors.push('座面の径とボルト穴径を入れてください。');
    else if (dh >= dw) errors.push('ボルト穴径が座面の径以上です。座面が当たらないので計算できません。');
    const scatter = o.scatter || 0;
    if (!(scatter >= 0 && scatter < 0.5)) errors.push('トルクのばらつきは 0〜50% で入れてください。');
    if (errors.length) return { errors };

    const g = threadGeom(d, P);
    const warns = [], infos = [];
    if (dh <= d) warns.push('ボルト穴径が呼び径以下です。入力を確かめてください。');
    if (grade && grade.dMax && d > grade.dMax) warns.push(`強度区分 ${grade.id} は呼び径 ${grade.dMax} mm 以下の規定です。規格の範囲外なので、参考値として見てください。`);
    const DKm = (dw + dh) / 2;   // 座面の摩擦の有効径
    // 推奨トルクは、摩擦が最小のときに許容締付け軸力になるトルク（VDI 2230 の表と同じ考え方）
    const FMzul = preloadAt(g, Rp, nu, muMin);
    const MA = FMzul * torqueFactor(g, muMin, DKm);
    // トルクの範囲：target は MA を狙い値にして ±ばらつき、upper は上限を MA にして下げる
    const mode = o.mode === 'upper' ? 'upper' : 'target';
    const Mnom = mode === 'upper' ? MA / (1 + scatter) : MA;
    const Mmax = Mnom * (1 + scatter), Mmin = Mnom * (1 - scatter);
    // 軸力の範囲（トルクが最大で摩擦が最小 → 最大、トルクが最小で摩擦が最大 → 最小）
    const Fmax = Mmax / torqueFactor(g, muMin, DKm);
    const Fmin = Mmin / torqueFactor(g, muMax, DKm);
    // 降伏する軸力（ν = 1）と、各条件での降伏点の利用率
    const FyMin = preloadAt(g, Rp, 1, muMin), FyMax = preloadAt(g, Rp, 1, muMax);
    const util = (F, m) => F * stressFactor(g, m) / g.AS / Rp;
    const useMax = util(Fmax, muMin), useMin = util(Fmin, muMax);
    if (useMax > 1) warns.push(`摩擦が最小でトルクが上限のとき、相当応力が降伏点を ${fmt((useMax - 1) * 100, 1)}% 超えます。トルクのばらつきを小さくするか、上限を推奨トルクに合わせてください。`);
    else if (useMax > nu + 1e-9) infos.push(`摩擦が最小でトルクが上限のとき、降伏点の利用率は ${fmt(useMax * 100, 1)}% で、設定した ${fmt(nu * 100, 0)}% を少し超えます（降伏はしません）。超えたくないときは、締付けトルクの決め方で「上限を推奨トルクに」を選んでください。`);
    // トルクの内訳（摩擦が最小・最大のそれぞれ）
    const split = m => {
      const tot = torqueFactor(g, m, DKm);
      return { pitch: 0.16 * g.P / tot, thread: 0.58 * g.d2 * m / tot, head: DKm / 2 * m / tot };
    };
    // JIS B 1083 のトルク係数 K = T / (F d)
    const K = m => torqueFactor(g, m, DKm) / g.d;
    return {
      errors: [], warns, infos, g, Rp, grade, nu, muMin, muMax, dw, dh, DKm, scatter, mode,
      FMzul, MA, Mnom, Mmin, Mmax, Fmin, Fmax, FyMin, FyMax, useMax, useMin,
      ratioF: Fmax / Fmin,
      splitMin: split(muMin), splitMax: split(muMax), Kmin: K(muMin), Kmax: K(muMax),
      // 図用：トルク M のときの軸力、摩擦 m のときの許容締付け軸力・降伏軸力
      F: (M, m) => M / torqueFactor(g, m, DKm),
      Fzul: m => preloadAt(g, Rp, nu, m),
      Fy: m => preloadAt(g, Rp, 1, m),
      M: (F, m) => F * torqueFactor(g, m, DKm)
    };
  }

  // 規格の座面の径・ボルト穴径（等級 0〜2）
  function seatOf(d, holeClass) {
    const s = SIZES[d]; if (!s) return null;
    return { dw: s.dw, s: s.s, dh: s.hole[holeClass == null ? 1 : holeClass] };
  }

  function fmt(x, n) { return Number.isFinite(x) ? x.toFixed(n) : '—'; }

  const api = { THREADS, SIZES, FINE, GRADES, FRICTION, findThread, findGrade, threadGeom, calc, seatOf, torqueFactor, stressFactor, preloadAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TorqueCalc = api;
})(typeof window !== 'undefined' ? window : globalThis);
