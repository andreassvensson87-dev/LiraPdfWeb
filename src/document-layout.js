import { pageRotation } from "./page-rotation.js";

export function pageLayout(sizes, rotations = {}, gap = 24) {
  let top = 0;
  return sizes.map((size, index) => {
    const rotated = pageRotation(size.width, size.height, rotations[index + 1]);
    const item = { ...rotated, top, page: index + 1, size };
    top += rotated.height + gap;
    return item;
  });
}

export function scrollPosition(layout, page, pan, zoom, dx, dy, height) {
  const anchor = layout[page - 1];
  const origin = pan.y - anchor.top * zoom;
  const last = layout.at(-1);
  const total = (last.top + last.height) * zoom;
  const margin = 28;
  const y = Math.max(
    Math.min(margin, height - total - margin),
    Math.min(Math.max(margin, height - total - margin), origin - dy),
  );
  const center = (height / 2 - y) / zoom;
  const active = layout.reduce(
    (best, item) => {
      const distance = Math.max(
        item.top - center,
        center - item.top - item.height,
        0,
      );
      return distance < best.distance ? { item, distance } : best;
    },
    { item: anchor, distance: Infinity },
  ).item;
  return {
    page: active.page,
    pan: {
      x: pan.x - dx + ((anchor.width - active.width) * zoom) / 2,
      y: y + active.top * zoom,
    },
    currentPan: { x: pan.x - dx, y: y + anchor.top * zoom },
  };
}
