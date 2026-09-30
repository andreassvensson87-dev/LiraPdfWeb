import { box } from "./core.js";
export const mmPerPoint = 25.4 / 72;
export function viewportAt(entities, page, p) {
  if (!p) return null;
  return (
    entities
      .filter((e) => e.type === "viewport" && e.page === page)
      .filter((e) => {
        const r = box(...e.points);
        return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
      })
      .sort((a, b) => {
        const x = box(...a.points),
          y = box(...b.points);
        return x.w * x.h - y.w * y.h;
      })[0] || null
  );
}
export function entityScale(e, entities, scales) {
  const owner = entities.find(
    (v) => v.id === e.viewportId && v.type === "viewport" && v.page === e.page,
  );
  return owner ? owner.denominator * mmPerPoint : scales[e.page];
}
export function transformChildren(
  state,
  id,
  origin,
  factor,
  delta = { x: 0, y: 0 },
) {
  const point = (p) => ({
    x: origin.x + (p.x - origin.x) * factor + delta.x,
    y: origin.y + (p.y - origin.y) * factor + delta.y,
  });
  for (const e of state.entities.filter((e) => e.viewportId === id)) {
    e.points = e.points.map(point);
    if (e.textAnchor) e.textAnchor = point(e.textAnchor);
    if (e.type === "block") {
      e.blockWidth *= factor;
      e.blockHeight *= factor;
    }
    // Dimension labels and line weights stay readable at their paper size.
  }
}
export function changeViewportScale(state, id, denominator) {
  if (!Number.isFinite(denominator) || denominator < 1 || denominator > 100000)
    throw Error("Ange en skala mellan 1:1 och 1:100000.");
  const next = structuredClone(state),
    v = next.entities.find((e) => e.type === "viewport" && e.id === id);
  if (!v) throw Error("Välj en viewport först.");
  const r = box(...v.points);
  transformChildren(next, id, { x: r.x, y: r.y }, v.denominator / denominator);
  const factor = v.denominator / denominator;
  v.points = v.points.map((p) => ({
    x: r.x + (p.x - r.x) * factor,
    y: r.y + (p.y - r.y) * factor,
  }));
  v.denominator = denominator;
  return next;
}

export function viewportCaption(e) {
  const r = box(...e.points);
  return {
    kind: "text",
    p: { x: r.x, y: r.y + r.h + 16 },
    size: 10,
    value: `${e.name || "Viewport"} · Skala 1:${e.denominator}`,
  };
}
