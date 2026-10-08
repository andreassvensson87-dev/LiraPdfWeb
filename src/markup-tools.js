export function markupBox(points) {
  const [a, b] = points;
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}
export function cloudPoints(points) {
  const r = markupBox(points),
    corners = [
      { x: r.x, y: r.y },
      { x: r.x + r.w, y: r.y },
      { x: r.x + r.w, y: r.y + r.h },
      { x: r.x, y: r.y + r.h },
    ],
    result = [];
  if (r.w < 1 || r.h < 1) throw Error("Molnet behöver bredd och höjd.");
  for (let edge = 0; edge < 4; edge++) {
    const a = corners[edge],
      b = corners[(edge + 1) % 4],
      dx = b.x - a.x,
      dy = b.y - a.y,
      length = Math.hypot(dx, dy),
      lobes = Math.min(200, Math.max(2, Math.ceil(length / 14))),
      radius = length / lobes / 2;
    for (let lobe = 0; lobe < lobes; lobe++)
      for (let step = 0; step < 12; step++) {
        const angle = Math.PI * (1 - step / 12),
          along = ((lobe + 0.5) * length) / lobes + radius * Math.cos(angle),
          out = radius * Math.sin(angle);
        result.push({
          x: a.x + (dx / length) * along + (dy / length) * out,
          y: a.y + (dy / length) * along - (dx / length) * out,
        });
      }
  }
  result.push({ ...result[0] });
  return result;
}
export function stampLayout(entity) {
  const r = markupBox(entity.points),
    text = entity.text || "PRELIMINÄR";
  const size = Math.min(
    entity.fontSize || 18,
    (r.w - 8) / (Math.max(1, text.length) * 0.67),
    (r.h - 8) / 1.3,
  );
  return {
    rect: r,
    text,
    size: Math.max(0.1, size),
    point: {
      x: r.x + r.w / 2 - text.length * size * 0.3,
      y: r.y + r.h / 2 + size * 0.35,
    },
  };
}
export function appearanceHash(text) {
  let hash = 2166136261;
  for (const c of text) {
    hash ^= c.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
