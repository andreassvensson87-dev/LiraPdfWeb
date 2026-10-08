import { toCad, fromCad, dist } from "./cad-geometry.js";
import { polylineOffset } from "./polyline-offset.js";
import { box, distance } from "./core.js";
export const editableTypes = [
  "freehand",
  "highlight",
  "cloud",
  "stamp",
  "polyline",
  "line",
  "circle",
  "ellipse",
  "pdfMarkup",
  "rect",
  "arc",
  "text",
  "leader",
  "dim",
  "block",
];
export const offsetTypes = ["line", "circle", "rect", "arc", "polyline"];
export function translateEntity(entity, a, b) {
  const e = structuredClone(entity);
  const shift = (p) => ({ x: p.x + b.x - a.x, y: p.y + b.y - a.y });
  e.points = e.points.map(shift);
  if (e.textAnchor) e.textAnchor = shift(e.textAnchor);
  return e;
}
export function offsetEntity(entity, amount, side) {
  if (!(amount > 0) || !Number.isFinite(amount))
    throw Error("Ange ett positivt offsetavstånd.");
  if (entity.type === "polyline") {
    const n = polylineOffset(entity, amount, side);
    if (!n)
      throw Error(
        "Offset ger en ogiltig eller kollapsad kontur. Välj mindre avstånd eller andra sidan.",
      );
    n.id = entity.id;
    return n;
  }
  if (entity.type === "arc") {
    const e = toCad(entity);
    e.radius += dist(side, e.center) < e.radius ? -amount : amount;
    if (e.radius <= 1e-8) throw Error("Offsetavståndet är för stort inåt.");
    return fromCad(e);
  }
  const e = structuredClone(entity),
    [a, b] = e.points;
  if (e.type === "line") {
    const length = distance(a, b);
    if (length < 1e-8) throw Error("Linjen är för kort.");
    const sign =
      (b.x - a.x) * (side.y - a.y) - (b.y - a.y) * (side.x - a.x) >= 0 ? 1 : -1;
    return translateEntity(
      e,
      { x: 0, y: 0 },
      {
        x: (-(b.y - a.y) * amount * sign) / length,
        y: ((b.x - a.x) * amount * sign) / length,
      },
    );
  }
  if (e.type === "circle") {
    const r = distance(a, b),
      target = r + (distance(side, a) < r ? -amount : amount);
    if (r < 1e-8 || target <= 1e-8)
      throw Error("Offsetavståndet är för stort inåt.");
    e.points[1] = {
      x: a.x + ((b.x - a.x) * target) / r,
      y: a.y + ((b.y - a.y) * target) / r,
    };
  } else if (e.type === "rect") {
    const r = box(a, b),
      inside =
        side.x > r.x &&
        side.x < r.x + r.w &&
        side.y > r.y &&
        side.y < r.y + r.h;
    const d = inside ? -amount : amount;
    if (r.w + 2 * d <= 1e-8 || r.h + 2 * d <= 1e-8)
      throw Error("Offsetavståndet är för stort inåt.");
    e.points = [
      { x: r.x - d, y: r.y - d },
      { x: r.x + r.w + d, y: r.y + r.h + d },
    ];
  } else throw Error("Offset stöder linjer, cirklar och rektanglar.");
  return e;
}
