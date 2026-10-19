export function polarPoint(
  origin,
  point,
  increment = 45,
  toleranceDegrees = 5,
) {
  const dx = point.x - origin.x,
    dy = point.y - origin.y,
    length = Math.hypot(dx, dy);
  if (!length || !Number.isFinite(increment) || increment <= 0) return null;
  const angle = Math.atan2(dy, dx),
    step = (increment * Math.PI) / 180,
    nearest = Math.round(angle / step) * step;
  if (Math.abs(angle - nearest) > (toleranceDegrees * Math.PI) / 180)
    return null;
  const projected = dx * Math.cos(nearest) + dy * Math.sin(nearest);
  return {
    point: {
      x: origin.x + projected * Math.cos(nearest),
      y: origin.y + projected * Math.sin(nearest),
    },
    origin,
    angle: nearest,
  };
}
export function trackingPoint(point, anchors, tolerance, polar = null) {
  if (polar) {
    const direction = { x: Math.cos(polar.angle), y: Math.sin(polar.angle) };
    let best = null;
    // Intersect the polar ray with each horizontal/vertical tracking line.
    // Snapping the projected point's coordinates would lose the polar angle.
    for (const anchor of anchors) {
      for (const axis of ["x", "y"]) {
        if (Math.abs(direction[axis]) < 1e-8) continue;
        const length = (anchor[axis] - polar.origin[axis]) / direction[axis];
        if (length < 0) continue;
        const p = {
          x: polar.origin.x + length * direction.x,
          y: polar.origin.y + length * direction.y,
        };
        const distance = Math.hypot(p.x - point.x, p.y - point.y);
        if (distance >= tolerance) continue;
        if (!best || distance < best.distance) {
          best = { point: p, guides: [{ a: anchor, b: p }], distance };
        }
      }
    }
    return best ? { point: best.point, guides: best.guides } : null;
  }
  let x = null,
    y = null,
    dx = tolerance,
    dy = tolerance;
  for (const a of anchors) {
    if (Math.abs(point.x - a.x) < dx) {
      x = a;
      dx = Math.abs(point.x - a.x);
    }
    if (Math.abs(point.y - a.y) < dy) {
      y = a;
      dy = Math.abs(point.y - a.y);
    }
  }
  if (!x && !y) return null;
  const p = { x: x ? x.x : point.x, y: y ? y.y : point.y };
  return {
    point: p,
    guides: [...(x ? [{ a: x, b: p }] : []), ...(y ? [{ a: y, b: p }] : [])],
  };
}
export function createTracker(delay = 450) {
  let candidate = null,
    since = 0,
    anchors = [];
  const same = (a, b) => a && b && Math.hypot(a.x - b.x, a.y - b.y) < 0.01;
  return {
    update(hit, now) {
      if (
        candidate &&
        now - since >= delay &&
        !anchors.some((a) => same(a, candidate))
      ) {
        anchors.push({ ...candidate });
        anchors = anchors.slice(-2);
      }
      const p =
        hit && ["Ändpunkt", "Mittpunkt", "Centrum", "Objekt"].includes(hit.kind)
          ? hit.point
          : null;
      if (!same(p, candidate)) {
        candidate = p ? { ...p } : null;
        since = now;
      }
      return anchors.map((a) => ({ ...a }));
    },
    clear() {
      candidate = null;
      anchors = [];
      since = 0;
    },
  };
}
export function snapSymbol(kind, x, y, r) {
  if (kind === "Mittpunkt")
    return `M ${x} ${y - r} L ${x + r} ${y + r} L ${x - r} ${y + r} Z`;
  if (kind === "Linje")
    return `M ${x - r} ${y - r} L ${x + r} ${y - r} L ${x - r} ${y + r} L ${x + r} ${y + r} Z`;
  if (kind === "Objekt")
    return `M ${x} ${y - r} L ${x + r} ${y} L ${x} ${y + r} L ${x - r} ${y} Z`;
  return `M ${x - r} ${y - r} H ${x + r} V ${y + r} H ${x - r} Z`;
}
