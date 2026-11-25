// PDF tables: finds the ruling lines (table borders) of a page and cuts the text into the cells they form.
// Works for Word / LibreOffice / Google-Docs PDFs.  Returns { tables:[{top, rows:[[cell,...]]}], rest:[items not in a table] }.
const TOL = 2;
const near = (a, b, t = TOL) => Math.abs(a - b) <= t;

export function pageSegments(opList, OPS) {
  const H = [], V = [];
  const names = {}; Object.entries(OPS).forEach(([k, v]) => { names[v] = k; });
  let m = [1, 0, 0, 1, 0, 0]; const stack = [];
  const mul = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3], a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
  const pt = (x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  const seg = (x1, y1, x2, y2) => {
    const [a, b] = pt(x1, y1), [c, d] = pt(x2, y2);
    if (near(b, d, 0.6) && Math.abs(a - c) > 3) H.push({ y: (b + d) / 2, x1: Math.min(a, c), x2: Math.max(a, c) });
    else if (near(a, c, 0.6) && Math.abs(b - d) > 3) V.push({ x: (a + c) / 2, y1: Math.min(b, d), y2: Math.max(b, d) });
  };
  const rect = (x, y, w, h) => {
    const [a, b] = pt(x, y), [c, d] = pt(x + w, y + h);
    const x1 = Math.min(a, c), x2 = Math.max(a, c), y1 = Math.min(b, d), y2 = Math.max(b, d);
    const th = 3.2;
    if (y2 - y1 <= th && x2 - x1 > 3) H.push({ y: (y1 + y2) / 2, x1, x2 });
    else if (x2 - x1 <= th && y2 - y1 > 3) V.push({ x: (x1 + x2) / 2, y1, y2 });
    else { H.push({ y: y1, x1, x2 }, { y: y2, x1, x2 }); V.push({ x: x1, y1, y2 }, { x: x2, y1, y2 }); }
  };
  opList.fnArray.forEach((fn, i) => {
    const nm = names[fn], args = opList.argsArray[i];
    if (nm === 'save') stack.push(m);
    else if (nm === 'restore') m = stack.pop() || m;
    else if (nm === 'transform') m = mul(args, m);
    else if (nm === 'constructPath') {
      const ops = args[0], c = args[1]; let k = 0, cx = 0, cy = 0, sx = 0, sy = 0;
      for (const o of ops) {
        if (o === OPS.moveTo) { cx = sx = c[k++]; cy = sy = c[k++]; }
        else if (o === OPS.lineTo) { const x = c[k++], y = c[k++]; seg(cx, cy, x, y); cx = x; cy = y; }
        else if (o === OPS.rectangle) { rect(c[k], c[k + 1], c[k + 2], c[k + 3]); k += 4; }
        else if (o === OPS.curveTo) { k += 6; } else if (o === OPS.curveTo2 || o === OPS.curveTo3) { k += 4; }
        else if (o === OPS.closePath) { seg(cx, cy, sx, sy); cx = sx; cy = sy; }
      }
    }
  });
  return { H, V };
}

const uniq = (vals) => {
  const s = [...vals].sort((a, b) => a - b), out = [];
  for (const v of s) { if (out.length && near(out[out.length - 1].v, v)) { const o = out[out.length - 1]; o.v = (o.v * o.n + v) / (o.n + 1); o.n++; } else out.push({ v, n: 1 }); }
  return out.map((o) => o.v);
};

function components(H, V) {
  const boxes = [...H.map((s) => ({ s, t: 'H', x1: s.x1, x2: s.x2, y1: s.y, y2: s.y })), ...V.map((s) => ({ s, t: 'V', x1: s.x, x2: s.x, y1: s.y1, y2: s.y2 }))];
  const p = boxes.map((_, i) => i);
  const find = (i) => { while (p[i] !== i) { p[i] = p[p[i]]; i = p[i]; } return i; };
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.x1 - 2 <= b.x2 && b.x1 - 2 <= a.x2 && a.y1 - 2 <= b.y2 && b.y1 - 2 <= a.y2) p[find(i)] = find(j);
  }
  const g = new Map();
  boxes.forEach((b, i) => { const r = find(i); if (!g.has(r)) g.set(r, []); g.get(r).push(b); });
  return [...g.values()];
}

const cellText = (items) => {
  const rows = [];
  for (const it of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const tol = Math.max(2.5, it.h * 0.5);
    const r = rows.find((q) => Math.abs(q.y - it.y) <= tol);
    if (r) r.items.push(it); else rows.push({ y: it.y, items: [it] });
  }
  rows.sort((a, b) => b.y - a.y);
  const lines = rows.map((r) => {
    r.items.sort((a, b) => a.x - b.x);
    let s = '', end = null;
    for (const it of r.items) { s += (end !== null && it.x - end > it.h * 0.15 ? ' ' : '') + it.str; end = it.x + it.w; }
    return s.trim();
  }).filter(Boolean);
  let out = '';
  for (const l of lines) {
    if (!out) out = l;
    else if (/^\d{1,2}$/.test(l) && /\d$/.test(out)) out += l;               // a number wrapped in a narrow column: "201" + "3"
    else if (/^[)\]]/.test(l) || /[-/(]$/.test(out)) out += l;
    else out += ' ' + l;
  }
  return out.replace(/\s+/g, ' ').trim();
};

export function gridTables(items, H, V, view = [0, 0, 595, 842]) {
  const [vx1, vy1, vx2, vy2] = view;
  H = H.filter((s) => !(s.y <= vy1 + 3 || s.y >= vy2 - 3));
  V = V.filter((s) => !(s.x <= vx1 + 3 || s.x >= vx2 - 3));
  const tables = []; const used = new Set();
  for (const comp of components(H, V)) {
    const hs = comp.filter((c) => c.t === 'H'), vs = comp.filter((c) => c.t === 'V');
    if (hs.length < 2 || vs.length < 2) continue;
    const ys = uniq(hs.map((c) => c.s.y)).reverse();                 // top -> bottom
    const xs = uniq(vs.map((c) => c.s.x));
    if (ys.length < 2 || xs.length < 2) continue;
    const R = ys.length - 1, C = xs.length - 1;
    // is the border between two atoms drawn?
    const hasH = (y, c) => hs.some((s) => near(s.s.y, y) && s.s.x1 <= xs[c] + 3 && s.s.x2 >= xs[c + 1] - 3);
    const hasV = (x, r) => vs.some((s) => near(s.s.x, x) && s.s.y2 >= ys[r] - 3 && s.s.y1 <= ys[r + 1] + 3);
    const par = Array.from({ length: R * C }, (_, i) => i);
    const f = (i) => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      if (c + 1 < C && !hasV(xs[c + 1], r)) par[f(r * C + c)] = f(r * C + c + 1);
      if (r + 1 < R && !hasH(ys[r + 1], c)) par[f(r * C + c)] = f((r + 1) * C + c);
    }
    const bucket = new Map();
    items.forEach((it, idx) => {
      if (used.has(idx)) return;
      const cx = it.x + it.w / 2, cy = it.y + it.h * 0.3;
      if (cx < xs[0] - 1 || cx > xs[C] + 1 || cy > ys[0] + 1 || cy < ys[R] - 1) return;
      let c = xs.findIndex((x, i) => i < C && cx >= x - 1 && cx <= xs[i + 1] + 1), r = ys.findIndex((y, i) => i < R && cy <= y + 1 && cy >= ys[i + 1] - 1);
      if (c < 0 || r < 0) return;
      used.add(idx);
      const k = f(r * C + c); if (!bucket.has(k)) bucket.set(k, []); bucket.get(k).push(it);
    });
    const rows = []; const seen = new Set();
    for (let r = 0; r < R; r++) {
      const cells = [];
      for (let c = 0; c < C; c++) { const k = f(r * C + c); if (seen.has(k)) { cells.push(''); continue; } seen.add(k); cells.push(cellText(bucket.get(k) || [])); }
      rows.push(cells);
    }
    if (rows.some((r) => r.some(Boolean))) tables.push({ top: ys[0], rows });
  }
  return { tables, rest: items.filter((_, i) => !used.has(i)) };
}
