import { distance, box } from "./core.js";
export const dist = distance,
  clone = structuredClone,
  uid = () => crypto.randomUUID();
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  mul = (a, k) => ({ x: a.x * k, y: a.y * k });
export const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x),
  polar = (c, r, a) => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) }),
  mod = (a) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
export const onArc = (e, a) =>
  e.sweep >= 0
    ? mod(a - e.start) <= e.sweep + 1e-8
    : mod(e.start - a) <= -e.sweep + 1e-8;
export const hasBulges = () => false,
  polylineParts = () => [];
export function segmentDistance(p, a, b) {
  const v = sub(b, a),
    d = v.x * v.x + v.y * v.y;
  if (!d) return dist(p, a);
  const t = Math.max(
    0,
    Math.min(1, ((p.x - a.x) * v.x + (p.y - a.y) * v.y) / d),
  );
  return dist(p, add(a, mul(v, t)));
}
export function segments(e) {
  let p = e.points;
  if (e.type === "rect") {
    const r = box(...p);
    p = [
      { x: r.x, y: r.y },
      { x: r.x + r.w, y: r.y },
      { x: r.x + r.w, y: r.y + r.h },
      { x: r.x, y: r.y + r.h },
    ];
  }
  return p
    .slice(0, e.closed || e.type === "rect" ? p.length : -1)
    .map((a, i) => [a, p[(i + 1) % p.length]]);
}
export function inside(p, pts) {
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i],
      b = pts[j];
    if (
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x
    )
      hit = !hit;
  }
  return hit;
}
export function intersection(a, b, c, d) {
  const v = sub(b, a),
    w = sub(d, c),
    den = v.x * w.y - v.y * w.x;
  if (Math.abs(den) < 1e-10) return null;
  const q = sub(c, a),
    t = (q.x * w.y - q.y * w.x) / den,
    u = (q.x * v.y - q.y * v.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? add(a, mul(v, t)) : null;
}
export function toCad(e) {
  if (e.type === "circle")
    return { ...e, center: e.points[0], radius: dist(...e.points) };
  if (e.type !== "arc") return { ...e };
  const [a, b, c] = e.points,
    d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y)),
    sq = (p) => p.x * p.x + p.y * p.y;
  if (Math.abs(d) < 1e-9) throw Error("Ogiltig båge.");
  const center = {
      x: (sq(a) * (b.y - c.y) + sq(b) * (c.y - a.y) + sq(c) * (a.y - b.y)) / d,
      y: (sq(a) * (c.x - b.x) + sq(b) * (a.x - c.x) + sq(c) * (b.x - a.x)) / d,
    },
    start = angle(center, a);
  let sweep = mod(angle(center, c) - start);
  if (mod(angle(center, b) - start) > sweep) sweep -= Math.PI * 2;
  return { ...e, center, radius: dist(center, a), start, sweep };
}
export function fromCad(e) {
  const n = { ...e };
  if (e.type === "arc")
    n.points = [e.start, e.start + e.sweep / 2, e.start + e.sweep].map((a) =>
      polar(e.center, e.radius, a),
    );
  if (e.type === "circle") n.points = [e.center, polar(e.center, e.radius, 0)];
  delete n.center;
  delete n.radius;
  delete n.start;
  delete n.sweep;
  return n;
}
