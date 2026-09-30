// PDF.js 5 uses packed DrawOPS paths. Parse before rendering mutates paths to Path2D.
const identity = [1, 0, 0, 1, 0, 0];
export function multiply(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
export function extractSegments(list, ops, viewportTransform) {
  let matrix = identity.slice(),
    stack = [],
    segments = [];
  const point = (x, y) => {
    const m = multiply(viewportTransform, matrix);
    return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
  };
  for (let i = 0; i < list.fnArray.length; i++) {
    const op = list.fnArray[i],
      args = list.argsArray[i];
    if (op === ops.save || op === ops.paintFormXObjectBegin) {
      stack.push(matrix.slice());
      if (op === ops.paintFormXObjectBegin && args[0])
        matrix = multiply(matrix, args[0]);
    } else if (op === ops.restore || op === ops.paintFormXObjectEnd) {
      matrix = stack.pop() || identity.slice();
    } else if (op === ops.transform) matrix = multiply(matrix, args);
    else if (op === ops.constructPath) {
      const data = args[1]?.[0];
      if (!ArrayBuffer.isView(data) && !Array.isArray(data)) continue;
      if (args[0] === ops.endPath) continue;
      let prev = null,
        start = null;
      const add = (q) => {
        if (prev && Math.hypot(prev.x - q.x, prev.y - q.y) > 0.01)
          segments.push({ a: prev, b: q });
        prev = q;
      };
      for (let j = 0; j < data.length;) {
        const cmd = data[j++];
        if (cmd === 0) {
          prev = point(data[j++], data[j++]);
          start = prev;
        } else if (cmd === 1) add(point(data[j++], data[j++]));
        else if (cmd === 2) {
          j += 4;
          prev = point(data[j++], data[j++]);
        } else if (cmd === 3) {
          j += 2;
          prev = point(data[j++], data[j++]);
        } else if (cmd === 4 && start) add(start);
        else break;
      }
    }
  }
  return segments;
}
export function nearestSnap(p, segments, tolerance) {
  let endpoint = null,
    edge = null,
    ed = tolerance,
    ld = tolerance;
  for (const { a, b } of segments) {
    if (
      p.x < Math.min(a.x, b.x) - tolerance ||
      p.x > Math.max(a.x, b.x) + tolerance ||
      p.y < Math.min(a.y, b.y) - tolerance ||
      p.y > Math.max(a.y, b.y) + tolerance
    )
      continue;
    for (const [point, kind] of [
      [a, "Ändpunkt"],
      [b, "Ändpunkt"],
      [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, "Mittpunkt"],
    ]) {
      const d = Math.hypot(p.x - point.x, p.y - point.y);
      if (d < ed) {
        ed = d;
        endpoint = { point, kind };
      }
    }
    const dx = b.x - a.x,
      dy = b.y - a.y,
      len = dx * dx + dy * dy;
    if (!len) continue;
    const t = Math.max(
        0,
        Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len),
      ),
      q = { x: a.x + t * dx, y: a.y + t * dy },
      d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < ld) {
      ld = d;
      edge = { point: q, kind: "Linje" };
    }
  }
  return endpoint || edge;
}

export function nearestSegment(point, segments, tolerance) {
  let result = null,
    best = tolerance;
  for (const segment of segments) {
    const { a, b } = segment,
      dx = b.x - a.x,
      dy = b.y - a.y,
      length = dx * dx + dy * dy;
    if (!length) continue;
    const t = Math.max(
      0,
      Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / length),
    );
    const distance = Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
    if (distance < best) {
      best = distance;
      result = segment;
    }
  }
  return result;
}
