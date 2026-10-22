// Screw geometry kernel: ISO data, solid mesh builder, STL/STEP/ZIP writers.
(function (G) {
'use strict';
const D2R = Math.PI / 180, TAU = Math.PI * 2;

// ---------- Standards data (mm) ----------
const SIZES = [1.6, 2, 2.5, 3, 4, 5, 6, 8, 10, 12];
const COARSE = { 1.6: .35, 2: .4, 2.5: .45, 3: .5, 4: .7, 5: .8, 6: 1, 8: 1.25, 10: 1.5, 12: 1.75 };
const FINE = { 1.6: [.2], 2: [.25], 2.5: [.35], 3: [.35], 4: [.5], 5: [.5], 6: [.75], 8: [1, .75], 10: [1.25, 1, .75], 12: [1.5, 1.25, 1] };
const ISO888 = [2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120];
const TORX_A = { T6: 1.75, T8: 2.4, T10: 2.8, T15: 3.35, T20: 3.95, T25: 4.5, T30: 5.6, T40: 6.75, T45: 7.95, T50: 8.95, T55: 11.35 };
const MS = [1.6, 2, 2.5, 3, 4, 5, 6, 8, 10];
const zipObj = (keys, rows) => Object.fromEntries(keys.map((k, i) => [k, rows[i]]));
const machineB = d => (d <= 3 ? 25 : 38);
const machineLen = { 1.6: [2, 16], 2: [3, 20], 2.5: [3, 25], 3: [4, 30], 4: [5, 40], 5: [6, 50], 6: [8, 60], 8: [10, 80], 10: [12, 80] };

// head: cap | button | csks | cskf | pan | cheese | hex ; drive: hex | torx | ph | pz | slot | none
const STD = {
  'ISO 4762': { title: 'Hexagon socket head cap screw', head: 'cap', drives: ['hex'], fineStd: 'ISO 12474', fineFrom: 8,
    len: { 1.6: [2.5, 16], 2: [3, 20], 2.5: [4, 25], 3: [5, 30], 4: [6, 40], 5: [8, 50], 6: [10, 60], 8: [12, 80], 10: [16, 100], 12: [20, 120] },
    data: zipObj(SIZES, [[3, 1.6, 1.5, .7, 15], [3.8, 2, 1.5, 1, 16], [4.5, 2.5, 2, 1.1, 17], [5.5, 3, 2.5, 1.3, 18], [7, 4, 3, 2, 20], [8.5, 5, 4, 2.5, 22], [10, 6, 5, 3, 24], [13, 8, 6, 4, 28], [16, 10, 8, 5, 32], [18, 12, 10, 6, 36]].map(([dk, k, s, t, b]) => ({ dk, k, key: s, t, b }))) },
  'ISO 14579': { title: 'Hexalobular socket head cap screw', head: 'cap', drives: ['torx'],
    len: { 2: [3, 20], 2.5: [4, 25], 3: [5, 30], 4: [6, 40], 5: [8, 50], 6: [10, 60], 8: [12, 80], 10: [16, 100], 12: [20, 120] },
    data: zipObj([2, 2.5, 3, 4, 5, 6, 8, 10, 12], [[3.8, 2, 'T6', .78, 16], [4.5, 2.5, 'T8', .98, 17], [5.5, 3, 'T10', 1.14, 18], [7, 4, 'T20', 1.61, 20], [8.5, 5, 'T25', 1.84, 22], [10, 6, 'T30', 2.22, 24], [13, 8, 'T45', 3.12, 28], [16, 10, 'T50', 3.82, 32], [18, 12, 'T55', 5.02, 36]].map(([dk, k, key, t, b]) => ({ dk, k, key, t, b }))) },
  'ISO 7380-1': { title: 'Hexagon socket button head screw', head: 'button', drives: ['hex'], full: true,
    len: { 3: [4, 30], 4: [5, 40], 5: [6, 50], 6: [8, 60], 8: [10, 80], 10: [12, 80], 12: [16, 80] },
    data: zipObj([3, 4, 5, 6, 8, 10, 12], [[5.7, 1.65, 2, 1.04], [7.6, 2.2, 2.5, 1.3], [9.5, 2.75, 3, 1.56], [10.5, 3.3, 4, 2.08], [14, 4.4, 5, 2.6], [17.5, 5.5, 6, 3.12], [21, 6.6, 8, 4.16]].map(([dk, k, key, t]) => ({ dk, k, key, t }))) },
  'ISO 10642': { title: 'Hexagon socket countersunk head screw', head: 'csks', drives: ['hex'],
    len: { 3: [8, 30], 4: [8, 40], 5: [8, 50], 6: [8, 60], 8: [10, 80], 10: [12, 100], 12: [20, 100] },
    data: zipObj([3, 4, 5, 6, 8, 10, 12], [[6.72, 1.86, 2, 1.1, 18], [8.96, 2.48, 2.5, 1.5, 20], [11.2, 3.1, 3, 1.9, 22], [13.44, 3.72, 4, 2.2, 24], [17.92, 4.96, 5, 3, 28], [22.4, 6.2, 6, 3.6, 32], [26.88, 7.44, 8, 4.3, 36]].map(([dk, k, key, t, b]) => ({ dk, k, key, t, b }))) },
  'ISO 2009': { title: 'Slotted countersunk flat head screw', head: 'cskf', drives: ['slot'], machine: true, len: machineLen,
    data: zipObj(MS, [[3, 1, .4, .32], [3.8, 1.2, .5, .4], [4.7, 1.5, .6, .5], [5.5, 1.65, .8, .6], [8.4, 2.7, 1.2, 1], [9.3, 2.7, 1.2, 1.1], [11.3, 3.3, 1.6, 1.2], [15.8, 4.65, 2, 1.8], [18.3, 5, 2.5, 2]].map(([dk, k, n, t]) => ({ dk, k, key: n, t }))) },
  'ISO 7046-1': { title: 'Cross recessed countersunk flat head screw', head: 'cskf', drives: ['ph', 'pz'], machine: true, len: machineLen,
    data: zipObj(MS, [[3, 1, 0, 1.6, 1.6], [3.8, 1.2, 0, 1.9, 1.9], [4.7, 1.5, 1, 2.9, 2.8], [5.5, 1.65, 1, 3.2, 3], [8.4, 2.7, 2, 4.6, 4.4], [9.3, 2.7, 2, 5.2, 4.9], [11.3, 3.3, 3, 6.8, 6.6], [15.8, 4.65, 4, 8.9, 8.8], [18.3, 5, 4, 10, 9.8]].map(([dk, k, no, mH, mZ]) => ({ dk, k, no, mH, mZ }))) },
  'ISO 14581': { title: 'Hexalobular socket countersunk flat head screw', head: 'cskf', drives: ['torx'], machine: true, len: machineLen,
    data: zipObj([2, 2.5, 3, 4, 5, 6, 8, 10], [[3.8, 1.2, 'T6', .58], [4.7, 1.5, 'T8', .72], [5.5, 1.65, 'T10', .77], [8.4, 2.7, 'T20', 1.33], [9.3, 2.7, 'T25', 1.31], [11.3, 3.3, 'T30', 1.58], [15.8, 4.65, 'T45', 2.35], [18.3, 5, 'T50', 2.6]].map(([dk, k, key, t]) => ({ dk, k, key, t }))) },
  'ISO 1580': { title: 'Slotted pan head screw', head: 'pan', drives: ['slot'], machine: true, len: machineLen,
    data: zipObj(MS, [[3.2, 1, .4, .35], [4, 1.3, .5, .5], [5, 1.5, .6, .6], [5.6, 1.8, .8, .7], [8, 2.4, 1.2, 1], [9.5, 3, 1.2, 1.2], [12, 3.6, 1.6, 1.4], [16, 4.8, 2, 1.9], [20, 6, 2.5, 2.4]].map(([dk, k, n, t]) => ({ dk, k, key: n, t }))) },
  'ISO 7045': { title: 'Cross recessed pan head screw', head: 'pan', drives: ['ph', 'pz'], machine: true, len: machineLen,
    data: zipObj(MS, [[3.2, 1.3, 0, 1.7, 1.6], [4, 1.6, 0, 1.9, 2.1], [5, 2.1, 1, 2.7, 2.6], [5.6, 2.4, 1, 3, 2.8], [8, 3.1, 2, 4.4, 4.3], [9.5, 3.7, 2, 4.9, 4.7], [12, 4.6, 3, 6.9, 6.7], [16, 6, 4, 9, 8.8], [20, 7.5, 4, 10.1, 9.9]].map(([dk, k, no, mH, mZ]) => ({ dk, k, no, mH, mZ }))) },
  'ISO 14583': { title: 'Hexalobular socket pan head screw', head: 'pan', drives: ['torx'], machine: true, len: machineLen,
    data: zipObj([2, 2.5, 3, 4, 5, 6, 8, 10], [[4, 1.6, 'T6', .7], [5, 2.1, 'T8', .98], [5.6, 2.4, 'T10', 1.14], [8, 3.1, 'T20', 1.47], [9.5, 3.7, 'T25', 1.72], [12, 4.6, 'T30', 2.22], [16, 6, 'T45', 2.99], [20, 7.5, 'T50', 3.82]].map(([dk, k, key, t]) => ({ dk, k, key, t }))) },
  'ISO 1207': { title: 'Slotted cheese head screw', head: 'cheese', drives: ['slot'], machine: true, len: machineLen,
    data: zipObj(MS, [[3, 1.1, .4, .45], [3.8, 1.4, .5, .6], [4.5, 1.8, .6, .7], [5.5, 2, .8, .85], [7, 2.6, 1.2, 1.1], [8.5, 3.3, 1.2, 1.3], [10, 3.9, 1.6, 1.6], [13, 5, 2, 2], [16, 6, 2.5, 2.4]].map(([dk, k, n, t]) => ({ dk, k, key: n, t }))) },
  'ISO 14580': { title: 'Hexalobular socket cheese head screw', head: 'cheese', drives: ['torx'], machine: true, len: machineLen,
    data: zipObj([2, 2.5, 3, 4, 5, 6, 8, 10], [[3.8, 1.55, 'T6', .78], [4.5, 1.85, 'T8', .85], [5.5, 2.4, 'T10', 1.14], [7, 3.1, 'T20', 1.47], [8.5, 3.65, 'T25', 1.72], [10, 4.4, 'T30', 2.1], [13, 5.8, 'T45', 2.86], [16, 6.9, 'T50', 3.24]].map(([dk, k, key, t]) => ({ dk, k, key, t }))) },
  'ISO 4017': { title: 'Hexagon head screw, fully threaded', head: 'hex', drives: ['none'], full: true, fineStd: 'ISO 8676', fineFrom: 8,
    len: { 1.6: [2, 16], 2: [4, 20], 2.5: [5, 25], 3: [6, 30], 4: [8, 40], 5: [10, 50], 6: [12, 60], 8: [16, 80], 10: [20, 100], 12: [25, 120] },
    data: zipObj(SIZES, [[3.2, 1.1], [4, 1.4], [5, 1.7], [5.5, 2], [7, 2.8], [8, 3.5], [10, 4], [13, 5.3], [16, 6.4], [18, 7.5]].map(([s, k]) => ({ dk: s / Math.cos(30 * D2R), s, k, key: s }))) },
};
const HEADS = {
  cap: { name: 'Socket cap', note: 'Cylindrical head' },
  button: { name: 'Button', note: 'Low domed head' },
  pan: { name: 'Pan', note: 'Rounded machine head' },
  cheese: { name: 'Cheese', note: 'Tall cylindrical head' },
  csks: { name: 'Countersunk socket', note: '90° flush, hex key' },
  cskf: { name: 'Countersunk flat', note: '90° flush, machine' },
  hex: { name: 'Hex head', note: 'External hexagon' },
};
const DRIVES = { hex: 'Hex socket', torx: 'Hexalobular (Torx)', ph: 'Phillips (H)', pz: 'Pozidriv (Z)', slot: 'Slotted', none: 'External hex' };

function findStd(head, drive) {
  for (const [id, s] of Object.entries(STD)) if (s.head === head && s.drives.includes(drive)) return id;
  return null;
}
function drivesFor(head) {
  const out = [];
  for (const s of Object.values(STD)) if (s.head === head) for (const d of s.drives) if (!out.includes(d)) out.push(d);
  return out;
}
function lengthsFor(stdId, d) {
  const r = STD[stdId].len[d]; if (!r) return [];
  return ISO888.filter(l => l >= r[0] - 1e-9 && l <= r[1] + 1e-9);
}

// Resolve a full spec from user choices.
function resolve(c) {
  const stdId = findStd(c.head, c.drive);
  if (!stdId) return { error: 'No ISO standard combines this head and drive.' };
  const S = STD[stdId], row = S.data[c.d];
  if (!row) return { error: `${stdId} does not cover M${c.d}.` };
  const P = c.pitch || COARSE[c.d], fine = Math.abs(P - COARSE[c.d]) > 1e-9;
  const sp = { stdId, std: S, head: c.head, drive: c.drive, d: c.d, P, fine, L: c.L, helix: !!c.helix, ...row };
  // drive geometry
  if (c.drive === 'ph' || c.drive === 'pz') { sp.m = c.drive === 'ph' ? row.mH : row.mZ; sp.key = (c.drive === 'ph' ? 'PH' : 'PZ') + row.no; }
  if (c.drive === 'torx') sp.A = TORX_A[row.key];
  // designation & standard notes
  let std = stdId, warn = null;
  if (fine) {
    if (S.fineStd && c.d >= S.fineFrom) std = S.fineStd;
    else warn = `${stdId} specifies coarse pitch only; M${c.d}×${P} is a non-standard combination.`;
  }
  sp.designStd = std; sp.warn = warn;
  const sz = fine ? `M${c.d}×${P}` : `M${c.d}`;
  sp.designation = `${std} – ${sz} × ${c.L}` + (c.drive === 'ph' ? ' – H' : c.drive === 'pz' ? ' – Z' : '');
  // thread length
  sp.d3 = c.d - 1.22687 * P;
  const zj = (c.head === 'csks' || c.head === 'cskf') ? -row.k : 0;
  sp.zj = zj;
  let b = S.full ? Infinity : (S.machine ? machineB(c.d) : row.b);
  const shankLen = c.L + zj; // length below head
  sp.fullThread = shankLen <= b + 1e-9;
  sp.threadLen = sp.fullThread ? shankLen : b;
  sp.zThread = sp.fullThread ? zj - Math.min(1.5 * P, 0.25 * shankLen) : -c.L + b;
  return sp;
}

// ---------- 2D shape radial functions ----------
function polyRadial(poly) { // star-shaped polygon about origin -> R(theta)
  return th => {
    const dx = Math.cos(th), dy = Math.sin(th); let best = 0;
    for (let i = 0; i < poly.length; i++) {
      const [x1, y1] = poly[i], [x2, y2] = poly[(i + 1) % poly.length];
      const ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-14) continue;
      const t = (x1 * ey - y1 * ex) / den, u = (x1 * dy - y1 * dx) / den;
      if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9 && t > best) best = t;
    }
    return best;
  };
}
function hexPoly(s, rot = 0) { const r = s / Math.sqrt(3); return [0, 1, 2, 3, 4, 5].map(i => [r * Math.cos(i * Math.PI / 3 + rot), r * Math.sin(i * Math.PI / 3 + rot)]); }
function crossPoly(span, w, rot = 0) {
  const a = span / 2, h = w / 2;
  const pts = [[a, -h], [a, h], [h, h], [h, a], [-h, a], [-h, h], [-a, h], [-a, -h], [-h, -h], [-h, -a], [h, -a], [h, -h]];
  const c = Math.cos(rot), s = Math.sin(rot);
  return pts.map(([x, y]) => [x * c - y * s, x * s + y * c]);
}
function torxPoly(A, seg = 10) {
  const re = 0.1 * A, ri = 0.175 * A, B = 0.72 * A;
  const co = k => { const a = k * Math.PI / 3, r = A / 2 - re; return [r * Math.cos(a), r * Math.sin(a)]; };
  const ci = k => { const a = k * Math.PI / 3 + Math.PI / 6, r = B / 2 + ri; return [r * Math.cos(a), r * Math.sin(a)]; };
  const tang = (o, i) => { const dx = i[0] - o[0], dy = i[1] - o[1], L = Math.hypot(dx, dy); return [o[0] + re * dx / L, o[1] + re * dy / L]; };
  const arc = (c, r, p1, p2, ref, out) => {
    let a1 = Math.atan2(p1[1] - c[1], p1[0] - c[0]), a2 = Math.atan2(p2[1] - c[1], p2[0] - c[0]);
    let sw = a2 - a1; while (sw <= -Math.PI) sw += TAU; while (sw > Math.PI) sw -= TAU;
    const mid = a1 + sw / 2, rd = Math.atan2(ref[1], ref[0]);
    let dm = Math.abs(((mid - rd) % TAU + TAU + Math.PI) % TAU - Math.PI);
    if (dm > Math.PI / 2) sw = sw > 0 ? sw - TAU : sw + TAU;
    for (let j = 0; j < seg; j++) { const a = a1 + sw * j / seg; out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
  };
  const pts = [];
  for (let k = 0; k < 6; k++) {
    const o = co(k), iPrev = ci(k - 1), iNext = ci(k), oNext = co(k + 1);
    arc(o, re, tang(o, iPrev), tang(o, iNext), o, pts);
    arc(iNext, ri, tang(o, iNext), tang(oNext, iNext), [-iNext[0], -iNext[1]], pts);
  }
  return pts;
}

// Drive description: radial function at top + rings below + corner angles
function driveModel(sp, zt) {
  const dv = sp.drive;
  if (dv === 'hex') {
    const s = sp.key, poly = hexPoly(s), R = polyRadial(poly), e2 = s / Math.sqrt(3);
    return { R, rmax: e2, corners: [0, 1, 2, 3, 4, 5].map(i => i * Math.PI / 3), outline: poly,
      rings: th => [[0, zt - sp.t - e2 * 0.6], [R(th), zt - sp.t]], depth: sp.t, label: `s ${s}` };
  }
  if (dv === 'torx') {
    const poly = torxPoly(sp.A), R = polyRadial(poly);
    return { R, rmax: sp.A / 2, corners: [], outline: poly, rings: th => [[0, zt - sp.t - sp.A * 0.12], [R(th), zt - sp.t]], depth: sp.t, label: sp.key };
  }
  if (dv === 'ph' || dv === 'pz') {
    const m = sp.m, w = 0.2 * m + 0.25 * Math.sqrt(m);
    let p1 = crossPoly(m, w), p2 = crossPoly(0.42 * m, 0.7 * w);
    let R1 = polyRadial(p1), R2 = polyRadial(p2), outline = p1, corners = p1.map(([x, y]) => Math.atan2(y, x));
    if (dv === 'pz') {
      const q1 = crossPoly(0.62 * m, 0.1 * m, Math.PI / 4), Q1 = polyRadial(q1), q2 = crossPoly(0.3 * m, 0.08 * m, Math.PI / 4), Q2 = polyRadial(q2);
      const a = R1, b = R2; R1 = th => Math.max(a(th), Q1(th)); R2 = th => Math.max(b(th), Q2(th));
      corners = corners.concat(q1.map(([x, y]) => Math.atan2(y, x)));
      outline = null; // composite outline sampled
    }
    const tt = 0.6 * m;
    return { R: R1, rmax: m / 2, corners, outline, rings: th => [[0, zt - tt], [R2(th), zt - 0.55 * tt]], depth: tt, label: sp.key };
  }
  if (dv === 'slot') return { slot: true, n: sp.key, depth: sp.t * 1.15, label: `n ${sp.key}` };
  return { none: true, label: '' };
}

// Head meridian profile P(theta): polyline [r,z] from (0,zt) to junction (d/2, zj)
function headProfile(sp, dm) {
  const { dk, k, d } = sp, hd = sp.head, r0 = d / 2;
  if (hd === 'cap' || hd === 'cheese') {
    const c = Math.min(0.06 * dk, 0.25 * k);
    return () => [[0, k], [dk / 2 - c, k], [dk / 2, k - c], [dk / 2, 0], [r0, 0]];
  }
  if (hd === 'button' || hd === 'pan') {
    const rim = hd === 'button' ? 0.16 * k : 0.48 * k;
    const need = dm.rmax ? dm.rmax * 1.22 : (dm.slot ? 0 : 0);
    const rp = Math.min(Math.max(hd === 'button' ? 0.3 * dk : 0.36 * dk, need), 0.44 * dk);
    const pts = [[0, k], [rp, k]], a = dk / 2 - rp, b = k - rim;
    for (let i = 1; i <= 10; i++) { const f = i / 10 * Math.PI / 2; pts.push([rp + a * Math.sin(f), rim + b * Math.cos(f)]); }
    pts.push([dk / 2, 0], [r0, 0]);
    return () => pts;
  }
  if (hd === 'csks' || hd === 'cskf') {
    let ze = -k + (dk - d) / 2; if (ze > 0) ze = 0;
    const pts = [[0, 0], [dk / 2, 0]]; if (ze < -1e-6) pts.push([dk / 2, ze]); pts.push([r0, -k]);
    return () => pts;
  }
  if (hd === 'hex') {
    const s = sp.s, R = polyRadial(hexPoly(s, Math.PI / 6)), rch = 0.475 * s, t30 = Math.tan(30 * D2R);
    return th => { const r = R(th); return [[0, k], [Math.min(rch, r), k], [r, k - Math.max(0, r - rch) * t30], [r, 0], [r0, 0]]; };
  }
}

// Clamp profile P so it starts at point W lying at parameter (seg i, frac f)
function clampProfile(P, seg, W) {
  const out = [];
  for (let j = 0; j < P.length; j++) out.push(j <= seg ? W : P[j]);
  return out;
}
function pointAtR(P, r, limitSeg) { // on increasing-r segments before limitSeg
  for (let i = 0; i < Math.min(P.length - 1, limitSeg + 1); i++) {
    const [r1, z1] = P[i], [r2, z2] = P[i + 1];
    if (r2 - r1 > 1e-12 && r >= r1 - 1e-12 && r <= r2 + 1e-12) { const f = (r - r1) / (r2 - r1); return { seg: i, p: [r, z1 + f * (z2 - z1)] }; }
  }
  return null;
}

function headMeridian(sp, dm, Pf, th) {
  const P = Pf(th);
  if (dm.none) return P.slice();
  if (dm.slot) {
    const zf = P[0][1] - dm.depth;
    // crossing of P below zf
    let cs = -1, cp = null;
    for (let i = 0; i < P.length - 1; i++) {
      const [r1, z1] = P[i], [r2, z2] = P[i + 1];
      if (z1 >= zf && z2 < zf) { const f = (z1 - zf) / (z1 - z2); cs = i; cp = [r1 + f * (r2 - r1), zf]; break; }
    }
    const c = Math.abs(Math.cos(th)), rs = c < 1e-9 ? 1e9 : (dm.n / 2) / c;
    let W, seg, floorEnd;
    const hit = rs < cp[0] - 1e-12 ? pointAtR(P, rs, cs) : null;
    if (hit) { W = hit.p; seg = hit.seg; floorEnd = [rs, zf]; } else { W = cp; seg = cs; floorEnd = cp; }
    return [[0, zf], floorEnd, W].concat(clampProfile(P, seg, W));
  }
  const rings = dm.rings(th), W = [dm.R(th), P[0][1]];
  return rings.concat([W], clampProfile(P, 0, W));
}

function headAngles(sp, dm, Pf) {
  const N = 192, a = [];
  for (let i = 0; i < N; i++) a.push(i * TAU / N);
  if (dm.corners) a.push(...dm.corners);
  if (sp.head === 'hex') for (let i = 0; i < 6; i++) a.push(i * Math.PI / 3 + Math.PI / 6);
  if (dm.slot) {
    const P = Pf(0), zf = P[0][1] - dm.depth, radii = P.map(p => p[0]);
    for (let i = 0; i < P.length - 1; i++) { const [r1, z1] = P[i], [r2, z2] = P[i + 1]; if (z1 >= zf && z2 < zf) radii.push(r1 + (z1 - zf) / (z1 - z2) * (r2 - r1)); }
    for (const r of radii) if (r > dm.n / 2 + 1e-9) { const b = Math.acos(dm.n / 2 / r); a.push(b, Math.PI - b, Math.PI + b, TAU - b); }
    // dense near the slot walls' outer ends
  }
  const norm = a.map(x => ((x % TAU) + TAU) % TAU).sort((x, y) => x - y), out = [];
  for (const x of norm) if (!out.length || x - out[out.length - 1] > 1e-7) out.push(x);
  if (TAU - out[out.length - 1] < 1e-7) out.pop();
  return out;
}

// ---------- thread ----------
function threadProfile(sp) {
  const P = sp.P, h = 0.61343 * P, R = sp.d / 2, fl = h * Math.tan(30 * D2R) / P;
  const u1 = 0.125, u2 = u1 + fl, u3 = u2 + (1 - u1 - 2 * fl);
  return u => { // u in [0,1)
    if (u < u1) return R;
    if (u < u2) return R - h * (u - u1) / fl;
    if (u < u3) return R - h;
    return R - h + h * (u - u3) / fl;
  };
}

// ---------- mesh builder ----------
function buildMesh(sp) {
  const dm = driveModel(sp, sp.head === 'csks' || sp.head === 'cskf' ? 0 : sp.k);
  const Pf = headProfile(sp, dm);
  const angs = headAngles(sp, dm, Pf);
  const pos = [], tris = [];
  const V = (x, y, z) => (pos.push(x, y, z), pos.length / 3 - 1);
  // head polar mesh
  const grid = angs.map(th => headMeridian(sp, dm, Pf, th).map(([r, z]) => V(r * Math.cos(th), r * Math.sin(th), z)));
  const M = grid[0].length;
  for (const g of grid) if (g.length !== M) throw new Error('meridian count mismatch');
  const quadStrip = (A, B) => { for (let j = 0; j < A.length - 1; j++) { tris.push(A[j], B[j], B[j + 1]); tris.push(A[j], B[j + 1], A[j + 1]); } };
  for (let i = 0; i < grid.length; i++) quadStrip(grid[i], grid[(i + 1) % grid.length]);
  const headRing = grid.map(g => g[M - 1]);
  // shank
  const r0 = sp.d / 2, L = sp.L, P = sp.P, zj = sp.zj;
  const Ns = sp.helix ? Math.max(48, Math.min(72, Math.round(sp.d * 9))) : 96;
  const sAng = []; for (let i = 0; i < Ns; i++) sAng.push(i * TAU / Ns);
  const dlt = Math.min(0.05 * sp.d, 0.3 * P);
  const rows = []; // each row: function th->r, z
  rows.push({ z: zj - dlt, r: () => r0 });
  const rMinor = r0 - 0.61343 * P, rTip = rMinor - 0.05 * P;
  if (!sp.helix) {
    const c = r0 - rTip;
    rows.push({ z: -L + c, r: () => r0 }, { z: -L, r: () => rTip });
  } else {
    const prof = threadProfile(sp), zs = Math.min(sp.zThread, zj - dlt - 1e-3);
    if (zs < zj - dlt - 1e-6) rows.push({ z: zs, r: () => r0 });
    const dz = P / 12, n = Math.max(2, Math.ceil((zs + L) / dz));
    for (let i = 1; i <= n; i++) {
      const z = zs - (zs + L) * i / n;
      rows.push({ z, r: th => {
        let u = (z / P - th / TAU) % 1; if (u < 0) u += 1;
        const s = Math.min(1, Math.max(0, (zs - z) / (1.5 * P)));
        let r = r0 - s * (r0 - prof(u));
        return Math.min(r, rTip + (z + L));
      } });
    }
  }
  const sGrid = sAng.map(th => rows.map(rw => { const r = rw.r(th); return V(r * Math.cos(th), r * Math.sin(th), rw.z); }));
  const tipC = V(0, 0, -L);
  sGrid.forEach(g => g.push(tipC));
  for (let i = 0; i < Ns; i++) quadStrip(sGrid[i], sGrid[(i + 1) % Ns]);
  // stitch headRing (angs) to shank first ring (sAng)
  const sRing = sGrid.map(g => g[0]);
  { let i = 0, j = 0; const nA = angs.length;
    while (i < nA || j < Ns) {
      const aNext = i < nA ? (i + 1 < nA ? angs[i + 1] : TAU) : Infinity;
      const bNext = j < Ns ? (j + 1 < Ns ? sAng[j + 1] : TAU) : Infinity;
      if (aNext <= bNext && i < nA) { tris.push(headRing[i % nA], headRing[(i + 1) % nA], sRing[j % Ns]); i++; }
      else { tris.push(headRing[i % nA], sRing[(j + 1) % Ns], sRing[j % Ns]); j++; }
    }
  }
  return finalize(pos, tris);
}

function finalize(pos, tris) {
  const map = new Map(), np = [], remap = new Int32Array(pos.length / 3);
  const q = v => Math.round(v * 1e6);
  for (let i = 0; i < pos.length / 3; i++) {
    const key = q(pos[3 * i]) + ',' + q(pos[3 * i + 1]) + ',' + q(pos[3 * i + 2]);
    let id = map.get(key); if (id === undefined) { id = np.length / 3; map.set(key, id); np.push(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]); }
    remap[i] = id;
  }
  const nt = [];
  for (let t = 0; t < tris.length; t += 3) {
    const a = remap[tris[t]], b = remap[tris[t + 1]], c = remap[tris[t + 2]];
    if (a === b || b === c || a === c) continue;
    const ux = np[3 * b] - np[3 * a], uy = np[3 * b + 1] - np[3 * a + 1], uz = np[3 * b + 2] - np[3 * a + 2];
    const vx = np[3 * c] - np[3 * a], vy = np[3 * c + 1] - np[3 * a + 1], vz = np[3 * c + 2] - np[3 * a + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * cx + cy * cy + cz * cz < 1e-22) continue;
    nt.push(a, b, c);
  }
  // signed volume -> orientation
  let vol = 0;
  for (let t = 0; t < nt.length; t += 3) {
    const a = 3 * nt[t], b = 3 * nt[t + 1], c = 3 * nt[t + 2];
    vol += (np[a] * (np[b + 1] * np[c + 2] - np[b + 2] * np[c + 1]) - np[a + 1] * (np[b] * np[c + 2] - np[b + 2] * np[c]) + np[a + 2] * (np[b] * np[c + 1] - np[b + 1] * np[c])) / 6;
  }
  if (vol < 0) { for (let t = 0; t < nt.length; t += 3) { const x = nt[t + 1]; nt[t + 1] = nt[t + 2]; nt[t + 2] = x; } vol = -vol; }
  return { pos: new Float64Array(np), idx: new Uint32Array(nt), volume: vol };
}

function checkManifold(mesh) {
  const e = new Map(), I = mesh.idx;
  for (let t = 0; t < I.length; t += 3) for (let k = 0; k < 3; k++) {
    const a = I[t + k], b = I[t + (k + 1) % 3], key = a < b ? a + '_' + b : b + '_' + a;
    const v = e.get(key) || { n: 0, d: 0 }; v.n++; v.d += a < b ? 1 : -1; e.set(key, v);
  }
  let bad = 0, flip = 0; for (const v of e.values()) { if (v.n !== 2) bad++; else if (v.d !== 0) flip++; }
  return { edges: e.size, nonManifold: bad, misoriented: flip };
}

// ---------- exporters ----------
function toSTL(mesh, name) {
  const I = mesh.idx, p = mesh.pos, n = I.length / 3, buf = new ArrayBuffer(84 + 50 * n), dv = new DataView(buf);
  const hdr = ('Screw Studio ' + name).slice(0, 79); for (let i = 0; i < hdr.length; i++) dv.setUint8(i, hdr.charCodeAt(i) & 127);
  dv.setUint32(80, n, true); let o = 84;
  for (let t = 0; t < I.length; t += 3) {
    const a = 3 * I[t], b = 3 * I[t + 1], c = 3 * I[t + 2];
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
    dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true); o += 12;
    for (const q of [a, b, c]) { dv.setFloat32(o, p[q], true); dv.setFloat32(o + 4, p[q + 1], true); dv.setFloat32(o + 8, p[q + 2], true); o += 12; }
    o += 2;
  }
  return buf;
}

// Faceted B-rep STEP (AP214). Coplanar adjacent triangle pairs are merged into quads.
function toSTEP(mesh, meta) {
  const I = mesh.idx, p = mesh.pos;
  const f = v => { if (Math.abs(v) < 5e-10) return '0.'; let s = (+v.toFixed(6)).toString(); if (!/[.eE]/.test(s)) s += '.'; return s; };
  const L = []; let id = 0; const E = s => (L.push('#' + (++id) + '=' + s + ';'), id);
  const esc = s => String(s).replace(/'/g, "''");
  const ctx = E("APPLICATION_CONTEXT('core data for automotive mechanical design processes')");
  E(`APPLICATION_PROTOCOL_DEFINITION('international standard','automotive_design',2000,#${ctx})`);
  const pc = E(`PRODUCT_CONTEXT('',#${ctx},'mechanical')`);
  const prod = E(`PRODUCT('${esc(meta.id)}','${esc(meta.name)}','${esc(meta.desc)}',(#${pc}))`);
  E(`PRODUCT_RELATED_PRODUCT_CATEGORY('part',$,(#${prod}))`);
  const pdf = E(`PRODUCT_DEFINITION_FORMATION('','',#${prod})`);
  const pdc = E(`PRODUCT_DEFINITION_CONTEXT('part definition',#${ctx},'design')`);
  const pd = E(`PRODUCT_DEFINITION('design','',#${pdf},#${pdc})`);
  const pds = E(`PRODUCT_DEFINITION_SHAPE('','',#${pd})`);
  const lu = E('(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))');
  const au = E('(NAMED_UNIT(*)PLANE_ANGLE_UNIT()SI_UNIT($,.RADIAN.))');
  const su = E('(NAMED_UNIT(*)SI_UNIT($,.STERADIAN.)SOLID_ANGLE_UNIT())');
  const um = E(`UNCERTAINTY_MEASURE_WITH_UNIT(LENGTH_MEASURE(1.E-06),#${lu},'distance_accuracy_value','confusion accuracy')`);
  const rc = E(`(GEOMETRIC_REPRESENTATION_CONTEXT(3)GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#${um}))GLOBAL_UNIT_ASSIGNED_CONTEXT((#${lu},#${au},#${su}))REPRESENTATION_CONTEXT('Context3D','3D Context with 0.001 mm uncertainty'))`);
  const o = E("CARTESIAN_POINT('',(0.,0.,0.))"), dz = E("DIRECTION('',(0.,0.,1.))"), dx = E("DIRECTION('',(1.,0.,0.))");
  const ax = E(`AXIS2_PLACEMENT_3D('',#${o},#${dz},#${dx})`);
  const pts = new Int32Array(p.length / 3);
  for (let i = 0; i < pts.length; i++) pts[i] = E(`CARTESIAN_POINT('',(${f(p[3 * i])},${f(p[3 * i + 1])},${f(p[3 * i + 2])}))`);
  // face normals & merging
  const nT = I.length / 3, nrm = new Float64Array(nT * 3);
  for (let t = 0; t < nT; t++) {
    const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz);
    nrm[3 * t] = nx / l; nrm[3 * t + 1] = ny / l; nrm[3 * t + 2] = nz / l;
  }
  const edgeT = new Map();
  for (let t = 0; t < nT; t++) for (let k = 0; k < 3; k++) edgeT.set(I[3 * t + k] + '_' + I[3 * t + (k + 1) % 3], t);
  const used = new Uint8Array(nT), faces = [];
  for (let t = 0; t < nT; t++) {
    if (used[t]) continue; used[t] = 1; let loop = [I[3 * t], I[3 * t + 1], I[3 * t + 2]];
    for (let k = 0; k < 3; k++) {
      const a = loop[k], b = loop[(k + 1) % 3], u = edgeT.get(b + '_' + a);
      if (u === undefined || used[u]) continue;
      const dot = nrm[3 * t] * nrm[3 * u] + nrm[3 * t + 1] * nrm[3 * u + 1] + nrm[3 * t + 2] * nrm[3 * u + 2];
      if (dot < 1 - 1e-10) continue;
      const tri = [I[3 * u], I[3 * u + 1], I[3 * u + 2]], c = tri.find(v => v !== a && v !== b);
      // convexity check of quad a,c? order: loop with c inserted between a and b
      const q = loop.slice(0, k + 1).concat([c], loop.slice(k + 1));
      if (!convexQuad(q, p, [nrm[3 * t], nrm[3 * t + 1], nrm[3 * t + 2]])) continue;
      used[u] = 1; loop = q; break;
    }
    faces.push({ loop, n: [nrm[3 * t], nrm[3 * t + 1], nrm[3 * t + 2]] });
  }
  const fids = [];
  for (const F of faces) {
    const pl = E(`POLY_LOOP('',(${F.loop.map(v => '#' + pts[v]).join(',')}))`);
    const fb = E(`FACE_OUTER_BOUND('',#${pl},.T.)`);
    const [nx, ny, nz] = F.n; let rx = 1, ry = 0, rz = 0; if (Math.abs(nx) > 0.9) { rx = 0; ry = 1; }
    let xx = ry * nz - rz * ny, xy = rz * nx - rx * nz, xz = rx * ny - ry * nx; const xl = Math.hypot(xx, xy, xz); xx /= xl; xy /= xl; xz /= xl;
    const nd = E(`DIRECTION('',(${f(nx)},${f(ny)},${f(nz)}))`), rd = E(`DIRECTION('',(${f(xx)},${f(xy)},${f(xz)}))`);
    const a2 = E(`AXIS2_PLACEMENT_3D('',#${pts[F.loop[0]]},#${nd},#${rd})`), plane = E(`PLANE('',#${a2})`);
    fids.push(E(`FACE_SURFACE('',(#${fb}),#${plane},.T.)`));
  }
  const shell = E(`CLOSED_SHELL('',(${fids.map(i => '#' + i).join(',')}))`);
  const brep = E(`FACETED_BREP('${esc(meta.id)}',#${shell})`);
  const rep = E(`FACETED_BREP_SHAPE_REPRESENTATION('${esc(meta.id)}',(#${ax},#${brep}),#${rc})`);
  E(`SHAPE_DEFINITION_REPRESENTATION(#${pds},#${rep})`);
  const ts = (meta.time || new Date().toISOString()).slice(0, 19);
  return ['ISO-10303-21;', 'HEADER;', `FILE_DESCRIPTION(('${esc(meta.desc)}'),'2;1');`,
    `FILE_NAME('${esc(meta.file)}','${ts}',(''),(''),'Screw Studio','Screw Studio','');`,
    "FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }'));", 'ENDSEC;', 'DATA;']
    .concat(L, ['ENDSEC;', 'END-ISO-10303-21;']).join('\n') + '\n';
}
function convexQuad(q, p, n) {
  for (let i = 0; i < 4; i++) {
    const a = 3 * q[i], b = 3 * q[(i + 1) % 4], c = 3 * q[(i + 2) % 4];
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2], vx = p[c] - p[b], vy = p[c + 1] - p[b + 1], vz = p[c + 2] - p[b + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    if (cx * n[0] + cy * n[1] + cz * n[2] <= 1e-14) return false;
  }
  return true;
}

// ---------- ZIP (deflate when available) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
async function deflateRaw(u8) {
  if (typeof CompressionStream === 'undefined') return null;
  try { const cs = new CompressionStream('deflate-raw'); const s = new Blob([u8]).stream().pipeThrough(cs); return new Uint8Array(await new Response(s).arrayBuffer()); } catch (e) { return null; }
}
async function makeZip(files) { // [{name, data:Uint8Array}]
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  const now = new Date(), dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)), dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate());
  for (const fl of files) {
    const nm = enc.encode(fl.name), crc = crc32(fl.data); let comp = await deflateRaw(fl.data), method = 8;
    if (!comp || comp.length >= fl.data.length) { comp = fl.data; method = 0; }
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, method, true);
    h.setUint16(10, dt, true); h.setUint16(12, dd, true); h.setUint32(14, crc, true); h.setUint32(18, comp.length, true); h.setUint32(22, fl.data.length, true);
    h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), nm, comp);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, method, true);
    c.setUint16(12, dt, true); c.setUint16(14, dd, true); c.setUint32(16, crc, true); c.setUint32(20, comp.length, true); c.setUint32(24, fl.data.length, true);
    c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + comp.length;
  }
  const cdSize = central.reduce((s, a) => s + a.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}

G.ScrewKit = { SIZES, COARSE, FINE, ISO888, STD, HEADS, DRIVES, TORX_A, findStd, drivesFor, lengthsFor, resolve,
  driveModel, headProfile, headMeridian, threadProfile, polyRadial, hexPoly, buildMesh, checkManifold, toSTL, toSTEP, makeZip, crc32 };
})(typeof window !== 'undefined' ? window : globalThis);
