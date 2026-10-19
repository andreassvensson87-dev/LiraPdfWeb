export function textTargetAt(targets, p) {
  return targets.find((t) => {
    const [a, b, , d] = t.polygon,
      u = { x: b.x - a.x, y: b.y - a.y },
      v = { x: d.x - a.x, y: d.y - a.y },
      q = { x: p.x - a.x, y: p.y - a.y };
    const det = u.x * v.y - u.y * v.x;
    if (Math.abs(det) < 1e-9) return false;
    const x = (q.x * v.y - q.y * v.x) / det,
      y = (u.x * q.y - u.y * q.x) / det;
    return x >= 0 && x <= 1 && y >= 0 && y <= 1;
  });
}
