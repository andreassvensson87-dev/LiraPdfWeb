import {
  add,
  sub,
  mul,
  dist,
  clone,
  uid,
  segmentDistance,
  inside,
  intersection,
  hasBulges,
} from "./cad-geometry.js";
const cross = (a, b) => a.x * b.y - a.y * b.x;
export function infiniteIntersection(a, b, c, d) {
  const v = sub(b, a),
    w = sub(d, c),
    den = cross(v, w);
  if (Math.abs(den) < 1e-10 * Math.max(1, dist(a, b) * dist(c, d))) return null;
  return add(a, mul(v, cross(sub(c, a), w) / den));
}
export function polylineOffset(e, d, p) {
  if (hasBulges(e)) return null;
  const pts = e.points,
    count = pts.length - (e.closed ? 0 : 1);
  if (!(d > 0) || count < 1) return null;
  const edges = Array.from({ length: count }, (_, i) => [
    pts[i],
    pts[(i + 1) % pts.length],
  ]);
  if (edges.some(([a, b]) => dist(a, b) < 1e-8)) return null;
  const nearest = edges.reduce(
    (best, edge) =>
      segmentDistance(p, ...edge) < segmentDistance(p, ...best) ? edge : best,
    edges[0],
  );
  let side =
    cross(sub(nearest[1], nearest[0]), sub(p, nearest[0])) >= 0 ? 1 : -1;
  const area = pts.reduce(
    (sum, a, i) => sum + cross(a, pts[(i + 1) % pts.length]),
    0,
  );
  if (e.closed) side = (inside(p, pts) ? 1 : -1) * (area > 0 ? 1 : -1);
  const shifted = edges.map(([a, b]) => {
    const v = sub(b, a),
      n = mul({ x: -v.y, y: v.x }, (d * side) / dist(a, b));
    return [add(a, n), add(b, n)];
  });
  const result = [];
  for (let i = 0; i < pts.length; i++) {
    if (!e.closed && i === 0) {
      result.push(shifted[0][0]);
      continue;
    }
    if (!e.closed && i === pts.length - 1) {
      result.push(shifted.at(-1)[1]);
      continue;
    }
    const prev = shifted[(i - 1 + count) % count],
      next = shifted[i % count];
    const hit = infiniteIntersection(...prev, ...next);
    if (hit) {
      if (dist(hit, pts[i]) > d * 1000) return null;
      result.push(hit);
    } else if (dist(prev[1], next[0]) < 1e-6) result.push(next[0]);
    else return null;
  }
  // Reject collapsed/reversed edges and self-crossing contours instead of corrupting the drawing.
  for (let i = 0; i < count; i++) {
    const v = sub(result[(i + 1) % result.length], result[i]),
      old = sub(...[edges[i][1], edges[i][0]]);
    if (v.x * old.x + v.y * old.y <= 1e-8) return null;
    for (let j = i + 2; j < count; j++) {
      if (e.closed && i === 0 && j === count - 1) continue;
      if (
        intersection(
          result[i],
          result[(i + 1) % result.length],
          result[j],
          result[(j + 1) % result.length],
        )
      )
        return null;
    }
  }
  return { ...clone(e), id: uid(), points: result };
}
