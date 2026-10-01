import { toCad } from "./cad-geometry.js";
import { distance } from "./core.js";

// Geometry is copied so pointer previews and cancelled edits never alter the source.
export function moveGrip(source, index, point) {
  const e = structuredClone(source);
  if (!e.points[index]) throw Error("Ogiltigt grepp.");
  if (e.type === "circle" && index === 0) {
    const delta = { x: point.x - e.points[0].x, y: point.y - e.points[0].y };
    e.points = e.points.map((p) => ({ x: p.x + delta.x, y: p.y + delta.y }));
  } else e.points[index] = { ...point };
  if (["line", "circle"].includes(e.type) && distance(...e.points) < 1e-7)
    throw Error("Längden eller radien måste vara större än noll.");
  if (e.type === "arc") toCad(e);
  return e;
}
export function gripLengthPoint(e, index, length, scale, cursor) {
  if (!(length > 0) || !(scale > 0))
    throw Error(
      "Ange ett positivt mått och kalibrera pappret eller använd en viewport.",
    );
  if (e.type !== "line" && !(e.type === "circle" && index === 1))
    throw Error("Använd @x,y eller #x;y för det här greppet.");
  const base = e.points[e.type === "circle" ? 0 : 1 - index];
  let direction = cursor || e.points[index];
  if (distance(base, direction) < 1e-7) direction = e.points[index];
  const k = length / scale / distance(base, direction);
  return {
    x: base.x + (direction.x - base.x) * k,
    y: base.y + (direction.y - base.y) * k,
  };
}
