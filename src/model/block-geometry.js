export function blockCorners(e) {
  const a = e.points[0],
    angle = (e.rotation * Math.PI) / 180;
  const u = { x: Math.cos(angle), y: Math.sin(angle) },
    v = { x: -u.y, y: u.x };
  return [
    [0, 0],
    [e.blockWidth, 0],
    [e.blockWidth, e.blockHeight],
    [0, e.blockHeight],
  ].map(([x, y]) => ({
    x: a.x + x * u.x + y * v.x,
    y: a.y + x * u.y + y * v.y,
  }));
}
