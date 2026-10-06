// Keep strokes within the project format's point limit, even during long drags.
export function appendStrokePoint(points, point, minimumDistance = 0) {
  const last = points.at(-1);
  if (last && Math.hypot(point.x - last.x, point.y - last.y) <= minimumDistance)
    return;
  if (points.length >= 10000) {
    const reduced = points.filter(
      (_, i) => i % 2 === 0 || i === points.length - 1,
    );
    points.splice(0, points.length, ...reduced);
  }
  points.push({ x: point.x, y: point.y });
}

export function completeStroke(points, finalPoint) {
  // Capture loss has no reliable position. Retain the last sampled point.
  if (finalPoint) appendStrokePoint(points, finalPoint);
  return points.length > 1;
}
