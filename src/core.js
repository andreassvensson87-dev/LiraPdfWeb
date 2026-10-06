export const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
export const box = (a, b) => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(b.x - a.x),
  h: Math.abs(b.y - a.y),
});
export function constrain(a, b, ortho, length, scale = 1) {
  let dx = b.x - a.x,
    dy = b.y - a.y;
  if (ortho) {
    if (Math.abs(dx) > Math.abs(dy)) dy = 0;
    else dx = 0;
  }
  let d = Math.hypot(dx, dy);
  if (length > 0 && d) {
    dx *= length / scale / d;
    dy *= length / scale / d;
  }
  return { x: a.x + dx, y: a.y + dy };
}
export function arcPoints(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-7)
    throw Error("Bågens tre punkter får inte ligga på samma linje.");
  const sq = (p) => p.x * p.x + p.y * p.y;
  const o = {
    x: (sq(a) * (b.y - c.y) + sq(b) * (c.y - a.y) + sq(c) * (a.y - b.y)) / d,
    y: (sq(a) * (c.x - b.x) + sq(b) * (a.x - c.x) + sq(c) * (b.x - a.x)) / d,
  };
  const ang = (p) => Math.atan2(p.y - o.y, p.x - o.x),
    tau = 2 * Math.PI,
    n = (x) => ((x % tau) + tau) % tau;
  let sweep = n(ang(c) - ang(a));
  if (n(ang(b) - ang(a)) > sweep) sweep -= tau;
  const r = distance(o, a);
  return Array.from({ length: 65 }, (_, i) => ({
    x: o.x + r * Math.cos(ang(a) + (sweep * i) / 64),
    y: o.y + r * Math.sin(ang(a) + (sweep * i) / 64),
  }));
}
export function dimension(a, b, c) {
  const len = distance(a, b);
  if (len < 1e-6) throw Error("Välj två olika mätpunkter.");
  const n = { x: -(b.y - a.y) / len, y: (b.x - a.x) / len };
  const off = (c.x - a.x) * n.x + (c.y - a.y) * n.y;
  const p = { x: a.x + n.x * off, y: a.y + n.y * off },
    q = { x: b.x + n.x * off, y: b.y + n.y * off };
  return { p, q, mid: { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 - 5 } };
}
export function primitives(e, scale) {
  const [a, b, c] = e.points,
    out = [];
  const line = (p, q) => out.push({ kind: "line", a: p, b: q });
  const text = (p, value) =>
    out.push({ kind: "text", p, value, size: e.fontSize || 12 });
  const arrow = (p, q) => {
    const t = Math.atan2(q.y - p.y, q.x - p.x),
      r = 6;
    line(p, { x: p.x + r * Math.cos(t + 0.4), y: p.y + r * Math.sin(t + 0.4) });
    line(p, { x: p.x + r * Math.cos(t - 0.4), y: p.y + r * Math.sin(t - 0.4) });
  };
  switch (e.type) {
    case "freehand":
    case "polyline":
      e.points.slice(1).forEach((p, i) => line(e.points[i], p));
      if (e.closed) line(e.points.at(-1), e.points[0]);
      break;
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
      ps.forEach((p, i) => line(p, ps[(i + 1) % 4]));
      break;
    }
    case "circle": {
      const r = distance(a, b),
        ps = Array.from({ length: 97 }, (_, i) => ({
          x: a.x + r * Math.cos((i * Math.PI) / 48),
          y: a.y + r * Math.sin((i * Math.PI) / 48),
        }));
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
export function validateProject(p) {
  if (
    p?.format !== "lirapdf" ||
    p.version !== 1 ||
    typeof p.pdf !== "string" ||
    !Array.isArray(p.entities) ||
    !p.scales ||
    typeof p.scales !== "object"
  )
    throw Error("Ogiltig LiraPDF-projektfil.");
  if (
    p.rotations !== undefined &&
    (!p.rotations ||
      typeof p.rotations !== "object" ||
      Array.isArray(p.rotations) ||
      Object.entries(p.rotations).some(
        ([page, angle]) =>
          !/^[1-9]\d*$/.test(page) || ![0, 90, 180, 270].includes(angle),
      ))
  )
    throw Error("Ogiltig sidrotation.");
  for (const s of Object.values(p.scales))
    if (!Number.isFinite(s) || s <= 0) throw Error("Ogiltig skala.");
  const counts = {
    polyline: -1,
    freehand: -1,
    viewport: 2,
    pdfErase: 2,
    block: 1,
    line: 2,
    rect: 2,
    circle: 2,
    arc: 3,
    leader: 3,
    text: 1,
    replace: 2,
    mask: 2,
    dim: 3,
  };
  const ids = new Set();
  const groupPages = new Map();
  for (const e of p.entities) {
    if (
      !counts[e.type] ||
      !Number.isInteger(e.page) ||
      e.page < 1 ||
      typeof e.id !== "string" ||
      ids.has(e.id) ||
      !Array.isArray(e.points) ||
      (["polyline", "freehand"].includes(e.type)
        ? e.points.length < (e.closed ? 3 : 2) ||
          e.points.length > 10000 ||
          (e.type === "polyline" && typeof e.closed !== "boolean")
        : e.points.length !== counts[e.type]) ||
      e.points.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y)) ||
      !/^#[0-9a-f]{6}$/i.test(e.color) ||
      (e.opacity !== undefined &&
        (!Number.isFinite(e.opacity) || e.opacity < 0 || e.opacity > 1)) ||
      !Number.isFinite(e.width) ||
      e.width <= 0 ||
      e.width > 100 ||
      !Number.isFinite(e.fontSize) ||
      e.fontSize < 1 ||
      e.fontSize > 500 ||
      ("text" in e && typeof e.text !== "string")
    )
      throw Error("Projektet innehåller ogiltiga objekt.");
    if (e.groupId !== undefined) {
      if (
        typeof e.groupId !== "string" ||
        !e.groupId.length ||
        e.groupId.length > 100 ||
        e.type === "pdfErase" ||
        (groupPages.has(e.groupId) && groupPages.get(e.groupId) !== e.page)
      )
        throw Error("Ogiltig objektgrupp.");
      groupPages.set(e.groupId, e.page);
    }
    if (
      e.textAnchor &&
      (!Number.isFinite(e.textAnchor.x) || !Number.isFinite(e.textAnchor.y))
    )
      throw Error("Ogiltig textposition.");
    if (
      e.type === "block" &&
      (typeof e.blockPdf !== "string" ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(e.blockPdf) ||
        typeof e.preview !== "string" ||
        !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(e.preview) ||
        ![e.blockWidth, e.blockHeight, e.naturalWidth, e.naturalHeight].every(
          (n) => Number.isFinite(n) && n > 0,
        ) ||
        !Number.isFinite(e.rotation))
    )
      throw Error("Projektet innehåller ett ogiltigt PDF-block.");
    if (
      e.type === "pdfErase" &&
      ((e.eraseOffset === undefined) === (e.eraseTextOffset === undefined) ||
        !Number.isSafeInteger(e.eraseOffset ?? e.eraseTextOffset) ||
        (e.eraseOffset ?? e.eraseTextOffset) < 0)
    )
      throw Error("Ogiltig PDF-redigering.");
    if (
      e.type === "viewport" &&
      (!Number.isFinite(e.denominator) ||
        e.denominator < 1 ||
        e.denominator > 100000 ||
        (e.name !== undefined &&
          (typeof e.name !== "string" || e.name.length > 100)) ||
        (e.showLabel !== undefined && typeof e.showLabel !== "boolean") ||
        box(...e.points).w < 1 ||
        box(...e.points).h < 1)
    )
      throw Error("Ogiltig viewport.");
    if (
      e.viewportId !== undefined &&
      (typeof e.viewportId !== "string" ||
        ![
          "polyline",
          "freehand",
          "line",
          "circle",
          "rect",
          "arc",
          "text",
          "leader",
          "dim",
          "block",
        ].includes(e.type))
    )
      throw Error("Ogiltig viewporttillhörighet.");
    ids.add(e.id);
  }
  for (const e of p.entities)
    if (
      e.viewportId &&
      !p.entities.some(
        (v) =>
          v.type === "viewport" && v.id === e.viewportId && v.page === e.page,
      )
    )
      throw Error("Objektets viewport saknas.");
  return p;
}
