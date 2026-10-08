import { box, primitives } from "./core.js";
import { blockCorners } from "./pdf-block.js";
const inside = (p, r) =>
  p.x >= r.x - 1e-8 &&
  p.x <= r.x + r.w + 1e-8 &&
  p.y >= r.y - 1e-8 &&
  p.y <= r.y + r.h + 1e-8;
function crosses(a, b, r) {
  let lo = 0,
    hi = 1;
  for (const [start, delta, min, max] of [
    [a.x, b.x - a.x, r.x, r.x + r.w],
    [a.y, b.y - a.y, r.y, r.y + r.h],
  ]) {
    if (Math.abs(delta) < 1e-12) {
      if (start < min || start > max) return false;
      continue;
    }
    const t1 = (min - start) / delta,
      t2 = (max - start) / delta;
    lo = Math.max(lo, Math.min(t1, t2));
    hi = Math.min(hi, Math.max(t1, t2));
    if (lo > hi) return false;
  }
  return true;
}
const corners = (r) => [
  { x: r.x, y: r.y },
  { x: r.x + r.w, y: r.y },
  { x: r.x + r.w, y: r.y + r.h },
  { x: r.x, y: r.y + r.h },
];
export function inSelection(e, a, b, scale = 1, textRects = []) {
  if (e.type === "pdfErase") return false;
  const r = box(a, b),
    crossing = b.x < a.x,
    lines = [],
    fills = [];
  const outline = (pts) =>
    pts.forEach((p, i) => lines.push([p, pts[(i + 1) % pts.length]]));
  if (e.type === "pdfMarkup") {
    const pts = corners(box(...e.points));
    outline(pts);
    fills.push(pts);
  } else if (e.type === "viewport") outline(corners(box(...e.points)));
  else if (e.type === "block") {
    const pts = blockCorners(e);
    outline(pts);
    fills.push(pts);
  } else
    for (const s of primitives(e, scale)) {
      if (s.kind === "line") lines.push([s.a, s.b]);
      if (s.kind === "fillPath") {
        outline(s.points);
        fills.push(s.points);
      }
      if (s.kind === "fill") {
        const pts = corners(s.rect);
        outline(pts);
        fills.push(pts);
      }
      if (s.kind === "text" && !textRects.length) {
        const text = s.value.split("\n");
        const pts = corners({
          x: s.p.x,
          y: s.p.y - s.size,
          w: Math.max(...text.map((t) => t.length)) * s.size * 0.6,
          h: s.size * (1 + (text.length - 1) * 1.25),
        });
        outline(pts);
        fills.push(pts);
      }
    }
  for (const rect of textRects) {
    const pts = corners(rect);
    outline(pts);
    fills.push(pts);
  }
  if (!crossing)
    return (
      lines.length > 0 && lines.every(([p, q]) => inside(p, r) && inside(q, r))
    );
  if (lines.some(([p, q]) => crosses(p, q, r))) return true;
  // The selection can lie wholly inside a filled object or a rotated PDF block.
  return fills.some((pts) => {
    let hit = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const p = pts[i],
        q = pts[j];
      if (
        p.y > r.y !== q.y > r.y &&
        r.x < ((q.x - p.x) * (r.y - p.y)) / (q.y - p.y) + p.x
      )
        hit = !hit;
    }
    return hit;
  });
}
export function mergeSelection(before, hits, mode = "replace") {
  const ids = new Set(mode === "replace" ? [] : before);
  for (const id of hits) mode === "remove" ? ids.delete(id) : ids.add(id);
  return [...ids];
}
