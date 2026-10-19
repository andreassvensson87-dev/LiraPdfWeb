import { box, distance, arcPoints, dimension } from "./geometry.js";
import { cloudPoints, stampLayout } from "../markup-tools.js";
export function primitives(e, scale) {
  const [a, b, c] = e.points,
    out = [];
  const line = (p, q) => out.push({ kind: "line", a: p, b: q });
  const fill = (points) => {
    if (e.fillColor) out.push({ kind: "fillPath", points, color: e.fillColor });
  };
  const text = (p, value) =>
    out.push({ kind: "text", p, value, size: e.fontSize || 12 });
  const arrow = (p, q) => {
    const t = Math.atan2(q.y - p.y, q.x - p.x),
      r = 6;
    line(p, { x: p.x + r * Math.cos(t + 0.4), y: p.y + r * Math.sin(t + 0.4) });
    line(p, { x: p.x + r * Math.cos(t - 0.4), y: p.y + r * Math.sin(t - 0.4) });
  };
  switch (e.type) {
    case "highlight":
    case "freehand":
    case "polyline":
      if (e.closed) fill(e.points);
      e.points.slice(1).forEach((p, i) => line(e.points[i], p));
      if (e.closed) line(e.points.at(-1), e.points[0]);
      break;
    case "cloud": {
      const ps = cloudPoints(e.points);
      ps.slice(1).forEach((p, i) => line(ps[i], p));
      break;
    }
    case "stamp": {
      const { rect: r, text: value, size, point } = stampLayout(e),
        ps = [
          { x: r.x, y: r.y },
          { x: r.x + r.w, y: r.y },
          { x: r.x + r.w, y: r.y + r.h },
          { x: r.x, y: r.y + r.h },
        ];
      ps.forEach((p, i) => line(p, ps[(i + 1) % 4]));
      out.push({ kind: "text", p: point, value, size, bold: true });
      break;
    }
    case "line":
      line(a, b);
      break;
    case "rect": {
      const r = box(a, b),
        ps = [
          { x: r.x, y: r.y },
          { x: r.x + r.w, y: r.y },
          { x: r.x + r.w, y: r.y + r.h },
          { x: r.x, y: r.y + r.h },
        ];
      fill(ps);
      ps.forEach((p, i) => line(p, ps[(i + 1) % 4]));
      break;
    }
    case "circle": {
      const r = distance(a, b),
        ps = Array.from({ length: 97 }, (_, i) => ({
          x: a.x + r * Math.cos((i * Math.PI) / 48),
          y: a.y + r * Math.sin((i * Math.PI) / 48),
        }));
      fill(ps);
      ps.slice(1).forEach((p, i) => line(ps[i], p));
      break;
    }
    case "ellipse": {
      const r = box(a, b),
        center = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
      if (r.w < 1e-7 || r.h < 1e-7)
        throw Error("Ellipsen måste ha bredd och höjd.");
      const ps = Array.from({ length: 97 }, (_, i) => ({
        x: center.x + (r.w / 2) * Math.cos((i * Math.PI) / 48),
        y: center.y + (r.h / 2) * Math.sin((i * Math.PI) / 48),
      }));
      fill(ps);
      ps.slice(1).forEach((p, i) => line(ps[i], p));
      break;
    }
    case "arc": {
      const ps = arcPoints(a, b, c);
      ps.slice(1).forEach((p, i) => line(ps[i], p));
      break;
    }
    case "leader":
      line(a, b);
      line(b, c);
      arrow(a, b);
      text({ x: c.x + 4, y: c.y - 4 }, e.text);
      break;
    case "text":
      text(a, e.text);
      break;
    case "mask":
      out.push({ kind: "fill", rect: box(a, b), color: e.color });
      break;
    case "replace": {
      const r = box(a, b);
      out.push({ kind: "fill", rect: r });
      text(e.textAnchor || { x: r.x + 2, y: r.y + (e.fontSize || 12) }, e.text);
      break;
    }
    case "dim": {
      const { p, q, mid } = dimension(a, b, c);
      line(a, p);
      line(b, q);
      line(p, q);
      arrow(p, q);
      arrow(q, p);
      text(
        mid,
        `${(distance(a, b) * scale).toLocaleString("sv-SE", { maximumFractionDigits: 1 })} mm`,
      );
      break;
    }
  }
  return out;
}
