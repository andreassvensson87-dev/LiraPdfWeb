export const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
export const box = (a, b) => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(b.x - a.x),
  h: Math.abs(b.y - a.y),
});
export function constrain(a, b, ortho, length, scale = 1) {
  let dx = b.x - a.x,
    dy = b.y - a.y;
  if (ortho) {
    if (Math.abs(dx) > Math.abs(dy)) dy = 0;
    else dx = 0;
  }
  let d = Math.hypot(dx, dy);
  if (length > 0 && d) {
    dx *= length / scale / d;
    dy *= length / scale / d;
  }
  return { x: a.x + dx, y: a.y + dy };
}
export function arcPoints(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-7)
    throw Error("Bågens tre punkter får inte ligga på samma linje.");
  const sq = (p) => p.x * p.x + p.y * p.y;
  const o = {
    x: (sq(a) * (b.y - c.y) + sq(b) * (c.y - a.y) + sq(c) * (a.y - b.y)) / d,
    y: (sq(a) * (c.x - b.x) + sq(b) * (a.x - c.x) + sq(c) * (b.x - a.x)) / d,
  };
  const ang = (p) => Math.atan2(p.y - o.y, p.x - o.x),
    tau = 2 * Math.PI,
    n = (x) => ((x % tau) + tau) % tau;
  let sweep = n(ang(c) - ang(a));
  if (n(ang(b) - ang(a)) > sweep) sweep -= tau;
  const r = distance(o, a);
  return Array.from({ length: 65 }, (_, i) => ({
    x: o.x + r * Math.cos(ang(a) + (sweep * i) / 64),
    y: o.y + r * Math.sin(ang(a) + (sweep * i) / 64),
  }));
}
export function dimension(a, b, c) {
  const len = distance(a, b);
  if (len < 1e-6) throw Error("Välj två olika mätpunkter.");
  const n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  const off = (c.x - a.x) * n.x + (c.y - a.y) * n.y;
  const p = { x: a.x + n.x * off, y: a.y + n.y * off },
    q = { x: b.x + n.x * off, y: b.y + n.y * off };
  return { p, q, mid: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 - 5 } };
}
