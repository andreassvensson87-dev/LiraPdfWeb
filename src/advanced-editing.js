import { toCad, fromCad } from "./cad-geometry.js";
import { trimExtend } from "./curve-trim.js";
import { box, distance } from "./core.js";
const clone = structuredClone;
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y }),
  sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y }),
  mul = (a, k) => ({ x: a.x * k, y: a.y * k });
const cross = (a, b) => a.x * b.y - a.y * b.x,
  dot = (a, b) => a.x * b.x + a.y * b.y;
export function pathPoints(e) {
  if (e.type === "rect") {
    const r = box(...e.points);
    return [
      { x: r.x, y: r.y },
      { x: r.x + r.w, y: r.y },
      { x: r.x + r.w, y: r.y + r.h },
      { x: r.x, y: r.y + r.h },
    ];
  }
  return e.points.map((p) => ({ ...p }));
}
export function segments(e) {
  const pts = pathPoints(e),
    closed = e.type === "rect" || e.closed;
  return pts
    .slice(0, closed ? pts.length : -1)
    .map((a, i) => [a, pts[(i + 1) % pts.length]]);
}
export function transformEntity(source, kind, base, target, value) {
  let e = clone(source),
    transform;
  if (!["line", "circle", "rect", "arc", "polyline"].includes(e.type))
    throw Error("Välj linjer, cirklar, rektanglar, bågar eller polylinjer.");
  if (e.type === "rect" && kind !== "scale") {
    e.points = pathPoints(e);
    e.type = "polyline";
    e.closed = true;
  }
  const angle = Math.atan2(target.y - base.y, target.x - base.x),
    a = value ?? angle;
  if (kind === "rotate")
    transform = (p) => {
      const q = sub(p, base);
      return add(base, {
        x: q.x * Math.cos(a) - q.y * Math.sin(a),
        y: q.x * Math.sin(a) + q.y * Math.cos(a),
      });
    };
  if (kind === "scale") {
    if (!(value > 0) || !Number.isFinite(value))
      throw Error("Ange en positiv skalfaktor.");
    transform = (p) => add(base, mul(sub(p, base), value));
  }
  if (kind === "mirror") {
    if (distance(base, target) < 1e-8)
      throw Error("Spegelaxeln behöver två olika punkter.");
    transform = (p) => {
      const q = sub(p, base);
      return add(base, {
        x: q.x * Math.cos(2 * angle) + q.y * Math.sin(2 * angle),
        y: q.x * Math.sin(2 * angle) - q.y * Math.cos(2 * angle),
      });
    };
  }
  e.points = e.points.map(transform);
  return e;
}
export function joinEntities(es) {
  if (
    es.length < 2 ||
    es.some((e) => !["line", "polyline"].includes(e.type) || e.closed)
  )
    throw Error("Välj minst två öppna linjer eller polylinjer.");
  if (
    es.some((e) => e.page !== es[0].page || e.viewportId !== es[0].viewportId)
  )
    throw Error("Objekten måste tillhöra samma viewport eller papper.");
  let pts = clone(es[0].points),
    rest = es.slice(1).map((e) => clone(e.points));
  while (rest.length) {
    let found = false;
    for (let i = 0; i < rest.length; i++) {
      let q = rest[i];
      if (distance(pts.at(-1), q[0]) < 1e-6) pts.push(...q.slice(1));
      else if (distance(pts.at(-1), q.at(-1)) < 1e-6)
        pts.push(...q.reverse().slice(1));
      else if (distance(pts[0], q.at(-1)) < 1e-6)
        pts = [...q.slice(0, -1), ...pts];
      else if (distance(pts[0], q[0]) < 1e-6)
        pts = [...q.reverse().slice(0, -1), ...pts];
      else continue;
      rest.splice(i, 1);
      found = true;
      break;
    }
    if (!found)
      throw Error("Ändpunkterna måste mötas i en sammanhängande kedja.");
  }
  const closed = distance(pts[0], pts.at(-1)) < 1e-6;
  if (closed) pts.pop();
  if (pts.length < (closed ? 3 : 2))
    throw Error("Konturen behöver fler olika hörn.");
  return { ...clone(es[0]), type: "polyline", points: pts, closed };
}
export function explodeEntity(e) {
  if (!["rect", "polyline"].includes(e.type))
    throw Error("Välj en rektangel eller polylinje.");
  return segments(e).map((points) => ({
    ...clone(e),
    type: "line",
    closed: undefined,
    points,
  }));
}
export function vertexEdit(e, p, remove = false) {
  if (!["rect", "polyline"].includes(e.type))
    throw Error("Välj en rektangel eller polylinje.");
  const n = {
    ...clone(e),
    type: "polyline",
    points: pathPoints(e),
    closed: e.type === "rect" || !!e.closed,
  };
  if (remove) {
    if (n.points.length <= (n.closed ? 3 : 2))
      throw Error("Konturen måste behålla tillräckligt många hörn.");
    const i = n.points.reduce(
      (best, q, j) => (distance(q, p) < distance(n.points[best], p) ? j : best),
      0,
    );
    n.points.splice(i, 1);
  } else {
    let index = 0,
      best = Infinity;
    segments(n).forEach(([a, b], i) => {
      const v = sub(b, a),
        t = Math.max(0, Math.min(1, dot(sub(p, a), v) / dot(v, v)));
      const d = distance(p, add(a, mul(v, t)));
      if (d < best) {
        best = d;
        index = i;
      }
    });
    if (
      distance(p, n.points[index]) < 1e-6 ||
      distance(p, n.points[(index + 1) % n.points.length]) < 1e-6
    )
      throw Error("Välj en ny hörnpunkt.");
    n.points.splice(index + 1, 0, { ...p });
  }
  return n;
}
export function intersection(a, b, c, d) {
  const v = sub(b, a),
    w = sub(d, c),
    den = cross(v, w);
  if (Math.abs(den) < 1e-10 * Math.max(1, distance(a, b) * distance(c, d)))
    return null;
  const t = cross(sub(c, a), w) / den,
    u = cross(sub(c, a), v) / den;
  return { point: add(a, mul(v, t)), t, u };
}
export function trimLine(e, limits, p, extend = false) {
  const source = toCad(e);
  if (source.type === "rect") {
    source.type = "polyline";
    source.points = pathPoints(e);
    source.closed = true;
  }
  return trimExtend(
    source,
    limits.map(toCad),
    p,
    extend ? "EXTEND" : "TRIM",
  ).map(fromCad);
}
export function cornerLines(e1, e2, p1, p2, size, fillet) {
  if (e1.id === e2.id || e1.type !== "line" || e2.type !== "line")
    throw Error("Välj två olika raka linjer.");
  const hit = intersection(...e1.points, ...e2.points);
  if (!hit) throw Error("Linjerna är parallella.");
  const v = hit.point;
  const ray = (e, p) => {
    const dir = sub(p, v);
    const i =
      dot(sub(e.points[0], v), dir) > dot(sub(e.points[1], v), dir) ? 0 : 1;
    const length = distance(e.points[i], v);
    if (length < 1e-8) throw Error("Välj på sidan som ska behållas.");
    return { i, length, unit: mul(sub(e.points[i], v), 1 / length) };
  };
  const a = ray(e1, p1),
    b = ray(e2, p2),
    theta = Math.acos(Math.max(-1, Math.min(1, dot(a.unit, b.unit))));
  if (theta < 1e-6 || Math.PI - theta < 1e-6)
    throw Error("Hörnvinkeln är ogiltig.");
  if (!Number.isFinite(size) || size < 0)
    throw Error("Ange ett mått som är noll eller positivt.");
  const t = fillet ? size / Math.tan(theta / 2) : size;
  if (t >= Math.min(a.length, b.length) - 1e-8)
    throw Error("Måttet är för stort för linjerna.");
  const q1 = add(v, mul(a.unit, t)),
    q2 = add(v, mul(b.unit, t)),
    n1 = clone(e1),
    n2 = clone(e2);
  n1.points[1 - a.i] = q1;
  n2.points[1 - b.i] = q2;
  let bridge = null;
  if (fillet && size > 1e-8) {
    const bis = add(a.unit, b.unit),
      center = add(
        v,
        mul(bis, size / Math.sin(theta / 2) / Math.hypot(bis.x, bis.y)),
      );
    const start = Math.atan2(q1.y - center.y, q1.x - center.x),
      end = Math.atan2(q2.y - center.y, q2.x - center.x);
    let sweep = (((end - start) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (sweep > Math.PI) sweep -= Math.PI * 2;
    const mid = add(center, {
      x: size * Math.cos(start + sweep / 2),
      y: size * Math.sin(start + sweep / 2),
    });
    bridge = { ...clone(e1), type: "arc", points: [q1, mid, q2] };
  } else if (distance(q1, q2) > 1e-8)
    bridge = { ...clone(e1), points: [q1, q2] };
  return { updated: [n1, n2], bridge };
}
