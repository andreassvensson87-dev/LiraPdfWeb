import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { applyLineRemovals } from "./pdf-line-edit.js";
import { blockCorners } from "./pdf-block.js";
import { primitives } from "./core.js";
const parseColor = (c) =>
  rgb(
    parseInt(c.slice(1, 3), 16) / 255,
    parseInt(c.slice(3, 5), 16) / 255,
    parseInt(c.slice(5, 7), 16) / 255,
  );
export async function exportPdf(bytes, entities, scales, pdf) {
  const doc = await PDFDocument.load(await applyLineRemovals(bytes, entities)),
    font = await doc.embedFont(StandardFonts.Helvetica);
  const blocks = new Map();
  for (let i = 0; i < doc.getPageCount(); i++) {
    const page = doc.getPage(i),
      source = await pdf.getPage(i + 1),
      vp = source.getViewport({ scale: 1 });
    const pt = (p) => {
      const [x, y] = vp.convertToPdfPoint(p.x, p.y);
      return { x, y };
    };
    for (const e of entities.filter((e) => e.page === i + 1)) {
      if (e.type === "block") {
        let embedded = blocks.get(e.blockPdf);
        if (!embedded) {
          const data = Uint8Array.from(atob(e.blockPdf), (c) =>
            c.charCodeAt(0),
          );
          [embedded] = await doc.embedPdf(data, [0]);
          blocks.set(e.blockPdf, embedded);
        }
        const corners = blockCorners(e),
          origin = pt(corners[3]),
          right = pt(corners[2]),
          top = pt(corners[0]);
        page.drawPage(embedded, {
          ...origin,
          width: Math.hypot(right.x - origin.x, right.y - origin.y),
          height: Math.hypot(top.x - origin.x, top.y - origin.y),
          rotate: degrees(
            (Math.atan2(right.y - origin.y, right.x - origin.x) * 180) /
              Math.PI,
          ),
        });
        continue;
      }
      const color = parseColor(e.color);
      for (const shape of primitives(e, scales[i + 1] || 1)) {
        if (shape.kind === "line")
          page.drawLine({
            start: pt(shape.a),
            end: pt(shape.b),
            thickness: e.width,
            color,
          });
        if (shape.kind === "fill") {
          const { x, y, w, h } = shape.rect;
          const points = [
            { x, y },
            { x: x + w, y },
            { x: x + w, y: y + h },
            { x, y: y + h },
          ].map(pt);
          const minX = Math.min(...points.map((p) => p.x)),
            minY = Math.min(...points.map((p) => p.y));
          page.drawRectangle({
            x: minX,
            y: minY,
            width: Math.max(...points.map((p) => p.x)) - minX,
            height: Math.max(...points.map((p) => p.y)) - minY,
            color: shape.color ? parseColor(shape.color) : rgb(1, 1, 1),
          });
        }
        if (shape.kind === "text")
          shape.value.split("\n").forEach((text, j) =>
            page.drawText(text, {
              ...pt({ x: shape.p.x, y: shape.p.y + j * shape.size * 1.25 }),
              font,
              size: shape.size,
              color,
              rotate: degrees(source.rotate),
            }),
          );
      }
    }
  }
  return doc.save();
}
