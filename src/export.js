import {
  PDFDocument,
  StandardFonts,
  rgb,
  degrees,
  LineCapStyle,
  PDFName,
} from "pdf-lib";
import { applyLineRemovals } from "./pdf-line-edit.js";
import { blockCorners } from "./pdf-block.js";
import { entityScale, viewportCaption } from "./viewports.js";
import {
  originalMarkup,
  markupRect,
  drawMarkupAppearance,
} from "./pdf-markup.js";
import { primitives } from "./core.js";
const parseColor = (c) =>
  rgb(
    parseInt(c.slice(1, 3), 16) / 255,
    parseInt(c.slice(3, 5), 16) / 255,
    parseInt(c.slice(5, 7), 16) / 255,
  );
export async function exportPdf(bytes, entities, scales, pdf, rotations = {}) {
  const doc = await PDFDocument.load(await applyLineRemovals(bytes, entities)),
    font = await doc.embedFont(StandardFonts.Helvetica);
  const blocks = new Map();
  for (let i = 0; i < doc.getPageCount(); i++) {
    const page = doc.getPage(i),
      source = await pdf.getPage(i + 1),
      vp = source.getViewport({ scale: 1 });
    page.setRotation(
      degrees(
        (((page.getRotation().angle + (rotations[i + 1] || 0)) % 360) + 360) %
          360,
      ),
    );
    const pt = (p) => {
      const [x, y] = vp.convertToPdfPoint(p.x, p.y);
      return { x, y };
    };
    for (const e of entities.filter((e) => e.page === i + 1)) {
      if (e.type === "pdfErase" || (e.type === "viewport" && !e.showLabel))
        continue;
      if (e.type === "pdfMarkup") {
        const original = originalMarkup(doc, e);
        if (!original) throw Error("PDF-markeringens original saknas.");
        drawMarkupAppearance(doc, page, doc, original, markupRect(e, vp));
        continue;
      }
      const opacity = e.opacity ?? 1;
      if (opacity === 0) continue;
      // Composite each object once, so overlapping segments keep uniform opacity.
      const bounds = page.getMediaBox();
      const target =
        opacity < 1 ? doc.addPage([bounds.width, bounds.height]) : page;
      if (target !== page)
        target.setMediaBox(bounds.x, bounds.y, bounds.width, bounds.height);
      const finish = async () => {
        if (target === page) return;
        const embedded = await doc.embedPage(target, {
          left: bounds.x,
          bottom: bounds.y,
          right: bounds.x + bounds.width,
          top: bounds.y + bounds.height,
        });
        await embedded.embed();
        doc.context.lookup(embedded.ref).dict.set(
          PDFName.of("Group"),
          doc.context.obj({
            Type: "Group",
            S: "Transparency",
            CS: "DeviceRGB",
            I: true,
            K: false,
          }),
        );
        page.drawPage(embedded, {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          opacity,
        });
        doc.removePage(doc.getPageCount() - 1);
      };
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
        target.drawPage(embedded, {
          ...origin,
          width: Math.hypot(right.x - origin.x, right.y - origin.y),
          height: Math.hypot(top.x - origin.x, top.y - origin.y),
          rotate: degrees(
            (Math.atan2(right.y - origin.y, right.x - origin.x) * 180) /
              Math.PI,
          ),
        });
        await finish();
        continue;
      }
      const color = parseColor(e.type === "viewport" ? "#263b35" : e.color);
      for (const shape of e.type === "viewport"
        ? [viewportCaption(e)]
        : primitives(e, entityScale(e, entities, scales) || 1)) {
        if (shape.kind === "line")
          target.drawLine({
            start: pt(shape.a),
            end: pt(shape.b),
            thickness: e.width,
            ...(e.type === "freehand" ? { lineCap: LineCapStyle.Round } : {}),
            color,
          });
        if (shape.kind === "fillPath") {
          const path =
            shape.points
              .map(pt)
              .map((p, i) => `${i ? "L" : "M"} ${p.x} ${-p.y}`)
              .join(" ") + " Z";
          target.drawSvgPath(path, { color: parseColor(shape.color) });
        }
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
          target.drawRectangle({
            x: minX,
            y: minY,
            width: Math.max(...points.map((p) => p.x)) - minX,
            height: Math.max(...points.map((p) => p.y)) - minY,
            color: shape.color ? parseColor(shape.color) : rgb(1, 1, 1),
          });
        }
        if (shape.kind === "text")
          shape.value.split("\n").forEach((text, j) =>
            target.drawText(text, {
              ...pt({ x: shape.p.x, y: shape.p.y + j * shape.size * 1.25 }),
              font,
              size: shape.size,
              color,
              rotate: degrees(source.rotate),
            }),
          );
      }
      await finish();
    }
  }
  return doc.save();
}
