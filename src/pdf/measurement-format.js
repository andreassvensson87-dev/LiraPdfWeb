import { PDFArray, PDFDict, PDFHexString } from "pdf-lib";
import { key, value, number, numbers, text } from "./annotation-values.js";
import { annotationCoordinates } from "./annotation-coordinates.js";
import { mmPerPoint } from "../viewports.js";
import { annotationCopier } from "./object-graph.js";

// ISO 32000-1 tables 260-263. X converts default user space to real-world
// units; D converts those X units to distance units, so D.C must not repeat X.C.
export function measureDictionary(doc, scale, unit = 1) {
  if (!Number.isFinite(scale) || scale <= 0)
    throw Error("Måttet saknar en giltig skala.");
  const format = (label, conversion) => ({
    Type: "NumberFormat",
    U: PDFHexString.fromText(label),
    C: conversion,
    F: "D",
    D: 10,
    RT: PDFHexString.fromText(" "),
    RD: PDFHexString.fromText(","),
    PS: PDFHexString.fromText(" "),
    SS: PDFHexString.fromText(""),
  });
  return doc.context.obj({
    Type: "Measure",
    Subtype: "RL",
    R: PDFHexString.fromText(
      `1 mm = ${Number((scale / mmPerPoint).toPrecision(12))} mm`,
    ),
    X: [format("mm", scale * unit)],
    D: [format("mm", 1)],
    A: [format("mm²", 1)],
  });
}
const millimeters = new Map([
  ["mm", 1],
  ["cm", 10],
  ["m", 1000],
  ["km", 1000000],
  ["in", 25.4],
  ["inch", 25.4],
  ["inches", 25.4],
  ["ft", 304.8],
  ["feet", 304.8],
  ["yd", 914.4],
  ['"', 25.4],
  ["'", 304.8],
]);
export function readMeasureScale(measure, unit = 1) {
  if (
    !(measure instanceof PDFDict) ||
    ![undefined, "/RL"].includes(value(measure, "Subtype")?.toString())
  )
    return null;
  const axis = (name) => {
    const formats = value(measure, name);
    if (!(formats instanceof PDFArray) || !formats.size()) return null;
    const format = formats.lookup(0);
    if (!(format instanceof PDFDict)) return null;
    const label = text(value(format, "U"))?.trim().toLowerCase();
    const factor = millimeters.get(label),
      conversion = number(format, "C", NaN);
    return factor && Number.isFinite(conversion) && conversion > 0
      ? conversion * factor
      : null;
  };
  const x = axis("X"),
    y = measure.has(key("Y")) ? axis("Y") : x;
  // The editor has one isotropic scale. Preserve unsupported/anisotropic
  // dictionaries in the PDF instead of silently coercing their calibration.
  if (
    !x ||
    !y ||
    Math.abs(x - y) > Math.max(x, y) * 1e-8 ||
    !Number.isFinite(unit) ||
    unit <= 0
  )
    return null;
  return x / unit;
}
function pageBox(page) {
  const a = page.getMediaBox(),
    b = page.getCropBox();
  const box = [
    Math.max(a.x, b.x),
    Math.max(a.y, b.y),
    Math.min(a.x + a.width, b.x + b.width),
    Math.min(a.y + a.height, b.y + b.height),
  ];
  return box[2] > box[0] && box[3] > box[1]
    ? box
    : [a.x, a.y, a.x + a.width, a.y + a.height];
}
const covers = (box, page) => {
  const bounds = pageBox(page);
  return (
    box[0] <= bounds[0] + 0.001 &&
    box[1] <= bounds[1] + 0.001 &&
    box[2] >= bounds[2] - 0.001 &&
    box[3] >= bounds[3] - 0.001
  );
};

export function importPageMeasurements(
  current,
  source,
  state,
  { authoritative = false } = {},
) {
  const known = new Map(
    state.entities.filter((e) => e.type === "viewport").map((e) => [e.id, e]),
  );
  if (authoritative) {
    state.scales = {};
    state.entities = state.entities.filter((e) => e.type !== "viewport");
  }
  let changed = false,
    found = false;
  const copier = annotationCopier(current, source);
  const seen = new Set();
  for (let i = 0; i < current.getPageCount(); i++) {
    const page = source.getPage(i),
      mapping = annotationCoordinates(page),
      entries = value(current.getPage(i).node, "VP");
    if (!(entries instanceof PDFArray)) {
      if (current !== source && page.node.has(key("VP"))) {
        page.node.delete(key("VP"));
        changed = true;
      }
      continue;
    }
    if (current !== source) changed = true;
    const remaining = [];
    // Source and current can be separate contexts. Unsupported viewports are
    // copied without losing geospatial/anisotropic/vendor-specific properties.
    for (const [order, ref] of entries.asArray().entries()) {
      const viewport = current.context.lookup(ref);
      if (!(viewport instanceof PDFDict)) {
        remaining.push(ref);
        continue;
      }
      const bbox = numbers(value(viewport, "BBox")),
        scale = readMeasureScale(value(viewport, "Measure"), mapping.unit);
      if (
        !bbox ||
        bbox.length !== 4 ||
        bbox[2] <= bbox[0] ||
        bbox[3] <= bbox[1] ||
        !scale
      ) {
        remaining.push(ref);
        continue;
      }
      const id = text(value(viewport, "LiraViewportId"));
      if (!id && covers(bbox, page)) state.scales[i + 1] = scale;
      else {
        const old = known.get(id),
          denominator = Number((scale / mmPerPoint).toPrecision(12));
        if (denominator < 1 || denominator > 100000) {
          remaining.push(ref);
          continue;
        }
        const a = mapping.fromPdf(bbox[0], bbox[1]),
          b = mapping.fromPdf(bbox[2], bbox[3]);
        if (Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1) {
          remaining.push(ref);
          continue;
        }
        let entityId = old?.id || id || `viewport-${crypto.randomUUID()}`;
        if (
          seen.has(entityId) ||
          state.entities.some((e) => e.id === entityId && e.type !== "viewport")
        )
          entityId = `viewport-${crypto.randomUUID()}`;
        seen.add(entityId);
        const entity = {
          ...(old || {}),
          id: entityId,
          type: "viewport",
          page: i + 1,
          points: [
            { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) },
            { x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) },
          ],
          denominator,
          pdfViewportOrder: order,
          name: text(value(viewport, "Name")) || old?.name || "Viewport",
          showLabel: old?.showLabel ?? false,
          color: old?.color || "#147b60",
          width: old?.width || 1.2,
          fontSize: old?.fontSize || 12,
        };
        const index = state.entities.findIndex((e) => e.id === entity.id);
        if (index >= 0) state.entities[index] = entity;
        else state.entities.push(entity);
      }
      changed = found = true;
    }
    // Copy each retained dictionary through pdf-lib to the source context.
    if (remaining.length) {
      const copied = remaining.map((ref) =>
        current === source ? ref : copier.copy(ref),
      );
      page.node.set(key("VP"), source.context.obj(copied));
    } else page.node.delete(key("VP"));
  }
  return { changed, found };
}
export async function writePageMeasurements(doc, source, state, pdf) {
  for (let i = 0; i < doc.getPageCount(); i++) {
    const page = doc.getPage(i),
      mapping = annotationCoordinates(source.getPage(i));
    const prior = value(page.node, "VP");
    const entries = prior instanceof PDFArray ? [...prior.asArray()] : [];
    const pageScale = state.scales[i + 1];
    if (pageScale)
      entries.unshift(
        doc.context.obj({
          Type: "Viewport",
          BBox: pageBox(source.getPage(i)),
          Name: PDFHexString.fromText("LiraPDF Page Scale"),
          Measure: measureDictionary(doc, pageScale, mapping.unit),
        }),
      );
    const viewport = (await pdf.getPage(i + 1)).getViewport({ scale: 1 });
    const regions = state.entities
      .filter((e) => e.page === i + 1 && e.type === "viewport")
      .sort((a, b) => {
        const orderedA = Number.isInteger(a.pdfViewportOrder),
          orderedB = Number.isInteger(b.pdfViewportOrder);
        if (orderedA !== orderedB) return orderedA ? -1 : 1;
        if (orderedA) return a.pdfViewportOrder - b.pdfViewportOrder;
        const area = (e) =>
          Math.abs(
            (e.points[1].x - e.points[0].x) * (e.points[1].y - e.points[0].y),
          );
        return area(b) - area(a);
      });
    for (const entity of regions) {
      const a = viewport.convertToPdfPoint(
          entity.points[0].x,
          entity.points[0].y,
        ),
        b = viewport.convertToPdfPoint(entity.points[1].x, entity.points[1].y);
      entries.push(
        doc.context.obj({
          Type: "Viewport",
          BBox: [
            Math.min(a[0], b[0]),
            Math.min(a[1], b[1]),
            Math.max(a[0], b[0]),
            Math.max(a[1], b[1]),
          ],
          Name: PDFHexString.fromText(entity.name || "Viewport"),
          LiraViewportId: PDFHexString.fromText(entity.id),
          Measure: measureDictionary(
            doc,
            entity.denominator * mmPerPoint,
            mapping.unit,
          ),
        }),
      );
    }
    if (entries.length) page.node.set(key("VP"), doc.context.obj(entries));
    else page.node.delete(key("VP"));
  }
}
