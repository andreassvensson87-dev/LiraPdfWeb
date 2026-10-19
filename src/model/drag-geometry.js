import { translateEntity } from "../editing.js";
import { moveGrip } from "../grips.js";
import { blockCorners } from "./block-geometry.js";
import { transformChildren } from "../viewports.js";

// Always derive the preview from the original snapshot, never from the previous
// mouse move. Neither the committed model nor the drag baseline is mutated.
export function previewEntityDrag(before, drag, point) {
  const next = structuredClone(before);
  const delta = { x: point.x - drag.start.x, y: point.y - drag.start.y };
  if (drag.ids?.length > 1) {
    const ids = new Set(drag.ids);
    for (const entity of before.entities)
      if (ids.has(entity.viewportId)) ids.add(entity.id);
    next.entities = before.entities.map((entity) =>
      ids.has(entity.id)
        ? translateEntity(entity, drag.start, point)
        : structuredClone(entity),
    );
    return next;
  }
  const index = next.entities.findIndex((entity) => entity.id === drag.id);
  if (index < 0) throw Error("Objektet som flyttas saknas.");
  const original = before.entities[index],
    entity = next.entities[index];
  if (original.textAnchor && drag.grip === null)
    entity.textAnchor = {
      x: original.textAnchor.x + delta.x,
      y: original.textAnchor.y + delta.y,
    };
  if (entity.type === "block" && drag.grip === 1) {
    const origin = original.points[0],
      corner = blockCorners(original)[2];
    const dx = corner.x - origin.x,
      dy = corner.y - origin.y;
    const factor = Math.max(
      0.01,
      ((point.x - origin.x) * dx + (point.y - origin.y) * dy) /
        (dx * dx + dy * dy),
    );
    entity.blockWidth = original.blockWidth * factor;
    entity.blockHeight = original.blockHeight * factor;
  } else if (
    drag.grip !== null &&
    ["line", "circle", "arc", "pdfMarkup"].includes(entity.type)
  ) {
    const control = original.points[drag.grip];
    next.entities[index] = moveGrip(original, drag.grip, {
      x: control.x + delta.x,
      y: control.y + delta.y,
    });
  } else {
    entity.points = original.points.map((control, index) =>
      drag.grip === null || drag.grip === index
        ? { x: control.x + delta.x, y: control.y + delta.y }
        : { ...control },
    );
    if (entity.type === "viewport" && drag.grip === null)
      transformChildren(next, entity.id, { x: 0, y: 0 }, 1, delta);
  }
  return next;
}
